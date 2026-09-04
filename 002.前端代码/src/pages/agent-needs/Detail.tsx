/**
 * 智能体建设需求管理 - 需求详情页（1.4）
 *
 * 展示已提交需求的完整字段与最新一次智能化匹配结果；只读态。
 *   - 返回：回到上一页（需求管理页或草稿页）
 *   - 匹配结果内点击某智能体 → 跳该智能体 360 画像视图
 *     （复用台账列表 ?search=&openDetail=1，命中后自动打开详情）
 */
import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Descriptions, Dropdown, Empty, Space, Table, Tag, Typography, message } from 'antd';
import { DownloadOutlined, EditOutlined, FileTextOutlined, ThunderboltOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { urgencyColorMap, matchAgents, buildMatchResult, type MatchItem } from './types';
import { useNeeds, patchNeed, nowStr } from './store';
import { exportNeedPdf, exportNeedWord, buildNeedDocHtml } from './docExport';
import { useSmartDraft } from '../agent-center/smart/store';

const { Text, Paragraph } = Typography;

const NeedDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const needs = useNeeds();
  const need = useMemo(() => needs.find((n) => n.id === id), [needs, id]);
  const { pushWelcomeGreeting, consumeWelcome } = useSmartDraft();

  useEffect(() => {
    if (!need) return undefined;
    const replacements = [
      need.title || '未命名需求',
      need.department || '--',
      need.urgency || '--',
      need.matchResult?.topScore ?? 0,
    ];
    pushWelcomeGreeting(
      'agent-needs-detail',
      'provider',
      () => replacements,
      {
        windowReplacements: replacements,
        actions: [
          {
            key: 'need-preview',
            label: '需求文档预览',
            path: `/app/agent-needs/doc/${need.id}`,
            enabled: true,
          },
          {
            key: 'need-download',
            label: '需求文档下载',
            event: 'agent-needs-download-pdf',
            enabled: true,
          },
        ],
      },
    );
    const onDownloadPdf = async () => {
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:-9999px;top:0;background:#fff;';
      host.innerHTML = buildNeedDocHtml(need);
      document.body.appendChild(host);
      try {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
        const target = host.querySelector<HTMLElement>('.need-doc') || host;
        await exportNeedPdf(target, `需求文档-${need.title}`);
        message.success('已导出 PDF 文档');
      } finally {
        document.body.removeChild(host);
      }
    };
    window.addEventListener('agent-needs-download-pdf', onDownloadPdf);
    return () => {
      window.removeEventListener('agent-needs-download-pdf', onDownloadPdf);
      consumeWelcome();
    };
  }, [consumeWelcome, need, pushWelcomeGreeting]);

  if (!need) {
    return (
      <div style={{ padding: 0 }}>
        <PageHeader title="需求详情" showBack onBack={() => navigate('/app/agent-needs')} />
        <Card style={{ marginTop: 12 }}>
          <Empty description="未找到该需求记录" />
        </Card>
      </div>
    );
  }

  const stageText =
    need.clinicalStage === '其他' && need.clinicalStageOther
      ? `其他（${need.clinicalStageOther}）`
      : need.clinicalStage;

  const goAgent360 = (m: MatchItem) =>
    navigate(`/app/ledger/list?search=${encodeURIComponent(m.agentName)}&openDetail=1`);

  const downloadWord = () => {
    exportNeedWord(need, `需求文档-${need.title}`);
    message.success('已导出 Word 文档');
  };
  const downloadPdf = async () => {
    // 离屏渲染文档 HTML → 截图导出（无需进入预览页）
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-9999px;top:0;background:#fff;';
    host.innerHTML = buildNeedDocHtml(need);
    document.body.appendChild(host);
    try {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const target = host.querySelector<HTMLElement>('.need-doc') || host;
      await exportNeedPdf(target, `需求文档-${need.title}`);
      message.success('已导出 PDF 文档');
    } finally {
      document.body.removeChild(host);
    }
  };

  const doMatch = () => {
    const top = matchAgents(need);
    patchNeed(need.id, { matchResult: top.length ? buildMatchResult(top, nowStr(0)) : undefined });
    if (top.length) message.success(`已完成智能化匹配，最高匹配度 ${top[0].score}%`);
    else message.info('暂无匹配智能体');
  };

  return (
    <div style={{ padding: 0 }}>
      <PageHeader
        title={need.title || '未命名需求'}
        subTitle="需求详情"
        showBack
        onBack={() => navigate(-1)}
        extra={
          <Space>
            <Button icon={<FileTextOutlined />} onClick={() => navigate(`/app/agent-needs/doc/${need.id}`)}>
              查看需求文档
            </Button>
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'word', label: '下载 Word', onClick: downloadWord },
                  { key: 'pdf', label: '下载 PDF', onClick: downloadPdf },
                ],
              }}
            >
              <Button icon={<DownloadOutlined />}>
                下载需求文档
              </Button>
            </Dropdown>
            <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/app/agent-needs/edit/${need.id}`)}>
              编辑需求
            </Button>
          </Space>
        }
      />

      <Card style={{ marginTop: 12 }} title="需求信息">
        <Descriptions column={2} bordered size="middle">
          <Descriptions.Item label="需求标题" span={2}>
            {need.title}
          </Descriptions.Item>
          <Descriptions.Item label="提出科室">{need.department}</Descriptions.Item>
          <Descriptions.Item label="诊疗环节">{stageText}</Descriptions.Item>
          <Descriptions.Item label="提出人">{need.proposer}</Descriptions.Item>
          <Descriptions.Item label="联系方式">{need.contactPhone || '--'}</Descriptions.Item>
          <Descriptions.Item label="所需资源" span={2}>
            {need.resources && need.resources.length ? (
              <Space size={4} wrap>
                {need.resources.map((r) => (
                  <Tag key={r}>{r}</Tag>
                ))}
              </Space>
            ) : (
              '--'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="需求紧急程度">
            <Tag color={urgencyColorMap[need.urgency]}>{need.urgency}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="提出时间">{need.submitTime || need.lastUpdateTime}</Descriptions.Item>
          <Descriptions.Item label="提出原因" span={2}>
            <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{need.reason || '--'}</Paragraph>
          </Descriptions.Item>
          <Descriptions.Item label="功能描述" span={2}>
            <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{need.functionDesc || '--'}</Paragraph>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        style={{ marginTop: 12 }}
        title="智能化匹配结果（TOP3）"
        extra={
          <Button type="link" icon={<ThunderboltOutlined />} onClick={doMatch}>
            重新匹配
          </Button>
        }
      >
        {need.matchResult && need.matchResult.top.length > 0 ? (
          <>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              最近匹配时间：{need.matchResult.matchedAt}｜最高匹配度：{need.matchResult.topScore}%（点击智能体名称可查看其 360 画像）
            </Text>
            <Table
              rowKey="agentId"
              size="small"
              pagination={false}
              dataSource={need.matchResult.top}
              columns={[
                { title: '排名', key: 'rank', width: 60, render: (_v, _r, i) => i + 1 },
                { title: '智能体编号', dataIndex: 'agentCode', key: 'agentCode', width: 130 },
                {
                  title: '智能体名称',
                  dataIndex: 'agentName',
                  key: 'agentName',
                  render: (name: string, r) => (
                    <Button type="link" style={{ padding: 0, height: 'auto', textAlign: 'left' }} onClick={() => goAgent360(r)}>
                      {name}
                    </Button>
                  ),
                },
                { title: '匹配度', dataIndex: 'score', key: 'score', width: 100, render: (s: number) => <Tag color="blue">{s}%</Tag> },
              ]}
            />
          </>
        ) : (
          <Empty description="暂无匹配智能体，可点击右上角「重新匹配」" />
        )}
      </Card>
    </div>
  );
};

export default NeedDetail;
