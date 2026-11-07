// s8 — 3D 사실풍(UE식 PBR) 시안. 물리 기반 재질 + 절차적 환경맵(PMREM) + 그림자 · 안개 + 반사하는 물(Water) +
// 후처리(블룸 · ACES 톤 매핑 · 비네트 · 필름 그레인). 인물은 그레이박스 수준이다 — 이 시안은 빛 · 분위기 · 카메라를 본다.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { ART_H, ART_W, buildUI, markReady, placeAt, project, setIntentLine, waitFonts } from '../../_kit-3d/ui';
import { canvas, fbm, grayFromField, makeNoise, normalFromHeight, rng, tex } from '../../_kit-3d/tex';
import { between, boatGeo, boatRim, box, cap, cyl, dist, lathe, pleat, profileFn, sph, torus, wrapPanel, type V3 } from '../../_kit-3d/geo';

const T0 = performance.now();
const cv = document.getElementById('gl') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(1280, 800, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const FOG = new THREE.Color('#0c121c');
scene.fog = new THREE.FogExp2(FOG, 0.042);
scene.background = FOG;

// ── 절차적 텍스처: 나무 · 짚 · 천 · 털 · 조각보 ────────────────────────
const N = makeNoise(31);
function field(w: number, h: number, f: (u: number, v: number) => number) {
  const a = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = f(x / w, y / h);
  return a;
}
function colorFrom(hf: Float32Array, w: number, h: number, dark: string, light: string, mott?: Float32Array) {
  const c = canvas(w, h);
  const g = c.getContext('2d')!;
  const img = g.createImageData(w, h);
  const A = new THREE.Color(dark);
  const B = new THREE.Color(light);
  const t = new THREE.Color();
  for (let i = 0; i < w * h; i++) {
    t.copy(A).lerp(B, Math.max(0, Math.min(1, hf[i])));
    const m = mott ? 0.82 + 0.36 * mott[i] : 1;
    img.data[i * 4] = Math.min(255, t.r * 255 * m);
    img.data[i * 4 + 1] = Math.min(255, t.g * 255 * m);
    img.data[i * 4 + 2] = Math.min(255, t.b * 255 * m);
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
interface TexSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}
function set(hf: Float32Array, w: number, h: number, dark: string, light: string, nStr: number, rough: (v: number) => number, mott?: Float32Array, rep: [number, number] = [1, 1]): TexSet {
  return {
    map: tex(colorFrom(hf, w, h, dark, light, mott), { color: true, repeat: rep }),
    normalMap: tex(normalFromHeight(hf, w, h, nStr), { repeat: rep }),
    roughnessMap: tex(grayFromField(hf, w, h, rough), { repeat: rep }),
  };
}
const S = 256;
const woodH = field(S, S, (u, v) => {
  const warp = fbm(N, u, v, 4, 2, 3);
  const lines = 0.5 + 0.5 * Math.sin((u * 14 + warp * 3) * Math.PI * 2);
  return 0.55 * Math.pow(lines, 3) + 0.45 * fbm(N, u, v, 32, 4, 4);
});
const woodM = field(S, S, (u, v) => fbm(N, u + 0.3, v, 2, 4, 3));
const WOOD = set(woodH, S, S, '#1d130c', '#5e4430', 3, (h) => 0.92 - h * 0.35, woodM);
const WOOD_DARK = set(woodH, S, S, '#120c08', '#3b2a1e', 3, (h) => 0.9 - h * 0.3, woodM);
const strawH = field(S, S, (u, v) => {
  const strand = N(u * 128, v * 3, 128, 3);
  const fine = N(u * 256, v * 6, 256, 6);
  return Math.pow(0.6 * strand + 0.4 * fine, 1.6) * (0.75 + 0.25 * fbm(N, u, v, 4, 4, 3));
});
const STRAW = set(strawH, S, S, '#2a2216', '#a48a58', 4, (h) => 0.95 - h * 0.25);
const clothH = field(S, S, (u, v) => {
  const wa = Math.abs(Math.sin(u * Math.PI * 96));
  const wb = Math.abs(Math.sin(v * Math.PI * 96));
  return 0.35 * wa + 0.35 * wb + 0.3 * fbm(N, u, v, 16, 16, 3);
});
const clothM = field(S, S, (u, v) => fbm(N, u, v, 4, 4, 4));
const CLOTH = set(clothH, S, S, '#9a9a9a', '#ffffff', 1.4, (h) => 0.98 - h * 0.12, clothM, [3, 3]);
const furH = field(S, S, (u, v) => {
  const s = N(u * 96, v * 24 + fbm(N, u, v, 4, 4, 2) * 6, 96, 24);
  return Math.pow(s, 2) * 0.8 + 0.2 * fbm(N, u, v, 32, 32, 3);
});
const FUR = set(furH, S, S, '#1a110a', '#6e5236', 5, () => 0.95, undefined, [4, 2]);
function patchworkMap() {
  const c = canvas(512);
  const g = c.getContext('2d')!;
  const R = rng(4);
  const tones = ['#4a2c18', '#5a3620', '#3e2414', '#62402a', '#523020', '#3a2010'];
  g.fillStyle = '#20120a';
  g.fillRect(0, 0, 512, 512);
  const split = (x: number, y: number, w: number, h: number, d: number) => {
    if (d > 3 || (d > 1 && R() < 0.3)) {
      g.fillStyle = tones[Math.floor(R() * tones.length)];
      g.fillRect(x + 3, y + 3, w - 6, h - 6);
      g.strokeStyle = 'rgba(20,10,4,.6)';
      g.setLineDash([5, 4]);
      g.lineWidth = 2;
      g.strokeRect(x + 9, y + 9, w - 18, h - 18);
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
  split(0, 0, 512, 512, 0);
  // 바랜 얼룩
  const img = g.getImageData(0, 0, 512, 512);
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 512; x++) {
      const m = 0.8 + 0.4 * fbm(N, x / 512, y / 512, 4, 4, 4);
      const i = (y * 512 + x) * 4;
      img.data[i] *= m;
      img.data[i + 1] *= m;
      img.data[i + 2] *= m;
    }
  g.putImageData(img, 0, 0);
  return tex(c, { color: true, repeat: [1.6, 1.2] });
}
const waterNormals = (() => {
  const W = 256;
  const h = field(W, W, (u, v) => fbm(N, u, v, 4, 4, 5, 0.55));
  return tex(normalFromHeight(h, W, W, 6));
})();

function glowTex() {
  const c = canvas(128);
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.2, 'rgba(255,255,255,0.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// ── 재질 ──────────────────────────────────────────────────────
const phys = (o: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(o);
const cloth = (color: string, o: THREE.MeshPhysicalMaterialParameters = {}) =>
  phys({ color, map: CLOTH.map, normalMap: CLOTH.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughnessMap: CLOTH.roughnessMap, roughness: 1, sheen: 0.6, sheenRoughness: 0.75, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.4), ...o });
const MAT = {
  wood: phys({ ...WOOD, roughness: 1, color: '#ffffff' }),
  woodDark: phys({ ...WOOD_DARK, roughness: 1, color: '#ffffff' }),
  straw: phys({ ...STRAW, roughness: 1, color: '#ffffff', side: THREE.DoubleSide }),
  skin: phys({ color: '#b98b6e', roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color('#ffcfb0'), sheenRoughness: 0.5 }),
  hair: phys({ color: '#0d0b0a', roughness: 0.45, sheen: 1, sheenColor: new THREE.Color('#5a5060') }),
  brass: phys({ color: '#b48a3c', metalness: 1, roughness: 0.3 }),
  iron: phys({ color: '#3a3d42', metalness: 1, roughness: 0.42 }),
  rope: phys({ ...STRAW, color: '#c8b48a', roughness: 1 }),
  fur: phys({ ...FUR, roughness: 1, color: '#ffffff', sheen: 0.8, sheenColor: new THREE.Color('#8a6a4a'), sheenRoughness: 0.9 }),
  leather: phys({ color: '#3a2416', roughness: 0.55, normalMap: CLOTH.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), clearcoat: 0.2, clearcoatRoughness: 0.6 }),
};

function mesh(g: THREE.BufferGeometry, m: THREE.Material, o: { pos?: V3; rot?: V3; scale?: V3 | number; shadow?: boolean } = {}) {
  const x = new THREE.Mesh(g, m);
  x.castShadow = o.shadow ?? true;
  x.receiveShadow = true;
  if (o.pos) x.position.set(...o.pos);
  if (o.rot) x.rotation.set(...o.rot);
  if (o.scale !== undefined) typeof o.scale === 'number' ? x.scale.setScalar(o.scale) : x.scale.set(...o.scale);
  return x;
}
const limb = (a: V3, b: V3, r: number, m: THREE.Material) => between(mesh(cap(r, Math.max(0.01, dist(a, b) - r)), m), a, b);

// ── 카메라 ──────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(32, 1280 / 800, 0.1, 400);
camera.position.set(-0.7, 3.3, 12.4);
camera.lookAt(-0.25, 0.75, 0);
camera.updateMatrixWorld();
const fromScreen = (x: number, y: number, d: number) => {
  const ndc = new THREE.Vector3((x / 1280) * 2 - 1, -(y / 800) * 2 + 1, 0.5).unproject(camera);
  return camera.position.clone().add(ndc.sub(camera.position).normalize().multiplyScalar(d));
};
const MOON = fromScreen(1188, 68, 160);
const moonDir = MOON.clone().sub(camera.position).normalize();

// ── 환경맵: 밤하늘 · 달 · 먼 불빛으로 만든 작은 장면을 PMREM 으로 ───────────
{
  const env = new THREE.Scene();
  env.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(50, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: { md: { value: moonDir } },
        vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 md; varying vec3 vD; void main(){
          vec3 c = mix(vec3(0.010,0.012,0.016), vec3(0.03,0.045,0.08), smoothstep(-0.2, 0.5, vD.y));
          c += vec3(0.5,0.6,0.8) * pow(max(dot(vD, md), 0.0), 40.0) * 0.6;
          c += vec3(0.05,0.03,0.015) * smoothstep(0.1, -0.05, abs(vD.y)) ;
          gl_FragColor = vec4(c, 1.0); }`,
      }),
    ),
  );
  const moonCard = new THREE.Mesh(new THREE.CircleGeometry(4, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 6.4, 7) }));
  moonCard.position.copy(moonDir.clone().multiplyScalar(40));
  moonCard.lookAt(0, 0, 0);
  env.add(moonCard);
  const warm = new THREE.Mesh(new THREE.PlaneGeometry(10, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.6, 0.25) }));
  warm.position.set(-30, 1, 20);
  warm.lookAt(0, 0, 0);
  env.add(warm);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, 0.03).texture;
  scene.environmentIntensity = 0.8;
  pm.dispose();
}

// ── 하늘 · 달 · 구름 ──────────────────────────────────────────────
{
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(250, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { md: { value: moonDir } },
      vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 md; varying vec3 vD;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
        void main(){
          float t = smoothstep(-0.02, 0.5, vD.y);
          vec3 c = mix(vec3(0.030,0.042,0.065), vec3(0.006,0.008,0.016), t);
          float a = max(dot(vD, md), 0.0);
          c += vec3(0.30,0.36,0.48) * pow(a, 90.0) * 0.9 + vec3(0.08,0.10,0.15) * pow(a, 12.0);
          vec3 q = floor(vD * 300.0);
          c += vec3(0.6,0.65,0.8) * step(0.9975, h(q)) * h(q+1.7) * 0.35 * smoothstep(0.08, 0.4, vD.y);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.position.copy(camera.position);
  scene.add(sky);
  // 달: 바다(어두운 무늬)가 있는 HDR 원판
  const mc = canvas(256);
  {
    const g = mc.getContext('2d')!;
    const img = g.createImageData(256, 256);
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        const dx = (x - 128) / 128;
        const dy = (y - 128) / 128;
        const r = Math.hypot(dx, dy);
        const i = (y * 256 + x) * 4;
        const n = fbm(N, x / 256, y / 256, 4, 4, 5);
        const v = (0.78 + 0.22 * Math.sqrt(Math.max(0, 1 - r * r))) * (0.82 + 0.25 * n - 0.18 * Math.max(0, fbm(N, x / 256 + 0.4, y / 256, 2, 2, 3) - 0.45) * 2);
        img.data[i] = 255 * v;
        img.data[i + 1] = 250 * v;
        img.data[i + 2] = 236 * v;
        img.data[i + 3] = r < 1 ? 255 * Math.min(1, (1 - r) * 60) : 0;
      }
    g.putImageData(img, 0, 0);
  }
  const moonTex = new THREE.CanvasTexture(mc);
  moonTex.colorSpace = THREE.SRGBColorSpace;
  const moon = new THREE.Mesh(new THREE.CircleGeometry(4.6, 64), new THREE.MeshBasicMaterial({ map: moonTex, color: new THREE.Color(1.3, 1.3, 1.26), transparent: true, fog: false }));
  moon.position.copy(MOON);
  moon.lookAt(camera.position);
  scene.add(moon);
  // 구름: fbm 알파 판, 달 앞을 살짝 가린다
  const cloudTex = (seed: number) => {
    const W = 512;
    const H = 192;
    const c = canvas(W, H);
    const g = c.getContext('2d')!;
    const img = g.createImageData(W, H);
    const nn = makeNoise(seed);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const u = x / W;
        const v = y / H;
        const edge = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
        const d = fbm(nn, u, v, 4, 2, 6) * edge * 2.2 - 0.55;
        const a = Math.max(0, Math.min(1, d * 2));
        const i = (y * W + x) * 4;
        const lit = Math.max(0, 1 - v * 1.6);
        img.data[i] = 30 + 60 * lit;
        img.data[i + 1] = 36 + 66 * lit;
        img.data[i + 2] = 52 + 80 * lit;
        img.data[i + 3] = a * 235;
      }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  for (const [x, y, w, d, seed] of [
    [1240, 96, 26, 150, 3],
    [860, 62, 40, 150, 5],
    [300, 70, 46, 150, 7],
  ] as [number, number, number, number, number][]) {
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.375), new THREE.MeshBasicMaterial({ map: cloudTex(seed), transparent: true, depthWrite: false, fog: false, toneMapped: true }));
    cl.position.copy(fromScreen(x, y, d));
    cl.lookAt(camera.position);
    scene.add(cl);
  }
}

// 먼 기슭: 어두운 능선 · 불빛(물에 비친다)
{
  const ridge = (z: number, color: string, amp: number, seed: number, base: number) => {
    const r = rng(seed);
    const s = new THREE.Shape();
    s.moveTo(-160, -3);
    const nn = makeNoise(seed);
    const off = r() * 50;
    for (let x = -160; x <= 160; x += 1.5) {
      const u = (x + 160) / 320;
      const h = fbm(nn, u + off, 0.5, 6, 1, 5, 0.55);
      s.lineTo(x, base + amp * Math.pow(h, 1.6) * 1.8);
    }
    s.lineTo(160, -3);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s, 8), new THREE.MeshBasicMaterial({ color, fog: false }));
    m.position.z = z;
    scene.add(m);
  };
  ridge(-110, '#0e1422', 3.2, 3, 0.4);
  ridge(-70, '#090d16', 1.6, 5, 0.1);
  for (const [x, y] of [
    [-16, 0.7],
    [-14.6, 0.9],
    [-6, 0.6],
    [7.5, 0.8],
    [10.5, 0.7],
    [17, 1.0],
  ]) {
    const l = new THREE.Mesh(sph(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.9, 0.7), fog: false }));
    l.position.set(x * 1.6, y, -60);
    scene.add(l);
  }
}

// ── 물: 반사(Water) ─────────────────────────────────────────────
const water = new Water(new THREE.PlaneGeometry(400, 400), {
  textureWidth: 1024,
  textureHeight: 1024,
  waterNormals,
  sunDirection: moonDir.clone(),
  sunColor: new THREE.Color('#9fb4d8'),
  waterColor: new THREE.Color('#02070c'),
  distortionScale: 1.6,
  fog: true,
  alpha: 1,
});
water.rotation.x = -Math.PI / 2;
(water.material as THREE.ShaderMaterial).uniforms.size.value = 3.2;
scene.add(water);

// ── 빛 ────────────────────────────────────────────────────────
scene.add(new THREE.HemisphereLight('#34466a', '#0a0806', 0.5));
const moonLight = new THREE.DirectionalLight('#9db8ff', 3.6);
moonLight.position.copy(moonDir.clone().multiplyScalar(30)).setY(16);
moonLight.target.position.set(-1, 0, 0);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(2048, 2048);
Object.assign(moonLight.shadow.camera, { left: -11, right: 11, top: 7, bottom: -7, near: 1, far: 70 });
moonLight.shadow.bias = -0.0005;
moonLight.shadow.normalBias = 0.02;
scene.add(moonLight, moonLight.target);
const fill = new THREE.DirectionalLight('#6a7cab', 0.55);
fill.position.set(-4, 4, 12);
scene.add(fill);

// ── 나루 ──────────────────────────────────────────────────────
const DOCK_Y = 0.62;
{
  const r = rng(11);
  for (let x = -9.4; x < -0.35; x += 0.31) {
    const pl = mesh(box(0.29, 0.07, 2.7 + r() * 0.2), r() < 0.25 ? MAT.woodDark : MAT.wood, {
      pos: [x, DOCK_Y - 0.035 + (r() - 0.5) * 0.025, (r() - 0.5) * 0.1],
      rot: [(r() - 0.5) * 0.02, (r() - 0.5) * 0.03, (r() - 0.5) * 0.03],
    });
    scene.add(pl);
  }
  for (const z of [-1.28, 1.28]) {
    scene.add(mesh(box(9.3, 0.16, 0.14), MAT.woodDark, { pos: [-4.8, DOCK_Y - 0.14, z] }));
    for (let x = -8.6; x < 0; x += 1.75) scene.add(mesh(cyl(0.08, 0.1, 1.6, 12), MAT.woodDark, { pos: [x, -0.2, z], rot: [0, 0, (r() - 0.5) * 0.06] }));
  }
  for (const z of [-1.28, 1.28]) {
    scene.add(mesh(cyl(0.1, 0.12, 2.1, 14), MAT.woodDark, { pos: [-0.38, 0.35, z] }));
    scene.add(mesh(torus(0.115, 0.022, Math.PI * 2, 8, 24), MAT.rope, { pos: [-0.38, 1.05, z], rot: [Math.PI / 2, 0, 0] }));
    scene.add(mesh(torus(0.118, 0.02, Math.PI * 2, 8, 24), MAT.rope, { pos: [-0.38, 1.0, z], rot: [Math.PI / 2 + 0.1, 0, 0] }));
  }
  // 물속 말뚝
  for (const [x, z, h] of [
    [0.9, -2.6, 1.8],
    [6.8, -3.6, 2.2],
    [8.0, -0.6, 1.5],
    [-0.2, -4.2, 1.2],
  ]) {
    scene.add(mesh(cyl(0.1, 0.13, h, 12), MAT.woodDark, { pos: [x, h / 2 - 0.3, z], rot: [(r() - 0.5) * 0.08, 0, (r() - 0.5) * 0.1] }));
  }
}

// ── 갈대 ──────────────────────────────────────────────────────
{
  const reedMat = phys({ color: '#3a3a26', roughness: 0.75, sheen: 0.3, sheenColor: new THREE.Color('#8a8a60') });
  const clusters: [number, number, number, number, number][] = [
    [-8.6, 2.5, 1.6, 1.0, 120],
    [7.6, 0.4, 1.8, 1.6, 140],
    [-6.0, -2.8, 4.0, 0.6, 90],
    [5.6, -4.6, 3.2, 0.8, 80],
    [-1.4, -2.6, 0.9, 0.5, 40],
  ];
  const total = clusters.reduce((a, c) => a + c[4], 0);
  const blade = new THREE.ConeGeometry(0.012, 1, 3);
  blade.translate(0, 0.5, 0);
  const stalks = new THREE.InstancedMesh(blade, reedMat, total);
  const heads = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.025, 0.14, 4, 6), phys({ color: '#4a3424', roughness: 0.9 }), total);
  const r = rng(77);
  const m4 = new THREE.Matrix4();
  let i = 0;
  let hi = 0;
  for (const [cx, cz, sx, sz, n] of clusters)
    for (let k = 0; k < n; k++, i++) {
      const x = cx + (r() - 0.5) * sx * 2;
      const z = cz + (r() - 0.5) * sz * 2;
      const h = 1.0 + r() * 1.5;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.25, r() * 6, (r() - 0.5) * 0.4));
      m4.compose(new THREE.Vector3(x, -0.2, z), q, new THREE.Vector3(1, h, 1));
      stalks.setMatrixAt(i, m4);
      if (r() < 0.35) {
        const top = new THREE.Vector3(0, h * 0.92, 0).applyQuaternion(q).add(new THREE.Vector3(x, -0.2, z));
        m4.compose(top, q, new THREE.Vector3(1, 1, 1));
        heads.setMatrixAt(hi++, m4);
      }
    }
  heads.count = hi;
  stalks.castShadow = heads.castShadow = true;
  stalks.receiveShadow = true;
  scene.add(stalks, heads);
}

// ── 사람 공통: 머리(그레이박스 얼굴) ─────────────────────────────────
function headMesh(o: { bald?: boolean } = {}) {
  const g = new THREE.Group();
  g.add(mesh(sph(0.105, 32, 24), MAT.skin, { scale: [0.94, 1.18, 1.0] }));
  g.add(mesh(sph(0.022, 12, 8), MAT.skin, { pos: [0, -0.01, 0.1], scale: [0.8, 1.2, 1] }));
  g.add(mesh(sph(0.06, 16, 10), MAT.skin, { pos: [0, -0.075, 0.035], scale: [1.05, 0.7, 1] }));
  for (const s of [-1, 1]) {
    g.add(mesh(sph(0.026, 12, 8), MAT.skin, { pos: [s * 0.098, -0.005, -0.005], scale: [0.45, 1, 0.8] }));
    // 눈두덩 그늘(그레이박스 수준)
    g.add(mesh(sph(0.02, 12, 8), phys({ color: '#3a2a22', roughness: 0.7 }), { pos: [s * 0.036, 0.02, 0.088], scale: [1.3, 0.6, 0.5] }));
  }
  if (o.bald) g.add(mesh(sph(0.106, 32, 20), phys({ color: '#b98b6e', roughness: 0.32, clearcoat: 0.3, clearcoatRoughness: 0.4 }), { pos: [0, 0.006, -0.004], scale: [0.95, 1.16, 1.0] }));
  return g;
}

// ── 승려 ──────────────────────────────────────────────────────
function monk() {
  const g = new THREE.Group();
  const gray = cloth('#8a8c92');
  const prof: [number, number][] = [
    [0.001, 0],
    [0.33, 0],
    [0.345, 0.04],
    [0.29, 0.5],
    [0.25, 0.9],
    [0.245, 1.18],
    [0.21, 1.36],
    [0.1, 1.45],
    [0.001, 1.47],
  ];
  g.add(mesh(pleat(lathe(prof, 64), 16, 0.03, 0.6), gray));
  const kasa = phys({ map: patchworkMap(), normalMap: CLOTH.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.92, sheen: 0.5, sheenColor: new THREE.Color('#a07050'), sheenRoughness: 0.8, side: THREE.DoubleSide });
  g.add(mesh(wrapPanel(profileFn(prof), -1.6, 1.85, 0.42, (th) => 0.96 + ((th + 1.6) / 3.45) * 0.44, 0.016, 40, 18), kasa));
  g.add(mesh(torus(0.15, 0.04, Math.PI, 10, 24), kasa, { pos: [0.12, 1.36, -0.01], rot: [0, Math.PI / 2, 0.15], scale: [1, 1, 0.5] }));
  const sleeve = (len: number, mouth: number) =>
    lathe(
      [
        [0.001, -len * 0.92],
        [mouth * 0.95, -len - 0.01],
        [mouth, -len],
        [mouth * 0.7, -len * 0.45],
        [0.07, 0],
        [0.001, 0.01],
      ],
      28,
    );
  const sl = mesh(sleeve(0.55, 0.15), gray);
  between(sl, [0.24, 1.36, 0], [0.12, 0.92, 0.32]);
  sl.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)));
  sl.position.set(0.24, 1.36, 0);
  g.add(sl);
  const sr = mesh(sleeve(0.55, 0.15), gray);
  between(sr, [-0.24, 1.36, 0], [-0.46, 0.95, 0.28]);
  sr.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)));
  sr.position.set(-0.24, 1.36, 0);
  g.add(sr);
  g.add(mesh(sph(0.045, 16, 12), MAT.skin, { pos: [0.1, 0.98, 0.36], scale: [0.8, 1.3, 0.6] }));
  g.add(mesh(sph(0.045, 16, 12), MAT.skin, { pos: [-0.5, 0.95, 0.32], scale: [1, 1.2, 0.9] }));
  g.add(mesh(cyl(0.045, 0.05, 0.12, 16), MAT.skin, { pos: [0, 1.48, 0] }));
  const h = headMesh({ bald: true });
  h.position.set(0, 1.62, 0.01);
  g.add(h);
  // 염주
  const beadMat = phys({ color: '#24140c', roughness: 0.35, clearcoat: 0.6 });
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    g.add(mesh(sph(i === 0 ? 0.03 : 0.02, 12, 8), i === 0 ? phys({ color: '#7a2a1a', roughness: 0.3, clearcoat: 0.6 }) : beadMat, { pos: [Math.sin(a) * 0.17, 1.4 - (1 - Math.cos(a)) * 0.11, Math.cos(a) * 0.15 + 0.03] }));
  }
  // 육환장
  const staff = new THREE.Group();
  staff.add(mesh(cyl(0.017, 0.02, 2.05, 10), MAT.woodDark, { pos: [0, 1.02, 0] }));
  staff.add(mesh(torus(0.095, 0.01, Math.PI * 2, 10, 48), MAT.brass, { pos: [0, 2.15, 0] }));
  staff.add(mesh(new THREE.ConeGeometry(0.025, 0.12, 12), MAT.brass, { pos: [0, 2.3, 0] }));
  staff.add(mesh(sph(0.026, 12, 8), MAT.brass, { pos: [0, 2.04, 0] }));
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const a = Math.PI / 2 + side * (0.75 + (i % 3) * 0.62);
    staff.add(mesh(torus(0.032, 0.006, Math.PI * 2, 6, 20), MAT.brass, { pos: [Math.cos(a) * 0.095, 2.15 + Math.sin(a) * 0.095 - 0.03, 0], rot: [0, Math.PI / 2, 0] }));
  }
  staff.position.set(-0.52, 0, 0.3);
  staff.rotation.set(0.05, 0, 0.04);
  g.add(staff);
  return g;
}

// ── 만신 ──────────────────────────────────────────────────────
function manshin() {
  const g = new THREE.Group();
  const red = cloth('#b0222a', { sheen: 0.8 });
  const blue = cloth('#2848a0', { sheen: 0.8 });
  const yellow = cloth('#c09020');
  g.add(
    mesh(
      pleat(
        lathe(
          [
            [0.001, 0],
            [0.36, 0],
            [0.37, 0.03],
            [0.27, 0.55],
            [0.2, 0.86],
            [0.001, 0.88],
          ],
          72,
        ),
        28,
        0.035,
        0.75,
      ),
      blue,
    ),
  );
  const robeP: [number, number][] = [
    [0.001, 0.38],
    [0.33, 0.38],
    [0.345, 0.42],
    [0.24, 0.8],
    [0.21, 1.0],
    [0.215, 1.2],
    [0.19, 1.3],
    [0.09, 1.38],
    [0.001, 1.4],
  ];
  g.add(mesh(pleat(lathe(robeP, 72), 24, 0.04, 0.82, 0.3), red));
  g.add(mesh(torus(0.215, 0.03, Math.PI * 2, 10, 40), blue, { pos: [0, 0.96, 0], rot: [Math.PI / 2, 0, 0] }));
  g.add(mesh(box(0.05, 0.42, 0.012), blue, { pos: [0.08, 0.74, 0.24], rot: [-0.18, 0, 0.06] }));
  g.add(mesh(box(0.05, 0.36, 0.012), yellow, { pos: [0.15, 0.77, 0.21], rot: [-0.18, 0, 0.16] }));
  const sleeve = (len: number, mouth: number) =>
    lathe(
      [
        [0.001, -len * 0.92],
        [mouth * 0.95, -len - 0.01],
        [mouth, -len],
        [mouth * 0.7, -len * 0.45],
        [0.065, 0],
        [0.001, 0.01],
      ],
      28,
    );
  // 왼팔 들어 부채, 오른팔 내려 방울
  const sl = mesh(sleeve(0.48, 0.15), red);
  between(sl, [0.21, 1.3, 0], [0.5, 1.62, 0.16]);
  sl.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)));
  sl.position.set(0.21, 1.3, 0);
  g.add(sl);
  const sr = mesh(sleeve(0.48, 0.15), red);
  between(sr, [-0.21, 1.3, 0], [-0.42, 0.88, 0.2]);
  sr.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)));
  sr.position.set(-0.21, 1.3, 0);
  g.add(sr);
  for (const [s, c] of [
    [sl, yellow],
    [sr, yellow],
  ] as [THREE.Mesh, THREE.Material][]) {
    s.add(mesh(torus(0.145, 0.018, Math.PI * 2, 8, 32), c, { pos: [0, -0.44, 0], rot: [Math.PI / 2, 0, 0] }));
    s.add(mesh(torus(0.14, 0.015, Math.PI * 2, 8, 32), blue, { pos: [0, -0.4, 0], rot: [Math.PI / 2, 0, 0] }));
  }
  g.add(mesh(sph(0.042, 16, 12), MAT.skin, { pos: [0.56, 1.67, 0.18], scale: [0.8, 1.3, 0.7] }));
  g.add(mesh(sph(0.042, 16, 12), MAT.skin, { pos: [-0.44, 0.84, 0.22], scale: [0.8, 1.3, 0.7] }));
  g.add(mesh(cyl(0.042, 0.046, 0.1, 16), MAT.skin, { pos: [0, 1.4, 0] }));
  const h = headMesh();
  h.position.set(0, 1.53, 0.01);
  g.add(h);
  h.add(mesh(new THREE.SphereGeometry(0.112, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), MAT.hair, { pos: [0, 0.012, -0.004], scale: [0.95, 1.18, 1.02] }));
  h.add(mesh(new THREE.SphereGeometry(0.113, 32, 16, Math.PI * 1.12, Math.PI * 0.76, 0, Math.PI * 0.75), MAT.hair, { scale: [0.95, 1.18, 1.02] }));
  h.add(mesh(sph(0.06, 20, 14), MAT.hair, { pos: [0, -0.03, -0.13] }));
  h.add(mesh(cyl(0.006, 0.006, 0.2, 8), MAT.brass, { pos: [0, -0.03, -0.14], rot: [0, 0, Math.PI / 2] }));
  h.add(mesh(box(0.035, 0.3, 0.006), cloth('#9a1a1c'), { pos: [0.02, -0.2, -0.17], rot: [0.15, 0, 0.05] }));
  // 오방색 부채(종이 + 대나무 살)
  const fan = new THREE.Group();
  const cols = ['#1f45a8', '#a8181e', '#d0a020', '#e8e2d2', '#141216'];
  cols.forEach((c, i) => fan.add(mesh(new THREE.CircleGeometry(0.26, 12, (i * Math.PI) / 5, Math.PI / 5), phys({ color: c, roughness: 0.85, side: THREE.DoubleSide, sheen: 0.3 }))));
  for (let i = 0; i <= 10; i++) {
    const a = (i * Math.PI) / 10;
    fan.add(mesh(box(0.006, 0.27, 0.006), MAT.wood, { pos: [Math.cos(a) * 0.135, Math.sin(a) * 0.135, 0.004], rot: [0, 0, a - Math.PI / 2] }));
  }
  fan.position.set(0.6, 1.72, 0.2);
  fan.rotation.set(-0.1, -0.5, -0.3);
  g.add(fan);
  // 방울
  const bell = new THREE.Group();
  bell.add(mesh(cyl(0.012, 0.012, 0.16, 8), MAT.woodDark, { pos: [0, -0.08, 0] }));
  for (const p of [
    [0, 0.03, 0],
    [0.035, 0.012, 0.02],
    [-0.035, 0.012, 0.02],
    [0.02, 0.055, -0.025],
    [-0.025, 0.06, -0.012],
    [0, 0.0, 0.035],
    [0.03, 0.05, 0.03],
  ] as V3[])
    bell.add(mesh(sph(0.022, 14, 10), MAT.brass, { pos: p }));
  cols.forEach((c, i) => bell.add(mesh(box(0.018, 0.26, 0.004), cloth(c), { pos: [-0.03 + i * 0.015, -0.29, 0.01], rot: [0.08, 0, (i - 2) * 0.06] })));
  bell.position.set(-0.45, 0.88, 0.24);
  bell.rotation.set(0, 0, 0.15);
  g.add(bell);
  return g;
}

// ── 포수 ──────────────────────────────────────────────────────
function posu() {
  const g = new THREE.Group();
  const hemp = cloth('#c0b8a6');
  const vest = cloth('#2e5a48', { sheen: 0.4 });
  for (const s of [-1, 1]) {
    g.add(limb([s * 0.1, 0.86, 0], [s * 0.12, 0.3, 0.02], 0.085, hemp));
    g.add(mesh(cyl(0.062, 0.055, 0.26, 14), cloth('#d0ccc0'), { pos: [s * 0.12, 0.17, 0.02] }));
    g.add(mesh(sph(0.065, 14, 8), MAT.straw, { pos: [s * 0.12, 0.025, 0.05], scale: [0.9, 0.4, 1.7] }));
  }
  const tprof: [number, number][] = [
    [0.001, 0.78],
    [0.23, 0.78],
    [0.25, 0.84],
    [0.235, 1.1],
    [0.22, 1.28],
    [0.1, 1.38],
    [0.001, 1.4],
  ];
  g.add(mesh(lathe(tprof, 48), hemp));
  g.add(mesh(wrapPanel(profileFn(tprof), 0.32, Math.PI * 2 - 0.32, 0.86, () => 1.3, 0.018, 48, 10), vest));
  g.add(mesh(torus(0.245, 0.025, Math.PI * 2, 10, 40), MAT.leather, { pos: [0, 0.88, 0], rot: [Math.PI / 2, 0, 0] }));
  g.add(mesh(sph(0.08, 16, 12), MAT.leather, { pos: [-0.16, 0.8, 0.22], scale: [1, 1.15, 0.65] }));
  g.add(mesh(box(0.13, 0.05, 0.08), MAT.leather, { pos: [-0.16, 0.88, 0.24], rot: [0.2, -0.4, 0] }));
  g.add(mesh(torus(0.29, 0.012, Math.PI * 2, 6, 48), MAT.leather, { pos: [0, 1.08, 0], rot: [Math.PI / 2 + 0.05, 0.7, 0], scale: [1, 0.85, 1] }));
  g.add(mesh(new THREE.ConeGeometry(0.035, 0.2, 12), phys({ color: '#c8b890', roughness: 0.4, clearcoat: 0.4 }), { pos: [0.2, 0.82, 0.18], rot: [0, 0, 2.3] }));
  // 화승총(거의 세워 든다)
  const G0: V3 = [-0.05, 0.86, 0.26];
  const GD = new THREE.Vector3(0.18, 0.9, 0.4).normalize();
  const along = (t: number): V3 => [G0[0] + GD.x * t, G0[1] + GD.y * t, G0[2] + GD.z * t];
  g.add(limb([0.22, 1.28, 0], along(0.42), 0.055, hemp));
  g.add(limb([-0.22, 1.28, 0], along(-0.02), 0.055, hemp));
  g.add(mesh(sph(0.045, 14, 10), MAT.skin, { pos: along(0.42) }));
  g.add(mesh(sph(0.045, 14, 10), MAT.skin, { pos: along(-0.02) }));
  const gun = new THREE.Group();
  gun.add(mesh(cyl(0.015, 0.018, 1.25, 12), MAT.iron, { pos: [0, 0.63, 0] }));
  gun.add(mesh(cyl(0.026, 0.026, 0.62, 10), MAT.wood, { pos: [0, 0.3, -0.01] }));
  const st = new THREE.Shape();
  st.moveTo(-0.03, 0);
  st.lineTo(0.03, 0);
  st.lineTo(0.06, -0.36);
  st.lineTo(-0.035, -0.36);
  st.closePath();
  gun.add(mesh(new THREE.ExtrudeGeometry(st, { depth: 0.045, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 }), MAT.wood, { pos: [0, 0.05, -0.022] }));
  for (const y of [0.45, 0.8, 1.1]) gun.add(mesh(cyl(0.022, 0.022, 0.025, 12), MAT.brass, { pos: [0, y, 0] }));
  gun.add(mesh(torus(0.04, 0.008, Math.PI * 2, 6, 16), MAT.rope, { pos: [0.03, 0.12, 0], rot: [0, 0, 0.3] }));
  gun.add(mesh(sph(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 2.4, 0.5) }), { pos: [0.04, 0.1, 0.03], shadow: false }));
  gun.position.set(...G0);
  gun.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), GD);
  g.add(gun);
  g.add(mesh(cyl(0.042, 0.046, 0.1, 16), MAT.skin, { pos: [0, 1.4, 0] }));
  const h = headMesh();
  h.position.set(0, 1.54, 0.01);
  g.add(h);
  h.add(mesh(sph(0.06, 16, 10), MAT.hair, { pos: [0, -0.1, 0.05], scale: [1.1, 0.6, 0.8] }));
  // 털모자
  h.add(mesh(new THREE.SphereGeometry(0.125, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), MAT.fur, { pos: [0, 0.03, 0], scale: [1, 1.15, 1] }));
  const ring = new THREE.TorusGeometry(0.12, 0.04, 14, 48);
  {
    const p = ring.getAttribute('position') as THREE.BufferAttribute;
    const nr = rng(5);
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      const c = new THREE.Vector3(v.x, v.y, 0).normalize().multiplyScalar(0.12);
      v.sub(c).multiplyScalar(1 + (nr() - 0.4) * 0.25).add(c);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    ring.computeVertexNormals();
  }
  h.add(mesh(ring, MAT.fur, { pos: [0, 0.05, 0], rot: [Math.PI / 2 + 0.1, 0, 0] }));
  for (const s of [-1, 1]) h.add(mesh(sph(0.05, 16, 12), MAT.fur, { pos: [s * 0.1, -0.04, -0.01], scale: [0.55, 1.3, 1] }));
  return g;
}

// ── 굿상 ──────────────────────────────────────────────────────
function altar() {
  const g = new THREE.Group();
  const lac = phys({ color: '#3a0e0a', roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.25, normalMap: WOOD.normalMap, normalScale: new THREE.Vector2(0.15, 0.15) });
  g.add(mesh(box(0.7, 0.05, 0.42), lac, { pos: [0, 0.42, 0] }));
  for (const [x, z] of [
    [-0.3, -0.16],
    [0.3, -0.16],
    [-0.3, 0.16],
    [0.3, 0.16],
  ])
    g.add(mesh(cyl(0.022, 0.026, 0.4, 10), lac, { pos: [x, 0.2, z] }));
  const wax = phys({ color: '#efe6d2', roughness: 0.55, transmission: 0.0, sheen: 0.4, sheenColor: new THREE.Color('#fff2d8') });
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(14, 7, 2.2) });
  for (const x of [-0.26, 0.26]) {
    g.add(mesh(cyl(0.028, 0.032, 0.2, 14), wax, { pos: [x, 0.545, -0.07] }));
    g.add(mesh(sph(0.018, 10, 8), flameMat, { pos: [x, 0.675, -0.07], scale: [0.7, 1.9, 0.7], shadow: false }));
  }
  const porcelain = phys({ color: '#e8eef0', roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 });
  g.add(
    mesh(
      lathe(
        [
          [0.001, 0],
          [0.04, 0],
          [0.07, 0.04],
          [0.085, 0.085],
          [0.08, 0.087],
          [0.001, 0.03],
        ],
        32,
      ),
      porcelain,
      { pos: [0, 0.445, 0.06] },
    ),
  );
  g.add(mesh(new THREE.CircleGeometry(0.076, 32), phys({ color: '#0a1418', roughness: 0.02, metalness: 0.2 }), { pos: [0, 0.52, 0.06], rot: [-Math.PI / 2, 0, 0] }));
  // 지화(종이꽃)
  const paper = phys({ color: '#d87a9a', roughness: 0.8, side: THREE.DoubleSide, sheen: 0.4, sheenColor: new THREE.Color('#ffd0e0') });
  const paper2 = phys({ color: '#f0d0dc', roughness: 0.8, side: THREE.DoubleSide });
  const fl = new THREE.Group();
  fl.add(mesh(cyl(0.006, 0.006, 0.25, 6), phys({ color: '#2a4020', roughness: 0.7 }), { pos: [0, 0.125, 0] }));
  for (let ring = 0; ring < 3; ring++)
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + ring * 0.35;
      fl.add(mesh(new THREE.CircleGeometry(0.035 - ring * 0.008, 10), ring === 1 ? paper2 : paper, { pos: [Math.cos(a) * (0.03 - ring * 0.009), 0.26 + ring * 0.014, Math.sin(a) * (0.03 - ring * 0.009)], rot: [-1.0 + ring * 0.35, -a + Math.PI / 2, 0] }));
    }
  fl.add(mesh(cyl(0.035, 0.03, 0.07, 14), porcelain, { pos: [0, 0.035, 0] }));
  fl.position.set(0.12, 0.445, -0.12);
  g.add(fl);
  return g;
}

// ── 보스: 삯 못 받은 뱃사공(짚 도롱이 · 삿갓 · 긴 노) ─────────────────────
function ferryman() {
  const g = new THREE.Group();
  const strawDark = phys({ ...STRAW, color: '#7a6a50', roughness: 1, side: THREE.DoubleSide });
  const tiers: [number, number, number, number, number][] = [
    // rTop, rBot, yTop, yBot, 가닥 수
    [0.3, 0.55, 0.9, 0.08, 520],
    [0.26, 0.5, 1.3, 0.55, 460],
    [0.15, 0.42, 1.7, 1.02, 420],
  ];
  const strand = new THREE.BoxGeometry(0.022, 0.42, 0.004);
  strand.translate(0, -0.21, 0);
  const total = tiers.reduce((a, t) => a + t[4], 0);
  const inst = new THREE.InstancedMesh(strand, phys({ ...STRAW, color: '#dcc494', roughness: 1, side: THREE.DoubleSide }), total);
  const r = rng(21);
  const m4 = new THREE.Matrix4();
  let k = 0;
  for (const [rT, rB, yT, yB, n] of tiers) {
    g.add(mesh(lathe([[rB * 0.92, yB + 0.05], [rT * 0.95, yT]], 40), strawDark));
    for (let i = 0; i < n; i++, k++) {
      const t = Math.pow(r(), 0.7);
      const a = r() * Math.PI * 2;
      const y = yT - (yT - yB) * t * 0.75;
      const rr = rT + (rB - rT) * ((yT - y) / (yT - yB)) + 0.01;
      const pos = new THREE.Vector3(Math.sin(a) * rr, y, Math.cos(a) * rr);
      const slope = Math.atan2(rB - rT, yT - yB);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-slope * 0.9 + (r() - 0.5) * 0.3, a, (r() - 0.5) * 0.25, 'YXZ'));
      const len = 0.7 + r() * 0.6;
      m4.compose(pos, q, new THREE.Vector3(1, len, 1));
      inst.setMatrixAt(k, m4);
    }
  }
  inst.castShadow = true;
  inst.receiveShadow = true;
  g.add(inst);
  // 유령 손 · 팔
  const ghost = phys({ color: '#8fa8b8', roughness: 0.6, emissive: new THREE.Color('#2a6a80'), emissiveIntensity: 0.6 });
  const O0 = new THREE.Vector3(0.18, 1.0, 0.24);
  const OD = new THREE.Vector3(Math.sin(0.72), Math.cos(0.72), -0.15).normalize();
  const on = (t: number): V3 => [O0.x + OD.x * t, O0.y + OD.y * t, O0.z + OD.z * t];
  g.add(limb([0.24, 1.58, 0.02], on(0.72), 0.06, strawDark));
  g.add(limb([-0.24, 1.58, 0.02], on(0.2), 0.06, strawDark));
  g.add(mesh(sph(0.05, 14, 10), ghost, { pos: on(0.72), scale: [1, 1.3, 0.8] }));
  g.add(mesh(sph(0.05, 14, 10), ghost, { pos: on(0.2), scale: [1, 1.3, 0.8] }));
  // 그늘진 얼굴 + 눈빛
  g.add(mesh(sph(0.13, 24, 16), phys({ color: '#030405', roughness: 1 }), { pos: [0, 1.85, 0.03], scale: [1, 1.15, 1] }));
  for (const s of [-1, 1]) {
    g.add(mesh(sph(0.02, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 18, 20) }), { pos: [s * 0.048, 1.84, 0.15], scale: [1.8, 0.65, 0.6], shadow: false }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(0.4, 1.6, 1.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(0.32);
    glow.position.set(s * 0.048, 1.84, 0.2);
    g.add(glow);
  }
  // 삿갓
  const hat = new THREE.Group();
  const hatMat = phys({ ...STRAW, color: '#b8a070', roughness: 1, side: THREE.DoubleSide });
  hat.add(mesh(new THREE.ConeGeometry(0.62, 0.3, 64, 1, true), hatMat));
  hat.add(mesh(torus(0.615, 0.012, Math.PI * 2, 6, 64), MAT.rope, { pos: [0, -0.15, 0], rot: [Math.PI / 2, 0, 0] }));
  hat.add(mesh(new THREE.ConeGeometry(0.05, 0.08, 12), MAT.woodDark, { pos: [0, 0.17, 0] }));
  hat.position.set(0, 2.06, -0.02);
  hat.rotation.set(0.16, 0, -0.05);
  g.add(hat);
  // 노
  const oar = new THREE.Group();
  oar.add(mesh(cyl(0.028, 0.032, 2.5, 12), MAT.wood, { pos: [0, 0.95, 0] }));
  const bl = new THREE.Shape();
  bl.moveTo(-0.05, 0);
  bl.lineTo(0.05, 0);
  bl.quadraticCurveTo(0.16, 0.4, 0.13, 0.85);
  bl.lineTo(-0.13, 0.85);
  bl.quadraticCurveTo(-0.16, 0.4, -0.05, 0);
  oar.add(mesh(new THREE.ExtrudeGeometry(bl, { depth: 0.03, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 }), MAT.wood, { pos: [0, 2.1, -0.015] }));
  oar.position.copy(O0);
  oar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), OD);
  g.add(oar);
  return g;
}

// ── 놓기 ──────────────────────────────────────────────────────
const POS = {
  posu: new THREE.Vector3(-5.05, DOCK_Y, -0.35),
  manshin: new THREE.Vector3(-3.8, DOCK_Y, -0.1),
  monk: new THREE.Vector3(-2.5, DOCK_Y, 0.15),
  altar: new THREE.Vector3(-1.2, DOCK_Y, 0.3),
  boss: new THREE.Vector3(3.55, 0.02, -2.1),
};
const BOAT = { x: 3.25, z: -2.1, len: 4.6, w: 1.3 };
const P = posu();
P.position.copy(POS.posu);
P.rotation.y = 0.75;
const Sg = manshin();
Sg.position.copy(POS.manshin);
Sg.rotation.y = 0.6;
const K = monk();
K.position.copy(POS.monk);
K.rotation.y = 0.5;
const A = altar();
A.position.copy(POS.altar);
A.rotation.y = 0.12;
const F = ferryman();
F.position.copy(POS.boss);
F.rotation.y = -0.55;
F.scale.setScalar(1.22);
scene.add(P, Sg, K, A, F);
{
  const hull = mesh(boatGeo(BOAT.len, BOAT.w, 0.5), phys({ ...WOOD, roughness: 1, color: '#9a8a7a', side: THREE.DoubleSide }), { pos: [BOAT.x, 0.14, BOAT.z], rot: [0, 0.05, 0.015] });
  for (const s of [-1, 1]) hull.add(mesh(new THREE.TubeGeometry(boatRim(BOAT.len, BOAT.w, s), 64, 0.035, 8), MAT.woodDark));
  for (const x of [-1.1, 0.1, 1.2]) hull.add(mesh(box(0.14, 0.04, BOAT.w * 0.86), MAT.woodDark, { pos: [x, -0.07, 0] }));
  scene.add(hull);
}

// 등불(파티 뒤) · 굿상 촛불 · 원귀의 찬빛
{
  const pole = new THREE.Group();
  pole.add(mesh(cyl(0.03, 0.04, 2.3, 10), MAT.woodDark, { pos: [0, 1.15, 0] }));
  pole.add(mesh(box(0.45, 0.04, 0.04), MAT.woodDark, { pos: [0.2, 2.25, 0] }));
  const lanMat = phys({ color: '#d8b080', roughness: 0.9, emissive: new THREE.Color('#ff8a3a'), emissiveIntensity: 2.2, transmission: 0.0, side: THREE.DoubleSide });
  pole.add(
    mesh(
      lathe(
        [
          [0.001, -0.17],
          [0.1, -0.16],
          [0.14, -0.04],
          [0.14, 0.07],
          [0.1, 0.17],
          [0.001, 0.18],
        ],
        32,
      ),
      lanMat,
      { pos: [0.38, 1.98, 0], shadow: false },
    ),
  );
  pole.position.set(-6.35, DOCK_Y, 0.95);
  scene.add(pole);
  const lamp = new THREE.PointLight('#ffa050', 5.5, 0, 2);
  lamp.position.set(-5.97, DOCK_Y + 1.98, 1.08);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(512, 512);
  lamp.shadow.bias = -0.002;
  scene.add(lamp);
}
const candle = new THREE.PointLight('#ffae5a', 2.2, 0, 2);
candle.position.set(POS.altar.x, DOCK_Y + 0.75, POS.altar.z + 0.05);
candle.castShadow = true;
candle.shadow.mapSize.set(512, 512);
candle.shadow.bias = -0.002;
scene.add(candle);
const ghostLight = new THREE.PointLight('#4fd8ff', 9, 0, 2);
ghostLight.position.set(POS.boss.x - 0.9, 1.7, POS.boss.z + 1.0);
scene.add(ghostLight);
// 화면 밖 왼쪽 앞의 횃불(따뜻한 주광) — 파티 복색이 읽히게
const torch = new THREE.SpotLight('#ffa860', 240, 0, 0.42, 0.7, 2);
torch.position.set(-8.2, 3.4, 6.2);
torch.target.position.set(-3.4, 1.2, 0);
torch.castShadow = true;
torch.shadow.mapSize.set(1024, 1024);
torch.shadow.bias = -0.0008;
scene.add(torch, torch.target);

// 안개 판(빛을 받는 램버트) — 부피 안개 흉내
function mistTex(seed: number) {
  const W = 512;
  const H = 128;
  const c = canvas(W, H);
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, H);
  const nn = makeNoise(seed);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      const edge = Math.pow(Math.sin(Math.PI * u), 0.6) * Math.pow(Math.sin(Math.PI * v), 1.4);
      const d = fbm(nn, u, v, 6, 2, 5) * edge;
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.max(0, Math.min(255, (d - 0.12) * 400));
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
{
  const layers: [number, number, number, number, number, number][] = [
    // x, z, y, 폭, 높이, 불투명
    [3.4, -1.1, 0.35, 9, 1.4, 0.4],
    [-1, -3.0, 0.5, 26, 2.0, 0.45],
    [0, -8, 0.8, 40, 3.0, 0.5],
    [0, -15, 1.0, 60, 4.2, 0.45],
    [0, -24, 1.2, 80, 5.0, 0.4],
    [-3, 1.9, 0.25, 16, 0.9, 0.3],
  ];
  layers.forEach(([x, z, y, w, h, op], i) => {
    const far = z < -5;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: mistTex(50 + i), color: '#8a9ab8', transparent: true, opacity: op, depthWrite: false, emissive: new THREE.Color(far ? '#26324a' : '#0c1220') }));
    m.position.set(x, y, z);
    m.renderOrder = 3;
    scene.add(m);
  });
  // 보스 발치의 넋 안개(가산)
  const gm = mistTex(91);
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.9), new THREE.MeshBasicMaterial({ map: gm, color: new THREE.Color(0.25, 0.75, 0.9), transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.set(POS.boss.x - 0.3 + i * 0.3, 0.35 + i * 0.18, POS.boss.z + 0.5 - i * 0.3);
    m.renderOrder = 4;
    scene.add(m);
  }
}

// 카드 그림 전용 소품
const props: THREE.Object3D[] = [];
scene.updateMatrixWorld(true);
{
  const p1 = new THREE.Group();
  const coin = (() => {
    const c = canvas(128);
    const g = c.getContext('2d')!;
    g.fillStyle = '#d8ccb0';
    g.beginPath();
    g.arc(64, 64, 60, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#8a7a58';
    g.lineWidth = 5;
    g.stroke();
    g.clearRect(50, 50, 28, 28);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const r = rng(9);
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    p1.add(mesh(new THREE.CircleGeometry(0.11, 20), phys({ map: coin, roughness: 0.9, side: THREE.DoubleSide, alphaTest: 0.4, emissive: new THREE.Color('#2a2418') }), { pos: [1.2 + t * 1.6, 1.2 + Math.sin(t * Math.PI) * 0.8 + r() * 0.2, 0.3 - t * 1.8], rot: [r() * 2, r() * 2, r()] }));
  }
  const p2 = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const ring = mesh(torus(0.18 + i * 0.12, 0.006, Math.PI * 2, 6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.2, 2.6), transparent: true, opacity: 0.8 - i * 0.2 }), { shadow: false });
    ring.position.copy(POS.monk).add(new THREE.Vector3(-0.55, 1.95, 0.75));
    ring.lookAt(new THREE.Vector3(-1.0, 2.4, 3.0));
    p2.add(ring);
  }
  const p3 = new THREE.Group();
  const muzzle = new THREE.Vector3(0, 1.27, 0);
  P.children.find((c) => c instanceof THREE.Group && c.children.length > 6)!.localToWorld(muzzle);
  p3.add(mesh(sph(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(16, 8, 2) }), { pos: [muzzle.x, muzzle.y, muzzle.z], scale: [2.2, 1, 1], shadow: false }));
  const smoke = phys({ color: '#8a8a90', roughness: 1, transparent: true, opacity: 0.55, depthWrite: false });
  for (let i = 0; i < 5; i++) p3.add(mesh(sph(0.08 + i * 0.03, 16, 12), smoke, { pos: [muzzle.x + 0.15 + i * 0.12, muzzle.y + 0.06 + i * 0.05, muzzle.z + 0.05], shadow: false }));
  const pl = new THREE.PointLight('#ffa040', 3, 0, 2);
  pl.position.copy(muzzle);
  p3.add(pl);
  const p4 = new THREE.Group();
  const sig = new THREE.Group();
  const gold = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 0.6) });
  sig.add(new THREE.Mesh(torus(0.2, 0.006, Math.PI * 2, 6, 48), gold));
  sig.add(new THREE.Mesh(torus(0.1, 0.005, Math.PI * 2, 6, 36), gold));
  for (let i = 0; i < 4; i++) {
    const t = new THREE.Mesh(box(0.012, 0.1, 0.004), gold);
    t.position.set(Math.cos((i * Math.PI) / 2) * 0.24, Math.sin((i * Math.PI) / 2) * 0.24, 0);
    t.rotation.z = (i * Math.PI) / 2 + Math.PI / 2;
    sig.add(t);
  }
  sig.position.copy(POS.manshin).add(new THREE.Vector3(0.95, 1.45, 0.7));
  sig.lookAt(new THREE.Vector3(-2.9, 2.0, 3.0));
  p4.add(sig);
  const p5 = new THREE.Group();
  const spirit = mesh(
    lathe([
      [0.001, 0],
      [0.16, 0.04],
      [0.12, 0.38],
      [0.07, 0.52],
      [0.001, 0.55],
    ]),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.4, 0.9), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }),
    { pos: [POS.altar.x, POS.altar.y + 0.62, POS.altar.z], shadow: false },
  );
  p5.add(spirit);
  p5.add(mesh(sph(0.09, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.6, 1.0), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }), { pos: [POS.altar.x, POS.altar.y + 1.25, POS.altar.z], shadow: false }));
  const pl5 = new THREE.PointLight('#ffe0a0', 3, 0, 2);
  pl5.position.set(POS.altar.x, POS.altar.y + 1.0, POS.altar.z + 0.2);
  p5.add(pl5);
  for (const p of [p1, p2, p3, p4, p5]) {
    p.visible = false;
    scene.add(p);
    props.push(p);
  }
}

// ── 후처리: 블룸 → ACES(OutputPass) → 비네트 · 그레인 · 색수차 ───────────────
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(1280, 800) }, seed: { value: 0.37 }, grain: { value: 0.05 }, vig: { value: 1.0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 res; uniform float seed, grain, vig; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + seed*91.7)*43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float ca = 0.0018 * dot(c, c) * 4.0;
      vec3 col = vec3(texture2D(tDiffuse, vUv + c*ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - c*ca).b);
      float l = dot(col, vec3(0.299,0.587,0.114));
      col = mix(col * vec3(0.92, 1.0, 1.06), col * vec3(1.05, 1.0, 0.94), smoothstep(0.15, 0.7, l));
      col = (col - 0.5) * 1.06 + 0.5;
      float v = smoothstep(0.92, 0.28, length(c * vec2(1.0, 1.15)));
      col *= mix(1.0 - 0.62 * vig, 1.0, v);
      float n = (h(vUv * res) + h(vUv * res + 17.0)) * 0.5 - 0.5;
      col += n * grain * (1.2 - l);
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1280, 800, { type: THREE.HalfFloatType, samples: 4 }));
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(1280, 800), 0.55, 0.55, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass(GradeShader);
composer.addPass(grade);

async function main() {
  const fonts = await waitFonts(['Nanum Myeongjo', 'Noto Sans KR']);
  const refs = buildUI(document.getElementById('ui')!);

  // 카드 그림(같은 후처리를 거친 다른 카메라)
  const shots: { from: V3; to: V3; fov: number }[] = [
    { from: [1.3, 2.0, 1.7], to: [3.2, 1.9, -1.95], fov: 44 },
    { from: [-1.6, 2.2, 2.2], to: [-2.75, 1.95, 0.35], fov: 34 },
    { from: [-4.3, 1.75, 1.7], to: [-5.1, 1.75, -0.3], fov: 34 },
    { from: [-3.0, 2.0, 2.0], to: [-3.55, 1.95, 0], fov: 38 },
    { from: [-0.75, 1.45, 1.75], to: [-1.2, 1.25, 0.3], fov: 40 },
  ];
  const artCam = new THREE.PerspectiveCamera(36, ART_W / ART_H, 0.05, 400);
  renderer.setSize(ART_W * 2, ART_H * 2, false);
  composer.setSize(ART_W * 2, ART_H * 2);
  grade.uniforms.res.value.set(ART_W * 2, ART_H * 2);
  grade.uniforms.vig.value = 0.7;
  renderPass.camera = artCam;
  shots.forEach((s, i) => {
    props.forEach((p, k) => (p.visible = k === i));
    artCam.fov = s.fov;
    artCam.position.set(...s.from);
    artCam.lookAt(...s.to);
    artCam.updateProjectionMatrix();
    artCam.updateMatrixWorld();
    composer.render();
    refs.cardArts[i].getContext('2d')!.drawImage(renderer.domElement, 0, 0);
  });
  props.forEach((p) => (p.visible = false));

  renderer.setSize(1280, 800, false);
  composer.setSize(1280, 800);
  grade.uniforms.res.value.set(1280, 800);
  grade.uniforms.vig.value = 1.0;
  renderPass.camera = camera;
  renderer.info.autoReset = false;
  renderer.info.reset();
  composer.render();
  const draw = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
  renderer.info.autoReset = true;

  // 겹 UI
  const ids = ['posu', 'manshin', 'monk'] as const;
  const feet = (v: THREE.Vector3) => project(camera, v);
  const plateTop = Math.max(...ids.map((id) => feet(POS[id].clone().add(new THREE.Vector3(0, 0, 0.45))).y)) + 2;
  for (const id of ids) placeAt(refs.heroPlates[id], feet(POS[id]).x + 4, plateTop, 0.5, 0);
  const bf = feet(new THREE.Vector3(BOAT.x, 0, BOAT.z + BOAT.w / 2));
  placeAt(refs.bossPlate, bf.x + 20, Math.min(bf.y + 6, 556 - 112), 0.5, 0);
  const bh = project(camera, new THREE.Vector3(POS.boss.x - 0.05, 2.95, POS.boss.z));
  placeAt(refs.intent, bh.x, bh.y - 10, 0.5, 1);
  const al = feet(POS.altar);
  placeAt(refs.altarTag, al.x + 4, al.y + 6, 0.5, 0);
  const from = project(camera, new THREE.Vector3(POS.boss.x - 0.45, 2.45, POS.boss.z + 0.2));
  const to = project(camera, new THREE.Vector3(POS.monk.x - 0.05, DOCK_Y + 1.9, POS.monk.z));
  setIntentLine(refs, from, to, 60);

  markReady({ fonts, draw, buildMs: Math.round(performance.now() - T0) });
}
/** 성능 잣대: 본 장면 한 프레임을 n 번 그려(1픽셀 readPixels 로 끝까지 기다림) 가운데값 ms */
(globalThis as Record<string, unknown>).__BENCH = (n = 7) => {
  const gl = renderer.getContext();
  const px = new Uint8Array(4);
  const t: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = performance.now();
    composer.render();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    t.push(performance.now() - a);
  }
  t.sort((x, y) => x - y);
  return Math.round(t[n >> 1]);
};
main();
