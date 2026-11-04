// 세 표현안이 함께 쓰는 장면 데이터 · CSS · HTML 조각.
// 같은 전투 한 장면(1막 나루, 턴 2)을 세 가지 방식으로 그려 비교한다.
import { HERO, icon } from './figures.mjs';

export const FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Gowun+Dodum&family=Nanum+Brush+Script&display=swap" rel="stylesheet">`;

// ── 장면: 1막 「건너지 못한 나루」, 방 전투 턴 2 ──
// 이번 턴: 꼬질대 다지기(포수) → 합장(승려) → 공수(만신) 를 냈다 → 장단 2, 에너지 1/3, 직전 주인 만신
export const SCENE = {
  region: '건너지 못한 나루',
  turn: 2,
  light: { value: 61, band: '흐림' },
  energy: [1, 3],
  jangdan: 2,
  lastOwner: 'manshin',
  lastCard: '공수',
  party: [
    { slot: '후열', id: 'posu', hp: [24, 30], block: 0, res: '화약', resVal: [1, 3], pred: { dmg: 3, note: '선두로 끌려 나옴' } },
    { slot: '중열', id: 'manshin', hp: [31, 35], block: 0, res: '신바람', resVal: [2, 5] },
    { slot: '선두', id: 'seungnyeo', hp: [38, 45], block: 6, res: '염주', resVal: [3, 9], pred: { dmg: 4, note: '10 − 방어 6' } },
  ],
  gutsang: { name: '몸주 신령', owner: 'manshin', left: 3, text: '턴 끝 · 무작위 적 피해 3' },
  enemies: [
    {
      name: '나루 물귀신', family: '수귀', hp: [31, 38], block: 0, scale: 1.15,
      intent: { kind: 'attack', num: '10', label: '발목 잡기', target: 'seungnyeo', targetText: '선두 · 승려' },
      status: [{ k: 'neok', name: '넋흔들림', v: '3', sub: '버팀 12' }],
      haewon: { rule: '넋흔들림 4+', prog: '3/4', near: true },
    },
    {
      name: '물에 젖은 넋', family: '수귀', hp: [13, 13], block: 0, scale: 0.9,
      intent: { kind: 'pull', num: '3', label: '끌어당김', target: 'posu', targetText: '후열 · 포수 → 선두' },
      status: [{ k: 'jeomji', name: '점지', v: '2' }],
      haewon: { rule: '넋흔들림 2+', prog: '0/2' },
    },
    {
      name: '곡소리 넋', family: '굶주린 넋', hp: [22, 30], block: 0, scale: 1.05, mobu: 3,
      intent: { kind: 'stress', num: '+4', label: '곡소리', target: 'all', targetText: '파티 전체 · 귀기' },
      status: [{ k: 'myeongbu', name: '명부', v: '3' }, { k: 'sangheun', name: '상흔', v: '2' }],
      haewon: { rule: '명부 5+', prog: '3/5' },
    },
  ],
  hand: [
    { name: '육환장', owner: 'seungnyeo', cost: 1, type: '공격', text: '피해 5. <b>넋흔들림</b> 2.', bat: true },
    { name: '원귀 호명', owner: 'manshin', cost: 1, type: '공격', text: '피해 4, <b>명부</b> 2. 받는소리: 명부 2 더.', bat: false },
    { name: '조준', owner: 'posu', cost: 1, type: '기술', text: '적 하나에 <b>점지</b> 2. 화약 +1.', bat: true },
    { name: '가사 펼치기', owner: 'seungnyeo', cost: 1, type: '기술', text: '아군 하나를 <b>엄호</b>한다.', bat: true },
    { name: '급소 저격', owner: 'posu', cost: 2, type: '공격', text: '피해 6. <b>점지</b> 1당 +2.', bat: true, off: true },
  ],
};

export const STATUS_COLOR = { neok: '#8fb5dc', jeomji: '#e2573f', myeongbu: '#ebe3cc', sangheun: '#c96a5a', bunggoe: '#fff' };

