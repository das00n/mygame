// 캠페인 마을 (docs/09-campaign-spec.md): 마을(시설·절기·균열·이벤트) · 의뢰판(의뢰 → 파티 → 보급품 → 출정) · 로스터(개체 시트) ·
// 사당(위패·계보도·신물·천도굿) · 객주(영입·신어머니·교환소) · 무구방(각인). 결산 · 결말 화면. 내보내기/가져오기 코드.

import type { CSSProperties } from 'preact';
import { useState } from 'preact/hooks';
import { HERO_NAMES, type HeroId } from '../../../src/core/types.ts';
import {
  ancestors, available, baseMaxHp, bondOf, bookRest, bookTreat, build, buildOptions, buyMaterial, cancelBooking, canPromote, cheondo, clearEngraving,
  displayName, endingSummary, engrave, enemyHpMult, fatigueFrac, festivalKind, lineage, loadoutCost, maxHpOf, motherCandidates, nextXp, promote,
  quirkOf, recommendedSupplies, recruit, recruitCost, regionOpen, removeBadQuirk, retire, rosterCap, sellMaterial, setLoadout, sinmulCarry, supplyCost,
  supplyLine, supplyMax, supplyPrice, tier, wanderingSpirits,
} from '../../../src/meta/campaign.ts';
import { CD, LENGTH_NAMES, REGION_NAMES, SUPPLY_IDS, SUPPLY_NAMES, emptySupplies, seasonName } from '../../../src/meta/content.ts';
import { bestLoadout } from '../../../src/meta/loadout.ts';
import type { Campaign, Commission, Person, Supplies } from '../../../src/meta/types.ts';
import { blankApp } from '../game/actions.ts';
import { copyText, depart, exportCode, leaveSettlement } from '../game/campaign.ts';
import { D, HERO_COLOR, HERO_INFO } from '../game/content.ts';
import { clearSave } from '../game/save.ts';
import { app, commit, setPanel } from '../game/store.ts';
import { AutoToggle } from './auto.tsx';
import { CardView, Overlay } from './common.tsx';
import { HeroBust } from './scene/hero.tsx';
import { hashOf } from './scene/palette.ts';
import { LineageScene, SadangTablets, VillagePanorama } from './scene/village.tsx';
import { Procession } from './scene/walk.tsx';

type Tab = 'maeul' | 'board' | 'roster' | 'sadang' | 'gaekju' | 'forge';

function say(msg: string | null, ok?: string): void {
  app.toast = msg ?? ok ?? null;
  commit();
}

function RiftGauge({ c }: { c: Campaign }) {
  const marks = CD.rift.strong;
  return (
    <div class="rift" data-testid="rift" title={`저승문 균열 ${c.rift}/${CD.rift.max} — 절기마다 +1, 보스 해원 ${CD.rift.bossHaewon} · 처치 ${CD.rift.bossKill}. ${marks.join('·')}칸에서 원귀 체력 +10%씩`}>
      <span class="tiny dim">균열</span>
      <span class="rift-cells">
        {Array.from({ length: CD.rift.max }, (_, i) => <i key={i} class={`${i < c.rift ? 'on' : ''} ${marks.includes(i + 1) ? 'mark' : ''}`} />)}
      </span>
      <b>{c.rift}</b>
      {c.countdown !== null && <span class="chip red">봉합 {c.countdown}절기</span>}
      {!c.settings.rift && <span class="chip">카운트다운 끔</span>}
    </div>
  );
}

export function VillageScreen() {
  const c = app.campaign!;
  const [tab, setTab] = useState<Tab>('maeul');
  const [showExport, setShowExport] = useState(false);
  const tabs: [Tab, string][] = [['maeul', '마을'], ['board', '의뢰판'], ['roster', `로스터 ${c.roster.length}`], ['sadang', '사당'], ['gaekju', '객주·장터']];
  if (tier(c, 'mugubang') >= 1) tabs.push(['forge', '무구방']);
  return (
    <div class="screen village" data-testid="village">
      <div class="topbar">
        <span class="title">마을</span>
        <span class="sub" data-testid="season">{seasonName(c.season)} · 원정 {c.expeditions}회</span>
        <span class="spacer" />
        <span class="chip lamp" data-testid="gold">엽전 {c.gold}</span>
        <span class="chip lamp" data-testid="chiseong">치성 {c.chiseong}</span>
        <AutoToggle />
        <button class="btn small ghost" data-testid="export" onClick={() => setShowExport(true)}>내보내기</button>
        <button class="btn small ghost" onClick={() => setPanel('gloss')}>용어</button>
        <button class="btn small ghost" onClick={() => { app.screen = 'title'; commit(); }}>표지</button>
      </div>
      <div class="row village-head">
        <RiftGauge c={c} />
        {c.festival && <span class="chip lamp" title={c.festival}>{c.festival.split(':')[0]}</span>}
      </div>
      <div class="tabs" role="tablist">
        {tabs.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} class={`btn small ${tab === k ? 'on' : ''}`} data-testid={`tab-${k}`} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      {tab === 'maeul' && <MaeulTab c={c} />}
      {tab === 'board' && <BoardTab c={c} />}
      {tab === 'roster' && <RosterTab c={c} />}
      {tab === 'sadang' && <SadangTab c={c} />}
      {tab === 'gaekju' && <GaekjuTab c={c} />}
      {tab === 'forge' && <ForgeTab c={c} />}
      {showExport && <ExportView c={c} onClose={() => setShowExport(false)} />}
    </div>
  );
}

