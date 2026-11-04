// 플레이어블 원정의 상태 타입. 모두 JSON 으로 저장할 수 있는 순수 데이터다(전투 상태의 Map 은 save.ts 가 처리).

import type { CardInst, CombatState, HeroId } from '../../../src/core/types.ts';
import type { Settlement } from '../../../src/meta/campaign.ts';
import type { Campaign, CommissionLength, ExpeditionPlan } from '../../../src/meta/types.ts';
import type { CommissionId, SupplyId } from './content.ts';

export type ContentKind = 'empty' | 'battle' | 'curio' | 'trap' | 'event' | 'elite' | 'boss' | 'entrance';

export interface Content {
  k: ContentKind;
  /** curio/trap/event id, 또는 전투 조합 id (처음 마주칠 때 정한다) */
  id?: string;
  done?: boolean;
}

export interface Room {
  id: number;
  x: number;
  y: number;
  kind: 'entrance' | 'normal' | 'guard' | 'ferry' | 'boss';
  content: Content;
  visited: boolean;
  known: boolean; // 내용이 보이는가 (정찰·방문)
  camp: boolean;
  campUsed: boolean;
}

export interface Tile {
  content: Content;
  walked: boolean;
  known: boolean;
}

export interface Corridor {
  id: number;
  a: number; // room id (tiles[0] 이 a 쪽)
  b: number;
  tiles: Tile[];
}

export interface Dungeon {
  w: number;
  h: number;
  rooms: Room[];
  corridors: Corridor[];
  entrance: number;
  boss: number; // boss den room id, -1
  ferry: number; // 보스 굴 앞 방, -1
}

export type Pos = { kind: 'room'; room: number } | { kind: 'tile'; cor: number; i: number };

export interface PHero {
  id: HeroId;
  hp: number;
  baseMax: number;
  stress: number;
  injured: boolean;
  recovering: boolean;
  dead: boolean;
  downs: number;
}

export interface RunStats {
  fights: number;
  wins: number;
  haewons: number;
  haewonEligible: number;
  kills: number;
  escapes: number;
  downs: number;
  deaths: number;
  revives: number;
  plays: Record<string, number>;
  cardsTaken: number;
  cardsSkipped: number;
  /** 강화한 카드 수 (v0.3) */
  upgrades: number;
  tilesWalked: number;
  candlesUsed: number;
  curios: number;
  traps: number;
  events: number;
  camps: number;
  hpLost: number;
  startedAt: number;
  playMs: number;
}

/** 다음 전투에 걸리는 효과 */
export interface NextFight {
  firstStrike?: boolean; // 선제 확정
  ambush?: boolean; // 기습당함 확정
  jangdan?: number; // 첫 턴 장단
  shuffle?: boolean; // 진형 섞임
  gunpowder?: number; // 포수 화약
  blade?: boolean; // 작두 위에서 시작
  momju?: boolean; // 몸주 신령을 모시고 시작
  aura?: number; // 차사 오라
  talismans?: number; // 법사 화부
  drawBonus?: number; // 첫 턴 드로우
  wounds: number[]; // 상처 카드 주인 (hero idx)
  /** 신열 카드 주인 (hero idx) — 지역 2 덫·기물 */
  fevers?: number[];
  /** 첫 턴 파티 약화 */
  weakAll?: number;
  /** 첫 턴 무작위 영웅 홀림 */
  possess?: number;
  /** 진형을 자유롭게 바꾸고 시작 (싸리말 탈꾼) */
  freeForm?: boolean;
  /** 첫 턴 차사 방어도 (서낭 앞 고사 자리) */
  chasaBlock?: number;
}

/** 지역 2·3 원정 상태 (손님 배웅·업경대·까마귀 등) */
export interface RunFlags {
  sonnimDone?: boolean;
  /** 손님 배웅 시작 대접 (+4) */
  sonnimStart?: number;
  /** 서운한 작별·쫓아냄: 전투 시작 시 신열 1장 */
  sonnimPenalty?: boolean;
  /** 대문에 부적: 역귀 전투마다 신열 +1장 */
  sealPenalty?: boolean;
  /** 손님의 배웅 가호가 없어도 이번 원정 동안 신열 무료 (가호로만) */
  crow?: boolean;
  /** 업경대가 미리 푼 매듭 비트 */
  knots?: number;
  eopTier?: number;
  yaksuUsed?: boolean;
  /** 다음 대문 방 통행 무료 */
  gateFree?: number;
  haenggimotUsed?: boolean;
  /** 길굿 끼니 회복 +%p (약술) */
  mealBonus?: number;
  /** 다음 N전투 첫 턴 장단 */
  jangdanFights?: { n: number; left: number };
}

/** 캠페인 결산에 넘길 원정 기록 */
export interface RunTrack {
  haewonById: Record<string, number>;
  haewonByFamily: Record<string, number>;
  killByFamily: Record<string, number>;
  met: string[];
  revived: number[];
  cheondo: number[];
  bondPairs: Record<string, number>;
}

export interface CampaignRunInfo {
  length: CommissionLength;
  uids: string[];
  enemyHpMult: number;
}

