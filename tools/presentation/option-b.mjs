// 안 B — 2.5D 굿판 디오라마: 굿청(차일 친 마당)을 비스듬히 내려다보는 고정 카메라.
// 러프 목업은 원근 사다리꼴 바닥 + 세운 종이 인형(빌보드)로 흉내 낸다. 본 제작은 실시간 3D 카메라·조명을 가정한다.
import { globalDefs, hero, spirit, icon, HANJI } from './figures.mjs';
import { SCENE, BASE_CSS, FONT_LINKS, handHTML, drumsHTML, lightbarHTML, switchNav, svgBar, heroColor, heroName } from './common.mjs';

const CSS = `
.stage{flex:none;line-height:0;position:relative}
.stage svg{display:block;width:100%;height:auto}
.overlay{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:flex-end;justify-content:space-between;padding:0 16px 10px;line-height:1.4}
.overlay .hud{display:flex;flex-direction:column;gap:6px;background:rgba(10,12,20,.78);padding:8px 10px;border:1px solid var(--line);border-radius:3px}
.overlay .hand .card{width:132px;height:184px}
.lbl{font-size:12px;color:var(--text-dim)}.lbl b{color:var(--lamp);font-weight:400;font-family:var(--font-brush);font-size:20px}
.side{position:absolute;right:16px;top:58px;width:250px;display:flex;flex-direction:column;gap:8px;line-height:1.4}
.panel{border:1px solid var(--line);background:rgba(16,20,34,.86);border-radius:3px;padding:8px 10px}
.panel h3{margin:0 0 6px;font-family:var(--font-brush);font-weight:400;font-size:22px;color:var(--paper)}
.sup{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.sup div{border:1px solid var(--line);padding:3px 6px;font-size:12px;color:var(--text-dim)}.sup b{display:block;font-size:16px;color:var(--text)}
.mdock{display:none}
@media (max-width:600px){
  .overlay{display:none}
  .side{display:none}
  .mdock{display:flex;flex-direction:column;gap:6px;padding:6px 12px;flex:1;min-height:0}
  .mdock .row{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .mdock .handwrap{overflow-x:auto}.mdock .hand{justify-content:flex-start;width:max-content;gap:8px}
}
`;

// 원근 바닥: v=0 먼 쪽, v=1 가까운 쪽
function floorMap({ y0, y1, l0, r0, l1, r1 }) {
  return (u, v) => {
    const y = y0 + (y1 - y0) * v;
    const L = l0 + (l1 - l0) * v, R = r0 + (r1 - r0) * v;
    return [L + (R - L) * u, y, 0.55 + 0.6 * v];
  };
}

