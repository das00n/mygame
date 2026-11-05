// 전투 세션: 엔진(src/core)을 화면 흐름에 잇는다. 넋등(그늘·선제·기습·적 피해), 가호, 길굿 준비 효과를 전투 앞뒤에 건다.

import {
  addJangdan, addPersonal, aliveEnemies, canPlay, cloneState, collapsed, createCombat, drawCards, endPlayerTurn, enemyTurn, finishCombat,
  gainBlock, haewonSatisfied, playCard, standing, startPlayerTurn, TURN_CAP,
} from '../../../src/core/engine.ts';
import { enemyDamageMult, intentTargets, projectIncoming } from '../../../src/core/enemy.ts';
import { rand } from '../../../src/core/rng.ts';
import { DEFAULT_RULES, type ActionChoice, type CardInst, type CombatMods, type CombatState, type Encounter, type HeroId } from '../../../src/core/types.ts';
import { enumerateActions, evaluate } from '../../../src/sim/bot.ts';
import { D, ENEMY_EXTRA, bandOf } from './content.ts';
import { addCurse, addRunStress, afterFightRecovery, aliveIdx, buildResult, effMax, heroName, logRun, revealHaewon } from './run.ts';
import { swapHeroes } from '../../../src/core/engine.ts';
import type { AppState, BattleMeta, BattleSource, CombatSession, Run } from './types.ts';
import { keepsakeFor, makeReward } from './rewards.ts';
import { CD } from '../../../src/meta/content.ts';

