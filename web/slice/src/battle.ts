// 슬라이스 전투: 실제 엔진(src/core)을 플레이어블(web/src/game/combat.ts)과 같은 순서로 부른다 — 규칙·데이터는 건드리지 않는다.
// 파티 승려 · 만신 · 포수(10-presentation §5.3), 1막 나루의 일반 전투 하나(e4)와 보스(b1 삯 못 받은 뱃사공).
// 화면은 엔진 상태를 "직전과 비교"해 연출 사건(Ev)을 뽑는다. 적 차례는 복제한 상태에서 원귀 하나씩 미리 돌려(같은 시드라 결과가 같다)
// 한 원귀씩 차례로 보여 준다. 미리 돌린 결과가 실제와 다르면 한꺼번에 보여 준다(안전장치).

import {
  aliveEnemies, cloneState, createCombat, endPlayerTurn, enemyTurn, killEnemy, playCard, standing, startPlayerTurn, TURN_CAP,
} from '../../../src/core/engine.ts';
import { executeIntent, intentTargets } from '../../../src/core/enemy.ts';
import { DEFAULT_RULES, type ActionChoice, type CombatState, type HeroId } from '../../../src/core/types.ts';
import { starterDeck } from '../../../src/sim/draft.ts';
import { D } from '../../src/game/content.ts';
import { artSpec } from '../../src/art/sketch.ts';

export type Kind = 'normal' | 'boss';
export const ENC: Record<Kind, string> = { normal: 'e4', boss: 'b1' };
export const PARTY: HeroId[] = ['seungnyeo', 'manshin', 'posu'];

export type Fate = 'haewon' | 'cheochi' | 'escape';

export type Ev =
  | { k: 'card'; owner: number; card: string; type: string; target: number; pose: string; resp: boolean }
  | { k: 'ehit'; uid: number; hp: number; block: number }
  | { k: 'estatus'; uid: number; label: string; n: number }
  | { k: 'eblock'; uid: number; n: number }
  | { k: 'fate'; uid: number; fate: Fate }
  | { k: 'hhit'; hi: number; hp: number; block: number }
  | { k: 'hblock'; hi: number; n: number }
  | { k: 'heal'; hi: number; n: number }
  | { k: 'stress'; hi: number; n: number }
  | { k: 'down'; hi: number }
  | { k: 'rise'; hi: number }
  | { k: 'dead'; hi: number }
  | { k: 'jangdan'; n: number; bat: [number, number] | null }
  | { k: 'summon'; owner: number }
  | { k: 'eact'; uid: number; kind: string; name: string; targets: number[]; all: boolean }
  | { k: 'turn'; turn: number }
  | { k: 'form' };

export interface Step {
  kind: 'card' | 'enemy' | 'tick';
  s: CombatState;
  ev: Ev[];
}

export interface Battle {
  kind: Kind;
  seed: number;
  s: CombatState;
}

export function newBattle(kind: Kind, seed = kind === 'boss' ? 7 : 5): Battle {
  const d = D();
  const enc = d.encounterById.get(ENC[kind]);
  if (!enc) throw new Error(`slice: no encounter ${ENC[kind]}`);
  const s = createCombat({
    party: PARTY.map((id) => ({ id })),
    deck: starterDeck(PARTY),
    encounter: enc,
    seed,
    record: true,
    log: true,
    // 뱃사공의 해원(노잣돈 3)을 시험할 수 있게 지전 3 — 보스 길 권장 보급과 같다
    jijeon: 3,
    rules: DEFAULT_RULES,
    provisions: { rice: 0, sul: 0, bujeok: 0, incense: 0 },
  });
  // 진형: 선두 승려 · 중열 만신 · 후열 포수 (플레이어블 startBattle 도 생성 뒤에 진형을 놓는다)
  s.formation = [0, 1, 2];
  return { kind, seed, s };
}

// ── 상태 비교 ─────────────────────────────────────────────────────────
interface ESnap { hp: number; block: number; alive: boolean; haewon: boolean; escaped: boolean; st: Record<string, number> }
interface Snap {
  heroes: { hp: number; block: number; downed: boolean; dead: boolean; stress: number }[];
  enemies: Map<number, ESnap>;
  jangdan: number;
  prev0: number;
  summons: number;
  form: string;
}

const ST_LABEL: Record<string, string> = { mark: '점지', bleed: '상흔', doom: '명부', shake: '넋흔들림', vuln: '취약', weak: '약화' };

function snap(s: CombatState): Snap {
  const enemies = new Map<number, ESnap>();
  for (const e of s.enemies) {
    enemies.set(e.uid, {
      hp: e.hp, block: e.block, alive: e.alive, haewon: e.haewon, escaped: e.escaped,
      st: { mark: e.mark, bleed: e.bleed, doom: e.doom, shake: e.shake, vuln: e.vuln, weak: e.weak },
    });
  }
  return {
    heroes: s.heroes.map((h) => ({ hp: h.hp, block: h.block, downed: h.downed, dead: h.dead, stress: h.stress })),
    enemies, jangdan: s.jangdan, prev0: s.prevOwners ? s.prevOwners[0] : -2, summons: s.summons.length, form: s.formation.join(','),
  };
}

