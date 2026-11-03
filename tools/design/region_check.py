"""지역 콘텐츠 검증 + 표 생성 (Phase 5).

입력: data/design/region1.json (지역 콘텐츠), data/design/heroes.json (원형 id)
출력: docs/design/region1-content.md (자동 생성 표), 표준출력 검사 결과
실행: python3 tools/design/region_check.py   (실패하면 exit 1)

기준 출처:
- 적 수치 곡선: docs/research/enemy-structure-analysis.md §2 (StS 1막 중앙값)
- 원귀당 압박 방식 1~2개, 지역 대표 압박 2개: 같은 문서 §8 E3
- 파티 전용 동사 가르치기: E4
- 해원 조건 = 공용 상태: docs/05-exploration.md §14
"""
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data/design/region1.json"
HEROES = ROOT / "data/design/heroes.json"
OUT = ROOT / "docs/design/region1-content.md"

HP_RANGE = {"normal": (6, 45), "minion": (6, 25), "elite": (50, 100), "boss": (100, 260)}
# 보스 조합은 졸개를 포함한 합계 체력으로 본다(여러 몸 보스). StS 1막 보스 곡선 기준
BOSS_ENCOUNTER_HP = (140, 260)
# 조합의 턴당 최대 피해 상한(모든 원귀가 한 턴에 가장 센 행동을 한다고 가정한 상한선)
TURN_DMG_CAP = {"easy": 13, "hard": 18, "elite": 18, "boss": 26}
PROVISIONS = {"촛불", "쌀", "향", "지전", "부적", "술"}
VERBS = {"칸 조준", "진형 교란", "홀림", "쓰러진 영웅 노리기"}

errors, warns = [], []


def err(msg):
    errors.append(msg)


HERO_TARGETS = {"선두", "중열", "후열", "전체", "최저 체력", "최고 체력", "무작위", "쓰러진 영웅"}


def max_turn_damage(e):
    """영웅에게 들어가는 한 턴 최대 피해. 굿상(설치물)·자신·아군 원귀 대상 행동은 제외한다."""
    best = 0
    for it in e["intents"]:
        if it.get("target") not in HERO_TARGETS:
            continue
        d = (it.get("damage") or 0) * (it.get("hits") or 1)
        best = max(best, d)
    return best


def verbs_of(e):
    found = set()
    for it in e["intents"]:
        if it.get("target") in {"선두", "중열", "후열", "최저 체력", "최고 체력"}:
            found.add("칸 조준")
        if it.get("kind") == "move":
            found.add("진형 교란")
        if it.get("kind") == "possess":
            found.add("홀림")
        if it.get("target") == "쓰러진 영웅":
            found.add("쓰러진 영웅 노리기")
    return found


