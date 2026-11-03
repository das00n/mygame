"""카드 데이터 검사 + 목록 생성 (Phase 4). 기준: docs/04-cards.md

입력: data/cards/<영웅 id>.json (8개), data/cards/duo.json, data/cards/common.json
      data/design/heroes.json, data/design/synergy.json (자원 배치)
출력: docs/design/cards-<영웅 id>.md, docs/design/cards-overview.md
실행: python3 tools/design/card_check.py [--only posu,manshin] [--no-md] [--verbose]
종료 코드: 오류가 하나라도 있으면 1
"""
import argparse
import json
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
EXPECT = {"점지": 2.5, "상흔": 4, "명부": 6, "넋흔들림": 6, "장단": 3, "굿상": 1.5, "부적": 2, "그늘": 1, "손패": 4}
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
        src = ef.get("source")
        exp = ef.get("expect", EXPECT.get(src, 2))
        return value(ef.get("each"), ctx, where) * exp * 0.9
    if op == "cond":
        p = ef.get("p", 0.6 if ef.get("if") == "받는소리" else 0.5)
        return value(ef.get("then"), ctx, where) * p
    if op == "power":
        return value(ef.get("effects"), ctx, where) * ef.get("expect", 3.5) * 0.75
    if op == "consume":
        return 0
    if op == "special":
        if "value" not in ef or not ef.get("note"):
            E(where, "special: value와 note가 필요")
        return ef.get("value", 0)
    E(where, f"알 수 없는 op '{op}'")
    return 0


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
        elif op == "token":
            out["produce"].add("부적")
        elif op == "personal" and ef.get("n", 1) > 0 and personal:
            out["produce"].add(personal)
        elif op in ("per", "consume"):
            src = ef.get("source") or ef.get("status")
            if src in SHARED or src == personal:
                out["consume"].add(src)
            infer(ef.get("each"), ctx, personal, out)
        elif op == "cond":
            for name in list(SHARED) + ([personal] if personal else []):
                if name and name in str(ef.get("if", "")):
                    out["consume"].add(name)
            infer(ef.get("then"), ctx, personal, out)
        elif op == "power":
            infer(ef.get("effects"), ctx, personal, out)
    return out


# ── 영웅 파일 검사 ─────────────────────────────────────
def check_text(where, *texts):
    for t in texts:
        for bad in FORBIDDEN:
            if bad in (t or ""):
                E(where, f"금지어 '{bad}'")


def check_card_common(c, ctx, where, rows, personal=None):
    for k in c.get("keywords", []):
        if k not in KEYWORDS:
            E(where, f"허용되지 않은 키워드 '{k}'")
    check_text(where, c.get("name"), c.get("text"), c.get("upgrade"))
    if c.get("type") in ("저주", "상태"):
        rows.append((c, None, None))
        return
    v = value(c.get("effects"), ctx, where)
    if c["cost"] == "X":
        v *= 3
    b = budget(c)
    if b is None:
        E(where, f"비용 '{c['cost']}' 허용 안 됨")
        rows.append((c, v, None))
        return
    lo, hi = BAND.get(c["rarity"], DEFAULT_BAND)
    r = v / b if b else 0
    if not (lo <= r <= hi):
        E(where, f"가치 {v:.1f} / 예산 {b:.1f} = {r:.2f} (허용 {lo}~{hi})")
    if not c.get("upgrade"):
        W(where, "upgrade 문장 없음")
    rows.append((c, v, b))


def check_hero(hid, res, verbose):
    path = CARDS / f"{hid}.json"
    if not path.exists():
        E(hid, "파일 없음")
        return None
    d = json.loads(path.read_text())
    ctx = Ctx({t["id"]: t for t in d.get("tokens", [])}, {s["id"]: s for s in d.get("summons", [])})
    personal = PERSONAL[hid]
    rows, ids = [], set()
    tag_count = {"produce": Counter(), "consume": Counter()}
    for t in d.get("tokens", []):
        check_text(t["id"], t.get("name"), t.get("text"))
    for c in d["cards"]:
        where = f"{hid}/{c.get('name', c.get('id'))}"
        if not c.get("id", "").startswith(hid + "."):
            E(where, "id는 영웅 id 접두어로 시작해야 함")
        if c["id"] in ids:
            E(where, "id 중복")
        ids.add(c["id"])
        check_card_common(c, ctx, where, rows, personal)
        declared = c.get("tags", {"produce": [], "consume": []})
        inferred = infer(c.get("effects"), ctx, personal)
        for kind in ("produce", "consume"):
            for t in declared.get(kind, []):
                if t not in SHARED and t != personal:
                    E(where, f"tags.{kind}에 알 수 없는 이름 '{t}'")
            miss = inferred[kind] - set(declared.get(kind, []))
            if miss and verbose:
                W(where, f"효과에는 {kind} {sorted(miss)}가 있는데 tags에 없음")
            if not c.get("starter"):
                tag_count[kind].update(set(declared.get(kind, [])) | inferred[kind])
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
    defense = sum(1 for c in pool if any(ef.get("op") == "block" or (ef.get("op") == "move" and ef.get("kind") == "엄호") for ef in walk(c.get("effects"))))
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
    if specials > 3:
        E(hid, f"special 효과 {specials}개 (3개 이하)")
    return {"hid": hid, "rows": rows, "P": P, "C": C, "rar": rar, "ty": ty, "defense": defense, "avg": avg, "paths": paths}


