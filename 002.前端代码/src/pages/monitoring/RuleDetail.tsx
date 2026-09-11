/**
 * 5.3 规则详情页（V2.0）
 * 需求文档：统一运行监控中心-需求说明文档 V2.0 §5.3
 *
 * 字段：规则名称 / 规则类型 / 触发条件 / 规则配置 / 规则内容库 / 规则文件
 * 按钮：规则文件查看 / 下载 / 编辑 / 删除
 *
 * 「规则配置」按统一结构（PRD 字段结构统一说明）：
 *   1. rule_name（规则名称）
 *   2. trigger_time（触发时间）
 *   3. trigger_condition（触发条件，metric / operator / threshold / sustain_duration）
 *   4. trigger_action（触发动作：notify / warn / throttle / degrade / disable）
 *   5. output_prompt（输出提示词）
 *
 * 「规则内容库」分四大类（业务执行 / 运行状态 / 成本资源 / 安全），高亮当前规则关联条目
 * 「规则文件」支持在线查看与下载（.xlsx / .csv）
 * 仅 IT 管理员可见与操作
 */
import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card, Space, Button, Typography, Descriptions, Tag, Divider, Tabs,
  Modal, message, Empty, Alert as AntAlert, Row, Col, List, Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, DeleteOutlined, DownloadOutlined,
  EyeOutlined, FileTextOutlined, BookOutlined, CheckOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { PermissionDenied } from '../../components/PageStates';
import {
  mockAlertRulesV18, mockAlertRuleLibrary, AlertRuleTypeLabels, TriggerActionLabels,
  syncChatAlertRulesFromStorage,
  type AlertRuleV18,
} from '../../mock/monitoringV18';
import { useMonitoringGuard } from './useMonitoringGuard';

const { Text } = Typography;

const typeColors: Record<string, string> = {
  business: 'blue', status: 'green', cost: 'orange', security: 'red',
};

const typeToCategory: Record<string, string> = {
  business: '业务执行', status: '运行状态', cost: '成本资源', security: '安全',
};

const LIBRARY_TABS = [
  { key: '业务执行', label: '业务执行' },
  { key: '运行状态', label: '运行状态' },
  { key: '成本资源', label: '成本资源' },
  { key: '安全', label: '安全' },
] as const;

