// 표지와 신당(본진 lite): 의뢰 → 파티 3명 → 진형 → 보급품 → 출발.

import type { CSSProperties } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { defaultFormation } from '../../../src/core/engine.ts';
import { HERO_IDS, type HeroId, type HeroState } from '../../../src/core/types.ts';
import { beginExpedition, blankApp } from '../game/actions.ts';
import { importCode, startCampaign } from '../game/campaign.ts';
import { COMMISSIONS, D, ENEMY_EXTRA, HERO_INFO, REGION, SUPPLIES, recommended, type CommissionId, type SupplyId } from '../game/content.ts';
import { bossFor } from '../game/run.ts';
import { hasSave, loadApp } from '../game/save.ts';
import { app, commit, replaceApp, setPanel } from '../game/store.ts';
import { resetLogCursor } from '../game/combat.ts';
import { HeroBust, HeroFigure } from './scene/hero.tsx';

export function TitleScreen() {
  const saved = hasSave();
  const [imp, setImp] = useState(false);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [setup, setSetup] = useState(false);
  const [cseed, setCseed] = useState(() => randomSeed());
  const [rift, setRift] = useState(true);
  return (
    <div class="screen title-screen" data-testid="title">
      <div class="title-lamp" />
      <div class="title-mark">
        <h1>저승굿</h1>
        <div class="title-seal">一幕</div>
      </div>
      <div class="title-sub">
        세 사람이 한 판의 굿을 친다. 마을에서 기예인을 들이고, 저승길 세 구간 — 「{REGION.name}」 · 「역병 든 마을」 · 「열두 대문」 — 을 지나 열두째 대문의 빗장을 풀어라. 떠난 동료는 천도굿으로 조상신이 되어 다음 세대를 받친다.
      </div>
      <div class="title-actions">
        <button class="btn primary" data-testid="new-campaign" onClick={() => setSetup(!setup)}>새 캠페인</button>
        <button class="btn" data-testid="new-run" onClick={() => { app.screen = 'shrine'; commit(); }}>단판 원정</button>
        {saved && (
          <button class="btn" data-testid="continue" onClick={() => {
            const s = loadApp();
            if (s) {
              resetLogCursor();
              replaceApp({ ...blankApp(), ...s });
              commit();
            }
          }}>이어하기</button>
        )}
        <button class="btn ghost" data-testid="import" onClick={() => setImp(!imp)}>캠페인 가져오기</button>
        <button class="btn ghost" onClick={() => setPanel('gloss')}>용어 도움말</button>
      </div>
      {setup && (
        <div class="panel col" style={{ maxWidth: '560px', width: '100%' }} data-testid="campaign-setup">
          <div class="small dim">엽전 300과 기예인 넷으로 신당에 불을 밝힌다. 첫 절기는 설 — 떠돌이 기예인 하나가 무료로 합류한다.</div>
          <label class="row small">시드 <input class="search" style={{ width: '120px' }} inputMode="numeric" data-testid="campaign-seed" value={String(cseed)} onInput={(e) => setCseed(Number((e.target as HTMLInputElement).value.replace(/\D/g, '')) || 1)} /></label>
          <label class="row small"><input type="checkbox" checked={rift} data-testid="campaign-rift" onChange={() => setRift(!rift)} /> 저승문 균열 카운트다운 (끄면 쉬운 난이도)</label>
          <div class="row"><button class="btn primary" data-testid="start-campaign" onClick={() => { startCampaign(app, cseed, rift); commit(); }}>시작</button></div>
        </div>
      )}
      {imp && (
        <div class="panel col" style={{ maxWidth: '560px', width: '100%' }}>
          <div class="small dim">마을의 「내보내기」에서 받은 코드(JSG1:…)를 붙여 넣는다.</div>
          <textarea class="code" rows={4} value={code} data-testid="import-code" onInput={(e) => setCode((e.target as HTMLTextAreaElement).value)} />
          <div class="row"><button class="btn small primary" data-testid="import-go" onClick={() => {
            const c = importCode(code);
            if (typeof c === 'string') return setErr(c);
            Object.assign(app, blankApp());
            app.campaign = c;
            app.screen = c.ending ? 'ending' : 'village';
            commit();
          }}>가져온다</button><span class="small" style={{ color: '#ffb3a3' }}>{err}</span></div>
        </div>
      )}
      <div class="disclaimer">실제 무속 신앙에서 영감을 받은 창작물입니다. 신령·의례의 이름과 사연은 모두 가상이며, 원문 무가를 인용하지 않습니다. Prototype ② — 캠페인 v1 (9단계 반복 2).</div>
    </div>
  );
}

function randomSeed(): number {
  return (Math.floor(Math.random() * 900000) + 100000) | 0;
}

