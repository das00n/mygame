// s7 — 3D 툰 셰이딩 시안. 둥글고 뭉툭한 3D 인형 + MeshToonMaterial(3단 그라디언트) + 뒤집은 껍질 외곽선 + 달빛 림.
// 장면: 1막 「건너지 못한 나루」 보스전 첫 턴, 밤. 바깥 모델 · 그림 없이 원시 도형과 캔버스 텍스처만 쓴다.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ART_H, ART_W, buildUI, markReady, placeAt, project, waitFonts } from '../../_kit-3d/ui';
import { canvas, rng } from '../../_kit-3d/tex';

const T0 = performance.now();
const cv = document.getElementById('gl') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(1280, 800, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const FOG = new THREE.Color('#151c44');
scene.fog = new THREE.FogExp2(FOG, 0.022);
scene.background = FOG;

// ── 재질: 툰 3단 + 달빛 림 + 외곽선 ─────────────────────────────────
const grad = new THREE.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, THREE.RedFormat);
grad.minFilter = grad.magFilter = THREE.NearestFilter;
grad.generateMipmaps = false;
grad.needsUpdate = true;

const RIM = new THREE.Color('#a8d4ff');
function toon(color: string, o: { rim?: number; map?: THREE.Texture; emissive?: string; ei?: number; side?: THREE.Side; transparent?: boolean; opacity?: number } = {}) {
  const m = new THREE.MeshToonMaterial({
    color,
    gradientMap: grad,
    map: o.map ?? null,
    side: o.side ?? THREE.FrontSide,
    emissive: new THREE.Color(o.emissive ?? '#000000'),
    emissiveIntensity: o.ei ?? 1,
    transparent: o.transparent ?? false,
    opacity: o.opacity ?? 1,
  });
  const strength = o.rim ?? 0.55;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.rimColor = { value: RIM.clone().multiplyScalar(strength) };
    sh.fragmentShader =
      'uniform vec3 rimColor;\n' +
      sh.fragmentShader.replace(
        '#include <opaque_fragment>',
        `{ vec3 vd = normalize(vViewPosition); float fr = 1.0 - max(dot(normal, vd), 0.0);
           float side = smoothstep(-0.05, 0.35, normal.x * 0.85 + normal.y * 0.5);
           outgoingLight += rimColor * smoothstep(0.55, 0.62, fr) * side; }
         #include <opaque_fragment>`,
      );
  };
  return m;
}

const OUTLINE = new THREE.Color('#110e1d');
const outlineMats = new Map<number, THREE.ShaderMaterial>();
function outlineMat(thick: number) {
  let m = outlineMats.get(thick);
  if (!m) {
    m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { thick: { value: thick }, col: { value: OUTLINE } }]),
      vertexShader: `uniform float thick;
        #include <fog_pars_vertex>
        void main(){ vec4 mvPosition = modelViewMatrix * vec4(position + normal * thick, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
        }`,
      fragmentShader: `uniform vec3 col;
        #include <fog_pars_fragment>
        void main(){ gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
        }`,
      side: THREE.BackSide,
      fog: true,
    });
    outlineMats.set(thick, m);
  }
  return m;
}
const hullCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
function hullGeo(g: THREE.BufferGeometry) {
  let h = hullCache.get(g);
  if (!h) {
    const c = new THREE.BufferGeometry();
    c.setAttribute('position', g.getAttribute('position').clone());
    if (g.index) c.setIndex(g.index.clone());
    h = mergeVertices(c, 1e-4);
    h.computeVertexNormals();
    hullCache.set(g, h);
  }
  return h;
}

type V3 = [number, number, number];
interface MO {
  pos?: V3;
  rot?: V3;
  scale?: V3 | number;
  outline?: number;
  shadow?: boolean;
}
function M(geo: THREE.BufferGeometry, mat: THREE.Material, o: MO = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = o.shadow ?? true;
  m.receiveShadow = true;
  if (o.pos) m.position.set(...o.pos);
  if (o.rot) m.rotation.set(...o.rot);
  if (o.scale !== undefined) typeof o.scale === 'number' ? m.scale.setScalar(o.scale) : m.scale.set(...o.scale);
  const t = o.outline ?? 0.018;
  if (t > 0) {
    const h = new THREE.Mesh(hullGeo(geo), outlineMat(t));
    h.castShadow = false;
    h.receiveShadow = false;
    m.add(h);
  }
  return m;
}

const V2 = (r: number, y: number) => new THREE.Vector2(r, y);
const lathe = (pts: [number, number][], seg = 32, ps = 0, pl = Math.PI * 2) => new THREE.LatheGeometry(pts.map(([r, y]) => V2(r, y)), seg, ps, pl);
const sph = (r: number, ws = 28, hs = 20) => new THREE.SphereGeometry(r, ws, hs);
const cyl = (rt: number, rb: number, h: number, s = 18, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cap = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 6, 14);
const torus = (r: number, t: number, arc = Math.PI * 2, rs = 10, ts = 36) => new THREE.TorusGeometry(r, t, rs, ts, arc);

