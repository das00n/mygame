// 비용 가치 모델 (docs/04-cards.md §2, tools/design/card_check.py 의 value/budget 이식).
// 봇의 보상 선택·손패 잠재값, special 근사에 쓴다.

import type { RawOp } from './types.ts';

export const BASE: Record<number, number> = { 0: 4, 1: 8, 2: 16, 3: 25 };
export const RARITY_MULT: Record<string, number> = { 기본: 0.85, 일반: 1.0, 고급: 1.12, 희귀: 1.25, 합기: 1.3, 공용: 1.0 };
const KW_MULT: Record<string, number> = { 소멸: 1.3, 휘발: 1.15, 선천: 0.92, 보존: 0.95 };
const APPLY: Record<string, number> = { 취약: 3.5, 약화: 3.0, 점지: 2.0, 상흔: 1.7, 명부: 1.3, 넋흔들림: 1.1, 그늘: -2.0 };
export const EXPECT: Record<string, number> = { 점지: 2.5, 상흔: 4, 명부: 6, 넋흔들림: 6, 장단: 3, 굿상: 1.5, 부적: 2, 그늘: 1, 손패: 4 };

export interface ValueCtx {
  tokens: Map<string, { effects: RawOp[] }>;
  summons: Map<string, { effects: RawOp[]; duration?: number }>;
}

export function rawValue(effects: RawOp[] | undefined, ctx: ValueCtx): number {
  let total = 0;
  for (const ef of effects ?? []) total += opValue(ef, ctx);
  return total;
}

function num(v: unknown, d = 1): number {
  return typeof v === 'number' ? v : d;
}

export function opValue(ef: RawOp, ctx: ValueCtx): number {
  const n = num(ef.n);
  switch (ef.op) {
    case 'dmg': {
      const mult = ({ one: 1.0, all: 1.6, random: 0.9 } as Record<string, number>)[String(ef.target ?? 'one')] ?? 1.0;
      return n * num(ef.hits) * mult;
    }
    case 'block':
      return n * (({ self: 1.2, ally: 1.3, party: 2.4 } as Record<string, number>)[String(ef.to ?? 'self')] ?? 1.2);
    case 'draw':
      return 4 * n;
    case 'discard':
      return -n;
    case 'energy':
      return (ef.when === 'next' ? 6 : 8) * n;
    case 'apply':
      return (APPLY[String(ef.status)] ?? 0) * n * (ef.target === 'all' ? 1.6 : 1.0);
    case 'jangdan':
      return n > 0 ? 2 * n : 0;
    case 'personal':
      return n > 0 ? 2.5 * n : 0;
    case 'move':
      return ({ 전진: 2, 후퇴: 2, 교대: 3, 엄호: 6 } as Record<string, number>)[String(ef.kind)] ?? 0;
    case 'summon': {
      const s = ctx.summons.get(String(ef.id));
      return s ? rawValue(s.effects, ctx) * (s.duration ?? 3) * 0.75 : 0;
    }
    case 'token': {
      const t = ctx.tokens.get(String(ef.id));
      return t ? rawValue(t.effects, ctx) * n * 0.85 : 0;
    }
    case 'heal':
      return 1.5 * n * (({ self: 1.0, ally: 1.1, party: 2.4 } as Record<string, number>)[String(ef.to ?? 'self')] ?? 1.0);
    case 'stress':
      return n < 0 ? 0.4 * Math.abs(n) : -0.4 * n;
    case 'cleanse':
      return 3 * n;
    case 'exhaust_other':
      return 2 * n;
    case 'hp_loss':
      return -n;
    case 'per': {
      const src = String(ef.source);
      const exp = typeof ef.expect === 'number' ? ef.expect : (EXPECT[src] ?? 2);
      return rawValue(ef.each as RawOp[], ctx) * exp * 0.9;
    }
    case 'cond': {
      const p = typeof ef.p === 'number' ? ef.p : ef.if === '받는소리' ? 0.6 : 0.5;
      return rawValue(ef.then as RawOp[], ctx) * p;
    }
    case 'power':
      return rawValue(ef.effects as RawOp[], ctx) * (typeof ef.expect === 'number' ? ef.expect : 3.5) * 0.75;
    case 'consume':
      return 0;
    case 'special':
      return num(ef.value, 0);
    default:
      return 0;
  }
}

export function budgetOf(cost: number, rarity: string, keywords: string[]): number {
  let b = BASE[cost] ?? 8;
  b *= RARITY_MULT[rarity] ?? 1.0;
  for (const k of keywords) b *= KW_MULT[k] ?? 1.0;
  return b;
}