function diff(a: Snap, b: Snap): Ev[] {
  const out: Ev[] = [];
  for (const [uid, e] of b.enemies) {
    const p = a.enemies.get(uid);
    if (!p) continue;
    const hpLost = Math.max(0, p.hp - Math.max(0, e.hp));
    const blockLost = Math.max(0, p.block - e.block);
    if (p.alive && (hpLost > 0 || (blockLost > 0 && !e.alive) || (hpLost === 0 && blockLost > 0))) out.push({ k: 'ehit', uid, hp: hpLost, block: blockLost });
    if (e.block > p.block) out.push({ k: 'eblock', uid, n: e.block - p.block });
    if (p.alive && e.alive) for (const key of Object.keys(ST_LABEL)) if (e.st[key] > p.st[key]) out.push({ k: 'estatus', uid, label: ST_LABEL[key], n: e.st[key] - p.st[key] });
    if (p.alive && !e.alive) out.push({ k: 'fate', uid, fate: e.escaped ? 'escape' : e.haewon ? 'haewon' : 'cheochi' });
  }
  b.heroes.forEach((h, i) => {
    const p = a.heroes[i];
    if (!p || p.dead) return;
    const lost = Math.max(0, p.hp - h.hp);
    const blk = Math.max(0, p.block - h.block);
    if (lost > 0 && !p.downed) out.push({ k: 'hhit', hi: i, hp: lost, block: blk });
    else if (blk > 0 && !p.downed && h.block < p.block) out.push({ k: 'hhit', hi: i, hp: 0, block: blk });
    if (h.block > p.block) out.push({ k: 'hblock', hi: i, n: h.block - p.block });
    if (h.hp > p.hp && !h.downed && !p.downed) out.push({ k: 'heal', hi: i, n: h.hp - p.hp });
    if (h.stress !== p.stress) out.push({ k: 'stress', hi: i, n: h.stress - p.stress });
    if (h.downed && !p.downed) out.push({ k: 'down', hi: i });
    if (!h.downed && p.downed && !h.dead) out.push({ k: 'rise', hi: i });
    if (h.dead && !p.dead) out.push({ k: 'dead', hi: i });
  });
  if (b.jangdan > a.jangdan) out.push({ k: 'jangdan', n: b.jangdan, bat: a.prev0 >= 0 && b.prev0 >= 0 && a.prev0 !== b.prev0 ? [a.prev0, b.prev0] : null });
  if (b.summons > a.summons) out.push({ k: 'summon', owner: -1 });
  if (a.form !== b.form) out.push({ k: 'form' });
  return out;
}

// ── 행동 ──────────────────────────────────────────────────────────────
export function poseOf(cardId: string): string {
  try {
    return artSpec(cardId).poses[0] || 'cast';
  } catch {
    return 'cast';
  }
}

/** 카드 한 장: 엔진 playCard 그대로 */
export function play(b: Battle, choice: ActionChoice, resp: boolean): Step[] {
  const s = b.s;
  const inst = s.hand[choice.hand];
  if (!inst) return [];
  const def = D().cards[inst.d];
  const pre = snap(s);
  const target = choice.enemy >= 0 && s.enemies[choice.enemy] ? s.enemies[choice.enemy].uid : -1;
  playCard(s, choice);
  const owner = inst.o >= 0 ? inst.o : s.lastOwner;
  const ev: Ev[] = [{ k: 'card', owner, card: def.id, type: def.type, target, pose: poseOf(def.id), resp }, ...diff(pre, snap(s))];
  for (const e of ev) if (e.k === 'summon') e.owner = owner;
  return [{ kind: 'card', s: cloneState(s), ev }];
}

