# 医疗智能体管理平台后端（登录模块）

## 启动

日常本地开发可在项目根目录一次启动前后端：

```bash
npm run dev:all
```

首次运行前需完成下面的环境变量和初始化步骤。

```bash
cd 004.后端代码
cp .env.example .env
# 修改 .env 中的数据库密码、JWT_SECRET、SMS_PEPPER
npm install
npm run seed:admin
npm run seed:role-policies
npm run seed:permissions
npm run dev
```

开发管理员账号默认是 `admin / admin123`。可在执行初始化脚本前通过
`ADMIN_INITIAL_PASSWORD` 指定其他初始密码。生产环境必须更换初始密码和所有密钥。

## 接口

- `POST /api/auth/login/password`：账号密码登录
- `POST /api/auth/sms/send`：发送登录验证码
- `POST /api/auth/login/sms`：短信验证码登录
- `GET /api/auth/me`：获取当前用户
- `POST /api/auth/logout`：退出并撤销会话
- `GET /api/health`：健康检查

### 用户中心（需要信息科管理员权限）

- `GET /api/users`：用户列表分页及组织、角色、帐号状态筛选
- `GET /api/users/meta`：用户列表筛选项
- `GET /api/users/:id`：用户详情
- `POST /api/users`：新增用户并生成 bcrypt 初始密码
- `PUT /api/users/:id`：编辑用户基础信息和角色
- `PATCH /api/users/:id/status`：停用或恢复单个帐号
- `DELETE /api/users/:id`：删除已停用用户，并解除角色和用户级数据权限关联
- `PATCH /api/users/batch-status`：批量启用或停用帐号
- `GET /api/users/export/csv`：导出当前筛选结果

### 角色管理（需要信息科管理员权限）

- `GET /api/roles`：角色列表及关联用户、功能权限数量统计
- `GET /api/roles/meta`：可选科室和已纳管智能体
- `GET /api/roles/:id`：角色详情、数据范围明细和功能权限明细
- `POST /api/roles`：新增角色及其数据权限策略
- `PUT /api/roles/:id`：编辑角色和数据权限策略
- `DELETE /api/roles/:id`：删除角色并解除用户、权限和数据策略关联（不删除关联对象）

### 功能权限配置（需要信息科管理员权限）

- `GET /api/permissions/roles`：可配置角色列表
- `GET /api/permissions/roles/:roleId`：读取角色当前功能权限
- `PUT /api/permissions/roles/:roleId`：覆盖保存角色功能权限

`npm run seed:permissions` 会按照 PRD V1.4 初始化模块、页面、操作三级权限树，
并为医院领导、信息科管理员、科室管理员写入默认权限。该脚本可重复执行。

停用帐号时，后端会同时撤销该用户尚未失效的登录会话。新增用户的初始密码按
“用户姓名拼音小写首字母 + 用户工号”生成，仅在创建成功响应中返回一次，数据库
只保存 bcrypt 哈希。

登录失败计数、30 分钟锁定、短信验证码摘要、JWT 会话摘要以及登录审计均写入现有 MySQL 表。
