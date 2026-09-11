import { Button, Card, Space, Steps, Typography } from 'antd';
import { CheckCircleOutlined, PlusOutlined, RocketOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from './PageHeader';

const { Paragraph, Text, Title } = Typography;

interface NewUserConsoleProps {
  kind: 'need' | 'register';
}

const COPY = {
  need: {
    title: '智能体建设需求管理',
    subTitle: '从业务需求出发，快速创建并完善首个智能体建设需求',
    heading: '还没有建设需求',
    description: '描述您希望解决的业务问题，系统将引导您形成标准化建设需求。',
    button: '创建建设需求',
    path: '/app/agent-needs/create',
    steps: ['描述业务场景', '完善需求信息', '提交需求并智能匹配'],
  },
  register: {
    title: '智能体接入中心',
    subTitle: '完成首个智能体注册，让智能体安全、规范地接入平台',
    heading: '还没有接入智能体',
    description: '准备产品或技术资料，系统将引导您完成智能体注册与接入申请。',
    button: '注册接入智能体',
    path: '/app/agent-center/smart-register',
    steps: ['上传或描述智能体资料', '确认注册与技术信息', '提交接入申请'],
  },
} as const;

const NewUserConsole = ({ kind }: NewUserConsoleProps) => {
  const navigate = useNavigate();
  const copy = COPY[kind];

  return (
    <div style={{ padding: 0 }} data-testid={`new-user-${kind}-console`}>
      <PageHeader title={copy.title} subTitle={copy.subTitle} />
      <Card
        style={{ minHeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        styles={{ body: { width: '100%', maxWidth: 760, padding: '56px 48px' } }}
      >
        <Space direction="vertical" align="center" size={20} style={{ width: '100%' }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              display: 'grid',
              placeItems: 'center',
              color: '#1677ff',
              background: 'linear-gradient(135deg, #e6f4ff 0%, #f0f5ff 100%)',
              fontSize: 34,
            }}
          >
            <RocketOutlined />
          </div>
          <div style={{ textAlign: 'center' }}>
            <Title level={3} style={{ margin: '0 0 8px' }}>{copy.heading}</Title>
            <Paragraph type="secondary" style={{ margin: 0, fontSize: 15 }}>
              {copy.description}
            </Paragraph>
          </div>
          <Steps
            responsive={false}
            current={0}
            style={{ width: '100%', margin: '12px 0 4px' }}
            items={copy.steps.map((title, index) => ({
              title,
              icon: index === 0 ? <CheckCircleOutlined /> : undefined,
            }))}
          />
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => navigate(copy.path)}
            style={{ minWidth: 188 }}
          >
            {copy.button}
          </Button>
          <Text type="secondary">创建后，相关记录与进度将在此处展示</Text>
        </Space>
      </Card>
    </div>
  );
};

export default NewUserConsole;
