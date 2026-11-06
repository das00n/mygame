// 카드 삽화(16:10) — 슬라이스 덱(승려·만신·포수 시작 카드 12장)을 스케치에서 "먹과 채색" 완성 그림으로 올린다.
// 지시서(data/art/cards.json → web/src/art/table.ts 의 구조 칸: pose · target · fx · framing · bg · accent)를 그대로 읽고,
// 무대와 같은 재료(채색 목인 부품 · 넋전 한지 · 수묵 번짐)로 짠다. 나머지 카드는 스케치 그대로 둔다(새 틀 안에서).

import { artSpec, baseId } from '../../../src/art/sketch.ts';
import { HERO_COLOR } from '../../../src/game/content.ts';
import type { HeroId } from '../../../../src/core/types.ts';
import { drawPuppet, heroArt, type HeroArt, type Pose } from './heroes.ts';
import { CINNABAR, GOLD, INK, type C2, type P, brush, hanjiTile, mix, paperPiece, poly, rgba, rng, roughen, smooth, washBlob, woodPiece } from './paint.ts';
import { paintAltar } from './scene.ts';
import { HAN, spiritArt } from './spirits.ts';

/** 완성 그림을 그리는 카드 (슬라이스 덱 = 세 영웅의 시작 카드) */
export const FINISHED = new Set([
  'seungnyeo.yukhwanjang', 'seungnyeo.hapjang', 'seungnyeo.gasa', 'seungnyeo.cheondo_yeombul',
  'manshin.cheongbae', 'manshin.bangul', 'manshin.gongsu', 'manshin.buchae_makgi',
  'posu.jojun', 'posu.hwaseungchong', 'posu.geupso', 'posu.eompye',
]);

export const hasFinished = (id: string): boolean => FINISHED.has(baseId(id));

const VW = 160;
const VH = 100;

interface Frame { hx: number; hs: number; gy: number; ts: number; tgy: number; txs: number[] }
const FRAMES: Record<string, Frame> = {
  close: { hx: 46, hs: 0.92, gy: 152, ts: 0.62, tgy: 128, txs: [140, 126, 152] },
  medium: { hx: 44, hs: 0.58, gy: 91, ts: 0.5, tgy: 91, txs: [124, 112, 140] },
  wide: { hx: 36, hs: 0.42, gy: 87, ts: 0.4, tgy: 87, txs: [122, 108, 134] },
};

const POSE_MAP: Record<string, string> = { strike: 'strike', aim: 'aim', cast: 'cast', guard: 'guard', pray: 'pray', summon: 'summon', retreat: 'retreat' };

function poseFor(a: HeroArt, name: string): Pose {
  const p = a.poses[POSE_MAP[name] ?? 'idle'] ?? a.poses.cast ?? a.poses.idle;
  return { ...p, dx: 0, dy: 0 };
}

