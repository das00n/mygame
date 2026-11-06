// web:slice:bench — 그래픽 슬라이스 성능 시험(D9) + 디자이너용 증거(12-graphic-slice).
//  · 프레임 시간: 바쁜 턴 대본(실제 카드 6장 · 적 차례 · 해원 1 · 처치 1)을 도는 동안 requestAnimationFrame 간격 → 중앙값 · p95 · 16.7ms 이하 비율
//    1280×800 · 1920×1080, 새 그림(PixiJS WebGL)과 러프(SVG + CSS)를 같은 대본으로. 헤드리스 크로뮴은 WebGL 을 CPU(SwiftShader)로 그린다 → 비관적 하한
//  · 첫 프레임까지 시간(탐색 시작 → PixiJS 첫 그림), JS 묶음 크기(전체 · gzip · PixiJS 몫)
//  · 스크린숏(새 그림 · 러프 × 1280 · 1920: 일반 전투 · 보스 · 해원 순간 · 처치 순간 · 손패) + 카드 틀 · 실루엣 + 한 턴 webm
// 실행: npm run web:slice && npm run web:slice:bench   (옵션: --runs N · --no-shots · --no-video · --quick · --headed = 화면을 띄워 실제 GPU 로 잰다)

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { cpus, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(join(execSync('npm root -g').toString().trim(), 'playwright'));
}
const { chromium } = playwright;

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const artifactPath = resolve(here, '../dist/slice-artifact.html');
const outDir = resolve(root, 'docs/design/slice');
mkdirSync(outDir, { recursive: true });
const args = process.argv.slice(2);
const RUNS = args.includes('--runs') ? Number(args[args.indexOf('--runs') + 1]) : 3;
const SHOTS = !args.includes('--no-shots');
const VIDEO = !args.includes('--no-video');
const QUICK = args.includes('--quick');
if (!existsSync(artifactPath)) {
  console.error('web/dist/slice-artifact.html 이 없다 — 먼저 npm run web:slice');
  process.exit(1);
}
const artifact = readFileSync(artifactPath, 'utf8');
const page = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>\n${artifact}\n</body></html>`;
const server = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(page);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;
const fontCache = join(tmpdir(), 'jeoseunggut-font-cache');

/** e2e 가 캐시해 둔 Google Fonts 를 쓴다(없으면 빈 응답 = 대체 글꼴 — 측정에는 상관없다) */
function cachedFont(u, ua) {
  for (const key of [u + (u.includes('/css') ? ua : ''), u]) {
    const h = createHash('sha1').update(key).digest('hex');
    const f = join(fontCache, h);
    if (existsSync(f) && existsSync(f + '.type')) return { body: readFileSync(f), type: readFileSync(f + '.type', 'utf8') };
  }
  return null;
}

const SIZES = [{ width: 1280, height: 800 }, { width: 1920, height: 1080 }];
const tag = (v) => `${v.width}x${v.height}`;

async function open(browser, viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'no-preference', ...(o.video ? { recordVideo: { dir: o.video, size: viewport } } : {}) });
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  p.on('pageerror', (e) => errors.push(e.message));
  await p.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async (route) => {
    const req = route.request();
    const got = cachedFont(req.url(), req.headers()['user-agent'] ?? '');
    if (got) await route.fulfill({ status: 200, contentType: got.type, body: got.body, headers: { 'access-control-allow-origin': '*' } });
    else await route.fulfill({ status: 200, contentType: req.url().includes('/css') ? 'text/css' : 'font/woff2', body: '' });
  });
  await p.goto(url);
  await p.waitForFunction(() => globalThis.__SLICE?.stage()?.firstFrameAt > 0, null, { timeout: 60000 });
  await p.evaluate(() => document.fonts?.ready);
  return { ctx, p, errors };
}

function stats(ft) {
  const a = ft.slice().sort((x, y) => x - y);
  const q = (k) => a[Math.min(a.length - 1, Math.floor(k * (a.length - 1)))];
  const mean = a.reduce((s, x) => s + x, 0) / a.length;
  return {
    frames: a.length, median: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), p99: +q(0.99).toFixed(2), max: +a[a.length - 1].toFixed(1), mean: +mean.toFixed(2),
    under16_7: +((a.filter((x) => x <= 16.7).length / a.length) * 100).toFixed(1), fps: +(1000 / mean).toFixed(1),
  };
}

/** 바쁜 턴을 돌며 rAF 간격을 잰다 */
async function measureBusy(p, mode) {
  await p.evaluate((m) => globalThis.__SLICE.setMode(m), mode);
  await p.waitForTimeout(600);
  return p.evaluate(async () => {
    const ft = [];
    let on = true;
    let last = 0;
    const f = (t) => {
      if (last) ft.push(t - last);
      last = t;
      if (on) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
    const t0 = performance.now();
    const r = await globalThis.__SLICE.runBusy(380);
    on = false;
    return { ft: ft.slice(2), ms: performance.now() - t0, result: r, particlesPeak: 0 };
  });
}

async function measureIdle(p, ms) {
  return p.evaluate(async (dur) => {
    const ft = [];
    let last = 0;
    const t0 = performance.now();
    await new Promise((done) => {
      const f = (t) => {
        if (last) ft.push(t - last);
        last = t;
        if (t - t0 < dur) requestAnimationFrame(f);
        else done();
      };
      requestAnimationFrame(f);
    });
    return ft.slice(2);
  }, ms);
}

const browser = await chromium.launch({ headless: !args.includes('--headed') });
const env = {};
const perf = { env, bundle: {}, firstFrame: {}, busy: {}, idle: {}, errors: [] };

// ── 환경 · 묶음 크기 ───────────────────────────────────────────────────
{
  const { ctx, p } = await open(browser, SIZES[0]);
  Object.assign(env, await p.evaluate(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER), vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : '', ua: navigator.userAgent, dpr: devicePixelRatio, hardwareConcurrency: navigator.hardwareConcurrency };
  }));
  env.chromium = browser.version();
  env.cpu = `${cpus()[0]?.model ?? '?'} × ${cpus().length}`;
  await ctx.close();
}
{
  const html = readFileSync(resolve(here, '../dist/slice/index.html'), 'utf8');
  const js = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join('\n');
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  perf.bundle = { jsKB: +(Buffer.byteLength(js) / 1024).toFixed(1), jsGzipKB: +(gzipSync(js).length / 1024).toFixed(1), cssKB: +(Buffer.byteLength(css) / 1024).toFixed(1), artifactKB: +(Buffer.byteLength(artifact) / 1024).toFixed(1) };
  // PixiJS 몫: 같은 설정(esbuild, 압축)으로 pixi.js 전체를 묶은 크기 = 위 상한
  try {
    const esbuild = require(resolve(root, 'node_modules/esbuild'));
    const r = esbuild.buildSync({ stdin: { contents: "export * from 'pixi.js'; import 'pixi.js/unsafe-eval';", resolveDir: root }, bundle: true, minify: true, format: 'esm', write: false, target: 'es2022', logLevel: 'silent' });
    const code = r.outputFiles[0].contents;
    perf.bundle.pixiKB = +(code.length / 1024).toFixed(1);
    perf.bundle.pixiGzipKB = +(gzipSync(code).length / 1024).toFixed(1);
  } catch (e) {
    perf.errors.push(`pixi size: ${e.message}`);
  }
  const main = resolve(here, '../dist/artifact.html');
  if (existsSync(main)) perf.bundle.mainArtifactKB = +(readFileSync(main).length / 1024).toFixed(1);
}

// ── 첫 프레임 · 프레임 시간 ───────────────────────────────────────────
for (const v of SIZES) {
  const k = tag(v);
  perf.firstFrame[k] = [];
  perf.busy[k] = { new: [], rough: [] };
  const runs = QUICK ? 1 : RUNS;
  for (let i = 0; i < runs; i++) {
    const { ctx, p, errors } = await open(browser, v);
    const ff = await p.evaluate(() => {
      const m = (n) => performance.getEntriesByName(n)[0]?.startTime ?? null;
      const nav = performance.getEntriesByType('navigation')[0];
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null;
      return { firstFrame: globalThis.__SLICE.stage().firstFrameAt, pixiReady: m('slice:pixi-ready'), sceneBuilt: m('slice:scene-built'), domContentLoaded: nav?.domContentLoadedEventEnd ?? null, fcp };
    });
    perf.firstFrame[k].push(ff);
    await p.waitForTimeout(800);
    if (i === 0) perf.idle[k] = stats(await measureIdle(p, 3000));
    const b = await measureBusy(p, 'new');
    perf.busy[k].new.push({ ...stats(b.ft), ms: Math.round(b.ms), result: b.result });
    if (i === 0) {
      const r = await measureBusy(p, 'rough');
      perf.busy[k].rough.push({ ...stats(r.ft), ms: Math.round(r.ms), result: r.result });
    }
    if (errors.length) perf.errors.push(...errors.map((e) => `${k}: ${e}`));
    await ctx.close();
    console.log(`[perf ${k} #${i + 1}] first frame ${Math.round(ff.firstFrame)}ms · busy new median ${perf.busy[k].new.at(-1).median}ms p95 ${perf.busy[k].new.at(-1).p95}ms ≤16.7 ${perf.busy[k].new.at(-1).under16_7}%`);
  }
}

