import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  getRoundCount,
  getLastUserMessage,
  getLastCompletedReply,
  buildSessionOverview,
} from '../../src/utils/sessionOverview';
import { useChatStore } from '../../src/stores/chatStore';
import type { Message, MessageRole, MessageStatus } from '../../src/types';

const initialState = useChatStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  useChatStore.setState(initialState, true);
  vi.clearAllTimers();
  vi.useRealTimers();
});

// 任意消息生成器
const statsArb = fc.record({
  responseTime: fc.nat({ max: 60000 }),
  tokenCount: fc.nat({ max: 100000 }),
});

const messageArb: fc.Arbitrary<Message> = fc.record({
  id: fc.uuid(),
  role: fc.constantFrom<MessageRole>('user', 'assistant', 'system'),
  content: fc.string(),
  timestamp: fc.nat(),
  status: fc.constantFrom<MessageStatus>('pending', 'streaming', 'complete', 'error'),
  stats: fc.option(statsArb, { nil: undefined }),
});

const idleStream = {
  isStreaming: false,
  streamingStage: null,
  streamingMessageId: null,
  interruption: null,
} as const;

describe('概览派生属性', () => {
  it('任意消息列表：轮数恒等于用户消息条数', () => {
    fc.assert(
      fc.property(fc.array(messageArb, { maxLength: 50 }), (messages) => {
        const expected = messages.filter(m => m.role === 'user').length;
        expect(getRoundCount(messages)).toBe(expected);

        const overview = buildSessionOverview(messages, idleStream);
        expect(overview.roundCount).toBe(expected);
      })
    );
  });

  it('任意消息列表：最近回复恒为最后一条带耗时统计的完成回复', () => {
    fc.assert(
      fc.property(fc.array(messageArb, { maxLength: 50 }), (messages) => {
        const reply = getLastCompletedReply(messages);

        // 手工从后往前扫描得到期望值
        let expected: Message | null = null;
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i]!;
          if (
            msg.role === 'assistant' &&
            msg.status === 'complete' &&
            msg.stats &&
            typeof msg.stats.responseTime === 'number'
          ) {
            expected = msg;
            break;
          }
        }

        expect(reply).toBe(expected);
      })
    );
  });

  it('任意消息列表：最近用户消息定位目标与列表扫描结果一致', () => {
    fc.assert(
      fc.property(fc.array(messageArb, { maxLength: 50 }), (messages) => {
        const last = getLastUserMessage(messages);
        const expected = [...messages].reverse().find(m => m.role === 'user') ?? null;
        expect(last?.id ?? null).toBe(expected?.id ?? null);
      })
    );
  });

  it('任意轮次的后续操作：已拿到的响应不被改动，概览轮数与消息一致', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 4 }),
        fc.nat({ max: 60000 }),
        (rounds, chunks, responseTime) => {
          useChatStore.setState(initialState, true);
          const convId = useChatStore.getState().createConversation();

          // 每轮结束后对全部消息做深快照
          const snapshots: Message[][] = [];

          for (let round = 0; round < rounds; round++) {
            useChatStore.getState().addMessage(convId, {
              role: 'user',
              content: `问题 ${round}`,
            });
            useChatStore.getState().startStreaming(convId);
            for (const chunk of chunks) {
              useChatStore.getState().appendStreamContent(chunk);
            }
            useChatStore.getState().finishStreaming({ responseTime, tokenCount: 10 });

            const messages = useChatStore
              .getState()
              .conversations.find(c => c.id === convId)!.messages;
            snapshots.push(JSON.parse(JSON.stringify(messages)));
          }

          const finalMessages = useChatStore
            .getState()
            .conversations.find(c => c.id === convId)!.messages;

          // 条数：每轮一条用户消息 + 一条助手回复
          expect(finalMessages).toHaveLength(rounds * 2);

          // 已拿到的响应（以及所有历史消息）在后续操作中不被改动
          for (const snapshot of snapshots) {
            const prefix = finalMessages.slice(0, snapshot.length);
            expect(prefix).toEqual(snapshot);
          }

          // 概览轮数与下方消息条数保持相同来源
          const overview = buildSessionOverview(finalMessages, idleStream);
          expect(overview.roundCount).toBe(rounds);
          expect(overview.roundCount).toBe(
            finalMessages.filter(m => m.role === 'user').length
          );
          expect(overview.lastResponseTime).toBe(responseTime);
        }
      )
    );
  });
});
