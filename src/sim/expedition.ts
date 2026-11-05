// 원정 시뮬레이터 (docs/05-exploration.md §2·§9·§10).
// 보스 길: 쉬움 2 + 어려움 7 + 수호 방 1~2, 6번째 전투 뒤 길굿 1회, 보스 굴 앞 길굿, 보스.
// 보통 길(캠페인 의뢰): 쉬움 2 + 어려움 5 + 수호 방 1, 5번째 전투 뒤 길굿. 최종 원정(3지역): 보통 길 + 길굿 + 업경대 + 최종 큰 원귀.
// 체력·죽음·귀기·씌임이 이어진다. 전투마다 카드 보상(영웅마다 1장, 3택 1 또는 건너뛰기).
// 지역 1 + 시작 덱(기본값)은 v0.3 과 같은 난수 순서로 돈다 — 기존 sim:expedition 숫자가 그대로 나온다.

import { createCombat, D, type HeroSetup } from '../core/engine.ts';
import { eopgyeong, knotPresetBits } from '../core/regions.ts';
import { RAW_JSON } from '../core/raw-data.ts';
import { Rng, seedFrom } from '../core/rng.ts';
import type { CardInst, CombatMods, Encounter, HeroId, RuleVariant } from '../core/types.ts';
import { newCardAgg, recordCombat, newCombatAgg, deckIdsOf, type CardAgg, type CombatAgg } from './agg.ts';
import { runCombat } from './bot.ts';
import { instFor, newPity, pickReward, rewardScore, profileDeck, rollRewards, starterDeck, type RewardTier } from './draft.ts';

// ── 원정 회복 규칙 (탐험 §9·§10, v0.2 S1) ──────────────────────────────
/** 넋 수습: 전투가 끝날 때 서 있던 영웅은 **잃은 체력의 40%**를 회복한다 (쓰러진 채 끝난 영웅은 제외) */
export const AFTER_FIGHT_RECOVERY_MISSING = 0.4;
/** 넋 수습: 최대 체력 비율 (v0.2 기본 0, 실험용) */
export const AFTER_FIGHT_RECOVERY = 0;
/** 넋 수습: 고정량 (v0.2 기본 0, 실험용) */
export const AFTER_FIGHT_RECOVERY_FLAT = 0;
/** 보스 길: 보스 굴 앞에 길굿이 하나 더 있다 (보통 길이 1 + 보스 굴 앞 1) */
export const PRE_BOSS_CAMP = true;
/** 보스 굴 앞 길굿에서도 다른 길굿과 같이 고른다 (끼니가 필요할 때만 끼니) */
export const PRE_BOSS_FORCE_HEAL = false;

export type ExpLength = 'boss' | 'normal' | 'final';

/** 원정에 나서는 영웅 (캠페인 개체). 없으면 원형 기본 체력으로 */
export interface ExpHero {
  id: HeroId;
  maxHp: number;
  hp?: number;
  stress?: number;
  injured?: boolean;
  saveBonus?: number;
  stressMult?: number;
  startBlock?: number;
  startWeak?: number;
  /** 넋 수습 회복 비율 보정 (빠른 회복 +0.1 · 더딘 회복 −0.1) */
  recovery?: number;
}

export interface Provisions {
  jijeon: number;
  rice: number;
  sul: number;
  bujeok: number;
  incense: number;
}

