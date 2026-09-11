/**
 * 统一台账中心 - 智能化升级 Demo
 * §3.2.1 台账列表页(辅助标识演示)
 *
 * 依据《台账中心智能化升级-需求说明V1》§3.2.1：
 *   - 列表每条以标识提示 评测 / 告警 / 故障 等状态,辅助判断优先级
 *   - 检索 / 筛选 / 排序 快速定位目标智能体
 *   - 点击【详情】进入 360 画像视图(默认)
 *
 * 设计:
 *   - 复用 antd Table + Tag
 *   - 列表内:运行状态/风险分级/评测阶段 + 告警/故障计数辅助标识
 *   - 顶部筛选条:按科室 / 风险 / 告警筛选
 */
import React, { useMemo, useState } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Input,
  Select,
  Button,
  Typography,
  Tooltip,
  Empty,
  Segmented,
  Alert,
} from 'antd';
import {
  SearchOutlined,
  EyeOutlined,
  FireFilled,
  WarningOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  RobotOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';

const { Text } = Typography;

// ============ Mock 列表数据 ============
interface ListRow {
  id: string;
  idCode: string;
  name: string;
  department: string;
  diagnosisPhase: string;
  runtimeStatus: '在线' | '离线' | '异常' | '更新';
  riskLevel: '高度关注' | '中度关注' | '一般关注';
  evalStage: '评测完成' | '评测中' | '待评测' | '退回修改';
  sourceType: string;
  alarmCount: number;
  faultCount: number;
  lastUpdate: string;
}

const ROWS: ListRow[] = [
  { id: 'lung-ai-001', idCode: 'IMG-0023', name: '肺结节智能筛查系统', department: '影像科', diagnosisPhase: '辅助诊断', runtimeStatus: '在线', riskLevel: '高度关注', evalStage: '评测完成', sourceType: '第三方', alarmCount: 2, faultCount: 1, lastUpdate: '06-29 14:22' },
  { id: 'ecg-ai', idCode: 'CIN-0008', name: '心电智能分析系统', department: '心内科', diagnosisPhase: '辅助诊断', runtimeStatus: '在线', riskLevel: '中度关注', evalStage: '评测完成', sourceType: '自研', alarmCount: 0, faultCount: 0, lastUpdate: '06-29 13:50' },
  { id: 'cta-ai', idCode: 'CIN-0011', name: '冠脉CTA评估助手', department: '心内科', diagnosisPhase: '辅助诊断', runtimeStatus: '异常', riskLevel: '高度关注', evalStage: '评测完成', sourceType: '第三方', alarmCount: 3, faultCount: 1, lastUpdate: '06-29 12:10' },
  { id: 'med-audit', idCode: 'PHA-0005', name: '智能用药审核', department: '药剂科', diagnosisPhase: '辅助诊断', runtimeStatus: '在线', riskLevel: '中度关注', evalStage: '评测完成', sourceType: '自研', alarmCount: 0, faultCount: 0, lastUpdate: '06-29 09:18' },
  { id: 'triage', idCode: 'EME-0014', name: '智能导诊助手 v2.1', department: '急诊科', diagnosisPhase: '导诊分诊', runtimeStatus: '在线', riskLevel: '一般关注', evalStage: '评测完成', sourceType: '第三方', alarmCount: 2, faultCount: 0, lastUpdate: '06-29 11:42' },
  { id: 'pretriage', idCode: 'CIN-0009', name: '智能预问诊', department: '心内科', diagnosisPhase: '预问诊', runtimeStatus: '在线', riskLevel: '一般关注', evalStage: '评测中', sourceType: '自研', alarmCount: 0, faultCount: 0, lastUpdate: '06-29 14:00' },
  { id: 'emr-gen', idCode: 'END-0006', name: '病历生成助手', department: '内分泌科', diagnosisPhase: '辅助诊断', runtimeStatus: '异常', riskLevel: '中度关注', evalStage: '评测完成', sourceType: '合作研发', alarmCount: 1, faultCount: 1, lastUpdate: '06-29 08:32' },
  { id: 'imagx', idCode: 'IMG-0019', name: '影像AI辅助诊断系统', department: '影像科', diagnosisPhase: '辅助诊断', runtimeStatus: '离线', riskLevel: '高度关注', evalStage: '评测完成', sourceType: '第三方', alarmCount: 5, faultCount: 2, lastUpdate: '06-29 06:14' },
  { id: 'icu-monitor', idCode: 'ICU-0002', name: '重症医学监测助手', department: '重症医学科', diagnosisPhase: '辅助治疗', runtimeStatus: '在线', riskLevel: '高度关注', evalStage: '评测完成', sourceType: '自研', alarmCount: 0, faultCount: 0, lastUpdate: '06-29 13:55' },
  { id: 'pft-ai', idCode: 'GER-0007', name: '老年医学评估系统', department: '老年医学科', diagnosisPhase: '辅助诊断', runtimeStatus: '在线', riskLevel: '中度关注', evalStage: '待评测', sourceType: '第三方', alarmCount: 0, faultCount: 0, lastUpdate: '06-29 12:30' },
  { id: 'rheum-ai', idCode: 'RHE-0003', name: '风湿免疫辅助分析', department: '风湿免疫科', diagnosisPhase: '辅助诊断', runtimeStatus: '更新', riskLevel: '一般关注', evalStage: '退回修改', sourceType: '第三方', alarmCount: 1, faultCount: 0, lastUpdate: '06-29 10:18' },
  { id: 'lis-ai', idCode: 'LAB-0004', name: '检验报告智能解读', department: '检验科', diagnosisPhase: '辅助检查', runtimeStatus: '在线', riskLevel: '中度关注', evalStage: '评测完成', sourceType: '自研', alarmCount: 0, faultCount: 0, lastUpdate: '06-29 14:08' },
];

const RISK_COLOR: Record<string, string> = { 高度关注: 'red', 中度关注: 'orange', 一般关注: 'default' };
const STAGE_COLOR: Record<string, string> = { 评测完成: 'green', 评测中: 'blue', 待评测: 'gold', 退回修改: 'red' };
const STATUS_COLOR: Record<string, string> = { 在线: 'green', 离线: 'default', 异常: 'red', 更新: 'blue' };

// ============ 辅助标识 Tag 组 ============
const HelperBadges: React.FC<{ row: ListRow }> = ({ row }) => (
  <Space size={4} wrap>
    {row.faultCount > 0 && (
      <Tooltip title={`故障 ${row.faultCount} 次(中断,较重)`}>
        <Tag color="red" icon={<ExclamationCircleOutlined />}>
          故障 {row.faultCount}
        </Tag>
      </Tooltip>
    )}
    {row.alarmCount > 0 && (
      <Tooltip title={`告警 ${row.alarmCount} 次(预警,较浅)`}>
        <Tag color="orange" icon={<WarningOutlined />}>
          告警 {row.alarmCount}
        </Tag>
      </Tooltip>
    )}
    {row.alarmCount === 0 && row.faultCount === 0 && (
      <Tag color="green" icon={<CheckCircleOutlined />}>
        运行正常
      </Tag>
    )}
  </Space>
);

// ============ 主体 ============
const AgentListV32: React.FC = () => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [department, setDepartment] = useState<string | undefined>();
  const [riskFilter, setRiskFilter] = useState<string | undefined>();
  const [scope, setScope] = useState<'all' | 'hasIssue'>('all');

  const filtered = useMemo(() => {
    return ROWS.filter((r) => {
      if (keyword && !(r.name.includes(keyword) || r.idCode.includes(keyword))) return false;
      if (department && r.department !== department) return false;
      if (riskFilter && r.riskLevel !== riskFilter) return false;
      if (scope === 'hasIssue' && r.alarmCount === 0 && r.faultCount === 0) return false;
      return true;
    });
  }, [keyword, department, riskFilter, scope]);

  const columns = [
    {
      title: '智能体',
      key: 'agent',
      width: 280,
      render: (_: any, r: ListRow) => (
        <div>
          <Space size={4}>
            <Text strong>{r.name}</Text>
            {r.runtimeStatus === '异常' && <FireFilled style={{ color: '#FF4D4F' }} />}
          </Space>
          <div style={{ fontSize: 11, color: '#8C8C8C', marginTop: 2 }}>
            {r.idCode} · {r.sourceType}
          </div>
        </div>
      ),
    },
    {
      title: '所属科室 / 环节',
      key: 'dept',
      width: 160,
      render: (_: any, r: ListRow) => (
        <div>
          <Tag color="cyan">{r.department}</Tag>
          <div style={{ fontSize: 11, color: '#8C8C8C', marginTop: 2 }}>{r.diagnosisPhase}</div>
        </div>
      ),
    },
    {
      title: '运行状态',
      dataIndex: 'runtimeStatus',
      key: 'runtimeStatus',
      width: 100,
      render: (s: ListRow['runtimeStatus']) => <Tag color={STATUS_COLOR[s]}>{s}</Tag>,
      sorter: (a: ListRow, b: ListRow) => a.runtimeStatus.localeCompare(b.runtimeStatus),
    },
    {
      title: '风险分级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 110,
      render: (l: ListRow['riskLevel']) => <Tag color={RISK_COLOR[l]}>{l}</Tag>,
      sorter: (a: ListRow, b: ListRow) => a.riskLevel.localeCompare(b.riskLevel),
    },
    {
      title: '评测阶段',
      dataIndex: 'evalStage',
      key: 'evalStage',
      width: 110,
      render: (s: ListRow['evalStage']) => <Tag color={STAGE_COLOR[s]}>{s}</Tag>,
    },
    {
      title: '状态辅助标识',
      key: 'badges',
      width: 200,
      render: (_: any, r: ListRow) => <HelperBadges row={r} />,
    },
    {
      title: '最后更新',
      dataIndex: 'lastUpdate',
      key: 'lastUpdate',
      width: 130,
      render: (s: string) => <Text type="secondary" style={{ fontSize: 12 }}>{s}</Text>,
      sorter: (a: ListRow, b: ListRow) => a.lastUpdate.localeCompare(b.lastUpdate),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right' as const,
      render: (_: any, r: ListRow) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate('/app/ledger-demo/profile')}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 16, background: '#F5F5F5', minHeight: 'calc(100vh - 64px)' }}>
      <PageHeader
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              size="small"
              onClick={() => navigate('/app/ledger')}
            />
            <span>台账列表(智能化升级 Demo · §3.2.1)</span>
            <Tag color="processing">PRD §3.2.1</Tag>
          </Space>
        }
        subTitle="列表辅助标识 + 检索筛选排序 + 点击详情进入 360 画像视图"
      />

      <Alert
        type="info"
        showIcon
        style={{ marginTop: 12, marginBottom: 12 }}
        message={
          <span>
            💡 本页为 PRD §3.2.1 演示 — 列表每条以「<strong>告警 / 故障 / 风险 / 评测阶段</strong>」标识辅助判断优先级;
            顶部支持按关键字 / 科室 / 风险等级 / 是否有异常筛选;点击「详情」进入 360 画像视图(默认)。
          </span>
        }
      />

      <Card bordered={false} bodyStyle={{ padding: 12 }}>
        {/* 筛选条 */}
        <Space wrap style={{ marginBottom: 12 }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#BFBFBF' }} />}
            placeholder="搜索智能体名称 / 编号"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            allowClear
            style={{ width: 240 }}
          />
          <Select
            placeholder="按科室筛选"
            value={department}
            onChange={setDepartment}
            allowClear
            style={{ width: 160 }}
            options={Array.from(new Set(ROWS.map((r) => r.department))).map((d) => ({ label: d, value: d }))}
          />
          <Select
            placeholder="按风险分级筛选"
            value={riskFilter}
            onChange={setRiskFilter}
            allowClear
            style={{ width: 160 }}
            options={[
              { label: '高度关注', value: '高度关注' },
              { label: '中度关注', value: '中度关注' },
              { label: '一般关注', value: '一般关注' },
            ]}
          />
          <Segmented
            value={scope}
            onChange={(v) => setScope(v as 'all' | 'hasIssue')}
            options={[
              { label: '全部', value: 'all' },
              { label: '仅看有告警 / 故障', value: 'hasIssue' },
            ]}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            共 {filtered.length} / {ROWS.length} 条
          </Text>
        </Space>

        <Table
          rowKey="id"
          size="middle"
          columns={columns as any}
          dataSource={filtered}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          scroll={{ x: 1240 }}
          locale={{ emptyText: <Empty description="没有匹配的智能体" /> }}
        />
      </Card>
    </div>
  );
};

export default AgentListV32;
