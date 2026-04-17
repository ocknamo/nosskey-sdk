import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // @rx-nostr/crypto@3.1.4 has incorrect exports field pointing to non-existent files
    alias: {
      '@rx-nostr/crypto': resolve(__dirname, '../../node_modules/@rx-nostr/crypto/dist/crypto.js'),
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.{test,spec}.ts', 'src/test-utils.ts', 'src/index.ts', 'src/types.ts'],
      reportOnFailure: true,
    },
  },
});