/** 지역 2·3·캠페인 원정 설정. 없으면 v0.3 그대로(1지역 보스 길, 시작 덱) */
export interface ExpeditionSetup {
  region: number;
  length: ExpLength;
  heroes?: ExpHero[];
  /** 시작 덱 (캠페인: 로드아웃 + 합기 + 신물). 없으면 시작 카드 12장 */
  deck?: CardInst[];
  provisions?: Provisions;
  /** 균열 강화 원귀 (캠페인 §5) */
  enemyHpMult?: number;
  /** 위험하면 돌아선다 (캠페인 봇: 영웅이 죽었거나 파티 체력이 이 비율 아래면) */
  retreatBelow?: number;
  /** 마지막 전투(보스) 앞에서 돌아서는 체력 비율 */
  bossRetreatBelow?: number;
  /** 첫 전투 첫 턴 장단 (결의) */
  firstJangdan?: number;
  mods?: CombatMods;
  /** 내림굿으로 고른 성장의 길 (보상에 그 길의 카드가 두 배) */
  paths?: Partial<Record<HeroId, 'A' | 'B'>>;
  /** 전멸했을 때 쓰러진 영웅마다 마지막 사망 판정을 버틸 확률 (기본 0.5, 캠페인 CD.death.wipeSurvive) */
  wipeSurvive?: number;
}

export interface ExpeditionOptions {
  /** 원정 기록용 집계 (없으면 기록하지 않는다) */
  agg?: CombatAgg;
  cards?: CardAgg;
  /** 넋 수습 비율 덮어쓰기 (기본 AFTER_FIGHT_RECOVERY) */
  betweenHeal?: number;
  /** 넋 수습 고정량 덮어쓰기 (기본 AFTER_FIGHT_RECOVERY_FLAT) */
  betweenHealFlat?: number;
  /** 넋 수습: 잃은 체력 비율 덮어쓰기 (기본 AFTER_FIGHT_RECOVERY_MISSING) */
  betweenHealMissing?: number;
  rules?: RuleVariant;
  /** what-if: 보스 고정 ('b1' | 'b2'), 기본은 무작위 */
  boss?: string;
  /** 보스 굴 앞 길굿 (기본 PRE_BOSS_CAMP) */
  preBossCamp?: boolean;
  /** 보스 앞 길굿에서 언제나 끼니 (기본 PRE_BOSS_FORCE_HEAL) */
  preBossHeal?: boolean;
  setup?: ExpeditionSetup;
}

export interface HeroOut {
  hp: number;
  maxHp: number;
  dead: boolean;
  injured: boolean;
  stress: number;
  /** 이 원정에서 낸 자기 카드 (기본판 id → 횟수) */
  plays: Record<string, number>;
}

export interface ExpeditionResult {
  cleared: boolean;
  fightsWon: number;
  fightsTotal: number;
  boss: string;
  bossReached: boolean;
  bossWon: boolean;
  bossHaewon: boolean;
  deaths: number;
  wipedAt: string | null;
  haewons: number;
  haewonEligible: number;
  campChoice: 'heal' | 'remove' | 'none';
  deckSize: number;
  picks: number;
  skips: number;
  elites: number;
  // ── 지역 2·3·캠페인 (setup 이 있을 때만 채운다) ──
  region?: number;
  length?: ExpLength;
  heroOut?: HeroOut[];
  /** 기상한 영웅 idx (인연) */
  revived?: number[];
  haewonByFamily?: Record<string, number>;
  killByFamily?: Record<string, number>;
  gold?: number;
  chiseong?: number;
  retreated?: boolean;
  sonnim?: 'sendoff' | 'timeout' | null;
  eopgyeongTier?: number;
  provisionsLeft?: Provisions;
  sinyeol?: { played: number; moved: number };
  haewonById?: Record<string, number>;
  met?: string[];
}

interface PHero {
  id: HeroId;
  hp: number;
  baseMax: number;
  stress: number;
  injured: boolean;
  recovering: boolean;
  dead: boolean;
  ex: ExpHero | null;
}

function effMax(h: PHero): number {
  return h.injured ? Math.floor(h.baseMax * 0.8) : h.baseMax;
}

function encountersOf(region: number): Encounter[] {
  const d = D();
  return region === 1 ? d.encounters : d.regionEncounters[region];
}

