import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline';
import type { DetectedField } from '../agent-center/smart/types';

// 将 worker 打进应用 bundle，以 Blob URL 启动。线上 CDN 对独立的 .mjs worker
// 支持不一致时，使用 ?url 会触发 PDF.js 的 fake worker 回退，并再次动态导入
// 同一个不可用资源，最终导致所有 PDF 识别失败。
GlobalWorkerOptions.workerPort = new PdfWorker();

export type ProjectRecognizedValues = {
  name?: string;
  department?: string;
  superiorDepartment?: string;
  track?: string;
  leader?: string;
  contact?: string;
  phone?: string;
  supports?: string[];
  overview?: string;
  painPoints?: string;
  technologies?: string[];
  models?: string[];
  deliverables?: string;
  assessmentIndicators?: {
    technical: Array<{ name: string; targetValue: string }>;
    intellectualProperty: Array<{ name: string; targetValue: string }>;
    economicSocial: Array<{ name: string; targetValue: string }>;
    other: Array<{ name: string; targetValue: string }>;
  };
  totalBudget?: number;
  fundingDetail?: string;
  spendingDetail?: string;
};

export type ProjectMaterialKind = 'application' | 'evidence';

const applicationFileNamePattern = /(项目|立项).{0,8}(申报|申请)书|申报书|申请书/i;
const evidenceFileNamePattern = /(证明|佐证|附件|证书|合同|批复|承诺函|资质|专利)/i;

/**
 * 医小管统一上传入口没有固定的材料槽位，需要结合文件名和正文识别结果自动归类。
 * 文件名是用户最明确的意图；名称不明确时，包含多个申报表字段的正文才视为申报书。
 */
export function classifyProjectMaterial(
  fileName: string,
  recognized: ProjectRecognizedValues = {},
): ProjectMaterialKind {
  if (applicationFileNamePattern.test(fileName)) return 'application';
  if (evidenceFileNamePattern.test(fileName)) return 'evidence';

  const recognizedKeys = Object.keys(recognized).filter((key) => key !== 'name');
  return recognizedKeys.length >= 3 ? 'application' : 'evidence';
}

const departments = [
  '心内科', '呼吸科', '消化科', '神经内科', '肾内科', '内分泌科', '血液科',
  '风湿免疫科', '感染科', '急诊科', '重症医学科', '影像科', '超声科', '心电图室',
  '药剂科', '检验科', '病理科', '麻醉科', '外科', '妇产科', '儿科', '眼科',
  '耳鼻喉科', '皮肤科', '康复科', '中医科', '肿瘤科', '老年医学科',
];
const tracks = ['便民赛道', '助医赛道', '辅政赛道', '促研赛道', '其他'];
const superiorDepartments = ['数智发展处', '科研处', '临床研究中心', '医务处'];
const supports = ['资金支持', '算力支持', '数据要素支持', '项目推广', '技术指导支持', '其他'];
const technologies = ['计算机视觉', '智能语音', '多模态', '边缘计算', '数字孪生', '自然语言处理', '知识图谱', '机器学习', '隐私计算', '高性能计算', '其他'];
const models = ['GPT模型', 'Claude模型', 'LLaMa模型', 'Gemini模型', 'Deepseek模型', 'Qwen模型', '豆包模型', 'Kimi模型', 'Grok模型', '其他'];

const fieldLabels: Record<keyof ProjectRecognizedValues, string> = {
  name: '项目名称',
  department: '申报科室',
  superiorDepartment: '上级部门',
  track: '申报赛道',
  leader: '项目负责人',
  contact: '项目联系人',
  phone: '联系方式',
  supports: '希望获得的支持',
  overview: '项目概述',
  painPoints: '项目解决的痛点',
  technologies: '项目运用的核心技术',
  models: '项目运用的大模型',
  deliverables: '项目完成形式',
  assessmentIndicators: '考核指标',
  totalBudget: '已有经费来源合计',
  fundingDetail: '具体来源明细',
  spendingDetail: '具体使用明细',
};

const aliases: Record<string, string[]> = {
  name: ['项目名称'],
  department: ['申报科室'],
  superiorDepartment: ['上级部门'],
  track: ['申报赛道'],
  leader: ['项目负责人'],
  contact: ['项目联系人'],
  phone: ['联系方式'],
  supports: ['希望获得的支持', '希望获取的支持'],
  overview: ['项目概述'],
  painPoints: ['项目解决的痛点问题', '项目解决的痛点'],
  technologies: ['项目运用的核心技术'],
  models: ['项目运用的大模型'],
  deliverables: ['项目完成形式'],
  assessmentIndicators: ['考核指标'],
  totalBudget: ['已有经费来源合计'],
  fundingDetail: ['具体来源明细'],
  spendingDetail: ['具体使用明细'],
};

const normalize = (text: string) =>
  text
    .replace(/\u0000/g, '')
    // PDF 字形定位常会在中文字符间产生伪空格，先消除它们，避免字段名被拆开。
    .replace(/(?<=[\u3400-\u9fff])[ \t]+(?=[\u3400-\u9fff])/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();

const extractLabeled = (text: string, keys: string[]) => {
  const allLabels = Object.values(aliases).flat().sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const start = text.indexOf(key);
    if (start < 0) continue;
    const valueStart = start + key.length;
    const tail = text.slice(valueStart).replace(/^[：:\s]+/, '');
    let end = tail.length;
    for (const label of allLabels) {
      const at = tail.indexOf(label);
      if (at >= 0 && at < end) end = at;
    }
    const value = tail.slice(0, end).replace(/^[：:\s]+|[\s]+$/g, '').trim();
    if (value) return value;
  }
  return undefined;
};

