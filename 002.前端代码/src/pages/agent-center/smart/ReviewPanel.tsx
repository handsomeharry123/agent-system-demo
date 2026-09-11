/**
 * §3.2 填写内容智能审查面板
 *
 *  - 顶部审查状态条:「X 个错误 / X 个警告」
 *  - 问题清单卡：按错误/警告/提示分组
 *    每条支持「采纳建议 / 忽略本条 / 授权自动修正 / 回退」
 *  - 自动滚动定位:点击问题项 scrollToField 高亮对应字段
 *
 * 依赖 store: reviewProblems / reviewSummary / ignoreProblem / confirmProblem /
 *            applyAutoFix / rollbackAutoFix
 *
 * 父组件（Registration.tsx）需提供 form（用于滚动）和 onLocateField（用于触发滚动）
 */
import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Empty,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  BugOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  RollbackOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { FormInstance } from 'antd';
import { useSmartDraft } from './store';
import type { ReviewProblem, ReviewSeverity } from './types';

const { Text } = Typography;

const SEVERITY_META: Record<
  ReviewSeverity,
  { color: string; bg: string; icon: React.ReactNode; label: string }
> = {
  error: {
    color: '#FF4D4F',
    bg: '#FFF1F0',
    icon: <BugOutlined />,
    label: '错误',
  },
  warning: {
    color: '#FAAD14',
    bg: '#FFFBE6',
    icon: <WarningOutlined />,
    label: '警告',
  },
  info: {
    color: '#1677FF',
    bg: '#E6F4FF',
    icon: <InfoCircleOutlined />,
    label: '提示',
  },
};

interface Props {
  /** 用于滚动定位到具体字段 */
  form?: FormInstance;
  /** 触发滚动定位的钩子（由父组件持有 form 引用与提示闪烁逻辑） */
  onLocateField?: (fieldKey: string) => void;
  /** 清空当前审查结果的回调（用于主动 re-review 前重置） */
  onClear?: () => void;
  /** 触发主动审查 */
  onRequestReview?: () => void;
}

