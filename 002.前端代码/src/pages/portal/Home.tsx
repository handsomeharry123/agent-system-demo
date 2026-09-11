import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Row, Col, Card, Typography, Space } from 'antd';
import {
  RobotOutlined,
  FileTextOutlined,
  SafetyOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';

// Fallback for useCountUp since it may not be available in all ahooks versions
const useCountUpFallback = (end: number, duration: number = 2000) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const startTime = Date.now();
    const updateCount = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        requestAnimationFrame(updateCount);
      }
    };
    requestAnimationFrame(updateCount);
  }, [end, duration]);
  return { count };
};

const { Title, Text, Paragraph } = Typography;

import { Layout } from 'antd';
const { Content } = Layout;

const capabilities = [
  {
    icon: <RobotOutlined />,
    title: '智能辅助诊断',
    desc: '基于深度学习的医学影像分析和临床决策支持，提升诊断效率和准确率',
    color: '#1677FF',
  },
  {
    icon: <FileTextOutlined />,
    title: '病历自动生成',
    desc: '智能识别医嘱和检查结果，自动生成规范化病历文档，减轻医护文书负担',
    color: '#52C41A',
  },
  {
    icon: <SafetyOutlined />,
    title: '用药审核',
    desc: '实时处方审核，智能识别药物相互作用、剂量异常等用药风险，保障用药安全',
    color: '#FA8C16',
  },
  {
    icon: <AuditOutlined />,
    title: '影像智能分析',
    desc: 'CT、MRI、X光等医学影像 AI 辅助分析，自动标注病灶区域，提供量化指标',
    color: '#722ED1',
  },
];

const steps = [
  { num: '01', title: '注册账号', desc: '完成平台账号注册' },
  { num: '02', title: '接口对接', desc: '按照 API 文档完成接入' },
  { num: '03', title: '评测准入', desc: '通过平台评测考核' },
  { num: '04', title: '上线运行', desc: '正式接入平台运营' },
];

const CountUpNumber = ({ value, suffix = '' }: { value: number; suffix?: string }) => {
  const { count } = useCountUpFallback(value, 2000);

  return (
    <span>
      {count.toLocaleString()}{suffix}
    </span>
  );
};

const Home = () => {
  const navigate = useNavigate();

  return (
    <div style={{ background: '#F5F5F5' }}>
      {/* Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #001529 0%, #1677FF 100%)',
          padding: '100px 48px 120px',
          textAlign: 'center',
          color: '#fff',
        }}
      >
        <Title level={1} style={{ color: '#fff', fontSize: 48, marginBottom: 16 }}>
          医疗智能体管理平台
        </Title>
        <Paragraph
          style={{
            color: 'rgba(255,255,255,0.85)',
            fontSize: 20,
            marginBottom: 40,
            maxWidth: 600,
            margin: '0 auto 40px',
          }}
        >
          汇聚优质 AI 医疗智能体，提供安全、可靠、高效的智能医疗服务
        </Paragraph>
        <Space size={16}>
          <Button
            type="primary"
            size="large"
            ghost
            onClick={() => navigate('/register')}
            style={{ borderColor: '#fff', color: '#fff' }}
          >
            立即注册
          </Button>
          <Button
            size="large"
            onClick={() => navigate('/agents')}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff' }}
          >
            了解更多
          </Button>
        </Space>
      </div>

      {/* Capabilities */}
      <div style={{ padding: '80px 48px', background: '#fff' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Title level={2} style={{ fontSize: 32, marginBottom: 8 }}>核心能力</Title>
          <Text type="secondary">全方位智能医疗服务解决方案</Text>
        </div>
        <Row gutter={[24, 24]}>
          {capabilities.map((cap, idx) => (
            <Col xs={24} sm={12} lg={6} key={idx}>
              <Card
                hoverable
                style={{ height: '100%', borderRadius: 8 }}
                styles={{ body: { padding: 32 } }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 8,
                    background: `${cap.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 20,
                    fontSize: 28,
                    color: cap.color,
                  }}
                >
                  {cap.icon}
                </div>
                <Title level={4} style={{ marginBottom: 8 }}>{cap.title}</Title>
                <Text type="secondary">{cap.desc}</Text>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* Stats */}
      <div style={{ padding: '80px 48px', background: '#F5F5F5' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Title level={2} style={{ fontSize: 32, marginBottom: 8 }}>平台数据</Title>
          <Text type="secondary">持续增长的服务规模</Text>
        </div>
        <Row gutter={[48, 32]} justify="center">
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 56, fontWeight: 600, color: '#1677FF' }}>
                <CountUpNumber value={128} />
              </div>
              <Text type="secondary" style={{ fontSize: 16 }}>已接入智能体</Text>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 56, fontWeight: 600, color: '#52C41A' }}>
                <CountUpNumber value={560} suffix="万+" />
              </div>
              <Text type="secondary" style={{ fontSize: 16 }}>累计调用次数</Text>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 56, fontWeight: 600, color: '#FA8C16' }}>
                <CountUpNumber value={32} />
              </div>
              <Text type="secondary" style={{ fontSize: 16 }}>覆盖科室</Text>
            </div>
          </Col>
        </Row>
      </div>

      {/* Process */}
      <div style={{ padding: '80px 48px', background: '#fff' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Title level={2} style={{ fontSize: 32, marginBottom: 8 }}>接入流程</Title>
          <Text type="secondary">简单四步，快速接入平台</Text>
        </div>
        <Row gutter={[24, 24]} justify="center">
          {steps.map((step, idx) => (
            <Col xs={24} sm={12} lg={6} key={idx}>
              <Card
                style={{
                  height: '100%',
                  borderRadius: 8,
                  textAlign: 'center',
                  position: 'relative',
                }}
                styles={{ body: { padding: 32 } }}
              >
                {idx < steps.length - 1 && (
                  <ArrowRightOutlined
                    style={{
                      position: 'absolute',
                      right: -12,
                      top: '50%',
                      color: '#d9d9d9',
                      fontSize: 16,
                      zIndex: 1,
                    }}
                  />
                )}
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: '#1677FF',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    fontSize: 18,
                    fontWeight: 600,
                  }}
                >
                  {step.num}
                </div>
                <Title level={4} style={{ marginBottom: 4 }}>{step.title}</Title>
                <Text type="secondary">{step.desc}</Text>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* Footer CTA */}
      <div
        style={{
          padding: '80px 48px',
          background: 'linear-gradient(135deg, #1677FF 0%, #001529 100%)',
          textAlign: 'center',
          color: '#fff',
        }}
      >
        <Title level={2} style={{ color: '#fff', marginBottom: 16 }}>
          立即开始使用
        </Title>
        <Paragraph
          style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, marginBottom: 32 }}
        >
          汇聚优质 AI 医疗智能体，提升医疗服务质量和效率
        </Paragraph>
        <Space size={16}>
          <Button
            type="primary"
            size="large"
            onClick={() => navigate('/register')}
            style={{ background: '#fff', borderColor: '#fff', color: '#1677FF' }}
          >
            立即注册
          </Button>
          <Button
            size="large"
            ghost
            onClick={() => navigate('/login')}
            style={{ borderColor: '#fff', color: '#fff' }}
          >
            登录平台
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default Home;
