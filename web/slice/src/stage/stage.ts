// PixiJS v8(WebGL) 무대 — 1막 나루의 밤. 배경 겹 4(하늘·달 / 먼 산 / 건너편 기슭 / 물) + 선창·소품, 넋등 빛, 한지 결.
// 엔진 상태는 읽기만 한다. 연출은 Step(battle.ts) 하나씩: playStep 이 맞는 순간(land)과 길이(dur)를 돌려주면
// 화면 쪽(HTML 층)이 land 에 이름판·체력을 바꾼다.

import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import 'pixi.js/unsafe-eval';
import type { CombatState } from '../../../../src/core/types.ts';
import { intentTargets } from '../../../../src/core/enemy.ts';
import { standing } from '../../../../src/core/engine.ts';
import { D, HERO_COLOR } from '../../../src/game/content.ts';
import { heroArt } from '../art/heroes.ts';
import { hanjiTile, softDisc } from '../art/paint.ts';
import {
  CANDLES, FY, LAMP, SH, SW, X0, X1, bake, darkness, mergeLayers, flameCanvas, mistCanvas, paintAltar, paintDock, paintFarBank, paintLampPole, paintLantern, paintMooredBoat,
  paintMoorings, paintMountains, paintReeds, paintRope, paintSky, paintTablet, paintTassel, paintWater, type Layer,
} from '../art/scene.ts';
import { spiritArt, soulCanvas } from '../art/spirits.ts';
import type { Battle, Ev, Step } from '../battle.ts';
import { waterFilter } from './filters.ts';
import { Fx } from './fx.ts';
import { ALTAR_X, HERO_SCALE, TIER_SCALE, enemySlots, heroXs } from './layout.ts';
import { HeroActor, tex } from './puppet.ts';
import { SpiritActor } from './spirit.ts';
import { E, Tweens } from './tween.ts';

export interface StageOpts {
  reduced: boolean;
  light: number;
}

interface ThreadSpec { x1: number; y1: number; x2: number; y2: number; color: number; kind: 'one' | 'all' | 'maybe' | 'altar' }

const hexNum = (c: string) => parseInt(c.slice(1), 16);
const mark = (n: string) => {
  try {
    performance.mark(n);
  } catch {
    /* 표시만 */
  }
};

function layerSprite(l: Layer): Sprite {
  const s = new Sprite(tex(l.canvas));
  s.position.set(l.box[0], l.box[1]);
  s.scale.set(1 / l.R);
  return s;
}

export class SliceStage {
  app!: Application;
  readonly world = new Container();
  private par: { c: Container; f: number }[] = [];
  readonly tw = new Tweens();
  readonly fx = new Fx();
  private heroes = new Map<number, HeroActor>();
  private spirits = new Map<number, SpiritActor>();
  private heroLayer = new Container();
  private spiritLayer = new Container();
  private threads = new Graphics();
  private batG = new Graphics();
  private tablets = new Container();
  private flames: Sprite[] = [];
  private mists: { s: Sprite; v: number; base: number }[] = [];
  private reeds: Sprite[] = [];
  private tassels: Sprite[] = [];
  private souls = new Map<number, Sprite>();
  private lampGlow!: Sprite;
  private groundGlow!: Sprite;
  private lantern!: Sprite;
  private moored!: Sprite;
  private water!: ReturnType<typeof waterFilter>;
  private glowTex!: Texture;
  private ringTex!: Texture;
  private shadowTex!: Texture;
  private soulTex!: Texture;
  private tabletTex = new Map<string, Texture>();
  private threadSpecs: ThreadSpec[] = [];
  private batFrom = -1;
  private batFly: { a: number; b: number; t: number; color: number } | null = null;
  private view: CombatState | null = null;
  private phase: 'player' | 'enemy' = 'player';
  private cam = { x: 0, nudge: 0 };
  private t = 0;
  reduced: boolean;
  firstFrameAt = 0;
  private ro: ResizeObserver | null = null;
  battle: Battle | null = null;

  constructor(private host: HTMLElement, o: StageOpts) {
    this.reduced = o.reduced;
    this.tw.instant = o.reduced;
    this.fx.reduced = o.reduced;
    this.light = o.light;
  }
  private light: number;

  static async create(host: HTMLElement, o: StageOpts): Promise<SliceStage> {
    const st = new SliceStage(host, o);
    await st.init();
    return st;
  }

