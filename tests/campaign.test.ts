// 캠페인 루프 v1 (docs/09-campaign-spec.md): 개체·레벨·익힌 카드·로드아웃·각인·피로·죽음과 유산·인연·시설·절기·균열·의뢰·결말.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadData } from '../src/core/data.ts';
import {
  baseMaxHp, bondKey, build, cheondo, clearEngraving, engrave, maxHpOf, newCampaign, passSeason, planExpedition, promote, recruit,
  recruitCost, settle, setLoadout, wanderingSpirits,
} from '../src/meta/campaign.ts';
import { CD } from '../src/meta/content.ts';
import { bestLoadout } from '../src/meta/loadout.ts';
import type { Campaign, ExpeditionPlan, ExpeditionReport, Person } from '../src/meta/types.ts';
import { runCampaign } from '../src/sim/campaign-sim.ts';

function distinctTrio(c: Campaign): string[] {
  const out: Person[] = [];
  for (const p of c.roster) if (!out.some((x) => x.arch === p.arch) && out.length < 3) out.push(p);
  return out.map((p) => p.uid);
}

function report(plan: ExpeditionPlan, over: Partial<ExpeditionReport> = {}): ExpeditionReport {
  return {
    success: true, retreated: false, wiped: false, bossWon: plan.commission.length !== 'normal', bossHaewon: plan.commission.length !== 'normal',
    heroes: plan.heroes.map(() => ({ hp: 20, maxHp: 40, dead: false, injured: false, stress: 10, plays: {} })),
    revived: [], haewons: 3, haewonById: {}, haewonByFamily: { 수귀: 2 }, killByFamily: { 객귀: 1 }, gold: 100, chiseong: 0, cheondo: [], bondsGained: {},
    met: ['jeojeun_neok'], leftover: {}, sonnim: null, ...over,
  };
}

test('새 캠페인: 서로 다른 원형 4명(수호형 1명 이상), 엽전 300, 시작 시설, 의뢰 2~3개, 영입 후보 2명', () => {
  const c = newCampaign(11);
  assert.equal(c.roster.length, 4);
  assert.equal(new Set(c.roster.map((p) => p.arch)).size, 4);
  assert.ok(c.roster.some((p) => p.arch === 'seungnyeo' || p.arch === 'chasa'));
  assert.equal(c.gold, 300);
  assert.equal(c.facilities.sindang, 1);
  assert.equal(c.facilities.mugubang, 0);
  assert.ok(c.commissions.length >= 2 && c.commissions.every((x) => x.region === 1));
  assert.equal(c.candidates.length, 2);
  for (const p of c.roster) {
    assert.ok(p.good && p.bad, '좋은 기질 1 + 나쁜 기질 1');
    assert.equal(p.loadout.length, 4);
    assert.ok(CD.origins[p.arch][p.origin]);
  }
});

test('출정 계획: 같은 원형은 한 파티에 한 명, 선금을 받고 보급품을 산다, 덱 = 로드아웃 12장', () => {
  const c = newCampaign(3);
  const cm = c.commissions[0];
  const trio = distinctTrio(c);
  const gold = c.gold;
  const plan = planExpedition(c, cm.id, trio, { rice: 2, candle: 1 });
  assert.ok(typeof plan !== 'string');
  if (typeof plan === 'string') return;
  assert.equal(plan.deck.length, 12);
  assert.equal(c.gold, gold + cm.advance - 2 * 10 - 15);
  assert.equal(plan.supplies.rice, 2);
  const c2 = newCampaign(3);
  const dup = c2.roster[0];
  c2.roster[1].arch = dup.arch;
  assert.equal(typeof planExpedition(c2, c2.commissions[0].id, [dup.uid, c2.roster[1].uid, c2.roster[2].uid], {}), 'string');
});

test('귀환 결산: 경험 → 레벨(최대 체력 +3), 익힌 카드, 정 +1, 재료(해원 2·처치 1+잡귀 넋 1), 절기·균열 +1', () => {
  const c = newCampaign(5);
  const trio = distinctTrio(c);
  const p0 = c.roster.find((p) => p.uid === trio[0])!;
  const hp0 = baseMaxHp(p0);
  const plan = planExpedition(c, c.commissions.find((x) => x.length === 'boss')!.id, trio, {}) as ExpeditionPlan;
  const pool = loadData().pools.get(p0.arch)!;
  const rep = report(plan);
  rep.heroes[0].plays = { [pool[0].id]: 5, [pool[1].id]: 2 };
  const before = { season: c.season, rift: c.rift };
  settle(c, plan, rep);
  assert.equal(p0.xp, 2, '원정 +1, 보스 +1');
  assert.equal(p0.level, 0);
  assert.deepEqual(p0.learned, [pool[0].id], '가장 많이 낸 자기 카드');
  assert.equal(c.bonds[bondKey(trio[0], trio[1])], 1);
  assert.equal(c.materials['수귀'], 4);
  assert.equal(c.materials['객귀'], 1);
  assert.equal(c.materials['잡귀잡신'], 1);
  assert.equal(c.season, before.season + 1);
  assert.ok(c.lots.includes('r1boss'), '지역 1 보스를 처음 보내면 약방·무구방 부지');
  // 레벨: 첫 문턱 경험 → 레벨 1, 최대 체력 +3
  p0.xp = CD.levels.xp[0] - 1;
  const plan2 = planExpedition(c, c.commissions.find((x) => x.length === 'normal')!.id, trio, {}) as ExpeditionPlan;
  settle(c, plan2, report(plan2));
  assert.equal(p0.level, 1);
  assert.equal(baseMaxHp(p0), hp0 + CD.levels.hpPerLevel);
  // 피로: 연속 출전 2번 → 최대 체력 −10%
  assert.equal(p0.sorties, 2);
  assert.equal(maxHpOf(p0), Math.round(baseMaxHp(p0) * 0.9));
});

