// sim:expedition — 56개 조합 × N 회 보통 길이 원정 (첫 지역, 보스 b1/b2 무작위).
// 실행: npm run sim:expedition -- --runs 100 --workers 4

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadData as D } from '../core/data.ts';
import { ROOT } from './root.ts';
import { HERO_IDS } from '../core/types.ts';
import { allTrios, mergeCardAgg, mergeCombatAgg, metrics, newCardAgg, newCombatAgg } from './agg.ts';
import { cardTables } from './combat-sim.ts';
import type { ExpeditionJobResult } from './jobs.ts';
import { argNum, argStr, runPool } from './pool.ts';
import { AFTER_FIGHT_RECOVERY, AFTER_FIGHT_RECOVERY_MISSING, PRE_BOSS_CAMP } from './expedition.ts';
import { DEFAULT_RULES, type RuleVariant } from '../core/types.ts';
import type { WhatIf } from './jobs.ts';
import { writeReport } from './report.ts';

const r3 = (x: number) => Math.round(x * 1000) / 1000;

export function flagOf(rate: number, median: number): 'dominant' | 'dead' | '' {
  if (rate > median + 0.25) return 'dominant';
  if (rate < median - 0.25 || rate < 0.05) return 'dead';
  return '';
}

export function median(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function main() {
  const runs = argNum('runs', 100);
  const workers = argNum('workers', 4);
  // what-if: 준 인자만 기본 규칙(DEFAULT_RULES·AFTER_FIGHT_RECOVERY)을 덮어쓴다. 결과는 --out 이름으로 따로 저장한다
  const has = (n: string) => process.argv.includes(`--${n}`);
  const whatIf: WhatIf = {};
  if (has('between-heal')) whatIf.betweenHeal = argNum('between-heal', AFTER_FIGHT_RECOVERY);
  if (has('between-heal-flat')) whatIf.betweenHealFlat = argNum('between-heal-flat', 0);
  if (has('between-heal-missing')) whatIf.betweenHealMissing = argNum('between-heal-missing', 0);
  const rules: RuleVariant = { ...DEFAULT_RULES };
  let ruleArgs = false;
  if (has('enemy-dmg')) { rules.enemyDmgMult = argNum('enemy-dmg', 1); ruleArgs = true; }
  if (has('down-shield')) { rules.downShield = argNum('down-shield', 1) !== 0; ruleArgs = true; }
  if (has('haewon-heal')) { rules.haewonHeal = argNum('haewon-heal', 0); ruleArgs = true; }
  if (has('endure')) { rules.endureFrac = argNum('endure', 0.35); ruleArgs = true; }
  if (has('sinbaram-v01')) { rules.sinbaramV01 = true; ruleArgs = true; }
  if (ruleArgs) whatIf.rules = rules;
  if (has('boss')) whatIf.boss = argStr('boss', '');
  if (has('pre-boss-camp')) whatIf.preBossCamp = argNum('pre-boss-camp', 1) !== 0;
  if (has('pre-boss-heal')) whatIf.preBossHeal = argNum('pre-boss-heal', 1) !== 0;
  const isWhatIf = Object.keys(whatIf).length > 0;
  const region = argNum('region', 1);
  const final = has('final');
  if (region !== 1) whatIf.region = region;
  if (final) whatIf.final = true;
  const outName = argStr('out', region !== 1 ? `expedition-r${region}${final ? '-final' : ''}` : isWhatIf ? 'expedition-whatif' : 'expedition');
  const d = D();
  const trios = allTrios();
  const t0 = performance.now();
  process.stdout.write(`sim:expedition — 지역 ${region}${final ? ' 최종 원정' : ''}, ${trios.length} 조합 × ${runs} 원정, 워커 ${workers}\n`);
  const results = await runPool<ExpeditionJobResult>('expedition', trios, runs, workers, (done, total) => {
    if (done % 8 === 0 || done === total) process.stdout.write(`  ${done}/${total} 조합 (${((performance.now() - t0) / 1000).toFixed(0)}s)\n`);
  }, whatIf);
  const cards = newCardAgg();
  let allAgg = newCombatAgg();
  const bossTot: Record<string, { reached: number; won: number; haewon: number }> = {};
  const wipeTot: Record<string, number> = {};
  const trioRows = results.map((r) => {
    mergeCardAgg(cards, r.cards);
    allAgg = mergeCombatAgg(allAgg, r.agg);
    const n = r.runs.length;
    const boss: Record<string, { reached: number; won: number; haewon: number }> = {};
    const wipes: Record<string, number> = {};
    let cleared = 0, deaths = 0, fights = 0, hae = 0, haeE = 0, heal = 0, remove = 0, deck = 0, skips = 0;
    for (const x of r.runs) {
      if (x.cleared) cleared++;
      deaths += x.deaths;
      fights += x.fightsWon;
      hae += x.haewons;
      haeE += x.haewonEligible;
      deck += x.deckSize;
      skips += x.skips;
      if (x.campChoice === 'heal') heal++;
      if (x.campChoice === 'remove') remove++;
      const b = (boss[x.boss] ??= { reached: 0, won: 0, haewon: 0 });
      const bt = (bossTot[x.boss] ??= { reached: 0, won: 0, haewon: 0 });
      if (x.bossReached) { b.reached++; bt.reached++; }
      if (x.bossWon) { b.won++; bt.won++; }
      if (x.bossHaewon) { b.haewon++; bt.haewon++; }
      if (x.wipedAt) {
        wipes[x.wipedAt] = (wipes[x.wipedAt] ?? 0) + 1;
        wipeTot[x.wipedAt] = (wipeTot[x.wipedAt] ?? 0) + 1;
      }
    }
    const bossRates: Record<string, { reached: number; clearRate: number }> = {};
    for (const [k, v] of Object.entries(boss)) bossRates[k] = { reached: v.reached, clearRate: v.reached ? r3(v.won / v.reached) : 0 };
    return {
      trio: r.trio, heroes: r.trio.split('+'), runs: n, clearRate: r3(cleared / n), deathsPerRun: r3(deaths / n), fightsSurvived: r3(fights / n),
      haewonRate: r3(hae / Math.max(1, haeE)), boss: bossRates, wipes, campHeal: r3(heal / n), campRemove: r3(remove / n), deckSize: r3(deck / n),
      skipsPerRun: r3(skips / n), combat: metrics(r.agg), flag: '' as string,
    };
  });
  const med = median(trioRows.map((t) => t.clearRate));
  for (const t of trioRows) t.flag = flagOf(t.clearRate, med);
  trioRows.sort((a, b) => b.clearRate - a.clearRate);
  const heroes: Record<string, { trios: number; meanClearRate: number; meanDeaths: number }> = {};
  for (const h of HERO_IDS) {
    const rows = trioRows.filter((t) => t.heroes.includes(h));
    heroes[h] = {
      trios: rows.length,
      meanClearRate: r3(rows.reduce((a, t) => a + t.clearRate, 0) / rows.length),
      meanDeaths: r3(rows.reduce((a, t) => a + t.deathsPerRun, 0) / rows.length),
    };
  }
  const bosses: Record<string, { name: string; reached: number; clearRate: number; haewonRate: number }> = {};
  for (const [k, v] of Object.entries(bossTot)) {
    const enc = d.encounterById.get(k)!;
    const bossDef = enc.enemies.map((id) => d.enemyById.get(id)!).find((e) => e.category === 'boss')!;
    bosses[k] = { name: bossDef.name, reached: v.reached, clearRate: v.reached ? r3(v.won / v.reached) : 0, haewonRate: v.won ? r3(v.haewon / v.won) : 0 };
  }
  const clear = trioRows.map((t) => t.clearRate);
  const runtimeSec = Math.round((performance.now() - t0) / 100) / 10;
  // 지역 2·3 메커닉 측정 (05-region2 R2-2·R2-3, 05-region3 R3-3·R3-4·R3-5)
  const allRuns = results.flatMap((r) => r.runs);
  const regionMetrics = region === 1 ? null : {
    sonnim: { met: allRuns.filter((x) => x.sonnim).length, sendoff: allRuns.filter((x) => x.sonnim === 'sendoff').length },
    sinyeolPerExp: { played: r3(allRuns.reduce((a, x) => a + (x.sinyeol?.played ?? 0), 0) / allRuns.length), moved: r3(allRuns.reduce((a, x) => a + (x.sinyeol?.moved ?? 0), 0) / allRuns.length) },
    haewonsPerExp: r3(allRuns.reduce((a, x) => a + x.haewons, 0) / allRuns.length),
    eopgyeong: [0, 1, 2, 3].map((t) => allRuns.filter((x) => x.eopgyeongTier === t).length),
    bossReached: r3(allRuns.filter((x) => x.bossReached).length / allRuns.length),
    bossWinWhenReached: r3(allRuns.filter((x) => x.bossWon).length / Math.max(1, allRuns.filter((x) => x.bossReached).length)),
  };
  const out = {
    meta: {
      generated: new Date().toISOString(), region, final, runs, trios: trios.length, runtimeSec,
      structure: '쉬움 2 + 어려움 7 + 수호 방 1~2 (6번째 전투 뒤 길굿 + 보스 굴 앞 길굿) + 보스 b1/b2' + (region === 2 ? ' + 손님 배웅' : '') + (final ? ' (최종: 업경대 + 빗장을 놓지 못한 장수)' : ''),
      party: region === 1 ? '시작 덱 12장 · 원형 체력' : `전형적인 캠페인 파티 (src/sim/typical.ts TYPICAL[${region}])`,
      rules: { ...DEFAULT_RULES, afterFightRecoveryMissing: AFTER_FIGHT_RECOVERY_MISSING, preBossCamp: PRE_BOSS_CAMP }, whatIf: isWhatIf ? whatIf : null,
    },
    distribution: { min: Math.min(...clear), median: med, max: Math.max(...clear), mean: r3(clear.reduce((a, b) => a + b, 0) / clear.length) },
    trios: trioRows,
    heroes,
    bosses,
    regionMetrics,
    wipes: wipeTot,
    combat: metrics(allAgg),
    ...cardTables(cards),
  };
  const dir = resolve(ROOT, 'data/sim');
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, `${outName}.json`), JSON.stringify(out, null, 1) + '\n');
  process.stdout.write(`완료: 클리어율 최소 ${(out.distribution.min * 100).toFixed(0)}% · 중앙 ${(med * 100).toFixed(0)}% · 최대 ${(out.distribution.max * 100).toFixed(0)}%, ${runtimeSec}s → data/sim/${outName}.json\n`);
  if (region !== 1) {
    const flags = trioRows.filter((t) => t.flag);
    process.stdout.write(`  지배 ${flags.filter((t) => t.flag === 'dominant').length} · 죽은 ${flags.filter((t) => t.flag === 'dead').length} · 해원 ${(r3(trioRows.reduce((a, t) => a + t.haewonRate, 0) / trioRows.length) * 100).toFixed(0)}% · 사망/원정 ${r3(trioRows.reduce((a, t) => a + t.deathsPerRun, 0) / trioRows.length)}\n`);
    process.stdout.write(`  보스: ${Object.entries(bosses).map(([k, v]) => `${v.name} ${(v.clearRate * 100).toFixed(0)}% (해원 ${(v.haewonRate * 100).toFixed(0)}%)`).join(' · ')}\n`);
    process.stdout.write(`  ${JSON.stringify(regionMetrics)}\n`);
    process.stdout.write(`  전멸 위치: ${Object.entries(wipeTot).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`).join(' · ')}\n`);
    return;
  }
  writeReport();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
