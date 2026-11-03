#!/usr/bin/env python3
"""Enemy + run-structure census for Monster Train (MT1) and Monster Train 2 (MT2) -> JSON.

Companion of scrape_monstertrain.py (cards). Research input only (mechanic analysis); the data
does not ship in the game.

Sources (content CC BY-SA unless noted)
  MT1  https://monster-train.fandom.com  MediaWiki API
       - Module:Enemies/Data, Module:Artifacts/Data (Lua data modules)
       - enemy pages (lead text), 37 combat pages + The Last Divinity: Divine Intervention (wave tables)
       - Rings, Battle, Battle Effects, Covenant Ranks, Pyre, Pact Shards, Merchants, Upgrades,
         Overworld Events, Concealed Caverns, Divine Temple, Mutators, Expert Challenges, Hell Rush
  MT2  Miraheze's public XML backup of https://monstertrain2.miraheze.org on archive.org
       (same workaround as the card scraper: the live wiki serves a bot challenge)
       - {{Enemy}} / {{EnemySS}} / {{FlyingBossSS}} infoboxes, ring/region pages (wave tables)
       - Rings, Battles, Combat, Flying Bosses, Trials, Covenant Ranks, Clan Level, Pyre Hearts,
         Merchants (+ merchant node pages), Upgrades, Artifacts, {{Event}} / {{Node}} pages,
         Dimensional Challenges, Endless Mode, Soul Savior, Mutators, Score, The Great Abyss
       optional: a local clone of https://github.com/brandonandzeus/MonsterTrain2GameData
       (game-data dump, research-only, never committed) for the completeness check, enemy size,
       artifact rarity, and stats of Soul Savior enemies that have no wiki infobox.

Writes
  data/research/enemies/mt1.json, data/research/enemies/mt2.json
  data/research/structure/mt1.json, data/research/structure/mt2.json

Run:  python3 tools/research/scrape_monstertrain_world.py [--game mt1|mt2|all]
          [--cache DIR] [--refresh] [--mt2-gamedata DIR]
Python 3 stdlib only.
"""
import argparse
import datetime
import json
import math
import re
import sys
from collections import Counter, OrderedDict, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import scrape_monstertrain as smt  # noqa: E402  (shared HTTP cache + wikitext helpers)

ROOT = Path(__file__).resolve().parents[2]
ENEMY_DIR = ROOT / "data/research/enemies"
STRUCT_DIR = ROOT / "data/research/structure"
TODAY = datetime.date.today().isoformat()
MT1_SRC = "https://monster-train.fandom.com (CC BY-SA)"

# ---------------------------------------------------------------- wikitext helpers
_orig_render = smt.render_template


def _render(name, params):
    low = name.strip().lower()
    if low == "!":
        return "|"
    if low == "attackpyrehealth":
        a, h = params.get("1", "").strip(), params.get("2", "").strip()
        if not h and "/" in a:
            a, h = a.split("/", 1)
        return f"{a} Attack / {h} Pyre Health"
    if low == "quote":
        return params.get("1", "")
    if low in ("dotrbanner", "unfinished", "enemypage", "thelastdivinity", "enemiesnav", "enemiesnavss",
               "ringsnav", "eventnav", "ssnav", "combatnav", "pyreheartsnav", "upgradesnav", "clanlessartifacts",
               "majorupdate", "removed", "delete", "collapsible", "tabber"):
        return ""
    if low in ("size",):
        return f"{params.get('1', '').strip()} Capacity".strip()
    if low == "colored box":
        return params.get("content", params.get("2", ""))
    return _orig_render(name, params)


smt.render_template = _render  # clean() resolves render_template at call time


def clean(text):
    t = re.sub(r"</?tabber>", " ", text or "")
    t = re.sub(r"\|-\|[^=\n]*=", " ", t)
    t = re.sub(r"(^|\n)\s*[*#]+\s*", r"\1• ", t)
    return smt.clean(t)


BR = re.compile(r"<\s*/?\s*br\s*/?\s*>", re.I)


def cell(c):
    """Table cell -> plain text (line breaks become ' / ')."""
    return clean(BR.sub(" / ", c or "")).strip(" /")


def strip_divs(text):
    """Drop every <div>...</div> block (lore, image versions, quote lists) and comments."""
    t = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    for _ in range(10):
        new = re.sub(r"<div[^>]*>(?:(?!<div).)*?</div>", "", t, flags=re.S | re.I)
        if new == t:
            break
        t = new
    return t


LINK_RE = re.compile(r"\[\[:?([^\]|#]*)(?:#([^\]|]*))?(?:\|([^\]]*))?\]\]")


def links(text):
    """Link targets in order, without File:/Category:/Image: links."""
    out = []
    for m in LINK_RE.finditer(text or ""):
        tgt = m.group(1).strip().replace("_", " ")
        if not tgt or re.match(r"(?i)(file|image|category)\s*:", tgt):
            continue
        out.append(tgt)
    return out


def headings(text):
    return [(m.start(), m.end(), len(m.group(1)), m.group(2).strip())
            for m in re.finditer(r"^(=+)\s*(.*?)\s*\1\s*$", text, re.M)]


def sections(text, level):
    """[(title, body)] for headings of exactly `level`; body runs to the next heading of level <= `level`."""
    hs = headings(text)
    out = []
    for i, (s, e, lv, title) in enumerate(hs):
        if lv != level:
            continue
        end = len(text)
        for s2, _, lv2, _ in hs[i + 1:]:
            if lv2 <= level:
                end = s2
                break
        out.append((clean(title), text[e:end]))
    return out


def section(text, title, level=2):
    for t, body in sections(text, level):
        if t.lower() == title.lower():
            return body
    return ""


def tables(text):
    return re.findall(r"\{\|.*?\n\|\}", text, re.S)


_ATTR = re.compile(r'^\s*(?:style|class|colspan|rowspan|data-sort-value|data-sort-type|scope|align|width)\s*=[^|]*\|(?!\|)')


def parse_rows(table):
    """Wikitable -> [(cells, is_header_flags)] (like smt.parse_wikitable_rows, but keeps '!' header flags)."""
    out = []
    for chunk in re.split(r"\n\|-[^\n]*", table):
        cells, flags, cur, curf = [], [], None, False
        for line in chunk.split("\n"):
            if line.startswith(("{|", "|}", "|+")):
                continue
            if line.startswith(("|", "!")):
                if cur is not None:
                    cells.append(cur)
                    flags.append(curf)
                hdr = line.startswith("!")
                parts = re.split(r"\|\||!!", line[1:])
                for p in parts[:-1]:
                    cells.append(p)
                    flags.append(hdr)
                cur, curf = parts[-1], hdr
            elif cur is not None:
                cur += "\n" + line
        if cur is not None:
            cells.append(cur)
            flags.append(curf)
        cells = [_ATTR.sub("", c).strip() for c in cells]
        if cells:
            out.append((cells, flags))
    return out


def rows(table):
    """Data rows only (rows made solely of '!' header cells are dropped)."""
    return [c for c, f in parse_rows(table) if not all(f)]


def flatten_tables(text):
    def rep(m):
        out = []
        for cells, _ in parse_rows(m.group(0)):
            cs = [cell(c) for c in cells]
            cs = [c for c in cs if c]
            if cs:
                out.append(" | ".join(cs))
        return "\n" + "; ".join(out) + "\n"
    return re.sub(r"\{\|.*?\n\|\}", rep, text, flags=re.S)


def prose(text, limit, title=None):
    """Section wikitext -> one paragraph of plain text (tables flattened, headings as 'Heading:')."""
    t = strip_divs(text or "")
    if title:
        t = t.replace("{{PAGENAME}}", title).replace("{{BASEPAGENAME}}", title)
    t = flatten_tables(t)
    t = re.sub(r"^(=+)\s*(.*?)\s*\1\s*$", r"\2:", t, flags=re.M)
    t = re.sub(r"^:+\s*", "", t, flags=re.M)
    return cut(clean(t), limit)


def own_text(body):
    """Body text before the first sub-heading."""
    return re.split(r"^=+[^=\n]", body, flags=re.M)[0]


def lead(text, limit=450, title=None):
    """Plain text before the first heading, without infobox templates/files/quotes."""
    t = strip_divs(text)
    m = re.search(r"^=+.*=+\s*$", t, re.M)
    t = t[:m.start()] if m else t
    for name in ("Enemy", "EnemySS", "FlyingBossSS", "Event", "Node", "PyreHeart", "EnemyPage", "DOTRBanner",
                 "Unfinished", "TheLastDivinity", "MajorUpdate"):
        for inner in smt.find_templates(t, name):
            t = t.replace("{{" + name + inner + "}}", "")
    t = re.sub(r"\{\{\s*quote\|.*?\}\}", "", t, flags=re.S | re.I)
    t = re.sub(r"^\s*:?''[^'\n].*?''\s*$", "", t, flags=re.M)  # italic flavour/hatnote lines
    return prose(t, limit, title)


def cut(t, limit):
    t = t.strip()
    if len(t) <= limit:
        return t
    c = t.rfind(". ", 0, limit)
    return t[:c + 1] if c > limit // 3 else t[:limit].rstrip() + "…"


def find_templates_pos(text, name):
    """(start, end, inner) of every top-level {{name ...}} call."""
    out = []
    for m in re.finditer(r"\{\{\s*" + re.escape(name) + r"\s*(?=[|}\n])", text):
        depth, j = 0, m.start()
        while j < len(text):
            if text.startswith("{{", j):
                depth += 1
                j += 2
                continue
            if text.startswith("}}", j):
                depth -= 1
                j += 2
                if depth == 0:
                    break
                continue
            j += 1
        out.append((m.start(), j, text[m.end():j - 2]))
    return out


def split_lines(raw):
    """Ability text -> list of plain-text lines (split on <br>, <hr>, newlines, adjacent bold keywords)."""
    raw = re.sub(r"<!--.*?-->", "", raw or "", flags=re.S)
    parts = re.split(r"<\s*/?\s*br\s*/?\s*>|<\s*hr\s*/?\s*>|\n", raw, flags=re.I)
    out = []
    for p in parts:
        for q in re.split(r"(?<=\.''')\s+(?=''')", p):
            c = clean(q).strip(" ;")
            if c and c.lower() not in ("none", "-", "none."):
                out.append(c)
    return out


FILE_RE = re.compile(r"\[\[\s*(?:file|image)\s*:([^|\]]*)[^\]]*\]\]", re.I)


def nofile(t, keep_name=False):
    """Drop [[File:..]] icons (or keep their CamelCase basename as words)."""
    if keep_name:
        return FILE_RE.sub(lambda m: " " + re.sub(r"(?<=[a-z])(?=[A-Z])", " ",
                                                    re.sub(r"\.\w+$", "", m.group(1).strip())) + " ", t or "")
    return FILE_RE.sub("", t or "")


def norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower().replace("’", "'"))


def to_int(v):
    if isinstance(v, (int, float)):
        return int(v)
    m = re.match(r"\s*(-?\d+)", str(v or ""))
    return int(m.group(1)) if m else None


