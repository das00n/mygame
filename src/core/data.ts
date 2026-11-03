// 설계 데이터(JSON) 로드 → 정적 정의로 컴파일. 프로세스마다 한 번만 만든다.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCond } from './conditions.ts';
import { budgetOf, rawValue, type ValueCtx } from './value.ts';
import {
  HERO_IDS, HERO_NAMES,
  type AutoTarget, type CardDef, type Cond, type Encounter, type EnemyDef, type EnemyStatus, type HaewonRule, type HeroDef,
  type HeroId, type Op, type PerMode, type RawCard, type RawOp, type RawSummon, type SpecialKind, type SummonDef, type Trigger,
} from './types.ts';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8')) as T;
}

const STATUSES = new Set(['취약', '약화', '점지', '상흔', '명부', '넋흔들림']);
const PERSONAL_RES: Record<string, HeroId> = {
  신바람: 'manshin', 가락: 'jaebi', 화약: 'posu', 작두: 'baksu', 염주: 'seungnyeo', 경면주사: 'beopsa', 탈: 'talggun', 오라: 'chasa',
};
export const PERSONAL_NAME: Record<HeroId, string> = {
  manshin: '신바람', jaebi: '가락', posu: '화약', baksu: '작두', seungnyeo: '염주', beopsa: '경면주사', talggun: '탈', chasa: '오라',
};
export const PERSONAL_CAP: Record<HeroId, number> = {
  manshin: 5, jaebi: 2, posu: 3, baksu: 1, seungnyeo: 9, beopsa: 3, talggun: 0, chasa: 3,
};

const SPECIAL_BY_CARD: Record<string, SpecialKind> = {
  'jaebi.baraji': 'baraji',
  'jaebi.samhyeon': 'samhyeon',
  'manshin.buchae_makgi': 'fire_summon',
  'manshin.mubok_garaipgi': 'gangsin_extra',
  'seungnyeo.banghal': 'instant_collapse',
  'talggun.tal_taeugi': 'tal_all',
  'chasa.ireum_seokja': 'seokja',
  'chasa.ajik_ttaega_anida': 'ajik',
  'chasa.neokjul_butdeulgi': 'rescue_ally',
  'beopsa.t_sinryeongbu': 'sinryeongbu',
  'duo.gokkal_tal': 'gokkal_tal',
  'common.rescue_neokbureugi': 'rescue',
  'common.offering_nojatdon': 'offering',
  'common.curse_heotgeot': 'heotgeot',
};

export interface GameData {
  cards: CardDef[];
  cardById: Map<string, CardDef>;
  summons: SummonDef[];
  summonById: Map<string, SummonDef>;
  heroes: Map<HeroId, HeroDef>;
  enemies: EnemyDef[];
  enemyById: Map<string, EnemyDef>;
  encounters: Encounter[];
  encounterById: Map<string, Encounter>;
  starters: Map<HeroId, CardDef[]>;
  pools: Map<HeroId, CardDef[]>; // 보상 풀 26장
  duoFor: Map<string, CardDef>; // 'a+b' (정렬) → 합기
  special: {
    rescue: number; mourn: number; offering: number; shadow: number; noise: number; wound: number;
    curses: number[]; // 씌임 4종 (영웅 전용)
  };
  synergy: { producers: Record<string, number>; consumers: Record<string, number> };
}

let cached: GameData | null = null;

