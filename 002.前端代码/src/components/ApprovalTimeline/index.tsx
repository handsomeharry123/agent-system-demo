import { ClockCircleOutlined } from '@ant-design/icons';
import { Card, Empty, Space, Tag, Timeline, Typography } from 'antd';
import type { CSSProperties } from 'react';

const { Text, Paragraph } = Typography;

export type ApprovalTimelineStatus = 'finish' | 'process' | 'error' | 'wait';

export interface ApprovalTimelineItem {
  title: string;
  time?: string;
  timeLabel?: string;
  operator?: string;
  operatorLabel?: string;
  description?: string;
  descriptionLabel?: string;
  status: ApprovalTimelineStatus;
}

interface ApprovalTimelineProps {
  items: ApprovalTimelineItem[];
  title?: string;
  style?: CSSProperties;
}

const statusMeta: Record<ApprovalTimelineStatus, { color: string; tag: string }> = {
  finish: { color: 'green', tag: '已完成' },
  process: { color: 'blue', tag: '进行中' },
  error: { color: 'red', tag: '已退回' },
  wait: { color: 'gray', tag: '待处理' },
};

/** 各业务详情页共用的审批轨迹，统一时间、人员和说明字段的呈现口径。 */
const ApprovalTimeline = ({ items, title = '审批时间线', style }: ApprovalTimelineProps) => (
  <Card title={title} bordered={false} style={style} data-testid="approval-timeline">
    {items.length === 0 ? (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无审批记录" />
    ) : (
      <Timeline
        items={items.map((item) => {
          const meta = statusMeta[item.status];
          return {
            color: meta.color,
            children: (
              <div style={{ paddingBottom: 4 }}>
                <Space size={8} wrap>
                  <Text strong>{item.title}</Text>
                  <Tag color={item.status === 'finish' ? 'success' : item.status === 'process' ? 'processing' : item.status === 'error' ? 'error' : 'default'}>
                    {meta.tag}
                  </Tag>
                </Space>
                {(item.time || item.operator) && (
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {item.time && <><ClockCircleOutlined /> {item.timeLabel && `${item.timeLabel}：`}{item.time}</>}
                      {item.time && item.operator && ' · '}
                      {item.operator && <>{item.operatorLabel && `${item.operatorLabel}：`}{item.operator}</>}
                    </Text>
                  </div>
                )}
                {item.description && <Paragraph style={{ margin: '5px 0 0', fontSize: 13, whiteSpace: 'pre-line' }}>{item.descriptionLabel && `${item.descriptionLabel}：`}{item.description}</Paragraph>}
              </div>
            ),
          };
        })}
      />
    )}
  </Card>
);

export default ApprovalTimeline;
