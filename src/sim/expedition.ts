// 보통 길이 원정 (docs/05-exploration.md §2·§9·§10): 쉬움 2 + 어려움 7 + 수호 방 1~2, 6번째 전투 뒤 길굿 1회, 보스.
// 체력·죽음·귀기·씌임이 이어진다. 전투마다 카드 보상(영웅마다 1장, 3택 1 또는 건너뛰기).

import { createCombat, D } from '../core/engine.ts';
import { Rng, seedFrom } from '../core/rng.ts';
import type { CardInst, Encounter, HeroId, RuleVariant } from '../core/types.ts';
import { newCardAgg, recordCombat, newCombatAgg, deckIdsOf, type CardAgg, type CombatAgg } from './agg.ts';
import { runCombat } from './bot.ts';
import { instFor, newPity, pickReward, rewardScore, profileDeck, rollRewards, starterDeck, type RewardTier } from './draft.ts';

export interface ExpeditionOptions {
  /** 원정 기록용 집계 (없으면 기록하지 않는다) */
  agg?: CombatAgg;
  cards?: CardAgg;
  /** what-if: 전투가 끝날 때마다 살아 있는 영웅 최대 체력의 이 비율만큼 회복 (설계값 0) */
  betweenHeal?: number;
  rules?: RuleVariant;
  /** what-if: 보스 고정 ('b1' | 'b2'), 기본은 무작위 */
  boss?: string;
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
}

interface PHero {
  id: HeroId;
  hp: number;
  baseMax: number;
  stress: number;
  injured: boolean;
  recovering: boolean;
  dead: boolean;
}

function effMax(h: PHero): number {
  return h.injured ? Math.floor(h.baseMax * 0.8) : h.baseMax;
}

export function buildSchedule(rng: Rng, fixedBoss?: string): { fights: Encounter[]; boss: Encounter; elites: number } {
  const d = D();
  const by = (tier: string) => d.encounters.filter((e) => e.tier === tier);
  const easy = rng.shuffle(by('easy').slice()).slice(0, 2);
  // 어려움 7: 같은 조합 반복 금지 → 6종을 다 쓴 뒤에만 반복, 바로 이어서는 금지
  const hardPool = by('hard');
  const hard: Encounter[] = [];
  let bag: Encounter[] = [];
  while (hard.length < 7) {
    if (!bag.length) bag = rng.shuffle(hardPool.slice());
    const next = bag.pop()!;
    if (hard.length && hard[hard.length - 1].id === next.id && bag.length) {
      bag.unshift(next);
      continue;
    }
    hard.push(next);
  }
  const eliteCount = rng.int(1, 2);
  const elites = rng.shuffle(by('elite').slice()).slice(0, eliteCount);
  const middle = hard.slice();
  for (const e of elites) {
    const pos = 1 + rng.int(0, middle.length - 1);
    middle.splice(pos, 0, e);
  }
  let boss = rng.pick(by('boss'));
  if (fixedBoss) boss = d.encounterById.get(fixedBoss) ?? boss;
  return { fights: [...easy, ...middle], boss, elites: eliteCount };
}

