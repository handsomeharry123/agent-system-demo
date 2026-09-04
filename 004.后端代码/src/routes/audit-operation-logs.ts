import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { requireAuth } from '../auth.js';
import { pool } from '../db.js';
import { writeOperationLog } from '../operation-audit.js';
import { normalizeClientIp } from '../client-ip.js';

const router = Router();
router.use(requireAuth);
const ok = (data: unknown, message = 'success') => ({ code: 200, message, data, timestamp: new Date().toISOString() });
const fail = (status: number, message: string) => Object.assign(new Error(message), { statusCode: status });

const filtersOf = (query: Record<string, unknown>) => {
  const where = ['1=1']; const values: Array<string> = [];
  const userId = String(query.userId ?? '').trim(); if (/^\d+$/.test(userId)) { where.push('user_id=?'); values.push(userId); }
  const org = String(query.org ?? '').trim(); if (org) { where.push('department_name_snapshot=?'); values.push(org); }
  const moduleName = String(query.module ?? '').trim(); if (moduleName) { where.push('module_name=?'); values.push(moduleName); }
  const type = String(query.type ?? '').trim(); if (type) { where.push('operation_type=?'); values.push(type); }
  const result = String(query.result ?? '').trim(); if (['SUCCESS','FAILED'].includes(result)) { where.push('operation_result=?'); values.push(result); }
  const startTime = String(query.startTime ?? '').trim(); if (startTime) { where.push('occurred_at>=?'); values.push(startTime); }
  const endTime = String(query.endTime ?? '').trim(); if (endTime) { where.push('occurred_at<=?'); values.push(endTime); }
  return { sql: where.join(' AND '), values };
};
const toDto = (row: any) => ({
  key: row.log_uuid, user: row.user_name_snapshot, role: row.role_name_snapshot, org: row.department_name_snapshot,
  module: row.module_name, type: row.operation_type, desc: row.operation_description,
  result: row.operation_result === 'SUCCESS' ? '成功' : `失败${row.failure_reason ? `：${row.failure_reason}` : ''}`,
  resultCode: row.operation_result, failureReason: row.failure_reason ?? undefined, ip: normalizeClientIp(row.ip_address) ?? '-',
  method: row.request_method ?? undefined, path: row.request_path ?? undefined,
  targetType: row.target_type ?? undefined, targetId: row.target_id ?? undefined, time: row.occurred_at,
});

router.get('/meta', async (_req,res,next) => { try {
  const [orgs,modules,types] = await Promise.all([
    pool.execute<RowDataPacket[]>(`SELECT DISTINCT department_name_snapshot value,department_name_snapshot label FROM aud_operation_log ORDER BY value`),
    pool.execute<RowDataPacket[]>(`SELECT DISTINCT module_name value,module_name label FROM aud_operation_log ORDER BY value`),
    pool.execute<RowDataPacket[]>(`SELECT DISTINCT operation_type value,operation_type label FROM aud_operation_log ORDER BY value`),
  ]);
  res.json(ok({organizations:orgs[0],modules:modules[0],types:types[0]}));
} catch(e){next(e);} });

router.get('/user-options', async(req,res,next) => { try {
  const keyword=String(req.query.keyword??'').trim();
  const pattern=`%${keyword}%`;
  const [rows]=await pool.execute<RowDataPacket[]>(
    `SELECT id AS value, CONCAT(real_name, '（', employee_no, '）') AS label
     FROM iam_user
     WHERE is_deleted=0 AND (?='' OR real_name LIKE ? OR employee_no LIKE ?)
     ORDER BY account_status='ACTIVE' DESC, real_name, id
     LIMIT 20`,
    [keyword,pattern,pattern],
  );
  res.json(ok(rows.map((row)=>({label:String(row.label),value:String(row.value)}))));
} catch(e){next(e);} });

router.get('/', async(req,res,next) => { try {
  const current=Math.max(1,Number(req.query.current)||1); const pageSize=Math.min(100,Math.max(1,Number(req.query.pageSize)||8));
  const order=String(req.query.order)==='asc'?'ASC':'DESC'; const filters=filtersOf(req.query);
  // Record the list access before querying so the current signed-in user's
  // action is persisted and can be returned by this very response.
  await writeOperationLog(req,{
    moduleCode:'AUDIT_CENTER',
    moduleName:'审计中心',
    operationType:'查看',
    description:'用户查看操作日志列表',
    targetType:'OPERATION_LOG',
  });
  const [counts]=await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) total FROM aud_operation_log WHERE ${filters.sql}`,filters.values);
  const [rows]=await pool.query<RowDataPacket[]>(
    `SELECT * FROM aud_operation_log WHERE ${filters.sql} ORDER BY occurred_at ${order},id ${order} LIMIT ? OFFSET ?`,
    [...filters.values,pageSize,(current-1)*pageSize],
  );
  res.json(ok({list:rows.map(toDto),pagination:{current,pageSize,total:Number(counts[0]!.total)}}));
} catch(e){next(e);} });

router.get('/:id', async(req,res,next) => { try {
  const [rows]=await pool.execute<RowDataPacket[]>(`SELECT * FROM aud_operation_log WHERE log_uuid=?`,[req.params.id]);
  if(!rows.length) throw fail(404,'操作日志不存在');
  await writeOperationLog(req,{moduleCode:'AUDIT_CENTER',moduleName:'审计中心',operationType:'查看',description:`用户查看操作日志详情：${req.params.id}`,targetType:'OPERATION_LOG',targetId:req.params.id});
  res.json(ok(toDto(rows[0])));
} catch(e){next(e);} });

router.post('/events/refresh', async(req,res,next) => { try {
  await writeOperationLog(req,{moduleCode:'AUDIT_CENTER',moduleName:'审计中心',operationType:'刷新',description:'用户刷新操作日志列表'});
  res.json(ok(null,'刷新成功'));
} catch(e){next(e);} });

router.post('/export', async(req,res,next) => { try {
  const ids=Array.isArray(req.body?.ids)?req.body.ids.map(String).filter(Boolean):[];
  const filters=filtersOf(req.body ?? {}); let where=filters.sql; const values:Array<string|number>=[...filters.values];
  if(ids.length){where+=` AND log_uuid IN (${ids.map(()=>'?').join(',')})`;values.push(...ids);}
  const [rows]=await pool.query<RowDataPacket[]>(`SELECT * FROM aud_operation_log WHERE ${where} ORDER BY occurred_at DESC,id DESC LIMIT 10000`,values);
  const escape=(v:unknown)=>`"${String(v??'').replaceAll('"','""')}"`;
  const header=['用户名称','用户角色','所属组织','操作模块','操作类型','操作描述','操作结果','失败原因','登录 IP 地址','操作时间'];
  const csv='\uFEFF'+[header,...rows.map((r)=>[r.user_name_snapshot,r.role_name_snapshot,r.department_name_snapshot,r.module_name,r.operation_type,r.operation_description,r.operation_result==='SUCCESS'?'成功':'失败',r.failure_reason??'',normalizeClientIp(r.ip_address)??'',r.occurred_at])].map((row)=>row.map(escape).join(',')).join('\r\n');
  await writeOperationLog(req,{moduleCode:'AUDIT_CENTER',moduleName:'审计中心',operationType:'导出',description:`用户导出${rows.length}条操作日志`,targetType:'OPERATION_LOG'});
  res.setHeader('Content-Type','text/csv; charset=utf-8'); res.setHeader('Content-Disposition',`attachment; filename="operation-logs-${Date.now()}.csv"`); res.send(csv);
} catch(e){next(e);} });

export default router;