// ── 마을 ─────────────────────────────────────────────────────────────
function MaeulTab({ c }: { c: Campaign }) {
  const opts = buildOptions(c);
  const festival = festivalKind(c);
  return (
    <div class="col">
      <VillagePanorama c={c} />
      {c.festival && <div class="panel small" data-testid="festival"><b>명절</b> — {c.festival}</div>}
      {c.lastEvent && <div class="panel small" data-testid="event"><b>지난 귀환의 마을 이벤트</b> — {CD.events.find((e) => e.id === c.lastEvent)?.name}: {CD.events.find((e) => e.id === c.lastEvent)?.text}</div>}
      <div class="section-title">시설</div>
      <div class="fac-grid">
        {CD.facilities.map((f) => {
          const t = tier(c, f.id);
          const o = opts.find((x) => x.id === f.id);
          return (
            <div key={f.id} class={`fac ${t ? 'built' : ''}`}>
              <div class="row"><b>{f.name}</b><span class="chip">{t ? `${t}단계` : '없음'}</span></div>
              <div class="tiny dim">{t ? f.tiers[t - 1].text : f.tiers[0].text}</div>
              {o && (
                <div class="row">
                  <span class="tiny">{o.next === 1 ? '짓기' : `${o.next}단계`}: {[o.cost.gold ? `엽전 ${o.cost.gold}` : '', o.cost.chiseong ? `치성 ${o.cost.chiseong}` : ''].filter(Boolean).join(' · ') || '무료'}</span>
                  <span class="spacer" />
                  <button class="btn small lamp" data-testid={`build-${f.id}`} disabled={!o.ok} title={o.why ?? o.text} onClick={() => say(build(c, f.id), `${f.name} ${o.next === 1 ? '건축' : `${o.next}단계`}`)}>{o.next === 1 ? '짓는다' : '올린다'}</button>
                </div>
              )}
              {o && o.why && <div class="tiny faint">{o.why}</div>}
            </div>
          );
        })}
      </div>
      <div class="row small">
        <span class="dim">재료</span>
        {Object.entries(c.materials).filter(([, n]) => n > 0).map(([f, n]) => <span key={f} class="chip" title={`${f} → 각인 ${CD.engrave[f]}`}>{CD.materials[f] ?? f} {n}</span>)}
        {!Object.values(c.materials).some((n) => n > 0) && <span class="faint">없음</span>}
      </div>
      <div class="row small"><span class="dim">창고</span><span>{supplyLine(c.stock)}</span>{festival === 'market' && <span class="chip good">추석 장: 보급품 반값</span>}</div>
      <div class="panel"><div class="log" data-testid="village-log">{c.log.slice(-10).reverse().map((l, i) => <div key={i}>{l}</div>)}</div></div>
    </div>
  );
}

// ── 의뢰판 ───────────────────────────────────────────────────────────
function CommissionCard({ c, cm, sel, onClick }: { c: Campaign; cm: Commission; sel: boolean; onClick: () => void }) {
  return (
    <button class={`commission ${sel ? 'sel' : ''}`} data-testid={`commission-${cm.length}-${cm.region}`} onClick={onClick}>
      <div class="row">
        <span class={`chip ${cm.seal || cm.length === 'final' ? 'red' : 'lamp'}`}>{cm.seal ? '균열 봉합' : LENGTH_NAMES[cm.length]}</span>
        <span class="faint small">지역 {cm.region} 「{REGION_NAMES[cm.region]}」</span>
      </div>
      <div class="small dim">{cm.story}</div>
      <div class="small">주로 나오는 원귀: {cm.family} → 재료 {CD.materials[cm.family]}</div>
      <div class="small">굿비 <b style={{ color: 'var(--lamp)' }}>{cm.pay}</b> (선금 {cm.advance}){enemyHpMult(c) > 1 ? ` · 균열: 원귀 체력 +${Math.round((enemyHpMult(c) - 1) * 100)}%` : ''}</div>
    </button>
  );
}

