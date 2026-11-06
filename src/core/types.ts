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
  /** 강화판 (K1, v0.3): 빠진 필드는 기본판을 물려받는다 */
  upgrade?: RawUpgrade;
}

export interface RawUpgrade {
  text: string;
  cost?: number;
  keywords?: string[];
  effects?: RawOp[];
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
  /** 'one' 연산을 조건 만족 적 모두에게 (적 전체 카드의 "점지된 적에게는") */
  perEnemyOneConds: boolean;
  /** 강화판 정의인가 (id 는 기본판 id + '+'). 강화된 카드 인스턴스는 d 가 이 정의를 가리킨다 */
  upgraded: boolean;
  /** 강화판이면 기본판 idx, 아니면 자기 idx */
  baseIdx: number;
  /** 기본판이면 강화판 idx (강화가 없으면 −1), 강화판이면 −1 */
  upIdx: number;
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
/** 효과 대상: one = 고른 적 · all · random · other = 「다른 적 하나」(두 번째 대상, 동명이인의 '옮겨 받은 적') ⟨반복 3⟩ */
export type TargetSel = 'one' | 'all' | 'random' | 'other';

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
  | { op: 'token'; id: string; tidx: number; n: number; nextTurn: boolean }
  | { op: 'heal'; n: number; to: 'ally' | 'party' | 'self' }
  | { op: 'stress'; n: number; to: 'party' | 'owner'; when: string | null }
  | { op: 'cleanse'; n: number }
  | { op: 'exhaust_other'; n: number }
  | { op: 'hp_loss'; n: number }
  | { op: 'per'; source: string; each: Op[]; expect: number | null; max: number | null; mode: PerMode; key: string }
  | { op: 'cond'; cond: Cond; then: Op[]; else: Op[]; p: number; ifText: string; key: string; turnEnd: boolean }
  | { op: 'power'; trigger: Trigger; effects: Op[]; expect: number | null; gate: Gate | null; requireStance: boolean; key: string; autoTarget: AutoTarget; thisTurn: boolean }
  | { op: 'consume'; status: string | null; source: string | null; n: number | 'all' | null }
  | { op: 'special'; value: number; note: string; kind: SpecialKind; key: string };

export type PerMode =
  | 'status' // 대상(또는 적마다)의 상태 스택
  | 'jangdan' | 'summons' | 'tokens_played' | 'tokens_hand' | 'personal' | 'hand' | 'shadow'
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
  | 'rescue_ally' | 'sinryeongbu' | 'gokkal_tal' | 'rescue' | 'offering' | 'heotgeot' | 'nahwa' | 'approx';

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
  kind: 'status' | 'jangdan' | 'summons' | 'token' | 'formation' | 'collapse' | 'offering' | 'minions' | 'knots' | 'none';
  status?: EnemyStatus;
  n?: number;
  /** 무리 해원: 같은 원귀 하나가 조건을 채우면 그 전투의 같은 원귀 모두 해원 (잡귀, v0.2 S9) */
  group?: boolean;
  orCollapse?: boolean;
  /** 고풀이(05-region3 §9.3): 풀어야 할 매듭 수 (매듭 8종은 KNOTS 순서) */
  need?: number;
  /** 고풀이 상태 매듭 ①~④: 그 상태가 이만큼 쌓인 순간 풀린다 (기본 1, ⟨반복 3⟩ 3) */
  knotMin?: number;
  text: string;
}

/** 고풀이 매듭 8종 (05-region3 §9.3 순서). 비트 i = KNOTS[i] */
export const KNOTS = ['점지', '상흔', '명부', '넋흔들림', '장단', '굿상', '부적', '진형'] as const;

/** 빗장(05-region3 §9.1): 한 플레이어 턴에 잃는 체력 상한 */
export interface CapRule {
  n: number;
  /** 1단계(phase 0)에서만 */
  firstPhase: boolean;
  /** 이 원귀(id)가 하나라도 서 있는 동안만 */
  whileAlive: string | null;
}

/** 공물 행동(05-region2 §9.2): 전투 시작 시 손에 들어오는 0코스트 카드 */
export interface OfferingRule {
  card: number; // CardDef idx
  /** 바치는 보급품 (앞의 것이 모자라면 다음 것) */
  pay: { item: ProvKey; n: number }[];
  /** 턴마다 한 번, 쓴 뒤에도 손에 남는다 (손님상 차리기) */
  repeat: boolean;
  effect: 'none' | 'phase2' | 'minionsSkip' | 'entertain';
}

