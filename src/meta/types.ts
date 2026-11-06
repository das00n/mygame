// 캠페인 루프 v1 상태 (docs/09-campaign-spec.md). 모두 JSON 으로 저장·내보내기할 수 있는 순수 데이터다.

import type { HeroId } from '../core/types.ts';

export type FacilityId = 'sindang' | 'gaekju' | 'jumak' | 'yakbang' | 'sadang' | 'mugubang' | 'jeonsucheong' | 'jangteo';
export type SupplyId = 'candle' | 'rice' | 'incense' | 'jijeon' | 'bujeok' | 'sul';
export type Supplies = Record<SupplyId, number>;
export type CommissionLength = 'normal' | 'boss' | 'final';

export interface Engraving {
  /** 각인한 카드 (기본판 id, 로드아웃 카드) */
  card: string;
  /** 재료 계열 (→ 상태) */
  family: string;
  status: string;
}

export interface PersonHistory {
  expeditions: number;
  haewons: number;
  /** 구한 동료 수 (쓰러진 동료가 일어날 때 함께 있었다) */
  saved: number;
  lastCard: string | null;
  /** 지금까지 낸 자기 카드 (기본판 id → 횟수) — 신물 고르기 */
  plays: Record<string, number>;
  joined: number;
  bosses: number;
}

export interface Person {
  uid: string;
  name: string;
  /** 내림굿(승급)으로 받은 별호 */
  epithet: string | null;
  arch: HeroId;
  origin: number;
  good: string; // 좋은 기질 id
  bad: string | null; // 나쁜 기질 id (약방에서 없앨 수 있다)
  level: number;
  xp: number;
  path: 'A' | 'B' | null;
  learned: string[];
  loadout: string[];
  engraving: Engraving | null;
  stress: number;
  /** 연속 출전 횟수 (피로: 최대 체력 −5%씩, 상한 −20%) */
  sorties: number;
  injured: boolean;
  /** 이번 절기 묶인 일: 휴식(주막) · 치료(약방) */
  busy: 'rest' | 'treat' | null;
  /** 다음 원정에만 걸리는 인연의 반응 (05 §2) */
  grief: boolean;
  resolve: boolean;
  /** 신어머니(조상신) uid */
  mother: string | null;
  history: PersonHistory;
}

export interface Fallen {
  person: Person;
  died: number; // 절기
  cause: string;
  where: string;
  /** 천도굿을 받았는가 → 조상신 */
  honored: boolean;
  /** 이 절기까지 천도굿을 치르지 않으면 떠도는 넋이 된다 */
  deadline: number;
  wandering: boolean;
  /** 신물 카드 id (천도굿 뒤) */
  sinmul: string | null;
  /** 신딸(이 조상신을 신어머니로 이은 신입) uid */
  daughter: string | null;
}

export interface Commission {
  id: string;
  region: number;
  length: CommissionLength;
  family: string;
  story: string;
  pay: number;
  advance: number;
  /** 균열 봉합 원정 */
  seal: boolean;
}

export interface ExpeditionLog {
  season: number;
  commission: Commission;
  party: string[];
  success: boolean;
  retreated: boolean;
  wiped: boolean;
  bossHaewon: boolean;
  deaths: string[];
  haewons: number;
  gold: number;
}

export interface CampaignSettings {
  /** 저승문 균열 카운트다운 (난이도 설정에서 끌 수 있다) */
  rift: boolean;
}

export interface Ending {
  kind: 'good' | 'normal' | 'fail';
  season: number;
  expeditions: number;
}

export interface Campaign {
  v: 1;
  seed: number;
  rng: number;
  season: number;
  expeditions: number;
  gold: number;
  chiseong: number;
  materials: Record<string, number>;
  stock: Supplies;
  roster: Person[];
  fallen: Fallen[];
  bonds: Record<string, number>;
  facilities: Record<FacilityId, number>;
  lots: string[];
  rift: number;
  countdown: number | null;
  settings: CampaignSettings;
  /** 지역 보스: 처음 해원·처치한 절기, 이긴 횟수 */
  bosses: Record<number, { first: number; wins: number; haewon: number }>;
  commissions: Commission[];
  candidates: Person[];
  /** 이번 절기 행사 (명절) 문장 */
  festival: string | null;
  /** 지난 귀환 때 뽑은 마을 이벤트 */
  lastEvent: string | null;
  /** 다음 원정에 따라오는 것 (이벤트) */
  bonusSupplies: Partial<Supplies>;
  /** 해원록: 해원 조건을 아는 원귀 · 해원한 원귀 횟수 */
  codex: string[];
  haewonSeen: Record<string, number>;
  /** 사당에 둔 골동: 막방광침에서 남긴 원귀의 물건 (⟨반복 4⟩). 옛 저장에는 없다 */
  keepsakes?: { enemy: string; season: number }[];
  log: string[];
  history: ExpeditionLog[];
  ending: Ending | null;
  nextUid: number;
  /** 무료 영입 (설) 이 남았는가 */
  freeRecruit: boolean;
  /** 균열 카운트다운이 시작된 횟수 */
  countdownHits?: number;
}

/** 원정 계층(시뮬 또는 플레이어블)이 캠페인에 돌려주는 결과 */
export interface ExpeditionReport {
  /** 의뢰 목표 달성 (보통 길: 끝까지 · 보스 길: 보스 · 최종: 최종 큰 원귀) */
  success: boolean;
  retreated: boolean;
  wiped: boolean;
  bossWon: boolean;
  bossHaewon: boolean;
  heroes: { hp: number; maxHp: number; dead: boolean; injured: boolean; stress: number; plays: Record<string, number> }[];
  /** 기상한 영웅 (파티 index) */
  revived: number[];
  haewons: number;
  haewonById: Record<string, number>;
  haewonByFamily: Record<string, number>;
  killByFamily: Record<string, number>;
  gold: number;
  chiseong: number;
  /** 원정 안 길굿 천도굿을 받은 파티 index */
  cheondo: number[];
  /** 원정 안 길굿 인연 다지기 등 (파티 index 쌍 'a+b' → 정) */
  bondsGained: Record<string, number>;
  /** 원정에서 만난 원귀 (해원록) */
  met: string[];
  leftover: Partial<Supplies>;
  sonnim: 'sendoff' | 'timeout' | null;
  /** 막방광침에서 남긴 물건 — 해원한 원귀 id (⟨반복 4⟩ 02-core-rules §13). 시뮬 원정은 없다 */
  keepsakes?: string[];
}

/** 출정 계획: 원정 계층이 읽는 파티·덱·보급품 */
export interface ExpeditionPlan {
  commission: Commission;
  uids: string[];
  party: HeroId[];
  heroes: {
    id: HeroId; maxHp: number; stress: number; injured: boolean; saveBonus: number; stressMult: number; startBlock: number; startWeak: number; recovery: number;
    /** 레벨 (원형 고유 방어가 자란다, ⟨반복 4⟩) — 옛 저장에는 없다 */
    level?: number;
  }[];
  /** 덱: 카드 id + 주인(파티 index, 파티 카드 −1) + 각인 */
  deck: { id: string; o: number; o2: number; g?: number }[];
  supplies: Supplies;
  enemyHpMult: number;
  /** 결의: 첫 전투 첫 턴 장단 */
  firstJangdan: number;
  /** 떠도는 넋·슬픔: 출발 귀기 */
  stressAdd: number[];
  duoCards: string[];
  sinmul: string[];
  /** 조상신의 보살핌 (⟨반복 6⟩): 사망 판정 버틸 확률 보정 — 옛 저장에는 없다 */
  ancestorSave?: number;
}
