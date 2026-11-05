// 공용 화면 조각: 상태·의도 표식(SVG), 부적 카드, 넋등 막대, 장단 북, 카드 문장의 낱말 풀이.

import type { CSSProperties } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren, JSX } from 'preact';
import type { CardDef, CardInst, HeroId } from '../../../src/core/types.ts';
import { D, HERO_COLOR, bandOf } from '../game/content.ts';
import { splitTerms, termsIn } from '../game/glossary.ts';
import { CardArt } from '../art/CardArt.tsx';

// ── 표식 ─────────────────────────────────────────────────────────────
const PATHS: Record<string, JSX.Element> = {
  block: <path d="M8 1.5 13.5 3.5v4.2c0 3.2-2.3 5.6-5.5 6.8C4.8 13.3 2.5 10.9 2.5 7.7V3.5z" fill="currentColor" fill-opacity=".25" stroke="currentColor" stroke-width="1.4" />,
  mark: <g fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="5" /><path d="M8 1v4M8 11v4M1 8h4M11 8h4" /></g>,
  bleed: <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 13 13 3" /><path d="M6 13l7-7" stroke-opacity=".55" /></g>,
  doom: <g fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="2" width="10" height="12" /><path d="M5.5 5h5M5.5 8h5M5.5 11h3" /></g>,
  shake: <path d="M1.5 8c1.5-3 3-3 4.3 0s2.8 3 4.3 0 3-3 4.4 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />,
  vuln: <g fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2 13 8 8 14 3 8z" /><path d="M8 4.5 7 8l2 1-1 3" /></g>,
  weak: <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 2v10M4 8l4 4 4-4" /></g>,
  collapse: <path d="M2 4l3 3-2 2 4 4 1-4 3 2 3-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />,
  bound: <g fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="6" cy="8" rx="4" ry="3" /><ellipse cx="10" cy="8" rx="4" ry="3" /></g>,
  possess: <g fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.5 8C3.5 4.5 12.5 4.5 14.5 8 12.5 11.5 3.5 11.5 1.5 8z" /><circle cx="8" cy="8" r="1.8" fill="currentColor" /></g>,
  atk: <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M2.5 13.5 11 5" /><path d="M9 3h4v4" /></g>,
  multi: <g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1.5 12 8 5.5M6 3.5h4v4" /><path d="M6 14.5 12.5 8M10.5 6h4v4" stroke-opacity=".7" /></g>,
  aoe: <g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 14V3M8 14 3 5M8 14l5-9" /></g>,
  def: <path d="M8 1.5 13.5 3.5v4.2c0 3.2-2.3 5.6-5.5 6.8C4.8 13.3 2.5 10.9 2.5 7.7V3.5z" fill="none" stroke="currentColor" stroke-width="1.5" />,
  buff: <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 14V4M4 8l4-4 4 4" /><path d="M3 14h10" /></g>,
  debuff: <g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 12 9 5M7 3h4v4" /><path d="M13 9v5M11 12l2 2 2-2" /></g>,
  stress: <path d="M8 2c3.3 0 5 2 5 4.5S11 11 8.5 11 5 9.5 5.5 7.5 8.5 5.5 9.5 7.5 8 10.5 6 10M8 11v3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />,
  pollute: <g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2 5c2-2 3 2 5 0s3 2 5 0M2 9c2-2 3 2 5 0s3 2 5 0M2 13c2-2 3 2 5 0" /></g>,
  summon: <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="8" cy="8" r="5.5" stroke-dasharray="2 2" /><path d="M8 5v6M5 8h6" /></g>,
  escape: <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 8h10M9 4.5 12.5 8 9 11.5" /><path d="M14 3v10" stroke-opacity=".6" /></g>,
  move: <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M14 8H4M7 4.5 3.5 8 7 11.5" /><circle cx="14" cy="8" r="1" fill="currentColor" /></g>,
  cancel: <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 3l10 10M13 3 3 13" /></g>,
  altar: <g fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 7h12M3.5 7v6M12.5 7v6" /><path d="M5 7c0-2 1.3-3 3-3s3 1 3 3" /></g>,
  heal: <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 3v10M3 8h10" /></g>,
  lamp: <g fill="none" stroke="currentColor" stroke-width="1.3"><path d="M5 5h6l-1 8H6z" /><path d="M8 2v3M6 13h4" /><circle cx="8" cy="9" r="1.4" fill="currentColor" /></g>,
};

export function iconPath(name: string): JSX.Element {
  return PATHS[name] ?? PATHS.atk;
}

