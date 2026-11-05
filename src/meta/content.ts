// 캠페인 정적 데이터 (data/design/campaign.json). Node·브라우저 공통 정적 import.

import campaignJson from '../../data/design/campaign.json' with { type: 'json' };
import type { HeroId } from '../core/types.ts';
import type { CommissionLength, FacilityId, Supplies, SupplyId } from './types.ts';

export interface Quirk {
  id: string;
  name: string;
  good: boolean;
  text: string;
  effect: { saveBonus?: number; maxHp?: number; stressMult?: number; startBlock?: number; startWeak?: number; recovery?: number; gold?: number };
}

export interface FacilityDef {
  id: FacilityId;
  name: string;
  start: number;
  lot: string;
  /** 시설을 지키는 가신 (⟨반복 4⟩ 06-base §4.1). 신은 잊혀도 사라지지 않는다 */
  guardian?: string;
  tiers: { cost: { gold?: number; chiseong?: number }; text: string }[];
}

export interface VillageEvent {
  id: string;
  name: string;
  kind: 'good' | 'bad';
  /** 이 원형이 로스터에 있을 때만 뽑힌다 (⟨반복 5⟩ 법사 안택) */
  requires?: HeroId;
  text: string;
  effect: { supplyBonus?: number; reveal?: number; recruitPlus?: number; gold?: number; stress?: number; bond?: number; heal?: number; incense?: number; stressOne?: number; chiseong?: number };
}

/** 출신 인연 (⟨반복 5⟩ A-01): arch 의 origin 번째 출신이면 with 원형과 인연 bond 로 시작 */
export interface OriginBond {
  arch: HeroId;
  origin: number;
  with: HeroId;
  bond: number;
  why: string;
}

export interface CampaignData {
  names: { surnames: string[]; given: string[] };
  epithets: string[];
  paths: Record<HeroId, { A: string; B: string }>;
  origins: Record<HeroId, string[]>;
  quirks: Quirk[];
  levels: {
    xp: number[]; seasonedXp: number; hpPerLevel: number; promoteLevel: number; promoteCost: number; xpExpedition: number; xpBoss: number;
    /** 따라잡기 (⟨반복 3⟩): 로스터 최고 레벨보다 catchUpGap 이상 낮은 영웅은 원정마다 경험 +catchUpXp 더 */
    catchUpGap: number; catchUpXp: number;
  };
  fatigue: { perSortie: number; cap: number };
  idleStressDecay: number;
  stressRetire: number;
  death: {
    cheondoCost: number; deadline: number; wanderStress: number; bondReact: number; grief: number; resolve: number;
    /** 캠페인 원정에서 전멸했을 때 쓰러진 영웅마다 마지막 사망 판정을 버틸 확률 (단판 원정은 0.5) ⟨반복 3⟩ */
    wipeSurvive: number;
    /** 캠페인 전투의 사망 판정(쓰러진 채 맞을 때) 버틸 확률 보정 — 처벌 강도 ⟨반복 3⟩ */
    deathSave: number;
    /** 최종 원정의 처벌 강도 (⟨반복 5⟩, 없으면 위 값): 열두째 대문 앞에서는 쓰러진 넋을 데려올 길이 짧다 */
    final?: { wipeSurvive?: number; deathSave?: number };
  };
  bonds: { together: number; rescue: number; camp: number; duoAt: number };
  facilities: FacilityDef[];
  economy: {
    startGold: number; startRoster: number; recruitCost: number; restCost: number; treatCost: number; quirkCost: number; loadoutSwapCost: number;
    exchangeLoss: number; materialValue: number; pay: Record<CommissionLength | 'seal', number>; advance: number;
    haewonMaterials: number; killMaterials: number; killSoul: number; engraveCost: number;
    /** 캠페인 원정의 엽전 전리품 배율 (단판 원정은 1) */
    dropGold: number;
  };
  provisions: {
    prices: Supplies;
    max: Supplies;
    recommended: Record<string, Partial<Record<CommissionLength, Supplies>>>;
  };
  calendar: { seasons: string[]; festivals: { season: number; name: string; kind: 'wanderer' | 'biggut' | 'market' | 'singugan'; text: string }[] };
  /** 최종 원정이 열리는 조건: 3지역 보스 길을 이만큼 마친 뒤 */
  finalUnlock: { bossWins: number };
  rift: { max: number; perSeason: number; bossHaewon: number; bossKill: number; strong: number[]; hpMultPerStep: number; countdown: number; sealResetTo: number };
  events: VillageEvent[];
  originBonds: OriginBond[];
  /** 건축 연출 (⟨반복 5⟩ V-11 황우양 집짓기): 단계를 오를 때마다 stages → done */
  build: { stages: string[]; done: string; why: string };
  /** 아직 짓지 않는 터 (⟨반복 5⟩ V-06 장승·솟대 터 = 문전 + 오방토신) */
  sites: { id: string; name: string; guardian: string; text: string }[];
  commissions: Record<string, { family: string; story: string }[]>;
  materials: Record<string, string>;
  engrave: Record<string, string>;
  endings: Record<'good' | 'normal' | 'fail', string>;
}

export const CD = campaignJson as unknown as CampaignData;

/** 원정 길이에 맞는 처벌 강도 (⟨반복 5⟩ 최종 원정은 death.final 로 덮어쓴다) */
export function deathRules(length: CommissionLength | null | undefined): { wipeSurvive: number; deathSave: number } {
  const f = length === 'final' ? CD.death.final : undefined;
  return { wipeSurvive: f?.wipeSurvive ?? CD.death.wipeSurvive, deathSave: f?.deathSave ?? CD.death.deathSave };
}
export const QUIRK_BY_ID = new Map(CD.quirks.map((q) => [q.id, q]));
export const FACILITY_BY_ID = new Map(CD.facilities.map((f) => [f.id, f]));
export const SUPPLY_IDS: SupplyId[] = ['candle', 'rice', 'incense', 'jijeon', 'bujeok', 'sul'];
export const SUPPLY_NAMES: Record<SupplyId, string> = { candle: '촛불', rice: '쌀', incense: '향', jijeon: '지전', bujeok: '부적', sul: '술' };
export const REGION_NAMES: Record<number, string> = { 1: '건너지 못한 나루', 2: '역병 든 마을', 3: '열두 대문' };
export const LENGTH_NAMES: Record<CommissionLength, string> = { normal: '보통 길', boss: '보스 길', final: '최종 원정' };

export function emptySupplies(): Supplies {
  return { candle: 0, rice: 0, incense: 0, jijeon: 0, bujeok: 0, sul: 0 };
}

export function seasonName(season: number): string {
  const s = CD.calendar.seasons;
  return `${Math.floor(season / s.length) + 1}년 ${s[season % s.length]}`;
}

/** 절기 번호(1~24) — 명절 표의 season 과 같은 셈 */
export function seasonOfYear(season: number): number {
  return (season % CD.calendar.seasons.length) + 1;
}
