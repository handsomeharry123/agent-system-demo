/**
 * 首页 V1.x · 自动化任务列表子页(/app/home/auto-tasks)
 *
 * PRD §3.1《自动化列表页面》落地版 —— 「定时任务 / 运行记录」两个 Tab,
 * 顶部操作栏:搜索 / 批量管理 / 添加自动化;列表区分「目前 / 暂停」分组。
 *
 * 数据源:沿用 HomeSidebarV2 暴露的 initialAutoTasks mock + 当前用户(Sidebar 之外不新建 store,本子页持本地 state 即可)。
 *
 * 关键交互:
 *   - 「添加自动化」→ 打开首页 HomeSidebarV2 内的 Drawer(通过 sessionStorage 事件 flag 触发;
 *     此子页只作为承载层,Drawer 仍在 SidebarV2 维护,避免双源)
 *   - 「编辑」/「删除」/「启用/禁用」→ 直接更新本子页 state
 *   - 返回 → navigate(-1) 保留上下文
 */
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftOutlined,
  CaretRightOutlined,
  CheckOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FilterOutlined,
  FileAddOutlined,
  InboxOutlined,
  MoreOutlined,
  PauseCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  App,
  Badge,
  Button,
  Checkbox,
  Drawer,
  Dropdown,
  Empty,
  Input,
  Segmented,
  Space,
  Tooltip,
  Typography,
  type MenuProps,
} from 'antd';
import {
  initialAutoTasks,
  runHistoryMocks,
  type AutoTask,
  type AutoTaskSubRun,
} from './HomeSidebarV2';

const { Text, Title } = Typography;

type TabKey = 'scheduled' | 'runs';
type StatusKey = 'connected' | 'disconnected' | 'exception';
type RunFilterKey = 'all' | 'success' | 'failed' | 'running' | 'archived';

const runFilterLabels: Record<RunFilterKey, string> = {
  all: '全部',
  success: '成功',
  failed: '失败',
  running: '运行中',
  archived: '已归档',
};

const isArchivedRun = (run: AutoTaskSubRun) =>
  run.archived === true || !/刚刚|分钟|小时|昨日|1 天前/.test(run.updatedAt);

