"""영웅 자원 배치 검증·탐색 (Phase 3).

입력: data/design/heroes.json
- 영웅마다 signature(자기 엔진: 생산+소비), import(다른 영웅 자원 소비 = 증폭), exports_candidates(생산 후보 3개)
- 후보 중 2~3개(주·부)를 고르는 조합을 수출 3개 영웅 수가 적은 순으로 탐색해, 아래 제약을 만족하고 3인 조합 다양성이 가장 높은 배치를 고른다.

제약 (docs/research/findings.md R2·R3, docs/02-core-rules.md §5):
  C1 상태·매개체마다 소비자 1~2명
  C2 상태·매개체마다 생산자 2명 이상 (한 명이 죽어도 끊기지 않게)
  C3 모든 2인 쌍에 설계된 연계 1개 이상 (A 생산 → B 소비, 또는 반대). 범용(취약·약화)은 제외
  C4 3인 조합 56개의 '중심 자원'이 고르게 퍼진다 (한 자원이 25% 초과 금지)
  C5 영웅은 자기가 수입하는 자원을 수출하지 않는다 (증폭은 동료에게서 온다)

출력: data/design/synergy.json, docs/design/synergy-matrix.md
실행: python3 tools/design/synergy.py
"""
import json
from collections import Counter
from itertools import combinations, product
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data/design/heroes.json"
OUT_JSON = ROOT / "data/design/synergy.json"
OUT_MD = ROOT / "docs/design/synergy-matrix.md"

W_PROD = {"signature": 2, "main": 2, "minor": 1}
W_CONS = {"signature": 1, "import": 2}


def load():
    d = json.loads(SRC.read_text())
    return d["resources"], d["heroes"]


def consumables(resources):
    return [k for k, v in resources.items() if v["kind"] != "universal"]


def build(heroes, choice):
    """choice[i] = (main, minor, [minor2]). 영웅별 생산/소비 가중치 표를 만든다."""
    prod, cons = {}, {}
    for h, exports in zip(heroes, choice):
        p = {h["signature"]: W_PROD["signature"]}
        for k, r in enumerate(exports):
            w = W_PROD["main"] if k == 0 else W_PROD["minor"]
            p[r] = max(p.get(r, 0), w)
        prod[h["id"]] = p
        cons[h["id"]] = {h["signature"]: W_CONS["signature"], h["import"]: W_CONS["import"]}
    return prod, cons


def pair_links(a, b, prod, cons):
    links = []
    for r in set(prod[a]) & set(cons[b]):
        links.append((a, b, r))
    for r in set(prod[b]) & set(cons[a]):
        links.append((b, a, r))
    return links


def trio_center(trio, prod, cons, keys):
    scores = {}
    for r in keys:
        p = sum(prod[h].get(r, 0) for h in trio)
        c = sum(cons[h].get(r, 0) for h in trio)
        # 소비가 자기 시그니처뿐인(무게 1) 경우보다, 다른 영웅이 수입해 증폭하는 자원을 우선한다
        scores[r] = p * c
    ranked = sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))
    return ranked


def evaluate(resources, heroes, choice):
    keys = consumables(resources)
    prod, cons = build(heroes, choice)
    ids = [h["id"] for h in heroes]
    n_cons = {r: sum(1 for h in ids if r in cons[h]) for r in keys}
    n_prod = {r: sum(1 for h in ids if r in prod[h]) for r in keys}
    ok_c1 = all(1 <= n_cons[r] <= 2 for r in keys)
    ok_c2 = all(n_prod[r] >= 2 for r in keys)
    pairs = {f"{a}+{b}": pair_links(a, b, prod, cons) for a, b in combinations(ids, 2)}
    dead = [k for k, v in pairs.items() if not v]
    trios = {}
    for t in combinations(ids, 3):
        ranked = trio_center(t, prod, cons, keys)
        trios["+".join(t)] = ranked[:2]
    centers = Counter(v[0][0] for v in trios.values())
    max_share = max(centers.values()) / len(trios)
    return {
        "ok": ok_c1 and ok_c2 and not dead and max_share <= 0.25,
        "c1_consumers": n_cons, "c2_producers": n_prod, "dead_pairs": dead,
        "pairs": pairs, "trios": trios, "centers": dict(centers), "max_share": round(max_share, 3),
        "link_count": {k: len(v) for k, v in pairs.items()},
        "prod": prod, "cons": cons,
    }


def _options(h, size):
    # 수입(증폭) 자원은 동료에게서 와야 하므로 스스로 수출하지 않는다
    c = [r for r in h["exports_candidates"] if r != h["import"]]
    return [tuple(c[i] for i in idx) for idx in combinations(range(len(c)), size)]


