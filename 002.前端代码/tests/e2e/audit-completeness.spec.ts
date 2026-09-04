import { expect, test, type APIRequestContext } from '@playwright/test';

const apiBase = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:3000';
const runId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
type Envelope<T> = { code: number; message: string; data: T };

const passwordLogin = async (request: APIRequestContext, account: string, password: string) => {
  const response = await request.post(`${apiBase}/api/auth/login/password`, { data: { account, password } });
  expect(response.status()).toBe(200);
  const body = await response.json() as Envelope<{ token: string }>;
  expect(body.data.token.length).toBeGreaterThan(40);
  return { Authorization: `Bearer ${body.data.token}` };
};

test('医院领导和科室管理员的关键业务操作均可在操作日志中按本人检索', async ({ request }) => {
  const adminHeaders = await passwordLogin(request, 'admin', 'admin123');
  const metaResponse = await request.get(`${apiBase}/api/users/meta`, { headers: adminHeaders });
  expect(metaResponse.status()).toBe(200);
  const meta = (await metaResponse.json() as Envelope<{ departments: Array<{ value: number }>; roles: Array<{ value: string }> }>).data;
  expect(meta.departments.length).toBeGreaterThan(0);
  expect(meta.roles.map((role) => role.value)).toEqual(expect.arrayContaining(['医院领导', '科室管理员']));

  const users = [
    { name: '测试领导', employeeId: `LD${runId}`, phone: `137${runId.slice(-8)}`, role: '医院领导' },
    { name: '测试科管', employeeId: `KG${runId}`, phone: `136${runId.slice(-8)}`, role: '科室管理员' },
  ];
  const created: Array<{ numericId: number; uuid: string; name: string; employeeId: string; password: string; role: string }> = [];

  try {
    for (const candidate of users) {
      const create = await request.post(`${apiBase}/api/users`, {
        headers: adminHeaders,
        data: { ...candidate, departmentId: meta.departments[0]!.value, roles: [candidate.role], status: '正常' },
      });
      expect(create.status()).toBe(201);
      const result = (await create.json() as Envelope<{ id: number; initialPassword: string }>).data;
      expect(result.initialPassword).toContain(candidate.employeeId);

      const list = await request.get(`${apiBase}/api/users?current=1&pageSize=100`, { headers: adminHeaders });
      expect(list.status()).toBe(200);
      const uuid = (await list.json() as Envelope<{ list: Array<{ id: string; employeeId: string }> }>).data.list.find((item) => item.employeeId === candidate.employeeId)?.id;
      expect(uuid).toBeDefined();
      created.push({ numericId: result.id, uuid: uuid!, name: candidate.name, employeeId: candidate.employeeId, password: result.initialPassword, role: candidate.role });
    }

    for (const user of created) {
      const headers = await passwordLogin(request, user.employeeId, user.password);
      const accessList = await request.get(`${apiBase}/api/agent-access/applications`, { headers });
      expect(accessList.status()).toBe(200);
      const ledgerOverview = await request.get(`${apiBase}/api/ledger/overview`, { headers });
      expect(ledgerOverview.status()).toBe(200);
      const ledgerList = await request.get(`${apiBase}/api/ledger/agents?page=1&pageSize=10`, { headers });
      expect(ledgerList.status()).toBe(200);
      const logout = await request.post(`${apiBase}/api/auth/logout`, { headers });
      expect(logout.status()).toBe(200);

      let rows: Array<{ module: string; user: string; role: string; path: string }> = [];
      await expect.poll(async () => {
        const logs = await request.get(`${apiBase}/api/audit/operation-logs?userId=${user.numericId}&current=1&pageSize=100`, { headers: adminHeaders });
        expect(logs.status()).toBe(200);
        rows = (await logs.json() as Envelope<{ list: Array<{ module: string; user: string; role: string; path: string }> }>).data.list;
        return rows.length;
      }, { timeout: 5_000 }).toBeGreaterThan(0);
      expect(rows.every((row) => row.user === user.name)).toBe(true);
      expect(rows.some((row) => row.role === user.role)).toBe(true);
      expect([...new Set(rows.map((row) => row.module))]).toEqual(expect.arrayContaining(['智能体接入中心', '统一台账中心', '用户中心']));
    }
  } finally {
    for (const user of created) {
      await request.patch(`${apiBase}/api/users/${user.uuid}/status`, { headers: adminHeaders, data: { status: '停用' } });
      await request.delete(`${apiBase}/api/users/${user.uuid}`, { headers: adminHeaders });
    }
  }
});

test('同一用户毫秒级重复查看只生成一条操作日志', async ({ request }) => {
  const adminHeaders = await passwordLogin(request, 'admin', 'admin123');
  const me = await request.get(`${apiBase}/api/auth/me`, { headers: adminHeaders });
  expect(me.status()).toBe(200);

  const users = await request.get(`${apiBase}/api/audit/operation-logs/user-options?keyword=admin`, { headers: adminHeaders });
  expect(users.status()).toBe(200);
  const adminOption = (await users.json() as Envelope<Array<{ value: string; label: string }>>).data.find((option) => option.label.includes('admin'));
  expect(adminOption).toBeDefined();

  const matchingLogs = async () => {
    const response = await request.get(`${apiBase}/api/audit/operation-logs?userId=${adminOption!.value}&current=1&pageSize=100`, { headers: adminHeaders });
    expect(response.status()).toBe(200);
    return (await response.json() as Envelope<{ list: Array<{ path: string; module: string; type: string }> }>).data.list
      .filter((row) => row.path === '/api/ledger/overview' && row.module === '统一台账中心' && row.type === '查看').length;
  };

  const before = await matchingLogs();
  const responses = await Promise.all([
    request.get(`${apiBase}/api/ledger/overview`, { headers: adminHeaders }),
    request.get(`${apiBase}/api/ledger/overview`, { headers: adminHeaders }),
  ]);
  expect(responses.map((response) => response.status())).toEqual([200, 200]);

  await expect.poll(async () => (await matchingLogs()) - before, { timeout: 5_000 }).toBe(1);
});