export function Icon({ name, size = 14, title }: { name: string; size?: number; title?: string }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      {PATHS[name] ?? PATHS.atk}
    </svg>
  );
}

export function St({ k, n, label, title }: { k: string; n?: number | string; label?: string; title?: string }) {
  return (
    <span class={`st ${k}`} title={title ?? label}>
      <Icon name={k} />
      {label && <span>{label}</span>}
      {n !== undefined && <b>{n}</b>}
    </span>
  );
}

// ── 낱말 풀이가 붙은 문장 ─────────────────────────────────────────────
export function KwText({ text }: { text: string }) {
  return (
    <>
      {splitTerms(text).map((p, i) => (p.term ? <span key={i} class="kw" title={`${p.term.term}: ${p.term.text}`}>{p.text}</span> : p.text))}
    </>
  );
}

export function TermList({ text }: { text: string }) {
  const terms = termsIn(text);
  if (!terms.length) return null;
  return (
    <div class="terms">
      {terms.map((t) => (
        <div key={t.term}><b>{t.term}</b> {t.text}</div>
      ))}
    </div>
  );
}

// ── 부적 카드 ────────────────────────────────────────────────────────
export function ownerColors(def: CardDef, inst: CardInst | null, party: HeroId[]): [string, string | null] {
  if (def.ownerKind === 'duo') return [HERO_COLOR[def.heroes[0]], HERO_COLOR[def.heroes[1]]];
  if (inst && inst.o >= 0 && party[inst.o]) return [HERO_COLOR[party[inst.o]], null];
  if (def.heroes[0]) return [HERO_COLOR[def.heroes[0]], null];
  return ['#6b6355', null];
}

export function ownerName(def: CardDef, inst: CardInst | null, party: HeroId[]): string {
  const d = D();
  if (def.ownerKind === 'duo') return def.heroes.map((h) => d.heroes.get(h)!.name).join('·');
  if (inst && inst.o >= 0 && party[inst.o]) return d.heroes.get(party[inst.o])!.name;
  if (def.heroes[0]) return d.heroes.get(def.heroes[0])!.name;
  return '파티';
}

const STROKE = 'M14 2c-6 4 6 6 0 11s5 8-1 13 6 8 0 13 4 7 1 12';

export interface CardProps {
  def: CardDef;
  inst?: CardInst | null;
  party: HeroId[];
  dis?: boolean;
  sel?: boolean;
  resp?: boolean;
  big?: boolean;
  pickable?: boolean;
  costOverride?: number;
  onClick?: () => void;
  testid?: string;
  note?: ComponentChildren;
}

export function CardView({ def, inst = null, party, dis, sel, resp, big, pickable, onClick, testid, note }: CardProps) {
  const d = D();
  const [c1, c2] = ownerColors(def, inst, party);
  let text = def.text;
  let name = def.name;
  let cls = '';
  if (inst && def.idx === d.special.rescue && inst.orig >= 0) {
    name = '넋 부르기';
    text = `쓰러진 ${ownerName(def, inst, party)}을(를) 부축한다. (원래 카드: ${d.cards[inst.orig].name})`;
    cls = 'rescue';
  }
  if (inst && def.idx === d.special.mourn) {
    text = `떠난 ${ownerName(def, inst, party)}을(를) 위해 곡을 한다. 카드 1장을 뽑는다.`;
    cls = 'rescue';
  }
  if (def.isStatus && def.idx !== d.special.rescue && def.idx !== d.special.mourn) cls = 'status';
  if (def.isCurse) cls = 'curse';
  const rarity = def.rarity === '희귀' ? 'rare' : def.rarity === '고급' ? 'uncommon' : '';
  const upgraded = def.upgraded ? 'upgraded' : '';
  const kws = def.keywords.filter((k) => k !== '받는소리');
  const typeLine = `${def.isToken ? '부적' : def.type} · ${ownerName(def, inst, party)}${def.rarity && !['기본', '부적', '특수', '공용'].includes(def.rarity) ? ` · ${def.rarity}` : ''}`;
  return (
    <div
      class={`card ${cls} ${rarity} ${upgraded} ${dis ? 'dis' : ''} ${sel ? 'sel' : ''} ${big ? 'big' : ''} ${pickable ? 'pickable' : ''}`}
      style={{ '--oc': c1, '--oc2': c2 ?? c1 } as CSSProperties}
      onClick={onClick}
      data-testid={testid}
      role={onClick ? 'button' : undefined}
      aria-label={`${name}${def.upgraded ? ' (강화)' : ''} 비용 ${def.cost}`}
      title={`${name}${def.upgraded ? '+' : ''} — ${text}`}
    >
      <div class={`oband ${c2 ? 'duo' : ''}`} />
      <svg class="stroke" viewBox="0 0 28 60" preserveAspectRatio="none" aria-hidden="true">
        <path d={STROKE} fill="none" stroke="#c33427" stroke-width="3.2" stroke-linecap="round" />
      </svg>
      {!def.unplayable && <div class="cost">{def.cost}</div>}
      {resp && <div class="resp" title="지금 내면 받는소리가 성립한다">받</div>}
      {def.upgraded && <div class="upseal" title="강화한 카드">강</div>}
      <div class="cname">{name}</div>
      {/* 카드 삽화 창 (D8-1: 카드마다 삽화 — 지금은 스케치, docs/11-card-art.md) */}
      <div class="card-art" data-card-id={def.id} aria-hidden="true">
        <CardArt cardId={def.id} width={big ? 146 : 118} />
      </div>
      <div class="ctype">{typeLine}</div>
      <div class="ctext"><KwText text={text} /></div>
      {kws.length > 0 && <div class="ckw">{kws.join(' · ')}</div>}
      {note}
    </div>
  );
}

