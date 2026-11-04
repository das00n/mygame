// 저승길 지도: 방·길목(3칸) SVG, 이동·순간 이동·정찰, 넋등, 파티·보급품·목표·귀환.

import type { CSSProperties } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { abandon, campAvailable, isBossStep, moveTo, openBujeokPurge, openCamp, openSul, pendingHere, reopenHere, returnHome, travelTo, useCandleOnMap } from '../game/actions.ts';
import { COMMISSION_BY_ID, D, ENEMY_EXTRA, HERO_COLOR, RELIC_BY_ID, RELIC_IMPL, bandOf } from '../game/content.ts';
import { neighbors, objective, samePos, travelCost } from '../game/dungeon.ts';
import { effMax, heroName } from '../game/run.ts';
import { app, commit, setPanel } from '../game/store.ts';
import type { Content, Pos, Run } from '../game/types.ts';
import { AutoToggle } from './auto.tsx';
import { Bar, iconPath, LightBar, Overlay } from './common.tsx';

const U = 40; // 방 사이 간격
const M = 16; // 여백

function useNarrow(): boolean {
  const q = '(max-width: 640px)';
  const [n, setN] = useState(() => (typeof matchMedia === 'function' ? matchMedia(q).matches : false));
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const m = matchMedia(q);
    const f = () => setN(m.matches);
    m.addEventListener?.('change', f);
    return () => m.removeEventListener?.('change', f);
  }, []);
  return n;
}

function contentIcon(c: Content): { icon: string; color: string } | null {
  switch (c.k) {
    case 'battle': return { icon: 'atk', color: '#ff8f78' };
    case 'elite': return { icon: 'multi', color: '#ff6a4d' };
    case 'boss': return { icon: 'aoe', color: '#ff6a4d' };
    case 'curio': return { icon: 'altar', color: '#f2c46b' };
    case 'event': return { icon: 'doom', color: '#cfc2ff' };
    case 'trap': return { icon: 'collapse', color: '#ff8f78' };
    default: return null;
  }
}

