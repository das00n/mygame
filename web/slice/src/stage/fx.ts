// 무대 연출 조각: 입자(지화 꽃잎 · 재 · 먹방울 · 물방울 · 불티 · 연기 · 넋 빛 알), 피해 숫자, 퍼지는 고리, 먹 획, 빛기둥.
// 움직임 줄이기: 입자는 내지 않고, 숫자는 제자리에서 보였다가 사라진다(정보는 이름판과 기록에 남는다).

import { Container, Sprite, Text, Texture } from 'pixi.js';
import { ashCanvas, dropCanvas, petalCanvas } from '../art/spirits.ts';
import { brush, rgba, sheet, softDisc } from '../art/paint.ts';
import { tex } from './puppet.ts';

interface Particle {
  sp: Sprite;
  vx: number;
  vy: number;
  g: number;
  spin: number;
  life: number;
  t: number;
  a0: number;
  s0: number;
  drag: number;
  sway: number;
  grow: number;
}

interface FloatText {
  txt: Text;
  t: number;
  life: number;
  y0: number;
  rise: number;
}

interface Anim {
  sp: Sprite;
  t: number;
  life: number;
  f: (sp: Sprite, p: number) => void;
}

function ringCanvas(): HTMLCanvasElement {
  const s = sheet([-50, -50, 50, 50], 2);
  const c = s.ctx;
  c.strokeStyle = 'rgba(255,255,255,0.95)';
  c.lineWidth = 3;
  c.beginPath();
  c.arc(0, 0, 46, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.35)';
  c.lineWidth = 7;
  c.stroke();
  return s.canvas;
}

function slashCanvas(seed: number): HTMLCanvasElement {
  const s = sheet([-30, -30, 30, 30], 3);
  brush(s.ctx, [[-24, 18], [-6, 2], [10, -10], [26, -22]], { w: 6, color: '#120e0a', seed, dry: 0.7, taper: [0.2, 0.05] });
  brush(s.ctx, [[-20, 26], [0, 12], [22, -4]], { w: 3, color: '#120e0a', seed: seed + 1, dry: 0.5, alpha: 0.8 });
  return s.canvas;
}

function pillarCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0.95)');
  ctx.fillStyle = g;
  const h = ctx.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(0,0,0,1)');
  h.addColorStop(0.5, 'rgba(0,0,0,0)');
  h.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillRect(0, 0, 64, 256);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = h;
  ctx.fillRect(0, 0, 64, 256);
  return c;
}

const BASE: Record<string, number> = { petal: 1 / 4, ash: 1 / 4, ink: 1 / 5, water: 1 / 5 };

export class Fx {
  readonly layer = new Container();
  readonly under = new Container();
  private parts: Particle[] = [];
  private texts: FloatText[] = [];
  private anims: Anim[] = [];
  readonly tx: Record<string, Texture[]>;
  reduced = false;

  constructor() {
    const petal = ['#f2a6b8', '#fbf4e2', '#e2b23a', '#e2573f', '#f7d2dc'].map((c, i) => tex(petalCanvas(c, 900 + i)));
    this.tx = {
      petal,
      ash: [0, 1, 2, 3].map((i) => tex(ashCanvas(950 + i, i === 3))),
      ink: [tex(dropCanvas('#14100c'))],
      water: [tex(dropCanvas('rgba(170,205,235,0.9)'))],
      glow: [tex(softDisc(64, '#ffffff'))],
      smoke: [tex(softDisc(64, '#9a9aa2', 0, 0))],
      ring: [tex(ringCanvas())],
      slash: [tex(slashCanvas(31)), tex(slashCanvas(57))],
      pillar: [tex(pillarCanvas())],
    };
  }

  private pick(kind: string): Texture {
    const a = this.tx[kind];
    return a[Math.floor(Math.random() * a.length)];
  }

