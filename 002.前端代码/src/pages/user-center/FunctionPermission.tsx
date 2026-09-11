import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, Checkbox, Select, Space, Typography, message } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { DownOutlined, FolderFilled, ReloadOutlined, RightOutlined, SaveOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { permissionApi, type PermissionRole } from '../../services/permissionCenter';

const { Text } = Typography;
const leaves = (prefix: string, titles: string[]) => titles.map((title, i) => ({ key: `${prefix}:${i}`, title }));
const page = (key: string, title: string, actions: string[] = []): DataNode => ({
  key,
  title,
  children: actions.length ? leaves(`${key}:action`, actions) : undefined,
});

export const permissionTree: DataNode[] = [
  { key: 'home', title: '首页' },
  { key: 'assistant', title: '医小管' },
  {
    key: 'needs', title: '智能体建设需求管理', children: [
      page('needs:list', '需求管理列表页', ['需求标题下钻至需求详情', '生成需求', '查看详情', '智能化匹配']),
      page('needs:draft', '草稿列表页', ['需求标题下钻至需求详情', '生成需求', '查看详情', '编辑', '删除']),
    ],
  },
  {
    key: 'project', title: '立项申报管理中心', children: [
      page('project:all', '全部立项申报项目列表页', ['项目名称下钻至立项信息详情', '立项申报', '查看详情', '审核', '撤销', '编辑', '删除']),
      page('project:draft', '草稿列表页', ['项目名称下钻至立项信息详情', '立项申报', '查看详情', '编辑', '删除']),
      page('project:pending', '待审核列表页', ['项目名称下钻至立项信息详情', '立项申报', '查看详情', '审核', '撤销']),
      page('project:reviewing', '审核中列表页', ['项目名称下钻至立项信息详情', '立项申报', '查看详情', '审核']),
      page('project:revoke', '撤销修改列表页', ['项目名称下钻至立项信息详情', '立项申报', '查看详情', '编辑', '删除']),
      page('project:rejected', '立项不通过列表页', ['项目名称下钻至立项信息详情', '立项申报', '查看详情']),
      page('project:approved', '立项通过列表页', ['项目名称下钻至立项信息详情', '立项申报', '查看详情']),
    ],
  },
  {
    key: 'access', title: '智能体接入中心', children: [
      page('access:list', '注册管理列表页', ['智能体编号/名称下钻至注册信息详情', '新建注册', '查看详情', '审核', '撤销', '编辑', '删除']),
      page('access:draft', '注册管理草稿 tab 页', ['智能体编号/名称下钻至注册信息详情', '新建注册', '查看详情', '编辑', '删除']),
      page('access:pending', '注册管理待审核 tab 页', ['智能体编号/名称下钻至注册信息详情', '新建注册', '查看详情', '审核', '撤销（信息科管理员仅限本科室注册的智能体）']),
      page('access:reviewing', '注册管理审核中 tab 页', ['智能体编号/名称下钻至注册信息详情', '新建注册', '查看详情', '审核', '撤销（信息科管理员仅限本科室注册的智能体）']),
      page('access:revoke', '注册管理撤销修改 tab 页', ['智能体编号/名称下钻至注册信息详情', '新建注册', '查看详情', '编辑', '删除']),
      page('access:returned', '注册管理退回修改 tab 页', ['智能体编号/名称下钻至注册信息详情', '新建注册', '查看详情']),
      page('access:approved', '注册管理审核通过 tab 页', ['智能体编号/名称下钻至注册信息详情', '新建注册', '查看详情']),
      page('access:create', '新建注册页'),
      page('access:detail', '注册信息详情页'),
    ],
  },
  { key: 'ledger', title: '统一台账中心', children: [page('ledger:overview', '台账总览页'), page('ledger:list', '台账列表页')] },
  {
    key: 'resource', title: '医院资源管理中心', children: [
      { key: 'resource:manage', title: '资源管理', children: [
        page('resource:manage:all', '全部注册资源列表页', ['注册资源', '编辑', '删除']),
        page('resource:manage:draft', '注册资源草稿页', ['注册资源', '编辑', '删除']),
      ] },
      { key: 'resource:apply', title: '申请管理', children: [
        page('resource:apply:all', '资源申请管理全部列表页', ['权限申请', '查看详情', '审核', '撤销', '编辑', '删除']),
        page('resource:apply:draft', '资源申请管理草稿 tab 页', ['权限申请', '编辑', '删除']),
        page('resource:apply:pending', '资源申请管理待审核 tab 页', ['权限申请', '查看详情', '审核', '撤销（信息科管理员仅限本科室申请的资源）']),
        page('resource:apply:reviewing', '资源申请管理审核中 tab 页', ['权限申请', '查看详情', '审核', '撤销（信息科管理员仅限本科室申请的资源）']),
        page('resource:apply:revoke', '资源申请管理撤销修改 tab 页', ['权限申请', '查看详情', '编辑', '删除']),
        page('resource:apply:returned', '资源申请管理退回修改 tab 页', ['权限申请', '查看详情']),
        page('resource:apply:approved', '资源申请管理审核通过 tab 页', ['权限申请', '查看详情']),
        page('resource:apply:create', '申请权限页'),
        page('resource:apply:detail', '权限申请详情页'),
      ] },
    ],
  },
  {
    key: 'evaluation', title: '统一准入评测沙盒', children: [
      { key: 'evaluation:task', title: '评测任务管理', children: [
        page('evaluation:task:all', '评测任务管理全部列表页', ['新建评测任务', '重新评测', '查看详情', '审核', '撤销', '编辑', '删除']),
        page('evaluation:task:draft', '评测任务管理草稿列表页', ['新建评测任务', '查看详情', '编辑', '删除']),
        page('evaluation:task:pending', '评测任务管理待评测列表页', ['新建评测任务', '查看详情', '撤销']),
        page('evaluation:task:running', '评测任务管理评测中列表页', ['新建评测任务', '查看详情', '撤销']),
        page('evaluation:task:revoke', '评测任务管理撤销列表页', ['新建评测任务', '查看详情', '编辑', '删除']),
        page('evaluation:task:finished', '评测任务管理评测完成列表页', ['新建评测任务', '查看详情', '审核']),
        page('evaluation:task:reviewing', '评测任务管理审核中列表页', ['新建评测任务', '查看详情', '审核']),
        page('evaluation:task:approved', '评测任务管理审核通过列表页', ['新建评测任务', '查看详情']),
        page('evaluation:task:returned', '评测任务管理退回修改列表页', ['新建评测任务', '查看详情']),
        page('evaluation:task:result', '评测结果详情页'),
      ] },
      page('evaluation:index', '指标列表', ['查看评分规则', '前往任务管理']),
      page('evaluation:data', '数据集管理', ['点击数据集名称下钻至对应数据集详情', '上传数据集', '查看详情', '编辑', '删除']),
    ],
  },
  {
    key: 'monitor', title: '统一运行监控中心', children: [
      page('monitor:overview', '监控告警总览页'), page('monitor:business', '业务监控页'), page('monitor:status', '状态监控页'), page('monitor:cost', '成本监控页'),
      { key: 'monitor:rules', title: '告警规则管理', children: [page('monitor:rules:list', '告警规则管理页', ['新建规则', '查看详情', '编辑', '删除'])] },
      { key: 'monitor:event', title: '告警事件处置', children: [
        page('monitor:event:all', '全部告警事件页', ['查看详情', '分派', '处理', '审核']),
        page('monitor:event:assign', '待分派告警事件页', ['查看详情', '分派']),
        page('monitor:event:handle', '待处理告警事件页', ['查看详情', '处理（信息科管理员仅限本科室智能体产生的告警事件）']),
        page('monitor:event:handling', '处理中告警事件页'),
        page('monitor:event:pending', '待审核告警事件页', ['查看详情', '审核']),
        page('monitor:event:reviewing', '审核中告警事件页', ['查看详情', '审核']),
        page('monitor:event:closed', '已关闭告警事件页'), page('monitor:event:ignored', '已忽略告警事件页'),
        page('monitor:event:process', '告警事件处理页'),
        page('monitor:event:detail', '告警事件详情页'),
      ] },
    ],
  },
  {
    key: 'user', title: '用户中心', children: [
      page('user:list', '用户列表页', ['新建用户', '编辑', '停用', '批量启用', '批量停用', '导出列表', '删除']),
      page('user:role', '角色管理页', ['新增角色', '查看详情', '编辑', '删除']),
      page('user:function', '功能权限配置页'),
    ],
  },
  {
    key: 'audit', title: '审计中心', children: [
      { key: 'audit:project', title: '项目审计（仅立项申报项目的科室具备权限）', children: [
        page('audit:project:all', '全部项目审计列表页', ['批量导出', '项目审计信息填报', '查看详情', '审计', '撤销', '编辑', '删除']),
        page('audit:project:pending', '待申请列表页', ['批量导出', '项目审计信息填报']),
        page('audit:project:draft', '草稿列表页', ['批量导出', '编辑', '删除']),
        page('audit:project:audit', '待审计列表页', ['批量导出', '查看详情', '审计', '撤销（信息科管理员仅限本科室申请的项目审计）']),
        page('audit:project:auditing', '审计中列表页', ['批量导出', '查看详情', '审计', '撤销（信息科管理员仅限本科室申请的项目审计）']),
        page('audit:project:revoke', '撤销修改列表页', ['批量导出', '查看详情', '编辑']),
        page('audit:project:approved', '审计通过列表页', ['批量导出', '查看详情']),
        page('audit:project:department-approved', '审计部通过列表页', ['批量导出', '查看详情']),
        page('audit:project:form', '项目审计信息填报页'),
        page('audit:project:detail', '项目审计信息详情页'),
      ] },
      page('audit:agent', '智能体行为审计'), page('audit:log', '操作日志页'),
    ],
  },
  {
    key: 'system', title: '系统配置', children: [
      page('system:dict', '数据字典', ['查看字典项', '编辑', '导出字典']),
      page('system:model', '模型配置', ['模型配置', '测试联通', '编辑', '删除']),
      page('system:evaluation-platform', '第三方评测平台接入', ['查看详情', '新增', '暂存', '联通测试', '编辑', '删除']),
    ],
  },
];

/**
 * MVP 阶段仅做前端展示隐藏，完整权限定义及数据库授权关系均保留。
 * 后续版本恢复模块时，从此集合移除对应 key 即可重新展示。
 */
const MVP_HIDDEN_PERMISSION_KEYS = new Set([
  'assistant',
  'needs',
  'project',
  'resource',
  'monitor:business',
  'monitor:status',
  'monitor:cost',
  'audit:project',
  'audit:agent',
  'system:evaluation-platform',
]);

const filterHiddenPermissions = (nodes: DataNode[]): DataNode[] => nodes
  .filter((node) => !MVP_HIDDEN_PERMISSION_KEYS.has(String(node.key)))
  .map((node) => node.children
    ? { ...node, children: filterHiddenPermissions(node.children) }
    : node);

export const visiblePermissionTree = filterHiddenPermissions(permissionTree);

export const flattenPermissionKeys = (nodes: DataNode[]): React.Key[] => nodes.flatMap((node) => [node.key, ...(node.children ? flattenPermissionKeys(node.children) : [])]);
const visiblePermissionKeySet = new Set(flattenPermissionKeys(visiblePermissionTree).map(String));
export const countVisiblePermissions = (permissionCodes: string[] = []) => permissionCodes.filter((code) => visiblePermissionKeySet.has(code)).length;
const flattenKeys = flattenPermissionKeys;
const allKeys = flattenKeys(permissionTree);

const findNode = (key: string, nodes: DataNode[] = permissionTree): DataNode | undefined => {
  for (const node of nodes) {
    if (String(node.key) === key) return node;
    const found = node.children ? findNode(key, node.children) : undefined;
    if (found) return found;
  }
  return undefined;
};

const keysFor = (key: string, actions?: string[]): React.Key[] => {
  const node = findNode(key);
  if (!node) return [];
  if (!actions) return flattenKeys([node]);
  const actionKeys = (node.children || [])
    .filter((child) => actions.some((action) => String(child.title).startsWith(action)))
    .map((child) => child.key);
  return [node.key, ...actionKeys];
};

const combineKeys = (...groups: React.Key[][]) => Array.from(new Set(groups.flat()));

const leaderKeys = combineKeys(
  keysFor('home'),
  keysFor('assistant'),
  keysFor('ledger'),
  keysFor('monitor:overview'),
  keysFor('monitor:business'),
  keysFor('monitor:status'),
  keysFor('monitor:cost'),
);

const deptKeys = combineKeys(
  keysFor('home'),
  keysFor('assistant'),
  keysFor('needs'),
  keysFor('access:list', ['撤销']),
  keysFor('access:draft'),
  keysFor('access:pending', ['撤销']),
  keysFor('access:reviewing', ['撤销']),
  keysFor('access:revoke'),
  keysFor('access:returned'),
  keysFor('access:approved'),
  keysFor('access:create'),
  keysFor('access:detail'),
  keysFor('ledger'),
  ['resource:apply'],
  keysFor('resource:apply:all'),
  keysFor('resource:apply:draft'),
  keysFor('resource:apply:pending', ['撤销']),
  keysFor('resource:apply:reviewing', ['撤销']),
  keysFor('resource:apply:revoke'),
  keysFor('resource:apply:returned'),
  keysFor('resource:apply:approved'),
  keysFor('resource:apply:create'),
  keysFor('resource:apply:detail'),
  ['evaluation:task'],
  keysFor('evaluation:task:all', ['查看详情']),
  keysFor('evaluation:task:draft'),
  keysFor('evaluation:task:pending'),
  keysFor('evaluation:task:running', ['查看详情']),
  keysFor('evaluation:task:revoke'),
  keysFor('evaluation:task:finished', ['查看详情']),
  keysFor('evaluation:task:reviewing', ['查看详情']),
  keysFor('evaluation:task:approved'),
  keysFor('evaluation:task:returned'),
  keysFor('evaluation:task:result'),
  keysFor('monitor:overview'),
  keysFor('monitor:business'),
  keysFor('monitor:status'),
  keysFor('monitor:cost'),
  ['monitor:event'],
  keysFor('monitor:event:all'),
  keysFor('monitor:event:handle', ['处理']),
  keysFor('monitor:event:handling'),
  keysFor('monitor:event:pending', ['查看详情']),
  keysFor('monitor:event:reviewing', ['查看详情']),
  keysFor('monitor:event:closed'),
  keysFor('monitor:event:ignored'),
  keysFor('monitor:event:process'),
  keysFor('monitor:event:detail'),
  ['audit:project'],
  keysFor('audit:project:all', ['撤销']),
  keysFor('audit:project:pending'),
  keysFor('audit:project:draft'),
  keysFor('audit:project:audit', ['撤销']),
  keysFor('audit:project:auditing', ['撤销']),
  keysFor('audit:project:revoke'),
  keysFor('audit:project:approved'),
  keysFor('audit:project:department-approved'),
  keysFor('audit:project:form'),
  keysFor('audit:project:detail'),
  keysFor('audit:agent'),
  keysFor('system:model'),
);
export const permissionDefaults: Record<string, React.Key[]> = { 医院领导: leaderKeys, 信息科管理员: allKeys, 科室管理员: deptKeys };

const FunctionPermission = () => {
  const [searchParams] = useSearchParams();
  const initialRoleName = searchParams.get('role') || '信息科管理员';
  const initialRoleId = searchParams.get('roleId');
  const [roles, setRoles] = useState<PermissionRole[]>([]);
  const [roleId, setRoleId] = useState('');
  const [checked, setChecked] = useState<React.Key[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeModule, setActiveModule] = useState(String(visiblePermissionTree[0].key));
  const [collapsed, setCollapsed] = useState<React.Key[]>([]);
  const currentRole = roles.find((item) => item.id === roleId);
  const currentModule = visiblePermissionTree.find((item) => String(item.key) === activeModule) || visiblePermissionTree[0];
  const visibleKeys = useMemo(() => flattenKeys(visiblePermissionTree), []);
  const visibleCheckedCount = visibleKeys.filter((key) => checked.includes(key)).length;
  const currentNodes = useMemo(() => currentModule.children || [currentModule], [currentModule]);
  const currentKeys = useMemo(() => flattenKeys(currentNodes), [currentNodes]);
  const currentCheckedCount = currentKeys.filter((key) => checked.includes(key)).length;
  const moduleFullyChecked = currentCheckedCount === currentKeys.length;
  const modulePartlyChecked = currentCheckedCount > 0 && !moduleFullyChecked;

  useEffect(() => {
    void permissionApi.roles().then((items) => {
      setRoles(items);
      const initial = items.find((item) => item.id === initialRoleId)
        || items.find((item) => item.name === initialRoleName)
        || items[0];
      if (initial) setRoleId(initial.id);
    }).catch((error) => message.error(error instanceof Error ? error.message : '角色加载失败'));
  }, []);

  useEffect(() => {
    if (!roleId) return;
    setLoading(true);
    void permissionApi.get(roleId).then((result) => setChecked(result.permissionCodes)).catch((error) => {
      message.error(error instanceof Error ? error.message : '功能权限加载失败');
    }).finally(() => setLoading(false));
  }, [roleId]);

  const switchRole = (value: string) => setRoleId(value);

  const checkModule = (value: boolean) => {
    setChecked((previous) => value
      ? Array.from(new Set([...previous, ...currentKeys]))
      : previous.filter((key) => !currentKeys.includes(key)));
  };

  const checkKeys = (keys: React.Key[], value: boolean) => {
    setChecked((previous) => value
      ? Array.from(new Set([...previous, ...keys]))
      : previous.filter((key) => !keys.includes(key)));
  };

  const resetRole = () => setChecked(permissionDefaults[currentRole?.name || ''] || []);
  const savePermissions = async () => {
    if (!roleId || !currentRole) return;
    try {
      setSaving(true);
      const result = await permissionApi.save(roleId, checked.map(String));
      message.success(`「${currentRole.name}」功能权限保存成功，共 ${result.count} 项`);
    } catch (error) { message.error(error instanceof Error ? error.message : '功能权限保存失败'); }
    finally { setSaving(false); }
  };
  const toggleNode = (key: React.Key) => setCollapsed((previous) => (
    previous.includes(key) ? previous.filter((item) => item !== key) : [...previous, key]
  ));

  const renderPermissionNode = (node: DataNode, depth = 0, standalonePage = false) => {
    const nodeKeys = flattenKeys([node]);
    const selectedCount = nodeKeys.filter((key) => checked.includes(key)).length;
    const fullyChecked = selectedCount === nodeKeys.length;
    const partlyChecked = selectedCount > 0 && !fullyChecked;
    const children = node.children || [];
    const leafChildren = children.filter((child) => !child.children?.length);
    const groupChildren = children.filter((child) => child.children?.length);
    const isCollapsed = collapsed.includes(node.key);

    if (!children.length) {
      if (standalonePage) {
        return (
          <div className="permission-group permission-standalone-page" key={node.key}>
            <div className="permission-group-heading">
              <FolderFilled className="permission-folder-icon" />
              <Checkbox
                checked={checked.includes(node.key)}
                onChange={(event) => checkKeys([node.key], event.target.checked)}
              >
                <Text strong>{String(node.title)}</Text>
              </Checkbox>
            </div>
          </div>
        );
      }
      return (
        <Checkbox
          key={node.key}
          checked={checked.includes(node.key)}
          onChange={(event) => checkKeys([node.key], event.target.checked)}
        >
          {String(node.title)}
        </Checkbox>
      );
    }

    return (
      <div className={`permission-group permission-group-depth-${depth}`} key={node.key}>
        <div className="permission-group-heading">
          <button type="button" className="permission-expand-button" onClick={() => toggleNode(node.key)} aria-label={isCollapsed ? '展开' : '收起'}>
            {isCollapsed ? <RightOutlined /> : <DownOutlined />}
          </button>
          <FolderFilled className="permission-folder-icon" />
          <Checkbox
            checked={fullyChecked}
            indeterminate={partlyChecked}
            onChange={(event) => checkKeys(nodeKeys, event.target.checked)}
          >
            <Text strong>{String(node.title)}</Text>
          </Checkbox>
        </div>
        {!isCollapsed && leafChildren.length > 0 && (
          <div className="permission-action-list">
            {leafChildren.map((child) => renderPermissionNode(child, depth + 1))}
          </div>
        )}
        {!isCollapsed && groupChildren.map((child) => renderPermissionNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="user-center-page">
      <PageHeader
        title="功能权限配置"
        subTitle="按角色勾选可访问的模块、页面及行内操作权限"
        extra={<Space><Button icon={<ReloadOutlined />} disabled={!currentRole || loading} onClick={resetRole}>重置为角色默认权限</Button><Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={!currentRole || loading} onClick={() => void savePermissions()}>保存配置</Button></Space>}
      />
      <Card bordered={false}>
        <div className="permission-role-bar">
          <Space size={16} wrap><Text strong>配置角色</Text><Select loading={!roles.length} value={roleId || undefined} options={roles.map((item) => ({ label: item.name, value: item.id, disabled: item.status === '停用' }))} onChange={switchRole} style={{ width: 220 }} /><Text type="secondary">已选择 {visibleCheckedCount} 项权限</Text></Space>
        </div>
        <div className="permission-config-layout">
          <aside className="permission-module-nav">
            <div className="permission-module-nav-title">功能模块</div>
            {visiblePermissionTree.map((item) => {
              const keys = flattenKeys(item.children || [item]);
              const selected = keys.filter((key) => checked.includes(key)).length;
              return (
                <button
                  type="button"
                  key={item.key}
                  className={`permission-module-item${String(item.key) === activeModule ? ' is-active' : ''}`}
                  onClick={() => setActiveModule(String(item.key))}
                >
                  <span>{String(item.title)}</span>
                  <span className="permission-module-count">{selected}/{keys.length}</span>
                </button>
              );
            })}
          </aside>
          <section className="permission-detail-panel">
            <div className="permission-detail-header">
              <Space>
                <FolderFilled className="permission-folder-icon" />
                <div>
                  <Text strong>{String(currentModule.title)}</Text>
                  <Text type="secondary" className="permission-detail-summary">{currentCheckedCount}/{currentKeys.length} 项权限</Text>
                </div>
              </Space>
              <Checkbox checked={moduleFullyChecked} indeterminate={modulePartlyChecked} onChange={(event) => checkModule(event.target.checked)}>
                全选本模块
              </Checkbox>
            </div>
            <div className="permission-groups">
              {currentNodes.map((node) => renderPermissionNode(node, 0, !node.children?.length))}
            </div>
          </section>
        </div>
      </Card>
    </div>
  );
};

export default FunctionPermission;
