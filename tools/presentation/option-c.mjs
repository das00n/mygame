// 안 C — 위에서 본 굿상(판): 돗자리 위에 영웅 패(꼭두 얼굴 원판)와 원귀 넋전 종이를 놓는 보드게임식 화면.
import { globalDefs, hero, spirit, icon, HANJI } from './figures.mjs';
import { SCENE, BASE_CSS, FONT_LINKS, handHTML, drumsHTML, lightbarHTML, switchNav, heroColor, heroName } from './common.mjs';

const CSS = `
.stage{flex:none;line-height:0}
.stage svg{display:block;width:100%;height:auto}
.dock{flex:1;display:flex;align-items:center;justify-content:center;gap:16px;padding:6px 16px;min-height:0}
.dock .hand{gap:10px}
.lbl{font-size:12px;color:var(--text-dim)}
.panel{border:1px solid var(--line);background:rgba(16,20,34,.86);border-radius:3px;padding:8px 10px}
.panel h3{margin:0 0 6px;font-family:var(--font-brush);font-weight:400;font-size:22px;color:var(--paper)}
.mrow{display:none}
@media (max-width:600px){
  .dock{flex-direction:column;align-items:stretch;gap:6px;padding:4px 12px;justify-content:flex-start}
  .dock .handwrap{overflow-x:auto}.dock .hand{justify-content:flex-start;width:max-content;gap:8px}
  .mrow{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .dock > .btn.end{display:none}
}
`;

