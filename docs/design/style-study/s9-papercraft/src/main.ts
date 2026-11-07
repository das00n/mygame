// s9 — 종이 공예 디오라마 시안. 진짜 3D 상자 무대 안에 두께 있는 오린 종이 인형 · 소품을 세우고,
// 따뜻한 등(왼쪽 앞)과 찬 달빛(오른쪽 앞) 두 빛으로 진짜 그림자를 드리운다. 물결은 접은 종이, 배경은 달을 찍은 한지.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ART_H, ART_W, buildUI, markReady, placeAt, project, waitFonts } from '../../_kit-3d/ui';
import { canvas, fbm, makeNoise, rng } from '../../_kit-3d/tex';
import { box, cyl, lathe, sph, type V3 } from '../../_kit-3d/geo';

const T0 = performance.now();
const cv = document.getElementById('gl') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(1280, 800, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#14100c');

// ── 종이 텍스처 ────────────────────────────────────────────────
const N = makeNoise(17);
/** 섬유 결이 보이는 흰 종이(색은 재질 color 로 곱한다) + 범프 */
const FIBER = (() => {
  const W = 512;
  const c = canvas(W);
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, W);
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const v = 0.9 + 0.1 * fbm(N, x / W, y / W, 8, 8, 4);
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const r = rng(3);
  for (let i = 0; i < 900; i++) {
    const x = r() * W;
    const y = r() * W;
    const a = r() * Math.PI * 2;
    const len = 6 + r() * 26;
    g.strokeStyle = r() < 0.55 ? `rgba(255,255,255,${0.25 + r() * 0.3})` : `rgba(120,110,95,${0.1 + r() * 0.15})`;
    g.lineWidth = 0.6 + r() * 0.8;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.6) * len * 0.5, y + Math.sin(a + 0.6) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2.2, 2.2);
  map.anisotropy = 4;
  const bump = new THREE.CanvasTexture(c);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(2.2, 2.2);
  return { map, bump };
})();

const paperMats = new Map<string, THREE.Material[]>();
function paperMat(color: string, o: { emissive?: string; ei?: number; opacity?: number; edge?: string; side?: THREE.Side } = {}) {
  const key = JSON.stringify([color, o]);
  let m = paperMats.get(key);
  if (!m) {
    const face = new THREE.MeshStandardMaterial({
      color,
      map: FIBER.map,
      bumpMap: FIBER.bump,
      bumpScale: 1.2,
      roughness: 0.93,
      emissive: new THREE.Color(o.emissive ?? '#000000'),
      emissiveIntensity: o.ei ?? 1,
      transparent: (o.opacity ?? 1) < 1,
      opacity: o.opacity ?? 1,
      depthWrite: (o.opacity ?? 1) >= 1,
      side: o.side ?? THREE.FrontSide,
    });
    const edge = new THREE.MeshStandardMaterial({ color: o.edge ?? new THREE.Color(color).lerp(new THREE.Color('#fbf3e2'), 0.55), roughness: 1, transparent: face.transparent, opacity: face.opacity, emissive: face.emissive, emissiveIntensity: (o.ei ?? 1) * 0.5 });
    m = [face, edge];
    paperMats.set(key, m);
  }
  return m;
}

// ── 오린 종이 조각 ──────────────────────────────────────────────
type Pt = [number, number];
const shp = (pts: Pt[]) => {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
};
const ell = (cx: number, cy: number, rx: number, ry = rx, rot = 0) => {
  const s = new THREE.Shape();
  s.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false, rot);
  return s;
};
const ringS = (cx: number, cy: number, r: number, w: number) => {
  const s = ell(cx, cy, r);
  const h = new THREE.Path();
  h.absellipse(cx, cy, r - w, r - w, 0, Math.PI * 2, true, 0);
  s.holes.push(h);
  return s;
};
/** 선분을 굵기 w 의 띠로 */
const strip = (x0: number, y0: number, x1: number, y1: number, w: number, w1 = w): THREE.Shape => {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l = Math.hypot(dx, dy);
  const nx = -dy / l;
  const ny = dx / l;
  return shp([
    [x0 + (nx * w) / 2, y0 + (ny * w) / 2],
    [x1 + (nx * w1) / 2, y1 + (ny * w1) / 2],
    [x1 - (nx * w1) / 2, y1 - (ny * w1) / 2],
    [x0 - (nx * w) / 2, y0 - (ny * w) / 2],
  ]);
};
const wedge = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const s = new THREE.Shape();
  s.moveTo(cx, cy);
  s.absarc(cx, cy, r, a0, a1, false);
  s.closePath();
  return s;
};
/** 아랫단이 들쭉날쭉한 사다리꼴(도롱이 · 털 · 술) */
const fringe = (cx: number, yTop: number, yBot: number, wTop: number, wBot: number, teeth: number, jag: number, seed: number) => {
  const r = rng(seed);
  const pts: Pt[] = [[cx - wTop / 2, yTop]];
  pts.push([cx - wBot / 2, yBot]);
  for (let i = 0; i < teeth; i++) {
    const x0 = cx - wBot / 2 + (wBot * (i + 0.5)) / teeth;
    pts.push([x0, yBot - jag * (0.5 + r() * 0.8)]);
    pts.push([cx - wBot / 2 + (wBot * (i + 1)) / teeth, yBot + jag * 0.1 * r()]);
  }
  pts.push([cx + wTop / 2, yTop]);
  return shp(pts);
};
/** 테두리가 털처럼 오돌토돌한 원(털모자) */
const fuzzy = (cx: number, cy: number, r: number, bumps: number, amp: number, a0 = 0, a1 = Math.PI * 2, close?: Pt[]) => {
  const s = new THREE.Shape();
  const n = bumps * 6;
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const rr = r + amp * Math.abs(Math.sin((i / 6) * Math.PI));
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  if (close) for (const p of close) s.lineTo(...p);
  s.closePath();
  return s;
};

interface Piece {
  s: THREE.Shape;
  c: string;
  emissive?: string;
  ei?: number;
  opacity?: number;
  edge?: string;
  /** 앞으로 더 띄우기(겹 사이 그림자) */
  lift?: number;
}
const THICK = 0.016;
const LAYER = 0.009;
/** 조각을 겹겹이 붙인 종이 인형. bend: 판이 살짝 휜다(조각마다 x 에 따라 돌리고 밀어 곡면을 따른다) */
function paperFigure(pieces: Piece[], o: { bend?: number; seed?: number } = {}) {
  const g = new THREE.Group();
  const bend = o.bend ?? 0.1;
  const r = rng(o.seed ?? 1);
  pieces.forEach((p, i) => {
    const geo = new THREE.ExtrudeGeometry(p.s, { depth: THICK, bevelEnabled: false, curveSegments: 18 });
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const cx = (bb.min.x + bb.max.x) / 2;
    const cy = (bb.min.y + bb.max.y) / 2;
    geo.translate(-cx, -cy, 0);
    const m = new THREE.Mesh(geo, paperMat(p.c, { emissive: p.emissive, ei: p.ei, opacity: p.opacity, edge: p.edge }));
    m.position.set(cx, cy, i * LAYER + (p.lift ?? 0) - bend * cx * cx);
    m.rotation.set((r() - 0.5) * 0.02, 2 * bend * cx + (r() - 0.5) * 0.03, (r() - 0.5) * 0.012);
    m.castShadow = (p.opacity ?? 1) >= 1;
    m.receiveShadow = true;
    g.add(m);
  });
  return g;
}

