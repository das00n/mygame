// 꼭두풍 채색 목인 영웅 8 원형 (tools/presentation/figures.mjs 의 원시 도형을 Preact 로 옮겼다).
// 좌표: 발 중앙이 (0,0), 위가 −y, 얼굴은 +x(오른쪽)를 본다. 키는 약 140.
// 부품 이름(그림자 · 몸 · 머리 · 팔 · 소품)은 본 제작(그린 부품 + 뼈대)과 맞춘다.

import type { JSX } from 'preact';
import type { HeroId } from '../../../../src/core/types.ts';
import { HERO_COLOR } from '../../game/content.ts';
import { HANJI, INK, SKIN, shade } from './palette.ts';

export type Pose = 'idle' | 'attack' | 'cast';
export type Mask = 'malttugi' | 'yangban' | 'halmi';

export interface HeroLook {
  pose?: Pose;
  /** 탈꾼: 칸마다 탈 (선두 말뚝이 · 중열 양반 · 후열 할미) */
  mask?: Mask;
  /** 만신 강신: 무복 색 반전 */
  gangsin?: boolean;
  /** 작두박수: 작두 위 */
  stance?: boolean;
  /** 잽이 가락 0~2: 채 높이 */
  garak?: number;
  /** 개체 변형 (얼굴빛·눈썹) */
  v?: number;
}

function Body({ c, wide = false, robeLen = 0 }: { c: string; wide?: boolean; robeLen?: number }) {
  const hem = wide ? 34 : 29;
  const d = `M-15 -92 L15 -92 L${hem} ${-8 + robeLen} Q0 ${-2 + robeLen} ${-hem} ${-8 + robeLen} Z`;
  return (
    <g class="part-body">
      <rect x="-13" y="-11" width="10" height="11" rx="3" fill="#2a2018" />
      <rect x="3" y="-11" width="11" height="11" rx="3" fill="#2a2018" />
      <path d={d} fill={c} stroke={INK} stroke-width="2.2" stroke-linejoin="round" />
      <path d={d} fill="url(#jsg-hanji)" />
      <path d="M-8 -92 L1 -76 L9 -92" fill="none" stroke={HANJI} stroke-width="3" />
      <rect x="-20" y="-60" width="41" height="6" fill={shade(c, 0.72)} stroke={INK} stroke-width="1" />
    </g>
  );
}

function Head({ x = 2, y = -108, r = 15, v = 0 }: { x?: number; y?: number; r?: number; v?: number }) {
  const brow = v % 2 === 0;
  return (
    <g class="part-head">
      <circle cx={x} cy={y} r={r} fill={SKIN[v % SKIN.length]} stroke={INK} stroke-width="2" />
      <circle cx={x + 7} cy={y - 2} r="1.9" fill={INK} />
      {brow && <path d={`M${x + 4} ${y - 7} q3 -2 6 0`} stroke={INK} stroke-width="1.2" fill="none" />}
      <circle cx={x + 5} cy={y + 5} r={2.2 + (v % 3) * 0.4} fill="#d0533f" opacity=".75" />
      <path d={`M${x + 9} ${y + 8} q2 1 4 0`} stroke={INK} stroke-width="1.2" fill="none" />
    </g>
  );
}

function Arm({ x1, y1, x2, y2, c }: { x1: number; y1: number; x2: number; y2: number; c: string }) {
  const d = `M${x1} ${y1} L${x2} ${y2}`;
  return (
    <g class="part-arm">
      <path d={d} stroke={INK} stroke-width="12" stroke-linecap="round" />
      <path d={d} stroke={c} stroke-width="8.5" stroke-linecap="round" />
      <circle cx={x2} cy={y2} r="4.6" fill={SKIN[0]} stroke={INK} stroke-width="1.4" />
    </g>
  );
}

type Parts = (c: string, pose: Pose, look: HeroLook) => JSX.Element;

