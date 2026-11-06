// 아주 작은 트윈: 대상 객체의 숫자 필드를 시간에 따라 옮긴다. 시작값은 (지연이 끝나) 시작하는 순간에 읽는다 —
// 같은 필드에 지연을 두고 이어 붙이면 앞 트윈이 끝난 자리에서 이어진다(포즈 투 포즈).
// 움직임 줄이기: 길이와 지연을 0 으로 — 넣은 순서대로 즉시 적용되어 마지막 값(= 끝 상태)만 남는다.

export type Ease = (t: number) => number;

export const E = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => t * (2 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  /** 목인이 탁 멈춘다: 지나쳤다가 작게 되튐 */
  snap: (t: number) => {
    if (t < 0.7) return E.outCubic(t / 0.7) * 1.06;
    return 1.06 - 0.06 * E.outQuad((t - 0.7) / 0.3);
  },
} as const;

interface Tw {
  o: Record<string, number>;
  k: string;
  a: number;
  b: number;
  t0: number;
  d: number;
  e: Ease;
  done?: () => void;
}

export class Tweens {
  now = 0;
  instant = false;
  private list: Tw[] = [];
  private calls: { t: number; f: () => void }[] = [];

  to(o: object, props: Record<string, number>, d: number, e: Ease = E.outCubic, delay = 0, done?: () => void): void {
    const obj = o as Record<string, number>;
    const keys = Object.keys(props);
    if (this.instant) {
      for (const k of keys) obj[k] = props[k];
      done?.();
      return;
    }
    keys.forEach((k, i) => this.list.push({ o: obj, k, a: NaN, b: props[k], t0: this.now + delay, d: Math.max(1, d), e, done: i === keys.length - 1 ? done : undefined }));
  }

  /** 지연 뒤 한 번 부르기 */
  at(delay: number, f: () => void): void {
    if (this.instant) {
      f();
      return;
    }
    this.calls.push({ t: this.now + delay, f });
  }

  kill(o: object): void {
    this.list = this.list.filter((t) => t.o !== o);
  }

  get busy(): boolean {
    return this.list.length > 0 || this.calls.length > 0;
  }

  update(now: number): void {
    this.now = now;
    if (this.calls.length) {
      const due = this.calls.filter((c) => c.t <= now);
      if (due.length) {
        this.calls = this.calls.filter((c) => c.t > now);
        for (const c of due) c.f();
      }
    }
    if (!this.list.length) return;
    const keep: Tw[] = [];
    const finished: Tw[] = [];
    for (const t of this.list) {
      if (now < t.t0) {
        keep.push(t);
        continue;
      }
      if (Number.isNaN(t.a)) t.a = t.o[t.k];
      const p = Math.min(1, (now - t.t0) / t.d);
      t.o[t.k] = t.a + (t.b - t.a) * t.e(p);
      if (p < 1) keep.push(t);
      else finished.push(t);
    }
    this.list = keep;
    for (const t of finished) t.done?.();
  }
}
