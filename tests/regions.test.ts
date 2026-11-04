// 지역 2·3 엔진 메커닉 (Phase 9 반복 2): 신열·옮김, 공물 일반화, 손님 배웅 대접, 빗장, 업경대, 고풀이.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createCombat, D, dealDamage, downHero, endPlayerTurn, enemyTurn, killEnemy, playCard, reviveHero, startPlayerTurn, standing,
} from '../src/core/engine.ts';
import { executeIntent } from '../src/core/enemy.ts';
import { eopgyeong, knotPresetBits } from '../src/core/regions.ts';
import type { CardInst, CombatState, HeroId } from '../src/core/types.ts';
import { give, heroIdx, mk, play } from './helpers.ts';

function mkWith(party: HeroId[], enc: string, extra: Parameters<typeof createCombat>[0] extends infer S ? Partial<S> : never = {}): CombatState {
  const d = D();
  const s = createCombat({ party: party.map((id) => ({ id })), deck: [], encounter: d.encounterById.get(enc)!, seed: 7, record: true, ...extra });
  s.draw = [];
  s.discard = [];
  s.energy = 3;
  return s;
}

function setIntent(s: CombatState, ei: number, id: string): void {
  const e = s.enemies[ei];
  e.intent = D().enemies[e.def].intents.findIndex((x) => x.id === id);
  e.cancelNext = false;
}

function inHand(s: CombatState, cardId: string): number {
  const idx = D().cardById.get(cardId)!.idx;
  return s.hand.findIndex((c) => c.d === idx);
}

test('세 지역 데이터: 1지역 번호·조합은 그대로, 2·3지역 원귀·조합·특수 전투를 읽는다', () => {
  const d = D();
  assert.equal(d.encounters.length, 15);
  assert.equal(d.enemies[0].id, 'jeojeun_neok');
  assert.ok(d.enemies.findIndex((e) => e.region === 2) > d.enemies.findIndex((e) => e.id === 'sangyeokkun'));
  assert.equal(d.regionEncounters[2].length, 15);
  assert.equal(d.regionEncounters[3].filter((e) => e.tier === 'final').length, 1);
  assert.ok(d.specials.has('sonnim_baeung'));
  const capN = (id: string) => Number(d.enemyById.get(id)!.passives.find((p) => p.includes('빗장'))!.match(/빗장\s*(\d+)/)![1]);
  assert.deepEqual(d.enemyById.get('bitjang_neok')!.cap, { n: capN('bitjang_neok'), firstPhase: false, whileAlive: null });
  assert.deepEqual(d.enemyById.get('honbaek_wongwi')!.cap, { n: capN('honbaek_wongwi'), firstPhase: true, whileAlive: 'tteodoneun_baek' });
  assert.deepEqual(d.enemyById.get('bitjang_janggun')!.cap, { n: capN('bitjang_janggun'), firstPhase: true, whileAlive: 'sumun_gunjol' });
  assert.equal(d.enemyById.get('heoju')!.offering!.effect, 'phase2');
  assert.deepEqual(d.enemyById.get('maenap_neok')!.offering!.pay, [{ item: 'rice', n: 3 }]);
  assert.equal(d.enemyById.get('heoju')!.haewon.kind, 'offering');
  assert.equal(d.enemyById.get('bitjang_janggun')!.haewon.kind, 'knots');
  assert.equal(d.enemyById.get('bitjang_janggun')!.haewon.need, 4);
  assert.equal(d.enemyById.get('sumun_gunjol')!.follows, 'bitjang_janggun');
  assert.equal(d.enemyById.get('honbaek_wongwi')!.haewon.kind, 'minions');
});

