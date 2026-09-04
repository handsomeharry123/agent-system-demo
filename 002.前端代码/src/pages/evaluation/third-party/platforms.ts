import { loadPlatforms } from '../../system-config/evaluationPlatforms';

export type ThirdPartyPlatformKey = 'cp-env' | 'medagentbench';
export interface ThirdPartyPlatformSpec { key:ThirdPartyPlatformKey; name:string; shortName:string; dimensions:string[]; versions:string[] }
export const platformSpecs:Record<ThirdPartyPlatformKey,ThirdPartyPlatformSpec>={
 'cp-env':{key:'cp-env',name:'CP-Env 评测',shortName:'CP-Env',dimensions:['Clinical Efficacy','Process Competency','Professional Ethics'],versions:['1.0','1.1','3.0','3.1']},
 medagentbench:{key:'medagentbench',name:'MedAgentBench 评测',shortName:'MedAgentBench',dimensions:['Patient information retrieval','Lab result retrieval','Patient data aggregation','Recording patient data','Test ordering','Referral ordering','Medication ordering'],versions:['1.0','1.1','4.0','4.1']},
};
export const enabledEvaluationPlatforms=()=>loadPlatforms().filter(x=>x.enabled&&!x.draft);
export const evaluationName=(name:string)=>`${name.replace(/评测$/,'')}评测`;
export const specFor=(key?:string)=>{const k:keyof typeof platformSpecs=key==='medagentbench'?'medagentbench':'cp-env';const base=platformSpecs[k];const configured=loadPlatforms().find(x=>x.id===k);return{...base,name:evaluationName(configured?.name||base.shortName),shortName:configured?.name||base.shortName,dimensions:configured?.dimensions?.length?configured.dimensions:base.dimensions}};
