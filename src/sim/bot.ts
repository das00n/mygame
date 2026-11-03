// 휴리스틱 봇: 한 수 앞보기 탐욕.
// 매 걸음 (손패 카드 × 그럴듯한 대상)마다 상태를 복제해 카드를 내 보고, 결과 상태를 점수로 매겨
// "턴 종료"보다 나으면 가장 좋은 수를 둔다. 점수 = 적 체력 제거(명부·상흔 처형 예측 포함) + 해원 진척
// − 보이는 의도로 예측한 피해(쓰러진 영웅 피격은 사망 위험으로 크게) + 장단·자원·굿상·능력·손패 잠재값.

import {
  aliveEnemies, canPlay, cloneState, collapsed, D, endPlayerTurn, enemyTurn, finishCombat, haewonSatisfied, playCard,
  startPlayerTurn, standing, TURN_CAP, deathSaveChance,
} from '../core/engine.ts';
import { projectIncoming } from '../core/enemy.ts';
import type { ActionChoice, CardDef, CombatState, EnemyState, HeroState, Op } from '../core/types.ts';

export const W = {
  dmg: 1.0,
  kill: 6,
  haewon: 9,
  haewonProgress: 3,
  hp: 1.3,
  down: 28,
  downed: 24,
  death: 170,
  rescue: 26,
  potential: 0.4,
  summon: 0.5,
  power: 0.8,
  jangdan: 0.5,
  offering: 14,
  stress: 0.15,
};

// ── 정적 추정 캐시 ──────────────────────────────────────────────────
const threatCache = new Map<number, number>();
function threatOf(e: EnemyState): number {
  let t = threatCache.get(e.def);
  if (t === undefined) {
    const def = D().enemies[e.def];
    let sum = 0;
    let n = 0;
    for (const it of def.intents) {
      n++;
      if (it.damage) sum += it.damage * (it.hits ?? 1) * (it.target === '전체' ? 2.5 : 1);
      if (it.kind === 'stress' || it.kind === 'pollute' || it.kind === 'possess') sum += 4;
    }
    t = n ? sum / n : 0;
    threatCache.set(e.def, t);
  }
  return t + e.atkBonus;
}

interface DmgEst { all: number; random: number; front: number }

function estOps(ops: Op[], s: CombatState, out: DmgEst, mult: number): void {
  for (const op of ops) {
    if (op.op === 'dmg') {
      const v = op.n * op.hits * mult;
      if (op.target === 'all') out.all += v;
      else if (op.target === 'random') out.random += v;
      else out.front += v;
    } else if (op.op === 'per') {
      let c = 0;
      if (op.mode === 'jangdan') c = s.jangdan;
      else if (op.mode === 'summons') c = s.summons.length;
      else continue;
      estOps(op.each, s, out, mult * c);
    }
  }
}

/** 턴 종료에 굿상·능력이 줄 피해 */
function turnEndDamage(s: CombatState): DmgEst {
  const d = D();
  const out: DmgEst = { all: 0, random: 0, front: 0 };
  for (const x of s.summons) {
    const sd = d.summons[x.s];
    if (sd.trigger === 'turn_end') estOps(sd.effects, s, out, 1);
  }
  for (const p of s.powers) {
    if (p.trigger !== 'turn_end') continue;
    if (p.owner >= 0 && !standing(s.heroes[p.owner])) continue;
    estOps(p.effects, s, out, 1);
  }
  return out;
}

function haewonProgress(s: CombatState, e: EnemyState): number {
  const def = D().enemies[e.def];
  const r = def.haewon;
  switch (r.kind) {
    case 'status': {
      const v = r.status === '점지' ? e.mark : r.status === '명부' ? e.doom : r.status === '넋흔들림' ? e.shake : e.bleed;
      return Math.min(1, v / (r.n ?? 1));
    }
    case 'jangdan': return Math.min(1, s.jangdan / (r.n ?? 3));
    case 'summons': return s.summons.length ? 1 : 0;
    case 'formation': return s.formChanges ? 1 : 0;
    case 'collapse': return collapsed(s, e) ? 1 : e.shake / e.endure;
    case 'offering': return s.offeringPaid ? 1 : 0;
    case 'minions': return haewonSatisfied(s, e) ? 1 : 0;
    default: return 0;
  }
}

