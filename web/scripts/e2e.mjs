// web:e2e — 만든 단일 HTML(web/dist/artifact.html)을 호스트처럼 감싸 띄우고, 보스 길 원정을 처음부터 결과 화면까지 자동 진행으로 끝까지 돌린다.
// 파티·시드를 바꿔 여러 번. 콘솔 오류가 없어야 하고, 폰 폭에서 가로 스크롤이 없어야 한다.
// 스크린숏(deviceScaleFactor 1)을 docs/design/screens/ 에 저장한다 (390×844, 1280×800).
// 실행: npm run web:artifact && npm run web:e2e   (옵션: --only N, --no-shots)

import { execFile, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
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
const root = resolve(here, '../..');
const artifactPath = resolve(here, '../dist/artifact.html');
const shotsDir = resolve(root, 'docs/design/screens');
const fontCache = join(tmpdir(), 'jeoseunggut-font-cache');
mkdirSync(fontCache, { recursive: true });
mkdirSync(shotsDir, { recursive: true });

const args = process.argv.slice(2);
const only = args.includes('--only') ? Number(args[args.indexOf('--only') + 1]) : -1;
const noShots = args.includes('--no-shots');

if (!existsSync(artifactPath)) {
  console.error('web/dist/artifact.html 이 없다 — 먼저 npm run web:artifact');
  process.exit(1);
}
const artifact = readFileSync(artifactPath, 'utf8');
// 호스트가 감싸는 것처럼 문서 뼈대를 씌운다
const page = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>\n${artifact}\n</body></html>`;

const server = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(page);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

// Google Fonts 는 curl(프록시 설정을 따른다)로 받아 캐시에서 내준다. 받지 못하면 빈 응답(대체 글꼴).
function fetchCached(u, ua) {
  const key = createHash('sha1').update(u + (u.includes('/css') ? ua : '')).digest('hex');
  const file = join(fontCache, key);
  const meta = file + '.type';
  if (existsSync(file) && existsSync(meta)) return Promise.resolve({ body: readFileSync(file), type: readFileSync(meta, 'utf8') });
  return new Promise((resolveP) => {
    execFile('curl', ['-sSL', '--max-time', '20', '-A', ua, '-o', file, '-w', '%{content_type}', u], { encoding: 'utf8' }, (err, stdout) => {
      if (err || !existsSync(file)) return resolveP(null);
      writeFileSync(meta, stdout || 'application/octet-stream');
      resolveP({ body: readFileSync(file), type: stdout || 'application/octet-stream' });
    });
  });
}

const RUNS = [
  { name: 'A', party: ['seungnyeo', 'manshin', 'posu'], seed: 101, viewport: { width: 390, height: 844 }, shots: 'phone' },
  { name: 'B', party: ['chasa', 'beopsa', 'talggun'], seed: 202, viewport: { width: 1280, height: 800 }, shots: 'desktop' },
  { name: 'C', party: ['jaebi', 'baksu', 'chasa'], seed: 303, viewport: { width: 390, height: 844 }, shots: null },
  { name: 'D', party: ['seungnyeo', 'jaebi', 'beopsa'], seed: 404, viewport: { width: 1280, height: 800 }, shots: null },
  // 손으로: 지도에서 걸어 첫 전투 → 카드 대상 고르기·턴 종료 → 새로고침 후 이어하기 → 용어·더미 창 → 자동 진행으로 끝까지
  { name: 'E', party: ['talggun', 'posu', 'seungnyeo'], seed: 505, viewport: { width: 390, height: 844 }, shots: null, manual: true },
];

const screenOf = (p) => p.evaluate(() => document.querySelector('.app')?.getAttribute('data-screen') ?? '');

async function manualPlay(p, errors) {
  // 1) 지도: 빛나는 칸을 따라 걷다가 기물·이벤트·덫 창이 뜨면 처리하고, 전투에 들어갈 때까지
  for (let i = 0; i < 60 && (await screenOf(p)) !== 'combat'; i++) {
    if (await p.$('[data-testid=dialog]')) {
      const cont = await p.$('[data-testid=dialog-continue]');
      if (cont) await cont.click();
      else await p.click('[data-testid=dialog] .opt:not([disabled])');
      continue;
    }
    if (await p.$('[data-testid=picker]')) {
      await p.click('[data-testid=picker-cancel]');
      continue;
    }
    if ((await screenOf(p)) === 'reward') {
      await p.click('[data-testid=reward-continue]');
      continue;
    }
    // 처음 밟는 칸·방을 먼저 (없으면 아무 칸)
    const fresh = await p.$$('[data-testid^=step-][data-new="1"]');
    const steps = fresh.length ? fresh : await p.$$('[data-testid^=step-]');
    if (!steps.length) throw new Error('manual: no reachable step');
    await steps[0].click();
    if (await p.$('[data-testid=confirm]')) await p.click('[data-testid=confirm] .btn:not(.primary)');
  }
  if ((await screenOf(p)) !== 'combat') throw new Error('manual: never reached a combat');
  // 2) 카드 한 장: 대상이 필요하면 적/아군을 누른다
  const turn0 = await p.textContent('.combat-top .chip');
  const hand = await p.$$('[data-testid^=hand-]:not(.dis)');
  if (hand.length) {
    await hand[0].click();
    for (let k = 0; k < 3; k++) {
      const playBtn = await p.$('[data-testid=play-card]');
      if (playBtn) { await playBtn.click(); break; }
      const tEnemy = await p.$('.enemy.targetable');
      if (tEnemy) { await tEnemy.click(); continue; }
      const tHero = await p.$('.hero.targetable');
      if (tHero) { await tHero.click(); continue; }
      break;
    }
  }
  await p.click('[data-testid=end-turn]');
  if ((await screenOf(p)) === 'combat') {
    const turn1 = await p.textContent('.combat-top .chip');
    if (turn1 === turn0) errors.push(`manual: turn did not advance (${turn0})`);
    // 3) 새로고침 → 이어하기 → 같은 전투
    await p.reload();
    await p.click('[data-testid=continue]');
    const after = await screenOf(p);
    if (after !== 'combat') errors.push(`manual: continue restored ${after}, expected combat`);
    else if ((await p.textContent('.combat-top .chip')) !== turn1) errors.push('manual: continue restored a different turn');
    // 4) 용어 도움말 · 더미 창
    await p.click('.combat-top >> text=용어');
    await p.waitForSelector('[data-testid=glossary]');
    await p.click('[data-testid=glossary] >> text=닫기');
    await p.click('[data-testid=pile-draw]');
    await p.waitForSelector('[data-testid=pile]');
    await p.click('[data-testid=pile] >> text=닫기');
    await p.click('[data-testid=toggle-log]');
    await p.waitForSelector('[data-testid=combat-log]');
  }
}

const browser = await chromium.launch();
const results = [];
let failed = false;

for (let k = 0; k < RUNS.length; k++) {
  if (only >= 0 && only !== k) continue;
  const run = RUNS[k];
  const t0 = Date.now();
  const ctx = await browser.newContext({ viewport: run.viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
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
  const shot = async (label) => {
    if (noShots || !run.shots) return;
    const size = `${run.viewport.width}x${run.viewport.height}`;
    await p.evaluate(() => document.fonts?.ready);
    // 알림이 사라진 뒤에 찍는다
    await p.waitForSelector('[data-testid=toast]', { state: 'detached', timeout: 4000 }).catch(() => {});
    await p.waitForTimeout(250);
    await p.screenshot({ path: join(shotsDir, `${label}-${size}.png`) });
  };
  // 자동 진행 중에는 화면이 빠르게 바뀌어 요소가 계속 다시 그려진다 → DOM click 을 바로 보낸다
  const jsClick = (sel) => p.evaluate((q) => {
    const el = document.querySelector(q);
    if (!el) return false;
    el.click();
    return true;
  }, sel);
  const noHScroll = async (label) => {
    const [sw, iw] = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    if (sw > iw + 1) errors.push(`horizontal page scroll on ${label}: ${sw} > ${iw}`);
  };
  try {
    await p.goto(url);
    await p.click('[data-testid=new-run]');
    await p.click('[data-testid=commission-boss]');
    await p.fill('[data-testid=seed]', String(run.seed));
    for (const h of run.party) await p.click(`[data-testid=hero-${h}]`);
    await p.click('[data-testid=buy-rec]');
    await noHScroll('shrine');
    if (run.shots) {
      // 폰: 진형·보급품(권장량), 데스크톱: 고른 파티 카드
      const anchor = run.viewport.width < 700 ? '[data-testid=formation]' : '.heroes-grid';
      await p.evaluate((q) => window.scrollTo(0, document.querySelector(q).getBoundingClientRect().top + window.scrollY - 120), anchor);
      await shot('shrine');
    }
    await p.click('[data-testid=start]');
    await p.waitForSelector('[data-testid=map-screen]');
    await noHScroll('map');
    await shot('map');
    if (run.manual) await manualPlay(p, errors);
    // 자동 진행 켬 → 스크린숏을 찍는 판은 '빠름', 나머지는 '즉시'
    const wantSpeed = run.shots && !noShots ? '빠름' : '즉시';
    await p.click('[data-testid=auto-toggle]');
    for (let i = 0; i < 3; i++) {
      const sp = (await p.textContent('[data-testid=auto-speed]'))?.trim();
      if (sp === wantSpeed) break;
      await p.click('[data-testid=auto-speed]');
    }
    const speed = (await p.textContent('[data-testid=auto-speed]'))?.trim();
    if (speed !== wantSpeed) throw new Error(`auto speed is ${speed}`);
    const seen = new Set(['map']);
    const shotDone = new Set();
    const want = run.shots && !noShots ? ['combat', 'reward', 'camp'] : [];
    const deadline = Date.now() + 12 * 60 * 1000;
    const readScreen = () => p.evaluate(() => document.querySelector('.app')?.getAttribute('data-screen') ?? '');
    let screen = 'map';
    while (Date.now() < deadline) {
      screen = await readScreen();
      if (screen === 'result') break;
      if (!seen.has(screen)) {
        seen.add(screen);
        await noHScroll(screen);
      }
      if (want.includes(screen) && !shotDone.has(screen)) {
        // 자동 진행을 잠깐 멈추고 찍는다
        await jsClick('[data-testid=auto-toggle]');
        await p.waitForTimeout(200);
        const s2 = await readScreen();
        // 보상은 카드 고르기가 남았을 때, 길굿은 여유를 쓰기 전에 찍는다
        const fresh = await p.evaluate((sc) => {
          if (sc === 'reward') return !!document.querySelector('[data-testid=reward-cards]');
          if (sc === 'camp') return document.querySelectorAll('.points i.on').length === 12;
          return true;
        }, s2);
        if (want.includes(s2) && !shotDone.has(s2) && fresh) {
          if (s2 === 'combat') {
            const card = await p.$('[data-testid=hand-0]');
            if (card) await card.click();
            await shot('combat');
            const cancel = await p.$('.target-hint >> text=취소');
            if (cancel) await cancel.click();
          } else await shot(s2);
          shotDone.add(s2);
        }
        if (s2 !== 'result') await jsClick('[data-testid=auto-toggle]');
      }
      await p.waitForTimeout(want.length && shotDone.size < want.length ? 40 : 150);
    }
    if (screen !== 'result') throw new Error(`timeout on screen ${screen}`);
    await noHScroll('result');
    await shot('result');
    const summary = await p.evaluate(() => {
      const banner = document.querySelector('.result-banner h1')?.textContent ?? '';
      const reason = document.querySelector('.result-banner .dim')?.textContent ?? '';
      const stats = [...document.querySelectorAll('.stat')].map((s) => `${s.querySelector('.k')?.textContent}: ${s.querySelector('.v')?.textContent}`);
      return { banner, reason, stats };
    });
    const sec = Math.round((Date.now() - t0) / 1000);
    results.push({ run: run.name, party: run.party.join('+'), seed: run.seed, viewport: `${run.viewport.width}x${run.viewport.height}`, outcome: summary.banner, reason: summary.reason, sec, stats: summary.stats, errors });
  } catch (e) {
    errors.push(`exception: ${e.message}`);
    await p.screenshot({ path: join(tmpdir(), `jeoseunggut-e2e-fail-${run.name}.png`) }).catch(() => {});
    results.push({ run: run.name, party: run.party.join('+'), seed: run.seed, viewport: `${run.viewport.width}x${run.viewport.height}`, outcome: 'ERROR', sec: Math.round((Date.now() - t0) / 1000), errors });
  }
  if (errors.length) failed = true;
  await ctx.close();
  const r = results[results.length - 1];
  console.log(`[${r.run}] ${r.party} seed ${r.seed} ${r.viewport} → ${r.outcome} (${r.reason ?? ''}) ${r.sec}s${r.errors.length ? `\n   errors:\n   ${r.errors.slice(0, 8).join('\n   ')}` : ''}`);
  if (r.stats) console.log(`    ${r.stats.join(' · ')}`);
}

await browser.close();
server.close();
if (failed) {
  console.error('e2e: FAILED');
  process.exit(1);
}
console.log(`e2e: ${results.length} runs OK, no console errors`);
