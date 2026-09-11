export interface OperationLog {
  key: string; user: string; role: string; org: string; module: string; type: string; desc: string;
  result: string; resultCode: 'SUCCESS' | 'FAILED'; failureReason?: string; ip: string; time: string;
  method?: string; path?: string; targetType?: string; targetId?: string;
}
export interface LogFilters { userId?: string; org?: string; module?: string; type?: string; result?: string; startTime?: string; endTime?: string; order?: 'asc' | 'desc' }
interface Envelope<T> { code: number; message: string; data: T }
const headers = () => ({ 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('auth_token')??''}` });
const request = async<T>(path:string,init?:RequestInit) => { const response=await fetch(path,{...init,headers:{...headers(),...init?.headers}});const body=await response.json() as Envelope<T>;if(!response.ok)throw new Error(body.message||'请求失败');return body.data; };
const params = (input:Record<string,unknown>) => { const p=new URLSearchParams();Object.entries(input).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')p.set(k,String(v));});return p.toString(); };
export const operationLogsApi = {
  meta:()=>request<{organizations:{label:string;value:string}[];modules:{label:string;value:string}[];types:{label:string;value:string}[]}>('/api/audit/operation-logs/meta'),
  users:(keyword:string)=>request<{label:string;value:string}[]>(`/api/audit/operation-logs/user-options?${params({keyword})}`),
  list:(filters:LogFilters,current:number,pageSize:number)=>request<{list:OperationLog[];pagination:{current:number;pageSize:number;total:number}}>(`/api/audit/operation-logs?${params({...filters,current,pageSize})}`),
  detail:(id:string)=>request<OperationLog>(`/api/audit/operation-logs/${id}`),
  refresh:()=>request<null>('/api/audit/operation-logs/events/refresh',{method:'POST',body:'{}'}),
  export:async(filters:LogFilters,ids:string[])=>{const response=await fetch('/api/audit/operation-logs/export',{method:'POST',headers:headers(),body:JSON.stringify({...filters,ids})});if(!response.ok){const body=await response.json();throw new Error(body.message||'导出失败');}const blob=await response.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`操作日志_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);},
};
