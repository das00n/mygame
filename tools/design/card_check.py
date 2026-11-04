"""카드 데이터 검사 + 목록 생성 (Phase 4, v0.3 반복 1: 강화판 효과 구조 + 가치 모델 교정 S10). 기준: docs/04-cards.md

입력: data/cards/<영웅 id>.json (8개), data/cards/duo.json, data/cards/common.json
      data/design/heroes.json, data/design/synergy.json (자원 배치)
출력: docs/design/cards-<영웅 id>.md, docs/design/cards-overview.md
실행: python3 tools/design/card_check.py [--only posu,manshin] [--no-md] [--verbose]
종료 코드: 오류가 하나라도 있으면 1
"""
import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CARDS = ROOT / "data/cards"
DOCS = ROOT / "docs/design"

CODE = {"M": "점지", "B": "상흔", "D": "명부", "C": "넋흔들림", "K": "장단", "F": "진형", "S": "굿상", "T": "부적", "V": "취약", "W": "약화"}
SHARED = set(CODE.values())
PERSONAL = {"manshin": "신바람", "jaebi": "가락", "posu": "화약", "baksu": "작두", "seungnyeo": "염주",
            "beopsa": "경면주사", "talggun": "탈", "chasa": "오라"}
GUARDIANS = {"seungnyeo", "chasa"}
DARK_CONSUMERS = {"chasa", "manshin"}

BASE = {0: 4, 1: 8, 2: 16, 3: 25}
RARITY = {"기본": 0.85, "일반": 1.0, "고급": 1.12, "희귀": 1.25, "합기": 1.3, "공용": 1.0}
KW_MULT = {"소멸": 1.3, "휘발": 1.15, "선천": 0.92, "보존": 0.95}
KEYWORDS = {"소멸", "휘발", "보존", "선천", "받는소리", "사용 불가"}
BAND = {"기본": (0.70, 1.15)}
DEFAULT_BAND = (0.80, 1.20)

APPLY = {"취약": 3.5, "약화": 3.0, "점지": 2.0, "상흔": 1.7, "명부": 1.3, "넋흔들림": 1.1, "그늘": -2.0}

# ── 가치 모델 기본값 (v0.3 S10 교정: 원정 시뮬 실측. src/core/value.ts 와 같아야 한다) ──
# 카드 op 에 p·expect 가 적혀 있으면 그 값을 쓰고, 없으면 아래 기본값.
EXPECT = {"점지": 4, "상흔": 2, "명부": 5, "넋흔들림": 5, "장단": 2, "굿상": 1, "부적": 0.5, "그늘": 1, "손패": 4}
EXPECT_OTHER = 2  # 개인 자원·진형 등
P_DEFAULT = 0.5
# cond.if 문장 → 기본 성립 확률 (첫 일치). 근거: docs/04-cards.md §2.1
COND_P = [
    (r"^받는소리$", 0.65),
    (r"(경면주사|염주) \d+[을를] 쓰면", 0.95),
    (r"이번 턴 진형이 바뀌었으면", 0.15),
    (r"부적.*바치면", 0.1),
    (r"강신 중", 0.35),
    (r"붕괴", 0.15),
]
POWER_EXPECT_TURN = 5.0  # 턴 시작·턴 종료 능력
POWER_EXPECT = 3.5  # 그 밖의 트리거
THIS_TURN_EXPECT = 0.15  # 이번 턴 임시 트리거 (this_turn). 실측: 진형 변화 0.16회/사용
POWER_FACTOR, THIS_TURN_FACTOR, PER_FACTOR = 0.75, 0.9, 0.9
TRIGGERS = {"turn_start", "turn_end", "on_attack", "on_hit", "on_bind", "on_formation_change", "on_formation_change_first",
            "on_talggun_move", "on_talggun_move_first", "on_token_play", "on_gangsin", "on_consume_mark", "on_owner_card", "on_summon_fire"}

# ── 강화 (K1) ──
UPGRADE_MULT = 1.3  # 강화판 예산 = 기본판 비용의 예산 × 1.3
UPGRADE_GAIN = (1.15, 1.45)  # 수치 강화: 가치 +15~45%
UPGRADE_KW_ALLOWED = {("+", "선천"), ("+", "보존"), ("-", "휘발"), ("-", "소멸")}
UPGRADE_KEYS = {"text", "cost", "keywords", "effects"}
NO_UPGRADE_SUBTYPES = {"공물 행동"}
ALIASES = {"붕괴": "넋흔들림", "선두": "진형", "중열": "진형", "후열": "진형"}
DECLARED_ONLY_MAX = 3
FORBIDDEN = ["광기", "미친", "발작", "정신병", "악마", "마녀", "지옥불", "선혈", "내장", "피범벅"]

