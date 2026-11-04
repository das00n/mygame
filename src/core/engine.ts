// 저승굿 전투 엔진 (헤드리스·결정적). docs/02-core-rules.md §1~§8·§13·§14 를 구현한다.
// 같은 시드 + 같은 선택 → 같은 결과. 상태 복제(cloneState)는 봇 lookahead 용으로 싸다.

import { loadData, PERSONAL_CAP } from './data.ts';
import { rand, shuffle } from './rng.ts';
import { chooseIntent, executeIntent, projectIncoming } from './enemy.ts';
import { DEFAULT_RULES } from './types.ts';
import type {
  ActionChoice, AutoTarget, CardDef, CardInst, CombatState, CombatStats, Cond, Encounter, EnemyState, HeroId, HeroState, Op,
  PowerInst, RuleVariant, Trigger,
} from './types.ts';

export const D = loadData;
export const HAND_MAX = 10;
export const DRAW_PER_TURN = 5;
export const ENERGY_PER_TURN = 3;
export const JANGDAN_MAX = 5;
export const SUMMON_MAX = 3;
export const STATUS_CARD_CAP = 4;
export const TURN_CAP = 60;
export const RESCUE_BASE = 3;
export const DEATH_SAVE_START = 0.65;
export const DEATH_SAVE_STEP = 0.1;
export const DEATH_SAVE_MIN = 0.25;

export function deathSaveChance(survived: number): number {
  return Math.max(DEATH_SAVE_MIN, DEATH_SAVE_START - DEATH_SAVE_STEP * survived);
}

export function endureOf(maxHp: number, frac = 0.35): number {
  return Math.min(40, Math.max(6, Math.round(maxHp * frac)));
}

// ── 전투 준비 ───────────────────────────────────────────────────────
export interface HeroSetup {
  id: HeroId;
  hp?: number;
  maxHp?: number; // 기본 최대 체력 (중상 반영 전)
  stress?: number;
  injured?: boolean;
  recovering?: boolean;
  dead?: boolean;
}

export interface CombatSetup {
  party: HeroSetup[];
  deck: CardInst[];
  encounter: Encounter;
  seed: number;
  record: boolean;
  jijeon?: number;
  log?: boolean;
  rules?: RuleVariant;
}

export function newStats(): CombatStats {
  return {
    plays: new Map(), condEval: new Map(), perCount: new Map(), powerFires: new Map(), specialUse: new Map(),
    dmgTakenHero: [0, 0, 0], dmgTakenSlot: [0, 0, 0], jangdanTurnSum: 0, turnsCounted: 0, respPlays: 0, respEligible: 0, cardPlays: 0,
    downs: 0, deaths: 0, sameTurnDeaths: 0, revives: 0, gangsin: 0, collapses: 0, executions: 0, kills: 0, haewons: 0, haewonEligible: 0, haewonHealed: 0, escapes: 0,
    enemyHaewon: new Map(), heroDmgDealt: [0, 0, 0],
  };
}

export function defaultFormation(heroes: HeroState[]): number[] {
  const d = D();
  const key = (h: HeroState) => {
    const def = d.heroes.get(h.id)!;
    return (def.role === '수호' ? 100 : 0) + (h.melee ? 50 : 0) + h.maxHp;
  };
  return heroes.filter((h) => !h.dead).sort((a, b) => key(b) - key(a)).map((h) => h.idx);
}

export function makeEnemy(s: CombatState, defIdx: number, hpOverride?: number): EnemyState {
  const def = D().enemies[defIdx];
  const hp = hpOverride ?? def.hpMin + Math.floor(rand(s) * (def.hpMax - def.hpMin + 1));
  return {
    def: defIdx, uid: s.nextUid++, hp, maxHp: hp, block: 0, vuln: 0, weak: 0, mark: 0, bleed: 0, doom: 0, shake: 0,
    endure: endureOf(hp, s.rules.endureFrac ?? 0.35), collapseUntil: -1, cancelNext: false, bound: false, atkBonus: 0, intent: -1, patIdx: 0, last: -1, lastRun: 0,
    phase: 0, turnsActed: 0, alive: true, dead: false, escaped: false, haewon: false, lastHitToken: false, summoned: false,
  };
}

export function createCombat(setup: CombatSetup): CombatState {
  const d = D();
  const heroes: HeroState[] = setup.party.map((p, idx) => {
    const def = d.heroes.get(p.id)!;
    const baseMax = p.maxHp ?? def.hp;
    const maxHp = p.injured ? Math.floor(baseMax * 0.8) : baseMax;
    return {
      id: p.id, idx, melee: def.range === 'melee', maxHp, hp: Math.min(maxHp, p.hp ?? maxHp), block: 0, downed: false, dead: !!p.dead,
      downs: 0, rescue: 0, rescueNeed: RESCUE_BASE, survived: 0, weak: 0, possess: 0, stress: p.stress ?? 0, personal: 0,
      personalCap: PERSONAL_CAP[p.id], stance: false, recovering: !!p.recovering, injured: !!p.injured, cover: -1, downTurn: -1, endDowned: false,
    };
  });
  const s: CombatState = {
    rng: setup.seed | 0, rules: setup.rules ?? DEFAULT_RULES, turn: 0, heroes, formation: [], enemies: [], nextUid: 1, draw: [], hand: [], discard: [], exhaust: [], powerZone: [],
    energy: 0, nextEnergy: 0, jangdan: 0, prevOwners: null, tokensPlayed: 0, formChanges: 0, talChanges: 0, summons: [], powers: [],
    gangsin: false, gangsinExtra: 0, baraji: 0, talAll: false, garakLocked: false, seokja: false, ajik: false, holdFront: -1,
    statusAdded: 0, offeringPaid: false, groupHaewon: [], jijeon: setup.jijeon ?? 3, deferredTokens: [], outcome: 0, lastDrawn: null,
    stats: setup.record ? newStats() : null, newCurses: [], log: setup.log ? [] : null,
  };
  s.formation = defaultFormation(heroes);
  for (const id of setup.encounter.enemies) {
    const ed = d.enemyById.get(id);
    if (!ed) throw new Error(`unknown enemy ${id}`);
    s.enemies.push(makeEnemy(s, ed.idx));
  }
  // 덱: 죽은 영웅의 카드는 이미 곡으로 바뀌어 있어야 한다
  s.draw = setup.deck.slice();
  shuffle(s, s.draw);
  const innate = s.draw.filter((c) => d.cards[c.d].innate);
  if (innate.length) s.draw = [...s.draw.filter((c) => !d.cards[c.d].innate), ...innate];
  // 보스 공물 행동: 뱃사공 → 손에 '노잣돈 바치기'
  if (s.enemies.some((e) => d.enemies[e.def].passives.some((p) => p.includes('노잣돈')))) {
    s.hand.push({ d: d.special.offering, o: -1, o2: -1, orig: -1, x: -1 });
  }
  startPlayerTurn(s);
  return s;
}

export function cloneState(s: CombatState): CombatState {
  return {
    ...s,
    heroes: s.heroes.map((h) => ({ ...h })),
    formation: s.formation.slice(),
    enemies: s.enemies.map((e) => ({ ...e })),
    draw: s.draw.slice(),
    hand: s.hand.slice(),
    discard: s.discard.slice(),
    exhaust: s.exhaust.slice(),
    powerZone: s.powerZone.slice(),
    summons: s.summons.map((x) => ({ ...x })),
    powers: s.powers.map((p) => ({ ...p })),
    deferredTokens: s.deferredTokens.slice(),
    newCurses: s.newCurses.slice(),
    stats: null,
    log: null,
  };
}

function log(s: CombatState, msg: string): void {
  if (s.log) s.log.push(`[T${s.turn}] ${msg}`);
}

// ── 조회 도우미 ─────────────────────────────────────────────────────
export function heroOf(s: CombatState, id: HeroId): HeroState | null {
  for (const h of s.heroes) if (h.id === id) return h;
  return null;
}
export function standing(h: HeroState): boolean {
  return !h.dead && !h.downed;
}
export function slotOf(s: CombatState, hi: number): number {
  return s.formation.indexOf(hi);
}
export function collapsed(s: CombatState, e: EnemyState): boolean {
  return s.turn <= e.collapseUntil;
}
export function aliveEnemies(s: CombatState): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.enemies.length; i++) if (s.enemies[i].alive) out.push(i);
  return out;
}
function standingHeroes(s: CombatState): HeroState[] {
  return s.heroes.filter(standing);
}
function ownersOf(inst: CardInst): number[] {
  if (inst.o < 0) return [-1];
  return inst.o2 >= 0 ? [inst.o, inst.o2] : [inst.o];
}

function bump(m: Map<string, number>, k: string, n = 1): void {
  m.set(k, (m.get(k) ?? 0) + n);
}

// ── 실행 문맥 ───────────────────────────────────────────────────────
export interface Ctx {
  card: CardDef | null;
  inst: CardInst | null;
  owner: number;
  owners: number[];
  target: number;
  target2: number;
  ally: number;
  pair: [number, number] | null;
  ownerSlot: number;
  talSlot: number;
  resp: boolean;
  respTimes: number;
  prevManshin: boolean;
  consumed: Record<string, number>;
  isToken: boolean;
  fromPower: boolean;
  summonCtx: boolean;
  allOverride: number;
  attacker: number;
  markedAtPlay: boolean[] | null;
  autoTarget: AutoTarget;
  lastSummon: number;
  shadowCtx: boolean;
}

