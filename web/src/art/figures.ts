// 인물 원시 도형 — 영웅(꼭두풍 목인)과 원귀(넋전풍 한지 오림). tools/presentation/figures.mjs 를 먹선 스케치로 옮기고 자세를 더했다.
// 좌표: 발 가운데가 (0,0), 위가 −y, 얼굴은 +x(오른쪽)를 본다. 키 약 140.
import { BROWN, type Ctx, DARK, INK, INK2, type P2, PAPER, SKIN, WASH, WASH2, ell, f, g, jit, line, mix, path, rot, shape, wob } from './draw.ts';
import { BODY_PROPS, PROP_LEN, SCENE_PROPS, handProp, janggu, mask, paperFigure } from './props.ts';

interface PoseDef {
  lean: number;
  back: P2;
  front: P2;
  ang: number;
  bang: number;
  seat?: boolean;
  kneel?: boolean;
  stance?: number;
  lift?: boolean;
}

/** 자세 — 손 위치는 윗몸 좌표, ang 은 앞손 무구의 기울기(0 = 위, 90 = 오른쪽) */
export const POSES: Record<string, PoseDef> = {
  idle: { lean: 0, back: [-18, -58], front: [20, -64], ang: 15, bang: -10 },
  strike: { lean: 9, back: [-22, -70], front: [30, -106], ang: 52, bang: -30, stance: 6 },
  aim: { lean: 3, back: [8, -86], front: [26, -90], ang: 88, bang: 80 },
  cast: { lean: -3, back: [-18, -76], front: [24, -118], ang: 14, bang: -20 },
  guard: { lean: -5, back: [12, -76], front: [26, -88], ang: 0, bang: 10, stance: 4 },
  drum: { lean: 5, back: [-8, -64], front: [26, -84], ang: 128, bang: 110 },
  dance: { lean: 11, back: [-34, -104], front: [34, -102], ang: 34, bang: -36, lift: true },
  bind: { lean: 9, back: [-14, -66], front: [40, -94], ang: 82, bang: -10, stance: 6 },
  offer: { lean: 14, back: [18, -66], front: [30, -70], ang: 4, bang: 0 },
  summon: { lean: -6, back: [-24, -120], front: [24, -124], ang: 6, bang: -16 },
  rest: { lean: 0, back: [-2, -54], front: [18, -58], ang: 70, bang: 60, seat: true },
  rescue: { lean: 24, back: [-4, -54], front: [34, -40], ang: 118, bang: 30, kneel: true },
  read: { lean: 0, back: [6, -74], front: [22, -76], ang: 90, bang: 90 },
  write: { lean: 14, back: [4, -56], front: [28, -56], ang: 160, bang: 80, seat: true },
  pray: { lean: -2, back: [10, -82], front: [14, -84], ang: 0, bang: 0 },
  throw: { lean: 12, back: [-26, -92], front: [38, -110], ang: 64, bang: -40, stance: 6 },
  swap: { lean: 6, back: [-20, -64], front: [24, -72], ang: 22, bang: -10, stance: 6 },
  advance: { lean: 14, back: [-26, -76], front: [32, -82], ang: 70, bang: -20, stance: 10 },
  retreat: { lean: -10, back: [-30, -82], front: [18, -98], ang: -8, bang: -40, stance: 8 },
};

const WIDE = new Set(['manshin', 'beopsa', 'baksu']);

export interface FigOpts {
  hero: string;
  pose: string;
  props: string[];
  acc: string | null;
  mask?: string;
  dim?: boolean;
  down?: boolean;
}

export interface FigOut {
  svg: string;
  /** 앞손 무구 끝 */
  tip: P2;
  hand: P2;
  chest: P2;
  head: P2;
  /** 머리 위 */
  top: P2;
  feet: P2;
}

function arm(c: Ctx, from: P2, to: P2, fill: string, wide: boolean): string {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const w0 = 4.6;
  const w1 = wide ? 7.5 : 3.6;
  const ext = wide ? 4 : 0;
  const ex: P2 = [to[0] + (dx / len) * ext, to[1] + (dy / len) * ext];
  const pts: P2[] = [
    [from[0] + nx * w0, from[1] + ny * w0],
    [ex[0] + nx * w1, ex[1] + ny * w1],
    [ex[0] - nx * w1, ex[1] - ny * w1],
    [from[0] - nx * w0, from[1] - ny * w0],
  ];
  return shape(c, pts, fill, { amp: 0.8 }) + ell(c, to[0], to[1], 3.6, 3.6, SKIN, { w: c.sw * 0.8 });
}

