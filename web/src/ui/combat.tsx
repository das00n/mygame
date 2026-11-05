// 전투 화면: 측면 종이 무대(영웅 3칸 · 굿상 · 원귀 · 의도 실 — scene/stage.tsx) + 아래 손패 띠(에너지·장단·받는소리 · 손패 · 턴 종료·대상 안내).
// PC 배치(10-presentation §4.9): 무대 위, 손패 가운데 아래, 에너지·더미 왼쪽 아래, 턴 종료·풀이 오른쪽 아래.

import type { CSSProperties } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { canPlay, costOf, standing } from '../../../src/core/engine.ts';
import type { ActionChoice, CardInst, CombatState, HeroState } from '../../../src/core/types.ts';
import {
  canFlee, completeChoice, endTurn, fleeChance, incomingByHero, playChoice, PLAY_TURNS, targetSteps, tryFlee, useCandleInCombat,
  wouldRespond, type TargetStep,
} from '../game/combat.ts';
import { D, HERO_COLOR, REGION_JSON, bandOf } from '../game/content.ts';
import { heroName } from '../game/run.ts';
import { app, commit, setPanel } from '../game/store.ts';
import type { Run } from '../game/types.ts';
import { AutoToggle } from './auto.tsx';
import { CardView, Jangdan, KwText, Overlay, TermList } from './common.tsx';
import { CombatStage } from './scene/stage.tsx';
import { SoundToggle } from './scene/sound-toggle.tsx';

interface Sel {
  hand: number;
  steps: TargetStep[];
  step: number;
  partial: Partial<ActionChoice>;
  pairFirst: number;
}

