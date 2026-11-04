// 전투 화면: 적(의도: 행동·대상 칸·피해), 굿상, 영웅 3칸, 에너지·장단·받는소리, 손패(부적 카드), 더미, 기록, 대상 고르기.

import type { CSSProperties } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { canPlay, capActive, collapsed, costOf, deathSaveChance, popcount, standing } from '../../../src/core/engine.ts';
import { KNOTS } from '../../../src/core/types.ts';
import type { ActionChoice, CardInst, CombatState, HeroState } from '../../../src/core/types.ts';
import {
  canFlee, completeChoice, endTurn, fleeChance, haewonView, incomingByHero, intentView, playChoice, PLAY_TURNS, slotName, targetSteps, tryFlee, useCandleInCombat,
  wouldRespond, type TargetStep,
} from '../game/combat.ts';
import { D, ENEMY_EXTRA, HERO_COLOR, bandOf } from '../game/content.ts';
import { heroName } from '../game/run.ts';
import { app, commit, setPanel } from '../game/store.ts';
import type { Run } from '../game/types.ts';
import { AutoToggle } from './auto.tsx';
import { CardView, Icon, Jangdan, Overlay, Pips, St, TermList } from './common.tsx';

interface Sel {
  hand: number;
  steps: TargetStep[];
  step: number;
  partial: Partial<ActionChoice>;
  pairFirst: number;
}

