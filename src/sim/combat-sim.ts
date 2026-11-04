// sim:combat — 56개 조합 × 첫 지역 전투 15종 × N 시드. 덱 = 시작 12장 + 봇이 고른 풀 카드 8장(원정 중반).
// 실행: npm run sim:combat -- --seeds 40 --workers 4

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadData as D } from '../core/data.ts';
import { ROOT } from './root.ts';
import { fidelityReport, opIndex } from '../core/fidelity.ts';
import { HERO_IDS } from '../core/types.ts';
import { allTrios, mergeCardAgg, mergeCombatAgg, metrics, newCardAgg, newCombatAgg, type CombatAgg } from './agg.ts';
import type { CombatJobResult } from './jobs.ts';
import { argFlag, argNum, argStr, runPool } from './pool.ts';
import { writeReport } from './report.ts';

export function cardTables(cards: ReturnType<typeof newCardAgg>) {
  const d = D();
  const idx = opIndex();
  const cardRows: Record<string, { name: string; set: string; rarity: string; type: string; cost: number; plays: number; inDeck: number; playRate: number; offered: number; picked: number; pickRate: number }> = {};
  for (const c of d.cards) {
    if (c.isToken) continue;
    const plays = cards.plays[c.id] ?? 0;
    const inDeck = cards.inDeck[c.id] ?? 0;
    const offered = cards.offered[c.id] ?? 0;
    const picked = cards.picked[c.id] ?? 0;
    cardRows[c.id] = {
      name: c.name, set: c.set, rarity: c.rarity, type: c.type, cost: c.cost, plays, inDeck,
      playRate: inDeck ? Math.round((plays / inDeck) * 1000) / 1000 : 0, offered, picked, pickRate: offered ? Math.round((picked / offered) * 1000) / 1000 : 0,
    };
  }
  const tokenPlays: Record<string, number> = {};
  for (const c of d.cards) if (c.isToken) tokenPlays[c.id] = cards.plays[c.id] ?? 0;
  const conds: Record<string, { card: string; if: string; evaluated: number; true: number; rate: number; dataP: number | null }> = {};
  for (const [k, [ev, tr]] of Object.entries(cards.cond)) {
    const ref = idx.get(k);
    const op = ref?.op;
    conds[k] = {
      card: ref?.owner ?? k, if: op && op.op === 'cond' ? op.ifText : '', evaluated: ev, true: tr, rate: ev ? Math.round((tr / ev) * 1000) / 1000 : 0,
      dataP: op && op.op === 'cond' ? op.p : null,
    };
  }
  const powers: Record<string, { played: number; fires: number; firesPerPlay: number; dataExpect: number }> = {};
  for (const c of d.cards) {
    const pw = c.effects.find((o) => o.op === 'power');
    if (!pw || pw.op !== 'power') continue;
    const played = cards.plays[c.id] ?? 0;
    const fires = cards.powerFires[c.id] ?? 0;
    powers[c.id] = { played, fires, firesPerPlay: played ? Math.round((fires / played) * 100) / 100 : 0, dataExpect: pw.expect ?? 3.5 };
  }
  const enemies: Record<string, { name: string; kills: number; haewon: number; rate: number }> = {};
  for (const [k, [kills, h]] of Object.entries(cards.enemy)) {
    enemies[k] = { name: d.enemyById.get(k)?.name ?? k, kills, haewon: h, rate: kills ? Math.round((h / kills) * 1000) / 1000 : 0 };
  }
  return { cards: cardRows, tokens: tokenPlays, conds, powers, enemies, special: cards.special };
}

async function main() {
  const seeds = argNum('seeds', 40);
  const workers = argNum('workers', 4);
  const duo = argFlag('duo'); // 합기 3장을 덱에 더한 변형 (기본: 없음)
  const outName = argStr('out', duo ? 'combat-duo' : 'combat');
  const d = D();
  const trios = allTrios();
  const t0 = performance.now();
  process.stdout.write(`sim:combat — ${trios.length} 조합 × ${d.encounters.length} 전투 × ${seeds} 시드 = ${trios.length * d.encounters.length * seeds} 전투, 워커 ${workers}\n`);
  const results = await runPool<CombatJobResult>('combat', trios, seeds, workers, (done, total) => {
    if (done % 8 === 0 || done === total) process.stdout.write(`  ${done}/${total} 조합 (${((performance.now() - t0) / 1000).toFixed(0)}s)\n`);
  }, undefined, duo);
  const cards = newCardAgg();
  const encTotals: Record<string, CombatAgg> = {};
  for (const e of d.encounters) encTotals[e.id] = newCombatAgg();
  const trioRows = results.map((r) => {
    let overall = newCombatAgg();
    const perEnc: Record<string, ReturnType<typeof metrics>> = {};
    for (const [enc, agg] of Object.entries(r.perEnc)) {
      overall = mergeCombatAgg(overall, agg);
      encTotals[enc] = mergeCombatAgg(encTotals[enc], agg);
      perEnc[enc] = metrics(agg);
    }
    mergeCardAgg(cards, r.cards);
    return { trio: r.trio, heroes: r.trio.split('+'), overall: metrics(overall), perEnc };
  });
  const heroes: Record<string, { trios: number; meanWinRate: number; meanHpLost: number }> = {};
  for (const h of HERO_IDS) {
    const rows = trioRows.filter((t) => t.heroes.includes(h));
    heroes[h] = {
      trios: rows.length,
      meanWinRate: Math.round((rows.reduce((a, t) => a + t.overall.winRate, 0) / rows.length) * 1000) / 1000,
      meanHpLost: Math.round((rows.reduce((a, t) => a + t.overall.hpLost, 0) / rows.length) * 10) / 10,
    };
  }
  let all = newCombatAgg();
  for (const a of Object.values(encTotals)) all = mergeCombatAgg(all, a);
  const encounters: Record<string, ReturnType<typeof metrics> & { tier: string; enemies: string[] }> = {};
  for (const e of d.encounters) encounters[e.id] = { ...metrics(encTotals[e.id]), tier: e.tier, enemies: e.enemies };
  const runtimeSec = Math.round((performance.now() - t0) / 100) / 10;
  const out = {
    meta: { generated: new Date().toISOString(), seeds, trios: trios.length, encounters: d.encounters.length, combats: all.n, runtimeSec, deck: duo ? '시작 12장 + 봇 드래프트 8장 + 합기 3장' : '시작 12장 + 봇 드래프트 8장 (일반 보상 확률)' },
    fidelity: fidelityReport(),
    overall: metrics(all),
    trios: trioRows,
    encounters,
    heroes,
    ...cardTables(cards),
  };
  const dir = resolve(ROOT, 'data/sim');
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, `${outName}.json`), JSON.stringify(out, null, 1) + '\n');
  process.stdout.write(`완료: ${all.n} 전투, 전체 승률 ${(metrics(all).winRate * 100).toFixed(1)}%, ${runtimeSec}s → data/sim/${outName}.json\n`);
  writeReport();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
