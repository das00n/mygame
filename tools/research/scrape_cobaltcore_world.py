#!/usr/bin/env python3
"""Scrape the rest of Cobalt Core (enemy ships + game structure) from cobaltcore.wiki.gg (CC BY-SA).

Research input only (mechanic analysis) -- the data does not ship.
Stdlib only, re-runnable (reuses the API / wikitext helpers of scrape_cobaltcore.py):

    python3 tools/research/scrape_cobaltcore_world.py [--enemies-out ...] [--structure-out ...]

Sources (MediaWiki API, batched 50 pages per request with continuation):
  * Category:Enemies + Template:Enemy users  -> one page per enemy ship ({{Enemy}} infobox,
    Layout list, Attacks/Behavior wikitables, Evasion prose, Hardest notes, Patch Changes)
  * Finale                                   -> the scripted final battle (10 phases, each an {{Enemy}} block)
  * Template:Enemies nav                     -> the wiki's own per-zone Common/Elite/Boss/Event/Shop list
  * Enemies / Common Enemy / Elite / Boss    -> older overview lists (compared, not trusted)
  * Patch * pages                            -> patch bullets that mention an enemy (fills stub pages)
  * Artifact (master table) + {{Artifact}} pages, Events (table) + event pages, Boot Sequence,
    {{Ship}} pages, Locations, Repair Yard, Hardmode, Hull, Characters, Starting Deck, Achievements,
    Mechanics, Ship Parts, Patch 1.1 / 1.2      -> structure file
"""
import argparse
import datetime
import json
import re
import sys
import time
import urllib.parse
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from scrape_cobaltcore import SLEEP, WIKI, api, fetch_pages, fetch_titles, one_line, plain, template_users  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ENEMIES = ROOT / "data/research/enemies/cobaltcore.json"
DEFAULT_STRUCTURE = ROOT / "data/research/structure/cobaltcore.json"
SOURCE = "https://cobaltcore.wiki.gg (CC BY-SA)"

ZONES = {"Lazuli Nebula": 1, "Sapphire Cluster": 2, "Void's Cradle": 3}
NAV_GROUP = {"Common": ("normal", "common"), "Elite": ("elite", "elite"), "Boss": ("boss", "boss"),
             "Event": ("event", "event"), "Shop": ("event", "repair_yard")}
CREW = ["Dizzy", "Riggs", "Peri", "Isaac", "Drake", "Max", "Books", "CAT"]


# ---------------------------------------------------------------- generic wikitext helpers
def clean(s):
    """Wikitext -> plain text, keeping the meaning of the few content-bearing templates/icons."""
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    # the Hardmode artifact icon marks difficulty-specific values
    s = re.sub(r"\[\[File:ArtifactHardmode[^\]]*\]\]\s*\[\[(?:Hardmode\|)?Hardest\]\]", "Hardest", s)
    s = re.sub(r"\[\[File:ArtifactHardmode[^\]]*\]\]\s*\[\[Hardmode(?:\|[^\]]*)?\]\]", "Hard+", s)
    s = re.sub(r"\[\[File:ArtifactHardmode[^\]]*\]\]", "Hardest", s)
    s = re.sub(r"\[\[File:Armored\.png[^\]]*\]\]", "", s)
    s = re.sub(r"\{\{CardLink\|([^|}]*)\|([AB])\}\}", r"\1 \2", s)
    s = re.sub(r"\{\{(?:CardLink|Parttrait|Difficulty)\|([^|}]*)[^}]*\}\}", r"\1", s)
    s = re.sub(r"\{\{(?:Textcolor|Color)\|[^|}]*\|([^}]*)\}\}", r"\1", s)
    s = re.sub(r"\{\{Character Panel\|([^|}]*)[^}]*\}\}", r"\1", s)
    s = s.replace("{{yes}}", "yes").replace("{{no}}", "no").replace("{{*}}", " · ")
    s = re.sub(r"<nowiki>(.*?)</nowiki>", r"\1", s, flags=re.S)
    for _ in range(3):  # nested templates (navboxes etc.) carry no text we need
        s = re.sub(r"\{\{[^{}]*\}\}", "", s)
    s = s.replace("&nbsp;", " ")
    return plain(s).replace("“", '"').replace("”", '"').replace("’", "'")


def text(s):
    return one_line(clean(s))


def strip_dialogue(wt):
    wt = re.sub(r"\{\{Character Quote[^\n]*\}\}\n?", "", wt)
    wt = re.sub(r"\{\|[^\n]*mw-collapsed.*?\n\|\}", "", wt, flags=re.S)
    return wt


def headings(wt):
    """All sections at any level, flattened: [(level, title, body)] in page order."""
    out, last = [], (0, "_intro", 0)
    for m in re.finditer(r"^(=+)\s*(.*?)\s*\1\s*$", wt, re.M):
        out.append((last[0], last[1], wt[last[2]:m.start()]))
        last = (len(m.group(1)), text(m.group(2)), m.end())
    out.append((last[0], last[1], wt[last[2]:]))
    return out


def section(wt, *names, deep=True):
    """Body of the first section whose title matches; deep=True includes its subsections."""
    hs = headings(wt)
    for i, (lvl, title, body) in enumerate(hs):
        if title in names:
            if deep:
                for lvl2, _, body2 in hs[i + 1:]:
                    if lvl2 <= lvl:
                        break
                    body += body2
            return body
    return ""


def template_block(wt, name, start=0):
    """Return (params, end) of the first {{name ...}} at/after start (brace-aware), or (None, -1)."""
    m = re.compile(r"\{\{\s*" + re.escape(name) + r"\s*(?=[|}\n])").search(wt, start)
    if not m:
        return None, -1
    depth, i = 0, m.start()
    while i < len(wt):
        if wt.startswith("{{", i) or wt.startswith("[[", i):
            depth += 1
            i += 2
            continue
        if wt.startswith("}}", i) or wt.startswith("]]", i):
            depth -= 1
            i += 2
            if depth == 0:
                break
            continue
        i += 1
    body = wt[m.end():i - 2]
    params, depth, cur = {}, 0, ""
    parts = []
    j = 0
    while j < len(body):  # split on top-level pipes
        two = body[j:j + 2]
        if two in ("{{", "[["):
            depth += 1
            cur += two
            j += 2
            continue
        if two in ("}}", "]]"):
            depth -= 1
            cur += two
            j += 2
            continue
        if body[j] == "|" and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += body[j]
        j += 1
    parts.append(cur)
    for p in parts:
        if "=" in p:
            k, v = p.split("=", 1)
            params[k.strip()] = v.strip()
    return params, i


