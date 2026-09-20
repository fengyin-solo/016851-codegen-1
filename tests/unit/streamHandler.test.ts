import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  StreamHandler,
  StreamTimeoutError,
  createStreamHandler,
  PHASE_LABELS,
} from '../../src/services/stream';

async function* makeStream(chunks: string[], delay = 0) {
  for (const chunk of chunks) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    yield chunk;
  }
}

/**
 * 永不产出内容的流（模拟服务端挂起），
 * 底层请求被中止时按真实 SDK 的行为抛出 AbortError。
 */
async function* makeHangingStream(signal?: AbortSignal): AsyncGenerator<string> {
  await new Promise<void>((_resolve, reject) => {
    if (!signal) {
      // 永不 settle
      return;
    }
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    signal.addEventListener(
      'abort',
      () => reject(new DOMException('Aborted', 'AbortError')),
      { once: true },
    );
  });
}

/** 先产出一个片段、随后挂起的流（同样响应中止信号） */
async function* makePartialThenHang(signal?: AbortSignal): AsyncGenerator<string> {
  yield '已收到的内容';
  await new Promise<void>((_resolve, reject) => {
    if (!signal) {
      return;
    }
    signal.addEventListener(
      'abort',
      () => reject(new DOMException('Aborted', 'AbortError')),
      { once: true },
    );
  });
}

describe('StreamHandler 阶段与超时', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('正常完成：阶段依次为 connecting → waiting → streaming，并回调 onComplete', async () => {
    const handler = createStreamHandler();
    const phases: string[] = [];
    const chunks: string[] = [];

    const signal = handler.prepare({
      onChunk: (c) => chunks.push(c),
      onComplete: (stats) => {
        expect(stats.responseTime).toBeGreaterThanOrEqual(0);
      },
      onError: () => {
        throw new Error('不应发生错误');
      },
      onPhaseChange: (p) => phases.push(p),
    });

    expect(signal).toBeInstanceOf(AbortSignal);
    handler.notifyConnected();

    await handler.consume(makeStream(['你', '好']));

    expect(phases).toEqual(['connecting', 'waiting', 'streaming']);
    expect(chunks).toEqual(['你', '好']);
    expect(handler.getIsActive()).toBe(false);
    expect(handler.getPhase()).toBe('streaming');
  });

  it('等待首个回复超时：上报带 waiting 阶段的超时错误并中止底层流', async () => {
    const handler = createStreamHandler();
    const errors: StreamTimeoutError[] = [];

    const signal = handler.prepare({
      onChunk: () => {},
      onComplete: () => {
        throw new Error('不应完成');
      },
      onError: (err) => errors.push(err as StreamTimeoutError),
      onPhaseChange: () => {},
    }, { connectTimeout: 100, firstChunkTimeout: 100 });

    handler.notifyConnected();

    let consumeSettled = false;
    const consumePromise = handler.consume(makeHangingStream(signal)).then(() => {
      consumeSettled = true;
    });

    await vi.advanceTimersByTimeAsync(101);
    await consumePromise;

    expect(consumeSettled).toBe(true);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.isTimeout).toBe(true);
    expect(errors[0]?.phase).toBe('waiting');
    expect(errors[0]?.elapsed).toBeGreaterThanOrEqual(100);
    expect(errors[0]?.message).toContain(PHASE_LABELS.waiting);
  });

  it('建立连接阶段超时：停在 connecting', async () => {
    const handler = new StreamHandler();
    const errors: StreamTimeoutError[] = [];

    handler.prepare({
      onChunk: () => {},
      onComplete: () => {
        throw new Error('不应完成');
      },
      onError: (err) => errors.push(err as StreamTimeoutError),
      onPhaseChange: () => {},
    }, { connectTimeout: 50 });

    // 不调用 notifyConnected、不调用 consume（模拟 create() 一直挂起）
    await vi.advanceTimersByTimeAsync(51);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.phase).toBe('connecting');
    expect(handler.getIsActive()).toBe(false);
  });

  it('生成中相邻片段间隔过长超时：停在 streaming，已收到内容不受影响', async () => {
    vi.useRealTimers();
    const handler = createStreamHandler();
    const chunks: string[] = [];
    const errors: StreamTimeoutError[] = [];

    const signal = handler.prepare({
      onChunk: (c) => chunks.push(c),
      onComplete: () => {
        throw new Error('不应完成');
      },
      onError: (err) => errors.push(err as StreamTimeoutError),
      onPhaseChange: () => {},
    }, { connectTimeout: 10_000, firstChunkTimeout: 10_000, chunkTimeout: 50 });

    handler.notifyConnected();
    await handler.consume(makePartialThenHang(signal));

    expect(chunks).toEqual(['已收到的内容']);
    expect(handler.getAccumulatedContent()).toBe('已收到的内容');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.phase).toBe('streaming');
  });

  it('手动 abort：不上报错误', async () => {
    const handler = createStreamHandler();
    let onErrorCount = 0;

    const signal = handler.prepare({
      onChunk: () => {},
      onComplete: () => {},
      onError: () => {
        onErrorCount += 1;
      },
      onPhaseChange: () => {},
    });

    handler.notifyConnected();
    const consumePromise = handler.consume(makeHangingStream(signal));
    handler.abort();
    await consumePromise;

    expect(onErrorCount).toBe(0);
    expect(handler.getIsActive()).toBe(false);
  });
});
