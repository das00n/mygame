// 효과 글리프·배경 겹. 모두 화면 좌표(viewBox 160×100). 피 대신 먹 획·종이 구김·고리·도장으로 그린다.
import { CIN, type Ctx, DARK, INK, INK2, LAMP, type P2, PAPER, WASH, ell, f, g, jit, line, mix, path, shape, wob } from './draw.ts';

export interface Geo {
  /** 무구 끝(출발점) */
  S: P2;
  /** 영웅 가슴 */
  H: P2;
  /** 영웅 머리 위 */
  Htop: P2;
  /** 대상(원귀 가슴·굿상 위·동료 가슴) */
  T: P2[];
  /** 대상 머리 */
  Th: P2[];
  /** 대상 배율(원귀 크기) */
  ts: number;
  /** 지켜지는 쪽(가림막 위치) */
  W: P2[];
  /** 자리 바꿈 두 점 */
  X: [P2, P2] | null;
  ground: number;
}

const arrowHead = (c: Ctx, p: P2, dir: P2, col: string): string => {
  const len = Math.hypot(dir[0], dir[1]) || 1;
  const ux = dir[0] / len;
  const uy = dir[1] / len;
  const a: P2 = [p[0] - ux * 4 - uy * 2.6, p[1] - uy * 4 + ux * 2.6];
  const b: P2 = [p[0] - ux * 4 + uy * 2.6, p[1] - uy * 4 - ux * 2.6];
  return path(`M${f(a[0])} ${f(a[1])} L${f(p[0])} ${f(p[1])} L${f(b[0])} ${f(b[1])}`, { stroke: col, w: c.sw * 1.1 });
};

