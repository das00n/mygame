import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  collapsed, D, deathSaveChance, downHero, endPlayerTurn, endureOf, enemyTurn, hitHero, killEnemy, playCard, startPlayerTurn,
} from '../src/core/engine.ts';
import { heroIdx, mk, play } from './helpers.ts';

test('받는소리 & 장단: 주인이 바뀌면 +1, 최대 5, 턴 종료 시 0', () => {
  const s = mk(['posu', 'seungnyeo', 'chasa'], 'e2');
  s.energy = 99;
  s.enemies[0].hp = s.enemies[0].maxHp = 999;
  s.enemies[0].endure = 999;
  play(s, 'posu.ganeumsoe', { enemy: 0 });
  assert.equal(s.jangdan, 0, '턴 첫 카드는 받는소리가 아니다');
  play(s, 'seungnyeo.moktak', { enemy: 0 });
  assert.equal(s.jangdan, 1);
  assert.equal(s.enemies[0].shake, 4, '받는소리: 넋흔들림 3 + 1');
  play(s, 'seungnyeo.moktak', { enemy: 0 });
  assert.equal(s.jangdan, 1, '같은 주인 연속 → 장단 그대로');
  assert.equal(s.enemies[0].shake, 7, '받는소리 불성립 → +3만');
  for (let i = 0; i < 6; i++) {
    play(s, 'posu.ganeumsoe', { enemy: 0 });
    play(s, 'seungnyeo.moktak', { enemy: 0 });
  }
  assert.equal(s.jangdan, 5, '장단 최대 5');
  // 합기는 항상 다른 주인, 합기 다음 그 주인의 카드는 성립하지 않는다
  endPlayerTurn(s);
  assert.equal(s.jangdan, 0, '턴 종료 시 장단 0');
  enemyTurn(s);
  startPlayerTurn(s);
  s.energy = 99;
  play(s, 'posu.ganeumsoe', { enemy: 0 });
  play(s, 'duo.chongseong_myeongbu', { enemy: 0 });
  assert.equal(s.jangdan, 1, '합기는 다른 주인');
  play(s, 'posu.ganeumsoe', { enemy: 0 });
  assert.equal(s.jangdan, 1, '합기 다음 포수 카드는 받는소리 아님');
  play(s, 'seungnyeo.moktak', { enemy: 0 });
  assert.equal(s.jangdan, 2);
});

test('근접 영웅이 공격하면 선두로 (효과 처리 뒤), 원거리는 그대로', () => {
  const s = mk(['baksu', 'posu', 'seungnyeo'], 'e2');
  const baksu = heroIdx(s, 'baksu');
  const posu = heroIdx(s, 'posu');
  const seung = heroIdx(s, 'seungnyeo');
  assert.deepEqual(s.formation, [seung, baksu, posu], '기본 진형: 수호·근접·체력 순');
  // 위치 조건은 카드를 낼 때 판정: 탈꾼 없이 작두박수 공격
  play(s, 'baksu.sinkal', { enemy: 0 });
  assert.deepEqual(s.formation, [baksu, seung, posu]);
  play(s, 'posu.hwaseungchong', { enemy: 0 });
  assert.deepEqual(s.formation, [baksu, seung, posu], '원거리 공격은 이동 없음');
  assert.equal(s.formChanges, 1);
});

test('합기 공격: 마지막으로 공격하는 근접 영웅이 선두로', () => {
  const s = mk(['posu', 'baksu', 'chasa'], 'h1');
  s.energy = 9;
  const baksu = heroIdx(s, 'baksu');
  const chasa = heroIdx(s, 'chasa');
  assert.equal(s.formation[0], chasa);
  play(s, 'duo.hwaseung_sinkal', { enemy: 0 });
  assert.equal(s.formation[0], baksu, '포수가 쏘고 작두박수가 이어 벤다 → 작두박수 돌격');
});

test('방어도는 플레이어 턴 시작 시 0', () => {
  const s = mk(['seungnyeo', 'posu', 'chasa'], 'e2');
  play(s, 'seungnyeo.hapjang');
  const h = s.heroes[heroIdx(s, 'seungnyeo')];
  assert.equal(h.block, 6);
  assert.equal(h.personal, 1, '방어도를 얻으면 염주 +1');
  s.enemies[0].intent = -1; // 아무것도 안 함
  endPlayerTurn(s);
  enemyTurn(s);
  assert.equal(h.block, 6, '적 턴 동안은 남는다');
  startPlayerTurn(s);
  assert.equal(h.block, 0);
});

