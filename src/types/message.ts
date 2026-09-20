/**
 * 消息角色类型
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * 消息状态类型
 */
export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error';

/**
 * 消息统计信息
 */
export interface MessageStats {
  /** 响应时间（毫秒） */
  responseTime: number;
  /** Token 总数 */
  tokenCount: number;
  /** 完成 Token 数 */
  completionTokens?: number;
  /** 提示 Token 数 */
  promptTokens?: number;
}

/**
 * 消息对象
 */
export interface Message {
  /** 消息唯一标识 */
  id: string;
  /** 消息角色 */
  role: MessageRole;
  /** 消息内容 */
  content: string;
  /** 创建时间戳 */
  timestamp: number;
  /** 消息状态 */
  status: MessageStatus;
  /** 统计信息（仅 assistant 消息） */
  stats?: MessageStats;
}

/**
 * 创建消息的参数
 */
export interface CreateMessageParams {
  role: MessageRole;
  content: string;
  status?: MessageStatus;
}

/**
 * 流式响应所处的阶段
 * - connecting: 已发送请求，正在建立连接 / 等待首个响应片段
 * - receiving: 已收到首个片段，正在接收后续内容
 */
export type StreamingStage = 'connecting' | 'receiving';

/**
 * 流式响应中断原因
 */
export type InterruptionReason = 'error' | 'manual';

/**
 * 流式响应中断记录
 * 用于在等待超时或手动停止后，展示「停在了哪一步」
 */
export interface StreamInterruption {
  /** 中断时所处的阶段 */
  stage: StreamingStage;
  /** 中断原因（错误/超时 或 手动停止） */
  reason: InterruptionReason;
  /** 被中断的消息 ID */
  messageId: string | null;
  /** 中断发生时间戳 */
  timestamp: number;
}

/**
 * API 请求的消息格式
 */
export interface APIMessage {
  role: MessageRole;
  content: string;
}