test('신열: 열 옮기기 → 선두 영웅이 주인. 손에 든 채 턴을 마치면 약화 1, 바로 뒤 칸 영웅에게 옮는다', () => {
  const d = D();
  const s = mkWith(['seungnyeo', 'posu', 'manshin'], 'r2e1');
  const front = s.formation[0];
  setIntent(s, 0, 'b');
  executeIntent(s, 0);
  const sy = s.draw.find((c) => c.d === d.special.sinyeol)!;
  assert.ok(sy, '신열 1장이 뽑을 더미에');
  assert.equal(sy.o, front);
  // 손으로 옮겨 턴을 마친다
  s.draw = s.draw.filter((c) => c !== sy);
  s.hand.push(sy);
  s.heroes[front].weak = 0;
  endPlayerTurn(s);
  assert.equal(s.heroes[front].weak, 1, '약화는 감소 뒤에 건다');
  const moved = s.discard.find((c) => c.d === d.special.sinyeol)!;
  assert.equal(moved.o, s.formation[1], '바로 뒤 칸 영웅에게 옮는다');
  assert.equal(s.stats!.sinyeolMoved, 1);
  // 후열의 신열은 바로 앞 칸으로
  const back = s.formation[2];
  const s2 = mkWith(['seungnyeo', 'posu', 'manshin'], 'r2e1');
  s2.hand.push({ d: d.special.sinyeol, o: back, o2: -1, orig: -1, x: -1 });
  endPlayerTurn(s2);
  assert.equal(s2.discard.find((c) => c.d === d.special.sinyeol)!.o, s2.formation[1]);
});

test('신열: 에너지 1로 내면 소멸. 주인이 홀려 있으면 효과 없이 버린 더미로 간다', () => {
  const d = D();
  const s = mkWith(['seungnyeo', 'posu', 'manshin'], 'r2e1');
  const o = heroIdx(s, 'posu');
  s.hand.push({ d: d.special.sinyeol, o, o2: -1, orig: -1, x: -1 });
  playCard(s, { hand: 0, enemy: -1, enemy2: -1, ally: -1, pair: null });
  assert.equal(s.energy, 2);
  assert.ok(s.exhaust.some((c) => c.d === d.special.sinyeol));
  s.heroes[o].possess = 1;
  s.hand.push({ d: d.special.sinyeol, o, o2: -1, orig: -1, x: -1 });
  playCard(s, { hand: 0, enemy: -1, enemy2: -1, ally: -1, pair: null });
  assert.equal(s.heroes[o].possess, 0);
  assert.ok(s.discard.some((c) => c.d === d.special.sinyeol), '홀린 주인의 신열은 버린 더미로');
  // 손님의 배웅: 턴당 1회 비용 0
  const s3 = mkWith(['seungnyeo', 'posu', 'manshin'], 'r2e1', { mods: { sinyeolFree: true } });
  s3.hand.push({ d: d.special.sinyeol, o, o2: -1, orig: -1, x: -1 }, { d: d.special.sinyeol, o, o2: -1, orig: -1, x: -1 });
  playCard(s3, { hand: 0, enemy: -1, enemy2: -1, ally: -1, pair: null });
  playCard(s3, { hand: 0, enemy: -1, enemy2: -1, ally: -1, pair: null });
  assert.equal(s3.energy, 2, '두 번째는 에너지 1');
});

test('신열: 전체 대상이면 진형 앞에서부터 돌아가며 주인, 대문 부적이 처음 1장을 막는다', () => {
  const d = D();
  const s = mkWith(['seungnyeo', 'posu', 'manshin'], 'r2b1');
  setIntent(s, 0, 'b');
  executeIntent(s, 0);
  const owners = s.draw.filter((c) => c.d === d.special.sinyeol).map((c) => c.o).sort();
  assert.deepEqual(owners, [s.formation[0], s.formation[1]].sort());
  const s2 = mkWith(['seungnyeo', 'posu', 'manshin'], 'r2b1', { mods: { blockPollute: 1 } });
  setIntent(s2, 0, 'b');
  executeIntent(s2, 0);
  assert.equal(s2.draw.filter((c) => c.d === d.special.sinyeol).length, 1);
});

