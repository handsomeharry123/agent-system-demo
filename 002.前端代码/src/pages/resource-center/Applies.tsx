/**
 * 医院资源管理中心 - 2.1 申请管理列表
 * 规范:医院资源管理中心-需求说明文档V1.2 §2.1
 *   - 7 个 Tab(顺序:全部申请 / 草稿 / 待审核 / 审核中 / 撤销修改 / 审核通过 / 退回修改)
 *   - 公共字段(§2.1):序号 / 智能体编号 / 智能体名称 / 所属科室 / 诊疗环节 / 功能描述 / 申请资源名称
 *   - 各 Tab 特有字段:
 *       全部申请(§2.1.1):申请状态(含已归档标识)
 *       草稿(§2.1.2):最后编辑时间
 *       待审核(§2.1.3):提交审核时间
 *       审核中(§2.1.4):提交审核时间
 *       撤销修改(§2.1.5):撤销时间
 *       审核通过(§2.1.6):具体说明 + 审核通过时间
 *       退回修改(§2.1.7):退回原因说明 + 退回时间
 *   - V1.2 §2.1 数据范围(对齐 §2.1.3-2.1.7 口径):
 *       全部申请:信息科管理员展示所有角色的申请 / 科室管理员展示自己的申请
 *       草稿:仅展示当前用户创建的草稿(用户隔离)
 *       待审核 / 审核中 / 撤销修改 / 审核通过 / 退回修改:信息科管理员展示所有 / 科室管理员展示自己
 *   - V1.2 §2.1 操作按钮角色矩阵(按 Tab × 角色精确分发):
 *       草稿:所有角色:编辑 / 删除
 *       待审核:管理员:查看详情 / 审核;科室管理员:查看详情 / 撤销(点击撤销申请流转到「撤销修改」Tab)
 *       审核中:管理员:查看详情 / 审核;科室管理员:查看详情 / 撤销(点击撤销申请流转到「撤销修改」Tab)
 *       撤销修改:管理员:查看详情;科室(申请人本人):查看详情 / 编辑 / 删除
 *       审核通过:所有角色:查看详情
 *       退回修改:管理员:查看详情;科室(申请人本人):查看详情 / 编辑(可重新提交)
 *       全部申请:固定操作列 2 按钮(查看详情 + 更多 Dropdown),按角色 + 状态分发
 *   - 已归档(archived)状态仅在「全部申请」Tab 展示,带「已归档」标识(§2.1.7 自动归档语义)
 *   - V1.2 §1.4 角色:信息科管理员 / 科室管理员
 *   - Tab key + 筛选条件 sessionStorage 持久化
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card,
  Tabs,
  Table,
  Tag,
  Button,
  Space,
  Input,
  Tooltip,
  Modal,
  message,
  Empty,
  Select,
  Typography,
  Dropdown,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  CheckOutlined,
  UndoOutlined,
  ReloadOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import PageHeader from '../../components/PageHeader';
import { useSmartDraft } from '../agent-center/smart/store';
import {
  useApplies,
  useDemoRole,
  useCurrentUser,
  updateApply,
  removeApply,
  nowAt,
  APPLY_STATUS_LABEL,
  APPLY_STATUS_COLOR,
  truncate,
  statusTime,
  type ApplyItem,
  type ApplyStatus,
} from '../../mock/resource-center';

const { Text } = Typography;

type TabKey = 'all' | ApplyStatus;

/** V1.2 §2.1 规定的 7 个 Tab(顺序与文档一致) */
const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部申请' },
  { key: 'draft', label: '草稿' },
  { key: 'pending', label: '待审核' },
  { key: 'reviewing', label: '审核中' },
  { key: 'revoked', label: '撤销修改' },
  { key: 'approved', label: '审核通过' },
  { key: 'rejected', label: '退回修改' },
];

const TAB_STORAGE_KEY = 'resource-center:applies:tab:v1';
const FILTER_STORAGE_KEY = 'resource-center:applies:filters:v1';

