// 길굿 (탐험 §9): 여유 12점, 끼니, 공용 행동, 영웅 고유 행동, 밤 습격.

import { rand } from '../../../src/core/rng.ts';
import type { HeroId } from '../../../src/core/types.ts';
import { CAMP_POINTS, D, NIGHT_RAID } from './content.ts';
import { addBond } from './encounters.ts';
import { aliveIdx, effMax, healHero, heroName, logRun, partyStress, addRunStress, revealRandomHaewon, scoutRooms, upgradableIdx } from './run.ts';
import type { AppState, CampState, Run } from './types.ts';

export interface CampAction {
  id: string;
  label: string;
  detail: string;
  points: number;
  rice?: number;
  hero?: HeroId;
  enabled: boolean;
  reason?: string;
  group: 'meal' | 'common' | 'hero';
  /** 대상 고르기가 필요하면 화면이 처리한다 */
  pick?: 'card-remove' | 'card-upgrade' | 'curse' | 'pair' | 'dead' | 'injured' | 'formation';
}

interface HeroAct {
  id: string;
  hero: HeroId;
  label: string;
  detail: string;
  points: number;
}

/** 영웅 고유 길굿 행동 (원형마다 2개). 문서에 예시 3개(가락 맞추기·밤 염불·망보기)만 있어 나머지는 프로토타입 가정값 */
export const HERO_ACTS: HeroAct[] = [
  { id: 'manshin_gongsu', hero: 'manshin', label: '공수 받기', detail: '가까운 미답 방 2곳을 정찰한다.', points: 2 },
  { id: 'manshin_momju', hero: 'manshin', label: '몸주 모시기', detail: '다음 전투를 굿상에 몸주 신령을 모신 채 시작한다.', points: 3 },
  { id: 'jaebi_garak', hero: 'jaebi', label: '가락 맞추기', detail: '다음 전투 첫 턴 장단 +2.', points: 2 },
  { id: 'jaebi_heung', hero: 'jaebi', label: '흥 돋우기', detail: '파티 귀기 −8.', points: 3 },
  { id: 'posu_watch', hero: 'posu', label: '망보기', detail: '이번 길굿 밤 습격 확률 0%.', points: 2 },
  { id: 'posu_powder', hero: 'posu', label: '화약 재기', detail: '다음 전투를 화약 2를 채운 채 시작한다.', points: 2 },
  { id: 'baksu_blade', hero: 'baksu', label: '날 세우기', detail: '다음 전투를 작두 위에서 시작한다(장단 2 미만으로 턴을 마치면 헛디딘다).', points: 2 },
  { id: 'baksu_rest', hero: 'baksu', label: '신칼 닦기', detail: '작두박수 귀기 −15, 체력 +5.', points: 3 },
  { id: 'seungnyeo_yeombul', hero: 'seungnyeo', label: '밤 염불', detail: '파티 귀기 −10.', points: 3 },
  { id: 'seungnyeo_yakson', hero: 'seungnyeo', label: '약손', detail: '체력 비율이 가장 낮은 아군 체력 +8.', points: 3 },
  { id: 'beopsa_bujeok', hero: 'beopsa', label: '부적 쓰기', detail: '다음 전투 첫 손에 화부 2장.', points: 2 },
  { id: 'beopsa_haewon', hero: 'beopsa', label: '해원경', detail: '원귀 2종의 해원 조건을 해원록에 적는다.', points: 2 },
  { id: 'talggun_nori', hero: 'talggun', label: '탈놀음', detail: '파티 귀기 −8.', points: 3 },
  { id: 'talggun_dance', hero: 'talggun', label: '덧뵈기 연습', detail: '다음 전투는 선제(첫 턴 +2장).', points: 2 },
  { id: 'chasa_ledger', hero: 'chasa', label: '적패지 펼치기', detail: '원귀 2종의 해원 조건을 해원록에 적는다.', points: 2 },
  { id: 'chasa_rope', hero: 'chasa', label: '오라 감기', detail: '다음 전투를 오라 2를 채운 채 시작한다.', points: 2 },
];

/** 무쇠 약탕관: 끼니 회복이 절반 */
function mealMult(run: Run): number {
  return run.relics.includes('musoe_yaktang') ? 0.5 : 1;
}

