// 안 A — 2D 측면 종이 무대: 꼭두풍 영웅 × 넋전풍 원귀, 한지 겹 배경, DD식 측면 길목
import { defs, hero, spirit, soulOver, icon, HERO, HANJI } from './figures.mjs';
import {
  SCENE, BASE_CSS, FONT_LINKS, handHTML, drumsHTML, lightbarHTML, switchNav,
  svgBar, statusChips, intentBadge, arc, heroColor, heroName,
} from './common.mjs';

const CSS = `
.stage{flex:none;position:relative;line-height:0}
.stage svg{display:block;width:100%;height:auto}
.dock{flex:1;display:grid;grid-template-columns:270px 1fr 190px;gap:14px;padding:10px 16px 12px;align-items:center;min-height:0}
.dock .left{display:flex;flex-direction:column;gap:9px}
.dock .row{display:flex;align-items:center;gap:10px}
.dock .right{display:flex;flex-direction:column;gap:8px;align-items:stretch}
.lbl{font-size:12px;color:var(--text-dim)}
.lbl b{color:var(--lamp);font-weight:400;font-family:var(--font-brush);font-size:22px}
.edetail{display:none}
.panel{border:1px solid var(--line);background:rgba(21,26,42,.75);border-radius:3px;padding:8px 10px}
.panel h3{margin:0 0 6px;font-family:var(--font-brush);font-weight:400;font-size:22px;color:var(--paper)}
.sup{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.sup div{border:1px solid var(--line);padding:4px 6px;font-size:12px;color:var(--text-dim)}
.sup b{display:block;font-size:17px;color:var(--text)}
.opts{display:flex;flex-direction:column;gap:5px;margin-top:6px}
.opts .btn{text-align:left}
.xgrid{flex:1;display:grid;grid-template-columns:540px 1fr;gap:14px;padding:10px 16px 12px;min-height:0}
.vgrid{flex:1;display:grid;grid-template-columns:430px 1fr;gap:14px;padding:10px 16px 12px;min-height:0}
.fac{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.fac div{border:1px solid var(--line);padding:6px 8px;font-size:12px;color:var(--text-dim);background:rgba(28,35,56,.6)}
.fac div b{display:block;color:var(--text);font-size:14px}
.fac div.lock{opacity:.55;border-style:dashed}
.gauge{display:flex;gap:2px}.gauge i{width:14px;height:14px;border:1px solid #6b4a5a;display:block}.gauge i.on{background:#a0466a}
.scroller{overflow:hidden}
.mgrid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;padding:10px 16px;flex:1;min-height:0}
.mgrid figure{margin:0;border:1px solid var(--line);background:rgba(21,26,42,.7);display:flex;flex-direction:column}
.mgrid figure svg{display:block;width:100%;height:auto}
.mgrid figcaption{padding:6px 8px;font-size:12px;color:var(--text-dim);line-height:1.45}
.mgrid figcaption b{display:block;font-family:var(--font-brush);font-weight:400;font-size:22px;color:var(--paper)}
.mgrid code{font-size:11px;color:var(--lamp)}
@media (max-width:600px){
  .dock{grid-template-columns:1fr;gap:6px;padding:6px 12px 8px;align-content:start}
  .dock .left{flex-direction:row;align-items:center;justify-content:space-between;gap:6px}
  .dock .right{display:none}
  .edetail{display:block;padding:4px 12px 0;font-size:11.5px;line-height:1.5;color:var(--text-dim)}
  .edetail div{display:flex;gap:6px;border-bottom:1px solid var(--line);padding:2px 0}
  .edetail b{color:var(--text);font-weight:400;min-width:74px}
  .handwrap{overflow-x:auto;padding:6px 0 4px}
  .handwrap .hand{justify-content:flex-start;gap:8px;width:max-content;padding:0 2px}
  .endrow{display:flex;gap:6px;align-items:center;justify-content:space-between}
  .lbl b{font-size:18px}
  .xgrid,.vgrid{grid-template-columns:1fr;gap:8px;padding:8px 12px;align-content:start}
  .sup{grid-template-columns:repeat(6,1fr);gap:3px}
  .sup div{padding:2px 3px;font-size:10.5px;text-align:center}
  .sup b{font-size:14px}
  .fac{grid-template-columns:repeat(2,1fr);gap:6px}
  .scroller{overflow-x:auto}
  .scroller svg{width:820px!important;max-width:none}
  .mgrid{grid-template-columns:1fr 1fr;padding:8px 12px;gap:8px;overflow:hidden}
  .mgrid figcaption{font-size:11px;padding:4px 6px}
  .mgrid figcaption b{font-size:18px}
  .mgrid figure.wide{grid-column:span 2}
}
`;

