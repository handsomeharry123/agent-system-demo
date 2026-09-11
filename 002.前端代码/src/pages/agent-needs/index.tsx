/**
 * 智能体建设需求管理 - 需求管理页（1.1）+ 草稿页（1.3）
 *
 * 一级菜单默认进入后的页面，顶部通过 Tab 切换：
 *   - 需求管理列表 Tab（默认）：只显示已生成好的需求（status='已提交'）
 *   - 草稿列表 Tab：当前登录用户暂存的草稿（status='草稿'，仅本人可见）
 *
 * 生成需求页（1.2）与需求详情页（1.4）为页面级子路由，不出现在菜单。
 *   - 右上角【生成需求】→ /app/agent-needs/create
 *   - 行内【查看详情】→ /app/agent-needs/detail/:id
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';
import { useDemoSettings } from '../../hooks/useDemoSettings';
import { departmentOptions } from '../../mock/departments';
import PageHeader from '../../components/PageHeader';
import NewUserConsole from '../../components/NewUserConsole';
import { useSmartDraft } from '../agent-center/smart/store';
import {
  ROLE_ADMIN,
  ROLE_DEPT,
  clinicalStageOptions,
  urgencyOptions,
  urgencyColorMap,
  matchAgents,
  buildMatchResult,
  type BuildNeed,
  type UrgencyLevel,
} from './types';
import { useNeeds, patchNeed, removeNeed, nowStr } from './store';

const { Text } = Typography;

type TabKey = 'list' | 'draft';

const AgentNeedsContent = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const role = currentUser?.roles[0] || ROLE_DEPT;
  const isPlatformAdmin = role === ROLE_ADMIN;
  const loginName = currentUser?.name || '当前用户';

  const needs = useNeeds();
  const { pushWelcomeGreeting } = useSmartDraft();

  // Tab 由 URL ?tab= 决定，便于生成/编辑页带目标 Tab 跳回
  const urlTab = searchParams.get('tab');
  const activeTab: TabKey = urlTab === 'draft' ? 'draft' : 'list';
  const setActiveTab = (next: TabKey) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'list') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  // 筛选
  const [searchText, setSearchText] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');

  // 二次确认
  const [pendingDelete, setPendingDelete] = useState<BuildNeed | null>(null);
  // 智能化匹配结果弹窗
  const [matchModal, setMatchModal] = useState<BuildNeed | null>(null);

  const counts = useMemo(() => {
    let list = 0;
    let draft = 0;
    needs.forEach((n) => {
      if (n.status === '草稿') {
        if (n.applicant === loginName) draft += 1;
      } else {
        if (isPlatformAdmin || n.applicant === loginName) list += 1;
      }
    });
    return { list, draft };
  }, [needs, loginName, isPlatformAdmin]);

  const listNeeds = useMemo(
    () => needs.filter((n) => n.status === '已提交' && (isPlatformAdmin || n.applicant === loginName)),
    [needs, isPlatformAdmin, loginName],
  );

  const urgencyCounts = useMemo(() => ({
    total: listNeeds.length,
    high: listNeeds.filter((n) => n.urgency === '高').length,
    medium: listNeeds.filter((n) => n.urgency === '中').length,
    low: listNeeds.filter((n) => n.urgency === '低').length,
  }), [listNeeds]);

  const draftNeeds = useMemo(
    () => needs.filter((n) => n.status === '草稿' && n.applicant === loginName),
    [needs, loginName],
  );

  useEffect(() => {
    if (activeTab === 'draft') {
      pushWelcomeGreeting(
        'agent-needs-draft',
        isPlatformAdmin ? 'admin' : 'dept',
        () => [draftNeeds.length],
        {
          miniList: {
            toggleLabel: '查看未完成的需求登记操作',
            targetTab: 'draft',
            totalCount: draftNeeds.length,
            rows: draftNeeds.map((draft) => ({
              recordId: draft.id,
              title: draft.title || '未命名草稿',
              subTitle: `提出科室：${draft.department || '--'}`,
              meta: `需求紧急程度：${draft.urgency || '--'}`,
              actions: [{
                key: `edit-need-${draft.id}`,
                label: '编辑',
                kind: 'navigate-edit',
                path: `/app/agent-needs/edit/${draft.id}`,
              }],
            })),
          },
        },
      );
      return;
    }
    const replacements = [urgencyCounts.total, urgencyCounts.high, urgencyCounts.medium, urgencyCounts.low];
    pushWelcomeGreeting(
      'agent-needs-list',
      isPlatformAdmin ? 'admin' : 'dept',
      () => replacements,
      {
        actions: [{
          key: 'generate-need',
          label: '生成需求',
          path: '/app/agent-needs/create',
          enabled: true,
        }],
      },
    );
  }, [activeTab, draftNeeds, isPlatformAdmin, pushWelcomeGreeting, urgencyCounts]);

  const filteredData = useMemo(() => {
    return needs
      .filter((n) => {
        // Tab 范围
        if (activeTab === 'draft') {
          if (n.status !== '草稿' || n.applicant !== loginName) return false;
        } else {
          if (n.status !== '已提交') return false;
          if (!isPlatformAdmin && n.applicant !== loginName) return false;
        }
        // 筛选项
        const matchSearch = !searchText || n.title.toLowerCase().includes(searchText.toLowerCase());
        const matchDept = !deptFilter || n.department === deptFilter;
        const matchStage = !stageFilter || n.clinicalStage === stageFilter;
        const matchUrgency = !urgencyFilter || n.urgency === urgencyFilter;
        return matchSearch && matchDept && matchStage && matchUrgency;
      })
      .sort((a, b) => {
        const ta = activeTab === 'draft' ? a.lastUpdateTime : a.submitTime || a.lastUpdateTime;
        const tb = activeTab === 'draft' ? b.lastUpdateTime : b.submitTime || b.lastUpdateTime;
        return (tb || '').localeCompare(ta || '');
      });
  }, [needs, activeTab, loginName, isPlatformAdmin, searchText, deptFilter, stageFilter, urgencyFilter]);

  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useMemo(() => setPageIndex(1), [activeTab]);

  // ── 跳转 ──
  const goDetail = (n: BuildNeed) => navigate(`/app/agent-needs/detail/${n.id}`);
  const goEdit = (n: BuildNeed) => navigate(`/app/agent-needs/edit/${n.id}`);
  const goCreate = () => navigate('/app/agent-needs/create');

  useEffect(() => {
    const onBubbleRowAction = (event: Event) => {
      const detail = (event as CustomEvent<{ kind?: string; recordId?: string; path?: string }>).detail;
      if (detail?.kind !== 'navigate-edit') return;
      const draft = needs.find((n) => n.id === detail.recordId && n.status === '草稿' && n.applicant === loginName);
      if (draft) goEdit(draft);
    };
    window.addEventListener('agent-bubble-row-action', onBubbleRowAction);
    return () => window.removeEventListener('agent-bubble-row-action', onBubbleRowAction);
  }, [loginName, needs]);

  // ── 智能化匹配 ──
  const doMatch = (n: BuildNeed) => {
    const top = matchAgents(n);
    const result = top.length ? buildMatchResult(top, nowStr(0)) : undefined;
    patchNeed(n.id, { matchResult: result });
    // 弹窗展示最新结果（用刚算出来的 result）
    setMatchModal({ ...n, matchResult: result });
    if (top.length) message.success(`已完成智能化匹配，最高匹配度 ${top[0].score}%`);
    else message.info('暂无匹配智能体');
  };

  const doDelete = () => {
    if (!pendingDelete) return;
    removeNeed(pendingDelete.id);
    message.success('删除成功');
    setPendingDelete(null);
  };

  // ── 单元格省略 + Tooltip ──
  const ellipsisCell = (text: string, limit = 15) => {
    if (!text) return <Text type="secondary">--</Text>;
    return (
      <Tooltip title={text}>
        <div
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: '1.5',
            maxWidth: 200,
          }}
        >
          {text.length > limit ? `${text.slice(0, limit)}…` : text}
        </div>
      </Tooltip>
    );
  };

  const matchCell = (n: BuildNeed) => {
    if (!n.matchResult || n.matchResult.top.length === 0) return <Text type="secondary">—</Text>;
    return (
      <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setMatchModal(n)}>
        <Tag color="blue">最高 {n.matchResult.topScore}%</Tag>
      </Button>
    );
  };

  // ── 列 ──
  const columns: ColumnsType<BuildNeed> = useMemo(() => {
    const base: ColumnsType<BuildNeed> = [
      {
        title: '序号',
        key: 'idx',
        width: 64,
        render: (_v, _r, idx) => (pageIndex - 1) * pageSize + idx + 1,
      },
      {
        title: '需求标题',
        dataIndex: 'title',
        key: 'title',
        width: 180,
        render: (t: string, r) => {
          const title = t || '未命名草稿';
          const titleChars = Array.from(title);
          const displayTitle = titleChars.length > 10 ? `${titleChars.slice(0, 10).join('')}…` : title;

          return (
            <Tooltip title={titleChars.length > 10 ? title : undefined}>
              <Button
                type="link"
                style={{
                  display: 'block',
                  width: '100%',
                  maxWidth: '100%',
                  padding: 0,
                  height: 'auto',
                  overflow: 'hidden',
                  textAlign: 'left',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                onClick={() => goDetail(r)}
              >
                {displayTitle}
              </Button>
            </Tooltip>
          );
        },
      },
      { title: '提出科室', dataIndex: 'department', key: 'department', width: 110 },
      {
        title: '提出原因',
        dataIndex: 'reason',
        key: 'reason',
        width: 200,
        render: (t: string) => ellipsisCell(t),
      },
      { title: '提出人', dataIndex: 'proposer', key: 'proposer', width: 90 },
      {
        title: '联系方式',
        dataIndex: 'contactPhone',
        key: 'contactPhone',
        width: 130,
        render: (t: string) => t || <Text type="secondary">--</Text>,
      },
      {
        title: '诊疗环节',
        dataIndex: 'clinicalStage',
        key: 'clinicalStage',
        width: 110,
        render: (s: string, r) => (s === '其他' && r.clinicalStageOther ? `其他（${r.clinicalStageOther}）` : s),
      },
      {
        title: '功能描述',
        dataIndex: 'functionDesc',
        key: 'functionDesc',
        width: 220,
        render: (t: string) => ellipsisCell(t),
      },
      {
        title: '所需资源',
        dataIndex: 'resources',
        key: 'resources',
        width: 140,
        render: (rs: string[]) =>
          rs && rs.length ? (
            <Space size={4} wrap>
              {rs.map((r) => (
                <Tag key={r}>{r}</Tag>
              ))}
            </Space>
          ) : (
            <Text type="secondary">--</Text>
          ),
      },
      {
        title: '匹配情况',
        key: 'match',
        width: 120,
        render: (_v, r) => matchCell(r),
      },
      {
        title: '需求紧急程度',
        dataIndex: 'urgency',
        key: 'urgency',
        width: 120,
        render: (u: UrgencyLevel) => <Tag color={urgencyColorMap[u]}>{u}</Tag>,
      },
    ];

    const timeCol: ColumnsType<BuildNeed>[0] =
      activeTab === 'draft'
        ? {
            title: '最后更新时间',
            dataIndex: 'lastUpdateTime',
            key: 'lastUpdateTime',
            width: 160,
            render: (t: string) => <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>{t}</Text>,
          }
        : {
            title: '提出时间',
            dataIndex: 'submitTime',
            key: 'submitTime',
            width: 160,
            render: (t: string) => <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>{t || '--'}</Text>,
          };

    const actionCol: ColumnsType<BuildNeed>[0] = {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: activeTab === 'draft' ? 160 : 220,
      render: (_v, r) => {
        if (activeTab === 'draft') {
          return (
            <Space size={4} style={{ flexWrap: 'nowrap' }}>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => goEdit(r)}>
                编辑
              </Button>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => setPendingDelete(r)}>
                删除
              </Button>
            </Space>
          );
        }
        return (
          <Space size={4} style={{ flexWrap: 'nowrap' }}>
            <Button type="link" size="small" icon={<ThunderboltOutlined />} onClick={() => doMatch(r)}>
              智能化匹配
            </Button>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => goDetail(r)}>
              查看详情
            </Button>
          </Space>
        );
      },
    };

    return [...base, timeCol, actionCol];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, pageIndex, pageSize, needs]);

  // matchModal 内容始终使用 store 最新数据（若已被 patch）
  useEffect(() => {
    if (!matchModal) return;
    const latest = needs.find((n) => n.id === matchModal.id);
    if (latest && latest.matchResult !== matchModal.matchResult) {
      setMatchModal(latest);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needs]);

  const tabItems = [
    { key: 'list', label: <Space>需求管理列表<Tag>{counts.list}</Tag></Space> },
    { key: 'draft', label: <Space>草稿列表<Tag>{counts.draft}</Tag></Space> },
  ];

  return (
    <div style={{ padding: 0 }}>
      <PageHeader
        title="智能体建设需求管理"
        subTitle="录入标准化建设需求，并与平台已纳管智能体智能化匹配 TOP3，避免重复建设"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={goCreate}>
            生成需求
          </Button>
        }
      />

      <Card style={{ marginTop: 0, marginBottom: 12 }}>
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索需求标题"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 220 }}
          />
          <Select
            allowClear
            placeholder="提出科室"
            value={deptFilter || undefined}
            onChange={(v) => setDeptFilter(v || '')}
            options={departmentOptions}
            style={{ width: 160 }}
          />
          <Select
            allowClear
            placeholder="诊疗环节"
            value={stageFilter || undefined}
            onChange={(v) => setStageFilter(v || '')}
            options={clinicalStageOptions}
            style={{ width: 150 }}
          />
          <Select
            allowClear
            placeholder="需求紧急程度"
            value={urgencyFilter || undefined}
            onChange={(v) => setUrgencyFilter(v || '')}
            options={urgencyOptions}
            style={{ width: 140 }}
          />
          <Button
            size="small"
            onClick={() => {
              setSearchText('');
              setDeptFilter('');
              setStageFilter('');
              setUrgencyFilter('');
            }}
          >
            重置筛选
          </Button>
        </Space>
      </Card>

      <Card>
        <Tabs activeKey={activeTab} onChange={(k) => setActiveTab(k as TabKey)} items={tabItems} />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredData}
          scroll={{ x: 1640 }}
          pagination={{
            current: pageIndex,
            pageSize,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setPageIndex(p);
              setPageSize(ps);
            },
          }}
          locale={{
            emptyText: (
              <Empty description={activeTab === 'draft' ? '暂无草稿，点击右上角「生成需求」并暂存' : '暂无已提交的建设需求'} />
            ),
          }}
        />
      </Card>

      {/* 删除草稿 二次确认 */}
      <Modal
        open={!!pendingDelete}
        title="确认是否删除该草稿"
        onCancel={() => setPendingDelete(null)}
        onOk={doDelete}
        okText="是"
        cancelText="否"
        okButtonProps={{ danger: true }}
      >
        <Text>将删除「{pendingDelete?.title || '未命名草稿'}」草稿记录，删除后不可恢复。</Text>
      </Modal>

      {/* 智能化匹配 TOP3 结果 */}
      <Modal
        open={!!matchModal}
        title="智能化匹配结果（TOP3）"
        footer={<Button type="primary" onClick={() => setMatchModal(null)}>知道了</Button>}
        onCancel={() => setMatchModal(null)}
        width={560}
      >
        {matchModal?.matchResult && matchModal.matchResult.top.length > 0 ? (
          <Table
            rowKey="agentId"
            size="small"
            pagination={false}
            dataSource={matchModal.matchResult.top}
            columns={[
              { title: '排名', key: 'rank', width: 60, render: (_v, _r, i) => i + 1 },
              { title: '智能体编号', dataIndex: 'agentCode', key: 'agentCode', width: 120 },
              {
                title: '智能体名称',
                dataIndex: 'agentName',
                key: 'agentName',
                render: (name: string, r) => (
                  <Button
                    type="link"
                    style={{ padding: 0, height: 'auto', textAlign: 'left' }}
                    onClick={() =>
                      navigate(`/app/ledger/list?search=${encodeURIComponent(r.agentName)}&openDetail=1`)
                    }
                  >
                    {name}
                  </Button>
                ),
              },
              {
                title: '匹配度',
                dataIndex: 'score',
                key: 'score',
                width: 90,
                render: (s: number) => <Tag color="blue">{s}%</Tag>,
              },
            ]}
          />
        ) : (
          <Empty description="暂无匹配智能体" />
        )}
      </Modal>

      {/* 角色占位（保留导出） */}
      <span style={{ display: 'none' }} aria-hidden>{ROLE_DEPT}</span>
    </div>
  );
};

const AgentNeeds = () => {
  const { demoRole, newUserRoles } = useDemoSettings();
  if (newUserRoles[demoRole]) return <NewUserConsole kind="need" />;
  return <AgentNeedsContent />;
};

export default AgentNeeds;
