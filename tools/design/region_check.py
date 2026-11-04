"""지역 콘텐츠 검증 + 표 생성 (Phase 5, Phase 9에서 여러 지역으로 일반화).

입력: data/design/region*.json (지역 콘텐츠), data/design/heroes.json (원형 id), data/design/synergy.json (조합별 상태 생산)
출력: docs/design/region{N}-content.md (지역마다 자동 생성 표), 표준출력 검사 결과
실행: python3 tools/design/region_check.py          # 모든 지역
      python3 tools/design/region_check.py 2 3      # 일부 지역 (번호 또는 json 경로)
      하나라도 실패하면 exit 1

기준 출처:
- 적 수치 곡선: docs/research/enemy-structure-analysis.md §2 (StS 1·2·3막 중앙값의 모양)
  1막 수치는 v0.2.1 조정값(07-prototype §11~§12) 그대로. 2·3막은 그 모양을 따르되 덱 22~28장·넋 수습 규칙을 감안해 눌렀다
  (docs/05-region2.md §8, docs/05-region3.md §8)
- 원귀당 압박 방식 1~2개, 지역 대표 압박 2개: 같은 문서 §8 E3
- 파티 전용 동사 가르치기: E4 (+ 지역 2의 번지는 홀림·옮김)
- 해원 조건 = 공용 상태: docs/05-exploration.md §14
- 엔진 호환: src/core/data.ts parseHaewon, src/core/enemy.ts 의 행동 종류·문장 해석을 그대로 옮겨 검사한다.
  엔진이 못 읽는 것은 지역 데이터의 engine_needs(지역당 새 메커니즘 3개까지)가 덮어야 한다
"""
import json
import re
import sys
from collections import Counter
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DESIGN = ROOT / "data/design"
HEROES = DESIGN / "heroes.json"
SYNERGY = DESIGN / "synergy.json"
OUT_DIR = ROOT / "docs/design"

# ── 막별 기준 ────────────────────────────────────────────────────────────
# hp: 원귀 개체 체력 범위(분류별, final = 최종 보스 개체)
# enc_hp: 조합 합계 체력(평균) 범위(풀별). 보스는 졸개를 포함한 여러 몸 보스라 합계로 본다
# dmg: 조합의 턴당 최대 피해 상한(모든 원귀가 한 턴에 가장 센 행동을 한다고 가정한 상한선, '전체'는 한 영웅 기준)
ACTS = {
    1: {"label": "1막 (StS 1막 기준, v0.2.1 조정값)",
        "hp": {"normal": (6, 45), "minion": (6, 25), "elite": (50, 100), "boss": (100, 260)},
        "enc_hp": {"easy": (15, 40), "hard": (35, 65), "elite": (55, 100), "boss": (140, 260)},
        "dmg": {"easy": 13, "hard": 18, "elite": 18, "boss": 26}},
    2: {"label": "2막 (StS 2막 모양을 눌러 씀. 반복 2: 원정마다 덱이 리셋되는 캠페인 파티 기준으로 다시 맞춤 — 체력·피해를 0.9배 안팎으로 낮추고 하한을 내림)",
        "hp": {"normal": (8, 70), "minion": (8, 40), "elite": (70, 160), "boss": (150, 300)},
        "enc_hp": {"easy": (30, 70), "hard": (60, 120), "elite": (90, 160), "boss": (200, 300)},
        "dmg": {"easy": 20, "hard": 26, "elite": 24, "boss": 30}},
    3: {"label": "3막 (StS 3막 모양을 눌러 씀, 최종 보스 별도. 반복 2: 캠페인 파티 기준으로 다시 맞춤 — 일반·엘리트 0.9배 안팎, 최종 0.84배, 하한을 내림)",
        "hp": {"normal": (10, 85), "minion": (10, 70), "elite": (100, 190), "boss": (150, 300), "final": (270, 420)},
        "enc_hp": {"easy": (40, 90), "hard": (80, 150), "elite": (120, 200), "boss": (200, 340), "final": (310, 460)},
        "dmg": {"easy": 22, "hard": 30, "elite": 30, "boss": 32, "final": 36}},
}
NEED_POOLS = {"easy": 3, "hard": 5, "elite": 3, "boss": 2}
PROVISIONS = {"촛불", "쌀", "향", "지전", "부적", "술"}
RELIC_TIERS = {"일반", "고급", "희귀", "보스"}
TIER_VALUE = {"일반": 30, "고급": 60, "희귀": 100, "보스": 120}
# 파티 전용 동사. 지역 2에서 둘을 더했다: 번지는 홀림(홀림이 진형 전체에), 옮김(주인 있는 신열이 옆 칸으로)
VERBS = {"칸 조준", "진형 교란", "홀림", "쓰러진 영웅 노리기", "번지는 홀림", "옮김"}
HERO_TARGETS = {"선두", "중열", "후열", "전체", "최저 체력", "최고 체력", "무작위", "쓰러진 영웅"}
STATUS_KEY = {"점지": "M", "상흔": "B", "명부": "D", "넋흔들림": "C", "장단": "K", "진형": "F", "굿상": "S", "부적": "T"}

