// 충실도 집계: 카드(부적·설치물 포함) 전체에서 cond·per·power 를 결정적으로 실행하는지, 근사(스텁)하는지 센다.

import { loadData } from './data.ts';
import type { Op } from './types.ts';

export interface OpRef {
  owner: string; // 카드·부적·설치물 id
  op: Op;
}

export interface FidelityReport {
  cond: { total: number; deterministic: number; stochastic: number; stubs: string[] };
  per: { total: number; deterministic: number; expect: number; stubs: string[] };
  power: { total: number; deterministic: number; unknown: number; stubs: string[] };
  special: { total: number; exact: number; approx: number; approxList: string[]; exactList: string[] };
  cardsWithStub: number;
  cardsTotal: number;
}

let index: Map<string, OpRef> | null = null;

function walk(ops: Op[], owner: string, fn: (r: OpRef) => void): void {
  for (const op of ops) {
    fn({ owner, op });
    if (op.op === 'per') walk(op.each, owner, fn);
    if (op.op === 'cond') walk(op.then, owner, fn);
    if (op.op === 'power') walk(op.effects, owner, fn);
  }
}

export function allOps(fn: (r: OpRef) => void): void {
  const d = loadData();
  for (const c of d.cards) walk(c.effects, c.id, fn);
  for (const s of d.summons) walk(s.effects, s.id, fn);
}

/** op key → 위치 (cond·per·power·special) */
export function opIndex(): Map<string, OpRef> {
  if (index) return index;
  index = new Map();
  allOps((r) => {
    if ('key' in r.op) index!.set(r.op.key, r);
  });
  return index;
}

export function fidelityReport(): FidelityReport {
  const d = loadData();
  const rep: FidelityReport = {
    cond: { total: 0, deterministic: 0, stochastic: 0, stubs: [] },
    per: { total: 0, deterministic: 0, expect: 0, stubs: [] },
    power: { total: 0, deterministic: 0, unknown: 0, stubs: [] },
    special: { total: 0, exact: 0, approx: 0, approxList: [], exactList: [] },
    cardsWithStub: 0,
    cardsTotal: 0,
  };
  const stubCards = new Set<string>();
  allOps(({ owner, op }) => {
    if (op.op === 'cond') {
      rep.cond.total++;
      if (op.cond.k === 'stochastic') {
        rep.cond.stochastic++;
        rep.cond.stubs.push(`${owner}: "${op.ifText}" (p ${op.p})`);
        stubCards.add(owner);
      } else rep.cond.deterministic++;
    } else if (op.op === 'per') {
      rep.per.total++;
      if (op.mode === 'expect') {
        rep.per.expect++;
        rep.per.stubs.push(`${owner}: ${op.source}`);
        stubCards.add(owner);
      } else rep.per.deterministic++;
    } else if (op.op === 'power') {
      rep.power.total++;
      if (op.trigger === 'unknown') {
        rep.power.unknown++;
        rep.power.stubs.push(owner);
        stubCards.add(owner);
      } else rep.power.deterministic++;
    } else if (op.op === 'special') {
      rep.special.total++;
      if (op.kind === 'approx') {
        rep.special.approx++;
        rep.special.approxList.push(`${owner} (value ${op.value})`);
        stubCards.add(owner);
      } else {
        rep.special.exact++;
        rep.special.exactList.push(`${owner} → ${op.kind}`);
      }
    }
  });
  rep.cardsWithStub = stubCards.size;
  rep.cardsTotal = d.cards.length + d.summons.length;
  return rep;
}
