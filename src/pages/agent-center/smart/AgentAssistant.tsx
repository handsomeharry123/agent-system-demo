/**
 * §3.1.1 Agent 对话浮层
 *
 * 全局右下角悬浮入口 + 对话浮层
 *  - 入口：64x64px 立体小机器人 (AgentRobotIcon)
 *  - 浮层：从右下角展开 400x600px 对话窗口
 *  - 内容：标题栏 + 消息区 + 输入栏
 *  - Z-Index 1001，避免被页面内容遮挡
 *
 * 多模态上传 (P1.2)：
 *  - 文件 (PDF)
 *  - 图片 (jpg/png)
 *  - 链接 (粘贴 URL 自动识别)
 *  - 文本 (回车发送)
 *  - 语音 (前端 mock 转写)
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Alert,
  Button,
  Input,
  Progress,
  Space,
  Tag,
  Tooltip,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  ApiOutlined,
  AudioOutlined,
  CloseOutlined,
  CloudUploadOutlined,
  FilePdfOutlined,
  LinkOutlined,
  PaperClipOutlined,
  SendOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import RobotIcon from './AgentRobotIcon';
import AgentMessageBubble from './AgentMessageBubble';
import { useSmartDraft } from './store.tsx';
import type { AgentMessageType, AgentMood } from './types';

const { Text } = Typography;
const { TextArea } = Input;

// ──────────────────────────────────────────────────────────────────────
// 多模态「识别」模拟函数 —— 实际生产环境应替换为后端接口
// ──────────────────────────────────────────────────────────────────────

interface RecognizeResult {
  fields: Array<{ fieldKey: string; value: string; confidence: number; source: string }>;
  summary: string;
}

const recognizeAuditProjectFile = async (fileName: string): Promise<RecognizeResult> => {
  await new Promise((resolve) => setTimeout(resolve, 900));
  return {
    fields: [
      { fieldKey: 'completion', value: '95%', confidence: 0.96, source: `${fileName} 项目建设内容` },
      { fieldKey: 'completionNote', value: '项目核心功能已完成建设并进入院内试运行，相关证明材料已上传。', confidence: 0.93, source: `${fileName} 项目建设内容` },
      { fieldKey: 'used', value: '136.8 万元', confidence: 0.95, source: `${fileName} 资金使用情况` },
      { fieldKey: 'fundDetail', value: '资金主要用于软硬件采购、实施服务、模型训练及系统测试。', confidence: 0.91, source: `${fileName} 资金使用情况` },
    ],
    summary: `已从「${fileName}」识别并预填 4 个项目审计字段。请单选或多选字段后确认采纳。`,
  };
};

const recognizeResourceRegistration = (
  input: string,
  source: string,
  fillDefaults: boolean,
): RecognizeResult => {
  const fields: RecognizeResult['fields'] = [];
  const add = (fieldKey: string, value: string, confidence = 0.9) => {
    fields.push({ fieldKey, value, confidence, source });
  };
  const resourceCodes = ['HIS', 'EMR', 'PACS', 'RIS', 'LIS', 'HISM', 'IDR', 'ODR', 'CDR', 'BI', 'PIVAS', 'PASS', 'PDS', 'ODS', 'ONW', 'OCS', 'IDS', 'INW', 'IHM', 'EMPI']
    .filter((code) => new RegExp(`\\b${code}\\b`, 'i').test(input));
  if (resourceCodes.length) add('resources', resourceCodes.join('；'), 0.96);
  else if (fillDefaults) add('resources', 'HIS；EMR', 0.82);

  const owner = input.match(/(?:资源)?负责人[：:\s]*([\u4e00-\u9fa5]{2,10})/i)?.[1];
  if (owner) add('owner', owner, 0.94);
  else if (fillDefaults) add('owner', '张志远', 0.84);
  const contact = input.match(/(?:1\d{10}|0\d{2,3}-?\d{7,8})/)?.[0];
  if (contact) add('contact', contact, 0.97);
  else if (fillDefaults) add('contact', '13800001001', 0.84);

  const protocol = /FHIR/i.test(input) ? 'FHIR'
    : /DICOM/i.test(input) ? 'DICOM'
      : /(?:数据库|MySQL|Oracle|PostgreSQL|\bDB\b)/i.test(input) ? 'DB'
        : /(?:Kafka|RabbitMQ|消息队列|\bMQ\b)/i.test(input) ? 'MQ'
          : /HL7|MLLP/i.test(input) || fillDefaults ? 'HL7' : '';
  if (protocol) {
    add('protocol', protocol, 0.95);
    const defaults: Record<string, Record<string, string>> = {
      HL7: { version: 'v2.x', transport: 'MLLP', ip: '10.20.30.41', port: '6661' },
      FHIR: { transport: 'HTTPS', url: 'https://fhir.hospital.local/r4', key: 'fhir-demo-key' },
      DICOM: { name: 'HOSPITAL_PACS', ip: '10.20.30.42', port: '11112' },
      DB: { dbType: 'MySQL', ip: '10.20.30.43', port: '3306' },
      MQ: { mqType: 'Kafka', broker: 'mq.hospital.local', port: '9092', auth: 'SASL' },
    };
    Object.entries(defaults[protocol]).forEach(([key, value]) => add(key, value, 0.8));
  }
  return {
    fields,
    summary: fields.length
      ? `已识别 ${fields.length} 个资源注册字段并自动填充到表单，请核对后补充缺失信息。`
      : '暂未识别到明确的资源注册字段，请补充资源名称、负责人、联系方式或对接方式。',
  };
};

const recognizeResourcePermission = (input: string, fillDefaults = false): RecognizeResult => {
  const agentMap: Array<[RegExp, string]> = [
    [/XNK-0001|智能导诊/i, 'XNK-0001'], [/FNK-0001|肺结节/i, 'FNK-0001'],
    [/PFK-0001|合理用药|审方/i, 'PFK-0001'], [/JZK-0001|急诊预检/i, 'JZK-0001'],
    [/SJK-0001|麻醉/i, 'SJK-0001'], [/XNK-0002|随访/i, 'XNK-0002'],
  ];
  const agentId = agentMap.find(([pattern]) => pattern.test(input))?.[1] || (fillDefaults ? 'XNK-0001' : undefined);
  const resourceIds = Array.from(input.matchAll(/R-\d{4}/gi)).map((match) => match[0].toUpperCase());
  if (fillDefaults && resourceIds.length === 0) resourceIds.push('R-0001');
  const fields: RecognizeResult['fields'] = [];
  if (agentId) fields.push({ fieldKey: 'agentId', value: agentId, confidence: 0.95, source: '文字/语音描述' });
  if (resourceIds.length) fields.push({ fieldKey: 'resourceIds', value: resourceIds.join('；'), confidence: 0.95, source: '文字/语音描述' });
  if (input && !/^https?:\/\//i.test(input)) fields.push({ fieldKey: 'reason', value: input.slice(0, 200), confidence: 0.82, source: '文字/语音描述' });
  return { fields, summary: fields.length ? `已识别 ${fields.length} 个权限申请字段并填充到表单。` : '请补充智能体名称或编号、资源编号和申请理由。' };
};

const answerResourceDetailQuestion = (question: string, context: any): string => {
  const outOfScope = '超出当前资源信息范围，暂无法为您解答，我们将持续完善。';
  if (!context) return outOfScope;
  if (/负责人|联系人|联系方式|电话/.test(question)) {
    return `当前资源负责人为${context.owner || '未登记'}，联系方式为${context.contact || '未登记'}。`;
  }
  if (/对接|协议|技术|接口|地址|端口|版本|鉴权|配置/.test(question)) {
    return `当前资源采用${context.protocol || '未登记'}对接。${context.technicalFields ? `技术配置：${context.technicalFields}。` : '暂无更多技术配置信息。'}`;
  }
  if (/资源名称|什么资源|资源编号|资源ID|基本信息/.test(question)) {
    return `当前资源为【${context.resourceName}】，资源 ID：${context.resourceId}，对接方式：${context.protocol || '未登记'}，负责人：${context.owner || '未登记'}。`;
  }
  if (/申请状态|审核|审批|申请信息|申请编号|申请人|申请理由/.test(question)) {
    return `申请 ID：${context.applicationId}，当前状态：${context.applicationStatus}，申请人：${context.applicant || '未登记'}，申请理由：${context.reason || '未填写'}${context.reviewComment ? `，审核说明：${context.reviewComment}` : ''}。`;
  }
  if (/智能体|所属科室|诊疗环节/.test(question)) {
    return `关联智能体为【${context.agentName}】（${context.agentId}），所属科室：${context.department || '未登记'}。`;
  }
  return outOfScope;
};

const answerAuditProjectDetailQuestion = (question: string, context: any): string => {
  const outOfScope = '超出当前项目审计信息详情页信息范围，暂无法为您解答，我们将持续完善。';
  if (!context) return outOfScope;
  if (/项目名称|什么项目|项目叫什么/.test(question)) return `当前项目为【${context.name}】。`;
  if (/申报科室|哪个科室|所属科室/.test(question)) return `该项目的申报科室为${context.dept}。`;
  if (/申报赛道|赛道|项目类型/.test(question)) return `该项目的申报赛道为${context.track}。`;
  if (/项目负责人|负责人/.test(question)) return `该项目负责人为${context.owner}。`;
  if (/项目联系人|联系人/.test(question)) return `该项目联系人为${context.contact}，联系方式为${context.phone}。`;
  if (/联系方式|联系电话|电话/.test(question)) return `该项目联系方式为${context.phone}。`;
  if (/证明材料|材料|附件|文件/.test(question)) return `当前详情页展示了 ${context.materials.length} 份证明材料：${context.materials.join('、')}。`;
  if (/建设内容|完成情况|完成度|进度/.test(question)) return `项目建设内容完成度为 ${context.completion || 80}%。${context.completionDescription}`;
  if (/考核指标|指标|达成情况|达成率/.test(question)) return `项目考核指标达成率为 ${context.indicator || 85}%。${context.indicatorDescription}`;
  if (/资金|经费|使用率/.test(question)) return `项目资金使用率为 ${context.fund || 74}%。${context.fundDescription}`;
  if (/基本信息|项目情况|详情|概况|介绍/.test(question)) {
    return `【${context.name}】由${context.dept}申报，申报赛道为${context.track}，项目负责人为${context.owner}，联系人为${context.contact}；建设内容完成度 ${context.completion || 80}%，考核指标达成率 ${context.indicator || 85}%，资金使用率 ${context.fund || 74}%。`;
  }
  return outOfScope;
};

const answerEvaluationReportQuestion = (question: string, context: any): string => {
  const outOfScope = '超出当前评测结果详情信息范围，暂无法为您解答，我们将持续完善。';
  if (!context) return outOfScope;
  if (/智能体|基本信息|编号|版本|科室|发起人/.test(question)) {
    return `当前被评测智能体为【${context.agentName}】（${context.agentCode}），版本 ${context.version}，归属科室：${context.department}，发起人：${context.creator || '未展示'}。`;
  }
  if (/综合得分|总分|多少分|整体风险|风险等级|结论|红线|具体说明|为什么/.test(question)) {
    return `本次评测综合得分为 ${context.totalScore ?? 0} 分，整体风险等级为${context.overallRisk || context.riskLevel}，核心结论为${context.conclusion || '暂无'}${context.redLineTriggered ? '，已触发评测红线' : '，未触发评测红线'}。具体说明：${context.detailDesc || '暂无'}。`;
  }
  if (/维度|指标|攻击成功率|生成合规率|拒绝率|隐私泄露率|原始值|最高|最低|得分/.test(question)) {
    if (!context.dimensions?.length) return '当前评测结果详情页暂无维度得分数据。';
    return `本次各维度评测结果：${context.dimensions.map((item: any) => `${item.dimension}（${item.indicatorName}，原始值 ${item.rawValue}%，得分 ${item.score}，风险${item.riskLevel}）`).join('；')}。`;
  }
  if (/历次|历史|趋势|以往|上次/.test(question)) {
    if (!context.history?.length) return '该智能体当前没有历次评测记录。';
    return `该智能体共有 ${context.history.length} 条历次评测记录：${context.history.map((item: any) => `${item.evalTime}，整体风险${item.overallRisk}，结论${item.conclusion}`).join('；')}。`;
  }
  if (/状态|时间|提交|完成|审核|退回原因|审核说明|任务编号/.test(question)) {
    return `任务编号：${context.taskNo}，当前状态：${context.status}，提交评测时间：${context.submitTime || '未展示'}，评测完成时间：${context.evalCompleteTime || '未展示'}${context.reviewComment ? `，审核说明：${context.reviewComment}` : ''}。`;
  }
  if (/报告|查看|下载/.test(question)) {
    return context.reportReady
      ? '当前评测结果报告支持在页面顶部在线查看，也可以下载 PDF 文件。'
      : '当前评测尚未生成可查看或下载的结果报告。';
  }
  return outOfScope;
};

const answerBusinessMonitoringQuestion = (question: string, context: any): string => {
  const outOfScope = '超出当前业务监控信息范围，暂无法为您解答，我们将持续完善。';
  if (!context) return outOfScope;
  if (/累计调用|总调用|调用多少|今日调用|当天调用|成功率/.test(question)) return `${context.scope}智能体累计调用 ${Number(context.totalCalls).toLocaleString()} 次，今日调用 ${Number(context.todayCalls).toLocaleString()} 次，累计调用成功率为 ${context.successRate}%，今日调用成功率为 ${context.todaySuccessRate}%。`;
  if (/并发|吞吐/.test(question)) return `当前并发数为 ${context.concurrency.current}，峰值为 ${context.concurrency.peak}；当前吞吐量为 ${context.throughput.current}${context.throughput.unit}，峰值为 ${context.throughput.peak}${context.throughput.unit}。`;
  if (/响应时间|耗时|延迟|超时/.test(question)) return `当前平均响应时间为 ${context.avgResponseTime} 秒，响应超时率为 ${context.timeoutRate}%。页面响应时间分布为：${context.responseTimeDistribution}。`;
  if (/采纳率|医生采纳/.test(question)) return `当前医生采纳率为 ${context.adoptionRate}%。`;
  if (/反馈|满意|不满意/.test(question)) return `当前用户反馈分布为：满意 ${context.feedback.满意}%，一般 ${context.feedback.一般}%，不满意 ${context.feedback.不满意}%。`;
  if (/排行|排名|TOP|最多|高频|哪个智能体/i.test(question)) return context.topAgents.length ? `${context.scope}高频调用智能体排行：${context.topAgents.map((item: any) => `${item.name} ${Number(item.calls).toLocaleString()} 次`).join('；')}。` : `${context.scope}当前没有可展示的高频调用智能体排行数据。`;
  if (/趋势|日趋势|周趋势|月趋势|变化/.test(question)) return '当前业务监控页展示调用次数的近 15 日、近 15 周、近 12 月趋势，以及成功率和医生采纳率的近 15 日趋势。';
  return outOfScope;
};

const answerStatusMonitoringQuestion = (question: string, context: any): string => {
  const outOfScope = '超出当前状态监控信息范围，暂无法为您解答，我们将持续完善。';
  if (!context) return outOfScope;
  if (/在线|离线|禁用|异常|状态|多少个|数量|占比|在线率|离线率/.test(question)) return `${context.scope}共有 ${context.total} 个智能体：在线 ${context.online} 个（${context.onlineRate}%）、离线 ${context.offline} 个（${context.offlineRate}%）、禁用 ${context.disabled} 个、异常 ${context.abnormal} 个。`;
  if (/心跳|最后心跳|实例/.test(question)) return context.agents.length ? `${context.scope}智能体心跳情况：${context.agents.map((item: any) => `${item.name}心跳率 ${(item.heartbeatRate * 100).toFixed(2)}%，实例 ${item.instances.online}/${item.instances.expected}，最后心跳 ${item.lastHeartbeatAt}`).join('；')}。` : `${context.scope}暂无智能体心跳数据。`;
  if (/版本|运行版本|注册版本/.test(question)) return context.agents.length ? `${context.scope}智能体版本情况：${context.agents.map((item: any) => `${item.name}运行版本 ${item.runVersion}、注册版本 ${item.registryVersion}`).join('；')}。` : `${context.scope}暂无智能体版本数据。`;
  if (/哪些|列表|明细|智能体/.test(question)) return context.agents.length ? `${context.scope}智能体状态明细：${context.agents.map((item: any) => `${item.name}（${item.status}）`).join('；')}。` : `${context.scope}暂无智能体状态明细。`;
  return outOfScope;
};

const answerCostMonitoringQuestion = (question: string, context: any): string => {
  const outOfScope = '超出当前成本监控信息范围，暂无法为您解答，我们将持续完善。';
  if (!context) return outOfScope;
  const resources = context.resources as Array<any>;
  const requested = resources.filter((item) => {
    if (/CPU|cpu|处理器/.test(question)) return item.key === 'cpu';
    if (/GPU|gpu|显卡/.test(question)) return item.key === 'gpu';
    if (/内存/.test(question)) return item.key === 'memory';
    if (/Token|token|令牌/.test(question)) return item.key === 'token';
    return false;
  });
  const targets = requested.length ? requested : resources;
  if (/排行|排名|TOP|最多|最高|消耗大|哪个智能体/i.test(question)) {
    return targets.map((item) => item.top5.length
      ? `${item.title}使用量排行：${item.top5.map((row: any, index: number) => `${index + 1}. ${row.name}（${row.department}）${Number(row.value).toLocaleString()} ${item.unit}`).join('；')}`
      : `${context.scope}${item.title}暂无排行数据`).join('。') + '。';
  }
  if (/累计|总量|总使用|使用量|消耗|成本|资源|多少|概况|汇总|当日|今日|当天/.test(question)) {
    const includeToday = /当日|今日|当天/.test(question);
    const includeTotal = /累计|总量|总使用|自上线/.test(question) || !includeToday;
    return `${context.scope}智能体${targets.map((item) => {
      const parts = [];
      if (includeTotal) parts.push(`累计${Number(item.total).toLocaleString()} ${item.unit}`);
      if (includeToday) parts.push(`当日${Number(item.today).toLocaleString()} ${item.unit}`);
      return `${item.title}${parts.join('、')}`;
    }).join('；')}。`;
  }
  if (/时间|口径|自上线|00:00|刷新/.test(question)) {
    return '累计使用量统计自智能体上线以来的数据；当日使用量统计当天 00:00 至当前的数据，页面每 60 秒自动刷新，也支持手动刷新。';
  }
  return outOfScope;
};

const answerAlertRulesQuestion = (question: string, context: any): string => {
  const outOfScope = '超出当前告警规则页信息范围，暂无法为您解答，我们将持续完善。';
  const rules = context?.rules as Array<any> | undefined;
  if (!rules) return outOfScope;
  const typePatterns: Array<[RegExp, string]> = [
    [/业务监控|业务告警|业务规则/, 'business'],
    [/状态监控|状态告警|状态规则/, 'status'],
    [/成本监控|成本告警|成本规则/, 'cost'],
    [/安全监控|安全告警|安全规则/, 'security'],
  ];
  const selectedType = typePatterns.find(([pattern]) => pattern.test(question))?.[1];
  const typeRules = selectedType ? rules.filter((rule) => rule.type === selectedType) : rules;
  const namedRule = rules.find((rule) => question.includes(rule.name)) ||
    rules.find((rule) => question.includes(rule.metric) || question.includes(rule.name.replace(/告警$/, '')));
  if (namedRule) {
    if (/触发|条件|阈值|指标|什么时候/.test(question)) return `【${namedRule.name}】的触发条件为：${namedRule.triggerCondition}。`;
    if (/规则内容|内容|作用|说明/.test(question)) return `【${namedRule.name}】的规则内容为：${namedRule.content}。`;
    if (/类型|分类/.test(question)) return `【${namedRule.name}】属于${namedRule.typeLabel}。`;
    if (/什么|详情|介绍|信息|了解|查询|看看/.test(question)) return `【${namedRule.name}】属于${namedRule.typeLabel}，触发条件为“${namedRule.triggerCondition}”，规则内容为“${namedRule.content}”。`;
  }
  if (/多少|几条|数量|统计|概况/.test(question)) {
    if (selectedType) return `当前共有 ${typeRules.length} 条${typeRules[0]?.typeLabel || '该类型告警规则'}。`;
    const counts = typePatterns.map(([, type]) => {
      const rows = rules.filter((rule) => rule.type === type);
      return `${rows[0]?.typeLabel || type} ${rows.length} 条`;
    });
    return `当前共有 ${rules.length} 条告警规则：${counts.join('、')}。`;
  }
  if (/哪些|列表|名称|有什么|所有|全部/.test(question) && (selectedType || /告警规则|规则/.test(question))) {
    if (!typeRules.length) return '当前页面没有该类型的告警规则。';
    return `${selectedType ? typeRules[0].typeLabel : '当前告警规则'}共 ${typeRules.length} 条：${typeRules.map((rule) => rule.name).join('、')}。`;
  }
  return outOfScope;
};

const recognizeFile = async (fileName: string): Promise<RecognizeResult> => {
  // 模拟「正在识别」的延迟
  await new Promise((r) => setTimeout(r, 1500));
  if (/建设需求自动填充示例/i.test(fileName)) {
    const fields: RecognizeResult['fields'] = [
      { fieldKey: 'name', value: '心电智能辅助诊断助手', confidence: 0.99, source: `${fileName} 第 2 行` },
      { fieldKey: 'department', value: '心内科', confidence: 0.99, source: `${fileName} 第 2 行` },
      { fieldKey: 'reason', value: '当前心电图检查结果主要依赖医生人工判读，在门诊高峰期存在报告等待时间较长、异常特征容易遗漏、结果表达不统一等问题，希望通过智能体提升判读效率与质量。', confidence: 0.99, source: `${fileName} 第 2 行` },
      { fieldKey: 'proposer', value: 'admin', confidence: 0.99, source: `${fileName} 第 2 行` },
      { fieldKey: 'contactPhone', value: '13800138001', confidence: 0.99, source: `${fileName} 第 2 行` },
      { fieldKey: 'clinicalStage', value: '辅助诊断', confidence: 0.99, source: `${fileName} 第 2 行` },
      { fieldKey: 'description', value: '面向门诊及住院患者的心电图检查场景，自动识别ST段抬高、室性早搏等异常特征，生成结构化辅助诊断建议并提示医生复核。', confidence: 0.99, source: `${fileName} 第 2 行` },
      { fieldKey: 'resources', value: '业务系统；模型', confidence: 0.99, source: `${fileName} 第 2 行` },
      { fieldKey: 'urgency', value: '中', confidence: 0.99, source: `${fileName} 第 2 行` },
    ];
    return { fields, summary: `已从「${fileName}」中识别全部 9 个需求登记字段，并自动填充到表单。` };
  }
  // 通用 PDF 识别模板：覆盖 PRD §3.1.2.2/2.3 必填字段，不再依赖文件名启发式
  // 仅当文件名含「技术规格|API」关键词时额外补充技术信息字段
  const isTechSpec = /技术规格|API|接口|SDK|OTel/i.test(fileName);
  const baseFields: RecognizeResult['fields'] = [
    { fieldKey: 'name', value: '智能辅助诊断系统', confidence: 0.96, source: `${fileName} §1.1` },
    { fieldKey: 'version', value: '2.1', confidence: 0.93, source: `${fileName} §1.3` },
    { fieldKey: 'modelName', value: 'DeepSeek-V3', confidence: 0.91, source: `${fileName} §1.3 模型配置` },
    { fieldKey: 'modelVersion', value: '2.1', confidence: 0.89, source: `${fileName} §1.3 模型配置` },
    { fieldKey: 'modelDeploymentMode', value: '本地化部署', confidence: 0.87, source: `${fileName} §4.1 部署架构` },
    { fieldKey: 'department', value: '心内科', confidence: 0.88, source: `${fileName} §1.4 语义联动` },
    { fieldKey: 'clinicalStage', value: '辅助诊断', confidence: 0.82, source: `${fileName} §1.4 语义联动` },
    { fieldKey: 'source', value: '第三方', confidence: 0.85, source: `${fileName} §1.5` },
    { fieldKey: 'supplier', value: '北京医云科技有限公司', confidence: 0.92, source: `${fileName} §2.1` },
    { fieldKey: 'contactName', value: '陈志远', confidence: 0.9, source: `${fileName} §2.2` },
    { fieldKey: 'contactPhone', value: '13800138001', confidence: 0.86, source: `${fileName} §2.2` },
    { fieldKey: 'description', value: '面向门诊心电图检查的智能辅助诊断，自动识别 ST 段抬高、室性早搏等异常，输出结构化报告', confidence: 0.91, source: `${fileName} §3.1` },
  ];
  if (isTechSpec) {
    baseFields.push(
      { fieldKey: 'accessMode', value: 'API', confidence: 0.92, source: `${fileName} §4.1` },
      { fieldKey: 'apiEndpoint', value: 'http://10.10.10.20:8080/chat', confidence: 0.9, source: `${fileName} §4.2` },
      { fieldKey: 'apiKey', value: 'ak-8f9a****-3f9a', confidence: 0.65, source: `${fileName} §4.3` },
    );
  }
  return {
    fields: baseFields,
    summary: isTechSpec
      ? `已从「${fileName}」中识别 ${baseFields.length} 个字段（含 ${baseFields.length - 9} 个技术信息，API key 置信度偏低请确认），可选择字段采纳到表单。`
      : `已从「${fileName}」中识别 ${baseFields.length} 个字段，可选择字段采纳到表单。`,
  };
};

const recognizeImage = async (fileName: string): Promise<RecognizeResult> => {
  await new Promise((r) => setTimeout(r, 1200));
  return {
    fields: [
      { fieldKey: 'name', value: 'OCR 识别：影像分析助手', confidence: 0.78, source: `${fileName}` },
      { fieldKey: 'contactPhone', value: '13900139002', confidence: 0.6, source: `${fileName}` },
    ],
    summary: `已对图片「${fileName}」完成 OCR 识别，置信度较低，建议核对。`,
  };
};

const recognizeLink = async (url: string): Promise<RecognizeResult> => {
  await new Promise((r) => setTimeout(r, 1500));
  return {
    fields: [
      { fieldKey: 'name', value: '链取引擎：在线问诊智能体', confidence: 0.74, source: url },
      { fieldKey: 'version', value: '1.5', confidence: 0.7, source: url },
      { fieldKey: 'modelName', value: 'Qwen2.5', confidence: 0.68, source: url },
      { fieldKey: 'modelVersion', value: '1.1', confidence: 0.66, source: url },
      { fieldKey: 'modelDeploymentMode', value: '云端部署', confidence: 0.65, source: url },
      { fieldKey: 'description', value: '面向在线问诊场景的智能体，提供症状采集与初步分诊', confidence: 0.68, source: url },
    ],
    summary: `已抓取链接内容，识别 3 个字段（置信度偏低）。`,
  };
};

const recognizeText = async (text: string): Promise<RecognizeResult> => {
  await new Promise((r) => setTimeout(r, 800));
  // 简单关键词推断
  const fields: RecognizeResult['fields'] = [];
  const modelName = text.match(/(?:使用)?模型名称[：:\s]*([A-Za-z0-9._+\-/]+)/i)?.[1];
  const modelVersion = text.match(/(?:使用)?模型版本[：:\s]*(\d+\.\d+)/i)?.[1];
  const deploymentMode = text.match(/(本地化部署|云端部署|混合部署)/)?.[1];
  if (modelName) fields.push({ fieldKey: 'modelName', value: modelName, confidence: 0.94, source: '用户文本' });
  if (modelVersion) fields.push({ fieldKey: 'modelVersion', value: modelVersion, confidence: 0.94, source: '用户文本' });
  if (deploymentMode) fields.push({ fieldKey: 'modelDeploymentMode', value: deploymentMode, confidence: 0.96, source: '用户文本' });
  if (/诊断|读片|影像/.test(text)) {
    fields.push({ fieldKey: 'description', value: text, confidence: 0.6, source: '用户文本' });
    fields.push({ fieldKey: 'clinicalStage', value: '辅助诊断', confidence: 0.7, source: '用户文本 语义联动' });
  } else if (/分诊|导诊/.test(text)) {
    fields.push({ fieldKey: 'description', value: text, confidence: 0.6, source: '用户文本' });
    fields.push({ fieldKey: 'clinicalStage', value: '导诊分诊', confidence: 0.72, source: '用户文本 语义联动' });
  } else {
    fields.push({ fieldKey: 'description', value: text, confidence: 0.55, source: '用户文本' });
  }
  return { fields, summary: '已根据您的描述推断部分字段，可选择字段采纳到表单。' };
};

// ──────────────────────────────────────────────────────────────────────
// 主组件
// ──────────────────────────────────────────────────────────────────────

const CHAT_WIDTH = 480;
const CHAT_HEIGHT = 660;
const CHAT_BOTTOM_OFFSET = 40;
const HIDDEN_CHAT_MESSAGE_TYPES = new Set(['historical-plan', 'pre-audit-summary', 'pre-audit-issue']);

// ──────────────────────────────────────────────────────────────────────
// PRD §3.1.1 「位置与拖拽」: 默认右下角, 支持鼠标按住机器人拖拽到任意
// 位置, 松开即停靠并记忆位置 (浏览器级 localStorage)
// ──────────────────────────────────────────────────────────────────────

type FloatPos = { left: number; top: number };

const POS_STORAGE_KEY = 'agent_assistant_pos_v1';
const ENTRY_SIZE = 64; // 折叠态入口边长
const VIEWPORT_MARGIN = 8; // 距视口边界的最小留白

const getDefaultPos = (): FloatPos => {
  if (typeof window === 'undefined') {
    return { left: 0, top: 0 };
  }
  return {
    left: Math.max(0, window.innerWidth - ENTRY_SIZE - 24),
    top: Math.max(0, window.innerHeight - ENTRY_SIZE - 24),
  };
};

const clampPos = (pos: FloatPos, size: number): FloatPos => {
  if (typeof window === 'undefined') return pos;
  const maxLeft = Math.max(0, window.innerWidth - size - VIEWPORT_MARGIN);
  const maxTop = Math.max(0, window.innerHeight - size - VIEWPORT_MARGIN);
  return {
    left: Math.min(Math.max(VIEWPORT_MARGIN, pos.left), maxLeft),
    top: Math.min(Math.max(VIEWPORT_MARGIN, pos.top), maxTop),
  };
};

// §3.1.1 V2.2 改造: 需要让气泡顶到入口上方, 高度可达 420 的场景下重新选 top 锚点
//   - 当前 anchor 默认 pos.top - 90, 适合短文案(高度 80~150px), 气泡底部略高于入口顶端
//   - 含 previewProblems 场景下气泡高度可能 200~420px,
//     仍按 -90 锚定会把气泡底部推出视口
//   - 用 hasTallContent 标识需要让气泡底部贴近入口顶端 + 视口下界 8px 余量
// V2.3.3 改造: 移除 miniList rows > 0 的判定, 仅 miniList 折叠态(不渲染 row)
//   实际只占 30~50px(单个 ghost button), 不属于 tall content;
//   展开态由 miniExpandedAt 控制, 真展开时高度 ~200 才需要 tall 锚定
const hasTallContent = (
  welcome: {
    previewProblems?: { items: unknown[] } | null;
    miniList?: { rows: unknown[] } | null;
    evaluationSummary?: unknown;
  } | null,
  miniExpanded?: boolean,
) => {
  if (!welcome) return false;
  if (welcome.previewProblems && welcome.previewProblems.items.length > 0) return true;
  if (welcome.evaluationSummary) return true;
  // miniList 仅在「真展开」时按 tall 计算; 折叠态只是 1 个 ghost button
  if (miniExpanded && welcome.miniList && welcome.miniList.rows.length > 0) return true;
  return false;
};

const getRobotBubblePlacement = (pos: FloatPos, bubbleHeight: number, bubbleWidth = 360) => {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const margin = 8;
  const gap = 12;
  const width = Math.min(bubbleWidth, vw - margin * 2);
  const desiredLeft = pos.left - gap - width;
  const desiredTop = pos.top - gap - bubbleHeight;
  return {
    left: Math.max(margin, Math.min(desiredLeft, vw - width - margin)),
    top: Math.max(margin, Math.min(desiredTop, vh - bubbleHeight - margin)),
  };
};

const loadPos = (): FloatPos | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(POS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FloatPos>;
    if (typeof parsed.left !== 'number' || typeof parsed.top !== 'number') return null;
    if (!Number.isFinite(parsed.left) || !Number.isFinite(parsed.top)) return null;
    return { left: parsed.left, top: parsed.top };
  } catch {
    return null;
  }
};

const savePos = (pos: FloatPos) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(pos));
  } catch {
    /* quota / privacy mode — 静默忽略 */
  }
};