const PARTS: Record<HeroId, Parts> = {
  manshin(c, pose, look) {
    const up = pose === 'attack' || pose === 'cast';
    const hx = up ? 30 : 24;
    const hy = up ? -100 : -70;
    const robe = look.gangsin ? '#efe6cf' : c;
    return (
      <>
        <Body c={robe} wide robeLen={2} />
        {look.gangsin && <path d="M-15 -92 L15 -92 L34 -6 Q0 0 -34 -6 Z" fill="none" stroke={c} stroke-width="3" />}
        <Arm x1={-13} y1={-86} x2={-24} y2={-56} c={shade(robe, 0.85)} />
        <g fill="#e2b23a" stroke={INK} stroke-width=".8">
          <circle cx="-27" cy="-49" r="3.4" /><circle cx="-21" cy="-46" r="3.4" /><circle cx="-26" cy="-42" r="3.4" /><circle cx="-31" cy="-44" r="3" />
        </g>
        <Head v={look.v} />
        <path d="M-13 -116 Q2 -134 17 -116 Q6 -122 -13 -116 Z" fill="#20181a" stroke={INK} stroke-width="1.5" />
        <ellipse cx="-12" cy="-112" rx="7" ry="6" fill="#20181a" />
        <path d="M-14 -119 L18 -119" stroke="#c33427" stroke-width="3" />
        <Arm x1={12} y1={-86} x2={hx} y2={hy} c={shade(robe, 0.9)} />
        <g class="part-prop" transform={`translate(${hx} ${hy}) rotate(${up ? -20 : 10})`}>
          <path d="M0 0 L-22 -26 A34 34 0 0 1 22 -26 Z" fill={HANJI} stroke={INK} stroke-width="1.6" />
          <path d="M-22 -26 A34 34 0 0 1 22 -26 L15 -18 A24 24 0 0 0 -15 -18 Z" fill="#2f86a6" />
          <path d="M-15 -18 A24 24 0 0 1 15 -18 L9 -11 A14 14 0 0 0 -9 -11 Z" fill="#e2b23a" />
          <path d="M0 0 L0 -32 M0 0 L-12 -29 M0 0 L12 -29" stroke={INK} stroke-width=".8" />
        </g>
      </>
    );
  },
  jaebi(c, pose, look) {
    const hit = pose === 'attack' || pose === 'cast';
    const lift = (look.garak ?? 0) * 8;
    const ax = hit ? 34 : 28;
    const ay = (hit ? -86 : -70) - lift;
    return (
      <>
        <Body c={c} />
        <Arm x1={-12} y1={-86} x2={-4} y2={-60} c={shade(c, 0.85)} />
        <g class="part-prop" transform="translate(6 -58)">
          <path d="M-26 -14 L-6 -4 L-6 4 L-26 14 Z M26 -14 L6 -4 L6 4 L26 14 Z" fill="#8a4b2a" stroke={INK} stroke-width="1.5" />
          <ellipse cx="-26" cy="0" rx="5" ry="14" fill="#c33427" stroke={INK} stroke-width="1.5" />
          <ellipse cx="26" cy="0" rx="5" ry="14" fill="#2f86a6" stroke={INK} stroke-width="1.5" />
          <path d="M-24 -12 L-14 10 L-6 -6 L6 6 L14 -10 L24 12" stroke={HANJI} stroke-width="1" fill="none" />
        </g>
        <Head v={look.v} />
        <path d="M-20 -116 L24 -116 L2 -134 Z" fill="#b89a5a" stroke={INK} stroke-width="1.6" />
        <Arm x1={12} y1={-86} x2={ax} y2={ay} c={shade(c, 0.9)} />
        <path d={`M${ax} ${ay} L${ax + (hit ? 18 : 12)} ${ay + (hit ? 22 : 14)}`} stroke={INK} stroke-width="2.4" />
      </>
    );
  },
  posu(c, pose, look) {
    const aim = pose === 'attack';
    return (
      <>
        <Body c={c} />
        <ellipse cx="-18" cy="-52" rx="6" ry="8" fill="#8a6a3a" stroke={INK} stroke-width="1.3" />
        <Arm x1={-12} y1={-86} x2={aim ? 4 : -10} y2={aim ? -84 : -54} c={shade(c, 0.85)} />
        {aim ? (
          <g class="part-prop">
            <path d="M-6 -86 L78 -92" stroke="#5a3a22" stroke-width="7" stroke-linecap="round" />
            <path d="M30 -90 L80 -93" stroke="#2a2a2a" stroke-width="3.5" />
            <circle class="muzzle" cx="86" cy="-93" r="7" fill="#ffd27a" opacity=".9" />
          </g>
        ) : (
          <g class="part-prop">
            <path d="M-14 -40 L30 -122" stroke="#5a3a22" stroke-width="6.5" stroke-linecap="round" />
            <path d="M14 -92 L32 -126" stroke="#2a2a2a" stroke-width="3.5" />
          </g>
        )}
        <Head v={look.v} />
        <ellipse cx="1" cy="-120" rx="18" ry="10" fill="#6b4a2e" stroke={INK} stroke-width="1.6" />
        <path d="M-16 -118 q4 -4 8 0 q4 -4 8 0 q4 -4 8 0 q4 -4 8 0" stroke="#3d2a18" stroke-width="1.2" fill="none" />
        <Arm x1={12} y1={-86} x2={aim ? 30 : 14} y2={aim ? -88 : -78} c={shade(c, 0.9)} />
      </>
    );
  },
  baksu(c, pose, look) {
    const up = pose === 'attack';
    const kx = up ? 34 : 28;
    const ky = up ? -112 : -72;
    return (
      <>
        <Body c={c} />
        <path d="M-15 -92 L15 -92 L18 -40 L-18 -40 Z" fill="#c33427" stroke={INK} stroke-width="1.6" opacity=".92" />
        <Arm x1={-12} y1={-86} x2={-22} y2={-58} c={shade(c, 0.85)} />
        <Head v={look.v} />
        <ellipse cx="2" cy="-119" rx="24" ry="5" fill="#1d1a22" stroke={INK} stroke-width="1.2" />
        <path d="M-9 -120 Q2 -138 13 -120 Z" fill="#1d1a22" />
        <path d="M2 -135 q-8 -6 -2 -14 q6 4 2 14" fill="#c33427" />
        <Arm x1={12} y1={-86} x2={kx} y2={ky} c={shade(c, 0.9)} />
        <g class="part-prop" transform={`translate(${kx} ${ky}) rotate(${up ? -35 : -10})`}>
          <path d="M0 0 L0 -40" stroke="#cfd6dc" stroke-width="4" />
          <path d="M0 0 L0 -40" stroke={INK} stroke-width=".8" />
          <path d="M-2 2 l-5 14 M0 3 l0 15 M2 2 l5 14 M-1 3 l-3 13 M1 3 l3 13" stroke={HANJI} stroke-width="1.6" />
        </g>
      </>
    );
  },
  seungnyeo(c, pose, look) {
    const swing = pose === 'attack';
    const sx = swing ? 30 : 22;
    const sy = swing ? -96 : -74;
    return (
      <>
        <Body c={c} />
        <path d="M-15 -92 L15 -92 L-20 -16 L-28 -22 Z" fill="#8a3a2a" stroke={INK} stroke-width="1.3" opacity=".9" />
        <Arm x1={-12} y1={-86} x2={-14} y2={-62} c={shade(c, 0.85)} />
        <g fill="#3a2a1e">{[0, 1, 2, 3, 4, 5].map((i) => <circle key={i} cx={-16 + Math.sin(i) * 3} cy={-56 + i * 4} r="1.8" />)}</g>
        <Head v={look.v} />
        <path d="M-11 -116 Q2 -126 15 -116" stroke="#c9b190" stroke-width="2" fill="none" />
        <Arm x1={12} y1={-86} x2={sx} y2={sy} c={shade(c, 0.9)} />
        <g class="part-prop" transform={`translate(${sx} ${sy}) rotate(${swing ? 30 : 4})`}>
          <path d="M0 64 L0 -62" stroke="#6b4a2e" stroke-width="4" />
          <circle cx="0" cy="-68" r="7" fill="none" stroke="#c9a85a" stroke-width="2.4" />
          <circle cx="-7" cy="-62" r="3" fill="none" stroke="#c9a85a" stroke-width="1.6" />
          <circle cx="7" cy="-62" r="3" fill="none" stroke="#c9a85a" stroke-width="1.6" />
        </g>
      </>
    );
  },
  beopsa(c, pose, look) {
    const read = pose === 'cast' || pose === 'attack';
    return (
      <>
        <Body c={c} robeLen={2} />
        <Arm x1={-12} y1={-86} x2={6} y2={-70} c={shade(c, 0.85)} />
        <Head v={look.v} />
        <path d="M-13 -116 L-11 -132 L15 -132 L17 -116 Z" fill="#26304a" stroke={INK} stroke-width="1.5" />
        <path d="M2 -132 L2 -116" stroke="#40507a" stroke-width="1.5" />
        <Arm x1={12} y1={-86} x2={22} y2={-72} c={shade(c, 0.9)} />
        <g class="part-prop" transform="translate(14 -72)">
          <rect x="-16" y="-8" width="32" height="16" fill={HANJI} stroke={INK} stroke-width="1.2" />
          <path d="M-11 -4 h22 M-11 0 h18 M-11 4 h20" stroke="#333" stroke-width=".9" />
        </g>
        {read && (
          <g class="part-prop talisman" transform="translate(46 -104) rotate(12)">
            <rect x="-7" y="-14" width="14" height="28" fill="#e8cf7c" stroke="#8a6a2a" stroke-width="1" />
            <path d="M-3 -9 q6 5 0 9 q-6 4 0 9" stroke="#c33427" stroke-width="1.8" fill="none" />
          </g>
        )}
      </>
    );
  },
  talggun(c, pose, look) {
    const mask = look.mask ?? 'malttugi';
    const maskC = { malttugi: '#c8442e', yangban: '#efe6cf', halmi: '#3a2f2a' }[mask];
    const lunge = pose === 'attack';
    const ly = lunge ? -96 : -64;
    return (
      <>
        <Body c={c} />
        <Arm x1={-12} y1={-86} x2={-30} y2={ly} c={shade(c, 0.85)} />
        <path d={`M-30 ${ly} q-14 10 -8 30 q6 10 -4 22`} stroke={HANJI} stroke-width="7" fill="none" stroke-linecap="round" opacity=".95" />
        <g class="part-head mask" data-mask={mask}>
          <ellipse cx="3" cy="-108" rx="17" ry="20" fill={maskC} stroke={INK} stroke-width="2" />
          <ellipse cx="10" cy="-113" rx="4" ry="3" fill="#fff" stroke={INK} stroke-width="1.2" />
          <circle cx="11" cy="-113" r="1.6" fill={INK} />
          <path d="M12 -104 q5 3 2 7" stroke={INK} stroke-width="2" fill="none" />
          <path d="M2 -95 q9 3 14 -2" stroke={INK} stroke-width="2" fill={mask === 'halmi' ? '#a33' : '#fff'} />
          {mask === 'malttugi' && <circle cx="-4" cy="-104" r="3" fill="#2f86a6" opacity=".9" />}
          {mask === 'yangban' && <path d="M-6 -118 q8 -4 16 0" stroke={INK} stroke-width="1.4" fill="none" />}
        </g>
        <path d="M-14 -124 L20 -124 L4 -138 Z" fill="#3a2f2a" stroke={INK} stroke-width="1.4" />
        <Arm x1={12} y1={-86} x2={lunge ? 38 : 26} y2={lunge ? -80 : -66} c={shade(c, 0.9)} />
        <path d={`M${lunge ? 38 : 26} ${lunge ? -80 : -66} q16 -6 22 -24`} stroke="#6b4a2e" stroke-width="3" fill="none" />
      </>
    );
  },
  chasa(c, pose, look) {
    const throwR = pose === 'attack';
    // 차사: 적갈색 벙거지 + 붉은 술 (검은 갓은 쓰지 않는다 — 표현 조사 §5)
    return (
      <>
        <Body c={c} />
        <path d="M-14 -90 L14 -90 L20 -30 L4 -30 L0 -70 L-4 -30 L-20 -30 Z" fill="#3a3550" stroke={INK} stroke-width="1.4" opacity=".9" />
        <rect x="-24" y="-56" width="9" height="18" fill="#c33427" stroke={INK} stroke-width="1" />
        <Arm x1={-12} y1={-86} x2={-16} y2={-58} c={shade(c, 0.85)} />
        <Head v={look.v} />
        <ellipse cx="2" cy="-118" rx="20" ry="5" fill="#7a3a2a" stroke={INK} stroke-width="1.3" />
        <path d="M-11 -119 Q2 -136 15 -119 Z" fill="#7a3a2a" stroke={INK} stroke-width="1.3" />
        <path d="M2 -134 l-3 -8 l6 0 Z" fill="#c33427" />
        <Arm x1={12} y1={-86} x2={throwR ? 34 : 22} y2={throwR ? -94 : -64} c={shade(c, 0.9)} />
        {throwR ? (
          <path class="part-prop" d="M34 -94 q30 -20 54 4 q10 14 -6 18" stroke="#c33427" stroke-width="3" fill="none" />
        ) : (
          <g class="part-prop" transform="translate(24 -60)"><circle r="9" fill="none" stroke="#c33427" stroke-width="3" /><circle r="5" fill="none" stroke="#c33427" stroke-width="2" /></g>
        )}
      </>
    );
  },
};