function gutcheong(W, H, P, { phone = false } = {}) {
  const [a] = [P(0, 0), P(1, 0), P(1, 1), P(0, 1)];
  const c = [P(0, 0), P(1, 0), P(1, 1), P(0, 1)];
  let s = `<defs><linearGradient id="bgB${phone ? 'm' : 'd'}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1424"/><stop offset="1" stop-color="#0e0c14"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#bgB${phone ? 'm' : 'd'})"/>`;
  // 뒷벽: 오방 천 휘장
  const wallTop = c[0][1] - (phone ? 90 : 150);
  const cols = ['#5a2a28', '#2a3a52', '#6a5a2a', '#4a4a50', '#2a2a30'];
  const n = phone ? 5 : 10;
  for (let i = 0; i < n; i++) {
    const x1 = c[0][0] + ((c[1][0] - c[0][0]) * i) / n, x2 = c[0][0] + ((c[1][0] - c[0][0]) * (i + 1)) / n;
    s += `<rect x="${x1}" y="${wallTop}" width="${x2 - x1 + 1}" height="${c[0][1] - wallTop}" fill="${cols[i % 5]}"/>`;
    s += `<path d="M${x1} ${wallTop} Q${(x1 + x2) / 2} ${wallTop + 18} ${x2} ${wallTop}" fill="none" stroke="#000" stroke-opacity=".35"/>`;
  }
  // 지화 다발
  const flowers = phone ? [c[0][0] + 10, c[1][0] - 10] : [c[0][0] + 30, (c[0][0] + c[1][0]) / 2, c[1][0] - 30];
  for (const fx of flowers) {
    s += `<g transform="translate(${fx} ${c[0][1] - 6})">${[0, 1, 2, 3, 4, 5, 6].map((k) => `<circle cx="${(k - 3) * (phone ? 5 : 9)}" cy="${-14 - (k % 3) * (phone ? 6 : 10)}" r="${phone ? 5 : 8}" fill="${['#e0503f', '#efe6cf', '#e2b23a', '#2f86a6', '#c26aa0'][k % 5]}" stroke="#1a1712" stroke-width=".8"/>`).join('')}<rect x="-${phone ? 8 : 14}" y="-4" width="${phone ? 16 : 28}" height="${phone ? 8 : 12}" fill="#7a3a22"/></g>`;
  }
  // 바닥(돗자리)
  s += `<path d="M${c[0][0]} ${c[0][1]} L${c[1][0]} ${c[1][1]} L${c[2][0]} ${c[2][1]} L${c[3][0]} ${c[3][1]} Z" fill="#7a6440"/>`;
  for (let k = 0; k <= 16; k++) {
    const u = k / 16; const [x1, y1] = P(u, 0), [x2, y2] = P(u, 1);
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#5a4a2a" stroke-width="1"/>`;
  }
  for (let k = 0; k <= 10; k++) {
    const v = Math.pow(k / 10, 1.3); const [x1, y1] = P(0, v), [x2, y2] = P(1, v);
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#5a4a2a" stroke-width="${0.6 + v * 1.4}"/>`;
  }
  // 길베 (흰 무명길) — 대각선
  const g1 = P(0.1, 1), g2 = P(0.22, 1), g3 = P(0.95, 0.05), g4 = P(0.88, 0);
  s += `<path d="M${g1[0]} ${g1[1]} L${g2[0]} ${g2[1]} L${g3[0]} ${g3[1]} L${g4[0]} ${g4[1]} Z" fill="${HANJI}" opacity=".28"/>`;
  // 차일
  s += `<path d="M0 0 H${W} V${phone ? 22 : 34} ${Array.from({ length: phone ? 10 : 20 }, (_, i) => { const w = W / (phone ? 10 : 20); return `Q${W - i * w - w / 2} ${(phone ? 22 : 34) + (phone ? 12 : 18)} ${W - (i + 1) * w} ${phone ? 22 : 34}`; }).join(' ')} Z" fill="#e8dcc0" stroke="#8a7a5a"/>`;
  s += `<rect x="${phone ? 4 : 16}" y="0" width="${phone ? 6 : 10}" height="${H}" fill="#4a2a1a"/><rect x="${W - (phone ? 10 : 26)}" y="0" width="${phone ? 6 : 10}" height="${H}" fill="#4a2a1a"/>`;
  return s;
}

function flag(x, y, kind, num, sc = 1, left = false) {
  const col = { attack: '#c33427', pull: '#e2b23a', stress: '#2f6fb3' }[kind];
  const d = left ? -1 : 1;
  return `<g transform="translate(${x} ${y}) scale(${sc})">
    <path d="M0 0 L0 -56" stroke="#3a2a1a" stroke-width="3"/>
    <path d="M0 -56 L${58 * d} -44 L0 -30 Z" fill="${col}" stroke="#1a1712" stroke-width="1.2"/>
    <text x="${left ? -40 : 20}" y="-38" font-size="17" font-weight="700" fill="#fff">${num}</text>
    ${icon(kind, { x: left ? -50 : 8, y: -43, s: 0.7, c: '#fff' })}
  </g>`;
}

