#!/usr/bin/env python3
"""World census for Slay the Spire (StS1) and Slay the Spire 2 (StS2): enemies + run structure -> JSON.

Research input only (mechanic analysis); the data does not ship in the game.
Source: https://slaythespire.wiki.gg MediaWiki API (content CC BY-SA).

Writes
  data/research/enemies/sts1.json, sts2.json     every enemy: HP, moves (intents), AI pattern, passives
  data/research/structure/sts1.json, sts2.json   relics, potions, events, encounters per act, run rules

Run:  python3 tools/research/scrape_sts_world.py [--cache FILE]
  --cache FILE  reuse raw API responses stored in FILE (written on first run).
Python 3 stdlib only. Wikitext helpers (template parsing, plain-text rendering) come from scrape_sts.py.

Where the data comes from
  enemies    every page embedding {{Enemy Infobox}} (one infobox per enemy; {{Intents Table/row}} = moves;
             prose after the intents table = pattern; {{Power Infobox}} = enemy power definitions)
  encounters StS1 'Monsters' (easy/hard pools with weights), 'Elites', 'Bosses' pages;
             StS2 act pages ({{Encounter Table/row}}, elite/boss lists)
  relics / potions  Cargo tables Relics / Potions (cross-checked against Module:Relics|Potions data,
             which renders the wiki's Relics List / Potions List pages)
  events     Module:Events/data + Module:Events/StS2 data (act, summary; they render the Events List
             pages) + each event page's == Options == section
  rules      Module:Ascension data + Ascension page table, plus RULES (hand-condensed from the
             mechanics pages named in each entry's 'source'; values the wiki lacks are marked so)
"""
import argparse
import datetime
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from scrape_sts import (STS2_PREFIX, ROOT, api, cargo_all, find_templates, list_all,  # noqa: E402
                        resolve_choices, slug, split_params, to_plain)

ENEMY_DIR = ROOT / "data/research/enemies"
STRUCT_DIR = ROOT / "data/research/structure"
P2 = STS2_PREFIX

ACTS = {
    1: {"Act 1": "Exordium", "Act 2": "The City", "Act 3": "The Beyond", "Act 4": "The Ending"},
    2: {"Overgrowth": "Act 1", "Underdocks": "Act 1", "Hive": "Act 2", "Glory": "Act 3"},
}
ACT_PAGES = {1: ["Exordium", "The City", "The Beyond", "The Ending"],
             2: [P2 + a for a in ("Overgrowth", "Underdocks", "Hive", "Glory")]}
RULE_PAGES = {
    1: ["Acts", "Ascension", "Bosses", "Cards", "Elites", "Gold", "Map Generation", "Map Locations",
        "Mechanics", "Monsters", "Neow", "Potions", "Relics", "Rest Sites", "The Merchant",
        "Unknown Location"],
    2: [P2 + t for t in ("Acts", "Ancients", "Ascension", "Bosses", "Cards", "Elites", "Gold",
                         "Map Locations", "Mechanics", "Monsters", "Multiplayer", "Neow", "Potions",
                         "Relics", "Rest Sites", "The Merchant", "Unknown Location")],
}
MODULES = ["Module:Events/data", "Module:Events/StS2 data", "Module:Ascension/data",
           "Module:Ascension/StS2 data", "Module:Ancients/data", "Module:Enemies/data",
           "Module:Relics/data", "Module:Relics/StS2 data", "Module:Potions/data", "Module:Potions/StS2 data"
           ] + [f"Module:Enemies/StS2 data/{s}" for s in
                ("Overgrowth", "Underdocks", "Hive", "Glory", "Elites", "Bosses", "Events")]


# ---------------------------------------------------------------- fetch
def fetch_pages(titles):
    pages, titles = {}, sorted(set(titles))
    for i in range(0, len(titles), 50):
        d = api(dict(action="query", prop="revisions", rvprop="content", rvslots="main",
                     titles="|".join(titles[i:i + 50])), post=True)
        for p in d["query"]["pages"].values():
            if "revisions" in p:
                pages[p["title"]] = p["revisions"][0]["slots"]["main"]["*"]
    return pages


def members(cat):
    return [m["title"] for m in list_all(dict(action="query", list="categorymembers", cmtitle=cat,
                                              cmnamespace="0|3000", cmlimit=500), "categorymembers")]


def embedded(tpl):
    return [m["title"] for m in list_all(dict(action="query", list="embeddedin", eititle=tpl,
                                              einamespace="0|3000", eilimit=500), "embeddedin")]


def fetch_raw():
    print("listing pages ...", file=sys.stderr)
    cargo = {
        "enemies": cargo_all("Enemies", "_pageName,Name,Game,HP,AscHP,Debut,Type"),
        "encounters": cargo_all("Encounters", "_pageName,Name,Enemies,Act,Type,Game"),
        "relics": cargo_all("Relics", "_pageName,Name,Game,Rarity,ExclusiveTo,AncientSource,EventSource,"
                                      "Cost,Description,Tags,Requirements"),
        "potions": cargo_all("Potions", "_pageName,Name,Game,Rarity,ExclusiveTo,Description"),
        "patches": cargo_all("Patches", "_pageName,Version,Type,ReleaseDate", where="Sequel=2"),
    }
    enemy_titles = set(embedded("Template:Enemy Infobox")) | {r["_pageName"] for r in cargo["enemies"]}
    event_titles = set(members("Category:Events")) | set(embedded("Template:Event Infobox"))
    ancient_titles = set(members("Category:Ancients"))
    print(f"fetching {len(enemy_titles)} enemy, {len(event_titles)} event pages + rule pages ...",
          file=sys.stderr)
    return {
        "cargo": cargo,
        "enemy_pages": fetch_pages(enemy_titles),
        "event_pages": fetch_pages(event_titles | ancient_titles),
        "rule_pages": fetch_pages(RULE_PAGES[1] + RULE_PAGES[2] + ACT_PAGES[1] + ACT_PAGES[2]),
        "modules": fetch_pages(MODULES),
        "categories": {c: members(c) for c in ("Category:Monsters", "Category:Elites",
                                                "Category:Bosses", "Category:Minions")},
    }


