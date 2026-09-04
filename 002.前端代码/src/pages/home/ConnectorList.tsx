/**
 * 首页 V1.x · 连接器列表页
 *
 * PRD §2.3.1《连接器卡片列表页》落地版 —— 8 张连接器卡片
 *
 * 卡片采用横向布局:
 *   - 左侧:Logo 方块
 *   - 中间:名称(已连接绿点 / 异常红点) + 连接器描述
 *   - 右侧:未连接「+」/ 已连接或异常「>」
 *
 * 顶部 extra(演示态切换):全部已连接 / 全部未连接 / 全部异常 / 重置初始
 *
 * 交互:点击卡片 / 主操作 → 弹出 Modal 展示详情(PRD §2.3.2),不走下钻路由
 */

import { useEffect, useState } from 'react';
import {
  ApiOutlined,
  ArrowRightOutlined,
  DingtalkOutlined,
  MailOutlined,
  MessageOutlined,
  PlusOutlined,
  WechatOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Modal,
  Row,
  Segmented,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import PageHeader from '../../components/PageHeader';
import ConnectorDetail from './ConnectorDetail';
import {
  getConnectors,
  resetConnectors,
  setConnectorsBulk,
  type ConnectorState,
  type ConnectorStatus,
} from '../../mock/connectors';

const { Text } = Typography;

/* icon 名 → antd icon 节点(运行时查找,避免 8 条 import 占位) */
const ICON_MAP: Record<string, React.ReactNode> = {
  WechatOutlined: <WechatOutlined />,
  DingtalkOutlined: <DingtalkOutlined />,
  MailOutlined: <MailOutlined />,
  MessageOutlined: <MessageOutlined />,
  WechatWorkOutlined: <ApiOutlined />,
  LarkOutlined: <ApiOutlined />,
  QqOutlined: <ApiOutlined />,
};

const ConnectorList = ({ embedded = false }: { embedded?: boolean } = {}) => {
  const [connectors, setConnectors] = useState<ConnectorState[]>(() => getConnectors());
  /* 触发 mock 模块 setter 后的列表重读 */
  const [tick, setTick] = useState(0);
  /* 详情弹窗:被点开的连接器 key,null 表示未打开 */
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    setConnectors(getConnectors());
  }, [tick]);

  const handleBulk = (val: string) => {
    if (val === 'all-connected') {
      setConnectorsBulk('connected');
    } else if (val === 'all-unused') {
      setConnectorsBulk('unused');
    } else if (val === 'all-error') {
      setConnectorsBulk('error');
    } else if (val === 'reset') {
      resetConnectors();
    }
    setTick((t) => t + 1);
  };

  const active = activeKey ? connectors.find((c) => c.key === activeKey) : undefined;

  /* 弹窗内状态变更后,同步本地列表(列表卡上状态点/Tag 即时刷新) */
  const handleChanged = (next: ConnectorState) => {
    setConnectors((prev) => prev.map((c) => (c.key === next.key ? next : c)));
  };

  const renderStatusDot = (status: ConnectorStatus) => {
    if (status === 'connected') {
      return (
        <span
          aria-label="已连接"
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#52C41A',
            boxShadow: '0 0 0 2px rgba(82,196,26,0.18)',
          }}
        />
      );
    }
    if (status === 'error') {
      return (
        <span
          aria-label="异常"
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#FF4D4F',
            boxShadow: '0 0 0 2px rgba(255,77,79,0.18)',
          }}
        />
      );
    }
    return null;
  };

  return (
    <div style={{ padding: embedded ? '0 12px 16px' : '0 4px' }}>
      <PageHeader
        style={embedded ? { padding: '14px 18px' } : undefined}
        title={
          <Space size={embedded ? 8 : 10}>
            <ApiOutlined style={{ color: '#1677FF' }} />
            <span>连接器</span>
          </Space>
        }
        subTitle={embedded ? undefined : '按 PRD §3 落地的 8 个内置连接器,支持查看状态、连接 / 解绑 / 重新授权'}
        extra={
          embedded ? undefined : (
            <Space size={12}>
              <Segmented
                size="small"
                defaultValue="reset"
                onChange={(v) => handleBulk(v as string)}
                options={[
                  { label: '全部已连接', value: 'all-connected' },
                  { label: '全部未连接', value: 'all-unused' },
                  { label: '全部异常', value: 'all-error' },
                  { label: '重置初始', value: 'reset' },
                ]}
                data-testid="connector-demo-state-segments"
              />
            </Space>
          )
        }
      />

      <Row gutter={embedded ? [12, 12] : [16, 16]} style={{ marginTop: embedded ? 8 : 12 }}>
        {connectors.map((c) => {
          /* 操作按钮参考图2:未使用 → 「+」;已使用 → 「>」箭头 */
          const mainIcon =
            c.status === 'unused' ? <PlusOutlined /> : <ArrowRightOutlined />;
          const mainTip = c.status === 'unused' ? '连接' : '管理';
          return (
            <Col key={c.key} xs={24} sm={12} md={12} lg={12} xl={12}>
              <Card
                hoverable
                onClick={() => setActiveKey(c.key)}
                data-testid={`connector-card-${c.key}`}
                styles={{
                  body: {
                    minHeight: embedded ? 98 : 126,
                    padding: embedded ? '14px 18px' : '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: embedded ? 14 : 18,
                  },
                }}
              >
                {/* 左侧 Logo */}
                <div
                  style={{
                    width: embedded ? 44 : 52,
                    height: embedded ? 44 : 52,
                    borderRadius: embedded ? 10 : 12,
                    background: c.brandColor,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: embedded ? 21 : 25,
                    flexShrink: 0,
                  }}
                >
                  {ICON_MAP[c.iconName] ?? <ApiOutlined />}
                </div>

                {/* 中间:名称、状态点与描述 */}
                <div
                  style={{
                    minWidth: 0,
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: embedded ? 6 : 7,
                    }}
                  >
                    <Text strong style={{ fontSize: embedded ? 15 : 17, lineHeight: '22px', color: '#1F2937' }}>
                      {c.name}
                    </Text>
                    {renderStatusDot(c.status)}
                  </div>
                  <Text
                    type="secondary"
                    ellipsis={{ tooltip: c.description }}
                    style={{
                      display: 'block',
                      fontSize: embedded ? 13 : 14,
                      lineHeight: embedded ? '20px' : '22px',
                    }}
                  >
                    {c.description}
                  </Text>
                </div>

                {/* 右侧操作:未连接为 +，已连接/异常进入详情 */}
                <Tooltip title={mainTip}>
                  <Button
                    type="default"
                    shape="circle"
                    icon={mainIcon}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveKey(c.key);
                    }}
                    data-testid={`connector-card-action-${c.key}`}
                    style={{
                      width: embedded ? 36 : 44,
                      height: embedded ? 36 : 44,
                      flexShrink: 0,
                      color: '#4B5563',
                      borderColor: '#D9D9D9',
                      fontSize: embedded ? 15 : 17,
                      boxShadow: 'none',
                    }}
                  />
                </Tooltip>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* 详情弹窗(PRD §2.3.2):不走下钻路由 */}
      <Modal
        open={!!active}
        onCancel={() => setActiveKey(null)}
        footer={null}
        width={520}
        destroyOnHidden
        data-testid="connector-detail-modal"
        title={null}
        styles={{ body: { padding: '20px 24px 24px' } }}
      >
        {active && <ConnectorDetail connector={active} onChanged={handleChanged} />}
      </Modal>
    </div>
  );
};

export default ConnectorList;