const ReviewPanel: React.FC<Props> = ({ onLocateField, onRequestReview }) => {
  const {
    reviewProblems,
    reviewSummary,
    ignoreProblem,
    confirmProblem,
    applyAutoFix,
    rollbackAutoFix,
  } = useSmartDraft();

  const [showIgnored, setShowIgnored] = useState(false);

  const { openProblems, historyProblems } = useMemo(() => {
    const open: ReviewProblem[] = [];
    const hist: ReviewProblem[] = [];
    reviewProblems.forEach((p) => {
      if (p.status === 'open') open.push(p);
      else hist.push(p);
    });
    // 错误 > 警告 > 提示 排序
    const order = (s: ReviewSeverity) => (s === 'error' ? 0 : s === 'warning' ? 1 : 2);
    open.sort((a, b) => order(a.severity) - order(b.severity));
    return { openProblems: open, historyProblems: hist };
  }, [reviewProblems]);

  const pass = reviewProblems.length > 0 && reviewSummary.totalOpen === 0;

  return (
    <div data-testid="review-panel">
      {/* 顶部状态条 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          marginBottom: 12,
          background: pass
            ? 'linear-gradient(90deg, #F6FFED 0%, #FFFFFF 100%)'
            : reviewSummary.errors > 0
              ? 'linear-gradient(90deg, #FFF1F0 0%, #FFFFFF 100%)'
              : 'linear-gradient(90deg, #FFFBE6 0%, #FFFFFF 100%)',
          border: `1px solid ${pass ? '#B7EB8F' : reviewSummary.errors > 0 ? '#FFA39E' : '#FFE58F'}`,
          borderRadius: 6,
        }}
      >
        <Space size={16}>
          {pass ? (
            <>
              <CheckCircleOutlined style={{ color: '#52C41A', fontSize: 18 }} />
              <Text strong style={{ color: '#389E0D' }}>
                ✓ 审查通过
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                共 {historyProblems.length} 项已处理
              </Text>
            </>
          ) : (
            <>
              <ExclamationCircleOutlined
                style={{
                  color: reviewSummary.errors > 0 ? '#FF4D4F' : '#FAAD14',
                  fontSize: 18,
                }}
              />
              <Space size={6} wrap>
                <Badge count={reviewSummary.errors} showZero color="#FF4D4F">
                  <span style={{ paddingLeft: reviewSummary.errors > 0 ? 16 : 0 }}>错误</span>
                </Badge>
                <Badge count={reviewSummary.warnings} showZero color="#FAAD14">
                  <span style={{ paddingLeft: reviewSummary.warnings > 0 ? 16 : 0 }}>警告</span>
                </Badge>
                {reviewSummary.infos > 0 && (
                  <Tag color="blue">提示 {reviewSummary.infos}</Tag>
                )}
              </Space>
            </>
          )}
        </Space>
        <Space size={6}>
          {onRequestReview && (
            <Button
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={onRequestReview}
              type="primary"
              ghost
            >
              帮我检查一下
            </Button>
          )}
          {historyProblems.length > 0 && (
            <Button
              size="small"
              type="text"
              onClick={() => setShowIgnored((v) => !v)}
            >
              {showIgnored ? '收起已处理' : `已处理 ${historyProblems.length}`}
            </Button>
          )}
        </Space>
      </div>

      {/* 问题清单 */}
      {openProblems.length === 0 && historyProblems.length === 0 && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Space direction="vertical" size={4}>
              <Text type="secondary">尚未触发审查</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                在对话窗口输入「帮我检查一下」或点击上方按钮发起实时审查
              </Text>
            </Space>
          }
          style={{ padding: '24px 0' }}
        />
      )}

      {openProblems.length > 0 && (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {openProblems.map((p) => {
            const meta = SEVERITY_META[p.severity];
            return (
              <div
                key={p.id}
                style={{
                  border: `1px solid ${meta.color}40`,
                  background: meta.bg,
                  borderRadius: 6,
                  padding: '10px 12px',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ color: meta.color, fontSize: 16, marginTop: 2 }}>
                  {meta.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Space size={6} wrap>
                    <Tag color={meta.color === '#FF4D4F' ? 'red' : meta.color === '#FAAD14' ? 'gold' : 'blue'}>
                      {meta.label}
                    </Tag>
                    <Text strong style={{ fontSize: 13 }}>
                      {p.title}
                    </Text>
                    {p.fieldKey && (
                      <Tag style={{ fontSize: 11 }}>{p.fieldKey}</Tag>
                    )}
                  </Space>
                  <div style={{ marginTop: 4, fontSize: 12, color: '#1F1F1F' }}>
                    <span style={{ color: '#666' }}>原因：</span>
                    {p.reason}
                  </div>
                  <div style={{ marginTop: 2, fontSize: 12, color: '#666' }}>
                    <span style={{ color: '#666' }}>影响：</span>
                    {p.impact}
                  </div>
                  {p.suggestion && (
                    <Alert
                      type="info"
                      showIcon={false}
                      message={
                        <span>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            建议值：
                          </Text>
                          <Text code style={{ fontSize: 12 }}>
                            {p.suggestion}
                          </Text>
                        </span>
                      }
                      style={{ marginTop: 6, padding: '4px 10px', background: '#FFFFFF' }}
                    />
                  )}
                  <Space size={6} wrap style={{ marginTop: 8 }}>
                    {p.fieldKey && onLocateField && (
                      <Button
                        size="small"
                        onClick={() => onLocateField(p.fieldKey!)}
                      >
                        定位到字段
                      </Button>
                    )}
                    {p.suggestion && (
                      <Button
                        size="small"
                        type="primary"
                        ghost
                        onClick={() => {
                          // 一键采纳：把建议值作为 pendingPrefill
                          if (p.fieldKey) {
                            onLocateField?.(p.fieldKey);
                          }
                        }}
                      >
                        采纳建议
                      </Button>
                    )}
                    {p.autoFixable && p.autoFixValue && p.fieldKey && (
                      <Tooltip title="授权后由平台自动修改并标注「已自动修正」，可点击回退恢复原值">
                        <Button
                          size="small"
                          type="primary"
                          icon={<ThunderboltOutlined />}
                          onClick={() => applyAutoFix(p.id)}
                        >
                          授权自动修正
                        </Button>
                      </Tooltip>
                    )}
                    <Button
                      size="small"
                      onClick={() => ignoreProblem(p.id)}
                    >
                      忽略本条
                    </Button>
                    {p.severity !== 'error' && (
                      <Button
                        size="small"
                        type="text"
                        onClick={() => confirmProblem(p.id)}
                      >
                        标记已确认
                      </Button>
                    )}
                  </Space>
                </div>
              </div>
            );
          })}
        </Space>
      )}

      {/* 已处理：fixed / ignored / confirmed */}
      {showIgnored && historyProblems.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ── 已处理（{historyProblems.length}）──
          </Text>
          <Space direction="vertical" size={6} style={{ width: '100%', marginTop: 8 }}>
            {historyProblems.map((p) => {
              const meta = SEVERITY_META[p.severity];
              return (
                <div
                  key={p.id}
                  style={{
                    border: '1px solid #F0F0F0',
                    background: '#FAFAFA',
                    borderRadius: 4,
                    padding: '6px 10px',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    opacity: 0.85,
                  }}
                >
                  <span style={{ color: '#999' }}>{meta.icon}</span>
                  <Text type="secondary" style={{ flex: 1 }}>
                    {p.title}
                  </Text>
                  <Tag color={
                    p.status === 'fixed' ? 'green' :
                    p.status === 'ignored' ? 'default' : 'blue'
                  } style={{ fontSize: 10, margin: 0 }}>
                    {p.status === 'fixed' ? '已自动修正' :
                     p.status === 'ignored' ? '已忽略' : '已确认'}
                  </Tag>
                  {p.status === 'fixed' && (
                    <Button
                      size="small"
                      type="text"
                      icon={<RollbackOutlined />}
                      onClick={() => rollbackAutoFix(p.id)}
                    >
                      回退
                    </Button>
                  )}
                </div>
              );
            })}
          </Space>
        </div>
      )}
    </div>
  );
};

export default ReviewPanel;