def search(resources, heroes):
    """수출 3개짜리 영웅 수 k를 0부터 늘려 가며, 처음으로 해가 나오는 k에서 가장 다양한 배치를 고른다."""
    keys = consumables(resources)
    bit = {r: 1 << i for i, r in enumerate(keys)}
    ids = [h["id"] for h in heroes]
    cons_mask = [bit[h["signature"]] | bit[h["import"]] for h in heroes]
    pairs = list(combinations(range(len(heroes)), 2))
    for k in range(len(heroes) + 1):
        best = None
        for three in combinations(range(len(heroes)), k):
            opts = [_options(h, 3 if i in three else 2) for i, h in enumerate(heroes)]
            masks = [[bit[h["signature"]] | sum(bit[r] for r in o) for o in ol] for h, ol in zip(heroes, opts)]
            for idx in product(*[range(len(o)) for o in opts]):
                pm = [masks[i][j] for i, j in enumerate(idx)]
                if any(not ((pm[a] & cons_mask[b]) or (pm[b] & cons_mask[a])) for a, b in pairs):
                    continue
                if any(sum(1 for m in pm if m & bit[r]) < 2 for r in keys):
                    continue
                choice = tuple(opts[i][j] for i, j in enumerate(idx))
                ev = evaluate(resources, heroes, choice)
                if not ev["ok"]:
                    continue
                key = (len(ev["centers"]), -ev["max_share"], min(ev["link_count"].values()), sum(ev["link_count"].values()))
                if best is None or key > best[0]:
                    best = (key, choice, ev)
        if best:
            print(f"수출 3개 영웅 수 k={k} 에서 해를 찾음")
            return best
    return None


def write_md(resources, heroes, choice, ev):
    name = {h["id"]: h["name"] for h in heroes}
    rn = {k: v["name"] for k, v in resources.items()}
    lines = ["# 시너지 매트릭스 (자동 생성)", "",
             "`tools/design/synergy.py` 가 `data/design/heroes.json` 에서 만든다. 손으로 고치지 않는다.", "",
             "## 영웅별 자원", "", "| 영웅 | 거리 | 역할 | 시그니처(생산+소비) | 주 수출 | 부 수출 | 수입(증폭) | 범용 |", "|---|---|---|---|---|---|---|---|"]
    for h, ex in zip(heroes, choice):
        lines.append(f"| {h['name']} | {'근접' if h['range'] == 'melee' else '원거리'} | {h['role']} | {rn[h['signature']]} | {rn[ex[0]]} | {', '.join(rn[r] for r in ex[1:])} | {rn[h['import']]} | {', '.join(rn[u] for u in h['universal']) or '—'} |")
    lines += ["", "## 자원별 생산자·소비자 수 (C1 소비자 1~2, C2 생산자 2+)", "", "| 자원 | 생산자 | 소비자 |", "|---|---:|---:|"]
    for r in ev["c1_consumers"]:
        lines.append(f"| {rn[r]} | {ev['c2_producers'][r]} | {ev['c1_consumers'][r]} |")
    ids = [h["id"] for h in heroes]
    lines += ["", "## 2인 연계 (C3) — 셀 = A→B 자원 (A가 만들고 B가 쓴다)", "", "| | " + " | ".join(name[i] for i in ids) + " |", "|---|" + "---|" * len(ids)]
    for a in ids:
        row = []
        for b in ids:
            if a == b:
                row.append("—")
                continue
            key = f"{a}+{b}" if f"{a}+{b}" in ev["pairs"] else f"{b}+{a}"
            rs = [rn[r].split("(")[0] for (x, y, r) in ev["pairs"][key] if x == a]
            row.append(", ".join(rs) or "·")
        lines.append(f"| **{name[a]}** | " + " | ".join(row) + " |")
    lines += ["", f"연계 0인 쌍: **{len(ev['dead_pairs'])}개**", "",
              "## 3인 조합의 중심 자원 (C4)", "", f"중심 자원 분포: " + ", ".join(f"{rn[k].split('(')[0]} {v}" for k, v in sorted(ev['centers'].items(), key=lambda kv: -kv[1])) + f" · 최대 점유율 {ev['max_share']*100:.0f}%", "",
              "| 조합 | 중심 | 보조 |", "|---|---|---|"]
    for t, ranked in ev["trios"].items():
        lines.append(f"| {' + '.join(name[i] for i in t.split('+'))} | {rn[ranked[0][0]]} ({ranked[0][1]}) | {rn[ranked[1][0]]} ({ranked[1][1]}) |")
    OUT_MD.parent.mkdir(parents=True, exist_ok=True)
    OUT_MD.write_text("\n".join(lines) + "\n")


def main():
    resources, heroes = load()
    best = search(resources, heroes)
    if best is None:
        print("제약을 만족하는 배치가 없다. exports_candidates 를 바꿔라.")
        raise SystemExit(1)
    key, choice, ev = best
    for h, ex in zip(heroes, choice):
        print(f"{h['name']:>6}: sig {h['signature']} exports {ex} import {h['import']}")
    print("producers", ev["c2_producers"], "consumers", ev["c1_consumers"])
    print("dead pairs", ev["dead_pairs"], "min links/pair", min(ev["link_count"].values()))
    print("centers", ev["centers"], "max share", ev["max_share"])
    OUT_JSON.write_text(json.dumps({
        "choice": {h["id"]: {"main": ex[0], "minor": list(ex[1:])} for h, ex in zip(heroes, choice)},
        "producers": ev["c2_producers"], "consumers": ev["c1_consumers"],
        "pairs": {k: [list(x) for x in v] for k, v in ev["pairs"].items()},
        "trios": ev["trios"], "centers": ev["centers"], "max_share": ev["max_share"],
    }, ensure_ascii=False, indent=1))
    write_md(resources, heroes, choice, ev)


if __name__ == "__main__":
    main()