export function ShrineScreen() {
  const d = D();
  const [commission, setCommission] = useState<CommissionId>('boss');
  const [party, setParty] = useState<HeroId[]>([]);
  const [formation, setFormationS] = useState<HeroId[]>([]);
  const [selSlot, setSelSlot] = useState(-1);
  const [seed, setSeed] = useState(() => randomSeed());
  const [buy, setBuy] = useState<Record<SupplyId, number>>({ candle: 0, rice: 0, incense: 0, jijeon: 0, bujeok: 0, sul: 0 });
  const c = COMMISSIONS.find((x) => x.id === commission)!;
  const boss = commission === 'boss' ? bossFor(seed) : null;
  const rec = recommended(commission, boss);
  const spent = SUPPLIES.reduce((a, s) => a + buy[s.id] * s.price, 0);
  const left = c.purse - spent;

  const toggleHero = (id: HeroId) => {
    let next: HeroId[];
    if (party.includes(id)) next = party.filter((x) => x !== id);
    else if (party.length < 3) next = [...party, id];
    else return;
    setParty(next);
    // 기본 진형: 수호 > 근접 > 체력 (엔진 defaultFormation 과 같다)
    const hs = next.map((h, idx) => ({ id: h, idx, melee: d.heroes.get(h)!.range === 'melee', maxHp: d.heroes.get(h)!.hp, dead: false }) as HeroState);
    setFormationS(defaultFormation(hs).map((i) => next[i]));
    setSelSlot(-1);
  };
  const clickSlot = (i: number) => {
    if (selSlot < 0) return setSelSlot(i);
    if (selSlot === i) return setSelSlot(-1);
    const f = formation.slice();
    [f[selSlot], f[i]] = [f[i], f[selSlot]];
    setFormationS(f);
    setSelSlot(-1);
  };
  const setN = (id: SupplyId, n: number) => {
    const s = SUPPLIES.find((x) => x.id === id)!;
    const v = Math.max(0, Math.min(s.max, n));
    const cost = SUPPLIES.reduce((a, x) => a + (x.id === id ? v : buy[x.id]) * x.price, 0);
    if (cost > c.purse) return;
    setBuy({ ...buy, [id]: v });
  };
  const fillRec = () => {
    const next = { ...buy };
    let cost = 0;
    for (const s of SUPPLIES) {
      next[s.id] = Math.min(s.max, rec[s.id]);
      cost += next[s.id] * s.price;
    }
    // 돈이 모자라면 뒤쪽 품목부터 줄인다
    for (const s of [...SUPPLIES].reverse()) while (cost > c.purse && next[s.id] > 0) {
      next[s.id]--;
      cost -= s.price;
    }
    setBuy(next);
  };
  const ready = party.length === 3 && formation.length === 3;
  const start = () => {
    if (!ready) return;
    const order = formation.map((h) => party.indexOf(h));
    beginExpedition(app, { seed, commission, party, formation: order, supplies: buy, gold: left, spent });
    commit();
  };
  const bossInfo = useMemo(() => {
    if (!boss) return null;
    const id = boss === 'b1' ? 'sakkun' : 'sangyeo';
    const ex = ENEMY_EXTRA.get(id)!;
    const def = d.enemyById.get(id)!;
    return { name: ex.name, han: ex.han, hp: boss === 'b1' ? `${def.hpMin}~${def.hpMax}` : `${def.hpMin} + 상여꾼 넷`, hint: boss === 'b1' ? '전투 시작 시 손에 「노잣돈 바치기」(지전 3). 지전을 아껴 두면 해원할 수 있다.' : '상여꾼을 다 쓰러뜨리면 상여가 강해지고 해원도 어렵다.' };
  }, [boss]);

  return (
    <div class="screen shrine" data-testid="shrine">
      <div class="topbar">
        <span class="title">신당</span>
        <span class="sub">의뢰를 받고, 함께 갈 세 사람을 고르고, 보급품을 챙긴다.</span>
        <span class="spacer" />
        <button class="btn small ghost" onClick={() => setPanel('gloss')}>용어</button>
        <button class="btn small ghost" onClick={() => { app.screen = 'title'; commit(); }}>표지</button>
      </div>

      <div class="section-title"><span class="num">一</span>의뢰</div>
      <div class="commissions">
        {COMMISSIONS.map((cm) => (
          <button key={cm.id} class={`commission ${commission === cm.id ? 'sel' : ''}`} data-testid={`commission-${cm.id}`} onClick={() => { setCommission(cm.id); setBuy({ candle: 0, rice: 0, incense: 0, jijeon: 0, bujeok: 0, sul: 0 }); }}>
            <div class="row"><span class="chip lamp">{cm.length}</span><span class="faint small">{cm.place} · {cm.minutes}</span></div>
            <h4>{cm.name}</h4>
            <div class="small dim">{cm.story}</div>
            <div class="small">목표: {cm.goal}</div>
            <div class="small">방 {cm.rooms[0]}~{cm.rooms[1]} · 수호 방 {cm.guard[0]}~{cm.guard[1]} · 길굿 {cm.camps} · 굿비 선금 <b style={{ color: 'var(--lamp)' }}>{cm.purse}</b> 엽전</div>
            {cm.id === 'boss' && commission === 'boss' && bossInfo && (
              <div class="boss-reveal small">
                <b style={{ color: 'var(--cinnabar-2)' }}>보스 굴: {bossInfo.name}</b> (체력 {bossInfo.hp})<br />
                <span class="dim">{bossInfo.han}</span><br />{bossInfo.hint}
              </div>
            )}
          </button>
        ))}
      </div>

      <div class="section-title"><span class="num">二</span>파티 <span class="small dim" style={{ fontFamily: 'var(--font-body)' }}>{party.length}/3</span></div>
      <div class="heroes-grid">
        {HERO_IDS.map((id) => {
          const hi = HERO_INFO.get(id)!;
          const sel = party.includes(id);
          const starters = d.starters.get(id)!;
          return (
            <button key={id} class={`hero-card with-bust ${sel ? 'sel' : ''}`} style={{ '--hc': hi.color } as CSSProperties} data-testid={`hero-${id}`} onClick={() => toggleHero(id)} aria-pressed={sel}>
              <span class="band" />
              {sel && <span class="order">{party.indexOf(id) + 1}</span>}
              <HeroBust id={id} size={64} />
              <div class="row" style={{ alignItems: 'baseline' }}>
                <span class="hname">{hi.name}</span>
                <span class="small dim">{hi.range} · {hi.role} · 체력 {hi.hp}</span>
              </div>
              <div class="small">{hi.blurb}</div>
              <div class="row tiny">
                <span class="chip lamp">개인 · {hi.personal}</span>
                <span class="chip">시그니처 {hi.signature}</span>
                <span class="chip">수출 {hi.exports.join('·')}</span>
                <span class="chip">수입 {hi.imports}</span>
              </div>
              <div class="tiny dim">{hi.personalDesc}</div>
              <div class="starter-list">
                {starters.map((s) => (
                  <div key={s.id} class="starter"><b>{s.name}</b>{s.cost} · {s.text}</div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div class="section-title"><span class="num">三</span>진형</div>
      <div class="small dim">칸을 눌러 두 영웅의 자리를 바꾼다. 적은 대부분 선두를 친다. 근접 영웅은 공격하면 선두로 나선다.</div>
      <div class="formation" data-testid="formation">
        {['선두', '중열', '후열'].map((lab, i) => {
          const h = formation[i];
          const hi = h ? HERO_INFO.get(h) : null;
          return (
            <button key={lab} class={`slot ${selSlot === i ? 'sel' : ''}`} onClick={() => h && clickSlot(i)} disabled={!h}>
              <span class="lab">{lab}</span>
              {h && <svg viewBox="-60 -150 120 160" width="64" height="85" aria-hidden="true"><HeroFigure id={h} look={{ mask: (['malttugi', 'yangban', 'halmi'] as const)[i] }} /></svg>}
              <span class="who" style={{ color: hi?.color }}>{hi ? hi.name : '—'}</span>
              {hi && <span class="tiny dim">{hi.range} · 체력 {hi.hp}</span>}
            </button>
          );
        })}
      </div>

      <div class="section-title"><span class="num">四</span>보급품</div>
      <div class="row">
        <span class="purse">남은 엽전 {left}</span>
        <span class="small dim">/ 선금 {c.purse}</span>
        <span class="spacer" />
        <button class="btn small lamp" data-testid="buy-rec" onClick={fillRec}>권장량 담기</button>
      </div>
      <div class="supplies">
        {SUPPLIES.map((s) => (
          <div key={s.id} class="supply-row" data-testid={`supply-${s.id}`}>
            <div class="col" style={{ gap: '2px' }}>
              <div class="row" style={{ gap: '6px' }}>
                <b>{s.name}</b>
                <span class="small dim">{s.price} 엽전 · 최대 {s.max}</span>
                <span class={`chip ${buy[s.id] >= rec[s.id] ? 'good' : ''}`}>권장 {rec[s.id]}</span>
              </div>
              <div class="tiny dim">{s.desc}</div>
            </div>
            <div class="stepper">
              <button class="btn small" onClick={() => setN(s.id, buy[s.id] - 1)} aria-label={`${s.name} 하나 빼기`}>−</button>
              <span class="n">{buy[s.id]}</span>
              <button class="btn small" onClick={() => setN(s.id, buy[s.id] + 1)} aria-label={`${s.name} 하나 더`}>+</button>
            </div>
          </div>
        ))}
      </div>
      <div class="row small dim">
        <label class="row" style={{ gap: '6px' }}>
          시드
          <input class="search" style={{ width: '120px' }} data-testid="seed" inputMode="numeric" value={String(seed)} onInput={(e) => setSeed(Number((e.target as HTMLInputElement).value.replace(/\D/g, '')) || 1)} />
        </label>
        <button class="btn small ghost" onClick={() => setSeed(randomSeed())}>새 시드</button>
        <span>같은 시드면 같은 저승길이 나온다.</span>
      </div>
      <div class="start-bar row">
        <span class="small dim">{ready ? `${party.map((p) => HERO_INFO.get(p)!.name).join(' · ')} — ${c.name}` : '영웅 세 명을 고르면 떠날 수 있다.'}</span>
        <span class="spacer" />
        <button class="btn primary" data-testid="start" disabled={!ready} onClick={start}>저승길로</button>
      </div>
    </div>
  );
}