const AgentAssistant = () => {
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState<AgentMood>('idle');
  const [hover, setHover] = useState(false);
  const [input, setInput] = useState('');
  const [recording, setRecording] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0); // 浮层收起时新消息未读数（>0 时红点显示数字）
  const [draggingFile, setDraggingFile] = useState(false); // 拖拽文件至对话窗口任意区域
  // §3.1.1 指向性规则：列表页气泡「迷你清单」展开态；按 activeWelcome.at 归零(切 Tab 重置)
  const [miniExpandedAt, setMiniExpandedAt] = useState<number | null>(null);
  // §3.1.1 新消息吸引: 600ms 内触发红点放大闪烁 (与 bounce 同步)
  const [badgePulse, setBadgePulse] = useState(false);
  // §3.1.1 收合挫手/坐下: 关闭对话窗口后 0.7s 内 entry 播放「挫手→坐下→回站」过渡
  const [sitUntil, setSitUntil] = useState<number>(0);

  // PRD §3.1.1 「位置与拖拽」
  const [pos, setPos] = useState<FloatPos>(() => {
    const stored = loadPos();
    return stored ? clampPos(stored, ENTRY_SIZE) : getDefaultPos();
  });
  // 拖拽监听器必须保持稳定；用 ref 读取最新坐标，避免每次 mousemove 更新状态后
  // effect 清理 window 监听器，造成在固定列表格区域上只能移动一小段就中断。
  const posRef = useRef(pos);
  const [draggingFloat, setDraggingFloat] = useState(false);
  const dragMovedRef = useRef(false); // 区分「拖动」与「点击」, 拖动时屏蔽 click 唤起
  const dragPointerIdRef = useRef<number | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number } | null>(
    null,
  );
  const entryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  // 台账中心智能化升级(PRD §3.1):进入台账总览 / 列表页时,重置浮窗位置到右下角默认位置
  //   避免用户之前在接入中心拖动到中部的位置残留到台账页面,遮挡表格
  //   注意:只重置内存中的 pos(不删 localStorage),保留用户在其他页面的位置记忆
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname;
    const isLedgerPage = path === '/app/ledger' || path === '/app/ledger/list' || path.startsWith('/app/ledger/list?');
    if (isLedgerPage) {
      const next = getDefaultPos();
      posRef.current = next;
      setPos(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const msgEndRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);
  const welcomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // §3.1.1 新建注册页气泡「上传材料」→ 触发隐藏文件输入
  const hiddenUploadRef = useRef<HTMLInputElement>(null);
  // 用户是否曾打开过浮层 — 在此之前的初始消息 / 欢迎语都不计入未读
  const hasOpenedRef = useRef(false);
  // §3.1.1 V2.4.1: 气泡实际渲染高度(由 layout effect 写入),top 用它精修以避免预算误差
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [bubbleActualH, setBubbleActualH] = useState<number | null>(null);
  // §4.3 V5.0: materialOffer 侧气泡独立的 ref + 高度 (避免与 activeWelcome 共享 bubbleActualH 错位)
  const materialOfferRef = useRef<HTMLDivElement>(null);
  const [materialOfferH, setMaterialOfferH] = useState<number | null>(null);

  const {
    messages,
    addMessage,
    appendToLastAgent,
    applyPrefill,
    acknowledgePrefill,
    prefillMeta,
    activeWelcome,
    pushWelcomeGreeting,
    consumeWelcome,
    syncUploadedFile,
    // §4.3 V5.0: 备案材料生成提示 - 机器人旁独立侧气泡 (不在 ChatPanel 内)
    materialOffer,
    setMaterialOffer,
  } = useSmartDraft();

  const visibleMessages = useMemo(() => {
    const isNeedDraftTab =
      location.pathname === '/app/agent-needs' &&
      new URLSearchParams(location.search).get('tab') === 'draft';
    const isNeedFormPage =
      /^\/app\/agent-needs\/(?:create|edit\/[^/]+)$/.test(location.pathname);
    const isNeedDetailPage =
      /^\/app\/agent-needs\/detail\/[^/]+$/.test(location.pathname);
    const isResourceAllTab =
      location.pathname === '/app/resource-center/resources' &&
      (new URLSearchParams(location.search).get('tab') ?? 'all') === 'all';
    const isResourceDraftTab =
      location.pathname === '/app/resource-center/resources' &&
      new URLSearchParams(location.search).get('tab') === 'draft';
    const isResourceRegistrationPage =
      /^\/app\/resource-center\/resources\/(?:new|edit\/[^/]+)$/.test(location.pathname);
    const isResourceApplyAllTab = location.pathname === '/app/resource-center/applies' &&
      (new URLSearchParams(location.search).get('tab') ?? 'all') === 'all';
    const isResourceApplyForm = location.pathname === '/app/resource-center/apply-form';
    const isResourceApplyDraftTab = location.pathname === '/app/resource-center/applies' &&
      new URLSearchParams(location.search).get('tab') === 'draft';
    const isResourceApplyReviewingTab = location.pathname === '/app/resource-center/applies' &&
      new URLSearchParams(location.search).get('tab') === 'reviewing';
    const isResourceApplyPendingTab = location.pathname === '/app/resource-center/applies' &&
      new URLSearchParams(location.search).get('tab') === 'pending';
    const isResourceApplyRevokedTab = location.pathname === '/app/resource-center/applies' &&
      new URLSearchParams(location.search).get('tab') === 'revoked';
    const isResourceApplyApprovedTab = location.pathname === '/app/resource-center/applies' &&
      new URLSearchParams(location.search).get('tab') === 'approved';
    const isResourceApplyRejectedTab = location.pathname === '/app/resource-center/applies' &&
      new URLSearchParams(location.search).get('tab') === 'rejected';
    const isResourceApplyDetailPage = /^\/app\/resource-center\/applies\/[^/]+$/.test(location.pathname);
    const isResourceApprovalPage = /^\/app\/resource-center\/approval\/[^/]+$/.test(location.pathname);
    const isEvaluationReportPage = /^\/app\/evaluation\/tasks\/[^/]+\/report$/.test(location.pathname);
    const isPujiangEvaluationReportPage = /^\/app\/evaluation\/tasks\/pujiang\/(?!create$)[^/]+$/.test(location.pathname);
    const isPujiangEvaluationCreatePage = location.pathname === '/app/evaluation/tasks/pujiang/create';
    const thirdPartyCreateMatch = location.pathname.match(/^\/app\/evaluation\/tasks\/platform\/(cp-env|medagentbench)\/create$/);
    const thirdPartyReportMatch = location.pathname.match(/^\/app\/evaluation\/tasks\/platform\/(cp-env|medagentbench)\/(?!create$)[^/]+$/);
    const isEvaluationTasksPage = location.pathname === '/app/evaluation/tasks';
    const isPujiangEvaluationTasksPage = isEvaluationTasksPage &&
      new URLSearchParams(location.search).get('module') === 'pujiang';
    const evaluationTaskModule = isEvaluationTasksPage ? new URLSearchParams(location.search).get('module') : null;
    const isMonitoringOverviewPage = location.pathname === '/app/monitoring';
    const isMonitoringBusinessPage = location.pathname === '/app/monitoring/business';
    const isMonitoringStatusPage = location.pathname === '/app/monitoring/status';
    const isMonitoringCostPage = location.pathname === '/app/monitoring/cost';
    const isMonitoringAlertRulesPage = location.pathname === '/app/monitoring/alert-rules';
    const isProjectApplicationAllPage = location.pathname === '/app/project-application';
    const isProjectApplicationDraftTab = isProjectApplicationAllPage &&
      new URLSearchParams(location.search).get('status') === '草稿';
    const isProjectApplicationPendingTab = isProjectApplicationAllPage &&
      new URLSearchParams(location.search).get('status') === '待审核';
    const isProjectApplicationReviewingTab = isProjectApplicationAllPage &&
      new URLSearchParams(location.search).get('status') === '审核中';
    const isProjectApplicationRevokedTab = isProjectApplicationAllPage &&
      new URLSearchParams(location.search).get('status') === '撤销修改';
    const isProjectApplicationRejectedTab = isProjectApplicationAllPage &&
      new URLSearchParams(location.search).get('status') === '立项不通过';
    const isProjectApplicationPassedTab = isProjectApplicationAllPage &&
      new URLSearchParams(location.search).get('status') === '立项通过';
    const isProjectApplicationFormPage =
      /^\/app\/project-application\/(?:create|edit\/[^/]+)$/.test(location.pathname);
    const isAuditProjectPage = location.pathname === '/app/audit/project';
    const isMonitoringAlertEventsPage = location.pathname === '/app/monitoring/alert-events';
    const isMonitoringAlertDetailPage = /^\/app\/monitoring\/alert-events\/[^/]+$/.test(location.pathname);
    const isMonitoringAlertReviewPage = /^\/app\/monitoring\/alert-events\/[^/]+\/review$/.test(location.pathname);
    const isMonitoringAlertHandlingTab = isMonitoringAlertEventsPage &&
      new URLSearchParams(location.search).get('tab') === 'handling';
    const isMonitoringAlertPendingAssignTab = isMonitoringAlertEventsPage &&
      new URLSearchParams(location.search).get('tab') === 'pending_assign';
    const isMonitoringAlertPendingTab = isMonitoringAlertEventsPage &&
      new URLSearchParams(location.search).get('tab') === 'pending_handle';
    const isMonitoringAlertPendingReviewTab = isMonitoringAlertEventsPage &&
      new URLSearchParams(location.search).get('tab') === 'pending_review';
    const isMonitoringAlertReviewingTab = isMonitoringAlertEventsPage &&
      new URLSearchParams(location.search).get('tab') === 'reviewing';
    // 项目审计的列表 Tab 与填报表单共用 /app/audit/project，不能仅靠 pathname
    // 判断当前场景。侧边气泡自动收起后 activeWelcome 会被清空，因此再从消息
    // 队列中取最近一次审计欢迎语，保证稍后打开窗口仍能看到当前 Tab 的引导。
    const activeAuditPageKey = activeWelcome?.pageKey.startsWith('audit-project-')
      ? activeWelcome.pageKey
      : [...messages]
          .reverse()
          .find((message) => message.id.startsWith('__welcome__:audit-project-'))
          ?.id.match(/^__welcome__:(audit-project-[^:]+):/)?.[1];
    return messages.filter((m) => {
      if (HIDDEN_CHAT_MESSAGE_TYPES.has(m.type)) return false;
      // 草稿入口只展示当前草稿场景的欢迎消息，避免接入中心、需求列表等
      // 历史页面欢迎气泡混入当前智能体窗口；用户后续对话消息仍正常保留。
      if (isNeedDraftTab && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:agent-needs-draft:');
      }
      if (isProjectApplicationAllPage && m.id.startsWith('__welcome__:')) {
        return isProjectApplicationDraftTab
          ? m.id.startsWith('__welcome__:project-application-draft:')
          : isProjectApplicationPendingTab
          ? m.id.startsWith('__welcome__:project-application-pending:')
          : isProjectApplicationReviewingTab
          ? m.id.startsWith('__welcome__:project-application-reviewing:')
          : isProjectApplicationRevokedTab
          ? m.id.startsWith('__welcome__:project-application-revoked:')
          : isProjectApplicationRejectedTab
          ? m.id.startsWith('__welcome__:project-application-rejected:')
          : isProjectApplicationPassedTab
          ? m.id.startsWith('__welcome__:project-application-passed:')
          : m.id.startsWith('__welcome__:project-application-all:');
      }
      if (isProjectApplicationFormPage && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:project-application-form:');
      }
      if (isAuditProjectPage && m.id.startsWith('__welcome__:audit-project-')) {
        return activeAuditPageKey
          ? m.id.startsWith(`__welcome__:${activeAuditPageKey}:`)
          : false;
      }
      // 生成需求与编辑需求草稿共用同一套智能体流程：上传材料 → 识别填充
      // → 采纳 → 提交。进入表单后仅保留该流程的欢迎/节点消息，避免草稿
      // 列表或「新建注册」等其他页面的历史欢迎气泡串入当前窗口。
      if (isNeedFormPage && m.id.startsWith('__welcome__:')) {
        return (
          m.id.startsWith('__welcome__:agent-needs-create:') ||
          m.id.startsWith('__welcome__:agent-needs-complete:')
        );
      }
      if (isNeedDetailPage && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:agent-needs-detail:');
      }
      if (isResourceAllTab && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:resource-center-all:');
      }
      if (isResourceDraftTab && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:resource-center-draft:');
      }
      if (isResourceRegistrationPage && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:resource-center-register:');
      }
      if (isResourceApplyAllTab && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:resource-apply-all:');
      }
      if (isResourceApplyForm && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:resource-apply-form:');
      }
      if (isResourceApplyDraftTab && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:resource-apply-draft:');
      }
      if (isResourceApplyReviewingTab && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:resource-apply-reviewing:');
      }
      if (isResourceApplyPendingTab && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:resource-apply-pending:');
      }
      if (isResourceApplyRevokedTab && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:resource-apply-revoked:');
      }
      if (isResourceApplyApprovedTab && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:resource-apply-approved:');
      }
      if (isResourceApplyRejectedTab && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:resource-apply-rejected:');
      }
      if (isResourceApplyDetailPage && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:resource-apply-detail:');
      }
      if (isResourceApprovalPage && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:resource-approval:');
      }
      if (isEvaluationReportPage && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:evaluation-report:');
      }
      if (isPujiangEvaluationReportPage && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:pujiang-evaluation-report:');
      }
      if (isPujiangEvaluationCreatePage && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:pujiang-evaluation-create:');
      }
      if (thirdPartyCreateMatch && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith(`__welcome__:${thirdPartyCreateMatch[1]}-evaluation-create:`);
      }
      if (thirdPartyReportMatch && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith(`__welcome__:${thirdPartyReportMatch[1]}-evaluation-report:`);
      }
      if (isEvaluationTasksPage && m.id.startsWith('__welcome__:')) {
        if (evaluationTaskModule === 'cp-env') return m.id.startsWith('__welcome__:cp-env-evaluation-tasks:');
        if (evaluationTaskModule === 'medagentbench') return m.id.startsWith('__welcome__:medagentbench-evaluation-tasks:');
        return m.id.startsWith(
          isPujiangEvaluationTasksPage
            ? (m.id.startsWith('__welcome__:pujiang-evaluation-created:')
              ? '__welcome__:pujiang-evaluation-created:'
              : '__welcome__:pujiang-evaluation-tasks:')
            : '__welcome__:evaluation-tasks:',
        );
      }
      if (isMonitoringOverviewPage && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:monitoring-overview:');
      }
      if (isMonitoringBusinessPage && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:monitoring-business:');
      }
      if (isMonitoringStatusPage && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:monitoring-status:');
      }
      if (isMonitoringCostPage && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:monitoring-cost:');
      }
      if (isMonitoringAlertRulesPage && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:monitoring-alert-rules:');
      }
      if (isMonitoringAlertEventsPage && m.id.startsWith('__welcome__:')) {
        return isMonitoringAlertPendingAssignTab
          ? m.id.startsWith('__welcome__:monitoring-alert-pending-assign:')
          : isMonitoringAlertPendingTab
          ? m.id.startsWith('__welcome__:monitoring-alert-pending:')
          : isMonitoringAlertPendingReviewTab
          ? m.id.startsWith('__welcome__:monitoring-alert-pending-review:')
          : isMonitoringAlertHandlingTab
          ? m.id.startsWith('__welcome__:monitoring-alert-handling:')
          : isMonitoringAlertReviewingTab
          ? m.id.startsWith('__welcome__:monitoring-alert-reviewing:')
          : m.id.startsWith('__welcome__:monitoring-alert-events:');
      }
      if (isMonitoringAlertDetailPage && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:monitoring-alert-detail:');
      }
      if (isMonitoringAlertReviewPage && m.id.startsWith('__welcome__:')) {
        return m.id.startsWith('__welcome__:monitoring-alert-review:');
      }
      return true;
    });
  }, [activeWelcome, location.pathname, location.search, messages]);

  // 滚动到底部
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // §3.1.1 V2.4.1: 用 ResizeObserver 实时读 bubble 实际渲染高度,
  //   写到 bubbleActualH 让 top 公式不再依赖预算 → 真正紧贴 entry.top - 12
  useLayoutEffect(() => {
    const el = bubbleRef.current;
    if (!el) return undefined;
    const update = () => {
      const h = el.offsetHeight;
      if (h > 0) setBubbleActualH(h);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeWelcome?.at]);

  // §4.3 V5.0: materialOffer 侧气泡独立 ResizeObserver, 避免与 activeWelcome 共享 bubbleActualH 错位
  useLayoutEffect(() => {
    const el = materialOfferRef.current;
    if (!el) return undefined;
    const update = () => {
      const h = el.offsetHeight;
      if (h > 0) setMaterialOfferH(h);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [materialOffer?.at]);

  // 浮层打开时: 标记已阅 + 清零未读数; 仅在用户**真正打开过**后才开始累计未读
  useEffect(() => {
    if (open) {
      hasOpenedRef.current = true;
      setUnreadCount(0);
    }
  }, [open]);

  // 监听消息数变化: 浮层关闭时累加未读条数, 浮层打开时只刷新 baseline
  // 仅在用户曾经打开过浮层后, 新增的 agent 消息才计为未读
  const lastCount = useRef(messages.length);
  useEffect(() => {
    if (!open && messages.length > lastCount.current) {
      if (hasOpenedRef.current) {
        // 仅累加 agent (assistant) 侧的新消息, 排除用户自己的输入
        const newAgentMsgs = messages.slice(lastCount.current).filter((m) => m.role === 'agent');
        if (newAgentMsgs.length > 0) {
          setUnreadCount((c) => c + newAgentMsgs.length);
          // §3.1.1 新消息: 触发红点放大闪烁 (600ms 两次脉冲, 与 bounce 同步)
          setBadgePulse(true);
          setTimeout(() => setBadgePulse(false), 1300);
        }
      }
      // 触发 bounce 动画 (.agent-robot-bounce + .agent-robot-hand-wave 通过 entryRef 兄弟组加)
      setMood('happy');
      const t = setTimeout(() => setMood('idle'), 1200);
      return () => clearTimeout(t);
    }
    lastCount.current = messages.length;
    return undefined;
  }, [messages.length, open, messages]);

  // PRD §3.1.1 欢迎语：当前激活的 page-level 欢迎气泡
  //   - 进入 smart-register 等页面, pushWelcomeGreeting 写入 store.activeWelcome
  //   - 在 robot 旁 110px 显示气泡, 自动 8s 后收起 (用户点击或操作可立即消费)
  //   - 浮层打开时,气泡不重复显示 (浮层内已有相同文案)
  useEffect(() => {
    if (!activeWelcome) return;
    if (open) return; // 浮层已开, 机器人旁气泡不重复
    // 告警待办与「全部项目审计」态势都是持续处理入口，保留到用户点击机器人、
    // 状态标签或关闭按钮，避免查看列表数秒后气泡自动消失。
    if (
      activeWelcome.pageKey === 'monitoring-alert-events' ||
      activeWelcome.pageKey === 'monitoring-alert-pending-assign' ||
      activeWelcome.pageKey === 'monitoring-alert-pending-review' ||
      activeWelcome.pageKey === 'audit-project-all' ||
      activeWelcome.pageKey === 'audit-project-draft' ||
      activeWelcome.pageKey === 'audit-project-application'
    ) return;
    welcomeTimerRef.current = setTimeout(() => {
      consumeWelcome();
    }, 8000);
    return () => {
      if (welcomeTimerRef.current) {
        clearTimeout(welcomeTimerRef.current);
        welcomeTimerRef.current = null;
      }
    };
  }, [activeWelcome, open, consumeWelcome]);

  // 进入页面主动问候 (Demo 效果): 组件挂载即推一条通用欢迎
  // 真正的页面级欢迎语由 SmartRegistrationForm 在挂载时调 pushWelcomeGreeting
  useEffect(() => {
    // 仅在初始化时推一次 (与 store 内的初始消息并存, 不重复)
    // 这里留空也可,因为智能填写页会在 mount 时主动调
  }, []);

  // §3.2.1 监听气泡内紧凑版 adopt/ignore 按钮触发的 CustomEvent
  //   - 写 window.__preAuditIssueStatus[id] 让 ChatPanel 内的 pre-audit-issue 同步灰态
  //   - 同时 setLocalStatus 用 React state 让气泡自身的卡片立即重渲染(否则只读 window 不触发刷新)
  //   - 与 Audit.tsx 的处理对称; smart-register 页没有其他 listener 帮 setStatus, 这里补上
  const [bubbleStatusMap, setBubbleStatusMap] = useState<Record<string, 'adopted' | 'ignored'>>({});
  useEffect(() => {
    const onAdopt = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (!id) return;
      (window as any).__preAuditIssueStatus = (window as any).__preAuditIssueStatus || {};
      (window as any).__preAuditIssueStatus[id] = 'adopted';
      setBubbleStatusMap((prev) => ({ ...prev, [id]: 'adopted' }));
    };
    const onIgnore = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (!id) return;
      (window as any).__preAuditIssueStatus = (window as any).__preAuditIssueStatus || {};
      (window as any).__preAuditIssueStatus[id] = 'ignored';
      setBubbleStatusMap((prev) => ({ ...prev, [id]: 'ignored' }));
    };
    // 复用 chat panel 派发的同一组事件名; 仅当 ChatPanel 未挂载或本组件自身的气泡在派发时
    // (chat panel / bubble 是同一个 window, 故本地派发也会被自身监听到 — 这是预期行为,
    //  仅"外部页面无 consumer"时也保证窗口状态被驱动)
    window.addEventListener('agent-issue-adopt', onAdopt);
    window.addEventListener('agent-issue-ignore', onIgnore);
    return () => {
      window.removeEventListener('agent-issue-adopt', onAdopt);
      window.removeEventListener('agent-issue-ignore', onIgnore);
    };
  }, []);

  // ─── PRD §3.1.1 「位置与拖拽」: 视口变化时 clamp 位置 + 持久化 ───
  // - 对话浮层已与入口位置解耦 (固定 right/bottom 24), 因此只按 ENTRY_SIZE clamp
  useEffect(() => {
    const onResize = () => {
      setPos((p) => {
        const next = clampPos(p, ENTRY_SIZE);
        if (next.left !== p.left || next.top !== p.top) {
          savePos(next);
        }
        posRef.current = next;
        return next;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ─── PRD §3.1.1 「位置与拖拽」: 按住机器人拖拽, 松开停靠 ───
  // 使用 Pointer Events 并由入口捕获指针，避免光标进入表格固定列、滚动容器
  // 或页面遮罩层后丢失移动事件。
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (dragPointerIdRef.current !== e.pointerId) return;
      const start = dragStartRef.current;
      if (!start) return;
      const dx = e.clientX - start.mouseX;
      const dy = e.clientY - start.mouseY;
      if (!dragMovedRef.current && Math.hypot(dx, dy) < 3) return; // 防抖: < 3px 视为点击
      dragMovedRef.current = true;
      // 对话浮层固定在视口右下角, 与入口位置解耦, 因此拖动 clamp 只按 ENTRY_SIZE
      const next = clampPos(
        { left: start.posX + dx, top: start.posY + dy },
        ENTRY_SIZE,
      );
      posRef.current = next;
      setPos(next);
      setDraggingFloat(true);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (dragPointerIdRef.current !== e.pointerId || !dragStartRef.current) return;
      dragStartRef.current = null;
      dragPointerIdRef.current = null;
      // 拖动过才落库 + 视觉态复位
      if (dragMovedRef.current) {
        // 异步读最新 pos 写盘, 避免闭包旧值
        setPos((latest) => {
          savePos(latest);
          return latest;
        });
        setDraggingFloat(false);
      } else {
        // 纯点击: 让 click 正常走到 onClick（唤起浮层）
        setDraggingFloat(false);
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  // ─── 输入发送 ───
  const sendText = () => {
    const text = input.trim();
    if (!text) return;
    addMessage({ role: 'user', type: 'text', content: text });
    setInput('');
    if (/^\/app\/project-application\/(?:create|edit\/[^/]+)$/.test(location.pathname)) {
      window.dispatchEvent(new CustomEvent('project-application-assistant-input', {
        detail: { text, source: 'text' },
      }));
      return;
    }
    if (/^\/app\/resource-center\/applies\/[^/]+$/.test(location.pathname)) {
      addMessage({
        role: 'agent',
        type: 'text',
        content: answerResourceDetailQuestion(text, (window as any).__resourceApplyDetailContext),
      });
      return;
    }
    if (location.pathname === '/app/audit/project' && (window as any).__auditProjectDetailContext) {
      addMessage({
        role: 'agent',
        type: 'text',
        content: answerAuditProjectDetailQuestion(text, (window as any).__auditProjectDetailContext),
      });
      return;
    }
    if (/^\/app\/evaluation\/tasks\/[^/]+\/report$/.test(location.pathname)) {
      addMessage({
        role: 'agent',
        type: 'text',
        content: answerEvaluationReportQuestion(text, (window as any).__evaluationReportContext),
      });
      return;
    }
    if (location.pathname === '/app/monitoring/business') {
      addMessage({ role: 'agent', type: 'text', content: answerBusinessMonitoringQuestion(text, (window as any).__businessMonitoringContext) });
      return;
    }
    if (location.pathname === '/app/monitoring/status') {
      addMessage({ role: 'agent', type: 'text', content: answerStatusMonitoringQuestion(text, (window as any).__statusMonitoringContext) });
      return;
    }
    if (location.pathname === '/app/monitoring/cost') {
      addMessage({ role: 'agent', type: 'text', content: answerCostMonitoringQuestion(text, (window as any).__costMonitoringContext) });
      return;
    }
    if (location.pathname === '/app/monitoring/alert-rules') {
      addMessage({ role: 'agent', type: 'text', content: answerAlertRulesQuestion(text, (window as any).__alertRulesMonitoringContext) });
      return;
    }
    if (/^\/app\/monitoring\/alert-events(?:\/[^/]+)?$/.test(location.pathname)) {
      let answer = '已为您处理该筛选请求。';
      window.dispatchEvent(new CustomEvent('monitoring-alert-assistant-query', {
        detail: { text, respond: (next: string) => { answer = next; } },
      }));
      addMessage({ role: 'agent', type: 'text', content: answer });
      return;
    }
    runRecognitionFlow(() => recognizeText(text), {
      label: '正在识别文字描述…',
      resultType: 'text-detect',
      recognitionMode: 'text',
      rawText: text,
    });
  };

  // ─── PRD §3.1.1 拖拽上传至对话窗口任意区域 ───
  // 利用 window 计数法穿透 antd 组件, 兼容单页多面板场景
  useEffect(() => {
    const onWindowDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      dragCounter.current += 1;
      setDraggingFile(true);
    };
    const onWindowDragLeave = (e: DragEvent) => {
      dragCounter.current = Math.max(0, dragCounter.current - 1);
      if (dragCounter.current === 0) setDraggingFile(false);
    };
    const onWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setDraggingFile(false);
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      // 仅在浮层打开时拦截拖拽至对话窗口
      if (!open) return;
      const file = files[0] as unknown as UploadFile;
      handleUpload(file);
    };
    const onWindowDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault();
      }
    };
    window.addEventListener('dragenter', onWindowDragEnter);
    window.addEventListener('dragleave', onWindowDragLeave);
    window.addEventListener('drop', onWindowDrop);
    window.addEventListener('dragover', onWindowDragOver);
    return () => {
      window.removeEventListener('dragenter', onWindowDragEnter);
      window.removeEventListener('dragleave', onWindowDragLeave);
      window.removeEventListener('drop', onWindowDrop);
      window.removeEventListener('dragover', onWindowDragOver);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ─── 统一识别流程：先推「detecting」消息，再推「识别结果」 ───
  const runRecognitionFlow = async (
    fetcher: () => Promise<RecognizeResult>,
    extra?: {
      fileName?: string;
      fileSize?: number;
      rawText?: string;
      label?: string;
      resultType?: AgentMessageType;
      recognitionMode?: 'text' | 'voice';
    },
  ) => {
    setMood('thinking');
    addMessage({
      role: 'agent',
      type: 'detecting',
      content: extra?.label ?? '正在识别…',
      payload: extra ? { fileName: extra.fileName, fileSize: extra.fileSize } : undefined,
    });
    try {
      const recognized = await fetcher();
      const isResourceRegistration = /^\/app\/resource-center\/resources\/(?:new|edit\/[^/]+)$/.test(location.pathname);
      const isResourcePermission = location.pathname === '/app/resource-center/apply-form';
      const result = isResourcePermission
        ? recognizeResourcePermission(extra?.rawText || extra?.fileName || recognized.summary, Boolean(extra?.fileName))
        : isResourceRegistration
        ? recognizeResourceRegistration(
            extra?.rawText || extra?.fileName || recognized.summary,
            extra?.fileName || extra?.recognitionMode || '文字描述',
            Boolean(extra?.fileName),
          )
        : recognized;
      // 替换上条「detecting」为「识别结果」
      appendToLastAgent({
        type: extra?.resultType ?? (extra?.fileName
          ? /pdf/i.test(extra.fileName)
            ? 'file-detect'
            : 'image-detect'
          : 'text-detect'),
        content: result.summary,
        payload: {
          ...(extra?.fileName ? { fileName: extra.fileName } : {}),
          ...(extra?.fileSize ? { fileSize: extra.fileSize } : {}),
          ...(extra?.recognitionMode ? { recognitionMode: extra.recognitionMode } : {}),
          detectedFields: result.fields,
        },
      });
      // 写入 store
      applyPrefill(result.fields);
      if (/^\/app\/agent-needs\/(?:create|edit\/[^/]+)$/.test(location.pathname)) {
        window.dispatchEvent(new CustomEvent('agent-needs-ai-fill', {
          detail: { fields: result.fields, rawText: extra?.rawText, fileName: extra?.fileName },
        }));
      }
      if (isResourceRegistration) {
        window.dispatchEvent(new CustomEvent('resource-center-ai-fill', {
          detail: { fields: result.fields, rawText: extra?.rawText, fileName: extra?.fileName },
        }));
      }
      if (isResourcePermission) {
        window.dispatchEvent(new CustomEvent('resource-apply-ai-fill', { detail: { fields: result.fields } }));
      }
      if (location.pathname === '/app/audit/project') {
        window.dispatchEvent(new CustomEvent('audit-project-assistant-input', {
          detail: { text: extra?.rawText || extra?.fileName || result.summary, source: extra?.fileName ? 'file' : 'text' },
        }));
      }
      setMood('happy');
      setTimeout(() => setMood('idle'), 1200);
    } catch (e) {
      appendToLastAgent({
        type: 'error',
        content: '识别失败，请稍后重试。',
        payload: { errorCode: 'RECOGNIZE_FAIL' },
      });
      setMood('sad');
      setTimeout(() => setMood('idle'), 1500);
    }
  };

  // ─── 上传文件 / 图片 ───
  const handleUpload = async (file: UploadFile) => {
    const isPdf = file.name?.toLowerCase().endsWith('.pdf');
    const isDocument = /\.(pdf|doc|docx|xls|xlsx|csv)$/i.test(file.name || '');
    const size = file.size ?? 0;
    if (size > 30 * 1024 * 1024) {
      message.error('上传失败，单文件超过最大限制 30M');
      return false;
    }
    if (/^\/app\/project-application\/(?:create|edit\/[^/]+)$/.test(location.pathname)) {
      if (!/\.(pdf|doc|docx)$/i.test(file.name || '')) {
        message.error('项目申报材料仅支持 PDF、DOC、DOCX 文件');
        return false;
      }
      const rawFile = (file.originFileObj || file) as File;
      window.dispatchEvent(new CustomEvent('project-application-assistant-input', {
        detail: { text: file.name, source: 'file', file: rawFile },
      }));
      return false;
    }
    addMessage({
      role: 'user',
      type: 'text',
      content: isDocument ? `上传文件：${file.name}` : `上传图片：${file.name}`,
      payload: { fileName: file.name, fileSize: size },
    });
    if (location.pathname === '/app/audit/project') {
      if (!/\.(pdf|doc|docx)$/i.test(file.name || '')) {
        message.error('项目审计材料仅支持 PDF、DOC、DOCX 文件');
        return false;
      }
      window.dispatchEvent(new CustomEvent('audit-project-material-uploaded', {
        detail: { fileName: file.name, fileSize: size, file, source: 'assistant' },
      }));
      runRecognitionFlow(() => recognizeAuditProjectFile(file.name), {
        fileName: file.name,
        fileSize: size,
        label: `正在解析 ${file.name}…`,
      });
      return false;
    }
    // §3.1.1 同步到「备案材料」列表：仅 PDF（图片仅用于 OCR 识别，不入备案材料）。
    // 同 uid 走 store 内部去重，避免重复入列。
    if (isPdf) {
      const uid = (file.uid as string) || `agent-up-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      syncUploadedFile({ uid, name: file.name, size, type: file.type });
    }
    runRecognitionFlow(() => (isDocument ? recognizeFile(file.name) : recognizeImage(file.name)), {
      fileName: file.name,
      fileSize: size,
      label: isDocument ? `正在解析 ${file.name}…` : `正在 OCR 识别 ${file.name}…`,
    });
    return false; // 阻止 antd 默认上传
  };

  // ─── 粘贴链接 ───
  const detectLinkInText = (text: string): string | null => {
    const m = text.match(/https?:\/\/[^\s]+/);
    return m ? m[0] : null;
  };

  const onInputChange = (v: string) => {
    setInput(v);
  };

  const handleSend = () => {
    if (location.pathname === '/app/monitoring/business' || location.pathname === '/app/monitoring/status' || location.pathname === '/app/monitoring/cost' || location.pathname === '/app/monitoring/alert-rules' || /^\/app\/monitoring\/alert-events(?:\/[^/]+)?$/.test(location.pathname)) {
      sendText();
      return;
    }
    const link = detectLinkInText(input);
    if (link) {
      addMessage({ role: 'user', type: 'text', content: `发送链接：${link}` });
      setInput('');
      runRecognitionFlow(() => recognizeLink(link), {
        label: '正在抓取链接内容…',
        resultType: 'link-detect',
        rawText: link,
      });
      return;
    }
    sendText();
  };

  // ─── 语音 (mock) ───
  const toggleVoice = () => {
    if (recording) {
      setRecording(false);
      const mockTranscript = location.pathname === '/app/monitoring/alert-rules'
        ? '有哪些安全监控告警规则'
        : location.pathname === '/app/audit/project'
        ? '项目建设完成度95%，已使用金额136.8万元，资金使用率76%，资金用于软硬件采购、实施服务、模型训练和系统测试。'
        : location.pathname === '/app/monitoring/alert-events'
        ? (new URLSearchParams(location.search).get('tab') === 'pending_assign'
          ? '把全部待分派事件分派给王建国'
          : new URLSearchParams(location.search).get('tab') === 'reviewing'
          ? '审核通过，处理方案有效，告警已恢复正常，可以关闭该告警事项'
          : '帮我查找待处理的业务监控告警')
        : '我需要接入一个智能导诊助手';
      addMessage({ role: 'user', type: 'text', content: `[语音转写] ${mockTranscript}` });
      if (location.pathname === '/app/monitoring/alert-rules') {
        addMessage({ role: 'agent', type: 'text', content: answerAlertRulesQuestion(mockTranscript, (window as any).__alertRulesMonitoringContext) });
        setMood('happy');
        setTimeout(() => setMood('idle'), 1200);
        return;
      }
      if (location.pathname === '/app/monitoring/alert-events') {
        let answer = '已根据语音描述完成筛选。';
        window.dispatchEvent(new CustomEvent('monitoring-alert-assistant-query', {
          detail: { text: mockTranscript, respond: (next: string) => { answer = next; } },
        }));
        addMessage({ role: 'agent', type: 'text', content: answer });
        setMood('happy');
        setTimeout(() => setMood('idle'), 1200);
        return;
      }
      runRecognitionFlow(() => recognizeText(mockTranscript), {
        label: '正在识别语音…',
        resultType: 'text-detect',
        recognitionMode: 'voice',
        rawText: mockTranscript,
      });
      return;
    }
    setRecording(true);
    setMood('thinking');
    message.info('开始录音…再次点击结束');
  };

  // §3.1.1 欢迎气泡直接操作：打开浮层后触发文件选择或开始语音描述
  useEffect(() => {
    const onTriggerUpload = () => {
      setOpen(true);
      // 等浮层渲染后再触发隐藏 input 的文件选择
      setTimeout(() => hiddenUploadRef.current?.click(), 60);
    };
    const onTriggerVoice = () => {
      setOpen(true);
      if (!recording) toggleVoice();
    };
    window.addEventListener('agent-register-trigger-upload', onTriggerUpload);
    window.addEventListener('agent-register-trigger-voice', onTriggerVoice);
    window.addEventListener('audit-project-trigger-upload', onTriggerUpload);
    window.addEventListener('audit-project-trigger-voice', onTriggerVoice);
    return () => {
      window.removeEventListener('agent-register-trigger-upload', onTriggerUpload);
      window.removeEventListener('agent-register-trigger-voice', onTriggerVoice);
      window.removeEventListener('audit-project-trigger-upload', onTriggerUpload);
      window.removeEventListener('audit-project-trigger-voice', onTriggerVoice);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  useEffect(() => {
    const onAuditMaterialUploaded = (event: Event) => {
      const detail = (event as CustomEvent<{
        fileName?: string;
        fileSize?: number;
        source?: 'form' | 'assistant';
      }>).detail;
      // 医小管入口已在 handleUpload 中启动识别，只监听表单上传，避免生成两份识别结果。
      if (!detail?.fileName || detail.source === 'assistant') return;
      addMessage({
        role: 'user',
        type: 'text',
        content: `上传文件：${detail.fileName}`,
        payload: { fileName: detail.fileName, fileSize: detail.fileSize },
      });
      setOpen(true);
      runRecognitionFlow(() => recognizeAuditProjectFile(detail.fileName!), {
        fileName: detail.fileName,
        fileSize: detail.fileSize,
        label: `正在解析 ${detail.fileName}…`,
      });
    };
    window.addEventListener('audit-project-material-uploaded', onAuditMaterialUploaded);
    return () => window.removeEventListener('audit-project-material-uploaded', onAuditMaterialUploaded);
  });

  useEffect(() => {
    const onRefreshNeedMatch = () => {
      message.success('已刷新智能化匹配结果');
    };
    window.addEventListener('agent-needs-refresh-match', onRefreshNeedMatch);
    return () => window.removeEventListener('agent-needs-refresh-match', onRefreshNeedMatch);
  }, []);

  // ─── 批量采纳: file-detect / image-detect / link-detect 气泡的「确认采纳 (N)」入口
  // - 取代旧的「全部采纳」: 取消高置信度自动采纳, 改为用户逐项勾选后批量采纳
  // - 与 PRD §3.2.1 智能预审 / 智能审查「勾选 + 确认采纳」交互同构
  const ackBatch = (fieldKeys: string[]) => {
    const n = fieldKeys.length;
    fieldKeys.forEach((k) => acknowledgePrefill(k));
    if (n > 0) {
      message.success(`已采纳 ${n} 个 AI 预填字段到表单，可继续核对修改`);
      if (/^\/app\/agent-needs\/(?:create|edit\/[^/]+)$/.test(location.pathname)) {
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('agent-needs-prefill-acknowledged', {
            detail: { fieldKeys },
          }));
        }, 0);
      }
      if (/^\/app\/resource-center\/resources\/(?:new|edit\/[^/]+)$/.test(location.pathname)) {
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('resource-center-prefill-acknowledged', {
            detail: { fieldKeys },
          }));
        }, 0);
      }
      if (/^\/app\/project-application\/(?:create|edit\/[^/]+)$/.test(location.pathname)) {
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('project-application-prefill-acknowledged', {
            detail: { fieldKeys },
          }));
        }, 0);
      }
      if (location.pathname === '/app/audit/project') {
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('audit-project-prefill-acknowledged', {
            detail: { fieldKeys },
          }));
        }, 0);
      }
    }
    addMessage({
      role: 'agent',
      type: 'autofix-done',
      content: n > 0
        ? `已采纳 ${n} 个 AI 预填字段到下方表单（绿色对勾将在 5s 后消失），请继续核对或修改。`
        : '当前没有待采纳的 AI 预填字段。',
    });
  };

  const ackField = (k: string) => {
    acknowledgePrefill(k);
    if (/^\/app\/agent-needs\/(?:create|edit\/[^/]+)$/.test(location.pathname)) {
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('agent-needs-prefill-acknowledged', {
          detail: { fieldKeys: [k] },
        }));
      }, 0);
    }
    if (/^\/app\/resource-center\/resources\/(?:new|edit\/[^/]+)$/.test(location.pathname)) {
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('resource-center-prefill-acknowledged', {
          detail: { fieldKeys: [k] },
        }));
      }, 0);
    }
    if (/^\/app\/project-application\/(?:create|edit\/[^/]+)$/.test(location.pathname)) {
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('project-application-prefill-acknowledged', {
          detail: { fieldKeys: [k] },
        }));
      }, 0);
    }
    if (location.pathname === '/app/audit/project') {
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('audit-project-prefill-acknowledged', {
          detail: { fieldKeys: [k] },
        }));
      }, 0);
    }
  };

  // 当前 mood 注入 hover 变体
  const effectiveMood: AgentMood = hover && !open ? 'hover' : mood;
  const getWelcomeBubbleHeight = () => {
    const miniExpanded = activeWelcome && miniExpandedAt !== null && miniExpandedAt === activeWelcome.at;
    const tall = hasTallContent(activeWelcome, !!miniExpanded);
    const hasChipsOrActions = !!(
      activeWelcome &&
      ((activeWelcome.chips && activeWelcome.chips.length > 0) ||
        (activeWelcome.actions && activeWelcome.actions.length > 0) ||
        (activeWelcome.miniList && activeWelcome.miniList.rows.length > 0) ||
        activeWelcome.evaluationSummary)
    );
    return bubbleActualH ?? (tall ? 420 : hasChipsOrActions ? 280 : 80);
  };
  const shouldRetainWelcomeForChat = Boolean(
    activeWelcome && (
      activeWelcome.pageKey === 'audit-project-audit' ||
      activeWelcome.pageKey === 'audit-project-all' ||
      (
        activeWelcome.pageKey.startsWith('audit-project-') &&
        activeWelcome.miniList &&
        activeWelcome.miniList.rows.length > 0
      )
    ),
  );

  // V2.6 修复(2026-07-03):台账页面(/app/ledger 与 /app/ledger/*)由 AgentFloatHost
  //   独家负责机器人 icon + 气泡 + 对话窗口,接入中心 AgentAssistant 在该路径家族下
  //   整体隐藏(连浮层/气泡 DOM 都不挂),避免右下角出现「两个机器人」视觉重复。
  // 首页模块(/app/home 与 /app/home/*)自身已经承载医小管工作台,不展示右下角全局入口。
  //   ⚠️ 此 early return 必须在所有 hooks 之后,避免 React 18 StrictMode 下
  //   hooks 顺序漂移(参考 [[alert-event-list-pending-assign-hooks-crash]] 教训)。
  const shouldHideFloatEntry = useMemo(() => {
    const p = location.pathname;
    return (
      p === '/app/ledger' ||
      p.startsWith('/app/ledger/') ||
      p === '/app/home' ||
      p.startsWith('/app/home/')
    );
  }, [location.pathname]);
  const handleEntryPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragPointerIdRef.current = e.pointerId;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: posRef.current.left,
      posY: posRef.current.top,
    };
    dragMovedRef.current = false;
  };
  if (shouldHideFloatEntry) return null;

  return (
    <>
      {/* §3.1.1 隐藏文件输入：新建注册页气泡「上传材料」触发 */}
      <input
        ref={hiddenUploadRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f as unknown as UploadFile);
          e.target.value = '';
        }}
      />
      {/* 机器人旁 page-level 欢迎气泡 (§3.1.1 表格：进入页面 + 浮层未打开时展示)
          §4.1.1 管理员总览：文字汇报 + 可点状态 chip + 一键直达（按权限置灰） */}
      {!open && activeWelcome && (
        <div
          ref={bubbleRef}
          className="agent-welcome-bubble"
          data-testid="status-bubble"
          // PRD §3.1.1: 气泡需紧跟机器人, 拖到哪里气泡跟到哪里
          // V2.8: 气泡放在机器人左上方;拖动时保持相同距离跟随,边缘仅做视口夹紧
          // V2.1 改造(保留):
          //   - 短内容场景: maxHeight 去掉, 让气泡完全贴内容
          //   - 有 chip / miniList / 多个 action 时: 仍保留 280px 上限 + 内部滚动
          //   - inline style 显式 bottom: auto / right: auto 避免被 CSS 兜底撑到 viewport
          style={{
            ...getRobotBubblePlacement(pos, getWelcomeBubbleHeight()),
            bottom: 'auto',
            right: 'auto',
            transform: 'none',
            transformOrigin: 'bottom right',
            ['--agent-bubble-arrow-left' as any]: 'auto',
            ['--agent-bubble-arrow-right' as any]: '18px',
            ['--agent-bubble-arrow-bottom' as any]: '-6px',
            // 仅 previewProblems 触发时放宽到 360, 其它场景维持 280 —
            //   4 条问题 × ~50px(标题 + 行 + 链接按钮) ≈ 200px, 加上面板标题/正文容不下
            maxHeight:
              activeWelcome.previewProblems && activeWelcome.previewProblems.items.length > 0
                ? 'min(420px, calc(100vh - 32px))'
                : activeWelcome.evaluationSummary
                  ? 'min(460px, calc(100vh - 32px))'
                : ((activeWelcome.chips && activeWelcome.chips.length > 0) ||
                (activeWelcome.actions && activeWelcome.actions.length > 0) ||
                (activeWelcome.miniList && activeWelcome.miniList.rows.length > 0))
                  ? 'min(280px, calc(100vh - 32px))'
                  : 'none',
            maxWidth: 360,
            padding: '10px 12px',
            lineHeight: 1.5,
            fontSize: 12,
            overflow: 'hidden',
            // V2.4 修复: 中文长字符串无空格 → fit-content 会按单 token 测 min-content,
            //   让气泡宽度被压成 ~100px,一行只容 6 个字;改为固定 width 让文字正常换行
            display: 'inline-flex',
            flexDirection: 'column',
            width: 'min(360px, calc(100vw - 32px))',
          }}
          onClick={() => {
            // §4.1.1 文字汇报：点气泡展开对话窗口深入交流（不强制）
            setOpen(true);
            // 项目信息审计页还需要用 activeWelcome 锁定窗口内对应的预审欢迎语；
            // 审计决策完成、页面离开时再由页面 effect 清理。
            if (!shouldRetainWelcomeForChat) {
              consumeWelcome();
            }
          }}
          role="dialog"
          aria-label="医小管态势汇报"
        >
          <button
            type="button"
            className="agent-welcome-bubble-close"
            aria-label="关闭气泡"
            onClick={(e) => {
              e.stopPropagation();
              consumeWelcome();
            }}
          >
            ×
          </button>
          <strong style={{ color: '#1677FF', fontSize: 13 }}>医小管</strong>
          <span
            style={{ marginLeft: 4, display: 'inline-block', marginTop: 4 }}
            data-testid="status-bubble-content"
          >
            {activeWelcome.content}
          </span>
          {/* 中段内容区: chip / actions / miniList 在气泡高度超限时可滚动,
              标题行 + 底部状态保持固定可见
              V2.1 改造: 仅在三个区段至少有一个时渲染此 div,
                简单文案场景不留空白占位(避免 flex:1 把气泡撑高 40~60px) */}
          {((activeWelcome.chips && activeWelcome.chips.length > 0) ||
            (activeWelcome.actions && activeWelcome.actions.length > 0) ||
            (activeWelcome.miniList && activeWelcome.miniList.rows.length > 0) ||
            activeWelcome.evaluationSummary ||
            (activeWelcome.previewProblems && activeWelcome.previewProblems.items.length > 0)) && (
          <div
            style={{
              marginTop: 6,
              // V2.1 改造: 仅在 maxHeight 受限时 (即内容可能溢出) 才用 flex:1 撑开滚动区,
              //   普通 chip/action/miniList 折叠态场景下走自然高度, 不留大块空白
              flex: '0 0 auto',
              minHeight: 0,
              maxHeight: 'none',
              overflowY: 'visible',
            }}
          >
          {activeWelcome.evaluationSummary && (
            <div
              data-testid="status-bubble-evaluation-summary"
              onClick={(e) => e.stopPropagation()}
              style={{
                marginTop: 8,
                padding: '10px 12px',
                border: '1px solid #D9D9D9',
                borderRadius: 10,
                background: '#FFF',
                color: '#262626',
              }}
            >
              <div style={{ display: 'grid', gap: 7, fontSize: 13 }}>
                <div>
                  <Text type="secondary">任务编号：</Text>
                  <Text strong>{activeWelcome.evaluationSummary.taskNo}</Text>
                </div>
                <div>
                  <Text type="secondary">评测智能体名称：</Text>
                  <Text>{activeWelcome.evaluationSummary.agentName}</Text>
                </div>
                <div>
                  <Text type="secondary">评测维度：</Text>
                  <Text>{activeWelcome.evaluationSummary.dimensions.join(' / ')}</Text>
                </div>
                <div>
                  <Text type="secondary">评测样本量：</Text>
                  <Text>
                    {activeWelcome.evaluationSummary.sampleLevel}
                    （抽题 {activeWelcome.evaluationSummary.samplePercent}%）
                  </Text>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #F0F0F0', marginTop: 10, paddingTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text strong>评测进度</Text>
                  <Text type="secondary">{activeWelcome.evaluationSummary.estimatedRemaining}</Text>
                </div>
                <Progress
                  percent={activeWelcome.evaluationSummary.progress}
                  size="small"
                  strokeColor="#1677FF"
                  trailColor="#E6F4FF"
                  format={(percent) => `${percent}%`}
                />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  已完成 {activeWelcome.evaluationSummary.progressText}
                </Text>
              </div>
            </div>
          )}
          {/* §4.1.1 状态分流 chip：点击直接跳对应状态 tab */}
          {activeWelcome.chips && activeWelcome.chips.length > 0 && (
            <div
              style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}
              onClick={(e) => e.stopPropagation()}
            >
              {activeWelcome.chips.map((c) => (
                <Tag.CheckableTag
                  key={c.key}
                  data-testid={`status-bubble-chip-${c.key}`}
                  checked={c.tone === 'success'}
                  style={{
                    padding: '2px 8px',
                    border: `1px solid ${
                      c.tone === 'warning'
                        ? '#FAAD14'
                        : c.tone === 'success'
                          ? '#52C41A'
                          : c.tone === 'error'
                            ? '#FF4D4F'
                            : '#91D5FF'
                    }`,
                    background:
                      c.tone === 'warning'
                        ? '#FFFBE6'
                        : c.tone === 'success'
                          ? '#F6FFED'
                          : c.tone === 'error'
                            ? '#FFF1F0'
                            : '#E6F4FF',
                    color: '#1F1F1F',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    // 跳 tab：通过自定义事件通知 index.tsx 处理
                    window.dispatchEvent(
                      new CustomEvent('agent-jump-tab', { detail: c.targetTab }),
                    );
                    consumeWelcome();
                  }}
                >
                  {c.label}
                </Tag.CheckableTag>
              ))}
            </div>
          )}
          {/* §3.2.1 智能预审 · 紧凑版 — 与对话窗口内 pre-audit-issue 同一数据源同步展示
              - 前 3 条 + 底部「查看全部 (N)」(主操作入口是 click 打开对话窗口)
              - 每条问题自带 3 个 link 按钮(定位 / 采纳 / 忽略) → 通过既有 CustomEvent 派发,
                与 ChatPanel 内完整气泡共享同一套消费回路, 状态通过 window.__preAuditIssueStatus 同步 */}
          {activeWelcome.previewProblems && activeWelcome.previewProblems.items.length > 0 && (
            <div
              data-testid="status-bubble-preview-issues"
              style={{
                marginTop: 8,
                border: '1px solid #FFD591',
                background: '#FFFBE6',
                borderRadius: 6,
                padding: '6px 8px',
                // 内部最大高度 200 + 滚动: 第 4~N 条超出时, 用户可在卡片内滚动到每条「采纳 / 忽略」按钮
                //   (外层 bubble maxHeight 420 留给整体; 这里再加 200 防极端场景全部塞 8+ 条撑爆气泡)
                maxHeight: 200,
                overflowY: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#D48806',
                  marginBottom: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                }}
              >
                <span>
                  <WarningOutlined style={{ marginRight: 4 }} />
                  智能预审 {activeWelcome.previewProblems.total} 项待处理
                </span>
              </div>
              {activeWelcome.previewProblems.items.map((p) => {
                // 优先读本组件 React state, 兜底读 window(支持 Audit 页派发的状态同步)
                const localStatus = bubbleStatusMap[p.id];
                const winStatus = (window as any).__preAuditIssueStatus?.[p.id];
                const adopted = localStatus === 'adopted' || winStatus === 'adopted';
                const ignored = localStatus === 'ignored' || winStatus === 'ignored';
                const tone =
                  p.severity === 'error'
                    ? { border: '#FFA39E', bg: '#FFF1F0', text: '#CF1322', dot: '#FF4D4F' }
                    : p.severity === 'warning'
                      ? { border: '#FFE58F', bg: '#FFFBE6', text: '#D48806', dot: '#FAAD14' }
                      : { border: '#91D5FF', bg: '#E6F4FF', text: '#1677FF', dot: '#1677FF' };
                return (
                  <div
                    key={p.id}
                    data-testid={`status-bubble-preview-issue-${p.id}`}
                    style={{
                      fontSize: 12,
                      color: '#1F1F1F',
                      marginTop: 4,
                      padding: '4px 6px',
                      borderRadius: 4,
                      background: adopted ? '#F6FFED' : ignored ? '#FAFAFA' : '#FFFFFF',
                      border: `1px solid ${adopted ? '#B7EB8F' : ignored ? '#D9D9D9' : tone.border}`,
                      opacity: ignored ? 0.6 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: tone.dot,
                          flex: '0 0 auto',
                        }}
                      />
                      <span
                        style={{
                          flex: 1,
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {p.title}
                      </span>
                    </div>
                    {!adopted && !ignored && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                        {p.fieldKey && (
                          <Button
                            size="small"
                            type="link"
                            style={{ padding: 0, fontSize: 11 }}
                            data-testid={`status-bubble-preview-locate-${p.id}`}
                            onClick={() =>
                              window.dispatchEvent(
                                new CustomEvent('agent-review-locate-field', { detail: p.fieldKey }),
                              )
                            }
                          >
                            定位到字段
                          </Button>
                        )}
                        <Button
                          size="small"
                          type="link"
                          style={{ padding: 0, fontSize: 11 }}
                          data-testid={`status-bubble-preview-adopt-${p.id}`}
                          onClick={() =>
                            window.dispatchEvent(
                              new CustomEvent('agent-issue-adopt', { detail: p.id }),
                            )
                          }
                        >
                          采纳
                        </Button>
                        <Button
                          size="small"
                          type="link"
                          style={{ padding: 0, fontSize: 11 }}
                          data-testid={`status-bubble-preview-ignore-${p.id}`}
                          onClick={() =>
                            window.dispatchEvent(
                              new CustomEvent('agent-issue-ignore', { detail: p.id }),
                            )
                          }
                        >
                          忽略本条
                        </Button>
                      </div>
                    )}
                    {adopted && (
                      <div style={{ fontSize: 11, color: '#389E0D', marginTop: 2 }}>✓ 已采纳</div>
                    )}
                    {ignored && (
                      <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>已忽略</div>
                    )}
                  </div>
                );
              })}
              {activeWelcome.previewProblems.total > activeWelcome.previewProblems.items.length && (
                <Button
                  type="link"
                  size="small"
                  block
                  data-testid="status-bubble-preview-footer"
                  onClick={() => {
                    // 打开对话窗口 + 消耗气泡
                    setOpen(true);
                    consumeWelcome();
                  }}
                  style={{ fontSize: 12, padding: '4px 0 0' }}
                >
                  查看全部 ({activeWelcome.previewProblems.total}) ›
                </Button>
              )}
            </div>
          )}
          {/* §4.1.1 一键直达：按权限置灰；非 admin 看不到「准入评测沙盒」或置灰 */}
          {activeWelcome.pageKey !== 'audit-project-audit' &&
            activeWelcome.actions && activeWelcome.actions.length > 0 && (
            <div
              style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}
              onClick={(e) => e.stopPropagation()}
            >
              {activeWelcome.actions.map((a) => (
                <Tooltip key={a.key} title={a.enabled ? '' : (a.reason || '当前账号暂无该操作权限')}>
                  <Button
                    size="small"
                    type="link"
                    data-testid={`status-bubble-action-${a.key}`}
                    disabled={!a.enabled}
                    onClick={() => {
                      if (!a.enabled) return;
                      // 先消费当前气泡，再执行动作。部分页面事件会同步推送下一张气泡
                      // （例如审核通过后创建评测任务）；若放在事件之后消费，会把刚写入
                      // 的新气泡一并清空，表现为第二张气泡无法呈现。
                      consumeWelcome();
                      if (a.event) {
                        // 单记录页直接操作（上传 / 语音 / 审核结论 / 附件预览等）走页面内事件
                        window.dispatchEvent(new CustomEvent(a.event));
                      } else if (a.path) {
                        window.location.href = a.path;
                      }
                    }}
                    style={{ padding: '0 6px' }}
                  >
                    {a.label}
                  </Button>
                </Tooltip>
              ))}
            </div>
          )}
          {/* §3.1.1 指向性规则（列表页多记录）：气泡按钮打开智能体窗口，
              窗口内展示记录清单与对应操作。 */}
          {activeWelcome.miniList && activeWelcome.miniList.rows.length > 0 && (
            <div
              style={{ marginTop: 8 }}
              onClick={(e) => e.stopPropagation()}
            >
              {miniExpandedAt !== activeWelcome.at ? (
                // 折叠态：单个引导按钮，点击打开完整智能体窗口
                <Button
                  size="small"
                  type="primary"
                  ghost
                  data-testid="status-bubble-mini-toggle"
                  onClick={() => {
                    setOpen(true);
                    // 项目审计窗口依赖 activeWelcome 锁定当前 Tab 的欢迎消息；
                    // 打开清单时保留欢迎态，避免消息过滤后窗口为空。
                    if (!shouldRetainWelcomeForChat) {
                      consumeWelcome();
                    }
                  }}
                  style={{ padding: '0 10px' }}
                >
                  {activeWelcome.miniList.toggleLabel} ›
                </Button>
              ) : (
                // 展开态：前 3–5 条记录清单 + 每条记录级按钮 + 查看全部
                <div
                  data-testid="status-bubble-mini"
                  style={{
                    border: '1px solid #E8E8E8',
                    borderRadius: 8,
                    background: '#FFFFFF',
                    maxHeight: 160,
                    overflowY: 'auto',
                  }}
                >
                  {activeWelcome.miniList.rows.map((row) => (
                    <div
                      key={row.recordId}
                      data-testid={`status-bubble-mini-row-${row.recordId}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '6px 8px',
                        borderBottom: '1px solid #F5F5F5',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#1F1F1F',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {row.title}
                        </div>
                        {(row.subTitle || row.meta) && (
                          <div
                            style={{
                              fontSize: 11,
                              color: '#999',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {[row.subTitle, row.meta].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                      <Space size={0} wrap={false}>
                        {row.actions.map((act) => (
                          <Button
                            key={act.key}
                            size="small"
                            type="link"
                            danger={act.danger}
                            data-testid={`status-bubble-mini-action-${act.kind}-${row.recordId}`}
                            onClick={() => {
                              window.dispatchEvent(
                                new CustomEvent('agent-bubble-row-action', {
                                  detail: { kind: act.kind, recordId: row.recordId, path: act.path },
                                }),
                              );
                              consumeWelcome();
                            }}
                            style={{ padding: '0 6px', fontSize: 12 }}
                          >
                            {act.label}
                          </Button>
                        ))}
                      </Space>
                    </div>
                  ))}
                  {/* 底部「查看全部」回到对应 Tab */}
                  <Button
                    type="link"
                    size="small"
                    block
                    data-testid="status-bubble-mini-footer"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent('agent-jump-tab', {
                          detail: activeWelcome.miniList!.targetTab,
                        }),
                      );
                      consumeWelcome();
                    }}
                    style={{ fontSize: 12 }}
                  >
                    查看全部 ({activeWelcome.miniList.totalCount}) ›
                  </Button>
                </div>
              )}
            </div>
          )}
          </div>
          )}
        </div>
      )}

      {/* §4.3 V5.0: 备案材料生成提示 - 机器人旁独立侧气泡 (不进入 ChatPanel messages)
         - 与 activeWelcome 同位置(机器人左上方), 但不受 8s 自动收起影响, 需用户主动 dismiss / 生成 / 上传
         - ChatPanel 打开时不重复显示 (避免双重提示)
         - 仅在 smart-register 页且必填信息已完成时由 SmartRegistrationForm 写入 */}
      {!open && materialOffer && materialOffer.missingCategories.length > 0 && (
        <div
          ref={materialOfferRef}
          className="agent-welcome-bubble"
          data-testid="material-offer-bubble"
          style={{
            ...getRobotBubblePlacement(pos, materialOfferH ?? 220),
            position: 'fixed',
            bottom: 'auto',
            right: 'auto',
            width: 'min(360px, calc(100vw - 32px))',
            maxWidth: 360,
            transform: 'none',
            transformOrigin: 'bottom right',
            ['--agent-bubble-arrow-left' as any]: 'auto',
            ['--agent-bubble-arrow-right' as any]: '18px',
            ['--agent-bubble-arrow-bottom' as any]: '-6px',
            zIndex: 1000,
            background: '#FFFFFF',
            color: '#1F1F1F',
            padding: '10px 12px',
            borderRadius: 12,
            fontSize: 12,
            lineHeight: 1.5,
            border: '1px solid #91CAFF',
            boxShadow: '0 8px 24px rgba(22, 119, 255, 0.18)',
            boxSizing: 'border-box',
            overflowWrap: 'break-word',
            wordBreak: 'break-word',
            display: 'inline-flex',
            flexDirection: 'column',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <strong style={{ color: '#1677FF', fontSize: 13 }}>医小管</strong>
            <span
              style={{ marginLeft: 4 }}
              data-testid="material-offer-bubble-content"
            >
              {`检测到当前「备案材料」还缺少${materialOffer.missingCategories.map((k) => (k === 'product' ? '产品说明书' : '技术规格书')).join(' / ')}，我可依据你已填写的信息自动生成，需要现在生成吗？`}
            </span>
          </div>
          <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 6 }}>
            我会仅基于当前表单已填信息与已上传材料生成，完成后自动归档到「备案材料」。
          </Text>
          <Space size={8} wrap style={{ marginTop: 8 }}>
            {materialOffer.missingCategories.includes('product') && (
              <Button
                size="small"
                type="primary"
                icon={<FilePdfOutlined />}
                data-testid="side-bubble-generate-product-doc-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent('agent-generate-registration-doc', { detail: 'product' }));
                }}
              >
                生成产品说明书
              </Button>
            )}
            {materialOffer.missingCategories.includes('tech') && (
              <Button
                size="small"
                icon={<ApiOutlined />}
                data-testid="side-bubble-generate-tech-doc-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent('agent-generate-registration-doc', { detail: 'tech' }));
                }}
              >
                生成技术说明书
              </Button>
            )}
            <Button
              size="small"
              type="text"
              data-testid="side-bubble-dismiss-material-generation-btn"
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('agent-dismiss-material-generation-offer'));
              }}
            >
              暂不生成
            </Button>
          </Space>
        </div>
      )}

      {/* 悬浮入口 */}
      {!open && (
        <div
          ref={entryRef}
          onPointerDown={handleEntryPointerDown}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={(e) => {
            if (dragMovedRef.current) {
              e.preventDefault();
              e.stopPropagation();
              dragMovedRef.current = false;
              return;
            }
            setOpen(true);
            // 唤起浮层时主动问候一次（医小管 通用开场白）
            // —— 真正的页面欢迎语已由 SmartRegistrationForm 推过, 这里仅补一次轻量问候
            setMood('happy');
            setTimeout(() => setMood('idle'), 600);
          }}
          // §3.1.1 动画类名：
          //   - bounce: 新消息来时 (mood==='happy' 且 unread>0) 整体上下跳
          //   - sit: 收起对话后 0.7s 内播放挫手→坐下→回站
          //   - 与 hover transform 互斥 (bounce 优先于 hover)
          className={
            [
              mood === 'happy' && unreadCount > 0 && !draggingFloat ? 'agent-robot-bounce' : '',
              sitUntil > Date.now() && !draggingFloat ? 'agent-robot-sit' : '',
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
          style={{
            position: 'fixed',
            left: pos.left,
            top: pos.top,
            width: ENTRY_SIZE,
            height: ENTRY_SIZE,
            // PRD §3.1.1 拖拽过程中略降透明度, 跟随光标移动; 抓握光标
            opacity: draggingFloat ? 0.7 : 1,
            cursor: draggingFloat ? 'grabbing' : 'grab',
            userSelect: 'none',
            touchAction: 'none',
            zIndex: 1001,
            transition: draggingFloat
              ? 'none'
              : 'transform 200ms ease-out, opacity 150ms ease-out',
            transform:
              hover && !draggingFloat && mood !== 'happy'
                ? 'translateY(-4px) scale(1.05)'
                : 'translateY(0) scale(1)',
          }}
          aria-label="唤起智能填写助手（医小管），可拖拽到任意位置"
          role="button"
        >
          <RobotIcon
            mood={effectiveMood}
            size={hover ? 72 : 64}
            badge={unreadCount > 0 ? unreadCount : false}
            // §3.1.1 新消息: 红点放大闪烁 + 双臂挫手 (与 bounce 同步 0.6s × 2)
            badgePulse={badgePulse}
            handWave={badgePulse}
          />
          {/* 浮动小气泡提示 (hover 时显示文字) */}
          {hover && (
            <div
              style={{
                position: 'absolute',
                right: 80,
                top: 12,
                background: '#1F1F1F',
                color: '#fff',
                padding: '4px 10px',
                borderRadius: 4,
                fontSize: 12,
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                pointerEvents: 'none',
              }}
            >
              医小管
              <div
                style={{
                  position: 'absolute',
                  right: -4,
                  top: 10,
                  width: 0,
                  height: 0,
                  borderTop: '4px solid transparent',
                  borderBottom: '4px solid transparent',
                  borderLeft: '4px solid #1F1F1F',
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* 对话浮层 — 始终固定在视口右下角, 与机器人 icon 的拖拽位置解耦
          (机器人可拖到任意位置停靠, 但对话窗口保持右下角锚定) */}
      {open && (
        <div
          style={{
            position: 'fixed',
            right: 24,
            bottom: CHAT_BOTTOM_OFFSET,
            width: CHAT_WIDTH,
            height: CHAT_HEIGHT,
            maxHeight: `calc(100vh - ${CHAT_BOTTOM_OFFSET + 24}px)`,
            background: '#FFFFFF',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            border: `1px solid ${draggingFile ? '#1677FF' : '#E8E8E8'}`,
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1001,
            overflow: 'hidden',
            animation: 'agentChatPanelIn 250ms ease-out',
          }}
          className={draggingFile ? 'agent-chat-dropzone agent-chat-dropping' : undefined}
        >
          {/* 标题栏 */}
          <div
            style={{
              height: 48,
              padding: '0 12px 0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #F0F0F0',
              background: 'linear-gradient(90deg, #F0F8FF 0%, #FFFFFF 100%)',
            }}
          >
            <Space size={10}>
              <div style={{ width: 32, height: 32 }}>
                <RobotIcon mood="idle" size={32} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1F1F1F' }}>
                  医小管
                </div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  接入全程陪伴 · 可随时呼出
                </Text>
              </div>
            </Space>
            <Tooltip title="收起对话（不清空会话）">
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={() => {
                  // §3.1.1 收起挫手/坐下: 关闭后 0.7s 内 entry 播放挫手→坐下→回站
                  setSitUntil(Date.now() + 700);
                  setOpen(false);
                }}
              />
            </Tooltip>
          </div>

          {/* 拖拽高亮提示 (PRD §3.1.1:"拖入时窗口高亮并提示「松开即可上传」")
              边框仅由外层 .agent-chat-dropzone 提供(全局 CSS), 此处不再叠加内层虚线框 */}
          {draggingFile && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: 'rgba(22, 119, 255, 0.04)',
                color: '#1677FF',
                fontSize: 14,
                fontWeight: 500,
                pointerEvents: 'none',
                zIndex: 2,
              }}
            >
              <CloudUploadOutlined style={{ fontSize: 22 }} />
              松开即可上传（单文件 ≤ 30M · 仅支持 PDF / 图片）
            </div>
          )}

          {/* 消息区 */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              background: '#FAFAFA',
            }}
          >
            {visibleMessages.map((m) => (
              <AgentMessageBubble
                key={m.id}
                msg={m}
                onAcknowledge={ackField}
                onAcknowledgeFields={ackBatch}
              />
            ))}
            <div ref={msgEndRef} />
          </div>

          {/* 输入栏 */}
          <div
            style={{
              borderTop: '1px solid #F0F0F0',
              padding: 8,
              background: '#FFFFFF',
            }}
          >
            {recording && (
              <Alert
                type="warning"
                showIcon
                message="正在录音…再次点击 🎤 结束录音并自动转写"
                style={{ marginBottom: 8, fontSize: 12, padding: '4px 10px' }}
                banner
              />
            )}
            <Space.Compact style={{ width: '100%' }}>
              <Upload
                accept={/^\/app\/project-application\/(?:create|edit\/[^/]+)$/.test(location.pathname) || location.pathname === '/app/audit/project'
                  ? '.pdf,.doc,.docx'
                  : '.pdf,.png,.jpg,.jpeg'}
                showUploadList={false}
                beforeUpload={(file) => handleUpload(file as any)}
                maxCount={1}
              >
                <Button icon={<PaperClipOutlined />} title={
                  /^\/app\/project-application\/(?:create|edit\/[^/]+)$/.test(location.pathname) || location.pathname === '/app/audit/project'
                    ? '上传 PDF / DOC / DOCX'
                    : '上传 PDF / 图片'
                } />
              </Upload>
              <Button
                icon={<LinkOutlined />}
                title="粘贴链接自动识别"
                onClick={() => {
                  const url = window.prompt('请粘贴链接 URL');
                  if (url && /^https?:\/\//.test(url)) {
                    addMessage({ role: 'user', type: 'text', content: `发送链接：${url}` });
                    runRecognitionFlow(() => recognizeLink(url), {
                      label: '正在抓取链接内容…',
                      resultType: 'link-detect',
                    });
                  }
                }}
              />
              <Button
                icon={<AudioOutlined />}
                type={recording ? 'primary' : 'default'}
                onClick={toggleVoice}
                title="点击 / 长按 语音输入"
              />
              <TextArea
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                autoSize={{ minRows: 1, maxRows: 4 }}
                placeholder="描述你的智能体，或粘贴链接（Enter 发送）"
                style={{ resize: 'none' }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSend}
                disabled={!input.trim()}
                title="发送（Enter）"
              />
            </Space.Compact>
            <div style={{ marginTop: 6, fontSize: 11, color: '#999', textAlign: 'center' }}>
              <ThunderboltOutlined /> 医小管仅在您授权下处理数据, 全程仅操作本人表单（单文件 ≤ 30M）
            </div>
          </div>
        </div>
      )}

      {/* 浮层展开 / 收起 keyframes */}
      <style>{`
        @keyframes agentChatPanelIn {
          from { opacity: 0; transform: translateY(8px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>
    </>
  );
};

export default AgentAssistant;
