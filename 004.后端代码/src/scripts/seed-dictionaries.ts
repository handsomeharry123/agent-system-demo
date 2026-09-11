import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.js';

type Item = [code: string, name: string];
type DictionarySeed = { code: string; name: string; items: Item[] };
const pairs = (codes: string[], names: string[]): Item[] => {
  if (codes.length !== names.length) throw new Error(`字典编码与名称数量不一致：${codes.length}/${names.length}`);
  return codes.map((code, index) => [code, names[index]!] as Item);
};

const departmentItems = pairs(
  ['cardiology','gastroenterology','pulmonology','endocrinology','nephrology','neurology','infectious_disease','geriatrics','general_surgery','urology','orthopedics','neurosurgery','thoracic_surgery','cardiovascular_surgery','gynecology','obstetrics','pediatrics','neonatology','pediatric_surgery','ophthalmology','ent','oncology','emergency_critical','anesthesiology','dermatology','stomatology','rehabilitation','psychology','tcm','tuina','acupuncture','reproductive_medicine','plastic_surgery','radiology','ultrasound','laboratory','pathology','nuclear_medicine','clinical_pharmacy','blood_transfusion','nutrition'],
  ['心血管内科','消化内科','呼吸内科','内分泌代谢科','肾内科','神经内科','感染病科','老年科','普外科','泌尿外科','骨科','神经外科','胸外科','心脏及大血管科','妇科','产科','儿内科','新生儿科','儿外科','眼科','耳鼻喉科','肿瘤科','急诊危重病科','麻醉科','皮肤科','口腔科','康复医学科','医学心理科','中医科','推拿科','针灸科','辅助生殖医学科','整形外科','放射科','超声医学科','检验科','病理科','核医学科','临床药学科','输血科','营养科'],
);

// 「所属组织」与「科室」是两个独立字典；这里只保留其各自的初始数据，后续互不联动。
const organizationItems = pairs(
  ['cardiology','gastroenterology','pulmonology','endocrinology','nephrology','neurology','infectious_disease','geriatrics','general_surgery','urology','orthopedics','neurosurgery','thoracic_surgery','cardiovascular_surgery','gynecology','obstetrics','pediatrics','neonatology','pediatric_surgery','ophthalmology','ent','oncology','emergency_critical','anesthesiology','dermatology','stomatology','rehabilitation','psychology','tcm','tuina','acupuncture','reproductive_medicine','plastic_surgery','radiology','ultrasound','laboratory','pathology','nuclear_medicine','clinical_pharmacy','blood_transfusion','nutrition','hospital_leadership'],
  ['心血管内科','消化内科','呼吸内科','内分泌代谢科','肾内科','神经内科','感染病科','老年科','普外科','泌尿外科','骨科','神经外科','胸外科','心脏及大血管科','妇科','产科','儿内科','新生儿科','儿外科','眼科','耳鼻喉科','肿瘤科','急诊危重病科','麻醉科','皮肤科','口腔科','康复医学科','医学心理科','中医科','推拿科','针灸科','辅助生殖医学科','整形外科','放射科','超声医学科','检验科','病理科','核医学科','临床药学科','输血科','营养科','院领导'],
);

