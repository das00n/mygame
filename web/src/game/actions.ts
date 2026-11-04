// 화면과 자동 진행이 함께 쓰는 고수준 행동. 상태를 바꾼 뒤 store.commit() 은 부르는 쪽이 한다.

import { upgradeInst } from '../../../src/core/data.ts';
import { rand } from '../../../src/core/rng.ts';
import type { HeroId } from '../../../src/core/types.ts';
import { D } from './content.ts';
import { rollEncounter, startBattle } from './combat.ts';
import { leaveCamp, spendCampPoints, startCamp } from './camp.ts';
import { objective, samePos } from './dungeon.ts';
import { openDialogFor, setKnownBefore } from './encounters.ts';
import { takeCard } from './rewards.ts';
import {
  addRunStress, aliveIdx, buildResult, canStep, currentContent, heroName, logRun, newRun, stepTo, travel, upgradableIdx, type NewRunOpts,
} from './run.ts';
import { clearSave } from './save.ts';
import type { AppState, BattleSource, Pos, Run } from './types.ts';

export function blankApp(): AppState {
  return { screen: 'title', run: null, combat: null, reward: null, dialog: null, picker: null, camp: null, result: null, toast: null, campaign: null, plan: null, settlement: null };
}

export function beginExpedition(app: AppState, o: NewRunOpts): void {
  const keep = { campaign: app.campaign, plan: app.plan };
  Object.assign(app, blankApp(), o.campaign ? keep : {});
  app.run = newRun(o);
  app.screen = 'map';
}

function srcOf(p: Pos): BattleSource {
  return p.kind === 'room' ? { k: 'room', room: p.room } : { k: 'tile', cor: p.cor, i: p.i };
}

/** 지금 자리의 내용을 처리한다 (전투·기물·이벤트·덫) */
export function resolveHere(app: AppState): void {
  const run = app.run!;
  const c = currentContent(run);
  if (c.done) return;
  if (c.k === 'battle' || c.k === 'elite' || c.k === 'boss') {
    const kind = c.k === 'elite' ? 'elite' : 'battle';
    if (!c.id) c.id = c.k === 'boss' ? run.bossEnc! : rollEncounter(run, kind);
    const tier = c.k === 'boss' ? 'boss' : c.k === 'elite' ? 'elite' : run.fightsSeen < 2 ? 'easy' : 'hard';
    startBattle(app, { enc: c.id, tier, src: srcOf(run.pos), cardReward: true });
    return;
  }
  openDialogFor(app);
}

export function moveTo(app: AppState, to: Pos): boolean {
  const run = app.run!;
  if (!canStep(run, to)) return false;
  const known = to.kind === 'tile' ? run.dungeon.corridors[to.cor].tiles[to.i].known : run.dungeon.rooms[to.room].known;
  setKnownBefore(known);
  const r = stepTo(run, to);
  if (r.scouted) app.toast = '정찰 성공 — 이웃한 방과 길목이 드러났다';
  if (r.respawn) {
    app.toast = '어두운 길목을 되짚자 원귀가 다시 나타났다 (카드 보상 없음)';
    startBattle(app, { enc: rollEncounter(run, 'raid'), tier: 'hard', src: { k: 'event', id: 'respawn' }, cardReward: false });
    return true;
  }
  resolveHere(app);
  return true;
}

export function travelTo(app: AppState, room: number): boolean {
  const run = app.run!;
  if (!travel(run, room)) return false;
  resolveHere(app);
  return true;
}

