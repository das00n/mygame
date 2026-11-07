// 화풍 시안 갤러리 — docs/design/style-study/<id>-<slug>/shot-1280x800.jpg 를 한 장짜리 HTML 로 묶는다.
// 사용: node tools/presentation/style-gallery.mjs <출력 경로>
// 점수 · 비용 · 엔진은 docs/13-style-study.md §4.2 · §5 표에서 옮긴다(시안을 보기 전의 판단).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dir = resolve(root, 'docs/design/style-study');
const out = process.argv[2] ?? resolve(root, 'web/dist/style-gallery.html');

/** 점수 순서: 톤 · 민속 재료 · 가독성 · 비용·팀 · 차별화 (13 §4.2, 1~5) */
const STYLES = [
  { id: 's0', slug: 'paper-stage', name: '2D 측면 종이 무대', tag: '지금 방향', dim: '2D', family: 'F4 페인터리 컷아웃 × 넋전 × 수묵 배경', cost: '×1.0', engine: '웹(PixiJS)', score: [4, 3, 4, 4, 2], tests: '기준선 — 코드로 흉내 낸 재료의 한계' },
  { id: 's1', slug: 'minhwa', name: '민화 · 무신도 평면 채색', dim: '2D', family: 'F11 문화 고유 회화', cost: '×0.9~1.1 + 자문', engine: '웹(PixiJS)', score: [3, 5, 5, 4, 5], pick: true, tests: '한국 회화 양식이 첫인상과 가독성을 함께 올리는가, 밝은 색이 처연함을 깎는가' },
  { id: 's2', slug: 'shadow', name: '그림자극 (만석중놀이)', dim: '2D', family: 'F13 실루엣 · 그림자극', cost: '×0.5~0.7', engine: '웹(PixiJS)', score: [5, 4, 3, 5, 4], pick: true, tests: '색 한지 그림자로 정보 · 정체가 읽히는가, 얼굴 없이 애착이 생기는가' },
  { id: 's3', slug: 'ink-novel', name: '굵은 먹선 그래픽 노블', dim: '2D', family: 'F5 굵은 먹선', cost: '×0.9~1.1', engine: '웹(PixiJS)', score: [5, 4, 5, 4, 3], pick: true, tests: '먹선이 서양 고딕과 다르게 한국적으로 보이는가' },
  { id: 's4', slug: 'cartoon', name: '카툰 셀', dim: '2D', family: 'F6 카툰', cost: '×0.8~1.0', engine: '웹(PixiJS)', score: [3, 3, 5, 4, 2], tests: '꼭두의 익살과 애도의 균형' },
  { id: 's5', slug: 'pixel', name: '픽셀 아트', dim: '2D', family: 'F8 픽셀', cost: '×0.5~1.3', engine: '웹(PixiJS)', score: [3, 2, 4, 5, 1], tests: '저해상에서 한지 · 먹 · 한글이 살아남는가' },
  { id: 's6', slug: 'anime', name: '애니메 · 서브컬처 2D', dim: '2D', family: 'F7 애니메 2D', cost: '×1.3~1.8', engine: '웹(PixiJS + Spine/Live2D)', score: [3, 2, 4, 2, 2], tests: '얼굴 매력 대 차별화' },
  { id: 's7', slug: 'toon3d', name: '3D 툰 셰이딩', dim: '3D', family: 'F3 셀 셰이딩 3D (× F2 손칠 3D)', cost: '×1.8~3', engine: 'Unity / Unreal 이전', score: [2, 2, 3, 1, 2], tests: '3D 공간감이 비용 · 엔진 이전을 감당할 만한가' },
  { id: 's8', slug: 'real3d', name: '3D 사실풍 (UE식 PBR)', dim: '3D', family: 'F1 3D 사실풍', cost: '×3~4', engine: 'Unreal 이전', score: [4, 2, 2, 1, 3], tests: '사실 공포의 힘 대 가독성 · 비용' },
  { id: 's9', slug: 'papercraft', name: '종이 공예 디오라마', dim: '3D', family: 'F12 종이 공예 (× F15 하이브리드)', cost: '×1.0~3', engine: 'three.js 또는 PixiJS', score: [4, 5, 3, 3, 4], pick: true, tests: '의례 종이가 "귀여운 종이"와 다르게 보이는가' },
];
const AXES = ['톤', '민속 재료', '가독성', '비용·팀', '차별화'];

