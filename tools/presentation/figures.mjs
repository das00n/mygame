// 러프 그래픽 원시 도형 — 영웅(꼭두풍 채색 목인)과 원귀(넋전풍 한지 오림)를 코드로 그린다.
// 외부 이미지 없이 SVG 문자열만 만든다. 목업(build.mjs)과, D8 확정 뒤 플레이어블 Preact 컴포넌트의 출발점으로 쓴다.
// 좌표: 발 중앙이 (0,0), 위가 −y, 얼굴은 +x(오른쪽)를 본다. 키는 약 140.

export const INK = '#1a1712';
export const SKIN = '#ead6b4';
export const HANJI = '#ebe3cb';
export const HANJI_SHADE = '#c9bf9f';

// 플레이어블 web/src/game/content.ts 의 HERO_COLOR 와 같은 값
export const HERO = {
  manshin: { name: '만신', color: '#e0503f', range: '원거리' },
  jaebi: { name: '잽이', color: '#e5b640', range: '원거리' },
  posu: { name: '포수', color: '#3fae94', range: '원거리' },
  baksu: { name: '작두박수', color: '#d4dde3', range: '근접' },
  seungnyeo: { name: '승려', color: '#c08a52', range: '근접' },
  beopsa: { name: '법사', color: '#6d8fe6', range: '원거리' },
  talggun: { name: '탈꾼', color: '#94c653', range: '근접' },
  chasa: { name: '차사', color: '#c26aa0', range: '근접' },
};

// 원귀 계열 → 한(恨)의 빛깔. 계열마다 실루엣 덧붙임이 하나씩 있다.
export const FAMILY = {
  수귀: { tint: '#5f8fb0' },
  객귀: { tint: '#a08a6a' },
  '굶주린 넋': { tint: '#9c9a78' },
  잡귀잡신: { tint: '#8e7aa6' },
  억울귀: { tint: '#b0564a' },
  역귀: { tint: '#c9873a' },
  '무장 원귀': { tint: '#7a8288' },
  '몽달·손각시': { tint: '#c27a9a' },
};

const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
};

/** SVG <defs> — 문서마다 한 번 넣는다 */
export function defs() {
  return `<defs>
  <filter id="aura" x="-60%" y="-40%" width="220%" height="180%"><feGaussianBlur stdDeviation="9"/></filter>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2"/></filter>
  <pattern id="hanjiFiber" width="18" height="18" patternUnits="userSpaceOnUse">
    <path d="M2 4 q5 2 9 -1 M6 13 q4 -3 10 1 M13 7 q2 3 -2 6" stroke="rgba(120,100,60,.18)" stroke-width=".8" fill="none"/>
  </pattern>
  <pattern id="mobuHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="3" height="6" fill="rgba(10,8,6,.75)"/>
  </pattern>
  <radialGradient id="lampGlow" cx="50%" cy="50%" r="50%">
    <stop offset="0" stop-color="#ffd27a" stop-opacity=".55"/>
    <stop offset=".55" stop-color="#ffb35a" stop-opacity=".18"/>
    <stop offset="1" stop-color="#ffb35a" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="haewonGlow" cx="50%" cy="50%" r="50%">
    <stop offset="0" stop-color="#fff6dc" stop-opacity=".9"/>
    <stop offset="1" stop-color="#fff6dc" stop-opacity="0"/>
  </radialGradient>
</defs>`;
}

// ── 영웅 ──────────────────────────────────────────────

