// AI 向け導入ガイドの英語版と日本語版で、コードブロックと見出しの数が揃っているかを確かめる。
// 訳文は機械的に比べられないので、AI がそのまま写すコードだけは一字一句の一致を求める。
import { readFileSync } from 'node:fs';

const EN = 'docs/llms/nosskey-iframe-login.md';
const JA = 'docs/llms/nosskey-iframe-login.ja.md';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const codeBlocks = (text) => text.match(/^```[^\n]*\n[\s\S]*?^```$/gm) ?? [];
const headings = (text) => text.replace(/^```[\s\S]*?^```$/gm, '').match(/^#{1,6} /gm) ?? [];

const en = read(EN);
const ja = read(JA);
const errors = [];

const enBlocks = codeBlocks(en);
const jaBlocks = codeBlocks(ja);
if (enBlocks.length !== jaBlocks.length) {
  errors.push(`code block count differs: ${EN} has ${enBlocks.length}, ${JA} has ${jaBlocks.length}`);
} else {
  enBlocks.forEach((block, i) => {
    if (block !== jaBlocks[i]) errors.push(`code block #${i + 1} differs between ${EN} and ${JA}`);
  });
}

const enHeadings = headings(en).length;
const jaHeadings = headings(ja).length;
if (enHeadings !== jaHeadings) {
  errors.push(`heading count differs: ${EN} has ${enHeadings}, ${JA} has ${jaHeadings}`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}
console.log(`${EN} and ${JA} are in sync (${enBlocks.length} code blocks, ${enHeadings} headings).`);
