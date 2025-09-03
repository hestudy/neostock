import { useState, useEffect } from 'react';

/**
 * 防抖Hook
 * 
 * @param value 需要防抖的值
 * @param delay 防抖延迟时间（毫秒）
 * @returns 防抖后的值
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // 设置定时器
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // 清理定时器
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 节流Hook
 * 
 * @param value 需要节流的值
 * @param delay 节流延迟时间（毫秒）
 * @returns 节流后的值
 */
export function useThrottle<T>(value: T, delay: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const [lastExecuted, setLastExecuted] = useState<number>(0);

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastExecution = now - lastExecuted;

    if (timeSinceLastExecution >= delay) {
      setThrottledValue(value);
      setLastExecuted(now);
    } else {
      // 设置定时器在延迟后执行
      const timer = setTimeout(() => {
        setThrottledValue(value);
        setLastExecuted(Date.now());
      }, delay - timeSinceLastExecution);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [value, delay, lastExecuted]);

  return throttledValue;
}

/**
 * 防抖回调Hook
 * 
 * @param callback 需要防抖的回调函数
 * @param delay 防抖延迟时间（毫秒）
 * @returns 防抖后的回调函数
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  return ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const newTimeoutId = setTimeout(() => {
      callback(...args);
    }, delay);

    setTimeoutId(newTimeoutId);
  }) as T;
}

/**
 * 节流回调Hook
 * 
 * @param callback 需要节流的回调函数
 * @param delay 节流延迟时间（毫秒）
 * @returns 节流后的回调函数
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const [lastExecuted, setLastExecuted] = useState<number>(0);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  return ((...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastExecution = now - lastExecuted;

    if (timeSinceLastExecution >= delay) {
      callback(...args);
      setLastExecuted(now);
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const newTimeoutId = setTimeout(() => {
        callback(...args);
        setLastExecuted(Date.now());
      }, delay - timeSinceLastExecution);

      setTimeoutId(newTimeoutId);
    }
  }) as T;
}