"""카드 전수 데이터 → 메커닉 태그 + 주인별 프로필 (Phase 1-3).

입력: data/research/cards/*.json (공통 스키마)
출력:
  data/research/mechanics/tags.json      카드별 태그
  data/research/mechanics/profiles.json  게임 × 주인(캐릭터·클랜·승무원)별 집계
  data/research/mechanics/profiles.md    사람이 읽는 요약 표

실행: python3 tools/research/tag_mechanics.py
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from taxonomy import CONDITIONS, CONSUME_CONTEXT, EFFECTS, FAMILIES, PROPS, SCALING  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CARDS_DIR = ROOT / "data/research/cards"
OUT_DIR = ROOT / "data/research/mechanics"

PRODUCE_VERB = r"(?:gain|gains|apply|applies|inflict|inflicts|add|adds|give|gives|grant|grants|get|gets|channel|channels|launch|launches|summon|summons|create|creates|spawn|spawns|shoot|shoots|increase|increases|double)\b[^.;]{0,40}?"


def compile_group(spec):
    return {k: (desc, [re.compile(p) for p in pats]) for k, (desc, pats) in spec.items()}


C_EFFECTS, C_PROPS, C_COND, C_SCALE = map(compile_group, (EFFECTS, PROPS, CONDITIONS, SCALING))
C_FAM = {}
for fam, (desc, terms) in FAMILIES.items():
    alt = "|".join(terms)
    C_FAM[fam] = {
        "desc": desc,
        "mention": re.compile(rf"(?:{alt})"),
        "produce": [re.compile(rf"{PRODUCE_VERB}(?:{alt})"), re.compile(rf"(?:{alt})\s*\+?\d")],
        "consume": [re.compile(ctx.format(t=alt)) for ctx in CONSUME_CONTEXT],
    }


def plain(card):
    parts = [card.get("text") or "", card.get("text_upgraded") or ""]
    extra = card.get("extra") or {}
    for k in ("upgrade_a", "upgrade_b"):
        if isinstance(extra.get(k), dict):
            parts.append(extra[k].get("text") or "")
    return " ".join(parts).lower()


TRIGGER_DEF = re.compile(r"\b(?:whenever|each time|at the (?:start|end) of)\b")


def match_group(compiled, text):
    return sorted(k for k, (_, pats) in compiled.items() if any(p.search(text) for p in pats))


def tag_card(card, glossary=None):
    text = plain(card)
    kw = " ".join(card.get("keywords") or []).lower()
    # 효과가 키워드 정의 안에 있는 카드(예: "Gain 1 Strafe")를 위해, 발동형 키워드의 정의문만 덧붙여 '소비' 판정에 쓴다.
    cons_text = text
    if glossary:
        defs = [glossary[k].lower() for k in card.get("keywords") or [] if k in glossary]
        cons_text = text + " " + " ".join(d for d in defs if TRIGGER_DEF.search(d))
    both = f"{text} {kw}"
    effects = match_group(C_EFFECTS, both)
    props = match_group(C_PROPS, text)
    if str(card.get("cost", "")).strip().lower() == "x":
        props.append("x_cost")
    if str(card.get("type", "")).lower() in {"power"}:
        props.append("persistent")
    produce, consume = [], []
    for fam, c in C_FAM.items():
        if not c["mention"].search(both):
            continue
        is_cons = any(p.search(cons_text) for p in c["consume"])
        is_prod = any(p.search(both) for p in c["produce"])
        if fam == "exhaust":  # 자기 소멸은 성질(props)이다. 다른 카드를 소멸시켜야 생산으로 본다.
            is_prod = "exhaust_other" in effects
            if not (is_prod or is_cons):
                continue
        if is_cons:
            consume.append(fam)
        if is_prod or not is_cons:
            produce.append(fam)
    return {
        "effects": effects,
        "produce": produce,
        "consume": consume,
        "props": sorted(set(props)),
        "conditions": match_group(C_COND, text),
        "scaling": match_group(C_SCALE, text),
    }


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tags, profiles = {}, {}
    for path in sorted(CARDS_DIR.glob("*.json")):
        data = json.loads(path.read_text())
        game = path.stem
        glossary = {k: v for k, v in (data.get("keyword_glossary") or {}).items() if isinstance(v, str)}
        prof = defaultdict(lambda: defaultdict(Counter))
        for card in data["cards"]:
            t = tag_card(card, glossary)
            tags[card["id"]] = {"game": game, "name": card["name"], "owner": card.get("owner"), **t}
            p = prof[card.get("owner") or "?"]
            p["_n"]["cards"] += 1
            for key in ("effects", "props", "conditions", "scaling"):
                p[key].update(t[key])
            p["produce"].update(t["produce"])
            p["consume"].update(t["consume"])
        profiles[game] = {o: {k: dict(v) for k, v in d.items()} for o, d in prof.items()}

    (OUT_DIR / "tags.json").write_text(json.dumps(tags, ensure_ascii=False, indent=1))
    (OUT_DIR / "profiles.json").write_text(json.dumps(profiles, ensure_ascii=False, indent=1))
    write_markdown(profiles)
    untagged = [k for k, v in tags.items() if not (v["effects"] or v["produce"] or v["props"])]
    print(f"tagged {len(tags)} cards, untagged {len(untagged)}")
    for k in untagged[:40]:
        print("  untagged:", k)


def write_markdown(profiles):
    fams = list(FAMILIES)
    lines = ["# 주인별 생산/소비 프로필 (자동 생성)", "",
             "`tools/research/tag_mechanics.py` 가 만든다. 셀 = `생산/소비` 카드 수. 정규식 기반이라 근사치다.", ""]
    for game, owners in profiles.items():
        lines += [f"## {game}", "", "| 주인 | 카드 | " + " | ".join(fams) + " |",
                  "|---|---:|" + "---:|" * len(fams)]
        for owner, p in sorted(owners.items(), key=lambda kv: -kv[1]["_n"]["cards"]):
            cells = []
            for f in fams:
                pr, co = p.get("produce", {}).get(f, 0), p.get("consume", {}).get(f, 0)
                cells.append(f"{pr}/{co}" if pr or co else "")
            lines.append(f"| {owner} | {p['_n']['cards']} | " + " | ".join(cells) + " |")
        lines.append("")
    lines += ["## 계열 설명", ""] + [f"- `{k}`: {v[0]}" for k, v in FAMILIES.items()]
    (OUT_DIR / "profiles.md").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
