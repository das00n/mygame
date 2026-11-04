// 헤드리스 자동 진행 (개발용): 화면 없이 원정 로직 + 자동 진행 봇을 여러 번 돌려 흐름·균형을 점검한다.
// 실행: node --import tsx web/scripts/headless.ts [--runs 20] [--commission boss] [--verbose]
import { HERO_IDS, type HeroId } from '../../src/core/types.ts';
import { beginExpedition, blankApp } from '../src/game/actions.ts';
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
