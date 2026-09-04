import { useMemo, useState } from 'react';
import { Checkbox, Empty, Space, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { DownOutlined, FolderFilled, RightOutlined } from '@ant-design/icons';
import { flattenPermissionKeys, visiblePermissionTree } from './FunctionPermission';

const { Text } = Typography;

const filterGranted = (nodes: DataNode[], granted: Set<string>): DataNode[] => nodes.flatMap((node) => {
  const children = node.children ? filterGranted(node.children, granted) : [];
  if (!granted.has(String(node.key)) && !children.length) return [];
  return [{ ...node, children: children.length ? children : undefined }];
});

const RolePermissionScope = ({ permissionCodes }: { permissionCodes: string[] }) => {
  const granted = useMemo(() => new Set(permissionCodes), [permissionCodes]);
  const modules = useMemo(() => filterGranted(visiblePermissionTree, granted), [granted]);
  const [activeKey, setActiveKey] = useState<string>();
  const [collapsed, setCollapsed] = useState<React.Key[]>([]);
  const activeModule = modules.find((item) => String(item.key) === activeKey) || modules[0];

  if (!activeModule) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂未分配功能权限" />;

  const toggle = (key: React.Key) => setCollapsed((items) => items.includes(key) ? items.filter((item) => item !== key) : [...items, key]);
  const renderNode = (node: DataNode, depth = 0, standalone = false): React.ReactNode => {
    const children = node.children || [];
    const leaves = children.filter((child) => !child.children?.length);
    const groups = children.filter((child) => child.children?.length);
    const isCollapsed = collapsed.includes(node.key);
    if (!children.length) return standalone ? (
      <div className="permission-group permission-standalone-page" key={node.key}>
        <div className="permission-group-heading"><FolderFilled className="permission-folder-icon" /><Checkbox checked disabled><Text strong>{String(node.title)}</Text></Checkbox></div>
      </div>
    ) : <Checkbox key={node.key} checked disabled>{String(node.title)}</Checkbox>;

    return <div className={`permission-group permission-group-depth-${depth}`} key={node.key}>
      <div className="permission-group-heading">
        <button type="button" className="permission-expand-button" onClick={() => toggle(node.key)} aria-label={isCollapsed ? '展开' : '收起'}>{isCollapsed ? <RightOutlined /> : <DownOutlined />}</button>
        <FolderFilled className="permission-folder-icon" />
        <Checkbox checked disabled><Text strong>{String(node.title)}</Text></Checkbox>
      </div>
      {!isCollapsed && leaves.length > 0 && <div className="permission-action-list">{leaves.map((child) => renderNode(child, depth + 1))}</div>}
      {!isCollapsed && groups.map((child) => renderNode(child, depth + 1))}
    </div>;
  };

  const moduleNodes = activeModule.children || [activeModule];
  const count = flattenPermissionKeys(moduleNodes).filter((key) => granted.has(String(key))).length;
  return <div className="permission-config-layout permission-scope-readonly">
    <aside className="permission-module-nav">
      <div className="permission-module-nav-title">已授权功能模块</div>
      {modules.map((item) => {
        const itemCount = flattenPermissionKeys(item.children || [item]).filter((key) => granted.has(String(key))).length;
        return <button type="button" key={item.key} className={`permission-module-item${String(item.key) === String(activeModule.key) ? ' is-active' : ''}`} onClick={() => setActiveKey(String(item.key))}>
          <span>{String(item.title)}</span><span className="permission-module-count">{itemCount} 项</span>
        </button>;
      })}
    </aside>
    <section className="permission-detail-panel">
      <div className="permission-detail-header"><Space><FolderFilled className="permission-folder-icon" /><Text strong>{String(activeModule.title)}</Text><Text type="secondary">{count} 项权限</Text></Space></div>
      <div className="permission-groups">{moduleNodes.map((node) => renderNode(node, 0, !node.children?.length))}</div>
    </section>
  </div>;
};

export default RolePermissionScope;
