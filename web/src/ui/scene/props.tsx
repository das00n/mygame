// 무대 소품: 굿상(신령 최대 3) · 위패 · 한옥(시설 상태별) · 서낭 돌무더기 · 나룻배 · 모닥불 · 솟대 · 당산나무 · 덫 표식.

import type { ComponentChildren } from 'preact';
import { HANJI, INK, WOOD } from './palette.ts';

export interface AltarSpirit {
  name: string;
  left: number;
  color: string;
}

/** 굿상: 상 위에 신위(신령 이름 첫 글자) 최대 3, 촛불 둘. 비었으면 촛불이 꺼져 있다 */
export function GutsangTable({ x, y, s = 1, spirits, newKey }: { x: number; y: number; s?: number; spirits: AltarSpirit[]; newKey?: string }) {
  const lit = spirits.length > 0;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} class="gutsang">
      <ellipse cx="0" cy="2" rx="52" ry="6" fill="rgba(0,0,0,.35)" />
      {lit && <circle cx="0" cy="-70" r="56" fill="url(#jsg-lamp)" />}
      <rect x="-46" y="-30" width="92" height="10" fill="#7a3a22" stroke={INK} stroke-width="1.5" />
      <path d="M-40 -20 L-42 0 M40 -20 L42 0" stroke="#5a2a18" stroke-width="5" />
      {spirits.slice(0, 3).map((sp, i, arr) => {
        const dx = (i - (arr.length - 1) / 2) * 24;
        return (
          <g key={`${sp.name}${i}`} class={`altar-spirit ${newKey && i === arr.length - 1 ? 'fresh' : ''}`} transform={`translate(${dx} 0)`}>
            <rect x="-9" y="-76" width="18" height="46" rx="3" fill="#e8cf7c" stroke="#5a4524" stroke-width="1.4" />
            <rect x="-9" y="-76" width="18" height="6" fill={sp.color} />
            <text x="0" y="-48" text-anchor="middle" font-size="15" class="svg-brush" fill="#5a2414">{sp.name.slice(0, 1)}</text>
            <circle cx="10" cy="-80" r="8" fill="#e2b23a" stroke={INK} stroke-width=".8" />
            <text x="10" y="-76" text-anchor="middle" font-size="10" font-weight="700" fill="#111">{sp.left}</text>
          </g>
        );
      })}
      {[-36, 30].map((cx) => (
        <g key={cx}>
          <rect x={cx} y="-44" width="6" height="14" fill="#efe6cf" />
          {lit ? <path class="flame" d={`M${cx + 3} -44 q-3 -6 0 -10 q3 4 0 10`} fill="#ffc964" /> : <path d={`M${cx + 3} -44 l0 -4`} stroke="#333" stroke-width="1" />}
        </g>
      ))}
    </g>
  );
}

/** 위패 (사당·떠난 영웅) */
export function Tablet({ x, y, s = 1, name, color, glow = true }: { x: number; y: number; s?: number; name: string; color: string; glow?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} class="tablet">
      {glow && <circle cx="0" cy="-50" r="46" fill="url(#jsg-lamp)" opacity=".7" />}
      <rect x="-24" y="-6" width="48" height="8" fill="#5a2a18" />
      <rect x="-18" y="-96" width="36" height="90" rx="6" fill="#e8cf7c" stroke="#5a4524" stroke-width="1.6" />
      <rect x="-12" y="-86" width="24" height="5" fill={color} />
      <VText x={0} y={-74} text={name} size={name.length > 3 ? 13 : 17} fill="#3a2414" />
    </g>
  );
}

/** 세로쓰기 (위패의 이름) */
export function VText({ x, y, text, size, fill }: { x: number; y: number; text: string; size: number; fill: string }) {
  const chars = [...text].slice(0, 4);
  return (
    <text x={x} y={y} text-anchor="middle" font-size={size} class="svg-brush" fill={fill}>
      {chars.map((ch, i) => <tspan key={i} x={x} dy={i === 0 ? 0 : size * 0.95}>{ch}</tspan>)}
    </text>
  );
}

export type LotState = 'built' | 'open' | 'lock';

