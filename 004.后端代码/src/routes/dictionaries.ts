import { Router } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { requireAuth } from '../auth.js';
import { pool } from '../db.js';
import { requireRole } from '../middleware/authorization.js';

const router = Router();
router.use(requireAuth, requireRole('IT_ADMIN'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, /\.(xlsx|xls|csv)$/i.test(file.originalname)),
});

const ok = (data: unknown, message = 'success') => ({ code: 200, message, data, timestamp: new Date().toISOString() });
const fail = (statusCode: number, message: string) => Object.assign(new Error(message), { statusCode });
const codePattern = /^[a-z][a-z0-9_]*$/;
const valueTypeToDb = { 字符串: 'STRING', 整数: 'INTEGER', 小数: 'DECIMAL', 日期: 'DATE' } as const;
const valueTypeToText: Record<string, string> = { STRING: '字符串', INTEGER: '整数', DECIMAL: '小数', DATE: '日期' };
const sourceToText: Record<string, string> = { BUILTIN: '系统内置', CUSTOM: '自定义' };

interface DictionaryInput {
  code: string;
  name: string;
  valueType: keyof typeof valueTypeToDb;
  remark?: string;
}

interface ItemInput {
  code: string;
  name: string;
  remark?: string;
  sortNo: number;
}

const clean = (value: unknown) => String(value ?? '').trim();
const validateDictionary = (body: Record<string, unknown>): DictionaryInput | string => {
  const code = clean(body.code ?? body.dictionaryCode ?? body['字典编码']);
  const name = clean(body.name ?? body.dictionaryName ?? body['字典名称']);
  const rawType = clean(body.valueType ?? body['字典值类型']) || '字符串';
  const valueType = (rawType in valueTypeToDb ? rawType : valueTypeToText[rawType]) as keyof typeof valueTypeToDb;
  const remark = clean(body.remark ?? body.description ?? body['其他说明']);
  if (!codePattern.test(code) || code.length > 64) return '字典编码须以小写字母开头，且只能包含小写字母、数字和下划线（最多64位）';
  if (!name || name.length > 100) return '字典名称不能为空且不能超过100个字符';
  if (!(valueType in valueTypeToDb)) return '字典值类型须为字符串、整数、小数或日期';
  if (remark.length > 500) return '其他说明不能超过500个字符';
  return { code, name, valueType, remark: remark || undefined };
};

const validateItem = (body: Record<string, unknown>, fallbackSort = 0): ItemInput | string => {
  const code = clean(body.code ?? body.itemCode ?? body['字典项编码']);
  const name = clean(body.name ?? body.itemName ?? body['字典项名称']);
  const remark = clean(body.remark ?? body.description ?? body['备注'] ?? body['其他说明']);
  const sortNo = Number(body.sortNo ?? body['排序号'] ?? fallbackSort);
  if (!codePattern.test(code) || code.length > 100) return '字典项编码须以小写字母开头，且只能包含小写字母、数字和下划线（最多100位）';
  if (!name || name.length > 200) return '字典项名称不能为空且不能超过200个字符';
  if (remark.length > 500) return '备注不能超过500个字符';
  if (!Number.isInteger(sortNo) || sortNo < 0 || sortNo > 2_147_483_647) return '排序号须为非负整数';
  return { code, name, remark: remark || undefined, sortNo };
};

const parseWorkbook = (file?: Express.Multer.File) => {
  if (!file) throw fail(400, '请选择要导入的 xlsx、xls 或 csv 文件');
  try {
    const workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]!];
    if (!sheet) throw new Error('工作表为空');
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  } catch {
    throw fail(400, '文件无法解析，请确认文件格式和内容正确');
  }
};

const formatTime = (value: unknown) => String(value ?? '').slice(0, 19);
const dictionaryDto = (row: RowDataPacket) => ({
  id: String(row.id), code: row.dictionary_code, name: row.dictionary_name,
  source: sourceToText[row.source_type] ?? row.source_type,
  valueType: valueTypeToText[row.value_type] ?? row.value_type,
  enabled: row.status === 'ENABLED', itemCount: Number(row.item_count),
  updatedBy: row.updated_by_name ?? '系统', updatedAt: formatTime(row.updated_at),
  remark: row.description ?? undefined,
});

