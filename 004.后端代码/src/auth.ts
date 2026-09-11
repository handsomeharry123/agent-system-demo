import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { RowDataPacket } from 'mysql2';
import { config } from './config.js';
import { pool } from './db.js';
import { normalizeClientIp } from './client-ip.js';

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
export const smsDigest = (phone: string, code: string) => sha256(`${phone}:${code}:${config.smsPepper}`);

export const createSession = async (userId: number, request: Parameters<RequestHandler>[0]) => {
  const sessionUuid = randomUUID();
  const nonce = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const token = jwt.sign(
    { sub: String(userId), sid: sessionUuid, nonce },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'] },
  );
  await pool.execute(
    `INSERT INTO iam_login_session
      (session_uuid, user_id, access_token_hash, client_type, ip_address, user_agent, expires_at)
     VALUES (?, ?, ?, 'WEB', ?, ?, ?)`,
    [sessionUuid, userId, sha256(token), normalizeClientIp(request.ip), request.get('user-agent') ?? null, expiresAt],
  );
  return { token, expiresAt };
};

declare global {
  namespace Express {
    interface Request { auth?: { userId: number; sessionUuid: string; token: string } }
  }
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return void res.status(401).json({ code: 401, message: '请先登录' });
    const payload = jwt.verify(token, config.jwtSecret);
    if (typeof payload === 'string' || !payload.sub || typeof payload.sid !== 'string') {
      return void res.status(401).json({ code: 401, message: '登录凭证无效' });
    }
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM iam_login_session
       WHERE session_uuid = ? AND user_id = ? AND access_token_hash = ?
         AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP(3)`,
      [payload.sid, Number(payload.sub), sha256(token)],
    );
    if (!rows.length) return void res.status(401).json({ code: 401, message: '登录已过期，请重新登录' });
    req.auth = { userId: Number(payload.sub), sessionUuid: payload.sid, token };
    next();
  } catch {
    res.status(401).json({ code: 401, message: '登录已过期，请重新登录' });
  }
};
