import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Card, Dropdown, Input, Modal, Select, Space, Table, Tabs, Tag, Tooltip, Typography, message } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, MoreOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PUJIANG_PLATFORM, initialPujiangTasks, type PujiangStatus, type PujiangTask } from './data';
import { useAuth } from '../../../hooks/useAuth';
import { useSmartDraft } from '../../agent-center/smart/store';

const { Text, Link } = Typography;
type TabKey = 'all' | PujiangStatus;

const tabs: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部任务' },
  { key: '草稿', label: '草稿' },
  { key: '评测中', label: '评测中' },
  { key: '评测通过', label: '评测通过' },
  { key: '退回修改', label: '退回修改' },
];

const dimensionsText = '临床任务规划与推理 / 医疗工具调用与执行 / 医疗场景感知与交互 / 记忆与上下文保持 / 医疗多智能体协作';

interface Props { moduleSwitcher: ReactNode; }

const PujiangTaskList = ({ moduleSwitcher }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.roles.includes('信息科管理员') ?? false;
  const { pushWelcomeGreeting, consumeWelcome } = useSmartDraft();
  const [tasks, setTasks] = useState(initialPujiangTasks);
  // 浦江模块默认落在「全部任务」；全部状态 Tab 均展示同一套医小管分类引导。
  const requestedTab = searchParams.get('tab') as TabKey | null;
  const [activeTab, setActiveTab] = useState<TabKey>(tabs.some((tab) => tab.key === requestedTab) ? requestedTab! : 'all');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<PujiangStatus>();
  const createdTask = (location.state as {
    pujiangTaskCreated?: { taskId: string; agentName: string; submitTime: string };
  } | null)?.pujiangTaskCreated;

  useEffect(() => {
    if (!requestedTab || !tabs.some((tab) => tab.key === requestedTab)) return;
    setActiveTab(requestedTab);
    const next = new URLSearchParams(searchParams);
    next.delete('tab');
    setSearchParams(next, { replace: true });
    // URL 中的 tab 仅用于跨页面精准落位，消费后清理，避免刷新重复触发。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => Object.fromEntries(tabs.map((tab) => [tab.key, tab.key === 'all' ? tasks.length : tasks.filter((task) => task.status === tab.key).length])), [tasks]);
  const visibleTasks = useMemo(() => tasks.filter((task) => {
    if (activeTab !== 'all' && task.status !== activeTab) return false;
    if (status && task.status !== status) return false;
    const value = keyword.trim().toLowerCase();
    return !value || task.agentName.toLowerCase().includes(value) || task.agentCode.toLowerCase().includes(value);
  }), [activeTab, keyword, status, tasks]);

  useEffect(() => {
    if (createdTask) {
      pushWelcomeGreeting('pujiang-evaluation-created', isAdmin ? 'admin' : 'dept', () => [
        createdTask.agentName,
        createdTask.submitTime,
      ]);
      return () => consumeWelcome();
    }
    const values = [counts.评测中, counts.评测通过, counts.退回修改];
    pushWelcomeGreeting('pujiang-evaluation-tasks', isAdmin ? 'admin' : 'dept', () => values, {
      windowReplacements: values,
      chips: [
        { key: 'pujiang-evaluating', label: `评测中 ${counts.评测中}`, targetTab: '评测中', tone: 'warning' },
        { key: 'pujiang-passed', label: `评测通过 ${counts.评测通过}`, targetTab: '评测通过', tone: 'success' },
        { key: 'pujiang-returned', label: `退回修改 ${counts.退回修改}`, targetTab: '退回修改', tone: 'error' },
      ],
    });
    return () => consumeWelcome();
  }, [activeTab, consumeWelcome, counts, createdTask, isAdmin, pushWelcomeGreeting]);

  useEffect(() => {
    const onJump = (event: Event) => {
      const nextTab = (event as CustomEvent<TabKey>).detail;
      if (!tabs.some((tab) => tab.key === nextTab)) return;
      setActiveTab(nextTab);
      setStatus(undefined);
    };
    window.addEventListener('agent-jump-tab', onJump);
    return () => window.removeEventListener('agent-jump-tab', onJump);
  }, []);

  const remove = (task: PujiangTask) => Modal.confirm({
    title: '确认删除评测任务？',
    content: `删除后「${task.agentName}」的草稿无法恢复。`,
    okText: '删除', okType: 'danger', cancelText: '取消',
    onOk: () => { setTasks((previous) => previous.filter((item) => item.id !== task.id)); message.success('已删除'); },
  });

  const columns: ColumnsType<PujiangTask> = [
    { title: '序号', width: 64, render: (_, __, index) => index + 1 },
    { title: '智能体编号', dataIndex: 'agentCode', width: 120 },
    { title: '智能体名称', dataIndex: 'agentName', width: 180, render: (value, record) => <Tooltip title={value}><Link onClick={() => navigate(`/app/agent-center/detail/${record.agentId}`)}>{value.length > 10 ? `${value.slice(0, 10)}…` : value}</Link></Tooltip> },
    { title: '智能体版本', dataIndex: 'version', width: 100, render: (value) => <Tag>{value}</Tag> },
    { title: '评测平台', width: 180, render: () => PUJIANG_PLATFORM },
    { title: '评测维度', width: 240, render: () => <Tooltip title={dimensionsText}><Text ellipsis style={{ width: 220 }}>{dimensionsText}</Text></Tooltip> },
  ];
  if (activeTab === 'all') columns.push({ title: '评测状态', dataIndex: 'status', width: 110, render: (value: PujiangStatus) => <Tag color={value === '评测通过' ? 'success' : value === '退回修改' ? 'error' : value === '评测中' ? 'processing' : 'default'}>{value}</Tag> });
  if (activeTab === '草稿') columns.push({ title: '最后编辑时间', dataIndex: 'lastEditTime', width: 170 });
  if (activeTab === '评测中') columns.push({ title: '提交评测时间', dataIndex: 'submitTime', width: 170 });
  if (activeTab === '评测通过' || activeTab === '退回修改') columns.push(
    { title: '评测结果', width: 110, render: (_, record) => <Tag color={record.status === '评测通过' ? 'success' : 'error'}>{record.status}</Tag> },
    { title: '评测结果说明', dataIndex: 'resultDesc', width: 240, render: (value = '') => <Tooltip title={value}><span>{value.length > 30 ? `${value.slice(0, 30)}…` : value}</span></Tooltip> },
    { title: '评测完成时间', dataIndex: 'completeTime', width: 170 },
  );
  columns.push({ title: '操作', fixed: 'right', width: 150, render: (_, record) => <Space size={4}>
    <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/app/evaluation/tasks/pujiang/${record.id}`)}>查看详情</Button>
    {record.status === '草稿' && <Dropdown trigger={['click']} menu={{ items: [
      { key: 'edit', label: '编辑', icon: <EditOutlined />, onClick: () => navigate(`/app/evaluation/tasks/pujiang/create?taskId=${record.id}`) },
      { key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true, onClick: () => remove(record) },
    ] }}><Button type="link" size="small" icon={<MoreOutlined />} style={{ padding: 0 }}>更多</Button></Dropdown>}
  </Space> });

  return <>
    <Card style={{ marginTop: 16 }}>
      {moduleSwitcher}
      <Tabs activeKey={activeTab} onChange={(key) => { setActiveTab(key as TabKey); setStatus(undefined); }} items={tabs.map((tab) => ({ key: tab.key, label: <Space size={4}><span>{tab.label}</span><Text type="secondary">({counts[tab.key]})</Text></Space> }))} />
      <Space wrap size={8}>
        <Input allowClear prefix={<SearchOutlined />} placeholder="搜索智能体名称 / 编号" value={keyword} onChange={(event) => setKeyword(event.target.value)} style={{ width: 280 }} />
        {activeTab === 'all' && <Select allowClear placeholder="评测状态" value={status} onChange={setStatus} style={{ width: 160 }} options={tabs.slice(1).map((tab) => ({ label: tab.label, value: tab.key }))} />}
        <Button onClick={() => { setKeyword(''); setStatus(undefined); }}>重置</Button>
        <Text type="secondary">共 {visibleTasks.length} 条</Text>
      </Space>
    </Card>
    <div style={{ background: '#fff', borderRadius: 8, marginTop: 16, border: '1px solid #F0F0F0' }}>
      <Table rowKey="id" columns={columns} dataSource={visibleTasks} pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }} scroll={{ x: 1500 }} />
    </div>
  </>;
};

export default PujiangTaskList;
