// 导入测试库与工具
import '@testing-library/jest-dom'
import { vi, afterEach } from 'vitest'
import { cleanup, configure } from '@testing-library/react'

// polyfill: matchMedia（happy-dom 默认不提供）
if (typeof window !== 'undefined' && !('matchMedia' in window)) {
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
}

// polyfill: scrollTo（某些环境不存在）
if (typeof window !== 'undefined' && typeof window.scrollTo !== 'function') {
  Object.defineProperty(window, 'scrollTo', { value: vi.fn(), writable: true })
}

// polyfill: ResizeObserver / IntersectionObserver（按需提供）
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverMock {
    observe = vi.fn<(target: Element) => void>()
    unobserve = vi.fn<(target: Element) => void>()
    disconnect = vi.fn<() => void>()
  }
  ;(globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    ResizeObserverMock as unknown as typeof ResizeObserver
}

if (!('IntersectionObserver' in globalThis)) {
  class IntersectionObserverMock {
    root: Element | Document | null = null
    rootMargin = ''
    thresholds: ReadonlyArray<number> = []
    observe = vi.fn<(target: Element) => void>()
    unobserve = vi.fn<(target: Element) => void>()
    disconnect = vi.fn<() => void>()
    takeRecords = vi.fn<() => ReadonlyArray<IntersectionObserverEntry>>(() => [])
  }
  ;(globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
    IntersectionObserverMock as unknown as typeof IntersectionObserver
}

// 测试库配置
configure({ testIdAttribute: 'data-testid', asyncUtilTimeout: 2000 })

// 每个用例后清理并重置定时器
afterEach(() => {
  cleanup()
  vi.clearAllTimers()
})
