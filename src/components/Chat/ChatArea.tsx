import { useCallback, useState } from 'react';
import { message } from 'antd';
import { MessageList } from './MessageList';
import type { LocateRequest } from './MessageList';
import { SessionOverview } from './SessionOverview';
import { InputArea } from './InputArea';
import { useChatStore } from '../../stores/chatStore';
import { useConfigStore } from '../../stores/configStore';
import { sendMessageStream } from '../../services/api';
import { createStreamHandler, toMessageStats } from '../../services/stream';
import { parseError, logError, shouldShowConfigPanel } from '../../services/errorHandler';
import { useUIStore } from '../../stores/uiStore';
import { buildSessionOverview } from '../../utils/sessionOverview';
import type { APIMessage } from '../../types';
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
    streamingMessageId,
    streamingStage,
    streamingConversationId,
    interruptions,
    getActiveConversation,
    addMessage,
    startStreaming,
    appendStreamContent,
    finishStreaming,
    cancelStreaming,
    createConversation,
  } = useChatStore();

  const { config, isValid: isConfigValid } = useConfigStore();
  const { setConfigPanelVisible } = useUIStore();

  const conversation = getActiveConversation();
  const messages = conversation?.messages || [];

  // 概览定位请求（nonce 保证连续定位同一条消息也能触发）
  const [locateRequest, setLocateRequest] = useState<LocateRequest | null>(null);

  const handleLocate = useCallback((messageId: string) => {
    setLocateRequest({ messageId, nonce: Date.now() });
  }, []);

  // 会话概览完全由消息列表与当前流式状态派生，
  // 因此重新进入页面后概览轮数与下方消息条数始终一致
  const isStreamingHere =
    isStreaming && streamingConversationId === activeConversationId;
  const overview = buildSessionOverview(messages, {
    isStreaming: isStreamingHere,
    streamingStage: isStreamingHere ? streamingStage : null,
    streamingMessageId: isStreamingHere ? streamingMessageId : null,
    interruption: activeConversationId
      ? interruptions[activeConversationId] ?? null
      : null,
  });

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

      // 开始流式响应
      startStreaming(conversationId);

      try {
        const stream = sendMessageStream(apiMessages, {
          ...config,
          stream: true,
        });

        await streamHandler.start(stream, {
          onChunk: (chunk) => {
            appendStreamContent(chunk);
          },
          onComplete: (stats) => {
            finishStreaming(toMessageStats(stats));
          },
          onError: (error) => {
            const appError = parseError(error);
            logError(appError, 'ChatArea.handleSend');
            message.error(appError.message);
            cancelStreaming('error');

            if (shouldShowConfigPanel(appError)) {
              setConfigPanelVisible(true);
            }
          },
        });
      } catch (error) {
        const appError = parseError(error);
        logError(appError, 'ChatArea.handleSend');
        message.error(appError.message);
        cancelStreaming('error');

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
      appendStreamContent,
      finishStreaming,
      cancelStreaming,
      setConfigPanelVisible,
    ]
  );

  const handleStop = useCallback(() => {
    streamHandler.abort();
    cancelStreaming('manual');
    message.info('已停止响应');
  }, [cancelStreaming]);

  return (
    <div className="chat-area">
      <SessionOverview overview={overview} onLocate={handleLocate} />
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        streamingMessageId={streamingMessageId}
        locateRequest={locateRequest}
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