errors, warns = [], []


def E(where, msg):
    errors.append(f"[{where}] {msg}")


def W(where, msg):
    warns.append(f"[{where}] {msg}")


# ── 가치 계산 ──────────────────────────────────────────
class Ctx:
    def __init__(self, tokens, summons):
        self.tokens, self.summons = tokens, summons


def value(effects, ctx, where):
    total = 0.0
    for ef in effects or []:
        total += op_value(ef, ctx, where)
    return total


def op_value(ef, ctx, where):
    op = ef.get("op")
    n = ef.get("n", 1)
    if op == "dmg":
        mult = {"one": 1.0, "all": 1.6, "random": 0.9}.get(ef.get("target", "one"), 1.0)
        return n * ef.get("hits", 1) * mult
    if op == "block":
        return n * {"self": 1.2, "ally": 1.3, "party": 2.4}.get(ef.get("to", "self"), 1.2)
    if op == "draw":
        return 4 * n
    if op == "discard":
        return -1 * n
    if op == "energy":
        return (8 if ef.get("when", "now") == "now" else 6) * n
    if op == "apply":
        st = ef.get("status")
        if st not in APPLY:
            E(where, f"apply: 알 수 없는 상태 '{st}'")
            return 0
        return APPLY[st] * n * (1.6 if ef.get("target") == "all" else 1.0)
    if op == "jangdan":
        return 2 * n if n > 0 else 0
    if op == "personal":
        return 2.5 * n if n > 0 else 0
    if op == "move":
        return {"전진": 2, "후퇴": 2, "교대": 3, "엄호": 6}.get(ef.get("kind"), 0)
    if op == "summon":
        s = ctx.summons.get(ef.get("id"))
        if not s:
            E(where, f"summon: 정의되지 않은 설치물 '{ef.get('id')}'")
            return 0
        return value(s["effects"], ctx, where) * (s.get("duration") or 3) * 0.75
    if op == "token":
        t = ctx.tokens.get(ef.get("id"))
        if not t:
            E(where, f"token: 정의되지 않은 부적 '{ef.get('id')}'")
            return 0
        return value(t["effects"], ctx, where) * n * 0.85
    if op == "heal":
        return 1.5 * n * {"self": 1.0, "ally": 1.1, "party": 2.4}.get(ef.get("to", "self"), 1.0)
    if op == "stress":
        return 0.4 * abs(n) if n < 0 else -0.4 * n
    if op == "cleanse":
        return 3 * n
    if op == "exhaust_other":
        return 2 * n
    if op == "hp_loss":
        return -1 * n
    if op == "per":
        return value(ef.get("each"), ctx, where) * per_expect(ef) * PER_FACTOR
    if op == "cond":
        p = cond_p(ef)
        return value(ef.get("then"), ctx, where) * p + value(ef.get("else"), ctx, where) * (1 - p)
    if op == "power":
        trig = ef.get("trigger")
        if trig not in TRIGGERS:
            E(where, f"power: trigger '{trig}' 가 허용 목록에 없음 ({', '.join(sorted(TRIGGERS))})")
        return value(ef.get("effects"), ctx, where) * power_expect(ef) * (THIS_TURN_FACTOR if ef.get("this_turn") else POWER_FACTOR)
    if op == "consume":
        return 0
    if op == "special":
        if "value" not in ef or not ef.get("note"):
            E(where, "special: value와 note가 필요")
        return ef.get("value", 0)
    E(where, f"알 수 없는 op '{op}'")
    return 0


def cond_p(ef):
    if "p" in ef:
        return ef["p"]
    text = str(ef.get("if", ""))
    for pat, p in COND_P:
        if re.search(pat, text):
            return p
    return P_DEFAULT


def per_expect(ef):
    if "expect" in ef:
        return ef["expect"]
    return EXPECT.get(ef.get("source"), EXPECT_OTHER)


def power_expect(ef):
    if "expect" in ef:
        return ef["expect"]
    if ef.get("this_turn"):
        return THIS_TURN_EXPECT
    return POWER_EXPECT_TURN if ef.get("trigger") in ("turn_start", "turn_end") else POWER_EXPECT


def budget(card):
    cost = card["cost"]
    if cost == "X":
        b = 24
    else:
        b = BASE.get(cost)
        if b is None:
            return None
    b *= RARITY.get(card["rarity"], 1.0)
    for k in card.get("keywords", []):
        b *= KW_MULT.get(k, 1.0)
    return b


