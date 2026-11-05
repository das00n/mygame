// 카드 삽화 브리프 빌드 — briefs/*.mjs(카드마다 손으로 쓴 부분) + vocab.mjs(공용 어휘)
//   → data/art/cards.json   (일러스트레이터용 전체 브리프, 한국어)
//   → web/src/art/table.ts   (스케치 렌더러가 읽는 구조 필드만, 압축 문자열)
// 실행: node tools/art/build.mjs   ·   카드 데이터에 새 카드가 생기면 브리프가 없다고 실패한다.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as V from './vocab.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SETS = ['manshin', 'jaebi', 'posu', 'baksu', 'seungnyeo', 'beopsa', 'talggun', 'chasa', 'duo', 'common'];
const HERO_SETS = new Set(SETS.slice(0, 8));

const errors = [];
const err = (m) => errors.push(m);

// ── 카드 데이터 ─────────────────────────────────────────
const cards = [];
for (const set of SETS) {
  const j = JSON.parse(readFileSync(join(ROOT, 'data/cards', `${set}.json`), 'utf8'));
  for (const c of j.cards) cards.push({ set, id: c.id, key: c.id.split('.')[1], name: c.name, type: c.type, rarity: c.rarity ?? '', owners: c.owners ?? null, token: false });
  for (const t of j.tokens ?? []) cards.push({ set, id: t.id, key: t.id.split('.')[1], name: t.name, type: t.type ?? '기술', rarity: '부적', owners: null, token: true });
}

// ── 브리프 원본 ─────────────────────────────────────────
const src = new Map();
for (const set of SETS) {
  const mod = await import(`./briefs/${set}.mjs`);
  for (const row of mod.default) {
    const id = `${set}.${row[0]}`;
    if (src.has(id)) err(`${id}: 브리프 중복`);
    src.set(id, row);
  }
}
const cardIds = new Set(cards.map((c) => c.id));
for (const id of src.keys()) if (!cardIds.has(id)) err(`${id}: 카드 데이터에 없는 브리프`);

const inEnum = (k, v, id) => { if (!V.ENUMS[k].includes(v)) err(`${id}: ${k} '${v}' 는 열거값이 아니다`); };
const uniq = (a) => [...new Set(a.filter(Boolean))];

function parseTarget(s, id) {
  const [t, n] = s.split('*');
  inEnum('target', t, id);
  return { target: t, count: n ? Number(n) : 1 };
}

function heroesOf(card, ex) {
  if (HERO_SETS.has(card.set)) return [card.set];
  if (card.set === 'duo') return card.owners ?? (ex.hero ?? '').split('+').filter(Boolean);
  return [ex.hero ?? 'anon'];
}

const FAMILY_SET = new Set(Object.keys(V.FAMILIES));
const HIT_FX = new Set(['burst', 'slash', 'shot', 'crack', 'scatter', 'chain', 'flame']);
const ACC_KEYS = { 0: 'h0', 1: 'h1', hero: 'h0', han: 'han', lamp: 'lamp', cin: 'cin', none: 'none' };

function propLine(k) {
  const p = V.PROPS[k];
  return `${p[0]} — ${p[1]}`;
}

