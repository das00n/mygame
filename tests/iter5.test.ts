// ⟨반복 5⟩ 배경 보강의 큰 항목 (docs/09-iteration.md §7): 아홉 단계 길닦기 · 문전상 · 삼천 군병 상 · 새 가호 넷 ·
// 원형 고유 선택지(차사 출신 인연 · 법사 안택 · 승려 회심곡 · 잽이 질침 장단 · 탈꾼 문지기 흉내) · 측신 · 황우양 집짓기 · 영개울림 대사.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createCombat, D, haewonSatisfied, killEnemy, loseHp } from '../src/core/engine.ts';
import { eopgyeong, ROAD_FULL, ROAD_STEPS, roadStep } from '../src/core/regions.ts';
import { bondOf, build, makePerson, newCampaign, originBondLines, recruit } from '../src/meta/campaign.ts';
import { CD, deathRules } from '../src/meta/content.ts';
import { runExpedition } from '../src/sim/expedition.ts';
import { typicalParty } from '../src/sim/typical.ts';
import { blankApp } from '../web/src/game/actions.ts';
import { campActions, doCampAction, startCamp } from '../web/src/game/camp.ts';
import { relicMods } from '../web/src/game/combat.ts';
import { REGION_JSON } from '../web/src/game/content.ts';
import { chooseDialog, dialogOptions } from '../web/src/game/encounters.ts';
import { applyRelicGain, rollRelics } from '../web/src/game/rewards.ts';
import { buildResult, JOWANG_JUNGBAL_STRESS, newRun } from '../web/src/game/run.ts';
import type { Run } from '../web/src/game/types.ts';
import type { HeroId } from '../src/core/types.ts';

const SUP = { candle: 6, rice: 6, incense: 2, jijeon: 3, bujeok: 1, sul: 2 };

function r3(party: readonly HeroId[] = ['posu', 'manshin', 'seungnyeo'], final = false): Run {
  return newRun({
    seed: 3, commission: 'boss', party: [...party], formation: [2, 1, 0], supplies: { ...SUP }, gold: 0, spent: 0, region: 3,
    ...(final ? { campaign: { length: 'final' as const, uids: ['a', 'b', 'c'], enemyHpMult: 1 } } : {}),
  });
}

test('길닦기: 아홉 칸에서 멈추고, 다 차면 업경대 한 단계 위 (구간 3이 상한)', () => {
  assert.equal(ROAD_FULL, 9);
  assert.deepEqual([...ROAD_STEPS].slice(0, 2), ['돌아보기', '풀 베기']);
  assert.equal(roadStep(8), 9);
  assert.equal(roadStep(9), 9);
  assert.equal(eopgyeong(7, { road: 8 }).tier, 1);
  assert.equal(eopgyeong(7, { road: 9 }).tier, 2);
  assert.equal(eopgyeong(7, { incense: true, road: 9 }).tier, 3);
  assert.equal(eopgyeong(20, { road: 9 }).tier, 3);
});

test('길닦기 (시뮬): 최종 원정만 센다 — 업경대 앞 칸 수가 남고, 보스 길에는 없다', () => {
  const trio: HeroId[] = ['manshin', 'jaebi', 'chasa'];
  let seen = 0;
  for (let k = 1; k <= 6; k++) {
    const fin = runExpedition([...trio], 1000 + k, { setup: typicalParty([...trio], 3, k, undefined, 'final').setup });
    if (fin.bossReached) {
      seen++;
      assert.ok(fin.road! >= 3 && fin.road! <= 9, `road ${fin.road}`);
    }
    const boss = runExpedition([...trio], 2000 + k, { setup: typicalParty([...trio], 3, k).setup });
    assert.equal(boss.road, undefined);
  }
  assert.ok(seen > 0);
});