/** 영웅 한 명의 부품 (그림자 제외). 무대는 바깥 <g> 로 자리·크기를, 안쪽 <g> 로 연출(CSS 변형)을 준다 */
export function HeroParts({ id, look = {} }: { id: HeroId; look?: HeroLook }) {
  const c = HERO_COLOR[id];
  const lift = id === 'baksu' && look.stance ? -12 : 0;
  const inner = PARTS[id](c, look.pose ?? 'idle', look);
  if (!lift) return inner;
  return (
    <>
      <g class="jakdu" aria-hidden="true">
        <rect x="-30" y="-4" width="60" height="5" fill="#5a3a22" stroke={INK} stroke-width="1" />
        <path d="M-22 -4 L-22 -14 M22 -4 L22 -14" stroke="#cfd6dc" stroke-width="3" />
        <path d="M-24 -14 L20 -14 M-20 -12 L24 -12" stroke="#e6edf2" stroke-width="2" />
      </g>
      <g transform={`translate(0 ${lift})`}>{inner}</g>
    </>
  );
}

export function Shadow({ w = 34 }: { w?: number }) {
  return <ellipse class="shadow" cx="0" cy="2" rx={w} ry="6" fill="rgba(0,0,0,.35)" />;
}

/** 단독으로 쓰는 영웅 그림 (마을·로스터·사당·길굿). 무대 전투는 CombatStage 가 직접 짠다 */
export function HeroFigure({ id, x = 0, y = 0, scale = 1, flip = false, look, dim, title }: {
  id: HeroId; x?: number; y?: number; scale?: number; flip?: boolean; look?: HeroLook; dim?: boolean; title?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`} opacity={dim ? 0.5 : 1}>
      {title && <title>{title}</title>}
      <Shadow />
      <HeroParts id={id} look={look} />
    </g>
  );
}

/** 상반신(로스터·파티 고르기·사당). viewBox 로 머리와 어깨만 잘라 보인다 */
export function HeroBust({ id, v = 0, size = 56, dim, title }: { id: HeroId; v?: number; size?: number; dim?: boolean; title?: string }) {
  return (
    <svg class={`bust ${dim ? 'dim' : ''}`} viewBox="-44 -150 88 96" width={size} height={(size * 96) / 88} role="img" aria-label={title}>
      <rect x="-44" y="-150" width="88" height="96" fill="url(#jsg-lamp)" opacity=".5" />
      <HeroParts id={id} look={{ v, mask: 'malttugi' }} />
    </svg>
  );
}