test('취약 ×1.5 · 약화 ×0.75 · 붕괴 ×1.5 → 내림 → 방어도', () => {
  const s = mk(['talggun', 'posu', 'chasa'], 'e2');
  s.energy = 9;
  const e = s.enemies[0];
  e.hp = e.maxHp = 200;
  e.endure = 999;
  s.heroes[heroIdx(s, 'talggun')].weak = 1;
  e.vuln = 1;
  play(s, 'talggun.kkujitneun_jaedam', { enemy: 0 }); // 피해 10
  assert.equal(200 - e.hp, Math.floor(10 * 0.75 * 1.5));
  // 붕괴까지 겹치면 ×1.5 더, 방어도가 먼저 막는다
  const before = e.hp;
  e.collapseUntil = s.turn + 1;
  e.block = 4;
  play(s, 'talggun.kkujitneun_jaedam', { enemy: 0 });
  assert.equal(before - e.hp, Math.floor(10 * 0.75 * 1.5 * 1.5) - 4);
  // 적의 약화: 주는 피해 −25%
  const s2 = mk(['seungnyeo', 'posu', 'chasa'], 'e1');
  for (const x of s2.enemies) x.intent = -1;
  const e2 = s2.enemies[0];
  e2.intent = 0; // 젖은 손 3×2 → 선두
  e2.weak = 1;
  const front = s2.heroes[s2.formation[0]];
  const hp0 = front.hp;
  endPlayerTurn(s2);
  enemyTurn(s2);
  assert.equal(hp0 - front.hp, 2 * Math.floor(3 * 0.75));
});

test('상흔: 적 턴 시작 시 상흔만큼 체력을 잃고 1 감소', () => {
  const s = mk(['seungnyeo', 'posu', 'chasa'], 'e2');
  const e = s.enemies[0];
  e.intent = -1;
  const hp0 = e.hp;
  play(s, 'posu.olmu', { enemy: 0 }); // 상흔 4, 점지 1
  assert.equal(e.bleed, 4);
  endPlayerTurn(s);
  enemyTurn(s);
  assert.equal(hp0 - e.hp, 4);
  assert.equal(e.bleed, 3);
});

test('명부: 플레이어 턴 종료 시 명부 ≥ 현재 체력이면 쓰러진다', () => {
  const s = mk(['manshin', 'posu', 'chasa'], 'h1');
  const [a, b] = s.enemies;
  a.hp = 10;
  a.doom = 10;
  b.hp = 10;
  b.doom = 9;
  endPlayerTurn(s);
  assert.equal(a.alive, false, '명부 10 ≥ 체력 10');
  assert.equal(b.alive, true, '명부 9 < 체력 10');
  assert.equal(s.stats!.executions, 1);
});

test('넋흔들림 → 붕괴: 다음 행동 취소, 받는 피해 +50%, 0으로, 버팀 ×1.5', () => {
  const s = mk(['seungnyeo', 'posu', 'chasa'], 'e2');
  const e = s.enemies[0];
  e.hp = e.maxHp = 40;
  e.endure = endureOf(40);
  assert.equal(e.endure, 14, '버팀 = clamp(round(체력×0.35), 6, 40)');
  assert.equal(endureOf(10), 6);
  assert.equal(endureOf(220), 40);
  e.shake = 12;
  play(s, 'seungnyeo.yukhwanjang', { enemy: 0 }); // 피해 5, 넋흔들림 2
  assert.equal(e.cancelNext, true);
  assert.equal(e.shake, 0);
  assert.equal(e.endure, 21);
  assert.ok(collapsed(s, e));
  const hpBefore = e.hp;
  play(s, 'seungnyeo.yukhwanjang', { enemy: 0 });
  assert.equal(hpBefore - e.hp, Math.floor(5 * 1.5), '붕괴 중 피해 ×1.5');
  // 의도 취소: 적 턴에 아무도 맞지 않는다
  const hps = s.heroes.map((h) => h.hp);
  endPlayerTurn(s);
  enemyTurn(s);
  assert.deepEqual(s.heroes.map((h) => h.hp), hps);
  startPlayerTurn(s);
  assert.ok(collapsed(s, e), '다음 플레이어 턴까지 +50%');
  endPlayerTurn(s);
  enemyTurn(s);
  startPlayerTurn(s);
  assert.ok(!collapsed(s, e));
});

