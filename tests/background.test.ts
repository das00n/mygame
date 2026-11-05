// ⟨반복 4⟩ 배경 보강의 작은 메커닉 (docs/research/lore/singwa-sources.md §5 → docs/09-iteration.md §6):
// 막방광침(해원한 넋이 아끼던 물건) · 차사 대접 → 「획 하나」 · 신구간 시설 할인 · 데이터 문장.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCombat, D, hitHero } from '../src/core/engine.ts';
import { buildOptions, newCampaign, planExpedition, settle } from '../src/meta/campaign.ts';
import { CD } from '../src/meta/content.ts';
import type { ExpeditionPlan, ExpeditionReport } from '../src/meta/types.ts';
import { blankApp } from '../web/src/game/actions.ts';
import { campActions, doCampAction, startCamp } from '../web/src/game/camp.ts';
import { relicMods } from '../web/src/game/combat.ts';
import { REGION_JSON } from '../web/src/game/content.ts';
import { chooseKeepsake, keepsakeFor, KEEPSAKE_BURN_STRESS, makeReward } from '../web/src/game/rewards.ts';
import { newRun } from '../web/src/game/run.ts';
import type { AppState } from '../web/src/game/types.ts';

const SUP = { candle: 6, rice: 6, incense: 2, jijeon: 3, bujeok: 1, sul: 2 };

function app1(): AppState {
  const app = blankApp();
  app.run = newRun({ seed: 3, commission: 'boss', party: ['posu', 'manshin', 'chasa'], formation: [2, 1, 0], supplies: { ...SUP }, gold: 0, spent: 0 });
  app.screen = 'map';
  return app;
}

test('데이터: 엘리트·보스·최종은 모두 막방광침 물건(이름·사연)을 가진다, 졸개·일반은 없다', () => {
  for (const n of [1, 2, 3]) {
    for (const e of REGION_JSON[n].enemies as unknown as { id: string; category: string; keepsake?: { name: string; text: string } }[]) {
      const big = e.category === 'elite' || e.category === 'boss' || e.category === 'final';
      assert.equal(!!e.keepsake, big, `${e.id} (${e.category})`);
      if (e.keepsake) assert.ok(e.keepsake.name.length >= 2 && e.keepsake.text.length >= 10, e.id);
    }
  }
});

test('막방광침: 해원한 원귀 중 보스·엘리트의 물건 → 태우면 귀기 회복, 남기면 원정 기록(캠페인은 사당 골동)', () => {
  const d = D();
  const s = createCombat({ party: [{ id: 'posu' }, { id: 'manshin' }, { id: 'chasa' }], deck: [], encounter: d.encounterById.get('x1')!, seed: 1, record: false });
  assert.equal(keepsakeFor(s), null, '해원하지 않으면 없다');
  s.enemies[0].haewon = true;
  const k = keepsakeFor(s)!;
  assert.equal(k.enemy, d.enemies[s.enemies[0].def].id);
  assert.equal(k.choice, null);
  // 태워 보낸다
  const a = app1();
  a.run!.heroes.forEach((h) => (h.stress = 30));
  a.reward = makeReward(a, { tier: 'elite', cardReward: false } as never, 0, 0, []);
  a.reward.keepsake = { ...k };
  chooseKeepsake(a, 'burn');
  assert.deepEqual(a.run!.heroes.map((h) => h.stress), [30 - KEEPSAKE_BURN_STRESS, 30 - KEEPSAKE_BURN_STRESS, 30 - KEEPSAKE_BURN_STRESS]);
  assert.equal(a.run!.track.burned, 1);
  assert.deepEqual(a.run!.track.keepsakes, []);
  chooseKeepsake(a, 'keep');
  assert.deepEqual(a.run!.track.keepsakes, [], '한 번 고르면 끝');
  // 남긴다
  const b = app1();
  b.reward = makeReward(b, { tier: 'elite', cardReward: false } as never, 0, 0, []);
  b.reward.keepsake = { ...k };
  chooseKeepsake(b, 'keep');
  assert.deepEqual(b.run!.track.keepsakes, [k.enemy]);
  assert.equal(b.run!.heroes[0].stress, 0);
});

