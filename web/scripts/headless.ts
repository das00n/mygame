// 헤드리스 자동 진행 (개발용): 화면 없이 원정 로직 + 자동 진행 봇을 여러 번 돌려 흐름·균형을 점검한다.
// 실행: node --import tsx web/scripts/headless.ts [--runs 20] [--commission boss] [--verbose]
import { HERO_IDS, type HeroId } from '../../src/core/types.ts';
import { beginExpedition, blankApp } from '../src/game/actions.ts';
import { exportCode, startCampaign } from '../src/game/campaign.ts';
import { recruit } from '../../src/meta/campaign.ts';
import { autoStep } from '../src/game/autoplay.ts';
import { COMMISSION_BY_ID, SUPPLIES, recommended, type CommissionId } from '../src/game/content.ts';
import { bossFor } from '../src/game/run.ts';
import { defaultFormation } from '../../src/core/engine.ts';
import { D } from '../src/game/content.ts';
import type { HeroState } from '../../src/core/types.ts';

const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const runs = Number(arg('runs', '20'));
const commission = arg('commission', 'boss') as CommissionId;
const verbose = process.argv.includes('--verbose');

// --campaign: 캠페인 모드를 자동 진행으로 (마을 봇 + 원정 자동 진행). 결말·사망·지역 개방까지 걸린 원정 수
if (process.argv.includes('--campaign')) {
  const maxExp = Number(arg('max', '40'));
  const seed0 = Number(arg('seed', '1'));
  for (let k = 0; k < runs; k++) {
    const app = blankApp();
    startCampaign(app, seed0 + k);
    if (process.argv.includes('--recruit0')) recruit(app.campaign!, 0, null);
    let n = 0;
    let firstDeath = -1;
    let firstCheondo = -1;
    let r2 = -1;
    let firstBuild = -1;
    const t0 = Date.now();
    while (!app.campaign!.ending && app.campaign!.expeditions < maxExp && n < 400000) {
      const c = app.campaign!;
      if (firstDeath < 0 && c.fallen.length) firstDeath = c.expeditions;
      if (firstCheondo < 0 && c.fallen.some((f) => f.honored)) firstCheondo = c.expeditions;
      if (r2 < 0 && c.facilities.sindang >= 2) r2 = c.expeditions;
      if (firstBuild < 0 && (c.facilities.mugubang > 0 || c.facilities.yakbang > 0 || c.facilities.gaekju > 1 || c.facilities.sindang > 1)) firstBuild = c.expeditions;
      if (!autoStep(app)) {
        if (app.screen === 'village') {
          console.log(`  campaign ${seed0 + k}: village stuck at exp ${c.expeditions}`);
          break;
        }
        console.log(`  stuck on ${app.screen}`, app.dialog, app.picker);
        break;
      }
      n++;
    }
    const c = app.campaign!;
    if (process.argv.includes('--code')) console.log(exportCode(c));
    console.log(`campaign seed ${seed0 + k}: ending ${c.ending?.kind ?? '-'} exp ${c.expeditions} season ${c.season} deaths ${c.fallen.length} ancestors ${c.fallen.filter((f) => f.honored).length} firstDeath@${firstDeath} cheondo@${firstCheondo} build@${firstBuild} region2@${r2} sindang ${c.facilities.sindang} steps ${n} ${(Date.now() - t0) / 1000}s`);
  }
  process.exit(0);
}

function trio(i: number): HeroId[] {
  const all: HeroId[][] = [];
  for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) for (let c = b + 1; c < 8; c++) all.push([HERO_IDS[a], HERO_IDS[b], HERO_IDS[c]]);
  return all[(i * 17) % all.length];
}

let wins = 0;
const where: Record<string, number> = {};
let fights = 0;
let haewon = 0;
let elig = 0;
let deaths = 0;
let steps = 0;
let rooms = 0;
for (let k = 0; k < runs; k++) {
  const party = trio(k);
  const seed = 1000 + k * 7919;
  const boss = commission === 'boss' ? bossFor(seed) : null;
  const rec = recommended(commission, boss);
  const c = COMMISSION_BY_ID.get(commission)!;
  const spent = SUPPLIES.reduce((a, s) => a + rec[s.id] * s.price, 0);
  const d = D();
  const hs = party.map((h, idx) => ({ id: h, idx, melee: d.heroes.get(h)!.range === 'melee', maxHp: d.heroes.get(h)!.hp, dead: false }) as unknown as HeroState);
  const app = blankApp();
  beginExpedition(app, { seed, commission, party, formation: defaultFormation(hs), supplies: rec, gold: c.purse - spent, spent });
  let n = 0;
  let lastScreen = '';
  while (app.screen !== 'result' && n < 20000) {
    if (verbose && app.screen !== lastScreen) {
      lastScreen = app.screen;
      if (app.screen === 'combat') console.log(`  fight ${app.combat!.meta.enc} (${app.combat!.meta.tier}) light ${app.run!.light} hp ${app.run!.heroes.map((h) => h.hp).join('/')}`);
    }
    if (!autoStep(app)) break;
    n++;
  }
  steps += n;
  const r = app.result;
  if (!r) {
    console.log(`run ${k} stuck on ${app.screen} after ${n} steps`, app.dialog, app.picker);
    continue;
  }
  if (r.success) wins++;
  else {
    const dg = app.run!.dungeon;
    const atBoss = dg.boss >= 0 && app.run!.pos.kind === 'room' && app.run!.pos.room === dg.boss;
    const key = `${r.reason}${atBoss ? ' (보스)' : ' (보스 전)'}`;
    where[key] = (where[key] ?? 0) + 1;
  }
  fights += r.stats.fights;
  haewon += r.stats.haewons;
  elig += r.stats.haewonEligible;
  deaths += r.stats.deaths;
  rooms += r.roomsVisited / r.roomsTotal;
  const last = app.run!.log.slice(-1)[0];
  console.log(`${k} ${party.join('+')} seed ${seed} boss ${boss ?? '-'} → ${r.success ? 'OK ' : 'FAIL'} fights ${r.stats.wins}/${r.stats.fights} haewon ${r.stats.haewons}/${r.stats.haewonEligible} deaths ${r.stats.deaths} rooms ${r.roomsVisited}/${r.roomsTotal} light ${r.light} steps ${n} | ${last}`);
}
console.log(`\nclear ${wins}/${runs} · fights/run ${(fights / runs).toFixed(1)} · haewon ${(haewon / Math.max(1, elig) * 100).toFixed(0)}% · deaths/run ${(deaths / runs).toFixed(2)} · rooms ${(rooms / runs * 100).toFixed(0)}% · steps/run ${(steps / runs).toFixed(0)}`);
console.log(where);