function baseCtx(owner: number, owners: number[], card: CardDef | null): Ctx {
  return {
    card, inst: null, owner, owners, target: -1, target2: -1, ally: -1, pair: null, ownerSlot: -1, talSlot: -1, resp: false, respTimes: 0,
    prevManshin: false, consumed: {}, isToken: false, fromPower: false, summonCtx: false, allOverride: -1, attacker: -1,
    markedAtPlay: null, autoTarget: 'front', lastSummon: -1, shadowCtx: false,
  };
}

// ── 턴 진행 ─────────────────────────────────────────────────────────
export function startPlayerTurn(s: CombatState): void {
  const d = D();
  s.turn += 1;
  for (const h of s.heroes) {
    h.block = 0;
    h.cover = -1;
  }
  s.formChanges = 0;
  s.talChanges = 0;
  s.tokensPlayed = 0;
  s.prevOwners = null;
  s.gangsin = false;
  s.gangsinExtra = 0;
  s.baraji = 0;
  s.talAll = false;
  s.holdFront = -1;
  s.powers = s.powers.filter((p) => !p.temp);
  s.energy = ENERGY_PER_TURN + s.nextEnergy;
  s.nextEnergy = 0;
  for (const e of s.enemies) if (e.alive) chooseIntent(s, e);
  if (s.deferredTokens.length) {
    const list = s.deferredTokens;
    s.deferredTokens = [];
    for (const packed of list) addTokenCard(s, packed & 0xffff, ((packed >> 16) & 0xff) - 1, ((packed >> 24) & 0xff) - 1, -1);
  }
  drawCards(s, DRAW_PER_TURN);
  // 경면주사: 매 턴 시작 시 +1
  const beopsa = heroOf(s, 'beopsa');
  if (beopsa && standing(beopsa)) beopsa.personal = Math.min(beopsa.personalCap, beopsa.personal + 1);
  firePowers(s, 'turn_start', -1);
  fireSummons(s, 'turn_start');
  log(s, `턴 시작: 에너지 ${s.energy}, 손 ${s.hand.map((c) => d.cards[c.d].name).join(',')}`);
}

export function endPlayerTurn(s: CombatState): void {
  if (s.outcome !== 0) return;
  const d = D();
  firePowers(s, 'turn_end', -1);
  // 알 수 없는 트리거의 능력: 턴 종료에 min(1, expect/3.5) 확률로 (현재 데이터에는 없음)
  for (const p of s.powers.filter((x) => x.trigger === 'unknown')) {
    if (powerActive(s, p) && rand(s) < Math.min(1, (p.op.expect ?? 3.5) / 3.5)) runPower(s, p, -1, null);
  }
  fireSummons(s, 'turn_end');
  if (s.gangsin && s.summons.length) {
    // 강신: 굿상의 신령 하나(+ 무복 갈아입기로 하나 더)를 몸에 실어 이번 턴 능력 두 배 → 턴 종료에 한 번 더 발동
    const order = s.summons.map((x, i) => i).sort((a, b) => d.summons[s.summons[b].s].value - d.summons[s.summons[a].s].value);
    for (let k = 0; k < Math.min(order.length, 1 + s.gangsinExtra); k++) {
      const inst = s.summons[order[k]];
      if (inst) runSummon(s, inst);
    }
  }
  if (s.outcome !== 0) return;
  // 작두: 장단 2 미만으로 턴을 마치면 헛디뎌 내려서고 체력 6을 잃는다
  const baksu = heroOf(s, 'baksu');
  if (baksu && standing(baksu) && baksu.stance) {
    const fall = s.jangdan < 2;
    recordCond(s, bladeFallKey(), fall);
    if (fall) {
      baksu.stance = false;
      loseHp(s, baksu.idx, 6);
      log(s, '작두박수 헛디딤');
    }
  }
  // 명부 판정
  for (let i = 0; i < s.enemies.length; i++) {
    const e = s.enemies[i];
    if (!e.alive || e.doom <= 0) continue;
    const threshold = s.seokja && e.bound ? Math.ceil(e.hp / 2) : e.hp;
    if (e.doom >= threshold) {
      if (s.stats) s.stats.executions++;
      log(s, `명부 처형: ${d.enemies[e.def].name}`);
      killEnemy(s, i);
    }
  }
  // 손패 정리 (손에 든 채 턴을 마치는 저주 효과 → 휘발 소멸 → 버림)
  const keep: CardInst[] = [];
  for (const c of s.hand) {
    const def = d.cards[c.d];
    for (const op of def.effects) {
      if (op.op === 'stress' && op.when === 'hand_turn_end') {
        if (op.to === 'owner' && c.o >= 0) addStress(s, c.o, op.n);
        else for (const h of s.heroes) if (!h.dead) addStress(s, h.idx, op.n);
      }
      if (op.op === 'move' && op.when === 'hand_turn_end' && c.o >= 0 && standing(s.heroes[c.o])) moveToBack(s, c.o);
    }
    if (def.retain) keep.push(c);
    else if (def.ethereal) s.exhaust.push(c);
    else s.discard.push(c);
  }
  s.hand = keep;
  if (s.stats) {
    s.stats.jangdanTurnSum += s.jangdan;
    s.stats.turnsCounted++;
  }
  s.jangdan = 0;
  const jaebi = heroOf(s, 'jaebi');
  if (jaebi && !s.garakLocked) jaebi.personal = Math.max(0, jaebi.personal - 1);
  for (const h of s.heroes) if (h.weak > 0) h.weak--;
  // "이번 턴" 임시 트리거 정리 (피격 반응은 적 턴까지 남긴다)
  s.powers = s.powers.filter((p) => !p.temp || p.trigger === 'on_hit');
  checkOutcome(s);
}

export function enemyTurn(s: CombatState): void {
  if (s.outcome !== 0) return;
  for (const e of s.enemies) if (e.alive) e.block = 0;
  // 상흔: 적 턴 시작 시 상흔만큼 체력을 잃고 1 감소 (방어도 무시)
  for (let i = 0; i < s.enemies.length; i++) {
    const e = s.enemies[i];
    if (!e.alive || e.bleed <= 0) continue;
    e.hp -= e.bleed;
    e.bleed -= 1;
    if (e.hp <= 0) killEnemy(s, i);
  }
  if (s.outcome !== 0) return;
  for (let i = 0; i < s.enemies.length; i++) {
    if (s.outcome !== 0) return;
    if (!s.enemies[i].alive) continue;
    executeIntent(s, i);
  }
  for (const e of s.enemies) {
    if (!e.alive) continue;
    if (e.vuln > 0) e.vuln--;
    if (e.weak > 0) e.weak--;
    e.intent = -1;
  }
  checkOutcome(s);
}

export function checkOutcome(s: CombatState): void {
  if (s.outcome !== 0) return;
  if (!s.enemies.some((e) => e.alive)) {
    s.outcome = 1;
    return;
  }
  if (!s.heroes.some(standing)) s.outcome = -1;
}

/** 전투 종료 처리: 이겼는데 쓰러져 있으면 체력 1 + 중상 */
export function finishCombat(s: CombatState): void {
  if (s.outcome !== 1) return;
  for (const h of s.heroes) {
    h.endDowned = h.downed;
    if (h.downed) {
      h.downed = false;
      h.hp = 1;
      h.injured = true;
    }
  }
}

// ── 카드 사용 ───────────────────────────────────────────────────────
let bladeKey = '';
function bladeFallKey(): string {
  if (!bladeKey) {
    const jakdu = D().cardById.get('baksu.jakdu')!;
    const op = jakdu.effects.find((o) => o.op === 'cond' && o.cond.k === 'blade_fall');
    bladeKey = op && op.op === 'cond' ? op.key : 'baksu.jakdu#fall';
  }
  return bladeKey;
}

let heotgeot = -1;
function heotgeotIdx(): number {
  if (heotgeot < 0) heotgeot = D().cardById.get('common.curse_heotgeot')!.idx;
  return heotgeot;
}

export function canPlay(s: CombatState, inst: CardInst): boolean {
  if (s.outcome !== 0) return false;
  const def = D().cards[inst.d];
  if (def.unplayable) return false;
  if (def.cost > s.energy) return false;
  if (def.requireGangsin && !s.gangsin) return false;
  const sp = D().special;
  if (inst.d === sp.offering && s.jijeon < 3) return false;
  if (inst.d === sp.rescue || inst.d === sp.mourn) return true;
  if (inst.o >= 0 && !standing(s.heroes[inst.o])) return false;
  if (inst.o2 >= 0 && !standing(s.heroes[inst.o2])) return false;
  return true;
}