const enumComparable = (text: string) =>
  text
    .normalize('NFKC')
    // PDF.js 会按字形定位在中英文、数字与单位之间插入空格，枚举匹配时应忽略。
    .replace(/\s+/g, '')
    .toLowerCase();
const choose = (text: string, options: string[]) => {
  const comparable = enumComparable(text);
  return options.find((option) => comparable.includes(enumComparable(option)));
};
const chooseMany = (text: string, options: string[]) => {
  const comparable = enumComparable(text);
  return options.filter((option) => comparable.includes(enumComparable(option)));
};
const compactValue = (value: unknown) => {
  if (Array.isArray(value)) return value.join('；');
  if (typeof value === 'object' && value) {
    return Object.values(value)
      .flatMap((items) => items as Array<{ name: string; targetValue: string }>)
      .map((item) => `${item.name}：${item.targetValue}`)
      .filter((item) => item !== '：')
      .join('；');
  }
  return String(value ?? '');
};

export async function extractProjectFileText(file: File) {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('当前浏览器端完整正文识别仅支持 PDF，请将 DOC/DOCX 转为 PDF 后重试');
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = getDocument({ data });
  const pdf = await loadingTask.promise;
  try {
    const pages: string[] = [];
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
      page.cleanup();
    }
    return normalize(pages.join('\n'));
  } finally {
    await pdf.destroy();
  }
}

export function recognizeProjectText(text: string, fileName?: string) {
  const normalized = normalize(text);
  const raw: ProjectRecognizedValues = {};
  const scalar = (key: keyof ProjectRecognizedValues) => extractLabeled(normalized, aliases[key]);

  raw.name = scalar('name')?.split('\n')[0].trim()
    || fileName?.replace(/\.(pdf|docx?)$/i, '').replace(/项目申报书/g, '').trim();
  raw.department = choose(scalar('department') || normalized, departments);
  raw.superiorDepartment = choose(scalar('superiorDepartment') || normalized, superiorDepartments);
  raw.track = choose(scalar('track') || normalized, tracks);
  raw.leader = scalar('leader')?.match(/[\u4e00-\u9fa5]{2,10}/)?.[0];
  raw.contact = scalar('contact')?.match(/[\u4e00-\u9fa5]{2,10}/)?.[0];
  raw.phone = scalar('phone')?.match(/1[3-9]\d{9}/)?.[0] || normalized.match(/1[3-9]\d{9}/)?.[0];
  raw.supports = chooseMany(scalar('supports') || '', supports);
  raw.overview = scalar('overview')?.slice(0, 300);
  raw.painPoints = scalar('painPoints')?.slice(0, 200);
  raw.technologies = chooseMany(scalar('technologies') || '', technologies);
  raw.models = chooseMany(scalar('models') || '', models);
  raw.deliverables = scalar('deliverables');
  const indicatorText = scalar('assessmentIndicators');
  if (indicatorText) {
    const getIndicator = (label: string, nextLabels: string[]) => {
      const start = indicatorText.indexOf(label);
      if (start < 0) return '';
      const tail = indicatorText.slice(start + label.length).replace(/^[：:\s]+/, '');
      const stops = nextLabels.map((next) => tail.indexOf(next)).filter((at) => at >= 0);
      return tail.slice(0, stops.length ? Math.min(...stops) : tail.length).replace(/[。\s]+$/g, '').trim();
    };
    const splitIndicatorItems = (section: string) => {
      const chunks = section
        .split(/[；;，,。]/)
        .map((item) => item.trim())
        .filter(Boolean);
      return chunks.map((item) => {
        const targetMatch = item.match(
          /(不低于|不高于|不少于|不超过|达到|提升|降低|减少|控制在|等于|为)?\s*\d+(?:\.\d+)?\s*(?:%|秒|分钟|小时|项|份|万元|个|套|条|人次|例|分)?(?:以上|以下)?/,
        );
        if (!targetMatch || targetMatch.index === undefined) {
          return { name: item, targetValue: '按申报内容完成' };
        }
        const name = item.slice(0, targetMatch.index).replace(/[：:\s]+$/g, '').trim();
        const targetValue = item.slice(targetMatch.index).trim();
        return { name: name || item, targetValue };
      });
    };
    const technical = getIndicator('技术性能指标', ['知识产权指标', '经济指标', '社会效益指标', '其他指标']) || indicatorText;
    const intellectualProperty = getIndicator('知识产权指标', ['经济指标', '社会效益指标', '其他指标']);
    const economic = getIndicator('经济指标', ['社会效益指标', '其他指标']);
    const social = getIndicator('社会效益指标', ['其他指标']);
    const other = getIndicator('其他指标', []);
    raw.assessmentIndicators = {
      technical: splitIndicatorItems(technical),
      intellectualProperty: splitIndicatorItems(intellectualProperty),
      economicSocial: splitIndicatorItems([economic, social].filter(Boolean).join('；')),
      other: splitIndicatorItems(other),
    };
  }
  const budgetText = scalar('totalBudget');
  const budget = budgetText?.match(/(\d+(?:\.\d+)?)\s*万/)?.[1];
  if (budget) raw.totalBudget = Number(budget);
  raw.fundingDetail = scalar('fundingDetail');
  raw.spendingDetail = scalar('spendingDetail');

  for (const key of Object.keys(raw) as Array<keyof ProjectRecognizedValues>) {
    const value = raw[key];
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) delete raw[key];
  }

  const fields: DetectedField[] = (Object.keys(raw) as Array<keyof ProjectRecognizedValues>).map((key) => ({
    fieldKey: key,
    value: compactValue(raw[key]),
    confidence: key === 'name' && !scalar('name') ? 0.78 : 0.96,
    source: fileName ? `${fileName} 正文` : '文字描述',
  }));
  return { values: raw, fields, labels: fieldLabels };
}