let CLIP = 0;
function wood(W, H) {
  return `<rect width="${W}" height="${H}" fill="#2a1a10"/>${Array.from({ length: Math.round(H / 14) }, (_, i) => `<path d="M0 ${i * 14 + 6} Q${W / 3} ${i * 14 + (i % 2 ? 2 : 10)} ${W} ${i * 14 + 5}" stroke="#3a2416" stroke-width="2" fill="none"/>`).join('')}`;
}
function mat(x, y, w, h) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#6e5c3a" stroke="#3a2a14" stroke-width="3"/>
    ${Array.from({ length: Math.floor(w / 9) }, (_, i) => `<line x1="${x + 4 + i * 9}" y1="${y + 3}" x2="${x + 4 + i * 9}" y2="${y + h - 3}" stroke="#5e4c2c" stroke-width="1.2"/>`).join('')}
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="none" stroke="#c33427" stroke-width="2" stroke-dasharray="1 7" opacity=".5"/>`;
}

/** 영웅 패: 위에서 본 원판. 테두리 고리 = 체력 */
function token(id, cx, cy, r, h) {
  const id2 = `tk${++CLIP}`;
  const c = heroColor(id);
  const C = 2 * Math.PI * (r + 6);
  const frac = h.hp[0] / h.hp[1];
  const pred = (h.pred?.dmg ?? 0) / h.hp[1];
  const k = r / 52;
  return `<g>
    <clipPath id="${id2}"><circle cx="${cx}" cy="${cy}" r="${r - 4}"/></clipPath>
    <circle cx="${cx + 4}" cy="${cy + 6}" r="${r + 8}" fill="rgba(0,0,0,.4)"/>
    <circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="none" stroke="#2a1c1a" stroke-width="${8 * k}"/>
    <circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="none" stroke="#6fbf8f" stroke-width="${8 * k}" stroke-dasharray="${C * frac} ${C}" transform="rotate(-90 ${cx} ${cy})"/>
    ${pred ? `<circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="none" stroke="#ff6a4d" stroke-width="${8 * k}" stroke-dasharray="0 ${C * (frac - pred)} ${C * pred} ${C}" transform="rotate(-90 ${cx} ${cy})"/>` : ''}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" stroke="#1a1712" stroke-width="2"/>
    <g clip-path="url(#${id2})"><rect x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" fill="#efe6cf" opacity=".25"/>${hero(id, { x: cx - 2 * k * 1.15, y: cy + 104 * k * 1.15, scale: 1.15 * k })}</g>
    ${h.block ? `<g transform="translate(${cx - r * 0.8} ${cy - r * 0.8})"><path d="M0 -11 L10 -7 L9 4 Q0 12 -9 4 L-10 -7 Z" fill="#2f4a6a" stroke="#8fb5dc" stroke-width="1.5"/><text x="0" y="3.5" text-anchor="middle" font-size="11" fill="#fff" font-weight="700">${h.block}</text></g>` : ''}
  </g>`;
}

/** 원귀 넋전 종이(위에서 본 모습) */
function slip(e, cx, cy, w, hgt, rot) {
  const k = hgt / 180;
  let s = `<g transform="rotate(${rot} ${cx} ${cy})">
    <rect x="${cx - w / 2 + 4}" y="${cy - hgt / 2 + 6}" width="${w}" height="${hgt}" fill="rgba(0,0,0,.35)"/>
    <rect x="${cx - w / 2}" y="${cy - hgt / 2}" width="${w}" height="${hgt}" fill="${HANJI}" stroke="#8f8774"/>
    <rect x="${cx - w / 2}" y="${cy - hgt / 2}" width="${w}" height="${hgt}" fill="url(#hanjiFiber)"/>
    ${spirit(e.family, { x: cx, y: cy + 72 * k, scale: 0.78 * k })}
    ${e.status.some((x) => x.k === 'sangheun') ? `<path d="M${cx + w / 2 - 6} ${cy - 30 * k} l-14 10 l6 6 l-16 14" stroke="#7a2a1a" stroke-width="2.4" fill="none"/>` : ''}
    <text x="${cx}" y="${cy + hgt / 2 - 8 * k}" text-anchor="middle" font-size="${15 * k}" font-weight="700" fill="#2a1a10">${e.hp[0]}/${e.hp[1]}</text>
  </g>`;
  return s;
}
function markers(e, x, y, k = 1) {
  let s = '';
  let yy = y;
  for (const st of e.status) {
    if (st.k === 'jeomji') s += Array.from({ length: +st.v }, (_, i) => `<rect x="${x + i * 16 * k}" y="${yy - 7 * k}" width="${13 * k}" height="${13 * k}" fill="#c33427" stroke="#6a1a10" transform="rotate(${-6 + i * 5} ${x + i * 16 * k} ${yy})"/>`).join('') + `<text x="${x + (+st.v) * 16 * k + 2}" y="${yy + 4 * k}" font-size="${12 * k}" fill="#ebe3cc">점지</text>`;
    if (st.k === 'myeongbu') s += `<rect x="${x}" y="${yy - 9 * k}" width="${34 * k}" height="${18 * k}" fill="#efe6cf" stroke="#3a2a1a"/>${Array.from({ length: +st.v }, (_, i) => `<path d="M${x + 6 * k + i * 8 * k} ${yy - 6 * k} v${12 * k}" stroke="#111" stroke-width="${2.2 * k}"/>`).join('')}<text x="${x + 38 * k}" y="${yy + 4 * k}" font-size="${12 * k}" fill="#ebe3cc">명부</text>`;
    if (st.k === 'neok') s += `${[0, 1, 2].map((i) => `<circle cx="${x + 8 * k + i * 12 * k}" cy="${yy}" r="${6 * k}" fill="none" stroke="#8fb5dc" stroke-width="${2 * k}"/>`).join('')}<text x="${x + 42 * k}" y="${yy + 4 * k}" font-size="${12 * k}" fill="#8fb5dc">${st.v}</text>`;
    if (st.k === 'sangheun') s += `${icon('sangheun', { x: x + 6 * k, y: yy, s: k })}<text x="${x + 16 * k}" y="${yy + 4 * k}" font-size="${12 * k}" fill="#e09a8a">상흔 ${st.v}</text>`;
    yy += 22 * k;
  }
  return s;
}
function pinFlag(x, y, it, k = 1) {
  const col = { attack: '#c33427', pull: '#e2b23a', stress: '#2f6fb3' }[it.kind];
  return `<g transform="translate(${x} ${y}) scale(${k})"><circle r="5" fill="#d8c8a0" stroke="#3a2a1a"/>
    <path d="M0 0 L0 -40" stroke="#3a2a1a" stroke-width="2"/><path d="M0 -40 L52 -32 L0 -22 Z" fill="${col}" stroke="#1a1712"/>
    ${icon(it.kind, { x: 9, y: -31, s: 0.6, c: '#fff' })}<text x="18" y="-26" font-size="14" font-weight="700" fill="#fff">${it.num}</text></g>`;
}
function thread(x1, y1, x2, y2, color, bend = 40, dashed = false) {
  return `<path d="M${x1} ${y1} Q${(x1 + x2) / 2} ${Math.min(y1, y2) - bend} ${x2} ${y2}" stroke="${color}" stroke-width="2.6" fill="none" ${dashed ? 'stroke-dasharray="3 5"' : ''} opacity=".9"/>`;
}
function plate(x, y, r) {
  return `<g><circle cx="${x + 3}" cy="${y + 5}" r="${r + 2}" fill="rgba(0,0,0,.4)"/><circle cx="${x}" cy="${y}" r="${r}" fill="#b8923a" stroke="#5a3a10" stroke-width="2"/><circle cx="${x}" cy="${y}" r="${r * 0.72}" fill="#9a7428"/>
    <rect x="${x - r * 0.18}" y="${y - r * 0.5}" width="${r * 0.36}" height="${r}" rx="2" fill="#e8cf7c" stroke="#5a4524"/>
    <circle cx="${x + r * 0.62}" cy="${y - r * 0.62}" r="${r * 0.3}" fill="#e2b23a" stroke="#1a1712"/><text x="${x + r * 0.62}" y="${y - r * 0.5}" text-anchor="middle" font-size="${r * 0.36}" font-weight="700" fill="#111">${SCENE.gutsang.left}</text></g>`;
}
function candles(x, y, n, lit, k = 1) {
  return Array.from({ length: n }, (_, i) => `<g transform="translate(${x + i * 26 * k} ${y}) scale(${k})"><circle r="11" fill="#d8c8a0" stroke="#3a2a1a"/><circle r="6" fill="#efe6cf"/>${i < lit ? '<circle r="18" fill="url(#lampGlow)"/><circle r="3.5" fill="#ffc964"/>' : '<circle r="2" fill="#333"/>'}</g>`).join('');
}
function smallDrums(x, y, n, on, k = 1) {
  return Array.from({ length: n }, (_, i) => `<g transform="translate(${x + i * 24 * k} ${y}) scale(${k})"><circle r="10" fill="${i < on ? '#e2b23a' : '#3a3020'}" stroke="#6b5636" stroke-width="2"/><circle r="4" fill="none" stroke="${i < on ? '#8a6a1a' : '#2a2418'}"/></g>`).join('');
}

function combatDesktop() {
  const W = 1280, H = 540;
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${wood(W, H)}${mat(28, 14, 1224, 512)}`;
  s += `<rect x="60" y="232" width="1160" height="70" fill="${HANJI}" opacity=".3"/><text x="66" y="448" font-size="12" fill="#efe6cf" opacity=".8">흰 띠 = 길베: 진형이 놓이는 길 (오른쪽이 원귀 쪽)</text>`;
  const tx = { posu: 150, manshin: 300, seungnyeo: 450 };
  const ex = [735, 900, 1065];
  // 실(대상)
  SCENE.enemies.forEach((e, i) => {
    const t = e.intent.target;
    if (t === 'all') for (const id of Object.keys(tx)) s += thread(ex[i] - 4, 140, tx[id] + 20, 220, '#8fa0d8', 70, true);
    else s += thread(ex[i] - 4, 140, tx[t] + 30, 212, heroColor(t), 60);
  });
  for (const h of SCENE.party) {
    const x = tx[h.id];
    s += token(h.id, x, 267, 52, h);
    s += `<text x="${x}" y="350" text-anchor="middle" font-size="12" fill="#efe6cf">${h.slot}</text>
      <text x="${x}" y="374" text-anchor="middle" font-size="24" class="brush" fill="${heroColor(h.id)}">${heroName(h.id)}</text>
      <text x="${x}" y="394" text-anchor="middle" font-size="12.5" fill="#efe6cf">${h.hp[0]}/${h.hp[1]}${h.pred ? ` <tspan fill="#ff8a6d">−${h.pred.dmg}</tspan>` : ''}</text>
      <g>${Array.from({ length: Math.min(5, h.resVal[1]) }, (_, i) => `<circle cx="${x - 24 + i * 12}" cy="196" r="4.5" fill="${i < h.resVal[0] ? heroColor(h.id) : 'none'}" stroke="${heroColor(h.id)}"/>`).join('')}</g>
      <text x="${x}" y="186" text-anchor="middle" font-size="11.5" fill="#efe6cf">${h.res}</text>`;
  }
  s += plate(565, 267, 38) + `<text x="565" y="330" text-anchor="middle" font-size="12.5" fill="#e2b23a">굿상 · ${SCENE.gutsang.name}</text>`;
  SCENE.enemies.forEach((e, i) => {
    s += slip(e, ex[i], 267, 118, 170, [-3, 2, -1][i]);
    s += pinFlag(ex[i] - 4, 186, e.intent);
    s += `<text x="${ex[i]}" y="378" text-anchor="middle" font-size="22" class="brush" fill="#efe6cf">${e.name}</text>`;
    s += markers(e, ex[i] - 56, 402);
    s += `<text x="${ex[i] - 56}" y="${402 + e.status.length * 22 + 2}" font-size="11.5" fill="${e.haewon.near ? '#f4ead0' : '#c9bf9f'}">${e.haewon.near ? '◆' : '◇'} 해원 ${e.haewon.rule} (${e.haewon.prog})</text>`;
  });
  s += candles(92, 470, 3, SCENE.energy[0]) + `<text x="66" y="505" font-size="12.5" fill="#ffc964">에너지 ${SCENE.energy[0]}/${SCENE.energy[1]}</text>`;
  s += smallDrums(220, 470, 5, SCENE.jangdan) + `<text x="208" y="505" font-size="12.5" fill="#e2b23a">장단 ${SCENE.jangdan}장 · 직전 <tspan fill="${heroColor(SCENE.lastOwner)}">만신</tspan></text>`;
  s += `</svg>`;
  return s;
}