test('공물 일반화: 허주 벗기기(부적 2) → 해원 조건 성립 + 곧바로 2단계. 보급품이 모자라면 낼 수 없다', () => {
  const s0 = mkWith(['seungnyeo', 'posu', 'manshin'], 'r2b2', { provisions: { bujeok: 1 } });
  const i0 = inHand(s0, 'common.offering_heoju');
  assert.ok(i0 >= 0);
  assert.throws(() => playCard(s0, { hand: i0, enemy: -1, enemy2: -1, ally: -1, pair: null }));
  const s = mkWith(['seungnyeo', 'posu', 'manshin'], 'r2b2', { provisions: { bujeok: 2 } });
  const heoju = s.enemies.findIndex((e) => D().enemies[e.def].id === 'heoju');
  assert.equal(s.enemies[heoju].phase, 0);
  playCard(s, { hand: inHand(s, 'common.offering_heoju'), enemy: -1, enemy2: -1, ally: -1, pair: null });
  assert.equal(s.prov.bujeok, 0);
  assert.ok(s.offeringPaid);
  assert.equal(s.enemies[heoju].phase, 1);
  assert.ok(['d', 'e', 'f'].includes(D().enemies[s.enemies[heoju].def].intents[s.enemies[heoju].intent].id), '2단계 의도');
  killEnemy(s, heoju);
  assert.ok(s.enemies[heoju].haewon);
});

test('공물 일반화: 사자밥 차리기(쌀 3) → 뒤에 선 넋들이 이번 적 차례에 행동하지 않는다', () => {
  const s = mkWith(['seungnyeo', 'posu', 'manshin'], 'r3b2', { provisions: { rice: 3 } });
  playCard(s, { hand: inHand(s, 'common.offering_sajabap'), enemy: -1, enemy2: -1, ally: -1, pair: null });
  assert.equal(s.prov.rice, 0);
  for (const e of s.enemies) if (D().enemies[e.def].category === 'minion') assert.ok(e.cancelNext);
  const boss = s.enemies.findIndex((e) => D().enemies[e.def].id === 'maenap_neok');
  killEnemy(s, boss);
  assert.ok(s.enemies[boss].haewon);
  assert.ok(s.enemies.every((e) => !e.alive), '뒤에 선 넋들이 우두머리를 따라 물러간다');
  assert.equal(s.outcome, 1);
});

function sonnim(start = 0, prov = { sul: 2, rice: 2 }): CombatState {
  const d = D();
  const sp = d.specials.get('sonnim_baeung')!;
  const s = createCombat({
    party: (['seungnyeo', 'posu', 'manshin'] as HeroId[]).map((id) => ({ id })), deck: [], seed: 3, record: true,
    encounter: { id: 'sonnim', tier: 'elite', enemies: sp.followers }, entertain: { goal: sp.goal, limit: sp.limit, start }, provisions: prov,
  });
  s.draw = [];
  s.discard = [];
  s.energy = 3;
  return s;
}

test('손님 배웅: 손님상 차리기 +3(턴당 1회, 손에 남는다), 턴 종료 장단 3+ 은 +1, 수비가 쓰러지면 +1', () => {
  const s = sonnim();
  const i = inHand(s, 'common.offering_sonnimsang');
  playCard(s, { hand: i, enemy: -1, enemy2: -1, ally: -1, pair: null });
  assert.equal(s.entertain!.value, 3);
  assert.equal(s.prov.sul, 1);
  assert.ok(inHand(s, 'common.offering_sonnimsang') >= 0, '손에 남는다');
  assert.throws(() => playCard(s, { hand: inHand(s, 'common.offering_sonnimsang'), enemy: -1, enemy2: -1, ally: -1, pair: null }), '턴당 1회');
  s.jangdan = 3;
  endPlayerTurn(s);
  assert.equal(s.entertain!.value, 4);
  killEnemy(s, 0);
  assert.equal(s.entertain!.value, 5);
  assert.equal(s.outcome, 0, '수비가 다 쓰러져도 대접이 차기 전에는 끝나지 않는다');
  killEnemy(s, 1);
  assert.equal(s.outcome, 0);
});

