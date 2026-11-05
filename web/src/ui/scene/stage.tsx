// 측면 종이 무대(안 A). SVG 층(배경 · 넋등 비네트 · 인형 · 의도 실)과 HTML 층(의도 배지 · 이름판 · 체력 · 상태)을 같은 좌표로 겹친다.
// 무대 좌표 1280 × 480, 발선 FY = 330. 왼쪽부터 후열 → 중열 → 선두 → 굿상 │ 원귀(앞 → 뒤).
// 화면은 엔진 상태를 읽기만 한다. 대상 고르기는 칸(.unit)을 누르면 CombatScreen 에 알린다.

import type { ComponentChildren, CSSProperties, JSX } from 'preact';
import { capActive, collapsed, deathSaveChance, popcount, standing } from '../../../../src/core/engine.ts';
import { intentTargets } from '../../../../src/core/enemy.ts';
import { KNOTS } from '../../../../src/core/types.ts';
import type { CombatState, HeroState } from '../../../../src/core/types.ts';
import { haewonView, intentView, slotName, type IntentView } from '../../game/combat.ts';
import { D, ENEMY_EXTRA, HERO_COLOR } from '../../game/content.ts';
import { heroName } from '../../game/run.ts';
import type { CombatSession, Run } from '../../game/types.ts';
import { Icon, Pips, St } from '../common.tsx';
import { Backdrop, Geumjul, LightVignette, type BackdropVariant } from './backdrop.tsx';
import { rememberBattle, useCombatFx, type CombatFx } from './fx.ts';
import { HeroParts, Shadow, type Mask } from './hero.tsx';
import { INTENT_COLOR, pctX, pctY } from './palette.ts';
import { GutsangTable, Tablet } from './props.tsx';
import { Palanquin, SoulWisp, SpiritParts, SpiritShadow, Villager, type SpiritState, type Tier } from './spirit.tsx';

export const SW = 1280;
export const SH = 480;
export const FY = 330;
const HERO_X = [385, 255, 125];
const HERO_SCALE = 1.1;
const PLATE_Y = 338;

/** 무대 틀: 가로세로 비를 지키며 부모(.stage-wrap) 안에 꽉 차게. --u = 무대 1 단위의 px */
export function Stage({ W, H, cls = '', label, svg, overlay, testid }: { W: number; H: number; cls?: string; label: string; svg: ComponentChildren; overlay?: ComponentChildren; testid?: string }) {
  return (
    <div class={`stage ${cls}`} style={{ '--sw': W, '--sh': H } as CSSProperties} data-testid={testid}>
      <svg class="stage-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>{svg}</svg>
      {overlay && <div class="stage-ov">{overlay}</div>}
    </div>
  );
}

// ── 조각: 체력 막대 · 상태 칩 · 의도 배지 ──────────────────────────────
export function HpBar({ hp, max, block = 0, incoming = 0, doom = 0, hero = false, cls = '' }: { hp: number; max: number; block?: number; incoming?: number; doom?: number; hero?: boolean; cls?: string }) {
  const f = (v: number) => `${Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100))}%`;
  const cur = Math.max(0, hp);
  const low = hero && hp / max < 0.5;
  const crit = hero && hp / max < 0.25;
  return (
    <div class={`hpbar ${hero ? 'mine' : ''} ${crit ? 'crit' : low ? 'low' : ''} ${cls}`}>
      <i style={{ width: f(cur) }} />
      {incoming > 0 && <div class="incoming" style={{ left: f(Math.max(0, cur - incoming)), width: f(Math.min(incoming, cur)) }} />}
      {doom > 0 && <div class="doom" style={{ width: f(Math.min(doom, cur)) }} title={`명부 ${doom}: 턴 끝에 명부 ≥ 체력이면 처형 (빗금 끝 = 처형선)`} />}
      <span>{cur}/{max}</span>
      {block > 0 && <b class="shield" title="방어도">{block}</b>}
    </div>
  );
}

