// cond.if 문장 → 결정적 조건. 읽을 수 없으면 'stochastic'(카드의 p, 기본 0.6/0.5).
// 문장 목록은 data/cards/*.json 전수(130개 cond, 60종 문장)에서 뽑았다.

import type { Cond, EnemyStatus } from './types.ts';

const STATUS_RE = /(점지|상흔|명부|넋흔들림)/;

function slotOf(text: string): number {
  if (text.includes('선두')) return 0;
  if (text.includes('중열')) return 1;
  if (text.includes('후열')) return 2;
  return -1;
}

export function parseCond(raw: string): Cond {
  const t = raw.trim();

  // ── 플레이 조건·특수 ─────────────────────────────
  if (t.includes('에만 쓸 수 있다') && t.includes('강신')) return { k: 'gangsin_req' };
  if (t.includes('강신 중')) return { k: 'gangsin' };
  if (t.includes('헛디딤') || t.includes('턴 종료(')) return { k: 'blade_fall' };
  if (t.startsWith('받는소리') && t.includes('굿상')) return { k: 'resp_summon' };
  if (t === '받는소리') return { k: 'resp' };

  // ── 트리거 문맥에서 항상 참 ─────────────────────
  if (t.includes('묶을 때마다') || t.includes('점지를 없앨 때마다') || t === '탈이 바뀔 때마다') return { k: 'always' };

  // ── 탈 (탈꾼의 칸) ──────────────────────────────
  if (t.startsWith('탈:')) {
    const s = slotOf(t);
    if (s >= 0) return { k: 'slot', slot: s, neg: false, who: 'talggun' };
  }
  // ── 위치 조건 (주인의 칸, 카드를 낼 때) ─────────
  if (t.startsWith('진형:')) {
    const s = slotOf(t);
    if (s >= 0) return { k: 'slot', slot: s, neg: t.includes('아니면'), who: 'owner' };
  }

  if (t.includes('작두 위에서')) return { k: 'stance' };
  if (t.includes('직전 카드도 만신')) return { k: 'prev_manshin' };
  if (t.includes('굿상이 비었으면') && t.includes('경면주사')) return { k: 'summons_empty_res', res: '경면주사', n: 1 };
  if (t.includes('굿상에 신령이 둘 이상')) return { k: 'summons', n: 2 };
  if (t.includes('굿상에 설치물이 있')) return { k: 'summons', n: 1 };
  if (t.includes('오라에 묶인')) return { k: 'tbound' };
  if (t.includes('진형이 두 번 이상')) return { k: 'formchg', n: 2 };
  if (t.includes('진형이 바뀌었으면')) return { k: 'formchg', n: 1 };
  if (t.includes('손의 부적') && t.includes('바치면')) return { k: 'hand_token' };
  if (t.includes('손에 그늘')) return { k: 'hand_shadow' };
  if (t.includes('가락이 당악')) return { k: 'garak_max' };
  if (t.includes('가락을 한 단계 늦추면')) return { k: 'garak_down' };
  if (t.includes('장단이 5가 되면')) return { k: 'jangdan5' };
  if (t.includes('차사를 공격하는 적')) return { k: 'attacked_chasa' };
  if (t.includes('쓰러진 아군이면')) return { k: 'ally_downed' };
  if (t.includes('쓰러진 아군이 있으면')) return { k: 'any_downed' };
  if (t.includes('뽑은 카드가 저주')) return { k: 'drawn_curse' };

  // 자원 소모 조건: "화약 1을 쓰면", "경면주사 1을 쓰면", "염주 1을 쓰면"
  const res = t.match(/^(화약|경면주사|염주|오라|신바람)\s*(\d+)을 쓰면/);
  if (res) return { k: 'res', res: res[1], n: Number(res[2]) };

  // 대상 상태 임계치
  const st = t.match(STATUS_RE);
  if (st) {
    const num = t.match(/(\d+)\s*이상/);
    const orCollapse = t.includes('붕괴');
    if (num) return { k: 'tstat', st: st[1] as EnemyStatus, n: Number(num[1]), orCollapse };
    if (t.includes('있는') || t.includes('있으면') || t.includes('된 적')) {
      return { k: 'tstat', st: st[1] as EnemyStatus, n: 1, orCollapse };
    }
  }
  if (t.includes('붕괴')) return { k: 'tcollapse' };

  const jd = t.match(/장단\D*(\d+)\s*이상/);
  if (jd) return { k: 'jangdan', n: Number(jd[1]) };

  if (t.startsWith('받는소리')) return { k: 'resp' };
  return { k: 'stochastic' };
}

export function isDeterministic(c: Cond): boolean {
  return c.k !== 'stochastic';
}