export function startCamp(app: AppState, room: number): void {
  const run = app.run!;
  run.dungeon.rooms[room].campUsed = true;
  run.stats.camps++;
  app.camp = { points: CAMP_POINTS, meal: false, used: [], raid: run.noNightRaid ? 0 : NIGHT_RAID, done: false, room };
  app.screen = 'camp';
  logRun(run, '길굿을 열었다.');
}

export function campActions(run: Run, camp: CampState): CampAction[] {
  const d = D();
  const out: CampAction[] = [];
  const alive = aliveIdx(run);
  const jowang = run.relics.includes('jowang');
  const mealUsed = camp.meal;
  const mm = mealMult(run);
  const pct = (base: number) => Math.round((base * mm + (run.flags.mealBonus ?? 0) * 100) * (jowang ? 2 : 1));
  out.push({
    id: 'meal_light', label: '끼니 (보통)', detail: `쌀 2: 파티 체력 ${pct(15)}% 회복, 귀기 −${jowang ? 10 : 5}.`, points: 0, rice: 2, group: 'meal',
    enabled: !mealUsed && run.supplies.rice >= 2, reason: mealUsed ? '끼니는 한 번' : run.supplies.rice < 2 ? '쌀이 모자라다' : undefined,
  });
  out.push({
    id: 'meal_full', label: '끼니 (넉넉히)', detail: `쌀 4: 파티 체력 ${pct(30)}% 회복, 귀기 −${jowang ? 20 : 10}.`, points: 0, rice: 4, group: 'meal',
    enabled: !mealUsed && run.supplies.rice >= 4, reason: mealUsed ? '끼니는 한 번' : run.supplies.rice < 4 ? '쌀이 모자라다' : undefined,
  });
  out.push({
    id: 'dwitjeon', label: '뒷전 차림', detail: '쌀 2: 잡귀를 먼저 대접해 보낸다. 밤 습격 0%.', points: 0, rice: 2, group: 'meal',
    enabled: camp.raid > 0 && run.supplies.rice >= 2, reason: camp.raid <= 0 ? '이미 습격 걱정이 없다' : '쌀이 모자라다',
  });
  const curses = run.deck.filter((c) => d.cards[c.d].isCurse).length;
  const injured = alive.filter((i) => run.heroes[i].injured).length;
  const deadUnhonored = run.heroes.filter((h, i) => h.dead && run.deck.some((c) => c.o === i && c.d === d.special.mourn)).length;
  const pts = (n: number) => camp.points >= n;
  const upgradable = upgradableIdx(run).length;
  const chain = run.relics.includes('samjichang');
  out.push({
    id: 'upgrade', label: '카드 강화', detail: '덱의 카드 1장을 강화판으로 바꾼다(한 장에 한 번).', points: 4, group: 'common',
    enabled: pts(4) && upgradable > 0 && !chain, pick: 'card-upgrade',
    reason: chain ? '삼지창 사슬: 길굿에서 강화할 수 없다' : !upgradable ? '강화할 카드가 없다' : pts(4) ? undefined : '여유가 모자라다',
  });
  out.push({ id: 'remove', label: '카드 제거', detail: '덱에서 카드 1장을 뺀다.', points: 5, group: 'common', enabled: pts(5), reason: pts(5) ? undefined : '여유가 모자라다', pick: 'card-remove' });
  const purgeCost = run.relics.includes('ssuk_dabal') ? 2 : 3;
  out.push({
    id: 'purge', label: '씌임 정화', detail: `씌임 카드 1장을 정화한다.${purgeCost < 3 ? ' (쑥 다발)' : ''}`, points: purgeCost, group: 'common', enabled: pts(purgeCost) && curses > 0,
    reason: !curses ? '씌임 카드가 없다' : pts(purgeCost) ? undefined : '여유가 모자라다', pick: 'curse',
  });
  out.push({
    id: 'bond', label: '인연 다지기', detail: '영웅 쌍의 정 +2.', points: 3, group: 'common', enabled: pts(3) && alive.length >= 2,
    reason: alive.length < 2 ? '함께할 동료가 없다' : pts(3) ? undefined : '여유가 모자라다', pick: 'pair',
  });
  out.push({
    id: 'cheondo', label: '천도굿', detail: '죽은 동료의 곡 카드를 정리하고, 가장 많이 쓴 카드를 신물(주인: 파티)로 남긴다.', points: 4, group: 'common',
    enabled: pts(4) && deadUnhonored > 0, reason: !deadUnhonored ? '천도할 동료가 없다' : pts(4) ? undefined : '여유가 모자라다', pick: 'dead',
  });
  out.push({
    id: 'injury', label: '중상 치료', detail: '영웅 하나의 중상(최대 체력 −20%)을 치료한다.', points: 4, group: 'common', enabled: pts(4) && injured > 0,
    reason: !injured ? '중상인 영웅이 없다' : pts(4) ? undefined : '여유가 모자라다', pick: 'injured',
  });
  out.push({ id: 'formation', label: '진형 다시 짜기', detail: '기본 진형(선두·중열·후열)을 바꾼다.', points: 0, group: 'common', enabled: alive.length > 1, pick: 'formation' });
  for (const a of HERO_ACTS) {
    const h = run.heroes.find((x) => x.id === a.hero);
    if (!h || h.dead) continue;
    const used = camp.used.includes(a.id);
    let enabled = !used && pts(a.points);
    let reason = used ? '이번 길굿에서 이미 했다' : pts(a.points) ? undefined : '여유가 모자라다';
    if (a.id === 'posu_watch' && camp.raid <= 0) {
      enabled = false;
      reason = '이미 습격 걱정이 없다';
    }
    out.push({ id: a.id, label: `${heroName(a.hero)} · ${a.label}`, detail: a.detail, points: a.points, hero: a.hero, group: 'hero', enabled, reason });
  }
  return out;
}