export function buildSchedule(rng: Rng, fixedBoss?: string, region = 1, length: ExpLength = 'boss'): { fights: Encounter[]; boss: Encounter | null; elites: number } {
  const d = D();
  const pool = encountersOf(region);
  const by = (tier: string) => pool.filter((e) => e.tier === tier);
  const easy = rng.shuffle(by('easy').slice()).slice(0, 2);
  // 어려움 7(보통 길 5): 같은 조합 반복 금지 → 6종을 다 쓴 뒤에만 반복, 바로 이어서는 금지
  const hardPool = by('hard');
  const hard: Encounter[] = [];
  // 보통 길 · 최종 원정은 어려움 5 (05-region3 R3-2: 최종 원정 = 보통 + 최종, 길굿 2회)
  const nHard = length === 'boss' ? 7 : 5;
  let bag: Encounter[] = [];
  while (hard.length < nHard) {
    if (!bag.length) bag = rng.shuffle(hardPool.slice());
    const next = bag.pop()!;
    if (hard.length && hard[hard.length - 1].id === next.id && bag.length) {
      bag.unshift(next);
      continue;
    }
    hard.push(next);
  }
  const eliteCount = length === 'boss' ? rng.int(1, 2) : 1;
  const elites = rng.shuffle(by('elite').slice()).slice(0, eliteCount);
  const middle = hard.slice();
  for (const e of elites) {
    const pos = 1 + rng.int(0, middle.length - 1);
    middle.splice(pos, 0, e);
  }
  if (length === 'normal') return { fights: [...easy, ...middle], boss: null, elites: eliteCount };
  let boss: Encounter;
  if (length === 'final') boss = by('final')[0];
  else {
    boss = rng.pick(by('boss'));
    if (fixedBoss) boss = d.encounterById.get(fixedBoss) ?? boss;
  }
  return { fights: [...easy, ...middle], boss, elites: eliteCount };
}

// 원귀 드롭 (엽전·재료·치성) — 엔진은 읽지 않는 지역 데이터
type Drops = { material: string | null; gold: [number, number]; chiseong?: number };
let dropCache: Map<string, Drops> | null = null;
export function dropsOf(id: string): Drops | null {
  if (!dropCache) {
    dropCache = new Map();
    for (const f of ['data/design/region1.json', 'data/design/region2.json', 'data/design/region3.json']) {
      const j = RAW_JSON[f] as { enemies: { id: string; drops: Drops }[] };
      for (const e of j.enemies) dropCache.set(e.id, e.drops);
    }
  }
  return dropCache.get(id) ?? null;
}