test('쓰러짐 → 카드가 넋 부르기로 → N장 쓰면 25%로 기상, 다시 쓰러지면 N+1', () => {
  const d = D();
  const s = mk(['posu', 'seungnyeo', 'chasa'], 'e2');
  s.energy = 9;
  const posu = heroIdx(s, 'posu');
  const posuCards = d.starters.get('posu')!.map((c) => ({ d: c.idx, o: posu, o2: -1, orig: -1, x: -1 }));
  s.hand = posuCards.slice();
  s.draw = [posuCards[0]];
  s.discard = [posuCards[1]];
  downHero(s, posu);
  const h = s.heroes[posu];
  assert.ok(h.downed);
  assert.equal(h.rescueNeed, 3);
  for (const pile of [s.draw, s.hand, s.discard]) for (const c of pile) assert.equal(c.d, d.special.rescue);
  const playRescue = () => {
    const i = s.hand.findIndex((c) => c.d === d.special.rescue);
    playCard(s, { hand: i, enemy: -1, enemy2: -1, ally: -1, pair: null });
  };
  playRescue();
  playRescue();
  assert.ok(h.downed, '2장으로는 아직');
  playRescue();
  assert.ok(!h.downed);
  assert.equal(h.hp, Math.round(28 * 0.25));
  assert.ok(h.recovering, '회복 중 디버프');
  for (const pile of [s.draw, s.hand, s.discard]) for (const c of pile) assert.notEqual(c.d, d.special.rescue, '남은 구조 카드는 원래 카드로');
  assert.equal(s.hand.length, 1);
  assert.equal(s.hand[0].d, posuCards[3].d);
  downHero(s, posu);
  assert.equal(h.rescueNeed, 4, '같은 전투에서 다시 쓰러지면 +1');
});

test('사망 판정: 65%에서 버틸 때마다 −10%, 최저 25% / 사망하면 곡 카드', () => {
  assert.equal(deathSaveChance(0), 0.65);
  assert.ok(Math.abs(deathSaveChance(1) - 0.55) < 1e-9);
  assert.ok(Math.abs(deathSaveChance(3) - 0.35) < 1e-9);
  assert.equal(deathSaveChance(4), 0.25);
  assert.equal(deathSaveChance(9), 0.25);
  const d = D();
  const s = mk(['posu', 'seungnyeo', 'chasa'], 'e2', 7);
  const posu = heroIdx(s, 'posu');
  s.hand = d.starters.get('posu')!.map((c) => ({ d: c.idx, o: posu, o2: -1, orig: -1, x: -1 }));
  downHero(s, posu);
  const h = s.heroes[posu];
  let hits = 0;
  while (!h.dead && hits < 50) {
    hitHero(s, posu, 5, 0);
    hits++;
    if (!h.dead) assert.equal(h.survived, hits);
  }
  assert.ok(h.dead);
  assert.ok(!s.formation.includes(posu));
  for (const c of s.hand) assert.equal(c.d, d.special.mourn);
  // 방어도로 다 막으면 판정하지 않는다
  const s2 = mk(['posu', 'seungnyeo', 'chasa'], 'e2', 3);
  const p2 = heroIdx(s2, 'posu');
  downHero(s2, p2);
  s2.heroes[p2].block = 10;
  hitHero(s2, p2, 5, 0);
  assert.equal(s2.heroes[p2].survived, 0);
  assert.ok(!s2.heroes[p2].dead);
});

test('엄호: 지정한 아군이 받을 공격을 대신 받는다', () => {
  const s = mk(['seungnyeo', 'posu', 'chasa'], 'e2');
  const seung = heroIdx(s, 'seungnyeo');
  const posu = heroIdx(s, 'posu');
  play(s, 'seungnyeo.gasa', { ally: posu });
  assert.equal(s.heroes[seung].cover, posu);
  const hp0 = s.heroes[posu].hp;
  hitHero(s, posu, 7, 0);
  assert.equal(s.heroes[posu].hp, hp0);
  assert.equal(s.heroes[seung].hp, 45 - 7);
});

test('홀림: 그 영웅의 카드는 효과가 없지만 비용은 들고, 낼 때마다 1 감소', () => {
  const s = mk(['posu', 'seungnyeo', 'chasa'], 'x1');
  const posu = heroIdx(s, 'posu');
  s.heroes[posu].possess = 2;
  const e = s.enemies[0];
  play(s, 'posu.jojun', { enemy: 0 });
  assert.equal(s.energy, 2);
  assert.equal(e.mark, 0, '효과 없음');
  assert.equal(s.heroes[posu].personal, 0);
  assert.equal(s.heroes[posu].possess, 1);
  assert.equal(e.block, 3, '장부 대조: 홀린 영웅이 카드를 낼 때마다 아전 방어도 3');
  play(s, 'posu.jojun', { enemy: 0 });
  play(s, 'posu.jojun', { enemy: 0 });
  assert.equal(s.heroes[posu].possess, 0);
  assert.equal(e.mark, 2, '풀린 뒤에는 효과가 난다');
});

