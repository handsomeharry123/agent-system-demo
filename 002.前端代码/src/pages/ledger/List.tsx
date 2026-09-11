// 统一台账中心 - 台账列表页（V1.8 §2.1，操作列固定 3 按钮）
//
// V2.6 接入中心「查看台账」联动：
//   · URL ?openDetail=1 & search={name} → 自动按名称定位台账智能体并跳到详情
//   · 命中 → /app/ledger/detail/{id}(保留 search 筛选项,清掉 openDetail)
//   · 未命中 → 顶部提示「未在台账中找到名称为 XXX 的智能体」并保留 search 预筛
//
// 依据《统一台账中心-需求说明文档 V1.8》§2.1：
//   · 12 列字段：序号 / 智能体编号 / 名称 / 版本 / 所属科室 / 诊疗环节 / 来源 / 供应商 / 功能描述 / 风险分级 / 接入方式 / 运行状态
//   · 操作列固定 3 按钮：详情 / 风险分级 / 更多
//     · 更多下拉：编辑、禁用（仅平台管理员）/ 医院资源管理中心 / 准入评测沙盒 / 运行监控中心
//   · 6 维筛选：所属科室 / 诊疗环节 / 智能体来源 / 风险分级 / 接入方式 / 运行状态
//   · 智能体来源：自研 / 第三方 / 合作研发（V1.8 命名口径）
//   · 风险分级 Tag 形态（V1.8 #10）：高度关注 / 中度关注 / 一般关注（不再区分初/复）

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Select,
  Tag,
  Tooltip,
  Row,
  Col,
  Divider,
  Empty,
  Alert,
  Dropdown,
  Drawer,
  message,
  Radio,
  Checkbox,
  Tabs,
  List,
  Typography,
  Segmented,
  Pagination,
  Avatar,
} from 'antd';
import type { MenuProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { mvpFeatures } from '../../config/mvpFeatures';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  SafetyCertificateOutlined,
  MoreOutlined,
  ExperimentOutlined,
  LinkOutlined,
  AppstoreOutlined,
  MonitorOutlined,
  DownOutlined,
  UpOutlined,
  DownloadOutlined,
  FileTextOutlined,
  BellOutlined,
  RocketOutlined,
  HistoryOutlined,
  UnorderedListOutlined,
  RobotOutlined,
  MedicineBoxOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { matchAgentByName } from '../../utils/agentNameMatcher';
import { getAgentAvatar as getAgentAvatarImage } from '../../utils/agentAvatar';
import {
  SOURCE_COLOR,
  ENUMS,
  getSubscriptionHistoryReports,
  type LedgerAgent,
} from '../../mock/ledger';
import { changeLedgerAgentStatus, getLedgerAgents, type LedgerListResponse } from '../../services/ledgerApi';

const { Text } = Typography;

// ============== 通用辅助 ==============

// V1.7 来源口径：自研 / 第三方 / 合作研发
const SOURCE_DISPLAY: Record<string, string> = {
  自研: '自研',
  外采: '第三方',
  合作开发: '合作研发',
};
const SOURCE_COLOR_MAP: Record<string, string> = {
  自研: 'blue',
  第三方: 'cyan',
  合作研发: 'purple',
};

// V1.7 §2.1 #10 风险分级 Tag：高度(red) / 中度(orange) / 一般(default)；6 枚举含初/复
const RISK_TAG: Record<string, { color: string; tag: string }> = {
  高度关注: { color: 'red', tag: '高度关注' },
  中度关注: { color: 'orange', tag: '中度关注' },
  一般关注: { color: 'default', tag: '一般关注' },
};

const AGENT_AVATAR: Record<string, { background: string; icon: React.ReactNode }> = {
  智能问诊: { background: 'linear-gradient(135deg, #1677ff, #69b1ff)', icon: <RobotOutlined /> },
  导诊分诊: { background: 'linear-gradient(135deg, #13c2c2, #5cdbd3)', icon: <MedicineBoxOutlined /> },
  辅助诊断: { background: 'linear-gradient(135deg, #722ed1, #b37feb)', icon: <MedicineBoxOutlined /> },
  影像分析: { background: 'linear-gradient(135deg, #2f54eb, #85a5ff)', icon: <MedicineBoxOutlined /> },
  病历生成: { background: 'linear-gradient(135deg, #08979c, #5cdbd3)', icon: <RobotOutlined /> },
  用药审核: { background: 'linear-gradient(135deg, #d46b08, #ffc069)', icon: <MedicineBoxOutlined /> },
  健康评估: { background: 'linear-gradient(135deg, #389e0d, #95de64)', icon: <RobotOutlined /> },
};

const getAgentAvatarStyle = (type: string) =>
  AGENT_AVATAR[type] ?? {
    background: 'linear-gradient(135deg, #1677ff, #91caff)',
    icon: <RobotOutlined />,
  };

const DIAGNOSIS_PHASE_TABS = [
  '全部',
  '导诊分诊',
  '预问诊',
  '预约挂号',
  '辅助检查',
  '辅助诊断',
  '辅助治疗',
  '住院',
  '手术',
  '其他',
] as const;

// ============== 筛选状态 ==============

interface FilterState {
  search: string;
  department?: string;
  diagnosisPhase?: string;
  sourceType?: string;
  riskLevel?: string;
  accessType?: string;
  runtimeStatus?: string;
}

const LedgerList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser: authUser } = useAuth();
  const isHospitalLeader = authUser?.roles.includes('医院领导') ?? false;
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(authUser?.roles.includes('信息科管理员') ?? false);

  const [filters, setFilters] = useState<FilterState>({ search: '' });
  // 筛选区展开/收起：默认收起，只显示一行；展开后展示全部筛选维度
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  // 多选导出台账：已勾选行 id 集合
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  // 台账支持卡片 / 表格双视图，默认使用信息密度更友好的卡片视图
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [cardPage, setCardPage] = useState(1);
  const [visibleList, setVisibleList] = useState<LedgerAgent[]>([]);
  const [ledgerMeta, setLedgerMeta] = useState<LedgerListResponse<LedgerAgent>['meta']>({ departments: [], stages: [...ENUMS.diagnosisPhase], sources: ['自研','第三方','合作研发'], riskLevels: ['高度关注','中度关注','一般关注'], accessModes: [...ENUMS.accessType], runtimeStatuses: ['在线','离线','更新','禁用','异常'] });
  const [refreshKey, setRefreshKey] = useState(0);

  // V1：速读订阅抽屉（PRD §3.1.1 / §3.3.1 汇报引导）
  const [subDrawerOpen, setSubDrawerOpen] = useState(false);
  const [subActiveTab, setSubActiveTab] = useState<'settings' | 'history'>('settings');
  // 订阅频率:多选(每日 + 每周 可同时配置)
  const [briefingFreqs, setBriefingFreqs] = useState<Array<'daily' | 'weekly'>>(['daily']);
  // 推送日(每日 + 每周共享;0=周日,1=周一...6=周六),默认周一~周五
  const [pushDays, setPushDays] = useState<number[]>([1, 2, 3, 4, 5]);
  // 历史报告多选导出
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);

  // 历史报告 mock：抽屉打开时取数
  const subscriptionHistory = useMemo(() => getSubscriptionHistoryReports(), []);

  const handleGenerateReport = () => {
    navigate('/app/ledger-demo/report');
  };
  const handleSubscribeBriefing = () => {
    setSubDrawerOpen(true);
  };

  // 从 URL 预筛（总览页 → 列表页的预筛状态）
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const next: FilterState = { search: '' };
    const search = params.get('search');
    if (search) next.search = search;
    const department = params.get('department');
    if (department) next.department = department;
    const diagnosisPhase = params.get('diagnosisPhase');
    if (diagnosisPhase) next.diagnosisPhase = diagnosisPhase;
    const sourceType = params.get('sourceType');
    if (sourceType) next.sourceType = sourceType;
    const riskLevel = params.get('riskLevel');
    if (riskLevel) next.riskLevel = riskLevel;
    const accessType = params.get('accessType');
    if (accessType) next.accessType = accessType;
    const runtimeStatus = params.get('runtimeStatus');
    if (runtimeStatus) next.runtimeStatus = runtimeStatus;
    const lifecycle = params.get('lifecycle');
    if (lifecycle) {
      // 来自总览页的"生命周期"参数，列表页无该筛选项，提示但不应用
      message.info(`按「生命周期=${lifecycle}」预筛（列表页未启用该筛选项）`);
    }
    setFilters(next);
  }, [location.search]);

  // V2.6 接入中心「查看台账」自动打开详情
  //   · URL 带 ?openDetail=1 & search={name} 时,按名称定位台账智能体并跳详情
  //   · 命中 → navigate 到 /app/ledger/detail/{id} 并清掉 openDetail 参数(避免回退再触发)
  //   · 未命中 → message 提示,保留 search 筛选态,让用户手动定位
  //   · 用 ref 防止同一 URL 重复触发
  //   · 匹配策略(从强到弱,首个有命中的立即采纳):
  //     1) 精确相等
  //     2) 去除「系统/智能/平台/助手」等尾缀后再相等
  //     3) 名称互为子串(任一方向包含)
  //     4) 2 字 bigram 相似度(min-归一化):inter ≥ 2 且 ratio ≥ 0.3
  //        平局时优先「活跃」记录(已上线/试运行/已注册),过滤掉已禁用/已归档
  //   · 解决接入中心/台账两侧 mock 命名口径不完全一致的问题,
  //     如「心电图智能辅助诊断」↔「心血管辅助诊断系统」、「肺部 CT 影像分析」↔「胸部 CT 影像分析系统」
  const autoOpenConsumed = useRef<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openDetail = params.get('openDetail');
    const searchName = params.get('search');
    if (!openDetail || !searchName) return;
    if (autoOpenConsumed.current === location.search) return;

    // V2.7: 改用公共 4 级匹配(精确 → 去尾缀 → 子串 → bigram min-归一化 + 活跃 tiebreaker)
    //   接入中心 / 台账 mock 命名口径不一致时仍能命中(如「心电图智能辅助诊断」↔「心电图智能辅助诊断系统」)
    const matched = matchAgentByName(searchName, visibleList, {
      isActive: (a) =>
        // 原 List.tsx 内联 4 级匹配的活跃判定:排除「已禁用」/「已归档」(后者虽不在 LedgerAgent 枚举里,保留判定以防 mock 增改)
        (a as LedgerAgent).lifecycleStatus !== '已禁用' &&
        String((a as LedgerAgent).lifecycleStatus) !== '已归档',
    });

    if (matched) {
      autoOpenConsumed.current = location.search;
      // 跳详情前清掉 openDetail,保留 search 让回退时仍能定位到此行
      const next = new URLSearchParams(location.search);
      next.delete('openDetail');
      const nextSearch = next.toString();
      navigate(`/app/ledger/detail/${matched.id}${nextSearch ? `?${nextSearch}` : ''}`, {
        replace: true,
      });
    } else if (autoOpenConsumed.current !== `miss:${location.search}`) {
      // 仅首次提示未命中,避免筛选过程中重复弹
      autoOpenConsumed.current = `miss:${location.search}`;
      message.warning(`未在台账中找到名称为「${searchName}」的智能体,请手动定位`);
    }
  }, [location.search, navigate, visibleList]);

  useEffect(() => {
    const timer=window.setTimeout(() => {
      void getLedgerAgents<LedgerAgent>({ keyword:filters.search,department:filters.department,stage:filters.diagnosisPhase,source:filters.sourceType,risk:filters.riskLevel,accessMode:filters.accessType,runtimeStatus:filters.runtimeStatus,accessMonth:new URLSearchParams(location.search).get('accessMonth')??undefined })
        .then((data)=>{setVisibleList(data.items);setLedgerMeta(data.meta);setIsPlatformAdmin(data.isPlatformAdmin);})
        .catch((error)=>message.error(error instanceof Error?error.message:'台账列表加载失败'));
    },250);
    return()=>window.clearTimeout(timer);
  },[filters,location.search,refreshKey]);

  useEffect(() => {
    const refresh = () => setRefreshKey((value) => value + 1);
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  // 二次过滤（V1.7 §2.1 筛选查询：6 维 + 关键字）
  const filtered = useMemo(() => {
    let data = visibleList;
    const kw = filters.search.trim().toLowerCase();
    if (kw) {
      data = data.filter(
        (a) =>
          a.idCode.toLowerCase().includes(kw) ||
          a.name.toLowerCase().includes(kw) ||
          a.vendor.toLowerCase().includes(kw) ||
          (a.description ?? '').toLowerCase().includes(kw) ||
          a.functionKeywords.some((keyword) => keyword.toLowerCase().includes(kw)),
      );
    }
    if (filters.department) data = data.filter((a) => a.department === filters.department);
    if (filters.diagnosisPhase)
      data = data.filter((a) => (a.diagnosisPhase ?? []).includes(filters.diagnosisPhase as any));
    if (filters.sourceType) {
      const normalized = SOURCE_DISPLAY[filters.sourceType] ?? filters.sourceType;
      data = data.filter((a) => SOURCE_DISPLAY[a.sourceType] === normalized);
    }
    if (filters.riskLevel) data = data.filter((a) => a.riskLevel === filters.riskLevel);
    if (filters.accessType) data = data.filter((a) => a.accessType === filters.accessType);
    if (filters.runtimeStatus)
      data = data.filter((a) => a.runtimeStatus === filters.runtimeStatus);
    return data;
  }, [visibleList, filters]);

  const handleReset = () => {
    setFilters({ search: '' });
  };

  const handleViewDetail = (agent: LedgerAgent) => {
    navigate(`/app/ledger/detail/${agent.id}`);
  };

  // ===== 批量导出台账 =====
  // - 已勾选 → 仅导出勾选行；未勾选 → 导出当前筛选结果（filtered）
  // - CSV 字段：12 列（与表格一致，含功能描述 / 风险分级等中文）
  // - 文件名：台账_导出_YYYYMMDD_HHmmss_共N条.csv；加 BOM 让 Excel 打开 UTF-8 不乱码
  const escapeCsv = (val: unknown) => {
    const s = val == null ? '' : String(val);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const handleExport = (onlySelected: boolean) => {
    const rows: LedgerAgent[] = onlySelected
      ? filtered.filter((a) => selectedRowKeys.includes(a.id))
      : filtered;
    if (rows.length === 0) {
      message.warning(onlySelected ? '请先勾选要导出的智能体' : '当前筛选结果为空，无可导出数据');
      return;
    }
    const headers = [
      '序号',
      '智能体编号',
      '智能体名称',
      '版本',
      '所属科室',
      '诊疗环节',
      '智能体来源',
      '供应商',
      '功能描述',
      '风险分级',
      '接入方式',
      '运行状态',
    ];
    const lines: string[] = [headers.join(',')];
    rows.forEach((a, i) => {
      const sourceDisplay = SOURCE_DISPLAY[a.sourceType] ?? a.sourceType;
      lines.push(
        [
          i + 1,
          a.idCode,
          a.name,
          a.version,
          a.department,
          (a.diagnosisPhase ?? []).join('/'),
          sourceDisplay,
          a.vendor || '自研',
          a.description ?? '',
          a.riskLevel,
          a.accessType,
          a.runtimeStatus ?? '',
        ]
          .map(escapeCsv)
          .join(','),
      );
    });
    const csv = '﻿' + lines.join('\n');
    const now = dayjs();
    const fname = `台账_导出_${now.format('YYYYMMDD_HHmmss')}_共${rows.length}条.csv`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fname;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success(`已导出 ${rows.length} 条台账数据到 ${fname}`);
  };

  const selectedCount = selectedRowKeys.length;
  // 筛选条件变化 → 清空已选项（避免错位选中其他筛选结果中的同名 id）
  useEffect(() => {
    setSelectedRowKeys([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.search,
    filters.department,
    filters.diagnosisPhase,
    filters.sourceType,
    filters.riskLevel,
    filters.accessType,
    filters.runtimeStatus,
  ]);

  useEffect(() => {
    setCardPage(1);
  }, [filters]);

  const exportMenu: MenuProps['items'] = [
    {
      key: 'export-selected',
      label: (
        <span>
          导出已选（{selectedCount}）
          {selectedCount === 0 && (
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>
              请先勾选
            </Text>
          )}
        </span>
      ),
      icon: <DownloadOutlined />,
      disabled: selectedCount === 0,
      onClick: () => handleExport(true),
    },
    {
      type: 'divider',
    },
    {
      key: 'export-all',
      label: `导出当前筛选结果（${filtered.length}）`,
      icon: <DownloadOutlined />,
      disabled: filtered.length === 0,
      onClick: () => handleExport(false),
    },
  ];

  const getMoreItems = (record: LedgerAgent): MenuProps['items'] => {
    const encName = encodeURIComponent(record.name);
    return isPlatformAdmin
      ? [
          {
            key: 'edit',
            label: '编辑',
            onClick: () => navigate(`/app/ledger/detail/${record.id}?edit=1`),
          },
          {
            key: 'status',
            danger: record.lifecycleStatus !== '已禁用',
            label: record.lifecycleStatus === '已禁用' ? '重新启用' : '禁用',
            onClick: async () => {
              const disabling=record.lifecycleStatus!=='已禁用';
              const reason=disabling?window.prompt('请输入禁用原因')?.trim():undefined;
              if(disabling&&!reason)return;
              try{await changeLedgerAgentStatus(record.id,disabling?'disable':'enable',reason);message.success(disabling?'智能体已禁用':'智能体已重新启用');setRefreshKey((value)=>value+1);}catch(error){message.error(error instanceof Error?error.message:'状态更新失败');}
            },
          },
          { type: 'divider' },
          {
            key: 'resource',
            label: '查看资源申请',
            icon: <AppstoreOutlined />,
            onClick: () => window.open(`/app/resource-center/applies?tab=all&agentName=${encName}`, '_blank'),
          },
          {
            key: 'create-eval',
            label: '创建评测任务',
            icon: <ExperimentOutlined />,
            onClick: () =>
              window.open(
                `/app/evaluation/tasks/create?agentName=${encName}&agentCode=${encodeURIComponent(record.idCode)}`,
                '_blank',
              ),
          },
          {
            key: 'monitor',
            label: '查看监控告警',
            icon: <MonitorOutlined />,
            onClick: () => window.open(`/app/monitoring/alert-events?tab=all&search=${encName}`, '_blank'),
          },
        ]
      : [
          {
            key: 'apply-resource',
            label: '申请资源',
            icon: <AppstoreOutlined />,
            onClick: () => window.open(`/app/resource-center/apply-form?agentName=${encName}`, '_blank'),
          },
          {
            key: 'view-eval',
            label: '查看评测结果',
            icon: <ExperimentOutlined />,
            onClick: () => window.open(`/app/evaluation/tasks?tab=all&agentName=${encName}`, '_blank'),
          },
          {
            key: 'monitor',
            label: '查看监控告警',
            icon: <MonitorOutlined />,
            onClick: () => window.open(`/app/monitoring/alert-events?tab=all&search=${encName}`, '_blank'),
          },
        ];
  };

  const renderAgentActions = (record: LedgerAgent) => (
    <Space size={6} split={<Divider type="vertical" style={{ margin: 0 }} />}>
      <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)} style={{ padding: 0 }}>
        查看详情
      </Button>
      {!isHospitalLeader && mvpFeatures.ledgerRiskLevel && <Button type="link" size="small" icon={<SafetyCertificateOutlined />} onClick={() => navigate(`/app/ledger/risk/${record.id}`)} style={{ padding: 0 }}>风险分级</Button>}
      {!isHospitalLeader && (
        <>
          <Dropdown menu={{ items: getMoreItems(record) }} trigger={['click']}>
            <Button type="link" size="small" icon={<MoreOutlined />} style={{ padding: 0 }}>
              更多
            </Button>
          </Dropdown>
        </>
      )}
    </Space>
  );

  // V1.7 §2.1 列表列定义（12 字段）
  const columns: ColumnsType<LedgerAgent> = [
    {
      title: '序号',
      key: 'idx',
      width: 60,
      render: (_, __, index) => index + 1,
    },
    {
      title: '智能体编号',
      dataIndex: 'idCode',
      key: 'idCode',
      width: 200,
      render: (val: string) => (
        <Tooltip title={val}>
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{val}</span>
        </Tooltip>
      ),
    },
    {
      title: '智能体名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      ellipsis: { showTitle: true },
      render: (val: string, record) => (
        <Tooltip title={val}>
          <a onClick={() => handleViewDetail(record)}>{val}</a>
        </Tooltip>
      ),
    },
    {
      title: '智能体版本',
      dataIndex: 'version',
      key: 'version',
      width: 90,
    },
    {
      title: '所属科室',
      dataIndex: 'department',
      key: 'department',
      width: 110,
      ellipsis: true,
    },
    {
      title: '诊疗环节',
      dataIndex: 'diagnosisPhase',
      key: 'diagnosisPhase',
      width: 160,
      render: (val: string[] | undefined) => (val && val.length > 0 ? val.join(' / ') : <Text type="secondary">-</Text>),
    },
    {
      title: '智能体来源',
      dataIndex: 'sourceType',
      key: 'sourceType',
      width: 110,
      render: (val: string) => {
        const display = SOURCE_DISPLAY[val] ?? val;
        return <Tag color={SOURCE_COLOR_MAP[display] || SOURCE_COLOR[val] || 'default'}>{display}</Tag>;
      },
    },
    {
      title: '供应商名称',
      dataIndex: 'vendor',
      key: 'vendor',
      width: 160,
      ellipsis: { showTitle: true },
      render: (val: string) => (val ? <Tooltip title={val}><span>{val}</span></Tooltip> : <Text type="secondary">自研</Text>),
    },
    {
      title: '功能描述',
      dataIndex: 'description',
      key: 'description',
      width: 240,
      render: (val: string | undefined) =>
        val ? (
          <Tooltip title={val} placement="topLeft">
            <span
              style={{
                display: 'inline-block',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: '1.5',
                verticalAlign: 'bottom',
              }}
            >
              {val}
            </span>
          </Tooltip>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: '风险分级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 110,
      // V1.8 §2.1 #10：仅 高度关注 / 中度关注 / 一般关注 三级，不再区分初/复
      render: (val: string) => {
        const meta = RISK_TAG[val];
        if (!meta) return <Text type="secondary">未分级</Text>;
        return <Tag color={meta.color}>{meta.tag}</Tag>;
      },
    },
    {
      title: '接入方式',
      dataIndex: 'accessType',
      key: 'accessType',
      width: 90,
      render: (val: string) => <Tag>{val}</Tag>,
    },
    {
      title: '运行状态',
      dataIndex: 'runtimeStatus',
      key: 'runtimeStatus',
      width: 90,
      render: (val: string | undefined) => {
        // V1.7 §2.2.1 #8：在线/离线/更新/禁用/异常
        const map: Record<string, { color: string; text: string }> = {
          在线: { color: 'green', text: '在线' },
          离线: { color: 'default', text: '离线' },
          异常: { color: 'red', text: '异常' },
          禁用: { color: 'default', text: '禁用' },
          更新: { color: 'gold', text: '更新' },
        };
        // 空值兜底为「在线」(产品约定,避免空单元格视觉杂乱,详细台账无运行状态视为在用)
        const effective = val || '在线';
        const meta = map[effective] ?? { color: 'default', text: effective };
        return <Tag color={meta.color}>{meta.text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right',
      render: (_, record) => renderAgentActions(record),
    },
  ];

  return (
    <div style={{ padding: 16, background: '#F5F5F5', minHeight: 'calc(100vh - 64px)' }}>
      <PageHeader
        title="台账列表"
        subTitle={isPlatformAdmin ? '全院智能体台账' : `仅显示 ${authUser?.department ?? '本科室'} 台账`}
        extra={
          <Space size={8}>
            {/* V1：PRD §3.1.1 / §3.3.1 汇报引导（生成报告 + 订阅速读） */}
            <Tooltip title="一键生成《全院智能体管理情况报告》">
              <Button icon={<FileTextOutlined />} onClick={handleGenerateReport}>
                生成报告
              </Button>
            </Tooltip>
            <Tooltip title="订阅台账速读（日/周）至工作台">
              <Button icon={<BellOutlined />} onClick={handleSubscribeBriefing}>
                订阅速读
              </Button>
            </Tooltip>
          </Space>
        }
      />

      <Card
        bordered={false}
        bodyStyle={{ padding: 16 }}
      >
        {/* V1.7 §2.1 筛选查询：6 维 + 关键字；与重置按钮同一行，超出部分通过展开/收起控制 */}
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Input
              placeholder="搜索名称 / 编号 / 功能关键词"
              prefix={<SearchOutlined style={{ color: '#BFBFBF' }} />}
              allowClear
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Select
              placeholder="所属科室"
              allowClear
              showSearch
              style={{ width: '100%' }}
              options={ledgerMeta.departments}
              value={filters.department}
              onChange={(v) => setFilters((f) => ({ ...f, department: v }))}
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Select
              placeholder="诊疗环节"
              allowClear
              style={{ width: '100%' }}
              options={ledgerMeta.stages.map((d) => ({ label: d, value: d }))}
              value={filters.diagnosisPhase}
              onChange={(v) => setFilters((f) => ({ ...f, diagnosisPhase: v }))}
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Select
              placeholder="智能体来源"
              allowClear
              style={{ width: '100%' }}
              options={ledgerMeta.sources.map((d) => ({ label: d, value: d }))}
              value={filters.sourceType}
              onChange={(v) => setFilters((f) => ({ ...f, sourceType: v }))}
            />
          </Col>
          {filtersExpanded && (
            <>
              {mvpFeatures.ledgerRiskLevel && <Col xs={24} sm={12} md={8} lg={4}>
                <Select
                  placeholder="风险分级"
                  allowClear
                  style={{ width: '100%' }}
                  options={ledgerMeta.riskLevels.map((d) => ({ label: d, value: d }))}
                  value={filters.riskLevel}
                  onChange={(v) => setFilters((f) => ({ ...f, riskLevel: v }))}
                />
              </Col>}
              <Col xs={24} sm={12} md={8} lg={4}>
                <Select
                  placeholder="接入方式"
                  allowClear
                  style={{ width: '100%' }}
                  options={ledgerMeta.accessModes.map((d) => ({ label: d, value: d }))}
                  value={filters.accessType}
                  onChange={(v) => setFilters((f) => ({ ...f, accessType: v }))}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={4}>
                <Select
                  placeholder="运行状态"
                  allowClear
                  style={{ width: '100%' }}
                  options={ledgerMeta.runtimeStatuses.map((d) => ({ label: d, value: d }))}
                  value={filters.runtimeStatus}
                  onChange={(v) => setFilters((f) => ({ ...f, runtimeStatus: v }))}
                />
              </Col>
            </>
          )}
          <Col xs={24} sm={12} md={8} lg={filtersExpanded ? 12 : 6}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <Space size={8}>
                <Button
                  type="link"
                  size="small"
                  onClick={() => setFiltersExpanded((v) => !v)}
                  style={{ padding: 0 }}
                  icon={filtersExpanded ? <UpOutlined /> : <DownOutlined />}
                >
                  {filtersExpanded ? '收起' : '展开'}
                </Button>
                <Button icon={<ReloadOutlined />} onClick={handleReset}>
                  重置
                </Button>
              </Space>
              <Dropdown menu={{ items: exportMenu }} trigger={['click']} disabled={filtered.length === 0}>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  disabled={filtered.length === 0}
                >
                  导出台账 <DownOutlined style={{ fontSize: 10, marginLeft: 2 }} />
                </Button>
              </Dropdown>
            </div>
          </Col>
        </Row>

        {/* 总数 / 诊疗环节分类 / 视图切换保持在同一行 */}
        <div className="ledger-card-toolbar">
          <Space size={8} style={{ flex: '0 0 auto' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {selectedCount > 0 ? `已选 ${selectedCount} 条` : `共 ${filtered.length} 条`}
            </Text>
            {selectedCount > 0 && (
              <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setSelectedRowKeys([])}>
                清空选择
              </Button>
            )}
          </Space>
          {viewMode === 'card' && (
            <div className="ledger-phase-tabs" role="tablist" aria-label="按诊疗环节筛选">
              <Segmented
                value={filters.diagnosisPhase ?? '全部'}
                onChange={(key) =>
                  setFilters((current) => ({
                    ...current,
                    diagnosisPhase: key === '全部' ? undefined : key,
                  }))
                }
                options={DIAGNOSIS_PHASE_TABS.map((phase) => ({
                  label: phase,
                  value: phase,
                }))}
              />
            </div>
          )}
          <Segmented
            style={{ flex: '0 0 auto' }}
            value={viewMode}
            onChange={(value) => setViewMode(value as 'card' | 'table')}
            options={[
              { label: '卡片', value: 'card', icon: <AppstoreOutlined /> },
              { label: '表格', value: 'table', icon: <UnorderedListOutlined /> },
            ]}
          />
        </div>

        {visibleList.length === 0 ? (
          <Alert
            style={{ marginTop: 16 }}
            type="warning"
            showIcon
            message="暂无智能体数据"
            description="您当前没有可查看的台账数据，请联系平台管理员确认权限。"
          />
        ) : filtered.length === 0 ? (
          <Empty
            style={{ marginTop: 32 }}
            description={
              <span>
                暂无匹配的智能体数据
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  试试调整筛选条件或重置
                </Text>
              </span>
            }
          >
            <Button type="primary" onClick={handleReset}>
              重置筛选
            </Button>
          </Empty>
        ) : (
          <div style={{ marginTop: 12 }}>
            {viewMode === 'card' ? (
              <>
                <Row gutter={[16, 16]}>
                  {filtered.slice((cardPage - 1) * 9, cardPage * 9).map((agent) => {
                    const selected = selectedRowKeys.includes(agent.id);
                    const avatar = getAgentAvatarStyle(agent.type);
                    return (
                      <Col xs={24} md={12} xl={8} key={agent.id}>
                        <Card
                          hoverable
                          className={`ledger-agent-card${selected ? ' is-selected' : ''}`}
                          styles={{ body: { padding: 20, height: '100%', display: 'flex', flexDirection: 'column' } }}
                          style={{ height: 278 }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <Avatar
                              className="ledger-agent-avatar"
                              shape="square"
                              size={64}
                              src={getAgentAvatarImage(agent)}
                              icon={avatar.icon}
                              style={{
                                flex: '0 0 auto',
                                background: avatar.background,
                                color: '#fff',
                                fontSize: 26,
                                boxShadow: '0 6px 16px rgba(22, 119, 255, 0.18)',
                              }}
                            />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <a
                                onClick={() => handleViewDetail(agent)}
                                style={{
                                  display: 'block',
                                  color: '#1f1f1f',
                                  fontSize: 17,
                                  fontWeight: 600,
                                  lineHeight: 1.5,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {agent.name}
                              </a>
                              <Text type="secondary" style={{ fontSize: 13 }}>
                                V{agent.version}
                              </Text>
                            </div>
                            <Checkbox
                              checked={selected}
                              onChange={(e) =>
                                setSelectedRowKeys((keys) =>
                                  e.target.checked ? [...keys, agent.id] : keys.filter((key) => key !== agent.id),
                                )
                              }
                              aria-label={`选择${agent.name}`}
                            />
                          </div>

                          <Text
                            type="secondary"
                            ellipsis
                            style={{ display: 'block', marginTop: 10, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
                          >
                            {agent.idCode}
                          </Text>

                          <Tooltip title={agent.description || '暂无功能描述'} placement="topLeft">
                            <div
                              style={{
                                marginTop: 14,
                                minHeight: 44,
                                color: '#595959',
                                fontSize: 14,
                                lineHeight: '22px',
                                display: '-webkit-box',
                                WebkitBoxOrient: 'vertical',
                                WebkitLineClamp: 2,
                                overflow: 'hidden',
                              }}
                            >
                              {agent.description || '暂无功能描述'}
                            </div>
                          </Tooltip>

                          <div className="ledger-agent-keywords">
                            {agent.functionKeywords.slice(0, 3).map((keyword) => (
                              <Tag
                                key={keyword}
                                bordered={false}
                                style={{
                                  margin: 0,
                                  padding: '2px 10px',
                                  color: '#595959',
                                  background: '#f5f5f5',
                                  borderRadius: 6,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {keyword}
                              </Tag>
                            ))}
                          </div>

                          <div
                            style={{
                              marginTop: 'auto',
                              paddingTop: 14,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10,
                            }}
                          >
                            <Tag className="ledger-agent-phase" color="cyan">
                              {agent.diagnosisPhase?.[0] ?? '其他'}
                            </Tag>
                            <Button
                              className="ledger-profile-action"
                              type="link"
                              size="small"
                              icon={<EyeOutlined />}
                              onClick={() => handleViewDetail(agent)}
                              style={{ flex: '0 0 auto', padding: 0 }}
                            >
                              查看详情
                            </Button>
                          </div>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                  <Pagination
                    current={cardPage}
                    pageSize={9}
                    total={filtered.length}
                    showSizeChanger={false}
                    showTotal={(total) => `共 ${total} 条`}
                    onChange={setCardPage}
                  />
                </div>
              </>
            ) : (
            <Table
              rowKey="id"
              columns={mvpFeatures.ledgerRiskLevel ? columns : columns.filter((column) => column.title !== '风险分级')}
              dataSource={filtered}
              size="middle"
              rowSelection={{
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys),
                preserveSelectedRowKeys: false,
              }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条`,
              }}
              scroll={{ x: 1900 }}
            />
            )}
          </div>
        )}
      </Card>

      {/* V1：台账速读订阅抽屉（PRD §3.1.1 / §3.3.1 汇报引导） */}
      <Drawer
        open={subDrawerOpen}
        onClose={() => setSubDrawerOpen(false)}
        title={
          <Space>
            <BellOutlined style={{ color: '#1677FF' }} />
            <span>{isPlatformAdmin ? '全院台账速读订阅' : '本科室台账速读订阅'}</span>
          </Space>
        }
        width={680}
      >
        <Tabs
          activeKey={subActiveTab}
          onChange={(k) => setSubActiveTab(k as 'settings' | 'history')}
          items={[
            {
              key: 'settings',
              label: (
                <span style={{ fontSize: 14 }}>
                  <RocketOutlined style={{ marginRight: 4 }} />
                  订阅设置
                </span>
              ),
              children: (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <div>
                    <Text strong>订阅频率</Text>
                    <div style={{ marginTop: 6, display: 'flex', gap: 16 }}>
                      <Checkbox
                        checked={briefingFreqs.includes('daily')}
                        onChange={(e) =>
                          setBriefingFreqs((prev) =>
                            e.target.checked ? [...prev, 'daily'] : prev.filter((f) => f !== 'daily'),
                          )
                        }
                      >
                        每日速读
                      </Checkbox>
                      <Checkbox
                        checked={briefingFreqs.includes('weekly')}
                        onChange={(e) =>
                          setBriefingFreqs((prev) =>
                            e.target.checked ? [...prev, 'weekly'] : prev.filter((f) => f !== 'weekly'),
                          )
                        }
                      >
                        每周速读
                      </Checkbox>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      速读为轻量版,侧重异常告警/故障及相较前一日/前一周的数据变化
                    </Text>
                  </div>

                  {(briefingFreqs.includes('daily') || briefingFreqs.includes('weekly')) && (
                    <div data-testid="push-day-picker">
                      <Text strong>推送日（每日 + 每周共享）</Text>
                      <div style={{ marginTop: 6 }}>
                        <Checkbox.Group
                          value={pushDays}
                          onChange={(v) => setPushDays(v as number[])}
                          style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}
                        >
                          {[
                            { v: 1, l: '一' },
                            { v: 2, l: '二' },
                            { v: 3, l: '三' },
                            { v: 4, l: '四' },
                            { v: 5, l: '五' },
                            { v: 6, l: '六' },
                            { v: 0, l: '日' },
                          ].map((d) => (
                            <Checkbox key={d.v} value={d.v}>
                              周{d.l}
                            </Checkbox>
                          ))}
                        </Checkbox.Group>
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        多选表示多天推送,至少选 1 天;勾选的星期对每日/每周速读都生效
                      </Text>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                    <Button
                      type="primary"
                      icon={<RocketOutlined />}
                      style={{ width: 200 }}
                      disabled={briefingFreqs.length === 0 || pushDays.length === 0}
                      onClick={() => {
                        setSubDrawerOpen(false);
                        const parts: string[] = [];
                        const dayMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
                        const fmtDays = (arr: number[]) =>
                          arr
                            .slice()
                            .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
                            .map((d) => dayMap[d])
                            .join('/');
                        const daysText = fmtDays(pushDays);
                        if (briefingFreqs.includes('daily')) {
                          parts.push(`每日(${daysText})`);
                        }
                        if (briefingFreqs.includes('weekly')) {
                          parts.push(`每周${daysText}`);
                        }
                        message.success(
                          `订阅已开启: ${parts.join(' + ')} · ${isPlatformAdmin ? '全院' : '本科室'}`,
                        );
                      }}
                    >
                      立即开启订阅
                    </Button>
                  </div>
                </Space>
              ),
            },
            {
              key: 'history',
              label: (
                <span style={{ fontSize: 14 }}>
                  <HistoryOutlined style={{ marginRight: 4 }} />
                  历史报告
                </span>
              ),
              children: (
                <div data-testid="subscription-history">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <Space size={6}>
                      <Checkbox
                        checked={
                          subscriptionHistory.length > 0 &&
                          selectedReportIds.length === subscriptionHistory.length
                        }
                        indeterminate={
                          selectedReportIds.length > 0 &&
                          selectedReportIds.length < subscriptionHistory.length
                        }
                        onChange={() => {
                          // 行为:已全选 → 全不选;否则(含 indeterminate)→ 全选
                          const allSelected =
                            selectedReportIds.length === subscriptionHistory.length;
                          setSelectedReportIds(allSelected ? [] : subscriptionHistory.map((r) => r.id));
                        }}
                      >
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          全选
                        </Text>
                      </Checkbox>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        共 {subscriptionHistory.length} 条
                        {selectedReportIds.length > 0 && ` · 已选 ${selectedReportIds.length} 条`}
                      </Text>
                    </Space>
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      icon={<DownloadOutlined />}
                      disabled={selectedReportIds.length === 0}
                      onClick={() => {
                        message.success(
                          `已订阅 ${selectedReportIds.length} 条历史报告导出任务（演示）`,
                        );
                        setSelectedReportIds([]);
                      }}
                    >
                      批量导出
                    </Button>
                  </div>
                  <List
                    size="small"
                    dataSource={subscriptionHistory}
                    renderItem={(item) => {
                      const checked = selectedReportIds.includes(item.id);
                      return (
                        <List.Item
                          key={item.id}
                          style={{
                            padding: '8px 12px',
                            background: '#FAFAFA',
                            borderRadius: 6,
                            marginBottom: 6,
                            border: '1px solid #F0F0F0',
                          }}
                          actions={[
                            <Button
                              key="export"
                              size="small"
                              type="link"
                              icon={<DownloadOutlined />}
                              onClick={() => {
                                message.success(`已导出报告: ${item.title}`);
                                setSelectedReportIds((prev) =>
                                  prev.filter((id) => id !== item.id),
                                );
                              }}
                            >
                              导出
                            </Button>,
                          ]}
                        >
                          <List.Item.Meta
                            avatar={
                              <Checkbox
                                checked={checked}
                                onChange={(e) => {
                                  setSelectedReportIds((prev) =>
                                    e.target.checked
                                      ? [...prev, item.id]
                                      : prev.filter((id) => id !== item.id),
                                  );
                                }}
                              />
                            }
                            title={
                              <Space size={6} wrap>
                                <FileTextOutlined style={{ fontSize: 16, color: '#1677FF' }} />
                                {/* 报告名称：点击进入报告详情 */}
                                <a
                                  onClick={() => navigate('/app/ledger-demo/report')}
                                  style={{ fontSize: 13, fontWeight: 600 }}
                                >
                                  {item.title}
                                </a>
                                <Tag color={item.freq === 'daily' ? 'geekblue' : 'purple'} style={{ margin: 0 }}>
                                  {item.freq === 'daily' ? '每日' : '每周'}
                                </Tag>
                                <Tag
                                  color={item.status === 'failed' ? 'red' : item.status === 'viewed' ? 'default' : 'blue'}
                                  style={{ margin: 0 }}
                                >
                                  {item.status === 'failed' ? '推送失败' : item.status === 'viewed' ? '已查看' : '已送达'}
                                </Tag>
                              </Space>
                            }
                            description={
                              <div style={{ marginTop: 2 }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  推送日期:
                                  <span style={{ marginLeft: 4, color: '#262626' }}>
                                    {item.deliveredAt || '—'}
                                  </span>
                                </Text>
                              </div>
                            }
                          />
                        </List.Item>
                      );
                    }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Drawer>
    </div>
  );
};

export default LedgerList;
