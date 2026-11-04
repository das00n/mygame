// 캠페인 루프 v1 (docs/09-campaign-spec.md §1~§8). 순수 함수: 상태(Campaign)를 받아 바꾸고 문장을 돌려준다.
// 원정 자체는 원정 계층(src/sim/campaign-run.ts 또는 web/)이 돌리고, 결과(ExpeditionReport)를 settle() 에 넘긴다.

import { loadData } from '../core/data.ts';
import { rand } from '../core/rng.ts';
import { HERO_IDS, HERO_NAMES, type HeroId } from '../core/types.ts';
import { CD, FACILITY_BY_ID, LENGTH_NAMES, QUIRK_BY_ID, REGION_NAMES, SUPPLY_IDS, SUPPLY_NAMES, emptySupplies, seasonName, seasonOfYear, type Quirk } from './content.ts';
import { bestLoadout, duoCard, learnFrom, sinmulFor } from './loadout.ts';
import type {
  Campaign, CampaignSettings, Commission, CommissionLength, ExpeditionPlan, ExpeditionReport, Fallen, FacilityId, Person, Supplies,
} from './types.ts';

export const GUARDIANS: HeroId[] = ['seungnyeo', 'chasa'];

// ── 난수 ─────────────────────────────────────────────────────────────
function rnd(c: Campaign): number {
  return rand(c);
}
function rint(c: Campaign, lo: number, hi: number): number {
  return lo + Math.floor(rnd(c) * (hi - lo + 1));
}
function rpick<T>(c: Campaign, arr: readonly T[]): T {
  return arr[Math.floor(rnd(c) * arr.length)];
}

export function heroName(arch: HeroId): string {
  return HERO_NAMES[arch];
}

export function displayName(p: Person): string {
  return p.epithet ? `${p.epithet} ${p.name}` : p.name;
}

export function note(c: Campaign, msg: string): void {
  c.log.push(`[${seasonName(c.season)}] ${msg}`);
  if (c.log.length > 200) c.log.splice(0, c.log.length - 200);
}

// ── 개체 ─────────────────────────────────────────────────────────────
export function quirkOf(id: string | null): Quirk | null {
  return id ? QUIRK_BY_ID.get(id) ?? null : null;
}

export function quirkEffects(p: Person): Required<Quirk['effect']> {
  const out = { saveBonus: 0, maxHp: 0, stressMult: 1, startBlock: 0, startWeak: 0, recovery: 0, gold: 0 };
  for (const q of [quirkOf(p.good), quirkOf(p.bad)]) {
    if (!q) continue;
    const e = q.effect;
    out.saveBonus += e.saveBonus ?? 0;
    out.maxHp += e.maxHp ?? 0;
    out.stressMult *= e.stressMult ?? 1;
    out.startBlock += e.startBlock ?? 0;
    out.startWeak += e.startWeak ?? 0;
    out.recovery += e.recovery ?? 0;
    out.gold += e.gold ?? 0;
  }
  return out;
}

/** 최대 체력 (피로 전): 원형 체력 + 레벨마다 +3 + 기질 */
export function baseMaxHp(p: Person): number {
  return loadData().heroes.get(p.arch)!.hp + CD.levels.hpPerLevel * p.level + quirkEffects(p).maxHp;
}

/** 피로: 연속 출전마다 최대 체력 −5% (상한 −20%) */
export function fatigueFrac(p: Person): number {
  return Math.min(CD.fatigue.cap, CD.fatigue.perSortie * p.sorties);
}

export function maxHpOf(p: Person): number {
  return Math.max(1, Math.round(baseMaxHp(p) * (1 - fatigueFrac(p))));
}

export function levelForXp(xp: number): number {
  let lv = 0;
  for (const need of CD.levels.xp) if (xp >= need) lv++;
  return lv;
}

export function nextXp(p: Person): number | null {
  return CD.levels.xp[p.level] ?? null;
}

function makeName(c: Campaign): string {
  const taken = new Set([...c.roster, ...c.candidates, ...c.fallen.map((f) => f.person)].map((p) => p.name));
  for (let k = 0; k < 30; k++) {
    const n = rpick(c, CD.names.surnames) + rpick(c, CD.names.given);
    if (!taken.has(n)) return n;
  }
  return rpick(c, CD.names.surnames) + rpick(c, CD.names.given) + c.nextUid;
}

export function makePerson(c: Campaign, arch?: HeroId): Person {
  const a = arch ?? rpick(c, HERO_IDS);
  const goods = CD.quirks.filter((q) => q.good);
  const bads = CD.quirks.filter((q) => !q.good);
  const p: Person = {
    uid: `p${c.nextUid++}`, name: makeName(c), epithet: null, arch: a, origin: rint(c, 0, CD.origins[a].length - 1),
    good: rpick(c, goods).id, bad: rpick(c, bads).id, level: 0, xp: 0, path: null, learned: [], loadout: [], engraving: null,
    stress: 0, sorties: 0, injured: false, busy: null, grief: false, resolve: false, mother: null,
    history: { expeditions: 0, haewons: 0, saved: 0, lastCard: null, plays: {}, joined: c.season, bosses: 0 },
  };
  p.loadout = bestLoadout(a, []);
  return p;
}

// ── 시설 ─────────────────────────────────────────────────────────────
export function tier(c: Campaign, f: FacilityId): number {
  return c.facilities[f] ?? 0;
}

export function rosterCap(c: Campaign): number {
  return tier(c, 'gaekju') >= 2 ? 9 : 6;
}