# ── 태그 추론 ──────────────────────────────────────────
def infer(effects, ctx, personal, out=None):
    out = out or {"produce": set(), "consume": set()}
    for ef in effects or []:
        op = ef.get("op")
        if op == "apply" and ef.get("status") in SHARED:
            out["produce"].add(ef["status"])
        elif op == "jangdan" and ef.get("n", 1) > 0:
            out["produce"].add("장단")
        elif op == "move":
            out["produce"].add("진형")
        elif op == "summon":
            out["produce"].add("굿상")
            s = ctx.summons.get(ef.get("id")) if ctx else None
            if s:
                infer(s.get("effects"), ctx, personal, out)
        elif op == "token":
            out["produce"].add("부적")
            t = ctx.tokens.get(ef.get("id")) if ctx else None
            if t:
                infer(t.get("effects"), ctx, personal, out)
        elif op == "personal" and ef.get("n", 1) > 0 and personal:
            out["produce"].add(personal)
        elif op in ("per", "consume"):
            src = ef.get("source") or ef.get("status")
            if src in SHARED or src == personal:
                out["consume"].add(src)
            infer(ef.get("each"), ctx, personal, out)
        elif op == "cond":
            cond = str(ef.get("if", ""))
            for name in list(SHARED) + ([personal] if personal else []):
                if name and name in cond:
                    out["consume"].add(name)
            for alias, name in ALIASES.items():
                if alias in cond:
                    out["consume"].add(name)
            infer(ef.get("then"), ctx, personal, out)
            infer(ef.get("else"), ctx, personal, out)
        elif op == "power":
            infer(ef.get("effects"), ctx, personal, out)
    return out


# ── 영웅 파일 검사 ─────────────────────────────────────
def check_text(where, *texts):
    for t in texts:
        for bad in FORBIDDEN:
            if bad in (t or ""):
                E(where, f"금지어 '{bad}'")


def upgraded(c):
    """강화판 카드(dict). 강화가 없으면 None. 빠진 필드는 기본판을 물려받는다."""
    u = c.get("upgrade")
    if not isinstance(u, dict):
        return None
    out = dict(c)
    out["text"] = u["text"]
    for k in ("cost", "keywords", "effects"):
        if k in u:
            out[k] = u[k]
    return out


def check_upgrade(c, ctx, where, v, b):
    """강화판 검사 (K1). 반환: {v, b, ratio, gain, kind} 또는 None"""
    u = c.get("upgrade")
    if c.get("type") in ("저주", "상태") or c.get("subtype") in NO_UPGRADE_SUBTYPES:
        if u is not None:
            E(where, "저주·상태·공물 행동은 강화하지 않는다 (upgrade 를 지운다)")
        return None
    if not isinstance(u, dict):
        E(where, "upgrade 는 {text, cost?, keywords?, effects?} 객체여야 함")
        return None
    extra = set(u) - UPGRADE_KEYS
    if extra or not str(u.get("text", "")).strip():
        E(where, f"upgrade 형식: text 필수, 허용 키 {sorted(UPGRADE_KEYS)} (불필요: {sorted(extra)})")
    check_text(where + "+", u.get("text"))
    for k in u.get("keywords", []):
        if k not in KEYWORDS:
            E(where + "+", f"허용되지 않은 키워드 '{k}'")
    uc = upgraded(c)
    if uc["cost"] == "X" or c["cost"] == "X":
        dc = 0
    else:
        dc = c["cost"] - uc["cost"]
        if dc < 0 or dc > 1:
            E(where + "+", f"강화 비용 {c['cost']} → {uc['cost']} (같거나 1 낮아야 함)")
    v2 = value(uc.get("effects"), ctx, where + "+")
    if uc["cost"] == "X":
        v2 *= 3
    # '받는소리' 키워드는 효과 안내용(카드에 받는소리 효과가 있음)이라 강화 키워드 변경으로 치지 않는다
    kw_base, kw_up = set(c.get("keywords", [])) - {"받는소리"}, set(uc.get("keywords", [])) - {"받는소리"}
    kw_change = {("+", k) for k in kw_up - kw_base} | {("-", k) for k in kw_base - kw_up}
    bad_kw = kw_change - UPGRADE_KW_ALLOWED
    if bad_kw:
        E(where + "+", f"강화 키워드 변경 {sorted(bad_kw)} 은 허용되지 않음 (허용: 선천·보존 얻기, 휘발·소멸 없애기)")
    # 강화판 예산 = 기본판 비용의 예산(강화판 키워드) × UPGRADE_MULT. 비용 −1 은 예산표의 에너지 1 값(두 비용의 예산 차)으로 친다
    b_up = budget({**uc, "cost": c["cost"]})
    credit = (b_up - budget(uc)) if dc else 0.0
    r2 = (v2 + credit) / (b_up * UPGRADE_MULT)
    gain = v2 / v if v > 0 else float("inf")
    if dc:
        kind = "비용"
        if v2 < v - 1e-9:
            E(where + "+", f"비용을 낮춘 강화가 효과를 줄였다 ({v:.1f} → {v2:.1f})")
    elif kw_change:
        kind = "키워드"
        if v2 < v - 1e-9:
            E(where + "+", f"키워드 강화가 효과를 줄였다 ({v:.1f} → {v2:.1f})")
    else:
        kind = "수치"
        if not (UPGRADE_GAIN[0] - 1e-9 <= gain <= UPGRADE_GAIN[1] + 1e-9):
            E(where + "+", f"강화 가치 {v:.1f} → {v2:.1f} (+{(gain - 1) * 100:.0f}%, 허용 +{(UPGRADE_GAIN[0] - 1) * 100:.0f}~{(UPGRADE_GAIN[1] - 1) * 100:.0f}% 또는 비용 −1·키워드)")
    lo, hi = BAND.get(c["rarity"], DEFAULT_BAND)
    if not (lo <= r2 <= hi):
        E(where + "+", f"강화판 가치 {v2:.1f}{f' + 비용 {credit:.1f}' if credit else ''} / 강화 예산 {b_up * UPGRADE_MULT:.1f} = {r2:.2f} (허용 {lo}~{hi})")
    return {"v": v2, "b": b_up * UPGRADE_MULT, "ratio": r2, "gain": gain, "kind": kind, "card": uc}


