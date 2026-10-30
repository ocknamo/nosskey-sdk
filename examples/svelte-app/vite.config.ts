import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { type Connect, defineConfig, type Plugin } from 'vite';
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

// nosskey.app/llms.txt として、リポジトリ直下の llms.txt をそのまま配信する。
// public/ に複製を置くと 2 か所を手で揃えることになるため、ビルド時に出力へ含める。
const llmsTxtPlugin = (): Plugin => {
  const source = fileURLToPath(new URL('../../llms.txt', import.meta.url));
  return {
    name: 'nosskey-llms-txt',
    configureServer: (server) => {
      server.middlewares.use('/llms.txt', (_req, res) => {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(readFileSync(source));
      });
    },
    buildStart() {
      this.addWatchFile(source);
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'llms.txt', source: readFileSync(source, 'utf8') });
    },
  };
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), securityHeadersPlugin(), llmsTxtPlugin()],
  define: {
    'import.meta.env.VITE_GIT_COMMIT_HASH': JSON.stringify(getGitHash()),
  },
});