export function MapView({ run, onPick }: { run: Run; onPick: (p: Pos) => void }) {
  const vertical = useNarrow();
  const dg = run.dungeon;
  const maxX = Math.max(...dg.rooms.map((r) => r.x));
  const maxY = Math.max(...dg.rooms.map((r) => r.y));
  const P = (x: number, y: number): [number, number] => (vertical ? [M + y * U, M + x * U] : [M + x * U, M + y * U]);
  const W = (vertical ? maxY : maxX) * U + 2 * M;
  const H = (vertical ? maxX : maxY) * U + 2 * M;
  const reach = neighbors(dg, run.pos);
  const isReach = (p: Pos) => reach.some((q) => samePos(p, q));
  const here = run.pos;
  const hereXY = here.kind === 'room' ? P(dg.rooms[here.room].x, dg.rooms[here.room].y) : tileXY(here.cor, here.i);
  function tileXY(cor: number, i: number): [number, number] {
    const c = dg.corridors[cor];
    const a = dg.rooms[c.a];
    const b = dg.rooms[c.b];
    const f = (i + 1) / (c.tiles.length + 1);
    const [ax, ay] = P(a.x, a.y);
    const [bx, by] = P(b.x, b.y);
    return [ax + (bx - ax) * f, ay + (by - ay) * f];
  }
  // 강: 지역 「건너지 못한 나루」 — 지도를 따라 흐르는 물길(장식)
  const riverPts = Array.from({ length: maxX + 2 }, (_, i) => {
    const x = i - 0.5;
    const y = maxY / 2 + Math.sin(i * 1.3) * 0.35;
    return P(x, y);
  });
  const river = `M${riverPts.map((p) => p.join(',')).join(' L')}`;
  return (
    <svg class="map-svg" viewBox={`0 0 ${W} ${H}`} data-testid="map" style={vertical ? { maxHeight: '520px' } : undefined}>
      <defs>
        <radialGradient id="lampHalo">
          <stop offset="0" stop-color="#ffc964" stop-opacity=".55" />
          <stop offset="1" stop-color="#ffc964" stop-opacity="0" />
        </radialGradient>
      </defs>
      <path class="river" d={river} stroke-width={U * 0.9} />
      {dg.corridors.map((c) => {
        const a = dg.rooms[c.a];
        const b = dg.rooms[c.b];
        const [ax, ay] = P(a.x, a.y);
        const [bx, by] = P(b.x, b.y);
        return <line key={`l${c.id}`} class="cor-line" x1={ax} y1={ay} x2={bx} y2={by} />;
      })}
      <circle class="halo" cx={hereXY[0]} cy={hereXY[1]} r={14 + run.light * 0.34} />
      {dg.corridors.map((c) => c.tiles.map((t, i) => {
        const [x, y] = tileXY(c.id, i);
        const pos: Pos = { kind: 'tile', cor: c.id, i };
        const r = isReach(pos);
        const ic = t.known && !t.content.done ? contentIcon(t.content) : null;
        return (
          <g key={`t${c.id}.${i}`} data-testid={r ? `step-t${c.id}-${i}` : undefined} data-new={r && !t.walked ? '1' : undefined} onClick={r ? () => onPick(pos) : undefined} style={r ? { cursor: 'pointer' } : undefined}>
            {r && <rect x={x - 6} y={y - 6} width={12} height={12} fill="transparent" />}
            <rect class={`tile ${t.walked ? 'walked' : ''} ${r ? 'reach' : ''}`} x={x - 5} y={y - 5} width={10} height={10} />
            {ic && <svg x={x - 4.5} y={y - 4.5} width={9} height={9} viewBox="0 0 16 16" style={{ color: ic.color }}>{iconBody(ic.icon)}</svg>}
          </g>
        );
      }))}
      {dg.rooms.map((rm) => {
        const [x, y] = P(rm.x, rm.y);
        const pos: Pos = { kind: 'room', room: rm.id };
        const r = isReach(pos);
        const tc = !r && rm.visited && !(here.kind === 'room' && here.room === rm.id) ? travelCost(dg, here, rm.id) : null;
        const s = rm.kind === 'boss' ? 26 : 18;
        const ic = rm.known && rm.kind !== 'boss' && !rm.content.done ? contentIcon(rm.content) : null;
        const click = r ? () => onPick(pos) : tc !== null ? () => onPick(pos) : undefined;
        return (
          <g key={`r${rm.id}`} class={tc !== null ? 'travel' : ''} data-new={r && !rm.visited ? '1' : undefined} onClick={click} data-testid={r ? `step-r${rm.id}` : tc !== null ? `travel-r${rm.id}` : `room-${rm.id}`} style={click ? { cursor: 'pointer' } : undefined}>
            {click && <rect x={x - s / 2 - 2} y={y - s / 2 - 2} width={s + 4} height={s + 4} fill="transparent" />}
            <rect class={`room ${rm.visited ? 'visited' : ''} ${rm.kind === 'boss' ? 'boss' : ''} ${rm.camp ? 'camp' : ''} ${r ? 'reach' : ''}`} x={x - s / 2} y={y - s / 2} width={s} height={s} />
            {rm.kind === 'entrance' && <path d={`M${x - 6} ${y + 6}V${y - 5}M${x + 6} ${y + 6}V${y - 5}M${x - 8} ${y - 4}H${x + 8}`} stroke="#e2573f" stroke-width="1.6" fill="none" />}
            {rm.kind === 'ferry' && <path d={`M${x - 7} ${y + 1}h14l-3 4h-8z M${x} ${y + 1}V${y - 6}l5 4`} stroke="#8fb5dc" stroke-width="1.3" fill="none" />}
            {ic && rm.kind !== 'ferry' && <svg x={x - 6.5} y={y - 6.5} width={13} height={13} viewBox="0 0 16 16" style={{ color: ic.color }}>{iconBody(ic.icon)}</svg>}
            {rm.kind === 'boss' && <text x={x} y={y + 1} class="boss-glyph">{rm.content.done ? '解' : '恨'}</text>}
            {!rm.known && <text class="q" x={x} y={y}>?</text>}
            {rm.camp && !rm.campUsed && <circle cx={x + s / 2 - 1} cy={y - s / 2 + 1} r={3.2} fill="#ffc964" stroke="#2a1a06" stroke-width=".8" />}
            {tc !== null && <text class="q" x={x} y={y + s / 2 + 6} style={{ fill: '#ffc964' }}>−{tc}</text>}
          </g>
        );
      })}
      <circle class="here" cx={hereXY[0]} cy={hereXY[1]} r={4.2} />
    </svg>
  );
}