# ── 엔진 호환 (src/core/enemy.ts · data.ts 를 옮긴 것) ─────────────────────
ENGINE_KINDS = {"attack", "attack_debuff", "move", "buff", "defend", "escape", "pollute", "stress", "possess", "summon"}
ENGINE_TARGETS = HERO_TARGETS | {"굿상", "자신", "아군 원귀"}
ENGINE_PATTERNS = {"cycle", "weighted", "phased"}
ENGINE_MAX_PHASES = 2  # chooseIntent 는 0 → 1단계 전환만 한다
# 반복 2에서 엔진이 구현한 새 메커니즘 (engine_needs 태그). 이 태그의 빈틈은 더 이상 빈틈이 아니다
IMPLEMENTED = {"신열", "공물", "대접", "빗장", "업경대", "고풀이"}
# 해원 상태 → 엔진 해원 종류 (parseHaewon 결과와 맞아야 한다)
STATUS_TO_KIND = {"점지": "status", "상흔": "status", "명부": "status", "넋흔들림": "status",
                  "장단": "jangdan", "굿상": "summons", "부적": "token", "진형": "formation"}

# ── 재현 윤리 린트 (영웅 §8, 무속 지식 정리 §8, 매체 조사) ──────────────────
# 실존·고유 신령 이름은 원귀(적) 쪽 문장에 쓰지 않는다. 시왕은 이벤트 틀로만 나온다.
DEITY_WORDS = ["시왕", "염라", "진광왕", "전륜왕", "강림", "바리공주", "무장승", "최영", "사도세자", "별상", "호구별성",
               "옥황", "제석", "칠성", "산신", "용왕", "조왕", "삼신", "대감", "부군", "지신", "신장", "천신", "창부", "말명"]
# 씌임은 "귀신이 붙었다"는 신앙 안의 언어로만, 고어 연출 금지, 타 작품 고유 설정(저승 국선변호사 재판) 금지
BANNED_WORDS = ["광기", "발작", "미쳐", "미친", "정신병", "조현", "히스테리",
                "피투성이", "선혈", "내장", "해골", "시체", "썩은", "고름", "백골",
                "변호사", "국선", "변론"]


def parse_haewon(rule, knots_needed=None):
    """src/core/data.ts parseHaewon 과 같은 순서로 읽는다."""
    if not rule:
        return {"kind": "none"}
    if knots_needed and "매듭" in rule:
        return {"kind": "knots", "n": knots_needed}
    m = re.search(r"(점지|상흔|명부|넋흔들림)\s*(\d+)\s*이상", rule)
    if m:
        return {"kind": "status", "status": m.group(1), "n": int(m.group(2)), "orCollapse": "붕괴" in rule}
    m = re.search(r"장단\s*(\d+)\s*이상", rule)
    if m:
        return {"kind": "jangdan", "n": int(m.group(1))}
    if "굿상에 설치물" in rule:
        return {"kind": "summons"}
    if "부적" in rule:
        return {"kind": "token", "group": ("모두" in rule or "무리" in rule)}
    if "진형이 바뀐" in rule:
        return {"kind": "formation"}
    if "붕괴" in rule:
        return {"kind": "collapse"}
    if "노잣돈" in rule or "바친 뒤" in rule:
        return {"kind": "offering"}
    m = re.search(r"(\d+)명 이상 살아", rule)
    if m:
        return {"kind": "minions", "n": int(m.group(1))}
    return {"kind": "none"}


def haewon_label(p):
    k = p["kind"]
    if k == "status":
        return f"{p['status']} {p['n']}+" + (" 또는 붕괴" if p.get("orCollapse") else "")
    return {"jangdan": f"장단 {p.get('n')}+", "summons": "굿상 설치물", "token": "부적 막타" + (" (무리)" if p.get("group") else ""),
            "formation": "진형 변화", "collapse": "붕괴", "offering": "공물", "minions": f"졸개 {p.get('n')}+ 생존",
            "knots": f"고풀이 매듭 {p.get('n')}", "none": "—"}[k]


