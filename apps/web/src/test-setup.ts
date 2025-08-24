import '@testing-library/jest-dom'
import 'jsdom-global/register'

// 确保全局对象正确设置
if (typeof global !== 'undefined') {
  global.window = window
  global.document = document
}

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => {
    const mediaQuery: Partial<MediaQueryList> = {
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }
    return mediaQuery as MediaQueryList
  },
})

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_callback: ResizeObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}