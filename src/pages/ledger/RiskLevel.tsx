// 统一台账中心 - 智能体风险分级页（V1.8 §2.3）
//
// 依据《统一台账中心-需求说明文档 V1.8》§2.3：
//   · 风险等级仅分 高度关注 / 中度关注 / 一般关注 三级，不再区分「初步判定 / 复核判定」；
//   · 操作权限：
//       - 信息科管理员：可对全院所有智能体进行风险评定操作；
//       - 科室管理员：仅能看到本科室的智能体，且仅能对自己接入的智能体进行风险评定操作；
//   · 流程（单阶段）：
//       1. 用户在列表页或详情页点击【风险分级】进入问卷；
//       2. 填写 7 题量表（A/B/C 三选一）；
//       3. 点击【提交】，系统按判定规则自动评定（高度 > 中度 > 一般）并弹出结果弹窗；
//       4. 弹窗展示风险评级 + 判定依据（只读，不可手动编辑）；
//       5. 用户点击【确认】→ 风险等级生效并同步至总览 / 列表 / 详情；
//          点击【取消】→ 返回问卷页可修改后重新提交；
//   · 后续如需修改风险等级，在列表页点击【风险分级】入口重新填写问卷并确认；
//   · 判定规则（短路顺序）：
//       · 高度关注：Q1-Q7 中任一题选 C
//       · 中度关注：Q1-Q7 无 C 但任一题选 B
//       · 一般关注：Q1-Q7 全部选 A

import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  Typography,
  Tag,
  Radio,
  Form,
  message,
  Modal,
  Result,
  Descriptions,
  Tooltip,
  Flex,
  Alert,
} from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import {
  ledgerAgents,
  currentUser,
  type LedgerAgent,
  type RiskInitialAnswers,
} from '../../mock/ledger';

const { Text, Paragraph } = Typography;

// ============== 类型 ==============
type RiskLevelValue = '高度关注' | '中度关注' | '一般关注';

interface QuestionOption {
  value: 'A' | 'B' | 'C';
  label: string;
}

interface Question {
  key: keyof RiskInitialAnswers;
  title: string;
  options: QuestionOption[];
}

// ============== Q1-Q7 量表（V1.8 §2.3.1）==============
const QUESTIONS: Question[] = [
  {
    key: 'Q1',
    title: 'Q1. 本智能体是否参与临床诊疗决策或治疗过程？',
    options: [
      { value: 'A', label: 'A. 不参与临床诊疗，仅用于健康信息或流程辅助' },
      { value: 'B', label: 'B. 提供医疗诊疗过程中的重要参考信息或关键技术支持' },
      { value: 'C', label: 'C. 参与辅助诊断或治疗，直接影响诊疗决策或治疗路径' },
    ],
  },
  {
    key: 'Q2',
    title: 'Q2. 本智能体的核心功能类型：',
    options: [
      { value: 'A', label: 'A. 健康科普 / 导诊 / 非诊疗支持' },
      { value: 'B', label: 'B. 医疗信息处理 / 辅助分析工具' },
      { value: 'C', label: 'C. 临床辅助决策或治疗支持系统' },
    ],
  },
  {
    key: 'Q3',
    title: 'Q3. 本智能体提供医疗信息支持的深度：',
    options: [
      { value: 'A', label: 'A. 提供通用健康知识或流程信息' },
      { value: 'B', label: 'B. 提供结构化医疗信息支持（如报告解读、摘要分析）' },
      { value: 'C', label: 'C. 提供影响临床判断的关键医疗信息或分析结果' },
    ],
  },
  {
    key: 'Q4',
    title: 'Q4. 当智能体发生错误时的影响：',
    options: [
      { value: 'A', label: 'A. 无临床影响或仅信息误差' },
      { value: 'B', label: 'B. 影响诊疗效率或可能导致延误' },
      { value: 'C', label: 'C. 可能导致错误诊疗或严重医疗后果' },
    ],
  },
  {
    key: 'Q5',
    title: 'Q5. 本智能体应用的医疗场景风险等级：',
    options: [
      { value: 'A', label: 'A. 非医疗或一般健康管理场景' },
      { value: 'B', label: 'B. 常见病或慢性病管理场景' },
      { value: 'C', label: 'C. 肿瘤、心脑血管或危重症等高风险医疗场景' },
    ],
  },
  {
    key: 'Q6',
    title: 'Q6. 本智能体处理的数据类型：',
    options: [
      { value: 'A', label: 'A. 无患者数据，仅公开医学知识' },
      { value: 'B', label: 'B. 脱敏或匿名医疗数据' },
      { value: 'C', label: 'C. 真实患者医疗数据（病历/影像/检验等）' },
    ],
  },
  {
    key: 'Q7',
    title: 'Q7. 本智能体对医疗系统或流程的控制能力：',
    options: [
      { value: 'A', label: 'A. 独立运行，不对接医疗系统' },
      { value: 'B', label: 'B. 在医疗系统中只读或查询（HIS 等）' },
      { value: 'C', label: 'C. 可写入系统或触发医疗业务/设备执行' },
    ],
  },
];