// ── CSS 토큰 (플레이어블 web/src/styles.css 와 같은 이름) + 목업 공용 ──
export const BASE_CSS = `
:root{
  color-scheme: dark;
  --ink-0:#0e111c; --ink-1:#151a2a; --ink-2:#1c2338; --ink-3:#283150; --ink-4:#364066;
  --line:rgba(222,205,160,.14); --line-2:rgba(222,205,160,.28);
  --text:#ebe3cc; --text-dim:#b0a78f; --text-faint:#7d7765;
  --paper:#ead592; --paper-2:#dcc076; --paper-3:#c9a85a; --paper-ink:#2c1e0f; --paper-ink-2:#5a4524;
  --hanji:#ebe3cb; --hanji-shade:#c9bf9f; --meok:#1a1712; --kkokdu-wood:#8a5a36;
  --cinnabar:#c33427; --cinnabar-2:#e2573f; --lamp:#ffc964; --lamp-2:#f2a54a;
  --o-blue:#2f86a6; --o-red:#c33427; --o-yellow:#e2b23a; --o-white:#ece6d6; --o-black:#0b0c12;
  --hp:#6fbf8f; --block:#8fb5dc; --stress:#b9b0d2; --haewon:#f4ead0; --danger:#ff6a4d;
  --font-brush:'Nanum Brush Script','Gungsuh','BatangChe',serif;
  --font-body:'Gowun Dodum','Apple SD Gothic Neo','Malgun Gothic','Noto Sans CJK KR','Noto Sans KR',system-ui,sans-serif;
}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{background:var(--ink-0);color:var(--text);font-family:var(--font-body);font-size:14px;line-height:1.4;overflow:hidden}
svg text{font-family:var(--font-body)}
.brush{font-family:var(--font-brush)}
.screen{display:none;width:100vw;height:100vh;overflow:hidden;position:relative;flex-direction:column}
.screen:target{display:flex}
body:not(:has(.screen:target)) .screen:first-of-type{display:flex}
.switch{position:fixed;right:8px;bottom:8px;z-index:50;display:flex;gap:4px;background:rgba(0,0,0,.6);padding:4px;border-radius:4px;font-size:12px}
.switch a{color:var(--lamp);text-decoration:none;padding:2px 6px;border:1px solid var(--line-2)}
.topbar{display:flex;align-items:center;gap:10px;padding:6px 16px;height:44px;border-bottom:1px solid var(--line);flex:none;background:linear-gradient(var(--ink-1),rgba(21,26,42,.6))}
.topbar .title{font-family:var(--font-brush);font-size:28px;color:var(--paper);line-height:1}
.topbar .opt{font-size:12px;color:var(--ink-0);background:var(--lamp);padding:2px 7px;border-radius:2px;font-weight:700}
.topbar .sp{flex:1}
.chip{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--line-2);padding:2px 7px;border-radius:3px;font-size:12.5px;color:var(--text-dim);white-space:nowrap}
.chip.lamp{color:var(--lamp);border-color:rgba(255,201,100,.5)}
.btn{border:1px solid var(--line-2);background:var(--ink-2);color:var(--text);padding:5px 10px;border-radius:3px;font-size:13px;white-space:nowrap}
.btn.end{background:linear-gradient(#d2442f,#9e2a1f);border-color:#e2573f;font-size:16px;padding:10px 18px;box-shadow:0 0 18px rgba(226,87,63,.35)}
.lightbar{display:flex;gap:2px;align-items:center}
.lightbar i{display:block;width:16px;height:6px;background:#3a3020}
.lightbar i.on{background:linear-gradient(90deg,#f2a54a,#ffc964)}
/* 손패 = 부적 */
.hand{display:flex;gap:10px;justify-content:center;align-items:flex-end}
.card{position:relative;width:148px;height:200px;flex:none;background:linear-gradient(170deg,#efdc9c,#dcc076 70%,#cfb066);border:1px solid #8a6a2a;border-radius:4px;color:var(--paper-ink);padding:22px 9px 8px;box-shadow:0 6px 16px rgba(0,0,0,.5);overflow:hidden}
.card:before{content:'';position:absolute;inset:5px;border:1px solid rgba(138,106,42,.45)}
.card .band{position:absolute;left:0;right:0;top:0;height:7px;background:var(--hc)}
.card .cost{position:absolute;left:8px;top:13px;width:26px;height:26px;border:2px solid var(--cinnabar);color:var(--cinnabar);font-weight:700;display:grid;place-items:center;transform:rotate(-5deg);background:rgba(255,240,200,.5);font-size:15px}
.card .cname{font-family:var(--font-brush);font-size:27px;color:#a3241a;line-height:1;margin-left:30px;min-height:28px}
.card .ctype{font-size:11px;color:var(--paper-ink-2);text-align:center;margin:6px 0 6px}
.card .ctext{font-size:12.5px;line-height:1.38}
.card .ctext b{color:#9e2a1f}
.card .bat{position:absolute;right:7px;bottom:7px;width:26px;height:26px;border-radius:50%;background:var(--cinnabar);color:#fff3d8;font-family:var(--font-brush);font-size:20px;display:grid;place-items:center;box-shadow:0 0 0 2px rgba(255,240,200,.6)}
.card.off{filter:brightness(.62) saturate(.6)}
.card .owner{position:absolute;right:8px;top:12px;font-size:10.5px;color:var(--hc);font-weight:700;text-shadow:0 0 2px #fff6}
/* 에너지 · 장단 */
.energy{width:74px;height:74px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#ffe2a0,#f2a54a 55%,#8a4a1a);display:grid;place-items:center;color:#3a1e08;font-weight:700;font-size:26px;box-shadow:0 0 26px rgba(255,186,92,.45);flex:none}
.energy small{font-size:13px}
.drums{display:flex;gap:6px}
.drum{width:30px;height:30px;border-radius:50%;border:2px solid #6b5636;background:radial-gradient(circle,#3a3020,#1f1a12)}
.drum.on{background:radial-gradient(circle,#ffe7a8,#e2b23a 60%,#8a6a1a);border-color:#ffd27a;box-shadow:0 0 12px rgba(226,178,58,.6)}
.batline{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-dim)}
.batline .dot{width:12px;height:12px;border-radius:50%;background:var(--hc);box-shadow:0 0 6px var(--hc)}
.note{position:absolute;left:16px;bottom:10px;font-size:12px;color:var(--text-faint);max-width:60%}
@media (max-width:600px){
  .topbar{height:40px;padding:4px 12px;gap:6px}
  .topbar .title{font-size:22px}
  .card{width:116px;height:164px;padding:20px 7px 6px}
  .card .cname{font-size:21px;min-height:22px;margin-left:24px}
  .card .cost{width:22px;height:22px;font-size:13px;left:6px;top:11px}
  .card .ctext{font-size:11.5px}
  .card .ctype{font-size:10.5px;margin:4px 0}
  .card .bat{width:22px;height:22px;font-size:17px}
  .energy{width:52px;height:52px;font-size:19px}
  .drum{width:22px;height:22px}
  .note{display:none}
  .hide-m{display:none!important}
}
@media (min-width:601px){ .hide-d{display:none!important} }
`;

