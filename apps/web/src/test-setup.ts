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
    setTimeout: vi.fn((callback, delay) => {
      const id = setTimeout(callback, delay || 0);
      return id;
    }),
    clearTimeout: vi.fn((id) => {
      clearTimeout(id);
    }),
    setInterval: vi.fn((callback, interval) => {
      const id = setInterval(callback, interval || 0);
      return id;
    }),
    clearInterval: vi.fn((id) => {
      clearInterval(id);
    }),
    requestAnimationFrame: vi.fn((callback) => {
      const id = setTimeout(callback, 16); // 模拟16ms一帧
      return id;
    }),
    cancelAnimationFrame: vi.fn((id) => {
      clearTimeout(id);
    }),
    performance: {
      now: vi.fn(() => Date.now()),
    },
    devicePixelRatio: 1,
    innerWidth: 1024,
    innerHeight: 768,
  },
  writable: true,
})

// 确保 global 也有 requestAnimationFrame
Object.defineProperty(global, 'requestAnimationFrame', {
  value: vi.fn((callback) => {
    const id = setTimeout(callback, 16);
    return id;
  }),
  writable: true,
})

Object.defineProperty(global, 'cancelAnimationFrame', {
  value: vi.fn((id) => {
    clearTimeout(id);
  }),
  writable: true,
})

// Mock document 对象
Object.defineProperty(global, 'document', {
  value: {
    createElement: vi.fn((tagName) => {
      const element = {
        tagName: tagName.toUpperCase(),
        className: '',
        style: {},
        innerHTML: '',
        textContent: '',
        appendChild: vi.fn(),
        removeChild: vi.fn(),
        remove: vi.fn(),
        getBoundingClientRect: vi.fn(() => ({
          width: 100,
          height: 100,
          top: 0,
          left: 0,
          right: 100,
          bottom: 100,
        })),
        dispatchEvent: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        setAttribute: vi.fn(),
        getAttribute: vi.fn(),
        hasAttribute: vi.fn(),
        removeAttribute: vi.fn(),
        querySelector: vi.fn(),
        querySelectorAll: vi.fn(() => []),
      };
      return element;
    }),
    createTextNode: vi.fn((text) => ({
      textContent: text,
    })),
    getElementById: vi.fn(),
    getElementsByClassName: vi.fn(() => []),
    getElementsByTagName: vi.fn(() => []),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(() => []),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      innerHTML: '',
      querySelectorAll: vi.fn(() => []),
    },
    documentElement: {
      scrollTop: 0,
      scrollLeft: 0,
    },
  },
  writable: true,
})