const formatRunName = (name: string, ts: Date) => {
  // 1.5 命名规则:任务名-yyyy-MM-dd-HH-mm-ss;若已带时间戳则原样返回
  if (/-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/.test(name)) return name;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${name}-${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}-${pad(ts.getHours())}-${pad(ts.getMinutes())}-${pad(ts.getSeconds())}`;
};

interface AutoTaskListProps {
  embedded?: boolean;
  tasks?: AutoTask[];
  onTasksChange?: Dispatch<SetStateAction<AutoTask[]>>;
}

const AutoTaskList = ({
  embedded = false,
  tasks: controlledTasks,
  onTasksChange,
}: AutoTaskListProps = {}) => {
  const navigate = useNavigate();
  const { message } = App.useApp();

  /* 数据 state:复制 initialAutoTasks 一份,避免污染 mock */
  const [localTasks, setLocalTasks] = useState<AutoTask[]>(() =>
    initialAutoTasks.map((t) => ({ ...t, runs: t.runs.map((r) => ({ ...r })) })),
  );
  const tasks = controlledTasks ?? localTasks;
  const setTasks = onTasksChange ?? setLocalTasks;

  const [tab, setTab] = useState<TabKey>('scheduled');
  const [search, setSearch] = useState('');
  const [runFilter, setRunFilter] = useState<RunFilterKey>('all');
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /* 行内悬停:查看模板/编辑/复制/立即执行一次/删除 → 用 Popover 简单呈现 */
  const [editing, setEditing] = useState<AutoTask | null>(null);
  /* 数据视图:按 enabled 分组 */
  const activeTasks = useMemo(() => tasks.filter((t) => t.enabled), [tasks]);
  const pausedTasks = useMemo(() => tasks.filter((t) => !t.enabled), [tasks]);

  const allRuns = useMemo<{ run: AutoTaskSubRun; task: AutoTask }[]>(
    () =>
      tasks.flatMap((t) => t.runs.map((r) => ({ run: r, task: t }))).sort((a, b) => {
        // 按 status '当前' 排前,再按时间倒序
        if (a.run.enabled !== b.run.enabled) return a.run.enabled ? -1 : 1;
        return 0;
      }),
    [tasks],
  );

  const filteredTasks = (group: AutoTask[]) => {
    if (!search.trim()) return group;
    return group.filter((t) => t.name.includes(search.trim()));
  };

  const filteredRuns = useMemo(() => {
    const keyword = search.trim();
    const searched = keyword
      ? allRuns.filter(({ task, run }) =>
          `${task.name}${run.summary ?? ''}${run.status}`.includes(keyword),
        )
      : allRuns;

    return searched.filter(({ run }) => {
      if (runFilter === 'success') return run.status === '成功' && !isArchivedRun(run);
      if (runFilter === 'failed') {
        return !isArchivedRun(run) && (run.status === '失败' || run.status === '部分失败');
      }
      if (runFilter === 'running') return false;
      if (runFilter === 'archived') return isArchivedRun(run);
      return true;
    });
  }, [allRuns, runFilter, search]);

  const runFilterItems: MenuProps['items'] = (
    Object.entries(runFilterLabels) as [RunFilterKey, string][]
  ).map(([key, label]) => ({
    key,
    label,
    style: {
      minWidth: 180,
      padding: '10px 14px',
      borderRadius: 8,
      fontSize: 15,
      background: runFilter === key ? '#F5F5F5' : undefined,
    },
  }));

  /* 操作:启用/禁用切换 */
  const toggleEnabled = (id: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              enabled: !t.enabled,
              runs: t.runs.map((r) => ({
                ...r,
                enabled: !t.enabled,
                nextRunIn: !t.enabled ? '约 24 小时后执行' : '已暂停',
              })),
            }
          : t,
      ),
    );
    message.success('已切换状态');
  };

  /* 操作:删除 */
  const removeTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    message.success('已删除任务');
  };

  /* 操作:批量删除 */
  const batchRemove = () => {
    if (selected.size === 0) {
      message.info('请先勾选任务');
      return;
    }
    setTasks((prev) => prev.filter((t) => !selected.has(t.id)));
    setSelected(new Set());
    setBatchMode(false);
    message.success(`已批量删除 ${selected.size} 个任务`);
  };

  /* 操作:立即执行一次(为当前任务生成一条新 run) */
  const runOnce = (id: string) => {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;

    const now = new Date();
    const runId = `${task.id}-r${Date.now()}`;
    const runName = formatRunName(task.name, now);
    const newRun: AutoTaskSubRun = {
      id: runId,
      name: runName,
      updatedAt: '刚刚',
      status: '成功',
      summary: '测试运行已触发，任务正在按当前配置执行',
      enabled: true,
      nextRunIn: task.runs[0]?.nextRunIn ?? '—',
      archived: false,
    };

    runHistoryMocks[runId] = [
      {
        id: `${runId}-u1`,
        role: 'user',
        content: `测试运行自动化任务「${task.name}」`,
        time: '刚刚',
      },
      {
        id: `${runId}-a1`,
        role: 'assistant',
        content:
          `**测试运行已触发**\n\n本次测试运行不会影响正式调度时间。\n\n` +
          `- 执行记录：${runName}\n- 触发规则：${task.frequencyDesc}\n- 下次执行：${newRun.nextRunIn}`,
        module: '自动化任务执行结果',
        time: '刚刚',
      },
    ];

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          runs: [newRun, ...t.runs],
        };
      }),
    );
    message.success('已触发测试运行。测试运行不会影响正式调度时间。');
  };

  const archiveRun = (runId: string) => {
    setTasks((prev) =>
      prev.map((task) => ({
        ...task,
        runs: task.runs.map((run) =>
          run.id === runId ? { ...run, archived: true } : run,
        ),
      })),
    );
    message.success('已归档记录');
  };

  const removeRun = (runId: string) => {
    setTasks((prev) =>
      prev.map((task) => ({
        ...task,
        runs: task.runs.filter((run) => run.id !== runId),
      })),
    );
    message.success('已删除记录');
  };

  return (
    <div
      style={{
        padding: embedded ? '16px 24px 24px' : '28px 36px 40px',
        background: embedded ? 'transparent' : '#F5F7FA',
        minHeight: embedded ? '100%' : 'calc(100vh - 64px)',
        height: '100%',
        overflow: 'auto',
      }}
    >
      {/* 顶部操作栏：参考桌面端自动化页面，使用舒展的控件尺寸与留白。 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'nowrap',
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: 4,
            borderRadius: 10,
            background: '#F5F5F5',
            flexShrink: 0,
          }}
          data-testid="auto-tasks-tabbar"
        >
          {(
            [
              { k: 'scheduled' as TabKey, label: '定时任务' },
              { k: 'runs' as TabKey, label: '运行记录' },
            ]
          ).map((t) => {
            const active = tab === t.k;
            return (
              <div
                key={t.k}
                onClick={() => {
                  setTab(t.k);
                  setSelected(new Set());
                }}
                data-testid={`auto-tasks-tab-${t.k}`}
                style={{
                  cursor: 'pointer',
                  padding: embedded ? '7px 14px' : '9px 18px',
                  borderRadius: 8,
                  fontSize: embedded ? 14 : 15,
                  fontWeight: active ? 600 : 400,
                  color: '#262626',
                  background: active ? '#FFFFFF' : 'transparent',
                  boxShadow: active ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  lineHeight: '22px',
                }}
              >
                {t.label}
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            marginLeft: 'auto',
            flex: 1,
            minWidth: 0,
            flexWrap: 'nowrap',
          }}
        >
          {tab === 'runs' && (
            <Dropdown
              trigger={['click']}
              placement="bottomLeft"
              menu={{
                items: runFilterItems,
                selectedKeys: [runFilter],
                onClick: ({ key }) => setRunFilter(key as RunFilterKey),
              }}
              overlayStyle={{ minWidth: 210 }}
            >
              <Button
                type="text"
                aria-label={`筛选运行记录，当前：${runFilterLabels[runFilter]}`}
                data-testid="auto-tasks-run-filter"
                icon={
                  <FilterOutlined
                    style={{
                      fontSize: 20,
                      color: runFilter === 'all' ? '#595959' : '#1677FF',
                    }}
                  />
                }
                style={{
                  width: 40,
                  height: 40,
                  background: runFilter === 'all' ? undefined : '#E6F4FF',
                }}
              />
            </Dropdown>
          )}
          <Input
            prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
            placeholder="搜索自动化/记录"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{
              width: tab === 'runs' ? 300 : 240,
              minWidth: 160,
              maxWidth: tab === 'runs' ? 300 : 240,
              flex: '1 1 160px',
              height: embedded ? 36 : 40,
              borderRadius: 8,
              background: tab === 'runs' ? '#F5F5F5' : '#FFFFFF',
              borderColor: tab === 'runs' ? 'transparent' : undefined,
            }}
            data-testid="auto-tasks-search"
          />
          {tab === 'scheduled' && (
            <>
              <Button
                style={{ height: embedded ? 36 : 40, borderRadius: 8, paddingInline: embedded ? 14 : 16, flexShrink: 0 }}
                onClick={() => {
                  setBatchMode((v) => !v);
                  setSelected(new Set());
                }}
                data-testid="auto-tasks-batch-toggle"
              >
                {batchMode ? '退出批量管理' : '批量管理'}
              </Button>
              {batchMode && (
                <Badge count={selected.size} size="small">
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={batchRemove}
                    style={{ height: embedded ? 36 : 40, borderRadius: 8, flexShrink: 0 }}
                    data-testid="auto-tasks-batch-delete"
                  >
                    批量删除
                  </Button>
                </Badge>
              )}
              <Button
                icon={<FileAddOutlined />}
                onClick={() => navigate('/app/home/auto-tasks/templates')}
                style={{ height: embedded ? 36 : 40, borderRadius: 8, paddingInline: embedded ? 14 : 16, flexShrink: 0 }}
                data-testid="auto-tasks-add-from-template"
              >
                从模板添加
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/app/home/auto-tasks/new')}
                style={{ height: embedded ? 36 : 40, borderRadius: 8, paddingInline: embedded ? 15 : 18, flexShrink: 0 }}
                data-testid="auto-tasks-add"
              >
                添加自动化
              </Button>
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: embedded ? 28 : tab === 'runs' ? 42 : 38 }}>
        {tab === 'scheduled' ? (
          <>
            {/* 「当前」分组 */}
            <TaskGroup
              title="当前"
              items={filteredTasks(activeTasks)}
              batchMode={batchMode}
              selected={selected}
              setSelected={setSelected}
              onToggle={toggleEnabled}
              onEdit={(t) => setEditing(t)}
              onRunOnce={runOnce}
              onDelete={removeTask}
              compact={embedded}
            />
            {/* 「已暂停」分组 */}
            <TaskGroup
              title="已暂停"
              items={filteredTasks(pausedTasks)}
              batchMode={batchMode}
              selected={selected}
              setSelected={setSelected}
              onToggle={toggleEnabled}
              onEdit={(t) => setEditing(t)}
              onRunOnce={runOnce}
              onDelete={removeTask}
              compact={embedded}
            />
          </>
        ) : (
          <RunRecordList items={filteredRuns} onArchive={archiveRun} onDelete={removeRun} compact={embedded} />
        )}
      </div>

      {/* 编辑 Drawer(轻量,只展示元信息) */}
      <Drawer
        title="编辑自动化任务"
        placement="right"
        width={420}
        open={!!editing}
        onClose={() => setEditing(null)}
        destroyOnHidden
      >
        {editing && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div>
              <Text type="secondary">任务名称</Text>
              <Input value={editing.name} disabled />
            </div>
            <div>
              <Text type="secondary">触发频率</Text>
              <Input value={editing.frequencyDesc} disabled />
            </div>
            <div>
              <Text type="secondary">下次执行</Text>
              <Input value={editing.runs[0]?.nextRunIn ?? '—'} disabled />
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              完整编辑表单请在首页工作台「自动化任务」入口(支持 PRD §3.2 全字段)。
            </Text>
            <Space>
              <Button onClick={() => setEditing(null)}>关闭</Button>
              <Button
                type="primary"
                onClick={() => {
                  toggleEnabled(editing.id);
                  setEditing(null);
                }}
              >
                {editing.enabled ? '暂停此任务' : '启用此任务'}
              </Button>
            </Space>
          </Space>
        )}
      </Drawer>

    </div>
  );
};

interface TaskGroupProps {
  title: string;
  items: AutoTask[];
  batchMode: boolean;
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  onToggle: (id: string) => void;
  onEdit: (t: AutoTask) => void;
  onRunOnce: (id: string) => void;
  onDelete: (id: string) => void;
  compact: boolean;
}

const RunRecordList = ({
  items,
  onArchive,
  onDelete,
  compact,
}: {
  items: { run: AutoTaskSubRun; task: AutoTask }[];
  onArchive: (runId: string) => void;
  onDelete: (runId: string) => void;
  compact: boolean;
}) => {
  const navigate = useNavigate();
  const [hoveredRunId, setHoveredRunId] = useState<string | null>(null);
  const groups = [
    {
      title: '今天',
      items: items.filter(({ run }) => !isArchivedRun(run) && /刚刚|分钟|小时/.test(run.updatedAt)),
    },
    {
      title: '昨天',
      items: items.filter(({ run }) => !isArchivedRun(run) && /昨日|1 天前/.test(run.updatedAt)),
    },
    {
      title: '已归档',
      items: items.filter(({ run }) => isArchivedRun(run)),
    },
  ].filter((group) => group.items.length > 0);

  if (items.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无匹配的运行记录" />;
  }

  return (
    <div data-testid="auto-task-run-records">
      {groups.map((group, groupIndex) => (
        <section
          key={group.title}
          style={{ marginTop: groupIndex === 0 ? 0 : compact ? 22 : 30 }}
          data-testid={`run-record-group-${group.title}`}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#BFBFBF',
              fontSize: compact ? 14 : 15,
              lineHeight: '24px',
              marginBottom: compact ? 8 : 14,
            }}
          >
            <span>{group.title}</span>
            <DownOutlined style={{ fontSize: 11 }} />
          </div>
          {group.items.map(({ run, task }) => {
            const archived = group.title === '已归档';
            const showActions = hoveredRunId === run.id;
            const success = run.status === '成功';
            const statusText =
              run.status === '成功'
                ? '测试运行完成'
                : run.status === '部分失败'
                  ? '补跑失败'
                  : '运行失败';
            return (
              <div
                key={run.id}
                onMouseEnter={() => setHoveredRunId(run.id)}
                onMouseLeave={() => setHoveredRunId(null)}
                style={{
                  minHeight: compact ? 48 : 58,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '0 12px',
                  borderRadius: 8,
                  background: showActions ? '#F5F5F5' : 'transparent',
                  transition: 'background-color 160ms ease',
                }}
                data-testid={`run-record-${run.id}`}
              >
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 14,
                  }}
                >
                  {archived ? (
                    <Text
                      ellipsis
                      style={{
                        color: '#262626',
                        fontSize: compact ? 14 : 16,
                        fontWeight: 500,
                        flexShrink: 0,
                      }}
                      data-testid={`run-record-title-${run.id}`}
                    >
                      {task.name}
                    </Text>
                  ) : (
                    <Typography.Link
                      ellipsis
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/app/home/overview?runId=${encodeURIComponent(run.id)}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          navigate(`/app/home/overview?runId=${encodeURIComponent(run.id)}`);
                        }
                      }}
                      style={{
                        color: '#262626',
                        fontSize: compact ? 14 : 16,
                        fontWeight: 500,
                        flexShrink: 0,
                        cursor: 'pointer',
                      }}
                      data-testid={`run-record-title-${run.id}`}
                    >
                      {task.name}
                    </Typography.Link>
                  )}
                  <Text ellipsis style={{ color: '#BFBFBF', fontSize: compact ? 13 : 14 }}>
                    {statusText}
                  </Text>
                </div>
                {showActions ? (
                  <div
                    data-testid={`run-record-actions-${run.id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}
                  >
                    {!archived && (
                      <Tooltip title="归档" placement="top">
                        <Button
                          type="text"
                          aria-label={`归档 ${task.name}`}
                          data-testid={`run-record-archive-${run.id}`}
                          icon={<InboxOutlined style={{ fontSize: 18 }} />}
                          onClick={() => onArchive(run.id)}
                          style={{ width: 38, height: 36, color: '#595959' }}
                        />
                      </Tooltip>
                    )}
                    <Tooltip title="删除" placement="top">
                      <Button
                        type="text"
                        aria-label={`删除 ${task.name}`}
                        data-testid={`run-record-delete-${run.id}`}
                        icon={<DeleteOutlined style={{ fontSize: 18 }} />}
                        onClick={() => onDelete(run.id)}
                        style={{ width: 38, height: 36, color: '#595959' }}
                      />
                    </Tooltip>
                  </div>
                ) : (
                  <>
                    <Text
                      style={{
                        color: '#BFBFBF',
                        fontSize: 14,
                        flexShrink: 0,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {run.updatedAt}
                    </Text>
                    {archived ? (
                      <InboxOutlined style={{ color: '#BFBFBF', fontSize: 18 }} />
                    ) : success ? (
                      <CheckOutlined style={{ color: '#BFBFBF', fontSize: 17 }} />
                    ) : (
                      <ExclamationCircleOutlined style={{ color: '#FF4D4F', fontSize: 18 }} />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
};

const TaskGroup = ({
  title,
  items,
  batchMode,
  selected,
  setSelected,
  onToggle,
  onEdit,
  onRunOnce,
  onDelete,
  compact,
}: TaskGroupProps) => {
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [openMenuTaskId, setOpenMenuTaskId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div style={{ marginTop: 12 }}>
        <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>
          {title}（0）
        </Text>
        <div
          style={{
            background: '#FAFAFA',
            border: '1px dashed #E0E0E0',
            borderRadius: 6,
            padding: '16px',
            textAlign: 'center',
            marginTop: 6,
          }}
          data-testid={`auto-tasks-group-${title}-empty`}
        >
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={title === '当前' ? '暂无运行中的任务' : '暂无暂停的任务'}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: title === '当前' ? 0 : compact ? 26 : 36 }} data-testid={`auto-tasks-group-${title}`}>
      <Text type="secondary" style={{ fontSize: compact ? 13 : 14, fontWeight: 500 }}>
        {title}（{items.length}）
      </Text>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          marginTop: compact ? 8 : 14,
        }}
      >
        {items.map((t) => {
          const isSelected = selected.has(t.id);
          const showActions = hoveredTaskId === t.id || openMenuTaskId === t.id;
          return (
            <div
              key={t.id}
              data-testid={`auto-tasks-row-${t.id}`}
              onMouseEnter={() => setHoveredTaskId(t.id)}
              onMouseLeave={() => setHoveredTaskId(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                minHeight: compact ? 44 : 52,
                padding: compact ? '6px 10px' : '8px 12px',
                background: isSelected ? '#F0F7FF' : showActions ? '#F5F5F5' : 'transparent',
                borderRadius: 8,
                transition: 'background-color 160ms ease',
              }}
            >
              {batchMode && (
                <Checkbox
                  checked={isSelected}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(t.id);
                    else next.delete(t.id);
                    setSelected(next);
                  }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 18 }}>
                <Text
                  ellipsis
                  style={{ fontSize: compact ? 14 : 16, color: t.enabled ? '#262626' : '#595959', fontWeight: 500 }}
                >
                  {t.name}
                </Text>
                <Text ellipsis type="secondary" style={{ fontSize: compact ? 13 : 14, color: '#BFBFBF' }}>
                  {t.runs[0]?.name}
                </Text>
                <Text type="secondary" style={{ fontSize: compact ? 13 : 14, color: '#BFBFBF', flexShrink: 0 }}>
                  {t.frequencyDesc}
                </Text>
              </div>
              <span
                style={{
                  flexShrink: 0,
                  color: '#BFBFBF',
                  fontSize: compact ? 13 : 14,
                  textAlign: 'right',
                  display: showActions ? 'none' : 'inline',
                }}
              >
                {t.runs[0]?.nextRunIn ?? '—'}
              </span>
              <div
                data-testid={`auto-tasks-row-actions-${t.id}`}
                aria-hidden={!showActions}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  flexShrink: 0,
                  opacity: showActions ? 1 : 0,
                  visibility: showActions ? 'visible' : 'hidden',
                  pointerEvents: showActions ? 'auto' : 'none',
                  transition: 'opacity 160ms ease',
                }}
              >
                <Button
                  type="text"
                  aria-label={`立即执行 ${t.name}`}
                  data-testid={`auto-tasks-run-${t.id}`}
                  icon={<CaretRightOutlined style={{ fontSize: 18 }} />}
                  onClick={() => onRunOnce(t.id)}
                  style={{ width: 38, height: 36, color: '#595959' }}
                />
                <Dropdown
                  trigger={['click']}
                  placement="bottomRight"
                  open={openMenuTaskId === t.id}
                  onOpenChange={(open) => setOpenMenuTaskId(open ? t.id : null)}
                  menu={{
                    items: [
                      {
                        key: 'toggle',
                        icon: t.enabled ? <PauseCircleOutlined /> : <ReloadOutlined />,
                        label: t.enabled ? '暂停' : '恢复',
                      },
                      {
                        key: 'delete',
                        icon: <DeleteOutlined />,
                        label: '删除',
                        danger: true,
                      },
                    ],
                    onClick: ({ key }) => {
                      if (key === 'toggle') onToggle(t.id);
                      if (key === 'delete') onDelete(t.id);
                      setOpenMenuTaskId(null);
                    },
                  }}
                  overlayStyle={{ minWidth: 156 }}
                >
                  <Button
                    type="text"
                    aria-label={`更多操作 ${t.name}`}
                    data-testid={`auto-tasks-more-${t.id}`}
                    icon={<MoreOutlined style={{ fontSize: 20 }} />}
                    style={{ width: 38, height: 36, color: '#262626' }}
                  />
                </Dropdown>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AutoTaskList;
