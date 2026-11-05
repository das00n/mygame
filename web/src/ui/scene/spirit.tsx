// 넋전풍 원귀: 한지 사람 오림(팔 날개 · 톱니 단 · 세로 칼집선 · 빈 눈) + 뒤쪽 한(恨)의 빛깔 흐림.
// 계열마다 덧붙임 하나, 보스마다 개별 소품 하나. 좌표: 발 중앙 (0,0), 얼굴은 왼쪽(영웅 쪽)을 본다.
// 해원 = 하얗게 펴져 떠오른다 / 처치 = 잿빛으로 구겨져 주저앉는다 — 무대(CSS)가 움직임을, 여기서는 색과 모양을 준다.
// 손님(2막 신령)은 원귀 실루엣을 쓰지 않는다: 가마와 차일만, 공격 대상 표시 없이(Palanquin).

import type { JSX } from 'preact';
import { HAN, HANJI, INK } from './palette.ts';

export type SpiritState = 'idle' | 'haewon' | 'cheochi' | 'escape';
export type Tier = 'normal' | 'minion' | 'elite' | 'boss';
export const TIER_SCALE: Record<Tier, number> = { normal: 1, minion: 0.8, elite: 1.25, boss: 1.6 };

function SpiritShape({ fill = HANJI, stroke = '#8f8774', opacity = 0.94, thin = 1, burnt = false }: { fill?: string; stroke?: string; opacity?: number; thin?: number; burnt?: boolean }) {
  const hem: string[] = [];
  for (let i = -18 * thin; i <= 18 * thin + 0.1; i += 6 * thin) hem.push(`${i.toFixed(1)} ${hem.length % 2 ? -2 : -11}`);
  const w = 18 * thin;
  const d = `M${-w} -94 L${-34 * thin} -58 L${-26 * thin} -54 L${-w} -70 L${-w} -11 L${hem.join(' L')} L${w} -11 L${w} -70 L${26 * thin} -54 L${34 * thin} -58 L${w} -94 Z`;
  return (
    <g opacity={opacity} class="part-paper">
      <path d={d} fill={fill} stroke={stroke} stroke-width="1.4" stroke-linejoin="round" />
      <path d={d} fill="url(#jsg-hanji)" />
      {burnt && <path d={d} fill="none" stroke="#5a2a1a" stroke-width="5" opacity=".45" />}
      <circle cx="0" cy="-108" r="14" fill={fill} stroke={stroke} stroke-width="1.4" />
      <path d="M-6 -90 L-6 -40 M0 -88 L0 -30 M6 -90 L6 -40" stroke={stroke} stroke-width=".9" opacity=".7" />
      <ellipse cx="-5" cy="-109" rx="2.4" ry="3.6" fill="#2e2e3a" />
      <ellipse cx="5" cy="-109" rx="2.4" ry="3.6" fill="#2e2e3a" />
    </g>
  );
}

