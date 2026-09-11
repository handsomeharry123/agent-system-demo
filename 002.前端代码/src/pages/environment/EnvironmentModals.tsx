/**
 * 智能体晋级正式环境弹窗
 * 对应需求文档：§3 智能体晋级弹窗（Modal 520px）
 *
 * 触发位置：沙盒环境 Tab 列表中「评测准入 + 满足晋级门槛」的智能体
 */
import { useMemo } from 'react';
import { Modal, Descriptions, Result, Form, Input, Space, Tag, Alert, Typography, Button, Tooltip, message } from 'antd';
import { CheckCircleTwoTone, CloseCircleTwoTone, ArrowUpOutlined } from '@ant-design/icons';
import {
  checkPromotion,
  type PromotionRule,
  type SandboxAgentItem,
} from '../../mock/environment';

const { Text } = Typography;

// =============================================================
// 1. 晋级正式环境弹窗
// =============================================================
interface PromotionModalProps {
  open: boolean;
  agent: SandboxAgentItem | null;
  rule: PromotionRule;
  onClose: () => void;
  onConfirm: (agent: SandboxAgentItem, note: string) => void;
}

export const PromotionModal = ({ open, agent, rule, onClose, onConfirm }: PromotionModalProps) => {
  const [form] = Form.useForm<{ note: string }>();

  const checkResult = useMemo(
    () => (agent ? checkPromotion(agent, rule) : null),
    [agent, rule],
  );

  if (!agent) return null;

  const handleOk = () => {
    // 防御性二次拦截：即使 okDisabled 被绕过，也必须门槛通过才允许晋级
    if (!checkResult?.pass) {
      message.warning('晋级门槛未满足，无法晋级');
      return;
    }
    form.validateFields().then((vals) => {
      onConfirm(agent, vals.note || '');
      form.resetFields();
    });
  };

  const okDisabled = !checkResult?.pass;
  const okButton = (
    <Button type="primary" disabled={okDisabled} onClick={handleOk}>
      确认晋级
    </Button>
  );

  return (
    <Modal
      open={open}
      width={520}
      title={
        <Space>
          <ArrowUpOutlined />
          晋级正式环境
        </Space>
      }
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      footer={
        <Space>
          <Button
            onClick={() => {
              form.resetFields();
              onClose();
            }}
          >
            取消
          </Button>
          {okDisabled ? (
            <Tooltip title="晋级门槛未满足，无法晋级">
              <span>{okButton}</span>
            </Tooltip>
          ) : (
            okButton
          )}
        </Space>
      }
      destroyOnClose
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {/* 1. 晋级对象信息（5 字段独立 Item，与 V1.2 §3 表格字面对齐） */}
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="智能体名称">{agent.name}</Descriptions.Item>
          <Descriptions.Item label="版本">{agent.version}</Descriptions.Item>
          <Descriptions.Item label="归属科室">{agent.department}</Descriptions.Item>
          <Descriptions.Item label="评测总分">
            {agent.totalScore != null ? (
              <Text strong style={{ color: '#52C41A' }}>{agent.totalScore.toFixed(1)}</Text>
            ) : (
              <Text type="secondary">—</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="评测结论">
            <Tag color={agent.evalStatus === '已审核·准入' ? 'success' : 'default'}>
              {agent.evalStatus}
            </Tag>
          </Descriptions.Item>
        </Descriptions>

        {/* 2. 门槛校验结果：通过/未通过 保持一致视觉（Result 标题 + 明细列表） */}
        {checkResult && (
          <Result
            status={checkResult.pass ? 'success' : 'warning'}
            style={{ padding: '12px 0' }}
            title={
              <Text style={{ fontSize: 14 }}>
                {checkResult.pass ? '晋级门槛校验通过' : '晋级门槛未全部满足，无法晋级'}
              </Text>
            }
            subTitle={
              <Text type="secondary" style={{ fontSize: 12 }}>
                {checkResult.pass
                  ? '所有规则均已满足，可执行晋级'
                  : '请逐条核对未达标项，达标后方可晋级'}
              </Text>
            }
          />
        )}

        {/* 门槛校验明细：pass / fail 共用一份，统一视觉权重 */}
        {checkResult && (
          <div
            style={{
              padding: 12,
              background: checkResult.pass ? '#F6FFED' : '#FFF7E6',
              border: `1px solid ${checkResult.pass ? '#B7EB8F' : '#FFD591'}`,
              borderRadius: 6,
            }}
          >
            <Text strong style={{ fontSize: 13 }}>门槛校验明细</Text>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {checkResult.items.map((item, i) => (
                <li key={i}>
                  {item.pass ? (
                    <CheckCircleTwoTone twoToneColor="#52C41A" />
                  ) : (
                    <CloseCircleTwoTone twoToneColor="#FF4D4F" />
                  )}{' '}
                  <Text style={{ fontSize: 12 }}>{item.label}</Text>{' '}
                  <Text type="secondary" style={{ fontSize: 12 }}>· {item.detail}</Text>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 3. 晋级说明（非必填，≤500 字） */}
        <Form form={form} layout="vertical">
          <Form.Item
            label="晋级说明"
            name="note"
            rules={[{ max: 500, message: '不超过 500 字' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="如：评测通过且业务侧已确认，准予晋级正式环境"
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>

        {/* 风险提示：合并归档审计 + 通知（与退回弹窗结构对齐） */}
        <Alert
          type="info"
          showIcon
          style={{ fontSize: 12 }}
          message="确认后该智能体将按正式环境参数运行，台账中心状态联动『试运行中/已上线』，操作归档审计中心；并站内通知归属科室管理员。"
        />
      </Space>
    </Modal>
  );
};
