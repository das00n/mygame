// 연출: 엔진 상태를 그릴 때마다 직전 그림과 비교해 "무슨 일이 있었나"를 읽는다(엔진은 건드리지 않는다).
// 카드 내기(공격·기술) · 피격 · 받는소리(장단 +1) · 굿상 소환 · 해원/처치 · 적 차례의 돌격.
// 결과는 CSS 클래스(한 번 도는 animation)로 무대에 붙는다. 움직임 줄이기면 CSS 가 즉시 결과로 바꾼다.

import { useEffect, useReducer, useRef } from 'preact/hooks';
import type { CombatState } from '../../../../src/core/types.ts';
import { D } from '../../game/content.ts';
import { cue } from './audio.ts';

export type HeroFx = 'attack' | 'cast' | 'hit';
export type EnemyFx = 'hit' | 'lunge';

export interface CombatFx {
  seq: number;
  hero: Record<number, HeroFx>;
  enemy: Record<number, EnemyFx>; // uid
  /** 받는소리: 직전 주인 → 이번 주인 (영웅 idx) */
  bat: [number, number] | null;
  summon: boolean;
  drum: boolean;
  /** 이번에 쓰러진(해원·처치·달아남) 원귀 uid → 연출 끝나는 시각 */
  fates: Record<number, number>;
}

interface Snap {
  s: CombatState;
  turn: number;
  jangdan: number;
  prev0: number;
  plays: Map<string, number>;
  owner: number;
  heroes: { hp: number; downed: boolean }[];
  enemies: Map<number, { hp: number; alive: boolean; atk: boolean }>;
  summons: number;
}

const EMPTY: Omit<CombatFx, 'seq' | 'fates'> = { hero: {}, enemy: {}, bat: null, summon: false, drum: false };
const FX_MS = 900;
const FATE_MS = 1500;

function snap(s: CombatState): Snap {
  const d = D();
  const enemies = new Map<number, { hp: number; alive: boolean; atk: boolean }>();
  for (const e of s.enemies) {
    const it = e.alive && e.intent >= 0 ? d.enemies[e.def].intents[e.intent] : null;
    enemies.set(e.uid, { hp: e.hp, alive: e.alive, atk: !!it && !e.cancelNext && (it.kind === 'attack' || it.kind === 'attack_debuff') });
  }
  return {
    s, turn: s.turn, jangdan: s.jangdan, prev0: s.prevOwners ? s.prevOwners[0] : -2, plays: new Map(s.stats?.plays ?? []), owner: s.lastOwner,
    heroes: s.heroes.map((h) => ({ hp: h.hp, downed: h.downed })), enemies, summons: s.summons.length,
  };
}

function diff(a: Snap, b: Snap): (Omit<CombatFx, 'seq' | 'fates'> & { dead: number[] }) | null {
  if (a.s !== b.s) return null;
  const d = D();
  const out = { hero: {} as Record<number, HeroFx>, enemy: {} as Record<number, EnemyFx>, bat: null as [number, number] | null, summon: false, drum: false, dead: [] as number[] };
  let any = false;
  // 카드 내기: 낸 횟수가 는 카드 → 그 카드의 종류와 주인
  let played: string | null = null;
  for (const [id, n] of b.plays) if (n > (a.plays.get(id) ?? 0)) played = id;
  if (played) {
    const def = d.cardById.get(played);
    const o = b.owner;
    if (def && o >= 0 && b.s.heroes[o]) {
      out.hero[o] = def.type === '공격' ? 'attack' : 'cast';
      any = true;
    }
    cue('card');
  }
  if (b.jangdan > a.jangdan) {
    out.drum = true;
    any = true;
    if (a.prev0 >= 0 && b.prev0 >= 0 && a.prev0 !== b.prev0) out.bat = [a.prev0, b.prev0];
    cue('bat');
  }
  if (b.summons > a.summons) {
    out.summon = true;
    any = true;
  }
  const turned = b.turn > a.turn;
  for (const [uid, e] of b.enemies) {
    const p = a.enemies.get(uid);
    if (!p) continue;
    if (p.alive && !e.alive) {
      out.dead.push(uid);
      any = true;
      const en = b.s.enemies.find((x) => x.uid === uid);
      cue(en?.haewon ? 'haewon' : 'kill');
    } else if (turned && p.alive && p.atk) {
      out.enemy[uid] = 'lunge';
      any = true;
    } else if (e.alive && e.hp < p.hp) {
      out.enemy[uid] = 'hit';
      any = true;
    }
  }
  b.heroes.forEach((h, i) => {
    const p = a.heroes[i];
    if (!p) return;
    if (h.hp < p.hp && !out.hero[i]) {
      out.hero[i] = 'hit';
      any = true;
    }
    if (h.downed && !p.downed) cue('down');
  });
  if (turned) cue('turn');
  return any ? out : null;
}

/** 전투 화면이 그릴 때마다 부른다. 반환값은 지금 걸린 연출 */
export function useCombatFx(s: CombatState): CombatFx {
  const ref = useRef<{ snap: Snap | null; fx: Omit<CombatFx, 'seq' | 'fates'>; seq: number; until: number; fates: Record<number, number> }>({ snap: null, fx: EMPTY, seq: 0, until: 0, fates: {} });
  const [, force] = useReducer((x: number) => x + 1, 0);
  const r = ref.current;
  const cur = snap(s);
  const now = Date.now();
  if (r.snap) {
    const ev = diff(r.snap, cur);
    if (ev) {
      r.seq++;
      r.fx = { hero: ev.hero, enemy: ev.enemy, bat: ev.bat, summon: ev.summon, drum: ev.drum };
      r.until = now + FX_MS;
      for (const uid of ev.dead) r.fates[uid] = now + FATE_MS;
    }
  }
  if (!r.snap || r.snap.s !== s) r.fates = {};
  r.snap = cur;
  const lastFate = Math.max(0, ...Object.values(r.fates));
  const wake = Math.max(r.until, lastFate);
  useEffect(() => {
    const ms = wake - Date.now();
    if (ms <= 0) return;
    const t = setTimeout(force, ms + 30);
    return () => clearTimeout(t);
  }, [wake]);
  const live = r.until > now ? r.fx : EMPTY;
  const fates: Record<number, number> = {};
  for (const [k, v] of Object.entries(r.fates)) if (v > now) fates[Number(k)] = v;
  return { ...live, seq: r.seq, fates };
}

// ── 직전 전투 (보상 화면의 "뒤풀이": 마지막 일격의 해원/처치까지 보여 준다) ─────────────
export interface LastBattle {
  s: CombatState;
  region: number;
  variant: 'room' | 'boss' | 'gate';
}
let lastBattle: LastBattle | null = null;
export function rememberBattle(b: LastBattle): void {
  lastBattle = b;
}
export function recallBattle(): LastBattle | null {
  return lastBattle;
}
export function forgetBattle(): void {
  lastBattle = null;
}
