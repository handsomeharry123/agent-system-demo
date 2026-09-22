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
import { resolveMenu, masterMenu, isModuleVisible, isSubPageVisible } from '../config/masterMenu';
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
  const isNewUser = newUserRoles[demoRole];

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
    return resolveMenu(
      effectiveVisibleModules,
      visibleSubPages,
      demoRole === '信息科管理员'
        ? 'itAdmin'
        : demoRole === '医院领导'
          ? 'hospitalLeader'
          : 'itUser',
    );
  }, [visibleModules, visibleSubPages, demoRole, isNewUser]);

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
    const isNewUserAllowedPath =
      path === '/app/agent-needs' ||
      path.startsWith('/app/agent-needs/') ||
      path === '/app/agent-center' ||
      path.startsWith('/app/agent-center/');
    if (isNewUser && !isNewUserAllowedPath) {
      navigate('/app/agent-center', { replace: true });
      return;
    }
    // 医院领导采用严格页面白名单，避免通过地址栏绕过侧边栏进入编辑/处置页面。
    if (demoRole === '医院领导') {
      const leaderAllowedPath =
        path === '/app/home/dashboard' ||
        path === '/app/home/overview' ||
        path === '/app/ledger' ||
        path === '/app/ledger/list' ||
        path.startsWith('/app/ledger/detail/') ||
        path === '/app/monitoring' ||
        path === '/app/monitoring/business' ||
        path === '/app/monitoring/status' ||
        path === '/app/monitoring/cost';
      if (!leaderAllowedPath) {
        const warnedKey = `${path}::hospital-leader`;
        if (warnedForRef.current !== warnedKey) {
          warnedForRef.current = warnedKey;
          message.info('医院领导仅可查看已授权页面，已自动跳转到首页。', 3);
        }
        navigate('/app/home/dashboard', { replace: true });
        return;
      }
    }
    // 🛡️ V2.4 兜底:接入中心全部二级路径永久豁免拦截(不依赖 masterMenu 子项配置)
    //  场景:StrictMode + 子组件 hooks 顺序漂移导致 ErrorBoundary 替换为 "Something went wrong.",
    //  用户会误读为「拒绝访问」;此短路确保即使上游拦截逻辑因任何 race 误判,
    //  接入中心主路径 + 全部子路径都不会被强制 navigate 跳走,渲染异常由页面内 ErrorBoundary 自处理。
    if (path === '/app/agent-center' || path.startsWith('/app/agent-center/')) {
      warnedForRef.current = '';
      return;
    }
    // 🛡️ V2.4 兜底：台账中心 detail/risk 子路径永久豁免拦截
    //  场景：masterMenu 中 ledger.children 仅显式列出 overview / list,
    //  若后续角色基线收紧（如给 detail/risk 加 itAdmin 默认）会误判 startsWith 兜底;
    //  此短路确保台账详情/风险分级路径永远由页面内权限逻辑（Detail.tsx 的 isPlatformAdmin
    //  + 科室匹配）自处理,BasicLayout 不抢跳走,避免误报「拒绝访问」。
    if (path.startsWith('/app/ledger/detail/') || path.startsWith('/app/ledger/risk/')) {
      warnedForRef.current = '';
      return;
    }
    // 第三方评测平台接入由页面自身承载配置与状态控制。其列表、详情、创建和编辑
    // 共用同一路径前缀，统一在这里放行，避免演示角色或旧版菜单显隐缓存把新增路由
    // 误判为“系统配置暂不可访问”并重定向回首页。
    if (path.startsWith('/app/system-config/evaluation-platforms')) {
      warnedForRef.current = '';
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

    // 权限拦截后也统一回到首页数据大屏。
    const safeFallback = '/app/home/dashboard';

    // 拦截策略 V2.1：仅在「角色基线无权」时强制回退，不再因演示面板取消勾选拦截路径。
    // 理由：演示面板的可见性只是「侧边栏显隐」开关，不应劫持地址栏直接访问的路由。
    // 保留项：仅信息科管理员可见的子页（如指标展示/数据资源/告警规则管理）对科室管理员仍然强制回退。
    const roleKey =
      demoRole === '信息科管理员'
        ? 'itAdmin'
        : demoRole === '医院领导'
          ? 'hospitalLeader'
          : 'itUser';
    // 计算角色基线拦截：模块 defaultRoleVisible 对当前角色直接不可见
    const roleBaselineBlocked =
      (roleKey === 'hospitalLeader' &&
        !['home', 'assistant', 'ledger', 'monitoring'].includes(ownerModule.key)) ||
      (ownerModule.defaultRoleVisible === 'itAdmin' && roleKey === 'itUser');
    // 路径归属子页面判定：精确路径匹配 或 路径以子页面 path + '/' 开头
    const subPage = ownerModule.children?.find(
      (s) => path === s.path || path.startsWith(s.path + '/'),
    );
    const leaderAllowedSubPages = [
      'ledger:overview',
      'ledger:list',
      'monitoring:overview',
      'monitoring:business',
      'monitoring:status',
      'monitoring:cost',
    ];
    const subRoleBaselineBlocked = subPage
      ? (roleKey === 'hospitalLeader' && !leaderAllowedSubPages.includes(subPage.key)) ||
        ((subPage.defaultRoleVisible || ownerModule.defaultRoleVisible) === 'itAdmin' &&
          roleKey === 'itUser')
      : false;
    const moduleBlocked = roleBaselineBlocked;
    const subPageBlocked = subRoleBaselineBlocked;
    if (moduleBlocked || subPageBlocked) {
      if (path !== safeFallback) {
        // V2.1：仅在角色基线不可见时拦截；路径提示以"角色基线"为由，不再误把"演示面板取消勾选"当拦截原因
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
  }, [location.pathname, visibleModules, visibleSubPages, demoRole, isNewUser, currentUser, navigate]);

  const isItAdmin = currentUser?.roles.includes('信息科管理员') ?? false;

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
      {/* 右上角角色名称：与演示角色切换联动，admin / 李秀英 等 */}
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
        title={`当前演示用户：${currentUser?.name ?? '-'}（${demoRole}）`}
      >
        <UserOutlined style={{ color: isTech ? '#22d3ee' : '#1677FF' }} />
        <Text style={{ fontSize: 13, color: isTech ? '#e8f1ff' : '#1677FF', fontWeight: 500 }}>
          {currentUser?.name ?? '-'}
        </Text>
        <Text type={isTech ? undefined : 'secondary'} style={{ fontSize: 12, color: isTech ? '#9fb3d1' : undefined }}>
          · {demoRole}
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
          {!isLedgerRoute && !isNewUserConsoleRoute && <AgentAssistant />}
          {/* 台账中心智能化升级(PRD §3.1.1 + §3.1.2):
              进入台账总览 / 台账列表页时,自动弹出非打断态势汇报气泡欢迎语;
              点击机器人可唤起 Agent 对话窗口(自然语言问答 + 推荐问句)。
              AgentFloatHost 内部根据 pathname 判断是否渲染与弹气泡。 */}
          {isLedgerRoute && <AgentFloatHost />}
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
