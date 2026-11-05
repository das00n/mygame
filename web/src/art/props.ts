// 무구 그리기. 손에 든 것(h)은 손(0,0)에서 위(−y)로 뻗고, 몸에 붙은 것(b)은 몸 좌표, 장면 소품(s)은 바닥(0,0) 기준.
// 이름과 생김새의 근거는 tools/art/vocab.mjs 용어집(무속 지식 정리 §6)이다.
import { type Ctx, type P2, CIN, DARK, INK, INK2, LAMP, PAPER, WASH, WASH2, ell, f, g, jit, line, mix, path, shape, wob } from './draw.ts';

export const BODY_PROPS = new Set(['janggu', 'jakdu', 'hansam', 'hongcheollik', 'cheollik', 'gugunbok']);
export const SCENE_PROPS = new Set(['gutsang', 'beomjong', 'eopgyeongdae', 'crow', 'wipae', 'jihwa', 'jeonghwasu', 'bowls3', 'soban', 'drum', 'buk', 'rock', 'bush', 'hawk', 'tal3', 'geumjul', 'jusa', 'gilbe']);

/** 손에서 끝(초점)까지 길이 */
export const PROP_LEN: Record<string, number> = {
  bangul: 22, buchae: 34, jwilbuchae: 26, sinkal: 35, woldo: 70, samjichang: 60, obanggi: 48, myeongdo: 24, mubok: 26, cup: 8,
  chae: 24, jingchae: 22, jing: 26, jegeum: 8, taepyeongso: 34, piri: 18, gun: 52, kkojildae: 44, santan: 14, pouch: 14, yukhwanjang: 66,
  yeomju: 4, moktak: 10, scroll: 28, brush: 22, bujeok: 26, jineon: 26, whip: 28, staff: 16, gourd: 10, tal: 16, ora: 6, jeokpaeji: 30,
  bangmangi: 30, chain: 30, flower: 28, soji: 24, bowl: 6, rice: 4, beans: 4, salt: 4, mugwort: 22, neokjeon: 26, jijeon: 4, myeongju: 8,
  lamp: 28, olmu: 10,
};

const TALISMAN = mix(PAPER, '#e7cc78', 0.45);

/** 탈 얼굴 — 말뚝이(어두운 붉은 결)·양반(흰)·할미(검은). cx,cy 중심, 반지름 rx·ry */
export function mask(c: Ctx, kind: string, cx: number, cy: number, rx: number, ry: number): string {
  const fill = kind === 'halmi' ? DARK : kind === 'yangban' ? PAPER : mix(WASH2, '#8a3a2a', 0.35);
  const fe = kind === 'halmi' ? PAPER : INK;
  const sx = rx / 14;
  const sy = ry / 17;
  const P = (x: number, y: number): string => `${f(cx + x * sx)} ${f(cy + y * sy)}`;
  let s = ell(c, cx, cy, rx, ry, fill);
  if (kind === 'malttugi') {
    s += ell(c, cx + 5 * sx, cy - 4 * sy, 3.6 * sx, 3.2 * sy, PAPER, { w: c.sw * 0.6 }) + ell(c, cx - 5 * sx, cy - 4 * sy, 3.6 * sx, 3.2 * sy, PAPER, { w: c.sw * 0.6 });
    s += `<circle cx="${f(cx + 6 * sx)}" cy="${f(cy - 4 * sy)}" r="${f(1.6 * sx)}" fill="${INK}"/><circle cx="${f(cx - 4 * sx)}" cy="${f(cy - 4 * sy)}" r="${f(1.6 * sx)}" fill="${INK}"/>`;
    s += path(`M${P(-8, -10)} Q${P(-4, -13)} ${P(0, -10)} M${P(2, -10)} Q${P(6, -13)} ${P(10, -10)}`, { stroke: INK, w: c.sw * 1.1 });
    s += path(`M${P(-6, 7)} Q${P(1, 13)} ${P(8, 6)}`, { stroke: INK, w: c.sw * 0.9, fill: DARK });
    s += `<circle cx="${f(cx - 8 * sx)}" cy="${f(cy + 3 * sy)}" r="${f(1.2 * sx)}" fill="${INK}" opacity=".6"/><circle cx="${f(cx + 9 * sx)}" cy="${f(cy + 4 * sy)}" r="${f(1.1 * sx)}" fill="${INK}" opacity=".6"/>`;
  } else if (kind === 'yangban') {
    s += path(`M${P(-8, -4)} Q${P(-5, -7)} ${P(-2, -4)} M${P(3, -4)} Q${P(6, -7)} ${P(9, -4)}`, { stroke: fe, w: c.sw * 0.9 });
    s += path(`M${P(-6, 6)} Q${P(1, 11)} ${P(8, 6)}`, { stroke: fe, w: c.sw * 0.8 });
    s += path(`M${P(-1, 9)} L${P(0, 16)}`, { stroke: fe, w: c.sw * 0.6 });
    s += path(`M${P(-9, -11)} Q${P(0, -15)} ${P(9, -11)}`, { stroke: fe, w: c.sw * 0.5 });
  } else {
    s += `<circle cx="${f(cx - 4 * sx)}" cy="${f(cy - 4 * sy)}" r="${f(1.6 * sx)}" fill="${fe}"/><circle cx="${f(cx + 5 * sx)}" cy="${f(cy - 3 * sy)}" r="${f(1.6 * sx)}" fill="${fe}"/>`;
    s += path(`M${P(-9, -9)} Q${P(-5, -11)} ${P(-1, -9)} M${P(-10, 0)} Q${P(-6, 2)} ${P(-3, 0)} M${P(4, 1)} Q${P(7, 3)} ${P(10, 1)}`, { stroke: fe, w: c.sw * 0.5 });
    s += path(`M${P(-5, 8)} Q${P(0, 5)} ${P(6, 10)}`, { stroke: fe, w: c.sw * 0.9 });
  }
  return s;
}

