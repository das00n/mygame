// 3D 화풍 시안 렌더 — 묶은 index.html 을 헤드리스 크로뮴(SwiftShader, CPU)에서 1280×800 으로 열고, 준비 깃발(__READY)을 기다려 찍는다.
// 실행(레포 뿌리에서): node docs/design/style-study/_kit-3d/shot.mjs s7-toon3d [...]
// 결과: <id>/shot-1280x800.png · <id>/shot-1280x800.jpg(≈400KB) · 콘솔에 렌더 시간과 글꼴 확인
import { execFileSync, execSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(join(execSync('npm root -g').toString().trim(), 'playwright'));
}
const here = dirname(fileURLToPath(import.meta.url));
const studyDir = resolve(here, '..');

/** PNG → JPEG, 품질을 골라 목표 크기(≈400KB)에 맞춘다(Pillow) */
function toJpeg(png, jpg, target = 400 * 1024) {
  const py = `
import sys
from PIL import Image
src, dst, target = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src).convert('RGB')
lo, hi, best = 50, 97, None
while lo <= hi:
    q = (lo + hi) // 2
    im.save(dst, 'JPEG', quality=q, subsampling=0, optimize=True, progressive=True)
    import os
    s = os.path.getsize(dst)
    if s <= target * 1.05:
        best = q; lo = q + 1
    else:
        hi = q - 1
im.save(dst, 'JPEG', quality=best or 50, subsampling=0, optimize=True, progressive=True)
print(best)
`;
  return execFileSync('python3', ['-I', '-c', py, png, jpg, String(target)], { encoding: 'utf8' }).trim();
}

const browser = await playwright.chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const id of process.argv.slice(2)) {
  const dir = join(studyDir, id);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`);
    if (m.type() === 'log') console.log(`  [${id}] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  // 오프라인 확인: 바깥 요청은 모두 막는다
  await page.route(/^https?:\/\//, (route) => {
    errors.push(`blocked network request: ${route.request().url()}`);
    route.abort();
  });
  const t0 = Date.now();
  await page.goto(pathToFileURL(join(dir, 'index.html')).href);
  await page.waitForFunction(() => globalThis.__READY === true, null, { timeout: 600_000, polling: 500 });
  const info = await page.evaluate(() => globalThis.__INFO);
  const png = join(dir, 'shot-1280x800.png');
  const jpg = join(dir, 'shot-1280x800.jpg');
  await page.screenshot({ path: png });
  const q = toJpeg(png, jpg);
  console.log(`${id}: ready in ${((Date.now() - t0) / 1000).toFixed(1)}s · ${JSON.stringify(info)}`);
  console.log(`${id}: png ${(statSync(png).size / 1024).toFixed(0)} KB · jpg ${(statSync(jpg).size / 1024).toFixed(0)} KB (q${q})`);
  if (errors.length) console.log(`${id}: console/errors:\n  ` + errors.join('\n  '));
  await ctx.close();
}
await browser.close();