function BoardTab({ c }: { c: Campaign }) {
  const [cmId, setCm] = useState<string | null>(null);
  const [party, setParty] = useState<string[]>([]);
  const [buy, setBuy] = useState<Supplies>(emptySupplies());
  const cm = c.commissions.find((x) => x.id === cmId) ?? null;
  const pool = available(c);
  const max = supplyMax(c);
  const cost = supplyCost(c, buy);
  const ready = !!cm && party.length === 3;
  const toggle = (p: Person) => {
    if (party.includes(p.uid)) return setParty(party.filter((u) => u !== p.uid));
    if (party.length >= 3) return;
    if (party.some((u) => c.roster.find((x) => x.uid === u)?.arch === p.arch)) return say('같은 원형은 한 파티에 한 명');
    setParty([...party, p.uid]);
  };
  const fillRec = () => {
    if (!cm) return;
    const rec = recommendedSupplies(cm.region, cm.length);
    const next = emptySupplies();
    for (const k of SUPPLY_IDS) next[k] = Math.max(0, Math.min(max[k], rec[k]) - c.stock[k] - (c.bonusSupplies[k] ?? 0));
    for (const k of [...SUPPLY_IDS].reverse()) while (supplyCost(c, next) > c.gold + cm.advance && next[k] > 0) next[k]--;
    setBuy(next);
  };
  const go = () => {
    if (!cm) return;
    const err = depart(app, cm.id, party, buy);
    if (err) return say(err);
    commit();
  };
  return (
    <div class="col">
      <div class="section-title"><span class="num">一</span>의뢰 <span class="small dim" style={{ fontFamily: 'var(--font-body)' }}>재가집이 청한 굿 — 절기마다 바뀐다</span></div>
      <div class="commissions" data-testid="board">
        {c.commissions.map((x) => <CommissionCard key={x.id} c={c} cm={x} sel={cmId === x.id} onClick={() => { setCm(x.id); setBuy(emptySupplies()); }} />)}
      </div>
      <div class="section-title"><span class="num">二</span>세 사람 <span class="small dim" style={{ fontFamily: 'var(--font-body)' }}>{party.length}/3 · 같은 원형은 한 명</span></div>
      <div class="people">
        {c.roster.map((p) => {
          const busy = !pool.includes(p);
          const sel = party.includes(p.uid);
          return (
            <button key={p.uid} class={`person with-bust ${sel ? 'sel' : ''}`} disabled={busy} data-testid={`pick-${p.uid}`} style={{ '--hc': HERO_COLOR[p.arch] } as CSSProperties} onClick={() => toggle(p)}>
              <span class="band" />
              <HeroBust id={p.arch} v={hashOf(p.uid)} size={52} dim={busy} />
              <b>{displayName(p)}</b> <span class="small dim">{HERO_NAMES[p.arch]} · 레벨 {p.level}</span>
              <div class="tiny">체력 {maxHpOf(p)}{fatigueFrac(p) > 0 ? ` (피로 −${Math.round(fatigueFrac(p) * 100)}%)` : ''} · 귀기 {p.stress}{p.injured ? ' · 중상' : ''}{busy ? ` · ${p.busy === 'rest' ? '주막에서 쉼' : '약방 치료'}` : ''}</div>
            </button>
          );
        })}
      </div>
      {party.length >= 2 && (
        <div class="row small">
          <span class="dim">정</span>
          {party.flatMap((a, i) => party.slice(i + 1).map((b) => {
            const n = bondOf(c, a, b);
            const pa = c.roster.find((x) => x.uid === a)!;
            const pb = c.roster.find((x) => x.uid === b)!;
            return <span key={a + b} class={`chip ${n >= CD.bonds.duoAt ? 'good' : ''}`}>{pa.name}·{pb.name} {n}{n >= CD.bonds.duoAt ? ' — 합기' : ''}</span>;
          }))}
        </div>
      )}
      <div class="section-title"><span class="num">三</span>보급품 <span class="small dim" style={{ fontFamily: 'var(--font-body)' }}>창고 {supplyLine(c.stock)}</span></div>
      <div class="row">
        <span class="purse">값 {cost}</span><span class="small dim">/ 엽전 {c.gold}{cm ? ` + 선금 ${cm.advance}` : ''}</span>
        <span class="spacer" />
        <button class="btn small lamp" data-testid="buy-rec" disabled={!cm} onClick={fillRec}>권장량 담기</button>
      </div>
      <div class="supplies">
        {SUPPLY_IDS.map((k) => (
          <div key={k} class="supply-row">
            <div><b>{SUPPLY_NAMES[k]}</b> <span class="small dim">{supplyPrice(c, k)} 엽전 · 최대 {max[k]} · 창고 {c.stock[k]}</span></div>
            <div class="stepper">
              <button class="btn small" onClick={() => setBuy({ ...buy, [k]: Math.max(0, buy[k] - 1) })} aria-label={`${SUPPLY_NAMES[k]} 빼기`}>−</button>
              <span class="n">{buy[k]}</span>
              <button class="btn small" onClick={() => setBuy({ ...buy, [k]: Math.min(max[k], buy[k] + 1) })} aria-label={`${SUPPLY_NAMES[k]} 더`}>+</button>
            </div>
          </div>
        ))}
      </div>
      <div class="start-bar row">
        <span class="small dim">{ready ? `${party.map((u) => c.roster.find((x) => x.uid === u)!.name).join(' · ')} — ${REGION_NAMES[cm!.region]} ${LENGTH_NAMES[cm!.length]}` : '의뢰 하나와 세 사람을 고른다.'}</span>
        <span class="spacer" />
        <button class="btn primary" data-testid="depart" disabled={!ready} onClick={go}>출정</button>
      </div>
    </div>
  );
}

