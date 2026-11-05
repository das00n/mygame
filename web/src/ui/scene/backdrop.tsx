// 지역별 배경 겹(하늘 · 먼 산/담 · 물/마을/회랑 · 바닥과 길베) + 무대 소품 + 넋등 비네트.
// 지역 1 「건너지 못한 나루」: 밤 강 · 갈대 / 지역 2 「역병 든 마을」: 초가 · 금줄 · 열기 아지랑이 /
// 지역 3 「열두 대문」 ⟨반복 5⟩: 댓가지를 엮어 세운 굿판의 문이 끝없이 이어진 회랑(질침의 열두 문) · 닦인 길.
// 대문 방(지역 3)은 무대 뒤에 큰 댓가지 문을, 보스 굴(열두째 대문)은 무쇠 빗장 문을 세운다.
// 업경대 방은 거울 뒤로 빈 자리 열넷(EopgyeongSeats), 좋은 결말 행렬은 열린 대문 너머 꽃밭(FlowerHill).

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

/** 댓가지 문 하나 (⟨반복 5⟩ 05-region3 §1.1 G-01): 대나무 기둥 둘 · 휘어 엮은 댓가지 아치 · 한지 술 · 금줄. 성문이 아니라 사람 키의 두세 배 */
export function BambooGate({ x, y, s = 1, open = false, opacity = 1 }: { x: number; y: number; s?: number; open?: boolean; opacity?: number }) {
  const pole = (px: number) => (
    <g>
      <rect x={px - 7} y="-230" width="14" height="230" fill="#6f7a44" stroke="#2c3018" stroke-width="2" />
      {[-200, -150, -100, -50].map((ny) => <path key={ny} d={`M${px - 7} ${ny} h14`} stroke="#3c4422" stroke-width="2.4" />)}
    </g>
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} class="bamboo-gate" opacity={opacity}>
      {pole(-90)}
      {pole(90)}
      {/* 휘어 엮은 댓가지 아치 (세 가닥) */}
      {[0, 8, 16].map((k) => <path key={k} d={`M-90 ${-222 + k} Q0 ${-300 + k} 90 ${-222 + k}`} stroke="#8a9a5a" stroke-width="4" fill="none" />)}
      {/* 한지 술 */}
      {Array.from({ length: 9 }, (_, i) => {
        const t = (i + 0.5) / 9;
        const ax = -90 + 180 * t;
        const ay = -222 - 78 * 4 * t * (1 - t) + 8;
        return <path key={i} d={`M${ax} ${ay} l4 12 l-4 10 l4 12`} stroke={HANJI} stroke-width="2.6" fill="none" opacity=".85" />;
      })}
      {/* 금줄: 닫힌 문에만 */}
      {!open && (
        <g>
          <path d="M-90 -120 Q0 -104 90 -120" stroke="#a08a5a" stroke-width="4" fill="none" />
          {[-60, -20, 20, 60].map((dx) => <path key={dx} d={`M${dx} -113 l4 8 l-4 6 l4 8`} stroke={HANJI} stroke-width="2.2" fill="none" />)}
        </g>
      )}
    </g>
  );
}

/** 끝없이 이어지는 댓가지 문 회랑 (지역 3 배경 ⟨반복 5⟩): 멀수록 작고 흐리다 */
function BambooRow({ W, FY }: { W: number; FY: number }) {
  const gates = [0.12, 0.34, 0.56, 0.76, 0.93];
  return (
    <g class="bd-bamboo">
      <Ridge W={W} y={FY - 150} amp={40} fill="#1a1e2a" seed={0.8} />
      {gates.map((t, i) => (
        <BambooGate key={t} x={W * t} y={FY - 14} s={0.36 + (i % 2) * 0.06} opacity={0.5 + (i % 2) * 0.15} />
      ))}
      {/* 길가의 댓가지 울 */}
      {Array.from({ length: Math.ceil(W / 26) }, (_, i) => <path key={i} d={`M${i * 26 + 8} ${FY - 14} l${(i % 3) - 1} -${30 + (i % 4) * 6}`} stroke="#4c5630" stroke-width="2" opacity=".7" />)}
    </g>
  );
}

