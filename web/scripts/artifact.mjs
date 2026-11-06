// web/dist/index.html (vite-plugin-singlefile 결과) → web/dist/artifact.html
// claude.ai Artifact 페이지 계약: <!doctype>/<html>/<head>/<body> 없음, 첫 줄 <title>·<meta claude:viewport-fit-sides>,
// 외부 자원은 Google Fonts 스타일시트만, 모두 인라인, 16MB 이하.
// 인자: 대상 이름 하나(기본 main). slice = 그래픽 슬라이스(web/dist/slice/index.html → web/dist/slice-artifact.html, 12-graphic-slice).

import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const TARGETS = {
  main: { src: '../dist/index.html', out: '../dist/artifact.html', title: '저승굿' },
  slice: { src: '../dist/slice/index.html', out: '../dist/slice-artifact.html', title: '저승굿 그래픽 슬라이스' },
};
const targetName = process.argv[2] ?? 'main';
const target = TARGETS[targetName];
if (!target) throw new Error(`unknown artifact target ${targetName} (${Object.keys(TARGETS).join(' | ')})`);
const src = resolve(here, target.src);
const out = resolve(here, target.out);
const titleLine = `<title>${target.title}</title>`;
const html = readFileSync(src, 'utf8');

const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)].map((m) => ({ attrs: m[1], body: m[2] }));
const fontLinks = [...html.matchAll(/<link[^>]+href="(https:\/\/fonts\.(?:googleapis|gstatic)\.com[^"]*)"[^>]*>/gi)].map((m) => m[0]);

if (!styles.length) throw new Error('no inline <style> found — did vite-plugin-singlefile run?');
if (!scripts.length || scripts.some((s) => /\bsrc=/.test(s.attrs))) throw new Error('scripts must be inline');

const fixScript = (s) => s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const parts = [
  titleLine,
  '<meta name="claude:viewport-fit-sides" content="cover">',
  ...fontLinks,
  ...styles.map((s) => `<style>${s}</style>`),
  ...scripts.map((s) => `<script type="module">${fixScript(s.body)}</script>`),
  '',
];
const result = parts.join('\n');

// 계약 검사
const errors = [];
const outsideScripts = result.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
for (const tag of ['<!doctype', '<html', '<head', '<body', '</html', '</head', '</body']) {
  if (outsideScripts.toLowerCase().includes(tag)) errors.push(`forbidden tag ${tag}`);
}
for (const s of scripts) for (const tag of ['<!doctype', '<html', '<head', '<body']) if (s.body.toLowerCase().includes(tag)) errors.push(`script contains ${tag}`);
const lines = result.split('\n');
if (lines[0] !== titleLine) errors.push('first line must be <title>');
if (!lines[1].startsWith('<meta name="claude:viewport-fit-sides"')) errors.push('second line must be the viewport-fit meta');
const urls = [...outsideScripts.matchAll(/(?:href|src)\s*=\s*"([^"]+)"/gi)].map((m) => m[1]);
for (const u of urls) if (!/^https:\/\/fonts\.(googleapis|gstatic)\.com(\/|$)/.test(u)) errors.push(`external resource not allowed: ${u}`);
const cssUrls = styles.flatMap((s) => [...s.matchAll(/url\(\s*['"]?([^'")]+)/gi)].map((m) => m[1])).filter((u) => !u.startsWith('#') && !u.startsWith('data:'));
for (const u of cssUrls) errors.push(`css url not inline: ${u}`);
const css = styles.join('\n');
if (!css.includes('padding-left:max(16px,env(safe-area-inset-left,0px))') && !css.includes('padding-left: max(16px, env(safe-area-inset-left, 0px))')) errors.push('outer gutter padding-left missing');
if (!/color-scheme:\s*dark/.test(css)) errors.push('color-scheme: dark missing');
if (/\balert\(|\bconfirm\(|\bprompt\(|window\.print/.test(scripts.map((s) => s.body).join('\n').replace(/["'`][^"'`]*["'`]/g, ''))) errors.push('blocked dialog API used');
writeFileSync(out, result);
const size = statSync(out).size;
if (size > 16 * 1024 * 1024) errors.push(`artifact too large: ${size}`);
if (errors.length) {
  console.error('artifact contract violations:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log(`web/dist/${basename(out)} — ${(size / 1024).toFixed(1)} KB (${lines.length} lines, ${fontLinks.length} font links, ${styles.length} style, ${scripts.length} script)`);
