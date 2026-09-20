import { useEffect, useRef } from 'react';
import { Empty } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import type { Message } from '../../types';
import { MessageItem } from './MessageItem';
import './MessageList.css';

/** 定位高亮持续时间（毫秒） */
const LOCATE_HIGHLIGHT_DURATION = 1600;

/** 定位请求：nonce 用于区分对同一条消息的连续定位 */
export interface LocateRequest {
  messageId: string;
  nonce: number;
}

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  streamingMessageId: string | null;
  /** 定位到指定消息的请求（滚动并短暂高亮） */
  locateRequest?: LocateRequest | null;
}

/**
 * 消息列表组件
 */
export function MessageList({
  messages,
  isStreaming,
  streamingMessageId,
  locateRequest,
}: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming]);

  // 响应定位请求：滚动到目标消息并短暂高亮
  useEffect(() => {
    if (!locateRequest) return;

    const container = listRef.current;
    if (!container) return;

    const target = container.querySelector<HTMLElement>(
      `[data-message-id="${locateRequest.messageId}"]`
    );
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('message-locate-highlight');

    const timer = setTimeout(() => {
      target.classList.remove('message-locate-highlight');
    }, LOCATE_HIGHLIGHT_DURATION);

    return () => {
      clearTimeout(timer);
      target.classList.remove('message-locate-highlight');
    };
  }, [locateRequest]);

  if (messages.length === 0) {
    return (
      <div className="message-list-empty">
        <Empty
          image={<MessageOutlined style={{ fontSize: 64, color: 'var(--color-text-tertiary)' }} />}
          description={
            <div className="empty-description">
              <h3>开始新对话</h3>
              <p>在下方输入框中输入消息，开始与 AI 对话</p>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="message-list" ref={listRef}>
      <div className="message-list-content">
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            isStreaming={isStreaming && message.id === streamingMessageId}
          />
        ))}
      </div>
      <div ref={bottomRef} className="scroll-anchor" />
    </div>
  );
}