export function candidateCount(c: Campaign): number {
  return tier(c, 'gaekju') >= 2 ? 3 : 2;
}

export function sinmulCarry(c: Campaign): number {
  return tier(c, 'sadang') >= 3 ? 2 : 1;
}

/** 물품 칸: 신당 단계마다 보급품 묶음 한도 +1 */
export function supplyMax(c: Campaign): Supplies {
  const bonus = Math.max(0, tier(c, 'sindang') - 1);
  const out = { ...CD.provisions.max };
  for (const k of SUPPLY_IDS) out[k] += bonus;
  return out;
}

export function regionOpen(c: Campaign, region: number): boolean {
  return region <= tier(c, 'sindang');
}

export function deepestRegion(c: Campaign): number {
  return Math.min(3, Math.max(1, tier(c, 'sindang')));
}

export interface BuildOption {
  id: FacilityId;
  name: string;
  next: number;
  cost: { gold?: number; chiseong?: number };
  text: string;
  /** 지을 수 있는가 (부지·비용) */
  ok: boolean;
  why: string | null;
}

export function buildOptions(c: Campaign): BuildOption[] {
  const out: BuildOption[] = [];
  for (const f of CD.facilities) {
    const cur = tier(c, f.id);
    if (cur >= f.tiers.length) continue;
    const next = cur + 1;
    const t = f.tiers[cur];
    let why: string | null = null;
    if (cur === 0 && !c.lots.includes(f.lot)) why = f.lot === 'r1boss' ? '지역 1 보스를 처음 보내면 부지가 열린다' : f.lot === 'r2boss' ? '지역 2 보스를 처음 보내면 부지가 열린다' : '부지가 없다';
    else if ((t.cost.gold ?? 0) > c.gold) why = `엽전 ${t.cost.gold} 필요`;
    else if ((t.cost.chiseong ?? 0) > c.chiseong) why = `치성 ${t.cost.chiseong} 필요`;
    out.push({ id: f.id, name: f.name, next, cost: t.cost, text: t.text, ok: !why, why });
  }
  return out;
}

export function build(c: Campaign, id: FacilityId): string | null {
  const o = buildOptions(c).find((x) => x.id === id);
  if (!o) return '더 지을 수 없다';
  if (!o.ok) return o.why;
  c.gold -= o.cost.gold ?? 0;
  c.chiseong -= o.cost.chiseong ?? 0;
  c.facilities[id] = o.next;
  note(c, `${o.name} ${o.next === 1 ? '건축' : `${o.next}단계`} — ${o.text}`);
  if (id === 'sindang' && o.next >= 2) note(c, `지역 ${o.next} 「${REGION_NAMES[o.next]}」이(가) 열렸다`);
  return null;
}

// ── 새 캠페인 ────────────────────────────────────────────────────────
export function newCampaign(seed: number, settings: Partial<CampaignSettings> = {}): Campaign {
  const c: Campaign = {
    v: 1, seed, rng: seed | 0, season: 0, expeditions: 0, gold: CD.economy.startGold, chiseong: 0, materials: {}, stock: emptySupplies(),
    roster: [], fallen: [], bonds: {}, facilities: {} as Campaign['facilities'], lots: ['start'], rift: 0, countdown: null,
    settings: { rift: settings.rift ?? true }, bosses: {}, commissions: [], candidates: [], festival: null, lastEvent: null, bonusSupplies: {},
    codex: [], haewonSeen: {}, log: [], history: [], ending: null, nextUid: 1, freeRecruit: false,
  };
  for (const f of CD.facilities) c.facilities[f.id] = f.start;
  // 시작 로스터 4명: 서로 다른 원형, 수호형(승려·차사) 1명 이상 보장
  const archs: HeroId[] = [rpick(c, GUARDIANS)];
  while (archs.length < CD.economy.startRoster) {
    const a = rpick(c, HERO_IDS);
    if (!archs.includes(a)) archs.push(a);
  }
  for (const a of archs) c.roster.push(makePerson(c, a));
  startSeason(c);
  note(c, `신당에 불을 밝혔다. ${c.roster.map((p) => `${p.name}(${heroName(p.arch)})`).join(' · ')}이(가) 함께한다.`);
  return c;
}

// ── 절기 시작: 명절 · 의뢰판 · 영입 후보 ──────────────────────────────
function startSeason(c: Campaign): void {
  const fest = CD.calendar.festivals.find((f) => f.season === seasonOfYear(c.season));
  c.festival = fest ? `${fest.name}: ${fest.text}` : null;
  c.freeRecruit = fest?.kind === 'wanderer';
  c.commissions = genCommissions(c);
  const plus = c.lastEvent === 'bangmun' ? 1 : 0;
  c.candidates = [];
  for (let k = 0; k < candidateCount(c) + plus; k++) {
    const p = makePerson(c);
    // 객주 2단계: 숙련 영입 (06-base §4 객주 업그레이드 트랙) — 후보가 레벨 1로 온다
    if (tier(c, 'gaekju') >= 2) {
      p.xp = CD.levels.seasonedXp;
      p.level = levelForXp(p.xp);
    }
    c.candidates.push(p);
  }
}

export function festivalKind(c: Campaign): 'wanderer' | 'biggut' | 'market' | null {
  return CD.calendar.festivals.find((f) => f.season === seasonOfYear(c.season))?.kind ?? null;
}

function payFor(c: Campaign, length: CommissionLength, seal: boolean): number {
  const base = seal ? CD.economy.pay.seal : CD.economy.pay[length];
  return festivalKind(c) === 'biggut' ? base * 2 : base;
}