export function playCard(s: CombatState, choice: ActionChoice): void {
  const d = D();
  const inst = s.hand[choice.hand];
  if (!inst || !canPlay(s, inst)) throw new Error('illegal play');
  const def = d.cards[inst.d];
  s.hand.splice(choice.hand, 1);
  s.energy -= def.cost;
  const owners = ownersOf(inst);
  const owner = owners[0];

  // 받는소리 / 장단
  const prev = s.prevOwners;
  // 합기·파티 카드는 항상 "다른 주인". 합기 다음 카드는 그 두 주인 중 누구의 카드든 성립하지 않는다
  let resp = false;
  if (prev !== null) {
    if (inst.o2 >= 0 || owners[0] === -1) resp = true;
    else resp = !prev.includes(owners[0]);
  }
  if (s.stats) {
    s.stats.cardPlays++;
    if (prev !== null) s.stats.respEligible++;
    if (resp) s.stats.respPlays++;
    bump(s.stats.plays, def.id);
  }
  const ctx = baseCtx(owner, owners, def);
  ctx.inst = inst;
  ctx.target = choice.enemy;
  ctx.target2 = choice.enemy2;
  ctx.ally = choice.ally;
  ctx.pair = choice.pair;
  ctx.isToken = def.isToken;
  ctx.resp = resp;
  ctx.ownerSlot = owner >= 0 ? slotOf(s, owner) : -1;
  const talggun = heroOf(s, 'talggun');
  ctx.talSlot = talggun ? slotOf(s, talggun.idx) : -1;
  ctx.markedAtPlay = s.enemies.map((e) => e.mark > 0);
  const manshin = heroOf(s, 'manshin');
  ctx.prevManshin = !!manshin && prev !== null && prev.length === 1 && prev[0] === manshin.idx;
  if (resp) {
    addJangdan(s, 1);
    const jaebi = heroOf(s, 'jaebi');
    ctx.respTimes = 1 + (jaebi && jaebi.personal >= 2 ? 1 : 0);
  }
  // 바라지: 다음에 쓰는 다른 영웅 카드의 받는소리 효과가 한 번 더
  const jaebiH = heroOf(s, 'jaebi');
  if (s.baraji > 0 && owner >= 0 && (!jaebiH || !owners.includes(jaebiH.idx))) {
    if (resp) ctx.respTimes += s.baraji;
    s.baraji = 0;
  }
  // 헛것(씌임): 손에 있는 동안 주인의 공격은 무작위 적에게
  if (def.isAttack && owner >= 0 && s.hand.some((c) => c.o === owner && c.d === heotgeotIdx())) {
    const al = aliveEnemies(s);
    if (al.length) ctx.target = al[Math.floor(rand(s) * al.length)];
  }
  s.prevOwners = owners;
  // 신바람 (v0.4): 만신 카드를 낼 때마다 +1, 직전 카드도 만신 카드면 +1 더. (v0.1: 연달아 낼 때만 +1)
  if (manshin && owners.length === 1 && owner === manshin.idx && def.ownerKind === 'hero') {
    const gain = s.rules.sinbaramV01 ? (ctx.prevManshin ? 1 : 0) : 1 + (ctx.prevManshin ? 1 : 0);
    if (gain) addPersonal(s, manshin.idx, gain);
  }

  log(s, `카드: ${def.name}${choice.enemy >= 0 ? ' → ' + d.enemies[s.enemies[choice.enemy].def].name : ''}${resp ? ' (받는소리)' : ''}`);

  const possessed = owner >= 0 && inst.o2 < 0 && inst.d !== d.special.rescue && inst.d !== d.special.mourn && s.heroes[owner].possess > 0;
  if (possessed) {
    // 홀림: 효과 없음, 비용은 든다. 장부 대조(아전): 방어도 3
    s.heroes[owner].possess--;
    for (const e of s.enemies) if (e.alive && d.enemies[e.def].passives.some((p) => p.includes('장부 대조'))) e.block += 3;
  } else {
    execOps(s, def.effects, ctx);
  }

  // 가락: 잽이 카드를 낼 때마다 한 단계 빨라진다
  const jaebi = heroOf(s, 'jaebi');
  if (jaebi && owners.length === 1 && owner === jaebi.idx && def.ownerKind === 'hero') jaebi.personal = Math.min(2, jaebi.personal + 1);

  // 돌격: 근접 영웅이 공격 카드를 쓰면 효과를 처리한 뒤 선두로
  if (def.isAttack && s.outcome === 0) {
    let dasher = owner;
    if (def.ownerKind === 'duo' && def.dashHero) {
      const h = heroOf(s, def.dashHero);
      dasher = h ? h.idx : -1;
    }
    if (dasher >= 0 && standing(s.heroes[dasher]) && s.heroes[dasher].melee) {
      const front = s.formation[0];
      if (!(s.holdFront >= 0 && front === s.holdFront && dasher !== s.holdFront)) moveToFront(s, dasher);
    }
  }
  // 공격 카드 트리거 (주인의 능력)
  if (def.isAttack && !possessed && s.outcome === 0) {
    for (const o of owners) if (o >= 0) firePowers(s, 'on_attack', o, ctx);
  }
  if (!possessed && s.outcome === 0 && owner >= 0) firePowers(s, 'on_owner_card', owner, ctx);
  if (def.isToken) {
    s.tokensPlayed++;
    if (s.outcome === 0) firePowers(s, 'on_token_play', -1, ctx);
  }

  // 카드 이동
  if (def.isPower) s.powerZone.push(inst);
  else if (def.exhaust) s.exhaust.push(inst);
  else s.discard.push(inst);
  checkOutcome(s);
}

// ── 효과 실행 ───────────────────────────────────────────────────────
export function execOps(s: CombatState, ops: Op[], ctx: Ctx): void {
  for (const op of ops) {
    if (s.outcome !== 0) return;
    execOp(s, op, ctx);
  }
}

function actorFor(s: CombatState, ctx: Ctx, kw: '전진' | '후퇴' | '엄호' | '방어도'): number {
  if (ctx.card && ctx.card.ownerKind === 'duo') {
    const h = ctx.card.actorFor[kw];
    if (h) {
      const hs = heroOf(s, h);
      if (hs) return hs.idx;
    }
  }
  return ctx.owner;
}

function oneTarget(s: CombatState, ctx: Ctx): number {
  if (ctx.allOverride >= 0) return s.enemies[ctx.allOverride].alive ? ctx.allOverride : -1;
  if (ctx.target >= 0) return s.enemies[ctx.target].alive ? ctx.target : -1;
  return autoEnemy(s, ctx.autoTarget);
}

export function autoEnemy(s: CombatState, at: AutoTarget): number {
  const al = aliveEnemies(s);
  if (!al.length) return -1;
  switch (at) {
    case 'random':
      return al[Math.floor(rand(s) * al.length)];
    case 'lowestHp': {
      let best = al[0];
      for (const i of al) if (s.enemies[i].hp < s.enemies[best].hp) best = i;
      return best;
    }
    case 'mostDoom': {
      let best = al[0];
      for (const i of al) if (s.enemies[i].doom > s.enemies[best].doom) best = i;
      return best;
    }
    default:
      return al[0];
  }
}

function enemyTargets(s: CombatState, ctx: Ctx, sel: 'one' | 'all' | 'random'): number[] {
  if (sel === 'all') {
    if (ctx.allOverride >= 0) return s.enemies[ctx.allOverride].alive ? [ctx.allOverride] : [];
    return aliveEnemies(s);
  }
  if (sel === 'random') {
    if (ctx.allOverride >= 0) return s.enemies[ctx.allOverride].alive ? [ctx.allOverride] : [];
    const al = aliveEnemies(s);
    return al.length ? [al[Math.floor(rand(s) * al.length)]] : [];
  }
  const t = oneTarget(s, ctx);
  return t >= 0 ? [t] : [];
}

/** 위협이 가장 큰 아군 (방어도 대상 자동 선택) */
export function mostThreatened(s: CombatState, exclude = -1): number {
  const inc = projectIncoming(s, null);
  let best = -1;
  let bestV = -Infinity;
  for (const hi of s.formation) {
    if (hi === exclude) continue;
    const h = s.heroes[hi];
    const unb = Math.max(0, inc.dmg[hi] - h.block);
    const v = unb * (h.downed ? 10 : 1) - slotOf(s, hi) * 0.01;
    if (v > bestV) {
      bestV = v;
      best = hi;
    }
  }
  if (best < 0) best = s.formation[0] ?? 0;
  return best;
}

function lowestHpAlly(s: CombatState, frac: boolean): number {
  let best = -1;
  let bv = Infinity;
  for (const h of s.heroes) {
    if (!standing(h)) continue;
    const v = frac ? h.hp / h.maxHp : h.hp;
    if (v < bv) {
      bv = v;
      best = h.idx;
    }
  }
  return best;
}

function allyFor(s: CombatState, ctx: Ctx, purpose: 'block' | 'heal'): number {
  if (ctx.ally >= 0 && !s.heroes[ctx.ally].dead) return ctx.ally;
  if (ctx.fromPower || ctx.summonCtx) return lowestHpAlly(s, false);
  if (ctx.card && ctx.card.ownerKind === 'duo' && purpose === 'block') {
    const other = ctx.owners.find((o) => o !== actorFor(s, ctx, '방어도'));
    if (other !== undefined && other >= 0) return other;
  }
  return purpose === 'heal' ? lowestHpAlly(s, true) : mostThreatened(s);
}

function heroAttackMult(s: CombatState, ctx: Ctx): number {
  if (ctx.summonCtx || ctx.owner < 0) return 1;
  const h = s.heroes[ctx.owner];
  let m = 1;
  if (h.weak > 0) m *= 0.75;
  if (h.recovering) m *= 0.9;
  return m;
}

