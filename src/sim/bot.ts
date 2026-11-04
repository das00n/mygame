// 휴리스틱 봇: 한 수 앞보기 탐욕.
// 매 걸음 (손패 카드 × 그럴듯한 대상)마다 상태를 복제해 카드를 내 보고, 결과 상태를 점수로 매겨
// "턴 종료"보다 나으면 가장 좋은 수를 둔다. 점수 = 적 체력 제거(명부·상흔 처형 예측 포함) + 해원 진척
// − 보이는 의도로 예측한 피해(쓰러진 영웅 피격은 사망 위험으로 크게) + 장단·자원·굿상·능력·손패 잠재값.

import {
  aliveEnemies, canPlay, capActive, cloneState, collapsed, D, endPlayerTurn, enemyTurn, finishCombat, haewonSatisfied, playCard,
  popcount, startPlayerTurn, standing, TURN_CAP, deathSaveChance,
} from '../core/engine.ts';
import { projectIncoming } from '../core/enemy.ts';
import type { ActionChoice, CardDef, CombatState, EnemyState, HeroState, Op } from '../core/types.ts';

export const W = {
  dmg: 1.0,
  kill: 6,
  haewon: 9,
  /** 해원할 수 있었는데(덱이 그 조건을 만들 수 있는데) 그냥 쓰러뜨리면 잃는 몫 (해원 가치 대비) */
  haewonMiss: 1.2,
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
  /** 신열: 손에 든 채 턴을 마치면 약화 + 옮김 · 더미에 남으면 다시 돈다 (05-region2 §9.1) */
  sinyeolHand: 3,
  sinyeolDeck: 1,
  /** 손님 배웅: 대접 1점 (05-region2 §9.3) */
  entertain: 5,
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
      if (r.orCollapse && collapsed(s, e)) return 1;
      return Math.min(1, v / (r.n ?? 1));
    }
    case 'jangdan': return Math.min(1, s.jangdan / (r.n ?? 3));
    case 'summons': return s.summons.length ? 1 : 0;
    case 'formation': return s.formChanges ? 1 : 0;
    case 'collapse': return collapsed(s, e) ? 1 : e.shake / e.endure;
    case 'offering': return s.offeringPaid ? 1 : 0;
    case 'minions': return haewonSatisfied(s, e) ? 1 : 0;
    case 'knots': return Math.min(1, popcount(e.knots) / (r.need ?? 4));
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
      // 이미 걸린 상흔만으로 언젠가 쓰러질 졸개는 없는 셈 친다
      const bleedOut = x.bleed > 0 && x.hp + x.block <= (x.bleed * (x.bleed + 1)) / 2;
      if (x.alive && !skip[i] && !bleedOut && d.enemies[x.def].category === 'minion') minions++;
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

// 덱(뽑을·손·버린 더미)이 해원 조건을 만들 수 있는가 — 카드 정의마다 캐시
const produceCache = new Map<number, string[]>();
function producesOf(defIdx: number): string[] {
  let v = produceCache.get(defIdx);
  if (v) return v;
  const out = new Set<string>();
  const walk = (ops: Op[]) => {
    for (const o of ops) {
      if (o.op === 'apply') out.add(o.status);
      if (o.op === 'summon') out.add('summons');
      if (o.op === 'move' && !o.when) out.add('formation');
      if (o.op === 'token') {
        const t = D().cards[o.tidx];
        if (t.effects.some((x) => x.op === 'dmg')) out.add('token');
        walk(t.effects);
      }
      if (o.op === 'per') walk(o.each);
      if (o.op === 'cond') walk(o.then);
      if (o.op === 'power') walk(o.effects);
    }
  };
  const def = D().cards[defIdx];
  walk(def.effects);
  if (def.isAttack && def.heroes.some((h) => D().heroes.get(h)?.range === 'melee')) out.add('formation');
  v = [...out];
  produceCache.set(defIdx, v);
  return v;
}

function feasibleHaewon(s: CombatState): Set<string> {
  const f = new Set<string>(['jangdan', 'offering', 'minions', 'knots']);
  for (const pile of [s.hand, s.draw, s.discard]) for (const c of pile) for (const x of producesOf(c.d)) f.add(x);
  if (f.has('넋흔들림')) f.add('collapse');
  return f;
}