def wikitables(wt):
    """Non-collapsed wikitables -> [{'headers': [...], 'rows': [[cell, ...]], 'start': idx}] (cells = wikitext)."""
    out = []
    for m in re.finditer(r"^\{\|(.*?)^\|\}", wt, re.M | re.S):
        if "mw-collapsed" in m.group(1).split("\n", 1)[0]:
            continue
        body = m.group(1).split("\n", 1)[1] if "\n" in m.group(1) else ""
        headers, rows = [], []
        for chunk in re.split(r"^\|-[^\n]*$", body, flags=re.M):
            cells, hdr = [], []
            for line in chunk.split("\n"):
                if line.startswith("!"):
                    for h in re.split(r"!!", line[1:]):
                        hdr.append(re.sub(r"^[^|\[]*=[^|\[]*\|", "", h).strip())
                elif line.startswith("|") and not line.startswith("|}"):
                    for c in line[1:].split("||"):
                        cells.append(re.sub(r"^\s*[a-z-]+=\"[^\"]*\"\s*\|", "", c))
                elif cells:
                    cells[-1] += "\n" + line
            if hdr and not headers:
                headers = hdr
            if cells:
                rows.append(cells)
        out.append({"headers": headers, "rows": rows, "start": m.start()})
    return out


def bullets(s):
    """'* a\n** b' -> [(depth, plain text)]."""
    return [(len(m.group(1)), text(m.group(2))) for m in re.finditer(r"^(\*+|#+)\s*(.*)$", s, re.M) if text(m.group(2))]


def links(s):
    return [l.split("|")[0].strip().replace("_", " ") for l in re.findall(r"\[\[([^\]]+)\]\]", s)
            if not l.lower().startswith(("file:", "category:"))]


def sentences(s):
    return [x.strip() for x in re.split(r"(?<=[.!?])\s+(?=[A-Z\"(])", one_line(s)) if x.strip()]


def resolve(titles):
    """Follow redirects / normalisation for a set of titles -> {asked: final}."""
    titles = sorted({t for t in titles if t})
    out = {}
    for i in range(0, len(titles), 50):
        d = api(action="query", titles="|".join(titles[i:i + 50]), redirects=1)
        q = d.get("query", {})
        norm = {x["from"]: x["to"] for x in q.get("normalized", [])}
        red = {x["from"]: x["to"] for x in q.get("redirects", [])}
        missing = {p["title"] for p in q.get("pages", []) if p.get("missing")}
        for t in titles[i:i + 50]:
            f = norm.get(t, t)
            f = red.get(f, f)
            out[t] = None if f in missing else f
        time.sleep(SLEEP)
    return out


def category_members(cat, ns=0):
    out, cont = [], {}
    while True:
        d = api(action="query", list="categorymembers", cmtitle="Category:" + cat, cmlimit=500, cmnamespace=ns, **cont)
        out += [x["title"] for x in d["query"]["categorymembers"]]
        if "continue" not in d:
            return out
        cont = d["continue"]
        time.sleep(SLEEP)


def prefix_pages(prefix):
    out, cont = [], {}
    while True:
        d = api(action="query", list="allpages", apprefix=prefix, aplimit=500, apfilterredir="nonredirects", **cont)
        out += [x["title"] for x in d["query"]["allpages"]]
        if "continue" not in d:
            return out
        cont = d["continue"]
        time.sleep(SLEEP)


def slug(name):
    return "cc." + re.sub(r"[^a-z0-9]+", "_", name.lower().replace("'", "")).strip("_")


def url(title):
    return WIKI + urllib.parse.quote(title.replace(" ", "_"))


def num_pair(s):
    """'8/8', '30/30 (Hardest: 34)', '7/10 (initially) -> 25/25', '0' -> (max or None, hardest or None)."""
    s = s or ""
    hard = re.search(r"\(\s*Hardest\s*:\s*(\d+)(?:\s*/\s*(\d+))?\s*\)", s)
    s2 = s[:hard.start()] + s[hard.end():] if hard else s
    pairs = re.findall(r"(\d+)\s*/\s*(\d+)", s2)
    if pairs:
        val = int(pairs[-1][1])
    else:
        m = re.search(r"\d+", s2)
        val = int(m.group(0)) if m else None
    hv = int(hard.group(2) or hard.group(1)) if hard else None
    return val, hv


# ---------------------------------------------------------------- intents
STATUS_ON_PLAYER = r"Engine Stall|Engine Lock|Heat|Missing|Corro(?:de|sion)|Shaken|Lose All Evade"
CARD_NAMES = r"Trash|Miasma|Toxic|Comm Jam|Fumes|Fear|Oxygen Leak|Safety Override|Yellow Card|Debris|card"
SELF_BUFFS = r"Powerdrive|Overdrive|Autododge|Payback|Reflexive|Ace|Survive|Mitosis|max hull"
INTENT_RULES = [
    ("attack", re.compile(r"\b(?:attack(?:s|ing)?\b(?!\s+drone)|fires?\b(?! like)|shoots?\b|laser|shots?\b|harpoon)", re.I)),
    ("shield", re.compile(r"\b(?:temp(?:orary)?\s+)?shield\b(?!\s+drone)|\bshields? for\b", re.I)),
    ("missile", re.compile(r"\b(?:missiles?|seekers?)\b(?!\s+bay)", re.I)),
    ("drone", re.compile(r"\b(?:drones?|space mines?|mines?|asteroids?|football|geodes?|repair kits?)\b(?!\s+hub)", re.I)),
    ("card", re.compile(r"\b(?:add|adds|added|give|gives)\b[^.;]*\b(?:" + CARD_NAMES + r")\b|\b(?:" + CARD_NAMES.replace("|card", "") + r")\b", re.I)),
    ("debuff", re.compile(r"\b(?:inflict\w*|appl(?:y|ies))\b[^.;]*\b(?:" + STATUS_ON_PLAYER + r")\b|\b(?:" + STATUS_ON_PLAYER + r")\b(?=[^.;]*\bif it hits\b)", re.I)),
    ("buff", re.compile(r"\bbuff\b|\b(?:" + SELF_BUFFS + r")\b", re.I)),
    ("heal", re.compile(r"\bheal", re.I)),
    ("move", re.compile(r"\bmov(?:e|es|ing)\b(?! any number)|\bretreat|\bswitch(?:es)? between\b", re.I)),
    ("none", re.compile(r"^\s*(?:nothing|does nothing)\b", re.I)),
]


def intent_of(effect):
    tags = []
    for name, rx in INTENT_RULES:
        m = rx.search(effect)
        if m:
            tags.append((m.start(), name))
    tags = [n for _, n in sorted(tags)]
    if "debuff" in tags and "card" in tags and not re.search(CARD_NAMES.replace("|card", ""), effect):
        tags.remove("card")
    return "+".join(dict.fromkeys(tags)) or "other"


