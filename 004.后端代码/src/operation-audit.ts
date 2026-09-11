import { randomUUID } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from './db.js';
import { normalizeClientIp } from './client-ip.js';

const recentReadAudits = new Map<string, number>();
const READ_DEDUPLICATION_WINDOW_MS = 1_000;

/**
 * React development StrictMode and browser retries can issue the same
 * idempotent read twice within a few milliseconds. Keep one audit event for
 * that single user intent, while never deduplicating writes or failed calls.
 */
const isDuplicateReadAudit = (req: Request, input: OperationAuditInput) => {
  const method = input.requestMethod ?? req.method;
  if (method !== 'GET' || input.operationType !== '查看' || (input.result ?? 'SUCCESS') !== 'SUCCESS') return false;
  const now = Date.now();
  const requestPath = input.requestPath ?? req.originalUrl;
  const key = [req.auth?.userId, method, requestPath, input.moduleCode, input.operationType, input.description].join('\0');
  const previous = recentReadAudits.get(key) ?? 0;
  recentReadAudits.set(key, now);
  if (recentReadAudits.size > 1_000) {
    for (const [candidate, timestamp] of recentReadAudits) {
      if (now - timestamp > READ_DEDUPLICATION_WINDOW_MS) recentReadAudits.delete(candidate);
    }
  }
  return now - previous < READ_DEDUPLICATION_WINDOW_MS;
};

export interface OperationAuditInput {
  moduleCode: string;
  moduleName: string;
  operationType: string;
  description: string;
  result?: 'SUCCESS' | 'FAILED';
  failureReason?: string;
  targetType?: string;
  targetId?: string | number;
  ipAddress?: string;
  requestMethod?: string;
  requestPath?: string;
}

/**
 * 写入不可变业务操作日志。审计写入异常不反向破坏用户原业务操作，
 * 但会输出服务端错误，便于监控发现审计链路异常。
 */
