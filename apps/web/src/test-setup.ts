import { configure } from '@testing-library/react'
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// 测试库配置
configure({ testIdAttribute: 'data-testid', asyncUtilTimeout: 2000 })

// Mock window 对象
Object.defineProperty(global, 'window', {
  value: {
    matchMedia: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    requestAnimationFrame: vi.fn(),
    cancelAnimationFrame: vi.fn(),
    setTimeout: vi.fn(),
    clearTimeout: vi.fn(),
    setInterval: vi.fn(),
    clearInterval: vi.fn(),
  },
  writable: true,
})

// Mock document 对象
Object.defineProperty(global, 'document', {
  value: {
    createElement: vi.fn(),
    createTextNode: vi.fn(),
    getElementById: vi.fn(),
    getElementsByClassName: vi.fn(),
    getElementsByTagName: vi.fn(),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      innerHTML: '',
    },
  },
  writable: true,
})