export const heroColor = (id) => HERO[id].color;
export const heroName = (id) => HERO[id].name;

export function handHTML(hand = SCENE.hand, { fan = true } = {}) {
  const n = hand.length;
  return `<div class="hand">${hand
    .map((c, i) => {
      const rot = fan ? (i - (n - 1) / 2) * 3 : 0;
      const lift = fan ? Math.abs(i - (n - 1) / 2) * 6 : 0;
      return `<div class="card${c.off ? ' off' : ''}" style="--hc:${heroColor(c.owner)};transform:translateY(${lift}px) rotate(${rot}deg)">
        <div class="band"></div><div class="cost">${c.cost}</div><div class="owner">${heroName(c.owner)}</div>
        <div class="cname">${c.name}</div><div class="ctype">${c.type} · ${heroName(c.owner)}</div>
        <div class="ctext">${c.text}</div>${c.bat ? '<div class="bat">받</div>' : ''}</div>`;
    })
    .join('')}</div>`;
}

export function drumsHTML(n = SCENE.jangdan) {
  return `<div class="drums">${[0, 1, 2, 3, 4].map((i) => `<div class="drum${i < n ? ' on' : ''}"></div>`).join('')}</div>`;
}

export function lightbarHTML(v = SCENE.light.value) {
  const on = Math.round(v / 10);
  return `<span class="lightbar">${Array.from({ length: 10 }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('')}</span>`;
}

export function switchNav(items) {
  return `<nav class="switch">${items.map(([id, label]) => `<a href="#${id}">${label}</a>`).join('')}</nav>`;
}

