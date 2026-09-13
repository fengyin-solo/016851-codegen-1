
import { Button, Tooltip } from 'antd';
import { PlusOutlined, SettingOutlined } from '@ant-design/icons';
import { ConversationList } from './ConversationList';
import { useChatStore } from '../../stores/chatStore';
import { useUIStore } from '../../stores/uiStore';
import './Sidebar.css';

/**
 * 侧边栏组件
 */
export function Sidebar() {
  const {
    conversations,
    activeConversationId,
    createConversation,
    deleteConversation,
    setActiveConversation,
  } = useChatStore();

  const { setConfigPanelVisible, setMobileDrawerOpen } = useUIStore();

  const handleNewConversation = () => {
    createConversation();
    setMobileDrawerOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversation(id);
    setMobileDrawerOpen(false);
  };

  const handleOpenSettings = () => {
    setConfigPanelVisible(true);
  };

  return (
    <div className="sidebar glass-card">
      <div className="sidebar-header">
        <h2 className="sidebar-title">对话历史</h2>
        <div className="sidebar-actions">
          <Tooltip title="设置">
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={handleOpenSettings}
            />
          </Tooltip>
        </div>
      </div>

      <div className="sidebar-new">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleNewConversation}
          block
        >
          新建对话
        </Button>
      </div>

      <div className="sidebar-content">
        <ConversationList
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={handleSelectConversation}
          onDelete={deleteConversation}
        />
      </div>

      <div className="sidebar-footer">
        <span className="sidebar-footer-text">
          共 {conversations.length} 个对话
        </span>
      </div>
    </div>
  );
}