// ── 배경 ──
function nightRiver(W, H, { floorY, light = 0.55, lampX = 330 }) {
  return `<defs>
    <linearGradient id="skyA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2442"/><stop offset=".6" stop-color="#141a2c"/><stop offset="1" stop-color="#0e111c"/></linearGradient>
    <radialGradient id="vig" cx="${(lampX / W) * 100}%" cy="70%" r="75%"><stop offset=".35" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${0.35 + (1 - light) * 0.5}"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#skyA)"/>
  <path d="M0 ${floorY - 120} Q${W * 0.15} ${floorY - 190} ${W * 0.3} ${floorY - 140} T${W * 0.62} ${floorY - 150} T${W} ${floorY - 175} V${floorY} H0 Z" fill="#1c2540" opacity=".9"/>
  <path d="M0 ${floorY - 80} Q${W * 0.2} ${floorY - 120} ${W * 0.42} ${floorY - 90} T${W * 0.8} ${floorY - 100} T${W} ${floorY - 85} V${floorY} H0 Z" fill="#222c48"/>
  <path d="M0 ${floorY - 80} Q${W * 0.2} ${floorY - 120} ${W * 0.42} ${floorY - 90} T${W * 0.8} ${floorY - 100} T${W} ${floorY - 85} V${floorY} H0 Z" fill="url(#hanjiFiber)" opacity=".5"/>
  <rect x="0" y="${floorY - 52}" width="${W}" height="40" fill="#1d3850" opacity=".85"/>
  ${Array.from({ length: Math.round(W / 60) }, (_, i) => `<path d="M${i * 60 + 10} ${floorY - 34} h${26 + (i % 3) * 8}" stroke="#4f7a96" stroke-width="1.2" opacity=".55"/>`).join('')}
  ${Array.from({ length: Math.round(W / 34) }, (_, i) => `<path d="M${i * 34 + 6} ${floorY - 6} q${4 - (i % 3) * 3} -${26 + (i % 4) * 8} ${(i % 2 ? 6 : -4)} -${44 + (i % 5) * 6}" stroke="#2c3a2a" stroke-width="2" fill="none" opacity=".8"/>`).join('')}
  <rect x="0" y="${floorY - 12}" width="${W}" height="${H - floorY + 12}" fill="#231e16"/>
  <path d="M0 ${floorY + 4} L${W} ${floorY - 2} L${W} ${floorY + 24} L0 ${floorY + 30} Z" fill="${HANJI}" opacity=".22"/>
  <ellipse cx="${lampX}" cy="${floorY - 70}" rx="${W * 0.36}" ry="${H * 0.62}" fill="url(#lampGlow)" opacity="${light}"/>`;
}

function geumjul(W, y) {
  const strips = Array.from({ length: Math.floor(W / 46) }, (_, i) => {
    const x = 20 + i * 46;
    return `<path d="M${x} ${y + 3} l5 9 l-5 6 l5 9" stroke="${HANJI}" stroke-width="3" fill="none" opacity=".75"/>`;
  }).join('');
  return `<path d="M0 ${y} Q${W / 2} ${y + 14} ${W} ${y}" stroke="#a08a5a" stroke-width="4" fill="none"/>${strips}`;
}

function gutsangTable(x, y, s = 1, { label = true } = {}) {
  const g = SCENE.gutsang;
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="2" rx="46" ry="6" fill="rgba(0,0,0,.35)"/>
    <rect x="-40" y="-30" width="80" height="10" fill="#7a3a22" stroke="#1a1712" stroke-width="1.5"/>
    <path d="M-34 -20 L-36 0 M34 -20 L36 0" stroke="#5a2a18" stroke-width="5"/>
    <circle cx="0" cy="-66" r="38" fill="url(#lampGlow)"/>
    <rect x="-9" y="-74" width="18" height="44" rx="3" fill="#e8cf7c" stroke="#5a4524" stroke-width="1.4"/>
    <path d="M-4 -66 h8 M-4 -58 h8 M-4 -50 h8" stroke="#5a4524" stroke-width="1.3"/>
    <rect x="-30" y="-44" width="6" height="14" fill="#efe6cf"/><path d="M-27 -44 q-3 -6 0 -10 q3 4 0 10" fill="#ffc964"/>
    <rect x="24" y="-44" width="6" height="14" fill="#efe6cf"/><path d="M27 -44 q-3 -6 0 -10 q3 4 0 10" fill="#ffc964"/>
    ${label ? `<text x="0" y="22" text-anchor="middle" font-size="13" fill="#e2b23a">굿상 · ${g.name}</text><text x="0" y="39" text-anchor="middle" font-size="11.5" fill="#b0a78f">${g.text} · ${g.left}턴</text>` : `<circle cx="22" cy="-80" r="9" fill="#e2b23a"/><text x="22" y="-76" text-anchor="middle" font-size="11" font-weight="700" fill="#111">${g.left}</text>`}
  </g>`;
}

// ── 전투 (데스크톱) ──
function combatStageDesktop() {
  const W = 1280, H = 440, FY = 345;
  const heroX = { posu: 118, manshin: 254, seungnyeo: 392 };
  const enemyX = [722, 884, 1062];
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${defs()}${nightRiver(W, H, { floorY: FY + 8, light: 0.6, lampX: 300 })}${geumjul(W, 14)}`;
  // 굿상
  s += gutsangTable(510, FY, 1);
  // 영웅
  for (const h of SCENE.party) {
    const x = heroX[h.id];
    s += hero(h.id, { x, y: FY, scale: 1.12 });
    // 귀기 +4 예고(곡소리 넋 — 전체)
    s += `<g transform="translate(${x + 26} ${FY - 176})"><rect x="-26" y="-11" width="52" height="19" rx="3" fill="rgba(40,30,60,.85)" stroke="#b9b0d2" stroke-opacity=".6"/>${icon('stress', { x: -15, y: -2, s: 0.8, c: '#b9b0d2' })}<text x="-3" y="3" font-size="11.5" fill="#d8d0ee">+4</text></g>`;
    // 이름표
    const c = heroColor(h.id);
    s += `<text x="${x}" y="${FY + 30}" text-anchor="middle" font-size="12" fill="#b0a78f">${h.slot}</text>
      <text x="${x}" y="${FY + 52}" text-anchor="middle" font-size="25" class="brush" fill="${c}">${heroName(h.id)}</text>
      ${svgBar(x - 55, FY + 60, 110, 10, h.hp, { block: h.block, pred: h.pred?.dmg ?? 0 })}
      <text x="${x}" y="${FY + 85}" text-anchor="middle" font-size="12" fill="#ebe3cc">${h.hp[0]}/${h.hp[1]} · ${h.res} ${'◆'.repeat(h.resVal[0])}${'◇'.repeat(Math.max(0, Math.min(5, h.resVal[1]) - h.resVal[0]))}</text>`;
    if (h.pred) s += `<g transform="translate(${x + 58} ${FY + 64})"><rect x="0" y="-9" width="30" height="18" rx="3" fill="#c33427"/><text x="15" y="4.5" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">−${h.pred.dmg}</text></g>`;
  }
  // 원귀
  SCENE.enemies.forEach((e, i) => {
    const x = enemyX[i];
    s += spirit(e.family, { x, y: FY, scale: e.scale });
    s += `<text x="${x}" y="${FY + 30}" text-anchor="middle" font-size="25" class="brush" fill="#ebe3cc">${e.name}</text>
      ${svgBar(x - 65, FY + 38, 130, 10, e.hp, { mobu: e.mobu ?? 0, color: '#c0504a' })}
      <text x="${x + 72}" y="${FY + 47}" font-size="11.5" fill="#ebe3cc">${e.hp[0]}/${e.hp[1]}</text>
      ${statusChips(e.status, x - 65, FY + 66)}
      <text x="${x - 65}" y="${FY + 92}" font-size="12" fill="${e.haewon.near ? '#f4ead0' : '#b0a78f'}">${e.haewon.near ? '◆ ' : '◇ '}해원 · ${e.haewon.rule} (${e.haewon.prog})</text>`;
    // 의도
    const by = 46 + (i === 1 ? 0 : 0);
    s += intentBadge(e, x, by);
    const t = e.intent.target;
    if (t !== 'all') {
      const hx = heroX[t];
      s += arc(x - 80, by + 2, hx + 6, FY - 168, heroColor(t), { lift: 30 });
    } else {
      s += `<path d="M${x - 80} ${by + 4} Q 700 30 ${heroX.seungnyeo + 40} ${FY - 196}" stroke="#b9b0d2" stroke-width="1.8" stroke-dasharray="3 5" fill="none" opacity=".7"/>`;
    }
  });
  s += `<rect width="${W}" height="${H}" fill="url(#vig)"/></svg>`;
  return s;
}