const FAMILY_EXTRA: Record<string, () => JSX.Element> = {
  수귀: () => (
    <>
      <path d="M-10 -122 q-6 18 -4 34 M-4 -123 q-2 20 0 30 M4 -123 q2 20 0 30 M10 -122 q6 18 4 34" stroke="#1d2a36" stroke-width="2.4" fill="none" />
      <path d="M-14 -60 l0 14 M-4 -52 l0 18 M10 -64 l0 12 M16 -40 l0 14" stroke="#5f8fb0" stroke-width="2" opacity=".85" />
      <ellipse cx="0" cy="0" rx="40" ry="6" fill="none" stroke="#5f8fb0" stroke-width="1.6" opacity=".7" />
      <ellipse cx="0" cy="1" rx="26" ry="3.5" fill="none" stroke="#5f8fb0" stroke-width="1.2" opacity=".6" />
    </>
  ),
  객귀: () => (
    <>
      <g transform="translate(-26 -84)">
        <rect x="-14" y="-12" width="26" height="24" rx="7" fill="#8a7454" stroke="#3d3020" stroke-width="1.4" />
        <path d="M-2 -12 l6 -8 l4 8" fill="none" stroke="#3d3020" stroke-width="1.6" />
      </g>
      <path d="M30 -70 L38 4" stroke="#6b5636" stroke-width="3.2" stroke-linecap="round" />
    </>
  ),
  '굶주린 넋': () => (
    <>
      <path d="M-14 -62 Q0 -46 14 -62 Z" fill="#cfc7ad" stroke="#5a5444" stroke-width="1.6" />
      <path d="M-16 -62 H16" stroke="#5a5444" stroke-width="1.6" />
    </>
  ),
  잡귀잡신: () => <path d="M-22 -40 l-8 6 l6 2 M20 -76 l9 -4 l-3 7 M-12 -100 l-6 -8" stroke="#8e7aa6" stroke-width="2" fill="none" />,
  억울귀: () => (
    <g transform="translate(26 -68) rotate(-12)">
      <rect x="-10" y="-14" width="20" height="26" fill="#d9cfb0" stroke="#4a3a2a" stroke-width="1.2" />
      <path d="M-6 -8 h12 M-6 -3 h12 M-6 2 h9" stroke="#4a3a2a" stroke-width=".9" />
    </g>
  ),
  역귀: () => (
    <>
      <path d="M-16 -134 q4 -8 0 -16 M0 -138 q4 -8 0 -16 M16 -134 q4 -8 0 -16" stroke="#e08a3a" stroke-width="2.2" fill="none" opacity=".85" />
      <g fill="#e07a4a" opacity=".55"><circle cx="-8" cy="-70" r="3" /><circle cx="6" cy="-56" r="2.5" /><circle cx="-4" cy="-38" r="2.5" /></g>
    </>
  ),
  '무장 원귀': () => (
    <>
      <path d="M-15 -114 Q0 -136 15 -114 Z" fill="#6c7378" stroke="#2a2e32" stroke-width="1.6" />
      <path d="M0 -132 L0 -146" stroke="#2a2e32" stroke-width="2.4" />
      <path d="M30 -150 L30 4" stroke="#6b5636" stroke-width="3" />
      <path d="M30 -150 l-5 14 l10 0 Z" fill="#8a9298" stroke="#2a2e32" stroke-width="1" />
    </>
  ),
  '몽달·손각시': () => <path d="M-12 -112 q-14 20 -8 52 q4 8 -2 16" stroke="#c33427" stroke-width="4" fill="none" />,
  // 놀이 사자: 군졸 차림의 저승사자(해학). 적갈색 벙거지 + 오라 — 검은 갓은 쓰지 않는다
  사자: () => (
    <>
      <ellipse cx="0" cy="-118" rx="22" ry="5" fill="#7a3a2a" stroke={INK} stroke-width="1.2" />
      <path d="M-12 -119 Q0 -136 12 -119 Z" fill="#7a3a2a" stroke={INK} stroke-width="1.2" />
      <path d="M0 -134 l-3 -8 l6 0 Z" fill="#c33427" />
      <path d="M22 -60 q16 10 6 26 q-10 12 4 22" stroke="#c33427" stroke-width="3" fill="none" />
    </>
  ),
};