// ── 로스터 ───────────────────────────────────────────────────────────
function RosterTab({ c }: { c: Campaign }) {
  const [sel, setSel] = useState<string | null>(c.roster[0]?.uid ?? null);
  const p = c.roster.find((x) => x.uid === sel) ?? c.roster[0];
  return (
    <div class="roster-layout">
      <div class="people col" data-testid="roster">
        {c.roster.map((x) => (
          <button key={x.uid} class={`person with-bust ${p?.uid === x.uid ? 'sel' : ''}`} style={{ '--hc': HERO_COLOR[x.arch] } as CSSProperties} data-testid={`person-${x.uid}`} onClick={() => setSel(x.uid)}>
            <span class="band" />
            <HeroBust id={x.arch} v={hashOf(x.uid)} size={48} dim={!!x.busy} />
            <b>{displayName(x)}</b> <span class="small dim">{HERO_NAMES[x.arch]} · 레벨 {x.level}</span>
            <div class="tiny">{x.busy ? (x.busy === 'rest' ? '주막에서 쉬는 중' : '약방 치료 중') : x.injured ? '중상' : '활동'} · 귀기 {x.stress}</div>
          </button>
        ))}
        <div class="tiny dim">로스터 {c.roster.length}/{rosterCap(c)}</div>
      </div>
      {p && <PersonSheet c={c} p={p} />}
    </div>
  );
}