// ── 전투 (폰) ──
function combatStagePhone() {
  const W = 390, H = 318, FY = 238;
  const heroX = { posu: 40, manshin: 98, seungnyeo: 156 };
  const enemyX = [248, 306, 362];
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${defs()}${nightRiver(W, H, { floorY: FY + 6, light: 0.6, lampX: 110 })}${geumjul(W, 6)}`;
  s += gutsangTable(204, FY, 0.52, { label: false });
  for (const h of SCENE.party) {
    const x = heroX[h.id];
    s += hero(h.id, { x, y: FY, scale: 0.62 });
    const c = heroColor(h.id);
    s += `<text x="${x}" y="${FY + 18}" text-anchor="middle" font-size="12" font-weight="700" fill="${c}">${heroName(h.id)}</text>
      ${svgBar(x - 25, FY + 25, 50, 7, h.hp, { pred: h.pred?.dmg ?? 0 })}
      <text x="${x}" y="${FY + 46}" text-anchor="middle" font-size="11" fill="#ebe3cc">${h.hp[0]}${h.block ? ` ⛉${h.block}` : ''}${h.pred ? ` <tspan fill="#ff8a6d">−${h.pred.dmg}</tspan>` : ''}</text>
      <text x="${x}" y="${FY + 62}" text-anchor="middle" font-size="10.5" fill="#b0a78f">${h.slot}</text>`;
  }
  SCENE.enemies.forEach((e, i) => {
    const x = enemyX[i];
    s += spirit(e.family, { x, y: FY, scale: e.scale * 0.55 });
    s += `${svgBar(x - 24, FY + 12, 48, 7, e.hp, { mobu: e.mobu ?? 0, color: '#c0504a' })}
      <text x="${x}" y="${FY + 33}" text-anchor="middle" font-size="11" fill="#ebe3cc">${e.hp[0]}/${e.hp[1]}</text>
      ${statusChips(e.status, x - 27, FY + 52, { compact: true })}`;
    const by = 52;
    s += intentBadge(e, x, by, { compact: true });
    const t = e.intent.target;
    if (t !== 'all') s += arc(x - 26, by + 4, heroX[t] + 4, FY - 98, heroColor(t), { lift: 16, w: 1.6 });
  });
  s += `<rect width="${W}" height="${H}" fill="url(#vig)"/></svg>`;
  return s;
}

function combat() {
  const prev = SCENE.lastOwner;
  return `<section class="screen" id="combat">
  <div class="topbar"><span class="opt">안 A</span><span class="title">${SCENE.region}</span><span class="chip hide-m">2D 측면 종이 무대 · 전투</span><span class="chip">턴 ${SCENE.turn}</span><span class="sp"></span>
    <span class="chip lamp">넋등 ${SCENE.light.value} · ${SCENE.light.band}</span><span class="hide-m">${lightbarHTML()}</span><span class="btn hide-m">기록</span><span class="btn hide-m">용어</span></div>
  <div class="stage hide-m">${combatStageDesktop()}</div>
  <div class="stage hide-d">${combatStagePhone()}</div>
  <div class="edetail">${SCENE.enemies.map((e) => `<div><b>${e.name}</b><span>${e.intent.label} ${e.intent.num} → ${e.intent.targetText}</span></div>`).join('')}
    <div><b>해원</b><span>물귀신 넋흔들림 4+ <span style="color:var(--haewon)">◆3/4</span> · 젖은 넋 넋흔들림 2+ · 곡소리 명부 5+ (3/5)</span></div></div>
  <div class="dock">
    <div class="left">
      <div class="row"><div class="energy">${SCENE.energy[0]}<small>/${SCENE.energy[1]}</small></div>
        <div><div class="lbl">장단 <b>${SCENE.jangdan}장</b></div>${drumsHTML()}</div></div>
      <div class="batline" style="--hc:${heroColor(prev)}"><span class="dot"></span>직전 카드 <b style="color:${heroColor(prev)};font-weight:400">${heroName(prev)} · ${SCENE.lastCard}</b> → 다른 영웅 카드에 「받」</div>
      <div class="row hide-m"><span class="chip">뽑을 7</span><span class="chip">버린 3</span><span class="chip">소멸 0</span></div>
      <div class="endrow hide-d"><span class="btn end" style="font-size:14px;padding:8px 12px">턴 종료</span></div>
    </div>
    <div class="handwrap">${handHTML(SCENE.hand, { fan: true })}</div>
    <div class="right"><span class="btn end">턴 종료</span><span class="btn">촛불 6 · 넋등 +25</span><span class="btn">도주 70%</span></div>
  </div>
  <div class="note">러프 그래픽: 영웅 = 꼭두풍 채색 목인, 원귀 = 넋전풍 한지 오림. 의도 → 대상 칸을 점선으로 잇고, 예상 피해를 체력 막대에 붉게 겹친다.</div>
  </section>`;
}

// ── 탐험: DD식 측면 길목 ──
function cairn(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="0" rx="58" ry="9" fill="rgba(0,0,0,.4)"/>
    <ellipse cx="-20" cy="-10" rx="22" ry="13" fill="#5a5448" stroke="#1a1712"/><ellipse cx="18" cy="-12" rx="24" ry="14" fill="#666052" stroke="#1a1712"/>
    <ellipse cx="0" cy="-30" rx="22" ry="13" fill="#6e685a" stroke="#1a1712"/><ellipse cx="-4" cy="-48" rx="15" ry="10" fill="#7a7466" stroke="#1a1712"/>
    <path d="M6 -50 L14 -120" stroke="#4a3a2a" stroke-width="3"/>
    ${['#c33427', '#2f86a6', '#e2b23a', '#ece6d6', '#3a3a44'].map((c, i) => `<path d="M${9 + i * 1.2} ${-110 + i * 11} q14 6 10 22" stroke="${c}" stroke-width="5" fill="none"/>`).join('')}
  </g>`;
}
function gate(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <rect x="-70" y="-190" width="10" height="190" fill="#4a2a1a"/><rect x="60" y="-190" width="10" height="190" fill="#4a2a1a"/>
    <rect x="-84" y="-196" width="168" height="10" fill="#5a3020"/>
    <path d="M-70 -170 Q0 -150 70 -170" stroke="#a08a5a" stroke-width="3" fill="none"/>
    ${Array.from({ length: 6 }, (_, i) => `<path d="M${-56 + i * 22} -164 l4 8 l-4 6 l4 8" stroke="${HANJI}" stroke-width="2.4" fill="none" opacity=".7"/>`).join('')}
  </g>`;
}
function corridorScene(W, H, { phone = false } = {}) {
  const FY = phone ? 196 : 352;
  const sc = phone ? 0.56 : 1.02;
  const tiles = phone ? [[14, 128], [134, 248], [254, 368]] : [[150, 470], [490, 810], [830, 1060]];
  const party = phone ? { posu: 30, manshin: 66, seungnyeo: 104 } : { posu: 200, manshin: 312, seungnyeo: 424 };
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${defs()}${nightRiver(W, H, { floorY: FY + 8, light: 0.85, lampX: phone ? 70 : 320 })}
    <defs><linearGradient id="dark" x1="0" x2="1"><stop offset="${phone ? 0.36 : 0.42}" stop-color="#05060a" stop-opacity="0"/><stop offset="${phone ? 0.72 : 0.78}" stop-color="#05060a" stop-opacity=".78"/><stop offset="1" stop-color="#05060a" stop-opacity=".92"/></linearGradient></defs>`;
  tiles.forEach(([a, b], i) => {
    s += `<path d="M${a} ${FY + 12} L${b} ${FY + 10} L${b - 6} ${FY + 30} L${a - 6} ${FY + 32} Z" fill="${i === 0 ? '#5a4a30' : '#3a3022'}" stroke="#1a1712" stroke-width="1.5"/>
      <text x="${(a + b) / 2}" y="${FY + 27}" text-anchor="middle" font-size="${phone ? 10 : 12}" fill="${i === 0 ? '#ffc964' : '#9a8f78'}">길목 ${i + 1}/3${i === 0 ? ' · 지금' : ''}</text>`;
  });
  s += cairn(phone ? 190 : 650, FY + 4, phone ? 0.55 : 1);
  s += `<text x="${phone ? 190 : 650}" y="${phone ? FY - 76 : FY - 136}" text-anchor="middle" font-size="${phone ? 11 : 14}" fill="#ebe3cc">기물 · 서낭당 돌무더기</text>`;
  s += `<g opacity=".7"><circle cx="${phone ? 310 : 945}" cy="${FY - (phone ? 30 : 60)}" r="${phone ? 13 : 22}" fill="none" stroke="#7d7765" stroke-width="2" stroke-dasharray="4 4"/><text x="${phone ? 310 : 945}" y="${FY - (phone ? 25 : 52)}" text-anchor="middle" font-size="${phone ? 14 : 22}" fill="#7d7765">?</text></g>`;
  s += gate(phone ? 372 : 1170, FY + 6, phone ? 0.5 : 1);
  s += `<rect width="${W}" height="${H}" fill="url(#dark)"/>`;
  s += `<text x="${phone ? 372 : 1170}" y="${phone ? FY - 104 : FY - 206}" text-anchor="middle" font-size="${phone ? 10.5 : 13}" fill="#b0a78f">다음 방 · 미답</text>`;
  for (const [id, x] of Object.entries(party)) s += hero(id, { x, y: FY + 4, scale: sc });
  const lx = phone ? 82 : 360, ly = phone ? 58 : 108;
  s += `<g transform="translate(${lx} ${ly}) scale(${phone ? 0.6 : 1})"><circle r="70" fill="url(#lampGlow)"/><path d="M0 -40 L0 -24" stroke="#a08a5a" stroke-width="2"/><ellipse cx="0" cy="0" rx="16" ry="22" fill="#ffe2a0" stroke="#a06a2a" stroke-width="2"/><path d="M-16 0 h32 M-14 -10 h28 M-14 10 h28" stroke="#c9873a" stroke-width="1"/><text x="26" y="6" font-size="15" fill="#ffc964">넋등 61</text></g>`;
  s += `</svg>`;
  return s;
}
function miniMap(W, H) {
  const cell = W / 6;
  const rooms = [[0, 1, 'v'], [1, 1, 'v'], [1, 0, 'v'], [2, 1, 'c'], [3, 1, '?'], [3, 2, '?'], [4, 1, '?'], [2, 2, '?'], [5, 1, 'b'], [4, 0, '?']];
  const links = [[0, 1, 1, 1], [1, 1, 1, 0], [1, 1, 2, 1], [2, 1, 3, 1], [3, 1, 4, 1], [3, 1, 3, 2], [2, 1, 2, 2], [4, 1, 5, 1], [4, 1, 4, 0]];
  const px = (c) => cell * c + cell / 2, py = (r) => (H / 3) * r + H / 6;
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${defs()}<rect width="${W}" height="${H}" fill="#121625"/>`;
  s += `<ellipse cx="${px(1.6)}" cy="${py(1)}" rx="${cell * 1.8}" ry="${H * 0.42}" fill="url(#lampGlow)" opacity=".6"/>`;
  for (const [a, b, c, d] of links) {
    const x1 = px(a), y1 = py(b), x2 = px(c), y2 = py(d);
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#3a3a4a" stroke-width="8"/>`;
    for (let k = 1; k <= 3; k++) {
      const t = k / 4;
      const cx = x1 + (x2 - x1) * t, cy = y1 + (y2 - y1) * t;
      const cur = a === 1 && b === 1 && c === 2 && k === 1;
      s += `<rect x="${cx - 5}" y="${cy - 5}" width="10" height="10" fill="${cur ? '#ffc964' : a < 2 || (a === 1 && c === 2) ? '#6b5a3a' : '#2a2a36'}" stroke="#0e111c"/>`;
    }
  }
  for (const [c, r, k] of rooms) {
    const x = px(c), y = py(r), sz = Math.min(cell, H / 3) * 0.5;
    const fill = k === 'v' ? '#3a4466' : k === 'b' ? '#4a1a1a' : k === 'c' ? '#5a4a30' : '#1c2030';
    s += `<rect x="${x - sz / 2}" y="${y - sz / 2}" width="${sz}" height="${sz}" fill="${fill}" stroke="${k === 'b' ? '#e2573f' : '#5a5a6a'}" stroke-width="2"/>`;
    s += `<text x="${x}" y="${y + 6}" text-anchor="middle" font-size="${sz * 0.45}" fill="${k === 'b' ? '#e2573f' : '#9a90a0'}">${k === '?' ? '?' : k === 'b' ? '恨' : k === 'c' ? '◆' : ''}</text>`;
  }
  s += `</svg>`;
  return s;
}
function explore() {
  return `<section class="screen" id="explore">
  <div class="topbar"><span class="opt">안 A</span><span class="title">저승길 · 길목</span><span class="chip hide-m">DD식 측면 길목 + 방 지도</span><span class="sp"></span><span class="chip lamp">넋등 61 · 흐림</span><span class="hide-m">${lightbarHTML()}</span><span class="chip hide-m">새 칸 −6 · 지나온 칸 −1</span></div>
  <div class="stage hide-m">${corridorScene(1280, 430)}</div>
  <div class="stage hide-d">${corridorScene(390, 250, { phone: true })}</div>
  <div class="xgrid">
    <div class="panel" style="padding:6px"><div class="lbl" style="margin:0 0 4px 4px">방 지도 — 밝힌 곳만 보인다 · 恨 = 보스 굴</div>${miniMap(520, 250).replace('<svg', '<svg style="width:100%;height:auto;display:block"')}</div>
    <div style="display:flex;flex-direction:column;gap:8px;min-width:0">
      <div class="panel"><h3>서낭당 돌무더기</h3><div class="lbl">세 갈래로 손댄다 — 보급품·영웅에 따라 결과가 달라진다</div>
        <div class="opts"><span class="btn">맨손 — 좋은 일과 나쁜 일이 섞인다</span><span class="btn">향 1 — 정찰: 이웃 방 둘을 밝힌다</span><span class="btn" style="border-color:${heroColor('manshin')}">만신 · 신탁 — 다음 방 둘의 정체</span></div></div>
      <div class="panel hide-m"><div class="sup"><div>촛불<b>6</b></div><div>쌀<b>4</b></div><div>향<b>2</b></div><div>지전<b>2</b></div><div>부적<b>1</b></div><div>술<b>2</b></div></div></div>
      <div class="sup hide-d"><div>촛불<b>6</b></div><div>쌀<b>4</b></div><div>향<b>2</b></div><div>지전<b>2</b></div><div>부적<b>1</b></div><div>술<b>2</b></div></div>
    </div>
  </div>
  <div class="note">파티가 길목을 걸으면 배경이 겹겹이 흐른다(패럴랙스). 넋등 빛 반경이 줄면 앞쪽 어둠이 짙어진다. 방에 들어서면 같은 무대가 전투 무대가 된다.</div>
  </section>`;
}

