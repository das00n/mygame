// 길 위의 장면: 길목(CorridorScene) · 길굿(CampScene) · 결과 행렬(Procession) · 전투 뒤풀이(Aftermath) · 창 그림(DialogArt).
// 모두 전투와 같은 측면 무대·같은 인형·같은 배경 겹을 쓴다(안 A ②: DD1 처럼 전투·탐험이 한 무대).

import type { JSX } from 'preact';
import type { HeroId } from '../../../../src/core/types.ts';
import { CURIO_BY_ID, D, EVENT_BY_ID, HERO_COLOR, TRAP_BY_ID, bandOf } from '../../game/content.ts';
import { heroName } from '../../game/run.ts';
import type { Content, DialogState, Run } from '../../game/types.ts';
import { Backdrop, BambooGate, BigGate, EopgyeongSeats, FlowerHill, Hongsalmun, LightVignette, type BackdropVariant } from './backdrop.tsx';
import type { LastBattle } from './fx.ts';
import { HeroParts, Shadow } from './hero.tsx';
import { pctX, pctY } from './palette.ts';
import { Boat, Cairn, Campfire, SignPost, Tablet, TrapMark } from './props.tsx';
import { SoulWisp, SpiritParts, SpiritShadow, type SpiritState, type Tier } from './spirit.tsx';
import { Stage } from './stage.tsx';

const W = 1280;

function Lantern({ x, y, light }: { x: number; y: number; light: number }) {
  return (
    <g transform={`translate(${x} ${y})`} class="lantern">
      <circle r={40 + light * 0.5} fill="url(#jsg-lamp)" opacity={0.4 + light / 160} />
      <path d="M0 -40 L0 -24" stroke="#a08a5a" stroke-width="2" />
      <ellipse cx="0" cy="0" rx="14" ry="20" fill={light > 0 ? '#ffe2a0' : '#6a5a40'} stroke="#a06a2a" stroke-width="2" />
      <path d="M-14 0 h28 M-12 -9 h24 M-12 9 h24" stroke="#c9873a" stroke-width="1" />
    </g>
  );
}

/** 파티가 걷는다: 선두가 오른쪽(앞) */
function Party({ run, frontX, gap = 92, y, scale = 0.9, walk = true }: { run: Run; frontX: number; gap?: number; y: number; scale?: number; walk?: boolean }) {
  const order = run.formation.filter((i) => !run.heroes[i].dead);
  return (
    <>
      {order.map((hi, k) => {
        const h = run.heroes[hi];
        return (
          <g key={h.id} transform={`translate(${frontX - k * gap} ${y}) scale(${scale})`}>
            <Shadow />
            <g class={walk ? 'walk' : ''} style={{ animationDelay: `${k * 0.18}s` }}>
              <HeroParts id={h.id} look={{ mask: (['malttugi', 'yangban', 'halmi'] as const)[Math.min(k, 2)] }} />
            </g>
          </g>
        );
      })}
    </>
  );
}

function contentName(c: Content): string {
  switch (c.k) {
    case 'battle': return '원귀';
    case 'elite': return '수호 방';
    case 'boss': return '보스 굴';
    case 'curio': return CURIO_BY_ID.get(c.id ?? '')?.name ?? '기물';
    case 'event': return EVENT_BY_ID.get(c.id ?? '')?.name ?? '방 이벤트';
    case 'trap': return TRAP_BY_ID.get(c.id ?? '')?.name ?? '덫';
    default: return '';
  }
}

/** 칸의 내용 소품 (알아본 것만) */
function ContentProp({ c, x, y, s = 1, region }: { c: Content; x: number; y: number; s?: number; region: number }) {
  if (c.done) return null;
  switch (c.k) {
    case 'battle':
    case 'elite':
      return (
        <g transform={`translate(${x} ${y}) scale(${s * (c.k === 'elite' ? 0.95 : 0.75)})`} opacity=".8">
          <SpiritShadow />
          <SpiritParts family={region === 3 ? '무장 원귀' : region === 2 ? '역귀' : '수귀'} />
        </g>
      );
    case 'curio': return <Cairn x={x} y={y} s={0.75 * s} />;
    case 'event': return <SignPost x={x} y={y} s={s} />;
    case 'trap': return <TrapMark x={x} y={y + 6} s={s} />;
    default: return null;
  }
}

