// 넋전 원귀 — 씻김굿에서 망자의 몸으로 오리는 한지 사람. 오린 종이(빈 눈 · 칼집선 · 톱니 단) + 계열 덧붙임 + 뒤쪽 한(恨)의 빛깔.
// 원귀는 왼쪽(영웅 쪽)을 본다. 좌표: 발 가운데 (0,0), 위가 −y. 등급 크기는 그릴 때 곱한다(보스 1.6).
// 무대에서는 이 텍스처를 MeshPlane 에 입혀 가장자리를 펄럭인다(해원 = 펴짐, 처치 = 구김).

import {
  type C2, CINNABAR, GOLD, HANJI, INK, type P, brush, cut, ellipsePts, mix, paperPiece, poly, rgba, rng, roughen, sheet, smooth, softDisc, woodPiece,
} from './paint.ts';

export interface SpiritArt {
  canvas: HTMLCanvasElement;
  /** 단위 상자 */
  box: [number, number, number, number];
  R: number;
  /** 한(恨)의 빛깔 */
  han: string;
  /** 머리 · 가슴 (단위, 발 기준) */
  head: P;
  chest: P;
  /** 펄럭임 세기(계열마다 다르다: 젖은 넋은 무겁게, 굶은 넋은 떨린다) */
  flutter: number;
  /** 보스 소품 */
  boat?: { canvas: HTMLCanvasElement; box: [number, number, number, number] };
  oar?: { canvas: HTMLCanvasElement; box: [number, number, number, number]; pivot: P; hand: P };
}

export const HAN: Record<string, string> = {
  수귀: '#5f8fb0', 객귀: '#a08a6a', '굶주린 넋': '#9c9a78', 잡귀잡신: '#8e7aa6', 억울귀: '#b0564a', 역귀: '#c9873a', '무장 원귀': '#7a8288', '몽달·손각시': '#c27a9a',
};

const R = 2.4;

/** 넋전 몸 윤곽 (오른쪽 반을 만들어 좌우로 붙인다). th = 몸 폭 배율 */
export function spiritOutline(th = 1, seed = 1): P[] {
  const right: P[] = [];
  for (let a = -90; a <= 55; a += 12) right.push([Math.cos((a * Math.PI) / 180) * 14, -106 + Math.sin((a * Math.PI) / 180) * 16]);
  right.push([6, -91], [20 * th, -86], [43 * th, -52], [35 * th, -46], [21 * th, -63], [22 * th, -38], [24 * th, -13]);
  const hem: P[] = [];
  const teeth = 8;
  for (let i = 0; i <= teeth; i++) hem.push([24 * th - (48 * th * i) / teeth, i % 2 ? -1 : -11]);
  const left = right.slice(1).map(([x, y]) => [-x, y] as P).reverse();
  return roughen([...right, ...hem.slice(1, -1), ...left], 0.45, seed, 2.5);
}

function cutsFor(ctx: C2, th: number, eyeL: P, eyeR: P, big = false): void {
  cut(ctx, (c) => {
    // 빈 눈
    for (const [x, y] of [eyeL, eyeR]) {
      c.beginPath();
      c.ellipse(x, y, big ? 3.2 : 2.6, big ? 4.6 : 3.8, -0.1, 0, Math.PI * 2);
      c.fill();
    }
    // 칼집선
    c.lineWidth = 0.9;
    for (const x of [-7, 0, 7]) {
      c.beginPath();
      c.moveTo(x * th, -74);
      c.lineTo(x * th, -30);
      c.stroke();
    }
    // 가슴 마름모 오림
    for (const x of [-8, 0, 8]) {
      poly(c, [[x * th, -84], [x * th + 2.2, -81], [x * th, -78], [x * th - 2.2, -81]]);
      c.fill();
    }
    // 날개 끝 술 오림
    for (const sgn of [-1, 1]) for (let k = 0; k < 3; k++) {
      c.beginPath();
      c.moveTo(sgn * (34 + k * 2.5) * th, -55 + k * 1.5);
      c.lineTo(sgn * (30 + k * 2.5) * th, -62 + k * 1.5);
      c.stroke();
    }
  });
}

type Extra = (ctx: C2, th: number, seed: number) => void;

