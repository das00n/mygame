// sim:campaign — 봇이 캠페인을 처음부터 결말까지 N 번 돈다 (docs/09-campaign-spec.md §9).
// 실행: npm run sim:campaign [-- --runs 100 --workers 4 --no-rift --out campaign]
// 마을 결정은 src/meta/bot.ts 의 단순 규칙, 원정은 src/sim/expedition.ts (봇 전투).

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { availableParallelism } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { seedFrom } from '../core/rng.ts';
import { autoVillage, BOT, chooseCommission, chooseParty, chooseSupplies } from '../meta/bot.ts';
import { ancestors, maxHpOf, newCampaign, passSeason, planExpedition, settle, tier } from '../meta/campaign.ts';
import type { Campaign } from '../meta/types.ts';
import { runPlan } from './campaign-run.ts';
import { argNum, argStr } from './pool.ts';
import { ROOT } from './root.ts';

export const MAX_EXPEDITIONS = 90;

interface ExpRow {
  n: number;
  region: number;
  length: string;
  seal: boolean;
  success: boolean;
  retreated: boolean;
  wiped: boolean;
  bossHaewon: boolean;
  deaths: number;
  level: number;
  learned: number;
  engraved: number;
  sinmul: number;
  duo: number;
  hpBonus: number;
  haewons: number;
  sonnim: string | null;
  eop: number;
  rift: number;
}

export interface CampaignResult {
  seed: number;
  ending: string;
  expeditions: number;
  seasons: number;
  deaths: number;
  rosterAvg: number;
  countdown: boolean;
  builds: { id: string; tier: number; at: number }[];
  regionOpenAt: Record<number, number>;
  rows: ExpRow[];
  finalAttempts: number;
  gold: number;
  ancestors: number;
  maxLevel: number;
}

export function runCampaign(seed: number, opts: { rift?: boolean } = {}): CampaignResult {
  const c: Campaign = newCampaign(seed, { rift: opts.rift ?? true });
  const rows: ExpRow[] = [];
  const builds: CampaignResult['builds'] = [];
  const regionOpenAt: Record<number, number> = { 1: 0 };
  let rosterSum = 0;
  let rosterN = 0;
  let countdown = false;
  let idle = 0;
  const seenTier: Record<string, number> = { ...c.facilities };
  while (!c.ending && c.expeditions < MAX_EXPEDITIONS && idle < 12) {
    autoVillage(c);
    for (const [k, v] of Object.entries(c.facilities)) if ((seenTier[k] ?? 0) < v) {
      for (let t = (seenTier[k] ?? 0) + 1; t <= v; t++) builds.push({ id: k, tier: t, at: c.expeditions });
      seenTier[k] = v;
      if (k === 'sindang') regionOpenAt[v] = c.expeditions;
    }
    if (c.countdown !== null) countdown = true;
    const uids = chooseParty(c);
    if (!uids) {
      passSeason(c);
      idle++;
      continue;
    }
    const cm = chooseCommission(c, uids);
    if (!cm) {
      passSeason(c);
      idle++;
      continue;
    }
    rosterSum += c.roster.length;
    rosterN++;
    const buy = chooseSupplies(c, cm);
    const plan = planExpedition(c, cm.id, uids, buy);
    if (typeof plan === 'string') {
      passSeason(c);
      idle++;
      continue;
    }
    idle = 0;
    const people = uids.map((u) => c.roster.find((p) => p.uid === u)!);
    const paths: Record<string, 'A' | 'B'> = {};
    for (const p of people) if (p.path) paths[p.arch] = p.path;
    const { result, report } = runPlan(plan, seedFrom(seed, 'exp', c.expeditions), { below: BOT.retreatBelow, boss: BOT.bossRetreatBelow }, paths);
    rows.push({
      n: c.expeditions, region: cm.region, length: cm.length, seal: cm.seal, success: report.success, retreated: report.retreated, wiped: report.wiped,
      bossHaewon: report.bossHaewon, deaths: report.heroes.filter((h) => h.dead).length, level: people.reduce((a, p) => a + p.level, 0) / 3,
      learned: people.reduce((a, p) => a + p.learned.length, 0) / 3, engraved: people.filter((p) => p.engraving).length, sinmul: plan.sinmul.length,
      duo: plan.duoCards.length, hpBonus: people.reduce((a, p) => a + maxHpOf(p), 0) / 3, haewons: report.haewons, sonnim: report.sonnim,
      eop: result.eopgyeongTier ?? -1, rift: c.rift,
    });
    settle(c, plan, report);
    if (c.countdown !== null) countdown = true;
  }
  return {
    seed, ending: c.ending?.kind ?? (c.expeditions >= MAX_EXPEDITIONS ? 'cap' : 'stuck'), expeditions: c.expeditions, seasons: c.season,
    deaths: c.fallen.length, rosterAvg: rosterN ? rosterSum / rosterN : 0, countdown: countdown || (c.countdownHits ?? 0) > 0, builds, regionOpenAt,
    rows, finalAttempts: rows.filter((r) => r.length === 'final').length, gold: c.gold, ancestors: ancestors(c).length,
    maxLevel: Math.max(0, ...c.roster.map((p) => p.level)),
  };
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => {
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0;
};

const quantile = (xs: number[], q: number) => {
  const s = xs.slice().sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)] : 0;
};

