import type { MessageStats, StreamPhase } from '../types';

/**
 * 响应统计信息
 */
export interface ResponseStats {
  /** 响应时间（毫秒） */
  responseTime: number;
  /** 估算的 Token 数量 */
  tokenCount: number;
  /** 首字节时间（毫秒） */
  firstByteTime?: number;
}

/**
 * 各阶段超时配置（毫秒）
 * - connectTimeout: 建立连接（拿到响应头）
 * - firstChunkTimeout: 连接成功后等待首个内容片段
 * - chunkTimeout: 生成过程中相邻两个内容片段的最大间隔
 */
export interface StreamTimeoutOptions {
  connectTimeout?: number;
  firstChunkTimeout?: number;
  chunkTimeout?: number;
}

export const DEFAULT_STREAM_TIMEOUTS = {
  connectTimeout: 15_000,
  firstChunkTimeout: 30_000,
  chunkTimeout: 60_000,
} as const;

/**
 * 流处理器回调
 */
export interface StreamCallbacks {
  /** 收到内容片段时调用 */
  onChunk: (chunk: string) => void;
  /** 流完成时调用 */
  onComplete: (stats: ResponseStats) => void;
  /** 发生错误（含超时）时调用 */
  onError: (error: Error) => void;
  /** 生成阶段发生变化时调用 */
  onPhaseChange?: (phase: StreamPhase) => void;
}

/**
 * 流式响应超时错误
 * 携带超时时所处的阶段，便于界面展示“停在哪一步”
 */
export class StreamTimeoutError extends Error {
  readonly isTimeout = true as const;
  readonly phase: StreamPhase;
  readonly elapsed: number;

  constructor(phase: StreamPhase, elapsed: number, timeout: number) {
    super(`响应超时：在「${PHASE_LABELS[phase]}」阶段等待超过 ${Math.round(timeout / 1000)} 秒`);
    this.name = 'StreamTimeoutError';
    this.phase = phase;
    this.elapsed = elapsed;
  }
}

/**
 * 各阶段的中文标签
 */
export const PHASE_LABELS: Record<StreamPhase, string> = {
  connecting: '建立连接',
  waiting: '等待首个回复',
  streaming: '接收回复内容',
};

/**
 * 流处理器类
 * 管理流式响应的生命周期
 *
 * 生命周期拆分为两步：
 * - prepare: 初始化定时器/中止控制器，随后再创建底层请求；
 * - consume: 迭代流内容。
 * 这样“建立连接”阶段也能被超时覆盖。
 */
export class StreamHandler {
  private abortController: AbortController | null = null;
  private isActive = false;
  private startTime = 0;
  private firstByteTime: number | null = null;
  private accumulatedContent = '';
  private callbacks: StreamCallbacks | null = null;
  private timeouts: Required<StreamTimeoutOptions> = { ...DEFAULT_STREAM_TIMEOUTS };
  private phase: StreamPhase = 'connecting';
  private phaseTimer: ReturnType<typeof setTimeout> | null = null;
  private timedOut = false;

  /**
   * 准备一次新的流处理（在创建底层请求之前调用）
   * @param callbacks 回调函数
   * @param timeoutOptions 各阶段超时配置
   * @returns 可传给底层请求的 AbortSignal
   */
  prepare(
    callbacks: StreamCallbacks,
    timeoutOptions: StreamTimeoutOptions = {}
  ): AbortSignal {
    if (this.isActive) {
      this.abort();
    }

    this.abortController = new AbortController();
    this.isActive = true;
    this.startTime = Date.now();
    this.firstByteTime = null;
    this.accumulatedContent = '';
    this.callbacks = callbacks;
    this.timedOut = false;
    this.timeouts = { ...DEFAULT_STREAM_TIMEOUTS, ...timeoutOptions };
    this.phase = 'connecting';

    this.armPhaseTimer(this.timeouts.connectTimeout);
    this.callbacks.onPhaseChange?.(this.phase);

    return this.abortController.signal;
  }

  /**
   * 连接已建立（拿到响应头）
   */
  notifyConnected(): void {
    if (!this.isActive || this.phase !== 'connecting') return;
    this.setPhase('waiting');
    this.armPhaseTimer(this.timeouts.firstChunkTimeout);
  }