const SLOT_MARK: Record<string, string> = { 선두: '선', 중열: '중', 후열: '후', '파티 전체': '전' };

function kindClass(iv: IntentView): string {
  if (iv.cancelled) return 'cancel';
  if (['attack', 'attack_debuff'].includes(iv.kind)) return 'k-attack';
  if (iv.kind === 'move') return 'k-move';
  if (['stress', 'pollute', 'possess'].includes(iv.kind)) return 'k-stress';
  return 'k-calm';
}

function targetMark(iv: IntentView, s: CombatState, targets: number[]): string {
  if (iv.targetSlot === '전체') return '전';
  if (iv.targetSlot === '굿상') return '굿';
  if (['자신', '아군 원귀'].includes(iv.targetSlot)) return '자';
  if (targets.length === 1) return SLOT_MARK[slotName(s, targets[0])] ?? '?';
  return '?';
}

function IntentBadge({ iv, mark, testid }: { iv: IntentView; mark: string; testid: string }) {
  return (
    <div class={`intent-badge ${kindClass(iv)}`} title={iv.effect || iv.name} data-testid={testid}>
      <span class="ib-row">
        <Icon name={iv.icon} size={16} />
        {iv.per !== null && !iv.cancelled && <b class="dmg">{iv.per}{iv.hits > 1 ? `×${iv.hits}` : ''}</b>}
        <span class="iname">{iv.cancelled ? '붕괴 — 행동 취소' : iv.name}</span>
        {!iv.cancelled && <i class="tmark" aria-label={`대상 ${mark}`}>{mark}</i>}
      </span>
      {!iv.cancelled && iv.targetLabel && <span class="tgt">→ {iv.targetLabel}</span>}
    </div>
  );
}

// ── 영웅 칸 ───────────────────────────────────────────────────────────
const GARAK = ['굿거리', '자진굿거리', '당악'];
const TAL = ['말뚝이', '양반', '할미'];
const MASKS: Mask[] = ['malttugi', 'yangban', 'halmi'];

function talIndex(s: CombatState, hi: number): number {
  const i = s.formation.indexOf(hi);
  if (i < 0) return 0;
  return i === s.formation.length - 1 && i > 0 ? 2 : Math.min(i, 2);
}

function resLine(s: CombatState, h: HeroState): JSX.Element | null {
  switch (h.id) {
    case 'manshin': return <>신바람 <Pips n={h.personal} max={5} /></>;
    case 'jaebi': return <>가락 <b>{GARAK[h.personal] ?? '굿거리'}</b></>;
    case 'posu': return <>화약 <Pips n={h.personal} max={3} /></>;
    case 'baksu': return <>작두 <b>{h.stance ? '날 위' : '아래'}</b></>;
    case 'seungnyeo': return <>염주 <b>{h.personal}</b>/9</>;
    case 'beopsa': return <>경면주사 <Pips n={h.personal} max={h.personalCap} /></>;
    case 'talggun': return <>탈 <b>{s.formation.includes(h.idx) ? TAL[talIndex(s, h.idx)] : '—'}</b></>;
    case 'chasa': return <>오라 <Pips n={h.personal} max={3} /></>;
  }
  return null;
}

