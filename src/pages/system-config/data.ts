export type Dictionary = { id:string; code:string; name:string; source:'系统内置'|'自定义'; valueType:'字符串'|'整数'|'小数'|'日期'; enabled:boolean; itemCount:number; updatedBy:string; updatedAt:string; remark?:string };
export type DictionaryItem = { id:string; dictionaryCode:string; code:string; name:string; enabled:boolean; remark?:string };
export type ModelConfig = { id:string; name:string; version:string; deployment:'本地化部署'|'云端部署'|'混合部署'; apiUrl:string; apiKey:string; provider:string; phone:string; remark?:string; connected?:boolean };

export const dictionaries: Dictionary[] = [
  ['dept','科室',41],['clinical_stage','诊疗环节',9],['demand_urgency','需求紧急程度',3],['agent_source','智能体来源',3],['access_mode','接入方式',3],['resource_type','资源列表',79],['resource_connect_mode','资源对接方式',5],['hl7_protocol_type','HL7协议类型',2],['fhir_protocol_type','FHIR协议类型',4],['db_type','数据库类型',4],['mq_type','MQ类型',4],['mq_auth_type','MQ认证方式',2],['test_sample_size','测试样本量',3],['alert_rule_type','告警规则类型',4],
].map(([code,name,count],i)=>({id:String(i+1),code:String(code),name:String(name),source:'系统内置',valueType:'字符串',enabled:true,itemCount:Number(count),updatedBy:i%3===0?'王明':'admin',updatedAt:`2026-07-${String(20-i%5).padStart(2,'0')} 09:${String(12+i).padStart(2,'0')}:00`}));

const samples: Record<string,[string,string][]> = {
  dept:[['cardiology','心血管内科'],['gastroenterology','消化内科'],['pulmonology','呼吸内科'],['endocrinology','内分泌代谢科'],['neurology','神经内科']],
  clinical_stage:[['triage','导诊分诊'],['pre_inquiry','预问诊'],['appointment','预约挂号'],['aux_exam','辅助检查'],['inpatient','住院'],['surgery','手术'],['other','其他']],
  demand_urgency:[['high','高'],['medium','中'],['low','低']], agent_source:[['self_developed','自研'],['third_party','第三方'],['co_developed','合作研发']],
  access_mode:[['api','API'],['sdk','SDK'],['otel','OTel']], resource_connect_mode:[['hl7','HL7'],['fhir','FHIR'],['dicom','DICOM'],['db_direct','数据库直连'],['mq','MQ消息队列']],
  db_type:[['mysql','MySQL'],['oracle','Oracle'],['sqlserver','SQLServer'],['postgresql','PostgreSQL']], mq_type:[['kafka','Kafka'],['rabbitmq','RabbitMQ'],['rocketmq','RocketMQ'],['activemq','ActiveMQ']],
  alert_rule_type:[['business_alert','业务监控告警规则'],['status_alert','状态监控告警规则'],['cost_alert','成本监控告警规则'],['security_alert','安全监控告警规则']],
};
export const itemsFor=(code:string):DictionaryItem[] => (samples[code]||[['example_1','示例字典项一'],['example_2','示例字典项二']]).map(([c,n],i)=>({id:`${code}-${i}`,dictionaryCode:code,code:c,name:n,enabled:true,remark:i===0?'系统预置项':''}));
export const models:ModelConfig[]=[
 {id:'1',name:'DeepSeek-R1',version:'V3.1',deployment:'本地化部署',apiUrl:'https://llm.hospital.local/v1',apiKey:'sk-hospital-demo',provider:'王明',phone:'13800138000',remark:'院内临床推理模型',connected:true},
 {id:'2',name:'通义千问',version:'Qwen3-235B',deployment:'云端部署',apiUrl:'https://dashscope.aliyuncs.com/api/v1',apiKey:'sk-cloud-demo',provider:'李明',phone:'13900139000',remark:'通用文本任务',connected:true},
 {id:'3',name:'豆包',version:'Doubao-1.5-Pro',deployment:'云端部署',apiUrl:'https://ark.cn-beijing.volces.com/api/v3',apiKey:'ark-doubao-demo',provider:'火山引擎',phone:'13800138001',remark:'通用对话与内容生成',connected:true},
 {id:'4',name:'DeepSeek-V3',version:'V3.1',deployment:'云端部署',apiUrl:'https://api.deepseek.com/v1',apiKey:'sk-deepseek-demo',provider:'DeepSeek',phone:'13800138002',remark:'通用对话与代码生成',connected:true},
 {id:'5',name:'文心一言',version:'ERNIE-4.5',deployment:'云端部署',apiUrl:'https://qianfan.baidubce.com/v2',apiKey:'qianfan-ernie-demo',provider:'百度智能云',phone:'13800138003',remark:'中文理解与内容生成',connected:true},
 {id:'6',name:'Kimi',version:'Kimi-K2',deployment:'云端部署',apiUrl:'https://api.moonshot.cn/v1',apiKey:'sk-kimi-demo',provider:'月之暗面',phone:'13800138004',remark:'长文本理解与分析',connected:true},
 {id:'7',name:'智谱 GLM',version:'GLM-4.5',deployment:'云端部署',apiUrl:'https://open.bigmodel.cn/api/paas/v4',apiKey:'glm-zhipu-demo',provider:'智谱AI',phone:'13800138005',remark:'推理、工具调用与代码任务',connected:true},
 {id:'8',name:'腾讯混元',version:'混元-T1',deployment:'云端部署',apiUrl:'https://api.hunyuan.cloud.tencent.com/v1',apiKey:'hunyuan-tencent-demo',provider:'腾讯云',phone:'13800138006',remark:'中文对话与复杂推理',connected:true},
];
