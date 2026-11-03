#!/usr/bin/env python3
"""Card census for Slay the Spire (StS1) and Slay the Spire 2 (StS2) -> JSON.

Research input only (mechanic analysis); the data does not ship in the game.
Source: https://slaythespire.wiki.gg MediaWiki API (content CC BY-SA).

Writes
  data/research/cards/sts1.json
  data/research/cards/sts2.json

Run:  python3 tools/research/scrape_sts.py [--cache FILE]
  --cache FILE  reuse raw API responses stored in FILE (written on first run).
Python 3 stdlib only.
"""
import argparse
import datetime
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

API = "https://slaythespire.wiki.gg/api.php"
UA = "card-mechanics-research-script/1.0 (python-urllib)"
SLEEP = 0.5
ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "data/research/cards"
STS2_PREFIX = "Slay the Spire 2:"

STS1_OWNER = {"Red": "Ironclad", "Green": "Silent", "Blue": "Defect", "Purple": "Watcher",
              "Colorless": "Colorless"}
# Expected StS1 per-character totals (incl. starters); the game has had no card changes since 2020.
STS1_EXPECTED = {"Ironclad": 75, "Silent": 75, "Defect": 75, "Watcher": 75}

# Field-value typos / aliases seen on the wiki -> canonical keyword name.
KW_ALIAS = {
    "Ehxaust": "Exhaust", "Draw Card": "Draw", "Draw (Power)": "Draw", "Wraith From": "Wraith Form",
    "Energized (Defect)": "Energized", "Energized (Silent)": "Energized", "Stars": "Star",
    "Upgraded": "Upgrade", "Orbs": "Orb", "Block Next Turn": "Next Turn Block",
}
NOT_KEYWORDS = {"Ironclad", "Silent", "Defect", "Watcher", "Regent", "Necrobinder"}

# MANUAL_GLOSSARY (end of file): fallback / override one-line definitions for glossary terms.


# ---------------------------------------------------------------- HTTP
def api(params, post=False):
    params = dict(params, format="json")
    body = urllib.parse.urlencode(params)
    for attempt in range(4):
        try:
            if post:
                req = urllib.request.Request(API, data=body.encode(), headers={"User-Agent": UA})
            else:
                req = urllib.request.Request(API + "?" + body, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=90) as r:
                data = json.load(r)
            time.sleep(SLEEP)
            return data
        except Exception as e:  # network hiccup -> back off and retry
            if attempt == 3:
                raise
            print(f"  retry after error: {e}", file=sys.stderr)
            time.sleep(3 * (attempt + 1))


def list_all(params, key):
    out, cont = [], {}
    while True:
        d = api(dict(params, **cont))
        out += d["query"][key]
        if "continue" not in d:
            return out
        cont = d["continue"]


def cargo_all(table, fields, where=None):
    rows, off = [], 0
    while True:
        p = dict(action="cargoquery", tables=table, fields=fields, limit=500, offset=off)
        if where:
            p["where"] = where
        r = [x["title"] for x in api(p)["cargoquery"]]
        rows += r
        if len(r) < 500:
            return rows
        off += 500


def fetch_raw():
    """All raw inputs from the wiki, as one JSON-able dict."""
    print("listing card pages ...", file=sys.stderr)
    titles = set()
    for m in list_all(dict(action="query", list="categorymembers", cmtitle="Category:Cards",
                           cmnamespace="0|3000", cmlimit=500), "categorymembers"):
        titles.add(m["title"])
    # Pages that carry a Card Infobox but miss the category (e.g. a token card on a relic page).
    for m in list_all(dict(action="query", list="embeddedin", eititle="Template:Card Infobox",
                           einamespace="0|3000", eilimit=500), "embeddedin"):
        titles.add(m["title"])
    cargo_cards = cargo_all("Cards", "_pageName,Game,Name,Color,Type,Rarity,Tags")
    for r in cargo_cards:
        if r["Game"] in ("1", "2"):
            titles.add(r["_pageName"])
    titles = sorted(titles)
    print(f"fetching wikitext of {len(titles)} pages ...", file=sys.stderr)
    pages = {}
    for i in range(0, len(titles), 50):
        d = api(dict(action="query", prop="revisions", rvprop="content", rvslots="main",
                     titles="|".join(titles[i:i + 50])), post=True)
        for p in d["query"]["pages"].values():
            if "revisions" in p:
                pages[p["title"]] = p["revisions"][0]["slots"]["main"]["*"]
    print("fetching keyword / power tables ...", file=sys.stderr)
    keywords = cargo_all("Keywords", "_pageName,Game,Name,Description")
    powers = cargo_all("Powers", "_pageName,Game,Name,Description,Type")
    patches = cargo_all("Patches", "_pageName,Version,Type,ReleaseDate", where="Sequel=2")
    return {"pages": pages, "cargo_cards": cargo_cards, "keywords": keywords, "powers": powers,
            "patches": patches}