function body(color, { wide = false, robeLen = 0 } = {}) {
  const hem = wide ? 34 : 29;
  const dark = shade(color, 0.72);
  return `
  <ellipse cx="0" cy="2" rx="34" ry="6" fill="rgba(0,0,0,.35)"/>
  <rect x="-13" y="-11" width="10" height="11" rx="3" fill="#2a2018"/>
  <rect x="3" y="-11" width="11" height="11" rx="3" fill="#2a2018"/>
  <path d="M-15 -92 L15 -92 L${hem} ${-8 + robeLen} Q0 ${-2 + robeLen} ${-hem} ${-8 + robeLen} Z" fill="${color}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M-15 -92 L15 -92 L${hem} ${-8 + robeLen} Q0 ${-2 + robeLen} ${-hem} ${-8 + robeLen} Z" fill="url(#hanjiFiber)"/>
  <path d="M-8 -92 L1 -76 L9 -92" fill="none" stroke="${HANJI}" stroke-width="3"/>
  <rect x="-20" y="-60" width="41" height="6" fill="${dark}" stroke="${INK}" stroke-width="1"/>`;
}
function head(x = 2, y = -108, r = 15) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${SKIN}" stroke="${INK}" stroke-width="2"/>
  <circle cx="${x + 7}" cy="${y - 2}" r="1.9" fill="${INK}"/>
  <circle cx="${x + 5}" cy="${y + 5}" r="2.6" fill="#d0533f" opacity=".75"/>
  <path d="M${x + 9} ${y + 8} q2 1 4 0" stroke="${INK}" stroke-width="1.2" fill="none"/>`;
}
const arm = (x1, y1, x2, y2, c) =>
  `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M${x1} ${y1} L${x2} ${y2}" stroke="${c}" stroke-width="8.5" stroke-linecap="round"/><circle cx="${x2}" cy="${y2}" r="4.6" fill="${SKIN}" stroke="${INK}" stroke-width="1.4"/>`;

