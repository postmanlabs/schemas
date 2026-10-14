import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Standalone config so vitest doesn't load vite.config.ts (tanstackStart + nitro plugins).
export default defineConfig({
  resolve: {
    // Test the fork's source directly, so tests don't depend on a prior package build.
    alias: {
      '@postman/json-schema-tree': fileURLToPath(new URL('./packages/json-schema-tree/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