  private async init(): Promise<void> {
    const app = new Application();
    const r = this.host.getBoundingClientRect();
    await app.init({
      width: Math.max(320, Math.round(r.width)),
      height: Math.max(120, Math.round(r.height)),
      preference: 'webgl',
      antialias: false,
      background: '#05070d',
      resolution: Math.min(2, globalThis.devicePixelRatio || 1),
      autoDensity: true,
      powerPreference: 'high-performance',
    });
    this.app = app;
    mark('slice:pixi-ready');
    app.canvas.classList.add('sl-canvas');
    app.canvas.setAttribute('aria-hidden', 'true');
    this.host.appendChild(app.canvas);
    app.stage.addChild(this.world);
    this.build();
    mark('slice:scene-built');
    this.fit();
    this.ro = new ResizeObserver(() => this.fit());
    this.ro.observe(this.host);
    app.ticker.add((tk) => this.tick(tk.deltaMS));
  }

  private fit(): void {
    const r = this.host.getBoundingClientRect();
    const w = Math.max(320, Math.round(r.width));
    const h = Math.max(120, Math.round(r.height));
    this.app.renderer.resize(w, h);
    const k = Math.min(w / SW, h / SH);
    this.world.scale.set(k);
    this.world.position.set((w - SW * k) / 2, (h - SH * k) / 2);
  }

  private addPar(c: Container, f: number, parent: Container = this.world): void {
    parent.addChild(c);
    this.par.push({ c, f });
  }

  private build(): void {
    this.glowTex = tex(softDisc(128, '#ffffff'));
    this.ringTex = tex((() => {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 32;
      const x = c.getContext('2d')!;
      x.strokeStyle = 'rgba(190,210,240,0.9)';
      x.lineWidth = 2;
      x.beginPath();
      x.ellipse(64, 16, 58, 11, 0, 0, Math.PI * 2);
      x.stroke();
      x.strokeStyle = 'rgba(190,210,240,0.4)';
      x.beginPath();
      x.ellipse(64, 16, 40, 7, 0, 0, Math.PI * 2);
      x.stroke();
      return c;
    })());
    this.shadowTex = tex(softDisc(64, '#000000'));
    this.soulTex = tex(soulCanvas());
    // 배경 겹 4 (먼 것부터) — 패럴랙스 배율: 먼 겹(하늘·달·먼 산·건너편 기슭) 0.1 · 물 0.32 · 말뚝·빈 배 0.5 · 선창·인물 1 (+ 앞 안개·갈대 1.1~1.3)
    // 정지 그림은 한 장으로 합치고 넋등 어둠 · 비네트 · 한지 결을 미리 입힌다(전체 화면 막 3장을 매 프레임 그리지 않는다)
    const dk = darkness(this.light);
    const grain = hanjiTile(256, 5);
    const farMist = { canvas: mistCanvas(1024, 160, 11, '#8e9cbc'), box: [X0, 214, X0 + 1500, 304] as [number, number, number, number], alpha: 0.55 };
    const far = bake(mergeLayers([X0, 0, X1, 300], [paintSky(), paintMountains(), farMist, paintFarBank()]), dk, grain);
    this.addPar(layerSprite(far), 0.1);
    const water = layerSprite(bake(paintWater(), dk, grain));
    this.water = waterFilter();
    water.filters = [this.water];
    this.addPar(water, 0.32);
    const moor = new Container();
    moor.addChild(layerSprite(bake(paintMoorings(), dk, grain)));
    this.moored = layerSprite(paintMooredBoat());
    this.moored.position.set(1128, 292);
    this.moored.tint = 0x8a8c98;
    moor.addChild(this.moored);
    this.addPar(moor, 0.5);
    const mistMid = new Sprite(tex(mistCanvas(1024, 200, 23)));
    mistMid.position.set(X0, 262);
    mistMid.width = 1500;
    mistMid.height = 110;
    mistMid.alpha = 0.32;
    this.addPar(mistMid, 0.6);
    this.mists.push({ s: mistMid, v: -7, base: X0 });
    // 선창 · 넋등 장대 · 굿상
    const near = new Container();
    near.addChild(layerSprite(bake(paintDock(), dk, grain)));
    near.addChild(layerSprite(paintLampPole()));
    this.groundGlow = new Sprite(this.glowTex);
    this.groundGlow.anchor.set(0.5);
    this.groundGlow.tint = 0xffb35a;
    this.groundGlow.blendMode = 'add';
    this.groundGlow.position.set(LAMP[0] + 10, FY + 2);
    this.groundGlow.width = 560;
    this.groundGlow.height = 70;
    near.addChild(this.groundGlow);
    const altar = layerSprite(paintAltar());
    altar.position.x += ALTAR_X;
    altar.position.y += FY;
    near.addChild(altar);
    for (const [cx, cy] of CANDLES) {
      const fl = new Sprite(tex(flameCanvas()));
      fl.anchor.set(0.5, 0.88);
      fl.scale.set(1 / 6);
      fl.position.set(ALTAR_X + cx, FY + cy + 2);
      fl.blendMode = 'add';
      near.addChild(fl);
      this.flames.push(fl);
    }
    this.tablets.position.set(ALTAR_X, FY - 36);
    near.addChild(this.tablets);
    near.addChild(this.fx.under);
    near.addChild(this.heroLayer);
    this.addPar(near, 1);
    // 넋등 빛이 닿지 않는 어둠 · 넋등 · 원귀(스스로 한의 빛을 낸다 → 어둠 위) · 실 · 연출 — 모두 선창과 같은 겹(배율 1)
    const front = new Container();
    this.lampGlow = new Sprite(this.glowTex);
    this.lampGlow.anchor.set(0.5);
    this.lampGlow.tint = 0xffb35a;
    this.lampGlow.blendMode = 'add';
    this.lampGlow.position.set(LAMP[0], LAMP[1]);
    this.lampGlow.width = this.lampGlow.height = 420;
    front.addChild(this.lampGlow);
    this.lantern = layerSprite(paintLantern());
    const lanternC = new Container();
    lanternC.position.set(LAMP[0], LAMP[1] - 14);
    this.lantern.position.set(-14, -2);
    lanternC.addChild(this.lantern);
    front.addChild(lanternC);
    this.lanternC = lanternC;
    front.addChild(this.spiritLayer, this.batG, this.threads, this.fx.layer);
    this.addPar(front, 1);
    // 앞 안개 · 갈대
    const mistNear = new Sprite(tex(mistCanvas(1024, 220, 37, '#aab6d0')));
    mistNear.position.set(X0, 330);
    mistNear.width = 1500;
    mistNear.height = 150;
    mistNear.alpha = 0.22;
    this.addPar(mistNear, 1.12);
    this.mists.push({ s: mistNear, v: 11, base: X0 });
    const fg = new Container();
    for (const [x, w, h, seed] of [[30, 150, 170, 801], [1250, 170, 190, 802], [1120, 90, 110, 803]] as [number, number, number, number][]) {
      const r = layerSprite(paintReeds(seed, w, h));
      r.position.set(x - w / 2, SH - h + 8);
      const c = new Container();
      c.position.set(x, SH + 8);
      r.position.set(-w / 2, -h - 4);
      c.addChild(r);
      fg.addChild(c);
      this.reeds.push(c as unknown as Sprite);
    }
    this.addPar(fg, 1.3);
    // 금줄
    const rope = new Container();
    rope.addChild(layerSprite(paintRope()));
    for (let x = 20, i = 0; x < SW; x += 64, i++) {
      const ts = layerSprite(paintTassel(840 + i));
      const c = new Container();
      c.position.set(x, 6 + Math.sin((x - X0) / 140) * 2.2);
      ts.position.set(-6, -2);
      c.addChild(ts);
      rope.addChild(c);
      this.tassels.push(c as unknown as Sprite);
    }
    this.addPar(rope, 1.02);
  }
  private lanternC!: Container;