test('손님 배웅: 대접 12 → 좋게 배웅(남은 수비 물러감, 해원 1회). 6턴이 지나면 서운한 작별', () => {
  const s = sonnim(10);
  const i = inHand(s, 'common.offering_sonnimsang');
  playCard(s, { hand: i, enemy: -1, enemy2: -1, ally: -1, pair: null });
  assert.equal(s.entertain!.result, 'sendoff');
  assert.equal(s.outcome, 1);
  assert.ok(s.enemies.every((e) => !e.alive && e.haewon));
  assert.equal(s.stats!.haewons, 1);
  const t = sonnim(0, { sul: 0, rice: 0 });
  for (let k = 0; k < 6 && t.outcome === 0; k++) {
    for (const h of t.heroes) h.hp = h.maxHp;
    endPlayerTurn(t);
    if (t.outcome !== 0) break;
    enemyTurn(t);
    startPlayerTurn(t);
  }
  assert.equal(t.entertain!.result, 'timeout');
});

test('손님의 차례: 대접이 (지난 턴 수 × 2)보다 적으면 선두 영웅 덱에 신열, 아니면 파티 귀기 −2', () => {
  const d = D();
  const s = sonnim(0);
  for (const e of s.enemies) e.cancelNext = true;
  endPlayerTurn(s);
  enemyTurn(s);
  assert.ok(s.draw.some((c) => c.d === d.special.sinyeol && c.o === s.formation[0]));
  const t = sonnim(6);
  for (const e of t.enemies) e.cancelNext = true;
  for (const h of t.heroes) h.stress = 10;
  endPlayerTurn(t);
  enemyTurn(t);
  assert.ok(t.heroes.every((h) => h.stress === 8));
});

test('빗장 N: 한 플레이어 턴 피해 상한. 상흔·명부·붕괴는 넘는다. 적 턴에 0으로 돌아간다', () => {
  const s = mk(['seungnyeo', 'posu', 'manshin'], 'r3h3');
  const bi = s.enemies.findIndex((e) => D().enemies[e.def].id === 'bitjang_neok');
  const e = s.enemies[bi];
  const cap = D().enemies[e.def].cap!.n;
  const hp0 = e.hp;
  for (let k = 0; k < 4; k++) {
    s.energy = 3;
    play(s, 'posu.hwaseungchong', { enemy: bi });
  }
  assert.equal(hp0 - e.hp, cap, '네 발을 쏴도 상한까지');
  // 상흔은 상한 밖 (적 턴 시작)
  e.bleed = 5;
  e.block = 0;
  for (const x of s.enemies) x.cancelNext = true;
  endPlayerTurn(s);
  enemyTurn(s);
  assert.equal(e.capLost, 0);
  assert.equal(hp0 - e.hp, cap + 5, '상흔 5는 그대로 들어간다');
  // 붕괴 중이면 상한이 풀린다
  startPlayerTurn(s);
  e.collapseUntil = s.turn + 1;
  const before = e.hp;
  for (let k = 0; k < 3; k++) {
    s.energy = 3;
    play(s, 'posu.hwaseungchong', { enemy: bi });
  }
  assert.ok(before - e.hp > cap, '붕괴 중 피해는 상한 밖');
  // 명부 판정은 체력과 관계없이
  const s2 = mk(['seungnyeo', 'posu', 'manshin'], 'r3h3');
  const e2 = s2.enemies[s2.enemies.findIndex((x) => D().enemies[x.def].id === 'bitjang_neok')];
  e2.doom = e2.hp;
  endPlayerTurn(s2);
  assert.ok(!e2.alive && e2.haewon, '명부 6 이상 → 해원');
});