/** 길목 장면: 지금 서 있는 길목 3칸(또는 방)을 측면으로 걷는다. 넋등 빛 반경 바깥 앞쪽은 어둡다 */
export function CorridorScene({ run }: { run: Run }) {
  const H = 300;
  const FY = 238;
  const dg = run.dungeon;
  const region = run.region ?? 1;
  const caps: JSX.Element[] = [];
  let variant: BackdropVariant = 'path';
  let svg: JSX.Element;
  const band = bandOf(run.light);
  if (run.pos.kind === 'tile') {
    const c = dg.corridors[run.pos.cor];
    const rev = run.prevRoom === c.b; // b 쪽에서 들어왔으면 b → a 로 걷는다
    const from = dg.rooms[rev ? c.b : c.a];
    const to = dg.rooms[rev ? c.a : c.b];
    const tiles = rev ? [...c.tiles].reverse() : c.tiles;
    const cur = rev ? c.tiles.length - 1 - run.pos.i : run.pos.i;
    const TX = [360, 650, 940];
    if (to.gate || (to.kind === 'boss' && region === 3)) variant = 'gate';
    else if (to.kind === 'boss') variant = 'boss';
    svg = (
      <>
        <Backdrop region={region} W={W} H={H} FY={FY} variant={variant === 'gate' ? 'path' : variant} />
        {from.kind === 'entrance' ? <Hongsalmun x={90} y={FY + 4} s={0.85} /> : <RoomPosts x={90} y={FY + 4} />}
        <g class="tiles">
          {tiles.map((t, i) => (
            <g key={i}>
              <path d={`M${TX[i] - 130} ${FY + 10} L${TX[i] + 130} ${FY + 8} L${TX[i] + 124} ${FY + 28} L${TX[i] - 136} ${FY + 30} Z`} fill={i === cur ? '#5a4a30' : t.walked ? '#463a28' : '#2e281e'} stroke="#1a1712" stroke-width="1.5" />
              {i !== cur && (t.known ? <ContentProp c={t.content} x={TX[i] + 20} y={FY + 4} region={region} /> : <g opacity=".7"><circle cx={TX[i] + 20} cy={FY - 50} r="22" fill="none" stroke="#7d7765" stroke-width="2" stroke-dasharray="4 4" /><text x={TX[i] + 20} y={FY - 42} text-anchor="middle" font-size="22" fill="#7d7765">?</text></g>)}
            </g>
          ))}
        </g>
        {to.gate ? <BambooGate x={1190} y={FY + 6} s={0.62} open={!!to.content.done} /> : to.kind === 'boss' && region === 3 ? <BigGate x={1190} y={FY + 6} s={0.62} open={!!to.content.done} /> : to.kind === 'boss' ? <BossDen x={1190} y={FY + 6} done={!!to.content.done} /> : <RoomPosts x={1190} y={FY + 6} />}
        <LightVignette light={run.light} W={W} H={H} lampX={TX[cur] - 60} lampY={FY - 120} ahead uid="corridor" />
        <Party run={run} frontX={TX[cur] + 40} gap={84} y={FY + 6} scale={0.86} />
        <Lantern x={TX[cur] - 40} y={52} light={run.light} />
      </>
    );
    tiles.forEach((t, i) => {
      caps.push(<div key={`c${i}`} class={`scene-cap c ${i === cur ? 'lamp' : 'dim'}`} style={{ left: pctX(TX[i]), top: pctY(FY + 34, H) }}>길목 {i + 1}/3{i === cur ? ' · 지금' : t.known && !t.content.done && t.content.k !== 'empty' ? ` · ${contentName(t.content)}` : t.walked ? ' · 지나옴' : ''}</div>);
    });
    caps.push(<div key="to" class="scene-cap c dim" style={{ left: pctX(1190), top: pctY(16, H) }}>다음 방 · {to.visited ? '지나온 방' : to.known ? (to.kind === 'boss' ? '보스 굴' : to.gate ? '대문' : to.kind === 'guard' ? '수호 방' : contentName(to.content) || '빈 방') : '미답'}</div>);
  } else {
    const rm = dg.rooms[run.pos.room];
    if (rm.gate) variant = 'gate';
    else if (rm.kind === 'boss') variant = 'boss';
    else variant = 'room';
    const exits = dg.corridors.filter((c) => c.a === rm.id || c.b === rm.id).length;
    svg = (
      <>
        <Backdrop region={region} W={W} H={H} FY={FY} variant={variant} />
        {rm.kind === 'entrance' && <Hongsalmun x={150} y={FY + 4} s={0.85} />}
        {rm.kind === 'ferry' && (region === 3 && run.campaign?.length === 'final' ? <EopgyeongSeats x={820} y={FY + 6} s={0.62} /> : <Boat x={820} y={FY + 6} s={1.1} />)}
        {rm.camp && <Campfire x={700} y={FY + 6} s={0.8} lit={rm.campUsed} />}
        {!rm.camp && rm.kind !== 'ferry' && <ContentProp c={rm.content} x={760} y={FY + 4} s={1.1} region={region} />}
        {Array.from({ length: Math.min(3, exits) }, (_, k) => <RoomPosts key={k} x={1050 + k * 80} y={FY + 6} s={0.7 - k * 0.08} />)}
        <LightVignette light={run.light} W={W} H={H} lampX={420} lampY={FY - 120} ahead uid="corridor" />
        <Party run={run} frontX={500} gap={92} y={FY + 6} scale={0.9} walk={false} />
        <Lantern x={420} y={52} light={run.light} />
      </>
    );
    const what = rm.kind === 'entrance' ? '입구' : rm.kind === 'ferry' ? '나루' : rm.kind === 'boss' ? '보스 굴' : rm.gate ? `대문${rm.content.done ? ' · 열림' : ''}` : rm.kind === 'guard' ? '수호 방' : '방';
    caps.push(<div key="rm" class="scene-cap" style={{ left: pctX(24), top: pctY(14, H) }}><b>{what}</b>{rm.camp ? ' · 길굿 터' : ''}{!rm.content.done && rm.content.k !== 'empty' && rm.content.k !== 'entrance' ? ` · ${contentName(rm.content)}` : ''}</div>);
    caps.push(<div key="ex" class="scene-cap c dim" style={{ left: pctX(1130), top: pctY(16, H) }}>갈림길 {exits}</div>);
  }
  caps.push(<div key="lamp" class="scene-cap lamp" style={{ left: pctX(run.pos.kind === 'tile' ? 24 : 470), top: pctY(run.pos.kind === 'tile' ? 14 : 20, H) }}>{run.pos.kind === 'tile' ? <b>넋등 {run.light}</b> : `넋등 ${run.light}`} · {band.name}</div>);
  return <Stage W={W} H={H} cls="scene-stage corridor" label="길목 장면" svg={svg} overlay={caps} testid="corridor-scene" />;
}

