# 后端测试工程说明

## 目录职责

- `setup/vitest.setup.ts`：设置测试运行环境并清理测试级变量。
- `support/database.ts`：数据库安全护栏，要求显式使用名称含 `test` 的测试库。
- `support/http.ts`：导出 Supertest API 客户端和 Bearer Header 辅助方法。
- `unit/framework.test.ts`：测试工程冒烟，验证数据库误用保护。
- `api/auth.test.ts`：密码/短信登录、会话、锁定和退出 API 测试入口。
- `api/user-center.test.ts`：用户、角色、权限、启停和导出 API 测试入口。
- `api/audit-center.test.ts`：操作日志查询、导出、刷新和脱敏测试入口。
- `api/system-config.test.ts`：字典、Excel、模型密钥和连接安全测试入口。
- `api/agent-access.test.ts`：接入申请、文件、连通测试、审核状态机入口。
- `api/ledger.test.ts`：台账统计、列表、数据范围和启停测试入口。
- `integration/access-ledger.test.ts`：接入审核同步台账的跨表事务与并发测试入口。

业务测试当前使用 `todo` 标记，表示工程和范围已建立、具体断言尚未实施，不会把空测试误报为通过。集成测试默认不包含在普通 `npm test` 中，避免意外连接数据库。

## 命令

- `npm test`：单次执行单元和 API 测试，不连接集成测试库。
- `npm run test:watch`：监听模式。
- `npm run test:coverage`：生成覆盖率与 JUnit/JSON 报告。
- `npm run test:unit`：仅执行单元测试。
- `npm run test:api`：仅执行 API 测试。
- `TEST_DB_NAME=med_agent_platform_test npm run test:integration`：显式运行数据库集成测试。

数据库集成测试使用独立配置 `vitest.integration.config.ts`，采用单进程串行执行并输出独立报告；在具体用例实现前，必须补齐 `TEST_DB_HOST/PORT/USER/PASSWORD/NAME`，且数据库名必须包含 `test`。

报告统一写入 `../005.项目测试/测试报告/后端/`。