function PersonSheet({ c, p }: { c: Campaign; p: Person }) {
  const d = D();
  const [edit, setEdit] = useState(false);
  const [pick, setPick] = useState<string[]>(p.loadout);
  const good = quirkOf(p.good);
  const bad = quirkOf(p.bad);
  const info = HERO_INFO.get(p.arch)!;
  const others = c.roster.filter((x) => x.uid !== p.uid);
  const allCards = [...new Set([...d.starters.get(p.arch)!.map((x) => x.id), ...p.learned])];
  const nx = nextXp(p);
  return (
    <div class="psheet col" data-testid="sheet" style={{ '--hc': HERO_COLOR[p.arch] } as CSSProperties}>
      <div class="row">
        <HeroBust id={p.arch} v={hashOf(p.uid)} size={96} title={`${displayName(p)} — ${info.name}`} />
        <h2 style={{ margin: 0 }}>{displayName(p)}</h2>
        <span class="chip" style={{ borderColor: HERO_COLOR[p.arch] }}>{info.name}</span>
        {p.path && <span class="chip lamp">{CD.paths[p.arch][p.path]}</span>}
      </div>
      <div class="small dim">{CD.origins[p.arch][p.origin]}{p.mother ? ` 신어머니: ${c.fallen.find((f) => f.person.uid === p.mother)?.person.name ?? '?'}` : ''}</div>
      <div class="row small">
        {good && <span class="chip good" title={good.text}>{good.name} — {good.text}</span>}
        {bad && <span class="chip red" title={bad.text}>{bad.name} — {bad.text}</span>}
      </div>
      <div class="stat-grid">
        <div class="stat"><div class="v">{p.level} (경험 {p.xp}{nx !== null ? `/${nx}` : ' · 최고'})</div><div class="k">레벨</div></div>
        <div class="stat"><div class="v">{maxHpOf(p)}{maxHpOf(p) !== baseMaxHp(p) ? ` / ${baseMaxHp(p)}` : ''}</div><div class="k">최대 체력</div></div>
        <div class="stat"><div class="v">{p.stress}</div><div class="k">귀기</div></div>
        <div class="stat"><div class="v">{p.sorties}{fatigueFrac(p) > 0 ? ` (피로 −${Math.round(fatigueFrac(p) * 100)}%)` : ''}</div><div class="k">연속 출전</div></div>
        <div class="stat"><div class="v">{p.history.expeditions} · {p.history.haewons}</div><div class="k">원정 · 해원</div></div>
        <div class="stat"><div class="v">{p.history.saved}</div><div class="k">구한 동료</div></div>
      </div>
      <div class="row">
        {!p.busy && <button class="btn small" disabled={c.gold < CD.economy.restCost} onClick={() => say(bookRest(c, p.uid), '한 절기 쉰다')}>주막 휴식 ({CD.economy.restCost})</button>}
        {!p.busy && p.injured && <button class="btn small" disabled={tier(c, 'yakbang') < 1} onClick={() => say(bookTreat(c, p.uid), '치료를 예약했다')}>약방 치료 ({CD.economy.treatCost})</button>}
        {p.busy && <button class="btn small ghost" onClick={() => { cancelBooking(c, p.uid); commit(); }}>예약 취소</button>}
        {p.bad && tier(c, 'yakbang') >= 1 && <button class="btn small" onClick={() => say(removeBadQuirk(c, p.uid), '나쁜 기질을 다스렸다')}>기질 다스리기 ({CD.economy.quirkCost})</button>}
        {canPromote(c, p) && (['A', 'B'] as const).map((k) => <button key={k} class="btn small lamp" onClick={() => say(promote(c, p.uid, k), '내림굿을 받았다')}>내림굿 — {CD.paths[p.arch][k]}</button>)}
        {!p.epithet && p.level >= CD.levels.promoteLevel && tier(c, 'jeonsucheong') < 1 && <span class="tiny dim">내림굿은 전수청에서</span>}
        <span class="spacer" />
        <button class="btn small ghost" onClick={() => say(retire(c, p.uid), '은퇴했다')}>은퇴</button>
      </div>
      <div class="section-title" style={{ fontSize: '22px' }}>로드아웃 <span class="small dim" style={{ fontFamily: 'var(--font-body)' }}>시작 카드 4 + 익힌 카드 중 4장 · 바꾸기 {loadoutCost(c) ? `엽전 ${loadoutCost(c)}` : '무료(전수청)'}</span></div>
      {!edit ? (
        <>
          <div class="cards-wrap">{p.loadout.map((id) => <CardView key={id} def={d.cardById.get(id)!} party={[p.arch]} note={p.engraving?.card === id ? `각인: ${p.engraving.status} +1` : undefined} />)}</div>
          <div class="row"><button class="btn small" data-testid="edit-loadout" onClick={() => { setPick(p.loadout); setEdit(true); }}>바꾸기</button><button class="btn small ghost" onClick={() => say(setLoadout(c, p.uid, bestLoadout(p.arch, p.learned)), '추천 로드아웃')}>추천대로</button></div>
        </>
      ) : (
        <>
          <div class="cards-wrap">{allCards.map((id) => <CardView key={id} def={d.cardById.get(id)!} party={[p.arch]} pickable sel={pick.includes(id)} onClick={() => setPick(pick.includes(id) ? pick.filter((x) => x !== id) : pick.length < 4 ? [...pick, id] : pick)} />)}</div>
          <div class="row"><span class="small">{pick.length}/4</span><button class="btn small primary" disabled={pick.length !== 4} onClick={() => { const err = setLoadout(c, p.uid, pick); say(err, '로드아웃을 바꿨다'); if (!err) setEdit(false); }}>정한다</button><button class="btn small" onClick={() => setEdit(false)}>그만둔다</button></div>
        </>
      )}
      {p.learned.length > 0 && <div class="small dim">익힌 카드 {p.learned.length}: {p.learned.map((id) => d.cardById.get(id)?.name).join(' · ')}</div>}
      <div class="small"><span class="dim">무구:</span> {p.engraving ? `「${d.cardById.get(p.engraving.card)?.name}」 ${p.engraving.status} +1 (${CD.materials[p.engraving.family]})` : '각인 없음'} · <span class="dim">노리개:</span> 없음</div>
      <div class="small"><span class="dim">정:</span> {others.map((o) => `${o.name} ${bondOf(c, p.uid, o.uid)}`).join(' · ') || '없음'}</div>
      {p.history.lastCard && <div class="small dim">마지막으로 많이 낸 카드: {d.cardById.get(p.history.lastCard)?.name}</div>}
    </div>
  );
}

