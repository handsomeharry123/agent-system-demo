import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatDrawer from '../../components/ChatDrawer';
import {
  Card,
  Row,
  Col,
  Typography,
  Tag,
  Space,
  Segmented,
  Empty,
  message,
  Input,
  Button,
} from 'antd';
import {
  MedicineBoxOutlined,
  SafetyOutlined,
  CameraOutlined,
  FileTextOutlined,
  SearchOutlined,
  HistoryOutlined,
  StarFilled,
  FireOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';

const { Text } = Typography;

// 最近使用场景数据
const recentlyUsedScenes = [
  { id: 1, name: '门诊智能分诊', agent: '智能导诊系统', icon: <MedicineBoxOutlined />, color: '#1677FF', description: '根据主诉智能分诊至对应科室' },
  { id: 2, name: '处方审核', agent: '用药安全系统', icon: <SafetyOutlined />, color: '#52C41A', description: '实时审核处方用药安全' },
  { id: 3, name: '病历生成', agent: '病历智能生成', icon: <FileTextOutlined />, color: '#FA8C16', description: '自动生成门诊病历文档' },
  { id: 4, name: '影像分析', agent: 'CT影像分析', icon: <CameraOutlined />, color: '#722ED1', description: '胸部CT智能影像分析' },
  { id: 5, name: '急诊分诊', agent: '智能导诊系统', icon: <FireOutlined />, color: '#FF4D4F', description: '急诊患者快速分诊评估' },
  { id: 6, name: '用药监控', agent: '用药安全系统', icon: <SafetyOutlined />, color: '#52C41A', description: '住院用药全程监控审核' },
];

// 我的收藏场景数据
const favoriteScenes = [
  { id: 101, name: '门诊病历', agent: '病历智能生成系统', icon: <FileTextOutlined />, color: '#1677FF', description: '自动生成门诊病历文档' },
  { id: 102, name: 'CT分析', agent: 'CT影像分析平台', icon: <CameraOutlined />, color: '#722ED1', description: '胸部CT智能影像分析' },
];

// 诊疗场景数据
const clinicalScenes = [
  { id: 1, name: '门诊分诊', type: '门诊', stage: '分诊', agent: '智能导诊系统', icon: <MedicineBoxOutlined />, color: '#1677FF', description: '根据主诉智能分诊至对应科室' },
  { id: 2, name: '门诊病历', type: '门诊', stage: '病历', agent: '病历智能生成系统', icon: <FileTextOutlined />, color: '#1677FF', description: '自动生成门诊病历文档' },
  { id: 3, name: '处方审核', type: '门诊', stage: '处方', agent: '用药安全系统', icon: <SafetyOutlined />, color: '#1677FF', description: '实时审核处方用药安全' },
  { id: 4, name: '急诊分诊', type: '急诊', stage: '分诊', agent: '智能导诊系统', icon: <FireOutlined />, color: '#FF4D4F', description: '急诊患者快速分诊评估' },
  { id: 5, name: '急诊检查', type: '急诊', stage: '检查', agent: 'CT影像分析平台', icon: <CameraOutlined />, color: '#FF4D4F', description: '快速影像检查与诊断' },
  { id: 6, name: '住院评估', type: '住院', stage: '评估', agent: '心电诊断系统', icon: <MedicineBoxOutlined />, color: '#52C41A', description: '入院综合评估与风险识别' },
  { id: 7, name: '用药监控', type: '住院', stage: '用药', agent: '用药安全系统', icon: <SafetyOutlined />, color: '#52C41A', description: '住院用药全程监控审核' },
  { id: 8, name: 'CT分析', type: '影像检查', stage: '分析', agent: 'CT影像分析平台', icon: <CameraOutlined />, color: '#722ED1', description: '胸部CT智能影像分析' },
  { id: 9, name: '报告生成', type: '影像检查', stage: '报告', agent: '病历智能生成系统', icon: <FileTextOutlined />, color: '#722ED1', description: '影像报告自动生成' },
];

// 科室管理员运行概况数据
const deptStats = {
  todayCalls: 256,
  onlineAgents: 3,
  abnormalAgents: 0,
  pendingItems: 2,
};

// 按就诊类型动态展示阶段标签
const stageOptionsByClinicType: Record<string, string[]> = {
  '门诊': ['全部', '分诊', '病历', '处方'],
  '急诊': ['全部', '分诊', '检查'],
  '住院': ['全部', '评估', '用药'],
  '影像检查': ['全部', '分析', '报告'],
};

// 功能分类标签
const functionalTags = ['全部', '辅助诊断', '影像分析', '病历生成', '用药审核', '导诊分诊'];

const Workbench = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [activeClinicType, setActiveClinicType] = useState('门诊');
  const [selectedStage, setSelectedStage] = useState('全部');
  const [sceneSearch, setSceneSearch] = useState('');
  const [filterType, setFilterType] = useState<'clinic' | 'functional'>('clinic');
  const [selectedFunctionalTag, setSelectedFunctionalTag] = useState('全部');

  // Chat Drawer state
  const [chatOpen, setChatOpen] = useState(false);
  const [currentScene, setCurrentScene] = useState({ name: '', agentName: '', isOrchestration: false });
  const [flowNodes, setFlowNodes] = useState<any[]>([]);

  // 根据真实用户角色判断（V1.1：多角色 — 任一命中即 true）
  const isItAdmin = currentUser?.roles.includes('信息科管理员') ?? false;

  const handleClinicTypeChange = (type: string) => {
    setActiveClinicType(type);
    setSelectedStage('全部');
  };

  const handleSceneClick = (scene: any) => {
    const isOrchestrationScenario = ['报告生成', '门诊分诊'].includes(scene.name);

    if (isOrchestrationScenario) {
      setCurrentScene({
        name: `${scene.name} - 编排流程`,
        agentName: '',
        isOrchestration: true,
      });
      setFlowNodes([
        { id: 'node-1', name: '信息采集', agentName: '智能导诊系统', status: 'completed', result: '已采集患者基本信息' },
        { id: 'node-2', name: '症状分析', agentName: '智能诊断系统', status: 'running' },
        { id: 'node-3', name: '检查建议', agentName: '检验知识库', status: 'pending' },
        { id: 'node-4', name: '人工审核', agentName: '医生', status: 'pending', isReview: true },
        { id: 'node-5', name: '报告生成', agentName: '病历生成系统', status: 'pending' },
      ]);
    } else {
      setCurrentScene({
        name: scene.name,
        agentName: scene.agent,
        isOrchestration: false,
      });
      setFlowNodes([]);
    }
    setChatOpen(true);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    message.success('已取消收藏');
  };

  const filteredScenes = useMemo(() => {
    return clinicalScenes.filter((scene) => {
      const matchType = scene.type === activeClinicType;
      const matchStage = selectedStage === '全部' || scene.stage === selectedStage;
      const matchSearch = sceneSearch === '' ||
        scene.name.includes(sceneSearch) ||
        scene.agent.includes(sceneSearch) ||
        scene.description.includes(sceneSearch);

      let matchFunctional = true;
      if (filterType === 'functional' && selectedFunctionalTag !== '全部') {
        matchFunctional =
          selectedFunctionalTag === '辅助诊断' && scene.type === '门诊' && scene.stage === '分诊' ||
          selectedFunctionalTag === '影像分析' && scene.type === '影像检查' ||
          selectedFunctionalTag === '病历生成' && (scene.name.includes('病历') || scene.name.includes('报告')) ||
          selectedFunctionalTag === '用药审核' && (scene.name.includes('用药') || scene.name.includes('处方')) ||
          selectedFunctionalTag === '导诊分诊' && scene.name.includes('分诊');
      }

      return matchType && matchStage && matchSearch && matchFunctional;
    });
  }, [activeClinicType, selectedStage, sceneSearch, filterType, selectedFunctionalTag]);

  const renderSceneCard = (scene: any, showFavorite = true) => (
    <Card
      hoverable
      onClick={() => handleSceneClick(scene)}
      style={{ borderLeft: `3px solid ${scene.color}`, cursor: 'pointer' }}
      styles={{ body: { padding: 16 } }}
      actions={showFavorite ? [
        <StarFilled key="star" style={{ color: '#FFD700' }} onClick={handleFavoriteClick} />
      ] : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: `${scene.color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            color: scene.color,
          }}
        >
          {scene.icon}
        </div>
        <div style={{ flex: 1 }}>
          <Text strong>{scene.name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{scene.description}</Text>
          <br />
          <Tag color="cyan" style={{ marginTop: 4 }}>{scene.agent}</Tag>
        </div>
      </div>
    </Card>
  );

  return (
    <div style={{ padding: 16, background: '#F5F5F5' }}>
      <PageHeader
        title="工作台"
        subTitle={`欢迎回来，${currentUser?.name || '用户'}`}
      />

      <Row gutter={[16, 16]}>
        {/* ========== 模块 B2: 信息科管理员轻量提示条（仅信息科管理员可见） ========== */}
        {/* 规范：高度约48px，背景浅蓝色，固定在最近使用区域上方 */}
        {isItAdmin && (
          <Col span={24}>
            <div
              style={{
                height: 48,
                background: '#E6F7FF',
                border: '1px solid #91D5FF',
                borderRadius: 8,
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <Space wrap>
                <Text strong style={{ color: '#1890FF' }}>全院运行概况：</Text>
                <Tag color="green">今日调用量 {deptStats.todayCalls} 次</Tag>
                <Tag color="blue">在线智能体 {deptStats.onlineAgents} 个</Tag>
                {deptStats.abnormalAgents > 0 && <Tag color="red">异常 {deptStats.abnormalAgents} 个</Tag>}
                <Text type="secondary" style={{ marginLeft: 8 }}>|</Text>
                <Text type="secondary">待处理事项：</Text>
                <Button type="link" size="small" onClick={() => navigate('/app/home')}>
                  {deptStats.pendingItems} 条优化建议待查看
                </Button>
                <Text type="secondary" style={{ marginLeft: 8 }}>|</Text>
                <Button type="link" size="small" onClick={() => navigate('/app/monitoring')}>
                  查看详情
                </Button>
              </Space>
            </div>
          </Col>
        )}

        {/* ========== 模块 B + B3: 最近使用与收藏 + 对话历史入口（全部角色可见） ========== */}
        <Col span={24}>
          <Row gutter={[16, 16]}>
            {/* 最近使用 */}
            <Col xs={24} lg={12}>
              <Card
                bordered={false}
                title={
                  <Space>
                    <Text strong>最近使用</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>最多显示6个</Text>
                  </Space>
                }
                extra={
                  <Button type="link" size="small" onClick={() => message.info('对话历史页面开发中')}>
                    <HistoryOutlined /> 查看全部对话历史
                  </Button>
                }
                styles={{ body: { padding: 16 } }}
              >
                {recentlyUsedScenes.length > 0 ? (
                  <Row gutter={[12, 12]}>
                    {recentlyUsedScenes.slice(0, 6).map((scene) => (
                      <Col xs={12} sm={8} lg={8} key={scene.id}>
                        <Card
                          hoverable
                          onClick={() => handleSceneClick(scene)}
                          style={{ textAlign: 'center', cursor: 'pointer', borderLeft: `3px solid ${scene.color}` }}
                          styles={{ body: { padding: 16 } }}
                        >
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 8,
                              background: `${scene.color}15`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              margin: '0 auto 8px',
                              fontSize: 20,
                              color: scene.color,
                            }}
                          >
                            {scene.icon}
                          </div>
                          <Text strong style={{ fontSize: 13 }}>{scene.name}</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 11 }}>{scene.agent}</Text>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <Empty description="暂无使用记录，请从下方场景入口开始" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>

            {/* 我的收藏 */}
            <Col xs={24} lg={12}>
              <Card
                bordered={false}
                title={
                  <Space>
                    <Text strong>我的收藏</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{favoriteScenes.length}个场景</Text>
                  </Space>
                }
                styles={{ body: { padding: 16 } }}
              >
                {favoriteScenes.length > 0 ? (
                  <Row gutter={[12, 12]}>
                    {favoriteScenes.map((scene) => (
                      <Col xs={12} sm={8} lg={8} key={scene.id}>
                        <Card
                          hoverable
                          onClick={() => handleSceneClick(scene)}
                          style={{ textAlign: 'center', cursor: 'pointer', borderLeft: `3px solid ${scene.color}` }}
                          styles={{ body: { padding: 16 } }}
                          actions={[
                            <StarFilled key="star" style={{ color: '#FFD700' }} onClick={handleFavoriteClick} />,
                          ]}
                        >
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 8,
                              background: `${scene.color}15`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              margin: '0 auto 8px',
                              fontSize: 20,
                              color: scene.color,
                            }}
                          >
                            {scene.icon}
                          </div>
                          <Text strong style={{ fontSize: 13 }}>{scene.name}</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 11 }}>{scene.agent}</Text>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <Empty description="暂无收藏场景" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>
          </Row>
        </Col>

        {/* ========== 模块 C: 诊疗场景入口（全部角色可见） ========== */}
        <Col span={24}>
          <Card
            bordered={false}
            title={
              <Space>
                <Text strong>诊疗场景入口</Text>
                <Input
                  prefix={<SearchOutlined />}
                  placeholder="搜索场景名称、智能体名称"
                  value={sceneSearch}
                  onChange={(e) => setSceneSearch(e.target.value)}
                  style={{ width: 240, marginLeft: 16 }}
                  allowClear
                />
              </Space>
            }
            extra={
              <Space direction="vertical" align="end">
                <Segmented
                  value={filterType}
                  onChange={(val) => setFilterType(val as 'clinic' | 'functional')}
                  options={[
                    { label: '按就诊流程', value: 'clinic' },
                    { label: '按功能类型', value: 'functional' },
                  ]}
                  size="small"
                />
                {filterType === 'functional' && (
                  <Space wrap style={{ marginTop: 8 }}>
                    {functionalTags.map((tag) => (
                      <Tag
                        key={tag}
                        color={selectedFunctionalTag === tag ? 'blue' : 'default'}
                        style={{ cursor: 'pointer', margin: 0 }}
                        onClick={() => setSelectedFunctionalTag(tag)}
                      >
                        {tag}
                      </Tag>
                    ))}
                  </Space>
                )}
              </Space>
            }
            styles={{ body: { padding: 16 } }}
          >
            {filterType === 'clinic' ? (
              <div>
                <Space style={{ marginBottom: 16 }}>
                  {['门诊', '急诊', '住院', '影像检查'].map((type) => (
                    <Tag
                      key={type}
                      color={activeClinicType === type ? 'blue' : 'default'}
                      style={{ cursor: 'pointer', padding: '4px 16px' }}
                      onClick={() => handleClinicTypeChange(type)}
                    >
                      {type}
                    </Tag>
                  ))}
                  <Text type="secondary" style={{ marginLeft: 8 }}>|</Text>
                  {(stageOptionsByClinicType[activeClinicType] || ['全部']).map((stage) => (
                    <Tag
                      key={stage}
                      color={selectedStage === stage ? 'cyan' : 'default'}
                      style={{ cursor: 'pointer', margin: 0 }}
                      onClick={() => setSelectedStage(stage)}
                    >
                      {stage}
                    </Tag>
                  ))}
                </Space>
                <Row gutter={[16, 16]}>
                  {filteredScenes.length > 0 ? (
                    filteredScenes.map((scene) => (
                      <Col xs={12} sm={8} lg={6} key={scene.id}>
                        {renderSceneCard(scene)}
                      </Col>
                    ))
                  ) : (
                    <Col span={24}>
                      <Empty description="暂无可用场景，试试其他筛选条件" />
                    </Col>
                  )}
                </Row>
              </div>
            ) : (
              <Row gutter={[16, 16]}>
                {clinicalScenes.filter((scene) => {
                  if (selectedFunctionalTag === '全部') return true;
                  if (selectedFunctionalTag === '辅助诊断') return scene.type === '门诊' && scene.stage === '分诊';
                  if (selectedFunctionalTag === '影像分析') return scene.type === '影像检查';
                  if (selectedFunctionalTag === '病历生成') return scene.name.includes('病历') || scene.name.includes('报告');
                  if (selectedFunctionalTag === '用药审核') return scene.name.includes('用药') || scene.name.includes('处方');
                  if (selectedFunctionalTag === '导诊分诊') return scene.name.includes('分诊');
                  return false;
                }).length > 0 ? (
                  clinicalScenes
                    .filter((scene) => {
                      if (selectedFunctionalTag === '全部') return true;
                      if (selectedFunctionalTag === '辅助诊断') return scene.type === '门诊' && scene.stage === '分诊';
                      if (selectedFunctionalTag === '影像分析') return scene.type === '影像检查';
                      if (selectedFunctionalTag === '病历生成') return scene.name.includes('病历') || scene.name.includes('报告');
                      if (selectedFunctionalTag === '用药审核') return scene.name.includes('用药') || scene.name.includes('处方');
                      if (selectedFunctionalTag === '导诊分诊') return scene.name.includes('分诊');
                      return false;
                    })
                    .map((scene) => (
                      <Col xs={12} sm={8} lg={6} key={scene.id}>
                        {renderSceneCard(scene)}
                      </Col>
                    ))
                ) : (
                  <Col span={24}>
                    <Empty description="暂无可用场景，试试其他筛选条件" />
                  </Col>
                )}
              </Row>
            )}
          </Card>
        </Col>
      </Row>

      {/* Chat Drawer */}
      <ChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        sceneName={currentScene.name}
        agentName={currentScene.agentName}
        isOrchestration={currentScene.isOrchestration}
        flowNodes={flowNodes}
      />
    </div>
  );
};

export default Workbench;