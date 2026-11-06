// 기물·방 이벤트·덫 (탐험 §7·§8, 첫 지역 §5): 세 갈래 손대기(맨손 / 맞는 보급품 / 영웅 고유)와 선택지.

import { rand } from '../../../src/core/rng.ts';
import { eopgyeong, knotPresetBits, roadStep } from '../../../src/core/regions.ts';
import type { HeroId } from '../../../src/core/types.ts';
import { CURIO_BY_ID, D, ENEMY_EXTRA, EVENT_BY_ID, RELIC_BY_ID, TRAP_BY_ID, enemyRegion, type SupplyId } from './content.ts';
import { corridorsOf } from './dungeon.ts';
import {
  addCurse, aliveIdx, bossEnemyIds, effMax, healHero, heroName, logRun, partyStress, revealAllRooms, revealHaewon, revealNear, revealRandomHaewon, scoutAround,
  scoutRooms, supplyUse, upgradableIdx,
} from './run.ts';
import { applyRelicGain, rollCards, rollRelics } from './rewards.ts';
import type { AppState, Corridor, DialogState, Run } from './types.ts';

export const ITEM_ID: Record<string, SupplyId> = { 촛불: 'candle', 쌀: 'rice', 향: 'incense', 지전: 'jijeon', 부적: 'bujeok', 술: 'sul' };

export interface DOpt {
  id: string;
  label: string;
  detail: string;
  kind: 'bare' | 'supply' | 'hero' | 'choice' | 'leave';
  enabled: boolean;
  reason?: string;
  hero?: HeroId;
  cost?: string;
}

function hasHero(run: Run, id: HeroId): boolean {
  return run.heroes.some((h) => h.id === id && !h.dead);
}

/** 대문 통행(문사재 문답 「인정을 쓴다」): 문신의 가호 지전 −1, 통행패로 무료 */
function gateCost(run: Run, cost: string | undefined): string | undefined {
  if (!cost || !cost.startsWith('지전')) return cost;
  if ((run.flags.gateFree ?? 0) > 0) return undefined;
  const n = Number(cost.match(/(\d+)/)?.[1] ?? 0) - (run.relics.includes('munsin') ? 1 : 0);
  return n > 0 ? `지전 ${n}` : undefined;
}

function costOk(run: Run, cost: string | undefined): boolean {
  if (!cost) return true;
  for (const part of cost.split(',')) {
    const m = part.trim().match(/^(\S+)\s*(\d+)$/);
    if (!m) continue;
    const id = ITEM_ID[m[1]];
    if (id && (run.supplies[id] ?? 0) < Number(m[2])) return false;
  }
  return true;
}

function payCost(run: Run, cost: string | undefined): void {
  if (!cost) return;
  for (const part of cost.split(',')) {
    const m = part.trim().match(/^(\S+)\s*(\d+)$/);
    if (!m) continue;
    const id = ITEM_ID[m[1]];
    if (id) supplyUse(run, id, Number(m[2]));
  }
}

function pairs(run: Run): [number, number][] {
  const a = aliveIdx(run);
  const out: [number, number][] = [];
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) out.push([a[i], a[j]]);
  return out;
}

export function bondKey(run: Run, a: number, b: number): string {
  return [run.heroes[a].id, run.heroes[b].id].sort().join('+');
}

export function addBond(run: Run, a: number, b: number, n: number): void {
  if (a < 0 || b < 0 || a === b) return;
  const k = bondKey(run, a, b);
  run.bonds[k] = (run.bonds[k] ?? 0) + n;
  // 캠페인 결산: 파티 index 쌍으로 넘긴다
  const pk = [a, b].sort().join('+');
  if (run.track) run.track.bondPairs[pk] = (run.track.bondPairs[pk] ?? 0) + n;
}

// ── 선택지 ───────────────────────────────────────────────────────────
export function dialogTitle(dlg: DialogState): string {
  if (dlg.kind === 'curio') return CURIO_BY_ID.get(dlg.id)?.name ?? dlg.id;
  if (dlg.kind === 'event') return EVENT_BY_ID.get(dlg.id)?.name ?? dlg.id;
  return `덫 — ${TRAP_BY_ID.get(dlg.id)?.name ?? dlg.id}`;
}

export function dialogSetup(dlg: DialogState): string {
  if (dlg.kind === 'curio') return '손을 대 볼까. 맨손으로, 맞는 보급품으로, 또는 동료의 솜씨로.';
  if (dlg.kind === 'event') return EVENT_BY_ID.get(dlg.id)?.setup ?? '';
  const t = TRAP_BY_ID.get(dlg.id);
  return t ? `발밑에 덫이 보인다. 밟으면: ${t.effect}.` : '';
}

export function dialogOptions(run: Run, dlg: DialogState): DOpt[] {
  const out: DOpt[] = [];
  if (dlg.kind === 'curio') {
    const c = CURIO_BY_ID.get(dlg.id)!;
    out.push({ id: 'bare', label: '맨손', detail: c.bare, kind: 'bare', enabled: true });
    if (c.provision) {
      const item = ITEM_ID[c.provision.item];
      const noUpgrade = c.provision.result.includes('강화') && !upgradableIdx(run).length;
      out.push({
        id: 'supply', label: `${c.provision.item} 1`, detail: c.provision.result, kind: 'supply', cost: `${c.provision.item} 1`,
        enabled: !noUpgrade && (run.supplies[item] ?? 0) > 0,
        reason: noUpgrade ? '강화할 카드가 없다' : (run.supplies[item] ?? 0) > 0 ? undefined : `${c.provision.item}이(가) 없다`,
      });
    } else out.push({ id: 'supply', label: '맞는 보급품 없음', detail: '이 기물에 맞는 보급품은 없다.', kind: 'supply', enabled: false, reason: '해당 없음' });
    const hid = c.hero.archetype;
    out.push({
      id: 'hero', label: heroName(hid), detail: c.hero.result, kind: 'hero', hero: hid,
      enabled: hasHero(run, hid), reason: hasHero(run, hid) ? undefined : `파티에 ${heroName(hid)}이(가) 없다`,
    });
    out.push({ id: 'leave', label: '손대지 않는다', detail: '나중에 다시 올 수 있다.', kind: 'leave', enabled: true });
    return out;
  }
  if (dlg.kind === 'event') {
    const ev = EVENT_BY_ID.get(dlg.id)!;
    ev.choices.forEach((ch, i) => {
      const req = ch.requires;
      const reqOk = !req || hasHero(run, req);
      const ok = reqOk && costOk(run, ch.cost);
      if (dlg.id === 'tteooreun_neok' && i === 0) {
        // 영웅 쌍을 고른다 → 쌍마다 선택지
        for (const [a, b] of pairs(run)) {
          out.push({
            id: `c0:${a}:${b}`, label: `${ch.label} — ${heroName(run.heroes[a].id)}·${heroName(run.heroes[b].id)}`, detail: ch.result, kind: 'choice', cost: ch.cost,
            enabled: ok, reason: ok ? undefined : '쌀 1·향 1이 필요하다',
          });
        }
        return;
      }
      const cost = (dlg.id === 'munsajae_mundap' || dlg.id === 'daemun_tonghaeng') && i === 0 ? gateCost(run, ch.cost) : ch.cost;
      const ok2 = reqOk && costOk(run, cost);
      out.push({
        id: `c${i}`, label: ch.label, detail: simplifiedEventResult(dlg.id, i, ch.result), kind: req ? 'hero' : 'choice', hero: req, cost, enabled: ok2,
        reason: !reqOk ? `파티에 ${heroName(req!)}이(가) 없다` : !ok2 ? `${cost}이(가) 필요하다` : undefined,
      });
    });
    return out;
  }
  // 덫 (미리 보인 덫만 선택지가 있다)
  const t = TRAP_BY_ID.get(dlg.id)!;
  for (const part of t.disarm.split('또는')) {
    const m = part.trim().match(/^(\S+)\s*(\d+)$/);
    if (!m) continue;
    const id = ITEM_ID[m[1]];
    out.push({
      id: `disarm:${id}`, label: `${m[1]} ${m[2]}로 해체`, detail: '덫을 안전하게 걷어낸다.', kind: 'supply', cost: `${m[1]} ${m[2]}`,
      enabled: (run.supplies[id] ?? 0) >= Number(m[2]), reason: (run.supplies[id] ?? 0) >= Number(m[2]) ? undefined : `${m[1]}이(가) 없다`,
    });
  }
  out.push({ id: 'careful', label: '조심해서 지나간다', detail: '50%로 덫을 밟는다.', kind: 'bare', enabled: true });
  return out;
}

