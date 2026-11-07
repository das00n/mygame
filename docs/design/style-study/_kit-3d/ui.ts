// 3D 화풍 시안 공통 — 장면 명세(scene-spec.md)의 정보와 HTML 겹(머리띠 · 이름판 · 의도 배지 · 손패 띠).
// 생김새는 시안마다 style.css 가 정한다. 자리는 3D 좌표를 화면에 투영해서 잡는다.
import type { Camera } from 'three';
import { Vector3 } from 'three';

export const W = 1280;
export const H = 800;
export const STAGE_TOP = 44;
export const HAND_TOP = 560;

export type HeroId = 'posu' | 'manshin' | 'monk';
export type Owner = HeroId | 'party';

export const HEROES: { id: HeroId; rank: string; name: string; hp: number; max: number; gwigi: number; incoming?: number }[] = [
  { id: 'posu', rank: '후열', name: '포수', hp: 30, max: 30, gwigi: 0 },
  { id: 'manshin', rank: '중열', name: '만신', hp: 35, max: 35, gwigi: 0 },
  { id: 'monk', rank: '선두', name: '승려', hp: 45, max: 45, gwigi: 0, incoming: 12 },
];

export const BOSS = { name: '삯 못 받은 뱃사공', tag: '보스', hp: 220, max: 220, neok: 0, neokMax: 40, haewon: '노잣돈을 바친 뒤 쓰러뜨린다' };
export const INTENT = { dmg: 12, name: '노 내리치기', target: '선두 승려' };

export interface CardDef {
  cost: number;
  name: string;
  kind: '공격' | '기술';
  owner: Owner;
  ownerName: string;
  /** [[…]] = 강조 낱말 */
  text: string;
}
export const CARDS: CardDef[] = [
  { cost: 0, name: '노잣돈 바치기', kind: '기술', owner: 'party', ownerName: '파티', text: '[[지전 3]]을 뱃사공에게 바친다. [[해원]] 조건이 선다.' },
  { cost: 1, name: '육환장', kind: '공격', owner: 'monk', ownerName: '승려', text: '피해 5, [[넋흔들림 2]].' },
  { cost: 2, name: '급소 저격', kind: '공격', owner: 'posu', ownerName: '포수', text: '피해 6. [[점지]]가 있으면 두 배.' },
  { cost: 1, name: '공수', kind: '기술', owner: 'manshin', ownerName: '만신', text: '적 하나에 [[점지 2]], [[약화 1]].' },
  { cost: 1, name: '청배', kind: '기술', owner: 'manshin', ownerName: '만신', text: '[[굿상]]에 몸주 신령을 모신다.' },
];