export type ProvKey = 'jijeon' | 'rice' | 'sul' | 'bujeok' | 'incense';
export const PROV_NAME: Record<ProvKey, string> = { jijeon: '지전', rice: '쌀', sul: '술', bujeok: '부적', incense: '향' };

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
  /** 지역 번호 (1~3) */
  region: number;
  cap: CapRule | null;
  offering: OfferingRule | null;
  final: boolean;
  /** 우두머리가 해원되면 함께 해원되어 물러간다 (2막부터 졸개, haewon.follows) */
  follows: string | null;
}

export interface Encounter {
  id: string;
  tier: 'easy' | 'hard' | 'elite' | 'boss' | 'final';
  enemies: string[];
  region?: number;
}

export interface HeroDef {
  id: HeroId;
  name: string;
  range: 'melee' | 'ranged';
  role: string;
  hp: number;
  /** 캠페인 레벨마다 최대 체력 (없으면 campaign.json levels.hpPerLevel) ⟨반복 4⟩ */
  hpPerLevel?: number;
  /** 원형 고유 방어 (03-heroes §2.1) ⟨반복 4⟩ */
  guard?: HeroGuard;
}

/** 원형 고유 방어 ⟨반복 4⟩ — 포수 「몸 낮추기」 · 탈꾼 「탈 뒤에 숨기」 · 차사 「군졸 자세」 (03-heroes §2.1) */
export interface HeroGuard {
  /** turn_block: 플레이어 턴을 시작할 때 방어도 · move_block: 진형에서 칸이 바뀔 때마다 방어도 (턴당 maxPerTurn 번) */
  kind: 'turn_block' | 'move_block';
  name: string;
  /** 레벨 0 의 방어도 (반복 4 데이터는 모두 0 — 지역 1 단판·시작 덱 수치는 그대로) */
  block: number;
  /** 레벨마다 더하는 방어도 (기본 + 레벨 × 이 값을 반올림) */
  perLevel?: number;
  maxPerTurn?: number;
}

// ── 전투 상태 ──────────────────────────────────────────────────────────
/** 카드 한 장(불변 객체). 바뀔 때는 새 객체로 바꾼다 → 더미 복제가 slice 한 번으로 끝난다 */
export interface CardInst {
  readonly d: number; // CardDef.idx
  readonly o: number; // 주인 영웅 index (0..2), 파티 = -1
  readonly o2: number; // 합기 두 번째 주인, 없으면 -1
  readonly orig: number; // 구조·애도로 바뀌기 전 카드, 없으면 -1
  readonly x: number; // 부가 정보 (신령부: 담은 설치물 idx), 없으면 -1
  /** 무구 각인(06-base §3·§5): 낼 때 그 상태 +1 생산. 1..8 = ENGRAVE_STATUS 순서, 없으면 undefined */
  readonly g?: number;
}

/** 각인 상태 (g = index + 1). 생산만 더한다(R2) */
export const ENGRAVE_STATUS = ['점지', '상흔', '명부', '넋흔들림', '장단', '진형', '굿상', '부적'] as const;

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
  /** 개체 기질(캠페인): 사망 판정 버틸 확률 보정 */
  saveBonus: number;
  /** 개체 기질(캠페인): 귀기 획득 배율 */
  stressMult: number;
  /** 원형 고유 방어의 방어도 (레벨 반영) ⟨반복 4⟩ */
  guardBlock: number;
  /** 원형 고유 방어(move_block)를 이번 턴 쓴 횟수 ⟨반복 4⟩ */
  guardUsed: number;
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
  /** 빗장: 이번 플레이어 턴에 잃은 체력 */
  capLost: number;
  /** 빗장을 푼 턴 (나화 한 송이) */
  capOff: number;
  /** 고풀이: 풀린 매듭 비트 (KNOTS) */
  knots: number;
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
  /** per 연산 key → [실행, 센 수 합] (가치 모델 기대 스택 교정, S10) */
  perCount: Map<string, [number, number]>;
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
  /** 기상한 영웅 idx (인연: 구한 쪽–구해진 쪽) */
  revived: number[];
  /** 신열: 낸 장수 · 옮은 장수 · 손에 든 채 턴을 마쳐 걸린 약화 (05-region2 R2-2) */
  sinyeolPlayed: number;
  sinyeolMoved: number;
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