def check_card_common(c, ctx, where, rows, personal=None):
    for k in c.get("keywords", []):
        if k not in KEYWORDS:
            E(where, f"허용되지 않은 키워드 '{k}'")
    check_text(where, c.get("name"), c.get("text"))
    if c.get("type") in ("저주", "상태"):
        check_upgrade(c, ctx, where, 0, 0)
        rows.append((c, None, None, None))
        return
    v = value(c.get("effects"), ctx, where)
    if c["cost"] == "X":
        v *= 3
    b = budget(c)
    if b is None:
        E(where, f"비용 '{c['cost']}' 허용 안 됨")
        rows.append((c, v, None, None))
        return
    lo, hi = BAND.get(c["rarity"], DEFAULT_BAND)
    r = v / b if b else 0
    if not (lo <= r <= hi):
        E(where, f"가치 {v:.1f} / 예산 {b:.1f} = {r:.2f} (허용 {lo}~{hi})")
    up = check_upgrade(c, ctx, where, v, b)
    rows.append((c, v, b, up))


def check_tokens(name, d):
    """부적(토큰)은 타입(기술·공격)을 갖는다. 능력 트리거는 허용 목록. 문장 금지어."""
    for t in d.get("tokens", []):
        check_text(f"{name}/{t.get('id')}", t.get("name"), t.get("text"))
        if t.get("type") not in ("기술", "공격"):
            E(f"{name}/{t.get('id')}", f"부적 type '{t.get('type')}' (기술 또는 공격)")
    for x in d.get("summons", []):
        check_text(f"{name}/{x.get('id')}", x.get("name"), x.get("text"))
        if x.get("trigger") not in ("turn_start", "turn_end"):
            E(f"{name}/{x.get('id')}", f"설치물 trigger '{x.get('trigger')}' (turn_start·turn_end)")


