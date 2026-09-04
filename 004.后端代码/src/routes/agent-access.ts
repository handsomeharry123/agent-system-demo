import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import multer from 'multer';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { requireAuth } from '../auth.js';
import { config } from '../config.js';
import { pool } from '../db.js';

const router = Router();
router.use(requireAuth);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024, files: 1 } });
const uploadRoot = path.resolve(process.cwd(), 'uploads', 'agent-access');

const ok = (data: unknown, message = 'success') => ({ code: 200, message, data, timestamp: new Date().toISOString() });
const statusLabel: Record<string, string> = {
  DRAFT: '草稿', PENDING_REVIEW: '待审核', REVIEWING: '审核中', WITHDRAWN: '撤销修改',
  RETURNED: '退回修改', APPROVED: '审核通过',
};
const sourceToDb: Record<string, string> = { 自研: 'SELF', 第三方: 'THIRD_PARTY', 合作研发: 'CO_DEVELOPED' };
const sourceToView: Record<string, string> = { SELF: '自研', THIRD_PARTY: '第三方', CO_DEVELOPED: '合作研发' };
const deployToDb: Record<string, string> = { 本地化部署: 'LOCAL', 云端部署: 'CLOUD', 混合部署: 'HYBRID' };
const deployToView: Record<string, string> = { LOCAL: '本地化部署', CLOUD: '云端部署', HYBRID: '混合部署' };
const stageToCode: Record<string, string> = {
  导诊分诊: 'TRIAGE', 预问诊: 'PRE_CONSULT', 预约挂号: 'REGISTRATION', 辅助检查: 'EXAM',
  辅助诊断: 'DIAGNOSIS', 辅助治疗: 'TREATMENT', 住院: 'INPATIENT', 手术: 'SURGERY', 其他: 'OTHER',
};
const encryptionKey = createHash('sha256').update(`${config.jwtSecret}:agent-access-credential`).digest();
const passedConnectionTests = new Map<string, number>();
const connectionFingerprint = (userId: number, mode: string, endpoint: string, secret: string, modelName = '') =>
  createHash('sha256').update(`${userId}\0${mode}\0${endpoint}\0${secret}\0${modelName}`).digest('hex');
const rememberPassedTest = (userId: number, mode: string, endpoint: string, secret: string, modelName = '') => {
  const now = Date.now();
  for (const [key, expiresAt] of passedConnectionTests) if (expiresAt <= now) passedConnectionTests.delete(key);
  passedConnectionTests.set(connectionFingerprint(userId, mode, endpoint, secret, modelName), now + 15 * 60_000);
};
const hasRecentPassedTest = (userId: number, mode: string, endpoint: string, secret: string, modelName = '') =>
  (passedConnectionTests.get(connectionFingerprint(userId, mode, endpoint, secret, modelName)) ?? 0) > Date.now();
const encrypt = (plain?: string) => {
  if (!plain) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
};
const decrypt = (value: Buffer | null) => {
  if (!value) return undefined;
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey, value.subarray(0, 12));
    decipher.setAuthTag(value.subarray(12, 28));
    return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString('utf8');
  } catch { return undefined; }
};
const fail = (status: number, message: string) => Object.assign(new Error(message), { statusCode: status });
const text = (value: unknown) => String(value ?? '').trim();
const normalizeUploadFilename = (filename: string) => {
  const decoded = Buffer.from(filename, 'latin1').toString('utf8');
  const looksMojibake = /[ÃÂæäåçèé]/.test(filename);
  return looksMojibake && !decoded.includes('\uFFFD') ? decoded : filename;
};

interface ContextRow extends RowDataPacket { id: number; real_name: string; department_id: number; is_admin: number }
const getContext = async (userId: number, connection: PoolConnection | typeof pool = pool) => {
  const [rows] = await connection.execute<ContextRow[]>(
    `SELECT u.id, u.real_name, u.department_id,
       EXISTS(SELECT 1 FROM iam_user_role ur JOIN iam_role r ON r.id=ur.role_id
         WHERE ur.user_id=u.id AND r.role_code='IT_ADMIN' AND r.status='ENABLED' AND r.is_deleted=0
           AND (ur.expires_at IS NULL OR ur.expires_at>CURRENT_TIMESTAMP(3))) AS is_admin
     FROM iam_user u WHERE u.id=? AND u.is_deleted=0`, [userId],
  );
  if (!rows.length) throw fail(401, '当前用户不存在');
  return rows[0]!;
};

const recordSelect = `
  SELECT a.id, a.application_no, a.agent_id, a.applicant_id, a.status, a.current_revision_no,
    a.submitted_at, a.withdrawn_at, a.returned_at, a.approved_at, a.ledger_synced_at, a.updated_at,
    g.agent_uuid, rv.id revision_id, rv.agent_name, rv.agent_code, rv.agent_version, rv.clinical_stages,
    rv.agent_type, rv.source_type, rv.supplier_name, rv.function_description, rv.tech_contact_name,
    rv.tech_contact_phone, rv.tech_contact_email, rv.access_mode, rv.connection_status,
    d.department_name, u.real_name applicant_name,
    m.model_name, m.model_version, m.deployment_mode, m.parameter_count, m.is_open_source,
    m.context_length, m.temperature, m.top_p, m.max_concurrency, m.release_date,
    ac.endpoint_url, ac.credential_ciphertext, ac.instrumentation_code,
    (SELECT review_comment FROM agt_registration_review rr WHERE rr.application_id=a.id ORDER BY rr.id DESC LIMIT 1) review_comment,
    (SELECT review_result FROM agt_registration_review rr WHERE rr.application_id=a.id ORDER BY rr.id DESC LIMIT 1) review_result,
    (SELECT test_result FROM agt_connection_test ct WHERE ct.revision_id=rv.id ORDER BY ct.id DESC LIMIT 1) latest_connection_result,
    (SELECT error_message FROM agt_connection_test ct WHERE ct.revision_id=rv.id ORDER BY ct.id DESC LIMIT 1) connection_message
  FROM agt_registration_application a
  JOIN agt_agent g ON g.id=a.agent_id
  JOIN agt_registration_revision rv ON rv.application_id=a.id AND rv.revision_no=a.current_revision_no
  JOIN sys_department d ON d.id=rv.department_id
  JOIN iam_user u ON u.id=a.applicant_id
  LEFT JOIN agt_registration_model m ON m.revision_id=rv.id AND m.sort_no=1
  LEFT JOIN agt_access_config ac ON ac.revision_id=rv.id`;

