// 캠페인 출정 계획 → 원정 시뮬레이터 → 귀환 보고 (헤드리스). sim:campaign 과 테스트가 쓴다.

import { D } from '../core/engine.ts';
import { seedFrom } from '../core/rng.ts';
import type { CardInst } from '../core/types.ts';
import type { ExpeditionPlan, ExpeditionReport } from '../meta/types.ts';
import { runExpedition, type ExpeditionResult, type ExpeditionSetup, type Provisions } from './expedition.ts';

export function planDeck(plan: ExpeditionPlan): CardInst[] {
  const d = D();
  return plan.deck.map((c) => {
    const def = d.cardById.get(c.id)!;
    return c.g ? { d: def.idx, o: c.o, o2: c.o2, orig: -1, x: -1, g: c.g } : { d: def.idx, o: c.o, o2: c.o2, orig: -1, x: -1 };
  });
}

export function planSetup(plan: ExpeditionPlan, retreat: { below: number; boss: number }, paths?: ExpeditionSetup['paths']): ExpeditionSetup {
  const s = plan.supplies;
  const provisions: Provisions = { jijeon: s.jijeon, rice: s.rice, sul: s.sul, bujeok: s.bujeok, incense: s.incense };
  return {
    region: plan.commission.region, length: plan.commission.length,
    heroes: plan.heroes.map((h) => ({
      id: h.id, maxHp: h.maxHp, stress: h.stress, injured: h.injured, saveBonus: h.saveBonus, stressMult: h.stressMult, startBlock: h.startBlock,
      startWeak: h.startWeak, recovery: h.recovery,
    })),
    deck: planDeck(plan), provisions, enemyHpMult: plan.enemyHpMult, retreatBelow: retreat.below, bossRetreatBelow: retreat.boss, firstJangdan: plan.firstJangdan, paths,
  };
}

export function reportOf(plan: ExpeditionPlan, r: ExpeditionResult): ExpeditionReport {
  const len = plan.commission.length;
  const success = len === 'normal' ? r.cleared : r.bossWon;
  const left = r.provisionsLeft!;
  return {
    success, retreated: !!r.retreated, wiped: !!r.wipedAt, bossWon: len !== 'normal' && r.bossWon, bossHaewon: r.bossHaewon,
    heroes: r.heroOut!.map((h) => ({ hp: h.hp, maxHp: h.maxHp, dead: h.dead, injured: h.injured, stress: h.stress, plays: h.plays })),
    revived: r.revived ?? [], haewons: r.haewons, haewonById: r.haewonById ?? {}, haewonByFamily: r.haewonByFamily ?? {}, killByFamily: r.killByFamily ?? {},
    gold: r.gold ?? 0, chiseong: r.chiseong ?? 0, cheondo: [], bondsGained: {}, met: r.met ?? [],
    leftover: { jijeon: left.jijeon, rice: left.rice, sul: left.sul, bujeok: left.bujeok, incense: left.incense }, sonnim: r.sonnim ?? null,
  };
}

export function runPlan(plan: ExpeditionPlan, seed: number, retreat: { below: number; boss: number }, paths?: ExpeditionSetup['paths']): { result: ExpeditionResult; report: ExpeditionReport } {
  const result = runExpedition(plan.party, seedFrom(seed, 'campaign-exp'), { setup: planSetup(plan, retreat, paths) });
  return { result, report: reportOf(plan, result) };
}
