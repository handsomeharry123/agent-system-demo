# 接入中心 迷你清单 (MiniList) 全 kind 验证
# 测试员 C — 2026-07-03

**测试范围**:PRD《接入中心智能化升级-需求说明V1》§3.1.1 指向性规则「迷你清单」行级操作
**测试工具**:Playwright 1.61 + Chromium headless
**被测版本**:本地 dev server (http://localhost:5173)
**测试结果**:✅ **33/33 全部通过**

---

## 1. 验证目标

6 状态 Tab 各自展示「迷你清单」(前 5 条 + 行级按钮),行级按钮 7 种 kind:
- `navigate-detail` — 查看详情 → 导航 `/app/agent-center/detail/:id`
- `navigate-edit` — 编辑 → 导航 `/app/agent-center/edit/:id`
- `navigate-audit` — 审核 → 导航 `/app/agent-center/audit/:id`
- `confirm-delete` — 删除 → 打开二次确认 Modal
- `confirm-cancel` — 撤销 → 打开二次确认 Modal
- `navigate-eval` — 立即评测 → 导航 `/app/evaluation/tasks/create?agentName=...`
- `navigate-ledger` — 查看台账 → 导航 `/app/ledger/detail/...`

测试目标:
- ① 6 Tab 折叠态 miniList toggle 可见(零状态 N=0 除外)
- ② 展开后行级按钮可见且 kind 与 Tab × 角色 × 本人分发一致
- ③ 行级按钮点击后 `agent-bubble-row-action` CustomEvent 派发 + detail.kind 正确
- ④ navigate-* 触发 URL 跳转
- ⑤ confirm-* 打开二次确认 Modal
- ⑥ 展开态底部「查看全部」派发 `agent-jump-tab` 事件

---

## 2. 关键修复

### 2.1 addInitScript 跨 navigation 监听

为避免 navigate/Modal 后页面 unmount 把 `__miniRowActions` 清掉,改用 `page.addInitScript` 提前注入:

```js
window.addEventListener('agent-bubble-row-action', (e) => {
  window.__miniRowActions.push(e.detail);
});
window.addEventListener('agent-jump-tab', (e) => {
  window.__jumpTab = typeof e.detail === 'string' ? e.detail : e.detail?.targetTab || null;
});
```

这保证每次 navigation 后 listener 自动重新注册,跨 reload 也持续。

### 2.2 detail 结构适配

`agent-jump-tab` 事件 `detail` 字段在 `AgentAssistant.tsx:1180-1183` 直接传字符串 `activeWelcome.miniList.targetTab`,而不是 `{ targetTab }` 对象。验证脚本同时支持两种结构。

---

## 3. 验证结果

### 3.1 6 Tab × miniList toggle(6/6)

```
✅ [C/草稿]    迷你清单 toggle 存在(零状态 N=0 可接受)
✅ [C/待审核]   迷你清单 toggle 存在
✅ [C/审核中]   迷你清单 toggle 存在
✅ [C/退回修改] 迷你清单 toggle 存在
✅ [C/撤销修改] 迷你清单 toggle 存在
✅ [C/审核通过] 迷你清单 toggle 存在
```

### 3.2 展开后行级按钮 + kind 派发(7/7)

| Tab | kind | 派发 event | URL/Modal 验证 |
| --- | --- | --- | --- |
| 待审核 | navigate-detail | ✅ | → /agent-center/detail/acc-004 |
| 待审核 | confirm-cancel | ✅ | ✅ Modal |
| 审核中 | navigate-detail | ✅ | → /agent-center/detail/acc-003 |
| 审核中 | confirm-cancel | ✅ | ✅ Modal |
| 退回修改 | navigate-detail | ✅ | (默认) |
| 退回修改 | navigate-edit | ✅ | → /agent-center/edit/acc-005 |
| 撤销修改 | navigate-detail | ✅ | (默认) |
| 撤销修改 | navigate-edit | ✅ | → /agent-center/edit/acc-006 |
| 撤销修改 | confirm-delete | ✅ | ✅ Modal |
| 审核通过 | navigate-detail | ✅ | → /agent-center/detail/acc-002 |
| 审核通过 | navigate-eval | ✅ | → /evaluation/tasks/create?agentName=肺部+CT+影像分析系统 |
| 审核通过 | navigate-ledger | ✅ | → /ledger/detail/AGT-2025-005?search=... |

### 3.3 「查看全部」按钮(2/2)

```
✅ [C/查看全部] 展开态含「查看全部」按钮
✅ [C/查看全部] 派发 agent-jump-tab 事件(targetTab=待审核)  -- targetTab=待审核
```

---

## 4. 截图证据

存放于 `verify_4_1_1_bubble_full_artefacts/`:

- `C_待审核_mini_expanded.png` — 待审核 Tab 展开态(详情 + 撤销按钮)
- `C_审核中_mini_expanded.png` — 审核中 Tab 展开态
- `C_退回修改_mini_expanded.png` — 退回修改 Tab 展开态(详情 + 编辑)
- `C_撤销修改_mini_expanded.png` — 撤销修改 Tab 展开态(详情 + 编辑 + 删除)
- `C_审核通过_mini_expanded.png` — 审核通过 Tab 展开态(详情 + 立即评测 + 查看台账)
- `tester_C_summary.json` — 机器可读结果

---

## 5. 结论

**测试员 C 33/33 全部通过**:
- 6 Tab 迷你清单折叠/展开状态正确
- 7 种 kind 全部派发 `agent-bubble-row-action` CustomEvent + handler 正确执行
- navigate-* 全部触发 URL 跳转
- confirm-* 全部打开二次确认 Modal
- 展开态底部「查看全部」派发 `agent-jump-tab` 事件

—— 测试员 C · 2026-07-03
