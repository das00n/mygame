// 지역별 배경 겹(하늘 · 먼 산/담 · 물/마을/회랑 · 바닥과 길베) + 무대 소품 + 넋등 비네트.
// 지역 1 「건너지 못한 나루」: 밤 강 · 갈대 / 지역 2 「역병 든 마을」: 초가 · 금줄 · 열기 아지랑이 / 지역 3 「열두 대문」: 기와 담 · 늘어선 문 · 돌바닥.
// 대문 방(지역 3)은 무대 뒤에 큰 대문을 세운다.

import type { ComponentChildren } from 'preact';
import { LIGHT_BANDS, bandOf } from '../../game/content.ts';
import { HANJI, INK } from './palette.ts';

export type BackdropVariant = 'path' | 'room' | 'boss' | 'gate';

const SKY: Record<number, [string, string, string]> = {
  1: ['#1b2442', '#141a2c', '#0e111c'],
  2: ['#2a1f2e', '#3a2630', '#1a1418'],
  3: ['#161a26', '#1c2030', '#0f1118'],
};

function Ridge({ W, y, amp, fill, seed = 0 }: { W: number; y: number; amp: number; fill: string; seed?: number }) {
  const pts: string[] = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const x = (W * i) / n;
    const yy = y - amp * (0.5 + 0.5 * Math.sin(i * 1.7 + seed));
    pts.push(`${x.toFixed(0)} ${yy.toFixed(0)}`);
  }
  return <path d={`M0 ${y} L${pts.join(' L')} L${W} ${y + 400} L0 ${y + 400} Z`} fill={fill} />;
}

function River({ W, FY }: { W: number; FY: number }) {
  return (
    <g class="bd-river">
      <rect x="0" y={FY - 54} width={W} height="42" fill="#1d3850" opacity=".85" />
      {Array.from({ length: Math.round(W / 60) }, (_, i) => <path key={i} d={`M${i * 60 + 10} ${FY - 36} h${26 + (i % 3) * 8}`} stroke="#4f7a96" stroke-width="1.2" opacity=".55" />)}
      {Array.from({ length: Math.round(W / 34) }, (_, i) => (
        <path key={`r${i}`} d={`M${i * 34 + 6} ${FY - 8} q${4 - (i % 3) * 3} -${26 + (i % 4) * 8} ${i % 2 ? 6 : -4} -${44 + (i % 5) * 6}`} stroke="#2c3a2a" stroke-width="2" fill="none" opacity=".8" />
      ))}
    </g>
  );
}

function ChogaRow({ W, FY }: { W: number; FY: number }) {
  // 초가 지붕 집들 + 사립문 금줄 (역병 든 마을)
  const xs = [60, 250, 470, 720, 960, 1180].filter((x) => x < W + 60);
  return (
    <g class="bd-village">
      {xs.map((x, i) => {
        const w = 150 + (i % 2) * 30;
        const h = 60 + (i % 3) * 8;
        const y = FY - 26;
        return (
          <g key={x} transform={`translate(${x} ${y})`} opacity=".9">
            <rect x={-w / 2} y={-h} width={w} height={h} fill="#3a2e2a" />
            <path d={`M${-w / 2 - 18} ${-h + 4} Q0 ${-h - 46} ${w / 2 + 18} ${-h + 4} Z`} fill="#6b5236" stroke="#2a2018" stroke-width="2" />
            <rect x={-12} y={-34} width="24" height="34" fill="#1d1612" />
            {i % 2 === 0 && <path d={`M${-w / 2 + 6} ${-h + 10} Q0 ${-h + 22} ${w / 2 - 6} ${-h + 10}`} stroke="#a08a5a" stroke-width="2.4" fill="none" />}
            {i % 2 === 0 && [0, 1, 2, 3].map((k) => <path key={k} d={`M${-w / 2 + 20 + k * 32} ${-h + 14} l3 6 l-3 5 l3 6`} stroke={HANJI} stroke-width="1.8" fill="none" opacity=".7" />)}
          </g>
        );
      })}
      <rect x="0" y={FY - 30} width={W} height="40" fill="url(#bd-heat)" opacity=".5" />
    </g>
  );
}