# keyword vocabulary for enemy ability tags (mechanic analysis): card glossaries + enemy-only words
ENEMY_ONLY_KEYWORDS = [
    "Relentless", "Rally", "Recover", "Phased", "Enchant", "Hellborne Harvest", "Haste", "Purify", "Action",
    "Siphon", "Loop", "Shift", "Mass", "Corruption", "Titanskin", "Malaise", "Live to Fight", "Pyre Bound",
    "Immobile", "Fate Link", "Infested", "Buffet", "Eaten", "Burst", "Witherbloom", "Reanimate", "Dualism",
    "Lifesteal", "Silence", "Mute", "Stealth", "Spell Shield", "Spellshield", "Damage Shield", "Armor", "Spikes",
    "Sweep", "Trample", "Quick", "Multistrike", "Burnout", "Rage", "Regen", "Sap", "Dazed", "Emberdrain",
    "Melee Weakness", "Spell Weakness", "Rooted", "Frostbite", "Shroud", "Slay", "Revenge", "Harvest", "Strike",
    "Extinguish", "Resolve", "Incant", "Summon", "Ascend", "Descend", "Advance", "Retreat", "Heartless",
    "Endless", "Valor", "Avarice", "Conduit", "Gorge", "Soul", "Inspire", "Rejuvenate", "Cultivate",
    "Reserve", "Rooted", "Piercing", "Lifesteal", "Fragile", "Decay", "Scourge",
]


def keyword_vocab(game):
    words = set(ENEMY_ONLY_KEYWORDS)
    p = ROOT / f"data/research/cards/{game}.json"
    if p.exists():
        words.update(json.loads(p.read_text(encoding="utf-8")).get("keyword_glossary", {}).keys())
    return sorted(words, key=len, reverse=True)


KEYWORD_STOP = {"X Cost", "Echo slot", "Add", "Ability", "Equipment", "Room", "Forge", "Shard", "Soul", "Phase",
                "Mix", "Craft", "Ascension", "Refined", "Explosive", "Distinct", "Spawn", "Graft", "Infusion"}


def tag_keywords(lines, vocab):
    txt = " ".join(lines)
    out = []
    for k in vocab:
        if len(k) < 3 or k in KEYWORD_STOP:
            continue
        if re.search(r"(?<![\w-])" + re.escape(k) + r"(?![\w-])", txt):
            if not any(k in o for o in out):  # 'Spell Shield' wins over 'Shield'
                out.append(k)
    return sorted(out)


def entry(game, name, category, area, hp_base, hp_cov, attack, size, abilities, pattern, waves, extra, cid=None):
    return OrderedDict([
        ("id", cid or f"{game}.{smt.slug(name)}"), ("name", name), ("category", category), ("area", area),
        ("hp", OrderedDict([("base", hp_base), ("covenant", hp_cov)])), ("attack", attack), ("size", size),
        ("abilities", abilities), ("pattern", pattern), ("waves", waves), ("extra", extra),
    ])


def write(path, doc):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {path.relative_to(ROOT)}", file=sys.stderr)


# ================================================================= MT1
def mt1_lua_entries(title, var):
    d = smt.mt1_api(action="query", prop="revisions", rvprop="content", rvslots="main", titles=title)
    src = list(d["query"]["pages"].values())[0]["revisions"][0]["slots"]["main"]["*"]
    p = smt.LuaParser(src)
    res = OrderedDict()
    while p.i < len(p.toks):
        if (p.peek()[1] == var and p.peek(1)[1] == "[" and p.peek(2)[0] == "str" and p.peek(3)[1] == "]"
                and p.peek(4)[1] == "="):
            p.i += 2
            name = p.take()[1]
            p.i += 2
            p.take()
            res[name] = p.table()
        else:
            p.i += 1
    return res


def mt1_category(cat, cmtype="page"):
    d = smt.mt1_api(action="query", list="categorymembers", cmtitle="Category:" + cat, cmlimit=500, cmtype=cmtype)
    return [m["title"] for m in d["query"]["categorymembers"]]


def mt1_redirects(titles):
    out = {}
    titles = sorted(set(titles))
    for i in range(0, len(titles), 50):
        d = smt.mt1_api(action="query", titles="|".join(titles[i:i + 50]), redirects=1)
        for r in d["query"].get("redirects", []):
            out[r["from"]] = r["to"]
        for n in d["query"].get("normalized", []):
            out.setdefault(n["from"], out.get(n["to"], n["to"]))
    return out


MT1_RING_NAMES = ["Limbo", "The Cliffs of Fallen Souls", "Bogwurm's Remains", "The Waxen Arches",
                  "Frozen Styx Sea", "The Wildwood", "Scorched Plains", "The Crucible", "The Frozen Heart"]
MT1_CATEGORY = {"Major Boss": "flying_boss", "Boss": "boss", "Heavy": "normal", "Support": "normal"}

MT1_PATTERN = {
    "normal": ("Enters on the bottom floor with its wave. After you end the turn, enemies on each floor attack "
               "first (the front friendly unit unless a keyword says otherwise), then your surviving units strike "
               "back; survivors then ascend one floor. In the Pyre Room it attacks the Pyre, which retaliates "
               "against all enemies there until one side dies."),
    "boss": ("Minor boss: arrives in the final wave (the wave before is 'A Brief Respite' with no enemies). "
             "Relentless: combat on its floor repeats until it or every friendly unit there is dead; it cannot "
             "be Rooted; each time it climbs, the floor it left freezes (removed for the rest of the battle). "
             "Killing it wins the battle and removes all other enemies."),
    "flying_boss": ("Major boss: starts 'flying' beside one floor, moves to a different floor every turn and can be "
                    "hit there by units/spells (always behind other enemies, cannot be moved within the floor, "
                    "can be Ascended/Descended but not into the Pyre Room); while flying it does not attack "
                    "(except Talos and Seraph the Patient) and uses its variant's special action each turn. In the "
                    "final wave it lands on the bottom floor and fights as a Relentless boss without its special "
                    "action; no 'Brief Respite' wave precedes it."),
    "minion": ("Spawned by a boss's action rather than a wave; otherwise behaves like a normal enemy (enters the "
               "train and climbs a floor per turn)."),
    "special": ("Bonus enemy: enters behind the other enemies on a random floor; harmless and flees after combat "
                "unless killed for a gold bounty."),
}


def mt1_stats(stats):
    """Lua Stats rows {cov, attack, health} -> (base_hp, base_attack, attack_display, covenant note)."""
    stats = stats or []
    if not stats:
        return None, None, None, None
    first = stats[0]
    base_atk_disp = clean(str(first[1])).replace(" / ", "|")
    notes = []
    for row in stats:
        cov = row[0]
        lab = "all covenants" if str(cov) == "All" else f"cov {cov}+"
        notes.append(f"{lab}: {clean(str(row[1])).replace(' / ', '|')}/{row[2]}")
    return to_int(first[2]), to_int(first[1]), base_atk_disp, "; ".join(notes) + " (attack/health)"


def mt1_combats(pages, combat_titles, alias):
    """Combat pages -> list of combats with ring, description, waves per covenant column."""
    out = []
    for title in combat_titles:
        txt = pages.get(title, "")
        if not txt:
            continue
        ring = re.search(r"\[\[Category:Ring (\d) Combats\]\]", txt)
        ring = int(ring.group(1)) if ring else (9 if "Last Divinity" in title else None)
        desc = ""
        q = smt.find_templates(txt, "quote")
        if q:
            desc = clean(smt.split_params(q[0]).get("1", ""))
        body = strip_divs(txt)
        body = re.sub(r"\{\{\s*quote\|.*?\}\}", "", body, flags=re.S | re.I)
        intro = body[:body.find("{|")] if "{|" in body else body
        intro = re.split(r"^==", intro, flags=re.M)[0]
        intro = re.sub(r"^''For the.*$", "", intro, flags=re.M)
        waves = OrderedDict()
        for tb in tables(body):
            if "Wave" not in tb:
                continue
            head = re.findall(r"^!\s*(.+)$", tb, re.M)
            cols = [clean(h) for h in head if "Wave" not in h]
            for cells in rows(tb):
                if len(cells) < 2 or not re.match(r"^\s*\d+\s*$", clean(cells[0])):
                    continue
                wn = int(clean(cells[0]))
                for ci, cell in enumerate(cells[1:]):
                    col = cols[ci] if ci < len(cols) else f"col{ci}"
                    alts = re.split(r"<\s*hr\s*/?>", cell)
                    groups = []
                    for alt in alts:
                        names = [alias.get(n, n) for n in links(alt)]
                        txtalt = clean(re.sub(r"\[\[[^\]]*\]\]|\{\{!\}\}", " ", alt)).strip(" |")
                        if "BOSS" in alt.upper() and not names:
                            names = ["BOSS"]
                        elif re.search(r"\bBOSS\b", alt):
                            names = ["BOSS"] + names
                        groups.append(" | ".join(names) if names else txtalt)
                    waves.setdefault(col, []).append(f"{wn}: " + "  OR  ".join(groups))
        out.append(OrderedDict(name=title, ring=ring, description=desc, notes=prose(intro, 500, title),
                               waves=waves))
    return out


def mt1_events(pages):
    out = []
    ow = pages.get("Overworld Events", "")
    for title, body in sections(ow, 2):
        if title in ("Merchants", "Concealed Caverns"):
            continue
        out.append(OrderedDict(name=title, type="map node", summary=prose(body, 400)))
    out.append(OrderedDict(name="Merchants (Steel / Magic / Trinkets)", type="map node",
                           summary="Shops; see merchants_and_upgrades."))
    cc = pages.get("Concealed Caverns", "")
    for block_title, block in sections(cc, 2):
        if "Events" not in block_title:
            continue
        dlc = "The Last Divinity" in block_title
        for lv in (3, 4):
            for title, body in sections(block, lv):
                summ = event_options(body)
                out.append(OrderedDict(name=title, type="Concealed Caverns event" + (" (follow-up)" if lv == 4 else ""),
                                       dlc="The Last Divinity" if dlc else None, summary=summ))
    return out


def event_options(body):
    b = strip_divs(body)
    b = re.sub(r"\{\|.*?\n\|\}", "", b, flags=re.S)
    b = re.split(r"^=+", b, flags=re.M)[0]
    opts = []
    for ln in b.split("\n"):
        ln = ln.strip()
        if ln.startswith("'''") or ln.startswith("*") or (opts and ln and not ln.startswith(("[[File", "{{"))):
            c = clean(ln.lstrip("*: "))
            if c:
                opts.append(c)
    if not opts:
        return prose(b, 400)
    return cut(" / ".join(opts), 600)