// ============== 判定规则（V1.8 §2.3.1 旁注）==============
function computeLevel(answers: RiskInitialAnswers): RiskLevelValue {
  const values = Object.values(answers).filter((v): v is 'A' | 'B' | 'C' => v != null);
  if (values.length < 7) throw new Error('请完成所有题目作答');
  // 高度关注：任一题选 C
  if (values.includes('C')) return '高度关注';
  // 中度关注：无 C 但任一题选 B
  if (values.includes('B')) return '中度关注';
  // 一般关注：全部选 A
  return '一般关注';
}

function generateBasis(level: RiskLevelValue, answers: RiskInitialAnswers): string {
  const aCount = Object.values(answers).filter((v) => v === 'A').length;
  const bCount = Object.values(answers).filter((v) => v === 'B').length;
  const cCount = Object.values(answers).filter((v) => v === 'C').length;

  if (level === '高度关注') {
    return `根据风险分级量表判定：Q1-Q7 中存在 ${cCount} 题选 C（即参与辅助诊断或治疗 / 可能导致错误诊疗或严重医疗后果 / 应用于肿瘤、心脑血管或危重症等高风险场景 / 处理真实患者医疗数据 / 可写入医疗系统或触发医疗业务/设备执行），综合判定为「高度关注」。建议在临床应用中加强监督与人工复核，定期评估其输出质量。`;
  }
  if (level === '中度关注') {
    return `根据风险分级量表判定：Q1-Q7 无 C 题，但存在 ${bCount} 题选 B（即提供医疗诊疗过程中的重要参考信息或关键技术支持，或影响诊疗效率但不改变诊疗结论），综合判定为「中度关注」。建议定期评估其输出质量，并配套相关审批流程。`;
  }
  return `根据风险分级量表判定：Q1-Q7 全部 7 题选 A（即不参与临床诊疗决策，仅用于健康科普 / 流程指引 / 行政辅助；应用场景为非医疗或一般健康管理；不接触临床诊疗数据；独立运行不对接医疗系统），综合判定为「一般关注」。建议按常规流程管理。`;
}

// ============== 配色 ==============
const RISK_COLOR: Record<RiskLevelValue, string> = {
  高度关注: 'red',
  中度关注: 'orange',
  一般关注: 'default',
};

const RISK_DESCRIPTION: Record<RiskLevelValue, string> = {
  高度关注: '应用于临床关键决策、危重症场景或处理真实患者数据，需要重点监督与人工复核',
  中度关注: '提供重要参考信息或关键技术支持，需定期评估并配套审批流程',
  一般关注: '仅用于健康信息或流程辅助，按常规流程管理',
};

