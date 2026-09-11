import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Button, Space, Tag, Typography, Table, message, theme } from 'antd';
import {
  PlusOutlined, ExperimentOutlined, NodeIndexOutlined,
  PlayCircleOutlined, MedicineBoxOutlined, FireOutlined,
  CameraOutlined, ClusterOutlined, RiseOutlined,
  FileTextOutlined, BarsOutlined, AppstoreOutlined
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { mockScenes, mockFlows, flowStatusColors, type ClinicType } from '../../mock/orchestration';

const { Text, Link } = Typography;

const iconMap: Record<ClinicType, React.ReactNode> = {
  '门诊': <MedicineBoxOutlined />,
  '急诊': <FireOutlined />,
  '住院': <MedicineBoxOutlined />,
  '体检': <ExperimentOutlined />,
  '随访': <FileTextOutlined />,
};

const colorMap: Record<ClinicType, string> = {
  '门诊': 'blue',
  '急诊': 'red',
  '住院': 'green',
  '体检': 'purple',
  '随访': 'orange',
};

const Home = () => {
  const navigate = useNavigate();
  const { token } = theme.useToken();

  const totalScenes = mockScenes.filter(s => s.enabled && s.status === '上线').length;
  const publishedFlows = mockFlows.filter((f) => f.status === '上线' || f.status === '测试中').length;
  const onlineFlows = mockFlows.filter((f) => f.status === '上线').length;
  const todayExecutionCount = mockFlows.reduce((sum, f) => sum + (f.todayExecutionCount || 0), 0);
  const successRate = mockFlows.filter(f => f.successRate !== undefined).length > 0
    ? Math.round(mockFlows.filter(f => f.successRate !== undefined).reduce((sum, f) => sum + (f.successRate || 0), 0) / mockFlows.filter(f => f.successRate !== undefined).length)
    : 0;

  const groupedScenes = mockScenes.reduce((acc, scene) => {
    if (!acc[scene.clinicType]) {
      acc[scene.clinicType] = [];
    }
    acc[scene.clinicType].push(scene);
    return acc;
  }, {} as Record<ClinicType, typeof mockScenes>);

  const clinicTypes: ClinicType[] = ['门诊', '急诊', '住院', '体检', '随访'];

  const recentFlows = [...mockFlows]
    .sort((a, b) => new Date(b.updateTime).getTime() - new Date(a.updateTime).getTime())
    .slice(0, 5);

  const flowColumns = [
    { title: '流程名称', dataIndex: 'name', key: 'name', render: (text: string, record: any) => (
      <Link onClick={() => navigate(`/app/orchestration/flows/${record.id}`)}>{text}</Link>
    )},
    { title: '状态', dataIndex: 'status', key: 'status', render: (val: string) => (
      <Tag color={flowStatusColors[val as keyof typeof flowStatusColors] || 'default'}>{val}</Tag>
    )},
    { title: '版本', dataIndex: 'version', key: 'version', render: (val: string) => <Tag>{val}</Tag> },
    { title: '最近编辑时间', dataIndex: 'updateTime', key: 'updateTime' },
  ];

  return (
    <div style={{ padding: 24, background: token.colorBgLayout }}>
      <PageHeader title="编排中心" subTitle="智能体场景配置与流程编排" />

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6}>
          <StatCard
            title="已上线场景"
            value={totalScenes}
            icon={<ExperimentOutlined />}
            color="blue"
            onClick={() => navigate('/app/orchestration/scenes')}
          />
        </Col>
        <Col xs={24} sm={6}>
          <StatCard
            title="已发布流程"
            value={publishedFlows}
            icon={<NodeIndexOutlined />}
            color="green"
            onClick={() => navigate('/app/orchestration/flows')}
          />
        </Col>
        <Col xs={24} sm={6}>
          <StatCard
            title="今日流程执行数"
            value={todayExecutionCount}
            icon={<ClusterOutlined />}
            color="purple"
            suffix="次"
          />
        </Col>
        <Col xs={24} sm={6}>
          <StatCard
            title="平均成功率"
            value={successRate}
            icon={<RiseOutlined />}
            color="cyan"
            suffix="%"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* 左侧区域 - 场景列表 */}
        <Col xs={24} lg={16}>
          <Card
            title="场景列表"
            styles={{ body: { padding: 12 } }}
            extra={
              <Button type="primary" onClick={() => navigate('/app/orchestration/scenes')}>
                查看全部
              </Button>
            }
          >
            <Row gutter={[16, 16]}>
              {clinicTypes.map((clinicType) => {
                const scenes = groupedScenes[clinicType] || [];
                const onlineScenes = scenes.filter(s => s.enabled && s.status === '上线');
                return (
                  <Col xs={24} sm={12} key={clinicType}>
                    <Card
                      size="small"
                      styles={{ body: { padding: 8 } }}
                      title={
                        <Space size="small">
                          <Tag color={colorMap[clinicType]}>{iconMap[clinicType]}</Tag>
                          <Text strong>{clinicType}</Text>
                          <Tag color="blue">{onlineScenes.length} 个上线</Tag>
                        </Space>
                      }
                    >
                      {scenes.length === 0 ? (
                        <Text type="secondary">暂无场景</Text>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {scenes.slice(0, 3).map((scene) => (
                            <div
                              key={scene.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '6px 8px',
                                background: token.colorBgContainerDisabled,
                                borderRadius: 6,
                                cursor: 'pointer',
                              }}
                              onClick={() => navigate('/app/orchestration/scenes')}
                            >
                              <Space>
                                <Text>{scene.name}</Text>
                                <Tag color={sceneStatusColors[scene.status] || 'default'}>
                                  {scene.status}
                                </Tag>
                              </Space>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {scene.stages?.join(', ') || scene.stages}
                              </Text>
                            </div>
                          ))}
                          {scenes.length > 3 && (
                            <Text type="secondary" style={{ textAlign: 'center', fontSize: 12 }}>
                              还有 {scenes.length - 3} 个场景...
                            </Text>
                          )}
                        </div>
                      )}
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </Card>
        </Col>

        {/* 右侧区域 - 快捷入口 */}
        <Col xs={24} lg={8}>
          <Card title="快捷入口" styles={{ body: { padding: 12 } }}>
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Button type="dashed" block icon={<PlusOutlined />} onClick={() => navigate('/app/orchestration/flows')}>
                新建流程
              </Button>
              <Button type="dashed" block icon={<BarsOutlined />} onClick={() => navigate('/app/orchestration/scenes')}>
                新建场景
              </Button>
              <Button type="dashed" block icon={<AppstoreOutlined />} onClick={() => message.info('模板库功能开发中')}>
                模板库
              </Button>
              <Button type="dashed" block icon={<NodeIndexOutlined />} onClick={() => navigate('/app/orchestration/flows')}>
                流程管理
              </Button>
            </Space>
          </Card>

          <Card title="使用说明" style={{ marginTop: 16 }} styles={{ body: { padding: 12 } }}>
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Text type="secondary" style={{ fontSize: 12 }}>
                1. 在「流程管理」中创建和编辑编排流程
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                2. 在「场景配置」中绑定智能体或编排流程
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                3. 发布后可在工作台中触发执行
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                4. 在监控中心查看执行记录和性能指标
              </Text>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 最近编辑的流程 */}
      <Card title="最近编辑的流程" style={{ marginTop: 16 }} styles={{ body: { padding: 24 } }}>
        <Table
          dataSource={recentFlows}
          columns={flowColumns}
          rowKey="id"
          pagination={false}
          style={{ cursor: 'pointer' }}
          onRow={(record) => ({
            onClick: () => navigate(`/app/orchestration/flows/${record.id}`),
          })}
        />
      </Card>
    </div>
  );
};

const sceneStatusColors: Record<string, string> = {
  '草稿': 'default',
  '测试中': 'processing',
  '上线': 'success',
  '下线': 'error',
  '已归档': 'default',
};

export default Home;