import { expect, test, type APIRequestContext } from '@playwright/test';

const apiBase = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:3000';
const runId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

type Envelope<T> = { code: number; message: string; data: T };

const login = async (request: APIRequestContext) => {
  const response = await request.post(`${apiBase}/api/auth/login/password`, {
    data: { account: 'admin', password: 'admin123' },
  });
  expect(response.status()).toBe(200);
  const body = await response.json() as Envelope<{ token: string; user: { name: string } }>;
  expect(body.code).toBe(200);
  expect(body.data.token.length).toBeGreaterThan(40);
  expect(body.data.user.name).toBeTruthy();
  return { Authorization: `Bearer ${body.data.token}` };
};

test.describe.serial('六模块真实 API 核心流程', () => {
  test('登录、当前用户和退出会话完整闭环', async ({ request }) => {
    const headers = await login(request);
    const me = await request.get(`${apiBase}/api/auth/me`, { headers });
    expect(me.status()).toBe(200);
    const meBody = await me.json() as Envelope<{ name: string; roles: string[] }>;
    expect(meBody.data.roles).toContain('信息科管理员');

    const logout = await request.post(`${apiBase}/api/auth/logout`, { headers });
    expect(logout.status()).toBe(200);
    expect((await logout.json() as Envelope<null>).message).toContain('退出');

    const expired = await request.get(`${apiBase}/api/auth/me`, { headers });
    expect(expired.status()).toBe(401);
    expect((await expired.json() as Envelope<null>).message).toContain('登录');
  });

  test('用户、角色与功能权限完成创建、读取、更新、启停和删除', async ({ request }) => {
    const headers = await login(request);
    const metaResponse = await request.get(`${apiBase}/api/users/meta`, { headers });
    expect(metaResponse.status()).toBe(200);
    const meta = (await metaResponse.json() as Envelope<{ departments: Array<{ value: number }>; roles: Array<{ value: string }> }>).data;
    expect(meta.departments.length).toBeGreaterThan(0);
    expect(meta.roles.some((role) => role.value === '信息科管理员')).toBe(true);

    const roleName = `自动化角色${runId}`;
    const roleCreate = await request.post(`${apiBase}/api/roles`, {
      headers,
      data: { name: roleName, description: '核心流程自动化测试角色', dataRange: '本科室智能体', departmentIds: [], agentIds: [], status: '启用' },
    });
    expect(roleCreate.status()).toBe(201);
    const roleId = (await roleCreate.json() as Envelope<{ id: string }>).data.id;
    expect(roleId).toMatch(/^\d+$/);

    const permissionSave = await request.put(`${apiBase}/api/permissions/roles/${roleId}`, {
      headers,
      data: { permissionCodes: [] },
    });
    expect(permissionSave.status()).toBe(200);
    expect((await permissionSave.json() as Envelope<{ count: number }>).data.count).toBe(0);

    const roleUpdate = await request.put(`${apiBase}/api/roles/${roleId}`, {
      headers,
      data: { name: `${roleName}已更新`, description: '更新后的自动化角色说明', dataRange: '全院智能体', departmentIds: [], agentIds: [], status: '启用' },
    });
    expect(roleUpdate.status()).toBe(200);
    const roleDetail = await request.get(`${apiBase}/api/roles/${roleId}`, { headers });
    expect(roleDetail.status()).toBe(200);
    expect((await roleDetail.json() as Envelope<{ name: string; dataRange: string }>).data).toMatchObject({ name: `${roleName}已更新`, dataRange: '全院智能体' });

    const employeeId = `AT${runId}`;
    const phone = `139${runId.slice(-8)}`;
    const userCreate = await request.post(`${apiBase}/api/users`, {
      headers,
      data: { name: '测试用户', employeeId, departmentId: meta.departments[0]!.value, phone, roles: [`${roleName}已更新`], status: '正常' },
    });
    expect(userCreate.status()).toBe(201);
    const createdUser = (await userCreate.json() as Envelope<{ id: number; initialPassword: string }>).data;
    expect(createdUser.initialPassword).toContain(employeeId);

    const userList = await request.get(`${apiBase}/api/users?current=1&pageSize=100`, { headers });
    expect(userList.status()).toBe(200);
    const users = (await userList.json() as Envelope<{ list: Array<{ id: string; employeeId: string }> }>).data.list;
    const user = users.find((item) => item.employeeId === employeeId);
    expect(user).toBeDefined();

    const userUpdate = await request.put(`${apiBase}/api/users/${user!.id}`, {
      headers,
      data: { name: '测试人员', employeeId, departmentId: meta.departments[0]!.value, phone, roles: [`${roleName}已更新`], password: 'Changed123!' },
    });
    expect(userUpdate.status()).toBe(200);

    const disable = await request.patch(`${apiBase}/api/users/${user!.id}/status`, { headers, data: { status: '停用' } });
    expect(disable.status()).toBe(200);
    const disabledDetail = await request.get(`${apiBase}/api/users/${user!.id}`, { headers });
    expect((await disabledDetail.json() as Envelope<{ status: string }>).data.status).toBe('停用');

    const removeUser = await request.delete(`${apiBase}/api/users/${user!.id}`, { headers });
    expect(removeUser.status()).toBe(200);
    expect((await request.get(`${apiBase}/api/users/${user!.id}`, { headers })).status()).toBe(404);

    const removeRole = await request.delete(`${apiBase}/api/roles/${roleId}`, { headers });
    expect(removeRole.status()).toBe(200);
    expect((await request.get(`${apiBase}/api/roles/${roleId}`, { headers })).status()).toBe(404);
  });

  test('审计日志支持元数据、列表、详情、刷新和选择导出', async ({ request }) => {
    const headers = await login(request);
    const meta = await request.get(`${apiBase}/api/audit/operation-logs/meta`, { headers });
    expect(meta.status()).toBe(200);
    const metaData = (await meta.json() as Envelope<{ modules: unknown[]; types: unknown[] }>).data;
    expect(Array.isArray(metaData.modules)).toBe(true);
    expect(Array.isArray(metaData.types)).toBe(true);

    const list = await request.get(`${apiBase}/api/audit/operation-logs?current=1&pageSize=20`, { headers });
    expect(list.status()).toBe(200);
    const listData = (await list.json() as Envelope<{ list: Array<{ key: string; resultCode: string }>; pagination: { total: number } }>).data;
    expect(listData.pagination.total).toBeGreaterThan(0);
    expect(listData.list.length).toBeGreaterThan(0);
    expect(['SUCCESS', 'FAILED']).toContain(listData.list[0]!.resultCode);

    const detail = await request.get(`${apiBase}/api/audit/operation-logs/${listData.list[0]!.key}`, { headers });
    expect(detail.status()).toBe(200);
    expect((await detail.json() as Envelope<{ key: string }>).data.key).toBe(listData.list[0]!.key);

    const refresh = await request.post(`${apiBase}/api/audit/operation-logs/events/refresh`, { headers, data: {} });
    expect(refresh.status()).toBe(200);
    expect((await refresh.json() as Envelope<null>).message).toBe('刷新成功');

    const exported = await request.post(`${apiBase}/api/audit/operation-logs/export`, { headers, data: { ids: [listData.list[0]!.key] } });
    expect(exported.status()).toBe(200);
    expect(exported.headers()['content-type']).toContain('text/csv');
    const csv = await exported.text();
    expect(csv).toContain('用户名称');
    expect(csv.split('\n').length).toBeGreaterThanOrEqual(2);
  });

  test('系统配置完成字典、字典项和模型配置 CRUD', async ({ request }) => {
    const headers = await login(request);
    const code = `autotest_${runId}`;
    const dictionaryCreate = await request.post(`${apiBase}/api/system-config/dictionaries`, {
      headers,
      data: { code, name: `自动化字典${runId}`, valueType: '字符串', remark: '自动化测试创建' },
    });
    expect(dictionaryCreate.status()).toBe(201);

    const dictionaryDetail = await request.get(`${apiBase}/api/system-config/dictionaries/${code}`, { headers });
    expect(dictionaryDetail.status()).toBe(200);
    expect((await dictionaryDetail.json() as Envelope<{ code: string; enabled: boolean }>).data).toMatchObject({ code, enabled: true });

    const dictionaryUpdate = await request.put(`${apiBase}/api/system-config/dictionaries/${code}`, {
      headers,
      data: { name: `自动化字典已更新${runId}`, valueType: '整数', remark: '已更新' },
    });
    expect(dictionaryUpdate.status()).toBe(200);

    const itemCreate = await request.post(`${apiBase}/api/system-config/dictionaries/${code}/items`, {
      headers,
      data: { code: 'item_one', name: '测试字典项', sortNo: 10, remark: '自动化测试' },
    });
    expect(itemCreate.status()).toBe(201);
    const itemId = (await itemCreate.json() as Envelope<{ id: string }>).data.id;
    const itemUpdate = await request.put(`${apiBase}/api/system-config/dictionaries/${code}/items/${itemId}`, {
      headers,
      data: { code: 'item_one', name: '测试字典项已更新', sortNo: 20, remark: '已更新' },
    });
    expect(itemUpdate.status()).toBe(200);
    const itemDisable = await request.patch(`${apiBase}/api/system-config/dictionaries/${code}/items/${itemId}/status`, { headers, data: { enabled: false } });
    expect(itemDisable.status()).toBe(200);
    const itemDetail = await request.get(`${apiBase}/api/system-config/dictionaries/${code}/items/${itemId}`, { headers });
    expect((await itemDetail.json() as Envelope<{ name: string; enabled: boolean }>).data).toMatchObject({ name: '测试字典项已更新', enabled: false });

    const dictionaryExport = await request.get(`${apiBase}/api/system-config/dictionaries/export.xlsx?keyword=${code}`, { headers });
    expect(dictionaryExport.status()).toBe(200);
    expect(dictionaryExport.headers()['content-type']).toContain('spreadsheetml');
    expect((await dictionaryExport.body()).byteLength).toBeGreaterThan(1000);

    expect((await request.delete(`${apiBase}/api/system-config/dictionaries/${code}/items/${itemId}`, { headers })).status()).toBe(200);
    expect((await request.delete(`${apiBase}/api/system-config/dictionaries/${code}`, { headers })).status()).toBe(200);
    expect((await request.get(`${apiBase}/api/system-config/dictionaries/${code}`, { headers })).status()).toBe(404);

    const modelName = `自动化模型${runId}`;
    const modelPayload = { name: modelName, version: '1.0', deployment: '本地化部署', apiUrl: `${apiBase}/api`, apiKey: `sk-test-${runId}`, provider: '', phone: '', remark: '自动化测试' };
    const modelCreate = await request.post(`${apiBase}/api/system-config/models`, { headers, data: modelPayload });
    expect(modelCreate.status()).toBe(201);
    const models = await request.get(`${apiBase}/api/system-config/models?current=1&pageSize=100`, { headers });
    const model = (await models.json() as Envelope<{ list: Array<{ id: string; name: string; apiKey: string }> }>).data.list.find((item) => item.name === modelName);
    expect(model).toBeDefined();
    expect(model!.apiKey).not.toContain(`sk-test-${runId}`);
    expect(model!.apiKey).toContain(runId.slice(-4));

    const modelUpdate = await request.put(`${apiBase}/api/system-config/models/${model!.id}`, { headers, data: { ...modelPayload, name: `${modelName}已更新`, apiKey: model!.apiKey } });
    expect(modelUpdate.status()).toBe(200);
    const updatedModel = await request.get(`${apiBase}/api/system-config/models/${model!.id}`, { headers });
    expect((await updatedModel.json() as Envelope<{ name: string; apiKey: string }>).data.name).toBe(`${modelName}已更新`);
    expect((await request.delete(`${apiBase}/api/system-config/models/${model!.id}`, { headers })).status()).toBe(200);
    expect((await request.get(`${apiBase}/api/system-config/models/${model!.id}`, { headers })).status()).toBe(404);
  });

  test('智能体接入草稿 CRUD、真实连通测试和插桩配置签发', async ({ request }) => {
    const headers = await login(request);
    const meta = await request.get(`${apiBase}/api/agent-access/meta`, { headers });
    expect(meta.status()).toBe(200);
    const departments = (await meta.json() as Envelope<{ departments: Array<{ label: string }> }>).data.departments;
    expect(departments.length).toBeGreaterThan(0);

    const connection = await request.post(`${apiBase}/api/agent-access/connection-test`, {
      headers,
      data: { accessMode: 'API', apiEndpoint: `${apiBase}/api/health`, apiKey: `sk-test-${runId}` },
    });
    expect(connection.status()).toBe(200);
    const connectionResult = (await connection.json() as Envelope<{ ok: boolean; httpStatus: number; stages: Array<{ status: string }> }>).data;
    expect(connectionResult.ok).toBe(true);
    expect(connectionResult.httpStatus).toBe(200);
    expect(connectionResult.stages.every((stage) => stage.status === 'ok')).toBe(true);

    const issued = await request.post(`${apiBase}/api/agent-access/instrumentation/issue`, {
      headers,
      data: { accessMode: 'SDK', agentCode: `AUTO-${runId}` },
    });
    expect(issued.status()).toBe(200);
    const issuedData = (await issued.json() as Envelope<{ platformUrl: string; platformKey: string; instrumentationCode: string }>).data;
    expect(issuedData.platformUrl).toContain('/api/health');
    expect(issuedData.platformKey).toMatch(/^sk-sdk-/);
    expect(issuedData.instrumentationCode).toContain(issuedData.platformKey);

    const draftPayload = {
      name: `测智${runId.slice(-6)}`,
      version: '1.0', department: departments[0]!.label, clinicalStage: '辅助诊断', source: '自研', supplier: '',
      type: '辅助诊断', description: '自动化测试智能体接入草稿', contactName: '测试员', contactPhone: '13800138000',
      accessMode: 'API', apiEndpoint: `${apiBase}/api/health`, apiKey: `sk-test-${runId}`, connectionTested: true, connectionStatus: 'success', attachments: [],
    };
    const save = await request.post(`${apiBase}/api/agent-access/applications/save`, { headers, data: draftPayload });
    expect(save.status()).toBe(200);
    const draft = (await save.json() as Envelope<{ id: string; name: string; status: string }>).data;
    expect(draft.id).toMatch(/^\d+$/);
    expect(draft.status).toBe('草稿');

    const edit = await request.post(`${apiBase}/api/agent-access/applications/save`, { headers, data: { ...draftPayload, id: draft.id, description: '自动化测试更新后的描述' } });
    expect(edit.status()).toBe(200);
    const detail = await request.get(`${apiBase}/api/agent-access/applications/${draft.id}`, { headers });
    expect(detail.status()).toBe(200);
    expect((await detail.json() as Envelope<{ description: string }>).data.description).toBe('自动化测试更新后的描述');

    const remove = await request.delete(`${apiBase}/api/agent-access/applications/${draft.id}`, { headers });
    expect(remove.status()).toBe(200);
    expect((await request.get(`${apiBase}/api/agent-access/applications/${draft.id}`, { headers })).status()).toBe(404);
  });

  test('统一台账总览、筛选列表和无效状态操作', async ({ request }) => {
    const headers = await login(request);
    const overview = await request.get(`${apiBase}/api/ledger/overview`, { headers });
    expect(overview.status()).toBe(200);
    const overviewData = (await overview.json() as Envelope<{ coverage: { covered: number; total: number; rate: number }; online: { online: number; total: number; rate: number } }>).data;
    expect(overviewData.coverage.covered).toBeGreaterThanOrEqual(0);
    expect(overviewData.coverage.total).toBeGreaterThanOrEqual(overviewData.coverage.covered);
    expect(overviewData.coverage.rate).toBeGreaterThanOrEqual(0);
    expect(overviewData.online.rate).toBeLessThanOrEqual(1);

    const list = await request.get(`${apiBase}/api/ledger/agents?page=1&pageSize=20`, { headers });
    expect(list.status()).toBe(200);
    const listData = (await list.json() as Envelope<{ items: unknown[]; page: number; pageSize: number; total: number; isPlatformAdmin: boolean }>).data;
    expect(listData.page).toBe(1);
    expect(listData.pageSize).toBe(20);
    expect(listData.total).toBeGreaterThanOrEqual(listData.items.length);
    expect(listData.isPlatformAdmin).toBe(true);

    const invalidStatus = await request.patch(`${apiBase}/api/ledger/agents/999999999/status`, { headers, data: { action: 'invalid' } });
    expect(invalidStatus.status()).toBe(400);
    expect((await invalidStatus.json() as Envelope<null>).message).toContain('状态操作');

    const anonymous = await request.get(`${apiBase}/api/ledger/overview`);
    expect(anonymous.status()).toBe(401);
  });
});
