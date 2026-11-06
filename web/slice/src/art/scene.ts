// 1막 「건너지 못한 나루」 밤 무대 — 수묵 번짐으로 칠한 배경 겹(하늘·달 / 먼 산 / 건너편 기슭 / 물 / 선창 / 앞 갈대)과 무대 소품.
// 무대 좌표 1280 × 480, 발선 FY = 330. 겹은 좌우로 조금 넓게(−60 ~ 1340) 그려 패럴랙스로 밀 수 있게 한다.

import {
  type C2, CINNABAR, GOLD, HANJI, INK, type P, brush, ellipsePts, fbm, mix, noise2, paperPiece, poly, rgba, rng, roughen, sheet, smooth, washBlob, woodPiece,
} from './paint.ts';

export const SW = 1280;
export const SH = 480;
export const FY = 330;
export const X0 = -60;
export const X1 = 1340;
export const HORIZON = 258;
export const MOON: P = [1010, 86];
export const LAMP: P = [318, 168];

export interface Layer {
  canvas: HTMLCanvasElement;
  box: [number, number, number, number];
  R: number;
}

const BG_R = 1.5;

function layer(box: [number, number, number, number], draw: (c: C2) => void, R = BG_R): Layer {
  const s = sheet(box, R);
  draw(s.ctx);
  return { canvas: s.canvas, box, R };
}