function combatSVG({ phone = false } = {}) {
  const W = phone ? 390 : 1280, H = phone ? 520 : 756;
  const P = phone
    ? floorMap({ y0: 150, y1: 520, l0: 60, r0: 380, l1: -140, r1: 520 })
    : floorMap({ y0: 230, y1: 756, l0: 330, r0: 1150, l1: -160, r1: 1440 });
  const base = phone ? 0.62 : 1;
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${gutcheong(W, H, P, { phone })}`;
  const heroUV = phone ? { posu: [0.28, 0.9], manshin: [0.36, 0.72], seungnyeo: [0.46, 0.55] } : { posu: [0.2, 0.56], manshin: [0.29, 0.46], seungnyeo: [0.38, 0.36] };
  const enemyUV = phone ? [[0.58, 0.42], [0.72, 0.3], [0.85, 0.18]] : [[0.6, 0.3], [0.7, 0.2], [0.8, 0.1]];
  // 대상 선(바닥에 그린다)
  let lines = '';
  SCENE.enemies.forEach((e, i) => {
    const [ex, ey] = P(...enemyUV[i]);
    const t = e.intent.target;
    const targets = t === 'all' ? Object.keys(heroUV) : [t];
    for (const tid of targets) {
      const [hx, hy] = P(...heroUV[tid]);
      lines += `<path d="M${ex} ${ey} Q${(ex + hx) / 2} ${Math.max(ey, hy) + (phone ? 10 : 30)} ${hx} ${hy}" stroke="${t === 'all' ? '#8fa0d8' : heroColor(tid)}" stroke-width="${phone ? 2.5 : 5}" fill="none" opacity="${t === 'all' ? 0.35 : 0.75}" ${t === 'all' ? 'stroke-dasharray="4 6"' : ''}/>`;
    }
  });
  s += lines;
  // 깊이 순서: 먼 것부터
  const items = [];
  SCENE.enemies.forEach((e, i) => items.push({ v: enemyUV[i][1], draw: () => {
    const [x, y, sc] = P(...enemyUV[i]);
    const k = sc * base * e.scale * (phone ? 0.9 : 1);
    let g = spirit(e.family, { x, y, scale: k });
    g += phone ? flag(x - 12 * k, y - 140 * k, e.intent.kind, e.intent.num, 0.62, true) : flag(x + 10 * k, y - 150 * k, e.intent.kind, e.intent.num, 0.8 + k * 0.2);
    const pw = phone ? 54 : 120 * Math.max(0.8, sc);
    g += `<g><rect x="${x - pw / 2}" y="${y + 6}" width="${pw}" height="${phone ? 24 : 36}" rx="3" fill="rgba(10,10,16,.8)"/>
      <text x="${x}" y="${y + (phone ? 16 : 22)}" text-anchor="middle" font-size="${phone ? 10.5 : 13}" fill="#ebe3cc">${phone ? e.hp[0] + '/' + e.hp[1] : e.name}</text>
      ${svgBar(x - pw / 2 + 4, y + (phone ? 20 : 28), pw - 8, phone ? 4 : 6, e.hp, { mobu: e.mobu ?? 0, color: '#c0504a' })}</g>`;
    const st = e.status[0];
    if (!phone) g += `<g transform="translate(${x + pw / 2 + 14} ${y + 18})">${icon(st.k, { s: 1.1 })}<text x="12" y="4" font-size="12.5" fill="#ebe3cc">${st.v}</text></g>`;
    return g;
  } }));
  for (const h of SCENE.party) items.push({ v: heroUV[h.id][1], draw: () => {
    const [x, y, sc] = P(...heroUV[h.id]);
    const k = sc * base;
    let g = hero(h.id, { x, y, scale: k });
    const pw = phone ? 56 : 110;
    g += `<g><rect x="${x - pw / 2}" y="${y + 6}" width="${pw}" height="${phone ? 26 : 36}" rx="3" fill="rgba(10,10,16,.8)"/>
      <text x="${x}" y="${y + (phone ? 17 : 22)}" text-anchor="middle" font-size="${phone ? 10.5 : 13}" fill="${heroColor(h.id)}">${heroName(h.id)}${phone ? '' : ` · ${h.slot}`}</text>
      ${svgBar(x - pw / 2 + 4, y + (phone ? 21 : 28), pw - 8, phone ? 4 : 6, h.hp, { pred: h.pred?.dmg ?? 0 })}</g>`;
    return g;
  } });
  // 굿상(에너지 촛불 · 몸주 신령)
  items.push({ v: phone ? 0.62 : 0.42, draw: () => {
    const [x, y, sc] = phone ? P(0.58, 0.62) : P(0.5, 0.42);
    const k = sc * base;
    return `<g transform="translate(${x} ${y}) scale(${k})">
      <path d="M-60 -20 L60 -20 L70 0 L-50 0 Z" fill="#7a3a22" stroke="#1a1712" stroke-width="1.5"/><rect x="-50" y="0" width="120" height="16" fill="#5a2a18"/>
      <circle cx="4" cy="-60" r="44" fill="url(#lampGlow)"/>
      <rect x="-6" y="-66" width="16" height="44" rx="3" fill="#e8cf7c" stroke="#5a4524"/>
      ${[0, 1, 2].map((i) => `<rect x="${-46 + i * 14}" y="-40" width="6" height="18" fill="#efe6cf"/>${i < SCENE.energy[0] ? `<path d="M${-43 + i * 14} -40 q-4 -8 0 -13 q4 5 0 13" fill="#ffc964"/>` : ''}`).join('')}
      <text x="-30" y="-58" text-anchor="middle" font-size="13" fill="#ffc964">${SCENE.energy[0]}/${SCENE.energy[1]}</text>
    </g>`;
  } });
  items.sort((a, b) => a.v - b.v).forEach((it) => (s += it.draw()));
  // 장구(장단) — 앞 왼쪽 모서리
  if (!phone) s += `<g transform="translate(130 330)"><path d="M-40 -22 L-8 -6 L-8 6 L-40 22 Z M40 -22 L8 -6 L8 6 L40 22 Z" fill="#8a4b2a" stroke="#1a1712" stroke-width="2"/><ellipse cx="-40" cy="0" rx="8" ry="22" fill="#c33427"/><ellipse cx="40" cy="0" rx="8" ry="22" fill="#2f86a6"/>
    ${[0, 1, 2, 3, 4].map((i) => `<circle cx="${-36 + i * 18}" cy="38" r="7" fill="${i < SCENE.jangdan ? '#e2b23a' : '#2a2418'}" stroke="#6b5636"/>`).join('')}<text x="0" y="66" text-anchor="middle" font-size="13" fill="#e2b23a">장단 ${SCENE.jangdan}장</text></g>`;
  s += `</svg>`;
  return s;
}

function combat() {
  return `<section class="screen" id="combat">
  <div class="topbar"><span class="opt">안 B</span><span class="title">${SCENE.region}</span><span class="chip hide-m">2.5D 굿판 디오라마 · 전투</span><span class="chip">턴 ${SCENE.turn}</span><span class="sp"></span><span class="chip lamp">넋등 ${SCENE.light.value} · ${SCENE.light.band}</span><span class="hide-m">${lightbarHTML()}</span></div>
  <div class="stage hide-m">${combatSVG()}
    <div class="overlay"><div class="hud"><div class="lbl">에너지 <b>${SCENE.energy[0]}/${SCENE.energy[1]}</b> · 장단 <b>${SCENE.jangdan}장</b></div>${drumsHTML()}<div class="batline" style="--hc:${heroColor(SCENE.lastOwner)}"><span class="dot"></span>직전 ${heroName(SCENE.lastOwner)} → 「받」</div></div>
    ${handHTML(SCENE.hand, { fan: true })}<span class="btn end">턴 종료</span></div></div>
  <div class="stage hide-d">${combatSVG({ phone: true })}</div>
  <div class="mdock"><div class="row"><div class="energy">${SCENE.energy[0]}<small>/${SCENE.energy[1]}</small></div><div>${drumsHTML()}<div class="batline" style="--hc:${heroColor(SCENE.lastOwner)};margin-top:4px"><span class="dot"></span>직전 ${heroName(SCENE.lastOwner)}</div></div><span class="btn end" style="font-size:14px;padding:8px 12px">턴 종료</span></div>
    <div class="handwrap">${handHTML(SCENE.hand, { fan: false })}</div></div>
  </section>`;
}

// ── 탐험: 떠 있는 방 디오라마 ──
function isoMap({ phone = false } = {}) {
  const W = phone ? 390 : 1280, H = phone ? 400 : 756;
  const k = phone ? 0.55 : 1;
  const ox = phone ? 174 : 445, oy = phone ? 70 : 130;
  const iso = (gx, gy) => [ox + (gx - gy) * 130 * k, oy + (gx + gy) * 75 * k];
  const rooms = [[0, 1, 'v'], [1, 1, 'v'], [1, 0, 'v'], [2, 1, 'c'], [3, 1, '?'], [3, 2, '?'], [4, 1, '?'], [2, 2, '?'], [5, 1, 'b'], [4, 0, '?']];
  const links = [[0, 1, 1, 1], [1, 1, 1, 0], [1, 1, 2, 1], [2, 1, 3, 1], [3, 1, 4, 1], [3, 1, 3, 2], [2, 1, 2, 2], [4, 1, 5, 1], [4, 1, 4, 0]];
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="voidB${phone ? 'm' : 'd'}" cx="40%" cy="40%" r="70%"><stop offset="0" stop-color="#1c2038"/><stop offset="1" stop-color="#07080e"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#voidB${phone ? 'm' : 'd'})"/>
    ${Array.from({ length: 30 }, (_, i) => `<circle cx="${(i * 97) % W}" cy="${(i * 53) % H}" r="${1 + (i % 3)}" fill="#8fa0d8" opacity=".25"/>`).join('')}`;
  // 길베 다리
  for (const [a, b, c, d] of links) {
    const [x1, y1] = iso(a, b), [x2, y2] = iso(c, d);
    const lit = a <= 2 && c <= 2 && !(a === 2 && b === 1 && c === 2 && d === 2);
    s += `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${lit ? '#d8ccaa' : '#3a3a4a'}" stroke-width="${12 * k}" opacity="${lit ? 0.75 : 0.6}"/>`;
    for (let t = 1; t <= 3; t++) {
      const cx = x1 + ((x2 - x1) * t) / 4, cy = y1 + ((y2 - y1) * t) / 4;
      s += `<ellipse cx="${cx}" cy="${cy}" rx="${7 * k}" ry="${4 * k}" fill="${lit ? '#8a7a5a' : '#262632'}"/>`;
    }
  }
  // 방 (깊이 순서: gx+gy)
  rooms.sort((p, q) => p[0] + p[1] - (q[0] + q[1])).forEach(([gx, gy, kind]) => {
    const [x, y] = iso(gx, gy);
    const w = 54 * k, h = 31 * k, d = 22 * k;
    const top = kind === 'v' ? '#4a5478' : kind === 'c' ? '#7a6440' : kind === 'b' ? '#5a1e1e' : '#20243a';
    s += `<path d="M${x} ${y - h} L${x + w} ${y} L${x} ${y + h} L${x - w} ${y} Z" fill="${top}" stroke="#0e111c" stroke-width="1.5"/>
      <path d="M${x - w} ${y} L${x} ${y + h} L${x} ${y + h + d} L${x - w} ${y + d} Z" fill="#141826"/>
      <path d="M${x + w} ${y} L${x} ${y + h} L${x} ${y + h + d} L${x + w} ${y + d} Z" fill="#0e111c"/>`;
    if (kind === '?') s += `<text x="${x}" y="${y + 8 * k}" text-anchor="middle" font-size="${26 * k}" fill="#5a5a70">?</text>`;
    if (kind === 'b') s += `<circle cx="${x}" cy="${y - 4 * k}" r="${40 * k}" fill="#e2573f" opacity=".18"/><text x="${x}" y="${y + 9 * k}" text-anchor="middle" font-size="${30 * k}" fill="#e2573f">恨</text>`;
    if (kind === 'c') s += `<g transform="translate(${x} ${y + 4 * k}) scale(${0.45 * k})"><ellipse cx="0" cy="-10" rx="30" ry="16" fill="#6e685a" stroke="#1a1712"/><ellipse cx="0" cy="-30" rx="20" ry="12" fill="#7a7466" stroke="#1a1712"/><path d="M6 -36 L12 -96" stroke="#4a3a2a" stroke-width="4"/>${['#c33427', '#2f86a6', '#e2b23a'].map((c, i) => `<path d="M10 ${-90 + i * 14} q16 6 12 22" stroke="${c}" stroke-width="7" fill="none"/>`).join('')}</g>`;
  });
  // 파티 — 지금 길목(방 1,1 → 2,1 의 첫 칸)
  const [p1x, p1y] = iso(1, 1), [p2x, p2y] = iso(2, 1);
  const px = p1x + (p2x - p1x) * 0.3, py = p1y + (p2y - p1y) * 0.3;
  s += `<ellipse cx="${px}" cy="${py}" rx="${230 * k}" ry="${140 * k}" fill="url(#lampGlow)" opacity=".75"/>`;
  s += hero('posu', { x: px - 26 * k, y: py - 6 * k, scale: 0.42 * k }) + hero('manshin', { x: px, y: py, scale: 0.42 * k }) + hero('seungnyeo', { x: px + 26 * k, y: py + 6 * k, scale: 0.42 * k });
  s += `<g transform="translate(${px + 10 * k} ${py - 92 * k})"><ellipse rx="${9 * k}" ry="${12 * k}" fill="#ffe2a0" stroke="#a06a2a"/></g>`;
  if (phone) s += `<text x="${W - 8}" y="${H - 12}" text-anchor="end" font-size="12" fill="#e2573f">보스 굴 恨 →</text>`;
  else s += `<text x="24" y="${H - 24}" font-size="13" fill="#b0a78f">다리 3칸 = 길목 · 방에 들어서면 카메라가 굿판 높이로 내려와 전투 디오라마가 된다</text>`;
  s += `</svg>`;
  return s;
}
function explore() {
  return `<section class="screen" id="explore">
  <div class="topbar"><span class="opt">안 B</span><span class="title">저승길</span><span class="chip hide-m">떠 있는 방 디오라마 · 카메라가 파티를 따라간다</span><span class="sp"></span><span class="chip lamp">넋등 61 · 흐림</span><span class="hide-m">${lightbarHTML()}</span></div>
  <div class="stage hide-m">${isoMap()}
    <div class="side"><div class="panel"><h3>서낭당 돌무더기</h3><div class="lbl">다음 방 · 기물. 길베 다리 한 칸 = 넋등 −6</div></div>
      <div class="panel"><div class="sup"><div>촛불<b>6</b></div><div>쌀<b>4</b></div><div>향<b>2</b></div><div>지전<b>2</b></div><div>부적<b>1</b></div><div>술<b>2</b></div></div></div></div></div>
  <div class="stage hide-d">${isoMap({ phone: true })}</div>
  <div class="mdock"><div class="panel"><h3>서낭당 돌무더기</h3><div class="lbl">다음 방 · 기물. 길베 다리 한 칸 = 넋등 −6. 방 안으로 들어가면 카메라가 굿판 높이로 내려와 전투 디오라마가 된다.</div></div>
    <div class="sup" style="grid-template-columns:repeat(6,1fr)"><div>촛불<b>6</b></div><div>쌀<b>4</b></div><div>향<b>2</b></div><div>지전<b>2</b></div><div>부적<b>1</b></div><div>술<b>2</b></div></div></div>
  </section>`;
}

export function pageB() {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>저승굿 표현안 B</title>
${FONT_LINKS}
<style>${BASE_CSS}${CSS}</style></head><body>
${globalDefs()}
${switchNav([['combat', '전투'], ['explore', '탐험']])}
${combat()}${explore()}
</body></html>`;
}
