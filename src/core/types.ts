// 저승굿 Prototype ① — 엔진 공용 타입
// 데이터(JSON)의 모양과 전투 상태를 정의한다. 상태는 lookahead 를 위해 싸게 복제할 수 있어야 한다.

export type HeroId =
  | 'manshin' | 'jaebi' | 'posu' | 'baksu' | 'seungnyeo' | 'beopsa' | 'talggun' | 'chasa';

export const HERO_IDS: HeroId[] = ['manshin', 'jaebi', 'posu', 'baksu', 'seungnyeo', 'beopsa', 'talggun', 'chasa'];

export const HERO_NAMES: Record<HeroId, string> = {
  manshin: '만신', jaebi: '잽이', posu: '포수', baksu: '작두박수',
  seungnyeo: '승려', beopsa: '법사', talggun: '탈꾼', chasa: '차사',
};

/** 적에게 붙는 상태 (취약·약화는 범용) */
export type EnemyStatus = '취약' | '약화' | '점지' | '상흔' | '명부' | '넋흔들림';

// ── 카드 효과 연산(op) — data/cards/*.json 의 effects 트리 ──────────────────
export interface RawOp {
  op: string;
  n?: number | 'all';
  [k: string]: unknown;
}

export interface RawCard {
  id: string;
  name: string;
  type?: string;
  rarity?: string;
  cost: number;
  starter?: boolean;
  path?: string;
  keywords?: string[];
  text: string;
  effects: RawOp[];
  tags?: { produce?: string[]; consume?: string[] };
  owners?: string[];
  owner?: string;
  subtype?: string;
}

export interface RawSummon {
  id: string;
  name: string;
  trigger: 'turn_start' | 'turn_end';
  duration?: number;
  text: string;
  effects: RawOp[];
}

// ── 정적 정의 (로드 시 한 번 만든다) ─────────────────────────────────────
export type OwnerKind = 'hero' | 'duo' | 'party' | 'dynamic';

export interface CardDef {
  idx: number;
  id: string;
  name: string;
  set: string; // 영웅 id | 'duo' | 'common'
  type: string; // 공격·기술·능력·저주·상태
  rarity: string;
  cost: number;
  ownerKind: OwnerKind;
  heroes: HeroId[]; // hero: [h], duo: [a, b], party/dynamic: []
  keywords: string[];
  exhaust: boolean; // 소멸
  ethereal: boolean; // 휘발
  unplayable: boolean; // 사용 불가
  innate: boolean; // 선천
  retain: boolean; // 보존
  text: string;
  effects: Op[];
  starter: boolean;
  path: string;
  isToken: boolean;
  isAttack: boolean;
  isPower: boolean;
  isCurse: boolean; // 저주
  isStatus: boolean; // 상태
  subtype: string;
  tags: { produce: string[]; consume: string[] };
  value: number; // 가치 모델 점수 (04-cards §2)
  budget: number;
  /** 적 하나를 고르는가 */
  needsEnemy: boolean;
  /** "다른 적 하나" 를 쓰는가 */
  needsEnemy2: boolean;
  /** 아군 선택 방식 (봇이 열거) */
  allyChoice: 'none' | 'ally' | 'pair' | 'downed';
  requireGangsin: boolean;
  /** 합기: 마지막으로 공격하는 영웅(돌격 판정) */
  dashHero: HeroId | null;
  /** 합기 이동·방어 문장에서 행동하는 영웅 */
  actorFor: Partial<Record<'전진' | '후퇴' | '엄호' | '방어도', HeroId>>;
  holdFront: boolean; // "선두를 내주지 않는다"
  raisesSinjuCap: boolean; // 경면주사 5까지
  deferTokens: boolean; // "다음 턴 시작 시" 부적
  /** 'one' 연산을 조건 만족 적 모두에게 (적 전체 카드의 "점지된 적에게는") */
  perEnemyOneConds: boolean;
}

export interface SummonDef {
  idx: number;
  id: string;
  name: string;
  trigger: 'turn_start' | 'turn_end';
  duration: number;
  text: string;
  effects: Op[];
  value: number;
  autoTarget: AutoTarget;
}

export type AutoTarget = 'front' | 'random' | 'lowestHp' | 'mostDoom';

// ── 컴파일된 op ────────────────────────────────────────────────────────
export type TargetSel = 'one' | 'all' | 'random';