const EXTRA: Record<string, Extra> = {
  수귀: (c, th, seed) => {
    // 얼굴을 덮은 젖은 머리칼 · 물 흐른 자국 · 물방울
    const r = rng(seed);
    for (let i = 0; i < 15; i++) {
      const x0 = -12 + i * 1.8;
      brush(c, [[x0, -121 + Math.abs(x0) * 0.25], [x0 + (r() - 0.5) * 3, -104], [x0 * 1.25 + (r() - 0.5) * 4, -88 + r() * 6], [x0 * 1.4, -74 + r() * 10]], { w: 1.7 + r() * 0.8, color: r() < 0.5 ? '#141a22' : '#26303c', seed: seed + i, taper: [0.9, 0.05] });
    }
    for (let i = 0; i < 7; i++) {
      const x = (r() - 0.5) * 36 * th;
      const y = -66 + r() * 30;
      brush(c, [[x, y], [x + (r() - 0.5), y + 10 + r() * 14]], { w: 1.1, color: rgba('#5f8fb0', 0.75), seed: seed + 40 + i, taper: [0.3, 0.9] });
    }
  },
  '굶주린 넋': (c, th, seed) => {
    // 갈비 먹선 · 빈 그릇(나무)
    for (let i = 0; i < 3; i++) brush(c, [[-9 * th, -82 + i * 6], [0, -79 + i * 6], [9 * th, -82 + i * 6]], { w: 1, color: rgba(INK, 0.55), seed: seed + i });
    woodPiece(c, smooth([[-15, -58], [11, -58], [8, -50], [-2, -46], [-12, -50]], 3, true), '#7a5a38', { seed: seed + 9, wear: 0.6, outline: 1.1 }, (k) => {
      k.fillStyle = 'rgba(20,12,6,0.6)';
      k.beginPath();
      k.ellipse(-2, -57, 12, 2.2, 0, 0, Math.PI * 2);
      k.fill();
    });
  },
  잡귀잡신: (c, th, seed) => {
    const r = rng(seed);
    for (let i = 0; i < 5; i++) {
      const x = (r() - 0.5) * 70 * th;
      const y = -110 + r() * 90;
      paperPiece(c, roughen([[x, y], [x + 6, y + 1], [x + 4, y + 7], [x - 1, y + 5]], 0.8, seed + i, 1.5), { seed: seed + 10 + i, color: mix(HANJI, '#8e7aa6', 0.3) });
    }
  },
  억울귀: (c, th, seed) => {
    woodPiece(c, [[16, -78], [30, -82], [33, -58], [19, -54]], '#d9cfb0', { seed, wear: 0.5, outline: 0.9 }, (k) => {
      for (let i = 0; i < 4; i++) brush(k, [[20, -76 + i * 5], [29, -78 + i * 5]], { w: 0.8, seed: seed + i, alpha: 0.7 });
    });
  },
  역귀: (c, _th, seed) => {
    for (let i = 0; i < 3; i++) brush(c, [[-12 + i * 12, -124], [-9 + i * 12, -132], [-13 + i * 12, -140], [-10 + i * 12, -148]], { w: 2, color: rgba('#e08a3a', 0.8), seed: seed + i });
    for (const [x, y] of [[-8, -70], [6, -56], [-4, -40]] as P[]) {
      const g = c.createRadialGradient(x, y, 0, x, y, 4);
      g.addColorStop(0, 'rgba(230,110,60,0.7)');
      g.addColorStop(1, 'rgba(230,110,60,0)');
      c.fillStyle = g;
      c.fillRect(x - 4, y - 4, 8, 8);
    }
  },
  '무장 원귀': (c, _th, seed) => {
    woodPiece(c, smooth([[-15, -114], [-8, -128], [8, -128], [15, -114]], 2, true), '#6c7378', { seed, wear: 0.6, outline: 1.2 });
    brush(c, [[0, -127], [0, -138]], { w: 2.2, seed: seed + 1 });
    brush(c, [[-30, -150], [-30, 2]], { w: 2.6, color: '#6b5636', seed: seed + 2, taper: [1, 1] });
    poly(c, [[-30, -160], [-34, -146], [-26, -146]]);
    c.fillStyle = '#8a9298';
    c.fill();
  },
  객귀: (c, _th, seed) => {
    woodPiece(c, smooth([[14, -94], [32, -92], [34, -72], [16, -70]], 2, true), '#8a7454', { seed, wear: 0.5, outline: 1.1 });
    brush(c, [[-34, -70], [-40, 2]], { w: 2.6, color: '#6b5636', seed: seed + 1, taper: [1, 1] });
  },
  '몽달·손각시': (c, _th, seed) => {
    brush(c, [[10, -112], [22, -96], [18, -70], [24, -52]], { w: 3.6, color: CINNABAR, seed, taper: [0.9, 0.2] });
  },
};

