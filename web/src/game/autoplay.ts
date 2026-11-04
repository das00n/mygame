// 자동 진행: 전투는 src/sim/bot.ts 의 평가 함수(한 수 앞보기)로, 지도·기물·보상·길굿은 단순 규칙으로 한 걸음씩 둔다.

import { pickReward, rewardScore, profileDeck } from '../../../src/sim/draft.ts';
import { botChoice, playChoice, endTurn, useCandleInCombat } from './combat.ts';
import { campActions, doCampAction, HERO_ACTS } from './camp.ts';
import { D } from './content.ts';
import { objective, shortestPath } from './dungeon.ts';
import { chooseDialog, dialogOptions } from './encounters.ts';
import { pickFlag, pickRare, pickRelic, takeCard } from './rewards.ts';
import { aliveIdx, effMax } from './run.ts';
import {
  abandon, campAvailable, dialogContinue, finishCamp, moveTo, openCamp, pickerApply, returnHome, rewardContinue, setFormation, travelTo, useCandleOnMap,
} from './actions.ts';
import type { AppState, Pos, Run } from './types.ts';

let turnPlays = 0;
let lastTurn = -1;

/** 한 걸음 둔다. 둘 것이 없으면 false */
export function autoStep(app: AppState): boolean {
  const run = app.run;
  if (!run) return false;
  if (app.picker) return autoPicker(app);
  if (app.dialog) return autoDialog(app);
  switch (app.screen) {
    case 'combat':
      return autoCombat(app);
    case 'reward':
      return autoReward(app);
    case 'camp':
      return autoCamp(app);
    case 'map':
      return autoMap(app);
    default:
      return false;
  }
}

function autoCombat(app: AppState): boolean {
  const cs = app.combat;
  const run = app.run!;
  if (!cs || cs.s.outcome !== 0) return false;
  const s = cs.s;
  const d = D();
  if (s.turn !== lastTurn) {
    lastTurn = s.turn;
    turnPlays = 0;
  }
  const shadows = s.hand.filter((c) => c.d === d.special.shadow).length;
  if (shadows >= 2 && run.supplies.candle > 1) {
    useCandleInCombat(app);
    return true;
  }
  const choice = turnPlays < 40 ? botChoice(s) : null;
  if (choice) {
    turnPlays++;
    playChoice(app, choice);
  } else {
    turnPlays = 0;
    endTurn(app);
  }
  return true;
}

function autoReward(app: AppState): boolean {
  const run = app.run!;
  const r = app.reward!;
  const d = D();
  if (!r.cardsTaken && r.cards) {
    const defs = r.cards.map((id) => d.cardById.get(id)!);
    const pick = pickReward(defs, run.deck, !r.bossEnd);
    takeCard(app, pick ? pick.id : null);
    return true;
  }
  if (r.flags && r.flags.picked < 0) {
    pickFlag(app, r.flags.peek >= 0 && r.flags.colors[r.flags.peek] !== 'blue' ? r.flags.peek : 0);
    return true;
  }
  if (!r.relicPicked && r.relics) {
    pickRelic(app, r.relics[0] ?? null);
    return true;
  }
  if (!r.rarePicked && r.rareCards) {
    const prof = profileDeck(run.deck);
    const defs = r.rareCards.map((id) => d.cardById.get(id)!);
    defs.sort((a, b) => rewardScore(b, prof) - rewardScore(a, prof));
    pickRare(app, defs[0]?.id ?? null);
    return true;
  }
  rewardContinue(app);
  return true;
}

