# 前端测试工程说明

## 目录职责

- `setup/vitest.setup.ts`：注册 jest-dom、MSW、DOM 清理、存储清理和浏览器 API 补丁。
- `support/mockServer.ts`：集中管理 MSW 测试服务，未声明的 API 请求直接报错。
- `support/render.tsx`：为组件测试提供 Ant Design 和内存路由上下文。
- `unit/framework.test.ts`：测试框架冒烟，确认 jsdom 与浏览器存储可用。
- `component/auth.test.tsx`：登录、退出、会话恢复和保护路由测试入口。
- `component/user-center.test.tsx`：用户、角色、数据范围、功能权限测试入口。
- `component/audit-center.test.tsx`：审计日志筛选、详情、刷新、导出测试入口。
- `component/system-config.test.tsx`：数据字典、模型配置和连接测试入口。
- `component/agent-access.test.tsx`：智能体接入表单、文件、状态机和审核入口。
- `component/ledger.test.tsx`：台账总览、列表、详情和启停入口。
- `e2e/auth-ui.spec.ts`：真实浏览器登录、会话恢复、退出和保护路由测试。
- `e2e/core-api.spec.ts`：六模块真实 API 核心流程，覆盖安全可清理的 CRUD、导出、连通性和权限断言。
- `e2e/audit-completeness.spec.ts`：创建医院领导与科室管理员并回查本人日志，同时验证毫秒级重复查看只生成一条审计记录。

组件层业务文件仍保留 `todo` 作为下一阶段入口；核心业务已优先落在真实浏览器与真实 API 的 E2E 测试中。Playwright 失败时自动保留截图、视频、Trace 和错误上下文。

## 命令

- `npm test`：单次执行单元与组件测试。
- `npm run test:watch`：监听模式。
- `npm run test:coverage`：生成覆盖率与 JUnit/JSON 报告。
- `npm run test:e2e`：运行 Chromium E2E；默认联合启动前后端。
- `E2E_SKIP_WEBSERVER=1 npm run test:e2e`：复用手工启动的服务。
- `npm run test:all`：依次执行覆盖率和 E2E。

报告统一写入 `../005.项目测试/测试报告/前端/`。