const RuleDetail = () => {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const { isAdmin } = useMonitoringGuard();
  const [rule, setRule] = useState<AlertRuleV18 | undefined>(undefined);
  const [libraryTab, setLibraryTab] = useState<string>('业务执行');

  useEffect(() => {
    if (params.id) {
      syncChatAlertRulesFromStorage();
      const r = mockAlertRulesV18.find((it) => it.id === params.id);
      setRule(r);
      if (r) setLibraryTab(typeToCategory[r.type] || '业务执行');
    }
  }, [params.id]);

  const selectedContent = useMemo(
    () => rule ? mockAlertRuleLibrary.find((c) => c.id === rule.ruleContentId) : undefined,
    [rule?.ruleContentId],
  );

  const tabLibrary = useMemo(
    () => mockAlertRuleLibrary.filter((c) => c.category === libraryTab),
    [libraryTab],
  );

  if (!isAdmin) return <PermissionDenied message="告警规则管理仅面向 IT 管理员" />;
  if (!rule) return <Empty description="规则不存在" style={{ marginTop: 80 }} />;

  // 删除
  const handleDelete = () => {
    Modal.confirm({
      title: '确认是否删除？',
      content: (
        <Space direction="vertical" size={4}>
          <Text>确认删除规则「<Text strong>{rule.name}</Text>」？该操作不可恢复。</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>点击【是】删除此条规则；点击【否】回到规则管理页。</Text>
        </Space>
      ),
      okText: '是',
      cancelText: '否',
      okButtonProps: { danger: true },
      onOk: () => {
        const idx = mockAlertRulesV18.findIndex((r) => r.id === rule.id);
        if (idx >= 0) mockAlertRulesV18.splice(idx, 1);
        message.success('规则已删除');
        navigate('/app/monitoring/alert-rules');
      },
    });
  };

  // 文件查看（演示：弹窗展示）
  const handleViewFile = () => {
    if (!rule.ruleFile) {
      message.info('该规则未上传规则文件');
      return;
    }
    Modal.info({
      title: `规则文件预览 — ${rule.ruleFile.name}`,
      width: 600,
      content: (
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            格式：{rule.ruleFile.format.toUpperCase()} · 大小：{(rule.ruleFile.size / 1024).toFixed(1)} KB
          </Text>
          <Card size="small" style={{ background: '#FAFAFA' }}>
            <Text style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
{`规则名称,规则类型,指标,运算符,阈值,单位,持续时间
${rule.name},${AlertRuleTypeLabels[rule.type]},${rule.triggerCondition.metric},${rule.triggerCondition.operator},${rule.triggerCondition.threshold},${rule.triggerCondition.thresholdUnit || ''},${rule.triggerCondition.sustainDuration || ''}`}
            </Text>
          </Card>
          <Text type="secondary" style={{ fontSize: 12 }}>（演示用：仅展示文件元数据 + 一行示例；真实环境按格式渲染）</Text>
        </Space>
      ),
    });
  };

  // 文件下载
  const handleDownloadFile = () => {
    if (!rule.ruleFile) {
      message.info('该规则未上传规则文件');
      return;
    }
    const csv = [
      '规则名称,规则类型,指标,运算符,阈值,单位,持续时间,触发动作',
      `${rule.name},${AlertRuleTypeLabels[rule.type]},${rule.triggerCondition.metric},${rule.triggerCondition.operator},${rule.triggerCondition.threshold},${rule.triggerCondition.thresholdUnit || ''},${rule.triggerCondition.sustainDuration || ''},${TriggerActionLabels[rule.triggerAction]}`,
    ].join('\n');
    const mime = rule.ruleFile.format === 'csv' ? 'text/csv;charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const blob = new Blob(['﻿' + csv], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = rule.ruleFile.name;
    a.click();
    URL.revokeObjectURL(url);
    message.success(`已下载：${rule.ruleFile.name}`);
  };

  return (
    <div style={{ padding: 24, background: '#F5F5F5', minHeight: '100vh' }}>
      <PageHeader
        title="规则详情"
        subTitle="查看规则配置、规则内容库与规则文件；支持编辑 / 删除"
        showBack
        onBack={() => navigate('/app/monitoring/alert-rules')}
        breadcrumb={[
          { path: '/app/monitoring', breadcrumbName: '统一运行监控中心' },
          { path: '/app/monitoring/alert-rules', breadcrumbName: '告警规则管理' },
          { path: '', breadcrumbName: rule.name },
        ]}
        extra={
          <Space>
            <Button icon={<EditOutlined />} onClick={() => navigate(`/app/monitoring/alert-rules/${rule.id}/edit`)}>编辑</Button>
            <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>删除</Button>
          </Space>
        }
      />

      {/* 顶部规则概览 */}
      <Card bordered={false} style={{ marginTop: 16 }}>
        <Space size={12} align="center" wrap>
          <Text strong style={{ fontSize: 22 }}>{rule.name}</Text>
          <Tag color={typeColors[rule.type]}>{AlertRuleTypeLabels[rule.type]}</Tag>
          <Tag color={rule.enabled ? 'success' : 'default'}>{rule.enabled ? '已启用' : '已停用'}</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>
            最近触发：{rule.lastTriggeredAt || '—'} · 7 日触发：{rule.trigger7d} 次
          </Text>
        </Space>
      </Card>

      <Row style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16 }}>
        {/* 左：基本信息 + 触发条件 + 规则文件 */}
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card bordered={false} title="规则基本信息">
            <Descriptions column={2} size="small">
              <Descriptions.Item label="规则名称">{rule.name}</Descriptions.Item>
              <Descriptions.Item label="规则类型">
                <Tag color={typeColors[rule.type]}>{AlertRuleTypeLabels[rule.type]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建人">{rule.createdBy}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{rule.createdAt}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{rule.updatedAt}</Descriptions.Item>
              <Descriptions.Item label="启用状态">
                <Tag color={rule.enabled ? 'success' : 'default'}>{rule.enabled ? '启用' : '停用'}</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card bordered={false} title="触发条件">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="指标">{rule.triggerCondition.metric}</Descriptions.Item>
              <Descriptions.Item label="运算符 / 阈值 / 单位">
                <Space>
                  <Tag color="default">{rule.triggerCondition.operator}</Tag>
                  <Text strong>{rule.triggerCondition.threshold}</Text>
                  {rule.triggerCondition.thresholdUnit && <Text type="secondary">{rule.triggerCondition.thresholdUnit}</Text>}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="持续时间">{rule.triggerCondition.sustainDuration}</Descriptions.Item>
              <Descriptions.Item label="条件描述">
                <Text code>{rule.triggerCondition.description}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="触发动作">
                <Tag color="processing">{TriggerActionLabels[rule.triggerAction]}</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            bordered={false}
            title={<Space><FileTextOutlined /><Text strong>规则文件</Text></Space>}
            extra={
              rule.ruleFile ? (
                <Space>
                  <Button size="small" icon={<EyeOutlined />} onClick={handleViewFile}>查看</Button>
                  <Button size="small" icon={<DownloadOutlined />} onClick={handleDownloadFile}>下载</Button>
                </Space>
              ) : null
            }
          >
            {rule.ruleFile ? (
              <Space size={12} align="center" wrap>
                <FileTextOutlined style={{ fontSize: 24, color: '#1677FF' }} />
                <Space direction="vertical" size={0}>
                  <Text strong>{rule.ruleFile.name}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {(rule.ruleFile.size / 1024).toFixed(1)} KB · {rule.ruleFile.format.toUpperCase()}
                  </Text>
                </Space>
              </Space>
            ) : (
              <Empty description="该规则未上传规则文件" />
            )}
          </Card>
        </Space>

        {/* 右：规则配置（统一结构）+ 规则内容库 */}
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card bordered={false} title="规则配置（统一结构）">
            <AntAlert
              type="info" showIcon style={{ marginBottom: 12 }}
              message="按统一结构展示：rule_name / trigger_time / trigger_condition / trigger_action / output_prompt"
            />
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={<Text strong>1. rule_name（规则名称）</Text>}>
                <Text code>{rule.ruleConfig.rule_name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={<Text strong>2. trigger_time（触发时间）</Text>}>
                {rule.ruleConfig.trigger_time}
              </Descriptions.Item>
              <Descriptions.Item label={<Text strong>3. trigger_condition（触发条件）</Text>}>
                <Space direction="vertical" size={2}>
                  <Space><Text type="secondary">metric：</Text><Text code>{rule.ruleConfig.trigger_condition.metric}</Text></Space>
                  <Space><Text type="secondary">operator：</Text><Text code>{rule.ruleConfig.trigger_condition.operator}</Text></Space>
                  <Space><Text type="secondary">threshold：</Text><Text code>{rule.ruleConfig.trigger_condition.threshold}{rule.ruleConfig.trigger_condition.thresholdUnit}</Text></Space>
                  <Space><Text type="secondary">sustain_duration：</Text><Text code>{rule.ruleConfig.trigger_condition.sustainDuration}</Text></Space>
                  <Divider style={{ margin: '6px 0' }} />
                  <Text type="secondary">示例：</Text>
                  <Text code>{rule.ruleConfig.trigger_condition.description}</Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label={<Text strong>4. trigger_action（触发动作）</Text>}>
                <Tag color="processing">{TriggerActionLabels[rule.ruleConfig.trigger_action]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={<Text strong>5. output_prompt（输出提示词）</Text>}>
                <Card size="small" style={{ background: '#F0F5FF', borderColor: '#ADC6FF' }}>
                  <Text style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>
                    {rule.ruleConfig.output_prompt}
                  </Text>
                </Card>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card bordered={false} title={<Space><BookOutlined /><Text strong>规则内容库（四大类）</Text></Space>}
            extra={selectedContent && <Tooltip title="当前规则关联条目"><Tag color="blue" icon={<CheckOutlined />}>已关联：{selectedContent.name}</Tag></Tooltip>}>
            <Tabs
              size="small"
              activeKey={libraryTab}
              onChange={setLibraryTab}
              items={LIBRARY_TABS.map((t) => ({
                key: t.key,
                label: (
                  <Space size={6}>
                    <Tag color={
                      t.key === '业务执行' ? 'blue' :
                      t.key === '运行状态' ? 'green' :
                      t.key === '成本资源' ? 'orange' : 'red'
                    } style={{ marginRight: 0 }}>{t.key}</Tag>
                    <span>{mockAlertRuleLibrary.filter((c) => c.category === t.key).length} 条</span>
                  </Space>
                ),
              }))}
            />
            <List
              size="small"
              dataSource={tabLibrary}
              style={{ maxHeight: 240, overflowY: 'auto', marginTop: 4 }}
              locale={{ emptyText: <Empty description="该类目下暂无模板" /> }}
              renderItem={(c) => {
                const isCurrent = c.id === rule.ruleContentId;
                return (
                  <List.Item
                    style={{
                      padding: '8px 12px',
                      background: isCurrent ? '#E6F4FF' : 'transparent',
                      border: isCurrent ? '1px solid #91CAFF' : '1px solid transparent',
                      borderRadius: 6,
                    }}
                  >
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      <Space>
                        {isCurrent && <Tag color="processing" icon={<CheckOutlined />}>当前</Tag>}
                        <Text style={{ fontSize: 13 }} strong={isCurrent}>{c.name}</Text>
                      </Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>触发条件：{c.condition}</Text>
                    </Space>
                  </List.Item>
                );
              }}
            />
          </Card>
        </Space>
      </Row>
    </div>
  );
};

export default RuleDetail;