export function runExpedition(party: HeroId[], seed: number, opts: ExpeditionOptions): ExpeditionResult {
  const d = D();
  const rng = new Rng(seed);
  const pity = newPity();
  let deck: CardInst[] = starterDeck(party);
  const heroes: PHero[] = party.map((id) => {
    const hp = d.heroes.get(id)!.hp;
    return { id, hp, baseMax: hp, stress: 0, injured: false, recovering: false, dead: false };
  });
  const { fights, boss, elites } = buildSchedule(rng, opts.boss);
  const all = [...fights, boss];
  const res: ExpeditionResult = {
    cleared: false, fightsWon: 0, fightsTotal: all.length, boss: boss.id, bossReached: false, bossWon: false, bossHaewon: false, deaths: 0,
    wipedAt: null, haewons: 0, haewonEligible: 0, campChoice: 'none', deckSize: 0, picks: 0, skips: 0, elites,
  };
  const scratchAgg = opts.agg ?? newCombatAgg();
  const scratchCards = opts.cards ?? newCardAgg();
  for (let i = 0; i < all.length; i++) {
    const enc = all[i];
    const isBoss = i === all.length - 1;
    if (isBoss) res.bossReached = true;
    const startHp = heroes.map((h) => (h.dead ? 0 : h.hp));
    const s = createCombat({
      party: heroes.map((h) => ({ id: h.id, hp: h.hp, maxHp: h.baseMax, stress: h.stress, injured: h.injured, recovering: h.recovering, dead: h.dead })),
      deck, encounter: enc, seed: seedFrom(seed, 'fight', i), record: true, jijeon: 3, rules: opts.rules,
    });
    const { timeout } = runCombat(s);
    recordCombat(scratchAgg, scratchCards, s, party, startHp, timeout, deckIdsOf(deck));
    const st = s.stats!;
    res.haewons += st.haewons;
    res.haewonEligible += st.haewonEligible;
    // 죽은 영웅 → 덱의 그 영웅 카드는 곡
    s.heroes.forEach((h, idx) => {
      if (h.dead && !heroes[idx].dead) {
        res.deaths++;
        deck = deck.map((c) => (c.o === idx && c.o2 < 0 && c.d !== d.special.mourn ? { d: d.special.mourn, o: idx, o2: -1, orig: c.d, x: -1 } : c));
      }
    });
    if (s.outcome !== 1) {
      // 전멸: 영웅마다 마지막 사망 판정(버틸 확률 50%)
      for (const h of s.heroes) if (!h.dead && rng.next() >= 0.5) res.deaths++;
      res.wipedAt = enc.id;
      break;
    }
    res.fightsWon++;
    if (isBoss) {
      res.bossWon = true;
      res.bossHaewon = s.enemies.some((e) => d.enemies[e.def].category === 'boss' && e.haewon);
      res.cleared = true;
      break;
    }
    // 상태 이어 가기
    s.heroes.forEach((h, idx) => {
      const p = heroes[idx];
      p.dead = h.dead;
      p.hp = h.dead ? 0 : h.hp;
      p.stress = h.stress;
      p.injured = h.injured;
      p.recovering = h.recovering;
    });
    for (const [hi, cd] of s.newCurses) deck.push({ d: cd, o: hi, o2: -1, orig: -1, x: -1 });
    if (opts.betweenHeal) for (const h of heroes) if (!h.dead) h.hp = Math.min(effMax(h), h.hp + Math.round(h.baseMax * opts.betweenHeal));
    // 해원: 파티 귀기 회복 (−5 / 해원)
    if (st.haewons) for (const h of heroes) if (!h.dead) h.stress = Math.max(0, h.stress - 5 * st.haewons);
    // 카드 보상
    const tier: RewardTier = enc.tier === 'elite' ? 'elite' : 'normal';
    const alive = heroes.filter((h) => !h.dead).map((h) => h.id);
    const options = rollRewards(rng, alive, tier, pity);
    for (const o of options) scratchCards.offered[o.id] = (scratchCards.offered[o.id] ?? 0) + 1;
    const pick = pickReward(options, deck, true);
    if (pick) {
      deck.push(instFor(pick, party));
      scratchCards.picked[pick.id] = (scratchCards.picked[pick.id] ?? 0) + 1;
      res.picks++;
    } else res.skips++;
    // 6번째 전투 뒤 길굿
    if (i === 5) res.campChoice = camp(heroes, () => {
      deck = removeWorstStarter(deck);
    });
  }
  res.deckSize = deck.length;
  return res;
}

/** 길굿: 쌀로 끼니(체력 30%·귀기 −10·중상 치료) 또는 시작 카드 1장 제거 */
function camp(heroes: PHero[], remove: () => void): 'heal' | 'remove' {
  const alive = heroes.filter((h) => !h.dead);
  const needHeal = alive.some((h) => h.injured || h.hp / effMax(h) < 0.6);
  if (needHeal) {
    for (const h of alive) {
      h.injured = false;
      h.hp = Math.min(h.baseMax, h.hp + Math.round(h.baseMax * 0.3));
      h.stress = Math.max(0, h.stress - 10);
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
