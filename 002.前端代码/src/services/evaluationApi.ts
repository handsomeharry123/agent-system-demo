// 注：V1.6 起统一准入评测沙盒页面直接使用 mock 数据，本文件保留作为旧 service 层的兼容占位。
// 如需重新启用 service 层,请基于 src/mock/evaluation.ts 的新结构(EvalDimension / EvaluationStatus / EvaluationDataset 等)重写。
import { mockRequest, mockPageRequest } from './api';
import { mockEvaluationTasks, mockDatasets, dimensionMetaList } from '../mock/evaluation';

export const getEvaluationTasks = async (params?: {
  current?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
  department?: string;
}) => {
  let filtered = [...mockEvaluationTasks];

  if (params?.keyword) {
    filtered = filtered.filter(
      (t) =>
        t.agentName.toLowerCase().includes(params.keyword!.toLowerCase()) ||
        t.taskNo.toLowerCase().includes(params.keyword!.toLowerCase()) ||
        t.agentCode.toLowerCase().includes(params.keyword!.toLowerCase())
    );
  }

  if (params?.status) {
    filtered = filtered.filter((t) => t.status === params.status);
  }

  if (params?.department) {
    filtered = filtered.filter((t) => t.department === params.department);
  }

  return mockPageRequest(filtered, params);
};

export const getEvaluationTaskById = async (id: string) => {
  const task = mockEvaluationTasks.find((t) => t.id === id);
  if (!task) {
    throw new Error('评测任务不存在');
  }
  return mockRequest(task);
};

// V1.6：指标展示页只读，service 返回元数据
export const getIndicators = async () => {
  return mockRequest(dimensionMetaList);
};

export const getDatasets = async () => {
  return mockRequest(mockDatasets);
};

export const deleteEvaluationTask = async (id: string) => {
  return mockRequest({ success: true });
};