# ---------------------------------------------------------------- enemies
def parse_navbox(wt):
    """Template:Enemies nav -> {enemy: {'zone','group','sub','event'}} in list order."""
    out, zone, group, sub = {}, None, None, None
    for line in wt.split("\n"):
        m = re.match(r"^\s*\|\s*group\d+\s*=\s*(.*)$", line)
        if m:
            label = text(m.group(1)).strip()
            if label in ZONES or label == "Miscellaneous":
                zone, group, sub = label, None, None
            elif label in NAV_GROUP:
                group, sub = label, None
            elif label:
                sub = label
            continue
        m = re.match(r"^\s*\|\s*list\d+\s*=\s*(.*)$", line)
        if m and "[[" in m.group(1):
            for item in m.group(1).split("{{*}}"):
                ls = links(item)
                if ls:
                    out.setdefault(ls[0], {"zone": zone, "group": group, "sub": sub, "event": ls[1] if len(ls) > 1 else None})
    return out


def parse_overview(wt):
    """Enemies / Common Enemy / Elite / Boss pages -> [(zone, group, link target, details, first_flag)]."""
    rows, zone, group = [], None, None
    for lvl, title, body in headings(wt):
        mz = re.match(r"Zone (\d)", title)
        if mz:
            zone = int(mz.group(1))
        if title.endswith(("Enemies", "Elites", "Bosses")) or lvl == 3:
            group = title
        for t in wikitables(body):
            for cells in t["rows"]:
                if len(cells) < 2:
                    continue
                ls = links(cells[0])
                if not ls:
                    continue
                rows.append({"zone": zone, "group": group or "(page)", "link": ls[0], "details": text(cells[1]),
                             "detail_links": links(cells[1]), "first": "¹" in cells[0]})
    return rows


def parse_layout(body):
    items = [t for d, t in bullets(body) if d == 1]
    return [f"{i + 1}. {t}" for i, t in enumerate(items)]


def moves_from_tables(body):
    moves = []
    for t in wikitables(body):
        hdr = [h.lower() for h in t["headers"]]
        for cells in t["rows"]:
            if not any(text(c) for c in cells):
                continue
            row = dict(zip(hdr, cells)) if hdr and len(hdr) == len(cells) else {}
            if not row:  # header mismatch: last cell = details, second-to-last = movement if 3+
                row = {"details": cells[-1]}
                if len(cells) >= 3:
                    row["move"] = cells[-2]
            effect = movement = label = None
            for k, v in row.items():
                if k.startswith(("details", "displayed")):
                    effect = text(v)
                elif k.startswith(("move", "immediate")):
                    movement = text(v)
                elif k.startswith(("description", "condition")):
                    label = text(v)
            if not effect:
                continue
            mv = {"intent": intent_of(effect), "effect": effect}
            if movement:
                mv["movement"] = movement
            if label:
                mv["condition"] = label
            moves.append(mv)
    return moves


PATTERN_WORDS = re.compile(r"\b(order|cycle|cycles|repeat|alternat|random|every turn|each turn|odd|even|turn \d|first|"
                           r"then|always|only (?:has|one)|once|after|before|phase|starts? at)", re.I)


def parse_enemy_page(title, wt, extra_patch_notes):
    """One ship page -> enemy dict (without nav-derived fields)."""
    stub = "{{Stub}}" in wt
    info, end = template_block(wt, "Enemy")
    info = info or {}
    body = strip_dialogue(wt[end:] if end > 0 else wt)
    hull, hull_h = num_pair(clean(info.get("hull", "")))
    shield, shield_h = num_pair(clean(info.get("shield", "")))
    intro = text(section(body, "_intro", deep=False))
    pilot = text(info.get("pilot", "")) or None
    if pilot is None and "File:" in info.get("pilot", ""):
        m = re.search(r"File:([^.|\]]+?)(?: Pilot)?\.png", info["pilot"])
        pilot = m.group(1) if m else None

    attack_sec = section(body, "Attacks") or section(body, "Behavior") or ""
    special = section(body, "Special Behaviors")
    moves = moves_from_tables(attack_sec)
    if special and special not in attack_sec:
        moves += moves_from_tables(special)
    pre = attack_sec.split("{|", 1)[0] if "{|" in attack_sec else ""
    if moves:
        pattern = text(pre)
    else:  # prose-only behaviour (bosses, Cleo, Soggins, stubs)
        prose = re.sub(r"\[\[File:[^\]]*\]\]", "[image]", attack_sec)
        paras = [text(p) for p in re.split(r"\n\s*\n", prose) if text(p) and text(p) != "[image]"]
        for p in paras:
            eff = p.replace("[image]", "(shown only as an image on the wiki)").strip()
            moves.append({"intent": intent_of(eff), "effect": eff})
        pattern = " ".join(s for p in paras for s in sentences(p) if PATTERN_WORDS.search(s)).replace(
            "[image]", "(image)")
    movement = text(section(body, "Evasion") or section(body, "Movement"))

    layout = section(body, "Layout", deep=False)
    parts = parse_layout(layout)
    whole = text(body.split("==Dialogue==")[0] if "==Dialogue==" in body else body)
    m = re.search(r"\b(\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) (?:tiles|spaces) wide", whole)
    if m:
        parts.insert(0, f"Width: {m.group(1)} tiles")
    srcs = []
    for mv in moves:
        for s in re.findall(r"\bfrom (?:its |the )?((?:left|right|central|center right|centre|middle|left-most|"
                            r"right-most|outer|\w+ )?(?:drill )?(?:cannon|missile bay|bay|wing|cockpit|empty slot|"
                            r"scaffold|launcher)s?(?: [A-F1-6])?)\b", mv["effect"], re.I):
            s = s.lower()
            if s not in srcs:
                srcs.append(s)
    if srcs:
        parts.append("Intent sources: " + ", ".join(srcs))
    trait_rx = re.compile(r"\b(weak|brittle|armou?r(?:ed)?|concussable|empty|scaffold\w*|reflexive)\b", re.I)
    for s in sentences(intro + " " + text(layout) + " " + text(section(body, "Strategy")) + " "
                       + text(section(body, "Tips and Tricks"))):
        if trait_rx.search(s) and not re.search(r"\byou(?:r)?\b", s, re.I) and len(s) < 400:
            note = "Trait note: " + s
            if note not in parts:
                parts.append(note)

    passives = []
    buffs = text(info.get("buffs", ""))
    if buffs:
        passives.append("Starts with: " + buffs)
    for sec_name in ("Modifiers", "Rules", "Penalty System"):
        sec = section(body, sec_name, deep=False)
        if sec:
            b = [t for _, t in bullets(sec)]
            passives.append(f"{sec_name}: " + (text(sec.split("\n*", 1)[0]) + " " + "; ".join(b)).strip())
    env_rx = re.compile(r"Ion Storm|Asteroid Field|Solar Flare|Solar Wind|Walled In|walled in|wall", re.I)
    for s in sentences(intro + " " + text(section(body, "Strategy"))):
        if env_rx.search(s) and not any(s in p for p in passives):
            passives.append("Environment: " + s)
    for s in sentences(intro):
        if re.search(r"\b(always|before each|will leave|offer|automatically|every turn|start(?:s)? (?:with|every))\b",
                     s, re.I) and not re.search(r"\bpiloted by\b|\bis a ship with\b", s) and s not in passives:
            passives.append("Intro: " + s)

    hardest = []
    for s in sentences(whole):
        if re.search(r"\bHardest\b", s) and s not in hardest:
            hardest.append(s)
    patch = [t for _, t in bullets(section(body, "Patch Changes"))] or extra_patch_notes
    return {
        "hull": hull, "hull_text": text(info.get("hull", "")) or None, "hull_hardest": hull_h,
        "shield": shield, "shield_text": text(info.get("shield", "")) or None, "shield_hardest": shield_h,
        "pilot": pilot, "infobox_zone": text(info.get("zone", "")) or None,
        "parts": parts, "moves": moves, "pattern": pattern, "movement": movement,
        "passives": passives, "hardest": hardest, "summary": intro, "patch_notes": patch,
        "wiki_stub": stub,
    }


