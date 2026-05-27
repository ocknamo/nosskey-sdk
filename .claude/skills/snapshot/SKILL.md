---
name: snapshot
description: >
  examples/svelte-app の dev サーバーを起動し、playwright で PC とモバイル両 viewport の
  スクリーンショットを撮影してユーザーに送る。UI 変更後の見た目確認や、
  before/after の証跡が必要なときに使う。
  オプションでルート以外のパス指定や、特定セレクタの computed style 検査も可能。
  「スクショ撮って」「見た目確認したい」「ヒーロー画像どう見える？」等で起動。
---

# UI Snapshot Skill

## 用途

examples/svelte-app の UI 変更を視覚的に確認する。test/build がグリーンでも
レイアウト崩れは検出できないため、レイアウト・スタイル変更時は本スキルで実画を確認する。

## 手順

### 1. dev サーバーを起動

```bash
cd /home/user/nosskey-sdk && npm run dev -w svelte-app
```

`run_in_background: true` で起動し、出力ファイルパスを記録。

### 2. ready を待つ

```bash
until grep -q "Local:" <output_file>; do sleep 0.5; done
```

Vite が `Local: http://localhost:5173/` を出したら準備完了。

### 3. playwright スクリプトを実行

playwright は `/opt/node22/lib/node_modules/playwright` にグローバル配置されているため、
CommonJS で絶対パス require する必要がある。スクリプトは `/tmp/snapshot.cjs` に書く:

```javascript
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const browser = await chromium.launch();
  const url = process.env.SNAP_URL || 'http://localhost:5173/';
  const viewports = [
    { name: 'pc', width: 1280, height: 900 },
    { name: 'mobile', width: 375, height: 800 },
  ];
  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `/tmp/snap-${vp.name}.png`, fullPage: true });
    await page.close();
  }
  await browser.close();
  console.log('done');
})();
```

実行:

```bash
node /tmp/snapshot.cjs
```

### 4. ユーザーに送る

`SendUserFile` で `/tmp/snap-pc.png` と `/tmp/snap-mobile.png` を送る。
caption に「PC (1280px) / モバイル (375px)」のように viewport を明記。

### 5. dev サーバーを停止

```bash
kill %1 2>/dev/null  # または ps + kill <pid>
```

バックグラウンドプロセスの ID は Bash 起動時に表示される。

## オプション: computed style 検査

レイアウト崩れの原因調査時は viewport ごとに対象セレクタの bounding box と
computed style を dump すると有効。`/tmp/inspect.cjs` を以下のテンプレートで:

```javascript
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:5173/');
  await page.waitForLoadState('networkidle');
  const dump = async (sel, label) => {
    const r = await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        width: Math.round(rect.width),
        left: Math.round(rect.left),
        maxWidth: cs.maxWidth,
        display: cs.display,
        padding: cs.padding,
        margin: cs.margin,
        alignItems: cs.alignItems,
        flexDirection: cs.flexDirection,
        textAlign: cs.textAlign,
      };
    }, sel);
    console.log(label + ':', JSON.stringify(r));
  };
  // 調査対象セレクタを並べる
  await dump('#app', '#app');
  await dump('.account-screen', 'account-screen');
  await dump('.auth-container', 'auth-container');
  await browser.close();
})();
```

`width: 364` のように期待と乖離した値が出れば、margin/display/parent の
flex 設定など複合要因を疑う。本リポジトリでは過去に flex column 親内の
`margin: 0 auto` が auto margin として作用し shrink-to-fit に転倒した実例あり
(PR #86)。

## 注意

- `npm run dev -w svelte-app` の代わりに `cd examples/svelte-app && npm run dev` も可。
- 既に dev サーバーが起動中なら起動をスキップ (`curl -s http://localhost:5173/` で確認)。
- スクショは `fullPage: true` 推奨。スクロール下のレイアウトも捕捉できる。
- 認証や特定状態が必要なら `page.evaluate` で localStorage を設定するか
  `page.click` で UI 経由でセットアップしてから screenshot を撮る。
- 撮影後は必ず dev サーバーを停止。長時間放置するとポート 5173 を占有し続ける。
