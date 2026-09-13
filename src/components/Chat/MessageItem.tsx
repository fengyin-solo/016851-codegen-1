import { memo } from 'react';
import { Avatar } from 'antd';
import { UserOutlined, RobotOutlined } from '@ant-design/icons';
import type { Message } from '../../types';
import { MarkdownRenderer } from '../Common/MarkdownRenderer';
import { CopyButton } from '../Common/CopyButton';
import { TypingIndicator } from '../Common/LoadingIndicator';
import { formatResponseTime, formatTokenCount } from '../../utils/formatters';
import './MessageItem.css';

interface MessageItemProps {
  message: Message;
  isStreaming?: boolean;
}

/**
 * 消息项组件
 */
export const MessageItem = memo(function MessageItem({
  message,
  isStreaming = false,
}: MessageItemProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const showStats = isAssistant && message.status === 'complete' && message.stats;

  return (
    <div className={`message-item ${isUser ? 'user' : 'assistant'} animate-fadeInUp`}>
      <div className="message-avatar">
        <Avatar
          size={36}
          icon={isUser ? <UserOutlined /> : <RobotOutlined />}
          style={{
            backgroundColor: isUser ? 'var(--color-primary)' : 'var(--color-bg-tertiary)',
            color: isUser ? 'white' : 'var(--color-text-secondary)',
          }}
        />
      </div>

      <div className="message-content-wrapper">
        <div className={`message-bubble ${message.status}`}>
          {isStreaming && message.status === 'streaming' && !message.content ? (
            <TypingIndicator />
          ) : (
            <div className="message-content">
              {isUser ? (
                <p>{message.content}</p>
              ) : (
                <MarkdownRenderer content={message.content} />
              )}
            </div>
          )}

          {message.status === 'error' && (
            <div className="message-error">
              <span>消息发送失败</span>
            </div>
          )}
        </div>

        <div className="message-footer">
          {showStats && message.stats && (
            <div className="message-stats">
              <span className="stat-item">
                {formatResponseTime(message.stats.responseTime)}
              </span>
              <span className="stat-divider">·</span>
              <span className="stat-item">
                {formatTokenCount(message.stats.tokenCount)} tokens
              </span>
            </div>
          )}

          {isAssistant && message.content && message.status === 'complete' && (
            <div className="message-actions">
              <CopyButton text={message.content} size="small" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
