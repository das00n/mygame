// 집계 구조 (워커 → 메인으로 넘기므로 순수 객체만 쓴다)

import { D } from '../core/engine.ts';
import type { CombatState, HeroId } from '../core/types.ts';

export interface CombatAgg {
  n: number;
  wins: number;
  timeouts: number;
  turns: number;
  hpLost: number;
  haewons: number;
  haewonEligible: number;
  kills: number;
  escapes: number;
  jangdanSum: number;
  turnsCounted: number;
  respPlays: number;
  respEligible: number;
  cardPlays: number;
  downs: number;
  deaths: number;
  sameTurnDeaths: number;
  revives: number;
  collapses: number;
  executions: number;
  gangsin: number;
  dmgHero: Record<string, number>;
  dmgSlot: number[];
  dmgDealt: Record<string, number>;
}

export function newCombatAgg(): CombatAgg {
  return {
    n: 0, wins: 0, timeouts: 0, turns: 0, hpLost: 0, haewons: 0, haewonEligible: 0, kills: 0, escapes: 0, jangdanSum: 0, turnsCounted: 0,
    respPlays: 0, respEligible: 0, cardPlays: 0, downs: 0, deaths: 0, sameTurnDeaths: 0, revives: 0, collapses: 0, executions: 0, gangsin: 0,
    dmgHero: {}, dmgSlot: [0, 0, 0], dmgDealt: {},
  };
}

export interface CardAgg {
  plays: Record<string, number>;
  inDeck: Record<string, number>; // 전투 시작 덱에 있던 횟수(장 수 기준)
  offered: Record<string, number>;
  picked: Record<string, number>;
  cond: Record<string, [number, number]>;
  powerFires: Record<string, number>;
  special: Record<string, number>;
  enemy: Record<string, [number, number]>;
}

export function newCardAgg(): CardAgg {
  return { plays: {}, inDeck: {}, offered: {}, picked: {}, cond: {}, powerFires: {}, special: {}, enemy: {} };
}

function add(rec: Record<string, number>, k: string, v = 1): void {
  rec[k] = (rec[k] ?? 0) + v;
}

export function recordCombat(agg: CombatAgg, cards: CardAgg, s: CombatState, party: HeroId[], startHp: number[], timeout: boolean, deckIds: string[]): void {
  const st = s.stats!;
  agg.n++;
  if (s.outcome === 1) agg.wins++;
  if (timeout) agg.timeouts++;
  agg.turns += s.turn;
  let lost = 0;
  s.heroes.forEach((h, i) => {
    lost += Math.max(0, startHp[i] - (h.dead ? 0 : h.hp));
  });
  agg.hpLost += lost;
  agg.haewons += st.haewons;
  agg.haewonEligible += st.haewonEligible;
  agg.kills += st.kills;
  agg.escapes += st.escapes;
  agg.jangdanSum += st.jangdanTurnSum;
  agg.turnsCounted += st.turnsCounted;
  agg.respPlays += st.respPlays;
  agg.respEligible += st.respEligible;
  agg.cardPlays += st.cardPlays;
  agg.downs += st.downs;
  agg.deaths += st.deaths;
  agg.sameTurnDeaths += st.sameTurnDeaths;
  agg.revives += st.revives;
  agg.collapses += st.collapses;
  agg.executions += st.executions;
  agg.gangsin += st.gangsin;
  party.forEach((h, i) => {
    add(agg.dmgHero, h, st.dmgTakenHero[i]);
    add(agg.dmgDealt, h, st.heroDmgDealt[i]);
  });
  for (let i = 0; i < 3; i++) agg.dmgSlot[i] += st.dmgTakenSlot[i];
  for (const [k, v] of st.plays) add(cards.plays, k, v);
  for (const id of deckIds) add(cards.inDeck, id);
  for (const [k, v] of st.condEval) {
    const c = cards.cond[k] ?? [0, 0];
    c[0] += v[0];
    c[1] += v[1];
    cards.cond[k] = c;
  }
  for (const [k, v] of st.powerFires) add(cards.powerFires, k, v);
  for (const [k, v] of st.specialUse) add(cards.special, k, v);
  for (const [k, v] of st.enemyHaewon) {
    const c = cards.enemy[k] ?? [0, 0];
    c[0] += v[0];
    c[1] += v[1];
    cards.enemy[k] = c;
  }
}

