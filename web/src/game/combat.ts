// 전투 세션: 엔진(src/core)을 화면 흐름에 잇는다. 넋등(그늘·선제·기습·적 피해), 가호, 길굿 준비 효과를 전투 앞뒤에 건다.

import {
  addJangdan, addPersonal, aliveEnemies, canPlay, cloneState, collapsed, createCombat, drawCards, endPlayerTurn, enemyTurn, finishCombat,
  gainBlock, haewonSatisfied, playCard, standing, startPlayerTurn, TURN_CAP,
} from '../../../src/core/engine.ts';
import { enemyDamageMult, intentTargets, projectIncoming } from '../../../src/core/enemy.ts';
import { rand } from '../../../src/core/rng.ts';
import { DEFAULT_RULES, type ActionChoice, type CardInst, type CombatState, type Encounter, type HeroId } from '../../../src/core/types.ts';
import { enumerateActions, evaluate } from '../../../src/sim/bot.ts';
import { D, ENEMY_EXTRA, bandOf } from './content.ts';
import { addCurse, addRunStress, afterFightRecovery, aliveIdx, buildResult, effMax, heroName, logRun, revealHaewon } from './run.ts';
import type { AppState, BattleMeta, BattleSource, CombatSession, Run } from './types.ts';
import { makeReward } from './rewards.ts';

// ── 조합 ─────────────────────────────────────────────────────────────
export const CUSTOM_ENC: Record<string, Encounter> = {
  ev_play: { id: 'ev_play', tier: 'easy', enemies: ['japgwi', 'japgwi', 'japgwi'] },
  ev_escort: { id: 'ev_escort', tier: 'easy', enemies: ['japgwi', 'japgwi', 'japgwi'] },
  ev_heotgut: { id: 'ev_heotgut', tier: 'easy', enemies: ['japgwi', 'japgwi', 'japgwi', 'japgwi'] },
  ev_goksori: { id: 'ev_goksori', tier: 'easy', enemies: ['goksori_neok'] },
};

export function encounterById(id: string): Encounter {
  return CUSTOM_ENC[id] ?? D().encounterById.get(id)!;
}