def walk(effects):
    for ef in effects or []:
        yield ef
        for k in ("each", "then", "effects"):
            yield from walk(ef.get(k))


def check_extra(name, owners_ok):
    path = CARDS / f"{name}.json"
    if not path.exists():
        E(name, "파일 없음")
        return None
    d = json.loads(path.read_text())
    ctx = Ctx({t["id"]: t for t in d.get("tokens", [])}, {s["id"]: s for s in d.get("summons", [])})
    rows = []
    for c in d["cards"]:
        where = f"{name}/{c.get('name')}"
        owners_ok(c, where)
        check_card_common(c, ctx, where, rows)
    return {"name": name, "rows": rows, "data": d}


# ── 출력 ─────────────────────────────────────────────
def fmt_cost(c):
    return str(c["cost"])


def write_hero_md(hid, info, hero_name):
    L = [f"# {hero_name} 카드 (자동 생성)", "", "`tools/design/card_check.py` 가 `data/cards/" + hid + ".json` 에서 만든다. 손으로 고치지 않는다.", "",
         f"- 보상 풀 희귀도: {dict(info['rar'])} · 타입: {dict(info['ty'])} · 방어 수단 {info['defense']}장 · 평균 비용 {info['avg']:.2f} · 길 {dict(info['paths'])}",
         f"- 생산(보상 풀): " + ", ".join(f"{k} {v}" for k, v in info['P'].most_common()),
         f"- 소비(보상 풀): " + ", ".join(f"{k} {v}" for k, v in info['C'].most_common()), "",
         "| 카드 | 비용 | 타입 | 희귀도 | 길 | 효과 | 강화 | 가치/예산 |", "|---|---:|---|---|---|---|---|---:|"]
    order = {"기본": 0, "일반": 1, "고급": 2, "희귀": 3}
    for c, v, b in sorted(info["rows"], key=lambda r: (order.get(r[0]["rarity"], 9), str(r[0]["cost"]))):
        kw = (" · " + ", ".join(c.get("keywords", []))) if c.get("keywords") else ""
        ratio = f"{v / b:.2f}" if v is not None and b else "—"
        L.append(f"| **{c['name']}** | {fmt_cost(c)} | {c['type']}{kw} | {c['rarity']} | {c.get('path', 'core')} | {c['text']} | {c.get('upgrade', '')} | {ratio} |")
    (DOCS / f"cards-{hid}.md").write_text("\n".join(L) + "\n")


def write_overview(infos, extras, heroes):
    L = ["# 카드 전체 요약 (자동 생성)", "", "`tools/design/card_check.py` 출력. 기준: [docs/04-cards.md](../04-cards.md)", "",
         "| 영웅 | 카드 | 일반/고급/희귀 | 공격/기술/능력 | 방어 수단 | 평균 비용 | 가치/예산 범위 | 목록 |", "|---|---:|---|---|---:|---:|---|---|"]
    for info in infos:
        rs = [v / b for c, v, b in info["rows"] if v is not None and b]
        L.append(f"| {heroes[info['hid']]} | {len(info['rows'])} | {info['rar']['일반']}/{info['rar']['고급']}/{info['rar']['희귀']} | "
                 f"{info['ty']['공격']}/{info['ty']['기술']}/{info['ty']['능력']} | {info['defense']} | {info['avg']:.2f} | {min(rs):.2f}~{max(rs):.2f} | [보기](cards-{info['hid']}.md) |")
    for ex in extras:
        L += ["", f"## {ex['name']}", "", "| 카드 | 주인 | 비용 | 타입 | 효과 | 가치/예산 |", "|---|---|---:|---|---|---:|"]
        for c, v, b in ex["rows"]:
            owners = " + ".join(heroes.get(o, o) for o in c.get("owners", [])) or c.get("owner", "")
            ratio = f"{v / b:.2f}" if v is not None and b else "—"
            L.append(f"| **{c['name']}** | {owners} | {c['cost']} | {c['type']} | {c['text']} | {ratio} |")
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
        names.update(c["name"] for c, _, _ in info["rows"])
    for ex in extras:
        names.update(c["name"] for c, _, _ in ex["rows"])
    for n, k in names.items():
        if k > 1:
            E("전체", f"카드 이름 중복: {n} ×{k}")
    if not a.no_md:
        DOCS.mkdir(parents=True, exist_ok=True)
        for info in infos:
            write_hero_md(info["hid"], info, heroes[info["hid"]])
        if not only:
            write_overview(infos, extras, heroes)
    total = sum(len(i["rows"]) for i in infos) + sum(len(e["rows"]) for e in extras)
    print(f"검사한 카드 {total}장 (영웅 {len(infos)}명, 추가 {[e['name'] for e in extras]})")
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
