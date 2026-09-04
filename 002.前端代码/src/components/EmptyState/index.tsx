import { Empty, Button, Typography } from 'antd';
import { InboxOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface EmptyStateProps {
  description?: string;
  actionText?: string;
  onAction?: () => void;
  image?: React.ReactNode;
  style?: React.CSSProperties;
}

const EmptyState = ({
  description = '暂无数据',
  actionText,
  onAction,
  image,
  style,
}: EmptyStateProps) => {
  return (
    <Empty
      image={image || <InboxOutlined style={{ fontSize: 64, color: '#bfbfbf' }} />}
      description={
        <Text type="secondary" style={{ fontSize: 14 }}>
          {description}
        </Text>
      }
      style={{ padding: '48px 0', ...style }}
    >
      {actionText && onAction && (
        <Button type="primary" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </Empty>
  );
};

/**
 * 使用示例：
 * <EmptyState description="暂无智能体数据" actionText="立即接入" onAction={() => navigate('/app/agent-center')} />
 * <EmptyState description="暂无告警记录" />
 * <EmptyState description="暂无评测报告" actionText="去评测" onAction={() => navigate('/app/evaluation')} />
 */

export default EmptyState;