def parse_finale(wt):
    """Finale page -> list of phase enemies."""
    out = []
    intro = text(section(wt, "_intro", deep=False))
    for lvl, title, body in headings(wt):
        m = re.match(r"Phase (\d+): (.+)", title)
        if not m:
            continue
        info, end = template_block(body, "Enemy")
        info = info or {}
        prose = text(body[end:] if end > 0 else body)
        hull, _ = num_pair(clean(info.get("hull", "")))
        shield, _ = num_pair(clean(info.get("shield", "")))
        name = f"Finale phase {m.group(1)}: {text(info.get('title', '')) or '???'} ({m.group(2)})"
        out.append({
            "id": slug(f"finale phase {m.group(1)} {m.group(2)}"), "name": name, "category": "event",
            "encounter": "finale", "area": "Finale (scripted story battle)", "zone": None,
            "hull": hull, "hull_text": text(info.get("hull", "")) or None, "shield": shield,
            "shield_text": text(info.get("shield", "")) or None, "pilot": text(info.get("pilot", "")) or None,
            "parts": [], "moves": [{"intent": intent_of(s), "effect": s} for s in sentences(prose)],
            "pattern": "Scripted single behaviour per phase (see moves).", "movement": "",
            "passives": ["Finale rule: " + s for s in sentences(intro)][:4] if m.group(1) == "1" else [],
            "hardest": [], "summary": prose, "patch_notes": [], "wiki_stub": False,
            "description": None, "fixed_first_fight": False, "also_in_events": [],
            "url": url("Finale") + "#" + urllib.parse.quote(title.replace(" ", "_")),
        })
    return out


def patch_mentions(patch_pages, resolve_map):
    """{enemy title: [bullet text incl. sub-bullets]} from all Patch * pages."""
    out = defaultdict(list)
    for ptitle, wt in sorted(patch_pages.items()):
        lines = wt.split("\n")
        for i, line in enumerate(lines):
            m = re.match(r"^(\*+)\s*(.*)$", line)
            if not m:
                continue
            depth = len(m.group(1))
            targets = {resolve_map.get(l) for l in links(m.group(2))}
            if not targets - {None}:
                continue
            txt = text(m.group(2))
            subs = []
            for nxt in lines[i + 1:]:
                mm = re.match(r"^(\*+)\s*(.*)$", nxt)
                if not mm or len(mm.group(1)) <= depth:
                    break
                subs.append(text(mm.group(2)))
            full = f"[{ptitle}] {txt}" + (" " + " / ".join(subs) if subs and txt.endswith(":") else "")
            for t in targets - {None}:
                out[t].append(full)
    return out


# ---------------------------------------------------------------- structure
def artifact_table(wt):
    rows = []
    t = wikitables(wt)[0]
    for cells in t["rows"]:
        if len(cells) < 5:
            continue
        rows.append({"name": text(cells[1]), "requirement": text(cells[2]), "rarity": text(cells[3]),
                     "effect": text(cells[4])})
    return rows


def classify_artifact(a, ship_names, ship_starters):
    req, rar = a["requirement"], a["rarity"]
    m = re.match(r"(Crew|Ship|Artifact|Event): (.+)", req)
    if m and m.group(1) == "Crew":
        return "crew", m.group(2)
    if m and m.group(1) == "Ship":
        return "ship", m.group(2)
    if m and m.group(1) == "Artifact":
        return ("ship", ship_starters[m.group(2)]) if m.group(2) in ship_starters else ("common", None)
    if m and m.group(1) == "Event":
        return "special", "event: " + m.group(2)
    if req in ("-", ""):
        return ("boss", None) if rar == "Boss" else ("common", None)
    return "special", req


def option_summary(wt):
    sec = section(wt, "Options") or section(wt, "Prompt")
    if not sec:
        return ""
    parts, cur = [], None
    for d, t in bullets(sec):
        if d == 1:
            cur = [t]
            parts.append(cur)
        elif cur is not None:
            cur.append(t)
        else:
            parts.append([t])
    extra = [text(x) for x in re.split(r"^\*.*$", sec, flags=re.M) if text(x) and not text(x).startswith("Prompt")]
    s = " | ".join(p[0] + (" -> " + "; ".join(p[1:]) if len(p) > 1 else "") for p in parts)
    if extra:
        s += " || Notes: " + " ".join(extra)
    return s


def parse_events(events_wt, pages, nav):
    tbl = wikitables(events_wt)[0]
    out = []
    fights = defaultdict(list)
    for enemy, v in nav.items():
        if v.get("event"):
            fights[v["event"]].append(enemy)
    for cells in tbl["rows"]:
        if len(cells) < 4:
            continue
        name = links(cells[0])[0]
        zones = [i + 1 for i, c in enumerate(cells[1:4]) if text(c).lower() == "yes"]
        wt = pages.get(name) or ""
        combat = list(fights.get(name, []))
        for m in re.finditer(r"(?:combat|fight|battle)[^.\n]*?\[\[([^\]|]+)", wt, re.I):
            tgt = m.group(1).replace("_", " ")
            if tgt in nav and tgt not in combat:
                combat.append(tgt)
        out.append({
            "name": name,
            "sector": ", ".join(f"Zone {z}" for z in zones),
            "zones": zones,
            "prerequisites": text(cells[4]) if len(cells) > 4 else "",
            "intro": " ".join(sentences(text(section(strip_dialogue(wt), "_intro", deep=False)))[:2]) if wt else None,
            "summary": option_summary(strip_dialogue(wt)) if wt else None,
            "combat": combat,
            "url": url(name),
        })
    return out


