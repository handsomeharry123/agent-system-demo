import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ProLayout } from '@ant-design/pro-layout';
import { Dropdown, Avatar, Space, message, Typography } from 'antd';
import {
  BgColorsOutlined,
  CheckOutlined,
  LogoutOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { THEME_LABELS, type ThemeKey } from '../theme/themeConfig';
import { useDemoSettings } from '../hooks/useDemoSettings';
import {
  masterMenu,
  isModuleVisible,
  isSubPageVisible,
  hasMenuModulePermission,
  hasMenuSubPagePermission,
} from '../config/masterMenu';
import {
  getSiderCollapsed,
  setSiderCollapsed,
  subscribeSiderCollapsed,
} from '../hooks/useSiderCollapsed';
import { DemoSettingsPanel } from '../components/DemoFloatButton';
// V1 智能化升级（§3.1.1）：全局「智能填写助手」悬浮入口 + 对话浮层
import AgentAssistant from '../pages/agent-center/smart/AgentAssistant';
import { SmartDraftProvider } from '../pages/agent-center/smart/store.tsx';
// 统一台账中心智能化升级（PRD §3.1）：台账总览 / 列表页全局气泡欢迎语 + 对话浮层
import AgentFloatHost from '../components/AgentFloatHost';
import { mvpFeatures } from '../config/mvpFeatures';

const { Text } = Typography;

const isDemoModeEnabled = (): boolean => {
  // 显式 false / 'false' 关闭；其余一律开启（开发默认值）
  const flag = import.meta.env.VITE_DEMO_MODE;
  if (flag === undefined || flag === null || flag === '') return true;
  return String(flag).toLowerCase() !== 'false';
};

const BasicLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // Sider 折叠状态由全局订阅器驱动(HomeSidebarV2 等子组件可通过 setSiderCollapsed 触发)。
  const [collapsed, setCollapsedState] = useState<boolean>(getSiderCollapsed());
  useEffect(() => {
    const unsubscribe = subscribeSiderCollapsed((next) => setCollapsedState(next));
    return unsubscribe;
  }, []);
  const [demoPanelOpen, setDemoPanelOpen] = useState(false);
  const { currentUser, logout } = useAuth();
  const { themeKey, setThemeKey } = useTheme();
  const isTech = themeKey === 'tech';
  const { visibleModules, visibleSubPages, demoRole, newUserRoles } = useDemoSettings();
  // 新用户演示态不参与真实登录会话的授权判定。
  const isNewUser = !localStorage.getItem('auth_token') && newUserRoles[demoRole];

  const demoMode = isDemoModeEnabled();

  // 主题风格标记同步到 <body>：驱动 global.css 的科技风网格 + 光晕背景层
  useEffect(() => {
    document.body.setAttribute('data-app-theme', themeKey);
    return () => {
      document.body.removeAttribute('data-app-theme');
    };
  }, [themeKey]);

  // 根据 demo 角色 + 模块显隐集合计算最终菜单
  // 2 角色可见性维度：信息科管理员 = itAdmin；科室管理员 = itUser
  const filteredMenuItems = useMemo(() => {
    const effectiveVisibleModules = isNewUser
      ? Object.fromEntries(
          masterMenu.map((module) => [
            module.key,
            module.key === 'agent-needs' || module.key === 'agent-center',
          ]),
        )
      : visibleModules;
    // 功能权限是菜单展示的最终依据。权限配置应能恢复入口，不能再被浏览器中
    // 历史遗留的 demo_settings_v1 显隐偏好挡住。
    const permissionCodes = currentUser?.permissionCodes;
    if (permissionCodes === undefined) return [];

    return masterMenu
      .filter((module) => !isNewUser || module.key === 'agent-needs' || module.key === 'agent-center')
      .filter((module) => isModuleVisible(
        module,
        { ...effectiveVisibleModules, [module.key]: true },
        'itAdmin',
      ))
      .filter((module) => hasMenuModulePermission(permissionCodes, module.key))
      .map((module) => {
        const children = module.children
          ?.filter((sub) => isSubPageVisible(
            module,
            sub,
            { ...effectiveVisibleModules, [module.key]: true },
            { ...visibleSubPages, [sub.key]: true },
            'itAdmin',
          ))
          .filter((sub) => hasMenuSubPagePermission(permissionCodes, sub.key))
          .map((sub) => ({ key: sub.key, name: sub.name, path: sub.path }));
        return {
          key: module.key,
          name: module.name,
          path: module.path,
          icon: module.icon,
          children: children?.length ? children : undefined,
        };
      });
  }, [visibleModules, visibleSubPages, demoRole, isNewUser, currentUser?.permissionCodes]);

  // ProLayout 默认使用前缀匹配菜单路径。模块首页与「监控告警总览」共用
  // /app/monitoring 时，访问任意更深的监控页面也会误选中总览。
  // 显式选择当前路径下最长（最具体）的菜单路径，模块首页只在精确命中时选中。
  const selectedMenuPath = useMemo(() => {
    const pathname = location.pathname;
    const candidates = filteredMenuItems.flatMap((module) => [
      ...(module.path ? [module.path] : []),
      ...(module.children?.flatMap((child) => (child.path ? [child.path] : [])) ?? []),
    ]);

    return candidates
      .filter((path) => pathname === path || pathname.startsWith(`${path}/`))
      .sort((a, b) => b.length - a.length)[0];
  }, [filteredMenuItems, location.pathname]);

  // 全局只挂载一个悬浮助手：台账路由使用台账专属助手，其余页面（含事件审核页）
  // 使用原有医小管。避免两个宿主同时存在时出现重复机器人，同时保留原助手的欢迎提示。
  const isLedgerRoute =
    location.pathname === '/app/ledger' || location.pathname.startsWith('/app/ledger/');
  const isNewUserConsoleRoute =
    isNewUser &&
    (location.pathname === '/app/agent-needs' || location.pathname === '/app/agent-center');

  // 当前所在模块若被关闭 / 角色无权，自动跳转到一个安全的落地页
  // 安全的落地页 = 所有角色均回到首页数据大屏
  // V2.0：用 ref 记录"已提示过的拦截目标"，避免 React 18 StrictMode 下 effect 双跑 / 同一次访问重弹 message
  const warnedForRef = useRef<string>('');
  useEffect(() => {
    if (!currentUser) return;
    const path = location.pathname;
    const blockedMvpPath =
      path === '/app/home/overview' ||
      path === '/app/home/workbench' ||
      path.startsWith('/app/agent-needs') ||
      path.startsWith('/app/project-application') ||
      path.startsWith('/app/resource-center') ||
      path.startsWith('/app/orchestration') ||
      path.startsWith('/app/security') ||
      path.startsWith('/app/data-asset') ||
      path.startsWith('/app/environment') ||
      path.startsWith('/app/ledger/risk/') ||
      path.startsWith('/app/ledger-demo') ||
      path.startsWith('/app/evaluation/tasks/pujiang') ||
      path.startsWith('/app/evaluation/tasks/platform/') ||
      ['/app/monitoring/business', '/app/monitoring/status', '/app/monitoring/cost', '/app/monitoring/security'].some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`),
      ) ||
      path.startsWith('/app/audit/project') ||
      path.startsWith('/app/audit/behavior') ||
      path.startsWith('/app/system-config/evaluation-platforms');
    if (blockedMvpPath) {
      navigate('/app/home/dashboard', { replace: true });
      return;
    }
    // MVP 暂不开放医小管页面，避免通过收藏或手输 URL 绕过菜单隐藏。
    if (!mvpFeatures.medicalAssistant && path === '/app/home/overview') {
      navigate('/app/home/dashboard', { replace: true });
      return;
    }
    const isNewUserAllowedPath =
      path === '/app/agent-needs' ||
      path.startsWith('/app/agent-needs/') ||
      path === '/app/agent-center' ||
      path.startsWith('/app/agent-center/');
    if (isNewUser && !isNewUserAllowedPath) {
      navigate('/app/agent-center', { replace: true });
      return;
    }
    // 找出当前路径所属的模块（精确路径匹配或前缀匹配）
    const ownerModule = masterMenu.find((m) => {
      if (path === m.path) return true;
      if (m.children?.some((s) => s.path === path)) return true;
      if (path.startsWith(m.path + '/')) return true;
      return false;
    });
    if (!ownerModule) return;

    // 优先落到当前用户第一个有权入口；自定义角色可能没有首页权限。
    const firstAllowed = filteredMenuItems[0];
    const safeFallback = firstAllowed?.children?.[0]?.path || firstAllowed?.path || '/login';

    // 路径归属子页面判定：精确路径匹配 或 路径以子页面 path + '/' 开头
    const subPage = ownerModule.children
      ?.filter((s) => path === s.path || path.startsWith(s.path + '/'))
      .sort((a, b) => b.path.length - a.path.length)[0];
    const permissionCodes = currentUser.permissionCodes ?? [];
    const moduleBlocked = !hasMenuModulePermission(permissionCodes, ownerModule.key);
    const subPageBlocked = Boolean(subPage && !hasMenuSubPagePermission(permissionCodes, subPage.key));
    if (moduleBlocked || subPageBlocked) {
      if (path !== safeFallback) {
        const reason = moduleBlocked
          ? subPage
            ? `「${ownerModule.name} / ${subPage.name}」`
            : `「${ownerModule.name}」`
          : `「${ownerModule.name} / ${subPage?.name ?? ''}」`;
        const warnedKey = `${path}::${reason}`;
        if (warnedForRef.current !== warnedKey) {
          warnedForRef.current = warnedKey;
          // V2.x fix: 措辞改友好 + 降级为 info。
          //   信息科管理员误触发时不会被误当作权限 bug;
          //   实际语义是「角色基线下此页面不在可见集合里」,信息强度更弱。
          message.info(`${reason} 暂不可访问，已自动跳转到默认页。`, 3);
        }
        navigate(safeFallback, { replace: true });
      } else {
        // 已抵达安全落地页，重置 warned 标记，下一次重新进入才会再次提示
        warnedForRef.current = '';
      }
    } else {
      // 当前路径未触发拦截，重置 warned 标记
      warnedForRef.current = '';
    }
  }, [location.pathname, isNewUser, currentUser, filteredMenuItems, navigate]);

  // V1.1：身份免维护 + SSO 单点登录，用户基础信息与密码均由医院侧维护
  // 头像菜单保留「退出登录」；演示模式开启时，在上方加「演示功能」入口
  // 主题切换（简约风 / 科技风）对所有用户可见，当前风格打勾
  const themeMenuItem: NonNullable<MenuProps['items']>[number] = {
    key: 'theme',
    icon: <BgColorsOutlined />,
    label: '主题切换',
    children: (['simple', 'tech'] as ThemeKey[]).map((key) => ({
      key: `theme:${key}`,
      label: THEME_LABELS[key],
      icon:
        themeKey === key ? (
          <CheckOutlined style={{ color: '#1677FF' }} />
        ) : (
          <span style={{ display: 'inline-block', width: 14 }} />
        ),
    })),
  };

  const userMenuItems: MenuProps['items'] = demoMode
    ? [
        {
          key: 'demo',
          icon: <SettingOutlined />,
          label: '演示功能',
        },
        themeMenuItem,
        { type: 'divider' as const },
        {
          key: 'logout',
          icon: <LogoutOutlined />,
          label: '退出登录',
          danger: true,
        },
      ]
    : [
        themeMenuItem,
        { type: 'divider' as const },
        {
          key: 'logout',
          icon: <LogoutOutlined />,
          label: '退出登录',
          danger: true,
        },
      ];

  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key.startsWith('theme:')) {
      setThemeKey(key.slice('theme:'.length) as ThemeKey);
      return;
    }
    switch (key) {
      case 'demo':
        setDemoPanelOpen(true);
        break;
      case 'logout':
        logout();
        message.success('已退出登录');
        navigate('/login');
        break;
    }
  };

  const renderHeaderContent = () => (
    <Space size={16} align="center">
      {/* 真实登录会话展示后端返回的全部有效角色。 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 10px',
          borderRadius: 16,
          background: isTech ? 'rgba(34, 211, 238, 0.08)' : '#F0F5FF',
          border: isTech ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid #ADC6FF',
          boxShadow: isTech ? '0 0 16px rgba(34, 211, 238, 0.12)' : undefined,
          cursor: 'default',
        }}
        title={`当前用户：${currentUser?.name ?? '-'}（${currentUser?.roles.join('、') || '未分配角色'}）`}
      >
        <UserOutlined style={{ color: isTech ? '#22d3ee' : '#1677FF' }} />
        <Text style={{ fontSize: 13, color: isTech ? '#e8f1ff' : '#1677FF', fontWeight: 500 }}>
          {currentUser?.name ?? '-'}
        </Text>
        <Text type={isTech ? undefined : 'secondary'} style={{ fontSize: 12, color: isTech ? '#9fb3d1' : undefined }}>
          · {currentUser?.roles.join('、') || '未分配角色'}
        </Text>
      </div>
      <Dropdown
        menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
        placement="bottomRight"
        trigger={['click']}
      >
        <Avatar
          style={{
            background: isTech ? 'linear-gradient(135deg, #1d4ed8, #0891b2)' : '#1677FF',
            boxShadow: isTech ? '0 0 18px rgba(34, 211, 238, 0.25)' : undefined,
            cursor: 'pointer',
          }}
          icon={<UserOutlined />}
        />
      </Dropdown>
    </Space>
  );

  const menuItemRender = (item: any, dom: React.ReactNode) => {
    return (
      <div
        onClick={() => {
          if (item.path) {
            navigate(item.path);
          }
        }}
        style={{ cursor: 'pointer' }}
      >
        {dom}
      </div>
    );
  };

  return (
    <ProLayout
      title="医疗智能体管理平台"
      logo="/logo.svg"
      location={location}
      navTheme={isTech ? 'realDark' : 'light'}
      token={
        isTech
          ? {
              header: { colorBgHeader: 'rgba(15, 24, 48, 0.85)', colorTextMenu: '#e8f1ff' },
              sider: {
                colorMenuBackground: 'rgba(9, 14, 28, 0.92)',
                colorBgMenuItemSelected: 'rgba(34, 211, 238, 0.16)',
                colorTextMenuSelected: '#ffffff',
                colorTextMenu: '#9fb3d1',
                colorTextMenuActive: '#e8f1ff',
              },
              bgLayout: 'transparent',
            }
          : undefined
      }
      menuDataRender={() => filteredMenuItems as any}
      menuProps={selectedMenuPath ? { selectedKeys: [selectedMenuPath] } : undefined}
      collapsed={collapsed}
      onCollapse={(next) => {
        setCollapsedState(next);
        setSiderCollapsed(next);
      }}
      siderWidth={240}
      layout="mix"
      contentWidth="Fluid"
      fixedHeader
      splitMenus={false}
      headerContentRender={() => (
        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          {/* Header content managed by rightContentRender */}
        </div>
      )}
      rightContentRender={() => renderHeaderContent()}
      onMenuHeaderClick={() => navigate('/app/home/dashboard')}
      menuItemRender={menuItemRender}
    >
      <div
        style={{
          background: isTech ? 'transparent' : '#F5F5F5',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        {/* V1 智能化升级：§3.1.1 全局 Agent 对话浮层 + 草稿 store
           —— Provider 必须包住 Outlet, 让 SmartRegistrationForm (通过 React Router 渲染)
              也能 useSmartDraft() 拿到 store */}
        <SmartDraftProvider moduleKey={location.pathname.split('/')[2] || 'app'}>
          <Outlet />
          {mvpFeatures.medicalAssistant && !isLedgerRoute && !isNewUserConsoleRoute && <AgentAssistant />}
          {/* 台账中心智能化升级(PRD §3.1.1 + §3.1.2):
              进入台账总览 / 台账列表页时,自动弹出非打断态势汇报气泡欢迎语;
              点击机器人可唤起 Agent 对话窗口(自然语言问答 + 推荐问句)。
              AgentFloatHost 内部根据 pathname 判断是否渲染与弹气泡。 */}
          {mvpFeatures.medicalAssistant && isLedgerRoute && <AgentFloatHost />}
          {/* 演示设置抽屉: 由右上角头像下拉菜单的「演示功能」项触发,
              仅在 VITE_DEMO_MODE 开启时挂载, 生产环境不渲染 */}
          {demoMode && (
            <DemoSettingsPanel
              open={demoPanelOpen}
              onClose={() => setDemoPanelOpen(false)}
            />
          )}
        </SmartDraftProvider>
      </div>
    </ProLayout>
  );
};

export default BasicLayout;