export type Op =
  | { op: 'dmg'; n: number; hits: number; target: TargetSel }
  | { op: 'block'; n: number; to: 'self' | 'ally' | 'party' }
  | { op: 'draw'; n: number }
  | { op: 'discard'; n: number }
  | { op: 'energy'; n: number; when: 'now' | 'next' }
  | { op: 'apply'; status: EnemyStatus; n: number; target: TargetSel }
  | { op: 'jangdan'; n: number }
  | { op: 'personal'; n: number; hero: HeroId | null }
  | { op: 'move'; kind: '전진' | '후퇴' | '교대' | '엄호'; who: string | null; mode: 'self' | 'ally' | 'pair' | 'owners' | 'downed'; when: string | null }
  | { op: 'summon'; id: string; sidx: number }
  | { op: 'token'; id: string; tidx: number; n: number }
  | { op: 'heal'; n: number; to: 'ally' | 'party' | 'self' }
  | { op: 'stress'; n: number; to: 'party' | 'owner'; when: string | null }
  | { op: 'cleanse'; n: number }
  | { op: 'exhaust_other'; n: number }
  | { op: 'hp_loss'; n: number }
  | { op: 'per'; source: string; each: Op[]; expect: number | null; max: number | null; mode: PerMode; key: string }
  | { op: 'cond'; cond: Cond; then: Op[]; p: number; ifText: string; key: string }
  | { op: 'power'; trigger: Trigger; effects: Op[]; expect: number | null; gate: Gate | null; requireStance: boolean; key: string; autoTarget: AutoTarget }
  | { op: 'consume'; status: string | null; source: string | null; n: number | 'all' | null }
  | { op: 'special'; value: number; note: string; kind: SpecialKind; key: string };

export type PerMode =
  | 'status' // 대상(또는 적마다)의 상태 스택
  | 'jangdan' | 'summons' | 'tokens_played' | 'tokens_hand' | 'personal' | 'hand' | 'shadow'
  | 'formation_trigger' // "이번 턴 진형이 바뀔 때마다" → 이번 턴 임시 트리거
  | 'formation_count' // "이번 턴 진형이 바뀐 횟수"
  | 'tal_count'
  | 'turn_end_defer' // "이번 턴 종료 시 남은 장단 1당" → 턴 종료에 처리
  | 'expect'; // 측정 불가 → 기대값

export type Gate = { res: string; n: number };

export type Trigger =
  | 'turn_start' | 'turn_end' | 'on_attack' | 'on_hit' | 'on_bind' | 'on_formation_change' | 'on_formation_change_first'
  | 'on_talggun_move' | 'on_talggun_move_first' | 'on_token_play' | 'on_gangsin' | 'on_consume_mark'
  | 'on_owner_card' | 'on_summon_fire' | 'on_jangdan5' | 'unknown';

export type SpecialKind =
  | 'baraji' | 'samhyeon' | 'fire_summon' | 'gangsin_extra' | 'instant_collapse' | 'tal_all' | 'seokja' | 'ajik'
  | 'rescue_ally' | 'sinryeongbu' | 'gokkal_tal' | 'rescue' | 'offering' | 'heotgeot' | 'approx';

export type Cond =
  | { k: 'resp' }
  | { k: 'resp_summon' }
  | { k: 'tstat'; st: EnemyStatus; n: number; orCollapse: boolean }
  | { k: 'tcollapse' }
  | { k: 'tbound' }
  | { k: 'jangdan'; n: number }
  | { k: 'slot'; slot: number; neg: boolean; who: 'owner' | 'talggun' }
  | { k: 'stance' }
  | { k: 'gangsin_req' }
  | { k: 'gangsin' }
  | { k: 'prev_manshin' }
  | { k: 'summons'; n: number }
  | { k: 'summons_empty_res'; res: string; n: number }
  | { k: 'res'; res: string; n: number }
  | { k: 'hand_token' }
  | { k: 'formchg'; n: number }
  | { k: 'garak_max' }
  | { k: 'garak_down' }
  | { k: 'jangdan5' }
  | { k: 'hand_shadow' }
  | { k: 'ally_downed' }
  | { k: 'any_downed' }
  | { k: 'drawn_curse' }
  | { k: 'always' }
  | { k: 'attacked_chasa' }
  | { k: 'blade_fall' }
  | { k: 'stochastic' };

