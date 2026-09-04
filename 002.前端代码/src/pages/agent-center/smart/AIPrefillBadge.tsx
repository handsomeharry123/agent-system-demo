/**
 * §3.1.2 AI 预填标识 + 置信度悬浮气泡
 *
 * 3 档置信度 (与 types.confidenceLevel 对齐)：
 *   - high   (>= 0.9)   绿色 ✨AI 预填, 待用户确认
 *   - medium (>= 0.7)   绿色 ✨AI 预填, 建议复核
 *   - low    (<  0.7)   绿色 ✨AI 预填 · 请确认, 强制复核
 *
 * 悬浮气泡显示三要素：来源 / 置信度 / 采纳按钮
 *
 * 用户点击「采纳本字段」→ store.acknowledgePrefill, 5s 内显示「✓ 已采纳」绿色对勾, 之后消失
 * 用户在 file-detect / image-detect / link-detect 气泡勾选字段后点击「确认采纳 (N)」 →
 *   同样 5s 内显示「✓ 已采纳」绿色对勾, 之后消失
 * 注: 已取消「高置信度自动采纳」, 即便 confidence >= 0.9 也需用户显式勾选才能确认
 * 用户手动修改字段 → store.clearPrefill, 高亮消失
 */
import { Button, Space, Tag, Tooltip, Typography } from 'antd';
import {
  CheckCircleFilled,
  CheckOutlined,
  ThunderboltFilled,
} from '@ant-design/icons';
import { confidenceLevel, type AIPrefillMeta } from './types';

const { Text } = Typography;

interface Props {
  meta?: AIPrefillMeta;
  /** 是否有「自动修正」前后对比 */
  onAcknowledge?: () => void;
  /** 自定义 Tooltip 标题 (默认展示 来源 + 置信度 + 采纳按钮) */
  tipTitle?: React.ReactNode;
}

const ACK_VISIBLE_MS = 5000; // 采纳后绿色对勾持续显示时长

const AIPrefillBadge = ({ meta, onAcknowledge, tipTitle }: Props) => {
  if (!meta) return null;

  // 已采纳但在 5s 显示窗内 → 显示「✓ 已采纳」绿色对勾 (无 tooltip)
  if (meta.acknowledged && meta.acknowledgedAt) {
    const age = Date.now() - meta.acknowledgedAt;
    if (age < ACK_VISIBLE_MS) {
      return (
        <span
          key="ack-badge"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: '#F6FFED',
            border: '1px solid #B7EB8F',
            color: '#52C41A',
            borderRadius: 4,
            padding: '0 6px',
            marginLeft: 6,
            fontSize: 11,
            lineHeight: '18px',
            verticalAlign: 'middle',
            animation: 'aiPrefillAckFadeIn 250ms ease-out',
          }}
        >
          <CheckCircleFilled style={{ marginRight: 3, fontSize: 11 }} />
          已采纳
        </span>
      );
    }
    return null;
  }

  // 未采纳：按置信度展示 ✨AI 预填 标识
  const lvl = confidenceLevel(meta.confidence);
  // 3 档置信度统一绿色系，和表单预填高亮保持一致。
  const colorMap = {
    high: { color: 'green' as const, iconColor: '#389E0D' },
    medium: { color: 'green' as const, iconColor: '#389E0D' },
    low: { color: 'green' as const, iconColor: '#389E0D' },
  } as const;
  const c = colorMap[lvl];

  const inner = (
    <Tag
      color={c.color}
      icon={<ThunderboltFilled />}
      style={{
        margin: 0,
        fontSize: 11,
        lineHeight: '18px',
        padding: '0 6px',
        borderRadius: 4,
      }}
    >
      AI 预填
      {lvl === 'low' && ' · 请确认'}
    </Tag>
  );

  const defaultTip = (
    <div style={{ fontSize: 12, maxWidth: 240 }}>
      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        <div>
          <Text type="secondary">来源：</Text>
          <Text>{meta.source}</Text>
        </div>
        <div>
          <Text type="secondary">置信度：</Text>
          <Text strong style={{ color: c.iconColor }}>
            {(meta.confidence * 100).toFixed(0)}%
          </Text>
          <Tag
            style={{ marginLeft: 6 }}
            color="green"
          >
            {lvl === 'high' ? '可直接采纳' : lvl === 'medium' ? '建议复核' : '需强制确认'}
          </Tag>
        </div>
        {meta.beforeValue && meta.afterValue && (
          <div
            style={{
              background: 'rgba(255,255,255,0.1)',
              padding: 6,
              borderRadius: 4,
              border: '1px dashed rgba(255,255,255,0.3)',
            }}
          >
            <Text type="secondary" delete>
              {meta.beforeValue || '（空）'}
            </Text>
            <span style={{ margin: '0 6px' }}>→</span>
            <Text strong style={{ color: '#52C41A' }}>
              {meta.afterValue}
            </Text>
            {meta.fixReason && (
              <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>
                理由：{meta.fixReason}
              </div>
            )}
          </div>
        )}
        {onAcknowledge && (
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            block
            onClick={() => onAcknowledge()}
          >
            采纳本字段
          </Button>
        )}
      </Space>
    </div>
  );

  // 单一容器:不再叠外层 span 的背景/边框(避免与 Tag 自带样式形成"重影"双框)
  return (
    <Tooltip
      title={tipTitle ?? defaultTip}
      color="rgba(31,31,31,0.92)"
      placement="top"
      styles={{ body: { borderRadius: 8 } }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          cursor: 'help',
          marginLeft: 6,
          verticalAlign: 'middle',
        }}
      >
        {inner}
      </span>
    </Tooltip>
  );
};

export default AIPrefillBadge;
