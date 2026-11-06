// 붓·종이·나무 — 코드로 그리는 재료 도구 (Canvas 2D). 무대(PixiJS 텍스처)와 카드 삽화가 같은 도구를 쓴다.
// 좌표는 "무대 단위"로 그리고, 캔버스는 단위 × R 픽셀이다(R = 해상도). 같은 시드는 언제나 같은 그림을 낸다.

export type P = [number, number];
export type C2 = CanvasRenderingContext2D;

// ── 난수·잡음 ──────────────────────────────────────────────────────────
export function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 값 잡음(격자 + 부드러운 보간) */
export function noise2(seed: number): (x: number, y: number) => number {
  const N = 256;
  const r = rng(seed);
  const t = new Float32Array(N * N);
  for (let i = 0; i < t.length; i++) t[i] = r();
  const at = (x: number, y: number) => t[((y & (N - 1)) * N) + (x & (N - 1))];
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
    return a + (b - a) * sy;
  };
}

export function fbm(n: (x: number, y: number) => number, x: number, y: number, oct = 4): number {
  let v = 0;
  let a = 0.5;
  let f = 1;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    v += a * n(x * f, y * f);
    norm += a;
    a *= 0.5;
    f *= 2.03;
  }
  return v / norm;
}

// ── 색 ────────────────────────────────────────────────────────────────
export function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
export function hex([r, g, b]: [number, number, number]): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((1 << 24) | (c(r) << 16) | (c(g) << 8) | c(b)).toString(16).slice(1)}`;
}
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}
export function rgba(c: string, a: number): string {
  const [r, g, b] = rgb(c);
  return `rgba(${r},${g},${b},${a})`;
}
export const toNum = (c: string): number => parseInt(c.slice(1), 16);

/** 먹 · 한지 · 나무 */
export const INK = '#1a1712';
export const INK_SOFT = '#3a3128';
export const HANJI = '#ece3ca';
export const HANJI_DEEP = '#d8ccab';
export const WOOD_RAW = '#c9a477';
export const SKIN = '#f0e0c2';
export const CINNABAR = '#c33427';
export const GOLD = '#d6a640';

// ── 캔버스 ────────────────────────────────────────────────────────────
export interface Sheet {
  canvas: HTMLCanvasElement;
  ctx: C2;
  /** 단위 상자 [x0, y0, x1, y1] */
  box: [number, number, number, number];
  R: number;
}

/** 단위 상자 크기의 캔버스. ctx 는 단위 좌표로 그린다 */
export function sheet(box: [number, number, number, number], R: number): Sheet {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.ceil((box[2] - box[0]) * R));
  canvas.height = Math.max(2, Math.ceil((box[3] - box[1]) * R));
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(R, 0, 0, R, -box[0] * R, -box[1] * R);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return { canvas, ctx, box, R };
}

export function poly(ctx: C2, pts: P[], close = true): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}

/** 캣멀롬 곡선으로 점을 부드럽게 (닫힌 모양이면 close) */
export function smooth(pts: P[], seg = 6, close = false): P[] {
  const out: P[] = [];
  const n = pts.length;
  const at = (i: number): P => (close ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const last = close ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let k = 0; k < seg; k++) {
      const t = k / seg;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  if (!close) out.push(pts[n - 1]);
  return out;
}

/** 가장자리를 잘게 떨리게 (손으로 오린 한지·깎은 나무) */
export function roughen(pts: P[], amp: number, seed: number, step = 3): P[] {
  const r = rng(seed);
  const out: P[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(len / step));
    const nx = -(b[1] - a[1]) / (len || 1);
    const ny = (b[0] - a[0]) / (len || 1);
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const d = (r() - 0.5) * 2 * amp;
      out.push([a[0] + (b[0] - a[0]) * t + nx * d, a[1] + (b[1] - a[1]) * t + ny * d]);
    }
  }
  return out;
}

export function ellipsePts(cx: number, cy: number, rx: number, ry: number, n = 28, rot = 0): P[] {
  const out: P[] = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}

// ── 붓 ────────────────────────────────────────────────────────────────
export interface BrushOpt {
  w: number;
  color?: string;
  alpha?: number;
  /** 시작·끝 굵기 비 (0 = 뾰족) */
  taper?: [number, number];
  /** 굵기 떨림 */
  wobble?: number;
  /** 마른 붓: 0~1, 갈라진 결 */
  dry?: number;
  seed?: number;
  seg?: number;
}

/** 굵기가 변하는 붓 한 획 — 점들을 부드럽게 잇고 양옆으로 폭을 준 다각형을 칠한다 */
export function brush(ctx: C2, pts: P[], o: BrushOpt): void {
  if (pts.length < 2) return;
  const path = pts.length > 2 ? smooth(pts, o.seg ?? 5) : pts;
  const r = rng(o.seed ?? 7);
  const [t0, t1] = o.taper ?? [0.35, 0.15];
  const n = path.length;
  const left: P[] = [];
  const right: P[] = [];
  const wob = o.wobble ?? 0.15;
  let ph = r() * 6;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    // 붓의 누름: 시작에서 빠르게 차고 끝에서 빠진다
    const press = Math.min(1, t0 + (1 - t0) * Math.sin(Math.min(1, t * 3.2) * Math.PI * 0.5)) * Math.min(1, t1 + (1 - t1) * Math.sin(Math.min(1, (1 - t) * 2.6) * Math.PI * 0.5));
    ph += 0.35 + r() * 0.2;
    const w = (o.w / 2) * press * (1 + Math.sin(ph) * wob);
    left.push([path[i][0] + nx * w, path[i][1] + ny * w]);
    right.push([path[i][0] - nx * w, path[i][1] - ny * w]);
  }
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.fillStyle = o.color ?? INK;
  poly(ctx, [...left, ...right.reverse()]);
  ctx.fill();
  if (o.dry) {
    // 마른 붓: 획 안을 가로지르는 가는 빈 줄
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = o.w * 0.08;
    for (let k = 0; k < 4; k++) {
      const off = (r() - 0.5) * o.w * 0.7;
      const from = Math.floor(n * (0.3 + r() * 0.4));
      ctx.globalAlpha = o.dry * (0.4 + r() * 0.5);
      ctx.beginPath();
      for (let i = from; i < n; i++) {
        const a = path[Math.max(0, i - 1)];
        const b = path[Math.min(n - 1, i + 1)];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const x = path[i][0] - ((b[1] - a[1]) / len) * off;
        const y = path[i][1] + ((b[0] - a[0]) / len) * off;
        if (i === from) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** 먹선 윤곽 (닫힌 모양): 두 번 겹쳐 그어 손맛을 낸다 */
export function inkOutline(ctx: C2, pts: P[], w: number, seed: number, color = INK, alpha = 1): void {
  const r = rng(seed);
  ctx.save();
  ctx.strokeStyle = color;
  for (let pass = 0; pass < 2; pass++) {
    ctx.globalAlpha = alpha * (pass ? 0.45 : 0.9);
    ctx.lineWidth = w * (pass ? 0.6 : 1);
    const j = pass ? 0.35 : 0;
    poly(ctx, pts.map(([x, y]) => [x + (r() - 0.5) * j, y + (r() - 0.5) * j] as P));
    ctx.stroke();
  }
  ctx.restore();
}

// ── 재료: 채색 목인(꼭두) ─────────────────────────────────────────────
export interface WoodOpt {
  seed: number;
  /** 깎은 면: 더 어둡게 칠할 다각형들 */
  facets?: P[][];
  /** 결 방향(라디안, 0 = 세로) */
  grain?: number;
  /** 칠이 벗겨진 정도 0~1 */
  wear?: number;
  outline?: number;
  /** 빛: 위왼쪽에서 (넋등) */
  light?: number;
  noOutline?: boolean;
}

/** 칠한 나무 조각: 바탕색 → 깎은 면 그늘 → 나뭇결 → 빗각(위왼쪽 밝게·아래오른쪽 어둡게) → 닳은 모서리 → 먹선 */
export function woodPiece(ctx: C2, pts: P[], color: string, o: WoodOpt, decorate?: (ctx: C2) => void): void {
  const r = rng(o.seed);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  ctx.save();
  poly(ctx, pts);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.clip();
  // 넋등 빛: 위왼쪽이 밝고 아래오른쪽이 어둡다
  const lg = ctx.createLinearGradient(x0, y0, x1, y1);
  lg.addColorStop(0, `rgba(255,236,200,${0.22 * (o.light ?? 1)})`);
  lg.addColorStop(0.55, 'rgba(255,236,200,0)');
  lg.addColorStop(1, 'rgba(20,10,5,0.28)');
  ctx.fillStyle = lg;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // 깎은 면
  for (const f of o.facets ?? []) {
    ctx.fillStyle = 'rgba(30,15,8,0.16)';
    poly(ctx, f);
    ctx.fill();
  }
  if (decorate) decorate(ctx);
  // 나뭇결 (칠 아래로 비친다)
  const ga = o.grain ?? 0;
  const ca = Math.cos(ga);
  const sa = Math.sin(ga);
  const span = Math.max(x1 - x0, y1 - y0) * 1.5;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  ctx.lineWidth = 0.35;
  for (let k = 0; k < 26; k++) {
    const off = (r() - 0.5) * span;
    const amp = 0.6 + r() * 1.6;
    const fr = 0.05 + r() * 0.08;
    ctx.strokeStyle = `rgba(${r() < 0.5 ? '70,38,14' : '255,226,180'},${0.05 + r() * 0.07})`;
    ctx.beginPath();
    for (let s = -span / 2; s <= span / 2; s += 2) {
      const u = off + Math.sin(s * fr + k) * amp;
      const x = cx + u * ca - s * sa;
      const y = cy + u * sa + s * ca;
      if (s === -span / 2) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // 칠 얼룩
  for (let k = 0; k < 18; k++) {
    ctx.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,240,210'},${0.025 + r() * 0.03})`;
    ctx.beginPath();
    ctx.ellipse(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), 2 + r() * 6, 1 + r() * 3, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // 빗각: 모양을 어긋나게 그어 안쪽 가장자리에 빛과 그늘을 남긴다(깎은 나무의 모서리)
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(255,240,205,0.45)';
  ctx.save();
  ctx.translate(0.9, 0.9);
  poly(ctx, pts);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(25,12,5,0.45)';
  ctx.save();
  ctx.translate(-1.1, -1.1);
  poly(ctx, pts);
  ctx.stroke();
  ctx.restore();
  // 닳은 모서리: 칠이 벗겨져 맨나무가 보인다
  const wear = o.wear ?? 0.5;
  ctx.strokeStyle = WOOD_RAW;
  for (let i = 0; i < pts.length; i++) {
    if (r() > wear * 0.6) continue;
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const t = r();
    const L = 0.08 + r() * 0.2;
    ctx.globalAlpha = 0.35 + r() * 0.4;
    ctx.lineWidth = 0.8 + r() * 1.4;
    ctx.beginPath();
    ctx.moveTo(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
    ctx.lineTo(a[0] + (b[0] - a[0]) * Math.min(1, t + L), a[1] + (b[1] - a[1]) * Math.min(1, t + L));
    ctx.stroke();
  }
  ctx.restore();
  if (!o.noOutline) inkOutline(ctx, pts, o.outline ?? 1.5, o.seed + 1);
}