export const writeOperationLog = async (req: Request, input: OperationAuditInput) => {
  if (!req.auth?.userId) return;
  if (isDuplicateReadAudit(req, input)) return;
  try {
    const [users] = await pool.execute<RowDataPacket[]>(
      `SELECT u.real_name, d.department_name,
        COALESCE((SELECT r.role_name FROM iam_user_role ur JOIN iam_role r ON r.id=ur.role_id
          WHERE ur.user_id=u.id AND r.status='ENABLED' AND r.is_deleted=0
            AND (ur.expires_at IS NULL OR ur.expires_at>CURRENT_TIMESTAMP(3))
          ORDER BY FIELD(r.role_code,'IT_ADMIN','HOSPITAL_LEADER','DEPT_ADMIN'),r.id LIMIT 1),'普通用户') role_name
       FROM iam_user u JOIN sys_department d ON d.id=u.department_id WHERE u.id=?`,
      [req.auth.userId],
    );
    if (!users.length) return;
    const user = users[0]!;
    await pool.execute(
      `INSERT INTO aud_operation_log
       (log_uuid,user_id,user_name_snapshot,role_name_snapshot,department_name_snapshot,module_code,module_name,
        operation_type,operation_description,operation_result,failure_reason,ip_address,request_method,request_path,target_type,target_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [randomUUID(),req.auth.userId,user.real_name,user.role_name,user.department_name,input.moduleCode,input.moduleName,
       input.operationType,input.description,input.result ?? 'SUCCESS',input.failureReason ?? null,normalizeClientIp(input.ipAddress ?? req.ip),
       input.requestMethod ?? req.method,input.requestPath ?? req.originalUrl,input.targetType ?? null,input.targetId == null ? null : String(input.targetId)],
    );
  } catch (error) {
    console.error('操作审计日志写入失败', error);
  }
};

const target = (type: string, id: unknown) => ({ targetType: type, targetId: id == null ? undefined : String(id) });

/**
 * 将后端已提供的业务接口转换成审计中心可读的操作语义。
 * 仅忽略健康检查、登录态探测和下拉元数据等无独立业务含义的请求。
 */
export const describeOperation = (req: Request): Omit<OperationAuditInput, 'result' | 'failureReason'> | null => {
  // `finish` fires while a mounted Express router can still expose the
  // router-relative `req.url`/`req.path` (for example `/applications`).
  // Audit matching must use the immutable original URL so non-audit routes
  // are not silently skipped. Strip the query string before matching.
  const path = req.originalUrl.split('?')[0] || '/'; const method = req.method;
  if (path === '/api/auth/logout' && method === 'POST') return {moduleCode:'USER_CENTER',moduleName:'用户中心',operationType:'退出',description:'用户退出平台'};
  if (path.startsWith('/api/agent-access/')) {
    if (method === 'POST' && path === '/api/agent-access/files') return { moduleCode:'AGENT_ACCESS',moduleName:'智能体接入中心',operationType:'上传',description:'用户上传智能体备案材料' };
    if (method === 'GET' && path === '/api/agent-access/applications') return {moduleCode:'AGENT_ACCESS',moduleName:'智能体接入中心',operationType:'查看',description:'用户查看智能体接入申请列表'};
    if (method === 'GET' && /^\/api\/agent-access\/applications\/[^/]+$/.test(path)) return {moduleCode:'AGENT_ACCESS',moduleName:'智能体接入中心',operationType:'查看',description:'用户查看智能体接入申请详情',...target('AGENT_ACCESS_APPLICATION',req.params.id)};
    if (method === 'GET' && /^\/api\/agent-access\/files\/[^/]+$/.test(path)) return {moduleCode:'AGENT_ACCESS',moduleName:'智能体接入中心',operationType:'下载',description:'用户下载智能体备案材料',...target('AGENT_ACCESS_FILE',req.params.uuid)};
    if (method === 'POST' && path.endsWith('/applications/save')) return { moduleCode:'AGENT_ACCESS',moduleName:'智能体接入中心',operationType:req.body?.id&&/^\d+$/.test(String(req.body.id))?'编辑':'新建',description:req.body?.id&&/^\d+$/.test(String(req.body.id))?`用户编辑智能体接入申请“${req.body?.name??''}”`:`用户新建智能体接入申请“${req.body?.name??''}”，暂存至草稿列表` };
    if (method === 'POST' && path.endsWith('/applications/submit')) return { moduleCode:'AGENT_ACCESS',moduleName:'智能体接入中心',operationType:req.body?.id&&/^\d+$/.test(String(req.body.id))?'编辑':'新建',description:`用户提交智能体接入申请“${req.body?.name??''}”` };
    if (method === 'POST' && path.endsWith('/withdraw')) return { moduleCode:'AGENT_ACCESS',moduleName:'智能体接入中心',operationType:'撤销',description:'用户撤销智能体接入申请',...target('AGENT_ACCESS_APPLICATION',req.params.id) };
    if (method === 'POST' && (path.endsWith('/review')||path.endsWith('/start-review'))) return { moduleCode:'AGENT_ACCESS',moduleName:'智能体接入中心',operationType:'审核',description:'用户审核智能体接入申请',...target('AGENT_ACCESS_APPLICATION',req.params.id) };
    if (method === 'DELETE' && path.includes('/applications/')) return { moduleCode:'AGENT_ACCESS',moduleName:'智能体接入中心',operationType:'删除',description:'用户删除智能体接入申请',...target('AGENT_ACCESS_APPLICATION',req.params.id) };
    if (method === 'POST' && path === '/api/agent-access/connection-test') return {moduleCode:'AGENT_ACCESS',moduleName:'智能体接入中心',operationType:'连接测试',description:'用户测试智能体接入连接'};
  }
  if (path.startsWith('/api/users')) {
    if (method === 'GET' && path === '/api/users') return {moduleCode:'USER_CENTER',moduleName:'用户中心',operationType:'查看',description:'用户查看平台用户列表'};
    if (method === 'GET' && path === '/api/users/export/csv') return {moduleCode:'USER_CENTER',moduleName:'用户中心',operationType:'导出',description:'用户导出平台用户列表'};
    if (method === 'GET' && /^\/api\/users\/[^/]+$/.test(path)) return {moduleCode:'USER_CENTER',moduleName:'用户中心',operationType:'查看',description:'用户查看平台用户详情',...target('USER',req.params.id)};
    if (method === 'POST' && path === '/api/users') return {moduleCode:'USER_CENTER',moduleName:'用户中心',operationType:'新增',description:`用户新增平台用户“${req.body?.name??''}”`};
    if (method === 'PUT' && /^\/api\/users\/[^/]+$/.test(path)) return {moduleCode:'USER_CENTER',moduleName:'用户中心',operationType:'编辑',description:`用户编辑平台用户“${req.body?.name??''}”`,...target('USER',req.params.id)};
    if (method === 'DELETE' && /^\/api\/users\/[^/]+$/.test(path)) return {moduleCode:'USER_CENTER',moduleName:'用户中心',operationType:'删除',description:'用户删除已停用的平台用户',...target('USER',req.params.id)};
    if (method === 'PATCH' && path === '/api/users/batch-status') return {moduleCode:'USER_CENTER',moduleName:'用户中心',operationType:req.body?.status==='正常'?'启用':'停用',description:`用户批量${req.body?.status==='正常'?'启用':'停用'}平台帐号`};
    if (method === 'PATCH' && path.endsWith('/status')) return {moduleCode:'USER_CENTER',moduleName:'用户中心',operationType:req.body?.status==='正常'?'启用':'停用',description:`用户${req.body?.status==='正常'?'启用':'停用'}平台帐号`,...target('USER',req.params.id)};
  }
  if (path.startsWith('/api/roles')) {
    if (method === 'GET' && path === '/api/roles') return {moduleCode:'USER_CENTER',moduleName:'用户中心',operationType:'查看',description:'用户查看角色列表'};
    if (method === 'GET' && /^\/api\/roles\/[^/]+$/.test(path)) return {moduleCode:'USER_CENTER',moduleName:'用户中心',operationType:'查看',description:'用户查看角色详情',...target('ROLE',req.params.id)};
    if (method === 'POST') return {moduleCode:'USER_CENTER',moduleName:'用户中心',operationType:'新增',description:`用户新增角色“${req.body?.name??''}”`};
    if (method === 'PUT') return {moduleCode:'USER_CENTER',moduleName:'用户中心',operationType:'编辑',description:`用户编辑角色“${req.body?.name??''}”`,...target('ROLE',req.params.id)};
    if (method === 'DELETE' && /^\/api\/roles\/[^/]+$/.test(path)) return {moduleCode:'USER_CENTER',moduleName:'用户中心',operationType:'删除',description:'用户删除角色并解除关联关系',...target('ROLE',req.params.id)};
  }
  if (path.startsWith('/api/permissions')) {
    if (method === 'GET' && /^\/api\/permissions\/roles\/[^/]+$/.test(path)) return {moduleCode:'USER_CENTER',moduleName:'用户中心',operationType:'查看',description:'用户查看角色功能权限',...target('ROLE',req.params.roleId)};
    if (method === 'PUT') return {moduleCode:'USER_CENTER',moduleName:'用户中心',operationType:'编辑',description:'用户维护角色功能权限配置',...target('ROLE',req.params.roleId)};
  }
  if (path.startsWith('/api/system-config/dictionaries')) {
    const itemMatch=path.match(/^\/api\/system-config\/dictionaries\/([^/]+)\/items\/([^/]+)(?:\/status)?$/);
    const dictionaryMatch=path.match(/^\/api\/system-config\/dictionaries\/([^/]+)(?:\/status)?$/);
    if (method==='GET' && path==='/api/system-config/dictionaries') return {moduleCode:'SYSTEM_CONFIG',moduleName:'系统配置',operationType:'查看',description:'用户查看数据字典列表'};
    if (method==='GET' && path.endsWith('/export.xlsx')) return {moduleCode:'SYSTEM_CONFIG',moduleName:'系统配置',operationType:'导出',description:path.includes('/items/')?'用户导出字典项':'用户导出数据字典'};
    if (method==='POST' && path==='/api/system-config/dictionaries/import') return {moduleCode:'SYSTEM_CONFIG',moduleName:'系统配置',operationType:'导入',description:'用户批量导入数据字典'};
    if (method==='POST' && path.endsWith('/items/import')) return {moduleCode:'SYSTEM_CONFIG',moduleName:'系统配置',operationType:'导入',description:'用户批量导入字典项',...target('DICTIONARY',req.params.code)};
    if (method==='POST' && path==='/api/system-config/dictionaries') return {moduleCode:'SYSTEM_CONFIG',moduleName:'系统配置',operationType:'新增',description:`用户新增数据字典“${req.body?.name??''}”`};
    if (method==='POST' && /\/items$/.test(path)) return {moduleCode:'SYSTEM_CONFIG',moduleName:'系统配置',operationType:'新增',description:`用户新增字典项“${req.body?.name??''}”`,...target('DICTIONARY',req.params.code)};
    if (itemMatch && ['PUT','PATCH','DELETE'].includes(method)) return {moduleCode:'SYSTEM_CONFIG',moduleName:'系统配置',operationType:method==='DELETE'?'删除':'编辑',description:`用户${method==='DELETE'?'删除':method==='PATCH'?'启停':'编辑'}字典项`,...target('DICTIONARY_ITEM',itemMatch[2])};
    if (dictionaryMatch && ['PUT','PATCH','DELETE'].includes(method)) return {moduleCode:'SYSTEM_CONFIG',moduleName:'系统配置',operationType:method==='DELETE'?'删除':'编辑',description:`用户${method==='DELETE'?'删除':method==='PATCH'?'启停':'编辑'}数据字典`,...target('DICTIONARY',dictionaryMatch[1])};
  }
  if (path.startsWith('/api/system-config/models')) {
    if (method==='GET'&&path==='/api/system-config/models') return {moduleCode:'SYSTEM_CONFIG',moduleName:'系统配置',operationType:'查看',description:'用户查看模型配置列表'};
    if (method==='POST'&&path.endsWith('/test-connection')) return {moduleCode:'SYSTEM_CONFIG',moduleName:'系统配置',operationType:'连接测试',description:'用户测试模型服务联通性'};
    if (method==='POST'&&path==='/api/system-config/models') return {moduleCode:'SYSTEM_CONFIG',moduleName:'系统配置',operationType:'新增',description:`用户新增模型配置“${req.body?.name??''}”`};
    if (method==='POST'&&path.endsWith('/test')) return {moduleCode:'SYSTEM_CONFIG',moduleName:'系统配置',operationType:'连接测试',description:'用户测试已保存模型的联通性',...target('MODEL_CONFIG',req.params.id)};
    if (method==='PUT') return {moduleCode:'SYSTEM_CONFIG',moduleName:'系统配置',operationType:'编辑',description:`用户编辑模型配置“${req.body?.name??''}”`,...target('MODEL_CONFIG',req.params.id)};
    if (method==='DELETE') return {moduleCode:'SYSTEM_CONFIG',moduleName:'系统配置',operationType:'删除',description:'用户删除模型配置',...target('MODEL_CONFIG',req.params.id)};
  }
  if (path.startsWith('/api/ledger')) {
    if (method==='GET' && path==='/api/ledger/overview') return {moduleCode:'LEDGER',moduleName:'统一台账中心',operationType:'查看',description:'用户查看统一台账总览'};
    if (method==='GET' && path==='/api/ledger/agents') return {moduleCode:'LEDGER',moduleName:'统一台账中心',operationType:'查看',description:'用户查看统一台账列表'};
    if (method==='PATCH' && /^\/api\/ledger\/agents\/[^/]+\/status$/.test(path)) return {
      moduleCode:'LEDGER',moduleName:'统一台账中心',operationType:req.body?.action==='disable'?'禁用':'启用',
      description:`用户${req.body?.action==='disable'?'禁用':'启用'}台账智能体`,...target('LEDGER_AGENT',req.params.id),
    };
  }
  return null;
};

/** 自动记录当前已接入后端的关键写操作，成功与失败均留痕。 */
export const operationAuditMiddleware: RequestHandler = (req,res,next) => {
  const requestContext={ipAddress:normalizeClientIp(req.ip) ?? undefined,requestMethod:req.method,requestPath:req.originalUrl};
  let responseMessage: string | undefined;
  const originalJson=res.json.bind(res);
  res.json=((body:unknown)=>{if(body&&typeof body==='object'&&'message' in body)responseMessage=String((body as {message?:unknown}).message??'');return originalJson(body);}) as typeof res.json;
  res.on('finish', () => {
    const input=describeOperation(req);
    if (!input || !req.auth) return;
    const success=res.statusCode<400;
    void writeOperationLog(req,{...input,...requestContext,result:success?'SUCCESS':'FAILED',failureReason:success?undefined:(responseMessage||`HTTP ${res.statusCode}`)});
  });
  next();
};