const HERO_PARTS = {
  manshin(c, pose) {
    const fanUp = pose === 'attack' || pose === 'cast';
    const hx = fanUp ? 30 : 24, hy = fanUp ? -100 : -70;
    const fan = `<g transform="translate(${hx} ${hy}) rotate(${fanUp ? -20 : 10})">
      <path d="M0 0 L-22 -26 A34 34 0 0 1 22 -26 Z" fill="${HANJI}" stroke="${INK}" stroke-width="1.6"/>
      <path d="M-22 -26 A34 34 0 0 1 22 -26 L15 -18 A24 24 0 0 0 -15 -18 Z" fill="#2f86a6"/>
      <path d="M-15 -18 A24 24 0 0 1 15 -18 L9 -11 A14 14 0 0 0 -9 -11 Z" fill="#e2b23a"/>
      <path d="M0 0 L0 -32 M0 0 L-12 -29 M0 0 L12 -29" stroke="${INK}" stroke-width=".8"/></g>`;
    return `${body(c, { wide: true, robeLen: 2 })}
      ${arm(-13, -86, -24, -56, shade(c, 0.85))}
      <g fill="#e2b23a" stroke="${INK}" stroke-width=".8"><circle cx="-27" cy="-49" r="3.4"/><circle cx="-21" cy="-46" r="3.4"/><circle cx="-26" cy="-42" r="3.4"/><circle cx="-31" cy="-44" r="3"/></g>
      ${head()}
      <path d="M-13 -116 Q2 -134 17 -116 Q6 -122 -13 -116 Z" fill="#20181a" stroke="${INK}" stroke-width="1.5"/>
      <ellipse cx="-12" cy="-112" rx="7" ry="6" fill="#20181a"/>
      <path d="M-14 -119 L18 -119" stroke="#c33427" stroke-width="3"/>
      ${arm(12, -86, hx, hy, shade(c, 0.9))}${fan}`;
  },
  jaebi(c, pose) {
    const hit = pose === 'attack' || pose === 'cast';
    return `${body(c)}
      ${arm(-12, -86, -4, -60, shade(c, 0.85))}
      <g transform="translate(6 -58)">
        <path d="M-26 -14 L-6 -4 L-6 4 L-26 14 Z M26 -14 L6 -4 L6 4 L26 14 Z" fill="#8a4b2a" stroke="${INK}" stroke-width="1.5"/>
        <ellipse cx="-26" cy="0" rx="5" ry="14" fill="#c33427" stroke="${INK}" stroke-width="1.5"/>
        <ellipse cx="26" cy="0" rx="5" ry="14" fill="#2f86a6" stroke="${INK}" stroke-width="1.5"/>
        <path d="M-24 -12 L-14 10 L-6 -6 L6 6 L14 -10 L24 12" stroke="${HANJI}" stroke-width="1" fill="none"/></g>
      ${head()}
      <path d="M-20 -116 L24 -116 L2 -134 Z" fill="#b89a5a" stroke="${INK}" stroke-width="1.6"/>
      ${arm(12, -86, hit ? 34 : 28, hit ? -86 : -70, shade(c, 0.9))}
      <path d="M${hit ? 34 : 28} ${hit ? -86 : -70} L${hit ? 52 : 40} ${hit ? -64 : -56}" stroke="${INK}" stroke-width="2.4"/>`;
  },
  posu(c, pose) {
    const aim = pose === 'attack';
    const gun = aim
      ? `<path d="M-6 -86 L78 -92" stroke="#5a3a22" stroke-width="7" stroke-linecap="round"/><path d="M30 -90 L80 -93" stroke="#2a2a2a" stroke-width="3.5"/>${pose === 'attack' ? '<circle cx="86" cy="-93" r="7" fill="#ffd27a" opacity=".9"/>' : ''}`
      : `<path d="M-14 -40 L30 -122" stroke="#5a3a22" stroke-width="6.5" stroke-linecap="round"/><path d="M14 -92 L32 -126" stroke="#2a2a2a" stroke-width="3.5"/>`;
    return `${body(c)}
      <ellipse cx="-18" cy="-52" rx="6" ry="8" fill="#8a6a3a" stroke="${INK}" stroke-width="1.3"/>
      ${arm(-12, -86, aim ? 4 : -10, aim ? -84 : -54, shade(c, 0.85))}
      ${gun}
      ${head()}
      <ellipse cx="1" cy="-120" rx="18" ry="10" fill="#6b4a2e" stroke="${INK}" stroke-width="1.6"/>
      <path d="M-16 -118 q4 -4 8 0 q4 -4 8 0 q4 -4 8 0 q4 -4 8 0" stroke="#3d2a18" stroke-width="1.2" fill="none"/>
      ${arm(12, -86, aim ? 30 : 14, aim ? -88 : -78, shade(c, 0.9))}`;
  },
  baksu(c, pose) {
    const up = pose === 'attack';
    const kx = up ? 34 : 28, ky = up ? -112 : -72;
    return `${body(c, { robeLen: 0 })}
      <path d="M-15 -92 L15 -92 L18 -40 L-18 -40 Z" fill="#c33427" stroke="${INK}" stroke-width="1.6" opacity=".92"/>
      ${arm(-12, -86, -22, -58, shade(c, 0.85))}
      ${head()}
      <ellipse cx="2" cy="-119" rx="24" ry="5" fill="#1d1a22" stroke="${INK}" stroke-width="1.2"/>
      <path d="M-9 -120 Q2 -138 13 -120 Z" fill="#1d1a22"/>
      <path d="M2 -135 q-8 -6 -2 -14 q6 4 2 14" fill="#c33427"/>
      ${arm(12, -86, kx, ky, shade(c, 0.9))}
      <g transform="translate(${kx} ${ky}) rotate(${up ? -35 : -10})">
        <path d="M0 0 L0 -40" stroke="#cfd6dc" stroke-width="4"/><path d="M0 0 L0 -40" stroke="${INK}" stroke-width=".8"/>
        <path d="M-2 2 l-5 14 M0 3 l0 15 M2 2 l5 14 M-1 3 l-3 13 M1 3 l3 13" stroke="${HANJI}" stroke-width="1.6"/></g>`;
  },
  seungnyeo(c, pose) {
    const swing = pose === 'attack';
    const sx = swing ? 30 : 22, sy = swing ? -96 : -74;
    return `${body(c)}
      <path d="M-15 -92 L15 -92 L-20 -16 L-28 -22 Z" fill="#8a3a2a" stroke="${INK}" stroke-width="1.3" opacity=".9"/>
      ${arm(-12, -86, -14, -62, shade(c, 0.85))}
      <g fill="#3a2a1e">${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${-16 + Math.sin(i) * 3}" cy="${-56 + i * 4}" r="1.8"/>`).join('')}</g>
      ${head(2, -108, 15)}
      <path d="M-11 -116 Q2 -126 15 -116" stroke="#c9b190" stroke-width="2" fill="none"/>
      ${arm(12, -86, sx, sy, shade(c, 0.9))}
      <g transform="translate(${sx} ${sy}) rotate(${swing ? 30 : 4})">
        <path d="M0 64 L0 -62" stroke="#6b4a2e" stroke-width="4"/>
        <circle cx="0" cy="-68" r="7" fill="none" stroke="#c9a85a" stroke-width="2.4"/>
        <circle cx="-7" cy="-62" r="3" fill="none" stroke="#c9a85a" stroke-width="1.6"/><circle cx="7" cy="-62" r="3" fill="none" stroke="#c9a85a" stroke-width="1.6"/></g>`;
  },
  beopsa(c, pose) {
    const read = pose === 'cast' || pose === 'attack';
    return `${body(c, { robeLen: 2 })}
      ${arm(-12, -86, 6, -70, shade(c, 0.85))}
      ${head()}
      <path d="M-13 -116 L-11 -132 L15 -132 L17 -116 Z" fill="#26304a" stroke="${INK}" stroke-width="1.5"/>
      <path d="M2 -132 L2 -116" stroke="#40507a" stroke-width="1.5"/>
      ${arm(12, -86, 22, -72, shade(c, 0.9))}
      <g transform="translate(14 -72)">
        <rect x="-16" y="-8" width="32" height="16" fill="${HANJI}" stroke="${INK}" stroke-width="1.2"/>
        <path d="M-11 -4 h22 M-11 0 h18 M-11 4 h20" stroke="#333" stroke-width=".9"/></g>
      ${read ? `<g transform="translate(46 -104) rotate(12)"><rect x="-7" y="-14" width="14" height="28" fill="#e8cf7c" stroke="#8a6a2a" stroke-width="1"/><path d="M-3 -9 q6 5 0 9 q-6 4 0 9" stroke="#c33427" stroke-width="1.8" fill="none"/></g>` : ''}`;
  },
  talggun(c, pose, opts = {}) {
    const mask = opts.mask ?? 'malttugi';
    const maskC = { malttugi: '#c8442e', yangban: '#efe6cf', halmi: '#3a2f2a' }[mask];
    const lunge = pose === 'attack';
    return `${body(c)}
      ${arm(-12, -86, -30, lunge ? -96 : -64, shade(c, 0.85))}
      <path d="M-30 ${lunge ? -96 : -64} q-14 10 -8 30 q6 10 -4 22" stroke="${HANJI}" stroke-width="7" fill="none" stroke-linecap="round" opacity=".95"/>
      <ellipse cx="3" cy="-108" rx="17" ry="20" fill="${maskC}" stroke="${INK}" stroke-width="2"/>
      <ellipse cx="10" cy="-113" rx="4" ry="3" fill="#fff" stroke="${INK}" stroke-width="1.2"/><circle cx="11" cy="-113" r="1.6" fill="${INK}"/>
      <path d="M12 -104 q5 3 2 7" stroke="${INK}" stroke-width="2" fill="none"/>
      <path d="M2 -95 q9 3 14 -2" stroke="${INK}" stroke-width="2" fill="${mask === 'halmi' ? '#a33' : '#fff'}"/>
      <circle cx="-4" cy="-104" r="3" fill="#2f86a6" opacity="${mask === 'malttugi' ? 0.9 : 0}"/>
      <path d="M-14 -124 L20 -124 L4 -138 Z" fill="#3a2f2a" stroke="${INK}" stroke-width="1.4"/>
      ${arm(12, -86, lunge ? 38 : 26, lunge ? -80 : -66, shade(c, 0.9))}
      <path d="M${lunge ? 38 : 26} ${lunge ? -80 : -66} q16 -6 22 -24" stroke="#6b4a2e" stroke-width="3" fill="none"/>`;
  },
  chasa(c, pose) {
    const throwR = pose === 'attack';
    return `${body(c)}
      <path d="M-14 -90 L14 -90 L20 -30 L4 -30 L0 -70 L-4 -30 L-20 -30 Z" fill="#3a3550" stroke="${INK}" stroke-width="1.4" opacity=".9"/>
      <rect x="-24" y="-56" width="9" height="18" fill="#c33427" stroke="${INK}" stroke-width="1"/>
      ${arm(-12, -86, -16, -58, shade(c, 0.85))}
      ${head()}
      <ellipse cx="2" cy="-118" rx="20" ry="5" fill="#5a2e2e" stroke="${INK}" stroke-width="1.3"/>
      <path d="M-11 -119 Q2 -136 15 -119 Z" fill="#5a2e2e" stroke="${INK}" stroke-width="1.3"/>
      <path d="M2 -134 l-3 -8 l6 0 Z" fill="#c33427"/>
      ${arm(12, -86, throwR ? 34 : 22, throwR ? -94 : -64, shade(c, 0.9))}
      ${throwR
        ? `<path d="M34 -94 q30 -20 54 4 q10 14 -6 18" stroke="#c33427" stroke-width="3" fill="none"/>`
        : `<g transform="translate(24 -60)"><circle r="9" fill="none" stroke="#c33427" stroke-width="3"/><circle r="5" fill="none" stroke="#c33427" stroke-width="2"/></g>`}`;
  },
};

/**
 * 영웅 한 명. pose: idle | attack | cast | hit | downed
 * opts: { scale, x, y, mask(탈꾼), flip }
 */
export function hero(id, { x = 0, y = 0, scale = 1, pose = 'idle', mask, flip = false, dim = false } = {}) {
  const h = HERO[id];
  const inner = HERO_PARTS[id](h.color, pose, { mask });
  const sx = flip ? -scale : scale;
  if (pose === 'downed') {
    return `<g transform="translate(${x} ${y}) scale(${sx} ${scale})" opacity="${dim ? 0.55 : 1}">
      <g transform="translate(-60 -6) rotate(-90)" opacity=".8" style="filter:saturate(.45) brightness(.8)">${inner}</g>
    </g>`;
  }
  const lean = pose === 'attack' ? 'rotate(8)' : pose === 'hit' ? 'rotate(-10) translate(-8 0)' : '';
  return `<g transform="translate(${x} ${y}) scale(${sx} ${scale})" opacity="${dim ? 0.55 : 1}"><g transform="${lean}">${inner}</g>${pose === 'hit' ? `<path d="M30 -110 l14 -6 M32 -96 l16 0 M30 -82 l14 6" stroke="#ff6a4d" stroke-width="3"/>` : ''}</g>`;
}

/** 쓰러진 영웅 위에 뜬 넋(작은 한지 사람) + 넋 부르기 칸 */
export function soulOver(x, y, { calls = 1, need = 3, save = 65, scale = 1 } = {}) {
  const slips = Array.from({ length: need }, (_, i) =>
    `<rect x="${-need * 9 + i * 18}" y="-6" width="14" height="20" rx="2" fill="${i < calls ? HANJI : 'none'}" stroke="${HANJI}" stroke-width="1.4"/>`).join('');
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <circle cx="0" cy="-40" r="34" fill="url(#haewonGlow)" opacity=".5"/>
    ${spiritShape({ fill: HANJI, opacity: 0.85, s: 0.32, dy: -22 })}
    <g transform="translate(0 6)">${slips}</g>
    <text x="0" y="44" text-anchor="middle" font-size="13" fill="#ebe3cc" font-family="Gowun Dodum, sans-serif">넋 부르기 ${calls}/${need} · 버틸 ${save}%</text>
  </g>`;
}

