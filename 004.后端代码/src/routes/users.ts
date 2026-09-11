import { Router } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import bcrypt from 'bcryptjs';
import { pinyin } from 'pinyin-pro';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../auth.js';
import { pool } from '../db.js';
import { dictionaryDepartmentRows } from '../dictionary-departments.js';
import { requireRole } from '../middleware/authorization.js';

const router = Router();
router.use(requireAuth, requireRole('IT_ADMIN'));

const ok = (data: unknown, message = 'success') => ({ code: 200, message, data, timestamp: new Date().toISOString() });
interface UserInput {
  name: string;
  employeeId: string;
  departmentId: number;
  phone: string;
  roles: string[];
  password?: string;
  status?: '正常' | '停用';
}

const validateUserInput = (body: Record<string, unknown>, isEditing = false): UserInput | string => {
  const input = {
    name: String(body.name ?? '').trim(), employeeId: String(body.employeeId ?? '').trim(),
    departmentId: Number(body.departmentId), phone: String(body.phone ?? '').trim(),
    roles: Array.isArray(body.roles) ? body.roles.map(String) : [],
    password: String(body.password ?? '').trim() || undefined,
    status: String(body.status ?? '') as UserInput['status'],
  };
  if (!/^[\u4e00-\u9fa5]{2,10}$/.test(input.name)) return '用户姓名须为2-10个汉字';
  if (!/^[A-Za-z0-9_-]{1,50}$/.test(input.employeeId)) return '用户工号只能包含字母、数字、下划线或连字符';
  if (!Number.isInteger(input.departmentId) || input.departmentId <= 0) return '请选择所属组织';
  if (!/^1\d{10}$/.test(input.phone)) return '请输入正确的11位手机号';
  if (!input.roles.length || input.roles.some((role) => !role || role.length > 100)) return '请选择有效的用户角色';
  if (input.password && (input.password.length < 8 || input.password.length > 64)) return '密码长度须为8-64位';
  if (!isEditing && !['正常', '停用'].includes(input.status ?? '')) return '请选择帐号状态';
  return input;
};

interface UserListRow extends RowDataPacket {
  id: number;
  user_uuid: string;
  real_name: string;
  employee_no: string;
  department_name: string;
  phone: string;
  account_status: string;
  created_at: string;
  last_login_at: string | null;
  roles: string | null;
}

const formatTime = (value: string | null) => value ? value.slice(0, 19) : '-';
const toDto = (row: UserListRow) => {
  const roles = row.roles?.split(',').filter(Boolean) ?? [];
  return {
    id: row.user_uuid,
    name: row.real_name,
    employeeId: row.employee_no,
    department: row.department_name,
    phone: row.phone,
    roles,
    dataScope: roles.some((role) => role === '医院领导' || role === '信息科管理员') ? '全院数据' : '本科室数据',
    status: row.account_status === 'ACTIVE' ? '正常' : '停用',
    createdAt: formatTime(row.created_at),
    lastLoginAt: formatTime(row.last_login_at),
  };
};

const parseFilters = (query: Record<string, unknown>) => {
  const where = ['u.is_deleted = 0'];
  const values: Array<string | number> = [];
  const userId = String(query.userId ?? '').trim();
  if (userId) {
    where.push('u.user_uuid = ?'); values.push(userId);
  }
  const departmentId = Number(query.departmentId);
  if (Number.isInteger(departmentId) && departmentId > 0) {
    where.push('u.department_id = ?'); values.push(departmentId);
  }
  const role = String(query.role ?? '').trim();
  if (role) {
    where.push(`EXISTS (SELECT 1 FROM iam_user_role fur JOIN iam_role fr ON fr.id = fur.role_id
      WHERE fur.user_id = u.id AND fr.role_name = ? AND fr.status = 'ENABLED' AND fr.is_deleted = 0
      AND (fur.expires_at IS NULL OR fur.expires_at > CURRENT_TIMESTAMP(3)))`);
    values.push(role);
  }
  const status = String(query.status ?? '').trim();
  if (status === '正常') where.push(`u.account_status = 'ACTIVE'`);
  if (status === '停用') where.push(`u.account_status <> 'ACTIVE'`);
  return { whereSql: where.join(' AND '), values };
};

const selectSql = (whereSql: string) => `
  SELECT u.id, u.user_uuid, u.real_name, u.employee_no, d.department_name, u.phone,
    u.account_status, u.created_at, u.last_login_at,
    GROUP_CONCAT(DISTINCT r.role_name ORDER BY r.id SEPARATOR ',') AS roles
  FROM iam_user u
  JOIN sys_department d ON d.id = u.department_id
  LEFT JOIN iam_user_role ur ON ur.user_id = u.id AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP(3))
  LEFT JOIN iam_role r ON r.id = ur.role_id AND r.status = 'ENABLED' AND r.is_deleted = 0
  WHERE ${whereSql}
  GROUP BY u.id`;

