import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { requireAuth } from '../auth.js';
import { pool } from '../db.js';
import { requireRole } from '../middleware/authorization.js';

const router = Router();
router.use(requireAuth, requireRole('IT_ADMIN'));
const ok = (data: unknown, message = 'success') => ({ code: 200, message, data, timestamp: new Date().toISOString() });

const ranges = ['全院智能体', '本科室智能体', '指定科室智能体', '指定智能体'] as const;
type DataRange = typeof ranges[number];
interface RoleInput { name: string; description: string; dataRange: DataRange; departmentIds: number[]; agentIds: number[]; status: '启用' | '停用' }

const validate = (body: Record<string, unknown>): RoleInput | string => {
  const input: RoleInput = {
    name: String(body.name ?? '').trim(), description: String(body.description ?? '').trim(),
    dataRange: String(body.dataRange ?? '') as DataRange,
    departmentIds: Array.isArray(body.departmentIds) ? [...new Set(body.departmentIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))] : [],
    agentIds: Array.isArray(body.agentIds) ? [...new Set(body.agentIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))] : [],
    status: String(body.status ?? '') as RoleInput['status'],
  };
  if (!input.name || input.name.length > 100) return '角色名称长度应为1-100个字符';
  if (!input.description || input.description.length > 500) return '角色描述不能为空且不能超过500字';
  if (!ranges.includes(input.dataRange)) return '请选择数据权限范围';
  if (input.dataRange === '指定科室智能体' && !input.departmentIds.length) return '请至少选择一个科室';
  if (input.dataRange === '指定智能体' && !input.agentIds.length) return '请至少选择一个智能体';
  if (!['启用', '停用'].includes(input.status)) return '请选择角色状态';
  return input;
};

const roleQuery = `
  SELECT r.id, r.role_code, r.role_name, r.description, r.is_system, r.status, r.created_at, r.updated_at,
    (SELECT COUNT(*) FROM iam_user_role ur JOIN iam_user u ON u.id = ur.user_id
      WHERE ur.role_id = r.id AND u.is_deleted = 0 AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP(3))) AS user_count,
    (SELECT COUNT(*) FROM iam_role_permission rp WHERE rp.role_id = r.id) AS function_count,
    p.id AS policy_id, p.department_scope, p.agent_scope
  FROM iam_role r
  LEFT JOIN iam_role_data_policy rdp ON rdp.role_id = r.id
  LEFT JOIN iam_data_policy p ON p.id = rdp.policy_id AND p.is_deleted = 0
  WHERE r.is_deleted = 0 AND r.role_code <> 'NORMAL_USER'`;

const rangeOf = (row: RowDataPacket): DataRange => {
  if (row.department_scope === 'ALL' && row.agent_scope === 'ALL') return '全院智能体';
  if (row.department_scope === 'CUSTOM') return '指定科室智能体';
  if (row.agent_scope === 'CUSTOM') return '指定智能体';
  if (row.department_scope === 'SELF') return '本科室智能体';
  if (['HOSPITAL_LEADER', 'IT_ADMIN'].includes(row.role_code)) return '全院智能体';
  return '本科室智能体';
};
const dto = (row: RowDataPacket) => ({
  id: String(row.id), name: row.role_name, description: row.description ?? '',
  userCount: Number(row.user_count), dataRange: rangeOf(row), functionCount: Number(row.function_count),
  status: row.status === 'ENABLED' ? '启用' : '停用', isSystem: Boolean(row.is_system),
  createdAt: String(row.created_at).slice(0, 19), updatedAt: String(row.updated_at).slice(0, 19),
});