/** 영웅 원형별 머리쓰개 */
function headgear(c: Ctx, hero: string, accLine: string): string {
  const sw = c.sw;
  switch (hero) {
    case 'manshin':
      return path('M-12 -112 Q2 -128 16 -113 Q4 -118 -12 -112 Z', { fill: DARK, stroke: INK, w: sw * 0.8 }) + ell(c, -12, -110, 6, 5.5, DARK, { w: sw * 0.7 }) +
        line(c, [[-13, -116], [16, -116]], { w: sw * 1.6, stroke: accLine });
    case 'jaebi':
      return shape(c, [[-7, -118], [-4, -131], [9, -131], [12, -118]], WASH, { amp: 0.5 }) + ell(c, 2, -118, 18, 3, WASH, { w: sw * 0.9 }) +
        path('M-6 -116 Q-4 -100 0 -96', { stroke: INK2, w: sw * 0.4 });
    case 'posu': {
      let s = ell(c, 1, -118, 16, 9, WASH2) + ell(c, -11, -108, 4, 7, WASH2, { w: sw * 0.7 });
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        s += path(`M${f(1 + Math.cos(a) * 15)} ${f(-118 + Math.sin(a) * 8)} l${f(Math.cos(a) * 2.4)} ${f(Math.sin(a) * 2.4)}`, { stroke: INK, w: sw * 0.5 });
      }
      return s;
    }
    case 'baksu':
      return ell(c, 2, -118, 20, 3.6, DARK) + path('M-9 -119 Q2 -136 13 -119 Z', { fill: DARK, stroke: INK, w: sw * 0.8 }) +
        path(`M2 -134 q-7 -6 -2 -13 q6 4 2 13`, { fill: accLine, stroke: INK, w: sw * 0.5 });
    case 'seungnyeo':
      return path('M-10 -114 Q2 -124 15 -114', { stroke: WASH2, w: sw * 1.4 });
    case 'beopsa':
      return shape(c, [[-12, -116], [-11, -130], [-2, -135], [6, -130], [15, -130], [16, -116]], DARK, { amp: 0.6 }) + line(c, [[-2, -134], [-2, -118]], { w: sw * 0.5, stroke: WASH2 });
    case 'chasa':
      return ell(c, 2, -118, 19, 3.8, BROWN) + path('M-10 -119 Q2 -136 14 -119 Z', { fill: BROWN, stroke: INK, w: sw * 0.8 }) +
        path('M2 -134 l-3 -7 l6 0 Z', { fill: accLine, stroke: INK, w: sw * 0.4 });
    case 'anon':
    default:
      return path('M-12 -110 Q2 -126 15 -111 Q4 -116 -12 -110 Z', { fill: DARK, stroke: INK, w: sw * 0.7 }) + ell(c, 1, -121, 3.4, 3.4, DARK, { w: sw * 0.6 });
  }
}