router.get('/meta', async (_req, res, next) => {
  try {
    const departments = await dictionaryDepartmentRows('organization', 'OTHER');
    const [roles] = await pool.execute<RowDataPacket[]>(
      `SELECT role_name AS value, role_name AS label FROM iam_role
       WHERE role_code <> 'NORMAL_USER' AND status = 'ENABLED' AND is_deleted = 0 ORDER BY is_system DESC, id`,
    );
    res.json(ok({ departments, roles }));
  } catch (error) { next(error); }
});

router.get('/options', async (req, res, next) => {
  try {
    const keyword = String(req.query.keyword ?? '').trim();
    const pattern = `%${keyword}%`;
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT user_uuid AS value, real_name AS name, employee_no AS employeeId, phone
       FROM iam_user
       WHERE is_deleted = 0
         AND (? = '' OR real_name LIKE ? OR employee_no LIKE ? OR phone LIKE ?)
       ORDER BY account_status = 'ACTIVE' DESC, real_name, id
       LIMIT 20`,
      [keyword, pattern, pattern, pattern],
    );
    res.json(ok(rows.map((row) => ({
      value: String(row.value),
      label: `${row.name} / ${row.employeeId} / ${row.phone}`,
    }))));
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  const input = validateUserInput(req.body ?? {});
  if (typeof input === 'string') return void res.status(400).json({ code: 400, message: input });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [departments] = await connection.execute<RowDataPacket[]>(
      `SELECT id FROM sys_department WHERE id = ? AND status = 'ENABLED' AND is_deleted = 0`, [input.departmentId],
    );
    if (!departments.length) throw Object.assign(new Error('所属组织不存在或已停用'), { statusCode: 400 });
    const [roles] = await connection.query<RowDataPacket[]>(
      `SELECT id, role_name FROM iam_role WHERE role_name IN (?) AND status = 'ENABLED' AND is_deleted = 0`, [input.roles],
    );
    if (roles.length !== new Set(input.roles).size) throw Object.assign(new Error('用户角色不存在或已停用'), { statusCode: 400 });
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO iam_user
       (user_uuid, employee_no, login_name, real_name, department_id, phone, auth_mode, account_status, user_source, data_permission_source, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ADMIN_CREATE', 'INHERIT', ?, ?)`,
      [randomUUID(), input.employeeId, input.employeeId, input.name, input.departmentId, input.phone,
        'PASSWORD', input.status === '正常' ? 'ACTIVE' : 'DISABLED', req.auth!.userId, req.auth!.userId],
    );
    const initialPassword = `${pinyin(input.name, { pattern: 'first', toneType: 'none', type: 'array' }).join('').toLowerCase()}${input.employeeId}`;
    await connection.execute(
      `INSERT INTO iam_user_password (user_id, password_hash, password_algorithm, must_change_password)
       VALUES (?, ?, 'BCRYPT', 1)`, [result.insertId, await bcrypt.hash(initialPassword, 12)],
    );
    for (const role of roles) await connection.execute(
      `INSERT INTO iam_user_role (user_id, role_id, granted_by) VALUES (?, ?, ?)`, [result.insertId, role.id, req.auth!.userId],
    );
    await connection.commit();
    res.status(201).json(ok({ id: result.insertId, initialPassword }, '用户新增成功'));
  } catch (error: any) {
    await connection.rollback();
    if (error?.errno === 1062) return void res.status(409).json({ code: 409, message: '用户工号、手机号或登录名已存在' });
    if (error?.statusCode) return void res.status(error.statusCode).json({ code: error.statusCode, message: error.message });
    next(error);
  } finally { connection.release(); }
});

router.get('/', async (req, res, next) => {
  try {
    const current = Math.max(1, Number(req.query.current) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 8));
    const { whereSql, values } = parseFilters(req.query);
    const [counts] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM iam_user u WHERE ${whereSql}`, values);
    const [rows] = await pool.query<UserListRow[]>(
      `${selectSql(whereSql)} ORDER BY u.created_at DESC, u.id DESC LIMIT ? OFFSET ?`,
      [...values, pageSize, (current - 1) * pageSize],
    );
    res.json(ok({ list: rows.map(toDto), pagination: { current, pageSize, total: Number(counts[0]!.total) } }));
  } catch (error) { next(error); }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const status = String(req.body?.status ?? '');
    if (!['正常', '停用'].includes(status)) return void res.status(400).json({ code: 400, message: '帐号状态不正确' });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [users] = await connection.execute<RowDataPacket[]>(
        `SELECT id, login_name FROM iam_user WHERE user_uuid = ? AND is_deleted = 0 FOR UPDATE`,
        [req.params.id],
      );
      const user = users[0];
      if (!user) {
        await connection.rollback();
        return void res.status(404).json({ code: 404, message: '用户不存在' });
      }
      if (status === '停用' && String(user.login_name).toLowerCase() === 'admin') {
        await connection.rollback();
        return void res.status(409).json({ code: 409, message: '系统管理员帐号不支持停用' });
      }
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE iam_user SET account_status = ?, updated_by = ? WHERE id = ?`,
        [status === '正常' ? 'ACTIVE' : 'DISABLED', req.auth!.userId, user.id],
      );
      if (status === '停用') await connection.execute(
        `UPDATE iam_login_session s JOIN iam_user u ON u.id = s.user_id
         SET s.revoked_at = CURRENT_TIMESTAMP(3), s.revoke_reason = '账号被管理员停用'
         WHERE u.user_uuid = ? AND s.revoked_at IS NULL`, [req.params.id],
      );
      await connection.commit();
      res.json(ok(null, status === '正常' ? '帐号已恢复使用' : '帐号已停用'));
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  } catch (error) { next(error); }
});