/** 시안 노트(notes.md)에서 보탤 한 줄 평 — 메인 세션이 시안을 본 뒤 채운다 */
let VERDICT = {};
const verdictPath = resolve(dir, 'gallery-verdict.json');
if (existsSync(verdictPath)) VERDICT = JSON.parse(readFileSync(verdictPath, 'utf8'));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const items = [];
for (const s of STYLES) {
  const f = resolve(dir, `${s.id}-${s.slug}`, 'shot-1280x800.jpg');
  if (!existsSync(f)) { console.warn(`없음: ${s.id} (${f})`); continue; }
  const b64 = readFileSync(f).toString('base64');
  items.push({ ...s, img: `data:image/jpeg;base64,${b64}`, kb: Math.round(readFileSync(f).length / 1024), ...(VERDICT[s.id] ?? {}) });
}

const card = (s, i) => {
  const total = s.score.reduce((a, b) => a + b, 0);
  const bars = s.score.map((v, k) => `<li><span>${AXES[k]}</span><i style="--v:${v}" aria-label="${v}점"></i><b>${v}</b></li>`).join('');
  return `<article class="card" data-dim="${s.dim}" data-pick="${s.pick ? 1 : 0}" id="${s.id}">
  <button class="shot" data-i="${i}" aria-label="${esc(s.name)} 크게 보기"><img src="${s.img}" alt="${esc(s.name)} 시안 — 1막 나루터 뱃사공 보스전" loading="lazy" width="1280" height="800"></button>
  <div class="meta">
    <div class="head"><span class="sid">${s.id}</span><h2>${esc(s.name)}</h2>${s.tag ? `<span class="chip now">${esc(s.tag)}</span>` : ''}${s.pick ? '<span class="chip pick">조사 추천 후보</span>' : ''}<span class="chip dim">${s.dim}</span></div>
    <p class="fam">${esc(s.family)}</p>
    ${s.look ? `<p class="look">${esc(s.look)}</p>` : ''}
    <dl class="facts"><div><dt>본 제작 비용</dt><dd>${esc(s.cost)}</dd></div><div><dt>엔진</dt><dd>${esc(s.engine)}</dd></div><div><dt>적합도</dt><dd><b class="tot">${total}</b>/25</dd></div></dl>
    <ul class="bars">${bars}</ul>
    ${s.good ? `<p class="pc good"><span>좋은 점</span>${esc(s.good)}</p>` : ''}
    ${s.bad ? `<p class="pc bad"><span>걸리는 점</span>${esc(s.bad)}</p>` : ''}
    <p class="tests"><span>이 시안이 시험하는 것</span>${esc(s.tests)}</p>
  </div>
</article>`;
};

const opts = items.map((s, i) => `<option value="${i}">${s.id} · ${esc(s.name)}</option>`).join('');

