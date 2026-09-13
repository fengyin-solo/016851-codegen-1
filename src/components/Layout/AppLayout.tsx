import { useEffect } from 'react';
import { Button } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import { Sidebar } from '../Sidebar';
import { ChatArea } from '../Chat';
import { ConfigPanel } from '../Config';
import { MobileDrawer } from './MobileDrawer';
import { useUIStore } from '../../stores/uiStore';
import { useChatStore } from '../../stores/chatStore';
import { useConfigStore } from '../../stores/configStore';
import { usePromptTemplateStore } from '../../stores/promptTemplateStore';
import './AppLayout.css';

/**
 * 主布局组件
 */
export function AppLayout() {
  const { isMobile, setIsMobile, toggleMobileDrawer } = useUIStore();
  const { initConversations, initialized: chatInitialized } = useChatStore();
  const { initConfig, initialized: configInitialized } = useConfigStore();
  const { initTemplates, initialized: templatesInitialized } = usePromptTemplateStore();

  // 初始化
  useEffect(() => {
    if (!configInitialized) {
      initConfig();
    }
    if (!chatInitialized) {
      initConversations();
    }
    if (!templatesInitialized) {
      initTemplates();
    }
  }, [configInitialized, chatInitialized, templatesInitialized, initConfig, initConversations, initTemplates]);

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setIsMobile]);

  return (
    <div className="app-layout">
      {/* 移动端头部 */}
      {isMobile && (
        <header className="mobile-header glass-card">
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={toggleMobileDrawer}
            className="menu-button"
          />
          <h1 className="app-title">AI Chat</h1>
          <div className="header-spacer" />
        </header>
      )}

      <div className="app-content">
        {/* 桌面端侧边栏 */}
        {!isMobile && <Sidebar />}

        {/* 聊天区域 */}
        <main className="main-content">
          <ChatArea />
        </main>
      </div>

      {/* 移动端抽屉 */}
      {isMobile && <MobileDrawer />}

      {/* 配置面板 */}
      <ConfigPanel />
    </div>
  );
}
