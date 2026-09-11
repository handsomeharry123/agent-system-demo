/**
 * 首页 V1.x · 连接器详情弹窗内容
 *
 * PRD §3.2《连接器详情页》落地版（弹窗形式,非下钻页面）
 *
 * 设计要点:
 *   - 由 ConnectorList 用 Modal 包裹展示,自身只渲染弹窗内部内容
 *   - 字段严格对齐 PRD:连接器名称(含状态圆点) / 连接器说明(含支持能力) / 操作按钮
 *   - 三种状态对应不同操作:未连接 → 连接;已连接 → 解绑 + 去试试;异常 → 重新授权 + 禁用
 *   - 「去试试」通过 navigate state 把 activeConnector 带回首屏,首屏 useEffect 注入输入框
 *   - 与列表页共享 mock/connectors 模块状态(setConnectorStatus);状态变更后 onChanged 回调刷新列表
 */

import {
  ApiOutlined,
  DingtalkOutlined,
  LinkOutlined,
  MailOutlined,
  MessageOutlined,
  ReloadOutlined,
  SendOutlined,
  StopOutlined,
  WechatOutlined,
} from '@ant-design/icons';
import { Button, Space, Tag, Typography } from 'antd';
import {
  setConnectorStatus,
  type ConnectorState,
} from '../../mock/connectors';

const { Text, Title } = Typography;

const ICON_MAP: Record<string, React.ReactNode> = {
  WechatOutlined: <WechatOutlined />,
  DingtalkOutlined: <DingtalkOutlined />,
  MailOutlined: <MailOutlined />,
  MessageOutlined: <MessageOutlined />,
  WechatWorkOutlined: <ApiOutlined />,
  LarkOutlined: <ApiOutlined />,
  QqOutlined: <ApiOutlined />,
};

const STATUS_LABEL = {
  unused: '未连接',
  connected: '已连接',
  error: '异常',
} as const;

interface ConnectorDetailProps {
  connector: ConnectorState;
  onChanged?: (next: ConnectorState) => void;
}

const ConnectorDetail = ({ connector, onChanged }: ConnectorDetailProps) => {
  const apply = (next: ConnectorState) => {
    onChanged?.(next);
  };

  const handleConnect = () => {
    setConnectorStatus(connector.key, 'connected');
    apply({ ...connector, status: 'connected' });
  };

  const handleUnbind = () => {
    setConnectorStatus(connector.key, 'unused');
    apply({ ...connector, status: 'unused', connectedAt: undefined, errorMessage: undefined });
  };

  const handleReauth = () => {
    setConnectorStatus(connector.key, 'connected');
    apply({ ...connector, status: 'connected' });
  };

  const handleDisable = () => {
    setConnectorStatus(connector.key, 'unused');
    apply({ ...connector, status: 'unused', connectedAt: undefined, errorMessage: undefined });
  };

  /* 状态点(与列表页同构) */
  const renderStatusDot = () => {
    if (connector.status === 'connected') {
      return (
        <span
          aria-label="已连接"
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#52C41A',
            marginRight: 6,
            boxShadow: '0 0 0 2px rgba(82,196,26,0.18)',
          }}
        />
      );
    }
    if (connector.status === 'error') {
      return (
        <span
          aria-label="异常"
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#FF4D4F',
            marginRight: 6,
            boxShadow: '0 0 0 2px rgba(255,77,79,0.18)',
          }}
        />
      );
    }
    return null;
  };

  return (
    <div data-testid={`connector-detail-${connector.key}`}>
      {/* 顶部 Logo + 名称 + 状态 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          paddingBottom: 16,
          borderBottom: '1px solid #F0F0F0',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            background: connector.brandColor,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            flexShrink: 0,
          }}
        >
          {ICON_MAP[connector.iconName] ?? <ApiOutlined />}
        </div>
        <div style={{ flex: 1 }}>
          <Space size={8} align="center">
            {renderStatusDot()}
            <Title level={4} style={{ margin: 0 }}>
              {connector.name}
            </Title>
            <Tag
              color={
                connector.status === 'connected'
                  ? 'success'
                  : connector.status === 'error'
                    ? 'error'
                    : 'default'
              }
            >
              {STATUS_LABEL[connector.status]}
            </Tag>
          </Space>
        </div>
      </div>

      {/* 连接器说明(按用户要求只展示描述字段,不再展示标签) */}
      <div style={{ marginTop: 20 }} data-testid="connector-detail-desc">
        <Text style={{ fontSize: 13, display: 'block', color: '#4B5563', lineHeight: 1.7 }}>
          {connector.description}
        </Text>
      </div>

      {/* 操作按钮(PRD 不要求 label,直接展示按钮) */}
      <Space wrap style={{ marginTop: 24 }}>
        {connector.status === 'unused' && (
          <Button
            type="primary"
            icon={<LinkOutlined />}
            onClick={handleConnect}
            data-testid="connector-detail-connect"
          >
            连接
          </Button>
        )}
        {connector.status === 'connected' && (
          <>
            <Button
              danger
              icon={<StopOutlined />}
              onClick={handleUnbind}
              data-testid="connector-detail-unbind"
            >
              解绑
            </Button>
            <Button
              type="primary"
              icon={<SendOutlined />}
              data-testid="connector-detail-try"
            >
              去试试
            </Button>
          </>
        )}
        {connector.status === 'error' && (
          <>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={handleReauth}
              data-testid="connector-detail-reauth"
            >
              重新授权
            </Button>
            <Button
              icon={<StopOutlined />}
              onClick={handleDisable}
              data-testid="connector-detail-disable"
            >
              禁用
            </Button>
          </>
        )}
      </Space>
    </div>
  );
};

export default ConnectorDetail;