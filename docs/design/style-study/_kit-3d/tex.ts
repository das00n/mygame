// 3D 화풍 시안 공통 — 절차적 텍스처(잡음 · fbm · 높이 → 노멀맵). 바깥 그림 파일 없이 캔버스로 만든다.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, NoColorSpace, LinearMipmapLinearFilter } from 'three';

/** 결정적 난수(시드 고정 — 다시 렌더해도 같은 그림) */
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** 이어 붙는(tileable) 값 잡음. noise(x, y, px, py): 격자가 px × py 칸마다 되풀이된다(px, py ≤ 512) */
export function makeNoise(seed = 7) {
  const P = 512;
  const r = rng(seed);
  const tab = new Float32Array(P * P);
  for (let i = 0; i < tab.length; i++) tab[i] = r();
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number, px = P, py = P) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = smooth(x - xi);
    const fy = smooth(y - yi);
    const X0 = ((xi % px) + px) % px;
    const Y0 = ((yi % py) + py) % py;
    const X1 = (X0 + 1) % px;
    const Y1 = (Y0 + 1) % py;
    const a = tab[Y0 * P + X0];
    const b = tab[Y0 * P + X1];
    const c = tab[Y1 * P + X0];
    const d = tab[Y1 * P + X1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}
export type Noise = ReturnType<typeof makeNoise>;

/** 이어 붙는 fbm: u, v ∈ [0,1), 가로 fu · 세로 fv 칸(정수)에서 시작해 옥타브마다 2배 */
export function fbm(noise: Noise, u: number, v: number, fu: number, fv = fu, oct = 5, gain = 0.5) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let a = fu;
  let b = fv;
  for (let o = 0; o < oct; o++) {
    sum += amp * noise(u * a, v * b, a, b);
    norm += amp;
    amp *= gain;
    a *= 2;
    b *= 2;
  }
  return sum / norm;
}

export function canvas(w: number, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** 높이장(0..1, w×h) → 노멀맵 캔버스 */
export function normalFromHeight(hgt: Float32Array, w: number, h: number, strength = 2) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const at = (x: number, y: number) => hgt[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** 높이장 → 회색조 캔버스(거칠기 · 범프용) */
export function grayFromField(f: Float32Array, w: number, h: number, map: (v: number) => number = (v) => v) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const g = Math.max(0, Math.min(255, map(f[i]) * 255));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = g;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function tex(c: HTMLCanvasElement, opts: { color?: boolean; repeat?: [number, number]; aniso?: number } = {}) {
  const t = new CanvasTexture(c);
  t.colorSpace = opts.color ? SRGBColorSpace : NoColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  if (opts.repeat) t.repeat.set(...opts.repeat);
  t.minFilter = LinearMipmapLinearFilter;
  t.anisotropy = opts.aniso ?? 4;
  return t;
}
