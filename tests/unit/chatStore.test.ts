import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from '../../src/stores/chatStore';
import type { Conversation } from '../../src/types';

const STORE_KEY = 'react-chat-conversations';

function seedStorage(conversations: Conversation[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(conversations));
}

function resetStore() {
  useChatStore.setState({
    conversations: [],
    activeConversationId: null,
    isStreaming: false,
    streamingConversationId: null,
    streamingPhase: null,
    streamingContent: '',
    streamingMessageId: null,
    initialized: false,
  });
}

beforeEach(() => {
  resetStore();
  localStorage.clear();
});

describe('chatStore', () => {
  it('重新进入：未完成的流式消息标记为中断错误，条数与内容保持不变', () => {
    const now = Date.now();
    seedStorage([
      {
        id: 'c1',
        title: '中断的对话',
        createdAt: now,
        updatedAt: now,
        messages: [
          { id: 'u1', role: 'user', content: '问题', timestamp: now, status: 'complete' },
          {
            id: 'a1',
            role: 'assistant',
            content: '已经生成到一半的内容',
            timestamp: now + 10,
            status: 'streaming',
          },
        ],
      },
    ]);

    useChatStore.getState().initConversations();

    const conv = useChatStore.getState().conversations[0]!;
    expect(conv.messages).toHaveLength(2);

    const interrupted = conv.messages[1]!;
    expect(interrupted.status).toBe('error');
    // 已拿到的响应内容不能被改动
    expect(interrupted.content).toBe('已经生成到一半的内容');
    expect(interrupted.stopInfo?.reason).toBe('interrupted');
    expect(interrupted.stopInfo?.phase).toBe('streaming');

    // 全局流式状态在重新进入后必须复位
    const state = useChatStore.getState();
    expect(state.isStreaming).toBe(false);
    expect(state.streamingMessageId).toBeNull();
    expect(state.streamingPhase).toBeNull();
  });

  it('发送流程：用户消息与占位回复即时入列，概览轮数随条数同步', () => {
    const id = useChatStore.getState().createConversation('测试');
    expect(useChatStore.getState().conversations[0]!.messages).toHaveLength(0);

    useChatStore.getState().addMessage(id, { role: 'user', content: '你好' });
    expect(useChatStore.getState().getActiveConversation()!.messages).toHaveLength(1);

    useChatStore.getState().startStreaming(id);
    const stateAfterStart = useChatStore.getState();
    expect(stateAfterStart.isStreaming).toBe(true);
    expect(stateAfterStart.streamingConversationId).toBe(id);
    expect(stateAfterStart.streamingPhase).toBe('connecting');
    expect(stateAfterStart.getActiveConversation()!.messages).toHaveLength(2);

    useChatStore.getState().setStreamingPhase('waiting');
    expect(useChatStore.getState().streamingPhase).toBe('waiting');

    useChatStore.getState().appendStreamContent('第一');
    useChatStore.getState().appendStreamContent('段');
    const streamingMsg = useChatStore
      .getState()
      .conversations[0]!.messages.find((m) => m.id === stateAfterStart.streamingMessageId)!;
    expect(streamingMsg.content).toBe('第一段');

    useChatStore.getState().finishStreaming({ responseTime: 800, tokenCount: 3 });
    const finalState = useChatStore.getState();
    expect(finalState.isStreaming).toBe(false);
    const doneMsg = finalState.conversations[0]!.messages[1]!;
    expect(doneMsg.status).toBe('complete');
    expect(doneMsg.content).toBe('第一段');
    expect(doneMsg.stats).toEqual({ responseTime: 800, tokenCount: 3 });
  });

  it('超时取消：已接收内容保留，记录停留阶段，轮数与条数仍一致', () => {
    const id = useChatStore.getState().createConversation('测试');
    useChatStore.getState().addMessage(id, { role: 'user', content: 'q' });
    const streamingId = useChatStore.getState().startStreaming(id);
    useChatStore.getState().appendStreamContent('部分');

    useChatStore.getState().cancelStreaming({
      reason: 'timeout',
      phase: 'streaming',
      elapsed: 42,
    });

    const messages = useChatStore.getState().conversations[0]!.messages;
    expect(messages).toHaveLength(2);
    const reply = messages.find((m) => m.id === streamingId)!;
    expect(reply.status).toBe('error');
    expect(reply.content).toBe('部分');
    expect(reply.stopInfo).toEqual({ reason: 'timeout', phase: 'streaming', elapsed: 42 });
  });

  it('切换到别的对话时，流式内容仍按消息 ID 写入正确的对话', () => {
    const id1 = useChatStore.getState().createConversation('对话1');
    const id2 = useChatStore.getState().createConversation('对话2');
    useChatStore.getState().addMessage(id1, { role: 'user', content: '在1中提问' });
    const streamingId = useChatStore.getState().startStreaming(id1);

    // 当前活动对话切到 id2
    useChatStore.getState().setActiveConversation(id2);
    useChatStore.getState().appendStreamContent('给对话1的回复');

    const conv1 = useChatStore.getState().conversations.find((c) => c.id === id1)!;
    const conv2 = useChatStore.getState().conversations.find((c) => c.id === id2)!;
    expect(conv1.messages.find((m) => m.id === streamingId)?.content).toBe('给对话1的回复');
    expect(conv2.messages).toHaveLength(0);
  });
});
