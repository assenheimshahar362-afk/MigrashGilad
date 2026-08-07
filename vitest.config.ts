import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    // The whole product runs at Asia/Jerusalem; running the suite anywhere else
    // would hide exactly the DST bugs these tests exist to catch (§14).
    env: { TZ: 'UTC' },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
