import path from 'node:path';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      'nosskey-sdk': path.resolve(__dirname, '../../src/index.ts'),
    },
  },
});