# ---------------------------------------------------------------- wikitext helpers
def find_templates(text, name):
    """Top-level {{name ...}} bodies, nesting-aware."""
    out, i = [], 0
    pat = re.compile(r"\{\{\s*" + re.escape(name) + r"\s*[|}\n]")
    while True:
        m = pat.search(text, i)
        if not m:
            return out
        s, depth, j = m.start(), 0, m.start()
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
        out.append(text[s + 2:j - 2])
        i = j


def split_params(body):
    parts, cur, depth, link, i = [], "", 0, 0, 0
    while i < len(body):
        two = body[i:i + 2]
        if two in ("{{", "}}", "[[", "]]"):
            depth += two == "{{"
            depth -= two == "}}"
            link += two == "[["
            link -= two == "]]"
            cur += two
            i += 2
            continue
        if body[i] == "|" and depth == 0 and link == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += body[i]
        i += 1
    parts.append(cur)
    params, pos = {}, 1
    for p in parts[1:]:
        if re.match(r"^\s*[^=\{\[|]+=", p):
            k, v = p.split("=", 1)
            params[k.strip()] = v.strip()
        else:
            params[str(pos)] = p.strip()
            pos += 1
    return parts[0].strip(), params


def resolve_choices(s, idx):
    """'(a;b)' wiki notation = base;upgraded. Pick option idx (0 base, 1 upgraded)."""
    out, i = "", 0
    while i < len(s):
        if s.startswith("{{", i):  # template: resolve choices inside its params, keep braces
            depth, j = 0, i
            while j < len(s):
                if s.startswith("{{", j):
                    depth += 1
                    j += 2
                elif s.startswith("}}", j):
                    depth -= 1
                    j += 2
                    if depth == 0:
                        break
                else:
                    j += 1
            out += "{{" + resolve_choices(s[i + 2:j - 2], idx) + "}}"
            i = j
            continue
        if s[i] == "(":
            depth = tdepth = ldepth = 0
            semis, close, j = [], None, i
            while j < len(s):
                two = s[j:j + 2]
                if two in ("{{", "}}", "[[", "]]"):
                    tdepth += (two == "{{") - (two == "}}")
                    ldepth += (two == "[[") - (two == "]]")
                    j += 2
                    continue
                c = s[j]
                if tdepth == 0 and ldepth == 0:
                    if c == "(":
                        depth += 1
                    elif c == ")":
                        depth -= 1
                        if depth == 0:
                            close = j
                            break
                    elif c == ";" and depth == 1:
                        semis.append(j)
                j += 1
            if close is not None and semis:
                bounds = [i] + semis + [close]
                opts = [s[bounds[k] + 1:bounds[k + 1]] for k in range(len(bounds) - 1)]
                out += resolve_choices(opts[min(idx, len(opts) - 1)], idx)
                i = close + 1
                continue
        out += s[i]
        i += 1
    return out


LABEL_TEMPLATES = {"KW", "KW2", "BD", "BD2", "C", "C2", "2", "TS", "QueryLink", "QueryLink2", "Frame"}


def render_template(body):
    name, p = split_params(body)
    pos = [p[k] for k in sorted((k for k in p if k.isdigit()), key=int)]
    if name in ("Icon", "Icon2"):
        code = pos[0] if pos else ""
        if code == "ST":
            return "[Star]"
        if len(code) == 2 and code.endswith("E"):
            return "[E]"
        return code
    if name in ("KW", "KW2", "BD", "BD2", "C", "C2") and len(pos) > 1 and pos[-1] in ("1", "2"):
        pos = pos[:-1]
    pos = [x for x in pos if x != ""]
    if name in LABEL_TEMPLATES or pos:
        return pos[-1] if pos else ""
    return ""