export function loadData(): GameData {
  if (cached) return cached;
  const files = [...HERO_IDS, 'duo', 'common'];
  const raw: { set: string; cards: RawCard[]; tokens: RawCard[]; summons: RawSummon[] }[] = [];
  for (const f of files) {
    const j = readJson<{ cards: RawCard[]; tokens?: RawCard[]; summons?: RawSummon[] }>(`data/cards/${f}.json`);
    raw.push({ set: f, cards: j.cards, tokens: j.tokens ?? [], summons: j.summons ?? [] });
  }

  const vctx: ValueCtx = { tokens: new Map(), summons: new Map() };
  for (const r of raw) {
    for (const t of r.tokens) vctx.tokens.set(t.id, t);
    for (const s of r.summons) vctx.summons.set(s.id, s);
  }

  // 설치물 먼저 (op 컴파일에서 idx 참조)
  const summons: SummonDef[] = [];
  const summonById = new Map<string, SummonDef>();
  for (const r of raw) {
    for (const s of r.summons) {
      const def: SummonDef = {
        idx: summons.length, id: s.id, name: s.name, trigger: s.trigger, duration: s.duration ?? 3, text: s.text,
        effects: [], value: rawValue(s.effects, vctx), autoTarget: autoTargetOf(s.text),
      };
      summons.push(def);
      summonById.set(s.id, def);
    }
  }

  // 카드 정의 (부적 포함) — idx 먼저 매긴다
  const cards: CardDef[] = [];
  const cardById = new Map<string, CardDef>();
  const pending: { def: CardDef; raw: RawCard }[] = [];
  for (const r of raw) {
    const entries: [RawCard, boolean][] = [...r.cards.map((c) => [c, false] as [RawCard, boolean]), ...r.tokens.map((c) => [c, true] as [RawCard, boolean])];
    for (const [c, isToken] of entries) {
      const keywords = c.keywords ?? [];
      let ownerKind: CardDef['ownerKind'] = 'hero';
      let heroes: HeroId[] = [];
      if (r.set === 'duo') {
        ownerKind = 'duo';
        heroes = (c.owners ?? []) as HeroId[];
      } else if (r.set === 'common') {
        ownerKind = c.owner === '파티' ? 'party' : 'dynamic';
      } else {
        heroes = [r.set as HeroId];
      }
      const type = c.type ?? '기술';
      const rarity = c.rarity ?? (isToken ? '부적' : '일반');
      const def: CardDef = {
        idx: cards.length, id: c.id, name: c.name, set: r.set, type, rarity, cost: c.cost, ownerKind, heroes, keywords,
        exhaust: keywords.includes('소멸') || isToken, ethereal: keywords.includes('휘발'), unplayable: keywords.includes('사용 불가'),
        innate: keywords.includes('선천'), retain: keywords.includes('보존'),
        text: c.text, effects: [], starter: !!c.starter, path: c.path ?? 'core', isToken,
        isAttack: type === '공격', isPower: type === '능력', isCurse: type === '저주', isStatus: type === '상태',
        subtype: c.subtype ?? '', tags: { produce: c.tags?.produce ?? [], consume: c.tags?.consume ?? [] },
        value: rawValue(c.effects, vctx), budget: budgetOf(c.cost, rarity, keywords),
        needsEnemy: false, needsEnemy2: false, allyChoice: 'none', requireGangsin: false, dashHero: null, actorFor: {},
        holdFront: c.text.includes('선두를 내주지 않는다'), raisesSinjuCap: c.text.includes('5까지 쌓을 수'),
        deferTokens: c.text.includes('다음 턴 시작 시'), perEnemyOneConds: false,
      };
      cards.push(def);
      cardById.set(def.id, def);
      pending.push({ def, raw: c });
    }
  }

  const tokenIdx = (id: string): number => {
    const d = cardById.get(id);
    if (!d) throw new Error(`unknown token ${id}`);
    return d.idx;
  };
  const summonIdx = (id: string): number => {
    const d = summonById.get(id);
    if (!d) throw new Error(`unknown summon ${id}`);
    return d.idx;
  };

  for (const { def, raw: c } of pending) {
    const cc: CompileCtx = { cardId: def.id, text: def.text, isDuo: def.ownerKind === 'duo', tokenIdx, summonIdx, keyN: 0 };
    def.effects = compileOps(c.effects, cc, false);
    analyseCard(def);
  }
  for (const r of raw) {
    for (const s of r.summons) {
      const def = summonById.get(s.id)!;
      def.effects = compileOps(s.effects, { cardId: s.id, text: s.text, isDuo: false, tokenIdx, summonIdx, keyN: 0 }, false);
    }
  }

  // 영웅
  const hj = readJson<{ heroes: { id: HeroId; name: string; range: 'melee' | 'ranged'; role: string; hp: number }[] }>('data/design/heroes.json');
  const heroes = new Map<HeroId, HeroDef>();
  for (const h of hj.heroes) heroes.set(h.id, { id: h.id, name: h.name, range: h.range, role: h.role, hp: h.hp });

  // 적
  const rj = readJson<{
    enemies: { id: string; name: string; family: string; category: EnemyDef['category']; hp: [number, number]; intents: EnemyDef['intents']; pattern: EnemyDef['pattern']; passives: string[]; haewon: { status: string | null; rule: string } | null }[];
    encounters: Record<string, { id: string; enemies: string[] }[] | string>;
  }>('data/design/region1.json');
  const enemies: EnemyDef[] = [];
  const enemyById = new Map<string, EnemyDef>();
  for (const e of rj.enemies) {
    const def: EnemyDef = {
      idx: enemies.length, id: e.id, name: e.name, category: e.category, hpMin: e.hp[0], hpMax: e.hp[1], intents: e.intents,
      pattern: e.pattern, passives: e.passives, haewon: parseHaewon(e.haewon?.rule ?? null), family: e.family,
    };
    enemies.push(def);
    enemyById.set(def.id, def);
  }
  const encounters: Encounter[] = [];
  for (const tier of ['easy', 'hard', 'elite', 'boss'] as const) {
    const list = rj.encounters[tier];
    if (!Array.isArray(list)) continue;
    for (const en of list) encounters.push({ id: en.id, tier, enemies: en.enemies });
  }
  const encounterById = new Map(encounters.map((e) => [e.id, e]));

  // 풀
  const starters = new Map<HeroId, CardDef[]>();
  const pools = new Map<HeroId, CardDef[]>();
  for (const h of HERO_IDS) {
    const own = cards.filter((d) => d.set === h && !d.isToken);
    starters.set(h, own.filter((d) => d.starter));
    pools.set(h, own.filter((d) => !d.starter));
  }
  const duoFor = new Map<string, CardDef>();
  for (const d of cards) if (d.ownerKind === 'duo' && !d.isToken) duoFor.set([...d.heroes].sort().join('+'), d);

  const sj = readJson<{ producers: Record<string, number>; consumers: Record<string, number> }>('data/design/synergy.json');

  const get = (id: string) => cardById.get(id)!.idx;
  cached = {
    cards, cardById, summons, summonById, heroes, enemies, enemyById, encounters, encounterById, starters, pools, duoFor,
    special: {
      rescue: get('common.rescue_neokbureugi'), mourn: get('common.mourn_gok'), offering: get('common.offering_nojatdon'),
      shadow: get('common.status_geuneul'), noise: get('common.status_jabeum'), wound: get('common.status_sangcheo'),
      curses: ['common.curse_mangseorim', 'common.curse_heotgeot', 'common.curse_wonmang', 'common.curse_duryeoum'].map(get),
    },
    synergy: { producers: sj.producers, consumers: sj.consumers },
  };
  return cached;
}