def check_hero(hid, res, verbose):
    path = CARDS / f"{hid}.json"
    if not path.exists():
        E(hid, "파일 없음")
        return None
    d = json.loads(path.read_text())
    ctx = Ctx({t["id"]: t for t in d.get("tokens", [])}, {s["id"]: s for s in d.get("summons", [])})
    personal = PERSONAL[hid]
    rows, ids = [], set()
    declared_only = []
    tag_count = {"produce": Counter(), "consume": Counter()}
    check_tokens(hid, d)
    for c in d["cards"]:
        where = f"{hid}/{c.get('name', c.get('id'))}"
        if not c.get("id", "").startswith(hid + "."):
            E(where, "id는 영웅 id 접두어로 시작해야 함")
        if c["id"] in ids:
            E(where, "id 중복")
        ids.add(c["id"])
        check_card_common(c, ctx, where, rows, personal)
        uc = upgraded(c)
        if uc and CODE[res["import"]] in infer(uc.get("effects"), ctx, personal)["produce"]:
            E(where + "+", f"강화판이 수입 자원 {CODE[res['import']]}을 생산한다 (C5)")
        declared = c.get("tags", {"produce": [], "consume": []})
        inferred = infer(c.get("effects"), ctx, personal)
        for kind in ("produce", "consume"):
            for t in declared.get(kind, []):
                if t not in SHARED and t != personal:
                    E(where, f"tags.{kind}에 알 수 없는 이름 '{t}'")
            miss = inferred[kind] - set(declared.get(kind, []))
            if miss and verbose:
                W(where, f"효과에는 {kind} {sorted(miss)}가 있는데 tags에 없음")
            only_declared = set(declared.get(kind, [])) - inferred[kind]
            if only_declared and not c.get("starter"):
                declared_only.append(f"{c['name']}:{kind}:{','.join(sorted(only_declared))}")
            if not c.get("starter"):
                tag_count[kind].update(set(declared.get(kind, [])) | inferred[kind])
    if len(declared_only) > DECLARED_ONLY_MAX:
        E(hid, f"효과에서 추론되지 않는 선언 태그 {len(declared_only)}개 (최대 {DECLARED_ONLY_MAX}): {declared_only}")
    elif declared_only and verbose:
        W(hid, f"선언만 된 태그: {declared_only}")
    # 수량
    starters = [c for c in d["cards"] if c.get("starter")]
    pool = [c for c in d["cards"] if not c.get("starter")]
    if len(starters) != 4 or any(c["rarity"] != "기본" for c in starters):
        E(hid, f"시작 카드 {len(starters)}장 (기본 희귀도 4장이어야 함)")
    rar = Counter(c["rarity"] for c in pool)
    for k, n in {"일반": 11, "고급": 10, "희귀": 5}.items():
        if abs(rar[k] - n) > 1:
            E(hid, f"보상 풀 {k} {rar[k]}장 (목표 {n}±1)")
    if not 25 <= len(pool) <= 27:
        E(hid, f"보상 풀 {len(pool)}장 (목표 26±1)")
    ty = Counter(c["type"] for c in pool)
    for k, (lo, hi) in {"공격": (9, 13), "기술": (9, 13), "능력": (3, 5)}.items():
        if not lo <= ty[k] <= hi:
            E(hid, f"타입 {k} {ty[k]}장 (허용 {lo}~{hi})")
    defense = sum(1 for c in pool if any(ef.get("op") == "block" or (ef.get("op") == "move" and ef.get("kind") == "엄호") for ef in walk(c.get("effects"), ctx)))
    need_def = 8 if hid in GUARDIANS else 5
    if defense < need_def:
        E(hid, f"방어 수단 {defense}장 (최소 {need_def})")
    costs = [c["cost"] for c in pool if c["cost"] != "X"]
    avg = sum(costs) / len(costs)
    if not 1.0 <= avg <= 1.6:
        E(hid, f"평균 비용 {avg:.2f} (허용 1.0~1.6)")
    if costs.count(0) > 4:
        E(hid, f"0코스트 {costs.count(0)}장 (4장 이하)")
    if not 1 <= costs.count(3) <= 3:
        E(hid, f"3코스트 {costs.count(3)}장 (1~3장)")
    paths = Counter(c.get("path", "core") for c in pool)
    if paths["A"] < 7 or paths["B"] < 7:
        E(hid, f"길 A {paths['A']}장 · B {paths['B']}장 (각 7장 이상)")
    # 자원
    P, C = tag_count["produce"], tag_count["consume"]
    sig, imp = CODE[res["signature"]], CODE[res["import"]]
    main, minors = CODE[res["main"]], [CODE[m] for m in res["minor"]]
    checks = [(P[sig], 8, f"시그니처 {sig} 생산"), (C[sig], 4, f"시그니처 {sig} 소비"),
              (P[main], 5, f"주 수출 {main} 생산"), (C[imp], 4, f"수입 {imp} 소비"),
              (P[personal] + C[personal], 5, f"개인 자원 {personal}")]
    checks += [(P[m], 3, f"부 수출 {m} 생산") for m in minors]
    checks += [(P[CODE[u]], 2, f"범용 {CODE[u]} 생산") for u in res["universal"]]
    for got, need, label in checks:
        if got < need:
            E(hid, f"{label} {got}장 (최소 {need})")
    if C[imp] > 6:
        E(hid, f"수입 {imp} 소비 {C[imp]}장 (6장 이하 — 동료 의존 과다)")
    if P[imp] > 0:
        E(hid, f"수입 자원 {imp}을 생산하는 카드 {P[imp]}장 (0장이어야 함, C5)")
    dark = sum(1 for c in pool if "그늘" in json.dumps(c.get("effects"), ensure_ascii=False))
    if hid in DARK_CONSUMERS and not 1 <= dark <= 2:
        E(hid, f"그늘 소비 카드 {dark}장 (1~2장)")
    if hid not in DARK_CONSUMERS and dark:
        E(hid, f"그늘 소비는 차사·만신만 (현재 {dark}장)")
    specials = sum(1 for c in d["cards"] for ef in walk(c.get("effects")) if ef.get("op") == "special")
    specials += sum(1 for t in list(d.get("tokens", [])) + list(d.get("summons", [])) for ef in walk(t.get("effects")) if ef.get("op") == "special")
    if specials > 4:
        E(hid, f"special 효과 {specials}개 (카드·부적·설치물 합쳐 4개 이하)")
    names_extra = [t["name"] for t in d.get("tokens", [])] + [x["name"] for x in d.get("summons", [])]
    return {"hid": hid, "rows": rows, "P": P, "C": C, "rar": rar, "ty": ty, "defense": defense, "avg": avg, "paths": paths, "extra_names": names_extra}


