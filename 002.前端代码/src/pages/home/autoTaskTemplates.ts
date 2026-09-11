export type AutoTaskTemplate = {
  id: string;
  name: string;
  description: string;
  prompt: string;
  frequency: {
    type: 'cycle' | 'interval' | 'once';
    cyclePeriod?: 'day' | 'week' | 'month';
    cycleTime?: string;
    intervalValue?: number;
    intervalUnit?: 'hour' | 'minute';
  };
};

export const autoTaskTemplates: AutoTaskTemplate[] = [
  {
    id: 'daily-agent-alert-summary',
    name: '每日智能体告警情况推送',
    description: '每日统计智能体整体告警情况，汇总级别、涉及范围和趋势。',
    prompt:
      '每日统计智能体整体告警情况，汇总当日告警总次数、级别、涉及智能体数，并对比昨日给出增减趋势与关注提示。',
    frequency: { type: 'cycle', cyclePeriod: 'day', cycleTime: '09:00' },
  },
  {
    id: 'daily-agent-management-report',
    name: '每日生成一份智能体管理情况报告',
    description: '每日自动生成当日智能体管理情况报告，支持编辑与导出。',
    prompt:
      '每日自动生成当日《智能体管理情况报告》，图文并茂、分模块呈现，每模块配图＋简要综述并标注周期与范围；数据据实、不臆造、密钥密文，生成后可编辑、导出。',
    frequency: { type: 'cycle', cyclePeriod: 'day', cycleTime: '13:30' },
  },
  {
    id: 'daily-agent-registration-review',
    name: '每日智能体注册审核事项推送',
    description: '每日推送智能体待审核注册申请清单，按提交时间排序。',
    prompt: '每日推送智能体待审核注册申请清单，逐条列出编号、名称、申请科室与已等待时长（按提交时间排序）。',
    frequency: { type: 'cycle', cyclePeriod: 'day', cycleTime: '10:00' },
  },
  {
    id: 'daily-evaluation-review',
    name: '每日智能体准入评测结果审核事项推送',
    description: '每日推送待审核准入评测结果清单，按完成时间排序。',
    prompt:
      '每日推送待审核的准入评测结果清单，逐条列出编号、名称、申请科室、评测完成时间及已等待时长（按完成时间排序）',
    frequency: { type: 'cycle', cyclePeriod: 'day', cycleTime: '10:00' },
  },
  {
    id: 'daily-resource-approval',
    name: '每日资源申请审批事项推送',
    description: '每日推送待审批资源申请清单，按提交时间排序。',
    prompt: '每日推送待审批的资源申请清单，逐条列出编号、名称、申请科室、申请资源名称及已等待时长（按提交时间排序）',
    frequency: { type: 'cycle', cyclePeriod: 'day', cycleTime: '09:30' },
  },
  {
    id: 'daily-pending-alerts',
    name: '每日告警待处理事项',
    description: '每日推送未处理告警清单，按级别高到低排序。',
    prompt: '每日推送未处理告警清单，逐条列出编号、名称、告警内容及级别（高→低排序），',
    frequency: { type: 'cycle', cyclePeriod: 'day', cycleTime: '09:30' },
  },
];

export function getAutoTaskTemplate(id?: string | null) {
  if (!id) return undefined;
  return autoTaskTemplates.find((template) => template.id === id);
}
