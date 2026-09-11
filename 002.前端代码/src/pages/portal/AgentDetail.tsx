import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Typography, Button, Space, Divider, Row, Col, message } from 'antd';
import {
  ArrowLeftOutlined,
  BankOutlined,
  CalendarOutlined,
  RocketOutlined,
  ApiOutlined,
  SafetyOutlined,
  MedicineBoxOutlined,
} from '@ant-design/icons';
import { mockAgents } from '../../mock';
import { useAuth } from '../../hooks/useAuth';
import StatusTag from '../../components/StatusTag';

const { Title, Text, Paragraph } = Typography;

const typeColors: Record<string, string> = {
  辅助诊断: 'blue',
  影像分析: 'purple',
  病历生成: 'cyan',
  用药审核: 'orange',
  导诊分诊: 'green',
  智能问诊: 'magenta',
  随访管理: 'gold',
  健康评估: 'volcano',
};

const scenarios = [
  '门诊智能分诊',
  '住院患者管理',
  '急诊快速评估',
  '术后康复监测',
  '慢病管理随访',
  '健康体检初筛',
];

const AgentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const agent = mockAgents.find((a) => a.id === id);

  if (!agent) {
    return (
      <div style={{ padding: 100, textAlign: 'center' }}>
        <Title level={4}>智能体不存在</Title>
        <Button type="primary" onClick={() => navigate('/agents')}>
          返回智能体列表
        </Button>
      </div>
    );
  }

  const handleUse = () => {
    if (!isAuthenticated) {
      message.info('请先登录后再使用');
      navigate('/login');
    } else {
      message.success(`已跳转到 ${agent.name} 控制台`);
      navigate('/app/home');
    }
  };

  return (
    <div style={{ padding: '24px 48px', background: '#F5F5F5', minHeight: '100vh' }}>
      {/* Back Button */}
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/agents')}
        style={{ marginBottom: 16 }}
      >
        返回智能体列表
      </Button>

      {/* Basic Info */}
      <Card style={{ marginBottom: 24 }} styles={{ body: { padding: 24 } }}>
        <Row gutter={[24, 24]} align="middle">
          <Col flex="none">
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #1677FF 0%, #001529 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 32,
              }}
            >
              AI
            </div>
          </Col>
          <Col flex="auto">
            <Space align="center" style={{ marginBottom: 8 }}>
              <Title level={3} style={{ margin: 0 }}>{agent.name}</Title>
              <Tag color={typeColors[agent.type] || 'default'}>{agent.type}</Tag>
              <StatusTag status={agent.lifecycleStatus} type="lifecycle" />
              {agent.runStatus && <StatusTag status={agent.runStatus} type="run" />}
            </Space>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              {agent.description}
            </Paragraph>
          </Col>
        </Row>

        <Divider style={{ margin: '24px 0' }} />

        <Descriptions column={{ xs: 1, sm: 2, md: 3 }}>
          <Descriptions.Item label={<Space><BankOutlined /> 适用科室</Space>}>
            {agent.department}
          </Descriptions.Item>
          <Descriptions.Item label={<Space><MedicineBoxOutlined /> 供应商</Space>}>
            {agent.supplier}
          </Descriptions.Item>
          <Descriptions.Item label={<Space><CalendarOutlined /> 上线时间</Space>}>
            {agent.updatedAt.split(' ')[0]}
          </Descriptions.Item>
          <Descriptions.Item label={<Space><ApiOutlined /> 部署方式</Space>}>
            {agent.deployMode}
          </Descriptions.Item>
          <Descriptions.Item label={<Space><SafetyOutlined /> 认证方式</Space>}>
            {agent.authType}
          </Descriptions.Item>
          <Descriptions.Item label={<Space><RocketOutlined /> 版本</Space>}>
            {agent.version}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Capability */}
      <Card title="能力说明" style={{ marginBottom: 24 }} styles={{ body: { padding: 24 } }}>
        <Paragraph style={{ fontSize: 15, lineHeight: 1.8 }}>
          {agent.name}是由{agent.supplier}研发的智能医疗辅助系统，基于{
            agent.modelSource
          }模型构建，采用{agent.techArch}架构。该系统通过{agent.apiProtocol}协议对外提供服务，
          API地址为 <Text code>{agent.apiEndpoint}</Text>。
        </Paragraph>
        <Paragraph style={{ fontSize: 15, lineHeight: 1.8 }}>
          系统具备以下核心能力：
        </Paragraph>
        <ul style={{ fontSize: 15, lineHeight: 2 }}>
          <li>高精度疾病辅助诊断，降低漏诊误诊率</li>
          <li>自动化医学文档生成，提升医护工作效率</li>
          <li>实时用药安全审核，保障患者用药安全</li>
          <li>智能影像分析诊断，辅助医生快速定位病灶</li>
        </ul>
      </Card>

      {/* Scenarios */}
      <Card title="适用场景" style={{ marginBottom: 24 }} styles={{ body: { padding: 24 } }}>
        <Space wrap size={[8, 8]}>
          {scenarios.map((scenario) => (
            <Tag key={scenario} style={{ padding: '4px 12px', fontSize: 14 }}>
              {scenario}
            </Tag>
          ))}
        </Space>
      </Card>

      {/* Departments */}
      <Card title="已接入科室" style={{ marginBottom: 24 }} styles={{ body: { padding: 24 } }}>
        <Space wrap size={[8, 8]}>
          {['心内科', '呼吸科', '消化科', '神经内科', '肾内科', '内分泌科', '血液科', '风湿免疫科'].map((dept) => (
            <Tag key={dept} color="blue" style={{ padding: '4px 12px', fontSize: 14 }}>
              {dept}
            </Tag>
          ))}
        </Space>
      </Card>

      {/* CTA */}
      <Card
        styles={{
          body: {
            padding: 32,
            textAlign: 'center',
            background: 'linear-gradient(135deg, #1677FF 0%, #001529 100%)',
            borderRadius: 8,
          },
        }}
      >
        <Title level={4} style={{ color: '#fff', marginBottom: 8 }}>
          立即开始使用 {agent.name}
        </Title>
        <Text style={{ color: 'rgba(255,255,255,0.85)', display: 'block', marginBottom: 24 }}>
          登录平台后即可调用该智能体 API，体验完整功能
        </Text>
        <Button
          type="primary"
          size="large"
          onClick={handleUse}
          style={{ background: '#fff', borderColor: '#fff', color: '#1677FF' }}
        >
          {isAuthenticated ? '进入控制台' : '登录后使用'}
        </Button>
      </Card>
    </div>
  );
};

export default AgentDetail;