  // ── 전투 ─────────────────────────────────────────────────────────────
  setBattle(b: Battle): void {
    this.battle = b;
    for (const a of this.heroes.values()) a.root.destroy({ children: true });
    for (const a of this.spirits.values()) a.root.destroy({ children: true });
    for (const s of this.souls.values()) s.destroy();
    this.heroes.clear();
    this.spirits.clear();
    this.souls.clear();
    this.tablets.removeChildren().forEach((c) => c.destroy());
    const s = b.s;
    const hx = heroXs(s);
    for (const h of s.heroes) {
      const a = new HeroActor(heroArt(h.id, HERO_COLOR[h.id]), this.shadowTex, h.idx);
      a.root.position.set(hx.get(h.idx) ?? 60, FY);
      a.root.scale.set(HERO_SCALE);
      this.heroLayer.addChild(a.root);
      this.heroes.set(h.idx, a);
      const soul = new Sprite(this.soulTex);
      soul.anchor.set(0.5, 1);
      soul.scale.set(0.24 / 1.2);
      soul.alpha = 0;
      soul.blendMode = 'normal';
      this.heroLayer.addChild(soul);
      this.souls.set(h.idx, soul);
    }
    this.syncSpirits(s, false);
    this.view = s;
    this.setView(s, 'player');
  }

  private syncSpirits(s: CombatState, fadeIn: boolean): void {
    const d = D();
    const slots = enemySlots(s);
    for (let ei = 0; ei < s.enemies.length; ei++) {
      const e = s.enemies[ei];
      const slot = slots.get(ei)!;
      let a = this.spirits.get(e.uid);
      if (!a) {
        if (!e.alive) continue;
        const def = d.enemies[e.def];
        const scale = TIER_SCALE[slot.tier];
        a = new SpiritActor(spiritArt(def.id, def.family, scale), e.uid, this.glowTex, this.ringTex, scale);
        a.root.position.set(slot.x, FY);
        this.spiritLayer.addChild(a.root);
        this.spirits.set(e.uid, a);
        if (fadeIn) {
          a.st.alpha = 0;
          a.st.dy = -30;
          this.tw.to(a.st, { alpha: 1, dy: 0 }, 500, E.outCubic);
        }
      } else if (Math.abs(a.root.x - slot.x) > 1) this.tw.to(a.root.position, { x: slot.x }, 300, E.inOutSine);
    }
    // 앞 원귀가 위에
    const order = [...this.spirits.values()].sort((x, y) => y.root.x - x.root.x);
    order.forEach((a, i) => this.spiritLayer.setChildIndex(a.root, i));
  }