const toRecord = async (row: any, connection: PoolConnection | typeof pool = pool) => {
  const [files] = await connection.execute<RowDataPacket[]>(
    `SELECT f.file_uuid, f.original_name, f.size_bytes FROM agt_registration_file rf
     JOIN sys_file_object f ON f.id=rf.file_id WHERE rf.revision_id=? ORDER BY rf.sort_no`, [row.revision_id],
  );
  const [history] = await connection.execute<RowDataPacket[]>(
    `SELECT action_type, to_status, operator_name_snapshot, remark, occurred_at
     FROM agt_registration_status_history WHERE application_id=? ORDER BY occurred_at,id`, [row.id],
  );
  const stages = typeof row.clinical_stages === 'string' ? JSON.parse(row.clinical_stages || '[]') : (row.clinical_stages ?? []);
  const secret = decrypt(row.credential_ciphertext);
  const effectiveConnectionStatus = row.latest_connection_result ?? row.connection_status;
  return {
    id: String(row.id), name: row.agent_name, agentCode: row.agent_code, version: row.agent_version,
    parameterCount: row.parameter_count == null ? undefined : Number(row.parameter_count),
    openSource: row.is_open_source == null ? undefined : (row.is_open_source ? '是' : '否'),
    contextLength: row.context_length == null ? undefined : Number(row.context_length),
    temperature: row.temperature == null ? undefined : Number(row.temperature), topP: row.top_p == null ? undefined : Number(row.top_p),
    concurrency: row.max_concurrency == null ? undefined : Number(row.max_concurrency), releaseDate: row.release_date ?? undefined,
    modelName: row.model_name ?? '', modelVersion: row.model_version ?? '',
    modelDeploymentMode: deployToView[row.deployment_mode] ?? undefined,
    department: row.department_name, clinicalStage: stages.map((s: any) => typeof s === 'string' ? s : s.name).join('、'),
    source: sourceToView[row.source_type] ?? '自研', supplier: row.supplier_name ?? '', contactName: row.tech_contact_name,
    contactPhone: row.tech_contact_phone, contactEmail: row.tech_contact_email ?? undefined, type: row.agent_type ?? '辅助诊断',
    description: row.function_description, applicant: row.applicant_name, applicantRole: '',
    // 编辑重新提交时，前端凭 fileUuid 识别并复用历史附件；缺失该字段会把
    // 历史附件误判为本地待上传文件，进而报“无法读取文件”。
    attachments: files.map((f) => ({
      name: f.original_name,
      size: `${(Number(f.size_bytes) / 1024 / 1024).toFixed(1)} MB`,
      url: `/api/agent-access/files/${f.file_uuid}`,
      fileUuid: f.file_uuid,
    })),
    accessMode: row.access_mode, apiEndpoint: row.access_mode === 'API' ? row.endpoint_url : undefined,
    apiKey: row.access_mode === 'API' ? secret : undefined, platformUrl: row.access_mode !== 'API' ? row.endpoint_url : undefined,
    platformKey: row.access_mode !== 'API' ? secret : undefined, connectionTested: ['PASSED', 'FAILED'].includes(effectiveConnectionStatus),
    connectionStatus: effectiveConnectionStatus === 'PASSED' ? 'success' : effectiveConnectionStatus === 'FAILED' ? 'failed' : undefined,
    connectionMessage: row.connection_message ?? (effectiveConnectionStatus === 'PASSED' ? '连通测试通过' : undefined),
    status: statusLabel[row.status], lastEditTime: row.updated_at, submitTime: row.submitted_at ?? undefined,
    cancelTime: row.withdrawn_at ?? undefined, returnTime: row.returned_at ?? undefined, passTime: row.approved_at ?? undefined,
    returnReason: row.review_result === 'RETURNED' ? row.review_comment : undefined,
    passNote: row.review_result === 'APPROVED' ? row.review_comment : undefined, ledgerSynced: Boolean(row.ledger_synced_at),
    auditHistory: history.map((h) => ({
      label: ({ CREATE: '创建申请', SAVE_DRAFT: '保存草稿', SUBMIT: '提交审核', RESUBMIT: '重新提交审核', START_REVIEW: '审核中', WITHDRAW: '撤销', RETURN: '退回修改', APPROVE: '审核通过', SYNC_LEDGER: '台账同步' } as any)[h.action_type] ?? h.action_type,
      time: h.occurred_at, status: h.to_status === 'RETURNED' ? 'error' : h.to_status === 'REVIEWING' ? 'process' : 'finish',
      operator: h.operator_name_snapshot ?? undefined, desc: h.remark ?? undefined,
    })),
  };
};

