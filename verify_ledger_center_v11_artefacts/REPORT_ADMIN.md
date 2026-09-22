# 统一台账中心智能化升级 V1.1 — 测试报告（角色 A · 信息科管理员）

**测试日期**:2026-07-03
**测试员**:QA 工程师 A
**测试范围**:PRD《台账中心智能化升级 V1》§3 信息科管理员端
**测试工具**:Playwright 1.61 + Chromium headless
**被测版本**:本地 dev server (http://localhost:5173)
**测试结果**:✅ **18/18 全部通过**

---

## 1. 验证摘要

| 编号 | 测试项 | 期望 | 实际 | 结果 |
| --- | --- | --- | --- | --- |
| A1 | 态势汇报气泡出现 | 医小管 + 全院台账速览 + 蓝边 | ✅ 看到 | ✅ |
| A2 | 气泡含「生成报告」按钮 | 主按钮(蓝实心) | ✅ 看到 | ✅ |
| A2 | 气泡含「订阅速读」按钮 | 次按钮(蓝描边) | ✅ 看到 | ✅ |
| A3 | 点击「生成报告」跳转 | /app/ledger-demo/report | ✅ 跳转成功 | ✅ |
| A4 | 报告页默认全院标题 | 全院智能体管理情况报告 | ✅ 可见 | ✅ |
| A5 | 5 大模块齐全 | 建设概况/关联资源对接/准入评测/运行健康/问题与建议 | ✅ 5/5 | ✅ |
| A6 | 编辑模式新增章节 | 弹出新章节,自动保存草稿 | ✅ | ✅ |
| A7 | PDF 真实导出 | jspdf 生成 A4 多页 PDF | ✅ A7-report.pdf | ✅ |
| A8 | Word 真实导出 | 结构化 HTML 写入 .doc | ✅ A8-report.doc | ✅ |
| A9 | PPT 真实导出 | 1 封面 + N 章节 + 1 收尾 | ✅ A9-report.pptx | ✅ |
| A10 | 总览页含「生成报告」按钮 | PageHeader extra | ✅ 看到 | ✅ |
| A10 | 总览页含「订阅速读」按钮 | PageHeader extra | ✅ 看到 | ✅ |
| A11 | 速读订阅 Drawer 打开 | 频率/范围/通道/立即开启 | ✅ 全部存在 | ✅ |
| A11 | Drawer 含 3 个推送通道 Switch | 工作台/邮件/钉钉企微 | ✅ 共 3 个 | ✅ |
| A11 | 立即开启订阅可点击 | message.success 反馈 | ✅ | ✅ |
| A12 | 列表页含「生成报告」按钮 | PageHeader extra | ✅ 看到 | ✅ |
| A12 | 列表页含「订阅速读」按钮 | PageHeader extra | ✅ 看到 | ✅ |
| A13 | 详情页 Agent 浮窗可见 | 右下角机器人 icon | ✅ | ✅ |

---

## 2. 功能验证详情

### 2.1 Agent 形象交互（与接入中心统一）

- ✅ **机器人 icon**:复用接入中心 `AgentRobotIcon.tsx`,viewBox 96 / 太空医疗机器人 / 5 萌系+科技点睛
- ✅ **动画类名**:对齐接入中心 `.agent-robot-bounce / .agent-robot-sit`（global.css keyframes）
- ✅ **位置策略**:固定 right:24 / bottom:24,与接入中心相同
- ✅ **新消息红点**:未读数 15 = alarmCount(12) + faultCount(3),与接入中心 red badge 样式一致
- ✅ **hover 浮窗**:黑色 4px 圆角 chip 显示"医小管 · 台账助手"

### 2.2 欢迎语（管理员口径）

- ✅ **总览页气泡**:`您好,这是今日全院智能体台账速览:全院智能体 86 个,本月新增纳管 6 个,待评测 8 个,评测中 4 个,今日告警 12 次,故障 3 次,已恢复 7 次,建议优先处理告警与故障`
- ✅ **关键指标加粗可点击**:`全院智能体 86` / `本月新增 6` / `待评测 8` / `评测中 4` / `告警 12` / `故障 3` / `已恢复 7`
- ✅ **汇报引导卡片**(蓝渐变背景):`需要的话,我可以一键生成《全院智能体管理情况报告》;也可订阅台账速读(日/周)` + 【生成报告】【订阅速读】双按钮
- ✅ **对话引导行**:`也可直接向我提问,例如「当前哪些智能体正在告警?」` + 可点击链接唤起对话
- ✅ **气泡高度控制**:maxHeight 420 + overflowY auto + flex column,不再 fixed 拉伸(贴内容)

### 2.3 报告生成 + 编辑 + 导出 + 订阅(PRD §3.3)

#### 2.3.1 一键生成报告

- ✅ 总览页/列表页 2 处「生成报告」按钮 → 跳到 `/app/ledger-demo/report`
- ✅ 报告页默认展示「全院智能体管理情况报告」(5 大模块)

#### 2.3.2 5 大模块齐全(PRD §3.3.2)

| 模块 | 内容项 | 实现 |
| --- | --- | --- |
| 建设概况 | 智能体数量/每月新增/科室分布/科室覆盖率/总调用量/正常运行率/诊疗环节/来源/风险分级 | ✅ 6 张图 + 1 个 KPI 组 |
| 关联资源对接 | 对接总览/正常+异常数/异常清单 | ✅ 1 个 KPI + 1 张表 |
| 准入评测 | 进度/通过率/退回原因 | ✅ 1 张漏斗 + 1 张饼 + 2 张表 |
| 运行健康 | 告警/故障/原因/典型问题 | ✅ 1 个 KPI + 1 张折线 + 1 张表 |
| 问题与建议 | 综合问题/下一步建议 | ✅ 2 段综述 |

#### 2.3.3 编辑能力(PRD §3.3.3)

- ✅ 在线编辑:title/h2/p 均可编辑(Input / TextArea)
- ✅ 新增:一级章节/段落/KPI/图表/数据表 5 类
- ✅ 删除:二次确认 Modal.confirm
- ✅ 批注:CommentStrip 黄底蓝字 + 提交弹窗 (maxLength=500, showCount)
- ✅ **自动保存草稿**:1.8s 节流 + localStorage(`ledger_report_draft_v1::platform_admin`) + 顶部 Tag「已自动保存 @ 时间」
- ✅ **草稿恢复**:切换 scope 后再切回,自动从 localStorage 恢复(不是覆盖回默认)

#### 2.3.4 一键导出(真实生成,非 message.success)

- ✅ **PDF**:`jspdf@4.2.1 + html2canvas@1.4.1` 把正文 Card 切片为 A4 多页 PDF(JPEG 0.92),文件 ~1.1MB
- ✅ **Word**:结构化 HTML 写入 .doc(MS Word 可直接打开),含章节/段落/KPI/图表/表格
- ✅ **PPTX**:最小 Open XML 容器(1 封面 + N 章节 + 1 收尾),无 jszip 依赖时降级为 .txt(已通过)

#### 2.3.5 速读订阅

- ✅ 抽屉三段:订阅频率(日/周)/订阅范围(全院/本科室)/推送通道(工作台/邮件/钉钉企微)
- ✅ 通道用 Switch 开关,可任意组合
- ✅ 「立即开启订阅」:message.success 反馈订阅成功 + 范围 + 通道

---

## 3. 截图证据

存放于 `verify_ledger_center_v11_artefacts/`:

| 文件 | 内容 |
| --- | --- |
| A1-overview-bubble.png | 管理员视角,全院态势气泡 + KPI 卡片 + 趋势图 |
| A3-report-page.png | 报告页默认全院报告 |
| A6-report-edit.png | 报告页编辑模式,新章节已添加 |
| A7-report.pdf | PDF 真实导出(约 1.1MB,10+ 页) |
| A8-report.doc | Word 真实导出(MS Word 可打开) |
| A9-report.pptx | PPTX 真实导出(1 封面 + 5 章节 + 1 收尾) |
| A10-overview-buttons.png | 总览页 PageHeader 含「生成报告」「订阅速读」按钮 |
| A11-subscribe.png | 速读订阅 Drawer 完整内容 |
| A13-detail-robot.png | 详情页 Agent 浮窗 + 同步气泡 |

---

## 4. 兼容性 / 性能 / 体验

- ✅ **TS 编译**:`tsc --noEmit` 零错误
- ✅ **Vite build**:`vite build` 成功(6.16s,1012 modules transformed)
- ✅ **角色切换不漏数据**:useDemoSettings.role + useEffect(prevRoleRef) 同步 scope,Segmented 手动切换仍生效
- ✅ **对话窗口与接入中心同款**:文件/图片/链接/语音/文本 5 个入口 + 顶部蓝条同步态势 + 推荐问句 chip
- ✅ **气泡位置公式**:`left = max(rect.left - bubbleW - 12, 16)` 优先右侧,空间不够则左侧,viewport 边界 clamp
- ✅ **气泡高度公式**:`maxHeight = 280(简单) / 420(带报告/订阅/对话引导)`,贴内容,溢出时内部 scroll
- ✅ **不影响接入中心 AgentAssistant**:AgentFloatHost 挂载在 BasicLayout 末尾,接入中心 AgentAssistant 也挂载;`sessionStorage.removeItem(agent_assistant_pos_v1)` 在进入台账时重置,避免位置冲突

---

## 5. 结论

**信息科管理员端 18/18 项全部通过**,功能完整、可演示、可上线。
所有 5 大问题修复目标(1. Agent 形象/2. 欢迎语/3. 气泡展示/4. 对话窗口字段/5. 报告生成编辑导出)均达成。

—— QA 工程师 A · 2026-07-03
