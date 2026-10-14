export type DeploymentPoint = {
  id: string;
  name: string;
  version: string;
  department: string;
  status: string;
  x: number;
  y: number;
  popover: 'left' | 'right';
};

export function deploymentPointForAgent(agent: { id: string; name: string; department?: string; type?: string; runStatus?: string }, x: number, y: number): DeploymentPoint {
  const fallback = DEFAULT_DEPLOYMENT_POINTS[0];
  const saved = DEFAULT_DEPLOYMENT_POINTS.find(point => point.id === agent.id);
  return {
    ...(saved || fallback),
    id: agent.id,
    name: agent.name,
    version: saved?.version || '—',
    department: agent.department || agent.type || '未设置',
    status: agent.runStatus || '未知',
    x,
    y,
  };
}

export const DEFAULT_DEPLOYMENT_POINTS: DeploymentPoint[] = [
  { id: 'agent-001', name: '心电图智能辅助诊断系统', version: 'v2.3.1', department: '心内科', status: '在线', x: 16, y: 57, popover: 'right' },
  { id: 'agent-002', name: '胸部 CT 影像智能分析平台', version: 'v1.8.0', department: '影像科', status: '在线', x: 34, y: 20, popover: 'right' },
  { id: 'agent-003', name: '病历智能生成与质控系统', version: 'v3.1.2', department: '医务科', status: '在线', x: 70, y: 18, popover: 'right' },
  { id: 'agent-004', name: '处方智能审核与用药安全系统', version: 'v2.5.0', department: '药剂科', status: '在线', x: 44, y: 51, popover: 'left' },
  { id: 'agent-005', name: '智能导诊与分诊系统', version: 'v2.0.0', department: '急诊科', status: '在线', x: 74, y: 68, popover: 'right' },
  { id: 'agent-006', name: '冠心病早期风险预测系统', version: 'v2.1.0', department: '心内科', status: '在线', x: 63, y: 39, popover: 'right' },
  { id: 'agent-007', name: '急性卒中智能识别系统', version: 'v1.0.0', department: '神经内科', status: '在线', x: 27, y: 78, popover: 'left' },
];

export const DEPLOYMENT_POINTS_STORAGE_KEY = 'dashboard-map-agent-positions-v1';

export function readDeploymentPoints(): DeploymentPoint[] {
  try {
    const raw = localStorage.getItem(DEPLOYMENT_POINTS_STORAGE_KEY);
    if (!raw) return DEFAULT_DEPLOYMENT_POINTS;
    const saved = JSON.parse(raw) as Array<Partial<DeploymentPoint>>;
    return saved.map((point, index) => {
      const fallback = DEFAULT_DEPLOYMENT_POINTS.find(item => item.id === point.id) || DEFAULT_DEPLOYMENT_POINTS[index % DEFAULT_DEPLOYMENT_POINTS.length];
      return { ...fallback, ...point, version: point.version || fallback.version || '—', department: point.department || fallback.department || '未设置', status: point.status || fallback.status || '未知', popover: point.popover || fallback.popover } as DeploymentPoint;
    });
  } catch {
    return DEFAULT_DEPLOYMENT_POINTS;
  }
}

export function subscribeDeploymentPoints(onChange: () => void): () => void {
  const handler = (event: Event) => {
    if (event instanceof StorageEvent && event.key !== DEPLOYMENT_POINTS_STORAGE_KEY) return;
    onChange();
  };
  window.addEventListener('storage', handler);
  window.addEventListener('dashboard-map-points-updated', handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener('dashboard-map-points-updated', handler);
  };
}
