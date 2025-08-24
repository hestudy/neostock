/// <reference types="vitest" />
import { defineConfig, mergeConfig } from 'vite'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      mockReset: true,
      restoreMocks: true,
      // 排除 E2E 测试目录
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/tests/e2e/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
      ],
      coverage: {
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'src/test-setup.ts',
          'tests/e2e/',
        ],
      },
    },
  })
)