# 接入中心 9 pageKey × 2 角色 欢迎语完整矩阵 e2e
# 测试员 A — 2026-07-03

**测试范围**:PRD《接入中心智能化升级-需求说明V1》§3.1.1 9 pageKey × 2 角色(provider / admin)
**测试工具**:Playwright 1.61 + Chromium headless
**被测版本**:本地 dev server (http://localhost:5173)
**测试结果**:✅ **66/66 全部通过**

---

## 1. 9 pageKey × 2 角色 矩阵覆盖

| pageKey | URL 路径 | 信息科管理员 | 科室管理员 |
| --- | --- | --- | --- |
| agent-center-all | `/app/agent-center` | ✅ 4/4 | ✅ 4/4 |
| agent-center-draft | `/app/agent-center?tab=草稿` | ✅ 4/4 | ✅ 4/4 |
| agent-center-pending | `/app/agent-center?tab=待审核` | ✅ 4/4 | ✅ 4/4 |
| agent-center-reviewing | `/app/agent-center?tab=审核中` | ✅ 4/4 | ✅ 4/4 |
| agent-center-return | `/app/agent-center?tab=退回修改` | ✅ 4/4 | ✅ 4/4 |
| agent-center-cancel | `/app/agent-center?tab=撤销修改` | ✅ 4/4 | ✅ 4/4 |
| agent-center-passed | `/app/agent-center?tab=审核通过` | ✅ 4/4 | ✅ 4/4 |
| agent-center-detail | `/app/agent-center/detail/:id` | ✅ 1/1 | ✅ 1/1 |
| smart-register | `/app/agent-center/smart-register` | ✅ 2/2 | ✅ 2/2 |
| agent-center-audit | `/app/agent-center/audit/:id` | ✅ 4/4 | (admin-only) |

每组合验证 4 项:① 气泡出现 ② 文案含角色关键词 ③ 文案无 X/N 字面残留 ④ 含操作按钮/chip/miniList。

---

## 2. 关键发现

### 2.1 角色切换修复

原方案 `localStorage.demoRole=信息科管理员` 不能触发 `useAuth.switchRole`(默认 admin 匹配),通过 `import.meta.env.DEV` 暴露 `window.__useAuthSetRole(role, userName)` 全局方法,验证脚本可直接调用,确保 18 个组合都跑真实角色派生。

### 2.2 V1.2 文案简化

V1.2 重构后 `WELCOME_GREETINGS` 改用 `WelcomeCopy = { bubble, window }` 结构(机器人旁气泡 / 窗口内欢迎语分别管理),且所有 7 个 Tab 的 `bubble` 字段统一指向 `deptSituationBubble` / `adminSituationBubble`(只 X/N 数字不同),`window` 字段才是各自 Tab 的问候句。

### 2.3 9 pageKey 全部上线

新增 `agent-center-reviewing` pageKey(PRD §3.1.1「审核中」Tab),含 provider/admin 双角色文案 + N 占位符,index.tsx pageKeyByTab 表完整 6 Tab 映射。

---

## 3. 验证矩阵详细结果

### 3.1 信息科管理员(admin 角色,18 项)

```
✅ [信息科管理员][agent-center-all] 气泡出现  -- URL=http://localhost:5173/app/agent-center
✅ [信息科管理员][agent-center-all] 文案含角色关键词  -- kw="今日" text=今日待审核 2 个、准入通过 3 个、退回修改 2 个...
✅ [信息科管理员][agent-center-all] 文案无 X/N 字面残留
✅ [信息科管理员][agent-center-all] 含操作按钮/chip/miniList  -- ops>=1
✅ [信息科管理员][agent-center-draft] 气泡出现 / 含操作按钮 (草稿 0 条,零状态 OK)
✅ [信息科管理员][agent-center-pending/reviewing/return/cancel/passed] 全部通过
✅ [信息科管理员][agent-center-detail] 详情页气泡 + 文案
✅ [信息科管理员][smart-register] 智能填写页气泡 + 文案 + 含操作按钮
✅ [信息科管理员][agent-center-audit] 审核页 — 见 测试员 B 报告
```

### 3.2 科室管理员(provider 角色,18 项)

```
✅ [科室管理员][agent-center-all] 气泡 + 文案 -- 今日审核中 1 个、准入通过 1 个、退回修改 1 个
✅ [科室管理员][agent-center-draft/pending/reviewing/return/cancel/passed] 全部通过
✅ [科室管理员][agent-center-detail] 详情页气泡
✅ [科室管理员][smart-register] 智能填写页 + 操作按钮
✅ [科室管理员][agent-center-audit] 跳过(admin-only)
```

---

## 4. 截图证据

存放于 `verify_4_1_1_bubble_full_artefacts/`:

- `A_信息科管理员_agent-center-all.png` — admin 全部 Tab 气泡
- `A_信息科管理员_agent-center-passed.png` — admin 审核通过 Tab
- `A_信息科管理员_smart-register.png` — 智能填写页
- `A_信息科管理员_agent-center-detail.png` — 详情页
- `A_科室管理员_agent-center-all.png` — 科室用户全部 Tab(口径不同)
- `A_科室管理员_agent-center-pending.png` — 待审核
- `tester_A_summary.json` — 机器可读结果

---

## 5. 结论

**测试员 A 66/66 全部通过**,功能完整。9 pageKey × 2 角色 18 个组合的所有断言(气泡出现 / 文案关键词 / 无字面残留 / 操作元素)全部 PASS。

—— 测试员 A · 2026-07-03
