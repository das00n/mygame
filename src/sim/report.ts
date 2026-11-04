// data/sim/*.json → docs/design/sim-report.md (자동 생성 표)
// 실행: npm run sim:report (시뮬레이터가 끝날 때도 자동으로 부른다)

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadData } from '../core/data.ts';
import { ROOT } from './root.ts';
import { HERO_IDS, HERO_NAMES, type HeroId } from '../core/types.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`;
const f1 = (x: number) => x.toFixed(1);
const f2 = (x: number) => x.toFixed(2);
const trioName = (t: string) => t.split('+').map((h) => HERO_NAMES[h as HeroId] ?? h).join(' + ');

function table(head: string[], rows: (string | number)[][]): string {
  const out = [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`];
  for (const r of rows) out.push(`| ${r.join(' | ')} |`);
  return out.join('\n');
}

function med(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function flag(rate: number, median: number): string {
  if (rate > median + 0.25) return '**dominant**';
  if (rate < median - 0.25 || rate < 0.05) return '**dead**';
  return '';
}

function load(name: string): Json | null {
  const p = resolve(ROOT, `data/sim/${name}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}

export function writeReport(): void {
  const d = loadData();
  const C = load('combat');
  const E = load('expedition');
  const L: string[] = [];
  L.push('# 시뮬레이션 보고서 (자동 생성)');
  L.push('');
  L.push('> 생성: `npm run sim:combat` / `npm run sim:expedition` (끝나면 이 파일을 다시 쓴다). 해설과 조정 제안은 [Prototype ①](../07-prototype.md).');
  L.push(`> 원자료: \`data/sim/combat.json\`${C ? ` (${C.meta.generated.slice(0, 16)}, 시드 ${C.meta.seeds}, ${C.meta.combats} 전투, ${C.meta.runtimeSec}s)` : ' (없음)'} · \`data/sim/expedition.json\`${E ? ` (${E.meta.generated.slice(0, 16)}, 조합마다 ${E.meta.runs}회, ${E.meta.runtimeSec}s)` : ' (없음)'}`);
  L.push('> 플래그: **dominant** = 중앙값 + 25%p 초과 · **dead** = 중앙값 − 25%p 미만 또는 5% 미만.');
  L.push('');

  const fid = C?.fidelity;
  if (fid) {
    L.push('## 0. 엔진 충실도');
    L.push('');
    L.push(table(['연산', '전체', '결정적 실행', '근사(스텁)'], [
      ['cond (조건)', fid.cond.total, fid.cond.deterministic, fid.cond.stochastic],
      ['per (X 1당)', fid.per.total, fid.per.deterministic, fid.per.expect],
      ['power (능력)', fid.power.total, fid.power.deterministic, fid.power.unknown],
      ['special', fid.special.total, fid.special.exact, fid.special.approx],
    ]));
    L.push('');
    L.push(`카드·부적·설치물 ${fid.cardsTotal}개(강화판 포함) 중 근사가 섞인 것 ${fid.cardsWithStub}개.`);
    L.push('');
  }

  if (E) {
    L.push('## 1. 원정 (보통 길이, 첫 지역)');
    L.push('');
    L.push(`구성: ${E.meta.structure}. 조합마다 ${E.meta.runs}회.`);
    L.push('');
    const dist = E.distribution;
    L.push(`**클리어율 분포**: 최소 ${pct(dist.min)} · 중앙 ${pct(dist.median)} · 평균 ${pct(dist.mean)} · 최대 ${pct(dist.max)}`);
    L.push('');
    const bosses = Object.entries(E.bosses as Record<string, Json>).map(([k, v]) => `${v.name}(${k}) 도달 ${v.reached} → 격파 ${pct(v.clearRate)}, 그중 해원 ${pct(v.haewonRate)}`);
    L.push(`**보스**: ${bosses.join(' · ')}`);
    L.push('');
    L.push('### 1.1 조합별 클리어율 (내림차순)');
    L.push('');
    L.push(table(['#', '조합', '클리어율', '사망/원정', '버틴 전투', '해원율', 'b1 격파', 'b2 격파', '플래그'], E.trios.map((t: Json, i: number) => [
      i + 1, trioName(t.trio), pct(t.clearRate), f2(t.deathsPerRun), f1(t.fightsSurvived), pct(t.haewonRate),
      t.boss.b1 ? `${pct(t.boss.b1.clearRate)} (${t.boss.b1.reached})` : '-', t.boss.b2 ? `${pct(t.boss.b2.clearRate)} (${t.boss.b2.reached})` : '-',
      t.flag ? `**${t.flag}**` : '',
    ])));
    L.push('');
    const dom = E.trios.filter((t: Json) => t.flag === 'dominant').map((t: Json) => trioName(t.trio));
    const dead = E.trios.filter((t: Json) => t.flag === 'dead').map((t: Json) => trioName(t.trio));
    L.push(`- dominant ${dom.length}개: ${dom.join(', ') || '없음'}`);
    L.push(`- dead ${dead.length}개: ${dead.join(', ') || '없음'}`);
    L.push('');
    L.push('### 1.2 전멸 위치');
    L.push('');
    const wipes = Object.entries(E.wipes as Record<string, number>).sort((a, b) => b[1] - a[1]);
    L.push(table(['전투', '구성', '전멸 횟수'], wipes.map(([k, v]) => [k, d.encounterById.get(k)?.enemies.map((id) => d.enemyById.get(id)?.name).join(', ') ?? k, v])));
    L.push('');
  }

  L.push('## 2. 영웅별 평균 (그 영웅이 든 조합 21개의 평균)');
  L.push('');
  L.push(table(['영웅', '원정 클리어율', '원정 사망/원정', '전투 승률', '전투 체력 손실'], HERO_IDS.map((h) => [
    HERO_NAMES[h], E ? pct(E.heroes[h].meanClearRate) : '-', E ? f2(E.heroes[h].meanDeaths) : '-', C ? pct1(C.heroes[h].meanWinRate) : '-', C ? f1(C.heroes[h].meanHpLost) : '-',
  ])));
  L.push('');

  if (C) {
    L.push('## 3. 단일 전투 (원정 중반 덱 20장, 체력 가득)');
    L.push('');
    const o = C.overall;
    L.push(`전체: 승률 ${pct1(o.winRate)} · 평균 ${f1(o.avgTurns)}턴 · 체력 손실 ${f1(o.hpLost)} · 해원율 ${pct(o.haewonRate)} · 턴당 장단 ${f2(o.jangdanPerTurn)} · 받는소리 ${pct(o.respRate)} · 쓰러짐 ${f2(o.downsPerCombat)}/전투 · 사망 ${f2(o.deathsPerCombat)}/전투 · 시간 초과 ${o.timeouts}`);
    L.push('');
    L.push(`피격 비율(칸): 선두 ${pct(o.dmgShareSlot[0])} · 중열 ${pct(o.dmgShareSlot[1])} · 후열 ${pct(o.dmgShareSlot[2])}`);
    L.push('');
    L.push('### 3.1 전투별 (어려운 순)');
    L.push('');
    const encs = Object.entries(C.encounters as Record<string, Json>).sort((a, b) => a[1].winRate - b[1].winRate || b[1].hpLost - a[1].hpLost);
    L.push(table(['전투', '등급', '구성', '승률', '평균 턴', '체력 손실', '해원율', '쓰러짐/전투', '사망/전투'], encs.map(([k, v]) => [
      k, v.tier, v.enemies.map((id: string) => d.enemyById.get(id)?.name).join(', '), pct1(v.winRate), f1(v.avgTurns), f1(v.hpLost), pct(v.haewonRate), f2(v.downsPerCombat), f2(v.deathsPerCombat),
    ])));
    L.push('');
    L.push('### 3.2 조합별 전투 승률 (전투 15종 평균, 내림차순)');
    L.push('');
    const rows = (C.trios as Json[]).slice().sort((a, b) => b.overall.winRate - a.overall.winRate);
    const m = med(rows.map((r) => r.overall.winRate));
    L.push(table(['#', '조합', '승률', '보스 b1', '보스 b2', '엘리트 평균', '체력 손실', '턴당 장단', '받는소리', '쓰러짐', '플래그'], rows.map((r, i) => {
      const el = ['x1', 'x2', 'x3'].map((k) => r.perEnc[k].winRate);
      return [i + 1, trioName(r.trio), pct1(r.overall.winRate), pct(r.perEnc.b1.winRate), pct(r.perEnc.b2.winRate), pct(el.reduce((a: number, b: number) => a + b, 0) / 3),
        f1(r.overall.hpLost), f2(r.overall.jangdanPerTurn), pct(r.overall.respRate), f2(r.overall.downsPerCombat), flag(r.overall.winRate, m)];
    })));
    L.push('');
    L.push('### 3.3 피격·딜 비율 (영웅별, 그 영웅이 든 조합 21개 평균)');
    L.push('');
    const share: Record<string, number[]> = {};
    const dealt: Record<string, number[]> = {};
    for (const r of C.trios as Json[]) {
      for (const [h, v] of Object.entries(r.overall.dmgShareHero as Record<string, number>)) (share[h] ??= []).push(v);
      for (const [h, v] of Object.entries((r.overall.dmgDealtShare ?? {}) as Record<string, number>)) (dealt[h] ??= []).push(v);
    }
    const avg = (xs: number[] | undefined) => (xs && xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    L.push(table(['영웅', '거리', '체력', '받은 피해 비율', '기준 1/3 대비', '준 피해 비율(카드)'], HERO_IDS.map((h) => {
      const v = avg(share[h]);
      const hd = d.heroes.get(h)!;
      return [HERO_NAMES[h], hd.range === 'melee' ? '근접' : '원거리', hd.hp, pct(v), `${v > 0.333 ? '+' : ''}${((v - 1 / 3) * 100).toFixed(0)}%p`, pct(avg(dealt[h]))];
    })));
    L.push('');
    L.push('### 3.4 원귀별 해원율');
    L.push('');
    const en = Object.entries(C.enemies as Record<string, Json>).sort((a, b) => a[1].rate - b[1].rate);
    L.push(table(['원귀', '해원 조건', '쓰러뜨림', '해원율(전투)', '해원율(원정)'], en.map(([k, v]) => [
      v.name, d.enemyById.get(k)?.haewon.text ?? '', v.kills, pct(v.rate), E?.enemies?.[k] ? pct(E.enemies[k].rate) : '-',
    ])));
    L.push('');
  }

  const cardSrc = C ?? E;
  const pickSrc = E ?? C;
  if (cardSrc) {
    L.push('## 4. 카드');
    L.push('');
    L.push(`사용률 = 사용 횟수 ÷ (전투 시작 덱에 있던 장 수 × 전투 수) — ${C ? '단일 전투 시뮬레이션' : '원정'} 기준. 선택률 = 고른 횟수 ÷ 제시된 횟수 — ${E ? '원정(건너뛰기 허용)' : '전투 시뮬레이션의 드래프트'} 기준. 선택은 봇의 휴리스틱(가치/예산 + 시너지)이 한 것이다.`);
    L.push('');
    const pickOf = (k: string) => (pickSrc.cards as Record<string, Json>)[k] ?? { offered: 0, picked: 0, pickRate: 0 };
    const cards = Object.entries(cardSrc.cards as Record<string, Json>)
      .filter(([, v]) => v.set !== 'common' && v.set !== 'duo')
      .map(([k, v]) => [k, { ...v, offered: pickOf(k).offered, picked: pickOf(k).picked, pickRate: pickOf(k).pickRate }] as [string, Json]);
    const inDeck = cards.filter(([, v]) => v.inDeck >= 30);
    const byPlay = inDeck.slice().sort((a, b) => b[1].playRate - a[1].playRate);
    L.push('### 4.1 사용률 상위 15');
    L.push('');
    L.push(table(['카드', '영웅', '희귀도', '비용', '사용률', '선택률'], byPlay.slice(0, 15).map(([k, v]) => [v.name, HERO_NAMES[v.set as HeroId] ?? v.set, v.rarity, v.cost, f2(v.playRate), v.offered ? pct(v.pickRate) : '-'])));
    L.push('');
    L.push('### 4.2 사용률 하위 15 (덱에 30회 이상 들어간 카드)');
    L.push('');
    L.push(table(['카드', '영웅', '희귀도', '비용', '사용률', '선택률'], byPlay.slice(-15).reverse().map(([k, v]) => [v.name, HERO_NAMES[v.set as HeroId] ?? v.set, v.rarity, v.cost, f2(v.playRate), v.offered ? pct(v.pickRate) : '-'])));
    L.push('');
    const neverPicked = cards.filter(([, v]) => v.offered > 0 && v.picked === 0 && v.rarity !== '기본');
    const neverPlayed = cards.filter(([, v]) => v.inDeck > 0 && v.plays === 0);
    const lowPick = cards.filter(([, v]) => v.offered >= 20 && v.pickRate < 0.05 && v.rarity !== '기본').sort((a, b) => a[1].pickRate - b[1].pickRate);
    L.push('### 4.3 한 번도 고르지 않은 / 쓰지 않은 카드');
    L.push('');
    L.push(`- 제시됐지만 한 번도 고르지 않음 (${neverPicked.length}): ${neverPicked.map(([, v]) => `${v.name}(${HERO_NAMES[v.set as HeroId]})`).join(', ') || '없음'}`);
    L.push(`- 덱에 있었지만 한 번도 쓰지 않음 (${neverPlayed.length}): ${neverPlayed.map(([, v]) => `${v.name}(${HERO_NAMES[v.set as HeroId]})`).join(', ') || '없음'}`);
    L.push(`- 선택률 5% 미만 (제시 20회 이상, ${lowPick.length}): ${lowPick.map(([, v]) => `${v.name} ${pct1(v.pickRate)}`).join(', ') || '없음'}`);
    L.push('');
    L.push('### 4.4 영웅별 평균 사용률·선택률');
    L.push('');
    L.push(table(['영웅', '풀 카드 평균 사용률', '시작 카드 평균 사용률', '평균 선택률'], HERO_IDS.map((h) => {
      const own = cards.filter(([, v]) => v.set === h);
      const pool = own.filter(([, v]) => v.rarity !== '기본' && v.inDeck > 0);
      const st = own.filter(([, v]) => v.rarity === '기본' && v.inDeck > 0);
      const pk = own.filter(([, v]) => v.offered > 0);
      const avg = (xs: [string, Json][], k: string) => (xs.length ? xs.reduce((a, [, v]) => a + v[k], 0) / xs.length : 0);
      return [HERO_NAMES[h], f2(avg(pool, 'playRate')), f2(avg(st, 'playRate')), pct(avg(pk, 'pickRate'))];
    })));
    L.push('');
    L.push('### 4.5 조건 성립률 — 가치 모델의 p 와 실측 (차이가 큰 15개, 평가 200회 이상)');
    L.push('');
    L.push('데이터 p = 카드에 적힌 p, 없으면 모델 기본값(받는소리 0.65 · 경면주사·염주를 쓰면 0.95 · 붕괴 0.15 …, [04-cards §2.1](../04-cards.md)).');
    L.push('');
    const conds = Object.values(cardSrc.conds as Record<string, Json>).filter((c) => c.evaluated >= 200 && c.dataP !== null);
    conds.sort((a, b) => Math.abs(b.rate - b.dataP) - Math.abs(a.rate - a.dataP));
    L.push(table(['카드', '조건', '데이터 p', '실측', '평가 횟수'], conds.slice(0, 15).map((c) => [c.card, c.if, f2(c.dataP), f2(c.rate), c.evaluated])));
    L.push('');
    const resp = Object.values(cardSrc.conds as Record<string, Json>).filter((c) => c.if === '받는소리');
    const ev = resp.reduce((a, c) => a + c.evaluated, 0);
    const tr = resp.reduce((a, c) => a + c.true, 0);
    L.push(`받는소리 조건 전체: 실측 ${ev ? f2(tr / ev) : '-'} (모델 기본 0.65).`);
    L.push('');
    L.push('### 4.6 능력 카드 — 실제 발동 횟수 / 사용 (expect: 카드에 적힌 값, 없으면 턴 시작·종료 5 · 그 밖 3.5 · 이번 턴 트리거 0.15)');
    L.push('');
    const pw = Object.entries(cardSrc.powers as Record<string, Json>).filter(([, v]) => v.played >= 20).sort((a, b) => b[1].firesPerPlay - a[1].firesPerPlay);
    L.push(table(['카드', '사용', '발동', '발동/사용', 'expect'], pw.map(([k, v]) => [d.cardById.get(k)?.name ?? k, v.played, v.fires, f2(v.firesPerPlay), v.dataExpect])));
    L.push('');
    if (cardSrc.pers) {
      L.push('### 4.7 "X 1당"(per) — 실제로 센 수 / 데이터 expect (실행 200회 이상)');
      L.push('');
      const pr = Object.values(cardSrc.pers as Record<string, Json>).filter((v) => v.evaluated >= 200).sort((a, b) => String(a.source).localeCompare(String(b.source)) || b.mean - a.mean);
      L.push(table(['카드', '센 것', '방식', '실행', '평균', 'expect(적힌 값)'], pr.map((v) => [d.cardById.get(v.card)?.name ?? v.card, v.source, v.mode, v.evaluated, f2(v.mean), v.dataExpect ?? '기본'])));
      L.push('');
    }
  }
  // ── what-if 원정 (설계값을 바꾸지 않은 실험) ──
  const whatIfs = readdirSync(resolve(ROOT, 'data/sim')).filter((f) => /^expedition-whatif.*\.json$/.test(f)).sort();
  if (whatIfs.length) {
    L.push('## 5. What-if 원정 (기본 규칙은 그대로, 실험용 변형)');
    L.push('');
    L.push('`npm run sim:expedition -- --between-heal 0.15 --down-shield 0 --enemy-dmg 0.85 --haewon-heal 3 --boss b1 --out expedition-whatif-x` 처럼 실행한다. 준 인자만 기본 규칙을 덮어쓴다: between-heal = 넋 수습 비율, down-shield = 쓰러진 턴 보호(1/0), enemy-dmg = 적 피해 배수, haewon-heal = 해원 회복량, endure = 버팀 비율, sinbaram-v01 = 신바람 옛 규칙, boss = 보스 고정.');
    L.push('');
    const rows: (string | number)[][] = [];
    for (const f of whatIfs) {
      const W = JSON.parse(readFileSync(resolve(ROOT, 'data/sim', f), 'utf8'));
      const w = W.meta.whatIf ?? {};
      const base = W.meta.rules ?? {};
      const r = w.rules ?? {};
      const params = [
        w.betweenHeal !== undefined ? `넋 수습 ${pct(w.betweenHeal)}` : '',
        w.betweenHealFlat !== undefined ? `넋 수습 +${w.betweenHealFlat}` : '',
        w.betweenHealMissing !== undefined ? `넋 수습 잃은 체력의 ${pct(w.betweenHealMissing)}` : '',
        r.downShield !== undefined && r.downShield !== base.downShield ? `쓰러진 턴 보호 ${r.downShield ? '켬' : '끔'}` : '',
        r.enemyDmgMult !== undefined && r.enemyDmgMult !== 1 ? `적 피해 ×${r.enemyDmgMult}` : '',
        r.haewonHeal !== undefined && r.haewonHeal !== base.haewonHeal ? `해원 회복 ${r.haewonHeal}` : '',
        r.endureFrac !== undefined ? `버팀 ${pct(r.endureFrac)}` : '',
        r.sinbaramV01 ? '신바람 v0.1' : '',
        w.boss ? `보스 ${w.boss}` : '',
        w.preBossCamp !== undefined ? `보스 앞 길굿 ${w.preBossCamp ? '켬' : '끔'}` : '',
      ].filter(Boolean).join(', ');
      const b = Object.entries(W.bosses as Record<string, Json>).map(([k, v]) => `${k} ${pct(v.clearRate)}`).join(' / ');
      const dom = W.trios.filter((t: Json) => t.flag === 'dominant').length;
      const dead = W.trios.filter((t: Json) => t.flag === 'dead').length;
      rows.push([f.replace('.json', ''), params, `${pct(W.distribution.min)} / ${pct(W.distribution.median)} / ${pct(W.distribution.max)}`, b, f2(W.trios.reduce((a: number, t: Json) => a + t.deathsPerRun, 0) / W.trios.length), `${dom} / ${dead}`]);
    }
    L.push(table(['파일', '변형', '클리어율 최소/중앙/최대', '보스 격파율', '사망/원정', 'dominant / dead'], rows));
    L.push('');
    for (const f of whatIfs) {
      const W = JSON.parse(readFileSync(resolve(ROOT, 'data/sim', f), 'utf8'));
      L.push(`### ${f.replace('.json', '')}: 조합별 클리어율`);
      L.push('');
      L.push(table(['#', '조합', '클리어율', '사망/원정', '버틴 전투', '플래그'], W.trios.map((t: Json, i: number) => [i + 1, trioName(t.trio), pct(t.clearRate), f2(t.deathsPerRun), f1(t.fightsSurvived), t.flag ? `**${t.flag}**` : ''])));
      L.push('');
      L.push(table(['영웅', '평균 클리어율', '평균 사망/원정'], HERO_IDS.map((h) => [HERO_NAMES[h], pct(W.heroes[h].meanClearRate), f2(W.heroes[h].meanDeaths)])));
      L.push('');
    }
  }
  const DUO = load('combat-duo');
  if (DUO) {
    L.push('## 6. 합기 카드 (변형: 원정 중반 덱 + 그 조합의 합기 3장, `npm run sim:combat -- --duo`)');
    L.push('');
    L.push(`전체 승률 ${pct1(DUO.overall.winRate)} (합기 없음 ${C ? pct1(C.overall.winRate) : '-'}) · 체력 손실 ${f1(DUO.overall.hpLost)} (합기 없음 ${C ? f1(C.overall.hpLost) : '-'})`);
    L.push('');
    const duoCards = Object.entries(DUO.cards as Record<string, Json>).filter(([, v]) => v.set === 'duo').sort((a, b) => b[1].playRate - a[1].playRate);
    L.push(table(['합기', '주인', '비용', '사용률'], duoCards.map(([k, v]) => [v.name, d.cardById.get(k)!.heroes.map((h) => HERO_NAMES[h]).join(' + '), v.cost, f2(v.playRate)])));
    L.push('');
  }
  writeFileSync(resolve(ROOT, 'docs/design/sim-report.md'), L.join('\n'));
}

if (import.meta.url === `file://${process.argv[1]}`) writeReport();
