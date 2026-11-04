// 로드아웃(시작 4장 + 익힌 카드 중 4장)·익힌 카드·신물·합기 고르기. 캠페인과 시뮬레이터가 함께 쓴다.

import { loadData } from '../core/data.ts';
import { BASE } from '../core/value.ts';
import type { CardDef, HeroId, Op } from '../core/types.ts';

export const LOADOUT_SIZE = 4;

function hasBlockOp(ops: Op[]): boolean {
  for (const op of ops) {
    if (op.op === 'block' || (op.op === 'move' && op.kind === '엄호')) return true;
    if (op.op === 'cond' && hasBlockOp(op.then)) return true;
    if (op.op === 'per' && hasBlockOp(op.each)) return true;
  }
  return false;
}

export function isDefensive(def: CardDef): boolean {
  return hasBlockOp(def.effects);
}

/** 카드 한 장의 대략 값 (가치 ÷ 기본 예산) — 로드아웃·보상 고르기 공통 */
export function cardScore(def: CardDef): number {
  let sc = def.value / (BASE[def.cost] ?? 8);
  if (def.rarity === '희귀') sc += 0.08;
  if (def.rarity === '고급') sc += 0.04;
  if (def.requireGangsin) sc -= 0.3;
  if (def.isPower) sc += 0.02;
  return sc;
}

// 스스로 차지 않는 자원 (소비하려면 로드아웃 안에 만드는 카드가 있어야 한다). 신바람·가락·염주·경면주사·탈은 저절로 찬다
const PERSONAL_NEED = new Set(['화약', '오라', '작두']);
const SHARED_NEED = new Set(['점지', '상흔', '명부', '넋흔들림', '굿상', '부적']);

function hasDmg(def: CardDef): boolean {
  const walk = (ops: Op[]): boolean => ops.some((o) => o.op === 'dmg' || (o.op === 'cond' && walk(o.then)) || (o.op === 'per' && walk(o.each)));
  return walk(def.effects);
}

/** 로드아웃 묶음 점수의 가중치 (실험용으로 바꿀 수 있게 묶어 둔다) */
export const LOADOUT_W = {
  personalNeed: 0.5,
  sharedNeed: 0.2,
  noAttack: 1.2,
  oneAttack: 0.3,
  perAttack: 0,
  noDefense: 0.4,
  extraPower: 0.35,
  starter: 0.01,
};

/** 로드아웃 묶음 점수: 카드 점수 합 + 공격·방어 갖춤 + 혼자 도는 엔진(소비하는 자원을 만드는 카드가 묶음 안에 있는가) */
export function loadoutScore(cards: CardDef[]): number {
  const W = LOADOUT_W;
  let sc = 0;
  const produce = new Set<string>();
  for (const c of cards) {
    sc += cardScore(c);
    for (const t of c.tags.produce) produce.add(t);
    if (c.text.includes('작두에 오른다')) produce.add('작두');
  }
  for (const c of cards) for (const t of c.tags.consume) {
    if (produce.has(t)) continue;
    if (PERSONAL_NEED.has(t)) sc -= W.personalNeed;
    else if (SHARED_NEED.has(t)) sc -= W.sharedNeed;
  }
  const atk = cards.filter(hasDmg).length;
  if (atk === 0) sc -= W.noAttack;
  else if (atk === 1) sc -= W.oneAttack;
  sc += atk * W.perAttack;
  if (!cards.some(isDefensive)) sc -= W.noDefense;
  const powers = cards.filter((c) => c.isPower).length;
  if (powers > 1) sc -= W.extraPower * (powers - 1);
  return sc;
}

/** 로드아웃 4장: 시작 카드 + 익힌 카드 중 묶음 점수가 가장 큰 4장 */
export function bestLoadout(arch: HeroId, learned: string[]): string[] {
  const d = loadData();
  const starters = d.starters.get(arch)!.map((c) => c.id);
  const pool = [...new Set([...starters, ...learned])].map((id) => d.cardById.get(id)!).filter(Boolean);
  if (pool.length <= LOADOUT_SIZE) return pool.map((c) => c.id);
  let best: CardDef[] = pool.slice(0, LOADOUT_SIZE);
  let bv = -Infinity;
  const n = pool.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let e = c + 1; e < n; e++) {
    const set = [pool[a], pool[b], pool[c], pool[e]];
    const v = loadoutScore(set) + set.filter((x) => x.starter).length * LOADOUT_W.starter;
    if (v > bv) {
      bv = v;
      best = set;
    }
  }
  return best.map((c) => c.id);
}

/** 원정이 끝나면 익히는 카드: 그 원정에서 가장 많이 낸 자기 카드(시작 카드 제외, 이미 익혔으면 다음 순위) */
export function learnFrom(arch: HeroId, plays: Record<string, number>, learned: string[]): string | null {
  const d = loadData();
  const rows = Object.entries(plays)
    .map(([id, n]) => ({ def: d.cardById.get(id), n }))
    .filter((r) => r.def && r.def.set === arch && !r.def.starter && !r.def.isToken && !r.def.upgraded && !learned.includes(r.def.id))
    .sort((a, b) => b.n - a.n || cardScore(b.def!) - cardScore(a.def!));
  return rows[0]?.def!.id ?? null;
}

/** 신물: 그 개체가 가장 많이 낸 카드의 기념판, 주인 '파티'. 주인 없는 카드로도 효과가 있는 피해·상태 카드만 (08 §3.3) */
export function sinmulFor(arch: HeroId, plays: Record<string, number>): string | null {
  const d = loadData();
  let best: string | null = null;
  let bv = -1;
  for (const [id, n] of Object.entries(plays)) {
    const def = d.cardById.get(id);
    if (!def || def.set !== arch || def.isToken || def.isPower || def.upgraded) continue;
    if (!def.effects.some((o) => o.op === 'dmg' || o.op === 'apply')) continue;
    if (n > bv || (n === bv && best && cardScore(def) > cardScore(d.cardById.get(best)!))) {
      bv = n;
      best = id;
    }
  }
  if (best) return best;
  const fallback = d.starters.get(arch)!.find((c) => c.effects.some((o) => o.op === 'dmg' || o.op === 'apply'));
  return fallback?.id ?? null;
}

/** 두 원형의 합기 카드 */
export function duoCard(a: HeroId, b: HeroId): string | null {
  return loadData().duoFor.get([a, b].sort().join('+'))?.id ?? null;
}

/** 성장의 길 카드인가 (A/B) */
export function pathOfCard(id: string): 'A' | 'B' | 'core' {
  const def = loadData().cardById.get(id);
  return (def?.path as 'A' | 'B' | 'core') ?? 'core';
}