test('길닦기 (플레이어블): 최종 원정에서만 ① 들어설 때 · 길굿마다 · 잽이 질침 장단 한 칸, 업경대에 넘긴다', () => {
  assert.equal(r3().flags.road, undefined, '최종 원정이 아니면 세지 않는다');
  const app = blankApp();
  app.run = r3(['jaebi', 'manshin', 'seungnyeo'], true);
  const run = app.run;
  assert.equal(run.flags.road, 1);
  const campRoom = run.dungeon.rooms.find((r) => r.camp)!;
  startCamp(app, campRoom.id);
  assert.equal(run.flags.road, 2);
  // 잽이 「질침 장단」 (A-06): 귀기 없이 통과 + 한 칸
  const dlg = { kind: 'event' as const, id: 'daemun_tonghaeng', result: null, then: 'none' as const };
  const s0 = run.heroes.map((h) => h.stress);
  app.dialog = { ...dlg };
  chooseDialog(app, 'c5');
  assert.equal(run.flags.road, 3);
  assert.equal(run.flags.gates, 1);
  assert.deepEqual(run.heroes.map((h) => h.stress), s0);
  // 다 찬 길 → 업경대가 한 단계 위로 비춘다
  run.flags.road = 9;
  run.stats.haewons = 6;
  app.dialog = { kind: 'event', id: 'eopgyeong_bichugi', result: null, then: 'none' };
  chooseDialog(app, 'c0');
  assert.equal(run.flags.eopTier, 2);
  assert.match(app.dialog!.result ?? '', /아홉 단계로 닦은 길/);
});

test('대문 통행 ⟨반복 5⟩: 문전상(쌀 1 · 지전 1 → 다음 전투 해원 조건) · 탈꾼 문지기 흉내(귀기 −5) · 원형이 없으면 막힌다', () => {
  const app = blankApp();
  app.run = r3(['talggun', 'manshin', 'seungnyeo']);
  const run = app.run;
  const dlg = { kind: 'event' as const, id: 'daemun_tonghaeng', result: null, then: 'none' as const };
  const opts = dialogOptions(run, dlg);
  assert.equal(opts.find((o) => o.id === 'c4')!.cost, '쌀 1, 지전 1');
  assert.ok(!opts.find((o) => o.id === 'c5')!.enabled, '잽이가 없으면 질침 장단을 칠 수 없다');
  assert.ok(opts.find((o) => o.id === 'c6')!.enabled);
  app.dialog = { ...dlg };
  chooseDialog(app, 'c4');
  assert.equal(run.supplies.rice, SUP.rice - 1);
  assert.equal(run.supplies.jijeon, SUP.jijeon - 1);
  assert.equal(run.next.munjeon, true);
  for (const h of run.heroes) h.stress = 20;
  app.dialog = { ...dlg };
  chooseDialog(app, 'c6');
  assert.ok(run.heroes.every((h) => h.stress === 15));
  assert.equal(run.flags.gates, 2);
});

test('업경대: 승려 회심곡(A-05) — 해원 수 그대로 비추고 파티 귀기 −15, 승려가 없으면 막힌다', () => {
  const app = blankApp();
  app.run = r3(['posu', 'manshin', 'seungnyeo'], true);
  const run = app.run;
  for (const h of run.heroes) h.stress = 30;
  run.stats.haewons = 6;
  app.dialog = { kind: 'event', id: 'eopgyeong_bichugi', result: null, then: 'none' };
  chooseDialog(app, 'c3');
  assert.equal(run.flags.eopTier, 1);
  assert.ok(run.heroes.every((h) => h.stress === 15));
  const other = r3(['posu', 'manshin', 'chasa'], true);
  assert.ok(!dialogOptions(other, { kind: 'event', id: 'eopgyeong_bichugi', result: null, then: 'none' }).find((o) => o.id === 'c3')!.enabled);
});

test('삼천 군병 상(H-06): 3지역 길굿에서 쌀 2 → 이름 없는 군졸 넋 해원 회복 +2 (엔진 mods.gunbyeong)', () => {
  const app = blankApp();
  app.run = r3();
  const run = app.run;
  startCamp(app, run.dungeon.rooms.find((r) => r.camp)!.id);
  assert.ok(campActions(run, app.camp!).find((a) => a.id === 'gunbyeong_sang')!.enabled);
  doCampAction(app, 'gunbyeong_sang');
  assert.equal(run.flags.gunbyeong, true);
  assert.equal(run.supplies.rice, SUP.rice - 2);
  assert.equal(relicMods(run).gunbyeong, true);
  // 1지역 길굿에는 없다
  const app1 = blankApp();
  app1.run = newRun({ seed: 3, commission: 'boss', party: ['posu', 'manshin', 'seungnyeo'], formation: [2, 1, 0], supplies: { ...SUP }, gold: 0, spent: 0 });
  startCamp(app1, app1.run.dungeon.rooms.find((r) => r.camp)!.id);
  assert.equal(campActions(app1.run, app1.camp!).find((a) => a.id === 'gunbyeong_sang'), undefined);
  // 엔진: 군졸 넋을 해원하면 그 자리 회복이 3 → 5
  const d = D();
  const heal = (gunbyeong: boolean) => {
    const s = createCombat({ party: [{ id: 'posu' }, { id: 'manshin' }, { id: 'chasa' }], deck: [], encounter: { id: 't', tier: 'hard', enemies: ['ireumeomneun_gunjol'] }, seed: 1, record: true, mods: { gunbyeong } });
    for (const h of s.heroes) h.hp = 10;
    s.enemies[0].lastHitToken = true;
    killEnemy(s, 0);
    assert.ok(s.enemies[0].haewon);
    return s.heroes[0].hp - 10;
  };
  assert.equal(heal(false), 3);
  assert.equal(heal(true), 5);
  void d;
});