function HeroPlate({ s, h, inc }: { s: CombatState; h: HeroState; inc: number }) {
  const unb = Math.max(0, inc - h.block);
  const coverOf = s.heroes.find((x) => x.cover === h.idx && standing(x));
  return (
    <div class="plate hplate">
      <div class="slotlab"><span>{h.dead ? '떠남' : slotName(s, h.idx)}</span>{unb > 0 && !h.dead && !h.downed && <span class="inc-badge" title="보이는 의도로 예상한 피해(방어도 뒤)">−{unb}</span>}</div>
      <div class="hn">{heroName(h.id)}</div>
      {!h.dead && <HpBar hp={h.hp} max={h.maxHp} block={h.block} incoming={h.downed ? 0 : unb} hero />}
      {!h.dead && (
        <div class="stressbar" title="귀기 (50·100에서 씌임)"><i style={{ width: `${Math.min(100, h.stress)}%` }} /><span>귀기 {h.stress}</span></div>
      )}
      {h.downed && (
        <div class="downed-box">쓰러짐 · 넋 부르기 {h.rescue}/{h.rescueNeed}<br />맞으면 버틸 확률 {Math.round(deathSaveChance(h.survived) * 100)}%{h.downTurn === s.turn ? ' · 이번 턴 보호' : ''}</div>
      )}
      {!h.dead && !h.downed && <div class="res">{resLine(s, h)}</div>}
      <div class="stats-line">
        {h.weak > 0 && <St k="weak" n={h.weak} label="약화" title="약화: 주는 피해 −25%" />}
        {h.possess > 0 && <St k="possess" n={h.possess} label="홀림" title="홀림: 카드 효과 없음" />}
        {h.recovering && <span class="st" title="회복 중: 주는 피해 −10%">회복 중</span>}
        {h.injured && <span class="st bad" title="중상: 최대 체력 −20%">중상</span>}
        {coverOf && <span class="st good" title="엄호받는 중">엄호 · {heroName(coverOf.id)}</span>}
      </div>
    </div>
  );
}

// ── 원귀 칸 ───────────────────────────────────────────────────────────
function EnemyPlate({ s, run, ei, compact }: { s: CombatState; run: Run; ei: number; compact: boolean }) {
  const d = D();
  const e = s.enemies[ei];
  const def = d.enemies[e.def];
  const hv = haewonView(run, s, ei);
  const executes = e.alive && e.doom > 0 && e.doom >= (s.seokja && e.bound ? Math.ceil(e.hp / 2) : e.hp);
  const coll = collapsed(s, e);
  const L = (t: string) => (compact ? undefined : t);
  return (
    <div class="plate eplate">
      <div class="ename">{def.name}{def.category === 'elite' && <span class="tiny tag-red"> · 수호</span>}{def.category === 'boss' && <span class="tiny tag-red"> · 보스</span>}{e.summoned && <span class="tiny faint"> · 불려 나옴</span>}</div>
      {e.alive ? (
        <>
          <HpBar hp={e.hp} max={e.maxHp} block={e.block} doom={e.doom} />
          <div class="stats-line">
            {e.mark > 0 && <St k="mark" n={e.mark} label={L('점지')} title="점지: 쌓이고 줄지 않는다" />}
            {e.bleed > 0 && <St k="bleed" n={e.bleed} label={L('상흔')} title="상흔: 적 턴 시작에 이만큼 잃는다" />}
            {e.doom > 0 && <St k="doom" n={e.doom} label={L('명부')} title="명부: 턴 끝에 명부 ≥ 체력이면 처형" />}
            <St k="shake" n={`${e.shake}/${e.endure}`} label={L('넋')} title="넋흔들림 / 버팀 — 버팀에 닿으면 붕괴" />
            {coll && <St k="collapse" label="붕괴" title="받는 피해 ×1.5" />}
            {e.vuln > 0 && <St k="vuln" n={e.vuln} label={L('취약')} title="취약: 받는 피해 +50%" />}
            {e.weak > 0 && <St k="weak" n={e.weak} label={L('약화')} title="약화: 주는 피해 −25%" />}
            {e.bound && <St k="bound" label="묶임" title="다음 행동 피해 −25%" />}
            {e.atkBonus > 0 && <St k="buff" n={`+${e.atkBonus}`} title="누적 공격 보너스" />}
            {executes && <span class="st collapse">처형 예정</span>}
            {def.cap && <span class={`st ${capActive(s, e) ? 'cap' : 'faint'}`} title="빗장: 한 플레이어 턴에 잃는 체력의 상한. 상흔·명부·붕괴는 넘는다">빗장 {capActive(s, e) ? `${Math.max(0, def.cap.n - e.capLost)}/${def.cap.n}` : '풀림'}</span>}
          </div>
          {def.haewon.kind === 'knots' && (
            <div class="knots" data-testid="knots" title={`고풀이: 매듭 ${def.haewon.need}개를 풀고 쓰러뜨리면 해원 (상태 매듭은 그 상태 ${def.haewon.knotMin ?? 1} 이상)`}>
              {KNOTS.map((k, i) => <span key={k} class={e.knots & (1 << i) ? 'on' : ''} title={k}>{k === '넋흔들림' ? '넋' : k === '장단' ? '장3' : k.slice(0, 2)}</span>)}
              <b class="tiny">{popcount(e.knots)}/{def.haewon.need}</b>
            </div>
          )}
          {!hv.none && <div class={`haewon-line ${hv.ok ? 'ok' : ''}`} title={hv.text}>{hv.ok ? '◆ ' : '◇ '}{hv.known ? `해원 · ${hv.text}` : hv.text}</div>}
        </>
      ) : (
        <div class={`fate-tag ${e.escaped ? 'escape' : e.haewon ? 'haewon' : 'kill'}`}>{e.escaped ? '달아남' : e.haewon ? '해원' : '처치'}</div>
      )}
    </div>
  );
}

