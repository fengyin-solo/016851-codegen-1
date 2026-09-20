import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Empty } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import type { Message } from '../../types';
import { MessageItem } from './MessageItem';
import './MessageList.css';

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  streamingMessageId: string | null;
  /** 需要高亮的消息 ID（概览定位时使用） */
  highlightedMessageId?: string | null;
}

export interface MessageListHandle {
  /** 将指定消息滚动到可视区域 */
  scrollToMessage: (messageId: string) => void;
}

/**
 * 消息列表组件
 */
export const MessageList = forwardRef<MessageListHandle, MessageListProps>(
  function MessageList(
    { messages, isStreaming, streamingMessageId, highlightedMessageId = null },
    ref,
  ) {
    const listRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef(new Map<string, HTMLDivElement>());

    const registerItemRef = useCallback((id: string, el: HTMLDivElement | null) => {
      if (el) {
        itemRefs.current.set(id, el);
      } else {
        itemRefs.current.delete(id);
      }
    }, []);

    const scrollToMessage = useCallback((messageId: string) => {
      const el = itemRefs.current.get(messageId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, []);

    useImperativeHandle(ref, () => ({ scrollToMessage }), [scrollToMessage]);

    // 自动滚动到底部（新增消息或流式内容增长时；高亮定位不触发）
    const lastMessage = messages[messages.length - 1] ?? null;
    const lastMessageKey = lastMessage
      ? `${lastMessage.id}:${lastMessage.status}:${lastMessage.content.length}`
      : 'empty';
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, [messages.length, isStreaming, lastMessageKey]);

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
            <div
              key={message.id}
              ref={(el) => registerItemRef(message.id, el)}
              className={`message-list-item${
                highlightedMessageId === message.id ? ' message-item-highlight' : ''
              }`}
              data-message-id={message.id}
            >
              <MessageItem
                message={message}
                isStreaming={isStreaming && message.id === streamingMessageId}
              />
            </div>
          ))}
        </div>
        <div ref={bottomRef} className="scroll-anchor" />
      </div>
    );
  },
);