function staging(b) {
  const { framing, heroes, target, count, vs, pose, props, em, down } = b;
  const H = heroes.map((h) => V.HEROES[h].name);
  const parts = [];
  if (framing === 'insert') {
    const main = props.flat()[0];
    parts.push(`가운데에 ${main ? V.PROPS[main][0] : '무구'} 하나를 크게`);
  } else if (framing === 'emblem') {
    parts.push(`가운데에 상징 — ${V.EMBLEM_KO[em] ?? '상태 문양'}`);
  } else if (heroes.length === 2) {
    parts.push(`왼쪽에 ${H[0]}, 그 오른쪽에 ${H[1]}(둘 다 오른쪽을 본다)`);
  } else if (target === 'self') {
    parts.push(`${H[0]}이(가) 화면 가운데`);
  } else if (target === 'party') {
    parts.push(heroes[0] === 'anon' || heroes[0] === 'party' ? '나란히 선 꼭두 일행이 화면 왼쪽 2/3' : `왼쪽에 나란히 선 동료들, 그 앞(가운데)에 ${H[0]}`);
  } else if (target === 'ally') {
    const p = pose[0];
    if (p === 'rescue' || down) parts.push(`왼쪽에 ${H[0]}, 오른쪽 바닥에 쓰러진 동료`);
    else if (p === 'swap' || p === 'bind') parts.push(`가운데에 ${H[0]}, 그 옆에 동료 — 둘 사이에 자리 바꿈 곡선`);
    else parts.push(`가운데에 ${H[0]}, 그 등 뒤(왼쪽)에 지켜지는 동료`);
  } else {
    parts.push(`왼쪽 2/5에 ${H[0]}(오른쪽을 본다)`);
  }
  if (V.FAMILIES[target]) parts.push(`오른쪽에 ${target}${count > 1 ? ` ${count}명(앞에서 뒤로 겹쳐 선다)` : ''}`);
  else if (target === 'altar') parts.push('오른쪽에 굿상');
  else if (target === 'none' && framing !== 'insert' && framing !== 'emblem') parts.push('오른쪽은 효과 글리프가 차지한다');
  if (vs) parts.push(`오른쪽 끝에 ${vs.replace('*', ' ')}명`);
  return parts.join(' · ');
}