function personalValue(s: CombatState, h: HeroState): number {
  switch (h.id) {
    case 'posu': return h.personal * 2.5;
    case 'chasa': return h.personal * 2.5;
    case 'seungnyeo': return h.personal * 0.8;
    case 'beopsa': return h.personal * 1.5;
    case 'manshin': return h.personal * 1.5 + (s.gangsin ? 4 : 0);
    case 'jaebi': return h.personal * 2;
    case 'baksu': return h.stance ? 6 : 0;
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
  const feas = feasibleHaewon(s);
  const missed = (e: EnemyState) => {
    const r = d.enemies[e.def].haewon;
    return r.kind !== 'none' && !e.escaped && feas.has(r.kind === 'status' ? r.status! : r.kind);
  };
  const guardedMinion = s.enemies.some((x) => x.alive && !!d.enemies[x.def].pattern.override);
  // 해원 가치 = 기본(재료·귀기) + 규칙상 해원 회복(서 있는 영웅 모두)
  let standingN = 0;
  for (const h of s.heroes) if (standing(h)) standingN++;
  const haewonV = W.haewon + (s.rules.haewonHeal ?? 0) * standingN * W.hp;
  for (let i = 0; i < s.enemies.length; i++) {
    const e = s.enemies[i];
    if (e.escaped) continue;
    // 보스가 다시 불러내는 넋은 죽여도 곧 돌아온다 → 처치 가치를 낮춘다.
    // 무리 보스의 override 문턱(상여꾼 N명 이하)이 걸린 졸개는 건드릴 가치가 거의 없다(해원 조건도 살려 두라고 한다)
    const respawn = e.summoned ? 0.35 : guardedMinion && d.enemies[e.def].category === 'minion' ? 0.1 : 1;
    if (!e.alive) {
      score += (e.maxHp * W.dmg + W.kill + threatOf(e)) * respawn + (e.haewon ? W.haewon : missed(e) ? -W.haewonMiss * haewonV : 0);
      continue;
    }
    const mult = (e.vuln > 0 ? 1.5 : 1) * (collapsed(s, e) ? 1.5 : 1);
    let hp = e.hp;
    const inc = (te.all + te.random / nA + (i === al[0] ? te.front : 0)) * mult;
    // 빗장: 턴 종료 피해도 남은 상한까지만 (05-region3 §9.1)
    const capped = capActive(s, e);
    let through = Math.max(0, inc - e.block);
    if (capped) through = Math.min(through, Math.max(0, d.enemies[e.def].cap!.n - e.capLost));
    hp -= through;
    let dies = hp <= 0;
    if (!dies && e.doom > 0 && e.doom >= (s.seokja && e.bound ? Math.ceil(hp / 2) : hp)) dies = true;
    if (!dies && e.bleed > 0) {
      hp -= e.bleed;
      if (hp <= 0) dies = true;
    }
    if (dies) {
      skip[i] = true;
      score += (e.maxHp * W.dmg + W.kill + threatOf(e)) * respawn + (haewonSatisfied(s, e) ? haewonV * 0.9 : missed(e) ? -W.haewonMiss * haewonV : 0);
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
    // 빗장 원귀 앞에서는 상한을 넘는 상태(상흔·명부·넋흔들림)의 값이 크다
    if (capped) st *= 1.5;
    score += st * f;
    score -= e.block * 0.3;
    score -= e.atkBonus * 2.5; // 누적된 공격 보너스 = 앞으로 받을 피해
    if (d.enemies[e.def].haewon.kind !== 'none') score += haewonProgress(s, e) * (W.haewonProgress + 0.3 * (haewonV - W.haewon)) * (1 - hp / e.maxHp);
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
    // 작두 위에서 장단 2 미만으로 턴을 마치면 헛디딤(체력 6, 방어도 무시)
    const fall = h.id === 'baksu' && h.stance && s.jangdan < 2 ? 6 : 0;
    const loss = Math.min(unb + fall, h.hp);
    score += (h.hp - loss) * hpW;
    if (unb + fall >= h.hp) {
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
  // 신열: 손에 남기면 약화·옮김, 더미에 있으면 다시 손에 온다 → 에너지가 남으면 땀을 낸다
  const sy = d.special.sinyeol;
  for (const c of s.hand) if (c.d === sy && c.o >= 0 && standing(s.heroes[c.o])) score -= W.sinyeolHand;
  for (const pile of [s.draw, s.discard]) for (const c of pile) if (c.d === sy) score -= W.sinyeolDeck;
  // 손님 배웅: 대접 게이지 (좋게 보내면 전투가 끝난다)
  if (s.entertain) score += Math.min(s.entertain.value, s.entertain.goal) * W.entertain;
  // 호위: 선두에 방어도가 없으면 선두를 노린 공격을 산 사람이 맞는다
  if (s.ward && !s.ward.lost) {
    const f = s.formation[0];
    const atFront = f !== undefined ? inc.dmg[f] : 0;
    const exposed = f !== undefined && s.heroes[f].block <= 0 ? atFront : 0;
    score += s.ward.hp * 3 - Math.min(s.ward.hp, exposed) * 3 - (exposed >= s.ward.hp ? 200 : 0);
  }
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
