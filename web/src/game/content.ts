// 정적 콘텐츠: 첫 지역 데이터(region1.json)·영웅 정보·보급품·의뢰·넋등 구간.
// 엔진(src/core)이 읽지 않는 부분(드롭·기물·이벤트·덫·가호)은 여기서 JSON 을 직접 읽는다.

import region from '../../../data/design/region1.json' with { type: 'json' };
import heroesJson from '../../../data/design/heroes.json' with { type: 'json' };
import synergyJson from '../../../data/design/synergy.json' with { type: 'json' };
import { D } from '../../../src/core/engine.ts';
import type { HeroId } from '../../../src/core/types.ts';

export { D };

// ── 지역 ─────────────────────────────────────────────────────────────
export interface RawEnemyExtra {
  id: string;
  name: string;
  family: string;
  han: string;
  position?: 'front' | 'back' | 'any';
  category?: string;
  haewon: { status: string | null; rule: string; story: string } | null;
  drops: { material: string | null; gold: [number, number]; chiseong?: number };
}
export interface Curio {
  id: string;
  name: string;
  bare: string;
  provision: { item: string; result: string } | null;
  hero: { archetype: HeroId; result: string };
}
export interface RoomEvent {
  id: string;
  name: string;
  setup: string;
  fixed?: string;
  choices: { label: string; cost?: string; requires?: HeroId; result: string }[];
}
export interface Trap {
  id: string;
  name: string;
  effect: string;
  disarm: string;
}
export interface Relic {
  id: string;
  name: string;
  tier: '일반' | '고급' | '희귀' | '보스';
  effect: string;
}

const R = region as unknown as {
  region: { name: string; concept: string };
  enemies: RawEnemyExtra[];
  curios: Curio[];
  events: RoomEvent[];
  traps: Trap[];
  relics: Relic[];
};

export const REGION = R.region;
export const ENEMY_EXTRA = new Map(R.enemies.map((e) => [e.id, e]));
export const CURIOS = R.curios;
export const CURIO_BY_ID = new Map(R.curios.map((c) => [c.id, c]));
export const EVENTS = R.events;
export const EVENT_BY_ID = new Map(R.events.map((e) => [e.id, e]));
export const TRAPS = R.traps;
export const TRAP_BY_ID = new Map(R.traps.map((t) => [t.id, t]));
export const RELICS = R.relics;
export const RELIC_BY_ID = new Map(R.relics.map((r) => [r.id, r]));

/** 가호 구현 상태: 'ok' 그대로 · 'approx' 근사 · 'stub' 효과 없음(엔진에 훅이 없다) */
export const RELIC_IMPL: Record<string, { impl: 'ok' | 'approx' | 'stub'; note?: string }> = {
  teoju: { impl: 'ok' },
  geollip: { impl: 'ok' },
  jowang: { impl: 'ok' },
  seongju: { impl: 'ok' },
  geumjul: { impl: 'ok' },
  eophangari: { impl: 'ok' },
  sansin: { impl: 'ok' },
  yongwang: { impl: 'stub', note: '엔진 피해 계산에 계열 배수 훅이 없어 효과 없음' },
  seonang: { impl: 'ok' },
  daegam: { impl: 'ok' },
  obanggi: { impl: 'ok' },
  jeseok: { impl: 'ok' },
  chilseong: { impl: 'stub', note: '사망 판정 확률이 엔진 상수라 효과 없음' },
  myeongdo: { impl: 'approx', note: '작두박수·탈꾼은 개인 자원 대신 효과 없음' },
  cheonsin: { impl: 'ok' },
  samjichang: { impl: 'ok', note: '강화는 아직 어차피 막혀 있다' },
  daesin_bangul: { impl: 'approx', note: '턴 시작 드로우 뒤 8장을 넘는 카드를 버린다(턴 중 드로우는 10장까지)' },
};

