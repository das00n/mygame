// 목업 HTML → PNG (1280×800, 390×844). 미리 깔린 Playwright Chromium 을 쓴다.
// 실행: node tools/presentation/build.mjs && node tools/presentation/render.mjs [a|b|c]
// Google Fonts 는 curl 로 받아 임시 폴더에 캐시해서 내준다(플레이어블 e2e 와 같은 방식). 못 받으면 대체 글꼴.
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PAGES } from './build.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = join(root, 'docs', 'design', 'presentation');
const pngDir = join(dir, 'png');
mkdirSync(pngDir, { recursive: true });
const fontCache = join(tmpdir(), 'jeoseunggut-fonts');
mkdirSync(fontCache, { recursive: true });

function fetchCached(u, ua) {
  const key = createHash('sha1').update(u + (u.includes('/css') ? ua : '')).digest('hex');
  const file = join(fontCache, key);
  const meta = file + '.type';
  if (existsSync(file) && existsSync(meta)) return Promise.resolve({ body: readFileSync(file), type: readFileSync(meta, 'utf8') });
  return new Promise((res) => {
    execFile('curl', ['-sSL', '--max-time', '20', '-A', ua, '-o', file, '-w', '%{content_type}', u], { encoding: 'utf8' }, (err, stdout) => {
      if (err || !existsSync(file)) return res(null);
      writeFileSync(meta, stdout || 'application/octet-stream');
      res({ body: readFileSync(file), type: stdout || 'application/octet-stream' });
    });
  });
}

const only = process.argv[2];
const VIEWPORTS = [{ width: 1280, height: 800 }, { width: 390, height: 844 }];
const browser = await chromium.launch();
const problems = [];
for (const p of PAGES) {
  if (only && p.key !== only) continue;
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => problems.push(`${p.file}: ${e.message}`));
    await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async (route) => {
      const req = route.request();
      const got = await fetchCached(req.url(), req.headers()['user-agent'] ?? 'Mozilla/5.0 Chrome/120');
      if (got) await route.fulfill({ status: 200, contentType: got.type, body: got.body, headers: { 'access-control-allow-origin': '*' } });
      else await route.fulfill({ status: 200, contentType: req.url().includes('/css') ? 'text/css' : 'font/woff2', body: '' });
    });
    for (const s of p.screens) {
      await page.goto(pathToFileURL(join(dir, p.file)).href + '#' + s);
      await page.addStyleTag({ content: '.switch{display:none!important}' });
      await page.evaluate(() => document.fonts?.ready);
      await page.waitForTimeout(150);
      const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      if (sw > iw + 1) problems.push(`${p.key}-${s} ${vp.width}: horizontal scroll ${sw} > ${iw}`);
      const name = `${p.key}-${s}-${vp.width}x${vp.height}.png`;
      await page.screenshot({ path: join(pngDir, name) });
      console.log('png', name);
    }
    await ctx.close();
  }
}
await browser.close();
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
}