/** 업경대와 빈 자리 열넷 (⟨반복 5⟩ G-04): 방석과 낮은 상만 있고 사람은 없다 — 판결이 없다. 재판정·형벌 구도는 쓰지 않는다 */
export function EopgyeongSeats({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const seats = Array.from({ length: 14 }, (_, i) => {
    const row = i < 7 ? 0 : 1;
    const k = i % 7;
    return { sx: -330 + k * 110 + row * 55, sy: row ? -150 : -86, sc: row ? 0.78 : 1 };
  });
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} class="eopgyeong-seats" aria-label="빈 자리 열넷">
      {seats.map((p, i) => (
        <g key={i} transform={`translate(${p.sx} ${p.sy}) scale(${p.sc})`}>
          <rect x="-36" y="-18" width="72" height="20" rx="7" fill="#5a2a26" stroke="#24100e" stroke-width="2" />
          <rect x="-24" y="-40" width="48" height="16" rx="2" fill="#3a2a1e" stroke="#1a120c" stroke-width="2" />
        </g>
      ))}
      {/* 업경대: 둥근 거울과 나무 받침 */}
      <rect x="-8" y="-150" width="16" height="150" fill="#5a3e24" stroke={INK} stroke-width="2" />
      <path d="M-50 0 L50 0 L36 -18 L-36 -18 Z" fill="#4a3220" stroke={INK} stroke-width="2" />
      <circle cx="0" cy="-196" r="58" fill="#2a3346" stroke="#a08a5a" stroke-width="7" />
      <circle cx="0" cy="-196" r="46" fill="#b9c8d8" opacity=".28" />
      <path d="M-26 -214 q16 -12 34 -6" stroke="#eef3f8" stroke-width="3" fill="none" opacity=".6" />
    </g>
  );
}

/** 열두째 대문 너머 꽃이 핀 산 (⟨반복 5⟩ G-05): 환생꽃·숨살이꽃 — 지옥 풍경 없음 */
export function FlowerHill({ W, FY, x0 = 0 }: { W: number; FY: number; x0?: number }) {
  const colors = ['#f2b8c6', '#ebe3cb', '#f4c27a', '#d98aa8'];
  // 언덕 = 2차 곡선 (x0, FY−10) → 꼭대기 (가운데, FY−150) → (W, FY−30). 꽃은 곡선 아래 비탈에 흩는다
  const y0 = FY - 10;
  const yc = FY - 150;
  const y1 = FY - 30;
  const topAt = (t: number) => (1 - t) * (1 - t) * y0 + 2 * t * (1 - t) * yc + t * t * y1;
  return (
    <g class="flower-hill" aria-label="꽃이 핀 산">
      <path d={`M${x0} ${y0} Q${(x0 + W) / 2} ${yc} ${W} ${y1} L${W} ${FY} L${x0} ${FY} Z`} fill="#2f4a36" opacity=".92" />
      {Array.from({ length: 54 }, (_, i) => {
        const t = 0.04 + (((i * 37) % 54) / 54) * 0.92;
        const top = topAt(t);
        const fy = top + 8 + (((i * 13) % 17) / 17) * Math.max(4, FY - 8 - top - 8);
        return <circle key={i} cx={x0 + t * (W - x0)} cy={fy} r={2.4 + (i % 3)} fill={colors[i % colors.length]} opacity=".9" />;
      })}
    </g>
  );
}

/** 큰 대문 (3지역 보스 = 열두째 대문, 무쇠 빗장) */
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
      {r === 3 && <BambooRow W={W} FY={FY} />}
      {variant === 'gate' && (r === 3 ? <BambooGate x={W * 0.74} y={FY - 4} s={Math.min(1, (FY - 20) / 300)} /> : <BigGate x={W * 0.74} y={FY - 4} s={Math.min(1, (FY - 20) / 300)} />)}
      {variant === 'boss' && r !== 3 && <circle cx={W * 0.78} cy={FY - 160} r="120" fill="#5a1a1a" opacity=".22" />}
      {variant === 'boss' && r === 3 && <BigGate x={W * 0.74} y={FY - 4} s={Math.min(1.1, (FY - 20) / 290)} />}
      {/* 바닥과 길베(흰 무명길) */}
      <rect x="0" y={FY - 12} width={W} height={H - FY + 12} fill={r === 3 ? '#2a2620' : r === 2 ? '#2a2018' : '#231e16'} />
      {/* 지역 3: 닦인 흙길 — 비질 자국 */}
      {r === 3 && Array.from({ length: Math.ceil(W / 60) }, (_, i) => <path key={i} d={`M${i * 60} ${FY - 4 + (i % 3) * 6} q20 -4 40 0`} stroke="#3a342a" stroke-width="2" fill="none" />)}
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
