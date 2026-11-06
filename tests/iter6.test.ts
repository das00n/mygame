// ⟨반복 6⟩ (docs/09-iteration.md §8): 조상신의 보살핌(많이 잃은 로스터의 회복 경로) · 손님 배웅 대접 22 · 쌀 민감도 what-if.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { D } from '../src/core/engine.ts';
import { ancestorSave, makePerson, newCampaign, planExpedition } from '../src/meta/campaign.ts';
import { CD, deathRules } from '../src/meta/content.ts';
import type { Campaign, ExpeditionPlan, Person } from '../src/meta/types.ts';
import { planSetup } from '../src/sim/campaign-run.ts';
import { runExpeditionJob } from '../src/sim/jobs.ts';
import { relicMods } from '../web/src/game/combat.ts';
import { newRun } from '../web/src/game/run.ts';

function addFallen(c: Campaign, n: number, honored: boolean): void {
  for (let k = 0; k < n; k++) {
    const person = makePerson(c);
    c.fallen.push({ person, died: c.season, cause: '시험', where: '시험', honored, deadline: c.season + 2, wandering: false, sinmul: null, daughter: null });
  }
}

function distinctTrio(c: Campaign): string[] {
  const out: Person[] = [];
  for (const p of c.roster) if (!out.some((x) => x.arch === p.arch) && out.length < 3) out.push(p);
  return out.map((p) => p.uid);
}

test('조상신의 보살핌: 조상신이 from 을 넘는 하나마다 +per, 상한 cap. 천도굿을 받지 못한 넋은 세지 않는다', () => {
  const a = CD.death.ancestorSave!;
  assert.ok(a, 'campaign.json death.ancestorSave');
  assert.deepEqual(a, { from: 2, per: 0.05, cap: 0.3 });
  const c = newCampaign(7);
  assert.equal(ancestorSave(c), 0);
  addFallen(c, a.from, true);
  assert.equal(ancestorSave(c), 0, `조상신 ${a.from} 까지는 없다`);
  addFallen(c, 3, false);
  assert.equal(ancestorSave(c), 0, '천도굿을 받지 못한 넋은 세지 않는다');
  addFallen(c, 1, true);
  assert.ok(Math.abs(ancestorSave(c) - a.per) < 1e-9);
  addFallen(c, 20, true);
  assert.equal(ancestorSave(c), a.cap);
});

test('조상신의 보살핌: 출정 계획에 실리고, 원정 시뮬(planSetup)과 플레이어블(relicMods)의 사망 판정 보정에 더해진다', () => {
  const c = newCampaign(5);
  addFallen(c, CD.death.ancestorSave!.from + 2, true);
  const cm = c.commissions[0];
  const plan = planExpedition(c, cm.id, distinctTrio(c), {}) as ExpeditionPlan;
  assert.equal(typeof plan, 'object');
  const bonus = 2 * CD.death.ancestorSave!.per;
  assert.ok(Math.abs(plan.ancestorSave! - bonus) < 1e-9);
  const setup = planSetup(plan, { below: 0.45, boss: 0.6 });
  assert.ok(Math.abs(setup.mods!.deathSave! - (deathRules(cm.length).deathSave + bonus)) < 1e-9);
  const run = newRun({
    seed: 1, commission: 'boss', party: plan.party.slice(), formation: [2, 1, 0], supplies: { candle: 6, rice: 4, incense: 2, jijeon: 2, bujeok: 1, sul: 2 }, gold: 0, spent: 0, region: 1,
    campaign: { length: cm.length, uids: plan.uids.slice(), enemyHpMult: 1, ancestorSave: plan.ancestorSave },
  });
  assert.ok(Math.abs(relicMods(run).deathSave! - (deathRules(cm.length).deathSave + bonus)) < 1e-9);
  // 옛 저장(ancestorSave 없음)은 기본값 그대로
  const old = newRun({
    seed: 1, commission: 'boss', party: plan.party.slice(), formation: [2, 1, 0], supplies: { candle: 6, rice: 4, incense: 2, jijeon: 2, bujeok: 1, sul: 2 }, gold: 0, spent: 0, region: 1,
    campaign: { length: cm.length, uids: plan.uids.slice(), enemyHpMult: 1 },
  });
  assert.ok(Math.abs(relicMods(old).deathSave! - deathRules(cm.length).deathSave) < 1e-9);
});

test('처벌 강도 ⟨반복 6⟩: 캠페인 사망 판정 보정 0.1 (조상신의 보살핌이 나머지를 맡는다)', () => {
  assert.equal(CD.death.deathSave, 0.1);
  assert.equal(CD.death.wipeSurvive, 0.67);
});

test('손님 배웅 대접 22 / 5턴 (만신 시작 대접 +2 그대로)', () => {
  const sp = D().specials.get('sonnim_baeung')!;
  assert.equal(sp.goal, 22);
  assert.equal(sp.limit, 5);
  assert.equal(sp.manshinStart, 2);
});

test('쌀 민감도 what-if: rice 를 주면 권장 쌀 대신 그만큼 들고 간다 (지역 2·3만, 기본값은 그대로)', () => {
  const trio = ['manshin', 'jaebi', 'posu'] as const;
  const base = runExpeditionJob([...trio], 1, { region: 2 });
  const more = runExpeditionJob([...trio], 1, { region: 2, rice: 9 });
  assert.equal(base.runs.length, 1);
  assert.ok((more.runs[0].provisionsLeft?.rice ?? 0) >= (base.runs[0].provisionsLeft?.rice ?? 0));
  assert.ok((more.runs[0].provisionsLeft?.rice ?? 0) <= 9);
});
