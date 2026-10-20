import { useMemo, useState } from 'react';
import { Button, Checkbox, Modal, Space, Table, Tag, Typography, message, Select, Divider } from 'antd';
import { ApiOutlined, DeleteOutlined, EditOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import PageHeader from '../../components/PageHeader';
import { models as seed, type ModelConfig } from './data';

const { Text } = Typography;
const SETTINGS_KEY = 'system-model-settings';
type SystemModelSettings = { doctorModelIds: string[]; judgeModelId?: string };

function readSettings(available: ModelConfig[]): SystemModelSettings {
  const fallback = { doctorModelIds: available[0] ? [available[0].id] : [], judgeModelId: available[0]?.id };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null') as SystemModelSettings | null;
    if (!saved) return fallback;
    const validIds = new Set(available.map(model => model.id));
    const doctorModelIds = (saved.doctorModelIds || []).filter(id => validIds.has(id));
    const judgeModelId = saved.judgeModelId && validIds.has(saved.judgeModelId) ? saved.judgeModelId : fallback.judgeModelId;
    return { doctorModelIds: doctorModelIds.length ? doctorModelIds : fallback.doctorModelIds, judgeModelId };
  } catch {
    return fallback;
  }
}

export default function ModelList() {
  const nav = useNavigate();
  const [rows, setRows] = useState(seed);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<SystemModelSettings>(() => readSettings(seed));
  const [draft, setDraft] = useState<SystemModelSettings>(settings);
  const [judgeSearch, setJudgeSearch] = useState('');
  const [doctorDropdownOpen, setDoctorDropdownOpen] = useState(false);
  const options = useMemo(() => rows.map(model => ({ value: model.id, label: model.name })), [rows]);

  const openSettings = () => {
    const current = readSettings(rows);
    setSettings(current);
    setDraft(current);
    setSettingsOpen(true);
  };
  const saveSettings = () => {
    if (!draft.doctorModelIds.length || !draft.judgeModelId) {
      message.warning('请完成医小管模型和评测裁判模型配置');
      return;
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(draft));
    setSettings(draft);
    setSettingsOpen(false);
    message.success('系统模型设置已保存');
  };
  const test = (r: ModelConfig) => {
    message.loading({ content: '正在验证 API 地址与鉴权信息…', key: 'test', duration: .8 });
    setTimeout(() => Modal.success({ title: '测试验证正常', content: `${r.name} 联通成功，模型服务响应正常。` }), 850);
  };
  const cols: ColumnsType<ModelConfig> = [
    { title: '模型名称', dataIndex: 'name', width: 150 },
    { title: '模型版本号', dataIndex: 'version', width: 140 },
    { title: '部署方式', dataIndex: 'deployment', width: 130, render: v => <Tag color="blue">{v}</Tag> },
    { title: 'API地址', dataIndex: 'apiUrl', ellipsis: true, width: 260 },
    { title: 'API key', dataIndex: 'apiKey', width: 150, render: v => <Text>••••••••{v.slice(-4)}</Text> },
    { title: '提供方', dataIndex: 'provider', width: 100 },
    { title: '联系方式', dataIndex: 'phone', width: 140 },
    { title: '其他说明', dataIndex: 'remark', ellipsis: true },
    { title: '操作', fixed: 'right', width: 280, render: (_, r) => <Space size={0} wrap={false}>
      <Button type="link" style={{ paddingInline: 8 }} icon={<ApiOutlined />} onClick={() => test(r)}>测试联通</Button>
      <Button type="link" style={{ paddingInline: 8 }} icon={<EditOutlined />} onClick={() => nav(`/app/system-config/models/${r.id}/edit`)}>编辑</Button>
      <Button danger type="link" style={{ paddingInline: 8 }} icon={<DeleteOutlined />} onClick={() => Modal.confirm({ title: '确认是否删除？', content: `将删除模型「${r.name}」`, onOk: () => {
        const next = rows.filter(y => y.id !== r.id);
        setRows(next);
        const validIds = new Set(next.map(item => item.id));
        const normalized = { doctorModelIds: settings.doctorModelIds.filter(id => validIds.has(id)), judgeModelId: settings.judgeModelId && validIds.has(settings.judgeModelId) ? settings.judgeModelId : next[0]?.id };
        if (!normalized.doctorModelIds.length && next[0]) normalized.doctorModelIds = [next[0].id];
        setSettings(normalized);
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
      } })}>删除</Button>
    </Space> },
  ];

  return <div style={{ padding: 24, background: '#f5f7fa', minHeight: '100%' }}>
    <PageHeader title="模型配置" subTitle="登记、测试并接入平台可调用的大模型资源" breadcrumb={[{ path: '', breadcrumbName: '系统配置' }, { path: '', breadcrumbName: '模型配置' }]} extra={<Space>
      <Button icon={<SettingOutlined />} onClick={openSettings}>系统模型设置</Button>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => nav('/app/system-config/models/create')}>添加模型</Button>
    </Space>} />
    <div style={{ marginTop: 16, padding: 16, background: '#fff', borderRadius: 8 }}><Table rowKey="id" columns={cols} dataSource={rows} scroll={{ x: 1420 }} /></div>
    <Modal title="系统模型设置" open={settingsOpen} onCancel={() => setSettingsOpen(false)} onOk={saveSettings} okText="保存" cancelText="取消" destroyOnClose>
      <div style={{ paddingTop: 8 }}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>医小管模型</div>
        <Select
          mode="multiple"
          showSearch
          optionFilterProp="label"
          value={draft.doctorModelIds}
          options={options}
          open={doctorDropdownOpen}
          onDropdownVisibleChange={setDoctorDropdownOpen}
          onChange={doctorModelIds => setDraft(current => ({ ...current, doctorModelIds }))}
          placeholder="请选择医小管模型"
          style={{ width: '100%' }}
          maxTagCount="responsive"
          dropdownRender={menu => <>
            <Space style={{ padding: '4px 12px 8px' }} size={12}>
              <Button type="link" size="small" style={{ padding: 0 }} onMouseDown={event => event.preventDefault()} onClick={() => setDraft(current => ({ ...current, doctorModelIds: rows.map(model => model.id) }))}>全选</Button>
              <Button type="link" size="small" style={{ padding: 0 }} onMouseDown={event => event.preventDefault()} onClick={() => setDraft(current => ({ ...current, doctorModelIds: rows.filter(model => !current.doctorModelIds.includes(model.id)).map(model => model.id) }))}>反选</Button>
              <Text type="secondary">已选 {draft.doctorModelIds.length}/{rows.length}</Text>
            </Space>
            <Divider style={{ margin: 0 }} />
            {menu}
          </>}
        />
        <Divider style={{ margin: '0 0 18px' }} />
        <div style={{ marginBottom: 8, fontWeight: 600 }}>评测裁判模型</div>
        <Select showSearch optionFilterProp="label" value={draft.judgeModelId} options={options} onChange={judgeModelId => setDraft(current => ({ ...current, judgeModelId }))} onSearch={setJudgeSearch} onBlur={() => setJudgeSearch('')} searchValue={judgeSearch} placeholder="搜索并选择评测裁判模型" style={{ width: '100%' }} notFoundContent="没有匹配的模型" />
      </div>
    </Modal>
  </div>;
}
