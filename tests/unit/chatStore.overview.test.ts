import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useChatStore } from '../../src/stores/chatStore';
import { saveConversations } from '../../src/services/storage';
import { buildSessionOverview } from '../../src/utils/sessionOverview';
import type { Conversation, Message } from '../../src/types';

const initialState = useChatStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  useChatStore.setState(initialState, true);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

function getConversation(id: string): Conversation {
  const conv = useChatStore.getState().conversations.find(c => c.id === id);
  if (!conv) throw new Error(`conversation ${id} not found`);
  return conv;
}

/** 完成一轮完整的问答（用户消息 + 流式回复） */
function runRound(conversationId: string, userContent: string, replyContent: string, responseTime: number) {
  const store = useChatStore.getState();
  store.addMessage(conversationId, { role: 'user', content: userContent });
  useChatStore.getState().startStreaming(conversationId);
  useChatStore.getState().appendStreamContent(replyContent);
  useChatStore.getState().finishStreaming({ responseTime, tokenCount: 10 });
}

describe('chatStore 流式阶段跟踪', () => {
  it('startStreaming 进入「建立连接」阶段，并清除该对话旧的中断记录', () => {
    const store = useChatStore.getState();
    const convId = store.createConversation();

    // 预置一条旧的中断记录
    useChatStore.setState(state => ({
      interruptions: {
        ...state.interruptions,
        [convId]: { stage: 'receiving', reason: 'error', messageId: 'old', timestamp: 1 },
      },
    }));

    useChatStore.getState().startStreaming(convId);

    const state = useChatStore.getState();
    expect(state.isStreaming).toBe(true);
    expect(state.streamingStage).toBe('connecting');
    expect(state.streamingConversationId).toBe(convId);
    expect(state.interruptions[convId]).toBeUndefined();
  });

  it('收到首个内容片段后进入「接收回复」阶段', () => {
    const convId = useChatStore.getState().createConversation();
    useChatStore.getState().startStreaming(convId);
    expect(useChatStore.getState().streamingStage).toBe('connecting');

    useChatStore.getState().appendStreamContent('你');
    expect(useChatStore.getState().streamingStage).toBe('receiving');

    useChatStore.getState().appendStreamContent('好');
    expect(useChatStore.getState().streamingStage).toBe('receiving');
  });

  it('finishStreaming 清除阶段信息并写入回复统计', () => {
    const convId = useChatStore.getState().createConversation();
    useChatStore.getState().startStreaming(convId);
    useChatStore.getState().appendStreamContent('回答');
    useChatStore.getState().finishStreaming({ responseTime: 1234, tokenCount: 8 });

    const state = useChatStore.getState();
    expect(state.isStreaming).toBe(false);
    expect(state.streamingStage).toBeNull();
    expect(state.streamingConversationId).toBeNull();

    const reply = getConversation(convId).messages.find(m => m.role === 'assistant');
    expect(reply?.status).toBe('complete');
    expect(reply?.stats?.responseTime).toBe(1234);
  });

  it('连接阶段中断（如等待超时）时记录停在「建立连接」', () => {
    const convId = useChatStore.getState().createConversation();
    const streamingId = useChatStore.getState().startStreaming(convId);

    useChatStore.getState().cancelStreaming('error');

    const state = useChatStore.getState();
    const interruption = state.interruptions[convId];
    expect(interruption).toBeDefined();
    expect(interruption?.stage).toBe('connecting');
    expect(interruption?.reason).toBe('error');
    expect(interruption?.messageId).toBe(streamingId);
    expect(state.streamingStage).toBeNull();
  });

  it('接收阶段手动停止时记录停在「接收回复」，已收到的内容保留', () => {
    const convId = useChatStore.getState().createConversation();
    useChatStore.getState().startStreaming(convId);
    useChatStore.getState().appendStreamContent('部分内容');

    useChatStore.getState().cancelStreaming('manual');

    const state = useChatStore.getState();
    const interruption = state.interruptions[convId];
    expect(interruption?.stage).toBe('receiving');
    expect(interruption?.reason).toBe('manual');

    const reply = getConversation(convId).messages.find(m => m.role === 'assistant');
    expect(reply?.content).toBe('部分内容');
    expect(reply?.status).toBe('error');
  });

  it('删除对话时同步清理其中断记录', () => {
    const convId = useChatStore.getState().createConversation();
    useChatStore.getState().startStreaming(convId);
    useChatStore.getState().cancelStreaming('error');
    expect(useChatStore.getState().interruptions[convId]).toBeDefined();

    useChatStore.getState().deleteConversation(convId);
    expect(useChatStore.getState().interruptions[convId]).toBeUndefined();
  });

  it('切换对话后，流式内容仍写回发起对话，不影响其他对话', () => {
    const store = useChatStore.getState();
    const convA = store.createConversation('对话 A');
    const convB = useChatStore.getState().createConversation('对话 B');

    useChatStore.getState().setActiveConversation(convA);
    useChatStore.getState().startStreaming(convA);

    // 流式进行中切换到对话 B
    useChatStore.getState().setActiveConversation(convB);
    useChatStore.getState().appendStreamContent('A 的回复');
    useChatStore.getState().finishStreaming({ responseTime: 100, tokenCount: 5 });

    const messagesA = getConversation(convA).messages;
    const replyA = messagesA.find(m => m.role === 'assistant');
    expect(replyA?.content).toBe('A 的回复');
    expect(replyA?.status).toBe('complete');

    // 对话 B 不应被写入任何内容
    expect(getConversation(convB).messages).toHaveLength(0);
  });
});

