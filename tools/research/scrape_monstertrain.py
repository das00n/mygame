#!/usr/bin/env python3
"""Card census for Monster Train (MT1, 2020 + The Last Divinity DLC) and
Monster Train 2 (MT2, 2025 + Destiny of the Railforged DLC) -> JSON.

Research input only (mechanic analysis); the data does not ship in the game.

Sources (content CC BY-SA unless noted)
  MT1  https://monster-train.fandom.com  MediaWiki API
       - Module:Cards/Data (Lua table: every card, incl. DLC + clanless)
       - champion pages (==Upgrades== table -> ChampionUpgrade entries)
       - Status Effects / Card Effects pages (keyword glossary)
       cross-check: Trainworks (MT1 modding tools) VanillaCardIDs.cs on GitHub
  MT2  https://monstertrain2.miraheze.org  (the live wiki sits behind a bot
       challenge, so this script reads Miraheze's own monthly public XML backup
       on archive.org: item miraheze-wiki-monstertrain2wiki-YYYYMMDD)
       - per-clan {{<Clan>CardNav}} templates = the wiki's card list
       - card pages' {{UnitCard|SpellCard|EquipmentCard|RoomCard}} infoboxes
       - {{ChampionPaths}} on champion pages -> ChampionUpgrade entries
       - {{StatusEffect}} pages + "Card Effects" page (keyword glossary)
       optional cross-check: a local clone of
       https://github.com/brandonandzeus/MonsterTrain2GameData (game data dump)

Writes
  data/research/cards/mt1.json
  data/research/cards/mt2.json

Run:  python3 tools/research/scrape_monstertrain.py [--game mt1|mt2|all]
          [--cache DIR] [--refresh] [--mt2-gamedata DIR]
  --cache DIR         raw downloads are kept here (default ~/.cache/mygame-research/monstertrain)
  --refresh           ignore cached downloads
  --mt2-gamedata DIR  local clone of MonsterTrain2GameData for the MT2 completeness check
                      (git clone --depth 1 https://github.com/brandonandzeus/MonsterTrain2GameData)
Python 3 stdlib only.
"""
import argparse
import datetime
import gzip
import hashlib
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter, OrderedDict, defaultdict
from pathlib import Path

UA = "card-mechanics-research-script/1.0 (python-urllib)"
SLEEP = 1.0
ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "data/research/cards"
DEFAULT_CACHE = Path.home() / ".cache/mygame-research/monstertrain"

MT1_API = "https://monster-train.fandom.com/api.php"
MT1_MODTOOLS_IDS = ("https://raw.githubusercontent.com/KittenAqua/TrainworksModdingTools/HEAD/"
                    "TrainworksModdingTools/Constants/VanillaCardIDs.cs")
MT2_ARCHIVE_SEARCH = ("https://archive.org/advancedsearch.php?q=identifier%3Amiraheze-wiki-monstertrain2wiki-%2A"
                      "&fl%5B%5D=identifier&rows=100&output=json")
MT2_WIKI = "https://monstertrain2.miraheze.org"

CACHE = DEFAULT_CACHE
REFRESH = False
_last_live = [0.0]


# ---------------------------------------------------------------- HTTP (cached)
def fetch(url, binary=False):
    key = hashlib.sha1(url.encode()).hexdigest()[:20]
    path = CACHE / key
    if path.exists() and not REFRESH:
        data = path.read_bytes()
    else:
        wait = SLEEP - (time.time() - _last_live[0])
        if wait > 0:
            time.sleep(wait)
        for attempt in range(4):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=180) as r:
                    data = r.read()
                break
            except Exception as e:  # network hiccup -> retry with backoff
                if attempt == 3:
                    raise
                print(f"  retry {url[:80]}: {e}", file=sys.stderr)
                time.sleep(3 * (attempt + 1))
        _last_live[0] = time.time()
        CACHE.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return data if binary else data.decode("utf-8-sig")


def mt1_api(**params):
    params["format"] = "json"
    return json.loads(fetch(MT1_API + "?" + urllib.parse.urlencode(params)))


def mt1_pages(titles):
    """Wikitext of the latest revision for each title (batched 50 per call)."""
    out = {}
    titles = list(titles)
    for i in range(0, len(titles), 50):
        d = mt1_api(action="query", prop="revisions", rvprop="content", rvslots="main",
                    titles="|".join(titles[i:i + 50]))
        norm = {n["from"]: n["to"] for n in d["query"].get("normalized", [])}
        back = {v: k for k, v in norm.items()}
        for p in d["query"]["pages"].values():
            if "revisions" in p:
                out[back.get(p["title"], p["title"])] = p["revisions"][0]["slots"]["main"]["*"]
    return out


# ---------------------------------------------------------------- generic wikitext helpers
def find_templates(text, name):
    """Inner text of every top-level {{name ...}} call (brace-balanced)."""
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
        out.append(text[m.end():j - 2])
    return out


def split_params(inner):
    """Split template inner text on top-level '|' -> {name|position: value}."""
    parts, buf, d1, d2, i = [], "", 0, 0, 0
    while i < len(inner):
        two = inner[i:i + 2]
        if two in ("{{", "}}", "[[", "]]"):
            d1 += {"{{": 1, "}}": -1}.get(two, 0)
            d2 += {"[[": 1, "]]": -1}.get(two, 0)
            buf += two
            i += 2
            continue
        if inner[i] == "|" and d1 == 0 and d2 == 0:
            parts.append(buf)
            buf = ""
        else:
            buf += inner[i]
        i += 1
    parts.append(buf)
    if parts and not parts[0].strip():
        parts = parts[1:]
    params, pos = {}, 1
    for p in parts:
        m = re.match(r"^\s*([\w ]+?)\s*=(.*)$", p, re.S)
        if m:
            params[m.group(1).strip()] = m.group(2).strip()
        else:
            params[str(pos)] = p.strip()
            pos += 1
    return params


