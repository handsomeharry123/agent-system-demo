import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProColumns, ProTable } from '@ant-design/pro-components';
import {
  Card, Button, Space, Tag, Typography, Modal, Form, Input, Select,
  Switch, message, Tree, Row, Col, Divider, Empty, Popconfirm, theme
} from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined,
  StopOutlined, CopyOutlined, HolderOutlined, EyeOutlined,
  MedicineBoxOutlined, FireOutlined, ExperimentOutlined,
  CameraOutlined, FileTextOutlined, SafetyOutlined, SearchOutlined
} from '@ant-design/icons';
import type { Scene, ClinicType, Stage, BindingType } from '../../mock/orchestration';
import { mockScenes, mockFlows, sceneStatusColors } from '../../mock/orchestration';
import { mockAgents } from '../../mock';
import PageHeader from '../../components/PageHeader';

const { Text } = Typography;

// Clinic type icons and colors
const clinicTypeConfig: Record<ClinicType, { icon: React.ReactNode; color: string }> = {
  '门诊': { icon: <MedicineBoxOutlined />, color: 'blue' },
  '急诊': { icon: <FireOutlined />, color: 'red' },
  '住院': { icon: <MedicineBoxOutlined />, color: 'green' },
  '体检': { icon: <ExperimentOutlined />, color: 'purple' },
  '随访': { icon: <FileTextOutlined />, color: 'orange' },
};

// Stage options per clinic type
const stageOptions: Record<ClinicType, { label: string; value: Stage }[]> = {
  '门诊': [
    { label: '挂号', value: '挂号' },
    { label: '分诊', value: '分诊' },
    { label: '问诊', value: '问诊' },
    { label: '检查', value: '检查' },
    { label: '诊断', value: '诊断' },
    { label: '用药', value: '用药' },
    { label: '复诊', value: '复诊' },
    { label: '其他', value: '其他' },
  ],
  '急诊': [
    { label: '分诊', value: '分诊' },
    { label: '问诊', value: '问诊' },
    { label: '检查', value: '检查' },
    { label: '诊断', value: '诊断' },
    { label: '用药', value: '用药' },
    { label: '其他', value: '其他' },
  ],
  '住院': [
    { label: '分诊', value: '分诊' },
    { label: '问诊', value: '问诊' },
    { label: '检查', value: '检查' },
    { label: '诊断', value: '诊断' },
    { label: '用药', value: '用药' },
    { label: '复诊', value: '复诊' },
    { label: '其他', value: '其他' },
  ],
  '体检': [
    { label: '挂号', value: '挂号' },
    { label: '检查', value: '检查' },
    { label: '诊断', value: '诊断' },
    { label: '其他', value: '其他' },
  ],
  '随访': [
    { label: '问诊', value: '问诊' },
    { label: '复诊', value: '复诊' },
    { label: '其他', value: '其他' },
  ],
};

const deptOptions = [
  { label: '全院', value: '全院' },
  { label: '心内科', value: '心内科' },
  { label: '呼吸科', value: '呼吸科' },
  { label: '消化科', value: '消化科' },
  { label: '急诊科', value: '急诊科' },
  { label: '药剂科', value: '药剂科' },
  { label: '放射科', value: '放射科' },
  { label: '体检科', value: '体检科' },
  { label: '内分泌科', value: '内分泌科' },
  { label: '神经内科', value: '神经内科' },
];

const entryPositionOptions = [
  { label: '工作台首页推荐', value: 'workbench_home' },
  { label: '科室工作台', value: 'dept_workbench' },
  { label: '患者门户', value: 'patient_portal' },
  { label: '仅API调用', value: 'api_only' },
];

const visibleScopeOptions = [
  { label: '全员可见', value: 'all' },
  { label: '指定科室', value: 'dept' },
  { label: '指定角色', value: 'role', disabled: true },
];