// ── 하늘·달 ───────────────────────────────────────────────────────────
export function paintSky(): Layer {
  return layer([X0, 0, X1, 300], (c) => {
    const g = c.createLinearGradient(0, 0, 0, 300);
    g.addColorStop(0, '#05070f');
    g.addColorStop(0.4, '#101830');
    g.addColorStop(0.82, '#24304f');
    g.addColorStop(1, '#2e3a5c');
    c.fillStyle = g;
    c.fillRect(X0, 0, X1 - X0, 300);
    const r = rng(9);
    // 별: 달에서 멀수록 조금 더
    for (let i = 0; i < 90; i++) {
      const x = X0 + r() * (X1 - X0);
      const y = r() * 210;
      const dm = Math.hypot(x - MOON[0], y - MOON[1]);
      if (dm < 160 && r() < 0.8) continue;
      c.fillStyle = `rgba(230,232,255,${0.15 + r() * 0.45})`;
      c.beginPath();
      c.arc(x, y, 0.35 + r() * 0.7, 0, Math.PI * 2);
      c.fill();
    }
    // 달무리
    const halo = c.createRadialGradient(MOON[0], MOON[1], 20, MOON[0], MOON[1], 230);
    halo.addColorStop(0, 'rgba(214,222,236,0.42)');
    halo.addColorStop(0.3, 'rgba(160,176,206,0.14)');
    halo.addColorStop(1, 'rgba(120,140,180,0)');
    c.fillStyle = halo;
    c.fillRect(MOON[0] - 240, MOON[1] - 240, 480, 480);
    // 달: 비워 둔 종이처럼 — 둘레를 먹으로 번지게 하고 안은 한지빛
    c.save();
    c.beginPath();
    c.arc(MOON[0], MOON[1], 31, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = '#f1ead2';
    c.fillRect(MOON[0] - 32, MOON[1] - 32, 64, 64);
    for (let i = 0; i < 9; i++) washBlob(c, MOON[0] - 14 + r() * 26, MOON[1] - 14 + r() * 26, 5 + r() * 9, 4 + r() * 7, '#b9b39c', 0.18);
    c.restore();
    // 먹구름 띠: 달 아래쪽을 가로질러 번진다
    for (let i = 0; i < 16; i++) {
      const x = MOON[0] - 260 + r() * 520;
      const y = MOON[1] + 18 + r() * 60;
      washBlob(c, x, y, 70 + r() * 110, 6 + r() * 9, '#0a0e1c', 0.35 + r() * 0.25);
    }
    for (let i = 0; i < 12; i++) washBlob(c, X0 + r() * (X1 - X0), 40 + r() * 140, 90 + r() * 160, 8 + r() * 12, '#0b1022', 0.25 + r() * 0.2);
  });
}

// ── 먼 산 (두 겹 능선, 미점) ─────────────────────────────────────────────
function ridge(seed: number, base: number, amp: number, peaks: number): (x: number) => number {
  const n = noise2(seed);
  const r = rng(seed);
  const ph = [r() * 6, r() * 6, r() * 6];
  return (x) => base - amp * (0.55 * Math.abs(Math.sin(x / (1400 / peaks) + ph[0])) + 0.3 * Math.sin(x / 97 + ph[1]) * 0.5 + 0.25 * fbm(n, x / 70, 0.5, 3));
}

export function paintMountains(): Layer {
  return layer([X0, 110, X1, 290], (c) => {
    const far = ridge(31, 236, 88, 3.2);
    const near = ridge(57, 262, 70, 4.6);
    const fill = (f: (x: number) => number, top: string, alpha: number, fade: number) => {
      const pts: P[] = [];
      for (let x = X0; x <= X1; x += 6) pts.push([x, f(x)]);
      pts.push([X1, 290], [X0, 290]);
      const g = c.createLinearGradient(0, 130, 0, fade);
      g.addColorStop(0, rgba(top, alpha));
      g.addColorStop(0.55, rgba(top, alpha * 0.75));
      g.addColorStop(1, rgba(top, 0));
      c.fillStyle = g;
      poly(c, pts);
      c.fill();
      // 능선의 먹 획
      const line: P[] = [];
      for (let x = X0; x <= X1; x += 18) line.push([x, f(x) + 1]);
      for (let k = 0; k < line.length - 6; k += 5) brush(c, line.slice(k, k + 7), { w: 2.6, color: rgba(mix(top, '#000', 0.55), 0.55), seed: k + alpha * 100, dry: 0.6, taper: [0.2, 0.3] });
    };
    fill(far, '#3d4a6e', 0.85, 268);
    fill(near, '#1f2741', 0.95, 286);
    // 미점(米點): 가까운 능선 위 나무 점
    const r = rng(77);
    for (let i = 0; i < 260; i++) {
      const x = X0 + r() * (X1 - X0);
      const y = near(x) + 2 + r() * 14;
      c.fillStyle = rgba('#0c101e', 0.25 + r() * 0.35);
      c.beginPath();
      c.ellipse(x, y, 1.6 + r() * 2.4, 0.9 + r() * 1.2, 0, 0, Math.PI * 2);
      c.fill();
    }
    // 산허리 안개
    for (let i = 0; i < 10; i++) washBlob(c, X0 + r() * (X1 - X0), 250 + r() * 20, 120 + r() * 140, 10 + r() * 8, '#7e8cad', 0.18);
  });
}

// ── 건너편 기슭: 둑 · 버드나무 · 주막 · 솟대 ───────────────────────────────
export function paintFarBank(): Layer {
  return layer([X0, 190, X1, 275], (c) => {
    const r = rng(101);
    const bank: P[] = [[X0, 262]];
    for (let x = X0; x <= X1; x += 20) bank.push([x, 257 + Math.sin(x / 63) * 2 + r() * 2]);
    bank.push([X1, 266], [X0, 266]);
    c.fillStyle = '#121828';
    poly(c, bank);
    c.fill();
    // 갈대 줄
    for (let i = 0; i < 160; i++) {
      const x = X0 + r() * (X1 - X0);
      const h = 6 + r() * 12;
      brush(c, [[x, 259], [x + (r() - 0.3) * 4, 259 - h]], { w: 0.9, color: rgba('#0d1220', 0.9), seed: i, taper: [1, 0] });
    }
    // 주막: 초가 지붕 + 따뜻한 창
    const hx = 860;
    woodPiece(c, [[hx - 26, 258], [hx + 26, 258], [hx + 24, 240], [hx - 24, 240]], '#1d2131', { seed: 102, wear: 0, outline: 0.6, light: 0.2 });
    poly(c, smooth([[hx - 34, 242], [hx - 20, 226], [hx + 18, 224], [hx + 36, 241]], 3));
    c.fillStyle = '#262a3a';
    c.fill();
    const win = c.createRadialGradient(hx + 6, 249, 0, hx + 6, 249, 16);
    win.addColorStop(0, 'rgba(255,196,110,0.9)');
    win.addColorStop(0.3, 'rgba(255,160,80,0.35)');
    win.addColorStop(1, 'rgba(255,160,80,0)');
    c.fillStyle = win;
    c.fillRect(hx - 12, 233, 36, 32);
    c.fillStyle = '#ffcf86';
    c.fillRect(hx + 3, 246, 6, 6);
    // 솟대: 장대 끝의 나무 새
    for (const [sx, h] of [[700, 64], [722, 52]] as [number, number][]) {
      brush(c, [[sx, 259], [sx + 1, 259 - h]], { w: 1.4, color: '#0b0f1c', seed: sx, taper: [1, 1] });
      brush(c, [[sx - 6, 259 - h - 1], [sx + 1, 259 - h - 3], [sx + 7, 259 - h - 7]], { w: 2.4, color: '#0b0f1c', seed: sx + 1, taper: [0.6, 0.1] });
    }
    // 버드나무: 늘어진 가지
    const tx = 1180;
    brush(c, [[tx, 260], [tx - 3, 230], [tx + 4, 205]], { w: 6, color: '#0b0f1c', seed: 103, taper: [1, 0.5] });
    for (let i = 0; i < 26; i++) {
      const sx = tx - 30 + r() * 60;
      const sy = 200 + r() * 14;
      brush(c, [[tx + 2, 206], [sx, sy - 4], [sx + (r() - 0.5) * 6, sy + 22 + r() * 18]], { w: 1, color: rgba('#0b0f1c', 0.85), seed: 200 + i, taper: [0.3, 0] });
    }
  });
}

// ── 물 (반사의 바탕): 거꾸로 비친 산 · 달기둥 ───────────────────────────────
export function paintWater(): Layer {
  return layer([X0, HORIZON - 4, X1, SH], (c) => {
    const g = c.createLinearGradient(0, HORIZON, 0, SH);
    g.addColorStop(0, '#26304e');
    g.addColorStop(0.25, '#151d34');
    g.addColorStop(1, '#070a14');
    c.fillStyle = g;
    c.fillRect(X0, HORIZON - 4, X1 - X0, SH - HORIZON + 4);
    const near = ridge(57, 262, 70, 4.6);
    // 비친 능선(눌러 뒤집음)
    const pts: P[] = [];
    for (let x = X0; x <= X1; x += 8) pts.push([x, HORIZON + (262 - near(x)) * 0.55]);
    pts.push([X1, HORIZON], [X0, HORIZON]);
    c.fillStyle = 'rgba(8,11,22,0.55)';
    poly(c, pts);
    c.fill();
    // 달기둥: 끊긴 가로 물빛
    const r = rng(303);
    const col = c.createLinearGradient(0, HORIZON, 0, SH);
    col.addColorStop(0, 'rgba(236,236,222,0.95)');
    col.addColorStop(1, 'rgba(225,228,214,0.18)');
    for (let i = 0; i < 120; i++) {
      const y = HORIZON + 4 + Math.pow(r(), 1.3) * (SH - HORIZON - 10);
      const spread = 8 + (y - HORIZON) * 0.25;
      const x = MOON[0] + (r() - 0.5) * spread * 2;
      const w = 6 + r() * (12 + (y - HORIZON) * 0.15);
      c.fillStyle = col;
      c.globalAlpha = 0.25 + r() * 0.6;
      c.fillRect(x - w / 2, y, w, 0.8 + r() * 1.4);
    }
    c.globalAlpha = 1;
    washBlob(c, MOON[0], HORIZON + 40, 70, 60, '#c8d0e4', 0.2);
    // 물결 결
    for (let i = 0; i < 120; i++) {
      const y = HORIZON + 6 + r() * (SH - HORIZON);
      const x = X0 + r() * (X1 - X0);
      c.strokeStyle = `rgba(150,170,210,${0.04 + r() * 0.06})`;
      c.lineWidth = 0.6;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + 20, y - 1.5, x + 40 + r() * 40, y);
      c.stroke();
    }
  });
}

