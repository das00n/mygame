// 카드 한 장의 스케치를 짠다 — 표(table.ts)의 구조 필드 → 인물·대상·소품·글리프·배경 배치 → SVG 문자열.
// 같은 카드 id 는 언제나 같은 그림(시드 = id). 강화판(id+)은 기본판 그림을 쓴다.
import { CIN, type Ctx, FAM_CODE, HAN, HERO_ACC, INK, INK2, LAMP, type P2, PAPER, SKIN, WASH, WASH2, f, g, hashStr, jit, lineColor, path, rng, shape } from './draw.ts';
import { type FigOut, figure, smallSoul, spirit } from './figures.ts';
import { type Geo, backdrop, fibers, fx, groundLine } from './fx.ts';
import { SCENE_PROPS, handProp, janggu, sceneProp } from './props.ts';
import { ART_ROWS } from './table.ts';

export const VIEW_W = 160;
export const VIEW_H = 100;
/** 이 너비(px) 미만이면 작은 카드 세밀도(굵은 선·장식 생략·여백을 조금 잘라 크게) */
export const SMALL_PX = 140;
export const lodFor = (width: number | undefined): 0 | 1 => (width !== undefined && width < SMALL_PX ? 0 : 1);

export interface ArtSpec {
  heroes: string[];
  poses: string[];
  target: string;
  count: number;
  fx: string;
  fx2: string;
  framing: string;
  props: string[][];
  bg: string;
  acc: string;
  mask: string;
  vs: string;
  tier: string;
  em: string;
  boss: string;
  down: boolean;
}

const FALLBACK = 'anon|none|none|1|paper||insert|bujeok|none|lamp';

export const baseId = (id: string): string => (id.endsWith('+') ? id.slice(0, -1) : id);

export function parseArt(row: string): ArtSpec {
  const p = row.split('|');
  const at = (i: number): string => p[i] ?? '';
  const fam = (t: string): string => (t ? (FAM_CODE[t.split('*')[0]] ?? t.split('*')[0]) + (t.includes('*') ? `*${t.split('*')[1]}` : '') : t);
  return {
    heroes: at(0).split('+'), poses: at(1).split('/'), target: fam(at(2)), count: Number(at(3) || 1), fx: at(4), fx2: at(5), framing: at(6),
    props: at(7).split('/').map((s) => s.split(',').filter(Boolean)), bg: at(8) || 'none', acc: at(9) || 'h0', mask: at(10), vs: fam(at(11)),
    tier: at(12), em: at(13), boss: at(14), down: at(15) === '1',
  };
}

const HERO_SETS = new Set(['manshin', 'jaebi', 'posu', 'baksu', 'seungnyeo', 'beopsa', 'talggun', 'chasa']);
let rows: Map<string, string> | null = null;

/** 카드 id → 표의 한 줄(영웅 묶음은 hero 칸을 되붙인다) */
export function artRow(cardId: string): string | undefined {
  if (!rows) {
    rows = new Map();
    for (const [set, text] of Object.entries(ART_ROWS)) {
      for (const ln of text.split('\n')) {
        const i = ln.indexOf('=');
        rows.set(`${set}.${ln.slice(0, i)}`, HERO_SETS.has(set) ? `${set}|${ln.slice(i + 1)}` : ln.slice(i + 1));
      }
    }
  }
  return rows.get(baseId(cardId));
}

export function artSpec(cardId: string): ArtSpec {
  return parseArt(artRow(cardId) ?? FALLBACK);
}

const FAMILIES = new Set(Object.keys(HAN));
const OFFENSIVE = new Set(['burst', 'slash', 'seal', 'shot', 'scatter', 'ledger', 'crack', 'chain', 'wind', 'flame', 'petals', 'thread']);

interface Frame { hx: number; hs: number; gy: number; ts: number; tgy: number; txs: number[][] }
const FRAMES: Record<string, Frame> = {
  close: { hx: 44, hs: 0.95, gy: 150, ts: 0.6, tgy: 126, txs: [[142], [128, 152], [122, 140, 156]] },
  medium: { hx: 40, hs: 0.56, gy: 90, ts: 0.5, tgy: 90, txs: [[124], [112, 140], [102, 123, 145]] },
  wide: { hx: 32, hs: 0.4, gy: 86, ts: 0.38, tgy: 86, txs: [[122], [108, 134], [100, 121, 143]] },
};