  /** 입자 n 개 */
  burst(kind: 'petal' | 'ash' | 'ink' | 'water' | 'glow' | 'smoke' | 'spark' | 'mote', x: number, y: number, n: number, o: { spread?: number; up?: number; tint?: number; size?: number; life?: number; blend?: 'add' | 'normal' } = {}): void {
    if (this.reduced) return;
    for (let i = 0; i < n; i++) {
      const texKind = kind === 'spark' || kind === 'mote' ? 'glow' : kind;
      const sp = new Sprite(this.pick(texKind));
      sp.anchor.set(0.5);
      // 꽃잎 · 재 · 방울 텍스처는 4~5배 해상도로 그렸다 → 단위 크기로 되돌린다
      const sz = (o.size ?? 1) * (BASE[texKind] ?? 1);
      let vx = (Math.random() - 0.5) * (o.spread ?? 60);
      let vy = -(o.up ?? 40) * (0.5 + Math.random());
      let g = 0;
      let life = o.life ?? 1.2;
      let s0 = sz;
      let drag = 0.6;
      let sway = 0;
      let grow = 0;
      switch (kind) {
        case 'petal':
          s0 = (0.8 + Math.random() * 0.7) * sz;
          g = -6;
          vy = -(o.up ?? 70) * (0.4 + Math.random());
          vx = (Math.random() - 0.5) * (o.spread ?? 90);
          life = (o.life ?? 2.6) * (0.7 + Math.random() * 0.5);
          sway = 18;
          drag = 0.9;
          break;
        case 'ash':
          s0 = (0.7 + Math.random() * 0.8) * sz;
          g = 50;
          vy = -(o.up ?? 30) * Math.random();
          life = (o.life ?? 1.4) * (0.7 + Math.random() * 0.5);
          sway = 8;
          break;
        case 'ink':
        case 'water':
          s0 = (0.6 + Math.random() * 0.8) * sz;
          g = 260;
          life = (o.life ?? 0.7) * (0.7 + Math.random() * 0.5);
          drag = 0.2;
          break;
        case 'smoke':
          s0 = (0.25 + Math.random() * 0.2) * sz;
          g = -14;
          grow = 0.9;
          life = (o.life ?? 1.1) * (0.8 + Math.random() * 0.5);
          sp.tint = o.tint ?? 0xb8b6b0;
          break;
        case 'spark':
          s0 = (0.08 + Math.random() * 0.08) * sz;
          g = 120;
          life = (o.life ?? 0.45) * (0.6 + Math.random() * 0.6);
          sp.tint = o.tint ?? 0xffc060;
          sp.blendMode = 'add';
          drag = 0.3;
          break;
        case 'mote':
        case 'glow':
          s0 = (0.08 + Math.random() * 0.12) * sz;
          g = -10;
          life = (o.life ?? 2) * (0.6 + Math.random() * 0.6);
          sp.tint = o.tint ?? 0xfff1cc;
          sp.blendMode = 'add';
          sway = 10;
          break;
      }
      if (o.tint !== undefined && kind !== 'smoke' && kind !== 'spark' && kind !== 'glow' && kind !== 'mote') sp.tint = o.tint;
      if (o.blend) sp.blendMode = o.blend;
      sp.position.set(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10);
      sp.scale.set(s0);
      sp.rotation = Math.random() * Math.PI * 2;
      this.layer.addChild(sp);
      this.parts.push({ sp, vx, vy, g, spin: (Math.random() - 0.5) * (kind === 'petal' ? 5 : 3), life, t: 0, a0: kind === 'smoke' ? 0.55 : 1, s0, drag, sway, grow });
    }
  }

  /** 피해·방어·회복 숫자 */
  number(x: number, y: number, text: string, color: number, o: { size?: number; stroke?: number; font?: 'brush' | 'body' } = {}): void {
    const txt = new Text({
      text,
      style: {
        fontFamily: o.font === 'body' ? 'Gowun Dodum, sans-serif' : 'Nanum Brush Script, serif',
        fontSize: o.size ?? 46,
        fill: color,
        stroke: { color: o.stroke ?? 0x120c08, width: 6, join: 'round' },
        dropShadow: { color: 0x000000, alpha: 0.5, blur: 4, distance: 2, angle: Math.PI / 2 },
      },
      resolution: 2,
    });
    txt.anchor.set(0.5);
    txt.position.set(x, y);
    this.layer.addChild(txt);
    this.texts.push({ txt, t: 0, life: this.reduced ? 1.6 : 1.15, y0: y, rise: this.reduced ? 0 : 36 });
  }

