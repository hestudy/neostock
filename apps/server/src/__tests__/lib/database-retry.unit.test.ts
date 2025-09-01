import { describe, it, expect, vi } from 'vitest';
import { withDatabaseRetry } from '../../lib/database-retry';

describe('withDatabaseRetry', () => {
  it('retries on retryable errors and eventually succeeds', async () => {
    const op = vi.fn();
    let calls = 0;
    op.mockImplementation(async () => {
      calls += 1;
      if (calls < 3) {
        const err = new Error('SQLITE_BUSY during test') as Error & { code?: string };
        (err as any).code = 'SQLITE_BUSY';
        throw err;
      }
      return 'ok';
    });

    const result = await withDatabaseRetry(op, { baseDelay: 1, maxDelay: 2, maxRetries: 3 });
    expect(result).toBe('ok');
    expect(op).toHaveBeenCalledTimes(3);
  });

  it('does not retry on non-retryable errors', async () => {
    const op = vi.fn(async () => {
      const err = new Error('Validation failed');
      throw err;
    });

    await expect(withDatabaseRetry(op, { baseDelay: 1, maxDelay: 2, maxRetries: 2 })).rejects.toThrowError('Database operation failed');
    expect(op).toHaveBeenCalledTimes(1);
  });
});

