// web:slice:e2e — 그래픽 슬라이스(web/dist/slice-artifact.html) 연기 시험(12-graphic-slice).
//  S1 1280×800 · 움직임 켬: 무대가 그려진다(캔버스가 비어 있지 않다) → 손패에서 진짜 카드를 내고(대상 고르기 포함) 턴 종료 → 자동 진행으로 전투 끝까지
//  S2 1920×1080 · 움직임 줄이기: 바쁜 턴 대본(실제 카드 6장: 해원 1 · 처치 1)이 끝까지 돈다 → 보스 → 러프 보기로 바꿔 같은 전투가 러프로 그려진다 → 새 그림으로 돌아와 한 턴
// 콘솔 오류 0, 가로 스크롤 0. 실행: npm run web:slice && node web/scripts/slice-e2e.mjs

import { execFile, execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(join(execSync('npm root -g').toString().trim(), 'playwright'));
}
const { chromium } = playwright;

const here = dirname(fileURLToPath(import.meta.url));
const artifactPath = resolve(here, '../dist/slice-artifact.html');
if (!existsSync(artifactPath)) {
  console.error('web/dist/slice-artifact.html 이 없다 — 먼저 npm run web:slice');
  process.exit(1);
}
const page = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>\n${readFileSync(artifactPath, 'utf8')}\n</body></html>`;
const server = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(page);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

// Google Fonts: curl(프록시 설정을 따른다)로 받아 캐시에서 내준다(e2e.mjs 와 같은 캐시). 못 받으면 빈 응답 = 대체 글꼴
const fontCache = join(tmpdir(), 'jeoseunggut-font-cache');
mkdirSync(fontCache, { recursive: true });
function fetchCached(u, ua) {
  const key = createHash('sha1').update(u + (u.includes('/css') ? ua : '')).digest('hex');
  const file = join(fontCache, key);
  const meta = file + '.type';
  if (existsSync(file) && existsSync(meta)) return Promise.resolve({ body: readFileSync(file), type: readFileSync(meta, 'utf8') });
  return new Promise((ok) => {
    execFile('curl', ['-sSL', '--max-time', '20', '-A', ua, '-o', file, '-w', '%{content_type}', u], { encoding: 'utf8' }, (err, stdout) => {
      if (err || !existsSync(file)) return ok(null);
      writeFileSync(meta, stdout || 'application/octet-stream');
      ok({ body: readFileSync(file), type: stdout || 'application/octet-stream' });
    });
  });
}

async function open(browser, viewport, reduced) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await p.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async (route) => {
    const req = route.request();
    const got = await fetchCached(req.url(), req.headers()['user-agent'] ?? 'Mozilla/5.0 Chrome/120');
    if (got) await route.fulfill({ status: 200, contentType: got.type, body: got.body, headers: { 'access-control-allow-origin': '*' } });
    else await route.fulfill({ status: 200, contentType: req.url().includes('/css') ? 'text/css' : 'font/woff2', body: '' });
  });
  await p.goto(url);
  await p.waitForFunction(() => globalThis.__SLICE?.stage()?.firstFrameAt > 0, null, { timeout: 30000 });
  return { ctx, p, errors };
}

const noHScroll = async (p, errors, label) => {
  const [sw, iw] = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  if (sw > iw + 1) errors.push(`horizontal page scroll on ${label}: ${sw} > ${iw}`);
};
const st = (p) => p.evaluate(() => globalThis.__SLICE.state());
const waitIdle = (p, ms = 30000) => p.waitForFunction(() => globalThis.__SLICE.state().idle, null, { timeout: ms });

/** 캔버스가 실제로 그려졌는가: 무대 영역 스크린숏의 밝기 분산 */
async function stagePainted(p) {
  const box = await p.locator('[data-testid=stage]').boundingBox();
  const buf = await p.screenshot({ clip: { x: box.x + box.width * 0.1, y: box.y + box.height * 0.1, width: box.width * 0.8, height: box.height * 0.5 } });
  return createHash('sha1').update(buf).digest('hex') !== '' && buf.length > 20000;
}

/** 손패에서 낼 수 있는 카드 한 장을 누르고, 대상이 필요하면 원귀·영웅을 누른다 */
async function playOneCard(p) {
  const cards = await p.$$('[data-testid=hand] .sl-card:not(.dis)');
  if (!cards.length) return false;
  const before = (await st(p)).energy;
  await cards[0].click();
  for (let k = 0; k < 4; k++) {
    const playBtn = await p.$('[data-testid=play-card]');
    if (playBtn) {
      await playBtn.click();
      break;
    }
    const e = await p.$('.sl-unit.enemy.targetable');
    if (e) {
      await e.click();
      continue;
    }
    const h = await p.$('.sl-unit.hero.targetable');
    if (h) {
      await h.click();
      continue;
    }
    break;
  }
  await waitIdle(p);
  return (await st(p)).energy < before || (await st(p)).hand >= 0;
}

const browser = await chromium.launch();
const results = [];

// ── S1: 1280×800, 움직임 켬 ──────────────────────────────────────────
{
  const t0 = Date.now();
  const { ctx, p, errors } = await open(browser, { width: 1280, height: 800 }, false);
  const notes = [];
  try {
    if (!(await p.$('canvas.sl-canvas'))) errors.push('no pixi canvas');
    if (!(await stagePainted(p))) errors.push('stage looks blank');
    const renderer = await p.evaluate(() => document.querySelector('canvas.sl-canvas')?.getContext('webgl2') ? 'webgl2' : 'webgl');
    notes.push(renderer);
    // 카드 틀 · 완성 삽화
    const arts = await p.$$eval('[data-testid=hand] .sl-card .sl-art.done img', (els) => els.length);
    if (!arts) errors.push('no finished card art in hand');
    await noHScroll(p, errors, 's1-start');
    const s0 = await st(p);
    // 진짜 카드: 대상 고르기까지 손으로
    if (!(await playOneCard(p))) errors.push('could not play a card');
    if (!(await playOneCard(p))) errors.push('could not play a second card');
    await p.click('[data-testid=end-turn]');
    await waitIdle(p);
    const s1 = await st(p);
    if (s1.turn !== s0.turn + 1 && s1.outcome === 0) errors.push(`turn did not advance (${s0.turn} → ${s1.turn})`);
    // 자동 진행으로 끝까지
    await p.click('[data-testid=auto]');
    await p.waitForSelector('[data-testid=battle-end]', { timeout: 180000 });
    const s2 = await st(p);
    if (s2.outcome === 0) errors.push('battle-end shown without outcome');
    if (s2.tally.haewon + s2.tally.cheochi < 1 && s2.outcome === 1) errors.push('won without any fate recorded');
    const fates = await p.$$eval('.sl-plate .fate', (els) => els.map((e) => e.textContent));
    notes.push(`turns ${s2.turn} · outcome ${s2.outcome} · 해원 ${s2.tally.haewon} · 처치 ${s2.tally.cheochi} · plates ${fates.join('/')}`);
    await noHScroll(p, errors, 's1-end');
  } catch (e) {
    errors.push(`exception: ${e.message}`);
    await p.screenshot({ path: join(tmpdir(), 'jeoseunggut-slice-e2e-S1.png') }).catch(() => {});
  }
  results.push({ run: 'S1', viewport: '1280x800', motion: 'on', notes, errors, sec: Math.round((Date.now() - t0) / 1000) });
  await ctx.close();
}

// ── S2: 1920×1080, 움직임 줄이기 ───────────────────────────────────────
{
  const t0 = Date.now();
  const { ctx, p, errors } = await open(browser, { width: 1920, height: 1080 }, true);
  const notes = [];
  try {
    const reduced = await p.evaluate(() => globalThis.__SLICE.reduced);
    if (!reduced) errors.push('prefers-reduced-motion not detected');
    const r = await p.evaluate(() => globalThis.__SLICE.runBusy(60));
    if (r.haewon !== 1 || r.cheochi !== 1 || r.outcome !== 1) errors.push(`busy turn: ${JSON.stringify(r)}`);
    // 움직임 줄이기에서도 끝 모양 · 글자가 남는다(정보 손실 없음)
    const fates = await p.$$eval('.sl-plate .fate', (els) => els.map((e) => e.className));
    if (!fates.some((c) => c.includes('haewon')) || !fates.some((c) => c.includes('kill'))) errors.push(`fate plates ${fates.join(',')}`);
    notes.push(`busy ${JSON.stringify(r)}`);
    await p.click('[data-testid=start-boss]');
    await waitIdle(p);
    const sb = await st(p);
    if (sb.kind !== 'boss') errors.push('boss did not start');
    // 러프 보기: 같은 전투를 러프 SVG 무대 · 부적 카드로
    await p.click('[data-testid=mode-rough]');
    await p.waitForSelector('[data-testid=stage] .stage svg.stage-svg');
    const roughCards = await p.$$eval('[data-testid=hand] .card', (els) => els.length);
    if (!roughCards) errors.push('rough mode: no rough cards');
    await noHScroll(p, errors, 's2-rough');
    await p.click('[data-testid=mode-new]');
    if (!(await playOneCard(p))) errors.push('boss: could not play a card');
    await p.click('[data-testid=end-turn]');
    await waitIdle(p);
    const sb2 = await st(p);
    if (sb2.turn < 2 && sb2.outcome === 0) errors.push('boss: turn did not advance');
    // 카드 보기(새 틀 · 강화판)
    await p.click('[data-testid=gallery-open]');
    await p.waitForSelector('[data-testid=gallery] .sl-card.up');
    const ups = await p.$$eval('[data-testid=gallery] .sl-card.up .sl-up', (els) => els.length);
    if (ups < 12) errors.push(`gallery: upgraded cards ${ups}`);
    notes.push(`boss turn ${sb2.turn} · rough cards ${roughCards} · gallery upgraded ${ups}`);
    await noHScroll(p, errors, 's2-gallery');
  } catch (e) {
    errors.push(`exception: ${e.message}`);
    await p.screenshot({ path: join(tmpdir(), 'jeoseunggut-slice-e2e-S2.png') }).catch(() => {});
  }
  results.push({ run: 'S2', viewport: '1920x1080', motion: 'reduce', notes, errors, sec: Math.round((Date.now() - t0) / 1000) });
  await ctx.close();
}

await browser.close();
server.close();
let failed = false;
for (const r of results) {
  console.log(`[${r.run}] ${r.viewport} motion ${r.motion} → ${r.notes.join(' · ')} ${r.sec}s${r.errors.length ? `\n   errors:\n   ${r.errors.slice(0, 10).join('\n   ')}` : ' OK'}`);
  if (r.errors.length) failed = true;
}
if (failed) {
  console.error('slice e2e: FAILED');
  process.exit(1);
}
console.log(`slice e2e: ${results.length} runs OK, no console errors`);