// ── 배경 (수묵 + 한 가지 색) ───────────────────────────────────────────
function background(c: C2, bg: string, seed: number, gy: number): void {
  const r = rng(seed);
  // 한지 바탕 + 위가 조금 어두운 저녁빛
  const g = c.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, '#d9ccad');
  g.addColorStop(0.55, '#ece2c8');
  g.addColorStop(1, '#e4d7b8');
  c.fillStyle = g;
  c.fillRect(0, 0, VW, VH);
  washBlob(c, 40, 46, 70, 46, '#fff6dc', 0.5);
  const ground = Math.min(gy, 96);
  switch (bg) {
    case 'hills': {
      for (const [base, amp, col, a] of [[62, 22, '#6f7c8c', 0.35], [74, 16, '#4c5868', 0.45]] as [number, number, string, number][]) {
        const pts: P[] = [[-4, 110]];
        for (let x = -4; x <= VW + 4; x += 4) pts.push([x, base - amp * Math.abs(Math.sin(x / 34 + seed)) - Math.sin(x / 11 + base) * 2]);
        pts.push([VW + 4, 110]);
        const gr = c.createLinearGradient(0, base - amp, 0, base + 20);
        gr.addColorStop(0, rgba(col, a));
        gr.addColorStop(1, rgba(col, 0));
        c.fillStyle = gr;
        poly(c, pts);
        c.fill();
        const line = pts.slice(1, -1);
        for (let k = 0; k < line.length - 4; k += 4) brush(c, line.slice(k, k + 5), { w: 1.1, color: rgba(col, 0.7), seed: k + base, dry: 0.5 });
      }
      for (let i = 0; i < 40; i++) {
        c.fillStyle = rgba('#2f3a46', 0.25 + r() * 0.3);
        c.beginPath();
        c.ellipse(r() * VW, 52 + r() * 22, 0.8 + r() * 1.2, 0.5 + r() * 0.6, 0, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'gate': {
      // 댓가지를 엮어 세운 굿판의 문(성문이 아니다)
      for (const x of [96, 152]) {
        woodPiece(c, [[x - 2.4, 4], [x + 2.4, 4], [x + 2.6, ground], [x - 2.6, ground]], '#7d8a4a', { seed: seed + x, wear: 0.3, outline: 0.8, grain: 0 }, (k) => {
          k.strokeStyle = 'rgba(30,30,10,0.6)';
          k.lineWidth = 0.6;
          for (let y = 12; y < ground; y += 14) {
            k.beginPath();
            k.moveTo(x - 3, y);
            k.lineTo(x + 3, y);
            k.stroke();
          }
        });
      }
      for (let k = 0; k < 3; k++) brush(c, [[96, 18 + k * 4], [124, 2 + k * 4], [152, 18 + k * 4]], { w: 1.4, color: rgba('#6f7c3a', 0.85), seed: seed + 30 + k, taper: [1, 1] });
      for (let x = 102; x < 150; x += 9) paperPiece(c, roughen([[x - 1.6, 12], [x + 1.6, 12], [x + 1.4, 24], [x - 1.4, 22]], 0.3, x, 1.2), { seed: x, color: '#f6efda', fibers: 0.3 });
      break;
    }
    case 'village': {
      for (const [x, w] of [[96, 44], [138, 30]] as [number, number][]) {
        c.fillStyle = rgba('#5a5340', 0.35);
        poly(c, smooth([[x - w / 2 - 6, 60], [x - w / 2 + 4, 46], [x + w / 2 - 4, 45], [x + w / 2 + 6, 60]], 3));
        c.fill();
        c.fillStyle = rgba('#3a3428', 0.25);
        c.fillRect(x - w / 2 + 2, 60, w - 4, 14);
      }
      break;
    }
    case 'jihwa': {
      // 굿상 뒤 지화 다발 (양옆)
      const cols = ['#e86f8a', '#f6efda', '#e2b23a', '#c33427', '#7aa6c8'];
      for (const cx of [8, 152]) for (let i = 0; i < 14; i++) {
        const x = cx + (r() - 0.5) * 18;
        const y = 10 + r() * 50;
        brush(c, [[cx, 76], [x, y + 4]], { w: 0.6, color: '#4f6a3a', seed: i + cx });
        washBlob(c, x, y, 4, 3.4, cols[i % cols.length], 0.85);
      }
      break;
    }
    case 'geumjul': {
      const pts: P[] = [];
      for (let x = -4; x <= VW + 4; x += 10) pts.push([x, 7 + Math.sin(x / 30) * 1.5]);
      brush(c, pts, { w: 2.4, color: '#8a7448', seed, taper: [1, 1] });
      for (let x = 6; x < VW; x += 16) paperPiece(c, roughen([[x - 1.5, 8], [x + 1.5, 8], [x + 2, 13], [x - 1, 15], [x + 1.5, 19], [x - 1, 22]], 0.25, x, 1), { seed: x, color: '#f6efda', fibers: 0.3 });
      break;
    }
    default:
      break;
  }
  // 바닥: 먹으로 그은 땅
  if (gy <= 100) {
    c.fillStyle = rgba('#8f7f60', 0.35);
    c.fillRect(0, gy, VW, VH - gy);
    brush(c, [[-4, gy + 0.5], [60, gy - 0.5], [VW + 4, gy + 0.6]], { w: 1.2, color: rgba(INK, 0.6), seed: seed + 9, dry: 0.4 });
  }
}

// ── 효과 글리프 ───────────────────────────────────────────────────────
function glyph(c: C2, fx: string, from: P, to: P, acc: string, seed: number, s: number): void {
  const r = rng(seed);
  switch (fx) {
    case 'ripple':
      for (let i = 0; i < 4; i++) {
        c.strokeStyle = rgba(i % 2 ? acc : '#2f6f9a', 0.75 - i * 0.12);
        c.lineWidth = 1.3 - i * 0.15;
        c.beginPath();
        c.arc(to[0], to[1], (8 + i * 6) * s, Math.PI * 0.6, Math.PI * 1.4);
        c.stroke();
      }
      break;
    case 'burst':
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + r() * 0.3;
        brush(c, [[to[0] + Math.cos(a) * 5 * s, to[1] + Math.sin(a) * 5 * s], [to[0] + Math.cos(a) * 15 * s, to[1] + Math.sin(a) * 15 * s]], { w: 1.6 * s, color: i % 3 ? INK : acc, seed: seed + i, taper: [0.9, 0] });
      }
      break;
    case 'seal': {
      // 붉은 도장(점지)
      c.save();
      c.translate(to[0], to[1] - 8 * s);
      c.rotate(-0.12);
      c.fillStyle = rgba(CINNABAR, 0.92);
      const k = 6 * s;
      poly(c, roughen([[-k, -k], [k, -k], [k, k], [-k, k]], 0.4, seed, 2));
      c.fill();
      c.strokeStyle = '#f6efda';
      c.lineWidth = 0.8;
      c.strokeRect(-k * 0.7, -k * 0.7, k * 1.4, k * 1.4);
      brush(c, [[-k * 0.4, -k * 0.3], [k * 0.4, -k * 0.3]], { w: 0.9, color: '#f6efda', seed });
      brush(c, [[0, -k * 0.5], [0, k * 0.5]], { w: 0.9, color: '#f6efda', seed: seed + 1 });
      c.restore();
      break;
    }
    case 'ward': {
      // 반투명 한지 가림막
      c.save();
      c.globalAlpha = 0.55;
      paperPiece(c, smooth([[from[0] + 12, from[1] - 50 * s], [from[0] + 26, from[1] - 30 * s], [from[0] + 28, from[1] + 2], [from[0] + 16, from[1] + 10 * s], [from[0] + 8, from[1] - 10 * s]], 3, true), { seed, color: '#fbf4dc', fibers: 0.5 });
      c.restore();
      c.strokeStyle = rgba(GOLD, 0.8);
      c.lineWidth = 1;
      c.beginPath();
      c.arc(from[0], from[1] - 20 * s, 34 * s, -0.9, 0.9);
      c.stroke();
      break;
    }
    case 'light': {
      const g = c.createRadialGradient(to[0], to[1], 0, to[0], to[1], 34 * s);
      g.addColorStop(0, 'rgba(255,252,236,0.95)');
      g.addColorStop(0.4, 'rgba(255,240,200,0.5)');
      g.addColorStop(1, 'rgba(255,240,200,0)');
      c.fillStyle = g;
      c.fillRect(to[0] - 40 * s, to[1] - 60 * s, 80 * s, 100 * s);
      const col = c.createLinearGradient(0, 0, 0, to[1]);
      col.addColorStop(0, 'rgba(255,250,230,0)');
      col.addColorStop(1, 'rgba(255,250,230,0.7)');
      c.fillStyle = col;
      c.fillRect(to[0] - 5 * s, 0, 10 * s, to[1]);
      break;
    }
    case 'shot': {
      const g = c.createRadialGradient(from[0], from[1], 0, from[0], from[1], 10 * s);
      g.addColorStop(0, 'rgba(255,250,210,1)');
      g.addColorStop(0.4, 'rgba(255,170,60,0.9)');
      g.addColorStop(1, 'rgba(255,120,40,0)');
      c.fillStyle = g;
      c.fillRect(from[0] - 10 * s, from[1] - 10 * s, 20 * s, 20 * s);
      c.strokeStyle = 'rgba(255,240,190,0.85)';
      c.lineWidth = 0.7;
      c.setLineDash([3, 2]);
      c.beginPath();
      c.moveTo(from[0] + 4, from[1]);
      c.lineTo(to[0], to[1]);
      c.stroke();
      c.setLineDash([]);
      for (let i = 0; i < 4; i++) washBlob(c, from[0] + 4 + i * 3, from[1] - 2 - i * 2, 4 + i, 3 + i, '#9a968c', 0.3);
      break;
    }
    case 'crack':
      for (let i = 0; i < 3; i++) brush(c, [[to[0], to[1]], [to[0] + (r() - 0.3) * 10 * s, to[1] + (r() - 0.5) * 12 * s], [to[0] + (r() - 0.2) * 16 * s, to[1] + (r() - 0.5) * 18 * s]], { w: 0.7, seed: seed + i, taper: [1, 0] });
      break;
    case 'ledger':
      for (let i = 0; i < 3; i++) brush(c, [[to[0] - 6 * s, to[1] - 6 * s + i * 4 * s], [to[0] + 6 * s, to[1] - 7 * s + i * 4 * s]], { w: 1.2, color: rgba(INK, 0.8), seed: seed + i, dry: 0.4 });
      break;
    default:
      break;
  }
}

function drawSpirit(c: C2, family: string, x: number, gy: number, s: number): void {
  const a = spiritArt(`card:${family}`, family, 1);
  const [x0, y0, x1, y1] = a.box;
  c.save();
  c.globalAlpha = 0.5;
  washBlob(c, x, gy - 60 * s, 34 * s, 54 * s, HAN[family] ?? '#888', 0.5);
  c.restore();
  c.drawImage(a.canvas, x + x0 * s, gy + y0 * s, (x1 - x0) * s, (y1 - y0) * s);
}

const cache = new Map<string, string>();

/** 카드 삽화 하나 → data URL (16:10, 480 × 300). 같은 카드는 한 번만 그린다 */
export function cardArtUrl(cardId: string): string | null {
  const id = baseId(cardId);
  if (!FINISHED.has(id)) return null;
  let u = cache.get(id);
  if (u) return u;
  const sp = artSpec(id);
  const R = 3;
  const cv = document.createElement('canvas');
  cv.width = VW * R;
  cv.height = VH * R;
  const c = cv.getContext('2d')!;
  c.setTransform(R, 0, 0, R, 0, 0);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  const fr = FRAMES[sp.framing] ?? FRAMES.medium;
  const seed = id.length * 131 + id.charCodeAt(id.length - 1);
  const heroId = sp.heroes[0] as HeroId;
  const acc = HERO_COLOR[heroId] ?? '#c33427';
  background(c, sp.bg, seed, fr.gy);
  const a = heroArt(heroId, acc);
  const pose = poseFor(a, sp.poses[0]);
  // 영웅 위치: 지키는 카드(가사)·자신 카드(합장)는 가운데
  let hx = fr.hx;
  if (sp.target === 'self') hx = VW / 2 - 8;
  if (sp.target === 'ally') hx = VW / 2;
  // 대상
  const fam = sp.target in HAN ? sp.target : sp.vs in HAN ? sp.vs : '';
  const tx = fr.txs[0];
  if (sp.target === 'ally') {
    // 등 뒤(왼쪽)에서 지켜지는 동료: 포수 목인을 작게
    const other = heroArt('posu', HERO_COLOR.posu);
    drawPuppet(c, other, other.poses.hit, { x: hx - 34, y: fr.gy, s: fr.hs * 0.9 });
  }
  if (sp.target === 'altar') {
    const al = paintAltar();
    const s = 0.62;
    c.drawImage(al.canvas, 118 + al.box[0] * s, fr.gy - 2 + al.box[1] * s, (al.box[2] - al.box[0]) * s, (al.box[3] - al.box[1]) * s);
  }
  if (fam) {
    const n = sp.target === 'ally' ? 1 : Math.max(1, Math.min(2, sp.count));
    for (let i = n - 1; i >= 0; i--) drawSpirit(c, fam, fr.txs[i] + (sp.target === 'ally' ? 14 : 0), fr.tgy - i * 2, fr.ts * (1 - i * 0.12));
  }
  // 가림막·빛은 인물 뒤, 나머지는 앞
  const handTo: P = [tx - 10, fr.tgy - 62 * fr.ts];
  if (sp.fx === 'light') glyph(c, 'light', [hx, fr.gy], [132, fr.gy - 40], acc, seed, 0.9);
  if (sp.fx === 'ward' || sp.fx2 === 'ward') glyph(c, 'ward', [hx + 10, fr.gy - 40 * fr.hs], handTo, acc, seed, fr.hs * 1.4);
  drawPuppet(c, a, pose, { x: hx, y: fr.gy, s: fr.hs });
  // 무구 끝(대략): 자세의 앞손 높이
  const muzzle: P = [hx + 60 * fr.hs, fr.gy - 92 * fr.hs];
  for (const f of [sp.fx, sp.fx2]) {
    if (!f || f === 'ward' || f === 'light') continue;
    glyph(c, f, f === 'shot' ? muzzle : [hx, fr.gy], handTo, acc, seed + f.length, Math.max(0.6, fr.ts * 1.4));
  }
  // 가장자리 먹 번짐 + 한지 결
  const vg = c.createRadialGradient(VW / 2, VH * 0.48, VH * 0.35, VW / 2, VH * 0.5, VW * 0.62);
  vg.addColorStop(0, 'rgba(60,40,20,0)');
  vg.addColorStop(1, 'rgba(60,40,20,0.38)');
  c.fillStyle = vg;
  c.fillRect(0, 0, VW, VH);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'multiply';
  const tile = grainTile();
  c.fillStyle = c.createPattern(tile, 'repeat')!;
  c.fillRect(0, 0, cv.width, cv.height);
  c.globalCompositeOperation = 'source-over';
  u = cv.toDataURL('image/png');
  cache.set(id, u);
  return u;
}

let grain: HTMLCanvasElement | null = null;
function grainTile(): HTMLCanvasElement {
  if (!grain) grain = hanjiTile(128, 41);
  return grain;
}

/** 카드 틀 바탕의 한지 결 (CSS 배경용 data URL) */
let paperUrl = '';
export function hanjiUrl(): string {
  if (!paperUrl) paperUrl = hanjiTile(160, 17).toDataURL('image/png');
  return paperUrl;
}

export { mix };