// ── 컴파일 ──────────────────────────────────────────────────────────
interface CompileCtx {
  cardId: string;
  text: string;
  isDuo: boolean;
  tokenIdx: (id: string) => number;
  summonIdx: (id: string) => number;
  keyN: number;
}

function n0(v: unknown, d: number): number {
  return typeof v === 'number' ? v : d;
}

export function autoTargetOf(text: string): AutoTarget {
  if (text.includes('체력이 가장 낮은 적')) return 'lowestHp';
  if (text.includes('명부가 가장 많은 적')) return 'mostDoom';
  if (text.includes('무작위')) return 'random';
  return 'front';
}

function compileOps(ops: RawOp[] | undefined, cc: CompileCtx, inDownedCond: boolean): Op[] {
  const out: Op[] = [];
  for (const r of ops ?? []) {
    const c = compileOp(r, cc, inDownedCond);
    if (c) out.push(c);
  }
  return out;
}

function compileOp(r: RawOp, cc: CompileCtx, inDownedCond: boolean): Op | null {
  const key = () => `${cc.cardId}#${cc.keyN++}`;
  switch (r.op) {
    case 'dmg':
      return { op: 'dmg', n: n0(r.n, 0), hits: n0(r.hits, 1), target: (r.target as 'one' | 'all' | 'random') ?? 'one' };
    case 'block':
      return { op: 'block', n: n0(r.n, 0), to: (r.to as 'self' | 'ally' | 'party') ?? 'self' };
    case 'draw':
      return { op: 'draw', n: n0(r.n, 1) };
    case 'discard':
      return { op: 'discard', n: n0(r.n, 1) };
    case 'energy':
      return { op: 'energy', n: n0(r.n, 1), when: r.when === 'next' ? 'next' : 'now' };
    case 'apply': {
      const st = String(r.status);
      if (!STATUSES.has(st)) return null;
      return { op: 'apply', status: st as EnemyStatus, n: n0(r.n, 1), target: (r.target as 'one' | 'all' | 'random') ?? 'one' };
    }
    case 'jangdan':
      return { op: 'jangdan', n: n0(r.n, 1) };
    case 'personal':
      return { op: 'personal', n: n0(r.n, 1), hero: (r.hero as HeroId) ?? null };
    case 'move': {
      const kind = r.kind as '전진' | '후퇴' | '교대' | '엄호';
      const who = (r.who as string) ?? null;
      let mode: 'self' | 'ally' | 'pair' | 'owners' | 'downed' = 'self';
      if (kind === '교대') {
        if (who === 'allies' || cc.text.includes('두 아군') || cc.text.includes('아군 둘')) mode = 'pair';
        else if (cc.isDuo) mode = 'owners';
        else mode = 'ally';
      } else if (kind === '엄호') mode = 'ally';
      else if (kind === '후퇴') mode = inDownedCond ? 'downed' : who === 'ally' ? 'ally' : 'self';
      else mode = 'self';
      return { op: 'move', kind, who, mode, when: (r.when as string) ?? null };
    }
    case 'summon':
      return { op: 'summon', id: String(r.id), sidx: cc.summonIdx(String(r.id)) };
    case 'token':
      return { op: 'token', id: String(r.id), tidx: cc.tokenIdx(String(r.id)), n: n0(r.n, 1) };
    case 'heal':
      return { op: 'heal', n: n0(r.n, 0), to: (r.to as 'ally' | 'party' | 'self') ?? 'self' };
    case 'stress':
      return { op: 'stress', n: n0(r.n, 0), to: r.to === 'owner' ? 'owner' : 'party', when: (r.when as string) ?? null };
    case 'cleanse':
      return { op: 'cleanse', n: n0(r.n, 1) };
    case 'exhaust_other':
      return { op: 'exhaust_other', n: n0(r.n, 1) };
    case 'hp_loss':
      return { op: 'hp_loss', n: n0(r.n, 0) };
    case 'per': {
      const source = String(r.source);
      const mode = perModeOf(source, cc.text);
      return {
        op: 'per', source, each: compileOps(r.each as RawOp[], cc, inDownedCond), expect: typeof r.expect === 'number' ? r.expect : null,
        max: typeof r.max === 'number' ? r.max : null, mode, key: key(),
      };
    }
    case 'cond': {
      const ifText = String(r.if);
      const cond = parseCond(ifText);
      const p = typeof r.p === 'number' ? r.p : ifText.includes('받는소리') ? 0.6 : 0.5;
      const k = key();
      return { op: 'cond', cond, then: compileOps(r.then as RawOp[], cc, inDownedCond || cond.k === 'any_downed'), p, ifText, key: k };
    }
    case 'power': {
      const rawEffects = (r.effects as RawOp[]) ?? [];
      let hint: string | null = null;
      let gate: { res: string; n: number } | null = null;
      const kept: RawOp[] = [];
      for (const e of rawEffects) {
        if (e.op === 'consume' && e.source && !e.status && hint === null && kept.length === 0) {
          hint = String(e.source);
          continue;
        }
        if (e.op === 'consume' && e.status && PERSONAL_RES[String(e.status)] && gate === null && kept.length === 0) {
          gate = { res: String(e.status), n: n0(e.n, 1) };
          continue;
        }
        kept.push(e);
      }
      const trigger = triggerOf(r.trigger as string | undefined, hint, cc.text);
      return {
        op: 'power', trigger, effects: compileOps(kept, cc, false), expect: typeof r.expect === 'number' ? r.expect : null, gate,
        requireStance: cc.text.includes('작두 위에서 쓰는 공격'), key: key(), autoTarget: autoTargetOf(cc.text),
      };
    }
    case 'consume': {
      const n = r.n === 'all' ? 'all' : typeof r.n === 'number' ? r.n : null;
      return { op: 'consume', status: (r.status as string) ?? null, source: (r.source as string) ?? null, n };
    }
    case 'special': {
      const kind = SPECIAL_BY_CARD[cc.cardId] ?? 'approx';
      return { op: 'special', value: n0(r.value, 0), note: String(r.note ?? ''), kind, key: key() };
    }
    default:
      return null;
  }
}