function iconBody(name: string): JSX.Element {
  return iconPath(name);
}

export function MapScreen() {
  const run = app.run!;
  const d = D();
  const obj = objective(run);
  const [confirm, setConfirm] = useState<null | { kind: 'travel'; room: number; cost: number } | { kind: 'boss' } | { kind: 'abandon' }>(null);
  const band = bandOf(run.light);
  const cm = COMMISSION_BY_ID.get(run.commission)!;
  const onPick = (p: Pos) => {
    const reach = neighbors(run.dungeon, run.pos).some((q) => samePos(p, q));
    if (reach) {
      if (isBossStep(run, p)) return setConfirm({ kind: 'boss' });
      moveTo(app, p);
      commit();
      return;
    }
    if (p.kind === 'room') {
      const cost = travelCost(run.dungeon, run.pos, p.room);
      if (cost !== null) setConfirm({ kind: 'travel', room: p.room, cost });
    }
  };
  const here = run.pos.kind === 'room' ? run.dungeon.rooms[run.pos.room] : null;
  const curses = run.deck.filter((c) => d.cards[c.d].isCurse).length;
  const bossName = run.bossEnc ? (run.bossEnc === 'b1' ? '삯 못 받은 뱃사공' : '넘어가지 못한 상여') : null;
  return (
    <div class="screen" data-testid="map-screen">
      <div class="topbar">
        <span class="title">{cm.place}</span>
        <span class="sub">{cm.name} · {obj.label} {obj.progress}{bossName ? ` · 보스 굴: ${bossName}` : ''}</span>
        <span class="spacer" />
        <AutoToggle />
        <button class="btn small ghost" onClick={() => setPanel('deck')} data-testid="open-deck">덱 {run.deck.length}</button>
        <button class="btn small ghost" onClick={() => setPanel('gloss')}>용어</button>
      </div>
      <div class="map-layout">
        <div class="col">
          <LightBar light={run.light} />
          <div class="map-wrap">
            <MapView run={run} onPick={onPick} />
            <div class="map-legend">
              <span><svg width="12" height="12" viewBox="0 0 16 16" style={{ color: '#ff8f78' }}>{iconBody('atk')}</svg>원귀</span>
              <span><svg width="12" height="12" viewBox="0 0 16 16" style={{ color: '#ff6a4d' }}>{iconBody('multi')}</svg>수호 방</span>
              <span><svg width="12" height="12" viewBox="0 0 16 16" style={{ color: '#f2c46b' }}>{iconBody('altar')}</svg>기물</span>
              <span><svg width="12" height="12" viewBox="0 0 16 16" style={{ color: '#cfc2ff' }}>{iconBody('doom')}</svg>방 이벤트</span>
              <span><svg width="12" height="12" viewBox="0 0 16 16" style={{ color: '#ff8f78' }}>{iconBody('collapse')}</svg>덫</span>
              <span><i style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ffc964', display: 'inline-block' }} />길굿 터</span>
              <span>? 미답 · −N 순간 이동 넋등</span>
            </div>
          </div>
          <div class="small dim">빛나는 칸으로 한 걸음(새 칸 넋등 −6 · 지나온 칸 −1). 방문한 방은 눌러서 바로 간다(거리 × 1). 들어서는 방에서 {Math.round((0.25 + band.scout) * 100)}%로 정찰.</div>
        </div>
        <div class="side">
          {confirm && (
            <div class="confirm col" data-testid="confirm">
              {confirm.kind === 'travel' && (
                <>
                  <div>방문한 방으로 바로 간다 — 넋등 −{confirm.cost}</div>
                  <div class="row"><button class="btn primary small" data-testid="confirm-yes" onClick={() => { travelTo(app, confirm.room); setConfirm(null); commit(); }}>간다</button><button class="btn small" onClick={() => setConfirm(null)}>그만둔다</button></div>
                </>
              )}
              {confirm.kind === 'boss' && (
                <>
                  <div><b style={{ color: 'var(--cinnabar-2)' }}>보스 굴</b> — {bossName}. 들어서면 물러날 수 없다.{run.bossEnc === 'b1' ? ` 지전 ${run.supplies.jijeon} (노잣돈 3 필요).` : ''}</div>
                  <div class="row"><button class="btn primary small" data-testid="confirm-yes" onClick={() => { const p = { kind: 'room', room: run.dungeon.boss } as Pos; setConfirm(null); moveTo(app, p); commit(); }}>들어간다</button><button class="btn small" onClick={() => setConfirm(null)}>아직</button></div>
                </>
              )}
              {confirm.kind === 'abandon' && (
                <>
                  <div>원정을 포기하고 입구로 돌아간다. 파티 귀기 +20, 의뢰 보수는 없다.</div>
                  <div class="row"><button class="btn primary small" data-testid="confirm-yes" onClick={() => { setConfirm(null); abandon(app); commit(); }}>포기한다</button><button class="btn small" onClick={() => setConfirm(null)}>계속 간다</button></div>
                </>
              )}
            </div>
          )}
          <div class="row">
            {campAvailable(run) && <button class="btn lamp" data-testid="open-camp" onClick={() => { openCamp(app); commit(); }}>길굿을 연다</button>}
            {pendingHere(run) && <button class="btn" data-testid="reopen" onClick={() => { reopenHere(app); commit(); }}>다시 살펴본다</button>}
            {obj.met && run.commission !== 'boss' && <button class="btn primary" data-testid="return" onClick={() => { returnHome(app); commit(); }}>목표 달성 — 귀환</button>}
            <span class="spacer" />
            <button class="btn small ghost" onClick={() => setConfirm({ kind: 'abandon' })}>원정 포기</button>
          </div>
          {here && here.camp && here.campUsed && <div class="small faint">이 방의 길굿은 이미 열었다.</div>}
          <PartyStrip run={run} />
          <div class="supply-grid">
            <div class="supply-cell"><span class="small dim">촛불</span><span class="n">{run.supplies.candle}</span><button class="btn small" data-testid="use-candle" disabled={!run.supplies.candle || run.light >= 100} onClick={() => { useCandleOnMap(app); commit(); }}>켠다 +25</button></div>
            <div class="supply-cell"><span class="small dim">술</span><span class="n">{run.supplies.sul}</span><button class="btn small" disabled={!run.supplies.sul} onClick={() => { openSul(app); commit(); }}>귀기 −10</button></div>
            <div class="supply-cell"><span class="small dim">부적</span><span class="n">{run.supplies.bujeok}</span><button class="btn small" disabled={!run.supplies.bujeok || !curses} onClick={() => { openBujeokPurge(app); commit(); }}>씌임 정화</button></div>
            <div class="supply-cell"><span class="small dim">쌀</span><span class="n">{run.supplies.rice}</span></div>
            <div class="supply-cell"><span class="small dim">향</span><span class="n">{run.supplies.incense}</span></div>
            <div class="supply-cell"><span class="small dim">지전</span><span class="n">{run.supplies.jijeon}</span></div>
          </div>
          <div class="row small"><span class="chip lamp">엽전 {run.gold}</span><span class="chip">재료 {run.materials}</span>{run.chiseong > 0 && <span class="chip lamp">치성 {run.chiseong}</span>}{run.threshold > 0 && <span class="chip good">씌임 임계 +{run.threshold}</span>}{run.noNightRaid && <span class="chip good">밤 습격 0%</span>}</div>
          {run.relics.length > 0 && (
            <div class="row small">
              {run.relics.map((r) => {
                const rl = RELIC_BY_ID.get(r)!;
                const im = RELIC_IMPL[r];
                return <span key={r} class={`chip ${im.impl === 'stub' ? '' : 'lamp'}`} title={`${rl.effect}${im.note ? ` (${im.note})` : ''}`}>{rl.name}{im.impl === 'stub' ? ' (미구현)' : ''}</span>;
              })}
            </div>
          )}
          <NextFight run={run} />
          <div class="panel"><div class="log">{run.log.slice(-6).reverse().map((l, i) => <div key={i}>{l}</div>)}</div></div>
          {run.revealed.length > 0 && <Codex run={run} />}
        </div>
      </div>
    </div>
  );
}

