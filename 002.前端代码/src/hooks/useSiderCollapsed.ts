/**
 * 全局轻量级侧边栏折叠状态订阅器
 *
 * 用途:
 *   - BasicLayout(ProLayout 拥有方)订阅此值作为 collapsed prop;
 *   - 任意子页面(如首页 HomeSidebarV2 工具区)可调用 setCollapsed(true) 让侧边栏折叠。
 *
 * 设计取舍:
 *   - 不走 React Context:Context 会强制 BasicLayout / 子组件重新渲染整棵子树,
 *     而 Sider 的折叠是一个独立的 UI 状态,模块级订阅更轻量。
 *   - 单一全局值,无持久化(刷新后恢复默认展开)。
 *   - 与 ProLayout 内部 collapsed 状态完全独立,折叠/展开只通过这个 setter 触发,
 *     避免双向同步死循环。
 */

let currentCollapsed = false;
type Listener = (next: boolean) => void;
const listeners = new Set<Listener>();

export const getSiderCollapsed = (): boolean => currentCollapsed;

export const setSiderCollapsed = (next: boolean): void => {
  if (currentCollapsed === next) return;
  currentCollapsed = next;
  listeners.forEach((fn) => fn(next));
};

export const toggleSiderCollapsed = (): void => {
  setSiderCollapsed(!currentCollapsed);
};

export const subscribeSiderCollapsed = (fn: Listener): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};