// ── SVG 조각 ──
export function svgBar(x, y, w, h, [cur, max], { mobu = 0, block = 0, pred = 0, color = '#6fbf8f' } = {}) {
  const fw = (w * cur) / max;
  const pw = (w * Math.min(pred, cur)) / max;
  const mw = (w * Math.min(mobu, cur)) / max;
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#2a1c1a" stroke="#000" stroke-width="1"/>
    <rect x="${x}" y="${y}" width="${fw}" height="${h}" fill="${color}"/>
    ${pred ? `<rect x="${x + fw - pw}" y="${y}" width="${pw}" height="${h}" fill="#ff6a4d" opacity=".85"/>` : ''}
    ${mobu ? `<rect x="${x}" y="${y}" width="${mw}" height="${h}" fill="url(#mobuHatch)"/><line x1="${x + mw}" y1="${y - 3}" x2="${x + mw}" y2="${y + h + 3}" stroke="#ebe3cc" stroke-width="1.5"/>` : ''}
    ${block ? `<g transform="translate(${x - 12} ${y + h / 2})"><path d="M0 -9 L8 -6 L7 3 Q0 10 -7 3 L-8 -6 Z" fill="#2f4a6a" stroke="#8fb5dc" stroke-width="1.4"/><text x="0" y="3.5" text-anchor="middle" font-size="10" fill="#fff" font-weight="700">${block}</text></g>` : ''}
  </g>`;
}

export function statusChips(list, x, y, { compact = false } = {}) {
  let cx = x;
  return list
    .map((s) => {
      const label = compact ? s.v : `${s.name} ${s.v}${s.sub ? ` · ${s.sub}` : ''}`;
      const w = compact ? 32 : 20 + label.length * 11.5;
      const out = `<g><rect x="${cx}" y="${y - 11}" width="${w}" height="20" rx="3" fill="rgba(10,12,20,.82)" stroke="${STATUS_COLOR[s.k] ?? '#999'}" stroke-opacity=".6"/>
        ${icon(s.k, { x: cx + 10, y: y - 1, s: 0.85 })}
        <text x="${cx + 20}" y="${y + 3.5}" font-size="${compact ? 11.5 : 12}" fill="${STATUS_COLOR[s.k] ?? '#ddd'}">${label}</text></g>`;
      cx += w + 4;
      return out;
    })
    .join('');
}

export function intentBadge(e, x, y, { compact = false } = {}) {
  const it = e.intent;
  const c = it.target === 'all' ? '#b9b0d2' : heroColor(it.target);
  if (compact) {
    const slot = it.target === 'all' ? '전' : { seungnyeo: '선', manshin: '중', posu: '후' }[it.target];
    return `<g transform="translate(${x} ${y})">
      <rect x="-30" y="-15" width="60" height="28" rx="4" fill="rgba(12,10,14,.9)" stroke="${it.kind === 'attack' ? '#e2573f' : it.kind === 'pull' ? '#e2b23a' : '#b9b0d2'}" stroke-width="1.5"/>
      ${icon(it.kind, { x: -18, y: -1, s: 0.9 })}
      <text x="-6" y="5" font-size="15" font-weight="700" fill="#fff">${it.num}</text>
      <circle cx="19" cy="-1" r="9" fill="${c}"/><text x="19" y="3.5" text-anchor="middle" font-size="11" fill="#111" font-weight="700">${slot}</text>
    </g>`;
  }
  return `<g transform="translate(${x} ${y})">
    <rect x="-80" y="-22" width="160" height="46" rx="5" fill="rgba(12,10,14,.9)" stroke="${it.kind === 'attack' ? '#e2573f' : it.kind === 'pull' ? '#e2b23a' : '#b9b0d2'}" stroke-width="1.6"/>
    ${icon(it.kind, { x: -64, y: -6, s: 1.2 })}
    <text x="-48" y="0" font-size="20" font-weight="700" fill="#fff">${it.num}</text>
    <text x="${-48 + it.num.length * 12 + 6}" y="-2" font-size="13" fill="#ebe3cc">${it.label}</text>
    <text x="-64" y="17" font-size="12.5" fill="${c}">→ ${it.targetText}</text>
  </g>`;
}

export function arc(x1, y1, x2, y2, color, { lift = 70, dash = '6 5', w = 2.2, op = 0.85 } = {}) {
  const mx = (x1 + x2) / 2;
  const my = Math.min(y1, y2) - lift;
  return `<path d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${w}" stroke-dasharray="${dash}" opacity="${op}"/>
    <circle cx="${x2}" cy="${y2}" r="4.5" fill="${color}" opacity="${op}"/>`;
}