/** 넋전 실루엣(작은 종이 사람) — 손에 든 넋전·넋 부르기·저주 상징에 함께 쓴다 */
export function paperFigure(c: Ctx, s: number, fill = PAPER): string {
  const d = wob(c, [[-6, -32], [-12, -20], [-9, -18], [-6, -24], [-6, -4], [-3, -1], [0, -4], [3, -1], [6, -4], [6, -24], [9, -18], [12, -20], [6, -32]], true, 0.5);
  return g(`${path(d, { fill, stroke: INK2, w: c.sw * 0.8 / s })}<circle cx="0" cy="-37" r="5" fill="${fill}" stroke="${INK2}" stroke-width="${f(c.sw * 0.8 / s)}"/><circle cx="-1.8" cy="-37.5" r=".9" fill="${INK}"/><circle cx="1.8" cy="-37.5" r=".9" fill="${INK}"/>`, `scale(${f(s)})`);
}

function stick(c: Ctx, y1: number, y2: number, w = 1.3, col = DARK): string {
  return line(c, [[0, y1], [jit(c, 0.6), y2]], { w: c.sw * w, stroke: col, amp: 0.4 });
}

function slip(c: Ctx, fill: string, w = 10, h = 26, y0 = -2): string {
  return shape(c, [[-w / 2, y0 - h], [w / 2, y0 - h], [w / 2, y0], [-w / 2, y0]], fill, { amp: 0.6, w: c.sw * 0.8 });
}

/** 부적 글씨 — 실제 부적 문자가 아닌 가상 획(시드마다 다름) */
export function script(c: Ctx, x: number, y0: number, h: number, col: string): string {
  const n = 4;
  const pts: P2[] = [];
  for (let i = 0; i <= n; i++) pts.push([x + jit(c, 2.2), y0 + (h * i) / n]);
  let s = line(c, pts, { w: c.sw * 0.9, stroke: col, amp: 1.4 });
  const yc = y0 + h * (0.3 + c.r() * 0.3);
  s += `<circle cx="${f(x)}" cy="${f(yc)}" r="${f(h * 0.1)}" fill="none" stroke="${col}" stroke-width="${f(c.sw * 0.7)}"/>`;
  s += line(c, [[x - 3, y0 + h * 0.75], [x + 3, y0 + h * 0.72]], { w: c.sw * 0.7, stroke: col });
  return s;
}