// ── 스크린숏 ──────────────────────────────────────────────────────────
// 저장소 크기: ffmpeg 가 있으면 팔레트 PNG(256색, 디더링)로 줄인다(약 1/3). 없으면 원본 PNG
const FFMPEG = (() => {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
function palettize(file) {
  if (!FFMPEG) return;
  const tmp = file.replace(/\.png$/, '.q.png');
  execSync(`ffmpeg -loglevel error -y -i "${file}" -vf "split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a" "${tmp}"`);
  copyFileSync(tmp, file);
  rmSync(tmp);
}
async function shoot(p, name) {
  const file = join(outDir, `${name}.png`);
  await p.screenshot({ path: file });
  palettize(file);
}

if (SHOTS) {
  for (const v of SIZES) {
    const k = tag(v);
    for (const mode of ['new', 'rough']) {
      const pre = mode === 'new' ? '' : 'rough-';
      const { ctx, p, errors } = await open(browser, v);
      await p.evaluate((m) => globalThis.__SLICE.setMode(m), mode);
      await p.evaluate(() => globalThis.__SLICE.start('normal'));
      await p.waitForTimeout(1600);
      await shoot(p, `${pre}normal-${k}`);
      // 손패: 카드 하나를 골라 풀이가 펼쳐진 상태
      await p.click('[data-testid=hand-1]');
      await p.waitForTimeout(400);
      await shoot(p, `${pre}hand-${k}`);
      await p.evaluate(() => globalThis.__SLICE.clearSel());
      await p.evaluate(() => globalThis.__SLICE.start('boss'));
      await p.waitForTimeout(1600);
      await shoot(p, `${pre}boss-${k}`);
      // 해원 · 처치 순간 (바쁜 턴 대본)
      // 카드 사이를 넉넉히 띄워 해원 · 처치 순간이 겹치지 않게
      await p.evaluate(() => { globalThis.__SLICE_FATE = null; globalThis.__busy = globalThis.__SLICE.runBusy(1800); });
      await p.waitForFunction(() => globalThis.__SLICE_FATE?.fate === 'haewon', null, { timeout: 60000 });
      await p.waitForTimeout(mode === 'new' ? 700 : 350);
      await shoot(p, `${pre}haewon-${k}`);
      await p.waitForFunction(() => globalThis.__SLICE_FATE?.fate === 'cheochi', null, { timeout: 60000 });
      await p.waitForTimeout(mode === 'new' ? 330 : 250);
      await shoot(p, `${pre}cheochi-${k}`);
      await p.evaluate(() => globalThis.__busy);
      if (errors.length) perf.errors.push(...errors.map((e) => `shots ${k} ${mode}: ${e}`));
      await ctx.close();
      console.log(`[shots ${k} ${mode}] ok`);
    }
  }
  // 카드 틀(새 틀 · 강화판 · 러프) · 실루엣
  {
    const { ctx, p } = await open(browser, SIZES[1]);
    await p.click('[data-testid=gallery-open]');
    await p.waitForSelector('[data-testid=gallery] .sl-card.up');
    await p.waitForTimeout(500);
    await p.locator('[data-testid=gallery] .sheet').screenshot({ path: join(outDir, 'cards-1920x1080.png') });
    palettize(join(outDir, 'cards-1920x1080.png'));
    const sil = await p.evaluate(() => globalThis.__SLICE.silhouettes());
    writeFileSync(join(outDir, 'silhouettes.png'), Buffer.from(sil.split(',')[1], 'base64'));
    await ctx.close();
  }
}

// ── 한 턴 녹화 (webm) ─────────────────────────────────────────────────
if (VIDEO) {
  const dir = join(tmpdir(), `jeoseunggut-slice-video-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const { ctx, p } = await open(browser, SIZES[0], { video: dir });
  await p.waitForTimeout(800);
  await p.evaluate(() => globalThis.__SLICE.runBusy(520));
  await p.waitForTimeout(1200);
  const video = p.video();
  await ctx.close();
  const src = await video.path();
  copyFileSync(src, join(outDir, 'turn-1280x800.webm'));
  rmSync(dir, { recursive: true, force: true });
  console.log(`[video] ${join('docs/design/slice', 'turn-1280x800.webm')}`);
}

await browser.close();
server.close();
writeFileSync(join(outDir, 'perf.json'), JSON.stringify(perf, null, 2) + '\n');

// 요약 표 (문서에 옮긴다)
const med = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)];
console.log('\n| 크기 | 그림 | 프레임 중앙값 | p95 | ≤16.7ms | 평균 fps | 첫 프레임 |');
console.log('|---|---|---:|---:|---:|---:|---:|');
for (const v of SIZES) {
  const k = tag(v);
  const n = perf.busy[k].new;
  const ff = med(perf.firstFrame[k].map((x) => x.firstFrame));
  console.log(`| ${k} | 새 그림(PixiJS) | ${med(n.map((x) => x.median))}ms | ${med(n.map((x) => x.p95))}ms | ${med(n.map((x) => x.under16_7))}% | ${med(n.map((x) => x.fps))} | ${Math.round(ff)}ms |`);
  const r = perf.busy[k].rough[0];
  if (r) console.log(`| ${k} | 러프(SVG+CSS) | ${r.median}ms | ${r.p95}ms | ${r.under16_7}% | ${r.fps} | — |`);
}
console.log(`\nbundle: ${JSON.stringify(perf.bundle)}\nenv: ${JSON.stringify(env)}`);
if (perf.errors.length) {
  console.error(`errors:\n  ${perf.errors.join('\n  ')}`);
  process.exit(1);
}
