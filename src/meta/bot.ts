// 캠페인 봇: 마을 결정을 단순한 규칙으로 둔다 (캠페인 시뮬레이션 · 플레이어블 자동 진행).
// 원칙: 천도굿을 미루지 않는다 → 신당으로 다음 지역을 연다 → 다친 사람은 쉬게 한다 → 강한 세 사람으로 의뢰를 고른다.

import { loadData } from '../core/data.ts';
import type { HeroId } from '../core/types.ts';
import {
  available, bondOf, bookRest, bookTreat, build, buildOptions, canPromote, cheondo, deepestRegion, engrave, finalUnlocked, maxHpOf,
  motherCandidates, promote, recommendedSupplies, recruit, recruitCost, removeBadQuirk, rosterCap, setLoadout, supplyCost, supplyMax, tier,
  GUARDIANS,
} from './campaign.ts';
import { CD, SUPPLY_IDS } from './content.ts';
import { bestLoadout, cardScore } from './loadout.ts';
import type { Campaign, Commission, Person, Supplies } from './types.ts';

/** 봇 문턱 (캠페인 시뮬레이션으로 맞춘다) */
export const BOT = {
  /** 귀기가 이만큼이면 주막에서 쉬게 한다 */
  restStress: 45,
  /** 연속 출전이 이만큼이면 쉬게 한다 */
  restSorties: 3,
  /** 보급품·천도굿을 위해 남겨 둘 엽전 */
  reserve: 140,
  /** 로스터 목표 인원 */
  rosterTarget: 6,
  /** 지역 보스에 도전할 평균 레벨: bossLevelBase + (지역 − 1) × bossLevelPerRegion */
  bossLevelBase: 1.0,
  bossLevelPerRegion: 0.75,
  /** 보통 길은 보스보다 이만큼 낮은 레벨에서 */
  normalLevelGap: 0.4,
  /** 위험하면 돌아서는 파티 체력 비율 (마지막 전투 앞은 bossRetreatBelow) */
  retreatBelow: 0.45,
  bossRetreatBelow: 0.6,
  /** 균열이 이만큼이면 준비된 보스로 균열을 줄인다 */
  riftWorry: 7,
  /** 최종 원정에 나설 파티 평균 레벨 */
  finalLevel: 2.5,
  /** 익힌 카드가 이만큼 안 되면 준비 레벨을 (모자란 장수 × learnedPenalty)만큼 깎는다 ⟨반복 3⟩ */
  learnedReady: 4,
  learnedPenalty: 0.25,
};

function score(c: Campaign, p: Person): number {
  return p.level * 12 + maxHpOf(p) * 0.3 - p.stress * 0.25 - (p.injured ? 18 : 0) - p.sorties * 3 + (p.engraving ? 3 : 0) + p.learned.length * 1.5;
}

/** 세 사람 고르기: 서로 다른 원형, 점수 + 정 + 수호형 1명 */
export function chooseParty(c: Campaign): string[] | null {
  const pool = available(c);
  let best: Person[] | null = null;
  let bv = -Infinity;
  for (let a = 0; a < pool.length; a++) for (let b = a + 1; b < pool.length; b++) for (let k = b + 1; k < pool.length; k++) {
    const t = [pool[a], pool[b], pool[k]];
    if (new Set(t.map((p) => p.arch)).size < 3) continue;
    let v = t.reduce((x, p) => x + score(c, p), 0);
    v += (bondOf(c, t[0].uid, t[1].uid) + bondOf(c, t[0].uid, t[2].uid) + bondOf(c, t[1].uid, t[2].uid)) * 0.8;
    if (t.some((p) => GUARDIANS.includes(p.arch))) v += 10;
    if (v > bv) {
      bv = v;
      best = t;
    }
  }
  return best ? best.map((p) => p.uid) : null;
}

/** 준비 정도: 레벨에서, 익힌 카드가 모자라 로드아웃이 시작 카드뿐인 사람은 깎는다 — 사람은 레벨만이 아니라 덱을 보고 깊이 들어간다 ⟨반복 3⟩ */
function readyLevel(p: Person): number {
  return p.level - Math.max(0, BOT.learnedReady - p.learned.length) * BOT.learnedPenalty;
}

function partyLevel(c: Campaign, uids: string[]): number {
  const ps = uids.map((u) => c.roster.find((p) => p.uid === u)!);
  return ps.reduce((a, p) => a + readyLevel(p), 0) / ps.length;
}