def engine_gaps(e, names):
    """엔진이 지금 읽지 못하는 것: [(태그, 설명)]. 태그는 engine_needs[].tags 와 맞춘다."""
    gaps, errs = [], []
    for it in e["intents"]:
        kind, eff = it.get("kind"), it.get("effect") or ""
        if kind not in ENGINE_KINDS:
            gaps.append((f"행동:{kind}", f"{it['name']}: 엔진에 없는 행동 종류"))
        if kind == "pollute" and "신열" in eff:
            gaps.append(("신열", f"{it['name']}: 신열 카드(구현 전에는 잡음)"))
        if kind == "pollute" and not re.search(r"\d+장", eff):
            errs.append(f"{it['name']}: 오염 장수('N장')를 엔진이 읽지 못함")
        if kind == "possess" and not re.search(r"홀림\s*\d+", eff):
            errs.append(f"{it['name']}: 홀림 수('홀림 N')를 엔진이 읽지 못함")
        if kind == "stress" and not re.search(r"\+\d+", eff):
            errs.append(f"{it['name']}: 귀기 수('+N')를 엔진이 읽지 못함")
        if kind == "summon" and "되살린다" not in eff:
            m = re.match(r"^(.+?)\s*\d+\s*소환", eff)
            if not m or m.group(1).strip() not in names:
                errs.append(f"{it['name']}: 소환 대상 이름을 엔진이 찾지 못함 ('<원귀 이름> N 소환(최대 N)')")
        if kind in {"attack", "attack_debuff"} and it.get("target") != "굿상":
            # enemy.ts 는 공격 문장 속 '끌어'(끌어당김)·'섞'(진형 섞기)·'그늘'(그늘 카드)을 부수 효과로 실행한다
            for w in ("끌어", "섞", "그늘"):
                if w in eff:
                    errs.append(f"{it['name']}: 공격 문장의 '{w}'를 엔진이 부수 효과로 실행함 — 의도라면 move 로, 아니면 단어를 바꾼다")
        if kind in {"buff", "defend"} and it.get("target") == "아군 원귀" and not re.search(r"방어도\s*\d+", eff):
            errs.append(f"{it['name']}: 아군 원귀 방어도('방어도 N')를 엔진이 읽지 못함")
    pat = e["pattern"]
    if pat["type"] not in ENGINE_PATTERNS:
        gaps.append((f"패턴:{pat['type']}", "엔진에 없는 패턴"))
    if pat["type"] == "phased" and len(pat["phases"]) > ENGINE_MAX_PHASES:
        gaps.append(("3단계", f"단계 {len(pat['phases'])}개 (엔진은 2단계까지)"))
    for p in e.get("passives", []):
        if "빗장" in p:
            gaps.append(("빗장", p.split(":")[0]))
        if p.startswith("공물:"):
            gaps.append(("공물", "공물 행동 카드(노잣돈 이외)"))
    hw = e.get("haewon")
    if hw and not hw.get("follows"):
        parsed = parse_haewon(hw.get("rule"), hw.get("knots_needed"))
        st = hw.get("status")
        if st is not None and parsed["kind"] != STATUS_TO_KIND.get(st):
            errs.append(f"해원 상태 '{st}'인데 엔진은 '{haewon_label(parsed)}'로 읽음: {hw.get('rule')}")
        if parsed["kind"] == "status" and st is not None and parsed["status"] != st:
            errs.append(f"해원 상태 '{st}'인데 엔진은 '{parsed['status']}'로 읽음")
        if st is None and parsed["kind"] in set(STATUS_TO_KIND.values()):
            # 상태 없는 해원(공물·졸개·매듭 등)인데 문장 속 단어 때문에 엔진이 상태 조건으로 잘못 읽는 경우
            errs.append(f"상태 없는 해원인데 엔진이 '{haewon_label(parsed)}'로 읽음 — 문장에서 상태 단어를 빼거나 별도 필드로: {hw.get('rule')}")
        if parsed["kind"] == "none":
            rule = hw.get("rule") or ""
            if "바친 뒤" in rule:
                gaps.append(("공물", f"해원 '{rule}'"))
            elif "매듭" in rule:
                gaps.append(("고풀이", f"해원 '{rule}'"))
            else:
                errs.append(f"해원 조건을 엔진이 읽지 못함: {rule}")
    gaps = [g for g in gaps if g[0] not in IMPLEMENTED]
    return gaps, errs


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
            if it.get("target") == "전체":
                found.add("번지는 홀림")
        if it.get("target") == "쓰러진 영웅":
            found.add("쓰러진 영웅 노리기")
        if it.get("kind") == "pollute" and "신열" in (it.get("effect") or ""):
            found.add("옮김")
    return found


def hp_band_key(e):
    return "final" if e.get("final") else e["category"]


def region_act(d, path):
    if d["region"].get("act"):
        return int(d["region"]["act"])
    m = re.search(r"region(\d+)", path.name)
    return int(m.group(1)) if m else 1


