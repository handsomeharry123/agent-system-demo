import { randomInt } from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { config } from '../config.js';
import { createSession, requireAuth, sha256, smsDigest } from '../auth.js';
import { pool } from '../db.js';
import { getUser, getUserPermissionCodes, toFrontendUser } from '../user.js';
import { normalizeClientIp } from '../client-ip.js';

const router = Router();
const response = (data: unknown, message = 'success') => ({ code: 200, message, data, timestamp: new Date().toISOString() });
const logLogin = async (userId: number | null, identifier: string, authType: 'PASSWORD' | 'SMS', result: string, reason: string | null, req: Parameters<typeof createSession>[1]) => {
  await pool.execute(
    `INSERT INTO iam_login_log (user_id, login_identifier, auth_type, result, failure_reason, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, identifier, authType, result, reason, normalizeClientIp(req.ip), req.get('user-agent') ?? null],
  );
};

router.post('/login/password', async (req, res, next) => {
  try {
    const account = String(req.body?.account ?? '').trim();
    const password = String(req.body?.password ?? '');
    if (!account || !password) return void res.status(400).json({ code: 400, message: '请输入账号和密码' });
    const user = await getUser(`u.is_deleted = 0 AND (u.login_name = ? OR u.employee_no = ? OR u.phone = ? OR u.real_name = ?)`, [account, account, account, account]);
    if (!user) {
      await logLogin(null, account, 'PASSWORD', 'FAILED', '账号或密码错误', req);
      return void res.status(401).json({ code: 401, message: '账号或密码错误' });
    }
    if (user.account_status !== 'ACTIVE') {
      const result = user.account_status === 'LOCKED' ? 'LOCKED' : 'DISABLED';
      await logLogin(user.id, account, 'PASSWORD', result, '账号状态不允许登录', req);
      return void res.status(403).json({ code: 403, message: result === 'LOCKED' ? '账号已锁定' : '账号已停用或未激活' });
    }
    if (!['PASSWORD', 'BOTH'].includes(user.auth_mode)) return void res.status(403).json({ code: 403, message: '该账号未启用密码登录' });

    const [credentials] = await pool.execute<RowDataPacket[]>(`SELECT * FROM iam_user_password WHERE user_id = ? LIMIT 1`, [user.id]);
    const credential = credentials[0];
    if (credential?.locked_until && new Date(credential.locked_until).getTime() > Date.now()) {
      await logLogin(user.id, account, 'PASSWORD', 'LOCKED', '连续失败次数过多', req);
      return void res.status(423).json({ code: 423, message: '账号暂时锁定，请稍后再试', data: { lockedUntil: credential.locked_until } });
    }
    const valid = credential && credential.password_algorithm === 'BCRYPT' && await bcrypt.compare(password, credential.password_hash);
    if (!valid) {
      const attempts = Math.min(Number(credential?.failed_attempts ?? 0) + 1, 5);
      const locked = attempts >= 5;
      if (credential) await pool.execute(
        `UPDATE iam_user_password SET failed_attempts = ?, captcha_required = ?, locked_until = ? WHERE user_id = ?`,
        [attempts, attempts >= 3, locked ? new Date(Date.now() + 30 * 60 * 1000) : null, user.id],
      );
      await logLogin(user.id, account, 'PASSWORD', locked ? 'LOCKED' : 'FAILED', '账号或密码错误', req);
      return void res.status(401).json({ code: 401, message: locked ? '连续错误5次，账号锁定30分钟' : '账号或密码错误', data: { failedAttempts: attempts, captchaRequired: attempts >= 3 } });
    }
    await pool.execute(`UPDATE iam_user_password SET failed_attempts = 0, captcha_required = 0, locked_until = NULL WHERE user_id = ?`, [user.id]);
    await pool.execute(`UPDATE iam_user SET last_login_at = CURRENT_TIMESTAMP(3), last_login_ip = ? WHERE id = ?`, [normalizeClientIp(req.ip), user.id]);
    await logLogin(user.id, account, 'PASSWORD', 'SUCCESS', null, req);
    const session = await createSession(user.id, req);
    const refreshed = await getUser('u.id = ?', [user.id]);
    const permissionCodes = await getUserPermissionCodes(user.id);
    res.json(response({ token: session.token, expiresAt: session.expiresAt.toISOString(), user: toFrontendUser(refreshed!, permissionCodes) }, '登录成功'));
  } catch (error) { next(error); }
});

router.post('/sms/send', async (req, res, next) => {
  try {
    const phone = String(req.body?.phone ?? '').trim();
    if (!/^1[3-9]\d{9}$/.test(phone)) return void res.status(400).json({ code: 400, message: '手机号格式错误' });
    const user = await getUser('u.is_deleted = 0 AND u.phone = ?', [phone]);
    if (!user || user.account_status !== 'ACTIVE' || !['SMS', 'BOTH'].includes(user.auth_mode)) {
      return void res.status(404).json({ code: 404, message: '该手机号未绑定可登录账号' });
    }
    const [recent] = await pool.execute<RowDataPacket[]>(`SELECT id FROM iam_sms_verification_code WHERE phone = ? AND purpose = 'LOGIN' AND created_at > DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 60 SECOND) LIMIT 1`, [phone]);
    if (recent.length) return void res.status(429).json({ code: 429, message: '验证码发送过于频繁，请稍后再试' });
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await pool.execute(`INSERT INTO iam_sms_verification_code (phone, purpose, code_digest, expires_at, request_ip) VALUES (?, 'LOGIN', ?, DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 5 MINUTE), ?)`, [phone, smsDigest(phone, code), normalizeClientIp(req.ip)]);
    res.json(response({ expiresIn: 300, ...(config.nodeEnv === 'development' ? { developmentCode: code } : {}) }, '验证码已发送'));
  } catch (error) { next(error); }
});

router.post('/login/sms', async (req, res, next) => {
  try {
    const phone = String(req.body?.phone ?? '').trim();
    const code = String(req.body?.verificationCode ?? '').trim();
    if (!/^1[3-9]\d{9}$/.test(phone) || !/^\d{6}$/.test(code)) return void res.status(400).json({ code: 400, message: '手机号或验证码格式错误' });
    const user = await getUser('u.is_deleted = 0 AND u.phone = ?', [phone]);
    if (!user || user.account_status !== 'ACTIVE') return void res.status(401).json({ code: 401, message: '手机号或验证码错误' });
    const [codes] = await pool.execute<RowDataPacket[]>(`SELECT * FROM iam_sms_verification_code WHERE phone = ? AND purpose = 'LOGIN' AND consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP(3) ORDER BY id DESC LIMIT 1`, [phone]);
    const record = codes[0];
    if (!record || record.verify_attempts >= 5 || record.code_digest !== smsDigest(phone, code)) {
      if (record) await pool.execute(`UPDATE iam_sms_verification_code SET verify_attempts = LEAST(verify_attempts + 1, 5) WHERE id = ?`, [record.id]);
      await logLogin(user.id, phone, 'SMS', 'FAILED', '验证码错误或已过期', req);
      return void res.status(401).json({ code: 401, message: '手机号或验证码错误' });
    }
    await pool.execute(`UPDATE iam_sms_verification_code SET consumed_at = CURRENT_TIMESTAMP(3) WHERE id = ?`, [record.id]);
    await pool.execute(`UPDATE iam_user SET last_login_at = CURRENT_TIMESTAMP(3), last_login_ip = ? WHERE id = ?`, [normalizeClientIp(req.ip), user.id]);
    await logLogin(user.id, phone, 'SMS', 'SUCCESS', null, req);
    const session = await createSession(user.id, req);
    const refreshed = await getUser('u.id = ?', [user.id]);
    const permissionCodes = await getUserPermissionCodes(user.id);
    res.json(response({ token: session.token, expiresAt: session.expiresAt.toISOString(), user: toFrontendUser(refreshed!, permissionCodes) }, '登录成功'));
  } catch (error) { next(error); }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await getUser('u.id = ? AND u.is_deleted = 0 AND u.account_status = \'ACTIVE\'', [req.auth!.userId]);
    if (!user) return void res.status(401).json({ code: 401, message: '用户不存在或已停用' });
    const permissionCodes = await getUserPermissionCodes(user.id);
    res.json(response(toFrontendUser(user, permissionCodes)));
  } catch (error) { next(error); }
});

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await pool.execute(`UPDATE iam_login_session SET revoked_at = CURRENT_TIMESTAMP(3), revoke_reason = '用户主动退出' WHERE session_uuid = ?`, [req.auth!.sessionUuid]);
    res.json(response(null, '已退出登录'));
  } catch (error) { next(error); }
});

export default router;
