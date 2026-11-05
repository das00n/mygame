// 전투 보상 (탐험 §10·§11): 카드 3택(어둠 이하 4택), 수호 방 오방기 뽑기, 보스 희귀 카드·가호.

import { rand } from '../../../src/core/rng.ts';
import type { CardDef, CombatState, HeroId } from '../../../src/core/types.ts';
import { instFor } from '../../../src/sim/draft.ts';
import { D, bandOf, ENEMY_EXTRA, RELIC_BY_ID, regionContent } from './content.ts';
import { addCurse, addRunStress, aliveIdx, healHero, heroName, logRun } from './run.ts';
import type { AppState, BattleMeta, FlagColor, RewardState, Run } from './types.ts';

const ODDS = { normal: { rare: 0.03, uncommon: 0.37 }, elite: { rare: 0.1, uncommon: 0.4 } };

function rollRarity(run: Run, tier: 'normal' | 'elite', bonus: number): string {
  const o = ODDS[tier];
  const rareP = Math.max(0, o.rare + bonus + run.pity);
  const r = rand(run);
  if (r < rareP) {
    run.pity = -0.05;
    return '희귀';
  }
  run.pity += 0.01;
  return r < rareP + o.uncommon ? '고급' : '일반';
}

function pickFrom(run: Run, pool: CardDef[], taken: CardDef[]): CardDef {
  const c = pool.filter((x) => !taken.includes(x));
  return c[Math.floor(rand(run) * c.length)];
}

/** 영웅마다 1장 (살아 있는 영웅만). 어둠 이하 4택, 칠흑이면 희귀 1장 보장 */
export function rollCards(run: Run, tier: 'normal' | 'elite'): string[] {
  const d = D();
  const band = bandOf(run.light);
  const alive = aliveIdx(run).map((i) => run.heroes[i].id);
  if (!alive.length) return [];
  const out: CardDef[] = [];
  const heroesFor: HeroId[] = alive.slice();
  while (heroesFor.length < band.choices && alive.length) heroesFor.push(alive[Math.floor(rand(run) * alive.length)]);
  for (const h of heroesFor) {
    const pool = d.pools.get(h)!;
    const rar = rollRarity(run, tier, band.rareUp);
    let cands = pool.filter((c) => c.rarity === rar && !out.includes(c));
    if (!cands.length) cands = pool.filter((c) => !out.includes(c));
    out.push(cands[Math.floor(rand(run) * cands.length)]);
  }
  if (band.rareGuaranteed && !out.some((c) => c.rarity === '희귀')) {
    const h = heroesFor[heroesFor.length - 1];
    const rares = d.pools.get(h)!.filter((c) => c.rarity === '희귀' && !out.includes(c));
    if (rares.length) out[out.length - 1] = rares[Math.floor(rand(run) * rares.length)];
  }
  return out.map((c) => c.id);
}

export function rollRares(run: Run): string[] {
  const d = D();
  const out: CardDef[] = [];
  for (const i of aliveIdx(run)) {
    const pool = d.pools.get(run.heroes[i].id)!.filter((c) => c.rarity === '희귀');
    if (pool.length) out.push(pickFrom(run, pool, out));
  }
  return out.map((c) => c.id);
}