function accColor(sp: ArtSpec): string | null {
  const fam = FAMILIES.has(sp.target) ? sp.target : sp.vs.split('*')[0];
  const heroAcc = (h: string | undefined): string => (h && HERO_ACC[h]) || LAMP;
  switch (sp.acc) {
    case 'h0': return heroAcc(sp.heroes[0]);
    case 'h1': return heroAcc(sp.heroes[1] ?? sp.heroes[0]);
    case 'han': return HAN[fam] ?? HAN.잡귀잡신;
    case 'lamp': return LAMP;
    case 'cin': return CIN;
    default: return null;
  }
}

/** 원귀 무리 — 오른쪽(뒤)부터 그려 앞의 원귀가 겹쳐 보이게 */
function spirits(c: Ctx, fam: string, n: number, fr: Frame, o: { tint: string | null; tier: string; boss: string; shiftX?: number; scale?: number; state?: string }): { svg: string; T: P2[]; Th: P2[]; s: number } {
  const xs = fr.txs[Math.min(3, Math.max(1, n)) - 1];
  const out: { svg: string; chest: P2; head: P2 }[] = [];
  let s0 = fr.ts * (o.scale ?? 1) * (n > 1 ? 0.88 : 1);
  if (o.tier === 'boss') s0 *= 0.8;
  for (let i = 0; i < xs.length; i++) {
    const back = i / Math.max(1, xs.length - 1);
    const sx = xs[i] + (o.shiftX ?? 0) + jit(c, 2);
    const sy = fr.tgy - back * 3;
    const sc = s0 * (1 - back * 0.12);
    out.push(spirit(c, fam, sx, sy, sc, { tint: o.tint, tier: i === 0 ? o.tier : '', boss: i === 0 ? o.boss : '', state: o.state }));
  }
  return { svg: out.slice().reverse().map((x) => x.svg).join(''), T: out.map((x) => x.chest), Th: out.map((x) => x.head), s: s0 };
}