// ── 적 ───────────────────────────────────────────────────────────────
export interface RawIntent {
  id: string;
  name: string;
  kind: string;
  target: string;
  damage?: number;
  hits?: number;
  block?: number;
  effect?: string;
  phase?: number;
}

export interface RawPattern {
  type: 'cycle' | 'weighted' | 'phased';
  order?: string[];
  weights?: Record<string, number>;
  first?: string;
  no_repeat?: number;
  override?: string;
  phases?: RawPattern[] & { until_hp_pct?: number }[];
  until_hp_pct?: number;
}

export interface HaewonRule {
  kind: 'status' | 'jangdan' | 'summons' | 'token' | 'formation' | 'collapse' | 'offering' | 'minions' | 'none';
  status?: EnemyStatus;
  n?: number;
  /** 무리 해원: 같은 원귀 하나가 조건을 채우면 그 전투의 같은 원귀 모두 해원 (잡귀, v0.2 S9) */
  group?: boolean;
  orCollapse?: boolean;
  text: string;
}

export interface EnemyDef {
  idx: number;
  id: string;
  name: string;
  category: 'normal' | 'elite' | 'minion' | 'boss';
  hpMin: number;
  hpMax: number;
  intents: RawIntent[];
  pattern: RawPattern;
  passives: string[];
  haewon: HaewonRule;
  family: string;
}

export interface Encounter {
  id: string;
  tier: 'easy' | 'hard' | 'elite' | 'boss';
  enemies: string[];
}

export interface HeroDef {
  id: HeroId;
  name: string;
  range: 'melee' | 'ranged';
  role: string;
  hp: number;
}

// ── 전투 상태 ──────────────────────────────────────────────────────────
/** 카드 한 장(불변 객체). 바뀔 때는 새 객체로 바꾼다 → 더미 복제가 slice 한 번으로 끝난다 */
export interface CardInst {
  readonly d: number; // CardDef.idx
  readonly o: number; // 주인 영웅 index (0..2), 파티 = -1
  readonly o2: number; // 합기 두 번째 주인, 없으면 -1
  readonly orig: number; // 구조·애도로 바뀌기 전 카드, 없으면 -1
  readonly x: number; // 부가 정보 (신령부: 담은 설치물 idx), 없으면 -1
}

export interface HeroState {
  id: HeroId;
  idx: number;
  melee: boolean;
  maxHp: number;
  hp: number;
  block: number;
  downed: boolean;
  dead: boolean;
  downs: number;
  rescue: number;
  rescueNeed: number;
  survived: number; // 사망 판정을 버틴 횟수
  weak: number;
  possess: number; // 홀림
  stress: number;
  personal: number;
  personalCap: number;
  stance: boolean; // 작두 위
  recovering: boolean; // 회복 중 (주는 피해 −10%)
  injured: boolean; // 중상
  cover: number; // 이번 턴 엄호하는 아군 idx
  downTurn: number; // 쓰러진 턴 (같은 적 턴 사망 집계)
  endDowned: boolean; // 전투가 끝날 때 쓰러져 있었음 (체력 1·중상으로 일어남)
}

export interface EnemyState {
  def: number;
  uid: number;
  hp: number;
  maxHp: number;
  block: number;
  vuln: number;
  weak: number;
  mark: number;
  bleed: number;
  doom: number;
  shake: number;
  endure: number;
  collapseUntil: number;
  cancelNext: boolean;
  bound: boolean;
  atkBonus: number;
  intent: number; // def.intents index, -1 = 없음
  patIdx: number;
  last: number; // 직전 의도
  lastRun: number; // 같은 의도 연속 횟수
  phase: number;
  turnsActed: number;
  alive: boolean;
  dead: boolean;
  escaped: boolean;
  haewon: boolean;
  lastHitToken: boolean;
  summoned: boolean; // 상여가 소환한 넋
}

export interface SummonInst {
  s: number; // SummonDef.idx
  left: number;
  owner: number;
}

export interface PowerInst {
  card: number; // CardDef idx (출처)
  op: Extract<Op, { op: 'power' }>;
  owner: number;
  owner2: number;
  temp: boolean; // 이번 턴만
  firedTurn: number; // "매 턴 처음" 판정
  /** 임시 트리거가 실행할 효과(진형 per 등)를 덮어쓴다 */
  effects: Op[];
  trigger: Trigger;
  /** 임시 on_hit: 공격한 적에게 효과 */
  againstAttacker: boolean;
}