export function dealDamage(s: CombatState, ctx: Ctx, ei: number, base: number): number {
  const e = s.enemies[ei];
  if (!e.alive) return 0;
  let dmg = base * heroAttackMult(s, ctx);
  if (e.vuln > 0) dmg *= 1.5;
  if (collapsed(s, e)) dmg *= 1.5;
  dmg = Math.floor(dmg);
  const absorbed = Math.min(e.block, dmg);
  e.block -= absorbed;
  const dealt = dmg - absorbed;
  if (dealt > 0) {
    e.hp -= dealt;
    e.lastHitToken = ctx.isToken;
    if (s.stats && ctx.owner >= 0 && !ctx.summonCtx) s.stats.heroDmgDealt[ctx.owner] += Math.min(dealt, dealt + Math.min(0, e.hp));
  }
  if (e.hp <= 0) killEnemy(s, ei);
  return dealt;
}

function applyStatus(s: CombatState, ei: number, st: string, n: number): void {
  const e = s.enemies[ei];
  if (!e.alive || n <= 0) return;
  switch (st) {
    case '취약': e.vuln += n; break;
    case '약화': e.weak += n; break;
    case '점지': e.mark += n; break;
    case '상흔': e.bleed += n; break;
    case '명부': e.doom += n; break;
    case '넋흔들림':
      e.shake += n;
      if (e.shake >= e.endure) collapseEnemy(s, ei);
      break;
  }
}

export function collapseEnemy(s: CombatState, ei: number): void {
  const e = s.enemies[ei];
  e.cancelNext = true;
  e.collapseUntil = s.turn + 1;
  e.shake = 0;
  e.endure = Math.round(e.endure * 1.5);
  if (s.stats) s.stats.collapses++;
  log(s, `붕괴: ${D().enemies[e.def].name}`);
}

function execOp(s: CombatState, op: Op, ctx: Ctx): void {
  const d = D();
  switch (op.op) {
    case 'dmg': {
      for (let k = 0; k < op.hits; k++) {
        for (const ei of enemyTargets(s, ctx, op.target)) dealDamage(s, ctx, ei, op.n);
        if (s.outcome !== 0) return;
      }
      return;
    }
    case 'block': {
      if (op.to === 'party') {
        for (const h of s.heroes) if (!h.dead) gainBlock(s, h.idx, op.n);
      } else if (op.to === 'ally') {
        const a = allyFor(s, ctx, 'block');
        if (a >= 0) gainBlock(s, a, op.n);
      } else {
        const a = ctx.fromPower || ctx.summonCtx ? ctx.owner : actorFor(s, ctx, '방어도');
        if (a >= 0) gainBlock(s, a, op.n);
      }
      return;
    }
    case 'draw':
      drawCards(s, op.n);
      return;
    case 'discard':
      for (let k = 0; k < op.n && s.hand.length; k++) s.discard.push(s.hand.splice(worstInHand(s, false), 1)[0]);
      return;
    case 'energy':
      if (op.when === 'now') s.energy += op.n;
      else s.nextEnergy += op.n;
      return;
    case 'apply':
      for (const ei of enemyTargets(s, ctx, op.target)) applyStatus(s, ei, op.status, op.n);
      return;
    case 'jangdan':
      addJangdan(s, op.n);
      return;
    case 'personal': {
      let hi = ctx.owner;
      if (op.hero) {
        const h = heroOf(s, op.hero);
        hi = h ? h.idx : -1;
      }
      if (hi >= 0) addPersonal(s, hi, op.n);
      return;
    }
    case 'move':
      execMove(s, op, ctx);
      return;
    case 'summon':
      addSummon(s, op.sidx, ctx.owner);
      return;
    case 'token': {
      for (let k = 0; k < op.n; k++) {
        if (op.nextTurn && !ctx.fromPower) {
          s.deferredTokens.push(op.tidx | ((ctx.owners[0] + 1) << 16) | (((ctx.owners[1] ?? -1) + 1) << 24));
        } else addTokenCard(s, op.tidx, ctx.owners[0] ?? -1, ctx.owners[1] ?? -1, ctx.lastSummon);
      }
      return;
    }
    case 'heal': {
      if (op.to === 'party') {
        for (const h of s.heroes) if (standing(h)) heal(s, h.idx, op.n);
      } else if (op.to === 'ally') {
        const a = allyFor(s, ctx, 'heal');
        if (a >= 0 && standing(s.heroes[a])) heal(s, a, op.n);
      } else if (ctx.owner >= 0) heal(s, ctx.owner, op.n);
      return;
    }
    case 'stress': {
      if (op.when) return; // 손에 든 채 턴을 마칠 때 (저주) — 턴 종료에서 처리
      if (op.to === 'owner') {
        if (ctx.owner >= 0) addStress(s, ctx.owner, op.n);
      } else for (const h of s.heroes) if (!h.dead) addStress(s, h.idx, op.n);
      return;
    }
    case 'cleanse':
      for (let k = 0; k < op.n; k++) cleanseOne(s);
      return;
    case 'exhaust_other':
      for (let k = 0; k < op.n && s.hand.length; k++) {
        const i = ctx.shadowCtx ? s.hand.findIndex((c) => c.d === d.special.shadow) : worstInHand(s, true);
        if (i >= 0) s.exhaust.push(s.hand.splice(i, 1)[0]);
      }
      return;
    case 'hp_loss':
      if (ctx.owner >= 0) loseHp(s, ctx.owner, op.n);
      return;
    case 'per':
      execPer(s, op, ctx);
      return;
    case 'cond':
      execCond(s, op, ctx);
      return;
    case 'power': {
      if (op.thisTurn) {
        // 이번 턴 임시 트리거 ("이번 턴 진형이 바뀔 때마다")
        addTempPower(s, ctx, op.trigger, op.effects);
        return;
      }
      if (op.trigger === 'unknown' && s.stats) bump(s.stats.specialUse, `unknown_power:${ctx.card?.id}`);
      s.powers.push({
        card: ctx.card ? ctx.card.idx : -1, op, owner: ctx.owner, owner2: ctx.owners[1] ?? -1, temp: false, firedTurn: -1,
        effects: op.effects, trigger: op.trigger, againstAttacker: false,
      });
      return;
    }
    case 'consume':
      execConsume(s, op, ctx);
      return;
    case 'special':
      execSpecial(s, op, ctx);
      return;
  }
}

function execMove(s: CombatState, op: Extract<Op, { op: 'move' }>, ctx: Ctx): void {
  if (op.when) return; // 저주의 턴 종료 효과
  switch (op.kind) {
    case '전진': {
      const a = actorFor(s, ctx, '전진');
      if (a >= 0 && !s.heroes[a].dead) moveToFront(s, a);
      return;
    }
    case '후퇴': {
      let a: number;
      if (op.mode === 'downed') a = s.heroes.find((h) => h.downed)?.idx ?? -1;
      else if (op.mode === 'ally') a = ctx.ally >= 0 ? ctx.ally : mostThreatened(s, ctx.owner);
      else a = actorFor(s, ctx, '후퇴');
      if (a >= 0 && !s.heroes[a].dead) moveToBack(s, a);
      return;
    }
    case '교대': {
      if (op.mode === 'owners') {
        if (ctx.owners.length === 2 && ctx.owners[0] >= 0 && ctx.owners[1] >= 0) swapHeroes(s, ctx.owners[0], ctx.owners[1]);
        return;
      }
      if (op.mode === 'pair') {
        const p = ctx.pair ?? defaultPair(s);
        if (p) swapHeroes(s, p[0], p[1]);
        return;
      }
      const a = ctx.owner;
      const b = ctx.ally >= 0 ? ctx.ally : defaultSwapPartner(s, a);
      if (a >= 0 && b >= 0 && a !== b) swapHeroes(s, a, b);
      return;
    }
    case '엄호': {
      const a = actorFor(s, ctx, '엄호');
      if (a < 0) return;
      const b = ctx.ally >= 0 ? ctx.ally : mostThreatened(s, a);
      if (b >= 0 && b !== a) s.heroes[a].cover = b;
      return;
    }
  }
}

function defaultPair(s: CombatState): [number, number] | null {
  if (s.formation.length < 2) return null;
  const f = s.formation;
  const downedFront = s.heroes[f[0]].downed;
  if (downedFront) {
    const up = f.find((hi) => standing(s.heroes[hi]));
    if (up !== undefined) return [f[0], up];
  }
  return [f[0], f[1]];
}

function defaultSwapPartner(s: CombatState, a: number): number {
  const f = s.formation;
  if (f.length < 2) return -1;
  const sa = f.indexOf(a);
  if (s.heroes[f[0]].downed && f[0] !== a) return f[0];
  return f[sa === 0 ? 1 : sa - 1];
}