/** 대상이 필요 없는 행동, 또는 대상이 정해진 행동을 처리한다 */
export function doCampAction(app: AppState, id: string, arg?: number | [number, number]): string {
  const run = app.run!;
  const camp = app.camp!;
  const d = D();
  const act = campActions(run, camp).find((a) => a.id === id);
  if (!act || !act.enabled) return '';
  const jowang = run.relics.includes('jowang') ? 2 : 1;
  let msg = '';
  switch (id) {
    case 'meal_light':
    case 'meal_full': {
      const full = id === 'meal_full';
      run.supplies.rice -= full ? 4 : 2;
      let healed = 0;
      const frac = ((full ? 0.3 : 0.15) * mealMult(run) + (run.flags.mealBonus ?? 0)) * jowang;
      for (const h of run.heroes) if (!h.dead) healed += healHero(h, h.baseMax * frac);
      partyStress(run, -(full ? 10 : 5) * jowang);
      camp.meal = true;
      msg = `끼니를 지어 먹었다. 체력 +${healed}, 귀기 −${(full ? 10 : 5) * jowang}.`;
      break;
    }
    case 'dwitjeon':
      run.supplies.rice -= 2;
      camp.raid = 0;
      msg = '뒷전을 차려 잡귀를 먼저 보냈다. 밤 습격 0%.';
      break;
    case 'bond': {
      const [a, b] = arg as [number, number];
      addBond(run, a, b, 2);
      camp.points -= 3;
      msg = `${heroName(run.heroes[a].id)}·${heroName(run.heroes[b].id)}의 정 +2.`;
      break;
    }
    case 'injury': {
      const h = run.heroes[arg as number];
      h.injured = false;
      camp.points -= 4;
      msg = `${heroName(h.id)}의 중상을 치료했다.`;
      break;
    }
    case 'cheondo': {
      const hi = arg as number;
      const h = run.heroes[hi];
      const before = run.deck.length;
      run.deck = run.deck.filter((c) => !(c.o === hi && c.d === d.special.mourn));
      // 신물: 그 영웅이 가장 많이 쓴 카드 (주인 없는 카드로도 효과가 있는 피해·상태 카드만)
      let best: string | null = null;
      let bv = 0;
      for (const [cid, n] of Object.entries(run.stats.plays)) {
        const def = d.cardById.get(cid);
        if (!def || def.set !== h.id || def.isToken || def.isPower) continue;
        if (!def.effects.some((o) => o.op === 'dmg' || o.op === 'apply')) continue;
        if (n > bv) {
          bv = n;
          best = cid;
        }
      }
      camp.points -= 4;
      if (!run.track.cheondo.includes(hi)) run.track.cheondo.push(hi);
      msg = `${heroName(h.id)}의 천도굿을 올렸다. 곡 카드 ${before - run.deck.length}장을 정리했다. 조상신이 되었다.`;
      if (best) {
        const def = d.cardById.get(best)!;
        run.deck.push({ d: def.idx, o: -1, o2: -1, orig: -1, x: -1 });
        msg += ` 신물 「${def.name}」(주인: 파티)을 남겼다.`;
      }
      break;
    }
    case 'manshin_gongsu':
      msg = `공수가 내린다 — 방 ${scoutRooms(run, 2)}곳을 정찰했다.`;
      break;
    case 'manshin_momju':
      run.next.momju = true;
      msg = '몸주 신령을 모셨다. 다음 전투를 굿상에 신령을 모신 채 시작한다.';
      break;
    case 'jaebi_garak':
      run.next.jangdan = (run.next.jangdan ?? 0) + 2;
      msg = '가락을 맞췄다. 다음 전투 첫 턴 장단 +2.';
      break;
    case 'jaebi_heung':
    case 'talggun_nori':
      partyStress(run, -8);
      msg = '한바탕 놀았다. 파티 귀기 −8.';
      break;
    case 'posu_watch':
      camp.raid = 0;
      msg = '포수가 밤새 망을 본다. 밤 습격 0%.';
      break;
    case 'posu_powder':
      run.next.gunpowder = 2;
      msg = '화약을 재었다. 다음 전투 화약 2.';
      break;
    case 'baksu_blade':
      run.next.blade = true;
      msg = '날을 세웠다. 다음 전투를 작두 위에서 시작한다.';
      break;
    case 'baksu_rest': {
      const hi = run.heroes.findIndex((h) => h.id === 'baksu');
      addRunStress(run, hi, -15, false);
      healHero(run.heroes[hi], 5);
      msg = '신칼을 닦으며 마음을 가라앉혔다. 작두박수 귀기 −15, 체력 +5.';
      break;
    }
    case 'seungnyeo_yeombul':
      partyStress(run, -10);
      msg = '밤 염불이 길굿 위로 흐른다. 파티 귀기 −10.';
      break;
    case 'seungnyeo_yakson': {
      let best = -1;
      for (const i of aliveIdx(run)) if (best < 0 || run.heroes[i].hp / effMax(run.heroes[i]) < run.heroes[best].hp / effMax(run.heroes[best])) best = i;
      const n = healHero(run.heroes[best], 8);
      msg = `약손으로 ${heroName(run.heroes[best].id)}을(를) 돌봤다. 체력 +${n}.`;
      break;
    }
    case 'beopsa_bujeok':
      run.next.talismans = 2;
      msg = '화부 두 장을 써 두었다.';
      break;
    case 'beopsa_haewon':
    case 'chasa_ledger': {
      const ids = revealRandomHaewon(run, 2);
      msg = ids.length ? `해원록에 ${ids.map((x) => d.enemyById.get(x)?.name ?? x).join('·')}의 해원 조건을 적었다.` : '더 적을 해원 조건이 없다.';
      break;
    }
    case 'talggun_dance':
      run.next.firstStrike = true;
      msg = '덧뵈기 춤을 맞춰 두었다. 다음 전투는 선제.';
      break;
    case 'chasa_rope':
      run.next.aura = 2;
      msg = '오라를 감아 두었다. 다음 전투 오라 2.';
      break;
    default:
      return '';
  }
  if (act.group === 'hero') {
    camp.points -= act.points;
    camp.used.push(id);
  }
  logRun(run, `길굿 — ${msg}`);
  return msg;
}

/** 카드를 고르는 길굿 행동 (제거·정화)이 끝난 뒤 여유를 쓴다 */
export function spendCampPoints(app: AppState, n: number): void {
  if (app.camp) app.camp.points = Math.max(0, app.camp.points - n);
}

/** 길굿을 마친다 → 밤 습격 판정. 습격이면 true */
export function leaveCamp(app: AppState): boolean {
  const run = app.run!;
  const camp = app.camp!;
  camp.done = true;
  const raid = rand(run) < camp.raid;
  app.camp = null;
  return raid;
}

export function campPick(run: Run, camp: CampState, id: string): CampAction | undefined {
  return campActions(run, camp).find((a) => a.id === id);
}