/** 최종 원정(아홉째~열두째 대문): 3지역 보스 길(다섯째~여덟째)을 마친 뒤 */
export function finalUnlocked(c: Campaign): boolean {
  return regionOpen(c, 3) && (c.bosses[3]?.wins ?? 0) > 0;
}

export function genCommissions(c: Campaign): Commission[] {
  const out: Commission[] = [];
  const deep = deepestRegion(c);
  const mk = (region: number, length: CommissionLength, seal = false): Commission => {
    const st = rpick(c, CD.commissions[String(region)]);
    const pay = payFor(c, length, seal);
    return {
      id: `c${c.season}-${out.length}`, region, length, family: st.family, story: seal ? '저승문 균열이 가득 찼다. 가장 깊은 저승 구역의 큰 원귀를 보내 균열을 봉합하라.' : st.story,
      pay, advance: Math.round(pay * CD.economy.advance), seal,
    };
  };
  // 균열 봉합 (카운트다운 중) · 최종 원정 (3지역 보스를 보낸 뒤) · 가장 깊은 지역의 보스 길과 보통 길 · 한 단계 얕은 지역 하나
  if (c.countdown !== null) out.push(mk(deep, 'boss', true));
  if (finalUnlocked(c)) out.push(mk(3, 'final'));
  out.push(mk(deep, 'boss'));
  out.push(mk(deep, 'normal'));
  // 얕은 지역 하나: 균열이 차오르면 보스 길(균열을 줄일 수 있다)
  if (deep > 1) out.push(mk(rint(c, 1, deep - 1), c.rift >= 5 || rnd(c) < 0.5 ? 'boss' : 'normal'));
  return out;
}

// ── 영입 ─────────────────────────────────────────────────────────────
export function activeRoster(c: Campaign): Person[] {
  return c.roster;
}

/** 서로 다른 원형 셋으로 파티를 꾸릴 수 있는가 (쉬는 사람 포함) */
export function canField(c: Campaign): boolean {
  return new Set(c.roster.map((p) => p.arch)).size >= 3;
}

export function recruitCost(c: Campaign): number {
  if (c.freeRecruit) return 0;
  // 서로 다른 원형 셋을 꾸릴 수 없으면 출정을 못 하므로 무료로 받는다 (막힘 방지)
  if (!canField(c)) return 0;
  return CD.economy.recruitCost;
}

/** 이 원형의 조상신 중 신딸이 아직 없는 것 (신어머니 후보) */
export function motherCandidates(c: Campaign, arch: HeroId): Fallen[] {
  return c.fallen.filter((f) => f.honored && !f.daughter && f.person.arch === arch && f.person.learned.length > 0);
}

export function recruit(c: Campaign, idx: number, motherUid: string | null = null): string | null {
  const p = c.candidates[idx];
  if (!p) return '그런 후보가 없다';
  if (c.roster.length >= rosterCap(c)) return `로스터가 가득 찼다 (${rosterCap(c)}명)`;
  const cost = recruitCost(c);
  if (c.gold < cost) return `엽전 ${cost} 필요`;
  c.gold -= cost;
  if (c.freeRecruit && cost === 0) c.freeRecruit = false;
  c.candidates.splice(idx, 1);
  if (motherUid) {
    const f = motherCandidates(c, p.arch).find((x) => x.person.uid === motherUid);
    if (f) {
      // 신어머니–신딸: 조상신의 익힌 카드 1장을 처음부터 익힌 채 (강화는 초기화 — 익힌 카드는 기본판)
      const card = bestLoadout(p.arch, f.person.learned).find((id) => f.person.learned.includes(id)) ?? f.person.learned[0];
      p.learned = [card];
      p.loadout = bestLoadout(p.arch, p.learned);
      p.mother = f.person.uid;
      f.daughter = p.uid;
      note(c, `${p.name}이(가) ${displayName(f.person)}을(를) 신어머니로 모신다 — 「${loadData().cardById.get(card)?.name}」을(를) 익힌 채 시작`);
    }
  }
  p.history.joined = c.season;
  c.roster.push(p);
  note(c, `${p.name}(${heroName(p.arch)})을(를) 들였다${cost ? ` (엽전 ${cost})` : ' (무료)'}`);
  return null;
}

export function retire(c: Campaign, uid: string): string | null {
  const i = c.roster.findIndex((p) => p.uid === uid);
  if (i < 0) return '없다';
  const p = c.roster.splice(i, 1)[0];
  note(c, `${displayName(p)}이(가) 은퇴했다`);
  return null;
}

// ── 마을 행동 ─────────────────────────────────────────────────────────
function person(c: Campaign, uid: string): Person | null {
  return c.roster.find((p) => p.uid === uid) ?? null;
}

export function bookRest(c: Campaign, uid: string): string | null {
  const p = person(c, uid);
  if (!p) return '없다';
  if (p.busy) return '이미 묶여 있다';
  if (c.gold < CD.economy.restCost) return `엽전 ${CD.economy.restCost} 필요`;
  c.gold -= CD.economy.restCost;
  p.busy = 'rest';
  note(c, `${p.name} — 주막에서 한 절기 쉰다`);
  return null;
}

