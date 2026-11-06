// 그래픽 슬라이스 화면: 위 측면 무대(PixiJS) · 아래 손패 띠(CZN 배치: 왼쪽 아래 에너지·장단·더미, 가운데 손패, 오른쪽 아래 턴 종료).
// 「러프」로 바꾸면 같은 전투를 지금 플레이어블의 러프 그래픽(SVG 무대 · 부적 카드)으로 그린다 — 나란히 견주기.
// 엔진 상태는 진짜(battle.s)이고, 무대·이름판은 연출 순서(Step)에 맞춰 늦게 따라온다(view).

import type { CSSProperties } from 'preact';
import { useEffect, useReducer, useRef, useState } from 'preact/hooks';
import { canPlay, costOf, standing } from '../../../../src/core/engine.ts';
import type { ActionChoice, CombatState, HeroState } from '../../../../src/core/types.ts';
import { botChoice, completeChoice, incomingByHero, targetSteps, wouldRespond, type TargetStep } from '../../../src/game/combat.ts';
import { D, HERO_COLOR } from '../../../src/game/content.ts';
import { heroName } from '../../../src/game/run.ts';
import type { CombatSession, Run } from '../../../src/game/types.ts';
import { CardView, Jangdan, KwText, TermList } from '../../../src/ui/common.tsx';
import { SceneDefs } from '../../../src/ui/scene/defs.tsx';
import { CombatStage } from '../../../src/ui/scene/stage.tsx';
import { SoundToggle } from '../../../src/ui/scene/sound-toggle.tsx';
import { cue } from '../../../src/ui/scene/audio.ts';
import { hanjiUrl } from '../art/cardArt.ts';
import { silhouetteSheet } from '../art/silhouette.ts';
import { BUSY_SCRIPT, ENC, PARTY, endTurn, newBattle, play, stageBusyTurn, type Battle, type Kind, type Step } from '../battle.ts';
import { SliceStage } from '../stage/stage.ts';
import { CardFrame } from './card.tsx';
import { StageOverlay } from './overlay.tsx';

const LIGHT = 72;
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Sel {
  hand: number;
  steps: TargetStep[];
  step: number;
  partial: Partial<ActionChoice>;
  pairFirst: number;
}

// ── 조종 (화면 밖 상태: 연출 대기열 · 무대) ──────────────────────────────
interface Ctl {
  battle: Battle;
  view: CombatState;
  phase: 'player' | 'enemy';
  queue: Step[];
  running: boolean;
  stage: SliceStage | null;
  mode: 'new' | 'rough';
  tally: { haewon: number; cheochi: number };
  log: string[];
  auto: boolean;
  timers: number[];
}

const ctl: Ctl = {
  battle: newBattle('normal'), view: null as unknown as CombatState, phase: 'player', queue: [], running: false, stage: null, mode: 'new',
  tally: { haewon: 0, cheochi: 0 }, log: [], auto: false, timers: [],
};
ctl.view = ctl.battle.s;
let rerender: () => void = () => {};

function later(ms: number, f: () => void): void {
  const id = window.setTimeout(() => {
    ctl.timers = ctl.timers.filter((x) => x !== id);
    f();
  }, ms);
  ctl.timers.push(id);
}

function noteSteps(steps: Step[]): void {
  const d = D();
  for (const st of steps) for (const e of st.ev) {
    if (e.k === 'fate') {
      const en = st.s.enemies.find((x) => x.uid === e.uid);
      const name = en ? d.enemies[en.def].name : '원귀';
      if (e.fate === 'haewon') ctl.tally.haewon++;
      if (e.fate === 'cheochi') ctl.tally.cheochi++;
      ctl.log.push(`${name} — ${e.fate === 'haewon' ? '해원' : e.fate === 'cheochi' ? '처치' : '달아남'}`);
      cue(e.fate === 'haewon' ? 'haewon' : 'kill');
    }
    if (e.k === 'card') cue('card');
    if (e.k === 'jangdan' && e.bat) cue('bat');
    if (e.k === 'down') cue('down');
    if (e.k === 'turn') cue('turn');
  }
}