  /** 화면 상태(이름판과 같은 순간): 진형 · 의도 실 · 굿상 · 쓰러짐 */
  setView(s: CombatState, phase: 'player' | 'enemy'): void {
    this.view = s;
    this.phase = phase;
    const hx = heroXs(s);
    for (const h of s.heroes) {
      const a = this.heroes.get(h.idx);
      if (!a) continue;
      const x = hx.get(h.idx) ?? 60;
      if (Math.abs(a.root.x - x) > 1) this.tw.to(a.root.position, { x }, 320, E.inOutSine);
      if (h.dead && a.st.alpha > 0.5) a.gone(this.tw);
      else if (h.downed && a.st.fall < 0.5) a.down(this.tw);
      else if (!h.downed && !h.dead && a.st.fall > 0.5) a.rise(this.tw);
    }
    this.syncSpirits(s, true);
    // 굿상 위 신위
    const want = s.summons.map((x) => (x.owner >= 0 && s.heroes[x.owner] ? HERO_COLOR[s.heroes[x.owner].id] : '#e2b23a'));
    while (this.tablets.children.length > want.length) this.tablets.removeChildAt(this.tablets.children.length - 1).destroy();
    want.forEach((col, i) => {
      if (i < this.tablets.children.length) return;
      let t = this.tabletTex.get(col);
      if (!t) {
        t = tex(paintTablet(col).canvas);
        this.tabletTex.set(col, t);
      }
      const sp = new Sprite(t);
      sp.anchor.set(0.5, 30 / 33);
      sp.scale.set(1 / 3);
      sp.position.set(-14 + i * 14, 0);
      sp.alpha = 0;
      this.tablets.addChild(sp);
      this.tw.to(sp, { alpha: 1 }, 300, E.outQuad);
    });
    // 의도 실
    this.threadSpecs = [];
    this.batFrom = s.prevOwners && s.prevOwners[0] >= 0 ? s.prevOwners[0] : -1;
    if (phase !== 'player' || s.outcome !== 0) return;
    const d = D();
    const slots = enemySlots(s);
    for (let ei = 0; ei < s.enemies.length; ei++) {
      const e = s.enemies[ei];
      if (!e.alive || e.intent < 0 || e.cancelNext) continue;
      const it = d.enemies[e.def].intents[e.intent];
      const x = slots.get(ei)!.x;
      if (it.target === '굿상') {
        this.threadSpecs.push({ x1: x - 20, y1: 88, x2: ALTAR_X, y2: FY - 60, color: 0xe2b23a, kind: 'altar' });
        continue;
      }
      if (['자신', '아군 원귀'].includes(it.target)) continue;
      const ts = intentTargets(s, e, it, true).map(([hi]) => hi).filter((hi) => !s.heroes[hi].dead);
      const kind: ThreadSpec['kind'] = it.target === '전체' ? 'all' : ts.length > 1 ? 'maybe' : 'one';
      for (const hi of ts) {
        const h = s.heroes[hi];
        const tx = (hx.get(hi) ?? 60) + (h.downed ? -50 : 6);
        const ty = h.downed ? FY - 40 : FY - 160;
        this.threadSpecs.push({ x1: x - 24, y1: 88, x2: tx, y2: ty, color: kind === 'all' ? 0xb9b0d2 : hexNum(HERO_COLOR[h.id]), kind });
      }
    }
  }

  // ── 연출 한 걸음 ─────────────────────────────────────────────────────
  playStep(step: Step): { land: number; dur: number } {
    const evs = step.ev;
    let land = 0;
    let dur = evs.length ? 420 : 0;
    const hx = (hi: number) => this.heroes.get(hi)?.root.x ?? 200;
    const heroTop = (hi: number) => FY - 168;
    const sp = (uid: number) => this.spirits.get(uid);
    const card = evs.find((e) => e.k === 'card') as Extract<Ev, { k: 'card' }> | undefined;
    const eact = evs.find((e) => e.k === 'eact') as Extract<Ev, { k: 'eact' }> | undefined;
    if (card) {
      const h = this.heroes.get(card.owner);
      const melee = !!this.view?.heroes[card.owner]?.melee;
      land = h ? h.act(this.tw, card.pose, melee && card.type === '공격') : 200;
      if (h && card.type === '공격' && melee) this.camNudge(18);
      this.tw.at(land, () => this.cardFx(card, h));
      dur = land + 520;
    } else if (eact) {
      const a = sp(eact.uid);
      if (a) {
        land = a.attack(this.tw, eact.kind);
        this.camNudge(-14);
        if (eact.kind === 'move') this.tw.at(land, () => this.fx.burst('water', a.root.x - 60, FY - 20, 14, { spread: 220, up: 120 }));
        if (eact.all && a.art.oar) this.tw.at(land, () => this.fx.burst('water', 420, FY - 30, 26, { spread: 600, up: 160 }));
      } else land = 150;
      dur = land + 560;
    }
    this.tw.at(land, () => {
      for (const e of evs) this.landEv(e, step, hx, heroTop, card);
    });
    return { land, dur };
  }

