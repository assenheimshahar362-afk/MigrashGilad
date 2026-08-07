import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * §18.2 integration layer: RPC behaviour and the RLS policy matrix, run against
 * a local Supabase instance.
 *
 * Kept separate from the unit config so `npm test` stays fast and needs no
 * Docker, while `npm run test:integration` is the gate that actually proves the
 * §6.4 policies.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // The matrix mutates shared rows; parallel files would race each other.
    fileParallelism: false,
    env: { TZ: 'UTC' },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
