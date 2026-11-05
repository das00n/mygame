// 문서에 한 번 넣는 공용 SVG 정의(무늬·흐림·빛). 모든 장면이 url(#jsg-…) 로 쓴다.
// display:none 안의 그라디언트는 그려지지 않으므로 보이는 0×0 SVG 에 둔다.

export function SceneDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <filter id="jsg-aura" x="-60%" y="-40%" width="220%" height="180%"><feGaussianBlur stdDeviation="9" /></filter>
        <filter id="jsg-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2" /></filter>
        <pattern id="jsg-hanji" width="18" height="18" patternUnits="userSpaceOnUse">
          <path d="M2 4 q5 2 9 -1 M6 13 q4 -3 10 1 M13 7 q2 3 -2 6" stroke="rgba(120,100,60,.18)" stroke-width=".8" fill="none" />
        </pattern>
        <pattern id="jsg-mobu" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="3" height="6" fill="rgba(10,8,6,.75)" />
        </pattern>
        <radialGradient id="jsg-lamp" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="#ffd27a" stop-opacity=".55" />
          <stop offset=".55" stop-color="#ffb35a" stop-opacity=".18" />
          <stop offset="1" stop-color="#ffb35a" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="jsg-haewon" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="#fff6dc" stop-opacity=".9" />
          <stop offset="1" stop-color="#fff6dc" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="jsg-fire" cx="50%" cy="60%" r="50%">
          <stop offset="0" stop-color="#ffd890" stop-opacity=".75" />
          <stop offset=".5" stop-color="#ff9a40" stop-opacity=".25" />
          <stop offset="1" stop-color="#ff7a30" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="jsg-dark-r" x1="0" x2="1" y1="0" y2="0">
          <stop offset=".35" stop-color="#05060a" stop-opacity="0" />
          <stop offset=".8" stop-color="#05060a" stop-opacity=".8" />
          <stop offset="1" stop-color="#05060a" stop-opacity=".94" />
        </linearGradient>
      </defs>
    </svg>
  );
}