def to_plain(s):
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
    # expanded icon spans (Cargo descriptions): data-name='@XE' = energy, '@ST' = star
    s = re.sub(r"<span[^>]*data-name=['\"]@(\w+)['\"][^>]*>.*?</span>",
               lambda m: "[Star]" if m.group(1) == "ST" else "[E]", s)
    s = re.sub(r"\[\[File:[^\]]*\]\]", "", s)
    s = re.sub(r"\[\[([^\]|]*)\|([^\]]*)\]\]", r"\2", s)
    s = re.sub(r"\[\[([^\]]*)\]\]", lambda m: m.group(1).split(":")[-1].split("#")[-1], s)
    s = re.sub(r"\[https?://\S+\s+([^\]]*)\]", r"\1", s)
    for _ in range(10):  # innermost templates first
        s2 = re.sub(r"\{\{([^{}]*)\}\}", lambda m: render_template(m.group(1)), s)
        if s2 == s:
            break
        s = s2
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("'''", "").replace("''", "").replace("&nbsp;", " ")
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"\s+([.,:;!?)])", r"\1", s)
    s = re.sub(r"\(\s+", "(", s)
    return s


def template_args(s, names):
    out = []
    for n in names:
        for body in find_templates(s, n):
            _, p = split_params(body)
            if p.get("1"):
                out.append(p["1"])
    return out


def norm_kw(k):
    k = re.sub(r"\s+", " ", k.replace(STS2_PREFIX, "")).strip()
    return KW_ALIAS.get(k, k)


def cost_str(v):
    v = (v or "").strip()
    return {"-1": "X", "-2": "U", "": None}.get(v, v)


def slug(name):
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def split_list(v):
    return [x.strip() for x in (v or "").split(",") if x.strip()]


# ---------------------------------------------------------------- build
def parse_infoboxes(pages):
    """Every Card Infobox -> dict, tagged with game and page."""
    rows = []
    for title, text in pages.items():
        if title.startswith(("Board Game:", "User:")):
            continue
        game = 2 if title.startswith(STS2_PREFIX) else 1
        beta_page = bool(re.search(r"\{\{\s*Beta content", text, re.I))
        for body in find_templates(text, "Card Infobox"):
            _, p = split_params(body)
            if p.get("Sequel") == "2":
                game = 2
            p["_page"], p["_game"], p["_beta_page"] = title, game, beta_page
            rows.append(p)
    return rows


def beta_new_cards(pages, major_version):
    """Cards whose update history says they were added after the last Major Update (beta branch)."""
    def vkey(v):
        return tuple(int(x) for x in re.findall(r"\d+", v))
    new = set()
    for title, text in pages.items():
        if not title.startswith(STS2_PREFIX) or not re.search(r"\{\{\s*Beta content", text, re.I):
            continue
        for body in find_templates(text, "Update History Table/row"):
            _, p = split_params(body)
            ver, note = p.get("1", ""), p.get("2", "")
            if vkey(ver) > vkey(major_version) and re.search(
                    r"Added (new|returning|.{1,40}? to the game)", note) and not re.search(
                    r"portrait|art\b|SFX", note):
                new.add(title)
    return new


