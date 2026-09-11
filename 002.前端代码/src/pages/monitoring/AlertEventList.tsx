/**
 * 8-5 告警事件处置页（V1.6 全新页）
 * 需求文档：统一运行监控中心-需求说明文档 V1.6
 *
 * 页面布局（V1.6）：
 * ① 顶部 Tab 栏（全部事件 / 我的事件，默认「我的事件」）
 * ② 筛选区（关键字 + 来源维度 + 事件级别 + 处置状态 + 触发时间 + 重置/查询）
 * ③ 事件列表（10 列；前 2 列冻结、表头吸顶、20 行/页）
 * ④ 详情抽屉（800px 宽，13 字段：标题/级别/维度/状态/规则/对象/触发条件/风险描述/处置建议/关联对象/发现时间/处置记录/负责人）
 * 抽屉底部 4 按钮：开始处置 / 标记已关闭 / 忽略事件 / 转交他人
 *
 * 处置结果同步审计中心（模块 12），本页只承担告警全生命周期闭环。
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Card, Tabs, Space, Typography, Input, Select, Button, DatePicker, Row, Col,
  Tag, Avatar, Modal, Form, Radio, message, Tooltip, Empty, Timeline, Drawer,
} from 'antd';
import { ProTable, type ProColumns, type ActionType } from '@ant-design/pro-components';
import {
  ReloadOutlined, SearchOutlined, ExclamationCircleOutlined, UserOutlined,
  SwapOutlined, PlayCircleOutlined, CheckCircleOutlined, MinusCircleOutlined,
  LinkOutlined, ClockCircleOutlined, EnvironmentOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import {
  mockAlertIncidents,
  IncidentStatusLabels, IncidentStatusColors,
  AlertLevelLabels,
  type AlertIncident, type IncidentStatus, type IncidentTimelineEntry,
} from '../../mock/monitoring';
import MetricLabel from '../../components/MetricLabel';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

const levelOptions = [
  { label: '严重', value: 'severe' },
  { label: '警告', value: 'warning' },
  { label: '提示', value: 'info' },
];
const statusOptions = [
  { label: '待处理', value: 'pending' },
  { label: '处理中', value: 'processing' },
  { label: '已关闭', value: 'closed' },
  { label: '已忽略', value: 'ignored' },
];
const sourceOptions = [{ label: '应用', value: '应用' }];

const levelColor = (lv: AlertIncident['level']) =>
  lv === 'severe' ? 'error' : lv === 'warning' ? 'warning' : 'processing';

const currentUser = { userId: 'u-it-01', name: '黄帅帅', department: '信息科' };

const AlertEventList = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [incidents, setIncidents] = useState<AlertIncident[]>(mockAlertIncidents);
  // 台账列表「查看监控告警」联动：?tab=all&search=XXX → 自动切到「全部事件」并按名称预筛
  const presetSearch = searchParams.get('search') || '';
  const presetTab = searchParams.get('tab') as 'all' | 'mine' | null;
  const [tab, setTab] = useState<'all' | 'mine'>(presetTab === 'all' ? 'all' : 'mine');
  const [keyword, setKeyword] = useState(presetSearch);
  const [sourceFilter, setSourceFilter] = useState<string>('应用');
  const [levelFilter, setLevelFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [detail, setDetail] = useState<AlertIncident | null>(null);

  // 联动参数消费:首次挂载后清掉 URL 中的 search/tab,避免刷新重复触发
  useEffect(() => {
    if (!presetSearch && !presetTab) return;
    const next = new URLSearchParams(searchParams);
    if (presetSearch) next.delete('search');
    if (presetTab) next.delete('tab');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 处置弹窗
  const [processModal, setProcessModal] = useState<{ open: boolean; incident: AlertIncident | null; mode: 'start' | 'close' | 'ignore' | 'transfer' }>({
    open: false, incident: null, mode: 'start',
  });
  const [processForm] = Form.useForm();

  const filtered = useMemo(() => {
    return incidents.filter((it) => {
      if (tab === 'mine' && it.owner.userId !== currentUser.userId) return false;
      if (keyword) {
        const k = keyword.toLowerCase();
        const match = it.title.toLowerCase().includes(k) || it.ruleName.toLowerCase().includes(k) || it.target.name.toLowerCase().includes(k);
        if (!match) return false;
      }
      if (levelFilter.length > 0 && !levelFilter.includes(it.level)) return false;
      if (statusFilter.length > 0 && !statusFilter.includes(it.status)) return false;
      return true;
    });
  }, [incidents, tab, keyword, levelFilter, statusFilter]);

  // 列表列定义（10 列）
  const columns: ProColumns<AlertIncident>[] = [
    {
      title: '事件标题', dataIndex: 'title', key: 'title', width: 320, fixed: 'left',
      ellipsis: true,
      render: (_, r) => (
        <Button type="link" size="small" style={{ padding: 0, height: 'auto', textAlign: 'left' }} onClick={() => setDetail(r)}>
          {r.title}
        </Button>
      ),
    },
    {
      title: '来源维度', dataIndex: 'sourceDimension', key: 'sourceDimension', width: 90,
      render: (s: string) => <Tag>{s}</Tag>,
    },
    {
      title: <MetricLabel name="事件级别" />, dataIndex: 'level', key: 'level', width: 90,
      render: (_, r) => <Tag color={levelColor(r.level)}>{AlertLevelLabels[r.level]}</Tag>,
    },
    {
      title: <MetricLabel name="规则名称" />, dataIndex: 'ruleName', key: 'ruleName', width: 200, ellipsis: true,
      render: (_, r) => (
        <Tooltip title={r.ruleName}>
          <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={() => navigate(`/app/monitoring/alerts/${r.ruleId}/edit`)}>
            {r.ruleName}
          </Button>
        </Tooltip>
      ),
    },
    {
      title: '监测对象', key: 'target', width: 220, ellipsis: true,
      render: (_, r) => (
        <Tooltip title={`${r.target.name} · ${r.target.department}`}>
          <Text ellipsis style={{ fontSize: 13 }}>
            {r.target.name} <Text type="secondary">· {r.target.department}</Text>
          </Text>
        </Tooltip>
      ),
    },
    {
      title: <MetricLabel name="触发条件" />, key: 'trigger', width: 240, ellipsis: true,
      render: (_, r) => <Text type="secondary" style={{ fontSize: 12 }}>{r.trigger}</Text>,
    },
    {
      title: '关联对象', key: 'relatedObject', width: 180, ellipsis: true,
      render: (_, r) => r.relatedObject
        ? <Button type="link" size="small" icon={<LinkOutlined />} style={{ padding: 0 }}>{r.relatedObject.label}</Button>
        : <Text type="secondary">—</Text>,
    },
    {
      title: <MetricLabel name="发现时间" />, dataIndex: 'discoveredAt', key: 'discoveredAt', width: 170,
      sorter: (a, b) => +new Date(a.discoveredAt) - +new Date(b.discoveredAt),
      render: (t: string) => <Text type="secondary" style={{ fontSize: 12 }}>{t.split('T').join(' ').split('+')[0]}</Text>,
    },
    {
      title: <MetricLabel name="处置状态" />, dataIndex: 'status', key: 'status', width: 100,
      render: (_, r) => <Tag color={IncidentStatusColors[r.status]}>{IncidentStatusLabels[r.status]}</Tag>,
    },
    {
      title: '操作', key: 'action', width: 160, fixed: 'right', valueType: 'option',
      render: (_, r) => [
        <Button key="view" type="link" size="small" onClick={() => setDetail(r)}>查看</Button>,
        <Button key="handle" type="link" size="small" disabled={r.status === 'closed' || r.status === 'ignored'} onClick={() => openProcess(r, 'start')}>处置</Button>,
      ],
    },
  ];

  // 打开处置弹窗
  const openProcess = (incident: AlertIncident, mode: 'start' | 'close' | 'ignore' | 'transfer') => {
    processForm.resetFields();
    setProcessModal({ open: true, incident, mode });
  };

  // 提交处置
  const submitProcess = async () => {
    if (!processModal.incident) return;
    try {
      const values = await processForm.validateFields();
      const incident = processModal.incident;
      const next = [...incidents];
      const idx = next.findIndex((x) => x.id === incident.id);
      if (idx < 0) return;
      const newEntry: IncidentTimelineEntry = {
        id: `tl-${Date.now()}`,
        action: processModal.mode === 'start' ? '开始处置' : processModal.mode === 'close' ? '标记已关闭' : processModal.mode === 'ignore' ? '忽略事件' : '转交',
        operator: currentUser.name,
        operatorId: currentUser.userId,
        timestamp: new Date().toISOString(),
        remark: values.remark,
        adoption: values.adoption,
        transferredTo: values.transferredTo,
        statusFrom: incident.status,
        statusTo:
          processModal.mode === 'start' ? 'processing' :
          processModal.mode === 'close' ? 'closed' :
          processModal.mode === 'ignore' ? 'ignored' : incident.status,
      };
      next[idx] = {
        ...incident,
        status: newEntry.statusTo!,
        owner: processModal.mode === 'transfer' && values.transferredTo
          ? { userId: `u-${values.transferredTo}`, name: values.transferredTo, department: incident.owner.department }
          : incident.owner,
        timeline: [...incident.timeline, newEntry],
        audited: processModal.mode === 'close' || processModal.mode === 'ignore',
      };
      setIncidents(next);
      message.success('处置已提交，已同步审计中心');
      setProcessModal({ open: false, incident: null, mode: 'start' });
      if (detail && detail.id === incident.id) setDetail(next[idx]);
      actionRef.current?.reload();
    } catch (e) { /* 校验失败 */ }
  };

  const reset = () => {
    setKeyword('');
    setLevelFilter([]);
    setStatusFilter([]);
    setSourceFilter('应用');
  };

  return (
    <div style={{ padding: 24, background: '#F5F5F5', minHeight: '100vh' }}>
      {/* 顶部 Tab */}
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as 'all' | 'mine')}
          items={[
            { key: 'all', label: <Space>全部事件<Tag color="blue">{incidents.length}</Tag></Space> },
            { key: 'mine', label: <Space><UserOutlined />我的事件<Tag color="blue">{incidents.filter((x) => x.owner.userId === currentUser.userId).length}</Tag></Space> },
          ]}
        />

        {/* 台账列表「查看监控告警」联动提示:展示预筛来源 + 提供清除按钮 */}
        {presetSearch && (
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              background: '#E6F4FF',
              border: '1px solid #91CAFF',
              borderRadius: 4,
              fontSize: 13,
            }}
          >
            已按智能体「<Text strong>{presetSearch}</Text>」预筛「{tab === 'all' ? '全部事件' : '我的事件'}」,共
            <Text strong style={{ margin: '0 4px' }}>{filtered.length}</Text>条结果;
            <Button type="link" size="small" style={{ padding: 0, marginLeft: 8 }} onClick={() => setKeyword('')}>清除筛选</Button>
          </div>
        )}
        {/* 筛选区：V1.7 紧凑控件单行排列，重置/查询同行在最右侧 */}
        <Row gutter={[8, 8]} align="middle" wrap style={{ marginTop: 4 }}>
          <Col flex="260px" style={{ minWidth: 220 }}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="按事件标题、规则名称、监测对象模糊搜索"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              allowClear
            />
          </Col>
          <Col flex="120px" style={{ minWidth: 110 }}>
            <Select value={sourceFilter} onChange={setSourceFilter} style={{ width: '100%' }} options={sourceOptions} />
          </Col>
          <Col flex="160px" style={{ minWidth: 140 }}>
            <Select
              mode="multiple" placeholder="事件级别" style={{ width: '100%' }}
              value={levelFilter} onChange={setLevelFilter} allowClear maxTagCount="responsive"
              options={levelOptions}
            />
          </Col>
          <Col flex="180px" style={{ minWidth: 160 }}>
            <Select
              mode="multiple" placeholder="处置状态" style={{ width: '100%' }}
              value={statusFilter} onChange={setStatusFilter} allowClear maxTagCount="responsive"
              options={statusOptions}
            />
          </Col>
          <Col flex="280px" style={{ minWidth: 240 }}>
            <RangePicker style={{ width: '100%' }} placeholder={['触发开始', '触发结束']} />
          </Col>
          <Col flex="auto" />
          <Col flex="none">
            <Space size={8}>
              <Button onClick={reset}>重置</Button>
              <Button type="primary" icon={<SearchOutlined />}>查询</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 事件列表 */}
      <Card bordered={false}>
        <ProTable<AlertIncident>
          rowKey="id"
          actionRef={actionRef}
          search={false}
          columns={columns}
          dataSource={filtered}
          pagination={{
            defaultPageSize: 20, showSizeChanger: true, showQuickJumper: true,
            pageSizeOptions: ['20', '50', '100'], showTotal: (total) => `共 ${total} 条`,
          }}
          scroll={{ x: 1700 }}
          toolBarRender={() => [
            <Button key="reload" icon={<ReloadOutlined />} onClick={() => actionRef.current?.reload()}>刷新</Button>,
          ]}
        />
      </Card>

      {/* 详情抽屉（V1.6：800px 宽，从右侧展开） */}
      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        placement="right"
        width={800}
        title={null}
        closable={false}
        destroyOnClose
        bodyStyle={{ padding: 0 }}
        styles={{ body: { padding: 0 } }}
      >
        {detail && <IncidentDetail incident={detail} onOpenProcess={openProcess} onClose={() => setDetail(null)} />}
      </Drawer>

      {/* 处置弹窗（统一一个，模式区分） */}
      <Modal
        open={processModal.open}
        onCancel={() => setProcessModal({ open: false, incident: null, mode: 'start' })}
        onOk={submitProcess}
        title={
          processModal.mode === 'start' ? '开始处置' :
          processModal.mode === 'close' ? '标记已关闭' :
          processModal.mode === 'ignore' ? '忽略事件' : '转交他人'
        }
        okText="提交"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={processForm} layout="vertical">
          {processModal.mode === 'close' && (
            <Form.Item name="adoption" label="是否采纳处置建议" rules={[{ required: true, message: '请选择' }]}>
              <Radio.Group>
                <Radio value="是">是</Radio>
                <Radio value="否">否</Radio>
                <Radio value="部分">部分</Radio>
              </Radio.Group>
            </Form.Item>
          )}
          {processModal.mode === 'transfer' && (
            <Form.Item name="transferredTo" label="转交给" rules={[{ required: true, message: '请输入接收人' }]}>
              <Input placeholder="请输入 IT 管理员姓名" />
            </Form.Item>
          )}
          <Form.Item
            name="remark"
            label={
              processModal.mode === 'ignore' ? '忽略原因' :
              processModal.mode === 'transfer' ? '转交说明' :
              processModal.mode === 'close' ? '处置结果' : '处置说明'
            }
            rules={[{ required: true, message: '请填写' }]}
          >
            <TextArea
              rows={4}
              maxLength={processModal.mode === 'close' ? 500 : 200}
              showCount
              placeholder={
                processModal.mode === 'ignore' ? '请说明忽略原因，便于审计' :
                processModal.mode === 'close' ? '详细记录处置过程与结果，便于审计归档' :
                '请描述处置动作或排查思路'
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ---------- 详情抽屉（13 字段） ----------
const IncidentDetail: React.FC<{
  incident: AlertIncident;
  onOpenProcess: (i: AlertIncident, m: 'start' | 'close' | 'ignore' | 'transfer') => void;
  onClose: () => void;
}> = ({ incident, onOpenProcess, onClose }) => {
  const isClosed = incident.status === 'closed';
  const isIgnored = incident.status === 'ignored';
  const canTransfer = !isClosed && !isIgnored;
  const canHandle = incident.status === 'pending' || incident.status === 'processing';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '80vh' }}>
      {/* 抽屉头部 */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Text strong style={{ fontSize: 16 }}>{incident.title}</Text>
          <Button type="text" onClick={onClose} aria-label="关闭">✕</Button>
        </Space>
        <Space size={6} style={{ marginTop: 8 }}>
          <Tag color={levelColor(incident.level)}>{AlertLevelLabels[incident.level]}</Tag>
          <Tag>来源：{incident.sourceDimension}</Tag>
          <Tag color={IncidentStatusColors[incident.status]}>{IncidentStatusLabels[incident.status]}</Tag>
        </Space>
      </div>

      {/* 抽屉正文 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        <Field label="触发规则">
          <Link to={`/app/monitoring/alerts/${incident.ruleId}/edit`}>{incident.ruleName}</Link>
        </Field>
        <Field label="监测对象">
          <Text>{incident.target.name}</Text>
          <Text type="secondary" style={{ marginLeft: 6 }}>· {incident.target.department}</Text>
        </Field>
        <Field label={<MetricLabel name="触发条件" />}>
          <Text code>{incident.trigger}</Text>
        </Field>
        <Field label="风险描述 / 处置建议">
          <div style={{ background: '#FFFBE6', border: '1px solid #FFE58F', borderRadius: 6, padding: 12 }}>
            {incident.remediationPairs.length === 0 ? (
              <Text type="secondary">该规则未配置处置建议</Text>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {incident.remediationPairs.map((p) => (
                  <li key={p.order} style={{ marginBottom: 6 }}>
                    <Text strong style={{ color: '#FA8C16' }}>可能原因：</Text>
                    <Text>{p.cause}</Text>
                    <br />
                    <Text strong style={{ color: '#52C41A' }}>处置动作：</Text>
                    <Text>{p.action}</Text>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Field>
        <Field label="关联对象">
          {incident.relatedObject
            ? (
              <Button type="link" icon={<LinkOutlined />} style={{ padding: 0 }}>
                {incident.relatedObject.label || incident.relatedObject.id}
              </Button>
            )
            : <Text type="secondary">—</Text>}
        </Field>
        <Field label={<MetricLabel name="发现时间" />}>
          <Text>{incident.discoveredAt}</Text>
        </Field>
        <Field label="处置记录（时间线）">
          {incident.timeline.length === 0 ? (
            <Text type="secondary">暂无处置记录</Text>
          ) : (
            <Timeline
              items={incident.timeline.slice().reverse().map((e) => ({
                color:
                  e.action === '标记已关闭' ? 'green' :
                  e.action === '忽略事件' ? 'gray' :
                  e.action === '自动恢复' ? 'cyan' :
                  e.action === '开始处置' ? 'blue' : 'orange',
                children: (
                  <div>
                    <Space size={6}>
                      <Avatar size="small" icon={<UserOutlined />} />
                      <Text strong>{e.operator}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <ClockCircleOutlined /> {e.timestamp}
                      </Text>
                      <Tag color={
                        e.action === '标记已关闭' ? 'success' :
                        e.action === '忽略事件' ? 'default' :
                        e.action === '开始处置' ? 'processing' :
                        e.action === '自动恢复' ? 'cyan' : 'orange'
                      } style={{ margin: 0 }}>{e.action}</Tag>
                    </Space>
                    {e.remark && <Paragraph style={{ marginTop: 4, marginBottom: 0, fontSize: 13 }}>{e.remark}</Paragraph>}
                    {e.adoption && <Text type="secondary" style={{ fontSize: 12 }}>采纳建议：{e.adoption}</Text>}
                    {e.transferredTo && <Text type="secondary" style={{ fontSize: 12 }}> → 已转交给 <Text strong>{e.transferredTo}</Text></Text>}
                  </div>
                ),
              }))}
            />
          )}
        </Field>
        <Field label="负责人">
          <Space>
            <Avatar size="small" icon={<UserOutlined />} />
            <Text strong>{incident.owner.name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <EnvironmentOutlined /> {incident.owner.department}
            </Text>
            {incident.audited && (
              <Tag color="success" icon={<CheckCircleOutlined />} style={{ marginLeft: 4 }}>
                已同步审计中心
              </Tag>
            )}
          </Space>
        </Field>
      </div>

      {/* 抽屉底部按钮（吸底） */}
      <div style={{ borderTop: '1px solid #f0f0f0', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 8, background: '#fff' }}>
        {canHandle && (
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => onOpenProcess(incident, 'start')}>
            开始处置
          </Button>
        )}
        {canHandle && (
          <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => onOpenProcess(incident, 'close')}>
            标记已关闭
          </Button>
        )}
        {incident.status === 'pending' && (
          <Button icon={<MinusCircleOutlined />} onClick={() => onOpenProcess(incident, 'ignore')}>
            忽略事件
          </Button>
        )}
        {canTransfer && (
          <Button type="text" icon={<SwapOutlined />} onClick={() => onOpenProcess(incident, 'transfer')}>
            转交他人
          </Button>
        )}
        {(isClosed || isIgnored) && (
          <Tag color={IncidentStatusColors[incident.status]} style={{ marginLeft: 'auto' }}>
            {IncidentStatusLabels[incident.status]} · 不可再次变更
          </Tag>
        )}
        {canHandle && (
          <Tooltip title="事件级别由规则配置决定，不允许本页临时调整以避免绕过处置">
            <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 12 }}>
              <ExclamationCircleOutlined style={{ color: '#FAAD14', marginRight: 4 }} />
              事件级别不可在本页调整
            </Text>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

const Field: React.FC<{ label: React.ReactNode; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', padding: '8px 0', borderBottom: '1px dashed #f0f0f0' }}>
    <div style={{ flex: '0 0 120px', color: 'rgba(0,0,0,0.65)', fontSize: 13 }}>{label}</div>
    <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{children}</div>
  </div>
);

export default AlertEventList;
