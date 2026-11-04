// 적 AI: 의도 선택(cycle·weighted·phased·override), 의도 실행, 봇이 읽는 피해 예측.
// region1.json 의 effect 문장을 해석한다 (§13 대상 확장 포함).

import {
  addOwnedStatus, addStatusCard, addStress, checkOutcome, D, hitHero, makeEnemy, moveToFront, shuffleFormation, standing,
} from './engine.ts';
import { rand } from './rng.ts';
import type { CombatState, EnemyDef, EnemyState, RawIntent, RawPattern } from './types.ts';

function intentIndex(def: EnemyDef, id: string): number {
  return def.intents.findIndex((i) => i.id === id);
}

function overrideActive(s: CombatState, def: EnemyDef, pat: RawPattern): boolean {
  if (!pat.override) return false;
  const m = pat.override.match(/(\d+)명 이하/);
  if (!m) return false;
  let alive = 0;
  for (const x of s.enemies) if (x.alive && D().enemies[x.def].category === 'minion') alive++;
  void def;
  return alive <= Number(m[1]);
}

export function chooseIntent(s: CombatState, e: EnemyState): void {
  const def = D().enemies[e.def];
  let pat = def.pattern;
  if (pat.override && overrideActive(s, def, pat)) {
    const m = pat.override.match(/매 턴\s*(\w+)/);
    const id = m ? m[1] : def.intents[def.intents.length - 1].id;
    setIntent(e, intentIndex(def, id));
    return;
  }
  if (pat.type === 'phased' && pat.phases) {
    const p0 = pat.phases[0] as RawPattern;
    if (e.phase === 0 && p0.until_hp_pct !== undefined && e.hp * 100 <= e.maxHp * p0.until_hp_pct) {
      e.phase = 1;
      e.patIdx = 0;
    }
    pat = pat.phases[Math.min(e.phase, pat.phases.length - 1)] as RawPattern;
  }
  let id: string;
  if (pat.type === 'weighted') {
    if (e.patIdx === 0 && pat.first) id = pat.first;
    else {
      const w = pat.weights ?? {};
      const lastId = e.last >= 0 ? def.intents[e.last].id : null;
      const noRep = pat.no_repeat ?? 0;
      const entries = Object.entries(w).filter(([k]) => !(noRep >= 2 && k === lastId && e.lastRun >= noRep - 1));
      const total = entries.reduce((a, [, v]) => a + v, 0);
      let r = rand(s) * total;
      id = entries[entries.length - 1][0];
      for (const [k, v] of entries) {
        if (r < v) {
          id = k;
          break;
        }
        r -= v;
      }
    }
  } else {
    const order = pat.order ?? [def.intents[0].id];
    id = order[e.patIdx % order.length];
  }
  e.patIdx++;
  setIntent(e, intentIndex(def, id));
}

function setIntent(e: EnemyState, idx: number): void {
  if (idx === e.last) e.lastRun++;
  else e.lastRun = 1;
  e.last = idx;
  e.intent = idx;
}

/** 의도의 대상 영웅들 (deterministic=true 면 '무작위'를 서 있는 영웅 전원에 고르게 나눈다) */
export function intentTargets(s: CombatState, e: EnemyState, it: RawIntent, deterministic: boolean): [number, number][] {
  const f = s.formation;
  if (!f.length) return [];
  const def = D().enemies[e.def];
  const standingIdx = f.filter((hi) => standing(s.heroes[hi]));
  const downed = f.filter((hi) => s.heroes[hi].downed);
  const single = (hi: number | undefined): [number, number][] => (hi === undefined ? [] : [[hi, 1]]);
  const huntsDowned = def.passives.some((p) => p.includes('쓰러진 영웅을 먼저')) && e.phase >= 1 && downed.length > 0;
  const fallback = (): [number, number][] => {
    const eff = it.effect ?? '';
    if (eff.includes('최저 체력')) return single(lowest(s, standingIdx));
    return single(f[0]);
  };
  switch (it.target) {
    case '선두':
      return huntsDowned ? single(downed[0]) : single(f[0]);
    case '중열':
      return huntsDowned ? single(downed[0]) : single(f[Math.min(1, f.length - 1)]);
    case '후열':
      return huntsDowned ? single(downed[0]) : single(f[f.length - 1]);
    case '전체':
      return f.map((hi) => [hi, 1] as [number, number]);
    case '최저 체력':
      return huntsDowned ? single(downed[0]) : single(lowest(s, standingIdx.length ? standingIdx : f));
    case '최고 체력': {
      if (huntsDowned) return single(downed[0]);
      const pool = standingIdx.length ? standingIdx : f;
      let best = pool[0];
      for (const hi of pool) if (s.heroes[hi].hp > s.heroes[best].hp) best = hi;
      return single(best);
    }
    case '무작위': {
      if (huntsDowned) return single(downed[0]);
      const pool = standingIdx.length ? standingIdx : f;
      if (deterministic) return pool.map((hi) => [hi, 1 / pool.length] as [number, number]);
      return single(pool[Math.floor(rand(s) * pool.length)]);
    }
    case '쓰러진 영웅':
      return downed.length ? single(downed[0]) : fallback();
    default:
      return single(f[0]);
  }
}