function execPer(s: CombatState, op: Extract<Op, { op: 'per' }>, ctx: Ctx): void {
  const d = D();
  const cap = (n: number) => Math.max(0, op.max !== null ? Math.min(op.max, n) : n);
  switch (op.mode) {
    case 'status': {
      const st = op.source;
      const eachAll = op.each.some((e) => 'target' in e && e.target === 'all');
      if (eachAll && ctx.allOverride < 0 && ctx.consumed[st] === undefined) {
        // 적마다 자기 스택만큼
        let total = 0;
        for (const ei of aliveEnemies(s)) total += cap(statusOf(s.enemies[ei], st));
        recordPer(s, op.key, total);
        for (const ei of aliveEnemies(s)) {
          const count = cap(statusOf(s.enemies[ei], st));
          const sub = { ...ctx, allOverride: ei };
          for (let k = 0; k < count; k++) execOps(s, op.each, sub);
          if (s.outcome !== 0) return;
        }
        return;
      }
      let count: number;
      if (ctx.consumed[st] !== undefined) count = ctx.consumed[st];
      else {
        const t = oneTarget(s, ctx);
        count = t >= 0 ? statusOf(s.enemies[t], st) : 0;
      }
      count = cap(count);
      recordPer(s, op.key, count);
      let sub = ctx;
      if (ctx.card && ctx.card.needsEnemy2 && ctx.target2 >= 0) sub = { ...ctx, target: ctx.target2 };
      for (let k = 0; k < count; k++) execOps(s, op.each, sub);
      return;
    }
    case 'turn_end_defer':
      addTempPower(s, ctx, 'turn_end', [{ ...op, mode: 'jangdan' }]);
      return;
    default:
      break;
  }
  let count = 0;
  switch (op.mode) {
    case 'jangdan': count = s.jangdan; break;
    case 'summons': count = ctx.consumed['굿상'] ?? s.summons.length; break;
    case 'tokens_played': count = ctx.consumed['부적'] ?? s.tokensPlayed; break;
    case 'tokens_hand': count = ctx.consumed['부적'] ?? s.hand.filter((c) => d.cards[c.d].isToken).length; break;
    case 'personal': {
      if (ctx.consumed[op.source] !== undefined) count = ctx.consumed[op.source];
      else {
        const h = resourceHero(s, op.source);
        count = h ? (op.source === '작두' ? (h.stance ? 1 : 0) : h.personal) : 0;
      }
      break;
    }
    case 'hand': count = s.hand.length; break;
    case 'shadow': count = s.hand.filter((c) => c.d === d.special.shadow).length; break;
    case 'formation_count': count = s.formChanges; break;
    case 'tal_count': count = s.talChanges; break;
    default: {
      const exp = op.expect ?? 2;
      count = Math.floor(exp) + (rand(s) < exp - Math.floor(exp) ? 1 : 0);
      if (s.stats) bump(s.stats.specialUse, `per_expect:${op.key}`);
    }
  }
  count = cap(count);
  recordPer(s, op.key, count);
  const sub = op.mode === 'shadow' ? { ...ctx, shadowCtx: true } : ctx;
  for (let k = 0; k < count; k++) {
    execOps(s, op.each, sub);
    if (s.outcome !== 0) return;
  }
}

function recordPer(s: CombatState, key: string, count: number): void {
  if (!s.stats) return;
  const v = s.stats.perCount.get(key) ?? [0, 0];
  v[0]++;
  v[1] += count;
  s.stats.perCount.set(key, v);
}

function statusOf(e: EnemyState, st: string): number {
  switch (st) {
    case '취약': return e.vuln;
    case '약화': return e.weak;
    case '점지': return e.mark;
    case '상흔': return e.bleed;
    case '명부': return e.doom;
    case '넋흔들림': return e.shake;
  }
  return 0;
}

const RES_HERO: Record<string, HeroId> = {
  신바람: 'manshin', 가락: 'jaebi', 화약: 'posu', 작두: 'baksu', 염주: 'seungnyeo', 경면주사: 'beopsa', 오라: 'chasa',
};

function resourceHero(s: CombatState, res: string): HeroState | null {
  const id = RES_HERO[res];
  if (!id) return null;
  const h = heroOf(s, id);
  return h && !h.dead ? h : null;
}

function addTempPower(s: CombatState, ctx: Ctx, trigger: Trigger, effects: Op[], againstAttacker = false, owner = ctx.owner): void {
  const op: Extract<Op, { op: 'power' }> = {
    op: 'power', trigger, effects, expect: null, gate: null, requireStance: false, key: `${ctx.card?.id ?? 'temp'}#temp`, autoTarget: 'front', thisTurn: true,
  };
  s.powers.push({ card: ctx.card ? ctx.card.idx : -1, op, owner, owner2: -1, temp: true, firedTurn: -1, effects, trigger, againstAttacker });
}

const TARGET_CONDS = new Set(['tstat', 'tcollapse', 'tbound']);

function execCond(s: CombatState, op: Extract<Op, { op: 'cond' }>, ctx: Ctx): void {
  const c = op.cond;
  // 대상 상태 조건인데 고른 대상이 없으면 → 조건을 만족하는 적마다
  if (TARGET_CONDS.has(c.k) && ctx.target < 0 && ctx.allOverride < 0) {
    let any = false;
    for (const ei of aliveEnemies(s)) {
      if (!targetCond(s, c, ei, ctx)) continue;
      any = true;
      execOps(s, op.then, { ...ctx, allOverride: ei });
      if (s.outcome !== 0) break;
    }
    recordCond(s, op.key, any);
    return;
  }
  if (op.turnEnd || c.k === 'blade_fall') return; // 턴 종료 규칙으로 처리 (작두 헛디딤: endPlayerTurn 에서 기록)
  const ok = evalCond(s, c, op, ctx);
  recordCond(s, op.key, ok || c.k === 'attacked_chasa');
  if (!ok) {
    execOps(s, op.else, ctx); // 숨통 겨누기: 화약을 쓰지 않으면 점지를 모두 없앤다
    return;
  }
  if (c.k === 'res' || c.k === 'summons_empty_res') {
    // 자원 소모 조건: then 안에 소모가 없으면 여기서 쓴다
    const hasConsume = op.then.some((e) => e.op === 'consume');
    if (!hasConsume) {
      const h = resourceHero(s, c.res);
      if (h) h.personal = Math.max(0, h.personal - c.n);
    }
  }
  if (c.k === 'garak_down') {
    const j = heroOf(s, 'jaebi');
    if (j) j.personal = Math.max(0, j.personal - 1);
  }
  const times = c.k === 'resp' || c.k === 'resp_summon' ? Math.max(1, ctx.respTimes) : 1;
  let sub = ctx;
  if (c.k === 'ally_downed' || c.k === 'any_downed') sub = ctx;
  if (c.k === 'hand_shadow') sub = { ...ctx, shadowCtx: true };
  for (let k = 0; k < times; k++) {
    execOps(s, op.then, sub);
    if (s.outcome !== 0) return;
  }
}

function recordCond(s: CombatState, key: string, ok: boolean): void {
  if (!s.stats) return;
  const v = s.stats.condEval.get(key) ?? [0, 0];
  v[0]++;
  if (ok) v[1]++;
  s.stats.condEval.set(key, v);
}

function targetCond(s: CombatState, c: Cond, ei: number, ctx: Ctx): boolean {
  const e = s.enemies[ei];
  if (!e || !e.alive) return false;
  if (c.k === 'tstat') {
    let v = statusOf(e, c.st);
    if (c.st === '점지' && c.n === 1 && ctx.markedAtPlay && ctx.markedAtPlay[ei]) v = Math.max(v, 1);
    return v >= c.n || (c.orCollapse && collapsed(s, e));
  }
  if (c.k === 'tcollapse') return collapsed(s, e);
  if (c.k === 'tbound') return e.bound;
  return false;
}

function evalCond(s: CombatState, c: Cond, op: Extract<Op, { op: 'cond' }>, ctx: Ctx): boolean {
  const d = D();
  switch (c.k) {
    case 'resp': return ctx.resp;
    case 'resp_summon': return ctx.resp && s.summons.length > 0;
    case 'tstat':
    case 'tcollapse':
    case 'tbound': {
      const t = oneTarget(s, ctx);
      return t >= 0 && targetCond(s, c, t, ctx);
    }
    case 'jangdan': return s.jangdan >= c.n;
    case 'slot': {
      const tal = heroOf(s, 'talggun');
      if (s.talAll && tal && ctx.owners.includes(tal.idx)) return true;
      let slot: number;
      if (c.who === 'talggun') {
        if (!tal || tal.dead) return false;
        slot = ctx.talSlot >= 0 ? ctx.talSlot : slotOf(s, tal.idx);
      } else slot = ctx.ownerSlot >= 0 ? ctx.ownerSlot : slotOf(s, ctx.owner);
      const n = s.formation.length;
      const want = c.slot === 2 ? n - 1 : c.slot;
      const hit = slot === want && slot >= 0;
      return c.neg ? !hit : hit;
    }
    case 'stance': {
      const b = heroOf(s, 'baksu');
      return !!b && b.stance;
    }
    case 'gangsin_req': return s.gangsin;
    case 'gangsin': return s.gangsin;
    case 'prev_manshin': return ctx.prevManshin;
    case 'summons': return s.summons.length >= c.n;
    case 'summons_empty_res': {
      const h = resourceHero(s, c.res);
      return s.summons.length === 0 && !!h && h.personal >= c.n;
    }
    case 'res': {
      const h = resourceHero(s, c.res);
      return !!h && standing(h) && h.personal >= c.n;
    }
    case 'hand_token': return s.hand.some((x) => d.cards[x.d].isToken);
    case 'formchg': return s.formChanges >= c.n;
    case 'garak_max': {
      const j = heroOf(s, 'jaebi');
      return !!j && j.personal >= 2;
    }
    case 'garak_down': {
      const j = heroOf(s, 'jaebi');
      return !!j && j.personal > 0;
    }
    case 'jangdan5': {
      if (s.jangdan >= JANGDAN_MAX) return true;
      addTempPower(s, ctx, 'on_jangdan5', op.then);
      return false;
    }
    case 'hand_shadow': return s.hand.some((x) => x.d === d.special.shadow);
    case 'ally_downed': return ctx.ally >= 0 && s.heroes[ctx.ally].downed;
    case 'any_downed': return s.heroes.some((h) => h.downed);
    case 'drawn_curse': {
      const c2 = s.lastDrawn;
      if (!c2) return false;
      const cd = d.cards[c2.d];
      return cd.isCurse || cd.isStatus;
    }
    case 'always': return true;
    case 'attacked_chasa': {
      const ch = heroOf(s, 'chasa');
      if (ch) addTempPower(s, ctx, 'on_hit', op.then, true, ch.idx);
      return false;
    }
    case 'blade_fall': return false;
    case 'stochastic': return rand(s) < op.p;
  }
  return false;
}