function pump(): void {
  if (ctl.running) return;
  const step = ctl.queue.shift();
  if (!step) {
    ctl.view = ctl.battle.s;
    ctl.phase = 'player';
    ctl.stage?.setView(ctl.view, 'player');
    rerender();
    return;
  }
  const phase: 'player' | 'enemy' = step.kind === 'card' || step.ev.some((e) => e.k === 'turn') ? 'player' : 'enemy';
  if (ctl.mode === 'rough' || !ctl.stage) {
    for (const e of step.ev) if (e.k === 'fate') (globalThis as unknown as { __SLICE_FATE?: unknown }).__SLICE_FATE = { fate: e.fate, uid: e.uid, t: performance.now() };
    ctl.view = step.s;
    ctl.phase = phase;
    pump();
    return;
  }
  ctl.running = true;
  ctl.phase = phase;
  const { land, dur } = ctl.stage.playStep(step);
  const L = REDUCED ? 0 : land;
  const T = REDUCED ? 160 : Math.max(dur, land + 40);
  later(L, () => {
    for (const e of step.ev) if (e.k === 'fate') (globalThis as unknown as { __SLICE_FATE?: unknown }).__SLICE_FATE = { fate: e.fate, uid: e.uid, t: performance.now() };
    ctl.view = step.s;
    ctl.stage?.setView(step.s, phase);
    rerender();
  });
  later(T, () => {
    ctl.running = false;
    pump();
  });
  rerender();
}

function enqueue(steps: Step[]): void {
  noteSteps(steps);
  ctl.queue.push(...steps);
  pump();
  rerender();
}

export function idle(): boolean {
  return !ctl.running && ctl.queue.length === 0;
}

function doPlay(choice: ActionChoice): void {
  const s = ctl.battle.s;
  const inst = s.hand[choice.hand];
  if (!inst || !canPlay(s, inst) || s.outcome !== 0) return;
  enqueue(play(ctl.battle, choice, wouldRespond(s, inst)));
}

function doEndTurn(): void {
  if (ctl.battle.s.outcome !== 0) return;
  enqueue(endTurn(ctl.battle));
}

