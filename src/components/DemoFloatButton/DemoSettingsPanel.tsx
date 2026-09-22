import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Drawer,
  Select,
  Tree,
  Button,
  Space,
  Divider,
  Typography,
  message,
  Tag,
  Checkbox,
} from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  SettingOutlined,
  ReloadOutlined,
  CheckSquareOutlined,
  BorderOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { useDemoSettings, type DemoRole } from '../../hooks/useDemoSettings';
import { useAuth } from '../../hooks/useAuth';
import type { UserRole } from '../../types/user';
import { mockUsers } from '../../mock/users';
import {
  masterMenu,
  isModuleVisible,
  isSubPageVisible,
  isHospitalLeaderModule,
  isHospitalLeaderSubPage,
  type MenuRoleKey,
  type ModuleKey,
} from '../../config/masterMenu';
// V1.2: 同步切换 mock/resource-center 内部的英文 demoRole + currentUser 账号,
//   让资源管理中心申请/审核/资源/申请表单四个页面的角色分支正确分发
import { setDemoRole as setMockDemoRole, setCurrentUser as setMockCurrentUser } from '../../mock/resource-center';

const { Text } = Typography;

const ROLE_LABEL: Record<DemoRole, string> = {
  '信息科管理员': '信息科管理员',
  '科室管理员': '科室管理员',
  '医院领导': '医院领导',
};

/**
 * 角色 → 切换后落地的具体演示用户。
 * 与 useAuth.switchRole 的查找行为对齐：
 *  - 信息科管理员 → mockUsers 中第一个含该角色的种子用户 user-000 admin
 *  - 科室管理员  → mockUsers 中第一个含该角色的种子用户 user-016 钱文博
 *                  （演示中心会传 userName='李秀英' 优先命中其多角色身份）
 * 在演示中心 label 中显式注明，让"切角色=换身份"的对应关系一目了然。
 */
const ROLE_DETAIL: Record<DemoRole, { userName: string; userDept: string; scope: string }> = {
  '信息科管理员': {
    userName: 'admin',
    userDept: '信息中心',
    scope: '全院注册与接入记录',
  },
  '科室管理员': {
    userName: '李秀英',
    userDept: '心内科',
    scope: '本科室注册与接入记录',
  },
  '医院领导': {
    userName: '李嘉',
    userDept: '院领导',
    scope: '全院数据（仅查看）',
  },
};

/**
 * V1.2: 把 ROLE_DETAIL 里的演示姓名映射到 resource-center mock 的 applicantAccount,
 *   让"切换到李秀英 → 只看到李秀英自己的 4 条申请 / 可撤销 / 可编辑 / 可删除"。
 *   admin 永远给 admin01, 与 mock 默认值一致。
 */
const ROLE_TO_APPLICANT_ACCOUNT: Record<DemoRole, string> = {
  '信息科管理员': 'admin01',
  '科室管理员': 'user_lxy', // 演示中心默认的科室管理员是李秀英
  '医院领导': 'leader_lj',
};

/** 把当前角色归一为菜单权限键。 */
const toRoleKey = (demoRole: DemoRole): MenuRoleKey =>
  demoRole === '信息科管理员'
    ? 'itAdmin'
    : demoRole === '医院领导'
      ? 'hospitalLeader'
      : 'itUser';

/**
 * 演示设置面板（Drawer 内部内容）
 *  - 不渲染外部入口按钮，由调用方（BasicLayout 头像下拉菜单）控制 open
 *  - 包含角色下拉、模块显隐树、全选 / 取消全选 / 恢复默认 / 一键重置
 *  - 勾选状态以「侧边栏最终是否显示」为准，与 BasicLayout.resolveMenu 共用判定函数，
 *    保证"演示树 ↔ 侧边栏"双向对齐
 */
interface DemoSettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