# ---------------------------------------------------------------- Lua data modules
class Lua:
    """Just enough of a Lua table-constructor parser for the wiki's data modules."""

    def __init__(self, s):
        self.s, self.i = s, 0

    def ws(self):
        s = self.s
        while self.i < len(s):
            if s[self.i].isspace():
                self.i += 1
            elif s.startswith("--", self.i):
                m = re.match(r"--\[(=*)\[", s[self.i:])
                if m:
                    end = s.find("]" + m.group(1) + "]", self.i)
                    self.i = len(s) if end < 0 else end + len(m.group(1)) + 2
                else:
                    nl = s.find("\n", self.i)
                    self.i = len(s) if nl < 0 else nl + 1
            else:
                return

    def value(self):
        self.ws()
        s, c = self.s, self.s[self.i]
        if c == "{":
            return self.table()
        if c in "\"'":
            return self.string(c)
        m = re.match(r"\[(=*)\[", s[self.i:])
        if m:
            end = s.find("]" + m.group(1) + "]", self.i)
            v = s[self.i + len(m.group(0)):end]
            self.i = end + len(m.group(1)) + 2
            return v
        m = re.match(r"-?\d+(\.\d+)?|true|false|nil", s[self.i:])
        if m:
            self.i += len(m.group(0))
            t = m.group(0)
            return {"true": True, "false": False, "nil": None}.get(t, float(t) if "." in t else
                                                                    (int(t) if t[-1].isdigit() else t))
        m = re.match(r"[^,;}\n]+", s[self.i:])  # expression we do not evaluate
        self.i += len(m.group(0))
        return None

    def string(self, q):
        s, out = self.s, []
        self.i += 1
        while s[self.i] != q:
            if s[self.i] == "\\":
                nxt = s[self.i + 1]
                out.append({"n": "\n", "t": "\t"}.get(nxt, nxt))
                self.i += 2
            else:
                out.append(s[self.i])
                self.i += 1
        self.i += 1
        return "".join(out)

    def table(self):
        self.i += 1
        d, arr = {}, []
        while True:
            self.ws()
            if self.s[self.i] == "}":
                self.i += 1
                break
            m = re.match(r"([A-Za-z_]\w*)\s*=(?!=)", self.s[self.i:])
            if self.s[self.i] == "[" and not re.match(r"\[=*\[", self.s[self.i:]):
                self.i += 1
                k = self.value()
                self.ws()
                self.i += 1  # ]
                self.ws()
                self.i += 1  # =
                d[k] = self.value()
            elif m:
                self.i += len(m.group(0))
                d[m.group(1)] = self.value()
            else:
                arr.append(self.value())
            self.ws()
            if self.i < len(self.s) and self.s[self.i] in ",;":
                self.i += 1
        if d and arr:
            d.update({i + 1: v for i, v in enumerate(arr)})
        return d if d else arr


def lua_data(text):
    m = re.search(r"(?:return|=)\s*\{", text)
    return Lua(text[m.end() - 1:]).table() if m else {}


# ---------------------------------------------------------------- wikitext helpers
def iter_templates(text, name):
    """(start, end, body) of every top-level {{name ...}}."""
    pat = re.compile(r"\{\{\s*" + re.escape(name) + r"\s*[|}\n]")
    i = 0
    while True:
        m = pat.search(text, i)
        if not m:
            return
        depth, j = 0, m.start()
        while j < len(text):
            if text.startswith("{{", j):
                depth += 1
                j += 2
            elif text.startswith("}}", j):
                depth -= 1
                j += 2
                if depth == 0:
                    break
            else:
                j += 1
        yield m.start(), j, text[m.start() + 2:j - 2]
        i = j


def asc_text(s):
    """{{Asc|2|12}} / {{Asc2|9|11}} -> 'A2: 12' (nesting-aware); {{Asc|15|Ascension}} -> 'Ascension 15'."""
    for name in ("Asc2", "Asc"):
        while True:
            hit = next(iter_templates(s, name), None)
            if not hit:
                break
            a, b, body = hit
            _, p = split_params(body)
            lvl, val = p.get("1", "").strip(), p.get("2", "").strip()
            if not val:
                rep = f"A{lvl}"
            elif to_plain(val).lower().startswith("ascension"):
                rep = f"Ascension {lvl}"
            else:
                rep = f"A{lvl}: {val}"
            s = s[:a] + rep + s[b:]
    return s


def fix_choices(t):
    """Wiki '(base;A2: x;A17: y)' groups (plain text) -> 'base (A2: x; A17: y)'."""
    def rep(m):
        inner, opts, depth, cur = m.group(1), [], 0, ""
        for ch in inner:
            depth += (ch == "(") - (ch == ")")
            if ch == ";" and depth == 0:
                opts.append(cur.strip())
                cur = ""
            else:
                cur += ch
        opts.append(cur.strip())
        if len(opts) < 2 or re.match(r"A\d+:", opts[0]) or \
                not all(re.search(r"\bA\d+\b", o) for o in opts[1:] if o):
            return m.group(0)
        out = []
        for o in opts[1:]:
            if o:
                lv = re.search(r"\bA(\d+):?\s*", o)
                out.append(f"A{lv.group(1)}: {(o[:lv.start()] + o[lv.end():]).strip()}")
        return (f"{opts[0]} " if opts[0] else "") + f"({'; '.join(out)})"
    for _ in range(4):
        t2 = re.sub(r"\(((?:[^()]|\([^()]*\))*;(?:[^()]|\([^()]*\))*)\)", rep, t)
        if t2 == t:
            break
        t = t2
    return t


def plain(s, limit=None):
    s = re.sub(r"(\{\{\s*(?:M|E|R|P|Int)2?\s*\|[^{}]*?)\|\s*[12]\s*\}\}", r"\1}}", s or "")  # sequel flag
    s = re.sub(r"\|-\|\s*([^=|\n]+?)\s*=", r" [\1] ", s)  # <tabber> tab headers
    t = fix_choices(to_plain(asc_text(s)))
    t = re.sub(r"\{\{[^{}]*\}\}\s*", "", t)  # empty/unknown leftovers such as {{R: }}
    t = re.sub(r"\(\s*\)", "", t).strip()
    t = re.sub(r"\s+([.,;:])", r"\1", t)
    if limit and len(t) > limit:
        t = t[:limit].rsplit(" ", 1)[0] + " ..."
    return t


def base_only(t):
    """Drop ascension parentheticals: 'Deals 11 (A2: 12) damage' -> 'Deals 11 damage'."""
    return re.sub(r"\s*\((?:A\d+: [^()]*|[^()]*A\d+: [^()]*)\)", "", t)


def section(text, heading, level=2):
    """Body of '== heading ==' (up to the next heading of the same or higher level)."""
    eq = "=" * level
    m = re.search(rf"^{eq}\s*{re.escape(heading)}\s*{eq}\s*$", text, re.M)
    if not m:
        return ""
    nxt = re.search(rf"^={{1,{level}}}[^=].*?={{1,{level}}}\s*$", text[m.end():], re.M)
    return text[m.end():m.end() + nxt.start()] if nxt else text[m.end():]


def wikitable_rows(tbl):
    """Rows of a {| ... |} table as lists of cell wikitext (one cell per '|' line; continuation lines join)."""
    rows = []
    for chunk in re.split(r"^\|-.*$", tbl, flags=re.M)[1:]:
        cells = []
        for line in chunk.split("\n"):
            if line.startswith("|}"):
                break
            if line.startswith("|") or line.startswith("!"):
                cells += split_top(line[1:], r"\|\||!!")
            elif cells:
                cells[-1] += "\n" + line
        if cells:
            rows.append([c.strip() for c in cells])
    return rows


def split_top(s, sep):
    """Split on regex sep only outside {{templates}}."""
    out, depth, cur, i = [], 0, "", 0
    while i < len(s):
        if s.startswith("{{", i) or s.startswith("}}", i):
            depth += 1 if s[i] == "{" else -1
            cur += s[i:i + 2]
            i += 2
            continue
        m = re.match(sep, s[i:], re.I) if depth == 0 else None
        if m:
            out.append(cur)
            cur, i = "", i + len(m.group(0))
            continue
        cur += s[i]
        i += 1
    return out + [cur]


def norm(s):
    return re.sub(r"[^a-z0-9()]", "", s.lower().replace(STS2_PREFIX.lower(), ""))


def page_short(title):
    return title.replace(P2, "")


