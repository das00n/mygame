import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCombat, D } from '../src/core/engine.ts';
import type { HeroId } from '../src/core/types.ts';
import { runCombat } from '../src/sim/bot.ts';
import { starterDeck } from '../src/sim/draft.ts';
import { runExpedition } from '../src/sim/expedition.ts';

function once(seed: number, enc: string) {
  const d = D();
  const party: HeroId[] = ['manshin', 'posu', 'chasa'];
  const s = createCombat({ party: party.map((id) => ({ id })), deck: starterDeck(party), encounter: d.encounterById.get(enc)!, seed, record: true, log: true });
  runCombat(s);
  return { outcome: s.outcome, turn: s.turn, hp: s.heroes.map((h) => h.hp), log: s.log!.join('\n'), plays: [...s.stats!.plays.entries()] };
}

test('같은 시드 → 같은 전투 (결정적 재현)', () => {
  for (const enc of ['h4', 'x1', 'b1']) {
    const a = once(42, enc);
    const b = once(42, enc);
    assert.deepEqual(a, b);
  }
  const c = once(43, 'x1');
  const a = once(42, 'x1');
  assert.notEqual(a.log, c.log, '다른 시드는 다른 전투');
});

test('같은 시드 → 같은 원정', () => {
  const a = runExpedition(['seungnyeo', 'beopsa', 'talggun'], 1234, {});
  const b = runExpedition(['seungnyeo', 'beopsa', 'talggun'], 1234, {});
  assert.deepEqual(a, b);
});
