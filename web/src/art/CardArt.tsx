// 카드 삽화 창(16:10)에 들어가는 스케치. 10단계 러프 — 최종 삽화(11단계)가 오면 같은 자리에 이미지를 끼운다.
// 사용: <CardArt cardId={def.id} width={118} />
//  - width(px): 그릴 너비. 140 미만이면 작은 카드용 세밀도(굵은 선·장식 생략·여백 조금 잘라 크게)로 그린다.
//  - 카드 틀의 .card-art 창 안에서는 창 너비를 꽉 채운다(art.css). 그때 width 는 세밀도 고르기에만 쓰인다.
//  - width 를 빼면 부모 너비를 채우고 큰 그림 세밀도로 그린다.
import './art.css';
import { lodFor, sketchSvg } from './sketch.ts';

const cache = new Map<string, string>();

/** 같은 카드·같은 세밀도는 한 번만 그린다 */
export function cardArtSvg(cardId: string, lod: 0 | 1): string {
  const key = `${cardId}@${lod}`;
  let s = cache.get(key);
  if (s === undefined) {
    s = sketchSvg(cardId, lod);
    cache.set(key, s);
  }
  return s;
}

export function CardArt({ cardId, width }: { cardId: string; width?: number }) {
  const lod = lodFor(width);
  const style = width !== undefined ? { width: `${width}px`, height: `${Math.round((width * 10) / 16)}px` } : undefined;
  return <div class={`ca ca-lod${lod}`} style={style} data-art={cardId} dangerouslySetInnerHTML={{ __html: cardArtSvg(cardId, lod) }} />;
}