function execConsume(s: CombatState, op: Extract<Op, { op: 'consume' }>, ctx: Ctx): void {
  const d = D();
  const name = op.status ?? op.source ?? '';
  if (['점지', '상흔', '명부', '넋흔들림'].includes(name)) {
    const t = oneTarget(s, ctx);
    if (t < 0) return;
    const e = s.enemies[t];
    const have = statusOf(e, name);
    const amt = op.n === null || op.n === 'all' ? have : Math.min(op.n, have);
    switch (name) {
      case '점지': e.mark -= amt; break;
      case '상흔': e.bleed -= amt; break;
      case '명부': e.doom -= amt; break;
      case '넋흔들림': e.shake -= amt; break;
    }
    ctx.consumed[name] = (ctx.consumed[name] ?? 0) + amt;
    if (name === '점지' && amt > 0) {
      const posu = heroOf(s, 'posu');
      if (posu && ctx.owners.includes(posu.idx)) firePowers(s, 'on_consume_mark', posu.idx, ctx);
    }
    return;
  }
  if (name === '오라') {
    const h = resourceHero(s, '오라');
    const t = oneTarget(s, ctx);
    if (!h || h.personal < 1 || t < 0) return;
    h.personal -= 1;
    s.enemies[t].bound = true;
    ctx.consumed['오라'] = (ctx.consumed['오라'] ?? 0) + 1;
    firePowers(s, 'on_bind', h.idx, { ...ctx, target: t });
    return;
  }
  if (name === '작두') {
    const h = resourceHero(s, '작두');
    if (h && h.stance) {
      h.stance = false;
      ctx.consumed['작두'] = 1;
    }
    return;
  }
  if (RES_HERO[name]) {
    const h = resourceHero(s, name);
    if (!h) return;
    const amt = op.n === null || op.n === 'all' ? h.personal : Math.min(op.n, h.personal);
    h.personal -= amt;
    ctx.consumed[name] = (ctx.consumed[name] ?? 0) + amt;
    return;
  }
  if (name === '부적') {
    const all = op.n === null || op.n === 'all';
    let used = 0;
    const want = all ? Infinity : op.n as number;
    while (used < want) {
      let worst = -1;
      let wv = Infinity;
      for (let i = 0; i < s.hand.length; i++) {
        const cd = d.cards[s.hand[i].d];
        if (cd.isToken && cd.value < wv) {
          wv = cd.value;
          worst = i;
        }
      }
      if (worst < 0) break;
      s.exhaust.push(s.hand.splice(worst, 1)[0]);
      used++;
    }
    ctx.consumed['부적'] = (ctx.consumed['부적'] ?? 0) + used;
    return;
  }
  if (name === '굿상') {
    if (!s.summons.length) {
      ctx.consumed['굿상'] = ctx.consumed['굿상'] ?? 0;
      return;
    }
    if (op.n === null || op.n === 'all') {
      ctx.consumed['굿상'] = (ctx.consumed['굿상'] ?? 0) + s.summons.length;
      s.summons = [];
      return;
    }
    let bi = 0;
    for (let i = 1; i < s.summons.length; i++) if (s.summons[i].left > s.summons[bi].left) bi = i;
    const inst = s.summons[bi];
    ctx.lastSummon = inst.s;
    inst.left -= 1;
    if (inst.left <= 0) s.summons.splice(bi, 1);
    ctx.consumed['굿상'] = (ctx.consumed['굿상'] ?? 0) + 1;
  }
}

function execSpecial(s: CombatState, op: Extract<Op, { op: 'special' }>, ctx: Ctx): void {
  const d = D();
  if (s.stats) bump(s.stats.specialUse, op.kind);
  switch (op.kind) {
    case 'baraji': s.baraji += 1; return;
    case 'samhyeon': s.garakLocked = true; return;
    case 'fire_summon': {
      const best = bestSummon(s);
      if (best) runSummonEffects(s, best.s, best.owner);
      return;
    }
    case 'gangsin_extra': s.gangsinExtra += 1; return;
    case 'instant_collapse': {
      const t = oneTarget(s, ctx);
      if (t >= 0) collapseEnemy(s, t);
      return;
    }
    case 'tal_all': s.talAll = true; return;
    case 'seokja': s.seokja = true; return;
    case 'ajik': {
      s.ajik = true;
      for (const h of s.heroes) if (h.downed) h.rescueNeed = Math.max(1, h.rescueNeed - 1);
      for (const h of s.heroes) if (h.downed && h.rescue >= h.rescueNeed) reviveHero(s, h.idx);
      return;
    }
    case 'rescue_ally':
      if (ctx.ally >= 0 && s.heroes[ctx.ally].downed) addRescue(s, ctx.ally);
      return;
    case 'rescue': {
      const o = ctx.inst ? ctx.inst.o : -1;
      if (o >= 0 && s.heroes[o].downed) addRescue(s, o);
      return;
    }
    case 'offering':
      if (s.jijeon >= 3) {
        s.jijeon -= 3;
        s.offeringPaid = true;
      }
      return;
    case 'sinryeongbu': {
      const x = ctx.inst ? ctx.inst.x : -1;
      if (x >= 0) runSummonEffects(s, x, ctx.owner);
      else {
        const best = bestSummon(s);
        if (best) runSummonEffects(s, best.s, ctx.owner);
        else approxSpecial(s, op, ctx);
      }
      return;
    }
    case 'gokkal_tal': {
      const tal = heroOf(s, 'talggun');
      if (!tal) return;
      const slot = slotOf(s, tal.idx);
      const n = s.formation.length;
      const t = autoEnemy(s, 'front');
      if (slot === 0) { if (t >= 0) applyStatus(s, t, '취약', 1); }
      else if (slot === n - 1) addJangdan(s, 1);
      else if (t >= 0) applyStatus(s, t, '약화', 1);
      return;
    }
    case 'heotgeot':
      return;
    default:
      approxSpecial(s, op, ctx);
      void d;
  }
}

function approxSpecial(s: CombatState, op: Extract<Op, { op: 'special' }>, ctx: Ctx): void {
  if (ctx.card && ctx.card.isAttack) {
    const t = oneTarget(s, ctx);
    if (t >= 0) dealDamage(s, ctx, t, Math.round(op.value));
  } else if (ctx.owner >= 0) gainBlock(s, ctx.owner, Math.round(op.value / 1.2));
}

// ── 자원·상태 변화 ─────────────────────────────────────────────────
export function addJangdan(s: CombatState, n: number): void {
  const old = s.jangdan;
  s.jangdan = Math.min(JANGDAN_MAX, Math.max(0, old + n));
  if (s.jangdan >= JANGDAN_MAX && old < JANGDAN_MAX) {
    const fired = s.powers.filter((p) => p.trigger === 'on_jangdan5');
    if (fired.length) {
      s.powers = s.powers.filter((p) => p.trigger !== 'on_jangdan5');
      for (const p of fired) runPower(s, p, -1, null);
    }
  }
}

export function addPersonal(s: CombatState, hi: number, n: number): void {
  const h = s.heroes[hi];
  if (h.dead) return;
  switch (h.id) {
    case 'manshin':
      h.personal = Math.max(0, h.personal + n);
      if (h.personal >= 5 && standing(h)) {
        h.personal = 0;
        s.gangsin = true;
        if (s.stats) s.stats.gangsin++;
        log(s, '만신 강신');
        firePowers(s, 'on_gangsin', hi);
      }
      return;
    case 'baksu':
      if (n > 0) h.stance = true;
      return;
    case 'talggun':
      return;
    default:
      h.personal = Math.min(h.personalCap, Math.max(0, h.personal + n));
  }
}

export function gainBlock(s: CombatState, hi: number, n: number): void {
  const h = s.heroes[hi];
  if (h.dead || n <= 0) return;
  h.block += n;
  if (h.id === 'seungnyeo' && standing(h)) h.personal = Math.min(h.personalCap, h.personal + 1);
}

