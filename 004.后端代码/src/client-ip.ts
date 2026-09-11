/** 将 Express/代理返回的 IP 规范成审计页面易读的形式。 */
export const normalizeClientIp = (value: unknown): string | null => {
  const ip = String(value ?? '').trim();
  if (!ip) return null;
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return '127.0.0.1';
  if (ip.toLowerCase().startsWith('::ffff:')) return ip.slice(7);
  return ip;
};