function compose(card, row) {
  const id = card.id;
  const [, poseS, targetS, fx, framing, propsS, subject, action, ex = {}] = row;
  const heroes = heroesOf(card, ex);
  const pose = poseS.split('/');
  for (const p of pose) inEnum('pose', p, id);
  if (card.set === 'duo' && !card.token && (heroes.length !== 2 || pose.length !== 2)) err(`${id}: 합기는 영웅 둘·자세 둘`);
  for (const h of heroes) if (!V.HEROES[h]) err(`${id}: 영웅 '${h}' 없음`);
  const { target, count } = parseTarget(targetS, id);
  inEnum('fx', fx, id);
  if (ex.fx2) inEnum('fx', ex.fx2, id);
  inEnum('framing', framing, id);
  const props = propsS.split('|').map((s) => s.trim().split(/\s+/).filter(Boolean));
  for (const k of props.flat()) if (!V.PROPS[k]) err(`${id}: 무구 '${k}' 가 용어집에 없다`);
  const vs = ex.vs ? parseTarget(ex.vs, id) : null;
  const fam = V.FAMILIES[target] ? target : vs ? vs.target : null;
  const bg = ex.bg ?? (V.FAMILIES[target] ? V.FAMILY_BG[target] : vs ? V.FAMILY_BG[vs.target] : target === 'altar' ? 'jihwa' : target === 'party' ? 'geumjul' : target === 'self' ? 'none' : 'hills');
  inEnum('bg', bg, id);
  const accKey = ex.acc ?? (heroes[0] === 'anon' || heroes[0] === 'party' ? 'lamp' : card.set === 'duo' ? 1 : 'hero');
  const acc = ACC_KEYS[accKey];
  if (!acc) err(`${id}: acc '${accKey}'`);
  if (ex.mask) inEnum('mask', ex.mask, id);
  if (ex.em && !V.EMBLEM_KO[ex.em]) err(`${id}: em '${ex.em}'`);
  if (framing === 'emblem' && !ex.em) err(`${id}: emblem 에는 em 이 필요하다`);
  if (!subject || !action) err(`${id}: subject/action 비었음`);

  const H = heroes.map((h) => V.HEROES[h]);
  const accText = {
    h0: `${H[0].name} 색 ${H[0].color}`, h1: `${(H[1] ?? H[0]).name} 색 ${(H[1] ?? H[0]).color}`,
    han: fam ? `${V.FAMILIES[fam].han} ${V.FAMILIES[fam].tint}` : '한의 빛깔', lamp: '넋등 빛 #e0a040', cin: '경면주사 붉은색 #c33427', none: '',
  }[acc];
  const focus = ex.f ?? V.FX_KO[fx][0];
  const costume = heroes.filter((h) => h !== 'party').map((h) => {
    const base = `${V.HEROES[h].name}: ${V.HEROES[h].look}`;
    return h === 'talggun' && ex.mask ? `${base} — 이 장면은 ${{ malttugi: '말뚝이탈(선두)', yangban: '양반탈(중열)', halmi: '할미탈(후열)' }[ex.mask]}` : base;
  });

  const motif = uniq([
    ex.m,
    ...H.map((h) => h.motif),
    fam ? `넋전 한지 오림 원귀(빈 눈·톱니 단) + ${fam}의 덧붙임: ${V.FAMILIES[fam].extra}` : '',
    ex.boss ? `보스 소품: ${V.BOSS_KO[ex.boss]}` : '',
    props.flat().some((k) => k === 'jihwa' || k === 'flower') ? '지화(종이꽃)' : '',
    props.flat().some((k) => k === 'bujeok' || k === 'jineon') ? '부적 획(가상)' : '',
    props.flat().some((k) => k === 'obanggi' || k === 'buchae') ? '오방색은 깃발·부채 띠에만' : '',
    framing === 'emblem' ? '물건 같은 상태 표식(도장·먹 획·실 고리·금) — 10-presentation §3 C안에서 빌림' : '',
    framing === 'insert' ? '민화 책거리처럼 물건 하나를 평면으로' : '',
  ]).join(' · ');

  const light = ex.mo ? '' : bg === 'night' ? '그믐 어둠 속 작은 빛 하나' : bg === 'moon' ? '푸른 달빛 + 넋등' : fx === 'light' ? '넋등·촛불의 따뜻한 흰빛이 한 점에 모인다' : '넋등의 따뜻한 빛, 가장자리는 어둡게';
  const mood = uniq([
    ex.mo, light,
    fam ? `원귀 뒤에 ${V.FAMILIES[fam].han}(${V.FAMILIES[fam].tint}) 흐림` : '',
    V.FX_KO[fx][1],
    acc === 'none' ? '강조색 없음 — 먹과 한지만' : `강조색 하나: ${accText}`,
  ]).join(' · ');

  const typeKind = card.type === '저주' ? 'curse' : card.type === '상태' ? 'status' : card.token ? 'token' : '';
  const avoid = uniq([
    ex.a,
    ...H.map((h) => h.avoid),
    typeKind ? V.TYPE_AVOID[typeKind] : '',
    fam && (HIT_FX.has(fx) || HIT_FX.has(ex.fx2)) ? V.TYPE_AVOID.enemyHit : '',
    pose.includes('summon') || target === 'altar' ? V.TYPE_AVOID.summon : '',
  ]).join(' · ');

  const refs = uniq([
    ...H.map((h) => h.ref),
    ...props.flat().map((k) => V.PROPS[k][3]),
    fam ? '10-presentation.md §4.4' : '',
    ...(ex.r ?? []),
  ]);

  const brief = {
    id, name: card.name, type: card.type, rarity: card.rarity,
    hero: heroes, pose: pose.length === 1 ? pose[0] : pose, target, count, fx, fx2: ex.fx2 ?? null, framing, bg,
    accent: acc, mask: ex.mask ?? null, vs: ex.vs ?? null, tier: ex.tier ?? null, emblem: ex.em ?? null, boss: ex.boss ?? null, downed: !!ex.down,
    props: props.flat(),
    subject, action,
    composition: `${V.FRAMING_KO[framing]}. ${staging({ framing, heroes, target, count, vs: ex.vs, pose, props, em: ex.em, down: ex.down })}. 배경: ${V.BG_KO[bg]}. 초점: ${focus}`,
    costume,
    propsText: props.flat().map(propLine),
    motif, mood, avoid, refs,
  };
  const row2 = [
    heroes.join('+'), pose.join('/'), target, count, fx, ex.fx2 ?? '', framing, props.map((p) => p.join(',')).join('/'),
    bg, acc, ex.mask ?? '', ex.vs ?? '', ex.tier ?? '', ex.em ?? '', ex.boss ?? '', ex.down ? 1 : '',
  ].join('|').replace(/\|+$/, '');
  return { brief, row: row2 };
}