def parse_ship(title, wt, art_by_name, boss_by_ship):
    info, end = template_block(wt, "Ship")
    info = info or {}
    body = strip_dialogue(wt[end:])
    intro = section(body, "_intro", deep=False)
    quote = re.search(r"''\s*[“\"](.+?)[”\"]\s*''", intro)
    width = re.search(r"\b(\d+|four|five|six|seven) tiles wide", intro)
    starters = [l for l in links(info.get("artifacts", ""))]
    return {
        "name": title,
        "unlock": text(info.get("requirements", "")),
        "hull": num_pair(info.get("hull", ""))[0],
        "max_shield": num_pair(info.get("shield", ""))[0],
        "width_tiles": width.group(1) if width else None,
        "description": text(quote.group(1)) if quote else None,
        "summary": text(re.sub(r"''\s*[“\"].+?[”\"]\s*''", "", intro)),
        "starting_artifacts": [{"name": n, "effect": art_by_name.get(n, {}).get("effect")} for n in starters],
        "boss_artifacts": [{"name": a["name"], "effect": a["effect"]} for a in boss_by_ship.get(title, [])],
        "gimmick": " ".join(art_by_name[n]["effect"] for n in starters if n in art_by_name and n != "Warp Prep"),
        "patch_notes": [t for _, t in bullets(section(body, "Patch Changes"))],
        "url": url(title),
    }


def first_para(wt):
    return text(section(strip_dialogue(wt), "_intro", deep=False))