const loadTab = (): TabKey => {
  try {
    const v = sessionStorage.getItem(TAB_STORAGE_KEY) as TabKey | null;
    if (v && TABS.some((t) => t.key === v)) return v;
  } catch {}
  return 'all';
};

const loadFilters = (): { keyword: string; dept?: string } => {
  try {
    const raw = sessionStorage.getItem(FILTER_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { keyword: '' };
};

/** V1.2 §2.1.2 草稿 / §2.1.5 撤销修改 用户隔离判断:仅本人可编辑/删除 */
const isOwner = (it: ApplyItem, currentAccount: string) => it.applicantAccount === currentAccount;

const ApplyList = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const data = useApplies();
  // V1.2: useDemoRole / useCurrentUser 转发自 useDemoSettings + useAuth 真相源,
  //   角色切换走 DemoFloatButton → setDemoRole + switchRole 统一链路, 4 个 resource-center 页面自动响应。
  const isAdmin = useDemoRole() === 'admin';
  const current = useCurrentUser();
  const { pushWelcomeGreeting, consumeWelcome } = useSmartDraft();

  // 台账列表「查看资源申请」联动：?tab=all&agentName=XXX → 自动切到「全部申请」并按名称预筛
  const presetAgentName = searchParams.get('agentName') || '';
  const presetTab = (searchParams.get('tab') as TabKey) || 'all';

  const [tab, setTab] = useState<TabKey>(() => presetTab || loadTab());
  const [keyword, setKeyword] = useState<string>(() => presetAgentName || loadFilters().keyword);
  const [dept, setDept] = useState<string | undefined>(() => loadFilters().dept);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 持久化 tab / 筛选
  useEffect(() => { sessionStorage.setItem(TAB_STORAGE_KEY, tab); }, [tab]);
  useEffect(() => { sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({ keyword, dept })); }, [keyword, dept]);

  // 台账联动：URL 带 agentName 时,首次消费后清掉参数,避免刷新重复触发
  useEffect(() => {
    if (!presetAgentName) return;
    const next = new URLSearchParams(searchParams);
    next.delete('agentName');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * V1.2 §2.1 数据范围:
   *   - 信息科管理员:看全部(全部申请 + 6 个状态 Tab)
   *   - 科室管理员:仅看自己的申请(用户隔离)
   *   - 草稿 / 撤销修改 Tab 均为「仅自己创建」语义
   */
  const scoped = useMemo(() => {
    if (isAdmin) return data;
    return data.filter((it) => it.applicantAccount === current.account);
  }, [data, isAdmin, current.account]);

  useEffect(() => {
    if (tab === 'draft') return undefined;
    if (tab !== 'all') {
      consumeWelcome();
      return undefined;
    }
    pushWelcomeGreeting('resource-apply-all', isAdmin ? 'admin' : 'dept', () => [scoped.length], {
      windowReplacements: [],
      actions: [{ key: 'resource-permission-apply', label: '权限申请', path: '/app/resource-center/apply-form', enabled: true }],
    });
    return () => consumeWelcome();
  }, [consumeWelcome, isAdmin, pushWelcomeGreeting, scoped.length, tab]);

  /** 当前 Tab 下的数据 */
  const tabData = useMemo(() => {
    return scoped.filter((it) => {
      if (tab === 'all') {
        // 全部申请:展示所有状态(含 archived,带「已归档」标识)
      } else if (it.status === 'archived') {
        // V1.2 §2.1.7:已归档不在「退回修改」Tab 展示,仅可在「全部申请」查询
        return false;
      } else if (it.status !== tab) {
        return false;
      }
      if (dept && !it.department.startsWith(dept)) return false;
      if (!keyword) return true;
      const k = keyword.toLowerCase();
      return (
        it.id.toLowerCase().includes(k) ||
        it.agentId.toLowerCase().includes(k) ||
        it.agentName.toLowerCase().includes(k) ||
        it.resourceName.toLowerCase().includes(k)
      );
    });
  }, [tab, dept, keyword, scoped]);

  useEffect(() => {
    if (tab !== 'draft') return undefined;
    const rows = tabData.map((item) => ({
      recordId: item.id,
      title: item.agentName,
      subTitle: item.resourceName,
      meta: item.reason || '未填写申请理由',
      actions: [{
        key: `edit-${item.id}`,
        label: '编辑',
        kind: 'navigate-edit' as const,
        path: `/app/resource-center/apply-form?from=${item.id}`,
      }],
    }));
    pushWelcomeGreeting('resource-apply-draft', isAdmin ? 'admin' : 'dept', () => [tabData.length], {
      miniList: {
        toggleLabel: '查看未完成的资源申请草稿',
        targetTab: 'draft',
        rows,
        totalCount: tabData.length,
      },
    });
    return () => consumeWelcome();
  }, [consumeWelcome, isAdmin, pushWelcomeGreeting, tab, tabData]);

  useEffect(() => {
    if (tab !== 'reviewing') return undefined;
    const rows = tabData.map((item) => ({
      recordId: item.id,
      title: item.agentName,
      subTitle: item.resourceName,
      meta: item.applicant,
      actions: isAdmin
        ? [
            { key: `detail-${item.id}`, label: '查看详情', kind: 'navigate-detail' as const, path: `/app/resource-center/applies/${item.id}` },
            { key: `audit-${item.id}`, label: '审核', kind: 'navigate-audit' as const, path: `/app/resource-center/approval/${item.id}` },
          ]
        : [
            { key: `detail-${item.id}`, label: '查看详情', kind: 'navigate-detail' as const, path: `/app/resource-center/applies/${item.id}` },
            { key: `revoke-${item.id}`, label: '撤销', kind: 'confirm-revoke' as const },
          ],
    }));
    pushWelcomeGreeting('resource-apply-reviewing', isAdmin ? 'admin' : 'dept', () => [tabData.length], {
      windowReplacements: [tabData.length],
      miniList: {
        toggleLabel: `查看这 ${tabData.length} 条`,
        targetTab: 'reviewing',
        rows,
        totalCount: tabData.length,
      },
    });
    return () => consumeWelcome();
  }, [consumeWelcome, isAdmin, pushWelcomeGreeting, tab, tabData]);

  useEffect(() => {
    if (tab !== 'pending') return undefined;
    const rows = tabData.map((item) => ({
      recordId: item.id,
      title: item.agentName,
      subTitle: item.resourceName,
      meta: item.reason || '未填写申请理由',
      actions: isAdmin
        ? [
            { key: `detail-${item.id}`, label: '查看详情', kind: 'navigate-detail' as const, path: `/app/resource-center/applies/${item.id}` },
            { key: `audit-${item.id}`, label: '审核', kind: 'navigate-audit' as const, path: `/app/resource-center/approval/${item.id}` },
          ]
        : [
            { key: `detail-${item.id}`, label: '查看详情', kind: 'navigate-detail' as const, path: `/app/resource-center/applies/${item.id}` },
            { key: `revoke-${item.id}`, label: '撤销', kind: 'confirm-revoke' as const },
          ],
    }));
    pushWelcomeGreeting('resource-apply-pending', isAdmin ? 'admin' : 'dept', () => [tabData.length], {
      windowReplacements: [tabData.length],
      miniList: {
        toggleLabel: `查看这 ${tabData.length} 条`,
        targetTab: 'pending',
        rows,
        totalCount: tabData.length,
      },
    });
    return () => consumeWelcome();
  }, [consumeWelcome, isAdmin, pushWelcomeGreeting, tab, tabData]);

  useEffect(() => {
    if (tab !== 'revoked') return undefined;
    const rows = tabData.map((item) => ({
      recordId: item.id,
      title: item.agentName,
      subTitle: item.resourceName,
      meta: item.reason || '未填写申请理由',
      actions: isAdmin
        ? [{
            key: `detail-${item.id}`,
            label: '查看详情',
            kind: 'navigate-detail' as const,
            path: `/app/resource-center/applies/${item.id}`,
          }]
        : [{
            key: `edit-${item.id}`,
            label: '编辑',
            kind: 'navigate-edit' as const,
            path: `/app/resource-center/apply-form?from=${item.id}`,
          }],
    }));
    pushWelcomeGreeting('resource-apply-revoked', isAdmin ? 'admin' : 'dept', () => [tabData.length], {
      windowReplacements: [tabData.length],
      miniList: {
        toggleLabel: `查看撤销修改清单（${tabData.length}）`,
        targetTab: 'revoked',
        rows,
        totalCount: tabData.length,
      },
    });
    return () => consumeWelcome();
  }, [consumeWelcome, isAdmin, pushWelcomeGreeting, tab, tabData]);

  useEffect(() => {
    if (tab !== 'approved') return undefined;
    const rows = tabData.map((item) => ({
      recordId: item.id,
      title: item.agentName,
      subTitle: item.resourceName,
      meta: item.approvedAt || '已审核通过',
      actions: [{
        key: `detail-${item.id}`,
        label: '查看详情',
        kind: 'navigate-detail' as const,
        path: `/app/resource-center/applies/${item.id}`,
      }],
    }));
    pushWelcomeGreeting('resource-apply-approved', isAdmin ? 'admin' : 'dept', () => [tabData.length], {
      windowReplacements: [tabData.length],
      miniList: {
        toggleLabel: '查看详情',
        targetTab: 'approved',
        rows,
        totalCount: tabData.length,
      },
    });
    return () => consumeWelcome();
  }, [consumeWelcome, isAdmin, pushWelcomeGreeting, tab, tabData]);

  useEffect(() => {
    if (tab !== 'rejected') return undefined;
    const rows = tabData.map((item) => ({
      recordId: item.id,
      title: item.agentName,
      subTitle: item.resourceName,
      meta: item.rejectReason || '请查看退回原因',
      actions: [{
        key: `detail-${item.id}`,
        label: '查看详情',
        kind: 'navigate-detail' as const,
        path: `/app/resource-center/applies/${item.id}`,
      }],
    }));
    pushWelcomeGreeting('resource-apply-rejected', isAdmin ? 'admin' : 'dept', () => [tabData.length], {
      windowReplacements: [tabData.length],
      miniList: {
        toggleLabel: '查看详情',
        targetTab: 'rejected',
        rows,
        totalCount: tabData.length,
      },
    });
    return () => consumeWelcome();
  }, [consumeWelcome, isAdmin, pushWelcomeGreeting, tab, tabData]);

  useEffect(() => {
    const onRowAction = (event: Event) => {
      const detail = (event as CustomEvent<{ kind?: string; recordId?: string; path?: string }>).detail;
      if (detail?.path && ['navigate-edit', 'navigate-detail', 'navigate-audit'].includes(detail.kind || '')) {
        navigate(detail.path);
        return;
      }
      if (detail?.kind === 'confirm-revoke' && detail.recordId) {
        const item = data.find((record) => record.id === detail.recordId);
        if (item) handleRevoke(item);
      }
    };
    window.addEventListener('agent-bubble-row-action', onRowAction);
    return () => window.removeEventListener('agent-bubble-row-action', onRowAction);
  }, [data, navigate]);

  /** 各 Tab 计数(按当前角色数据范围) */
  const tabCounts = useMemo(() => {
    const m: Record<string, number> = { all: scoped.length };
    scoped.forEach((it) => { if (it.status !== 'archived') m[it.status] = (m[it.status] || 0) + 1; });
    return m;
  }, [scoped]);

  // V1.2 §2.1.2 / §2.1.5 删除:草稿与撤销修改 Tab 的删除走同一交互(用户隔离)
  const handleDelete = (it: ApplyItem) => {
    const isDraft = it.status === 'draft';
    Modal.confirm({
      title: isDraft ? '确认删除该草稿?' : '确认永久删除该撤销记录?',
      content: isDraft
        ? `申请 ${it.id} 关联智能体 ${it.agentName},删除后无法恢复。`
        : `申请 ${it.id} 申请人 ${it.applicant} / 申请资源 ${it.resourceName};删除后该记录将从列表永久移除,无法恢复。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        removeApply(it.id);
        message.success(`已删除 ${it.id}`);
      },
    });
  };

  // V1.2 §2.1.3 / §2.1.4 撤销:仅科室管理员(申请人本人)可见
  //   流程: 弹确认 → 写 store(status=revoked + trail) → 提示 → 跳转到「撤销修改」Tab
  //   跳转走 navigate + 同步 setSearchParams 强制 tab=revoked + 写 sessionStorage 持久化,
  //   避免「useState 初始值受 presetTab 兜底后被 loadTab 覆盖」导致 Tab 不切换。
  const handleRevoke = (it: ApplyItem) => {
    Modal.confirm({
      title: '确认撤销该申请?',
      content: '撤销后审核员正在审核的流程将中止,该申请将进入「撤销修改」Tab,可编辑后重新提交。',
      okText: '确认撤销',
      cancelText: '取消',
      onOk: () => {
        updateApply(it.id, {
          status: 'revoked',
          revokedAt: nowAt(),
          appendTrail: { action: '撤销', operator: it.applicant, at: nowAt(), comment: '申请人主动撤销', status: 'error', targetStatus: 'revoked' },
        });
        message.success(`已撤销 ${it.id},记录进入「撤销修改」Tab`);
        setTab('revoked');
        sessionStorage.setItem(TAB_STORAGE_KEY, 'revoked');
        setSearchParams({ tab: 'revoked' }, { replace: true });
        setPage(1);
      },
    });
  };

  /**
   * V1.2 §2.1 操作按钮矩阵(精确按 Tab × 角色 × 状态分发):
   *   - §2.1.2 草稿:本用户:查看详情 / 编辑 / 删除
   *   - §2.1.3 待审核:管理员:查看详情 / 审核;科室(本人):撤销 / 查看详情
   *   - §2.1.4 审核中:管理员:查看详情 / 审核;科室(本人):撤销 / 查看详情
   *   - §2.1.5 撤销修改:管理员:查看详情;科室(本人):查看详情 / 编辑 / 删除
   *   - §2.1.6 审核通过:所有角色:查看详情(仅此一项,无其他操作)
   *   - §2.1.7 退回修改:管理员:查看详情;科室(本人):查看详情 / 编辑(可重新提交)
   *   - §2.1.1 全部申请:固定操作列 2 按钮(查看详情 + 更多 Dropdown),按角色 + 状态分发
   */
  const renderActions = (it: ApplyItem) => {
    const s = it.status;
    const owner = isOwner(it, current.account);

    const detail = (
      <Button key="view" type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/app/resource-center/applies/${it.id}`)}>
        查看详情
      </Button>
    );
    const edit = (
      <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/app/resource-center/apply-form?from=${it.id}`)}>
        编辑
      </Button>
    );
    const audit = (
      <Button key="audit" type="link" size="small" icon={<CheckOutlined />} onClick={() => navigate(`/app/resource-center/approval/${it.id}`)}>
        审核
      </Button>
    );
    const revoke = (
      <Button key="revoke" type="link" size="small" icon={<UndoOutlined />} onClick={() => handleRevoke(it)}>撤销</Button>
    );
    const del = (
      <Button key="del" type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(it)}>删除</Button>
    );

    // §2.1.1 全部申请 Tab:固定 2 按钮(查看详情 + 更多 Dropdown),按状态 × 角色分发
    if (tab === 'all') {
      const moreItems: NonNullable<MenuProps['items']> = [];
      // 编辑(草稿本人 / 撤销本人 / 退回本人)
      if (
        (s === 'draft' && owner) ||
        (s === 'revoked' && (!isAdmin || owner)) ||
        (s === 'rejected' && !isAdmin && owner)
      ) {
        moreItems.push({ key: 'edit', label: '编辑', icon: <EditOutlined />, onClick: () => navigate(`/app/resource-center/apply-form?from=${it.id}`) });
      }
      // 撤销(申请人视角,且在审核员尚未完成审核前)
      if (!isAdmin && owner && (s === 'pending' || s === 'reviewing')) {
        moreItems.push({ key: 'revoke', label: '撤销', icon: <UndoOutlined />, onClick: () => handleRevoke(it) });
      }
      // 审核(管理员 / 待审核 / 审核中):统一入口
      if (isAdmin && (s === 'pending' || s === 'reviewing')) {
        moreItems.push({
          key: 'audit',
          label: '审核',
          icon: <CheckOutlined />,
          onClick: () => navigate(`/app/resource-center/approval/${it.id}`),
        });
      }
      // 删除(草稿本人 / 撤销本人)
      if ((s === 'draft' && owner) || (s === 'revoked' && (!isAdmin || owner))) {
        moreItems.push({ key: 'del', label: '删除', icon: <DeleteOutlined />, danger: true, onClick: () => handleDelete(it) });
      }
      return (
        <Space size={4}>
          {detail}
          {moreItems.length > 0 && (
            <Dropdown menu={{ items: moreItems }} trigger={['click']}>
              <Button type="link" size="small" icon={<MoreOutlined />}>更多</Button>
            </Dropdown>
          )}
        </Space>
      );
    }

    // 草稿 Tab:所有角色统一展示 编辑 + 删除(草稿 Tab 数据已按用户隔离,所有可见草稿均可编辑/删除)
    if (s === 'draft') {
      return <Space size={0}>{edit}{del}</Space>;
    }

    // §2.1.3 待审核 Tab:管理员:查看详情 + 审核;科室本人:查看详情 + 撤销;非本人科室:仅查看详情
    if (s === 'pending') {
      if (isAdmin) {
        return <Space size={0}>{detail}{audit}</Space>;
      }
      if (!owner) return <Space size={0}>{detail}</Space>;
      return <Space size={0}>{detail}{revoke}</Space>;
    }

    // §2.1.4 审核中 Tab:管理员:查看详情 + 审核;科室本人:查看详情 + 撤销;非本人科室:仅查看详情
    if (s === 'reviewing') {
      if (isAdmin) {
        return <Space size={0}>{detail}{audit}</Space>;
      }
      if (!owner) return <Space size={0}>{detail}</Space>;
      return <Space size={0}>{detail}{revoke}</Space>;
    }

    // §2.1.5 撤销修改 Tab:管理员仅查看详情;科室本人:查看详情 / 编辑 / 删除
    if (s === 'revoked') {
      if (isAdmin) return <Space size={0}>{detail}</Space>;
      if (!owner) return <Text type="secondary">仅本人可见</Text>;
      return <Space size={0}>{detail}{edit}{del}</Space>;
    }

    // §2.1.6 审核通过 Tab:所有角色仅查看详情
    if (s === 'approved') {
      return <Space size={0}>{detail}</Space>;
    }

    // §2.1.7 退回修改 Tab:管理员查看详情;科室本人查看详情 + 编辑(可重新提交)
    if (s === 'rejected') {
      if (isAdmin) return <Space size={0}>{detail}</Space>;
      if (!owner) return <Space size={0}>{detail}</Space>;
      return <Space size={0}>{detail}{edit}</Space>;
    }

    // archived 仅出现在「全部申请」Tab,此处兜底
    return <Space size={0}>{detail}</Space>;
  };

  // V1.2 §2.1 公共字段(无「申请人」列;申请人信息保留在详情页)
  const baseColumns: ColumnsType<ApplyItem> = [
    {
      title: '序号',
      width: 60,
      render: (_, __, i) => (page - 1) * pageSize + i + 1,
    },
    { title: '智能体编号', dataIndex: 'agentId', width: 110 },
    {
      title: '智能体名称',
      dataIndex: 'agentName',
      width: 160,
      render: (s: string) => (
        <Tooltip title={s}>
          <span
            style={{
              display: 'block',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {s}
          </span>
        </Tooltip>
      ),
    },
    { title: '所属科室', dataIndex: 'department', width: 130 },
    { title: '诊疗环节', dataIndex: 'stage', width: 160 },
    {
      title: '功能描述',
      dataIndex: 'description',
      width: 220,
      render: (s: string) => {
        if (!s) return <Text type="secondary">--</Text>;
        return (
          <Tooltip title={s}>
            <span
              style={{
                display: 'block',
                color: 'rgba(0,0,0,0.45)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {s}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: '申请资源名称',
      dataIndex: 'resourceName',
      width: 200,
      render: (s: string) => (
        <Tooltip title={s}>
          <span
            style={{
              display: 'block',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {s}
          </span>
        </Tooltip>
      ),
    },
  ];

  // §2.1.1 全部申请 Tab 特有字段:申请状态(含已归档标识)
  const statusColumn: ColumnsType<ApplyItem> = [
    {
      title: '申请状态',
      dataIndex: 'status',
      width: 110,
      render: (s: ApplyStatus) => {
        if (s === 'archived') {
          return (
            <Tooltip title="退回修改超过 30 天未重新提交,系统已自动归档(仅可在「全部申请」查询)">
              <Tag color="default" style={{ opacity: 0.7 }}>已归档</Tag>
            </Tooltip>
          );
        }
        return <Tag color={APPLY_STATUS_COLOR[s]}>{APPLY_STATUS_LABEL[s]}</Tag>;
      },
    },
  ];

  // 各 Tab 特有字段(按 V1.2 §2.1.2-2.1.7)
  const tabColumnMap: Record<TabKey, ColumnsType<ApplyItem>> = {
    all: [...statusColumn],
    draft: [{ title: '最后编辑时间', width: 180, render: (_, it) => statusTime(it) }],
    pending: [{ title: '提交审核时间', width: 180, render: (_, it) => it.submittedAt || '-' }],
    reviewing: [{ title: '提交审核时间', width: 180, render: (_, it) => it.submittedAt || '-' }],
    revoked: [{ title: '撤销时间', width: 180, render: (_, it) => it.revokedAt || '-' }],
    approved: [
      {
        title: '具体说明',
        dataIndex: 'approveComment',
        width: 220,
        render: (s?: string) => s ? <Tooltip title={s}><Text type="secondary">{truncate(s, 20)}</Text></Tooltip> : <Text type="secondary">-</Text>,
      },
      { title: '审核通过时间', width: 180, render: (_, it) => it.approvedAt || '-' },
    ],
    rejected: [
      {
        title: '退回原因说明',
        dataIndex: 'rejectReason',
        width: 220,
        render: (s?: string) => s ? <Tooltip title={s}><Text type="secondary">{truncate(s, 20)}</Text></Tooltip> : <Text type="secondary">-</Text>,
      },
      { title: '退回时间', width: 180, render: (_, it) => it.rejectedAt || '-' },
    ],
    archived: [], // archived 不出现在独立 Tab,仅在「全部申请」展示
  };

  /** 操作列宽度按 Tab 最大按钮组合配置(避免按钮截切 + 右侧留白) */
  const ACTION_WIDTH: Record<TabKey, number> = {
    all: 160,         // 查看详情 + 更多 Dropdown
    draft: 160,       // 编辑 + 删除(所有角色统一展示)
    pending: 180,     // 管理员:查看详情 + 审核;科室本人:查看详情 + 撤销
    reviewing: 180,   // 管理员:查看详情 + 审核;科室本人:查看详情 + 撤销
    revoked: 240,     // 管理员:仅查看详情;科室本人:查看详情 + 编辑 + 删除
    approved: 110,    // 所有角色:仅查看详情
    rejected: 180,    // 管理员:仅查看详情;科室本人:查看详情 + 编辑
    archived: 110,
  };

  const columns: ColumnsType<ApplyItem> = [
    ...baseColumns,
    ...tabColumnMap[tab],
    { title: '操作', width: ACTION_WIDTH[tab], fixed: 'right', render: (_, it) => renderActions(it) },
  ];

  // 列总宽(scroll.x 留余量,确保操作列 fixed:right 不被截切)
  const scrollX = useMemo(() => {
    const base = baseColumns.reduce((s, c) => s + (typeof c.width === 'number' ? c.width : 100), 0);
    const tabCol = tabColumnMap[tab].reduce((s, c) => s + (typeof c.width === 'number' ? c.width : 100), 0);
    return base + tabCol + ACTION_WIDTH[tab] + 40;
  }, [tab]);

  const handleTabChange = (k: string) => {
    setTab(k as TabKey);
    setPage(1);
    setSearchParams({ tab: k });
  };

  return (
    <>
      <PageHeader
        title="申请管理"
        subTitle="管理智能体对院内资源的权限申请,覆盖申请 / 审批 / 撤销 / 退回 / 归档全流程"
        breadcrumb={[
          { path: '/app/resource-center', breadcrumbName: '医院资源管理中心' },
          { path: '/app/resource-center/applies', breadcrumbName: '申请管理' },
        ]}
        extra={
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/resource-center/apply-form')}>
              权限申请
            </Button>
          </Space>
        }
      />

      <Card bordered={false}>
        {/* 台账列表「查看资源申请」联动提示:展示预筛来源 + 提供清除按钮 */}
        {presetAgentName && (
          <div
            style={{
              marginBottom: 12,
              padding: '8px 12px',
              background: '#E6F4FF',
              border: '1px solid #91CAFF',
              borderRadius: 4,
              fontSize: 13,
            }}
          >
            已按智能体「<Text strong>{presetAgentName}</Text>」预筛「全部申请」Tab,共
            <Text strong style={{ margin: '0 4px' }}>{tabData.length}</Text>条结果;
            <Button type="link" size="small" style={{ padding: 0, marginLeft: 8 }} onClick={() => setKeyword('')}>清除筛选</Button>
          </div>
        )}
        <Space wrap style={{ marginBottom: 12 }}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="申请 ID / 智能体编号 / 名称 / 资源名称"
            style={{ width: 280 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Select
            allowClear
            placeholder="所属科室"
            style={{ width: 160 }}
            value={dept}
            onChange={setDept}
            options={[
              { value: 'XNK', label: 'XNK-心内科' },
              { value: 'FNK', label: 'FNK-呼吸科' },
              { value: 'PFK', label: 'PFK-药剂科' },
              { value: 'JZK', label: 'JZK-急诊科' },
              { value: 'SJK', label: 'SJK-麻醉科' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); setDept(undefined); }}>重置</Button>
        </Space>

        <Tabs
          activeKey={tab}
          onChange={handleTabChange}
          items={TABS.map((t) => {
            const count = tabCounts[t.key] || 0;
            return {
              key: t.key,
              label: (
                <Space size={6}>
                  <span style={{ fontWeight: t.key === tab ? 600 : 400 }}>{t.label}</span>
                  {count > 0 && <Text type="secondary" style={{ fontSize: 12 }}>({count})</Text>}
                </Space>
              ),
              children: (
                <Table<ApplyItem>
                  rowKey="id"
                  columns={columns}
                  dataSource={tabData}
                  scroll={{ x: scrollX }}
                  pagination={{
                    current: page,
                    pageSize,
                    showTotal: (t) => `共 ${t} 条`,
                    onChange: (p, ps) => { setPage(p); setPageSize(ps); },
                  }}
                  locale={{ emptyText: <Empty description={`「${t.label}」暂无数据`} /> }}
                />
              ),
            };
          })}
        />
      </Card>
    </>
  );
};

export default ApplyList;
