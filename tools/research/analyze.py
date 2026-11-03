"""조사 데이터 분석 (Phase 1-3) — 메커닉 지도의 근거 수치를 만든다.

입력: data/research/cards/*.json, data/research/mechanics/tags.json (tag_mechanics.py 먼저 실행)
출력: data/research/mechanics/analysis.json, 표준출력 요약

1. 게임별 효과·성질 비율        — 우리 카드 풀의 기본 배합 기준
2. 주인별 자기완결도·연계 점수   — '반쪽 엔진' 구조가 실제로 있는가
3. 비용 대비 효율 기준선         — 단순 공격·방어 카드의 비용별 수치
4. 풀 크기·희귀도 템플릿
"""
import json
import re
import statistics
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CARDS = ROOT / "data/research/cards"
MECH = ROOT / "data/research/mechanics"

GAMES = ["sts1", "sts2", "mt1", "mt2", "cobaltcore"]
# 플레이어 캐릭터·클랜·승무원만 (공용/저주/상태/이벤트 제외)
PLAYABLE = {
    "sts1": {"Ironclad", "Silent", "Defect", "Watcher"},
    "sts2": {"Ironclad", "Silent", "Regent", "Necrobinder", "Defect"},
    "mt1": {"Hellhorned", "Awoken", "Stygian Guard", "Umbra", "Melting Remnant", "Wurmkin"},
    "mt2": {"Banished", "Pyreborne", "Luna Coven", "Underlegion", "Lazarus League", "Hellhorned", "Awoken",
            "Stygian Guard", "Umbra", "Melting Remnant", "Wurmkin", "Railforged"},
    "cobaltcore": {"Dizzy", "Riggs", "Peri", "Isaac", "Drake", "Max", "Books", "CAT"},
}
# 연계 분석에서 제외할 '너무 일반적인' 계열 (모두가 쓰므로 조합을 구분하지 못한다)
GENERIC = {"energy"}


def load():
    tags = json.loads((MECH / "tags.json").read_text())
    cards = {}
    for g in GAMES:
        for c in json.loads((CARDS / f"{g}.json").read_text())["cards"]:
            cards[c["id"]] = (g, c)
    return cards, tags


def effect_mix(cards, tags):
    out = {}
    for g in GAMES:
        ids = [i for i, (gg, c) in cards.items() if gg == g and c.get("owner") in PLAYABLE[g]
               and c.get("type") not in ("ChampionUpgrade", "Champion")]
        n = len(ids)
        eff = Counter(e for i in ids for e in tags[i]["effects"])
        props = Counter(p for i in ids for p in tags[i]["props"])
        cond = Counter(p for i in ids for p in tags[i]["conditions"])
        out[g] = {"n": n,
                  "effects": {k: round(v / n, 3) for k, v in eff.most_common()},
                  "props": {k: round(v / n, 3) for k, v in props.most_common()},
                  "conditions": {k: round(v / n, 3) for k, v in cond.most_common()}}
    return out


def owner_profiles(cards, tags):
    prof = defaultdict(lambda: {"n": 0, "produce": Counter(), "consume": Counter()})
    for i, (g, c) in cards.items():
        o = c.get("owner")
        if o not in PLAYABLE[g]:
            continue
        p = prof[(g, o)]
        p["n"] += 1
        p["produce"].update(f for f in tags[i]["produce"] if f not in GENERIC)
        p["consume"].update(f for f in tags[i]["consume"] if f not in GENERIC)
    return prof


def self_containment(prof):
    """주인이 소비하는 자원 중 '자기 자신이 충분히(소비량의 50%↑) 생산하는' 비율."""
    out = {}
    for (g, o), p in prof.items():
        cons = p["consume"]
        total = sum(cons.values())
        if not total:
            out[f"{g}:{o}"] = None
            continue
        covered = sum(v for f, v in cons.items() if p["produce"][f] >= 0.5 * v)
        out[f"{g}:{o}"] = round(covered / total, 2)
    return out


