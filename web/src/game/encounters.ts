// 기물·방 이벤트·덫 (탐험 §7·§8, 첫 지역 §5): 세 갈래 손대기(맨손 / 맞는 보급품 / 영웅 고유)와 선택지.

import { rand } from '../../../src/core/rng.ts';
import type { HeroId } from '../../../src/core/types.ts';
import { CURIO_BY_ID, D, ENEMY_EXTRA, EVENT_BY_ID, RELIC_BY_ID, TRAP_BY_ID, type SupplyId } from './content.ts';
import { corridorsOf } from './dungeon.ts';
import {
  addCurse, aliveIdx, bossEnemyIds, heroName, logRun, partyStress, revealAllRooms, revealHaewon, revealNear, revealRandomHaewon, scoutAround,
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
  const k = bondKey(run, a, b);
  run.bonds[k] = (run.bonds[k] ?? 0) + n;
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
      out.push({
        id: `c${i}`, label: ch.label, detail: simplifiedEventResult(dlg.id, i, ch.result), kind: req ? 'hero' : 'choice', hero: req, cost: ch.cost, enabled: ok,
        reason: !reqOk ? `파티에 ${heroName(req!)}이(가) 없다` : !ok ? `${ch.cost}이(가) 필요하다` : undefined,
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
  if (id === 'saja_geommun' && i === 2) return '놀이 싸움(간소화): 잡귀 셋과 싸운다. 잃은 체력은 끝나면 되돌리고 그만큼 귀기로 받는다. 이기면 엽전 20, 지면 귀기 +15. 어느 쪽이든 통과.';
  if (id === 'jalmot_on_saram' && i === 0) return '호위(간소화): 잡귀 무리와 싸운다. 모두 쓰러뜨리거나 세 턴을 버티면 성공(치성 +1). 그 사람은 따로 그리지 않는다.';
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
      default:
        lines.push('아무 일도 없었다.');
    }
  } else if (dlg.kind === 'event') {
    run.stats.events++;
    const ev = EVENT_BY_ID.get(dlg.id)!;
    let idx = Number(optId.slice(1).split(':')[0]);
    if (Number.isNaN(idx)) idx = 0;
    const ch = ev.choices[idx];
    payCost(run, ch.cost);
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
      default:
        lines.push(ch.result);
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
  }
  return lines;
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
