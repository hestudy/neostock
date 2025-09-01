/// <reference types="vitest" />
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [tailwindcss(), tanstackRouter({}), react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
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