# ---------------------------------------------------------------- enemies
INTENT_TOKENS = {  # wiki intent icon code (trailing size digit dropped) -> schema labels
    "Attack": ["attack"], "DebuffAttack": ["attack", "debuff"], "BuffAttack": ["attack", "buff"],
    "DefendAttack": ["attack", "defend"], "Defend": ["defend"], "DefendBuff": ["defend", "buff"],
    "DebuffDefend": ["defend", "debuff"], "Buff": ["buff"], "Debuff": ["debuff"], "DebuffStrong": ["debuff"],
    "StatusCard": ["status"], "CardDebuff": ["affliction"], "Summon": ["summon"], "Heal": ["heal"],
    "Escape": ["escape"], "Sleep": ["sleep"], "Stun": ["stun"], "Stunned": ["stun"], "Unknown": ["unknown"],
    "DeathBlow": ["deathblow"],
}
INTENT_ORDER = ["attack", "defend", "buff", "debuff", "status", "affliction", "summon", "heal", "escape",
                "sleep", "stun", "deathblow", "unknown"]


def intent_kind(codes):
    """Wiki intent icon codes (e.g. 'Attack3, Buff', 'DefendBuff', 'StatusCard') -> 'attack_buff' etc."""
    parts = []
    for c in re.split(r"[,\s]+", codes or ""):
        for k in INTENT_TOKENS.get(re.sub(r"\d+$", "", c.strip()), ["unknown"] if c.strip() else []):
            if k not in parts:
                parts.append(k)
    parts.sort(key=INTENT_ORDER.index)
    return "_".join(parts) or "unknown"


def damage_hits(effect):
    """Base (A0) damage and hit count from a move text; damage may be [min, max] for 'N = between a-b'."""
    b = base_only(effect)
    m = re.search(r"Deals? (\d+)\s*(?:damage\s*)?[x×]\s*(\d+|N)\b", b)
    if m:
        return int(m.group(1)), int(m.group(2)) if m.group(2) != "N" else None
    m = re.search(r"Deals? (\d+) damage (\d+) times", b)
    if m:
        return int(m.group(1)), int(m.group(2))
    m = re.search(r"Deals? (\d+) damage", b)
    if m:
        return int(m.group(1)), 1
    m = re.search(r"Deals? N damage.*?N = (?:Number )?between (\d+)\s*-\s*(\d+)", b)
    if m:
        return [int(m.group(1)), int(m.group(2))], 1
    return None, None


def hp_range(v):
    v = plain(v)
    nums = [int(x) for x in re.findall(r"\d+", v)]
    if len(nums) == 2 and re.fullmatch(r"\s*\d+\s*[-–~]\s*\d+\s*", v):
        return nums
    if len(nums) == 1 and re.fullmatch(r"\s*\d+\s*", v):
        return [nums[0], nums[0]]
    return v or None


def area_of(game, debut):
    d = plain(debut)
    if game == 1:
        return f"{d} / {ACTS[1][d]}" if d in ACTS[1] else d
    return f"{ACTS[2][d]} / {d}" if d in ACTS[2] else d


def power_defs(text):
    out = {}
    for _, _, body in iter_templates(text, "Power Infobox"):
        _, p = split_params(body)
        if p.get("Name"):
            out[p["Name"]] = plain(p.get("Description", ""))
    return out


STOP_HEADINGS = re.compile(r"^(?:Found With|In Party|Notes|Trivia|Strateg|Useful|Synerg|Gallery|Update History|"
                           r"Names in|Dialogue|Lore|Encounters?\b|Bugs|Achievement|Interactions|Tips)", re.I)


def parse_enemy_page(title, text):
    game = 2 if title.startswith(P2) else 1
    boxes = [(s, e, split_params(b)[1]) for s, e, b in iter_templates(text, "Enemy Infobox")]
    starts = [(s, e, split_params(b)[1].get("1", "")) for s, e, b in iter_templates(text, "Intents Table/start")]
    ends = [s for s, _, _ in iter_templates(text, "Intents Table/end")]
    pdefs = power_defs(text)
    tables = []
    for s, e, label in starts:
        end = next((x for x in ends if x > e), len(text))
        moves = []
        for _, _, body in iter_templates(text[e:end], "Intents Table/row"):
            _, p = split_params(body)
            eff = plain(p.get("Effect", ""))
            dmg, hits = damage_hits(eff)
            mv = {"name": plain(p.get("Name", "")), "intent": intent_kind(p.get("Intent")),
                  "damage": dmg, "hits": hits, "effect": eff}
            if p.get("Intent"):
                mv["intent_icons"] = p["Intent"].strip()
            moves.append(mv)
        # pattern prose: text between the 'Pattern' heading and the table + everything after the table
        # (sub-headings such as 'Phase One' included) up to the next heading of the same or higher level
        heads = list(re.finditer(r"^(=+)\s*([^=\n]+?)\s*=+\s*$", text[:s], re.M))
        level = len(heads[-1].group(1)) if heads else 2
        pre = text[heads[-1].end() if heads else 0:s]
        pre = "" if re.search(r"\{\{\s*Enemy Infobox", pre) else pre
        tail = re.sub(r"^\{\{\s*Intents Table/end\s*\}\}", "", text[end:])
        post, pos = [], 0
        for h in re.finditer(r"^(=+)\s*([^=\n]+?)\s*=+\s*$|\{\{\s*Intents Table/start|"
                             r"\{\{\s*\w*Nav\s*\}\}|\{\{\s*Enemy Infobox", tail, re.M):
            post.append(tail[pos:h.start()])
            if not h.group(1) or len(h.group(1)) <= level or STOP_HEADINGS.match(h.group(2)):
                break
            post.append(f"\n[{plain(h.group(2))}] ")
            pos = h.end()
        else:
            post.append(tail[pos:])
        post = re.sub(r"\[\[File:[^\]]*\]\]", "", "".join(post))
        post = re.sub(r"^\{\|.*?^\|\}", "(table omitted)", post, flags=re.S | re.M)
        pattern = plain(pre + "\n" + post, limit=3000)
        if not pattern and len(moves) == 1:
            pattern = f"(single move) Uses {moves[0]['name']} every turn."
        tables.append({"label": plain(label), "pos": s, "moves": moves, "pattern": pattern})

    out = []
    for bs, be, p in boxes:
        name = plain(p.get("Name", ""))
        # the intents table for this infobox: same label, else label without '(Hard)'-like suffix,
        # else the first table after this infobox, else the only table on the page
        cands = [t for t in tables if norm(t["label"]) == norm(name)] or \
                [t for t in tables if t["label"] and norm(name).startswith(norm(t["label"]))] or \
                [t for t in tables if t["pos"] > bs and not any(bs < b2 < t["pos"] for b2, _, _ in boxes)] or \
                (tables if len(tables) == 1 else [])
        tbl = cands[0] if cands else {"moves": [], "pattern": "", "label": ""}
        passives = []
        for line in split_top(p.get("Powers", "") or "", r"<br\s*/?>"):
            t = plain(line)
            if t:
                pn = next((k for k in pdefs if t.startswith(k)), None)
                passives.append(f"{t} — {pdefs[pn]}" if pn and pdefs[pn] else t)
        out.append({
            "id": f"sts{game}.{slug(name)}",
            "name": name,
            "category": (p.get("Type") or "").strip().lower() or "normal",
            "area": area_of(game, p.get("Debut", "")),
            "hp": {"base": hp_range(p.get("HP", "")), "ascension": hp_range(p.get("AscHP", ""))},
            "moves": tbl["moves"],
            "pattern": tbl["pattern"],
            "passives": passives,
            "encounters": [],
            "_page": title,
            "_power_defs": pdefs,
        })
    return out