export function bookTreat(c: Campaign, uid: string): string | null {
  const p = person(c, uid);
  if (!p) return '없다';
  if (tier(c, 'yakbang') < 1) return '약방이 없다';
  if (!p.injured) return '중상이 아니다';
  if (p.busy) return '이미 묶여 있다';
  if (c.gold < CD.economy.treatCost) return `엽전 ${CD.economy.treatCost} 필요`;
  c.gold -= CD.economy.treatCost;
  p.busy = 'treat';
  note(c, `${p.name} — 약방에서 중상을 치료한다(한 절기)`);
  return null;
}

export function cancelBooking(c: Campaign, uid: string): void {
  const p = person(c, uid);
  if (!p || !p.busy) return;
  c.gold += p.busy === 'rest' ? CD.economy.restCost : CD.economy.treatCost;
  p.busy = null;
}

export function removeBadQuirk(c: Campaign, uid: string): string | null {
  const p = person(c, uid);
  if (!p) return '없다';
  if (tier(c, 'yakbang') < 1) return '약방이 없다';
  if (!p.bad) return '나쁜 기질이 없다';
  if (c.gold < CD.economy.quirkCost) return `엽전 ${CD.economy.quirkCost} 필요`;
  c.gold -= CD.economy.quirkCost;
  note(c, `${p.name}의 기질 「${quirkOf(p.bad)?.name}」을(를) 다스렸다`);
  p.bad = null;
  return null;
}

export function canPromote(c: Campaign, p: Person): boolean {
  return !p.epithet && p.level >= CD.levels.promoteLevel && tier(c, 'jeonsucheong') >= 1;
}

export function promote(c: Campaign, uid: string, path: 'A' | 'B'): string | null {
  const p = person(c, uid);
  if (!p) return '없다';
  if (tier(c, 'jeonsucheong') < 1) return '전수청이 없다';
  if (p.epithet) return '이미 내림굿을 받았다';
  if (p.level < CD.levels.promoteLevel) return `레벨 ${CD.levels.promoteLevel} 필요`;
  if (c.gold < CD.levels.promoteCost) return `엽전 ${CD.levels.promoteCost} 필요`;
  c.gold -= CD.levels.promoteCost;
  const used = new Set(c.roster.map((x) => x.epithet).filter(Boolean));
  const free = CD.epithets.filter((e) => !used.has(e));
  p.epithet = rpick(c, free.length ? free : CD.epithets);
  p.path = path;
  note(c, `${p.name}이(가) 내림굿을 받았다 — 별호 「${p.epithet}」, ${CD.paths[p.arch][path]}`);
  return null;
}

export function loadoutCost(c: Campaign): number {
  return tier(c, 'jeonsucheong') >= 1 ? 0 : CD.economy.loadoutSwapCost;
}

export function setLoadout(c: Campaign, uid: string, cards: string[]): string | null {
  const p = person(c, uid);
  if (!p) return '없다';
  const d = loadData();
  const allowed = new Set([...d.starters.get(p.arch)!.map((x) => x.id), ...p.learned]);
  if (cards.length !== 4 || new Set(cards).size !== 4 || cards.some((x) => !allowed.has(x))) return '시작 카드·익힌 카드 중 서로 다른 4장';
  const same = cards.every((x) => p.loadout.includes(x));
  if (same) return null;
  const cost = loadoutCost(c);
  if (c.gold < cost) return `엽전 ${cost} 필요`;
  c.gold -= cost;
  p.loadout = cards.slice();
  if (p.engraving && !cards.includes(p.engraving.card)) clearEngraving(c, uid);
  return null;
}

export function engraveOptions(c: Campaign): { family: string; status: string; have: number }[] {
  return Object.entries(CD.engrave).map(([family, status]) => ({ family, status, have: c.materials[family] ?? 0 }));
}

export function engrave(c: Campaign, uid: string, card: string, family: string): string | null {
  const p = person(c, uid);
  if (!p) return '없다';
  if (tier(c, 'mugubang') < 1) return '무구방이 없다';
  if (!p.loadout.includes(card)) return '로드아웃 카드에만 새긴다';
  const status = CD.engrave[family];
  if (!status) return '그런 계열이 없다';
  if (p.engraving) clearEngraving(c, uid);
  const have = c.materials[family] ?? 0;
  if (have < CD.economy.engraveCost) return `${CD.materials[family]} ${CD.economy.engraveCost} 필요`;
  c.materials[family] = have - CD.economy.engraveCost;
  p.engraving = { card, family, status };
  note(c, `${p.name}의 「${loadData().cardById.get(card)?.name}」에 각인 — ${status} +1 생산`);
  return null;
}

/** 각인을 바꾸면 재료를 전액 돌려준다 (MHW) */
export function clearEngraving(c: Campaign, uid: string): void {
  const p = person(c, uid);
  if (!p || !p.engraving) return;
  c.materials[p.engraving.family] = (c.materials[p.engraving.family] ?? 0) + CD.economy.engraveCost;
  p.engraving = null;
}

/** 교환소: 재료 ↔ 엽전 (손실 40%) */
export function sellMaterial(c: Campaign, family: string, n: number): string | null {
  if ((c.materials[family] ?? 0) < n) return '재료가 모자라다';
  c.materials[family] -= n;
  c.gold += Math.floor(n * CD.economy.materialValue * (1 - CD.economy.exchangeLoss));
  return null;
}

export function buyMaterial(c: Campaign, family: string, n: number): string | null {
  const cost = Math.ceil((n * CD.economy.materialValue) / (1 - CD.economy.exchangeLoss));
  if (c.gold < cost) return `엽전 ${cost} 필요`;
  c.gold -= cost;
  c.materials[family] = (c.materials[family] ?? 0) + n;
  return null;
}