export function summarize(res: CampaignResult[]) {
  const ended = res.filter((r) => r.ending === 'good' || r.ending === 'normal');
  const allRows = res.flatMap((r) => r.rows);
  const clear: Record<string, { n: number; ok: number; retreat: number; wipe: number; haewon: number; deaths: number }> = {};
  for (const row of allRows) {
    const k = `r${row.region}-${row.length}${row.seal ? '-seal' : ''}`;
    const v = (clear[k] ??= { n: 0, ok: 0, retreat: 0, wipe: 0, haewon: 0, deaths: 0 });
    v.n++;
    if (row.success) v.ok++;
    if (row.retreated) v.retreat++;
    if (row.wiped) v.wipe++;
    if (row.bossHaewon) v.haewon++;
    v.deaths += row.deaths;
  }
  const clearRates: Record<string, { n: number; clear: number; retreat: number; wipe: number; bossHaewon: number; deathsPer: number }> = {};
  for (const [k, v] of Object.entries(clear)) clearRates[k] = { n: v.n, clear: r3(v.ok / v.n), retreat: r3(v.retreat / v.n), wipe: r3(v.wipe / v.n), bossHaewon: r3(v.haewon / Math.max(1, v.ok)), deathsPer: r3(v.deaths / v.n) };
  // 지역마다 처음 들어간 보스 원정의 파티 (지역 시뮬의 '전형적인 파티' 근거)
  const typical: Record<number, { level: number; learned: number; engraved: number; sinmul: number; duo: number; maxHp: number }> = {};
  for (const region of [1, 2, 3]) {
    const firsts = res.map((r) => r.rows.find((x) => x.region === region && x.length !== 'normal')).filter((x): x is ExpRow => !!x);
    const allR = allRows.filter((x) => x.region === region);
    typical[region] = {
      level: r3(mean(allR.map((x) => x.level))), learned: r3(mean(allR.map((x) => x.learned))), engraved: r3(mean(allR.map((x) => x.engraved))),
      sinmul: r3(mean(allR.map((x) => x.sinmul))), duo: r3(mean(allR.map((x) => x.duo))), maxHp: r3(mean(allR.map((x) => x.hpBonus))),
    };
    void firsts;
  }
  const buildOrder: Record<string, number[]> = {};
  for (const r of res) for (const b of r.builds) (buildOrder[`${b.id}${b.tier}`] ??= []).push(b.at);
  const buildMedian: Record<string, { median: number; share: number }> = {};
  for (const [k, v] of Object.entries(buildOrder)) buildMedian[k] = { median: median(v), share: r3(v.length / res.length) };
  const finals = allRows.filter((x) => x.length === 'final');
  return {
    runs: res.length,
    endings: {
      good: res.filter((r) => r.ending === 'good').length, normal: res.filter((r) => r.ending === 'normal').length, fail: res.filter((r) => r.ending === 'fail').length,
      cap: res.filter((r) => r.ending === 'cap').length, stuck: res.filter((r) => r.ending === 'stuck').length,
    },
    expeditionsToEnding: { median: median(ended.map((r) => r.expeditions)), mean: r3(mean(ended.map((r) => r.expeditions))), min: Math.min(...ended.map((r) => r.expeditions)), max: Math.max(...ended.map((r) => r.expeditions)) },
    inTarget25to40: r3(ended.filter((r) => r.expeditions >= 25 && r.expeditions <= 40).length / Math.max(1, res.length)),
    /** 원정 수 90번째 백분위 (결말과 관계없이 모든 캠페인) ⟨반복 3⟩ */
    expeditionsP90: quantile(res.map((r) => r.expeditions), 0.9),
    deaths: { median: median(res.map((r) => r.deaths)), mean: r3(mean(res.map((r) => r.deaths))), inTarget3to8: r3(res.filter((r) => r.deaths >= 3 && r.deaths <= 8).length / res.length) },
    rosterAvg: r3(mean(res.map((r) => r.rosterAvg))),
    countdownReached: r3(res.filter((r) => r.countdown).length / res.length),
    clearRates,
    finalBoss: { attempts: finals.length, won: finals.filter((x) => x.success).length, rate: r3(finals.filter((x) => x.success).length / Math.max(1, finals.length)), haewon: finals.filter((x) => x.bossHaewon).length },
    sonnim: { met: allRows.filter((x) => x.sonnim).length, sendoff: allRows.filter((x) => x.sonnim === 'sendoff').length },
    eopgyeong: [0, 1, 2, 3].map((t) => finals.filter((x) => x.eop === t).length),
    typical,
    regionOpenAt: { 2: median(res.map((r) => r.regionOpenAt[2]).filter((x) => x !== undefined)), 3: median(res.map((r) => r.regionOpenAt[3]).filter((x) => x !== undefined)) },
    buildOrder: buildMedian,
    maxLevel: r3(mean(res.map((r) => r.maxLevel))),
    goldEnd: { median: median(res.map((r) => r.gold)), mean: r3(mean(res.map((r) => r.gold))) },
  };
}