ICON_WORDS = {
    "attack": "Attack", "health": "Health", "ember": "Ember", "capacity": "Capacity", "size": "Capacity",
    "gold": "Gold", "pyre health": "Pyre Health", "pyrehealth": "Pyre Health", "echo": "Charged Echo",
    "echoslot": "Echo slot", "echoempty": "Echo slot", "echopermanent": "permanent Charged Echo",
    "unremovableecho": "unremovable Charged Echo", "chargedechoes": "Charged Echo", "armor": "Armor",
    "iconarmor": "Armor", "multistrike": "Multistrike", "inspire": "Inspire", "gorge": "Gorge",
    "titanite": "Titanite", "fullmoon": "Full Moon", "newmoon": "New Moon", "mooncycle": "Mooncycle",
    "dragonshoard": "Dragon's Hoard", "deploymentember": "Deployment Ember", "abilityactive": "Ability",
    "abilitycooldown": "Cooldown", "x cost": "X", "pactshards": "Pact Shards",
}
_unknown_templates = Counter()


def _icon_word(name):
    return ICON_WORDS.get(re.sub(r"\.(png|webp)$", "", name.strip().lower()).replace("_", " "),
                          ICON_WORDS.get(name.strip().lower().replace(" ", ""), ""))


def _num_icon(params):
    v = params.get("1", "").strip()
    return v


def render_template(name, params):
    n = name.strip()
    low = n.lower()
    # MT1 {{Value|prefix|icon|icon2}}
    if low == "value":
        pre, ic1, ic2 = params.get("1", ""), params.get("2", ""), params.get("3", "")
        if ic1.lower() == "x cost":
            core = f"{pre}×X" if pre else "X"
            return f"{core} {_icon_word(ic2) or ic2}".strip()
        word = _icon_word(ic1) or ic1
        return f"{pre} {word}".strip()
    if low in ("echo", "echoslot", "echoempty", "echopermanent", "attack", "health", "ember", "capacity",
               "size", "gold", "pyrehealth", "armor", "multistrike", "inspire", "gorge", "titanite",
               "fullmoon", "newmoon", "mooncycle", "dragonshoard", "deploymentember", "abilityactive",
               "abilitycooldown"):
        word = ICON_WORDS.get(low, n)
        v = _num_icon(params)
        return f"{v} {word}".strip()
    if low == "iconlink":
        v = params.get("2", "").strip()
        nm = params.get("1", "").strip()
        nm = {"Charged Echoes": "Charged Echo", "Inspire (trigger)": "Inspire"}.get(nm, nm)
        return f"{nm} {v}".strip()
    if low == "icon":
        return _icon_word(params.get("1", ""))
    if low == "abilitybox":
        return (f"Ability ({params.get('1', '').strip()}, Cooldown {params.get('2', '').strip()}): "
                f"{params.get('3', '').strip()}")
    if low in ("attackhealth", "attackhealtharmor"):
        a = params.get("attack", params.get("1", "")).strip()
        h = params.get("health", params.get("2", "")).strip()
        return f"{a}/{h}" if h else a
    if low in ("color", "upgrade"):
        return params.get("2", "")
    if low in ("categorylist", "clear", "stub", "thelastdivinity", "cardpage", "cardnav", "sitenav"):
        return ""
    _unknown_templates[n] += 1
    return " ".join(v for k, v in params.items() if k.isdigit())