def main():
    d = json.loads(SRC.read_text())
    heroes = {h["id"] for h in json.loads(HEROES.read_text())["heroes"]}
    targets, statuses = set(d["targets"]), set(d["statuses"])
    enemies = {e["id"]: e for e in d["enemies"]}

    # ── 원귀 ─────────────────────────────────────
    verbs, haewon, press = set(), Counter(), Counter()
    for e in d["enemies"]:
        lo, hi = HP_RANGE[e["category"]]
        if not (lo <= e["hp"][0] <= e["hp"][1] <= hi):
            err(f"{e['name']}: 체력 {e['hp']}이 {e['category']} 범위 {lo}~{hi} 밖")
        ids = {it["id"] for it in e["intents"]}
        for it in e["intents"]:
            if it.get("target") not in targets:
                err(f"{e['name']}/{it['name']}: 대상 '{it.get('target')}'이 허용 목록에 없음")
        pat = e["pattern"]
        refs = []
        if pat["type"] == "cycle":
            refs = pat["order"]
        elif pat["type"] == "weighted":
            refs = list(pat["weights"]) + ([pat["first"]] if pat.get("first") else [])
        elif pat["type"] == "phased":
            for ph in pat["phases"]:
                refs += ph.get("order", []) + list(ph.get("weights", {}))
        for r in refs:
            if r not in ids:
                err(f"{e['name']}: 패턴이 없는 행동 '{r}'을 가리킴")
        if e["category"] != "minion" and not (1 <= len(e["pressures"]) <= 3):
            err(f"{e['name']}: 압박 방식 {len(e['pressures'])}개 (1~2개 권장, 보스는 3개까지)")
        if e["category"] in {"normal", "elite"} and len(e["pressures"]) > 2:
            err(f"{e['name']}: 일반·엘리트는 압박 방식 2개까지")
        if e["category"] != "minion":
            if not e.get("haewon"):
                err(f"{e['name']}: 해원 조건 없음")
            elif e["haewon"]["status"] is not None:
                if e["haewon"]["status"] not in statuses:
                    err(f"{e['name']}: 해원 상태 '{e['haewon']['status']}'이 공용 상태가 아님")
                haewon[e["haewon"]["status"]] += 1
        verbs |= verbs_of(e)
        press.update(e["pressures"])

    missing_verbs = set(d["region"]["teaches"]) - verbs
    if missing_verbs:
        err(f"가르칠 동사 누락: {missing_verbs}")
    if not set(d["region"]["teaches"]) <= VERBS:
        err("region.teaches 에 알 수 없는 동사")
    covered = len(haewon)
    if covered < 6:
        err(f"해원 조건이 공용 상태 {covered}종에만 걸림 (6종 이상 권장)")
    for p in d["region"]["pressures"]:
        if press[p] < 3:
            err(f"지역 대표 압박 {p}가 원귀 {press[p]}종에만 있음 (3종 이상)")

    # ── 조합 ─────────────────────────────────────
    enc_rows = []
    for pool, encs in d["encounters"].items():
        if pool == "rules":
            continue
        for enc in encs:
            for eid in enc["enemies"]:
                if eid not in enemies:
                    err(f"조합 {enc['id']}: 없는 원귀 {eid}")
            es = [enemies[i] for i in enc["enemies"] if i in enemies]
            dmg = sum(max_turn_damage(e) for e in es)
            hp = sum(sum(e["hp"]) / 2 for e in es)
            cap = TURN_DMG_CAP[pool]
            if pool == "boss":
                lo_b, hi_b = BOSS_ENCOUNTER_HP
                if not lo_b <= hp <= hi_b:
                    err(f"보스 조합 {enc['id']}: 합계 체력 {hp:.0f}이 {lo_b}~{hi_b} 밖")
            if dmg > cap:
                err(f"조합 {enc['id']}({pool}): 턴당 최대 피해 {dmg} > 상한 {cap}")
            enc_rows.append((pool, enc["id"], " + ".join(e["name"] for e in es), hp, dmg))
    need = {"easy": 3, "hard": 5, "elite": 3, "boss": 2}
    for pool, n in need.items():
        if len(d["encounters"][pool]) < n:
            err(f"조합 풀 {pool}: {len(d['encounters'][pool])}개 (최소 {n})")

    # ── 기물·이벤트·덫·가호 ────────────────────────
    for c in d["curios"]:
        if c.get("provision") and c["provision"]["item"] not in PROVISIONS:
            err(f"기물 {c['name']}: 알 수 없는 보급품 {c['provision']['item']}")
        if c.get("hero") and c["hero"]["archetype"] not in heroes:
            err(f"기물 {c['name']}: 알 수 없는 원형 {c['hero']['archetype']}")
    hero_curios = Counter(c["hero"]["archetype"] for c in d["curios"] if c.get("hero"))
    for ev in d["events"]:
        for ch in ev["choices"]:
            if ch.get("requires") and ch["requires"] not in heroes:
                err(f"이벤트 {ev['name']}: 알 수 없는 원형 {ch['requires']}")
    tiers = Counter(r["tier"] for r in d["relics"])

    # ── 파티별 해원 가능 원귀 수 (정보) ───────────────
    trio_cov = trio_coverage(d)
    if trio_cov and min(v for v, _ in trio_cov.values()) == 0:
        err("해원할 수 있는 원귀가 0종인 3인 조합이 있음")

    # ── 출력 ─────────────────────────────────────
    write_md(d, enemies, enc_rows, haewon, press, verbs, hero_curios, tiers, trio_cov)
    print(f"원귀 {len(d['enemies'])} · 조합 {len(enc_rows)} · 기물 {len(d['curios'])} · 이벤트 {len(d['events'])} · 덫 {len(d['traps'])} · 가호 {len(d['relics'])} {dict(tiers)}")
    print(f"해원 조건 분포: {dict(haewon)} → 공용 상태 {covered}/8종")
    print(f"압박 방식 분포: {dict(press)}")
    print(f"가르치는 파티 동사: {sorted(verbs)}")
    print(f"영웅 고유 기물 선택지: {dict(hero_curios)} → 원형 {len(hero_curios)}/8")
    vals = sorted(v for v, _ in trio_cov.values())
    print(f"3인 조합별 해원 가능 원귀 종수: 최소 {vals[0]} · 중앙 {vals[len(vals)//2]} · 최대 {vals[-1]} (해원 조건이 있는 원귀 {len([e for e in d['enemies'] if e.get('haewon') and e['haewon']['status']])}종)")
    for w in warns:
        print("주의:", w)
    if errors:
        for e in errors:
            print("❌", e)
        sys.exit(1)
    print("✅ 모든 검사 통과")


