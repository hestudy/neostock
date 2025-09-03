import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'

// 设置全局变量
const globals = {
  vi,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll
}

// 设置全局变量
Object.entries(globals).forEach(([key, value]) => {
  Object.defineProperty(globalThis, key, {
    value,
    writable: false,
    configurable: false
  })
})

export default function setup() {
  // 全局设置逻辑
  console.log('Global test setup completed')
}