function perModeOf(source: string, text: string): PerMode {
  if (STATUSES.has(source)) return 'status';
  switch (source) {
    case '장단':
      return text.includes('이번 턴 종료 시') ? 'turn_end_defer' : 'jangdan';
    case '굿상':
      return 'summons';
    case '부적':
      return text.includes('손에 든 부적') || text.includes('손의 부적') ? 'tokens_hand' : 'tokens_played';
    case '그늘':
      return 'shadow';
    case '손패':
      return 'hand';
    case '진형':
      if (text.includes('바뀔 때마다')) return 'formation_trigger';
      if (text.includes('바뀐 횟수')) return 'formation_count';
      return 'expect';
    case '탈':
      return 'tal_count';
    default:
      return PERSONAL_RES[source] ? 'personal' : 'expect';
  }
}

function triggerOf(raw: string | undefined, hint: string | null, text: string): Trigger {
  switch (raw) {
    case 'turn_start':
    case '턴 시작':
      return 'turn_start';
    case 'turn_end':
      return 'turn_end';
    case 'on_attack':
    case '점지된 적을 공격':
      return 'on_attack';
    case 'on_hit':
      return 'on_hit';
    case 'on_consume':
      return 'on_consume_mark';
    case 'on_summon_fire':
      return 'on_summon_fire';
    case '적을 묶을 때':
      return 'on_bind';
    case '매 턴 첫 진형 변화':
      return 'on_formation_change_first';
    case '매 턴 탈꾼의 첫 이동':
      return 'on_talggun_move_first';
    case '탈꾼의 자리가 바뀔 때':
      return 'on_talggun_move';
    case '중열에서 탈꾼 카드 사용':
      return 'on_owner_card';
    default:
      break;
  }
  if (hint === '부적') return 'on_token_play';
  if (hint === '진형') return 'on_formation_change';
  if (hint === '신바람') return 'on_gangsin';
  if (text.includes('턴 시작') || text.includes('턴을 시작')) return 'turn_start';
  if (text.includes('턴 종료') || text.includes('턴을 마칠')) return 'turn_end';
  return 'unknown';
}