  private landEv(e: Ev, step: Step, hx: (hi: number) => number, heroTop: (hi: number) => number, card?: Extract<Ev, { k: 'card' }>): void {
    const fx = this.fx;
    switch (e.k) {
      case 'ehit': {
        const a = this.spirits.get(e.uid);
        if (!a) break;
        a.hit(this.tw);
        const x = a.root.x + a.st.dx;
        const top = FY - 150 * a.scale;
        if (e.hp > 0) fx.number(x + 6, top, `${e.hp}`, 0xff5a44, { size: e.hp >= 10 ? 58 : 48 });
        if (e.block > 0) fx.number(x - 30, top + 30, `막음 ${e.block}`, 0x9cc4ea, { size: 24, font: 'body' });
        fx.slash(x - 4, FY - 70 * a.scale, false);
        fx.burst('ink', x - 6, FY - 72 * a.scale, 7, { spread: 140, up: 90, size: 1.3 });
        break;
      }
      case 'estatus': {
        const a = this.spirits.get(e.uid);
        if (!a) break;
        const col = e.label === '넋흔들림' ? 0x8fb5dc : e.label === '점지' ? 0xe2573f : e.label === '명부' ? 0xebe3cc : e.label === '상흔' ? 0xc96a5a : 0xd8c8a0;
        fx.number(a.root.x + 34, FY - 112 * a.scale, `${e.label} +${e.n}`, col, { size: 22, font: 'body', stroke: 0x0a0806 });
        if (e.label === '넋흔들림') {
          fx.ring(a.root.x, FY - 64 * a.scale, 0x8fb5dc, 20, 70 * a.scale, 0.7);
          fx.ring(a.root.x, FY - 64 * a.scale, 0x8fb5dc, 10, 50 * a.scale, 0.9);
        }
        if (e.label === '점지') {
          fx.ring(a.root.x, FY - 80 * a.scale, 0xe2573f, 40, 14, 0.45, false, 'normal');
          fx.flash(a.root.x, FY - 80 * a.scale, 0xe2573f, 50, 0.35);
        }
        break;
      }
      case 'eblock': {
        const a = this.spirits.get(e.uid);
        if (a) fx.ring(a.root.x, FY - 64 * a.scale, 0x9cc4ea, 30, 60 * a.scale, 0.5);
        break;
      }
      case 'fate': {
        const a = this.spirits.get(e.uid);
        if (!a) break;
        const x = a.root.x;
        if (e.fate === 'haewon') {
          a.haewon(this.tw);
          fx.pillar(x, FY, 0xfff1cc, 360, 90 * a.scale, 2.2);
          fx.burst('petal', x, FY - 90 * a.scale, 34, { spread: 170, up: 90, life: 3 });
          fx.burst('mote', x, FY - 60 * a.scale, 18, { spread: 120, up: 60, life: 2.4 });
          fx.ring(x, FY - 70 * a.scale, 0xfff1cc, 30, 160, 1.2);
          if (!this.reduced) this.tw.at(500, () => fx.burst('petal', x, FY - 150 * a.scale, 16, { spread: 120, up: 40, life: 3 }));
        } else if (e.fate === 'cheochi') {
          a.cheochi(this.tw);
          fx.burst('ash', x, FY - 70 * a.scale, 30, { spread: 120, up: 40, life: 1.6 });
          fx.burst('smoke', x, FY - 30, 5, { spread: 60, up: 10, life: 1.4, tint: 0x5a5650 });
          fx.ring(x, FY + 2, 0x6a665e, 20, 80, 0.5, true, 'normal');
        } else a.escape(this.tw);
        break;
      }
      case 'hhit': {
        const a = this.heroes.get(e.hi);
        if (!a) break;
        a.hit(this.tw, e.hp === 0);
        const x = hx(e.hi);
        if (e.hp > 0) {
          fx.number(x + 4, heroTop(e.hi) - 4, `${e.hp}`, 0xff5a44, { size: 46 });
          fx.slash(x + 10, FY - 96, true);
        }
        if (e.block > 0) {
          fx.number(x - 26, heroTop(e.hi) + 30, `막음 ${e.block}`, 0x9cc4ea, { size: 24, font: 'body' });
          fx.ring(x + 14, FY - 80, 0x9cc4ea, 30, 66, 0.4);
        }
        break;
      }
      case 'hblock': {
        const x = hx(e.hi);
        fx.number(x - 10, heroTop(e.hi) + 10, `방어 +${e.n}`, 0x9cc4ea, { size: 24, font: 'body' });
        fx.ring(x, FY - 76, 0xe2c27a, 34, 74, 0.6);
        fx.ring(x, FY - 76, 0x9cc4ea, 20, 60, 0.8);
        break;
      }
      case 'heal':
        fx.number(hx(e.hi), heroTop(e.hi) + 6, `+${e.n}`, 0x7fd29a, { size: 34 });
        fx.burst('mote', hx(e.hi), FY - 80, 8, { tint: 0xbff0c8 });
        break;
      case 'stress':
        if (e.n > 0) fx.number(hx(e.hi) - 30, heroTop(e.hi) + 46, `귀기 +${e.n}`, 0xb9a8e8, { size: 22, font: 'body' });
        else fx.number(hx(e.hi) - 30, heroTop(e.hi) + 46, `귀기 ${e.n}`, 0xd8d0f0, { size: 20, font: 'body' });
        break;
      case 'down': {
        const a = this.heroes.get(e.hi);
        if (a) a.down(this.tw);
        fx.burst('mote', hx(e.hi) - 30, FY - 40, 10, { tint: 0xe8f0ff, life: 2 });
        break;
      }
      case 'rise': {
        const a = this.heroes.get(e.hi);
        if (a) a.rise(this.tw);
        break;
      }
      case 'dead': {
        const a = this.heroes.get(e.hi);
        if (a) a.gone(this.tw);
        break;
      }
      case 'jangdan':
        if (e.bat) this.batFly = { a: e.bat[0], b: e.bat[1], t: 0, color: hexNum(HERO_COLOR[this.view?.heroes[e.bat[0]]?.id ?? 'manshin']) };
        break;
      case 'summon':
        fx.pillar(ALTAR_X, FY - 30, 0xfff1cc, 300, 70, 1.6);
        fx.burst('mote', ALTAR_X, FY - 60, 16, { spread: 80, up: 50 });
        break;
      case 'form':
      case 'turn':
      case 'card':
      case 'eact':
        break;
    }
    void card;
    void step;
  }

