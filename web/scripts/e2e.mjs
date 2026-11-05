// web:e2e — 만든 단일 HTML(web/dist/artifact.html)을 호스트처럼 감싸 띄우고, 보스 길 원정을 처음부터 결과 화면까지 자동 진행으로 끝까지 돌린다.
// 캠페인 판(F·G, 반복 2): 새 캠페인 → 영입 → 시설 건축 → 자동 원정 3회 이상 → 사망과 천도굿 → 지역 2 개방 → 내보내기 → 결말 코드 가져오기.
// 대문 방 판(H, 반복 3): 지역 3 코드 가져오기 → 지역 3 보통 길 → 대문 방에서 손으로 통행 → 자동 진행으로 마을까지.
// 파티·시드를 바꿔 여러 번. 콘솔 오류가 없어야 하고, 어느 화면에서도 가로 스크롤이 없어야 한다.
// PC 전용(결정 D8-2): 1280×800(최소) · 1920×1080(큰 화면). 러프 그래픽(안 A) 장면이 화면마다 있는지도 본다. 끝에 900×700 에서 PC 안내·줄이기를 본다.
// 스크린숏(deviceScaleFactor 1)을 docs/design/screens/ 에 저장한다 (1280×800, 1920×1080).
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

const PC = { width: 1280, height: 800 };
const LARGE = { width: 1920, height: 1080 };
const RUNS = [
  { name: 'A', party: ['seungnyeo', 'manshin', 'posu'], seed: 101, viewport: PC, shots: true },
  { name: 'B', party: ['chasa', 'beopsa', 'talggun'], seed: 202, viewport: LARGE, shots: true },
  // C 는 움직임을 켠 채(연출 CSS · 상태 비교 코드가 오류 없이 도는지)
  { name: 'C', party: ['jaebi', 'baksu', 'chasa'], seed: 303, viewport: PC, shots: false, motion: true },
  { name: 'D', party: ['seungnyeo', 'jaebi', 'beopsa'], seed: 404, viewport: LARGE, shots: false },
  // 손으로: 지도에서 걸어 첫 전투 → 카드 대상 고르기·턴 종료 → 새로고침 후 이어하기 → 용어·더미 창 → 자동 진행으로 끝까지
  { name: 'E', party: ['talggun', 'posu', 'seungnyeo'], seed: 505, viewport: PC, shots: false, manual: true },
];

const CAMPAIGN_RUNS = [
  { name: 'F', seed: 2, viewport: PC, shots: true },
  { name: 'G', seed: 14, viewport: LARGE, shots: true },
];

// 러프 그래픽: 화면마다 있어야 하는 장면
const SCENE_OF = { map: '[data-testid=corridor-scene]', combat: '[data-testid=stage]', camp: '[data-testid=camp-scene]', result: '[data-testid=procession]' };
async function sceneCheck(p, screen, errors) {
  const sel = SCENE_OF[screen];
  if (!sel) return;
  // 자동 진행(즉시)은 화면이 바로 바뀐다 → 같은 화면일 때만 한 번에 본다
  const bad = await p.evaluate(([q, sc]) => {
    if (document.querySelector('.app')?.getAttribute('data-screen') !== sc) return null;
    if (!document.querySelector(q)) return `no scene ${q} on ${sc}`;
    if (sc === 'combat') {
      const cards = document.querySelectorAll('[data-testid=hand] .card');
      const arts = document.querySelectorAll('[data-testid=hand] .card .card-art[data-card-id]');
      if (cards.length !== arts.length) return 'combat: a hand card has no .card-art window';
    }
    return null;
  }, [sel, screen]);
  if (bad) errors.push(bad);
}

