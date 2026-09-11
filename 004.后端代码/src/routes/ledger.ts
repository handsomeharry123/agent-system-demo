import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { requireAuth } from '../auth.js';
import { pool } from '../db.js';

const router = Router();
router.use(requireAuth);
const ok = (data: unknown) => ({ code: 200, message: 'success', data, timestamp: new Date().toISOString() });

const sourceLabel: Record<string, string> = { SELF: '自研', THIRD_PARTY: '第三方', CO_DEVELOPED: '合作研发' };
const riskLabel: Record<string, string> = { HIGH: '高度关注', MEDIUM: '中度关注', GENERAL: '一般关注' };
const lifecycleLabel: Record<string, string> = { TRIAL: '试运行中', ONLINE: '已上线', DISABLED: '已禁用' };
const runtimeLabel: Record<string, string> = { ONLINE: '在线', OFFLINE: '离线', UPDATING: '更新', DISABLED: '禁用', ABNORMAL: '异常' };

interface ContextRow extends RowDataPacket { department_id: number; is_admin: number }
const contextOf = async (userId: number) => {
  const [rows] = await pool.execute<ContextRow[]>(
    `SELECT u.department_id, EXISTS(
       SELECT 1 FROM iam_user_role ur JOIN iam_role r ON r.id=ur.role_id
       WHERE ur.user_id=u.id AND r.role_code='IT_ADMIN' AND r.status='ENABLED' AND r.is_deleted=0
         AND (ur.expires_at IS NULL OR ur.expires_at>CURRENT_TIMESTAMP(3))
     ) is_admin FROM iam_user u WHERE u.id=? AND u.is_deleted=0`, [userId],
  );
  if (!rows.length) throw Object.assign(new Error('当前用户不存在'), { statusCode: 401 });
  return rows[0]!;
};

const parseStages = (value: unknown): string[] => {
  try {
    const list = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(list) ? list.map((item) => typeof item === 'string' ? item : String(item?.name ?? '')).filter(Boolean) : [];
  } catch { return []; }
};
const completeDistribution = (values: string[], dictionaryNames: string[]) => {
  const counts = values.reduce<Record<string, number>>((map, value) => {
    map[value] = (map[value] ?? 0) + 1;
    return map;
  }, {});
  const orderedNames = [...new Set([...dictionaryNames, ...values])];
  const dictionaryOrder = new Map(orderedNames.map((name, index) => [name, index]));
  return orderedNames
    .map((name) => ({ name, value: counts[name] ?? 0 }))
    .sort((a, b) => b.value - a.value || (dictionaryOrder.get(a.name) ?? 0) - (dictionaryOrder.get(b.name) ?? 0));
};