// ── 카드 분석 (대상 선택 방식 등) ─────────────────────────────────────
const TARGET_CONDS = new Set(['tstat', 'tcollapse', 'tbound']);

function walkOps(ops: Op[], fn: (op: Op, inTargetCond: boolean) => void, inTargetCond = false): void {
  for (const op of ops) {
    fn(op, inTargetCond);
    if (op.op === 'per') walkOps(op.each, fn, inTargetCond);
    if (op.op === 'cond') walkOps(op.then, fn, inTargetCond || TARGET_CONDS.has(op.cond.k));
  }
}

function analyseCard(def: CardDef): void {
  let oneOutside = false;
  let oneAny = false;
  let allDmg = false;
  let targetCond = false;
  let move: 'none' | 'ally' | 'pair' = 'none';
  let downedCond = false;
  walkOps(def.effects, (op, inTC) => {
    if ((op.op === 'dmg' || op.op === 'apply') && op.target === 'one') {
      oneAny = true;
      if (!inTC) oneOutside = true;
    }
    if (op.op === 'dmg' && op.target === 'all') allDmg = true;
    if (op.op === 'per' && op.mode === 'status') {
      const allEach = op.each.some((e) => 'target' in e && e.target === 'all');
      if (!allEach) {
        oneAny = true;
        if (!inTC) oneOutside = true;
      }
    }
    if (op.op === 'cond' && TARGET_CONDS.has(op.cond.k)) targetCond = true;
    if (op.op === 'cond' && op.cond.k === 'ally_downed') downedCond = true;
    if (op.op === 'consume' && op.status && STATUSES.has(op.status)) {
      oneAny = true;
      oneOutside = true;
    }
    if (op.op === 'consume' && op.status === '오라') {
      oneAny = true;
      oneOutside = true;
    }
    if (op.op === 'move') {
      if (op.mode === 'pair') move = 'pair';
      else if (op.mode === 'ally' && move === 'none') move = 'ally';
    }
    if (op.op === 'cond' && op.cond.k === 'gangsin_req') def.requireGangsin = true;
  });
  def.perEnemyOneConds = !oneOutside && allDmg && oneAny;
  def.needsEnemy = !def.perEnemyOneConds && (oneAny || (targetCond && !allDmg));
  def.needsEnemy2 = def.text.includes('다른 적 하나') || def.text.includes('다른 적에게');
  def.allyChoice = downedCond ? 'downed' : move;

  if (def.ownerKind === 'duo') {
    const text = def.text;
    const nameIdx = (before: number): HeroId | null => {
      let best: HeroId | null = null;
      let bestPos = -1;
      for (const h of def.heroes) {
        const nm = HERO_NAMES[h];
        let p = text.lastIndexOf(nm, before);
        while (p >= 0 && p + nm.length > before) p = text.lastIndexOf(nm, p - 1);
        if (p > bestPos) {
          bestPos = p;
          best = h;
        }
      }
      return best;
    };
    for (const kw of ['전진', '후퇴', '엄호', '방어도'] as const) {
      const p = text.indexOf(kw);
      if (p >= 0) def.actorFor[kw] = nameIdx(p) ?? def.heroes[0];
    }
    if (def.isAttack) {
      const m = [...text.matchAll(/피해/g)];
      if (m.length) def.dashHero = nameIdx(m[m.length - 1].index ?? 0) ?? def.heroes[def.heroes.length - 1];
    }
  }
}