test('씌임: 귀기 50·100에서 주인 영웅의 씌임 카드, 100에서 붕괴/각성 판정', () => {
  const d = D();
  const s = mk(['posu', 'seungnyeo', 'chasa'], 'h4');
  const g = s.enemies.findIndex((e) => d.enemies[e.def].id === 'goksori_neok');
  for (let i = 0; i < s.enemies.length; i++) if (i !== g) s.enemies[i].intent = -1;
  s.enemies[g].intent = 0; // 곡소리: 파티 귀기 +4
  for (const h of s.heroes) h.stress = 48;
  endPlayerTurn(s);
  enemyTurn(s);
  const curses = s.draw.filter((c) => d.special.curses.includes(c.d));
  assert.equal(curses.length, 3, '영웅마다 1장');
  assert.deepEqual(curses.map((c) => c.o).sort(), [0, 1, 2]);
});

test('해원 판정 (물에 젖은 넋·곡소리 넋·허기진 넋·잡귀·길 잃은 객귀)', () => {
  const d = D();
  // 물에 젖은 넋: 넋흔들림 2 이상
  let s = mk(['seungnyeo', 'posu', 'chasa'], 'e1');
  s.enemies[0].shake = 2;
  s.enemies[0].hp = 1;
  killEnemy(s, 0);
  assert.equal(s.enemies[0].haewon, true);
  s.enemies[1].shake = 1;
  killEnemy(s, 1);
  assert.equal(s.enemies[1].haewon, false);
  // 곡소리 넋: 명부 5 이상 (명부 처형도 해원)
  s = mk(['manshin', 'posu', 'chasa'], 'h4');
  const g = s.enemies.findIndex((e) => d.enemies[e.def].id === 'goksori_neok');
  s.enemies[g].hp = 5;
  s.enemies[g].doom = 5;
  endPlayerTurn(s);
  assert.equal(s.enemies[g].alive, false);
  assert.equal(s.enemies[g].haewon, true);
  // 허기진 넋: 굿상에 설치물이 있을 때
  s = mk(['manshin', 'posu', 'chasa'], 'h4');
  const hz = s.enemies.findIndex((e) => d.enemies[e.def].id === 'heogijin_neok');
  play(s, 'manshin.cheongbae');
  s.enemies[hz].hp = 3;
  play(s, 'posu.hwaseungchong', { enemy: hz });
  assert.equal(s.enemies[hz].haewon, true);
  // 잡귀: 부적(토큰)으로 마지막 피해
  s = mk(['beopsa', 'posu', 'chasa'], 'e3');
  s.enemies[0].hp = 3;
  play(s, 'beopsa.t_hwabu', { enemy: 0 });
  assert.equal(s.enemies[0].haewon, true);
  s.enemies[1].hp = 3;
  play(s, 'posu.hwaseungchong', { enemy: 1 });
  assert.equal(s.enemies[1].haewon, false);
  // 길 잃은 객귀: 그 턴에 진형이 바뀐 상태
  s = mk(['seungnyeo', 'posu', 'chasa'], 'e2');
  s.enemies[0].hp = 3;
  play(s, 'chasa.ora_jiugi', { enemy: 0 }); // 피해 → 쓰러짐 (돌격은 그 뒤)
  assert.equal(s.enemies[0].haewon, false);
  s = mk(['seungnyeo', 'posu', 'chasa'], 'e2');
  s.enemies[0].hp = 3;
  play(s, 'posu.eompye'); // 후퇴 (이미 후열 → 변화 없음)
  play(s, 'seungnyeo.jari_bakkwo', { pair: [s.formation[0], s.formation[1]] });
  assert.ok(s.formChanges > 0);
  play(s, 'posu.hwaseungchong', { enemy: 0 });
  assert.equal(s.enemies[0].haewon, true);
});

test('해원 판정 (보스): 노잣돈을 바친 뒤 뱃사공 / 상여꾼 2명 이상 살아 있을 때 상여', () => {
  const d = D();
  let s = mk(['seungnyeo', 'posu', 'chasa'], 'b1');
  play(s, 'common.offering_nojatdon');
  assert.equal(s.offeringPaid, true);
  assert.equal(s.jijeon, 0);
  s.enemies[0].hp = 1;
  play(s, 'posu.hwaseungchong', { enemy: 0 });
  assert.equal(s.enemies[0].haewon, true);
  s = mk(['seungnyeo', 'posu', 'chasa'], 'b2');
  const sy = s.enemies.findIndex((e) => d.enemies[e.def].id === 'sangyeo');
  killEnemy(s, 0);
  killEnemy(s, 1);
  killEnemy(s, sy);
  assert.equal(s.enemies[sy].haewon, true, '상여꾼 2명 생존');
  s = mk(['seungnyeo', 'posu', 'chasa'], 'b2');
  killEnemy(s, 0);
  killEnemy(s, 1);
  killEnemy(s, 2);
  killEnemy(s, sy);
  assert.equal(s.enemies[sy].haewon, false, '상여꾼 1명');
});
