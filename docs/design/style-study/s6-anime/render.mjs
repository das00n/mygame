// index.html → shot-1280x800.png + shot-1280x800.jpg (≈400 KB)
// 실행: node docs/design/style-study/<시안>/render.mjs
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { statSync } from 'fs';
import { execFileSync } from 'child_process';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const png = join(here, 'shot-1280x800.png');
const jpg = join(here, 'shot-1280x800.jpg');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto('file://' + join(here, 'index.html'));
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
// 글꼴 확인: 쓰인 글꼴 가족마다 실제로 받은 면(face)이 있어야 한다
const fonts = await page.evaluate(() => {
  const got = {};
  for (const f of document.fonts) if (f.status === 'loaded') got[f.family.replace(/"/g, '')] = (got[f.family.replace(/"/g, '')] || 0) + 1;
  return { got, need: window.__fonts || [] };
});
const missing = fonts.need.filter((f) => !fonts.got[f]);
console.log('loaded font faces:', JSON.stringify(fonts.got));
if (missing.length) { console.error('MISSING FONTS:', missing.join(', ')); process.exitCode = 1; }
await page.waitForTimeout(300);
await page.screenshot({ path: png, clip: { x: 0, y: 0, width: 1280, height: 800 } });
await browser.close();

// JPG: 400 KB 안팎이 되도록 품질을 고른다
let q = 2;
for (; q <= 20; q++) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-q:v', String(q), jpg]);
  if (statSync(jpg).size <= 420 * 1024) break;
}
console.log(`png ${Math.round(statSync(png).size / 1024)} KB · jpg ${Math.round(statSync(jpg).size / 1024)} KB (q=${q})`);
