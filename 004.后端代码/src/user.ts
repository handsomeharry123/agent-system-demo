import type { RowDataPacket } from 'mysql2';
import { pool } from './db.js';

export interface UserRow extends RowDataPacket {
  id: number; user_uuid: string; employee_no: string; login_name: string; real_name: string;
  department_name: string; phone: string; email: string | null; avatar_url: string | null;
  account_status: string; auth_mode: string; data_permission_source: string;
  last_login_at: string | null; synced_at: string | null; created_at: string; updated_at: string;
  roles: string | null;
}

export const getUser = async (whereSql: string, values: Array<string | number>) => {
  const [rows] = await pool.execute<UserRow[]>(
    `SELECT u.*, d.department_name,
      GROUP_CONCAT(DISTINCT r.role_name ORDER BY r.id SEPARATOR ',') AS roles
     FROM iam_user u
     JOIN sys_department d ON d.id = u.department_id
     LEFT JOIN iam_user_role ur ON ur.user_id = u.id AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP(3))
     LEFT JOIN iam_role r ON r.id = ur.role_id AND r.status = 'ENABLED' AND r.is_deleted = 0
     WHERE ${whereSql}
     GROUP BY u.id LIMIT 1`, values,
  );
  return rows[0];
};

export const getUserPermissionCodes = async (userId: number): Promise<string[]> => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT DISTINCT p.permission_code
     FROM iam_user_role ur
     JOIN iam_role r ON r.id = ur.role_id
       AND r.status = 'ENABLED' AND r.is_deleted = 0
     JOIN iam_role_permission rp ON rp.role_id = r.id
     JOIN iam_permission p ON p.id = rp.permission_id AND p.status = 'ENABLED'
     WHERE ur.user_id = ?
       AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP(3))
     ORDER BY p.permission_code`,
    [userId],
  );
  return rows.map((row) => String(row.permission_code));
};

const maskPhone = (phone: string) => phone.replace(/^(\d{3})\d+(\d{4})$/, '$1****$2');
const fmt = (value: string | null) => value ? value.slice(0, 19) : undefined;

export const toFrontendUser = (user: UserRow, permissionCodes: string[] = []) => ({
  id: user.user_uuid,
  name: user.real_name,
  employeeId: user.employee_no,
  department: user.department_name,
  roles: user.roles?.split(',').filter(Boolean) ?? [],
  permissionCodes,
  phone: maskPhone(user.phone),
  email: user.email ?? undefined,
  avatar: user.avatar_url ?? undefined,
  status: user.account_status === 'ACTIVE' ? '在职' : '已停用',
  lastLoginAt: fmt(user.last_login_at),
  syncTime: fmt(user.synced_at) ?? '',
  dataPermissionSource: user.data_permission_source === 'OVERRIDE' ? 'override' : 'inherit',
  createdAt: fmt(user.created_at)!,
  updatedAt: fmt(user.updated_at)!,
});