// ── 원귀 (넋전풍) ──────────────────────────────────────

function spiritShape({ fill = HANJI, stroke = '#8f8774', opacity = 0.94, s = 1, dy = 0, thin = 1, burnt = false } = {}) {
  const hem = [];
  for (let i = -18 * thin; i <= 18 * thin + 0.1; i += 6 * thin) hem.push(`${i.toFixed(1)} ${hem.length % 2 ? -2 : -11}`);
  const w = 18 * thin;
  const d = `M${-w} -94 L${-34 * thin} -58 L${-26 * thin} -54 L${-w} -70 L${-w} -11 L${hem.join(' L')} L${w} -11 L${w} -70 L${26 * thin} -54 L${34 * thin} -58 L${w} -94 Z`;
  return `<g transform="translate(0 ${dy}) scale(${s})" opacity="${opacity}">
    <path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="${d}" fill="url(#hanjiFiber)"/>
    ${burnt ? `<path d="${d}" fill="none" stroke="#5a2a1a" stroke-width="5" opacity=".45"/>` : ''}
    <circle cx="0" cy="-108" r="14" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>
    <path d="M-6 -90 L-6 -40 M0 -88 L0 -30 M6 -90 L6 -40" stroke="${stroke}" stroke-width=".9" opacity=".7"/>
    <ellipse cx="-5" cy="-109" rx="2.4" ry="3.6" fill="#2e2e3a"/><ellipse cx="5" cy="-109" rx="2.4" ry="3.6" fill="#2e2e3a"/>
  </g>`;
}

