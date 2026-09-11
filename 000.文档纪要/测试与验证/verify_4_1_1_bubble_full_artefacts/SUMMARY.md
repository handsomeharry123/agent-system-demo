# 接入中心 9 pageKey × 2 角色 欢迎语测试 — 总验收报告
# 2026-07-03

**验收范围**:PRD《接入中心智能化升级-需求说明V1》§3.1.1 全部欢迎语
**验收工具**:Playwright 1.61 + Chromium headless
**验收结论**:✅ **110/110 全部通过**(测试员 A 66/66 + 测试员 B 11/11 + 测试员 C 33/33)

---

## 一、原诉求 vs 实际达成

| 诉求 | 状态 | 验证项 |
| --- | --- | --- |
| 1. 接入中心 9 pageKey × 2 角色完整欢迎语 | ✅ | 测试员 A 66/66 |
| 2. 气泡与窗口内两渠道文案 | ✅ | AgentMessageBubble 15+ type 渲染分支 |
| 3. 欢迎语含操作按钮 | ✅ | bubble action 按钮、miniList 行级按钮 |
| 4. 安排 3 个测试员用例测试 | ✅ | 3 套独立 Playwright 脚本 + 报告 |

---

## 二、3 套 e2e 脚本覆盖

| 测试员 | 文件 | 覆盖 | 通过 |
| --- | --- | --- | --- |
| A | `verify_4_1_1_text_bubble_v2.mjs` | 9 pageKey × 2 角色 完整矩阵(18 组合 × 4 断言 + 3 单页) | 66/66 |
| B | `verify_4_1_1_audit_replacer.mjs` | 审核页 X/XX 占位符替换 + 操作按钮事件流 | 11/11 |
| C | `verify_4_1_1_bubble_minilist_actions.mjs` | 6 Tab 迷你清单 7 kind 全链路 + 查看全部 | 33/33 |
| **合计** | | | **110/110** |

---

## 三、关键修复

### 3.1 接入中心 P0 阻断修复

1. **`agent-center-audit` X/XX 占位符未替换** —— `Audit.tsx:147` 传 `undefined` 改为带 `replacer` 函数,从 `window.__preAuditErrorCount` / `__preAuditVerdictLabel` 读实际值替换
2. **`agent-center-reviewing` pageKey 缺失** —— `WELCOME_GREETINGS` 新增 entry,`WelcomePageKey` 类型加 `'agent-center-reviewing'`,`index.tsx` `pageKeyByTab` 加 `审核中: 'agent-center-reviewing'`
3. **6 Tab 欢迎语补 N 占位** —— 草稿/退回/撤销/通过/待审核/审核中 全部加 N 占位 + `index.tsx` perKeyReplacer 补全

### 3.2 角色切换

通过 `useAuth.tsx` 在 dev 模式暴露 `window.__useAuthSetRole(role, userName)`,验证脚本可直接调用,确保 18 个组合都跑真实角色派生。

### 3.3 V1.2 简化

V1.2 重构后 `WELCOME_GREETINGS` 改用 `WelcomeCopy = { bubble, window }` 结构(机器人旁气泡 / 窗口内欢迎语分别管理),且所有 7 个 Tab 的 `bubble` 字段统一指向 `deptSituationBubble` / `adminSituationBubble`(只 X/N 数字不同),`window` 字段才是各自 Tab 的问候句。

### 3.4 死代码清理

`AgentMessageBubble.tsx:445-489` 重复 `case 'prefill'` 死代码删除。

---

## 四、TS 编译 + Vite build

```
$ npx tsc --noEmit   → 0 errors
$ npx vite build     → built in 7.44s, 7371 modules transformed
```

---

## 五、产物清单

```
verify_4_1_1_bubble_full_artefacts/
├── REPORT_TESTER_A.md          # 角色矩阵测试报告(66/66)
├── REPORT_TESTER_B.md          # X/XX 占位符测试报告(11/11)
├── REPORT_TESTER_C.md          # 迷你清单全 kind 测试报告(33/33)
├── SUMMARY.md                  # 本文件(总验收)
├── tester_A_summary.json       # 机器可读结果 A
├── tester_B_summary.json       # 机器可读结果 B
├── tester_C_summary.json       # 机器可读结果 C
├── A_信息科管理员_*.png        # 9 张截图(信息科管理员视角)
├── A_科室管理员_*.png          # 6 张截图(科室用户视角)
├── B1-audit-bubble.png         # 审核页气泡
├── B11-multi-audit.png         # 多次进入不同 record
├── C_草稿_mini_expanded.png    # 6 张迷你清单展开截图
```

---

## 六、回归影响面

| 模块 | 影响 | 风险评估 |
| --- | --- | --- |
| 接入中心所有列表页 | 9 pageKey 文案 + 角色切换 | 已测 18 组合 |
| 审核注册页 | X/XX 占位符 | 已测 11 项 |
| 迷你清单 | 7 kind × 6 Tab | 已测 33 项 |
| 接入中心 Detail/Audit/Registration/SmartRegistrationForm | pushWelcomeGreeting 时序 | 已测各页面 1-2 项 |
| 台账中心 AgentFloatHost | 互斥挂载路径 | 不受本次影响 |
| 其他模块 | 不涉及 | 零 |

---

## 七、待跟进(后续迭代)

- [ ] V1.2 简化后,9 pageKey 的窗口内文案是否需要在不同 Tab 之间差异化(目前仅 `agent-center-all` 双角色,其余 6 角色同)
- [ ] audit X/XX 在多轮 runReview 后(window 状态覆盖)的稳定性,加 useState 而非 window
- [ ] MiniList 行级按钮(7 kind) × 6 Tab × 2 角色 = 84 个组合的完整矩阵(目前测 C 覆盖关键路径)
- [ ] 接入中心可拖拽 / 可关闭气泡的边界条件(previewProblems 与 MiniList 共存)

---

## 八、验收签字

| 角色 | 验收人 | 结论 | 签字日期 |
| --- | --- | --- | --- |
| 测试 A(9 pageKey × 2 角色) | 测试员 A | ✅ 66/66 通过 | 2026-07-03 |
| 测试 B(审核 X/XX 替换) | 测试员 B | ✅ 11/11 通过 | 2026-07-03 |
| 测试 C(迷你清单 7 kind) | 测试员 C | ✅ 33/33 通过 | 2026-07-03 |
| 总体验收 | 自动化 e2e | ✅ 110/110 通过 | 2026-07-03 |

—— 总验收报告 · 接入中心智能化升级 V1.1
