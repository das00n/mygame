// 보상 · 길굿 · 결과 화면, 그리고 기물/이벤트/덫 창 · 고르기 창 · 용어 도움말 · 덱 보기.

import type { CSSProperties } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import type { CardDef, HeroId } from '../../../src/core/types.ts';
import { dialogContinue, finishCamp, pickerApply, rewardContinue, setFormation } from '../game/actions.ts';
import { campActions, doCampAction, type CampAction } from '../game/camp.ts';
import { COMMISSION_BY_ID, D, HERO_COLOR, REGION_JSON, RELIC_BY_ID, RELIC_IMPL } from '../game/content.ts';
import { settleRun } from '../game/campaign.ts';
import { bondKey, chooseDialog, dialogOptions, dialogSetup, dialogTitle } from '../game/encounters.ts';
import { TERMS } from '../game/glossary.ts';
import { FLAG_INFO, pickFlag, pickRare, pickRelic, takeCard } from '../game/rewards.ts';
import { aliveIdx, effMax, heroName, upgradableIdx } from '../game/run.ts';
import { app, commit, setPanel, ui } from '../game/store.ts';
import type { Run } from '../game/types.ts';
import { AutoToggle } from './auto.tsx';
import { CardView, Overlay } from './common.tsx';
import { PartyStrip } from './map.tsx';