const out = [];
const table = [];
for (const c of cards) {
  const row = src.get(c.id);
  if (!row) { err(`${c.id} (${c.name}): 브리프 없음`); continue; }
  const { brief, row: r } = compose(c, row);
  out.push(brief);
  table.push([c.id, r]);
}

// 구별성 점검: 같은 (영웅·자세·대상·fx·구도·첫 무구) 조합
const sig = new Map();
for (const b of out) {
  const k = [b.hero.join('+'), [].concat(b.pose).join('/'), b.target, b.count, b.fx, b.fx2, b.framing, b.props[0], b.bg, b.mask, b.accent].join('|');
  if (sig.has(k)) err(`구별 안 됨: ${sig.get(k)} ↔ ${b.id}`);
  sig.set(k, b.id);
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n오류 ${errors.length}개`);
  process.exit(1);
}

const doc = {
  version: '0.1',
  generated: 'node tools/art/build.mjs — 손으로 고치지 않는다. 카드별 내용은 tools/art/briefs/*.mjs, 공용 어휘는 tools/art/vocab.mjs',
  stage: '10단계 스케치 — 최종 삽화는 11단계(docs/11-card-art.md)',
  aspect: '16:10',
  upgrades: '강화판(id+)은 기본판 그림을 같이 쓴다',
  counts: {
    total: out.length,
    cards: out.filter((b) => !cards.find((c) => c.id === b.id).token).length,
    tokens: out.filter((b) => cards.find((c) => c.id === b.id).token).length,
    bySet: Object.fromEntries(SETS.map((s) => [s, out.filter((b) => b.id.startsWith(`${s}.`)).length])),
  },
  fields: {
    subject: '누가·무엇이 그려지는가', action: '그리는 순간', composition: '구도(근경·중경·원경), 왼쪽→오른쪽 배치, 초점. 16:10',
    costume: '영웅 복식 열쇠', propsText: '무구 — 정확한 이름과 생김새', motif: '빌려 오는 한국 시각 모티프', mood: '빛과 색(강조색은 하나)',
    avoid: '고증·재현 윤리상 피할 것', refs: '근거 문서(docs/ 기준)',
    hero: '영웅 원형(합기는 둘)', pose: '자세 열거값', target: '대상(원귀 계열·ally·party·altar·self·none)', count: '대상 원귀 수',
    fx: '효과 글리프', fx2: '둘째 글리프', framing: '구도 열거값', bg: '배경 열거값', accent: '강조색(h0·h1 영웅, han 한의 빛깔, lamp 넋등, cin 경면주사, none)',
    mask: '탈꾼의 탈', vs: '함께 그릴 원귀', tier: '원귀 등급', emblem: '상징 구도의 종류', boss: '보스 소품', downed: '동료가 쓰러져 있다',
  },
  enums: V.ENUMS,
  cards: out,
};
writeFileSync(join(ROOT, 'data/art/cards.json'), `${JSON.stringify(doc, null, 1)}\n`);

const ts = `// 자동 생성 — node tools/art/build.mjs. 손으로 고치지 않는다(원본: tools/art/briefs/*.mjs).
// 카드 id → 'hero|pose|target|count|fx|fx2|framing|props|bg|accent|mask|vs|tier|emblem|boss|downed'
// 합기는 hero 'a+b', pose 'a/b', props 'a의 것/b의 것'(쉼표로 여럿).
export const ART_TABLE: Readonly<Record<string, string>> = {
${table.map(([id, r]) => `  '${id}': '${r}',`).join('\n')}
};
`;
writeFileSync(join(ROOT, 'web/src/art/table.ts'), ts);

console.log(`브리프 ${out.length}개 (카드 ${doc.counts.cards} + 부적 ${doc.counts.tokens}) → data/art/cards.json, web/src/art/table.ts`);
console.log(Object.entries(doc.counts.bySet).map(([k, v]) => `${k} ${v}`).join(' · '));