function NextFight({ run }: { run: Run }) {
  const n = run.next;
  const bits: string[] = [];
  if (n.firstStrike) bits.push('선제 확정');
  if (n.ambush) bits.push('기습당함 확정');
  if (n.jangdan) bits.push(`첫 턴 장단 +${n.jangdan}`);
  if (n.shuffle) bits.push('진형 섞임');
  if (n.wounds.length) bits.push(`상처 카드 ${n.wounds.length}`);
  if (n.gunpowder) bits.push(`화약 ${n.gunpowder}`);
  if (n.blade) bits.push('작두 위에서 시작');
  if (n.momju) bits.push('몸주 신령');
  if (n.aura) bits.push(`오라 ${n.aura}`);
  if (n.talismans) bits.push(`화부 ${n.talismans}`);
  if (n.drawBonus) bits.push(`첫 턴 +${n.drawBonus}장`);
  if (!bits.length) return null;
  return <div class="row small"><span class="dim">다음 전투:</span>{bits.map((b) => <span key={b} class="chip">{b}</span>)}</div>;
}

function Codex({ run }: { run: Run }) {
  const [open, setOpen] = useState(false);
  return (
    <div class="panel small">
      <button class="btn small ghost" onClick={() => setOpen(!open)}>해원록 {run.revealed.length}종 {open ? '접기' : '펼치기'}</button>
      {open && (
        <div class="col" style={{ marginTop: '6px' }}>
          {run.revealed.map((id) => {
            const e = ENEMY_EXTRA.get(id);
            if (!e?.haewon) return null;
            return <div key={id}><b>{e.name}</b> <span class="dim">{e.haewon.rule}</span></div>;
          })}
        </div>
      )}
    </div>
  );
}