function autoDialog(app: AppState): boolean {
  const run = app.run!;
  const dlg = app.dialog!;
  if (dlg.result !== null) {
    dialogContinue(app);
    return true;
  }
  const opts = dialogOptions(run, dlg).filter((o) => o.enabled);
  const keepJijeon = run.bossEnc === 'b1' ? 3 : 0;
  const affordable = (o: (typeof opts)[number]) => !(o.cost?.includes('지전') && run.supplies.jijeon - Number(o.cost.match(/지전\s*(\d+)/)?.[1] ?? 1) < keepJijeon);
  let pick = opts.find((o) => o.kind === 'hero') ?? opts.find((o) => o.kind === 'supply' && affordable(o));
  if (!pick) {
    if (dlg.kind === 'curio') pick = opts.find((o) => o.kind === 'bare');
    else if (dlg.kind === 'trap') pick = opts.find((o) => o.id === 'careful');
    else pick = opts.find((o) => o.kind === 'choice' && affordable(o) && !/버틴다|쫓아낸다|데려다준다/.test(o.label)) ?? opts.find((o) => affordable(o)) ?? opts[0];
  }
  if (!pick) {
    app.dialog = null;
    return true;
  }
  chooseDialog(app, pick.id);
  return true;
}

function autoPicker(app: AppState): boolean {
  const run = app.run!;
  const pk = app.picker!;
  const d = D();
  const prof = profileDeck(run.deck);
  switch (pk.mode) {
    case 'offer': {
      const defs = (pk.offer ?? []).map((id) => d.cardById.get(id)!);
      defs.sort((a, b) => rewardScore(b, prof) - rewardScore(a, prof));
      pickerApply(app, defs[0]?.id ?? null);
      return true;
    }
    case 'remove':
    case 'purge':
    case 'transform': {
      const allowed = pk.allowed ?? [];
      let best = -1;
      let bv = Infinity;
      for (const i of allowed) {
        const def = d.cards[run.deck[i].d];
        const v = def.isCurse ? -100 : rewardScore(def, prof) + (def.starter ? -0.2 : 0);
        if (v < bv) {
          bv = v;
          best = i;
        }
      }
      pickerApply(app, best >= 0 ? best : null);
      return true;
    }
    case 'sul': {
      let best = aliveIdx(run)[0];
      for (const i of aliveIdx(run)) if (run.heroes[i].stress > run.heroes[best].stress) best = i;
      pickerApply(app, best);
      return true;
    }
    case 'formation':
      setFormation(app, run.formation);
      pickerApply(app, null);
      return true;
  }
  return false;
}

function autoCamp(app: AppState): boolean {
  const run = app.run!;
  const camp = app.camp!;
  const acts = campActions(run, camp);
  const can = (id: string) => acts.find((a) => a.id === id)?.enabled;
  const alive = aliveIdx(run);
  const worst = Math.min(...alive.map((i) => run.heroes[i].hp / effMax(run.heroes[i])));
  if (!camp.meal) {
    if (worst < 0.7 && can('meal_full')) return !!doCampAction(app, 'meal_full') || true;
    if (worst < 0.9 && can('meal_light')) return !!doCampAction(app, 'meal_light') || true;
  }
  if (camp.raid > 0 && can('posu_watch')) return !!doCampAction(app, 'posu_watch') || true;
  if (camp.raid > 0 && can('dwitjeon') && run.supplies.rice >= 4) return !!doCampAction(app, 'dwitjeon') || true;
  const injured = alive.find((i) => run.heroes[i].injured);
  if (injured !== undefined && can('injury')) return !!doCampAction(app, 'injury', injured) || true;
  const d = D();
  const dead = run.heroes.findIndex((h, i) => h.dead && run.deck.some((c) => c.o === i && c.d === d.special.mourn));
  if (dead >= 0 && can('cheondo')) return !!doCampAction(app, 'cheondo', dead) || true;
  if (can('purge')) {
    const allowed = run.deck.map((c, i) => (d.cards[c.d].isCurse ? i : -1)).filter((i) => i >= 0);
    app.picker = { mode: 'purge', title: '정화할 씌임 카드', allowed, cost: { points: 3 }, from: 'camp' };
    return true;
  }
  const order = ['seungnyeo_yeombul', 'jaebi_garak', 'posu_powder', 'talggun_dance', 'chasa_rope', 'beopsa_bujeok', 'manshin_momju', 'baksu_rest', 'seungnyeo_yakson', 'jaebi_heung', 'talggun_nori', 'manshin_gongsu', 'chasa_ledger', 'beopsa_haewon'];
  for (const id of order) {
    if (!HERO_ACTS.some((a) => a.id === id)) continue;
    const a = acts.find((x) => x.id === id);
    if (a?.enabled && camp.points - a.points >= 0) return !!doCampAction(app, id) || true;
  }
  if (can('remove')) {
    const allowed = run.deck.map((_, i) => i);
    app.picker = { mode: 'remove', title: '덱에서 뺄 카드', allowed, cost: { points: 5 }, from: 'camp' };
    return true;
  }
  finishCamp(app);
  return true;
}

