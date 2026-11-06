// 꼭두 영웅 — 상여를 장식하던 채색 목인처럼, 깎아 칠한 나무 부품을 코드로 그린다.
// 부품 이름은 러프(web/src/art/figures.ts · web/src/ui/scene/hero.tsx)와 같다: legs(다리·받침) · body(몸·도포) · head(머리·머리쓰개)
// · backArm/frontArm(팔·소매) · prop(앞손 무구) · backProp(뒷손 무구). 자세 이름도 figures.ts POSES 를 따른다(idle · strike · aim · cast · guard · pray · summon · retreat).
// 좌표: 발 가운데 (0,0), 위가 −y, 얼굴은 +x(오른쪽 = 원귀 쪽). 키 약 150 단위.
// 팔은 "늘어뜨린" 모양으로 그린다(어깨 = 회전축, 손 = (0, ARM)). 회전 0 = 아래, 음수 = 앞으로 들어 올림.

import type { HeroId } from '../../../../src/core/types.ts';
import {
  type C2, CINNABAR, GOLD, INK, type P, SKIN, brush, ellipsePts, inkOutline, mix, poly, rgba, rng, roughen, sheet, smooth, woodPiece,
} from './paint.ts';

export interface Part {
  canvas: HTMLCanvasElement;
  box: [number, number, number, number];
  /** 회전축(단위 좌표, 부품 자기 좌표계) */
  pivot: P;
  R: number;
}

export interface Pose {
  /** 윗몸 기울기(도, 양수 = 앞으로) */
  lean: number;
  /** 뒷팔·앞팔 회전(도, 0 = 늘어뜨림, 음수 = 앞으로 들기) */
  back: number;
  front: number;
  head: number;
  /** 앞손 무구의 화면 기준 각도(도, 0 = 위를 향함) */
  prop: number;
  bprop?: number;
  dx?: number;
  dy?: number;
}

export interface HeroArt {
  id: HeroId;
  color: string;
  legs: Part;
  body: Part;
  head: Part;
  backArm: Part;
  frontArm: Part;
  prop: Part;
  backProp?: Part;
  shoulderB: P;
  shoulderF: P;
  neck: P;
  /** 윗몸 회전축 */
  hip: P;
  /** 무구 끝(무구 자기 좌표): 지팡이 고리 · 총구 · 부채 가운데 */
  tip: P;
  poses: Record<string, Pose>;
  /** 실루엣 열쇠 (문서용) */
  key: string;
}

export const ARM = 36;
const R = 2.6;

function part(box: [number, number, number, number], pivot: P, draw: (ctx: C2) => void, res = R): Part {
  const s = sheet(box, res);
  draw(s.ctx);
  return { canvas: s.canvas, box, pivot, R: res };
}

// ── 공용 조각 ─────────────────────────────────────────────────────────
function pedestal(ctx: C2, seed: number, w = 27): void {
  // 꼭두를 세운 받침: 낮은 나무판, 앞면에 붉은 칠 띠
  woodPiece(ctx, [[-w, -5], [w, -5], [w + 2, 2], [-w - 2, 2]], '#5d3b22', { seed, wear: 0.9, grain: Math.PI / 2, outline: 1.2 }, (c) => {
    c.fillStyle = rgba(CINNABAR, 0.85);
    c.fillRect(-w - 2, -2, 2 * w + 4, 1.6);
  });
}

function shoes(ctx: C2, seed: number, color = '#2b211a', spread = 9): void {
  woodPiece(ctx, [[-spread - 7, -9], [-spread + 5, -9], [-spread + 7, -5], [-spread - 8, -5]], color, { seed, wear: 0.3, outline: 1 });
  woodPiece(ctx, [[spread - 4, -9], [spread + 8, -9], [spread + 12, -5], [spread - 5, -5]], color, { seed: seed + 1, wear: 0.3, outline: 1 });
}