// ── 선창: 판자 · 말뚝 (파티가 선 자리) ───────────────────────────────────
export function paintDock(): Layer {
  return layer([X0, 300, 640, SH], (c) => {
    const r = rng(404);
    // 말뚝(물속으로)
    for (const x of [-20, 110, 240, 370, 500, 600]) {
      woodPiece(c, [[x - 7, 338], [x + 7, 338], [x + 8, 470], [x - 8, 470]], '#2c2119', { seed: 410 + x, wear: 0.5, outline: 1.1, light: 0.5 });
      // 물에 잠긴 자리
      c.fillStyle = 'rgba(8,12,24,0.5)';
      c.fillRect(x - 10, 430, 20, 40);
    }
    // 앞 들보
    woodPiece(c, [[X0, 336], [618, 336], [622, 352], [X0, 352]], '#3a2a1e', { seed: 420, wear: 0.7, grain: Math.PI / 2, outline: 1.2, light: 0.7 });
    // 윗판: 판자 이음과 못
    woodPiece(c, [[X0, 322], [612, 322], [618, 337], [X0, 337]], '#5d4430', { seed: 421, wear: 0.9, grain: Math.PI / 2, outline: 1.2, light: 1.2 }, (k) => {
      for (let x = X0 + 30; x < 615; x += 34 + r() * 10) {
        k.strokeStyle = 'rgba(20,10,4,0.6)';
        k.lineWidth = 0.9;
        k.beginPath();
        k.moveTo(x, 322);
        k.lineTo(x + 2, 337);
        k.stroke();
        k.fillStyle = 'rgba(30,20,10,0.8)';
        k.beginPath();
        k.arc(x - 4, 329, 0.8, 0, Math.PI * 2);
        k.fill();
      }
    });
    // 매어 둔 밧줄
    brush(c, [[600, 344], [618, 360], [636, 372]], { w: 2.2, color: '#a08a5a', seed: 430 });
  });
}