// ── 영웅(오린 종이) ──────────────────────────────────────────────
const SKIN = '#f0cfa8';
const INK = '#1c1714';
const BLUSH = '#e0685c';
function face(cx: number, cy: number, r: number, o: { closed?: boolean; brows?: boolean } = {}): Piece[] {
  const out: Piece[] = [{ s: ell(cx, cy, r, r * 1.05), c: SKIN }];
  for (const dx of [0.02, 0.1]) {
    const ex = cx + dx * (r / 0.18);
    out.push(o.closed ? { s: strip(ex - 0.028, cy + 0.0, ex + 0.028, cy - 0.004, 0.012), c: INK } : { s: ell(ex, cy + 0.01, 0.016, 0.022), c: INK });
    out.push({ s: ell(ex - 0.005, cy - 0.06, 0.026, 0.02), c: BLUSH });
    if (o.brows) out.push({ s: strip(ex - 0.035, cy + 0.06, ex + 0.03, cy + 0.07, 0.014), c: INK });
  }
  out.push({ s: strip(cx + 0.03, cy - 0.1, cx + 0.08, cy - 0.095, 0.012), c: '#9a3a30' });
  return out;
}

function monkFig() {
  const P: Piece[] = [];
  // 육환장(몸 뒤) — 자루는 앞에 둔다
  P.push({ s: ringS(0.56, 2.26, 0.15, 0.025), c: '#d8aa48' });
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const a = Math.PI / 2 + side * (0.8 + (i % 3) * 0.6);
    P.push({ s: ringS(0.56 + Math.cos(a) * 0.15, 2.26 + Math.sin(a) * 0.15 - 0.045, 0.045, 0.012), c: '#e2b856' });
  }
  P.push({ s: shp([[0.53, 2.4], [0.59, 2.4], [0.56, 2.56]]), c: '#d8aa48' });
  // 장삼(잿빛)
  P.push({ s: shp([[-0.4, 0.04], [0.38, 0.04], [0.32, 0.7], [0.28, 1.2], [0.2, 1.44], [-0.2, 1.46], [-0.3, 1.2], [-0.36, 0.7]]), c: '#8d8f94' });
  P.push({ s: ell(-0.13, 0.05, 0.1, 0.045), c: '#3a3028' });
  P.push({ s: ell(0.15, 0.05, 0.1, 0.045), c: '#3a3028' });
  // 갈색 조각보 가사: 띠 + 덧댄 조각들
  P.push({ s: shp([[-0.28, 1.28], [-0.1, 1.45], [0.34, 0.62], [0.35, 0.32], [0.02, 0.3], [-0.34, 0.5]]), c: '#6a3e22' });
  const patches: [number, number, number, number, string][] = [
    [-0.18, 1.12, 0.16, 0.14, '#83522e'],
    [-0.05, 0.92, 0.18, 0.15, '#5a3218'],
    [0.1, 0.74, 0.16, 0.16, '#8f6038'],
    [0.22, 0.48, 0.16, 0.18, '#74462a'],
    [-0.2, 0.5, 0.2, 0.16, '#7c4c2c'],
    [0.02, 0.45, 0.16, 0.12, '#4e2a14'],
  ];
  for (const [x, y, w, h, c] of patches) P.push({ s: shp([[x - w / 2, y - h / 2], [x + w / 2, y - h / 2], [x + w / 2, y + h / 2], [x - w / 2, y + h / 2]]), c });
  // 소매 · 손
  P.push({ s: shp([[0.04, 1.34], [0.3, 1.3], [0.5, 0.92], [0.42, 0.78], [0.12, 0.86]]), c: '#7d7f85' });
  P.push({ s: ell(0.5, 0.95, 0.06), c: SKIN });
  // 염주
  for (let i = 0; i < 15; i++) {
    const t = i / 14;
    const x = -0.14 + t * 0.32;
    const y = 1.42 - Math.sin(t * Math.PI) * 0.26;
    P.push({ s: ell(x, y, 0.026), c: i === 7 ? '#a8302a' : '#3a2214' });
  }
  // 민머리
  P.push({ s: ell(-0.14, 1.64, 0.045, 0.06), c: SKIN });
  P.push(...face(0.02, 1.66, 0.2, { closed: true }));
  P.push({ s: ell(0.06, 1.79, 0.06, 0.022, 0.2), c: '#fff4e2' });
  // 자루(손 앞)
  P.push({ s: strip(0.56, 0.0, 0.56, 2.12, 0.035), c: '#5a3a1e' });
  return paperFigure(P, { bend: 0.1, seed: 5 });
}

function manshinFig() {
  const P: Piece[] = [];
  const red = '#c8282e';
  const blue = '#2a50a6';
  // 내린 팔의 방울 끈(몸 뒤)
  const five = ['#2a5bd7', '#d83038', '#f2c230', '#f4efe6', '#26222e'];
  five.forEach((c, i) => P.push({ s: strip(-0.42 + i * 0.022, 0.8, -0.46 + i * 0.03, 0.42, 0.02), c }));
  // 푸른 치마(주름)
  P.push({ s: shp([[-0.4, 0.03], [0.42, 0.03], [0.27, 0.86], [-0.25, 0.86]]), c: blue });
  for (let i = 0; i < 5; i++) {
    const x0 = -0.28 + i * 0.13;
    P.push({ s: strip(x0 + 0.03, 0.82, x0 - 0.02 + i * 0.012, 0.06, 0.012), c: '#1e3c80' });
  }
  // 홍철릭
  P.push({ s: shp([[-0.32, 0.44], [0.34, 0.42], [0.26, 1.0], [0.2, 1.38], [-0.18, 1.4], [-0.25, 1.0]]), c: red });
  P.push({ s: shp([[-0.25, 0.93], [0.26, 0.93], [0.26, 1.0], [-0.25, 1.0]]), c: blue });
  P.push({ s: strip(0.06, 0.93, 0.1, 0.55, 0.05), c: '#e8c23a' });
  P.push({ s: strip(0.13, 0.93, 0.18, 0.6, 0.045), c: blue });
  // 내린 소매 + 방울
  P.push({ s: shp([[-0.18, 1.34], [-0.04, 1.26], [-0.3, 0.86], [-0.5, 0.86]]), c: '#b02028' });
  P.push({ s: strip(-0.5, 0.9, -0.31, 0.9, 0.05), c: '#e8c23a' });
  P.push({ s: ell(-0.42, 0.82, 0.055), c: SKIN });
  for (const [x, y] of [
    [-0.42, 0.72],
    [-0.47, 0.68],
    [-0.37, 0.68],
    [-0.44, 0.63],
    [-0.39, 0.62],
  ] as Pt[])
    P.push({ s: ell(x, y, 0.035), c: '#e2b04a' });
  // 든 소매 + 부채(오방색)
  P.push({ s: shp([[0.08, 1.36], [0.24, 1.26], [0.52, 1.6], [0.44, 1.74]]), c: '#b02028' });
  P.push({ s: strip(0.46, 1.72, 0.54, 1.6, 0.06), c: '#e8c23a' });
  const fx = 0.6;
  const fy = 1.78;
  five.forEach((c, i) => P.push({ s: wedge(fx, fy, 0.34, (i * Math.PI) / 5 - 0.35, ((i + 1) * Math.PI) / 5 - 0.35), c }));
  P.push({ s: wedge(fx, fy, 0.09, -0.35, Math.PI - 0.35), c: '#7a4a26' });
  P.push({ s: ell(0.52, 1.72, 0.055), c: SKIN });
  // 머리: 쪽 · 비녀 · 댕기
  P.push({ s: strip(-0.2, 1.62, -0.24, 1.2, 0.05), c: '#b02028' });
  P.push({ s: ell(-0.17, 1.62, 0.09), c: '#16120f' });
  P.push({ s: strip(-0.32, 1.62, -0.02, 1.64, 0.022), c: '#e2b04a' });
  P.push(...face(0.02, 1.58, 0.18));
  P.push({ s: shp([[-0.18, 1.6], [-0.15, 1.72], [-0.04, 1.79], [0.1, 1.79], [0.19, 1.7], [0.08, 1.74], [-0.02, 1.7], [-0.1, 1.58]]), c: '#16120f' });
  return paperFigure(P, { bend: 0.1, seed: 7 });
}