export function PartyStrip({ run }: { run: Run }) {
  const order = [...run.formation.filter((i) => !run.heroes[i].dead), ...run.heroes.map((_, i) => i).filter((i) => run.heroes[i].dead)];
  const labs = ['선두', '중열', '후열'];
  return (
    <div class="party-strip" data-testid="party">
      {order.map((i, k) => {
        const h = run.heroes[i];
        const mx = effMax(h);
        return (
          <div key={h.id} class="mini-hero" style={{ '--hc': HERO_COLOR[h.id] } as CSSProperties}>
            <div class="row" style={{ justifyContent: 'space-between', gap: '4px' }}><span class="nm">{heroName(h.id)}</span><span class="tiny faint">{h.dead ? '떠남' : labs[Math.min(k, 2)]}</span></div>
            {h.dead ? <div class="tiny dim">조상신이 되기를 기다린다</div> : (
              <>
                <div class="tiny">체력 {h.hp}/{mx}</div>
                <Bar v={h.hp} max={mx} />
                <div class="tiny dim">귀기 {h.stress}</div>
                <Bar v={h.stress} max={100} cls="stress" />
                <div class="row tiny" style={{ gap: '3px' }}>{h.injured && <span class="chip red">중상</span>}{h.recovering && <span class="chip">회복 중</span>}</div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { Overlay };
