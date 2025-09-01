import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const isTest = !!process.env.VITEST;

export default defineConfig({
  plugins: [
    // 测试环境精简插件，避免多余的编译器行为
    react(),
    ...(!isTest ? [tailwindcss(), tanstackRouter({})] : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(new URL('.', import.meta.url).pathname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.ts'],
    mockReset: true,
    restoreMocks: true,
    includeSource: ['src/**/*.{js,ts,tsx}'],
    testTimeout: 10000,
  },
  define: {
    'import.meta.vitest': 'undefined',
  },
});
