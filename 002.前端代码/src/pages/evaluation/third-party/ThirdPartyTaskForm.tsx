import { useEffect } from 'react';
import { Button, Card, Descriptions, Form, Select, Space, Tag, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { useSmartDraft } from '../../agent-center/smart/store';
import { specFor } from './platforms';

export default function ThirdPartyTaskForm() {
  const { platformKey } = useParams();
  const platform = specFor(platformKey);
  const navigate = useNavigate();
  const { pushWelcomeGreeting, consumeWelcome } = useSmartDraft();

  useEffect(() => {
    const pageKey = platform.key === 'medagentbench' ? 'medagentbench-evaluation-create' : 'cp-env-evaluation-create';
    pushWelcomeGreeting(pageKey, 'admin', () => [1, 2, 1], {
      windowReplacements: [1, 2, 1],
      chips: [
        { key: `${platform.key}-create-evaluating`, label: '评测中 1', targetTab: '评测中', tone: 'warning' },
        { key: `${platform.key}-create-passed`, label: '评测通过 2', targetTab: '评测通过', tone: 'success' },
        { key: `${platform.key}-create-returned`, label: '退回修改 1', targetTab: '退回修改', tone: 'error' },
      ],
    });
    const jump = (event: Event) => navigate(`/app/evaluation/tasks?module=${platform.key}&tab=${encodeURIComponent((event as CustomEvent<string>).detail)}`);
    window.addEventListener('agent-jump-tab', jump);
    return () => { window.removeEventListener('agent-jump-tab', jump); consumeWelcome(); };
  }, [consumeWelcome, navigate, platform.key, pushWelcomeGreeting]);

  const back = (notice: string) => { message.success(notice); navigate(`/app/evaluation/tasks?module=${platform.key}`); };
  return <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100%' }}>
    <PageHeader title={`新建${platform.name}任务`} subTitle="选择参评智能体并确认评测信息" showBack onBack={() => back('已自动保存为草稿')} />
    <Card title="参评智能体" style={{ marginTop: 16 }}><Form layout="vertical" style={{ maxWidth: 720 }} initialValues={{ agent: 'AG-0001', version: platform.versions[0] }}><Form.Item name="agent" label="智能体编号 / 名称" rules={[{ required: true }]}><Select options={[{ value: 'AG-0001', label: 'AG-0001 · 超声检查预约助手' }, { value: 'AG-0002', label: 'AG-0002 · CT影像智能分析平台' }, { value: 'AG-0003', label: 'AG-0003 · 处方智能审核助手' }]} /></Form.Item><Form.Item name="version" label="智能体版本" rules={[{ required: true }]}><Select options={platform.versions.map(value => ({ value, label: value }))} /></Form.Item></Form></Card>
    <Card title="评测信息" style={{ marginTop: 16 }}><Descriptions column={1} bordered><Descriptions.Item label="评测平台">{platform.name}</Descriptions.Item><Descriptions.Item label="评测维度"><Space wrap>{platform.dimensions.map(item => <Tag key={item}>{item}</Tag>)}</Space></Descriptions.Item></Descriptions></Card>
    <Card style={{ marginTop: 16 }}><Space><Button onClick={() => back('已暂存至草稿')}>暂存</Button><Button type="primary" onClick={() => back('评测任务已开始，可在“评测中”查看')}>开始评测</Button><Button onClick={() => navigate(-1)}>返回</Button></Space></Card>
  </div>;
}