function lowest(s: CombatState, pool: number[]): number | undefined {
  let best: number | undefined;
  for (const hi of pool) if (best === undefined || s.heroes[hi].hp < s.heroes[best].hp) best = hi;
  return best;
}

export function enemyDamageMult(s: CombatState, e: EnemyState): number {
  return (e.weak > 0 ? 0.75 : 1) * (e.bound ? 0.75 : 1) * s.rules.enemyDmgMult;
}

export function executeIntent(s: CombatState, ei: number): void {
  const d = D();
  const e = s.enemies[ei];
  if (!e.alive || e.intent < 0) return;
  const def = d.enemies[e.def];
  if (e.cancelNext) {
    // 붕괴: 다음 행동 취소
    e.cancelNext = false;
    e.bound = false;
    e.turnsActed++;
    return;
  }
  const it = def.intents[e.intent];
  const mult = enemyDamageMult(s, e);
  e.bound = false;
  const eff = it.effect ?? '';
  const per = (base: number) => Math.floor((base + e.atkBonus) * mult);
  switch (it.kind) {
    case 'attack':
    case 'attack_debuff':
    case 'move': {
      if (it.target === '굿상') {
        if (s.summons.length) {
          // 상 갉아먹기: 설치물 하나를 무너뜨린다
          let bi = 0;
          for (let i = 1; i < s.summons.length; i++) if (s.summons[i].left > s.summons[bi].left) bi = i;
          s.summons.splice(bi, 1);
        } else {
          const m = eff.match(/선두에게\s*(\d+)/);
          if (m && s.formation.length) hitHero(s, s.formation[0], per(Number(m[1])), ei);
          const h = eff.match(/체력\s*(\d+)\s*회복/);
          if (h) e.hp = Math.min(e.maxHp, e.hp + Number(h[1]));
        }
        break;
      }
      if (it.damage !== undefined && it.damage > 0) {
        const hits = it.hits ?? 1;
        for (let k = 0; k < hits; k++) {
          const ts = it.target === '전체' ? s.formation.slice() : intentTargets(s, e, it, false).map(([hi]) => hi);
          for (const hi of ts) {
            if (s.outcome !== 0) return;
            // 호위: 선두를 노린 공격은 선두에 방어도가 없으면 산 사람이 맞는다
            const w = s.ward;
            if (w && !w.lost && hi === s.formation[0] && it.target !== '전체' && s.heroes[hi].block <= 0) {
              w.hp -= per(it.damage);
              if (w.hp <= 0) {
                w.hp = 0;
                w.lost = true;
                s.outcome = 1;
                return;
              }
              continue;
            }
            hitHero(s, hi, per(it.damage), ei);
          }
        }
      }
      const weak = eff.match(/약화\s*(\d+)/);
      if (weak) {
        for (const [hi] of intentTargets(s, e, it, false)) if (!s.heroes[hi].dead) s.heroes[hi].weak += Number(weak[1]);
      }
      if (eff.includes('끌어')) {
        // 끌어당김: 후열 영웅을 선두로
        const back = s.formation[s.formation.length - 1];
        if (back !== undefined) moveToFront(s, back);
      }
      if (eff.includes('섞')) shuffleFormation(s);
      if (eff.includes('그늘')) addStatusCard(s, d.special.shadow);
      break;
    }
    case 'buff':
    case 'defend': {
      if (it.target === '아군 원귀') {
        const m = eff.match(/방어도\s*(\d+)/);
        if (m) for (const x of s.enemies) if (x.alive && d.enemies[x.def].category === 'minion') x.block += Number(m[1]);
      } else if (it.block) e.block += it.block;
      const atk = eff.match(/공격\s*\+(\d+)/);
      if (atk) e.atkBonus += Number(atk[1]);
      break;
    }
    case 'escape':
      e.alive = false;
      e.escaped = true;
      if (s.stats) s.stats.escapes++;
      checkOutcome(s);
      break;
    case 'pollute': {
      const m = eff.match(/(\d+)장/);
      const n = m ? Number(m[1]) : 1;
      if (eff.includes('신열')) {
        // 신열 (05-region2 §9.1): 주인 = 의도 대상의 서 있는 영웅. '전체'면 진형 앞에서부터 돌아가며 한 장씩
        const up = s.formation.filter((hi) => standing(s.heroes[hi]));
        if (!up.length) break;
        let owners: number[];
        if (it.target === '전체') owners = up;
        else {
          const t = intentTargets(s, e, it, false).map(([hi]) => hi).find((hi) => standing(s.heroes[hi]));
          owners = [t ?? up[0]];
        }
        for (let k = 0; k < n; k++) addOwnedStatus(s, d.special.sinyeol, owners[k % owners.length]);
        break;
      }
      const card = eff.includes('그늘') ? d.special.shadow : d.special.noise;
      for (let k = 0; k < n; k++) addStatusCard(s, card);
      break;
    }
    case 'stress': {
      const m = eff.match(/\+(\d+)/);
      const n = m ? Number(m[1]) : 0;
      for (const h of s.heroes) if (!h.dead) addStress(s, h.idx, n);
      break;
    }
    case 'possess': {
      const m = eff.match(/홀림\s*(\d+)/);
      const n = m ? Number(m[1]) : 1;
      const ts = intentTargets(s, e, it, false);
      for (const [hi] of ts) if (standing(s.heroes[hi])) s.heroes[hi].possess += n;
      break;
    }
    case 'summon': {
      if (eff.includes('되살린다')) {
        const hp = Number(eff.match(/체력\s*(\d+)/)?.[1] ?? 16);
        const dead = s.enemies.find((x) => x.dead && d.enemies[x.def].category === 'minion');
        if (dead) {
          const fresh = makeEnemy(s, dead.def, hp);
          Object.assign(dead, fresh);
        }
      } else {
        const m = eff.match(/최대\s*(\d+)/);
        const cap = m ? Number(m[1]) : 2;
        const nameMatch = eff.match(/^(.+?)\s*\d+\s*소환/);
        const target = nameMatch ? d.enemies.find((x) => x.name === nameMatch[1].trim()) : undefined;
        const summonedAlive = s.enemies.filter((x) => x.alive && x.summoned).length;
        if (target && summonedAlive < cap) {
          const ne = makeEnemy(s, target.idx);
          ne.summoned = true;
          s.enemies.push(ne);
        }
      }
      break;
    }
    default:
      break;
  }
  e.turnsActed++;
}

