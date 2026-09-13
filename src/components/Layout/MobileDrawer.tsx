
import { Drawer } from 'antd';
import { Sidebar } from '../Sidebar';
import { useUIStore } from '../../stores/uiStore';
import './MobileDrawer.css';

/**
 * 移动端抽屉组件
 */
export function MobileDrawer() {
  const { mobileDrawerOpen, setMobileDrawerOpen } = useUIStore();

  const handleClose = () => {
    setMobileDrawerOpen(false);
  };

  return (
    <Drawer
      placement="left"
      width="80%"
      open={mobileDrawerOpen}
      onClose={handleClose}
      className="mobile-drawer"
      closable={false}
      styles={{
        body: { padding: 0 },
      }}
    >
      <Sidebar />
    </Drawer>
  );
}