/** 꼭두 얼굴: 흰 분칠 위에 굵은 눈썹 · 작은 눈 · 붉은 입술 · 볼의 붉은 점(무신도) */
function face(ctx: C2, o: { seed: number; skin?: string; brow?: 'arch' | 'thick' | 'gentle'; eye?: 'closed' | 'open' | 'narrow'; lips?: string; cheek?: string; mustache?: boolean; ear?: boolean }): void {
  const cx = 2;
  const cy = -110;
  const pts = smooth(ellipsePts(cx, cy, 15.5, 17.5, 14), 3, true);
  woodPiece(ctx, pts, o.skin ?? SKIN, { seed: o.seed, wear: 0.25, grain: 0.1, facets: [[[cx - 16, cy - 20], [cx - 4, cy - 20], [cx - 8, cy + 20], [cx - 16, cy + 20]]], outline: 1.5 }, (c) => {
    // 볼의 붉은 점
    const g = c.createRadialGradient(cx + 7, cy + 6, 0, cx + 7, cy + 6, 5.5);
    g.addColorStop(0, rgba(o.cheek ?? '#d24a3a', 0.85));
    g.addColorStop(1, rgba(o.cheek ?? '#d24a3a', 0));
    c.fillStyle = g;
    c.fillRect(cx, cy - 2, 14, 14);
  });
  if (o.ear) woodPiece(ctx, smooth(ellipsePts(cx - 9, cy + 1, 3.4, 5, 8), 2, true), o.skin ?? SKIN, { seed: o.seed + 5, wear: 0.2, outline: 1 });
  // 눈썹
  const brow = o.brow ?? 'arch';
  brush(ctx, brow === 'thick' ? [[cx + 1, cy - 7], [cx + 7, cy - 10], [cx + 13, cy - 8]] : brow === 'gentle' ? [[cx + 2, cy - 7], [cx + 8, cy - 9], [cx + 13, cy - 6.5]] : [[cx + 1, cy - 6], [cx + 7, cy - 11], [cx + 13, cy - 8]], { w: brow === 'thick' ? 3 : 2, seed: o.seed + 2, taper: [0.4, 0.2] });
  // 눈
  const eye = o.eye ?? 'open';
  if (eye === 'closed') brush(ctx, [[cx + 4, cy - 2], [cx + 8, cy - 0.5], [cx + 12, cy - 2.5]], { w: 1.3, seed: o.seed + 3, taper: [0.5, 0.3] });
  else if (eye === 'narrow') brush(ctx, [[cx + 5, cy - 2.6], [cx + 9, cy - 3], [cx + 12.5, cy - 2]], { w: 1.8, seed: o.seed + 3 });
  else {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(cx + 8.5, cy - 2.5, 2.2, 1.5, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(cx + 9.2, cy - 3.1, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // 코 · 입
  brush(ctx, [[cx + 14.5, cy - 1], [cx + 16.5, cy + 4], [cx + 14, cy + 5]], { w: 1, seed: o.seed + 4, color: rgba(INK, 0.7) });
  ctx.fillStyle = o.lips ?? CINNABAR;
  ctx.beginPath();
  ctx.ellipse(cx + 11, cy + 10, 2.6, 1.4, -0.15, 0, Math.PI * 2);
  ctx.fill();
  if (o.mustache) {
    brush(ctx, [[cx + 6, cy + 7.5], [cx + 10, cy + 6.5], [cx + 15, cy + 8]], { w: 1.2, seed: o.seed + 6, alpha: 0.85 });
  }
}

/** 늘어뜨린 팔: 소매(어깨 → 소맷부리) + 손. wide = 넓은 무복 소매 */
function armShape(ctx: C2, o: { seed: number; color: string; wide?: number; cuff?: (c: C2) => void; hand?: boolean; skin?: string; deco?: (c: C2) => void }): void {
  const w = o.wide ?? 0;
  const pts: P[] = w
    ? [[-6, -4], [6, -4], [8 + w * 0.3, 12], [10 + w, ARM - 6], [6 + w * 0.6, ARM - 1], [-4, ARM - 2], [-8 - w * 0.7, ARM - 8], [-8, 10]]
    : [[-5.5, -4], [5.5, -4], [6, 14], [5.5, ARM - 6], [-5.5, ARM - 6], [-6, 14]];
  woodPiece(ctx, pts, o.color, { seed: o.seed, wear: 0.4, grain: 0.15, facets: [[[-12 - w, 0], [-1, 0], [-1, ARM], [-12 - w, ARM]]] }, (c) => {
    o.deco?.(c);
    o.cuff?.(c);
  });
  // 어깨 못(꼭두 관절): 부품을 잇는 나무못
  ctx.fillStyle = '#6a4528';
  ctx.beginPath();
  ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,230,190,0.6)';
  ctx.beginPath();
  ctx.arc(-0.6, -0.6, 0.8, 0, Math.PI * 2);
  ctx.fill();
  if (o.hand !== false) {
    woodPiece(ctx, smooth([[-4.2, ARM - 6], [4.2, ARM - 6], [5, ARM - 1], [3, ARM + 4.5], [-2.5, ARM + 4.5], [-5, ARM - 1]], 3, true), o.skin ?? SKIN, { seed: o.seed + 9, wear: 0.2, outline: 1.2 });
  }
}

// ── 승려 ─────────────────────────────────────────────────────────────
function seungnyeo(color: string): HeroArt {
  const robe = '#7d8584'; // 잿빛 장삼
  const gasa = mix(color, '#7a2a18', 0.45); // 괴색 가사
  const legs = part([-32, -14, 34, 4], [0, 0], (c) => {
    pedestal(c, 11);
    shoes(c, 12, '#3b2f26');
  });
  const body = part([-34, -100, 36, 2], [0, 0], (c) => {
    const pts: P[] = [[-14, -95], [14, -95], [21, -62], [28, -8], [14, -3], [-14, -3], [-28, -8], [-21, -62]];
    woodPiece(c, pts, robe, { seed: 21, wear: 0.55, facets: [[[-28, -95], [-6, -95], [-12, -3], [-28, -3]]] }, (k) => {
      // 장삼 주름: 세로 칼질
      for (const x of [-14, -5, 6, 15]) brush(k, [[x * 0.5, -60], [x * 0.8, -30], [x, -6]], { w: 1.4, color: 'rgba(30,30,30,0.35)', seed: 30 + x });
    });
    // 가사: 왼어깨에서 오른허리로 비스듬히 두른 조각보(밭 무늬)
    const g: P[] = [[-15, -95], [-3, -95], [27, -40], [29, -16], [10, -10], [-2, -26]];
    woodPiece(c, g, gasa, { seed: 22, wear: 0.7, grain: 0.6, outline: 1.3 }, (k) => {
      k.strokeStyle = 'rgba(40,12,4,0.65)';
      k.lineWidth = 0.9;
      for (let i = 0; i < 6; i++) {
        k.beginPath();
        k.moveTo(-14 + i * 7, -97);
        k.lineTo(4 + i * 7, -8);
        k.stroke();
      }
      for (let j = 0; j < 7; j++) {
        k.beginPath();
        k.moveTo(-20, -90 + j * 13);
        k.lineTo(34, -70 + j * 13);
        k.stroke();
      }
      // 금빛 고리(가사 고리)
      k.strokeStyle = GOLD;
      k.lineWidth = 1.6;
      k.beginPath();
      k.arc(-4, -80, 3, 0, Math.PI * 2);
      k.stroke();
    });
    // 염주: 목에 건 굵은 알
    for (let i = 0; i < 13; i++) {
      const t = i / 12;
      const x = -9 + t * 21;
      const y = -93 + Math.sin(t * Math.PI) * 20;
      c.fillStyle = '#3a2416';
      c.beginPath();
      c.arc(x, y, 2.3, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,220,170,0.55)';
      c.beginPath();
      c.arc(x - 0.7, y - 0.8, 0.8, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = CINNABAR;
    c.beginPath();
    c.ellipse(2, -70, 2.2, 3.5, 0, 0, Math.PI * 2);
    c.fill();
  });
  const head = part([-22, -136, 24, -88], [1, -92], (c) => {
    face(c, { seed: 31, brow: 'gentle', eye: 'closed', ear: true, lips: '#b8402f', cheek: '#cf5a45' });
    // 깎은 머리: 정수리에 푸른 기
    c.save();
    poly(c, smooth(ellipsePts(2, -110, 15.5, 17.5, 14), 3, true));
    c.clip();
    const g = c.createLinearGradient(0, -128, 0, -112);
    g.addColorStop(0, 'rgba(90,100,110,0.45)');
    g.addColorStop(1, 'rgba(90,100,110,0)');
    c.fillStyle = g;
    c.fillRect(-20, -130, 40, 20);
    c.restore();
  });
  const sleeve = (seed: number) => part([-16, -6, 16, ARM + 7], [0, 0], (c) => armShape(c, { seed, color: robe, wide: 3 }));
  const prop = part([-12, -128, 12, 66], [0, 0], (c) => {
    // 육환장: 나무 지팡이 + 놋쇠 고리 머리(뾰족한 고리에 작은 고리 여섯)
    woodPiece(c, [[-2, -96], [2, -96], [2.4, 62], [-2.4, 62]], '#6b4a2e', { seed: 41, wear: 0.4, outline: 1.1 });
    c.strokeStyle = INK;
    c.lineWidth = 3.4;
    const ring = (w: number, color: string) => {
      c.strokeStyle = color;
      c.lineWidth = w;
      c.beginPath();
      c.moveTo(0, -94);
      c.bezierCurveTo(-11, -100, -10, -118, 0, -124);
      c.bezierCurveTo(10, -118, 11, -100, 0, -94);
      c.stroke();
    };
    ring(4.2, INK);
    ring(2.4, GOLD);
    c.strokeStyle = 'rgba(255,240,190,0.8)';
    c.lineWidth = 0.7;
    c.beginPath();
    c.arc(-3, -112, 5, Math.PI * 0.9, Math.PI * 1.4);
    c.stroke();
    for (const [x, y] of [[-8, -100], [-9.5, -108], [-7, -116], [8, -100], [9.5, -108], [7, -116]] as P[]) {
      c.lineWidth = 2.6;
      c.strokeStyle = INK;
      c.beginPath();
      c.arc(x, y, 2.6, 0, Math.PI * 2);
      c.stroke();
      c.lineWidth = 1.3;
      c.strokeStyle = '#e8c160';
      c.stroke();
    }
    c.fillStyle = GOLD;
    c.beginPath();
    c.arc(0, -126, 1.8, 0, Math.PI * 2);
    c.fill();
  });
  return {
    id: 'seungnyeo', color, legs, body, head, backArm: sleeve(51), frontArm: sleeve(52), prop,
    shoulderB: [-11, -87], shoulderF: [11, -87], neck: [1, -92], hip: [0, -6], tip: [0, -112],
    key: '민머리 · 머리 위로 솟은 고리 지팡이 · 비스듬한 가사',
    poses: {
      idle: { lean: 0, back: 8, front: -38, head: 0, prop: 0 },
      strike: { lean: 12, back: 26, front: -78, head: 6, prop: 72, dx: 58 },
      windup: { lean: -8, back: 30, front: -168, head: -4, prop: -46 },
      guard: { lean: -6, back: -50, front: -64, head: -4, prop: 8 },
      pray: { lean: -2, back: -78, front: -50, head: 10, prop: -6 },
      cast: { lean: -3, back: -70, front: -120, head: -6, prop: -8 },
      hit: { lean: -14, back: 34, front: -10, head: -12, prop: -14, dx: -12 },
      down: { lean: 0, back: 40, front: 30, head: 0, prop: 70 },
    },
  };
}

// ── 만신 ─────────────────────────────────────────────────────────────
const SAEKDONG = ['#c33427', '#e2b23a', '#2f86a6', '#ece6d6', '#3f9a5a'];

function manshin(color: string): HeroArt {
  const robe = color;
  const legs = part([-38, -14, 40, 4], [0, 0], (c) => {
    pedestal(c, 61, 30);
    shoes(c, 62, '#2a1f1a', 10);
  });
  const body = part([-40, -100, 42, 2], [0, 0], (c) => {
    // 남색 치마 자락이 아래로 퍼진다
    woodPiece(c, [[-22, -52], [22, -52], [36, -6], [20, -2], [-20, -2], [-36, -6]], '#2c3f78', { seed: 70, wear: 0.6, facets: [[[-36, -52], [-12, -52], [-14, -2], [-36, -2]]] }, (k) => {
      for (const x of [-22, -10, 2, 14, 26]) brush(k, [[x * 0.55, -50], [x * 0.85, -26], [x, -4]], { w: 1.3, color: 'rgba(10,10,30,0.4)', seed: 71 + x });
      k.fillStyle = rgba(GOLD, 0.8);
      k.fillRect(-40, -12, 80, 2.2);
    });
    // 홍철릭: 붉은 겉옷
    const pts: P[] = [[-15, -95], [15, -95], [22, -64], [27, -30], [10, -22], [-10, -22], [-27, -30], [-22, -64]];
    woodPiece(c, pts, robe, { seed: 72, wear: 0.5, facets: [[[-27, -95], [-6, -95], [-12, -22], [-27, -22]]] }, (k) => {
      // 가슴띠 · 깃
      k.fillStyle = '#e2b23a';
      poly(k, [[-6, -95], [6, -95], [1, -76]]);
      k.fill();
      k.strokeStyle = 'rgba(250,240,220,0.9)';
      k.lineWidth = 2.4;
      k.beginPath();
      k.moveTo(-7, -95);
      k.lineTo(1, -76);
      k.lineTo(8, -95);
      k.stroke();
      // 금박 꽃무늬 점
      const r = rng(73);
      k.fillStyle = rgba(GOLD, 0.7);
      for (let i = 0; i < 16; i++) {
        k.beginPath();
        k.arc(-20 + r() * 40, -88 + r() * 60, 0.9 + r() * 0.8, 0, Math.PI * 2);
        k.fill();
      }
    });
    // 쪽빛 허리띠와 늘어진 고름
    woodPiece(c, [[-24, -56], [24, -56], [24, -50], [-24, -50]], '#2f86a6', { seed: 74, wear: 0.3, outline: 1 });
    brush(c, [[4, -52], [8, -38], [5, -24]], { w: 3.2, color: '#2f86a6', seed: 75 });
    brush(c, [[6, -52], [13, -40], [14, -28]], { w: 2.6, color: '#e2b23a', seed: 76 });
  });
  const head = part([-26, -140, 26, -88], [1, -92], (c) => {
    // 쪽진 머리: 뒤로 틀어 올린 검은 쪽 + 금 비녀
    woodPiece(c, smooth(ellipsePts(-14, -112, 8.5, 7.5, 10), 2, true), '#1c1618', { seed: 81, wear: 0.15, outline: 1.2 });
    brush(c, [[-24, -113], [-14, -112], [-3, -114]], { w: 2.2, color: GOLD, seed: 82, taper: [0.8, 0.8] });
    face(c, { seed: 83, brow: 'arch', eye: 'narrow', lips: '#c0302a', cheek: '#d84a3f' });
    // 머리카락: 이마를 덮는 검은 칠
    c.save();
    poly(c, smooth(ellipsePts(2, -110, 15.5, 17.5, 14), 3, true));
    c.clip();
    c.fillStyle = '#1c1618';
    c.beginPath();
    c.moveTo(-16, -112);
    c.quadraticCurveTo(-4, -134, 14, -124);
    c.quadraticCurveTo(17, -118, 13, -116);
    c.quadraticCurveTo(0, -124, -10, -104);
    c.closePath();
    c.fill();
    c.restore();
    // 붉은 띠(이마)
    brush(c, [[-15, -117], [2, -123], [17, -118]], { w: 3.6, color: CINNABAR, seed: 84, taper: [0.9, 0.9] });
    brush(c, [[-15, -117], [-21, -108], [-19, -98]], { w: 2.6, color: CINNABAR, seed: 85, taper: [0.9, 0.2] });
  });
  // 색동 소매: 넓은 무복 소매 끝에 오방색 띠
  const sleeve = (seed: number) => part([-26, -6, 22, ARM + 7], [0, 0], (c) => armShape(c, {
    seed, color: robe, wide: 9,
    cuff: (k) => {
      SAEKDONG.forEach((col, i) => {
        k.fillStyle = col;
        poly(k, [[-24, ARM - 15 + i * 3.2], [24, ARM - 17 + i * 3.2], [24, ARM - 14 + i * 3.2], [-24, ARM - 12 + i * 3.2]]);
        k.fill();
      });
    },
  }));
  const prop = part([-30, -42, 30, 8], [0, 0], (c) => {
    // 무선: 접혔다 펼치는 부채 — 신령 그림 대신 오방색 띠만
    const fan = (r0: number, r1: number, col: string) => {
      c.fillStyle = col;
      c.beginPath();
      c.arc(0, 0, r1, Math.PI * 1.08, Math.PI * 1.92);
      c.arc(0, 0, r0, Math.PI * 1.92, Math.PI * 1.08, true);
      c.closePath();
      c.fill();
    };
    fan(0, 38, '#efe6cf');
    fan(28, 38, '#2f86a6');
    fan(20, 28, '#e2b23a');
    fan(14, 20, CINNABAR);
    c.strokeStyle = 'rgba(60,40,20,0.55)';
    c.lineWidth = 0.6;
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * (1.08 + (0.84 * i) / 12);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(Math.cos(a) * 38, Math.sin(a) * 38);
      c.stroke();
    }
    c.strokeStyle = INK;
    c.lineWidth = 1.4;
    c.beginPath();
    c.arc(0, 0, 38, Math.PI * 1.08, Math.PI * 1.92);
    c.lineTo(0, 0);
    c.closePath();
    c.stroke();
    woodPiece(c, [[-2.4, -4], [2.4, -4], [1.8, 7], [-1.8, 7]], '#5a3a22', { seed: 91, outline: 1 });
  });
  const backProp = part([-14, -30, 14, 30], [0, 0], (c) => {
    // 방울: 놋쇠 방울 다발 + 오색 천
    ['#c33427', '#e2b23a', '#2f86a6', '#3f9a5a', '#ece6d6'].forEach((col, i) => brush(c, [[0, 2], [-6 + i * 3, 14], [-8 + i * 4, 27]], { w: 2.4, color: col, seed: 92 + i, taper: [0.9, 0.3] }));
    woodPiece(c, [[-1.6, -6], [1.6, -6], [1.6, 4], [-1.6, 4]], '#5a3a22', { seed: 97, outline: 0.8 });
    for (const [x, y] of [[0, -14], [-6, -10], [6, -10], [-4, -20], [4, -20], [0, -26], [-8, -17], [8, -17]] as P[]) {
      const g = c.createRadialGradient(x - 1, y - 1, 0, x, y, 3.6);
      g.addColorStop(0, '#fff2b0');
      g.addColorStop(0.5, GOLD);
      g.addColorStop(1, '#7a5a1a');
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, 3.4, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 0.6;
      c.stroke();
      c.beginPath();
      c.moveTo(x - 1.5, y + 1);
      c.lineTo(x + 1.5, y + 1);
      c.stroke();
    }
  });
  return {
    id: 'manshin', color, legs, body, head, backArm: sleeve(101), frontArm: sleeve(102), prop, backProp,
    shoulderB: [-12, -88], shoulderF: [12, -88], neck: [1, -92], hip: [0, -6], tip: [0, -22],
    key: '쪽진 머리 · 펼친 반달 부채 · 넓은 색동 소매 · 퍼진 치마',
    poses: {
      idle: { lean: 0, back: 14, front: -32, head: 0, prop: 18, bprop: 0 },
      cast: { lean: -5, back: -128, front: -150, head: -8, prop: -14, bprop: -150 },
      summon: { lean: -7, back: -160, front: -165, head: -14, prop: 0, bprop: -170 },
      strike: { lean: 10, back: -40, front: -96, head: 4, prop: 70, bprop: -60, dx: 26 },
      guard: { lean: -6, back: -20, front: -96, head: -6, prop: 82, bprop: -20 },
      hit: { lean: -14, back: 34, front: 6, head: -12, prop: 30, bprop: 30, dx: -12 },
      down: { lean: 0, back: 40, front: 30, head: 0, prop: 80, bprop: 60 },
    },
  };
}

// ── 포수 ─────────────────────────────────────────────────────────────
function posu(color: string): HeroArt {
  const jacket = '#d9cdb0'; // 누비 저고리
  const legs = part([-32, -24, 36, 4], [0, 0], (c) => {
    pedestal(c, 111);
    // 행전 감은 다리 + 짚신
    for (const [x, s] of [[-8, 112], [9, 113]] as [number, number][]) {
      woodPiece(c, [[x - 4.5, -22], [x + 4.5, -22], [x + 4, -8], [x - 4, -8]], '#ece4d0', { seed: s, wear: 0.3, outline: 1 }, (k) => {
        k.strokeStyle = 'rgba(80,70,50,0.6)';
        k.lineWidth = 0.6;
        for (let i = 0; i < 4; i++) {
          k.beginPath();
          k.moveTo(x - 5, -20 + i * 3.6);
          k.lineTo(x + 5, -18.5 + i * 3.6);
          k.stroke();
        }
      });
    }
    shoes(c, 114, '#8a6a3a', 9);
  });
  const body = part([-32, -100, 34, -10], [0, 0], (c) => {
    const pts: P[] = [[-14, -95], [14, -95], [19, -62], [21, -20], [-21, -20], [-19, -62]];
    woodPiece(c, pts, jacket, { seed: 121, wear: 0.5, facets: [[[-21, -95], [-5, -95], [-8, -20], [-21, -20]]] }, (k) => {
      // 누비 줄
      k.strokeStyle = 'rgba(90,70,40,0.35)';
      k.lineWidth = 0.6;
      for (let x = -20; x <= 20; x += 4) {
        k.beginPath();
        k.moveTo(x, -96);
        k.lineTo(x * 1.1, -18);
        k.stroke();
      }
    });
    // 청록 쾌자(조끼)
    woodPiece(c, [[-14, -95], [-3, -95], [2, -60], [-1, -22], [-20, -22], [-18, -62]], color, { seed: 122, wear: 0.6, outline: 1.3 });
    woodPiece(c, [[6, -95], [14, -95], [19, -62], [21, -22], [6, -22], [9, -60]], mix(color, '#123', 0.15), { seed: 123, wear: 0.6, outline: 1.3 });
    // 허리띠 + 화약통(호리병) + 주머니
    woodPiece(c, [[-22, -40], [22, -40], [22, -34], [-22, -34]], '#4a3020', { seed: 124, wear: 0.4, outline: 1 });
    woodPiece(c, smooth([[-22, -36], [-15, -36], [-14, -28], [-11, -22], [-13, -12], [-22, -12], [-25, -22], [-22, -28]], 3, true), '#b07a3a', { seed: 125, wear: 0.5, outline: 1.2 }, (k) => {
      k.strokeStyle = 'rgba(60,30,10,0.6)';
      k.lineWidth = 1;
      k.beginPath();
      k.moveTo(-24, -26);
      k.lineTo(-12, -26);
      k.stroke();
    });
    woodPiece(c, [[8, -36], [17, -36], [18, -24], [7, -24]], '#6b4a2e', { seed: 126, wear: 0.4, outline: 1 });
  });
  const head = part([-26, -142, 28, -88], [1, -92], (c) => {
    face(c, { seed: 131, brow: 'thick', eye: 'open', mustache: true, lips: '#a8382a', cheek: '#c85a46' });
    // 털벙거지: 둥근 모자 + 털 가장자리 + 귀가리개
    woodPiece(c, smooth([[-18, -116], [-14, -132], [2, -138], [18, -132], [21, -118], [10, -122], [-6, -122]], 3, true), '#5a3e28', { seed: 132, wear: 0.4, outline: 1.3 });
    const r = rng(133);
    for (let i = 0; i < 46; i++) {
      const t = i / 45;
      const x = -20 + t * 43;
      const y = -118 + Math.sin(t * Math.PI) * -3;
      brush(c, [[x, y], [x + (r() - 0.5) * 3, y + 3 + r() * 4]], { w: 1.6 + r(), color: r() < 0.5 ? '#8a6a44' : '#3d2a18', seed: 134 + i, taper: [0.9, 0] });
    }
    woodPiece(c, smooth([[-15, -116], [-9, -116], [-8, -100], [-13, -96], [-17, -104]], 2, true), '#7a5a3a', { seed: 135, wear: 0.3, outline: 1 });
  });
  const sleeve = (seed: number) => part([-14, -6, 14, ARM + 7], [0, 0], (c) => armShape(c, {
    seed, color: jacket, wide: 0,
    deco: (k) => {
      k.strokeStyle = 'rgba(90,70,40,0.35)';
      k.lineWidth = 0.6;
      for (let y = 2; y < ARM - 6; y += 4) {
        k.beginPath();
        k.moveTo(-7, y);
        k.lineTo(7, y + 1);
        k.stroke();
      }
    },
  }));
  const prop = part([-10, -112, 12, 40], [0, 0], (c) => {
    // 화승총: 개머리 · 긴 총열 · 놋쇠 띠 · 불씨 줄(화승)
    woodPiece(c, smooth([[-5, 34], [3, 36], [4, 8], [2.6, -6], [-2.6, -6], [-4, 8]], 2, true), '#7a4a26', { seed: 141, wear: 0.5, outline: 1.2, grain: 0 });
    woodPiece(c, [[-2.6, -6], [2.6, -6], [2.2, -64], [-2.2, -64]], '#7a4a26', { seed: 142, wear: 0.4, outline: 1 });
    woodPiece(c, [[-1.6, -40], [1.6, -40], [1.4, -108], [-1.4, -108]], '#2a2a2e', { seed: 143, wear: 0.15, outline: 1, light: 1.6 });
    for (const y of [-20, -44, -62]) {
      c.fillStyle = GOLD;
      c.fillRect(-3, y, 6, 2.2);
      c.strokeStyle = INK;
      c.lineWidth = 0.5;
      c.strokeRect(-3, y, 6, 2.2);
    }
    // 방아쇠와 용두(화승을 무는 고리)
    brush(c, [[2.5, -2], [6, 0], [5.5, 4]], { w: 1.4, seed: 144 });
    brush(c, [[2.6, -12], [7, -16], [9, -13]], { w: 1.6, color: '#3a3a3a', seed: 145 });
    // 화승: 감긴 줄 + 붉은 불씨
    c.strokeStyle = '#c8a46a';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(9, -13);
    c.bezierCurveTo(14, -6, 4, 0, 9, 8);
    c.bezierCurveTo(13, 14, 5, 18, 8, 22);
    c.stroke();
    const g = c.createRadialGradient(9, -14, 0, 9, -14, 4);
    g.addColorStop(0, 'rgba(255,230,140,1)');
    g.addColorStop(0.4, 'rgba(255,120,40,0.9)');
    g.addColorStop(1, 'rgba(255,80,20,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(9, -14, 4, 0, Math.PI * 2);
    c.fill();
  });
  return {
    id: 'posu', color, legs, body, head, backArm: sleeve(151), frontArm: sleeve(152), prop,
    shoulderB: [-10, -88], shoulderF: [10, -88], neck: [1, -92], hip: [0, -20], tip: [0, -108],
    key: '털벙거지 · 어깨에 비스듬히 멘 긴 총 · 허리의 호리병 화약통',
    poses: {
      idle: { lean: 0, back: 12, front: -12, head: 0, prop: 34 },
      aim: { lean: 3, back: -72, front: -86, head: 6, prop: 90 },
      recoil: { lean: -6, back: -66, front: -78, head: -2, prop: 84, dx: -8 },
      retreat: { lean: -12, back: 20, front: -30, head: -6, prop: 50, dx: -22 },
      cast: { lean: 2, back: -60, front: -84, head: 4, prop: 88 },
      guard: { lean: -6, back: -30, front: -60, head: -4, prop: 20 },
      hit: { lean: -14, back: 30, front: 10, head: -12, prop: 50, dx: -12 },
      down: { lean: 0, back: 40, front: 30, head: 0, prop: 80 },
    },
  };
}

const CACHE = new Map<HeroId, HeroArt>();
const MAKERS: Partial<Record<HeroId, (c: string) => HeroArt>> = { seungnyeo, manshin, posu };

/** 슬라이스 영웅 셋의 그림 (한 번만 그린다) */
export function heroArt(id: HeroId, color: string): HeroArt {
  let a = CACHE.get(id);
  if (!a) {
    const m = MAKERS[id];
    if (!m) throw new Error(`slice: no puppet for ${id}`);
    a = m(color);
    CACHE.set(id, a);
  }
  return a;
}

export const SLICE_HEROES: HeroId[] = ['seungnyeo', 'manshin', 'posu'];

/** 카드 삽화·실루엣 시험용: 캔버스 2D 에 한 자세로 조립해 그린다 (무대 PixiJS 리그와 같은 변환) */
export function drawPuppet(ctx: C2, a: HeroArt, pose: Pose, o: { x: number; y: number; s: number; silhouette?: string; flip?: boolean }): void {
  const d2r = Math.PI / 180;
  const tmp = o.silhouette ? document.createElement('canvas') : null;
  let c = ctx;
  if (tmp) {
    tmp.width = ctx.canvas.width;
    tmp.height = ctx.canvas.height;
    c = tmp.getContext('2d')!;
    c.setTransform(ctx.getTransform());
  }
  c.save();
  c.translate(o.x + (pose.dx ?? 0) * o.s, o.y + (pose.dy ?? 0) * o.s);
  c.scale(o.flip ? -o.s : o.s, o.s);
  const draw = (cc: C2) => {
    const pp = (p: Part) => cc.drawImage(p.canvas, p.box[0], p.box[1], p.box[2] - p.box[0], p.box[3] - p.box[1]);
    pp(a.legs);
    cc.save();
    cc.translate(a.hip[0], a.hip[1]);
    cc.rotate(pose.lean * d2r);
    cc.translate(-a.hip[0], -a.hip[1]);
    // 뒷팔
    cc.save();
    cc.translate(a.shoulderB[0], a.shoulderB[1]);
    cc.rotate(pose.back * d2r);
    if (a.backProp) {
      cc.save();
      cc.translate(0, ARM);
      cc.rotate(((pose.bprop ?? 0) - pose.back - pose.lean) * d2r);
      pp(a.backProp);
      cc.restore();
    }
    pp(a.backArm);
    cc.restore();
    pp(a.body);
    cc.save();
    cc.translate(a.neck[0], a.neck[1]);
    cc.rotate(pose.head * d2r);
    cc.translate(-a.neck[0], -a.neck[1]);
    pp(a.head);
    cc.restore();
    cc.save();
    cc.translate(a.shoulderF[0], a.shoulderF[1]);
    cc.rotate(pose.front * d2r);
    pp(a.frontArm);
    cc.translate(0, ARM);
    cc.rotate((pose.prop - pose.front - pose.lean) * d2r);
    pp(a.prop);
    cc.restore();
    cc.restore();
  };
  draw(c);
  c.restore();
  if (tmp) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = o.silhouette!;
    c.fillRect(0, 0, tmp.width, tmp.height);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
  }
}

export { inkOutline, roughen };
