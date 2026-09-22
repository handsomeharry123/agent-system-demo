import { useMemo,useState } from 'react';
import { Button,Input,Modal,Space,Switch,Table,Tag,Typography,message } from 'antd';
import { DeleteOutlined,EditOutlined,ExportOutlined,SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import PageHeader from '../../components/PageHeader';
import { dictionaries as seed,type Dictionary } from './data';
const {Text}=Typography;
export default function DictionaryList(){
 const nav=useNavigate(); const [rows,setRows]=useState(seed); const [q,setQ]=useState('');
 const data=useMemo(()=>rows.filter(x=>`${x.name}${x.code}`.toLowerCase().includes(q.toLowerCase())),[rows,q]);
 const remove=(r:Dictionary)=>Modal.confirm({title:'确认是否删除？',content:`删除字典「${r.name}」后将无法恢复。`,okText:'确认删除',okType:'danger',cancelText:'取消',onOk:()=>{setRows(v=>v.filter(x=>x.id!==r.id));message.success('删除成功')}});
 const cols:ColumnsType<Dictionary>=[
  {title:'字典编码',dataIndex:'code',width:180,render:v=><Text code>{v}</Text>},{title:'字典名称',dataIndex:'name',width:150},{title:'字典来源',dataIndex:'source',width:110,render:v=><Tag color={v==='系统内置'?'default':'blue'}>{v}</Tag>},{title:'字典值类型',dataIndex:'valueType',width:110},{title:'状态',dataIndex:'enabled',width:90,render:(v,r)=><Switch size="small" checked={v} onChange={x=>setRows(a=>a.map(y=>y.id===r.id?{...y,enabled:x}:y))}/>},{title:'字典项数量',dataIndex:'itemCount',width:110},{title:'更新人',dataIndex:'updatedBy',width:100},{title:'更新时间',dataIndex:'updatedAt',width:180},{title:'操作',fixed:'right',width:280,render:(_,r)=><Space size={0} wrap={false}><Button type="link" style={{paddingInline:8}} onClick={()=>nav(`/app/system-config/dictionaries/${r.code}/items`)}>查看字典项</Button><Button type="link" style={{paddingInline:8}} icon={<EditOutlined/>} onClick={()=>nav(`/app/system-config/dictionaries/${r.code}/edit`)}>编辑</Button><Button danger type="link" style={{paddingInline:8}} icon={<DeleteOutlined/>} disabled={r.source==='系统内置'} onClick={()=>remove(r)}>删除</Button></Space>}
 ];
 return <div style={{padding:24,background:'#f5f7fa',minHeight:'100%'}}><PageHeader title="数据字典" subTitle="统一维护平台基础字典及字典项，配置结果全局生效" breadcrumb={[{path:'',breadcrumbName:'系统配置'},{path:'',breadcrumbName:'数据字典'}]} extra={<><Input allowClear prefix={<SearchOutlined/>} value={q} onChange={e=>setQ(e.target.value)} placeholder="搜索字典名称 / 编码" style={{width:240}}/><Button icon={<ExportOutlined/>} onClick={()=>message.success('字典 Excel 已开始导出')}>导出字典</Button></>}/><div style={{marginTop:16,padding:16,background:'#fff',borderRadius:8}}><Table rowKey="id" columns={cols} dataSource={data} scroll={{x:1320}} pagination={{pageSize:10,showTotal:n=>`共 ${n} 个字典`}}/></div></div>
}
