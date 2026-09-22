#!/usr/bin/env node
/**
 * 演示用「技术规格说明书」PDF 生成脚本
 *
 * 设计目的：
 *   - 配合 PRD §3.1「智能识别」演示场景：用户在新建注册页上传这份 PDF 后,
 *     AgentAssistant 按文件名识别为「技术规格说明书」, 自动预填所有字段。
 *   - 文件名包含「技术规格」关键词 → 触发 mock 识别扩展字段(accessMode /
 *     apiEndpoint / apiKey),演示 §3.3 连通测试可触发。
 *
 * 用法：node scripts/gen-tech-spec-pdf.mjs [output.pdf]
 *   默认输出到 ./demo-assets/示例智能体-技术规格说明书.pdf
 *
 * 技术选型：playwright page.pdf() 渲染 HTML 为 A4 PDF
 *   - 系统字体自动处理中文,无需嵌入 ~10MB 中文字体
 *   - 与平台前端 verify 脚本同源,无新增依赖
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outArg = process.argv[2];
const OUT_DIR = path.resolve(__dirname, '../demo-assets');
const OUT_PATH = outArg ? path.resolve(outArg) : path.join(OUT_DIR, '示例智能体-技术规格说明书.pdf');

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });

// ──────────────────────────────────────────────────────────────────
// 演示数据（与平台新建注册页字段 1:1 对应）
//   - 关键：文件名必须包含「技术规格」,触发 AgentAssistant 扩展识别(accessMode/apiEndpoint/apiKey)
// ──────────────────────────────────────────────────────────────────
const data = {
  // 基本信息
  agentName: '门诊预问诊智能体',
  version: '2.1',
  department: '急诊科',
  clinicalStage: '导诊分诊',
  source: '合作研发',
  supplier: '医智未来科技有限公司',
  contactName: '李文博',
  contactPhone: '13800138000',
  description:
    '面向门诊患者开展预问诊服务，自动采集主诉、现病史、既往史等信息，形成标准化问诊摘要，' +
    '供医生参考以提升问诊效率。系统支持多轮对话、症状结构化提取、危急值提示。',

  // 技术信息（API 接入）
  accessMode: 'API',
  apiEndpoint: 'http://10.10.10.20:8080/api/triage',
  apiKey: 'sk-demo-aBcD3FgH9jKlMnOpQ2rStUvWxYz',
};

// ──────────────────────────────────────────────────────────────────
// HTML 文档（A4 排版、表格化字段清单）
// ──────────────────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  @page {
    size: A4;
    margin: 20mm 18mm;
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "PingFang SC", "Microsoft YaHei", "Source Han Sans CN", sans-serif;
    color: #1f2329;
    font-size: 11pt;
    line-height: 1.6;
    margin: 0;
    padding: 0;
  }
  .header-meta {
    display: flex;
    justify-content: space-between;
    color: #8c8c8c;
    font-size: 9.5pt;
    border-bottom: 1px solid #e5e6eb;
    padding-bottom: 8px;
    margin-bottom: 16px;
  }
  h1 {
    font-size: 18pt;
    text-align: center;
    margin: 8px 0 14px;
    letter-spacing: 1px;
  }
  .doc-subtitle {
    text-align: center;
    color: #4e5969;
    font-size: 10pt;
    margin-bottom: 24px;
  }
  h2 {
    font-size: 13pt;
    margin: 22px 0 10px;
    padding-left: 10px;
    border-left: 4px solid #1677ff;
    color: #1677ff;
  }
  table.fields {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 4px;
  }
  table.fields td {
    border: 1px solid #e5e6eb;
    padding: 8px 12px;
    vertical-align: top;
  }
  table.fields td.label {
    background: #fafbfc;
    color: #4e5969;
    width: 30%;
    font-weight: 500;
  }
  table.fields td.value {
    color: #1f2329;
  }
  .note {
    background: #f0f7ff;
    border-left: 3px solid #1677ff;
    padding: 10px 14px;
    margin: 12px 0;
    color: #1f2329;
    font-size: 10.5pt;
    border-radius: 0 4px 4px 0;
  }
  .code {
    background: #f5f5f5;
    border: 1px solid #e5e6eb;
    border-radius: 4px;
    padding: 10px 14px;
    font-family: "SF Mono", "Menlo", "Consolas", monospace;
    font-size: 10pt;
    line-height: 1.55;
    white-space: pre;
    overflow-x: auto;
    color: #1f2329;
  }
  .footer {
    margin-top: 32px;
    padding-top: 12px;
    border-top: 1px solid #e5e6eb;
    text-align: center;
    color: #8c8c8c;
    font-size: 9pt;
  }
  ul.spec {
    padding-left: 18px;
    margin: 6px 0;
  }
  ul.spec li { margin-bottom: 4px; }
</style>
</head>
<body>

<div class="header-meta">
  <span>文档编号：TECH-SPEC-2026-0712-001</span>
  <span>版本：v1.0</span>
  <span>编制日期：2026-07-12</span>
</div>

<h1>${data.agentName} 技术规格说明书</h1>
<div class="doc-subtitle">Medical AI Agent · Technical Specification</div>

<h2>1. 智能体基本信息</h2>
<table class="fields">
  <tr>
    <td class="label">智能体名称</td>
    <td class="value">${data.agentName}</td>
  </tr>
  <tr>
    <td class="label">智能体版本</td>
    <td class="value">${data.version}</td>
  </tr>
  <tr>
    <td class="label">所属科室</td>
    <td class="value">${data.department}</td>
  </tr>
  <tr>
    <td class="label">诊疗环节</td>
    <td class="value">${data.clinicalStage}</td>
  </tr>
  <tr>
    <td class="label">智能体来源</td>
    <td class="value">${data.source}</td>
  </tr>
  <tr>
    <td class="label">供应商名称</td>
    <td class="value">${data.supplier}</td>
  </tr>
  <tr>
    <td class="label">技术联系人</td>
    <td class="value">${data.contactName}</td>
  </tr>
  <tr>
    <td class="label">联系方式</td>
    <td class="value">${data.contactPhone}</td>
  </tr>
</table>

<h2>2. 功能描述</h2>
<p>${data.description}</p>
<p>系统采用自然语言处理技术，对患者主诉进行语义识别，自动提取关键症状、持续时间、伴随症状、既往史和用药史等信息。识别结果以结构化字段形式返回，供门诊医生快速了解病情，提升问诊效率。</p>
<p>支持多轮对话（最多 5 轮），可根据患者反馈动态调整提问策略；内置危急值规则引擎，识别到「剧烈胸痛」「大量出血」「意识障碍」等关键词时立即提示患者就近就医。</p>

<div class="note">
  <strong>使用场景：</strong>门诊大厅自助终端 / 公众号小程序 / 医生工作站问诊前置环节。
  单次问诊平均节省医生 3-5 分钟，病史采集完整度提升约 40%。
</div>

<h2>3. 技术规格</h2>
<table class="fields">
  <tr>
    <td class="label">接入方式</td>
    <td class="value">${data.accessMode}</td>
  </tr>
  <tr>
    <td class="label">接口地址（API Endpoint）</td>
    <td class="value">${data.apiEndpoint}</td>
  </tr>
  <tr>
    <td class="label">API Key</td>
    <td class="value">${data.apiKey}</td>
  </tr>
</table>

<h3>3.1 请求规范</h3>
<ul class="spec">
  <li>请求方法：<code>POST</code></li>
  <li>Content-Type：<code>application/json</code></li>
  <li>字符编码：<code>UTF-8</code></li>
  <li>超时时间：30 秒</li>
</ul>

<h3>3.2 请求体示例</h3>
<div class="code">{
  "session_id": "string，会话唯一标识",
  "user_input": "string，患者主诉文本",
  "context": {
    "patient_age": 35,
    "patient_gender": "male"
  }
}</div>

<h3>3.3 响应体示例</h3>
<div class="code">{
  "code": 0,
  "message": "ok",
  "data": {
    "chief_complaint": "咳嗽 3 天",
    "duration": "3 天",
    "symptoms": ["咳嗽", "低热"],
    "urgency_level": "low"
  }
}</div>

<h3>3.4 鉴权方式</h3>
<p>所有请求需在 Header 中携带 <code>Authorization: Bearer ${data.apiKey}</code>，平台网关验证通过后转发至智能体后端服务。</p>

<h3>3.5 性能指标</h3>
<ul class="spec">
  <li>平均响应时间：≤ 1500 ms（P95）</li>
  <li>并发支持：≥ 50 QPS</li>
  <li>可用性：≥ 99.5%</li>
</ul>

<h2>4. 部署与运维</h2>
<table class="fields">
  <tr>
    <td class="label">部署环境</td>
    <td class="value">院内私有云</td>
  </tr>
  <tr>
    <td class="label">镜像地址</td>
    <td class="value">registry.hospital.local/agent/triage:v2.1</td>
  </tr>
  <tr>
    <td class="label">健康检查路径</td>
    <td class="value">/healthz</td>
  </tr>
  <tr>
    <td class="label">日志规范</td>
    <td class="value">结构化 JSON，输出至院内 ELK 平台</td>
  </tr>
</table>

<h2>5. 安全要求</h2>
<ul class="spec">
  <li>数据传输：全程 HTTPS 加密，禁用 HTTP 明文传输。</li>
  <li>数据存储：患者主诉文本加密存储（AES-256），留存时间 90 天。</li>
  <li>权限控制：仅授权医生可访问完整会话记录，问诊摘要按最小必要原则展示。</li>
  <li>审计要求：所有 API 调用记录日志，保留 1 年可追溯。</li>
</ul>

<h2>6. 技术联系方式</h2>
<table class="fields">
  <tr>
    <td class="label">技术联系人</td>
    <td class="value">${data.contactName}</td>
  </tr>
  <tr>
    <td class="label">联系电话</td>
    <td class="value">${data.contactPhone}</td>
  </tr>
  <tr>
    <td class="label">邮箱</td>
    <td class="value">tech@medfuture.ai</td>
  </tr>
  <tr>
    <td class="label">工单系统</td>
    <td class="value">https://ticket.medfuture.ai</td>
  </tr>
</table>

<div class="footer">
  ${data.agentName} 技术规格说明书  ·  本文档仅供接入审核参考使用
</div>

</body>
</html>`;

// ──────────────────────────────────────────────────────────────────
// 渲染为 PDF
// ──────────────────────────────────────────────────────────────────
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.emulateMedia({ media: 'print' });
  const pdfBytes = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
  });
  fs.writeFileSync(OUT_PATH, pdfBytes);
  const sizeKB = (fs.statSync(OUT_PATH).size / 1024).toFixed(1);
  console.log(`✓ 生成成功：${OUT_PATH}`);
  console.log(`  文件大小：${sizeKB} KB`);
  console.log(`  页面数：${pdfBytes.toString('utf8', 0, 16).match(/\/Count\s+(\d+)/)?.[1] || '自动'}`);
} finally {
  await browser.close();
}

console.log('\n演示路径：');
console.log('  1. 进入「智能体接入中心 → 新建注册」(/app/agent-center/smart-register)');
console.log('  2. 在「备案材料上传」选「技术规格书」类别，上传此 PDF');
console.log('     - 文件名包含「技术规格」 → 触发 AgentAssistant 扩展识别');
console.log('  3. 点击医小管浮层对话框，确认「自动识别并预填」');
console.log('  4. 表单应自动填入：智能体名称 / 版本 / 科室 / 诊疗环节 / 来源 /');
console.log('                     供应商 / 技术联系人 / 联系方式 / 功能描述 /');
console.log('                     接入方式(API) / 接口地址 / API Key');
console.log('  5. 点击「连通测试」验证 §3.3 联通流程');