/** 물속 말뚝 + 매어 둔 빈 배 (가운데 겹) */
export function paintMoorings(): Layer {
  return layer([600, 200, X1, 340], (c) => {
    for (const [x, top, w] of [[660, 236, 6], [1088, 226, 7], [1250, 244, 5]] as [number, number, number][]) {
      woodPiece(c, [[x - w, top], [x + w, top + 2], [x + w + 1, 318], [x - w - 1, 318]], '#2a2019', { seed: x, wear: 0.6, outline: 1, light: 0.35 });
      c.fillStyle = 'rgba(160,180,220,0.18)';
      c.beginPath();
      c.ellipse(x, 317, w * 2.8, 2.2, 0, 0, Math.PI * 2);
      c.fill();
    }
    // 빈 나룻배: 말뚝에 매여 흔들린다(이 배는 정지 그림, 흔들림은 무대가 준다)
    brush(c, [[1088, 262], [1110, 284], [1126, 290]], { w: 1.4, color: '#8f7a52', seed: 61 });
  });
}

export function paintMooredBoat(): Layer {
  return layer([-70, -24, 70, 10], (c) => {
    const hull = smooth([[-66, -16], [-48, -4], [-20, 3], [24, 3], [50, -3], [66, -18], [58, -6], [40, 6], [-40, 6], [-58, -4]], 3, true);
    woodPiece(c, hull, '#2a1f17', { seed: 71, wear: 0.6, grain: Math.PI / 2, outline: 1.2, light: 0.4 });
    brush(c, [[-30, -6], [-28, -22]], { w: 1.4, color: '#2a1f17', seed: 72, taper: [1, 1] });
  }, 2);
}

// ── 앞 갈대 · 안개 ────────────────────────────────────────────────────
export function paintReeds(seed: number, w: number, h: number, dark = '#06080f'): Layer {
  return layer([-w / 2, -h, w / 2, 4], (c) => {
    const r = rng(seed);
    for (let i = 0; i < 26; i++) {
      const x = (r() - 0.5) * w;
      const top = -h * (0.55 + r() * 0.45);
      const bend = (r() - 0.3) * 30;
      brush(c, [[x, 2], [x + bend * 0.3, top * 0.5], [x + bend, top]], { w: 2 + r() * 2.2, color: dark, seed: seed + i, taper: [1, 0] });
      if (r() < 0.55) {
        // 갈대꽃: 깃털 같은 먹 번짐
        for (let k = 0; k < 7; k++) brush(c, [[x + bend, top], [x + bend + 4 + r() * 8, top + 3 + r() * 10]], { w: 1.2, color: rgba('#2a2c34', 0.8), seed: seed + i * 10 + k, taper: [0.6, 0] });
      }
    }
    for (let i = 0; i < 9; i++) {
      const x = (r() - 0.5) * w;
      brush(c, [[x, 2], [x + 18 + r() * 20, -h * 0.35 - r() * 30]], { w: 3.2, color: dark, seed: seed + 90 + i, taper: [1, 0] });
    }
  }, 1.6);
}

