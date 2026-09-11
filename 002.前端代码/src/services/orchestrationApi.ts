import { mockRequest, mockPageRequest } from './api';
import type { Scene, OrchestrationFlow, ClinicType, Stage, SceneStatus, FlowStatus } from '../mock/orchestration';
import { mockScenes, mockFlows } from '../mock/orchestration';
import { mockAgents } from '../mock';

// ============ Scenes API ============

export const getScenes = async (params?: {
  current?: number;
  pageSize?: number;
  clinicType?: ClinicType;
  stage?: Stage;
  status?: SceneStatus;
  keyword?: string;
}) => {
  let filtered = [...mockScenes];

  if (params?.keyword) {
    filtered = filtered.filter(
      (s) =>
        s.name.toLowerCase().includes(params.keyword!.toLowerCase()) ||
        s.description.toLowerCase().includes(params.keyword!.toLowerCase())
    );
  }

  if (params?.clinicType) {
    filtered = filtered.filter((s) => s.clinicType === params.clinicType);
  }

  if (params?.stage) {
    filtered = filtered.filter((s) => s.stages.includes(params.stage));
  }

  if (params?.status) {
    filtered = filtered.filter((s) => s.status === params.status);
  }

  return mockPageRequest(filtered, params);
};

export const getSceneById = async (id: string) => {
  const scene = mockScenes.find((s) => s.id === id);
  if (!scene) {
    throw new Error('场景不存在');
  }
  return mockRequest(scene);
};

export const createScene = async (data: Partial<Scene>) => {
  const newScene: Scene = {
    id: `scene-${Date.now()}`,
    name: data.name || '',
    icon: data.icon || 'MedicineBoxOutlined',
    clinicType: data.clinicType || '门诊',
    stages: data.stages || [],
    applicableDepts: data.applicableDepts || [],
    description: data.description || '',
    bindingType: data.bindingType || 'single',
    agentId: data.agentId,
    agentName: data.agentName,
    flowId: data.flowId,
    flowName: data.flowName,
    flowVersion: data.flowVersion,
    entryPositions: data.entryPositions || ['workbench_home'],
    visibleScope: data.visibleScope || 'all',
    visibleDepts: data.visibleDepts,
    quickCommands: data.quickCommands,
    welcomeMessage: data.welcomeMessage,
    status: '草稿',
    enabled: true,
    sortOrder: data.sortOrder || 1,
    createTime: new Date().toLocaleString('zh-CN'),
    updateTime: new Date().toLocaleString('zh-CN'),
    creator: '管理员',
  };
  return mockRequest(newScene);
};

export const updateScene = async (id: string, data: Partial<Scene>) => {
  const scene = mockScenes.find((s) => s.id === id);
  if (!scene) {
    throw new Error('场景不存在');
  }
  Object.assign(scene, data, { updateTime: new Date().toLocaleString('zh-CN') });
  return mockRequest(scene);
};

export const publishScene = async (id: string) => {
  const scene = mockScenes.find((s) => s.id === id);
  if (!scene) {
    throw new Error('场景不存在');
  }
  scene.status = '上线';
  scene.updateTime = new Date().toLocaleString('zh-CN');
  return mockRequest(scene);
};

export const offlineScene = async (id: string) => {
  const scene = mockScenes.find((s) => s.id === id);
  if (!scene) {
    throw new Error('场景不存在');
  }
  scene.status = '下线';
  scene.updateTime = new Date().toLocaleString('zh-CN');
  return mockRequest(scene);
};

export const deleteScene = async (id: string) => {
  return mockRequest({ success: true });
};

// ============ Flows API ============