export function dialogContinue(app: AppState): void {
  const run = app.run!;
  const dlg = app.dialog;
  if (!dlg) return;
  app.dialog = null;
  switch (dlg.then) {
    case 'battle': {
      const sp = dlg.battleSpecial ?? 'none';
      startBattle(app, {
        enc: dlg.battleEnc!, tier: sp === 'sonnim' ? 'elite' : 'event', src: sp === 'play' || sp === 'sonnim' ? srcOf(run.pos) : { k: 'event', id: dlg.id },
        cardReward: sp === 'none' || sp === 'escort', special: sp,
      });
      break;
    }
    case 'cards':
      app.picker = { mode: 'offer', title: '카드 3장 중 1장', offer: dlg.cardOptions ?? [], from: 'dialog' };
      break;
    case 'remove':
      app.picker = { mode: 'remove', title: '덱에서 뺄 카드', allowed: run.deck.map((_, i) => i), from: 'dialog' };
      break;
    case 'transform': {
      const d = D();
      const allowed = run.deck.map((c, i) => ({ c, i })).filter(({ c }) => {
        const def = d.cards[c.d];
        return def.ownerKind === 'hero' && !def.isCurse && !def.isStatus && c.o >= 0 && !run.heroes[c.o].dead;
      }).map((x) => x.i);
      app.picker = { mode: 'transform', title: '바꿀 카드 (같은 영웅의 다른 카드로)', allowed, from: 'dialog' };
      break;
    }
    case 'formation':
      app.picker = { mode: 'formation', title: '진형 다시 짜기', from: 'dialog' };
      break;
    case 'upgrade':
      app.picker = { mode: 'upgrade', title: '강화할 카드', allowed: upgradableIdx(run), from: 'dialog' };
      break;
    case 'upgrade_baksu':
      app.picker = { mode: 'upgrade', title: '강화할 작두박수 카드', allowed: upgradableIdx(run, 'baksu'), from: 'dialog' };
      break;
    case 'upgrade_hero':
      app.picker = { mode: 'upgrade', title: '강화할 카드', allowed: upgradableIdx(run, dlg.upgradeHero), from: 'dialog' };
      break;
  }
}

/** 고르기 창의 결과. value: 덱 index · 카드 id · 영웅 idx · null(그만두기) */
export function pickerApply(app: AppState, value: number | string | null): string {
  const run = app.run!;
  const pk = app.picker;
  if (!pk) return '';
  const d = D();
  app.picker = null;
  let msg = '';
  if (value === null) return '';
  switch (pk.mode) {
    case 'offer': {
      const def = d.cardById.get(value as string)!;
      run.deck.push({ d: def.idx, o: def.heroes.length ? run.party.indexOf(def.heroes[0]) : -1, o2: def.ownerKind === 'duo' ? run.party.indexOf(def.heroes[1]) : -1, orig: -1, x: -1 });
      run.stats.cardsTaken++;
      msg = `「${def.name}」을(를) 덱에 넣었다.`;
      break;
    }
    case 'remove':
    case 'purge': {
      const i = value as number;
      const c = run.deck[i];
      if (!c) break;
      run.deck.splice(i, 1);
      msg = `「${d.cards[c.d].name}」을(를) 덱에서 뺐다.`;
      if (pk.cost?.points) spendCampPoints(app, pk.cost.points);
      if (pk.cost?.supply) run.supplies[pk.cost.supply]--;
      break;
    }
    case 'upgrade': {
      const i = value as number;
      const c = run.deck[i];
      const up = c ? upgradeInst(c) : null;
      if (!up) break;
      run.deck[i] = up;
      run.stats.upgrades++;
      msg = `「${d.cards[c.d].name}」을(를) 강화했다 → 「${d.cards[up.d].name}」.`;
      if (pk.cost?.points) spendCampPoints(app, pk.cost.points);
      break;
    }
    case 'transform': {
      const i = value as number;
      const c = run.deck[i];
      const def = d.cards[c.d];
      const hero = def.heroes[0] as HeroId;
      const pool = d.pools.get(hero)!.filter((x) => x.idx !== def.idx);
      const nd = pool[Math.floor(rand(run) * pool.length)];
      run.deck[i] = { d: nd.idx, o: c.o, o2: -1, orig: -1, x: -1 };
      msg = `「${def.name}」이(가) 「${nd.name}」(으)로 바뀌었다.`;
      break;
    }
    case 'sul': {
      const hi = value as number;
      if (run.supplies.sul <= 0) break;
      run.supplies.sul--;
      addRunStress(run, hi, -10, false);
      msg = `${heroName(run.heroes[hi].id)}이(가) 술을 마셨다. 귀기 −10.`;
      break;
    }
    case 'formation':
      break;
  }
  if (msg) {
    app.toast = msg;
    logRun(run, msg);
  }
  return msg;
}

export function setFormation(app: AppState, order: number[]): void {
  const run = app.run!;
  const alive = aliveIdx(run);
  const f = order.filter((i) => alive.includes(i));
  for (const i of alive) if (!f.includes(i)) f.push(i);
  run.formation = [...f, ...run.formation.filter((i) => !f.includes(i))];
}

