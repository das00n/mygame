// 3D 화풍 시안 공통 — 원시 도형 도우미(돌림체 · 몸 감싸는 천 조각 · 배 몸통 · 주름).
import * as THREE from 'three';

export type V3 = [number, number, number];
export const V2 = (r: number, y: number) => new THREE.Vector2(r, y);
/** 돌림체: [반지름, 높이] 를 아래에서 위로 */
export const lathe = (pts: [number, number][], seg = 40, ps = 0, pl = Math.PI * 2) => new THREE.LatheGeometry(pts.map(([r, y]) => V2(r, y)), seg, ps, pl);
export const sph = (r: number, ws = 32, hs = 20) => new THREE.SphereGeometry(r, ws, hs);
export const cyl = (rt: number, rb: number, h: number, s = 20, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);
export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const cap = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 8, 16);
export const torus = (r: number, t: number, arc = Math.PI * 2, rs = 10, ts = 40) => new THREE.TorusGeometry(r, t, rs, ts, arc);

/** 단면 곡선 → 높이별 반지름 */
export function profileFn(pts: [number, number][]) {
  return (y: number) => {
    for (let i = 1; i < pts.length; i++) {
      const [r0, y0] = pts[i - 1];
      const [r1, y1] = pts[i];
      if (y <= y1 && y >= y0) return r0 + ((r1 - r0) * (y - y0)) / Math.max(1e-6, y1 - y0);
    }
    return pts[pts.length - 1][0];
  };
}

/** 몸을 감싸는 천 조각: 각도 th0..th1(0 = 앞 +z, +는 왼쪽 +x), 높이 y0..top(th), 몸에서 off 만큼 띄운다 */
export function wrapPanel(prof: (y: number) => number, th0: number, th1: number, y0: number, top: (th: number) => number, off: number, su = 32, sv = 16) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= su; i++) {
    const th = th0 + ((th1 - th0) * i) / su;
    const yt = top(th);
    for (let j = 0; j <= sv; j++) {
      const y = y0 + ((yt - y0) * j) / sv;
      const r = prof(y) + off;
      pos.push(r * Math.sin(th), y, r * Math.cos(th));
      uv.push(((th - th0) * 0.3) / 1, y - y0);
    }
  }
  for (let i = 0; i < su; i++)
    for (let j = 0; j < sv; j++) {
      const a = i * (sv + 1) + j;
      const b = a + sv + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 돌림체에 세로 주름(치마 · 철릭 자락): yMax 아래에서 반지름을 각도에 따라 흔든다 */
export function pleat(g: THREE.BufferGeometry, count: number, amp: number, yMax: number, yMin = -1e9) {
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > yMax || y < yMin) continue;
    const x = p.getX(i);
    const z = p.getZ(i);
    const a = Math.atan2(x, z);
    const k = Math.min(1, (yMax - y) / 0.25);
    const s = 1 + amp * k * Math.sin(a * count);
    p.setX(i, x * s);
    p.setZ(i, z * s);
  }
  g.computeVertexNormals();
  return g;
}

/** 나룻배 몸통: 길이 len(x 방향), 폭 w, 깊이 depth. 위가 열린 반쪽 방추 */
export function boatGeo(len: number, w: number, depth: number, seg = 32) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const r = Math.max(0.001, Math.pow(Math.sin(Math.PI * t), 0.5));
    pts.push([r, t * len - len / 2]);
  }
  const g = lathe(pts, 28, 0, Math.PI);
  g.rotateZ(-Math.PI / 2);
  g.scale(1, depth, w / 2);
  g.computeVertexNormals();
  return g;
}
/** 배 가장자리(뱃전) 곡선 */
export function boatRim(len: number, w: number, side: number, seg = 32) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const r = Math.max(0.001, Math.pow(Math.sin(Math.PI * t), 0.5));
    pts.push(new THREE.Vector3(t * len - len / 2, 0, side * r * (w / 2)));
  }
  return new THREE.CatmullRomCurve3(pts);
}

/** 두 점을 잇는 원기둥/캡슐 놓기 */
export function between(m: THREE.Object3D, a: V3, b: V3) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  m.position.copy(va.clone().add(vb).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.sub(va).normalize());
  return m;
}
export const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