def walk(effects, ctx=None, _seen=None):
    """효과 트리를 훑는다. ctx가 있으면 부적·설치물 안쪽까지 들어간다."""
    _seen = _seen if _seen is not None else set()
    for ef in effects or []:
        yield ef
        for k in ("each", "then", "else", "effects"):
            yield from walk(ef.get(k), ctx, _seen)
        if ctx and ef.get("op") in ("token", "summon"):
            ref = ef.get("id")
            if ref in _seen:
                continue
            _seen.add(ref)
            src = (ctx.tokens if ef["op"] == "token" else ctx.summons).get(ref)
            if src:
                yield from walk(src.get("effects"), ctx, _seen)


def check_extra(name, owners_ok):
    path = CARDS / f"{name}.json"
    if not path.exists():
        E(name, "파일 없음")
        return None
    d = json.loads(path.read_text())
    ctx = Ctx({t["id"]: t for t in d.get("tokens", [])}, {s["id"]: s for s in d.get("summons", [])})
    rows = []
    check_tokens(name, d)
    for c in d["cards"]:
        where = f"{name}/{c.get('name')}"
        owners_ok(c, where)
        check_card_common(c, ctx, where, rows)
    extra_names = [t["name"] for t in d.get("tokens", [])] + [x["name"] for x in d.get("summons", [])]
    return {"name": name, "rows": rows, "data": d, "extra_names": extra_names}


# ── 출력 ─────────────────────────────────────────────
def fmt_cost(c):
    return str(c["cost"])


def upgrade_cell(c, up):
    """문서 표의 강화 칸: 비용·키워드 변경 + 강화판 문장"""
    if not up:
        return "—"
    uc = up["card"]
    pre = []
    if uc["cost"] != c["cost"]:
        pre.append(f"비용 {c['cost']}→{uc['cost']}")
    kb, ku = c.get("keywords", []), uc.get("keywords", [])
    pre += [f"+{k}" for k in ku if k not in kb] + [f"−{k}" for k in kb if k not in ku]
    return (f"[{' · '.join(pre)}] " if pre else "") + uc["text"]


def upgrade_ratio(up):
    if not up:
        return "—"
    g = "" if up["kind"] != "수치" else f" (+{(up['gain'] - 1) * 100:.0f}%)"
    return f"{up['ratio']:.2f}{g}" if up["kind"] == "수치" else f"{up['ratio']:.2f} ({up['kind']})"