function start(kind: Kind, seed?: number, busy = false): void {
  for (const id of ctl.timers) clearTimeout(id);
  ctl.timers = [];
  ctl.queue = [];
  ctl.running = false;
  ctl.battle = newBattle(kind, seed);
  if (busy) stageBusyTurn(ctl.battle);
  ctl.view = ctl.battle.s;
  ctl.phase = 'player';
  ctl.tally = { haewon: 0, cheochi: 0 };
  ctl.log = [];
  ctl.stage?.setBattle(ctl.battle);
  rerender();
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitIdle(): Promise<void> {
  while (!idle()) await wait(30);
}

/** 성능 시험·녹화용 바쁜 턴: 실제 카드를 엔진으로 낸다(battle.ts stageBusyTurn) */
async function runBusy(gap = 380): Promise<{ turns: number; haewon: number; cheochi: number; outcome: number }> {
  start('normal', 5, true);
  await wait(400);
  const d = D();
  for (const step of BUSY_SCRIPT) {
    await waitIdle();
    const s = ctl.battle.s;
    if (s.turn < step.turn) {
      doEndTurn();
      await waitIdle();
      await wait(gap);
    }
    const s2 = ctl.battle.s;
    const hand = s2.hand.findIndex((c) => d.cards[c.d].id === step.card);
    if (hand < 0) throw new Error(`busy: ${step.card} not in hand`);
    const enemy = step.enemy ? s2.enemies.findIndex((e) => e.alive && d.enemies[e.def].id === step.enemy) : -1;
    doPlay(completeChoice(s2, hand, enemy >= 0 ? { enemy } : {}));
    await wait(gap);
  }
  await waitIdle();
  await wait(1800);
  return { turns: ctl.battle.s.turn, haewon: ctl.tally.haewon, cheochi: ctl.tally.cheochi, outcome: ctl.battle.s.outcome };
}

// 자동 검사(e2e · 성능 시험)가 쓰는 손잡이
(globalThis as unknown as { __SLICE: unknown }).__SLICE = {
  state: () => ({ turn: ctl.battle.s.turn, outcome: ctl.battle.s.outcome, kind: ctl.battle.kind, mode: ctl.mode, idle: idle(), hand: ctl.battle.s.hand.length, tally: { ...ctl.tally }, energy: ctl.battle.s.energy }),
  start: (k: Kind, seed?: number, busy?: boolean) => start(k, seed, busy),
  runBusy,
  setMode: (m: 'new' | 'rough') => setModeExt(m),
  setAuto: (v: boolean) => {
    ctl.auto = v;
    rerender();
  },
  stage: () => ctl.stage ? { firstFrameAt: ctl.stage.firstFrameAt, ...ctl.stage.stats() } : null,
  reduced: REDUCED,
  silhouettes: () => silhouetteSheet(),
  clearSel: () => clearSel(),
  /** 개발용: 무대 객체(겹 켜고 끄기로 비용 재기) */
  debugStage: () => ctl.stage,
};
let clearSel: () => void = () => {};
let setModeExt: (m: 'new' | 'rough') => void = (m) => {
  ctl.mode = m;
};

// ── 화면 ─────────────────────────────────────────────────────────────
const ROUGH_RUN = { region: 1, pos: { kind: 'tile', cor: 0, i: 0 }, light: LIGHT, revealed: ['jeojeun_neok', 'heogijin_neok', 'sakkun'], dungeon: { rooms: [] } } as unknown as Run;

export function SliceApp() {
  const [, force] = useReducer((x: number) => x + 1, 0);
  rerender = () => force(0);
  const [mode, setMode] = useState<'new' | 'rough'>('new');
  const [sel, setSel] = useState<Sel | null>(null);
  const [gallery, setGallery] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  setModeExt = (m) => {
    ctl.mode = m;
    setMode(m);
  };
  clearSel = () => setSel(null);
  ctl.mode = mode;

  // 무대 만들기 (모듈 평가가 끝난 뒤 — PixiJS 렌더러가 늦게 붙는 모듈을 쓴다)
  useEffect(() => {
    let dead = false;
    if (!host.current) return;
    document.documentElement.style.setProperty('--sl-hanji', `url(${hanjiUrl()})`);
    SliceStage.create(host.current, { reduced: REDUCED, light: LIGHT }).then((st) => {
      if (dead) {
        st.destroy();
        return;
      }
      ctl.stage = st;
      st.setBattle(ctl.battle);
      rerender();
    }).catch((e) => {
      console.error(e);
    });
    return () => {
      dead = true;
      ctl.stage?.destroy();
      ctl.stage = null;
    };
  }, []);
  useEffect(() => {
    ctl.stage?.pause(mode === 'rough');
    if (mode === 'new' && ctl.stage) ctl.stage.setView(ctl.view, ctl.phase);
  }, [mode]);

  // 자동 진행(봇): 연출이 끝날 때마다 한 수
  useEffect(() => {
    if (!ctl.auto || !idle() || ctl.battle.s.outcome !== 0) return;
    const t = setTimeout(() => {
      if (!ctl.auto || !idle() || ctl.battle.s.outcome !== 0) return;
      const c = botChoice(ctl.battle.s);
      if (c) doPlay(c);
      else doEndTurn();
    }, REDUCED ? 60 : 420);
    return () => clearTimeout(t);
  });

  const s = ctl.battle.s;
  const view = mode === 'rough' ? s : ctl.view;
  const d = D();
  const busy = !idle() && ctl.phase === 'enemy';
  const step = sel ? sel.steps[sel.step] : undefined;
  const selInst = sel ? s.hand[sel.hand] : undefined;
  useEffect(() => {
    if (sel && !selInst) setSel(null);
  });

  const playSel = (hand: number, partial: Partial<ActionChoice>) => {
    doPlay(completeChoice(s, hand, partial));
    setSel(null);
  };
  const advance = (cur: Sel, patch: Partial<ActionChoice>) => {
    const next = { ...cur, partial: { ...cur.partial, ...patch }, step: cur.step + 1, pairFirst: -1 };
    if (next.step >= next.steps.length) playSel(next.hand, next.partial);
    else setSel(next);
  };
  const clickCard = (i: number) => {
    if (busy) return;
    const inst = s.hand[i];
    if (sel && sel.hand === i) {
      if (canPlay(s, inst) && sel.step >= sel.steps.length) playSel(i, sel.partial);
      else if (!canPlay(s, inst)) setSel(null);
      return;
    }
    setSel({ hand: i, steps: canPlay(s, inst) ? targetSteps(s, inst) : [], step: 0, partial: {}, pairFirst: -1 });
  };
  const clickEnemy = (ei: number) => {
    if (!sel || step !== 'enemy' || !s.enemies[ei].alive) return;
    advance(sel, { enemy: ei });
  };
  const clickHero = (hi: number) => {
    if (!sel || !step) return;
    const h = s.heroes[hi];
    const inst = s.hand[sel.hand];
    if (step === 'ally' && !h.dead && hi !== inst.o) return advance(sel, { ally: hi });
    if (step === 'downed' && h.downed) return advance(sel, { ally: hi });
    if (step === 'blockAlly' && standing(h)) return advance(sel, { ally: hi });
    if (step === 'pair' && s.formation.includes(hi)) {
      if (sel.pairFirst < 0) return setSel({ ...sel, pairFirst: hi });
      if (sel.pairFirst !== hi) return advance(sel, { pair: [sel.pairFirst, hi] });
    }
  };
  const heroTargetable = (h: HeroState): boolean => {
    if (!sel || !step) return false;
    const inst = s.hand[sel.hand];
    if (step === 'ally') return !h.dead && h.idx !== inst?.o;
    if (step === 'downed') return h.downed;
    if (step === 'blockAlly') return standing(h);
    if (step === 'pair') return s.formation.includes(h.idx) && h.idx !== sel.pairFirst;
    return false;
  };
  const enemyTargetable = (ei: number) => step === 'enemy' && s.enemies[ei].alive;
  const inc = incomingByHero(view);
  const stepHint: Record<TargetStep, string> = {
    enemy: '대상 원귀를 고른다', ally: '함께할 아군을 고른다', downed: '쓰러진 아군을 고른다', pair: '자리를 바꿀 두 영웅을 차례로 고른다', blockAlly: '방어도·회복을 받을 아군을 고른다',
  };
  const selDef = selInst ? d.cards[selInst.d] : null;
  const prev = s.prevOwners;
  const prevLabel = prev === null ? '턴의 첫 카드 — 받는소리 없음' : prev[0] === -1 ? '직전: 파티 카드' : `직전: ${prev.map((o) => heroName(s.heroes[o].id)).join('·')}`;
  const prevColor = prev && prev[0] >= 0 ? HERO_COLOR[s.heroes[prev[0]].id] : '#6b6355';
  const encName = [...new Set(d.encounterById.get(ENC[ctl.battle.kind])!.enemies.map((id) => d.enemyById.get(id)!.name))].join(' · ');
  const ended = s.outcome !== 0 && idle();

  const cs = { s, meta: { tier: ctl.battle.kind === 'boss' ? 'boss' : 'battle', special: 'none' } } as unknown as CombatSession;

  return (
    <div class={`sl-app mode-${mode}`} data-testid="slice" data-mode={mode}>
      <SceneDefs />
      <div class="sl-top">
        <b class="sl-title">저승굿 · 그래픽 슬라이스</b>
        <span class="chip lamp" data-testid="turn">턴 {s.turn}</span>
        <span class={`chip ${ctl.battle.kind === 'boss' ? 'red' : ''}`}>{ctl.battle.kind === 'boss' ? '보스' : '일반 전투'} · {encName}</span>
        <span class="chip dim-chip">1막 건너지 못한 나루 · 넋등 {LIGHT}</span>
        {busy && <span class="chip" data-testid="enemy-phase">원귀의 차례…</span>}
        <span class="spacer" />
        <span class="sl-seg" role="group" aria-label="그림 견주기">
          <button class={`btn small ${mode === 'new' ? 'on' : ''}`} data-testid="mode-new" aria-pressed={mode === 'new'} onClick={() => setModeExt('new')}>새 그림</button>
          <button class={`btn small ${mode === 'rough' ? 'on' : ''}`} data-testid="mode-rough" aria-pressed={mode === 'rough'} onClick={() => setModeExt('rough')}>러프</button>
        </span>
        <button class="btn small" data-testid="start-normal" onClick={() => start('normal')}>일반 전투</button>
        <button class="btn small" data-testid="start-boss" onClick={() => start('boss')}>보스</button>
        <button class={`btn small ghost ${ctl.auto ? 'on' : ''}`} data-testid="auto" aria-pressed={ctl.auto} onClick={() => { ctl.auto = !ctl.auto; rerender(); }}>자동 {ctl.auto ? '켬' : '끔'}</button>
        <SoundToggle />
        <button class="btn small ghost" data-testid="gallery-open" onClick={() => setGallery(true)}>카드 보기</button>
        <button class="btn small ghost" onClick={() => setShowLog(!showLog)}>기록</button>
      </div>

      <div class="sl-stage-wrap">
        <div class="sl-stage" data-testid="stage">
          <div class="sl-host" ref={host} style={{ visibility: mode === 'new' ? 'visible' : 'hidden' }} />
          {mode === 'new' && (
            <StageOverlay s={view} phase={ctl.phase} inc={inc} enemyTargetable={enemyTargetable} heroTargetable={heroTargetable} onEnemy={clickEnemy} onHero={clickHero} />
          )}
          {mode === 'rough' && (
            <div class="sl-rough">
              <CombatStage cs={cs} run={ROUGH_RUN} inc={incomingByHero(s)} enemyTargetable={enemyTargetable} heroTargetable={heroTargetable} onEnemy={clickEnemy} onHero={clickHero} />
            </div>
          )}
          {!ctl.stage && mode === 'new' && <div class="sl-loading">무대를 그리는 중…</div>}
        </div>
      </div>

      {mode === 'new' ? (
        <div class="sl-dock">
          <div class="sl-left">
            <div class="sl-energy" data-testid="energy" title="에너지 (파티 공유)"><span>{s.energy}</span><small>/3</small></div>
            <Drums n={s.jangdan} />
            <div class="sl-last" data-testid="last-owner" style={{ '--oc': prevColor } as CSSProperties}><i />{prevLabel}</div>
            <div class="sl-piles"><span title="뽑을 더미">뽑을 <b>{s.draw.length}</b></span><span title="버린 더미">버린 <b>{s.discard.length}</b></span>{s.exhaust.length > 0 && <span>소멸 <b>{s.exhaust.length}</b></span>}</div>
          </div>
          <div class="sl-hand-wrap">
            <div class={`sl-hand ${busy ? 'wait' : ''}`} data-testid="hand" style={{ '--n': Math.max(1, s.hand.length) } as CSSProperties}>
              {s.hand.map((c, i) => {
                const def = d.cards[c.d];
                const ok = canPlay(s, c) && !busy;
                return <CardFrame key={`${i}-${c.d}-${c.o}`} def={def} inst={c} party={PARTY} dis={!ok} sel={sel?.hand === i} resp={ok && wouldRespond(s, c) && !def.unplayable} onClick={() => clickCard(i)} testid={`hand-${i}`} />;
              })}
              {s.hand.length === 0 && <div class="dim small">손이 비었다.</div>}
            </div>
          </div>
          <div class="sl-right">
            <div class="sl-hint">
              {sel && selDef ? (
                <>
                  {step ? <b>{stepHint[step]}</b> : canPlay(s, s.hand[sel.hand]) ? <b>한 번 더 누르거나 「낸다」</b> : <span class="dim">지금은 낼 수 없다</span>}
                  <span class="row">
                    {!step && canPlay(s, s.hand[sel.hand]) && <button class="btn small primary" data-testid="play-card" onClick={() => playSel(sel.hand, sel.partial)}>낸다</button>}
                    <button class="btn small" onClick={() => setSel(null)}>취소</button>
                  </span>
                </>
              ) : <span class="dim small">카드를 누르면 풀이와 대상이 나온다. 붉은 「받」 = 지금 내면 받는소리.</span>}
            </div>
            {sel && selDef && (
              <div class="sl-detail">
                <div class="dn">{selDef.name}{selDef.upgraded ? '+' : ''} <span class="tiny dim">비용 {selInst ? costOf(s, selInst) : selDef.cost}</span></div>
                <div class="small"><KwText text={selDef.text} /></div>
                <TermList text={selDef.text} />
              </div>
            )}
            <button class="btn primary sl-end" data-testid="end-turn" disabled={busy} onClick={() => { setSel(null); doEndTurn(); }}>턴 종료</button>
          </div>
        </div>
      ) : (
        <RoughDock s={s} busy={busy} sel={sel} onCard={clickCard} prevLabel={prevLabel} prevColor={prevColor} onEnd={() => { setSel(null); doEndTurn(); }} onPlay={sel && !step && canPlay(s, s.hand[sel.hand]) ? () => playSel(sel.hand, sel.partial) : null} />
      )}

      {ended && (
        <div class="sl-end-panel" data-testid="battle-end">
          <b>{s.outcome === 1 ? '전투가 끝났다' : '파티가 쓰러졌다'}</b>
          <span>해원 {ctl.tally.haewon} · 처치 {ctl.tally.cheochi} · {s.turn}턴</span>
          <span class="row">
            <button class="btn small primary" onClick={() => start(ctl.battle.kind)}>다시</button>
            <button class="btn small" onClick={() => start(ctl.battle.kind === 'boss' ? 'normal' : 'boss')}>{ctl.battle.kind === 'boss' ? '일반 전투로' : '보스 전투로'}</button>
          </span>
        </div>
      )}
      {showLog && <div class="panel sl-log">{ctl.log.slice(-20).reverse().map((l, i) => <div key={i}>{l}</div>)}{(s.log ?? []).slice(-24).reverse().map((l, i) => <div key={`e${i}`} class="dim">{l}</div>)}</div>}
      {gallery && <Gallery onClose={() => setGallery(false)} />}
    </div>
  );
}

function Drums({ n }: { n: number }) {
  const beat = [1.4, 1.1, 0.85, 0.62, 0.45, 0.32][n] ?? 1.2;
  const [pop, setPop] = useState(-1);
  const prev = useRef(n);
  useEffect(() => {
    if (n > prev.current) {
      setPop(n);
      const t = setTimeout(() => setPop(-1), 360);
      prev.current = n;
      return () => clearTimeout(t);
    }
    prev.current = n;
  }, [n]);
  return (
    <div class="sl-jangdan" data-testid="jangdan" title="장단: 주인이 바뀔 때마다 +1(받는소리), 턴이 끝나면 0">
      <div class="lab">장단 <b>{n}</b>/5</div>
      <div class="sl-drums" style={{ '--beat': `${beat}s` } as CSSProperties}>
        {[1, 2, 3, 4, 5].map((i) => <span key={i} class={`sl-drum ${i <= n ? 'on' : ''} ${i === pop ? 'pop' : ''}`}><i /></span>)}
      </div>
    </div>
  );
}

function RoughDock({ s, busy, sel, onCard, prevLabel, prevColor, onEnd, onPlay }: { s: CombatState; busy: boolean; sel: Sel | null; onCard: (i: number) => void; prevLabel: string; prevColor: string; onEnd: () => void; onPlay: (() => void) | null }) {
  const d = D();
  return (
    <div class="dock sl-rough-dock">
      <div class="dock-left">
        <div class="control-row">
          <div class="energy" data-testid="energy">{s.energy}<small>/3</small></div>
          <Jangdan n={s.jangdan} />
        </div>
        <span class="lastowner" style={{ '--oc': prevColor } as CSSProperties}><i />{prevLabel}</span>
        <div class="control-row"><span class="pile">뽑을 <b>{s.draw.length}</b></span><span class="pile">버린 <b>{s.discard.length}</b></span></div>
      </div>
      <div class="hand-wrap">
        <div class="hand" data-testid="hand" style={{ '--n': Math.max(1, s.hand.length) } as CSSProperties}>
          {s.hand.map((c, i) => {
            const def = d.cards[c.d];
            const ok = canPlay(s, c) && !busy;
            return <CardView key={`${i}-${c.d}-${c.o}`} def={def} inst={c} party={PARTY} dis={!ok} sel={sel?.hand === i} resp={ok && wouldRespond(s, c) && !def.unplayable} onClick={() => onCard(i)} testid={`hand-${i}`} />;
          })}
        </div>
      </div>
      <div class="dock-right">
        <div class="target-hint">{onPlay ? <button class="btn small primary" data-testid="play-card" onClick={onPlay}>낸다</button> : <span class="dim small">러프 그래픽(지금 플레이어블)</span>}</div>
        <button class="btn primary end-turn" data-testid="end-turn" disabled={busy} onClick={onEnd}>턴 종료</button>
      </div>
    </div>
  );
}

function Gallery({ onClose }: { onClose: () => void }) {
  const d = D();
  const ids = PARTY.flatMap((h) => d.starters.get(h)!.map((c) => c.id));
  return (
    <div class="overlay" data-testid="gallery" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="sheet sl-gallery" role="dialog" aria-modal="true">
        <div class="row"><h2>슬라이스 덱 — 새 카드 틀 · 완성 삽화</h2><span class="spacer" /><button class="btn small" onClick={onClose}>닫기</button></div>
        <p class="small dim">윗줄: 기본 카드 · 아랫줄: 강화판(금박 테두리 · 「강」 인장 · 이름 +). 오른쪽 끝은 같은 카드의 러프(스케치 · 부적 틀).</p>
        <div class="sl-gal-grid">
          {ids.map((id) => {
            const def = d.cardById.get(id)!;
            const up = d.cardById.get(`${id}+`);
            const inst = { d: def.idx, o: PARTY.indexOf(def.heroes[0]), o2: -1, orig: -1, x: -1 };
            return (
              <div key={id} class="sl-gal-cell">
                <CardFrame def={def} inst={inst} party={PARTY} big />
                {up && <CardFrame def={up} inst={{ ...inst, d: up.idx }} party={PARTY} big />}
                <div class="sl-gal-rough"><CardView def={def} inst={inst} party={PARTY} /></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