function heal(s: CombatState, hi: number, n: number): void {
  const h = s.heroes[hi];
  if (!standing(h)) return;
  h.hp = Math.min(h.maxHp, h.hp + n);
}

export function loseHp(s: CombatState, hi: number, n: number): void {
  const h = s.heroes[hi];
  if (!standing(h) || n <= 0) return;
  h.hp -= n;
  if (s.stats) {
    s.stats.dmgTakenHero[hi] += n;
  }
  if (h.hp <= 0) downHero(s, hi);
}

export function addStress(s: CombatState, hi: number, n: number): void {
  const h = s.heroes[hi];
  if (h.dead || n === 0) return;
  const old = h.stress;
  h.stress = Math.min(100, Math.max(0, old + n));
  for (const th of [50, 100]) {
    if (old < th && h.stress >= th) {
      addCurse(s, hi);
      if (th === 100) {
        if (rand(s) < 0.75) {
          h.possess += 2; // 붕괴 → 홀림 2
          log(s, `${h.id} 귀기 붕괴`);
        } else {
          for (const x of s.heroes) if (!x.dead) gainBlock(s, x.idx, 6); // 각성
          addJangdan(s, 2);
          log(s, `${h.id} 각성`);
        }
      }
    }
  }
}

function addCurse(s: CombatState, hi: number): void {
  if (s.statusAdded >= STATUS_CARD_CAP) return;
  const d = D();
  const cd = d.special.curses[Math.floor(rand(s) * d.special.curses.length)];
  insertRandom(s, s.draw, { d: cd, o: hi, o2: -1, orig: -1, x: -1 });
  s.statusAdded++;
  s.newCurses.push([hi, cd]);
}

export function addStatusCard(s: CombatState, defIdx: number): void {
  if (s.statusAdded >= STATUS_CARD_CAP) return;
  insertRandom(s, s.draw, { d: defIdx, o: -1, o2: -1, orig: -1, x: -1 });
  s.statusAdded++;
}

function insertRandom(s: CombatState, pile: CardInst[], c: CardInst): void {
  const pos = Math.floor(rand(s) * (pile.length + 1));
  pile.splice(pos, 0, c);
}

function cleanseOne(s: CombatState): void {
  const d = D();
  let ph = -1;
  for (const h of s.heroes) if (!h.dead && h.possess > 0 && (ph < 0 || h.possess > s.heroes[ph].possess)) ph = h.idx;
  if (ph >= 0) {
    s.heroes[ph].possess = 0;
    return;
  }
  const isBad = (c: CardInst) => {
    const cd = d.cards[c.d];
    return (cd.isCurse || cd.isStatus) && c.d !== d.special.rescue && c.d !== d.special.mourn;
  };
  for (const pile of [s.hand, s.discard, s.draw]) {
    const i = pile.findIndex(isBad);
    if (i >= 0) {
      s.exhaust.push(pile.splice(i, 1)[0]);
      return;
    }
  }
}

function worstInHand(s: CombatState, preferBad: boolean): number {
  const d = D();
  let worst = 0;
  let wv = Infinity;
  for (let i = 0; i < s.hand.length; i++) {
    const c = s.hand[i];
    const cd = d.cards[c.d];
    let v = cd.value;
    if (preferBad && (cd.isCurse || cd.isStatus) && c.d !== d.special.rescue) v = -100;
    if (c.d === d.special.rescue || c.d === d.special.offering) v = 1000;
    if (v < wv) {
      wv = v;
      worst = i;
    }
  }
  return worst;
}

export function drawCards(s: CombatState, n: number): void {
  for (let k = 0; k < n; k++) {
    if (s.hand.length >= HAND_MAX) return;
    if (!s.draw.length) {
      if (!s.discard.length) return;
      s.draw = shuffle(s, s.discard);
      s.discard = [];
    }
    const c = s.draw.pop()!;
    s.hand.push(c);
    s.lastDrawn = c;
  }
}

function addTokenCard(s: CombatState, tidx: number, o: number, o2: number, x: number): void {
  const c: CardInst = { d: tidx, o, o2, orig: -1, x };
  if (s.hand.length < HAND_MAX) s.hand.push(c);
  else s.discard.push(c);
}

// ── 굿상 ──────────────────────────────────────────────────────────
function addSummon(s: CombatState, sidx: number, owner: number): void {
  if (s.summons.length >= SUMMON_MAX) s.summons.shift();
  s.summons.push({ s: sidx, left: D().summons[sidx].duration, owner });
}

function bestSummon(s: CombatState) {
  const d = D();
  let best = null as null | (typeof s.summons)[number];
  for (const x of s.summons) if (!best || d.summons[x.s].value > d.summons[best.s].value) best = x;
  return best;
}

function runSummonEffects(s: CombatState, sidx: number, owner: number): void {
  const def = D().summons[sidx];
  const ctx = baseCtx(owner, [owner], null);
  ctx.summonCtx = true;
  ctx.autoTarget = def.autoTarget;
  execOps(s, def.effects, ctx);
  if (s.outcome === 0) firePowers(s, 'on_summon_fire', -1);
}

function runSummon(s: CombatState, inst: { s: number; owner: number }): void {
  runSummonEffects(s, inst.s, inst.owner);
}

function fireSummons(s: CombatState, trigger: 'turn_start' | 'turn_end'): void {
  const d = D();
  const list = s.summons.slice();
  for (const inst of list) {
    if (s.outcome !== 0) return;
    if (d.summons[inst.s].trigger !== trigger) continue;
    runSummon(s, inst);
    inst.left -= 1;
  }
  s.summons = s.summons.filter((x) => x.left > 0);
}

// ── 능력(파워) ──────────────────────────────────────────────────────
function powerActive(s: CombatState, p: PowerInst): boolean {
  if (p.owner >= 0 && !standing(s.heroes[p.owner])) return false;
  if (p.owner2 >= 0 && !standing(s.heroes[p.owner2])) return false;
  return true;
}

/** who: 이벤트의 주인 영웅 (on_attack·on_hit 등). -1 = 누구든 */
export function firePowers(s: CombatState, trigger: Trigger, who: number, src: Ctx | null = null, attacker = -1): void {
  if (!s.powers.length) return;
  const list = s.powers.filter((p) => p.trigger === trigger);
  for (const p of list) {
    if (s.outcome !== 0) return;
    if (!powerActive(s, p)) continue;
    if (who >= 0 && (trigger === 'on_attack' || trigger === 'on_hit' || trigger === 'on_owner_card' || trigger === 'on_consume_mark') && p.owner !== who && p.owner2 !== who) continue;
    if (trigger === 'on_formation_change_first' || trigger === 'on_talggun_move_first') {
      if (p.firedTurn === s.turn) continue;
      p.firedTurn = s.turn;
    }
    runPower(s, p, attacker, src);
  }
}

function runPower(s: CombatState, p: PowerInst, attacker: number, src: Ctx | null): void {
  const d = D();
  if (p.op.requireStance) {
    const b = heroOf(s, 'baksu');
    if (!b || !b.stance) return;
  }
  if (p.op.gate) {
    const h = resourceHero(s, p.op.gate.res);
    if (!h || h.personal < p.op.gate.n) return;
    h.personal -= p.op.gate.n;
  }
  const card = p.card >= 0 ? d.cards[p.card] : null;
  const ctx = baseCtx(p.owner, p.owner2 >= 0 ? [p.owner, p.owner2] : [p.owner], card);
  ctx.fromPower = true;
  ctx.autoTarget = p.op.autoTarget;
  if (src) {
    ctx.target = src.target;
    ctx.markedAtPlay = src.markedAtPlay;
    ctx.talSlot = src.talSlot;
    ctx.ownerSlot = src.ownerSlot;
    if (ctx.target >= 0 && !s.enemies[ctx.target].alive) ctx.target = -1;
  }
  if (p.againstAttacker) {
    if (attacker < 0 || !s.enemies[attacker].alive) return;
    ctx.target = attacker;
  } else if (p.trigger === 'on_hit') {
    ctx.target = attacker >= 0 && s.enemies[attacker].alive ? attacker : -1;
    if (ctx.target < 0) return;
  }
  if (s.stats) bump(s.stats.powerFires, card ? card.id : p.op.key);
  execOps(s, p.effects, ctx);
}

// ── 진형 ───────────────────────────────────────────────────────────
function setFormation(s: CombatState, order: number[]): void {
  const old = s.formation;
  let same = old.length === order.length;
  if (same) for (let i = 0; i < old.length; i++) if (old[i] !== order[i]) same = false;
  if (same) return;
  const tal = heroOf(s, 'talggun');
  const oldTal = tal ? old.indexOf(tal.idx) : -1;
  s.formation = order;
  s.formChanges++;
  firePowers(s, 'on_formation_change', -1);
  firePowers(s, 'on_formation_change_first', -1);
  if (tal && !tal.dead && order.indexOf(tal.idx) !== oldTal) {
    s.talChanges++;
    firePowers(s, 'on_talggun_move', -1);
    firePowers(s, 'on_talggun_move_first', -1);
  }
}

export function moveToFront(s: CombatState, hi: number): void {
  if (!s.formation.includes(hi)) return;
  setFormation(s, [hi, ...s.formation.filter((x) => x !== hi)]);
}