test('업칭(I-09): 해원 조건의 상태·장단 문턱 −1 (최소 1)', () => {
  const d = D();
  const s = createCombat({ party: [{ id: 'posu' }, { id: 'manshin' }, { id: 'chasa' }], deck: [], encounter: { id: 't', tier: 'hard', enemies: ['bangpae_gunjol', 'nokseun_chang'] }, seed: 1, record: false });
  const [bang, nok] = s.enemies;
  assert.equal(d.enemies[bang.def].haewon.n, 4);
  bang.bleed = 3;
  s.jangdan = 2;
  assert.ok(!haewonSatisfied(s, bang));
  assert.ok(!haewonSatisfied(s, nok));
  s.mods.eopching = true;
  assert.ok(haewonSatisfied(s, bang), '상흔 3이면 된다');
  assert.ok(haewonSatisfied(s, nok), '장단 2면 된다');
});

test('숨살이꽃(I-08): 원정마다 한 번, 쓰러진 영웅이 그 자리에서 체력 50%로 — 두 번째는 그대로 쓰러진다', () => {
  const s = createCombat({ party: [{ id: 'posu' }, { id: 'manshin' }, { id: 'chasa' }], deck: [], encounter: D().encounterById.get('x1')!, seed: 1, record: true, mods: { sumsari: true } });
  loseHp(s, 0, 999);
  assert.ok(!s.heroes[0].downed);
  assert.equal(s.heroes[0].hp, Math.round(s.heroes[0].maxHp * 0.5));
  assert.equal(s.sumsariUsed, true);
  loseHp(s, 1, 999);
  assert.ok(s.heroes[1].downed);
  const used = createCombat({ party: [{ id: 'posu' }], deck: [], encounter: D().encounterById.get('x1')!, seed: 1, record: false, mods: { sumsari: true }, sumsariUsed: true });
  loseHp(used, 0, 999);
  assert.ok(used.heroes[0].downed, '이미 쓴 원정에서는 일어나지 않는다');
});

test('새 가호 넷: 데이터 · 숨살이꽃은 무작위 보상에 없고 최종 원정 수호 방에서만 · 성주 한지 · 조왕중발', () => {
  const rel = (n: number) => REGION_JSON[n].relics as unknown as { id: string; tier: string; final_reward?: boolean }[];
  assert.equal(rel(2).find((r) => r.id === 'jowang_jungbal')?.tier, '일반');
  assert.equal(rel(2).find((r) => r.id === 'seongju_hanji')?.tier, '일반');
  assert.equal(rel(3).find((r) => r.id === 'eopching')?.tier, '고급');
  assert.equal(rel(3).find((r) => r.id === 'sumsari_kkot')?.final_reward, true);
  const run = r3();
  for (let k = 0; k < 30; k++) assert.ok(!rollRelics(run, ['희귀', '고급', '일반'], 8).includes('sumsari_kkot'));
  assert.ok(relicMods({ ...run, relics: ['sumsari_kkot', 'eopching'] }).sumsari);
  // 성주 한지: 중상이 낫고 최대 체력 +2
  run.heroes[0].injured = true;
  const m0 = run.heroes[0].baseMax;
  applyRelicGain(run, 'seongju_hanji');
  assert.equal(run.heroes[0].injured, false);
  assert.equal(run.heroes[0].baseMax, m0 + 2);
  // 조왕중발: 귀환할 때 살아 돌아온 영웅 귀기 −10
  const app = blankApp();
  app.run = r3();
  app.run.relics.push('jowang_jungbal');
  for (const h of app.run.heroes) h.stress = 25;
  const res = buildResult(app, true, '귀환');
  assert.ok(res.heroes.every((h) => h.stress === 25 - JOWANG_JUNGBAL_STRESS));
});

