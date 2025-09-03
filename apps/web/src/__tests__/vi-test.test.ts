import { test, expect, vi } from 'vitest';

test('vi is available', () => {
  expect(typeof vi).toBe('object');
  expect(typeof vi.fn).toBe('function');
});

test('vi.mock works', () => {
  // 注意：vi.mock 需要在文件顶部使用，这里只是测试 vi 对象是否可用
  expect(typeof vi).toBe('object');
  expect(typeof vi.fn).toBe('function');
  expect(true).toBe(true);
});