def texts_of(obj):
    """한 덩어리의 모든 문자열(재현 윤리 린트용)."""
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from texts_of(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from texts_of(v)


def check_region(path, heroes_ids, seen):
    d = json.loads(path.read_text())
    act = region_act(d, path)
    A = ACTS[act]
    errors, warns = [], []
    err = errors.append
    targets, statuses = set(d["targets"]), set(d["statuses"])
    enemies = {e["id"]: e for e in d["enemies"]}
    names = {e["name"] for e in d["enemies"]}
    specials = {s["id"]: s for s in d.get("specials", [])}
    families = set(d["region"].get("families", []))

    # ── 원귀 ─────────────────────────────────────
    verbs, haewon, press = set(), Counter(), Counter()
    gaps_by_enemy = {}
    for e in d["enemies"]:
        key = hp_band_key(e)
        if key not in A["hp"]:
            err(f"{e['name']}: {act}막에 '{key}' 체력 기준이 없음")
        else:
            lo, hi = A["hp"][key]
            if not (lo <= e["hp"][0] <= e["hp"][1] <= hi):
                err(f"{e['name']}: 체력 {e['hp']}이 {key} 범위 {lo}~{hi} 밖")
        if families and e["family"] not in families:
            err(f"{e['name']}: 계열 '{e['family']}'이 지역 계열 목록에 없음")
        if not e.get("han"):
            err(f"{e['name']}: 한(사연) 없음")
        ids = {it["id"] for it in e["intents"]}
        for it in e["intents"]:
            if it.get("target") not in targets:
                err(f"{e['name']}/{it['name']}: 대상 '{it.get('target')}'이 허용 목록에 없음")
            elif it.get("target") not in ENGINE_TARGETS:
                err(f"{e['name']}/{it['name']}: 대상 '{it.get('target')}'을 엔진이 모름")
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
        hw = e.get("haewon")
        if e["category"] != "minion":
            if not hw:
                err(f"{e['name']}: 해원 조건 없음")
            elif hw.get("status") is not None:
                if hw["status"] not in statuses:
                    err(f"{e['name']}: 해원 상태 '{hw['status']}'이 공용 상태가 아님")
                haewon[hw["status"]] += 1
        elif act >= 2 and not hw:
            # 2막부터: 졸개도 한과 해원(우두머리를 따라 해원)을 가진다
            err(f"{e['name']}: 졸개에 해원 규칙 없음 (2막부터는 follows 로 우두머리를 따른다)")
        if hw and hw.get("follows") and hw["follows"] not in enemies and hw["follows"] not in specials:
            err(f"{e['name']}: 해원 follows '{hw['follows']}'가 없는 원귀·특수 전투")
        if hw and hw.get("knots"):
            if len(hw["knots"]) < hw.get("knots_needed", 0):
                err(f"{e['name']}: 매듭 {len(hw['knots'])}개 < 필요 {hw.get('knots_needed')}")
        if e.get("final") and e["category"] != "boss":
            err(f"{e['name']}: 최종 보스는 boss 분류여야 함")
        g, ge = engine_gaps(e, names)
        for m in ge:
            err(f"{e['name']}: {m}")
        if g:
            gaps_by_enemy[e["id"]] = g
        verbs |= verbs_of(e)
        press.update(e["pressures"])
        # 재현 윤리: 신령 이름을 적 쪽 문장에 쓰지 않는다 (손님은 '허주가 흉내 내는' 경우만)
        enemy_text = " ".join([e["name"], e["family"]] + list(texts_of(e["intents"])) + list(texts_of(e.get("passives", []))))
        for w in DEITY_WORDS:
            if w in enemy_text:
                err(f"{e['name']}: 원귀 쪽 문장에 신령 이름 '{w}' (적으로 쓰지 않는다, E10)")
        if "손님" in e["name"] and "허주" not in e["name"] and e["category"] != "minion":
            err(f"{e['name']}: 손님(신령)은 원귀가 될 수 없다 — 특수 전투(specials)로만")

    missing_verbs = set(d["region"]["teaches"]) - verbs
    if missing_verbs:
        err(f"가르칠 동사 누락: {missing_verbs}")
    if not set(d["region"]["teaches"]) <= VERBS:
        err(f"region.teaches 에 알 수 없는 동사: {set(d['region']['teaches']) - VERBS}")
    covered = len(haewon)
    if covered < 6:
        err(f"해원 조건이 공용 상태 {covered}종에만 걸림 (6종 이상 권장)")
    for p in d["region"]["pressures"]:
        if press[p] < 3:
            err(f"지역 대표 압박 {p}가 원귀 {press[p]}종에만 있음 (3종 이상)")
    if not set(d["region"].get("key_provisions", [])) <= PROVISIONS:
        err(f"핵심 보급품에 알 수 없는 것: {set(d['region']['key_provisions']) - PROVISIONS}")

    # ── 조합 ─────────────────────────────────────
    enc_rows = []
    pools = [p for p in d["encounters"] if p != "rules"]
    for pool in pools:
        if pool not in A["dmg"]:
            err(f"조합 풀 '{pool}': {act}막 기준 없음")
            continue
        for enc in d["encounters"][pool]:
            for eid in enc["enemies"]:
                if eid not in enemies:
                    err(f"조합 {enc['id']}: 없는 원귀 {eid}")
            es = [enemies[i] for i in enc["enemies"] if i in enemies]
            dmg = sum(max_turn_damage(e) for e in es)
            hp = sum(sum(e["hp"]) / 2 for e in es)
            lo_b, hi_b = A["enc_hp"][pool]
            if not lo_b <= hp <= hi_b:
                err(f"조합 {enc['id']}({pool}): 합계 체력 {hp:.0f}이 {lo_b}~{hi_b} 밖")
            if dmg > A["dmg"][pool]:
                err(f"조합 {enc['id']}({pool}): 턴당 최대 피해 {dmg} > 상한 {A['dmg'][pool]}")
            if pool == "final" and not any(e.get("final") for e in es):
                err(f"조합 {enc['id']}: final 풀에 최종 보스가 없음")
            if pool != "final" and any(e.get("final") for e in es):
                err(f"조합 {enc['id']}: 최종 보스는 final 풀에만")
            enc_rows.append((pool, enc["id"], " + ".join(e["name"] for e in es), hp, dmg))
            if enc["id"] in seen["encounter"]:
                err(f"조합 id '{enc['id']}'가 {seen['encounter'][enc['id']]}와 겹침")
            seen["encounter"][enc["id"]] = path.name
    for pool, n in NEED_POOLS.items():
        if len(d["encounters"].get(pool, [])) < n:
            err(f"조합 풀 {pool}: {len(d['encounters'].get(pool, []))}개 (최소 {n})")
    if any(e.get("final") for e in d["enemies"]) and not d["encounters"].get("final"):
        err("최종 보스가 있는데 final 조합이 없음")

    # ── 특수 전투 (신령을 대접해 보내기 등) ────────────
    special_refs = Counter()
    for ev in d["events"]:
        for ch in ev["choices"]:
            if ch.get("special"):
                if ch["special"] not in specials:
                    err(f"이벤트 {ev['name']}: 없는 특수 전투 {ch['special']}")
                special_refs[ch["special"]] += 1
    special_values = {}
    for s in specials.values():
        if s.get("deity") and not s.get("never_attackable"):
            err(f"특수 전투 {s['name']}: 신령은 공격 대상이 될 수 없어야 한다(never_attackable)")
        for f in s.get("followers", []):
            if f not in enemies:
                err(f"특수 전투 {s['name']}: 없는 수행 원귀 {f}")
            elif enemies[f]["category"] != "minion":
                err(f"특수 전투 {s['name']}: 수행 원귀 {f}는 minion 이어야 한다")
        m = s.get("meter") or {}
        if s.get("kind") == "entertain" and not (m.get("goal", 0) > 0 and m.get("turn_limit", 0) > 0 and m.get("gains")):
            err(f"특수 전투 {s['name']}: 대접 게이지(goal·turn_limit·gains) 없음")
        outs = s.get("outcomes", {})

        def value(o):
            v = o.get("gold", 0) + 60 * o.get("chiseong", 0)
            rel = next((r for r in d["relics"] if r["id"] == o.get("relic")), None)
            if o.get("relic") and not rel:
                err(f"특수 전투 {s['name']}: 보상 가호 '{o['relic']}' 없음")
            if rel:
                v += TIER_VALUE[rel["tier"]]
            if o.get("penalty"):
                v -= 40
            return v
        vals = {k: value(o) for k, o in outs.items()}
        special_values[s["id"]] = vals
        if "sendoff" not in vals:
            err(f"특수 전투 {s['name']}: 좋게 보내는 결과(sendoff) 없음")
        elif any(vals["sendoff"] <= v for k, v in vals.items() if k != "sendoff"):
            err(f"특수 전투 {s['name']}: 대접해 보내기 보상이 다른 결과보다 크지 않음 {vals}")
        if special_refs[s["id"]] == 0:
            err(f"특수 전투 {s['name']}: 어느 이벤트에서도 들어갈 수 없음")
        for pool in pools:
            for enc in d["encounters"][pool]:
                if s["id"] in enc["enemies"]:
                    err(f"특수 전투 {s['name']}가 조합 풀 {pool}에 들어 있음")

    # ── 기물·이벤트·덫·가호 ────────────────────────
    for c in d["curios"]:
        if c.get("provision") and c["provision"]["item"] not in PROVISIONS:
            err(f"기물 {c['name']}: 알 수 없는 보급품 {c['provision']['item']}")
        if c.get("hero") and c["hero"]["archetype"] not in heroes_ids:
            err(f"기물 {c['name']}: 알 수 없는 원형 {c['hero']['archetype']}")
    hero_curios = Counter(c["hero"]["archetype"] for c in d["curios"] if c.get("hero"))
    if act >= 2 and len(hero_curios) < len(heroes_ids):
        err(f"영웅 고유 기물 선택지가 원형 {len(hero_curios)}/{len(heroes_ids)}종에만")
    for ev in d["events"]:
        for ch in ev["choices"]:
            if ch.get("requires") and ch["requires"] not in heroes_ids:
                err(f"이벤트 {ev['name']}: 알 수 없는 원형 {ch['requires']}")
    for r in d["relics"]:
        if r["tier"] not in RELIC_TIERS:
            err(f"가호 {r['name']}: 알 수 없는 등급 {r['tier']}")
        if r.get("source") and r["source"] not in specials and r["source"] not in {ev["id"] for ev in d["events"]}:
            err(f"가호 {r['name']}: 출처 '{r['source']}'가 없는 이벤트·특수 전투")
    tiers = Counter(r["tier"] for r in d["relics"])
    for kind, items in (("enemy", d["enemies"]), ("curio", d["curios"]), ("event", d["events"]),
                        ("trap", d["traps"]), ("relic", d["relics"])):
        for x in items:
            if x["id"] in seen[kind]:
                err(f"{kind} id '{x['id']}'가 {seen[kind][x['id']]}와 겹침")
            seen[kind][x["id"]] = path.name
    for r in d["relics"]:
        if r["name"] in seen["relic_name"]:
            err(f"가호 이름 '{r['name']}'이 {seen['relic_name'][r['name']]}와 겹침")
        seen["relic_name"][r["name"]] = path.name

    # ── 엔진 지원 필요 (지역당 새 메커니즘 3개까지) ───────
    needs = d.get("engine_needs", [])
    own = [n for n in needs if not n.get("shared_from")]
    if len(own) > 3:
        err(f"새 엔진 메커니즘 {len(own)}개 (지역당 3개까지)")
    all_ids = set(enemies) | set(specials) | {x["id"] for x in d["events"] + d["curios"] + d["traps"] + d["relics"]}
    for n in needs:
        for u in n.get("used_by", []):
            if u not in all_ids:
                err(f"엔진 지원 '{n['name']}': 없는 id {u}")
    uncovered = []
    for eid, gs in gaps_by_enemy.items():
        for tag, why in gs:
            if not any(tag in n.get("tags", []) and eid in n.get("used_by", []) for n in needs):
                uncovered.append(f"{enemies[eid]['name']} [{tag}] {why}")
    for s in specials.values():
        tag = {"entertain": "대접"}.get(s.get("kind"), f"특수:{s.get('kind')}")
        if not any(tag in n.get("tags", []) and s["id"] in n.get("used_by", []) for n in needs):
            uncovered.append(f"특수 전투 {s['name']} [{tag}]")
    for u in uncovered:
        err(f"엔진이 지원하지 않는데 engine_needs 가 덮지 않음: {u}")

    # ── 재현 윤리 린트 (지역 전체 문장) ─────────────────
    for t in texts_of(d):
        for w in BANNED_WORDS:
            if w in t:
                err(f"재현 윤리: 금지 표현 '{w}' — {t[:40]}…")

    trio_cov = trio_coverage(d)
    if trio_cov and min(v for v, _ in trio_cov.values()) == 0:
        err("해원할 수 있는 원귀가 0종인 3인 조합이 있음")

    return {"d": d, "path": path, "act": act, "errors": errors, "warns": warns, "enemies": enemies,
            "enc_rows": enc_rows, "haewon": haewon, "press": press, "verbs": verbs, "hero_curios": hero_curios,
            "tiers": tiers, "trio_cov": trio_cov, "gaps": gaps_by_enemy, "needs": needs, "special_values": special_values}


def trio_coverage(d):
    """3인 조합마다, 해원 조건 상태를 파티가 생산할 수 있는 원귀 종수."""
    heroes = json.loads(HEROES.read_text())["heroes"]
    if not SYNERGY.exists():
        return {}
    choice = json.loads(SYNERGY.read_text())["choice"]
    prod = {}
    for h in heroes:
        c = choice.get(h["id"], {})
        prod[h["id"]] = {h["signature"], c.get("main")} | set(c.get("minor", []))
    need = [STATUS_KEY[e["haewon"]["status"]] for e in d["enemies"] if e.get("haewon") and e["haewon"].get("status")]
    name = {h["id"]: h["name"] for h in heroes}
    out = {}
    for t in combinations([h["id"] for h in heroes], 3):
        have = set().union(*(prod[i] for i in t))
        out[" + ".join(name[i] for i in t)] = (sum(1 for k in need if k in have), sorted(have))
    return out


def pattern_label(p):
    if p["type"] == "cycle":
        return "순환 " + "→".join(p["order"])
    if p["type"] == "weighted":
        return "확률 " + "/".join(f"{k}{v}" for k, v in p["weights"].items()) + (f", 연속 {p['no_repeat']}회 금지" if p.get("no_repeat") else "")
    return f"단계형(체력 {p['phases'][0].get('until_hp_pct', 50)}%에서 전환)"


def write_md(R):
    d, enemies = R["d"], R["enemies"]
    haewon, press, verbs, hero_curios, tiers, trio_cov = R["haewon"], R["press"], R["verbs"], R["hero_curios"], R["tiers"], R["trio_cov"]
    L = [f"# {d['region']['name']} — 콘텐츠 표 (자동 생성)", "",
         f"`tools/design/region_check.py` 가 `data/design/{R['path'].name}` 에서 만든다. 손으로 고치지 않는다.", "",
         "## 원귀", "",
         "| 원귀 | 계열 | 분류 | 체력 | 행동 (대상: 피해) | 패턴 | 압박 | 해원 조건 |",
         "|---|---|---|---|---|---|---|---|"]
    for e in d["enemies"]:
        acts = "<br>".join(
            f"{it['name']} ({it['target']}" + (f": {it['damage']}" + (f"×{it['hits']}" if (it.get('hits') or 1) > 1 else "") if it.get("damage") else "")
            + (f", 방어 {it['block']}" if it.get("block") else "") + ")" + (f" — {it['effect']}" if it.get("effect") else "")
            for it in e["intents"])
        hw = e["haewon"]["rule"] if e.get("haewon") else "—"
        if e.get("haewon") and e["haewon"].get("knots"):
            hw += "<br>매듭: " + " · ".join(e["haewon"]["knots"])
        cat = e["category"] + (" (최종)" if e.get("final") else "")
        L.append(f"| **{e['name']}** | {e['family']} | {cat} | {e['hp'][0]}~{e['hp'][1]} | {acts} | {pattern_label(e['pattern'])} | {', '.join(e['pressures'])} | {hw} |")
    L += ["", "### 원귀의 한과 해원", "", "| 원귀 | 한(사연) | 해원 장면 |", "|---|---|---|"]
    for e in d["enemies"]:
        if e.get("haewon"):
            L.append(f"| {e['name']} | {e['han']} | {e['haewon']['story']} |")
    L += ["", "## 전투 조합", "", "| 풀 | id | 원귀 | 체력 합(평균) | 턴당 최대 피해(상한) |", "|---|---|---|---:|---:|"]
    for pool, i, nm, hp, dmg in R["enc_rows"]:
        L.append(f"| {pool} | {i} | {nm} | {hp:.0f} | {dmg} |")
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
              f"해원 조건이 있는 원귀 {len([e for e in d['enemies'] if e.get('haewon') and e['haewon'].get('status')])}종 중, 파티가 그 상태를 생산할 수 있는 종수. "
              "적을수록 이 지역에서 해원(재료 2배·귀기 회복)이 어렵다.", "",
              "| 구간 | 조합 수 | 예 |", "|---|---:|---|"]
        buckets = {}
        for k, (v, _) in items:
            buckets.setdefault(v, []).append(k)
        for v in sorted(buckets):
            L.append(f"| {v}종 | {len(buckets[v])} | {', '.join(buckets[v][:3])}{' …' if len(buckets[v]) > 3 else ''} |")
        L.append("")
    if d.get("specials"):
        L += ["## 특수 전투", ""]
        for s in d["specials"]:
            m = s.get("meter", {})
            L.append(f"**{s['name']}** ({s['kind']}{', 신령: ' + s['deity'] if s.get('deity') else ''}{', 공격 대상 아님' if s.get('never_attackable') else ''}) — {s['setup']}")
            L.append(f"- 수행: {', '.join(enemies[f]['name'] for f in s.get('followers', []) if f in enemies)}")
            if m:
                L.append(f"- {m['name']} {m['goal']} / {m['turn_limit']}턴. 오르는 법: " + " · ".join(m["gains"]))
            if s.get("deity_turn"):
                L.append(f"- 손님의 차례: {s['deity_turn']}")
            for k, o in s.get("outcomes", {}).items():
                rel = next((r for r in d["relics"] if r["id"] == o.get("relic")), None)
                bits = [f"엽전 {o.get('gold', 0)}"] + ([f"치성 {o['chiseong']}"] if o.get("chiseong") else []) + ([f"{rel['tier']} 가호 「{rel['name']}」"] if rel else [])
                L.append(f"- {k} ({o.get('when', '')}): {', '.join(bits)}" + (f" — {o['effect']}" if o.get("effect") else "") + (f" — 대가: {o['penalty']}" if o.get("penalty") else "")
                         + f" · 가치 {R['special_values'][s['id']][k]}")
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
            extra = (f" [{ch['cost']}]" if ch.get("cost") else "") + (f" [필요: {ch['requires']}]" if ch.get("requires") else "") + (f" [특수: {ch['special']}]" if ch.get("special") else "")
            L.append(f"- {ch['label']}{extra} → {ch['result']}")
        L.append("")
    L += ["## 덫", "", "| 덫 | 효과 | 해체 |", "|---|---|---|"]
    for t in d["traps"]:
        L.append(f"| {t['name']} | {t['effect']} | {t['disarm']} |")
    L += ["", f"## 가호(유물) — {dict(tiers)}", "", "| 가호 | 등급 | 효과 |", "|---|---|---|"]
    for r in d["relics"]:
        L.append(f"| {r['name']} | {r['tier']} | {r['effect']} |")
    # ── 이하 Phase 9 일반화에서 더한 절 ──
    A = ACTS[R["act"]]
    L += ["", f"## 막 기준 — {A['label']}", "",
          "| 항목 | 일반 | 졸개 | 엘리트 | 보스 | 최종 |", "|---|---|---|---|---|---|",
          "| 개체 체력 | " + " | ".join(f"{A['hp'][k][0]}~{A['hp'][k][1]}" if k in A["hp"] else "—" for k in ("normal", "minion", "elite", "boss", "final")) + " |",
          "",
          "| 풀 | 조합 체력 합 | 턴당 최대 피해 상한 |", "|---|---|---:|"]
    for pool in A["dmg"]:
        L.append(f"| {pool} | {A['enc_hp'][pool][0]}~{A['enc_hp'][pool][1]} | {A['dmg'][pool]} |")
    L += ["", "## 엔진 호환", "",
          "해원 규칙을 엔진(`src/core/data.ts` parseHaewon)과 같은 방식으로 읽은 결과와, 지금 엔진이 읽지 못해 `engine_needs` 가 덮는 것.", "",
          "| 원귀 | 엔진이 읽은 해원 | 엔진 지원 필요 |", "|---|---|---|"]
    for e in d["enemies"]:
        hw = e.get("haewon")
        if not hw:
            parsed = "—"
        elif hw.get("follows"):
            parsed = f"우두머리를 따름({hw['follows']})"
        else:
            parsed = haewon_label(parse_haewon(hw.get("rule"), hw.get("knots_needed")))
        gaps = ", ".join(sorted({t for t, _ in R["gaps"].get(e["id"], [])})) or "—"
        L.append(f"| {e['name']} | {parsed} | {gaps} |")
    if R["needs"]:
        L += ["", "| 메커니즘 | 쓰는 곳 | 엔진 | 구현 전 대체 동작 | 명세 |", "|---|---|---|---|---|"]
        for n in R["needs"]:
            done = "✅ 반복 2 구현" if set(n.get("tags", [])) & IMPLEMENTED else "미구현"
            L.append(f"| {n['name']}{' (공유)' if n.get('shared_from') else ''} | {', '.join(n['used_by'])} | {done} | {n.get('fallback', '')} | {n.get('spec', '')} |")
    else:
        L += ["", "새 메커니즘 없음 — 모든 행동·해원 조건을 지금 엔진이 읽는다."]
    out = OUT_DIR / (R["path"].stem + "-content.md")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(L) + "\n")
    return out