/** 보스 개별 소품 (얼굴을 덮는 몸 위에, 원귀 좌표계 = 얼굴이 +x 쪽인 그림을 무대에서 뒤집는다) */
const BOSS_EXTRA: Record<string, () => JSX.Element> = {
  // 뱃사공: 삿갓 · 노 · 배
  sakkun: () => (
    <>
      <path d="M-30 -118 L30 -118 L0 -140 Z" fill="#b89a5a" stroke="#4a3a20" stroke-width="1.6" />
      <path d="M24 -110 L44 6" stroke="#6b4a2e" stroke-width="5" />
      <path d="M40 -6 l10 22 l-12 2 Z" fill="#6b4a2e" />
      <path d="M-62 6 Q0 26 62 6 L52 -6 L-52 -6 Z" fill="#4a3424" stroke="#1d140c" stroke-width="2" />
    </>
  ),
  // 상여: 꼭두 장식 상여 (넋은 상여 위에 선다 — 훼손 연출 없음)
  sangyeo: () => (
    <g transform="translate(0 4)">
      <rect x="-48" y="-22" width="96" height="18" fill="#5a2a22" stroke="#1d140c" stroke-width="1.6" />
      <path d="M-56 -22 L56 -22 L44 -40 L-44 -40 Z" fill="#2f5a7a" stroke="#1d140c" stroke-width="1.4" opacity=".9" />
      {[-34, -12, 10, 32].map((x) => <circle key={x} cx={x} cy="-31" r="4" fill="#e2b23a" stroke="#1d140c" stroke-width=".8" />)}
      <path d="M-60 -6 L60 -6" stroke="#6b4a2e" stroke-width="4" />
    </g>
  ),
  // 돌림병이 된 넋: 열기 장막
  dollimbyeong_neok: () => (
    <path d="M-40 -150 q8 30 -4 60 q-8 30 6 90 M40 -150 q-8 30 4 60 q8 30 -6 90" stroke="#e08a3a" stroke-width="3" fill="none" opacity=".6" />
  ),
  // 허주: 가면 (손님 모습은 쓰지 않는다)
  heoju: () => (
    <g transform="translate(0 -108)">
      <ellipse rx="15" ry="17" fill="#d9cfb0" stroke={INK} stroke-width="1.6" />
      <path d="M-8 -4 q4 -4 8 0 M2 -4 q4 -4 8 0 M-6 8 q6 5 12 0" stroke={INK} stroke-width="1.6" fill="none" />
    </g>
  ),
  // 혼백이 갈린 원귀: 혼·백 두 몸
  honbaek_wongwi: () => (
    <g transform="translate(-30 -6) scale(.7)" opacity=".5">
      <path d="M-18 -94 L-34 -58 L-18 -70 L-18 -11 L18 -11 L18 -70 L34 -58 L18 -94 Z" fill="#cfd8e0" stroke="#7a8288" stroke-width="1.4" />
      <circle cx="0" cy="-108" r="14" fill="#cfd8e0" stroke="#7a8288" stroke-width="1.4" />
    </g>
  ),
  // 맨 앞에 선 굶은 넋: 뒤로 늘어선 줄
  maenap_neok: () => (
    <g opacity=".45">
      {[30, 52, 74].map((x, i) => (
        <g key={x} transform={`translate(${-x} ${-4}) scale(${0.55 - i * 0.08})`}>
          <path d="M-18 -94 L-18 -11 L18 -11 L18 -94 Z" fill="#cfc7ad" stroke="#5a5444" stroke-width="1.6" />
          <circle cx="0" cy="-108" r="14" fill="#cfc7ad" stroke="#5a5444" stroke-width="1.6" />
        </g>
      ))}
    </g>
  ),
  // 빗장을 놓지 못한 장수: 빗장(나무 막대)
  bitjang_janggun: () => (
    <>
      <rect x="-50" y="-70" width="100" height="12" rx="3" fill="#6b4a2e" stroke="#1d140c" stroke-width="1.6" />
      <rect x="-8" y="-74" width="16" height="20" fill="#4a3a2a" stroke="#1d140c" stroke-width="1.2" />
    </>
  ),
};

export interface SpiritProps {
  family: string;
  tier?: Tier;
  boss?: string;
  /** 정지 상태(색·모양). 움직임은 무대 CSS 가 준다 */
  state?: SpiritState;
  hit?: boolean;
}

