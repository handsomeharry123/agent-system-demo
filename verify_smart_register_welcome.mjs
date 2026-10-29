import assert from 'node:assert/strict';
import fs from 'node:fs';

const storeSource = fs.readFileSync('src/pages/agent-center/smart/store.tsx', 'utf8');
const formSource = fs.readFileSync('src/pages/agent-center/smart/SmartRegistrationForm.tsx', 'utf8');

const expected =
  '您想要接入什么智能体？把产品说明书、技术规格说明书发给我（支持PDF、DOC、DOCX、XLSX、csv、jpg、jpeg、png、链接等任意文件格式），或文字描述，我来帮您登记注册信息~';
const expectedWindowCopy =
  '你好！我是医小管。点击【新建注册】，把产品说明书 / 技术规格书发给我（支持 PDF、DOC、DOCX、XLSX、csv、jpg、jpeg、png、链接等任意文件格式），或文字描述，我来帮你自动识别并填表～';

assert.ok(storeSource.includes(`'${expected}'`), '注册页气泡欢迎语必须与产品文案完全一致');
assert.ok(storeSource.includes(`'${expectedWindowCopy}'`), '注册页窗口欢迎语必须去掉语音描述');
assert.ok(!formSource.includes('语音描述'), '注册页欢迎气泡不应再包含语音描述按钮');
assert.ok(!formSource.includes('agent-register-trigger-voice'), '注册页不应再触发语音直接操作事件');
assert.ok(
  storeSource.includes('或文字、语音描述，我来帮你自动识别并填表～'),
  '接入中心全部页窗口欢迎语保持不变',
);
assert.match(
  storeSource,
  /\(\?<\!\[A-Za-z\]\)\(\?:XX\|\[XN\]\)\(\?!\[A-Za-z\]\)/,
  '占位符替换必须排除英文单词中的 X/N',
);
assert.match(
  formSource,
  /pushWelcomeGreeting\(\s*'smart-register',\s*'provider',\s*undefined,/,
  '注册页欢迎语不应传入数量占位符替换值',
);

const replacePlaceholders = (template, values) => {
  let cursor = 0;
  return template.replace(/(?<![A-Za-z])(?:XX|[XN])(?![A-Za-z])/g, (placeholder) => {
    const value = values?.[cursor];
    cursor += 1;
    return value === undefined || value === null ? placeholder : String(value);
  });
};

assert.equal(replacePlaceholders(expected, ['3', '2', '2']), expected);
assert.equal(
  replacePlaceholders('今日审核中 X 个、准入通过 X 个、退回修改 X 个。', ['3', '2', '2']),
  '今日审核中 3 个、准入通过 2 个、退回修改 2 个。',
);

console.log('PASS: 注册页气泡保留 DOCX、XLSX 且无语音入口，独立数量占位符仍可正常替换。');
