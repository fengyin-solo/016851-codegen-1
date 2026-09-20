import { describe, it, expect } from 'vitest';
import {
  getRoundCount,
  getLastUserMessage,
  getLastCompletedReply,
  buildSessionOverview,
} from '../../src/utils/sessionOverview';
import type { Message } from '../../src/types';

let seq = 0;
function makeMessage(overrides: Partial<Message> = {}): Message {
  seq += 1;
  return {
    id: `msg-${seq}`,
    role: 'user',
    content: `内容 ${seq}`,
    timestamp: 1000 + seq,
    status: 'complete',
    ...overrides,
  };
}

function makeReply(id: string, responseTime: number): Message {
  return makeMessage({
    id,
    role: 'assistant',
    status: 'complete',
    stats: { responseTime, tokenCount: 10 },
  });
}

const idleStream = {
  isStreaming: false,
  streamingStage: null,
  streamingMessageId: null,
  interruption: null,
} as const;

describe('getRoundCount', () => {
  it('空消息列表时轮数为 0', () => {
    expect(getRoundCount([])).toBe(0);
  });

  it('每条用户消息计为一轮', () => {
    const messages = [
      makeMessage({ role: 'user' }),
      makeMessage({ role: 'assistant' }),
      makeMessage({ role: 'user' }),
      makeMessage({ role: 'assistant' }),
      makeMessage({ role: 'user' }),
    ];
    expect(getRoundCount(messages)).toBe(3);
  });

  it('不计入 system 消息', () => {
    const messages = [
      makeMessage({ role: 'system' }),
      makeMessage({ role: 'user' }),
      makeMessage({ role: 'assistant' }),
    ];
    expect(getRoundCount(messages)).toBe(1);
  });
});

describe('getLastUserMessage', () => {
  it('空列表返回 null', () => {
    expect(getLastUserMessage([])).toBeNull();
  });

  it('返回最后一条用户消息', () => {
    const first = makeMessage({ role: 'user', id: 'u1' });
    const last = makeMessage({ role: 'user', id: 'u2' });
    const messages = [first, makeMessage({ role: 'assistant' }), last];
    expect(getLastUserMessage(messages)?.id).toBe('u2');
  });
});

describe('getLastCompletedReply', () => {
  it('没有已完成的回复时返回 null', () => {
    const messages = [
      makeMessage({ role: 'user' }),
      makeMessage({ role: 'assistant', status: 'streaming' }),
    ];
    expect(getLastCompletedReply(messages)).toBeNull();
  });

  it('返回最后一条带耗时统计的助手回复', () => {
    const messages = [
      makeReply('r1', 800),
      makeMessage({ role: 'user' }),
      makeReply('r2', 1200),
    ];
    const reply = getLastCompletedReply(messages);
    expect(reply?.id).toBe('r2');
    expect(reply?.stats?.responseTime).toBe(1200);
  });

  it('跳过缺少统计信息或状态异常的助手消息', () => {
    const messages = [
      makeReply('r1', 500),
      makeMessage({ role: 'assistant', status: 'error' }),
      makeMessage({ role: 'assistant', status: 'complete' }), // 无 stats
    ];
    expect(getLastCompletedReply(messages)?.id).toBe('r1');
  });
});

describe('buildSessionOverview', () => {
  it('一条消息都没有时给出明确的空概览', () => {
    const overview = buildSessionOverview([], idleStream);
    expect(overview.roundCount).toBe(0);
    expect(overview.lastResponseTime).toBeNull();
    expect(overview.lastReplyMessageId).toBeNull();
    expect(overview.lastUserMessageId).toBeNull();
    expect(overview.isStreaming).toBe(false);
    expect(overview.streamingStage).toBeNull();
    expect(overview.interruption).toBeNull();
  });

  it('从消息列表派生轮数、最近耗时与定位目标', () => {
    const messages = [
      makeMessage({ role: 'user', id: 'u1' }),
      makeReply('r1', 900),
      makeMessage({ role: 'user', id: 'u2' }),
      makeReply('r2', 1500),
    ];
    const overview = buildSessionOverview(messages, idleStream);

    expect(overview.roundCount).toBe(2);
    expect(overview.lastResponseTime).toBe(1500);
    expect(overview.lastReplyMessageId).toBe('r2');
    expect(overview.lastUserMessageId).toBe('u2');
  });

  it('生成中时透传流式阶段与消息 ID', () => {
    const messages = [makeMessage({ role: 'user', id: 'u1' })];
    const overview = buildSessionOverview(messages, {
      ...idleStream,
      isStreaming: true,
      streamingStage: 'receiving',
      streamingMessageId: 'streaming-1',
    });

    expect(overview.isStreaming).toBe(true);
    expect(overview.streamingStage).toBe('receiving');
    expect(overview.streamingMessageId).toBe('streaming-1');
  });

  it('生成中时不展示上一次的中断记录', () => {
    const interruption = {
      stage: 'connecting' as const,
      reason: 'error' as const,
      messageId: 'm1',
      timestamp: 123,
    };
    const overview = buildSessionOverview([makeMessage()], {
      ...idleStream,
      isStreaming: true,
      streamingStage: 'connecting',
      streamingMessageId: 'streaming-1',
      interruption,
    });

    expect(overview.interruption).toBeNull();
  });

  it('空闲时保留中断记录（停在哪一步）', () => {
    const interruption = {
      stage: 'receiving' as const,
      reason: 'error' as const,
      messageId: 'm1',
      timestamp: 123,
    };
    const overview = buildSessionOverview([makeMessage()], {
      ...idleStream,
      interruption,
    });

    expect(overview.interruption).toEqual(interruption);
  });
});