/** 지역 r 의 보스 길에 나설 파티 평균 레벨 */
export function bossReady(r: number): number {
  return BOT.bossLevelBase + (r - 1) * BOT.bossLevelPerRegion;
}

/** 지역 r 의 보통 길에 나설 파티 평균 레벨 */
export function normalReady(r: number): number {
  return Math.max(0, bossReady(r) - BOT.normalLevelGap);
}

/** 의뢰 고르기: 봉합 > 최종(준비되면) > 균열이 높으면 준비된 보스 > 가장 깊은 지역부터 (보스는 그 지역이 가장 깊거나 신당에 치성이 필요할 때) */
export function chooseCommission(c: Campaign, uids: string[]): Commission | null {
  const cs = c.commissions;
  if (!cs.length) return null;
  const seal = cs.find((x) => x.seal);
  if (seal) return seal;
  const lv = partyLevel(c, uids);
  const fin = cs.find((x) => x.length === 'final');
  if (fin && lv >= BOT.finalLevel) return fin;
  const deep = deepestRegion(c);
  const bossAt = (r: number) => cs.find((x) => x.length === 'boss' && x.region === r && !x.seal);
  const normalAt = (r: number) => cs.find((x) => x.length === 'normal' && x.region === r);
  // 균열이 차오르면 가장 확실한(얕은) 보스로 줄인다 ⟨반복 3: 깊은 보스부터 → 얕은 보스부터⟩
  if (c.rift >= BOT.riftWorry) for (let r = 1; r <= deep; r++) if (lv >= bossReady(r) && bossAt(r)) return bossAt(r)!;
  const sindangNext = buildOptions(c).find((x) => x.id === 'sindang');
  const needChiseong = !!sindangNext && c.chiseong < (sindangNext.cost.chiseong ?? 0);
  for (let r = deep; r >= 1; r--) {
    if (lv >= bossReady(r) && bossAt(r) && (r === deep || needChiseong)) return bossAt(r)!;
    if (lv >= normalReady(r) && normalAt(r)) return normalAt(r)!;
  }
  return [...cs].filter((x) => !x.seal && x.length !== 'final').sort((a, b) => a.region - b.region || (a.length === 'normal' ? -1 : 1))[0] ?? cs[0];
}

/** 권장량에서 창고를 뺀 만큼 산다 (엽전이 모자라면 줄인다) */
export function chooseSupplies(c: Campaign, cm: Commission): Partial<Supplies> {
  const rec = recommendedSupplies(cm.region, cm.length);
  const max = supplyMax(c, cm.region);
  const buy: Partial<Supplies> = {};
  for (const k of SUPPLY_IDS) buy[k] = Math.max(0, Math.min(max[k], rec[k]) - c.stock[k] - (c.bonusSupplies[k] ?? 0));
  const budget = c.gold + cm.advance;
  for (const k of [...SUPPLY_IDS].reverse()) while (supplyCost(c, buy) > budget && (buy[k] ?? 0) > 0) buy[k]! -= 1;
  return buy;
}