export function mistCanvas(w: number, h: number, seed: number, color = '#c3cce0'): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const r = rng(seed);
  for (let i = 0; i < 26; i++) washBlob(ctx, r() * w, h * (0.35 + r() * 0.35), w * (0.08 + r() * 0.16), h * (0.18 + r() * 0.2), color, 0.12 + r() * 0.12);
  return c;
}

// ── 금줄: 새끼줄 + 흰 종이 술 ────────────────────────────────────────────
export function paintRope(): Layer {
  return layer([X0, -4, X1, 18], (c) => {
    const pts: P[] = [];
    for (let x = X0; x <= X1; x += 40) pts.push([x, 5 + Math.sin((x - X0) / 140) * 2.2]);
    brush(c, pts, { w: 6.5, color: '#8a7448', seed: 501, taper: [1, 1], wobble: 0.05 });
    // 꼬임
    c.strokeStyle = 'rgba(40,28,12,0.55)';
    c.lineWidth = 0.9;
    for (let x = X0; x <= X1; x += 5) {
      const y = 5 + Math.sin((x - X0) / 140) * 2.2;
      c.beginPath();
      c.moveTo(x - 2, y - 3);
      c.lineTo(x + 2, y + 3);
      c.stroke();
    }
  });
}

export function paintTassel(seed: number): Layer {
  return layer([-6, -2, 6, 30], (c) => {
    // 오린 종이 술: 지그재그로 접은 한지
    const pts: P[] = [[-3, 0], [3, 0], [3, 7], [-2, 9], [4, 14], [-1, 17], [4, 22], [0, 28], [-4, 24], [0, 19], [-4, 15], [1, 11], [-3, 8]];
    paperPiece(c, roughen(pts, 0.3, seed, 1.5), { seed, color: '#f3ecd6', fibers: 0.5 });
  }, 3);
}

// ── 굿상: 낮은 상 · 정화수 · 떡 · 지화 · 촛대 ─────────────────────────────
export function paintAltar(): Layer {
  return layer([-58, -78, 58, 4], (c) => {
    // 상다리
    for (const x of [-44, 40]) woodPiece(c, [[x - 3, -26], [x + 3, -26], [x + 4, 2], [x - 4, 2]], '#4a2418', { seed: 600 + x, wear: 0.5, outline: 1 });
    // 상판(흰 상보)
    woodPiece(c, [[-52, -34], [52, -34], [50, -24], [-50, -24]], '#5a2a20', { seed: 610, wear: 0.6, outline: 1.2 });
    paperPiece(c, [[-48, -36], [48, -36], [44, -26], [36, -22], [-36, -22], [-44, -26]], { seed: 611, color: '#efe8d4' });
    // 정화수 그릇 · 떡
    woodPiece(c, smooth([[-34, -44], [-20, -44], [-22, -36], [-32, -36]], 2, true), '#e9e4d8', { seed: 620, wear: 0.1, outline: 1 });
    c.fillStyle = 'rgba(140,170,220,0.7)';
    c.fillRect(-33, -44, 12, 1.6);
    woodPiece(c, [[-12, -48], [10, -48], [10, -36], [-12, -36]], '#f4efe0', { seed: 621, wear: 0.1, outline: 1 }, (k) => {
      k.strokeStyle = 'rgba(120,100,70,0.4)';
      k.lineWidth = 0.5;
      for (const y of [-44, -40]) {
        k.beginPath();
        k.moveTo(-12, y);
        k.lineTo(10, y);
        k.stroke();
      }
    });
    // 지화 꽃병
    woodPiece(c, smooth([[18, -50], [30, -50], [32, -40], [28, -36], [20, -36], [16, -40]], 2, true), '#3a5a6a', { seed: 630, wear: 0.4, outline: 1 });
    const r = rng(631);
    const cols = ['#e86f8a', '#f2e6c8', '#e2b23a', '#c33427', '#f0a6b8'];
    for (let i = 0; i < 9; i++) {
      const x = 24 + (r() - 0.5) * 22;
      const y = -58 - r() * 18;
      brush(c, [[24, -50], [x, y + 6]], { w: 0.8, color: '#3f6a3a', seed: 632 + i });
      paperPiece(c, smooth(ellipsePts(x, y, 3.6, 3, 7), 2, true), { seed: 640 + i, color: cols[i % cols.length], fibers: 0.4 });
    }
    // 촛대(불꽃은 무대가 따로 그려 흔든다)
    for (const x of [-42, 40]) {
      woodPiece(c, [[x - 4, -38], [x + 4, -38], [x + 2, -34], [x - 2, -34]], GOLD, { seed: 650 + x, wear: 0.2, outline: 0.8 });
      woodPiece(c, [[x - 2, -50], [x + 2, -50], [x + 2, -38], [x - 2, -38]], '#f2ead4', { seed: 660 + x, wear: 0.05, outline: 0.8 });
    }
  }, 2.4);
}