function posuFig() {
  const P: Piece[] = [];
  // 화승총(뒤 개머리 + 총신) — 비스듬히 세워 든다
  P.push({ s: strip(-0.02, 0.62, 0.5, 2.1, 0.045, 0.035), c: '#33363c' });
  P.push({ s: shp([[-0.1, 0.5], [0.06, 0.56], [0.12, 0.92], [0.03, 0.94]]), c: '#7a4824' });
  for (const t of [0.45, 0.7, 0.9]) P.push({ s: strip(-0.02 + 0.52 * t - 0.03, 0.62 + 1.48 * t + 0.01, -0.02 + 0.52 * t + 0.03, 0.62 + 1.48 * t - 0.01, 0.03), c: '#d8aa48' });
  // 바지 · 행전 · 짚신
  for (const s of [-1, 1]) {
    P.push({ s: shp([[s * 0.02, 0.76], [s * 0.24, 0.76], [s * 0.2, 0.14], [s * 0.04, 0.14]]), c: '#e6dfcc' });
    P.push({ s: shp([[s * 0.04, 0.38], [s * 0.2, 0.38], [s * 0.19, 0.12], [s * 0.05, 0.12]]), c: '#8a8e9a' });
    P.push({ s: ell(s * 0.13 + 0.03, 0.07, 0.11, 0.05), c: '#c8aa6a' });
  }
  // 저고리 · 조끼(앞이 트인) · 허리띠
  P.push({ s: shp([[-0.25, 0.72], [0.25, 0.72], [0.23, 1.32], [-0.21, 1.34]]), c: '#e6dfcc' });
  P.push({ s: shp([[-0.26, 0.78], [0.04, 0.78], [0.02, 1.32], [-0.22, 1.33]]), c: '#2f6b55' });
  P.push({ s: shp([[0.14, 0.78], [0.26, 0.78], [0.24, 1.3], [0.12, 1.3]]), c: '#2f6b55' });
  P.push({ s: shp([[-0.26, 0.76], [0.26, 0.76], [0.26, 0.82], [-0.26, 0.82]]), c: '#4a2e18' });
  // 화약 주머니 + 뿔 화약통 + 끈
  P.push({ s: strip(-0.22, 1.3, 0.24, 0.86, 0.025), c: '#4a2e18' });
  P.push({ s: ell(0.23, 0.68, 0.09, 0.11), c: '#6e4526' });
  P.push({ s: shp([[0.14, 0.75], [0.32, 0.75], [0.3, 0.68], [0.16, 0.68]]), c: '#583619' });
  P.push({ s: shp([[-0.32, 0.86], [-0.2, 0.9], [-0.12, 0.72], [-0.16, 0.7]]), c: '#e2d6b0' });
  // 팔 · 손(총을 잡는다)
  P.push({ s: strip(0.16, 1.26, 0.3, 1.38, 0.13, 0.1), c: '#ddd6c2' });
  P.push({ s: strip(-0.18, 1.26, 0.05, 0.98, 0.12, 0.1), c: '#ddd6c2' });
  P.push({ s: ell(0.33, 1.4, 0.055), c: SKIN });
  P.push({ s: ell(0.08, 0.95, 0.055), c: SKIN });
  P.push({ s: ell(0.02, 0.82, 0.02), c: '#ff6a24', emissive: '#ff5a1a', ei: 2.5 });
  // 얼굴 · 수염 · 털모자(오돌토돌)
  P.push(...face(0.03, 1.55, 0.18, { brows: true }));
  P.push({ s: strip(0.04, 1.47, 0.14, 1.475, 0.03), c: INK });
  P.push({ s: fuzzy(0.0, 1.62, 0.2, 9, 0.035, 0, Math.PI), c: '#6a4428' });
  P.push({ s: fuzzy(-0.17, 1.52, 0.07, 4, 0.02), c: '#7b5636' });
  P.push({ s: shp([[-0.2, 1.66], [0.2, 1.66], [0.19, 1.71], [-0.19, 1.71]]), c: '#8a6440' });
  return paperFigure(P, { bend: 0.1, seed: 9 });
}

function altarFig() {
  const g = new THREE.Group();
  const lac = paperMat('#7a2a20');
  const top = new THREE.Mesh(box(0.86, 0.06, 0.48), lac[0]);
  top.position.y = 0.48;
  const front = new THREE.Mesh(box(0.86, 0.16, 0.02), lac[0]);
  front.position.set(0, 0.38, 0.23);
  g.add(top, front);
  for (const x of [-0.38, 0.38])
    for (const z of [-0.2, 0.2]) {
      const l = new THREE.Mesh(box(0.05, 0.46, 0.05), lac[0]);
      l.position.set(x, 0.23, z);
      g.add(l);
    }
  const white = paperMat('#f6efe0');
  for (const x of [-0.3, 0.3]) {
    const c = new THREE.Mesh(cyl(0.045, 0.045, 0.24, 18), white[0]);
    c.position.set(x, 0.63, -0.08);
    g.add(c);
    const fl = new THREE.Mesh(new THREE.ShapeGeometry(shp([[-0.03, 0], [0.03, 0], [0.012, 0.1], [0, 0.14], [-0.012, 0.1]])), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.0, 0.45), side: THREE.DoubleSide }));
    fl.position.set(x, 0.76, -0.08);
    g.add(fl);
  }
  const bowl = new THREE.Mesh(
    lathe(
      [
        [0.001, 0],
        [0.06, 0],
        [0.1, 0.06],
        [0.12, 0.12],
        [0.11, 0.12],
        [0.001, 0.05],
      ],
      28,
    ),
    white[0],
  );
  bowl.position.set(0, 0.51, 0.08);
  g.add(bowl);
  const wtr = new THREE.Mesh(new THREE.CircleGeometry(0.105, 24), paperMat('#7fb0e0')[0]);
  wtr.rotation.x = -Math.PI / 2;
  wtr.position.set(0, 0.62, 0.08);
  g.add(wtr);
  // 지화: 종이꽃 한 송이(정말로 종이)
  const fl = paperFigure(
    [
      { s: strip(0, 0, 0.02, 0.32, 0.015), c: '#3f6a3a' },
      ...Array.from({ length: 8 }, (_, i): Piece => ({ s: ell(0.02 + Math.cos((i / 8) * Math.PI * 2) * 0.06, 0.36 + Math.sin((i / 8) * Math.PI * 2) * 0.05, 0.05, 0.035, (i / 8) * Math.PI * 2), c: '#ef86ac' })),
      ...Array.from({ length: 6 }, (_, i): Piece => ({ s: ell(0.02 + Math.cos((i / 6) * Math.PI * 2 + 0.3) * 0.035, 0.36 + Math.sin((i / 6) * Math.PI * 2 + 0.3) * 0.03, 0.03, 0.022, (i / 6) * Math.PI * 2), c: '#fbd2e0' })),
      { s: ell(0.02, 0.36, 0.022), c: '#f2c230' },
    ],
    { bend: 0, seed: 3 },
  );
  fl.position.set(0.16, 0.51, -0.12);
  g.add(fl);
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