async function main() {
  const runs = argNum('runs', 100);
  const workers = Math.max(1, Math.min(argNum('workers', 4), availableParallelism()));
  const rift = !process.argv.includes('--no-rift');
  const outName = argStr('out', 'campaign');
  const t0 = performance.now();
  process.stdout.write(`sim:campaign — 캠페인 ${runs}회, 워커 ${workers}${rift ? '' : ', 균열 카운트다운 끔'}\n`);
  const seeds = Array.from({ length: runs }, (_, i) => seedFrom('campaign', i + 1));
  const results: CampaignResult[] = new Array(runs);
  let next = 0;
  let done = 0;
  await new Promise<void>((res, rej) => {
    for (let k = 0; k < workers; k++) {
      const w = new Worker(new URL(import.meta.url), { execArgv: ['--import', 'tsx'], workerData: { rift } });
      const feed = () => {
        if (next >= runs) {
          w.terminate();
          return;
        }
        const i = next++;
        w.postMessage({ i, seed: seeds[i] });
      };
      w.on('message', (m: { i: number; r?: CampaignResult; error?: string }) => {
        if (m.error) return rej(new Error(m.error));
        results[m.i] = m.r!;
        done++;
        if (done % 10 === 0 || done === runs) process.stdout.write(`  ${done}/${runs} (${((performance.now() - t0) / 1000).toFixed(0)}s)\n`);
        if (done === runs) {
          w.terminate();
          res();
        } else feed();
      });
      w.on('error', rej);
      feed();
    }
  });
  const sum = summarize(results);
  const out = {
    meta: { generated: new Date().toISOString(), runs, rift, runtimeSec: Math.round((performance.now() - t0) / 100) / 10, bot: BOT, maxExpeditions: MAX_EXPEDITIONS },
    summary: sum,
    campaigns: results.map((r) => ({ seed: r.seed, ending: r.ending, expeditions: r.expeditions, seasons: r.seasons, deaths: r.deaths, rosterAvg: r3(r.rosterAvg), countdown: r.countdown, builds: r.builds, ancestors: r.ancestors, maxLevel: r.maxLevel })),
  };
  const dir = resolve(ROOT, 'data/sim');
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, `${outName}.json`), JSON.stringify(out, null, 1) + '\n');
  const s = sum;
  process.stdout.write(
    `결말 ${s.endings.good + s.endings.normal}/${runs} (좋은 ${s.endings.good} · 보통 ${s.endings.normal} · 실패 ${s.endings.fail} · 상한 ${s.endings.cap} · 막힘 ${s.endings.stuck})\n` +
    `결말까지 원정 중앙 ${s.expeditionsToEnding.median} (평균 ${s.expeditionsToEnding.mean}, ${s.expeditionsToEnding.min}~${s.expeditionsToEnding.max}) · 25~40 안 ${(s.inTarget25to40 * 100).toFixed(0)}% · P90 ${s.expeditionsP90}\n` +
    `사망 중앙 ${s.deaths.median} (평균 ${s.deaths.mean}) · 3~8 안 ${(s.deaths.inTarget3to8 * 100).toFixed(0)}% · 로스터 평균 ${s.rosterAvg} · 카운트다운 도달 ${(s.countdownReached * 100).toFixed(0)}%\n` +
    `최종 보스 ${s.finalBoss.won}/${s.finalBoss.attempts} (${(s.finalBoss.rate * 100).toFixed(0)}%, 해원 ${s.finalBoss.haewon}) · 지역 2 개방 원정 ${s.regionOpenAt[2]} · 지역 3 ${s.regionOpenAt[3]}\n` +
    `클리어율: ${Object.entries(s.clearRates).sort().map(([k, v]) => `${k} ${(v.clear * 100).toFixed(0)}%(${v.n})`).join(' · ')}\n` +
    `→ data/sim/${outName}.json\n`,
  );
}

if (!isMainThread && parentPort) {
  const wd = workerData as { rift: boolean };
  parentPort.on('message', (m: { i: number; seed: number }) => {
    try {
      parentPort!.postMessage({ i: m.i, r: runCampaign(m.seed, { rift: wd.rift }) });
    } catch (e) {
      parentPort!.postMessage({ i: m.i, error: String((e as Error).stack ?? e) });
    }
  });
} else if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { tier };