const POS_ORDER: Record<string, number> = { front: 0, any: 1, back: 2 };

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

  const enemyOrder = s.enemies.map((_, i) => i).sort((a, b) => {
    const pa = POS_ORDER[ENEMY_EXTRA.get(d.enemies[s.enemies[a].def].id)?.position ?? 'any'] ?? 1;
    const pb = POS_ORDER[ENEMY_EXTRA.get(d.enemies[s.enemies[b].def].id)?.position ?? 'any'] ?? 1;
    return pa - pb || a - b;
  });
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
        <span class="spacer" />
        <span class="chip lamp" data-testid="light" title="넋등 — 전투 중 촛불로 +25">넋등 {run.light} · {bandOf(run.light).name}</span>
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
      <div class="field">
        <div class="col" style={{ gap: '6px' }}>
          <div class={`heroes-row`} data-testid="heroes">
            {[...s.formation, ...s.heroes.filter((h) => h.dead).map((h) => h.idx)].map((hi) => (
              <HeroPanel key={hi} s={s} h={s.heroes[hi]} inc={inc[hi] ?? 0} targetable={heroTargetable(s.heroes[hi])} onClick={() => clickHero(hi)} />
            ))}
          </div>
          <div class="altar-row" data-testid="altar">
            <span class="dim tiny">굿상</span>
            {s.summons.length === 0 && <span class="faint tiny">비었다</span>}
            {s.summons.map((x, i) => {
              const sd = d.summons[x.s];
              return <span key={i} class="altar" title={sd.text}><Icon name="altar" size={12} />{sd.name} · {sd.trigger === 'turn_end' ? '턴 끝' : '턴 시작'} {x.left}</span>;
            })}
            {powers.length > 0 && <span class="tiny dim">능력: {powers.join(' · ')}</span>}
          </div>
        </div>
        <div class={`enemies-row n${s.enemies.length}`} data-testid="enemies">
          {enemyOrder.map((ei) => (
            <EnemyPanel key={s.enemies[ei].uid} s={s} run={run} ei={ei} targetable={step === 'enemy' && s.enemies[ei].alive} onClick={() => clickEnemy(ei)} />
          ))}
        </div>
      </div>

      <div class="lower">
        <div class="col" style={{ gap: '8px' }}>
          <div class="control-row">
          <div class="energy" data-testid="energy" title="에너지 (파티 공유)">{s.energy}<small>/3</small></div>
          <Jangdan n={s.jangdan} />
          <span class="lastowner" data-testid="last-owner" style={{ '--oc': prevColor } as CSSProperties}><i />{prevLabel}</span>
        </div>
        <div class="control-row">
          <button class="pile" onClick={() => setPile('draw')} data-testid="pile-draw" title="뽑을 · 버린 · 소멸 더미 보기">더미 <b>{s.draw.length}</b>·{s.discard.length}·{s.exhaust.length}</button>
          {run.supplies.candle > 0 && <button class="btn small" data-testid="combat-candle" title="넋등 +25, 손패의 그늘 소멸" onClick={() => { useCandleInCombat(app); commit(); }}>촛불 {run.supplies.candle}</button>}
          {canFlee(app) && !fleeAsk && <button class="btn small ghost" onClick={() => setFleeAsk(true)}>도주 {Math.round(fleeChance(app) * 100)}%</button>}
          <span class="spacer" />
          <button class="btn primary" data-testid="end-turn" onClick={() => { setSel(null); endTurn(app); commit(); }}>턴 종료</button>
        </div>
        {fleeAsk && (
          <div class="row confirm" style={{ padding: '6px 8px' }}>
            <span class="small">도주: 실패하면 이번 턴이 끝난다. 성공하면 직전 방으로, 귀기 +25.</span>
            <button class="btn small primary" onClick={() => { setFleeAsk(false); tryFlee(app); commit(); }}>도주</button>
            <button class="btn small" onClick={() => setFleeAsk(false)}>아니</button>
          </div>
        )}

        <div class="target-hint">
          {sel && selDef && (
            <>
              {step ? <b>{stepHint[step]}</b> : canPlay(s, s.hand[sel.hand]) ? <b>한 번 더 누르거나 「낸다」</b> : <span class="dim">지금은 낼 수 없다</span>}
              {!step && canPlay(s, s.hand[sel.hand]) && <button class="btn small primary" data-testid="play-card" onClick={() => play(sel.hand, sel.partial)}>낸다</button>}
              <button class="btn small" onClick={() => setSel(null)}>취소</button>
            </>
          )}
          {!sel && <span class="dim small">카드를 누르면 풀이와 대상이 나온다. 붉은 「받」 = 지금 내면 받는소리.</span>}
        </div>

        </div>
        {sel && selDef && (
          <div class="detail">
            <CardView def={selDef} inst={selInst} party={run.party} big />
            <div class="col" style={{ gap: '4px' }}>
              {selInst && selInst.o >= 0 && s.heroes[selInst.o] && !standing(s.heroes[selInst.o]) && selInst.d !== d.special.rescue && selInst.d !== d.special.mourn && <div class="small" style={{ color: '#ffb3a3' }}>주인이 쓰러져 있어 낼 수 없다.</div>}
              {selDef.requireGangsin && !s.gangsin && <div class="small" style={{ color: '#ffb3a3' }}>강신 중에만 낼 수 있다.</div>}
              {selInst && costOf(s, selInst) > s.energy && <div class="small" style={{ color: '#ffb3a3' }}>에너지가 모자라다.</div>}
              <TermList text={selDef.text} />
            </div>
          </div>
        )}

      </div>

      <div class="hand-wrap">
        <div class="hand" data-testid="hand">
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

      {showLog && (
        <div class="panel"><div class="combat-log" data-testid="combat-log">{cs.meta.log.slice(-60).reverse().map((l, i) => <div key={i}>{l}</div>)}</div></div>
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

function EnemyPanel({ s, run, ei, targetable, onClick }: { s: CombatState; run: Run; ei: number; targetable: boolean; onClick: () => void }) {
  const d = D();
  const e = s.enemies[ei];
  const def = d.enemies[e.def];
  const iv = intentView(s, ei);
  const hv = haewonView(run, s, ei);
  const doomW = Math.min(e.doom, Math.max(0, e.hp)) / e.maxHp;
  const executes = e.alive && e.doom > 0 && e.doom >= (s.seokja && e.bound ? Math.ceil(e.hp / 2) : e.hp);
  const coll = collapsed(s, e);
  return (
    <div class={`enemy ${def.category === 'boss' ? 'boss' : ''} ${targetable ? 'targetable' : ''} ${!e.alive ? 'gone' : ''}`} onClick={targetable ? onClick : undefined} data-testid={`enemy-${ei}`} role={targetable ? 'button' : undefined}>
      <div class="ename">{def.name}{def.category === 'elite' && <span class="tiny" style={{ color: 'var(--cinnabar-2)' }}> · 수호</span>}{e.summoned && <span class="tiny faint"> · 불려 나옴</span>}</div>
      {e.alive && e.intent >= 0 && (
        <div class={`intent ${iv.cancelled ? 'cancel' : iv.per === null ? 'calm' : ''}`} title={iv.effect || iv.name} data-testid={`intent-${ei}`}>
          <Icon name={iv.icon} size={16} />
          {iv.per !== null && !iv.cancelled && <span class="dmg">{iv.per}{iv.hits > 1 ? `×${iv.hits}` : ''}</span>}
          <span class="tgt">{iv.cancelled ? '붕괴 — 행동 취소' : <>{iv.name}{iv.targetLabel ? <> → {iv.targetLabel}</> : null}</>}</span>
        </div>
      )}
      <div class="hpbar">
        <i style={{ width: `${Math.max(0, (e.hp / e.maxHp) * 100)}%` }} />
        {e.doom > 0 && e.alive && <div class="doom" style={{ width: `${doomW * 100}%` }} title={`명부 ${e.doom}`} />}
        <span>{Math.max(0, e.hp)}/{e.maxHp}</span>
      </div>
      <div class="stats-line">
        {e.block > 0 && <St k="block" n={e.block} title="방어도" />}
        {e.mark > 0 && <St k="mark" n={e.mark} title="점지" />}
        {e.bleed > 0 && <St k="bleed" n={e.bleed} title="상흔: 적 턴 시작에 이만큼 잃는다" />}
        {e.doom > 0 && <St k="doom" n={e.doom} title="명부: 턴 끝에 명부 ≥ 체력이면 처형" />}
        {e.alive && <St k="shake" n={`${e.shake}/${e.endure}`} title="넋흔들림 / 버팀" />}
        {coll && <St k="collapse" label="붕괴" title="받는 피해 ×1.5" />}
        {e.vuln > 0 && <St k="vuln" n={e.vuln} title="취약: 받는 피해 +50%" />}
        {e.weak > 0 && <St k="weak" n={e.weak} title="약화: 주는 피해 −25%" />}
        {e.bound && <St k="bound" label="묶임" title="다음 행동 피해 −25%" />}
        {e.atkBonus > 0 && <St k="buff" n={`+${e.atkBonus}`} title="누적 공격 보너스" />}
        {executes && <span class="st collapse">처형 예정</span>}
        {e.alive && def.cap && <span class={`st ${capActive(s, e) ? 'cap' : 'faint'}`} title="빗장: 한 플레이어 턴에 잃는 체력의 상한. 상흔·명부·붕괴는 넘는다">빗장 {capActive(s, e) ? `${Math.max(0, def.cap.n - e.capLost)}/${def.cap.n}` : '풀림'}</span>}
      </div>
      {e.alive && def.haewon.kind === 'knots' && (
        <div class="knots" data-testid="knots" title={`고풀이: 매듭 ${def.haewon.need}개를 풀고 쓰러뜨리면 해원 (상태 매듭은 그 상태 ${def.haewon.knotMin ?? 1} 이상)`}>
          {KNOTS.map((k, i) => <span key={k} class={e.knots & (1 << i) ? 'on' : ''} title={k}>{k === '넋흔들림' ? '넋' : k === '장단' ? '장3' : k.slice(0, 2)}</span>)}
          <b class="tiny">{popcount(e.knots)}/{def.haewon.need}</b>
        </div>
      )}
      {!hv.none && <div class={`haewon-line ${hv.ok && e.alive ? 'ok' : ''}`} title={hv.text}>{hv.known ? `해원: ${hv.text}` : hv.text}</div>}
      {!e.alive && <div class={`fate ${e.escaped ? 'escape' : e.haewon ? 'haewon' : 'kill'}`}>{e.escaped ? '달아남' : e.haewon ? '해원' : '처치'}</div>}
    </div>
  );
}

const GARAK = ['굿거리', '자진굿거리', '당악'];
const TAL = ['말뚝이', '양반', '할미'];

function HeroPanel({ s, h, inc, targetable, onClick }: { s: CombatState; h: HeroState; inc: number; targetable: boolean; onClick: () => void }) {
  const color = HERO_COLOR[h.id];
  const slot = slotName(s, h.idx);
  const unb = Math.max(0, inc - h.block);
  const low = h.hp / h.maxHp < 0.5;
  const crit = h.hp / h.maxHp < 0.25;
  let res: JSX.Element | null = null;
  switch (h.id) {
    case 'manshin': res = <>신바람 <Pips n={h.personal} max={5} /></>; break;
    case 'jaebi': res = <>가락 <b>{GARAK[h.personal] ?? '굿거리'}</b></>; break;
    case 'posu': res = <>화약 <Pips n={h.personal} max={3} /></>; break;
    case 'baksu': res = <>작두 <b>{h.stance ? '날 위' : '아래'}</b></>; break;
    case 'seungnyeo': res = <>염주 <b>{h.personal}</b>/9</>; break;
    case 'beopsa': res = <>경면주사 <Pips n={h.personal} max={h.personalCap} /></>; break;
    case 'talggun': {
      const i = s.formation.indexOf(h.idx);
      res = <>탈 <b>{i < 0 ? '—' : i === s.formation.length - 1 && i > 0 ? TAL[2] : TAL[Math.min(i, 2)]}</b></>;
      break;
    }
    case 'chasa': res = <>오라 <Pips n={h.personal} max={3} /></>; break;
  }
  const coverOf = s.heroes.find((x) => x.cover === h.idx && standing(x));
  return (
    <div class={`hero ${h.downed ? 'downed' : ''} ${h.dead ? 'dead' : ''} ${targetable ? 'targetable' : ''}`} style={{ '--hc': color } as CSSProperties} onClick={targetable ? onClick : undefined} data-testid={`hero-${h.id}`} role={targetable ? 'button' : undefined}>
      <div class="slotlab"><span>{h.dead ? '떠남' : slot}</span>{unb > 0 && !h.dead && <span class="inc-badge" title="보이는 의도로 예상한 피해(방어도 뒤)">−{unb}</span>}</div>
      <div class="hn">{heroName(h.id)}</div>
      {!h.dead && (
        <div class={`hpbar hero ${crit ? 'crit' : low ? 'low' : ''}`}>
          <i style={{ width: `${(Math.max(0, h.hp) / h.maxHp) * 100}%` }} />
          {unb > 0 && !h.downed && <div class="incoming" style={{ left: `${(Math.max(0, h.hp - unb) / h.maxHp) * 100}%`, width: `${(Math.min(unb, h.hp) / h.maxHp) * 100}%` }} />}
          <span>{Math.max(0, h.hp)}/{h.maxHp}</span>
        </div>
      )}
      {h.downed && (
        <div class="downed-box">쓰러짐 · 넋 부르기 {h.rescue}/{h.rescueNeed}<br />맞으면 버틸 확률 {Math.round(deathSaveChance(h.survived) * 100)}%{h.downTurn === s.turn ? ' · 이번 턴 보호' : ''}</div>
      )}
      {!h.dead && !h.downed && <div class="res">{res}</div>}
      <div class="stats-line">
        {h.block > 0 && <St k="block" n={h.block} title="방어도" />}
        {h.weak > 0 && <St k="weak" n={h.weak} title="약화" />}
        {h.possess > 0 && <St k="possess" n={h.possess} title="홀림: 카드 효과 없음" />}
        {h.recovering && <span class="st" title="회복 중: 주는 피해 −10%">회복 중</span>}
        {h.injured && <span class="st" style={{ color: '#ffb3a3' }} title="중상: 최대 체력 −20%">중상</span>}
        {coverOf && <span class="st good" title="엄호받는 중">엄호 · {heroName(coverOf.id)}</span>}
        {!h.dead && <span class="st" title="귀기 (50·100에서 씌임)" style={{ color: 'var(--stress)' }}>귀기 {h.stress}</span>}
      </div>
    </div>
  );
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