/** 사당 천도굿 (엽전 60) → 조상신 · 신물 */
export function cheondo(c: Campaign, uid: string): string | null {
  const f = c.fallen.find((x) => x.person.uid === uid);
  if (!f) return '없다';
  if (f.honored) return '이미 천도했다';
  if (c.gold < CD.death.cheondoCost) return `엽전 ${CD.death.cheondoCost} 필요`;
  c.gold -= CD.death.cheondoCost;
  honor(c, f);
  return null;
}

function honor(c: Campaign, f: Fallen): void {
  f.honored = true;
  f.wandering = false;
  f.sinmul = sinmulFor(f.person.arch, f.person.history.plays);
  note(c, `${displayName(f.person)}의 천도굿을 올렸다 — 조상신이 되어 사당에 위패를 모셨다${f.sinmul ? `. 신물 「${loadData().cardById.get(f.sinmul)?.name}」` : ''}`);
}

export function ancestors(c: Campaign): Fallen[] {
  return c.fallen.filter((f) => f.honored);
}

export function wanderingSpirits(c: Campaign): Fallen[] {
  return c.fallen.filter((f) => f.wandering);
}

// ── 인연 ─────────────────────────────────────────────────────────────
export function bondKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

export function bondOf(c: Campaign, a: string, b: string): number {
  return c.bonds[bondKey(a, b)] ?? 0;
}

function addBond(c: Campaign, a: string, b: string, n: number): void {
  if (a === b) return;
  const k = bondKey(a, b);
  c.bonds[k] = (c.bonds[k] ?? 0) + n;
}

// ── 출정 ─────────────────────────────────────────────────────────────
/** 출정할 수 있는 개체 (휴식·치료로 묶이지 않음) */
export function available(c: Campaign): Person[] {
  return c.roster.filter((p) => !p.busy);
}

export function enemyHpMult(c: Campaign): number {
  let steps = 0;
  for (const t of CD.rift.strong) if (c.rift >= t) steps++;
  return 1 + steps * CD.rift.hpMultPerStep;
}

export function supplyPrice(c: Campaign, id: keyof Supplies): number {
  const p = CD.provisions.prices[id];
  return festivalKind(c) === 'market' ? Math.ceil(p / 2) : p;
}

export function recommendedSupplies(region: number, length: CommissionLength): Supplies {
  const r = CD.provisions.recommended[String(region)];
  return { ...emptySupplies(), ...(r?.[length] ?? r?.boss ?? {}) };
}

/** 보급품 값 (창고에 있는 것은 빼고 산다) */
export function supplyCost(c: Campaign, buy: Partial<Supplies>): number {
  let cost = 0;
  for (const k of SUPPLY_IDS) cost += Math.max(0, buy[k] ?? 0) * supplyPrice(c, k);
  return cost;
}

export function planExpedition(c: Campaign, commissionId: string, uids: string[], buy: Partial<Supplies>): ExpeditionPlan | string {
  const cm = c.commissions.find((x) => x.id === commissionId);
  if (!cm) return '그런 의뢰가 없다';
  if (!regionOpen(c, cm.region)) return '아직 열리지 않은 지역';
  if (uids.length !== 3 || new Set(uids).size !== 3) return '세 사람을 고른다';
  const ps = uids.map((u) => person(c, u));
  if (ps.some((p) => !p)) return '없는 사람';
  const people = ps as Person[];
  if (people.some((p) => p.busy)) return '쉬거나 치료 중인 사람은 갈 수 없다';
  if (new Set(people.map((p) => p.arch)).size !== 3) return '같은 원형은 한 파티에 한 명';
  const cost = supplyCost(c, buy);
  if (cost > c.gold + cm.advance) return `보급품 값 ${cost} — 엽전이 모자라다`;
  const d = loadData();
  // 선금을 받고 보급품을 산다
  c.gold += cm.advance - cost;
  const supplies = emptySupplies();
  const max = supplyMax(c);
  for (const k of SUPPLY_IDS) {
    supplies[k] = Math.min(max[k], c.stock[k] + (buy[k] ?? 0) + (c.bonusSupplies[k] ?? 0));
    c.stock[k] = 0;
  }
  c.bonusSupplies = {};
  const party = people.map((p) => p.arch);
  const wander = wanderingSpirits(c).length * CD.death.wanderStress;
  const deck: ExpeditionPlan['deck'] = [];
  people.forEach((p, i) => {
    for (const id of p.loadout) {
      const g = p.engraving && p.engraving.card === id ? engraveCode(p.engraving.status) : undefined;
      deck.push(g ? { id, o: i, o2: -1, g } : { id, o: i, o2: -1 });
    }
  });
  const duoCards: string[] = [];
  for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) {
    if (bondOf(c, people[a].uid, people[b].uid) < CD.bonds.duoAt) continue;
    const id = duoCard(people[a].arch, people[b].arch);
    if (!id) continue;
    const def = d.cardById.get(id)!;
    deck.push({ id, o: party.indexOf(def.heroes[0]), o2: party.indexOf(def.heroes[1]) });
    duoCards.push(id);
  }
  const sinmul = ancestors(c).map((f) => f.sinmul).filter((x): x is string => !!x);
  const carry = sinmulCarry(c);
  const chosen = sinmul.slice(-carry); // 가장 최근 조상신부터
  for (const id of chosen) deck.push({ id, o: -1, o2: -1 });
  const plan: ExpeditionPlan = {
    commission: cm, uids: uids.slice(), party,
    heroes: people.map((p) => {
      const q = quirkEffects(p);
      return {
        id: p.arch, maxHp: maxHpOf(p), stress: Math.min(99, p.stress + wander + (p.grief ? CD.death.grief : 0)), injured: p.injured,
        saveBonus: q.saveBonus, stressMult: q.stressMult, startBlock: q.startBlock, startWeak: q.startWeak, recovery: q.recovery,
      };
    }),
    deck, supplies, enemyHpMult: enemyHpMult(c), firstJangdan: people.some((p) => p.resolve) ? CD.death.resolve : 0,
    stressAdd: people.map((p) => wander + (p.grief ? CD.death.grief : 0)), duoCards, sinmul: chosen,
  };
  for (const p of people) {
    p.grief = false;
    p.resolve = false;
  }
  c.commissions = c.commissions.filter((x) => x.id !== cm.id);
  note(c, `출정 — ${REGION_NAMES[cm.region]} ${LENGTH_NAMES[cm.length]}${cm.seal ? '(균열 봉합)' : ''}: ${people.map((p) => displayName(p)).join(' · ')}`);
  return plan;
}

