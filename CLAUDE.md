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

## UI 変更時のスクリーンショット確認

`examples/svelte-app/` 配下の Svelte / CSS / 画像アセットを変更したタスクの完了報告前に、必ず `snapshot` スキルを呼び出して PC とモバイル両 viewport の実画を撮影し、ユーザーに送ること。test / build / svelte-check がグリーンでもレイアウト崩れ・はみ出し・余白の異常は検出できないため、視覚確認を必須とする。