/** 영웅 한 명 (꼭두 목인). x,y = 발 위치, s = 배율 */
export function figure(c0: Ctx, o: FigOpts, x: number, y: number, s: number): FigOut {
  const P = POSES[o.pose] ?? POSES.idle;
  const c: Ctx = { ...c0, sw: c0.sw / s };
  const sw = c.sw;
  const acc = o.dim ? null : o.acc;
  const robe = acc ? mix(acc, PAPER, 0.58) : o.hero === 'anon' ? mix(WASH, PAPER, 0.3) : WASH;
  const accLine = acc ? c0.accLine : INK2;
  const lean = P.lean + jit(c, 2.5);
  const drop = P.seat ? 34 : P.kneel ? 24 : 0;
  const hasJakdu = o.props.includes('jakdu') && !P.seat && !P.kneel;
  const lift = hasJakdu ? 14 : 0;
  const hands = o.props.filter((k) => !BODY_PROPS.has(k) && !SCENE_PROPS.has(k));
  // 합장·여밈 자세에서 무복은 입은 옷 그 자체다(손에 들지 않는다)
  const frontKey = hands[0] === 'mubok' && o.pose === 'pray' ? '' : (hands[0] ?? '');
  let backKey = hands[1] ?? '';
  if (frontKey === 'jegeum') backKey = 'jegeum';
  const st = P.stance ?? 2;

  // 윗몸 좌표 → 인물 좌표
  const up = (p: P2): P2 => {
    const q = rot(p, lean, [0, -10]);
    return [q[0], q[1] + drop - lift];
  };
  const W = (p: P2): P2 => [x + p[0] * s, y + p[1] * s];

  let base = `<ellipse cx="0" cy="1" rx="24" ry="3.2" fill="${INK}" opacity=".12"/>`;
  if (hasJakdu) {
    base += shape(c, [[-30, -5], [30, -5], [30, 0], [-30, 0]], WASH2, { amp: 0.4 });
    base += line(c, [[-24, -5], [-24, -9]], { w: sw }) + line(c, [[24, -5], [24, -9]], { w: sw });
    base += shape(c, [[-30, -9], [30, -9], [28, -14], [-28, -14]], PAPER, { amp: 0.3, w: sw * 0.8 });
    base += line(c, [[-28, -14], [28, -14]], { w: sw * 0.5, stroke: INK2 });
  }
  // 다리
  if (P.seat) {
    base += ell(c, 2, -6, 24, 6.5, robe);
  } else if (P.kneel) {
    base += shape(c, [[-6, -10], [14, -8], [16, -1], [-4, -1]], robe, { amp: 0.6 }) + ell(c, -16, -2, 5, 2.2, DARK, { w: sw * 0.6 });
  } else {
    const fy = -lift;
    const l1: P2 = [-7 - st, fy - 1];
    const l2: P2 = P.lift ? [16, fy - 12] : [8 + st, fy - 1];
    base += line(c, [[-5, fy - 14], l1], { w: sw * 3.4, stroke: DARK, amp: 0.5 }) + line(c, [[5, fy - 14], l2], { w: sw * 3.4, stroke: DARK, amp: 0.5 });
    base += ell(c, l1[0] - 1, l1[1] + 0.5, 4.6, 2, DARK, { w: 0 }) + ell(c, l2[0] + 1.5, l2[1] + 0.5, 4.6, 2, DARK, { w: 0 });
  }

  // 윗몸
  const hw = WIDE.has(o.hero) ? 29 : 25;
  const yb = P.seat || P.kneel ? -6 - drop + lift : -9;
  let upper = '';
  const backInFront = P.back[0] > -2;
  const backArm = (): string => {
    let s2 = arm(c, [-11, -86], P.back, robe, WIDE.has(o.hero));
    if (backKey) s2 += g(handProp(c, backKey, o.mask), `translate(${f(P.back[0])} ${f(P.back[1])}) rotate(${f(P.bang + jit(c, 6))})`);
    if (o.props.includes('hansam')) s2 += hansam(c, P.back, -1);
    return s2;
  };
  if (!backInFront) upper += backArm();
  const robePts: P2[] = [[-13, -93], [13, -93], [hw * 0.55, -60], [hw, yb], [hw * 0.4, yb + 3], [-hw * 0.4, yb + 3], [-hw, yb], [-hw * 0.55, -60]];
  upper += shape(c, robePts, robe, { amp: 1 });
  if (c.lod) upper += path(wob(c, robePts, true, 1), { fill: 'none', stroke: INK2, w: sw * 0.3, op: 0.25 });
  // 원형별 옷
  if (o.hero === 'baksu' || o.props.includes('gugunbok')) upper += shape(c, [[-13, -92], [-3, -92], [-6, -42], [-17, -42]], mix(DARK, WASH2, 0.35), { amp: 0.6 }) + shape(c, [[3, -92], [13, -92], [17, -42], [6, -42]], mix(DARK, WASH2, 0.35), { amp: 0.6 });
  if (o.props.includes('cheollik') || o.props.includes('hongcheollik')) {
    for (let i = -3; i <= 3; i++) upper += line(c, [[i * 3.4, -58], [i * (hw / 3.6), yb + 1]], { w: sw * 0.4, stroke: INK2 });
  }
  if (o.hero === 'seungnyeo') {
    upper += shape(c, [[-13, -92], [-5, -92], [18, -44], [10, -40]], mix(WASH2, INK, 0.12), { amp: 0.6 });
    upper += line(c, [[-6, -82], [2, -80]], { w: sw * 0.4, stroke: INK2 }) + line(c, [[2, -66], [10, -64]], { w: sw * 0.4, stroke: INK2 });
  }
  if (o.hero === 'chasa') upper += shape(c, [[-12, -91], [12, -91], [15, -40], [3, -40], [0, -66], [-3, -40], [-15, -40]], mix(DARK, WASH2, 0.45), { amp: 0.6 });
  if (o.hero === 'posu') upper += line(c, [[-12, -90], [14, -58]], { w: sw * 1.2, stroke: DARK });
  // 깃·띠
  upper += path('M-7 -93 L1 -78 L8 -93', { stroke: PAPER, w: sw * 2.2 }) + path('M-7 -93 L1 -78 L8 -93', { stroke: INK, w: sw * 0.5 });
  upper += shape(c, [[-hw * 0.6, -61], [hw * 0.6, -61], [hw * 0.6, -56], [-hw * 0.6, -56]], acc ? mix(acc, INK, 0.35) : WASH2, { amp: 0.4, w: sw * 0.7 });
  if (o.hero === 'chasa') upper += [0, 1].map((i) => ell(c, -14, -50 + i * 3, 5, 2, 'none', { w: sw, stroke: accLine })).join('');
  if (o.hero === 'posu' && frontKey !== 'hwayaktong') upper += g(handProp(c, 'hwayaktong'), 'translate(-17 -40) scale(.8)');
  if (o.props.includes('janggu')) upper += janggu(c, 6, -54) + line(c, [[-10, -90], [8, -64]], { w: sw * 0.6, stroke: INK2 });
  if (o.hero === 'seungnyeo') for (let i = 0; i < 9; i++) upper += `<circle cx="${f(-8 + i * 2.2)}" cy="${f(-90 + Math.sin((i / 8) * Math.PI) * 9)}" r="1.3" fill="${DARK}"/>`;
  if (backInFront) upper += backArm();
  // 머리
  if (o.hero === 'talggun') {
    upper += path('M-14 -112 Q-18 -92 -10 -86 L12 -86 Q14 -96 10 -104 Z', { fill: DARK, stroke: INK, w: sw * 0.7 });
    upper += mask(c, o.mask ?? 'malttugi', 3, -107, 14, 17) + path('M-12 -121 L18 -121 L3 -135 Z', { fill: DARK, stroke: INK, w: sw * 0.7 });
  } else {
    upper += ell(c, 2, -106, 13.5, 13.5, SKIN);
    upper += `<circle cx="8.5" cy="-108" r="1.5" fill="${INK}"/>`;
    upper += `<circle cx="6" cy="-100.5" r="2.3" fill="${acc ?? '#c96a5a'}" opacity=".55"/>`;
    upper += path('M9 -97 q2 1 4 -.4', { stroke: INK, w: sw * 0.6 });
    upper += headgear(c, o.hero, accLine);
  }
  // 앞팔과 무구
  const fa = P.ang + jit(c, 6);
  upper += arm(c, [11, -86], P.front, robe, WIDE.has(o.hero));
  if (frontKey) upper += g(handProp(c, frontKey, o.mask), `translate(${f(P.front[0])} ${f(P.front[1])}) rotate(${f(fa)})`);
  if (o.props.includes('hansam')) upper += hansam(c, P.front, 1);

  const tipLocal: P2 = [P.front[0] + Math.sin((fa * Math.PI) / 180) * (PROP_LEN[frontKey] ?? 6), P.front[1] - Math.cos((fa * Math.PI) / 180) * (PROP_LEN[frontKey] ?? 6)];
  const inner = base + g(upper, `translate(0 ${f(drop - lift)}) rotate(${f(lean)} 0 -10)`);
  const op = o.dim ? ' opacity=".55"' : '';
  let svg: string;
  if (o.down) {
    svg = g(g(inner, 'translate(-62 -10) rotate(90)'), `translate(${f(x)} ${f(y)}) scale(${f(s)})`, `opacity=".7"`);
    return { svg, tip: [x + 20 * s, y - 20 * s], hand: [x, y - 12 * s], chest: [x - 10 * s, y - 14 * s], head: [x + 46 * s, y - 14 * s], top: [x + 40 * s, y - 34 * s], feet: [x, y] };
  }
  svg = g(inner, `translate(${f(x)} ${f(y)}) scale(${f(s)})`, op.trim());
  return {
    svg,
    tip: W(up(tipLocal)),
    hand: W(up(P.front)),
    chest: W(up([2, -76])),
    head: W(up([2, -106])),
    top: W(up([2, -140])),
    feet: [x, y],
  };
}