function simplifiedEventResult(id: string, i: number, text: string): string {
  if (id === 'saja_geommun' && i === 2) return `놀이 싸움: 놀이 사자 셋. 영웅이 받는 피해는 체력 대신 귀기로 들어간다(쓰러지지 않는다). ${'5'}턴 안에 이기면 통과 + 엽전 20, 못 이기면 귀기 +15 후 통과.`;
  if (id === 'jalmot_on_saram' && i === 0) return '호위: 잘못 끌려온 사람(체력 20)이 파티 뒤를 따른다. 선두에 방어도가 없으면 선두를 노린 공격을 그 사람이 맞는다. 세 턴을 버티거나 잡귀를 모두 쓰러뜨리면 성공(치성 +1), 그 사람이 쓰러지면 실패(귀기 +10).';
  if (id === 'munsajae_mundap' && i === 0) return text;
  return text;
}

// ── 결과 ─────────────────────────────────────────────────────────────
function curse(run: Run, lines: string[]): void {
  lines.push(addCurse(run));
}

function relicChance(run: Run, lines: string[], p: number): void {
  if (rand(run) < p) {
    const id = rollRelics(run, ['일반'], 1)[0];
    if (id) {
      run.relics.push(id);
      applyRelicGain(run, id);
      lines.push(`가호 「${RELIC_BY_ID.get(id)!.name}」을(를) 받았다 — ${RELIC_BY_ID.get(id)!.effect}`);
    }
  }
}

function revealText(ids: string[]): string {
  if (!ids.length) return '새로 알게 된 해원 조건이 없다(이미 해원록에 있다).';
  return ids.map((id) => {
    const e = ENEMY_EXTRA.get(id)!;
    return `해원록 — ${e.name}: ${e.haewon?.rule ?? ''}`;
  }).join(' / ');
}

function addHiddenLoop(run: Run): boolean {
  const dg = run.dungeon;
  if (run.pos.kind !== 'room') return false;
  const r = dg.rooms[run.pos.room];
  for (const o of dg.rooms) {
    if (o.id === r.id || o.kind === 'boss') continue;
    if (Math.abs(o.x - r.x) + Math.abs(o.y - r.y) !== 1) continue;
    if (corridorsOf(dg, r.id).some((c) => c.a === o.id || c.b === o.id)) continue;
    const c: Corridor = { id: dg.corridors.length, a: r.id, b: o.id, tiles: [0, 1, 2].map(() => ({ content: { k: 'empty' }, walked: false, known: true })) };
    dg.corridors.push(c);
    o.known = true;
    return true;
  }
  return false;
}