function WallRow({ W, FY }: { W: number; FY: number }) {
  // 기와 담장 + 멀리 늘어선 대문 (열두 대문)
  return (
    <g class="bd-walls">
      <rect x="0" y={FY - 120} width={W} height="110" fill="#262a36" />
      <path d={`M-10 ${FY - 122} L${W + 10} ${FY - 122} L${W} ${FY - 136} L0 ${FY - 136} Z`} fill="#1a1d26" stroke="#0c0e14" stroke-width="2" />
      {Array.from({ length: Math.ceil(W / 18) }, (_, i) => <path key={i} d={`M${i * 18} ${FY - 136} q9 -7 18 0`} stroke="#2e3340" stroke-width="2" fill="none" />)}
      {[0.16, 0.42, 0.68, 0.9].map((t, i) => {
        const x = W * t;
        const s = 0.55 + i * 0.05;
        return (
          <g key={t} transform={`translate(${x} ${FY - 12}) scale(${s})`} opacity=".7">
            <rect x="-50" y="-150" width="100" height="150" fill="#3a1c18" stroke="#120806" stroke-width="3" />
            <path d="M0 -150 L0 0" stroke="#120806" stroke-width="3" />
            <path d="M-70 -150 L70 -150 L56 -176 L-56 -176 Z" fill="#1a1d26" />
            <circle cx="-10" cy="-70" r="4" fill="#a08a5a" /><circle cx="10" cy="-70" r="4" fill="#a08a5a" />
          </g>
        );
      })}
    </g>
  );
}

/** 큰 대문 (대문 방 · 3지역 보스) */
export function BigGate({ x, y, s = 1, open = false }: { x: number; y: number; s?: number; open?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} class="big-gate">
      <path d="M-170 -250 L170 -250 L150 -284 L-150 -284 Z" fill="#1d1a20" stroke={INK} stroke-width="3" />
      <rect x="-150" y="-250" width="300" height="20" fill="#7a2a22" />
      <rect x="-140" y="-230" width="18" height="230" fill="#4a2018" />
      <rect x="122" y="-230" width="18" height="230" fill="#4a2018" />
      {open ? (
        <rect x="-122" y="-230" width="244" height="230" fill="#0a0b10" />
      ) : (
        <>
          <rect x="-122" y="-230" width="122" height="230" fill="#5a2a20" stroke="#1d0e0a" stroke-width="2" />
          <rect x="0" y="-230" width="122" height="230" fill="#5a2a20" stroke="#1d0e0a" stroke-width="2" />
          {[-90, -50, 50, 90].map((dx) => [-190, -140, -90, -40].map((dy) => <circle key={`${dx}${dy}`} cx={dx} cy={dy} r="4" fill="#a08a5a" />))}
          <rect x="-110" y="-128" width="220" height="16" rx="3" fill="#8a6a3a" stroke="#2a1a0a" stroke-width="2" />
        </>
      )}
    </g>
  );
}