// ── 보상 ─────────────────────────────────────────────────────────────
export function RewardScreen() {
  const run = app.run!;
  const r = app.reward!;
  const d = D();
  const [pick, setPick] = useState<string | null>(null);
  return (
    <div class="screen" data-testid="reward">
      <div class="topbar"><span class="title">보상</span><span class="sub">{r.title}</span><span class="spacer" /><AutoToggle /></div>
      <div class="banner">{r.title}</div>
      <div class="panel col">
        <div class="row"><span class="chip lamp">엽전 {r.gold >= 0 ? '+' : ''}{r.gold}</span>{r.materials > 0 && <span class="chip">재료 +{r.materials}</span>}<span class="chip">덱 {run.deck.length}장</span></div>
        {r.lines.map((l, i) => <div key={i} class="small">{l}</div>)}
      </div>
      {r.cards && !r.cardsTaken && (
        <div class="col">
          <div class="section-title" style={{ fontSize: '26px' }}>카드 {r.cards.length}장 중 하나 <span class="small dim" style={{ fontFamily: 'var(--font-body)' }}>영웅마다 1장 — 누구의 비중을 키울까</span></div>
          <div class="cards-wrap" data-testid="reward-cards">
            {r.cards.map((id) => {
              const def = d.cardById.get(id)!;
              return <CardView key={id} def={def} party={run.party} big pickable sel={pick === id} onClick={() => setPick(id)} testid={`reward-card-${id}`} />;
            })}
          </div>
          <div class="row" style={{ justifyContent: 'center' }}>
            <button class="btn primary" disabled={!pick} data-testid="take-card" onClick={() => { takeCard(app, pick); setPick(null); commit(); }}>이 카드를 넣는다</button>
            <button class="btn" data-testid="skip-card" onClick={() => { takeCard(app, null); commit(); }}>건너뛴다</button>
          </div>
        </div>
      )}
      {r.flags && (
        <div class="col">
          <div class="section-title" style={{ fontSize: '26px' }}>오방기 뽑기 <span class="small dim" style={{ fontFamily: 'var(--font-body)' }}>뒤집힌 깃발 셋 중 하나</span></div>
          <div class="flags" data-testid="flags">
            {r.flags.colors.map((c, i) => {
              const open = r.flags!.picked === i || (r.flags!.picked >= 0) || r.flags!.peek === i;
              const info = FLAG_INFO[c];
              return (
                <button key={i} class={`flag ${open ? 'open' : ''}`} disabled={r.flags!.picked >= 0} onClick={() => { pickFlag(app, i); commit(); }} data-testid={`flag-${i}`} aria-label={open ? `${info.name} 깃발` : '뒤집힌 깃발'}>
                  <span class="pole" />
                  <span class="inner">
                    <span class="face back">旗</span>
                    <span class="face front" style={{ '--fc': info.color, color: c === 'black' || c === 'blue' || c === 'red' ? '#f4ead0' : '#1a1208' } as CSSProperties}>{info.meaning}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div class="small dim" style={{ textAlign: 'center' }}>빨강 재수 · 흰색 명복 · 노랑 조상 · 파랑 우환{r.flags.peek >= 0 ? ' — 오방 깃발: 하나를 미리 보았다' : ''}</div>
        </div>
      )}
      {r.relics && !r.relicPicked && (
        <div class="col">
          <div class="section-title" style={{ fontSize: '26px' }}>가호 하나</div>
          <div class="camp-grid">
            {r.relics.map((id) => {
              const rl = RELIC_BY_ID.get(id)!;
              const im = (RELIC_IMPL[id] as (typeof RELIC_IMPL)[string] | undefined) ?? { impl: 'ok' as const };
              return (
                <button key={id} class="relic" onClick={() => { pickRelic(app, id); commit(); }} data-testid={`relic-${id}`}>
                  <span class="rn">{rl.name}</span>
                  <span class="small">{rl.effect}</span>
                  <span class="tiny dim">{rl.tier}{im.impl !== 'ok' ? ` · ${im.impl === 'stub' ? '미구현' : '근사'}: ${im.note}` : im.note ? ` · ${im.note}` : ''}</span>
                </button>
              );
            })}
          </div>
          <button class="btn small ghost" onClick={() => { pickRelic(app, null); commit(); }}>받지 않는다</button>
        </div>
      )}
      {r.rareCards && !r.rarePicked && (
        <div class="col">
          <div class="section-title" style={{ fontSize: '26px' }}>희귀 카드 하나 (파랑 깃발)</div>
          <div class="cards-wrap">
            {r.rareCards.map((id) => <CardView key={id} def={d.cardById.get(id)!} party={run.party} big pickable onClick={() => { pickRare(app, id); commit(); }} />)}
          </div>
        </div>
      )}
      <div class="row" style={{ justifyContent: 'center' }}>
        <button class="btn primary" data-testid="reward-continue" disabled={!((!r.flags || r.flags.picked >= 0) && r.relicPicked && r.rarePicked)} onClick={() => { rewardContinue(app); commit(); }}>{r.bossEnd ? '원정을 마친다' : '저승길로 돌아간다'}</button>
      </div>
      <PartyStrip run={run} />
    </div>
  );
}

// ── 길굿 ─────────────────────────────────────────────────────────────
export function CampScreen() {
  const run = app.run!;
  const camp = app.camp!;
  const d = D();
  const [msg, setMsg] = useState<string>('');
  const [pending, setPending] = useState<CampAction | null>(null);
  const acts = campActions(run, camp);
  const run1 = (a: CampAction, arg?: number | [number, number]) => {
    const m = doCampAction(app, a.id, arg);
    setMsg(m);
    setPending(null);
    commit();
  };
  const click = (a: CampAction) => {
    if (!a.enabled) return;
    if (a.pick === 'card-remove') {
      app.picker = { mode: 'remove', title: '덱에서 뺄 카드 (여유 5)', allowed: run.deck.map((_, i) => i), cost: { points: 5 }, from: 'camp' };
      return commit();
    }
    if (a.pick === 'card-upgrade') {
      app.picker = { mode: 'upgrade', title: '강화할 카드 (여유 4)', allowed: upgradableIdx(run), cost: { points: 4 }, from: 'camp' };
      return commit();
    }
    if (a.pick === 'curse') {
      const allowed = run.deck.map((c, i) => (d.cards[c.d].isCurse ? i : -1)).filter((i) => i >= 0);
      app.picker = { mode: 'purge', title: '정화할 씌임 카드 (여유 3)', allowed, cost: { points: 3 }, from: 'camp' };
      return commit();
    }
    if (a.pick === 'formation') {
      app.picker = { mode: 'formation', title: '기본 진형 다시 짜기', from: 'camp' };
      return commit();
    }
    if (a.pick) return setPending(a);
    run1(a);
  };
  const groups: [CampAction['group'], string][] = [['meal', '끼니와 차림'], ['common', '공용 행동'], ['hero', '영웅 고유 행동']];
  const alive = aliveIdx(run);
  return (
    <div class="screen" data-testid="camp">
      <div class="topbar"><span class="title">길굿</span><span class="sub">길 위에 굿판을 펴고 하룻밤 쉰다.</span><span class="spacer" /><AutoToggle /></div>
      <div class="camp-fire"><div class="flame" /></div>
      <div class="row">
        <b>여유</b>
        <span class="points" data-testid="camp-points">{Array.from({ length: 12 }, (_, i) => <i key={i} class={i < camp.points ? 'on' : ''} />)}</span>
        <span class="small">{camp.points}/12</span>
        <span class="spacer" />
        <span class={`chip ${camp.raid > 0 ? 'red' : 'good'}`}>밤 습격 {Math.round(camp.raid * 100)}%</span>
        <span class="chip">쌀 {run.supplies.rice}</span>
      </div>
      {msg && <div class="result-text small">{msg}</div>}
      {pending && (
        <div class="confirm col">
          <b>{pending.label} — 대상</b>
          <div class="row">
            {pending.pick === 'pair' && pairsOf(run).map(([a, b]) => (
              <button key={`${a}${b}`} class="btn small" onClick={() => run1(pending, [a, b])}>{heroName(run.heroes[a].id)}·{heroName(run.heroes[b].id)} (정 {run.bonds[bondKey(run, a, b)] ?? 0})</button>
            ))}
            {pending.pick === 'injured' && alive.filter((i) => run.heroes[i].injured).map((i) => <button key={i} class="btn small" onClick={() => run1(pending, i)}>{heroName(run.heroes[i].id)}</button>)}
            {pending.pick === 'dead' && run.heroes.map((h, i) => (h.dead && run.deck.some((c) => c.o === i && c.d === d.special.mourn) ? <button key={i} class="btn small" onClick={() => run1(pending, i)}>{heroName(h.id)}</button> : null))}
            <button class="btn small ghost" onClick={() => setPending(null)}>그만둔다</button>
          </div>
        </div>
      )}
      {groups.map(([g, label]) => (
        <div key={g} class="col">
          <div class="gloss-cat">{label}</div>
          <div class="camp-grid">
            {acts.filter((a) => a.group === g).map((a) => (
              <button key={a.id} class="opt" disabled={!a.enabled} onClick={() => click(a)} data-testid={`camp-${a.id}`}>
                <span class="ol">{a.label}{a.points > 0 && <span class="chip lamp">여유 {a.points}</span>}{a.rice ? <span class="chip">쌀 {a.rice}</span> : null}</span>
                <span class="od">{a.detail}</span>
                {!a.enabled && a.reason && <span class="why">{a.reason}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
      <PartyStrip run={run} />
      <div class="row" style={{ justifyContent: 'flex-end' }}>
        <button class="btn primary" data-testid="camp-leave" onClick={() => { finishCamp(app); commit(); }}>길굿을 마친다{camp.raid > 0 ? ` (습격 ${Math.round(camp.raid * 100)}%)` : ''}</button>
      </div>
    </div>
  );
}

function pairsOf(run: Run): [number, number][] {
  const a = aliveIdx(run);
  const out: [number, number][] = [];
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) out.push([a[i], a[j]]);
  return out;
}

// ── 결과 ─────────────────────────────────────────────────────────────
export function ResultScreen() {
  const r = app.result!;
  const d = D();
  const cm = COMMISSION_BY_ID.get(r.commission)!;
  const top = Object.entries(r.stats.plays).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const mins = Math.round(r.stats.playMs / 60000);
  return (
    <div class="screen" data-testid="result">
      <div class={`result-banner ${r.success ? 'ok' : 'fail'}`}>
        <h1>{r.success ? '원정 성공' : '원정 실패'}</h1>
        <div class="dim">{r.campaign ? `지역 ${r.region} 「${REGION_JSON[r.region].region.name}」` : `${cm.place} · ${cm.name}`} — {r.reason}</div>
      </div>
      <div class="stat-grid">
        <div class="stat"><div class="v">{r.stats.wins}/{r.stats.fights}</div><div class="k">전투 승리 / 전투</div></div>
        <div class="stat"><div class="v">{r.stats.haewons}</div><div class="k">해원 (조건 있는 원귀 {r.stats.haewonEligible} 중)</div></div>
        <div class="stat"><div class="v">{r.stats.kills}</div><div class="k">쓰러뜨린 원귀</div></div>
        <div class="stat"><div class="v">{r.stats.downs}</div><div class="k">쓰러짐 (기상 {r.stats.revives})</div></div>
        <div class="stat"><div class="v">{r.stats.deaths}</div><div class="k">죽음</div></div>
        <div class="stat"><div class="v">{r.roomsVisited}/{r.roomsTotal}</div><div class="k">밝힌 방</div></div>
        <div class="stat"><div class="v">{r.gold}</div><div class="k">엽전 (재료 {r.materials}{r.chiseong ? ` · 치성 ${r.chiseong}` : ''})</div></div>
        <div class="stat"><div class="v">{r.stats.cardsTaken}</div><div class="k">얻은 카드 (건너뜀 {r.stats.cardsSkipped}{r.stats.upgrades ? ` · 강화 ${r.stats.upgrades}` : ''}) · 덱 {r.deckSize}</div></div>
        <div class="stat"><div class="v">{r.light}</div><div class="k">남은 넋등 · 촛불 {r.stats.candlesUsed}</div></div>
        <div class="stat"><div class="v">{mins}분</div><div class="k">플레이 시간</div></div>
      </div>
      <div class="panel col">
        <b>파티</b>
        <div class="row">
          {r.heroes.map((h) => (
            <span key={h.id} class="chip" style={{ borderColor: HERO_COLOR[h.id], color: HERO_COLOR[h.id] }}>
              {heroName(h.id)} {h.dead ? '— 떠남' : `${h.hp}/${effMax(h)}${h.injured ? ' 중상' : ''} · 귀기 ${h.stress}`}
            </span>
          ))}
        </div>
      </div>
      <div class="panel col">
        <b>가장 많이 낸 카드</b>
        {top.length === 0 && <span class="dim small">없음</span>}
        {top.map(([id, n]) => <div key={id} class="small">{d.cardById.get(id)?.name ?? id} <span class="dim">× {n}</span></div>)}
      </div>
      {r.relics.length > 0 && <div class="row small">{r.relics.map((x) => <span key={x} class="chip lamp">{RELIC_BY_ID.get(x)!.name}</span>)}</div>}
      <div class="row" style={{ justifyContent: 'center' }}>
        {app.campaign && app.plan ? (
          <button class="btn primary" data-testid="to-settle" onClick={() => { settleRun(app); commit(); }}>마을로 돌아가 결산</button>
        ) : (
          <>
            <button class="btn primary" data-testid="to-shrine" onClick={() => { app.result = null; app.run = null; app.screen = 'shrine'; commit(); }}>신당으로</button>
            <button class="btn" onClick={() => { app.result = null; app.run = null; app.screen = 'title'; commit(); }}>표지</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── 기물·이벤트·덫 창 ─────────────────────────────────────────────────
export function DialogView() {
  const run = app.run!;
  const dlg = app.dialog!;
  const opts = dialogOptions(run, dlg);
  return (
    <Overlay testid="dialog">
      <h2>{dialogTitle(dlg)}</h2>
      <div class="small dim">{dialogSetup(dlg)}</div>
      {dlg.result === null ? (
        <div class="col">
          {opts.map((o) => (
            <button key={o.id} class="opt" disabled={!o.enabled} onClick={() => { chooseDialog(app, o.id); commit(); }} data-testid={`opt-${o.id}`}>
              <span class="ol">
                {o.kind === 'bare' && <span class="chip">맨손</span>}
                {o.kind === 'supply' && <span class="chip lamp">보급품</span>}
                {o.kind === 'hero' && o.hero && <span class="chip" style={{ borderColor: HERO_COLOR[o.hero as HeroId], color: HERO_COLOR[o.hero as HeroId] }}>영웅 고유</span>}
                {o.label}
                {o.cost && o.kind !== 'supply' && <span class="chip lamp">{o.cost}</span>}
              </span>
              <span class="od">{o.detail}</span>
              {!o.enabled && o.reason && <span class="why">{o.reason}</span>}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div class="result-text" data-testid="dialog-result">{dlg.result}</div>
          <div class="row" style={{ justifyContent: 'flex-end' }}>
            <button class="btn primary" data-testid="dialog-continue" onClick={() => { dialogContinue(app); commit(); }}>{dlg.then === 'battle' ? '싸운다' : dlg.then === 'none' ? '확인' : '이어서'}</button>
          </div>
        </>
      )}
    </Overlay>
  );
}

/** 강화 전후 차이 한 줄 (비용·키워드) */
function UpgradeDiff({ base, up }: { base: CardDef; up: CardDef }) {
  const parts: string[] = [];
  if (up.cost !== base.cost) parts.push(`비용 ${base.cost}→${up.cost}`);
  for (const k of up.keywords) if (!base.keywords.includes(k) && k !== '받는소리') parts.push(`+${k}`);
  for (const k of base.keywords) if (!up.keywords.includes(k) && k !== '받는소리') parts.push(`−${k}`);
  if (up.text !== base.text) {
    // 숫자만 바뀌었으면 "5→7" 처럼, 문장이 바뀌었으면 "효과 강화"
    const nums = (t: string) => t.match(/\d+/g) ?? [];
    const a = nums(base.text);
    const b = nums(up.text);
    const diffs = a.length === b.length ? a.map((x, i) => (x !== b[i] ? `${x}→${b[i]}` : '')).filter(Boolean) : [];
    parts.push(diffs.length ? diffs.slice(0, 3).join(' · ') : '효과 강화');
  }
  return <div class="updiff" title={`강화 전: ${base.text}`}>{parts.join(' · ')}</div>;
}

// ── 고르기 창 ─────────────────────────────────────────────────────────
export function PickerView() {
  const run = app.run!;
  const pk = app.picker!;
  const d = D();
  const [order, setOrder] = useState<number[]>(() => run.formation.filter((i) => !run.heroes[i].dead));
  const [selSlot, setSelSlot] = useState(-1);
  const close = () => { pickerApply(app, null); commit(); };
  let body: JSX.Element;
  if (pk.mode === 'offer') {
    body = <div class="cards-wrap">{(pk.offer ?? []).map((id) => <CardView key={id} def={d.cardById.get(id)!} party={run.party} big pickable onClick={() => { pickerApply(app, id); commit(); }} testid={`offer-${id}`} />)}</div>;
  } else if (pk.mode === 'sul') {
    body = <div class="row">{aliveIdx(run).map((i) => <button key={i} class="btn" onClick={() => { pickerApply(app, i); commit(); }}>{heroName(run.heroes[i].id)} (귀기 {run.heroes[i].stress})</button>)}</div>;
  } else if (pk.mode === 'formation') {
    body = (
      <div class="col">
        <div class="small dim">두 칸을 차례로 눌러 자리를 바꾼다.</div>
        <div class="formation">
          {order.map((hi, i) => (
            <button key={hi} class={`slot ${selSlot === i ? 'sel' : ''}`} onClick={() => {
              if (selSlot < 0) return setSelSlot(i);
              const o = order.slice();
              [o[selSlot], o[i]] = [o[i], o[selSlot]];
              setOrder(o);
              setSelSlot(-1);
            }}>
              <span class="lab">{['선두', '중열', '후열'][i === order.length - 1 && i > 0 ? 2 : i]}</span>
              <span class="who" style={{ color: HERO_COLOR[run.heroes[hi].id] }}>{heroName(run.heroes[hi].id)}</span>
            </button>
          ))}
        </div>
        <div class="row" style={{ justifyContent: 'flex-end' }}><button class="btn primary" data-testid="formation-ok" onClick={() => { setFormation(app, order); pickerApply(app, null); commit(); }}>이 진형으로</button></div>
      </div>
    );
  } else if (pk.mode === 'upgrade') {
    // 강화판 미리 보기: 강화판 카드를 크게, 아래에 바뀌는 점(비용·키워드·문장)
    const allowed = pk.allowed ?? [];
    body = (
      <div class="deck-list">
        {allowed.map((i) => {
          const c = run.deck[i];
          const base = d.cards[c.d];
          const up = d.cards[base.upIdx];
          return (
            <CardView key={i} def={up} inst={{ ...c, d: up.idx }} party={run.party} pickable onClick={() => { pickerApply(app, i); commit(); }} testid={`pick-${i}`}
              note={<UpgradeDiff base={base} up={up} />} />
          );
        })}
        {!allowed.length && <div class="dim">강화할 카드가 없다.</div>}
      </div>
    );
  } else {
    const allowed = pk.allowed ?? [];
    body = (
      <div class="deck-list">
        {allowed.map((i) => <CardView key={i} def={d.cards[run.deck[i].d]} inst={run.deck[i]} party={run.party} pickable onClick={() => { pickerApply(app, i); commit(); }} testid={`pick-${i}`} />)}
        {!allowed.length && <div class="dim">고를 카드가 없다.</div>}
      </div>
    );
  }
  return (
    <Overlay testid="picker">
      <div class="row"><h2>{pk.title}</h2><span class="spacer" /><button class="btn small" onClick={close} data-testid="picker-cancel">그만둔다</button></div>
      {body}
    </Overlay>
  );
}

// ── 용어 도움말 ─────────────────────────────────────────────────────
export function GlossaryView() {
  const [q, setQ] = useState('');
  const list = useMemo(() => TERMS.filter((t) => !q || t.term.includes(q) || t.text.includes(q)), [q]);
  const cats = [...new Set(list.map((t) => t.cat))];
  return (
    <Overlay onClose={() => setPanel(null)} testid="glossary">
      <div class="row"><h2>용어 도움말</h2><span class="spacer" /><button class="btn small" onClick={() => setPanel(null)}>닫기</button></div>
      <input class="search" placeholder="낱말 찾기 (예: 장단, 명부)" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      <div class="gloss-list">
        {cats.map((c) => (
          <div key={c} class="col" style={{ gap: '4px' }}>
            <div class="gloss-cat">{c}</div>
            {list.filter((t) => t.cat === c).map((t) => <div key={t.term} class="t small"><b>{t.term}</b>{t.text}</div>)}
          </div>
        ))}
      </div>
    </Overlay>
  );
}

export function DeckView() {
  const run = app.run;
  const d = D();
  if (!run) return null;
  const sorted = run.deck.map((c, i) => ({ c, i })).sort((a, b) => a.c.o - b.c.o || d.cards[a.c.d].cost - d.cards[b.c.d].cost);
  return (
    <Overlay onClose={() => setPanel(null)} testid="deck">
      <div class="row"><h2>덱 {run.deck.length}장</h2><span class="spacer" /><button class="btn small" onClick={() => setPanel(null)}>닫기</button></div>
      <div class="deck-list">{sorted.map(({ c, i }) => <CardView key={i} def={d.cards[c.d]} inst={c} party={run.party} />)}</div>
    </Overlay>
  );
}

export function Panels() {
  if (ui.panel === 'gloss') return <GlossaryView />;
  if (ui.panel === 'deck') return <DeckView />;
  return null;
}
