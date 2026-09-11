import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { createHash } from 'node:crypto';
import { pool } from './db.js';

export type DictionaryOption = { label: string; value: string; code: string };

const dictionaryItemsSql = `
  SELECT i.item_code AS code, i.item_name AS label, i.sort_no AS sortNo
  FROM sys_dictionary d
  JOIN sys_dictionary_item i ON i.dictionary_id = d.id
  WHERE d.dictionary_code = ?
    AND d.status = 'ENABLED' AND d.is_deleted = 0
    AND i.status = 'ENABLED' AND i.is_deleted = 0
  ORDER BY i.sort_no, i.id`;

export const getDictionaryOptions = async (dictionaryCode: string): Promise<DictionaryOption[]> => {
  const [rows] = await pool.execute<RowDataPacket[]>(dictionaryItemsSql, [dictionaryCode]);
  return rows.map((row) => ({ code: String(row.code), value: String(row.code), label: String(row.label) }));
};

// Business records retain their sys_department foreign key, while dictionary
// items remain the sole source for option names, ordering and enabled state.
export const syncDictionaryDepartments = async (
  dictionaryCode: 'dept' | 'organization',
  departmentType: 'DEPARTMENT' | 'OTHER',
) => {
  const connection = await pool.getConnection();
  const markerPrefix = `DICTIONARY:${dictionaryCode}:`;
  const codePrefix = dictionaryCode === 'dept' ? 'DICT_D_' : 'DICT_O_';
  try {
    await connection.beginTransaction();
    const [items] = await connection.execute<RowDataPacket[]>(dictionaryItemsSql, [dictionaryCode]);
    await connection.execute(
      `UPDATE sys_department SET status='DISABLED',synced_at=CURRENT_TIMESTAMP(3) WHERE external_org_id LIKE ?`,
      [`${markerPrefix}%`],
    );
    for (const item of items) {
      const itemCode = String(item.code);
      const rawCode = `${codePrefix}${itemCode}`;
      const departmentCode = rawCode.length <= 32
        ? rawCode
        : `${rawCode.slice(0, 23)}_${createHash('sha1').update(rawCode).digest('hex').slice(0, 8)}`;
      await connection.execute(
        `INSERT INTO sys_department
          (department_code,department_name,department_type,external_org_id,sort_no,status,synced_at,is_deleted)
         VALUES (?,?,?,?,?,'ENABLED',CURRENT_TIMESTAMP(3),0)
         ON DUPLICATE KEY UPDATE department_name=VALUES(department_name),department_type=VALUES(department_type),
           external_org_id=VALUES(external_org_id),sort_no=VALUES(sort_no),status='ENABLED',
           synced_at=CURRENT_TIMESTAMP(3),is_deleted=0`,
        [departmentCode, String(item.label), departmentType, `${markerPrefix}${itemCode}`, Number(item.sortNo)],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const dictionaryDepartmentRows = async (
  dictionaryCode: 'dept' | 'organization',
  departmentType: 'DEPARTMENT' | 'OTHER',
) => {
  await syncDictionaryDepartments(dictionaryCode, departmentType);
  const markerPrefix = `DICTIONARY:${dictionaryCode}:`;
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id AS value,department_name AS label,SUBSTRING(external_org_id, CHAR_LENGTH(?) + 1) AS code
     FROM sys_department
     WHERE external_org_id LIKE ? AND status='ENABLED' AND is_deleted=0 ORDER BY sort_no,id`,
    [markerPrefix, `${markerPrefix}%`],
  );
  return rows;
};

export const findDictionaryDepartmentByName = (
  connection: PoolConnection,
  dictionaryCode: 'dept' | 'organization',
  name: string,
) => connection.execute<RowDataPacket[]>(
  `SELECT id FROM sys_department
   WHERE external_org_id LIKE ? AND department_name=? AND status='ENABLED' AND is_deleted=0 LIMIT 1`,
  [`DICTIONARY:${dictionaryCode}:%`, name],
);