/** 인물 없는 상징 구도(저주·상태·넋 부르기) */
function emblem(c: Ctx, sp: ArtSpec, gy: number): { svg: string; G: Partial<Geo> } {
  const tint = c.acc;
  const fam = FAMILIES.has(sp.target) ? sp.target : '잡귀잡신';
  let s = '';
  const G: Partial<Geo> = {};
  const anon = (pose: string, x: number, y: number, sc: number, dim = false, down = false): FigOut =>
    figure(c, { hero: 'anon', pose, props: [], acc: null, dim, down }, x, y, sc);
  switch (sp.em) {
    case 'ankle': {
      const a = anon('retreat', 70, gy, 0.56);
      s += a.svg + spirit(c, fam, 96, gy + 1, 0.2, { tint }).svg;
      for (const dy of [-2, -5]) s += `<ellipse cx="66" cy="${gy + dy}" rx="7" ry="2" fill="none" stroke="${c.accLine}" stroke-width="${f(c.sw * 1.1)}"/>`;
      s += path(`M90 ${gy - 6} Q80 ${gy - 12} 70 ${gy - 4}`, { stroke: c.accLine, w: c.sw, dash: '2 1.6' });
      break;
    }
    case 'eyes': {
      const a = anon('guard', 46, 150, 0.95);
      s += a.svg;
      s += g(shape(c, [[-11, -13], [11, -13], [10, 8], [0, 14], [-10, 8]], PAPER, { amp: 0.8 }) + `<ellipse cx="-4.5" cy="-3" rx="2.6" ry="3.6" fill="${INK}"/><ellipse cx="4.5" cy="-3" rx="2.6" ry="3.6" fill="${INK}"/>`, `translate(92 46) rotate(${f(jit(c, 10))})`);
      G.H = [92, 52];
      break;
    }
    case 'shoulder': {
      const a = anon('idle', 64, gy, 0.56);
      s += a.svg + smallSoul(c, a.head[0] - 12, a.head[1] + 14, 0.42);
      G.S = [a.head[0] - 6, a.head[1] - 2];
      G.Th = [[a.head[0], a.head[1]]];
      break;
    }
    case 'shadow': {
      const a = anon('retreat', 112, gy, 0.5);
      s += path(`M104 ${gy} L14 ${gy - 3} L12 ${gy + 4} L116 ${gy + 2} Z`, { fill: INK, stroke: 'none', op: 0.2 });
      s += g(spirit(c, fam, 0, 0, 0.32, { tint }).svg, `translate(26 ${gy - 2})`, 'opacity=".55"') + a.svg;
      break;
    }
    case 'gate': {
      s += shape(c, [[46, gy], [46, 18], [52, 18], [52, gy]], PAPER, { amp: 0.4 }) + shape(c, [[110, gy], [110, 18], [116, 18], [116, gy]], PAPER, { amp: 0.4 });
      s += path(`M40 18 Q81 8 122 18`, { stroke: INK, w: c.sw * 1.6 });
      s += g(shape(c, [[0, 0], [28, 0], [28, gy - 22], [0, gy - 22]], PAPER, { amp: 0.6 }), `translate(53 22) rotate(${f(-3 + jit(c, 1))} 0 0)`);
      s += g(shape(c, [[0, 0], [28, 0], [28, gy - 22], [0, gy - 22]], PAPER, { amp: 0.6 }), `translate(81 22) rotate(${f(3 + jit(c, 1))} 28 0)`);
      for (const x of [36, 126]) for (let i = 0; i < 3; i++) s += path(`M${x} ${30 + i * 12} q${x < 80 ? -4 : 4} 3 0 6`, { stroke: INK2, w: c.sw });
      s += g(handProp(c, 'cup'), `translate(130 ${gy}) scale(1.4)`);
      break;
    }
    case 'lamp': {
      s += g(handProp({ ...c, sw: c.sw / 2.6 }, 'lamp'), `translate(66 ${gy}) scale(2.6)`);
      for (let i = 0; i < 9; i++) s += path(`M${92 + i * 7} 4 L${70 + i * 7} 96`, { stroke: INK, w: c.sw * 0.8, op: 0.3 });
      s += `<rect x="96" y="0" width="64" height="100" fill="${INK}" opacity=".12"/>`;
      break;
    }
    case 'trap': {
      s += shape(c, [[40, 30], [120, 26], [124, 74], [44, 78]], PAPER, { amp: 1.2 });
      let jaw = `M58 ${gy - 6} A22 14 0 0 1 102 ${gy - 6}`;
      for (let i = 0; i < 7; i++) jaw += ` M${60 + i * 6.4} ${gy - 8 - Math.sin((i / 6) * Math.PI) * 11} l3 4 l3 -4`;
      s += path(jaw, { stroke: INK, w: c.sw * 1.2 });
      s += path(`M54 ${gy - 6} L106 ${gy - 6}`, { stroke: INK, w: c.sw * 1.4 });
      G.T = [[80, 44]];
      break;
    }
    case 'noise': {
      let d = '';
      for (let i = 0; i < 9; i++) {
        const x = 34 + c.r() * 90;
        const y = 22 + c.r() * 52;
        d += `M${f(x)} ${f(y)} c${f(jit(c, 22))} ${f(jit(c, 22))} ${f(jit(c, 22))} ${f(jit(c, 22))} ${f(jit(c, 18))} ${f(jit(c, 14))} `;
      }
      s += path(d, { stroke: INK2, w: c.sw * 1.1 }) + path(d, { stroke: c.accLine, w: c.sw * 0.5, op: 0.8 });
      s += spirit(c, fam, 58, gy, 0.22, { tint }).svg + spirit(c, fam, 108, gy - 2, 0.18, { tint }).svg;
      break;
    }
    case 'soul': {
      const a = anon('idle', 98, gy, 0.55, true, true);
      s += a.svg + `<circle cx="82" cy="40" r="16" fill="${c.acc ?? LAMP}" opacity=".18"/>` + smallSoul(c, 82, 56, 0.55);
      for (let i = 0; i < 3; i++) s += shape(c, [[66 + i * 11, 64], [74 + i * 11, 64], [74 + i * 11, 74], [66 + i * 11, 74]], i === 0 ? PAPER : 'none', { amp: 0.4, w: c.sw * 0.9 });
      G.T = [[82, 40]];
      break;
    }
    case 'gok': {
      const a = figure(c, { hero: 'anon', pose: 'rescue', props: [], acc: null }, 62, gy, 0.56);
      s += a.svg + sceneProp(c, 'wipae', 110, gy, 0.75).svg;
      break;
    }
    case 'fever': {
      const a = anon('idle', 70, gy, 0.56);
      s += a.svg + figure(c, { hero: 'anon', pose: 'idle', props: [], acc: null, dim: true }, 118, gy, 0.5).svg;
      for (let i = 0; i < 3; i++) s += path(`M${62 + i * 8} ${f(a.top[1] - 2)} q4 -5 0 -10 q-4 -5 0 -10`, { stroke: c.accLine, w: c.sw * 1.2 });
      for (const [dx, dy] of [[-12, 8], [12, 4]] as P2[]) s += path(`M${f(a.head[0] + dx)} ${f(a.head[1] + dy)} q-2 3 0 4 q2 -1 0 -4`, { fill: PAPER, stroke: INK2, w: c.sw * 0.6 });
      s += path(`M88 ${gy - 40} Q100 ${gy - 50} 108 ${gy - 40}`, { stroke: c.accLine, w: c.sw, dash: '2 2' });
      break;
    }
    default:
      break;
  }
  return { svg: s, G };
}

