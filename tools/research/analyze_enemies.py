"""적 데이터 분석 (Phase 1-6).

입력: data/research/enemies/*.json
출력: data/research/mechanics/enemy_analysis.json, 표준출력 요약

1. 막(지역)·분류별 체력과 한 턴 최대 피해 — 난이도 곡선
2. 행동 의도 분포 — 적이 무엇을 하는가
3. 패턴 결정성 — 고정 순환 / 확률 / 조건
4. 압박 방식 빈도 — 적이 덱과 플레이어를 어떻게 시험하는가
"""
import json
import re
import statistics
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data/research/enemies"
OUT = ROOT / "data/research/mechanics/enemy_analysis.json"

# 압박 방식: 적의 행동·능력·패턴 문장에서 찾는다
PRESSURE = {
    "scaling":      ("스스로 강해짐(누적 버프)", r"gains? \d+ strength|ritual|enrage|\bgrows?\b|increases? (?:its|their) (?:damage|attack)|\+\d+ (?:attack|damage) (?:each|every|per)|powerdrive|\brage\b|\bempower"),
    "multi_hit":    ("다단 히트", r"\bx ?\d\b|\d+ times|\bhits? (?:\d+|twice|three)|multistrike"),
    "pollute":      ("덱 오염(상태·저주 카드)", r"\bwound|\bdazed|\bslimed|\bburns?\b(?! ?out)|\bvoid\b|shuffles? .*? into your|adds? .*? (?:into|to) your (?:draw|discard|deck|hand)|\bcurse|\btrash\b|junk"),
    "debuff":       ("플레이어 약화(약화·취약·손상)", r"\bweak\b|\bvulnerable\b|\bfrail\b|\bentangle|\bconstrict|\bhex\b|\bsap\b|\bcorrode|\bbrittle|\block-?on"),
    "card_punish":  ("카드 사용 처벌·제한", r"whenever you play|for each card (?:you )?play|cards? played|beat of death|\btime warp|\bslow\b|can only play|cannot play"),
    "defense":      ("방어·피해 상한", r"\bblock\b|\bshield\b|\barmor\b|invincible|intangible|damage (?:is )?capped|malleable|plated"),
    "artifact":     ("디버프 무효", r"\bartifact\b|spellshield|immune"),
    "summon":       ("소환·증원", r"\bsummon|\bspawns?\b|calls? (?:for )?(?:help|minions)|reinforce|\bsplits?\b"),
    "mode_shift":   ("형태 변화·문턱", r"below (?:half|\d+%)|at \d+ (?:hp|health)|phase|transforms?|\bmode\b|\bshift"),
    "timer":        ("시한·자폭·도주", r"\bescape|\bflees?|explode|self-destruct|after \d+ turns|\bburnout|countdown"),
    "thorns":       ("반사 피해", r"thorns|\bspikes\b|sharp hide|damage shield"),
    "position":     ("위치·대상 조작", r"\bfront\b|\bback\b|\bfloor|\blane|\bmoves? (?:left|right)|ascend|descend|\bpush|\bpull|\bcannon|\bsweep"),
    "heal":         ("회복", r"\bheals?\b|regen|restore \d+|recover"),
    "steal":        ("자원 강탈", r"steals?|\bgold\b|\bthief|ember ?drain|emberdrain|lose \d+ energy|energy"),
}
C_PRESS = {k: re.compile(p, re.I) for k, (_, p) in PRESSURE.items()}

INTENT_RULES = [
    ("attack", r"attack|deal|damage|shoot|fire"),
    ("defend", r"block|shield|armor|defend"),
    ("buff", r"buff|strength|gain|empower"),
    ("debuff", r"debuff|weak|vulnerable|frail|status|wound|dazed"),
    ("summon", r"summon|spawn|missile|drone|launch"),
    ("move", r"move|evade|position"),
]


