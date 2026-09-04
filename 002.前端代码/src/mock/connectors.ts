/**
 * 连接器 mock —— PRD §3《连接器功能说明》落地版
 *
 * 8 个内置连接器(照搬 PRD §3 内置连接器清单描述):
 *   微信 / 企业微信 / QQ / 飞书 / 钉钉 / QQ 邮箱 / 企业邮箱 / 短信网关
 *
 * 设计要点:
 *   - 三态 unused / connected / error,首屏三态齐全便于 verify 截图
 *   - 模块级 _runtimeConnectors 持可变状态,列表页与详情页共享同一份数据
 *   - 不引入 Context / zustand,与 HomeSidebarV2 的 autoTasks 同模式
 */

export type ConnectorKey =
  | 'wechat'
  | 'wecom'
  | 'qq'
  | 'feishu'
  | 'dingtalk'
  | 'qqmail'
  | 'corpemail'
  | 'smsgw';

export type ConnectorStatus = 'unused' | 'connected' | 'error';

export interface Connector {
  key: ConnectorKey;
  name: string;
  description: string;
  iconName: string;
  brandColor: string;
  capabilities: string[];
}

export interface ConnectorState extends Connector {
  status: ConnectorStatus;
  connectedAt?: string;
  errorMessage?: string;
}

/* 内置连接器清单(照抄 PRD §3 文案) */
export const initialConnectors: ConnectorState[] = [
  {
    key: 'wechat',
    name: '微信',
    description: '接入个人微信，用于接收医小管推送的报告、告警等消息',
    iconName: 'WechatOutlined',
    brandColor: '#07C160',
    capabilities: ['消息推送', '附件发送'],
    status: 'connected',
    connectedAt: '2026-06-12 10:30',
  },
  {
    key: 'wecom',
    name: '企业微信',
    description: '接入医院企业微信组织，用于组织内通知与工作群消息推送',
    iconName: 'WechatWorkOutlined',
    brandColor: '#1565EF',
    capabilities: ['消息推送', '群通知', '工作通知'],
    status: 'connected',
    connectedAt: '2026-07-01 09:00',
  },
  {
    key: 'qq',
    name: 'QQ',
    description: '接入个人 QQ，用于接收消息通知',
    iconName: 'QqOutlined',
    brandColor: '#12B7F5',
    capabilities: ['消息推送'],
    status: 'unused',
  },
  {
    key: 'feishu',
    name: '飞书',
    description: '接入飞书账号/机器人，用于飞书群/私聊消息推送',
    iconName: 'LarkOutlined',
    brandColor: '#3370FF',
    capabilities: ['消息推送', '群通知'],
    status: 'connected',
    connectedAt: '2026-05-22 14:08',
  },
  {
    key: 'dingtalk',
    name: '钉钉',
    description: '接入钉钉账号/机器人，用于钉钉群/工作通知消息推送',
    iconName: 'DingtalkOutlined',
    brandColor: '#1677FF',
    capabilities: ['消息推送', '群通知', '工作通知'],
    status: 'error',
    errorMessage: '授权令牌已过期，请重新授权',
  },
  {
    key: 'qqmail',
    name: 'QQ 邮箱',
    description: '接入 QQ 邮箱，用于接收报告、附件等邮件通知',
    iconName: 'MailOutlined',
    brandColor: '#FF8C00',
    capabilities: ['邮件', '附件发送'],
    status: 'connected',
    connectedAt: '2026-04-18 09:45',
  },
  {
    key: 'corpemail',
    name: '企业邮箱',
    description: '接入医院企业邮箱，用于正式邮件通知',
    iconName: 'MailOutlined',
    brandColor: '#4F566B',
    capabilities: ['邮件'],
    status: 'unused',
  },
  {
    key: 'smsgw',
    name: '短信网关',
    description: '接入运营商短信通道，用于紧急告警短信推送',
    iconName: 'MessageOutlined',
    brandColor: '#FA8C16',
    capabilities: ['短信'],
    status: 'connected',
    connectedAt: '2026-06-30 17:20',
  },
];

/* 模块级可变状态(避免双副本) */
let _runtimeConnectors: ConnectorState[] = initialConnectors.map((c) => ({ ...c }));

export function getConnectors(): ConnectorState[] {
  return _runtimeConnectors;
}

export function setConnectorStatus(key: ConnectorKey, status: ConnectorStatus): void {
  _runtimeConnectors = _runtimeConnectors.map((c) => {
    if (c.key !== key) return c;
    if (status === 'connected') {
      return { ...c, status, connectedAt: nowStr(), errorMessage: undefined };
    }
    if (status === 'error') {
      return { ...c, status, errorMessage: c.errorMessage ?? '授权异常，请稍后重试' };
    }
    return { ...c, status, connectedAt: undefined, errorMessage: undefined };
  });
}

export function setConnectorsBulk(status: ConnectorStatus): void {
  _runtimeConnectors = _runtimeConnectors.map((c) => {
    if (status === 'connected') {
      return { ...c, status, connectedAt: nowStr(), errorMessage: undefined };
    }
    if (status === 'error') {
      return { ...c, status, errorMessage: c.errorMessage ?? '授权异常，请稍后重试' };
    }
    return { ...c, status, connectedAt: undefined, errorMessage: undefined };
  });
}

export function resetConnectors(): void {
  _runtimeConnectors = initialConnectors.map((c) => ({ ...c }));
}

export function findConnector(key: string | undefined): ConnectorState | undefined {
  if (!key) return undefined;
  return _runtimeConnectors.find((c) => c.key === key);
}

/* 时间戳统一使用固定格式,避免 hydration mismatch */
function nowStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}