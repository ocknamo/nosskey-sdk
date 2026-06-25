import { execSync } from 'node:child_process';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { type Connect, type Plugin, defineConfig } from 'vite';
import { CONTENT_SECURITY_POLICY } from './src/csp.js';

// Gitのcommit hashを取得
const getGitHash = () => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch (e) {
    return 'unknown';
  }
};

// 本番は public/_headers（Cloudflare Pages）で CSP を配信する。dev / preview でも
// 同じポリシーを効かせ、CSP 違反を本番デプロイ前に検出できるようにする。
const securityHeadersPlugin = (): Plugin => {
  const middleware: Connect.NextHandleFunction = (_req, res, next) => {
    res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    next();
  };
  return {
    name: 'nosskey-security-headers',
    configureServer: (server) => {
      server.middlewares.use(middleware);
    },
    configurePreviewServer: (server) => {
      server.middlewares.use(middleware);
    },
  };
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), securityHeadersPlugin()],
  define: {
    'import.meta.env.VITE_GIT_COMMIT_HASH': JSON.stringify(getGitHash()),
  },
});