export function handProp(c: Ctx, key: string, maskKind = 'yangban'): string {
  const sw = c.sw;
  switch (key) {
    case 'bangul': {
      const n = c.lod ? 12 : 8;
      let s = stick(c, 5, -8, 1.2);
      for (let i = 0; i < 3; i++) s += line(c, [[0, 4], [-3 + i * 3 + jit(c, 1), 14 + jit(c, 2)]], { w: sw * 0.6, stroke: INK2 });
      for (let i = 0; i < n; i++) {
        const row = i < 5 ? 0 : i < 9 ? 1 : 2;
        const k = row === 0 ? i : row === 1 ? i - 5 : i - 9;
        const cnt = row === 0 ? 5 : row === 1 ? 4 : 3;
        const x = (k - (cnt - 1) / 2) * 4.6;
        s += ell(c, x, -11 - row * 4.2, 2.5, 2.5, WASH2, { w: sw * 0.6 });
      }
      return s;
    }
    case 'buchae': {
      const R = 30;
      const a1 = (-52 * Math.PI) / 180;
      const a2 = (52 * Math.PI) / 180;
      const p = (r: number, a: number): string => `${f(Math.sin(a) * r)} ${f(-4 - Math.cos(a) * r)}`;
      let s = stick(c, 5, -4, 1.3);
      s += path(`M${p(0, 0)} L${p(R, a1)} A${R} ${R} 0 0 1 ${p(R, a2)} Z`, { fill: PAPER, stroke: INK, w: sw });
      s += path(`M${p(R, a1)} A${R} ${R} 0 0 1 ${p(R, a2)} L${p(R * 0.72, a2)} A${R * 0.72} ${R * 0.72} 0 0 0 ${p(R * 0.72, a1)} Z`, { fill: WASH2, w: 0 });
      s += path(`M${p(R * 0.72, a1)} A${R * 0.72} ${R * 0.72} 0 0 1 ${p(R * 0.72, a2)} L${p(R * 0.48, a2)} A${R * 0.48} ${R * 0.48} 0 0 0 ${p(R * 0.48, a1)} Z`, { fill: WASH, w: 0 });
      for (let i = -2; i <= 2; i++) s += path(`M${p(0, 0)} L${p(R, (i * 25 * Math.PI) / 180)}`, { stroke: INK, w: sw * 0.4 });
      return s;
    }
    case 'jwilbuchae': {
      const R = 24;
      let s = stick(c, 4, -2, 1.1);
      const pts: P2[] = [[0, -2]];
      for (let i = 0; i <= 8; i++) {
        const a = ((-38 + i * 9.5) * Math.PI) / 180;
        const r = i % 2 ? R - 2 : R;
        pts.push([Math.sin(a) * r, -2 - Math.cos(a) * r]);
      }
      s += shape(c, pts, PAPER, { amp: 0.4, w: sw * 0.9 });
      for (let i = 1; i < 8; i++) {
        const a = ((-38 + i * 9.5) * Math.PI) / 180;
        s += path(`M0 -2 L${f(Math.sin(a) * R * 0.95)} ${f(-2 - Math.cos(a) * R * 0.95)}`, { stroke: INK2, w: sw * 0.35 });
      }
      return s;
    }
    case 'sinkal': {
      let s = '';
      for (let i = 0; i < 5; i++) {
        const ex = -6 + i * 3 + jit(c, 1.2);
        s += path(`M0 3 Q${f(ex * 0.6)} 10 ${f(ex)} ${f(17 + jit(c, 3))}`, { stroke: INK2, w: sw * 1.3 });
        s += path(`M0 3 Q${f(ex * 0.6)} 10 ${f(ex)} ${f(17 + jit(c, 3))}`, { stroke: PAPER, w: sw * 0.75 });
      }
      s += stick(c, 4, -7, 1.6);
      s += shape(c, [[-2.2, -7], [2.4, -7], [1.8, -29], [0.4, -35], [-1.7, -29]], PAPER, { amp: 0.4, w: sw * 0.9 });
      return s;
    }
    case 'woldo':
      return stick(c, 26, -48, 1.5) + shape(c, [[-2, -46], [5, -52], [8, -62], [4, -72], [1, -62], [-2, -56]], PAPER, { amp: 0.5, w: sw * 0.9 }) + ell(c, 0, -46, 2.4, 1.4, WASH2, { w: sw * 0.5 });
    case 'samjichang':
      return stick(c, 26, -46, 1.5) + line(c, [[-7, -46], [7, -46]], { w: sw }) + line(c, [[0, -46], [0, -60]], { w: sw * 1.1 }) +
        path(`M-7 -46 Q-8 -52 -6 -57 M7 -46 Q8 -52 6 -57`, { stroke: INK, w: sw * 1.1 }) + path('M-2 -58 L0 -62 L2 -58 M-8 -55 L-6 -59 L-4 -55 M4 -55 L6 -59 L8 -55', { stroke: INK, w: sw * 0.7 });
    case 'obanggi': {
      const fills = [PAPER, WASH, WASH2, mix(WASH2, INK, 0.3), mix(INK, WASH2, 0.35)];
      let s = '';
      for (let i = 0; i < 5; i++) {
        const a = -4 + i * 11;
        const r = (a * Math.PI) / 180;
        const tx = Math.sin(r) * 42;
        const ty = -Math.cos(r) * 42;
        s += line(c, [[0, 4], [tx, ty]], { w: sw * 0.8, stroke: DARK, amp: 0.4 });
        const fl: P2[] = [[tx, ty], [tx + 13, ty + 1 + jit(c, 2)], [tx + 12, ty + 8], [tx, ty + 7]];
        s += shape(c, fl, fills[i], { amp: 1.2, w: sw * 0.7 });
      }
      return s;
    }
    case 'myeongdo':
      return line(c, [[0, 0], [0, -7]], { w: sw * 0.6 }) + ell(c, 0, -15, 10, 10, WASH2) + ell(c, 0, -15, 7, 7, PAPER, { w: sw * 0.5 }) +
        path('M-3 -18 L1 -14 M-1 -20 L3 -16', { stroke: INK2, w: sw * 0.5 });
    case 'mubok': {
      const col = c.acc ? mix(c.acc, PAPER, 0.4) : WASH;
      return shape(c, [[0, 0], [-10, -6], [-16, -22], [-6, -30], [6, -28], [16, -20], [10, -6]], col, { amp: 2 }) + path('M-6 -28 Q0 -18 6 -28 M-8 -12 Q0 -8 8 -12', { stroke: INK, w: sw * 0.5 });
    }
    case 'cup':
      return shape(c, [[-4, -8], [4, -8], [3, -1], [-3, -1]], PAPER, { amp: 0.3, w: sw * 0.8 });
    case 'chae':
      return path(`M0 3 Q${f(1.5 + jit(c, 1))} -10 ${f(1 + jit(c, 1))} -24`, { stroke: DARK, w: sw * 0.9 });
    case 'jingchae':
      return stick(c, 3, -15, 1) + ell(c, 0, -19, 4, 4.5, WASH);
    case 'jing':
      return line(c, [[0, 0], [0, -6]], { w: sw * 0.7 }) + ell(c, 0, -17, 11, 11, WASH2) + ell(c, 0, -17, 8, 8, 'none', { w: sw * 0.4 }) + ell(c, 0, -17, 2.4, 2.4, WASH, { w: sw * 0.5 });
    case 'jegeum':
    case 'kkwaenggwari':
      return ell(c, 0, -4, 9, 3.2, WASH2) + ell(c, 0, -6, 2, 1.4, WASH, { w: sw * 0.5 });
    case 'taepyeongso':
      return shape(c, [[-1.2, 3], [1.2, 3], [2.4, -22], [-2.4, -22]], DARK, { amp: 0.3, w: sw * 0.7 }) +
        shape(c, [[-2.6, -22], [2.6, -22], [8, -33], [-8, -33]], WASH2, { amp: 0.6, w: sw * 0.8 }) +
        `<g fill="${PAPER}">${[-4, -9, -14].map((y) => `<circle cx="0" cy="${y}" r=".8"/>`).join('')}</g>`;
    case 'piri':
      return shape(c, [[-1.4, 3], [1.4, 3], [1.6, -16], [-1.6, -16]], WASH2, { amp: 0.3, w: sw * 0.7 }) + line(c, [[0, -16], [0, -19]], { w: sw * 0.8 });
    case 'gun':
      return shape(c, [[-3.4, 14], [3.4, 14], [2.6, -6], [-2, -6]], mix(DARK, WASH2, 0.3), { amp: 0.4, w: sw * 0.9 }) +
        line(c, [[0, -6], [0, -50]], { w: sw * 1.9, amp: 0.3 }) + line(c, [[0.6, -8], [0.6, -46]], { w: sw * 0.5, stroke: WASH, amp: 0.3 }) +
        path('M3 -2 q5 2 4 6 q-1 4 -5 3', { stroke: INK2, w: sw * 0.6 }) + `<circle cx="2" cy="7" r="1.1" fill="${c.acc ?? LAMP}"/>`;
    case 'hwayaktong':
      return shape(c, [[-4, 0], [-8, -10], [-4, -20], [2, -22], [3, -18], [-1, -12], [4, 0]], WASH2, { amp: 0.6 }) + ell(c, 2, -21, 2, 1.4, DARK, { w: sw * 0.5 });
    case 'kkojildae':
      return line(c, [[0, 4], [0, -44]], { w: sw * 0.7, stroke: DARK, amp: 0.3 }) + ell(c, 0, -44, 1.4, 1, DARK, { w: 0 });
    case 'santan':
    case 'pouch': {
      let s = shape(c, [[-6, -2], [-7, -10], [-3, -15], [3, -15], [7, -10], [6, -2]], WASH2, { amp: 0.8 });
      s += line(c, [[-3, -14], [3, -14]], { w: sw * 0.8 });
      if (key === 'santan') for (let i = 0; i < 4; i++) s += `<circle cx="${f(5 + i * 2.6)}" cy="${f(-3 + jit(c, 2))}" r="1.1" fill="${INK}"/>`;
      else s += slip(c, TALISMAN, 4, 8, -14) + g(slip(c, TALISMAN, 4, 7, -14), 'rotate(18 2 -14)');
      return s;
    }
    case 'yukhwanjang': {
      let s = stick(c, 40, -60, 1.3);
      s += ell(c, 0, -66, 6, 8, 'none', { w: sw * 0.9, stroke: mix(INK, WASH2, 0.3) });
      for (const [x, y] of [[-6, -61], [-7.5, -66], [-6, -71], [6, -61], [7.5, -66], [6, -71]] as P2[]) s += ell(c, x, y, 2.3, 2.3, 'none', { w: sw * 0.7, stroke: INK });
      return s;
    }
    case 'yeomju': {
      let s = '';
      const n = c.lod ? 16 : 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        s += `<circle cx="${f(Math.sin(a) * 6)}" cy="${f(9 - Math.cos(a) * 9)}" r="1.5" fill="${DARK}"/>`;
      }
      return s + line(c, [[0, 18], [0, 24]], { w: sw * 0.8, stroke: INK2 });
    }
    case 'moktak':
      return ell(c, 0, -6, 8, 6.5, WASH2) + path('M-5 -6 Q0 -2 5 -6', { stroke: INK, w: sw * 0.8 }) + ell(c, 6, -10, 2, 2, WASH2, { w: sw * 0.5 });
    case 'scroll': {
      let s = slip(c, PAPER, 11, 28, -2);
      s += ell(c, 0, -30, 6.5, 1.8, WASH, { w: sw * 0.6 }) + ell(c, 0, -2, 6.5, 1.8, WASH, { w: sw * 0.6 });
      for (const x of [-3, 0, 3]) s += line(c, [[x, -26], [x + jit(c, 0.5), -6]], { w: sw * 0.45, stroke: INK2, amp: 0.8, dash: '2 1.2' });
      return s;
    }
    case 'brush':
      return stick(c, 4, -16, 0.9) + path('M-1.6 -16 Q0 -24 1.6 -16 Z', { fill: INK, stroke: INK, w: sw * 0.4 });
    case 'bujeok':
      return slip(c, TALISMAN) + script(c, 0, -25, 20, INK) + `<rect x="-2.2" y="-6.6" width="4.4" height="4.4" fill="${c.acc ?? CIN}" opacity=".85"/>`;
    case 'jineon': {
      let s = slip(c, PAPER);
      s += `<circle cx="0" cy="-17" r="3.8" fill="none" stroke="${INK}" stroke-width="${f(sw * 0.7)}"/>`;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        s += path(`M${f(Math.sin(a) * 3.8)} ${f(-17 - Math.cos(a) * 3.8)} L${f(Math.sin(a) * 1.4)} ${f(-17 - Math.cos(a) * 1.4)}`, { stroke: INK, w: sw * 0.4 });
      }
      return s + line(c, [[0, -11], [0, -5]], { w: sw * 0.6, amp: 0.6 });
    }
    case 'whip':
      return stick(c, 3, -12, 1.1) + path(`M0 -12 Q6 -18 4 -24 Q2 -28 8 -30`, { stroke: INK, w: sw * 0.6 });
    case 'staff':
      return stick(c, 40, -12, 1.3) + path('M0 -12 Q0 -18 5 -18 Q8 -17 7 -14', { stroke: DARK, w: sw * 1.3 });
    case 'gourd':
      return path(`M-7 -6 Q0 5 7 -6 Z`, { fill: WASH, stroke: INK, w: sw }) + line(c, [[6, -6], [11, -12]], { w: sw * 0.9 });
    case 'tal':
      return mask(c, maskKind, 0, -10, 7, 9);
    case 'ora': {
      const col = c.accLine;
      return [0, 1, 2].map((i) => ell(c, 0, -2 - i * 2, 6, 2.6, 'none', { w: sw * 1.1, stroke: col })).join('') + path('M5 -2 q6 4 4 10', { stroke: col, w: sw * 1.1 });
    }
    case 'jeokpaeji': {
      let s = slip(c, mix(c.acc ?? CIN, PAPER, 0.5), 12, 30, -2);
      for (const x of [-3, 0, 3]) s += line(c, [[x, -28], [x, -12]], { w: sw * 0.5, stroke: INK, amp: 0.9 });
      return s + `<rect x="-3" y="-9" width="6" height="5" fill="none" stroke="${INK}" stroke-width="${f(sw * 0.6)}"/>`;
    }
    case 'bangmangi':
      return stick(c, 4, -8, 1.3) + shape(c, [[-1.6, -8], [1.6, -8], [3.2, -30], [-3.2, -30]], mix(DARK, WASH2, 0.4), { amp: 0.4, w: sw * 0.8 }) +
        line(c, [[0, -9], [0, -29]], { w: sw * 0.4, stroke: WASH }) + path('M0 4 q-4 4 0 8 q4 -2 0 -8', { stroke: INK2, w: sw * 0.5 });
    case 'chain': {
      let s = '';
      for (let i = 0; i < 7; i++) s += ell(c, jit(c, 0.6), -i * 4.4, i % 2 ? 1.4 : 2.4, i % 2 ? 2.6 : 1.6, 'none', { w: sw * 0.7, stroke: INK2 });
      return s;
    }
    case 'flower': {
      let s = path(`M0 3 Q2 -8 0 -18`, { stroke: DARK, w: sw * 0.8 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        s += ell(c, Math.sin(a) * 4, -22 - Math.cos(a) * 4, 3.4, 2.4, PAPER, { w: sw * 0.6, rot: (i * 60) });
      }
      return s + `<circle cx="0" cy="-22" r="1.6" fill="${c.acc ?? WASH2}"/>`;
    }
    case 'soji':
      return slip(c, PAPER, 9, 16, -1) + path('M-2.5 -17 Q0 -27 2.5 -17 Q0 -14 -2.5 -17 Z', { fill: mix(c.acc ?? LAMP, PAPER, 0.25), stroke: INK, w: sw * 0.5 });
    case 'bowl':
      return path('M-7 -5 Q0 4 7 -5 Z', { fill: PAPER, stroke: INK, w: sw * 0.9 }) + path('M-5 -5 Q0 -9 5 -5', { fill: PAPER, stroke: INK2, w: sw * 0.5 });
    case 'rice':
    case 'salt':
    case 'beans':
      return ell(c, 0, -3, 4.5, 2.6, key === 'beans' ? (c.acc ?? CIN) : PAPER, { w: sw * 0.6 });
    case 'mugwort': {
      let s = '';
      for (let i = 0; i < 6; i++) s += path(`M0 4 Q${f(-4 + i * 1.6)} -8 ${f(-6 + i * 2.4 + jit(c, 1))} ${f(-20 + jit(c, 2))}`, { stroke: mix(INK2, WASH2, 0.3), w: sw * 0.7 });
      return s + line(c, [[-2, 0], [2, 0]], { w: sw * 0.9 });
    }
    case 'neokjeon':
      return g(paperFigure(c, 0.62), 'translate(0 -2)');
    case 'jijeon': {
      let s = '';
      for (let k = 0; k < 3; k++) {
        const x0 = -4 + k * 4;
        s += line(c, [[x0, 0], [x0 + jit(c, 1), 22]], { w: sw * 0.4, stroke: INK2 });
        for (let i = 0; i < 4; i++) s += `<circle cx="${f(x0 + jit(c, 0.6))}" cy="${f(4 + i * 5)}" r="1.9" fill="${PAPER}" stroke="${INK2}" stroke-width="${f(sw * 0.4)}"/>`;
      }
      return s;
    }
    case 'myeongju':
      return ell(c, 0, -5, 6.5, 4, PAPER) + path('M-5 -6 Q0 -2 5 -6 M-5 -4 Q0 0 5 -4', { stroke: INK2, w: sw * 0.4 });
    case 'lamp': {
      const glow = c.acc ?? LAMP;
      return line(c, [[0, 6], [0, -22]], { w: sw * 0.9, stroke: DARK }) + path('M0 -22 Q4 -24 6 -20', { stroke: DARK, w: sw * 0.7 }) +
        `<circle cx="6" cy="-13" r="12" fill="${glow}" opacity=".16"/>` + ell(c, 6, -13, 5, 7, mix(PAPER, glow, 0.25), { w: sw * 0.8 }) +
        line(c, [[2, -13], [10, -13]], { w: sw * 0.35, stroke: INK2 });
    }
    case 'olmu':
      return path('M0 0 Q6 -6 2 -10', { stroke: DARK, w: sw * 0.8 }) + ell(c, 2, -14, 4, 4, 'none', { w: sw * 0.8, stroke: DARK });
    default:
      return '';
  }
}

