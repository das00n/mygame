// 꼭두 영웅 리그: 부품 텍스처를 회전축으로 이어 붙인 컷아웃 인형(Spine 컷아웃과 같은 구조, 뼈대 = Container).
// 받침·다리(legs) → 윗몸(upper: body · backArm · head · frontArm · prop). 자세는 heroes.ts 의 Pose 값을 트윈으로 옮긴다(포즈 투 포즈).
// 숨쉬기·무구 흔들림만 매 프레임 덧붙인다(목인이라 2차 움직임은 작게).

import { Container, Sprite, Texture } from 'pixi.js';
import { ARM, type HeroArt, type Part, type Pose } from '../art/heroes.ts';
import { E, type Tweens } from './tween.ts';

const D2R = Math.PI / 180;
const texCache = new WeakMap<HTMLCanvasElement, Texture>();

export function tex(c: HTMLCanvasElement): Texture {
  let t = texCache.get(c);
  if (!t) {
    t = Texture.from(c);
    texCache.set(c, t);
  }
  return t;
}

/** 부품 하나: 회전축이 (0,0) 에 오도록 놓은 스프라이트 */
export function partSprite(p: Part): Sprite {
  const s = new Sprite(tex(p.canvas));
  const w = p.box[2] - p.box[0];
  const h = p.box[3] - p.box[1];
  s.anchor.set((p.pivot[0] - p.box[0]) / w, (p.pivot[1] - p.box[1]) / h);
  s.scale.set(1 / p.R);
  return s;
}

export interface PoseState extends Pose {
  bprop: number;
  dx: number;
  dy: number;
  /** 0 = 서 있음, 1 = 쓰러져 누움 */
  fall: number;
  /** 피격 붉은 빛 0~1 */
  flash: number;
  /** 넋이 빠진 회색 0~1 */
  gray: number;
  alpha: number;
}

export class HeroActor {
  readonly root = new Container();
  readonly puppet = new Container();
  readonly upper = new Container();
  private backArm = new Container();
  private frontArm = new Container();
  private head = new Container();
  private propC = new Container();
  private bpropC = new Container();
  private sprites: Sprite[] = [];
  readonly shadow: Sprite;
  readonly st: PoseState;
  private phase: number;
  /** 무구 끝(무대 좌표) — 총구 불빛·고리 울림 자리 */
  tipWorld = { x: 0, y: 0 };

  constructor(readonly art: HeroArt, shadowTex: Texture, readonly idx: number) {
    this.phase = idx * 1.7;
    const p = art.poses.idle;
    this.st = { ...p, bprop: p.bprop ?? 0, dx: 0, dy: 0, fall: 0, flash: 0, gray: 0, alpha: 1 };
    this.shadow = new Sprite(shadowTex);
    this.shadow.anchor.set(0.5);
    this.shadow.width = 70;
    this.shadow.height = 12;
    this.shadow.alpha = 0.55;
    this.root.addChild(this.shadow, this.puppet);
    const add = (parent: Container, part: Part) => {
      const s = partSprite(part);
      parent.addChild(s);
      this.sprites.push(s);
      return s;
    };
    add(this.puppet, art.legs);
    this.puppet.addChild(this.upper);
    this.upper.pivot.set(art.hip[0], art.hip[1]);
    this.upper.position.set(art.hip[0], art.hip[1]);
    // 뒷팔 (+ 뒷손 무구)
    this.backArm.position.set(art.shoulderB[0], art.shoulderB[1]);
    if (art.backProp) {
      this.bpropC.position.set(0, ARM);
      add(this.bpropC, art.backProp);
      this.backArm.addChild(this.bpropC);
    }
    add(this.backArm, art.backArm);
    this.upper.addChild(this.backArm);
    add(this.upper, art.body);
    this.head.position.set(art.neck[0], art.neck[1]);
    this.head.pivot.set(art.neck[0], art.neck[1]);
    const hs = partSprite(art.head);
    hs.position.set(art.neck[0], art.neck[1]);
    this.head.addChild(hs);
    this.sprites.push(hs);
    this.upper.addChild(this.head);
    this.frontArm.position.set(art.shoulderF[0], art.shoulderF[1]);
    add(this.frontArm, art.frontArm);
    this.propC.position.set(0, ARM);
    add(this.propC, art.prop);
    this.frontArm.addChild(this.propC);
    this.upper.addChild(this.frontArm);
  }

