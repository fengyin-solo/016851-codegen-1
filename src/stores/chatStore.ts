import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Conversation, Message, CreateMessageParams, StopInfo, StreamPhase } from '../types';
import { saveConversations, loadConversations } from '../services/storage';
import { generateConversationTitle } from '../utils/formatters';

interface ChatState {
  /** 对话列表 */
  conversations: Conversation[];
  /** 当前活动对话 ID */
  activeConversationId: string | null;
  /** 是否正在流式响应 */
  isStreaming: boolean;
  /** 正在生成的对话 ID（生成与当前查看的对话可能不同） */
  streamingConversationId: string | null;
  /** 流式响应当前所处阶段 */
  streamingPhase: StreamPhase | null;
  /** 流式响应累积内容 */
  streamingContent: string;
  /** 流式响应消息 ID */
  streamingMessageId: string | null;
  /** 是否已初始化 */
  initialized: boolean;
}

interface ChatActions {
  /** 初始化（从 localStorage 加载） */
  initConversations: () => void;
  /** 创建新对话 */
  createConversation: (title?: string) => string;
  /** 删除对话 */
  deleteConversation: (id: string) => void;
  /** 设置活动对话 */
  setActiveConversation: (id: string | null) => void;
  /** 添加消息到对话 */
  addMessage: (conversationId: string, params: CreateMessageParams) => string;
  /** 更新消息 */
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  /** 开始流式响应 */
  startStreaming: (conversationId: string) => string;
  /** 更新流式响应阶段 */
  setStreamingPhase: (phase: StreamPhase) => void;
  /** 追加流式内容 */
  appendStreamContent: (content: string) => void;
  /** 完成流式响应 */
  finishStreaming: (stats?: Message['stats']) => void;
  /** 取消流式响应 */
  cancelStreaming: (stopInfo?: StopInfo) => void;
  /** 获取当前活动对话 */
  getActiveConversation: () => Conversation | null;
  /** 清除所有对话 */
  clearAllConversations: () => void;
  /** 更新对话标题 */
  updateConversationTitle: (id: string, title: string) => void;
}

type ChatStore = ChatState & ChatActions;

// 持久化保存（防抖）
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
const debouncedSave = (conversations: Conversation[]) => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    try {
      saveConversations(conversations);
    } catch (error) {
      console.error('Failed to save conversations:', error);
    }
  }, 500);
};

/**
 * 规范化从存储中恢复的消息：
 * 重新进入应用后，上次未完成的流式响应无法继续，
 * 标记为错误并记录停留阶段，保证概览轮数与消息条数一致。
 */
function normalizeMessages(messages: Message[]): Message[] {
  return messages.map((msg) => {
    if (msg.status === 'streaming' || msg.status === 'pending') {
      return {
        ...msg,
        status: 'error' as const,
        stopInfo: {
          reason: 'interrupted' as const,
          phase: 'streaming' as const,
        },
      };
    }
    return msg;
  });
}

