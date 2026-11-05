// DD식 저승길 생성 (탐험 §2·§3): 격자 위의 방, 길목 3칸 통로, 신장 트리 + 고리 통로, 입구, 수호 방, 보스 굴.

import { rand } from '../../../src/core/rng.ts';
import type { HasRng } from '../../../src/core/rng.ts';
import { ROOM_TABLE, TILE_TABLE, TILES_PER_CORRIDOR, regionContent, type Commission } from './content.ts';
import type { Content, Corridor, Dungeon, Pos, Room, Run, Tile } from './types.ts';

function ri(h: HasRng, lo: number, hi: number): number {
  return lo + Math.floor(rand(h) * (hi - lo + 1));
}
function pickW(h: HasRng, table: [string, number][]): string {
  const r = rand(h);
  let acc = 0;
  for (const [k, p] of table) {
    acc += p;
    if (r < acc) return k;
  }
  return table[table.length - 1][0];
}
function shuffleArr<T>(h: HasRng, a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(h) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** 보스 굴 앞 고정 방 (지역마다): 1 나룻배 · 2 서낭 앞 고사 자리 · 3 혼 부르는 등(최종이면 업경대 비추기) */
export function ferryEvent(region: number, final: boolean): string {
  if (region === 2) return 'seonang_gosa';
  if (region === 3) return final ? 'eopgyeong_bichugi' : 'hon_bureuneun_deung';
  return 'nanutbae';
}

export function generateDungeon(h: HasRng, c: Commission, region = 1, final = false): Dungeon {
  const RC = regionContent(region);
  const CURIOS = RC.curios;
  const EVENTS = RC.events;
  const TRAPS = RC.traps;
  const map = RC.region.map ?? {};
  // 지역 덫 비율(2지역 11%): 빈 칸에서 덜어 낸다
  const trapRate = map.trap_rate ?? TILE_TABLE.find(([k]) => k === 'trap')![1];
  const tileTable: [string, number][] = TILE_TABLE.map(([k, p]) => [k, k === 'trap' ? trapRate : k === 'empty' ? p - (trapRate - 0.08) : p]);
  const loops = Math.max(0, c.loops + (map.loops_bonus ?? 0));
  const [W, H] = c.grid;
  const nRooms = ri(h, c.rooms[0], c.rooms[1]);
  const isBoss = c.id === 'boss';
  const cells = new Map<string, number>(); // "x,y" → room id
  const rooms: Room[] = [];
  const edges: [number, number][] = [];
  const key = (x: number, y: number) => `${x},${y}`;
  const addRoom = (x: number, y: number, kind: Room['kind']): number => {
    const id = rooms.length;
    rooms.push({ id, x, y, kind, content: { k: 'empty' }, visited: false, known: false, camp: false, campUsed: false });
    cells.set(key(x, y), id);
    return id;
  };
  // 보스 길은 마지막 열을 보스 굴 자리로 남긴다
  const maxX = isBoss ? W - 2 : W - 1;
  const entrance = addRoom(0, Math.floor(H / 2), 'entrance');
  let guard = 0;
  while (rooms.length < nRooms && guard++ < 500) {
    // 강을 따라 길게: 오른쪽으로 갈수록 뽑힐 가중치가 크다 → 사슬형
    const cands: [number, number, number, number][] = [];
    for (const r of rooms) {
      for (const [dx, dy] of DIRS) {
        const nx = r.x + dx;
        const ny = r.y + dy;
        if (nx < 0 || ny < 0 || nx > maxX || ny >= H || cells.has(key(nx, ny))) continue;
        const w = 1 + (dx === 1 ? 1.6 : 0) + (dy !== 0 ? 0.4 : 0);
        cands.push([r.id, nx, ny, w]);
      }
    }
    if (!cands.length) break;
    const total = cands.reduce((a, x) => a + x[3], 0);
    let t = rand(h) * total;
    let pick = cands[cands.length - 1];
    for (const cd of cands) {
      if (t < cd[3]) {
        pick = cd;
        break;
      }
      t -= cd[3];
    }
    const id = addRoom(pick[1], pick[2], 'normal');
    edges.push([pick[0], id]);
  }
  const dist = () => {
    const adj = new Map<number, number[]>();
    for (const [a, b] of edges) {
      (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
      (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
    }
    const d = new Map<number, number>([[entrance, 0]]);
    const q = [entrance];
    while (q.length) {
      const x = q.shift()!;
      for (const y of adj.get(x) ?? []) if (!d.has(y)) {
        d.set(y, d.get(x)! + 1);
        q.push(y);
      }
    }
    return d;
  };
  // 고리 통로: 이웃한 방 사이에 아직 없는 길을 더한다
  const linked = (a: number, b: number) => edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const loopCands: [number, number][] = [];
  for (const r of rooms) for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
    const o = cells.get(key(r.x + dx, r.y + dy));
    if (o !== undefined && !linked(r.id, o)) loopCands.push([r.id, o]);
  }
  shuffleArr(h, loopCands);
  for (const e of loopCands.slice(0, loops)) edges.push(e);

  let boss = -1;
  let ferry = -1;
  if (isBoss) {
    // 보스 굴: 입구에서 가장 먼 방 중 오른쪽 끝에 붙은 방 옆
    const d = dist();
    let best = -1;
    let bestScore = -1;
    for (const r of rooms) {
      if (r.id === entrance || r.x !== maxX) continue;
      const sc = (d.get(r.id) ?? 0) * 10 + rand(h);
      if (sc > bestScore) {
        bestScore = sc;
        best = r.id;
      }
    }
    if (best < 0) {
      // 오른쪽 끝 열에 방이 없으면 가장 먼 방에서 오른쪽으로 이어 붙인다
      let far = entrance;
      for (const r of rooms) if ((d.get(r.id) ?? 0) > (d.get(far) ?? 0) || (r.x > rooms[far].x && (d.get(r.id) ?? 0) >= (d.get(far) ?? 0))) far = r.id;
      best = far;
    }
    ferry = best;
    rooms[ferry].kind = 'ferry';
    let by = rooms[ferry].y;
    let bx = rooms[ferry].x + 1;
    if (cells.has(key(bx, by))) {
      bx = W - 1;
    }
    boss = addRoom(bx, by, 'boss');
    edges.push([ferry, boss]);
  }

  // 수호 방(엘리트): 입구에서 2칸 이상 떨어진 보통 방
  const d = dist();
  const normals = rooms.filter((r) => r.kind === 'normal');
  const guardN = ri(h, c.guard[0], c.guard[1]);
  const guardCands = shuffleArr(h, normals.filter((r) => (d.get(r.id) ?? 0) >= 2));
  for (const r of guardCands.slice(0, guardN)) {
    r.kind = 'guard';
    r.content = { k: 'elite' };
  }
  // 방 내용
  const eventBag = shuffleArr(h, EVENTS.filter((e) => !e.fixed).map((e) => e.id));
  let curioBag: string[] = [];
  const nextCurio = () => {
    if (!curioBag.length) curioBag = shuffleArr(h, CURIOS.map((c) => c.id));
    return curioBag.pop()!;
  };
  for (const r of rooms) {
    if (r.kind === 'entrance') r.content = { k: 'entrance', done: true };
    else if (r.kind === 'boss') r.content = { k: 'boss' };
    else if (r.kind === 'ferry') r.content = { k: 'event', id: ferryEvent(region, final) };
    else if (r.kind === 'normal') {
      let k = pickW(h, ROOM_TABLE);
      if (k === 'event' && !eventBag.length) k = 'curio';
      if (k === 'battle') r.content = { k: 'battle' };
      else if (k === 'curio') r.content = { k: 'curio', id: nextCurio() };
      else if (k === 'event') r.content = { k: 'event', id: eventBag.pop()! };
      else r.content = { k: 'empty' };
    }
  }
  // 2지역: 손님 마당 — 마을 한가운데 마당(원정마다 1회 고정)
  if (region === 2) {
    const maxD0 = Math.max(...[...d.values()]);
    const mids = rooms.filter((r) => r.kind === 'normal').sort((a, b) => Math.abs((d.get(a.id) ?? 0) - maxD0 / 2) - Math.abs((d.get(b.id) ?? 0) - maxD0 / 2));
    if (mids[0]) mids[0].content = { k: 'event', id: 'sonnim_madang' };
  }
  // 3지역: 대문 방 — 입구에서 보스 굴 앞(보통 길이면 가장 먼 방)까지의 척추 위 보통 방에 고르게 (05-region3 §1 ⟨반복 3⟩). 난수를 쓰지 않는다
  const gateN = map.gate_rooms ?? 0;
  if (gateN > 0) {
    for (const r of spine(rooms, edges, entrance, ferry >= 0 ? ferry : farthest(rooms, d, entrance), gateN)) {
      r.content = { k: 'event', id: 'daemun_tonghaeng' };
      r.gate = true;
      r.known = true;
    }
  }
  // 길굿 터: 보통 길이는 가운데쯤 방 하나, 보스 길은 + 보스 굴 앞 방
  const campN = isBoss ? 1 : c.camps;
  if (campN > 0) {
    const maxD = Math.max(...[...d.values()]);
    const mid = rooms
      .filter((r) => (r.kind === 'normal' || r.kind === 'guard') && !r.gate)
      .map((r) => ({ r, sc: -Math.abs((d.get(r.id) ?? 0) - maxD / 2) + (r.kind === 'normal' ? 0.5 : 0) + rand(h) * 0.3 }))
      .sort((a, b) => b.sc - a.sc);
    for (const m of mid.slice(0, campN)) m.r.camp = true;
  }
  if (ferry >= 0) rooms[ferry].camp = true;

  // 통로
  const corridors: Corridor[] = edges.map(([a, b], id) => {
    const tiles: Tile[] = [];
    for (let i = 0; i < TILES_PER_CORRIDOR; i++) {
      let content: Content = { k: 'empty' };
      if (!(a === boss || b === boss)) {
        const k = pickW(h, tileTable);
        if (k === 'battle') content = { k: 'battle' };
        else if (k === 'curio') content = { k: 'curio', id: nextCurio() };
        else if (k === 'trap') content = { k: 'trap', id: TRAPS[Math.floor(rand(h) * TRAPS.length)].id };
      }
      tiles.push({ content, walked: false, known: false });
    }
    return { id, a, b, tiles };
  });
  rooms[entrance].visited = true;
  rooms[entrance].known = true;
  if (boss >= 0) rooms[boss].known = true; // 보스 굴은 처음부터 공개 (탐험 §1)
  if (ferry >= 0) rooms[ferry].known = true;
  return { w: W, h: H, rooms, corridors, entrance, boss, ferry };
}

/** 입구에서 가장 먼 방 (같으면 오른쪽) */
function farthest(rooms: Room[], d: Map<number, number>, entrance: number): number {
  let best = entrance;
  for (const r of rooms) {
    const dr = d.get(r.id) ?? 0;
    const db = d.get(best) ?? 0;
    if (dr > db || (dr === db && r.x > rooms[best].x)) best = r.id;
  }
  return best;
}

/** 대문 방 후보: 입구 → 끝 방 최단 경로 위의 보통 방 중 n개를 고르게 (손님 마당 같은 고정 방은 피한다) */
function spine(rooms: Room[], edges: [number, number][], from: number, to: number, n: number): Room[] {
  const adj = new Map<number, number[]>();
  for (const [a, b] of edges) {
    (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
    (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
  }
  const prev = new Map<number, number>([[from, -1]]);
  const q = [from];
  while (q.length) {
    const x = q.shift()!;
    for (const y of (adj.get(x) ?? []).slice().sort((p, r) => p - r)) if (!prev.has(y)) {
      prev.set(y, x);
      q.push(y);
    }
  }
  const path: number[] = [];
  for (let x = to; x >= 0 && prev.has(x); x = prev.get(x)!) path.unshift(x);
  const cands = path.map((id) => rooms[id]).filter((r) => r.kind === 'normal' && !(r.content.k === 'event' && r.content.id === 'sonnim_madang'));
  if (cands.length <= n) return cands;
  return Array.from({ length: n }, (_, k) => cands[Math.floor(((k + 0.5) * cands.length) / n)]);
}

// ── 조회 ──────────────────────────────────────────────────────────────
export function corridorsOf(dg: Dungeon, room: number): Corridor[] {
  return dg.corridors.filter((c) => c.a === room || c.b === room);
}

export function otherEnd(c: Corridor, room: number): number {
  return c.a === room ? c.b : c.a;
}

/** 방에서 통로로 들어설 때 첫 칸 index */
export function entryIndex(c: Corridor, room: number): number {
  return c.a === room ? 0 : c.tiles.length - 1;
}

export interface Step {
  pos: Pos;
}

/** 지금 자리에서 한 걸음에 갈 수 있는 곳 */
export function neighbors(dg: Dungeon, pos: Pos): Pos[] {
  if (pos.kind === 'room') {
    return corridorsOf(dg, pos.room).map((c) => ({ kind: 'tile', cor: c.id, i: entryIndex(c, pos.room) }) as Pos);
  }
  const c = dg.corridors[pos.cor];
  const out: Pos[] = [];
  out.push(pos.i === 0 ? { kind: 'room', room: c.a } : { kind: 'tile', cor: c.id, i: pos.i - 1 });
  out.push(pos.i === c.tiles.length - 1 ? { kind: 'room', room: c.b } : { kind: 'tile', cor: c.id, i: pos.i + 1 });
  return out;
}

export function samePos(a: Pos, b: Pos): boolean {
  if (a.kind === 'room' && b.kind === 'room') return a.room === b.room;
  if (a.kind === 'tile' && b.kind === 'tile') return a.cor === b.cor && a.i === b.i;
  return false;
}

export function posKey(p: Pos): string {
  return p.kind === 'room' ? `r${p.room}` : `t${p.cor}.${p.i}`;
}

/** 걸음 비용(넋등): 처음 밟는 칸 6, 지나온 칸 1, 방 0 */
export function stepCost(dg: Dungeon, p: Pos): number {
  if (p.kind === 'room') return 0;
  return dg.corridors[p.cor].tiles[p.i].walked ? 1 : 6;
}

/** 다익스트라: 비용 = 넋등. via: 지나온 칸만 쓸 것인가 */
export function shortestPath(dg: Dungeon, from: Pos, goal: (p: Pos) => boolean, walkedOnly = false, avoidBoss = true): Pos[] | null {
  const dist = new Map<string, number>();
  const prev = new Map<string, Pos | null>();
  const open: [number, Pos][] = [[0, from]];
  dist.set(posKey(from), 0);
  prev.set(posKey(from), null);
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]);
    const [dcur, cur] = open.shift()!;
    if (dcur > (dist.get(posKey(cur)) ?? Infinity)) continue;
    if (goal(cur) && !samePos(cur, from)) {
      const path: Pos[] = [];
      let p: Pos | null = cur;
      while (p && !samePos(p, from)) {
        path.unshift(p);
        p = prev.get(posKey(p)) ?? null;
      }
      return path;
    }
    for (const n of neighbors(dg, cur)) {
      if (walkedOnly && n.kind === 'tile' && !dg.corridors[n.cor].tiles[n.i].walked) continue;
      if (avoidBoss && n.kind === 'room' && n.room === dg.boss && !goal(n)) continue;
      const nd = dcur + stepCost(dg, n) + 0.01;
      if (nd < (dist.get(posKey(n)) ?? Infinity)) {
        dist.set(posKey(n), nd);
        prev.set(posKey(n), cur);
        open.push([nd, n]);
      }
    }
  }
  return null;
}

/** 지나온 길만으로 갈 수 있는 방문한 방까지의 거리(칸 수) */
export function travelCost(dg: Dungeon, from: Pos, room: number): number | null {
  const path = shortestPath(dg, from, (p) => p.kind === 'room' && p.room === room, true, false);
  if (!path) return null;
  return Math.max(1, path.filter((p) => p.kind === 'tile').length);
}

export function contentAt(dg: Dungeon, p: Pos): Content {
  return p.kind === 'room' ? dg.rooms[p.room].content : dg.corridors[p.cor].tiles[p.i].content;
}

// ── 의뢰 목표 ─────────────────────────────────────────────────────────
export interface Objective {
  label: string;
  progress: string;
  met: boolean;
}

export function objective(run: Run): Objective {
  const dg = run.dungeon;
  if (run.commission === 'short') {
    const total = dg.rooms.length;
    const need = Math.ceil(total * 0.75);
    const v = dg.rooms.filter((r) => r.visited).length;
    return { label: '길 밝히기', progress: `방 ${v}/${need}`, met: v >= need };
  }
  if (run.commission === 'normal') {
    const fights = dg.rooms.filter((r) => r.content.k === 'battle' || r.content.k === 'elite');
    const unknownCount = dg.rooms.filter((r) => !r.known && r.kind !== 'entrance').length;
    const done = fights.filter((r) => r.content.done).length;
    const knownLeft = fights.filter((r) => r.known && !r.content.done).length;
    const met = done === fights.length;
    return { label: '원귀 소탕', progress: `${done}/${fights.length}${unknownCount ? ` · 미답 방 ${unknownCount}` : ''}${knownLeft ? ` · 남은 원귀 ${knownLeft}` : ''}`, met };
  }
  const b = dg.rooms[dg.boss];
  return { label: '큰 원귀 해원', progress: b.content.done ? '완료' : '보스 굴', met: !!b.content.done };
}