export interface Run {
  v: 3;
  /** 지역 1~3 */
  region: number;
  /** 캠페인 원정이면 출정 계획 요약 */
  campaign: CampaignRunInfo | null;
  flags: RunFlags;
  track: RunTrack;
  seed: number;
  rng: number;
  commission: CommissionId;
  bossEnc: string | null;
  party: HeroId[];
  formation: number[];
  heroes: PHero[];
  deck: CardInst[];
  supplies: Record<SupplyId, number>;
  gold: number;
  goldSpent: number;
  materials: number;
  chiseong: number;
  light: number;
  relics: string[];
  dungeon: Dungeon;
  pos: Pos;
  prevRoom: number;
  next: NextFight;
  /** 해원 조건이 공개된 원귀 id (해원록) */
  revealed: string[];
  bonds: Record<string, number>;
  /** 씌임 임계치 보너스 (헛굿 판) */
  threshold: number;
  noNightRaid: boolean;
  fightsSeen: number; // 처음 치른 전투 수 (쉬움 2 → 어려움)
  bags: { hard: string[]; elite: string[]; lastHard: string | null };
  pity: number;
  daegamCounter: number;
  stats: RunStats;
  log: string[];
  ended: boolean;
}

export type BattleSource =
  | { k: 'room'; room: number }
  | { k: 'tile'; cor: number; i: number }
  | { k: 'raid' }
  | { k: 'event'; id: string };

export interface BattleMeta {
  enc: string;
  tier: 'easy' | 'hard' | 'elite' | 'boss' | 'event';
  src: BattleSource;
  cardReward: boolean;
  special: 'none' | 'play' | 'escort' | 'sonnim';
  start: 'first' | 'ambush' | 'normal';
  shadows: number;
  enemyDmg: number;
  hpBefore: number[];
  stressBefore: number[];
  threshold: number;
  fleeTries: number;
  jeseokRun: number;
  jeseokTurn: number;
  sansinTurn: number;
  log: string[];
  /** 마지막으로 처리한 적 상태 (쓰러짐 알림용) */
  seenDead: number[]; // 알림을 띄운 적 uid
  toasts: { text: string; tone: 'haewon' | 'kill' | 'info' | 'bad' }[];
  turnStartedAt: number;
}

export interface CombatSession {
  s: CombatState;
  meta: BattleMeta;
}

export type FlagColor = 'red' | 'white' | 'yellow' | 'blue' | 'black';

export interface RewardState {
  title: string;
  gold: number;
  materials: number;
  lines: string[];
  cards: string[] | null; // card def ids
  cardsTaken: boolean;
  flags: { colors: FlagColor[]; peek: number; picked: number } | null;
  relics: string[] | null; // 고를 가호
  relicPicked: boolean;
  rareCards: string[] | null; // 파랑 깃발
  rarePicked: boolean;
  bossEnd: boolean;
}

export type DialogKind = 'curio' | 'event' | 'trap';
export interface DialogState {
  kind: DialogKind;
  id: string;
  /** 결과 문장이 정해지면 선택지 대신 보인다 */
  result: string | null;
  /** 결과 뒤 이어지는 동작 */
  then: 'none' | 'battle' | 'cards' | 'remove' | 'transform' | 'formation' | 'upgrade' | 'upgrade_baksu' | 'upgrade_hero';
  battleEnc?: string;
  battleSpecial?: 'none' | 'play' | 'escort' | 'sonnim';
  /** upgrade_hero: 이 영웅 카드만 */
  upgradeHero?: HeroId;
  cardOptions?: string[];
}

export type PickerMode = 'remove' | 'transform' | 'purge' | 'offer' | 'formation' | 'sul' | 'upgrade';
export interface PickerState {
  mode: PickerMode;
  title: string;
  /** offer: 고를 카드 def id. 나머지는 덱 index 목록 */
  offer?: string[];
  allowed?: number[];
  cost?: { points?: number; supply?: SupplyId };
  from: 'camp' | 'map' | 'dialog' | 'shrine';
}

export interface CampState {
  points: number;
  meal: boolean;
  used: string[];
  raid: number; // 밤 습격 확률
  done: boolean;
  room: number;
}

export interface ResultState {
  success: boolean;
  reason: string;
  commission: CommissionId;
  party: HeroId[];
  heroes: PHero[];
  stats: RunStats;
  gold: number;
  materials: number;
  chiseong: number;
  roomsVisited: number;
  roomsTotal: number;
  light: number;
  relics: string[];
  deckSize: number;
  region: number;
  campaign: boolean;
}

export type Screen = 'title' | 'shrine' | 'map' | 'combat' | 'reward' | 'camp' | 'result' | 'village' | 'settle' | 'ending';

export interface Settings {
  auto: boolean;
  speed: 'normal' | 'fast' | 'instant';
}

export interface AppState {
  screen: Screen;
  run: Run | null;
  combat: CombatSession | null;
  reward: RewardState | null;
  dialog: DialogState | null;
  picker: PickerState | null;
  camp: CampState | null;
  result: ResultState | null;
  toast: string | null;
  /** 캠페인 (없으면 단판 원정) */
  campaign: Campaign | null;
  plan: ExpeditionPlan | null;
  settlement: Settlement | null;
}
