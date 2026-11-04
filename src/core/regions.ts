// 지역 2·3 의 원정 계층 규칙 중 엔진·시뮬·플레이어블이 함께 쓰는 것.
// 업경대 비추기(05-region3 §9.2)와 고풀이 매듭 미리 풀기 순서(§9.3).

import { loadData } from './data.ts';
import { RAW_JSON } from './raw-data.ts';
import { KNOTS, type HeroId } from './types.ts';

/** 매듭 → 상태 기호 (synergy.json / heroes.json 의 자원 기호) */
const KNOT_KEY: Record<(typeof KNOTS)[number], string> = {
  점지: 'M', 상흔: 'B', 명부: 'D', 넋흔들림: 'C', 장단: 'K', 굿상: 'S', 부적: 'T', 진형: 'F',
};

/** 영웅이 만드는 공용 상태 (시그니처 + 수출 주·부) */
export function producedBy(hero: HeroId): Set<string> {
  const hj = RAW_JSON['data/design/heroes.json'] as { heroes: { id: string; signature: string }[] };
  const sj = RAW_JSON['data/design/synergy.json'] as { choice: Record<string, { main: string; minor: string[] }> };
  const h = hj.heroes.find((x) => x.id === hero);
  const c = sj.choice[hero];
  const out = new Set<string>();
  if (h) out.add(h.signature);
  if (c) {
    out.add(c.main);
    for (const m of c.minor) out.add(m);
  }
  return out;
}

/** 업경대가 미리 푸는 매듭 k개: 그 파티가 풀기 어려운 매듭(파티가 만들지 않는 상태)부터 (05-region3 §9.2) */
export function knotPresetBits(party: HeroId[], k: number): number {
  if (k <= 0) return 0;
  const made = new Set<string>();
  for (const h of party) for (const x of producedBy(h)) made.add(x);
  const order = KNOTS.map((name, i) => ({ i, hard: !made.has(KNOT_KEY[name]) }))
    .sort((a, b) => Number(b.hard) - Number(a.hard) || a.i - b.i);
  let bits = 0;
  for (const o of order.slice(0, k)) bits |= 1 << o.i;
  return bits;
}

export interface EopgyeongResult {
  /** 비춘 해원 수 (만신 +2) */
  count: number;
  /** 구간 0: 0~4 · 1: 5~9 · 2: 10~14 · 3: 15+ (향을 피우면 한 구간 위) */
  tier: number;
  knots: number;
  hpPct: number;
  draw: number;
  stress: number;
  reveal: boolean;
  text: string;
}

/** 업경대 비추기 (05-region3 §9.2): 이번 원정의 해원 수 → 해원 조건 공개 · 매듭 미리 풀기 · 체력. 거울은 판결하지 않는다 */
export function eopgyeong(haewons: number, opts: { incense?: boolean; manshin?: boolean } = {}): EopgyeongResult {
  const count = haewons + (opts.manshin ? 2 : 0);
  let tier = count >= 15 ? 3 : count >= 10 ? 2 : count >= 5 ? 1 : 0;
  if (opts.incense) tier = Math.min(3, tier + 1);
  const r: EopgyeongResult = { count, tier, knots: 0, hpPct: 0, draw: 0, stress: 0, reveal: false, text: '' };
  if (tier === 0) {
    r.stress = 10;
    r.text = `거울에 풀어 준 넋이 ${count}뿐이다. 파티 귀기 +10.`;
  } else if (tier === 1) {
    r.reveal = true;
    r.draw = 1;
    r.text = `거울에 풀어 준 넋 ${count}이 비친다. 장수의 해원 조건이 드러나고, 첫 턴에 1장 더 뽑는다.`;
  } else {
    r.reveal = true;
    r.draw = 1;
    r.knots = tier === 2 ? 1 : 2;
    r.hpPct = 0.15;
    r.text = `거울에 풀어 준 넋 ${count}이 줄지어 비친다. 맺힌 매듭 ${r.knots}개가 미리 풀리고, 모든 영웅 체력 +15%.`;
  }
  return r;
}

/** 지역의 원귀 id (해원록 완성도 계산) */
export function regionEnemyIds(region: number): string[] {
  return loadData().enemies.filter((e) => e.region === region && e.category !== 'minion').map((e) => e.id);
}
