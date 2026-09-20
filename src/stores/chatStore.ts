import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  Conversation,
  Message,
  CreateMessageParams,
  StreamingStage,
  StreamInterruption,
  InterruptionReason,
} from '../types';
import { saveConversations, loadConversations } from '../services/storage';
import { generateConversationTitle } from '../utils/formatters';

interface ChatState {
  /** 对话列表 */
  conversations: Conversation[];
  /** 当前活动对话 ID */
  activeConversationId: string | null;
  /** 是否正在流式响应 */
  isStreaming: boolean;
  /** 流式响应累积内容 */
  streamingContent: string;
  /** 流式响应消息 ID */
  streamingMessageId: string | null;
  /** 流式响应所属对话 ID（切换对话后仍能写回正确的对话） */
  streamingConversationId: string | null;
  /** 流式响应当前所处阶段（建立连接 / 接收回复） */
  streamingStage: StreamingStage | null;
  /** 各对话最近一次流式中断记录（用于展示停在哪一步，仅本次运行内有效） */
  interruptions: Record<string, StreamInterruption>;
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
  /** 追加流式内容 */
  appendStreamContent: (content: string) => void;
  /** 完成流式响应 */
  finishStreaming: (stats?: Message['stats']) => void;
  /** 取消流式响应（记录中断时所处的阶段） */
  cancelStreaming: (reason?: InterruptionReason) => void;
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

export const useChatStore = create<ChatStore>((set, get) => ({
  // Initial state
  conversations: [],
  activeConversationId: null,
  isStreaming: false,
  streamingContent: '',
  streamingMessageId: null,
  streamingConversationId: null,
  streamingStage: null,
  interruptions: {},
  initialized: false,

  // Actions
  initConversations: () => {
    const conversations = loadConversations();
    const activeId = conversations.length > 0 ? conversations[0]?.id ?? null : null;
    
    set({
      conversations,
      activeConversationId: activeId,
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

      // 同步清理该对话的中断记录
      const interruptions = { ...state.interruptions };
      delete interruptions[id];

      return {
        conversations,
        activeConversationId,
        interruptions,
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

      // 新一轮生成开始，清除该对话上一次的中断记录
      const interruptions = { ...state.interruptions };
      delete interruptions[conversationId];

      return {
        conversations,
        isStreaming: true,
        streamingContent: '',
        streamingMessageId: messageId,
        streamingConversationId: conversationId,
        streamingStage: 'connecting' as const,
        interruptions,
      };
    });

    return messageId;
  },

  appendStreamContent: (content) => {
    set(state => {
      const newContent = state.streamingContent + content;

      // 同时更新消息内容（只改动正在流式生成的这条，已有响应保持不变）
      const conversations = state.conversations.map(conv => {
        if (conv.id !== state.streamingConversationId) return conv;

        const messages = conv.messages.map(msg => {
          if (msg.id !== state.streamingMessageId) return msg;
          return { ...msg, content: newContent };
        });

        return { ...conv, messages };
      });

      return {
        streamingContent: newContent,
        // 收到首个片段后进入「接收回复」阶段
        streamingStage: 'receiving' as const,
        conversations,
      };
    });
  },

  finishStreaming: (stats) => {
    set(state => {
      const conversations = state.conversations.map(conv => {
        if (conv.id !== state.streamingConversationId) return conv;

        const messages = conv.messages.map(msg => {
          if (msg.id !== state.streamingMessageId) return msg;
          return {
            ...msg,
            content: state.streamingContent,
            status: 'complete' as const,
            stats,
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
        streamingContent: '',
        streamingMessageId: null,
        streamingConversationId: null,
        streamingStage: null,
      };
    });
  },

  cancelStreaming: (reason = 'manual') => {
    set(state => {
      // 保留已接收的内容，但标记为错误状态
      const conversations = state.conversations.map(conv => {
        if (conv.id !== state.streamingConversationId) return conv;

        const messages = conv.messages.map(msg => {
          if (msg.id !== state.streamingMessageId) return msg;
          return {
            ...msg,
            content: state.streamingContent || '（响应已中断）',
            status: 'error' as const,
          };
        });

        return { ...conv, messages };
      });

      debouncedSave(conversations);

      // 记录中断时所处的阶段，便于在概览中展示停在哪一步
      const interruptions = { ...state.interruptions };
      if (state.streamingConversationId) {
        interruptions[state.streamingConversationId] = {
          stage: state.streamingStage ?? 'connecting',
          reason,
          messageId: state.streamingMessageId,
          timestamp: Date.now(),
        };
      }

      return {
        conversations,
        isStreaming: false,
        streamingContent: '',
        streamingMessageId: null,
        streamingConversationId: null,
        streamingStage: null,
        interruptions,
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
      interruptions: {},
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