export function chooseDialog(app: AppState, optId: string): void {
  const run = app.run!;
  const dlg = app.dialog!;
  const opt = dialogOptions(run, dlg).find((o) => o.id === optId);
  if (!opt || !opt.enabled) return;
  const lines: string[] = [];
  let then: DialogState['then'] = 'none';
  let done = true;
  if (dlg.kind === 'curio') {
    run.stats.curios++;
    if (optId === 'leave') {
      app.dialog = null;
      return;
    }
    if (optId === 'supply') payCost(run, opt.cost);
    const r = rand(run);
    switch (`${dlg.id}:${optId}`) {
      case 'seonang_dol:bare':
        if (r < 0.6) {
          run.next.jangdan = (run.next.jangdan ?? 0) + 1;
          lines.push('돌이 단단히 얹혔다. 다음 전투 첫 턴 장단 +1.');
        } else {
          partyStress(run, 5);
          lines.push('돌이 굴러떨어졌다. 파티 귀기 +5.');
        }
        break;
      case 'seonang_dol:supply':
        lines.push('술을 올려 공양했다. 덱의 카드 한 장을 강화할 수 있다.');
        then = 'upgrade';
        break;
      case 'seonang_dol:hero':
        lines.push(`만신이 신탁을 받는다 — 방 ${scoutRooms(run, 2)}곳을 정찰했다.`);
        break;
      case 'beorin_sangyeo:bare':
        if (r < 0.5) {
          run.gold += 20;
          run.materials += 1;
          lines.push('상여 밑에서 엽전 20과 재료 1을 찾았다.');
        } else if (r < 0.8) {
          lines.push('상여 곁에서 곡소리 넋이 일어선다!');
          then = 'battle';
          dlg.battleEnc = 'ev_goksori';
        } else {
          lines.push('상여의 한이 옮아붙었다.');
          curse(run, lines);
        }
        break;
      case 'beorin_sangyeo:supply':
        for (const [a, b] of pairs(run)) addBond(run, a, b, 1);
        lines.push('지전을 사르며 넋을 위로했다. 파티 모든 쌍의 정 +1.');
        relicChance(run, lines, 0.3);
        break;
      case 'beorin_sangyeo:hero':
        partyStress(run, -10);
        lines.push('승려의 염불이 상여 위로 흐른다. 파티 귀기 −10.');
        break;
      case 'mulga_mudeom:bare':
        run.materials += 2;
        partyStress(run, 10);
        lines.push('흙을 헤쳐 재료 2를 얻었다. 파티 귀기 +10.');
        if (r < 0.25) curse(run, lines);
        break;
      case 'mulga_mudeom:supply':
        lines.push('술을 올렸다. 카드 한 장을 같은 영웅의 다른 카드로 바꿀 수 있다.');
        then = 'transform';
        break;
      case 'mulga_mudeom:hero':
        lines.push(`차사가 명부를 확인한다. ${revealText(revealRandomHaewon(run, 1))}`);
        break;
      case 'jangseung:bare':
        revealNear(run, 2);
        lines.push('장승에 새겨진 이정을 읽었다. 가까운 방들이 드러난다.');
        break;
      case 'jangseung:supply':
        lines.push(addHiddenLoop(run) ? '향 연기가 숨은 길목 하나를 드러낸다.' : '숨은 길은 없었다.');
        if (run.pos.kind === 'room') scoutAround(run, run.pos.room);
        lines.push('이웃한 방과 길목을 정찰했다.');
        break;
      case 'jangseung:hero':
        lines.push('탈꾼이 장승 흉내를 낸다. 진형을 자유롭게 다시 짠다.');
        then = 'formation';
        break;
      case 'binbae:bare':
        if (r < 0.5) {
          run.gold += 15;
          lines.push('배 바닥에서 엽전 15를 찾았다.');
        } else {
          const front = run.formation.find((i) => !run.heroes[i].dead) ?? aliveIdx(run)[0];
          run.next.wounds.push(front);
          lines.push(`물속에 끌려 들어갈 뻔했다. ${heroName(run.heroes[front].id)}: 다음 전투에 상처 카드 1장.`);
        }
        break;
      case 'binbae:supply': {
        const ids = run.bossEnc ? revealHaewon(run, bossEnemyIds(run)) : revealRandomHaewon(run, 2);
        lines.push(`노잣돈 자리에 지전을 놓았다. ${revealText(ids)}`);
        break;
      }
      case 'binbae:hero':
        run.materials += 2;
        lines.push('포수가 배 밑을 살펴 젖은 넋전 2를 건졌다.');
        break;
      case 'neokjeon_deomi:bare':
        if (r < 0.4) {
          lines.push('넋전 사이에서 기억 하나가 떠오른다. 카드 3장 중 1장을 고른다.');
          then = 'cards';
          dlg.cardOptions = rollCards(run, 'normal').slice(0, 3);
        } else {
          partyStress(run, 8);
          lines.push('젖은 넋전이 손에 감긴다. 파티 귀기 +8.');
        }
        break;
      case 'neokjeon_deomi:supply':
        lines.push('부적으로 정화했다. 덱에서 카드 한 장을 뺄 수 있다.');
        then = 'remove';
        break;
      case 'neokjeon_deomi:hero': {
        const before = run.deck.length;
        run.deck = run.deck.filter((c) => !D().cards[c.d].isCurse);
        lines.push(`법사가 해원경을 읽는다. 씌임 카드 ${before - run.deck.length}장을 모두 정화했다.`);
        break;
      }
      case 'gutsang_janhae:bare':
        run.supplies.rice += 2;
        lines.push('남은 음식을 거뒀다. 쌀 +2.');
        if (r < 0.3) curse(run, lines);
        break;
      case 'gutsang_janhae:supply':
        run.supplies.rice += 3;
        lines.push('부정을 가시고 쌀 3을 안전하게 거뒀다.');
        break;
      case 'gutsang_janhae:hero':
        run.noNightRaid = true;
        lines.push('잽이가 뒷전 장단을 친다. 이번 원정 밤 습격 확률 0%.');
        break;
      case 'mangja_botjim:bare':
        if (r < 0.5) {
          const g = 10 + Math.floor(rand(run) * 16);
          run.gold += g;
          lines.push(`봇짐에서 엽전 ${g}을(를) 찾았다.`);
        } else {
          const ids: SupplyId[] = ['candle', 'rice', 'incense', 'jijeon', 'bujeok', 'sul'];
          const id = ids[Math.floor(rand(run) * ids.length)];
          run.supplies[id]++;
          lines.push(`봇짐에서 보급품을 찾았다: ${({ candle: '촛불', rice: '쌀', incense: '향', jijeon: '지전', bujeok: '부적', sul: '술' } as const)[id]} +1.`);
        }
        break;
      case 'mangja_botjim:hero':
        run.materials += 1;
        lines.push(`작두박수가 신칼로 매듭을 끊었다. 재료 +1.${upgradableIdx(run, 'baksu').length ? ' 작두박수 카드 한 장을 강화할 수 있다.' : ' (강화할 작두박수 카드가 없다)'}`);
        if (upgradableIdx(run, 'baksu').length) then = 'upgrade_baksu';
        break;
      default: {
        const r = regionCurio(app, run, dlg, optId, rand(run), lines);
        then = r.then;
        done = r.done;
      }
    }
  } else if (dlg.kind === 'event') {
    run.stats.events++;
    const ev = EVENT_BY_ID.get(dlg.id)!;
    let idx = Number(optId.slice(1).split(':')[0]);
    if (Number.isNaN(idx)) idx = 0;
    const ch = ev.choices[idx];
    if ((dlg.id === 'munsajae_mundap' || dlg.id === 'daemun_tonghaeng') && idx === 0) {
      const c = gateCost(run, ch.cost);
      if (!c && (run.flags.gateFree ?? 0) > 0) run.flags.gateFree! -= 1;
      payCost(run, c);
    } else payCost(run, ch.cost);
    switch (`${dlg.id}:${idx}`) {
      case 'saja_geommun:0':
        run.next.firstStrike = true;
        lines.push('인정을 쓰자 사자들이 길을 비킨다. 다음 전투는 선제.');
        break;
      case 'saja_geommun:1': {
        const ci = run.heroes.findIndex((h) => h.id === 'chasa' && !h.dead);
        for (const j of aliveIdx(run)) if (j !== ci) addBond(run, ci, j, 1);
        lines.push('차사가 옛 동료들에게 말을 건넨다. 무료로 통과, 차사와 파티원 각각 정 +1.');
        break;
      }
      case 'saja_geommun:2':
        lines.push('"그럼 한판 놀아 보세!" 사자들이 소매를 걷는다.');
        then = 'battle';
        dlg.battleEnc = 'ev_play';
        dlg.battleSpecial = 'play';
        done = false;
        break;
      case 'tteooreun_neok:0': {
        const [, a, b] = optId.split(':').map(Number);
        addBond(run, a, b, 2);
        lines.push(`넋을 건져 고이 보냈다. ${heroName(run.heroes[a].id)}·${heroName(run.heroes[b].id)}의 정 +2.`);
        relicChance(run, lines, 0.3);
        break;
      }
      case 'tteooreun_neok:1':
        lines.push('넋전은 물살을 따라 멀어졌다.');
        break;
      case 'jalmot_on_saram:0':
        lines.push('잡귀 무리가 산 사람의 냄새를 맡고 몰려든다. 세 턴을 버텨라!');
        then = 'battle';
        dlg.battleEnc = 'ev_escort';
        dlg.battleSpecial = 'escort';
        break;
      case 'jalmot_on_saram:1':
        run.gold += 15;
        lines.push('향을 피워 길을 알려 주었다. 고마움의 표시로 엽전 15.');
        break;
      case 'seonang_gogae:0':
        revealAllRooms(run);
        lines.push('공수가 내린다. 남은 방이 모두 보인다.');
        break;
      case 'seonang_gogae:1':
        lines.push(`향을 올렸다. 방 ${scoutRooms(run, 2)}곳을 정찰했다.`);
        break;
      case 'seonang_gogae:2':
        partyStress(run, -5);
        lines.push('돌을 얹고 고개를 넘는다. 파티 귀기 −5.');
        break;
      case 'heotgut:0':
        run.threshold += 10;
        lines.push('잽이가 장단을 맞춰 주자 잡귀들이 흥에 겨워 흩어진다. 이번 원정 씌임 임계치 +10.');
        break;
      case 'heotgut:1':
        run.threshold += 5;
        lines.push('상을 차려 대접했다. 이번 원정 씌임 임계치 +5.');
        break;
      case 'heotgut:2':
        lines.push('잡귀 넷이 판을 엎고 덤벼든다!');
        then = 'battle';
        dlg.battleEnc = 'ev_heotgut';
        break;
      case 'nanutbae:0':
        lines.push(`지전을 놓자 빈 배가 삐걱이며 옛 이야기를 들려준다. ${revealText(revealHaewon(run, bossEnemyIds(run)))} 보스전 첫 턴 드로우 +1.`);
        run.next.drawBonus = (run.next.drawBonus ?? 0) + 1;
        break;
      case 'nanutbae:1':
        lines.push('배를 지나친다.');
        break;
      default: {
        const r = regionEvent(app, run, dlg, idx, optId, lines);
        then = r.then;
        done = r.done;
      }
    }
  } else {
    // 덫
    run.stats.traps++;
    if (optId.startsWith('disarm:')) {
      payCost(run, opt.cost);
      lines.push('덫을 걷어냈다.');
    } else if (rand(run) < 0.5) {
      lines.push(...springTrap(run, dlg.id));
    } else lines.push('조심조심 덫을 비켜 지났다.');
  }
  if (done) markHere(run);
  dlg.result = lines.join('\n');
  dlg.then = then;
  logRun(run, `${dialogTitle(dlg)}: ${lines[0] ?? ''}`);
}

