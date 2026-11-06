// 넋전 원귀: 한지 텍스처를 MeshPlane(격자 메시)에 입혀 꼭짓점을 움직인다 — 아래 단·날개 끝이 바람에 펄럭이고,
// 공격하면 영웅 쪽으로 몸이 쏠리며 날개가 뻗고, 맞으면 종이가 떨린다.
// 해원 = 펄럭임이 잦아들며 펴지고 하얗게 떠오른다(위 · 빛 · 길게) / 처치 = 구겨져 잿빛으로 주저앉는다(아래 · 어둠 · 짧게).

import { Container, MeshPlane, Sprite, Texture } from 'pixi.js';
import type { SpiritArt } from '../art/spirits.ts';
import { tex } from './puppet.ts';
import { E, type Tweens } from './tween.ts';

export interface SpiritState {
  dx: number;
  dy: number;
  /** 영웅 쪽으로 쏠림(단위) */
  lean: number;
  /** 날개 뻗기 0~1 */
  reach: number;
  /** 펄럭임 배율 */
  flutter: number;
  /** 피격 떨림 0~1 */
  shock: number;
  /** 구김 0~1 */
  crumple: number;
  /** 흰빛(해원) 0~1 */
  white: number;
  /** 잿빛(처치) 0~1 */
  ash: number;
  squash: number;
  alpha: number;
  aura: number;
  spread: number;
  oar: number;
  /** 날아오름(해원 뒤 천천히 떠다님) */
  drift: number;
}

const D2R = Math.PI / 180;

export class SpiritActor {
  readonly root = new Container();
  readonly body = new Container();
  readonly aura: Sprite;
  readonly halo: Sprite;
  readonly ring: Sprite;
  /** 처치 뒤 남는 재 무더기 */
  readonly pile: Sprite;
  private mesh: MeshPlane;
  private rest: Float32Array;
  private W: number;
  private H: number;
  private noise: Float32Array;
  private boat?: Sprite;
  private oar?: Sprite;
  readonly st: SpiritState = { dx: 0, dy: 0, lean: 0, reach: 0, flutter: 1, shock: 0, crumple: 0, white: 0, ash: 0, squash: 1, alpha: 1, aura: 1, spread: 1, oar: 0, drift: 0 };
  private phase: number;
  fate: 'idle' | 'haewon' | 'cheochi' | 'escape' = 'idle';

  constructor(readonly art: SpiritArt, readonly uid: number, glowTex: Texture, ringTex: Texture, readonly scale: number) {
    this.phase = uid * 2.3;
    const t = tex(art.canvas);
    this.W = t.width;
    this.H = t.height;
    this.mesh = new MeshPlane({ texture: t, verticesX: 9, verticesY: 13 });
    const buf = this.mesh.geometry.getAttribute('aPosition').buffer;
    this.rest = new Float32Array(buf.data as Float32Array);
    this.noise = new Float32Array(this.rest.length);
    for (let i = 0; i < this.noise.length; i++) this.noise[i] = Math.abs(Math.sin(i * 12.9898 + uid * 78.233) * 43758.5453) % 1;
    // 메시 자리: 텍스처 픽셀 → 단위 (상자 왼쪽 위가 텍스처 0,0)
    this.mesh.scale.set(1 / art.R);
    this.mesh.position.set(art.box[0], art.box[1]);
    this.aura = new Sprite(glowTex);
    this.aura.anchor.set(0.5);
    this.aura.tint = parseInt(art.han.slice(1), 16);
    this.aura.blendMode = 'add';
    this.aura.width = 130 * scale;
    this.aura.height = 190 * scale;
    this.aura.position.set(0, -66 * scale);
    this.halo = new Sprite(glowTex);
    this.halo.anchor.set(0.5);
    this.halo.blendMode = 'add';
    this.halo.tint = 0xfff1cc;
    this.halo.alpha = 0;
    this.halo.width = this.halo.height = 170 * scale;
    this.halo.position.set(0, -70 * scale);
    this.ring = new Sprite(ringTex);
    this.ring.anchor.set(0.5);
    this.ring.width = 96 * scale;
    this.ring.height = 14 * scale;
    this.ring.alpha = 0.55;
    this.pile = new Sprite(glowTex);
    this.pile.anchor.set(0.5);
    this.pile.tint = 0x8a857c;
    this.pile.width = 70 * scale;
    this.pile.height = 16 * scale;
    this.pile.position.set(0, -2);
    this.pile.alpha = 0;
    this.root.addChild(this.ring, this.pile, this.aura, this.halo, this.body);
    if (art.boat) {
      this.boat = new Sprite(tex(art.boat.canvas));
      const b = art.boat.box;
      this.boat.anchor.set(-b[0] / (b[2] - b[0]), -b[1] / (b[3] - b[1]));
      this.boat.scale.set(1 / art.R);
      this.root.addChildAt(this.boat, 1);
    }
    this.body.addChild(this.mesh);
    if (art.oar) {
      this.oar = new Sprite(tex(art.oar.canvas));
      const o = art.oar;
      this.oar.anchor.set(-o.box[0] / (o.box[2] - o.box[0]), -o.box[1] / (o.box[3] - o.box[1]));
      this.oar.scale.set(1 / art.R);
      this.oar.position.set(o.hand[0], o.hand[1]);
      this.body.addChild(this.oar);
    }
  }