  private cardFx(c: Extract<Ev, { k: 'card' }>, h: HeroActor | undefined): void {
    const fx = this.fx;
    const tip = h ? { x: h.tipWorld.x, y: h.tipWorld.y } : { x: 300, y: 200 };
    const target = c.target >= 0 ? this.spirits.get(c.target) : undefined;
    const tx = target ? target.root.x : 900;
    const ty = target ? FY - 70 * target.scale : 250;
    const hx = h ? h.root.x : 300;
    switch (c.card) {
      case 'posu.hwaseungchong':
      case 'posu.geupso':
        fx.flash(tip.x + 6, tip.y, 0xffc060, c.card === 'posu.geupso' ? 120 : 90, 0.22);
        fx.burst('spark', tip.x + 4, tip.y, 12, { spread: 160, up: 40 });
        fx.burst('smoke', tip.x + 10, tip.y, 6, { spread: 50, up: 14 });
        this.tracer(tip.x + 8, tip.y, tx - 10, ty);
        break;
      case 'posu.jojun':
        if (target) {
          fx.ring(tx, ty - 10, 0xe2573f, 70, 18, 0.5, false, 'normal');
          fx.flash(tx, ty - 10, 0xe2573f, 60, 0.3);
        }
        break;
      case 'posu.eompye':
        fx.burst('smoke', hx, FY - 40, 8, { spread: 80, up: 20, life: 1.3 });
        break;
      case 'seungnyeo.yukhwanjang':
        fx.flash(tip.x, tip.y, 0xffe2a0, 70, 0.3);
        fx.ring(tip.x, tip.y, 0xffd27a, 8, 46, 0.45);
        if (target) fx.ring(tx, ty, 0xfff0c8, 20, 90, 0.4);
        break;
      case 'seungnyeo.hapjang':
      case 'seungnyeo.gasa':
        fx.ring(hx, FY - 80, 0xe2c27a, 20, 90, 0.8);
        fx.burst('mote', hx, FY - 90, 8, { tint: 0xffe7b0 });
        break;
      case 'seungnyeo.cheondo_yeombul':
        for (let i = 0; i < 3; i++) this.tw.at(i * 120, () => fx.ring(tx, ty, 0x8fb5dc, 16, 110, 0.9));
        fx.burst('mote', 250, FY - 120, 10, { spread: 300, tint: 0xd8e4ff });
        break;
      case 'manshin.bangul':
        for (let i = 0; i < 3; i++) this.tw.at(i * 70, () => fx.ring(tip.x, tip.y, 0xffd27a, 6, 34, 0.4));
        if (target) fx.ring(tx, ty, 0xfff0c8, 14, 80, 0.5);
        break;
      case 'manshin.gongsu':
        if (target) {
          fx.flash(tx, ty - 20, 0xe2573f, 80, 0.4);
          fx.ring(tx, ty - 20, 0xe2573f, 60, 16, 0.4, false, 'normal');
        }
        break;
      case 'manshin.cheongbae':
        fx.burst('mote', tip.x, tip.y, 10, { spread: 60, up: 40 });
        break;
      case 'manshin.buchae_makgi':
        fx.ring(hx + 20, FY - 100, 0xffd27a, 20, 70, 0.6);
        break;
      default:
        if (c.card.startsWith('common.offering')) {
          fx.burst('petal', hx + 40, FY - 110, 18, { spread: 200, up: 80, tint: 0xf3e2a0, life: 2.4 });
          if (target) fx.flash(tx, ty - 40, 0xfff1cc, 140, 0.8);
        } else if (target) fx.ring(tx, ty, 0xfff0c8, 14, 70, 0.45);
        else fx.ring(hx, FY - 80, 0xe2c27a, 20, 70, 0.6);
    }
  }

