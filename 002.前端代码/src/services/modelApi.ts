import type {ModelConfig} from '../pages/system-config/data';
interface Envelope<T>{code:number;message:string;data:T}
export interface ModelPage{list:ModelConfig[];pagination:{current:number;pageSize:number;total:number}}
export type ModelPayload=Omit<ModelConfig,'id'|'connected'> & {connected?:boolean};
export class ModelApiError extends Error{constructor(message:string,public status:number,public data?:unknown){super(message)}}
const request=async<T>(path:string,init?:RequestInit):Promise<T>=>{const response=await fetch(path,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('auth_token')??''}`,...init?.headers}});const body=await response.json() as Envelope<T>;if(!response.ok)throw new ModelApiError(body.message||'请求失败',response.status,body.data);return body.data};
export const modelApi={
 list:(current:number,pageSize:number)=>request<ModelPage>(`/api/system-config/models?current=${current}&pageSize=${pageSize}`),
 detail:(id:string)=>request<ModelConfig>(`/api/system-config/models/${encodeURIComponent(id)}`),
 create:(payload:ModelPayload)=>request<{id:string}>('/api/system-config/models',{method:'POST',body:JSON.stringify(payload)}),
 update:(id:string,payload:ModelPayload)=>request<null>(`/api/system-config/models/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(payload)}),
 remove:(id:string)=>request<null>(`/api/system-config/models/${encodeURIComponent(id)}`,{method:'DELETE'}),
 test:(payload:ModelPayload&{id?:string})=>request<{passed:boolean;httpStatus:number;latencyMs:number}>('/api/system-config/models/test-connection',{method:'POST',body:JSON.stringify(payload)}),
 testSaved:(id:string)=>request<{passed:boolean;httpStatus:number;latencyMs:number}>(`/api/system-config/models/${encodeURIComponent(id)}/test`,{method:'POST'}),
};