export function Hongsalmun({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  // 입구 표시: 붉은 살대 문 (홍살문)
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} class="hongsal">
      <rect x="-70" y="-190" width="9" height="190" fill="#9a2a20" />
      <rect x="61" y="-190" width="9" height="190" fill="#9a2a20" />
      <rect x="-84" y="-196" width="168" height="10" fill="#9a2a20" />
      {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${-56 + i * 14} -186 L${-56 + i * 14} -150`} stroke="#9a2a20" stroke-width="3" />)}
      <circle cx="0" cy="-206" r="9" fill="#c33427" stroke="#e2b23a" stroke-width="2" />
    </g>
  );
}

export function Geumjul({ W, y = 6 }: { W: number; y?: number }) {
  return (
    <g class="geumjul" aria-hidden="true">
      <path d={`M0 ${y} Q${W / 2} ${y + 14} ${W} ${y}`} stroke="#a08a5a" stroke-width="4" fill="none" />
      {Array.from({ length: Math.floor(W / 46) }, (_, i) => {
        const x = 20 + i * 46;
        const yy = y + 3 + Math.sin((x / W) * Math.PI) * 7;
        return <path key={i} d={`M${x} ${yy} l5 9 l-5 6 l5 9`} stroke={HANJI} stroke-width="3" fill="none" opacity=".75" />;
      })}
    </g>
  );
}

/** 지역 배경. W×H, 발선 FY */
export function Backdrop({ region, W, H, FY, variant = 'room', children }: { region: number; W: number; H: number; FY: number; variant?: BackdropVariant; children?: ComponentChildren }) {
  const r = SKY[region] ? region : 1;
  const [a, b, c] = SKY[r];
  const gid = `bd-sky-${r}`;
  return (
    <g class={`backdrop region-${r} v-${variant}`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color={a} /><stop offset=".6" stop-color={b} /><stop offset="1" stop-color={c} /></linearGradient>
        <linearGradient id="bd-heat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e08a3a" stop-opacity="0" /><stop offset="1" stop-color="#e08a3a" stop-opacity=".45" /></linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${gid})`} />
      {r === 1 && (
        <>
          <Ridge W={W} y={FY - 140} amp={60} fill="#1c2540" seed={0.4} />
          <Ridge W={W} y={FY - 90} amp={34} fill="#222c48" seed={2.1} />
          <River W={W} FY={FY} />
        </>
      )}
      {r === 2 && (
        <>
          <Ridge W={W} y={FY - 150} amp={50} fill="#2a2030" seed={1.2} />
          <circle cx={W * 0.78} cy={FY - 210} r="26" fill="#e08a3a" opacity=".35" />
          <ChogaRow W={W} FY={FY} />
        </>
      )}
      {r === 3 && <WallRow W={W} FY={FY} />}
      {variant === 'gate' && <BigGate x={W * 0.74} y={FY - 4} s={Math.min(1, (FY - 20) / 300)} />}
      {variant === 'boss' && r !== 3 && <circle cx={W * 0.78} cy={FY - 160} r="120" fill="#5a1a1a" opacity=".22" />}
      {variant === 'boss' && r === 3 && <BigGate x={W * 0.74} y={FY - 4} s={Math.min(1.1, (FY - 20) / 290)} />}
      {/* 바닥과 길베(흰 무명길) */}
      <rect x="0" y={FY - 12} width={W} height={H - FY + 12} fill={r === 3 ? '#24262c' : r === 2 ? '#2a2018' : '#231e16'} />
      {r === 3 && Array.from({ length: Math.ceil(W / 80) }, (_, i) => <path key={i} d={`M${i * 80} ${FY - 12} L${i * 80 - 30} ${H}`} stroke="#1a1c22" stroke-width="2" />)}
      <path d={`M0 ${FY + 4} L${W} ${FY - 2} L${W} ${FY + 24} L0 ${FY + 30} Z`} fill={HANJI} opacity=".18" />
      {children}
    </g>
  );
}

/** 넋등 비네트: 등불(lampX) 둘레만 밝고 가장자리·앞쪽이 어둡다. 구간이 바뀌면 600ms 로 옮겨 간다 */
export function LightVignette({ light, W, H, lampX, lampY, ahead = false, uid = 'stage' }: { light: number; W: number; H: number; lampX: number; lampY: number; ahead?: boolean; uid?: string }) {
  const band = bandOf(light);
  const dark = [0.12, 0.28, 0.48, 0.66, 0.84][band.idx] ?? 0.5;
  const r = W * (0.3 + (light / 100) * 0.38);
  const vid = `vig-${uid}`;
  return (
    <g class="vignette" data-band={band.name}>
      <defs>
        <radialGradient id={vid} gradientUnits="userSpaceOnUse" cx={lampX} cy={lampY} r={r}>
          <stop offset=".4" stop-color="#03040a" stop-opacity="0" />
          <stop offset="1" stop-color="#03040a" stop-opacity="1" />
        </radialGradient>
      </defs>
      <ellipse class="lamp-glow" cx={lampX} cy={lampY} rx={r * 0.8} ry={H * 0.7} fill="url(#jsg-lamp)" style={{ opacity: 0.25 + (light / 100) * 0.6 }} />
      <rect class="vig-dark" x="0" y="0" width={W} height={H} fill={`url(#${vid})`} style={{ opacity: dark }} />
      {ahead && <rect class="vig-ahead" x="0" y="0" width={W} height={H} fill="url(#jsg-dark-r)" style={{ opacity: 0.3 + dark * 0.7 }} />}
    </g>
  );
}

export const BAND_NAMES = LIGHT_BANDS.map((b) => b.name);