function bossFig() {
  const P: Piece[] = [];
  // 노(뒤로 치켜든다) — 몸 뒤
  P.push({ s: strip(0.1, 0.55, 1.15, 3.05, 0.06, 0.05), c: '#6a4a30' });
  P.push({ s: shp([[1.05, 2.92], [1.25, 2.86], [1.62, 3.75], [1.36, 3.86]]), c: '#6a4a30' });
  // 넋 안개(얇은 습자지)
  P.push({ s: fringe(0, 0.55, 0.05, 1.0, 1.3, 9, 0.12, 4), c: '#bff2ff', opacity: 0.45, emissive: '#3a9ab0', ei: 0.8 });
  // 도롱이 세 단
  P.push({ s: fringe(0, 1.15, 0.22, 0.66, 0.96, 13, 0.14, 1), c: '#8f7a4a' });
  for (let i = 0; i < 9; i++) P.push({ s: strip(-0.38 + i * 0.095, 1.08, -0.44 + i * 0.11, 0.3, 0.012), c: '#6e5a32' });
  P.push({ s: fringe(0, 1.6, 0.78, 0.56, 0.84, 11, 0.12, 2), c: '#b39a62' });
  for (let i = 0; i < 7; i++) P.push({ s: strip(-0.3 + i * 0.1, 1.55, -0.36 + i * 0.12, 0.86, 0.012), c: '#8a7444' });
  // 팔(짚) · 유령 손 — 노를 잡는다
  P.push({ s: strip(0.2, 1.62, 0.55, 1.8, 0.16, 0.12), c: '#8f7a4a' });
  P.push({ s: strip(-0.2, 1.55, 0.3, 1.12, 0.15, 0.12), c: '#8f7a4a' });
  P.push({ s: ell(0.58, 1.84, 0.065), c: '#cfe8f0', emissive: '#4ab8d0', ei: 0.6 });
  P.push({ s: ell(0.34, 1.12, 0.065), c: '#cfe8f0', emissive: '#4ab8d0', ei: 0.6 });
  P.push({ s: fringe(0, 2.0, 1.32, 0.34, 0.72, 9, 0.1, 3), c: '#c4ab72' });
  // 그늘진 얼굴(뚫린 눈 뒤로 빛나는 종이)
  P.push({ s: ell(-0.02, 2.03, 0.17, 0.2), c: '#0d0f1a' });
  P.push({ s: ell(-0.07, 2.04, 0.032, 0.014), c: '#b8fbff', emissive: '#8ff4ff', ei: 2.2, lift: 0.006 });
  P.push({ s: ell(-0.16, 2.04, 0.032, 0.014), c: '#b8fbff', emissive: '#8ff4ff', ei: 2.2, lift: 0.006 });
  // 삿갓: 넓은 세모 + 살
  P.push({ s: shp([[-0.78, 2.13], [0.74, 2.17], [0.0, 2.55]]), c: '#c9ad70' });
  for (let i = 0; i <= 8; i++) {
    const x = -0.74 + (1.46 * i) / 8;
    P.push({ s: strip(0.0, 2.52, x, 2.16, 0.012), c: '#9a8048' });
  }
  P.push({ s: strip(-0.8, 2.13, 0.76, 2.17, 0.03), c: '#8a7040' });
  return paperFigure(P, { bend: 0.08, seed: 11 });
}

function boatFig() {
  const top: Pt[] = [];
  const bot: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const x = -2.4 + t * 4.8;
    top.push([x, 0.34 + 0.18 * Math.pow(Math.abs(t - 0.5) * 2, 3)]);
    bot.push([x, 0.34 - 0.36 * Math.pow(Math.sin(Math.PI * t), 0.6)]);
  }
  const P: Piece[] = [{ s: shp([...top, ...bot.reverse()]), c: '#5e4026' }];
  for (let k = 0; k < 3; k++) {
    const y = 0.26 - k * 0.1;
    P.push({ s: strip(-2.0 + k * 0.25, y, 2.0 - k * 0.25, y, 0.018), c: '#3e2a18' });
  }
  P.push({ s: shp(top.map(([x, y]) => [x, y + 0.03] as Pt).concat(top.map(([x, y]) => [x, y - 0.03] as Pt).reverse())), c: '#2e1e12' });
  return paperFigure(P, { bend: 0.03, seed: 13 });
}

// ── 상자 무대 ─────────────────────────────────────────────────
const BOX = { w: 14.4, h: 6.0, d: 6.6 };
const kraft = (() => {
  const W = 256;
  const c = canvas(W);
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, W);
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const v = 0.85 + 0.15 * fbm(N, x / W, y / W, 4, 4, 5);
      const i = (y * W + x) * 4;
      img.data[i] = 176 * v;
      img.data[i + 1] = 138 * v;
      img.data[i + 2] = 96 * v;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 2);
  return t;
})();
const kraftMat = new THREE.MeshStandardMaterial({ map: kraft, bumpMap: FIBER.bump, bumpScale: 1.5, roughness: 0.95 });
{
  const add = (g: THREE.BufferGeometry, m: THREE.Material, p: V3) => {
    const x = new THREE.Mesh(g, m);
    x.position.set(...p);
    x.receiveShadow = true;
    x.castShadow = true;
    scene.add(x);
    return x;
  };
  add(box(BOX.w + 0.4, 0.2, BOX.d + 0.2), kraftMat, [0, -0.1, 0]);
  add(box(0.2, BOX.h, BOX.d + 0.2), kraftMat, [-BOX.w / 2 - 0.1, BOX.h / 2, 0]);
  add(box(0.2, BOX.h, BOX.d + 0.2), kraftMat, [BOX.w / 2 + 0.1, BOX.h / 2, 0]);
  add(box(BOX.w + 0.4, 0.2, BOX.d + 0.2), kraftMat, [0, BOX.h + 0.1, 0]);
  // 앞 위 가림막(무대 틀)
  add(box(BOX.w + 0.4, 0.42, 0.12), kraftMat, [0, BOX.h - 0.21, BOX.d / 2 + 0.04]);
  // 탁자
  const table = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 0.7 }));
  table.rotation.x = -Math.PI / 2;
  table.position.y = -0.2;
  table.receiveShadow = true;
  scene.add(table);
}

