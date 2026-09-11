import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../db.js';

const password = process.env.ADMIN_INITIAL_PASSWORD ?? 'admin123';
const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  await connection.execute(`INSERT INTO sys_department (department_code, department_name, department_type) VALUES ('IT', '信息中心', 'DEPARTMENT') ON DUPLICATE KEY UPDATE department_name = VALUES(department_name)`);
  const [departments] = await connection.execute<RowDataPacket[]>(`SELECT id FROM sys_department WHERE department_code = 'IT' LIMIT 1`);
  const departmentId = departments[0]!.id;
  await connection.execute(
    `INSERT INTO iam_user (user_uuid, employee_no, login_name, real_name, department_id, phone, email, auth_mode, account_status, user_source)
     VALUES (?, 'admin', 'admin', '系统管理员', ?, '13800000000', 'admin@system.local', 'BOTH', 'ACTIVE', 'ADMIN_CREATE')
     ON DUPLICATE KEY UPDATE account_status = 'ACTIVE', auth_mode = 'BOTH'`,
    [randomUUID(), departmentId],
  );
  const [users] = await connection.execute<RowDataPacket[]>(`SELECT id FROM iam_user WHERE login_name = 'admin' LIMIT 1`);
  const userId = users[0]!.id;
  const passwordHash = await bcrypt.hash(password, 12);
  await connection.execute(
    `INSERT INTO iam_user_password (user_id, password_hash, password_algorithm)
     VALUES (?, ?, 'BCRYPT') ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), password_algorithm = 'BCRYPT', failed_attempts = 0, captcha_required = 0, locked_until = NULL`,
    [userId, passwordHash],
  );
  await connection.execute(
    `INSERT IGNORE INTO iam_user_role (user_id, role_id) SELECT ?, id FROM iam_role WHERE role_code = 'IT_ADMIN'`, [userId],
  );
  await connection.commit();
  console.log('管理员初始化完成：账号 admin，密码由 ADMIN_INITIAL_PASSWORD 指定（未指定时为 admin123）');
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
  await pool.end();
}