const DemoSettingsPanel = ({ open, onClose }: DemoSettingsPanelProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    demoRole,
    newUserRoles,
    visibleModules,
    visibleSubPages,
    setDemoRole,
    setRoleNewUser,
    setModuleVisible,
    setSubPageVisible,
    setAllVisible,
    resetToDefaults,
  } = useDemoSettings();
  const { switchRole } = useAuth();

  const roleKey = toRoleKey(demoRole);

  // 树形数据：每个节点附带"角色基线是否禁止"，用于在标题上提示并禁用勾选
  const treeData = useMemo<DataNode[]>(() => {
    return masterMenu.map((m) => {
      const roleBlocked =
        (roleKey === 'hospitalLeader' && !isHospitalLeaderModule(m.key)) ||
        (m.defaultRoleVisible === 'itAdmin' && roleKey === 'itUser');
      const children: DataNode[] | undefined = m.children
        ? m.children.map<DataNode>((sub) => {
            const subRole = sub.defaultRoleVisible || m.defaultRoleVisible;
            const subRoleBlocked =
              (roleKey === 'hospitalLeader' && !isHospitalLeaderSubPage(sub.key)) ||
              (subRole === 'itAdmin' && roleKey === 'itUser');
            return {
              key: sub.key,
              title: subRoleBlocked ? (
                <span style={{ color: '#bbb' }}>{sub.name}（当前角色不可见）</span>
              ) : (
                sub.name
              ),
              // 角色基线屏蔽的子项不可勾选
              disableCheckbox: subRoleBlocked,
              checkable: !subRoleBlocked,
            };
          })
        : undefined;
      return {
        key: m.key,
        title: roleBlocked ? (
          <span style={{ color: '#bbb' }}>{m.name}（当前角色不可见）</span>
        ) : (
          m.name
        ),
        children,
        disableCheckbox: roleBlocked,
        checkable: !roleBlocked,
      };
    });
  }, [roleKey]);

  // 当前勾选的 keys（Tree.checkable 用）
  // 关键：与 BasicLayout.resolveMenu 使用同一份 isModuleVisible / isSubPageVisible
  // → 演示树的勾选状态 = 侧边栏实际显示，二者不再分叉
  //
  // 【重要 1】isSubPageVisible 内部已经先判父是否可见 — 父被关时子也会被过滤掉，
  //   所以不需要在 checkedKeys 里再把"父 key"也写进去。
  // 【重要 2】只把"无 children 的一级模块"和"二级子页面"放进 checkedKeys。
  //   antd Tree 在联动模式下，父节点的勾选状态会按子节点"自动推算"——
  //   如果同时把父 key 也放进数组，Tree 会按字面意思把它标为已勾，
  //   即使所有子节点都取消，也会因"父子勾选状态不一致"出现蓝色已勾的脏状态。
  const checkedKeys = useMemo<string[]>(() => {
    const noChildModuleKeys = masterMenu
      .filter((m) => !m.children || m.children.length === 0)
      .filter((m) => isModuleVisible(m, visibleModules, roleKey))
      .map((m) => m.key);
    const subKeys = masterMenu
      .flatMap((m) => (m.children || []).map((sub) => ({ m, sub })))
      .filter(({ m, sub }) => isSubPageVisible(m, sub, visibleModules, visibleSubPages, roleKey))
      .map(({ sub }) => sub.key);
    return [...noChildModuleKeys, ...subKeys];
  }, [visibleModules, visibleSubPages, roleKey]);

  const handleCheck = (
    _checked: { checked: string[]; halfChecked: string[] } | string[],
    info: { checked: boolean; node: DataNode },
  ) => {
    const { node } = info;
    // 判断是模块（一级）还是子页面
    const moduleEntry = masterMenu.find((m) => m.key === node.key);
    if (moduleEntry) {
      setModuleVisible(node.key as ModuleKey, info.checked);
      // 联动：父勾选 → 子页面一起勾选；父取消 → 子页面一起取消
      moduleEntry.children?.forEach((sub) => {
        setSubPageVisible(sub.key, info.checked);
      });
    } else {
      setSubPageVisible(String(node.key), info.checked);
    }
  };

  const handleRoleChange = (role: DemoRole) => {
    setDemoRole(role);
    // 演示身份绑定：mock 中确实存在 (role, userName) 组合时传 userName 优先命中。
    // 例：李秀英含「信息科管理员 + 科室管理员」,传 userName='李秀英' 命中她本人,
    //   避免「科室管理员」落到 user-016 钱文博。
    const userName = ROLE_DETAIL[role].userName;
    const hit = userName
      ? mockUsers.find((u) => u.name === userName && u.roles.includes(role as UserRole))
      : null;
    if (hit) {
      switchRole(role as UserRole, userName);
    } else {
      switchRole(role as UserRole);
    }

    // V1.2: 同步切换 mock/resource-center 内部的英文 demoRole + currentUser,
    //   否则 4 个 resource-center 页面 (Applies / Approval / ApplyForm / Resources) 的角色判断永远停在 admin 分支。
    //   applicantAccount 走 ROLE_TO_APPLICANT_ACCOUNT 映射, 让 owner 派发能正确命中 mockApplies 中的本人数据。
    //   必须先 setDemoRole 再 setCurrentUser —— mock 内部 setDemoRole 末尾会强制 resetCurrentUserByRole,
    //   把 currentUser 重置为角色默认值覆盖调用方刚写入的 account。
    if (role !== '医院领导') {
      const mockRole: 'admin' | 'user' = role === '信息科管理员' ? 'admin' : 'user';
      const applicantAccount = ROLE_TO_APPLICANT_ACCOUNT[role];
      setMockDemoRole(mockRole);
      setMockCurrentUser({ account: applicantAccount, name: ROLE_DETAIL[role].userName, role: mockRole });
    }

    // 角色切换后按该角色保存的新用户状态进入对应默认页。
    navigate(
      newUserRoles[role] ? '/app/agent-center' : '/app/home/dashboard',
      { replace: true },
    );
    message.success(`已切换为：${ROLE_LABEL[role]}`);
  };

  const handleNewUserChange = (enabled: boolean) => {
    setRoleNewUser(demoRole, enabled);
    if (enabled) {
      navigate('/app/agent-center', { replace: true });
      return;
    }

    // 首个智能体提交成功后，注册页会先跳到待审核地址；新用户占位页虽然
    // 暂时遮住列表，但这里必须保留该业务落点，不能再重定向到首页。
    const submittedFirstAgent =
      location.pathname === '/app/agent-center' &&
      new URLSearchParams(location.search).get('tab') === '待审核';
    navigate(
      submittedFirstAgent ? '/app/agent-center?tab=待审核' : '/app/home/dashboard',
      { replace: true },
    );
  };

  return (
    <Drawer
      title={
        <Space>
          <SettingOutlined />
          <span>演示设置</span>
          <Tag color="gold">演示模式</Tag>
          <Tag color={demoRole === '信息科管理员' ? 'orange' : demoRole === '医院领导' ? 'gold' : 'cyan'}>{demoRole}</Tag>
          <Tag color="blue">
            以 {ROLE_DETAIL[demoRole].userName} 的身份查看
          </Tag>
        </Space>
      }
      placement="right"
      width={560}
      open={open}
      onClose={onClose}
      destroyOnHidden
    >
      {/* 角色切换 */}
      <div style={{ marginBottom: 16 }}>
        <Text strong>演示角色</Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <Select
            value={demoRole}
            onChange={handleRoleChange}
            style={{ flex: 1 }}
            options={[
              {
                label: `信息科管理员（${ROLE_DETAIL['信息科管理员'].userName}）`,
                value: '信息科管理员',
              },
              {
                label: `科室管理员（${ROLE_DETAIL['科室管理员'].userName}）`,
                value: '科室管理员',
              },
              {
                label: `医院领导（${ROLE_DETAIL['医院领导'].userName}）`,
                value: '医院领导',
              },
            ]}
          />
          <Checkbox
            checked={newUserRoles[demoRole]}
            onChange={(event) => handleNewUserChange(event.target.checked)}
            style={{ whiteSpace: 'nowrap' }}
          >
            新用户
          </Checkbox>
        </div>
        <div
          style={{
            fontSize: 12,
            color: '#1677ff',
            marginTop: 8,
            padding: '6px 10px',
            background: '#f0f5ff',
            border: '1px solid #adc6ff',
            borderRadius: 4,
          }}
        >
          当前以 <b>{ROLE_DETAIL[demoRole].userName}</b>
          （{ROLE_DETAIL[demoRole].userDept} · {ROLE_LABEL[demoRole]}）身份查看，
          数据范围：{ROLE_DETAIL[demoRole].scope}。
        </div>
        <div style={{ fontSize: 12, color: '#999', marginTop: 6 }}>
          切换后整站刷新，侧边栏与数据范围按所选角色重新渲染。
        </div>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* 模块显隐 */}
      <div>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Text strong>左侧模块显隐</Text>
          <Space size="small">
            <Button
              size="small"
              icon={<CheckSquareOutlined />}
              onClick={() => setAllVisible(true)}
            >
              全选
            </Button>
            <Button
              size="small"
              icon={<BorderOutlined />}
              onClick={() => setAllVisible(false)}
            >
              全不选
            </Button>
            <Button
              size="small"
              icon={<UndoOutlined />}
              onClick={resetToDefaults}
            >
              恢复默认
            </Button>
          </Space>
        </Space>
        <div style={{ fontSize: 12, color: '#999', margin: '4px 0 8px' }}>
          取消勾选后实时刷新导航。已关闭模块所属路径自动跳转至首页。当前角色基线不可见的模块会显示为灰色且不可勾选，与侧边栏保持一致。
        </div>
        <Tree
          checkable
          defaultExpandAll
          checkedKeys={checkedKeys}
          onCheck={handleCheck as any}
          treeData={treeData}
          style={{
            border: '1px solid #f0f0f0',
            borderRadius: 6,
            padding: 8,
            maxHeight: 360,
            overflowY: 'auto',
          }}
        />
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* 一键重置 */}
      <Space direction="vertical" style={{ width: '100%' }}>
        <Button
          block
          danger
          icon={<ReloadOutlined />}
          onClick={() => {
            resetToDefaults();
            message.success('已重置为出厂演示配置');
          }}
        >
          一键重置为默认
        </Button>
        <Text type="secondary" style={{ fontSize: 12, textAlign: 'center', display: 'block' }}>
          演示设置会自动持久化到浏览器（localStorage）。生产环境可通过 VITE_DEMO_MODE=false 隐藏本面板。
        </Text>
      </Space>
    </Drawer>
  );
};

export default DemoSettingsPanel;