const FAMILY_EXTRA = {
  수귀: () => `<path d="M-10 -122 q-6 18 -4 34 M-4 -123 q-2 20 0 30 M4 -123 q2 20 0 30 M10 -122 q6 18 4 34" stroke="#1d2a36" stroke-width="2.4" fill="none"/>
    <path d="M-14 -60 l0 14 M-4 -52 l0 18 M10 -64 l0 12 M16 -40 l0 14" stroke="#5f8fb0" stroke-width="2" opacity=".85"/>
    <ellipse cx="0" cy="0" rx="40" ry="6" fill="none" stroke="#5f8fb0" stroke-width="1.6" opacity=".7"/><ellipse cx="0" cy="1" rx="26" ry="3.5" fill="none" stroke="#5f8fb0" stroke-width="1.2" opacity=".6"/>`,
  객귀: () => `<g transform="translate(-26 -84)"><rect x="-14" y="-12" width="26" height="24" rx="7" fill="#8a7454" stroke="#3d3020" stroke-width="1.4"/><path d="M-2 -12 l6 -8 l4 8" fill="none" stroke="#3d3020" stroke-width="1.6"/></g>
    <path d="M30 -70 L38 4" stroke="#6b5636" stroke-width="3.2" stroke-linecap="round"/>`,
  '굶주린 넋': () => `<path d="M-14 -62 Q0 -46 14 -62 Z" fill="#cfc7ad" stroke="#5a5444" stroke-width="1.6"/><path d="M-16 -62 H16" stroke="#5a5444" stroke-width="1.6"/>`,
  잡귀잡신: () => `<path d="M-22 -40 l-8 6 l6 2 M20 -76 l9 -4 l-3 7 M-12 -100 l-6 -8" stroke="#8e7aa6" stroke-width="2" fill="none"/>`,
  억울귀: () => `<g transform="translate(26 -68) rotate(-12)"><rect x="-10" y="-14" width="20" height="26" fill="#d9cfb0" stroke="#4a3a2a" stroke-width="1.2"/><path d="M-6 -8 h12 M-6 -3 h12 M-6 2 h9" stroke="#4a3a2a" stroke-width=".9"/></g>`,
  역귀: () => `<path d="M-16 -134 q4 -8 0 -16 M0 -138 q4 -8 0 -16 M16 -134 q4 -8 0 -16" stroke="#e08a3a" stroke-width="2.2" fill="none" opacity=".85"/>
    <g fill="#e07a4a" opacity=".55"><circle cx="-8" cy="-70" r="3"/><circle cx="6" cy="-56" r="2.5"/><circle cx="-4" cy="-38" r="2.5"/></g>`,
  '무장 원귀': () => `<path d="M-15 -114 Q0 -136 15 -114 Z" fill="#6c7378" stroke="#2a2e32" stroke-width="1.6"/><path d="M0 -132 L0 -146" stroke="#2a2e32" stroke-width="2.4"/>
    <path d="M30 -150 L30 4" stroke="#6b5636" stroke-width="3"/><path d="M30 -150 l-5 14 l10 0 Z" fill="#8a9298" stroke="#2a2e32" stroke-width="1"/>`,
  '몽달·손각시': () => `<path d="M-12 -112 q-14 20 -8 52 q4 8 -2 16" stroke="#c33427" stroke-width="4" fill="none"/>`,
};