  /** 매 프레임: 꼭짓점 움직이기 */
  apply(t: number, calm: boolean): void {
    const s = this.st;
    const buf = this.mesh.geometry.getAttribute('aPosition').buffer;
    const d = buf.data as Float32Array;
    const W = this.W;
    const H = this.H;
    const R = this.art.R;
    const amp = (calm ? 0.25 : 1) * s.flutter * this.art.flutter * 3.2 * R;
    const cx = W / 2;
    const cy = H * 0.58;
    const ph = this.phase;
    for (let i = 0; i < d.length; i += 2) {
      const x0 = this.rest[i];
      const y0 = this.rest[i + 1];
      const u = x0 / W;
      const v = y0 / H;
      const hem = Math.max(0, Math.min(1, (v - 0.45) / 0.55));
      const side = Math.abs(u - 0.5) * 2;
      const wing = Math.max(0, Math.min(1, (side - 0.5) / 0.45)) * Math.max(0, 1 - Math.abs(v - 0.48) / 0.2);
      const w = hem * hem + wing * 0.9;
      let x = x0 + Math.sin(t * 2.3 + v * 7 + u * 3 + ph) * amp * w;
      let y = y0 + Math.cos(t * 2.9 + u * 6 + ph) * amp * 0.35 * w;
      // 쏠림: 위가 더 많이(영웅 쪽 = −x)
      x -= s.lean * R * (1 - v);
      // 날개 뻗기: 왼쪽 날개 끝이 영웅 쪽으로
      if (u < 0.5) x -= s.reach * wing * 22 * R * (1 - u);
      // 피격 떨림: 종이가 가로로 출렁
      if (s.shock > 0) x += Math.sin(v * 14 - t * 40) * s.shock * 4 * R * (0.4 + hem);
      // 해원: 펴짐(가로로 조금 넓게)
      x = cx + (x - cx) * s.spread;
      // 구김: 가운데로 모이며 접힌다
      if (s.crumple > 0) {
        const n = this.noise[i] - 0.5;
        const m = this.noise[i + 1] - 0.5;
        const tx = cx + (x - cx) * 0.38 + n * 18 * R;
        const ty = cy + (y - cy) * 0.42 + m * 16 * R;
        x += (tx - x) * s.crumple;
        y += (ty - y) * s.crumple;
      }
      d[i] = x;
      d[i + 1] = y;
    }
    buf.update();
    const bob = calm ? 0 : Math.sin(t * 1.3 + ph) * 3;
    const driftBob = s.drift * Math.sin(t * 0.8 + ph) * 6;
    this.body.position.set(s.dx, s.dy + bob + driftBob);
    this.body.scale.set(1, s.squash);
    this.body.alpha = s.alpha;
    // 색: 종이 → 흰빛(해원) 또는 잿빛(처치)
    const ash = s.ash;
    const wv = Math.round(255 - ash * 112);
    const gr = Math.round(255 - ash * 116);
    const bl = Math.round(255 - ash * 124);
    this.pile.alpha = ash * s.crumple * 0.75;
    this.pile.visible = this.pile.alpha > 0.01;
    this.mesh.tint = (wv << 16) | (gr << 8) | bl;
    this.aura.alpha = s.aura * (0.5 + Math.sin(t * 1.7 + ph) * 0.12) * (1 - s.white * 0.4);
    this.aura.position.set(s.dx, -66 * this.scale + s.dy + bob);
    this.halo.alpha = s.white * 0.6;
    this.halo.visible = this.halo.alpha > 0.01;
    this.aura.visible = s.aura > 0.01;
    this.halo.position.set(s.dx, -70 * this.scale + s.dy + bob + driftBob);
    this.ring.alpha = 0.5 * s.aura * (1 - s.white);
    this.ring.scale.x = (96 * this.scale * (1 + Math.sin(t * 2 + ph) * 0.06)) / this.ring.texture.width;
    if (this.boat) {
      this.boat.position.set(s.dx * 0.6, 6 + Math.sin(t * 1.1 + ph) * 2.5);
      this.boat.rotation = Math.sin(t * 0.9 + ph) * 0.03;
      this.body.position.y += Math.sin(t * 1.1 + ph) * 2.5 - 4;
    }
    if (this.oar) this.oar.rotation = (s.oar + Math.sin(t * 1.1 + ph) * 3) * D2R;
  }

