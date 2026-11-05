// 카드 삽화 스케치 — 공용 도구: 팔레트, 시드 난수, 손그림 떨림 선.
// 모든 그림은 SVG 문자열로 만든다(id·defs 없음 → 한 화면에 수백 장을 겹쳐 그려도 충돌하지 않는다).

export type P2 = [number, number];
export type Rng = () => number;

/** 먹·한지 팔레트 — 강조색은 장면마다 하나만 더한다 */
export const INK = '#2b2219';
export const INK2 = '#6d604c';
export const PAPER = '#f6efdb';
export const SKIN = '#f1e2c4';
export const WASH = '#ddd0b0';
export const WASH2 = '#b9a983';
export const DARK = '#4a3c2c';
export const BROWN = '#7a4a34';
export const LAMP = '#e0a040';
export const CIN = '#c33427';

/** 플레이어블 HERO_COLOR 와 같은 값 */
export const HERO_ACC: Record<string, string> = {
  manshin: '#e0503f', jaebi: '#e5b640', posu: '#3fae94', baksu: '#d4dde3',
  seungnyeo: '#c08a52', beopsa: '#6d8fe6', talggun: '#94c653', chasa: '#c26aa0',
};

/** 원귀 계열 → 한(恨)의 빛깔 (10-presentation §4.4) */
export const HAN: Record<string, string> = {
  수귀: '#5f8fb0', 객귀: '#a08a6a', '굶주린 넋': '#9c9a78', 잡귀잡신: '#8e7aa6',
  억울귀: '#b0564a', 역귀: '#c9873a', '무장 원귀': '#7a8288', '몽달·손각시': '#c27a9a',
};

/** 표(table.ts)의 원귀 계열 부호 → 계열 이름 */
export const FAM_CODE: Record<string, string> = {
  su: '수귀', gaek: '객귀', gul: '굶주린 넋', jap: '잡귀잡신', eok: '억울귀', yeok: '역귀', mu: '무장 원귀', mong: '몽달·손각시',
};

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 소수 한 자리 문자열 */
export const f = (n: number): string => String(Math.round(n * 10) / 10);

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
const hex = (r: number, g: number, b: number): string =>
  `#${((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1)}`;

/** a 와 b 를 t(0 = a, 1 = b) 로 섞는다 */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return hex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** 한지 위에서 선으로 읽히도록 밝은 색은 어둡게 */
export function lineColor(c: string): string {
  const [r, g, b] = rgb(c);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? mix(c, INK, 0.45) : c;
}

/** 그리기 맥락 — 난수, 강조색, 세밀도(0 작은 카드 · 1 큰 그림) */
export interface Ctx {
  r: Rng;
  acc: string | null;
  accLine: string;
  lod: 0 | 1;
  /** 현재 좌표계에서 기본 선 굵기 */
  sw: number;
}

export const jit = (c: Ctx, a: number): number => (c.r() - 0.5) * 2 * a;

/** 떨리는 꺾은선(닫으면 도형). 마디마다 가운데를 살짝 휘게 한다 */
export function wob(c: Ctx, pts: P2[], closed = false, amp = 1.2): string {
  const p = pts.map(([x, y]) => [x + jit(c, amp * 0.35), y + jit(c, amp * 0.35)] as P2);
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  const n = closed ? p.length : p.length - 1;
  for (let i = 0; i < n; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const k = jit(c, amp) * Math.min(1, len / 30);
    const mx = (a[0] + b[0]) / 2 - (dy / len) * k;
    const my = (a[1] + b[1]) / 2 + (dx / len) * k;
    d += ` Q${f(mx)} ${f(my)} ${f(b[0])} ${f(b[1])}`;
  }
  return closed ? `${d} Z` : d;
}

export interface PathOpt {
  fill?: string;
  stroke?: string;
  w?: number;
  op?: number;
  fop?: number;
  dash?: string;
  extra?: string;
}

export function path(d: string, o: PathOpt = {}): string {
  let a = `<path d="${d}"`;
  if (o.fill) a += ` fill="${o.fill}"`;
  if (o.fop !== undefined) a += ` fill-opacity="${f(o.fop)}"`;
  if (o.stroke) a += ` stroke="${o.stroke}"`;
  if (o.w !== undefined) a += ` stroke-width="${f(o.w)}"`;
  if (o.op !== undefined) a += ` opacity="${f(o.op)}"`;
  if (o.dash) a += ` stroke-dasharray="${o.dash}"`;
  if (o.extra) a += ` ${o.extra}`;
  return `${a}/>`;
}

/** 손그림 도형: 채움 + 먹선. 큰 그림이면 살짝 어긋난 두 번째 선을 겹친다 */
export function shape(c: Ctx, pts: P2[], fill: string, o: { w?: number; closed?: boolean; amp?: number; stroke?: string } = {}): string {
  const closed = o.closed ?? true;
  const d = wob(c, pts, closed, o.amp ?? 1.2);
  const w = o.w ?? c.sw;
  let s = path(d, { fill: closed ? fill : 'none', stroke: o.stroke ?? INK, w });
  if (c.lod && closed && w > 0) s += path(wob(c, pts, closed, (o.amp ?? 1.2) * 1.4), { stroke: o.stroke ?? INK, w: w * 0.45, op: 0.35 });
  return s;
}

export function line(c: Ctx, pts: P2[], o: { w?: number; stroke?: string; op?: number; amp?: number; dash?: string } = {}): string {
  return path(wob(c, pts, false, o.amp ?? 1), { stroke: o.stroke ?? INK, w: o.w ?? c.sw, op: o.op, dash: o.dash });
}

export function ell(c: Ctx, cx: number, cy: number, rx: number, ry: number, fill: string, o: { w?: number; stroke?: string; op?: number; rot?: number } = {}): string {
  const rot = (o.rot ?? 0) + jit(c, 4);
  const w = o.w ?? c.sw;
  return `<ellipse cx="${f(cx + jit(c, 0.3))}" cy="${f(cy + jit(c, 0.3))}" rx="${f(rx * (1 + jit(c, 0.04)))}" ry="${f(ry * (1 + jit(c, 0.04)))}" transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})" fill="${fill}"${w > 0 ? ` stroke="${o.stroke ?? INK}" stroke-width="${f(w)}"` : ''}${o.op !== undefined ? ` opacity="${f(o.op)}"` : ''}/>`;
}

export const g = (inner: string, tf: string, extra = ''): string => `<g transform="${tf}"${extra ? ` ${extra}` : ''}>${inner}</g>`;

/** 점 p 를 (ox,oy) 둘레로 deg 만큼 돌린다 */
export function rot(p: P2, deg: number, o: P2 = [0, 0]): P2 {
  const a = (deg * Math.PI) / 180;
  const x = p[0] - o[0];
  const y = p[1] - o[1];
  return [o[0] + x * Math.cos(a) - y * Math.sin(a), o[1] + x * Math.sin(a) + y * Math.cos(a)];
}
