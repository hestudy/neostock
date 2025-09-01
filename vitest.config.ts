/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 为前端组件测试配置DOM环境
    environment: 'jsdom',
    // 设置测试设置文件
    setupFiles: ['./apps/web/src/test-setup.ts'],
    // 排除 E2E 测试目录，避免与 Playwright 冲突
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/e2e/**',
      '**/e2e-tests/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
    ],
    // 明确指定测试文件模式，只包含apps目录下的测试
    include: [
      'apps/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    // 全局配置
    globals: true,
  },
})