  /**
   * 消费流内容
   * @param stream 异步迭代器
   */
  async consume(
    stream: AsyncGenerator<string, void, unknown>
  ): Promise<void> {
    if (!this.isActive || !this.callbacks) {
      return;
    }

    try {
      for await (const chunk of stream) {
        if (this.abortController?.signal.aborted) {
          break;
        }

        // 首个有效片段：进入流式接收阶段
        if (this.firstByteTime === null) {
          this.firstByteTime = Date.now() - this.startTime;
          this.setPhase('streaming');
        }

        // 每个片段后重新计时，监控片段之间的间隔
        this.armPhaseTimer(this.timeouts.chunkTimeout);

        this.accumulatedContent += chunk;
        this.callbacks.onChunk(chunk);
      }

      // 流正常完成
      if (!this.abortController?.signal.aborted && !this.timedOut) {
        this.clearPhaseTimer();
        this.callbacks.onComplete(this.calculateStats());
      }
    } catch (error) {
      // 超时已经主动上报过；手动中止无需上报
      if (this.timedOut || this.abortController?.signal.aborted) {
        // 吞掉中止底层请求时 SDK 抛出的错误
      } else if (this.callbacks) {
        this.clearPhaseTimer();
        this.callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      }
    } finally {
      this.isActive = false;
      this.abortController = null;
      this.callbacks = null;
      this.clearPhaseTimer();
    }
  }

  /**
   * 开始处理流（兼容旧用法：prepare + consume）
   * 注意：此入口无法在“建立连接”期间触发超时，新代码请使用 prepare/consume
   */
  async start(
    stream: AsyncGenerator<string, void, unknown>,
    callbacks: StreamCallbacks,
    timeoutOptions: StreamTimeoutOptions = {}
  ): Promise<void> {
    this.prepare(callbacks, timeoutOptions);
    await this.consume(stream);
  }

  /**
   * 中止当前流
   */
  abort(): void {
    this.clearPhaseTimer();
    if (this.abortController) {
      this.abortController.abort();
      this.isActive = false;
    }
  }

  /**
   * 检查流是否正在处理
   */
  getIsActive(): boolean {
    return this.isActive;
  }

  /**
   * 获取已累积的内容
   */
  getAccumulatedContent(): string {
    return this.accumulatedContent;
  }

  /**
   * 当前所处阶段
   */
  getPhase(): StreamPhase {
    return this.phase;
  }

  /**
   * 为当前阶段启动超时计时
   */
  private armPhaseTimer(timeout: number): void {
    this.clearPhaseTimer();
    this.phaseTimer = setTimeout(() => {
      this.handleTimeout();
    }, timeout);
  }

  private clearPhaseTimer(): void {
    if (this.phaseTimer !== null) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
  }

  private setPhase(phase: StreamPhase): void {
    this.phase = phase;
    this.callbacks?.onPhaseChange?.(phase);
  }

  /**
   * 超时处理：中止底层请求并上报带阶段信息的错误
   */
  private handleTimeout(): void {
    if (!this.isActive || !this.callbacks) return;

    this.timedOut = true;
    const timeout =
      this.phase === 'connecting'
        ? this.timeouts.connectTimeout
        : this.phase === 'waiting'
          ? this.timeouts.firstChunkTimeout
          : this.timeouts.chunkTimeout;
    const elapsed = Date.now() - this.startTime;
    const error = new StreamTimeoutError(this.phase, elapsed, timeout);

    this.clearPhaseTimer();
    if (this.abortController) {
      this.abortController.abort();
      this.isActive = false;
    }
    this.callbacks.onError(error);
  }

  /**
   * 计算响应统计信息
   */
  private calculateStats(): ResponseStats {
    const responseTime = Date.now() - this.startTime;
    const tokenCount = this.estimateTokens(this.accumulatedContent);

    return {
      responseTime,
      tokenCount,
      firstByteTime: this.firstByteTime ?? undefined,
    };
  }

  /**
   * 估算 Token 数量
   * 简化的估算方法
   */
  private estimateTokens(text: string): number {
    if (!text) return 0;

    // 中文字符约 2 token
    const chineseChars = (text.match(/[一-鿿]/g) || []).length;
    // 英文单词约 1 token
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    // 数字
    const numbers = (text.match(/\d+/g) || []).length;
    // 标点符号
    const punctuation = (text.match(/[^\w\s一-鿿]/g) || []).length;

    return chineseChars * 2 + englishWords + numbers + punctuation;
  }
}

/**
 * 创建流处理器实例
 */
export function createStreamHandler(): StreamHandler {
  return new StreamHandler();
}

/**
 * 将 ResponseStats 转换为 MessageStats
 */
export function toMessageStats(stats: ResponseStats): MessageStats {
  return {
    responseTime: stats.responseTime,
    tokenCount: stats.tokenCount,
  };
}