// ── 영웅 ─────────────────────────────────────────────────────────────
export const RES_NAME: Record<string, string> = {
  V: '취약', W: '약화', M: '점지', B: '상흔', D: '명부', C: '넋흔들림', K: '장단', F: '진형', S: '굿상', T: '부적',
};

export interface HeroInfo {
  id: HeroId;
  name: string;
  range: '근접' | '원거리';
  role: string;
  hp: number;
  personal: string;
  personalDesc: string;
  signature: string;
  exports: string[];
  imports: string;
  color: string;
  blurb: string;
}

const HJ = heroesJson as unknown as {
  heroes: { id: HeroId; name: string; range: 'melee' | 'ranged'; role: string; hp: number; personal: string; signature: string; import: string }[];
};
const SJ = synergyJson as unknown as { choice: Record<string, { main: string; minor: string[] }> };

export const HERO_COLOR: Record<HeroId, string> = {
  manshin: '#e0503f', // 주홍 — 무복
  jaebi: '#e5b640', // 황 — 장구
  posu: '#3fae94', // 청록 — 화승총 심지
  baksu: '#d4dde3', // 백 — 작두 날
  seungnyeo: '#c08a52', // 괴색 — 가사
  beopsa: '#6d8fe6', // 쪽빛 — 경
  talggun: '#94c653', // 연두 — 탈판
  chasa: '#c26aa0', // 자주 — 적패지 끈
};

const BLURB: Record<HeroId, string> = {
  manshin: '굿상에 신령을 모시고, 만신 카드를 몰아 쓰면 신바람이 차올라 강신한다.',
  jaebi: '장구·징으로 장단을 띄우는 악사. 가락이 빨라질수록 받는소리가 두 번 울린다.',
  posu: '원귀를 점지하고 화약을 재어 한 발에 끝내는 사수.',
  baksu: '작두에 올라 칼날 위에서 싸운다. 장단이 끊기면 헛디딘다.',
  seungnyeo: '육환장으로 넋을 흔들고 염불로 거두는 파티의 방패.',
  beopsa: '경을 읽고 부적을 써서 손패를 부적으로 채운다.',
  talggun: '서 있는 칸이 곧 쓰는 탈이다. 자리를 바꿀 때마다 사람이 바뀐다.',
  chasa: '명부를 버린 저승차사. 원귀를 명부에 올려 거두고, 오라로 묶는다.',
};

const PERSONAL_DESC: Record<HeroId, string> = {
  manshin: '만신 카드를 낼 때마다 +1, 직전 카드도 만신이면 +1 더. 5가 되면 강신(이번 턴 굿상 신령이 한 번 더 발동, 공수 강화).',
  jaebi: '굿거리 → 자진굿거리 → 당악. 잽이 카드를 내면 빨라지고 턴 끝에 한 단계 느려진다. 당악이면 받는소리 효과가 두 번.',
  posu: '최대 3, 턴을 넘겨 남는다. 장전 카드로 쌓고 사격 카드가 쓴다.',
  baksu: '「작두 오르기」로 날에 선다. 장단 2 미만으로 턴을 마치면 헛디뎌 체력 6을 잃고 내려선다.',
  seungnyeo: '방어도를 얻거나 피격될 때마다 +1(최대 9). 카드가 굴려서 쓴다.',
  beopsa: '매 턴 시작에 +1(최대 3). 부적을 붉은 부적으로 만들 때 쓴다.',
  talggun: '선두 말뚝이 · 중열 양반 · 후열 할미. 서 있는 칸이 탈이다.',
  chasa: '최대 3. 1을 써서 적을 묶으면 그 적의 다음 행동 피해 −25%.',
};

const PERSONAL_SHORT: Record<HeroId, string> = {
  manshin: '신바람', jaebi: '가락', posu: '화약', baksu: '작두', seungnyeo: '염주', beopsa: '경면주사', talggun: '탈', chasa: '오라',
};

