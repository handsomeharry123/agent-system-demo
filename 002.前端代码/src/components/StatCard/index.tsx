import { Card, Statistic, Typography, Space, theme } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';

const { Text } = Typography;

interface StatCardProps {
  title: string;
  value: number | string;
  prefix?: ReactNode;
  suffix?: string;
  trend?: number;
  precision?: number;
  onClick?: () => void;
  loading?: boolean;
  icon?: ReactNode;
  color?: string;
  /** 紧凑模式：标题与数值同行 + 数值与说明同行，整体高度压到 2 行 */
  compact?: boolean;
}

const colorMap: Record<string, { main: string; tint: string }> = {
  blue: { main: '#1677FF', tint: '#E6F4FF' },
  green: { main: '#52C41A', tint: '#F6FFED' },
  red: { main: '#FF4D4F', tint: '#FFF1F0' },
  orange: { main: '#FA8C16', tint: '#FFF7E6' },
  purple: { main: '#722ED1', tint: '#F9F0FF' },
  gold: { main: '#FAAD14', tint: '#FFFBE6' },
  cyan: { main: '#13C2C2', tint: '#E6FFFB' },
  magenta: { main: '#EB2F96', tint: '#FFF0F6' },
};

const StatCard = ({
  title,
  value,
  prefix,
  suffix,
  trend,
  precision = 0,
  onClick,
  loading = false,
  icon,
  color,
  compact = false,
}: StatCardProps) => {
  const { token } = theme.useToken();
  const palette = color ? colorMap[color] : null;
  const valueColor = palette ? palette.main : token.colorTextHeading;
  const iconBg = palette ? palette.tint : '#F5F5F5';
  const iconColor = palette ? palette.main : token.colorPrimary;

  const renderTrend = () => {
    if (trend === undefined || trend === 0) return null;
    const isUp = trend > 0;
    return (
      <Text style={{ fontSize: 12, color: isUp ? token.colorSuccess : token.colorError }}>
        {isUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
        {Math.abs(trend)}%
      </Text>
    );
  };

  // 紧凑模式：标题与数值上下两行，高度压到 ~88px
  if (compact) {
    return (
      <Card
        bordered={false}
        hoverable={!!onClick}
        onClick={onClick}
        loading={loading}
        style={{
          height: '100%',
          overflow: 'hidden',
          border: '1px solid #F0F0F0',
        }}
        bodyStyle={{ padding: '14px 18px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.4 }} ellipsis>
            {title}
          </Text>
          {icon && (
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                background: iconBg,
                color: iconColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              {icon}
            </div>
          )}
        </div>
        <div style={{ marginTop: 6 }}>
          <Statistic
            value={value}
            prefix={prefix}
            suffix={suffix}
            precision={precision}
            valueStyle={{
              fontSize: 24,
              fontWeight: 600,
              color: valueColor,
              lineHeight: 1.2,
              letterSpacing: -0.5,
            }}
          />
        </div>
        <div style={{ marginTop: 4, minHeight: 16 }}>
          <Space size={4} align="center">
            <Text type="secondary" style={{ fontSize: 12 }}>
              较昨日
            </Text>
            {renderTrend() || (
              <Text type="secondary" style={{ fontSize: 12 }}>
                —
              </Text>
            )}
          </Space>
        </div>
      </Card>
    );
  }

  return (
    <Card
      bordered={false}
      hoverable={!!onClick}
      onClick={onClick}
      loading={loading}
      style={{
        height: '100%',
        overflow: 'hidden',
        border: '1px solid #F0F0F0',
      }}
      bodyStyle={{ padding: '20px 22px' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* ① 顶部：标题 + 右上图标徽章 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.5 }}>
            {title}
          </Text>
          {icon && (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: iconBg,
                color: iconColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              {icon}
            </div>
          )}
        </div>

        {/* ② 主数值 */}
        <div style={{ marginTop: 12 }}>
          <Statistic
            value={value}
            prefix={prefix}
            suffix={suffix}
            precision={precision}
            valueStyle={{
              fontSize: 28,
              fontWeight: 600,
              color: valueColor,
              lineHeight: 1.2,
              letterSpacing: -0.5,
            }}
          />
        </div>

        {/* ③ 辅助说明 */}
        <div style={{ marginTop: 10, minHeight: 18 }}>
          <Space size={4} align="center">
            <Text type="secondary" style={{ fontSize: 12 }}>
              较昨日
            </Text>
            {renderTrend() || (
              <Text type="secondary" style={{ fontSize: 12 }}>
                —
              </Text>
            )}
          </Space>
        </div>
      </div>
    </Card>
  );
};

/**
 * 使用示例：
 * <StatCard title="在线智能体" value={128} icon={<RobotOutlined />} color="blue" />
 * <StatCard title="今日调用量" value={15680} suffix="次" trend={-5} />
 * <StatCard title="异常告警" value={3} icon={<AlertOutlined />} color="red" />
 */

export default StatCard;
