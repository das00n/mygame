import assert from 'node:assert/strict';
import { test } from 'node:test';
import { D, endPlayerTurn, enemyTurn, killEnemy, startPlayerTurn } from '../src/core/engine.ts';
import { chooseIntent } from '../src/core/enemy.ts';
import { intentId, mk } from './helpers.ts';

test('패턴 cycle: 물에 젖은 넋 a → b → a → b', () => {
  const s = mk(['seungnyeo', 'posu', 'chasa'], 'e1');
  const seq = [intentId(s, 0)];
  for (let k = 0; k < 3; k++) {
    chooseIntent(s, s.enemies[0]);
    seq.push(intentId(s, 0));
  }
  assert.deepEqual(seq, ['a', 'b', 'a', 'b']);
});

test('패턴 weighted: 아전 원귀는 첫 턴 b, 같은 행동 연속 2회 금지, 가중치 대략 40/30/30', () => {
  const s = mk(['seungnyeo', 'posu', 'chasa'], 'x1', 11);
  const seq = [intentId(s, 0)];
  for (let k = 0; k < 3000; k++) {
    chooseIntent(s, s.enemies[0]);
    seq.push(intentId(s, 0));
  }
  assert.equal(seq[0], 'b');
  for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1]);
  const cnt = (x: string) => seq.filter((v) => v === x).length / seq.length;
  assert.ok(cnt('a') > 0.3 && cnt('a') < 0.45, `a ${cnt('a')}`);
});

test('패턴 phased: 뱃사공은 체력 50% 이하에서 2단계(d·e·f)로 바뀐다', () => {
  const s = mk(['seungnyeo', 'posu', 'chasa'], 'b1', 5);
  const e = s.enemies[0];
  const p1 = [intentId(s, 0)];
  for (let k = 0; k < 5; k++) {
    chooseIntent(s, e);
    p1.push(intentId(s, 0));
  }
  assert.deepEqual(p1, ['a', 'b', 'c', 'a', 'b', 'c']);
  e.hp = Math.floor(e.maxHp / 2);
  const p2: string[] = [];
  for (let k = 0; k < 60; k++) {
    chooseIntent(s, e);
    p2.push(intentId(s, 0));
  }
  assert.ok(p2.every((x) => ['d', 'e', 'f'].includes(x)));
  assert.equal(e.phase, 1);
  e.hp = e.maxHp;
  chooseIntent(s, e);
  assert.ok(['d', 'e', 'f'].includes(intentId(s, 0)), '단계는 되돌아가지 않는다');
});

test('override: 상여꾼이 2명 이하면 상여는 매 턴 무너지는 상여(c)', () => {
  const d = D();
  const s = mk(['seungnyeo', 'posu', 'chasa'], 'b2');
  const sy = s.enemies.findIndex((e) => d.enemies[e.def].id === 'sangyeo');
  assert.equal(intentId(s, sy), 'a');
  chooseIntent(s, s.enemies[sy]);
  assert.equal(intentId(s, sy), 'b');
  killEnemy(s, 0);
  killEnemy(s, 1);
  chooseIntent(s, s.enemies[sy]);
  assert.equal(intentId(s, sy), 'c');
  assert.equal(s.enemies[sy].atkBonus, 6, '상여꾼이 쓰러질 때마다 상여 공격 +3');
});

test('끌어당김: 후열 영웅을 선두로 / 진형 섞기 / 잡음 카드 / 달아나기', () => {
  const d = D();
  let s = mk(['seungnyeo', 'posu', 'chasa'], 'e1');
  const back = s.formation[2];
  s.enemies[0].intent = 1; // 끌어당김 (후열 3 피해 + 선두로)
  s.enemies[1].intent = -1;
  endPlayerTurn(s);
  enemyTurn(s);
  assert.equal(s.formation[0], back);
  // 굿판 훼방꾼: 잡음 2장
  s = mk(['seungnyeo', 'posu', 'chasa'], 'h2');
  for (const e of s.enemies) e.intent = -1;
  const g = s.enemies.findIndex((e) => d.enemies[e.def].id === 'gutpan_hwebang');
  s.enemies[g].intent = 0;
  endPlayerTurn(s);
  enemyTurn(s);
  assert.equal(s.draw.filter((c) => c.d === d.special.noise).length, 2);
  // 봇짐 진 객귀: 세 번째 행동에 달아난다 → 처치·해원 아님
  s = mk(['seungnyeo', 'posu', 'chasa'], 'h3');
  const b = s.enemies.findIndex((e) => d.enemies[e.def].id === 'botjim_gaekgwi');
  for (const x of s.heroes) x.hp = x.maxHp = 999;
  for (let t = 0; t < 3; t++) {
    endPlayerTurn(s);
    enemyTurn(s);
    if (t < 2) startPlayerTurn(s);
  }
  assert.equal(s.enemies[b].escaped, true);
  assert.equal(s.enemies[b].dead, false);
});

test('적 방어도는 적 턴 시작 시 0', () => {
  const s = mk(['seungnyeo', 'posu', 'chasa'], 'h1');
  const m = s.enemies[0];
  m.block = 9;
  for (const e of s.enemies) e.intent = -1;
  endPlayerTurn(s);
  assert.equal(m.block, 9);
  enemyTurn(s);
  assert.equal(m.block, 0);
});