export function CombatScreen() {
  const cs = app.combat!;
  const run = app.run!;
  const s = cs.s;
  const d = D();
  const [sel, setSel] = useState<Sel | null>(null);
  const [pile, setPile] = useState<null | 'draw' | 'discard' | 'exhaust'>(null);
  const [showLog, setShowLog] = useState(false);
  const [fleeAsk, setFleeAsk] = useState(false);
  const inc = incomingByHero(s);
  const step = sel ? sel.steps[sel.step] : undefined;
  // 손패가 바뀌면(자동 진행 등) 고르던 것을 놓는다
  const selInst = sel ? s.hand[sel.hand] : undefined;
  useEffect(() => {
    if (sel && !selInst) setSel(null);
  });

  const play = (hand: number, partial: Partial<ActionChoice>) => {
    playChoice(app, completeChoice(s, hand, partial));
    setSel(null);
    commit();
  };
  const advance = (cur: Sel, patch: Partial<ActionChoice>) => {
    const next = { ...cur, partial: { ...cur.partial, ...patch }, step: cur.step + 1, pairFirst: -1 };
    if (next.step >= next.steps.length) play(next.hand, next.partial);
    else setSel(next);
  };
  const clickCard = (i: number) => {
    const inst = s.hand[i];
    if (sel && sel.hand === i) {
      if (canPlay(s, inst) && sel.step >= sel.steps.length) play(i, sel.partial);
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

  const prev = s.prevOwners;
  const prevLabel = prev === null ? '턴의 첫 카드 — 받는소리 없음' : prev[0] === -1 ? '직전: 파티 카드' : `직전: ${prev.map((o) => heroName(s.heroes[o].id)).join('·')}`;
  const prevColor = prev && prev[0] >= 0 ? HERO_COLOR[s.heroes[prev[0]].id] : '#6b6355';
  const powers = s.powerZone.map((c) => d.cards[c.d].name);
  const stepHint: Record<TargetStep, string> = {
    enemy: '대상 적을 고른다',
    ally: '함께할 아군을 고른다',
    downed: '쓰러진 아군을 고른다',
    pair: sel && sel.pairFirst >= 0 ? `${heroName(s.heroes[sel.pairFirst].id)}와(과) 자리를 바꿀 영웅을 고른다` : '자리를 바꿀 두 영웅을 차례로 고른다',
    blockAlly: '방어도·회복을 받을 아군을 고른다',
  };
  const selDef = selInst ? d.cards[selInst.d] : null;

  const hint = sel && selDef ? (
    <>
      {step ? <b>{stepHint[step]}</b> : canPlay(s, s.hand[sel.hand]) ? <b>한 번 더 누르거나 「낸다」</b> : <span class="dim">지금은 낼 수 없다</span>}
      <span class="row" style={{ gap: '6px' }}>
        {!step && canPlay(s, s.hand[sel.hand]) && <button class="btn small primary" data-testid="play-card" onClick={() => play(sel.hand, sel.partial)}>낸다</button>}
        <button class="btn small" onClick={() => setSel(null)}>취소</button>
      </span>
    </>
  ) : <span class="dim small">카드를 누르면 풀이와 대상이 나온다. 붉은 「받」 = 지금 내면 받는소리.</span>;

  return (
    <div class="screen combat" data-testid="combat">
      <Feed />
      <div class="combat-top">
        <span class="chip lamp">턴 {s.turn}</span>
        {cs.meta.tier === 'boss' && <span class="chip red">보스</span>}
        {cs.meta.tier === 'elite' && <span class="chip red">수호 방</span>}
        {cs.meta.special === 'play' && <span class="chip">놀이 싸움 — 피해는 귀기로 · {Math.min(PLAY_TURNS, s.turn)}/{PLAY_TURNS}턴</span>}
        {cs.meta.special === 'escort' && <span class="chip">호위 — 세 턴을 버텨라 ({Math.min(3, s.turn - 1)}/3)</span>}
        {s.ward && <span class={`chip ${s.ward.hp <= 8 ? 'red' : ''}`} data-testid="ward" title="선두에 방어도가 없으면 선두를 노린 공격을 이 사람이 맞는다">잘못 끌려온 사람 {s.ward.hp}/{s.ward.maxHp}</span>}
        {s.gangsin && <span class="chip lamp">강신!</span>}
        <span class="chip dim-chip">{REGION_JSON[run.region ?? 1].region.name}</span>
        <span class="spacer" />
        <span class="chip lamp" data-testid="light" title="넋등 — 전투 중 촛불로 +25. 어두울수록 무대 가장자리가 어둡다">넋등 {run.light} · {bandOf(run.light).name}</span>
        <SoundToggle />
        <AutoToggle />
        <button class="btn small ghost" onClick={() => setShowLog(!showLog)} data-testid="toggle-log">기록</button>
        <button class="btn small ghost" onClick={() => setPanel('gloss')}>용어</button>
      </div>

      {s.entertain && (
        <div class="deity" data-testid="deity" title="손님은 원귀가 아니라 신령이다. 공격할 수 없다 — 대접해 좋게 보낸다">
          <span class="dn">손님</span>
          <span class="meter"><i style={{ width: `${Math.min(100, (s.entertain.value / s.entertain.goal) * 100)}%` }} /></span>
          <b>대접 {s.entertain.value}/{s.entertain.goal}</b>
          <span class="tiny dim">{Math.min(s.turn, s.entertain.limit)}/{s.entertain.limit}턴 · 차례마다 대접이 (지난 턴 × 2)보다 적으면 서운해 선두에 신열, 아니면 흐뭇해 귀기 −2</span>
          <span class="tiny">손님상 차리기(술·쌀) +3 · 턴 끝 굿상 설치물 +1(최대 2) · 장단 3+ +1 · 부적 낸 턴 +1 · 수비가 물러가면 +1</span>
        </div>
      )}
      <div class="stage-wrap">
        <CombatStage cs={cs} run={run} inc={inc}
          enemyTargetable={(ei) => step === 'enemy' && s.enemies[ei].alive}
          heroTargetable={heroTargetable}
          onEnemy={clickEnemy} onHero={clickHero} />
      </div>

      <div class="dock">
        <div class="dock-left">
          <div class="control-row">
            <div class="energy" data-testid="energy" title="에너지 (파티 공유)">{s.energy}<small>/3</small></div>
            <Jangdan n={s.jangdan} />
          </div>
          <span class="lastowner" data-testid="last-owner" style={{ '--oc': prevColor } as CSSProperties}><i />{prevLabel}</span>
          <div class="control-row">
            <button class="pile" onClick={() => setPile('draw')} data-testid="pile-draw" title="뽑을 · 버린 · 소멸 더미 보기">뽑을 <b>{s.draw.length}</b></button>
            <button class="pile" onClick={() => setPile('discard')} title="버린 더미">버린 <b>{s.discard.length}</b></button>
            {s.exhaust.length > 0 && <button class="pile" onClick={() => setPile('exhaust')} title="소멸">소멸 <b>{s.exhaust.length}</b></button>}
          </div>
        </div>
        <div class="hand-wrap">
          <div class="hand" data-testid="hand" style={{ '--n': Math.max(1, s.hand.length) } as CSSProperties}>
            {s.hand.map((c, i) => {
              const def = d.cards[c.d];
              const ok = canPlay(s, c);
              return (
                <CardView key={`${i}-${c.d}-${c.o}`} def={def} inst={c} party={run.party} dis={!ok} sel={sel?.hand === i} resp={ok && wouldRespond(s, c) && !def.unplayable} onClick={() => clickCard(i)} testid={`hand-${i}`} />
              );
            })}
            {s.hand.length === 0 && <div class="dim small" style={{ padding: '30px 8px' }}>손이 비었다.</div>}
          </div>
        </div>
        <div class="dock-right">
          <div class="target-hint">{hint}</div>
          {sel && selDef && (
            <div class="detail">
              <div class="dname">{selDef.name}{selDef.upgraded ? '+' : ''} <span class="tiny dim">비용 {selInst ? costOf(s, selInst) : selDef.cost}</span></div>
              <div class="small"><KwText text={selDef.text} /></div>
              {selInst && selInst.o >= 0 && s.heroes[selInst.o] && !standing(s.heroes[selInst.o]) && selInst.d !== d.special.rescue && selInst.d !== d.special.mourn && <div class="small warn">주인이 쓰러져 있어 낼 수 없다.</div>}
              {selDef.requireGangsin && !s.gangsin && <div class="small warn">강신 중에만 낼 수 있다.</div>}
              {selInst && costOf(s, selInst) > s.energy && <div class="small warn">에너지가 모자라다.</div>}
              <TermList text={selDef.text} />
            </div>
          )}
          {fleeAsk && (
            <div class="confirm col" style={{ padding: '6px 8px', gap: '4px' }}>
              <span class="small">도주: 실패하면 이번 턴이 끝난다. 성공하면 직전 방으로, 귀기 +25.</span>
              <span class="row"><button class="btn small primary" onClick={() => { setFleeAsk(false); tryFlee(app); commit(); }}>도주</button><button class="btn small" onClick={() => setFleeAsk(false)}>아니</button></span>
            </div>
          )}
          <div class="control-row">
            {run.supplies.candle > 0 && <button class="btn small" data-testid="combat-candle" title="넋등 +25, 손패의 그늘 소멸" onClick={() => { useCandleInCombat(app); commit(); }}>촛불 {run.supplies.candle}</button>}
            {canFlee(app) && !fleeAsk && <button class="btn small ghost" onClick={() => setFleeAsk(true)}>도주 {Math.round(fleeChance(app) * 100)}%</button>}
          </div>
          <button class="btn primary end-turn" data-testid="end-turn" onClick={() => { setSel(null); endTurn(app); commit(); }}>턴 종료</button>
        </div>
      </div>

      {showLog && (
        <div class="panel log-pop"><div class="combat-log" data-testid="combat-log">{cs.meta.log.slice(-60).reverse().map((l, i) => <div key={i}>{l}</div>)}</div></div>
      )}
      {pile && <PileView s={s} run={run} pile={pile} onClose={() => setPile(null)} />}
    </div>
  );
}

function Feed() {
  const cs = app.combat;
  const n = cs?.meta.toasts.length ?? 0;
  useEffect(() => {
    if (!n) return;
    const t = setTimeout(() => {
      if (app.combat && app.combat.meta.toasts.length) {
        app.combat.meta.toasts.shift();
        commit();
      }
    }, 2600);
    return () => clearTimeout(t);
  }, [n, cs]);
  if (!cs || !n) return null;
  return <div class="feed" data-testid="feed">{cs.meta.toasts.slice(-3).map((t, i) => <div key={`${i}-${t.text}`} class={t.tone}>{t.text}</div>)}</div>;
}

function PileView({ s, run, pile, onClose }: { s: CombatState; run: Run; pile: 'draw' | 'discard' | 'exhaust'; onClose: () => void }) {
  const d = D();
  const [tab, setTab] = useState(pile);
  const list: CardInst[] = (tab === 'draw' ? s.draw.slice().sort((a, b) => d.cards[a.d].name.localeCompare(d.cards[b.d].name, 'ko')) : tab === 'discard' ? s.discard : s.exhaust).slice();
  const tabs: ['draw' | 'discard' | 'exhaust', string, number][] = [['draw', '뽑을 더미', s.draw.length], ['discard', '버린 더미', s.discard.length], ['exhaust', '소멸', s.exhaust.length]];
  return (
    <Overlay onClose={onClose} testid="pile">
      <div class="row"><h2>더미</h2><span class="spacer" /><button class="btn small" onClick={onClose}>닫기</button></div>
      <div class="row">{tabs.map(([k, label, n]) => <button key={k} class={`btn small ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{label} {n}</button>)}</div>
      {tab === 'draw' && <div class="small dim">뽑을 더미의 순서는 감춘다 (이름순).</div>}
      <div class="deck-list">{list.map((c, i) => <CardView key={i} def={d.cards[c.d]} inst={c} party={run.party} />)}</div>
      {!list.length && <div class="dim">비었다.</div>}
    </Overlay>
  );
}