def scrape_mt1():
    print("MT1: data modules", file=sys.stderr)
    data = mt1_lua_entries("Module:Enemies/Data", "enemies")
    arts = mt1_lua_entries("Module:Artifacts/Data", "artifacts")
    combat_titles = mt1_category("Combats") + ["The Last Divinity: Divine Intervention"]
    misc = ["Rings", "Battle", "Battle Effects", "Covenant Ranks", "Pyre", "Pact Shards", "Merchants", "Upgrades",
            "Overworld Events", "Concealed Caverns", "Divine Temple", "Mutators", "Expert Challenges", "Hell Rush",
            "Champions", "Banner Unit", "Scoring", "Threats", "Daily Challenge", "Custom Challenge",
            "The Last Divinity (DLC)"]
    pages = smt.mt1_pages(list(data) + combat_titles + misc)
    vocab = keyword_vocab("mt1")

    # ---- combats + alias resolution (wave tables link [[Daedalus]] etc.)
    raw_links = set()
    for t in combat_titles:
        for tb in tables(pages.get(t, "")):
            raw_links.update(links(tb))
    alias = {k: v for k, v in mt1_redirects([x for x in raw_links if x not in data]).items()}
    combats = mt1_combats(pages, combat_titles, alias)
    enemy_waves = defaultdict(list)
    for cb in combats:
        seen = defaultdict(set)
        for col, ws in cb["waves"].items():
            for w in ws:
                wn, rest = w.split(": ", 1)
                for nm in re.split(r"\s*(?:\||OR)\s*", rest):
                    nm = nm.strip()
                    if nm in data:
                        seen[nm].add(int(wn))
        for nm, wset in seen.items():
            enemy_waves[nm].append(f"R{cb['ring']} {cb['name']} (wave {', '.join(map(str, sorted(wset)))})")

    # ---- battle effects (trials + major boss variants)
    be = pages.get("Battle Effects", "")
    variants = {}
    trials = []
    for title, body in [("Effects", section(be, "Effects"))] + sections(be, 3):
        for tb in tables(body):
            for cells in rows(tb):
                if len(cells) < 2 or cells[0].startswith("!"):
                    continue
                nm = clean(re.sub(r"\[\[File:[^\]]*\]\]", "", cells[0]))
                ds = cell(cells[1])
                if not nm or nm == "Effect":
                    continue
                if title == "Effects":
                    trials.append(OrderedDict(name=nm, effect=ds))
                else:
                    variants.setdefault(title, []).append(f"{nm}: {ds}")
    var_alias = {"Daedalus": "Daedalus, the Professor", "Talos": "Talos, the Architect",
                 "Fel, the Wings of Light": "Fel, the Wings of Light", "Archus": "Archus, Darkness Incarnate",
                 "Seraph": "Seraph", "The Last Divinity": "The Last Divinity"}

    # ---- enemies
    in_waves = set(enemy_waves)
    enemies = []
    for name, e in data.items():
        native = e.get("Type")
        cat = MT1_CATEGORY.get(native, "normal")
        if name == "Collector":
            cat = "special"
        elif cat == "normal" and name not in in_waves:
            cat = "minion"
        page = pages.get(name, "")
        page_lead = lead(page, 420, title=name)
        hp0, atk0, atk_disp, cov = mt1_stats(e.get("Stats"))
        abil = split_lines(e.get("Desc", ""))
        if "<hr>" in e.get("Desc", ""):  # The Last Divinity: one ability set per floor section
            abil = [f"{fl} section: {clean(part)}" for fl, part in
                    zip(("Top", "Middle", "Bottom"), re.split(r"<hr>", e["Desc"]))]
        pattern = MT1_PATTERN[cat]
        if cat == "flying_boss":
            vt = [k for k, v in var_alias.items() if v == name]
            vs = variants.get(vt[0], []) if vt else []
            if vs:
                pattern += " Variants (one per run, shown on the map): " + " | ".join(vs)
        if page_lead:
            pattern += " Wiki: " + page_lead
        waves = list(enemy_waves.get(name, []))
        rings = str(e.get("Ring", ""))
        if cat == "boss":
            waves.insert(0, f"Ring {rings} boss: final wave of any Ring {rings} combat")
        extra = OrderedDict(native_type=native, attack_display=atk_disp if atk_disp != str(atk0) else None,
                            keywords=tag_keywords(abil, vocab))
        if e.get("Shardcost") is not None or e.get("DescS"):
            extra["pact_shard_variant"] = OrderedDict(
                shard_cost=e.get("Shardcost"),
                abilities=split_lines(e.get("DescS", "")),
                stats=mt1_stats(e.get("StatsS"))[3] if e.get("StatsS") else None)
            if native == "Major Boss" or (native == "Boss" and not e.get("StatsS")):
                extra["pact_shard_variant"]["note"] = "per-Pact-Shard scaling of the boss (The Last Divinity DLC)"
        extra["dlc"] = "The Last Divinity" if ("Darkshard" in name or name == "The Last Divinity") else None
        enemies.append(entry("mt1", name, cat, f"Ring {rings}" if rings and rings != "All" else "all rings",
                             hp0, cov, atk0, None, abil, pattern, waves, extra))

    # ---- completeness (enemies)
    checks = []
    cat_members = [t for t in mt1_category("Enemies") if t != "Enemies"]
    miss = sorted(set(cat_members) - set(data))
    extra_mod = sorted(set(data) - set(cat_members))
    checks.append(f"Module:Enemies/Data {len(data)} entries vs Category:Enemies {len(cat_members)} pages"
                  f" -> category-only {miss or 'none'}, module-only {extra_mod or 'none'}")
    for t in ("Major Boss", "Boss", "Heavy", "Support"):
        mem = mt1_category(f"{t} Enemies")
        n = sum(1 for e in data.values() if e.get("Type") == t)
        checks.append(f"{t}: module {n} / Category:{t} Enemies {len(mem)}")
    unknown = sorted({nm for cb in combats for ws in cb["waves"].values() for w in ws
                      for nm in re.split(r"\s*(?:\||OR)\s*", w.split(': ', 1)[1])
                      if nm and nm not in data and nm != "BOSS" and "Respite" not in nm and "End" not in nm})
    checks.append(f"combat pages parsed {len(combats)} (Category:Combats 37 + Divine Intervention); wave-table "
                  f"names not in the enemy module: {unknown or 'none'}")
    no_wave = sorted(e["name"] for e in enemies if not e["waves"] and e["category"] not in ("flying_boss",))
    checks.append(f"enemies never listed in a wave table: {no_wave} (summoned by bosses or special spawns)")

    enemy_doc = OrderedDict(
        game="Monster Train", source=MT1_SRC, retrieved=TODAY,
        notes=("Version: final MT1 (v2.x incl. The Last Divinity DLC). Enemy list = wiki Lua module "
               "Module:Enemies/Data (stats per Covenant rank, ability text, Pact-Shard ★ variant). category: "
               "flying_boss = the wiki's 'Major Boss' (Rings 3/6/8 + The Last Divinity, Ring 9), boss = minor ring "
               "boss, normal = the wiki's 'Heavy' or 'Support' wave enemy (extra.native_type keeps which), minion = "
               "only spawned by a boss (Constructed Explosive by Daedalus, Darkshards by Archus), special = "
               "Collector (gold bounty). hp.base/attack = covenant 0 row; hp.covenant lists every row "
               "('cov N+: attack/health'); 'AxN' attack = A damage hitting N times (extra.attack_display). size: "
               "not documented on the MT1 wiki (null). pattern = generic behaviour of the category (from the wiki "
               "'Battle' page) + the boss variant battle effects + the enemy page's lead text. waves = combat page "
               "wave tables (both covenant columns merged). extra.pact_shard_variant = the ★ version the game "
               "swaps in as Pact Shards accumulate (shard_cost = shards spent per upgraded enemy). "
               "Completeness: " + " | ".join(checks)),
        enemies=enemies)

    # ================= structure
    artifacts = []
    for name, a in arts.items():
        artifacts.append(OrderedDict(
            name=name, clan=a.get("Clan"), rarity=None, effect=clean(a.get("Desc", "")),
            source=clean(a.get("Source", "")) or None, dlc=a.get("DLC"),
            divine_effect=clean(a.get("DescDiv", "")) or None))
    art_cat = smt.mt1_api(action="query", prop="categoryinfo", titles="Category:Artifacts")
    art_cat_n = list(art_cat["query"]["pages"].values())[0].get("categoryinfo", {}).get("pages")

    # merchants + upgrades
    mp = pages.get("Merchants", "")
    merchants = []
    for title, body in sections(mp, 3):
        if title.startswith("Merchant of"):
            intro = re.split(r"\{\|", body)[0]
            items = []
            for tb in tables(body):
                for cells, flags in parse_rows(tb):
                    if all(flags):
                        continue
                    lab = cell(cells[0]) if flags[0] else None
                    vals = [cell(c) for c, f in zip(cells, flags) if not f and cell(c)]
                    items.append((f"{lab}: " if lab else "") + " | ".join(vals))
            merchants.append(OrderedDict(name=title, sells=prose(intro, 400), stock=items))
    removal = []
    for tb in tables(section(mp, "Card Removal", 3) or mp):
        for r in rows(tb):
            if r and re.match(r"\d", clean(r[0])):
                removal.append(OrderedDict(covenant=cell(r[0]), costs=[cell(c) for c in r[1:]]))
    up_page = pages.get("Upgrades", "")
    upgrades = []
    for kind, body in (("unit", section(up_page, "Unit Upgrades")), ("spell", section(up_page, "Spell Upgrades"))):
        for tb in tables(body):
            for r in rows(tb):
                if len(r) >= 3 and "Upgrade" not in r[0][:12]:
                    upgrades.append(OrderedDict(name=clean(re.sub(r"\[\[File:[^\]]*\]\]", "", r[0])), kind=kind,
                                                effect=cell(r[1]), acquired_from=cell(r[2])))
    merch = OrderedDict(
        overview=prose(own_text(mp), 400),
        prices=prose(own_text(section(mp, "Prices")), 700),
        card_removal=prose(re.split(r"\{\|", section(mp, "Card Removal", 3))[0], 300),
        card_removal_costs=removal, merchants=merchants,
        divine_temple=prose(pages.get("Divine Temple", ""), 900, "Divine Temple"),
        engage_pact=prose(section(up_page, "Engage Pact", 3), 300),
        upgrades=upgrades)

    # rings
    rp = pages.get("Rings", "")
    rings = []
    combat_set = {c["name"] for c in combats}
    for i, (title, body) in enumerate([s for s in sections(rp, 2) if s[0] != "Summary"]):
        flav = re.search(r"^''([^'].*?)''\s*$", body, re.M)
        b = re.sub(r"^''.*''\s*$", "", body, flags=re.M)
        cbs = [x for x in links(body) if x in combat_set]
        bosses = sorted(n for n, e in data.items() if e.get("Type") in ("Boss", "Major Boss")
                        and str(i + 1) in str(e.get("Ring", "")).split("/"))
        rings.append(OrderedDict(ring=i + 1, name=title, flavor=clean(flav.group(1)) if flav else None,
                                 nodes=prose(b, 1200), combats=cbs, bosses=bosses))
    avail = OrderedDict()
    summ = section(rp, "Summary")
    for tb in tables(summ):
        for r in rows(tb):
            if len(r) == 10 and r[0].strip() not in ("Event",) and not r[0].startswith("!"):
                avail[cell(r[0])] = "".join(cell(c) for c in r[1:])
    # covenant
    cp = pages.get("Covenant Ranks", "")
    cov_list = section(cp, "Covenant Ranks")
    cov_list = re.sub(r"<!--.*?-->", "", cov_list, flags=re.S)
    covenant = []
    for ln in cov_list.split("\n"):
        if ln.startswith("#*") and covenant:
            covenant[-1]["details"].append(clean(ln[2:]))
        elif ln.startswith("#"):
            covenant.append(OrderedDict(rank=len(covenant) + 1, change=clean(ln[1:]), details=[]))
    # battle page sections
    bp = pages.get("Battle", "")
    battle = OrderedDict(overview=prose(own_text(bp), 600, "Battle"))
    for lv in (2, 3):
        for title, body in sections(bp, lv):
            if title in ("Bosses",) and lv == 2:
                body = re.split(r"^===", body, flags=re.M)[0]
            battle[title] = prose(body, 1500)
    # pact shards
    ps = pages.get("Pact Shards", "")
    sources = []
    for tb in tables(section(ps, "Sources of Pact Shards")):
        for r in rows(tb):
            if len(r) >= 4 and not r[0].startswith("!") and clean(r[0]) != "Name":
                sources.append(OrderedDict(name=cell(r[0]), location=cell(r[1]), benefit=cell(r[2]),
                                           shards=cell(r[3])))
    pact = OrderedDict(
        summary=prose(own_text(ps), 800), sources=sources,
        shard_costs=prose(re.sub(r"\{\{#invoke[^}]*\}\}", "", section(ps, "Shard Costs")), 1200),
        malicka_pyre_heal=prose(section(ps, "Other", 3), 900))
    # mutators / expert challenges / modes
    mutators = []
    for tb in tables(pages.get("Mutators", "")):
        for r in rows(tb):
            if len(r) >= 2 and not r[0].startswith("!") and clean(r[0]) not in ("Mutator",):
                mutators.append(OrderedDict(name=clean(re.sub(r"\[\[File:[^\]]*\]\]", "", r[0])),
                                            effect=cell(r[1])))
    experts = []
    for tb in tables(pages.get("Expert Challenges", "")):
        for r in rows(tb):
            if len(r) >= 3 and not r[0].startswith("!") and clean(r[0]) not in ("Name",):
                experts.append(OrderedDict(name=cell(r[0]), description=cell(r[1]),
                                           mutators=re.findall(r"\[\[File:([^\]|.]+)\.png", r[2])))
    structure = OrderedDict(
        game="Monster Train", source=MT1_SRC, retrieved=TODAY,
        notes=("Run structure of MT1 (v2.x incl. The Last Divinity DLC) from the community wiki. artifacts = "
               "Module:Artifacts/Data (MT1 artifacts carry a clan/source group but no rarity on the wiki; "
               "'Concealed Caverns' = event-only, 'Major Enhancement' = boss reward after Rings 3/6; "
               "divine_effect = the DLC 'Divine' one-battle version). Completeness: artifacts module "
               f"{len(artifacts)} vs Category:Artifacts {art_cat_n}; upgrades parsed {len(upgrades)}; events parsed "
               f"{len(mt1_events(pages))}; combats {len(combats)}; covenant ranks {len(covenant)} (wiki list 1-25); "
               f"mutators {len(mutators)}; expert challenges {len(experts)}. Not on the wiki: clan level "
               "thresholds/unlock tables (clans level 1-10, see rules.clan_xp)."),
        artifacts=artifacts,
        merchants_and_upgrades=merch,
        events=mt1_events(pages),
        pyre=OrderedDict(
            summary=prose(pages.get("Pyre", ""), 1500, "Pyre"),
            note=("MT1 has a single Pyre (no Pyre Hearts). Major-boss rewards add Pyre attack/health via "
                  "'Major Enhancement' artifacts (Fel's Remorse, Herzal's Compound, Light of Seraph: +10 Attack, "
                  "+30 Pyre Health each).")),
        rules=OrderedDict(
            run_structure=OrderedDict(
                summary=("9 Rings of Hell. Rings 1-8 each end in one battle (8 battles per run); Ring 9 (The "
                         "Frozen Heart) ends the run, or with The Last Divinity DLC and >= 100 Pact Shards (or Hell "
                         "Rush) holds a 9th battle vs The Last Divinity. Rings after the first split into two "
                         "branches: picking a node on one side locks the other side's nodes; some rings have a "
                         "shared centre node. Minor bosses on Rings 1, 2, 4, 5, 7 (identity hidden until the "
                         "battle, optional Trial for extra reward); major (flying) bosses on Rings 3, 6, 8 with the "
                         "variant shown on the map; after Rings 3 and 6 pick a boss artifact; after the Ring 8 "
                         "Seraph fight the run ends."),
                battle_rewards=("Each battle: gold, two card packs of three (one per clan); trial rewards per "
                                "Battle Effects page: unit draft (banner), random artifact, or coins 75/150/400."),
                node_availability_by_ring=avail, rings=rings),
            battle=battle,
            trials=trials,
            major_boss_variants=variants,
            covenant=covenant,
            covenant_note=prose(own_text(cp), 600),
            pact_shards=pact,
            combats=combats,
            mutators=mutators,
            expert_challenges=experts,
            game_modes=OrderedDict(
                hell_rush=prose(pages.get("Hell Rush", ""), 900, "Hell Rush"),
                daily_challenge=prose(pages.get("Daily Challenge", ""), 500, "Daily Challenge"),
                custom_challenge=prose(pages.get("Custom Challenge", ""), 600, "Custom Challenge")),
            champions=prose(pages.get("Champions", ""), 900, "Champion"),
            banner_units=prose(own_text(pages.get("Banner Unit", "")), 700, "Banner Unit"),
            clan_xp=("Clans level 1-10 from run XP (score); levels unlock more of the clan's cards and artifacts "
                     "(the MT1 wiki has no level table; the save-file page shows classXP with level 10 as cap). "
                     "Exiled champions were added in update 1.2; Wurmkin unlocks after a Covenant 1 win."),
            scoring=prose(pages.get("Scoring", ""), 900, "Scoring"),
        ))
    return enemy_doc, structure