// 결말 화면: 헤드리스로 끝까지 돈 캠페인의 코드(시드 1, 좋은 결말)를 가져온다
const ENDING_CODE = execSync('node --import tsx web/scripts/headless.ts --campaign --runs 1 --seed 1 --max 60 --code', { cwd: root }).toString().split('\n').find((l) => l.startsWith('JSG1:'));
if (!ENDING_CODE) throw new Error('ending code not generated');
// 대문 방 판(H, 반복 3): 신당 3단계(지역 3)까지 헤드리스로 돈 캠페인 코드
const R3_CODE = execSync('node --import tsx web/scripts/headless.ts --campaign --runs 1 --seed 3 --max 60 --until-sindang 3 --code', { cwd: root }).toString().split('\n').find((l) => l.startsWith('JSG1:'));
if (!R3_CODE) throw new Error('region 3 code not generated');

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
  const ctx = await browser.newContext({ viewport: run.viewport, deviceScaleFactor: 1, reducedMotion: run.motion ? 'no-preference' : 'reduce' });
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
      // 고른 파티 카드(상반신)
      await p.evaluate((q) => window.scrollTo(0, document.querySelector(q).getBoundingClientRect().top + window.scrollY - 120), '.heroes-grid');
      await shot('shrine');
    }
    await p.click('[data-testid=start]');
    await p.waitForSelector('[data-testid=map-screen]');
    await noHScroll('map');
    await sceneCheck(p, 'map', errors);
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
        await sceneCheck(p, screen, errors);
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
          if (s2 === 'camp') {
            // 길굿 강화(v0.3): 고르기 창에 강화판(금박·「강」 인장)이 보이는지 확인하고 그만둔다
            const btn = await p.$('[data-testid=camp-upgrade]:not([disabled])');
            if (!btn) throw new Error('camp: 카드 강화가 열려 있지 않다');
            await btn.click();
            await p.waitForSelector('[data-testid=picker] .card.upgraded');
            const n = await p.evaluate(() => document.querySelectorAll('[data-testid=picker] .card.upgraded .upseal').length);
            if (!n) throw new Error('camp: 강화판 미리 보기가 없다');
            await noHScroll('camp-upgrade');
            await shot('camp-upgrade');
            await p.click('[data-testid=picker-cancel]');
            const pts = await p.evaluate(() => document.querySelectorAll('.points i.on').length);
            if (pts !== 12) throw new Error(`camp: 그만두었는데 여유가 ${pts}`);
          }
          shotDone.add(s2);
        }
        if (s2 !== 'result') await jsClick('[data-testid=auto-toggle]');
      }
      await p.waitForTimeout(want.length && shotDone.size < want.length ? 40 : 150);
    }
    if (screen !== 'result') throw new Error(`timeout on screen ${screen}`);
    await noHScroll('result');
    await sceneCheck(p, 'result', errors);
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