// 한지 배경: 쪽물 들인 한지에 목판으로 찍은 달 · 구름
const MOON_UV = { x: 0.79, y: 0.27, r: 0.088 };
{
  const W = 2048;
  const H = Math.round((W * BOX.h) / BOX.w);
  const c = canvas(W, H);
  const g = c.getContext('2d')!;
  // 얼룩진 쪽빛(작게 계산해 키운다)
  const sw = 256;
  const shh = Math.round((sw * H) / W);
  const small = canvas(sw, shh);
  const sg = small.getContext('2d')!;
  const img = sg.createImageData(sw, shh);
  const A = new THREE.Color('#141d3c');
  const B = new THREE.Color('#2a3a6a');
  const t = new THREE.Color();
  for (let y = 0; y < shh; y++)
    for (let x = 0; x < sw; x++) {
      const v = fbm(N, x / sw, y / shh, 4, 2, 5);
      const vert = 1 - (y / shh) * 0.35;
      t.copy(A).lerp(B, Math.min(1, v * vert * 1.2));
      const i = (y * sw + x) * 4;
      img.data[i] = t.r * 255;
      img.data[i + 1] = t.g * 255;
      img.data[i + 2] = t.b * 255;
      img.data[i + 3] = 255;
    }
  sg.putImageData(img, 0, 0);
  g.imageSmoothingQuality = 'high';
  g.drawImage(small, 0, 0, W, H);
  // 한지 섬유
  const r = rng(8);
  for (let i = 0; i < 3800; i++) {
    const x = r() * W;
    const y = r() * H;
    const a = r() * Math.PI * 2;
    const len = 10 + r() * 60;
    g.strokeStyle = `rgba(${r() < 0.6 ? '200,210,240' : '10,14,30'},${0.06 + r() * 0.12})`;
    g.lineWidth = 0.8 + r() * 1.2;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.8) * len * 0.5, y + Math.sin(a + 0.8) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  // 목판 구름무늬(밝은 쪽빛 잉크)
  const cloud = (cx: number, cy: number, s: number) => {
    g.save();
    g.translate(cx, cy);
    g.scale(s, s);
    g.strokeStyle = 'rgba(120,145,205,0.55)';
    g.fillStyle = 'rgba(70,92,150,0.45)';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(-160, 30);
    for (const [x, rr] of [
      [-120, 40],
      [-50, 55],
      [30, 48],
      [100, 38],
    ])
      g.arc(x, 30, rr, Math.PI, 0, false);
    g.lineTo(150, 30);
    g.closePath();
    g.fill();
    g.stroke();
    // 꼬리 소용돌이
    g.beginPath();
    for (let k = 0; k < 40; k++) {
      const a = k * 0.32;
      const rr = 30 - k * 0.7;
      g.lineTo(170 + Math.cos(a) * rr, 10 + Math.sin(a) * rr);
    }
    g.stroke();
    g.restore();
  };
  cloud(W * 0.22, H * 0.2, 1.4);
  cloud(W * 0.52, H * 0.12, 1.0);
  cloud(W * 0.9, H * 0.46, 0.9);
  // 별: 찍힌 점
  for (let i = 0; i < 120; i++) {
    g.fillStyle = `rgba(240,228,190,${0.35 + r() * 0.5})`;
    g.beginPath();
    g.arc(r() * W, r() * H * 0.55, 1.5 + r() * 2.5, 0, Math.PI * 2);
    g.fill();
  }
  // 찍은 달: 크림색 잉크(빠진 점) + 어긋난 테두리
  const mx = MOON_UV.x * W;
  const my = MOON_UV.y * H;
  const mr = MOON_UV.r * W;
  g.fillStyle = 'rgba(255,240,190,0.18)';
  g.beginPath();
  g.arc(mx, my, mr * 1.55, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#f1e2b0';
  g.beginPath();
  g.arc(mx, my, mr, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 700; i++) {
    const a = r() * Math.PI * 2;
    const rr = Math.sqrt(r()) * mr;
    g.fillStyle = `rgba(${r() < 0.5 ? '205,180,120' : '255,250,225'},${0.2 + r() * 0.35})`;
    g.beginPath();
    g.arc(mx + Math.cos(a) * rr, my + Math.sin(a) * rr, 1 + r() * 4, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = 'rgba(200,160,80,0.85)';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(mx + 7, my - 5, mr + 4, 0, Math.PI * 2);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(BOX.w, BOX.h), new THREE.MeshStandardMaterial({ map: tex, bumpMap: FIBER.bump, bumpScale: 2, roughness: 0.95, emissive: new THREE.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: 0.12 }));
  back.position.set(0, BOX.h / 2, -BOX.d / 2 + 0.02);
  back.receiveShadow = true;
  scene.add(back);
}
const MOON_WORLD = new THREE.Vector3(-BOX.w / 2 + MOON_UV.x * BOX.w, BOX.h - MOON_UV.y * BOX.h, -BOX.d / 2 + 0.03);

// 먼 기슭: 오린 종이 능선 두 겹 + 작은 불빛
function ridge(seed: number, amp: number, base: number, color: string, z: number, lights = 0) {
  const r = rng(seed);
  const pts: Pt[] = [[-BOX.w / 2, 0]];
  for (let x = -BOX.w / 2; x <= BOX.w / 2 + 0.01; x += 0.35) pts.push([x, base + amp * (0.4 + 0.6 * Math.abs(Math.sin(x * 0.35 + seed)) * (0.6 + r() * 0.4))]);
  pts.push([BOX.w / 2, 0]);
  const P: Piece[] = [{ s: shp(pts), c: color }];
  for (let i = 0; i < lights; i++) {
    const x = -BOX.w / 2 + 1 + r() * (BOX.w - 2);
    P.push({ s: ell(x, base * 0.6 + r() * 0.15, 0.04), c: '#ffd890', emissive: '#ffb050', ei: 2.4, lift: 0.004 });
  }
  const f = paperFigure(P, { bend: 0.0, seed });
  f.position.z = z;
  scene.add(f);
}
ridge(3, 0.9, 0.9, '#2c3a64', -2.9);
ridge(5, 0.55, 0.55, '#1c2648', -2.6, 7);

// 접은 종이 물결: 산 · 골이 x 방향으로 달리는 주름판(평면 음영)
const WATER = { z0: -2.45, z1: 2.9, x0: -BOX.w / 2, x1: BOX.w / 2 };
{
  const nx = 72;
  const nz = 64;
  const period = 0.42;
  const pos: number[] = [];
  const col: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const c0 = new THREE.Color('#1a2e66');
  const c1 = new THREE.Color('#3b64b4');
  const tc = new THREE.Color();
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const x = WATER.x0 + ((WATER.x1 - WATER.x0) * i) / nx;
      const z0 = WATER.z0 + ((WATER.z1 - WATER.z0) * j) / nz;
      const ph = (z0 + 0.12 * Math.sin(x * 0.9) + 0.06 * Math.sin(x * 2.3 + 1)) / period;
      const tri = Math.abs((ph % 1) + 1) % 1;
      const y = 0.03 + 0.12 * (1 - Math.abs(tri * 2 - 1));
      pos.push(x, y, z0);
      uvs.push(x * 0.3, z0 * 0.3);
      const k = (z0 - WATER.z0) / (WATER.z1 - WATER.z0);
      tc.copy(c0).lerp(c1, 0.35 + 0.4 * k + 0.25 * Math.sin(Math.floor(ph) * 2.1));
      col.push(tc.r, tc.g, tc.b);
    }
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  const water = new THREE.Mesh(g.toNonIndexed(), new THREE.MeshStandardMaterial({ vertexColors: true, map: FIBER.map, bumpMap: FIBER.bump, bumpScale: 0.8, roughness: 0.9, flatShading: true, side: THREE.DoubleSide }));
  (water.geometry as THREE.BufferGeometry).computeVertexNormals();
  water.receiveShadow = true;
  scene.add(water);
  // 달빛 물그림자: 크림색 종이 띠(달 아래)
  const r = rng(12);
  for (let k = 0; k < 9; k++) {
    const z = -2.1 + k * 0.36;
    const w = 0.25 + k * 0.08 + r() * 0.1;
    const piece = new THREE.Mesh(new THREE.ExtrudeGeometry(shp([[-w / 2, -0.04], [w / 2, -0.035], [w / 2 - 0.03, 0.04], [-w / 2 + 0.02, 0.035]]), { depth: THICK, bevelEnabled: false }), paperMat('#f3e2a8', { emissive: '#3a3010', ei: 1 }));
    piece.rotation.x = -Math.PI / 2 + 0.5;
    piece.position.set(MOON_WORLD.x + (r() - 0.5) * 0.3 + (k - 4) * 0.05, 0.17, z);
    piece.receiveShadow = true;
    scene.add(piece);
  }
}

// 나루: 판지 판자 + 말아 만든 종이 기둥
const DOCK_Y = 0.55;
const DOCK = { x0: -BOX.w / 2, x1: -0.55, z0: -0.7, z1: 1.95 };
{
  const plank = paperMat('#8a6442');
  const r = rng(21);
  for (let x = DOCK.x0 + 0.05; x < DOCK.x1; x += 0.34) {
    const m = new THREE.Mesh(box(0.31, 0.05, DOCK.z1 - DOCK.z0), plank);
    m.position.set(x + 0.15, DOCK_Y - 0.025 + (r() - 0.5) * 0.02, (DOCK.z0 + DOCK.z1) / 2 + (r() - 0.5) * 0.06);
    m.rotation.set(0, (r() - 0.5) * 0.03, (r() - 0.5) * 0.04);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  }
  const post = paperMat('#5e432c');
  for (let x = DOCK.x0 + 0.6; x < DOCK.x1; x += 1.6)
    for (const z of [DOCK.z0 + 0.1, DOCK.z1 - 0.1]) {
      const p = new THREE.Mesh(cyl(0.08, 0.08, DOCK_Y, 16), post);
      p.position.set(x, DOCK_Y / 2, z);
      p.castShadow = p.receiveShadow = true;
      scene.add(p);
    }
  // 나루 끝 말뚝 + 노끈
  for (const z of [DOCK.z0 + 0.1, DOCK.z1 - 0.15]) {
    const p = new THREE.Mesh(cyl(0.1, 0.1, 1.35, 18), post);
    p.position.set(DOCK.x1 - 0.05, 0.68, z);
    p.castShadow = p.receiveShadow = true;
    scene.add(p);
    const rope = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 8, 24), paperMat('#d8c49a')[0]);
    rope.rotation.x = Math.PI / 2;
    rope.position.set(DOCK.x1 - 0.05, 1.12, z);
    rope.castShadow = true;
    scene.add(rope);
  }
  // 물속 말뚝(종이 대롱)
  for (const [x, z, h] of [
    [0.6, -1.4, 1.5],
    [6.4, -1.9, 1.8],
    [6.9, 1.6, 1.2],
  ]) {
    const p = new THREE.Mesh(cyl(0.09, 0.09, h, 16), post);
    p.position.set(x, h / 2, z);
    p.castShadow = p.receiveShadow = true;
    scene.add(p);
  }
}

