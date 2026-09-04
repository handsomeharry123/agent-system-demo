import { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Modal, Select, Space, Spin, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { systemRoles } from './constants';
import { userCenterApi, type UserFormPayload } from '../../services/userCenter';

type FormValues = UserFormPayload;

const UserFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [departments, setDepartments] = useState<Array<{ label: string; value: number }>>([]);
  const isEditing = Boolean(id);

  useEffect(() => {
    void userCenterApi.meta().then((result) => setDepartments(result.departments)).catch((error) => {
      message.error(error instanceof Error ? error.message : '组织信息加载失败');
    });
    if (!id) {
      form.setFieldsValue({ status: '正常' });
      return;
    }
    void userCenterApi.detail(id).then((user) => {
      // 密码从不回显；空值表示本次不修改密码。
      form.setFieldsValue({ ...user, password: undefined });
    }).catch((error) => {
      setNotFound(true);
      message.error(error instanceof Error ? error.message : '用户信息加载失败');
    }).finally(() => setLoading(false));
  }, [id]);

  const persist = async (values: FormValues) => {
    const payload = { ...values, password: values.password?.trim() || undefined };
    try {
      setSaving(true);
      if (id) {
        await userCenterApi.update(id, payload);
        message.success('用户信息已更新');
      } else {
        const result = await userCenterApi.create(payload);
        Modal.success({ title: '用户新增成功', content: `初始密码：${result.initialPassword}。请安全告知用户并提醒首次登录后修改。` });
      }
      navigate('/app/user-center');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally { setSaving(false); }
  };

  const submit = async () => {
    const values = await form.validateFields();
    if (!isEditing) return void persist(values);
    Modal.confirm({ title: '确认是否保存？', content: '确认后将覆盖保存前的用户信息。', okText: '确认', cancelText: '取消', onOk: () => persist(values) });
  };

  if (notFound) return <div className="user-center-page"><PageHeader title="编辑用户" showBack onBack={() => navigate('/app/user-center')} /><Card bordered={false}>未找到该用户，请返回用户列表后重试。</Card></div>;

  return <div className="user-center-page">
    <PageHeader title={isEditing ? '用户信息编辑' : '新增用户'} subTitle={isEditing ? '修改用户基础信息、密码及角色' : '录入平台用户信息并配置角色'} showBack onBack={() => navigate('/app/user-center')} />
    <Card bordered={false} title="用户信息"><Spin spinning={loading}>
      <Form<FormValues> form={form} layout="vertical" className="user-center-form">
        <div className="user-center-form-grid">
          <Form.Item name="name" label="用户姓名" rules={[{ required: true, message: '请输入用户姓名' }, { pattern: /^[\u4e00-\u9fa5]{2,10}$/, message: '用户姓名须为 2-10 个汉字' }]}><Input placeholder="请输入用户姓名" maxLength={10} /></Form.Item>
          <Form.Item name="employeeId" label="用户工号" rules={[{ required: true, message: '请输入用户工号' }, { pattern: /^[A-Za-z0-9_-]{1,50}$/, message: '工号只能包含字母、数字、下划线或连字符' }]}><Input placeholder="请输入用户工号" maxLength={50} /></Form.Item>
          {!isEditing && <Form.Item label="初始密码" extra="统一设定为“用户姓名拼音小写首字母 + 用户工号”"><Input disabled value="系统自动生成" /></Form.Item>}
          {isEditing && <Form.Item name="password" label="密码" extra="留空表示保持原密码" rules={[{ min: 8, max: 64, message: '密码长度须为 8-64 位' }]}><Input.Password placeholder="请输入新密码" maxLength={64} autoComplete="new-password" /></Form.Item>}
          <Form.Item name="departmentId" label="所属组织" rules={[{ required: true, message: '请选择所属组织' }]}><Select showSearch optionFilterProp="label" placeholder="请选择所属组织" options={departments} /></Form.Item>
          <Form.Item name="roles" label="用户角色" rules={[{ required: true, message: '请至少选择一个用户角色' }]}><Select mode="multiple" maxTagCount="responsive" placeholder="请选择用户角色（可多选）" options={systemRoles.map((value) => ({ label: value, value }))} /></Form.Item>
          <Form.Item name="phone" label="联系方式" validateTrigger="onBlur" rules={[{ required: true, message: '请输入联系方式' }, { pattern: /^1\d{10}$/, message: '请输入正确的 11 位手机号' }]}><Input placeholder="请输入 11 位手机号" maxLength={11} inputMode="numeric" onChange={(event) => form.setFieldValue('phone', event.target.value.replace(/\D/g, '').slice(0, 11))} /></Form.Item>
          {!isEditing && <Form.Item name="status" label="帐号状态" rules={[{ required: true, message: '请选择帐号状态' }]}><Select options={['正常', '停用'].map((value) => ({ label: value, value }))} /></Form.Item>}
        </div>
        <div className="user-center-form-actions"><Space><Button type="primary" loading={saving} onClick={() => void submit()}>{isEditing ? '保存' : '确认'}</Button><Button onClick={() => navigate('/app/user-center')}>取消</Button></Space></div>
      </Form>
    </Spin></Card>
  </div>;
};

export default UserFormPage;