/** 한옥: 빈 부지(말뚝·새끼줄) · 잠긴 부지(점선) · 1~3단계(지붕·단청·금줄이 는다) */
export function Hanok({ x, y, w, h, label, sub, state, tier = 1, children }: {
  x: number; y: number; w: number; h: number; label: string; sub?: string; state: LotState; tier?: number; children?: ComponentChildren;
}) {
  const roofD = `M${-w / 2 - 22} ${-h} Q${-w / 2} ${-h - 4} ${-w / 2 + 8} ${-h - 26} L${w / 2 - 8} ${-h - 26} Q${w / 2} ${-h - 4} ${w / 2 + 22} ${-h} Q0 ${-h + 12} ${-w / 2 - 22} ${-h} Z`;
  const roofFill = tier >= 3 ? '#3a2e3a' : tier >= 2 ? '#2e2a2e' : '#4a3a2a';
  return (
    <g transform={`translate(${x} ${y})`} class={`hanok lot-${state} tier-${tier}`}>
      {state === 'built' && (
        <>
          <rect x={-w / 2} y={-h} width={w} height={h} fill={HANJI} stroke="#3a2a1a" stroke-width="2" />
          <rect x={-w / 2} y={-h} width={w} height={h} fill="url(#jsg-hanji)" />
          {[0.25, 0.5, 0.75].map((t) => <line key={t} x1={-w / 2 + w * t} y1={-h} x2={-w / 2 + w * t} y2="0" stroke="#6b4a2e" stroke-width="3" />)}
          <rect x={-w / 2} y="-6" width={w} height="6" fill="#6b4a2e" />
          {tier === 1 ? (
            // 1단계: 초가 지붕
            <path d={`M${-w / 2 - 14} ${-h + 2} Q0 ${-h - 40} ${w / 2 + 14} ${-h + 2} Z`} fill="#8a6a42" stroke="#3a2a1a" stroke-width="2" />
          ) : (
            <path d={roofD} fill={roofFill} stroke="#141018" stroke-width="2" />
          )}
          {tier >= 2 && <path d={`M${-w / 2} ${-h + 4} L${w / 2} ${-h + 4}`} stroke="#2f86a6" stroke-width="3" />}
          {tier >= 3 && <path d={`M${-w / 2} ${-h + 8} L${w / 2} ${-h + 8}`} stroke="#c33427" stroke-width="3" />}
          {tier >= 2 && (
            <g>
              <path d={`M${-w / 2 + 4} ${-h * 0.62} Q0 ${-h * 0.5} ${w / 2 - 4} ${-h * 0.62}`} stroke="#a08a5a" stroke-width="2.4" fill="none" />
              {Array.from({ length: Math.max(2, Math.floor(w / 26)) }, (_, k) => <path key={k} d={`M${-w / 2 + 12 + k * 26} ${-h * 0.6} l3 6 l-3 4 l3 6`} stroke={HANJI} stroke-width="1.8" fill="none" />)}
            </g>
          )}
        </>
      )}
      {state === 'open' && (
        <g>
          {[-w / 2, -w / 6, w / 6, w / 2].map((dx) => <path key={dx} d={`M${dx} 0 L${dx} -22`} stroke={WOOD} stroke-width="3" />)}
          <path d={`M${-w / 2} -18 L${w / 2} -18`} stroke="#a08a5a" stroke-width="2" stroke-dasharray="4 3" />
        </g>
      )}
      {state === 'lock' && (
        <g>
          <rect x={-w / 2} y={-h} width={w} height={h} fill="none" stroke="#7d7765" stroke-width="2" stroke-dasharray="6 5" />
          <path d={roofD} fill="none" stroke="#7d7765" stroke-width="2" stroke-dasharray="6 5" />
        </g>
      )}
      {children}
      <rect x="-50" y="8" width="100" height={sub ? 38 : 24} fill="#3a2414" stroke="#1a0e08" rx="2" opacity={state === 'built' ? 1 : 0.75} />
      <text x="0" y="27" text-anchor="middle" font-size="20" class="svg-brush" fill={state === 'built' ? '#ead592' : '#9a8f78'}>{label}</text>
      {sub && <text x="0" y="42" text-anchor="middle" font-size="11" fill="#c9bf9f">{sub}</text>}
    </g>
  );
}

export function Cairn({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} class="cairn">
      <ellipse cx="0" cy="0" rx="58" ry="9" fill="rgba(0,0,0,.4)" />
      <ellipse cx="-20" cy="-10" rx="22" ry="13" fill="#5a5448" stroke={INK} />
      <ellipse cx="18" cy="-12" rx="24" ry="14" fill="#666052" stroke={INK} />
      <ellipse cx="0" cy="-30" rx="22" ry="13" fill="#6e685a" stroke={INK} />
      <ellipse cx="-4" cy="-48" rx="15" ry="10" fill="#7a7466" stroke={INK} />
      <path d="M6 -50 L14 -120" stroke="#4a3a2a" stroke-width="3" />
      {['#c33427', '#2f86a6', '#e2b23a', '#ece6d6', '#3a3a44'].map((c, i) => <path key={c} d={`M${9 + i * 1.2} ${-110 + i * 11} q14 6 10 22`} stroke={c} stroke-width="5" fill="none" />)}
    </g>
  );
}

