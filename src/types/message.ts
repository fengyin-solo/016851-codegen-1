/**
 * 消息角色类型
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * 消息状态类型
 */
export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error';

/**
 * 流式响应所处阶段
 */
export type StreamPhase = 'connecting' | 'waiting' | 'streaming';

/**
 * 响应停止原因
 * - timeout: 等待超时
 * - aborted: 用户手动停止
 * - interrupted: 页面重新进入时，上一次生成仍未完成（无法继续）
 */
export type StopReason = 'timeout' | 'aborted' | 'interrupted';

/**
 * 停止信息（记录一次生成停在了哪里）
 */
export interface StopInfo {
  /** 停止原因 */
  reason: StopReason;
  /** 停止时所处阶段（超时场景用于定位停顿步骤） */
  phase?: StreamPhase;
  /** 已耗时（毫秒） */
  elapsed?: number;
}

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
  /** 停止信息（生成未正常完成时记录停留阶段等） */
  stopInfo?: StopInfo;
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
 * API 请求的消息格式
 */
export interface APIMessage {
  role: MessageRole;
  content: string;
}
