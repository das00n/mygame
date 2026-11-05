// 카드 삽화 스케치 밀착 인화(contact sheet) — 영웅별·합기·공용으로 묶어 카드 크기(132px)와 큰 크기(300px) PNG 를 만든다.
// 실행: node --import tsx tools/art/contact-sheet.mjs [묶음… | in-card]   → docs/design/art/sheet-<묶음>-<크기>.png, in-card.png
// 끝에 tools/art/shrink_png.py(Pillow)로 256색 팔레트 PNG 로 줄인다.
// 렌더러(web/src/art/sketch.ts)를 그대로 불러 쓰므로 게임 화면과 같은 그림이 나온다.
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { lodFor, sketchSvg } from '../../web/src/art/sketch.ts';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'docs/design/art');
mkdirSync(OUT, { recursive: true });

const briefs = JSON.parse(readFileSync(join(ROOT, 'data/art/cards.json'), 'utf8')).cards;
const css = readFileSync(join(ROOT, 'web/src/art/art.css'), 'utf8');
const SETS = { manshin: '만신', jaebi: '잽이', posu: '포수', baksu: '작두박수', seungnyeo: '승려', beopsa: '법사', talggun: '탈꾼', chasa: '차사', duo: '합기', common: '공용·저주·상태' };
const only = process.argv.slice(2);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const page = (title, body, w) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
${css}
body { margin: 0; background: #1b1a17; color: #e9e1c9; font-family: 'Noto Sans CJK KR', 'Noto Sans KR', sans-serif; padding: 18px; width: ${w}px; }
h1 { font-size: 18px; margin: 0 0 12px; font-weight: 700; }
h1 small { font-weight: 400; color: #a99f86; font-size: 12px; margin-left: 8px; }
.grid { display: flex; flex-wrap: wrap; gap: 12px 10px; }
.cell { display: flex; flex-direction: column; gap: 3px; }
.cell b { font-size: 12px; } .cell i { font-style: normal; font-size: 10px; color: #a99f86; }
.frame { --cw: 132px; width: var(--cw); background: linear-gradient(180deg,#ead592,#dcc076); border: 1px solid #a8893f; padding: 6px 7px; display: flex; flex-direction: column; gap: 4px; color: #2c1e0f; height: calc(var(--cw) * 1.48); box-sizing: border-box; }
.frame .nm { font-size: 13px; font-weight: 700; } .frame .tx { font-size: 10px; line-height: 1.3; }
</style></head><body><h1>${title}</h1>${body}</body></html>`;

function cell(b, width) {
  const lod = lodFor(width);
  const meta = `${[].concat(b.pose).join('/')} · ${b.fx}${b.fx2 ? `+${b.fx2}` : ''} · ${b.framing}`;
  return `<div class="cell" style="width:${width}px"><div class="ca" style="width:${width}px;height:${Math.round((width * 10) / 16)}px">${sketchSvg(b.id, lod)}</div><b>${esc(b.name)}</b><i>${esc(b.id.split('.')[1])} · ${esc(meta)}</i></div>`;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
const pg = await ctx.newPage();
const shot = [];
async function shoot(html, file, width) {
  await pg.setViewportSize({ width: width + 36, height: 900 });
  await pg.setContent(html, { waitUntil: 'load' });
  await pg.screenshot({ path: join(OUT, file), fullPage: true });
  shot.push(join(OUT, file));
  console.log(`docs/design/art/${file}`);
}

for (const [set, label] of Object.entries(SETS)) {
  if (only.length && !only.includes(set)) continue;
  const list = briefs.filter((b) => b.id.startsWith(`${set}.`));
  for (const [w, cols] of [[132, 8], [300, 5]]) {
    const width = cols * (w + 10);
    const body = `<div class="grid">${list.map((b) => cell(b, w)).join('')}</div>`;
    await shoot(page(`${label} <small>${list.length}장 · ${w}px · 10단계 스케치</small>`, body, width), `sheet-${set}-${w}.png`, width);
  }
}

if (!only.length || only.includes('in-card')) {
  // 카드 틀 안에서의 가독성 — 112·132·168px 카드의 안쪽 너비(작은 카드는 여백 7px×2, 큰 카드는 10px×2)
  const pick = ['manshin.cheongbae', 'posu.jojun', 'baksu.jakdu', 'seungnyeo.gasa', 'chasa.ora_jiugi', 'talggun.malttugi_jaedam', 'duo.gongsu_hanbal', 'common.curse_wonmang'];
  let body = '';
  for (const cw of [112, 132, 168]) {
    body += `<h1><small>카드 너비 ${cw}px</small></h1><div class="grid">`;
    for (const id of pick) {
      const b = briefs.find((x) => x.id === id);
      const iw = cw >= 168 ? cw - 22 : cw - 14;
      const lod = lodFor(iw);
      body += `<div class="frame" style="--cw:${cw}px"><div class="nm">${esc(b.name)}</div><div class="ca" style="width:${iw}px;height:${Math.round((iw * 10) / 16)}px">${sketchSvg(id, lod)}</div><div class="tx">${esc(b.subject)}</div></div>`;
    }
    body += '</div>';
  }
  await shoot(page('카드 틀 안에서 보기 <small>삽화 창 = 카드 안쪽 너비(112·132 → −14px, 168 큰 카드 → −22px)</small>', body, 1500), 'in-card.png', 1500);
}

await browser.close();

// 256색 팔레트로 줄이기(Pillow 가 있을 때만) — 강조색은 남고 파일은 약 70% 작아진다
const py = spawnSync('python3', [join(ROOT, 'tools/art/shrink_png.py'), ...shot], { encoding: 'utf8' });
if (py.status !== 0) console.warn('PNG 줄이기 생략:', py.stderr || py.error?.message);
else process.stdout.write(py.stdout);