function nearest(run: Run, goal: (p: Pos) => boolean, avoidBoss = true): Pos[] | null {
  return shortestPath(run.dungeon, run.pos, goal, false, avoidBoss);
}

function autoMap(app: AppState): boolean {
  const run = app.run!;
  const dg = run.dungeon;
  const obj = objective(run);
  if (obj.met && run.commission !== 'boss') {
    returnHome(app);
    return true;
  }
  if (run.light < 26 && run.supplies.candle > 0) {
    useCandleOnMap(app);
    return true;
  }
  if (campAvailable(run)) {
    const alive = aliveIdx(run);
    const worst = Math.min(...alive.map((i) => run.heroes[i].hp / effMax(run.heroes[i])));
    const atFerry = run.pos.kind === 'room' && run.pos.room === dg.ferry;
    if (atFerry || worst < 0.8 || run.heroes.some((h) => !h.dead && h.injured)) {
      openCamp(app);
      return true;
    }
  }
  const roomsVisited = dg.rooms.filter((r) => r.visited).length;
  let path: Pos[] | null = null;
  if (run.commission === 'boss') {
    const goBoss = roomsVisited >= Math.ceil(dg.rooms.length * 0.6) || (run.light < 15 && run.supplies.candle === 0);
    if (goBoss) {
      const ferry = dg.rooms[dg.ferry];
      if (ferry.camp && !ferry.campUsed && !(run.pos.kind === 'room' && run.pos.room === ferry.id)) path = nearest(run, (p) => p.kind === 'room' && p.room === ferry.id);
      else path = nearest(run, (p) => p.kind === 'room' && p.room === dg.boss, false);
    }
  } else if (run.commission === 'normal') {
    path = nearest(run, (p) => p.kind === 'room' && (dg.rooms[p.room].content.k === 'battle' || dg.rooms[p.room].content.k === 'elite') && !dg.rooms[p.room].content.done && dg.rooms[p.room].known);
  }
  if (!path) path = nearest(run, (p) => p.kind === 'room' && !dg.rooms[p.room].visited && p.room !== dg.boss);
  if (!path && run.commission === 'boss') path = nearest(run, (p) => p.kind === 'room' && p.room === dg.boss, false);
  if (!path) {
    if (obj.met) returnHome(app);
    else abandon(app);
    return true;
  }
  // 지나온 길목만으로 닿는 방문한 방까지는 즉시 이동
  if (run.pos.kind === 'room') {
    let lastRoom = -1;
    for (const p of path) {
      if (p.kind === 'tile') {
        if (!dg.corridors[p.cor].tiles[p.i].walked) break;
      } else {
        if (!dg.rooms[p.room].visited) break;
        lastRoom = p.room;
      }
    }
    if (lastRoom >= 0 && lastRoom !== run.pos.room) {
      travelTo(app, lastRoom);
      return true;
    }
  }
  moveTo(app, path[0]);
  return true;
}

export function resetAuto(): void {
  turnPlays = 0;
  lastTurn = -1;
}
