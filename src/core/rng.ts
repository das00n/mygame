// 시드 고정 난수 (mulberry32). 상태는 정수 하나라서 전투 상태와 함께 복제된다.

export function mulberry32Next(state: number): [number, number] {
  const s = (state + 0x6d2b79f5) | 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [s, r];
}

/** 상태 객체에 rng 필드가 있으면 그대로 쓴다 */
export interface HasRng {
  rng: number;
}

export function rand(h: HasRng): number {
  const [s, r] = mulberry32Next(h.rng);
  h.rng = s;
  return r;
}

export function randInt(h: HasRng, lo: number, hi: number): number {
  return lo + Math.floor(rand(h) * (hi - lo + 1));
}

export function pick<T>(h: HasRng, arr: readonly T[]): T {
  return arr[Math.floor(rand(h) * arr.length)];
}

export function shuffle<T>(h: HasRng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand(h) * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

/** 문자열·숫자 조합에서 시드를 만든다 */
export function seedFrom(...parts: (string | number)[]): number {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= 0x7c;
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

export class Rng implements HasRng {
  rng: number;
  constructor(seed: number) {
    this.rng = seed | 0;
  }
  next(): number {
    return rand(this);
  }
  int(lo: number, hi: number): number {
    return randInt(this, lo, hi);
  }
  pick<T>(arr: readonly T[]): T {
    return pick(this, arr);
  }
  shuffle<T>(arr: T[]): T[] {
    return shuffle(this, arr);
  }
}