test('빗장(혼백): 1단계에서 떠도는 백이 서 있는 동안만. 나화 한 송이는 이번 턴 빗장을 푼다', () => {
  const d = D();
  const s = mk(['seungnyeo', 'posu', 'manshin'], 'r3b1');
  const hi = s.enemies.findIndex((e) => d.enemies[e.def].id === 'honbaek_wongwi');
  const bi = s.enemies.findIndex((e) => d.enemies[e.def].id === 'tteodoneun_baek');
  const ctx = { owner: 0, isToken: false, summonCtx: true } as unknown as Parameters<typeof dealDamage>[1];
  const h0 = s.enemies[hi].hp;
  dealDamage(s, ctx, hi, 40);
  assert.equal(h0 - s.enemies[hi].hp, d.enemyById.get('honbaek_wongwi')!.cap!.n);
  killEnemy(s, bi);
  const h1 = s.enemies[hi].hp;
  dealDamage(s, ctx, hi, 30);
  assert.equal(h1 - s.enemies[hi].hp, 30, '백이 쓰러지면 빗장이 풀린다');
  // 나화: 꽃 던지기
  const t = mk(['seungnyeo', 'posu', 'manshin'], 'r3h3');
  const ti = t.enemies.findIndex((e) => d.enemies[e.def].id === 'bitjang_neok');
  t.enemies[ti].block = 9;
  t.hand.push({ d: d.special.kkot, o: -1, o2: -1, orig: -1, x: -1 });
  playCard(t, { hand: t.hand.length - 1, enemy: ti, enemy2: -1, ally: -1, pair: null });
  assert.equal(t.enemies[ti].block, 0);
  const t0 = t.enemies[ti].hp;
  dealDamage(t, ctx, ti, 30);
  assert.equal(t0 - t.enemies[ti].hp, 30);
});

test('고풀이: 매듭(상태·턴 종료 장단/굿상/진형·부적 피해)을 넷 풀고 쓰러뜨리면 해원, 수문 군졸도 함께 문을 연다', () => {
  const d = D();
  const s = mk(['beopsa', 'posu', 'chasa'], 'r3f1');
  const ji = s.enemies.findIndex((e) => d.enemies[e.def].id === 'bitjang_janggun');
  const e = s.enemies[ji];
  play(s, 'posu.jojun', { enemy: ji }); // 점지
  assert.equal(e.knots & 1, 1);
  s.energy = 3;
  play(s, 'chasa.ora_jiugi', { enemy: ji }); // 명부
  assert.ok(e.knots & 4);
  // 부적 피해 (방어도에 막혀도 인정)
  e.block = 50;
  give(s, 'beopsa.t_hwabu', 'beopsa');
  playCard(s, { hand: s.hand.length - 1, enemy: ji, enemy2: -1, ally: -1, pair: null });
  assert.ok(e.knots & (1 << 6));
  // 셋으로는 해원이 아니다
  const c = structuredClone(e);
  assert.equal(c.knots.toString(2).split('1').length - 1, 3);
  s.jangdan = 3;
  for (const x of s.enemies) x.cancelNext = true;
  endPlayerTurn(s);
  assert.ok(e.knots & (1 << 4), '장단 3 이상으로 턴을 마침');
  killEnemy(s, ji);
  assert.ok(e.haewon);
  assert.ok(s.enemies.every((x) => !x.alive), '수문 군졸이 따라 물러간다');
  assert.equal(s.stats!.haewons, 3);
  // 매듭 셋이면 처치
  const t = mk(['beopsa', 'posu', 'chasa'], 'r3f1');
  const tj = t.enemies.findIndex((x) => d.enemies[x.def].id === 'bitjang_janggun');
  t.enemies[tj].knots = 0b111;
  killEnemy(t, tj);
  assert.ok(!t.enemies[tj].haewon);
});

test('업경대: 해원 수 구간 → 매듭 미리 풀기, 향은 한 구간 위, 만신은 +2. 파티가 만들지 않는 매듭부터 푼다', () => {
  assert.equal(eopgyeong(3).tier, 0);
  assert.equal(eopgyeong(3).stress, 10);
  assert.equal(eopgyeong(5).knots, 0);
  assert.equal(eopgyeong(10).knots, 1);
  assert.equal(eopgyeong(9, { incense: true }).knots, 1);
  assert.equal(eopgyeong(13, { manshin: true }).knots, 2);
  // 잽이 + 승려 + 탈꾼: 점지(M)·상흔(B)·명부(D)를 만들지 않는다 → 점지부터
  const bits = knotPresetBits(['jaebi', 'seungnyeo', 'talggun'], 2);
  assert.equal(bits, 0b011);
  const s = createCombat({
    party: (['jaebi', 'seungnyeo', 'talggun'] as HeroId[]).map((id) => ({ id })), deck: [], seed: 1, record: true,
    encounter: D().encounterById.get('r3f1')!, knotsPreset: bits,
  });
  const ji = s.enemies.findIndex((e) => D().enemies[e.def].id === 'bitjang_janggun');
  assert.equal(s.enemies[ji].knots, 0b011);
  assert.ok(s.heroes.every((h) => standing(h)));
});