const seeds: DictionarySeed[] = [
  { code:'dept', name:'科室', items:departmentItems },
  { code:'organization', name:'所属组织', items:organizationItems },
  { code:'clinical_stage', name:'诊疗环节', items:pairs(
    ['triage','pre_inquiry','appointment','aux_exam','aux_diagnosis','aux_treatment','inpatient','surgery','other'],
    ['导诊分诊','预问诊','预约挂号','辅助检查','辅助诊断','辅助治疗','住院','手术','其他']) },
  { code:'demand_urgency', name:'需求紧急程度', items:pairs(['high','medium','low'],['高','中','低']) },
  { code:'agent_source', name:'智能体来源', items:pairs(['self_developed','third_party','co_developed'],['自研','第三方','合作研发']) },
  { code:'access_mode', name:'接入方式', items:pairs(['api','sdk','otel'],['API','SDK','OTel']) },
  { code:'resource_type', name:'资源列表', items:[
    ['his','HIS（医院信息系统）'],['emr','EMR（电子病历系统）'],['lis','LIS（实验室信息系统）'],['pacs','PACS（医学影像存档与通信系统）'],['ris','RIS（放射信息管理系统）'],['uis','UIS（超声信息管理系统）'],['eis','EIS（内镜信息管理系统）'],['pis','PIS（病理信息管理系统）'],['btmis','BIS/BTMIS（输血管理信息系统）'],['aims','ORIS/AIMS（手术麻醉信息系统）'],['icis','CCIS/ICIS（重症监护信息系统）'],['cssd','CSSD（消毒供应中心管理系统）'],['hism','HISM（院感监测管理系统）'],['infectious_report','传染病上报管理系统'],
    ['cdr','CDR（临床数据中心）'],['odr','ODR（运营数据中心）'],['empi','EMPI（患者主索引系统）'],['edw','EDW（医院数据仓库）'],['bi','BI（医院BI决策分析系统）'],
    ['ods','ODS（门诊医生工作站）'],['outp_nurse_station','门诊护士工作站'],['outp_appointment','门诊预约挂号系统'],['qms','QMS（门诊分诊叫号系统）'],['outp_charge','门诊收费系统'],['outp_pharmacy','门诊药房管理系统'],['outp_infusion','门诊输液管理系统'],['derm_sys','皮肤性病科管理系统'],['dental_sys','口腔科管理系统'],['ophth_sys','眼科管理系统'],['ent_sys','耳鼻喉科管理系统'],
    ['edis','EIS（急诊信息系统）'],['er_triage','急诊预检分诊系统'],['er_observation','急诊留观管理系统'],['er_rescue','急诊抢救管理系统'],
    ['ids','IDS（住院医生工作站）'],['inp_nurse_station','住院护士工作站'],['inp_charge','住院收费管理系统'],['adm_discharge','入出院管理系统'],['bed_mgmt','床位管理系统'],['diet_mgmt','膳食管理系统'],
    ['nemr','NEMR（护理电子病历系统）'],['mobile_nursing','移动护理系统'],['mobile_rounds','移动查房系统'],['nursing_qc','护理质控管理系统'],['nursing_schedule','护理排班管理系统'],['pressure_ulcer','压疮管理系统'],['fall_mgmt','跌倒管理系统'],['catheter_mgmt','导管管理系统'],['pain_mgmt','疼痛管理系统'],
    ['nuclear_med_sys','核医学管理系统'],['ecg','心电信息管理系统（ECGEIS）'],['eeg','脑电信息管理系统'],['pft','肺功能管理系统'],['gi_motility','胃肠动力检查系统'],['emg','肌电图管理系统'],
    ['drug_mgmt','医院药品管理系统'],['smart_pharmacy','智能药房系统'],['smart_cabinet','智能药柜系统'],['pivas','PIVAS（静脉用药调配中心系统）'],['rx_review','处方审核系统'],['pass','PASS（合理用药监测系统）'],['antibiotic_mgmt','抗菌药物管理系统'],['narcotic_mgmt','麻精药品管理系统'],['adr','ADR（药品不良反应监测系统）'],['pharmacy_clinic','药学门诊管理系统'],
    ['research_mgmt','医院科研管理系统'],['paper_mgmt','医学论文管理系统'],['ctms','CTMS（临床试验管理系统）'],['biobank','生物样本库管理系统'],['teaching_mgmt','医学教学管理系统'],['residency_training','住院医师规范化培训系统'],['continuing_edu','继续教育管理系统'],
  ] },
  { code:'resource_connect_mode', name:'资源对接方式', items:pairs(['hl7','fhir','dicom','db_direct','mq'],['HL7','FHIR','DICOM','数据库直连','MQ消息队列']) },
  { code:'hl7_protocol_type', name:'HL7协议类型', items:pairs(['mllp','http_gateway'],['MLLP','HTTP Gateway']) },
  { code:'fhir_protocol_type', name:'FHIR协议类型', items:pairs(['http','https','grpc','webservice'],['HTTP','HTTPS','gRPC','WebService']) },
  { code:'db_type', name:'数据库类型', items:pairs(['mysql','oracle','sqlserver','postgresql'],['MySQL','Oracle','SQLServer','PostgreSQL']) },
  { code:'mq_type', name:'MQ类型', items:pairs(['kafka','rabbitmq','rocketmq','activemq'],['Kafka','RabbitMQ','RocketMQ','ActiveMQ']) },
  { code:'mq_auth_type', name:'MQ认证方式', items:pairs(['ak_sk','sasl'],['AK/SK（Access Key）','SASL认证（Kafka常见）']) },
  { code:'test_sample_size', name:'测试样本量', items:pairs(['quick_eval','standard_eval','deep_eval'],['快速评测','标准评测','深度评测']) },
  { code:'alert_rule_type', name:'告警规则类型', items:pairs(['business_alert','status_alert','cost_alert','security_alert'],['业务监控告警规则','状态监控告警规则','成本监控告警规则','安全监控告警规则']) },
];

const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  const [admins] = await connection.execute<RowDataPacket[]>(`SELECT id FROM iam_user WHERE login_name='admin' AND is_deleted=0 LIMIT 1`);
  const adminId = admins[0]?.id ?? null;
  for (const dictionary of seeds) {
    await connection.execute(
      `INSERT INTO sys_dictionary(dictionary_code,dictionary_name,source_type,value_type,status,description,created_by,updated_by,is_deleted)
       VALUES (?,?,'BUILTIN','STRING','ENABLED','系统预置字典',?,?,0)
       ON DUPLICATE KEY UPDATE dictionary_name=VALUES(dictionary_name),source_type='BUILTIN',value_type='STRING',status='ENABLED',updated_by=VALUES(updated_by),is_deleted=0`,
      [dictionary.code,dictionary.name,adminId,adminId],
    );
    const [rows] = await connection.execute<RowDataPacket[]>(`SELECT id FROM sys_dictionary WHERE dictionary_code=? LIMIT 1`,[dictionary.code]);
    const dictionaryId = rows[0]!.id;
    for (let index=0; index<dictionary.items.length; index++) {
      const [itemCode,itemName] = dictionary.items[index]!;
      await connection.execute(
        `INSERT INTO sys_dictionary_item(dictionary_id,item_code,item_name,item_value,sort_no,status,remark,is_deleted)
         VALUES (?,?,?,?,?,'ENABLED','系统预置项',0)
         ON DUPLICATE KEY UPDATE item_name=VALUES(item_name),item_value=VALUES(item_value),sort_no=VALUES(sort_no),status='ENABLED',remark='系统预置项',is_deleted=0`,
        [dictionaryId,itemCode,itemName,itemCode,(index+1)*10],
      );
    }
  }
  await connection.commit();
  console.log(`数据字典初始化完成：${seeds.length} 个字典，${seeds.reduce((sum,item)=>sum+item.items.length,0)} 个字典项`);
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
  await pool.end();
}