// ── 마을 ──
function hanok(x, y, w, h, { label, sub, state = 'built', s = 1, extra = '' }) {
  const roof = `<path d="M${-w / 2 - 22} ${-h} Q${-w / 2} ${-h - 4} ${-w / 2 + 8} ${-h - 26} L${w / 2 - 8} ${-h - 26} Q${w / 2} ${-h - 4} ${w / 2 + 22} ${-h} Q0 ${-h + 12} ${-w / 2 - 22} ${-h} Z" fill="${state === 'lock' ? 'none' : '#2e2a2e'}" stroke="${state === 'lock' ? '#7d7765' : '#141018'}" stroke-width="2" ${state === 'lock' ? 'stroke-dasharray="6 5"' : ''}/>`;
  const wall = state === 'lock'
    ? `<rect x="${-w / 2}" y="${-h}" width="${w}" height="${h}" fill="none" stroke="#7d7765" stroke-width="2" stroke-dasharray="6 5"/>`
    : `<rect x="${-w / 2}" y="${-h}" width="${w}" height="${h}" fill="${HANJI}" stroke="#3a2a1a" stroke-width="2"/><rect x="${-w / 2}" y="${-h}" width="${w}" height="${h}" fill="url(#hanjiFiber)"/>
       ${[0.25, 0.5, 0.75].map((t) => `<line x1="${-w / 2 + w * t}" y1="${-h}" x2="${-w / 2 + w * t}" y2="0" stroke="#6b4a2e" stroke-width="3"/>`).join('')}
       <rect x="${-w / 2}" y="-6" width="${w}" height="6" fill="#6b4a2e"/>`;
  const scaff = state === 'building' ? `<path d="M${-w / 2 - 10} 0 L${-w / 2 - 10} ${-h - 30} M${w / 2 + 10} 0 L${w / 2 + 10} ${-h - 30} M${-w / 2 - 10} ${-h / 2} L${w / 2 + 10} ${-h / 2} M${-w / 2 - 10} ${-h} L${w / 2 + 10} 0" stroke="#a08050" stroke-width="2.5"/>` : '';
  return `<g transform="translate(${x} ${y}) scale(${s})" opacity="${state === 'lock' ? 0.8 : 1}">${wall}${roof}${scaff}${extra}
    <rect x="-46" y="10" width="92" height="${sub ? 38 : 24}" fill="#3a2414" stroke="#1a0e08" rx="2"/>
    <text x="0" y="29" text-anchor="middle" font-size="21" class="brush" fill="${state === 'lock' ? '#9a8f78' : '#ead592'}">${label}</text>
    ${sub ? `<text x="0" y="44" text-anchor="middle" font-size="11" fill="#c9bf9f">${sub}</text>` : ''}</g>`;
}
function villagePanorama(W, H) {
  const GY = 300;
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${defs()}
    <defs><linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2442"/><stop offset=".55" stop-color="#3a3350"/><stop offset="1" stop-color="#7a5048"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#dusk)"/>
    <path d="M0 210 Q140 120 300 180 T620 150 T940 170 T${W} 140 V${GY} H0 Z" fill="#2a2c46"/>
    <path d="M0 240 Q200 190 420 230 T860 215 T${W} 225 V${GY} H0 Z" fill="#33304a"/><path d="M0 240 Q200 190 420 230 T860 215 T${W} 225 V${GY} H0 Z" fill="url(#hanjiFiber)" opacity=".6"/>
    <rect y="${GY - 4}" width="${W}" height="${H - GY + 4}" fill="#2a2418"/>
    <path d="M0 ${GY + 30} Q${W / 2} ${GY + 10} ${W} ${GY + 34}" stroke="${HANJI}" stroke-width="10" opacity=".18" fill="none"/>`;
  // 당산나무
  s += `<g transform="translate(80 ${GY})"><path d="M-10 0 Q-6 -80 -18 -130 M10 0 Q8 -70 22 -120" stroke="#3a2a1e" stroke-width="16" fill="none"/>
    <circle cx="-30" cy="-150" r="44" fill="#2a3a2e"/><circle cx="20" cy="-170" r="50" fill="#2e4232"/><circle cx="50" cy="-130" r="36" fill="#26362a"/>
    <path d="M-16 -50 Q0 -42 16 -50" stroke="#a08a5a" stroke-width="4" fill="none"/>${[0, 1, 2, 3].map((i) => `<path d="M${-12 + i * 8} -47 l3 7 l-3 5 l3 7" stroke="${HANJI}" stroke-width="2" fill="none"/>`).join('')}
    <text x="0" y="40" text-anchor="middle" font-size="12" fill="#c9bf9f">당산나무</text></g>`;
  s += hanok(220, GY, 120, 70, { label: '신당', sub: '2단계 · 명도 3', extra: `<g transform="translate(0 -40)">${[-24, 0, 24].map((dx) => `<circle cx="${dx}" cy="0" r="9" fill="#e2b23a" stroke="#6a4a1a"/>`).join('')}</g>` });
  s += hanok(380, GY, 100, 60, { label: '객주', sub: '2단계 · 로스터 9' });
  s += hanok(530, GY, 100, 58, { label: '주막', sub: '1단계', extra: `<g transform="translate(46 -76)"><path d="M0 0 L0 50" stroke="#4a3a2a" stroke-width="3"/><rect x="0" y="0" width="22" height="30" fill="#efe6cf" stroke="#4a3a2a"/></g>` });
  s += hanok(680, GY, 104, 62, { label: '사당', sub: '위패 3', extra: `<g transform="translate(0 -34)">${[-22, 0, 22].map((dx) => `<rect x="${dx - 6}" y="-12" width="12" height="26" rx="2" fill="#e8cf7c" stroke="#5a4524"/>`).join('')}</g>` });
  s += hanok(830, GY, 110, 52, { label: '장터', sub: '1단계' });
  s += hanok(985, GY, 100, 60, { label: '무구방', sub: '짓는 중 · 1절기', state: 'building' });
  s += hanok(1125, GY, 96, 58, { label: '전수청', sub: '2막 보스 해원 시', state: 'lock' });
  s += `<g transform="translate(1238 ${GY})">${[0, 18, 36].map((dx, i) => `<path d="M${dx - 20} 0 L${dx - 20} ${-150 + i * 18}" stroke="#4a3a2a" stroke-width="3"/><path d="M${dx - 28} ${-150 + i * 18} q8 -8 16 0 q-6 3 -16 0" fill="#3a3030"/>`).join('')}<text x="-2" y="40" text-anchor="middle" font-size="12" fill="#c9bf9f">솟대</text></g>`;
  // 머무는 영웅들
  s += hero('manshin', { x: 286, y: GY + 4, scale: 0.42 }) + hero('jaebi', { x: 590, y: GY + 4, scale: 0.42 }) + hero('seungnyeo', { x: 744, y: GY + 4, scale: 0.42, flip: true }) + hero('posu', { x: 900, y: GY + 4, scale: 0.42 }) + hero('talggun', { x: 440, y: GY + 4, scale: 0.42, flip: true });
  s += `</svg>`;
  return s;
}
function sadangPanel() {
  const tablets = [
    { arch: 'chasa', note: '원정 1 · 1년 입춘' },
    { arch: 'posu', note: '원정 1 · 1년 경칩' },
    { arch: 'beopsa', note: '원정 4 · 1년 곡우' },
  ];
  let s = `<svg viewBox="0 0 400 190" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">${defs()}<rect width="400" height="190" fill="#1a1410"/>
    <rect x="0" y="120" width="400" height="12" fill="#5a2a18"/>`;
  tablets.forEach((t, i) => {
    const x = 60 + i * 110;
    s += `<circle cx="${x}" cy="70" r="46" fill="url(#lampGlow)" opacity=".7"/>
      <rect x="${x - 18}" y="30" width="36" height="90" rx="6" fill="#e8cf7c" stroke="#5a4524" stroke-width="1.6"/>
      <rect x="${x - 12}" y="42" width="24" height="5" fill="${heroColor(t.arch)}"/>
      <text x="${x}" y="78" text-anchor="middle" font-size="22" class="brush" fill="#3a2414">${heroName(t.arch)}</text>
      <text x="${x}" y="150" text-anchor="middle" font-size="11.5" fill="#c9bf9f">${t.note}</text>
      <text x="${x}" y="168" text-anchor="middle" font-size="11" fill="#e2b23a">신물 1장</text>`;
  });
  s += `<path d="M60 182 h220" stroke="#6b5636" stroke-dasharray="3 4"/></svg>`;
  return s;
}
function village() {
  return `<section class="screen" id="village">
  <div class="topbar"><span class="opt">안 A</span><span class="title">마을</span><span class="chip">1년 하지 · 원정 9회</span><span class="sp"></span><span class="chip lamp">엽전 586</span><span class="chip lamp">치성 2</span>
    <span class="hide-m" style="display:flex;align-items:center;gap:6px"><span class="lbl">균열</span><span class="gauge">${Array.from({ length: 12 }, (_, i) => `<i class="${i < 3 ? 'on' : ''}"></i>`).join('')}</span></span></div>
  <div class="stage scroller">${villagePanorama(1280, 360)}</div>
  <div class="lbl hide-d" style="padding:2px 12px">← 밀어서 마을을 둘러본다 → · 균열 3/12</div>
  <div class="vgrid">
    <div class="panel" style="padding:6px"><h3 style="margin-left:4px">사당 · 위패</h3>${sadangPanel()}<div class="lbl" style="margin:4px">계보도: 조상신이 된 영웅이 같은 원형 신입에게 시작 카드 1장을 물려준다(신어머니–신딸).</div></div>
    <div style="display:flex;flex-direction:column;gap:8px;min-width:0">
      <div class="fac">
        <div><b>신당 2단계</b>출정 준비 · 지역 1~2</div><div><b>객주 2단계</b>영입 후보 3 · 로스터 9</div><div><b>주막 1단계</b>귀기 회복 · 소문</div>
        <div><b>사당 1단계</b>천도굿 · 위패 · 신물 1장 휴대</div><div><b>장터 1단계</b>보급품 · 교환소</div><div class="lock"><b>무구방</b>짓는 중 — 다음 절기</div>
      </div>
      <div class="row" style="display:flex;gap:8px"><span class="btn end">의뢰판 — 다음 원정</span><span class="btn">로스터</span><span class="btn">사당</span></div>
    </div>
  </div>
  <div class="note">DD 햄릿처럼 한 장의 파노라마. 시설이 서면 건물·사람·풍경(금줄·솟대·단청)이 늘어 본진이 자라는 것이 보인다(P6).</div>
  </section>`;
}

// ── 연출 순간 (스토리보드) ──
function panel(inner, W = 240, H = 230) {
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${defs()}<rect width="${W}" height="${H}" fill="#151a2a"/><rect y="${H - 36}" width="${W}" height="36" fill="#231e16"/>${inner}</svg>`;
}
function moments() {
  const FY = 196;
  const p1 = panel(`${hero('seungnyeo', { x: 80, y: FY, scale: 1, pose: 'attack' })}${spirit('수귀', { x: 186, y: FY, scale: 0.95, state: 'hit' })}
    <path d="M120 70 q30 -20 60 6" stroke="#ffd27a" stroke-width="3" fill="none"/>
    <g transform="translate(186 40)"><rect x="-38" y="-14" width="76" height="24" rx="3" fill="rgba(10,12,20,.85)" stroke="#8fb5dc"/>${icon('neok', { x: -24, y: -2, s: 1 })}<text x="-12" y="3" font-size="13" fill="#8fb5dc">+2 → 5</text></g>`);
  const p2 = panel(`${hero('manshin', { x: 70, y: FY, scale: 0.92, pose: 'cast' })}${hero('seungnyeo', { x: 170, y: FY, scale: 0.92, pose: 'attack' })}
    <path d="M86 60 C110 20 150 20 168 60" stroke="${heroColor('manshin')}" stroke-width="3" fill="none"/><path d="M168 60 l-8 -3 l4 9 Z" fill="${heroColor('manshin')}"/>
    <text x="120" y="28" text-anchor="middle" font-size="13" fill="#ebe3cc">메기고 → 받고</text>
    ${[0, 1, 2, 3, 4].map((i) => `<circle cx="${72 + i * 24}" cy="${FY + 18}" r="8" fill="${i < 3 ? '#e2b23a' : '#2a2418'}" stroke="#6b5636"/>`).join('')}`);
  const p3 = panel(`${hero('posu', { x: 150, y: FY, scale: 1, pose: 'downed' })}${soulOver(120, 110, { calls: 1, need: 3, save: 65, scale: 0.9 })}`);
  const p4 = panel(`<rect width="240" height="230" fill="#1d2440"/>${spirit('수귀', { x: 130, y: FY - 10, scale: 1, state: 'haewon' })}
    <path d="M60 60 q20 -30 50 -40 M180 50 q-10 -30 -40 -36" stroke="#fff3d0" stroke-width="1.5" fill="none" opacity=".7"/>
    ${[[50, 120], [200, 100], [80, 40], [170, 150]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${4 + (i % 2) * 2}" fill="${['#e0503f', '#e2b23a', '#ece6d6', '#2f86a6'][i]}" opacity=".85"/>`).join('')}
    <text x="20" y="${FY + 26}" font-size="13" fill="#6fbf8f">서 있는 영웅 모두 체력 +3</text>`);
  const p5 = panel(`<rect width="240" height="230" fill="#0f1220"/>${spirit('수귀', { x: 130, y: FY, scale: 1, state: 'cheochi' })}
    <text x="20" y="${FY + 26}" font-size="13" fill="#9a8f78">재료 1 · 잡귀 넋</text>`);
  const items = [
    ['돌격 · 타격', p1, '근접 영웅이 공격하면 선두로 나선다. 몸을 앞으로 기울이고 무구를 휘두른다. 맞은 원귀는 한지처럼 펄럭이며 밀린다.', 'translateX(28px) rotate(8deg) 160ms → 복귀 220ms · 대상 rotate(-7deg)'],
    ['받는소리', p2, '직전 카드 주인 색의 실이 다음 주인에게 건너간다. 장구 북이 하나 켜지고, 메기는 소리–받는 소리가 짧게 울린다.', 'stroke-dashoffset 280ms · 북 scale(1.25) 120ms'],
    ['쓰러짐 · 넋 부르기', p3, '목인이 넘어지듯 눕는다(피 없음). 몸 위에 작은 한지 넋이 떠 있고, 넋 부르기 칸과 버틸 확률이 붙는다.', 'rotate(-90deg) 300ms ease-in · 넋 translateY 흔들림 2s'],
    ['해원', p4, '구겨진 넋전이 펴지고 한(恨)의 빛깔이 빠져 하얗게 된다. 빛과 함께 위로 떠올라 무대 밖으로 나간다. 징 한 번.', 'filter 400ms → translateY(-120px) + opacity 0, 900ms'],
    ['처치', p5, '빛 없이 안으로 구겨져 잿빛으로 주저앉고 그을음처럼 흩어진다. 해원과 반대로 아래·어둠·소리 작게.', 'scale(1,.55) rotate(6deg) 350ms → opacity 0'],
  ];
  return `<section class="screen" id="moments">
  <div class="topbar"><span class="opt">안 A</span><span class="title">연출 순간</span><span class="chip hide-m">러프 단계에서 CSS 변형만으로 구현</span><span class="sp"></span></div>
  <div class="mgrid">${items.map(([t, svg, d, code], i) => `<figure class="${i === 4 ? 'wide' : ''}">${svg}<figcaption><b>${t}</b>${d}<br><code>${code}</code></figcaption></figure>`).join('')}</div>
  </section>`;
}

export function pageA() {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>저승굿 표현안 A</title>
${FONT_LINKS}
<style>${BASE_CSS}${CSS}</style></head><body>
${switchNav([['combat', '전투'], ['explore', '탐험'], ['village', '마을'], ['moments', '연출']])}
${combat()}${explore()}${village()}${moments()}
</body></html>`;
}