// ============== 主组件 ==============
const RiskLevelPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isPlatformAdmin = currentUser.role === 'platform_admin';
  const isDeptAdmin = currentUser.role === 'dept_admin';

  const agent: LedgerAgent | undefined = useMemo(
    () => ledgerAgents.find((a) => a.id === id),
    [id],
  );

  const [form] = Form.useForm<RiskInitialAnswers>();

  // 权限校验
  const hasAccess = useMemo(() => {
    if (!agent) return false;
    if (isPlatformAdmin) return true;
    if (isDeptAdmin) {
      // 科室管理员：本科室 + 仅限自己科室接入的智能体
      // 当前 mock 数据中由 deptAdmin 部门等于 agent.department 判定「本科室」
      const isOwnDept = agent.department === currentUser.department;
      // 演示：本科室管理员对自己科室全部智能体均有权限
      return isOwnDept;
    }
    return false;
  }, [agent, isPlatformAdmin, isDeptAdmin]);

  // 已答数量
  const answeredCount = useMemo(() => {
    const values = form.getFieldsValue();
    return Object.values(values).filter((v) => v != null && v !== '').length;
  }, [form]);

  if (!agent) {
    return (
      <Result
        status="404"
        title="智能体不存在"
        extra={
          <Button type="primary" onClick={() => navigate('/app/ledger/list')}>
            返回台账列表
          </Button>
        }
      />
    );
  }

  if (!hasAccess) {
    return (
      <Result
        status="403"
        title="无权访问"
        subTitle={
          isDeptAdmin
            ? `仅「${currentUser.department}」科室管理员对本院智能体具有风险评定权限`
            : '您当前角色不支持风险评定操作'
        }
        extra={
          <Button onClick={() => navigate('/app/ledger/list')}>返回台账列表</Button>
        }
      />
    );
  }

  // 当前已有的风险等级
  const currentLevel: RiskLevelValue | undefined =
    agent.riskLevel && agent.riskLevel !== '待分级' && agent.riskLevel !== '待复核'
      ? (agent.riskLevel as RiskLevelValue)
      : undefined;
  const currentBasis: string | undefined = agent.riskBasis || agent.riskReviewBasis;

  // ============== 提交 ==============
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const answers: RiskInitialAnswers = {
        Q1: values.Q1 ?? null,
        Q2: values.Q2 ?? null,
        Q3: values.Q3 ?? null,
        Q4: values.Q4 ?? null,
        Q5: values.Q5 ?? null,
        Q6: values.Q6 ?? null,
        Q7: values.Q7 ?? null,
      };
      const unanswered = Object.entries(answers)
        .filter(([_, v]) => v == null)
        .map(([k]) => k);
      if (unanswered.length > 0) {
        message.error(`请完成第 ${unanswered.length === 1 ? unanswered[0] : unanswered.join('、')} 题作答`);
        return;
      }
      const level = computeLevel(answers);
      const basis = generateBasis(level, answers);

      Modal.confirm({
        title: (
          <Space>
            <SafetyCertificateOutlined style={{ color: '#1677FF' }} />
            <span>风险等级评定结果</span>
          </Space>
        ),
        width: 560,
        icon: null,
        content: (
          <div>
            <div
              style={{
                marginBottom: 12,
                padding: 16,
                background: '#F0F5FF',
                border: '1px solid #ADC6FF',
                borderRadius: 6,
              }}
            >
              <div style={{ marginBottom: 6 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  风险评级（不可手动编辑）
                </Text>
              </div>
              <Space size={8}>
                <Tag
                  color={RISK_COLOR[level]}
                  style={{ fontSize: 16, padding: '4px 16px', fontWeight: 500 }}
                >
                  {level}
                </Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {RISK_DESCRIPTION[level]}
                </Text>
              </Space>
            </div>
            <div style={{ marginBottom: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                判定依据（不可编辑，仅可滚动查看）
              </Text>
            </div>
            <div
              style={{
                padding: 12,
                background: '#FAFAFA',
                border: '1px solid #F0F0F0',
                borderRadius: 4,
                maxHeight: 220,
                overflowY: 'auto',
                fontSize: 13,
                lineHeight: 1.7,
                color: '#595959',
              }}
            >
              {basis}
            </div>
            <Alert
              type="info"
              showIcon
              style={{ marginTop: 12 }}
              message={
                <span style={{ fontSize: 12 }}>
                  确认后风险等级将同步至台账总览页、台账列表页、智能体信息详情页。
                </span>
              }
            />
          </div>
        ),
        okText: '确认',
        cancelText: '取消',
        okButtonProps: { type: 'primary' },
        onOk: () => {
          message.success('评定成功，风险等级已生效');
          setTimeout(() => {
            navigate(`/app/ledger/detail/${agent.id}`);
          }, 600);
        },
        onCancel: () => {
          // 取消返回问卷页（不关闭 modal 内部状态）
        },
      });
    } catch {
      // 校验失败
    }
  };

  // 返回上一步（二次确认）
  const handleBack = () => {
    if (answeredCount > 0) {
      Modal.confirm({
        title: '确认离开？',
        content: '当前问卷有未提交的修改，离开后将丢失这些内容。',
        okText: '确认离开',
        cancelText: '继续填写',
        okButtonProps: { danger: true },
        onOk: () => navigate(`/app/ledger/detail/${agent.id}`),
      });
    } else {
      navigate(`/app/ledger/detail/${agent.id}`);
    }
  };

  // ============== 渲染 ==============
  const renderAgentInfo = () => (
    <Card
      bordered={false}
      title={
        <Space>
          <InfoCircleOutlined style={{ color: '#1677FF' }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>智能体信息</span>
        </Space>
      }
      style={{ marginBottom: 12 }}
    >
      <Descriptions column={2} size="small" labelStyle={{ width: 100, color: '#595959' }}>
        <Descriptions.Item label="智能体编号">
          <Text code style={{ fontFamily: 'monospace' }}>
            {agent.idCode}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="智能体名称">
          <Tooltip title={agent.name}>{agent.name}</Tooltip>
        </Descriptions.Item>
        <Descriptions.Item label="所属科室">
          {agent.department}（{agent.departmentCode}）
        </Descriptions.Item>
        <Descriptions.Item label="智能体版本">
          <Tag style={{ fontFamily: 'monospace' }}>{agent.version}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="功能描述" span={2}>
          <Paragraph
            ellipsis={{ rows: 3, expandable: true, symbol: '展开/收起' }}
            style={{ marginBottom: 0, fontSize: 13 }}
          >
            {agent.description || '—'}
          </Paragraph>
        </Descriptions.Item>
        {currentLevel && (
          <Descriptions.Item label="当前风险等级" span={2}>
            <Space size={8}>
              <Tag color={RISK_COLOR[currentLevel]}>{currentLevel}</Tag>
              {currentBasis && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {currentBasis.length > 60 ? `${currentBasis.slice(0, 60)}…` : currentBasis}
                </Text>
              )}
            </Space>
          </Descriptions.Item>
        )}
      </Descriptions>
    </Card>
  );

  const renderQuestionnaire = () => (
    <Card
      bordered={false}
      title={
        <Space>
          <SafetyCertificateOutlined style={{ color: '#1677FF' }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>风险分级问卷</span>
        </Space>
      }
      extra={
        <Tag color={answeredCount === 7 ? 'success' : 'blue'}>
          已答 {answeredCount} / 7
        </Tag>
      }
      style={{ marginBottom: 12 }}
    >
      <Form form={form} layout="vertical">
        {QUESTIONS.map((q, qIdx) => (
          <div
            key={q.key}
            style={{
              padding: '12px 0',
              borderBottom: qIdx < QUESTIONS.length - 1 ? '1px dashed #F0F0F0' : 'none',
            }}
          >
            <Text strong style={{ fontSize: 13 }}>
              {q.title}
            </Text>
            <div style={{ marginTop: 8 }}>
              <Form.Item
                name={q.key}
                rules={[{ required: true, message: `请完成第 ${qIdx + 1} 题作答` }]}
                style={{ marginBottom: 0 }}
              >
                <Radio.Group style={{ width: '100%' }}>
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    {q.options.map((o) => (
                      <Radio key={o.value} value={o.value} style={{ alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 13 }}>{o.label}</span>
                      </Radio>
                    ))}
                  </Space>
                </Radio.Group>
              </Form.Item>
            </div>
          </div>
        ))}
      </Form>
    </Card>
  );

  return (
    <div style={{ padding: 16, background: '#F5F5F5', minHeight: 'calc(100vh - 64px)' }}>
      <PageHeader
        title="智能体风险分级"
        subTitle="填写风险分级问卷（7 题 A/B/C 单选）"
        showBack
        onBack={handleBack}
      />

      <div style={{ marginTop: 12 }}>
        {renderAgentInfo()}
        {renderQuestionnaire()}

        {/* 底部操作 */}
        <Card bordered={false}>
          <Flex justify="space-between" align="center" wrap gap={12}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ExclamationCircleOutlined style={{ marginRight: 4, color: '#FA8C16' }} />
              判定规则（优先级：高度关注 ＞ 中度关注 ＞ 一般关注）
            </Text>
            <Space>
              <Button onClick={handleBack}>返回</Button>
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleSubmit}>
                提交
              </Button>
            </Space>
          </Flex>
        </Card>
      </div>
    </div>
  );
};

export default RiskLevelPage;