const normalize = (body: any, full: boolean) => {
  const optionalNumber = (input: unknown) =>
    input === '' || input == null ? undefined : Number(input);
  const value = {
    name: text(body.name), agentCode: text(body.agentCode), version: text(body.version), department: text(body.department),
    clinicalStage: text(body.clinicalStage), source: text(body.source), supplier: text(body.supplier), type: text(body.type),
    description: text(body.description), contactName: text(body.contactName), contactPhone: text(body.contactPhone),
    contactEmail: text(body.contactEmail), accessMode: text(body.accessMode || 'API').toUpperCase(),
    endpoint: text(body.accessMode === 'API' ? body.apiEndpoint : body.platformUrl),
    secret: text(body.accessMode === 'API' ? body.apiKey : body.platformKey), modelName: text(body.modelName),
    modelVersion: text(body.modelVersion), deploymentMode: text(body.modelDeploymentMode),
    parameterCount: optionalNumber(body.parameterCount), contextLength: optionalNumber(body.contextLength),
    temperature: optionalNumber(body.temperature), topP: optionalNumber(body.topP),
    concurrency: optionalNumber(body.concurrency),
    connectionTested: Boolean(body.connectionTested && body.connectionStatus === 'success'),
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
  };
  if (!value.name || value.name.length > 20) throw fail(400, '智能体名称必填且不能超过20个字符');
  if (full) {
    if (value.name.length < 2 || !/^\d+\.\d+$/.test(value.version)) throw fail(400, '智能体名称须为2-20个字符，版本号格式应为数字.数字');
    if (!value.department || !value.description || value.description.length > 500) throw fail(400, '所属科室和功能描述为必填项，描述不能超过500字');
    if (!/^1\d{10}$/.test(value.contactPhone) || value.contactName.length < 2 || value.contactName.length > 10) throw fail(400, '技术联系人须为2-10个字符，手机号须为11位');
    if (!['API', 'SDK', 'OTEL'].includes(value.accessMode) || !value.endpoint || !value.secret) throw fail(400, '请完整填写接入方式、接入地址和密钥');
    if (!Number.isFinite(value.parameterCount) || value.parameterCount! <= 0) throw fail(400, '参数量须大于0');
    if (!Number.isInteger(value.contextLength) || value.contextLength! <= 0) throw fail(400, '上下文长度须为正整数');
    if (!Number.isFinite(value.temperature) || value.temperature! < 0 || value.temperature! > 2) throw fail(400, 'Temperature 须在0–2之间');
    if (value.topP !== undefined && (!Number.isFinite(value.topP) || value.topP < 0 || value.topP > 1)) throw fail(400, 'Top P 须在0–1之间');
    if (value.concurrency !== undefined && (!Number.isInteger(value.concurrency) || value.concurrency <= 0)) throw fail(400, '预计 API 并发量须为正整数');
    if (!value.connectionTested) throw fail(400, '提交前必须完成并通过当前连通测试');
  }
  return value;
};