test('만신의 손님 청하기 ⟨반복 5⟩: 시작 대접 +4 → +2 (region2.json meter.manshin_start)', () => {
  assert.equal(D().specials.get('sonnim_baeung')!.manshinStart, 2);
});

test('마을 ⟨반복 5⟩: 측신 이벤트 · 법사 안택은 법사가 있을 때만 · 「무당을 데려가는 차사」 출신 + 만신 → 인연 1 · 황우양 집짓기 연출', () => {
  const ev = new Map(CD.events.map((e) => [e.id, e]));
  assert.equal(ev.get('cheuksin')?.kind, 'bad');
  assert.equal(ev.get('cheuksin')?.effect.stressOne, 5);
  assert.equal(ev.get('antaek')?.requires, 'beopsa');
  // 출신 인연
  const c = newCampaign(11);
  const rule = CD.originBonds[0];
  assert.match(CD.origins.chasa[rule.origin], /무당을 데려가는 차사/);
  c.roster = [];
  const m = makePerson(c, 'manshin');
  c.roster.push(m);
  const ch = makePerson(c, 'chasa');
  ch.origin = rule.origin;
  c.candidates = [ch];
  c.gold = 999;
  assert.equal(recruit(c, 0), null);
  assert.equal(bondOf(c, m.uid, ch.uid), 1);
  const other = makePerson(c, 'chasa');
  other.origin = 0;
  assert.deepEqual(originBondLines(c, other), []);
  // 황우양 집짓기: 건축 기록에 네 단계와 상량
  const c2 = newCampaign(12);
  c2.gold = 9999;
  c2.chiseong = 99;
  assert.equal(build(c2, 'gaekju'), null);
  assert.match(c2.log.at(-1)!, /재목 마련 → 집터 다지기 → 집짓기 → 집치장, 상량/);
  assert.equal(CD.sites[0].id, 'jangseung');
  assert.match(CD.sites[0].guardian, /문전 \+ 오방토신/);
});

test('처벌 강도: 최종 원정 덮어쓰기가 없으면 기본값 그대로', () => {
  assert.deepEqual(deathRules('boss'), { wipeSurvive: CD.death.wipeSurvive, deathSave: CD.death.deathSave });
  assert.deepEqual(deathRules('final'), { wipeSurvive: CD.death.final?.wipeSurvive ?? CD.death.wipeSurvive, deathSave: CD.death.final?.deathSave ?? CD.death.deathSave });
});

test('영개울림 대사 세트(H-03): 졸개가 아닌 원귀마다 부모 → 배우자 → 형제 순서, 신의 이름·금지어 없음', () => {
  const y = JSON.parse(readFileSync(new URL('../data/design/yeonggae.json', import.meta.url), 'utf8')) as { frame: string[]; lines: Record<string, { to: string; text: string }[]> };
  const order = y.frame;
  const gods = ['성주', '조왕', '삼신', '터주', '측신', '문전', '시왕', '염라', '강림', '손님', '용왕', '칠성'];
  const banned = ['광기', '발작', '미쳐', '미친', '피투성이', '선혈', '해골', '시체', '썩은', '변호사'];
  let n = 0;
  for (const r of [1, 2, 3]) {
    for (const e of REGION_JSON[r].enemies as unknown as { id: string; category: string }[]) {
      if (e.category === 'minion') continue;
      n++;
      const ls = y.lines[e.id];
      assert.ok(ls && ls.length >= 2 && ls.length <= 3, `${e.id}: ${ls?.length}`);
      const idx = ls.map((l) => order.indexOf(l.to));
      assert.ok(idx.every((i) => i >= 0), e.id);
      assert.deepEqual(idx, [...idx].sort((a, b) => a - b), `${e.id}: 부모 → 배우자 → 형제`);
      assert.equal(ls[0].to, '부모', e.id);
      for (const l of ls) {
        for (const g of gods) assert.ok(!l.text.includes(g), `${e.id}: 신의 이름 '${g}'`);
        for (const w of banned) assert.ok(!l.text.includes(w), `${e.id}: 금지어 '${w}'`);
      }
    }
  }
  assert.equal(Object.keys(y.lines).length, n, '졸개가 아닌 원귀 수와 같다');
});