// 갈대: 길쭉한 세모 종이 오림
function reeds(cx: number, cz: number, n: number, spread: number, seed: number, h0 = 1.0) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const h = h0 + r() * 1.0;
    const x = cx + (r() - 0.5) * spread;
    const lean = (r() - 0.5) * 0.25;
    const P: Piece[] = [{ s: shp([[-0.03, 0], [0.03, 0], [lean + 0.004, h]]), c: r() < 0.5 ? '#3a4a34' : '#4a5a3a' }];
    if (r() < 0.5) P.push({ s: ell(lean * 0.88, h * 0.86, 0.035, 0.11), c: '#6a4a2e' });
    const f = paperFigure(P, { bend: 0, seed: seed + i });
    f.position.set(x, 0.05, cz + (r() - 0.5) * 0.5);
    f.rotation.y = (r() - 0.5) * 0.6;
    scene.add(f);
  }
}
reeds(-6.6, 2.5, 16, 1.4, 31, 0.9);
reeds(6.4, 0.6, 18, 1.6, 33, 1.0);
reeds(-4.5, -1.6, 14, 4.0, 35, 0.8);
reeds(5.2, -2.2, 12, 2.5, 37, 0.8);
reeds(-0.2, -1.8, 6, 0.8, 39, 0.7);

// 인물 세우기(받침 띠)
const POS = {
  posu: new THREE.Vector3(-5.35, DOCK_Y, 0.55),
  manshin: new THREE.Vector3(-3.95, DOCK_Y, 0.7),
  monk: new THREE.Vector3(-2.55, DOCK_Y, 0.85),
  altar: new THREE.Vector3(-1.3, DOCK_Y, 0.95),
  boat: new THREE.Vector3(3.5, 0.02, -0.55),
  boss: new THREE.Vector3(3.75, 0.25, -0.62),
};
function stand(fig: THREE.Group, p: THREE.Vector3, ry: number, s = 1) {
  fig.position.copy(p);
  fig.rotation.y = ry;
  fig.scale.setScalar(s);
  const base = new THREE.Mesh(box(0.7, 0.03, 0.22), kraftMat);
  base.position.set(0, 0.015, 0.02);
  base.castShadow = base.receiveShadow = true;
  fig.add(base);
  scene.add(fig);
  return fig;
}
const F = {
  posu: stand(posuFig(), POS.posu, 0.12, 1.02),
  manshin: stand(manshinFig(), POS.manshin, 0.1, 1.02),
  monk: stand(monkFig(), POS.monk, 0.08, 1.06),
};
const altarG = altarFig();
altarG.position.copy(POS.altar);
altarG.rotation.y = 0.15;
scene.add(altarG);
const boatG = boatFig();
boatG.position.copy(POS.boat);
boatG.rotation.y = -0.06;
scene.add(boatG);
const bossG = bossFig();
bossG.position.copy(POS.boss);
bossG.rotation.y = -0.1;
bossG.scale.setScalar(1.12);
scene.add(bossG);
// 배 앞 물보라(오린 흰 종이)
{
  const P: Piece[] = [];
  for (let i = 0; i < 7; i++) P.push({ s: ell(-2.1 + i * 0.7, 0.08, 0.28, 0.1), c: '#dfe8f6' });
  const f = paperFigure(P, { bend: 0, seed: 2 });
  f.position.set(POS.boat.x, 0.03, POS.boat.z + 0.18);
  scene.add(f);
}