// ── 해원 조건 ──────────────────────────────────────────────────────────
function parseHaewon(rule: string | null): HaewonRule {
  if (!rule) return { kind: 'none', text: '' };
  const st = rule.match(/(점지|상흔|명부|넋흔들림)\s*(\d+)\s*이상/);
  if (st) return { kind: 'status', status: st[1] as EnemyStatus, n: Number(st[2]), orCollapse: rule.includes('붕괴'), text: rule };
  const jd = rule.match(/장단\s*(\d+)\s*이상/);
  if (jd) return { kind: 'jangdan', n: Number(jd[1]), text: rule };
  if (rule.includes('굿상에 설치물')) return { kind: 'summons', text: rule };
  if (rule.includes('부적')) return { kind: 'token', group: rule.includes('모두') || rule.includes('무리'), text: rule };
  if (rule.includes('진형이 바뀐')) return { kind: 'formation', text: rule };
  if (rule.includes('붕괴')) return { kind: 'collapse', text: rule };
  if (rule.includes('노잣돈')) return { kind: 'offering', text: rule };
  const mn = rule.match(/(\d+)명 이상 살아/);
  if (mn) return { kind: 'minions', n: Number(mn[1]), text: rule };
  return { kind: 'none', text: rule };
}

export function condOf(op: Op): Cond | null {
  return op.op === 'cond' ? op.cond : null;
}