describe('chatStore 概览一致性', () => {
  it('重新进入后，概览轮数与下方消息条数保持一致', () => {
    // 模拟上一次会话留下的持久化数据：2 轮对话（4 条消息）
    const persisted: Conversation = {
      id: 'conv-persisted',
      title: '历史对话',
      createdAt: 1000,
      updatedAt: 2000,
      messages: [
        { id: 'u1', role: 'user', content: '问题一', timestamp: 1001, status: 'complete' },
        { id: 'r1', role: 'assistant', content: '回答一', timestamp: 1002, status: 'complete', stats: { responseTime: 800, tokenCount: 6 } },
        { id: 'u2', role: 'user', content: '问题二', timestamp: 1003, status: 'complete' },
        { id: 'r2', role: 'assistant', content: '回答二', timestamp: 1004, status: 'complete', stats: { responseTime: 1500, tokenCount: 9 } },
      ],
    };
    saveConversations([persisted]);

    // 模拟重新进入：从持久化数据重新初始化
    useChatStore.getState().initConversations();

    const active = useChatStore.getState().getActiveConversation();
    expect(active).not.toBeNull();
    expect(active!.messages).toHaveLength(4);

    const overview = buildSessionOverview(active!.messages, {
      isStreaming: false,
      streamingStage: null,
      streamingMessageId: null,
      interruption: null,
    });

    // 轮数来自同一份消息列表，与下方条数严格对应
    expect(overview.roundCount).toBe(2);
    expect(overview.roundCount).toBe(
      active!.messages.filter((m: Message) => m.role === 'user').length
    );
    expect(overview.lastResponseTime).toBe(1500);
    expect(overview.lastReplyMessageId).toBe('r2');
    expect(overview.lastUserMessageId).toBe('u2');
  });

  it('发起后续操作时概览跟着变，且已拿到的响应不被改动', () => {
    const convId = useChatStore.getState().createConversation();

    // 第一轮
    runRound(convId, '问题一', '回答一', 800);

    const firstReply = getConversation(convId).messages.find(m => m.role === 'assistant');
    expect(firstReply).toBeDefined();
    const firstReplySnapshot = JSON.parse(JSON.stringify(firstReply));

    // 第二轮（后续操作）
    runRound(convId, '问题二', '回答二', 1500);

    const messages = getConversation(convId).messages;
    expect(messages).toHaveLength(4);

    // 概览跟着变
    const overview = buildSessionOverview(messages, {
      isStreaming: false,
      streamingStage: null,
      streamingMessageId: null,
      interruption: null,
    });
    expect(overview.roundCount).toBe(2);
    expect(overview.lastResponseTime).toBe(1500);

    // 已经拿到的响应不能被改动（引用与内容都保持不变）
    const firstReplyAfter = messages.find(m => m.id === firstReply!.id);
    expect(firstReplyAfter).toBe(firstReply);
    expect(firstReplyAfter).toEqual(firstReplySnapshot);
  });

  it('流式追加内容时，同对话的其他消息保持原样', () => {
    const convId = useChatStore.getState().createConversation();
    runRound(convId, '问题一', '回答一', 800);

    const before = getConversation(convId).messages;

    // 开始新一轮，流式追加多个片段
    useChatStore.getState().addMessage(convId, { role: 'user', content: '问题二' });
    useChatStore.getState().startStreaming(convId);
    useChatStore.getState().appendStreamContent('片段一');
    useChatStore.getState().appendStreamContent('片段二');

    const after = getConversation(convId).messages;

    // 第一轮的每条消息引用不变
    for (const prev of before) {
      const current = after.find(m => m.id === prev.id);
      expect(current).toBe(prev);
    }

    // 流式消息累积了全部片段
    const streaming = after[after.length - 1];
    expect(streaming?.content).toBe('片段一片段二');
    expect(streaming?.status).toBe('streaming');
  });
});