def write_hero_md(hid, info, hero_name):
    L = [f"# {hero_name} 카드 (자동 생성)", "", "`tools/design/card_check.py` 가 `data/cards/" + hid + ".json` 에서 만든다. 손으로 고치지 않는다.", "",
         f"- 보상 풀 희귀도: {dict(info['rar'])} · 타입: {dict(info['ty'])} · 방어 수단 {info['defense']}장 · 평균 비용 {info['avg']:.2f} · 길 {dict(info['paths'])}",
         f"- 생산(보상 풀): " + ", ".join(f"{k} {v}" for k, v in info['P'].most_common()),
         f"- 소비(보상 풀): " + ", ".join(f"{k} {v}" for k, v in info['C'].most_common()),
         "- **강화 가치** = (강화판 가치 + 비용 −1 의 에너지 값) / (기본판 비용의 예산 × 1.3). 괄호는 수치 강화의 가치 증가율 또는 강화 종류(비용·키워드). 기준: [04-cards §3.1](../04-cards.md)", "",
         "| 카드 | 비용 | 타입 | 희귀도 | 길 | 효과 | 강화 | 가치/예산 | 강화 가치 |", "|---|---:|---|---|---|---|---|---:|---:|"]
    order = {"기본": 0, "일반": 1, "고급": 2, "희귀": 3}
    for c, v, b, up in sorted(info["rows"], key=lambda r: (order.get(r[0]["rarity"], 9), str(r[0]["cost"]))):
        kw = (" · " + ", ".join(c.get("keywords", []))) if c.get("keywords") else ""
        ratio = f"{v / b:.2f}" if v is not None and b else "—"
        L.append(f"| **{c['name']}** | {fmt_cost(c)} | {c['type']}{kw} | {c['rarity']} | {c.get('path', 'core')} | {c['text']} | {upgrade_cell(c, up)} | {ratio} | {upgrade_ratio(up)} |")
    (DOCS / f"cards-{hid}.md").write_text("\n".join(L) + "\n")


ROSTER_MIN = 2
LINKABLE = SHARED - {"취약", "약화"}


def roster_links(infos, heroes):
    """카드 데이터에서 다시 계산한 영웅 쌍의 연계 강도: Σ_자원 min(A 생산 장수, B 소비 장수) + 반대 방향."""
    from itertools import combinations
    by = {i["hid"]: i for i in infos}
    out = []
    for a, b in combinations(list(by), 2):
        A, B = by[a], by[b]
        per = {}
        for r in LINKABLE:
            v = min(A["P"][r], B["C"][r]) + min(B["P"][r], A["C"][r])
            if v:
                per[r] = v
        out.append((f"{heroes[a]} + {heroes[b]}", sum(per.values()), sorted(per.items(), key=lambda kv: -kv[1])[:3]))
    return sorted(out, key=lambda x: x[1])


