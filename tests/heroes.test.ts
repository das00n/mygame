// ⟨반복 4⟩ 영웅 단위 밸런스 (docs/03-heroes.md §2.1, docs/09-iteration.md §6):
// 원형 고유 방어(포수 「몸 낮추기」 · 탈꾼 「탈 뒤에 숨기」 · 차사 「군졸 자세」)와 원형별 레벨 체력.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCombat, D, guardBlockOf, startPlayerTurn, swapHeroes } from '../src/core/engine.ts';
import type { HeroId } from '../src/core/types.ts';
import { hpPerLevelOf } from '../src/meta/campaign.ts';
import { CD } from '../src/meta/content.ts';

function combat(party: HeroId[], level?: number) {
  const d = D();
  return createCombat({ party: party.map((id) => ({ id, level })), deck: [], encounter: d.encounters[0], seed: 7, record: false });
}

test('원형 고유 방어: 레벨 0 은 방어 0 (지역 1 단판·시작 덱 수치 그대로), 레벨마다 자란다', () => {
  assert.deepEqual([0, 1, 2, 3].map((lv) => guardBlockOf('posu', lv)), [0, 1, 3, 4]);
  assert.deepEqual([0, 1, 2, 3].map((lv) => guardBlockOf('talggun', lv)), [0, 1, 2, 3]);
  assert.deepEqual([0, 1, 2, 3].map((lv) => guardBlockOf('chasa', lv)), [0, 0, 1, 1]);
  for (const h of ['manshin', 'jaebi', 'baksu', 'seungnyeo', 'beopsa'] as HeroId[]) assert.equal(guardBlockOf(h, 3), 0, `${h}: 고유 방어 없음`);
  // 시뮬 전형 파티의 소수 레벨: 지역 2 (2.2) · 지역 3 (2.7)
  assert.deepEqual([guardBlockOf('posu', 2.2), guardBlockOf('talggun', 2.2), guardBlockOf('chasa', 2.2)], [3, 2, 1]);
  assert.deepEqual([guardBlockOf('posu', 2.7), guardBlockOf('talggun', 2.7), guardBlockOf('chasa', 2.7)], [4, 2, 1]);
});

test('포수 「몸 낮추기」·차사 「군졸 자세」: 플레이어 턴을 시작할 때 방어도 (레벨 없으면 0)', () => {
  const s0 = combat(['posu', 'chasa', 'manshin']);
  assert.deepEqual(s0.heroes.map((h) => h.block), [0, 0, 0], '레벨 없음 = 지역 1 단판');
  const s = combat(['posu', 'chasa', 'manshin'], 3);
  assert.deepEqual(s.heroes.map((h) => h.block), [4, 1, 0], '첫 턴부터');
  s.heroes[0].block = 0;
  startPlayerTurn(s);
  assert.equal(s.heroes[0].block, 4, '다음 턴에도 다시 얻는다');
  s.heroes[0].hp = 0;
  s.heroes[0].downed = true;
  startPlayerTurn(s);
  assert.equal(s.heroes[0].block, 0, '쓰러진 영웅은 얻지 않는다');
});

test('탈꾼 「탈 뒤에 숨기」: 칸이 바뀔 때마다(탈이 바뀔 때) 방어도, 턴당 2번까지', () => {
  const s = combat(['talggun', 'seungnyeo', 'posu'], 2);
  const t = s.heroes.findIndex((h) => h.id === 'talggun');
  const others = s.heroes.filter((h) => h.id !== 'talggun').map((h) => h.idx);
  const b0 = s.heroes[t].block;
  swapHeroes(s, t, others[0]);
  assert.equal(s.heroes[t].block, b0 + 2, '레벨 2: 방어도 2');
  swapHeroes(s, t, others[1]);
  assert.equal(s.heroes[t].block, b0 + 4);
  swapHeroes(s, t, others[0]);
  assert.equal(s.heroes[t].block, b0 + 4, '턴당 2번까지');
  // 탈꾼이 움직이지 않는 교대는 세지 않는다
  startPlayerTurn(s);
  const b1 = s.heroes[t].block;
  swapHeroes(s, others[0], others[1]);
  assert.equal(s.heroes[t].block, b1);
  // 레벨 0 이면 칸이 바뀌어도 방어 0
  const z = combat(['talggun', 'seungnyeo', 'posu']);
  const tz = z.heroes.findIndex((h) => h.id === 'talggun');
  swapHeroes(z, tz, z.heroes.find((h) => h.id === 'posu')!.idx);
  assert.equal(z.heroes[tz].block, 0);
});

test('원형별 레벨 체력: 만신 1 · 작두박수 2 · 법사 2 · 나머지는 공통 값', () => {
  assert.equal(hpPerLevelOf('manshin'), 1);
  assert.equal(hpPerLevelOf('baksu'), 2);
  assert.equal(hpPerLevelOf('beopsa'), 2);
  for (const h of ['jaebi', 'posu', 'seungnyeo', 'talggun', 'chasa'] as HeroId[]) assert.equal(hpPerLevelOf(h), CD.levels.hpPerLevel);
});