export function engraveCode(status: string): number {
  return ['점지', '상흔', '명부', '넋흔들림', '장단', '진형', '굿상', '부적'].indexOf(status) + 1;
}

// ── 귀환 결산 ────────────────────────────────────────────────────────
export interface Settlement {
  lines: string[];
  learned: { uid: string; card: string }[];
  levelUps: { uid: string; level: number }[];
  deaths: string[];
  event: string | null;
  ending: Campaign['ending'];
}

export function settle(c: Campaign, plan: ExpeditionPlan, rep: ExpeditionReport): Settlement {
  const d = loadData();
  const cm = plan.commission;
  const lines: string[] = [];
  const out: Settlement = { lines, learned: [], levelUps: [], deaths: [], event: null, ending: null };
  const people = plan.uids.map((u) => person(c, u)!);
  c.expeditions++;
  // 굿비: 성공 보수(선금 제외) + 전리품
  let gold = Math.round(rep.gold * CD.economy.dropGold);
  if (rep.success) gold += cm.pay - cm.advance;
  for (const p of people) gold += quirkEffects(p).gold;
  c.gold = Math.max(0, c.gold + gold);
  c.chiseong += rep.chiseong;
  lines.push(rep.success ? `의뢰를 마쳤다 — 굿비 ${cm.pay - cm.advance} + 전리품 ${Math.round(rep.gold * CD.economy.dropGold)}` : rep.retreated ? '중간에 돌아섰다 — 성공 보수는 없다' : rep.wiped ? '파티가 쓰러졌다' : '의뢰를 마치지 못했다');
  if (rep.chiseong) lines.push(`치성 +${rep.chiseong}`);
  // 재료: 해원 2 · 처치 1 + 잡귀 넋 1
  const mats: Record<string, number> = {};
  for (const [f, n] of Object.entries(rep.haewonByFamily)) mats[f] = (mats[f] ?? 0) + n * CD.economy.haewonMaterials;
  for (const [f, n] of Object.entries(rep.killByFamily)) {
    mats[f] = (mats[f] ?? 0) + n * CD.economy.killMaterials;
    mats['잡귀잡신'] = (mats['잡귀잡신'] ?? 0) + n * CD.economy.killSoul;
  }
  for (const [f, n] of Object.entries(mats)) c.materials[f] = (c.materials[f] ?? 0) + n;
  if (Object.keys(mats).length) lines.push(`재료: ${Object.entries(mats).map(([f, n]) => `${CD.materials[f] ?? f} ${n}`).join(' · ')}`);
  // 해원록
  for (const id of rep.met) if (!c.codex.includes(id)) c.codex.push(id);
  for (const [id, n] of Object.entries(rep.haewonById)) c.haewonSeen[id] = (c.haewonSeen[id] ?? 0) + n;
  // 파티
  const deadIdx: number[] = [];
  people.forEach((p, i) => {
    const h = rep.heroes[i];
    for (const [id, n] of Object.entries(h.plays)) p.history.plays[id] = (p.history.plays[id] ?? 0) + n;
    const top = Object.entries(h.plays).sort((a, b) => b[1] - a[1])[0];
    if (top) p.history.lastCard = top[0];
    if (h.dead) {
      deadIdx.push(i);
      return;
    }
    p.history.expeditions++;
    p.history.haewons += rep.haewons;
    if (rep.bossWon) p.history.bosses++;
    p.stress = Math.max(0, Math.min(99, h.stress - plan.stressAdd[i]));
    p.injured = h.injured;
    p.sorties++;
    // 경험: 원정 +1, 보스 +1 → 레벨 (최대 체력 +3)
    p.xp += CD.levels.xpExpedition + (rep.bossWon ? CD.levels.xpBoss : 0);
    const lv = Math.min(CD.levels.xp.length, levelForXp(p.xp));
    if (lv > p.level) {
      p.level = lv;
      out.levelUps.push({ uid: p.uid, level: lv });
      lines.push(`${displayName(p)} 레벨 ${lv} (최대 체력 +${CD.levels.hpPerLevel})${lv >= CD.levels.promoteLevel && !p.epithet ? ' — 내림굿을 받을 수 있다' : ''}`);
    }
    // 익힌 카드
    const card = learnFrom(p.arch, h.plays, p.learned);
    if (card) {
      p.learned.push(card);
      out.learned.push({ uid: p.uid, card });
      lines.push(`${displayName(p)}이(가) 「${d.cardById.get(card)?.name}」을(를) 익혔다`);
    }
  });
  // 원정에 나가지 않은 사람: 피로가 풀리고 귀기가 조금 가라앉는다. 예약한 휴식·치료가 끝난다
  for (const p of c.roster) {
    if (plan.uids.includes(p.uid)) continue;
    p.sorties = 0;
    if (p.busy === 'rest') {
      p.stress = Math.max(0, p.stress - 30);
      lines.push(`${p.name}이(가) 주막에서 쉬었다 (귀기 −30, 피로 해소)`);
    } else p.stress = Math.max(0, p.stress - CD.idleStressDecay);
    if (p.busy === 'treat') {
      p.injured = false;
      lines.push(`${p.name}의 중상이 나았다`);
    }
    p.busy = null;
  }
  // 인연: 함께 원정 +1, 구조 +1, 길굿 인연 다지기
  for (let a = 0; a < people.length; a++) for (let b = a + 1; b < people.length; b++) addBond(c, people[a].uid, people[b].uid, CD.bonds.together);
  for (const ri of rep.revived) {
    const saved = people[ri];
    if (!saved) continue;
    for (const o of people) if (o !== saved) {
      addBond(c, saved.uid, o.uid, CD.bonds.rescue);
      o.history.saved++;
    }
  }
  for (const [k, n] of Object.entries(rep.bondsGained)) {
    const [a, b] = k.split('+').map(Number);
    if (people[a] && people[b]) addBond(c, people[a].uid, people[b].uid, n);
  }
  // 죽음 → 사당 (천도굿 기한 2절기), 인연의 반응
  for (const i of deadIdx) {
    const p = people[i];
    c.roster = c.roster.filter((x) => x.uid !== p.uid);
    const f: Fallen = {
      person: p, died: c.season, cause: rep.wiped ? '파티가 쓰러진 자리에서' : '저승길에서', where: `${REGION_NAMES[cm.region]}`, honored: false,
      deadline: c.season + CD.death.deadline, wandering: false, sinmul: null, daughter: null,
    };
    c.fallen.push(f);
    out.deaths.push(p.uid);
    lines.push(`${displayName(p)}이(가) 저승길에서 떠났다`);
    if (rep.cheondo.includes(i)) honor(c, f);
    for (const o of c.roster) {
      if (bondOf(c, p.uid, o.uid) < CD.death.bondReact) continue;
      if (rnd(c) < 0.5) {
        o.grief = true;
        lines.push(`${o.name}이(가) 슬픔에 잠겼다 (다음 원정 귀기 +${CD.death.grief})`);
      } else {
        o.resolve = true;
        lines.push(`${o.name}이(가) 결의를 다졌다 (다음 원정 첫 턴 장단 +${CD.death.resolve})`);
      }
    }
  }
  // 보스·균열
  if (rep.bossWon && cm.length !== 'normal') {
    const b = (c.bosses[cm.region] ??= { first: c.season, wins: 0, haewon: 0 });
    b.wins++;
    if (rep.bossHaewon) b.haewon++;
    if (b.wins === 1) {
      const lot = cm.region === 1 ? 'r1boss' : cm.region === 2 ? 'r2boss' : null;
      if (lot && !c.lots.includes(lot)) {
        c.lots.push(lot);
        lines.push(lot === 'r1boss' ? '새 부지가 열렸다 — 약방 · 무구방' : '새 부지가 열렸다 — 전수청');
      }
    }
    c.rift = Math.max(0, c.rift + (rep.bossHaewon ? CD.rift.bossHaewon : CD.rift.bossKill));
    lines.push(`큰 원귀를 ${rep.bossHaewon ? '해원했다' : '처치했다'} — 저승문 균열 ${rep.bossHaewon ? CD.rift.bossHaewon : CD.rift.bossKill}`);
  }
  if (cm.seal && rep.success) {
    c.rift = Math.min(c.rift, CD.rift.sealResetTo);
    c.countdown = null;
    lines.push('균열을 봉합했다');
  }
  c.history.push({
    season: c.season, commission: cm, party: plan.uids.slice(), success: rep.success, retreated: rep.retreated, wiped: rep.wiped,
    bossHaewon: rep.bossHaewon, deaths: out.deaths.slice(), haewons: rep.haewons, gold,
  });
  // 결말: 최종 큰 원귀
  if (cm.length === 'final' && rep.bossWon) {
    c.ending = { kind: rep.bossHaewon ? 'good' : 'normal', season: c.season + 1, expeditions: c.expeditions };
    lines.push(rep.bossHaewon ? '빗장을 놓지 못한 장수를 해원했다' : '빗장을 놓지 못한 장수를 쓰러뜨렸다');
  }
  // 남은 보급품은 창고로
  for (const k of SUPPLY_IDS) c.stock[k] += Math.max(0, rep.leftover[k] ?? 0);
  passTime(c, lines);
  out.event = c.lastEvent;
  out.ending = c.ending;
  note(c, lines[0]);
  return out;
}

