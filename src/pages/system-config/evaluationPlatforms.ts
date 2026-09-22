export type ParameterMapping={name:string;value:string;mappingName?:string};
export type EvalPlatform={id:string;name:string;description:string;dimensions:string[];provider:string;email:string;phone?:string;enabled:boolean;connected:'success'|'failed'|'untested';url?:string;timeout?:number;requestMethod?:'GET'|'POST';queryParameters?:ParameterMapping[];responseParameters?:ParameterMapping[];deployment:string;pythonVersion:string;deploymentStatus:string;image?:string;servicePort?:string;taskPort?:string;repository?:string;evaluationMethod:string;modelName?:string;baseUrl?:string;apiKey?:string;script?:string;documentName?:string;draft?:boolean;updatedAt:string;preset?:boolean};
const MEDBENCH_DESCRIPTION='上海AI实验室（浦江实验室）联合瑞金医院出品，基于OpenCompass（司南）的中文医疗大模型开放评测平台。';

export const medbenchQueryParameters:ParameterMapping[]=[
 {name:'Agent Name',value:'#agentName'},
 {name:'Developer Type',value:'#source'},
 {name:'Parameter Count (Billion)',value:'#parameterCount'},
 {name:'Open Source',value:'#openSource'},
 {name:'Context Length (tokens)',value:'#contextLength'},
 {name:'Agent API Endpoint',value:'#apiEndpoint'},
 {name:'Temperature',value:'#temperature'},
 {name:'Top P',value:'#topP'},
 {name:'Agent ID',value:'#agentCode'},
 {name:'API Key',value:'#apiKey'},
 {name:'Agent API Documentation',value:'#description'},
 {name:'Estimated AI Concurrency',value:'#concurrency'},
 {name:'GitHub / Official Website',value:'#platformUrl'},
 {name:'Agent Release Date',value:'#releaseDate'},
 {name:'Email',value:'#contactEmail'},
 {name:'Evaluation Results Public',value:'#openSource'},
];

export const medbenchResponseParameters:ParameterMapping[]=[
 {name:'agent_name',value:'#agentName'},
 {name:'scoring_rule',value:'#evaluationScoringRule'},
 {name:'overall_score',value:'#totalEvaluationScore'},
 {name:'overall_conclusion',value:'#overallConclusion'},
 {name:'eval_dimension',value:'#evaluationDimension'},
 {name:'eval_dimension_scores',value:'#dimensionScoreMap'},
 {name:'pass_status',value:'#evaluationPassStatus'},
 {name:'pass_threshold',value:'#evaluationPassThreshold'},
 {name:'Parent Dimension',value:'#parentDimension'},
];

export const presetPlatforms:EvalPlatform[]=[
 {id:'medbench',name:'medbench',description:MEDBENCH_DESCRIPTION,dimensions:['临床任务规划与推理','医疗工具调用与执行','医疗场景感知与交互','记忆与上下文保持','医疗多智能体协作'],provider:'浦江实验室',email:'medbench@pjlab.org.cn',enabled:false,connected:'untested',url:'https://api.medbench.example.com/v1/evaluation',timeout:60,requestMethod:'GET',queryParameters:medbenchQueryParameters,responseParameters:medbenchResponseParameters,deployment:'无需部署',pythonVersion:'无要求',deploymentStatus:'无需部署',evaluationMethod:'内置评估器',updatedAt:'2026-08-12 09:30:00',preset:true},
];
const KEY='evaluation-platforms-v1';
const hasConfiguredParameters=(rows?:ParameterMapping[])=>Boolean(rows?.some(row=>row.name?.trim()));
const usesLegacyResponseValues=(rows?:ParameterMapping[])=>Boolean(rows?.length&&rows.every(row=>!row.value||row.value===row.name));
const hydrateMedbench=(platform:EvalPlatform):EvalPlatform=>platform.id!=='medbench'?platform:{...platform,description:platform.description?.includes('出品；基于OpenCompass')?MEDBENCH_DESCRIPTION:platform.description,url:platform.url||'https://api.medbench.example.com/v1/evaluation',timeout:platform.timeout||60,requestMethod:platform.requestMethod||'GET',queryParameters:hasConfiguredParameters(platform.queryParameters)?platform.queryParameters:medbenchQueryParameters,responseParameters:!hasConfiguredParameters(platform.responseParameters)||usesLegacyResponseValues(platform.responseParameters)?medbenchResponseParameters:platform.responseParameters};
const removedPresetIds=new Set(['cp-env','medagentbench']);
export const loadPlatforms=():EvalPlatform[]=>{try{const x=localStorage.getItem(KEY);return (x?JSON.parse(x):presetPlatforms).filter((platform:EvalPlatform)=>!removedPresetIds.has(platform.id)).map(hydrateMedbench)}catch{return presetPlatforms.map(hydrateMedbench)}};
export const savePlatforms=(rows:EvalPlatform[])=>localStorage.setItem(KEY,JSON.stringify(rows));
export const now=()=>new Date().toLocaleString('sv-SE').replace('T',' ');
export const evaluationCreatePath=(platformId:string)=>platformId==='medbench'?'/app/evaluation/tasks/pujiang/create':`/app/evaluation/tasks/platform/${platformId}/create`;