test('막방광침 → 캠페인 결산: 남긴 물건이 사당 골동(c.keepsakes)으로 들어간다', () => {
  const c = newCampaign(5);
  const trio: string[] = [];
  for (const p of c.roster) if (!c.roster.filter((x) => trio.includes(x.uid)).some((x) => x.arch === p.arch) && trio.length < 3) trio.push(p.uid);
  const plan = planExpedition(c, c.commissions[0].id, trio, {}) as ExpeditionPlan;
  const rep: ExpeditionReport = {
    success: true, retreated: false, wiped: false, bossWon: false, bossHaewon: false,
    heroes: plan.heroes.map(() => ({ hp: 20, maxHp: 40, dead: false, injured: false, stress: 10, plays: {} })),
    revived: [], haewons: 1, haewonById: { mongdal: 1 }, haewonByFamily: {}, killByFamily: {}, gold: 0, chiseong: 0, cheondo: [], bondsGained: {},
    met: ['mongdal'], leftover: {}, sonnim: null, keepsakes: ['mongdal'],
  };
  settle(c, plan, rep);
  assert.equal(c.keepsakes?.length, 1);
  assert.equal(c.keepsakes![0].enemy, 'mongdal');
});

test('차사 대접(길굿, 쌀 1 · 지전 1) → 「획 하나」: 원정마다 한 번, 사망 판정을 넘긴다', () => {
  const a = app1();
  const run = a.run!;
  const camp = run.dungeon.rooms.findIndex((r) => r.camp);
  startCamp(a, camp >= 0 ? camp : 0);
  const act = () => campActions(run, a.camp!).find((x) => x.id === 'chasa_daejeop')!;
  assert.ok(act().enabled);
  doCampAction(a, 'chasa_daejeop');
  assert.equal(run.flags.hoek, 'ready');
  assert.equal(run.supplies.rice, SUP.rice - 1);
  assert.equal(run.supplies.jijeon, SUP.jijeon - 1);
  assert.equal(act().enabled, false, '한 원정에 한 번');
  assert.equal(relicMods(run).hoek, true);
  // 엔진: 쓰러진 영웅이 맞아도 첫 사망 판정은 넘긴다
  const d = D();
  const s = createCombat({ party: [{ id: 'posu' }, { id: 'manshin' }, { id: 'chasa' }], deck: [], encounter: d.encounterById.get('x1')!, seed: 2, record: false, mods: relicMods(run) });
  const h = s.heroes[0];
  h.hp = 0;
  h.downed = true;
  h.downTurn = -5;
  for (let k = 0; k < 1; k++) hitHero(s, 0, 5, 0);
  assert.equal(h.dead, false);
  assert.equal(s.hoekUsed, true);
  assert.equal(h.survived, 0, '판정 자체를 넘긴다(버틴 횟수로 세지 않는다)');
  // 다음 판정은 보통대로 — 결국 죽거나 버틴다
  for (let k = 0; k < 30 && !h.dead; k++) hitHero(s, 0, 5, 0);
  assert.equal(h.dead, true);
});

test('신구간(대한 절기): 시설 짓기·단계 올리기 엽전 반값, 치성은 그대로', () => {
  const c = newCampaign(7);
  c.gold = 1000;
  c.chiseong = 20;
  c.lots.push('r1boss', 'r2boss');
  const normal = buildOptions(c);
  const dahan = CD.calendar.seasons.indexOf('대한');
  assert.ok(CD.calendar.festivals.some((f) => f.kind === 'singugan' && f.season === dahan + 1));
  c.season = dahan;
  const half = buildOptions(c);
  for (const o of normal) {
    const h = half.find((x) => x.id === o.id)!;
    assert.equal(h.cost.gold ?? 0, Math.ceil((o.cost.gold ?? 0) / 2), o.id);
    assert.equal(h.cost.chiseong ?? 0, o.cost.chiseong ?? 0, o.id);
  }
});

test('시설마다 지키는 가신 하나 (성주·조왕·측신을 한 시설에 묶지 않는다)', () => {
  const names = CD.facilities.map((f) => f.guardian?.split(' — ')[0]);
  assert.ok(names.every(Boolean));
  assert.equal(new Set(names).size, names.length, '시설마다 다른 신');
  assert.ok(!names.includes('측신'), '측신은 시설이 아니라 마을 이야기로만');
});