const saveRecord = async (connection: PoolConnection, userId: number, body: any, submit: boolean) => {
  const ctx = await getContext(userId, connection);
  const v = normalize(body, submit);
  if (submit && !hasRecentPassedTest(userId, v.accessMode, v.endpoint, v.secret, v.modelName)) {
    throw fail(409, '当前接入参数尚未通过后端真实连通测试，或测试结果已超过15分钟，请重新测试');
  }
  if (submit && v.attachments.filter((item: any) => text(item?.fileUuid)).length < 2) {
    throw fail(400, '提交前必须上传产品说明书和技术规格书两份PDF备案材料');
  }
  let departmentId = ctx.department_id;
  if (v.department) {
    const [departments] = await connection.execute<RowDataPacket[]>(
      `SELECT id FROM sys_department WHERE department_name=? AND status='ENABLED' AND is_deleted=0 LIMIT 1`, [v.department],
    );
    if (!departments.length) throw fail(400, `所属科室“${v.department}”不存在`);
    departmentId = Number(departments[0]!.id);
  }
  const [duplicateNames] = await connection.execute<RowDataPacket[]>(
    `SELECT id FROM agt_agent WHERE agent_name=? AND is_deleted=0 AND id<>COALESCE(?,0) LIMIT 1`,
    [v.name, Number(body.agentId) || 0],
  );
  const requestedId = Number(body.id);
  let applicationId: number; let agentId: number; let revisionId: number; let oldStatus: string | null = null;
  if (Number.isInteger(requestedId) && requestedId > 0) {
    const [apps] = await connection.execute<RowDataPacket[]>(
      `SELECT a.id,a.agent_id,a.status,rv.id revision_id FROM agt_registration_application a
       JOIN agt_registration_revision rv ON rv.application_id=a.id AND rv.revision_no=a.current_revision_no
       WHERE a.id=? AND a.is_deleted=0 FOR UPDATE`, [requestedId],
    );
    if (!apps.length) throw fail(404, '接入申请不存在');
    const app = apps[0]!;
    const [owners] = await connection.execute<RowDataPacket[]>(`SELECT applicant_id FROM agt_registration_application WHERE id=?`, [requestedId]);
    if (Number(owners[0]!.applicant_id) !== userId) throw fail(403, '只能编辑本人提交的接入申请');
    if (!['DRAFT', 'WITHDRAWN', 'RETURNED'].includes(app.status)) throw fail(409, '当前状态不允许编辑');
    applicationId=requestedId; agentId=Number(app.agent_id); revisionId=Number(app.revision_id); oldStatus=app.status;
    if (duplicateNames.some((row) => Number(row.id) !== agentId)) throw fail(409, '此名称已被使用，请重新命名');
  } else {
    if (duplicateNames.length) throw fail(409, '此名称已被使用，请重新命名');
    const [departmentRows] = await connection.execute<RowDataPacket[]>(`SELECT department_code FROM sys_department WHERE id=? FOR UPDATE`, [departmentId]);
    const departmentCode = text(departmentRows[0]?.department_code).toUpperCase() || String(departmentId).padStart(4, '0');
    const [sequenceRows] = await connection.execute<RowDataPacket[]>(
      `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(agent_code,'-',-1) AS UNSIGNED)),0)+1 next_no FROM agt_agent WHERE department_id=? AND agent_code LIKE CONCAT(?,'-%')`,
      [departmentId, departmentCode],
    );
    const agentCode = `${departmentCode}-${String(Number(sequenceRows[0]?.next_no ?? 1)).padStart(4, '0')}`;
    const [agent] = await connection.execute<ResultSetHeader>(
      `INSERT INTO agt_agent (agent_uuid,agent_code,agent_name,agent_version,department_id,agent_type,source_type,supplier_name,function_description,tech_contact_name,tech_contact_phone,tech_contact_email,current_access_mode,created_by,updated_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [randomUUID(), agentCode, v.name, v.version || '0.1', departmentId, v.type || null, sourceToDb[v.source] ?? null, v.supplier || null,
       v.description || '草稿待完善', v.contactName || '待完善', v.contactPhone || '00000000000', v.contactEmail || null, v.accessMode, userId, userId],
    );
    agentId=agent.insertId;
    const applicationNo = `JR${new Date().toISOString().slice(0,10).replaceAll('-','')}${String(Date.now()).slice(-8)}`;
    const [app] = await connection.execute<ResultSetHeader>(
      `INSERT INTO agt_registration_application (application_no,agent_id,applicant_id,applicant_department_id,status) VALUES (?,?,?,?,'DRAFT')`,
      [applicationNo, agentId, userId, ctx.department_id],
    );
    applicationId=app.insertId;
    const [revision] = await connection.execute<ResultSetHeader>(
      `INSERT INTO agt_registration_revision (application_id,revision_no,agent_name,agent_code,agent_version,department_id,clinical_stages,agent_type,source_type,supplier_name,function_description,tech_contact_name,tech_contact_phone,tech_contact_email,access_mode,connection_status,created_by)
       VALUES (?,1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [applicationId,v.name,agentCode,v.version||'0.1',departmentId,JSON.stringify(v.clinicalStage ? v.clinicalStage.split('、').map((name:string)=>({code:stageToCode[name]??'OTHER',name})) : []),v.type||null,sourceToDb[v.source]??null,v.supplier||null,v.description||'草稿待完善',v.contactName||'待完善',v.contactPhone||'00000000000',v.contactEmail||null,v.accessMode,v.connectionTested?'PASSED':'NOT_TESTED',userId],
    );
    revisionId=revision.insertId;
  }
  const agentCode = (await connection.execute<RowDataPacket[]>(`SELECT agent_code FROM agt_agent WHERE id=?`,[agentId]))[0][0]!.agent_code;
  await connection.execute(
    `UPDATE agt_agent SET agent_name=?,agent_code=?,agent_version=?,department_id=?,agent_type=?,source_type=?,supplier_name=?,function_description=?,tech_contact_name=?,tech_contact_phone=?,tech_contact_email=?,current_access_mode=?,updated_by=? WHERE id=?`,
    [v.name,agentCode,v.version||'0.1',departmentId,v.type||null,sourceToDb[v.source]??null,v.supplier||null,v.description||'草稿待完善',v.contactName||'待完善',v.contactPhone||'00000000000',v.contactEmail||null,v.accessMode,userId,agentId],
  );
  await connection.execute(
    `UPDATE agt_registration_revision SET agent_name=?,agent_code=?,agent_version=?,department_id=?,clinical_stages=?,agent_type=?,source_type=?,supplier_name=?,function_description=?,tech_contact_name=?,tech_contact_phone=?,tech_contact_email=?,access_mode=?,connection_status=? WHERE id=?`,
    [v.name,agentCode,v.version||'0.1',departmentId,JSON.stringify(v.clinicalStage ? v.clinicalStage.split('、').map((name:string)=>({code:stageToCode[name]??'OTHER',name})) : []),v.type||null,sourceToDb[v.source]??null,v.supplier||null,v.description||'草稿待完善',v.contactName||'待完善',v.contactPhone||'00000000000',v.contactEmail||null,v.accessMode,v.connectionTested?'PASSED':'NOT_TESTED',revisionId],
  );
  await connection.execute(`DELETE FROM agt_registration_model WHERE revision_id=?`,[revisionId]);
  const hasModelInformation = Boolean(
    v.modelName || v.modelVersion ||
    [v.parameterCount, v.contextLength, v.temperature, v.topP, v.concurrency].some((item) => item !== undefined),
  );
  if (hasModelInformation) await connection.execute(
    `INSERT INTO agt_registration_model
       (revision_id,model_name,model_version,deployment_mode,parameter_count,context_length,temperature,top_p,max_concurrency)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [revisionId,v.modelName||'未填写',v.modelVersion||'未填写',deployToDb[v.deploymentMode]??'LOCAL',
     v.parameterCount??null,v.contextLength??null,v.temperature??null,v.topP??null,v.concurrency??null],
  );
  await connection.execute(`DELETE FROM agt_registration_file WHERE revision_id=?`, [revisionId]);
  let fileSort = 0;
  for (const attachment of v.attachments) {
    const fileUuid = text(attachment?.fileUuid);
    if (!fileUuid) continue;
    const [files] = await connection.execute<RowDataPacket[]>(
      `SELECT id FROM sys_file_object WHERE file_uuid=? AND uploaded_by=? AND deleted_at IS NULL`, [fileUuid, userId],
    );
    if (!files.length) throw fail(400, `备案材料不存在或无权使用：${text(attachment?.name)}`);
    const materialType = fileSort === 0 ? 'PRODUCT_MANUAL' : fileSort === 1 ? 'TECH_SPEC' : 'OTHER';
    await connection.execute(
      `INSERT INTO agt_registration_file(revision_id,file_id,material_type,sort_no,ocr_status) VALUES (?,?,'OTHER',?,'PENDING')`,
      [revisionId, files[0]!.id, ++fileSort],
    );
    await connection.execute(`UPDATE agt_registration_file SET material_type=? WHERE revision_id=? AND file_id=?`, [materialType, revisionId, files[0]!.id]);
  }
  await connection.execute(`DELETE FROM agt_access_config WHERE revision_id=?`,[revisionId]);
  if (v.endpoint) await connection.execute(
    `INSERT INTO agt_access_config (revision_id,access_mode,endpoint_url,credential_ciphertext,credential_key_id,credential_last4,issued_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP(3))`,
    [revisionId,v.accessMode,v.endpoint,encrypt(v.secret),'LOCAL-AES-256-GCM-V1',v.secret.slice(-4)||null],
  );
  if (v.connectionTested) await connection.execute(
    `INSERT INTO agt_connection_test (revision_id,test_scene,test_result,http_status,latency_ms,tested_by,finished_at,error_message) VALUES (?,'APPLICANT','PASSED',200,0,?,CURRENT_TIMESTAMP(3),'连通测试通过')`,
    [revisionId,userId],
  );
  const targetStatus = submit ? 'PENDING_REVIEW' : 'DRAFT';
  await connection.execute(
    `UPDATE agt_registration_application SET status=?,submitted_at=IF(?='PENDING_REVIEW',CURRENT_TIMESTAMP(3),submitted_at),withdrawn_at=NULL,returned_at=NULL,row_version=row_version+1 WHERE id=?`,
    [targetStatus,targetStatus,applicationId],
  );
  await connection.execute(
    `INSERT INTO agt_registration_status_history (application_id,revision_id,from_status,to_status,action_type,operator_id,operator_name_snapshot,remark)
     VALUES (?,?,?,?,?,?,?,?)`,
    [applicationId,revisionId,oldStatus,targetStatus,submit?(oldStatus&&oldStatus!=='DRAFT'?'RESUBMIT':'SUBMIT'):(oldStatus?'SAVE_DRAFT':'CREATE'),userId,ctx.real_name,submit?'已提交，等待信息科管理员审核':'保存草稿'],
  );
  const [rows] = await connection.execute<RowDataPacket[]>(`${recordSelect} WHERE a.id=?`,[applicationId]);
  return toRecord(rows[0],connection);
};

router.get('/meta', async (_req,res,next) => { try {
  const [departments] = await pool.execute<RowDataPacket[]>(`SELECT id value,department_name label,department_code code FROM sys_department WHERE status='ENABLED' AND is_deleted=0 ORDER BY sort_no,id`);
  res.json(ok({departments}));
} catch(e){next(e);} });

router.post('/files', upload.single('file'), async(req,res,next) => { try {
  const file=req.file;
  if(!file) throw fail(400,'请选择要上传的备案材料');
  const isPdf=file.mimetype==='application/pdf' && file.buffer.subarray(0,5).toString()==='%PDF-';
  if(!isPdf) throw fail(400,'备案材料仅支持有效的PDF文件');
  const fileUuid=randomUUID(); const sha256=createHash('sha256').update(file.buffer).digest('hex');
  const objectKey=`${fileUuid}.pdf`; await mkdir(uploadRoot,{recursive:true}); await writeFile(path.join(uploadRoot,objectKey),file.buffer,{flag:'wx'});
  const originalName=normalizeUploadFilename(file.originalname);
  await pool.execute(
    `INSERT INTO sys_file_object(file_uuid,original_name,storage_provider,object_key,mime_type,file_ext,size_bytes,sha256,virus_scan_status,uploaded_by) VALUES (?,?, 'LOCAL',?,'application/pdf','pdf',?,?,'CLEAN',?)`,
    [fileUuid,originalName,objectKey,file.size,sha256,req.auth!.userId],
  );
  res.status(201).json(ok({fileUuid,name:originalName,sizeBytes:file.size,url:`/api/agent-access/files/${fileUuid}`} ,'文件上传成功'));
} catch(e){next(e);} });

router.get('/files/:uuid', async(req,res,next) => { try {
  const ctx=await getContext(req.auth!.userId);
  const [rows]=await pool.execute<RowDataPacket[]>(
    `SELECT DISTINCT f.original_name,f.object_key,f.uploaded_by FROM sys_file_object f
     LEFT JOIN agt_registration_file rf ON rf.file_id=f.id LEFT JOIN agt_registration_revision rv ON rv.id=rf.revision_id
     LEFT JOIN agt_registration_application a ON a.id=rv.application_id
     WHERE f.file_uuid=? AND f.deleted_at IS NULL AND (?=1 OR f.uploaded_by=? OR a.applicant_id=?) LIMIT 1`,
    [req.params.uuid,ctx.is_admin,ctx.id,ctx.id],
  );
  if(!rows.length) throw fail(404,'文件不存在或无权下载');
  res.download(path.join(uploadRoot,rows[0]!.object_key),rows[0]!.original_name);
} catch(e){next(e);} });

router.get('/applications', async (req,res,next) => { try {
  const ctx=await getContext(req.auth!.userId);
  const [rows]=await pool.execute<RowDataPacket[]>(`${recordSelect} WHERE a.is_deleted=0 ${ctx.is_admin?'': 'AND a.applicant_id=?'} ORDER BY a.updated_at DESC`,ctx.is_admin?[]:[ctx.id]);
  res.json(ok(await Promise.all(rows.map((row)=>toRecord(row)))));
} catch(e){next(e);} });

router.get('/applications/:id', async (req,res,next) => { try {
  const ctx=await getContext(req.auth!.userId); const [rows]=await pool.execute<RowDataPacket[]>(`${recordSelect} WHERE a.id=? AND a.is_deleted=0`,[req.params.id]);
  if(!rows.length) throw fail(404,'接入申请不存在'); if(!ctx.is_admin&&Number(rows[0]!.applicant_id)!==ctx.id) throw fail(403,'无权查看该申请');
  res.json(ok(await toRecord(rows[0])));
} catch(e){next(e);} });

router.post('/applications/save', async(req,res,next)=>{ const c=await pool.getConnection(); try{await c.beginTransaction();const data=await saveRecord(c,req.auth!.userId,req.body,false);await c.commit();res.json(ok(data,'草稿保存成功'));}catch(e){await c.rollback();next(e);}finally{c.release();} });
router.post('/applications/submit', async(req,res,next)=>{ const c=await pool.getConnection(); try{await c.beginTransaction();const data=await saveRecord(c,req.auth!.userId,req.body,true);await c.commit();res.json(ok(data,'接入申请提交成功'));}catch(e){await c.rollback();next(e);}finally{c.release();} });

router.post('/applications/:id/start-review', async(req,res,next)=>{ const c=await pool.getConnection();try{await c.beginTransaction();const ctx=await getContext(req.auth!.userId,c);if(!ctx.is_admin)throw fail(403,'仅信息科管理员可审核');const [apps]=await c.execute<RowDataPacket[]>(`SELECT id,current_revision_no,status FROM agt_registration_application WHERE id=? AND is_deleted=0 FOR UPDATE`,[req.params.id]);if(!apps.length)throw fail(404,'申请不存在');if(apps[0]!.status==='PENDING_REVIEW'){const [rev]=await c.execute<RowDataPacket[]>(`SELECT id FROM agt_registration_revision WHERE application_id=? AND revision_no=?`,[req.params.id,apps[0]!.current_revision_no]);await c.execute(`UPDATE agt_registration_application SET status='REVIEWING',review_started_at=CURRENT_TIMESTAMP(3),row_version=row_version+1 WHERE id=?`,[req.params.id]);await c.execute(`INSERT INTO agt_registration_status_history(application_id,revision_id,from_status,to_status,action_type,operator_id,operator_name_snapshot) VALUES (?,?,'PENDING_REVIEW','REVIEWING','START_REVIEW',?,?)`,[req.params.id,rev[0]!.id,ctx.id,ctx.real_name]);}await c.commit();res.json(ok(null,'已进入审核'));}catch(e){await c.rollback();next(e);}finally{c.release();} });

router.post('/applications/:id/withdraw', async(req,res,next)=>{ const c=await pool.getConnection();try{await c.beginTransaction();const ctx=await getContext(req.auth!.userId,c);const [apps]=await c.execute<RowDataPacket[]>(`SELECT a.*,rv.id revision_id FROM agt_registration_application a JOIN agt_registration_revision rv ON rv.application_id=a.id AND rv.revision_no=a.current_revision_no WHERE a.id=? AND a.is_deleted=0 FOR UPDATE`,[req.params.id]);if(!apps.length)throw fail(404,'申请不存在');const a=apps[0]!;if(Number(a.applicant_id)!==ctx.id)throw fail(403,'只能撤销本人申请');if(!['PENDING_REVIEW','REVIEWING'].includes(a.status))throw fail(409,'当前状态不能撤销');await c.execute(`UPDATE agt_registration_application SET status='WITHDRAWN',withdrawn_at=CURRENT_TIMESTAMP(3),row_version=row_version+1 WHERE id=?`,[a.id]);await c.execute(`INSERT INTO agt_registration_status_history(application_id,revision_id,from_status,to_status,action_type,operator_id,operator_name_snapshot,remark) VALUES (?,?,?,'WITHDRAWN','WITHDRAW',?,?,?)`,[a.id,a.revision_id,a.status,ctx.id,ctx.real_name,text(req.body?.reason)||'申请人主动撤销']);await c.commit();res.json(ok(null,'撤销成功'));}catch(e){await c.rollback();next(e);}finally{c.release();} });

router.delete('/applications/:id', async(req,res,next)=>{try{const [r]=await pool.execute<ResultSetHeader>(`UPDATE agt_registration_application SET is_deleted=1,row_version=row_version+1 WHERE id=? AND applicant_id=? AND status IN ('DRAFT','WITHDRAWN') AND is_deleted=0`,[req.params.id,req.auth!.userId]);if(!r.affectedRows)throw fail(409,'申请不存在或当前状态不允许删除');res.json(ok(null,'删除成功'));}catch(e){next(e);} });

router.post('/applications/:id/review', async(req,res,next)=>{const c=await pool.getConnection();try{await c.beginTransaction();const ctx=await getContext(req.auth!.userId,c);if(!ctx.is_admin)throw fail(403,'仅信息科管理员可审核');const result=text(req.body?.result);const comment=text(req.body?.comment);if(!['APPROVED','RETURNED'].includes(result)||result==='RETURNED'&&!comment)throw fail(400,'审核结论不正确，退回时必须填写说明');const [apps]=await c.execute<RowDataPacket[]>(`SELECT a.*,rv.id revision_id FROM agt_registration_application a JOIN agt_registration_revision rv ON rv.application_id=a.id AND rv.revision_no=a.current_revision_no WHERE a.id=? AND a.is_deleted=0 FOR UPDATE`,[req.params.id]);if(!apps.length)throw fail(404,'申请不存在');const a=apps[0]!;if(!['PENDING_REVIEW','REVIEWING'].includes(a.status))throw fail(409,'当前状态不能审核');const nextStatus=result;await c.execute(`INSERT INTO agt_registration_review(application_id,revision_id,reviewer_id,review_result,review_comment) VALUES (?,?,?,?,?)`,[a.id,a.revision_id,ctx.id,result,comment||null]);await c.execute(`UPDATE agt_registration_application SET status=?,returned_at=IF(?='RETURNED',CURRENT_TIMESTAMP(3),returned_at),approved_at=IF(?='APPROVED',CURRENT_TIMESTAMP(3),approved_at),row_version=row_version+1 WHERE id=?`,[nextStatus,nextStatus,nextStatus,a.id]);await c.execute(`INSERT INTO agt_registration_status_history(application_id,revision_id,from_status,to_status,action_type,operator_id,operator_name_snapshot,remark) VALUES (?,?,?,?,?,?,?,?)`,[a.id,a.revision_id,a.status,nextStatus,result==='APPROVED'?'APPROVE':'RETURN',ctx.id,ctx.real_name,comment||'审核通过']);if(result==='APPROVED'){await c.execute(`UPDATE agt_agent SET master_status='MANAGED',updated_by=? WHERE id=?`,[ctx.id,a.agent_id]);const ledgerNo=`TZ${new Date().toISOString().slice(0,10).replaceAll('-','')}${String(a.id).padStart(6,'0')}`;const [ledger]=await c.execute<ResultSetHeader>(`INSERT INTO led_agent_ledger(ledger_no,agent_id,source_application_id,lifecycle_status,risk_level,accessed_at) VALUES (?, ?, ?, 'TRIAL','UNASSESSED',CURRENT_TIMESTAMP(3))`,[ledgerNo,a.agent_id,a.id]);await c.execute(`INSERT INTO led_agent_version(agent_id,version_no,source_revision_id,online_at) SELECT ?,agent_version,?,CURRENT_TIMESTAMP(3) FROM agt_registration_revision WHERE id=?`,[a.agent_id,a.revision_id,a.revision_id]);await c.execute(`INSERT INTO led_lifecycle_event(ledger_id,event_type,to_status,event_source,operator_id,operator_name_snapshot,event_detail) VALUES (?,'ENTER_TRIAL','TRIAL','ACCESS',?,?,?)`,[ledger.insertId,ctx.id,ctx.real_name,'接入审核通过，自动进入统一台账']);await c.execute(`UPDATE agt_registration_application SET ledger_synced_at=CURRENT_TIMESTAMP(3) WHERE id=?`,[a.id]);await c.execute(`INSERT INTO agt_registration_status_history(application_id,revision_id,from_status,to_status,action_type,operator_id,operator_name_snapshot,remark) VALUES (?,?,'APPROVED','APPROVED','SYNC_LEDGER',?,?,?)`,[a.id,a.revision_id,ctx.id,ctx.real_name,'已同步至统一台账中心']);}await c.commit();res.json(ok(null,result==='APPROVED'?'审核通过并已同步台账':'已退回修改'));}catch(e){await c.rollback();next(e);}finally{c.release();} });

export const executeConnectionTest = async (mode: string, endpoint: string, secret: string, modelName = '') => {
  let parsed: URL;
  try { parsed = new URL(endpoint); } catch { throw fail(400, '接入地址格式不正确'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw fail(400, '接入地址仅支持HTTP或HTTPS');
  const originalEndpoint = parsed.toString();
  let endpointAdjusted = false;
  // API 接入统一按 OpenAI Chat Completions 协议探测。既接受完整端点，也接受
  // 任意层级的 Base URL（/、/v1、/api/paas/v4、/compatible-mode/v1 等）。
  // 这样无需在平台代码中硬编码 MiniMax、DeepSeek、智谱等厂商域名。
  if (mode === 'API' && !/\/(?:chat\/completions|text\/chatcompletion_v2)\/?$/i.test(parsed.pathname)) {
    const basePath = parsed.pathname.replace(/\/+$/, '');
    parsed.pathname = `${basePath}/chat/completions`.replace(/^\/\//, '/');
    endpointAdjusted = true;
  }
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutMs = 30_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const stages = [
    { stage: 'dns', label: 'DNS 解析', status: 'ok' },
    { stage: 'connect', label: '建立连接', status: 'pending' },
    { stage: 'auth', label: '鉴权验证', status: 'pending' },
    { stage: 'request', label: '发送请求', status: 'pending' },
    { stage: 'response', label: '接收响应', status: 'pending' },
  ];
  try {
    const isApiMode = mode === 'API';
    const isOpenAiChat = /\/chat\/completions\/?$/i.test(parsed.pathname);
    const isMiniMaxNativeChat = /\/text\/chatcompletion_v2\/?$/i.test(parsed.pathname);
    const supportsInferenceTest = isOpenAiChat || isMiniMaxNativeChat;
    if (isApiMode && !supportsInferenceTest) throw fail(400, '无法生成 OpenAI Chat Completions 接口地址');
    type AuthScheme = 'bearer' | 'x-api-key' | 'api-key';
    const authHeaders = (scheme: AuthScheme): Record<string, string> => scheme === 'bearer'
      ? { Authorization: `Bearer ${secret}` }
      : scheme === 'x-api-key' ? { 'X-API-Key': secret } : { 'api-key': secret };
    let authScheme: AuthScheme = 'bearer';
    const fetchWithAuthFallback = async (url: URL, init: RequestInit) => {
      const schemes: AuthScheme[] = [authScheme, ...(['bearer', 'x-api-key', 'api-key'] as AuthScheme[]).filter((item) => item !== authScheme)];
      let response: Response | undefined;
      for (const scheme of schemes) {
        response = await fetch(url, { ...init, headers: { ...init.headers, ...authHeaders(scheme) } });
        if (response.status !== 401 && response.status !== 403) { authScheme = scheme; return response; }
      }
      return response!;
    };
    // OpenAI-compatible providers normally expose GET /models.  Use it for a
    // cheap authentication check and to discover a model when the user only
    // supplies the Base URL and API key.  Providers that do not implement the
    // endpoint can still be tested when an explicit model name was supplied.
    let resolvedModel = modelName;
    let modelDiscovered = false;
    let modelCorrected = false;
    let modelsEndpoint: URL | undefined;
    const pickChatModel = (payload: any) => {
      const ids = Array.isArray(payload?.data) ? payload.data.map((item: any) => text(item?.id)).filter(Boolean) : [];
      return ids.find((id: string) => !/embed|rerank|image|video|audio|speech|tts|moderation/i.test(id)) || ids[0] || '';
    };
    const discoverModel = async () => {
      if (!modelsEndpoint) return '';
      const modelsResponse = await fetchWithAuthFallback(modelsEndpoint, {
        method: 'GET', redirect: 'follow', signal: controller.signal,
        headers: { Accept: 'application/json', 'User-Agent': 'Med-Agent-Platform-Connectivity-Test/1.0' },
      });
      const modelsPayload = await modelsResponse.json().catch(() => null) as any;
      return modelsResponse.ok ? pickChatModel(modelsPayload) : '';
    };
    if (isApiMode && isOpenAiChat) {
      modelsEndpoint = new URL(parsed);
      modelsEndpoint.pathname = modelsEndpoint.pathname.replace(/\/chat\/completions\/?$/i, '/models');
      if (!resolvedModel) try {
        resolvedModel = await discoverModel();
        modelDiscovered = Boolean(resolvedModel);
      } catch (error) { if (error instanceof Error && error.name === 'AbortError') throw error; }
    }
    if (isApiMode && !resolvedModel) {
      throw fail(400, '未填写模型名称，且无法从 GET /models 自动获取；请填写服务商提供的准确模型 ID');
    }
    const requestMethod = isApiMode ? 'POST' : 'GET';
    const invoke = () => fetchWithAuthFallback(parsed, {
      method: requestMethod, redirect: 'follow', signal: controller.signal,
      headers: { Accept: 'application/json, text/plain, */*', 'Content-Type': 'application/json', 'User-Agent': 'Med-Agent-Platform-Connectivity-Test/1.0' },
      ...(isApiMode ? { body: JSON.stringify({ model: resolvedModel, messages: [{ role: 'user', content: '请仅回复 CONNECTION_OK' }], max_tokens: 32, temperature: 0.1 }) } : {}),
    });
    let response = await invoke();
    let payload = isApiMode ? await response.json().catch(() => null) as any : null;
    const firstError = text(`${payload?.error?.code ?? ''} ${payload?.error?.message ?? ''} ${payload?.base_resp?.status_msg ?? ''}`);
    if (isApiMode && isOpenAiChat && response.status === 400 && /unknown|invalid|not found|不存在|无效/i.test(firstError) && /model|模型/i.test(firstError)) {
      const discovered = await discoverModel().catch(() => '');
      if (discovered && discovered !== resolvedModel) {
        resolvedModel = discovered;
        modelCorrected = true;
        response = await invoke();
        payload = await response.json().catch(() => null) as any;
      }
    }
    const latencyMs = Date.now() - startedAt;
    stages.forEach((stage) => { stage.status = 'ok'; Object.assign(stage, { latencyMs }); });
    const providerStatus = payload?.base_resp?.status_code;
    const providerRejected = Boolean(
      payload?.error || (providerStatus !== undefined && Number(providerStatus) !== 0),
    );
    const providerErrorText = text(`${payload?.error?.type ?? ''} ${payload?.error?.message ?? ''} ${payload?.base_resp?.status_msg ?? ''}`);
    const providerAuthRejected = providerRejected && (
      Number(providerStatus) === 1004 || /auth|authoriz|login|api.?key|secret.?key|鉴权|密钥/i.test(providerErrorText)
    );
    const responseValid = !isApiMode || Boolean(
      payload?.choices?.[0]?.message?.content || payload?.choices?.[0]?.message?.reasoning_content,
    );
    const passed = response.status >= 200 && response.status < 300 && !providerRejected && responseValid;
    if (!passed) {
      const authRejected = response.status === 401 || response.status === 403 || providerAuthRejected;
      const failureStage = authRejected ? 'auth' : response.status >= 500 || !responseValid ? 'response' : 'request';
      const failedIndex = stages.findIndex((stage) => stage.stage === failureStage);
      stages.forEach((stage, index) => { if (index === failedIndex) stage.status = 'fail'; else if (index > failedIndex) stage.status = 'pending'; });
    }
    const authRejected = response.status === 401 || response.status === 403 || providerAuthRejected;
    const invalidResponse = response.ok && !providerRejected && !responseValid;
    const providerMessage = text(payload?.error?.message || payload?.base_resp?.status_msg);
    const message = passed
      ? `${requestMethod === 'POST' ? 'POST推理及鉴权' : 'HTTP'}真实连通测试通过`
      : authRejected
        ? `鉴权失败${providerMessage ? `：${providerMessage}` : `（HTTP ${response.status}）`}`
        : invalidResponse
          ? '目标服务响应格式不符合 Chat Completions 规范'
          : providerRejected && providerMessage
            ? `请求失败：${providerMessage}`
          : `目标服务返回 HTTP ${response.status}`;
    const failureStage = passed ? undefined : authRejected ? 'auth' : response.status >= 500 || invalidResponse ? 'response' : 'request';
    return { ok: passed, message, latencyMs, httpStatus: response.status, requestMethod, stages,
      resolvedEndpoint: parsed.toString(), endpointAdjusted, originalEndpoint, resolvedModel, modelDiscovered, modelCorrected, modelsEndpoint: modelsEndpoint?.toString(), authScheme,
      errorCode: passed ? undefined : authRejected ? (response.status === 401 || response.status === 403 ? `HTTP_${response.status}` : `PROVIDER_${providerStatus}`) : invalidResponse ? 'INVALID_RESPONSE' : `HTTP_${response.status}`, failureStage };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) throw error;
    const latencyMs = Date.now() - startedAt;
    const aborted = error instanceof Error && error.name === 'AbortError';
    stages[0]!.status = 'fail';
    return { ok: false, message: aborted ? `连通测试超时（${timeoutMs / 1000}秒）` : `无法连接目标服务：${error instanceof Error ? error.message : '网络异常'}`, latencyMs,
      stages, errorCode: aborted ? 'TIMEOUT' : 'CONNECTION_FAILED', failureStage: aborted ? 'connect' : 'dns' };
  } finally { clearTimeout(timer); }
};

router.post('/instrumentation/issue', async(req,res,next)=>{try{
  const mode=text(req.body?.accessMode).toUpperCase(); if(!['SDK','OTEL'].includes(mode))throw fail(400,'仅支持签发SDK或OTel接入配置');
  const agentCode=text(req.body?.agentCode)||`new-${req.auth!.userId}`; const issuedAt=Date.now();
  const key=`sk-${mode.toLowerCase()}-${createHmac('sha256',config.jwtSecret).update(`${req.auth!.userId}:${agentCode}:${issuedAt}`).digest('base64url').slice(0,32)}`;
  res.json(ok({platformUrl:`http://127.0.0.1:${config.port}/api/health`,platformKey:key,instrumentationCode:`init({ endpoint: 'http://127.0.0.1:${config.port}/api/health', key: '${key}' });`,issuedAt:new Date(issuedAt).toISOString()},`${mode}接入配置签发成功`));
}catch(e){next(e);} });

