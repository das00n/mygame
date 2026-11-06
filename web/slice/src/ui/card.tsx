// 새 카드 틀: 한지 바탕 · 붓 테두리 · 원형 낙관(인장) · 타입 문양(공격 빗살 · 기술 구름 · 능력 칠보) · 강화 금박.
// 삽화: 슬라이스 덱 12장은 완성 그림(art/cardArt.ts), 나머지는 스케치(web/src/art) 그대로.

import type { CSSProperties } from 'preact';
import type { CardDef, CardInst, HeroId } from '../../../../src/core/types.ts';
import { CardArt } from '../../../src/art/CardArt.tsx';
import { D } from '../../../src/game/content.ts';
import { KwText, ownerColors, ownerName } from '../../../src/ui/common.tsx';
import { cardArtUrl } from '../art/cardArt.ts';
import { hash, rng } from '../art/paint.ts';

// 원형 낙관: 한글 한 글자(한자 글꼴이 없는 환경에서도 읽히게)
const SEAL: Partial<Record<HeroId, string>> = { seungnyeo: '승', manshin: '만', posu: '포', jaebi: '잽', baksu: '박', beopsa: '법', talggun: '탈', chasa: '차' };

/** 붓 테두리: 네 변을 따로 그은 먹 획(굵기가 변한다). 같은 카드는 같은 획 */
function borderPath(seed: number): string {
  const r = rng(seed);
  const W = 100;
  const H = 175;
  const m = 3.2;
  const side = (x1: number, y1: number, x2: number, y2: number) => {
    const n = 9;
    const nx = -(y2 - y1);
    const ny = x2 - x1;
    const L = Math.hypot(nx, ny);
    const pts: string[] = [];
    const back: string[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const w = (0.6 + Math.sin(t * Math.PI) * 1.1) * (0.8 + r() * 0.4);
      const jx = (r() - 0.5) * 0.5;
      const x = x1 + (x2 - x1) * t + jx;
      const y = y1 + (y2 - y1) * t + jx;
      pts.push(`${(x + (nx / L) * w).toFixed(2)} ${(y + (ny / L) * w).toFixed(2)}`);
      back.unshift(`${(x - (nx / L) * w * 0.6).toFixed(2)} ${(y - (ny / L) * w * 0.6).toFixed(2)}`);
    }
    return `M${pts.join(' L')} L${back.join(' L')} Z`;
  };
  const o = () => (r() - 0.5) * 2.4;
  return [side(m + o(), m, W - m + o(), m + o() * 0.3), side(W - m, m + o(), W - m + o() * 0.3, H - m + o()), side(W - m + o(), H - m, m + o(), H - m + o() * 0.3), side(m, H - m + o(), m + o() * 0.3, m + o())].join(' ');
}

const borderCache = new Map<string, string>();
function border(id: string): string {
  let p = borderCache.get(id);
  if (!p) {
    p = borderPath(hash(id));
    borderCache.set(id, p);
  }
  return p;
}

export interface CardFrameProps {
  def: CardDef;
  inst?: CardInst | null;
  party: HeroId[];
  dis?: boolean;
  sel?: boolean;
  resp?: boolean;
  big?: boolean;
  onClick?: () => void;
  testid?: string;
}

export function CardFrame({ def, inst = null, party, dis, sel, resp, big, onClick, testid }: CardFrameProps) {
  const d = D();
  const [c1, c2] = ownerColors(def, inst, party);
  let text = def.text;
  let name = def.name;
  if (inst && def.idx === d.special.rescue && inst.orig >= 0) {
    name = '넋 부르기';
    text = `쓰러진 ${ownerName(def, inst, party)}을(를) 부축한다. (원래 카드: ${d.cards[inst.orig].name})`;
  }
  const owner: HeroId | undefined = inst && inst.o >= 0 ? party[inst.o] : def.heroes[0];
  const seal = owner ? SEAL[owner] : '';
  const kind = def.isCurse ? 'curse' : def.isStatus ? 'status' : def.type === '공격' ? 'atk' : def.type === '능력' ? 'pow' : 'skl';
  const art = cardArtUrl(def.id);
  const typeLine = `${def.isToken ? '부적' : def.type} · ${ownerName(def, inst, party)}`;
  const kws = def.keywords.filter((k) => k !== '받는소리');
  return (
    <div class={`sl-card k-${kind} ${def.upgraded ? 'up' : ''} ${dis ? 'dis' : ''} ${sel ? 'sel' : ''} ${big ? 'big' : ''}`} style={{ '--oc': c1, '--oc2': c2 ?? c1 } as CSSProperties}
      onClick={onClick} data-testid={testid} role={onClick ? 'button' : undefined} aria-label={`${name}${def.upgraded ? ' (강화)' : ''} 비용 ${def.cost}`} title={`${name}${def.upgraded ? '+' : ''} — ${text}`}>
      <svg class="sl-border" viewBox="0 0 100 175" preserveAspectRatio="none" aria-hidden="true"><path d={border(def.id)} /></svg>
      <div class="sl-band" />
      {!def.unplayable && <div class="sl-cost"><span>{def.cost}</span></div>}
      <div class="sl-name">{name}{def.upgraded && <em>+</em>}</div>
      <div class={`sl-art ${art ? 'done' : 'sketch'}`} data-card-id={def.id} aria-hidden="true">
        {art ? <img src={art} alt="" draggable={false} /> : <CardArt cardId={def.id} width={big ? 146 : 118} />}
        {seal && <span class="sl-seal">{seal}</span>}
      </div>
      <div class="sl-type">{typeLine}</div>
      <div class="sl-text"><KwText text={text} /></div>
      {kws.length > 0 && <div class="sl-kw">{kws.join(' · ')}</div>}
      {resp && <div class="sl-resp" title="지금 내면 받는소리가 성립한다">받</div>}
      {def.upgraded && <div class="sl-up" title="강화한 카드">강</div>}
    </div>
  );
}