test('무구 각인: 각인된 카드를 내면 그 상태 +1 (생산만), 쓰러졌다 일어나도 각인이 남는다', () => {
  const d = D();
  const s = mk(['seungnyeo', 'posu', 'manshin'], 'h1');
  const o = heroIdx(s, 'seungnyeo');
  const c: CardInst = { d: d.cardById.get('seungnyeo.hapjang')!.idx, o, o2: -1, orig: -1, x: -1, g: 1 };
  s.hand.push(c);
  playCard(s, { hand: s.hand.length - 1, enemy: 0, enemy2: -1, ally: -1, pair: null });
  assert.equal(s.enemies[0].mark, 1, '점지 각인');
  const j: CardInst = { d: d.cardById.get('seungnyeo.hapjang')!.idx, o, o2: -1, orig: -1, x: -1, g: 5 };
  s.energy = 3;
  const jd = s.jangdan;
  s.hand.push(j);
  playCard(s, { hand: s.hand.length - 1, enemy: 0, enemy2: -1, ally: -1, pair: null });
  assert.equal(s.jangdan, jd + 1, '장단 각인');
  // 쓰러짐(넋 부르기) → 기상: 각인이 원래 카드와 함께 돌아온다
  s.draw.push(j);
  downHero(s, o);
  const rescued = s.draw.find((x) => x.d === d.special.rescue && x.o === o)!;
  assert.equal(rescued.g, 5);
  reviveHero(s, o);
  assert.ok(s.draw.some((x) => x.d === j.d && x.g === 5));
});

test('놀이 싸움(사자 검문): 영웅이 받는 피해는 체력 대신 귀기로, 쓰러지지 않는다', () => {
  const s = createCombat({ party: (['seungnyeo', 'posu', 'manshin'] as HeroId[]).map((id) => ({ id })), deck: [], encounter: D().encounterById.get('e3')!, seed: 2, record: true, play: true });
  const f = s.formation[0];
  const hp = s.heroes[f].hp;
  s.heroes[f].block = 0;
  for (let k = 0; k < 20; k++) {
    for (const e of s.enemies) {
      e.intent = 0;
      e.cancelNext = false;
    }
    enemyTurn(s);
  }
  assert.equal(s.heroes[f].hp, hp, '체력은 그대로');
  assert.ok(s.heroes[f].stress > 0, '귀기가 오른다');
  assert.ok(!s.heroes[f].downed);
});

test('호위: 선두에 방어도가 없으면 선두를 노린 공격을 산 사람이 맞고, 쓰러지면 전투가 끝난다(실패 표시)', () => {
  const s = createCombat({ party: (['seungnyeo', 'posu', 'manshin'] as HeroId[]).map((id) => ({ id })), deck: [], encounter: D().encounterById.get('e3')!, seed: 2, record: true, ward: { name: '산 사람', hp: 20 } });
  const f = s.formation[0];
  const hp = s.heroes[f].hp;
  s.heroes[f].block = 0;
  for (const e of s.enemies) e.intent = 0;
  enemyTurn(s);
  assert.equal(s.heroes[f].hp, hp, '방어도가 없으면 선두 대신 산 사람이');
  assert.ok(s.ward!.hp < 20);
  // 방어도가 있으면 선두가 막아선다
  const w = s.ward!.hp;
  startPlayerTurn(s);
  s.heroes[f].block = 30;
  for (const e of s.enemies) if (e.alive) e.intent = 0;
  enemyTurn(s);
  assert.equal(s.ward!.hp, w);
  // 쓰러지면 끝
  s.ward!.hp = 1;
  startPlayerTurn(s);
  s.heroes[f].block = 0;
  for (const e of s.enemies) if (e.alive) e.intent = 0;
  enemyTurn(s);
  assert.ok(s.ward!.lost);
  assert.equal(s.outcome, 1);
});