/** 1지역 v0.3 원정 (기존 sim:expedition) — setup 없이 부르면 그대로 */
export function runExpedition(party: HeroId[], seed: number, opts: ExpeditionOptions): ExpeditionResult {
  const d = D();
  const setup = opts.setup ?? null;
  const region = setup?.region ?? 1;
  const length: ExpLength = setup?.length ?? 'boss';
  const rng = new Rng(seed);
  const pity = newPity();
  let deck: CardInst[] = setup?.deck ? setup.deck.slice() : starterDeck(party);
  const heroes: PHero[] = party.map((id, i) => {
    const ex = setup?.heroes?.[i] ?? null;
    const base = ex ? ex.maxHp : d.heroes.get(id)!.hp;
    return { id, hp: ex?.hp ?? base, baseMax: base, stress: ex?.stress ?? 0, injured: !!ex?.injured, recovering: false, dead: false, ex };
  });
  const { fights, boss, elites } = buildSchedule(rng, opts.boss, region, length);
  const all = boss ? [...fights, boss] : fights;
  const res: ExpeditionResult = {
    cleared: false, fightsWon: 0, fightsTotal: all.length, boss: boss?.id ?? '', bossReached: false, bossWon: false, bossHaewon: false, deaths: 0,
    wipedAt: null, haewons: 0, haewonEligible: 0, campChoice: 'none', deckSize: 0, picks: 0, skips: 0, elites,
  };
  const campaign = !!setup;
  const prov: Provisions = setup?.provisions ? { ...setup.provisions } : { jijeon: 3, rice: 0, sul: 0, bujeok: 0, incense: 0 };
  const plays: Record<string, number>[] = party.map(() => ({}));
  const revived: number[] = [];
  const haewonByFamily: Record<string, number> = {};
  const killByFamily: Record<string, number> = {};
  let gold = 0;
  let chiseong = 0;
  let sonnim: 'sendoff' | 'timeout' | null = null;
  let sinyeolFree = false;
  let feverStart = 0; // 서운한 작별: 전투 시작 시 신열
  let knotsPreset = 0;
  let eopTier = -1;
  let drawFirst = 0;
  const sy = { played: 0, moved: 0 };
  const haewonById: Record<string, number> = {};
  const met = new Set<string>();
  // 지역 2: 손님 마당(원정마다 1회) — 보통 길·보스 길 모두 가운데쯤
  const sonnimAt = campaign && region === 2 ? Math.min(all.length - 2, 3 + rng.int(0, 3)) : -1;
  const scratchAgg = opts.agg ?? newCombatAgg();
  const scratchCards = opts.cards ?? newCardAgg();
  const heroSetups = (): HeroSetup[] => heroes.map((h) => ({
    id: h.id, hp: h.hp, maxHp: h.baseMax, stress: h.stress, injured: h.injured, recovering: h.recovering, dead: h.dead,
    saveBonus: h.ex?.saveBonus, stressMult: h.ex?.stressMult, startBlock: h.ex?.startBlock, startWeak: h.ex?.startWeak,
  }));
  const syncHeroes = (s: ReturnType<typeof createCombat>) => {
    s.heroes.forEach((h, idx) => {
      const p = heroes[idx];
      p.dead = h.dead;
      p.hp = h.dead ? 0 : h.hp;
      p.stress = h.stress;
      p.injured = h.injured;
      p.recovering = h.recovering;
    });
  };
  const notePlays = (s: ReturnType<typeof createCombat>) => {
    if (!campaign || !s.stats) return;
    for (const [id, n] of s.stats.plays) {
      const def = d.cardById.get(id);
      if (!def || def.ownerKind !== 'hero') continue;
      const base = d.cards[def.baseIdx].id;
      const hi = party.indexOf(def.heroes[0]);
      if (hi >= 0) plays[hi][base] = (plays[hi][base] ?? 0) + n;
    }
    revived.push(...s.stats.revived);
    for (const [id, [, h]] of s.stats.enemyHaewon) if (h) haewonById[id] = (haewonById[id] ?? 0) + h;
    for (const e of s.enemies) met.add(d.enemies[e.def].id);
    sy.played += s.stats.sinyeolPlayed;
    sy.moved += s.stats.sinyeolMoved;
    Object.assign(prov, { rice: s.prov.rice, sul: s.prov.sul, bujeok: s.prov.bujeok, incense: s.prov.incense, jijeon: s.jijeon });
  };
  for (let i = 0; i < all.length; i++) {
    const enc = all[i];
    const isBoss = !!boss && i === all.length - 1;
    // 손님 배웅 (지역 2 특수 전투, 05-region2 §9.3)
    if (i === sonnimAt) {
      const sp = d.specials.get('sonnim_baeung')!;
      const start = party.includes('manshin') ? 4 : 0;
      const s = createCombat({
        party: heroSetups(), deck, encounter: { id: 'sonnim', tier: 'elite', enemies: sp.followers }, seed: seedFrom(seed, 'sonnim'), record: true,
        jijeon: prov.jijeon, provisions: prov, rules: opts.rules, entertain: { goal: sp.goal, limit: sp.limit, start }, mods: setup?.mods, enemyHpMult: setup?.enemyHpMult,
      });
      runCombat(s);
      notePlays(s);
      res.haewons += s.stats!.haewons;
      res.haewonEligible += s.stats!.haewonEligible;
      if (s.outcome === 1) {
        syncHeroes(s);
        sonnim = s.entertain?.result ?? 'timeout';
        if (sonnim === 'sendoff') {
          gold += 45;
          chiseong += 1;
          sinyeolFree = true;
        } else feverStart = 1;
      } else {
        // 수비에게 전멸 — 드물다
        s.heroes.forEach((h, idx) => {
          if (h.dead && !heroes[idx].dead) res.deaths++;
          if (h.dead) heroes[idx].dead = true;
        });
        for (const h of s.heroes) if (!h.dead) {
          if (rng.next() >= 0.5) {
            res.deaths++;
            heroes[h.idx].dead = true;
          } else {
            heroes[h.idx].injured = true;
            heroes[h.idx].hp = 1;
          }
        }
        res.wipedAt = 'sonnim';
        break;
      }
    }
    if (isBoss) res.bossReached = true;
    // 업경대 비추기 (3지역 최종 원정, 열두째 대문 바로 앞)
    if (isBoss && length === 'final') {
      const r = eopgyeong(res.haewons, { incense: prov.incense > 0, manshin: party.includes('manshin') });
      if (prov.incense > 0) prov.incense--;
      eopTier = r.tier;
      knotsPreset = knotPresetBits(party, r.knots);
      drawFirst = r.draw;
      for (const h of heroes) {
        if (h.dead) continue;
        if (r.hpPct) h.hp = Math.min(effMax(h), h.hp + Math.round(h.baseMax * r.hpPct));
        if (r.stress) h.stress = Math.min(100, h.stress + r.stress);
      }
    }
    const startHp = heroes.map((h) => (h.dead ? 0 : h.hp));
    let fightDeck = deck;
    if (feverStart > 0) {
      const front = heroes.findIndex((h) => !h.dead);
      fightDeck = [...deck, { d: d.special.sinyeol, o: front, o2: -1, orig: -1, x: -1 }];
    }
    const s = campaign
      ? createCombat({
        party: heroSetups(), deck: fightDeck, encounter: enc, seed: seedFrom(seed, 'fight', i), record: true, jijeon: prov.jijeon, provisions: prov, rules: opts.rules,
        enemyHpMult: setup?.enemyHpMult, knotsPreset: isBoss ? knotsPreset : 0, mods: { ...setup?.mods, sinyeolFree: sinyeolFree || undefined },
      })
      : createCombat({
        party: heroes.map((h) => ({ id: h.id, hp: h.hp, maxHp: h.baseMax, stress: h.stress, injured: h.injured, recovering: h.recovering, dead: h.dead })),
        deck, encounter: enc, seed: seedFrom(seed, 'fight', i), record: true, jijeon: 3, rules: opts.rules,
      });
    if (campaign && i === 0 && setup?.firstJangdan) s.jangdan = Math.min(5, s.jangdan + setup.firstJangdan);
    if (campaign && isBoss && drawFirst) {
      for (let k = 0; k < drawFirst && s.draw.length; k++) s.hand.push(s.draw.pop()!);
    }
    const { timeout } = runCombat(s);
    recordCombat(scratchAgg, scratchCards, s, party, startHp, timeout, deckIdsOf(deck));
    const st = s.stats!;
    res.haewons += st.haewons;
    res.haewonEligible += st.haewonEligible;
    notePlays(s);
    // 죽은 영웅 → 덱의 그 영웅 카드는 곡
    s.heroes.forEach((h, idx) => {
      if (h.dead && !heroes[idx].dead) {
        res.deaths++;
        deck = deck.map((c) => (c.o === idx && c.o2 < 0 && c.d !== d.special.mourn ? { d: d.special.mourn, o: idx, o2: -1, orig: c.d, x: -1 } : c));
      }
    });
    if (s.outcome !== 1) {
      // 전멸: 영웅마다 마지막 사망 판정(버틸 확률 50%, 캠페인은 처벌 강도 wipeSurvive — 06-base §8 ⟨반복 3⟩)
      const survive = campaign ? setup?.wipeSurvive ?? 0.5 : 0.5;
      for (const h of s.heroes) if (!h.dead && rng.next() >= survive) {
        res.deaths++;
        if (campaign) heroes[h.idx].dead = true;
      }
      if (campaign) s.heroes.forEach((h, idx) => {
        if (h.dead) heroes[idx].dead = true;
        else if (!heroes[idx].dead) {
          heroes[idx].injured = true;
          heroes[idx].hp = Math.max(1, h.hp);
          heroes[idx].stress = h.stress;
        }
      });
      res.wipedAt = enc.id;
      break;
    }
    res.fightsWon++;
    if (campaign) {
      for (const e of s.enemies) {
        const def = d.enemies[e.def];
        const dr = dropsOf(def.id);
        if (!dr || e.escaped || !e.dead || e.summoned) continue;
        gold += dr.gold[0] + Math.floor(rng.next() * (dr.gold[1] - dr.gold[0] + 1));
        if (dr.material) {
          if (e.haewon) haewonByFamily[def.family] = (haewonByFamily[def.family] ?? 0) + 1;
          else killByFamily[def.family] = (killByFamily[def.family] ?? 0) + 1;
        }
        if (dr.chiseong) chiseong += dr.chiseong + (e.haewon ? 1 : 0);
      }
    }
    if (isBoss) {
      res.bossWon = true;
      res.bossHaewon = s.enemies.some((e) => d.enemies[e.def].category === 'boss' && e.haewon);
      res.cleared = true;
      if (campaign) syncHeroes(s);
      break;
    }
    // 상태 이어 가기
    syncHeroes(s);
    for (const [hi, cd] of s.newCurses) deck.push({ d: cd, o: hi, o2: -1, orig: -1, x: -1 });
    // 넋 수습: 전투가 끝날 때 서 있던 영웅 (쓰러진 채 끝나 체력 1로 일어난 영웅은 제외)
    const recovery = opts.betweenHeal ?? AFTER_FIGHT_RECOVERY;
    const flat = opts.betweenHealFlat ?? AFTER_FIGHT_RECOVERY_FLAT;
    const missing = opts.betweenHealMissing ?? AFTER_FIGHT_RECOVERY_MISSING;
    if (recovery > 0 || flat > 0 || missing > 0) heroes.forEach((h, idx) => {
      if (h.dead || s.heroes[idx].endDowned) return;
      const lost = effMax(h) - h.hp;
      h.hp = Math.min(effMax(h), h.hp + Math.round(h.baseMax * recovery) + flat + Math.round(lost * (missing + (h.ex?.recovery ?? 0))));
    });
    // 해원: 파티 귀기 회복 (−5 / 해원)
    if (st.haewons) for (const h of heroes) if (!h.dead) h.stress = Math.max(0, h.stress - 5 * st.haewons);
    // 카드 보상
    const tier: RewardTier = enc.tier === 'elite' ? 'elite' : 'normal';
    const alive = heroes.filter((h) => !h.dead).map((h) => h.id);
    const options = rollRewards(rng, alive, tier, pity, setup?.paths);
    for (const o of options) scratchCards.offered[o.id] = (scratchCards.offered[o.id] ?? 0) + 1;
    const pick = pickReward(options, deck, true);
    if (pick) {
      deck.push(instFor(pick, party));
      scratchCards.picked[pick.id] = (scratchCards.picked[pick.id] ?? 0) + 1;
      res.picks++;
    } else res.skips++;
    // 6번째 전투 뒤 길굿 (보통 길은 5번째) + 보스 굴 앞 길굿
    if (i === (length === 'boss' ? 5 : 4)) res.campChoice = camp(heroes, () => {
      deck = removeWorstStarter(deck);
    }, false, campaign ? prov : null);
    // 보스 굴 앞 길굿: 보스 앞이라 언제나 끼니(회복)를 고른다
    if (boss && i === all.length - 2 && (opts.preBossCamp ?? PRE_BOSS_CAMP)) camp(heroes, () => {
      deck = removeWorstStarter(deck);
    }, opts.preBossHeal ?? PRE_BOSS_FORCE_HEAL, campaign ? prov : null);
    // 캠페인 봇: 영웅을 잃었거나 파티가 많이 지쳤으면 돌아선다 (마지막 전투 직전은 끝까지 간다)
    if (campaign && setup?.retreatBelow !== undefined && i < all.length - 1) {
      const up = heroes.filter((h) => !h.dead);
      const frac = up.reduce((a, h) => a + h.hp, 0) / Math.max(1, up.reduce((a, h) => a + effMax(h), 0));
      const lost = heroes.some((h) => h.dead);
      const nextIsLast = i === all.length - 2;
      if (lost || frac < (nextIsLast ? setup.bossRetreatBelow ?? setup.retreatBelow : setup.retreatBelow)) {
        res.retreated = true;
        break;
      }
    }
  }
  if (campaign && length === 'normal' && !res.wipedAt && !res.retreated) res.cleared = true;
  res.deckSize = deck.length;
  if (campaign) {
    res.region = region;
    res.length = length;
    res.heroOut = heroes.map((h, i) => ({ hp: h.hp, maxHp: h.baseMax, dead: h.dead, injured: h.injured, stress: h.stress, plays: plays[i] }));
    res.revived = revived;
    res.haewonByFamily = haewonByFamily;
    res.killByFamily = killByFamily;
    res.gold = gold;
    res.chiseong = chiseong;
    res.retreated = !!res.retreated;
    res.sonnim = sonnim;
    res.eopgyeongTier = eopTier;
    res.provisionsLeft = prov;
    res.sinyeol = sy;
    res.haewonById = haewonById;
    res.met = [...met];
  }
  return res;
}