# ================================================================= MT2
MT2_RING_PAGES = OrderedDict([(1, "Limbo"), (2, "Heaven's Gate"), (3, "The Wingless Hive"), (4, "Celestial Forge"),
                              (5, "The Aviary"), (6, "High Heaven"), (7, "The Observatory"), (8, "Heaven's Maw"),
                              (9, "The Great Abyss")])
MT2_SS_PAGES = ["First Battle", "Maera's Region", "Thaddeus's Region", "Tivi's Region", "Lylith's Region",
                "Final Battle"]
MT2_ROLE_CATS = {"Attackers": "attacker", "Clerics": "cleric", "Heavies": "heavy", "Hordes": "horde",
                 "Junkers": "junker", "Mages": "mage", "Shieldguards": "shieldguard", "Enchanters": "enchanter",
                 "Bosses": "boss", "Trial spawns": "trial spawn"}
MT2_PATTERN = {
    "normal": ("Enters on the bottom floor with its wave (waves are fixed per combat and covenant). After the "
               "turn ends, Quick units strike, then enemies, then your other units; Resolve triggers fire; "
               "non-Rooted enemies ascend one floor. In the Pyre Room it fights the Pyre until it or the Pyre dies."),
    "elite": ("Covenant 10 'Chosen' elite: a much tougher version of a wave enemy added to the flying-boss battles "
              "(Rings 3, 6, 8); behaves like a normal wave enemy."),
    "boss": ("Minor boss: arrives in the final wave (after 'A Brief Respite', removed at Covenant 7) and is "
             "Relentless: fights on its floor until it or all your units there die; the floor it leaves freezes. "
             "Any combat of the ring can pair with any of the ring's bosses; Covenant 4+ adds an extra mechanic."),
    "flying_boss": ("Flying boss: present from turn 1 on the topmost occupied floor, moves to a different floor every "
                    "turn (prefers occupied floors, the one visited least recently -> a 1-2-3 or 1-3-2 cycle), can "
                    "be hit and targeted there, uses its variant's triggers while flying (5 flying turns on Ring 3, "
                    "7 on Rings 6/8), and becomes a Relentless boss in the final wave (some triggers switch off). "
                    "Immune to Advance/Retreat/Rooted; can be Ascended/Descended but not into the Pyre Room. "
                    "Ring 3/6/8 combats are tied to the boss variant; Titan Trials make the variant stronger and "
                    "grant a Titan Essence."),
    "final_boss": ("Ring 9 Titan, fought together with the other two Titans in 'Clash with the Titans' "
                   "(unlocked by winning all three Titan Trials); each Titan has a unique rule (see pattern)."),
    "minion": "Spawned by a boss (not part of the wave list); see the parent boss.",
    "special": "Special spawn (bonus gold carrier or Trial spawn); see pattern.",
    "ss_boss": ("Soul Savior mini-boss: Relentless final-wave boss of the First Battle (Astrael) or of a region's "
                "first combat (two candidates per region)."),
    "ss_flying_boss": ("Soul Savior region boss (Lifemother's child): flying boss of the region's second battle with "
                       "three variants; defeating it grants a Soul and imposes the variant's negative mutator for the "
                       "rest of the run (see abilities)."),
    "ss_elite": ("'Mother's' empowered version of a Soul Savior enemy; replaces the base enemy in waves as more "
                 "regions are completed (and on higher difficulty tiers). Otherwise a normal wave enemy."),
    "ss_final_boss": ("Soul Savior final boss (Final Battle after all four regions); three variants with their own "
                      "fixed waves."),
}


def mt2_stat_rows(raw):
    """'Variant: {{AttackHealth|7/425}}</br>...' -> [(variant, atk, hp)]."""
    out = []
    for part in re.split(r"<\s*/?\s*br\s*/?\s*>|\n", raw or "", flags=re.I):
        if not part.strip():
            continue
        # a bold number followed by a non-attack icon (Chosen Acolyte: '20 [Rejuvenate] / 30 Health') is not attack
        part = re.sub(r"'''\s*\d+\s*'''\s*\[\[\s*file:(?!Attack)[^\]]*\]\]", "", part, flags=re.I)
        part = nofile(part)
        var = None
        m = re.match(r"\s*([^{:]+?):\s*(.*)$", part, re.S)
        if m and "{{" in m.group(2):
            var, part = clean(m.group(1)), m.group(2)
        s = clean(part)
        nums = re.search(r"(-?\d+)\s*(?:x\s*\d+\s*)?/\s*(-?\d+)", s)
        if nums:
            out.append((var, int(nums.group(1)), int(nums.group(2)), s))
        else:
            a = re.search(r"(-?\d+)\s*Attack", s)
            h = re.search(r"(-?\d+)\s*Health", s)
            out.append((var, int(a.group(1)) if a else None, int(h.group(1)) if h else None, s))
    return out


def onlyinclude(text):
    m = re.search(r"<onlyinclude>(.*?)</onlyinclude>", text or "", re.S)
    return m.group(1) if m else (text or "")


def mt2_nav_classes(pages):
    """Template:EnemiesNav -> {name: (row label, ring group, is_minion)}."""
    nav = onlyinclude(pages.get("Template:EnemiesNav", {}).get("text", ""))
    out = {}
    group = label = None
    for tb in tables(nav):
        for cells, flags in parse_rows(tb):
            for c in cells[:-1]:
                g = re.search(r"'''Rings (\d)\D+(\d)'''", c)
                if g:
                    group = (int(g.group(1)), int(g.group(2)))
                lab = re.findall(r"'''(?:\[\[)?(Waves|Bosses|Chosen Enemies|Other)(?:\]\])?'''", c)
                if lab:
                    label = lab[-1]
            content = cells[-1]
            if re.search(r"'''(?:\[\[)?(Waves|Bosses|Chosen Enemies|Other)", content):
                label = re.findall(r"'''(?:\[\[)?(Waves|Bosses|Chosen Enemies|Other)", content)[-1]
                continue
            minions = set()
            for m in re.finditer(r"\]\]\s*\(([^)]*)\)", content):
                minions.update(links(m.group(1)))
            for tgt in links(content):
                if tgt in ("Waves", "Enemies"):
                    continue
                out[tgt] = (label, group, tgt in minions)
    return out