// ── 조합 ─────────────────────────────────────────────────────────────
export const CUSTOM_ENC: Record<string, Encounter> = {
  ev_play: { id: 'ev_play', tier: 'easy', enemies: ['nori_saja', 'nori_saja', 'nori_saja'] },
  ev_escort: { id: 'ev_escort', tier: 'easy', enemies: ['japgwi', 'japgwi', 'japgwi'] },
  ev_heotgut: { id: 'ev_heotgut', tier: 'easy', enemies: ['japgwi', 'japgwi', 'japgwi', 'japgwi'] },
  ev_goksori: { id: 'ev_goksori', tier: 'easy', enemies: ['goksori_neok'] },
  // 지역 2·3 방 이벤트·기물의 전투
  ev_geumjul: { id: 'ev_geumjul', tier: 'hard', enemies: ['mungan_yeokgwi', 'dollim_japgwi', 'dollim_japgwi'] },
  ev_sonnim_chase: { id: 'ev_sonnim_chase', tier: 'hard', enemies: ['sonnim_subi', 'sonnim_subi', 'sonnim_subi'] },
  ev_sangmun: { id: 'ev_sangmun', tier: 'easy', enemies: ['sangmun_japgwi'] },
  ev_munsajae: { id: 'ev_munsajae', tier: 'hard', enemies: ['mundudeuri_gaekgwi', 'ireumeomneun_gunjol', 'ireumeomneun_gunjol'] },
  ev_sajabap: { id: 'ev_sajabap', tier: 'hard', enemies: ['julseon_neok', 'julseon_neok', 'nojatdon_gaekgwi'] },
  ev_buk: { id: 'ev_buk', tier: 'easy', enemies: ['ireumeomneun_gunjol', 'ireumeomneun_gunjol', 'ireumeomneun_gunjol'] },
  // 대문 방: 문지기와 겨룬다 (⟨반복 3⟩)
  ev_munjigi: { id: 'ev_munjigi', tier: 'easy', enemies: ['ireumeomneun_gunjol', 'ireumeomneun_gunjol', 'ireumeomneun_gunjol'] },
  sonnim: { id: 'sonnim', tier: 'elite', enemies: ['sonnim_subi', 'sonnim_subi'] },
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
  const pool = (run.region ?? 1) === 1 ? d.encounters : d.regionEncounters[run.region];
  const by = (t: string) => pool.filter((e) => e.tier === t).map((e) => e.id);
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

const ENERGY_RELICS = new Set(['cheonsin', 'samjichang', 'daesin_bangul', 'not_sonnimsang', 'musoe_yaktang', 'yeoldu_yeolsoe', 'musoe_jipangi']);

export function energyBonus(run: Run): number {
  return run.relics.filter((r) => ENERGY_RELICS.has(r)).length;
}

/** 가호 → 엔진 훅 (용왕·칠성·대신방울·삼신·대문 부적·부군·대동 깃발·손님의 배웅·신장·약수 한 사발) */
export function relicMods(run: Run): CombatMods {
  const has = (id: string) => run.relics.includes(id);
  const m: CombatMods = {};
  if (has('yongwang')) m.familyDmg = { family: '수귀', mult: 1.25 };
  // 캠페인 처벌 강도(06-base §8 ⟨반복 3⟩): 사망 판정 버틸 확률 +0.1 — 칠성 가호와 더한다
  const campaignSave = run.campaign ? CD.death.deathSave : 0;
  if (has('chilseong') || campaignSave) m.deathSave = (has('chilseong') ? 0.15 : 0) + campaignSave;
  if (has('daesin_bangul')) m.handMax = 8;
  if (has('samsin')) m.reviveFrac = 0.35;
  if (has('daemun_bujeok')) m.blockPollute = 1;
  if (has('bugun')) m.bugun = true;
  if (has('daedong_gi')) m.jangdanMax = 6;
  if (has('sonnim_baeung_gaho')) m.sinyeolFree = true;
  if (has('sinjang')) m.firstBlockBonus = 3;
  if (has('yaksu_sabal')) m.yaksu = true;
  if (has('myeongdo')) m.bladeSafeTurn = 1;
  if (run.flags.hoek === 'ready') m.hoek = true;
  return m;
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
  // 신열 (지역 2): 덫·기물 · 서운한 작별 · 대문 봉인(역귀 전투) · 놋 손님상
  const frontAlive = run.formation.find((i) => !run.heroes[i].dead) ?? aliveIdx(run)[0];
  const fevers: number[] = [...(run.next.fevers ?? [])];
  if (run.flags.sonnimPenalty && o.special !== 'sonnim') fevers.push(frontAlive);
  if (run.flags.sealPenalty && enc.enemies.some((id) => d.enemyById.get(id)?.family === '역귀')) fevers.push(frontAlive);
  if (run.relics.includes('not_sonnimsang')) fevers.push(frontAlive);
  for (const hi of fevers) {
    if (extra.length >= 4) break;
    if (run.heroes[hi] && !run.heroes[hi].dead) extra.push({ d: d.special.sinyeol, o: hi, o2: -1, orig: -1, x: -1 });
  }
  const threshold = run.threshold;
  const stressBefore = run.heroes.map((h) => h.stress);
  const sp = o.special === 'sonnim' ? d.specials.get('sonnim_baeung')! : null;
  const s = createCombat({
    party: run.heroes.map((h) => ({
      id: h.id, hp: h.hp, maxHp: h.baseMax, stress: Math.max(0, h.stress - threshold), injured: h.injured, recovering: h.recovering, dead: h.dead, level: h.level,
    })),
    deck: [...run.deck, ...extra], encounter: enc, seed: (rand(run) * 4294967296) | 0, record: true, jijeon: run.supplies.jijeon, log: true,
    rules: { ...DEFAULT_RULES, enemyDmgMult: band.enemyDmg, haewonHeal: run.relics.includes('jisin') ? 5 : DEFAULT_RULES.haewonHeal },
    provisions: { rice: run.supplies.rice, sul: run.supplies.sul, bujeok: run.supplies.bujeok, incense: run.supplies.incense },
    enemyHpMult: run.campaign?.enemyHpMult ?? 1, mods: relicMods(run), yaksuUsed: !!run.flags.yaksuUsed, nahwa: run.relics.includes('nahwa'),
    knotsPreset: o.tier === 'boss' ? run.flags.knots ?? 0 : 0,
    play: o.special === 'play', ward: o.special === 'escort' ? { name: '잘못 끌려온 사람', hp: 20 } : null,
    entertain: sp ? { goal: sp.goal, limit: sp.limit, start: run.flags.sonnimStart ?? 0 } : null,
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
  // 열두 대문 열쇠: 첫 턴 드로우 −1
  if (run.relics.includes('yeoldu_yeolsoe')) {
    let i = s.hand.length - 1;
    while (i >= 0 && d.special.offerings.has(s.hand[i].d)) i--;
    if (i >= 0) s.draw.push(s.hand.splice(i, 1)[0]);
  }
  // 길굿·기물 준비 효과
  const idxOf = (id: HeroId) => s.heroes.findIndex((h) => h.id === id && standing(h));
  if (run.next.jangdan) addJangdan(s, run.next.jangdan);
  if (run.relics.includes('janggun_bukchae')) addJangdan(s, 1);
  const jf = run.flags.jangdanFights;
  if (jf && jf.left > 0) {
    addJangdan(s, jf.n);
    jf.left--;
  }
  if (run.next.weakAll) for (const h of s.heroes) if (standing(h)) h.weak += run.next.weakAll;
  const possessN = (run.next.possess ?? 0) + (run.flags.crow ? 1 : 0);
  if (possessN) {
    const up = s.heroes.filter((h) => standing(h));
    if (up.length) up[Math.floor(rand(run) * up.length)].possess += possessN;
  }
  if (run.next.chasaBlock && idxOf('chasa') >= 0) gainBlock(s, idxOf('chasa'), run.next.chasaBlock);
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
  // 명도 한 닢: 모든 영웅의 개인 자원 +1 — 작두박수는 작두에 오른 채(첫 턴 헛디딤 없음), 탈꾼은 한 칸 앞으로(탈이 바뀜)
  if (run.relics.includes('myeongdo')) {
    for (const h of s.heroes) {
      if (!standing(h)) continue;
      if (h.id === 'talggun') {
        const i = s.formation.indexOf(h.idx);
        if (i > 0) swapHeroes(s, h.idx, s.formation[i - 1]);
        else if (s.formation.length > 1) swapHeroes(s, h.idx, s.formation[1]);
      } else addPersonal(s, h.idx, 1);
    }
  }
  s.energy += energyBonus(run);
  const meta: BattleMeta = {
    enc: enc.id, tier: o.tier, src: o.src, cardReward: o.cardReward, special: o.special ?? 'none', start, shadows, enemyDmg: band.enemyDmg,
    hpBefore: run.heroes.map((h) => h.hp), stressBefore, threshold, fleeTries: 0, jeseokRun: 0, jeseokTurn: -1, sansinTurn: -1, log: [], seenDead: [],
    toasts: [], turnStartedAt: Date.now(),
  };
  run.next = { wounds: [] };
  for (const id of enc.enemies) if (!run.track.met.includes(id)) run.track.met.push(id);
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
  if (cs.meta.special === 'play' && s.turn >= PLAY_TURNS) {
    cs.meta.log.push(`${PLAY_TURNS}턴이 지나도록 사자들을 이기지 못했다 — 놀이 싸움은 사자들의 승리`);
    s.outcome = 1;
    playLost = true;
    return finishBattle(app);
  }
  if (s.turn >= TURN_CAP) {
    s.outcome = -1;
    return finishBattle(app);
  }
  s.nextEnergy += energyBonus(run);
  startPlayerTurn(s);
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

/** 놀이 싸움 제한 턴 (이 턴의 적 차례가 끝나도 사자가 남으면 진다) */
export const PLAY_TURNS = 5;
let playLost = false;

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
  run.supplies.rice = s.prov.rice;
  run.supplies.sul = s.prov.sul;
  run.supplies.bujeok = s.prov.bujeok;
  run.supplies.incense = s.prov.incense;
  if (s.yaksuUsed) run.flags.yaksuUsed = true;
  if (s.hoekUsed) run.flags.hoek = 'used';
  // 진형 유지: 전투가 끝난 자리 그대로 다음 전투를 시작한다
  const alive = s.formation.filter((i) => !run.heroes[i].dead);
  run.formation = [...alive, ...run.formation.filter((i) => !alive.includes(i))];
  const st = s.stats!;
  run.track.revived.push(...st.revived);
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
  if (cs.meta.special === 'escort' && s.ward?.lost) return finishEscortLost(app);
  if (cs.meta.special === 'sonnim' && s.outcome === 1) return finishSonnim(app);
  finishCombat(s);
  const win = s.outcome === 1;
  const st = s.stats!;
  for (const [id, [, h]] of st.enemyHaewon) if (h) run.track.haewonById[id] = (run.track.haewonById[id] ?? 0) + h;
  run.stats.haewons += st.haewons;
  run.stats.haewonEligible += st.haewonEligible;
  run.stats.kills += st.kills;
  run.stats.escapes += st.escapes;
  // 해원록: 한 번 만난 원귀는 해원 조건이 기록된다 (새로 적은 것은 보상 화면에 알린다)
  const newly = noteCodex(run, s);
  const endDowned = syncHeroes(app);
  if (!win) {
    // 전멸: 영웅마다 마지막 사망 판정(버틸 확률 50%, 캠페인은 처벌 강도 CD.death.wipeSurvive — 06-base §8 ⟨반복 3⟩)
    const survive = run.campaign ? CD.death.wipeSurvive : 0.5;
    for (const h of run.heroes) {
      if (h.dead) continue;
      if (rand(run) >= survive) {
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
  // 해원 → 파티 귀기 −5 / 해원 (소지 한 장: −3 더)
  const perHaewon = 5 + (run.relics.includes('soji_hanjang') ? 3 : 0);
  if (st.haewons) for (const i of aliveIdx(run)) addRunStress(run, i, -perHaewon * st.haewons, false);
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
    const fam = d.enemies[e.def].family;
    if (ex.drops.material) {
      const tbl = e.haewon ? run.track.haewonByFamily : run.track.killByFamily;
      tbl[fam] = (tbl[fam] ?? 0) + 1;
    }
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
  if (st.haewons) lines.push(`해원 ${st.haewons} — 파티 귀기 −${perHaewon * st.haewons}, 재료 두 배`);
  if (newly.length) lines.push(`해원록에 새로 적었다: ${newly.join(' · ')}`);
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
  reward.keepsake = keepsakeFor(s);
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

/** 해원록: 처음 만난 원귀의 해원 조건이 적힌다 (반복 2: 새로 적은 것을 알린다) */
function noteCodex(run: Run, s: CombatState): string[] {
  const d = D();
  const ids = [...new Set(s.enemies.map((e) => d.enemies[e.def].id))].filter((id) => ENEMY_EXTRA.get(id)?.haewon);
  return revealHaewon(run, ids).map((id) => d.enemyById.get(id)?.name ?? id);
}

/** 사자 검문 놀이 싸움 (08 §3.3 → 반복 2): 놀이 사자 셋, 영웅이 받는 피해는 전투 안에서 바로 귀기로 들어간다(쓰러지지 않는다). 이기면 엽전 20, 5턴 안에 못 이기면 귀기 +15. 어느 쪽이든 통과 */
function finishPlayFight(app: AppState): void {
  const cs = app.combat!;
  const run = app.run!;
  const s = cs.s;
  const win = s.outcome === 1 && !playLost && s.enemies.every((e) => !e.alive);
  playLost = false;
  const st = s.stats!;
  for (const [k, v] of st.plays) run.stats.plays[k] = (run.stats.plays[k] ?? 0) + v;
  const lines: string[] = [];
  run.heroes.forEach((p, i) => {
    if (p.dead) return;
    const h = s.heroes[i];
    const passed = Math.max(0, cs.meta.stressBefore[i] - cs.meta.threshold);
    const gained = h.stress - passed;
    if (gained) addRunStress(run, i, gained, false);
    if (gained > 0) lines.push(`${heroName(p.id)}: 받은 피해만큼 귀기 +${gained}`);
  });
  for (const [hi, cd] of s.newCurses) run.deck.push({ d: cd, o: hi, o2: -1, orig: -1, x: -1 });
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

/** 호위 실패: 산 사람이 쓰러졌다 — 귀기 +10 (영웅의 체력·죽음은 그대로 남는다) */
function finishEscortLost(app: AppState): void {
  const cs = app.combat!;
  const run = app.run!;
  syncHeroes(app);
  for (const i of aliveIdx(run)) addRunStress(run, i, 10, false);
  markDone(run, cs.meta.src);
  app.reward = {
    title: '호위 실패', gold: 0, materials: 0, lines: ['잡귀가 잘못 끌려온 사람을 놓치지 않았다. 그 사람은 다시 저승 어귀를 헤맨다 — 파티 귀기 +10'], cards: null, cardsTaken: true,
    flags: null, relics: null, relicPicked: true, rareCards: null, rarePicked: true, bossEnd: false,
  };
  logRun(run, '호위 실패 — 귀기 +10');
  app.combat = null;
  app.screen = 'reward';
}

/** 손님 배웅 (05-region2 §9.3): 좋게 배웅 → 엽전 45·치성 1·희귀 가호 「손님의 배웅」·해원록. 서운한 작별 → 이번 원정 동안 전투 시작 시 신열 */
function finishSonnim(app: AppState): void {
  const cs = app.combat!;
  const run = app.run!;
  const s = cs.s;
  const ok = s.entertain?.result === 'sendoff';
  const endDowned = syncHeroes(app);
  afterFightRecovery(run, endDowned);
  run.flags.sonnimDone = true;
  const lines: string[] = [];
  if (ok) {
    run.gold += 45;
    run.chiseong += 1;
    run.stats.haewons += 1;
    run.stats.haewonEligible += 1;
    run.track.haewonById.sonnim_baeung = (run.track.haewonById.sonnim_baeung ?? 0) + 1;
    if (!run.relics.includes('sonnim_baeung_gaho')) run.relics.push('sonnim_baeung_gaho');
    lines.push('손님이 흐뭇하게 떠났다 — 엽전 45 · 치성 1 · 희귀 가호 「손님의 배웅」(신열을 내는 데 에너지가 들지 않는다, 턴당 1회)');
    lines.push('해원록: 손님을 좋게 보냄');
  } else {
    run.flags.sonnimPenalty = true;
    lines.push('대접이 모자라 손님이 서운하게 떠났다 — 이번 원정 동안 전투 시작 시 신열 1장');
  }
  run.stats.wins += 1;
  markDone(run, cs.meta.src);
  app.reward = {
    title: ok ? '손님 배웅 — 좋게 보냄' : '손님 배웅 — 서운한 작별', gold: ok ? 45 : 0, materials: 0, lines, cards: null, cardsTaken: true, flags: null, relics: null,
    relicPicked: true, rareCards: null, rarePicked: true, bossEnd: false,
  };
  logRun(run, lines[0]);
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