export function paintSpiritBody(ctx: C2, family: string, seed: number, o: { th?: number; damp?: number; edge?: string; color?: string } = {}): void {
  const th = o.th ?? (family === '굶주린 넋' ? 0.78 : 1);
  const pts = spiritOutline(th, seed);
  paperPiece(ctx, pts, {
    seed, color: o.color ?? HANJI, damp: o.damp ?? (family === '수귀' ? 0.55 : 0), dampColor: '#4f6678', edge: o.edge ?? (family === '억울귀' ? 'rgba(70,30,12,0.7)' : 'rgba(120,105,80,0.25)'), edgeW: family === '억울귀' ? 6 : 4,
  }, (c) => {
    // 접은 자국: 가운데 세로 주름 하나
    c.strokeStyle = 'rgba(110,95,70,0.22)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(0, -92);
    c.lineTo(0.5, -4);
    c.stroke();
  });
  cutsFor(ctx, th, [-7, -107], [3.5, -107], family === '굶주린 넋');
  EXTRA[family]?.(ctx, th, seed + 100);
}

const CACHE = new Map<string, SpiritArt>();

/** 원귀 하나의 그림. id 는 원귀 정의 id(보스 소품), family 는 계열 */
export function spiritArt(id: string, family: string, tierScale: number): SpiritArt {
  const key = `${id}@${tierScale}`;
  let a = CACHE.get(key);
  if (a) return a;
  const han = HAN[family] ?? '#888';
  const s = tierScale;
  const boss = id === 'sakkun';
  const box: [number, number, number, number] = boss ? [-50 * s, -150 * s, 50 * s, 6 * s] : [-48 * s, -128 * s, 48 * s, 6 * s];
  const sh = sheet(box, R);
  const ctx = sh.ctx;
  ctx.save();
  ctx.scale(s, s);
  const seed = (id.length * 7919 + family.length * 131) | 0;
  if (boss) paintBoatman(ctx, seed);
  else paintSpiritBody(ctx, family, seed);
  ctx.restore();
  a = { canvas: sh.canvas, box, R, han, head: [0, -106 * s], chest: [0, -64 * s], flutter: family === '수귀' ? 0.7 : family === '굶주린 넋' ? 1.15 : 1 };
  if (boss) {
    a.boat = paintBoat(s);
    a.oar = paintOar(s);
  }
  CACHE.set(key, a);
  return a;
}

// ── 뱃사공 (삯 못 받은 뱃사공): 삿갓 · 도롱이 · 노 · 나룻배 ─────────────────
function paintBoatman(ctx: C2, seed: number): void {
  paintSpiritBody(ctx, '수귀', seed, { damp: 0.45 });
  const r = rng(seed + 5);
  // 도롱이: 어깨에서 허리까지 짚을 엮은 비옷
  const cape: P[] = [[-22, -90], [22, -90], [34, -40], [26, -30], [-26, -30], [-34, -40]];
  ctx.save();
  poly(ctx, cape);
  ctx.clip();
  ctx.fillStyle = '#6f5a34';
  ctx.fillRect(-40, -96, 80, 70);
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i < 26; i++) {
      const x = -36 + i * 2.9 + (r() - 0.5);
      const y = -92 + row * 12;
      brush(ctx, [[x, y], [x + (r() - 0.5) * 2, y + 14 + r() * 4]], { w: 1.3 + r() * 0.6, color: r() < 0.5 ? '#a8894f' : '#7d6436', seed: seed + row * 40 + i, taper: [0.8, 0.1] });
    }
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(30,20,10,0.8)';
  ctx.lineWidth = 0.8;
  poly(ctx, cape);
  ctx.stroke();
  // 삿갓: 넓은 원뿔, 대오리 결
  const hat: P[] = [[-38, -116], [0, -146], [38, -116], [30, -112], [-30, -112]];
  woodPiece(ctx, hat, '#b89a5a', { seed: seed + 9, wear: 0.4, grain: 1.2, outline: 1.3 }, (k) => {
    k.strokeStyle = 'rgba(90,60,25,0.55)';
    k.lineWidth = 0.6;
    for (let i = -8; i <= 8; i++) {
      k.beginPath();
      k.moveTo(0, -146);
      k.lineTo(i * 4.6, -113);
      k.stroke();
    }
  });
  // 삿갓 그늘 속 희미한 눈빛
  for (const x of [-7, 3.5]) {
    const g = ctx.createRadialGradient(x, -106, 0, x, -106, 5);
    g.addColorStop(0, 'rgba(200,230,255,0.9)');
    g.addColorStop(1, 'rgba(200,230,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 5, -111, 10, 10);
  }
}