function overrideDanger(s: CombatState, skip: boolean[]): number {
  const d = D();
  let pen = 0;
  for (const e of s.enemies) {
    if (!e.alive) continue;
    const def = d.enemies[e.def];
    const ov = def.pattern.override;
    if (!ov) continue;
    const m = ov.match(/(\d+)명 이하/);
    const id = ov.match(/매 턴\s*(\w+)/)?.[1];
    const it = def.intents.find((x) => x.id === id);
    if (!m || !it) continue;
    let minions = 0;
    s.enemies.forEach((x, i) => {
      if (x.alive && !skip[i] && d.enemies[x.def].category === 'minion') minions++;
    });
    if (minions <= Number(m[1])) {
      const targets = it.target === '전체' ? s.formation.length : 1;
      pen += ((it.damage ?? 0) + e.atkBonus) * (it.hits ?? 1) * targets * 2;
    }
  }
  return pen;
}

const jdCache = new Map<number, boolean>();
function usesJangdan(defIdx: number): boolean {
  let v = jdCache.get(defIdx);
  if (v === undefined) {
    const walk = (ops: Op[]): boolean =>
      ops.some((o) => (o.op === 'per' && (o.mode === 'jangdan' || walk(o.each))) || (o.op === 'cond' && (o.cond.k === 'jangdan' || o.cond.k === 'jangdan5' || walk(o.then))));
    v = walk(D().cards[defIdx].effects);
    jdCache.set(defIdx, v);
  }
  return v;
}

function personalValue(s: CombatState, h: HeroState): number {
  switch (h.id) {
    case 'posu': return h.personal * 2.5;
    case 'chasa': return h.personal * 2.5;
    case 'seungnyeo': return h.personal * 0.8;
    case 'beopsa': return h.personal * 1.5;
    case 'manshin': return h.personal * 1.5 + (s.gangsin ? 4 : 0);
    case 'jaebi': return h.personal * 2;
    case 'baksu': return h.stance ? (s.jangdan >= 2 ? 6 : 2) : 0;
    default: return 0;
  }
}

function potential(s: CombatState): number {
  const d = D();
  let energy = s.energy;
  let total = 0;
  const costed: CardDef[] = [];
  for (const c of s.hand) {
    if (!canPlay(s, c)) continue;
    const def = d.cards[c.d];
    if (c.d === d.special.rescue || c.d === d.special.offering) continue;
    if (def.cost === 0) total += Math.max(0, def.value);
    else costed.push(def);
  }
  costed.sort((a, b) => b.value / b.cost - a.value / a.cost);
  for (const def of costed) {
    if (def.cost <= energy) {
      energy -= def.cost;
      total += Math.max(0, def.value);
    }
  }
  return total;
}

function deathRisk(h: HeroState, unbHits: number): number {
  let survive = 1;
  const whole = Math.floor(unbHits);
  for (let k = 0; k < whole; k++) survive *= deathSaveChance(h.survived + k);
  const frac = unbHits - whole;
  if (frac > 0) survive *= 1 - frac * (1 - deathSaveChance(h.survived + whole));
  return 1 - survive;
}