def make_card(p, game):
    name = p.get("DisplayName") or p["Name"]
    desc = p.get("Description", "")
    color, typ = p.get("Color", ""), p.get("Type", "")
    if typ in ("Curse", "Status"):
        owner = typ
    elif game == 1:
        owner = STS1_OWNER.get(color, color)
    else:
        owner = color
    rarity = p.get("Rarity") or ("Curse" if typ == "Curse" else "")
    no_upgrade = p.get("NoUpgrade", "").lower() in ("true", "yes", "1")
    cost = cost_str(resolve_choices(p.get("Cost", ""), 0))
    cost_up = cost_str(p.get("CostPlus")) or cost_str(resolve_choices(p.get("Cost", ""), 1))
    text = to_plain(resolve_choices(desc, 0))
    text_up = None if no_upgrade else to_plain(resolve_choices(desc, 1))

    roles = {k: [norm_kw(x) for x in split_list(p.get(f))]
             for k, f in (("player", "GivesToPlayer"), ("enemy", "GivesToEnemy"),
                          ("power", "PowerGives"), ("interacts", "InteractsWith"))}
    roles = {k: v for k, v in roles.items() if v}
    kws, self_power = [], None
    for k in [x for v in roles.values() for x in v] + [norm_kw(x) for x in template_args(
            desc, ["KW", "KW2", "BD", "BD2"])]:
        if k.lower() in (name.lower(), p["Name"].lower()):
            self_power = k
            continue
        if k not in kws and k not in NOT_KEYWORDS:
            kws.append(k)
    card_refs = []
    for c in template_args(desc, ["C", "C2"]):
        c = c.replace(STS2_PREFIX, "")
        if c not in card_refs and c != p["Name"]:
            card_refs.append(c)

    extra = {}
    if p.get("DisplayName"):
        extra["wiki_name"] = p["Name"]
    if p.get("OverrideColor"):
        extra["frame_color"] = p["OverrideColor"]
    if p.get("StarCost"):
        extra["star_cost"] = cost_str(p["StarCost"])
    if no_upgrade:
        extra["no_upgrade"] = True
    if p.get("MultiplayerOnly", "").lower() == "true":
        extra["multiplayer_only"] = True
    if roles:
        extra["keyword_roles"] = roles
    if self_power:
        extra["self_power"] = self_power
    if card_refs:
        extra["card_refs"] = card_refs
    if p["_page"] != (STS2_PREFIX if game == 2 else "") + p["Name"]:
        extra["wiki_page"] = p["_page"]
    return {"id": f"sts{game}.{slug(p['Name'])}", "name": name, "owner": owner, "type": typ,
            "rarity": rarity, "cost": cost, "cost_upgraded": cost_up if cost_up != cost else None,
            "text": text, "text_upgraded": text_up, "keywords": kws, "extra": extra}


def build(raw):
    pages = raw["pages"]
    patches = sorted(raw["patches"], key=lambda r: r["ReleaseDate"])
    majors = [r for r in patches if r["Type"] == "Major Update"]
    last_major = majors[-1]["Version"] if majors else "V0"
    latest = patches[-1] if patches else {}
    beta_new = beta_new_cards(pages, last_major)

    rows = parse_infoboxes(pages)
    cards = {1: {}, 2: {}}
    excluded = {1: defaultdict(list), 2: defaultdict(list)}
    sub_options = []
    for p in rows:
        g, page = p["_game"], p["_page"]
        if p.get("NoStore", "").lower() in ("true", "yes"):
            if page in ("Cards", STS2_PREFIX + "Cards"):
                continue  # example infobox on an overview page (duplicate of a real card)
            why = "unused (never released)" if "Unused" in page else "removed/deprecated"
            excluded[g][why].append(p["Name"])
            continue
        if "NoList" in split_list(p.get("Tags")):
            sub_options.append(p)
            continue
        c = make_card(p, g)
        if p["_beta_page"]:
            c["extra"]["beta_branch_page"] = True
        if page in beta_new and g == 2:
            c["extra"]["beta_branch_new"] = True
        if c["id"] in cards[g]:
            print(f"  duplicate id {c['id']} ({page}) skipped", file=sys.stderr)
            continue
        cards[g][c["id"]] = c

    # Choice / variant cards (Wish options, Mad Science variants) fold into their parent card.
    for p in sub_options:
        g = p["_game"]
        parent_name = p.get("DisplayName")
        parent = None
        if parent_name:
            parent = cards[g].get(f"sts{g}.{slug(parent_name)}")
        if parent is None:
            page_rows = [r for r in rows if r["_page"] == p["_page"] and "NoList" not in
                         split_list(r.get("Tags"))]
            if page_rows:
                parent = cards[g].get(f"sts{g}.{slug(page_rows[0]['Name'])}")
        v = make_card(p, g)
        entry = {"name": p["Name"], "type": v["type"], "cost": v["cost"], "text": v["text"],
                 "text_upgraded": v["text_upgraded"], "keywords": v["keywords"]}
        if parent is None:
            print(f"  orphan sub-option {p['Name']} kept as card", file=sys.stderr)
            cards[g][v["id"]] = v
        else:
            parent["extra"].setdefault("variants", []).append(entry)
    return cards, excluded, beta_new, last_major, latest