/**
 * 원귀 한 명 (넋전풍 한지 오림).
 * tier: normal | elite | boss | minion · state: idle | hit | haewon | cheochi
 */
export function spirit(family, { x = 0, y = 0, scale = 1, tier = 'normal', state = 'idle', boss } = {}) {
  const tint = FAMILY[family]?.tint ?? '#888';
  const s = scale * ({ normal: 1, minion: 0.8, elite: 1.25, boss: 1.6 }[tier] ?? 1);
  const extra = (FAMILY_EXTRA[family] ?? (() => ''))();
  const bossExtra = boss ? BOSS_EXTRA[boss]?.() ?? '' : '';
  let fill = HANJI, opacity = 0.94, tf = '', post = '';
  if (state === 'hit') tf = 'rotate(-7) translate(6 0)';
  if (state === 'haewon') { fill = '#fffaf0'; opacity = 0.8; tf = 'translate(0 -26)'; post = `<g opacity=".9"><circle cx="0" cy="-70" r="70" fill="url(#haewonGlow)"/></g>`; }
  if (state === 'cheochi') { fill = '#55524c'; opacity = 0.75; tf = 'translate(0 18) scale(1.05 .55) rotate(6)'; }
  const aura = state === 'cheochi' ? '' : `<ellipse cx="0" cy="-66" rx="40" ry="66" fill="${state === 'haewon' ? '#fff3d0' : tint}" opacity=".45" filter="url(#aura)"/>`;
  return `<g transform="translate(${x} ${y}) scale(${-s} ${s})">
    ${post}${aura}
    <g transform="${tf}">${spiritShape({ fill, opacity, thin: family === '굶주린 넋' ? 0.8 : 1, burnt: family === '억울귀' })}${state === 'cheochi' ? '' : extra}${bossExtra}</g>
    ${state === 'cheochi' ? `<g fill="#3a3732" opacity=".8"><circle cx="-30" cy="-30" r="2"/><circle cx="-40" cy="-48" r="1.6"/><circle cx="-22" cy="-58" r="1.4"/><circle cx="-48" cy="-22" r="1.8"/></g>` : ''}
  </g>`;
}