const INSERT_SCALE: Record<string, number> = { gutsang: 1.25, jeonghwasu: 2.6, jusa: 4.2, tal3: 1.5, rock: 1.6 };

/** 카드 id → SVG 안쪽 내용. lod: 0 작은 카드(굵은 선·장식 생략), 1 큰 그림 */
export function sketchInner(cardId: string, lod: 0 | 1 = 1): string {
  const sp = artSpec(cardId);
  const acc = accColor(sp);
  const c: Ctx = { r: rng(hashStr(baseId(cardId))), acc, accLine: acc ? lineColor(acc) : INK2, lod, sw: lod ? 1.05 : 1.35 };
  const fr = FRAMES[sp.framing] ?? FRAMES.medium;
  const gy = sp.framing === 'insert' || sp.framing === 'emblem' ? 90 : fr.gy;
  const ground = gy < VIEW_H ? gy : 98;
  const fam = FAMILIES.has(sp.target) ? sp.target : '';
  const [vsFam, vsN] = sp.vs ? [sp.vs.split('*')[0], Number(sp.vs.split('*')[1] ?? 1)] : ['', 0];
  const tint = sp.acc === 'han' ? acc : null;
  const allProps = sp.props.flat();
  let bg = sp.bg === 'none' ? '' : backdrop(c, sp.bg, ground);
  if (allProps.includes('geumjul') && sp.bg !== 'geumjul') bg += backdrop(c, 'geumjul', ground);
  if (gy < VIEW_H) bg += groundLine(c, gy);

  let behind = '';
  let mid = '';
  let front = '';
  const geo: Geo = { S: [80, 50], H: [80, 50], Htop: [80, 20], T: [], Th: [], ts: fr.ts, W: [], X: null, ground };
  let enemyT: P2[] = [];
  let enemyTh: P2[] = [];

  let emblemGeo = false;
  if (sp.framing === 'emblem') {
    const e = emblem(c, sp, gy);
    mid += e.svg;
    emblemGeo = Object.keys(e.G).length > 0;
    Object.assign(geo, { S: [80, 46], H: [80, 50], Htop: [80, 24], T: [[80, 46]], Th: [] }, e.G);
  } else if (sp.framing === 'insert') {
    const key = sp.props[0][0] ?? 'bujeok';
    if (key === 'janggu') {
      mid += g(janggu({ ...c, sw: c.sw / 2.6 }, 0, 0), 'translate(72 62) scale(2.6)') + g(handProp({ ...c, sw: c.sw / 1.8 }, 'chae'), 'translate(112 74) scale(1.8) rotate(-30)');
      geo.S = [72, 36];
    } else if (key === 'jakdu') {
      const k2: Ctx = { ...c, sw: c.sw / 2.4 };
      let jd = shape(k2, [[-34, -6], [34, -6], [34, 0], [-34, 0]], WASH2, { amp: 0.4 }) + shape(k2, [[-34, -11], [34, -11], [32, -17], [-32, -17]], PAPER, { amp: 0.3 });
      for (const fx0 of [-12, 10]) jd += shape(k2, [[fx0 - 7, -17], [fx0 + 9, -17], [fx0 + 8, -21], [fx0 + 2, -24], [fx0 - 6, -22]], SKIN, { amp: 0.4 }) + shape(k2, [[fx0 - 4, -22], [fx0 + 4, -23], [fx0 + 3, -40], [fx0 - 5, -40]], WASH, { amp: 0.5 });
      mid += g(jd, 'translate(76 86) scale(2.4)');
      geo.S = [76, 46];
    } else if (key === 'rice' || key === 'salt' || key === 'beans') {
      mid += shape(c, [[30, 74], [72, 64], [118, 70], [126, 84], [80, 94], [34, 88]], WASH, { amp: 2 });
      for (let i = 0; i < 46; i++) mid += `<ellipse cx="${f(46 + c.r() * 66 + (i % 3 ? 0 : jit(c, 8)))}" cy="${f(70 + c.r() * 18)}" rx="1.3" ry=".8" fill="${key === 'beans' ? (acc ?? CIN) : PAPER}" stroke="${INK2}" stroke-width=".35"/>`;
      geo.S = [80, 66];
    } else if (SCENE_PROPS.has(key)) {
      const sc = INSERT_SCALE[key] ?? 1.4;
      const r = sceneProp(c, key, 72, 88, sc);
      mid += r.svg;
      geo.S = r.top;
    } else {
      const rr = jit(c, 14) + (key === 'gun' ? 70 : 0);
      const sc = key === 'gun' ? 1.3 : key === 'bujeok' || key === 'jineon' || key === 'scroll' ? 2.4 : 2;
      const cx = 70;
      const cy = key === 'gun' ? 60 : key === 'bangul' ? 76 : key === 'yeomju' ? 36 : 86;
      mid += g(handProp({ ...c, sw: c.sw / sc }, key, 'yangban'), `translate(${cx} ${cy}) scale(${f(sc)}) rotate(${f(rr)})`);
      const k2 = sp.props[0][1];
      if (k2 && SCENE_PROPS.has(k2)) mid += sceneProp(c, k2, 102, 90, 2).svg;
      else if (k2) mid += g(handProp({ ...c, sw: c.sw / 1.6 }, k2, 'yangban'), `translate(96 86) scale(1.6) rotate(${f(20 + jit(c, 10))})`);
      geo.S = key === 'gun' ? [cx + Math.sin(((rr) * Math.PI) / 180) * 50 * sc, cy - Math.cos(((rr) * Math.PI) / 180) * 50 * sc] : [cx, cy - 34 * Math.min(sc, 1.6)];
    }
    geo.H = [72, 50];
    geo.Htop = [72, 18];
    geo.W = [[96, 54]];
    if (fam) {
      const sx = spirits(c, fam, Math.min(sp.count, 2), { ...FRAMES.wide, txs: [[142], [134, 152]] }, { tint, tier: '', boss: '', scale: 0.95 });
      behind += sx.svg;
      enemyT = sx.T;
      enemyTh = sx.Th;
      geo.ts = sx.s;
    } else if (sp.target === 'ally') {
      const a = figure(c, { hero: 'anon', pose: 'idle', props: [], acc: null, dim: true }, 140, 90, 0.4);
      behind += a.svg;
      geo.T = [a.chest];
      geo.W = [[a.chest[0] - 30, a.chest[1]]];
    } else if (sp.target === 'altar' && !SCENE_PROPS.has(key)) {
      const r = sceneProp(c, 'gutsang', 138, 90, 0.6);
      behind += r.svg;
      geo.T = [r.top];
    } else if (sp.target === 'none' || sp.target === 'self') {
      geo.T = [geo.S];
    }
  } else {
    // ── 인물 장면 ──
    const duo = sp.heroes.length === 2;
    const isParty = sp.heroes[0] === 'party';
    let hx = fr.hx + jit(c, 3);
    const hs = (duo ? (sp.framing === 'wide' ? 0.38 : 0.48) : fr.hs) * (1 + jit(c, 0.03));
    if (sp.target === 'self') hx = sp.framing === 'close' ? 64 : 74;
    if (sp.target === 'ally' && !['rescue', 'swap', 'bind'].includes(sp.poses[0]) && !sp.down) hx += sp.framing === 'close' ? 14 : 22;
    if (sp.target === 'ally' && sp.down && sp.poses[0] !== 'rescue') hx += 26;
    if (sp.target === 'party' && !isParty) hx = sp.framing === 'wide' ? 66 : 72;
    if (sp.target === 'none' && !duo) hx = sp.framing === 'close' ? 50 : 52;

    // 동료들
    const allyS = hs * 0.88;
    let allyOut: FigOut | null = null;
    if (sp.target === 'ally') {
      const p0 = sp.poses[0];
      if (p0 === 'rescue') allyOut = figure(c, { hero: 'anon', pose: 'idle', props: [], acc: null, down: true, dim: true }, hx + 70 * hs, gy, allyS);
      else if (sp.down) allyOut = figure(c, { hero: 'anon', pose: 'idle', props: [], acc: null, down: true, dim: true }, hx - 30 * hs, gy, allyS);
      else if (p0 === 'swap' || p0 === 'bind') allyOut = figure(c, { hero: 'anon', pose: 'swap', props: [], acc: null, dim: true }, hx + 66 * hs, gy, allyS);
      else allyOut = figure(c, { hero: 'anon', pose: 'idle', props: [], acc: null, dim: true }, hx - 44 * hs, gy, allyS);
      behind += allyOut.svg;
    }
    const partyOut: FigOut[] = [];
    if (sp.target === 'party' || isParty) {
      const xs = isParty ? [30, 58, 86] : sp.framing === 'wide' ? [16, 38] : [14, 38];
      const pp = isParty ? ['dance', 'drum', 'dance'] : ['idle', 'idle'];
      for (let i = 0; i < xs.length; i++) {
        const o = figure(c, { hero: 'anon', pose: pp[i], props: [], acc: null, dim: !isParty }, xs[i] + jit(c, 2), gy, (isParty ? hs : hs * 0.86));
        partyOut.push(o);
        behind += o.svg;
      }
    }

    // 굿상·장면 소품
    let altarTop: P2 | null = null;
    const altarKey = allProps.includes('bowls3') ? 'bowls3' : allProps.includes('soban') ? 'soban' : 'gutsang';
    const altarX = (sp.framing === 'close' ? 136 : sp.framing === 'wide' ? 118 : 120) - (sp.vs ? 22 : 0);
    const altarS = sp.framing === 'close' ? 0.9 : sp.framing === 'wide' ? 0.5 : 0.62;
    if (sp.target === 'altar') {
      const r = sceneProp(c, altarKey, altarX + jit(c, 2), Math.min(gy, 132), altarS);
      mid += r.svg;
      altarTop = r.top;
      if (allProps.includes('wipae')) mid += sceneProp(c, 'wipae', altarX, r.top[1] + 14 * altarS, altarS * 0.7).svg;
      if (allProps.includes('jeonghwasu')) mid += sceneProp(c, 'jeonghwasu', altarX + 2, r.top[1] + 14 * altarS, altarS * 0.7).svg;
      if (allProps.includes('jihwa') && sp.bg !== 'jihwa') mid += sceneProp(c, 'jihwa', altarX + 20 * altarS + 8, gy, altarS).svg;
    } else if (allProps.includes('gutsang')) {
      mid += sceneProp(c, 'gutsang', hx + 34 * hs + 12, Math.min(gy, 132), hs * 0.6).svg;
    }
    const sceneAt = (key: string, x: number, y: number, s: number, fg = false): void => {
      const r = sceneProp(c, key, x, y, s).svg;
      if (fg) front += r;
      else mid += r;
    };
    if (sp.target !== 'altar') for (const k of ['bowls3', 'soban']) if (allProps.includes(k)) sceneAt(k, hx + 52 * hs + 10, Math.min(gy, 132), hs * 0.8);
    if (allProps.includes('beomjong')) sceneAt('beomjong', hx + 44 * hs + 8, 4 + 64 * 0.5, 0.5);
    if (allProps.includes('eopgyeongdae')) sceneAt('eopgyeongdae', hx + 62 * hs + 8, gy, hs * 0.95);
    if (allProps.includes('crow')) sceneAt('crow', hx + 70 * hs + 10, 26, 0.6);
    if (allProps.includes('hawk')) sceneAt('hawk', 92, 30, 0.75);
    if (allProps.includes('drum') || allProps.includes('buk')) sceneAt('buk', hx + 30 * hs, gy, hs * 0.9);
    if (allProps.includes('jusa')) sceneAt('jusa', hx + 46 * hs, gy, hs * 0.9);
    if (allProps.includes('rock')) sceneAt('rock', hx + 18 * hs, Math.min(gy, 132), hs * 1.1, true);
    if (allProps.includes('bush')) sceneAt('bush', hx + 16 * hs, gy, hs * 1.1, true);

    // 원귀
    const enemyFam = fam || vsFam;
    if (enemyFam) {
      const n = fam ? sp.count : vsN;
      const vsOnly = !fam;
      const ex = spirits(c, enemyFam, n, fr, { tint, tier: sp.tier, boss: sp.boss, shiftX: vsOnly ? 14 : 0, scale: vsOnly ? 0.85 : 1 });
      mid = ex.svg + mid;
      enemyT = ex.T;
      enemyTh = ex.Th;
      geo.ts = ex.s;
    }

    // 영웅
    const heroes: FigOut[] = [];
    const accIdx = sp.acc === 'h1' ? 1 : sp.acc === 'h0' ? 0 : -1;
    if (!isParty) {
      const xs = duo ? [hx - 12, hx + 22 + (sp.framing === 'wide' ? 4 : 8)] : [hx];
      for (let i = 0; i < sp.heroes.length; i++) {
        const hero = sp.heroes[i];
        const heroAcc = accIdx === i && hero !== 'anon' ? acc : null;
        const pose = sp.poses[i] ?? sp.poses[0];
        const sink = sp.framing === 'close' ? (pose === 'rest' || pose === 'write' ? 34 : pose === 'rescue' ? 24 : 0) * hs : 0;
        const o = figure(c, { hero, pose, props: sp.props[i] ?? [], acc: heroAcc, mask: sp.mask || undefined }, xs[i], gy - sink, hs);
        heroes.push(o);
        mid += o.svg;
      }
    } else {
      heroes.push(partyOut[1]);
    }
    const lead = heroes[heroes.length - 1];
    geo.S = lead.tip;
    geo.H = lead.chest;
    geo.Htop = lead.top;
    if (duo && ['beat', 'swirl'].includes(sp.fx)) geo.Htop = [(heroes[0].top[0] + heroes[1].top[0]) / 2, Math.min(heroes[0].top[1], heroes[1].top[1])];
    if (sp.target === 'altar' && altarTop) geo.T = [altarTop];
    else if (sp.target === 'ally' && allyOut) geo.T = [allyOut.chest];
    else if (sp.target === 'party') geo.T = partyOut.map((p) => p.chest);
    else if (sp.target === 'self' || isParty) geo.T = [lead.chest];
    geo.W = sp.target === 'ally' && allyOut ? [allyOut.chest] : sp.target === 'party' || isParty ? partyOut.map((p) => p.chest) : [lead.chest];
    if (sp.target === 'ally' && allyOut) geo.X = [lead.chest, allyOut.chest];
    else if (partyOut.length >= 2) geo.X = [partyOut[0].chest, partyOut[1].chest];
    else if (duo) geo.X = [heroes[0].chest, heroes[1].chest];
  }

  const geoFor = (kind: string): Geo => {
    const G = { ...geo };
    if (enemyT.length && (OFFENSIVE.has(kind) || !G.T.length) && !(kind === 'thread' && sp.target === 'ally')) {
      G.T = enemyT;
      G.Th = enemyTh;
    } else if (!G.T.length) {
      G.T = [[Math.min(150, G.S[0] + 40), G.S[1]]];
    }
    if (kind === 'ripple') G.Th = enemyTh;
    return G;
  };

  let fxs = '';
  const fxOk = sp.framing !== 'emblem' || emblemGeo;
  if (sp.fx2 && fxOk) fxs += fx(c, sp.fx2, geoFor(sp.fx2));
  if (sp.fx && sp.fx !== 'none' && fxOk) fxs += fx(c, sp.fx, geoFor(sp.fx));

  const fib = lod ? fibers(c) : '';
  return `${fib}${bg}${behind}${mid}${front}${fxs}`;
}

/** 완성된 <svg> 문자열 */
export function sketchSvg(cardId: string, lod: 0 | 1 = 1): string {
  const vb = lod ? `0 0 ${VIEW_W} ${VIEW_H}` : '6 4 148 92.5';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke-linecap="round" stroke-linejoin="round">${sketchInner(cardId, lod)}</g></svg>`;
}