/** 가호·지역 규칙의 엔진 훅 (기본값 = 없음). 웹 원정·캠페인 시뮬이 채운다 */
export interface CombatMods {
  reviveFrac?: number; // 기상 체력 비율 (기본 0.25, 삼신 0.35)
  jangdanMax?: number; // 장단 최대 (기본 5, 대동 깃발 6)
  handMax?: number; // 손패 최대 (기본 10, 대신방울 8)
  deathSave?: number; // 사망 판정 버틸 확률 보정 (칠성 +0.15)
  familyDmg?: { family: string; mult: number } | null; // 용왕: 수귀에게 주는 피해 +25%
  firstBlockBonus?: number; // 신장: 턴마다 처음 방어도를 얻는 영웅 +3
  bugun?: boolean; // 부군: 장단 3+ 로 턴을 마치면 마지막 카드 주인 방어도 4
  sinyeolFree?: boolean; // 손님의 배웅: 신열 비용 0 (턴당 1회)
  blockPollute?: number; // 대문 부적: 전투마다 처음 N장 신열·잡음을 막는다
  yaksu?: boolean; // 약수 한 사발: 사망 판정 대신 체력 30%로 기상 (1회)
  hoek?: boolean; // ⟨반복 4⟩ 획 하나(차사 대접): 사망 판정 한 번을 넘긴다 — 명부의 十에 획 하나를 그어 千으로 (원정마다 1회)
  bladeSafeTurn?: number; // 명도 한 닢(작두박수): 이 턴까지 헛디딤 없음
  sumsari?: boolean; // ⟨반복 5⟩ 숨살이꽃: 원정마다 한 번, 쓰러진 영웅이 그 자리에서 체력 50%로 일어난다
  eopching?: boolean; // ⟨반복 5⟩ 업칭: 해원 조건의 상태·장단 문턱 −1 (최소 1)
  gunbyeong?: boolean; // ⟨반복 5⟩ 삼천 군병 상: 이름 없는 군졸 넋 해원 회복 +2
}

/** 손님 배웅(05-region2 §9.3) 대접 게이지 */
export interface EntertainState {
  goal: number;
  limit: number;
  value: number;
  result: 'sendoff' | 'timeout' | null;
  /** 부적(토큰) 카드를 낸 턴의 대접 (없으면 1 — 반복 6 이전 저장) */
  token?: number;
  /** 수비가 쓰러질 때 대접 (없으면 1) */
  guardDown?: number;
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
  /** 공물·대접에 쓰는 보급품 (지전은 jijeon) */
  prov: { rice: number; sul: number; bujeok: number; incense: number };
  /** 반복형 공물(손님상 차리기)을 쓴 턴 */
  offerTurn: number;
  entertain: EntertainState | null;
  mods: CombatMods;
  /** 균열 강화 원귀: 체력 배율 (기본 1) */
  hpMult: number;
  /** 신장의 가호: 이번 턴 처음 방어도를 받은 영웅이 나왔는가 */
  firstBlockTurn: number;
  /** 손님의 배웅: 신열을 비용 0으로 낸 턴 */
  sinyeolFreeTurn: number;
  /** 대문 부적으로 막은 오염 수 */
  polluteBlocked: number;
  /** 약수 한 사발을 이미 썼는가 (원정 계층이 넘겨준다) */
  yaksuUsed: boolean;
  /** ⟨반복 4⟩ 획 하나를 이 전투에서 썼다 */
  hoekUsed?: boolean;
  /** 숨살이꽃을 이번 원정에서 썼다 (⟨반복 5⟩) */
  sumsariUsed?: boolean;
  /** 마지막으로 카드를 낸 영웅 (부군의 가호) */
  lastOwner: number;
  /** 놀이 싸움 (사자 검문): 영웅이 받는 피해가 체력 대신 귀기로 들어간다. 쓰러지지 않는다 */
  play: boolean;
  /** 호위 (잘못 끌려온 사람): 선두에 방어도가 없으면 선두를 노린 공격을 산 사람이 맞는다 */
  ward: { name: string; hp: number; maxHp: number; lost: boolean } | null;
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