function RoomPosts({ x, y, s = 0.8 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} class="room-posts">
      <rect x="-64" y="-180" width="9" height="180" fill="#4a2a1a" />
      <rect x="55" y="-180" width="9" height="180" fill="#4a2a1a" />
      <path d="M-64 -160 Q0 -140 64 -160" stroke="#a08a5a" stroke-width="3" fill="none" />
      {Array.from({ length: 5 }, (_, i) => <path key={i} d={`M${-46 + i * 22} -154 l4 8 l-4 6 l4 8`} stroke="#ebe3cb" stroke-width="2.4" fill="none" opacity=".7" />)}
    </g>
  );
}

function BossDen({ x, y, done }: { x: number; y: number; done: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} class="boss-den">
      <path d="M-90 0 Q-90 -170 0 -180 Q90 -170 90 0 Z" fill="#0a0608" stroke="#3a1a1a" stroke-width="4" />
      <rect x="-26" y="-130" width="52" height="52" fill="none" stroke={done ? '#9a8f78' : '#c33427'} stroke-width="4" transform="rotate(-6 0 -104)" />
      <text x="0" y="-90" text-anchor="middle" font-size="36" class="svg-brush" fill={done ? '#9a8f78' : '#e2573f'}>{done ? '解' : '恨'}</text>
    </g>
  );
}

