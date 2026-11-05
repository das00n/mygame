// 러프 그래픽 팔레트 (10-presentation §4.5). CSS 토큰(styles.css :root)과 같은 값을 SVG 속성에서 쓰려고 상수로 둔다.

export const INK = '#1a1712'; // --meok: 인형 먹선
export const SKIN = ['#ead6b4', '#e3c79f', '#f0dcc0'] as const;
export const HANJI = '#ebe3cb'; // --hanji
export const HANJI_SHADE = '#c9bf9f'; // --hanji-shade
export const WOOD = '#8a5a36'; // --kkokdu-wood

/** 원귀 계열 → 한(恨)의 빛깔 (--han-*) */
export const HAN: Record<string, string> = {
  수귀: '#5f8fb0',
  객귀: '#a08a6a',
  '굶주린 넋': '#9c9a78',
  잡귀잡신: '#8e7aa6',
  억울귀: '#b0564a',
  역귀: '#c9873a',
  '무장 원귀': '#7a8288',
  '몽달·손각시': '#c27a9a',
  사자: '#9a6a4a',
};

/** 의도 테두리 (오방: 적 공격 · 황 이동 · 청 귀기/홀림) */
export const INTENT_COLOR = { attack: '#c33427', move: '#e2b23a', stress: '#2f6fb3', calm: '#8fb5dc' } as const;

export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** 문자열 → 작은 정수 (개체 변형: 같은 원형의 다른 사람) */
export function hashOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** 무대 좌표(1280 × H) → 겹친 HTML 의 % 위치 */
export const pctX = (x: number, w = 1280) => `${(x / w) * 100}%`;
export const pctY = (y: number, h: number) => `${(y / h) * 100}%`;