export function springTrap(run: Run, id: string): string[] {
  const lines: string[] = [];
  switch (id) {
    case 'jeojeun_balmok': {
      const front = run.formation.find((i) => !run.heroes[i].dead) ?? aliveIdx(run)[0];
      run.next.wounds.push(front);
      lines.push(`젖은 발목! ${heroName(run.heroes[front].id)}: 다음 전투에 상처 카드 1장(사용 불가, 전투가 끝나면 사라짐).`);
      break;
    }
    case 'eongkin_neokjul':
      run.next.shuffle = true;
      lines.push('엉킨 넋줄! 다음 전투 시작 시 진형이 섞인다.');
      break;
    case 'goksori_meari':
      partyStress(run, 10);
      lines.push('곡소리 메아리! 파티 귀기 +10.');
      break;
    // 지역 2
    case 'yeolgi_golmok': {
      if (run.relics.includes('ssarimal')) {
        lines.push('열기 서린 골목 — 싸리말이 열기를 막아 섰다.');
        break;
      }
      const front = frontIdx(run);
      (run.next.fevers ??= []).push(front);
      lines.push(`열기 서린 골목! ${heroName(run.heroes[front].id)}: 다음 전투 시작 시 신열 1장.`);
      break;
    }
    case 'muneojin_damjang': {
      const front = frontIdx(run);
      run.next.shuffle = true;
      run.next.wounds.push(front);
      lines.push(`무너진 담장! 다음 전투 시작 시 진형이 섞이고 ${heroName(run.heroes[front].id)}에게 상처 카드 1장.`);
      break;
    }
    case 'eopeojin_yaksabal':
      run.next.weakAll = (run.next.weakAll ?? 0) + 1;
      lines.push('엎어진 약사발! 다음 전투 첫 턴 파티 약화 1.');
      break;
    // 지역 3
    case 'dachineun_daemun':
      run.next.ambush = true;
      lines.push('닫히는 대문! 다음 전투는 기습당한다.');
      break;
    case 'eopgyeong_papyeon': {
      const front = frontIdx(run);
      addRunStressSafe(run, front, 15);
      lines.push(`업경대 파편에 제 업이 비쳤다. ${heroName(run.heroes[front].id)} 귀기 +15.`);
      break;
    }
    case 'musoe_bitjang_trap': {
      const front = frontIdx(run);
      run.next.wounds.push(front);
      lines.push(`무쇠 빗장! ${heroName(run.heroes[front].id)}: 다음 전투에 상처 카드 1장.`);
      break;
    }
  }
  return lines;
}

function frontIdx(run: Run): number {
  return run.formation.find((i) => !run.heroes[i].dead) ?? aliveIdx(run)[0];
}

function addRunStressSafe(run: Run, hi: number, n: number): void {
  partyStressOne(run, hi, n);
}

function partyStressOne(run: Run, hi: number, n: number): void {
  const h = run.heroes[hi];
  if (!h || h.dead) return;
  h.stress = Math.max(0, Math.min(100, h.stress + n));
  if (h.stress >= 50 + run.threshold && h.stress - n < 50 + run.threshold) addCurse(run, hi);
}

function healAll(run: Run, frac: number): number {
  let n = 0;
  for (const h of run.heroes) if (!h.dead) n += healHero(h, h.baseMax * frac);
  return n;
}

function revealFamily(run: Run, family: string, n = 99): string[] {
  const ids = [...ENEMY_EXTRA.values()].filter((e) => e.family === family && e.haewon && enemyRegion(e.id) === run.region && !run.revealed.includes(e.id)).map((e) => e.id);
  return revealHaewon(run, ids.slice(0, n));
}

function purgeCurses(run: Run): number {
  const before = run.deck.length;
  run.deck = run.deck.filter((c) => !D().cards[c.d].isCurse);
  return before - run.deck.length;
}

function bondAll(run: Run, n: number): void {
  for (const [a, b] of pairs(run)) addBond(run, a, b, n);
}

const SUPPLY_NAME_KO: Record<SupplyId, string> = { candle: '촛불', rice: '쌀', incense: '향', jijeon: '지전', bujeok: '부적', sul: '술' };

