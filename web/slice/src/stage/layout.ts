// 무대 자리 (무대 좌표 1280 × 480, 발선 330) — PixiJS 무대와 그 위 HTML 층(의도 배지 · 이름판)이 같이 쓴다.
// 영웅: 후열 125 · 중열 255 · 선두 385 (러프와 같다). 굿상 515. 원귀: 앞 → 뒤로 등급 무게만큼 폭을 나눈다.

import type { CombatState } from '../../../../src/core/types.ts';
import { D, ENEMY_EXTRA } from '../../../src/game/content.ts';

export const HERO_X = [385, 255, 125];
export const HERO_SCALE = 1.12;
export const ALTAR_X = 515;
export const PLATE_Y = 344;
export type Tier = 'normal' | 'minion' | 'elite' | 'boss';
export const TIER_SCALE: Record<Tier, number> = { normal: 1, minion: 0.82, elite: 1.25, boss: 1.6 };
const WEIGHT: Record<Tier, number> = { normal: 1, minion: 0.85, elite: 1.25, boss: 1.6 };

export function tierOf(s: CombatState, ei: number): Tier {
  const c = D().enemies[s.enemies[ei].def].category;
  return (['normal', 'minion', 'elite', 'boss'].includes(c) ? c : 'normal') as Tier;
}

export function heroXs(s: CombatState): Map<number, number> {
  const m = new Map<number, number>();
  s.formation.forEach((hi, i) => m.set(hi, HERO_X[i] ?? 60));
  const free = [...HERO_X.slice(s.formation.length), 40, 40];
  s.heroes.filter((h) => !s.formation.includes(h.idx)).forEach((h, k) => m.set(h.idx, free[k] ?? 40));
  return m;
}

export function enemyOrder(s: CombatState): number[] {
  const d = D();
  const POS: Record<string, number> = { front: 0, any: 1, back: 2 };
  return s.enemies.map((_, i) => i).sort((a, b) => {
    const pa = POS[ENEMY_EXTRA.get(d.enemies[s.enemies[a].def].id)?.position ?? 'any'] ?? 1;
    const pb = POS[ENEMY_EXTRA.get(d.enemies[s.enemies[b].def].id)?.position ?? 'any'] ?? 1;
    return pa - pb || a - b;
  });
}

export interface ESlot { x: number; w: number; tier: Tier }

export function enemySlots(s: CombatState): Map<number, ESlot> {
  const order = enemyOrder(s);
  const ws = order.map((ei) => WEIGHT[tierOf(s, ei)]);
  const total = ws.reduce((a, b) => a + b, 0);
  const unit = Math.min(205, 540 / Math.max(1, total));
  const start = total <= 1.7 ? 760 : 700;
  const m = new Map<number, ESlot>();
  let acc = 0;
  order.forEach((ei, k) => {
    m.set(ei, { x: start + unit * (acc + ws[k] / 2), w: Math.min(220, unit * ws[k] - 10), tier: tierOf(s, ei) });
    acc += ws[k];
  });
  return m;
}