const Scenes = () => {
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedClinicType, setSelectedClinicType] = useState<ClinicType | null>(null);
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  // Build tree data for left panel
  const getTreeData = (): DataNode[] => {
    return Object.entries(clinicTypeConfig).map(([clinicType, config]) => ({
      key: clinicType,
      title: (
        <Space size="small">
          <Text style={{ color: config.color }}>{config.icon}</Text>
          <Text strong>{clinicType}</Text>
        </Space>
      ),
      children: stageOptions[clinicType as ClinicType]?.map((stage) => {
        const sceneCount = mockScenes.filter(
          s => s.clinicType === clinicType && s.stages.includes(stage.value) && s.enabled
        ).length;
        return {
          key: `${clinicType}-${stage.value}`,
          title: (
            <Space>
              <Text>{stage.label}</Text>
              {sceneCount > 0 && <Tag color="blue" style={{ marginLeft: 8 }}>{sceneCount}</Tag>}
            </Space>
          ),
          isLeaf: true,
        };
      }) || [],
    }));
  };

  const handleTreeSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length === 0) {
      setSelectedClinicType(null);
      setSelectedStage(null);
      return;
    }
    const key = selectedKeys[0] as string;
    if (key.includes('-')) {
      const [clinic, stage] = key.split('-');
      setSelectedClinicType(clinic as ClinicType);
      setSelectedStage(stage as Stage);
    } else {
      setSelectedClinicType(key as ClinicType);
      setSelectedStage(null);
    }
  };

  const getFilteredScenes = (): Scene[] => {
    let filtered = [...mockScenes];
    if (selectedClinicType) {
      filtered = filtered.filter(s => s.clinicType === selectedClinicType);
    }
    if (selectedStage) {
      filtered = filtered.filter(s => s.stages.includes(selectedStage));
    }
    if (searchText) {
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(searchText.toLowerCase()) ||
        s.description.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    return filtered.sort((a, b) => a.sortOrder - b.sortOrder);
  };

  const handleCreate = async () => {
    await form.validateFields();
    const values = form.getFieldsValue();
    message.success(editingScene ? '场景更新成功' : '场景创建成功');
    setCreateModalVisible(false);
    setEditingScene(null);
    form.resetFields();
  };

  const handleEdit = (scene: Scene) => {
    setEditingScene(scene);
    form.setFieldsValue({
      name: scene.name,
      description: scene.description,
      clinicType: scene.clinicType,
      stages: scene.stages,
      applicableDepts: scene.applicableDepts,
      bindingType: scene.bindingType,
      agentId: scene.agentId,
      flowId: scene.flowId,
      enabled: scene.enabled,
      sortOrder: scene.sortOrder,
      entryPositions: scene.entryPositions,
      visibleScope: scene.visibleScope,
      visibleDepts: scene.visibleDepts,
      welcomeMessage: scene.welcomeMessage,
      quickCommands: scene.quickCommands,
    });
    setCreateModalVisible(true);
  };

  const handleOpenCreate = () => {
    setEditingScene(null);
    form.resetFields();
    setCreateModalVisible(true);
  };

  const handleStatusChange = (scene: Scene, newStatus: string) => {
    message.success(`场景「${scene.name}」已${newStatus === '上线' ? '上线' : '下线'}`);
  };

  const columns: ProColumns<Scene>[] = [
    {
      title: '排序',
      key: 'sort',
      width: 60,
      render: (_, __, index) => (
        <HolderOutlined style={{ cursor: 'grab', color: '#999' }} />
      ),
    },
    {
      title: '场景名称',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => (
        <Space>
          <Text strong>{record.name}</Text>
        </Space>
      ),
    },
    {
      title: '场景说明',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      width: 200,
      render: (val) => <Text type="secondary" ellipsis>{val}</Text>,
    },
    {
      title: '就诊类型',
      dataIndex: 'clinicType',
      key: 'clinicType',
      width: 100,
      render: (val: ClinicType) => (
        <Space>
          <Text style={{ color: clinicTypeConfig[val]?.color }}>
            {clinicTypeConfig[val]?.icon}
          </Text>
          <Text>{val}</Text>
        </Space>
      ),
    },
    {
      title: '诊疗阶段',
      dataIndex: 'stages',
      key: 'stages',
      width: 150,
      render: (vals: Stage[]) => (
        <Space wrap size={[4, 4]}>
          {vals.map((stage) => (
            <Tag key={stage} color="green">{stage}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '绑定类型',
      dataIndex: 'bindingType',
      key: 'bindingType',
      width: 120,
      render: (_, record) => (
        <Tag color={record.bindingType === 'orchestration' ? 'purple' : 'cyan'}>
          {record.bindingType === 'orchestration' ? '编排流程' : '单一智能体'}
        </Tag>
      ),
    },
    {
      title: '绑定对象',
      key: 'binding',
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          {record.bindingType === 'single' && record.agentName && (
            <Text type="secondary" ellipsis>{record.agentName}</Text>
          )}
          {record.bindingType === 'orchestration' && record.flowName && (
            <Text ellipsis>
              {record.flowName}
              {record.flowVersion && <Text type="secondary"> (v{record.flowVersion})</Text>}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '适用科室',
      key: 'applicableDepts',
      width: 150,
      render: (_, record) => (
        <Space wrap size={[4, 4]}>
          {record.applicableDepts.slice(0, 2).map((dept) => (
            <Tag key={dept} color="blue">{dept}</Tag>
          ))}
          {record.applicableDepts.length > 2 && (
            <Tag color="default">+{record.applicableDepts.length - 2}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (val) => <Tag color={sceneStatusColors[val as keyof typeof sceneStatusColors]}>{val}</Tag>,
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 70,
      render: (val: boolean) => (
        <Switch checked={val} size="small" disabled />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          {record.status === '草稿' && (
            <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => handleStatusChange(record, '上线')}>
              发布
            </Button>
          )}
          {record.status === '上线' && (
            <Popconfirm
              title="确认下线"
              description={`确定要下线场景「${record.name}」吗？`}
              onConfirm={() => handleStatusChange(record, '下线')}
            >
              <Button type="link" size="small" danger icon={<StopOutlined />}>
                下线
              </Button>
            </Popconfirm>
          )}
          {record.status === '下线' && (
            <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => handleStatusChange(record, '上线')}>
              上线
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: token.colorBgLayout, height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        title="场景配置"
        subTitle="配置诊疗场景，绑定单个智能体或编排流程"
      />

      <div style={{ flex: 1, display: 'flex', gap: 16 }}>
        {/* Left Panel - Clinic Type Tree */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <Card
            title="就诊类型与阶段"
            size="small"
            styles={{ body: { padding: 8, height: 'calc(100vh - 200px)', overflow: 'auto' } }}
            extra={
              <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => message.info('新增就诊类型功能开发中')}>
                新增
              </Button>
            }
          >
            <Tree
              showIcon
              defaultExpandAll
              treeData={getTreeData()}
              selectedKeys={selectedStage ? [`${selectedClinicType}-${selectedStage}`] : selectedClinicType ? [selectedClinicType] : []}
              onSelect={(keys) => handleTreeSelect(keys)}
            />
          </Card>
        </div>

        {/* Right Panel - Scene List */}
        <div style={{ flex: 1 }}>
          <Card
            styles={{ body: { padding: '8px 12px', display: 'flex', flexDirection: 'column', height: '100%' } }}
            title={
              <Space size="middle">
                <Text>场景列表</Text>
                {selectedClinicType && (
                  <Tag color={clinicTypeConfig[selectedClinicType]?.color}>
                    {clinicTypeConfig[selectedClinicType]?.icon} {selectedClinicType}
                  </Tag>
                )}
                {selectedStage && (
                  <Tag color="green">{selectedStage}</Tag>
                )}
                <Text type="secondary">（共 {getFilteredScenes().length} 个场景）</Text>
              </Space>
            }
            extra={
              <Space>
                <Input
                  placeholder="搜索场景"
                  prefix={<SearchOutlined />}
                  style={{ width: 180 }}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  allowClear
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
                  新建场景
                </Button>
              </Space>
            }
          >
            <ProTable<Scene>
              columns={columns}
              dataSource={getFilteredScenes()}
              rowKey="id"
              size="small"
              search={false}
              options={{
                reload: true,
                density: false,
              }}
              scroll={{ x: 1200 }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条`,
              }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <Space direction="vertical">
                        <Text type="secondary">暂无场景</Text>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
                          新建场景
                        </Button>
                      </Space>
                    }
                  />
                ),
              }}
            />
          </Card>
        </div>
      </div>

      {/* Create/Edit Scene Modal */}
      <Modal
        title={editingScene ? '编辑场景' : '新建场景'}
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          setEditingScene(null);
          form.resetFields();
        }}
        onOk={handleCreate}
        width={800}
        maskClosable={false}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="场景名称"
                rules={[{ required: true, message: '请输入场景名称' }]}
              >
                <Input placeholder="请输入场景名称，≤30字" maxLength={30} showCount />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="clinicType"
                label="就诊类型"
                rules={[{ required: true, message: '请选择就诊类型' }]}
              >
                <Select
                  placeholder="请选择就诊类型"
                  options={Object.entries(clinicTypeConfig).map(([value, config]) => ({
                    label: (
                      <Space>
                        <Text style={{ color: config.color }}>{config.icon}</Text>
                        <Text>{value}</Text>
                      </Space>
                    ),
                    value,
                  }))}
                  disabled={!!editingScene}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="stages"
                label="诊疗阶段"
                rules={[{ required: true, message: '请选择诊疗阶段' }]}
              >
                <Select
                  mode="multiple"
                  placeholder="请选择诊疗阶段"
                  options={selectedClinicType ? stageOptions[selectedClinicType] : []}
                  disabled={!!editingScene}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="sortOrder"
                label="排序"
                rules={[{ required: true, message: '请输入排序' }]}
                initialValue={1}
              >
                <Input type="number" min={1} max={99} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="场景描述"
            rules={[{ required: true, message: '请输入场景描述' }]}
          >
            <Input.TextArea rows={2} placeholder="一句话描述场景用途" maxLength={200} showCount />
          </Form.Item>

          <Form.Item
            name="applicableDepts"
            label="适用科室"
            rules={[{ required: true, message: '请选择适用科室' }]}
          >
            <Select mode="multiple" placeholder="请选择适用科室" options={deptOptions} />
          </Form.Item>

          <Divider>绑定配置</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="bindingType"
                label="绑定类型"
                rules={[{ required: true, message: '请选择绑定类型' }]}
              >
                <Select
                  placeholder="请选择绑定类型"
                  options={[
                    { label: '单一智能体', value: 'single' },
                    { label: '编排流程', value: 'orchestration' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="enabled"
                label="启用状态"
                valuePropName="checked"
                initialValue={true}
              >
                <Switch checkedChildren="启用" unCheckedChildren="停用" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.bindingType !== curr.bindingType}
          >
            {({ getFieldValue }) =>
              getFieldValue('bindingType') === 'single' ? (
                <Form.Item
                  name="agentId"
                  label="绑定智能体"
                  rules={[{ required: true, message: '请选择绑定智能体' }]}
                >
                  <Select
                    placeholder="请选择绑定智能体"
                    showSearch
                    options={mockAgents
                      .filter((a) => a.lifecycleStatus === '已上线')
                      .map((a) => ({ label: a.name, value: a.id }))}
                  />
                </Form.Item>
              ) : (
                <Form.Item
                  name="flowId"
                  label="绑定流程"
                  rules={[{ required: true, message: '请选择绑定流程' }]}
                >
                  <Select
                    placeholder="请选择绑定流程"
                    showSearch
                    options={mockFlows
                      .filter((f) => f.status === '上线' || f.status === '测试中')
                      .map((f) => ({ label: `${f.name} (${f.version})`, value: f.id }))}
                  />
                </Form.Item>
              )
            }
          </Form.Item>

          <Divider>展示配置</Divider>

          <Form.Item
            name="entryPositions"
            label="入口展示位置"
            rules={[{ required: true, message: '请选择入口展示位置' }]}
          >
            <Select mode="multiple" placeholder="请选择入口展示位置" options={entryPositionOptions} />
          </Form.Item>

          <Form.Item
            name="visibleScope"
            label="可见范围"
            rules={[{ required: true, message: '请选择可见范围' }]}
            initialValue="all"
          >
            <Select placeholder="请选择可见范围" options={visibleScopeOptions} />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.visibleScope !== curr.visibleScope}
          >
            {({ getFieldValue }) =>
              getFieldValue('visibleScope') === 'dept' && (
                <Form.Item
                  name="visibleDepts"
                  label="可见科室"
                  rules={[{ required: true, message: '请选择可见科室' }]}
                >
                  <Select mode="multiple" placeholder="请选择可见科室" options={deptOptions} />
                </Form.Item>
              )
            }
          </Form.Item>

          <Form.Item name="welcomeMessage" label="欢迎语">
            <Input.TextArea
              rows={2}
              placeholder="场景启动时的欢迎语，引导用户如何开始"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Scenes;