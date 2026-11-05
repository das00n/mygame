// 카드 삽화 스케치(10단계): 모든 카드·부적에 브리프와 스케치가 있고, 그림은 결정적이며 서로 다르다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { artRow, artSpec, sketchSvg } from '../web/src/art/sketch.ts';

const SETS = ['manshin', 'jaebi', 'posu', 'baksu', 'seungnyeo', 'beopsa', 'talggun', 'chasa', 'duo', 'common'];

function allIds(): string[] {
  const ids: string[] = [];
  for (const set of SETS) {
    const j = JSON.parse(readFileSync(`data/cards/${set}.json`, 'utf8')) as { cards: { id: string }[]; tokens?: { id: string }[] };
    for (const c of j.cards) ids.push(c.id);
    for (const t of j.tokens ?? []) ids.push(t.id);
  }
  return ids;
}

test('모든 카드·부적 id 에 삽화 행과 브리프가 있다', () => {
  const ids = allIds();
  const briefs = JSON.parse(readFileSync('data/art/cards.json', 'utf8')) as { cards: { id: string; subject: string; action: string }[] };
  const byId = new Map(briefs.cards.map((b) => [b.id, b]));
  for (const id of ids) {
    assert.ok(artRow(id), `${id}: 스케치 표에 없다`);
    const b = byId.get(id);
    assert.ok(b && b.subject && b.action, `${id}: 브리프가 없다`);
  }
  assert.equal(briefs.cards.length, ids.length);
});

test('스케치는 결정적이고, 강화판은 기본판 그림을 쓴다', () => {
  assert.equal(sketchSvg('posu.jojun'), sketchSvg('posu.jojun'));
  assert.equal(sketchSvg('posu.jojun+'), sketchSvg('posu.jojun'));
  assert.equal(artSpec('chasa.ora_jiugi').heroes[0], 'chasa');
  assert.deepEqual(artSpec('duo.gongsu_hanbal').heroes, ['manshin', 'posu']);
});

test('스케치는 잘 짜인 SVG 이고 카드마다 다르다', () => {
  const seen = new Map<string, string>();
  for (const id of allIds()) {
    for (const lod of [0, 1] as const) {
      const s = sketchSvg(id, lod);
      assert.ok(!/NaN|undefined|Infinity/.test(s), `${id}: 좌표 오류`);
      assert.equal((s.match(/<g[\s>]/g) ?? []).length, (s.match(/<\/g>/g) ?? []).length, `${id}: <g> 짝`);
      assert.ok(!/ id=/.test(s), `${id}: id 속성은 쓰지 않는다(여러 장이 한 화면에 겹친다)`);
      assert.ok(s.length < 60_000, `${id}: 너무 크다 (${s.length})`);
      if (lod === 1) {
        assert.ok(!seen.has(s), `${id}: ${seen.get(s)} 와 그림이 같다`);
        seen.set(s, id);
      }
    }
  }
});
