import type { UserOverride } from '../types/user';

/**
 * 用户级数据权限覆盖 mock（V1.1 仅作为例外通道）
 */
export const mockUserOverrides: UserOverride[] = [
  {
    id: 'override-001',
    userId: 'user-007',
    userName: '孙伟',
    employeeId: 'EMP007',
    department: '影像科',
    roles: ['科室管理员'],
    orgDefault: {
      agentScope: 'all',
      dataClassifications: ['一般', '重要', '核心', '敏感'],
    },
    userScope: {
      agentScope: 'custom',
      customAgents: ['agent-001', 'agent-002', 'agent-007'],
      dataClassifications: ['一般', '重要', '核心', '敏感'],
    },
    reason: 'MDT 多学科会诊：参与心内科、胸外科联合读片，仅需影像类智能体',
    expiryStrategy: 'onOrgChange',
    createdAt: '2026-04-15 10:00:00',
    updatedAt: '2026-05-14 15:20:00',
  },
  {
    id: 'override-002',
    userId: 'user-012',
    userName: '徐丽娟',
    employeeId: 'EMP012',
    department: '心内科',
    roles: ['科室管理员'],
    orgDefault: {
      agentScope: 'dept',
      dataClassifications: ['一般', '重要', '核心'],
    },
    userScope: {
      agentScope: 'custom',
      customAgents: ['agent-001', 'agent-003', 'agent-005'],
      dataClassifications: ['一般', '重要', '核心'],
    },
    reason: '跨科调研：参与药剂科处方审核与心内科联合研究项目',
    expiryStrategy: 'byDate',
    expiryDate: '2026-12-31',
    createdAt: '2026-03-01 09:00:00',
    updatedAt: '2026-05-19 11:00:00',
  },
  {
    id: 'override-003',
    userId: 'user-002',
    userName: '李秀英',
    employeeId: 'EMP002',
    department: '心内科',
    roles: ['信息科管理员', '科室管理员'],
    orgDefault: {
      agentScope: 'dept',
      dataClassifications: ['一般', '重要', '核心'],
    },
    userScope: {
      agentScope: 'all',
      dataClassifications: ['一般', '重要', '核心', '敏感'],
    },
    reason: '信息科测试账号：长期需要全院数据用于系统联调',
    expiryStrategy: 'permanent',
    createdAt: '2025-08-10 14:00:00',
    updatedAt: '2026-05-19 16:45:00',
  },
];