/** 길굿: 모닥불 둘레에 파티가 둘러앉는다 */
export function CampScene({ run, raid }: { run: Run; raid: number }) {
  const H = 240;
  const FY = 196;
  const alive = run.formation.filter((i) => !run.heroes[i].dead);
  const dead = run.heroes.filter((h) => h.dead);
  const seats: [number, boolean][] = [[470, false], [360, false], [810, true], [920, true]];
  const svg = (
    <>
      <Backdrop region={run.region ?? 1} W={W} H={H} FY={FY} variant="room" />
      <rect width={W} height={H} fill="#03040a" opacity={0.35 + raid * 1.2} />
      <Campfire x={640} y={FY + 6} s={1} />
      {/* 돗자리 */}
      <path d={`M300 ${FY + 2} L980 ${FY + 2} L1010 ${FY + 26} L270 ${FY + 26} Z`} fill="#6b5236" opacity=".55" />
      {alive.map((hi, k) => {
        const [x, flip] = seats[k] ?? seats[0];
        const h = run.heroes[hi];
        return (
          <g key={h.id} transform={`translate(${x} ${FY + 26}) scale(${flip ? -0.9 : 0.9} 0.9)`} class="sitting">
            <HeroParts id={h.id} />
            {/* 앉은 무릎: 도포 자락을 앞으로 접는다 */}
            <path d="M-20 -30 Q16 -44 40 -26 L40 -8 L-26 -8 Z" fill={HERO_COLOR[h.id]} stroke="#1a1712" stroke-width="2" />
            <rect x="-40" y="-10" width="90" height="14" fill="#6b5236" />
          </g>
        );
      })}
      {dead.map((h, k) => <Tablet key={h.id} x={640 + (k ? 60 : -60)} y={FY - 40} s={0.45} name={heroName(h.id)} color={HERO_COLOR[h.id]} />)}
    </>
  );
  const caps = [
    <div key="raid" class="scene-cap c dim" style={{ left: pctX(640), top: pctY(16, H) }}>밤 습격 {Math.round(raid * 100)}%{raid > 0 ? ' — 불빛 밖이 어둡다' : ' — 뒷전 차림·망보기로 지킨다'}</div>,
  ];
  return <Stage W={W} H={H} cls="scene-stage camp-scene" label="길굿 — 모닥불 둘레의 파티" svg={svg} overlay={caps} testid="camp-scene" />;
}

/** 결과: 꼭두 행렬. 서 있는 영웅이 넋등을 들고 걷고, 해원한 넋이 위로 떠오르고, 떠난 영웅은 위패로 함께 간다 */
export function Procession({ heroes, region, success, haewons, kills, flowers = false }: { heroes: { id: HeroId; dead: boolean; name?: string }[]; region: number; success: boolean; haewons: number; kills: number; flowers?: boolean }) {
  const H = 250;
  const FY = 212;
  const alive = heroes.filter((h) => !h.dead);
  const dead = heroes.filter((h) => h.dead);
  const svg = (
    <>
      <Backdrop region={region} W={W} H={H} FY={FY} variant="path" />
      {/* 좋은 결말 ⟨반복 5⟩: 열린 열두째 대문 너머 꽃이 핀 산 (환생꽃·숨살이꽃) */}
      {flowers && <FlowerHill W={W} FY={FY} x0={880} />}
      {flowers && <BigGate x={980} y={FY + 4} s={0.6} open />}
      {success && <rect width={W} height={H} fill="url(#proc-dawn)" />}
      <defs>
        <linearGradient id="proc-dawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4c27a" stop-opacity=".22" /><stop offset=".7" stop-color="#f4c27a" stop-opacity="0" /></linearGradient>
      </defs>
      {!success && <rect width={W} height={H} fill="#03040a" opacity=".45" />}
      <g class="procession">
        {alive.map((h, k) => (
          <g key={`${h.id}${k}`} transform={`translate(${760 - k * 110} ${FY}) scale(0.85)`}>
            <Shadow />
            <g class="walk" style={{ animationDelay: `${k * 0.2}s` }}><HeroParts id={h.id} /></g>
          </g>
        ))}
        {dead.map((h, k) => <Tablet key={`${h.id}${k}`} x={760 - (alive.length + k) * 110} y={FY} s={0.62} name={h.name ?? heroName(h.id)} color={HERO_COLOR[h.id]} />)}
        {alive.length > 0 && <Lantern x={840} y={FY - 150} light={success ? 80 : 30} />}
      </g>
      {Array.from({ length: Math.min(12, haewons) }, (_, i) => <SoulWisp key={`w${i}`} x={900 + (i % 6) * 58} y={FY - 70 - Math.floor(i / 6) * 70 - (i % 2) * 18} s={0.24} />)}
      {Array.from({ length: Math.min(16, kills) }, (_, i) => <circle key={`k${i}`} cx={120 + (i % 8) * 16} cy={FY + 14 + Math.floor(i / 8) * 8} r="2.4" fill="#3a3732" opacity=".7" />)}
    </>
  );
  const caps: JSX.Element[] = [
    <div key="h" class="scene-cap" style={{ left: pctX(900), top: pctY(14, H) }}>↑ 해원 {haewons} — 넋이 풀려 떠난다</div>,
  ];
  if (kills > 0) caps.push(<div key="k" class="scene-cap dim" style={{ left: pctX(110), top: pctY(FY - 24, H) }}>↓ 처치 {kills}</div>);
  return <Stage W={W} H={H} cls="scene-stage procession-scene" label="꼭두 행렬" svg={svg} overlay={caps} testid="procession" />;
}