export function evaluate(s: CombatState, withPotential = true): number {
  const d = D();
  let heroHp = 0;
  for (const h of s.heroes) if (!h.dead) heroHp += h.hp;
  if (s.outcome === 1) return 1e6 + heroHp * 10 - s.heroes.filter((h) => h.dead).length * 1000;
  if (s.outcome === -1) return -1e6;
  let score = 0;
  const te = turnEndDamage(s);
  const al = aliveEnemies(s);
  const nA = al.length || 1;
  const skip: boolean[] = new Array(s.enemies.length).fill(false);
  const markV = 1.6;
  for (let i = 0; i < s.enemies.length; i++) {
    const e = s.enemies[i];
    if (e.escaped) continue;
    // 보스가 다시 불러내는 넋은 죽여도 곧 돌아온다 → 처치 가치를 낮춘다
    const respawn = e.summoned ? 0.35 : 1;
    if (!e.alive) {
      score += (e.maxHp * W.dmg + W.kill + threatOf(e)) * respawn + (e.haewon ? W.haewon : 0);
      continue;
    }
    const mult = (e.vuln > 0 ? 1.5 : 1) * (collapsed(s, e) ? 1.5 : 1);
    let hp = e.hp;
    const inc = (te.all + te.random / nA + (i === al[0] ? te.front : 0)) * mult;
    hp -= Math.max(0, inc - e.block);
    let dies = hp <= 0;
    if (!dies && e.doom > 0 && e.doom >= (s.seokja && e.bound ? Math.ceil(hp / 2) : hp)) dies = true;
    if (!dies && e.bleed > 0) {
      hp -= e.bleed;
      if (hp <= 0) dies = true;
    }
    if (dies) {
      skip[i] = true;
      score += (e.maxHp * W.dmg + W.kill + threatOf(e)) * respawn + (haewonSatisfied(s, e) ? W.haewon * 0.9 : 0);
      continue;
    }
    score += (e.maxHp - hp) * W.dmg * respawn;
    const f = Math.min(1, hp / 15);
    let st = 0;
    st += Math.min(e.vuln, 3) * 3.0;
    st += Math.max(0, e.weak - 1) * 1.5;
    st += Math.min(e.mark, 8) * markV;
    st += e.doom * 0.9;
    st += (e.shake / e.endure) * 8 + e.shake * 0.25;
    st += Math.min(hp, ((e.bleed - 1) * e.bleed) / 2) * 0.6;
    if (collapsed(s, e) && s.turn + 1 <= e.collapseUntil) st += 4;
    if (e.bound) st += 1;
    score += st * f;
    score -= e.block * 0.3;
    score -= e.atkBonus * 2.5; // 누적된 공격 보너스 = 앞으로 받을 피해
    if (d.enemies[e.def].haewon.kind !== 'none') score += haewonProgress(s, e) * W.haewonProgress * (1 - hp / e.maxHp);
  }
  // 무리 보스의 override("상여꾼 N명 이하이면 매 턴 c"): 그 문턱을 넘으면 매 턴 받을 전체 피해
  score -= overrideDanger(s, skip);
  // 예측 피해
  const inc = projectIncoming(s, skip);
  for (const h of s.heroes) {
    if (h.dead) {
      score -= 200;
      continue;
    }
    const incoming = inc.dmg[h.idx];
    const unb = Math.max(0, incoming - h.block);
    if (h.downed) {
      score -= W.downed;
      score += (W.rescue * h.rescue) / h.rescueNeed;
      if (unb > 0) {
        const hits = inc.hits[h.idx] * Math.min(1, unb / Math.max(1, incoming));
        score -= W.death * deathRisk(h, hits);
      }
      if (s.formation[0] === h.idx) score -= 4;
      continue;
    }
    const hpW = W.hp * (1 + (1 - h.hp / h.maxHp));
    const loss = Math.min(unb, h.hp);
    score += (h.hp - loss) * hpW;
    if (unb >= h.hp) {
      score -= W.down;
      // 쓰러진 뒤 같은 적 턴에 남은 타격 → 사망 판정
      const after = inc.hits[h.idx] * Math.max(0, (unb - h.hp) / Math.max(1, incoming));
      if (after > 0) score -= W.death * deathRisk(h, after);
    }
    score -= h.possess * 3 + h.weak * 1.5 + h.stress * W.stress;
    score += personalValue(s, h);
  }
  score -= inc.stress * 0.25 * s.heroes.length + inc.pollute * 1.2 + inc.summonLoss * 4;
  // 앞으로의 가치
  for (const x of s.summons) {
    const sd = d.summons[x.s];
    score += (x.left - (sd.trigger === 'turn_end' ? 1 : 0)) * sd.value * W.summon;
  }
  // 낸 능력 카드 (power op 이든 이름 석 자·삼현육각 같은 special 이든) — 주인이 쓰러지면 정지
  for (const c of s.powerZone) {
    if (c.o >= 0 && !standing(s.heroes[c.o])) continue;
    if (c.o2 >= 0 && !standing(s.heroes[c.o2])) continue;
    score += d.cards[c.d].value * W.power;
  }
  if (withPotential) score += potential(s) * W.potential;
  // 장단: 손에 장단을 쓰는 카드(장단 1당·장단 N 이상)가 남아 있으면 더 값지다 → 먼저 쌓고 나중에 터뜨린다
  let users = 0;
  for (const c of s.hand) if (usesJangdan(c.d) && canPlay(s, c)) users++;
  score += s.jangdan * (W.jangdan + 1.2 * Math.min(2, users));
  if (s.offeringPaid) score += W.offering;
  const front = s.heroes[s.formation[0]];
  if (front && standing(front)) score += front.hp * 0.05 + front.block * 0.02;
  return score;
}