const BOSS_EXTRA = {
  sakkun: () => `<path d="M-30 -118 L30 -118 L0 -140 Z" fill="#b89a5a" stroke="#4a3a20" stroke-width="1.6"/>
    <path d="M24 -110 L44 6" stroke="#6b4a2e" stroke-width="5"/><path d="M40 -6 l10 22 l-12 2 Z" fill="#6b4a2e"/>
    <path d="M-62 6 Q0 26 62 6 L52 -6 L-52 -6 Z" fill="#4a3424" stroke="#1d140c" stroke-width="2"/>`,
};

// ── 아이콘 ─────────────────────────────────────────────

export function icon(kind, { x = 0, y = 0, s = 1, c = '#ebe3cc' } = {}) {
  const g = (inner) => `<g transform="translate(${x} ${y}) scale(${s})">${inner}</g>`;
  switch (kind) {
    case 'attack': return g(`<path d="M-7 7 L7 -7 M3 -9 L9 -3 M-8 4 L-4 8" stroke="${c}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`);
    case 'pull': return g(`<path d="M8 -6 Q-8 -10 -6 4 L-2 0 M-6 4 L-9 -1" stroke="${c}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`);
    case 'stress': return g(`<path d="M-8 -4 q3 -4 6 0 q3 4 6 0 q3 -4 6 0 M-8 4 q3 -4 6 0 q3 4 6 0 q3 -4 6 0" stroke="${c}" stroke-width="1.8" fill="none"/>`);
    case 'buff': return g(`<path d="M-7 2 L0 -5 L7 2 M-7 8 L0 1 L7 8" stroke="${c}" stroke-width="2.2" fill="none"/>`);
    case 'block': return g(`<path d="M0 -8 L7 -5 L6 3 Q0 9 -6 3 L-7 -5 Z" stroke="${c}" stroke-width="1.8" fill="none"/>`);
    case 'jeomji': return g(`<circle r="7" fill="none" stroke="#e2573f" stroke-width="2.2"/><circle r="2.4" fill="#e2573f"/>`);
    case 'sangheun': return g(`<path d="M-6 6 L-1 -1 L2 2 L6 -6" stroke="#c96a5a" stroke-width="2.4" fill="none"/>`);
    case 'myeongbu': return g(`<rect x="-6" y="-7" width="12" height="14" fill="#ebe3cc" stroke="#1a1712" stroke-width="1"/><path d="M-3 -3 h6 M-3 0 h6 M-3 3 h4" stroke="#1a1712" stroke-width="1.2"/>`);
    case 'neok': return g(`<circle r="7" fill="none" stroke="#8fb5dc" stroke-width="1.6"/><circle r="3.5" fill="none" stroke="#8fb5dc" stroke-width="1.6"/>`);
    case 'bunggoe': return g(`<path d="M-7 0 A7 7 0 0 1 0 -7 M2 -7 A7 7 0 0 1 7 1 M6 4 A7 7 0 0 1 -2 7" stroke="#fff" stroke-width="2" fill="none"/>`);
    case 'weak': return g(`<path d="M0 -7 L0 6 M-5 1 L0 6 L5 1" stroke="#b9b0d2" stroke-width="2" fill="none"/>`);
    default: return '';
  }
}