// ── 재료: 한지 ────────────────────────────────────────────────────────
export interface PaperOpt {
  seed: number;
  color?: string;
  /** 섬유 밀도 */
  fibers?: number;
  /** 가장자리 번짐(젖음·그을림) */
  edge?: string;
  edgeW?: number;
  outline?: string;
  /** 위에서 아래로 젖은 얼룩 (0 = 없음) */
  damp?: number;
  dampColor?: string;
  alpha?: number;
}

export function paperPiece(ctx: C2, pts: P[], o: PaperOpt, decorate?: (ctx: C2) => void): void {
  const r = rng(o.seed);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 0.96;
  poly(ctx, pts);
  ctx.fillStyle = o.color ?? HANJI;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.clip();
  // 얼룩진 한지: 부드러운 명암
  for (let k = 0; k < 14; k++) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    const dark = r() < 0.5;
    g.addColorStop(0, dark ? 'rgba(120,100,70,0.07)' : 'rgba(255,252,240,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.translate(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0));
    const s = 6 + r() * 18;
    ctx.scale(s, s * (0.5 + r()));
    ctx.fillStyle = g;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }
  if (o.damp) {
    const g = ctx.createLinearGradient(0, y0 + (y1 - y0) * (1 - o.damp), 0, y1);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, rgba(o.dampColor ?? '#5b6f80', 0.5));
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  if (decorate) decorate(ctx);
  // 닥 섬유
  const nf = Math.round(((x1 - x0) * (y1 - y0)) / 18 * (o.fibers ?? 1));
  for (let k = 0; k < nf; k++) {
    const x = x0 + r() * (x1 - x0);
    const y = y0 + r() * (y1 - y0);
    const a = r() * Math.PI;
    const L = 2 + r() * 6;
    ctx.strokeStyle = r() < 0.6 ? `rgba(150,130,95,${0.08 + r() * 0.12})` : `rgba(255,255,248,${0.2 + r() * 0.2})`;
    ctx.lineWidth = 0.18 + r() * 0.25;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + (r() - 0.5) * 2, y + Math.sin(a) * L * 0.5 + (r() - 0.5) * 2, x + Math.cos(a) * L, y + Math.sin(a) * L);
    ctx.stroke();
  }
  // 가장자리 번짐
  if (o.edge) {
    ctx.strokeStyle = o.edge;
    ctx.lineWidth = o.edgeW ?? 5;
    ctx.filter = 'blur(1.5px)';
    poly(ctx, pts);
    ctx.stroke();
    ctx.filter = 'none';
  }
  ctx.restore();
  // 오린 가장자리: 가는 회갈색 선
  ctx.save();
  ctx.strokeStyle = o.outline ?? 'rgba(110,98,78,0.75)';
  ctx.lineWidth = 0.7;
  poly(ctx, pts);
  ctx.stroke();
  ctx.restore();
}