// ── 의도 실 ───────────────────────────────────────────────────────────
function thread(x1: number, y1: number, x2: number, y2: number, lift: number): string {
  const mx = (x1 + x2) / 2;
  const my = Math.min(y1, y2) - lift;
  return `M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`;
}

interface ThreadSpec { key: string; d: string; color: string; end: [number, number]; kind: 'one' | 'all' | 'maybe' | 'altar' }

function enemyOrder(s: CombatState): number[] {
  const d = D();
  const POS: Record<string, number> = { front: 0, any: 1, back: 2 };
  return s.enemies.map((_, i) => i).sort((a, b) => {
    const pa = POS[ENEMY_EXTRA.get(d.enemies[s.enemies[a].def].id)?.position ?? 'any'] ?? 1;
    const pb = POS[ENEMY_EXTRA.get(d.enemies[s.enemies[b].def].id)?.position ?? 'any'] ?? 1;
    return pa - pb || a - b;
  });
}

function fateClass(state: SpiritState): string {
  return state === 'idle' ? '' : `fate-${state}`;
}

// ── 전투 무대 ─────────────────────────────────────────────────────────
export interface CombatStageProps {
  cs: CombatSession;
  run: Run;
  inc: number[];
  enemyTargetable: (ei: number) => boolean;
  heroTargetable: (h: HeroState) => boolean;
  onEnemy: (ei: number) => void;
  onHero: (hi: number) => void;
}