/** 지역 2·3 기물 (05-region2 §5 · 05-region3 §5) */
function regionCurio(app: AppState, run: Run, dlg: DialogState, optId: string, r: number, lines: string[]): { then: DialogState['then']; done: boolean } {
  let then: DialogState['then'] = 'none';
  const key = `${dlg.id}:${optId}`;
  switch (key) {
    // ── 지역 2 ──
    case 'munjeon_bujeok:bare':
      if (r < 0.5) {
        run.supplies.bujeok++;
        lines.push('빛바랜 부적 아래 새 부적이 하나 끼어 있었다. 부적 +1.');
      } else {
        (run.next.fevers ??= []).push(frontIdx(run));
        lines.push('떼어 낸 자리에서 열기가 번진다. 다음 전투 신열 1장.');
      }
      break;
    case 'munjeon_bujeok:supply':
      for (const c of run.dungeon.corridors) for (const t of c.tiles) if (t.content.k === 'trap' && t.content.id === 'yeolgi_golmok') t.known = true;
      lines.push('향을 피워 새로 붙였다. 이번 원정의 「열기 서린 골목」을 모두 미리 본다.');
      break;
    case 'munjeon_bujeok:hero':
      run.next.fevers = [];
      run.next.talismans = (run.next.talismans ?? 0) + 1;
      lines.push('법사가 부적을 새로 써 붙였다. 다가올 신열을 걷어 내고, 다음 전투 첫 손에 화부 1장.');
      break;
    case 'sigeun_yaktang:bare':
      if (r < 0.5) {
        partyStress(run, -10);
        lines.push('남은 약이 아직 따뜻했다. 파티 귀기 −10.');
      } else {
        run.next.weakAll = (run.next.weakAll ?? 0) + 1;
        lines.push('약이 쉬어 있었다. 다음 전투 첫 턴 파티 약화 1.');
      }
      break;
    case 'sigeun_yaktang:supply':
      run.flags.mealBonus = (run.flags.mealBonus ?? 0) + 0.1;
      lines.push('약술을 담갔다. 이번 원정 길굿 끼니 회복 +10%p.');
      break;
    case 'sigeun_yaktang:hero':
      run.next.fevers = [];
      lines.push('만신이 공수로 처방을 받는다. 신열을 걷어 내고 카드 한 장을 강화할 수 있다.');
      if (upgradableIdx(run).length) then = 'upgrade';
      break;
    case 'ssarimal_curio:bare':
      if (r < 0.5) {
        run.gold += 15;
        lines.push('싸리말 안장 밑에서 엽전 15.');
      } else {
        partyStress(run, 8);
        lines.push('싸리말이 삐걱이며 무너졌다. 파티 귀기 +8.');
      }
      break;
    case 'ssarimal_curio:supply':
      run.flags.sonnimStart = Math.max(run.flags.sonnimStart ?? 0, 4);
      lines.push('술을 손님상에 올려 두었다. 이번 원정의 손님 배웅을 대접 +4로 시작한다.');
      break;
    case 'ssarimal_curio:hero':
      run.next.jangdan = (run.next.jangdan ?? 0) + 1;
      lines.push('탈꾼이 말놀이를 한다. 진형을 자유롭게 바꾸고, 다음 전투 첫 턴 장단 +1.');
      then = 'formation';
      break;
    case 'geumjul_jip:bare':
      run.materials += 2;
      partyStress(run, 8);
      lines.push('금줄을 넘었다. 재료 +2, 파티 귀기 +8.');
      if (r < 0.3) curse(run, lines);
      break;
    case 'geumjul_jip:supply':
      if (r < 0.3) relicChance(run, lines, 1);
      else {
        run.gold += 20;
        lines.push('금줄을 거두고 부적을 붙였다. 집주인 넋이 엽전 20을 내놓았다.');
      }
      break;
    case 'geumjul_jip:hero':
      lines.push(`차사가 명부를 확인한다. ${revealText([...revealRandomHaewon(run, 1), ...revealHaewon(run, ['bonghanjip_neok'])])}`);
      break;
    case 'maeul_sangyeojip:bare':
      if (r < 0.5) {
        run.gold += 25;
        lines.push('상엿집 구석에서 엽전 25.');
      } else if (r < 0.8) {
        lines.push('상엿집에서 상문 잡귀가 곡을 흉내 내며 일어선다!');
        then = 'battle';
        dlg.battleEnc = 'ev_sangmun';
      } else curse(run, lines);
      break;
    case 'maeul_sangyeojip:supply':
      partyStress(run, -10);
      lines.push('향을 올려 넋을 위로했다. 파티 귀기 −10.');
      relicChance(run, lines, 0.3);
      break;
    case 'maeul_sangyeojip:hero':
      bondAll(run, 1);
      run.next.jangdan = (run.next.jangdan ?? 0) + 2;
      lines.push('잽이가 상엿소리를 메긴다. 파티 모든 쌍 정 +1, 다음 전투 첫 턴 장단 +2.');
      break;
    case 'umulga_durebak:bare':
      if (r < 0.6) lines.push(`맑은 물이다. 체력 +${healAll(run, 0.08)}.`);
      else {
        (run.next.fevers ??= []).push(frontIdx(run));
        lines.push('물이 미지근하다. 다음 전투 신열 1장.');
      }
      break;
    case 'umulga_durebak:supply':
      lines.push(`부적으로 우물을 정화했다. 체력 +${healAll(run, 0.12)}.`);
      break;
    case 'umulga_durebak:hero':
      partyStress(run, -10);
      run.next.fevers = [];
      lines.push('승려가 우물에 염불한다. 파티 귀기 −10, 신열을 걷어 냈다.');
      break;
    case 'jangteo_jwapan:bare':
      if (r < 0.5) {
        const g = 15 + Math.floor(rand(run) * 16);
        run.gold += g;
        lines.push(`좌판 밑에서 엽전 ${g}.`);
      } else {
        const ids: SupplyId[] = ['candle', 'rice', 'incense', 'jijeon', 'bujeok', 'sul'];
        const id = ids[Math.floor(rand(run) * ids.length)];
        run.supplies[id]++;
        lines.push(`버려진 좌판에서 ${SUPPLY_NAME_KO[id]} +1.`);
      }
      break;
    case 'jangteo_jwapan:hero': {
      run.materials += 2;
      if (run.pos.kind === 'room') for (const c of corridorsOf(run.dungeon, run.pos.room)) for (const t of c.tiles) if (t.content.k === 'trap') t.known = true;
      lines.push('포수가 덫을 살폈다. 재료 +2, 이웃한 길목의 덫이 드러났다.');
      break;
    }
    case 'alteon_bang:bare':
      if (r < 0.4) {
        lines.push('앓던 이가 남긴 물건에서 기억 하나가 떠오른다. 카드 3장 중 1장을 고른다.');
        then = 'cards';
        dlg.cardOptions = rollCards(run, 'normal').slice(0, 3);
      } else {
        const f = frontIdx(run);
        (run.next.fevers ??= []).push(f, f);
        partyStress(run, 5);
        lines.push('방에 열기가 가득하다. 다음 전투 신열 2장, 파티 귀기 +5.');
      }
      break;
    case 'alteon_bang:supply':
      lines.push('방을 정화했다. 덱에서 카드 한 장을 뺄 수 있다.');
      then = 'remove';
      break;
    case 'alteon_bang:hero':
      lines.push(`작두박수가 신칼로 부정을 가른다. ${revealText(revealFamily(run, '역귀', 1))}`);
      if (upgradableIdx(run, 'baksu').length) then = 'upgrade_baksu';
      break;
    // ── 지역 3 ──
    case 'munsajae_choso:bare':
      if (r < 0.5) {
        run.supplies.jijeon += 2;
        lines.push('통행패 사이에 지전 2.');
      } else {
        partyStress(run, 10);
        lines.push('빈 초소에 사자들의 심술이 남아 있었다. 파티 귀기 +10.');
      }
      break;
    case 'munsajae_choso:supply':
      run.next.firstStrike = true;
      lines.push('인정을 놓아 두었다. 다음 전투는 선제.');
      break;
    case 'munsajae_choso:hero':
      run.flags.gateFree = (run.flags.gateFree ?? 0) + 1;
      lines.push(`차사가 옛 동료의 통행패를 꺼낸다. 다음 대문 통행 무료 + 방 ${scoutRooms(run, 2)}곳 정찰.`);
      break;
    case 'sajasang_heunjeok:bare':
      run.gold += 20;
      lines.push('사자상 앞에 남은 엽전 20을 주웠다.');
      if (r < 0.3) curse(run, lines);
      break;
    case 'sajasang_heunjeok:supply':
      bondAll(run, 1);
      lines.push(`사자밥을 다시 차렸다. 파티 모든 쌍 정 +1. ${revealText(revealHaewon(run, ['maenap_neok']))}`);
      break;
    case 'sajasang_heunjeok:hero':
      partyStress(run, -15);
      lines.push('탈꾼이 사자상 앞에서 말뚝이 재담을 한다. 파티 귀기 −15.');
      break;
    case 'eopgyeong_jogak:bare':
      if (r < 0.5) lines.push(`조각에 원귀 하나가 비친다. ${revealText(revealRandomHaewon(run, 1))}`);
      else {
        partyStress(run, 15);
        lines.push('조각에 제 업이 비쳤다. 파티 귀기 +15.');
      }
      break;
    case 'eopgyeong_jogak:supply':
      lines.push('향으로 닦았다. 카드 한 장을 강화할 수 있다.');
      if (upgradableIdx(run).length) then = 'upgrade';
      break;
    case 'eopgyeong_jogak:hero':
      lines.push(`만신이 비친 업을 공수로 읽는다. ${revealText(revealRandomHaewon(run, 2))}`);
      break;
    case 'yaksu_saem:bare':
      if (r < 0.5) lines.push(`맑은 약수다. 체력 +${healAll(run, 0.12)}.`);
      else {
        partyStress(run, 10);
        lines.push('물이 차갑게 넋을 흔든다. 파티 귀기 +10.');
      }
      break;
    case 'yaksu_saem:supply':
      lines.push(`정성을 들여 길었다. 체력 +${healAll(run, 0.2)}.`);
      break;
    case 'yaksu_saem:hero': {
      const inj = run.heroes.find((h) => !h.dead && h.injured);
      if (inj) inj.injured = false;
      lines.push(`승려가 염불하고 길었다.${inj ? ` ${heroName(inj.id)}의 중상이 나았다.` : ''} 체력 +${healAll(run, 0.15)}.`);
      break;
    }
    case 'muneojin_seongmun:bare':
      run.materials += 1;
      run.gold += 15;
      lines.push('잔해에서 재료 1과 엽전 15.');
      if (r < 0.3) curse(run, lines);
      break;
    case 'muneojin_seongmun:supply':
      if (r < 0.3) {
        const id = rollRelics(run, ['고급'], 1)[0];
        if (id) {
          run.relics.push(id);
          applyRelicGain(run, id);
          lines.push(`봉인이 풀리며 가호 「${RELIC_BY_ID.get(id)!.name}」 — ${RELIC_BY_ID.get(id)!.effect}`);
        }
      } else {
        run.gold += 30;
        lines.push('봉인을 풀자 엽전 30.');
      }
      break;
    case 'muneojin_seongmun:hero':
      run.materials += 1;
      lines.push(`작두박수가 신칼로 녹슨 빗장을 가른다. 재료 +1.${upgradableIdx(run, 'baksu').length ? ' 작두박수 카드 한 장을 강화할 수 있다.' : ''}`);
      if (upgradableIdx(run, 'baksu').length) then = 'upgrade_baksu';
      break;
    case 'beorin_buk:bare':
      if (r < 0.5) {
        run.next.jangdan = (run.next.jangdan ?? 0) + 1;
        lines.push('북소리가 길게 울린다. 다음 전투 첫 턴 장단 +1.');
      } else {
        lines.push('북소리에 이름 없는 군졸들이 대오를 갖춘다!');
        then = 'battle';
        dlg.battleEnc = 'ev_buk';
      }
      break;
    case 'beorin_buk:supply':
      partyStress(run, -10);
      bondAll(run, 1);
      lines.push('북에 술을 부어 고사를 지냈다. 파티 귀기 −10, 모든 쌍 정 +1.');
      break;
    case 'beorin_buk:hero':
      run.flags.jangdanFights = { n: 2, left: 2 };
      lines.push('잽이가 북을 울린다. 다음 두 전투 첫 턴 장단 +2.');
      break;
    case 'jeokpaeji_deomi:bare':
      if (r < 0.4) {
        lines.push('적패지 사이에서 기억 하나가 떠오른다. 카드 3장 중 1장을 고른다.');
        then = 'cards';
        dlg.cardOptions = rollCards(run, 'normal').slice(0, 3);
      } else {
        partyStress(run, 10);
        lines.push('흩어진 이름들이 손에 감긴다. 파티 귀기 +10.');
      }
      break;
    case 'jeokpaeji_deomi:supply':
      lines.push('소지로 태워 보냈다. 덱에서 카드 한 장을 뺄 수 있다.');
      then = 'remove';
      break;
    case 'jeokpaeji_deomi:hero':
      lines.push(`법사가 해원경으로 문서를 바로 쓴다. 씌임 카드 ${purgeCurses(run)}장 정화. ${revealText(revealFamily(run, '억울귀', 1))}`);
      break;
    case 'gaeksa_jipsin:bare':
      if (r < 0.5) {
        run.gold += 15;
        lines.push('짚신 속에서 엽전 15.');
      } else {
        run.next.ambush = true;
        lines.push('짚신을 신자 발이 무거워진다. 다음 전투는 기습당한다.');
      }
      break;
    case 'gaeksa_jipsin:hero':
      run.materials += 2;
      lines.push(`포수가 발자국을 쫓는다. 방 ${scoutRooms(run, 2)}곳 정찰, 재료 +2.`);
      break;
    default:
      lines.push('아무 일도 없었다.');
  }
  void app;
  return { then, done: true };
}

