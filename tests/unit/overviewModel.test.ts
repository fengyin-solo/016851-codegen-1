import { describe, it, expect } from 'vitest';
import {
  deriveSessionOverview,
  getGeneratingElapsed,
} from '../../src/components/Chat/overviewModel';
import type { Message } from '../../src/types';

function userMessage(id: string, content = 'hi'): Message {
  return { id, role: 'user', content, timestamp: 1000, status: 'complete' };
}

function assistantMessage(id: string, overrides: Partial<Message> = {}): Message {
  return {
    id,
    role: 'assistant',
    content: 'hello',
    timestamp: 2000,
    status: 'complete',
    ...overrides,
  };
}

describe('deriveSessionOverview', () => {
  it('空会话：所有项禁用且轮数为 0', () => {
    const overview = deriveSessionOverview([], {
      isGenerating: false,
      messageId: null,
      phase: null,
    });

    expect(overview.rounds).toBe(0);
    expect(overview.messageCount).toBe(0);
    expect(overview.roundsTarget.disabled).toBe(true);
    expect(overview.durationTarget.disabled).toBe(true);
    expect(overview.statusTarget.disabled).toBe(true);
    expect(overview.isGenerating).toBe(false);
    expect(overview.lastResponseTime).toBeNull();
  });

  it('轮数始终等于消息条数（含 user / assistant / 流式占位）', () => {
    const messages = [
      userMessage('u1'),
      assistantMessage('a1', { stats: { responseTime: 500, tokenCount: 10 } }),
      userMessage('u2'),
      assistantMessage('a2', { status: 'streaming', content: '', timestamp: 3000 }),
    ];

    const overview = deriveSessionOverview(messages, {
      isGenerating: true,
      messageId: 'a2',
      phase: 'connecting',
    });

    expect(overview.messageCount).toBe(4);
    expect(overview.rounds).toBe(4);
    expect(overview.isGenerating).toBe(true);
    expect(overview.generatingMessageId).toBe('a2');
    expect(overview.generatingPhase).toBe('connecting');
    // 生成中的实时耗时优先；最近一次已完成回复耗时仍是 a1
    expect(overview.lastResponseTime).toBe(500);
    expect(overview.roundsTarget.messageId).toBe('a2');
    expect(overview.statusTarget.messageId).toBe('a2');
  });

  it('最近回复耗时取自最近一条已完成助手消息', () => {
    const messages = [
      userMessage('u1'),
      assistantMessage('a1', { stats: { responseTime: 1234, tokenCount: 5 } }),
    ];

    const overview = deriveSessionOverview(messages, {
      isGenerating: false,
      messageId: null,
      phase: null,
    });

    expect(overview.lastResponseTime).toBe(1234);
    expect(overview.durationTarget.messageId).toBe('a1');
    expect(overview.statusTarget.disabled).toBe(false);
  });

  it('超时中断后：状态项指向出错的回复，耗时项显示未完成目标', () => {
    const messages = [
      userMessage('u1'),
      assistantMessage('a1', {
        status: 'error',
        content: '',
        stopInfo: { reason: 'timeout', phase: 'waiting' },
      }),
    ];

    const overview = deriveSessionOverview(messages, {
      isGenerating: false,
      messageId: null,
      phase: null,
    });

    expect(overview.isGenerating).toBe(false);
    expect(overview.lastResponseTime).toBeNull();
    expect(overview.lastReply?.stopInfo?.reason).toBe('timeout');
    expect(overview.lastReply?.stopInfo?.phase).toBe('waiting');
    expect(overview.durationTarget.messageId).toBe('a1');
    expect(overview.statusTarget.messageId).toBe('a1');
  });

  it('正在生成的消息不在当前消息列表中时，不视为生成中（切对话场景）', () => {
    const messages = [userMessage('u1')];
    const overview = deriveSessionOverview(messages, {
      isGenerating: true,
      messageId: 'other-conversation-msg',
      phase: 'streaming',
    });

    expect(overview.isGenerating).toBe(false);
    expect(overview.generatingMessageId).toBeNull();
  });
});

describe('getGeneratingElapsed', () => {
  it('根据消息时间戳计算已耗时', () => {
    const messages = [
      assistantMessage('a1', { timestamp: 1000, status: 'streaming' }),
    ];
    expect(getGeneratingElapsed(messages, 'a1', 2500)).toBe(1500);
  });

  it('没有生成消息时返回 null', () => {
    expect(getGeneratingElapsed([], null, 1000)).toBeNull();
    expect(getGeneratingElapsed([], 'x', 1000)).toBeNull();
  });
});
