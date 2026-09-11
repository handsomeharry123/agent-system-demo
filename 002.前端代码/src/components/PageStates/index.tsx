/**
 * 页面通用状态组件（V1.7 §页面通用状态规范）
 *
 * 提供监控中心 6 个页面统一使用的 4 类状态：
 *   - PermissionDenied：非 IT 管理员访问时显示「无权限」
 *   - LoadingSkeleton：首屏加载骨架屏
 *   - ErrorRetry：接口失败时显示「重试」
 *   - PageEmpty：空数据提示（已存在 EmptyState，复用）
 *
 * 引入方式：
 *   import { PermissionDenied, LoadingSkeleton, ErrorRetry } from '../../components/PageStates';
 */

import { Result, Button, Skeleton, Typography, Space } from 'antd';
import { LockOutlined, ReloadOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Text, Paragraph } = Typography;

interface PermissionDeniedProps {
  /** 自定义提示文案（默认「您当前的角色无权访问统一运行监控中心」） */
  message?: string;
  /** 是否显示「返回首页」按钮，默认 true */
  showBackHome?: boolean;
}

/** 权限态：非 IT 管理员访问监控中心时呈现 */
export const PermissionDenied: React.FC<PermissionDeniedProps> = ({
  message = '您当前的角色无权访问统一运行监控中心',
  showBackHome = true,
}) => {
  const navigate = useNavigate();
  return (
    <Result
      icon={<LockOutlined style={{ color: '#8C8C8C' }} />}
      title="无访问权限"
      subTitle={
        <Space direction="vertical" size={4}>
          <Text type="secondary">{message}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            本模块仅面向医院信息科 IT 管理员。如需访问，请联系信息科开通权限。
          </Text>
        </Space>
      }
      extra={
        showBackHome && (
          <Button type="primary" onClick={() => navigate('/')}>
            返回首页
          </Button>
        )
      }
      style={{ padding: '80px 0' }}
    />
  );
};

interface LoadingSkeletonProps {
  /** 卡片行数（默认 3） */
  rows?: number;
  /** 是否同时加载 KPI 区骨架（默认 true） */
  withKpi?: boolean;
}

/** 加载态：首屏加载骨架屏（骨架色 #F0F2F5） */
export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ rows = 3, withKpi = true }) => {
  return (
    <div style={{ padding: 24, background: '#F5F5F5', minHeight: '100vh' }}>
      {withKpi && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: '#fff',
                borderRadius: 8,
                padding: 16,
                height: 88,
              }}
            >
              <Skeleton.Input active size="small" style={{ width: 80 }} />
              <Skeleton.Input
                active
                size="large"
                style={{ width: 120, marginTop: 12 }}
                block
              />
            </div>
          ))}
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            background: '#fff',
            borderRadius: 8,
            padding: 24,
            marginBottom: 16,
          }}
        >
          <Skeleton active paragraph={{ rows: 4 }} />
        </div>
      ))}
    </div>
  );
};

interface ErrorRetryProps {
  /** 错误提示文案（默认「数据加载失败」） */
  message?: string;
  /** 详细说明（可选） */
  description?: string;
  /** traceId（可选，>5s 才显示） */
  traceId?: string;
  /** 重试回调 */
  onRetry?: () => void;
  /** 是否正在重试中 */
  loading?: boolean;
}

/** 错误态：5xx / 网络错误时显示「重试」 */
export const ErrorRetry: React.FC<ErrorRetryProps> = ({
  message = '数据加载失败',
  description = '接口返回异常或网络中断，请稍后重试。',
  traceId,
  onRetry,
  loading = false,
}) => {
  return (
    <Result
      icon={<ExclamationCircleOutlined style={{ color: '#FF4D4F' }} />}
      title={message}
      subTitle={
        <Space direction="vertical" size={4}>
          <Text type="secondary">{description}</Text>
          {traceId && (
            <Paragraph
              type="secondary"
              style={{ fontSize: 12, marginTop: 8 }}
              copyable={{ text: traceId }}
            >
              traceId: {traceId}
            </Paragraph>
          )}
        </Space>
      }
      extra={
        onRetry && (
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={onRetry}
            loading={loading}
          >
            重试
          </Button>
        )
      }
      style={{ padding: '80px 0' }}
    />
  );
};

// 重新导出 EmptyState 便于一行导入
export { default as PageEmpty } from '../EmptyState';