/** 지역 2·3 방 이벤트 */
function regionEvent(app: AppState, run: Run, dlg: DialogState, idx: number, optId: string, lines: string[]): { then: DialogState['then']; done: boolean } {
  let then: DialogState['then'] = 'none';
  let done = true;
  const ev = EVENT_BY_ID.get(dlg.id)!;
  void optId;
  switch (`${dlg.id}:${idx}`) {
    // ── 지역 2 ──
    case 'sonnim_madang:0':
    case 'sonnim_madang:1':
      const sp = D().specials.get('sonnim_baeung')!;
      if (idx === 1) run.flags.sonnimStart = Math.max(run.flags.sonnimStart ?? 0, sp.manshinStart);
      if (run.relics.includes('ssarimal')) run.flags.sonnimStart = Math.max(run.flags.sonnimStart ?? 0, 4);
      lines.push(idx === 1 ? `만신이 손님을 청해 모신다. 손님상이 한결 정갈하다(대접 +${sp.manshinStart}로 시작).` : '손님상을 다시 차린다. 손님은 싸워 이길 상대가 아니라 잘 대접해 보낼 신령이다.');
      lines.push(`대접 ${sp.goal}을 ${sp.limit}턴 안에 채우면 좋게 떠난다. 손님상 차리기(술 1 또는 쌀 1, 턴당 1회) +3 · 굿상 설치물 · 장단 3+${sp.tokenTurn > 0 ? ' · 부적' : ''} · 수비가 물러가면 +${sp.guardDown}.${sp.tokenTurn > 0 ? '' : ' 부적은 손님을 막는 것이라 대접이 되지 않는다.'}${run.flags.sonnimStart ? ` 시작 대접 ${run.flags.sonnimStart}.` : ''}`);
      then = 'battle';
      dlg.battleEnc = 'sonnim';
      dlg.battleSpecial = 'sonnim';
      done = false;
      break;
    case 'sonnim_madang:2':
      run.flags.sealPenalty = true;
      run.flags.sonnimDone = true;
      lines.push('대문에 부적을 붙였다. 손님은 다른 길로 돌아간다 — 이번 원정 동안 역귀 전투마다 신열 +1장.');
      break;
    case 'sonnim_madang:3':
      run.flags.sonnimPenalty = true;
      run.flags.sonnimDone = true;
      run.gold += 20;
      lines.push('손님을 쫓아내려 하자 길잡이 수비들이 막아선다! (손님은 서운하게 떠난다 — 이번 원정 동안 전투 시작 시 신열 1장, 엽전 20)');
      then = 'battle';
      dlg.battleEnc = 'ev_sonnim_chase';
      break;
    case 'daedong_umul:0':
      run.next.fevers = [];
      lines.push(`우물 고사를 지냈다. 체력 +${healAll(run, 0.15)}, 신열을 걷어 냈다.`);
      break;
    case 'daedong_umul:1':
      run.flags.jangdanFights = { n: 1, left: 3 };
      lines.push('잽이가 고사 장단을 친다. 다음 세 전투 첫 턴 장단 +1.');
      break;
    case 'daedong_umul:2':
      lines.push(`물만 길었다. 체력 +${healAll(run, 0.05)}.`);
      if (rand(run) < 0.3) {
        (run.next.fevers ??= []).push(frontIdx(run));
        lines.push('물이 미지근하다. 다음 전투 신열 1장.');
      }
      break;
    case 'geumjul_mundap:0':
      partyStress(run, -10);
      lines.push('탈꾼이 말뚝이 재담으로 받아친다. 문지기가 웃으며 금줄을 들어 올린다. 파티 귀기 −10.');
      break;
    case 'geumjul_mundap:1':
      lines.push('지전을 쥐여 주자 금줄을 들어 올린다.');
      break;
    case 'geumjul_mundap:2':
      lines.push('금줄을 밀고 지나가자 문간 역귀가 막아선다!');
      then = 'battle';
      dlg.battleEnc = 'ev_geumjul';
      break;
    case 'binjip_jesasang:0':
      lines.push(`상을 차렸다. ${revealText(revealFamily(run, '굶주린 넋'))}`);
      relicChance(run, lines, 0.3);
      break;
    case 'binjip_jesasang:1':
      partyStress(run, -15);
      bondAll(run, 1);
      lines.push('승려가 시식을 올린다. 파티 귀기 −15, 모든 쌍 정 +1.');
      break;
    case 'uiwon_yakbang:0':
      run.next.fevers = [];
      lines.push(`법사가 해원경을 읽어 준다. 씌임 카드 ${purgeCurses(run)}장 정화, 신열을 걷어 냈다. ${revealText(revealFamily(run, '억울귀'))}`);
      break;
    case 'uiwon_yakbang:1':
      lines.push(`약장을 닫아 주고 향을 올렸다. 체력 +${healAll(run, 0.1)}.`);
      break;
    case 'uiwon_yakbang:2':
      run.supplies.sul++;
      lines.push('약재를 챙겼다. 술 +1.');
      if (rand(run) < 0.4) {
        partyStress(run, 8);
        lines.push('주인 허락 없이 가져간 것이 마음에 걸린다. 파티 귀기 +8.');
      }
      break;
    case 'seonang_gosa:0':
    case 'hon_bureuneun_deung:0':
      run.next.drawBonus = (run.next.drawBonus ?? 0) + 1;
      lines.push(`향을 올리고 물었다. ${revealText(revealHaewon(run, bossEnemyIds(run)))} 보스전 첫 턴 드로우 +1.`);
      break;
    case 'seonang_gosa:1':
      run.next.chasaBlock = 8;
      lines.push(`차사가 명부를 펼친다. ${revealText(revealHaewon(run, bossEnemyIds(run)))} 보스전 첫 턴 차사 방어도 8.`);
      break;
    case 'hon_bureuneun_deung:1': {
      const curses = run.deck.map((c, i) => (D().cards[c.d].isCurse ? i : -1)).filter((i) => i >= 0);
      if (curses.length) run.deck.splice(curses[0], 1);
      lines.push(`법사가 해원경을 읽는다. ${revealText(revealHaewon(run, bossEnemyIds(run)))}${curses.length ? ' 씌임 카드 1장 정화.' : ''}`);
      break;
    }
    // ── 지역 3 ──
    case 'munsajae_mundap:0':
      run.next.firstStrike = true;
      lines.push('인정을 쓰자 사자들이 길을 비킨다. 다음 전투는 선제.');
      break;
    case 'munsajae_mundap:1':
      run.flags.gateFree = (run.flags.gateFree ?? 0) + 1;
      lines.push('차사가 적패지를 내보인다. 무료로 통과하고, 다음 대문 통행도 무료.');
      break;
    case 'munsajae_mundap:2':
      run.next.jangdan = (run.next.jangdan ?? 0) + 2;
      lines.push('잽이가 장단을 치며 받아넘긴다. 사자들이 어깨를 들썩이며 길을 연다. 다음 전투 첫 턴 장단 +2.');
      break;
    case 'munsajae_mundap:3':
      lines.push('버티자 문 두드리는 객귀와 군졸들이 몰려든다!');
      then = 'battle';
      dlg.battleEnc = 'ev_munsajae';
      break;
    // 대문 방 통행 (05-region3 §1 ⟨반복 3⟩): 지전 1 · 문답 · 문지기 전투
    case 'daemun_tonghaeng:0':
      run.flags.gates = (run.flags.gates ?? 0) + 1;
      lines.push('인정을 쓰자 문지기가 금줄을 걷는다. 대문을 지난다.');
      break;
    case 'daemun_tonghaeng:1':
      run.flags.gates = (run.flags.gates ?? 0) + 1;
      partyStress(run, 8);
      lines.push('어디서 왔으며 무엇을 들고 왔느냐 — 꼬치꼬치 묻는 말에 하나하나 답하고서야 문이 열린다. 파티 귀기 +8.');
      break;
    case 'daemun_tonghaeng:2':
      run.flags.gates = (run.flags.gates ?? 0) + 1;
      lines.push('차사가 적패지를 펼쳐 옛 동료의 물음에 답한다. 문지기가 웃으며 길을 비킨다.');
      break;
    case 'daemun_tonghaeng:3':
      run.flags.gates = (run.flags.gates ?? 0) + 1;
      lines.push('문지기가 군졸들을 부른다. 이겨야 대문을 지난다!');
      then = 'battle';
      dlg.battleEnc = 'ev_munjigi';
      break;
    // ⟨반복 5⟩ 문전상(H-05) · 잽이 질침 장단(A-06) · 탈꾼 문지기 흉내(A-08)
    case 'daemun_tonghaeng:4':
      run.flags.gates = (run.flags.gates ?? 0) + 1;
      run.next.munjeon = true;
      lines.push('문간에 밥 한 그릇과 인정을 올렸다. 문지기가 금줄을 걷고, 상을 받은 문간이 이 문 너머에서 마주칠 넋의 사연을 일러 준다 — 다음 전투 원귀의 해원 조건이 해원록에 적힌다.');
      break;
    case 'daemun_tonghaeng:5':
      run.flags.gates = (run.flags.gates ?? 0) + 1;
      if (run.flags.road !== undefined) run.flags.road = roadStep(run.flags.road);
      lines.push(`잽이가 북과 징으로 길 닦는 장단을 받친다. 문지기가 장단에 맞춰 금줄을 걷는다.${run.flags.road !== undefined ? ` 길닦기 한 칸 (${run.flags.road}/9).` : ''}`);
      break;
    case 'daemun_tonghaeng:6':
      run.flags.gates = (run.flags.gates ?? 0) + 1;
      partyStress(run, -5);
      lines.push('탈꾼이 대문에 붙이던 장수 그림처럼 눈을 부릅뜨고 버티어 선다. 문지기들이 웃음을 터뜨리며 길을 비킨다. 파티 귀기 −5.');
      break;
    case 'saemji_noyeok:0': {
      let best = aliveIdx(run)[0];
      for (const i of aliveIdx(run)) if (run.heroes[i].hp / effMax(run.heroes[i]) > run.heroes[best].hp / effMax(run.heroes[best])) best = i;
      const h = run.heroes[best];
      h.hp = Math.max(1, h.hp - Math.round(h.baseMax * 0.15));
      if (!run.relics.includes('yaksu_sabal')) {
        run.relics.push('yaksu_sabal');
        lines.push(`${heroName(h.id)}이(가) 물을 길었다(체력 −15%). 희귀 가호 「약수 한 사발」 — ${RELIC_BY_ID.get('yaksu_sabal')!.effect}`);
      } else lines.push(`${heroName(h.id)}이(가) 물을 길었다. 약수 한 사발은 이미 있다.`);
      break;
    }
    case 'saemji_noyeok:1':
      partyStress(run, 10);
      lines.push(`나무를 했다. 파티 귀기 +10, 체력 +${healAll(run, 0.25)}.`);
      break;
    case 'saemji_noyeok:2':
      lines.push(`승려가 샘가에서 염불한다. 체력 +${healAll(run, 0.25)}.`);
      break;
    case 'eopgyeong_bichugi:0':
    case 'eopgyeong_bichugi:1':
    case 'eopgyeong_bichugi:2':
    case 'eopgyeong_bichugi:3': {
      const r = eopgyeong(run.stats.haewons, { incense: idx === 1, manshin: idx === 2, road: run.flags.road });
      run.flags.eopTier = r.tier;
      run.flags.knots = knotPresetBits(run.party, r.knots);
      if (r.reveal) revealHaewon(run, bossEnemyIds(run));
      if (r.draw) run.next.drawBonus = (run.next.drawBonus ?? 0) + r.draw;
      if (r.hpPct) healAll(run, r.hpPct);
      if (r.stress) partyStress(run, r.stress);
      lines.push(`업경대는 판결하지 않는다. ${(run.flags.road ?? 0) >= 9 ? '아홉 단계로 닦은 길이 거울까지 이어져 한 단계 위로 비춘다. ' : ''}${r.text}`);
      // ⟨반복 5⟩ 승려 회심곡 (A-05): 해원 수 그대로, 파티 귀기 −15
      if (idx === 3) {
        partyStress(run, -15);
        lines.push('승려가 거울에 비친 넋들을 위해 회심곡을 부른다. 파티 귀기 −15.');
      }
      break;
    }
    case 'kkamagwi_jeokpaeji:0':
      lines.push(`쌀을 뿌려 달랬다. 적패지를 받았다. ${revealText(revealHaewon(run, ['munseo_ilheun_neok']))}`);
      if (upgradableIdx(run).length) then = 'upgrade';
      break;
    case 'kkamagwi_jeokpaeji:1':
      partyStress(run, -10);
      lines.push('차사가 적패지를 받아 든다. 파티 귀기 −10.');
      if (upgradableIdx(run, 'chasa').length) {
        then = 'upgrade_hero';
        dlg.upgradeHero = 'chasa';
      }
      break;
    case 'kkamagwi_jeokpaeji:2':
      run.flags.crow = true;
      lines.push('까마귀를 쫓아냈다. 차례가 어지러워졌다 — 이번 원정 동안 전투 첫 턴 무작위 영웅 하나가 홀림 1.');
      break;
    case 'sajabap_jul:0':
      partyStress(run, -15);
      lines.push(`밥을 나눴다. 파티 귀기 −15. ${revealText(revealFamily(run, '굶주린 넋'))}`);
      break;
    case 'sajabap_jul:1':
      partyStress(run, -10);
      run.next.firstStrike = true;
      lines.push('탈꾼이 줄을 웃긴다. 파티 귀기 −10, 다음 전투는 선제.');
      break;
    case 'sajabap_jul:2':
      partyStress(run, 5);
      lines.push('새치기하자 줄이 흐트러지며 넋들이 덤벼든다! 파티 귀기 +5.');
      then = 'battle';
      dlg.battleEnc = 'ev_sajabap';
      break;
    default:
      lines.push(ev.choices[idx]?.result ?? '아무 일도 없었다.');
  }
  void app;
  return { then, done };
}