test('죽음과 유산: 사당 → 2절기 안에 천도굿, 못 치르면 떠도는 넋(귀기 +10). 천도굿 → 조상신·신물 → 신어머니', () => {
  const c = newCampaign(9);
  const trio = distinctTrio(c);
  const dead = c.roster.find((p) => p.uid === trio[1])!;
  const plan = planExpedition(c, c.commissions[0].id, trio, {}) as ExpeditionPlan;
  const rep = report(plan);
  const card = loadData().pools.get(dead.arch)!.find((x) => x.effects.some((o) => o.op === 'dmg'))!;
  dead.learned = [card.id];
  rep.heroes[1] = { ...rep.heroes[1], dead: true, plays: { [card.id]: 4 } };
  settle(c, plan, rep);
  assert.ok(!c.roster.includes(dead));
  const f = c.fallen[0];
  assert.equal(f.person.uid, dead.uid);
  assert.equal(f.deadline, f.died + CD.death.deadline);
  passSeason(c);
  passSeason(c);
  assert.equal(wanderingSpirits(c).length, 1, '2절기가 지나면 떠도는 넋');
  const p2 = planExpedition(c, c.commissions[0].id, distinctTrio(c), {}) as ExpeditionPlan;
  assert.ok(p2.heroes.every((h, i) => h.stress >= CD.death.wanderStress && p2.stressAdd[i] === CD.death.wanderStress));
  c.gold = 500;
  assert.equal(cheondo(c, dead.uid), null);
  assert.ok(f.honored && !f.wandering);
  assert.equal(f.sinmul, card.id, '가장 많이 낸 카드의 기념판');
  // 신물은 다음 원정 덱에 주인 '파티'로
  const p3 = planExpedition(c, c.commissions[0].id, distinctTrio(c), {}) as ExpeditionPlan;
  assert.ok(p3.deck.some((x) => x.id === card.id && x.o === -1));
  // 신어머니: 같은 원형 신입이 익힌 카드 1장을 처음부터
  c.candidates[0].arch = dead.arch;
  c.roster = c.roster.slice(0, 3);
  assert.equal(recruit(c, 0, dead.uid), null);
  const girl = c.roster[c.roster.length - 1];
  assert.deepEqual(girl.learned, [card.id]);
  assert.equal(girl.mother, dead.uid);
  assert.equal(f.daughter, girl.uid);
});

test('인연: 정 5 이상인 쌍이 함께 나가면 합기 카드가 시작 덱에', () => {
  const c = newCampaign(2);
  const trio = distinctTrio(c);
  c.bonds[bondKey(trio[0], trio[1])] = 5;
  const plan = planExpedition(c, c.commissions[0].id, trio, {}) as ExpeditionPlan;
  assert.equal(plan.duoCards.length, 1);
  assert.equal(plan.deck.length, 13);
  const duo = plan.deck.find((x) => x.o2 >= 0)!;
  assert.ok(duo.o >= 0 && duo.o2 >= 0 && duo.o !== duo.o2);
});

test('시설: 부지와 비용(치성·엽전). 신당 2단계 → 지역 2. 무구방 각인(재료 10, 바꾸면 전액 반환), 전수청 내림굿(레벨 2)', () => {
  const c = newCampaign(4);
  assert.ok(build(c, 'mugubang'), '부지가 없다');
  assert.ok(build(c, 'sindang'), '치성이 모자라다');
  c.chiseong = 20;
  c.gold = 2000;
  assert.equal(build(c, 'sindang'), null);
  assert.ok(c.commissions.length > 0);
  passSeason(c);
  assert.ok(c.commissions.some((x) => x.region === 2), '지역 2 의뢰');
  c.lots.push('r1boss', 'r2boss');
  assert.equal(build(c, 'mugubang'), null);
  const p = c.roster[0];
  c.materials['억울귀'] = 12;
  assert.equal(engrave(c, p.uid, p.loadout[0], '억울귀'), null);
  assert.equal(c.materials['억울귀'], 2);
  assert.equal(p.engraving?.status, '명부');
  clearEngraving(c, p.uid);
  assert.equal(c.materials['억울귀'], 12);
  assert.ok(promote(c, p.uid, 'A'), '전수청이 없다');
  assert.equal(build(c, 'jeonsucheong'), null);
  assert.ok(promote(c, p.uid, 'A'), '레벨 2 필요');
  p.level = 2;
  assert.equal(promote(c, p.uid, 'B'), null);
  assert.ok(p.epithet);
  assert.equal(p.path, 'B');
  // 전수청이 있으면 로드아웃 교체가 무료
  const g = c.gold;
  const alt = bestLoadout(p.arch, loadData().pools.get(p.arch)!.slice(0, 3).map((x) => x.id));
  p.learned = loadData().pools.get(p.arch)!.slice(0, 3).map((x) => x.id);
  assert.equal(setLoadout(c, p.uid, alt), null);
  assert.equal(c.gold, g);
});

