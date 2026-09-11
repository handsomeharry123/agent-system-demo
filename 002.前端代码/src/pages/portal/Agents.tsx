import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Input, Select, Typography, Tag, Space, Empty, Button } from 'antd';
import {
  SearchOutlined,
  RobotOutlined,
  MedicineBoxOutlined,
  TeamOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { mockAgents } from '../../mock';
import { departmentOptions } from '../../mock/departments';
import type { AgentType } from '../../types/agent';

const { Title, Text, Paragraph } = Typography;

const { Search } = Input;

const agentTypeOptions: { label: string; value: AgentType }[] = [
  { label: '辅助诊断', value: '辅助诊断' },
  { label: '影像分析', value: '影像分析' },
  { label: '病历生成', value: '病历生成' },
  { label: '用药审核', value: '用药审核' },
  { label: '导诊分诊', value: '导诊分诊' },
  { label: '智能问诊', value: '智能问诊' },
  { label: '随访管理', value: '随访管理' },
  { label: '健康评估', value: '健康评估' },
];

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

const Agents = () => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<AgentType[]>([]);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);

  const onlineAgents = useMemo(() => {
    return mockAgents.filter((agent) => agent.lifecycleStatus === '已上线');
  }, []);

  const filteredAgents = useMemo(() => {
    return onlineAgents.filter((agent) => {
      const matchSearch =
        !searchText ||
        agent.name.toLowerCase().includes(searchText.toLowerCase()) ||
        agent.description.toLowerCase().includes(searchText.toLowerCase());

      const matchType = selectedTypes.length === 0 || selectedTypes.includes(agent.type);

      const matchDept = selectedDepts.length === 0 || selectedDepts.includes(agent.department);

      return matchSearch && matchType && matchDept;
    });
  }, [searchText, selectedTypes, selectedDepts, onlineAgents]);

  const renderAgentIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      辅助诊断: <RobotOutlined style={{ fontSize: 32, color: '#1677FF' }} />,
      影像分析: <MedicineBoxOutlined style={{ fontSize: 32, color: '#722ED1' }} />,
      病历生成: <TeamOutlined style={{ fontSize: 32, color: '#13C2C2' }} />,
    };
    return icons[type] || <RobotOutlined style={{ fontSize: 32, color: '#1677FF' }} />;
  };

  return (
    <div style={{ padding: '24px 48px', background: '#F5F5F5', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 8 }}>智能体展示</Title>
        <Text type="secondary">
          共找到 <Text strong>{filteredAgents.length}</Text> 个已上线智能体
        </Text>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 24 }} styles={{ body: { padding: 16 } }}>
        <Space wrap size={[8, 16]}>
          <Text strong>筛选条件：</Text>
          <Space size={4}>
            <Text type="secondary">智能体类型：</Text>
            <Select
              mode="multiple"
              placeholder="选择类型"
              style={{ minWidth: 180 }}
              options={agentTypeOptions}
              value={selectedTypes}
              onChange={setSelectedTypes}
              maxTagCount="responsive"
              allowClear
            />
          </Space>
          <Space size={4}>
            <Text type="secondary">适用科室：</Text>
            <Select
              mode="multiple"
              placeholder="选择科室"
              style={{ minWidth: 180 }}
              options={departmentOptions}
              value={selectedDepts}
              onChange={setSelectedDepts}
              maxTagCount="responsive"
              allowClear
            />
          </Space>
          {(searchText || selectedTypes.length > 0 || selectedDepts.length > 0) && (
            <Button
              type="link"
              onClick={() => {
                setSearchText('');
                setSelectedTypes([]);
                setSelectedDepts([]);
              }}
            >
              清空筛选
            </Button>
          )}
        </Space>
      </Card>

      {/* Agent Grid */}
      {filteredAgents.length > 0 ? (
        <Row gutter={[24, 24]}>
          {filteredAgents.map((agent) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={agent.id}>
              <Card
                hoverable
                onClick={() => navigate(`/agents/${agent.id}`)}
                style={{ height: '100%', borderRadius: 8 }}
                styles={{ body: { padding: 20 } }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 8,
                      background: '#F5F5F5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {renderAgentIcon(agent.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      strong
                      style={{
                        display: 'block',
                        marginBottom: 4,
                        fontSize: 16,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {agent.name}
                    </Text>
                    <Space size={4} style={{ marginBottom: 8 }}>
                      <Tag color={typeColors[agent.type] || 'default'} style={{ margin: 0 }}>
                        {agent.type}
                      </Tag>
                      <Tag style={{ margin: 0 }}>{agent.department}</Tag>
                    </Space>
                    <Paragraph
                      type="secondary"
                      ellipsis={{ rows: 2 }}
                      style={{ margin: 0, fontSize: 13 }}
                    >
                      {agent.description}
                    </Paragraph>
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 16,
                    paddingTop: 12,
                    borderTop: '1px solid #f0f0f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Space size={4}>
                    <Tag color={agent.runStatus === '在线' ? 'success' : 'default'}>
                      {agent.runStatus || '离线'}
                    </Tag>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {agent.supplier}
                  </Text>
                </div>
                <div
                  style={{
                    position: 'absolute',
                    right: 16,
                    bottom: 16,
                    opacity: 0,
                    transition: 'opacity 0.2s',
                  }}
                  className="card-arrow"
                >
                  <RightOutlined style={{ color: '#1677FF' }} />
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Empty
          description={
            <Text type="secondary">
              未找到符合条件的智能体，请调整筛选条件
            </Text>
          }
          style={{ padding: '80px 0' }}
        >
          <Button onClick={() => {
            setSearchText('');
            setSelectedTypes([]);
            setSelectedDepts([]);
          }}>
            清空筛选
          </Button>
        </Empty>
      )}

      <style>{`
        .ant-card:hover .card-arrow {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
};

export default Agents;