def mt2_ss_nav(pages):
    """Template:EnemiesNavSS -> [(name, row label, region)]."""
    nav = onlyinclude(pages.get("Template:EnemiesNavSS", {}).get("text", ""))
    out, region, label = [], None, None
    for tb in tables(nav):
        for cells, flags in parse_rows(tb):
            for c in cells[:-1]:
                r = links(c)
                if r and ("Region" in r[0] or r[0] == "First Battle"):
                    region = r[0]
                elif "Multiple" in c:
                    region = "Multiple"
                lab = re.findall(r"'''(Waves|Boss|Bosses)'''", c)
                if lab:
                    label = lab[-1]
                if "Other" in c:
                    label, region = "Other", None
            for m in LINK_RE.finditer(cells[-1]):
                tgt, txt = (m.group(1) or "").strip(), (m.group(3) or "")
                if not tgt or re.match(r"(?i)(file|category|image)\s*:", tgt) or "Region" in tgt or tgt in (
                        "First Battle", "Enemies (Soul Savior)"):
                    continue
                out.append((tgt, label, region))
                if txt.startswith("(Mother's)"):
                    out.append(("Mother's " + tgt, label, region))
    return out


def mt2_combat_tables(pages, title, ring):
    """Ring/region page -> [{name, ring, description, notes, waves{tab: [..]}}]."""
    txt = pages.get(title, {}).get("text", "")
    out = []
    hs = headings(txt)
    for i, (s, e, lv, name) in enumerate(hs):
        end = hs[i + 1][0] if i + 1 < len(hs) else len(txt)
        body = txt[e:end]
        if "Wave" not in body or "{|" not in body:
            continue
        desc = re.search(r"^:\s*''(.*?)''\s*$", body, re.M)
        intro = body.split("<tabber>")[0].split("{|")[0]
        intro = re.sub(r"^:\s*''.*$", "", intro, flags=re.M)
        tabs = re.split(r"\|-\|", body) if "<tabber>" in body else ["=" + body]
        waves = OrderedDict()
        for tab in tabs:
            if "{|" not in tab:
                continue
            lab = clean(tab.split("=", 1)[0]) or "all"
            for tb in tables(tab):
                for cells in rows(tb):
                    if len(cells) < 2:
                        continue
                    wn = clean(cells[0])
                    if not re.fullmatch(r"\d+", wn):
                        continue
                    names = links(cells[1])
                    plain = clean(re.sub(r"\[\[[^\]]*\]\]", "", cells[1])).replace(",", " ").split()
                    if "Boss" in plain:
                        names = ["Boss"] + names
                    if not names:
                        names = [clean(cells[1])]
                    waves.setdefault(lab, []).append(f"{wn}: " + ", ".join(names))
        if waves:
            out.append(OrderedDict(name=clean(name), ring=ring, page=title,
                                   description=clean(desc.group(1)) if desc else None,
                                   notes=prose(intro, 500, title) or None, waves=waves))
    return out


def gamedata_index(gd):
    """Optional game-data dump -> lookups (characters by name, scenario-referenced names, other folders)."""
    if not gd or not Path(gd, "CharacterData").is_dir():
        return None
    gd = Path(gd)

    def load(f):
        try:
            return json.loads(f.read_text(encoding="utf-8-sig"))
        except Exception:
            return {}

    def eng(v):
        return v.get("english") if isinstance(v, dict) else v

    chars, by_id = defaultdict(list), {}
    for f in sorted((gd / "CharacterData").glob("*.json")):
        for c in load(f).get("characters", []):
            nm = eng(c.get("names")) or f.stem
            rec = dict(id=c.get("id"), name=nm, hp=c.get("health"), atk=c.get("attack_damage"),
                       size=c.get("size"), file=f.stem)
            chars[norm(nm)].append(rec)
            by_id[c.get("id")] = rec
    ref = set()

    def walk(o):
        if isinstance(o, dict):
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
        elif isinstance(o, str) and o in by_id:
            ref.add(by_id[o]["name"])

    scen = {}
    for f in sorted((gd / "ScenarioData").glob("*.json")):
        if f.stem.startswith(("Test", "Cheat")) or "_FTUE" in f.stem:
            continue
        d = load(f)
        walk(d)
        scen[f.stem] = eng(d.get("battleNameKey"))

    def relic_names(folder):
        out = []
        for f in sorted((gd / folder).glob("*.json")):
            for r in load(f).get("relics", []):
                ext = (r.get("extensions") or [{}])[0]
                kind = next(iter(ext), None)
                out.append(dict(id=r.get("id"), name=eng(r.get("names")) or r.get("name") or f.stem, file=f.stem,
                                rarity=(ext.get(kind) or {}).get("rarity") if kind else None,
                                clan=(ext.get(kind) or {}).get("class") if kind else None,
                                pools=r.get("pools")))
        return out

    return dict(chars=chars, ref=ref, scen=scen,
                relics=relic_names("CollectableRelicData"), pyre=relic_names("PyreArtifactData"),
                enhancers=relic_names("EnhancerData"), mutators=relic_names("MutatorData"),
                covenants=relic_names("CovenantData"), sins=relic_names("SinsData"), souls=relic_names("SoulData"),
                events=[f.stem for f in sorted((gd / "StoryEventData").glob("*.json"))])


def gd_char(gdi, name, prefix=False):
    if not gdi:
        return None
    c = gdi["chars"].get(norm(name))
    if not c and prefix:
        c = next((v for k, v in sorted(gdi["chars"].items()) if k.startswith(norm(name))), None)
    return c[0] if c else None


