// 워커가 실행하는 작업 단위: 조합(trio) 하나.

import { createCombat, D } from '../core/engine.ts';
import { Rng, seedFrom } from '../core/rng.ts';
import type { CardInst, Encounter, HeroId, RuleVariant } from '../core/types.ts';
import { deckIdsOf, newCardAgg, newCombatAgg, recordCombat, type CardAgg, type CombatAgg } from './agg.ts';
import { runCombat } from './bot.ts';
import { instFor, newPity, pickReward, rollRewards, starterDeck } from './draft.ts';
import { runExpedition, type ExpeditionResult } from './expedition.ts';
import { provisionsFor, typicalParty } from './typical.ts';

export const MID_RUN_PICKS = 8;

/** 원정 중반 덱: 시작 12장 + 봇이 고른 풀 카드 8장 (일반 전투 보상 8번, 반드시 고른다) */
export function midRunDeck(trio: HeroId[], seed: number, cards?: CardAgg, duo = false, start?: CardInst[]): CardInst[] {
  const rng = new Rng(seedFrom('draft', trio.join('+'), seed));
  const pity = newPity();
  const deck = start ? start.slice() : starterDeck(trio);
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

/** 지역 N 의 전투 목록 (지역 2는 특수 전투 '손님 배웅'을 sonnim 으로 더한다) */
export function combatEncounters(region: number): Encounter[] {
  const d = D();
  if (region === 1) return d.encounters;
  const list = d.regionEncounters[region].slice();
  if (region === 2) list.push({ id: 'sonnim', tier: 'elite', enemies: d.specials.get('sonnim_baeung')!.followers, region: 2 });
  return list;
}

export function runCombatJob(trio: HeroId[], seeds: number, duo = false, region = 1): CombatJobResult {
  const t0 = performance.now();
  const d = D();
  const cards = newCardAgg();
  const perEnc: Record<string, CombatAgg> = {};
  const encs = combatEncounters(region);
  for (const enc of encs) perEnc[enc.id] = newCombatAgg();
  for (let seed = 1; seed <= seeds; seed++) {
    if (region === 1) {
      const deck = midRunDeck(trio, seed, cards, duo);
      const ids = deckIdsOf(deck);
      for (const enc of encs) {
        const s = createCombat({ party: trio.map((id) => ({ id })), deck, encounter: enc, seed: seedFrom(trio.join('+'), enc.id, seed), record: true, jijeon: 3 });
        const startHp = s.heroes.map((h) => h.hp);
        const { timeout } = runCombat(s);
        recordCombat(perEnc[enc.id], cards, s, trio, startHp, timeout, ids);
      }
      continue;
    }
    // 지역 2·3: 전형적인 캠페인 파티(로드아웃·레벨·각인·신물·합기) + 원정 중반 보상 8장
    const tp = typicalParty(trio, region, seed);
    const deck = midRunDeck(trio, seed, cards, duo, tp.deck);
    const ids = deckIdsOf(deck);
    const prov = provisionsFor(region, 'boss');
    for (const enc of encs) {
      const sp = enc.id === 'sonnim' ? d.specials.get('sonnim_baeung')! : null;
      const s = createCombat({
        party: tp.setup.heroes!.map((h) => ({ id: h.id, maxHp: h.maxHp })), deck, encounter: enc, seed: seedFrom(trio.join('+'), enc.id, seed), record: true,
        jijeon: prov.jijeon, provisions: prov, entertain: sp ? { goal: sp.goal, limit: sp.limit, start: trio.includes('manshin') ? sp.manshinStart : 0 } : null,
      });
      const startHp = s.heroes.map((h) => h.hp);
      const { timeout } = runCombat(s);
      if (sp && s.entertain?.result === 'timeout') s.outcome = -1; // 서운한 작별은 실패로 센다
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
  /** 지역 2·3: 전형적인 캠페인 파티로 (기본 1지역 v0.3) */
  region?: number;
  /** 3지역 최종 원정 (업경대 + 최종 큰 원귀) */
  final?: boolean;
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
  const region = whatIf.region ?? 1;
  for (let r = 1; r <= runs; r++) {
    if (region === 1) out.push(runExpedition(trio, seedFrom('exp', trio.join('+'), r), { agg, cards, ...whatIf }));
    else {
      const tp = typicalParty(trio, region, r, undefined, whatIf.final ? 'final' : 'boss');
      out.push(runExpedition(trio, seedFrom('exp', trio.join('+'), region, r), { agg, cards, ...whatIf, setup: tp.setup }));
    }
  }
  return { trio: trio.join('+'), runs: out, agg, cards, ms: performance.now() - t0 };
}
