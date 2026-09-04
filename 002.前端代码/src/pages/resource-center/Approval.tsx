/**
 * 医院资源管理中心 - 3.3 权限审批页（仅信息科管理员）
 * 规范:医院资源管理中心-需求说明文档V1.1 §3.3
 *   - 三部分:权限申请信息 / 审核结论 / 具体说明(单一 Form 实例)
 *   - 操作:编辑 / 审核通过 / 退回修改
 *   - 审核结论:单选(审核通过 / 退回修改),必填
 *   - 具体说明:多行文本,≤500 字;退回时必填,通过时选填
 *   - 条件必填通过 Form.useWatch 驱动
 *   - 审核动作通过共享 store 写入,跨页面状态同步
 *   - 真实编辑态:进入编辑后可修改申请资源,保存后追加 trail「编辑」节点
 *   - 仅信息科管理员可见(V1.1 §1.4 / §3.3)
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Radio,
  Form,
  Input,
  Button,
  Space,
  message,
  Modal,
  Tag,
  Typography,
  Tooltip,
  Steps,
  Result,
  Select,
} from 'antd';
import {
  CheckOutlined,
  RollbackOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import {
  useApplies,
  useResources,
  useCurrentUser,
  useDemoRole,
  updateApply,
  nowAt,
  APPLY_STATUS_LABEL,
  APPLY_STATUS_COLOR,
  PROTOCOL_LABEL,
  PROTOCOL_COLOR,
  truncate,
  getReviewer,
  getReviewTime,
  ROLE_LABEL,
  type ApplyItem,
  type ProtocolType,
} from '../../mock/resource-center';
import { useSmartDraft } from '../agent-center/smart/store';

const { Text } = Typography;
const { TextArea } = Input;

const Approval = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [form] = Form.useForm();
  const applies = useApplies();
  const resources = useResources();
  const current = useCurrentUser();
  // V1.2:resource-center mock 内置 demoRole 为英文枚举 'admin' | 'user'(与 useDemoSettings 的中文枚举是两套独立 store)
  const isAdmin = useDemoRole() === 'admin';
  const { pushWelcomeGreeting, consumeWelcome } = useSmartDraft();

  const it: ApplyItem | undefined = applies.find((a) => a.id === id);
  const resource = resources.find((item) => item.id === it?.resourceId);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!isAdmin || !it) return undefined;
    const missingTechnicalFields = resource
      ? resource.protocolConfig.fields.filter((field) => !field.value?.trim()).length
      : 1;
    const problemCount = missingTechnicalFields + (it.reason?.trim() ? 0 : 1);
    const verdict = problemCount === 0 ? '建议通过' : '建议退回修改';
    const resourceName = it.resourceName || resource?.resources.join('/') || it.resourceId;
    pushWelcomeGreeting('resource-approval', 'admin', () => [problemCount, verdict], {
      windowReplacements: [resourceName],
      actions: [
        { key: 'approve-resource-apply', label: '审核通过', event: 'resource-approval-approve', enabled: true },
        { key: 'reject-resource-apply', label: '退回修改', event: 'resource-approval-reject', enabled: true },
      ],
    });
    return () => consumeWelcome();
  }, [consumeWelcome, isAdmin, it, pushWelcomeGreeting, resource]);

  /**
   * PRD §2.1.3 → §2.1.4 状态推进:
   * 管理员进入审批页即视为「开始审核」,将状态从「待审核」推进到「审核中」,
   * 避免申请永远停留在 pending,导致「审核中」Tab 看不到。
   * 仅在 pending → reviewing 单向推进,其他状态不改变。
   */
  useEffect(() => {
    if (!it) return;
    if (it.status !== 'pending') return;
    updateApply(it.id, {
      status: 'reviewing',
      reviewingAt: nowAt(),
      appendTrail: { action: '开始审核', operator: current.name, at: nowAt(), status: 'process', targetStatus: 'reviewing' },
    });
    // 仅在挂载 + 目标记录 id 变化时触发一次,避免每次 renders 都重写
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [it?.id, it?.status]);

  // V1.1 §3.3:仅信息科管理员可见
  if (!isAdmin) {
    return (
      <Result
        status="403"
        title="权限不足"
        subTitle="权限审批页仅对信息科管理员开放;如需查看申请详情,请返回「申请管理」-「查看详情」。"
        extra={<Button type="primary" onClick={() => navigate('/app/resource-center/applies')}>返回申请管理</Button>}
      />
    );
  }

  // 单一 Form 实例监听审核结论
  const conclusion = Form.useWatch('conclusion', form);

  if (!it) {
    return (
      <Result
        status="404"
        title="申请不存在"
        subTitle={`未找到申请 ${id},可能已被删除或归档`}
        extra={<Button type="primary" onClick={() => navigate('/app/resource-center/applies')}>返回申请管理</Button>}
      />
    );
  }

  /** 真实编辑态:进入编辑后可修改申请资源 */
  const handleEdit = () => {
    form.setFieldsValue({ resourceId: it.resourceId });
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    try {
      const v = await form.validateFields(['resourceId']);
      updateApply(it.id, {
        resourceId: v.resourceId,
        resourceName: resources.find((r) => r.id === v.resourceId)?.resources.join('/') || it.resourceName,
        appendTrail: { action: '编辑', operator: current.name, at: nowAt(), comment: `申请资源由 ${it.resourceName} 变更为 ${resources.find((r) => r.id === v.resourceId)?.resources.join('/')}`, status: 'process', targetStatus: it.status },
      });
      setEditing(false);
      message.success('已保存修改,记录已写入审批轨迹');
    } catch {
      message.error('请选择有效的申请资源');
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    form.resetFields(['resourceId']);
  };

  /** 统一提交:依据审核结论(conclusion)走「审核通过」或「退回修改」分支 */
  const handleSubmit = async () => {
    try {
      const vals = await form.validateFields();
      if (!vals.conclusion) {
        message.warning('请先选择「审核结论」');
        return;
      }
      if (vals.conclusion === 'rejected' && (!vals.comment || vals.comment.trim() === '')) {
        message.error('退回修改时,「具体说明」为必填项,请详细说明退回原因');
        return;
      }

      if (vals.conclusion === 'approved') {
        Modal.confirm({
          title: '确认审核通过?',
          content: `申请 ${it.id} 审核通过后,资源对接关系将自动同步至台账详情页「已对接资源列表」。该操作不可逆。`,
          okText: '确认通过',
          cancelText: '取消',
          onOk: () => {
            updateApply(it.id, {
              status: 'approved',
              approvedAt: nowAt(),
              approveComment: vals.comment,
              rejectReason: undefined,
              appendTrail: { action: '审核通过', operator: current.name, at: nowAt(), comment: vals.comment || '权限范围合理,审核通过', status: 'finish', targetStatus: 'approved' },
            });
            message.success('已审核通过,资源对接关系已同步台账');
            setTimeout(() => navigate('/app/resource-center/applies?tab=approved'), 600);
          },
        });
        return;
      }

      // 退回修改分支
      Modal.confirm({
        title: '确认退回修改?',
        content: '退回后申请将进入「退回修改」Tab,申请人修改后可重新提交审核。',
        okText: '确认退回',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => {
          updateApply(it.id, {
            status: 'rejected',
            rejectedAt: nowAt(),
            rejectReason: vals.comment,
            approveComment: undefined,
            appendTrail: { action: '退回修改', operator: current.name, at: nowAt(), comment: vals.comment, status: 'error', targetStatus: 'rejected' },
          });
          message.success('已退回修改,记录进入「退回修改」Tab');
          setTimeout(() => navigate('/app/resource-center/applies?tab=rejected'), 600);
        },
      });
    } catch {
      message.error('请检查表单');
    }
  };

  useEffect(() => {
    if (!isAdmin || !it) return undefined;
    const onApprove = () => {
      form.setFieldsValue({ conclusion: 'approved', comment: '医小管预审：资源信息与技术配置完整，访问测试通过；最终结论由审核人确认。' });
      window.setTimeout(() => void handleSubmit(), 0);
    };
    const onReject = () => {
      form.setFieldsValue({ conclusion: 'rejected', comment: '医小管预审发现资源申请信息或技术配置存在疑似问题，请申请人核对并补充后重新提交。' });
      window.setTimeout(() => void handleSubmit(), 0);
    };
    window.addEventListener('resource-approval-approve', onApprove);
    window.addEventListener('resource-approval-reject', onReject);
    return () => {
      window.removeEventListener('resource-approval-approve', onApprove);
      window.removeEventListener('resource-approval-reject', onReject);
    };
  });

  // 状态标签
  const reviewer = getReviewer(it, it.status === 'archived' ? 'rejected' : (it.status as 'approved' | 'rejected' | 'reviewing'));
  const reviewTime = getReviewTime(it, it.status === 'archived' ? 'rejected' : (it.status as 'approved' | 'rejected' | 'reviewing'));

  return (
    <>
      <PageHeader
        title={`权限审批 - ${it.id}`}
        subTitle="信息科管理员对权限申请进行审核,可编辑申请信息、审核通过或退回修改"
        showBack
        onBack={() => navigate('/app/resource-center/applies')}
        breadcrumb={[
          { path: '/app/resource-center', breadcrumbName: '医院资源管理中心' },
          { path: '/app/resource-center/applies', breadcrumbName: '申请管理' },
          { path: `/app/resource-center/approval/${it.id}`, breadcrumbName: '权限审批' },
        ]}
      />

      <Card
        title="① 权限申请信息"
        bordered={false}
        style={{ marginBottom: 16 }}
        extra={
          editing ? (
            <Space>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveEdit}>保存修改</Button>
              <Button icon={<CloseOutlined />} onClick={handleCancelEdit}>取消</Button>
            </Space>
          ) : (
            <Button icon={<EditOutlined />} onClick={handleEdit}>编辑</Button>
          )
        }
      >
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
            {editing ? (
              <Form.Item name="resourceId" noStyle rules={[{ required: true, message: '请选择申请资源' }]}>
                <Select
                  style={{ width: 360 }}
                  options={resources.map((r) => ({
                    value: r.id,
                    label: `${r.id} - ${r.resources.join('/')}`,
                  }))}
                />
              </Form.Item>
            ) : (
              <Space>
                <Tag color="blue">{it.resourceId}</Tag>
                <Text>{it.resourceName}</Text>
              </Space>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="申请人">{it.applicant}</Descriptions.Item>
          <Descriptions.Item label="提交审核时间">{it.submittedAt}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="② 审核结论" bordered={false} style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical">
          <Form.Item
            name="conclusion"
            label="审核结论"
            extra="单选,必填;选择不同结论联动下方「具体说明」提示文案"
            rules={[{ required: true, message: '请选择审核结论' }]}
          >
            <Radio.Group>
              <Radio.Button value="approved"><CheckOutlined /> 审核通过</Radio.Button>
              <Radio.Button value="rejected"><RollbackOutlined /> 退回修改</Radio.Button>
            </Radio.Group>
          </Form.Item>
        </Form>
      </Card>

      <Card title="③ 具体说明" bordered={false} style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical">
          <Form.Item
            name="comment"
            label="具体说明"
            extra={
              conclusion === 'rejected'
                ? '退回修改时,具体说明为必填,需详细说明退回原因(≤500 字)'
                : conclusion === 'approved'
                ? '审核通过时选填,可填写补充意见(≤500 字)'
                : '请先在上方选择审核结论'
            }
            rules={[
              { max: 500, message: '不超过 500 字' },
              {
                validator: (_, v) => (conclusion === 'rejected' && (!v || v.trim() === '') ? Promise.reject('退回修改时必填') : Promise.resolve()),
              },
            ]}
          >
            <TextArea
              rows={5}
              showCount
              maxLength={500}
              placeholder={
                conclusion === 'rejected'
                  ? '请详细说明退回原因,如:申请范围超出 XX 场景,建议精简为…'
                  : '可填写补充意见,如:权限范围合理,允许访问 XX 接口/数据范围。'
              }
            />
          </Form.Item>
        </Form>
      </Card>

      <Card title={<Space><HistoryOutlined />审批轨迹</Space>} bordered={false} style={{ marginBottom: 16 }}>
        {it.trail.length === 0 ? (
          <Text type="secondary">该申请暂无审批轨迹(草稿状态)</Text>
        ) : (
          <Steps
            direction="vertical"
            size="small"
            items={it.trail.map((t) => ({
              title: t.action,
              description: (
                <Space direction="vertical" size={2}>
                  <Text>{t.operator} · {t.at}</Text>
                  {t.comment && <Text type="secondary">意见:{t.comment}</Text>}
                </Space>
              ),
              status: t.status || 'process',
            }))}
          />
        )}
      </Card>

      <Card bordered={false}>
        <Space wrap>
          <Button
            type="primary"
            icon={conclusion === 'rejected' ? <RollbackOutlined /> : <CheckOutlined />}
            danger={conclusion === 'rejected'}
            onClick={handleSubmit}
          >
            提交
          </Button>
          <Button onClick={() => navigate('/app/resource-center/applies')}>返回</Button>
        </Space>
      </Card>
    </>
  );
};

export default Approval;