// ── 봇용 예측 ───────────────────────────────────────────────────────
export interface Incoming {
  dmg: number[]; // hero idx → 예상 피해 (방어도 전)
  hits: number[]; // hero idx → 예상 타수
  stress: number;
  pollute: number;
  summonLoss: number;
}

/** 지금 보이는 의도로 다음 적 턴의 피해를 예측한다. skip[i]=true 인 적은 그 전에 쓰러진다고 본다 */
export function projectIncoming(s: CombatState, skip: boolean[] | null): Incoming {
  const d = D();
  const n = s.heroes.length;
  const out: Incoming = { dmg: new Array(n).fill(0), hits: new Array(n).fill(0), stress: 0, pollute: 0, summonLoss: 0 };
  const redirect = (hi: number): number => {
    for (const h of s.heroes) if (h.idx !== hi && h.cover === hi && standing(h)) return h.idx;
    if (s.ajik && s.heroes[hi].downed) {
      const ch = s.heroes.find((h) => h.id === 'chasa' && standing(h));
      if (ch) return ch.idx;
    }
    return hi;
  };
  for (let i = 0; i < s.enemies.length; i++) {
    const e = s.enemies[i];
    if (!e.alive || e.intent < 0 || e.cancelNext) continue;
    if (skip && skip[i]) continue;
    const def = d.enemies[e.def];
    const it = def.intents[e.intent];
    const mult = enemyDamageMult(s, e);
    if (it.target === '굿상') {
      if (s.summons.length) out.summonLoss += 1;
      else if (s.formation.length) {
        const m = (it.effect ?? '').match(/선두에게\s*(\d+)/);
        const t = redirect(s.formation[0]);
        out.dmg[t] += Math.floor(((m ? Number(m[1]) : 0) + e.atkBonus) * mult);
        out.hits[t] += 1;
      }
      continue;
    }
    if (it.damage && it.damage > 0) {
      const per = Math.floor((it.damage + e.atkBonus) * mult);
      const hits = it.hits ?? 1;
      for (const [hi, w] of intentTargets(s, e, it, true)) {
        const t = redirect(hi);
        out.dmg[t] += per * hits * w;
        out.hits[t] += hits * w;
      }
    }
    if (it.kind === 'stress') out.stress += Number((it.effect ?? '').match(/\+(\d+)/)?.[1] ?? 0);
    if (it.kind === 'pollute') out.pollute += 2;
  }
  return out;
}