function hansam(c: Ctx, hand: P2, dir: number): string {
  const [hx, hy] = hand;
  const d = `M${f(hx)} ${f(hy)} Q${f(hx + dir * 10 + jit(c, 4))} ${f(hy + 10)} ${f(hx + dir * 4 + jit(c, 4))} ${f(hy + 24)} Q${f(hx + dir * 12)} ${f(hy + 32)} ${f(hx + dir * 6 + jit(c, 3))} ${f(hy + 40)}`;
  return path(d, { stroke: INK2, w: c.sw * 5 }) + path(d, { stroke: PAPER, w: c.sw * 3.8 });
}

// ── 원귀 (넋전풍) ──────────────────────────────────────

export interface SpiritOut {
  svg: string;
  chest: P2;
  head: P2;
  top: P2;
  feet: P2;
  s: number;
}

const FAMILY_EXTRA: Record<string, (c: Ctx) => string> = {
  수귀: (c) => path('M-10 -122 q-6 18 -4 34 M-4 -123 q-2 20 0 30 M4 -123 q2 20 0 30 M10 -122 q6 18 4 34', { stroke: DARK, w: c.sw * 1.3 }) +
    path('M-14 -60 l0 14 M-4 -52 l0 18 M10 -64 l0 12', { stroke: INK2, w: c.sw * 0.6, op: 0.7 }) +
    ell(c, 0, 0, 38, 5, 'none', { w: c.sw * 0.7, stroke: INK2, op: 0.6 }) + ell(c, 0, 1, 24, 3, 'none', { w: c.sw * 0.5, stroke: INK2, op: 0.5 }),
  객귀: (c) => g(shape(c, [[-14, -12], [12, -12], [12, 12], [-14, 12]], WASH2, { amp: 1.4 }) + path('M-2 -12 l6 -8 l4 8', { stroke: INK, w: c.sw * 0.8 }), 'translate(-26 -84)') +
    line(c, [[30, -70], [38, 4]], { w: c.sw * 1.6, stroke: DARK }),
  '굶주린 넋': (c) => path('M-14 -62 Q0 -46 14 -62 Z', { fill: PAPER, stroke: INK, w: c.sw * 0.9 }) + line(c, [[-16, -62], [16, -62]], { w: c.sw * 0.9 }),
  잡귀잡신: (c) => path('M-22 -40 l-8 6 l6 2 M20 -76 l9 -4 l-3 7 M-12 -100 l-6 -8 M24 -40 l6 4', { stroke: INK2, w: c.sw }),
  억울귀: (c) => g(shape(c, [[-10, -14], [10, -14], [10, 12], [-10, 12]], WASH, { amp: 0.6 }) + path('M-6 -8 h12 M-6 -3 h12 M-6 2 h9', { stroke: INK, w: c.sw * 0.5 }), 'translate(26 -68) rotate(-12)'),
  역귀: (c) => path('M-16 -134 q4 -8 0 -16 M0 -138 q4 -8 0 -16 M16 -134 q4 -8 0 -16', { stroke: INK2, w: c.sw * 1.1 }) +
    `<g fill="${INK2}" opacity=".45"><circle cx="-8" cy="-70" r="3"/><circle cx="6" cy="-56" r="2.5"/><circle cx="-4" cy="-38" r="2.5"/></g>`,
  '무장 원귀': (c) => path('M-15 -114 Q0 -136 15 -114 Z', { fill: WASH2, stroke: INK, w: c.sw }) + line(c, [[0, -132], [0, -146]], { w: c.sw * 1.3 }) +
    line(c, [[30, -150], [30, 4]], { w: c.sw * 1.5, stroke: DARK }) + path('M30 -150 l-5 14 l10 0 Z', { fill: WASH, stroke: INK, w: c.sw * 0.6 }),
  '몽달·손각시': (c) => path('M-12 -112 q-14 20 -8 52 q4 8 -2 16', { stroke: c.acc ?? DARK, w: c.sw * 2 }),
};