export const getFlows = async (params?: {
  current?: number;
  pageSize?: number;
  status?: FlowStatus;
  keyword?: string;
}) => {
  let filtered = [...mockFlows];

  if (params?.keyword) {
    filtered = filtered.filter(
      (f) =>
        f.name.toLowerCase().includes(params.keyword!.toLowerCase()) ||
        f.description.toLowerCase().includes(params.keyword!.toLowerCase())
    );
  }

  if (params?.status) {
    filtered = filtered.filter((f) => f.status === params.status);
  }

  return mockPageRequest(filtered, params);
};

export const getFlowById = async (id: string) => {
  const flow = mockFlows.find((f) => f.id === id);
  if (!flow) {
    throw new Error('流程不存在');
  }
  return mockRequest(flow);
};

export const createFlow = async (data: Partial<OrchestrationFlow>) => {
  const newFlow: OrchestrationFlow = {
    id: `flow-${Date.now()}`,
    name: data.name || '',
    description: data.description || '',
    status: '草稿',
    version: 'v0.1',
    nodeCount: 0,
    creator: '管理员',
    applicableDepts: data.applicableDepts || [],
    createTime: new Date().toLocaleString('zh-CN'),
    updateTime: new Date().toLocaleString('zh-CN'),
    runCount: 0,
    todayExecutionCount: 0,
    successRate: 0,
    nodes: [],
    connections: [],
  };
  return mockRequest(newFlow);
};

export const updateFlow = async (id: string, data: Partial<OrchestrationFlow>) => {
  const flow = mockFlows.find((f) => f.id === id);
  if (!flow) {
    throw new Error('流程不存在');
  }
  Object.assign(flow, data, { updateTime: new Date().toLocaleString('zh-CN') });
  return mockRequest(flow);
};

export const submitForTesting = async (id: string) => {
  const flow = mockFlows.find((f) => f.id === id);
  if (!flow) {
    throw new Error('流程不存在');
  }
  flow.status = '测试中';
  flow.updateTime = new Date().toLocaleString('zh-CN');
  return mockRequest(flow);
};

export const deployFlow = async (id: string) => {
  const flow = mockFlows.find((f) => f.id === id);
  if (!flow) {
    throw new Error('流程不存在');
  }
  flow.status = '上线';
  flow.updateTime = new Date().toLocaleString('zh-CN');
  return mockRequest(flow);
};

export const offlineFlow = async (id: string) => {
  const flow = mockFlows.find((f) => f.id === id);
  if (!flow) {
    throw new Error('流程不存在');
  }
  flow.status = '下线';
  flow.updateTime = new Date().toLocaleString('zh-CN');
  return mockRequest(flow);
};

export const archiveFlow = async (id: string) => {
  const flow = mockFlows.find((f) => f.id === id);
  if (!flow) {
    throw new Error('流程不存在');
  }
  flow.status = '已归档';
  flow.updateTime = new Date().toLocaleString('zh-CN');
  return mockRequest(flow);
};

export const rollbackFlow = async (id: string, version: string) => {
  const flow = mockFlows.find((f) => f.id === id);
  if (!flow) {
    throw new Error('流程不存在');
  }
  // In a real app, this would restore from snapshot
  flow.version = version;
  flow.updateTime = new Date().toLocaleString('zh-CN');
  return mockRequest(flow);
};

// ============ Agents API ============

export const getAgents = async () => {
  const onlineAgents = mockAgents.filter((a) => a.lifecycleStatus === '已上线');
  return mockRequest(onlineAgents);
};

export const getAgentSchema = async (agentId: string, version?: string) => {
  const agent = mockAgents.find((a) => a.id === agentId);
  if (!agent) {
    throw new Error('智能体不存在');
  }
  // Return mock schema
  return mockRequest({
    agent_id: agent.id,
    agent_name: agent.name,
    version: version || 'latest',
    input_schema: {
      type: 'object',
      properties: {
        input_text: { type: 'string', description: '输入文本' },
      },
    },
    output_schema: {
      type: 'object',
      properties: {
        result: { type: 'string', description: '处理结果' },
      },
    },
    error_codes: [],
    timeout_recommend: 30,
  });
};