export const CANDLES: P[] = [[-42, -52], [40, -52]];

export function flameCanvas(): HTMLCanvasElement {
  const sh = sheet([-5, -14, 5, 2], 6);
  const c = sh.ctx;
  const g = c.createRadialGradient(0, -3, 0, 0, -4, 9);
  g.addColorStop(0, 'rgba(255,250,220,1)');
  g.addColorStop(0.35, 'rgba(255,200,90,0.95)');
  g.addColorStop(1, 'rgba(255,120,40,0)');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(0, -13);
  c.bezierCurveTo(4, -6, 4, 0, 0, 1);
  c.bezierCurveTo(-4, 0, -4, -6, 0, -13);
  c.fill();
  return sh.canvas;
}

/** 굿상 위 신위: 흰 종이 위패 (신령 얼굴은 그리지 않는다 — 빛과 빈 자리로만) */
export function paintTablet(color: string): Layer {
  return layer([-8, -30, 8, 2], (c) => {
    paperPiece(c, [[-5.5, -26], [5.5, -26], [6, 0], [-6, 0]], { seed: 680, color: '#fbf6e6' });
    c.fillStyle = color;
    c.fillRect(-6, -8, 12, 2.4);
    brush(c, [[0, -21], [0, -12]], { w: 1.4, color: rgba(INK, 0.6), seed: 681 });
    woodPiece(c, [[-7, 0], [7, 0], [7, 3], [-7, 3]], '#4a2418', { seed: 682, outline: 0.7 });
  }, 3);
}

// ── 넋등: 대나무 장대 + 한지 등 ──────────────────────────────────────────
export function paintLampPole(): Layer {
  return layer([LAMP[0] - 30, LAMP[1] - 30, LAMP[0] + 30, FY + 4], (c) => {
    const px = LAMP[0] - 18;
    woodPiece(c, [[px - 2.2, LAMP[1] - 22], [px + 2.2, LAMP[1] - 22], [px + 3, FY], [px - 3, FY]], '#6f7a3a', { seed: 701, wear: 0.4, outline: 1, grain: 0 }, (k) => {
      // 대나무 마디
      k.strokeStyle = 'rgba(30,30,10,0.7)';
      k.lineWidth = 1;
      for (let y = LAMP[1]; y < FY; y += 26) {
        k.beginPath();
        k.moveTo(px - 3.5, y);
        k.lineTo(px + 3.5, y);
        k.stroke();
      }
    });
    brush(c, [[px, LAMP[1] - 20], [px + 9, LAMP[1] - 26], [LAMP[0], LAMP[1] - 18]], { w: 2.2, color: '#6f7a3a', seed: 702, taper: [1, 0.6] });
    brush(c, [[LAMP[0], LAMP[1] - 18], [LAMP[0], LAMP[1] - 12]], { w: 0.8, color: '#2a2018', seed: 703 });
  });
}

