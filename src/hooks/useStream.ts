import { useState, useCallback, useRef } from 'react';
import { StreamHandler, ResponseStats } from '../services/stream';

interface UseStreamOptions {
  onChunk?: (chunk: string) => void;
  onComplete?: (stats: ResponseStats) => void;
  onError?: (error: Error) => void;
}

interface UseStreamReturn {
  isStreaming: boolean;
  content: string;
  stats: ResponseStats | null;
  error: Error | null;
  start: (stream: AsyncGenerator<string, void, unknown>) => Promise<void>;
  stop: () => void;
  reset: () => void;
}

/**
 * 流式响应处理 Hook
 */
export function useStream(options: UseStreamOptions = {}): UseStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [content, setContent] = useState('');
  const [stats, setStats] = useState<ResponseStats | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const handlerRef = useRef<StreamHandler | null>(null);

  const start = useCallback(
    async (stream: AsyncGenerator<string, void, unknown>) => {
      // 重置状态
      setIsStreaming(true);
      setContent('');
      setStats(null);
      setError(null);

      // 创建新的处理器
      const handler = new StreamHandler();
      handlerRef.current = handler;

      await handler.start(stream, {
        onChunk: (chunk) => {
          setContent((prev) => prev + chunk);
          options.onChunk?.(chunk);
        },
        onComplete: (responseStats) => {
          setStats(responseStats);
          setIsStreaming(false);
          options.onComplete?.(responseStats);
        },
        onError: (err) => {
          setError(err);
          setIsStreaming(false);
          options.onError?.(err);
        },
      });
    },
    [options]
  );

  const stop = useCallback(() => {
    if (handlerRef.current) {
      handlerRef.current.abort();
      setIsStreaming(false);
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    setContent('');
    setStats(null);
    setError(null);
  }, [stop]);

  return {
    isStreaming,
    content,
    stats,
    error,
    start,
    stop,
    reset,
  };
}
