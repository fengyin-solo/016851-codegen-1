import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface UIState {
  /** 侧边栏是否折叠 */
  sidebarCollapsed: boolean;
  /** 配置面板是否可见 */
  configPanelVisible: boolean;
  /** 移动端抽屉是否打开 */
  mobileDrawerOpen: boolean;
  /** 当前主题 */
  theme: Theme;
  /** 是否为移动端 */
  isMobile: boolean;
}

interface UIActions {
  /** 切换侧边栏折叠状态 */
  toggleSidebar: () => void;
  /** 设置侧边栏折叠状态 */
  setSidebarCollapsed: (collapsed: boolean) => void;
  /** 切换配置面板可见性 */
  toggleConfigPanel: () => void;
  /** 设置配置面板可见性 */
  setConfigPanelVisible: (visible: boolean) => void;
  /** 切换移动端抽屉 */
  toggleMobileDrawer: () => void;
  /** 设置移动端抽屉状态 */
  setMobileDrawerOpen: (open: boolean) => void;
  /** 设置主题 */
  setTheme: (theme: Theme) => void;
  /** 切换主题 */
  toggleTheme: () => void;
  /** 设置是否为移动端 */
  setIsMobile: (isMobile: boolean) => void;
}

type UIStore = UIState & UIActions;

// 检测系统主题偏好
const getSystemTheme = (): Theme => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

// 检测是否为移动端
const checkIsMobile = (): boolean => {
  if (typeof window !== 'undefined') {
    return window.innerWidth < 768;
  }
  return false;
};

export const useUIStore = create<UIStore>((set, get) => ({
  // Initial state
  sidebarCollapsed: false,
  configPanelVisible: false,
  mobileDrawerOpen: false,
  theme: getSystemTheme(),
  isMobile: checkIsMobile(),

  // Actions
  toggleSidebar: () => {
    set(state => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },

  setSidebarCollapsed: (collapsed) => {
    set({ sidebarCollapsed: collapsed });
  },

  toggleConfigPanel: () => {
    set(state => ({ configPanelVisible: !state.configPanelVisible }));
  },

  setConfigPanelVisible: (visible) => {
    set({ configPanelVisible: visible });
  },

  toggleMobileDrawer: () => {
    set(state => ({ mobileDrawerOpen: !state.mobileDrawerOpen }));
  },

  setMobileDrawerOpen: (open) => {
    set({ mobileDrawerOpen: open });
  },

  setTheme: (theme) => {
    set({ theme });
    // 更新 document 的 class
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
    }
  },

  toggleTheme: () => {
    const { theme, setTheme } = get();
    setTheme(theme === 'light' ? 'dark' : 'light');
  },

  setIsMobile: (isMobile) => {
    set({ isMobile });
    // 移动端时自动折叠侧边栏
    if (isMobile) {
      set({ sidebarCollapsed: true });
    }
  },
}));