test('저승문 균열: 절기마다 +1, 가득 차면 3절기 카운트다운 → 봉합 의뢰. 끄면 카운트다운이 없다', () => {
  const c = newCampaign(6);
  c.rift = CD.rift.max - 1;
  passSeason(c);
  assert.equal(c.countdown, CD.rift.countdown);
  assert.ok(c.commissions.some((x) => x.seal));
  passSeason(c);
  passSeason(c);
  passSeason(c);
  assert.equal(c.ending?.kind, 'fail');
  const off = newCampaign(6, { rift: false });
  off.rift = CD.rift.max - 1;
  passSeason(off);
  assert.equal(off.countdown, null);
  assert.equal(off.rift, CD.rift.max);
});

test('영입: 객주 로스터 상한, 비용 40, 세 원형을 못 꾸리면 무료', () => {
  const c = newCampaign(8);
  assert.equal(recruitCost(c), 0, '첫 절기는 설 — 떠돌이 기예인이 무료로 합류');
  c.freeRecruit = false;
  assert.equal(recruitCost(c), CD.economy.recruitCost);
  c.roster = c.roster.slice(0, 2);
  assert.equal(recruitCost(c), 0);
});

test('결말: 3지역 최종 큰 원귀를 해원하면 좋은 결말', () => {
  const c = newCampaign(12);
  c.facilities.sindang = 3;
  c.bosses[3] = { first: 0, wins: CD.finalUnlock.bossWins - 1, haewon: 1 };
  passSeason(c);
  assert.ok(!c.commissions.some((x) => x.length === 'final'), `최종 원정은 3지역 보스 길을 ${CD.finalUnlock.bossWins}번 마친 뒤`);
  c.bosses[3].wins = CD.finalUnlock.bossWins;
  passSeason(c);
  const fin = c.commissions.find((x) => x.length === 'final')!;
  assert.ok(fin);
  const plan = planExpedition(c, fin.id, distinctTrio(c), {}) as ExpeditionPlan;
  settle(c, plan, report(plan));
  assert.equal(c.ending?.kind, 'good');
});

test('⟨반복 3⟩ 따라잡기 경험 · 숙련 영입 · 균열 봉합 지역', () => {
  const c = newCampaign(21);
  const trio = distinctTrio(c);
  const [a, b] = trio.map((u) => c.roster.find((p) => p.uid === u)!);
  // 로스터에 레벨 3 고참이 있으면 레벨 0 신참은 원정마다 경험 +1 더
  const vet = c.roster.find((p) => !trio.includes(p.uid))!;
  vet.level = 3;
  vet.xp = CD.levels.xp[2];
  b.level = 2;
  b.xp = CD.levels.xp[1];
  const plan = planExpedition(c, c.commissions.find((x) => x.length === 'normal')!.id, trio, {}) as ExpeditionPlan;
  settle(c, plan, report(plan));
  assert.equal(a.xp, CD.levels.xpExpedition + CD.levels.catchUpXp, '레벨 0 (최고 3 − 2 이하) → 따라잡기');
  assert.equal(b.xp, CD.levels.xp[1] + CD.levels.xpExpedition, '레벨 2 는 따라잡기 없음');
  // 객주 2단계: 숙련 영입은 경험 seasonedXp
  c.facilities.gaekju = 2;
  passSeason(c);
  assert.ok(c.candidates.every((p) => p.xp === CD.levels.seasonedXp && p.level >= 1));
  // 균열 봉합: 보스를 보낸 적 있는 가장 깊은 지역 (열린 가장 깊은 곳이 아니라)
  c.facilities.sindang = 3;
  c.bosses[1] = { first: 0, wins: 1, haewon: 1 };
  c.countdown = 2;
  passSeason(c);
  assert.equal(c.commissions.find((x) => x.seal)!.region, 1);
  c.bosses[2] = { first: 0, wins: 1, haewon: 0 };
  c.countdown = 2;
  passSeason(c);
  assert.equal(c.commissions.find((x) => x.seal)!.region, 2);
});

test('캠페인 시뮬: 봇이 한 캠페인을 끝까지 (결정적)', () => {
  const a = runCampaign(4242);
  const b = runCampaign(4242);
  assert.equal(a.expeditions, b.expeditions);
  assert.equal(a.deaths, b.deaths);
  assert.ok(['good', 'normal', 'fail', 'cap'].includes(a.ending));
  assert.ok(a.expeditions > 5);
});