export const HERO_INFO = new Map<HeroId, HeroInfo>(
  HJ.heroes.map((h) => {
    const ch = SJ.choice[h.id];
    return [
      h.id,
      {
        id: h.id, name: h.name, range: h.range === 'melee' ? '근접' : '원거리', role: h.role, hp: h.hp,
        personal: PERSONAL_SHORT[h.id], personalDesc: PERSONAL_DESC[h.id], signature: RES_NAME[h.signature] ?? h.signature,
        exports: [ch.main, ...ch.minor].map((x) => RES_NAME[x] ?? x), imports: RES_NAME[h.import] ?? h.import, color: HERO_COLOR[h.id],
        blurb: BLURB[h.id],
      },
    ];
  }),
);

// ── 보급품·의뢰 ───────────────────────────────────────────────────────
export type SupplyId = 'candle' | 'rice' | 'incense' | 'jijeon' | 'bujeok' | 'sul';
export type CommissionId = 'short' | 'normal' | 'boss';

export interface Supply {
  id: SupplyId;
  name: string;
  price: number;
  max: number;
  desc: string;
}

/** 가격은 프로토타입 가정값(설계 문서에 수치 없음) */
export const SUPPLIES: Supply[] = [
  { id: 'candle', name: '촛불', price: 15, max: 8, desc: '넋등 +25. 전투 중에도 쓸 수 있고, 손패의 그늘을 모두 없앤다.' },
  { id: 'rice', name: '쌀', price: 10, max: 12, desc: '길굿 끼니(회복·귀기)와 뒷전 차림(밤 습격 0%). 굿상 잔해·떠오른 넋.' },
  { id: 'incense', name: '향', price: 20, max: 6, desc: '덫 해체, 서낭 고개 정찰, 장승·굿상 잔해, 떠오른 넋.' },
  { id: 'jijeon', name: '지전', price: 25, max: 6, desc: '노잣돈. 뱃사공에게 3을 바치면 해원. 사자 검문·나룻배·버려진 상여·빈 배.' },
  { id: 'bujeok', name: '부적', price: 30, max: 4, desc: '덫 해체, 젖은 넋전 더미 정화(카드 제거). 지도에서 씌임 카드 1장 정화.' },
  { id: 'sul', name: '술', price: 20, max: 4, desc: '영웅 하나 귀기 −10. 서낭당·무덤 공양, 곡소리 메아리 해체.' },
];
export const SUPPLY_BY_ID = new Map(SUPPLIES.map((s) => [s.id, s]));
export const SUPPLY_NAME: Record<SupplyId, string> = Object.fromEntries(SUPPLIES.map((s) => [s.id, s.name])) as Record<SupplyId, string>;

export interface Commission {
  id: CommissionId;
  name: string;
  place: string;
  story: string;
  length: '짧음' | '보통' | '보스 길';
  goal: string;
  purse: number;
  rooms: [number, number];
  guard: [number, number];
  loops: number;
  camps: number;
  grid: [number, number];
  minutes: string;
}

export const COMMISSIONS: Commission[] = [
  {
    id: 'short', name: '떠내려간 아이', place: '물가 마을', story: '"물가에서 놀다 떠내려간 아이의 넋을 건져 주오." 짧은 굿이다.',
    length: '짧음', goal: '길 밝히기 — 방 75% 방문', purse: 200, rooms: [8, 9], guard: [0, 1], loops: 1, camps: 0, grid: [4, 3], minutes: '20~30분',
  },
  {
    id: 'normal', name: '서낭 고개의 원귀', place: '서낭 고개', story: '"고개를 넘는 장꾼마다 발이 묶인다오." 고개의 원귀를 모두 거두어 달라는 청이다.',
    length: '보통', goal: '원귀 소탕 — 방에 있는 원귀 전부', purse: 350, rooms: [12, 13], guard: [1, 2], loops: 3, camps: 1, grid: [6, 3], minutes: '45~60분',
  },
  {
    id: 'boss', name: '나루의 큰 원귀', place: '나루터', story: '"나루에 큰 원귀가 버티고 있어 넋들이 강을 건너지 못하오." 보스 굴의 위치와 정체가 미리 알려져 있다.',
    length: '보스 길', goal: '큰 원귀 해원 — 보스 굴의 원귀를 해원(또는 처치)', purse: 420, rooms: [12, 13], guard: [1, 2], loops: 3, camps: 2, grid: [7, 3], minutes: '약 60분',
  },
];
export const COMMISSION_BY_ID = new Map(COMMISSIONS.map((c) => [c.id, c]));