const BOSS_EXTRA: Record<string, (c: Ctx) => string> = {
  sakkun: (c) => path('M-30 -118 L30 -118 L0 -140 Z', { fill: WASH, stroke: INK, w: c.sw }) + line(c, [[24, -110], [44, 6]], { w: c.sw * 2.4, stroke: DARK }) +
    path('M-62 6 Q0 26 62 6 L52 -6 L-52 -6 Z', { fill: mix(DARK, WASH2, 0.4), stroke: INK, w: c.sw }),
  heoju: (c) => g(shape(c, [[-14, -10], [14, -10], [12, 10], [0, 16], [-12, 10]], PAPER, { amp: 0.8 }) + ell(c, -5, -2, 2.6, 3.4, INK, { w: 0 }) + ell(c, 5, -2, 2.6, 3.4, INK, { w: 0 }), 'translate(0 -106)'),
};

/** 원귀 한 명. family 계열, tint = 한의 빛깔(강조색이 한일 때만), tier 등급, state: idle | hit | faded | bound */
export function spirit(c0: Ctx, family: string, x: number, y: number, scale: number, o: { tint?: string | null; tier?: string; state?: string; boss?: string } = {}): SpiritOut {
  const s = scale * ({ elite: 1.25, boss: 1.5, minion: 0.8 }[o.tier ?? ''] ?? 1);
  const c: Ctx = { ...c0, sw: c0.sw / s };
  const thin = family === '굶주린 넋' ? 0.8 : 1;
  const w = 18 * thin;
  const hem: P2[] = [];
  for (let i = -18 * thin, k = 0; i <= 18 * thin + 0.1; i += 6 * thin, k++) hem.push([i, k % 2 ? -2 : -11]);
  const body: P2[] = [[-w, -94], [-34 * thin, -58], [-26 * thin, -54], [-w, -70], [-w, -11], ...hem, [w, -11], [w, -70], [26 * thin, -54], [34 * thin, -58], [w, -94]];
  const fill = o.state === 'faded' ? '#fffaf0' : PAPER;
  let inner = '';
  const glow = o.tint ?? WASH2;
  inner += `<ellipse cx="0" cy="-66" rx="40" ry="66" fill="${glow}" opacity="${o.tint ? 0.2 : 0.22}"/><ellipse cx="0" cy="-70" rx="28" ry="52" fill="${glow}" opacity="${o.tint ? 0.18 : 0.16}"/>`;
  let fig = shape(c, body, fill, { amp: 1.4, stroke: INK2 });
  if (family === '억울귀') fig += path(wob(c, body, true, 1.4), { stroke: DARK, w: c.sw * 2.4, op: 0.3 });
  fig += ell(c, 0, -108, 14, 14, fill, { stroke: INK2 });
  fig += path('M-6 -90 L-6 -40 M0 -88 L0 -30 M6 -90 L6 -40', { stroke: INK2, w: c.sw * 0.45, op: 0.6 });
  fig += ell(c, -5, -109, 2.4, 3.6, '#2e2a30', { w: 0 }) + ell(c, 5, -109, 2.4, 3.6, '#2e2a30', { w: 0 });
  fig += (FAMILY_EXTRA[family] ?? (() => ''))(c);
  if (o.boss) fig += (BOSS_EXTRA[o.boss] ?? (() => ''))(c);
  let tf = '';
  if (o.state === 'hit') tf = 'rotate(-7) translate(6 0)';
  if (o.state === 'faded') tf = 'translate(0 -10)';
  inner += tf ? g(fig, tf) : fig;
  const svg = g(inner, `translate(${f(x)} ${f(y)}) scale(${f(-s)} ${f(s)})`, o.state === 'faded' ? 'opacity=".75"' : '');
  return { svg, chest: [x, y - 64 * s], head: [x, y - 108 * s], top: [x, y - 128 * s], feet: [x, y], s };
}

/** 작은 넋(넋 부르기·어깨 위 원망) */
export function smallSoul(c: Ctx, x: number, y: number, s: number): string {
  return g(paperFigure({ ...c, sw: c.sw / s }, 1), `translate(${f(x)} ${f(y)}) scale(${f(s)})`);
}