def resolve_paths(args):
    if not args:
        return sorted(DESIGN.glob("region*.json"), key=lambda p: int(re.search(r"(\d+)", p.stem).group(1)))
    out = []
    for a in args:
        p = DESIGN / f"region{a}.json" if a.isdigit() else Path(a)
        out.append(p if p.is_absolute() else (ROOT / p if not p.exists() else p))
    return out


def main():
    paths = resolve_paths(sys.argv[1:])
    heroes_ids = {h["id"] for h in json.loads(HEROES.read_text())["heroes"]}
    seen = {k: {} for k in ("enemy", "curio", "event", "trap", "relic", "relic_name", "encounter")}
    results, failed = [], False
    for path in paths:
        R = check_region(path, heroes_ids, seen)
        results.append(R)
        d = R["d"]
        # data/design 밖의 파일(실험용 사본)은 검사만 하고 표를 덮어쓰지 않는다
        out = write_md(R) if path.resolve().parent == DESIGN.resolve() else None
        print(f"── {path.name} 「{d['region']['name']}」 {ACTS[R['act']]['label']}")
        print(f"원귀 {len(d['enemies'])} · 조합 {len(R['enc_rows'])} · 특수 {len(d.get('specials', []))} · 기물 {len(d['curios'])} · 이벤트 {len(d['events'])} · 덫 {len(d['traps'])} · 가호 {len(d['relics'])} {dict(R['tiers'])}")
        print(f"해원 조건 분포: {dict(R['haewon'])} → 공용 상태 {len(R['haewon'])}/8종")
        print(f"압박 방식 분포: {dict(R['press'])}")
        print(f"가르치는 파티 동사: {sorted(R['verbs'])}")
        print(f"영웅 고유 기물 선택지: {dict(R['hero_curios'])} → 원형 {len(R['hero_curios'])}/8")
        vals = sorted(v for v, _ in R["trio_cov"].values())
        n_st = len([e for e in d['enemies'] if e.get('haewon') and e['haewon'].get('status')])
        print(f"3인 조합별 해원 가능 원귀 종수: 최소 {vals[0]} · 중앙 {vals[len(vals)//2]} · 최대 {vals[-1]} (해원 조건이 있는 원귀 {n_st}종)")
        own = [n for n in R["needs"] if not n.get("shared_from")]
        print(f"엔진 지원 필요: 새 메커니즘 {len(own)}개" + (f" ({', '.join(n['name'] for n in own)})" if own else "")
              + f" — 구현 {sum(1 for n in own if set(n.get('tags', [])) & IMPLEMENTED)}/{len(own)}"
              + (f" + 공유 {len(R['needs']) - len(own)}개" if len(R["needs"]) > len(own) else ""))
        print(f"표: {out.relative_to(ROOT)}" if out else "표: (data/design 밖의 파일이라 쓰지 않음)")
        for w in R["warns"]:
            print("주의:", w)
        if R["errors"]:
            failed = True
            for e in R["errors"]:
                print("❌", e)
        else:
            print("✅ 모든 검사 통과")
        print()
    if len(results) > 1:
        # 지역마다 해원이 쉬운 조합이 다른가: 조합별로 가장 약한 지역·가장 강한 지역의 비율
        print("── 지역 비교 (3인 조합의 해원 가능 비율: 그 지역 해원 원귀 중 몇 %)")
        trios = list(results[0]["trio_cov"])
        ratios = {}
        for t in trios:
            row = []
            for R in results:
                n_st = len([e for e in R["d"]["enemies"] if e.get("haewon") and e["haewon"].get("status")])
                row.append(R["trio_cov"][t][0] / n_st if n_st else 0)
            ratios[t] = row
        worst = min(ratios.items(), key=lambda kv: sum(kv[1]))
        best = max(ratios.items(), key=lambda kv: sum(kv[1]))
        flat = [min(r) for r in ratios.values()]
        print(f"모든 지역 중 가장 낮은 비율의 최소: {min(flat):.0%} · 세 지역 합이 가장 낮은 조합: {worst[0]} "
              + " / ".join(f"{x:.0%}" for x in worst[1]) + f" · 가장 높은 조합: {best[0]} " + " / ".join(f"{x:.0%}" for x in best[1]))
        swing = sum(1 for r in ratios.values() if max(r) - min(r) >= 0.25)
        print(f"지역에 따라 해원 비율이 25%p 이상 달라지는 조합: {swing}/{len(ratios)}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