def glossary(cards, raw, game):
    used = Counter(k for c in cards for k in c["keywords"])
    for c in cards:
        for v in c["extra"].get("variants", []):
            used.update(v["keywords"])
    defs = {}
    for tbl in ("keywords", "powers"):
        for r in raw[tbl]:
            if r["Game"] != str(game) or not r.get("Description"):
                continue
            n = norm_kw(r["Name"])
            d = to_plain(r["Description"])
            if n not in defs and d:
                defs[n] = d
    tokens = {c["name"]: c for c in cards}
    out, missing = {}, []
    always = ["Energy", "Block", "Exhaust", "Ethereal", "Innate", "Retain", "Unplayable", "Upgrade"]
    always += {1: ["Orb", "Stance", "Mantra", "Scry"], 2: ["Orb", "Star", "Forge", "Summon", "Osty",
                                                           "Doom", "Sly", "Replay", "Enchant"]}[game]
    for k in sorted(set(used) | set(always)):
        d = MANUAL_GLOSSARY.get(game, {}).get(k) or MANUAL_GLOSSARY.get(0, {}).get(k) or defs.get(k)
        if not d and k in tokens:  # keyword that is itself a generated card (e.g. Shiv)
            t = tokens[k]
            d = f"Generated {t['type']} card (cost {t['cost']}): {t['text']}"
        if not d:
            missing.append(k)
            continue
        out[k] = d
    return out, missing


def cargo_counts(raw, game):
    c = Counter()
    for r in raw["cargo_cards"]:
        if r["Game"] != str(game) or "NoList" in (r.get("Tags") or ""):
            continue
        if r["Type"] in ("Curse", "Status"):
            owner = r["Type"]
        else:
            owner = STS1_OWNER.get(r["Color"], r["Color"]) if game == 1 else r["Color"]
        c[owner] += 1
    return c


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
    cards, excluded, beta_new, last_major, latest = build(raw)
    today = datetime.date.today().isoformat()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for g, gname in ((1, "Slay the Spire"), (2, "Slay the Spire 2")):
        lst = sorted(cards[g].values(), key=lambda c: (c["owner"], c["type"], c["name"]))
        gl, missing = glossary(lst, raw, g)
        ours = Counter(c["owner"] for c in lst)
        wiki = cargo_counts(raw, g)
        check = []
        for o in sorted(set(ours) | set(wiki)):
            line = f"{o}: scraped {ours[o]}, wiki Cargo/Cards List {wiki[o]}"
            if g == 1 and o in STS1_EXPECTED:
                line += f", expected {STS1_EXPECTED[o]}"
            check.append(line)
        notes = [
            "Text uses [E] for one Energy icon" + (" and [Star] for one Star icon (Regent resource)."
                                                   if g == 2 else "."),
            "cost: 'X' = X-cost, 'U' = unplayable; cost_upgraded only when the upgrade changes it.",
            "text_upgraded is null for cards that cannot be upgraded (extra.no_upgrade).",
            "keywords come from the infobox GivesToPlayer/GivesToEnemy/PowerGives/InteractsWith fields plus "
            "keyword/buff templates in the description; a power named after the card itself is in "
            "extra.self_power instead. extra.keyword_roles keeps who receives each (player/enemy/...).",
            "Choice cards are folded into their parent as extra.variants (StS1 Wish options; StS2 Mad Science's "
            "9 Tinker Time variants).",
        ]
        for why, names in sorted(excluded[g].items()):
            notes.append(f"Excluded {why}: {', '.join(sorted(set(names)))}.")
        if g == 1:
            notes.append("StS1 is a finished game; its card pool has been stable since the Watcher's 2020 release. Curses/Statuses use owner "
                         "'Curse'/'Status'; Special-rarity entries are generated cards (Shiv, Miracle, Beta...).")
        else:
            bn = sorted(c["name"] for c in lst if c["extra"].get("beta_branch_new"))
            nb = sum(1 for c in lst if c["extra"].get("beta_branch_page"))
            notes.append(
                f"StS2 is in Early Access (since 2026-03-05). The wiki tracks the public beta branch: last "
                f"Major Update {last_major}; latest logged patch {latest.get('Version')} "
                f"({latest.get('Type')}, {latest.get('ReleaseDate')}). {nb} cards are on pages flagged "
                f"'Beta content' (values may differ from the stable branch, extra.beta_branch_page). "
                f"Cards that look newly added in the beta branch (extra.beta_branch_new, from update "
                f"history): {', '.join(bn) or 'none'}.")
            mp = sorted(c["name"] for c in lst if c["extra"].get("multiplayer_only"))
            notes.append(f"{len(mp)} cards are co-op multiplayer only (extra.multiplayer_only): {', '.join(mp)}.")
            notes.append("Colorless 'Event' cards with extra.frame_color use a character's card frame but are "
                         "obtainable by everyone. Rarity 'Token' = generated card; 'Ancient' = offered by the Ancients "
                         "(act-start boon NPCs such as Neow); 'Quest' type = quest cards. Regent cards may cost Stars "
                         "(extra.star_cost) in addition to Energy.")
        if missing:
            notes.append(f"No definition found for: {', '.join(missing)}.")
        notes.append("Completeness check vs wiki Cargo 'Cards' table (which backs the wiki's Cards List / "
                     "per-character list pages): " + "; ".join(check) + ".")
        doc = {"game": gname, "source": "https://slaythespire.wiki.gg (CC BY-SA)", "retrieved": today,
               "notes": " ".join(notes), "keyword_glossary": gl, "cards": lst}
        path = OUT_DIR / f"sts{g}.json"
        path.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n")
        print(f"wrote {path} ({len(lst)} cards, {len(gl)} glossary terms)")
        for line in check:
            print("  " + line)
        if missing:
            print("  glossary missing: " + ", ".join(missing))
        tbl = Counter((c["owner"], c["type"]) for c in lst)
        for o in sorted({o for o, _ in tbl}):
            print(f"  {o:12s} " + "  ".join(f"{t}={n}" for (oo, t), n in sorted(tbl.items()) if oo == o))