// ── 넋등 막대 ────────────────────────────────────────────────────────
export function LightBar({ light, compact }: { light: number; compact?: boolean }) {
  const b = bandOf(light);
  return (
    <div class="lightbar" data-testid="light">
      <div class="row small" style={{ gap: '6px' }}>
        <span class="lamp-dot" style={{ background: b.color, boxShadow: light > 0 ? undefined : 'none' }} />
        <b>넋등 {light}</b>
        <span class="chip lamp">{b.name}</span>
        {!compact && (
          <span class="dim tiny">
            {b.first ? `선제 ${Math.round(b.first * 100)}%` : ''}{b.ambush ? `기습 ${Math.round(b.ambush * 100)}%` : ''}
            {b.shadow ? ` · 그늘 ${b.shadow}장` : ''}{b.enemyDmg > 1 ? ` · 적 피해 +${Math.round((b.enemyDmg - 1) * 100)}%` : ''}
            {b.gold > 1 ? ` · 엽전 +${Math.round((b.gold - 1) * 100)}%` : ''}{b.choices > 3 ? ' · 카드 4택' : ''}
          </span>
        )}
      </div>
      <div class="track"><div class="fill" style={{ width: `${light}%` }} /><div class="ticks" /></div>
    </div>
  );
}

// ── 장단 북 ──────────────────────────────────────────────────────────
export function Jangdan({ n }: { n: number }) {
  const beat = [1.4, 1.1, 0.85, 0.62, 0.45, 0.32][n] ?? 1.2;
  // 장단이 오른 순간: 새로 켜진 북 하나가 크게 한 번 (받는소리)
  const [pop, setPop] = useState(-1);
  const prev = useRef(n);
  useEffect(() => {
    if (n > prev.current) {
      setPop(n);
      const t = setTimeout(() => setPop(-1), 320);
      prev.current = n;
      return () => clearTimeout(t);
    }
    prev.current = n;
  }, [n]);
  return (
    <div class="jangdan" title="장단: 주인이 바뀔 때마다 +1, 턴이 끝나면 0" data-testid="jangdan">
      <div class="tiny dim">장단 {n}/5</div>
      <div class="drums" style={{ '--beat': `${beat}s` } as CSSProperties}>
        {[1, 2, 3, 4, 5].map((i) => <span key={i} class={`drum ${i <= n ? 'on' : ''} ${i === pop ? 'pop' : ''}`} style={{ animationDelay: i === pop ? '0s' : `${(i - 1) * 0.06}s` }} />)}
      </div>
    </div>
  );
}

export function Pips({ n, max }: { n: number; max: number }) {
  return <span class="pips">{Array.from({ length: max }, (_, i) => <i key={i} class={i < n ? 'on' : ''} />)}</span>;
}

export function Bar({ v, max, cls = '' }: { v: number; max: number; cls?: string }) {
  return <div class={`bar ${cls}`}><i style={{ width: `${Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100))}%` }} /></div>;
}

export function Overlay({ children, onClose, testid }: { children: ComponentChildren; onClose?: () => void; testid?: string }) {
  return (
    <div class="overlay" onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }} data-testid={testid}>
      <div class="sheet" role="dialog" aria-modal="true">{children}</div>
    </div>
  );
}
