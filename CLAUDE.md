# CLAUDE.md

## Pre-commit verification

```sh
npm run format:check
npm run build
npm run test:coverage
npm run check -w svelte-app
```

## タスク完了前レビュー

実装・修正系タスクの完了報告前に、必ず `skeptical-reviewer` サブエージェントを Task ツールで呼び出すこと。レビュー結果の 🔴 要対応 が 0 件になるまで完了報告しない。