/** 출정하지 못한 절기 (세 원형을 꾸릴 수 없을 때): 시간만 흐른다 */
export function passSeason(c: Campaign): string[] {
  const lines = ['출정하지 못하고 한 절기를 보냈다'];
  for (const p of c.roster) {
    p.sorties = 0;
    p.stress = Math.max(0, p.stress - (p.busy === 'rest' ? 30 : CD.idleStressDecay));
    if (p.busy === 'treat') p.injured = false;
    p.busy = null;
  }
  passTime(c, lines);
  note(c, lines[0]);
  return lines;
}

function passTime(c: Campaign, lines: string[]): void {
  c.season++;
  c.rift = Math.min(CD.rift.max, c.rift + CD.rift.perSeason);
  if (c.countdown !== null && !c.ending) {
    c.countdown--;
    if (c.countdown <= 0) {
      c.ending = { kind: 'fail', season: c.season, expeditions: c.expeditions };
      lines.push('균열 봉합 기한이 지났다');
    }
  } else if (c.settings.rift && c.rift >= CD.rift.max && !c.ending) {
    c.countdown = CD.rift.countdown;
    c.countdownHits = (c.countdownHits ?? 0) + 1;
    lines.push(`저승문 균열이 가득 찼다 — ${CD.rift.countdown}절기 안에 균열 봉합 원정`);
  }
  // 천도굿 기한
  for (const f of c.fallen) if (!f.honored && !f.wandering && c.season > f.deadline) {
    f.wandering = true;
    lines.push(`${displayName(f.person)}의 넋이 떠돈다 — 천도굿 전까지 원정마다 파티 귀기 +${CD.death.wanderStress}`);
  }
  // 마을 이벤트 1장
  villageEvent(c, lines);
  if (!c.ending) startSeason(c);
}

