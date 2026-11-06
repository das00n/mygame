// 캠페인 모드 (docs/09-campaign-spec.md): 마을 ⇄ 원정. 캠페인 규칙은 src/meta (순수 TS), 여기서는 화면 흐름에 잇는다.

import { defaultFormation } from '../../../src/core/engine.ts';
import type { CardInst, HeroState } from '../../../src/core/types.ts';
import { autoVillage, chooseCommission, chooseParty, chooseSupplies } from '../../../src/meta/bot.ts';
import { newCampaign, planExpedition, settle } from '../../../src/meta/campaign.ts';
import type { Campaign, ExpeditionPlan, ExpeditionReport, Supplies } from '../../../src/meta/types.ts';
import { beginExpedition, blankApp } from './actions.ts';
import { D } from './content.ts';
import { objective } from './dungeon.ts';
import { bossEnemyIds } from './run.ts';
import type { AppState, Run } from './types.ts';

export function startCampaign(app: AppState, seed: number, rift = true): void {
  Object.assign(app, blankApp());
  app.campaign = newCampaign(seed, { rift });
  app.screen = 'village';
}

/** 출정 계획 → 원정 덱 (각인 g 포함) */
export function planDeck(plan: ExpeditionPlan): CardInst[] {
  const d = D();
  return plan.deck.map((c) => {
    const def = d.cardById.get(c.id)!;
    return c.g ? { d: def.idx, o: c.o, o2: c.o2, orig: -1, x: -1, g: c.g } : { d: def.idx, o: c.o, o2: c.o2, orig: -1, x: -1 };
  });
}

/** 기본 진형 (엔진 defaultFormation 과 같은 기준) */
export function planFormation(plan: ExpeditionPlan): number[] {
  const d = D();
  const hs = plan.party.map((h, idx) => ({ id: h, idx, melee: d.heroes.get(h)!.range === 'melee', maxHp: plan.heroes[idx].maxHp, dead: false }) as HeroState);
  return defaultFormation(hs);
}

/** 의뢰판에서 출정: 계획을 세우고(선금·보급품) 원정을 시작한다. 실패하면 이유 */
export function depart(app: AppState, commissionId: string, uids: string[], buy: Partial<Supplies>, formation?: number[]): string | null {
  const c = app.campaign!;
  const plan = planExpedition(c, commissionId, uids, buy);
  if (typeof plan === 'string') return plan;
  app.plan = plan;
  const cm = plan.commission;
  beginExpedition(app, {
    seed: (c.seed ^ Math.imul(c.expeditions + 1, 0x9e3779b1)) | 0, commission: cm.length === 'normal' ? 'normal' : 'boss', party: plan.party,
    formation: formation ?? planFormation(plan), supplies: { ...plan.supplies }, gold: 0, spent: 0, region: cm.region,
    campaign: { length: cm.length, uids: plan.uids.slice(), enemyHpMult: plan.enemyHpMult, ancestorSave: plan.ancestorSave ?? 0 }, heroes: plan.heroes.map((h) => ({ maxHp: h.maxHp, stress: h.stress, injured: h.injured, level: h.level })),
    deck: planDeck(plan), codex: c.codex, firstJangdan: plan.firstJangdan,
  });
  return null;
}