export function moveToBack(s: CombatState, hi: number): void {
  if (!s.formation.includes(hi)) return;
  setFormation(s, [...s.formation.filter((x) => x !== hi), hi]);
}

export function swapHeroes(s: CombatState, a: number, b: number): void {
  const f = s.formation.slice();
  const ia = f.indexOf(a);
  const ib = f.indexOf(b);
  if (ia < 0 || ib < 0 || ia === ib) return;
  f[ia] = b;
  f[ib] = a;
  setFormation(s, f);
}

export function shuffleFormation(s: CombatState): void {
  const f = s.formation.slice();
  shuffle(s, f);
  setFormation(s, f);
}

// ── 피격·쓰러짐·죽음 ────────────────────────────────────────────────
export function hitHero(s: CombatState, target: number, dmg: number, attacker: number): void {
  let t = target;
  for (const h of s.heroes) {
    if (h.idx !== t && h.cover === t && standing(h)) {
      t = h.idx;
      break;
    }
  }
  if (s.ajik && s.heroes[t].downed) {
    const ch = heroOf(s, 'chasa');
    if (ch && standing(ch)) t = ch.idx;
  }
  if (s.rules.downShield && s.heroes[t].downed && s.heroes[t].downTurn === s.turn) {
    // 변형 규칙: 막 쓰러진 영웅 대신 가장 앞의 서 있는 영웅이 맞는다
    const next = s.formation.find((hi) => standing(s.heroes[hi]));
    if (next === undefined) return;
    t = next;
  }
  const h = s.heroes[t];
  if (h.dead) return;
  const absorbed = Math.min(h.block, dmg);
  h.block -= absorbed;
  const rest = dmg - absorbed;
  if (h.id === 'seungnyeo' && standing(h)) h.personal = Math.min(h.personalCap, h.personal + 1);
  if (s.stats) {
    s.stats.dmgTakenHero[t] += rest;
    const sl = slotOf(s, t);
    if (sl >= 0) s.stats.dmgTakenSlot[Math.min(2, sl === s.formation.length - 1 ? 2 : sl)] += rest;
  }
  if (h.downed) {
    if (rest > 0) deathCheck(s, t);
  } else {
    h.hp -= rest;
    if (h.hp <= 0) downHero(s, t);
  }
  if (standing(h) && s.outcome === 0) firePowers(s, 'on_hit', t, null, attacker);
}

function deathCheck(s: CombatState, hi: number): void {
  const h = s.heroes[hi];
  if (rand(s) < deathSaveChance(h.survived)) h.survived++;
  else killHero(s, hi);
}

function transformCards(s: CombatState, fn: (c: CardInst) => CardInst): void {
  s.draw = s.draw.map(fn);
  s.hand = s.hand.map(fn);
  s.discard = s.discard.map(fn);
}

export function downHero(s: CombatState, hi: number): void {
  const d = D();
  const h = s.heroes[hi];
  h.downed = true;
  h.hp = 0;
  h.block = 0;
  h.downs++;
  h.downTurn = s.turn;
  h.rescueNeed = Math.max(1, RESCUE_BASE + (h.downs - 1) - (s.ajik ? 1 : 0));
  h.rescue = 0;
  h.survived = 0;
  h.stance = false;
  h.possess = 0;
  h.cover = -1;
  if (s.stats) s.stats.downs++;
  log(s, `${h.id} 쓰러짐`);
  transformCards(s, (c) => {
    if (c.o !== hi || c.o2 >= 0) return c;
    const cd = d.cards[c.d];
    if (cd.isCurse || cd.isStatus) return c;
    return { d: d.special.rescue, o: hi, o2: -1, orig: c.d, x: c.x };
  });
  checkOutcome(s);
}

function addRescue(s: CombatState, hi: number): void {
  const h = s.heroes[hi];
  h.rescue++;
  if (h.rescue >= h.rescueNeed) reviveHero(s, hi);
}

export function reviveHero(s: CombatState, hi: number): void {
  const d = D();
  const h = s.heroes[hi];
  if (!h.downed) return;
  h.downed = false;
  h.hp = Math.max(1, Math.round(h.maxHp * 0.25));
  h.recovering = true;
  h.rescue = 0;
  h.survived = 0;
  if (s.stats) s.stats.revives++;
  log(s, `${h.id} 기상`);
  transformCards(s, (c) => (c.o === hi && c.d === d.special.rescue && c.orig >= 0 ? { d: c.orig, o: hi, o2: -1, orig: -1, x: c.x } : c));
}

export function killHero(s: CombatState, hi: number): void {
  const d = D();
  const h = s.heroes[hi];
  h.dead = true;
  h.downed = false;
  h.hp = 0;
  h.block = 0;
  h.cover = -1;
  s.formation = s.formation.filter((x) => x !== hi);
  s.powers = s.powers.filter((p) => p.owner !== hi && p.owner2 !== hi);
  if (s.stats) {
    s.stats.deaths++;
    if (h.downTurn === s.turn) s.stats.sameTurnDeaths++;
  }
  log(s, `${h.id} 사망`);
  transformCards(s, (c) => {
    if (c.o !== hi || c.o2 >= 0) return c;
    const cd = d.cards[c.d];
    if ((cd.isCurse || cd.isStatus) && c.d !== d.special.rescue) return c;
    return { d: d.special.mourn, o: hi, o2: -1, orig: c.orig >= 0 ? c.orig : c.d, x: -1 };
  });
  checkOutcome(s);
}

// ── 적 쓰러짐·해원 ──────────────────────────────────────────────────
/** 해원 성립: 기록 + (규칙) 서 있는 영웅 모두 체력 회복 */
function haewonDone(s: CombatState, e: EnemyState): void {
  if (s.stats) {
    s.stats.haewons++;
    const id = D().enemies[e.def].id;
    const v = s.stats.enemyHaewon.get(id) ?? [0, 0];
    v[1]++;
    s.stats.enemyHaewon.set(id, v);
  }
  const n = s.rules.haewonHeal ?? 0;
  if (n > 0) {
    for (const h of s.heroes) {
      if (!standing(h)) continue;
      const before = h.hp;
      h.hp = Math.min(h.maxHp, h.hp + n);
      if (s.stats) s.stats.haewonHealed += h.hp - before;
    }
  }
}

export function haewonSatisfied(s: CombatState, e: EnemyState): boolean {
  const d = D();
  const def = d.enemies[e.def];
  const r = def.haewon;
  switch (r.kind) {
    case 'status': return statusOf(e, r.status!) >= (r.n ?? 1) || (!!r.orCollapse && collapsed(s, e));
    case 'jangdan': return s.jangdan >= (r.n ?? 3);
    case 'summons': return s.summons.length > 0;
    case 'token': return e.lastHitToken || (!!r.group && s.groupHaewon.includes(def.id));
    case 'formation': return s.formChanges > 0;
    case 'collapse': return collapsed(s, e);
    case 'offering': return s.offeringPaid;
    case 'minions': {
      let alive = 0;
      for (const x of s.enemies) if (x !== e && x.alive && d.enemies[x.def].category === 'minion') alive++;
      return alive >= (r.n ?? 2);
    }
    default: return false;
  }
}

export function killEnemy(s: CombatState, ei: number): void {
  const d = D();
  const e = s.enemies[ei];
  if (!e.alive) return;
  e.hp = Math.min(0, e.hp);
  const def = d.enemies[e.def];
  e.haewon = def.haewon.kind !== 'none' && haewonSatisfied(s, e);
  e.alive = false;
  e.dead = true;
  if (s.stats) {
    s.stats.kills++;
    if (def.haewon.kind !== 'none') {
      s.stats.haewonEligible++;
      const v = s.stats.enemyHaewon.get(def.id) ?? [0, 0];
      v[0]++;
      s.stats.enemyHaewon.set(def.id, v);
    }
  }
  if (e.haewon) haewonDone(s, e);
  // 무리 해원 (잡귀): 하나가 조건을 채우면 이미 쓰러진 같은 원귀도 해원
  if (e.haewon && def.haewon.group && !s.groupHaewon.includes(def.id)) {
    s.groupHaewon = [...s.groupHaewon, def.id];
    for (const x of s.enemies) if (x !== e && x.dead && !x.haewon && x.def === e.def) {
      x.haewon = true;
      haewonDone(s, x);
    }
  }
  log(s, `${def.name} 쓰러짐${e.haewon ? ' (해원)' : ''}`);
  // 수동 능력: 잡귀 무리, 상여꾼
  for (const x of s.enemies) {
    if (!x.alive) continue;
    const xd = d.enemies[x.def];
    if (def.id === 'japgwi' && xd.id === 'japgwi' && xd.passives.some((p) => p.includes('잡귀가 쓰러질'))) x.atkBonus += 1;
    if (def.category === 'minion' && xd.passives.some((p) => p.includes('상여꾼이 쓰러질')) && def.id === 'sangyeokkun') x.atkBonus += 3;
  }
  checkOutcome(s);
}

// ── 행동 목록 (봇·테스트용) ─────────────────────────────────────────
export function playableIndices(s: CombatState): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.hand.length; i++) if (canPlay(s, s.hand[i])) out.push(i);
  return out;
}