const itemDto = (row: RowDataPacket) => ({
  id: String(row.id), dictionaryCode: row.dictionary_code,
  code: row.item_code, name: row.item_name, enabled: row.status === 'ENABLED',
  remark: row.remark ?? undefined, sortNo: Number(row.sort_no),
});

const dictionarySelect = `
  SELECT d.*, COALESCE(u.real_name, '系统') AS updated_by_name,
    (SELECT COUNT(*) FROM sys_dictionary_item i WHERE i.dictionary_id=d.id AND i.is_deleted=0) AS item_count
  FROM sys_dictionary d LEFT JOIN iam_user u ON u.id=d.updated_by`;

router.get('/export.xlsx', async (req, res, next) => {
  try {
    const keyword = clean(req.query.keyword ?? req.query.q);
    const values: string[] = [];
    let filter = 'd.is_deleted=0';
    if (keyword) { filter += ' AND (d.dictionary_code LIKE ? OR d.dictionary_name LIKE ?)'; values.push(`%${keyword}%`, `%${keyword}%`); }
    const [rows] = await pool.execute<RowDataPacket[]>(`${dictionarySelect} WHERE ${filter} ORDER BY d.id`, values);
    const data = rows.map((row) => { const d = dictionaryDto(row); return {
      字典编码: d.code, 字典名称: d.name, 字典来源: d.source, 字典值类型: d.valueType,
      状态: d.enabled ? '启用' : '停用', 字典项数量: d.itemCount, 更新人: d.updatedBy, 更新时间: d.updatedAt, 其他说明: d.remark ?? '',
    }; });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data), '数据字典');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="dictionaries-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(buffer);
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const current = Math.max(1, Number(req.query.current) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
    const keyword = clean(req.query.keyword ?? req.query.q);
    const values: string[] = [];
    let filter = 'd.is_deleted=0';
    if (keyword) { filter += ' AND (d.dictionary_code LIKE ? OR d.dictionary_name LIKE ?)'; values.push(`%${keyword}%`, `%${keyword}%`); }
    const [counts] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM sys_dictionary d WHERE ${filter}`, values);
    const [rows] = await pool.query<RowDataPacket[]>(
      `${dictionarySelect} WHERE ${filter} ORDER BY d.id LIMIT ? OFFSET ?`, [...values, pageSize, (current - 1) * pageSize],
    );
    res.json(ok({ list: rows.map(dictionaryDto), pagination: { current, pageSize, total: Number(counts[0]!.total) } }));
  } catch (error) { next(error); }
});

router.post('/import', upload.single('file'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const records = parseWorkbook(req.file);
    if (!records.length || records.length > 1000) throw fail(400, '导入文件须包含1-1000条数据');
    const inputs = records.map((record) => validateDictionary(record));
    const invalidIndex = inputs.findIndex((input) => typeof input === 'string');
    if (invalidIndex >= 0) throw fail(400, `第${invalidIndex + 2}行：${inputs[invalidIndex]}`);
    const dictionaries = inputs as DictionaryInput[];
    if (new Set(dictionaries.map((item) => item.code)).size !== dictionaries.length) throw fail(400, '导入文件中存在重复的字典编码');
    await connection.beginTransaction();
    for (const input of dictionaries) await connection.execute(
      `INSERT INTO sys_dictionary(dictionary_code,dictionary_name,source_type,value_type,description,created_by,updated_by)
       VALUES (?,?,'CUSTOM',?,?,?,?)`, [input.code, input.name, valueTypeToDb[input.valueType], input.remark ?? null, req.auth!.userId, req.auth!.userId],
    );
    await connection.commit();
    res.status(201).json(ok({ imported: dictionaries.length }, `成功导入 ${dictionaries.length} 个字典`));
  } catch (error: any) {
    await connection.rollback();
    if (error?.errno === 1062) return void res.status(409).json({ code: 409, message: '字典编码已存在，导入已取消' });
    next(error);
  } finally { connection.release(); }
});

router.post('/', async (req, res, next) => {
  const input = validateDictionary(req.body ?? {});
  if (typeof input === 'string') return void res.status(400).json({ code: 400, message: input });
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sys_dictionary(dictionary_code,dictionary_name,source_type,value_type,description,created_by,updated_by)
       VALUES (?,?,'CUSTOM',?,?,?,?)`, [input.code, input.name, valueTypeToDb[input.valueType], input.remark ?? null, req.auth!.userId, req.auth!.userId],
    );
    res.status(201).json(ok({ id: String(result.insertId), code: input.code }, '字典创建成功'));
  } catch (error: any) {
    if (error?.errno === 1062) return void res.status(409).json({ code: 409, message: '字典编码已存在' });
    next(error);
  }
});