/** 길굿: 쌀로 끼니(체력 30%·귀기 −10·중상 치료) 또는 시작 카드 1장 제거.
 *  prov 가 있으면(캠페인·지역 2·3) 쌀을 쓴다: 넉넉히 4 → 30%, 보통 2 → 15%(중상은 그대로), 쌀이 없으면 끼니 없이 카드 제거 (08 §2.5 길굿과 같다) */
function camp(heroes: PHero[], remove: () => void, forceHeal = false, prov: Provisions | null = null): 'heal' | 'remove' {
  const alive = heroes.filter((h) => !h.dead);
  const needHeal = forceHeal || alive.some((h) => h.injured || h.hp / effMax(h) < 0.6);
  let frac = 0.3;
  if (needHeal && prov) {
    if (prov.rice >= 4) prov.rice -= 4;
    else if (prov.rice >= 2) {
      prov.rice -= 2;
      frac = 0.15;
    } else frac = 0;
  }
  if (needHeal && frac > 0) {
    for (const h of alive) {
      if (frac >= 0.3) h.injured = false;
      h.hp = Math.min(h.baseMax, h.hp + Math.round(h.baseMax * frac));
      h.stress = Math.max(0, h.stress - (frac >= 0.3 ? 10 : 5));
    }
    return 'heal';
  }
  remove();
  return 'remove';
}

function removeWorstStarter(deck: CardInst[]): CardInst[] {
  const d = D();
  const prof = profileDeck(deck);
  let worst = -1;
  let wv = Infinity;
  deck.forEach((c, i) => {
    const def = d.cards[c.d];
    if (!def.starter) return;
    const v = rewardScore(def, prof);
    if (v < wv) {
      wv = v;
      worst = i;
    }
  });
  if (worst < 0) return deck;
  const out = deck.slice();
  out.splice(worst, 1);
  return out;
}