export function fx(c: Ctx, kind: string, G: Geo): string {
  const A = c.accLine;
  const sw = c.sw;
  const T = G.T.length ? G.T : [[G.S[0] + 34, G.S[1]] as P2];
  const k = G.ts / 0.5;
  let s = '';
  switch (kind) {
    case 'thread':
      for (const t of T) {
        const mx = (G.S[0] + t[0]) / 2;
        const my = Math.min(G.S[1], t[1]) - 12 - c.r() * 6;
        s += path(`M${f(G.S[0])} ${f(G.S[1])} Q${f(mx)} ${f(my)} ${f(t[0])} ${f(t[1])}`, { stroke: A, w: sw * 1.1, dash: '3 2' });
        s += ell(c, t[0], t[1], 2.2, 2.2, A, { w: 0 });
      }
      break;
    case 'burst':
      for (const t of T) {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + jit(c, 0.3);
          const r1 = 7 * k;
          const r2 = (12 + c.r() * 4) * k;
          s += line(c, [[t[0] + Math.cos(a) * r1, t[1] + Math.sin(a) * r1], [t[0] + Math.cos(a) * r2, t[1] + Math.sin(a) * r2]], { w: sw * (i % 2 ? 0.8 : 1.3) });
        }
        for (let i = 0; i < 3; i++) s += `<circle cx="${f(t[0] + jit(c, 13 * k))}" cy="${f(t[1] + jit(c, 11 * k))}" r="${f((0.8 + c.r()) * k)}" fill="${INK}"/>`;
      }
      break;
    case 'slash':
      for (const t of T.slice(0, 3)) {
        const r = 16 * k;
        const a: P2 = [t[0] - r, t[1] - r * 0.9];
        const b: P2 = [t[0] + r * 0.9, t[1] + r * 0.8];
        const m1: P2 = [t[0] - r * 0.1, t[1] - r * 0.35];
        const m2: P2 = [t[0] + r * 0.2, t[1] - r * 0.1];
        s += path(`M${f(a[0])} ${f(a[1])} Q${f(m1[0])} ${f(m1[1])} ${f(b[0])} ${f(b[1])} Q${f(m2[0])} ${f(m2[1])} ${f(a[0])} ${f(a[1])} Z`, { fill: INK, stroke: INK, w: sw * 0.5, op: 0.85 });
        s += line(c, [[t[0] - r * 0.6, t[1] + r * 0.2], [t[0] + r * 0.3, t[1] + r * 0.6]], { w: sw * 0.5, stroke: INK2 });
      }
      break;
    case 'seal':
      for (const t of T) {
        const z = 5.5 * Math.max(0.8, k);
        const rr = jit(c, 14);
        const col = c.acc ?? CIN;
        s += g(`<rect x="${f(-z)}" y="${f(-z)}" width="${f(z * 2)}" height="${f(z * 2)}" fill="${col}" opacity=".9"/>` +
          path(`M${f(-z * 0.5)} ${f(-z * 0.5)} L${f(z * 0.5)} ${f(-z * 0.5)} M0 ${f(-z * 0.6)} L0 ${f(z * 0.6)} M${f(-z * 0.5)} ${f(z * 0.3)} L${f(z * 0.5)} ${f(z * 0.5)}`, { stroke: PAPER, w: sw * 0.9 }),
        `translate(${f(t[0])} ${f(t[1])}) rotate(${f(rr)})`);
      }
      break;
    case 'smoke': {
      const [x, y] = G.S;
      for (let i = 0; i < 3; i++) {
        const x0 = x - 4 + i * 4;
        s += path(`M${f(x0)} ${f(y)} q${f(-5 + jit(c, 2))} -6 0 -11 q${f(5 + jit(c, 2))} -5 0 -11 q-4 -4 1 -9`, { stroke: INK2, w: sw * (1.1 - i * 0.2), op: 0.6 });
      }
      break;
    }
    case 'light': {
      for (const t of T.slice(0, 2)) {
        s += `<circle cx="${f(t[0])}" cy="${f(t[1])}" r="${f(13 * k)}" fill="${c.acc ?? LAMP}" opacity=".16"/>`;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + jit(c, 0.15);
          const r1 = 6 * k;
          const r2 = (11 + (i % 2) * 5) * k;
          s += path(`M${f(t[0] + Math.cos(a) * r1)} ${f(t[1] + Math.sin(a) * r1)} L${f(t[0] + Math.cos(a) * r2)} ${f(t[1] + Math.sin(a) * r2)}`, { stroke: A, w: sw * 0.8, op: 0.85 });
        }
      }
      break;
    }
    case 'chain':
      for (const t of T) {
        const mx = (G.S[0] + t[0]) / 2;
        s += path(`M${f(G.S[0])} ${f(G.S[1])} Q${f(mx)} ${f(G.S[1] - 10 + jit(c, 4))} ${f(t[0] - 6 * k)} ${f(t[1])}`, { stroke: A, w: sw * 1.3 });
        for (const dy of [-8, 2, 12]) s += ell(c, t[0], t[1] + dy * k, 13 * k, 3.2 * k, 'none', { w: sw * 1.2, stroke: A, rot: -8 });
      }
      break;
    case 'ripple': {
      const [x, y] = G.S;
      for (let i = 1; i <= 3; i++) {
        const r = 5 + i * 5.5;
        s += path(`M${f(x + r * 0.5)} ${f(y - r * 0.86)} A${f(r)} ${f(r)} 0 0 1 ${f(x + r * 0.5)} ${f(y + r * 0.86)}`, { stroke: A, w: sw * (1.3 - i * 0.25) });
      }
      for (const h of G.Th) {
        s += ell(c, h[0], h[1], 9 * k, 3.4 * k, 'none', { w: sw * 0.8, stroke: A, op: 0.8 });
        s += ell(c, h[0], h[1] - 2 * k, 13 * k, 5 * k, 'none', { w: sw * 0.5, stroke: A, op: 0.6 });
      }
      break;
    }
    case 'shot':
      for (const t of T.slice(0, 1)) {
        s += path(`M${f(G.S[0])} ${f(G.S[1])} L${f(t[0])} ${f(t[1])}`, { stroke: INK, w: sw * 0.6, dash: '5 2' });
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const r = i % 2 ? 4 : 7;
          s += path(`M${f(G.S[0])} ${f(G.S[1])} l${f(Math.cos(a) * r)} ${f(Math.sin(a) * r)}`, { stroke: A, w: sw * 0.9 });
        }
        s += `<circle cx="${f(G.S[0])}" cy="${f(G.S[1])}" r="2.4" fill="${c.acc ?? LAMP}"/>`;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.3;
          s += path(`M${f(t[0])} ${f(t[1])} l${f(Math.cos(a) * 5 * k)} ${f(Math.sin(a) * 5 * k)}`, { stroke: INK, w: sw * 0.8 });
        }
      }
      break;
    case 'scatter': {
      const col = c.acc && c.acc === CIN ? CIN : INK;
      for (const t of T) {
        for (let i = 0; i < 9; i++) {
          const u = 0.35 + c.r() * 0.65;
          const px = G.S[0] + (t[0] - G.S[0]) * u + jit(c, 9 * u);
          const py = G.S[1] + (t[1] - G.S[1]) * u + jit(c, 10 * u);
          s += `<circle cx="${f(px)}" cy="${f(py)}" r="${f(0.7 + c.r() * 0.7)}" fill="${col}"/>`;
        }
      }
      break;
    }
    case 'paper': {
      const n = 3;
      const t = T[0];
      for (let i = 0; i < n; i++) {
        const u = 0.25 + i * 0.22;
        const px = G.S[0] + (t[0] - G.S[0]) * u + jit(c, 4);
        const py = Math.min(G.S[1], t[1]) - 10 - i * 4 + jit(c, 3);
        s += g(shape(c, [[-3, -5], [3, -5], [3, 5], [-3, 5]], mix(PAPER, '#e7cc78', 0.45), { amp: 0.4, w: sw * 0.7 }) + `<rect x="-1.3" y="1.4" width="2.6" height="2.6" fill="${c.acc ?? CIN}"/>` +
          line(c, [[0, -3.5], [0, 0.5]], { w: sw * 0.5, amp: 0.6 }), `translate(${f(px)} ${f(py)}) rotate(${f(jit(c, 30))})`);
      }
      break;
    }
    case 'ledger':
      for (const t of T) {
        for (let i = 0; i < 3; i++) {
          const x0 = t[0] - 5 * k + i * 5 * k;
          const pts: P2[] = [];
          for (let j = 0; j < 4; j++) pts.push([x0 + jit(c, 1.2 * k), t[1] - 13 * k + j * 8 * k]);
          s += line(c, pts, { w: sw * (1.4 - i * 0.2), amp: 1.4 });
        }
      }
      break;
    case 'crack':
      for (const t of T) {
        for (let i = 0; i < 2; i++) {
          const pts: P2[] = [[t[0] - 8 * k + i * 6 * k, t[1] - 14 * k]];
          for (let j = 1; j < 5; j++) pts.push([pts[0][0] + jit(c, 4 * k) + j * 1.5 * k, t[1] - 14 * k + j * 7 * k]);
          s += path(pts.map((p, j) => `${j ? 'L' : 'M'}${f(p[0])} ${f(p[1])}`).join(' '), { stroke: INK, w: sw * 0.8 });
          s += path(`M${f(pts[2][0])} ${f(pts[2][1])} l${f(4 * k)} ${f(2 * k)}`, { stroke: INK, w: sw * 0.5 });
        }
      }
      break;
    case 'ward':
      for (const w of G.W.length ? G.W : [G.H]) {
        const x = w[0] + 13;
        const y0 = w[1] - 22;
        const y1 = w[1] + 22;
        const d = `M${f(x)} ${f(y0)} Q${f(x + 12)} ${f(w[1])} ${f(x)} ${f(y1)} L${f(x - 3)} ${f(y1 - 2)} Q${f(x + 8)} ${f(w[1])} ${f(x - 3)} ${f(y0 + 2)} Z`;
        s += path(d, { fill: PAPER, fop: 0.7, stroke: A, w: sw * 1.1 });
        for (let i = 1; i < 4; i++) s += path(`M${f(x + 1)} ${f(y0 + i * 11)} l${f(5)} ${f(-1)}`, { stroke: A, w: sw * 0.5, op: 0.7 });
      }
      break;
    case 'swap':
      if (G.X) {
        const [a, b] = G.X;
        const top = Math.min(a[1], b[1]) - 16;
        s += path(`M${f(a[0])} ${f(a[1] - 6)} Q${f((a[0] + b[0]) / 2)} ${f(top)} ${f(b[0])} ${f(b[1] - 6)}`, { stroke: A, w: sw * 1.2 });
        s += arrowHead(c, [b[0], b[1] - 6], [b[0] - (a[0] + b[0]) / 2, b[1] - 6 - top], A);
        const bot = Math.max(a[1], b[1]) + 12;
        s += path(`M${f(b[0])} ${f(b[1] + 4)} Q${f((a[0] + b[0]) / 2)} ${f(bot)} ${f(a[0])} ${f(a[1] + 4)}`, { stroke: A, w: sw * 1.2 });
        s += arrowHead(c, [a[0], a[1] + 4], [a[0] - (a[0] + b[0]) / 2, a[1] + 4 - bot], A);
      }
      break;
    case 'petals': {
      const t = T[0];
      for (let i = 0; i < 7; i++) {
        const u = 0.15 + (i / 7) * 0.85;
        const px = G.S[0] + (t[0] - G.S[0]) * u + jit(c, 6);
        const py = G.S[1] + (t[1] - G.S[1]) * u - 8 * Math.sin(u * Math.PI) + jit(c, 6);
        s += ell(c, px, py, 2.6, 1.5, PAPER, { w: sw * 0.6, stroke: A, rot: c.r() * 180 });
      }
      break;
    }
    case 'wind': {
      const t = T[Math.floor(T.length / 2)];
      for (let i = 0; i < 3; i++) {
        const y0 = G.S[1] - 6 + i * 6;
        const y1 = t[1] - 10 + i * 9;
        s += path(`M${f(G.S[0])} ${f(y0)} C${f(G.S[0] + 20)} ${f(y0 - 10)} ${f(t[0] - 30)} ${f(y1 + 10)} ${f(t[0] - 8)} ${f(y1)} q6 -3 3 -7`, { stroke: i === 1 ? A : INK2, w: sw * (i === 1 ? 1.1 : 0.7) });
      }
      break;
    }
    case 'swirl': {
      const [x, y] = G.H;
      for (let i = 0; i < 3; i++) {
        const yy = y - 18 + i * 16;
        const rx = 20 + i * 3;
        s += path(`M${f(x - rx)} ${f(yy)} A${f(rx)} ${f(6)} 0 0 0 ${f(x + rx)} ${f(yy - 2)}`, { stroke: i === 1 ? A : INK2, w: sw * (i === 1 ? 1.2 : 0.7) });
        s += arrowHead(c, [x + rx, yy - 2], [1, -1.2], i === 1 ? A : INK2);
      }
      break;
    }
    case 'beat': {
      const [x, y] = G.Htop;
      for (let i = 0; i < 5; i++) {
        const bx = x - 16 + i * 8;
        const by = y + 2 - Math.sin((i / 4) * Math.PI) * 5;
        const h = 4 + i * 1.4;
        const on = i < 3;
        s += `<rect x="${f(bx - 1.8)}" y="${f(by - h)}" width="3.6" height="${f(h)}" fill="${on ? (c.acc ?? INK) : 'none'}" stroke="${on ? A : INK2}" stroke-width="${f(sw * 0.6)}"/>`;
      }
      break;
    }
    case 'motes': {
      const t = T[0];
      for (let i = 0; i < 9; i++) {
        const px = t[0] + jit(c, 16);
        const py = t[1] - 4 - c.r() * 22;
        s += `<circle cx="${f(px)}" cy="${f(py)}" r="${f(0.8 + c.r() * 1.2)}" fill="${c.acc ?? LAMP}" opacity=".75"/>`;
      }
      break;
    }
    case 'flame': {
      const [x, y] = G.S;
      const col = c.acc ? mix(c.acc, PAPER, 0.2) : PAPER;
      s += path(`M${f(x - 4)} ${f(y)} Q${f(x - 6)} ${f(y - 10)} ${f(x)} ${f(y - 17)} Q${f(x + 1)} ${f(y - 9)} ${f(x + 5)} ${f(y - 10)} Q${f(x + 6)} ${f(y - 2)} ${f(x + 2)} ${f(y + 1)} Z`, { fill: col, stroke: INK, w: sw * 0.8 });
      s += path(`M${f(x - 1)} ${f(y - 2)} Q${f(x - 2)} ${f(y - 7)} ${f(x + 1)} ${f(y - 10)}`, { stroke: INK2, w: sw * 0.5 });
      if (T[0]) s += path(`M${f(x + 6)} ${f(y - 6)} Q${f((x + T[0][0]) / 2)} ${f(Math.min(y, T[0][1]) - 14)} ${f(T[0][0] - 6)} ${f(T[0][1])}`, { stroke: INK2, w: sw * 0.6, dash: '2 2' });
      break;
    }
    default:
      break;
  }
  return s;
}