def build_enemies(raw):
    enemies, excluded = {1: {}, 2: {}}, {1: [], 2: []}
    for title, text in sorted(raw["enemy_pages"].items()):
        if title.startswith(("Board Game:", "User:")):
            continue
        game = 2 if title.startswith(P2) else 1
        if re.search(r"\{\{\s*Deprecated Content", text):
            excluded[game] += [plain(split_params(b)[1].get("Name", "")) for b in
                               find_templates(text, "Enemy Infobox")]
            continue
        for e in parse_enemy_page(title, text):
            if e["id"] in enemies[game]:
                e["id"] += "_" + slug(page_short(title))
            enemies[game][e["id"]] = e
    return enemies, excluded


# ---------------------------------------------------------------- encounters
GENERIC = {  # wiki shorthand -> enemy names
    1: {"louse": ["Red Louse", "Green Louse"], "slaver": ["Blue Slaver", "Red Slaver"],
        "mediumslime": ["Acid Slime (M)", "Spike Slime (M)"], "fungi": ["Fungi Beast"],
        "shapes": ["Repulsor", "Exploder", "Spiker"], "thieves": ["Looter", "Mugger"],
        "3sentries": ["Sentry"]},
    2: {"slimes(m)": ["Leaf Slime (M)", "Twig Slime (M)"], "mediumslime": ["Leaf Slime (M)", "Twig Slime (M)"]},
}


OVERRIDES = {1: {"Jaw Worm Horde": ["Jaw Worm (Hard)"]}, 2: {}}  # encounter -> enemies, where matching fails


def match_enemies(game, txt, enemies, page_of):
    """Enemy names mentioned in an encounter row (names, links, {{M|..}} targets, shorthand).
    Names match case-sensitively with spaces removed ('Spike Slime(M)' ok, 'randomly chosen' is not Chosen)."""
    txt = re.sub(r"\[\[File:[^\]]*\]\]", "", txt)
    hay = re.sub(r"\s+", "", txt + " " + plain(txt))
    found = []
    for e in sorted(enemies.values(), key=lambda e: -len(e["name"])):
        k = re.sub(r"\s+", "", e["name"])
        if k and k in hay and e["name"] not in found:
            found.append(e["name"])
            hay = hay.replace(k, "#")
    n = norm(txt)
    for k, names in GENERIC[game].items():
        if k in n:
            found += [x for x in names if x not in found]
    if not found:  # fall back to every enemy on a linked page
        for tgt in re.findall(r"\{\{\s*(?:M2?|2)\s*\|([^|}#]+)|\[\[(?:sts2:|StS2:)?([^|\]#]+)", txt):
            t = norm(tgt[0] or tgt[1])
            found += [e["name"] for e in enemies.values() if norm(page_short(e["_page"])) == t
                      and e["name"] not in found]
    return found


def stS1_encounters(raw, enemies):
    pages = raw["rule_pages"]
    by_act = {}
    mon = pages.get("Monsters", "")
    for m in re.finditer(r"^==\s*(Act \d): ([^=]+?)\s*==\s*$", mon, re.M):
        body = section(mon, f"{m.group(1)}: {m.group(2)}")
        act = f"{m.group(1)} / {m.group(2)}"
        d = by_act.setdefault(act, {"easy": [], "hard": [], "elite": [], "boss": [], "event": []})
        for pool in ("Easy", "Hard"):
            sec = section(body, f"{pool} Pool", 3)
            for row in wikitable_rows(sec):
                if len(row) < 2:
                    continue
                name = plain(row[0])
                d[pool.lower()].append({"name": name, "weight": float(row[1]) if re.fullmatch(
                    r"[\d.]+", row[1]) else row[1], "enemies": OVERRIDES[1].get(name) or match_enemies(
                        1, row[0] + " " + " ".join(row[2:]), enemies, None),
                    "details": plain(" ".join(row[2:]))})
    for kind, page, cls in (("elite", "Elites", "elite-name"), ("boss", "Bosses", "boss-name")):
        txt = pages.get(page, "")
        for m in re.finditer(r"^==\s*(Act \d): ([^=]+?)\s*==\s*$", txt, re.M):
            act = f"{m.group(1)} / {m.group(2)}"
            d = by_act.setdefault(act, {"easy": [], "hard": [], "elite": [], "boss": [], "event": []})
            for nm in re.findall(rf'<div class="{cls}">(.*?)</div>', section(txt, f"{m.group(1)}: {m.group(2)}")):
                d[kind].append(encounter_from_link(1, nm, enemies, kind))
    return by_act


def encounter_from_link(game, wikitext, enemies, kind):
    """Elite/boss list entry ([[Sentry|3 Sentries]] / {{2|The Kin}}) -> encounter with that page's enemies."""
    tgt = re.search(r"\{\{\s*2\s*\|([^|}#]+)|\[\[(?:Slay_the_Spire_2:|Slay the Spire 2:)?([^|\]#]+)", wikitext)
    page = (tgt.group(1) or tgt.group(2)).strip().replace("_", " ") if tgt else plain(wikitext)
    full = (P2 if game == 2 else "") + page
    on_page = [e for e in enemies.values() if e["_page"] == full]
    main = [e["name"] for e in on_page if e["category"] in (kind, "minion")]
    if not main:
        main = [e["name"] for e in on_page]
    if not main:
        main = match_enemies(game, wikitext, enemies, None)
    return {"name": plain(wikitext), "enemies": main, "details": ""}


def stS2_encounters(raw, enemies):
    by_act = {}
    for title in ACT_PAGES[2]:
        txt = raw["rule_pages"].get(title, "")
        name = page_short(title)
        act = f"{ACTS[2][name]} / {name}"
        d = by_act.setdefault(act, {"easy": [], "hard": [], "elite": [], "boss": [], "event": []})
        for s, e, body in iter_templates(txt, "Encounter Table/start"):
            _, p = split_params(body)
            kind = {"Easy": "easy", "Normal": "hard", "Event": "event"}.get(p.get("Type", ""), p.get("Type", ""))
            end = txt.find("Encounter Table/end", e)
            for _, _, rb in iter_templates(txt[e:end], "Encounter Table/row"):
                _, r = split_params(rb)
                d.setdefault(kind, []).append({
                    "name": plain(r.get("Name", "")),
                    "enemies": match_enemies(2, r.get("Details", "") + " " + r.get("Enemies", ""), enemies, None),
                    "details": plain(r.get("Details", ""))})
        for kind, head in (("elite", "Elites"), ("boss", "Bosses")):
            for nm in re.findall(r'<div class="elite-name">(.*?)</div>', section(txt, head)):
                d[kind].append(encounter_from_link(2, nm, enemies, kind))
    return by_act


def event_fights(raw, evs, enemies, by_act):
    """StS1 event fights (the act pages do not list them): enemies named in an event's Options section."""
    out = []
    for ev in evs:
        text = raw["event_pages"].get(ev["name"] + " (Event)") or raw["event_pages"].get(ev["name"], "")
        opts = section(text, "Options")
        names = [e["name"] for e in enemies.values() if e["_page"] == ev["name"]]
        for t in re.findall(r"\{\{\s*M\s*\|([^|}]+)", opts):
            names += [e["name"] for e in enemies.values() if norm(e["name"]) == norm(t) and e["name"] not in names]
        for a in re.findall(r"Elites#(Act \d)", opts):  # 'an Act 1 Elite returns' (Dead Adventurer)
            for act, pools in by_act.items():
                if act.startswith(a + " /"):
                    names += [n for enc in pools["elite"] for n in enc["enemies"] if n not in names]
        if names:
            fight = [c for c in ev["choices"] if re.search(r"fight|battle|combat|elite|monster", c, re.I)]
            out.append((ev["area"], {"name": ev["name"], "enemies": names,
                                     "details": "event fight: " + ("; ".join(fight)[:220] or "see event")}))
    return out