export function CombatStage({ cs, run, inc, enemyTargetable, heroTargetable, onEnemy, onHero }: CombatStageProps) {
  const s = cs.s;
  const d = D();
  const fx: CombatFx = useCombatFx(s);
  const region = run.region ?? 1;
  // 대문 방(3지역): 방 전투든 문지기와 겨루는 창 전투든 파티가 선 방이 대문이면 무대 뒤에 큰 대문
  const here = run.pos.kind === 'room' ? run.dungeon.rooms[run.pos.room] : null;
  const variant: BackdropVariant = here?.gate ? 'gate' : cs.meta.tier === 'boss' ? 'boss' : 'room';
  rememberBattle({ s, region, variant: variant as 'room' | 'boss' | 'gate' });
  const p = (n: number) => (n % 2 ? 'p1' : 'p0');

  // 자리
  const hx = new Map<number, number>();
  s.formation.forEach((hi, i) => hx.set(hi, HERO_X[i] ?? 60));
  const freeX = [...HERO_X.slice(s.formation.length), 40, 40];
  s.heroes.filter((h) => h.dead).forEach((h, k) => hx.set(h.idx, freeX[k]));
  const ward = s.ward && !s.ward.lost ? s.ward : null;
  const tableX = ward ? 560 : 515;
  // 원귀 칸: 등급 크기(일반 1 · 졸개 0.85 · 엘리트 1.25 · 보스 1.6)만큼 폭을 나눠 앞 → 뒤로 세운다
  const order = enemyOrder(s);
  const n = order.length;
  const tierOf = (ei: number): Tier => {
    const c = d.enemies[s.enemies[ei].def].category;
    return (['normal', 'minion', 'elite', 'boss'].includes(c) ? c : 'normal') as Tier;
  };
  const WEIGHT: Record<Tier, number> = { normal: 1, minion: 0.85, elite: 1.25, boss: 1.6 };
  const ws = order.map((ei) => WEIGHT[tierOf(ei)]);
  const unitW = Math.min(180, 600 / Math.max(1, ws.reduce((a, b) => a + b, 0)));
  const ex = new Map<number, number>();
  const colWOf = new Map<number, number>();
  let acc = 0;
  order.forEach((ei, k) => {
    ex.set(ei, 645 + unitW * (acc + ws[k] / 2));
    colWOf.set(ei, Math.min(196, unitW * ws[k] - 8));
    acc += ws[k];
  });
  const compact = n > 3;
  const headY = (hi: number) => (s.heroes[hi].downed ? FY - 40 : FY - 160);

  // 의도 실
  const threads: ThreadSpec[] = [];
  const tags: Record<number, string[]> = {};
  const intents = new Map<number, { iv: IntentView; mark: string }>();
  for (const ei of order) {
    const e = s.enemies[ei];
    if (!e.alive || e.intent < 0) continue;
    const iv = intentView(s, ei);
    const it = d.enemies[e.def].intents[e.intent];
    const x = ex.get(ei)!;
    let targets: number[] = [];
    if (!iv.cancelled && !['자신', '아군 원귀', '굿상'].includes(it.target)) targets = intentTargets(s, e, it, true).map(([hi]) => hi).filter((hi) => hx.has(hi) && !s.heroes[hi].dead);
    intents.set(ei, { iv, mark: targetMark(iv, s, targets) });
    if (iv.cancelled) continue;
    const y0 = 88;
    if (it.target === '굿상') {
      threads.push({ key: `t${ei}`, d: thread(x, y0, tableX, FY - 96, 30), color: '#e2b23a', end: [tableX, FY - 96], kind: 'altar' });
      continue;
    }
    const kind: ThreadSpec['kind'] = it.target === '전체' ? 'all' : targets.length > 1 ? 'maybe' : 'one';
    for (const hi of targets) {
      const tx = hx.get(hi)! + 8;
      const ty = headY(hi);
      threads.push({ key: `t${ei}-${hi}`, d: thread(x - 30, y0, tx, ty, kind === 'one' ? 46 : 30), color: kind === 'all' ? '#b9b0d2' : HERO_COLOR[s.heroes[hi].id], end: [tx, ty], kind });
      if (['stress', 'pollute', 'possess', 'attack_debuff'].includes(it.kind)) (tags[hi] ??= []).push(iv.name);
    }
  }

  // 받는소리 실: 직전 주인 → 다른 영웅(지금 내면 받는소리)
  const prevOwner = s.prevOwners && s.prevOwners[0] >= 0 ? s.prevOwners[0] : -1;
  const batThreads = prevOwner >= 0 && hx.has(prevOwner) && standing(s.heroes[prevOwner])
    ? s.formation.filter((hi) => hi !== prevOwner && standing(s.heroes[hi])).map((hi) => ({ hi, d: thread(hx.get(prevOwner)!, FY - 168, hx.get(hi)!, FY - 168, 34) }))
    : [];

  const spirits = s.summons.map((x) => ({ name: d.summons[x.s].name, left: x.left, color: x.owner >= 0 && s.heroes[x.owner] ? HERO_COLOR[s.heroes[x.owner].id] : '#e2b23a' }));
  const powers = s.powerZone.map((c) => d.cards[c.d].name);

  const svg = (
    <>
      <Backdrop region={region} W={SW} H={SH} FY={FY} variant={variant} />
      <LightVignette light={run.light} W={SW} H={SH} lampX={260} lampY={FY - 90} />
      <Geumjul W={SW} y={4} />
      {s.entertain && <Palanquin x={1150} y={FY - 70} scale={0.72} />}
      {/* 굿상 */}
      <g class={fx.summon ? `summon-pop ${p(fx.seq)}` : ''}>
        <GutsangTable x={tableX} y={FY} spirits={spirits} newKey={fx.summon ? String(fx.seq) : undefined} />
      </g>
      {ward && <Villager x={460} y={FY} scale={0.78} />}
      {/* 영웅 (뒤 → 앞) */}
      {s.heroes.map((h) => {
        const x = hx.get(h.idx);
        if (x === undefined) return null;
        if (h.dead) return <g key={`h${h.idx}`} style={{ transform: `translate(${x}px, ${FY}px)` }} class="pos"><Tablet x={0} y={0} s={0.8} name={heroName(h.id)} color={HERO_COLOR[h.id]} glow={false} /></g>;
        const f = fx.hero[h.idx];
        const pose = f === 'attack' ? 'attack' : f === 'cast' ? 'cast' : 'idle';
        const melee = h.melee;
        return (
          <g key={`h${h.idx}`} class="pos" style={{ transform: `translate(${x}px, ${FY}px) scale(${HERO_SCALE})` }}>
            <Shadow />
            <g class={`act ${f ? `fx-${f}${f === 'attack' && !melee ? '-r' : ''} ${p(fx.seq)}` : ''}`}>
              <g class={`body hero-body ${h.downed ? 'downed' : ''} ${h.possess > 0 ? 'possessed' : ''}`}>
                <HeroParts id={h.id} look={{ pose, mask: MASKS[talIndex(s, h.idx)], gangsin: h.id === 'manshin' && s.gangsin, stance: h.stance, garak: h.id === 'jaebi' ? h.personal : 0 }} />
              </g>
              {f === 'hit' && <path class="slash" d="M30 -110 l14 -6 M32 -96 l16 0 M30 -82 l14 6" stroke="#ff6a4d" stroke-width="3" />}
            </g>
            {h.downed && (
              <g class="soul-over" transform="translate(-30 -40)">
                <SoulWisp x={0} y={-30} s={0.28} />
                {Array.from({ length: h.rescueNeed }, (_, i) => <rect key={i} x={-h.rescueNeed * 9 + i * 18} y={-22} width="14" height="18" rx="2" fill={i < h.rescue ? '#ebe3cb' : 'none'} stroke="#ebe3cb" stroke-width="1.4" />)}
              </g>
            )}
          </g>
        );
      })}
      {/* 원귀 (뒤 → 앞으로 그려 앞 원귀가 위에) */}
      {[...order].reverse().map((ei) => {
        const e = s.enemies[ei];
        const def = d.enemies[e.def];
        const x = ex.get(ei)!;
        const tier = tierOf(ei);
        const state: SpiritState = e.alive ? 'idle' : e.escaped ? 'escape' : e.haewon ? 'haewon' : 'cheochi';
        const f = fx.enemy[e.uid];
        const playing = !!fx.fates[e.uid];
        return (
          <g key={`e${e.uid}`} class="pos" style={{ transform: `translate(${x}px, ${FY}px)` }}>
            {e.alive && <SpiritShadow tier={tier} />}
            <g class={`act ${f ? `fx-e${f} ${p(fx.seq)}` : ''}`}>
              <g class={`body spirit-body ${fateClass(state)} ${playing ? 'play' : ''}`}>
                <SpiritParts family={def.family} tier={tier} boss={def.category === 'boss' ? def.id : undefined} state={state} />
              </g>
            </g>
          </g>
        );
      })}
      {/* 의도 실 */}
      <g class="threads">
        {threads.map((t) => (
          <g key={t.key} class={`thread th-${t.kind}`}>
            <path d={t.d} stroke={t.color} fill="none" />
            <circle cx={t.end[0]} cy={t.end[1]} r={t.kind === 'one' ? 5 : 3.5} fill={t.color} />
          </g>
        ))}
      </g>
      {/* 받는소리 실 */}
      <g class="bat-threads">
        {batThreads.map((b) => <path key={`b${b.hi}`} d={b.d} stroke={HERO_COLOR[s.heroes[prevOwner].id]} class="bat-idle" fill="none" />)}
        {fx.bat && hx.has(fx.bat[0]) && hx.has(fx.bat[1]) && (
          <path key={`bat${fx.seq}`} class="bat-go" d={thread(hx.get(fx.bat[0])!, FY - 168, hx.get(fx.bat[1])!, FY - 168, 46)} stroke={HERO_COLOR[s.heroes[fx.bat[0]].id]} fill="none" pathLength={100} />
        )}
      </g>
    </>
  );

  const overlay = (
    <>
      {s.heroes.map((h) => {
        const x = hx.get(h.idx);
        if (x === undefined) return null;
        const t = heroTargetable(h);
        return (
          <div key={`hu${h.idx}`} class={`unit hero ${h.downed ? 'downed' : ''} ${h.dead ? 'dead' : ''} ${t ? 'targetable' : ''}`} style={{ left: pctX(x - 64), width: pctX(128), '--hc': HERO_COLOR[h.id] } as CSSProperties}
            onClick={t ? () => onHero(h.idx) : undefined} data-testid={`hero-${h.id}`} role={t ? 'button' : undefined} aria-label={t ? `${heroName(h.id)} 고르기` : undefined}>
            {(tags[h.idx]?.length ?? 0) > 0 && !h.dead && <div class="htags">{tags[h.idx].slice(0, 2).map((x2) => <span key={x2}>{x2}</span>)}</div>}
            <HeroPlate s={s} h={h} inc={inc[h.idx] ?? 0} />
          </div>
        );
      })}
      {order.map((ei) => {
        const e = s.enemies[ei];
        const x = ex.get(ei)!;
        const colW = colWOf.get(ei)!;
        const t = enemyTargetable(ei);
        const def = d.enemies[e.def];
        const it = intents.get(ei);
        return (
          <div key={`eu${e.uid}`} class={`unit enemy ${def.category === 'boss' ? 'boss' : ''} ${t ? 'targetable' : ''} ${!e.alive ? 'gone' : ''}`} style={{ left: pctX(x - colW / 2), width: pctX(colW) }}
            onClick={t ? () => onEnemy(ei) : undefined} data-testid={`enemy-${ei}`} role={t ? 'button' : undefined} aria-label={t ? `${def.name} 고르기` : undefined}>
            {it && <IntentBadge iv={it.iv} mark={it.mark} testid={`intent-${ei}`} />}
            <EnemyPlate s={s} run={run} ei={ei} compact={compact} />
          </div>
        );
      })}
      <div class="altar-plate" style={{ left: pctX(tableX - 70), width: pctX(140), top: pctY(PLATE_Y, SH) }} data-testid="altar">
        <b>굿상</b>
        {spirits.length === 0 && <span class="faint"> 비었다</span>}
        {s.summons.map((x, i) => {
          const sd = d.summons[x.s];
          return <div key={i} class="altar" title={sd.text}>{sd.name} · {sd.trigger === 'turn_end' ? '턴 끝' : '턴 시작'} {x.left}</div>;
        })}
        {powers.length > 0 && <div class="tiny dim">능력: {powers.join(' · ')}</div>}
      </div>
      {ward && <div class="ward-tag" style={{ left: pctX(460 - 50), width: pctX(100), top: pctY(PLATE_Y, SH) }}>산 사람<br />{ward.hp}/{ward.maxHp}</div>}
    </>
  );

  return <Stage W={SW} H={SH} cls="combat-stage" label="전투 무대" svg={svg} overlay={overlay} testid="stage" />;
}
