// 덱 구성·카드 보상(3택 1, 영웅마다 1장)·보상 선택 휴리스틱.

import { D } from '../core/engine.ts';
import type { Rng } from '../core/rng.ts';
import type { CardDef, CardInst, HeroId, Op } from '../core/types.ts';
import { BASE } from '../core/value.ts';

export type RewardTier = 'normal' | 'elite' | 'boss';

export const RARITY_ODDS: Record<RewardTier, { rare: number; uncommon: number }> = {
  normal: { rare: 0.03, uncommon: 0.37 },
  elite: { rare: 0.1, uncommon: 0.4 },
  boss: { rare: 1, uncommon: 0 },
};

export interface Pity {
  offset: number;
}
export const newPity = (): Pity => ({ offset: -0.05 });

export function starterDeck(party: HeroId[]): CardInst[] {
  const d = D();
  const deck: CardInst[] = [];
  party.forEach((h, i) => {
    for (const c of d.starters.get(h)!) deck.push({ d: c.idx, o: i, o2: -1, orig: -1, x: -1 });
  });
  return deck;
}

export function instFor(def: CardDef, party: HeroId[]): CardInst {
  if (def.ownerKind === 'duo') {
    return { d: def.idx, o: party.indexOf(def.heroes[0]), o2: party.indexOf(def.heroes[1]), orig: -1, x: -1 };
  }
  return { d: def.idx, o: def.heroes.length ? party.indexOf(def.heroes[0]) : -1, o2: -1, orig: -1, x: -1 };
}

function rollRarity(rng: Rng, tier: RewardTier, pity: Pity): string {
  const odds = RARITY_ODDS[tier];
  const rareP = Math.max(0, odds.rare + pity.offset);
  const r = rng.next();
  if (r < rareP) {
    pity.offset = -0.05;
    return '희귀';
  }
  pity.offset += 0.01;
  return r < rareP + odds.uncommon ? '고급' : '일반';
}

/** 영웅마다 1장 (살아 있는 영웅만). paths: 내림굿으로 고른 성장의 길 — 그 길의 카드가 두 배로 나온다(캠페인 §1) */
export function rollRewards(rng: Rng, heroes: HeroId[], tier: RewardTier, pity: Pity, paths?: Partial<Record<HeroId, 'A' | 'B'>>): CardDef[] {
  const d = D();
  const out: CardDef[] = [];
  for (const h of heroes) {
    const pool = d.pools.get(h)!;
    const rar = rollRarity(rng, tier, pity);
    let cands = pool.filter((c) => c.rarity === rar && !out.includes(c));
    if (!cands.length) cands = pool.filter((c) => !out.includes(c));
    const path = paths?.[h];
    if (path) cands = [...cands, ...cands.filter((c) => c.path === path)];
    out.push(rng.pick(cands));
  }
  return out;
}

// ── 보상 선택 휴리스틱 ─────────────────────────────────────────────
const SHARED = new Set(['점지', '상흔', '명부', '넋흔들림', '장단', '진형', '굿상', '부적', '취약', '약화']);

function hasBlock(ops: Op[]): boolean {
  for (const op of ops) {
    if (op.op === 'block' || (op.op === 'move' && op.kind === '엄호')) return true;
    if (op.op === 'cond' && hasBlock(op.then)) return true;
    if (op.op === 'per' && hasBlock(op.each)) return true;
    if (op.op === 'token') {
      const t = D().cards[op.tidx];
      if (hasBlock(t.effects)) return true;
    }
  }
  return false;
}

export interface DeckProfile {
  produce: Map<string, number>;
  consume: Map<string, number>;
  blockShare: number;
  size: number;
}

export function profileDeck(deck: CardInst[]): DeckProfile {
  const d = D();
  const produce = new Map<string, number>();
  const consume = new Map<string, number>();
  let blocks = 0;
  for (const c of deck) {
    const def = d.cards[c.d];
    for (const t of def.tags.produce) produce.set(t, (produce.get(t) ?? 0) + 1);
    for (const t of def.tags.consume) consume.set(t, (consume.get(t) ?? 0) + 1);
    if (hasBlock(def.effects)) blocks++;
  }
  return { produce, consume, blockShare: deck.length ? blocks / deck.length : 0, size: deck.length };
}

export function rewardScore(def: CardDef, prof: DeckProfile): number {
  let sc = def.value / (BASE[def.cost] ?? 8);
  let syn = 0;
  for (const t of def.tags.consume) {
    if (!SHARED.has(t)) continue;
    if ((prof.produce.get(t) ?? 0) >= 2) syn += 0.12;
  }
  for (const t of def.tags.produce) {
    if (!SHARED.has(t)) continue;
    if ((prof.consume.get(t) ?? 0) >= 1) syn += 0.08;
  }
  sc += Math.min(0.36, syn);
  if (prof.blockShare < 0.3 && hasBlock(def.effects)) sc += 0.12;
  if (def.cost >= 3) sc -= 0.05;
  if (def.requireGangsin) sc -= 0.3;
  return sc;
}

export const SKIP_THRESHOLD = 1.0;

/** 가장 좋은 보상. allowSkip 이면 모두 약할 때(덱이 충분히 클 때) 건너뛴다 */
export function pickReward(options: CardDef[], deck: CardInst[], allowSkip: boolean): CardDef | null {
  if (!options.length) return null;
  const prof = profileDeck(deck);
  let best = options[0];
  let bs = -Infinity;
  for (const o of options) {
    const sc = rewardScore(o, prof);
    if (sc > bs) {
      bs = sc;
      best = o;
    }
  }
  if (allowSkip && prof.size >= 20 && bs < SKIP_THRESHOLD) return null;
  return best;
}
