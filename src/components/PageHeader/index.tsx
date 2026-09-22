import { Breadcrumb, Space, Typography, Button } from 'antd';
import { ArrowLeftOutlined, HomeOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

interface PageHeaderProps {
  title: ReactNode;
  subTitle?: string;
  extra?: ReactNode;
  showBack?: boolean;
  onBack?: () => void;
  breadcrumb?: { path: string; breadcrumbName: string }[];
  style?: React.CSSProperties;
}

const PageHeader = ({
  title,
  subTitle,
  extra,
  showBack = false,
  onBack,
  breadcrumb,
  style,
}: PageHeaderProps) => {
  const navigate = useNavigate();
  const items = breadcrumb
    ?.filter((b) => b.breadcrumbName)
    .map((b, i, arr) => ({
      title:
        i < arr.length - 1 ? (
          <a
            onClick={(e) => {
              e.preventDefault();
              if (b.path) navigate(b.path);
            }}
            href={b.path || '#'}
          >
            {b.breadcrumbName}
          </a>
        ) : (
          <Text type="secondary">{b.breadcrumbName}</Text>
        ),
    }));

  return (
    <div
      className="app-page-header"
      style={{
        background: '#fff',
        borderRadius: 8,
        padding: '20px 24px',
        border: '1px solid #F0F0F0',
        ...style,
      }}
    >
      {items && items.length > 0 && (
        <Breadcrumb
          style={{ marginBottom: 12, fontSize: 12 }}
          separator="/"
          items={[{ title: <HomeOutlined style={{ fontSize: 12 }} /> }, ...items]}
        />
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          minHeight: 36,
        }}
      >
        <Space size={12} align="center" style={{ flex: 1, minWidth: 0 }}>
          {showBack && (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={onBack}
              style={{ marginLeft: -8 }}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <Title
              level={4}
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 600,
                lineHeight: 1.4,
                color: '#1F1F1F',
                letterSpacing: 0.2,
              }}
            >
              {title}
            </Title>
            {subTitle && (
              <Text
                type="secondary"
                style={{ fontSize: 13, marginTop: 2, display: 'block', lineHeight: 1.5 }}
              >
                {subTitle}
              </Text>
            )}
          </div>
        </Space>

        {extra && (
          <Space size={8} wrap style={{ flexShrink: 0 }}>
            {extra}
          </Space>
        )}
      </div>
    </div>
  );
};

/**
 * 使用示例：
 * <PageHeader title="智能体详情" subTitle="心电图智能辅助诊断系统" />
 * <PageHeader title="智能体列表" extra={<Button type="primary">新增</Button>} />
 * <PageHeader title="台账详情" showBack onBack={() => navigate(-1)} />
 * <PageHeader
 *   title="评测报告"
 *   breadcrumb={[{ path: '/app/evaluation', breadcrumbName: '评测管理' }, { path: '', breadcrumbName: '评测报告' }]}
 * />
 */

export default PageHeader;