// ── 캠페인 판 ─────────────────────────────────────────────────────────
for (const run of CAMPAIGN_RUNS) {
  if (only >= 0 && only !== RUNS.length + CAMPAIGN_RUNS.indexOf(run)) continue;
  const t0 = Date.now();
  const ctx = await browser.newContext({ viewport: run.viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const errors = [];
  const notes = [];
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
  const size = `${run.viewport.width}x${run.viewport.height}`;
  const shot = async (label) => {
    if (noShots) return;
    await p.evaluate(() => document.fonts?.ready);
    await p.waitForSelector('[data-testid=toast]', { state: 'detached', timeout: 4000 }).catch(() => {});
    await p.waitForTimeout(250);
    await p.screenshot({ path: join(shotsDir, `${label}-${size}.png`) });
  };
  const noHScroll = async (label) => {
    const [sw, iw] = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    if (sw > iw + 1) errors.push(`horizontal page scroll on ${label}: ${sw} > ${iw}`);
  };
  const state = () => p.evaluate(() => {
    const a = globalThis.__JSG_APP;
    const c = a?.campaign;
    return c ? {
      auto: !!globalThis.__JSG_SETTINGS?.auto, screen: a.screen, exp: c.expeditions, roster: c.roster.length, fallen: c.fallen.length, honored: c.fallen.filter((f) => f.honored).length,
      sindang: c.facilities.sindang, gaekju: c.facilities.gaekju, built: Object.entries(c.facilities).filter(([k, v]) => v > 0 && !['sindang', 'gaekju', 'jumak', 'sadang', 'jangteo'].includes(k)).length,
      region2: c.commissions.some((x) => x.region === 2), ending: c.ending?.kind ?? null,
    } : { screen: a?.screen ?? '', exp: -1 };
  });
  const jsClick = (sel) => p.evaluate((q) => {
    const el = document.querySelector(q);
    if (!el) return false;
    el.click();
    return true;
  }, sel);
  try {
    await p.goto(url);
    await p.evaluate(() => {
      window.__seen = [];
      const note = () => {
        const sc = document.querySelector('.app')?.getAttribute('data-screen');
        if (sc && !window.__seen.includes(sc)) window.__seen.push(sc);
      };
      new MutationObserver(note).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-screen'], childList: true });
      // 원정 3회 이상 · 천도굿을 받은 조상신 · 신당 2단계(지역 2)가 되면 마을에서 자동 진행을 멈춘다
      window.__JSG_STOP = (a) => a.campaign.expeditions >= 3 && a.campaign.fallen.some((f) => f.honored) && a.campaign.facilities.sindang >= 2;
    });
    await p.click('[data-testid=new-campaign]');
    await p.fill('[data-testid=campaign-seed]', String(run.seed));
    await p.click('[data-testid=start-campaign]');
    await p.waitForSelector('[data-testid=village]');
    await noHScroll('village');
    if (!(await p.$('[data-testid=scene] .stage-svg'))) errors.push('village: no panorama');
    // 영입 (첫 절기는 설: 무료)
    await p.click('[data-testid=tab-gaekju]');
    await noHScroll('gaekju');
    await p.click('[data-testid=recruit-0]');
    let st = await state();
    if (st.roster !== 5) errors.push(`recruit: roster ${st.roster}, expected 5`);
    // 시설 건축 (객주 2단계)
    await p.click('[data-testid=tab-maeul]');
    await p.click('[data-testid=build-gaekju]');
    st = await state();
    if (st.gaekju !== 2) errors.push(`build: gaekju tier ${st.gaekju}, expected 2`);
    await shot('village');
    // 자동 진행: 원정 3회 이상 · 사망과 천도굿 · 지역 2 개방까지
    await p.click('[data-testid=auto-toggle]');
    for (let i = 0; i < 3; i++) {
      const sp = (await p.textContent('[data-testid=auto-speed]'))?.trim();
      if (sp === '즉시') break;
      await p.click('[data-testid=auto-speed]');
    }
    const seen = new Set();
    const deadline = Date.now() + 10 * 60 * 1000;
    let deathSeen = false;
    while (Date.now() < deadline) {
      st = await state();
      if (st.screen && !seen.has(st.screen)) {
        seen.add(st.screen);
        await noHScroll(st.screen);
      }
      if (st.fallen > 0) deathSeen = true;
      if (!st.auto && st.screen === 'village') break;
      if (st.ending) break;
      await p.waitForTimeout(120);
    }
    void jsClick;
    await p.waitForTimeout(200);
    st = await state();
    for (const sc of await p.evaluate(() => window.__seen)) seen.add(sc);
    notes.push(`expeditions ${st.exp} · deaths ${st.fallen} · ancestors ${st.honored} · sindang ${st.sindang} · screens ${[...seen].join('/')}`);
    if (st.exp < 3) errors.push(`only ${st.exp} expeditions`);
    if (!deathSeen || st.honored < 1) errors.push(`no death handled with 천도굿 (deaths ${st.fallen}, ancestors ${st.honored})`);
    if (st.sindang < 2 || !st.region2) errors.push(`region 2 not unlocked (sindang ${st.sindang}, region2 commission ${st.region2})`);
    for (const sc of ['combat', 'result', 'settle', 'village']) if (!seen.has(sc)) errors.push(`never saw screen ${sc}`);
    // 화면: 마을 · 의뢰판(지역 2) · 로스터 · 사당
    await p.click('[data-testid=tab-maeul]');
    await shot('village-r2');
    await p.click('[data-testid=tab-board]');
    if (!(await p.$('[data-testid^=commission-][data-testid$="-2"]'))) errors.push('board: no region 2 commission');
    await noHScroll('board');
    await p.click('[data-testid=tab-roster]');
    await p.waitForSelector('[data-testid=sheet]');
    await noHScroll('roster');
    await shot('roster');
    await p.click('[data-testid=tab-sadang]');
    await p.waitForSelector('[data-testid=ancestor]');
    if (!(await p.$('[data-testid=sadang-scene]'))) errors.push('sadang: no tablets scene');
    await noHScroll('sadang');
    await shot('sadang');
    // 내보내기 → 코드
    await p.click('[data-testid=export]');
    const code = await p.inputValue('[data-testid=export-code]');
    if (!code.startsWith('JSG1:')) errors.push('export: no code');
    await p.click('[data-testid=copy-code]');
    await p.keyboard.press('Escape').catch(() => {});
    await p.click('[data-testid=export-view] >> text=닫기');
    // 결말: 다른 캠페인 코드를 가져온다
    await p.click('.topbar >> text=표지');
    await p.click('[data-testid=import]');
    await p.fill('[data-testid=import-code]', ENDING_CODE);
    await p.click('[data-testid=import-go]');
    await p.waitForSelector('[data-testid=ending]');
    await noHScroll('ending');
    await shot('ending');
    // 가져오기: 방금 내보낸 마을 코드로 되돌아간다
    await p.click('[data-testid=ending-title]');
    await p.click('[data-testid=import]');
    await p.fill('[data-testid=import-code]', code);
    await p.click('[data-testid=import-go]');
    await p.waitForSelector('[data-testid=village]');
    const back = await state();
    if (back.exp !== st.exp) errors.push(`import: expeditions ${back.exp}, expected ${st.exp}`);
    results.push({ run: run.name, party: `campaign seed ${run.seed}`, seed: run.seed, viewport: size, outcome: 'campaign', reason: notes.join(' '), sec: Math.round((Date.now() - t0) / 1000), errors });
  } catch (e) {
    errors.push(`exception: ${e.message}`);
    await p.screenshot({ path: join(tmpdir(), `jeoseunggut-e2e-fail-${run.name}.png`) }).catch(() => {});
    results.push({ run: run.name, party: `campaign seed ${run.seed}`, seed: run.seed, viewport: size, outcome: 'ERROR', reason: notes.join(' '), sec: Math.round((Date.now() - t0) / 1000), errors });
  }
  if (errors.length) failed = true;
  await ctx.close();
  const r = results[results.length - 1];
  console.log(`[${r.run}] ${r.party} ${r.viewport} → ${r.outcome} (${r.reason}) ${r.sec}s${r.errors.length ? `\n   errors:\n   ${r.errors.slice(0, 8).join('\n   ')}` : ''}`);
}

// ── 대문 방 통행 판 (H, 반복 3): 지역 3 보통 길 → 지도에 대문 방 → 첫 대문에서 손으로 「인정을 쓴다」 → 자동 진행으로 마을까지 ──
if (only < 0 || only === RUNS.length + CAMPAIGN_RUNS.length) {
  const t0 = Date.now();
  const viewport = PC;
  const size = `${viewport.width}x${viewport.height}`;
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const errors = [];
  const notes = [];
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
  const noHScroll = async (label) => {
    const [sw, iw] = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    if (sw > iw + 1) errors.push(`horizontal page scroll on ${label}: ${sw} > ${iw}`);
  };
  const runState = () => p.evaluate(() => {
    const a = globalThis.__JSG_APP;
    const r = a?.run;
    return {
      screen: a?.screen ?? '', auto: !!globalThis.__JSG_SETTINGS?.auto, dialog: a?.dialog?.id ?? null, gates: r?.flags?.gates ?? 0, jijeon: r?.supplies?.jijeon ?? -1,
      free: r?.flags?.gateFree ?? 0, region: r?.region ?? 0, gateRooms: r ? r.dungeon.rooms.filter((x) => x.gate).length : 0, exp: a?.campaign?.expeditions ?? -1,
    };
  });
  try {
    await p.goto(url);
    await p.click('[data-testid=import]');
    await p.fill('[data-testid=import-code]', R3_CODE);
    await p.click('[data-testid=import-go]');
    await p.waitForSelector('[data-testid=village]');
    const exp0 = (await runState()).exp;
    await p.click('[data-testid=tab-board]');
    await p.click('[data-testid=commission-normal-3]');
    // 서로 다른 원형 셋 (쉬는 사람 제외)
    const uids = await p.evaluate(() => {
      const c = globalThis.__JSG_APP.campaign;
      const out = [];
      for (const x of c.roster) if (!x.busy && !out.some((y) => y.arch === x.arch) && out.length < 3) out.push(x);
      return out.map((x) => x.uid);
    });
    for (const u of uids) await p.click(`[data-testid=pick-${u}]`);
    await p.click('[data-testid=buy-rec]');
    await p.click('[data-testid=depart]');
    await p.waitForSelector('[data-testid=map-screen]');
    let st = await runState();
    if (st.region !== 3) errors.push(`region ${st.region}, expected 3`);
    const glyphs = await p.$$('[data-testid^=gate-r]');
    if (st.gateRooms < 2 || glyphs.length !== st.gateRooms) errors.push(`gate rooms ${st.gateRooms}, glyphs ${glyphs.length}`);
    await noHScroll('map-r3');
    // 첫 대문 창이 열리면 자동 진행이 멈춘다
    await p.evaluate(() => { globalThis.__JSG_STOP_DIALOG = (a) => a.dialog?.id === 'daemun_tonghaeng' && a.dialog.result === null; });
    await p.click('[data-testid=auto-toggle]');
    for (let i = 0; i < 3; i++) {
      const sp = (await p.textContent('[data-testid=auto-speed]'))?.trim();
      if (sp === '즉시') break;
      await p.click('[data-testid=auto-speed]');
    }
    const deadline = Date.now() + 4 * 60 * 1000;
    while (Date.now() < deadline) {
      st = await runState();
      if (!st.auto && st.dialog === 'daemun_tonghaeng') break;
      if (st.screen === 'result' || st.screen === 'settle' || st.screen === 'village') break;
      await p.waitForTimeout(100);
    }
    if (st.dialog !== 'daemun_tonghaeng') errors.push(`gate dialog never opened (screen ${st.screen})`);
    else {
      await p.waitForSelector('[data-testid=dialog]');
      await noHScroll('gate');
      if (!noShots) {
        await p.evaluate(() => document.fonts?.ready);
        await p.waitForTimeout(250);
        await p.screenshot({ path: join(shotsDir, `gate-${size}.png`) });
      }
      const before = await runState();
      const pay = await p.$('[data-testid=opt-c0]:not([disabled])');
      if (pay) await pay.click();
      else await p.click('[data-testid=opt-c1]');
      await p.click('[data-testid=dialog-continue]');
      const after = await runState();
      if (after.gates !== before.gates + 1) errors.push(`gates ${before.gates} → ${after.gates}`);
      if (pay && !before.free && after.jijeon > before.jijeon) errors.push(`jijeon ${before.jijeon} → ${after.jijeon}`);
      notes.push(`gate passed by ${pay ? '인정(지전)' : '문답'} · jijeon ${before.jijeon}→${after.jijeon} · gate rooms ${after.gateRooms}`);
      if (!(await p.$('[data-testid^=gate-r][data-done="1"]'))) errors.push('passed gate glyph not marked');
    }
    // 끝까지: 나머지 대문은 자동 진행이 고르고, 마을로 돌아오면 멈춘다
    await p.evaluate(() => { globalThis.__JSG_STOP_DIALOG = undefined; globalThis.__JSG_STOP = () => true; });
    if (!(await runState()).auto) await p.click('[data-testid=auto-toggle]');
    const deadline2 = Date.now() + 6 * 60 * 1000;
    while (Date.now() < deadline2) {
      st = await runState();
      if (st.screen === 'village' && st.exp > exp0) break;
      await p.waitForTimeout(150);
    }
    if (st.exp <= exp0) errors.push(`expedition did not return (screen ${st.screen})`);
    notes.push(`back in village after expedition ${st.exp}`);
    results.push({ run: 'H', party: 'campaign region 3 gate', seed: 3, viewport: size, outcome: 'gate', reason: notes.join(' · '), sec: Math.round((Date.now() - t0) / 1000), errors });
  } catch (e) {
    errors.push(`exception: ${e.message}`);
    await p.screenshot({ path: join(tmpdir(), 'jeoseunggut-e2e-fail-H.png') }).catch(() => {});
    results.push({ run: 'H', party: 'campaign region 3 gate', seed: 3, viewport: size, outcome: 'ERROR', reason: notes.join(' · '), sec: Math.round((Date.now() - t0) / 1000), errors });
  }
  if (errors.length) failed = true;
  await ctx.close();
  const r = results[results.length - 1];
  console.log(`[${r.run}] ${r.party} ${r.viewport} → ${r.outcome} (${r.reason}) ${r.sec}s${r.errors.length ? `\n   errors:\n   ${r.errors.slice(0, 8).join('\n   ')}` : ''}`);
}

// ── 좁은 화면 (PC 안내): 900×700 에서 안내가 뜨고, 줄여서 보여 주며, 가로 스크롤이 없어야 한다 ──
if (only < 0) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await p.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.fulfill({ status: 200, contentType: route.request().url().includes('/css') ? 'text/css' : 'font/woff2', body: '' }));
  const noH = async (label) => {
    const [sw, iw] = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    if (sw > iw + 1) errors.push(`horizontal page scroll on ${label}: ${sw} > ${iw}`);
  };
  try {
    await p.goto(url);
    if (!(await p.$('[data-testid=pc-notice]'))) errors.push('narrow: no PC notice');
    await noH('narrow-title');
    await p.click('[data-testid=new-run]');
    for (const h of ['seungnyeo', 'manshin', 'posu']) await p.click(`[data-testid=hero-${h}]`);
    await p.click('[data-testid=start]');
    await p.waitForSelector('[data-testid=map-screen]');
    await noH('narrow-map');
    await p.click('[data-testid=pc-notice] .btn');
    await noH('narrow-map-unscaled');
  } catch (e) {
    errors.push(`exception: ${e.message}`);
  }
  results.push({ run: 'N', party: 'narrow 900x700', seed: 0, viewport: '900x700', outcome: 'notice', reason: '', sec: 0, errors });
  if (errors.length) failed = true;
  console.log(`[N] narrow 900x700 → PC notice${errors.length ? `\n   errors:\n   ${errors.join('\n   ')}` : ' OK'}`);
  await ctx.close();
}

await browser.close();
server.close();
if (failed) {
  console.error('e2e: FAILED');
  process.exit(1);
}
console.log(`e2e: ${results.length} runs OK, no console errors`);