function paintBoat(s: number): { canvas: HTMLCanvasElement; box: [number, number, number, number] } {
  const box: [number, number, number, number] = [-110 * s * 0.75, -26 * s * 0.75, 110 * s * 0.75, 12 * s * 0.75];
  const sh = sheet(box, R);
  const c = sh.ctx;
  c.scale(s * 0.75, s * 0.75);
  // 나룻배: 낮은 판자 배, 이물이 들린다
  const hull: P[] = smooth([[-108, -20], [-84, -6], [-40, 4], [40, 4], [86, -6], [106, -24], [96, -10], [70, 8], [-70, 8], [-98, -8]], 3, true);
  woodPiece(c, hull, '#4a3424', { seed: 501, wear: 0.8, grain: Math.PI / 2, outline: 1.6 }, (k) => {
    k.strokeStyle = 'rgba(15,8,4,0.55)';
    k.lineWidth = 0.9;
    for (const y of [-6, 0, 5]) {
      k.beginPath();
      k.moveTo(-100, y - 6);
      k.quadraticCurveTo(0, y + 6, 100, y - 8);
      k.stroke();
    }
  });
  woodPiece(c, [[-84, -8], [84, -8], [80, -4], [-80, -4]], '#2c1e14', { seed: 502, wear: 0.4, outline: 1 });
  return { canvas: sh.canvas, box };
}

function paintOar(s: number): { canvas: HTMLCanvasElement; box: [number, number, number, number]; pivot: P; hand: P } {
  const k = s;
  const box: [number, number, number, number] = [-10 * k, -70 * k, 10 * k, 96 * k];
  const sh = sheet(box, R);
  const c = sh.ctx;
  c.scale(k, k);
  woodPiece(c, [[-1.8, -66], [1.8, -66], [2.2, 60], [-2.2, 60]], '#7a5a38', { seed: 511, wear: 0.4, outline: 1 });
  woodPiece(c, smooth([[-2.2, 56], [2.2, 56], [7, 70], [6, 92], [-6, 92], [-7, 70]], 2, true), '#6b4a2e', { seed: 512, wear: 0.6, outline: 1.1 });
  return { canvas: sh.canvas, box, pivot: [0, 0], hand: [-28 * k, -60 * k] };
}

// ── 작은 그림: 꽃잎(지화) · 재 · 먹방울 · 물방울 · 작은 넋 · 그림자 ─────────────
export function petalCanvas(color: string, seed: number): HTMLCanvasElement {
  const sh = sheet([-6, -6, 6, 6], 4);
  const c = sh.ctx;
  // 지화 꽃잎: 끝이 오목한 종이 꽃잎
  paperPiece(c, smooth([[0, 5], [-4.5, 0], [-3.5, -4], [-1, -5.5], [0, -3.8], [1, -5.5], [3.5, -4], [4.5, 0]], 3, true), { seed, color, fibers: 0.6, outline: rgba(mix(color, INK, 0.5), 0.6) });
  return sh.canvas;
}

export function ashCanvas(seed: number, ember = false): HTMLCanvasElement {
  const sh = sheet([-5, -5, 5, 5], 4);
  const c = sh.ctx;
  const r = rng(seed);
  const pts = roughen(ellipsePts(0, 0, 3.6 + r(), 2.6 + r(), 7, r() * 3), 0.9, seed, 1);
  poly(c, pts);
  c.fillStyle = ember ? '#4a3a32' : '#5c5852';
  c.fill();
  if (ember) {
    c.strokeStyle = 'rgba(255,140,60,0.9)';
    c.lineWidth = 0.7;
    c.stroke();
  }
  return sh.canvas;
}

export function dropCanvas(color: string): HTMLCanvasElement {
  const sh = sheet([-3, -5, 3, 3], 5);
  const c = sh.ctx;
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(0, -4.5);
  c.quadraticCurveTo(2.6, -0.5, 2.2, 0.8);
  c.arc(0, 0.8, 2.2, 0, Math.PI);
  c.quadraticCurveTo(-2.6, -0.5, 0, -4.5);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.6)';
  c.beginPath();
  c.arc(-0.7, 0.2, 0.6, 0, Math.PI * 2);
  c.fill();
  return sh.canvas;
}

/** 쓰러진 영웅 위의 작은 넋 · 해원 뒤 남는 흰 종이 */
export function soulCanvas(): HTMLCanvasElement {
  const sh = sheet([-48, -128, 48, 6], 1.2);
  paintSpiritBody(sh.ctx, '', 77, { color: '#fbf7ea' });
  return sh.canvas;
}

export { softDisc, GOLD };
