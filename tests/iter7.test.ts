// ⟨반복 7⟩ (docs/09-iteration.md §9): 2·3막 쌀 짐 한도(사람도 봇도 묶는다) · 손님 배웅(부적은 대접이 아니다 · 수비 뒷전 몫 +2 · 대접 23).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCombat, D, endPlayerTurn, killEnemy } from '../src/core/engine.ts';
import type { CombatState, HeroId } from '../src/core/types.ts';
import { chooseSupplies } from '../src/meta/bot.ts';
import { carryOf, newCampaign, passSeason, planExpedition, recommendedSupplies, supplyMax } from '../src/meta/campaign.ts';
import { CD } from '../src/meta/content.ts';
import type { Campaign, ExpeditionPlan, Person } from '../src/meta/types.ts';
import { runExpeditionJob } from '../src/sim/jobs.ts';

function distinctTrio(c: Campaign): string[] {
  const out: Person[] = [];
  for (const p of c.roster) if (!out.some((x) => x.arch === p.arch) && out.length < 3) out.push(p);
  return out.map((p) => p.uid);
}

/** 신당 2·3단계 캠페인 (지역 2·3 의뢰가 의뢰판에 오른다) */
function campaignWith(sindang: number, seed = 21): Campaign {
  const c = newCampaign(seed);
  c.facilities.sindang = sindang;
  c.gold = 5000;
  for (let k = 0; k < 6 && !c.commissions.some((x) => x.region === sindang); k++) passSeason(c);
  return c;
}

test('짐 한도 ⟨반복 7⟩: 2막 쌀 4 · 3막 쌀 6, 1막은 없다. 권장량은 한도를 넘지 않는다(최종 원정 7 → 6)', () => {
  assert.equal(carryOf(1), null);
  assert.equal(carryOf(2)?.limit.rice, 4);
  assert.equal(carryOf(3)?.limit.rice, 6);
  for (const r of [2, 3]) for (const len of ['normal', 'boss', 'final'] as const) {
    if (r === 2 && len === 'final') continue;
    assert.ok(recommendedSupplies(r, len).rice <= carryOf(r)!.limit.rice!, `지역 ${r} ${len} 권장 쌀`);
  }
  assert.equal(recommendedSupplies(3, 'final').rice, 6);
  const c = newCampaign(3);
  assert.equal(supplyMax(c).rice, CD.provisions.max.rice);
  assert.equal(supplyMax(c, 1).rice, CD.provisions.max.rice);
  assert.equal(supplyMax(c, 2).rice, 4);
  assert.equal(supplyMax(c, 3).rice, 6);
  assert.equal(supplyMax(c, 2).sul, supplyMax(c).sul, '쌀만 묶는다');
  assert.ok(carryOf(2)!.short && carryOf(2)!.why && carryOf(3)!.short && carryOf(3)!.why, '출정 화면에 보일 까닭');
});

test('짐 한도: 더 사도 한도까지만 지고 가고, 넘는 몫은 창고에 남는다 (1막은 그대로)', () => {
  const c = campaignWith(2);
  const cm = c.commissions.find((x) => x.region === 2)!;
  assert.ok(cm, '지역 2 의뢰');
  const plan = planExpedition(c, cm.id, distinctTrio(c), { rice: 9 }) as ExpeditionPlan;
  assert.equal(typeof plan, 'object');
  assert.equal(plan.supplies.rice, 4);
  assert.equal(c.stock.rice, 5, '넘는 쌀 5 는 창고에');
  // 1막 의뢰: 묶음 한도만
  const c1 = newCampaign(4);
  c1.gold = 5000;
  const cm1 = c1.commissions.find((x) => x.region === 1)!;
  const plan1 = planExpedition(c1, cm1.id, distinctTrio(c1), { rice: 9 }) as ExpeditionPlan;
  assert.equal(plan1.supplies.rice, 9);
  assert.equal(c1.stock.rice, 0);
});

test('짐 한도: 봇은 한도를 넘게 사지 않는다 (창고에 남은 쌀은 다음 출정에 쓴다)', () => {
  const c = campaignWith(3);
  const cm = c.commissions.find((x) => x.region === 3)!;
  assert.ok(cm, '지역 3 의뢰');
  assert.ok((chooseSupplies(c, cm).rice ?? 0) <= 6);
  c.stock.rice = 8;
  assert.equal(chooseSupplies(c, cm).rice ?? 0, 0);
  const plan = planExpedition(c, cm.id, distinctTrio(c), chooseSupplies(c, cm)) as ExpeditionPlan;
  assert.equal(plan.supplies.rice, 6);
  assert.equal(c.stock.rice, 2);
});

test('쌀 what-if ⟨반복 7⟩: rice 가 짐 한도에서 멈춘다 — 지역 2 에서 쌀 6 을 사려 해도 권장량(4)과 같은 원정', () => {
  const trio: HeroId[] = ['manshin', 'jaebi', 'posu'];
  const base = runExpeditionJob(trio, 2, { region: 2 });
  const more = runExpeditionJob(trio, 2, { region: 2, rice: 6 });
  assert.deepEqual(more.runs.map((r) => [r.cleared, r.haewons, r.deaths, r.sonnim, r.provisionsLeft?.rice]), base.runs.map((r) => [r.cleared, r.haewons, r.deaths, r.sonnim, r.provisionsLeft?.rice]));
  const free = runExpeditionJob(trio, 2, { region: 2, rice: 6, noCarry: true });
  assert.equal(free.runs.length, 2);
});

function sonnimFight(): CombatState {
  const sp = D().specials.get('sonnim_baeung')!;
  const s = createCombat({
    party: (['seungnyeo', 'posu', 'beopsa'] as HeroId[]).map((id) => ({ id })), deck: [], seed: 5, record: true,
    encounter: { id: 'sonnim', tier: 'elite', enemies: sp.followers }, entertain: { goal: sp.goal, limit: sp.limit, start: 0, token: sp.tokenTurn, guardDown: sp.guardDown },
    provisions: { sul: 0, rice: 0 },
  });
  s.draw = [];
  s.discard = [];
  return s;
}

test('손님 배웅 ⟨반복 7⟩: 대접 23 · 수비가 쓰러지면 +2(뒷전 몫) · 부적은 대접이 되지 않는다(손님을 막는 것)', () => {
  const sp = D().specials.get('sonnim_baeung')!;
  assert.equal(sp.goal, 23);
  assert.equal(sp.limit, 5);
  assert.equal(sp.manshinStart, 2);
  assert.equal(sp.guardDown, 2);
  assert.equal(sp.tokenTurn, 0);
  const s = sonnimFight();
  s.tokensPlayed = 2;
  s.summons = [];
  s.jangdan = 0;
  endPlayerTurn(s);
  assert.equal(s.entertain!.value, 0, '부적을 낸 턴도 대접 0');
  killEnemy(s, 0);
  assert.equal(s.entertain!.value, 2);
  // 옛 저장(token·guardDown 없음)은 반복 6 규칙(+1 · +1)
  const old = sonnimFight();
  delete old.entertain!.token;
  delete old.entertain!.guardDown;
  old.tokensPlayed = 1;
  endPlayerTurn(old);
  assert.equal(old.entertain!.value, 1);
  killEnemy(old, 0);
  assert.equal(old.entertain!.value, 2);
});