router.post('/connection-test', async(req,res,next)=>{try{
  const mode=text(req.body?.accessMode).toUpperCase();const endpoint=text(mode==='API'?req.body?.apiEndpoint:req.body?.platformUrl);const secret=text(mode==='API'?req.body?.apiKey:req.body?.platformKey);
  if(!['API','SDK','OTEL'].includes(mode)||!endpoint||!secret)throw fail(400,'请完整填写接入方式、地址和密钥');
  const modelName=text(req.body?.modelName); const result=await executeConnectionTest(mode,endpoint,secret,modelName); if(result.ok) rememberPassedTest(req.auth!.userId,mode,endpoint,secret,text(result.resolvedModel)||modelName);
  res.json(ok(result,result.message));
}catch(e){next(e);} });

router.post('/applications/:id/connection-test', async(req,res,next)=>{try{
  const ctx=await getContext(req.auth!.userId); if(!ctx.is_admin)throw fail(403,'仅信息科管理员可执行审核复测');
  const [rows]=await pool.execute<RowDataPacket[]>(`SELECT rv.id revision_id,ac.access_mode,ac.endpoint_url,ac.credential_ciphertext,m.model_name FROM agt_registration_application a JOIN agt_registration_revision rv ON rv.application_id=a.id AND rv.revision_no=a.current_revision_no JOIN agt_access_config ac ON ac.revision_id=rv.id LEFT JOIN agt_registration_model m ON m.revision_id=rv.id AND m.sort_no=1 WHERE a.id=? AND a.is_deleted=0`,[req.params.id]);
  if(!rows.length)throw fail(404,'申请或接入配置不存在'); const row=rows[0]!; const secret=decrypt(row.credential_ciphertext); if(!secret)throw fail(409,'接入凭据无法解密，请申请人重新保存');
  const result=await executeConnectionTest(row.access_mode,row.endpoint_url,secret,row.model_name??'');
  const [saved]=await pool.execute<ResultSetHeader>(`INSERT INTO agt_connection_test(revision_id,test_scene,test_result,http_status,latency_ms,error_code,error_message,process_detail,tested_by,finished_at) VALUES (?,'REVIEWER',?,?,?,?,?,?,?,CURRENT_TIMESTAMP(3))`,[row.revision_id,result.ok?'PASSED':'FAILED',result.httpStatus??null,result.latencyMs,result.errorCode??null,result.message,JSON.stringify(result.stages),ctx.id]);
  await pool.execute(`UPDATE agt_registration_revision SET connection_status=? WHERE id=?`, [result.ok?'PASSED':'FAILED',row.revision_id]);
  res.json(ok({...result,testId:saved.insertId},result.message));
}catch(e){next(e);} });

export default router;