/** 행기못 물 한 병 (지역 3 가호): 원정마다 1회, 지금 길목의 남은 칸을 건너뛰고 다음 방으로 */
export function useHaenggimot(app: AppState): boolean {
  const run = app.run!;
  if (!run.relics.includes('haenggimot') || run.flags.haenggimotUsed || run.pos.kind !== 'tile') return false;
  const c = run.dungeon.corridors[run.pos.cor];
  const toward = run.prevRoom === c.a ? c.b : c.a;
  for (const t of c.tiles) {
    t.walked = true;
    t.known = true;
    t.content.done = true;
  }
  run.flags.haenggimotUsed = true;
  run.pos = { kind: 'room', room: toward };
  const r = run.dungeon.rooms[toward];
  r.visited = true;
  r.known = true;
  app.toast = '행기못 물을 마시자 길목이 접혀 다음 방에 닿았다';
  logRun(run, '행기못 물 — 길목을 건너뛰었다');
  resolveHere(app);
  return true;
}

export function useCandleOnMap(app: AppState): boolean {
  const run = app.run!;
  if (run.supplies.candle <= 0 || run.light >= 100) return false;
  run.supplies.candle--;
  run.stats.candlesUsed++;
  run.light = Math.min(100, run.light + 25);
  app.toast = `촛불을 켰다 — 넋등 ${run.light}`;
  return true;
}

export function openSul(app: AppState): void {
  app.picker = { mode: 'sul', title: '술을 마실 영웅 (귀기 −10)', from: 'map' };
}

export function openBujeokPurge(app: AppState): void {
  const run = app.run!;
  const d = D();
  const allowed = run.deck.map((c, i) => (d.cards[c.d].isCurse ? i : -1)).filter((i) => i >= 0);
  app.picker = { mode: 'purge', title: '부적으로 정화할 씌임 카드', allowed, cost: { supply: 'bujeok' }, from: 'map' };
}

export function campAvailable(run: Run): boolean {
  if (run.pos.kind !== 'room') return false;
  const r = run.dungeon.rooms[run.pos.room];
  if (!r.camp || r.campUsed) return false;
  const c = r.content;
  return !!c.done || c.k === 'empty' || c.k === 'entrance';
}

export function openCamp(app: AppState): void {
  const run = app.run!;
  if (!campAvailable(run) || run.pos.kind !== 'room') return;
  startCamp(app, run.pos.room);
}

export function finishCamp(app: AppState): void {
  const run = app.run!;
  const raid = leaveCamp(app);
  if (raid) {
    app.toast = '밤 습격! 길굿 불빛을 보고 원귀가 몰려왔다';
    logRun(run, '밤 습격');
    startBattle(app, { enc: rollEncounter(run, 'raid'), tier: 'hard', src: { k: 'raid' }, cardReward: true });
    return;
  }
  app.screen = 'map';
}

export function rewardContinue(app: AppState): void {
  const r = app.reward;
  if (r && !r.cardsTaken) takeCard(app, null);
  app.reward = null;
  if (r?.bossEnd) {
    endRun(app, true, '큰 원귀를 보내 주었다');
    return;
  }
  app.screen = 'map';
}

export function endRun(app: AppState, success: boolean, reason: string): void {
  app.result = buildResult(app, success, reason);
  app.combat = null;
  app.dialog = null;
  app.picker = null;
  app.camp = null;
  app.screen = 'result';
  if (!app.campaign) clearSave();
}

export function returnHome(app: AppState): void {
  const run = app.run!;
  if (!objective(run).met) return;
  endRun(app, true, '의뢰를 마치고 돌아왔다');
}

export function abandon(app: AppState): void {
  const run = app.run!;
  for (const i of aliveIdx(run)) addRunStress(run, i, 20, false);
  endRun(app, false, '원정을 포기하고 돌아왔다 (귀기 +20, 의뢰 보수 없음)');
}

/** 지금 자리에 손대지 않은 기물·이벤트·덫이 남아 있는가 */
export function pendingHere(run: Run): boolean {
  const c = currentContent(run);
  return !c.done && (c.k === 'curio' || c.k === 'event' || c.k === 'trap');
}

export function reopenHere(app: AppState): void {
  setKnownBefore(true);
  openDialogFor(app);
}

export function isBossStep(run: Run, p: Pos): boolean {
  return p.kind === 'room' && p.room === run.dungeon.boss && !run.dungeon.rooms[p.room].content.done;
}

export { samePos };
