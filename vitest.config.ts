import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    environment: 'node',
    // Unit tests only — e2e/*.spec.ts belong to Playwright (`pnpm test:e2e`)
    include: ['src/**/*.test.ts'],
  },
});