/** 장구(허리에 가로로) — 몸 좌표 (cx,cy) */
export function janggu(c: Ctx, cx: number, cy: number): string {
  const sw = c.sw;
  const P = (x: number, y: number): P2 => [cx + x, cy + y];
  let s = shape(c, [P(-15, -8), P(-2, -2.5), P(2, -2.5), P(15, -8), P(15, 8), P(2, 2.5), P(-2, 2.5), P(-15, 8)], WASH2, { amp: 0.4 });
  s += ell(c, cx - 15, cy, 3.4, 9.5, PAPER) + ell(c, cx + 15, cy, 3.4, 9.5, PAPER);
  s += path(`M${f(cx - 14)} ${f(cy - 8)} L${f(cx - 6)} ${f(cy)} L${f(cx - 14)} ${f(cy + 8)} M${f(cx + 14)} ${f(cy - 8)} L${f(cx + 6)} ${f(cy)} L${f(cx + 14)} ${f(cy + 8)}`, { stroke: INK2, w: sw * 0.45 });
  return s;
}

/** 장면 소품 — 바닥 (x,y) 기준, 배율 s. 반환: svg 와 초점(위쪽 중심) */
export function sceneProp(c: Ctx, key: string, x: number, y: number, s: number): { svg: string; top: P2 } {
  const sw0 = c.sw;
  const cc: Ctx = { ...c, sw: sw0 / s };
  const sw = cc.sw;
  let inner = '';
  let top: P2 = [0, -20];
  switch (key) {
    case 'gutsang': {
      inner += shape(cc, [[-24, -20], [24, -20], [22, -16], [-22, -16]], WASH2, { amp: 0.6 });
      inner += line(cc, [[-19, -16], [-20, 0]], { w: sw * 1.2 }) + line(cc, [[19, -16], [20, 0]], { w: sw * 1.2 });
      for (const cx of [-15, 15]) {
        inner += shape(cc, [[cx - 1.6, -31], [cx + 1.6, -31], [cx + 1.6, -20], [cx - 1.6, -20]], PAPER, { amp: 0.2, w: sw * 0.7 });
        inner += path(`M${cx - 2} ${-32} Q${cx} ${-40} ${cx + 2} ${-32} Q${cx} ${-30} ${cx - 2} ${-32} Z`, { fill: c.acc ? mix(c.acc, PAPER, 0.3) : PAPER, stroke: INK, w: sw * 0.5 });
      }
      inner += path('M-6 -20 Q0 -14 6 -20 Z', { fill: PAPER, stroke: INK, w: sw * 0.7 }) + path('M-4 -20 Q0 -25 4 -20', { fill: PAPER, stroke: INK2, w: sw * 0.5 });
      top = [0, -34];
      break;
    }
    case 'wipae':
      inner += shape(cc, [[-4, -28], [4, -28], [4, -4], [-4, -4]], PAPER, { amp: 0.3 }) + shape(cc, [[-7, -4], [7, -4], [7, 0], [-7, 0]], WASH2, { amp: 0.3 }) +
        line(cc, [[0, -24], [0, -9]], { w: sw * 0.6, stroke: INK2, dash: '2 1.5' });
      top = [0, -28];
      break;
    case 'jeonghwasu':
      inner += shape(cc, [[-6, -6], [6, -6], [5, 0], [-5, 0]], WASH2, { amp: 0.3 }) + path('M-9 -12 Q0 -2 9 -12 Z', { fill: PAPER, stroke: INK, w: sw }) +
        ell(cc, 0, -12, 9, 1.8, mix(PAPER, '#9fb4c0', 0.25), { w: sw * 0.6 });
      top = [0, -12];
      break;
    case 'jihwa': {
      inner += shape(cc, [[-5, -10], [5, -10], [4, 0], [-4, 0]], WASH2, { amp: 0.4 });
      for (let i = 0; i < 5; i++) {
        const fx = -9 + i * 4.5 + jit(cc, 1);
        const fy = -24 - (i % 2) * 6 + jit(cc, 2);
        inner += path(`M0 -10 Q${f(fx * 0.5)} ${f(fy * 0.6)} ${f(fx)} ${f(fy)}`, { stroke: INK2, w: sw * 0.5 });
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          inner += ell(cc, fx + Math.sin(a) * 2.6, fy - Math.cos(a) * 2.6, 2.2, 1.6, PAPER, { w: sw * 0.45, rot: k * 72 });
        }
      }
      top = [0, -28];
      break;
    }
    case 'bowls3':
      for (const bx of [-14, 0, 14]) inner += path(`M${bx - 5} -6 Q${bx} 0 ${bx + 5} -6 Z`, { fill: PAPER, stroke: INK, w: sw * 0.9 }) + path(`M${bx - 4} -6 Q${bx} -10 ${bx + 4} -6`, { fill: PAPER, stroke: INK2, w: sw * 0.5 });
      inner += ell(cc, -6, 2, 4, 1.4, WASH2, { w: sw * 0.5 }) + ell(cc, 6, 2, 4, 1.4, WASH2, { w: sw * 0.5 });
      inner += `<circle cx="20" cy="1" r="1.6" fill="${PAPER}" stroke="${INK}" stroke-width="${f(sw * 0.5)}"/><circle cx="23" cy="0" r="1.6" fill="${PAPER}" stroke="${INK}" stroke-width="${f(sw * 0.5)}"/>`;
      top = [0, -10];
      break;
    case 'soban':
      inner += ell(cc, 0, -12, 16, 3.6, WASH2) + shape(cc, [[-3, -12], [3, -12], [5, 0], [-5, 0]], WASH2, { amp: 0.3 }) +
        shape(cc, [[-9, -26], [-5, -26], [-4, -21], [-2, -18], [-2, -14], [-12, -14], [-12, -18], [-10, -21]], PAPER, { amp: 0.4 }) +
        path('M2 -15 Q7 -9 12 -15 Z', { fill: PAPER, stroke: INK, w: sw * 0.8 });
      top = [0, -24];
      break;
    case 'beomjong':
      inner += line(cc, [[-22, -64], [22, -64]], { w: sw * 1.4, stroke: DARK }) + line(cc, [[0, -64], [0, -58]], { w: sw });
      inner += shape(cc, [[-9, -58], [9, -58], [11, -44], [14, -32], [-14, -32], [-11, -44]], WASH2, { amp: 0.6 });
      inner += line(cc, [[-12, -38], [12, -38]], { w: sw * 0.5 }) + ell(cc, 0, -42, 2.6, 2.6, 'none', { w: sw * 0.6 });
      top = [0, -45];
      break;
    case 'eopgyeongdae':
      inner += shape(cc, [[-8, -2], [8, -2], [6, 0], [-6, 0]], WASH2, { amp: 0.3 }) + line(cc, [[0, -2], [0, -22]], { w: sw * 1.4, stroke: DARK });
      inner += ell(cc, 0, -34, 13, 13, WASH2) + ell(cc, 0, -34, 10, 10, PAPER, { w: sw * 0.6 }) + path('M-4 -38 L2 -32 M-1 -40 L5 -34', { stroke: INK2, w: sw * 0.5 });
      top = [0, -34];
      break;
    case 'crow':
      inner += path('M-10 -2 Q-2 -12 4 -4 Q10 -10 16 -12 Q12 -2 4 0 Q-2 4 -10 -2 Z', { fill: INK, stroke: INK, w: sw * 0.5 }) +
        `<circle cx="-8" cy="-3" r="2.6" fill="${INK}"/>` + path('M-10 -3 L-14 -2 L-10 -1', { fill: DARK, stroke: INK, w: sw * 0.4 }) +
        shape(cc, [[-17, -2], [-13, -2], [-13, 6], [-17, 6]], mix(c.acc ?? CIN, PAPER, 0.5), { amp: 0.3, w: sw * 0.5 });
      top = [-14, 2];
      break;
    case 'hawk': {
      inner += path('M-4 0 Q-18 -10 -26 -4 Q-16 -2 -8 4 Z M4 0 Q18 -10 26 -4 Q16 -2 8 4 Z', { fill: PAPER, stroke: INK, w: sw * 0.8 });
      inner += ell(cc, 0, 2, 6, 5, PAPER, { w: sw * 0.8 });
      for (const hx of [-6, 0, 6]) inner += line(cc, [[0, -1], [hx, -9]], { w: sw * 0.8 }) + ell(cc, hx, -11, 2.4, 2.4, PAPER, { w: sw * 0.7 }) + path(`M${hx - 2.4} -11 l-2 1 l2 1`, { stroke: INK, w: sw * 0.5 });
      inner += path('M-3 7 L0 12 L3 7', { fill: PAPER, stroke: INK, w: sw * 0.7 });
      top = [0, -4];
      break;
    }
    case 'drum':
    case 'buk':
      inner += shape(cc, [[-9, -18], [9, -18], [10, -4], [-10, -4]], WASH2, { amp: 0.5 }) + ell(cc, 0, -18, 9, 2.6, PAPER, { w: sw * 0.7 }) +
        line(cc, [[-6, -4], [-8, 0]], { w: sw * 0.8 }) + line(cc, [[6, -4], [8, 0]], { w: sw * 0.8 });
      top = [0, -18];
      break;
    case 'rock':
      inner += shape(cc, [[-18, 0], [-16, -10], [-8, -17], [4, -18], [14, -12], [18, 0]], WASH, { amp: 1.4 }) + line(cc, [[-6, -14], [-2, -8], [-5, -3]], { w: sw * 0.5, stroke: INK2 });
      top = [0, -18];
      break;
    case 'bush': {
      for (let i = 0; i < 6; i++) {
        const bx = -18 + i * 7 + jit(cc, 1.5);
        inner += ell(cc, bx, -8 - (i % 2) * 5, 7, 6, mix(WASH2, PAPER, 0.3), { w: sw * 0.7, op: 0.92 });
      }
      top = [0, -14];
      break;
    }
    case 'jusa':
      inner += ell(cc, 0, -2, 6, 2, WASH2, { w: sw * 0.7 }) + ell(cc, 0, -2.6, 4, 1.2, c.acc ?? CIN, { w: 0 });
      top = [0, -3];
      break;
    case 'tal3':
      inner += mask(cc, 'halmi', 0, -30, 11, 13) + mask(cc, 'malttugi', -14, -12, 11, 13) + mask(cc, 'yangban', 14, -12, 11, 13);
      top = [0, -20];
      break;
    default:
      break;
  }
  return { svg: g(inner, `translate(${f(x)} ${f(y)}) scale(${f(s)})`), top: [x + top[0] * s, y + top[1] * s] };
}