// ── 행동 열거 ───────────────────────────────────────────────────────
export function enumerateActions(s: CombatState): ActionChoice[] {
  const d = D();
  const out: ActionChoice[] = [];
  const seen = new Set<string>();
  const al = aliveEnemies(s);
  for (let i = 0; i < s.hand.length; i++) {
    const c = s.hand[i];
    if (!canPlay(s, c)) continue;
    const key = `${c.d}:${c.o}:${c.o2}:${c.x}:${c.orig}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const def = d.cards[c.d];
    const enemies = def.needsEnemy ? (al.length ? al : [-1]) : [-1];
    let allies: number[] = [-1];
    let pairs: ([number, number] | null)[] = [null];
    const others = s.heroes.filter((h) => !h.dead && h.idx !== c.o).map((h) => h.idx);
    if (def.allyChoice === 'ally' && others.length) allies = others;
    else if (def.allyChoice === 'downed') allies = s.heroes.filter((h) => !h.dead).map((h) => h.idx);
    else if (def.allyChoice === 'pair') {
      const f = s.formation;
      pairs = [];
      for (let a = 0; a < f.length; a++) for (let b = a + 1; b < f.length; b++) pairs.push([f[a], f[b]]);
      if (!pairs.length) pairs = [null];
    }
    for (const en of enemies) {
      let en2 = -1;
      if (def.needsEnemy2 && en >= 0) {
        let best = -1;
        for (const j of al) if (j !== en && (best < 0 || s.enemies[j].hp > s.enemies[best].hp)) best = j;
        en2 = best >= 0 ? best : en;
      }
      for (const a of allies) for (const p of pairs) out.push({ hand: i, enemy: en, enemy2: en2, ally: a, pair: p });
    }
  }
  return out;
}

export interface BotOptions {
  /** lookahead 난수를 흔들어 우연한 결과를 미리 알지 못하게 한다 */
  perturb: boolean;
}

export function playTurn(s: CombatState, opts: BotOptions = { perturb: true }): void {
  let guard = 0;
  while (s.outcome === 0 && guard++ < 40) {
    // 턴을 마치면 손패는 버려지므로 기준점에는 손패 잠재값을 넣지 않는다
    const base = evaluate(s, false);
    let best: ActionChoice | null = null;
    let bestScore = base + 0.05;
    for (const a of enumerateActions(s)) {
      const c = cloneState(s);
      if (opts.perturb) c.rng = (c.rng ^ 0x5bd1e995) | 0;
      playCard(c, a);
      const sc = evaluate(c);
      if (sc > bestScore) {
        bestScore = sc;
        best = a;
      }
    }
    if (!best) break;
    playCard(s, best);
  }
}

export interface CombatRun {
  timeout: boolean;
}

export function runCombat(s: CombatState, opts?: BotOptions): CombatRun {
  let timeout = false;
  while (s.outcome === 0) {
    if (s.turn > TURN_CAP) {
      s.outcome = -1;
      timeout = true;
      break;
    }
    playTurn(s, opts);
    endPlayerTurn(s);
    if (s.outcome !== 0) break;
    enemyTurn(s);
    if (s.outcome !== 0) break;
    startPlayerTurn(s);
  }
  finishCombat(s);
  return { timeout };
}