def attach_encounters(enemies, by_act):
    for act, pools in by_act.items():
        for kind, encs in pools.items():
            for enc in encs:
                for n in enc["enemies"]:
                    for e in enemies.values():
                        if e["name"] == n:
                            label = f"{act.split(' / ')[0]} {kind}: {enc['name']}"
                            if label not in e["encounters"]:
                                e["encounters"].append(label)


# ---------------------------------------------------------------- relics / potions / events
def relics(raw, game):
    out = []
    for r in raw["cargo"]["relics"]:
        if r["Game"] != str(game):
            continue
        x = {"name": r["Name"], "rarity": r["Rarity"],
             "character": None if r["ExclusiveTo"] in ("Any", "", None) else r["ExclusiveTo"],
             "effect": plain(r["Description"])}
        if r.get("AncientSource") not in (None, "", "-"):
            x["ancient"] = r["AncientSource"]
        if r.get("EventSource") not in (None, "", "-"):
            x["event"] = plain(r["EventSource"])
        if r.get("Requirements"):
            x["requirements"] = plain(r["Requirements"])
        out.append(x)
    return sorted(out, key=lambda x: (x["rarity"], x["name"]))


def potions(raw, game):
    out = []
    for r in raw["cargo"]["potions"]:
        if r["Game"] != str(game):
            continue
        x = {"name": r["Name"], "rarity": r["Rarity"],
             "character": None if r["ExclusiveTo"] in ("Any", "", None) else r["ExclusiveTo"],
             "effect": plain(resolve_choices(r["Description"].replace("(;", " (;"), 0))}
        alt = plain(resolve_choices(r["Description"].replace("(;", " (;"), 1))
        if alt != x["effect"]:
            x["effect_doubled"] = alt  # wiki '(a;b)' = normal;with Sacred Bark
        out.append(x)
    return sorted(out, key=lambda x: (x["rarity"], x["name"]))


def event_options(text):
    """'Option: outcome (+ first note)' per {{Frame|Option}} in the page's Options section."""
    sec = section(text, "Options") or section(text, "Choices")
    opts = []
    for chunk in re.split(r"^(?=\s*\*?\s*\{\{\s*Frame\s*\|)", sec, flags=re.M):
        m = re.match(r"\s*\*?\s*\{\{\s*Frame\s*\|([^}|]*)[^}]*\}\}", chunk)
        if not m:
            continue
        lines = re.split(r"^=", chunk[m.end():], maxsplit=1, flags=re.M)[0].split("\n")
        head = [lines[0]] + [l for l in lines[1:] if l.strip() and not l.lstrip().startswith(("*", "<br", "="))]
        note = next((l.lstrip("* ") for l in lines[1:] if re.match(r"\s*\*[^*]", l)), "")
        body = plain(" ".join(head[:2]) + " " + note, limit=260)
        body = re.sub(r"\s*You are then given the option to Leave\.?", "", body).strip()
        label = plain(m.group(1))
        if label.lower() == "leave" and not body:
            continue
        opts.append(f"{label}: {body}" if body else label)
    return opts


def act_event_lists(raw, game):
    """Event name -> acts, from the act pages' event lists."""
    out = defaultdict(list)
    for title in ACT_PAGES[game]:
        txt = raw["rule_pages"].get(title, "")
        act = page_short(title)
        label = f"{ACTS[2][act]} - {act}" if game == 2 else act
        for e in re.findall(r"\{\{\s*E2?\s*\|([^|}]+)", section(txt, "Events")):
            if label not in out[e.strip()]:
                out[e.strip()].append(label)
    return out


def events(raw, game):
    mod = lua_data(raw["modules"].get("Module:Events/data" if game == 1 else "Module:Events/StS2 data", ""))
    pages = raw["event_pages"]
    by_page = act_event_lists(raw, game)
    out = []
    for key, d in sorted(mod.items()):
        if not isinstance(d, dict):
            continue
        name = d.get("Name") or key
        title = (P2 if game == 2 else "") + re.sub(r"\s*\(\?\)$", "", name)
        text = pages.get(title + " (Event)") or pages.get(title) or ""
        name = page_short(title)
        acts = d.get("Act")
        acts = acts if isinstance(acts, list) else ([acts] if acts else [])
        if game == 1:
            area = ", ".join(f"Act {a}" for a in acts) if acts else "All acts"
        else:
            area = ", ".join(f"Act {a}" for a in acts) if acts else ", ".join(by_page.get(name, [])) or "?"
        e = {"name": name, "area": area, "summary": plain(d.get("Description", ""), limit=400),
             "choices": event_options(text)}
        page = title + " (Event)" if pages.get(title + " (Event)") else title
        if page != title:
            e["wiki_page"] = page_short(page)
        if d.get("Shrine"):
            e["shrine"] = True
        if not text:
            e["page_missing"] = True
        out.append(e)
    return out, set(mod)


def ancients(raw):
    mod = lua_data(raw["modules"].get("Module:Ancients/data", ""))
    out = []
    for name, d in mod.items():
        offers = sorted(r["Name"] for r in raw["cargo"]["relics"]
                        if r["Game"] == "2" and r.get("AncientSource") == name)
        out.append({"name": name, "title": d.get("Subname"), "acts": d.get("Acts"), "relic_offers": offers})
    return out


# ---------------------------------------------------------------- rules
def ascension(raw, game):
    mod = lua_data(raw["modules"].get("Module:Ascension/data" if game == 1 else "Module:Ascension/StS2 data", ""))
    page = raw["rule_pages"].get("Ascension" if game == 1 else P2 + "Ascension", "")
    desc = {}
    for row in wikitable_rows(page):
        if len(row) >= 3:
            lvl = re.search(r"\d+", row[0])
            if lvl:
                desc[int(lvl.group(0))] = (plain(row[1]), plain(row[2]))
    out = []
    keys = sorted(k for k in (mod.keys() if isinstance(mod, dict) else range(1, len(mod) + 1)))
    for k in keys:
        v = mod[k] if isinstance(mod, dict) else mod[k - 1]
        name, d = desc.get(k, ("", ""))
        out.append({"level": k, "effect": v, "name": name if name and name.rstrip(".") != v.rstrip(".") else None,
                    "detail": d if d and d != "—" else None})
    return out