export function rollRelics(run: Run, tiers: string[], n: number): string[] {
  // 그 지역의 가호 (특정 사건으로만 얻는 가호는 빼고)
  // 숨살이꽃(⟨반복 5⟩ final_reward)은 최종 원정의 수호 방에서만 받는다
  const pool = regionContent(run.region ?? 1).relics
    .filter((r) => tiers.includes(r.tier) && !run.relics.includes(r.id) && !(r as { source?: string }).source && !(r as { final_reward?: boolean }).final_reward)
    .map((r) => r.id);
  const out: string[] = [];
  while (out.length < n && pool.length) {
    const i = Math.floor(rand(run) * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

export function makeReward(app: AppState, meta: BattleMeta, gold: number, mats: number, lines: string[]): RewardState {
  const run = app.run!;
  const r: RewardState = {
    title: meta.tier === 'boss' ? '큰 원귀를 보냈다' : meta.tier === 'elite' ? '수호 방을 지났다' : '전투 승리',
    gold, materials: mats, lines, cards: null, cardsTaken: false, flags: null, relics: null, relicPicked: true, rareCards: null, rarePicked: true,
    bossEnd: meta.tier === 'boss',
  };
  if (meta.tier === 'boss') {
    r.cards = rollRares(run);
    r.relics = rollRelics(run, ['보스'], 3);
    r.relicPicked = r.relics.length === 0;
  } else if (meta.cardReward) {
    r.cards = rollCards(run, meta.tier === 'elite' ? 'elite' : 'normal');
  } else {
    r.cardsTaken = true;
    r.lines.push('이미 지나온 길목의 원귀라 카드 보상은 없다');
  }
  if (!r.cards || !r.cards.length) r.cardsTaken = true;
  if (meta.tier === 'elite') {
    const pool: FlagColor[] = ['red', 'white', 'yellow', 'blue'];
    if (run.light <= 0) pool.push('black'); // 칠흑일 때만 검정기가 섞인다
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand(run) * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    r.flags = { colors: pool.slice(0, 3), peek: run.relics.includes('obanggi') ? 0 : -1, picked: -1 };
    // 숨살이꽃 (⟨반복 5⟩ I-08): 최종 원정의 수호 방을 지나면 — 열두째 대문 너머 꽃밭의 꽃 한 송이
    if (run.campaign?.length === 'final' && !run.relics.includes('sumsari_kkot')) {
      run.relics.push('sumsari_kkot');
      r.lines.push(`희귀 가호 「숨살이꽃」 — ${RELIC_BY_ID.get('sumsari_kkot')?.effect ?? ''}`);
      logRun(run, '수호 방 너머에서 숨살이꽃 한 송이를 얻었다.');
    }
  }
  return r;
}

/** 막방광침 (⟨반복 4⟩ 02-core-rules §13): 이번 전투에서 해원한 원귀 가운데 아끼던 물건이 있는 것(보스 → 엘리트 순) */
export function keepsakeFor(s: CombatState): RewardState['keepsake'] {
  const d = D();
  const order = { final: 0, boss: 0, elite: 1, normal: 2, minion: 3 } as Record<string, number>;
  const cands = s.enemies
    .filter((e) => e.haewon && !e.summoned)
    .map((e) => d.enemies[e.def])
    .filter((def) => ENEMY_EXTRA.get(def.id)?.keepsake)
    .sort((a, b) => (order[a.category] ?? 9) - (order[b.category] ?? 9));
  if (!cands.length) return null;
  const k = ENEMY_EXTRA.get(cands[0].id)!.keepsake!;
  return { enemy: cands[0].id, name: k.name, text: k.text, choice: null };
}

/** 막방광침 귀기 회복: 태워 보내면 서 있는 영웅마다 */
export const KEEPSAKE_BURN_STRESS = 10;

/** 막방광침: 'burn' 태워서 넋이 가져가게 한다(서 있는 영웅 귀기 −10) · 'keep' 남겨서 골동으로 사당에 둔다 */
export function chooseKeepsake(app: AppState, choice: 'burn' | 'keep'): void {
  const run = app.run!;
  const r = app.reward;
  const k = r?.keepsake;
  if (!k || k.choice) return;
  k.choice = choice;
  const enemyName = ENEMY_EXTRA.get(k.enemy)?.name ?? k.enemy;
  if (choice === 'burn') {
    for (const i of aliveIdx(run)) addRunStress(run, i, -KEEPSAKE_BURN_STRESS, false);
    run.track.burned = (run.track.burned ?? 0) + 1;
    r!.lines.push(`막방광침: 「${k.name}」을(를) 태워 ${enemyName}이(가) 가져가게 했다 — 서 있는 영웅 귀기 −${KEEPSAKE_BURN_STRESS}`);
    logRun(run, `「${k.name}」을(를) 태워 보냈다`);
  } else {
    (run.track.keepsakes ??= []).push(k.enemy);
    r!.lines.push(`막방광침: 「${k.name}」을(를) 남겼다 — ${run.campaign ? '마을 사당에 골동으로 둔다' : '원정 기록에 남는다'}`);
    logRun(run, `「${k.name}」을(를) 남겼다`);
  }
}

export function takeCard(app: AppState, id: string | null): void {
  const run = app.run!;
  const r = app.reward!;
  if (r.cardsTaken) return;
  r.cardsTaken = true;
  if (!id) {
    run.stats.cardsSkipped++;
    return;
  }
  const def = D().cardById.get(id)!;
  run.deck.push(instFor(def, run.party));
  run.stats.cardsTaken++;
  logRun(run, `카드 「${def.name}」을(를) 덱에 넣었다`);
}

export const FLAG_INFO: Record<FlagColor, { name: string; meaning: string; text: string; color: string }> = {
  red: { name: '빨강', meaning: '재수', text: '엽전 + 원귀 재료', color: '#c8332b' },
  white: { name: '흰색', meaning: '명복', text: '파티 체력 20% 회복, 중상 1개 치료', color: '#ece6d6' },
  yellow: { name: '노랑', meaning: '조상', text: '가호 1개 3택', color: '#e2b23a' },
  blue: { name: '파랑', meaning: '우환', text: '희귀 카드 1장 + 씌임 카드 1장', color: '#2f6fb3' },
  black: { name: '검정', meaning: '고위험', text: '희귀 가호 1개 + 다음 전투 기습당함', color: '#1b1716' },
};

export function pickFlag(app: AppState, i: number): void {
  const run = app.run!;
  const r = app.reward!;
  if (!r.flags || r.flags.picked >= 0) return;
  r.flags.picked = i;
  const c = r.flags.colors[i];
  const info = FLAG_INFO[c];
  r.lines.push(`오방기: ${info.name}(${info.meaning}) 깃발이 나왔다`);
  switch (c) {
    case 'red': {
      const g = 30 + Math.floor(rand(run) * 21);
      run.gold += g;
      run.materials += 2;
      r.lines.push(`엽전 +${g}, 재료 +2`);
      break;
    }
    case 'white': {
      let healed = 0;
      for (const h of run.heroes) if (!h.dead) healed += healHero(h, h.baseMax * 0.2);
      const inj = run.heroes.find((h) => !h.dead && h.injured);
      if (inj) {
        inj.injured = false;
        r.lines.push(`${heroName(inj.id)}의 중상이 나았다`);
      }
      r.lines.push(`파티 체력 +${healed}`);
      break;
    }
    case 'yellow':
      r.relics = rollRelics(run, ['일반', '고급'], 3);
      r.relicPicked = r.relics.length === 0;
      break;
    case 'blue':
      r.rareCards = rollRares(run);
      r.rarePicked = r.rareCards.length === 0;
      r.lines.push(addCurse(run));
      break;
    case 'black': {
      const rel = rollRelics(run, ['희귀'], 1)[0];
      if (rel) {
        run.relics.push(rel);
        r.lines.push(`희귀 가호 「${RELIC_BY_ID.get(rel)!.name}」`);
        applyRelicGain(run, rel);
      }
      run.next.ambush = true;
      r.lines.push('다음 전투는 기습당한다');
      break;
    }
  }
}

export function pickRelic(app: AppState, id: string | null): void {
  const run = app.run!;
  const r = app.reward!;
  if (r.relicPicked) return;
  r.relicPicked = true;
  if (!id) return;
  run.relics.push(id);
  applyRelicGain(run, id);
  r.lines.push(`가호 「${RELIC_BY_ID.get(id)!.name}」을(를) 받았다`);
  logRun(run, `가호 「${RELIC_BY_ID.get(id)!.name}」`);
}

export function pickRare(app: AppState, id: string | null): void {
  const run = app.run!;
  const r = app.reward!;
  if (r.rarePicked) return;
  r.rarePicked = true;
  if (!id) return;
  const def = D().cardById.get(id)!;
  run.deck.push(instFor(def, run.party));
  run.stats.cardsTaken++;
  r.lines.push(`희귀 카드 「${def.name}」`);
}

/** 얻는 즉시 걸리는 가호 */
export function applyRelicGain(run: Run, id: string): void {
  if (id === 'seongju') {
    for (const h of run.heroes) if (!h.dead) {
      h.baseMax += 4;
      h.hp += 4;
    }
  }
  // 성주 한지 (⟨반복 5⟩ I-04): 중상이 낫고 최대 체력 +2
  if (id === 'seongju_hanji') {
    for (const h of run.heroes) if (!h.dead) {
      h.injured = false;
      h.baseMax += 2;
      h.hp += 2;
    }
  }
  if (id === 'seonang') {
    for (const c of run.dungeon.corridors) for (const t of c.tiles) if (t.content.k === 'trap') t.known = true;
  }
  if (id === 'eop_gaho') {
    const ids = ['candle', 'rice', 'incense', 'jijeon', 'bujeok', 'sul'] as const;
    run.supplies[ids[((run.seed % ids.length) + ids.length) % ids.length]]++;
  }
  if (id === 'eopgyeong_georul') {
    for (const e of D().enemies) if (e.region === run.region && e.haewon.kind !== 'none' && !run.revealed.includes(e.id)) run.revealed.push(e.id);
  }
}

export function rewardDone(r: RewardState): boolean {
  return r.cardsTaken && r.relicPicked && r.rarePicked && (!r.flags || r.flags.picked >= 0);
}