// ── 사당 ─────────────────────────────────────────────────────────────
function SadangTab({ c }: { c: Campaign }) {
  const d = D();
  const pending = c.fallen.filter((f) => !f.honored);
  const anc = ancestors(c);
  const lines = lineage(c);
  return (
    <div class="col" data-testid="sadang">
      <div class="small dim">천도굿을 받아야 조상신이 된다. 기한({CD.death.deadline}절기)을 넘기면 넋이 떠돌아 원정마다 파티 귀기 +{CD.death.wanderStress}. 신물은 원정마다 {sinmulCarry(c)}장 지닌다(사당 3단계 2장).</div>
      {pending.length > 0 && (
        <div class="col">
          <div class="section-title" style={{ fontSize: '22px' }}>천도를 기다리는 넋</div>
          {pending.map((f) => (
            <div key={f.person.uid} class="panel row" data-testid={`fallen-${f.person.uid}`}>
              <b>{displayName(f.person)}</b><span class="small dim">{HERO_NAMES[f.person.arch]} · {seasonName(f.died)} {f.where}에서</span>
              {f.wandering ? <span class="chip red">떠도는 넋</span> : <span class="chip">기한 {seasonName(f.deadline)}까지</span>}
              <span class="spacer" />
              <button class="btn small primary" data-testid={`cheondo-${f.person.uid}`} disabled={c.gold < CD.death.cheondoCost} onClick={() => say(cheondo(c, f.person.uid), '천도굿을 올렸다')}>천도굿 (엽전 {CD.death.cheondoCost})</button>
            </div>
          ))}
        </div>
      )}
      <SadangTablets c={c} />
      <div class="section-title" style={{ fontSize: '22px' }}>위패 {anc.length}</div>
      {!anc.length && <div class="faint small">아직 조상신이 없다.</div>}
      <div class="ancestors">
        {anc.map((f) => (
          <div key={f.person.uid} class="wipae" data-testid="ancestor" style={{ '--hc': HERO_COLOR[f.person.arch] } as CSSProperties}>
            <div class="wname">{f.person.name}</div>
            <div class="tiny">{f.person.epithet ? `「${f.person.epithet}」 ` : ''}{HERO_NAMES[f.person.arch]} · 원정 {f.person.history.expeditions} · {seasonName(f.died)}</div>
            {f.sinmul && <CardView def={d.cardById.get(f.sinmul)!} party={[]} note="신물 · 주인 파티" />}
            {f.daughter && <div class="tiny dim">신딸: {c.roster.find((p) => p.uid === f.daughter)?.name ?? c.fallen.find((x) => x.person.uid === f.daughter)?.person.name}</div>}
          </div>
        ))}
      </div>
      <div class="section-title" style={{ fontSize: '22px' }}>계보도</div>
      <LineageScene c={c} />
      {!lines.length && <div class="faint small">신어머니–신딸로 이어진 계보가 아직 없다. 조상신과 같은 원형을 영입할 때 신어머니로 이을 수 있다(객주).</div>}
      {lines.map((l) => (
        <div key={l.root.person.uid} class="lineage" data-testid="lineage">
          <span class="chip lamp">{l.root.person.name}</span>
          {l.chain.map((x) => {
            const pp = 'person' in x ? x.person : x;
            return <span key={pp.uid}> → <span class={`chip ${'person' in x ? '' : 'good'}`}>{pp.name}</span></span>;
          })}
        </div>
      ))}
      {wanderingSpirits(c).length > 0 && <div class="panel small" style={{ color: '#ffb3a3' }}>떠도는 넋 {wanderingSpirits(c).length} — 원정마다 파티 귀기 +{wanderingSpirits(c).length * CD.death.wanderStress}</div>}
    </div>
  );
}

// ── 객주 · 장터 ──────────────────────────────────────────────────────
function GaekjuTab({ c }: { c: Campaign }) {
  const [mother, setMother] = useState<Record<number, string>>({});
  const cost = recruitCost(c);
  return (
    <div class="col">
      <div class="section-title" style={{ fontSize: '22px' }}>객주 — 떠돌이 기예인 <span class="small dim" style={{ fontFamily: 'var(--font-body)' }}>로스터 {c.roster.length}/{rosterCap(c)} · 영입 {cost ? `엽전 ${cost}` : '무료'}</span></div>
      <div class="people" data-testid="candidates">
        {c.candidates.map((p, i) => {
          const ms = motherCandidates(c, p.arch);
          const good = quirkOf(p.good);
          const bad = quirkOf(p.bad);
          return (
            <div key={p.uid} class="person col" style={{ '--hc': HERO_COLOR[p.arch] } as CSSProperties}>
              <span class="band" />
              <div class="row" style={{ gap: '8px', flexWrap: 'nowrap' }}><HeroBust id={p.arch} v={hashOf(p.uid)} size={52} /><div><b>{p.name}</b> <span class="small dim">{HERO_NAMES[p.arch]} · 레벨 {p.level} · 체력 {maxHpOf(p)}</span></div></div>
              <div class="tiny dim">{CD.origins[p.arch][p.origin]}</div>
              <div class="row tiny">{good && <span class="chip good">{good.name}</span>}{bad && <span class="chip red">{bad.name}</span>}</div>
              {ms.length > 0 && (
                <label class="tiny row">신어머니
                  <select value={mother[i] ?? ''} onChange={(e) => setMother({ ...mother, [i]: (e.target as HTMLSelectElement).value })}>
                    <option value="">잇지 않는다</option>
                    {ms.map((f) => <option key={f.person.uid} value={f.person.uid}>{displayName(f.person)}</option>)}
                  </select>
                </label>
              )}
              <button class="btn small primary" data-testid={`recruit-${i}`} disabled={c.roster.length >= rosterCap(c) || c.gold < cost} onClick={() => say(recruit(c, i, mother[i] || null), `${p.name}을(를) 들였다`)}>들인다</button>
            </div>
          );
        })}
        {!c.candidates.length && <div class="faint small">이번 절기 후보가 더 없다.</div>}
      </div>
      <div class="section-title" style={{ fontSize: '22px' }}>장터 — 교환소 <span class="small dim" style={{ fontFamily: 'var(--font-body)' }}>재료 ↔ 엽전, 손실 {Math.round(CD.economy.exchangeLoss * 100)}%</span></div>
      <div class="fac-grid">
        {Object.keys(CD.materials).map((f) => (
          <div key={f} class="fac">
            <div class="row"><b>{CD.materials[f]}</b><span class="chip">{c.materials[f] ?? 0}</span></div>
            <div class="tiny dim">{f} · 각인 {CD.engrave[f]}</div>
            <div class="row"><button class="btn small" disabled={(c.materials[f] ?? 0) < 1} onClick={() => say(sellMaterial(c, f, 1), '팔았다')}>1 판다</button><button class="btn small" onClick={() => say(buyMaterial(c, f, 1), '샀다')}>1 산다</button></div>
          </div>
        ))}
      </div>
      <label class="row small">
        <input type="checkbox" checked={c.settings.rift} onChange={() => { c.settings.rift = !c.settings.rift; if (!c.settings.rift) c.countdown = null; commit(); }} />
        저승문 균열 카운트다운 (끄면 균열이 가득 차도 봉합 원정을 요구하지 않는다 — 쉬운 난이도)
      </label>
    </div>
  );
}