def build_rules(p, nav, zone_firsts, enemies, problems):
    def find(page, rx):
        m = re.search(rx, text(p.get(page, "")), re.I)
        if not m:
            problems.append(f"rules: pattern not found on {page}: {rx}")
            return None
        return m.group(0)

    zones = []
    for zname, zn in ZONES.items():
        z = {"zone": zn, "name": zname}
        for g in ("Common", "Elite", "Boss"):
            z[g.lower()] = [e for e, v in nav.items() if v["zone"] == zname and v["group"] == g]
        z["first_fight"] = zone_firsts.get(zn)
        zones.append(z)

    loc = wikitables(p["Locations"])[0]
    node_pages = {"Common Enemy": "Common Enemy", "Elite": "Elite", "Boss": "Boss", "Event": "Events",
                  "Artifact": "Artifact", "Repair Yard": "Repair Yard"}
    nodes = []
    for cells in loc["rows"]:
        if len(cells) < 3:
            continue
        name = text(cells[1])
        page = node_pages.get(name)
        nodes.append({"name": name, "summary": text(cells[2]),
                      "details": first_para(p[page]) if page and p.get(page) else None})

    ry_opts = [t for _, t in bullets(section(p["Repair Yard"], "Options", deep=False))]
    hm = section(p["Hardmode"], "Effects")
    diffs = [{"level": "Normal", "changes": ["No Hardmode artifact; baseline rules."]}]
    for lvl, title, body in headings(hm):
        if title in ("Hard", "Harder", "Hardest"):
            diffs.append({"level": title, "cumulative": title != "Hard",
                          "changes": [t for _, t in bullets(body)]})
    pre_up = find("Hardmode", r"reduction in pre-upgraded cards[^.]*\.[^.]*Zone 1[^.]*\.")

    boot = p["Boot Sequence"]
    boot_opts = section(boot, "Options")
    boot_parts = re.split(r"On \[\[Hardest\]\]", boot_opts)
    boot_bonus = [t for _, t in bullets(boot_parts[0])]
    boot_down = [t for _, t in bullets(boot_parts[1])] if len(boot_parts) > 1 else []

    hull_tbl = wikitables(section(p["Hull"], "Max Hull"))
    max_hull = []
    for t in hull_tbl:
        for cells in t["rows"]:
            if len(cells) == 3:
                max_hull.append({"source": text(cells[0]), "change": text(cells[1]), "condition": text(cells[2])})
    heal = []
    for t in wikitables(section(p["Hull"], "Healing")):
        for cells in t["rows"]:
            if len(cells) == 3 and not any(k in text(cells[0]) for k in ("Leech", "Bolt", "Repair ", "Compress",
                                                                          "Bruise", "Specimen", "Heart")):
                heal.append({"source": text(cells[0]), "amount": text(cells[1]), "condition": text(cells[2])})

    chars = p["Characters"]
    start_chars = [t for _, t in bullets(section(chars, "Starting Characters"))]
    unlock_chars = [t for _, t in bullets(section(chars, "Unlockable Characters"))]
    crew = []
    for c in CREW:
        info, _ = template_block(p.get(c, ""), "Character")
        crew.append({"name": c, "starting": c in start_chars,
                     "unlock": text((info or {}).get("unlock", "")) or ("default" if c in start_chars else None)})
    sd = p["Starting Deck"]
    starting_deck = {"basic": [], "per_crew": {}}
    cur = None
    for d, t in bullets(sd):
        if d == 1 and t in CREW:
            cur = t
            starting_deck["per_crew"][cur] = []
        elif d == 1:
            cur = None
            starting_deck["basic"].append(t)
        elif cur and d >= 2:
            starting_deck["per_crew"][cur].append(t)
        elif d >= 2:
            starting_deck["basic"].append("  " + t)

    ach = []
    for t in wikitables(p["Achievements"]):
        for cells in t["rows"]:
            if len(cells) >= 4:
                ach.append({"name": text(cells[1]), "description": text(cells[2]), "condition": text(cells[3])})

    mech = strip_dialogue(p["Mechanics"])
    combat = [s for s in sentences(text(section(mech, "Combat"))) if not re.match(r"^\w+ text\.$", s)]
    parts = {}
    for lvl, title, body in headings(p["Ship Parts"]):
        if lvl == 3:
            parts[title] = " ".join(sentences(text(body))[:4])

    env = defaultdict(list)
    for e in enemies:
        for ps in e["passives"]:
            for k in ("Ion Storm", "Asteroid Field", "Solar Flare", "Solar Wind", "Walled In", "walled in"):
                if k in ps:
                    env[k.title()].append(f"{e['name']}: {ps}")

    finale_intro = first_para(p["Finale"])
    daily = [t for _, t in bullets(section(p["Patch 1.2"], "Content"))]
    p11_notes = [t for _, t in bullets(section(p["Patch 1.1"], "Notes"))]
    loop = {
        "run_is_a_loop": "Each run is a 'loop' of the same three zones; the main menu tracks runs as 'Loop X' (Mechanics page note).",
        "boot_sequence": first_para(boot),
        "boot_sequence_bonuses": boot_bonus,
        "boot_sequence_hardest_downsides": boot_down,
        "memories_and_finale": finale_intro,
        "events_once_per_loop": find("Events", r"Each event can only trigger once per loop[^.]*\."),
        "progress_gated_content": [x for x in [
            find("Patch 1.1", r"all the new enemies can only show up after you've played or won a few runs\."),
            "The Tower fight modifiers (Solar Flare / Asteroid Field / Solar Wind): after 3 runs and 1 win (The Tower page).",
            find("CST-7 \"Minesweeper\"", r"It will only appear if the player has played at least 3 runs and has at least 1 win\."),
            find("Repair Yard", r"\[Requires 2 or more wins\][^.]*"),
            find("Crystallized Crew", r"requires you to have won at least 3 runs and unlocked Isaac\."),
            find("Sports!", r"only if Drake is unlocked\."),
            find("Patch 1.2", r"Daily runs are available after beating the game[^)]*\)"),
        ] if x],
        "daily_runs": daily,
        "patch_1_1_notes": p11_notes,
        "gaps": ["Mechanics page 'Meta-Progression' and 'Codex' sections are placeholders ('Meta-progression text.'): "
                 "the wiki does not document which runs unlock which of the 18 memories."],
    }
    return {
        "zones": zones,
        "node_types": nodes,
        "node_frequencies": {
            "repair_yard": find("Repair Yard", r"Each zone has two Repair Yards[^.]*\.[^.]*\."),
            "elite": find("Elite", r"A given Elite can only be encountered[^.]*\."),
            "first_fight": find("CCD-19 \"Cicada\" Drone", r"The Cicada is always the first ship encountered[^.]*\."),
            "events": find("Events", r"Some events are locked to a particular Zone[^.]*\."),
            "gap": "The wiki gives no per-zone node counts, row counts or node-type weights beyond the sentences above.",
        },
        "map_structure": [x for x in [
            first_para(p["Locations"]),
            find("Repair Yard", r"Because of the randomly diverging pathways[^.]*\."),
            "Three zones in order: Lazuli Nebula (1) -> Sapphire Cluster (2) -> Void's Cradle (3); each ends at a Boss, "
            "then an Exit node leads to the next zone (Locations table). The Finale is a separate battle launched from the Memories screen.",
        ] if x],
        "rewards": {
            "common_enemy": first_para(p["Common Enemy"]),
            "elite": find("Elite", r"defeating them will always result in[^.]*\."),
            "boss": find("Boss", r"defeating them will always result in[^.]*\."),
            "artifact_node": text(loc["rows"][4][2]) if len(loc["rows"]) > 4 else None,
            "pre_upgraded_card_offers": pre_up,
            "artifact_pool": first_para(p["Artifact"]),
            "max_hull_sources": max_hull,
            "healing_sources_non_card": heal,
        },
        "repair_yard": {"summary": first_para(p["Repair Yard"]), "options": ry_opts},
        "difficulty": {"artifact": "Hardmode (starter artifact on Hard and up; effects stack: Harder = Hard + more, Hardest = Harder + more)",
                       "levels": diffs},
        "crew": {"crew_size": find("Characters", r"select 3 of the following characters[^.]*\."),
                 "characters": crew, "starting_deck": starting_deck,
                 "crystallized_crew_event": find("Crystallized Crew", r"You are given the option to save them[^.]*\.[^.]*\.")},
        "achievements": ach,
        "time_loop": loop,
        "combat": {"overview": combat, "ship_parts": parts},
        "environment_modifiers": dict(env),
    }


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--enemies-out", type=Path, default=DEFAULT_ENEMIES)
    ap.add_argument("--structure-out", type=Path, default=DEFAULT_STRUCTURE)
    args = ap.parse_args()
    problems = []

    print("fetching enemy pages ...", file=sys.stderr)
    enemy_cat = fetch_pages(generator="categorymembers", gcmtitle="Category:Enemies", gcmtype="page", gcmlimit=50)
    tmpl_users = set(template_users("Template:Enemy"))
    missing_tmpl = sorted(tmpl_users - set(enemy_cat))
    if missing_tmpl:
        enemy_cat.update(fetch_titles(missing_tmpl))
    print("fetching lists, structure pages, patches ...", file=sys.stderr)
    struct_titles = ["Template:Enemies nav", "Enemies", "Common Enemy", "Elite", "Boss", "Locations", "Artifact",
                     "Events", "Boot Sequence", "Repair Yard", "Hardmode", "Hull", "Characters", "Starting Deck",
                     "Achievements", "Mechanics", "Ship Parts", "Main Page", "Crystallized Crew", "Sports!", *CREW]
    p = fetch_titles(struct_titles)
    patch_titles = sorted(set(prefix_pages("Patch ")) | set(category_members("Patches")))
    patch_pages = fetch_titles(patch_titles)
    p.update({k: v for k, v in patch_pages.items()})
    p.update(enemy_cat)

    # ------------------------------------------------ enemy lists
    nav = parse_navbox(p["Template:Enemies nav"])
    overview_rows = {pg: parse_overview(p[pg]) for pg in ("Enemies", "Common Enemy", "Elite", "Boss")}
    link_targets = set(nav) | {r["link"] for rows in overview_rows.values() for r in rows} | {
        l for rows in overview_rows.values() for r in rows for l in r["detail_links"]}
    for wt in patch_pages.values():
        link_targets |= set(links(wt))
    rmap = resolve(link_targets)
    nav = {rmap.get(k) or k: v for k, v in nav.items()}
    ship_pages = {t: wt for t, wt in enemy_cat.items() if wt.count("{{Enemy") == 1 and "{{Enemy\n" in wt or
                  (wt.count("{{Enemy") == 1)}
    multi = {t for t, wt in enemy_cat.items() if wt.count("{{Enemy") > 1}
    overview_pages = set(enemy_cat) - set(ship_pages) - multi
    pm = patch_mentions(patch_pages, {k: v for k, v in rmap.items() if v in ship_pages})

    over_by_name = defaultdict(list)
    for pg, rows in overview_rows.items():
        for r in rows:
            tgt = rmap.get(r["link"]) or r["link"]
            if tgt not in ship_pages:  # event rows: the enemy is linked in the details cell
                cand = [rmap.get(l) for l in r["detail_links"] if rmap.get(l) in ship_pages]
                if not cand:
                    continue
                tgt = cand[0]
            over_by_name[tgt].append({**r, "page": pg})
    zone_firsts = {}
    for name, rows in over_by_name.items():
        for r in rows:
            if r["first"]:
                zone_firsts[r["zone"]] = name

    alt_boss = {}
    for t, wt in patch_pages.items():
        for m in re.finditer(r"alternate Zone (\d) boss:\s*\[\[([^\]|]+)", wt):
            alt_boss[rmap.get(m.group(2)) or m.group(2)] = f"alternate Zone {m.group(1)} boss added in {t}"

    enemies = []
    for title in sorted(ship_pages, key=str.lower):
        e = parse_enemy_page(title, ship_pages[title], pm.get(title, []))
        n = nav.get(title)
        if n:
            cat, enc = NAV_GROUP.get(n["group"], ("event", "event"))
            zone = ZONES.get(n["zone"])
            area = f"Zone {zone}: {n['zone']}" if zone else (e["infobox_zone"] or n["zone"])
            if enc == "repair_yard":
                area = "Any zone (optional Repair Yard fight: 'Fight me')"
            elif enc == "event" and e["infobox_zone"]:
                area = e["infobox_zone"]
        else:
            cat, enc, zone, area = "event", "unlisted", None, e["infobox_zone"]
            problems.append(f"{title}: not in Template:Enemies nav")
        if title in alt_boss:
            enc = "alternate_boss"
        ov = over_by_name.get(title, [])
        events = sorted({n2["event"] for k, n2 in nav.items() if k == title and n2.get("event")} |
                        {r["link"] for r in ov if rmap.get(r["link"]) not in ship_pages and r["link"] != title})
        enemies.append({
            "id": slug(title), "name": title, "category": cat, "encounter": enc, "area": area, "zone": zone,
            **{k: e[k] for k in ("hull", "shield", "parts", "moves", "pattern", "passives")},
            "movement": e["movement"],
            "hardest": e["hardest"],
            "pilot": e["pilot"],
            "hull_text": e["hull_text"], "hull_hardest": e["hull_hardest"],
            "shield_text": e["shield_text"], "shield_hardest": e["shield_hardest"],
            "description": next((r["details"] for r in ov if r["page"] == "Enemies"), None) or
                           next((r["details"] for r in ov), None),
            "fixed_first_fight": any(r["first"] for r in ov),
            "also_in_events": events,
            "alt_boss_note": alt_boss.get(title),
            "summary": e["summary"],
            "patch_notes": e["patch_notes"],
            "wiki_stub": e["wiki_stub"],
            "infobox_zone": e["infobox_zone"],
            "url": url(title),
        })
    finale = parse_finale(p["Finale"]) if "Finale" in multi or "Finale" in p else []
    enemies += finale

    # ------------------------------------------------ enemy completeness
    disc = []
    names = set(ship_pages)
    for k in sorted(set(nav) - names):
        disc.append(f"navbox entry without enemy page: {k}")
    for k in sorted(names - set(nav)):
        disc.append(f"enemy page not in navbox: {k}")
    p11 = p.get("Patch 1.1", "")
    for pg, rows in overview_rows.items():
        listed = set()
        for r in rows:
            tgt = rmap.get(r["link"]) or r["link"]
            listed.add(tgt)
            listed |= {rmap.get(l) for l in r["detail_links"]}
        expected = {k for k, v in nav.items() if (pg == "Enemies" or
                    {"Common Enemy": "Common", "Elite": "Elite", "Boss": "Boss"}[pg] == v["group"])}
        if pg == "Enemies":
            expected = {k for k, v in nav.items() if v["zone"] in ZONES}
        for k in sorted(expected - listed):
            cause = "added in Patch 1.1, overview page not updated" if f"[[{k}]]" in p11 or k in alt_boss else "unknown"
            disc.append(f"'{pg}' page does not list {k} (navbox: {nav[k]['zone']} {nav[k]['group']}) -- cause: {cause}")
        for r in rows:
            tgt = rmap.get(r["link"]) or r["link"]
            if tgt in nav and nav[tgt]["zone"] in ZONES and "Event" not in (r["group"] or ""):
                g = nav[tgt]["group"]
                rg = r["group"] if pg == "Enemies" else {"Common Enemy": "Common", "Elite": "Elite", "Boss": "Boss"}[pg]
                if not rg.startswith(g[:4]) and not (g == "Common" and "Common" in rg):
                    cause = ("Patch 1.1: Mining Drill 'upgraded from NORMAL to ELITE'" if "Mining Drill" in tgt
                             else "unknown")
                    disc.append(f"'{pg}' lists {tgt} as {rg} but navbox says {g} -- cause: {cause}")
                if r["zone"] and ZONES[nav[tgt]["zone"]] != r["zone"]:
                    disc.append(f"'{pg}' lists {tgt} in zone {r['zone']} but navbox says {nav[tgt]['zone']}")
    for e in enemies:
        if e.get("infobox_zone") and e["zone"]:
            iz = e["infobox_zone"]
            zn = ZONES.get(iz) or (int(iz[-1]) if re.match(r"Zone \d", iz) else None)
            if zn and zn != e["zone"]:
                disc.append(f"{e['name']}: infobox zone '{iz}' vs navbox Zone {e['zone']} (navbox + Patch 1.1 agree on the navbox)")
    bosses_cat = set(category_members("Bosses"))
    nav_bosses = {k for k, v in nav.items() if v["group"] == "Boss"}
    if nav_bosses - bosses_cat:
        disc.append(f"Category:Bosses lacks {sorted(nav_bosses - bosses_cat)} (alternate bosses added in Patch 1.1; category not updated)")
    stubs = sorted(e["name"] for e in enemies if e["wiki_stub"])
    no_moves = sorted(e["name"] for e in enemies if not e["moves"])
    image_only = sorted(e["name"] for e in enemies if any("only as an image" in m["effect"] for m in e["moves"]))
    enemy_completeness = {
        "category_enemies_pages": len(enemy_cat),
        "ship_pages": len(ship_pages),
        "template_enemy_users": len(tmpl_users),
        "navbox_entries": len(nav),
        "navbox_per_zone_group": {z: dict(Counter(v["group"] for v in nav.values() if v["zone"] == z))
                                  for z in [*ZONES, "Miscellaneous"]},
        "overview_pages_in_category": sorted(overview_pages),
        "multi_phase_pages": sorted(multi),
        "finale_phases": len(finale),
        "enemies_total": len(enemies),
        "wiki_stubs": stubs,
        "no_move_data": no_moves,
        "moves_only_as_images": image_only,
        "discrepancies": disc,
        "parse_problems": problems,
    }

    # ------------------------------------------------ structure: artifacts
    print("fetching artifacts, events, ships ...", file=sys.stderr)
    arts = artifact_table(p["Artifact"])
    art_pages = fetch_pages(generator="embeddedin", geititle="Template:Artifact", geinamespace=0, geilimit=50)
    art_cat = set(category_members("Artifacts")) | set(category_members("Starter artifacts"))
    ship_wt = fetch_pages(generator="embeddedin", geititle="Template:Ship", geinamespace=0, geilimit=50)
    ship_starters = {}
    for s, wt in ship_wt.items():
        info, _ = template_block(wt, "Ship")
        for l in links((info or {}).get("artifacts", "")):
            if l != "Warp Prep":
                ship_starters[l] = s
    art_by_name = {}
    art_out = []
    for a in arts:
        owner, owner_name = classify_artifact(a, set(ship_wt), ship_starters)
        info, _ = template_block(art_pages.get(a["name"], ""), "Artifact")
        rec = {"name": a["name"], "owner": owner, "owner_name": owner_name, "rarity": a["rarity"],
               "requirement": a["requirement"], "effect": a["effect"],
               "short_effect": text((info or {}).get("effect", "")) or None, "url": url(a["name"])}
        art_out.append(rec)
        art_by_name[a["name"]] = rec
    art_disc = []
    tn = {a["name"] for a in arts}
    if set(art_pages) - tn:
        art_disc.append(f"{{{{Artifact}}}} pages missing from the master table: {sorted(set(art_pages) - tn)}")
    if tn - set(art_pages):
        art_disc.append(f"master table rows without an {{{{Artifact}}}} page: {sorted(tn - set(art_pages))}")
    if art_cat ^ set(art_pages):
        art_disc.append(f"Category:Artifacts(+Starter) vs template users differ: only-category {sorted(art_cat - set(art_pages))}, "
                        f"only-template {sorted(set(art_pages) - art_cat)}")
    for a in art_out:
        info, _ = template_block(art_pages.get(a["name"], ""), "Artifact")
        ch = text((info or {}).get("character", ""))
        if ch in CREW and (a["owner"] != "crew" or a["owner_name"] != ch):
            art_disc.append(f"{a['name']}: page character={ch} but table requirement '{a['requirement']}'")
    mp = re.search(r"(\d+) artifacts", text(p.get("Main Page", "")))
    if mp and int(mp.group(1)) != len(arts):
        art_disc.append(f"Main Page blurb says '{mp.group(0)}' but the master table has {len(arts)} (stale blurb, "
                        "Patch 1.0.6 / 1.1 added artifacts)")

    boss_by_ship = defaultdict(list)
    for a in art_out:
        if a["owner"] == "ship" and a["rarity"] == "Boss":
            boss_by_ship[a["owner_name"]].append(a)
    ships = [parse_ship(s, ship_wt[s], art_by_name, boss_by_ship) for s in sorted(ship_wt)]

    # ------------------------------------------------ structure: events
    ev_cat = [t for t in category_members("Events") if t != "Events"]
    ev_names = [links(c[0])[0] for c in wikitables(p["Events"])[0]["rows"] if c and links(c[0])]
    ev_pages = fetch_titles(sorted(set(ev_cat) | set(ev_names) | {"Boot Sequence"}))
    p.update(ev_pages)
    events = parse_events(p["Events"], ev_pages, nav)
    events.append({"name": "Boot Sequence", "sector": "Start of every loop after the first (special, always occurs)",
                   "zones": [], "prerequisites": "Not the first loop", "intro": first_para(p["Boot Sequence"]),
                   "summary": option_summary(p["Boot Sequence"]), "combat": [], "url": url("Boot Sequence")})
    ev_disc = []
    if set(ev_names) - set(ev_cat):
        ev_disc.append(f"in Events table but not in Category:Events: {sorted(set(ev_names) - set(ev_cat))} (page lacks the category tag)")
    if set(ev_cat) - set(ev_names):
        ev_disc.append(f"in Category:Events but not in Events table: {sorted(set(ev_cat) - set(ev_names))}")
    codex = re.search(r"There are (\d+) total Events in the Codex, but only (\d+) are unique", text(p["Events"]))
    if codex:
        ev_disc.append(f"Events page: Codex counts {codex.group(1)} events, {codex.group(2)} unique "
                       f"(Fake Distress Signal has a Drake variant); table rows = {len(ev_names)}")
    missing_summary = [e["name"] for e in events if not e["summary"]]
    if missing_summary:
        ev_disc.append(f"events without a parsable Options section: {missing_summary}")

    rules = build_rules(p, nav, zone_firsts, enemies, problems)

    today = datetime.date.today().isoformat()
    enemies_out = {
        "game": "Cobalt Core", "source": SOURCE, "retrieved": today,
        "notes": (
            "Every enemy ship page (Category:Enemies = pages using Template:Enemy, minus the 'Enemies' overview) plus the "
            "10 scripted phases of the Finale page. category/area/zone come from Template:Enemies nav (the wiki's own, "
            "post-1.1 list); encounter refines category (common/elite/boss/alternate_boss/event/repair_yard/finale). "
            "Enemies have no decks: every part shows an intent; a 'move' = one turn's full set of part intents, in the "
            "order the wiki lists them. moves[].effect is the wiki text ('Attack 2 from left cannon' = that part fires "
            "straight down its lane); moves[].movement is how the ship repositions BEFORE acting ('Move any number of "
            "spaces / Aims at player' = lines its firing parts up with the player's ship); intent is a '+'-joined tag "
            "list derived by regex (attack/shield/missile/drone/card/debuff/buff/heal/move/none). pattern = the wiki's "
            "sentence on how actions are chosen. hull/shield = max values on Normal (hull_hardest/shield_hardest when the "
            "wiki gives one; *_text keeps the raw infobox). parts = Layout list (left->right) when the page has one, the "
            "parts that intents come from, and trait sentences (Weak/Brittle/Armored/Concussable/Empty). passives = "
            "infobox 'Starts with', fight modifiers/rules and environment notes. hardest = every sentence mentioning "
            "Hardest. Stub pages (wiki_stub=true) only have stats; their patch_notes are filled from Patch pages. "
            "Numbers on intents do not include accumulated Powerdrive/Overdrive."
        ),
        "completeness": enemy_completeness,
        "enemies": enemies,
    }
    structure_out = {
        "game": "Cobalt Core", "source": SOURCE, "retrieved": today,
        "notes": (
            "Game structure for mechanic analysis. artifacts = the wiki's master table on the 'Artifact' page; owner is "
            "crew / ship / common / boss / special (owner_name = crew member or ship; 'boss' = generic boss artifact, "
            "crew- or ship-specific boss artifacts keep owner crew/ship with rarity 'Boss'; 'special' = Hardmode, "
            "event, Cleo and Finale artifacts). events = the Events page table (zones, prerequisites) + each event "
            "page's Options list, plus the special Boot Sequence. ships = pages using Template:Ship. rules = sentences "
            "and lists lifted from Locations, Common Enemy/Elite/Boss, Repair Yard, Hardmode, Hull, Boot Sequence, "
            "Characters, Starting Deck, Achievements, Mechanics, Ship Parts, Finale and Patch 1.1/1.2; gaps are listed "
            "where the wiki is silent (node counts, memory unlock rules)."
        ),
        "completeness": {
            "artifacts_master_table": len(arts),
            "artifact_template_pages": len(art_pages),
            "artifact_category_pages": len(art_cat),
            "artifacts_by_owner": dict(Counter(a["owner"] for a in art_out)),
            "artifacts_by_rarity": dict(Counter(a["rarity"] for a in art_out)),
            "artifacts_by_owner_name": dict(Counter(a["owner_name"] for a in art_out if a["owner_name"])),
            "events_table_rows": len(ev_names),
            "events_category_pages": len(ev_cat),
            "player_ships": len(ships),
            "discrepancies": art_disc + ev_disc,
            "parse_problems": [x for x in problems if x.startswith("rules")],
        },
        "artifacts": art_out,
        "events": events,
        "ships": ships,
        "rules": rules,
    }
    for path, data in ((args.enemies_out, enemies_out), (args.structure_out, structure_out)):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    # ------------------------------------------------ summary
    print(f"wrote {args.enemies_out} ({len(enemies)} enemies incl. {len(finale)} finale phases)")
    print(f"wrote {args.structure_out} ({len(arts)} artifacts, {len(events)} events, {len(ships)} ships)")
    print("by category:", dict(Counter(e["category"] for e in enemies)), "by encounter:",
          dict(Counter(e["encounter"] for e in enemies)))
    print("stubs:", stubs)
    print("no moves:", no_moves, "image-only moves:", image_only)
    for line in disc + art_disc + ev_disc + problems:
        print("  !", line)


if __name__ == "__main__":
    main()