function villageEvent(c: Campaign, lines: string[]): string | null {
  const ev = rnd(c) < 0.8 ? rpick(c, CD.events.filter((e) => e.kind === 'good')) : rpick(c, CD.events.filter((e) => e.kind === 'bad'));
  c.lastEvent = ev.id;
  const e = ev.effect;
  if (e.gold) c.gold = Math.max(0, c.gold + e.gold);
  if (e.stress) for (const p of c.roster) p.stress = Math.max(0, p.stress + e.stress);
  if (e.stressOne && c.roster.length) {
    const p = rpick(c, c.roster);
    p.stress = Math.min(99, p.stress + e.stressOne);
  }
  if (e.supplyBonus) {
    const k = rpick(c, SUPPLY_IDS);
    c.bonusSupplies[k] = (c.bonusSupplies[k] ?? 0) + e.supplyBonus;
  }
  if (e.incense) c.bonusSupplies.incense = (c.bonusSupplies.incense ?? 0) + e.incense;
  if (e.heal) {
    const p = c.roster.find((x) => x.injured);
    if (p) p.injured = false;
  }
  if (e.bond && c.roster.length >= 2) {
    const a = rpick(c, c.roster);
    const b = rpick(c, c.roster.filter((x) => x !== a));
    addBond(c, a.uid, b.uid, e.bond);
  }
  if (e.reveal) {
    const d = loadData();
    const unknown = d.enemies.filter((x) => x.category !== 'minion' && x.haewon.kind !== 'none' && x.region <= deepestRegion(c) && !c.codex.includes(x.id));
    if (unknown.length) c.codex.push(rpick(c, unknown).id);
  }
  lines.push(`마을 이벤트 — ${ev.name}: ${ev.text}`);
  return ev.id;
}

// ── 조회 ─────────────────────────────────────────────────────────────
export function supplyLine(s: Partial<Supplies>): string {
  return SUPPLY_IDS.filter((k) => (s[k] ?? 0) > 0).map((k) => `${SUPPLY_NAMES[k]} ${s[k]}`).join(' · ') || '없음';
}

/** 계보도: 조상신 → 신딸 → … */
export function lineage(c: Campaign): { root: Fallen; chain: (Person | Fallen)[] }[] {
  const out: { root: Fallen; chain: (Person | Fallen)[] }[] = [];
  const roots = c.fallen.filter((f) => f.honored && !c.fallen.some((g) => g.daughter === f.person.uid) && !f.person.mother);
  for (const r of roots) {
    const chain: (Person | Fallen)[] = [];
    let cur: string | null = r.daughter;
    while (cur) {
      const live = c.roster.find((p) => p.uid === cur);
      if (live) {
        chain.push(live);
        break;
      }
      const f = c.fallen.find((x) => x.person.uid === cur);
      if (!f) break;
      chain.push(f);
      cur = f.daughter;
    }
    out.push({ root: r, chain });
  }
  return out;
}

export interface EndingSummary {
  kind: 'good' | 'normal' | 'fail';
  text: string;
  seasons: number;
  expeditions: number;
  longest: { name: string; seasons: number } | null;
  codex: { haewon: number; total: number };
  ancestors: number;
  deaths: number;
}

export function endingSummary(c: Campaign): EndingSummary | null {
  if (!c.ending) return null;
  const all = [...c.roster.map((p) => ({ p, until: c.season })), ...c.fallen.map((f) => ({ p: f.person, until: f.died }))];
  let longest: EndingSummary['longest'] = null;
  for (const { p, until } of all) {
    const s = until - p.history.joined;
    if (!longest || s > longest.seasons) longest = { name: displayName(p), seasons: s };
  }
  const d = loadData();
  const total = d.enemies.filter((e) => e.category !== 'minion' && e.haewon.kind !== 'none').length;
  const haewon = Object.keys(c.haewonSeen).filter((id) => d.enemyById.get(id)?.category !== 'minion').length;
  return {
    kind: c.ending.kind, text: CD.endings[c.ending.kind], seasons: c.ending.season, expeditions: c.ending.expeditions, longest,
    codex: { haewon, total }, ancestors: ancestors(c).length, deaths: c.fallen.length,
  };
}
