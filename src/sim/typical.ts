// 지역 N 의 '전형적인 캠페인 파티' (반복 2 보정 기준). 덱은 원정마다 새로 시작한다(H5):
// 영웅마다 로드아웃 4장(시작 카드 + 익힌 카드) + 레벨 체력 + 각인 + 신물 + 합기.
// 수치는 sim:campaign 의 지역별 실제 파티 평균(data/sim/campaign.json summary.typical)에서 가져온다.

import { D } from '../core/engine.ts';
import { RAW_JSON } from '../core/raw-data.ts';
import { Rng, seedFrom } from '../core/rng.ts';
import type { CardInst, HeroId } from '../core/types.ts';
import { engraveCode } from '../meta/campaign.ts';
import { CD } from '../meta/content.ts';
import { bestLoadout, cardScore, duoCard, sinmulFor } from '../meta/loadout.ts';
import { newPity, pickReward, rollRewards, starterDeck } from './draft.ts';
import type { ExpeditionSetup } from './expedition.ts';

export interface TypicalParty {
  /** 파티 평균 레벨 (최대 체력 +3 / 레벨) */
  level: number;
  /** 영웅마다 익힌 카드 수 */
  learned: number;
  /** 각인한 영웅 수 */
  engraved: number;
  sinmul: number;
  duo: number;
}

/** sim:campaign (봇, 100회) 의 지역별 원정 파티 평균 — 반복 3 보정 기준 (data/sim/campaign.json summary.typical).
 *  반복 2: 1 {0.95, 2.8, 1.7, 0.7, 0.3} · 2 {1.9, 5, 3, 1.3, 0.9} · 3 {2.6, 7.5, 3, 1.6, 1.5} */
export const TYPICAL: Record<number, TypicalParty> = {
  1: { level: 0.9, learned: 3.4, engraved: 1.3, sinmul: 0.4, duo: 0.6 },
  2: { level: 2.2, learned: 6.8, engraved: 3, sinmul: 0.9, duo: 1.3 },
  3: { level: 2.7, learned: 8.8, engraved: 3, sinmul: 1.4, duo: 1.75 },
};

const RES_STATUS: Record<string, string> = { M: '점지', B: '상흔', D: '명부', C: '넋흔들림', K: '장단', F: '진형', S: '굿상', T: '부적' };

function importOf(hero: HeroId): string {
  const hj = RAW_JSON['data/design/heroes.json'] as { heroes: { id: string; import: string }[] };
  return RES_STATUS[hj.heroes.find((h) => h.id === hero)!.import] ?? '점지';
}

export interface TypicalBuild {
  setup: ExpeditionSetup;
  deck: CardInst[];
}

/** 조합 하나의 전형적인 파티 (시드마다 익힌 카드가 다르다) */
export function typicalParty(trio: HeroId[], region: number, seed: number, t: TypicalParty = TYPICAL[region], length: ExpeditionSetup['length'] = 'boss'): TypicalBuild {
  const d = D();
  const rng = new Rng(seedFrom('typical', trio.join('+'), region, seed));
  const pity = newPity();
  const deck: CardInst[] = [];
  const frac = (x: number) => Math.floor(x) + (rng.next() < x - Math.floor(x) ? 1 : 0);
  const learnedN = frac(t.learned);
  const engraveFor = new Set(trio.slice(0, frac(t.engraved)));
  const duoN = frac(t.duo);
  const sinmulN = frac(t.sinmul);
  trio.forEach((h, i) => {
    // 익힌 카드: 보상을 고르듯 영웅 풀에서
    const learned: string[] = [];
    const prof = starterDeck([h]);
    for (let k = 0; k < learnedN; k++) {
      const opts = rollRewards(rng, [h, h, h], 'normal', pity).filter((c) => !learned.includes(c.id));
      const pick = pickReward(opts, prof, false);
      if (pick) learned.push(pick.id);
    }
    const loadout = bestLoadout(h, learned);
    const best = [...loadout].sort((a, b) => cardScore(d.cardById.get(b)!) - cardScore(d.cardById.get(a)!))[0];
    for (const id of loadout) {
      const g = engraveFor.has(h) && id === best ? engraveCode(importOf(h)) : 0;
      deck.push(g ? { d: d.cardById.get(id)!.idx, o: i, o2: -1, orig: -1, x: -1, g } : { d: d.cardById.get(id)!.idx, o: i, o2: -1, orig: -1, x: -1 });
    }
  });
  // 합기 (정 5 이상인 쌍)
  for (let k = 0; k < duoN; k++) {
    const a = trio[k % 3];
    const b = trio[(k + 1) % 3];
    const id = duoCard(a, b);
    if (!id) continue;
    const def = d.cardById.get(id)!;
    deck.push({ d: def.idx, o: trio.indexOf(def.heroes[0]), o2: trio.indexOf(def.heroes[1]), orig: -1, x: -1 });
  }
  // 신물 (조상신이 된 다른 원형의 카드, 주인 파티)
  const others = (['manshin', 'jaebi', 'posu', 'baksu', 'seungnyeo', 'beopsa', 'talggun', 'chasa'] as HeroId[]).filter((h) => !trio.includes(h));
  for (let k = 0; k < sinmulN; k++) {
    const h = rng.pick(others);
    const plays: Record<string, number> = {};
    for (const c of d.pools.get(h)!) if (c.effects.some((o) => o.op === 'dmg' || o.op === 'apply')) plays[c.id] = Math.floor(rng.next() * 5);
    const id = sinmulFor(h, plays);
    if (id) deck.push({ d: d.cardById.get(id)!.idx, o: -1, o2: -1, orig: -1, x: -1 });
  }
  const hpBonus = Math.round(CD.levels.hpPerLevel * t.level);
  const setup: ExpeditionSetup = {
    region, length, deck,
    heroes: trio.map((id) => ({ id, maxHp: d.heroes.get(id)!.hp + hpBonus })),
    provisions: provisionsFor(region, length),
  };
  return { setup, deck };
}

/** 권장 보급품 (공물·업경대에 쓰는 것만 원정 시뮬이 읽는다) */
export function provisionsFor(region: number, length: ExpeditionSetup['length']): { jijeon: number; rice: number; sul: number; bujeok: number; incense: number } {
  const r = CD.provisions.recommended[String(region)];
  const s = r?.[length] ?? r?.boss;
  return { jijeon: s?.jijeon ?? 3, rice: s?.rice ?? 0, sul: s?.sul ?? 0, bujeok: s?.bujeok ?? 0, incense: s?.incense ?? 0 };
}
