import type { DataNode } from 'antd/es/tree';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { permissionDefaults, permissionTree } from '../../src/pages/user-center/FunctionPermission.tsx';
import { pool } from '../src/db.js';

const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  let sortNo = 0;
  const insertNodes = async (nodes: DataNode[], parentId: number | null, depth: number) => {
    for (const node of nodes) {
      const code = String(node.key);
      const type = code.includes(':action:') ? 'ACTION' : depth === 0 ? 'MODULE' : 'PAGE';
      await connection.execute(
        `INSERT INTO iam_permission
          (parent_id, permission_code, permission_name, permission_type, sort_no, status)
         VALUES (?, ?, ?, ?, ?, 'ENABLED')
         ON DUPLICATE KEY UPDATE parent_id = VALUES(parent_id), permission_name = VALUES(permission_name),
           permission_type = VALUES(permission_type), sort_no = VALUES(sort_no), status = 'ENABLED'`,
        [parentId, code, String(node.title), type, ++sortNo],
      );
      const [rows] = await connection.execute<RowDataPacket[]>(`SELECT id FROM iam_permission WHERE permission_code = ?`, [code]);
      if (node.children?.length) await insertNodes(node.children, Number(rows[0]!.id), depth + 1);
    }
  };
  await insertNodes(permissionTree, null, 0);

  const [admins] = await connection.execute<RowDataPacket[]>(`SELECT id FROM iam_user WHERE login_name = 'admin' AND is_deleted = 0 LIMIT 1`);
  const actorId = admins[0]?.id ?? null;
  for (const [roleName, keys] of Object.entries(permissionDefaults)) {
    const [roles] = await connection.execute<RowDataPacket[]>(`SELECT id FROM iam_role WHERE role_name = ? AND is_deleted = 0`, [roleName]);
    if (!roles[0]) continue;
    const roleId = Number(roles[0].id);
    await connection.execute(`DELETE FROM iam_role_permission WHERE role_id = ?`, [roleId]);
    const codes = [...new Set(keys.map(String))];
    for (const code of codes) {
      await connection.execute(
        `INSERT INTO iam_role_permission (role_id, permission_id, granted_by)
         SELECT ?, id, ? FROM iam_permission WHERE permission_code = ? AND status = 'ENABLED'`,
        [roleId, actorId, code],
      );
    }
  }
  await connection.commit();
  const [permissionCount] = await connection.execute<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM iam_permission WHERE status = 'ENABLED'`);
  const [grantCount] = await connection.execute<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM iam_role_permission`);
  console.log(`功能权限初始化完成：${permissionCount[0]!.total} 项权限，${grantCount[0]!.total} 条角色授权`);
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
  await pool.end();
}
