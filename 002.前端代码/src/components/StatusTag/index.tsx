import { Tag } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, SyncOutlined, MinusCircleOutlined } from '@ant-design/icons';

export type StatusType = 'lifecycle' | 'run' | 'connection' | 'risk';
export type LifecycleStatus = '已接入' | '评测中' | '试运行中' | '已上线' | '已注销';
export type RunStatus = '在线' | '离线' | '异常';
export type ConnectionStatus = '草稿' | '已提交' | '对接中' | '对接成功' | '对接失败';
export type RiskLevel = '低' | '中' | '高';

interface StatusTagProps {
  status: string;
  type: StatusType;
}

const colorMap: Record<string, string> = {
  已接入: 'blue',
  评测中: 'blue',
  试运行中: 'gold',
  已上线: 'green',
  已注销: 'default',
  在线: 'success',
  离线: 'default',
  异常: 'error',
  草稿: 'default',
  已提交: 'blue',
  对接中: 'processing',
  对接成功: 'success',
  对接失败: 'error',
  低: 'green',
  中: 'gold',
  高: 'red',
};

const StatusTag = ({ status, type }: StatusTagProps) => {
  const color = colorMap[status];

  const icons: Record<string, React.ReactNode> = {
    评测中: <SyncOutlined spin />,
    对接中: <SyncOutlined spin />,
    异常: <ExclamationCircleOutlined />,
    对接失败: <MinusCircleOutlined />,
  };

  return (
    <Tag color={color} icon={icons[status]}>
      {status}
    </Tag>
  );
};

/**
 * 使用示例：
 * <StatusTag status="已上线" type="lifecycle" />
 * <StatusTag status="在线" type="run" />
 * <StatusTag status="对接成功" type="connection" />
 * <StatusTag status="高" type="risk" />
 */

export default StatusTag;