/** 단면 곡선 → 반지름 함수 */
function profileFn(pts: [number, number][]) {
  return (y: number) => {
    for (let i = 1; i < pts.length; i++) {
      const [r0, y0] = pts[i - 1];
      const [r1, y1] = pts[i];
      if (y <= y1 && y >= y0) return r0 + ((r1 - r0) * (y - y0)) / Math.max(1e-6, y1 - y0);
    }
    return pts[pts.length - 1][0];
  };
}
/** 몸을 감싸는 천 조각(가사 · 조끼 앞판 등): 각도 th0..th1, 높이 y0..top(th) */
function wrapPanel(prof: (y: number) => number, th0: number, th1: number, y0: number, top: (th: number) => number, off: number, su = 28, sv = 14) {
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
      uv.push(i / su, (y - y0) / 1.0);
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

// ── 캔버스 텍스처 ───────────────────────────────────────────────
function ctex(c: HTMLCanvasElement, rep: [number, number] = [1, 1]) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...rep);
  t.anisotropy = 4;
  return t;
}
const R = rng(20261107);
function patchworkTex() {
  const c = canvas(256);
  const g = c.getContext('2d')!;
  const tones = ['#7b4a2a', '#8f5a33', '#6a3d22', '#9c6a3e', '#83502c', '#5f3720'];
  g.fillStyle = '#3a2214';
  g.fillRect(0, 0, 256, 256);
  const split = (x: number, y: number, w: number, h: number, d: number) => {
    if (d > 3 || (d > 1 && R() < 0.3)) {
      g.fillStyle = tones[Math.floor(R() * tones.length)];
      g.fillRect(x + 3, y + 3, w - 6, h - 6);
      g.strokeStyle = 'rgba(30,16,8,.55)';
      g.setLineDash([4, 4]);
      g.lineWidth = 1.5;
      g.strokeRect(x + 7, y + 7, w - 14, h - 14);
      g.setLineDash([]);
      return;
    }
    if (w > h) {
      const s = w * (0.35 + R() * 0.3);
      split(x, y, s, h, d + 1);
      split(x + s, y, w - s, h, d + 1);
    } else {
      const s = h * (0.35 + R() * 0.3);
      split(x, y, w, s, d + 1);
      split(x, y + s, w, h - s, d + 1);
    }
  };
  split(0, 0, 256, 256, 0);
  return ctex(c, [2, 1.6]);
}
function strawTex(base = '#b0935a') {
  const c = canvas(128, 256);
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 90; i++) {
    const x = R() * 128;
    g.strokeStyle = R() < 0.5 ? 'rgba(90,66,30,.55)' : 'rgba(225,200,140,.45)';
    g.lineWidth = 1 + R() * 1.5;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + (R() - 0.5) * 10, 256);
    g.stroke();
  }
  return ctex(c, [6, 1]);
}
function plankTex() {
  const c = canvas(256, 64);
  const g = c.getContext('2d')!;
  g.fillStyle = '#7a5638';
  g.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 7; i++) {
    g.strokeStyle = 'rgba(60,36,20,.55)';
    g.lineWidth = 1.5;
    g.beginPath();
    const y = 6 + R() * 52;
    g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 32) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 3);
    g.stroke();
  }
  return ctex(c);
}
function glowTex(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = canvas(128);
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner);
  gr.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.55)'));
  gr.addColorStop(1, outer);
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function mistTex(seed: number) {
  const c = canvas(512, 128);
  const g = c.getContext('2d')!;
  const r = rng(seed);
  for (let i = 0; i < 70; i++) {
    const x = 40 + r() * 432;
    const y = 40 + r() * 48;
    const rx = 40 + r() * 90;
    const gr = g.createRadialGradient(x, y, 0, x, y, rx);
    gr.addColorStop(0, 'rgba(255,255,255,0.22)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.save();
    g.translate(x, y);
    g.scale(1, 0.35);
    g.translate(-x, -y);
    g.beginPath();
    g.arc(x, y, rx, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  // 가장자리를 부드럽게 지운다
  g.globalCompositeOperation = 'destination-in';
  const fx = g.createLinearGradient(0, 0, 512, 0);
  fx.addColorStop(0, 'rgba(0,0,0,0)');
  fx.addColorStop(0.2, 'rgba(0,0,0,1)');
  fx.addColorStop(0.8, 'rgba(0,0,0,1)');
  fx.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fx;
  g.fillRect(0, 0, 512, 128);
  const fy = g.createLinearGradient(0, 0, 0, 128);
  fy.addColorStop(0, 'rgba(0,0,0,0)');
  fy.addColorStop(0.3, 'rgba(0,0,0,1)');
  fy.addColorStop(0.7, 'rgba(0,0,0,1)');
  fy.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fy;
  g.fillRect(0, 0, 512, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function coinTex() {
  const c = canvas(128);
  const g = c.getContext('2d')!;
  g.fillStyle = '#f3e7c4';
  g.beginPath();
  g.arc(64, 64, 60, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#a8894a';
  g.lineWidth = 6;
  g.stroke();
  g.beginPath();
  g.arc(64, 64, 40, 0, Math.PI * 2);
  g.lineWidth = 3;
  g.stroke();
  g.clearRect(48, 48, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ── 카메라 ──────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(30, 1280 / 800, 0.1, 300);
camera.position.set(-0.6, 3.6, 15.6);
camera.lookAt(-0.35, 0.5, 0);
camera.updateMatrixWorld();

// ── 하늘 · 달 · 구름 ──────────────────────────────────────────────
const MOON_SCREEN = { x: 1192, y: 120 };
const moonPos = (() => {
  const ndc = new THREE.Vector3((MOON_SCREEN.x / 1280) * 2 - 1, -(MOON_SCREEN.y / 800) * 2 + 1, 0.5).unproject(camera);
  return camera.position.clone().add(ndc.sub(camera.position).normalize().multiplyScalar(140));
})();
const moonDir = moonPos.clone().sub(camera.position).normalize();
{
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(150, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new THREE.Color('#05071c') }, hor: { value: new THREE.Color('#1c275e') }, moonDir: { value: moonDir }, halo: { value: new THREE.Color('#8fb0ff') } },
      vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top, hor, halo, moonDir; varying vec3 vD;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
        void main(){
          float t = smoothstep(-0.02, 0.45, vD.y);
          vec3 c = mix(hor, top, t);
          // 별: 방향을 격자로 나눠 드문드문
          vec3 q = floor(vD * 220.0);
          float s = h(q);
          float star = step(0.9965, s) * smoothstep(0.05, 0.3, vD.y);
          c += vec3(0.85,0.9,1.0) * star * (0.5 + 0.5 * h(q + 3.1));
          // 툰 달무리: 계단식 고리
          float a = acos(clamp(dot(vD, moonDir), -1.0, 1.0));
          float ring = 0.0;
          ring += 0.20 * (1.0 - smoothstep(0.095, 0.1, a));
          ring += 0.11 * (1.0 - smoothstep(0.155, 0.16, a));
          ring += 0.06 * (1.0 - smoothstep(0.25, 0.255, a));
          c = mix(c, halo, ring);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.position.copy(camera.position);
  scene.add(sky);

  const moon = new THREE.Mesh(new THREE.CircleGeometry(6.0, 48), new THREE.MeshBasicMaterial({ color: '#fff4cf', fog: false }));
  moon.position.copy(moonPos);
  moon.lookAt(camera.position);
  scene.add(moon);
  // 달 표면 무늬(툰 얼룩 두 개)
  for (const [dx, dy, r] of [
    [-1.7, 1.2, 1.5],
    [1.6, -1.0, 1.1],
    [0.4, 2.8, 0.8],
  ]) {
    const sp = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color: '#ecdcae', fog: false }));
    sp.position.set(dx, dy, 0.01);
    moon.add(sp);
  }
  // 툰 구름: 같은 색 원을 겹쳐 덩어리, 뒤에 밝은 원을 살짝 올려 윗가장자리 빛
  const cloud = (cx: number, cy: number, s: number, dist: number) => {
    const grp = new THREE.Group();
    const lit = new THREE.MeshBasicMaterial({ color: '#6f80c8', fog: false });
    const body = new THREE.MeshBasicMaterial({ color: '#232c62', fog: false });
    const blobs: [number, number, number][] = [
      [0, 0, 1],
      [1.2, 0.25, 0.8],
      [-1.3, 0.1, 0.75],
      [0.5, 0.65, 0.7],
      [-0.6, 0.5, 0.6],
      [2.2, -0.05, 0.55],
      [-2.2, -0.1, 0.5],
    ];
    for (const [x, y, r] of blobs) {
      const b = new THREE.Mesh(new THREE.CircleGeometry(r, 28), body);
      b.position.set(x, y, 0.02);
      grp.add(b);
      const l = new THREE.Mesh(new THREE.CircleGeometry(r, 28), lit);
      l.position.set(x + 0.04, y + 0.12, 0);
      grp.add(l);
    }
    const flat = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.7), body);
    flat.position.set(0, -0.45, 0.03);
    grp.add(flat);
    const ndc = new THREE.Vector3((cx / 1280) * 2 - 1, -(cy / 800) * 2 + 1, 0.5).unproject(camera);
    grp.position.copy(camera.position.clone().add(ndc.sub(camera.position).normalize().multiplyScalar(dist)));
    grp.lookAt(camera.position);
    grp.scale.setScalar(s);
    scene.add(grp);
  };
  cloud(1262, 236, 1.1, 66);
  cloud(820, 92, 1.1, 64);
  cloud(300, 120, 1.4, 64);
}

// 먼 기슭 · 불빛
{
  const ridge = (z: number, color: string, amp: number, seed: number, base: number) => {
    const r = rng(seed);
    const s = new THREE.Shape();
    s.moveTo(-90, -2);
    let x = -90;
    s.lineTo(x, base);
    while (x < 90) {
      const nx = x + 6 + r() * 10;
      const ny = base + r() * amp;
      s.quadraticCurveTo((x + nx) / 2, ny + amp * 0.5, nx, base + r() * amp * 0.4);
      x = nx;
    }
    s.lineTo(90, -2);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s, 8), new THREE.MeshBasicMaterial({ color, fog: false }));
    m.position.z = z;
    scene.add(m);
  };
  ridge(-62, '#26306a', 9, 3, 1.5);
  ridge(-42, '#1a2152', 5, 5, 0.6);
  ridge(-28, '#10153a', 2.5, 9, 0.2);
  const lightTex = glowTex('rgba(255,196,110,1)');
  for (const [x, y] of [
    [-13, 0.9],
    [-11.4, 1.1],
    [-4, 0.8],
    [6.5, 1.0],
    [9.5, 0.9],
    [15, 1.2],
  ]) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: lightTex, color: '#ffc37a', transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
    sp.position.set(x, y, -27.5);
    sp.scale.setScalar(1.0);
    scene.add(sp);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.09, 10), new THREE.MeshBasicMaterial({ color: '#ffe2a8', fog: false }));
    dot.position.set(x, y, -27.4);
    scene.add(dot);
  }
}