export function Boat({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} class="boat">
      <path d="M-80 -10 Q0 16 80 -10 L66 -26 L-66 -26 Z" fill="#4a3424" stroke="#1d140c" stroke-width="2" />
      <path d="M40 -26 L64 -110" stroke="#6b4a2e" stroke-width="4" />
      <ellipse cx="0" cy="0" rx="96" ry="7" fill="none" stroke="#5f8fb0" stroke-width="1.6" opacity=".6" />
    </g>
  );
}

export function Campfire({ x, y, s = 1, lit = true }: { x: number; y: number; s?: number; lit?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} class="campfire">
      {lit && <ellipse cx="0" cy="-40" rx="150" ry="110" fill="url(#jsg-fire)" />}
      <path d="M-34 0 L30 -14 M-30 -14 L34 0" stroke="#5a3a22" stroke-width="7" stroke-linecap="round" />
      {lit && (
        <g class="flame">
          <path d="M-18 -6 Q-22 -40 0 -66 Q20 -40 18 -6 Z" fill="#ff9a40" />
          <path d="M-9 -6 Q-12 -30 0 -48 Q12 -30 9 -6 Z" fill="#ffd890" />
        </g>
      )}
      {[-50, -40, 44, 54].map((dx, i) => <ellipse key={dx} cx={dx} cy={-2} rx="9" ry="6" fill={i % 2 ? '#5a5448' : '#666052'} stroke={INK} />)}
    </g>
  );
}

export function Sotdae({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} class="sotdae">
      {[0, 18, 36].map((dx, i) => (
        <g key={dx}>
          <path d={`M${dx - 20} 0 L${dx - 20} ${-150 + i * 18}`} stroke="#4a3a2a" stroke-width="3" />
          <path d={`M${dx - 32} ${-150 + i * 18} q10 -12 22 -2 l6 -4 l-2 7 q-12 6 -26 -1 Z`} fill="#c9bf9f" stroke={INK} />
        </g>
      ))}
    </g>
  );
}

export function DangsanTree({ x, y, s = 1, geumjul = true }: { x: number; y: number; s?: number; geumjul?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} class="dangsan">
      <path d="M-10 0 Q-6 -80 -18 -130 M10 0 Q8 -70 22 -120" stroke="#3a2a1e" stroke-width="16" fill="none" />
      <circle cx="-30" cy="-150" r="44" fill="#2a3a2e" />
      <circle cx="20" cy="-170" r="50" fill="#2e4232" />
      <circle cx="50" cy="-130" r="36" fill="#26362a" />
      {geumjul && (
        <>
          <path d="M-16 -50 Q0 -42 16 -50" stroke="#a08a5a" stroke-width="4" fill="none" />
          {[0, 1, 2, 3].map((i) => <path key={i} d={`M${-12 + i * 8} -47 l3 7 l-3 5 l3 7`} stroke={HANJI} stroke-width="2" fill="none" />)}
        </>
      )}
    </g>
  );
}

/** 바닥에 그은 덫 표식 (알아본 덫) */
export function TrapMark({ x, y, s = 1, known = true }: { x: number; y: number; s?: number; known?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} class="trap">
      <ellipse cx="0" cy="0" rx="44" ry="9" fill="none" stroke={known ? '#c33427' : '#5a4a3a'} stroke-width="2" stroke-dasharray="5 4" />
      {known && <path d="M-16 -4 L16 4 M-16 4 L16 -4" stroke="#c33427" stroke-width="2.4" />}
    </g>
  );
}

/** 나무 표지 (방 이벤트) */
export function SignPost({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} class="signpost">
      <path d="M0 0 L0 -96" stroke={WOOD} stroke-width="5" />
      <rect x="-30" y="-96" width="60" height="30" fill="#c9bf9f" stroke={INK} stroke-width="1.6" />
      <path d="M-22 -86 h44 M-22 -78 h34" stroke="#5a4524" stroke-width="2" />
      <circle cx="0" cy="-108" r="10" fill="#ffc964" opacity=".8" />
    </g>
  );
}
