import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['webview/__tests__/**/*.test.ts'],
    testTimeout: 10000,
  },
});