  /** 퍼지는 고리 (flat = 바닥에 눕힌 물결) */
  ring(x: number, y: number, color: number, r0: number, r1: number, life = 0.6, flat = false, blend: 'add' | 'normal' = 'add'): void {
    if (this.reduced) return;
    const sp = new Sprite(this.tx.ring[0]);
    sp.anchor.set(0.5);
    sp.tint = color;
    sp.blendMode = blend;
    sp.position.set(x, y);
    this.layer.addChild(sp);
    const base = sp.texture.width;
    this.anims.push({ sp, t: 0, life, f: (s, p) => {
      const r = r0 + (r1 - r0) * (1 - Math.pow(1 - p, 2));
      s.scale.set((r * 2) / base, ((r * 2) / base) * (flat ? 0.22 : 1));
      s.alpha = 1 - p;
    } });
  }

  /** 먹 획(맞은 자리) */
  slash(x: number, y: number, flip = false): void {
    const sp = new Sprite(this.pick('slash'));
    sp.anchor.set(0.5);
    sp.position.set(x, y);
    sp.scale.set(flip ? -0.5 : 0.5, 0.5);
    sp.rotation = (Math.random() - 0.5) * 0.6;
    this.layer.addChild(sp);
    this.anims.push({ sp, t: 0, life: this.reduced ? 0.8 : 0.55, f: (s, p) => {
      s.alpha = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
      if (!this.reduced) s.scale.x = (flip ? -1 : 1) * (0.4 + Math.min(1, p * 4) * 0.25);
    } });
  }

  /** 빛기둥(굿상 소환 · 해원) */
  pillar(x: number, y: number, color: number, h: number, w: number, life = 1.2): void {
    const sp = new Sprite(this.tx.pillar[0]);
    sp.anchor.set(0.5, 1);
    sp.tint = color;
    sp.blendMode = 'add';
    sp.position.set(x, y);
    sp.width = w;
    sp.height = h;
    this.layer.addChild(sp);
    const sx = sp.scale.x;
    this.anims.push({ sp, t: 0, life, f: (s, p) => {
      s.alpha = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8;
      s.scale.x = sx * (0.6 + 0.4 * Math.sin(Math.min(1, p * 2) * Math.PI * 0.5));
    } });
  }

  /** 잠깐 빛나는 원(총구 불빛 · 방울 울림) */
  flash(x: number, y: number, color: number, size: number, life = 0.25): void {
    const sp = new Sprite(this.tx.glow[0]);
    sp.anchor.set(0.5);
    sp.tint = color;
    sp.blendMode = 'add';
    sp.position.set(x, y);
    this.layer.addChild(sp);
    const base = sp.texture.width;
    this.anims.push({ sp, t: 0, life, f: (s, p) => {
      s.scale.set((size / base) * (0.6 + p * 0.6));
      s.alpha = 1 - p;
    } });
  }

  get count(): number {
    return this.parts.length + this.texts.length + this.anims.length;
  }

  update(dt: number, t: number): void {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t += dt;
      const q = p.t / p.life;
      if (q >= 1) {
        p.sp.destroy();
        this.parts.splice(i, 1);
        continue;
      }
      p.vy += p.g * dt;
      p.vx *= 1 - p.drag * dt;
      p.vy *= 1 - p.drag * 0.5 * dt;
      p.sp.x += (p.vx + Math.sin(t * 3 + i) * p.sway) * dt;
      p.sp.y += p.vy * dt;
      p.sp.rotation += p.spin * dt;
      if (p.grow) p.sp.scale.set(p.s0 * (1 + q * p.grow * 3));
      p.sp.alpha = p.a0 * (q < 0.1 ? q / 0.1 : 1 - Math.pow((q - 0.1) / 0.9, 2));
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const f = this.texts[i];
      f.t += dt;
      const q = f.t / f.life;
      if (q >= 1) {
        f.txt.destroy();
        this.texts.splice(i, 1);
        continue;
      }
      const pop = q < 0.12 ? 0.6 + (q / 0.12) * 0.55 : q < 0.22 ? 1.15 - ((q - 0.12) / 0.1) * 0.15 : 1;
      f.txt.scale.set(this.reduced ? 1 : pop);
      f.txt.y = f.y0 - f.rise * Math.min(1, q * 1.6);
      f.txt.alpha = q < 0.7 ? 1 : 1 - (q - 0.7) / 0.3;
    }
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t += dt;
      const q = Math.min(1, a.t / a.life);
      a.f(a.sp, q);
      if (q >= 1) {
        a.sp.destroy();
        this.anims.splice(i, 1);
      }
    }
  }
}

export { rgba };
