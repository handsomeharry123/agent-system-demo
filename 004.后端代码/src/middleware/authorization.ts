import type { RequestHandler } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.js';

export const requireRole = (...roleCodes: string[]): RequestHandler => async (req, res, next) => {
  try {
    if (!req.auth) return void res.status(401).json({ code: 401, message: '请先登录' });
    const placeholders = roleCodes.map(() => '?').join(',');
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 1
       FROM iam_user_role ur
       JOIN iam_role r ON r.id = ur.role_id
       WHERE ur.user_id = ? AND r.role_code IN (${placeholders})
         AND r.status = 'ENABLED' AND r.is_deleted = 0
         AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP(3))
       LIMIT 1`,
      [req.auth.userId, ...roleCodes],
    );
    if (!rows.length) return void res.status(403).json({ code: 403, message: '无权访问当前功能' });
    next();
  } catch (error) { next(error); }
};

/**
 * 按功能权限校验接口访问权，保持与前端菜单使用的 permission_code 一致。
 * 角色只负责聚合权限，不能再用固定角色代替具体功能权限。
 */
export const requirePermission = (...permissionCodes: string[]): RequestHandler => async (req, res, next) => {
  try {
    if (!req.auth) return void res.status(401).json({ code: 401, message: '请先登录' });
    const placeholders = permissionCodes.map(() => '?').join(',');
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 1
       FROM iam_user_role ur
       JOIN iam_role r ON r.id = ur.role_id
         AND r.status = 'ENABLED' AND r.is_deleted = 0
       JOIN iam_role_permission rp ON rp.role_id = r.id
       JOIN iam_permission p ON p.id = rp.permission_id
         AND p.status = 'ENABLED'
       WHERE ur.user_id = ? AND p.permission_code IN (${placeholders})
         AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP(3))
       LIMIT 1`,
      [req.auth.userId, ...permissionCodes],
    );
    if (!rows.length) return void res.status(403).json({ code: 403, message: '无权访问当前功能' });
    next();
  } catch (error) { next(error); }
};