router.get('/:code/items/export.xlsx', async (req, res, next) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT i.*,d.dictionary_code FROM sys_dictionary_item i JOIN sys_dictionary d ON d.id=i.dictionary_id
       WHERE d.dictionary_code=? AND d.is_deleted=0 AND i.is_deleted=0 ORDER BY i.sort_no,i.id`, [req.params.code],
    );
    const data = rows.map((row) => { const item = itemDto(row); return {
      字典项编码: item.code, 字典项名称: item.name, 状态: item.enabled ? '启用' : '停用', 备注: item.remark ?? '', 排序号: item.sortNo,
    }; });
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data), '字典项');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.code}-items.xlsx"`); res.send(buffer);
  } catch (error) { next(error); }
});

router.get('/:code/items', async (req, res, next) => {
  try {
    const current = Math.max(1, Number(req.query.current) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 20));
    const keyword = clean(req.query.keyword ?? req.query.q);
    const values: Array<string | number> = [req.params.code];
    let filter = 'd.dictionary_code=? AND d.is_deleted=0 AND i.is_deleted=0';
    if (keyword) { filter += ' AND (i.item_code LIKE ? OR i.item_name LIKE ?)'; values.push(`%${keyword}%`, `%${keyword}%`); }
    const [dictionaries] = await pool.execute<RowDataPacket[]>(`${dictionarySelect} WHERE d.dictionary_code=? AND d.is_deleted=0`, [req.params.code]);
    if (!dictionaries.length) return void res.status(404).json({ code: 404, message: '字典不存在' });
    const [counts] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) total FROM sys_dictionary_item i JOIN sys_dictionary d ON d.id=i.dictionary_id WHERE ${filter}`, values,
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT i.*,d.dictionary_code FROM sys_dictionary_item i JOIN sys_dictionary d ON d.id=i.dictionary_id
       WHERE ${filter} ORDER BY i.sort_no,i.id LIMIT ? OFFSET ?`, [...values, pageSize, (current - 1) * pageSize],
    );
    res.json(ok({ dictionary: dictionaryDto(dictionaries[0]!), list: rows.map(itemDto), pagination: { current, pageSize, total: Number(counts[0]!.total) } }));
  } catch (error) { next(error); }
});