export interface UIRefs {
  root: HTMLElement;
  heroPlates: Record<HeroId, HTMLElement>;
  bossPlate: HTMLElement;
  intent: HTMLElement;
  altarTag: HTMLElement;
  lineSvg: SVGSVGElement;
  linePath: SVGPathElement;
  cardArts: HTMLCanvasElement[];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const rich = (s: string) => esc(s).replace(/\[\[(.+?)\]\]/g, '<b class="kw">$1</b>');

/** 카드 그림 칸 크기(CSS px). 캔버스는 2배로 그린다 */
export const ART_W = 136;
export const ART_H = 78;

export function buildUI(root: HTMLElement, opts: { game?: string } = {}): UIRefs {
  const heroPlate = (h: (typeof HEROES)[number]) => `
    <div class="plate hero" data-id="${h.id}">
      <div class="pl-head"><span class="rank">${h.rank}</span><span class="nm">${h.name}</span></div>
      <div class="hp"><div class="bar"><i class="fill" style="width:${(100 * h.hp) / h.max}%"></i>${
        h.incoming ? `<i class="dmg" style="width:${(100 * h.incoming) / h.max}%"></i>` : ''
      }</div><span class="num">${h.hp}/${h.max}</span></div>
      <div class="gw">귀기 <b>${h.gwigi}</b></div>
      ${h.incoming ? `<div class="incoming">−${h.incoming}</div>` : ''}
    </div>`;
  const drums = Array.from({ length: 5 }, () => '<i class="drum"></i>').join('');
  const card = (c: CardDef, i: number) => `
    <div class="card k-${c.kind === '공격' ? 'atk' : 'skl'} o-${c.owner}" data-i="${i}">
      <div class="cost">${c.cost}</div>
      <div class="name">${c.name}</div>
      <div class="art"><canvas width="${ART_W * 2}" height="${ART_H * 2}"></canvas></div>
      <div class="type"><i class="gem"></i>${c.kind} · ${c.ownerName}</div>
      <div class="text">${rich(c.text)}</div>
    </div>`;
  root.innerHTML = `
    <svg class="intent-line" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs><marker id="arrowhead" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="ah"/></marker></defs>
      <path class="ln-under" d=""/><path class="ln" d="" marker-end="url(#arrowhead)"/>
    </svg>
    <header class="hud-top">
      <div class="game">${opts.game ?? '저승굿'}</div>
      <div class="loc"><span class="act">1막</span><span class="dot">·</span><span class="place">건너지 못한 나루</span><span class="dot">·</span><span class="kind">보스</span></div>
      <div class="turn">턴 <b>1</b></div>
    </header>
    <div class="intent">
      <div class="r1"><span class="arr">↗</span><b class="dmg">${INTENT.dmg}</b><span class="dot">·</span><span class="nm">${INTENT.name}</span></div>
      <div class="r2">→ ${INTENT.target}</div>
    </div>
    ${HEROES.map(heroPlate).join('')}
    <div class="plate boss">
      <div class="pl-head"><span class="nm">${BOSS.name}</span><span class="dot">·</span><span class="tag">${BOSS.tag}</span></div>
      <div class="hp"><div class="bar"><i class="fill" style="width:100%"></i></div><span class="num">${BOSS.hp}/${BOSS.max}</span></div>
      <div class="neok"><span class="lbl">넋</span><div class="bar"><i class="fill" style="width:0%"></i></div><span class="num">${BOSS.neok}/${BOSS.neokMax}</span></div>
      <div class="haewon"><span class="dia">◇</span> 해원 · ${BOSS.haewon}</div>
    </div>
    <div class="altar-tag"><b>굿상</b><span class="dot">·</span><span>비었다</span></div>
    <section class="hand-band">
      <div class="res">
        <div class="energy"><div class="orb"><b>3</b><span>/3</span></div><div class="lbl">에너지</div></div>
        <div class="jangdan"><div class="lbl">장단 <b>0</b>/5</div><div class="drums">${drums}</div></div>
        <div class="piles"><span class="pile">뽑을 <b>7</b></span><span class="pile">버린 <b>0</b></span></div>
      </div>
      <div class="cards">${CARDS.map(card).join('')}</div>
      <button class="end-turn" type="button"><span>턴 종료</span></button>
    </section>`;
  const q = <T extends Element>(s: string) => root.querySelector(s) as unknown as T;
  return {
    root,
    heroPlates: { posu: q('.plate[data-id=posu]'), manshin: q('.plate[data-id=manshin]'), monk: q('.plate[data-id=monk]') },
    bossPlate: q('.plate.boss'),
    intent: q('.intent'),
    altarTag: q('.altar-tag'),
    lineSvg: q('svg.intent-line'),
    linePath: q('svg.intent-line path.ln'),
    cardArts: [...root.querySelectorAll('.card .art canvas')] as HTMLCanvasElement[],
  };
}

/** 3D 점 → 화면 px(캔버스가 창 전체 1280×800 을 덮는다고 본다) */
export function project(camera: Camera, p: Vector3 | [number, number, number]) {
  const v = Array.isArray(p) ? new Vector3(...p) : p.clone();
  v.project(camera);
  return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H };
}

/** el 의 (ax, ay) 비율 지점을 (x, y) 에 둔다 */
export function placeAt(el: HTMLElement, x: number, y: number, ax = 0.5, ay = 0) {
  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
  el.style.transform = `translate(${-ax * 100}%, ${-ay * 100}%)`;
}

/** 보스 → 승려 머리 곡선(2D 겹) */
export function setIntentLine(refs: UIRefs, from: { x: number; y: number }, to: { x: number; y: number }, lift = 70) {
  const cx = (from.x + to.x) / 2;
  const cy = Math.min(from.y, to.y) - lift;
  const d = `M${from.x.toFixed(1)},${from.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${to.x.toFixed(1)},${to.y.toFixed(1)}`;
  refs.linePath.setAttribute('d', d);
  (refs.lineSvg.querySelector('path.ln-under') as SVGPathElement).setAttribute('d', d);
}

/** 글꼴이 실제로 받아졌는지 확인한다(__INFO 에 싣는다) */
export async function waitFonts(families: string[]) {
  await Promise.all(families.map((f) => document.fonts.load(`20px "${f}"`, '가나다')));
  await document.fonts.ready;
  const res: Record<string, boolean> = {};
  for (const f of families) res[f] = document.fonts.check(`20px "${f}"`, '가') && [...document.fonts].some((ff) => ff.family.replace(/"/g, '') === f && ff.status === 'loaded');
  return res;
}

export function markReady(info: Record<string, unknown>) {
  (globalThis as Record<string, unknown>).__INFO = info;
  (globalThis as Record<string, unknown>).__READY = true;
}