export const useChatStore = create<ChatStore>((set, get) => ({
  // Initial state
  conversations: [],
  activeConversationId: null,
  isStreaming: false,
  streamingConversationId: null,
  streamingPhase: null,
  streamingContent: '',
  streamingMessageId: null,
  initialized: false,

  // Actions
  initConversations: () => {
    const loaded = loadConversations();
    const conversations = loaded.map((conv) => ({
      ...conv,
      messages: normalizeMessages(conv.messages),
    }));
    // 重新进入时没有进行中的生成，重置流式状态
    const activeId = conversations.length > 0 ? conversations[0]?.id ?? null : null;

    set({
      conversations,
      activeConversationId: activeId,
      isStreaming: false,
      streamingConversationId: null,
      streamingPhase: null,
      streamingContent: '',
      streamingMessageId: null,
      initialized: true,
    });
  },

  createConversation: (title) => {
    const id = uuidv4();
    const now = Date.now();

    const newConversation: Conversation = {
      id,
      title: title || '新对话',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    set(state => {
      const conversations = [newConversation, ...state.conversations];
      debouncedSave(conversations);
      return {
        conversations,
        activeConversationId: id,
      };
    });

    return id;
  },

  deleteConversation: (id) => {
    set(state => {
      const conversations = state.conversations.filter(c => c.id !== id);
      debouncedSave(conversations);

      // 如果删除的是当前活动对话，切换到第一个对话
      let activeConversationId = state.activeConversationId;
      if (activeConversationId === id) {
        activeConversationId = conversations[0]?.id ?? null;
      }

      return {
        conversations,
        activeConversationId,
      };
    });
  },

  setActiveConversation: (id) => {
    set({ activeConversationId: id });
  },

  addMessage: (conversationId, params) => {
    const messageId = uuidv4();
    const now = Date.now();

    const newMessage: Message = {
      id: messageId,
      role: params.role,
      content: params.content,
      timestamp: now,
      status: params.status || 'complete',
    };

    set(state => {
      const conversations = state.conversations.map(conv => {
        if (conv.id !== conversationId) return conv;

        const messages = [...conv.messages, newMessage];

        // 如果是第一条用户消息，自动生成标题
        let title = conv.title;
        if (params.role === 'user' && conv.messages.length === 0) {
          title = generateConversationTitle(params.content);
        }

        return {
          ...conv,
          messages,
          title,
          updatedAt: now,
        };
      });

      // 重新排序（按更新时间降序）
      conversations.sort((a, b) => b.updatedAt - a.updatedAt);

      debouncedSave(conversations);
      return { conversations };
    });

    return messageId;
  },

  updateMessage: (conversationId, messageId, updates) => {
    set(state => {
      const conversations = state.conversations.map(conv => {
        if (conv.id !== conversationId) return conv;

        const messages = conv.messages.map(msg => {
          if (msg.id !== messageId) return msg;
          return { ...msg, ...updates };
        });

        return {
          ...conv,
          messages,
          updatedAt: Date.now(),
        };
      });

      debouncedSave(conversations);
      return { conversations };
    });
  },

  startStreaming: (conversationId) => {
    const messageId = uuidv4();
    const now = Date.now();

    const streamingMessage: Message = {
      id: messageId,
      role: 'assistant',
      content: '',
      timestamp: now,
      status: 'streaming',
    };

    set(state => {
      const conversations = state.conversations.map(conv => {
        if (conv.id !== conversationId) return conv;

        return {
          ...conv,
          messages: [...conv.messages, streamingMessage],
          updatedAt: now,
        };
      });

      return {
        conversations,
        isStreaming: true,
        streamingConversationId: conversationId,
        streamingPhase: 'connecting',
        streamingContent: '',
        streamingMessageId: messageId,
      };
    });

    return messageId;
  },

  setStreamingPhase: (phase) => {
    if (!get().isStreaming) return;
    set({ streamingPhase: phase });
  },

  appendStreamContent: (content) => {
    set(state => {
      if (!state.streamingMessageId) return state;

      const newContent = state.streamingContent + content;

      // 按消息 ID 定位，避免切换活动对话后写入错误的对话
      const streamingId = state.streamingMessageId;
      const conversations = state.conversations.map(conv => {
        const messages = conv.messages.map(msg => {
          if (msg.id !== streamingId) return msg;
          return { ...msg, content: newContent };
        });

        return { ...conv, messages };
      });

      return {
        streamingContent: newContent,
        conversations,
      };
    });
  },

  finishStreaming: (stats) => {
    set(state => {
      const streamingId = state.streamingMessageId;
      if (!streamingId) {
        return {
          isStreaming: false,
          streamingConversationId: null,
          streamingPhase: null,
          streamingContent: '',
          streamingMessageId: null,
        };
      }

      const conversations = state.conversations.map(conv => {
        const messages = conv.messages.map(msg => {
          if (msg.id !== streamingId) return msg;
          // 只更新状态/统计，已接收到的内容保持最后一次追加的结果不变
          return {
            ...msg,
            content: state.streamingContent,
            status: 'complete' as const,
            stats,
            stopInfo: undefined,
          };
        });

        return {
          ...conv,
          messages,
          updatedAt: Date.now(),
        };
      });

      debouncedSave(conversations);

      return {
        conversations,
        isStreaming: false,
        streamingConversationId: null,
        streamingPhase: null,
        streamingContent: '',
        streamingMessageId: null,
      };
    });
  },

  cancelStreaming: (stopInfo) => {
    set(state => {
      const streamingId = state.streamingMessageId;
      if (!streamingId) {
        return {
          isStreaming: false,
          streamingConversationId: null,
          streamingPhase: null,
          streamingContent: '',
          streamingMessageId: null,
        };
      }

      // 保留已接收的内容，不覆盖；仅标记状态与停止信息
      const conversations = state.conversations.map(conv => {
        const messages = conv.messages.map(msg => {
          if (msg.id !== streamingId) return msg;
          return {
            ...msg,
            status: 'error' as const,
            stopInfo,
          };
        });

        return { ...conv, messages };
      });

      debouncedSave(conversations);

      return {
        conversations,
        isStreaming: false,
        streamingConversationId: null,
        streamingPhase: null,
        streamingContent: '',
        streamingMessageId: null,
      };
    });
  },

  getActiveConversation: () => {
    const { conversations, activeConversationId } = get();
    return conversations.find(c => c.id === activeConversationId) || null;
  },

  clearAllConversations: () => {
    set({
      conversations: [],
      activeConversationId: null,
    });
    debouncedSave([]);
  },

  updateConversationTitle: (id, title) => {
    set(state => {
      const conversations = state.conversations.map(conv => {
        if (conv.id !== id) return conv;
        return { ...conv, title };
      });

      debouncedSave(conversations);
      return { conversations };
    });
  },
}));
