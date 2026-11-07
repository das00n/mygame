// 3D 화풍 시안(s7·s8·s9) 빌드 — src/index.html + main.ts 를 HTML 한 장으로 묶고, Google Fonts 를 글자 부분집합으로 받아 base64 로 넣는다(오프라인에서 열린다).
// 실행(레포 뿌리에서): node docs/design/style-study/_kit-3d/build.mjs s7-toon3d [s8-real3d s9-papercraft]
// 결과: docs/design/style-study/<id>/index.html
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const here = dirname(fileURLToPath(import.meta.url));
const studyDir = resolve(here, '..');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

/** 주석을 뺀 소스의 글자 모음(폰트 부분집합용) */
function collectText(files) {
  const set = new Set();
  for (const f of files) {
    let s = readFileSync(f, 'utf8');
    s = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, '');
    for (const ch of s) if (ch.codePointAt(0) >= 0x20) set.add(ch);
  }
  // 숫자·기호는 늘 넣는다
  for (const ch of '0123456789/·−-+→↗◇%()[]「」:') set.add(ch);
  return [...set].join('');
}

function curl(url, binary) {
  return execFileSync('curl', ['-sSL', '--max-time', '40', '-A', UA, url], { encoding: binary ? 'buffer' : 'utf8', maxBuffer: 64 << 20 });
}

/** <meta name="gfonts" content="Jua|Gowun+Dodum:wght@400;700"> → 부분집합 @font-face(base64) */
function inlineFonts(families, text) {
  const q = families.map((f) => `family=${f}`).join('&');
  const css = curl(`https://fonts.googleapis.com/css2?${q}&display=block&text=${encodeURIComponent(text)}`);
  const cache = new Map();
  let total = 0;
  const out = css.replace(/url\((https:[^)]+)\)\s*format\('([^']+)'\)/g, (_, u, fmt) => {
    if (!cache.has(u)) {
      const buf = curl(u, true);
      total += buf.length;
      cache.set(u, buf.toString('base64'));
    }
    return `url(data:font/${fmt};base64,${cache.get(u)}) format('${fmt}')`;
  });
  if (!/@font-face/.test(out)) throw new Error('Google Fonts CSS 를 받지 못했다:\n' + css.slice(0, 400));
  return { css: out, bytes: total };
}

async function buildOne(id) {
  const dir = join(studyDir, id);
  const src = join(dir, 'src');
  const tmp = mkdtempSync(join(tmpdir(), `style3d-${id}-`));
  await build({
    root: src,
    base: './',
    logLevel: 'warn',
    configFile: false,
    plugins: [viteSingleFile({ removeViteModuleLoader: true })],
    build: { outDir: tmp, emptyOutDir: true, target: 'es2022', assetsInlineLimit: 100_000_000, cssCodeSplit: false, chunkSizeWarningLimit: 4000 },
  });
  let html = readFileSync(join(tmp, 'index.html'), 'utf8');
  rmSync(tmp, { recursive: true, force: true });

  const m = html.match(/<meta name="gfonts" content="([^"]+)"\s*\/?>/);
  if (m) {
    const families = m[1].split('|');
    const srcFiles = [...readdirSync(src).map((f) => join(src, f)), join(here, 'ui.ts')].filter((f) => /\.(ts|html|css)$/.test(f));
    const text = collectText(srcFiles);
    const { css, bytes } = inlineFonts(families, text);
    html = html.replace(m[0], `<style id="gfonts">\n${css}</style>`);
    console.log(`${id}: fonts ${families.join(', ')} · ${[...text].length} glyphs · ${(bytes / 1024).toFixed(0)} KB`);
  }
  writeFileSync(join(dir, 'index.html'), html);
  console.log(`${id}: index.html ${(html.length / 1024).toFixed(0)} KB`);
}

const ids = process.argv.slice(2);
if (!ids.length) {
  console.error('usage: node build.mjs <id> [...]');
  process.exit(1);
}
for (const id of ids) await buildOne(id);