  /** 매 프레임: 자세 + 숨쉬기 */
  apply(t: number, calm: boolean): void {
    const s = this.st;
    const live = 1 - s.fall;
    const k = calm ? 0 : live;
    const br = Math.sin(t * 1.6 + this.phase);
    const sway = Math.sin(t * 0.9 + this.phase * 1.3);
    this.upper.rotation = (s.lean + sway * 0.8 * k) * D2R;
    this.upper.scale.set(1, 1 + br * 0.012 * k);
    this.backArm.rotation = (s.back + br * 2.2 * k) * D2R;
    this.frontArm.rotation = (s.front - br * 1.6 * k) * D2R;
    this.head.rotation = (s.head + Math.sin(t * 1.6 + this.phase + 0.6) * 1.4 * k) * D2R;
    const lean = this.upper.rotation / D2R;
    this.propC.rotation = (s.prop + sway * 1.5 * k) * D2R - this.frontArm.rotation - lean * D2R;
    this.bpropC.rotation = (s.bprop + Math.sin(t * 2.3 + this.phase) * 4 * k) * D2R - this.backArm.rotation - lean * D2R;
    // 쓰러짐: 받침째 뒤로 넘어가 눕는다(발이 축)
    this.puppet.position.set(s.dx, s.dy - 22 * s.fall);
    this.puppet.rotation = -90 * D2R * E.outQuad(s.fall);
    this.puppet.alpha = s.alpha;
    this.shadow.position.set(s.dx * 0.9 - 40 * s.fall, 2);
    this.shadow.scale.x = (70 + 50 * s.fall) / this.shadow.texture.width;
    // 색: 붉은 피격 빛 · 넋이 빠진 회색
    const fl = s.flash;
    const g = s.gray;
    const r = Math.round(255 * (1 - g * 0.42));
    const gg = Math.round(255 * (1 - fl * 0.45) * (1 - g * 0.4));
    const b = Math.round(255 * (1 - fl * 0.55) * (1 - g * 0.32));
    const tint = (r << 16) | (gg << 8) | b;
    for (const sp of this.sprites) sp.tint = tint;
    // 무구 끝: 화면 좌표(무대) — 손 위치 + 무구 방향
    const tipLocal = this.art.tip;
    const pt = this.propC.toGlobal({ x: tipLocal[0], y: tipLocal[1] });
    const parent = this.root.parent;
    if (parent) {
      const lp = parent.toLocal(pt);
      this.tipWorld.x = lp.x;
      this.tipWorld.y = lp.y;
    }
  }

  /** 자세 하나로 옮기기 (도 단위 값) */
  pose(tw: Tweens, name: string, d: number, ease = E.snap, delay = 0): void {
    const p = this.art.poses[name] ?? this.art.poses.idle;
    tw.to(this.st, { lean: p.lean, back: p.back, front: p.front, head: p.head, prop: p.prop, bprop: p.bprop ?? this.art.poses.idle.bprop ?? 0, dx: p.dx ?? 0, dy: p.dy ?? 0 }, d, ease, delay);
  }

  /** 카드 내기: 자세 이름(브리프 pose)에 따라. 반환 = 맞는 순간(ms) */
  act(tw: Tweens, pose: string, melee: boolean): number {
    const id = this.art.id;
    if (id === 'seungnyeo' && (pose === 'strike' || melee)) {
      this.pose(tw, 'windup', 150, E.outQuad);
      this.pose(tw, 'strike', 150, E.inQuad, 150);
      this.pose(tw, 'idle', 360, E.inOutSine, 520);
      return 300;
    }
    if (id === 'posu' && (pose === 'aim' || pose === 'strike')) {
      this.pose(tw, 'aim', 220, E.outCubic);
      this.pose(tw, 'recoil', 70, E.outQuad, 300);
      this.pose(tw, 'aim', 160, E.outQuad, 370);
      this.pose(tw, 'idle', 320, E.inOutSine, 640);
      return 300;
    }
    if (id === 'posu' && pose === 'retreat') {
      this.pose(tw, 'retreat', 220, E.outCubic);
      this.pose(tw, 'idle', 360, E.inOutSine, 520);
      return 200;
    }
    if (id === 'manshin' && (pose === 'strike')) {
      this.pose(tw, 'cast', 160, E.outQuad);
      this.pose(tw, 'strike', 150, E.inQuad, 160);
      this.pose(tw, 'idle', 360, E.inOutSine, 560);
      return 300;
    }
    if (pose === 'summon' && this.art.poses.summon) {
      this.pose(tw, 'summon', 260, E.outCubic);
      this.pose(tw, 'idle', 420, E.inOutSine, 760);
      return 320;
    }
    if (pose === 'guard') {
      this.pose(tw, 'guard', 200, E.snap);
      this.pose(tw, 'idle', 380, E.inOutSine, 620);
      return 180;
    }
    if (pose === 'pray' && this.art.poses.pray) {
      this.pose(tw, 'pray', 240, E.outCubic);
      this.pose(tw, 'idle', 420, E.inOutSine, 720);
      return 220;
    }
    this.pose(tw, this.art.poses.cast ? 'cast' : 'guard', 220, E.outCubic);
    this.pose(tw, 'idle', 400, E.inOutSine, 620);
    return 240;
  }

  hit(tw: Tweens, blockedOnly: boolean): void {
    if (blockedOnly) {
      this.pose(tw, 'guard', 90, E.outQuad);
      this.pose(tw, 'idle', 260, E.inOutSine, 160);
      return;
    }
    this.pose(tw, 'hit', 90, E.outQuad);
    tw.to(this.st, { flash: 1 }, 60, E.linear);
    tw.to(this.st, { flash: 0 }, 260, E.outQuad, 120);
    this.pose(tw, 'idle', 420, E.outCubic, 200);
  }

  down(tw: Tweens): void {
    this.pose(tw, 'down', 200, E.outQuad);
    tw.to(this.st, { fall: 1 }, 420, E.outQuad);
    tw.to(this.st, { gray: 1 }, 600, E.linear);
  }

  rise(tw: Tweens): void {
    tw.to(this.st, { fall: 0 }, 480, E.outBack, 250);
    tw.to(this.st, { gray: 0 }, 500, E.linear, 250);
    this.pose(tw, 'idle', 300, E.outCubic, 600);
  }

  gone(tw: Tweens): void {
    tw.to(this.st, { alpha: 0.18, gray: 1, fall: 1 }, 700, E.outQuad);
  }
}
