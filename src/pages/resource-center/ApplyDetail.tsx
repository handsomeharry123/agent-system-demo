/**
 * 医院资源管理中心 - 3.4 权限申请详情页(只读)
 * 规范:医院资源管理中心-需求说明文档V1.1 §3.4
 *   - 展示申请的完整信息与审批轨迹
 *   - 三部分:权限申请信息 / 审核结论 / 具体说明
 *   - 操作:返回(回到原 Tab)
 *   - 含审批轨迹时间轴 + 审核人 + 审核意见 + 生效资源权限明细(若审核通过)
 *   - V1.1 §3:所有角色可见;但数据范围按 §3.1 隔离(本页面打开的 ID 一定在当前演示账号可见范围内)
 */
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Button,
  Space,
  Tag,
  Typography,
  Steps,
  Result,
  Alert,
  Tooltip,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import {
  useApplies,
  useResources,
  APPLY_STATUS_LABEL,
  APPLY_STATUS_COLOR,
  PROTOCOL_LABEL,
  PROTOCOL_COLOR,
  truncate,
  getReviewer,
  getReviewTime,
  type ApplyItem,
  type ProtocolType,
} from '../../mock/resource-center';
import { useSmartDraft } from '../agent-center/smart/store';

const { Text } = Typography;

const TRAIL_NODE_META: Record<ApplyItem['trail'][number]['action'], {
  title: string;
  timeLabel: string;
  operatorLabel: string;
}> = {
  提交: { title: '提交审核', timeLabel: '提交审核时间', operatorLabel: '提交人' },
  重新提交: { title: '重新注册提交审核', timeLabel: '提交审核时间', operatorLabel: '提交人' },
  开始审核: { title: '审核中', timeLabel: '开始审核时间', operatorLabel: '审核人' },
  审核通过: { title: '审核通过', timeLabel: '审核完成时间', operatorLabel: '审核人' },
  退回修改: { title: '退回修改', timeLabel: '审核完成时间', operatorLabel: '审核人' },
  撤销: { title: '撤销修改', timeLabel: '撤销时间', operatorLabel: '操作人' },
  自动归档: { title: '自动归档', timeLabel: '归档时间', operatorLabel: '操作人' },
  编辑: { title: '编辑', timeLabel: '编辑时间', operatorLabel: '操作人' },
};

const ApplyDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const applies = useApplies();
  const resources = useResources();
  const it: ApplyItem | undefined = applies.find((a) => a.id === id);
  const { pushWelcomeGreeting, consumeWelcome } = useSmartDraft();
  const resource = resources.find((r) => r.id === it?.resourceId);

  useEffect(() => {
    if (!it) return undefined;
    const resourceDisplayName = it.resourceName || resource?.resources.join('/') || it.resourceId;
    const replacements = [resourceDisplayName];
    pushWelcomeGreeting('resource-apply-detail', 'provider', () => replacements, {
      windowReplacements: replacements,
    });
    (window as any).__resourceApplyDetailContext = {
      applicationId: it.id,
      applicationStatus: APPLY_STATUS_LABEL[it.status],
      resourceId: it.resourceId,
      resourceName: resourceDisplayName,
      owner: resource?.owner || '',
      contact: resource?.contact || '',
      protocol: resource ? PROTOCOL_LABEL[resource.protocol as ProtocolType] : '',
      technicalFields: resource?.protocolConfig.fields.map((field) => `${field.label}：${field.value}`).join('；') || '',
      agentId: it.agentId,
      agentName: it.agentName,
      department: it.department,
      applicant: it.applicant,
      reason: it.reason || '',
      reviewComment: it.approveComment || it.rejectReason || '',
    };
    return () => {
      delete (window as any).__resourceApplyDetailContext;
      consumeWelcome();
    };
  }, [consumeWelcome, it, pushWelcomeGreeting, resource]);

  // 按当前申请状态返回对应 Tab（撤销 → 「撤销修改」/草稿 → 「草稿」/退回 → 「退回修改」等）
  const backToList = (item?: ApplyItem) => {
    if (!item) {
      navigate('/app/resource-center/applies');
      return;
    }
    navigate(`/app/resource-center/applies?tab=${item.status}`);
  };

  if (!it) {
    return (
      <Result
        status="404"
        title="申请不存在"
        subTitle={`未找到申请 ${id},可能已被删除或归档`}
        extra={<Button type="primary" onClick={() => backToList()}>返回申请管理</Button>}
      />
    );
  }

  const isApproved = it.status === 'approved';

  // 审核人/时间(按目标状态精确匹配;archived 状态回退到 rejected)
  const reviewer = it.status === 'approved' ? getReviewer(it, 'approved')
    : it.status === 'rejected' ? getReviewer(it, 'rejected')
    : it.status === 'archived' ? getReviewer(it, 'archived')
    : it.status === 'reviewing' ? getReviewer(it, 'reviewing')
    : '-';
  const reviewTime = it.status === 'approved' ? getReviewTime(it, 'approved')
    : it.status === 'rejected' ? getReviewTime(it, 'rejected')
    : it.status === 'archived' ? getReviewTime(it, 'archived')
    : it.status === 'reviewing' ? getReviewTime(it, 'reviewing')
    : '-';

  return (
    <>
      <PageHeader
        title={`申请详情 - ${it.id}`}
        subTitle="完整展示申请信息与审批轨迹(只读)"
        showBack
        onBack={() => backToList(it)}
        breadcrumb={[
          { path: '/app/resource-center', breadcrumbName: '医院资源管理中心' },
          { path: '/app/resource-center/applies', breadcrumbName: '申请管理' },
          { path: `/app/resource-center/applies/${it.id}`, breadcrumbName: '申请详情' },
        ]}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => backToList(it)}>返回</Button>
        }
      />

      {isApproved && (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          message="该申请已审核通过,资源权限已生效"
          description="资源对接关系已自动同步至台账详情页「已对接资源列表」Tab。"
          style={{ marginBottom: 16 }}
        />
      )}

      {it.status === 'archived' && (
        <Alert
          type="info"
          showIcon
          message="该申请已自动归档(退回修改超过 30 天未重新提交)"
          description="审批轨迹完整保留可在本页查看,记录仅可在「全部申请」Tab 查询。"
          style={{ marginBottom: 16 }}
        />
      )}

      <Card title="① 权限申请信息" bordered={false} style={{ marginBottom: 16 }}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="申请 ID">{it.id}</Descriptions.Item>
          <Descriptions.Item label="申请状态">
            <Tag color={APPLY_STATUS_COLOR[it.status]}>{APPLY_STATUS_LABEL[it.status]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="智能体编号">{it.agentId}</Descriptions.Item>
          <Descriptions.Item label="智能体名称">
            <Tooltip title={it.agentName}>{truncate(it.agentName, 10)}</Tooltip>
          </Descriptions.Item>
          <Descriptions.Item label="所属科室">{it.department}</Descriptions.Item>
          <Descriptions.Item label="诊疗环节">{it.stage}</Descriptions.Item>
          <Descriptions.Item label="功能描述" span={2}>
            <Tooltip title={it.description}>
              <Text type="secondary">{truncate(it.description, 20)}</Text>
            </Tooltip>
          </Descriptions.Item>
          <Descriptions.Item label="申请资源名称" span={2}>
            <Space>
              <Tag color="blue">{it.resourceId}</Tag>
              <Text>{it.resourceName}</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="申请人">{it.applicant}</Descriptions.Item>
          <Descriptions.Item label="提交审核时间">{it.submittedAt}</Descriptions.Item>
          <Descriptions.Item label="申请账号" span={2}>
            <Tag color="default">{it.applicantAccount}</Tag>
            <Text type="secondary" style={{ marginLeft: 8 }}>
              V1.1 §3.1 数据隔离依据：信息科管理员可查看任意账号的申请,科室管理员仅可见本人提交
            </Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="② 审核结论" bordered={false} style={{ marginBottom: 16 }}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="审核结论">
            {it.status === 'approved' && <Tag color="success" icon={<CheckCircleOutlined />}>审核通过</Tag>}
            {it.status === 'rejected' && <Tag color="warning" icon={<CloseCircleOutlined />}>退回修改</Tag>}
            {it.status === 'archived' && <Tag color="warning" icon={<CloseCircleOutlined />}>已归档(原结论:退回修改)</Tag>}
            {it.status === 'pending' && <Tag color="gold">待审核</Tag>}
            {it.status === 'reviewing' && <Tag color="processing">审核中</Tag>}
            {it.status === 'draft' && <Tag>草稿</Tag>}
            {it.status === 'revoked' && <Tag>已撤销</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="审核人">
            {reviewer}
          </Descriptions.Item>
          <Descriptions.Item label="审核时间">{reviewTime}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="③ 具体说明" bordered={false} style={{ marginBottom: 16 }}>
        <Typography.Paragraph>
          {it.approveComment || it.rejectReason || <Text type="secondary">暂无说明</Text>}
        </Typography.Paragraph>
        {it.status === 'rejected' && it.rejectReason && (
          <Alert type="warning" showIcon message="退回原因" description={it.rejectReason} />
        )}
      </Card>

      {isApproved && resource && (
        <Card title="生效资源权限明细" bordered={false} style={{ marginBottom: 16 }}>
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="资源 ID">{resource.id}</Descriptions.Item>
            <Descriptions.Item label="资源列表">
              <Space size={4} wrap>
                {resource.resources.map((r) => <Tag key={r} color="blue">{r}</Tag>)}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="资源负责人">{resource.owner}</Descriptions.Item>
            <Descriptions.Item label="联系方式">{resource.contact}</Descriptions.Item>
            <Descriptions.Item label="对接方式" span={2}>
              <Tag color={PROTOCOL_COLOR[resource.protocol as ProtocolType]}>
                {PROTOCOL_LABEL[resource.protocol as ProtocolType]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="生效时间" span={2}>{it.approvedAt}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <Card title={<Space><HistoryOutlined />审批时间线</Space>} bordered={false}>
        {it.trail.length === 0 ? (
          <Text type="secondary">该申请暂无审批轨迹(草稿状态)</Text>
        ) : (
          <Steps
            direction="vertical"
            size="small"
            items={it.trail.map((t) => {
              const meta = TRAIL_NODE_META[t.action];
              const isReviewResult = t.action === '审核通过' || t.action === '退回修改';
              return {
                title: meta.title,
                description: (
                  <Space direction="vertical" size={2}>
                    <Text><Text strong>{meta.timeLabel}：</Text>{t.at}</Text>
                    <Text><Text strong>{meta.operatorLabel}：</Text>{t.operator}</Text>
                    {isReviewResult && (
                      <Text type="secondary">
                        <Text strong>具体说明：</Text>{t.comment || '暂无说明'}
                      </Text>
                    )}
                    {!isReviewResult && t.comment && <Text type="secondary">说明：{t.comment}</Text>}
                  </Space>
                ),
                status: t.status || 'process',
              };
            })}
          />
        )}
      </Card>
    </>
  );
};

export default ApplyDetail;