def scrape_mt2(gamedata=None):
    item, pages = smt.mt2_dump()
    src = f"https://monstertrain2.miraheze.org (CC BY-SA) via archive.org backup {item}"
    gdi = gamedata_index(gamedata)
    vocab = keyword_vocab("mt2")
    T = lambda t: pages.get(t, {}).get("text", "")  # noqa: E731
    navc = mt2_nav_classes(pages)

    # ---- combats + waves
    combats = []
    for ring, t in MT2_RING_PAGES.items():
        combats += mt2_combat_tables(pages, t, ring)
    ss_combats = []
    for t in MT2_SS_PAGES:
        ss_combats += mt2_combat_tables(pages, t, "Soul Savior: " + t)
    wave_idx = defaultdict(list)
    for cb in combats + ss_combats:
        seen = defaultdict(set)
        for tab, ws in cb["waves"].items():
            for w in ws:
                wn, rest = w.split(": ", 1)
                for nm in rest.split(", "):
                    seen[nm.strip()].add(int(wn))
        for nm, wset in seen.items():
            r = f"R{cb['ring']}" if isinstance(cb["ring"], int) else cb["ring"]
            wave_idx[nm].append(f"{r} {cb['name']} (wave {', '.join(map(str, sorted(wset)))})")
    trials_page = T("Trials")
    boss_variant_rows = []
    for tb in tables(section(trials_page, "Boss Variants")):
        for cells in rows(tb):
            for c in cells:
                if "<br>" in c and "'''" in c:
                    boss_variant_rows.append(cell(nofile(c)))

    # ---- enemies from infoboxes
    enemies, seen_names = [], set()
    for title, p in pages.items():
        if p["ns"] != 0 or p["redirect"]:
            continue
        txt = p["text"]
        roles = sorted({v for k, v in MT2_ROLE_CATS.items()
                        if re.search(r"\[\[\s*Category:\s*" + re.escape(k) + r"\s*\]\]", txt)})
        for tpl in ("Enemy", "EnemySS", "FlyingBossSS"):
            for s, e, inner in find_templates_pos(txt, tpl):
                pr = smt.split_params(inner)
                name = clean(pr.get("name", "")) or title
                if name in seen_names:
                    continue
                seen_names.add(name)
                after = txt[e:]
                m = re.search(r"^=+.*=+\s*$|\{\{\s*(Enemy|EnemySS)\b", after, re.M)
                blurb = prose(after[:m.start()] if m else after, 450, title)
                if tpl == "Enemy":
                    enemies.append(mt2_enemy_standard(name, pr, title, blurb, roles, navc, wave_idx,
                                                      boss_variant_rows, vocab, gdi))
                else:
                    enemies.append(mt2_enemy_ss(name, pr, tpl, title, blurb, wave_idx, vocab, gdi))

    # ---- Soul Savior enemies with no infobox: names from the SS nav + SS wave tables
    ss_info = OrderedDict()  # name -> (nav label, region)
    for nm, lab, region in mt2_ss_nav(pages):
        ss_info.setdefault(nm, (lab, region))
    for cb in ss_combats:
        for ws in cb["waves"].values():
            for w in ws:
                for nm in w.split(": ", 1)[1].split(", "):
                    if nm and nm != "Boss":
                        ss_info.setdefault(nm.strip(), ("Waves", cb["page"]))
    region_boss_text, region_bosses = mt2_region_boss_text(pages)
    for e in enemies:  # infobox-based SS entries: region bosses fly, the rest are mini-bosses
        if e["extra"].get("mode") and e["category"] in ("boss", "flying_boss"):
            e["category"] = "flying_boss" if e["name"] in region_bosses else "boss"
            wiki = e["pattern"].split(" Wiki: ", 1)
            e["pattern"] = MT2_PATTERN["ss_" + e["category"]] + (" Wiki: " + wiki[1] if len(wiki) > 1 else "")
    for nm, (lab, region) in ss_info.items():
        if nm in seen_names or nm == "Collector":
            continue
        seen_names.add(nm)
        if nm == "The Lifemother":
            cat = "final_boss"
        elif nm in region_bosses:
            cat = "flying_boss"
        elif lab in ("Boss", "Bosses") or nm in region_boss_text:
            cat = "boss"
        elif nm.startswith("Mother's"):
            cat = "elite"
        else:
            cat = "normal"
        g = gd_char(gdi, nm, prefix=(nm == "The Lifemother"))
        abil = region_boss_text.get(nm, [])
        extra = OrderedDict(mode="Soul Savior (Destiny of the Railforged DLC)", wiki_page=None,
                            stats_source="game-data dump (no wiki infobox)" if g else None,
                            keywords=tag_keywords(abil, vocab))
        if cat == "final_boss":
            pat = MT2_PATTERN["ss_final_boss"] + " Wiki: " + prose(section(T("Final Battle"), "Combats"), 700)
            if gdi:
                extra["variants"] = [OrderedDict(variant=c["name"], attack=c["atk"], health=c["hp"])
                                     for k, cs in gdi["chars"].items() if k.startswith(norm(nm)) for c in cs]
        elif cat in ("flying_boss", "boss"):
            pat = MT2_PATTERN["ss_" + cat]
        elif cat == "elite":
            pat = MT2_PATTERN["ss_elite"]
        else:
            pat = MT2_PATTERN["normal"]
        waves = sorted(set(wave_idx.get(nm, [])))
        enemies.append(entry("mt2", nm, cat, "Soul Savior: " + (region or "?"), g["hp"] if g else None, None,
                             g["atk"] if g else None, g["size"] if g else None, abil, pat, waves, extra))

    # ---- areas of Soul Savior enemies; standard minor bosses pair with every combat of their ring
    ring_combats = defaultdict(list)
    for cb in combats:
        ring_combats[cb["ring"]].append(cb["name"])
    for e in enemies:
        if e["extra"].get("mode"):
            regs = sorted({m.group(1) for w in e["waves"]
                           for m in [re.match(r"Soul Savior: (First Battle|Final Battle|\S+'s Region)", w)] if m})
            if regs:
                e["area"] = "Soul Savior: " + ", ".join(regs)
            elif ss_info.get(e["name"], (None, None))[1]:
                reg = ss_info[e["name"]][1]
                e["area"] = "Soul Savior: " + reg
                if e["category"] == "boss" and not e["waves"]:
                    e["waves"] = [f"Soul Savior: {reg} boss wave ('Boss' slot of the "
                                  f"{'first' if 'Region' in reg else 'only'} combat)"]
        elif e["category"] == "boss":
            rings = [int(x) for x in re.findall(r"\d", e["area"] or "")]
            e["waves"] = [f"R{r} boss: final wave of any Ring {r} combat ({', '.join(ring_combats[r])})"
                          for r in rings]

    # ---- game-data sizes (wiki has no enemy size field) + stat cross-check
    mism = []
    if gdi:
        for en in enemies:
            g = gd_char(gdi, en["name"])
            if not g:
                continue
            if en["size"] is None:
                en["size"] = g["size"]
                en["extra"]["size_source"] = "game-data dump"
            if en["attack"] is None and g["atk"] is not None and en["extra"].get("stats_source") is None:
                en["attack"] = g["atk"]
                en["extra"]["attack_source"] = "game-data dump (wiki infobox gives no attack)"
            if en["hp"]["base"] is None and g["hp"] is not None and en["extra"].get("stats_source") is None:
                en["hp"]["base"] = g["hp"]
                en["extra"]["hp_source"] = "game-data dump (wiki infobox gives no health)"
            if en["extra"].get("mode") is None and en["hp"]["base"] is not None and g["hp"] is not None and \
                    (en["hp"]["base"] != g["hp"] or (en["attack"] is not None and en["attack"] != g["atk"])):
                mism.append(f"{en['name']} wiki {en['attack']}/{en['hp']['base']} vs data {g['atk']}/{g['hp']}")

    # ---- completeness
    checks = []
    std = [e for e in enemies if not e["extra"].get("mode")]
    ss = [e for e in enemies if e["extra"].get("mode")]
    nav_names = {n for n in navc}
    have = {e["name"] for e in enemies}
    checks.append(f"standard mode: {len(std)} enemies from {{{{Enemy}}}} infoboxes vs Template:EnemiesNav "
                  f"{len(nav_names)} names -> nav-only {sorted(nav_names - have) or 'none'}")
    checks.append(f"Soul Savior: {len(ss)} enemies ({sum(1 for e in ss if e['extra'].get('wiki_page'))} with a wiki "
                  f"infobox, the rest named only in Template:EnemiesNavSS / region wave tables)")
    if gdi:
        refn = {norm(n): n for n in gdi["ref"]}
        wiki = {norm(e["name"]) for e in enemies}
        only_gd = sorted(n for k, n in refn.items() if k not in wiki)
        only_wiki = sorted(e["name"] for e in enemies if norm(e["name"]) not in refn)
        checks.append(f"vs game-data ScenarioData (names of characters referenced by non-test battles: {len(refn)}): "
                      f"game-data-only {only_gd or 'none'}; wiki-only (not referenced directly by a scenario: "
                      f"boss-spawned minions, trial spawns, endless-only) {only_wiki or 'none'}")
        checks.append(f"wiki vs game-data base stats differ for {len(mism)} standard enemies (wiki often lists the "
                      f"in-game tooltip incl. multistrike/variant; examples: {mism[:12]})")
    else:
        checks.append("game-data cross-check not run (--mt2-gamedata)")
    no_wave = sorted(e["name"] for e in std if not e["waves"])
    checks.append(f"standard enemies absent from every ring wave table: {no_wave} (bosses are written as 'Boss' "
                  f"in the tables; minions/Chosen/trial spawns are added by rules)")
    enemy_doc = OrderedDict(
        game="Monster Train 2", source=src, retrieved=TODAY,
        notes=("Version: MT2 as documented on the community wiki (patches through 2.2.1; DLC Destiny of the "
               "Railforged adds the Soul Savior mode). Read from Miraheze's archive.org backup because the live wiki "
               "serves a bot challenge. Standard-mode enemies = every {{Enemy}} infobox (also the Chosen elites, "
               "cherubs, Fleshling and Chosen Prayerstone sections inside parent pages); Soul Savior enemies = "
               "{{EnemySS}}/{{FlyingBossSS}} infoboxes + names that only appear in the SS nav or region wave tables "
               "(extra.mode set). category: normal (wave enemy; extra.roles = wiki role categories), elite (Covenant "
               "10 'Chosen' / Soul Savior 'Mother's' versions), boss (minor ring boss), flying_boss (Rings 3/6/8; "
               "Stryx & Hallow are a duo), final_boss (Ring 9 Titans / The Lifemother), minion (boss-spawned), "
               "special (Collector, Skull Collector, Penitent Prayerstone trial spawn). hp.base/attack = baseline "
               "(Covenant 0) stats; hp.covenant = the infobox's Covenant 1/4/8 rows (Soul Savior: Tangle/Overgrowth "
               "difficulty rows). Flying-boss variants keep per-variant stats in extra.variants. size = game-data "
               "dump (the wiki has no enemy size). waves = ring/region page wave tables, all covenant tabs merged. "
               "Completeness: " + " | ".join(checks)),
        enemies=enemies)

    structure = mt2_structure(pages, item, src, combats, ss_combats, gdi)
    return enemy_doc, structure


def mt2_region_boss_text(pages):
    """Soul Savior region pages -> ({boss name: ['Variant: mechanic text']}, {region boss names})."""
    out, region_bosses = defaultdict(list), set()
    for t in MT2_SS_PAGES[1:]:
        txt = pages.get(t, {}).get("text", "")
        boss = re.search(r"home to \[\[([^\]|]+)", txt)
        boss = boss.group(1) if boss else None
        if boss:
            region_bosses.add(boss)
        bc = section(txt, "Boss Combat")
        for title, body in sections(bc, 3):
            intro = body.split("<tabber>")[0]
            intro = re.sub(r"^:\s*''.*$", "", intro, flags=re.M)
            if boss:
                out[boss].append(f"{title}: {prose(intro, 300)}")
        fc = section(txt, "First Combat")
        m = re.search(r"possible bosses are \[\[([^\]|]+)\]\] and \[\[([^\]|]+)\]\]", fc)
        if m:
            for b in m.groups():
                out[b].append(f"Region mini-boss of {t} (first combat).")
    fb = pages.get("First Battle", {}).get("text", "")
    if "Astrael" in fb:
        out.setdefault("Astrael the First Reborn", [])
    return out, region_bosses


def mt2_enemy_standard(name, pr, page, blurb, roles, navc, wave_idx, boss_variant_rows, vocab, gdi):
    rows0 = mt2_stat_rows(pr.get("stats0", ""))
    base = rows0[0] if rows0 else (None, None, None, "")
    cov = []
    for k in ("stats1", "stats4", "stats8"):
        rr = mt2_stat_rows(pr.get(k, ""))
        if rr:
            cov.append(f"cov {k[-1]}+: " + "; ".join((f"{v}: " if v else "") + f"{a}/{h}" for v, a, h, _ in rr))
    abil = split_lines(pr.get("ability0", ""))
    for k in ("ability1", "ability4", "ability8", "abiltiy8"):
        if pr.get(k):
            abil += [f"[Covenant {k[-1]}+] {x}" for x in split_lines(pr[k])]
    rings = sorted(int(k[4:]) for k in pr if re.fullmatch(r"ring\d", k) and clean(pr[k]))
    label, group, minion = navc.get(name, (None, None, False))
    if minion or name in ("Chosen Prayerstone",):
        cat = "minion"
    elif label == "Waves":
        cat = "normal"
    elif label == "Chosen Enemies" or name.startswith("Chosen "):
        cat = "elite"
    elif label == "Other":
        cat = "special"
    elif 9 in rings or name in ("Dominion", "Entropy", "Savagery"):
        cat = "final_boss"
    elif label == "Bosses" or "Relentless" in " ".join(abil):
        cat = "flying_boss" if set(rings) & {3, 6, 8} else "boss"
    else:
        cat = "normal"
    pattern = MT2_PATTERN[cat]
    if cat == "flying_boss":
        key = name.split(",")[0].split("-")[-1].replace("Seraph Aeternus", "").strip()
        vs = [r for r in boss_variant_rows if key and key in r or name.split(",")[0] in r]
        if "Seraph" in name:
            vs = [r for r in boss_variant_rows if ("Dominion" in r and "Dominant" in name) or
                  ("Savagery" in r and "Savage" in name) or ("Entropy" in r and "Entropic" in name)]
        if vs:
            pattern += " Variants (normal / Titan Trial II): " + " | ".join(vs)
    if blurb:
        pattern += " Wiki: " + blurb
    waves = sorted(set(wave_idx.get(name, [])))
    if not waves:  # bosses/minions/Collector: the infobox's per-ring combat field
        waves = [f"R{k[4:]}: {cell(pr[k])}" for k in sorted(pr) if re.fullmatch(r"ring\d", k) and clean(pr[k])]
    titan = clean(pr.get("titan", ""))
    extra = OrderedDict(mode=None, wiki_page=page, roles=roles or None,
                        titan=None if titan in ("", "None", "N/A") else titan, keywords=tag_keywords(abil, vocab))
    if len(rows0) > 1 or (rows0 and rows0[0][0]):
        extra["variants"] = [OrderedDict(variant=v, attack=a, health=h) for v, a, h, _ in rows0]
    area = (f"Ring {rings[0]}" if len(rings) == 1 else f"Rings {', '.join(map(str, rings))}") if rings else None
    return entry("mt2", name, cat, area, base[2], "; ".join(cov) or None, base[1], None, abil, pattern, waves, extra)


