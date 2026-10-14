import { useMemo, useState } from 'react';
import { Button, Card, Empty, Input, Modal, Space, Tag, Typography, message } from 'antd';
import { EnvironmentOutlined, MinusCircleOutlined, SearchOutlined, EditOutlined, SaveOutlined, RobotOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { mockAgents } from '../../mock/agents';
import type { Agent } from '../../types/agent';
import './DashboardMapConfig.css';
import AgentMapCanvas from '../home/AgentMapCanvas';
import { DEPLOYMENT_POINTS_STORAGE_KEY, deploymentPointForAgent, readDeploymentPoints, type DeploymentPoint } from '../home/deploymentPoints';

type Position = DeploymentPoint;
const readPositions = (): Position[] => readDeploymentPoints();
const agentName = (agent: Agent) => (agent as any).name || (agent as any).agentName || agent.id;

export default function DashboardMapConfig() {
  const agents = mockAgents;
  const [committed, setCommitted] = useState<Position[]>(readPositions);
  const [draft, setDraft] = useState<Position[]>(readPositions);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [dragId, setDragId] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const visibleAgents = useMemo(() => agents.filter(a => `${agentName(a)} ${(a as any).department || ''}`.toLowerCase().includes(query.toLowerCase())), [agents, query]);
  const placedIds = new Set(draft.map(p => p.id));
  const byId = new Map(agents.map(a => [a.id, a]));
  const place = (id: string, x: number, y: number) => setDraft(current => {
    if (current.some(p => p.id === id)) return current.map(p => p.id === id ? { ...p, x, y } : p);
    const agent = byId.get(id);
    if (!agent) return current;
    const point = deploymentPointForAgent({ id, name: agentName(agent), department: (agent as any).department, type: (agent as any).type, runStatus: (agent as any).runStatus }, x, y);
    point.version = (agent as any).version || point.version;
    return [...current, point];
  });
  const onDrop = (event: React.DragEvent<HTMLDivElement>) => { event.preventDefault(); const id = event.dataTransfer.getData('text/agent-id') || dragId; if (!id) return; const rect = event.currentTarget.getBoundingClientRect(); place(id, Math.min(91, Math.max(8, (event.clientX - rect.left) / rect.width * 100)), Math.min(90, Math.max(10, (event.clientY - rect.top) / rect.height * 100))); setSelected(id); setDragId(undefined); };
  const addOrSelectAgent = (agent: Agent) => {
    const id = agent.id;
    if (placedIds.has(id)) { setSelected(id); return; }
    const canvas = document.querySelector('.dashboard-map-config-canvas')?.getBoundingClientRect();
    const x = canvas ? 50 + (draft.length % 3 - 1) * 8 : 50;
    const y = canvas ? 45 + (draft.length % 4 - 1.5) * 8 : 50;
    place(id, x, y);
    setSelected(id);
  };
  const save = () => { localStorage.setItem(DEPLOYMENT_POINTS_STORAGE_KEY, JSON.stringify(draft)); window.dispatchEvent(new Event('dashboard-map-points-updated')); setCommitted(draft); setEditing(false); message.success('地图点位配置已保存'); };
  const cancel = () => Modal.confirm({ title: '放弃本次编辑？', content: '尚未保存的点位调整将丢失。', okText: '放弃修改', cancelText: '继续编辑', onOk: () => { setDraft(committed); setEditing(false); } });
  const remove = (id: string) => setDraft(rows => rows.filter(p => p.id !== id));
  const adjust = (id: string, dx: number, dy: number) => setDraft(rows => rows.map(p => p.id === id ? { ...p, x: Math.min(91, Math.max(8, p.x + dx)), y: Math.min(90, Math.max(10, p.y + dy)) } : p));
  return <div style={{ padding: 24, minHeight: '100%', background: '#f5f7fa' }}>
    <PageHeader title="数据大屏地图配置" breadcrumb={[{ path: '', breadcrumbName: '系统配置' }, { path: '', breadcrumbName: '数据大屏地图配置' }]} extra={editing ? <Space><Button onClick={cancel}>取消</Button><Button type="primary" icon={<SaveOutlined />} onClick={save}>保存配置</Button></Space> : <Button type="primary" icon={<EditOutlined />} onClick={() => setEditing(true)}>编辑</Button>} />
    <div className="dashboard-map-config-layout">
      <Card className="dashboard-map-config-agent-card" title={<Space>智能体列表<Tag>{visibleAgents.length}</Tag></Space>} bodyStyle={{ padding: 12 }}>
        <Input allowClear prefix={<SearchOutlined />} placeholder="搜索智能体名称 / 科室" value={query} onChange={e => setQuery(e.target.value)} style={{ marginBottom: 10 }} />
        <div className="dashboard-map-config-agent-list">{visibleAgents.map(agent => { const placed = placedIds.has(agent.id); return <div key={agent.id} draggable={editing} onDragStart={e => { setDragId(agent.id); e.dataTransfer.setData('text/agent-id', agent.id); e.dataTransfer.effectAllowed = 'copyMove'; }} onClick={() => editing && addOrSelectAgent(agent)} className={`dashboard-map-config-agent-row${selected === agent.id ? ' is-selected' : ''}${editing && placed ? ' is-placed' : ''}`}>
          <span className="dashboard-map-config-agent-info"><Typography.Text strong ellipsis style={{ display: 'block' }}>{agentName(agent)}</Typography.Text><Typography.Text type="secondary" style={{ fontSize: 12 }}>{(agent as any).department || (agent as any).type || '已纳管智能体'}</Typography.Text></span>{placed ? <Tag color="blue">已展示在地图</Tag> : editing ? <Tag>拖拽添加</Tag> : <Tag>未展示</Tag>}</div>; })}{visibleAgents.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无匹配智能体" />}</div>
      </Card>
      <Card className="dashboard-map-config-map-card" title={<Space><EnvironmentOutlined />首页数据大屏地图</Space>} bodyStyle={{ padding: 12 }}>
        <div className={`dashboard-map-config-canvas${editing ? ' is-editing' : ''}`}>
          <AgentMapCanvas points={draft} editable={editing} selectedId={selected} onSelect={setSelected} onDragStart={(e, point) => { e.dataTransfer.setData('text/agent-id', point.id); e.dataTransfer.effectAllowed = 'move'; setDragId(point.id); }} onDragOver={e => { if (editing) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }} onDrop={editing ? onDrop : undefined} />
          {draft.length === 0 && <div className="dashboard-map-config-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="地图暂无部署点位" /></div>}
        </div>
        {editing && selected && draft.some(p=>p.id===selected) && <div style={{marginTop:12,padding:'10px 12px',background:'#f5faff',border:'1px solid #d6eaff',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><Space><RobotOutlined style={{color:'#1677ff'}}/><Typography.Text strong>{agentName(byId.get(selected)!)}</Typography.Text></Space><Space wrap><Button size="small" onClick={()=>adjust(selected,-2,0)}>←</Button><Button size="small" onClick={()=>adjust(selected,0,-2)}>↑</Button><Button size="small" onClick={()=>adjust(selected,0,2)}>↓</Button><Button size="small" onClick={()=>adjust(selected,2,0)}>→</Button><Button danger size="small" icon={<MinusCircleOutlined/>} onClick={()=>{remove(selected);setSelected(undefined)}}>移除展示</Button></Space></div>}
      </Card>
    </div>
  </div>;
}