MANUAL_GLOSSARY = {
    0: {  # both games; overrides wiki text where the wiki entry is a homonymous power
        "Draw": "Move cards from the top of your draw pile into your hand (the discard pile is reshuffled "
                "into it when it runs out).",
        "Discard": "Put a card from your hand into the discard pile without playing it.",
        "Lose HP": "Lose HP directly; Block does not prevent it (self-damage costs, or damage that skips Block).",
        "Heal": "Restore HP, up to your Max HP.",
        "Gold": "Run currency, spent at the Merchant.",
        "Orb": "Defect resource: Channel puts an Orb into an Orb slot; each Orb has a passive effect every "
               "turn and a stronger one-shot Evoke effect when pushed out or evoked. Focus boosts both.",
        "Strength (Negative)": "Lose X Strength (enemy or self): attacks deal X less damage.",
        "Dexterity (Negative)": "Lose X Dexterity: Block gained from cards is X lower.",
        "End Turn": "Your turn ends immediately.",
        "Debuff": "A negative status on a creature (Weak, Vulnerable, Poison, Doom ...); Artifact negates one.",
        "Draw Next Turn": "At the start of your next turn, draw X additional cards.",
        "Energy Next Turn": "Gain X additional [E] next turn.",
        "Star Next Turn": "Gain X [Star] next turn.",
    },
    1: {
        "Stance": "Watcher mode: Calm, Wrath or Divinity (or none). Only one at a time; cards enter/exit "
                  "stances and many cards trigger on a stance change.",
    },
    2: {
        "Star": "Regent's second resource ([Star]): gained from cards/relics, not refilled each turn, carried "
                "over between turns; some cards cost Stars in addition to Energy.",
        "Osty": "Necrobinder's companion (her skeletal left hand). While alive he absorbs unblocked attack "
                "damage for her (Die for You); some cards make Osty attack. His damage ignores Strength/Weak.",
    },
}

if __name__ == "__main__":
    main()
