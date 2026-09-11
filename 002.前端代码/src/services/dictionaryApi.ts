import type { Dictionary,DictionaryItem } from '../pages/system-config/data';
interface Envelope<T>{code:number;message:string;data:T}
export interface DictionaryPage{list:Dictionary[];pagination:{current:number;pageSize:number;total:number}}
export interface DictionaryPayload{code:string;name:string;valueType:Dictionary['valueType'];remark?:string}
export interface DictionaryItemPage{dictionary:Dictionary;list:(DictionaryItem&{sortNo:number})[];pagination:{current:number;pageSize:number;total:number}}
export interface DictionaryItemPayload{code:string;name:string;remark?:string;sortNo?:number}
const headers=()=>({'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('auth_token')??''}`});
const request=async<T>(path:string,init?:RequestInit):Promise<T>=>{const response=await fetch(path,{...init,headers:{...headers(),...init?.headers}});const body=await response.json() as Envelope<T>;if(!response.ok)throw new Error(body.message||'请求失败');return body.data};
const download=async(path:string)=>{const response=await fetch(path,{headers:{Authorization:headers().Authorization}});if(!response.ok){const body=await response.json().catch(()=>({message:'导出失败'}));throw new Error(body.message||'导出失败')}const url=URL.createObjectURL(await response.blob());const a=document.createElement('a');a.href=url;a.download=`数据字典_${new Date().toISOString().slice(0,10)}.xlsx`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)};
const upload=async<T>(path:string,file:File):Promise<T>=>{const form=new FormData();form.append('file',file);const response=await fetch(path,{method:'POST',headers:{Authorization:headers().Authorization},body:form});const body=await response.json() as Envelope<T>;if(!response.ok)throw new Error(body.message||'导入失败');return body.data};
export const dictionaryApi={
 list:(current:number,pageSize:number,keyword:string)=>{const q=new URLSearchParams({current:String(current),pageSize:String(pageSize)});if(keyword.trim())q.set('keyword',keyword.trim());return request<DictionaryPage>(`/api/system-config/dictionaries?${q}`)},
 detail:(code:string)=>request<Dictionary>(`/api/system-config/dictionaries/${encodeURIComponent(code)}`),
 create:(payload:DictionaryPayload)=>request<{id:string;code:string}>('/api/system-config/dictionaries',{method:'POST',body:JSON.stringify(payload)}),
 update:(code:string,payload:DictionaryPayload)=>request<null>(`/api/system-config/dictionaries/${encodeURIComponent(code)}`,{method:'PUT',body:JSON.stringify(payload)}),
 updateStatus:(code:string,enabled:boolean)=>request<null>(`/api/system-config/dictionaries/${encodeURIComponent(code)}/status`,{method:'PATCH',body:JSON.stringify({enabled})}),
 remove:(code:string)=>request<null>(`/api/system-config/dictionaries/${encodeURIComponent(code)}`,{method:'DELETE'}),
 export:(codes:string[])=>{const q=new URLSearchParams();codes.forEach(code=>q.append('codes',code));return download(`/api/system-config/dictionaries/export.xlsx?${q}`)},
 itemList:(code:string,current:number,pageSize:number,keyword:string)=>{const q=new URLSearchParams({current:String(current),pageSize:String(pageSize)});if(keyword.trim())q.set('keyword',keyword.trim());return request<DictionaryItemPage>(`/api/system-config/dictionaries/${encodeURIComponent(code)}/items?${q}`)},
 itemDetail:(code:string,id:string)=>request<DictionaryItem&{sortNo:number}>(`/api/system-config/dictionaries/${encodeURIComponent(code)}/items/${encodeURIComponent(id)}`),
 createItem:(code:string,payload:DictionaryItemPayload)=>request<{id:string}>(`/api/system-config/dictionaries/${encodeURIComponent(code)}/items`,{method:'POST',body:JSON.stringify(payload)}),
 updateItem:(code:string,id:string,payload:DictionaryItemPayload)=>request<null>(`/api/system-config/dictionaries/${encodeURIComponent(code)}/items/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(payload)}),
 updateItemStatus:(code:string,id:string,enabled:boolean)=>request<null>(`/api/system-config/dictionaries/${encodeURIComponent(code)}/items/${encodeURIComponent(id)}/status`,{method:'PATCH',body:JSON.stringify({enabled})}),
 removeItem:(code:string,id:string)=>request<null>(`/api/system-config/dictionaries/${encodeURIComponent(code)}/items/${encodeURIComponent(id)}`,{method:'DELETE'}),
 exportItems:(code:string)=>download(`/api/system-config/dictionaries/${encodeURIComponent(code)}/items/export.xlsx`),
 importItems:(code:string,file:File)=>upload<{imported:number}>(`/api/system-config/dictionaries/${encodeURIComponent(code)}/items/import`,file),
};