// ── 무구방 ───────────────────────────────────────────────────────────
function ForgeTab({ c }: { c: Campaign }) {
  const d = D();
  const [who, setWho] = useState<string>(c.roster[0]?.uid ?? '');
  const [card, setCard] = useState<string>('');
  const p = c.roster.find((x) => x.uid === who);
  return (
    <div class="col" data-testid="forge">
      <div class="small dim">각인: 같은 계열 원귀 재료 {CD.economy.engraveCost} → 로드아웃 카드 1장에 그 계열 상태 +1 생산. 생산만 더한다(R2). 바꾸면 재료를 전액 돌려준다.</div>
      <div class="row">{c.roster.map((x) => <button key={x.uid} class={`btn small ${who === x.uid ? 'on' : ''}`} onClick={() => { setWho(x.uid); setCard(''); }}>{x.name}{x.engraving ? ' ◆' : ''}</button>)}</div>
      {p && (
        <>
          <div class="small">{displayName(p)}: {p.engraving ? `「${d.cardById.get(p.engraving.card)?.name}」 — ${p.engraving.status} +1` : '각인 없음'} {p.engraving && <button class="btn small ghost" onClick={() => { clearEngraving(c, p.uid); commit(); }}>지운다(재료 반환)</button>}</div>
          <div class="cards-wrap">{p.loadout.map((id) => <CardView key={id} def={d.cardById.get(id)!} party={[p.arch]} pickable sel={card === id} onClick={() => setCard(id)} />)}</div>
          <div class="fac-grid">
            {Object.entries(CD.engrave).map(([fam, st]) => (
              <button key={fam} class="fac" disabled={!card || (c.materials[fam] ?? 0) < CD.economy.engraveCost} data-testid={`engrave-${fam}`} onClick={() => say(engrave(c, p.uid, card, fam), `${st} +1 각인`)}>
                <b>{st} +1</b><span class="tiny dim">{CD.materials[fam]} {c.materials[fam] ?? 0}/{CD.economy.engraveCost}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── 내보내기 · 결산 · 결말 ─────────────────────────────────────────────
export function ExportView({ c, onClose }: { c: Campaign; onClose: () => void }) {
  const code = exportCode(c);
  const [msg, setMsg] = useState('');
  return (
    <Overlay onClose={onClose} testid="export-view">
      <div class="row"><h2>캠페인 코드</h2><span class="spacer" /><button class="btn small" onClick={onClose}>닫기</button></div>
      <div class="small dim">이 글자를 저장해 두었다가 표지의 「캠페인 가져오기」에 붙여 넣으면 이 마을에서 이어간다(원정 중인 상태는 담지 않는다).</div>
      <textarea class="code" readOnly value={code} data-testid="export-code" onFocus={(e) => (e.target as HTMLTextAreaElement).select()} rows={6} />
      <div class="row"><button class="btn primary small" data-testid="copy-code" onClick={async () => setMsg((await copyText(code)) ? '복사했다' : '복사가 막혀 있다 — 위 글자를 직접 선택해 복사한다')}>복사</button><span class="small">{msg}</span></div>
    </Overlay>
  );
}

export function SettleScreen() {
  const st = app.settlement!;
  const c = app.campaign!;
  const d = D();
  const dead = st.deaths.map((u) => c.fallen.find((f) => f.person.uid === u)).filter(Boolean);
  return (
    <div class="screen" data-testid="settle">
      <div class="topbar"><span class="title">귀환 결산</span><span class="sub">{seasonName(c.season)}</span><span class="spacer" /><AutoToggle /></div>
      <div class="panel col">{st.lines.map((l, i) => <div key={i} class="small">{l}</div>)}</div>
      {st.learned.length > 0 && (
        <div class="col">
          <div class="section-title" style={{ fontSize: '22px' }}>익힌 카드</div>
          <div class="cards-wrap">{st.learned.map((x) => <CardView key={x.uid + x.card} def={d.cardById.get(x.card)!} party={[d.cardById.get(x.card)!.heroes[0] as HeroId]} note={c.roster.find((p) => p.uid === x.uid)?.name} />)}</div>
        </div>
      )}
      {dead.map((f) => f && (
        <div key={f.person.uid} class="panel row">
          <b>{displayName(f.person)}</b> <span class="small">{f.honored ? '— 원정 길굿에서 천도굿을 받아 조상신이 되었다' : `— 사당에서 천도굿을 올려야 한다 (기한 ${seasonName(f.deadline)})`}</span>
          <span class="spacer" />
          {!f.honored && <button class="btn small primary" data-testid="settle-cheondo" disabled={c.gold < CD.death.cheondoCost} onClick={() => say(cheondo(c, f.person.uid), '천도굿을 올렸다')}>천도굿 (엽전 {CD.death.cheondoCost})</button>}
        </div>
      ))}
      <div class="row"><span class="spacer" /><button class="btn primary" data-testid="settle-continue" onClick={() => { leaveSettlement(app); commit(); }}>{c.ending ? '결말로' : '마을로'}</button></div>
    </div>
  );
}

export function EndingScreen() {
  const c = app.campaign!;
  const sum = endingSummary(c)!;
  const lines = lineage(c);
  const [showExport, setShowExport] = useState(false);
  const title = sum.kind === 'good' ? '배웅의 결말' : sum.kind === 'normal' ? '부서진 빗장' : '닫히지 않은 문';
  return (
    <div class="screen" data-testid="ending">
      <Procession heroes={[...c.roster.filter((p) => !p.busy).slice(0, 3).map((p) => ({ id: p.arch, dead: false })), ...ancestors(c).slice(0, 4).map((f) => ({ id: f.person.arch, dead: true, name: f.person.name }))]}
        region={3} success={sum.kind !== 'fail'} haewons={sum.codex.haewon} kills={0} />
      <div class={`result-banner ${sum.kind === 'fail' ? 'fail' : 'ok'}`}>
        <h1>{title}</h1>
        <div class="dim">{sum.text}</div>
      </div>
      <div class="stat-grid">
        <div class="stat"><div class="v">{sum.seasons} ({seasonName(Math.max(0, sum.seasons - 1))})</div><div class="k">걸린 절기</div></div>
        <div class="stat"><div class="v">{sum.expeditions}회</div><div class="k">원정</div></div>
        <div class="stat"><div class="v">{sum.deaths} · {sum.ancestors}</div><div class="k">떠난 사람 · 조상신</div></div>
        <div class="stat"><div class="v">{sum.longest ? `${sum.longest.name} (${sum.longest.seasons}절기)` : '—'}</div><div class="k">가장 오래 함께한 사람</div></div>
        <div class="stat"><div class="v">{sum.codex.haewon}/{sum.codex.total}종 ({Math.round((sum.codex.haewon / Math.max(1, sum.codex.total)) * 100)}%)</div><div class="k">해원록</div></div>
      </div>
      <div class="section-title" style={{ fontSize: '22px' }}>사당의 계보도</div>
      {!lines.length && <div class="faint small">이어진 계보가 없다.</div>}
      {lines.map((l) => (
        <div key={l.root.person.uid} class="lineage">
          <span class="chip lamp">{l.root.person.name}</span>
          {l.chain.map((x) => {
            const pp = 'person' in x ? x.person : x;
            return <span key={pp.uid}> → <span class="chip">{pp.name}</span></span>;
          })}
        </div>
      ))}
      <div class="ancestors">
        {ancestors(c).map((f) => <div key={f.person.uid} class="wipae" style={{ '--hc': HERO_COLOR[f.person.arch] } as CSSProperties}><div class="wname">{f.person.name}</div><div class="tiny">{HERO_NAMES[f.person.arch]} · 원정 {f.person.history.expeditions}</div></div>)}
      </div>
      <div class="row">
        <button class="btn" onClick={() => setShowExport(true)}>코드 내보내기</button>
        <span class="spacer" />
        <button class="btn primary" data-testid="ending-title" onClick={() => { clearSave(); Object.assign(app, blankApp()); commit(); }}>표지로</button>
      </div>
      {showExport && <ExportView c={c} onClose={() => setShowExport(false)} />}
    </div>
  );
}

export { regionOpen };
