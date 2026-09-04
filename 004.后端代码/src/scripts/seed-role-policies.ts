import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.js';

const defaults = [
  { roleCode: 'HOSPITAL_LEADER', name: '医院领导数据权限', departmentScope: 'ALL', agentScope: 'ALL' },
  { roleCode: 'IT_ADMIN', name: '信息科管理员数据权限', departmentScope: 'ALL', agentScope: 'ALL' },
  { roleCode: 'DEPT_ADMIN', name: '科室管理员数据权限', departmentScope: 'SELF', agentScope: 'SELF_DEPARTMENT' },
];

const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  const [admins] = await connection.execute<RowDataPacket[]>(`SELECT id FROM iam_user WHERE login_name = 'admin' AND is_deleted = 0 LIMIT 1`);
  const actorId = admins[0]?.id ?? null;
  for (const item of defaults) {
    const policyCode = `ROLE_${item.roleCode}`;
    await connection.execute(
      `INSERT INTO iam_data_policy
        (policy_code, policy_name, description, department_scope, agent_scope, status, created_by, updated_by)
       VALUES (?, ?, 'PRD V1.4系统角色默认数据权限', ?, ?, 'ENABLED', ?, ?)
       ON DUPLICATE KEY UPDATE policy_name = VALUES(policy_name), description = VALUES(description),
         department_scope = VALUES(department_scope), agent_scope = VALUES(agent_scope), status = 'ENABLED', updated_by = VALUES(updated_by), is_deleted = 0`,
      [policyCode, item.name, item.departmentScope, item.agentScope, actorId, actorId],
    );
    const [roles] = await connection.execute<RowDataPacket[]>(`SELECT id FROM iam_role WHERE role_code = ? AND is_deleted = 0`, [item.roleCode]);
    const [policies] = await connection.execute<RowDataPacket[]>(`SELECT id FROM iam_data_policy WHERE policy_code = ?`, [policyCode]);
    if (roles[0] && policies[0]) {
      await connection.execute(`DELETE FROM iam_role_data_policy WHERE role_id = ?`, [roles[0].id]);
      await connection.execute(`INSERT INTO iam_role_data_policy (role_id, policy_id) VALUES (?, ?)`, [roles[0].id, policies[0].id]);
    }
  }
  await connection.commit();
  console.log('PRD V1.4系统角色默认数据权限初始化完成');
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
  await pool.end();
}