router.post('/:code/items/import', upload.single('file'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const records = parseWorkbook(req.file);
    if (!records.length || records.length > 5000) throw fail(400, '导入文件须包含1-5000条数据');
    const inputs = records.map((record, index) => validateItem(record, (index + 1) * 10));
    const invalidIndex = inputs.findIndex((input) => typeof input === 'string');
    if (invalidIndex >= 0) throw fail(400, `第${invalidIndex + 2}行：${inputs[invalidIndex]}`);
    const items = inputs as ItemInput[];
    if (new Set(items.map((item) => item.code)).size !== items.length) throw fail(400, '导入文件中存在重复的字典项编码');
    await connection.beginTransaction();
    const [dictionaries] = await connection.execute<RowDataPacket[]>(
      `SELECT id FROM sys_dictionary WHERE dictionary_code=? AND is_deleted=0 FOR UPDATE`, [String(req.params.code)],
    );
    if (!dictionaries.length) throw fail(404, '字典不存在');
    for (const item of items) await connection.execute(
      `INSERT INTO sys_dictionary_item(dictionary_id,item_code,item_name,item_value,sort_no,remark)
       VALUES (?,?,?,?,?,?)`, [dictionaries[0]!.id, item.code, item.name, item.code, item.sortNo, item.remark ?? null],
    );
    await connection.execute(`UPDATE sys_dictionary SET updated_by=?,updated_at=CURRENT_TIMESTAMP(3) WHERE id=?`, [req.auth!.userId, dictionaries[0]!.id]);
    await connection.commit(); res.status(201).json(ok({ imported: items.length }, `成功导入 ${items.length} 个字典项`));
  } catch (error: any) {
    await connection.rollback();
    if (error?.errno === 1062) return void res.status(409).json({ code: 409, message: '字典项编码已存在，导入已取消' });
    next(error);
  } finally { connection.release(); }
});

router.post('/:code/items', async (req, res, next) => {
  const input = validateItem(req.body ?? {});
  if (typeof input === 'string') return void res.status(400).json({ code: 400, message: input });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [dictionaries] = await connection.execute<RowDataPacket[]>(
      `SELECT id FROM sys_dictionary WHERE dictionary_code=? AND is_deleted=0 FOR UPDATE`, [req.params.code],
    );
    if (!dictionaries.length) throw fail(404, '字典不存在');
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO sys_dictionary_item(dictionary_id,item_code,item_name,item_value,sort_no,remark) VALUES (?,?,?,?,?,?)`,
      [dictionaries[0]!.id, input.code, input.name, input.code, input.sortNo, input.remark ?? null],
    );
    await connection.execute(`UPDATE sys_dictionary SET updated_by=?,updated_at=CURRENT_TIMESTAMP(3) WHERE id=?`, [req.auth!.userId, dictionaries[0]!.id]);
    await connection.commit(); res.status(201).json(ok({ id: String(result.insertId) }, '字典项创建成功'));
  } catch (error: any) {
    await connection.rollback();
    if (error?.errno === 1062) return void res.status(409).json({ code: 409, message: '字典项编码已存在' });
    next(error);
  } finally { connection.release(); }
});

router.get('/:code/items/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT i.*,d.dictionary_code FROM sys_dictionary_item i JOIN sys_dictionary d ON d.id=i.dictionary_id
       WHERE d.dictionary_code=? AND i.id=? AND d.is_deleted=0 AND i.is_deleted=0`, [req.params.code, req.params.id],
    );
    if (!rows.length) return void res.status(404).json({ code: 404, message: '字典项不存在' });
    res.json(ok(itemDto(rows[0]!)));
  } catch (error) { next(error); }
});

router.put('/:code/items/:id', async (req, res, next) => {
  const input = validateItem(req.body ?? {});
  if (typeof input === 'string') return void res.status(400).json({ code: 400, message: input });
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE sys_dictionary_item i JOIN sys_dictionary d ON d.id=i.dictionary_id
       SET i.item_name=?,i.item_value=?,i.sort_no=?,i.remark=?
       WHERE d.dictionary_code=? AND i.id=? AND d.is_deleted=0 AND i.is_deleted=0`,
      [input.name, input.code, input.sortNo, input.remark ?? null, req.params.code, req.params.id],
    );
    if (!result.affectedRows) return void res.status(404).json({ code: 404, message: '字典项不存在' });
    await pool.execute(`UPDATE sys_dictionary SET updated_by=?,updated_at=CURRENT_TIMESTAMP(3) WHERE dictionary_code=? AND is_deleted=0`, [req.auth!.userId, req.params.code]);
    res.json(ok(null, '字典项更新成功'));
  } catch (error) { next(error); }
});

router.patch('/:code/items/:id/status', async (req, res, next) => {
  try {
    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') return void res.status(400).json({ code: 400, message: '状态参数不正确' });
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE sys_dictionary_item i JOIN sys_dictionary d ON d.id=i.dictionary_id SET i.status=?
       WHERE d.dictionary_code=? AND i.id=? AND d.is_deleted=0 AND i.is_deleted=0`,
      [enabled ? 'ENABLED' : 'DISABLED', req.params.code, req.params.id],
    );
    if (!result.affectedRows) return void res.status(404).json({ code: 404, message: '字典项不存在' });
    await pool.execute(`UPDATE sys_dictionary SET updated_by=?,updated_at=CURRENT_TIMESTAMP(3) WHERE dictionary_code=? AND is_deleted=0`, [req.auth!.userId, req.params.code]);
    res.json(ok(null, enabled ? '字典项已启用' : '字典项已停用'));
  } catch (error) { next(error); }
});