// 습자지 안개(반투명 띠)
{
  const tissue = (y: number, z: number, w: number, h: number, seed: number, op: number, x = 0) => {
    const r = rng(seed);
    const pts: Pt[] = [[-w / 2, 0]];
    for (let i = 0; i <= 24; i++) pts.push([-w / 2 + (w * i) / 24, h * (0.6 + 0.4 * Math.sin(i * 0.9 + seed) * (0.5 + r() * 0.5))]);
    pts.push([w / 2, 0]);
    const f = paperFigure([{ s: shp(pts), c: '#e8eefa', opacity: op, emissive: '#2a3450', ei: 1 }], { bend: 0.02, seed });
    f.position.set(x, y, z);
    f.renderOrder = 5;
    scene.add(f);
  };
  tissue(0.1, -2.2, 14, 0.55, 3, 0.32);
  tissue(0.05, -0.9, 9, 0.35, 5, 0.26, 3.2);
  tissue(0.05, 0.4, 6, 0.28, 7, 0.22, 4.0);
}

// 오색 종이 술 줄(무대 틀 위 — 굿판 장식)
{
  const cols = ['#2a5bd7', '#d83038', '#f2c230', '#f4efe6', '#26222e'];
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    pts.push(new THREE.Vector3(-BOX.w / 2 + t * BOX.w, BOX.h - 0.55 - Math.sin(t * Math.PI) * 0.22, BOX.d / 2 - 0.25));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const str = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.012, 6), paperMat('#e8dcc0')[0]);
  str.castShadow = true;
  scene.add(str);
  for (let i = 0; i < 27; i++) {
    const t = (i + 0.5) / 27;
    const p = curve.getPoint(t);
    const f = paperFigure([{ s: fringe(0, 0, -0.34, 0.2, 0.2, 3, 0.06, i), c: cols[i % 5] }], { bend: 0, seed: i });
    f.position.copy(p);
    f.rotation.set(-0.08, 0, (i % 2 ? 1 : -1) * 0.05);
    scene.add(f);
  }
}

// 의도 선: 뱃사공 삿갓 아래 → 승려 머리, 진짜 붉은 실 + 종이 화살촉
const intent = new THREE.Group();
{
  const from = new THREE.Vector3(POS.boss.x - 0.35, POS.boss.y + 2.3, POS.boss.z + 0.2);
  const to = new THREE.Vector3(POS.monk.x + 0.06, DOCK_Y + 1.98, POS.monk.z + 0.12);
  const ctrl = new THREE.Vector3((from.x + to.x) / 2 + 0.3, Math.max(from.y, to.y) + 1.25, (from.z + to.z) / 2 + 0.3);
  const curve = new THREE.QuadraticBezierCurve3(from, ctrl, to);
  const thread = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.018, 8), new THREE.MeshStandardMaterial({ color: '#d0202a', roughness: 0.75, emissive: new THREE.Color('#5a0806') }));
  thread.castShadow = true;
  intent.add(thread);
  const tip = curve.getPoint(0.97);
  const dir = to.clone().sub(tip).normalize();
  const head = paperFigure([{ s: shp([[0, 0.13], [0.1, -0.06], [-0.1, -0.06]]), c: '#d0202a' }], { bend: 0, seed: 1 });
  head.position.copy(to);
  head.rotation.z = Math.atan2(dir.y, dir.x) - Math.PI / 2;
  intent.add(head);
  scene.add(intent);
}

// ── 빛: 따뜻한 등(왼쪽 앞 위) · 찬 달빛(오른쪽 앞 위) ───────────────────
scene.add(new THREE.HemisphereLight('#4a5a90', '#2a2018', 0.55));
const lamp = new THREE.SpotLight('#ffbe78', 900, 0, 0.62, 0.55, 2);
lamp.position.set(-8.5, 9.5, 11);
lamp.target.position.set(-2.4, 0.8, -0.8);
lamp.castShadow = true;
lamp.shadow.mapSize.set(2048, 2048);
lamp.shadow.bias = -0.0004;
lamp.shadow.normalBias = 0.01;
lamp.shadow.radius = 3;
scene.add(lamp, lamp.target);
const moonL = new THREE.SpotLight('#9cb6ff', 820, 0, 0.6, 0.6, 2);
moonL.position.set(10, 11, 9);
moonL.target.position.set(2.2, 0.8, -1.2);
moonL.castShadow = true;
moonL.shadow.mapSize.set(2048, 2048);
moonL.shadow.bias = -0.0004;
moonL.shadow.normalBias = 0.01;
moonL.shadow.radius = 3;
scene.add(moonL, moonL.target);
const candleL = new THREE.PointLight('#ffb060', 1.6, 0, 2);
candleL.position.set(POS.altar.x, DOCK_Y + 0.85, POS.altar.z + 0.1);
scene.add(candleL);
const eyeL = new THREE.PointLight('#7ff0ff', 1.4, 0, 2);
eyeL.position.set(POS.boss.x - 0.2, POS.boss.y + 2.25, POS.boss.z + 0.5);
scene.add(eyeL);

// ── 카메라 · 후처리(작은 모형처럼 얕은 피사계 심도) ─────────────────────
const camera = new THREE.PerspectiveCamera(30, 1280 / 800, 0.1, 200);
camera.position.set(1.6, 4.1, 16.4);
camera.lookAt(0.15, 2.05, 0);
camera.updateMatrixWorld();
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1280, 800, { type: THREE.HalfFloatType, samples: 4 }));
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const bokeh = new BokehPass(scene, camera, { focus: 16.0, aperture: 0.00045, maxblur: 0.006 });
composer.addPass(bokeh);
composer.addPass(new OutputPass());