def mt2_enemy_ss(name, pr, tpl, page, blurb, wave_idx, vocab, gdi):
    variants = []
    if tpl == "FlyingBossSS":
        for i in range(1, 5):
            if not pr.get(f"v{i}name"):
                continue
            variants.append(OrderedDict(variant=clean(pr[f"v{i}name"]), attack=to_int(pr.get(f"v{i}atk")),
                                        health=to_int(pr.get(f"v{i}hp")),
                                        abilities=[clean(pr[k]) for k in (f"v{i}ability1", f"v{i}ability2",
                                                                          f"v{i}ability3") if pr.get(k)]))
        atk, hp = (variants[0]["attack"], variants[0]["health"]) if variants else (None, None)
        abil = [f"{v['variant']}: {v['abilities'][0]}" for v in variants if v["abilities"]]
        cov = "per-variant; Tangle/Overgrowth ability values in extra.variants"
        cat = "flying_boss"
    else:
        atk, hp = to_int(pr.get("atk")), to_int(pr.get("hp"))
        a2 = to_int(pr.get("atk2")) if pr.get("atk2") else (math.ceil(atk * 1.5) if atk is not None else None)
        h2 = to_int(pr.get("hp2")) if pr.get("hp2") else (math.ceil(hp * 1.25) if hp is not None else None)
        a3 = to_int(pr.get("atk3")) if pr.get("atk3") else (math.ceil(atk * 2) if atk is not None else None)
        h3 = to_int(pr.get("hp3")) if pr.get("hp3") else (math.ceil(hp * 1.5) if hp is not None else None)
        cov = f"difficulty Tangle: {a2}/{h2}; Overgrowth: {a3}/{h3} (attack/health; Soul Savior difficulty tiers)"
        abil = split_lines(pr.get("ability1", ""))
        for k, lab in (("ability2", "Tangle"), ("ability3", "Overgrowth")):
            if pr.get(k) and clean(pr[k]) != clean(pr.get("ability1", "")):
                abil += [f"[{lab}] {x}" for x in split_lines(pr[k])]
        boss = any(x in name for x in ("Astrael", "Athane the Fallen", "Korin the Judged"))
        cat = "boss" if boss else ("elite" if name.startswith("Mother's") else "normal")
    pattern = MT2_PATTERN[cat if cat == "normal" else "ss_" + cat]
    if blurb:
        pattern += " Wiki: " + blurb
    extra = OrderedDict(mode="Soul Savior (Destiny of the Railforged DLC)", wiki_page=page,
                        keywords=tag_keywords(abil, vocab), combats=clean(pr.get("combats", "")) or None)
    if variants:
        extra["variants"] = variants
    return entry("mt2", name, cat, "Soul Savior", hp, cov, atk, None, abil, pattern,
                 sorted(set(wave_idx.get(name, []))), extra)