router.delete('/:code/items/:id', async (req, res, next) => {
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE i FROM sys_dictionary_item i JOIN sys_dictionary d ON d.id=i.dictionary_id
       WHERE d.dictionary_code=? AND i.id=? AND d.is_deleted=0 AND i.is_deleted=0`, [req.params.code, req.params.id],
    );
    if (!result.affectedRows) return void res.status(404).json({ code: 404, message: '字典项不存在' });
    await pool.execute(`UPDATE sys_dictionary SET updated_by=?,updated_at=CURRENT_TIMESTAMP(3) WHERE dictionary_code=? AND is_deleted=0`, [req.auth!.userId, req.params.code]);
    res.json(ok(null, '字典项删除成功'));
  } catch (error) { next(error); }
});

router.get('/:code', async (req, res, next) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(`${dictionarySelect} WHERE d.dictionary_code=? AND d.is_deleted=0`, [req.params.code]);
    if (!rows.length) return void res.status(404).json({ code: 404, message: '字典不存在' });
    res.json(ok(dictionaryDto(rows[0]!)));
  } catch (error) { next(error); }
});

router.put('/:code', async (req, res, next) => {
  const input = validateDictionary({ ...(req.body ?? {}), code: req.params.code });
  if (typeof input === 'string') return void res.status(400).json({ code: 400, message: input });
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE sys_dictionary SET dictionary_name=?,value_type=?,description=?,updated_by=?
       WHERE dictionary_code=? AND is_deleted=0`, [input.name, valueTypeToDb[input.valueType], input.remark ?? null, req.auth!.userId, req.params.code],
    );
    if (!result.affectedRows) return void res.status(404).json({ code: 404, message: '字典不存在' });
    res.json(ok(null, '字典更新成功'));
  } catch (error) { next(error); }
});

router.patch('/:code/status', async (req, res, next) => {
  try {
    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') return void res.status(400).json({ code: 400, message: '状态参数不正确' });
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE sys_dictionary SET status=?,updated_by=? WHERE dictionary_code=? AND is_deleted=0`,
      [enabled ? 'ENABLED' : 'DISABLED', req.auth!.userId, req.params.code],
    );
    if (!result.affectedRows) return void res.status(404).json({ code: 404, message: '字典不存在' });
    res.json(ok(null, enabled ? '字典已启用' : '字典已停用'));
  } catch (error) { next(error); }
});

router.delete('/:code', async (req, res, next) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id,source_type FROM sys_dictionary WHERE dictionary_code=? AND is_deleted=0`, [req.params.code],
    );
    if (!rows.length) return void res.status(404).json({ code: 404, message: '字典不存在' });
    if (rows[0]!.source_type === 'BUILTIN') return void res.status(409).json({ code: 409, message: '系统内置字典不允许删除' });
    await pool.execute(`DELETE FROM sys_dictionary WHERE id=?`, [rows[0]!.id]);
    res.json(ok(null, '字典删除成功'));
  } catch (error) { next(error); }
});

export default router;