/** 보상 화면 위: 방금 끝난 전투의 원귀가 어떻게 떠났나 (해원 = 떠오름 · 처치 = 주저앉음 · 달아남) */
export function Aftermath({ b }: { b: LastBattle }) {
  const d = D();
  const H = 210;
  const FY = 176;
  const es = b.s.enemies;
  const n = es.length;
  const sp = Math.min(170, 760 / Math.max(1, n));
  const x0 = 640 - ((n - 1) * sp) / 2 + 120;
  const heroes = b.s.heroes.filter((h) => !h.dead);
  const svg = (
    <>
      <Backdrop region={b.region} W={W} H={H} FY={FY} variant={b.variant} />
      {heroes.map((h, k) => (
        <g key={h.idx} transform={`translate(${250 - k * 80} ${FY}) scale(0.7)`}>
          <Shadow />
          <g class={h.downed ? 'body hero-body downed' : ''}><HeroParts id={h.id} /></g>
        </g>
      ))}
      {es.map((e, i) => {
        const def = d.enemies[e.def];
        const tier = (['normal', 'minion', 'elite', 'boss'].includes(def.category) ? def.category : 'normal') as Tier;
        const state: SpiritState = e.alive ? 'idle' : e.escaped ? 'escape' : e.haewon ? 'haewon' : 'cheochi';
        return (
          <g key={e.uid} transform={`translate(${x0 + i * sp} ${FY}) scale(${tier === 'boss' ? 0.55 : 0.7})`}>
            <g class={`body spirit-body ${state === 'idle' ? '' : `fate-${state}`}`}>
              <SpiritParts family={def.family} tier={tier} boss={tier === 'boss' ? def.id : undefined} state={state} />
            </g>
          </g>
        );
      })}
    </>
  );
  const caps = es.map((e, i) => (
    <div key={e.uid} class={`scene-cap c fate-cap ${e.haewon ? 'lamp' : 'dim'}`} style={{ left: pctX(x0 + i * sp), top: pctY(FY + 6, H) }}>
      {e.escaped ? '달아남' : e.haewon ? '↑ 해원' : e.alive ? '' : '↓ 처치'} <span class="tiny">{d.enemies[e.def].name}</span>
    </div>
  ));
  return <div class="aftermath"><Stage W={W} H={H} cls="scene-stage" label="전투가 끝난 자리" svg={svg} overlay={caps} testid="aftermath" /></div>;
}

/** 기물·이벤트·덫 창 위의 작은 그림. 3지역 대문 통행은 닫힌 대문 */
export function DialogArt({ dlg, run }: { dlg: DialogState; run: Run }) {
  const H = 200;
  const FY = 176;
  const region = run.region ?? 1;
  const gate = dlg.id === 'daemun_tonghaeng';
  const mirror = dlg.id === 'eopgyeong_bichugi';
  const svg = (
    <>
      <Backdrop region={region} W={W} H={H} FY={FY} variant="path" />
      {gate ? <BambooGate x={760} y={FY + 4} s={0.62} /> : mirror ? <EopgyeongSeats x={860} y={FY + 4} s={0.5} /> : dlg.kind === 'curio' ? <Cairn x={760} y={FY} s={1} /> : dlg.kind === 'trap' ? <TrapMark x={760} y={FY + 4} s={1.6} /> : <SignPost x={760} y={FY} s={1.2} />}
      <LightVignette light={run.light} W={W} H={H} lampX={420} lampY={FY - 90} uid="dialog" />
      <Party run={run} frontX={520} gap={90} y={FY} scale={0.66} walk={false} />
    </>
  );
  return <div class="dialog-art"><Stage W={W} H={H} cls="scene-stage" label={gate ? '닫힌 댓가지 문' : mirror ? '업경대와 빈 자리 열넷' : '길 위의 기물'} svg={svg} /></div>;
}