router.delete('/:id', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.execute<RowDataPacket[]>(
      `SELECT id, real_name, account_status FROM iam_user
       WHERE user_uuid = ? AND is_deleted = 0 FOR UPDATE`, [req.params.id],
    );
    const user = users[0];
    if (!user) {
      await connection.rollback();
      return void res.status(404).json({ code: 404, message: '用户不存在' });
    }
    if (user.account_status !== 'DISABLED') {
      await connection.rollback();
      return void res.status(409).json({ code: 409, message: '执行删除操作前，请先停用该用户' });
    }

    const userId = Number(user.id);
    const [roleLinks] = await connection.execute<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM iam_user_role WHERE user_id = ?`, [userId]);
    const [policyLinks] = await connection.execute<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM iam_user_data_policy WHERE user_id = ?`, [userId]);
    await connection.execute(`DELETE FROM iam_user_role WHERE user_id = ?`, [userId]);
    await connection.execute(`DELETE FROM iam_user_data_policy WHERE user_id = ?`, [userId]);
    await connection.execute(
      `UPDATE iam_login_session SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP(3)),
         revoke_reason = COALESCE(revoke_reason, '用户被管理员删除') WHERE user_id = ?`, [userId],
    );
    await connection.execute(
      `UPDATE iam_user SET is_deleted = 1, updated_by = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?`,
      [req.auth!.userId, userId],
    );
    await connection.commit();
    res.json(ok({ detachedRoles: Number(roleLinks[0]!.total), detachedDataPolicies: Number(policyLinks[0]!.total) }, '用户已删除'));
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally { connection.release(); }
});

router.patch('/batch-status', async (req, res, next) => {
  try {
    const status = String(req.body?.status ?? '');
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String).filter(Boolean) : [];
    if (!['正常', '停用'].includes(status) || ids.length > 1000) {
      return void res.status(400).json({ code: 400, message: '请求参数不正确，单次勾选最多1000人' });
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const filter = parseFilters(req.body ?? {});
      const targetWhere = ids.length
        ? { sql: `u.user_uuid IN (${ids.map(() => '?').join(',')}) AND u.is_deleted = 0`, values: ids }
        : { sql: filter.whereSql, values: filter.values };
      const [targets] = await connection.execute<RowDataPacket[]>(
        `SELECT u.id FROM iam_user u WHERE ${targetWhere.sql}${status === '停用' ? ` AND LOWER(u.login_name) <> 'admin'` : ''} FOR UPDATE`, targetWhere.values,
      );
      const numericIds = targets.map((row) => Number(row.id));
      if (!numericIds.length) {
        await connection.rollback();
        return void res.status(404).json({ code: 404, message: '没有符合条件的用户' });
      }
      const placeholders = numericIds.map(() => '?').join(',');
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE iam_user SET account_status = ?, updated_by = ? WHERE id IN (${placeholders})`,
        [status === '正常' ? 'ACTIVE' : 'DISABLED', req.auth!.userId, ...numericIds],
      );
      if (status === '停用' && result.affectedRows) await connection.execute(
        `UPDATE iam_login_session s
         SET s.revoked_at = CURRENT_TIMESTAMP(3), s.revoke_reason = '账号被管理员批量停用'
         WHERE s.user_id IN (${placeholders}) AND s.revoked_at IS NULL`, numericIds,
      );
      await connection.commit();
      res.json(ok({ affected: result.affectedRows }, `已${status === '正常' ? '启用' : '停用'} ${result.affectedRows} 个帐号`));
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  } catch (error) { next(error); }
});

router.get('/export/csv', async (req, res, next) => {
  try {
    const ids = String(req.query.ids ?? '').split(',').map((id) => id.trim()).filter(Boolean);
    if (ids.length > 1000) {
      return void res.status(400).json({ code: 400, message: '单次勾选最多1000人' });
    }
    const filter = parseFilters(req.query);
    const { whereSql, values } = ids.length
      ? { whereSql: `u.user_uuid IN (${ids.map(() => '?').join(',')}) AND u.is_deleted = 0`, values: ids }
      : filter;
    const [rows] = await pool.execute<UserListRow[]>(`${selectSql(whereSql)} ORDER BY u.created_at DESC, u.id DESC`, values);
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const headers = ['用户姓名', '用户工号', '所属组织', '联系方式', '用户角色', '数据权限', '帐号状态', '帐号创建时间', '最后登录时间'];
    const csv = [headers, ...rows.map((row) => {
      const item = toDto(row);
      return [item.name, item.employeeId, item.department, item.phone, item.roles.join('、'), item.dataScope, item.status, item.createdAt, item.lastLoginAt];
    })].map((line) => line.map(escape).join(',')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="users-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(`\ufeff${csv}`);
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.user_uuid AS id, u.real_name AS name, u.employee_no AS employeeId,
        u.department_id AS departmentId, u.phone, u.account_status,
        GROUP_CONCAT(DISTINCT r.role_name ORDER BY r.id SEPARATOR ',') AS roles
       FROM iam_user u
       LEFT JOIN iam_user_role ur ON ur.user_id = u.id AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP(3))
       LEFT JOIN iam_role r ON r.id = ur.role_id AND r.status = 'ENABLED' AND r.is_deleted = 0
       WHERE u.user_uuid = ? AND u.is_deleted = 0 GROUP BY u.id LIMIT 1`, [req.params.id],
    );
    const user = rows[0];
    if (!user) return void res.status(404).json({ code: 404, message: '用户不存在' });
    res.json(ok({ ...user, roles: user.roles?.split(',') ?? [], status: user.account_status === 'ACTIVE' ? '正常' : '停用' }));
  } catch (error) { next(error); }
});