const savePolicy = async (connection: Awaited<ReturnType<typeof pool.getConnection>>, roleId: number, roleCode: string, input: RoleInput, actorId: number) => {
  const departmentScope = input.dataRange === '全院智能体' || input.dataRange === '指定智能体' ? 'ALL' : input.dataRange === '指定科室智能体' ? 'CUSTOM' : 'SELF';
  const agentScope = input.dataRange === '全院智能体' ? 'ALL' : input.dataRange === '指定智能体' ? 'CUSTOM' : 'SELF_DEPARTMENT';
  const policyCode = `ROLE_${roleCode}`.slice(0, 64);
  await connection.execute(
    `INSERT INTO iam_data_policy
      (policy_code, policy_name, description, department_scope, agent_scope, status, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE policy_name = VALUES(policy_name), description = VALUES(description),
       department_scope = VALUES(department_scope), agent_scope = VALUES(agent_scope), status = VALUES(status), updated_by = VALUES(updated_by), is_deleted = 0`,
    [policyCode, `${input.name}数据权限`, input.description, departmentScope, agentScope,
      input.status === '启用' ? 'ENABLED' : 'DISABLED', actorId, actorId],
  );
  const [policies] = await connection.execute<RowDataPacket[]>(`SELECT id FROM iam_data_policy WHERE policy_code = ?`, [policyCode]);
  const policyId = Number(policies[0]!.id);
  await connection.execute(`DELETE FROM iam_role_data_policy WHERE role_id = ?`, [roleId]);
  await connection.execute(`INSERT INTO iam_role_data_policy (role_id, policy_id) VALUES (?, ?)`, [roleId, policyId]);
  await connection.execute(`DELETE FROM iam_data_policy_department_scope WHERE policy_id = ?`, [policyId]);
  await connection.execute(`DELETE FROM iam_data_policy_agent_scope WHERE policy_id = ?`, [policyId]);
  for (const id of input.departmentIds) await connection.execute(`INSERT INTO iam_data_policy_department_scope (policy_id, department_id) VALUES (?, ?)`, [policyId, id]);
  for (const id of input.agentIds) await connection.execute(`INSERT INTO iam_data_policy_agent_scope (policy_id, agent_id) VALUES (?, ?)`, [policyId, id]);
  return policyId;
};

router.get('/meta', async (_req, res, next) => {
  try {
    const [departments] = await pool.execute<RowDataPacket[]>(`SELECT id AS value, department_name AS label FROM sys_department WHERE status = 'ENABLED' AND is_deleted = 0 ORDER BY sort_no, id`);
    const [agents] = await pool.execute<RowDataPacket[]>(`SELECT a.id AS value, CONCAT(a.agent_name, '（', d.department_name, '）') AS label FROM agt_agent a JOIN sys_department d ON d.id = a.department_id WHERE a.is_deleted = 0 AND a.master_status = 'MANAGED' ORDER BY a.agent_name`);
    res.json(ok({ departments, agents }));
  } catch (error) { next(error); }
});