def link_scores(prof):
    """같은 게임 안 두 주인 A,B의 연계 점수 = Σ_f min(A생산_f, B소비_f) + min(B생산_f, A소비_f), 카드 수로 정규화."""
    out = {}
    for g in GAMES:
        owners = sorted(o for (gg, o) in prof if gg == g)
        rows = []
        for a, b in combinations(owners, 2):
            pa, pb = prof[(g, a)], prof[(g, b)]
            fams = set(pa["produce"]) | set(pb["produce"])
            per = {f: min(pa["produce"][f], pb["consume"][f]) + min(pb["produce"][f], pa["consume"][f]) for f in fams}
            per = {f: v for f, v in per.items() if v}
            score = sum(per.values()) / ((pa["n"] + pb["n"]) / 2)
            top = sorted(per.items(), key=lambda kv: -kv[1])[:3]
            rows.append({"pair": f"{a} + {b}", "score": round(score, 3), "glue": [f for f, _ in top]})
        rows.sort(key=lambda r: -r["score"])
        vals = [r["score"] for r in rows]
        out[g] = {"pairs": rows, "min": min(vals) if vals else None, "median": statistics.median(vals) if vals else None,
                  "max": max(vals) if vals else None}
    return out


SIMPLE_ATK = re.compile(r"^deal (\d+) damage\.?$")
SIMPLE_BLK = re.compile(r"^gain (\d+) block\.?$")


def value_baseline(cards):
    """StS1·StS2에서 효과가 한 줄뿐인 공격/방어 카드의 비용별 수치."""
    rows = defaultdict(list)
    for i, (g, c) in cards.items():
        if g not in ("sts1", "sts2"):
            continue
        t = (c.get("text") or "").strip().lower()
        cost = str(c.get("cost"))
        if not cost.isdigit():
            continue
        for kind, rx in (("attack", SIMPLE_ATK), ("block", SIMPLE_BLK)):
            m = rx.match(t)
            if m:
                rows[(kind, int(cost))].append((int(m.group(1)), c["name"], c.get("rarity")))
    return {f"{k}@{c}": sorted(v) for (k, c), v in sorted(rows.items())}


def pool_template(cards):
    out = {}
    for g in GAMES:
        per = defaultdict(Counter)
        for i, (gg, c) in cards.items():
            if gg == g and c.get("owner") in PLAYABLE[g] and c.get("type") != "ChampionUpgrade":
                per[c["owner"]][c.get("rarity") or "?"] += 1
        out[g] = {o: dict(v) for o, v in per.items()}
    return out


def main():
    cards, tags = load()
    prof = owner_profiles(cards, tags)
    result = {
        "effect_mix": effect_mix(cards, tags),
        "self_containment": self_containment(prof),
        "owner_top": {f"{g}:{o}": {"n": p["n"], "produce": p["produce"].most_common(4), "consume": p["consume"].most_common(4)}
                      for (g, o), p in sorted(prof.items())},
        "link_scores": link_scores(prof),
        "value_baseline": value_baseline(cards),
        "pool_template": pool_template(cards),
    }
    (MECH / "analysis.json").write_text(json.dumps(result, ensure_ascii=False, indent=1))

    print("== effect mix (top 10 effects, share of playable cards)")
    for g, m in result["effect_mix"].items():
        print(g, m["n"], {k: v for k, v in list(m["effects"].items())[:10]})
        print("   props", {k: v for k, v in list(m["props"].items())[:6]}, "cond", {k: v for k, v in list(m["conditions"].items())[:4]})
    print("\n== self-containment (share of consumption covered by own production)")
    for g in GAMES:
        vals = {k.split(":")[1]: v for k, v in result["self_containment"].items() if k.startswith(g + ":")}
        print(g, vals)
    print("\n== owner top produce/consume")
    for k, v in result["owner_top"].items():
        print(k, v["n"], "P", v["produce"], "C", v["consume"])
    print("\n== link scores")
    for g, d in result["link_scores"].items():
        print(g, "min/median/max", d["min"], d["median"], d["max"])
        for r in d["pairs"][:5]:
            print("   top", r)
        for r in d["pairs"][-3:]:
            print("   low", r)
    print("\n== value baseline")
    for k, v in result["value_baseline"].items():
        print(k, [x[0] for x in v], [x[1] for x in v][:6])


if __name__ == "__main__":
    main()
