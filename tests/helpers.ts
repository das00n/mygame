// 테스트 도우미: 손패·더미를 비운 전투를 만들고 원하는 카드를 손에 쥐여 준다.
import { createCombat, D, playCard } from '../src/core/engine.ts';
import type { ActionChoice, CardInst, CombatState, HeroId } from '../src/core/types.ts';

export function mk(party: HeroId[], enc: string, seed = 1): CombatState {
  const d = D();
  const s = createCombat({ party: party.map((id) => ({ id })), deck: [], encounter: d.encounterById.get(enc)!, seed, record: true, log: true });
  s.hand = [];
  s.draw = [];
  s.discard = [];
  s.energy = 3;
  return s;
}

export function inst(s: CombatState, cardId: string, hero?: HeroId): CardInst {
  const d = D();
  const def = d.cardById.get(cardId);
  if (!def) throw new Error(`no card ${cardId}`);
  const owner = hero ?? (def.heroes[0] as HeroId | undefined);
  const o = owner ? s.heroes.findIndex((h) => h.id === owner) : -1;
  let o2 = -1;
  if (def.ownerKind === 'duo') o2 = s.heroes.findIndex((h) => h.id === def.heroes[1]);
  return { d: def.idx, o, o2, orig: -1, x: -1 };
}

export function give(s: CombatState, cardId: string, hero?: HeroId): number {
  s.hand.push(inst(s, cardId, hero));
  return s.hand.length - 1;
}

export function play(s: CombatState, cardId: string, choice: Partial<ActionChoice> = {}, hero?: HeroId): void {
  const i = give(s, cardId, hero);
  playCard(s, { hand: i, enemy: -1, enemy2: -1, ally: -1, pair: null, ...choice });
}

export function heroIdx(s: CombatState, id: HeroId): number {
  return s.heroes.findIndex((h) => h.id === id);
}

export function intentId(s: CombatState, ei: number): string {
  const e = s.enemies[ei];
  return D().enemies[e.def].intents[e.intent].id;
}