export interface CombatStats {
  plays: Map<string, number>;
  condEval: Map<string, [number, number]>; // key → [평가, 성립]
  powerFires: Map<string, number>;
  specialUse: Map<string, number>;
  dmgTakenHero: number[]; // hero idx
  dmgTakenSlot: number[]; // 0..2
  jangdanTurnSum: number; // 턴 종료 직전 장단 합
  turnsCounted: number;
  respPlays: number; // 받는소리 성립 카드 수
  respEligible: number; // 턴 첫 카드가 아닌 카드 수
  cardPlays: number;
  downs: number;
  deaths: number;
  sameTurnDeaths: number; // 쓰러진 그 적 턴에 사망
  revives: number;
  gangsin: number;
  collapses: number;
  executions: number; // 명부 처형
  kills: number;
  haewons: number;
  haewonEligible: number; // 해원 조건이 있는 적을 쓰러뜨린 수
  haewonHealed: number; // 해원 회복으로 얻은 체력
  escapes: number;
  enemyHaewon: Map<string, [number, number]>; // enemy id → [쓰러뜨림, 해원]
  heroDmgDealt: number[];
}

/** 규칙 변형 (what-if 실험용, 기본값 = 설계 문서 그대로) */
export interface RuleVariant {
  enemyDmgMult: number; // 적 피해 배수
  /** 쓰러진 턴 보호 (핵심 규칙 §6, v0.2 S3): 쓰러진 그 적 턴에는 그 영웅을 노린 공격이 가장 앞의 서 있는 영웅에게 간다 */
  downShield: boolean;
  endureFrac?: number; // 버팀 = 최대 체력 × 이 값 (기본 0.35)
  /** 신바람 v0.1 규칙(직전 카드도 만신일 때만 +1)으로 되돌린다 — 비교 실험용 */
  sinbaramV01?: boolean;
  /** 해원할 때 서 있는 영웅 모두 체력 회복 (탐험 §10, v0.2 S1). 0 이면 없음 */
  haewonHeal?: number;
}

/** 규칙 v0.4 기본값 (docs/02-core-rules.md §6·§13·§14) */
export const DEFAULT_RULES: RuleVariant = { enemyDmgMult: 1, downShield: true, haewonHeal: 3 };

export interface CombatState {
  rng: number;
  rules: RuleVariant;
  turn: number;
  heroes: HeroState[];
  formation: number[]; // 앞 → 뒤, 죽은 영웅 제외
  enemies: EnemyState[];
  nextUid: number;
  draw: CardInst[];
  hand: CardInst[];
  discard: CardInst[];
  exhaust: CardInst[];
  powerZone: CardInst[];
  energy: number;
  nextEnergy: number;
  jangdan: number;
  prevOwners: number[] | null; // 이번 턴 직전 카드의 주인들 (파티 = [-1])
  tokensPlayed: number;
  formChanges: number;
  talChanges: number;
  summons: SummonInst[];
  powers: PowerInst[];
  gangsin: boolean;
  gangsinExtra: number;
  baraji: number;
  talAll: boolean;
  garakLocked: boolean;
  seokja: boolean;
  ajik: boolean;
  holdFront: number; // 이번 턴 선두를 내주지 않는 영웅 idx
  statusAdded: number; // 이번 전투에 새로 들어온 상태·씌임 카드 수 (최대 4)
  offeringPaid: boolean;
  groupHaewon: string[]; // 무리 해원이 성립한 원귀 id
  jijeon: number; // 지전
  deferredTokens: number[]; // 다음 턴 시작에 만들 부적 (CardDef idx | owner<<16)
  outcome: 0 | 1 | -1;
  lastDrawn: CardInst | null;
  stats: CombatStats | null;
  /** 원정 쪽으로 넘길 새 씌임 카드 (hero idx, CardDef idx) */
  newCurses: [number, number][];
  log: string[] | null;
}

export interface ActionChoice {
  hand: number; // 손패 index
  enemy: number; // 적 index, -1
  enemy2: number;
  ally: number; // 영웅 idx, -1
  pair: [number, number] | null;
}