def text_of(e):
    parts = [e.get("pattern") or ""]
    for m in e.get("moves") or []:
        parts.append(" ".join(str(m.get(k) or "") for k in ("name", "intent", "effect")))
    parts += e.get("passives") or []
    parts += e.get("abilities") or []
    parts += e.get("parts") or []
    return " ".join(parts)


def hp_mid(e):
    hp = e.get("hp")
    if isinstance(hp, dict):
        b = hp.get("base")
        if isinstance(b, list) and b and all(isinstance(x, (int, float)) for x in b):
            return sum(b) / len(b)
        if isinstance(b, (int, float)):
            return b
    if e.get("hull") is not None:
        try:
            return float(e["hull"]) + float(e.get("shield") or 0)
        except (TypeError, ValueError):
            return None
    return None


def max_turn_damage(e):
    best = None
    for m in e.get("moves") or []:
        d, h = m.get("damage"), m.get("hits") or 1
        if isinstance(d, (int, float)):
            v = d * (h if isinstance(h, (int, float)) else 1)
            best = v if best is None else max(best, v)
    if best is None and isinstance(e.get("attack"), (int, float)):
        best = e["attack"]
    return best


def area_key(game, e):
    a = str(e.get("area") or "")
    if game.startswith("sts"):
        m = re.search(r"Act (\d)", a)
        return f"막{m.group(1)}" if m else "기타"
    if game.startswith("mt"):
        m = re.search(r"Ring[s]? (\d)", a)
        return f"링{m.group(1)}" if m else "기타"
    z = e.get("zone")
    return f"구역{z}" if z else "기타"


def determinism(e):
    p = (e.get("pattern") or "").lower()
    if re.search(r"\d+% chance|randomly|random|weighted|\bor\b.*chance", p):
        return "확률"
    if re.search(r"alternates|cycle|repeats|in order|then|always|starts with|sequence|loop", p):
        return "고정 순환"
    if p:
        return "기타·조건"
    return "미기재"


def main():
    out = {}
    for path in sorted(SRC.glob("*.json")):
        g = path.stem
        enemies = json.loads(path.read_text())["enemies"]
        curve = defaultdict(lambda: defaultdict(list))
        intents = Counter()
        det = Counter()
        press = Counter()
        press_by_cat = defaultdict(Counter)
        cats = Counter(e.get("category") for e in enemies)
        for e in enemies:
            cat = e.get("category") or "?"
            ak = area_key(g, e)
            h, d = hp_mid(e), max_turn_damage(e)
            if h is not None:
                curve[ak][f"{cat}_hp"].append(h)
            if d is not None:
                curve[ak][f"{cat}_dmg"].append(d)
            for m in e.get("moves") or []:
                it = (m.get("intent") or "").lower()
                for name, rx in INTENT_RULES:
                    if re.search(rx, it):
                        intents[name] += 1
                        break
                else:
                    intents["other"] += 1
            det[determinism(e)] += 1
            t = text_of(e)
            for k, rx in C_PRESS.items():
                if rx.search(t):
                    press[k] += 1
                    press_by_cat[cat][k] += 1
        n = len(enemies)
        out[g] = {
            "n": n, "categories": dict(cats),
            "curve": {a: {k: round(statistics.median(v), 1) for k, v in sorted(d.items())} for a, d in sorted(curve.items())},
            "intents": dict(intents.most_common()),
            "determinism": dict(det),
            "pressure": {k: round(v / n, 3) for k, v in press.most_common()},
            "pressure_by_category": {c: dict(v.most_common(6)) for c, v in press_by_cat.items()},
        }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    for g, d in out.items():
        print(f"\n== {g}  n={d['n']}  {d['categories']}")
        for a, c in d["curve"].items():
            print(f"  {a}: {c}")
        print("  intents", d["intents"])
        print("  determinism", d["determinism"])
        print("  pressure", {k: f"{v*100:.0f}%" for k, v in d["pressure"].items()})


if __name__ == "__main__":
    main()
