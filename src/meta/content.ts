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
  tiers: { cost: { gold?: number; chiseong?: number }; text: string }[];
}

export interface VillageEvent {
  id: string;
  name: string;
  kind: 'good' | 'bad';
  text: string;
  effect: { supplyBonus?: number; reveal?: number; recruitPlus?: number; gold?: number; stress?: number; bond?: number; heal?: number; incense?: number; stressOne?: number };
}

export interface CampaignData {
  names: { surnames: string[]; given: string[] };
  epithets: string[];
  paths: Record<HeroId, { A: string; B: string }>;
  origins: Record<HeroId, string[]>;
  quirks: Quirk[];
  levels: { xp: number[]; seasonedXp: number; hpPerLevel: number; promoteLevel: number; promoteCost: number; xpExpedition: number; xpBoss: number };
  fatigue: { perSortie: number; cap: number };
  idleStressDecay: number;
  stressRetire: number;
  death: { cheondoCost: number; deadline: number; wanderStress: number; bondReact: number; grief: number; resolve: number };
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
  calendar: { seasons: string[]; festivals: { season: number; name: string; kind: 'wanderer' | 'biggut' | 'market'; text: string }[] };
  rift: { max: number; perSeason: number; bossHaewon: number; bossKill: number; strong: number[]; hpMultPerStep: number; countdown: number; sealResetTo: number };
  events: VillageEvent[];
  commissions: Record<string, { family: string; story: string }[]>;
  materials: Record<string, string>;
  engrave: Record<string, string>;
  endings: Record<'good' | 'normal' | 'fail', string>;
}

export const CD = campaignJson as unknown as CampaignData;
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
