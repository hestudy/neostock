// 导入测试库
import '@testing-library/jest-dom'
import { vi, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// 确保全局对象正确设置
if (typeof globalThis !== 'undefined') {
  globalThis.vi = vi
}

// 设置 vi 全局可用
(global as unknown as { vi: typeof vi }).vi = vi
;(globalThis as unknown as { vi: typeof vi }).vi = vi

// 确保在jsdom环境中window和document可用
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

  // 确保document有完整的DOM方法
  if (document) {
    if (!document.getElementsByTagName) {
      document.getElementsByTagName = vi.fn(() => [{ appendChild: vi.fn() }])
    }
    if (!document.head) {
      document.head = document.createElement('head')
    }
    if (!document.createTextNode) {
      document.createTextNode = vi.fn(() => ({}))
    }
  }
} else if (typeof global !== 'undefined') {
  // 如果window未定义，确保document在global中可用
  if (typeof (global as unknown as { document?: unknown }).document === 'undefined') {
    (global as unknown as { document: unknown }).document = {
      head: { appendChild: vi.fn(), removeChild: vi.fn() },
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
      createElement: vi.fn(() => ({ 
        style: {},
        setAttribute: vi.fn(),
        getAttribute: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        appendChild: vi.fn(),
        styleSheet: null
      })),
      createTextNode: vi.fn(() => ({})),
      getElementById: vi.fn(),
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
      getElementsByTagName: vi.fn(() => [{ appendChild: vi.fn() }]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      defaultView: {
        getComputedStyle: vi.fn(() => ({})),
        matchMedia: vi.fn().mockImplementation(() => ({
          matches: false,
          addListener: vi.fn(),
          removeListener: vi.fn(),
        })),
        scrollTo: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }
    };
  }
  if (typeof (global as unknown as { window?: unknown }).window === 'undefined') {
    (global as unknown as { window: unknown }).window = {
      document: (global as unknown as { document: unknown }).document,
      matchMedia: vi.fn().mockImplementation(() => ({
        matches: false,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      })),
      scrollTo: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      getComputedStyle: vi.fn(() => ({})),
      location: { href: 'http://localhost:3000' },
      navigator: { userAgent: 'test' }
    };
  }
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

// Mock environment variables for better-auth
process.env.AUTH_BASE_URL = process.env.AUTH_BASE_URL || 'http://localhost:3000'


// 确保用户事件库能够正常工作
import { configure } from '@testing-library/react'

configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 2000
})

// 全局DOM清理
afterEach(() => {
  cleanup()
  // 清理所有定时器
  vi.clearAllTimers()
})