function bagPick(run: Run, pool: string[], bag: string[], avoid: string | null): string {
  if (!bag.length) {
    bag.push(...pool);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rand(run) * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  let k = bag.length - 1;
  if (avoid && bag[k] === avoid && bag.length > 1) k = 0;
  return bag.splice(k, 1)[0];
}

/** 처음 마주치는 전투의 조합: 원정의 첫 2전투는 쉬움, 이후 어려움(같은 조합은 6종을 다 쓴 뒤에만, 연속 금지) */
export function rollEncounter(run: Run, kind: 'battle' | 'elite' | 'raid'): string {
  const d = D();
  const by = (t: string) => d.encounters.filter((e) => e.tier === t).map((e) => e.id);
  if (kind === 'elite') return bagPick(run, by('elite'), run.bags.elite, null);
  if (kind === 'battle' && run.fightsSeen < 2) {
    const easy = by('easy');
    return easy[Math.floor(rand(run) * easy.length)];
  }
  const id = bagPick(run, by('hard'), run.bags.hard, run.bags.lastHard);
  run.bags.lastHard = id;
  return id;
}

// ── 시작 ─────────────────────────────────────────────────────────────
export interface BattleOpts {
  enc: string;
  tier: BattleMeta['tier'];
  src: BattleSource;
  cardReward: boolean;
  special?: BattleMeta['special'];
}

export function energyBonus(run: Run): number {
  return run.relics.filter((r) => r === 'cheonsin' || r === 'samjichang' || r === 'daesin_bangul').length;
}

export function startBattle(app: AppState, o: BattleOpts): CombatSession {
  const run = app.run!;
  const d = D();
  const band = bandOf(run.light);
  const enc = encounterById(o.enc);
  // 기습·선제 (탐험 §4·§5)
  let ambushP = band.ambush;
  if (run.relics.includes('geumjul')) ambushP = Math.max(0, ambushP - 0.15);
  let start: BattleMeta['start'] = 'normal';
  const r = rand(run);
  if (run.next.ambush) start = 'ambush';
  else if (run.next.firstStrike) start = 'first';
  else if (r < ambushP) start = 'ambush';
  else if (r < ambushP + band.first) start = 'first';
  // 덱: 원정 덱 + 그늘(넋등) + 상처(덫). 전투 1회 새 상태 카드 상한 4
  const extra: CardInst[] = [];
  let shadows = band.shadow + (run.relics.includes('cheonsin') ? 1 : 0);
  for (let k = 0; k < shadows && extra.length < 4; k++) extra.push({ d: d.special.shadow, o: -1, o2: -1, orig: -1, x: -1 });
  shadows = extra.length;
  for (const hi of run.next.wounds) {
    if (extra.length >= 4) break;
    if (run.heroes[hi] && !run.heroes[hi].dead) extra.push({ d: d.special.wound, o: hi, o2: -1, orig: -1, x: -1 });
  }
  const threshold = run.threshold;
  const stressBefore = run.heroes.map((h) => h.stress);
  const s = createCombat({
    party: run.heroes.map((h) => ({
      id: h.id, hp: h.hp, maxHp: h.baseMax, stress: Math.max(0, h.stress - threshold), injured: h.injured, recovering: h.recovering, dead: h.dead,
    })),
    deck: [...run.deck, ...extra], encounter: enc, seed: (rand(run) * 4294967296) | 0, record: true, jijeon: run.supplies.jijeon, log: true,
    rules: { ...DEFAULT_RULES, enemyDmgMult: band.enemyDmg },
  });
  s.statusAdded = extra.length;
  // 진형: 신당에서 정한 기본 진형
  const alive = s.heroes.filter((h) => !h.dead).map((h) => h.idx);
  let form = run.formation.filter((i) => alive.includes(i));
  for (const i of alive) if (!form.includes(i)) form.push(i);
  if (run.next.shuffle) {
    for (let i = form.length - 1; i > 0; i--) {
      const j = Math.floor(rand(run) * (i + 1));
      [form[i], form[j]] = [form[j], form[i]];
    }
  }
  s.formation = form;
  // 선제 +2 · 기습당함 −2 (첫 턴 드로우)
  if (start === 'first') drawCards(s, 2);
  if (start === 'ambush') {
    for (let k = 0; k < 2; k++) {
      let i = s.hand.length - 1;
      while (i >= 0 && s.hand[i].d === d.special.offering) i--;
      if (i >= 0) s.draw.push(s.hand.splice(i, 1)[0]);
    }
  }
  if (run.next.drawBonus) drawCards(s, run.next.drawBonus);
  // 길굿·기물 준비 효과
  const idxOf = (id: HeroId) => s.heroes.findIndex((h) => h.id === id && standing(h));
  if (run.next.jangdan) addJangdan(s, run.next.jangdan);
  if (run.next.gunpowder && idxOf('posu') >= 0) addPersonal(s, idxOf('posu'), run.next.gunpowder);
  if (run.next.blade && idxOf('baksu') >= 0) addPersonal(s, idxOf('baksu'), 1);
  if (run.next.aura && idxOf('chasa') >= 0) addPersonal(s, idxOf('chasa'), run.next.aura);
  if (run.next.momju && idxOf('manshin') >= 0) {
    const sd = d.summonById.get('manshin.s_momju')!;
    s.summons.push({ s: sd.idx, left: sd.duration, owner: idxOf('manshin') });
  }
  if (run.next.talismans && idxOf('beopsa') >= 0) {
    const t = d.cardById.get('beopsa.t_hwabu')!;
    for (let k = 0; k < run.next.talismans; k++) if (s.hand.length < 10) s.hand.push({ d: t.idx, o: idxOf('beopsa'), o2: -1, orig: -1, x: -1 });
  }
  // 가호
  if (run.relics.includes('teoju') && s.formation.length) gainBlock(s, s.formation[0], 5);
  if (run.relics.includes('myeongdo')) {
    for (const h of s.heroes) if (standing(h) && h.id !== 'baksu' && h.id !== 'talggun') addPersonal(s, h.idx, 1);
  }
  s.energy += energyBonus(run);
  trimHand(run, s);
  const meta: BattleMeta = {
    enc: enc.id, tier: o.tier, src: o.src, cardReward: o.cardReward, special: o.special ?? 'none', start, shadows, enemyDmg: band.enemyDmg,
    hpBefore: run.heroes.map((h) => h.hp), stressBefore, threshold, fleeTries: 0, jeseokRun: 0, jeseokTurn: -1, sansinTurn: -1, log: [], seenDead: [],
    toasts: [], turnStartedAt: Date.now(),
  };
  run.next = { wounds: [] };
  const names = enc.enemies.map((id) => d.enemyById.get(id)?.name ?? id);
  meta.log.push(`— 전투: ${[...new Set(names)].join(' · ')}${start === 'first' ? ' (선제! 첫 턴 +2장)' : start === 'ambush' ? ' (기습당함! 첫 턴 −2장)' : ''}${shadows ? ` · 그늘 ${shadows}장` : ''}`);
  if (start !== 'normal') meta.toasts.push({ text: start === 'first' ? '선제! 첫 턴에 2장 더 뽑는다' : '기습당했다! 첫 턴에 2장 덜 뽑는다', tone: start === 'first' ? 'info' : 'bad' });
  pullEngineLog(s, meta);
  const cs: CombatSession = { s, meta };
  app.combat = cs;
  app.screen = 'combat';
  run.stats.fights++;
  return cs;
}

function trimHand(run: Run, s: CombatState): void {
  if (!run.relics.includes('daesin_bangul')) return;
  while (s.hand.length > 8) s.discard.push(s.hand.pop()!);
}

// ── 로그·알림 ───────────────────────────────────────────────────────
const HERO_ID_RE = /\b(manshin|jaebi|posu|baksu|seungnyeo|beopsa|talggun|chasa)\b/g;
let engineLogCursor = new WeakMap<CombatState, number>();

export function pullEngineLog(s: CombatState, meta: BattleMeta): void {
  if (!s.log) return;
  const from = engineLogCursor.get(s) ?? 0;
  for (let i = from; i < s.log.length; i++) {
    const line = s.log[i];
    if (line.includes('턴 시작:')) continue;
    meta.log.push(line.replace(/^\[T(\d+)\]\s*/, 'T$1 · ').replace(HERO_ID_RE, (m) => heroName(m as HeroId)));
  }
  engineLogCursor.set(s, s.log.length);
  if (meta.log.length > 160) meta.log.splice(0, meta.log.length - 160);
  // 엔진 로그는 계속 쌓이므로 비워 둔다 (저장 크기)
  if (s.log.length > 40) {
    s.log.splice(0, s.log.length);
    engineLogCursor.set(s, 0);
  }
}

export function resetLogCursor(): void {
  engineLogCursor = new WeakMap();
}

function noticeDeaths(app: AppState): void {
  const cs = app.combat!;
  const d = D();
  for (const e of cs.s.enemies) {
    if (e.alive || cs.meta.seenDead.includes(e.uid)) continue;
    cs.meta.seenDead.push(e.uid);
    const name = d.enemies[e.def].name;
    if (e.escaped) cs.meta.toasts.push({ text: `${name} — 달아났다`, tone: 'bad' });
    else if (e.haewon) cs.meta.toasts.push({ text: `${name} — 해원! 한이 풀려 떠난다 (서 있는 영웅 체력 +3)`, tone: 'haewon' });
    else if (d.enemies[e.def].haewon.kind !== 'none') cs.meta.toasts.push({ text: `${name} — 처치 (해원하지 못했다)`, tone: 'kill' });
    else cs.meta.toasts.push({ text: `${name} — 쓰러졌다`, tone: 'kill' });
  }
  if (cs.meta.toasts.length > 6) cs.meta.toasts.splice(0, cs.meta.toasts.length - 6);
}

// ── 카드 대상 ───────────────────────────────────────────────────────
export type TargetStep = 'enemy' | 'ally' | 'downed' | 'pair' | 'blockAlly';

function hasAllyOp(ops: import('../../../src/core/types.ts').Op[]): boolean {
  for (const op of ops) {
    if ((op.op === 'block' || op.op === 'heal') && op.to === 'ally') return true;
    if (op.op === 'cond' && hasAllyOp(op.then)) return true;
    if (op.op === 'per' && hasAllyOp(op.each)) return true;
  }
  return false;
}

/** 이 카드를 낼 때 사람이 골라야 하는 대상 (하나뿐이면 고르지 않는다) */
export function targetSteps(s: CombatState, inst: CardInst): TargetStep[] {
  const def = D().cards[inst.d];
  const steps: TargetStep[] = [];
  if (def.needsEnemy && aliveEnemies(s).length > 1) steps.push('enemy');
  const others = s.heroes.filter((h) => !h.dead && h.idx !== inst.o);
  if (def.allyChoice === 'ally' && others.length > 1) steps.push('ally');
  else if (def.allyChoice === 'downed' && s.heroes.filter((h) => h.downed).length > 1) steps.push('downed');
  else if (def.allyChoice === 'pair' && s.formation.length > 2) steps.push('pair');
  else if (def.allyChoice === 'none' && hasAllyOp(def.effects) && s.heroes.filter((h) => standing(h)).length > 1) steps.push('blockAlly');
  return steps;
}

/** 대상 자동 채우기 (고르지 않은 칸) */
export function completeChoice(s: CombatState, hand: number, partial: Partial<ActionChoice>): ActionChoice {
  const inst = s.hand[hand];
  const def = D().cards[inst.d];
  const al = aliveEnemies(s);
  const c: ActionChoice = { hand, enemy: -1, enemy2: -1, ally: -1, pair: null, ...partial };
  if (def.needsEnemy && c.enemy < 0 && al.length) c.enemy = al[0];
  if (def.needsEnemy2 && c.enemy >= 0 && c.enemy2 < 0) {
    let best = -1;
    for (const j of al) if (j !== c.enemy && (best < 0 || s.enemies[j].hp > s.enemies[best].hp)) best = j;
    c.enemy2 = best >= 0 ? best : c.enemy;
  }
  if (def.allyChoice === 'ally' && c.ally < 0) {
    const o = s.heroes.find((h) => !h.dead && h.idx !== inst.o);
    if (o) c.ally = o.idx;
  }
  if (def.allyChoice === 'downed' && c.ally < 0) {
    const o = s.heroes.find((h) => h.downed);
    if (o) c.ally = o.idx;
  }
  return c;
}

/** 이 카드가 지금 받는소리를 잇는가 (엔진 playCard 와 같은 판정) */
export function wouldRespond(s: CombatState, inst: CardInst): boolean {
  const prev = s.prevOwners;
  if (prev === null) return false;
  if (inst.o2 >= 0 || inst.o < 0) return true;
  return !prev.includes(inst.o);
}

// ── 행동 ─────────────────────────────────────────────────────────────
export function playChoice(app: AppState, choice: ActionChoice): void {
  const cs = app.combat!;
  const run = app.run!;
  const s = cs.s;
  const inst = s.hand[choice.hand];
  if (!inst || !canPlay(s, inst)) return;
  const resp = wouldRespond(s, inst);
  const before = s.jangdan;
  playCard(s, choice);
  // 제석의 가호: 받는소리가 3번 이어질 때마다 에너지 +1 (턴당 1회)
  if (run.relics.includes('jeseok')) {
    cs.meta.jeseokRun = resp ? cs.meta.jeseokRun + 1 : 0;
    if (cs.meta.jeseokRun >= 3 && cs.meta.jeseokTurn !== s.turn) {
      s.energy += 1;
      cs.meta.jeseokTurn = s.turn;
      cs.meta.log.push('제석의 가호: 받는소리 세 번 — 에너지 +1');
    }
  }
  // 산신의 가호: 장단이 처음 5가 되는 턴마다 1장
  if (run.relics.includes('sansin') && before < 5 && s.jangdan >= 5 && cs.meta.sansinTurn !== s.turn) {
    cs.meta.sansinTurn = s.turn;
    drawCards(s, 1);
    cs.meta.log.push('산신의 가호: 장단 5 — 1장 뽑기');
  }
  pullEngineLog(s, cs.meta);
  noticeDeaths(app);
  if (s.outcome !== 0) finishBattle(app);
}

export function endTurn(app: AppState): void {
  const cs = app.combat!;
  const run = app.run!;
  const s = cs.s;
  const d = D();
  if (s.outcome !== 0) return;
  endPlayerTurn(s);
  pullEngineLog(s, cs.meta);
  noticeDeaths(app);
  if (s.outcome !== 0) return finishBattle(app);
  // 적 차례: 의도 요약 → 실행 → 영웅 변화
  const pre = s.heroes.map((h) => ({ hp: h.hp, block: h.block, downed: h.downed, dead: h.dead }));
  const lines: string[] = [];
  for (let i = 0; i < s.enemies.length; i++) {
    const e = s.enemies[i];
    if (!e.alive || e.intent < 0) continue;
    const iv = intentView(s, i);
    lines.push(`${d.enemies[e.def].name}: ${iv.cancelled ? '붕괴 — 행동 취소' : `${iv.name}${iv.targetLabel ? ' → ' + iv.targetLabel : ''}`}`);
  }
  enemyTurn(s);
  for (const l of lines) cs.meta.log.push(`T${s.turn} 적 · ${l}`);
  const diffs: string[] = [];
  s.heroes.forEach((h, i) => {
    const p = pre[i];
    if (p.dead) return;
    const lost = p.downed ? 0 : Math.max(0, p.hp - h.hp);
    if (lost > 0) diffs.push(`${heroName(h.id)} −${lost}`);
  });
  if (diffs.length) cs.meta.log.push(`T${s.turn} 피해 · ${diffs.join(' · ')}`);
  pullEngineLog(s, cs.meta);
  noticeDeaths(app);
  if (s.outcome !== 0) return finishBattle(app);
  if (cs.meta.special === 'escort' && s.turn >= 3) {
    cs.meta.log.push('세 턴을 버텼다 — 잘못 끌려온 사람이 길을 찾아 떠난다');
    s.outcome = 1;
    return finishBattle(app);
  }
  if (s.turn >= TURN_CAP) {
    s.outcome = -1;
    return finishBattle(app);
  }
  s.nextEnergy += energyBonus(run);
  startPlayerTurn(s);
  trimHand(run, s);
  cs.meta.jeseokRun = 0;
  cs.meta.turnStartedAt = Date.now();
  pullEngineLog(s, cs.meta);
  noticeDeaths(app);
  if (s.outcome !== 0) finishBattle(app);
}

export function useCandleInCombat(app: AppState): boolean {
  const cs = app.combat!;
  const run = app.run!;
  if (run.supplies.candle <= 0) return false;
  run.supplies.candle--;
  run.stats.candlesUsed++;
  run.light = Math.min(100, run.light + 25);
  const d = D();
  const s = cs.s;
  const keep = s.hand.filter((c) => c.d !== d.special.shadow);
  const gone = s.hand.length - keep.length;
  for (const c of s.hand) if (c.d === d.special.shadow) s.exhaust.push(c);
  s.hand = keep;
  cs.meta.log.push(`촛불을 켰다 — 넋등 ${run.light}${gone ? `, 그늘 ${gone}장 소멸` : ''}`);
  return true;
}

export function canFlee(app: AppState): boolean {
  const cs = app.combat;
  return !!cs && cs.meta.tier !== 'boss' && cs.meta.special === 'none' && cs.s.outcome === 0;
}

export function fleeChance(app: AppState): number {
  return Math.min(0.95, 0.7 + 0.05 * (app.combat?.meta.fleeTries ?? 0));
}

/** 도주 (탐험 §12): 성공하면 직전 방으로, 파티 귀기 +25. 실패하면 이번 턴이 끝난다 */
export function tryFlee(app: AppState): boolean {
  const cs = app.combat!;
  const run = app.run!;
  const p = fleeChance(app);
  cs.meta.fleeTries++;
  if (rand(run) < p) {
    syncHeroes(app);
    for (const i of aliveIdx(run)) addRunStress(run, i, 25, false);
    run.pos = { kind: 'room', room: run.prevRoom };
    logRun(run, '전투에서 물러났다 — 파티 귀기 +25');
    app.combat = null;
    app.screen = 'map';
    app.toast = '물러났다. 원귀는 그 자리에 남아 있다.';
    return true;
  }
  cs.meta.log.push('도주 실패 — 원귀가 길을 막았다');
  endTurn(app);
  return false;
}

// ── 끝 ───────────────────────────────────────────────────────────────
/** 전투 상태 → 원정 상태 (체력·귀기·중상·죽음·씌임·지전) */
function syncHeroes(app: AppState): boolean[] {
  const cs = app.combat!;
  const run = app.run!;
  const s = cs.s;
  const d = D();
  const endDowned: boolean[] = [];
  s.heroes.forEach((h, i) => {
    const p = run.heroes[i];
    endDowned[i] = h.endDowned;
    if (p.dead) return;
    const passed = Math.max(0, cs.meta.stressBefore[i] - cs.meta.threshold);
    const gained = h.stress - passed;
    p.stress = Math.max(0, Math.min(100, cs.meta.stressBefore[i] + gained));
    if (gained > 0) {
      // 넋등 귀기 배율 (전투 중 귀기는 엔진이 배율 없이 처리 → 끝난 뒤 차이만큼 더한다)
      const extra = Math.round(gained * (bandOf(run.light).stress - 1));
      if (extra > 0) addRunStress(run, i, extra, false);
    }
    p.downs += h.downs;
    if (h.dead) {
      p.dead = true;
      p.hp = 0;
      run.stats.deaths++;
      run.deck = run.deck.map((c) => (c.o === i && c.o2 < 0 && c.d !== d.special.mourn ? { d: d.special.mourn, o: i, o2: -1, orig: c.d, x: -1 } : c));
      logRun(run, `${heroName(p.id)}이(가) 저승길에서 떠났다.`);
      return;
    }
    run.stats.hpLost += Math.max(0, p.hp - h.hp);
    p.hp = Math.max(0, h.hp);
    p.injured = h.injured;
    p.recovering = h.recovering;
  });
  for (const [hi, cd] of s.newCurses) {
    run.deck.push({ d: cd, o: hi, o2: -1, orig: -1, x: -1 });
    logRun(run, `${heroName(run.heroes[hi].id)}에게 귀신이 붙었다 — 「${d.cards[cd].name}」`);
  }
  run.supplies.jijeon = s.jijeon;
  const st = s.stats!;
  run.stats.downs += st.downs;
  run.stats.revives += st.revives;
  for (const [k, v] of st.plays) run.stats.plays[k] = (run.stats.plays[k] ?? 0) + v;
  return endDowned;
}

export function finishBattle(app: AppState): void {
  const cs = app.combat!;
  const run = app.run!;
  const s = cs.s;
  const d = D();
  if (cs.meta.special === 'play') return finishPlayFight(app);
  finishCombat(s);
  const win = s.outcome === 1;
  const st = s.stats!;
  run.stats.haewons += st.haewons;
  run.stats.haewonEligible += st.haewonEligible;
  run.stats.kills += st.kills;
  run.stats.escapes += st.escapes;
  // 해원록: 한 번 만난 원귀는 해원 조건이 기록된다
  revealHaewon(run, [...new Set(s.enemies.map((e) => d.enemies[e.def].id))].filter((id) => ENEMY_EXTRA.get(id)?.haewon));
  const endDowned = syncHeroes(app);
  if (!win) {
    // 전멸: 영웅마다 마지막 사망 판정(버틸 확률 50%)
    for (const h of run.heroes) {
      if (h.dead) continue;
      if (rand(run) >= 0.5) {
        h.dead = true;
        h.hp = 0;
        run.stats.deaths++;
      } else {
        h.injured = true;
        h.hp = Math.max(1, h.hp);
      }
    }
    app.result = buildResult(app, false, s.turn >= TURN_CAP ? '전투가 끝없이 길어졌다' : '파티가 모두 쓰러졌다');
    app.combat = null;
    app.screen = 'result';
    return;
  }
  run.stats.wins++;
  // 넋 수습: 서 있던 영웅은 잃은 체력의 40%
  const rec = afterFightRecovery(run, endDowned);
  // 해원 → 파티 귀기 −5 / 해원
  if (st.haewons) for (const i of aliveIdx(run)) addRunStress(run, i, -5 * st.haewons, false);
  // 엽전·재료
  const band = bandOf(run.light);
  let gold = 0;
  let mats = 0;
  let chiseong = 0;
  for (const e of s.enemies) {
    const ex = ENEMY_EXTRA.get(d.enemies[e.def].id);
    if (!ex) continue;
    if (e.escaped) {
      const stolen = Math.min(run.gold, 15);
      gold -= stolen;
      continue;
    }
    if (!e.dead || e.summoned) continue;
    const [lo, hi] = ex.drops.gold;
    gold += lo + Math.floor(rand(run) * (hi - lo + 1));
    if (ex.drops.material) mats += e.haewon ? 2 + (run.relics.includes('eophangari') ? 1 : 0) : 1;
    if (ex.drops.chiseong) chiseong += ex.drops.chiseong + (e.haewon ? 1 : 0);
  }
  if (gold > 0) gold = Math.round(gold * band.gold * (run.relics.includes('geollip') ? 1.2 : 1));
  if (run.relics.includes('daegam')) gold += 10;
  if (cs.meta.special === 'escort') chiseong += 1;
  run.gold = Math.max(0, run.gold + gold);
  run.materials += mats;
  run.chiseong += chiseong;
  // 내용 끝
  markDone(run, cs.meta.src);
  if (cs.meta.cardReward) run.fightsSeen++;
  const lines: string[] = [];
  if (rec > 0) lines.push(`넋 수습: 서 있던 영웅이 잃은 체력의 40%를 되찾았다 (+${rec})`);
  if (st.haewons) lines.push(`해원 ${st.haewons} — 파티 귀기 −${5 * st.haewons}, 재료 두 배`);
  if (chiseong) lines.push(`치성 +${chiseong}`);
  // 대감의 가호: 2전투마다 쌀 1 공물
  if (run.relics.includes('daegam')) {
    run.daegamCounter++;
    if (run.daegamCounter % 2 === 0) {
      if (run.supplies.rice > 0) {
        run.supplies.rice--;
        lines.push('대감에게 쌀 1을 공물로 바쳤다');
      } else {
        run.deck.push({ d: d.cardById.get('common.curse_daemun')!.idx, o: -1, o2: -1, orig: -1, x: -1 });
        lines.push('공물을 못 받은 대감이 서운해한다 — 씌임 「대문 흔들기」');
      }
    }
  }
  const reward = makeReward(app, cs.meta, gold, mats, lines);
  app.reward = reward;
  app.combat = null;
  app.screen = 'reward';
  logRun(run, `전투 승리 — 엽전 ${gold >= 0 ? '+' : ''}${gold}${st.haewons ? `, 해원 ${st.haewons}` : ''}`);
}

function markDone(run: Run, src: BattleSource): void {
  const dg = run.dungeon;
  if (src.k === 'room') dg.rooms[src.room].content.done = true;
  else if (src.k === 'tile') dg.corridors[src.cor].tiles[src.i].content.done = true;
}

/** 사자 검문 놀이 싸움: 잃은 체력은 되돌리고 그만큼 귀기로 (사망·중상 없음) */
function finishPlayFight(app: AppState): void {
  const cs = app.combat!;
  const run = app.run!;
  const s = cs.s;
  const win = s.outcome === 1;
  const st = s.stats!;
  for (const [k, v] of st.plays) run.stats.plays[k] = (run.stats.plays[k] ?? 0) + v;
  const lines: string[] = [];
  run.heroes.forEach((p, i) => {
    if (p.dead) return;
    const h = s.heroes[i];
    const lost = Math.max(0, cs.meta.hpBefore[i] - Math.max(0, h.hp));
    p.hp = cs.meta.hpBefore[i];
    if (lost) addRunStress(run, i, lost, false);
    if (lost) lines.push(`${heroName(p.id)}: 체력 대신 귀기 +${lost}`);
  });
  let gold = 0;
  if (win) {
    gold = 20;
    run.gold += gold;
    lines.unshift('놀이 싸움에서 이겼다 — 사자들이 껄껄 웃으며 길을 연다');
  } else {
    for (const i of aliveIdx(run)) addRunStress(run, i, 15, false);
    lines.unshift('놀이 싸움에 졌다 — 귀기 +15, 그래도 길은 열어 준다');
  }
  run.stats.wins += win ? 1 : 0;
  markDone(run, cs.meta.src);
  app.reward = {
    title: '사자 검문 — 놀이 싸움', gold, materials: 0, lines, cards: null, cardsTaken: true, flags: null, relics: null, relicPicked: true,
    rareCards: null, rarePicked: true, bossEnd: false,
  };
  app.combat = null;
  app.screen = 'reward';
}

// ── 화면용 조회 ─────────────────────────────────────────────────────
export interface IntentView {
  name: string;
  kind: string;
  icon: 'atk' | 'multi' | 'aoe' | 'def' | 'buff' | 'debuff' | 'stress' | 'pollute' | 'possess' | 'summon' | 'escape' | 'move' | 'cancel' | 'altar';
  targetSlot: string;
  targetLabel: string;
  per: number | null;
  hits: number;
  effect: string;
  cancelled: boolean;
}

const SLOT = ['선두', '중열', '후열'];

export function slotName(s: CombatState, hi: number): string {
  const i = s.formation.indexOf(hi);
  if (i < 0) return '';
  if (i === s.formation.length - 1 && s.formation.length > 1) return '후열';
  return SLOT[i];
}

export function intentView(s: CombatState, ei: number): IntentView {
  const d = D();
  const e = s.enemies[ei];
  const def = d.enemies[e.def];
  if (e.intent < 0) return { name: '', kind: '', icon: 'buff', targetSlot: '', targetLabel: '', per: null, hits: 0, effect: '', cancelled: false };
  const it = def.intents[e.intent];
  const mult = enemyDamageMult(s, e);
  const eff = it.effect ?? '';
  let per: number | null = null;
  let hits = it.hits ?? 1;
  if (it.damage && it.damage > 0) per = Math.floor((it.damage + e.atkBonus) * mult);
  let icon: IntentView['icon'] = 'atk';
  switch (it.kind) {
    case 'attack': icon = it.target === '전체' ? 'aoe' : hits > 1 ? 'multi' : 'atk'; break;
    case 'attack_debuff': icon = 'debuff'; break;
    case 'move': icon = 'move'; break;
    case 'buff': icon = 'buff'; break;
    case 'defend': icon = 'def'; break;
    case 'escape': icon = 'escape'; break;
    case 'pollute': icon = 'pollute'; break;
    case 'stress': icon = 'stress'; break;
    case 'possess': icon = 'possess'; break;
    case 'summon': icon = 'summon'; break;
  }
  let targetLabel = '';
  if (it.target === '굿상') {
    icon = 'altar';
    if (s.summons.length) targetLabel = '굿상 설치물 하나';
    else {
      const m = eff.match(/선두에게\s*(\d+)/);
      per = m ? Math.floor((Number(m[1]) + e.atkBonus) * mult) : per;
      hits = 1;
      const f = s.formation[0];
      targetLabel = f !== undefined ? `선두 ${heroName(s.heroes[f].id)}` : '선두';
    }
  } else if (['자신', '아군 원귀'].includes(it.target)) {
    targetLabel = it.target === '자신' ? '자신' : '아군 원귀';
  } else if (it.target === '전체') {
    targetLabel = '파티 전체';
  } else {
    const ts = intentTargets(s, e, it, true);
    if (ts.length === 1 && ts[0][1] === 1) targetLabel = `${it.target === '쓰러진 영웅' ? '쓰러진 ' : it.target + ' '}${heroName(s.heroes[ts[0][0]].id)}`;
    else targetLabel = it.target;
  }
  return { name: it.name, kind: it.kind, icon: e.cancelNext ? 'cancel' : icon, targetSlot: it.target, targetLabel, per, hits, effect: eff, cancelled: e.cancelNext };
}

export function incomingByHero(s: CombatState): number[] {
  return projectIncoming(s, null).dmg.map((x) => Math.round(x));
}

export function haewonView(run: Run, s: CombatState, ei: number): { known: boolean; text: string; ok: boolean; none: boolean } {
  const d = D();
  const e = s.enemies[ei];
  const def = d.enemies[e.def];
  if (def.haewon.kind === 'none') return { known: true, text: '', ok: false, none: true };
  const known = run.revealed.includes(def.id);
  return { known, text: known ? def.haewon.text : '해원 조건: 아직 모른다 (해원록에 없음)', ok: haewonSatisfied(s, e), none: false };
}

export { collapsed };

// ── 봇 (자동 진행) — src/sim/bot.ts playTurn 의 한 걸음 ─────────────
export function botChoice(s: CombatState): ActionChoice | null {
  const base = evaluate(s, false);
  let best: ActionChoice | null = null;
  let bestScore = base + 0.05;
  for (const a of enumerateActions(s)) {
    const c = cloneState(s);
    c.rng = (c.rng ^ 0x5bd1e995) | 0;
    playCard(c, a);
    const sc = evaluate(c);
    if (sc > bestScore) {
      bestScore = sc;
      best = a;
    }
  }
  return best;
}

export function partyHpLine(run: Run): string {
  return run.heroes.map((h) => `${heroName(h.id)} ${h.dead ? '†' : `${h.hp}/${effMax(h)}`}`).join(' · ');
}

export { addCurse };
