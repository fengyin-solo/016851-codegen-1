import { useCallback, useRef, useState } from 'react';
import { message } from 'antd';
import { MessageList, type MessageListHandle } from './MessageList';
import { InputArea } from './InputArea';
import { SessionOverview } from './SessionOverview';
import { useChatStore } from '../../stores/chatStore';
import { useConfigStore } from '../../stores/configStore';
import { sendMessageStream } from '../../services/api';
import {
  createStreamHandler,
  toMessageStats,
  PHASE_LABELS,
  type StreamTimeoutError,
} from '../../services/stream';
import { parseError, logError, shouldShowConfigPanel } from '../../services/errorHandler';
import { useUIStore } from '../../stores/uiStore';
import type { APIMessage, StopInfo } from '../../types';
import './ChatArea.css';

// 创建流处理器实例
const streamHandler = createStreamHandler();

/**
 * 聊天区域主组件
 */
export function ChatArea() {
  const {
    activeConversationId,
    isStreaming,
    streamingConversationId,
    streamingMessageId,
    streamingPhase,
    getActiveConversation,
    addMessage,
    startStreaming,
    setStreamingPhase,
    appendStreamContent,
    finishStreaming,
    cancelStreaming,
    createConversation,
  } = useChatStore();

  const { config, isValid: isConfigValid } = useConfigStore();
  const { setConfigPanelVisible } = useUIStore();

  const conversation = getActiveConversation();
  const messages = conversation?.messages || [];

  // 概览定位：高亮目标消息
  const messageListRef = useRef<MessageListHandle>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLocate = useCallback((messageId: string) => {
    messageListRef.current?.scrollToMessage(messageId);
    // 重新触发高亮动画
    setHighlightedMessageId(null);
    requestAnimationFrame(() => setHighlightedMessageId(messageId));
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedMessageId(null);
    }, 2000);
  }, []);

  const handleSend = useCallback(
    async (content: string) => {
      if (!isConfigValid) {
        message.warning('请先配置 API Key');
        setConfigPanelVisible(true);
        return;
      }

      // 如果没有活动对话，自动创建一个
      let conversationId = activeConversationId;
      if (!conversationId) {
        conversationId = createConversation();
      }

      // 获取当前对话的历史消息（在添加新消息之前）
      const stateBeforeAdd = useChatStore.getState();
      const currentConversation = stateBeforeAdd.conversations.find(c => c.id === conversationId);
      const historyMessages = currentConversation?.messages || [];

      // 添加用户消息
      addMessage(conversationId, {
        role: 'user',
        content,
        status: 'complete',
      });

      // 准备 API 消息（历史消息 + 当前消息）
      const apiMessages: APIMessage[] = [
        ...historyMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        { role: 'user' as const, content },
      ];

      // 开始流式响应（占位消息立即出现，概览轮数同步 +1）
      startStreaming(conversationId);

      // 先准备处理器，拿到 signal，保证“建立连接”阶段也受超时保护
      const signal = streamHandler.prepare({
        onChunk: (chunk) => {
          appendStreamContent(chunk);
        },
        onPhaseChange: (phase) => {
          setStreamingPhase(phase);
        },
        onComplete: (stats) => {
          finishStreaming(toMessageStats(stats));
        },
        onError: (error) => {
          const appError = parseError(error);
          logError(appError, 'ChatArea.handleSend');
          message.error(appError.message);

          let stopInfo: StopInfo | undefined;
          if ((error as StreamTimeoutError | undefined)?.isTimeout) {
            const timeoutError = error as StreamTimeoutError;
            stopInfo = {
              reason: 'timeout',
              phase: timeoutError.phase,
              elapsed: timeoutError.elapsed,
            };
            message.warning(`等待超时，停在「${PHASE_LABELS[timeoutError.phase]}」阶段`);
          }

          cancelStreaming(stopInfo);

          if (shouldShowConfigPanel(appError)) {
            setConfigPanelVisible(true);
          }
        },
      });

      try {
        const stream = sendMessageStream(
          apiMessages,
          {
            ...config,
            stream: true,
          },
          {
            signal,
            onConnected: () => streamHandler.notifyConnected(),
          },
        );

        await streamHandler.consume(stream);
      } catch (error) {
        // 创建请求阶段（建立连接）就失败：清理处理器内部计时器
        streamHandler.abort();
        // 超时已在 onError 中处理过（底层请求因 abort 抛出 AbortError）
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        const appError = parseError(error);
        logError(appError, 'ChatArea.handleSend.connect');
        message.error(appError.message);
        cancelStreaming();

        if (shouldShowConfigPanel(appError)) {
          setConfigPanelVisible(true);
        }
      }
    },
    [
      activeConversationId,
      isConfigValid,
      config,
      addMessage,
      startStreaming,
      setStreamingPhase,
      appendStreamContent,
      finishStreaming,
      cancelStreaming,
      setConfigPanelVisible,
      createConversation,
    ]
  );

  const handleStop = useCallback(() => {
    streamHandler.abort();
    cancelStreaming({ reason: 'aborted' });
    message.info('已停止响应');
  }, [cancelStreaming]);

  // 生成状态以“当前查看的对话”为准：切换到别的对话时概览不显示生成中
  const isConversationStreaming =
    isStreaming && streamingConversationId !== null && streamingConversationId === activeConversationId;

  return (
    <div className="chat-area">
      <SessionOverview
        messages={messages}
        isGenerating={isConversationStreaming}
        generatingMessageId={isConversationStreaming ? streamingMessageId : null}
        generatingPhase={isConversationStreaming ? streamingPhase : null}
        onLocate={handleLocate}
      />
      <MessageList
        ref={messageListRef}
        messages={messages}
        isStreaming={isConversationStreaming}
        streamingMessageId={streamingMessageId}
        highlightedMessageId={highlightedMessageId}
      />
      <InputArea
        onSend={handleSend}
        onStop={handleStop}
        isLoading={false}
        isStreaming={isStreaming}
        disabled={false}
      />
    </div>
  );
}