export function mergeCombatAgg(a: CombatAgg, b: CombatAgg): CombatAgg {
  const out = newCombatAgg();
  for (const k of Object.keys(out) as (keyof CombatAgg)[]) {
    const va = a[k];
    const vb = b[k];
    if (typeof va === 'number' && typeof vb === 'number') (out[k] as number) = va + vb;
  }
  for (const src of [a, b]) {
    for (const [h, v] of Object.entries(src.dmgHero)) add(out.dmgHero, h, v);
    for (const [h, v] of Object.entries(src.dmgDealt)) add(out.dmgDealt, h, v);
    for (let i = 0; i < 3; i++) out.dmgSlot[i] += src.dmgSlot[i];
  }
  return out;
}

export function mergeCardAgg(into: CardAgg, b: CardAgg): void {
  for (const key of ['plays', 'inDeck', 'offered', 'picked', 'powerFires', 'special'] as const) {
    for (const [k, v] of Object.entries(b[key])) add(into[key], k, v);
  }
  for (const key of ['cond', 'enemy'] as const) {
    for (const [k, v] of Object.entries(b[key])) {
      const c = into[key][k] ?? [0, 0];
      c[0] += v[0];
      c[1] += v[1];
      into[key][k] = c;
    }
  }
}

export interface CombatMetrics {
  n: number;
  winRate: number;
  avgTurns: number;
  hpLost: number;
  haewonRate: number;
  jangdanPerTurn: number;
  respRate: number;
  downsPerCombat: number;
  deathsPerCombat: number;
  sameTurnDeathShare: number;
  revivesPerCombat: number;
  timeouts: number;
  dmgShareHero: Record<string, number>;
  dmgDealtShare: Record<string, number>;
  dmgShareSlot: number[];
  collapsesPerCombat: number;
  executionsPerCombat: number;
  gangsinPerCombat: number;
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;

export function metrics(a: CombatAgg): CombatMetrics {
  const totH = Object.values(a.dmgHero).reduce((x, y) => x + y, 0) || 1;
  const totS = a.dmgSlot.reduce((x, y) => x + y, 0) || 1;
  const share: Record<string, number> = {};
  for (const [h, v] of Object.entries(a.dmgHero)) share[h] = r3(v / totH);
  const totD = Object.values(a.dmgDealt).reduce((x, y) => x + y, 0) || 1;
  const dealt: Record<string, number> = {};
  for (const [h, v] of Object.entries(a.dmgDealt)) dealt[h] = r3(v / totD);
  return {
    n: a.n,
    winRate: r3(a.wins / Math.max(1, a.n)),
    avgTurns: r3(a.turns / Math.max(1, a.n)),
    hpLost: r3(a.hpLost / Math.max(1, a.n)),
    haewonRate: r3(a.haewons / Math.max(1, a.haewonEligible)),
    jangdanPerTurn: r3(a.jangdanSum / Math.max(1, a.turnsCounted)),
    respRate: r3(a.respPlays / Math.max(1, a.respEligible)),
    downsPerCombat: r3(a.downs / Math.max(1, a.n)),
    deathsPerCombat: r3(a.deaths / Math.max(1, a.n)),
    sameTurnDeathShare: r3(a.sameTurnDeaths / Math.max(1, a.deaths)),
    revivesPerCombat: r3(a.revives / Math.max(1, a.n)),
    timeouts: a.timeouts,
    dmgShareHero: share,
    dmgDealtShare: dealt,
    dmgShareSlot: a.dmgSlot.map((v) => r3(v / totS)),
    collapsesPerCombat: r3(a.collapses / Math.max(1, a.n)),
    executionsPerCombat: r3(a.executions / Math.max(1, a.n)),
    gangsinPerCombat: r3(a.gangsin / Math.max(1, a.n)),
  };
}

export function deckIdsOf(deck: { d: number }[]): string[] {
  const d = D();
  return deck.map((c) => d.cards[c.d].id);
}

export function allTrios(): HeroId[][] {
  const ids: HeroId[] = ['manshin', 'jaebi', 'posu', 'baksu', 'seungnyeo', 'beopsa', 'talggun', 'chasa'];
  const out: HeroId[][] = [];
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) for (let c = b + 1; c < ids.length; c++) out.push([ids[a], ids[b], ids[c]]);
  return out;
}