STATUS_KEY = {"점지": "M", "상흔": "B", "명부": "D", "넋흔들림": "C", "장단": "K", "진형": "F", "굿상": "S", "부적": "T"}


def trio_coverage(d):
    """3인 조합마다, 해원 조건 상태를 파티가 생산할 수 있는 원귀 종수."""
    from itertools import combinations
    heroes = json.loads(HEROES.read_text())["heroes"]
    syn = ROOT / "data/design/synergy.json"
    if not syn.exists():
        return {}
    choice = json.loads(syn.read_text())["choice"]
    prod = {}
    for h in heroes:
        c = choice.get(h["id"], {})
        prod[h["id"]] = {h["signature"], c.get("main")} | set(c.get("minor", []))
    need = [STATUS_KEY[e["haewon"]["status"]] for e in d["enemies"] if e.get("haewon") and e["haewon"]["status"]]
    name = {h["id"]: h["name"] for h in heroes}
    out = {}
    for t in combinations([h["id"] for h in heroes], 3):
        have = set().union(*(prod[i] for i in t))
        out[" + ".join(name[i] for i in t)] = (sum(1 for k in need if k in have), sorted(have))
    return out


def write_md(d, enemies, enc_rows, haewon, press, verbs, hero_curios, tiers, trio_cov=None):
    L = [f"# {d['region']['name']} — 콘텐츠 표 (자동 생성)", "",
         "`tools/design/region_check.py` 가 `data/design/region1.json` 에서 만든다. 손으로 고치지 않는다.", "",
         "## 원귀", "",
         "| 원귀 | 계열 | 분류 | 체력 | 행동 (대상: 피해) | 패턴 | 압박 | 해원 조건 |",
         "|---|---|---|---|---|---|---|---|"]
    for e in d["enemies"]:
        acts = "<br>".join(
            f"{it['name']} ({it['target']}" + (f": {it['damage']}" + (f"×{it['hits']}" if (it.get('hits') or 1) > 1 else "") if it.get("damage") else "")
            + (f", 방어 {it['block']}" if it.get("block") else "") + ")" + (f" — {it['effect']}" if it.get("effect") else "")
            for it in e["intents"])
        p = e["pattern"]
        pat = {"cycle": lambda: "순환 " + "→".join(p["order"]),
               "weighted": lambda: "확률 " + "/".join(f"{k}{v}" for k, v in p["weights"].items()) + (f", 연속 {p['no_repeat']}회 금지" if p.get("no_repeat") else ""),
               "phased": lambda: "단계형(체력 50%에서 전환)"}[p["type"]]()
        hw = e["haewon"]["rule"] if e.get("haewon") else "—"
        L.append(f"| **{e['name']}** | {e['family']} | {e['category']} | {e['hp'][0]}~{e['hp'][1]} | {acts} | {pat} | {', '.join(e['pressures'])} | {hw} |")
    L += ["", "### 원귀의 한과 해원", "", "| 원귀 | 한(사연) | 해원 장면 |", "|---|---|---|"]
    for e in d["enemies"]:
        if e.get("haewon"):
            L.append(f"| {e['name']} | {e['han']} | {e['haewon']['story']} |")
    L += ["", "## 전투 조합", "", "| 풀 | id | 원귀 | 체력 합(평균) | 턴당 최대 피해(상한) |", "|---|---|---|---:|---:|"]
    for pool, i, names, hp, dmg in enc_rows:
        L.append(f"| {pool} | {i} | {names} | {hp:.0f} | {dmg} |")
    L += ["", f"규칙: {d['encounters']['rules']}", "",
          "## 분포 점검", "",
          f"- 해원 조건(공용 상태): " + ", ".join(f"{k} {v}" for k, v in haewon.most_common()) + f" — {len(haewon)}/8종",
          f"- 압박 방식: " + ", ".join(f"{k} {v}" for k, v in sorted(press.items())),
          f"- 가르치는 파티 동사: " + ", ".join(sorted(verbs)),
          f"- 영웅 고유 기물 선택지: " + ", ".join(f"{k} {v}" for k, v in hero_curios.items()) + f" — 원형 {len(hero_curios)}/8",
          ""]
    if trio_cov:
        items = sorted(trio_cov.items(), key=lambda kv: kv[1][0])
        L += ["### 3인 조합별 해원 가능 원귀 종수", "",
              f"해원 조건이 있는 원귀 {len([e for e in d['enemies'] if e.get('haewon') and e['haewon']['status']])}종 중, 파티가 그 상태를 생산할 수 있는 종수. "
              "적을수록 이 지역에서 해원(재료 2배·귀기 회복)이 어렵다.", "",
              "| 구간 | 조합 수 | 예 |", "|---|---:|---|"]
        buckets = {}
        for k, (v, _) in items:
            buckets.setdefault(v, []).append(k)
        for v in sorted(buckets):
            L.append(f"| {v}종 | {len(buckets[v])} | {', '.join(buckets[v][:3])}{' …' if len(buckets[v]) > 3 else ''} |")
        L.append("")
    L += ["## 기물", "", "| 기물 | 맨손 | 보급품 | 영웅 고유 |", "|---|---|---|---|"]
    for c in d["curios"]:
        pv = f"{c['provision']['item']}: {c['provision']['result']}" if c.get("provision") else "—"
        hr = f"{c['hero']['archetype']}: {c['hero']['result']}" if c.get("hero") else "—"
        L.append(f"| **{c['name']}** | {c['bare']} | {pv} | {hr} |")
    L += ["", "## 방 이벤트", ""]
    for ev in d["events"]:
        L.append(f"**{ev['name']}**" + (f" (고정: {ev['fixed']})" if ev.get("fixed") else "") + f" — {ev['setup']}")
        for ch in ev["choices"]:
            extra = (f" [{ch['cost']}]" if ch.get("cost") else "") + (f" [필요: {ch['requires']}]" if ch.get("requires") else "")
            L.append(f"- {ch['label']}{extra} → {ch['result']}")
        L.append("")
    L += ["## 덫", "", "| 덫 | 효과 | 해체 |", "|---|---|---|"]
    for t in d["traps"]:
        L.append(f"| {t['name']} | {t['effect']} | {t['disarm']} |")
    L += ["", f"## 가호(유물) — {dict(tiers)}", "", "| 가호 | 등급 | 효과 |", "|---|---|---|"]
    for r in d["relics"]:
        L.append(f"| {r['name']} | {r['tier']} | {r['effect']} |")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