def clean(text):
    """Wiki markup -> one-line plain text."""
    if not text:
        return ""
    t = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    t = re.sub(r"<ref[^>]*>.*?</ref>", "", t, flags=re.S)
    # templates, innermost first
    for _ in range(12):
        new = re.sub(r"\{\{([^{}]*)\}\}",
                     lambda m: render_template(m.group(1).split("|", 1)[0],
                                               split_params("|" + m.group(1).split("|", 1)[1])
                                               if "|" in m.group(1) else {}), t)
        if new == t:
            break
        t = new
    # files: keep stat-icon words, drop the rest
    t = re.sub(r"\[\[\s*(?:File|Image)\s*:([^|\]]+)[^\]]*\]\]",
               lambda m: (" " + _icon_word(m.group(1)) + " ") if _icon_word(m.group(1)) else "", t, flags=re.I)
    t = re.sub(r"\[\[\s*Category:[^\]]*\]\]", "", t, flags=re.I)
    t = re.sub(r"\[\[:?([^\]|]*)\|([^\]]*)\]\]", r"\2", t)
    t = re.sub(r"\[\[:?([^\]]*)\]\]", lambda m: m.group(1).split("#")[-1], t)
    t = re.sub(r"\[(Attack|Health|X Cost|Ember|Capacity|Gold|Pyre Health|Echo|EchoSlot)\]",
               lambda m: " " + (_icon_word(m.group(1)) or m.group(1)) + " ", t)
    t = re.sub(r"'{2,}", "", t)
    t = re.sub(r"[{}]", "", t)  # stray braces from unbalanced source markup
    t = re.sub(r"<\s*hr\s*/?>", " / ", t, flags=re.I)
    t = re.sub(r"<\s*/?\s*br\s*/?\s*>", " ", t, flags=re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    t = html.unescape(t).replace("\u00a0", " ")
    t = re.sub(r"\s+", " ", t).strip()
    t = re.sub(r"\s+([.,:;!?])", r"\1", t)
    t = re.sub(r"(/ )+", "/ ", t).strip(" /")
    return t


def slug(s):
    s = s.replace("’", "'").lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def first_sentence(text, limit=220):
    t = clean(text)
    if len(t) > limit:
        cut = t.rfind(". ", 0, limit)
        t = t[:cut + 1] if cut > 40 else t[:limit].rstrip() + "…"
    return t


def extract_keywords(raw, glossary, extra_terms=()):
    """Keywords = glossary terms named in bold / IconLink / tags on the card."""
    cands = set(extra_terms)
    for m in re.finditer(r"\{\{\s*IconLink\s*\|([^|}]+)", raw or ""):
        cands.add(m.group(1))
    for m in re.finditer(r"'''(.+?)'''", raw or ""):
        cands.add(clean(m.group(1)))
    lookup = {k.lower(): k for k in glossary}
    out = []
    for c0 in list(cands):
        cands.update(x for x in re.split(r"[.:]\s+", c0) if x)
        cands.add(c0.split(" ")[0])
    for c in cands:
        c = re.sub(r"[\d.:,!]+$", "", c.strip().strip("'")).strip()
        c = re.sub(r"\s+\d+$", "", c).strip()
        c = re.sub(r"^(Apply|Gain)\s+", "", c)
        k = lookup.get(c.lower())
        if not k and c.lower().endswith("s"):
            k = lookup.get(c.lower()[:-1])
        if k and k not in out:
            out.append(k)
    # plain-text mentions of trigger keywords ("Slay:", "Harvest:") that were not bolded
    txt = clean(raw)
    for k in glossary:
        if k not in out and re.search(r"(?<![\w-])" + re.escape(k) + r"(?:\s+\d+)?\s*[:.]", txt):
            out.append(k)
    return sorted(out)


def parse_wikitable_rows(table_text):
    """Very small wikitable reader -> list of rows (list of raw cell strings)."""
    rows = []
    for chunk in re.split(r"\n\|-[^\n]*", table_text):
        cells, cur = [], None
        for line in chunk.split("\n"):
            if line.startswith(("{|", "|}", "|+")):
                continue
            if line.startswith(("|", "!")):
                if cur is not None:
                    cells.append(cur)
                body = line[1:]
                parts = re.split(r"\|\||!!", body)
                for p in parts[:-1]:
                    cells.append(p)
                cur = parts[-1]
            elif cur is not None:
                cur += "\n" + line
        if cur is not None:
            cells.append(cur)
        # strip leading 'style=... |' attribute blocks
        cells = [re.sub(r'^\s*(?:style|class|colspan|rowspan|data-sort-value|scope)\s*=[^|]*\|(?!\|)', "", c).strip()
                 for c in cells]
        if cells:
            rows.append(cells)
    return rows


def card(game, name, owner, ctype, rarity, cost, text, keywords, extra, cid=None):
    return OrderedDict([
        ("id", cid or f"{game}.{slug(name)}"), ("name", name), ("owner", owner), ("type", ctype),
        ("rarity", rarity), ("cost", None if cost is None else str(cost)), ("cost_upgraded", None),
        ("text", text), ("text_upgraded", None), ("keywords", keywords), ("extra", extra),
    ])


# ================================================================= MT1
class LuaParser:
    """Minimal parser for the literal-table subset used by Module:Cards/Data."""
    TOK = re.compile(r'\s*(?:(?P<bc>--\[(?P<bl>=*)\[.*?\](?P=bl)\])|(?P<lc>--[^\n]*)'
                     r'|(?P<ls>\[(?P<ll>=*)\[.*?\](?P=ll)\])|(?P<str>"(?:\\.|[^"\\])*")'
                     r'|(?P<num>\d+(?:\.\d+)?)|(?P<id>[A-Za-z_]\w*)|(?P<sym>[{}\[\]=,;]))', re.S)

    def __init__(self, src):
        self.toks = []
        for m in self.TOK.finditer(src):
            if m.group("bc") or m.group("lc"):
                continue
            if m.group("ls"):
                body = m.group("ls")
                n = len(m.group("ll")) + 2
                self.toks.append(("str", body[n:-n]))
            elif m.group("str"):
                self.toks.append(("str", m.group("str")[1:-1].replace('\\"', '"').replace("\\n", "\n")))
            elif m.group("num"):
                self.toks.append(("num", float(m.group("num")) if "." in m.group("num") else int(m.group("num"))))
            elif m.group("id"):
                self.toks.append(("id", m.group("id")))
            elif m.group("sym"):
                self.toks.append(("sym", m.group("sym")))
        self.i = 0

    def peek(self, k=0):
        return self.toks[self.i + k] if self.i + k < len(self.toks) else (None, None)

    def take(self):
        t = self.toks[self.i]
        self.i += 1
        return t

    def value(self):
        kind, v = self.take()
        if kind in ("str", "num"):
            return v
        if kind == "id":
            return {"true": True, "false": False, "nil": None}.get(v, v)
        if v == "{":
            return self.table()
        raise ValueError(f"unexpected token {v!r}")

    def table(self):
        out, arr = {}, []
        while True:
            kind, v = self.peek()
            if v == "}":
                self.take()
                break
            if kind == "id" and self.peek(1)[1] == "=":
                key = self.take()[1]
                self.take()
                out[key] = self.value()
            elif v == "[":
                self.take()
                key = self.value()
                self.take()  # ]
                self.take()  # =
                out[key] = self.value()
            else:
                arr.append(self.value())
            if self.peek()[1] in (",", ";"):
                self.take()
        return arr if arr and not out else (out if not arr else dict(out, _list=arr))

    def cards(self):
        """Parse every `cards["Name"] = {...}` statement, keeping file order."""
        res = OrderedDict()
        while self.i < len(self.toks):
            if (self.peek()[1] == "cards" and self.peek(1)[1] == "[" and self.peek(2)[0] == "str"
                    and self.peek(3)[1] == "]" and self.peek(4)[1] == "="):
                self.i += 2
                name = self.take()[1]
                self.i += 2
                self.take()  # {
                res[name] = self.table()
            else:
                self.i += 1
        return res


MT1_CLAN_ORDER = ["Hellhorned", "Awoken", "Stygian Guard", "Umbra", "Melting Remnant", "Wurmkin", "Clanless"]
MT1_NON_UNIT = {"Spell", "Blight", "Scourge"}
MT1_VARIABLE = {
    "Olde Magic": "Effects are chosen at the Arcane Machine (Concealed Caverns event): pick from status, "
                  "movement, capacity, gold and draw options; the wiki lists the option pool.",
    "Nexus Spike": "Combines the effects of two spells from your deck (Concealed Caverns event).",
    "For the Greater Good": "Summons one of 6 random Rebel units (former enemies) with Summon/Extinguish "
                            "abilities.",
}


def mt1_glossary():
    pages = mt1_pages(["Status Effects", "Card Effects", "Charged Echoes"])
    gl = OrderedDict()
    for title in ("Status Effects", "Card Effects"):
        txt = pages.get(title, "")
        for tbl in re.findall(r"\{\|.*?\n\|\}", txt, re.S):
            for cells in parse_wikitable_rows(tbl):
                if len(cells) < 2:
                    continue
                m = re.search(r"'''(.+?)'''", cells[0])
                if not m:
                    continue
                name = clean(m.group(1)).replace(" Cost", "").strip() or "X Cost"
                if name == "X":
                    name = "X Cost"
                desc = clean(cells[1])
                if name and desc and name not in gl:
                    gl[name] = desc
    gl["Charged Echo"] = ("Wurmkin floor resource: playing Infused cards adds Charged Echoes to the floor (4 slots "
                          "per floor; excess removed at end of turn); spent/checked by Extract, Reap, Inspire, "
                          "Shell/Hatch.")
    return gl, pages


def mt1_champion_upgrades(champ, clan, wikitext, glossary):
    m = re.search(r"==\s*Upgrades\s*==(.*?)\n\|\}", wikitext, re.S)
    if not m:
        return []
    out = []
    rows = parse_wikitable_rows(m.group(1).split("{|", 1)[1] if "{|" in m.group(1) else m.group(1))
    for cells in rows:
        if len(cells) < 4 or not clean(cells[0]) or "Upgrade I" in cells[1]:
            continue
        path = clean(cells[0])
        for tier, raw in enumerate(cells[1:4], start=1):
            stats_part = raw.split("<hr>")[0] if "<hr>" in raw else ""
            atk = re.search(r"\{\{\s*[Vv]alue\|([+-]?\d+)\|Attack\}\}", stats_part or raw)
            hp = re.search(r"\{\{\s*[Vv]alue\|([+-]?\d+)\|Health\}\}", stats_part or raw)
            roman = "I" * tier if tier < 4 else "IV"
            out.append(card(
                "mt1", f"{champ}: {path} {roman}", clan, "ChampionUpgrade", "Champion", None, clean(raw),
                extract_keywords(raw, glossary),
                OrderedDict(champion=champ, upgrade_path=path, tier=tier,
                            attack_delta=int(atk.group(1)) if atk else None,
                            health_delta=int(hp.group(1)) if hp else None,
                            dlc="The Last Divinity" if clan == "Wurmkin" else None),
                cid=f"mt1.{slug(champ)}.{slug(path)}_{tier}"))
    return out


def scrape_mt1():
    print("MT1: Module:Cards/Data", file=sys.stderr)
    d = mt1_api(action="query", prop="revisions", rvprop="content", rvslots="main", titles="Module:Cards/Data")
    lua = list(d["query"]["pages"].values())[0]["revisions"][0]["slots"]["main"]["*"]
    data = LuaParser(lua).cards()
    glossary, _ = mt1_glossary()

    # DLC membership from the wiki's own category (The Last Divinity template on each page)
    tld = set()
    d = mt1_api(action="query", list="categorymembers", cmtitle="Category:TheLastDivinity", cmlimit=500)
    tld = {m["title"] for m in d["query"]["categorymembers"]}

    champs = [n for n, c in data.items() if c.get("Type") == "Champion"]
    special = [n for n in data if n in MT1_VARIABLE]
    pages = mt1_pages(champs + special)

    cards = []
    for name, c in data.items():
        clan = c.get("Clan", "Clanless")
        t = c.get("Type", "")
        tags = c.get("Tags") or []
        if isinstance(tags, dict):
            tags = tags.get("_list", [])
        is_unit = t not in MT1_NON_UNIT
        ctype = "Champion" if t == "Champion" else ("Unit" if is_unit else t)
        text = clean(c.get("Desc", ""))
        extra = OrderedDict()
        if is_unit:
            extra["subtype"] = None if t == "Champion" else t
            extra["attack"] = c.get("Attack")
            extra["health"] = c.get("Health")
            extra["capacity"] = c.get("Capacity")
            extra["banner"] = c.get("IsBanner") == "true"
        extra["starter"] = "Starter" in tags
        extra["dlc"] = "The Last Divinity" if name in tld else None
        if c.get("Essence"):
            extra["essence"] = clean(c["Essence"])
        if name in MT1_VARIABLE:
            extra["variable"] = MT1_VARIABLE[name]
            if not text:
                text = MT1_VARIABLE[name]
        extra["wiki_tags"] = [x for x in tags]
        if t == "Champion":
            extra["note"] = "Champion abilities come from the 3 upgrade paths (see ChampionUpgrade entries)."
        # wiki tags only count as keywords when the printed text names them (champion tags list
        # their upgrade paths' keywords; those live on the ChampionUpgrade entries instead)
        tag_kw = [x for x in tags if x in glossary and (name in MT1_VARIABLE or x.lower() in text.lower())]
        cards.append(card("mt1", name, clan, ctype, c.get("Rarity"), c.get("Cost"), text,
                          extract_keywords(c.get("Desc", ""), glossary, tag_kw), extra))
        if t == "Champion":
            cards.extend(mt1_champion_upgrades(name, clan, pages.get(name, ""), glossary))

    # ---- completeness: (1) wiki Cards page total, (2) category sizes, (3) Trainworks VanillaCardIDs
    checks = []
    base = [x for x in cards if x["type"] != "ChampionUpgrade"]
    by_clan = Counter(x["owner"] for x in base)
    cats = mt1_api(action="query", prop="categoryinfo",
                   titles="|".join(f"Category:{c} Cards" for c in MT1_CLAN_ORDER))
    catsize = {p["title"][9:-6]: p.get("categoryinfo", {}).get("pages") for p in cats["query"]["pages"].values()}
    checks.append("per-clan scraped vs wiki 'Category:<Clan> Cards': " + "; ".join(
        f"{c} {by_clan[c]}/{catsize.get(c)}" for c in MT1_CLAN_ORDER))
    cards_page = mt1_pages(["Cards"]).get("Cards", "")
    totals = re.findall(r"Total Cards:\s*(\d+)", cards_page)
    checks.append(f"total scraped {len(base)} (wiki 'Cards' page history says {totals[-1] if totals else '?'} "
                  f"after 2.0.0 / The Last Divinity)")
    try:
        cs = fetch(MT1_MODTOOLS_IDS)
        ids = re.findall(r"Asset name: (\S+)\s*\n\s*/// </summary>\s*\n\s*public static readonly string (\w+) =", cs)
        norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
        mod = {norm(b): b for a, b in ids}
        wiki = {norm(x["name"]): x for x in base}
        only_mod = sorted(v for k, v in mod.items() if k not in wiki)
        only_wiki = [x for k, x in wiki.items() if k not in mod]
        nondlc_only_wiki = sorted(x["name"] for x in only_wiki if not x["extra"].get("dlc"))
        checks.append(
            f"vs Trainworks VanillaCardIDs.cs (pre-DLC v1.2 game data, {len(ids)} ids): "
            f"{len(base) - len(only_wiki)} matched; wiki-only {len(only_wiki)} = "
            f"{sum(1 for x in only_wiki if x['extra'].get('dlc'))} The Last Divinity DLC cards"
            + (f" + non-DLC {nondlc_only_wiki}" if nondlc_only_wiki else "")
            + f"; id-only {only_mod} (internal upgraded variants of Blazing Bolts, not collectible)")
    except Exception as e:  # cross-check is best effort
        checks.append(f"Trainworks cross-check skipped: {e}")

    notes = (
        "Version: final MT1 (v2.x incl. The Last Divinity DLC: Wurmkin clan, 5 clan rares, 5 Concealed Caverns "
        "cards, unit Essences). Source = wiki Lua data module Module:Cards/Data (descriptions, stats, tags) + "
        "champion pages (==Upgrades== tables). type: Champion / Unit / Spell / Blight / Scourge / ChampionUpgrade; "
        "the wiki's unit tribe (Imp, Demon, Morsel, Wickless...) is extra.subtype. MT1 cards have no printed "
        "upgraded version (upgrades are stones/Dark Forge), so cost_upgraded/text_upgraded are null; multi-stage "
        "cards (Blazing Bolts, Spikedriver Colony) keep each stage in text separated by ' / '. 'x×X' = per Ember "
        "spent on an X-cost card. extra.essence = The Last Divinity unit Essence (bonus a unit grants when merged "
        "into another at the Divine Temple). extra.wiki_tags = the wiki editors' tag list (partly subjective: "
        "Create, Draw, Ember, Move...). ChampionUpgrade entries: 12 champions x 3 paths x 3 tiers; "
        "attack_delta/health_delta = stat bonus over the champion's base card at that tier (wiki values are cumulative per tier). "
        "Variable cards (Olde Magic, Nexus Spike, For the Greater Good) carry a summary in extra.variable. "
        "No removed/unused cards are present in the data module. Completeness: " + " | ".join(checks))
    return {
        "game": "Monster Train",
        "source": "https://monster-train.fandom.com (CC BY-SA)",
        "retrieved": datetime.date.today().isoformat(),
        "notes": notes,
        "keyword_glossary": dict(sorted(glossary.items())),
        "cards": cards,
    }


# ================================================================= MT2
MT2_CLANS = OrderedDict([
    ("Banished", "Banished"), ("Pyreborne", "Pyreborne"), ("LunaCoven", "Luna Coven"),
    ("Underlegion", "Underlegion"), ("LazarusLeague", "Lazarus League"), ("Hellhorned", "Hellhorned"),
    ("Awoken", "Awoken"), ("StygianGuard", "Stygian Guard"), ("Umbra", "Umbra"),
    ("MeltingRemnant", "Melting Remnant"), ("Wurmkin", "Wurmkin"), ("Railforged", "Railforged"),
    ("Clanless", "Clanless"),
])
MT2_SECTION_TYPE = {"Champions": "Champion", "Units": "Unit", "Morsels": "Unit", "Spells": "Spell",
                    "Equipment": "Equipment", "Rooms": "Room", "Blights": "Blight", "Scourges": "Scourge"}
MT2_TEMPLATE_TYPE = {"UnitCard": "Unit", "SpellCard": "Spell", "EquipmentCard": "Equipment", "RoomCard": "Room"}
MT2_GAMEDATA_CLASS = {"ClassBanished": "Banished", "ClassPyreborne": "Pyreborne", "ClassLunaCoven": "Luna Coven",
                      "ClassUnderlegion": "Underlegion", "ClassLazarusLeague": "Lazarus League",
                      "ClassHellhorned": "Hellhorned", "ClassAwoken": "Awoken", "ClassStygian": "Stygian Guard",
                      "ClassUmbra": "Umbra", "ClassRemnant": "Melting Remnant", "ClassWurm": "Wurmkin",
                      "ClassRailforged": "Railforged", None: "Clanless"}


def mt2_dump():
    d = json.loads(fetch(MT2_ARCHIVE_SEARCH))
    ids = sorted(x["identifier"] for x in d["response"]["docs"])
    item = ids[-1]
    stamp = item.rsplit("-", 1)[1]
    url = f"https://archive.org/download/{item}/monstertrain2wiki-{stamp}.xml.gz"
    print(f"MT2: {url}", file=sys.stderr)
    raw = gzip.decompress(fetch(url, binary=True))
    ns = "{http://www.mediawiki.org/xml/export-0.11/}"
    pages = {}
    for _, el in ET.iterparse(__import__("io").BytesIO(raw)):
        if el.tag != ns + "page":
            continue
        best = None
        for r in el.findall(ns + "revision"):
            ts = r.find(ns + "timestamp").text
            if best is None or ts > best[0]:
                best = (ts, r.find(ns + "text").text or "")
        pages[el.find(ns + "title").text] = {"ns": int(el.find(ns + "ns").text), "ts": best[0], "text": best[1],
                                             "redirect": el.find(ns + "redirect") is not None}
        el.clear()
    return item, pages


def parse_nav(text):
    m = re.search(r"<onlyinclude>(.*?)</onlyinclude>", text, re.S)
    body = m.group(1) if m else text
    out, section, rarity = [], None, None
    for row in body.split("\n|-"):
        sec = re.search(r"'''([^']+)'''", row)
        if sec:
            section, rarity = sec.group(1).strip(), None
        rar = re.search(r"\|\s*(?:style=\"color:#[0-9a-fA-F]+;\"\s*\|\s*)?(Common|Uncommon|Rare|Infusion)\s*\n", row)
        if rar:
            rarity = rar.group(1)
        if section is None:
            continue
        for nm in re.finditer(r"(\[\[file:DeploymentEmber[^\]]*\]\]\s*)?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]", row, re.I):
            name = nm.group(2).strip()
            if name.lower().startswith("file:"):
                continue
            out.append({"section": section, "rarity": rarity, "page": name, "banner": bool(nm.group(1))})
    return out


def mt2_glossary(pages):
    gl = OrderedDict()
    for title, p in pages.items():
        if p["ns"] != 0 or p["redirect"]:
            continue
        for inner in find_templates(p["text"], "StatusEffect"):
            pr = split_params(inner)
            desc = clean(pr.get("description", ""))
            if not desc:
                # e.g. 'Ability' has no description field; use the page lead sentence
                lead = re.sub(r"\{\{StatusEffect.*?\n\}\}", "", p["text"], flags=re.S)
                desc = first_sentence(lead.strip().split("\n\n")[0])
            gl[re.sub(r"\s*\(trigger\)$", "", title)] = desc
    ce = pages.get("Card Effects", {}).get("text", "")
    for m in re.finditer(r"^===\s*(.+?)\s*===\s*\n(.*?)(?=^===|\Z)", ce, re.S | re.M):
        name, body = m.group(1).strip(), m.group(2)
        line = next((ln for ln in body.split("\n") if ln.strip() and not ln.startswith(("{{", "<hr", "*", ":"))
                     and not re.match(r"^'''(Notes|See Also|Main Article)", ln)), "")
        if line and name not in gl:
            gl[name] = clean(line)
    # mechanics described on clan pages / own pages rather than in the two lists above
    extra_pages = {"Charged Echo": ("Wurmkin", "Charged Echoes"), "Dragon's Hoard": ("Pyreborne", "Dragon's Hoard"),
                   "Forge": ("Railforged", None), "Moon Phase": ("Luna Coven", "Moon Phase"),
                   "Spawn": ("Spawn", None), "Smelt": ("Smelt", None), "Equipment": ("Equipment", None),
                   "Titanite": ("Titanite", None)}
    for key, (title, anchor) in extra_pages.items():
        if key in gl:
            continue
        txt = pages.get(title, {}).get("text", "")
        if anchor:
            m = re.search(r"==+\s*" + re.escape(anchor) + r"\s*==+\s*\n(.*?)(?=\n==|\Z)", txt, re.S)
            txt = m.group(1) if m else ""
        txt = re.sub(r"^\{\{.*?^\}\}\s*", "", txt, flags=re.S | re.M)
        paras = [x for x in re.split(r"\n\s*\n", txt) if x.strip() and not x.strip().startswith(("{{", "[[File"))]
        if paras:
            gl[key] = first_sentence(paras[0], 260)
    # 'Hatch' redirects to Shell on the wiki; 'Forge Points' is the resource the Forge keyword grants
    if "Shell" in gl:
        gl.setdefault("Hatch", "Triggers when an Egg unit loses its last Shell stack (see Shell); the Egg becomes "
                               "the hatched unit.")
    gl.update(MT2_MANUAL_GLOSSARY)
    return gl


# Clan mechanics that only have a clan-page section (no keyword page): one-line summaries of that wiki text.
MT2_MANUAL_GLOSSARY = {
    "Forge": "Gain Forge Points; the next Unit or Equipment you play spends all of them for +3 Attack and +3 Armor "
             "per point (Railforged).",
    "Dragon's Hoard": "Pyreborne resource gained in combat (max 8 by default); looted outside combat for Gold and "
                      "Minor Pyreborne artifacts, or spent by a few cards in combat.",
    "Moon Phase": "Luna Coven: combat alternates New Moon / Full Moon at the start of each turn (starts New Moon); "
                  "Phase cards advance it, Full Moon / New Moon effects work only in that phase.",
    "Charged Echo": "Wurmkin floor resource stored in Echo slots: added by Infused cards and some effects, spent by "
                    "Extract and counted by Reap, Inspire and Shell.",
    "Room": "Card type installed on a floor for a passive floor-wide effect; one Room per floor.",
    "Equipment": "Card type attached to a friendly unit for a passive effect and/or stats; one Equipment per unit.",
}


def parse_stats(raw):
    s = clean(raw)
    m = re.search(r"(-?\d+)\s*/\s*(-?\d+)", s)
    if m:
        return int(m.group(1)), int(m.group(2)), s
    a = re.search(r"([+-]?\d+)\s*Attack", s)
    h = re.search(r"([+-]?\d+)\s*Health", s)
    if a or h:
        return (int(a.group(1)) if a else None), (int(h.group(1)) if h else None), s
    return None, None, s or None


def mt2_cost(raw):
    c = clean(raw).replace("Ember", "").strip()
    return c if re.fullmatch(r"\d+|X", c) else None


def mt2_champion_upgrades(champ, clan, text, glossary):
    out = []
    for inner in find_templates(text, "ChampionPaths"):
        pr = split_params(inner)
        for letter in "abc":
            path = clean(pr.get(letter, ""))
            if not path:
                continue
            for tier in (1, 2, 3):
                raw = pr.get(f"{letter}{tier}abilities", "")
                atk, hp, stats = parse_stats(pr.get(f"{letter}{tier}stats", ""))
                size = pr.get(f"{letter}{tier}size")
                txt = clean(raw)
                out.append(card(
                    "mt2", f"{champ}: {path} {'I' * tier}", clan, "ChampionUpgrade", "Champion", None,
                    (f"[{stats}] " if stats else "") + txt, extract_keywords(raw, glossary),
                    OrderedDict(champion=champ, upgrade_path=path, tier=tier, attack=atk, health=hp,
                                capacity=int(size) if size and size.strip().isdigit() and size.strip() != "0" else None,
                                dlc="Destiny of the Railforged" if clan == "Railforged" else None),
                    cid=f"mt2.{slug(champ)}.{slug(path)}_{tier}"))
    return out


def mt2_infusions(pages, glossary):
    """Lazarus League Infusion cards (generated by Mix) live in one table on the 'Infusion' page."""
    txt = pages.get("Infusion", {}).get("text", "")
    m = re.search(r"==\s*List of Infusions\s*==.*?(\{\|.*?\n\|\})", txt, re.S)
    out = {}
    if not m:
        return out
    for cells in parse_wikitable_rows(m.group(1)):
        if len(cells) < 5:
            continue
        name = clean(re.split(r"</?br\s*/?>", cells[0])[0])
        if "Infusion" not in name:
            continue
        base, ups = cells[1], cells[2:5]
        out[name] = (base, [clean(u) for u in ups])
    return out


def mt2_gamedata_check(gd_dir, cards):
    """Compare per-clan card names with the game-data dump (class field)."""
    gd_dir = Path(gd_dir)
    norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower().replace("’", "'"))
    by = defaultdict(set)
    rq_dlc = {}
    for f in sorted((gd_dir / "CardData").glob("*.json")):
        try:
            d = json.loads(f.read_text(encoding="utf-8-sig"))
        except Exception:
            continue
        for c in d.get("cards", []):
            if c.get("is_an_ability"):
                continue
            nm = c.get("names")
            nm = nm.get("english") if isinstance(nm, dict) else nm
            nm = (nm or f.stem).strip()
            if c.get("id", "").endswith(("Ability", "_SupportCard")):
                continue
            by[MT2_GAMEDATA_CLASS.get(c.get("class"), c.get("class"))].add(norm(nm))
            by[MT2_GAMEDATA_CLASS.get(c.get("class"), c.get("class"))].add(norm(f.stem))
            if c.get("required_dlc"):
                rq_dlc[norm(nm)] = c["required_dlc"]
                rq_dlc[norm(f.stem)] = c["required_dlc"]
    lines = []
    wiki = defaultdict(set)
    for c in cards:
        if c["type"] != "ChampionUpgrade":
            wiki[c["owner"]].add(norm(c["name"]))
    names = {norm(c["name"]): c["name"] for c in cards}
    for clan in MT2_CLANS.values():
        miss = sorted(names[n] for n in wiki[clan] if n not in by[clan])
        lines.append(f"{clan}: wiki {len(wiki[clan])}, not in game-data class -> {miss if miss else 'none'}")
    return lines, rq_dlc


