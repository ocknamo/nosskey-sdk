// AI 向け導入ガイドの英語版 (原本) と日本語版で、コードブロックと見出しの並びが揃っているかを確かめる。
// 訳文は機械的に比べられないので、AI がそのまま写すコードだけは一字一句の一致を求める。
import { readFileSync } from 'node:fs';

const EN = 'docs/llms/nosskey-iframe-login.md';
const JA = 'docs/llms/nosskey-iframe-login.ja.md';

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n?/g, '\n');

// 行単位で読む。正規表現 1 本だと、リスト内のインデントしたフェンス・~~~・入れ子のフェンスを取りこぼす。
function parse(text) {
  const blocks = [];
  const headings = [];
  let fence = null;
  for (const line of text.split('\n')) {
    if (fence) {
      fence.lines.push(line);
      const close = line.match(/^ *(`{3,}|~{3,})\s*$/);
      if (close && close[1][0] === fence.char && close[1].length >= fence.length) {
        blocks.push(fence.lines.join('\n'));
        fence = null;
      }
      continue;
    }
    const open = line.match(/^ *(`{3,}|~{3,})/);
    if (open) {
      fence = { char: open[1][0], length: open[1].length, lines: [line] };
      continue;
    }
    const heading = line.match(/^(#{1,6}) /);
    if (heading) headings.push(heading[1].length);
  }
  if (fence) blocks.push(fence.lines.join('\n'));
  return { blocks, headings: headings.join(',') };
}

const en = parse(read(EN));
const ja = parse(read(JA));
const errors = [];

if (en.blocks.length === 0) errors.push(`no code blocks found in ${EN}`);
if (en.blocks.length !== ja.blocks.length) {
  errors.push(
    `code block count differs: ${EN} has ${en.blocks.length}, ${JA} has ${ja.blocks.length}`
  );
} else {
  en.blocks.forEach((block, i) => {
    if (block !== ja.blocks[i]) errors.push(`code block #${i + 1} differs between ${EN} and ${JA}`);
  });
}
if (en.headings !== ja.headings) {
  errors.push(`heading levels differ: ${EN} has [${en.headings}], ${JA} has [${ja.headings}]`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}
console.log(
  `${EN} and ${JA} are in sync (${en.blocks.length} code blocks, ${en.headings.split(',').length} headings).`
);