  attack(tw: Tweens, kind: string): number {
    if (this.oar && (kind === 'attack' || kind === 'attack_debuff')) {
      tw.to(this.st, { oar: -70, lean: -8 }, 200, E.outQuad);
      tw.to(this.st, { oar: 40, lean: 16, dx: -40 }, 140, E.inQuad, 220);
      tw.to(this.st, { oar: 0, lean: 0, dx: 0 }, 420, E.inOutSine, 520);
      return 330;
    }
    if (kind === 'attack' || kind === 'attack_debuff') {
      tw.to(this.st, { lean: -6, dx: 10 }, 160, E.outQuad);
      tw.to(this.st, { lean: 22, reach: 1, dx: -78 }, 150, E.inQuad, 160);
      tw.to(this.st, { lean: 0, reach: 0, dx: 0 }, 420, E.inOutSine, 420);
      return 290;
    }
    if (kind === 'move') {
      tw.to(this.st, { reach: 1, lean: 10 }, 260, E.outCubic);
      tw.to(this.st, { reach: 0, lean: 0 }, 400, E.inOutSine, 420);
      return 300;
    }
    // 강화·방어·귀기: 몸을 크게 부풀리며 한의 빛이 짙어진다
    tw.to(this.st, { aura: 1.8, flutter: 2.2, spread: 1.08 }, 260, E.outQuad);
    tw.to(this.st, { aura: 1, flutter: 1, spread: 1 }, 500, E.inOutSine, 380);
    return 260;
  }

  hit(tw: Tweens): void {
    tw.to(this.st, { shock: 1, dx: 12, lean: -10 }, 70, E.outQuad);
    tw.to(this.st, { shock: 0, dx: 0, lean: 0 }, 420, E.outCubic, 90);
  }

  haewon(tw: Tweens): void {
    this.fate = 'haewon';
    // 한의 빛깔이 빠지고(흰빛), 펄럭임이 잦아들며 펴진 채 천천히 떠오른다
    tw.to(this.st, { white: 1, flutter: 0.25, spread: 1.1, aura: 0.6 }, 420, E.outQuad);
    tw.to(this.st, { dy: -150, alpha: 0.34, drift: 1 }, 1500, E.outCubic, 300);
    tw.to(this.st, { aura: 0 }, 900, E.linear, 600);
    // 떠오른 뒤: 빛이 잦아들어 희미한 흰 종이로 머문다(해원했다는 표시)
    tw.to(this.st, { white: 0.32 }, 1400, E.inOutSine, 1900);
  }

  cheochi(tw: Tweens): void {
    this.fate = 'cheochi';
    // 짧고 무겁게: 움찔 → 구겨짐 → 잿빛 → 주저앉음
    tw.to(this.st, { shock: 1, dx: 10 }, 60, E.outQuad);
    tw.to(this.st, { crumple: 1, ash: 1, aura: 0, flutter: 0.1, shock: 0 }, 380, E.inQuad, 60);
    tw.to(this.st, { squash: 0.55, dy: 6, dx: 4 }, 260, E.inQuad, 300);
    tw.to(this.st, { alpha: 0.82 }, 200, E.linear, 450);
  }

  escape(tw: Tweens): void {
    this.fate = 'escape';
    tw.to(this.st, { dx: 160, alpha: 0, aura: 0 }, 700, E.inQuad);
  }
}
