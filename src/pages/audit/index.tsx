import { useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Checkbox,
  Collapse,
  DatePicker,
  Descriptions,
  Dropdown,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Radio,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import {
  ArrowLeftOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  DownOutlined,
  DownloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  FilePdfOutlined,
  LikeOutlined,
  MoreOutlined,
  ReloadOutlined,
  RiseOutlined,
  RobotOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  ToolOutlined,
  ThunderboltFilled,
  ThunderboltOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import type { MenuProps } from 'antd';
import type { UploadFile } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import PageHeader from '../../components/PageHeader';
import { useSmartDraft } from '../agent-center/smart/store';
import auditMaterialPdfUrl from '../../../output/pdf/项目审计填报材料-完成度100%-已使用金额136.8万元.pdf?url';
import auditProjectHeroUrl from '../../assets/audit-project-hero-v10.png';
import './audit.css';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

type AuditSection = 'project' | 'behavior' | 'logs';

const departments = ['全部科室', '0301 心内科', '0302 影像科', '0303 药剂科', '0304 医务科'];
// 按市场常规的综合估算价格折算：50 元 / 百万 Token。
// 项目只提供 Token 总量，未区分输入/输出，因此采用统一综合单价。
const TOKEN_PRICE_PER_MILLION_YUAN = 50;
const TOTAL_INVESTMENT_BUDGET_IN_TEN_THOUSAND_YUAN = 2780;
const CURRENT_MONTH_TOKEN_CONSUMPTION = 70_466_667;
const calculateTokenCost = (tokens: number) => tokens / 1_000_000 * TOKEN_PRICE_PER_MILLION_YUAN;
const calculateInvestmentRatio = (tokenCost: number, budgetInTenThousandYuan: number) => (
  budgetInTenThousandYuan > 0 ? (tokenCost / (budgetInTenThousandYuan * 10_000)) * 100 : 0
);
const economicRows = [
  { key: '1', id: '0301-0007', name: '心血管疾病智能随访助手', version: 'V2.1', dept: '0301 心内科', budget: 180, tokens: 3284000, updated: '2026-07-28 09:42:16' },
  { key: '2', id: '0302-0012', name: '胸部CT影像智能分析平台', version: 'V3.0', dept: '0302 影像科', budget: 320, tokens: 8926000, updated: '2026-07-28 09:39:05' },
  { key: '3', id: '0303-0004', name: '合理用药智能审核助手', version: 'V1.8', dept: '0303 药剂科', budget: 95, tokens: 2145000, updated: '2026-07-28 09:35:32' },
  { key: '4', id: '0304-0009', name: '病案首页智能质控智能体', version: 'V2.4', dept: '0304 医务科', budget: 150, tokens: 4762000, updated: '2026-07-28 09:31:48' },
].map((row) => {
  const cost = calculateTokenCost(row.tokens);
  return { ...row, cost, ratio: calculateInvestmentRatio(cost, row.budget) };
});

type ProjectStatus = '待申请' | '草稿' | '待审计' | '审计中' | '撤销修改' | '审计通过' | '审计不通过';
const statusColor: Record<ProjectStatus, string> = {
  待申请: 'default', 草稿: 'orange', 待审计: 'blue', 审计中: 'processing', 撤销修改: 'gold', 审计通过: 'success', 审计不通过: 'error',
};
const initialProjects = [
  { key: 'p1', name: 'AI 辅助心衰患者全程管理平台', dept: '心内科', track: '临床诊疗', owner: '周明', contact: '陈晓', phone: '138****1208', completion: 92, completionDescription: '核心功能已上线试运行，患者端随访提醒模块正在进行最终联调。', indicator: 88, indicatorDescription: '两项核心指标中，一项已达标，一项接近目标值。', fund: 76, fundDescription: '资金用于软硬件采购、实施服务、模型训练及测试。', status: '待审计' as ProjectStatus, time: '2026-07-26 14:20:16' },
  { key: 'p2', name: '多模态医学影像智能会诊平台', dept: '影像科', track: '智慧医技', owner: '王越', contact: '林青', phone: '139****6721', completion: 78, completionDescription: '影像分析与远程会诊功能已完成，跨院数据互通仍在联调。', indicator: 82, indicatorDescription: '诊断准确率已达标，平均报告耗时尚未达到目标值。', fund: 68, fundDescription: '资金主要用于算力设备采购、系统实施与算法训练。', status: '审计中' as ProjectStatus, time: '2026-07-25 10:12:42' },
  { key: 'p3', name: '处方前置审核与用药风险预警', dept: '药剂科', track: '合理用药', owner: '赵宁', contact: '吴凡', phone: '136****3882', completion: 100, completionDescription: '已按计划全部完成。', indicator: 96, indicatorDescription: '两项核心指标已达到验收要求。', fund: 94, fundDescription: '资金用于规则库建设、系统实施及接口改造。', status: '审计通过' as ProjectStatus, time: '2026-07-23 16:45:09' },
  { key: 'p4', name: '门诊病历智能生成与质量控制', dept: '医务科', track: '医院管理', owner: '李嘉', contact: '高原', phone: '137****9016', completion: 65, completionDescription: '病历生成功能已完成，质量控制规则仍在持续补充。', indicator: 58, indicatorDescription: '病历生成效率已达标，质控准确率仍需提升。', fund: 71, fundDescription: '资金用于模型训练、规则配置和系统集成服务。', status: '草稿' as ProjectStatus, time: '2026-07-22 09:18:33' },
  { key: 'p5', name: '急诊智能预检分诊系统', dept: '急诊科', track: '临床诊疗', owner: '郑涛', contact: '孙悦', phone: '135****0432', completion: 0, completionDescription: '', indicator: 0, indicatorDescription: '', fund: 0, fundDescription: '', status: '待申请' as ProjectStatus, time: '2026-07-20 11:30:08' },
  { key: 'p6', name: '病理切片辅助诊断系统', dept: '病理科', track: '智慧医技', owner: '何伟', contact: '许静', phone: '133****2140', completion: 72, completionDescription: '切片识别与标注功能已完成，辅助诊断模块仍在优化。', indicator: 61, indicatorDescription: '识别灵敏度已达标，特异度和处理时效未达到目标值。', fund: 89, fundDescription: '资金主要用于扫描设备、存储扩容和算法研发。', status: '审计不通过' as ProjectStatus, time: '2026-07-18 15:40:22' },
  { key: 'p7', name: '住院患者跌倒风险智能预警平台', dept: '护理部', track: '医院管理', owner: '刘敏', contact: '唐悦', phone: '132****5816', completion: 80, completionDescription: '风险评估与预警功能已上线，移动端闭环处置仍在完善。', indicator: 74, indicatorDescription: '高风险患者识别率已达标，处置及时率尚未达标。', fund: 0, fundDescription: '资金使用明细待补充。', status: '撤销修改' as ProjectStatus, time: '2026-07-28 10:16:38' },
];

const agentRows = [
  { key: 'a1', id: '0301-0007', name: '心血管疾病智能随访助手', version: 'V2.1', dept: '0301 心内科', sessions: 12842, last: '2026-07-28 09:41:56' },
  { key: 'a2', id: '0302-0012', name: '胸部CT影像智能分析平台', version: 'V3.0', dept: '0302 影像科', sessions: 9261, last: '2026-07-28 09:38:20' },
  { key: 'a3', id: '0303-0004', name: '合理用药智能审核助手', version: 'V1.8', dept: '0303 药剂科', sessions: 7640, last: '2026-07-28 09:32:15' },
  { key: 'a4', id: '0304-0009', name: '病案首页智能质控智能体', version: 'V2.4', dept: '0304 医务科', sessions: 4388, last: '2026-07-28 09:20:48' },
];

type ProcessStep = { type: 'reasoning' | 'tool'; title: string; detail: string; result?: string };
type ConversationTurn = { role: 'user' | 'agent'; time: string; content: string; process?: ProcessStep[] };
type AuditSession = {
  key: string; title: string; input: string; output: string; duration: number; start: string; end: string;
  turns: ConversationTurn[];
};

const sessions: AuditSession[] = [
  {
    key: 's1', title: '出院后血压管理建议',
    input: '患者张**，手机号 138****0521，出院后血压持续偏高，应该如何调整随访计划？',
    output: '建议先核对近七日晨起与睡前血压记录，并结合用药依从性进行分层随访…',
    duration: 108, start: '2026-07-28 09:40:08', end: '2026-07-28 09:41:56',
    turns: [
      { role: 'user', time: '2026-07-28 09:40:08', content: '患者张**，手机号 138****0521，出院后血压持续偏高，应该如何调整随访计划？' },
      {
        role: 'agent', time: '2026-07-28 09:40:26',
        content: '建议先核对近七日晨起与睡前血压记录，并结合用药依从性进行分层随访。若家庭血压多次达到或超过 160/100 mmHg，或伴有头痛、胸闷等不适，请及时联系主管医生。',
        process: [
          { type: 'reasoning', title: '分析患者当前风险与随访需求', detail: '识别到出院后持续血压偏高，优先核对监测记录、症状及用药依从性，再按风险等级制定随访频次。' },
          { type: 'tool', title: '查询患者随访档案', detail: '调用：patient_followup.get_recent_records', result: '返回近 7 日血压记录 12 条；敏感字段已脱敏。' },
        ],
      },
      { role: 'user', time: '2026-07-28 09:40:52', content: '最近三天早晨大多在 150/95 mmHg 左右，没有胸闷，降压药都按时吃了。多久随访一次比较合适？' },
      {
        role: 'agent', time: '2026-07-28 09:41:18',
        content: '目前没有明显急症表现，建议先进入强化随访：未来 1 周每 2—3 天进行一次电话或线上随访，每天固定在晨起和睡前测量并记录血压。连续 3 天仍高于 150/95 mmHg 时，请由医生评估是否需要调整药物，患者不要自行加减药。',
        process: [
          { type: 'reasoning', title: '生成分层随访方案', detail: '结合连续偏高但无危险症状的情况，采用短期强化随访，并设置升级处置阈值。' },
          { type: 'tool', title: '匹配高血压随访规则', detail: '调用：clinical_rule.match', result: '命中“出院后血压控制未达标—强化随访”规则。' },
        ],
      },
      { role: 'user', time: '2026-07-28 09:41:34', content: '好的，请帮我生成一条下次随访提醒。' },
      {
        role: 'agent', time: '2026-07-28 09:41:56',
        content: '已生成随访提醒：2026-07-31 09:00 电话随访。届时请准备近三天晨起、睡前血压记录，以及服药和不适症状情况。',
        process: [
          { type: 'tool', title: '创建随访提醒', detail: '调用：followup_task.create', result: '创建成功，任务编号：FU-20260728-1042。' },
        ],
      },
    ],
  },
  {
    key: 's2', title: '心衰患者饮食指导',
    input: '请为一位 NYHA II 级患者生成低盐饮食和每日体重监测建议。',
    output: '每日食盐摄入建议控制在 5 克以内，固定时间测量体重并记录水肿情况…',
    duration: 76, start: '2026-07-28 09:10:12', end: '2026-07-28 09:11:28',
    turns: [
      { role: 'user', time: '2026-07-28 09:10:12', content: '请为一位 NYHA II 级患者生成低盐饮食和每日体重监测建议。' },
      { role: 'agent', time: '2026-07-28 09:10:42', content: '每日食盐摄入建议控制在 5 克以内，少吃腌制、加工食品。每天晨起排尿后、早餐前使用同一台体重秤测量并记录体重。', process: [{ type: 'reasoning', title: '整理心衰居家管理要点', detail: '围绕限盐、固定条件称重和容量负荷预警组织建议。' }] },
      { role: 'user', time: '2026-07-28 09:11:02', content: '体重变化到什么程度需要联系医生？' },
      { role: 'agent', time: '2026-07-28 09:11:28', content: '若 3 天内体重增加 2 公斤左右，或同时出现下肢水肿、气短加重，请尽快联系医生。', process: [{ type: 'tool', title: '匹配心衰预警规则', detail: '调用：clinical_rule.match', result: '返回容量负荷异常预警阈值。' }] },
    ],
  },
  {
    key: 's3', title: '复诊指标提醒',
    input: '这位患者下次复诊需要提前准备哪些检查结果？',
    output: '建议携带近期血压心率记录、肾功能、电解质和 NT-proBNP 检查结果…',
    duration: 53, start: '2026-07-27 16:22:41', end: '2026-07-27 16:23:34',
    turns: [
      { role: 'user', time: '2026-07-27 16:22:41', content: '这位患者下次复诊需要提前准备哪些检查结果？' },
      { role: 'agent', time: '2026-07-27 16:23:04', content: '建议携带近期血压心率记录、肾功能、电解质和 NT-proBNP 检查结果，并准备当前用药清单。', process: [{ type: 'tool', title: '读取复诊计划', detail: '调用：followup_plan.get', result: '已获取下次复诊项目与日期。' }] },
      { role: 'user', time: '2026-07-27 16:23:18', content: '需要空腹吗？' },
      { role: 'agent', time: '2026-07-27 16:23:34', content: '如同时安排空腹血糖或血脂检查，通常需要空腹；请以本次检验单和医院通知为准。' },
    ],
  },
];

const logRows = [
  { key: 'l1', user: '张明华', role: '信息科管理员', org: '信息中心', module: '审计中心', type: '导出', desc: '用户批量导出项目审计列表中选中的 4 条项目记录', result: '成功', ip: '10.24.8.16', time: '2026-07-28 09:45:12' },
  { key: 'l2', user: '周明', role: '科室管理员', org: '心内科', module: '立项申报管理中心', type: '审计', desc: '用户提交“AI 辅助心衰患者全程管理平台”项目审计申请', result: '成功', ip: '10.24.31.88', time: '2026-07-28 09:31:26' },
  { key: 'l3', user: '王越', role: '科室管理员', org: '影像科', module: '智能体接入中心', type: '上传', desc: '用户上传胸部 CT 影像智能分析平台 V3.0 备案材料', result: '失败：仅支持 PDF 类型文件', ip: '10.24.42.19', time: '2026-07-28 09:18:43' },
  { key: 'l4', user: '李嘉', role: '医院领导', org: '医务科', module: '统一运行监控中心', type: '查看', desc: '用户查看 2026 年 7 月智能体运行成本监控报告', result: '成功', ip: '10.24.5.107', time: '2026-07-28 08:55:07' },
  { key: 'l5', user: '钱文博', role: '信息科管理员', org: '信息中心', module: '用户中心', type: '停用', desc: '用户停用离岗人员账号 sunyue，并回收关联角色权限', result: '成功', ip: '10.24.8.22', time: '2026-07-27 17:40:55' },
];

const Header = ({ title, description, extra }: { title: string; description: string; extra?: React.ReactNode }) => (
  <PageHeader title={title} subTitle={description} extra={extra} />
);

const Toolbar = ({ children }: { children: React.ReactNode }) => <Card className="audit-filter-card" bordered={false}>{children}</Card>;
const truncate = (value: string) => <Tooltip title={value}><span className="audit-ellipsis">{value}</span></Tooltip>;
const exportMessage = (message: ReturnType<typeof App.useApp>['message'], count: number) => message.success(`已生成 Excel 文件，共导出 ${count} 条记录`);

function EconomicAudit() {
  const { message } = App.useApp();
  const [dept, setDept] = useState('全部科室');
  const [selected, setSelected] = useState<React.Key[]>([]);
  const data = economicRows.filter((r) => dept === '全部科室' || r.dept === dept);
  const currentMonthTokenCost = calculateTokenCost(CURRENT_MONTH_TOKEN_CONSUMPTION);
  const overallInvestmentRatio = calculateInvestmentRatio(
    currentMonthTokenCost,
    TOTAL_INVESTMENT_BUDGET_IN_TEN_THOUSAND_YUAN,
  );
  const columns: ColumnsType<(typeof economicRows)[number]> = [
    { title: '智能体编号', dataIndex: 'id', width: 120, fixed: 'left' },
    { title: '智能体名称', dataIndex: 'name', width: 190, ellipsis: true },
    { title: '版本', dataIndex: 'version', width: 80 },
    { title: '所属科室', dataIndex: 'dept', width: 140 },
    { title: '投资预算金额', dataIndex: 'budget', width: 145, sorter: (a, b) => a.budget - b.budget, render: (v) => `${v.toFixed(2)} 万元` },
    { title: 'Token 消耗量', dataIndex: 'tokens', width: 145, sorter: (a, b) => a.tokens - b.tokens, render: (v) => v.toLocaleString() },
    { title: 'Token 使用金额', dataIndex: 'cost', width: 150, sorter: (a, b) => a.cost - b.cost, render: (v) => `¥ ${v.toFixed(2)}` },
    { title: '投入产出比', dataIndex: 'ratio', width: 150, sorter: (a, b) => a.ratio - b.ratio, render: (v) => <Text strong>{v.toFixed(6)}%</Text> },
    { title: '最后更新时间', dataIndex: 'updated', width: 175 },
  ];
  const metrics = [
    {
      key: 'agents',
      title: '纳入审计智能体',
      value: 48,
      suffix: '个',
      icon: <RobotOutlined />,
      bars: [35, 48, 44, 61, 55, 74, 68, 86],
    },
    {
      key: 'budget',
      title: '总投资预算',
      value: TOTAL_INVESTMENT_BUDGET_IN_TEN_THOUSAND_YUAN,
      suffix: '万元',
      icon: <WalletOutlined />,
      bars: [70, 58, 78, 66, 82, 74, 91, 84],
    },
    {
      key: 'token',
      title: '本月 Token 使用金额',
      value: currentMonthTokenCost,
      prefix: '¥',
      precision: 2,
      icon: <ThunderboltOutlined />,
      bars: [88, 79, 82, 68, 73, 60, 55, 48],
    },
    {
      key: 'roi',
      title: '投入产出比',
      value: overallInvestmentRatio,
      suffix: '%',
      precision: 6,
      icon: <RiseOutlined />,
      bars: [38, 45, 42, 58, 64, 61, 76, 92],
    },
  ];
  return <div>
    <Header title="经济审计" description="汇总智能体投资预算与 Token 实际消耗，辅助识别投入产出效率。" />
    <div className="audit-stat-grid economic-stat-grid">
      {metrics.map((metric, index) => (
        <Card
          key={metric.key}
          bordered={false}
          className={`economic-stat-card economic-stat-card-${metric.key}`}
          style={{ '--card-delay': `${index * 90}ms` } as React.CSSProperties}
        >
          <div className="economic-stat-glow" />
          <div className="economic-stat-head">
            <span className="economic-stat-icon">{metric.icon}</span>
          </div>
          <Statistic
            title={metric.title}
            value={metric.value}
            prefix={metric.prefix}
            suffix={metric.suffix}
            precision={metric.precision}
            groupSeparator=","
          />
          <div className="economic-stat-foot">
            <span className="economic-mini-chart" aria-hidden="true">
              {metric.bars.map((height, barIndex) => <i key={barIndex} style={{ height: `${height}%` }} />)}
            </span>
          </div>
        </Card>
      ))}
    </div>
    <Toolbar><Space wrap><Text strong>所属科室</Text><Select value={dept} onChange={setDept} options={departments.map((x) => ({ label: x, value: x }))} style={{ width: 190 }} /><Text type="secondary">点击表头可按金额、用量或投入产出比排序</Text></Space></Toolbar>
    <Card bordered={false} className="audit-table-card"><Table rowSelection={{ selectedRowKeys: selected, onChange: setSelected }} columns={columns} dataSource={data} scroll={{ x: 1200 }} pagination={{ pageSize: 8, showTotal: (n) => `共 ${n} 条` }} /></Card>
  </div>;
}

const MetricCell = ({ value, description, empty }: { value: number; description: string; empty?: boolean }) => {
  if (empty) return <Text type="secondary">—</Text>;
  const abbreviated = description.length > 15 ? `${description.slice(0, 15)}…` : description;
  return (
    <div className="metric-cell">
      <Text strong className="metric-cell-value">{value}%</Text>
      <Tooltip title={description.length > 15 ? description : undefined}>
        <Text type="secondary" className="metric-cell-description">{abbreviated}</Text>
      </Tooltip>
    </div>
  );
};

function ProjectFormView({ project, onBack, onSubmit }: { project: typeof initialProjects[number]; onBack: () => void; onSubmit: () => void }) {
  const { message } = App.useApp();
  const { addMessage, pushWelcomeGreeting, consumeWelcome } = useSmartDraft();
  const [form] = Form.useForm();
  const [aiFields, setAiFields] = useState<string[]>([]);
  const [indicatorResults, setIndicatorResults] = useState<Record<number, boolean | undefined>>({});
  const [indicatorActuals, setIndicatorActuals] = useState<Record<number, string>>({});
  type MaterialKind = 'project' | 'other';
  const materialLabels: Record<MaterialKind, string> = {
    project: '项目证明材料',
    other: '其他材料',
  };
  const materialRequired: Record<MaterialKind, boolean> = { project: true, other: false };
  const [materials, setMaterials] = useState<Record<MaterialKind, UploadFile[]>>({
    project: [], other: [],
  });
  const [activeMaterialKind, setActiveMaterialKind] = useState<MaterialKind>('project');
  const usedAmount = Form.useWatch('used', form);
  const watchedValues = Form.useWatch([], form);
  const indicatorRows = [
    { key: 1, name: '随访任务按时完成率', target: '≥ 90%' },
    { key: 2, name: '临床使用满意度', target: '≥ 85 分' },
  ];
  const achievedIndicatorCount = indicatorRows.filter(({ key }) => indicatorResults[key] === true).length;
  const indicatorAchievementRate = (achievedIndicatorCount / indicatorRows.length) * 100;
  const fundUsageRate = typeof usedAmount === 'number' ? (usedAmount / 180) * 100 : undefined;
  const formatRate = (rate: number | undefined) => rate === undefined ? '—' : `${Number(rate.toFixed(2))}%`;
  const rateSummary = (label: string, rate: number | undefined, detail?: string) => (
    <Space size={8} className="audit-calculated-rate">
      <Text type="secondary">{label}</Text>
      <Text strong>{formatRate(rate)}</Text>
      {detail && <Text type="secondary" className="audit-rate-detail">（{detail}）</Text>}
    </Space>
  );
  const aiFieldLabel = (fieldKey: string, label: string) => (
    <Space size={6}>
      <span>{label}</span>
      {aiFields.includes(fieldKey) && <Tag color="success" bordered={false}>AI预填</Tag>}
    </Space>
  );
  const clearAiFields = (fieldKeys: string[]) => {
    if (!fieldKeys.length) return;
    setAiFields((previous) => previous.filter((key) => !fieldKeys.includes(key)));
  };
  const classifyMaterial = (fileName: string): MaterialKind => {
    const normalized = fileName.toLowerCase();
    return /其他|补充|附件/.test(normalized) ? 'other' : 'project';
  };
  const saveMaterial = (file: Pick<UploadFile, 'uid' | 'name' | 'size' | 'type'>, targetKind?: MaterialKind) => {
    const kind = targetKind || classifyMaterial(file.name);
    const normalizedFile: UploadFile = {
      uid: file.uid || `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'done',
    };
    setMaterials((previous) => {
      if (Object.values(previous).flat().some((item) => item.uid === normalizedFile.uid)) return previous;
      return { ...previous, [kind]: [...previous[kind], normalizedFile] };
    });
    message.success(`已上传至“${materialLabels[kind]}”`);
  };
  const applyAssistantInput = (input: string, source: 'text' | 'file' = 'text') => {
    const currentValues = form.getFieldsValue(true);
    const completion = input.match(/(?:完成度|建设完成率)[^\d]{0,6}(\d{1,3})\s*%/)?.[1];
    const used = input.match(/(?:已使用金额|使用资金|支出)[^\d]{0,8}(\d+(?:\.\d+)?)\s*万/)?.[1];
    const followUpActual = input.match(/随访任务按时完成率[^\d]{0,20}(\d+(?:\.\d+)?)\s*%/)?.[1];
    const satisfactionActual = input.match(/临床使用满意度[^\d]{0,20}(\d+(?:\.\d+)?)\s*分/)?.[1];
    const next: Record<string, unknown> = {
      ...(!currentValues.completion && completion ? { completion: Number(completion) } : {}),
      ...(!currentValues.used && used ? { used: Number(used) } : {}),
      ...(!currentValues.completionNote && source === 'text' && input.length > 8 ? { completionNote: input } : {}),
      ...(!currentValues.fundDetail && /采购|服务|训练|测试|资金|支出/.test(input) ? { fundDetail: input } : {}),
      ...(!currentValues.completionNote && source === 'file' ? { completionNote: '项目核心功能已完成建设并进入院内试运行，相关证明材料已上传。' } : {}),
      ...(!currentValues.used && source === 'file' ? { used: 136.8 } : {}),
      ...(!currentValues.fundDetail && source === 'file' ? { fundDetail: '资金主要用于软硬件采购、实施服务、模型训练及系统测试。' } : {}),
    };
    if (source === 'file') {
      setIndicatorActuals({
        1: followUpActual ? `${followUpActual}%` : '96%',
        2: satisfactionActual ? `${satisfactionActual} 分` : '91 分',
      });
      setIndicatorResults({ 1: true, 2: true });
    }
    const keys = Object.keys(next);
    const filledKeys = source === 'file'
      ? [...keys, 'indicatorActual1', 'indicatorResult1', 'indicatorActual2', 'indicatorResult2']
      : keys;
    if (keys.length) {
      form.setFieldsValue(next);
      setAiFields((previous) => [...new Set([...previous, ...filledKeys])]);
      addMessage({ role: 'agent', type: 'text', content: `已识别并填充 ${filledKeys.length} 个项目审计字段。缺失字段可继续在表单中填写，或通过文字、语音、文件补充。` });
    } else {
      addMessage({ role: 'agent', type: 'text', content: '已收到补充材料。请继续说明项目完成度、已使用金额或建设与资金使用情况。' });
    }
  };
  useEffect(() => {
    pushWelcomeGreeting('audit-project-form', 'provider', undefined, {
      actions: [
        { key: 'audit-upload', label: '上传文件', event: 'audit-project-trigger-upload', enabled: true },
        { key: 'audit-voice', label: '语音描述', event: 'audit-project-trigger-voice', enabled: true },
      ],
    });
    return () => consumeWelcome();
  }, [consumeWelcome, pushWelcomeGreeting]);
  useEffect(() => {
    const onAssistantInput = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: string; source?: 'text' | 'file' }>).detail;
      if (detail?.text) applyAssistantInput(detail.text, detail.source);
    };
    window.addEventListener('audit-project-assistant-input', onAssistantInput);
    return () => window.removeEventListener('audit-project-assistant-input', onAssistantInput);
  }, []);
  useEffect(() => {
    const onAcknowledged = (event: Event) => {
      const detail = (event as CustomEvent<{ fieldKeys?: string[] }>).detail;
      clearAiFields(detail?.fieldKeys || []);
    };
    window.addEventListener('audit-project-prefill-acknowledged', onAcknowledged);
    return () => window.removeEventListener('audit-project-prefill-acknowledged', onAcknowledged);
  }, []);
  const beforeUpload = (kind: MaterialKind) => (file: File) => {
    if (!/\.(pdf|doc|docx)$/i.test(file.name)) {
      message.error('上传失败，仅支持 PDF、DOC、DOCX 类型文件');
      return Upload.LIST_IGNORE;
    }
    if (file.size > 30 * 1024 * 1024) {
      message.error('上传失败，单文件超过最大限制 30M');
      return Upload.LIST_IGNORE;
    }
    saveMaterial({ uid: (file as File & { uid?: string }).uid || '', name: file.name, size: file.size, type: file.type }, kind);
    window.dispatchEvent(new CustomEvent('audit-project-material-uploaded', {
      detail: { fileName: file.name, fileSize: file.size, file, source: 'form' },
    }));
    return false;
  };
  useEffect(() => {
    const onMaterialUploaded = (event: Event) => {
      const detail = (event as CustomEvent<{
        fileName?: string;
        fileSize?: number;
        file?: UploadFile;
        source?: 'form' | 'assistant';
      }>).detail;
      // 表单入口已经在 beforeUpload 中保存；医小管入口则由这里同步到证明材料。
      if (!detail?.fileName || detail.source === 'form') return;
      saveMaterial({
        uid: detail.file?.uid || `assistant-${detail.fileName}-${detail.fileSize || 0}`,
        name: detail.fileName,
        size: detail.fileSize,
        type: detail.file?.type,
      });
    };
    window.addEventListener('audit-project-material-uploaded', onMaterialUploaded);
    return () => window.removeEventListener('audit-project-material-uploaded', onMaterialUploaded);
  }, []);
  const requiredMaterialsReady = materials.project.length > 0;
  const fieldsReady = !!(
    watchedValues?.completion !== undefined
    && watchedValues?.completionNote?.trim()
    && watchedValues?.used !== undefined
    && watchedValues?.fundDetail?.trim()
    && indicatorRows.every(({ key }) => indicatorActuals[key]?.trim() && indicatorResults[key] !== undefined)
  );
  const submitForm = () => form.validateFields().then(() => {
    if (!requiredMaterialsReady) {
      message.error('请上传项目证明材料');
      return;
    }
    message.success('提交成功');
    onSubmit();
  }).catch(() => message.error('请补充缺失字段并检查格式'));
  const submitPromptKey = `${fieldsReady}-${requiredMaterialsReady}-${Object.values(materials).flat().map((file) => file.uid).join(',')}`;
  const [lastSubmitPromptKey, setLastSubmitPromptKey] = useState('');
  useEffect(() => {
    if (!fieldsReady || !requiredMaterialsReady || lastSubmitPromptKey === submitPromptKey) return;
    setLastSubmitPromptKey(submitPromptKey);
    addMessage({
      role: 'agent',
      type: 'audit-submit-confirm',
      content: '项目审计信息已填写完整，必需证明材料也已上传。是否需要现在提交？',
    });
  }, [addMessage, fieldsReady, lastSubmitPromptKey, requiredMaterialsReady, submitPromptKey]);
  useEffect(() => {
    const onConfirmSubmit = () => void submitForm();
    window.addEventListener('audit-project-confirm-submit', onConfirmSubmit);
    return () => window.removeEventListener('audit-project-confirm-submit', onConfirmSubmit);
  });
  return <div>
    <Header title="项目审计信息填报" description="上传证明材料并核对项目建设、考核指标与资金使用情况。" extra={<Button icon={<ArrowLeftOutlined />} onClick={onBack}>返回列表</Button>} />
    <Form form={form} layout="vertical" initialValues={{ completion: project.completion || undefined, indicator: project.indicator || undefined, used: undefined, completionNote: '', fundDetail: '' }}>
      <Card title="证明材料" className="audit-section-card">
        <div className="audit-material-switcher">
          <Text type="secondary" className="audit-material-switcher-label">当前上传至：</Text>
          {(Object.keys(materialLabels) as MaterialKind[]).map((kind) => (
            <Tag.CheckableTag
              key={kind}
              checked={activeMaterialKind === kind}
              onChange={(checked) => checked && setActiveMaterialKind(kind)}
              className="audit-material-category"
            >
              {materialLabels[kind]}
              {materialRequired[kind] && <span className="audit-material-required">*</span>}
              <span className="audit-material-count">{materials[kind].length}份</span>
            </Tag.CheckableTag>
          ))}
        </div>
        <Upload.Dragger
          accept=".pdf,.doc,.docx"
          beforeUpload={beforeUpload(activeMaterialKind)}
          multiple
          fileList={materials[activeMaterialKind]}
          showUploadList={false}
          className="audit-material-dragger"
        >
          <p className="ant-upload-drag-icon"><CloudUploadOutlined /></p>
          <p className="ant-upload-text">点击或拖拽文件（{materialLabels[activeMaterialKind]}）</p>
          <p className="ant-upload-hint">
            {activeMaterialKind === 'project'
              ? '必填 · 需包括项目建设内容完成情况、考核指标达成情况、资金使用证明情况'
              : '选填 · 可上传其他补充材料'}
          </p>
        </Upload.Dragger>
        <div className="audit-material-files">
          {(Object.keys(materialLabels) as MaterialKind[]).map((kind) => {
            if (!materials[kind].length) return null;
            return (
              <div key={kind} className="audit-material-file-group">
                <Text type="secondary" className="audit-material-file-label">{materialLabels[kind]}（{materials[kind].length}份）：</Text>
                {materials[kind].map((file) => (
                  <Tag
                    key={file.uid}
                    color="blue"
                    closable
                    onClose={(event) => {
                      event.preventDefault();
                      setMaterials((previous) => ({ ...previous, [kind]: previous[kind].filter((item) => item.uid !== file.uid) }));
                    }}
                  >
                    {file.name}
                  </Tag>
                ))}
              </div>
            );
          })}
        </div>
        <Text type="secondary" className="audit-material-footnote">支持 PDF、DOC、DOCX · 可上传多个文件 · 单文件不超过 30M</Text>
      </Card>
      <Card title="项目基本信息" className="audit-section-card"><Descriptions column={3} items={[
        { key: '1', label: '项目名称', children: project.name }, { key: '2', label: '申报科室', children: project.dept }, { key: '3', label: '申报赛道', children: project.track },
        { key: '4', label: '项目负责人', children: project.owner }, { key: '5', label: '项目联系人', children: project.contact }, { key: '6', label: '联系方式', children: project.phone },
      ]} /></Card>
      <Card title="项目建设内容完成情况" className="audit-section-card"><Form.Item label="项目计划完成形式"><Input value="建设院内一体化管理平台并完成临床科室试运行" readOnly /></Form.Item><Form.Item name="completion" label={aiFieldLabel('completion', '完成度')} rules={[{ required: true, message: '请填写完成度' }]}><InputNumber onChange={() => clearAiFields(['completion'])} className={aiFields.includes('completion') ? 'audit-ai-field' : ''} min={0} max={100} addonAfter="%" style={{ width: 220 }} /></Form.Item><Form.Item name="completionNote" label={aiFieldLabel('completionNote', '其他说明')} rules={[{ required: true, message: '请填写建设完成情况说明' }]}><Input.TextArea onChange={() => clearAiFields(['completionNote'])} className={aiFields.includes('completionNote') ? 'audit-ai-field' : ''} rows={3} maxLength={500} showCount /></Form.Item></Card>
      <Card
        title="考核指标达成情况"
        extra={rateSummary('考核指标达成率', indicatorAchievementRate, `${achievedIndicatorCount}/${indicatorRows.length}`)}
        className="audit-section-card"
      >
        <Table
          pagination={false}
          dataSource={indicatorRows}
          columns={[
            { title: '指标名称', dataIndex: 'name' },
            { title: '需达成目标值', dataIndex: 'target' },
            {
              title: '实际完成情况',
              render: (_, row) => (
                <Input
                  className={aiFields.includes(`indicatorActual${row.key}`) ? 'audit-ai-field' : ''}
                  value={indicatorActuals[row.key]}
                  onChange={(event) => { clearAiFields([`indicatorActual${row.key}`]); setIndicatorActuals((previous) => ({ ...previous, [row.key]: event.target.value })); }}
                  placeholder="请填写实际完成情况"
                />
              ),
            },
            {
              title: '是否达成',
              render: (_, row) => (
                <Radio.Group
                  value={indicatorResults[row.key]}
                  onChange={(event) => { clearAiFields([`indicatorResult${row.key}`]); setIndicatorResults((previous) => ({ ...previous, [row.key]: event.target.value })); }}
                >
                  <Radio value>是</Radio>
                  <Radio value={false}>否</Radio>
                </Radio.Group>
              ),
            },
          ]}
        />
      </Card>
      <Card
        title="资金使用情况"
        extra={rateSummary('资金使用率', fundUsageRate)}
        className="audit-section-card"
      >
        <div className="form-grid audit-fund-grid"><Form.Item label="投资总预算"><Input value="180 万元" readOnly /></Form.Item><Form.Item name="used" label={aiFieldLabel('used', '已使用金额')} rules={[{ required: true, message: '请填写已使用金额' }]}><InputNumber onChange={() => clearAiFields(['used'])} className={aiFields.includes('used') ? 'audit-ai-field' : ''} min={0} addonAfter="万元" style={{ width: '100%' }} /></Form.Item></div><Form.Item name="fundDetail" label={aiFieldLabel('fundDetail', '资金使用明细')} rules={[{ required: true, message: '请填写资金使用明细' }]}><Input.TextArea onChange={() => clearAiFields(['fundDetail'])} className={aiFields.includes('fundDetail') ? 'audit-ai-field' : ''} rows={3} /></Form.Item>
      </Card>
      <div className="sticky-actions"><Button onClick={() => message.success('项目审计信息填报表单填写记录已暂存至草稿状态列表页')}>暂存</Button><Button type="primary" onClick={() => void submitForm()}>提交审计</Button></div>
    </Form>
  </div>;
}

function ProjectDetail({ project, auditMode, onBack, onFinish }: { project: typeof initialProjects[number]; auditMode?: boolean; onBack: () => void; onFinish?: (pass: boolean) => void }) {
  const suspectedIssueCount = [
    project.completion < 100,
    project.indicator < 90,
    project.fund < 70,
  ].filter(Boolean).length;
  const preliminaryConclusion = suspectedIssueCount > 0 ? '建议审计不通过' : '建议审计通过';
  const aiConclusion: 'pass' | 'fail' = suspectedIssueCount > 0 ? 'fail' : 'pass';
  const aiNote = suspectedIssueCount > 0
    ? `经AI预审，项目暂未完全达到审计通过条件。建设内容完成度为${project.completion}%，${project.completion < 100 ? '患者端随访提醒模块仍处于最终联调阶段；' : ''}考核指标达成率为${project.indicator}%，${project.indicator < 90 ? '其中一项核心指标尚未达到目标值；' : ''}资金使用率为${project.fund}%。建议补充未完成模块的验收材料及未达标指标的整改计划，完成后重新提交审计。`
    : `经AI预审，项目建设内容已按计划完成，核心考核指标达到目标要求，资金使用率为${project.fund}%，资金用途与申报预算一致，相关证明材料齐全，建议审计通过。`;
  const [conclusion, setConclusion] = useState<'pass' | 'fail'>(aiConclusion);
  const [note, setNote] = useState(auditMode ? aiNote : '');
  const [preview, setPreview] = useState(false);
  const { modal } = App.useApp();
  const { pushWelcomeGreeting, consumeWelcome } = useSmartDraft();
  useEffect(() => {
    if (auditMode) {
      pushWelcomeGreeting(
        'audit-project-audit',
        'admin',
        () => [suspectedIssueCount, preliminaryConclusion],
        {
          actions: [
            { key: 'audit-project-pass', label: '审计通过', event: 'audit-project-decide-pass', enabled: true },
            { key: 'audit-project-fail', label: '审计不通过', event: 'audit-project-decide-fail', enabled: true },
          ],
        },
      );
      return () => consumeWelcome();
    }
    const context = {
      ...project,
      materials: ['项目建设内容说明.pdf', '考核指标证明材料.pdf', '资金使用明细.pdf'],
      completionDescription: project.completionDescription,
      indicatorDescription: project.indicatorDescription,
      fundDescription: project.fundDescription,
    };
    (window as any).__auditProjectDetailContext = context;
    pushWelcomeGreeting('audit-project-detail', 'provider', () => [project.name]);
    return () => {
      delete (window as any).__auditProjectDetailContext;
      consumeWelcome();
    };
  }, [auditMode, consumeWelcome, preliminaryConclusion, project, pushWelcomeGreeting, suspectedIssueCount]);
  useEffect(() => {
    if (!auditMode) return undefined;
    const decidePass = () => onFinish?.(true);
    const decideFail = () => onFinish?.(false);
    window.addEventListener('audit-project-decide-pass', decidePass);
    window.addEventListener('audit-project-decide-fail', decideFail);
    return () => {
      window.removeEventListener('audit-project-decide-pass', decidePass);
      window.removeEventListener('audit-project-decide-fail', decideFail);
    };
  }, [auditMode, onFinish]);
  const submit = () => modal.confirm({ title: `确认是否审计${conclusion === 'pass' ? '通过' : '不通过'}？`, content: '提交后项目将进入对应审计结果列表。', okText: '是，确认提交', cancelText: '否', onOk: () => onFinish?.(conclusion === 'pass') });
  return <div>
    <Header title={auditMode ? '项目信息审计' : '项目审计信息详情'} description={project.name} extra={<Button icon={<ArrowLeftOutlined />} onClick={onBack}>返回</Button>} />
    <Card title="证明材料" className="audit-section-card"><Space wrap>{['项目建设内容说明.pdf', '考核指标证明材料.pdf', '资金使用明细.pdf'].map((x) => <Button key={x} icon={<FilePdfOutlined />} onClick={() => setPreview(true)}>{x}</Button>)}</Space></Card>
    <Card title="项目基本信息" className="audit-section-card"><Descriptions column={3} bordered items={[
      { key: 1, label: '项目名称', children: project.name }, { key: 2, label: '申报科室', children: project.dept }, { key: 3, label: '申报赛道', children: project.track }, { key: 4, label: '项目负责人', children: project.owner }, { key: 5, label: '项目联系人', children: project.contact }, { key: 6, label: '联系方式', children: project.phone },
    ]} /></Card>
    <div className="audit-stat-grid audit-stat-grid-three"><Card title="建设内容完成情况"><Progress type="dashboard" percent={project.completion || 80} /><Paragraph>{project.completionDescription}</Paragraph></Card><Card title="考核指标达成情况"><Progress type="dashboard" percent={project.indicator || 85} /><Paragraph>{project.indicatorDescription}</Paragraph></Card><Card title="资金使用情况"><Progress type="dashboard" percent={project.fund || 74} /><Paragraph>{project.fundDescription}</Paragraph></Card></div>
    {auditMode && <Card
      title={<Space><span>审计结论</span><Tag color="green" icon={<ThunderboltFilled />} className="audit-ai-preaudit-tag">AI 预审</Tag></Space>}
      className="audit-section-card audit-ai-review-card"
      extra={<Text type="secondary">已根据页面信息与 3 份证明材料自动生成</Text>}
    >
      <div className="audit-ai-review-hint"><CheckCircleOutlined /><span>AI预审已完成，以下结论与说明可直接提交，也可由审计人员修改后确认。</span></div>
      <div className="audit-ai-control">
        <div className="audit-ai-field-label"><Text strong>预审结论</Text><Tag color="green" icon={<ThunderboltFilled />} className="audit-ai-preaudit-tag">AI 预审</Tag></div>
        <Radio.Group value={conclusion} onChange={(e) => setConclusion(e.target.value)}>
          <Radio.Button value="pass">通过</Radio.Button>
          <Radio.Button value="fail">不通过</Radio.Button>
        </Radio.Group>
      </div>
      <div className="audit-note audit-ai-control">
        <div className="audit-ai-field-label"><Text strong>具体说明</Text><Tag color="green" icon={<ThunderboltFilled />} className="audit-ai-preaudit-tag">AI 预审</Tag></div>
        <Input.TextArea className="audit-ai-review-textarea" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} showCount rows={5} placeholder={conclusion === 'pass' ? '请填写项目达到审计要求的具体说明' : '请填写未通过原因及整改建议'} />
      </div>
      <Button danger={conclusion === 'fail'} type="primary" disabled={!note.trim()} onClick={submit}>提交审计结论</Button>
    </Card>}
    <Modal open={preview} onCancel={() => setPreview(false)} footer={<Button onClick={() => setPreview(false)}>关闭</Button>} title="证明材料预览" width={760}><div className="pdf-preview"><FilePdfOutlined /><Title level={4}>PDF 在线预览</Title><Text type="secondary">演示环境已对接文件预览与下载操作。</Text></div></Modal>
  </div>;
}

function LegacyProjectAudit() {
  const { message, modal } = App.useApp();
  const { pushWelcomeGreeting, consumeWelcome } = useSmartDraft();
  const [projects, setProjects] = useState(initialProjects);
  const [status, setStatus] = useState<ProjectStatus | '全部'>('待申请');
  const [keyword, setKeyword] = useState('');
  const [department, setDepartment] = useState('');
  const [track, setTrack] = useState('');
  const [screen, setScreen] = useState<'list' | 'form' | 'detail' | 'audit'>('list');
  const [current, setCurrent] = useState(initialProjects[0]);
  const departmentOptions = useMemo(
    () => [...new Set(projects.map((project) => project.dept))].map((value) => ({ label: value, value })),
    [projects],
  );
  const trackOptions = useMemo(
    () => [...new Set(projects.map((project) => project.track))].map((value) => ({ label: value, value })),
    [projects],
  );
  const normalizedKeyword = keyword.trim().toLocaleLowerCase();
  const filtered = projects.filter((project) =>
    (status === '全部' || project.status === status) &&
    (!normalizedKeyword || project.name.toLocaleLowerCase().includes(normalizedKeyword)) &&
    (!department || project.dept === department) &&
    (!track || project.track === track)
  );

  useEffect(() => {
    if (screen !== 'list' || status !== '全部') return undefined;
    const count = (target: ProjectStatus) => projects.filter((project) => project.status === target).length;
    const appliedCount = projects.filter((project) => !['待申请', '草稿'].includes(project.status)).length;
    pushWelcomeGreeting(
      'audit-project-all',
      'admin',
      () => [appliedCount, count('待审计'), count('审计通过'), count('审计不通过')],
      {
        chips: [
          { key: 'pending-audit', label: `待审计 ${count('待审计')}项`, targetTab: '待审计', tone: 'warning' },
          { key: 'audit-passed', label: `审计通过 ${count('审计通过')}项`, targetTab: '审计通过', tone: 'success' },
          { key: 'audit-rejected', label: `审计不通过 ${count('审计不通过')}项`, targetTab: '审计不通过', tone: 'error' },
        ],
      },
    );
    return () => consumeWelcome();
  }, [consumeWelcome, projects, pushWelcomeGreeting, screen, status]);

  useEffect(() => {
    if (screen !== 'list' || status !== '待申请') return undefined;
    const pendingApplicationProjects = projects.filter((project) => project.status === '待申请');
    pushWelcomeGreeting(
      'audit-project-application',
      'dept',
      () => [pendingApplicationProjects.length],
      {
        miniList: {
          toggleLabel: `待申请审计项目（${pendingApplicationProjects.length}）`,
          targetTab: '待申请',
          totalCount: pendingApplicationProjects.length,
          rows: pendingApplicationProjects.map((project) => ({
            recordId: project.key,
            title: project.name,
            subTitle: `申报科室：${project.dept}`,
            meta: `申报赛道：${project.track}`,
            actions: [{
              key: `fill-application-${project.key}`,
              label: '项目审计信息填报',
              kind: 'navigate-edit',
            }],
          })),
        },
      },
    );
    return () => consumeWelcome();
  }, [consumeWelcome, projects, pushWelcomeGreeting, screen, status]);

  useEffect(() => {
    if (screen !== 'list' || status !== '草稿') return undefined;
    const count = (target: ProjectStatus) => projects.filter((project) => project.status === target).length;
    const draftProjects = projects.filter((project) => project.status === '草稿');
    pushWelcomeGreeting(
      'audit-project-draft',
      'dept',
      () => [count('草稿')],
      {
        miniList: {
          toggleLabel: `未完成的项目审计信息填报草稿（${draftProjects.length}）`,
          targetTab: '草稿',
          totalCount: draftProjects.length,
          rows: draftProjects.map((project) => ({
            recordId: project.key,
            title: project.name,
            subTitle: `申报科室：${project.dept}`,
            meta: `申报赛道：${project.track}`,
            actions: [{ key: 'fill-audit', label: '项目审计信息填报', kind: 'navigate-edit' }],
          })),
        },
      },
    );
    return () => consumeWelcome();
  }, [consumeWelcome, projects, pushWelcomeGreeting, screen, status]);

  useEffect(() => {
    if (screen !== 'list' || status !== '待审计') return undefined;
    const pendingProjects = projects.filter((project) => project.status === '待审计');
    pushWelcomeGreeting(
      'audit-project-pending',
      'admin',
      () => [pendingProjects.length],
      {
        miniList: {
          toggleLabel: `查看待审计项目信息（${pendingProjects.length}）`,
          targetTab: '待审计',
          totalCount: pendingProjects.length,
          rows: pendingProjects.map((project) => ({
            recordId: project.key,
            title: project.name,
            subTitle: `申报科室：${project.dept}`,
            meta: `申报赛道：${project.track}`,
            actions: [
              {
                key: `detail-audit-${project.key}`,
                label: '查看详情',
                kind: 'navigate-detail',
              },
              {
                key: `audit-${project.key}`,
                label: '审计',
                kind: 'navigate-audit',
              },
            ],
          })),
        },
      },
    );
    return () => consumeWelcome();
  }, [consumeWelcome, projects, pushWelcomeGreeting, screen, status]);

  useEffect(() => {
    if (screen !== 'list' || status !== '审计中') return undefined;
    const reviewingProjects = projects.filter((project) => project.status === '审计中');
    pushWelcomeGreeting(
      'audit-project-reviewing',
      'dept',
      () => [reviewingProjects.length],
      {
        miniList: {
          toggleLabel: `查看这${reviewingProjects.length}项`,
          targetTab: '审计中',
          totalCount: reviewingProjects.length,
          rows: reviewingProjects.map((project) => ({
            recordId: project.key,
            title: project.name,
            subTitle: `申报科室：${project.dept}`,
            meta: `当前进度：审计中 · 更新时间：${project.time}`,
            actions: [
              {
                key: `detail-reviewing-${project.key}`,
                label: '查看详情',
                kind: 'navigate-detail',
              },
              {
                key: `revoke-reviewing-${project.key}`,
                label: '撤销',
                kind: 'confirm-revoke',
              },
            ],
          })),
        },
      },
    );
    return () => consumeWelcome();
  }, [consumeWelcome, projects, pushWelcomeGreeting, screen, status]);

  useEffect(() => {
    if (screen !== 'list' || status !== '撤销修改') return undefined;
    const revokedProjects = projects.filter((project) => project.status === '撤销修改');
    pushWelcomeGreeting(
      'audit-project-revoked',
      'admin',
      () => [revokedProjects.length],
      {
        miniList: {
          toggleLabel: `查看撤销修改项目审计信息（${revokedProjects.length}）`,
          targetTab: '撤销修改',
          totalCount: revokedProjects.length,
          rows: revokedProjects.map((project) => ({
            recordId: project.key,
            title: project.name,
            subTitle: `申报科室：${project.dept}`,
            meta: `申报赛道：${project.track}`,
            actions: [{
              key: `detail-revoked-${project.key}`,
              label: '查看详情',
              kind: 'navigate-detail',
            }],
          })),
        },
      },
    );
    return () => consumeWelcome();
  }, [consumeWelcome, projects, pushWelcomeGreeting, screen, status]);

  useEffect(() => {
    if (screen !== 'list' || status !== '审计通过') return undefined;
    const passedProjects = projects.filter((project) => project.status === '审计通过');
    pushWelcomeGreeting(
      'audit-project-passed',
      'admin',
      () => [passedProjects.length],
      {
        miniList: {
          toggleLabel: `查看这${passedProjects.length}项`,
          targetTab: '审计通过',
          totalCount: passedProjects.length,
          rows: passedProjects.map((project) => ({
            recordId: project.key,
            title: project.name,
            subTitle: `申报科室：${project.dept}`,
            meta: `申报赛道：${project.track}`,
            actions: [{
              key: `detail-passed-${project.key}`,
              label: '查看详情',
              kind: 'navigate-detail',
            }],
          })),
        },
      },
    );
    return () => consumeWelcome();
  }, [consumeWelcome, projects, pushWelcomeGreeting, screen, status]);

  useEffect(() => {
    if (screen !== 'list' || status !== '审计不通过') return undefined;
    const rejectedProjects = projects.filter((project) => project.status === '审计不通过');
    pushWelcomeGreeting(
      'audit-project-rejected',
      'provider',
      () => [rejectedProjects.length],
      {
        miniList: {
          toggleLabel: `查看这${rejectedProjects.length}项`,
          targetTab: '审计不通过',
          totalCount: rejectedProjects.length,
          rows: rejectedProjects.map((project) => ({
            recordId: project.key,
            title: project.name,
            subTitle: `申报科室：${project.dept}`,
            meta: `申报赛道：${project.track}`,
            actions: [{
              key: `detail-rejected-${project.key}`,
              label: '查看详情',
              kind: 'navigate-detail',
            }],
          })),
        },
      },
    );
    return () => consumeWelcome();
  }, [consumeWelcome, projects, pushWelcomeGreeting, screen, status]);

  useEffect(() => {
    const onJumpTab = (event: Event) => {
      const target = (event as CustomEvent<string>).detail;
      if (['待申请', '草稿', '待审计', '审计中', '撤销修改', '审计通过', '审计不通过'].includes(target)) {
        setScreen('list');
        setStatus(target as ProjectStatus);
      }
    };
    window.addEventListener('agent-jump-tab', onJumpTab);
    return () => window.removeEventListener('agent-jump-tab', onJumpTab);
  }, []);

  useEffect(() => {
    const onRowAction = (event: Event) => {
      const detail = (event as CustomEvent<{ kind?: string; recordId?: string }>).detail;
      if (!detail?.recordId) return;
      const project = projects.find((item) => item.key === detail.recordId);
      if (!project) return;
      if (detail.kind === 'navigate-edit' && ['待申请', '草稿', '撤销修改'].includes(project.status)) {
        setCurrent(project);
        setScreen('form');
      }
      if (detail.kind === 'navigate-detail' && ['待审计', '审计中', '撤销修改', '审计通过', '审计不通过'].includes(project.status)) {
        setCurrent(project);
        setScreen('detail');
      }
      if (detail.kind === 'navigate-audit' && ['待审计', '审计中'].includes(project.status)) {
        setCurrent(project);
        setScreen('audit');
      }
      if (detail.kind === 'confirm-revoke' && ['待审计', '审计中'].includes(project.status)) {
        modal.confirm({
          title: '确认撤销该项目审计？',
          content: `撤销后「${project.name}」将进入撤销修改列表。`,
          okText: '确认撤销',
          cancelText: '取消',
          onOk: () => {
            setProjects((rows) => rows.map((row) => (
              row.key === project.key ? { ...row, status: '撤销修改' } : row
            )));
            message.success('已撤销至修改列表');
          },
        });
      }
    };
    window.addEventListener('agent-bubble-row-action', onRowAction);
    return () => window.removeEventListener('agent-bubble-row-action', onRowAction);
  }, [message, modal, projects]);

  if (screen === 'form') return <ProjectFormView project={current} onBack={() => setScreen('list')} onSubmit={() => { setProjects((rows) => rows.map((r) => r.key === current.key ? { ...r, status: '待审计' } : r)); setStatus('待审计'); setScreen('list'); }} />;
  if (screen === 'detail' || screen === 'audit') return <ProjectDetail project={current} auditMode={screen === 'audit'} onBack={() => setScreen('list')} onFinish={(pass) => { setProjects((rows) => rows.map((r) => r.key === current.key ? { ...r, status: pass ? '审计通过' : '审计不通过' } : r)); message.success(`审计${pass ? '通过' : '不通过'}，记录已归档`); setStatus(pass ? '审计通过' : '审计不通过'); setScreen('list'); }} />;
  const actions = (record: typeof initialProjects[number]) => {
    const go = (target: 'form' | 'detail' | 'audit') => { setCurrent(record); setScreen(target); };
    if (status === '全部') {
      const moreItems: NonNullable<MenuProps['items']> = [];
      if (record.status === '待申请') {
        moreItems.push({ key: 'fill', label: '项目审计信息填报', onClick: () => go('form') });
      }
      if (record.status === '草稿') {
        moreItems.push(
          { key: 'edit', label: '编辑', onClick: () => go('form') },
          {
            key: 'delete',
            label: '删除',
            danger: true,
            onClick: () => modal.confirm({
              title: '确认是否删除？',
              onOk: () => {
                setProjects((rows) => rows.filter((item) => item.key !== record.key));
                message.success('删除成功');
              },
            }),
          },
        );
      }
      if (['待审计', '审计中'].includes(record.status)) {
        moreItems.push(
          { key: 'audit', label: '审计', onClick: () => go('audit') },
          {
            key: 'revoke',
            label: '撤销',
            onClick: () => {
              setProjects((rows) => rows.map((item) => (
                item.key === record.key ? { ...item, status: '撤销修改' } : item
              )));
              message.success('已撤销至修改列表');
            },
          },
        );
      }
      if (moreItems.length === 0) {
        moreItems.push({ key: 'empty', label: '暂无更多操作', disabled: true });
      }
      return (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => go('detail')}>查看详情</Button>
          <Dropdown menu={{ items: moreItems }} trigger={['click']}>
            <Button type="link" size="small" icon={<MoreOutlined />}>更多</Button>
          </Dropdown>
        </Space>
      );
    }
    if (record.status === '待申请') return (
      <Space size={0}>
        <Button type="link" onClick={() => go('detail')}>查看详情</Button>
        <Button type="link" onClick={() => go('form')}>项目审计信息填报</Button>
      </Space>
    );
    if (record.status === '草稿') return <Space size={0}><Button type="link" onClick={() => go('detail')}>详情</Button><Button type="link" onClick={() => go('form')}>编辑</Button><Button type="link" danger onClick={() => modal.confirm({ title: '确认是否删除？', onOk: () => { setProjects((r) => r.filter((x) => x.key !== record.key)); message.success('删除成功'); } })}>删除</Button></Space>;
    if (['待审计', '审计中'].includes(record.status)) return <Space size={0}><Button type="link" onClick={() => go('detail')}>查看详情</Button><Button type="link" onClick={() => go('audit')}>审计</Button><Button type="link" onClick={() => { setProjects((rows) => rows.map((r) => r.key === record.key ? { ...r, status: '撤销修改' } : r)); message.success('已撤销至修改列表'); }}>撤销</Button></Space>;
    if (record.status === '撤销修改') return <Button type="link" onClick={() => go('detail')}>查看详情</Button>;
    return <Button type="link" onClick={() => go('detail')}>查看详情</Button>;
  };
  const columns: ColumnsType<(typeof initialProjects)[number]> = [
    { title: '项目名称', dataIndex: 'name', width: 220, fixed: 'left', ellipsis: true },
    { title: '申报科室', dataIndex: 'dept', width: 100 }, { title: '申报赛道', dataIndex: 'track', width: 110 }, { title: '项目负责人', dataIndex: 'owner', width: 120 }, { title: '项目联系人', dataIndex: 'contact', width: 120 },
    { title: '建设内容完成情况', dataIndex: 'completion', width: 190, render: (v, r) => <MetricCell value={v} description={r.completionDescription} empty={r.status === '待申请'} /> },
    { title: '考核指标达成情况', dataIndex: 'indicator', width: 190, render: (v, r) => <MetricCell value={v} description={r.indicatorDescription} empty={r.status === '待申请'} /> },
    { title: '资金使用情况', dataIndex: 'fund', width: 190, render: (v, r) => <MetricCell value={v} description={r.fundDescription} empty={r.status === '待申请'} /> },
    { title: '审计状态', dataIndex: 'status', width: 105, render: (v: ProjectStatus) => <Tag color={statusColor[v]}>{v}</Tag> },
    { title: '更新时间', dataIndex: 'time', width: 175 },
    { title: '操作', fixed: 'right', width: status === '全部' ? 170 : 230, render: (_, r) => actions(r) },
  ];
  return <div><Header title="项目审计" description="覆盖项目填报、提交、两级审计、撤销修改与结果归档全流程。" />
    <Toolbar>
      <Space wrap>
        <Input allowClear prefix={<SearchOutlined />} placeholder="搜索项目名称" style={{ width: 280 }} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        <Select allowClear placeholder="申报科室" options={departmentOptions} style={{ width: 180 }} value={department || undefined} onChange={(value) => setDepartment(value || '')} />
        <Select allowClear placeholder="申报赛道" options={trackOptions} style={{ width: 160 }} value={track || undefined} onChange={(value) => setTrack(value || '')} />
        <Button onClick={() => { setKeyword(''); setDepartment(''); setTrack(''); }}>重置筛选</Button>
      </Space>
    </Toolbar>
    <Card bordered={false} className="audit-status-card"><Tabs activeKey={status} onChange={(x) => setStatus(x as typeof status)} items={(['全部', '待申请', '草稿', '待审计', '审计中', '撤销修改', '审计通过', '审计不通过'] as const).map((x) => ({ key: x, label: <span>{x}<span className="tab-count">{x === '全部' ? projects.length : projects.filter((p) => p.status === x).length}</span></span> }))} /></Card>
    <Card bordered={false} className="audit-table-card"><Table columns={columns} dataSource={filtered} scroll={{ x: 1765 }} pagination={{ pageSize: 8, showTotal: (n) => `共 ${n} 条` }} /></Card></div>;
}

type ProjectAuditRow = typeof initialProjects[number] & {
  dailyPatients: number;
  growthRate: number;
  taskSuccessRate: number;
  responseP99: number;
  doctorAdoptionRate: number;
  faultCount: number;
  recoveryTime: number;
  availabilityRate: number;
  safetyRate: number;
  riskInterceptCount: number;
  investment: number;
  tokenConsumption: number;
  tokenCost: number;
  investmentRatio: number;
  materials: string[];
};

const projectAuditRows: ProjectAuditRow[] = initialProjects.slice(0, 6).map((project, index) => {
  const dailyPatients = [326, 218, 486, 172, 395, 143][index];
  const investment = [180, 320, 95, 150, 210, 265][index];
  const calls = [128420, 92610, 176400, 64380, 118900, 52700][index];
  const tokenConsumption = [3284000000, 8926000000, 2145000000, 4762000000, 6380000000, 3910000000][index];
  const tokenCost = calculateTokenCost(tokenConsumption);
  const riskInterceptCount = [128, 91, 176, 64, 118, 52][index];
  return {
    ...project,
    dailyPatients,
    growthRate: [28.6, 21.3, 35.8, 18.2, 31.5, 16.9][index],
    taskSuccessRate: [98.7, 97.4, 99.1, 96.8, 98.2, 95.9][index],
    responseP99: [1.26, 2.18, 0.86, 1.72, 1.05, 2.46][index],
    doctorAdoptionRate: [91.2, 88.6, 94.3, 86.5, 90.8, 84.7][index],
    faultCount: [3, 5, 1, 6, 2, 7][index],
    recoveryTime: [18, 26, 12, 31, 16, 38][index],
    availabilityRate: [99.82, 99.61, 99.94, 99.42, 99.88, 99.13][index],
    riskInterceptCount,
    safetyRate: (1 - riskInterceptCount / calls) * 100,
    investment,
    tokenConsumption,
    tokenCost,
    investmentRatio: calculateInvestmentRatio(tokenCost, investment),
    materials: index < 3 ? [`${project.name}审计材料.pdf`] : [],
  };
});

const downloadTextFile = (name: string, content: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/octet-stream' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

function ProjectMaterialUpload({ project, onBack, onUploaded }: { project: ProjectAuditRow; onBack: () => void; onUploaded: (fileNames: string[]) => void }) {
  const { message } = App.useApp();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const confirmUpload = () => {
    if (!files.length) return message.warning('请先选择 PDF 文件');
    onUploaded(files.map((file) => file.name));
    message.success(project.materials.length ? '材料补充成功' : '文件上传成功');
    onBack();
  };
  return <div>
    <Header title="项目审计材料上传" description="上传项目审计所需的完整说明材料。" />
    <Card bordered={false} className="audit-section-card">
      <Descriptions column={3} bordered items={[
        { key: 'name', label: '项目名称', children: project.name },
        { key: 'dept', label: '申报科室', children: project.dept },
        { key: 'track', label: '申报赛道', children: project.track },
      ]} />
    </Card>
    <Card title="上传文件" bordered={false} className="audit-section-card">
      <Upload.Dragger
        accept="application/pdf,.pdf"
        maxCount={10}
        fileList={files}
        beforeUpload={(file) => {
          if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            message.error('仅支持 PDF 格式文件');
            return Upload.LIST_IGNORE;
          }
          if (file.size > 30 * 1024 * 1024) {
            message.error('单文件大小不能超过 30M');
            return Upload.LIST_IGNORE;
          }
          setFiles((currentFiles) => [...currentFiles, file]);
          return false;
        }}
        onRemove={(file) => { setFiles((currentFiles) => currentFiles.filter((item) => item.uid !== file.uid)); return true; }}
      >
        <p className="ant-upload-drag-icon"><CloudUploadOutlined /></p>
        <p className="ant-upload-text">点击或拖拽 PDF 文件到此区域上传</p>
        <p className="ant-upload-hint">文档需包含项目基本信息、项目建设内容完成情况、项目投资预算使用情况；单文件不超过 30M</p>
      </Upload.Dragger>
    </Card>
    <div className="sticky-actions"><Button onClick={onBack}>取消</Button><Button type="primary" onClick={confirmUpload}>确认</Button></div>
  </div>;
}

function NewProjectDetail({ project, onBack, onDeleteMaterial }: { project: ProjectAuditRow; onBack: () => void; onDeleteMaterial: (fileName: string) => void }) {
  const { message } = App.useApp();
  const [previewMaterial, setPreviewMaterial] = useState<string>();
  const percentage = (value: number) => `${value.toFixed(2)}%`;
  const sections = [
    { key: 'quality', title: '服务质量', icon: <CheckCircleOutlined />, items: [['任务执行成功率', percentage(project.taskSuccessRate)], ['响应时间 P99', `${project.responseP99} 秒`], ['医生采纳率', percentage(project.doctorAdoptionRate)], ['异常故障次数', `${project.faultCount} 次`], ['平均故障恢复时间', `${project.recoveryTime} 分钟`], ['服务可用率', percentage(project.availabilityRate)]] },
    { key: 'efficiency', title: '服务效率', icon: <RiseOutlined />, items: [['日均服务患者人数', `${project.dailyPatients} 人`], ['日均服务患者人数增长率', percentage(project.growthRate)]] },
    { key: 'benefit', title: '服务效益', icon: <WalletOutlined />, items: [['投资金额', `${project.investment.toFixed(2)} 万元`], ['Token 消耗量', project.tokenConsumption.toLocaleString()], ['Token 使用金额', `¥ ${project.tokenCost.toFixed(2)}`], ['投入产出比', percentage(project.investmentRatio)]] },
    { key: 'safety', title: '服务安全', icon: <SafetyCertificateOutlined />, items: [['风险行为拦截次数', `${project.riskInterceptCount.toLocaleString()} 次`], ['安全可控率', percentage(project.safetyRate)]] },
  ];
  return <div className="project-detail-page">
    <div className="project-detail-hero">
      <img className="project-detail-hero-image" src={auditProjectHeroUrl} alt="" aria-hidden="true" />
      <div className="project-detail-hero-motion" aria-hidden="true"><i /><i /><i /></div>
      <div className="project-detail-hero-main">
        <Title level={2}>{project.name}</Title>
        <div className="project-detail-tags"><Tag icon={<SafetyCertificateOutlined />}>{project.dept}</Tag><Tag icon={<CheckCircleOutlined />}>{project.track}</Tag></div>
      </div>
      <Button className="project-detail-back" icon={<ArrowLeftOutlined />} onClick={onBack}>返回项目列表</Button>
    </div>
    <div className="project-detail-section-heading"><Text strong>审计内容</Text></div>
    <div className="project-detail-metrics">
      {sections.map((section, index) => <Card key={section.key} className={`project-detail-metric-card metric-${section.key}`} bordered={false}>
        <div className="project-detail-metric-head"><div className="project-detail-metric-icon">{section.icon}</div><Text strong>{section.title}</Text><b>{String(index + 1).padStart(2, '0')}</b></div>
        <div className="project-detail-metric-grid">{section.items.map(([label, value]) => <div className="project-detail-metric" key={label}><Text type="secondary">{label}</Text><strong>{value}</strong></div>)}</div>
        <div className="metric-card-decoration metric-orbit-mark" aria-hidden="true">
          <i className="metric-orbit-ring" /><i className="metric-orbit-ring" /><i className="metric-orbit-dot" />
          <span>{section.icon}</span>
        </div>
      </Card>)}
    </div>
    <Card className="project-detail-material-card" bordered={false} title={<div className="project-detail-card-title"><span className="project-detail-card-title-icon"><FilePdfOutlined /></span><Text strong>审计材料</Text></div>} extra={<Tag>{project.materials.length} 份文件</Tag>}>
      {project.materials.length ? <div className="audit-material-list">{project.materials.map((material) => <div className="audit-material-item" key={material}><div className="audit-material-file"><FilePdfOutlined /><div><Text>{material}</Text><span>PDF 文档 · 审计附件</span></div></div><Space wrap><Button icon={<EyeOutlined />} onClick={() => setPreviewMaterial(material)}>预览</Button><Button icon={<DownloadOutlined />} onClick={() => { downloadTextFile(material, '项目审计材料演示文件'); message.success('开始下载审计材料'); }}>下载</Button><Popconfirm title="确认删除该附件材料？" description="删除后不可恢复" okText="删除" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={() => onDeleteMaterial(material)}><Button danger type="text" icon={<DeleteOutlined />}>删除</Button></Popconfirm></Space></div>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂未上传审计材料" />}
    </Card>
    <Modal open={Boolean(previewMaterial)} title={previewMaterial ? `审计材料预览 · ${previewMaterial}` : '审计材料预览'} width={960} onCancel={() => setPreviewMaterial(undefined)} footer={<Button onClick={() => setPreviewMaterial(undefined)}>关闭</Button>} destroyOnClose>
      <iframe className="audit-pdf-viewer" src={auditMaterialPdfUrl} title={previewMaterial ? `${previewMaterial} 预览` : '审计材料预览'} />
    </Modal>
  </div>;
}

function ProjectAudit() {
  const { message } = App.useApp();
  const [department, setDepartment] = useState<string>();
  const [track, setTrack] = useState<string>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [rows, setRows] = useState(projectAuditRows);
  const [screen, setScreen] = useState<'list' | 'upload' | 'detail'>('list');
  const [current, setCurrent] = useState(projectAuditRows[0]);
  const filtered = rows.filter((row) => (!department || row.dept === department) && (!track || row.track === track));
  const updateMaterials = (projectKey: string, materials: string[]) => {
    setRows((currentRows) => currentRows.map((row) => row.key === projectKey ? { ...row, materials } : row));
    setCurrent((currentProject) => currentProject.key === projectKey ? { ...currentProject, materials } : currentProject);
  };
  if (screen === 'upload') return <ProjectMaterialUpload project={current} onBack={() => setScreen('list')} onUploaded={(fileNames) => updateMaterials(current.key, [...current.materials, ...fileNames])} />;
  if (screen === 'detail') return <NewProjectDetail project={current} onBack={() => setScreen('list')} onDeleteMaterial={(fileName) => { updateMaterials(current.key, current.materials.filter((material) => material !== fileName)); message.success('附件材料已删除'); }} />;
  const open = (row: ProjectAuditRow, target: 'upload' | 'detail') => { setCurrent(row); setScreen(target); };
  const rate = (value: number) => `${value.toFixed(2)}%`;
  const investmentRatioRate = rate;
  const sortable = (key: keyof ProjectAuditRow) => (a: ProjectAuditRow, b: ProjectAuditRow) => Number(a[key]) - Number(b[key]);
  const columns: ColumnsType<ProjectAuditRow> = [
    { title: '项目名称', dataIndex: 'name', fixed: 'left', width: 220, ellipsis: true },
    { title: '申报科室', dataIndex: 'dept', width: 105 }, { title: '申报赛道', dataIndex: 'track', width: 105 },
    { title: <span style={{ whiteSpace: 'nowrap' }}>日均服务患者人数</span>, dataIndex: 'dailyPatients', width: 190, sorter: sortable('dailyPatients'), render: (v) => `${v} 人` },
    { title: '日均服务患者人数增长率', dataIndex: 'growthRate', width: 205, sorter: sortable('growthRate'), render: rate },
    { title: '任务执行成功率', dataIndex: 'taskSuccessRate', width: 150, sorter: sortable('taskSuccessRate'), render: rate },
    { title: '响应时间 P99', dataIndex: 'responseP99', width: 170, sorter: sortable('responseP99'), render: (v) => `${v} 秒` },
    { title: '医生采纳率', dataIndex: 'doctorAdoptionRate', width: 130, sorter: sortable('doctorAdoptionRate'), render: rate },
    { title: '异常故障次数', dataIndex: 'faultCount', width: 165, sorter: sortable('faultCount'), render: (v) => `${v} 次` },
    { title: '平均故障恢复时间', dataIndex: 'recoveryTime', width: 165, sorter: sortable('recoveryTime'), render: (v) => `${v} 分钟` },
    { title: '服务可用率', dataIndex: 'availabilityRate', width: 130, sorter: sortable('availabilityRate'), render: rate },
    { title: '投资金额', dataIndex: 'investment', width: 135, render: (v) => `${v.toFixed(2)} 万元` },
    { title: 'Token 消耗量', dataIndex: 'tokenConsumption', width: 145, sorter: sortable('tokenConsumption'), render: (v) => v.toLocaleString() },
    { title: 'Token 使用金额', dataIndex: 'tokenCost', width: 150, sorter: sortable('tokenCost'), render: (v) => `¥ ${v.toFixed(2)}` },
    { title: '投入产出比', dataIndex: 'investmentRatio', width: 140, sorter: sortable('investmentRatio'), render: investmentRatioRate },
    { title: '风险行为拦截次数', dataIndex: 'riskInterceptCount', width: 180, render: (v) => `${v} 次` },
    { title: '安全可控率', dataIndex: 'safetyRate', width: 130, sorter: sortable('safetyRate'), render: rate },
    { title: '附件材料', dataIndex: 'materials', width: 110, align: 'center', render: (materials: string[]) => `${materials.length} 个` },
    { title: '操作', fixed: 'right', width: 190, render: (_, row) => <Space size={0}><Button type="link" onClick={() => open(row, 'upload')}>{row.materials.length ? '补充材料' : '上传材料'}</Button><Button type="link" onClick={() => open(row, 'detail')}>查看详情</Button></Space> },
  ];
  const totalTokenCost = rows.reduce((sum, row) => sum + row.tokenCost, 0);
  const totalInvestment = rows.reduce((sum, row) => sum + row.investment, 0);
  const overallInvestmentRatio = calculateInvestmentRatio(totalTokenCost, totalInvestment);
  const averageSafetyRate = rows.length ? rows.reduce((sum, row) => sum + row.safetyRate, 0) / rows.length : 0;
  const exportSelected = (format: 'excel' | 'csv') => {
    const exportRows = rows.filter((row) => selectedRowKeys.includes(row.key));
    if (!exportRows.length) {
      message.warning('请先选择需要导出的项目');
      return;
    }
    const headers = ['项目名称', '申报科室', '申报赛道', '日均服务患者人数', '日均服务患者人数增长率', '医生采纳率', '投资金额(万元)', 'Token消耗量', 'Token使用金额(元)', '投入产出比', '风险行为拦截次数', '安全可控率', '附件材料数量'];
    const values = exportRows.map((row) => [row.name, row.dept, row.track, row.dailyPatients, rate(row.growthRate), rate(row.doctorAdoptionRate), row.investment, row.tokenConsumption, row.tokenCost.toFixed(2), rate(row.investmentRatio), row.riskInterceptCount, rate(row.safetyRate), row.materials.length]);
    const csv = [headers, ...values].map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const extension = format === 'excel' ? 'xls' : 'csv';
    downloadTextFile(`项目审计数据.${extension}`, `\uFEFF${csv}`);
    message.success(`已导出 ${exportRows.length} 条项目审计数据（${format === 'excel' ? 'Excel' : 'CSV'}）`);
  };
  const metrics = [
    {
      key: 'efficiency', dimension: '服务效率', title: '日均服务患者人数增长率', value: 25.38, suffix: '%',
      icon: <TeamOutlined />, bars: [34, 42, 48, 55, 63, 70, 78, 88],
    },
    {
      key: 'quality', dimension: '服务质量', title: '医生采纳率', value: 89.35, suffix: '%',
      icon: <LikeOutlined />, bars: [56, 62, 58, 70, 76, 73, 84, 91],
    },
    {
      key: 'benefit', dimension: '服务效益', title: '投入产出比', value: overallInvestmentRatio, suffix: '%', precision: 2,
      icon: <WalletOutlined />, bars: [82, 86, 84, 90, 88, 94, 92, 97],
    },
    {
      key: 'safety', dimension: '服务安全', title: '安全可控率', value: averageSafetyRate, suffix: '%',
      icon: <SafetyCertificateOutlined />, bars: [76, 82, 87, 85, 91, 94, 96, 100],
    },
  ];
  return <div>
    <Header title="项目审计" description="从服务效率、服务质量、服务效益和服务安全维度审计项目运行成效。" extra={<Button icon={<ReloadOutlined />} onClick={() => message.success('各维度数据已更新到最新')}>刷新</Button>} />
    <div className="audit-stat-grid economic-stat-grid project-stat-grid">
      {metrics.map((metric, index) => (
        <Card
          key={metric.key}
          bordered={false}
          className={`economic-stat-card project-stat-card project-stat-card-${metric.key}`}
          style={{ '--card-delay': `${index * 90}ms` } as React.CSSProperties}
        >
          <div className="economic-stat-glow" />
          <div className="economic-stat-head project-stat-head">
            <span className="economic-stat-icon">{metric.icon}</span>
            <span className="project-stat-dimension">{metric.dimension}</span>
          </div>
          <Statistic title={metric.title} value={metric.value} precision={metric.precision ?? 2} suffix={metric.suffix} />
          <div className="economic-stat-foot">
            <span className="economic-mini-chart" aria-hidden="true">
              {metric.bars.map((height, barIndex) => <i key={barIndex} style={{ height: `${height}%` }} />)}
            </span>
          </div>
        </Card>
      ))}
    </div>
    <Toolbar>
      <div className="project-audit-toolbar">
        <Space wrap><Text strong>筛选项</Text><Select allowClear placeholder="申报科室" value={department} onChange={setDepartment} style={{ width: 180 }} options={[...new Set(projectAuditRows.map((x) => x.dept))].map((value) => ({ label: value, value }))} /><Select allowClear placeholder="申报赛道" value={track} onChange={setTrack} style={{ width: 180 }} options={[...new Set(projectAuditRows.map((x) => x.track))].map((value) => ({ label: value, value }))} /><Button onClick={() => { setDepartment(undefined); setTrack(undefined); }}>重置</Button><Text type="secondary">点击指标表头可切换升序或降序</Text></Space>
        <Space>
          <Dropdown menu={{ items: [{ key: 'excel', label: '导出 Excel' }, { key: 'csv', label: '导出 CSV' }], onClick: ({ key }) => exportSelected(key as 'excel' | 'csv') }}>
            <Button icon={<DownloadOutlined />}>批量导出 <DownOutlined /></Button>
          </Dropdown>
          <Button icon={<DownloadOutlined />} href="/项目审计报告模板(1).docx" download="项目审计报告模板.docx" onClick={() => message.success('项目审计报告模板已下载')}>模板下载</Button>
        </Space>
      </div>
    </Toolbar>
    <Card bordered={false} className="audit-table-card project-audit-table-card"><Table rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }} columns={columns} dataSource={filtered} scroll={{ x: 2900 }} pagination={{ pageSize: 8, showTotal: (n) => `共 ${n} 条` }} /></Card>
  </div>;
}

function SessionDetail({ session }: { session: AuditSession }) {
  const processCount = session.turns.reduce((total, turn) => total + (turn.process?.length || 0), 0);
  return (
    <div className="session-detail">
      <div className="session-detail-meta">
        <Text type="secondary">会话全过程 · 敏感信息已脱敏</Text>
        <Space size={6}>
          <Tag bordered={false}>{session.turns.length} 条消息</Tag>
          <Tag bordered={false}>{processCount} 个过程记录</Tag>
        </Space>
      </div>
      <Timeline
        className="session-timeline"
        items={session.turns.map((turn, turnIndex) => ({
          color: turn.role === 'user' ? 'blue' : 'green',
          children: (
            <article className={`session-message session-message-${turn.role}`}>
              <div className="session-message-head">
                <Space size={8}>
                  <span className={`session-role-icon session-role-icon-${turn.role}`}>
                    {turn.role === 'user' ? '用' : <RobotOutlined />}
                  </span>
                  <Text strong>{turn.role === 'user' ? '用户' : '智能体'}</Text>
                  <Text type="secondary">· {turn.time}</Text>
                </Space>
              </div>
              <Paragraph className="session-message-content">{turn.content}</Paragraph>
              {!!turn.process?.length && (
                <Collapse
                  ghost
                  className="session-process-collapse"
                  expandIconPosition="end"
                  expandIcon={({ isActive }) => <DownOutlined rotate={isActive ? 180 : 0} />}
                  items={[{
                    key: `${turnIndex}-process`,
                    label: (
                      <Space size={8}>
                        <CodeOutlined />
                        <span>查看推理与工具调用过程</span>
                        <Tag bordered={false}>{turn.process.length}</Tag>
                      </Space>
                    ),
                    children: (
                      <div className="session-process-list">
                        {turn.process.map((step, stepIndex) => (
                          <div className={`session-process-step session-process-${step.type}`} key={`${step.title}-${stepIndex}`}>
                            <span className="session-process-icon">{step.type === 'tool' ? <ToolOutlined /> : <ApiOutlined />}</span>
                            <div>
                              <div className="session-process-title">
                                <Text strong>{step.title}</Text>
                                <Tag color={step.type === 'tool' ? 'blue' : 'purple'} bordered={false}>
                                  {step.type === 'tool' ? '工具调用' : '推理摘要'}
                                </Tag>
                              </div>
                              <Text type="secondary">{step.detail}</Text>
                              {step.result && <div className="session-tool-result"><CheckCircleOutlined /> {step.result}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ),
                  }]}
                />
              )}
              {turn.role === 'agent' && turnIndex === session.turns.length - 1 && (
                <div className="safe-note"><CheckCircleOutlined /> 内容安全检测通过 · 未发现敏感信息外泄</div>
              )}
            </article>
          ),
        }))}
      />
    </div>
  );
}

function BehaviorAudit() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<(typeof agentRows)[number] | null>(null);
  const [session, setSession] = useState<(typeof sessions)[number] | null>(null);
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState<string>();
  const [lastCalledRange, setLastCalledRange] = useState<[string, string] | null>(null);
  const [selected, setSelected] = useState<React.Key[]>([]);
  const agents = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return agentRows.filter((item) => {
      const matchesKeyword = !keyword || `${item.id} ${item.name}`.toLowerCase().includes(keyword);
      const matchesDepartment = !department || item.dept === department;
      const matchesLastCalled = !lastCalledRange
        || (item.last >= lastCalledRange[0] && item.last <= lastCalledRange[1]);
      return matchesKeyword && matchesDepartment && matchesLastCalled;
    });
  }, [department, lastCalledRange, query]);
  if (agent) return <div><Header title="智能体会话记录" description={`${agent.id} · ${agent.name}`} extra={<><Button icon={<ReloadOutlined />} onClick={() => message.success('会话数据已刷新')}>刷新</Button><Button icon={<ArrowLeftOutlined />} onClick={() => { setAgent(null); setSession(null); navigate('/app/audit/behavior'); }}>返回智能体列表</Button></>} />
    <Toolbar><Space wrap><Input prefix={<SearchOutlined />} placeholder="搜索会话标题或摘要" style={{ width: 280 }} /><RangePicker showTime /></Space></Toolbar>
    <Card bordered={false} className="audit-table-card"><Table dataSource={sessions} columns={[
      { title: '会话标题', dataIndex: 'title', width: 190 }, { title: '首轮输入摘要', dataIndex: 'input', ellipsis: true, render: truncate }, { title: '末轮输出摘要', dataIndex: 'output', ellipsis: true, render: truncate }, { title: '会话时长', dataIndex: 'duration', width: 110, sorter: (a, b) => a.duration - b.duration, render: (v) => `${Math.floor(v / 60)} 分 ${v % 60} 秒` }, { title: '会话开始时间', dataIndex: 'start', width: 175 }, { title: '会话结束时间', dataIndex: 'end', width: 175 }, { title: '操作', width: 90, fixed: 'right', render: (_, r) => <Button type="link" onClick={() => setSession(r)}>查看详情</Button> },
    ]} scroll={{ x: 1250 }} /></Card>
    <Drawer
      title={session?.title}
      open={!!session}
      onClose={() => setSession(null)}
      width={760}
      className="session-detail-drawer"
      destroyOnClose
    >
      {session && <SessionDetail session={session} />}
    </Drawer>
  </div>;
  return <div><Header title="智能体行为审计" description="按智能体查看会话规模、最近调用时间并下钻追溯完整交互。" />
    <Toolbar><Space wrap><Input value={query} onChange={(e) => setQuery(e.target.value)} prefix={<SearchOutlined />} placeholder="搜索智能体编号或名称" allowClear style={{ width: 280 }} /><Select value={department} onChange={setDepartment} options={departments.slice(1).map((x) => ({ label: x, value: x }))} placeholder="所属科室" allowClear style={{ width: 190 }} /><RangePicker onChange={(dates) => setLastCalledRange(dates?.[0] && dates[1] ? [dates[0].startOf('day').format('YYYY-MM-DD HH:mm:ss'), dates[1].endOf('day').format('YYYY-MM-DD HH:mm:ss')] : null)} placeholder={['最近调用开始', '最近调用结束']} /></Space></Toolbar>
    <Card bordered={false} className="audit-table-card"><Table rowSelection={{ selectedRowKeys: selected, onChange: setSelected }} dataSource={agents} columns={[
      { title: '智能体编号', dataIndex: 'id', render: (v, r) => <Button type="link" onClick={() => setAgent(r)}>{v}</Button> }, { title: '智能体名称', dataIndex: 'name' }, { title: '版本', dataIndex: 'version', width: 90 }, { title: '所属科室', dataIndex: 'dept' }, { title: '会话数', dataIndex: 'sessions', sorter: (a, b) => a.sessions - b.sessions, render: (v) => v.toLocaleString() }, { title: '最近调用时间', dataIndex: 'last', sorter: (a, b) => a.last.localeCompare(b.last) }, { title: '操作', render: (_, r) => <Button type="link" onClick={() => setAgent(r)}>查看所有会话记录</Button> },
    ]} /></Card></div>;
}

function OperationLogs() {
  const [filters, setFilters] = useState({ org: '全部组织', module: '全部模块', type: '全部类型', result: '全部结果' });
  const [selected, setSelected] = useState<React.Key[]>([]);
  const [detail, setDetail] = useState<(typeof logRows)[number] | null>(null);
  const filtered = useMemo(() => logRows.filter((x) => (filters.org === '全部组织' || x.org === filters.org) && (filters.module === '全部模块' || x.module === filters.module) && (filters.type === '全部类型' || x.type === filters.type) && (filters.result === '全部结果' || x.result.startsWith(filters.result))), [filters]);
  const choose = (key: keyof typeof filters, value: string) => setFilters((p) => ({ ...p, [key]: value }));
  return <div><Header title="操作日志" description="记录平台关键操作、执行结果和登录 IP，满足全过程留痕与责任追溯。" />
    <Toolbar><div className="filter-grid"><Select value={filters.org} onChange={(v) => choose('org', v)} options={['全部组织', '信息中心', '心内科', '影像科', '医务科'].map((x) => ({ label: x, value: x }))} /><Select value={filters.module} onChange={(v) => choose('module', v)} options={['全部模块', ...new Set(logRows.map((x) => x.module))].map((x) => ({ label: x, value: x }))} /><Select value={filters.type} onChange={(v) => choose('type', v)} options={['全部类型', '新建', '编辑', '删除', '查看', '上传', '导出', '审计', '撤销', '停用'].map((x) => ({ label: x, value: x }))} /><Select value={filters.result} onChange={(v) => choose('result', v)} options={['全部结果', '成功', '失败'].map((x) => ({ label: x, value: x }))} /><RangePicker showTime /></div></Toolbar>
    <Card bordered={false} className="audit-table-card"><Table rowSelection={{ selectedRowKeys: selected, onChange: setSelected }} dataSource={filtered} columns={[
      { title: '用户名称', dataIndex: 'user', width: 100 }, { title: '用户角色', dataIndex: 'role', width: 125 }, { title: '所属组织', dataIndex: 'org', width: 100 }, { title: '操作模块', dataIndex: 'module', width: 165, ellipsis: true }, { title: '操作类型', dataIndex: 'type', width: 90, render: (v) => <Tag color="blue">{v}</Tag> }, { title: '操作描述', dataIndex: 'desc', width: 250, ellipsis: true, render: truncate }, { title: '操作结果', dataIndex: 'result', width: 190, render: (v: string) => <Tag color={v === '成功' ? 'success' : 'error'}>{v}</Tag> }, { title: '登录 IP 地址', dataIndex: 'ip', width: 130 }, { title: '操作时间', dataIndex: 'time', width: 175, sorter: (a, b) => a.time.localeCompare(b.time) }, { title: '操作', fixed: 'right', width: 90, render: (_, r) => <Button type="link" icon={<EyeOutlined />} onClick={() => setDetail(r)}>详情</Button> },
    ]} scroll={{ x: 1450 }} pagination={{ pageSize: 8, showTotal: (n) => `共 ${n} 条` }} /></Card>
    <Drawer title="操作日志详情" open={!!detail} onClose={() => setDetail(null)} width={620} extra={<Button onClick={() => setDetail(null)}>返回</Button>}>{detail && <><div className={`log-result ${detail.result === '成功' ? 'success' : 'error'}`}>{detail.result === '成功' ? <CheckCircleOutlined /> : <ClockCircleOutlined />}<div><Text strong>{detail.result}</Text><Text type="secondary">系统已完整记录本次操作上下文</Text></div></div><Descriptions column={1} bordered items={Object.entries({ 用户名称: detail.user, 用户角色: detail.role, 所属组织: detail.org, 操作模块: detail.module, 操作类型: detail.type, 操作描述: detail.desc, 操作结果: detail.result, '登录 IP 地址': detail.ip, 操作时间: detail.time }).map(([label, children]) => ({ key: label, label, children }))} /></>}</Drawer>
  </div>;
}

export default function AuditCenter() {
  const location = useLocation();
  const section = (location.pathname.split('/')[3] || 'project') as AuditSection;
  const current = ['project', 'behavior', 'logs'].includes(section) ? section : 'project';
  const content = current === 'project' ? <ProjectAudit /> : current === 'behavior' ? <BehaviorAudit /> : <OperationLogs />;
  return <App><div className="audit-page">{content}</div></App>;
}