def scrape_mt2(gamedata=None):
    item, pages = mt2_dump()
    glossary = mt2_glossary(pages)
    infusions = mt2_infusions(pages, glossary)
    cards, seen_ids, nav_count, skipped = [], set(), Counter(), []
    removed = sorted(t for t, p in pages.items()
                     if p["ns"] == 0 and not p["redirect"] and re.search(r"\{\{\s*Removed", p["text"]))
    for key, clan in MT2_CLANS.items():
        nav = pages.get(f"Template:{key}CardNav")
        if not nav:
            print(f"  missing nav for {clan}", file=sys.stderr)
            continue
        for e in parse_nav(nav["text"]):
            page = e["page"]
            p = pages.get(page)
            nav_count[clan] += 1
            infusion = None
            if p and p["redirect"]:
                target = re.search(r"\[\[([^\]|#]+)", p["text"])
                if page in infusions:
                    infusion = infusions[page]
                elif target and target.group(1) in pages:
                    p = pages[target.group(1)]
            pr, tpl = {}, None
            if p and not infusion:
                for t in MT2_TEMPLATE_TYPE:
                    f = find_templates(p["text"], t)
                    if f:
                        pr, tpl = split_params(f[0]), t
                        break
            name = clean(pr.get("name", "")) or re.sub(r"\s*\((spell|card|unit)\)$", "", page)
            section = e["section"]
            if tpl == "UnitCard" and clean(pr.get("cost", "")) == "N/A" and clean(pr.get("rarity", "")) == "N/A":
                skipped.append(f"{name} ({clan}: Cardless unit token listed in the nav)")
                continue
            if infusion:
                raw = "'''[[Persistent]]'''. " + infusion[0]
                ctype, rarity, cost = "Spell", "Infusion (generated)", "0"
            else:
                raw = pr.get("effect") or pr.get("ability") or ""
                ctype = MT2_SECTION_TYPE.get(section) or MT2_TEMPLATE_TYPE.get(tpl, "Spell")
                if section in ("Starters", "Token"):
                    ctype = MT2_TEMPLATE_TYPE.get(tpl, "Spell")
                    # some token pages reuse {{SpellCard}}; the page's own category is more reliable
                    catm = re.search(r"\[\[\s*Category:\s*[\w' ]+? (units|spells|equipment|rooms)\s*\]\]",
                                     p["text"] if p else "")
                    if catm:
                        ctype = {"units": "Unit", "spells": "Spell", "equipment": "Equipment",
                                 "rooms": "Room"}[catm.group(1)]
                rarity = clean(pr.get("rarity", "")) or e["rarity"]
                if rarity in ("N/A", "", None):
                    rarity = None
                cost = mt2_cost(pr.get("cost", ""))
            text = clean(raw)
            if not text and ctype not in ("Unit", "Champion") and p:
                # no printed effect in the infobox (e.g. Crafted Equipment): use the page's lead sentence
                lead = re.sub(r"\{\{.*?\}\}", "", re.sub(r"^.*?\n\}\}\s*", "", p["text"], count=1, flags=re.S),
                              flags=re.S).strip().split("\n\n")[0]
                text = "[wiki summary] " + first_sentence(lead, 200)
            extra = OrderedDict()
            if ctype in ("Unit", "Champion"):
                atk, hp, stats = parse_stats(pr.get("stats", ""))
                extra["subtype"] = None if ctype == "Champion" else (clean(pr.get("type", "")) or
                                                                    ("Morsel" if section == "Morsels" else None))
                extra["attack"], extra["health"] = atk, hp
                if stats and not re.fullmatch(r"-?\d+/-?\d+", stats):
                    extra["stats_raw"] = stats
                size = clean(pr.get("size", ""))
                extra["capacity"] = int(size) if size.isdigit() else (size or None)
                extra["banner"] = e["banner"] or clean(pr.get("banner", "")).lower() == "yes"
            elif ctype == "Equipment" and pr.get("stats"):
                atk, hp, stats = parse_stats(pr.get("stats", ""))
                extra["attack_bonus"], extra["health_bonus"] = atk, hp
            extra["starter"] = section == "Starters"
            if section == "Token":
                extra["token"] = True
            if infusion:
                extra["generated_by"] = "Mix"
                extra["upgrade_options"] = infusion[1]
            extra["dlc"] = "Destiny of the Railforged" if clan == "Railforged" else None
            extra["wiki_page"] = page
            if not p:
                extra["note"] = "no wiki page in dump"
            cid = f"mt2.{slug(name)}"
            if cid in seen_ids:
                cid = f"mt2.{slug(clan)}.{slug(name)}"
            seen_ids.add(cid)
            cards.append(card("mt2", name, clan, ctype, rarity, cost, text, extract_keywords(raw, glossary), extra,
                              cid=cid))
            if ctype == "Champion" and p:
                cards.extend(mt2_champion_upgrades(name, clan, p["text"], glossary))

    # ---- completeness checks
    checks = []
    base = [c for c in cards if c["type"] != "ChampionUpgrade"]
    names = {c["extra"]["wiki_page"] for c in base}
    # (1) category tags on card pages (hand-maintained per page) vs nav templates
    cat_by = defaultdict(set)
    for t, p in pages.items():
        if p["ns"] != 0 or p["redirect"] or t in removed:
            continue
        for clan in MT2_CLANS.values():
            if re.search(r"\[\[\s*Category:\s*" + re.escape(clan) + r" (units|spells|equipment|rooms)\s*[\]|]",
                         p["text"]):
                cat_by[clan].add(t)
        if re.search(r"\[\[\s*Category:\s*(Blights|Scourges)\s*[\]|]", p["text"]):
            cat_by["Clanless"].add(t)
    for clan in MT2_CLANS.values():
        navset = {c["extra"]["wiki_page"] for c in base if c["owner"] == clan}
        extra_cat = sorted(cat_by[clan] - navset)
        missing_cat = sorted(navset - cat_by[clan])
        checks.append(f"{clan}: nav {len(navset)}, category-tagged pages {len(cat_by[clan])}"
                      + (f", category-only {extra_cat}" if extra_cat else "")
                      + (f", nav-only (page lacks the category tag) {missing_cat}" if missing_cat else ""))
    gd_lines = []
    if gamedata and Path(gamedata, "CardData").is_dir():
        gd_lines, rq = mt2_gamedata_check(gamedata, cards)
        norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower().replace("’", "'"))
        for c in cards:
            if c["type"] != "ChampionUpgrade" and rq.get(norm(c["name"])) == "railforged":
                c["extra"]["dlc"] = "Destiny of the Railforged"
    print("  unknown templates:", dict(_unknown_templates.most_common(15)), file=sys.stderr)

    notes = (
        f"Version: Monster Train 2 as documented on the community wiki (patch notes through 2.2.1, Apr 2026; "
        f"page edits through {max(p['ts'] for p in pages.values())[:10]}). Read from Miraheze's public backup "
        f"'{item}' on archive.org because the live wiki ({MT2_WIKI}) serves a bot challenge to scripts. "
        "Card list = the wiki's 13 {{<Clan>CardNav}} templates (12 clans + Clanless); fields from each card page's "
        "infobox. Clans: Banished, Pyreborne, Luna Coven, Underlegion, Lazarus League (new in MT2); Hellhorned, "
        "Awoken, Stygian Guard, Umbra, Melting Remnant (returning, reworked); Wurmkin (returning, free with patch "
        "2.0, Feb 2026); Railforged (paid DLC 'Destiny of the Railforged', Feb 2026; extra.dlc). Native types: "
        "Champion, Unit, Spell, Equipment (attached to a unit), Room (one per floor), Blight, Scourge; "
        "ChampionUpgrade = 24 champions x 3 paths x 3 tiers from {{ChampionPaths}} with absolute stats per tier "
        "(text starts with [attack/health]). Unit 'Ability (Name, Cooldown N)' = clickable activated ability. "
        "extra.banner = banner unit (deploy-phase ember). Lazarus League Infusions (Goliath/Blast/Madman/Enfeebling) "
        "are generated by Mix: cost 0, rarity 'Infusion (generated)', extra.upgrade_options. Railforged tokens "
        "(Crafted Equipment, Scrap Metal) have extra.token. cost_upgraded/text_upgraded are null (no printed "
        "upgrades; upgrades are stones). Excluded: removed cards " + ", ".join(removed) + "; artifacts, upgrade "
        "stones and Pyre Hearts that reuse the card infobox; enemy-only cards; generated unit tokens (Draff, Imp "
        "tokens...); " + "; ".join(skipped) + ". Cards with no printed effect text get a '[wiki summary]' lead "
        "sentence. Completeness: [nav vs per-page category tags] " + "; ".join(checks)
        + ((" | [vs game-data dump brandonandzeus/MonsterTrain2GameData, research-only] " + "; ".join(gd_lines))
           if gd_lines else " | game-data cross-check not run (--mt2-gamedata)"))
    return {
        "game": "Monster Train 2",
        "source": f"{MT2_WIKI} (CC BY-SA) via archive.org backup {item}",
        "retrieved": datetime.date.today().isoformat(),
        "notes": notes,
        "keyword_glossary": dict(sorted(glossary.items())),
        "cards": cards,
    }


# ================================================================= main
def summarize(doc):
    c = Counter((x["owner"], x["type"]) for x in doc["cards"])
    print(f"{doc['game']}: {len(doc['cards'])} entries, {len(doc['keyword_glossary'])} glossary terms")
    for owner in sorted({k[0] for k in c}):
        print("  ", owner, {k[1]: v for k, v in sorted(c.items()) if k[0] == owner})


def main():
    global CACHE, REFRESH
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--game", choices=["mt1", "mt2", "all"], default="all")
    ap.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--mt2-gamedata", default=None)
    a = ap.parse_args()
    CACHE, REFRESH = a.cache, a.refresh
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if a.game in ("mt1", "all"):
        doc = scrape_mt1()
        (OUT_DIR / "mt1.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        summarize(doc)
    if a.game in ("mt2", "all"):
        doc = scrape_mt2(a.mt2_gamedata)
        (OUT_DIR / "mt2.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        summarize(doc)


if __name__ == "__main__":
    main()
