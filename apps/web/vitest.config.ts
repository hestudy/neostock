/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // 为前端组件测试配置DOM环境
    environment: 'happy-dom',
    // 设置测试设置文件
    setupFiles: ['./src/test-setup.ts'],
    // 排除不必要的文件
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/**',
      '**/e2e-tests/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
    ],
    // 明确指定测试文件模式
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    // 全局配置
    globals: true,
    mockReset: true,
    restoreMocks: true,
    includeSource: ['src/**/*.{js,ts,tsx}'],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})