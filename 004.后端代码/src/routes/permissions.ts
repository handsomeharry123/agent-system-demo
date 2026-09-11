import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { requireAuth } from '../auth.js';
import { pool } from '../db.js';
import { requireRole } from '../middleware/authorization.js';

const router = Router();
router.use(requireAuth, requireRole('IT_ADMIN'));
const ok = (data: unknown, message = 'success') => ({ code: 200, message, data, timestamp: new Date().toISOString() });

router.get('/roles', async (_req, res, next) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, role_name, status FROM iam_role
       WHERE is_deleted = 0 AND role_code <> 'NORMAL_USER' ORDER BY is_system DESC, id`,
    );
    res.json(ok(rows.map((row) => ({ id: String(row.id), name: row.role_name, status: row.status === 'ENABLED' ? '启用' : '停用' }))));
  } catch (error) { next(error); }
});

router.get('/roles/:roleId', async (req, res, next) => {
  try {
    const [roles] = await pool.execute<RowDataPacket[]>(`SELECT id FROM iam_role WHERE id = ? AND is_deleted = 0 AND role_code <> 'NORMAL_USER'`, [req.params.roleId]);
    if (!roles.length) return void res.status(404).json({ code: 404, message: '角色不存在' });
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT p.permission_code FROM iam_role_permission rp
       JOIN iam_permission p ON p.id = rp.permission_id
       WHERE rp.role_id = ? AND p.status = 'ENABLED' ORDER BY p.sort_no, p.id`, [req.params.roleId],
    );
    const permissionCodes = rows.map((row) => String(row.permission_code));
    res.json(ok({ permissionCodes, count: permissionCodes.length }));
  } catch (error) { next(error); }
});

router.put('/roles/:roleId', async (req, res, next) => {
  const permissionCodes: string[] | null = Array.isArray(req.body?.permissionCodes)
    ? [...new Set<string>(req.body.permissionCodes.map((value: unknown) => String(value)).filter(Boolean))] : null;
  if (!permissionCodes || permissionCodes.length > 1000) {
    return void res.status(400).json({ code: 400, message: '权限配置格式不正确，最多选择1000项' });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [roles] = await connection.execute<RowDataPacket[]>(
      `SELECT id FROM iam_role WHERE id = ? AND is_deleted = 0 AND role_code <> 'NORMAL_USER' FOR UPDATE`, [req.params.roleId],
    );
    if (!roles.length) {
      await connection.rollback();
      return void res.status(404).json({ code: 404, message: '角色不存在' });
    }
    let permissionIds: number[] = [];
    if (permissionCodes.length) {
      const placeholders = permissionCodes.map(() => '?').join(',');
      const [permissions] = await connection.execute<RowDataPacket[]>(
        `SELECT id FROM iam_permission WHERE permission_code IN (${placeholders}) AND status = 'ENABLED'`, permissionCodes,
      );
      if (permissions.length !== permissionCodes.length) {
        await connection.rollback();
        return void res.status(400).json({ code: 400, message: '包含不存在或已停用的功能权限，请刷新后重试' });
      }
      permissionIds = permissions.map((row) => Number(row.id));
    }
    await connection.execute(`DELETE FROM iam_role_permission WHERE role_id = ?`, [req.params.roleId]);
    for (const permissionId of permissionIds) await connection.execute(
      `INSERT INTO iam_role_permission (role_id, permission_id, granted_by) VALUES (?, ?, ?)`,
      [req.params.roleId, permissionId, req.auth!.userId],
    );
    await connection.execute(`UPDATE iam_role SET updated_by = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?`, [req.auth!.userId, req.params.roleId]);
    await connection.commit();
    res.json(ok({ count: permissionIds.length }, '功能权限保存成功'));
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally { connection.release(); }
});

export default router;