RULES = {
    1: {
        "run": {
            "source": "Mechanics, Acts, Map Generation, Bosses",
            "acts": "3 acts (Exordium, The City, The Beyond) of 17 floors each (bosses on floors 16/33/50, A20 a "
                    "second Act 3 boss on 51); optional Act 4 (The Ending: rest, shop, elite, Heart on floor 55, "
                    "A20: 56) needs all 3 keys. The run starts with Neow.",
            "start": "99 Gold, 3 potion slots (A11: 2), starter relic, 10-12 card starter deck, 3 Energy, draw 5. "
                     "Hand limit 10.",
            "act_transition": "Act 1/2 boss -> card reward (3 Rares) + Gold + maybe potion; next floor (17/34) is "
                              "the Boss Chest (choose 1 of 3 Boss relics or skip). Heal 100% of missing HP "
                              "(A5: 75%) after the boss. Act 3 boss ends the run unless all 3 keys are held.",
        },
        "map": {
            "source": "Map Generation, Map Locations, Monsters",
            "layout": "Each act: 15 map rows + boss (floor 16) + boss chest (floor 17). Up to 6 rooms per row; "
                      "each room has 1-3 paths to the next row; paths are revealed one act at a time.",
            "fixed_floors": "Row 1 = normal fights from the easy pool; row 9 = Treasure on every node; "
                            "row 15 = Rest Site on every node; 16 = boss.",
            "room_odds": {"monster": 0.53, "unknown_event": 0.22, "rest": 0.12, "elite": 0.08, "merchant": 0.05,
                          "note": "A1: ~60% more elites. Treasure only on the fixed row 9 (and from ? rooms)."},
            "constraints_not_on_wiki": "Not on wiki (game-code knowledge, unverified): 7-column grid with 6 "
                                       "path starts; no Elite or Rest on floors 1-5; no Rest on floor 14; a room "
                                       "cannot follow a parent of the same special type (Elite, Rest, Merchant, "
                                       "Treasure) and branches from one node avoid repeating a special type.",
            "monster_pools": "First 3 fights in Act 1 (2 in Acts 2-3) come from the easy pool, the rest from the "
                             "hard pool (weighted); the same encounter cannot recur within the next 2 fights; a "
                             "few hard-pool fights are banned right after a similar easy fight.",
            "elite_rules": "Same elite may repeat within an act but never twice in a row.",
            "unknown_room": "? resolves on entry: base Monster 10%, Shop 3%, Treasure 2%, else Event; each type "
                            "not rolled grows by its base value and resets when rolled (values from the StS2 "
                            "wiki page; the StS1 page's odds section is empty but the game uses the same "
                            "scheme). Shrine events are 25% of event rolls. Juzu Bracelet removes Monster.",
        },
        "rewards": {
            "source": "Cards, Gold, Potions, Relics, Elites, Bosses, Mechanics",
            "card_reward": "Choose 1 of 3 (or skip). Rarity base chances normal 60/37/3% (C/U/R), elite 50/40/10%, "
                           "shop 54/37/9%. Rare pity: offset starts at -5%, +1% per Common rolled, resets on a "
                           "Rare (first reward of an act cannot be Rare). Act 1 rewards are never upgraded; from "
                           "Act 2 some reward cards come upgraded (A12: half as often) - 25%/50% in Act 2/3 per the "
                           "StS2 page, assumed equal in StS1 (not on the StS1 wiki).",
            "gold": "Normal 10-20, Elite 25-35, Boss 95-105 (A13: 71-79). Start 99.",
            "potion_drop": "40% after combat; -10% after a drop, +10% after none; resets each act. "
                           "Potion rarity 65/25/10% (C/U/R).",
            "elite": "Relic (C/U/R 50/33/17%) + 25-35 Gold + card reward (elite odds) + maybe potion.",
            "chests": "Small 50% / Medium 33% / Large 17% spawn. Relic rarity small 75/25/0, medium 35/50/15, "
                      "large 0/75/25 (C/U/R). Gold chance 50/35/50% for 23-27 / 45-55 / 68-82.",
            "boss_relics": "Boss Chest after Act 1/2 boss: pick 1 of 3 Boss relics (strong, usually with a drawback) "
                           "or skip. Starter relic has a Boss-tier upgrade (e.g. Burning Blood -> Black Blood).",
        },
        "shop": {
            "source": "The Merchant",
            "stock": "5 class cards (2 Attack, 2 Skill, 1 Power; one at 50% off), 2 colorless (Uncommon + Rare, "
                     "+20% price), 3 relics (rightmost always a Shop relic), 3 potions, 1 card removal.",
            "prices": {"card_common": "45-55", "card_uncommon": "68-83", "card_rare": "135-165",
                       "colorless_uncommon": "81-99", "colorless_rare": "162-198",
                       "potion": "48-53 / 71-79 / 95-105 (C/U/R)",
                       "relic": "Common/Shop 143-158, Uncommon 238-263, Rare 285-315",
                       "removal": "75, +25 per use (once per shop)", "ascension": "A16: everything +10%"},
        },
        "rest_site": {
            "source": "Rest Sites",
            "options": "Rest (heal 30% max HP) or Smith (upgrade 1 card); Recall (take Ruby Key) once Act 4 is "
                       "unlocked; relics add Lift (Girya, +1 Str up to 3x), Toke (Peace Pipe, remove a card), "
                       "Dig (Shovel, relic). One action per site; the room before each boss is always a rest site.",
        },
        "neow": {
            "source": "Neow",
            "rule": "Run start bonus. If the last run reached the Act 1 boss: 4 options (card bonus; small bonus "
                    "such as +Max HP/100 Gold/3 potions/common relic/Neow's Lament; a drawback+big bonus combo; "
                    "swap starter relic for a random Boss relic). Otherwise 2 options (+Max HP or Neow's Lament: "
                    "enemies in the next 3 combats have 1 HP).",
        },
        "keys_heart": {
            "source": "Mechanics, Elites, Bosses, Corrupt Heart",
            "rule": "Unlocked after winning with Ironclad, Silent and Defect. Ruby Key = Recall at a rest site "
                    "(costs that rest); Emerald Key = defeat the burning 'super elite' (one per act until taken; "
                    "buffed with +Str, +25% HP, Metallicize or Regenerate); Sapphire Key = take it from a chest "
                    "instead of the relic. With all 3, Act 4: rest + shop, then Spire Shield & Spire Spear "
                    "(elite), then the Corrupt Heart (floor 55; A20: 56).",
        },
        "elites_bosses": {
            "source": "Elites, Bosses",
            "rule": "3 possible bosses per act, one is shown on the map from the start. A20: two different Act 3 "
                    "bosses back to back. Act 3/4 bosses give no rewards.",
        },
    },
    2: {
        "run": {
            "source": "Acts, Mechanics, Ancients, Bosses",
            "acts": "3 acts. Act 1 is randomly Overgrowth or Underdocks; Act 2 Hive; Act 3 Glory. Every act starts "
                    "with an Ancient (Act 1 always Neow) and ends with a boss: floors 17 / 33 / 48 (A10: second "
                    "boss on 49), i.e. acts shrink 17 -> 16 -> 15 floors; multiplayer 16 / 31 / 45. Golden Compass "
                    "turns Act 2 into one 2-floor-longer path. Victory = beating the Act 3 boss (no Act 4 / keys).",
            "start": "99 Gold, 3 potion slots (A4: 2), starter relic, 10-12 card deck (5 characters), 3 Energy, "
                     "draw 5.",
            "act_transition": "Act 1/2 boss -> 100 Gold (A3: 75) + 3 Rare card choice + maybe potion. No boss "
                              "relic chest: the next act opens with an Ancient that heals 100% of missing HP "
                              "(A2: 80%) and offers 3 Ancient relics (must take one; cannot skip).",
        },
        "map": {
            "source": "Map Locations, Monsters, Elites, Unknown Location, Rest Sites (update history)",
            "layout": "Same 7 room types as StS1 (Monster, Elite, Rest, Unknown, Treasure, Merchant, Boss); the "
                      "wiki's Map Generation page is empty. Treasure at the act midpoint; a Rest Site always "
                      "precedes the boss; Act 1/2 have about 6-7 rest sites (patch notes).",
            "monster_pools": "First 3 fights in Act 1 (2 in Acts 2-3) from the easy pool (StS2 Act 1 lists 3-4 easy "
                             "encounters, 3 picked per run), then the normal pool with equal probability. The same "
                             "encounter never repeats within an act.",
            "elite_rules": "All 3 elites of the act must be met before any repeats; never the same elite twice "
                           "in a row.",
            "unknown_room": "Base Monster 10%, Treasure 2%, Shop 3%, Event 85%; non-rolled types grow by their "
                            "base value, reset when rolled and at each new act. No Shop right after a Shop. "
                            "Each event can occur once per run.",
        },
        "rewards": {
            "source": "Cards, Gold, Potions, Relics, Elites, Map Locations",
            "card_reward": "Choose 1 of 3. Base C/U/R normal 60/37/3%, elite 50/40/10%, shop 54/37/9%. Rare offset "
                           "starts -5%, +1% per non-Rare card generated (A7: +0.5%, base Rare halved), max +40%, "
                           "reset on Rare; skipped rewards still count. Boss rewards are all Rare. Upgraded "
                           "non-rare reward cards: Act 1 0%, Act 2 25%, Act 3 50% (A7: halved).",
            "gold": "Normal 10-20 (A3: 7-15), Elite 35-45 (A3: 26-34), Boss 100 (A3: 75), chest 42-53 "
                    "(A3: 32-40). Start 99.",
            "potion_drop": "40% at run start, -10% after a drop / +10% after none; elites +12.5%. Rarity 65/25/10%.",
            "elite": "Relic (C/U/R 50/33/17%) + 35-45 Gold + card reward + maybe potion.",
            "chests": "One relic (50/33/17%) + 42-53 Gold. Character-specific relics never appear in chests "
                      "(multiplayer fairness). Skipped chest relics return to the pool.",
            "ancients": "Replace StS1 boss relics: 8 Ancients (Neow Act 1; Orobas/Pael/Tezcatara Act 2; "
                        "Nonupeipe/Tanx/Vakuu Act 3; Darv Act 2 or 3) each with relic pools; Neow offers 1 relic "
                        "from a Curse pool (upside with downside) + 2 from a Positive pool.",
        },
        "shop": {
            "source": "The Merchant",
            "stock": "Same layout as StS1: 5 class cards (2A/2S/1P, one 50% off), 2 colorless (U + R, +15%), "
                     "3 relics (rightmost a Shop relic), 3 potions, 1 card removal.",
            "prices": {"card_common": "48-53", "card_uncommon": "71-79", "card_rare": "143-158",
                       "colorless_uncommon": "82-90", "colorless_rare": "164-181",
                       "potion": "48-53 / 71-79 / 95-105 (C/U/R)",
                       "relic": "Shop 170-230, Common 149-201, Uncommon 191-259, Rare 234-316",
                       "removal": "75 +25 per use (A6: 100 +50)"},
            "fake_merchant": "The Merchant??? event sells cheap fake relics; can be fought with a Foul Potion.",
        },
        "rest_site": {
            "source": "Rest Sites",
            "options": "Rest (heal 30%) or Smith (upgrade). Relic/quest options: Train (Girya), Dig (Shovel), "
                       "Cook (Meat Cleaver: remove 2 cards, +5 Max HP), Kindle (Pumpkin Candle), Clone (Clone "
                       "enchantment), Hatch (Byrdonis Egg quest). Multiplayer adds Mend (heal an ally 30%). "
                       "Miniature Tent allows every option at one site.",
        },
        "new_systems": {
            "source": "Mechanics, Cards, Ancients, Multiplayer",
            "enchantments": "Permanent card modifiers (one per card) from relics/events/Ancients.",
            "afflictions": "Negative per-combat modifiers enemies put on your cards.",
            "quest_cards": "Unplayable deck cards with delayed rewards (Byrdonis Egg, Dowsing, Lantern Key, "
                           "Spoils Map).",
            "eternal": "Curses that cannot be removed or transformed.",
            "alternate_acts": "Act 1 is one of two themed acts (more planned).",
        },
        "multiplayer": {
            "source": "Multiplayer",
            "rule": "Co-op for up to 4 players. Map: vote, ties resolved randomly weighted by votes; every act is "
                    "1 floor shorter (bosses on 16/31/45). Combat: shared enemies, simultaneous turns (turn ends "
                    "when all players end); enemies attack/debuff ALL players at once, each player blocks "
                    "individually; enemy debuffs (Weak/Vulnerable) apply for everyone. Dead players revive at 1 HP "
                    "next floor if someone survived. Potions can be thrown to allies. Separate card rewards and "
                    "shops; chests offer one relic per player (rock-paper-scissors on conflicts); Ancients offer "
                    "each player their own picks. 37 multiplayer-only cards.",
            "enemy_scaling": "Enemy HP = base x players x act factor (Act 1 1.1, Act 2/3 1.2, Act 3 boss 1.3), "
                             "e.g. 4 players in Act 2 = x4.8. Enemy Block and most stacking buffs scale the same "
                             "way; Plating x(2p-1); Artifact +(p-1); Slippery xp. Enemy damage, debuffs and "
                             "status cards do NOT scale (but hit everyone).",
        },
        "elites_bosses": {
            "source": "Elites, Bosses",
            "rule": "3 elites and 3 bosses per act variant. A10: two different Act 3 bosses back to back. Act 3 "
                    "boss gives no rewards.",
        },
    },
}