/** 원귀 그림(그림자 포함). 바깥에서 translate 로 자리를 준다. 내부 scale(−s, s) 로 왼쪽을 본다 */
export function SpiritParts({ family, tier = 'normal', boss, state = 'idle' }: SpiritProps) {
  const tint = HAN[family] ?? '#888';
  const s = TIER_SCALE[tier] ?? 1;
  const extra = FAMILY_EXTRA[family];
  const bossExtra = boss ? BOSS_EXTRA[boss] : undefined;
  const haewon = state === 'haewon';
  const ash = state === 'cheochi';
  const fill = haewon ? '#fffaf0' : ash ? '#5a5650' : HANJI;
  const stroke = ash ? '#3a3732' : '#8f8774';
  return (
    <g transform={`scale(${-s} ${s})`}>
      {!ash && <ellipse class="aura" cx="0" cy="-66" rx="40" ry="66" fill={haewon ? '#fff3d0' : tint} opacity=".45" filter="url(#jsg-aura)" />}
      {haewon && <circle class="halo" cx="0" cy="-70" r="78" fill="url(#jsg-haewon)" />}
      <g class="paper">
        <SpiritShape fill={fill} stroke={stroke} thin={family === '굶주린 넋' ? 0.8 : 1} burnt={family === '억울귀' && !haewon} />
        {!ash && !haewon && extra?.()}
        {!ash && bossExtra?.()}
      </g>
      {haewon && (
        <g class="petals">
          {[[-44, -150, '#e0503f'], [40, -170, '#e2b23a'], [-30, -200, '#ece6d6'], [34, -120, '#2f86a6']].map(([x, y, c]) => <circle key={c as string} cx={x as number} cy={y as number} r="4.5" fill={c as string} opacity=".85" />)}
        </g>
      )}
      {ash && (
        <g class="soot" fill="#3a3732" opacity=".8"><circle cx="-30" cy="-12" r="2" /><circle cx="-40" cy="-22" r="1.6" /><circle cx="-22" cy="-30" r="1.4" /><circle cx="-48" cy="-8" r="1.8" /></g>
      )}
    </g>
  );
}

export function SpiritShadow({ tier = 'normal' }: { tier?: Tier }) {
  return <ellipse class="shadow" cx="0" cy="3" rx={30 * (TIER_SCALE[tier] ?? 1)} ry="5" fill="rgba(0,0,0,.3)" />;
}

/** 작은 넋 (쓰러진 영웅 위 · 결과 행렬의 해원한 넋) */
export function SoulWisp({ x = 0, y = 0, s = 0.32, glow = true }: { x?: number; y?: number; s?: number; glow?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} class="wisp">
      {glow && <circle cx="0" cy={-40 * s * 3} r={36 * s * 3} fill="url(#jsg-haewon)" opacity=".55" />}
      <g transform={`scale(${s})`}>
        <SpiritShape fill={HANJI} opacity={0.88} />
      </g>
    </g>
  );
}

/** 손님(마마 신령)을 모신 가마와 차일 — 공격 대상 표시를 두지 않는다 */
export function Palanquin({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} class="palanquin" aria-label="손님의 가마">
      <path d="M-90 -150 L90 -150 L76 -128 L-76 -128 Z" fill="#c33427" opacity=".75" />
      <path d="M-90 -150 L-90 -40 M90 -150 L90 -40" stroke="#6b4a2e" stroke-width="4" />
      {[-60, -20, 20, 60].map((dx) => <path key={dx} d={`M${dx} -128 l6 10 l-6 8 l6 10`} stroke={HANJI} stroke-width="2.4" fill="none" />)}
      <rect x="-40" y="-100" width="80" height="58" rx="4" fill="#7a3a22" stroke={INK} stroke-width="2" />
      <path d="M-48 -100 Q0 -126 48 -100 Z" fill="#e2b23a" stroke={INK} stroke-width="2" />
      <rect x="-22" y="-90" width="44" height="40" fill="#f0e6c8" stroke={INK} stroke-width="1.4" />
      <path d="M-22 -70 h44 M0 -90 v40" stroke="#c9a85a" stroke-width="1.2" />
      <path d="M-70 -46 L70 -46" stroke="#5a3a22" stroke-width="6" stroke-linecap="round" />
    </g>
  );
}

/** 잘못 끌려온 산 사람 (호위) — 흰 옷의 마을 사람 */
export function Villager({ x, y, scale = 0.8 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} class="villager">
      <ellipse cx="0" cy="2" rx="26" ry="5" fill="rgba(0,0,0,.35)" />
      <path d="M-14 -88 L14 -88 L24 -6 Q0 0 -24 -6 Z" fill="#e8e0cc" stroke={INK} stroke-width="2" />
      <circle cx="2" cy="-104" r="14" fill="#ead6b4" stroke={INK} stroke-width="2" />
      <path d="M-10 -112 Q2 -124 14 -112" stroke="#2a2018" stroke-width="5" fill="none" />
      <circle cx="8" cy="-106" r="1.8" fill={INK} />
      <path d="M-12 -80 L-20 -50 M12 -80 L18 -52" stroke={INK} stroke-width="3" />
    </g>
  );
}
