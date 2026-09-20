import { useCallback } from 'react';
import { message } from 'antd';
import { useChatStore } from '../stores/chatStore';
import { useConfigStore } from '../stores/configStore';
import { useUIStore } from '../stores/uiStore';
import { sendMessageStream } from '../services/api';
import {
  createStreamHandler,
  toMessageStats,
  PHASE_LABELS,
  type StreamTimeoutError,
} from '../services/stream';
import { parseError, logError, shouldShowConfigPanel } from '../services/errorHandler';
import type { APIMessage, StopInfo } from '../types';

// 创建流处理器实例
const streamHandler = createStreamHandler();

/**
 * 聊天功能 Hook
 */
export function useChat() {
  const {
    conversations,
    activeConversationId,
    isStreaming,
    streamingMessageId,
    getActiveConversation,
    createConversation,
    deleteConversation,
    setActiveConversation,
    addMessage,
    startStreaming,
    setStreamingPhase,
    appendStreamContent,
    finishStreaming,
    cancelStreaming,
  } = useChatStore();

  const { config, isValid: isConfigValid } = useConfigStore();
  const { setConfigPanelVisible } = useUIStore();

  const conversation = getActiveConversation();
  const messages = conversation?.messages || [];

  /**
   * 发送消息
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!activeConversationId) {
        message.warning('请先创建或选择一个对话');
        return;
      }

      if (!isConfigValid) {
        message.warning('请先配置 API Key');
        setConfigPanelVisible(true);
        return;
      }

      // 添加用户消息
      addMessage(activeConversationId, {
        role: 'user',
        content,
        status: 'complete',
      });

      // 准备 API 消息
      const apiMessages: APIMessage[] = [
        ...messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        { role: 'user' as const, content },
      ];

      // 开始流式响应
      startStreaming(activeConversationId);

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
          logError(appError, 'useChat.sendMessage');
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
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        const appError = parseError(error);
        logError(appError, 'useChat.sendMessage.connect');
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
      messages,
      addMessage,
      startStreaming,
      setStreamingPhase,
      appendStreamContent,
      finishStreaming,
      cancelStreaming,
      setConfigPanelVisible,
    ]
  );

  /**
   * 停止流式响应
   */
  const stopStreaming = useCallback(() => {
    streamHandler.abort();
    cancelStreaming({ reason: 'aborted' });
    message.info('已停止响应');
  }, [cancelStreaming]);

  /**
   * 创建新对话并发送消息
   */
  const startNewChat = useCallback(
    async (content?: string) => {
      const id = createConversation();
      if (content) {
        // 等待状态更新后发送消息
        setTimeout(() => {
          sendMessage(content);
        }, 0);
      }
      return id;
    },
    [createConversation, sendMessage]
  );

  return {
    // State
    conversations,
    activeConversationId,
    conversation,
    messages,
    isStreaming,
    streamingMessageId,
    isConfigValid,

    // Actions
    sendMessage,
    stopStreaming,
    startNewChat,
    createConversation,
    deleteConversation,
    setActiveConversation,
  };
}