/** 끝난 원정(app.run · app.result) → 캠페인 귀환 보고 */
export function reportFromRun(app: AppState): ExpeditionReport {
  const run = app.run!;
  const res = app.result!;
  const d = D();
  const length = run.campaign?.length ?? 'normal';
  const dg = run.dungeon;
  const bossDone = dg.boss >= 0 && !!dg.rooms[dg.boss].content.done;
  const bossIds = bossEnemyIds(run);
  const bossHaewon = bossIds.some((id) => (run.track.haewonById[id] ?? 0) > 0);
  const success = res.success && (length === 'normal' ? objective(run).met : bossDone);
  const wiped = !res.success && /쓰러졌다|길어졌다/.test(res.reason);
  const plays = run.heroes.map(() => ({}) as Record<string, number>);
  for (const [id, n] of Object.entries(run.stats.plays)) {
    const def = d.cardById.get(id);
    if (!def || def.ownerKind !== 'hero') continue;
    const hi = run.party.indexOf(def.heroes[0]);
    const base = d.cards[def.baseIdx].id;
    if (hi >= 0) plays[hi][base] = (plays[hi][base] ?? 0) + n;
  }
  return {
    success, retreated: !res.success && !wiped, wiped, bossWon: length !== 'normal' && bossDone, bossHaewon,
    heroes: run.heroes.map((h, i) => ({ hp: h.hp, maxHp: h.baseMax, dead: h.dead, injured: h.injured, stress: h.stress, plays: plays[i] })),
    revived: run.track.revived.slice(), haewons: run.stats.haewons, haewonById: { ...run.track.haewonById }, haewonByFamily: { ...run.track.haewonByFamily },
    killByFamily: { ...run.track.killByFamily }, gold: Math.max(0, run.gold), chiseong: run.chiseong, cheondo: run.track.cheondo.slice(), bondsGained: { ...run.track.bondPairs },
    met: run.track.met.slice(), leftover: { ...run.supplies }, sonnim: run.flags.sonnimDone ? ((run.track.haewonById.sonnim_baeung ?? 0) > 0 ? 'sendoff' : 'timeout') : null,
    keepsakes: (run.track.keepsakes ?? []).slice(),
  };
}

/** 결과 화면 → 마을로: 결산 */
export function settleRun(app: AppState): void {
  const c = app.campaign!;
  const plan = app.plan!;
  const report = reportFromRun(app);
  const st = settle(c, plan, report);
  app.settlement = st;
  app.plan = null;
  app.run = null;
  app.result = null;
  app.combat = null;
  app.reward = null;
  app.dialog = null;
  app.picker = null;
  app.camp = null;
  app.screen = 'settle';
}

export function leaveSettlement(app: AppState): void {
  app.settlement = null;
  app.screen = app.campaign?.ending ? 'ending' : 'village';
}

// ── 내보내기 · 가져오기 (텍스트 코드) ─────────────────────────────────
const PREFIX = 'JSG1:';

function toB64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromB64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** 마을 상태를 텍스트 코드로 (기록은 최근 것만) */
export function exportCode(c: Campaign): string {
  const slim: Campaign = { ...c, log: c.log.slice(-40), history: c.history.slice(-60) };
  return PREFIX + toB64(JSON.stringify(slim));
}

export function importCode(text: string): Campaign | string {
  try {
    const t = text.trim().replace(/\s+/g, '');
    if (!t.startsWith(PREFIX)) return '저승굿 캠페인 코드가 아니다 (JSG1: 로 시작해야 한다)';
    const c = JSON.parse(fromB64(t.slice(PREFIX.length))) as Campaign;
    if (!c || c.v !== 1 || !Array.isArray(c.roster) || typeof c.season !== 'number') return '코드를 읽을 수 없다';
    return c;
  } catch {
    return '코드를 읽을 수 없다 (잘렸거나 바뀌었다)';
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (globalThis.navigator?.clipboard?.writeText) {
      await globalThis.navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 복사가 막혀 있으면 화면에 코드를 보여 준다 */
  }
  return false;
}

// ── 자동 진행 (마을) ───────────────────────────────────────────────
/** 마을·결산·결말 화면에서 한 걸음. 둘 것이 없으면 false */
export function autoCampaignStep(app: AppState): boolean {
  const c = app.campaign;
  if (!c) return false;
  if (app.screen === 'settle') {
    leaveSettlement(app);
    return true;
  }
  if (app.screen === 'result' && app.run && app.plan) {
    settleRun(app);
    return true;
  }
  if (app.screen !== 'village' || c.ending) return false;
  autoVillage(c);
  const uids = chooseParty(c);
  if (!uids) return false;
  const cm = chooseCommission(c, uids);
  if (!cm) return false;
  const err = depart(app, cm.id, uids, chooseSupplies(c, cm));
  if (err) {
    app.toast = err;
    return false;
  }
  return true;
}

export function isCampaignRun(run: Run | null): boolean {
  return !!run?.campaign;
}
