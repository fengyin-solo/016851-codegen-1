import type { Message, StopReason, StreamPhase } from '../../types';

/**
 * 会话概览中一个统计项的跳转目标
 */
export interface OverviewTarget {
  /** 目标消息 ID */
  messageId: string;
  /** 不可定位（没有对应消息） */
  disabled: boolean;
}

/**
 * 会话概览派生数据
 */
export interface SessionOverviewData {
  /** 轮数（与下方消息条数一致） */
  rounds: number;
  /** 下方消息总条数 */
  messageCount: number;
  /** 轮数项的跳转目标（最近一条消息） */
  roundsTarget: OverviewTarget;
  /** 最近一条助手回复 */
  lastReply: Message | null;
  /** 最近一条已完成回复的耗时（毫秒） */
  lastResponseTime: number | null;
  /** 耗时项的跳转目标 */
  durationTarget: OverviewTarget;
  /** 眼下是否仍在生成 */
  isGenerating: boolean;
  /** 生成中的消息 ID */
  generatingMessageId: string | null;
  /** 当前生成阶段 */
  generatingPhase: StreamPhase | null;
  /** 状态项的跳转目标 */
  statusTarget: OverviewTarget;
}

/**
 * 停止原因的中文标签
 */
export const STOP_REASON_LABELS: Record<StopReason, string> = {
  timeout: '等待超时',
  aborted: '已手动停止',
  interrupted: '上次生成中断',
};

/**
 * 生成阶段的中文标签（与 StreamHandler 中的定义保持一致）
 */
export const PHASE_LABELS: Record<StreamPhase, string> = {
  connecting: '建立连接',
  waiting: '等待首个回复',
  streaming: '接收回复内容',
};

/**
 * 从消息列表与会话内生成状态派生概览数据。
 * 轮数与消息条数都取自同一个 messages 数组，因此二者天然一致。
 */
export function deriveSessionOverview(
  messages: Message[],
  generating: { isGenerating: boolean; messageId: string | null; phase: StreamPhase | null },
): SessionOverviewData {
  const messageCount = messages.length;
  const lastMessage = messageCount > 0 ? messages[messageCount - 1]! : null;

  // 从后往前找最近一条助手回复（含完成、出错、生成中）
  let lastReply: Message | null = null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i]!;
    if (msg.role === 'assistant') {
      lastReply = msg;
      break;
    }
  }

  // 最近一次“有结果”的回复耗时：从后往前找最近一条带统计的已完成回复
  // （即使当前正在生成下一条，上一条已完成的耗时依然保留）
  let lastCompleteReply: Message | null = null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i]!;
    if (msg.role === 'assistant' && msg.status === 'complete' && msg.stats) {
      lastCompleteReply = msg;
      break;
    }
  }
  const lastResponseTime = lastCompleteReply?.stats?.responseTime ?? null;

  const generatingMessage =
    generating.isGenerating && generating.messageId
      ? messages.find((m) => m.id === generating.messageId) ?? null
      : null;
  const isGenerating = generating.isGenerating && generatingMessage !== null;

  return {
    rounds: messageCount,
    messageCount,
    roundsTarget: {
      messageId: lastMessage?.id ?? '',
      disabled: !lastMessage,
    },
    lastReply: generatingMessage ?? lastReply,
    lastResponseTime,
    durationTarget: {
      messageId:
        generatingMessage?.id ?? lastCompleteReply?.id ?? lastReply?.id ?? '',
      disabled: !(generatingMessage || lastCompleteReply || lastReply),
    },
    isGenerating,
    generatingMessageId: generatingMessage?.id ?? null,
    generatingPhase: isGenerating ? generating.phase : null,
    statusTarget: {
      messageId: generatingMessage?.id ?? lastReply?.id ?? '',
      disabled: !(generatingMessage || lastReply),
    },
  };
}

/**
 * 计算生成中的已耗时
 */
export function getGeneratingElapsed(messages: Message[], generatingMessageId: string | null, now: number): number | null {
  if (!generatingMessageId) return null;
  const msg = messages.find((m) => m.id === generatingMessageId);
  if (!msg) return null;
  return Math.max(0, now - msg.timestamp);
}