/** 구멍 뚫기(오림: 눈·칼집선·마름모 무늬) */
export function cut(ctx: C2, draw: (ctx: C2) => void): void {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  draw(ctx);
  ctx.restore();
}

/** 수묵 번짐: 부드러운 덩어리(겹쳐 칠하면 먹이 번진 하늘·산) */
export function washBlob(ctx: C2, cx: number, cy: number, rx: number, ry: number, color: string, alpha: number): void {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.6, rgba(color, alpha * 0.5));
  g.addColorStop(1, rgba(color, 0));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 화면 크기 한지 결 (곱하기로 덮는 반복 무늬) — 섬유 + 잔 얼룩, 거의 흰색 */
export function hanjiTile(size: number, seed: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fbf6ea';
  ctx.fillRect(0, 0, size, size);
  const n = noise2(seed);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 반복 이음매가 보이지 않게 잡음 격자를 size 로 감는다
      const u = (x / size) * 16;
      const v = (y / size) * 16;
      const a = fbm((xx, yy) => n(((xx % 16) + 16) % 16, ((yy % 16) + 16) % 16), u, v, 3);
      const k = (y * size + x) * 4;
      const m = 0.93 + a * 0.07;
      d[k] = 251 * m;
      d[k + 1] = 246 * m;
      d[k + 2] = 234 * m;
    }
  }
  ctx.putImageData(img, 0, 0);
  const r = rng(seed + 3);
  for (let k = 0; k < size * 1.6; k++) {
    const x = r() * size;
    const y = r() * size;
    const a = r() * Math.PI * 2;
    const L = 3 + r() * 14;
    ctx.strokeStyle = r() < 0.75 ? `rgba(140,118,84,${0.05 + r() * 0.08})` : `rgba(255,255,255,${0.25 + r() * 0.25})`;
    ctx.lineWidth = 0.4 + r() * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + (r() - 0.5) * 5, y + Math.sin(a) * L * 0.5 + (r() - 0.5) * 5, x + Math.cos(a) * L, y + Math.sin(a) * L);
    ctx.stroke();
  }
  return c;
}

/** 부드러운 원(빛·그림자·안개 조각) */
export function softDisc(size: number, color: string, inner = 0, outerAlpha = 0): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.5 * inner, size / 2, size / 2, size / 2);
  g.addColorStop(0, rgba(color, 1));
  g.addColorStop(0.45, rgba(color, 0.55));
  g.addColorStop(1, rgba(color, outerAlpha));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}
