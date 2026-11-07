// index.html → shot-1280x800.png + shot-1280x800.jpg (≈400 KB)
// 실행: node docs/design/style-study/<시안>/render.mjs
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { statSync, renameSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const dir = dirname(fileURLToPath(import.meta.url));
const png = join(dir, 'shot-1280x800.png');
const jpg = join(dir, 'shot-1280x800.jpg');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('pageerror:', e.message));
await page.goto(pathToFileURL(join(dir, 'index.html')).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
const fonts = await page.evaluate(() =>
  [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family))]);
console.log('fonts loaded:', fonts.join(', ') || '(none)');
await page.waitForTimeout(300);
await page.screenshot({ path: png });

// JPG: ffmpeg 가 있으면 품질을 바꿔 가며 400 KB 에 가장 가까운 것을 고른다.
const target = 400 * 1024;
const ff = spawnSync('ffmpeg', ['-version']);
if (ff.status === 0) {
  let best = null;
  for (let q = 2; q <= 12; q++) {
    const tmp = join(dir, `.q${q}.jpg`);
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-q:v', String(q), tmp]);
    const size = statSync(tmp).size;
    if (!best || Math.abs(size - target) < Math.abs(best.size - target)) {
      if (best) unlinkSync(best.tmp);
      best = { q, size, tmp };
    } else unlinkSync(tmp);
  }
  renameSync(best.tmp, jpg);
  console.log(`jpg q=${best.q} ${(best.size / 1024).toFixed(0)} KB`);
} else {
  await page.screenshot({ path: jpg, type: 'jpeg', quality: 88 });
  console.log(`jpg (playwright) ${(statSync(jpg).size / 1024).toFixed(0)} KB`);
}
await browser.close();
if (!existsSync(png)) process.exit(1);
