// 강화판 (K1, v0.3): 카드 인스턴스의 d 가 강화판 정의(id+)를 가리키면 효과·비용·키워드가 강화판을 따른다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canUpgrade, isUpgraded, upgradeInst } from '../src/core/data.ts';
import { createCombat, D, downHero, endPlayerTurn, playCard, reviveHero } from '../src/core/engine.ts';
import { RAW_JSON } from '../src/core/raw-data.ts';
import type { CardInst, RawCard } from '../src/core/types.ts';
import { heroIdx, inst, mk } from './helpers.ts';

function playInst(s: ReturnType<typeof mk>, c: CardInst, enemy = 0): void {
  s.hand.push(c);
  playCard(s, { hand: s.hand.length - 1, enemy, enemy2: -1, ally: -1, pair: null });
}

test('강화판 정의: 저주·상태·공물 행동을 뺀 카드마다 하나, 보상 풀·시작 덱에는 없다', () => {
  const d = D();
  const base = d.cards.filter((c) => !c.isToken && !c.upgraded);
  const ups = d.cards.filter((c) => c.upgraded);
  const want = base.filter((c) => !c.isCurse && !c.isStatus && c.subtype !== '공물 행동');
  assert.equal(ups.length, want.length);
  assert.equal(ups.length, 280);
  for (const u of ups) {
    const b = d.cards[u.baseIdx];
    assert.equal(b.upIdx, u.idx);
    assert.equal(u.id, `${b.id}+`);
    assert.equal(u.name, `${b.name}+`);
    assert.ok(u.cost <= b.cost && u.cost >= b.cost - 1, `${u.id} 비용은 같거나 1 낮다`);
    assert.ok(u.value >= b.value - 1e-9, `${u.id} 가치가 줄지 않는다`);
    assert.ok(u.effects.length > 0 || b.effects.length === 0);
  }
  for (const [, pool] of d.pools) assert.ok(pool.every((c) => !c.upgraded));
  for (const [, st] of d.starters) assert.ok(st.every((c) => !c.upgraded));
  // 데이터의 upgrade 객체는 {text, cost?, keywords?, effects?}
  for (const f of ['manshin', 'jaebi', 'posu', 'baksu', 'seungnyeo', 'beopsa', 'talggun', 'chasa', 'duo', 'common']) {
    const j = RAW_JSON[`data/cards/${f}.json`] as { cards: RawCard[] };
    for (const c of j.cards) {
      if (!c.upgrade) continue;
      assert.equal(typeof c.upgrade.text, 'string');
      assert.deepEqual(Object.keys(c.upgrade).filter((k) => !['text', 'cost', 'keywords', 'effects'].includes(k)), []);
    }
  }
});

test('upgradeInst: 한 번만 강화된다, 주인·원래 카드 정보는 그대로', () => {
  const s = mk(['posu', 'seungnyeo', 'chasa'], 'e2');
  const c = inst(s, 'posu.jojun');
  assert.equal(isUpgraded(c), false);
  assert.equal(canUpgrade(c), true);
  const u = upgradeInst(c)!;
  assert.ok(u);
  assert.equal(isUpgraded(u), true);
  assert.equal(canUpgrade(u), false);
  assert.equal(upgradeInst(u), null, '강화판은 다시 강화하지 않는다');
  assert.equal(u.o, c.o);
  assert.equal(D().cards[u.d].id, 'posu.jojun+');
  const curse = { d: D().cardById.get('common.curse_wonmang')!.idx, o: 0, o2: -1, orig: -1, x: -1 };
  assert.equal(upgradeInst(curse), null, '저주는 강화하지 않는다');
});

test('강화판 효과: 조준+ 는 점지 3 (기본판 2)', () => {
  const s = mk(['posu', 'seungnyeo', 'chasa'], 'e2');
  s.enemies[0].hp = s.enemies[0].maxHp = 999;
  playInst(s, inst(s, 'posu.jojun'));
  assert.equal(s.enemies[0].mark, 2);
  playInst(s, upgradeInst(inst(s, 'posu.jojun'))!);
  assert.equal(s.enemies[0].mark, 5);
  assert.equal(s.heroes[heroIdx(s, 'posu')].personal, 2, '화약 +1 은 그대로');
  assert.equal(s.stats!.plays.get('posu.jojun+'), 1, '통계는 강화판 id 로 따로 센다');
});

test('강화판 비용: 덧나는 탄환+ 는 0 에너지, 강화판 키워드: 길목 눈썰미+ (비용 0)·추임새+ (받는소리 1장 더)', () => {
  const s = mk(['posu', 'jaebi', 'chasa'], 'e2');
  s.energy = 0;
  const u = upgradeInst(inst(s, 'posu.deonnan'))!;
  assert.equal(D().cards[u.d].cost, 0);
  playInst(s, u, -1);
  assert.equal(s.energy, 0);
  assert.equal(s.powers.length, 1, '능력이 깔린다');
  s.energy = 3;
  // 받는소리가 성립하면 강화판 추임새는 얼쑤 3장
  const before = s.hand.length;
  playInst(s, upgradeInst(inst(s, 'jaebi.chuimsae'))!, -1);
  assert.equal(s.hand.length - before, 3);
});

test('강화판 키워드: 선천은 첫 손에, 보존은 턴을 넘겨 손에 남는다', () => {
  const d = D();
  const party = [{ id: 'jaebi' as const }, { id: 'posu' as const }, { id: 'chasa' as const }];
  const filler = d.cardById.get('chasa.jeoseung_munjigi')!;
  const sig = d.cardById.get('jaebi.sigimsae')!; // 강화판 + 선천
  const deck: CardInst[] = [];
  for (let k = 0; k < 15; k++) deck.push({ d: filler.idx, o: 2, o2: -1, orig: -1, x: -1 });
  deck.push({ d: sig.upIdx, o: 0, o2: -1, orig: -1, x: -1 });
  for (let seed = 1; seed <= 5; seed++) {
    const s = createCombat({ party, deck, encounter: d.encounterById.get('e2')!, seed, record: false });
    assert.ok(s.hand.some((c) => c.d === sig.upIdx), `시드 ${seed}: 선천 강화판이 첫 손에`);
  }
  const s = mk(['posu', 'seungnyeo', 'chasa'], 'e2');
  const g = upgradeInst(inst(s, 'posu.ganeumsoe'))!; // 강화판 + 보존
  assert.ok(D().cards[g.d].retain);
  s.hand.push(g, inst(s, 'posu.ganeumsoe'));
  endPlayerTurn(s);
  assert.ok(s.hand.some((c) => c.d === g.d), '보존 강화판은 손에 남는다');
  assert.ok(!s.hand.some((c) => c.d === D().cardById.get('posu.ganeumsoe')!.idx), '기본판은 버린다');
});

test('쓰러졌다 일어나도 강화판은 강화판으로 돌아온다', () => {
  const s = mk(['posu', 'seungnyeo', 'chasa'], 'e2');
  const pi = heroIdx(s, 'posu');
  const u = upgradeInst(inst(s, 'posu.jojun'))!;
  s.draw.push(u);
  downHero(s, pi);
  assert.equal(s.draw[0].d, D().special.rescue);
  assert.equal(s.draw[0].orig, u.d);
  reviveHero(s, pi);
  assert.equal(s.draw[0].d, u.d);
});