// 카드 그림 전용 소품
const props: THREE.Object3D[] = [];
scene.updateMatrixWorld(true);
{
  // 1 노잣돈: 지전(엽전 모양 종이)이 배로 간다
  const p1 = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const f = paperFigure([{ s: ringS(0, 0, 0.11, 0.07), c: '#f3e2b0' }], { bend: 0, seed: i });
    f.position.set(1.2 + t * 1.6, 1.4 + Math.sin(t * Math.PI) * 0.7, 0.4 - t * 0.6);
    f.rotation.set(0.3 * i, 0.5 * i, 0.2);
    p1.add(f);
  }
  // 2 육환장: 울림 고리(습자지)
  const p2 = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const f = paperFigure([{ s: ringS(0, 0, 0.22 + i * 0.13, 0.025), c: '#bff2ff', emissive: '#4ab8d0', ei: 0.8 }], { bend: 0, seed: i });
    f.position.copy(POS.monk).add(new THREE.Vector3(0.6, 2.3, 0.3));
    p2.add(f);
  }
  // 3 급소 저격: 종이 총불 · 솜 연기
  const p3 = new THREE.Group();
  const star: Pt[] = [];
  for (let i = 0; i < 14; i++) star.push([Math.cos((i / 14) * Math.PI * 2) * (i % 2 ? 0.1 : 0.26), Math.sin((i / 14) * Math.PI * 2) * (i % 2 ? 0.1 : 0.26)]);
  const fl = paperFigure([{ s: shp(star), c: '#ffd45a', emissive: '#ff9a20', ei: 1.5 }], { bend: 0, seed: 1 });
  fl.position.copy(POS.posu).add(new THREE.Vector3(0.55, 2.15, 0.25));
  p3.add(fl);
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(sph(0.12 + i * 0.04, 14, 10), paperMat('#e6e6ee')[0]);
    s.position.copy(POS.posu).add(new THREE.Vector3(0.8 + i * 0.22, 2.2 + i * 0.06, 0.2));
    p3.add(s);
  }
  // 4 공수: 점지 과녁(금종이)
  const p4 = new THREE.Group();
  const sig = paperFigure(
    [
      { s: ringS(0, 0, 0.3, 0.035), c: '#f2c230', emissive: '#6a4a00', ei: 1 },
      { s: ringS(0, 0, 0.15, 0.03), c: '#f2c230', emissive: '#6a4a00', ei: 1 },
      { s: strip(-0.42, 0, -0.32, 0, 0.03), c: '#f2c230' },
      { s: strip(0.32, 0, 0.42, 0, 0.03), c: '#f2c230' },
      { s: strip(0, 0.32, 0, 0.42, 0.03), c: '#f2c230' },
      { s: strip(0, -0.42, 0, -0.32, 0.03), c: '#f2c230' },
    ],
    { bend: 0, seed: 4 },
  );
  sig.position.copy(POS.manshin).add(new THREE.Vector3(1.0, 1.75, 0.35));
  p4.add(sig);
  // 5 청배: 굿상 위로 내려오는 신령(흰 종이 오림 + 빛)
  const p5 = new THREE.Group();
  const sp = paperFigure(
    [
      { s: shp([[-0.22, 0], [0.22, 0], [0.12, 0.5], [0.08, 0.62], [-0.08, 0.62], [-0.12, 0.5]]), c: '#fff6dc', emissive: '#a08040', ei: 0.8, opacity: 0.85 },
      { s: ell(0, 0.72, 0.1), c: '#fff6dc', emissive: '#a08040', ei: 0.8, opacity: 0.85 },
    ],
    { bend: 0, seed: 5 },
  );
  sp.position.copy(POS.altar).add(new THREE.Vector3(0, 0.75, 0.0));
  p5.add(sp);
  const gl = new THREE.PointLight('#ffe0a0', 2.5, 0, 2);
  gl.position.copy(POS.altar).add(new THREE.Vector3(0, 1.2, 0.4));
  p5.add(gl);
  for (const p of [p1, p2, p3, p4, p5]) {
    p.visible = false;
    scene.add(p);
    props.push(p);
  }
}

/** UI 종이 결: 작은 섬유 캔버스를 CSS 배경으로 */
function cssFiber() {
  const c = canvas(256);
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(0,0,0,0)';
  g.clearRect(0, 0, 256, 256);
  const r = rng(44);
  for (let i = 0; i < 260; i++) {
    const x = r() * 256;
    const y = r() * 256;
    const a = r() * Math.PI * 2;
    const len = 5 + r() * 18;
    g.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${0.25 + r() * 0.3})` : `rgba(90,70,40,${0.08 + r() * 0.12})`;
    g.lineWidth = 0.6 + r() * 0.6;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.7) * len * 0.5, y + Math.sin(a + 0.7) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  document.documentElement.style.setProperty('--fiber', `url(${c.toDataURL()})`);
}

async function main() {
  const fonts = await waitFonts(['Yeon Sung', 'Gowun Batang']);
  cssFiber();
  const refs = buildUI(document.getElementById('ui')!);

  const shots: { from: V3; to: V3; fov: number; focus: number }[] = [
    { from: [1.0, 2.4, 4.6], to: [3.4, 1.9, -0.6], fov: 40, focus: 0 },
    { from: [-1.7, 2.6, 4.2], to: [-2.35, 2.1, 0.85], fov: 36, focus: 0 },
    { from: [-4.4, 2.3, 4.0], to: [-5.0, 1.75, 0.55], fov: 38, focus: 0 },
    { from: [-3.0, 2.4, 4.2], to: [-3.55, 1.95, 0.7], fov: 38, focus: 0 },
    { from: [-0.6, 1.9, 3.6], to: [-1.3, 1.25, 0.95], fov: 36, focus: 0 },
  ];
  intent.visible = false;
  const artCam = new THREE.PerspectiveCamera(36, ART_W / ART_H, 0.05, 200);
  renderer.setSize(ART_W * 2, ART_H * 2, false);
  composer.setSize(ART_W * 2, ART_H * 2);
  renderPass.camera = artCam;
  (bokeh as unknown as { camera: THREE.Camera }).camera = artCam;
  const bu = (bokeh as unknown as { uniforms: Record<string, { value: number }> }).uniforms;
  shots.forEach((s, i) => {
    props.forEach((p, k) => (p.visible = k === i));
    artCam.fov = s.fov;
    artCam.position.set(...s.from);
    artCam.lookAt(...s.to);
    artCam.updateProjectionMatrix();
    artCam.updateMatrixWorld();
    bu.focus.value = artCam.position.distanceTo(new THREE.Vector3(...s.to));
    bu.aperture.value = 0.004;
    bu.maxblur.value = 0.012;
    bu.aspect.value = ART_W / ART_H;
    bu.nearClip.value = artCam.near;
    bu.farClip.value = artCam.far;
    composer.render();
    refs.cardArts[i].getContext('2d')!.drawImage(renderer.domElement, 0, 0);
  });
  props.forEach((p) => (p.visible = false));
  intent.visible = true;

  renderer.setSize(1280, 800, false);
  composer.setSize(1280, 800);
  renderPass.camera = camera;
  (bokeh as unknown as { camera: THREE.Camera }).camera = camera;
  bu.focus.value = camera.position.distanceTo(POS.monk);
  bu.aperture.value = 0.00045;
  bu.maxblur.value = 0.006;
  bu.aspect.value = 1280 / 800;
  bu.nearClip.value = camera.near;
  bu.farClip.value = camera.far;
  const tr = performance.now();
  composer.render();
  renderer.getContext().finish();
  const renderMs = Math.round(performance.now() - tr);

  const ids = ['posu', 'manshin', 'monk'] as const;
  const plateTop = Math.max(...ids.map((id) => project(camera, POS[id].clone().add(new THREE.Vector3(0, 0, 0.15))).y)) + 6;
  for (const id of ids) placeAt(refs.heroPlates[id], project(camera, POS[id]).x + 6, plateTop, 0.5, 0);
  const bp = project(camera, new THREE.Vector3(POS.boat.x, 0, POS.boat.z + 0.3));
  placeAt(refs.bossPlate, bp.x + 10, Math.min(bp.y + 8, 556 - 116), 0.5, 0);
  const bh = project(camera, new THREE.Vector3(POS.boss.x - 0.1, POS.boss.y + 2.95, POS.boss.z));
  placeAt(refs.intent, bh.x - 10, bh.y - 4, 0.5, 1);
  const al = project(camera, POS.altar.clone().add(new THREE.Vector3(0, 0, 0.3)));
  placeAt(refs.altarTag, al.x + 4, al.y + 4, 0.5, 0);

  markReady({ fonts, renderMs, totalMs: Math.round(performance.now() - T0) });
}
main();
