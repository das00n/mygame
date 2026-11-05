// v0.3 반복 1: 07-prototype §9 의 문장·데이터 불일치를 데이터로 고친 카드들이 문장대로 동작하는지.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { D, endPlayerTurn, enemyTurn, startPlayerTurn, swapHeroes } from '../src/core/engine.ts';
import { heroIdx, mk, play } from './helpers.ts';

test('맺힌 한 거두기: 상흔을 모두 거두고(소모) 1당 명부 4', () => {
  const s = mk(['chasa', 'posu', 'baksu'], 'e2');
  const e = s.enemies[0];
  e.hp = e.maxHp = 999;
  e.bleed = 3;
  play(s, 'chasa.maethin_han', { enemy: 0 });
  assert.equal(e.bleed, 0, '상흔을 거둔다');
  assert.equal(e.doom, 12);
});

test('동명이인: 명부를 다른 적에게 옮긴다(원래 적의 명부는 0)', () => {
  const s = mk(['chasa', 'posu', 'baksu'], 'h5');
  for (const e of s.enemies) e.hp = e.maxHp = 999;
  s.enemies[0].doom = 5;
  s.enemies[1].doom = 0;
  play(s, 'chasa.dongmyeong_iin', { enemy: 0, enemy2: 1 });
  assert.equal(s.enemies[0].doom, 0);
  assert.equal(s.enemies[1].doom, 5);
});

test('숨통 겨누기: 화약 1을 쓰면 점지를 그대로, 아니면 모두 없앤다 (else 갈래)', () => {
  const s = mk(['posu', 'seungnyeo', 'chasa'], 'e2');
  const e = s.enemies[0];
  e.hp = e.maxHp = 999;
  const posu = s.heroes[heroIdx(s, 'posu')];
  s.energy = 9;
  e.mark = 3;
  posu.personal = 1;
  play(s, 'posu.sumtong', { enemy: 0 });
  assert.equal(e.mark, 3, '화약을 썼으니 점지는 남는다');
  assert.equal(posu.personal, 0);
  play(s, 'posu.sumtong', { enemy: 0 });
  assert.equal(e.mark, 0, '화약이 없으면 점지를 모두 없앤다');
});

test('호신부: 수호부는 다음 턴 시작에 손에 들어온다 (token when: next_turn)', () => {
  const s = mk(['beopsa', 'posu', 'chasa'], 'e2');
  s.enemies[0].hp = s.enemies[0].maxHp = 999;
  const suhobu = D().cardById.get('beopsa.t_suhobu')!.idx;
  play(s, 'beopsa.hosinbu', { ally: heroIdx(s, 'posu') });
  assert.equal(s.hand.filter((c) => c.d === suhobu).length, 0, '지금은 없다');
  endPlayerTurn(s);
  enemyTurn(s);
  startPlayerTurn(s);
  assert.equal(s.hand.filter((c) => c.d === suhobu).length, 1, '다음 턴 시작에 1장');
});

test('춤사위 맞추기: 장단 +2, 이번 턴 진형이 바뀔 때마다 장단 +1 (this_turn 능력), 다음 턴에는 없다', () => {
  const s = mk(['jaebi', 'posu', 'chasa'], 'e2');
  s.enemies[0].hp = s.enemies[0].maxHp = 999;
  play(s, 'jaebi.chumsawi');
  assert.equal(s.jangdan, 2);
  swapHeroes(s, 0, 1);
  assert.equal(s.jangdan, 3, '진형이 바뀌어 +1');
  swapHeroes(s, 0, 1);
  assert.equal(s.jangdan, 4);
  endPlayerTurn(s);
  enemyTurn(s);
  startPlayerTurn(s);
  const before = s.jangdan;
  swapHeroes(s, 0, 1);
  assert.equal(s.jangdan, before, '다음 턴에는 트리거가 없다');
});

test('능력 트리거는 데이터에 적힌 엔진 이름 그대로 (빈 트리거 없음)', () => {
  const d = D();
  for (const c of d.cards) {
    for (const op of c.effects) if (op.op === 'power') assert.notEqual(op.trigger, 'unknown', `${c.id}`);
  }
  const cheongbo = d.cardById.get('jaebi.cheongbo')!.effects.find((o) => o.op === 'power');
  assert.ok(cheongbo && cheongbo.op === 'power' && cheongbo.trigger === 'turn_start');
});

test('⟨반복 3⟩ 동명이인: 고른 적의 명부를 모두 다른 적(두 번째 대상)에게 옮기고, 점지 2도 옮겨 받은 적에게', () => {
  const s = mk(['chasa', 'posu', 'seungnyeo'], 'h1');
  for (const e of s.enemies) e.hp = e.maxHp = 999;
  s.enemies[0].doom = 5;
  play(s, 'chasa.dongmyeong_iin', { enemy: 0, enemy2: 1 });
  assert.equal(s.enemies[0].doom, 0);
  assert.equal(s.enemies[1].doom, 5);
  assert.equal(s.enemies[0].mark, 0, '명부를 빼앗긴 적에게는 점지가 없다');
  assert.equal(s.enemies[1].mark, 2, '옮겨 받은 적에게 점지 2');
});