const html = `<title>저승굿 화풍 시안</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Song+Myung&family=IBM+Plex+Sans+KR:wght@400;600&display=swap">
<style>
/* 밤 굿판의 한지 등불: 먹빛 바탕 · 한지색 글 · 촛불 주황 강조 · 단청 붉은색은 표시에만. 한 가지 어두운 화면으로 고정한다. */
:root {
  --ink: #15130f; --ink-2: #1e1b16; --ink-3: #2a2620; --line: #3b352c;
  --paper: #ece3cf; --paper-dim: #b8ad97; --muted: #8d846f;
  --lamp: #e8a24a; --red: #c8553d; --blue: #6c8fb3; --green: #7fa37a;
  --f-display: "Song Myung", "Gowun Batang", serif;
  --f-body: "Gowun Batang", "Noto Serif KR", serif;
  --f-ui: "IBM Plex Sans KR", system-ui, sans-serif;
  color-scheme: dark;
}
html, body { background: var(--ink); color: var(--paper); }
body { font-family: var(--f-body); line-height: 1.6; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 28px 64px; }
.wrap { max-width: 1240px; margin: 0 auto; display: grid; gap: 28px; }
header h1 { font-family: var(--f-display); font-weight: 400; font-size: clamp(30px, 4vw, 44px); margin: 0; letter-spacing: .02em; text-wrap: balance; }
header p { margin: 6px 0 0; color: var(--paper-dim); max-width: 70ch; }
header .scene { font-family: var(--f-ui); font-size: 13px; color: var(--muted); margin-top: 10px; }
.bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-family: var(--f-ui); font-size: 14px; }
.bar button, .bar select { font: inherit; color: var(--paper); background: var(--ink-2); border: 1px solid var(--line); border-radius: 999px; padding: 6px 14px; cursor: pointer; }
.bar button[aria-pressed="true"] { background: var(--lamp); color: var(--ink); border-color: var(--lamp); }
.bar button:focus-visible, .bar select:focus-visible, .shot:focus-visible, .lb button:focus-visible { outline: 2px solid var(--lamp); outline-offset: 2px; }
.bar .sep { width: 1px; height: 22px; background: var(--line); margin: 0 4px; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px; }
@media (max-width: 820px) { .grid { grid-template-columns: minmax(0, 1fr); } }
.card { background: var(--ink-2); border: 1px solid var(--line); border-radius: 6px; overflow: hidden; display: grid; grid-template-rows: auto 1fr; min-width: 0; }
.card[hidden] { display: none !important; }
.shot { all: unset; cursor: zoom-in; display: block; aspect-ratio: 16 / 10; background: #000; }
.shot img { width: 100%; height: 100%; object-fit: cover; display: block; }
.meta { padding: 14px 16px 16px; display: grid; gap: 8px; align-content: start; min-width: 0; }
.head { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; }
.head h2 { font-family: var(--f-display); font-weight: 400; font-size: 22px; margin: 0; }
.sid { font-family: var(--f-ui); font-weight: 600; font-size: 13px; color: var(--ink); background: var(--paper-dim); border-radius: 3px; padding: 1px 6px; }
.chip { font-family: var(--f-ui); font-size: 12px; border-radius: 999px; padding: 1px 9px; border: 1px solid var(--line); color: var(--paper-dim); }
.chip.pick { border-color: var(--lamp); color: var(--lamp); }
.chip.now { border-color: var(--blue); color: var(--blue); }
.fam { margin: 0; font-family: var(--f-ui); font-size: 13px; color: var(--muted); }
.look { margin: 0; }
.facts { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 0; font-family: var(--f-ui); font-size: 13px; }
.facts div { display: flex; gap: 6px; } .facts dt { color: var(--muted); } .facts dd { margin: 0; }
.tot { color: var(--lamp); font-size: 15px; font-variant-numeric: tabular-nums; }
.bars { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; font-family: var(--f-ui); font-size: 11px; color: var(--muted); }
.bars li { display: grid; gap: 3px; }
.bars i { display: block; height: 5px; background: var(--ink-3); border-radius: 3px; position: relative; overflow: hidden; }
.bars i::after { content: ""; position: absolute; inset: 0 auto 0 0; width: calc(var(--v) * 20%); background: var(--paper-dim); }
.bars b { font-weight: 600; color: var(--paper-dim); font-variant-numeric: tabular-nums; }
.pc, .tests { margin: 0; font-size: 14px; }
.pc span, .tests span { display: block; font-family: var(--f-ui); font-size: 12px; color: var(--muted); }
.pc.good span { color: var(--green); } .pc.bad span { color: var(--red); }
section h2.sec { font-family: var(--f-display); font-weight: 400; font-size: 24px; margin: 0 0 10px; }
.compare { display: grid; gap: 10px; }
.wipe { position: relative; aspect-ratio: 16 / 10; max-width: 100%; background: #000; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; user-select: none; touch-action: none; }
.wipe img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.wipe .top { clip-path: inset(0 calc(100% - var(--x, 50%)) 0 0); }
.wipe .handle { position: absolute; top: 0; bottom: 0; left: var(--x, 50%); width: 2px; background: var(--lamp); transform: translateX(-1px); pointer-events: none; }
.wipe .lab { position: absolute; top: 8px; font-family: var(--f-ui); font-size: 12px; background: rgba(21,19,15,.8); padding: 2px 8px; border-radius: 3px; }
.wipe .lab.l { left: 8px; } .wipe .lab.r { right: 8px; }
.wipe input[type=range] { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: ew-resize; margin: 0; }
.qs { display: grid; gap: 6px; padding: 0; margin: 0; list-style: none; }
.qs li { display: grid; grid-template-columns: 2.4em minmax(0, 1fr); gap: 8px; }
.qs b { font-family: var(--f-ui); color: var(--lamp); }
footer { font-family: var(--f-ui); font-size: 12px; color: var(--muted); }
.lb { position: fixed; inset: 0; background: rgba(10,9,7,.94); display: grid; grid-template-rows: auto 1fr auto; z-index: 20; padding: calc(env(safe-area-inset-top, 0px) + 10px) max(16px, env(safe-area-inset-right, 0px)) calc(env(safe-area-inset-bottom, 0px) + 10px) max(16px, env(safe-area-inset-left, 0px)); }
.lb[hidden] { display: none !important; }
.lb .t { font-family: var(--f-display); font-size: 20px; display: flex; justify-content: space-between; gap: 12px; align-items: center; }
.lb img { max-width: 100%; max-height: 100%; margin: auto; object-fit: contain; align-self: center; justify-self: center; min-height: 0; }
.lb .nav { display: flex; justify-content: center; gap: 10px; }
.lb button { font: 14px var(--f-ui); color: var(--paper); background: var(--ink-2); border: 1px solid var(--line); border-radius: 999px; padding: 6px 16px; cursor: pointer; }
@media (prefers-reduced-motion: no-preference) { .card { transition: border-color .15s; } .card:hover { border-color: var(--paper-dim); } }
</style>
<div class="wrap">
  <header>
    <h1>저승굿 화풍 시안</h1>
    <p>같은 장면을 화풍만 바꿔 ${items.length}가지로 그렸다. 구도와 정보(의도 · 이름판 · 손패)는 모두 같다. 그림을 누르면 크게 보고, 아래 「두 시안 견주기」에서 밀어서 비교한다.</p>
    <p class="scene">장면: 1막 「건너지 못한 나루」 · 뱃사공 보스전 첫 턴 · 밤 · 1280×800 · 모든 시안은 코드로 그린 방향 시안이다(완성 그림 아님). 적합도 점수는 화풍 조사(docs/13-style-study.md §4)의 시안 보기 전 판단.</p>
  </header>
  <div class="bar" role="toolbar" aria-label="거르기">
    <button data-f="all" aria-pressed="true">전체</button>
    <button data-f="2D" aria-pressed="false">2D</button>
    <button data-f="3D" aria-pressed="false">3D</button>
    <button data-f="pick" aria-pressed="false">조사 추천 후보</button>
  </div>
  <div class="grid">${items.map(card).join('\n')}</div>
  <section class="compare" aria-labelledby="cmp">
    <h2 class="sec" id="cmp">두 시안 견주기</h2>
    <div class="bar"><label for="ca">왼쪽</label><select id="ca">${opts}</select><span class="sep"></span><label for="cb">오른쪽</label><select id="cb">${opts}</select></div>
    <div class="wipe" id="wipe"><img id="wb" alt=""><img id="wa" class="top" alt=""><span class="lab l" id="la"></span><span class="lab r" id="lb2"></span><span class="handle"></span><input type="range" id="wx" min="0" max="100" value="50" aria-label="견주기 경계"></div>
  </section>
  <section aria-labelledby="q">
    <h2 class="sec" id="q">고를 때 물을 것</h2>
    <ol class="qs">
      <li><b>V1</b><span>글자를 가려도 "한국 · 굿 · 애도"가 첫 화면에서 읽히는가</span></li>
      <li><b>V2</b><span>보스 의도(↗ 12 · 노 내리치기 → 선두 승려)와 승려의 −12 가 5초 안에 읽히는가</span></li>
      <li><b>V3</b><span>뱃사공이 "무섭지만 풀어 줄 넋"으로 보이는가 — 악마 · 괴물로 보이지 않는가</span></li>
      <li><b>V4</b><span>영웅 셋을 얼굴만으로 기억할 수 있는가</span></li>
      <li><b>V5</b><span>같은 갈래의 유명작이 먼저 떠오르지 않는가</span></li>
      <li><b>V6</b><span>이 화풍으로 원귀 47종 · 카드 314장을 같은 품질로 낼 수 있는가</span></li>
    </ol>
  </section>
  <footer>저장소: docs/13-style-study.md (화풍 갈래 15 · 참고 게임 · 비용 · 엔진) · docs/design/style-study/ (시안 원본 · 시안별 notes.md)</footer>
</div>
<div class="lb" id="lbx" hidden role="dialog" aria-modal="true" aria-labelledby="lbt">
  <div class="t"><span id="lbt"></span><button id="lbc">닫기</button></div>
  <img id="lbi" alt="">
  <div class="nav"><button id="lbp">← 이전</button><button id="lbn">다음 →</button></div>
</div>
<script>
const ITEMS = ${JSON.stringify(items.map((s) => ({ id: s.id, name: s.name })))};
const imgs = [...document.querySelectorAll('.shot img')].map((i) => i.src);
document.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('[data-f]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  const f = b.dataset.f;
  document.querySelectorAll('.card').forEach((c) => { c.hidden = !(f === 'all' || (f === 'pick' ? c.dataset.pick === '1' : c.dataset.dim === f)); });
}));
const lb = document.getElementById('lbx'), lbi = document.getElementById('lbi'), lbt = document.getElementById('lbt');
let cur = 0;
const show = (i) => { cur = (i + imgs.length) % imgs.length; lbi.src = imgs[cur]; lbi.alt = ITEMS[cur].name; lbt.textContent = ITEMS[cur].id + ' · ' + ITEMS[cur].name; };
document.querySelectorAll('.shot').forEach((b) => b.addEventListener('click', () => { show(+b.dataset.i); lb.hidden = false; document.getElementById('lbc').focus(); }));
document.getElementById('lbc').onclick = () => { lb.hidden = true; };
document.getElementById('lbp').onclick = () => show(cur - 1);
document.getElementById('lbn').onclick = () => show(cur + 1);
document.addEventListener('keydown', (e) => { if (lb.hidden) return; if (e.key === 'Escape') lb.hidden = true; if (e.key === 'ArrowLeft') show(cur - 1); if (e.key === 'ArrowRight') show(cur + 1); });
const ca = document.getElementById('ca'), cb = document.getElementById('cb'), wipe = document.getElementById('wipe'), wx = document.getElementById('wx');
ca.value = '0'; cb.value = String(Math.min(1, imgs.length - 1));
const upd = () => { document.getElementById('wa').src = imgs[+ca.value]; document.getElementById('wb').src = imgs[+cb.value]; document.getElementById('la').textContent = ITEMS[+ca.value].id + ' · ' + ITEMS[+ca.value].name; document.getElementById('lb2').textContent = ITEMS[+cb.value].id + ' · ' + ITEMS[+cb.value].name; };
ca.onchange = upd; cb.onchange = upd; upd();
wx.oninput = () => wipe.style.setProperty('--x', wx.value + '%');
</script>
`;

writeFileSync(out, html);
console.log(`${out} — ${items.length}개 시안, ${(html.length / 1024 / 1024).toFixed(2)} MB`);