// ── 물(툰): 줄무늬 잔물결 · 달빛 기둥 · 말뚝 둘레 물거품 ────────────────
const POSTS: [number, number, number][] = [
  [0.95, -1.7, 0.13],
  [6.9, -2.3, 0.14],
  [8.1, 1.0, 0.13],
  [-0.15, 1.25, 0.12],
  [-0.15, -1.25, 0.12],
];
const BOAT = { x: 3.35, z: -0.25, len: 4.4, w: 1.15 };
const waterMat = new THREE.ShaderMaterial({
  fog: true,
  uniforms: THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      cDeep: { value: new THREE.Color('#141c48') },
      cMid: { value: new THREE.Color('#2a3a80') },
      cLight: { value: new THREE.Color('#5c74c4') },
      cMoon: { value: new THREE.Color('#f6eab8') },
      cFoam: { value: new THREE.Color('#c9d8ff') },
      moonX: { value: MOON_SCREEN.x },
      res: { value: 1280 },
      posts: { value: POSTS.map(([x, z, r]) => new THREE.Vector3(x, z, r)) },
      boat: { value: new THREE.Vector4(BOAT.x, BOAT.z, BOAT.len / 2 + 0.1, BOAT.w / 2 + 0.08) },
    },
  ]),
  vertexShader: `varying vec3 vW;
    #include <fog_pars_vertex>
    void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
    }`,
  fragmentShader: `uniform vec3 cDeep, cMid, cLight, cMoon, cFoam; uniform float moonX, res; uniform vec3 posts[${POSTS.length}]; uniform vec4 boat; varying vec3 vW;
    #include <fog_pars_fragment>
    float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hs(i),hs(i+vec2(1,0)),f.x), mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x), f.y); }
    void main(){
      vec2 p = vW.xz;
      float far = smoothstep(4.0, -26.0, p.y);
      vec3 col = mix(cDeep, cMid, far);
      // 툰 잔물결: 가로로 긴 획 두 겹
      float r1 = vn(vec2(p.x*0.55, p.y*3.2));
      float r2 = vn(vec2(p.x*1.3 + 7.0, p.y*6.0));
      col = mix(col, cLight, step(0.74, r1) * 0.55);
      col = mix(col, cDeep*0.8, step(0.78, r2) * 0.5 * (1.0-far));
      // 달빛 기둥(화면 x 기준, 가까울수록 넓다)
      float sx = abs(gl_FragCoord.x * (1280.0/res) - moonX);
      float wdt = mix(14.0, 95.0, smoothstep(-30.0, 6.0, p.y));
      float wob = vn(vec2(p.x*1.7, p.y*5.0));
      float brk = step(0.38, vn(vec2(p.x*0.9 + 3.0, p.y*7.5)));
      float streak = step(sx + wob*30.0, wdt) * brk;
      col = mix(col, cMoon, streak * mix(0.95, 0.55, smoothstep(-4.0, 6.0, p.y)));
      // 말뚝 그림자(반사) · 물거품 고리
      for (int i=0;i<${POSTS.length};i++){
        vec2 d2 = p - posts[i].xy;
        float d = length(d2) - posts[i].z;
        float ang = atan(d2.y, d2.x);
        float ring = 1.0 - smoothstep(0.035, 0.05, abs(d - 0.1 - 0.04*sin(ang*5.0)));
        float ring2 = 1.0 - smoothstep(0.025, 0.04, abs(d - 0.3 - 0.05*sin(ang*4.0+1.0)));
        col = mix(col, cFoam, max(ring, ring2*0.6) * step(-0.02, d));
        float refl = step(abs(d2.x), posts[i].z*0.9) * step(0.0, d2.y) * step(d2.y, 1.6 + vn(p*3.0)*0.6);
        col = mix(col, cDeep*0.55, refl*0.7);
      }
      // 배 둘레 물거품 · 배 그늘
      vec2 b = (p - boat.xy) / boat.zw;
      float bd = length(b);
      float bang = atan(b.y, b.x);
      col = mix(col, cDeep*0.5, (1.0 - smoothstep(0.9, 1.0, length(b*vec2(1.0,0.75) - vec2(0.0,0.7)))) * 0.75);
      float foam = 1.0 - smoothstep(0.04, 0.07, abs(bd - 1.08 - 0.05*sin(bang*9.0)));
      float foam2 = 1.0 - smoothstep(0.03, 0.05, abs(bd - 1.32 - 0.07*sin(bang*6.0+2.0)));
      col = mix(col, cFoam, max(foam, foam2*0.55) * step(0.5, vn(vec2(bang*6.0, 1.0))+0.25));
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
});
{
  const w = new THREE.Mesh(new THREE.PlaneGeometry(200, 120, 1, 1), waterMat);
  w.rotation.x = -Math.PI / 2;
  w.position.z = -40;
  scene.add(w);
}

// ── 빛 ────────────────────────────────────────────────────────
scene.add(new THREE.HemisphereLight('#5a6cc0', '#1c1428', 0.95));
const front = new THREE.DirectionalLight('#dfe4ff', 1.25);
front.position.set(-5, 8, 10);
scene.add(front);
const moonLight = new THREE.DirectionalLight('#a6c6ff', 2.0);
moonLight.position.set(9, 10, -7);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(2048, 2048);
Object.assign(moonLight.shadow.camera, { left: -10, right: 10, top: 6, bottom: -6, near: 1, far: 40 });
moonLight.shadow.bias = -0.0008;
scene.add(moonLight);

// ── 나루(선창) ───────────────────────────────────────────────────
const DOCK_Y = 0.55;
const wood = toon('#8a6040', { map: plankTex(), rim: 0.35 });
const woodD = toon('#5a3e2a', { rim: 0.35 });
{
  const r = rng(11);
  for (let x = -9.2; x < -0.1; x += 0.36) {
    const pl = M(box(0.33, 0.1, 2.75), wood, { pos: [x, DOCK_Y - 0.05 + (r() - 0.5) * 0.02, (r() - 0.5) * 0.08], rot: [0, (r() - 0.5) * 0.03, (r() - 0.5) * 0.03], outline: 0.012 });
    scene.add(pl);
  }
  for (const z of [-1.25, 1.25]) {
    scene.add(M(box(9.3, 0.14, 0.16), woodD, { pos: [-4.65, DOCK_Y - 0.16, z], outline: 0.012 }));
    for (let x = -8.4; x < 0; x += 1.7) scene.add(M(cyl(0.1, 0.11, 1.4), woodD, { pos: [x, -0.2, z], outline: 0.014 }));
  }
  // 나루 끝 말뚝 + 밧줄
  for (const z of [-1.25, 1.25]) {
    const p = M(cyl(0.12, 0.13, 1.95, 16), woodD, { pos: [-0.15, 0.2, z], outline: 0.016 });
    scene.add(p);
    scene.add(M(sph(0.125, 16, 8), woodD, { pos: [-0.15, 1.18, z], scale: [1, 0.5, 1], outline: 0.014 }));
    scene.add(M(torus(0.145, 0.035, Math.PI * 2, 8, 24), toon('#c9b07a', { rim: 0.4 }), { pos: [-0.15, 0.95, z], rot: [Math.PI / 2, 0, 0], outline: 0.01 }));
  }
  // 물속 말뚝
  for (const [x, z, rr] of POSTS.slice(0, 3)) {
    const h = 1.2 + rr * 4;
    scene.add(M(cyl(rr * 0.92, rr, h, 14), woodD, { pos: [x, h / 2 - 0.25, z], rot: [0, 0, (x - 3) * 0.02], outline: 0.016 }));
  }
}

// ── 갈대(인스턴스) ───────────────────────────────────────────────
{
  const reedMat = toon('#26363a', { rim: 0.35 });
  const headMat = toon('#4a3a2a', { rim: 0.3 });
  const clusters: [number, number, number, number, number][] = [
    // x, z, 퍼짐x, 퍼짐z, 수
    [-8.3, 2.4, 1.6, 1.0, 46],
    [7.4, 0.6, 1.6, 1.8, 50],
    [-5.5, -2.6, 4.2, 0.5, 40],
    [5.2, -3.2, 2.5, 0.6, 26],
    [-1.0, -2.4, 0.8, 0.4, 14],
  ];
  const total = clusters.reduce((a, c) => a + c[4], 0);
  const stalks = new THREE.InstancedMesh(new THREE.ConeGeometry(0.028, 1, 5), reedMat, total);
  const heads = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.045, 0.16, 4, 8), headMat, total);
  const r = rng(77);
  let i = 0;
  let hi = 0;
  const m4 = new THREE.Matrix4();
  for (const [cx, cz, sx, sz, n] of clusters)
    for (let k = 0; k < n; k++, i++) {
      const x = cx + (r() - 0.5) * sx * 2;
      const z = cz + (r() - 0.5) * sz * 2;
      const h = 1.1 + r() * 1.3;
      const tilt = (r() - 0.5) * 0.35;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.2, 0, tilt));
      m4.compose(new THREE.Vector3(x, h / 2 - 0.15, z), q, new THREE.Vector3(1, h, 1));
      stalks.setMatrixAt(i, m4);
      if (r() < 0.45) {
        const top = new THREE.Vector3(0, h * 0.42, 0).applyQuaternion(q).add(new THREE.Vector3(x, h / 2 - 0.15, z));
        m4.compose(top, q, new THREE.Vector3(1, 1, 1));
        heads.setMatrixAt(hi++, m4);
      }
    }
  heads.count = hi;
  stalks.castShadow = true;
  scene.add(stalks, heads);
}

// ── 영웅 ──────────────────────────────────────────────────────
const SKIN = toon('#f1c9a0', { rim: 0.45 });
const BLUSH = new THREE.MeshBasicMaterial({ color: '#e0605a' });
const INK = new THREE.MeshBasicMaterial({ color: '#1a1420' });
const GOLD = toon('#f2c04a', { rim: 0.8, emissive: '#6a4400' });

/** 둥근 머리: 눈 · 볼연지(무신도) · 귀 */
function head(r: number, o: { closed?: boolean; brows?: boolean } = {}) {
  const g = new THREE.Group();
  g.add(M(sph(r), SKIN, { outline: 0.02 }));
  for (const s of [-1, 1]) {
    g.add(M(sph(r * 0.18, 12, 8), SKIN, { pos: [s * r * 0.98, -r * 0.05, 0], scale: [0.5, 1, 0.8], outline: 0.012 }));
    if (o.closed) {
      const e = new THREE.Mesh(torus(r * 0.12, r * 0.025, Math.PI, 6, 12), INK);
      e.position.set(s * r * 0.36, -r * 0.02, r * 0.93);
      e.rotation.set(0, 0, Math.PI);
      g.add(e);
    } else {
      const e = new THREE.Mesh(sph(r * 0.1, 12, 8), INK);
      e.position.set(s * r * 0.36, 0, r * 0.92);
      e.scale.set(0.8, 1.15, 0.5);
      g.add(e);
    }
    const b = new THREE.Mesh(new THREE.CircleGeometry(r * 0.13, 16), BLUSH);
    b.position.set(s * r * 0.55, -r * 0.3, r * 0.8);
    b.lookAt(new THREE.Vector3(s * r * 0.55, -r * 0.3, r * 0.8).multiplyScalar(2));
    g.add(b);
    if (o.brows) {
      const br = new THREE.Mesh(box(r * 0.3, r * 0.07, r * 0.05), INK);
      br.position.set(s * r * 0.36, r * 0.24, r * 0.9);
      br.rotation.z = -s * 0.25;
      g.add(br);
    }
  }
  const mouth = new THREE.Mesh(torus(r * 0.08, r * 0.02, Math.PI, 6, 10), INK);
  mouth.position.set(0, -r * 0.38, r * 0.9);
  mouth.rotation.z = Math.PI;
  g.add(mouth);
  return g;
}
function sleeve(_mat: THREE.Material, len: number, mouth: number) {
  return lathe(
    [
      [0.001, -len * 0.9],
      [mouth * 0.92, -len - 0.01],
      [mouth, -len],
      [mouth * 0.75, -len * 0.45],
      [0.09, 0.0],
      [0.001, 0.01],
    ],
    18,
  );
}
/** 두 점을 잇는 팔다리(캡슐) */
function limb(a: V3, b: V3, r: number, mat: THREE.Material, outline = 0.016) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const d = vb.clone().sub(va);
  const m = M(cap(r, Math.max(0.01, d.length() - r)), mat, { outline });
  m.position.copy(va.clone().add(vb).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

function monk() {
  const g = new THREE.Group();
  const gray = toon('#7e828e', { rim: 0.5 });
  const prof: [number, number][] = [
    [0.001, 0],
    [0.42, 0.0],
    [0.44, 0.06],
    [0.37, 0.4],
    [0.34, 0.7],
    [0.31, 0.9],
    [0.2, 1.0],
    [0.001, 1.03],
  ];
  g.add(M(lathe(prof), gray, { outline: 0.022 }));
  // 갈색 조각보 가사: 왼어깨(+x)에서 오른 허리(−x)로 비스듬히
  const pf = profileFn(prof);
  const kasa = toon('#8a5a34', { map: patchworkTex(), rim: 0.45, side: THREE.DoubleSide });
  g.add(M(wrapPanel(pf, -1.55, 1.75, 0.22, (th) => 0.5 + ((th + 1.55) / 3.3) * 0.48, 0.022), kasa, { outline: 0.014 }));
  g.add(M(torus(0.2, 0.05, Math.PI, 8, 20), kasa, { pos: [0.16, 0.92, -0.02], rot: [0, Math.PI / 2, 0], outline: 0.012 }));
  // 소매 · 손
  const lS = M(sleeve(gray, 0.5, 0.17), gray, { pos: [0.3, 0.92, 0.02], rot: [-1.0, 0, -0.3], outline: 0.018 });
  const rS = M(sleeve(gray, 0.48, 0.17), gray, { pos: [-0.3, 0.92, 0.02], rot: [-0.9, 0, -0.75], outline: 0.018 });
  g.add(lS, rS);
  g.add(M(sph(0.075), SKIN, { pos: [0.14, 0.68, 0.45], outline: 0.012 }));
  g.add(M(sph(0.075), SKIN, { pos: [-0.6, 0.72, 0.33], outline: 0.012 }));
  // 민머리 + 머리 위 툰 하이라이트
  const h = head(0.31, { closed: true });
  h.position.set(0, 1.3, 0.02);
  g.add(h);
  const shine = new THREE.Mesh(sph(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff6e8' }));
  shine.position.set(0.1, 0.26, 0.12);
  shine.scale.set(1.3, 0.35, 0.8);
  h.add(shine);
  // 염주: 목에 건 큰 알
  const beadMat = toon('#3e2418', { rim: 0.6 });
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const bead = M(sph(0.032, 10, 8), i === 0 ? toon('#a8402c', { rim: 0.6 }) : beadMat, { outline: 0.008 });
    bead.position.set(Math.sin(a) * 0.26, 1.0 - (1 - Math.cos(a)) * 0.13, Math.cos(a) * 0.24 + 0.04);
    g.add(bead);
  }
  // 육환장: 나무 자루 + 금고리 + 여섯 고리
  const staff = new THREE.Group();
  staff.add(M(cyl(0.028, 0.032, 2.0, 10), toon('#6e4a2a', { rim: 0.5 }), { pos: [0, 1.0, 0], outline: 0.012 }));
  staff.add(M(torus(0.15, 0.022, Math.PI * 2, 8, 32), GOLD, { pos: [0, 2.16, 0], outline: 0.01 }));
  staff.add(M(new THREE.ConeGeometry(0.04, 0.16, 10), GOLD, { pos: [0, 2.38, 0], outline: 0.01 }));
  staff.add(M(sph(0.045, 12, 8), GOLD, { pos: [0, 2.0, 0], outline: 0.01 }));
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const k = i % 3;
    const a = Math.PI / 2 + side * (0.75 + k * 0.62);
    const rr = M(torus(0.05, 0.011, Math.PI * 2, 6, 18), GOLD, { outline: 0.006 });
    rr.position.set(Math.cos(a) * 0.15, 2.16 + Math.sin(a) * 0.15 - 0.045, 0);
    rr.rotation.set(0, Math.PI / 2, 0);
    staff.add(rr);
  }
  staff.position.set(-0.6, 0, 0.36);
  staff.rotation.set(0.04, 0, 0.05);
  g.add(staff);
  return { g, headTop: 1.62, staffTop: new THREE.Vector3(-0.6, 2.35, 0.36) };
}

function manshin() {
  const g = new THREE.Group();
  const red = toon('#cf2f3a', { rim: 0.55 });
  const blue = toon('#2c58b0', { rim: 0.55 });
  // 푸른 치마
  g.add(
    M(
      lathe([
        [0.001, 0],
        [0.45, 0],
        [0.46, 0.05],
        [0.34, 0.45],
        [0.24, 0.66],
        [0.001, 0.68],
      ]),
      blue,
      { outline: 0.02 },
    ),
  );
  // 홍철릭
  g.add(
    M(
      lathe([
        [0.001, 0.3],
        [0.41, 0.3],
        [0.43, 0.35],
        [0.31, 0.62],
        [0.27, 0.8],
        [0.27, 0.92],
        [0.16, 1.0],
        [0.001, 1.02],
      ]),
      red,
      { outline: 0.02 },
    ),
  );
  // 허리띠(남) + 늘어진 끈
  g.add(M(torus(0.285, 0.04, Math.PI * 2, 8, 32), blue, { pos: [0, 0.7, 0], rot: [Math.PI / 2, 0, 0], outline: 0.01 }));
  g.add(M(box(0.07, 0.36, 0.025), blue, { pos: [0.1, 0.52, 0.3], rot: [-0.25, 0, 0.08], outline: 0.008 }));
  g.add(M(box(0.07, 0.3, 0.025), toon('#e8c23a'), { pos: [0.19, 0.55, 0.27], rot: [-0.25, 0, 0.2], outline: 0.008 }));
  // 소매(붉은, 끝동 노랑·파랑)
  const lS = M(sleeve(red, 0.46, 0.18), red, { pos: [0.27, 0.92, 0], rot: [0.25, 0, 2.4], outline: 0.018 });
  const rS = M(sleeve(red, 0.46, 0.18), red, { pos: [-0.27, 0.92, 0], rot: [-0.6, 0, -0.52], outline: 0.018 });
  g.add(lS, rS);
  const cuffY = toon('#e8c23a');
  const cuffB = toon('#2c58b0');
  const lc = M(torus(0.17, 0.03, Math.PI * 2, 6, 24), cuffY, { outline: 0.008 });
  lc.position.set(0, -0.42, 0);
  lc.rotation.x = Math.PI / 2;
  lS.add(lc);
  const lc2 = M(torus(0.16, 0.025, Math.PI * 2, 6, 24), cuffB, { outline: 0.006 });
  lc2.position.set(0, -0.37, 0);
  lc2.rotation.x = Math.PI / 2;
  lS.add(lc2);
  const rc = lc.clone();
  rS.add(rc);
  // 손
  g.add(M(sph(0.07), SKIN, { pos: [0.66, 1.34, 0.12], outline: 0.012 }));
  g.add(M(sph(0.07), SKIN, { pos: [-0.5, 0.52, 0.22], outline: 0.012 }));
  // 머리: 쪽진 검은 머리 + 붉은 댕기 + 비녀
  const h = head(0.3);
  h.position.set(0, 1.29, 0.02);
  g.add(h);
  const hair = toon('#17141c', { rim: 0.8 });
  // 가르마 머리: 위 덮개 + 뒤통수(얼굴은 비운다)
  h.add(M(new THREE.SphereGeometry(0.315, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), hair, { pos: [0, 0.02, -0.01], outline: 0.016 }));
  h.add(M(new THREE.SphereGeometry(0.318, 28, 16, Math.PI * 1.12, Math.PI * 0.76, 0, Math.PI * 0.72), hair, { outline: 0.016 }));
  h.add(M(sph(0.14), hair, { pos: [0, 0.02, -0.34], outline: 0.014 }));
  h.add(M(cyl(0.014, 0.014, 0.46, 8), GOLD, { pos: [0, 0.02, -0.36], rot: [0, 0, Math.PI / 2], outline: 0.006 }));
  h.add(M(box(0.06, 0.42, 0.02), red, { pos: [0.04, -0.22, -0.42], rot: [0.2, 0, 0.1], outline: 0.006 }));
  // 오방색 부채(청 · 적 · 황 · 백 · 흑)
  const fan = new THREE.Group();
  const cols = ['#2a5bd7', '#d8343c', '#f2c230', '#f4efe6', '#26222e'];
  const back2 = new THREE.Mesh(new THREE.CircleGeometry(0.4, 40, -0.05, Math.PI + 0.1), new THREE.MeshBasicMaterial({ color: '#110e1d', side: THREE.DoubleSide }));
  back2.position.z = -0.006;
  fan.add(back2);
  cols.forEach((c, i) => {
    const seg = new THREE.Mesh(new THREE.CircleGeometry(0.38, 12, (i * Math.PI) / 5, Math.PI / 5), toon(c, { side: THREE.DoubleSide, rim: 0.3 }));
    fan.add(seg);
  });
  const hub = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20, 0, Math.PI), toon('#7a4a26', { side: THREE.DoubleSide }));
  hub.position.z = 0.004;
  fan.add(hub);
  fan.position.set(0.72, 1.36, 0.16);
  fan.rotation.set(-0.1, -0.55, -0.35);
  g.add(fan);
  // 방울: 손잡이 + 금방울 송이 + 오색 끈
  const bell = new THREE.Group();
  bell.add(M(cyl(0.022, 0.022, 0.24, 8), toon('#7a4a26'), { pos: [0, -0.12, 0], outline: 0.006 }));
  const bp: V3[] = [
    [0, 0.05, 0],
    [0.06, 0.02, 0.03],
    [-0.06, 0.02, 0.03],
    [0.03, 0.09, -0.04],
    [-0.04, 0.1, -0.02],
    [0, 0.0, 0.06],
    [0.05, 0.08, 0.05],
  ];
  for (const p of bp) bell.add(M(sph(0.04, 12, 8), GOLD, { pos: p, outline: 0.008 }));
  cols.forEach((c, i) => bell.add(M(box(0.035, 0.32, 0.01), toon(c), { pos: [-0.06 + i * 0.03, -0.38, 0.02], rot: [0.1, 0, (i - 2) * 0.08], outline: 0.005 })));
  bell.position.set(-0.5, 0.6, 0.24);
  bell.rotation.set(0, 0, 0.2);
  g.add(bell);
  return { g, headTop: 1.6 };
}

function posu() {
  const g = new THREE.Group();
  const cream = toon('#e9e1cc', { rim: 0.45 });
  const teal = toon('#2f7466', { rim: 0.55 });
  const leather = toon('#6e4526', { rim: 0.45 });
  // 바지 · 행전 · 짚신
  for (const s of [-1, 1]) {
    g.add(M(cap(0.13, 0.22), cream, { pos: [s * 0.13, 0.36, 0], outline: 0.018 }));
    g.add(M(cyl(0.1, 0.09, 0.2, 12), toon('#59607a'), { pos: [s * 0.13, 0.13, 0], outline: 0.012 }));
    g.add(M(sph(0.11, 14, 8), toon('#c7aa6a'), { pos: [s * 0.13, 0.03, 0.05], scale: [0.9, 0.45, 1.4], outline: 0.01 }));
  }
  // 저고리
  const tprof: [number, number][] = [
    [0.001, 0.48],
    [0.3, 0.48],
    [0.32, 0.55],
    [0.3, 0.8],
    [0.27, 0.95],
    [0.15, 1.02],
    [0.001, 1.04],
  ];
  g.add(M(lathe(tprof), cream, { outline: 0.02 }));
  // 짧은 조끼(앞이 트인)
  g.add(M(wrapPanel(profileFn(tprof), 0.35, Math.PI * 2 - 0.35, 0.6, () => 0.98, 0.025, 36, 8), teal, { outline: 0.014 }));
  g.add(M(torus(0.315, 0.035, Math.PI * 2, 8, 32), leather, { pos: [0, 0.6, 0], rot: [Math.PI / 2, 0, 0], outline: 0.008 }));
  // 화약 주머니(허리) + 뿔 화약통 끈
  g.add(M(sph(0.12, 16, 10), leather, { pos: [-0.2, 0.5, 0.3], scale: [1, 1, 0.7], outline: 0.012 }));
  g.add(M(box(0.18, 0.07, 0.1), toon('#583619'), { pos: [-0.2, 0.6, 0.33], rot: [0.2, -0.4, 0], outline: 0.008 }));
  g.add(M(torus(0.36, 0.02, Math.PI * 2, 6, 40), toon('#4a2e18'), { pos: [0, 0.8, 0], rot: [Math.PI / 2 + 0.05, 0.75, 0], scale: [1, 0.9, 1], outline: 0.006 }));
  g.add(M(new THREE.ConeGeometry(0.06, 0.26, 12), toon('#dccfa6'), { pos: [0.24, 0.56, 0.24], rot: [0, 0, 2.3], outline: 0.01 }));
  // 팔
  const GUN0: V3 = [-0.05, 0.6, 0.3];
  const GUND = new THREE.Vector3(0.22, 0.88, 0.42).normalize();
  const along = (t: number): V3 => [GUN0[0] + GUND.x * t, GUN0[1] + GUND.y * t, GUN0[2] + GUND.z * t];
  g.add(limb([0.27, 0.92, 0], along(0.48), 0.09, cream));
  g.add(limb([-0.27, 0.92, 0], along(-0.02), 0.09, cream));
  g.add(M(sph(0.07), SKIN, { pos: along(0.48), outline: 0.012 }));
  g.add(M(sph(0.07), SKIN, { pos: along(-0.02), outline: 0.012 }));
  // 머리 + 털모자(둥근 덮개 + 털 테 + 귀덮개)
  const h = head(0.29, { brows: true });
  h.position.set(0, 1.3, 0.02);
  g.add(h);
  const mus = new THREE.Mesh(box(0.14, 0.035, 0.03), INK);
  mus.position.set(0, -0.06, 0.28);
  h.add(mus);
  const fur = toon('#7b5636', { rim: 0.6 });
  h.add(M(new THREE.SphereGeometry(0.31, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.45), toon('#5a3b22', { rim: 0.6 }), { pos: [0, 0.06, 0], outline: 0.018 }));
  const furRing = new THREE.TorusGeometry(0.3, 0.085, 10, 40);
  {
    const p = furRing.getAttribute('position') as THREE.BufferAttribute;
    const nr = rng(5);
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      const k = 1 + (nr() - 0.3) * 0.12;
      const c = new THREE.Vector3(v.x, v.y, 0).normalize().multiplyScalar(0.3);
      v.sub(c).multiplyScalar(k).add(c);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    furRing.computeVertexNormals();
  }
  h.add(M(furRing, fur, { pos: [0, 0.12, 0], rot: [Math.PI / 2 + 0.12, 0, 0], outline: 0.014 }));
  for (const s of [-1, 1]) h.add(M(sph(0.12, 14, 10), fur, { pos: [s * 0.27, -0.08, -0.02], scale: [0.6, 1.1, 0.9], outline: 0.012 }));
  // 화승총: 긴 쇠 총신 + 나무 개머리 + 놋 띠 + 불씨
  const gun = new THREE.Group();
  gun.add(M(cyl(0.024, 0.028, 1.35, 10), toon('#3a3f48', { rim: 0.8 }), { pos: [0, 0.68, 0], outline: 0.01 }));
  const stockShape = new THREE.Shape();
  stockShape.moveTo(-0.05, 0);
  stockShape.lineTo(0.05, 0);
  stockShape.lineTo(0.09, -0.42);
  stockShape.lineTo(-0.05, -0.42);
  stockShape.closePath();
  gun.add(M(new THREE.ExtrudeGeometry(stockShape, { depth: 0.07, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 }), toon('#7a4a24'), { pos: [0, 0.1, -0.035], outline: 0.01 }));
  gun.add(M(cyl(0.04, 0.04, 0.5, 10), toon('#7a4a24'), { pos: [0, 0.33, 0], outline: 0.01 }));
  for (const y of [0.55, 0.95, 1.2]) gun.add(M(cyl(0.034, 0.034, 0.035, 10), GOLD, { pos: [0, y, 0], outline: 0.005 }));
  const ember = new THREE.Mesh(sph(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff6a24' }));
  ember.position.set(0.05, 0.16, 0.03);
  gun.add(ember);
  const emberGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(255,120,40,1)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  emberGlow.scale.setScalar(0.28);
  emberGlow.position.copy(ember.position);
  gun.add(emberGlow);
  gun.add(M(torus(0.06, 0.012, Math.PI * 2, 6, 16), toon('#c9a86a'), { pos: [0.02, 0.22, 0], rot: [0, 0, 0.3], outline: 0.004 }));
  gun.position.set(...GUN0);
  gun.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), GUND);
  g.add(gun);
  return { g, headTop: 1.66, muzzle: gun };
}

// ── 굿상 ──────────────────────────────────────────────────────
function altar() {
  const g = new THREE.Group();
  const lac = toon('#7a2a20', { rim: 0.5 });
  g.add(M(box(0.82, 0.07, 0.5), lac, { pos: [0, 0.46, 0], outline: 0.014 }));
  for (const [x, z] of [
    [-0.34, -0.19],
    [0.34, -0.19],
    [-0.34, 0.19],
    [0.34, 0.19],
  ])
    g.add(M(cyl(0.03, 0.035, 0.44, 8), lac, { pos: [x, 0.22, z], outline: 0.01 }));
  const white = toon('#f6efe0', { rim: 0.4 });
  for (const x of [-0.3, 0.3]) {
    g.add(M(cyl(0.04, 0.045, 0.22, 12), white, { pos: [x, 0.6, -0.08], outline: 0.008 }));
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffd36a' }));
    flame.scale.set(0.8, 1.7, 0.8);
    flame.position.set(x, 0.77, -0.08);
    g.add(flame);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(255,190,90,1)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
    gl.scale.setScalar(0.55);
    gl.position.set(x, 0.78, -0.08);
    g.add(gl);
  }
  // 정화수 사발
  g.add(
    M(
      lathe(
        [
          [0.001, 0],
          [0.06, 0],
          [0.1, 0.06],
          [0.12, 0.12],
          [0.11, 0.12],
          [0.001, 0.05],
        ],
        24,
      ),
      white,
      { pos: [0, 0.495, 0.06], outline: 0.008 },
    ),
  );
  g.add(M(new THREE.CircleGeometry(0.108, 24), toon('#9cc8ff', { rim: 0.2 }), { pos: [0, 0.6, 0.06], rot: [-Math.PI / 2, 0, 0], outline: 0 }));
  // 지화 한 송이(분홍 종이꽃)
  const fl = new THREE.Group();
  fl.add(M(cyl(0.012, 0.012, 0.3, 6), toon('#3f6a3a'), { pos: [0, 0.15, 0], outline: 0.004 }));
  const pink = toon('#f08cb0', { rim: 0.5, side: THREE.DoubleSide });
  const pale = toon('#fbd6e2', { rim: 0.5, side: THREE.DoubleSide });
  for (let ring = 0; ring < 3; ring++)
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + ring * 0.4;
      const pet = new THREE.Mesh(sph(0.06 - ring * 0.012, 10, 6), ring === 1 ? pale : pink);
      pet.scale.set(1, 0.35, 1.4);
      pet.position.set(Math.cos(a) * (0.06 - ring * 0.018), 0.32 + ring * 0.025, Math.sin(a) * (0.06 - ring * 0.018));
      pet.rotation.set(0, -a, 0.5 + ring * 0.25);
      fl.add(pet);
    }
  fl.add(M(cyl(0.05, 0.04, 0.09, 10), toon('#d8cba8'), { pos: [0, 0.04, 0], outline: 0.006 }));
  fl.position.set(0.14, 0.5, -0.14);
  g.add(fl);
  return g;
}

// ── 보스: 삯 못 받은 뱃사공 ─────────────────────────────────────────
function boatGeo(len: number, w: number, depth: number) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const r = Math.max(0.001, Math.pow(Math.sin(Math.PI * t), 0.55));
    pts.push([r, t * len - len / 2]);
  }
  const g = lathe(pts, 24, 0, Math.PI);
  g.rotateZ(-Math.PI / 2);
  g.scale(1, depth, w / 2);
  g.computeVertexNormals();
  return g;
}
function ferryman() {
  const g = new THREE.Group();
  const straw = toon('#c09060', { map: strawTex('#b08452'), rim: 0.35 });
  const strawD = toon('#8a6440', { map: strawTex('#8a6442'), rim: 0.35 });
  // 도롱이: 세 단, 아랫단 끝은 들쭉날쭉
  const tier = (rTop: number, rBot: number, yTop: number, yBot: number, seed: number, mat: THREE.Material) => {
    const geo = lathe(
      [
        [rBot, yBot],
        [(rBot + rTop) / 2 + 0.02, (yBot + yTop) / 2],
        [rTop, yTop],
      ],
      36,
    );
    const p = geo.getAttribute('position') as THREE.BufferAttribute;
    const r = rng(seed);
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(p.getY(i) - yBot) < 1e-4) {
        p.setY(i, yBot - r() * 0.16);
        const k = 1 + (r() - 0.5) * 0.1;
        p.setX(i, p.getX(i) * k);
        p.setZ(i, p.getZ(i) * k);
      }
    }
    geo.computeVertexNormals();
    return M(geo, mat, { outline: 0.02 });
  };
  g.add(tier(0.3, 0.62, 0.95, 0.05, 3, strawD));
  g.add(tier(0.27, 0.56, 1.35, 0.55, 4, straw));
  g.add(tier(0.18, 0.48, 1.78, 1.05, 5, straw));
  // 유령 손 · 팔
  const ghost = toon('#a9c4d4', { rim: 0.9, emissive: '#1d3c4a' });
  const OAR0 = new THREE.Vector3(0.2, 1.05, 0.28);
  const OARD = new THREE.Vector3(Math.sin(0.78), Math.cos(0.78), -0.15).normalize();
  const on = (t: number): V3 => [OAR0.x + OARD.x * t, OAR0.y + OARD.y * t, OAR0.z + OARD.z * t];
  g.add(limb([0.3, 1.62, 0.05], on(0.75), 0.085, strawD, 0.014));
  g.add(limb([-0.3, 1.62, 0.05], on(0.2), 0.085, strawD, 0.014));
  g.add(M(sph(0.08), ghost, { pos: on(0.75), outline: 0.012 }));
  g.add(M(sph(0.08), ghost, { pos: on(0.2), outline: 0.012 }));
  // 그늘진 얼굴 + 눈빛
  g.add(M(sph(0.25), toon('#0b0d16', { rim: 0.15 }), { pos: [0, 1.9, 0.08], outline: 0.012 }));
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#b8fbff' });
  const eyeGlow = glowTex('rgba(140,255,250,1)');
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(sph(0.04, 12, 8), eyeMat);
    e.scale.set(1.4, 0.6, 0.6);
    e.position.set(s * 0.095, 1.87, 0.3);
    g.add(e);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: eyeGlow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.scale.setScalar(0.5);
    sp.position.set(s * 0.095, 1.87, 0.36);
    g.add(sp);
  }
  // 삿갓: 넓고 낮은 원뿔(아랫면 어둡게)
  const hat = new THREE.Group();
  hat.add(M(new THREE.ConeGeometry(0.8, 0.4, 40, 1, true), toon('#d0a466', { map: strawTex('#c49860'), rim: 0.45, side: THREE.DoubleSide }), { outline: 0.02 }));
  hat.add(M(new THREE.ConeGeometry(0.08, 0.1, 12), toon('#7a6236'), { pos: [0, 0.24, 0], outline: 0.008 }));
  hat.position.set(0, 2.24, -0.06);
  hat.rotation.set(-0.22, 0, -0.06);
  g.add(hat);
  // 긴 노: 뒤로 치켜든 자세(내리칠 참)
  const oar = new THREE.Group();
  const oarWood = toon('#6a4a30', { rim: 0.6 });
  oar.add(M(cyl(0.04, 0.045, 2.3, 10), oarWood, { pos: [0, 0.85, 0], outline: 0.012 }));
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.07, 0);
  bladeShape.lineTo(0.07, 0);
  bladeShape.quadraticCurveTo(0.22, 0.5, 0.17, 1.0);
  bladeShape.lineTo(-0.17, 1.0);
  bladeShape.quadraticCurveTo(-0.22, 0.5, -0.07, 0);
  oar.add(M(new THREE.ExtrudeGeometry(bladeShape, { depth: 0.04, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1 }), oarWood, { pos: [0, 1.9, -0.02], outline: 0.012 }));
  oar.position.copy(OAR0);
  oar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), OARD);
  g.add(oar);
  // 발치의 넋 안개
  const mt = mistTex(31);
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.6), new THREE.MeshBasicMaterial({ map: mt, color: '#8ff0ff', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.set(-0.1 + i * 0.15, 0.15 + i * 0.12, 0.3 - i * 0.2);
    g.add(m);
  }
  return { g, headTop: 2.42 };
}

// ── 장면에 놓기 ────────────────────────────────────────────────
const POS = {
  posu: new THREE.Vector3(-5.35, DOCK_Y, -0.25),
  manshin: new THREE.Vector3(-3.95, DOCK_Y, -0.05),
  monk: new THREE.Vector3(-2.5, DOCK_Y, 0.15),
  altar: new THREE.Vector3(-1.05, DOCK_Y, 0.35),
  boss: new THREE.Vector3(3.75, -0.05, -0.25),
};
const P = posu();
P.g.position.copy(POS.posu);
P.g.rotation.y = 0.8;
const S = manshin();
S.g.position.copy(POS.manshin);
S.g.rotation.y = 0.65;
const K = monk();
K.g.position.copy(POS.monk);
K.g.rotation.y = 0.55;
const A = altar();
A.position.copy(POS.altar);
A.rotation.y = 0.1;
const F = ferryman();
F.g.position.copy(POS.boss);
F.g.rotation.y = -0.55;
F.g.scale.setScalar(1.28);
scene.add(P.g, S.g, K.g, A, F.g);
scene.updateMatrixWorld(true);
{
  const hull = M(boatGeo(BOAT.len, BOAT.w, 0.55), toon('#4e3626', { map: plankTex(), rim: 0.55, side: THREE.DoubleSide }), { pos: [BOAT.x, 0.12, BOAT.z], rot: [0, 0.04, 0], outline: 0.022 });
  scene.add(hull);
  // 뱃전(가장자리 각목) · 가로대
  const rimPts = (side: number) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const r = Math.max(0.001, Math.pow(Math.sin(Math.PI * t), 0.55));
      pts.push(new THREE.Vector3(t * BOAT.len - BOAT.len / 2, 0, side * r * (BOAT.w / 2)));
    }
    return new THREE.CatmullRomCurve3(pts);
  };
  for (const s of [-1, 1]) hull.add(M(new THREE.TubeGeometry(rimPts(s), 48, 0.045, 8), toon('#3a281c', { rim: 0.6 }), { outline: 0.01 }));
  for (const x of [-1.0, 0.2, 1.2]) hull.add(M(box(0.16, 0.05, BOAT.w * 0.9), toon('#5e4230'), { pos: [x, -0.08, 0], outline: 0.008 }));
}

// 등불 기둥(파티 뒤, 따뜻한 빛)
{
  const pole = new THREE.Group();
  pole.add(M(cyl(0.04, 0.05, 2.1, 10), woodD, { pos: [0, 1.05, 0], outline: 0.012 }));
  pole.add(M(box(0.5, 0.05, 0.05), woodD, { pos: [0.22, 2.05, 0], outline: 0.01 }));
  const lan = M(
    lathe([
      [0.001, -0.2],
      [0.12, -0.19],
      [0.17, -0.05],
      [0.17, 0.08],
      [0.12, 0.2],
      [0.001, 0.21],
    ]),
    toon('#f0a050', { emissive: '#d0521e', ei: 0.9, rim: 0.2 }),
    { pos: [0.42, 1.75, 0], outline: 0.012 },
  );
  pole.add(lan);
  pole.add(M(cyl(0.09, 0.09, 0.05, 12), toon('#2a1a12'), { pos: [0.42, 1.98, 0], outline: 0.006 }));
  pole.add(M(cyl(0.09, 0.09, 0.05, 12), toon('#2a1a12'), { pos: [0.42, 1.53, 0], outline: 0.006 }));
  const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(255,170,90,1)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
  gl.scale.setScalar(1.3);
  gl.position.set(0.42, 1.75, 0.05);
  pole.add(gl);
  pole.position.set(-4.75, DOCK_Y, -1.05);
  scene.add(pole);
  const lamp = new THREE.PointLight('#ffa860', 9, 7, 1.4);
  lamp.position.set(-4.33, DOCK_Y + 1.75, -0.8);
  scene.add(lamp);
}
const candle = new THREE.PointLight('#ffb45a', 4, 3.8, 1.5);
candle.position.set(POS.altar.x, DOCK_Y + 0.85, POS.altar.z + 0.1);
scene.add(candle);
const ghostLight = new THREE.PointLight('#7ff6ff', 5, 3.2, 1.5);
ghostLight.position.set(POS.boss.x - 0.45, 1.9, POS.boss.z + 1.0);
scene.add(ghostLight);

// 안개 띠(부드러운 캔버스 판 여러 겹)
{
  const layers: [number, number, number, number, number][] = [
    // z, y, 폭, 높이, 불투명
    [-3.5, 0.35, 30, 1.6, 0.55],
    [-9, 0.6, 46, 2.6, 0.6],
    [-16, 0.9, 60, 3.6, 0.55],
    [-23, 1.0, 80, 4.0, 0.5],
    [1.6, 0.1, 24, 0.9, 0.35],
  ];
  layers.forEach(([z, y, w, h, op], i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: mistTex(100 + i), color: '#8b9ee0', transparent: true, opacity: op * 0.55, depthWrite: false, fog: false }));
    m.position.set(0, y, z);
    m.renderOrder = 2;
    scene.add(m);
  });
}

// 의도 선(3D): 뱃사공 머리 → 승려 머리, 외곽선 있는 굵은 툰 관 + 화살촉
const intentGroup = new THREE.Group();
{
  const from = new THREE.Vector3(POS.boss.x - 0.75, 2.75, POS.boss.z + 0.3);
  const to = new THREE.Vector3(POS.monk.x - 0.12, DOCK_Y + K.headTop + 0.06, POS.monk.z + 0.1);
  const ctrl = new THREE.Vector3((from.x + to.x) / 2 + 0.4, 4.0, 0);
  const curve = new THREE.QuadraticBezierCurve3(from, ctrl, to);
  const pts = curve.getPoints(40);
  const T_HEAD = 0.9;
  const shaftPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 36; i++) shaftPts.push(curve.getPoint((i / 36) * T_HEAD));
  const mat = new THREE.MeshBasicMaterial({ color: '#ff5a3c', fog: false });
  intentGroup.add(M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(shaftPts), 64, 0.045, 10), mat, { outline: 0.022, shadow: false }));
  const base = curve.getPoint(T_HEAD - 0.02);
  const dir = to.clone().sub(base);
  const hgt = dir.length();
  dir.normalize();
  const cone = M(new THREE.ConeGeometry(0.15, hgt, 16), mat, { outline: 0.022, shadow: false });
  cone.position.copy(base.clone().add(to).multiplyScalar(0.5));
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  intentGroup.add(cone);
  // 점선 느낌: 흰 마디
  for (let i = 3; i < 34; i += 4) {
    const d = M(sph(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffe0c8', fog: false }), { outline: 0, shadow: false });
    d.position.copy(pts[i]);
    intentGroup.add(d);
  }
  scene.add(intentGroup);
}

// 카드 그림 전용 소품(본 장면에서는 숨김)
const props: THREE.Object3D[] = [];
{
  // 1 노잣돈: 지전이 배로 날아간다
  const p1 = new THREE.Group();
  const ct = coinTex();
  const r = rng(9);
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const c = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), new THREE.MeshBasicMaterial({ map: ct, transparent: true, side: THREE.DoubleSide, alphaTest: 0.3 }));
    c.position.set(0.9 + t * 1.9, 1.5 + Math.sin(t * Math.PI) * 0.8 + r() * 0.2, 1.2 - t * 0.6);
    c.rotation.set(r() * 1.5, r() * 1.5, r());
    p1.add(c);
  }
  // 2 육환장: 휘두른 자국 · 넋흔들림 고리
  const p2 = new THREE.Group();
  const swoosh = new THREE.Mesh(torus(0.65, 0.03, Math.PI * 0.7, 6, 40), new THREE.MeshBasicMaterial({ color: '#fff4dc', transparent: true, opacity: 0.85 }));
  swoosh.position.copy(POS.monk).add(new THREE.Vector3(-0.35, 1.95, 0.6));
  swoosh.rotation.set(0.3, 0.4, 0.4);
  p2.add(swoosh);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(torus(0.25 + i * 0.16, 0.012, Math.PI * 2, 6, 40), new THREE.MeshBasicMaterial({ color: '#a8f6ff', transparent: true, opacity: 0.8 - i * 0.2 }));
    ring.position.copy(POS.monk).add(new THREE.Vector3(-0.55, 2.2, 0.8));
    ring.lookAt(camera.position);
    p2.add(ring);
  }
  // 3 급소 저격: 총구 불꽃 · 연기
  const p3 = new THREE.Group();
  const star = new THREE.Shape();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rr = i % 2 ? 0.1 : 0.32;
    if (i === 0) star.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else star.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const flash = new THREE.Mesh(new THREE.ShapeGeometry(star), new THREE.MeshBasicMaterial({ color: '#ffd45a', side: THREE.DoubleSide }));
  const muzzle = new THREE.Vector3(0, 1.36, 0);
  P.muzzle.localToWorld(muzzle);
  flash.position.copy(muzzle);
  flash.lookAt(camera.position);
  p3.add(flash);
  for (let i = 0; i < 4; i++) p3.add(M(sph(0.12 + i * 0.03), toon('#d9dbe6', { rim: 0.4 }), { pos: [muzzle.x + 0.2 + i * 0.2, muzzle.y + 0.12 + i * 0.06, muzzle.z], outline: 0.012, shadow: false }));
  // 4 공수: 점지 표식(금빛 과녁)
  const p4 = new THREE.Group();
  const sig = new THREE.Group();
  sig.add(new THREE.Mesh(torus(0.3, 0.025, Math.PI * 2, 6, 40), new THREE.MeshBasicMaterial({ color: '#ffd45a' })));
  sig.add(new THREE.Mesh(torus(0.16, 0.02, Math.PI * 2, 6, 30), new THREE.MeshBasicMaterial({ color: '#ffd45a' })));
  for (let i = 0; i < 4; i++) {
    const t = new THREE.Mesh(box(0.04, 0.16, 0.02), new THREE.MeshBasicMaterial({ color: '#ffd45a' }));
    t.position.set(Math.cos((i * Math.PI) / 2) * 0.36, Math.sin((i * Math.PI) / 2) * 0.36, 0);
    t.rotation.z = (i * Math.PI) / 2 + Math.PI / 2;
    sig.add(t);
  }
  sig.position.copy(POS.manshin).add(new THREE.Vector3(0.95, 1.5, 0.8));
  sig.scale.setScalar(0.7);
  sig.lookAt(camera.position);
  p4.add(sig);
  // 5 청배: 굿상 위에 내려오는 몸주 신령의 빛
  const p5 = new THREE.Group();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(255,236,170,1)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(1.6);
  halo.position.copy(POS.altar).add(new THREE.Vector3(0, 1.25, 0));
  p5.add(halo);
  const spirit = M(
    lathe([
      [0.001, 0],
      [0.22, 0.05],
      [0.16, 0.45],
      [0.1, 0.62],
      [0.001, 0.66],
    ]),
    toon('#fff2c8', { emissive: '#8a6a20', transparent: true, opacity: 0.85, rim: 1 }),
    { pos: [POS.altar.x, POS.altar.y + 0.85, POS.altar.z], outline: 0 },
  );
  p5.add(spirit);
  p5.add(M(sph(0.12), toon('#fff2c8', { emissive: '#8a6a20', rim: 1 }), { pos: [POS.altar.x, POS.altar.y + 1.6, POS.altar.z], outline: 0 }));
  for (const p of [p1, p2, p3, p4, p5]) {
    p.visible = false;
    scene.add(p);
    props.push(p);
  }
}

// ── 그리기 ────────────────────────────────────────────────────
function setMoonX(cam: THREE.PerspectiveCamera, width: number) {
  const v = moonPos.clone().project(cam);
  waterMat.uniforms.moonX.value = (v.x * 0.5 + 0.5) * 1280;
  waterMat.uniforms.res.value = width;
}

async function main() {
  const fonts = await waitFonts(['Jua', 'Gowun Dodum']);
  const refs = buildUI(document.getElementById('ui')!);

  // 카드 그림: 같은 세계를 다른 카메라로 찍는다
  const shots: { from: V3; to: V3; fov: number }[] = [
    { from: [1.5, 2.2, 3.5], to: [3.2, 2.2, -0.1], fov: 46 },
    { from: [-1.25, 2.45, 3.0], to: [-2.65, 2.15, 0.45], fov: 34 },
    { from: [-4.55, 1.85, 2.4], to: [-5.3, 1.55, -0.25], fov: 34 },
    { from: [-3.0, 2.0, 2.4], to: [-3.55, 1.85, 0], fov: 38 },
    { from: [-0.6, 1.6, 2.1], to: [-1.05, 1.25, 0.3], fov: 40 },
  ];
  intentGroup.visible = false;
  const artCam = new THREE.PerspectiveCamera(36, ART_W / ART_H, 0.05, 300);
  renderer.setSize(ART_W * 2, ART_H * 2, false);
  shots.forEach((s, i) => {
    props.forEach((p, k) => (p.visible = k === i));
    artCam.fov = s.fov;
    artCam.position.set(...s.from);
    artCam.lookAt(...s.to);
    artCam.updateProjectionMatrix();
    artCam.updateMatrixWorld();
    setMoonX(artCam, ART_W * 2);
    renderer.render(scene, artCam);
    refs.cardArts[i].getContext('2d')!.drawImage(renderer.domElement, 0, 0);
  });
  props.forEach((p) => (p.visible = false));
  intentGroup.visible = true;

  // 본 장면
  renderer.setSize(1280, 800, false);
  setMoonX(camera, 1280);
  const tr = performance.now();
  renderer.render(scene, camera);
  const renderMs = Math.round(performance.now() - tr);

  // 겹 UI 자리: 3D 좌표를 투영
  const feet = (v: THREE.Vector3) => project(camera, v.clone());
  const ids = ['posu', 'manshin', 'monk'] as const;
  const plateTop = Math.max(...ids.map((id) => feet(POS[id].clone().add(new THREE.Vector3(0, 0, 0.5))).y)) + 4;
  for (const id of ids) placeAt(refs.heroPlates[id], feet(POS[id]).x + 6, plateTop, 0.5, 0);
  const bf = feet(new THREE.Vector3(BOAT.x, -0.1, BOAT.z + BOAT.w / 2));
  placeAt(refs.bossPlate, bf.x + 10, Math.min(bf.y + 8, 560 - 118), 0.5, 0);
  const bh = project(camera, new THREE.Vector3(POS.boss.x - 0.1, 3.25, POS.boss.z));
  placeAt(refs.intent, bh.x, bh.y - 8, 0.5, 1);
  const al = feet(POS.altar);
  placeAt(refs.altarTag, al.x + 6, al.y + 8, 0.5, 0);

  markReady({ fonts, renderMs, totalMs: Math.round(performance.now() - T0), renderer: renderer.getContext().getParameter(renderer.getContext().VERSION) });
}
main();
