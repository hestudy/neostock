/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // 确保vi mock functions可用
    mockReset: true,
    restoreMocks: true,
    testTimeout: 30000, // 30秒超时，适应CI环境
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test-setup.ts',
        'dist/',
      ],
    },
  },
})