/** 턴 종료 → 적 차례(한 원귀씩) → 다음 턴. 엔진 순서는 플레이어블 endTurn 과 같다 */
export function endTurn(b: Battle): Step[] {
  const s = b.s;
  if (s.outcome !== 0) return [];
  const steps: Step[] = [];
  let pre = snap(s);
  endPlayerTurn(s);
  steps.push({ kind: 'tick', s: cloneState(s), ev: diff(pre, snap(s)) });
  if (s.outcome !== 0) return steps;
  // 미리 돌리기: 복제 상태에서 enemyTurn 과 같은 순서로 원귀 하나씩
  const d = D();
  const sim = cloneState(s);
  const preEnemy = snap(s);
  const enemySteps: Step[] = [];
  let prev = snap(sim);
  for (const e of sim.enemies) if (e.alive) {
    e.block = 0;
    e.capLost = 0;
  }
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i];
    if (!e.alive || e.bleed <= 0) continue;
    e.hp -= e.bleed;
    e.bleed -= 1;
    if (e.hp <= 0) killEnemy(sim, i);
  }
  const bleedEv = diff(prev, snap(sim));
  if (bleedEv.length) enemySteps.push({ kind: 'tick', s: cloneState(sim), ev: bleedEv });
  prev = snap(sim);
  for (let i = 0; i < sim.enemies.length && sim.outcome === 0; i++) {
    const e = sim.enemies[i];
    if (!e.alive || e.intent < 0) continue;
    const it = d.enemies[e.def].intents[e.intent];
    const planned = e.cancelNext ? [] : intentTargets(sim, e, it, true).map(([hi]) => hi);
    executeIntent(sim, i);
    const cur = snap(sim);
    const ev = diff(prev, cur);
    const hit = ev.filter((x) => x.k === 'hhit' || x.k === 'down' || x.k === 'stress').map((x) => (x as { hi: number }).hi);
    const targets = [...new Set(hit.length ? hit : planned)];
    enemySteps.push({ kind: 'enemy', s: cloneState(sim), ev: [{ k: 'eact', uid: e.uid, kind: e.cancelNext ? 'cancel' : it.kind, name: it.name, targets, all: it.target === '전체' }, ...ev] });
    prev = cur;
  }
  enemyTurn(s);
  // 확인: 미리 돌린 결과와 실제가 같아야 한 원귀씩 보여 준다
  const same = sim.heroes.every((h, i) => h.hp === s.heroes[i].hp && h.downed === s.heroes[i].downed && h.dead === s.heroes[i].dead) &&
    sim.enemies.every((e, i) => e.hp === s.enemies[i].hp && e.alive === s.enemies[i].alive);
  if (same) steps.push(...enemySteps);
  else steps.push({ kind: 'enemy', s: cloneState(s), ev: [...s.enemies.filter((e) => e.alive).map((e) => ({ k: 'eact', uid: e.uid, kind: 'attack', name: '', targets: [], all: false }) as Ev), ...diff(preEnemy, snap(s))] });
  if (s.outcome !== 0) return steps;
  if (s.turn >= TURN_CAP) {
    s.outcome = -1;
    return steps;
  }
  pre = snap(s);
  startPlayerTurn(s);
  steps.push({ kind: 'tick', s: cloneState(s), ev: [{ k: 'turn', turn: s.turn }, ...diff(pre, snap(s))] });
  return steps;
}

export function livingEnemies(s: CombatState): number[] {
  return aliveEnemies(s);
}

export function standingHeroes(s: CombatState): number[] {
  return s.heroes.filter((h) => standing(h)).map((h) => h.idx);
}

/** 성능 시험·증거용 "바쁜 턴" 무대: 같은 전투(e4)에서 손패와 체력만 정해 둔다(규칙은 그대로, 카드는 엔진이 낸다).
 *  턴 1: 청배(굿상) · 조준 · 합장 → 적 차례(두 원귀가 친다) → 턴 2: 육환장 · 화승총 사격(허기진 넋 해원) · 방울 흔들기(물에 젖은 넋 처치) */
export function stageBusyTurn(b: Battle): void {
  const s = b.s;
  const d = D();
  const want = ['manshin.cheongbae', 'posu.jojun', 'seungnyeo.hapjang', 'seungnyeo.yukhwanjang', 'posu.hwaseungchong', 'manshin.bangul'];
  const all = [...s.hand, ...s.draw, ...s.discard].filter((c) => !d.special.offerings.has(c.d));
  const pick = (id: string) => {
    const i = all.findIndex((c) => d.cards[c.d].id === id);
    return all.splice(i, 1)[0];
  };
  const chosen = want.map(pick);
  s.hand = chosen.slice(0, 3);
  // 다음 턴에 뽑을 카드: 뽑을 더미 맨 위(엔진은 끝에서 뽑는다)
  s.draw = [...all, ...chosen.slice(3).reverse()];
  s.discard = [];
  const hungry = s.enemies.find((e) => d.enemies[e.def].id === 'heogijin_neok');
  const wet = s.enemies.find((e) => d.enemies[e.def].id === 'jeojeun_neok');
  if (hungry) hungry.hp = 10;
  if (wet) wet.hp = 4;
}

export const BUSY_SCRIPT: { turn: number; card: string; enemy?: string }[] = [
  { turn: 1, card: 'manshin.cheongbae' },
  { turn: 1, card: 'posu.jojun', enemy: 'heogijin_neok' },
  { turn: 1, card: 'seungnyeo.hapjang' },
  { turn: 2, card: 'seungnyeo.yukhwanjang', enemy: 'heogijin_neok' },
  { turn: 2, card: 'posu.hwaseungchong', enemy: 'heogijin_neok' },
  { turn: 2, card: 'manshin.bangul', enemy: 'jeojeun_neok' },
];