def write_overview(infos, extras, heroes, roster=None):
    L = ["# 카드 전체 요약 (자동 생성)", "", "`tools/design/card_check.py` 출력. 기준: [docs/04-cards.md](../04-cards.md)", "",
         "| 영웅 | 카드 | 일반/고급/희귀 | 공격/기술/능력 | 방어 수단 | 평균 비용 | 가치/예산 범위 | 강화 가치 범위 | 목록 |", "|---|---:|---|---|---:|---:|---|---|---|"]
    for info in infos:
        rs = [v / b for c, v, b, _ in info["rows"] if v is not None and b]
        us = [up["ratio"] for *_, up in info["rows"] if up]
        L.append(f"| {heroes[info['hid']]} | {len(info['rows'])} | {info['rar']['일반']}/{info['rar']['고급']}/{info['rar']['희귀']} | "
                 f"{info['ty']['공격']}/{info['ty']['기술']}/{info['ty']['능력']} | {info['defense']} | {info['avg']:.2f} | {min(rs):.2f}~{max(rs):.2f} | {min(us):.2f}~{max(us):.2f} | [보기](cards-{info['hid']}.md) |")
    if roster:
        vals = [s for _, s, _ in roster]
        L += ["", "## 로스터 연계 (카드 데이터로 다시 계산)", "",
              f"영웅 쌍 28개의 연계 강도 = Σ 자원 min(A가 생산하는 카드 수, B가 소비하는 카드 수) + 반대 방향. 최소 {min(vals)} · 중앙 {sorted(vals)[len(vals)//2]} · 최대 {max(vals)} (기준 {ROSTER_MIN} 이상)", "",
              "| 쌍 | 강도 | 주요 자원 |", "|---|---:|---|"]
        for pair, st, top in roster:
            L.append(f"| {pair} | {st} | {', '.join(f'{r} {v}' for r, v in top)} |")
    for ex in extras:
        L += ["", f"## {ex['name']}", "", "| 카드 | 주인 | 비용 | 타입 | 효과 | 강화 | 가치/예산 | 강화 가치 |", "|---|---|---:|---|---|---|---:|---:|"]
        for c, v, b, up in ex["rows"]:
            owners = " + ".join(heroes.get(o, o) for o in c.get("owners", [])) or c.get("owner", "")
            ratio = f"{v / b:.2f}" if v is not None and b else "—"
            L.append(f"| **{c['name']}** | {owners} | {c['cost']} | {c['type']} | {c['text']} | {upgrade_cell(c, up)} | {ratio} | {upgrade_ratio(up)} |")
    (DOCS / "cards-overview.md").write_text("\n".join(L) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--no-md", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    a = ap.parse_args()
    heroes_data = json.loads((ROOT / "data/design/heroes.json").read_text())["heroes"]
    choice = json.loads((ROOT / "data/design/synergy.json").read_text())["choice"]
    heroes = {h["id"]: h["name"] for h in heroes_data}
    res = {h["id"]: {"signature": h["signature"], "import": h["import"], "universal": h["universal"],
                     "main": choice[h["id"]]["main"], "minor": choice[h["id"]]["minor"]} for h in heroes_data}
    only = [x for x in a.only.split(",") if x]
    targets = only or list(heroes)
    infos = []
    for hid in targets:
        if hid in heroes:
            info = check_hero(hid, res[hid], a.verbose)
            if info:
                infos.append(info)
    extras = []
    if not only or "duo" in only:
        def duo_ok(c, where):
            o = c.get("owners", [])
            if len(o) != 2 or any(x not in heroes for x in o) or c.get("rarity") != "합기":
                E(where, "합기 카드는 owners 2명(영웅 id)과 희귀도 '합기'")
            if "받는소리" in c.get("keywords", []):
                E(where, "합기 카드는 받는소리가 항상 성립하므로 키워드로 달지 않는다")
        ex = check_extra("duo", duo_ok)
        if ex:
            pairs = Counter(tuple(sorted(c["owners"])) for c in ex["data"]["cards"])
            if len(pairs) != 28 or any(v != 1 for v in pairs.values()):
                E("duo", f"영웅 쌍 28개에 1장씩이어야 함 (현재 {len(pairs)}쌍, 중복 {[k for k, v in pairs.items() if v > 1]})")
            extras.append(ex)
    if not only or "common" in only:
        def common_ok(c, where):
            if c.get("type") not in ("저주", "상태") and c.get("rarity") != "공용":
                E(where, "공용 카드의 희귀도는 '공용'")
        ex = check_extra("common", common_ok)
        if ex:
            extras.append(ex)
    # 이름 중복(전체)
    names = Counter()
    for info in infos:
        names.update(c["name"] for c, *_ in info["rows"])
    for ex in extras:
        names.update(c["name"] for c, *_ in ex["rows"])
    for n, k in names.items():
        if k > 1:
            E("전체", f"카드 이름 중복: {n} ×{k}")
    extra = Counter()
    for x in infos + extras:
        extra.update(x.get("extra_names", []))
    for n, k in extra.items():
        if k > 1 or names.get(n):
            W("전체", f"부적·설치물 이름이 겹침: {n}")
    roster = None
    if not only and len(infos) == 8:
        roster = roster_links(infos, heroes)
        for pair, strength, _ in roster:
            if strength < ROSTER_MIN:
                E("로스터", f"{pair}: 카드 연계 강도 {strength} (최소 {ROSTER_MIN})")
    if not a.no_md:
        DOCS.mkdir(parents=True, exist_ok=True)
        for info in infos:
            write_hero_md(info["hid"], info, heroes[info["hid"]])
        if not only:
            write_overview(infos, extras, heroes, roster)
    total = sum(len(i["rows"]) for i in infos) + sum(len(e["rows"]) for e in extras)
    print(f"검사한 카드 {total}장 (영웅 {len(infos)}명, 추가 {[e['name'] for e in extras]})")
    ups = [up for x in infos + extras for *_, up in x["rows"] if up]
    if ups:
        kinds = Counter(u["kind"] for u in ups)
        print(f"강화판 {len(ups)}장 ({', '.join(f'{k} {n}' for k, n in kinds.most_common())}) · 강화 가치 {min(u['ratio'] for u in ups):.2f}~{max(u['ratio'] for u in ups):.2f}")
    if roster:
        vals = [s for _, s, _ in roster]
        print(f"로스터 연계 강도: 최소 {min(vals)} ({roster[0][0]}) · 중앙 {sorted(vals)[len(vals)//2]} · 최대 {max(vals)}")
    for w in warns:
        print("주의:", w)
    for e in errors:
        print("❌", e)
    if errors:
        print(f"오류 {len(errors)}개")
        sys.exit(1)
    print("✅ 모든 검사 통과")


if __name__ == "__main__":
    main()