router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(`${roleQuery} ORDER BY r.id`);
    const [permissions] = await pool.query<RowDataPacket[]>(
      `SELECT rp.role_id, p.permission_code
       FROM iam_role_permission rp
       JOIN iam_permission p ON p.id = rp.permission_id
       JOIN iam_role r ON r.id = rp.role_id
       WHERE p.status = 'ENABLED' AND r.is_deleted = 0 AND r.role_code <> 'NORMAL_USER'
       ORDER BY rp.role_id, p.sort_no, p.id`,
    );
    const permissionCodesByRole = new Map<number, string[]>();
    for (const permission of permissions) {
      const roleId = Number(permission.role_id);
      const codes = permissionCodesByRole.get(roleId) ?? [];
      codes.push(String(permission.permission_code));
      permissionCodesByRole.set(roleId, codes);
    }
    res.json(ok(rows.map((row) => ({
      ...dto(row),
      permissionCodes: permissionCodesByRole.get(Number(row.id)) ?? [],
    }))));
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  const input = validate(req.body ?? {});
  if (typeof input === 'string') return void res.status(400).json({ code: 400, message: input });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const roleCode = `CUSTOM_${Date.now().toString(36).toUpperCase()}_${randomBytes(3).toString('hex').toUpperCase()}`;
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO iam_role (role_code, role_name, description, is_system, status, created_by, updated_by)
       VALUES (?, ?, ?, 0, ?, ?, ?)`,
      [roleCode, input.name, input.description, input.status === '启用' ? 'ENABLED' : 'DISABLED', req.auth!.userId, req.auth!.userId],
    );
    await savePolicy(connection, result.insertId, roleCode, input, req.auth!.userId);
    await connection.commit();
    res.status(201).json(ok({ id: String(result.insertId), name: input.name }, '角色创建成功'));
  } catch (error: any) {
    await connection.rollback();
    if (error?.errno === 1062) return void res.status(409).json({ code: 409, message: '角色名称已存在' });
    if (error?.errno === 1452) return void res.status(400).json({ code: 400, message: '所选科室或智能体不存在' });
    next(error);
  } finally { connection.release(); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(`${roleQuery} AND r.id = ? LIMIT 1`, [req.params.id]);
    const row = rows[0];
    if (!row) return void res.status(404).json({ code: 404, message: '角色不存在' });
    const [departments] = row.policy_id ? await pool.execute<RowDataPacket[]>(`SELECT d.id AS value, d.department_name AS label FROM iam_data_policy_department_scope s JOIN sys_department d ON d.id = s.department_id WHERE s.policy_id = ? ORDER BY d.id`, [row.policy_id]) : [[]];
    const [agents] = row.policy_id ? await pool.execute<RowDataPacket[]>(`SELECT a.id AS value, a.agent_name AS label FROM iam_data_policy_agent_scope s JOIN agt_agent a ON a.id = s.agent_id WHERE s.policy_id = ? ORDER BY a.id`, [row.policy_id]) : [[]];
    const [permissions] = await pool.execute<RowDataPacket[]>(`SELECT p.permission_code, p.permission_name FROM iam_role_permission rp JOIN iam_permission p ON p.id = rp.permission_id WHERE rp.role_id = ? AND p.status = 'ENABLED' ORDER BY p.sort_no, p.id`, [req.params.id]);
    res.json(ok({ ...dto(row), departmentIds: (departments as RowDataPacket[]).map((item) => Number(item.value)), agentIds: (agents as RowDataPacket[]).map((item) => Number(item.value)), dataRangeItems: [...(departments as RowDataPacket[]).map((item) => item.label), ...(agents as RowDataPacket[]).map((item) => item.label)], permissions: permissions.map((item) => item.permission_name), permissionCodes: permissions.map((item) => item.permission_code) }));
  } catch (error) { next(error); }
});

router.put('/:id', async (req, res, next) => {
  const input = validate(req.body ?? {});
  if (typeof input === 'string') return void res.status(400).json({ code: 400, message: input });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [roles] = await connection.execute<RowDataPacket[]>(`SELECT id, role_code FROM iam_role WHERE id = ? AND is_deleted = 0 FOR UPDATE`, [req.params.id]);
    if (!roles.length) { await connection.rollback(); return void res.status(404).json({ code: 404, message: '角色不存在' }); }
    await connection.execute(`UPDATE iam_role SET role_name = ?, description = ?, status = ?, updated_by = ? WHERE id = ?`, [input.name, input.description, input.status === '启用' ? 'ENABLED' : 'DISABLED', req.auth!.userId, req.params.id]);
    await savePolicy(connection, Number(req.params.id), roles[0]!.role_code, input, req.auth!.userId);
    await connection.commit();
    res.json(ok(null, '角色信息已更新'));
  } catch (error: any) {
    await connection.rollback();
    if (error?.errno === 1062) return void res.status(409).json({ code: 409, message: '角色名称已存在' });
    if (error?.errno === 1452) return void res.status(400).json({ code: 400, message: '所选科室或智能体不存在' });
    next(error);
  } finally { connection.release(); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [roles] = await connection.execute<RowDataPacket[]>(
        `SELECT id, role_name FROM iam_role WHERE id = ? AND is_deleted = 0 FOR UPDATE`, [req.params.id],
      );
      if (!roles.length) { await connection.rollback(); return void res.status(404).json({ code: 404, message: '角色不存在' }); }

      // 先记录关联数量，再显式解除关联。仅删除关系，不删除用户、组织或其他关联对象。
      const [userLinks] = await connection.execute<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM iam_user_role WHERE role_id = ?`, [req.params.id]);
      const [permissionLinks] = await connection.execute<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM iam_role_permission WHERE role_id = ?`, [req.params.id]);
      const [policyRows] = await connection.execute<RowDataPacket[]>(`SELECT policy_id FROM iam_role_data_policy WHERE role_id = ?`, [req.params.id]);
      const policyIds = policyRows.map((row) => Number(row.policy_id));

      await connection.execute(`DELETE FROM iam_user_role WHERE role_id = ?`, [req.params.id]);
      await connection.execute(`DELETE FROM iam_role_permission WHERE role_id = ?`, [req.params.id]);
      await connection.execute(`DELETE FROM iam_role_data_policy WHERE role_id = ?`, [req.params.id]);
      // 角色专属策略不再作为授权来源；如同一策略被用户/组织单独引用，则保留并继续生效。
      for (const policyId of policyIds) await connection.execute(
        `UPDATE iam_data_policy p SET p.status = 'DISABLED', p.is_deleted = 1, p.updated_by = ?
         WHERE p.id = ?
           AND NOT EXISTS (SELECT 1 FROM iam_department_data_policy dp WHERE dp.policy_id = p.id)
           AND NOT EXISTS (SELECT 1 FROM iam_user_data_policy up WHERE up.policy_id = p.id)`,
        [req.auth!.userId, policyId],
      );
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE iam_role SET status = 'DISABLED', is_deleted = 1, updated_by = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?`,
        [req.auth!.userId, req.params.id],
      );
      if (!result.affectedRows) throw new Error('角色删除失败');
      await connection.commit();
      res.json(ok({
        detachedUsers: Number(userLinks[0]!.total),
        detachedPolicies: policyIds.length,
        detachedPermissions: Number(permissionLinks[0]!.total),
      }, '角色已删除，关联关系已解除'));
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  } catch (error) { next(error); }
});

export default router;
