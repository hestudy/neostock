// 导入测试库
import '@testing-library/jest-dom'
import { vi, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// 设置 vi 全局可用
(global as unknown as { vi: typeof vi }).vi = vi
;(globalThis as unknown as { vi: typeof vi }).vi = vi

// Mock Web APIs 只在window可用时设置
if (typeof window !== 'undefined') {
  ;(window as unknown as { vi: typeof vi }).vi = vi

  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  // Mock scrollTo
  window.scrollTo = vi.fn()
}

// Mock ResizeObserver
if (typeof global !== 'undefined') {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
}

// Mock IntersectionObserver
if (typeof global !== 'undefined') {
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    root: null,
    rootMargin: '',
    thresholds: [],
  }))
}

// 全局DOM清理
afterEach(() => {
  cleanup()
})