/** 출발 화면 권장량 (탐험 §6 표. 보스 길은 보통 + 길굿 2회분 쌀, 뱃사공이면 지전 4) */
export function recommended(c: CommissionId, boss: string | null): Record<SupplyId, number> {
  if (c === 'short') return { candle: 3, rice: 0, incense: 1, jijeon: 1, bujeok: 1, sul: 1 };
  if (c === 'normal') return { candle: 6, rice: 4, incense: 2, jijeon: 2, bujeok: 1, sul: 2 };
  return { candle: 6, rice: 6, incense: 2, jijeon: boss === 'b1' ? 4 : 2, bujeok: 1, sul: 2 };
}

// ── 넋등 구간 (탐험 §4) ───────────────────────────────────────────────
export interface LightBand {
  idx: number;
  name: string;
  min: number;
  scout: number;
  first: number;
  ambush: number;
  shadow: number;
  enemyDmg: number;
  gold: number;
  stress: number;
  choices: number;
  rareUp: number;
  rareGuaranteed: boolean;
  color: string;
}

export const LIGHT_BANDS: LightBand[] = [
  { idx: 0, name: '환함', min: 76, scout: 0.15, first: 0.25, ambush: 0, shadow: 0, enemyDmg: 1, gold: 1, stress: 1, choices: 3, rareUp: 0, rareGuaranteed: false, color: '#ffc861' },
  { idx: 1, name: '흐림', min: 51, scout: 0.075, first: 0.15, ambush: 0, shadow: 0, enemyDmg: 1, gold: 1.25, stress: 1.1, choices: 3, rareUp: 0, rareGuaranteed: false, color: '#e9a64c' },
  { idx: 2, name: '어스름', min: 26, scout: 0, first: 0, ambush: 0.15, shadow: 1, enemyDmg: 1.1, gold: 1.5, stress: 1.2, choices: 3, rareUp: 0.05, rareGuaranteed: false, color: '#c27a3d' },
  { idx: 3, name: '어둠', min: 1, scout: 0, first: 0, ambush: 0.25, shadow: 2, enemyDmg: 1.15, gold: 1.75, stress: 1.3, choices: 4, rareUp: 0.05, rareGuaranteed: false, color: '#8a5434' },
  { idx: 4, name: '칠흑', min: 0, scout: 0, first: 0, ambush: 0.4, shadow: 3, enemyDmg: 1.25, gold: 2, stress: 1.4, choices: 4, rareUp: 0.05, rareGuaranteed: true, color: '#4a3530' },
];

export function bandOf(light: number): LightBand {
  if (light <= 0) return LIGHT_BANDS[4];
  for (const b of LIGHT_BANDS) if (light >= b.min) return b;
  return LIGHT_BANDS[3];
}

// ── 던전 생성 규칙 (탐험 §2, tools/design/dungeon_sim.py 와 같다) ─────
export const ROOM_TABLE: [string, number][] = [['battle', 0.45], ['curio', 0.28], ['event', 0.1], ['empty', 0.17]];
export const TILE_TABLE: [string, number][] = [['battle', 0.14], ['curio', 0.17], ['trap', 0.08], ['empty', 0.61]];
export const TILES_PER_CORRIDOR = 3;
export const NEW_TILE_COST = 6;
export const OLD_TILE_COST = 1;
export const SCOUT_BASE = 0.25;
export const NIGHT_RAID = 0.15;
export const CAMP_POINTS = 12;
export const AFTER_FIGHT_RECOVERY_MISSING = 0.4; // 넋 수습 (탐험 §10 v0.2)
export const FLEE_BASE = 0.7;