/** 마을 행동 한 묶음 (출정 직전까지) */
export function autoVillage(c: Campaign): void {
  if (c.ending) return;
  // 1) 천도굿 — 기한 안에
  for (const f of c.fallen) if (!f.honored && c.gold >= CD.death.cheondoCost) cheondo(c, f.person.uid);
  // 2) 건축: 신당(지역) → 무구방 → 약방 → 전수청 → 사당 → 객주
  const order = ['sindang', 'mugubang', 'yakbang', 'jeonsucheong', 'sadang', 'gaekju'] as const;
  for (let guard = 0; guard < 6; guard++) {
    const opts = buildOptions(c).filter((o) => o.ok);
    let did = false;
    for (const id of order) {
      const o = opts.find((x) => x.id === id);
      if (!o) continue;
      // 신당 다음 단계를 위해 치성을 아낀다
      const sindangNext = buildOptions(c).find((x) => x.id === 'sindang');
      if (id !== 'sindang' && (o.cost.chiseong ?? 0) > 0 && sindangNext && c.chiseong - (o.cost.chiseong ?? 0) < (sindangNext.cost.chiseong ?? 0) && id !== 'mugubang') continue;
      if ((o.cost.gold ?? 0) > 0 && c.gold - (o.cost.gold ?? 0) < BOT.reserve) continue;
      if (id === 'gaekju' && c.roster.length < 5) continue;
      if (!build(c, id)) {
        did = true;
        break;
      }
    }
    if (!did) break;
  }
  // 3) 영입: 목표 인원까지 (없는 원형 · 수호형 우선, 신어머니가 있으면 잇는다)
  const target = Math.min(rosterCap(c), BOT.rosterTarget);
  for (let guard = 0; guard < 4 && c.roster.length < target && c.candidates.length; guard++) {
    const cost = recruitCost(c);
    if (cost > 0 && c.gold - cost < BOT.reserve * 0.6 && c.roster.length >= 4) break;
    const have = new Set(c.roster.map((p) => p.arch));
    // 원형이 겹쳐 세 사람을 꾸릴 수 없으면 없는 원형부터
    const needGuard = !c.roster.some((p) => GUARDIANS.includes(p.arch));
    let bi = 0;
    let bv = -Infinity;
    c.candidates.forEach((p, i) => {
      let v = (have.has(p.arch) ? 0 : 10) + (needGuard && GUARDIANS.includes(p.arch) ? 15 : 0) + (motherCandidates(c, p.arch).length ? 6 : 0);
      if (p.bad === 'heoyak' || p.bad === 'deombeong') v -= 2;
      if (v > bv) {
        bv = v;
        bi = i;
      }
    });
    const mother = motherCandidates(c, c.candidates[bi].arch)[0]?.person.uid ?? null;
    if (recruit(c, bi, mother)) break;
  }
  // 4) 치료·휴식 — 출정할 세 원형이 남는 한
  const canSpare = (p: Person) => {
    const rest = available(c).filter((x) => x !== p);
    return new Set(rest.map((x) => x.arch)).size >= 3;
  };
  for (const p of c.roster) if (p.injured && !p.busy && tier(c, 'yakbang') >= 1 && c.gold >= CD.economy.treatCost + 40 && canSpare(p)) bookTreat(c, p.uid);
  for (const p of [...c.roster].sort((a, b) => b.stress - a.stress)) {
    if (p.busy) continue;
    if ((p.stress >= BOT.restStress || p.sorties >= BOT.restSorties) && c.gold >= CD.economy.restCost + 40 && canSpare(p)) bookRest(c, p.uid);
  }
  // 5) 기질 다스리기 · 내림굿
  for (const p of c.roster) if (p.bad && tier(c, 'yakbang') >= 1 && c.gold >= CD.economy.quirkCost + BOT.reserve + 150) removeBadQuirk(c, p.uid);
  for (const p of c.roster) if (canPromote(c, p) && c.gold >= CD.levels.promoteCost + BOT.reserve * 0.5) promote(c, p.uid, pickPath(p));
  // 6) 로드아웃 · 각인
  for (const p of c.roster) {
    const want = bestLoadout(p.arch, p.learned);
    const same = want.every((x) => p.loadout.includes(x));
    if (!same && (tier(c, 'jeonsucheong') >= 1 || c.gold >= CD.economy.loadoutSwapCost + BOT.reserve)) setLoadout(c, p.uid, want);
  }
  if (tier(c, 'mugubang') >= 1) {
    for (const p of [...c.roster].sort((a, b) => b.level - a.level)) {
      if (p.engraving) continue;
      const fam = Object.entries(c.materials).filter(([, n]) => n >= CD.economy.engraveCost).sort((a, b) => b[1] - a[1])[0];
      if (!fam) break;
      const d = loadData();
      const card = [...p.loadout].sort((a, b) => cardScore(d.cardById.get(b)!) - cardScore(d.cardById.get(a)!))[0];
      engrave(c, p.uid, card, fam[0]);
    }
  }
}

/** 성장의 길: 익힌 카드가 더 많은 쪽 */
function pickPath(p: Person): 'A' | 'B' {
  const d = loadData();
  let a = 0;
  let b = 0;
  for (const id of [...p.learned, ...Object.keys(p.history.plays)]) {
    const path = d.cardById.get(id)?.path;
    if (path === 'A') a++;
    if (path === 'B') b++;
  }
  return b > a ? 'B' : 'A';
}

export function archetypesOf(c: Campaign): HeroId[] {
  return c.roster.map((p) => p.arch);
}