router.get('/overview', async (req, res, next) => { try {
  const ctx = await contextOf(req.auth!.userId);
  const params: number[] = [];
  const scope = ctx.is_admin ? '' : 'AND g.department_id=?';
  if (!ctx.is_admin) params.push(ctx.department_id);
  const [agents] = await pool.execute<RowDataPacket[]>(
    `SELECT l.id ledger_id,l.agent_id,l.risk_level,l.lifecycle_status,l.runtime_status,l.accessed_at,
       g.agent_name,g.source_type,d.department_name,rv.clinical_stages
     FROM led_agent_ledger l JOIN agt_agent g ON g.id=l.agent_id AND g.is_deleted=0
     JOIN sys_department d ON d.id=g.department_id
     JOIN agt_registration_application a ON a.id=l.source_application_id AND a.status='APPROVED' AND a.is_deleted=0
     JOIN agt_registration_revision rv ON rv.application_id=a.id AND rv.revision_no=a.current_revision_no
     WHERE g.master_status='MANAGED' ${scope} ORDER BY l.accessed_at`, params,
  );
  const agentIds = agents.map((row) => Number(row.agent_id));
  const placeholders = agentIds.map(() => '?').join(',');
  const zeroRange = { total: 0, daily: 0, weekly: 0, monthly: 0 };
  let calls = { ...zeroRange }; let alarms = { ...zeroRange };
  if (agentIds.length) {
    const [metricRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(h.metric_value),0) total,
        COALESCE(SUM(IF(h.bucket_start>=CURRENT_DATE,h.metric_value,0)),0) daily,
        COALESCE(SUM(IF(h.bucket_start>=DATE_SUB(NOW(),INTERVAL 7 DAY),h.metric_value,0)),0) weekly,
        COALESCE(SUM(IF(h.bucket_start>=DATE_SUB(NOW(),INTERVAL 30 DAY),h.metric_value,0)),0) monthly
       FROM mon_metric_hourly h JOIN mon_metric_definition m ON m.id=h.metric_id
       WHERE m.metric_code='CALL_COUNT' AND h.agent_id IN (${placeholders})`, agentIds,
    );
    const row = metricRows[0]!; calls = { total: Number(row.total), daily: Number(row.daily), weekly: Number(row.weekly), monthly: Number(row.monthly) };
    const [alertRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) total,SUM(triggered_at>=CURRENT_DATE) daily,
        SUM(triggered_at>=DATE_SUB(NOW(),INTERVAL 7 DAY)) weekly,
        SUM(triggered_at>=DATE_SUB(NOW(),INTERVAL 30 DAY)) monthly
       FROM mon_alert_event WHERE agent_id IN (${placeholders})`, agentIds,
    );
    const alert = alertRows[0]!; alarms = { total: Number(alert.total), daily: Number(alert.daily), weekly: Number(alert.weekly), monthly: Number(alert.monthly) };
  }
  const [dictionaryRows] = await pool.execute<RowDataPacket[]>(
    `SELECT d.dictionary_code,i.item_name
     FROM sys_dictionary d JOIN sys_dictionary_item i ON i.dictionary_id=d.id
     WHERE d.dictionary_code IN ('dept','clinical_stage','agent_source')
       AND d.status='ENABLED' AND d.is_deleted=0 AND i.status='ENABLED' AND i.is_deleted=0
     ORDER BY d.dictionary_code,i.sort_no,i.id`,
  );
  const dictionaryNames = dictionaryRows.reduce<Record<string, string[]>>((map, row) => {
    (map[row.dictionary_code] ??= []).push(String(row.item_name));
    return map;
  }, {});
  const covered = new Set(agents.map((row) => row.department_name)).size;
  const departmentNames = [...new Set([...(dictionaryNames.dept ?? []), ...agents.map((row) => String(row.department_name))])];
  const departmentTotal = departmentNames.length;
  const shouldRun = agents.filter((row) => row.lifecycle_status === 'ONLINE' && row.runtime_status !== 'DISABLED');
  const online = shouldRun.filter((row) => row.runtime_status === 'ONLINE').length;
  const stageValues = agents.flatMap((row) => parseStages(row.clinical_stages));
  const sourceValues = agents.map((row) => sourceLabel[row.source_type] ?? row.source_type).filter(Boolean);
  const riskCounts = agents.reduce<Record<string, number>>((map, row) => {
    const label = riskLabel[row.risk_level]; if (label) map[label] = (map[label] ?? 0) + 1; return map;
  }, {});
  const riskOrder = ['高度关注', '中度关注', '一般关注'];
  const riskDistribution = { initial: [], review: riskOrder.map((name) => ({ name, value: riskCounts[name] ?? 0 })),
    summary: riskOrder.map((level) => ({ level, initial: 0, review: riskCounts[level] ?? 0, total: riskCounts[level] ?? 0 })) };
  const now = new Date();
  const monthKeys = Array.from({ length: 12 }, (_, index) => { const d = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const monthCounts = agents.reduce<Record<string, number>>((map, row) => { const key=String(row.accessed_at).slice(0,7); map[key]=(map[key]??0)+1; return map; },{});
  const monthTrend = monthKeys.map((x) => ({ x, y: monthCounts[x] ?? 0 }));
  const weekTrend = Array.from({ length: 12 }, (_, index) => { const d=new Date(now); d.setHours(0,0,0,0); const day=(d.getDay()+6)%7; d.setDate(d.getDate()-day-(11-index)*7); const end=new Date(d); end.setDate(end.getDate()+7); const y=agents.filter((row)=>{const t=new Date(row.accessed_at);return t>=d&&t<end;}).length; return {x:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,y}; });
  const quarterTrend = Array.from({ length: 4 }, (_, index) => { const currentQuarter=Math.floor(now.getMonth()/3); const d=new Date(now.getFullYear(),(currentQuarter-3+index)*3,1); const end=new Date(d.getFullYear(),d.getMonth()+3,1); const y=agents.filter((row)=>{const t=new Date(row.accessed_at);return t>=d&&t<end;}).length; return {x:`${d.getFullYear()}Q${Math.floor(d.getMonth()/3)+1}`,y}; });
  res.json(ok({
    isPlatformAdmin: Boolean(ctx.is_admin), totalCount: agents.length,
    coverage: { covered, total: departmentTotal, rate: departmentTotal ? covered / departmentTotal : 0 },
    calls, alarms, online: { online, total: shouldRun.length, rate: shouldRun.length ? online / shouldRun.length : 0, daily: 0, weekly: 0, monthly: 0 },
    trends: { week: weekTrend, month: monthTrend, quarter: quarterTrend },
    departmentDistribution: completeDistribution(agents.map((row) => String(row.department_name)), departmentNames),
    phaseDistribution: completeDistribution(stageValues, dictionaryNames.clinical_stage ?? []),
    sourceDistribution: completeDistribution(sourceValues, dictionaryNames.agent_source ?? []), riskDistribution,
    updatedAt: new Date().toISOString(),
  }));
} catch (error) { next(error); } });

router.get('/agents', async (req, res, next) => { try {
  const ctx = await contextOf(req.auth!.userId);
  const page = Math.max(1, Number(req.query.page) || 1); const pageSize = Math.min(1000, Math.max(1, Number(req.query.pageSize) || 10));
  const clauses = [`g.master_status='MANAGED'`, `g.is_deleted=0`, `a.status='APPROVED'`, `a.is_deleted=0`]; const params: Array<string|number> = [];
  if (!ctx.is_admin) { clauses.push('g.department_id=?'); params.push(ctx.department_id); }
  const ledgerId=String(req.query.ledgerId??'').trim();if(ledgerId){clauses.push('l.id=?');params.push(ledgerId);}
  const keyword=String(req.query.keyword??'').trim(); if(keyword){clauses.push('(g.agent_name LIKE ? OR g.agent_code LIKE ? OR g.function_description LIKE ? OR g.supplier_name LIKE ?)');const like=`%${keyword}%`;params.push(like,like,like,like);}
  const exact: Array<[string,string]> = [['department','d.department_name'],['source','g.source_type'],['risk','l.risk_level'],['accessMode','rv.access_mode'],['runtimeStatus',"COALESCE(ms.run_status,l.runtime_status,IF(l.lifecycle_status='DISABLED','DISABLED','OFFLINE'))"]];
  const sourceDb:Record<string,string>={自研:'SELF',第三方:'THIRD_PARTY',合作研发:'CO_DEVELOPED'};const riskDb:Record<string,string>={高度关注:'HIGH',中度关注:'MEDIUM',一般关注:'GENERAL'};const runtimeDb:Record<string,string>={在线:'ONLINE',离线:'OFFLINE',更新:'UPDATING',禁用:'DISABLED',异常:'ABNORMAL'};
  for(const [queryKey,column] of exact){let value=String(req.query[queryKey]??'').trim();if(!value)continue;if(queryKey==='source')value=sourceDb[value]??value;if(queryKey==='risk')value=riskDb[value]??value;if(queryKey==='accessMode')value=value.toUpperCase();if(queryKey==='runtimeStatus')value=runtimeDb[value]??value;clauses.push(`${column}=?`);params.push(value);}
  const stage=String(req.query.stage??'').trim();if(stage){clauses.push(`JSON_SEARCH(rv.clinical_stages,'one',?,NULL,'$[*].name') IS NOT NULL`);params.push(stage);}
  const accessMonth=String(req.query.accessMonth??'').trim();if(/^\d{4}-\d{2}$/.test(accessMonth)){clauses.push(`DATE_FORMAT(l.accessed_at,'%Y-%m')=?`);params.push(accessMonth);}
  const from=`FROM led_agent_ledger l JOIN agt_agent g ON g.id=l.agent_id JOIN sys_department d ON d.id=g.department_id JOIN agt_registration_application a ON a.id=l.source_application_id JOIN agt_registration_revision rv ON rv.application_id=a.id AND rv.revision_no=a.current_revision_no LEFT JOIN agt_registration_model m ON m.revision_id=rv.id AND m.sort_no=1 LEFT JOIN agt_access_config ac ON ac.revision_id=rv.id LEFT JOIN mon_agent_status ms ON ms.agent_id=g.id`;
  const where=`WHERE ${clauses.join(' AND ')}`;
  const [countRows]=await pool.execute<RowDataPacket[]>(`SELECT COUNT(DISTINCT l.id) total ${from} ${where}`,params);
  const [rows]=await pool.execute<RowDataPacket[]>(`SELECT l.id,l.agent_id,l.ledger_no,l.lifecycle_status,l.runtime_status ledger_runtime,COALESCE(ms.run_status,l.runtime_status,IF(l.lifecycle_status='DISABLED','DISABLED','OFFLINE')) runtime_status,l.risk_level,l.accessed_at,l.online_at,l.trial_expires_at,g.agent_code,g.agent_name,g.agent_version,g.agent_type,g.source_type,g.supplier_name,g.function_description,g.tech_contact_name,g.tech_contact_phone,d.department_name,d.department_code,rv.clinical_stages,rv.access_mode,m.model_name,m.deployment_mode,ac.endpoint_url ${from} ${where} ORDER BY l.accessed_at DESC,l.id DESC LIMIT ? OFFSET ?`,[...params,pageSize,(page-1)*pageSize]);
  const items=rows.map((row)=>{const stages=parseStages(row.clinical_stages);const source=sourceLabel[row.source_type]??row.source_type;const runtime=row.runtime_status??(row.lifecycle_status==='DISABLED'?'DISABLED':'OFFLINE');return {
    id:String(row.id),agentId:String(row.agent_id),idCode:row.agent_code??row.ledger_no,nameEn:row.agent_code??row.ledger_no,name:row.agent_name,version:row.agent_version,department:row.department_name,departmentCode:row.department_code,
    diagnosisPhase:stages,sourceType:source,vendor:row.supplier_name??'',description:row.function_description,type:row.agent_type??'辅助诊断',functionKeywords:stages.length?stages:[row.agent_type??'智能体'],
    riskLevel:riskLabel[row.risk_level]??'待分级',accessType:row.access_mode==='OTEL'?'OTel':row.access_mode,lifecycleStatus:lifecycleLabel[row.lifecycle_status]??row.lifecycle_status,runtimeStatus:runtimeLabel[runtime]??runtime,
    accessTime:String(row.accessed_at).slice(0,10),onlineTime:row.online_at?String(row.online_at).slice(0,10):undefined,trialExpiresAt:row.trial_expires_at?String(row.trial_expires_at).slice(0,10):undefined,
    modelName:row.model_name??'',modelSource:source==='自研'?'自研':'商用',deploymentType:row.deployment_mode==='LOCAL'?'本地部署':row.deployment_mode==='HYBRID'?'混合部署':'公有云',techArch:'大语言模型',interfaceProtocol:'RESTful',interfaceUrl:row.endpoint_url??'',authMethod:'API Key',techContact:row.tech_contact_name,techContactPhone:row.tech_contact_phone,
    versionHistory:[],filingAttachments:[],linkedResources:[],relatedFlows:[],lifecycleTimeline:[],permissions:{dataDomains:[],businessSystems:[],interfacePermissions:[],changeLogs:[]},
  }});
  const [departments]=await pool.execute<RowDataPacket[]>(`SELECT department_name value,department_name label FROM sys_department WHERE status='ENABLED' AND is_deleted=0 ORDER BY sort_no,id`);
  res.json(ok({items,total:Number(countRows[0]!.total),page,pageSize,meta:{departments,stages:['导诊分诊','预问诊','预约挂号','辅助检查','辅助诊断','辅助治疗','住院','手术','其他'],sources:['自研','第三方','合作研发'],riskLevels:['高度关注','中度关注','一般关注'],accessModes:['API','SDK','OTel'],runtimeStatuses:['在线','离线','更新','禁用','异常']},isPlatformAdmin:Boolean(ctx.is_admin)}));
} catch(error){next(error);} });

router.patch('/agents/:id/status', async(req,res,next)=>{const connection=await pool.getConnection();try{await connection.beginTransaction();const ctx=await contextOf(req.auth!.userId);if(!ctx.is_admin)throw Object.assign(new Error('仅信息科管理员可变更运行状态'),{statusCode:403});const action=String(req.body?.action??'');const reason=String(req.body?.reason??'').trim();if(!['disable','enable'].includes(action))throw Object.assign(new Error('状态操作不正确'),{statusCode:400});if(action==='disable'&&!reason)throw Object.assign(new Error('禁用原因不能为空'),{statusCode:400});const [rows]=await connection.execute<RowDataPacket[]>(`SELECT id,agent_id,lifecycle_status FROM led_agent_ledger WHERE id=? FOR UPDATE`,[req.params.id]);if(!rows.length)throw Object.assign(new Error('台账记录不存在'),{statusCode:404});const row=rows[0]!;const nextStatus=action==='disable'?'DISABLED':'TRIAL';await connection.execute(`UPDATE led_agent_ledger SET lifecycle_status=?,runtime_status=?,disabled_at=IF(?='DISABLED',CURRENT_TIMESTAMP(3),NULL),disabled_by=IF(?='DISABLED',?,NULL),disabled_reason=IF(?='DISABLED',?,NULL),row_version=row_version+1 WHERE id=?`,[nextStatus,action==='disable'?'DISABLED':'OFFLINE',nextStatus,nextStatus,req.auth!.userId,nextStatus,reason||null,row.id]);await connection.execute(`INSERT INTO led_lifecycle_event(ledger_id,event_type,from_status,to_status,event_source,operator_id,event_detail) VALUES (?,?,?,?, 'LEDGER',?,?)`,[row.id,action==='disable'?'DISABLE':'ENABLE',row.lifecycle_status,nextStatus,req.auth!.userId,reason||(action==='enable'?'管理员重新启用':'')]);await connection.commit();res.json(ok({id:String(row.id),lifecycleStatus:lifecycleLabel[nextStatus],runtimeStatus:action==='disable'?'禁用':'离线'}));}catch(error){await connection.rollback();next(error);}finally{connection.release();}});

export default router;
