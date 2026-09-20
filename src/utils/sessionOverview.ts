import type { Message, StreamingStage, StreamInterruption } from '../types';

/**
 * 会话概览数据
 * 全部由消息列表与当前流式状态派生，不单独持久化，
 * 因此重新进入页面后概览中的轮数与下方消息条数始终一致
 */
export interface SessionOverviewData {
  /** 对话轮数（用户消息条数，每条用户消息开启一轮问答） */
  roundCount: number;
  /** 最近一次回复耗时（毫秒），还没有完成的回复时为 null */
  lastResponseTime: number | null;
  /** 最近一条已完成回复的消息 ID（用于定位） */
  lastReplyMessageId: string | null;
  /** 最近一条用户消息 ID（用于定位最近一轮） */
  lastUserMessageId: string | null;
  /** 当前会话是否正在生成 */
  isStreaming: boolean;
  /** 当前生成所处阶段 */
  streamingStage: StreamingStage | null;
  /** 正在生成的消息 ID（用于定位） */
  streamingMessageId: string | null;
  /** 最近一次中断记录（等待超时/手动停止后展示停在哪一步） */
  interruption: StreamInterruption | null;
}

/**
 * 概览派生所需的流式状态
 */
export interface OverviewStreamState {
  isStreaming: boolean;
  streamingStage: StreamingStage | null;
  streamingMessageId: string | null;
  interruption: StreamInterruption | null;
}

/**
 * 计算对话轮数
 * 每条用户消息代表一轮问答的开始
 */
export function getRoundCount(messages: Message[]): number {
  return messages.filter((msg) => msg.role === 'user').length;
}

/**
 * 获取最近一条用户消息（最近一轮的起点）
 */
export function getLastUserMessage(messages: Message[]): Message | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg && msg.role === 'user') {
      return msg;
    }
  }
  return null;
}

/**
 * 获取最近一条已完成的助手回复（带有耗时统计）
 */
export function getLastCompletedReply(messages: Message[]): Message | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (
      msg &&
      msg.role === 'assistant' &&
      msg.status === 'complete' &&
      msg.stats &&
      typeof msg.stats.responseTime === 'number'
    ) {
      return msg;
    }
  }
  return null;
}

/**
 * 由消息列表与流式状态派生会话概览
 * 纯函数，不修改入参
 */
export function buildSessionOverview(
  messages: Message[],
  stream: OverviewStreamState
): SessionOverviewData {
  const lastReply = getLastCompletedReply(messages);
  const lastUser = getLastUserMessage(messages);

  return {
    roundCount: getRoundCount(messages),
    lastResponseTime: lastReply?.stats?.responseTime ?? null,
    lastReplyMessageId: lastReply?.id ?? null,
    lastUserMessageId: lastUser?.id ?? null,
    isStreaming: stream.isStreaming,
    streamingStage: stream.isStreaming ? stream.streamingStage : null,
    streamingMessageId: stream.isStreaming ? stream.streamingMessageId : null,
    interruption: stream.isStreaming ? null : stream.interruption,
  };
}