def mt2_structure(pages, item, src, combats, ss_combats, gdi):
    T = lambda t: pages.get(t, {}).get("text", "")  # noqa: E731
    checks = []

    # ---- artifacts
    artifacts = []
    ap = T("Artifacts")
    for clan, body in sections(ap, 2):
        subs = [(clan, re.split(r"^===", body, flags=re.M)[0])] + [(f"{clan} / {t}", b) for t, b in sections(body, 3)]
        for group, b in subs:
            for tb in tables(b):
                for cells in rows(tb):
                    if len(cells) < 2 or cells[0].startswith("!"):
                        continue
                    nm = [x for x in links(cells[0])]
                    if not nm:
                        continue
                    artifacts.append(OrderedDict(name=nm[-1], clan=group.split(" / ")[0],
                                                 group=group.split(" / ")[1] if " / " in group else None,
                                                 rarity=None, effect=clean(cells[1])))
    nav_arts = set()
    for t, p in pages.items():
        if p["ns"] == 10 and t.endswith("Artifacts") and "Testing" not in t:
            body = re.search(r"<onlyinclude>(.*?)</onlyinclude>", p["text"], re.S)
            nav_arts.update(x for x in links(body.group(1) if body else p["text"]) if x != "Artifacts")
    have = {a["name"] for a in artifacts}
    clan_words = {c for c, _ in sections(ap, 2)} | {"Endless Mode", "Clanless", "Boss Artifacts"}
    nav_arts = {x for x in nav_arts if x not in clan_words and not x.startswith("Template:")}
    curses = sorted(x for x in nav_arts if x.startswith("Curse of"))
    nav_arts -= set(curses)
    checks.append(f"artifacts: Artifacts page {len(artifacts)} rows vs <Clan>Artifacts nav templates {len(nav_arts)} "
                  f"names -> nav-only {sorted(nav_arts - have) or 'none'}, page-only {sorted(have - nav_arts) or 'none'}"
                  f" (+ {len(curses)} Endless-mode curses listed in the nav, kept under rules.endless_mode)")
    if gdi:
        rel = {norm(r["name"]): r for r in gdi["relics"]}
        for a in artifacts:
            r = rel.get(norm(a["name"]))
            if r:
                a["rarity"] = r["rarity"]
        only_gd = sorted(r["name"] for k, r in rel.items() if k not in {norm(a['name']) for a in artifacts})
        checks.append(f"vs game-data CollectableRelicData {len(gdi['relics'])} relics: rarity filled for "
                      f"{sum(1 for a in artifacts if a['rarity'])}; game-data-only {only_gd or 'none'}")

    # ---- merchants & upgrades
    mp = T("Merchants")
    removal = []
    for tb in tables(section(mp, "Purge Card", 3)):
        for cells in rows(tb):
            if cells and re.fullmatch(r"\d+", clean(cells[0])):
                removal.append(OrderedDict(removal=int(clean(cells[0])), cov0_2=clean(cells[1]),
                                           cov3plus=clean(cells[2]) if len(cells) > 2 else None))
    merchants = []
    for t in ("Merchant of Steel", "Merchant of Magic", "Merchant of Arms", "Merchant of Trinkets"):
        txt = T(t)
        node = smt.split_params(smt.find_templates(txt, "Node")[0]) if smt.find_templates(txt, "Node") else {}
        servs = OrderedDict()
        for st, sb in sections(txt, 3):
            if st not in ("Greetings", "Chatter", "Thanks", "Bothered", "Merchant Quotes", "Notes"):
                servs[st] = prose(sb, 900, t)
        merchants.append(OrderedDict(name=t, description=clean(node.get("description", "")),
                                     guaranteed_rings=clean(node.get("guaranteed", "")) or None,
                                     possible_rings=clean(node.get("possible", "")) or None,
                                     overview=lead(txt, 500, t), services=servs))
    upgrades = []
    up = T("Upgrades")
    for tb in tables(up):
        cap = re.search(r"^\|\+\s*(.+)$", tb, re.M)
        cap = clean(cap.group(1)) if cap else ""
        prs = parse_rows(tb)
        cols = next(([cell(c) for c in cs] for cs, fl in prs if all(fl)), [])
        for cells in rows(tb):
            if len(cells) < 2 or not links(cells[0]):
                continue
            rec = OrderedDict(name=links(cells[0])[-1], table=cap or None)
            for ci, c in enumerate(cells[1:], start=1):
                key = (cols[ci] if ci < len(cols) else f"col{ci}").lower().replace(" ", "_") or f"col{ci}"
                key = "soul_savior_version" if "soul_savior" in key else key
                rec[key] = cell(c)
            upgrades.append(rec)
    if gdi:
        en = {norm(r["name"]) for r in gdi["enhancers"]}
        wk = {norm(u["name"]) for u in upgrades}
        gd_only = sorted(r["name"] for r in gdi["enhancers"] if norm(r["name"]) not in wk)
        slabs = [x for x in gd_only if x.endswith("slab")]
        checks.append(f"upgrades: Upgrades page {len(upgrades)} rows vs game-data EnhancerData {len(gdi['enhancers'])} "
                      f"-> game-data-only {len(slabs)} Soul Savior '-slab' versions (listed in the wiki table's Soul "
                      f"Savior column, not as rows) + {[x for x in gd_only if x not in slabs]}; wiki-only "
                      f"{sorted(u['name'] for u in upgrades if norm(u['name']) not in en)} (spelling)")
    merch = OrderedDict(
        overview=prose(re.split(r"\{\|", own_text(mp))[0], 400, "Merchants"),
        reroll=clean(section(mp, "Re-roll", 3)), purge_costs=removal, merchants=merchants,
        upgrade_slots=prose(re.split(r"\{\|", re.sub(r"\{\{Unfinished[^}]*\}\}", "", up))[0], 700, "Upgrades"),
        upgrades=upgrades)

    # ---- events + nodes
    events, nodes = [], []
    for t, p in pages.items():
        if p["ns"] != 0 or p["redirect"]:
            continue
        ev = smt.find_templates(p["text"], "Event")
        if ev:
            pr = smt.split_params(ev[0])
            opts = section(p["text"], "Options")
            events.append(OrderedDict(name=re.sub(r"\s*\(event\)$", "", t), type="Celestial Alcove event",
                                      rings=clean(pr.get("rings", "")) or None,
                                      priority_tickets=to_int(pr.get("priority")),
                                      followup=clean(pr.get("followup", "")) or None,
                                      summary=cut(lead(p["text"], 400, t) + (" Options: " + " / ".join(
                                          clean(x) for x in re.findall(r"^\*+\s*(.+)$", opts, re.M)) if opts else ""),
                                          900)))
        nd = smt.find_templates(p["text"], "Node")
        if nd:
            pr = smt.split_params(nd[0])
            nodes.append(OrderedDict(name=t, description=clean(pr.get("description", "")),
                                     guaranteed_rings=clean(pr.get("guaranteed", "")) or None,
                                     possible_rings=clean(pr.get("possible", "")) or None,
                                     summary=lead(p["text"], 600, t)))
    events.sort(key=lambda x: x["name"])
    nodes.sort(key=lambda x: x["name"])
    if gdi:
        checks.append(f"events: {len(events)} {{{{Event}}}} pages vs game-data StoryEventData {len(gdi['events'])} "
                      f"files (incl. follow-up events and Soul Savior-only events): {gdi['events']}")

    # ---- pyre hearts
    hearts = []
    for t, p in pages.items():
        ph = smt.find_templates(p["text"], "PyreHeart") if p["ns"] == 0 and not p["redirect"] else []
        if ph:
            pr = smt.split_params(ph[0])
            nums = re.findall(r"\d+", pr.get("stats", ""))
            a, h = (nums + [None, None])[:2]
            hearts.append(OrderedDict(name=t, attack=to_int(a), pyre_health=to_int(h),
                                      effect=clean(pr.get("effects", "")), unlock=clean(pr.get("unlock", "")),
                                      ring3_increase="/".join(re.findall(r"[+-]?\d+", pr.get("ring3_stat_increase", ""))),
                                      ring6_increase="/".join(re.findall(r"[+-]?\d+", pr.get("ring6_stat_increase", "")))))
    hearts.sort(key=lambda x: x["name"])
    if gdi:
        checks.append(f"Pyre Hearts: wiki {len(hearts)} vs game-data PyreArtifactData {len(gdi['pyre'])} "
                      f"({[r['id'] for r in gdi['pyre']]})")
    pyre = OrderedDict(
        summary=prose(re.split(r"\{\|", T("Pyre Hearts"))[0], 600, "Pyre Hearts"),
        stat_note="attack/pyre_health = base; ring3_increase/ring6_increase = attack/health added by the boss "
                  "artifact taken after Ring 3 / Ring 6 (depends on the heart).",
        combat_rules=prose(section(T("Combat"), "Floors", 3), 900),
        pyre_hearts=hearts,
        boss_artifacts=prose(re.sub(r"\{\{\w+Artifacts\}\}", "", T("Boss artifacts")), 700, "Boss artifacts"),
        boss_artifact_list=[a for a in artifacts if a["clan"] in ("Boss Artifacts",)])

    # ---- rules
    rp = T("Rings")
    rings = []
    for title, body in sections(rp, 2):
        if "Map Node" in title:
            continue
        num = re.search(r"\(Ring (\d)\)", title)
        flav = re.search(r"^''([^'].*?)''\s*$", body, re.M)
        tb = tables(body)
        cbs, trs, bs = [], [], []
        if tb:
            for cells in rows(tb[0]):
                if len(cells) >= 3 and not cells[0].startswith("!"):
                    cbs = [clean(x) for x in re.findall(r"^\*\s*(.+)$", cells[0], re.M)]
                    trs = [clean(x) for x in re.findall(r"^\*\s*(.+)$", cells[1], re.M)]
                    bs = [clean(x) for x in re.findall(r"^\*\s*(.+)$", cells[2], re.M)]
        nodes_txt = re.sub(r"\{\|.*?\n\|\}", "", body, flags=re.S)
        nodes_txt = re.sub(r"^(:|'').*$", "", nodes_txt, flags=re.M)
        rings.append(OrderedDict(ring=int(num.group(1)) if num else None, name=re.sub(r"\s*\(Ring \d\)", "", title),
                                 flavor=clean(flav.group(1)) if flav else None, nodes=prose(nodes_txt, 900),
                                 combats=cbs, trials=trs or None, bosses=bs))
    node_summary = []
    ms = section(rp, "Map Node Summary")
    ms = re.sub(r"<!--.*?-->", "", ms, flags=re.S)
    for tb in tables(ms):
        for cells in rows(tb):
            if cells and re.fullmatch(r"\d", clean(cells[0])):
                node_summary.append(" | ".join(clean(re.sub(r"\[\[File:[^|\]]*\|[^|\]]*\|link=([^\]]*)\]\]",
                                                            r" \1 ", c)) for c in cells))
    cov = []
    for m in re.finditer(r"'''Covenant (\d+)''':\s*(.+)", T("Covenant Ranks")):
        cov.append(OrderedDict(rank=int(m.group(1)), change=clean(m.group(2))))
    if gdi:
        checks.append(f"covenant: wiki {len(cov)} ranks vs game-data CovenantData {len(gdi['covenants'])} files "
                      f"(incl. Covenant00_FTUE)")
    trials = []
    tt = T("Trials")
    for tb in tables(section(tt, "Trials")):
        for cells in rows(tb):
            if len(cells) >= 4 and "<br>" in cells[0]:
                trials.append(OrderedDict(name=cell(nofile(cells[0])),
                                          effect=clean(cells[1]), ring_1_2=clean(cells[2]), ring_4_5=clean(cells[3]),
                                          ring_7=clean(cells[4]) if len(cells) > 4 else None))
    trial_rewards = []
    for tb in tables(section(tt, "Trial Rewards")):
        for cells in rows(tb):
            if len(cells) >= 2 and re.fullmatch(r"\d", clean(cells[0])):
                trial_rewards.append(f"Ring {clean(cells[0])}: {cell(nofile(cells[1], keep_name=True))}")
    if gdi:
        checks.append(f"trials: wiki {len(trials)} regular trials + boss-variant table vs game-data SinsData "
                      f"{len(gdi['sins'])} 'sin' relics (regular trials per ring tier + flying-boss variants and their "
                      f"Titan Trial II versions)")
    dims = []
    dp = T("Dimensional Challenges")
    for title, body in sections(dp, 2):
        if title in ("History", "Notes"):
            continue
        mods = []
        for tb in tables(body):
            for cells in rows(tb):
                if len(cells) >= 2 and "<br>" in cells[0]:
                    mods.append(f"{cell(nofile(cells[0]))}: {cell(cells[1])}")
        first = clean(body.strip().split("\n")[0])
        crank = re.search(r"Covenant Rank\]*\s*(\d+)", body)
        setup = []
        for tb in tables(body)[:1]:
            for cells in rows(tb):
                if len(cells) >= 3 and not cells[0].startswith("!"):
                    setup = [clean(c) for c in cells[:3]]
        dims.append(OrderedDict(name=title, description=first, covenant=int(crank.group(1)) if crank else None,
                                setup=setup or None, modifiers=mods))
    mutators = []
    for tb in tables(T("Mutators")):
        for cells in rows(tb):
            if len(cells) >= 3 and "<br>" in cells[0]:
                mutators.append(OrderedDict(name=cell(nofile(cells[0])),
                                            effect=clean(cells[1]), type=clean(cells[2]),
                                            added=clean(cells[3]) if len(cells) > 3 else None,
                                            boon_value=to_int(cells[4]) if len(cells) > 4 else None))
    if gdi:
        checks.append(f"mutators: wiki {len(mutators)} vs game-data MutatorData {len(gdi['mutators'])}")
    endless = OrderedDict(summary=lead(T("Endless Mode"), 600, "Endless Mode"))
    for title, body in sections(T("Endless Mode"), 2):
        if "Modifiers" in title:
            endless[title] = [f"{cell(nofile(c[0]))}: {cell(c[1])}"
                              for tb in tables(body) for c in rows(tb) if len(c) >= 2 and not c[0].startswith("!")
                              and clean(c[0]) not in ("Name",)]
    souls_pg = T("Souls")
    soul_names = sorted(t for t, p in pages.items() if p["ns"] == 0 and smt.find_templates(p["text"], "SoulInfobox"))
    ssp = T("Soul Savior")
    soul_savior = OrderedDict(
        summary=lead(ssp, 900, "Soul Savior"),
        map_nodes=prose(section(ssp, "Map Nodes"), 1800),
        souls=lead(souls_pg, 800, "Souls") + " " + prose(section(souls_pg, "Acquiring Souls"), 600),
        soul_list=soul_names,
        combats=ss_combats)
    if gdi:
        checks.append(f"souls: wiki {len(soul_names)} soul pages vs game-data SoulData {len(gdi['souls'])} relics "
                      f"(= souls x upgrade tiers)")
    flying = OrderedDict()
    for title, body in sections(T("Flying Bosses"), 2) + sections(T("Flying Bosses"), 3):
        flying[title] = prose(own_text(body), 1500)
    combat_pg = T("Combat")
    battle = OrderedDict(overview=prose(own_text(section(combat_pg, "Overview")), 600))
    for title, body in sections(combat_pg, 3):
        battle[title] = prose(body, 1500)
    battle["Battles"] = prose(own_text(T("Battles")), 600, "Battles")
    battle["Deployment Phase"] = prose(T("Deployment Phase"), 1500, "Deployment Phase")
    score = OrderedDict(summary=lead(T("Score"), 500, "Score"))
    for title, body in sections(T("Score"), 3):
        score[title] = prose(body, 500)
    clan_lv = [clean(x) for x in re.findall(r"^\*\s*(.+)$", T("Clan Level"), re.M)]
    ga = T("The Great Abyss")
    structure = OrderedDict(
        game="Monster Train 2", source=src, retrieved=TODAY,
        notes=("Run structure of MT2 from the community wiki (Miraheze archive.org backup). artifacts = the "
               "'Artifacts' page tables (clan = section; group = sub-table such as Minor Pyreborne / Pyreforged / "
               "Celestial Alcove / Boss); rarity from the game-data dump when --mt2-gamedata is given. events = "
               "Celestial Alcove event pages ({{Event}}); map_nodes = {{Node}} pages. Completeness: "
               + " | ".join(checks)),
        artifacts=artifacts,
        merchants_and_upgrades=merch,
        events=events,
        map_nodes=nodes,
        pyre=pyre,
        rules=OrderedDict(
            run_structure=OrderedDict(
                summary=("8 Rings of Heaven, one battle each (8 battles per run), plus an optional Ring 9 'Clash "
                         "with the Titans' when all three Titan Trials (flying-boss trials on Rings 3, 6, 8) were won. "
                         "Every ring after the first has two branches (each side: a Merchant + 1-2 reward nodes; "
                         "picking one side locks the other) and sometimes a shared centre node. Minor bosses on Rings "
                         "1, 2, 4, 5, 7 pair with any combat of the ring; flying bosses on Rings 3, 6, 8 come with a "
                         "fixed combat per variant. Boss artifact choice after Rings 3 and 6 (Hell's Flame / Limbo's "
                         "Solace / Heaven's Light: Pyre stat boost + ember/draw/capacity). Optional Trial before each "
                         "battle for gold (Rings 1-2, 4-5, 7) or Titan Essence (Rings 3, 6, 8)."),
                rings=rings, map_node_summary=node_summary,
                lead=prose(own_text(rp), 500, "Rings")),
            battle=battle,
            flying_bosses=flying,
            combats=combats,
            covenant=cov,
            covenant_note=prose(own_text(T("Covenant Ranks")), 500, "Covenant Ranks"),
            trials=OrderedDict(summary=lead(tt, 500, "Trials"), regular=trials, boss_variants=boss_variant_rows_all(tt),
                               rewards=trial_rewards),
            titans=OrderedDict(unlock=prose(section(ga, "Unlocking"), 600),
                               clash=prose(own_text(section(ga, "Clash with the Titans")), 1500)),
            clan_levels=OrderedDict(summary=lead(T("Clan Level"), 600, "Clan Level"), thresholds=clan_lv),
            card_mastery=lead(T("Card Mastery"), 400, "Card Mastery"),
            equipment_and_rooms=(lead(T("Equipment"), 600, "Equipment") + " Rooms: card type installed on a floor for a "
                                 "floor-wide passive effect; one Room per floor (see card data)."),
            ember=lead(T("Ember"), 300, "Ember"),
            dimensional_challenges=OrderedDict(summary=lead(dp, 300, "Dimensional Challenges"), challenges=dims),
            endless_mode=endless,
            soul_savior=soul_savior,
            mutators=mutators,
            score=score,
            covenant_outpost=lead(T("Covenant Outpost"), 400, "Covenant Outpost"),
        ))
    return structure


def boss_variant_rows_all(tt):
    out = []
    for tb in tables(section(tt, "Boss Variants")):
        boss = None
        for cells in rows(tb):
            if not cells or cells[0].startswith("!"):
                continue
            if "[[" in cells[0] and "<br>" not in cells[0]:
                boss = clean(cells[0])
                cells = cells[1:]
            for c in cells:
                if "'''" in c:
                    out.append(f"{boss}: {cell(nofile(c))}")
    return out


# ================================================================= main
def summarize(doc):
    c = Counter(e["category"] for e in doc["enemies"])
    print(f"{doc['game']}: {len(doc['enemies'])} enemies {dict(c)}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--game", choices=["mt1", "mt2", "all"], default="all")
    ap.add_argument("--cache", type=Path, default=smt.DEFAULT_CACHE)
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--mt2-gamedata", default=None,
                    help="local clone of brandonandzeus/MonsterTrain2GameData (research-only cross-check)")
    a = ap.parse_args()
    smt.CACHE, smt.REFRESH = a.cache, a.refresh
    if a.game in ("mt1", "all"):
        en, st = scrape_mt1()
        write(ENEMY_DIR / "mt1.json", en)
        write(STRUCT_DIR / "mt1.json", st)
        summarize(en)
    if a.game in ("mt2", "all"):
        en, st = scrape_mt2(a.mt2_gamedata)
        write(ENEMY_DIR / "mt2.json", en)
        write(STRUCT_DIR / "mt2.json", st)
        summarize(en)


if __name__ == "__main__":
    main()
