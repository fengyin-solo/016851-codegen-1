
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import './LoadingIndicator.css';

interface LoadingIndicatorProps {
  /** 加载类型 */
  type?: 'spinner' | 'dots' | 'typing';
  /** 大小 */
  size?: 'small' | 'default' | 'large';
  /** 提示文本 */
  tip?: string;
  /** 自定义类名 */
  className?: string;
}

/**
 * 加载指示器组件
 */
export function LoadingIndicator({
  type = 'spinner',
  size = 'default',
  tip,
  className = '',
}: LoadingIndicatorProps) {
  if (type === 'dots') {
    return (
      <div className={`loading-indicator loading-dots ${size} ${className}`}>
        <span className="dot"></span>
        <span className="dot"></span>
        <span className="dot"></span>
        {tip && <span className="loading-tip">{tip}</span>}
      </div>
    );
  }

  if (type === 'typing') {
    return (
      <div className={`loading-indicator typing-indicator ${size} ${className}`}>
        <div className="typing-dots">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
        {tip && <span className="loading-tip">{tip}</span>}
      </div>
    );
  }

  // Default spinner
  const spinnerSize = size === 'small' ? 16 : size === 'large' ? 32 : 24;
  
  return (
    <div className={`loading-indicator loading-spinner ${size} ${className}`}>
      <Spin
        indicator={<LoadingOutlined style={{ fontSize: spinnerSize }} spin />}
        tip={tip}
      />
    </div>
  );
}

/**
 * 发送中指示器
 */
export function SendingIndicator() {
  return (
    <LoadingIndicator
      type="spinner"
      size="small"
      tip="发送中..."
    />
  );
}

/**
 * 打字指示器（用于流式响应）
 */
export function TypingIndicator() {
  return (
    <div className="typing-indicator">
      <div className="typing-dots">
        <span className="dot"></span>
        <span className="dot"></span>
        <span className="dot"></span>
      </div>
    </div>
  );
}

/**
 * 骨架屏加载
 */
export function SkeletonLoader({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton-loader">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="skeleton-line"
          style={{
            width: index === lines - 1 ? '60%' : '100%',
          }}
        />
      ))}
    </div>
  );
}
