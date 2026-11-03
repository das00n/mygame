// 워커가 실행하는 작업 단위: 조합(trio) 하나.

import { createCombat, D } from '../core/engine.ts';
import { Rng, seedFrom } from '../core/rng.ts';
import type { CardInst, HeroId, RuleVariant } from '../core/types.ts';
import { deckIdsOf, newCardAgg, newCombatAgg, recordCombat, type CardAgg, type CombatAgg } from './agg.ts';
import { runCombat } from './bot.ts';
import { instFor, newPity, pickReward, rollRewards, starterDeck } from './draft.ts';
import { runExpedition, type ExpeditionResult } from './expedition.ts';

export const MID_RUN_PICKS = 8;

/** 원정 중반 덱: 시작 12장 + 봇이 고른 풀 카드 8장 (일반 전투 보상 8번, 반드시 고른다) */
export function midRunDeck(trio: HeroId[], seed: number, cards?: CardAgg, duo = false): CardInst[] {
  const rng = new Rng(seedFrom('draft', trio.join('+'), seed));
  const pity = newPity();
  const deck = starterDeck(trio);
  for (let k = 0; k < MID_RUN_PICKS; k++) {
    const opts = rollRewards(rng, trio, 'normal', pity);
    const pick = pickReward(opts, deck, false)!;
    if (cards) {
      for (const o of opts) cards.offered[o.id] = (cards.offered[o.id] ?? 0) + 1;
      cards.picked[pick.id] = (cards.picked[pick.id] ?? 0) + 1;
    }
    deck.push(instFor(pick, trio));
  }
  if (duo) {
    // 인연 1단계를 다 연 파티: 세 쌍의 합기 카드 3장
    const d = D();
    for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) deck.push(instFor(d.duoFor.get([trio[a], trio[b]].sort().join('+'))!, trio));
  }
  return deck;
}

export interface CombatJobResult {
  trio: string;
  perEnc: Record<string, CombatAgg>;
  cards: CardAgg;
  ms: number;
}

export function runCombatJob(trio: HeroId[], seeds: number, duo = false): CombatJobResult {
  const t0 = performance.now();
  const d = D();
  const cards = newCardAgg();
  const perEnc: Record<string, CombatAgg> = {};
  for (const enc of d.encounters) perEnc[enc.id] = newCombatAgg();
  for (let seed = 1; seed <= seeds; seed++) {
    const deck = midRunDeck(trio, seed, cards, duo);
    const ids = deckIdsOf(deck);
    for (const enc of d.encounters) {
      const s = createCombat({ party: trio.map((id) => ({ id })), deck, encounter: enc, seed: seedFrom(trio.join('+'), enc.id, seed), record: true, jijeon: 3 });
      const startHp = s.heroes.map((h) => h.hp);
      const { timeout } = runCombat(s);
      recordCombat(perEnc[enc.id], cards, s, trio, startHp, timeout, ids);
    }
  }
  return { trio: trio.join('+'), perEnc, cards, ms: performance.now() - t0 };
}

export interface ExpeditionJobResult {
  trio: string;
  runs: ExpeditionResult[];
  agg: CombatAgg;
  cards: CardAgg;
  ms: number;
}

export interface WhatIf {
  betweenHeal?: number;
  betweenHealFlat?: number;
  betweenHealMissing?: number;
  rules?: RuleVariant;
  boss?: string;
  preBossCamp?: boolean;
  preBossHeal?: boolean;
}

export function runExpeditionJob(trio: HeroId[], runs: number, whatIf: WhatIf = {}): ExpeditionJobResult {
  const t0 = performance.now();
  const agg = newCombatAgg();
  const cards = newCardAgg();
  const out: ExpeditionResult[] = [];
  for (let r = 1; r <= runs; r++) out.push(runExpedition(trio, seedFrom('exp', trio.join('+'), r), { agg, cards, ...whatIf }));
  return { trio: trio.join('+'), runs: out, agg, cards, ms: performance.now() - t0 };
}
