// ⟨반복 3⟩ 3지역 대문 방 통행 (05-region3 §1): 척추 위 대문 방 4곳 · 지전 1 · 문답 · 문지기 전투 — 플레이어블(web) 원정 로직.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blankApp } from '../web/src/game/actions.ts';
import { chooseDialog, dialogOptions } from '../web/src/game/encounters.ts';
import { newRun } from '../web/src/game/run.ts';
import { shortestPath } from '../web/src/game/dungeon.ts';
import type { Run } from '../web/src/game/types.ts';

const SUP = { candle: 6, rice: 6, incense: 2, jijeon: 3, bujeok: 1, sul: 2 };

function r3(seed: number, commission: 'boss' | 'normal' = 'boss', party = ['posu', 'manshin', 'seungnyeo'] as const): Run {
  return newRun({ seed, commission, party: [...party], formation: [2, 1, 0], supplies: { ...SUP }, gold: 0, spent: 0, region: 3 });
}

test('대문 방: 3지역 던전의 척추(입구 → 보스 굴 앞) 위에 4곳, 처음부터 보이고, 1·2지역에는 없다', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const run = r3(seed, seed % 2 ? 'boss' : 'normal');
    const gates = run.dungeon.rooms.filter((r) => r.gate);
    assert.ok(gates.length >= 2 && gates.length <= 4, `seed ${seed}: 대문 ${gates.length}`);
    for (const g of gates) {
      assert.ok(g.known);
      assert.deepEqual(g.content, { k: 'event', id: 'daemun_tonghaeng' });
      assert.ok(!g.camp, '대문 방은 길굿 터가 아니다');
    }
    if (run.dungeon.ferry >= 0) {
      const path = shortestPath(run.dungeon, run.pos, (p) => p.kind === 'room' && p.room === run.dungeon.ferry)!;
      const onPath = path.filter((p) => p.kind === 'room' && run.dungeon.rooms[p.room].gate).length;
      assert.ok(onPath >= 1, `seed ${seed}: 보스 굴 앞까지 가는 길에 대문이 없다`);
    }
  }
  for (const region of [1, 2]) {
    const run = newRun({ seed: 7, commission: 'boss', party: ['posu', 'manshin', 'seungnyeo'], formation: [2, 1, 0], supplies: { ...SUP }, gold: 0, spent: 0, region });
    assert.equal(run.dungeon.rooms.filter((r) => r.gate).length, 0);
  }
});

test('대문 통행: 지전 1(문신 −1 · 통행패 무료) · 문답(귀기 +8) · 차사 · 문지기 전투', () => {
  const app = blankApp();
  app.run = r3(3);
  const run = app.run;
  const dlg = { kind: 'event' as const, id: 'daemun_tonghaeng', result: null, then: 'none' as const };
  let opts = dialogOptions(run, dlg);
  assert.equal(opts[0].cost, '지전 1');
  assert.ok(!opts.find((o) => o.id === 'c2')!.enabled, '차사가 없으면 적패지로 답할 수 없다');
  app.dialog = { ...dlg };
  chooseDialog(app, 'c0');
  assert.equal(run.supplies.jijeon, SUP.jijeon - 1);
  assert.equal(run.flags.gates, 1);
  // 문신의 가호: 지전 −1 → 무료
  run.relics.push('munsin');
  opts = dialogOptions(run, dlg);
  assert.equal(opts[0].cost, undefined);
  // 문답: 귀기 +8
  const s0 = run.heroes.map((h) => h.stress);
  app.dialog = { ...dlg };
  chooseDialog(app, 'c1');
  assert.ok(run.heroes.every((h, i) => h.stress > s0[i]));
  // 문지기와 겨룬다 → 전투
  app.dialog = { ...dlg };
  chooseDialog(app, 'c3');
  assert.equal(app.dialog?.then, 'battle');
  assert.equal(app.dialog?.battleEnc, 'ev_munjigi');
  assert.equal(run.flags.gates, 3);
});