export function paintLantern(): Layer {
  return layer([-14, -16, 14, 18], (c) => {
    const body = smooth(ellipsePts(0, 1, 11, 13, 12), 3, true);
    const g = c.createRadialGradient(0, 2, 1, 0, 2, 14);
    g.addColorStop(0, '#fff6d8');
    g.addColorStop(0.5, '#ffd27a');
    g.addColorStop(1, '#e08a3a');
    c.fillStyle = g;
    poly(c, body);
    c.fill();
    c.strokeStyle = 'rgba(120,60,20,0.55)';
    c.lineWidth = 0.7;
    for (const x of [-7, -3.5, 0, 3.5, 7]) {
      c.beginPath();
      c.moveTo(x * 0.5, -12);
      c.quadraticCurveTo(x * 1.55, 1, x * 0.5, 14);
      c.stroke();
    }
    woodPiece(c, [[-6, -14], [6, -14], [6, -11], [-6, -11]], '#3a2a1a', { seed: 711, outline: 0.7 });
    woodPiece(c, [[-6, 13], [6, 13], [6, 16], [-6, 16]], '#3a2a1a', { seed: 712, outline: 0.7 });
    brush(c, [[0, 16], [0.5, 20]], { w: 1.4, color: CINNABAR, seed: 713, taper: [1, 0] });
  }, 4);
}

/** 넋등 빛이 닿지 않는 어둠(구멍 뚫린 막) — 낮은 해상도면 충분하다 */
export function darkness(light: number): HTMLCanvasElement {
  const R = 0.5;
  const c = document.createElement('canvas');
  c.width = SW * R;
  c.height = SH * R;
  const ctx = c.getContext('2d')!;
  ctx.scale(R, R);
  const edge = 0.42 + (1 - light / 100) * 0.42;
  ctx.fillStyle = `rgba(3,4,10,${edge})`;
  ctx.fillRect(0, 0, SW, SH);
  ctx.globalCompositeOperation = 'destination-out';
  const rad = 260 + light * 2.4;
  const g = ctx.createRadialGradient(LAMP[0] + 40, LAMP[1] + 90, 30, LAMP[0] + 40, LAMP[1] + 90, rad);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.75)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SW, SH);
  // 달빛이 닿는 오른쪽 위는 조금 덜 어둡다
  const m = ctx.createRadialGradient(MOON[0], MOON[1] + 120, 10, MOON[0], MOON[1] + 120, 330);
  m.addColorStop(0, 'rgba(0,0,0,0.75)');
  m.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = m;
  ctx.fillRect(0, 0, SW, SH);
  // 가장자리 어둠(비네트)도 같은 막에
  ctx.globalCompositeOperation = 'source-over';
  const v = ctx.createRadialGradient(SW / 2, SH * 0.55, SH * 0.6, SW / 2, SH * 0.5, SW * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, SW, SH);
  return c;
}

/** 여러 겹을 한 장으로 (같은 패럴랙스 배율로 움직일 정지 그림) */
export function mergeLayers(box: [number, number, number, number], parts: (Layer | { canvas: HTMLCanvasElement; box: [number, number, number, number]; alpha?: number })[], R = BG_R): Layer {
  return layer(box, (c) => {
    for (const p of parts) {
      c.save();
      c.globalAlpha = 'alpha' in p && p.alpha !== undefined ? p.alpha : 1;
      c.drawImage(p.canvas, p.box[0], p.box[1], p.box[2] - p.box[0], p.box[3] - p.box[1]);
      c.restore();
    }
  }, R);
}

/** 정지 겹에 넋등 어둠 · 한지 결을 미리 입힌다 — 화면 전체를 덮는 막을 매 프레임 그리지 않으려고(채움 비용, 12-graphic-slice §5) */
export function bake(l: Layer, dark: HTMLCanvasElement, grain: HTMLCanvasElement): Layer {
  const ctx = l.canvas.getContext('2d')!;
  ctx.save();
  ctx.setTransform(l.R, 0, 0, l.R, -l.box[0] * l.R, -l.box[1] * l.R);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.drawImage(dark, -70, 0, SW + 140, SH);
  ctx.restore();
  // 한지 결: 겹 모양으로 오린 결 무늬를 곱한다
  const t = document.createElement('canvas');
  t.width = l.canvas.width;
  t.height = l.canvas.height;
  const tc = t.getContext('2d')!;
  tc.fillStyle = tc.createPattern(grain, 'repeat')!;
  tc.fillRect(0, 0, t.width, t.height);
  tc.globalCompositeOperation = 'destination-in';
  tc.drawImage(l.canvas, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(t, 0, 0);
  ctx.restore();
  return l;
}

export { HANJI };