function combatPhone() {
  const W = 390, H = 548;
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${wood(W, H)}${mat(8, 8, 374, 532)}`;
  s += `<rect x="168" y="232" width="54" height="300" fill="${HANJI}" opacity=".3"/>`;
  const tpos = { seungnyeo: 286, manshin: 384, posu: 482 };
  const ex = [72, 195, 318];
  SCENE.enemies.forEach((e, i) => {
    const t = e.intent.target;
    if (t !== 'all') s += `<path d="M${ex[i]} 46 C ${ex[i] - 60} 150, ${130} ${tpos[t] - 60}, ${195 - 36} ${tpos[t]}" stroke="${heroColor(t)}" stroke-width="2.4" fill="none" opacity=".9"/>`;
  });
  SCENE.enemies.forEach((e, i) => {
    s += slip(e, ex[i], 112, 92, 128, [-3, 2, -1][i]);
    s += pinFlag(ex[i], 52, e.intent, 0.85);
    s += `<text x="${ex[i]}" y="196" text-anchor="middle" font-size="12" fill="#efe6cf">${e.name}</text>`;
    s += markers(e, ex[i] - 40, 214, 0.8);
  });
  for (const h of SCENE.party) {
    const y = tpos[h.id];
    s += token(h.id, 195, y, 34, h);
    s += `<text x="140" y="${y - 6}" text-anchor="end" font-size="13.5" font-weight="700" fill="${heroColor(h.id)}">${heroName(h.id)}</text>
      <text x="140" y="${y + 12}" text-anchor="end" font-size="11.5" fill="#efe6cf">${h.slot} · ${h.hp[0]}/${h.hp[1]}${h.pred ? ` <tspan fill="#ff8a6d">−${h.pred.dmg}</tspan>` : ''}</text>
      <text x="246" y="${y + 4}" font-size="11" fill="#efe6cf">${h.res} ${h.resVal[0]}/${h.resVal[1]}</text>`;
  }
  s += plate(318, 300, 24) + `<text x="318" y="338" text-anchor="middle" font-size="11" fill="#e2b23a">굿상</text>`;
  s += `</svg>`;
  return s;
}

function combat() {
  return `<section class="screen" id="combat">
  <div class="topbar"><span class="opt">안 C</span><span class="title">${SCENE.region}</span><span class="chip hide-m">위에서 본 굿상 · 전투</span><span class="chip">턴 ${SCENE.turn}</span><span class="sp"></span><span class="chip lamp">넋등 ${SCENE.light.value} · ${SCENE.light.band}</span><span class="hide-m">${lightbarHTML()}</span></div>
  <div class="stage hide-m">${combatDesktop()}</div>
  <div class="stage hide-d">${combatPhone()}</div>
  <div class="dock">
    <div class="mrow"><div class="energy">${SCENE.energy[0]}<small>/${SCENE.energy[1]}</small></div><div>${drumsHTML()}<div class="batline" style="--hc:${heroColor(SCENE.lastOwner)};margin-top:4px"><span class="dot"></span>직전 ${heroName(SCENE.lastOwner)} → 「받」</div></div><span class="btn end" style="font-size:14px;padding:8px 12px">턴 종료</span></div>
    <div class="handwrap">${handHTML(SCENE.hand, { fan: false })}</div>
    <span class="btn end hide-m">턴 종료</span>
  </div>
  </section>`;
}

// ── 탐험: 펼친 지도 위의 패 ──
function mapScroll(W, H, { phone = false } = {}) {
  const pad = phone ? 18 : 120;
  const mx = pad, my = phone ? 16 : 40, mw = W - pad * 2, mh = H - (phone ? 32 : 80);
  const cols = 6, rows = 3;
  const cell = (c, r) => phone
    ? [mx + mw * ((r + 0.5) / rows), my + mh * ((c + 0.5) / cols)]
    : [mx + mw * ((c + 0.5) / cols), my + mh * ((r + 0.5) / rows)];
  const rooms = [[0, 1, 'v'], [1, 1, 'v'], [1, 0, 'v'], [2, 1, 'c'], [3, 1, '?'], [3, 2, '?'], [4, 1, '?'], [2, 2, '?'], [5, 1, 'b'], [4, 0, '?']];
  const links = [[0, 1, 1, 1], [1, 1, 1, 0], [1, 1, 2, 1], [2, 1, 3, 1], [3, 1, 4, 1], [3, 1, 3, 2], [2, 1, 2, 2], [4, 1, 5, 1], [4, 1, 4, 0]];
  const [p1x, p1y] = cell(1, 1), [p2x, p2y] = cell(2, 1);
  const px = p1x + (p2x - p1x) * 0.28, py = p1y + (p2y - p1y) * 0.28;
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${wood(W, H)}
    <defs><radialGradient id="fogC${phone ? 'm' : 'd'}" cx="${(px / W) * 100}%" cy="${(py / H) * 100}%" r="${phone ? 55 : 32}%"><stop offset=".45" stop-color="#05060a" stop-opacity="0"/><stop offset="1" stop-color="#05060a" stop-opacity=".72"/></radialGradient></defs>
    <rect x="${mx + 4}" y="${my + 8}" width="${mw}" height="${mh}" fill="rgba(0,0,0,.45)"/>
    <rect x="${mx}" y="${my}" width="${mw}" height="${mh}" fill="#e9dfc2"/><rect x="${mx}" y="${my}" width="${mw}" height="${mh}" fill="url(#hanjiFiber)"/>
    ${phone ? `<rect x="${mx - 6}" y="${my - 10}" width="${mw + 12}" height="14" rx="7" fill="#8a5a36"/><rect x="${mx - 6}" y="${my + mh - 4}" width="${mw + 12}" height="14" rx="7" fill="#8a5a36"/>`
      : `<rect x="${mx - 14}" y="${my - 8}" width="20" height="${mh + 16}" rx="9" fill="#8a5a36"/><rect x="${mx + mw - 6}" y="${my - 8}" width="20" height="${mh + 16}" rx="9" fill="#8a5a36"/>`}`;
  for (const [a, b, c, d] of links) {
    const [x1, y1] = cell(a, b), [x2, y2] = cell(c, d);
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#2a2018" stroke-width="${phone ? 2 : 3}" stroke-dasharray="${phone ? '2 7' : '3 12'}" stroke-linecap="round"/>`;
  }
  const sz = phone ? 36 : 64;
  for (const [c, r, k] of rooms) {
    const [x, y] = cell(c, r);
    s += `<rect x="${x - sz / 2}" y="${y - sz / 2}" width="${sz}" height="${sz}" fill="${k === 'v' ? 'rgba(80,90,130,.25)' : 'none'}" stroke="${k === 'b' ? '#a3241a' : '#2a2018'}" stroke-width="${phone ? 2 : 3}" transform="rotate(${(c * 7 + r * 3) % 5 - 2} ${x} ${y})"/>`;
    if (k === '?') s += `<text x="${x}" y="${y + sz * 0.18}" text-anchor="middle" font-size="${sz * 0.5}" fill="#6a5a40">?</text>`;
    if (k === 'b') s += `<rect x="${x - sz * 0.32}" y="${y - sz * 0.32}" width="${sz * 0.64}" height="${sz * 0.64}" fill="#c33427"/><text x="${x}" y="${y + sz * 0.17}" text-anchor="middle" font-size="${sz * 0.46}" fill="#fff3d8">恨</text>`;
    if (k === 'c') s += `<g transform="translate(${x} ${y + sz * 0.3}) scale(${sz / 150})"><ellipse cx="0" cy="-10" rx="30" ry="16" fill="#8a8272" stroke="#1a1712"/><ellipse cx="0" cy="-30" rx="20" ry="12" fill="#9a9282" stroke="#1a1712"/><path d="M6 -36 L12 -96" stroke="#4a3a2a" stroke-width="4"/>${['#c33427', '#2f86a6', '#e2b23a'].map((cc, i) => `<path d="M10 ${-90 + i * 14} q16 6 12 22" stroke="${cc}" stroke-width="7" fill="none"/>`).join('')}</g>`;
  }
  s += `<rect x="${mx}" y="${my}" width="${mw}" height="${mh}" fill="url(#fogC${phone ? 'm' : 'd'})"/>`;
  // 파티 패 + 촛불
  const r = phone ? 14 : 22;
  s += `<circle cx="${px}" cy="${py}" r="${r * 4}" fill="url(#lampGlow)"/>
    <circle cx="${px + 3}" cy="${py + 4}" r="${r + 2}" fill="rgba(0,0,0,.4)"/><circle cx="${px}" cy="${py}" r="${r}" fill="#3a2a1a" stroke="#c9a85a" stroke-width="2"/>
    ${['seungnyeo', 'manshin', 'posu'].map((id, i) => `<circle cx="${px - r * 0.45 + i * r * 0.45}" cy="${py}" r="${r * 0.28}" fill="${heroColor(id)}"/>`).join('')}
    <g transform="translate(${px + r * 1.8} ${py - r * 1.2})">${candles(0, 0, 1, 1, phone ? 0.7 : 1)}</g>`;
  s += `</svg>`;
  return s;
}
function explore() {
  return `<section class="screen" id="explore">
  <div class="topbar"><span class="opt">안 C</span><span class="title">저승길 지도</span><span class="chip hide-m">펼친 지도 위의 파티 패 · 촛불 빛이 닿는 만큼 보인다</span><span class="sp"></span><span class="chip lamp">넋등 61 · 흐림</span><span class="hide-m">${lightbarHTML()}</span></div>
  <div class="stage hide-m">${mapScroll(1280, 600)}</div>
  <div class="stage hide-d">${mapScroll(390, 520, { phone: true })}</div>
  <div class="dock" style="justify-content:flex-start;align-items:flex-start">
    <div class="panel" style="flex:1;align-self:flex-start"><h3>서낭당 돌무더기</h3><div class="lbl">다음 방 · 기물 — 맨손 / 향 1 / 만신 신탁. 탐험은 이 지도 한 장으로 끝난다(길목 장면 없음).</div></div>
    <div class="panel" style="flex:1"><div class="lbl" style="line-height:1.8">촛불 6 · 쌀 4 · 향 2 · 지전 2 · 부적 1 · 술 2<br>새 칸 −6 · 지나온 칸 −1</div></div>
  </div>
  </section>`;
}

export function pageC() {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>저승굿 표현안 C</title>
${FONT_LINKS}
<style>${BASE_CSS}${CSS}</style></head><body>
${globalDefs()}
${switchNav([['combat', '전투'], ['explore', '탐험']])}
${combat()}${explore()}
</body></html>`;
}