  private tracerG: { g: Graphics; t: number }[] = [];
  private tracer(x1: number, y1: number, x2: number, y2: number): void {
    if (this.reduced) return;
    const g = new Graphics();
    g.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: 2.4, color: 0xfff0c0, alpha: 0.9 });
    g.blendMode = 'add';
    this.fx.layer.addChild(g);
    this.tracerG.push({ g, t: 0 });
  }

  private camNudge(n: number): void {
    if (this.reduced) return;
    this.tw.to(this.cam, { nudge: n }, 140, E.outQuad);
    this.tw.to(this.cam, { nudge: 0 }, 600, E.inOutSine, 200);
  }

  // ── 매 프레임 ─────────────────────────────────────────────────────────
  private tick(dms: number): void {
    const dt = Math.min(0.05, dms / 1000);
    this.t += dt;
    const t = this.t;
    const calm = this.reduced;
    this.tw.update(performance.now());
    // 카메라: 아주 느린 흔들림 + 행동 쏠림 → 겹마다 다른 배율로 민다(패럴랙스)
    this.cam.x = (calm ? 0 : Math.sin(t * 0.07) * 14) + this.cam.nudge;
    for (const p of this.par) p.c.x = -this.cam.x * p.f;
    this.water.tick(t, calm);
    for (const m of this.mists) m.s.x = m.base + (calm ? 0 : ((t * m.v) % 160) - 80);
    this.moored.y = 292 + (calm ? 0 : Math.sin(t * 1.2) * 1.6);
    this.moored.rotation = calm ? 0 : Math.sin(t * 0.8) * 0.012;
    for (const [i, r] of this.reeds.entries()) r.rotation = calm ? 0 : Math.sin(t * 0.9 + i) * 0.035;
    for (const [i, s] of this.tassels.entries()) s.rotation = calm ? 0 : Math.sin(t * 1.4 + i * 0.7) * 0.12;
    const fl = calm ? 1 : 0.88 + Math.sin(t * 9.3) * 0.04 + Math.sin(t * 5.1) * 0.05 + Math.sin(t * 17) * 0.02;
    this.lampGlow.alpha = 0.34 * fl;
    this.groundGlow.alpha = 0.3 * fl;
    this.lanternC.rotation = calm ? 0 : Math.sin(t * 0.9) * 0.05;
    for (const [i, f] of this.flames.entries()) {
      f.scale.set((1 / 6) * (calm ? 1 : 0.92 + Math.sin(t * 11 + i * 2) * 0.1), (1 / 6) * (calm ? 1 : 0.95 + Math.sin(t * 13 + i) * 0.12));
      f.alpha = this.tablets.children.length ? 1 : 0.65;
    }
    for (const a of this.heroes.values()) a.apply(t, calm);
    for (const a of this.spirits.values()) a.apply(t, calm);
    // 쓰러진 영웅 위의 작은 넋
    for (const [hi, soul] of this.souls) {
      const a = this.heroes.get(hi)!;
      const fall = a.st.fall;
      const dead = this.view?.heroes[hi]?.dead;
      soul.alpha = dead ? 0 : Math.max(0, (fall - 0.6) / 0.4) * 0.9;
      soul.visible = soul.alpha > 0.01;
      soul.position.set(a.root.x - 46, FY - 52 + (calm ? 0 : Math.sin(t * 1.5 + hi) * 5));
    }
    this.fx.update(dt, t);
    for (let i = this.tracerG.length - 1; i >= 0; i--) {
      const tr = this.tracerG[i];
      tr.t += dt;
      tr.g.alpha = Math.max(0, 1 - tr.t / 0.18);
      if (tr.t > 0.18) {
        tr.g.destroy();
        this.tracerG.splice(i, 1);
      }
    }
    this.drawThreads(t);
    if (!this.firstFrameAt && this.heroes.size) {
      this.firstFrameAt = performance.now();
      try {
        performance.mark('slice:first-frame');
      } catch {
        /* 표시만 */
      }
    }
  }

  private drawThreads(t: number): void {
    const g = this.threads;
    g.clear();
    const flow = this.reduced ? 0 : (t * 26) % 12;
    for (const th of this.threadSpecs) {
      const mx = (th.x1 + th.x2) / 2;
      const my = Math.min(th.y1, th.y2) - (th.kind === 'one' ? 40 : 26);
      const w = th.kind === 'one' ? 2.6 : th.kind === 'altar' ? 2.2 : 1.6;
      const alpha = th.kind === 'maybe' ? 0.5 : 0.9;
      // 아래 깔린 흐린 빛(실이 어둠 위에서도 읽히게)
      g.moveTo(th.x1, th.y1).quadraticCurveTo(mx, my, th.x2, th.y2).stroke({ width: w + 4, color: th.color, alpha: 0.14 });
      // 끊어 그은 실(흐른다)
      const N = 40;
      const pts: [number, number][] = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        pts.push([(1 - u) * (1 - u) * th.x1 + 2 * (1 - u) * u * mx + u * u * th.x2, (1 - u) * (1 - u) * th.y1 + 2 * (1 - u) * u * my + u * u * th.y2]);
      }
      let acc = -flow;
      for (let i = 0; i < N; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[i + 1];
        const L = Math.hypot(bx - ax, by - ay);
        const on = ((acc % 12) + 12) % 12 < 7;
        if (on) g.moveTo(ax, ay).lineTo(bx, by);
        acc += L;
      }
      g.stroke({ width: w, color: th.color, alpha, cap: 'round' });
      g.circle(th.x2, th.y2, th.kind === 'one' ? 4.5 : 3).fill({ color: th.color, alpha });
    }
    // 받는소리 실: 직전 주인 → 다른 서 있는 영웅 (점선), 받는소리 순간엔 굵은 실이 건너간다
    const b = this.batG;
    b.clear();
    const v = this.view;
    if (!v || this.phase !== 'player') return;
    const yy = FY - 186;
    if (this.batFrom >= 0 && v.heroes[this.batFrom] && standing(v.heroes[this.batFrom])) {
      const a = this.heroes.get(this.batFrom);
      const col = hexNum(HERO_COLOR[v.heroes[this.batFrom].id]);
      for (const hi of v.formation) {
        if (hi === this.batFrom || !standing(v.heroes[hi])) continue;
        const o = this.heroes.get(hi);
        if (!a || !o) continue;
        const x1 = a.root.x;
        const x2 = o.root.x;
        const steps = 22;
        for (let i = 0; i < steps; i += 2) {
          const u0 = i / steps;
          const u1 = (i + 1) / steps;
          const y0 = yy - Math.sin(u0 * Math.PI) * 26;
          const y1 = yy - Math.sin(u1 * Math.PI) * 26;
          b.moveTo(x1 + (x2 - x1) * u0, y0).lineTo(x1 + (x2 - x1) * u1, y1);
        }
        b.stroke({ width: 1.6, color: col, alpha: 0.6, cap: 'round' });
      }
    }
    if (this.batFly) {
      const f = this.batFly;
      f.t += 1 / 60;
      const a = this.heroes.get(f.a);
      const o = this.heroes.get(f.b);
      if (a && o && f.t < 0.7) {
        const p = Math.min(1, f.t / 0.3);
        const x1 = a.root.x;
        const x2 = o.root.x;
        const N = 24;
        b.moveTo(x1, yy);
        for (let i = 1; i <= N * p; i++) {
          const u = i / N;
          b.lineTo(x1 + (x2 - x1) * u, yy - Math.sin(u * Math.PI) * 40);
        }
        b.stroke({ width: 4.5, color: f.color, alpha: f.t > 0.4 ? 1 - (f.t - 0.4) / 0.3 : 1, cap: 'round' });
        if (p >= 1 && !this.reduced) this.fx.flash(x2, yy, f.color, 40, 0.3);
      } else this.batFly = null;
    }
  }

  /** 화면 전환(러프 보기)에서 무대를 멈춘다 */
  pause(on: boolean): void {
    if (on) this.app.ticker.stop();
    else this.app.ticker.start();
  }

  stats(): { particles: number; spirits: number; heroes: number } {
    return { particles: this.fx.count, spirits: this.spirits.size, heroes: this.heroes.size };
  }

  destroy(): void {
    this.ro?.disconnect();
    this.app.destroy(true, { children: true });
  }
}
