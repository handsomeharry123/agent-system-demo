export interface LedgerOverviewData {
  isPlatformAdmin: boolean;
  totalCount: number;
  coverage: { covered: number; total: number; rate: number };
  calls: { total: number; daily: number; weekly: number; monthly: number };
  alarms: { total: number; daily: number; weekly: number; monthly: number };
  online: { online: number; total: number; rate: number; daily: number; weekly: number; monthly: number };
  trends: Record<'week' | 'month' | 'quarter', Array<{ x: string; y: number }>>;
  departmentDistribution: Array<{ name: string; value: number }>;
  phaseDistribution: Array<{ name: string; value: number }>;
  sourceDistribution: Array<{ name: string; value: number }>;
  riskDistribution: { initial: Array<{ name: string; value: number }>; review: Array<{ name: string; value: number }>; summary: Array<{ level: string; initial: number; review: number; total: number }> };
  updatedAt: string;
}

export const getLedgerOverview = async () => {
  const response = await fetch('/api/ledger/overview', { headers: { Authorization: `Bearer ${localStorage.getItem('auth_token') ?? ''}` } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || '台账总览加载失败');
  return body.data as LedgerOverviewData;
};

export interface LedgerListResponse<T> { items: T[]; total: number; page: number; pageSize: number; isPlatformAdmin: boolean; meta: { departments: Array<{label:string;value:string}>; stages:string[]; sources:string[]; riskLevels:string[]; accessModes:string[]; runtimeStatuses:string[] } }
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token') ?? ''}` });
export const getLedgerAgents = async <T>(filters: Record<string,string|undefined> = {}) => {
  const query=new URLSearchParams({page:'1',pageSize:'1000'});Object.entries(filters).forEach(([key,value])=>value&&query.set(key,value));
  const response=await fetch(`/api/ledger/agents?${query}`,{headers:authHeaders()});const body=await response.json();if(!response.ok)throw new Error(body.message||'台账列表加载失败');return body.data as LedgerListResponse<T>;
};
export const getLedgerAgent = async <T>(id: string) => {
  const data = await getLedgerAgents<T>({ ledgerId: id });
  return data.items[0];
};
export const changeLedgerAgentStatus = async (id:string,action:'disable'|'enable',reason?:string) => {const response=await fetch(`/api/ledger/agents/${id}/status`,{method:'PATCH',headers:{...authHeaders(),'Content-Type':'application/json'},body:JSON.stringify({action,reason})});const body=await response.json();if(!response.ok)throw new Error(body.message||'运行状态更新失败');return body.data;};