# ---------------------------------------------------------------- completeness
def module_names(raw, mod):
    d = lua_data(raw["modules"].get(mod, ""))
    return set(d) if isinstance(d, dict) else set()


def enemy_check(raw, enemies, game):
    ours = Counter(e["category"] for e in enemies.values())
    cargo = Counter(r["Type"].lower() for r in raw["cargo"]["enemies"] if r["Game"] == str(game))
    if game == 1:
        mod = module_names(raw, "Module:Enemies/data")
    else:
        mod = set()
        for s in ("Overgrowth", "Underdocks", "Hive", "Glory", "Elites", "Bosses", "Events"):
            mod |= module_names(raw, f"Module:Enemies/StS2 data/{s}")
    names = {e["name"] for e in enemies.values()}
    cargo_names = {r["Name"] for r in raw["cargo"]["enemies"] if r["Game"] == str(game)}
    return {
        "scraped_by_category": dict(sorted(ours.items())),
        "wiki_cargo_Enemies_by_type": dict(sorted(cargo.items())),
        "wiki_module_enemy_entries": len(mod),
        "scraped_not_in_cargo": sorted(names - cargo_names),
        "cargo_not_scraped": sorted(cargo_names - names),
        "scraped_not_in_module": sorted(names - mod),
        "module_not_scraped": sorted(mod - names),
    }


EXPLAIN = {  # known causes of count differences vs the wiki's lists (shown only when the name shows up)
    "Neow": "Neow is in Category:Events but is the run-start blessing (see rules.neow), not a ? room event.",
    "Battle Friend": "Module lists the Battleworn Dummy as 3 entries (Battle Friend V1.0/V2.0/V3.0 = 75/150/300 HP "
                     "settings); the wiki page has one infobox 'Battle Friend'.",
    "Knight Gang": "Module has a group entry 'Knight Gang'; the scrape has its 3 members (Flail, Magi, Spectral "
                   "Knight).",
    "Doormaker": "Doormaker was deprecated in V0.107.1 (replaced by Aeonglass) and is excluded.",
    "Hatchling": "Hatchling (Ovicopter's hatched egg) has an infobox/Cargo row but no Module:Enemies entry.",
}


def explain(check):
    names = {n for v in check.values() if isinstance(v, list) for n in v}
    return sorted({t for k, t in EXPLAIN.items() if any(k in n for n in names)})