router.put('/:id', async (req, res, next) => {
  const input = validateUserInput(req.body ?? {}, true);
  if (typeof input === 'string') return void res.status(400).json({ code: 400, message: input });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.execute<RowDataPacket[]>(
      `SELECT id, account_status FROM iam_user WHERE user_uuid = ? AND is_deleted = 0 FOR UPDATE`, [req.params.id],
    );
    if (!users.length) {
      await connection.rollback();
      return void res.status(404).json({ code: 404, message: '用户不存在' });
    }
    const [departments] = await connection.execute<RowDataPacket[]>(
      `SELECT id FROM sys_department WHERE id = ? AND status = 'ENABLED' AND is_deleted = 0`, [input.departmentId],
    );
    if (!departments.length) throw Object.assign(new Error('所属组织不存在或已停用'), { statusCode: 400 });
    const [roles] = await connection.query<RowDataPacket[]>(
      `SELECT id, role_name FROM iam_role WHERE role_name IN (?) AND status = 'ENABLED' AND is_deleted = 0`, [input.roles],
    );
    if (roles.length !== new Set(input.roles).size) throw Object.assign(new Error('用户角色不存在或已停用'), { statusCode: 400 });
    const userId = Number(users[0]!.id);
    await connection.execute(
      `UPDATE iam_user SET employee_no = ?, login_name = ?, real_name = ?, department_id = ?, phone = ?,
        auth_mode = 'PASSWORD', updated_by = ? WHERE id = ?`,
      [input.employeeId, input.employeeId, input.name, input.departmentId, input.phone, req.auth!.userId, userId],
    );
    if (input.password) await connection.execute(
      `INSERT INTO iam_user_password (user_id, password_hash, password_algorithm, must_change_password, failed_attempts, captcha_required, locked_until)
       VALUES (?, ?, 'BCRYPT', 1, 0, 0, NULL)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), password_algorithm = 'BCRYPT',
         must_change_password = 1, failed_attempts = 0, captcha_required = 0, locked_until = NULL,
         password_changed_at = CURRENT_TIMESTAMP(3)`,
      [userId, await bcrypt.hash(input.password, 12)],
    );
    await connection.execute(`DELETE FROM iam_user_role WHERE user_id = ?`, [userId]);
    for (const role of roles) await connection.execute(
      `INSERT INTO iam_user_role (user_id, role_id, granted_by) VALUES (?, ?, ?)`, [userId, role.id, req.auth!.userId],
    );
    await connection.commit();
    res.json(ok(null, '用户信息已更新'));
  } catch (error: any) {
    await connection.rollback();
    if (error?.errno === 1062) return void res.status(409).json({ code: 409, message: '用户工号、手机号或登录名已存在' });
    if (error?.statusCode) return void res.status(error.statusCode).json({ code: error.statusCode, message: error.message });
    next(error);
  } finally { connection.release(); }
});

export default router;
