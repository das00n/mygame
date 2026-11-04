// 원정(런) 상태 조작: 시작, 이동·넋등·정찰, 보급품, 귀기·씌임, 귀환·포기·결과.

import { rand } from '../../../src/core/rng.ts';
import type { CardInst, HeroId } from '../../../src/core/types.ts';
import { starterDeck } from '../../../src/sim/draft.ts';
import {
  AFTER_FIGHT_RECOVERY_MISSING, COMMISSION_BY_ID, D, ENEMY_EXTRA, bandOf, type CommissionId, type SupplyId,
} from './content.ts';
import { contentAt, corridorsOf, generateDungeon, neighbors, objective, otherEnd, samePos, shortestPath, stepCost, travelCost } from './dungeon.ts';
import type { AppState, PHero, Pos, ResultState, Run, RunStats } from './types.ts';

export const CODEX_KEY = 'jeoseunggut.codex.v1';

export function loadCodex(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(CODEX_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveCodex(ids: string[]): void {
  try {
    globalThis.localStorage?.setItem(CODEX_KEY, JSON.stringify(ids));
  } catch {
    /* 저장소가 없어도 게임은 돈다 */
  }
}

export function newStats(): RunStats {
  return {
    fights: 0, wins: 0, haewons: 0, haewonEligible: 0, kills: 0, escapes: 0, downs: 0, deaths: 0, revives: 0, plays: {}, cardsTaken: 0, cardsSkipped: 0,
    tilesWalked: 0, candlesUsed: 0, curios: 0, traps: 0, events: 0, camps: 0, hpLost: 0, startedAt: Date.now(), playMs: 0,
  };
}

export function bossFor(seed: number): string {
  const h = { rng: seed ^ 0x2545f491 };
  return rand(h) < 0.5 ? 'b1' : 'b2';
}

export interface NewRunOpts {
  seed: number;
  commission: CommissionId;
  party: HeroId[];
  formation: number[];
  supplies: Record<SupplyId, number>;
  gold: number;
  spent: number;
}

export function newRun(o: NewRunOpts): Run {
  const d = D();
  const c = COMMISSION_BY_ID.get(o.commission)!;
  const h = { rng: o.seed | 0 };
  const dungeon = generateDungeon(h, c);
  const heroes: PHero[] = o.party.map((id) => {
    const hp = d.heroes.get(id)!.hp;
    return { id, hp, baseMax: hp, stress: 0, injured: false, recovering: false, dead: false, downs: 0 };
  });
  const run: Run = {
    v: 1, seed: o.seed, rng: h.rng, commission: o.commission, bossEnc: o.commission === 'boss' ? bossFor(o.seed) : null,
    party: o.party.slice(), formation: o.formation.slice(), heroes, deck: starterDeck(o.party), supplies: { ...o.supplies }, gold: o.gold,
    goldSpent: o.spent, materials: 0, chiseong: 0, light: 100, relics: [], dungeon, pos: { kind: 'room', room: dungeon.entrance }, prevRoom: dungeon.entrance,
    next: { wounds: [] }, revealed: loadCodex(), bonds: {}, threshold: 0, noNightRaid: false, fightsSeen: 0, bags: { hard: [], elite: [], lastHard: null },
    pity: -0.05, daegamCounter: 0, stats: newStats(), log: [], ended: false,
  };
  if (run.bossEnc) {
    const b = dungeon.rooms[dungeon.boss];
    b.content = { k: 'boss', id: run.bossEnc };
  }
  logRun(run, `${c.place}에 들어섰다. 넋등이 환하다.`);
  return run;
}

export function logRun(run: Run, msg: string): void {
  run.log.push(msg);
  if (run.log.length > 80) run.log.splice(0, run.log.length - 80);
}

export function heroName(id: HeroId): string {
  return D().heroes.get(id)?.name ?? id;
}

export function aliveIdx(run: Run): number[] {
  return run.heroes.map((h, i) => (h.dead ? -1 : i)).filter((i) => i >= 0);
}

export function effMax(h: PHero): number {
  return h.injured ? Math.floor(h.baseMax * 0.8) : h.baseMax;
}

export function healHero(h: PHero, n: number): number {
  if (h.dead) return 0;
  const before = h.hp;
  h.hp = Math.min(effMax(h), h.hp + Math.max(0, Math.round(n)));
  return h.hp - before;
}

/** 탐험 중 귀기: 넋등 배율 적용, 임계치(50·100 + 헛굿 보너스)를 넘으면 그 영웅의 씌임 카드 */
export function addRunStress(run: Run, hi: number, n: number, useBand = true): void {
  const h = run.heroes[hi];
  if (!h || h.dead || n === 0) return;
  const mult = n > 0 && useBand ? bandOf(run.light).stress : 1;
  const amt = Math.round(n * mult);
  const old = h.stress;
  h.stress = Math.max(0, Math.min(100, old + amt));
  for (const th of [50 + run.threshold, 100]) {
    if (old < th && h.stress >= th) addCurse(run, hi);
  }
}

export function partyStress(run: Run, n: number): void {
  for (const i of aliveIdx(run)) addRunStress(run, i, n);
}

/** 씌임 카드 1장: 그 영웅의 동요(망설임·헛것·원망·두려움 중 무작위) */
export function addCurse(run: Run, hi?: number): string {
  const d = D();
  const alive = aliveIdx(run);
  const who = hi ?? alive[Math.floor(rand(run) * alive.length)];
  const cd = d.special.curses[Math.floor(rand(run) * d.special.curses.length)];
  run.deck.push({ d: cd, o: who, o2: -1, orig: -1, x: -1 });
  const msg = `${heroName(run.heroes[who].id)}에게 귀신이 붙었다 — 씌임 「${d.cards[cd].name}」`;
  logRun(run, msg);
  return msg;
}

export function isCurseCard(c: CardInst): boolean {
  const def = D().cards[c.d];
  return def.isCurse;
}

export function supplyUse(run: Run, id: SupplyId, n = 1): boolean {
  if ((run.supplies[id] ?? 0) < n) return false;
  run.supplies[id] -= n;
  return true;
}

// ── 이동 ─────────────────────────────────────────────────────────────
export function canStep(run: Run, to: Pos): boolean {
  return neighbors(run.dungeon, run.pos).some((p) => samePos(p, to));
}

export interface StepResult {
  scouted: boolean;
  respawn: boolean;
}

/** 한 걸음. 넋등을 쓰고 칸·방을 밝힌다. 내용 처리는 호출한 쪽(actions)이 한다 */
export function stepTo(run: Run, to: Pos): StepResult {
  const dg = run.dungeon;
  const cost = stepCost(dg, to);
  run.light = Math.max(0, run.light - cost);
  let scouted = false;
  let respawn = false;
  if (run.pos.kind === 'room') run.prevRoom = run.pos.room;
  if (to.kind === 'tile') {
    const t = dg.corridors[to.cor].tiles[to.i];
    if (!t.walked) {
      run.stats.tilesWalked++;
      t.walked = true;
    } else if (run.light <= 25 && rand(run) < 0.08) {
      // 재출현: 어두운 길목을 되짚으면 원귀가 다시 나온다 (카드 보상 없음)
      respawn = true;
    }
    t.known = true;
  } else {
    const r = dg.rooms[to.room];
    if (!r.visited) {
      r.visited = true;
      r.known = true;
      const p = 0.25 + bandOf(run.light).scout;
      if (rand(run) < p) {
        scoutAround(run, r.id);
        scouted = true;
      }
    }
  }
  run.pos = to;
  return { scouted, respawn };
}

export function scoutAround(run: Run, roomId: number): void {
  const dg = run.dungeon;
  for (const c of corridorsOf(dg, roomId)) {
    for (const t of c.tiles) t.known = true;
    dg.rooms[otherEnd(c, roomId)].known = true;
  }
}

/** 가까운 미답 방 n개(와 그 길목) 정찰 */
export function scoutRooms(run: Run, n: number): number {
  const dg = run.dungeon;
  let done = 0;
  for (let k = 0; k < n; k++) {
    const path = shortestPath(dg, run.pos, (p) => p.kind === 'room' && !dg.rooms[p.room].known, false, false);
    if (!path) break;
    for (const p of path) {
      if (p.kind === 'tile') dg.corridors[p.cor].tiles[p.i].known = true;
      else dg.rooms[p.room].known = true;
    }
    done++;
  }
  return done;
}

export function revealAllRooms(run: Run): void {
  for (const r of run.dungeon.rooms) r.known = true;
}

/** 장승 맨손: 지금 방에서 통로 두 개 거리까지 방 내용 공개 */
export function revealNear(run: Run, depth: number): void {
  const dg = run.dungeon;
  const start = run.pos.kind === 'room' ? run.pos.room : dg.corridors[run.pos.cor].a;
  let frontier = [start];
  const seen = new Set(frontier);
  for (let k = 0; k < depth; k++) {
    const next: number[] = [];
    for (const r of frontier) for (const c of corridorsOf(dg, r)) {
      const o = otherEnd(c, r);
      dg.rooms[o].known = true;
      if (!seen.has(o)) {
        seen.add(o);
        next.push(o);
      }
    }
    frontier = next;
  }
}

export function travel(run: Run, room: number): boolean {
  const cost = travelCost(run.dungeon, run.pos, room);
  if (cost === null) return false;
  if (run.pos.kind === 'room') run.prevRoom = run.pos.room;
  run.light = Math.max(0, run.light - cost);
  run.pos = { kind: 'room', room };
  return true;
}

export function currentContent(run: Run) {
  return contentAt(run.dungeon, run.pos);
}

// ── 해원록 ───────────────────────────────────────────────────────────
export function revealHaewon(run: Run, ids: string[]): string[] {
  const added: string[] = [];
  for (const id of ids) if (!run.revealed.includes(id)) {
    run.revealed.push(id);
    added.push(id);
  }
  if (added.length) saveCodex(run.revealed);
  return added;
}

export function revealRandomHaewon(run: Run, n: number): string[] {
  const pool = [...ENEMY_EXTRA.values()].filter((e) => e.haewon && !run.revealed.includes(e.id));
  const out: string[] = [];
  for (let k = 0; k < n && pool.length; k++) {
    const i = Math.floor(rand(run) * pool.length);
    out.push(pool[i].id);
    pool.splice(i, 1);
  }
  return revealHaewon(run, out);
}

export function bossEnemyIds(run: Run): string[] {
  if (!run.bossEnc) return [];
  return run.bossEnc === 'b1' ? ['sakkun'] : ['sangyeo'];
}

// ── 전투 사이 회복 (넋 수습) ─────────────────────────────────────────
export function afterFightRecovery(run: Run, endDowned: boolean[]): number {
  let total = 0;
  run.heroes.forEach((h, i) => {
    if (h.dead || endDowned[i]) return;
    const lost = effMax(h) - h.hp;
    total += healHero(h, lost * AFTER_FIGHT_RECOVERY_MISSING);
  });
  return total;
}

// ── 귀환·포기·결과 ───────────────────────────────────────────────────
export function canReturn(run: Run): boolean {
  return objective(run).met;
}

export function buildResult(app: AppState, success: boolean, reason: string): ResultState {
  const run = app.run!;
  run.ended = true;
  run.stats.playMs += Date.now() - (run.stats.startedAt || Date.now());
  run.stats.startedAt = Date.now();
  const dg = run.dungeon;
  return {
    success, reason, commission: run.commission, party: run.party.slice(), heroes: run.heroes.map((h) => ({ ...h })), stats: { ...run.stats, plays: { ...run.stats.plays } },
    gold: run.gold, materials: run.materials, chiseong: run.chiseong, roomsVisited: dg.rooms.filter((r) => r.visited).length, roomsTotal: dg.rooms.length,
    light: run.light, relics: run.relics.slice(), deckSize: run.deck.length,
  };
}

export function lightCostPreview(run: Run, to: Pos): number {
  return stepCost(run.dungeon, to);
}

export { travelCost };