// ── 배경 겹 ─────────────────────────────────────────────

export function backdrop(c: Ctx, kind: string, ground: number): string {
  const sw = c.sw;
  const faint = { stroke: INK2, w: sw * 0.7, op: 0.5 };
  let s = '';
  switch (kind) {
    case 'geumjul': {
      s += path(wob(c, [[-2, 5], [40, 10], [80, 8], [120, 11], [162, 6]], false, 1), { stroke: INK2, w: sw * 1.4, op: 0.75 });
      for (let x = 8; x < 160; x += 15) {
        const y = 9 + Math.sin(x / 25) * 1.5;
        s += path(`M${f(x)} ${f(y)} l2.4 3 l-2.4 3 l2.4 3`, { stroke: INK2, w: sw * 0.8, op: 0.7 });
        if (x % 30 === 23) s += `<circle cx="${f(x + 5)}" cy="${f(y + 2.4)}" r="1.1" fill="${DARK}" opacity=".7"/>`;
      }
      break;
    }
    case 'jihwa':
      for (const [x0, flip] of [[8, 1], [152, -1]] as [number, number][]) {
        for (let i = 0; i < 4; i++) {
          const fx0 = x0 + flip * (i % 2) * 6 + jit(c, 1.5);
          const fy0 = 10 + i * 9 + jit(c, 1.5);
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2;
            s += ell(c, fx0 + Math.sin(a) * 2.6, fy0 - Math.cos(a) * 2.6, 2.4, 1.6, PAPER, { w: sw * 0.5, stroke: INK2, rot: k * 72, op: 0.85 });
          }
        }
      }
      break;
    case 'moon':
      s += ell(c, 132, 16, 8, 8, PAPER, { w: sw * 0.7, stroke: INK2, op: 0.9 });
      s += path(wob(c, [[110, 26], [124, 24], [138, 27], [152, 25]], false, 1.2), { ...faint });
      break;
    case 'stars': {
      const st: P2[] = [[104, 14], [114, 11], [123, 13], [131, 17], [134, 26], [146, 27], [146, 18]];
      s += path(st.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])} ${f(p[1])}`).join(' '), { stroke: INK2, w: sw * 0.4, op: 0.5, dash: '1.5 1.5' });
      for (const [x, y] of st) s += `<circle cx="${f(x)}" cy="${f(y)}" r="1.4" fill="${INK2}"/>`;
      break;
    }
    case 'hills':
      s += path(`M-2 ${f(ground - 22)} Q30 ${f(ground - 42)} 62 ${f(ground - 26)} Q96 ${f(ground - 46)} 130 ${f(ground - 28)} Q148 ${f(ground - 36)} 162 ${f(ground - 30)}`, { ...faint, op: 0.4 });
      s += path(`M-2 ${f(ground - 12)} Q40 ${f(ground - 26)} 84 ${f(ground - 14)} Q120 ${f(ground - 24)} 162 ${f(ground - 12)}`, { ...faint, op: 0.32 });
      break;
    case 'water':
      for (let i = 0; i < 3; i++) {
        const y = ground + 2 + i * 3.4;
        s += path(wob(c, [[2, y], [40, y + 1], [80, y - 1], [120, y + 1], [158, y]], false, 1.6), { stroke: INK2, w: sw * 0.6, op: 0.45 });
      }
      for (let i = 0; i < 4; i++) s += line(c, [[4 + i * 3, ground], [2 + i * 3.6, ground - 14 - i * 2]], { w: sw * 0.5, stroke: INK2, op: 0.5 });
      break;
    case 'gate':
      s += shape(c, [[102, ground], [102, 22], [106, 22], [106, ground]], WASH, { amp: 0.4, w: sw * 0.6, stroke: INK2 });
      s += shape(c, [[150, ground], [150, 22], [154, 22], [154, ground]], WASH, { amp: 0.4, w: sw * 0.6, stroke: INK2 });
      s += path(wob(c, [[96, 22], [128, 16], [160, 22]], false, 0.8), { stroke: INK2, w: sw * 1.3, op: 0.6 });
      s += path(`M106 ${f(ground - 4)} L106 26 L150 26 L150 ${f(ground - 4)} M128 26 L128 ${f(ground - 4)}`, { stroke: INK2, w: sw * 0.4, op: 0.35 });
      break;
    case 'road':
      s += path(`M-2 ${f(ground + 9)} L60 ${f(ground + 1)} L162 ${f(ground - 6)} L162 ${f(ground - 2)} L64 ${f(ground + 4)} L-2 ${f(ground + 14)} Z`, { fill: PAPER, stroke: INK2, w: sw * 0.4, op: 0.85 });
      break;
    case 'village':
      for (const [x, w] of [[8, 30], [44, 24], [120, 34]] as P2[]) {
        s += path(`M${f(x)} ${f(ground - 10)} Q${f(x + w / 2)} ${f(ground - 26)} ${f(x + w)} ${f(ground - 10)} Z`, { fill: WASH, stroke: INK2, w: sw * 0.5, op: 0.6 });
      }
      break;
    case 'mat':
      for (let i = 0; i < 9; i++) s += line(c, [[i * 20 - 6, ground + 1], [i * 20 + 4, ground + 12]], { w: sw * 0.35, stroke: INK2, op: 0.45 });
      s += line(c, [[0, ground + 6], [160, ground + 6]], { w: sw * 0.35, stroke: INK2, op: 0.4 });
      break;
    case 'eaves':
      s += path(wob(c, [[-2, 18], [30, 12], [62, 4]], false, 0.6), { stroke: INK2, w: sw * 1.5, op: 0.6 });
      for (let i = 0; i < 6; i++) s += path(`M${f(2 + i * 10)} ${f(17 - i * 2.4)} q3 4 6 0`, { stroke: INK2, w: sw * 0.5, op: 0.6 });
      break;
    case 'night':
      s += `<rect x="0" y="0" width="160" height="34" fill="${INK}" opacity=".1"/><rect x="0" y="0" width="160" height="18" fill="${INK}" opacity=".1"/>`;
      break;
    default:
      break;
  }
  return s;
}

export function groundLine(c: Ctx, y: number): string {
  return path(wob(c, [[3, y], [50, y + 0.6], [110, y - 0.4], [157, y]], false, 1), { stroke: INK, w: c.sw * 0.9, op: 0.45 });
}

export function fibers(c: Ctx): string {
  let s = '';
  for (let i = 0; i < 9; i++) {
    const x = c.r() * 160;
    const y = c.r() * 100;
    s += path(`M${f(x)} ${f(y)} q${f(3 + c.r() * 3)} ${f(jit(c, 2))} ${f(6 + c.r() * 4)} ${f(jit(c, 2))}`, { stroke: '#8a7350', w: 0.4, op: 0.2 });
  }
  return s;
}