def list_check(label, ours, wiki_names, wiki_label):
    ours = set(ours)
    return {f"scraped_{label}": len(ours), wiki_label: len(wiki_names),
            "missing_vs_wiki": sorted(wiki_names - ours), "extra_vs_wiki": sorted(ours - wiki_names)}


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", help="raw API cache file (read if present, else written)")
    args = ap.parse_args()
    if args.cache and Path(args.cache).exists():
        raw = json.loads(Path(args.cache).read_text())
    else:
        raw = fetch_raw()
        if args.cache:
            Path(args.cache).write_text(json.dumps(raw))
    today = datetime.date.today().isoformat()
    ENEMY_DIR.mkdir(parents=True, exist_ok=True)
    STRUCT_DIR.mkdir(parents=True, exist_ok=True)
    patches = sorted(raw["cargo"]["patches"], key=lambda r: r["ReleaseDate"])
    majors = [r for r in patches if r["Type"] == "Major Update"]
    ver = (f"StS2 is in Early Access (since 2026-03-05); the wiki tracks the public beta branch: last Major "
           f"Update {majors[-1]['Version'] if majors else '?'}, latest logged patch "
           f"{patches[-1]['Version'] if patches else '?'} ({patches[-1]['Type'] if patches else ''}, "
           f"{patches[-1]['ReleaseDate'] if patches else ''}). Values can change between patches.")
    all_enemies, excluded = build_enemies(raw)

    for g, gname in ((1, "Slay the Spire"), (2, "Slay the Spire 2")):
        en = all_enemies[g]
        by_act = stS1_encounters(raw, en) if g == 1 else stS2_encounters(raw, en)
        evs, evmod = events(raw, g)
        if g == 1:
            for area, enc in event_fights(raw, evs, en, by_act):
                for a in re.findall(r"Act \d", area):
                    key = next((k for k in by_act if k.startswith(a + " /")), None)
                    if key:
                        by_act[key]["event"].append(enc)
        attach_encounters(en, by_act)
        ech = enemy_check(raw, en, g)
        lst = sorted(en.values(), key=lambda e: (["normal", "elite", "boss", "minion", "event"].index(
            e["category"]) if e["category"] in ("normal", "elite", "boss", "minion", "event") else 9,
            e["area"], e["name"]))
        for e in lst:
            e.pop("_power_defs", None)
            e["wiki_page"] = e.pop("_page")
        notes = [
            "One entry per {{Enemy Infobox}} (variants such as 'Jaw Worm (Hard)' are separate entries and share "
            "the base moveset). hp.base/hp.ascension are [min, max]; StS1 'ascension' HP applies from A7 "
            "(normal) / A8 (elite) / A9 (boss), StS2 from A8.",
            "Move effects keep ascension values inline as '(A2: 12)'; damage/hits are the base (A0) numbers "
            "parsed from the effect (null for non-attacks or variable damage). intent = schema label from the wiki "
            "intent icons (intent_icons keeps the raw codes).",
            "pattern = the wiki's prose under the intents table (AI rules, weights, phase changes), plain text, "
            "capped at 3000 chars; [Heading] marks a sub-section such as a phase. passives = infobox powers, with the power definition when the page has one.",
            "encounters = '<act> <pool>: <encounter>' labels from the encounter lists (pools: easy, hard, elite, "
            "boss, event).",
        ]
        if excluded[g]:
            notes.append(f"Excluded deprecated: {', '.join(excluded[g])}.")
        if g == 2:
            notes.append(ver)
        ech["explanations"] = explain(ech)
        notes.append("Completeness: enemy counts per category equal the wiki's Cargo 'Enemies' table "
                     f"({sum(ech['scraped_by_category'].values())} vs "
                     f"{sum(ech['wiki_cargo_Enemies_by_type'].values())}); differences against the enemy data "
                     "module are explained in 'completeness'.")
        doc = {"game": gname, "source": "https://slaythespire.wiki.gg (CC BY-SA)", "retrieved": today,
               "notes": " ".join(notes), "completeness": ech, "enemies": lst}
        path = ENEMY_DIR / f"sts{g}.json"
        path.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n")
        print(f"wrote {path} ({len(lst)} enemies) {ech['scraped_by_category']}")
        print("  check:", {k: v for k, v in ech.items() if v})

        # structure
        rel = relics(raw, g)
        pot = potions(raw, g)
        mod_rel = module_names(raw, "Module:Relics/data" if g == 1 else "Module:Relics/StS2 data")
        mod_pot = module_names(raw, "Module:Potions/data" if g == 1 else "Module:Potions/StS2 data")
        ev_cat = {page_short(t) for t in raw["event_pages"] if (t.startswith(P2) == (g == 2))
                  and re.search(r"\[\[Category:\s*Events\s*\]\]", raw["event_pages"][t])
                  and not t.endswith("Events List") and "__DISAMBIG__" not in raw["event_pages"][t]}
        checks = {
            "relics": list_check("relics", [r["name"] for r in rel], mod_rel,
                                 "wiki_Module_Relics_data (renders Relics List)"),
            "potions": list_check("potions", [p["name"] for p in pot], mod_pot,
                                  "wiki_Module_Potions_data (renders Potions List)"),
            "events": list_check("events", [e.get("wiki_page", e["name"]) for e in evs], ev_cat,
                                 "wiki_Category_Events_pages"),
        }
        checks["events"]["wiki_Module_Events_data (renders Events List)"] = len(evmod)
        checks["relics"]["by_rarity"] = dict(Counter(r["rarity"] for r in rel))
        checks["potions"]["by_rarity"] = dict(Counter(p["rarity"] for p in pot))
        checks["events"]["explanations"] = explain(checks["events"])
        enc_out = {act: {k: v for k, v in pools.items() if v} for act, pools in by_act.items()}
        rules = dict(RULES[g])
        rules["ascension"] = ascension(raw, g)
        sdoc = {"game": gname, "source": "https://slaythespire.wiki.gg (CC BY-SA)", "retrieved": today,
                "notes": " ".join(filter(None, [
                    "relics/potions from the wiki Cargo tables; events from the wiki's event data modules + each "
                    "event page's Options section (choices are condensed plain text, capped).",
                    "encounters: per act, pools easy/hard (StS1 with the wiki's encounter weights), elite, boss, "
                    "event; enemies = matched enemy names.",
                    "rules: condensed from the mechanics pages named in each 'source'; anything marked "
                    "'not on wiki' comes from general game knowledge and is unverified.",
                    ver if g == 2 else "StS1 is a finished game (last content patch 2020).",
                    {1: "Relic rarity 'Blight' = Endless-mode blights (13); 'Special' = Circlet / Red Circlet; "
                        "potions effect_doubled = value with Sacred Bark.",
                     2: "Relic rarity 'Ancient' = offered by an Ancient at act start (relic.ancient names it); "
                        "potion rarity 'Special' = only from events/relics. See 'ancients' for each Ancient's "
                        "relic pool."}[g],
                    "Completeness: relic, potion and event counts are compared with the wiki data modules that "
                    "render the Relics/Potions/Events List pages; see 'completeness'."])),
                "completeness": checks,
                "relics": rel, "potions": pot, "events": evs, "encounters": enc_out, "rules": rules}
        if g == 2:
            sdoc["ancients"] = ancients(raw)
        spath = STRUCT_DIR / f"sts{g}.json"
        spath.write_text(json.dumps(sdoc, ensure_ascii=False, indent=1) + "\n")
        print(f"wrote {spath} ({len(rel)} relics, {len(pot)} potions, {len(evs)} events, "
              f"{sum(len(v) for p in enc_out.values() for v in p.values())} encounters)")
        for k, c in checks.items():
            print(f"  {k}: " + json.dumps({a: b for a, b in c.items() if b}, ensure_ascii=False))


if __name__ == "__main__":
    main()
