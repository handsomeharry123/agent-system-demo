/**
 * 360 画像 — 关联资源拓扑地图 视觉主题常量
 *
 * 集中管理颜色 / 半径 / 字号 / 动画时长,避免散落魔法值。
 */

export const TOPO_THEME = {
  // 节点状态色
  normal: '#35f2ff',
  normalTint: '#b7f8ff',
  normalGlow: 'rgba(53, 242, 255, 0.55)',
  abnormal: '#ff4d4f',
  abnormalTint: '#ffccc7',
  abnormalGlow: 'rgba(255, 77, 79, 0.6)',

  // 中心核心渐变
  coreInner: '#35f2ff',
  coreOuter: '#1677ff',

  // 装饰环配色
  ringSolid: 'rgba(53, 242, 255, 0.22)',
  ringDashed: 'rgba(53, 242, 255, 0.16)',

  /** 装饰环半径(需略大于对应 ring 的最远节点半径,营造"环"感) */
  decorationRadii: [118, 152, 186, 222, 248] as const,

  // 容器背景
  panelBg:
    'radial-gradient(circle at center, rgba(53,242,255,0.20) 0%, rgba(13,53,108,0.28) 35%, rgba(3,13,34,0.84) 100%)',
  panelBorder: 'rgba(77, 210, 255, 0.28)',
} as const;

/**
 * 多环辐射布局半径数组(像素,viewBox 760×540 坐标系)
 * 索引 0 → ring 1 (核心圈, 半径最小, 离智能体最近)
 * 索引 3 → ring 4 (边缘圈, 半径最大)
 *
 * 计算原则:viewBox 760×540,中心 (380, 270):
 *  - 上下可用半径 = min(270, 270) - 70 (节点卡片高 + 名字标签) = 200
 *  - 左右可用半径 = 380 - 80 (节点卡片宽 + 名字) = 300
 *  - 取 min(200, 300) = 200,最外圈 ≤ 200 保证完全可见。
 *  - 中心机器人视觉半径 ~74(呼吸环外圈),所以 ring 1 最小半径 120 才能避免遮挡。
 */
export const TOPO_RINGS_PX = [112, 150, 185, 220] as const;

/**
 * 节点子类型 → 缩写 + icon key(给卡片左上角徽标用)
 */
export const TOPO_SUBTYPE_BADGE: Record<string, { abbr: string; tone: string }> = {
  PACS: { abbr: 'PACS', tone: '#35f2ff' },
  HIS: { abbr: 'HIS', tone: '#69B1FF' },
  EMR: { abbr: 'EMR', tone: '#95DE64' },
  LIS: { abbr: 'LIS', tone: '#FFC069' },
  NIS: { abbr: 'NIS', tone: '#B37FEB' },
  MUSE: { abbr: 'MUSE', tone: '#FF85C0' },
  ESB: { abbr: 'ESB', tone: '#5B8FF9' },
  MQ: { abbr: 'MQ', tone: '#5AD8A6' },
  KM: { abbr: '知识库', tone: '#F6BD16' },
  API: { abbr: 'API', tone: '#7FF3FF' },
  CLINIC: { abbr: '临床', tone: '#95DE64' },
  PATIENT: { abbr: '患者', tone: '#69B1FF' },
  PAY: { abbr: '医保', tone: '#FF9C6E' },
  PORTAL: { abbr: '平台', tone: '#B7EB8F' },
  CHAT: { abbr: '会话', tone: '#87E8DE' },
  DOC: { abbr: '摘要', tone: '#ADC6FF' },
  ALERT: { abbr: '异常', tone: '#FF7875' },
};