function markHere(run: Run): void {
  const p = run.pos;
  if (p.kind === 'room') run.dungeon.rooms[p.room].content.done = true;
  else run.dungeon.corridors[p.cor].tiles[p.i].content.done = true;
}

export function openDialogFor(app: AppState): boolean {
  const run = app.run!;
  const p = run.pos;
  const content = p.kind === 'room' ? run.dungeon.rooms[p.room].content : run.dungeon.corridors[p.cor].tiles[p.i].content;
  if (content.done || !content.id) return false;
  if (content.k === 'curio') {
    app.dialog = { kind: 'curio', id: content.id, result: null, then: 'none' };
    return true;
  }
  if (content.k === 'event') {
    app.dialog = { kind: 'event', id: content.id, result: null, then: 'none' };
    return true;
  }
  if (content.k === 'trap') {
    const known = p.kind === 'tile' && run.dungeon.corridors[p.cor].tiles[p.i].known && wasKnownBefore;
    if (known) {
      app.dialog = { kind: 'trap', id: content.id, result: null, then: 'none' };
    } else {
      run.stats.traps++;
      const lines = springTrap(run, content.id);
      content.done = true;
      app.dialog = { kind: 'trap', id: content.id, result: `미처 보지 못한 덫을 밟았다.\n${lines.join('\n')}`, then: 'none' };
    }
    return true;
  }
  return false;
}

/** 걸음 전에 그 칸이 이미 보였는지 (덫을 미리 봤는가) — actions.ts 가 설정 */
let wasKnownBefore = false;
export function setKnownBefore(v: boolean): void {
  wasKnownBefore = v;
}
