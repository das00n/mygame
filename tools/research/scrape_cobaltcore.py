#!/usr/bin/env python3
"""Scrape every Cobalt Core card from cobaltcore.wiki.gg (CC BY-SA) into one JSON file.

Research input only (mechanic analysis) -- the data does not ship.
Stdlib only, re-runnable:

    python3 tools/research/scrape_cobaltcore.py [--out data/research/cards/cobaltcore.json]

Sources (MediaWiki API, batched 50 pages per request with continuation):
  * Category:Cards (every page using Template:Card)  -> card texts, base + upgrade A + upgrade B
  * Template:<X> Card Navbox                        -> the wiki's own per-character card lists
  * Status / Card Traits / Part Traits / Midrow Objects pages -> keyword glossary
"""
import argparse
import datetime
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

API = "https://cobaltcore.wiki.gg/api.php"
WIKI = "https://cobaltcore.wiki.gg/wiki/"
UA = "Mozilla/5.0 (compatible; card-research-scraper/1.0)"
SLEEP = 0.5
DEFAULT_OUT = Path(__file__).resolve().parents[2] / "data/research/cards/cobaltcore.json"

NAVBOXES = ["Dizzy", "Riggs", "Peri", "Isaac", "Drake", "Max", "Books", "CAT", "Event", "Trash", "Other"]
CREW = ["Dizzy", "Riggs", "Peri", "Isaac", "Drake", "Max", "Books", "CAT"]
SOURCE_GROUP = {**{c: "crew" for c in CREW}, "Basic": "starter", "Ares": "ship", "Jupiter": "ship",
                "Dracula": "event", "Ephemeral": "event", "Sasha": "event", "Soggins": "event",
                "Tooth": "event", "Trash": "trash", "Corrupted": "trash", "Evil Riggs": "finale"}
# Cards a player cannot hold in a normal run (decided from the wiki's own intro text on each page).
NOT_OBTAINABLE = {
    "Jupiter Eclipse": "Removed in patch 1.0.6 (Jupiter Drone Hub V2 no longer generates it).",
    "Missile Swarm": "Riggs's 'evil' side; only present in the scripted Finale, never in a normal deck.",
}
RARITY_ORDER = ["Common", "Uncommon", "Rare"]


# ---------------------------------------------------------------- API
def api(**params):
    params.update(format="json", formatversion="2")
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params), headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:  # network hiccup: back off and retry
            if attempt == 3:
                raise
            print(f"  retry after error: {e}", file=sys.stderr)
            time.sleep(2 * (attempt + 1))


def fetch_pages(**gen):
    """Generator query + wikitext of each page, following continuation. Returns {title: wikitext}."""
    out, cont = {}, {}
    while True:
        d = api(action="query", prop="revisions", rvprop="content", rvslots="main", redirects=1, **gen, **cont)
        for p in d.get("query", {}).get("pages", []):
            if "revisions" in p:
                out[p["title"]] = p["revisions"][0]["slots"]["main"]["content"]
        if "continue" not in d:
            return out
        cont = d["continue"]
        time.sleep(SLEEP)


def fetch_titles(titles):
    out = {}
    for i in range(0, len(titles), 50):
        out.update(fetch_pages(titles="|".join(titles[i:i + 50])))
        time.sleep(SLEEP)
    return out


def template_users(template):
    users, cont = [], {}
    while True:
        d = api(action="query", list="embeddedin", eititle=template, eilimit=500, einamespace=0, **cont)
        users += [x["title"] for x in d["query"]["embeddedin"]]
        if "continue" not in d:
            return users
        cont = d["continue"]
        time.sleep(SLEEP)


# ---------------------------------------------------------------- wikitext -> plain text
def plain(s):
    s = re.sub(r"<gallery>.*?</gallery>", "", s, flags=re.S)
    s = re.sub(r"\[\[File:[^\]]*\]\]", "", s)
    s = re.sub(r"\{\{[^{}]*\}\}", "", s)
    s = re.sub(r"<br\s*[^>]*>", "\n", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"\[\[:?(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"'{2,}", "", s)  # bold/italic markup (incl. stray 4-quote runs)
    # the wiki marks upgrade deltas like "(+1)", "(-1)", "(+1, +1)" -- not card text
    s = re.sub(r"\s*\(\s*[+-]\d+(?:\s*,\s*[+-]\d+)*\s*\)", "", s)
    return html.unescape(s)


def one_line(s):
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"\.\s*\.", ".", s)
    return s


def sections(wikitext, level=2):
    eq = "=" * level
    parts = re.split(rf"^{eq}([^=].*?){eq}\s*$", wikitext, flags=re.M)
    return {re.sub(r"\[\[File:[^\]]*\]\]", "", parts[i]).strip(): parts[i + 1] for i in range(1, len(parts), 2)}


TRAIT_RE = [
    ("Exhaust", r"^(?:Is an? )?Exhausts?(?: when played| \(instead of Single Use\))?$"),
    ("Retain", r"^Retains?$"),
    ("Recycle", r"^Recycles?$"),
    ("Temporary", r"^(?:Is a )?Temporary(?: card)?(?: \(.*\))?$"),
    ("Single Use", r"^Single [Uu]se$"),
    ("Infinite", r"^Infinite$"),
    ("Buoyant", r"^Buoyant$"),
    ("Flippable", r"^Flippable\*?$"),
    ("Dual Card", r"^Dual Card$"),
    ("Unplayable", r"^Unplayable$"),
]


def parse_version(block):
    """One card version (Description or Upgrade X block) -> dict(cost, text, traits)."""
    cost, parts, trait_lines = None, [], []
    lines = plain(block).split("\n")
    for ln in lines:
        ln = ln.strip()
        m = re.match(r"^Costs?\s+(\S+)\s+energy(\s+and\s+exhausts)?\.?\s*", ln, re.I)
        if m and cost is None:
            cost, ln = m.group(1), ln[m.end():]
            if m.group(2):  # e.g. Basic Dodge B: "Costs 0 energy and exhausts."
                lines.append("Exhausts when played.")
        if ln.startswith("---OR---"):
            parts.append("OR (other half of this Dual Card):")
            continue
        action = bool(re.match(r"^(:|\d+\.)", ln))  # ":1. ..." / ":Nothing." lines are card actions
        ln = re.sub(r"^:*\s*(\d+\.)?\s*", "", ln)
        ln = re.sub(r"\bWhen played:\s*", "", ln).strip()
        if not ln:
            continue
        if not action:
            trait_lines.append(ln)
        parts.append(ln if ln.endswith((".", ":", "!", "?", ")")) else ln + ".")
    text = one_line(" ".join(parts))
    traits = []
    for sent in (s for ln in trait_lines for s in re.split(r"(?<=[.)])\s+", ln)):
        sent = sent.strip().rstrip(".").strip()
        for name, rx in TRAIT_RE:
            if re.match(rx, sent) and name not in traits:
                traits.append(name)
    if cost is None and ("Unplayable" in traits or re.search(r"\bunplayable\b", text, re.I)):
        cost = "unplayable"
        if "Unplayable" not in traits:
            traits.append("Unplayable")
    return {"cost": cost, "text": text, "traits": traits}


# ---------------------------------------------------------------- keywords
KEYWORD_PATTERNS = [  # (regex, glossary key or None to just consume the span); longest first
    (r"Crystal Shard|Chip Shot|Jupiter's Moons|Toggle Cannon|War Mode|Load State|Wave Beam|Glissade|Pebble", None),
    (r"[Mm]issi?le [Bb]ay", None),
    (r"Missi?le Malfunction", "Missile Malfunction"),
    (r"Drone ?[Ss]hift", "Droneshift"),
    (r"\b\w+ is Missing\b|\bMissing\b(?! hull)", "Missing"),
    (r"Temp(?:orary)? Shield", "Temp Shield"),
    (r"Max Shield", "Max Shield"),
    (r"Perfect Shield", "Perfect Shield"),
    (r"[Bb]ubble [Ss]hield|[Bb]ubbled", "Bubble Shield"),
    (r"Shield Drone", "Shield Drone"),
    (r"Attack Drone(?: MK ?2)?", "Attack Drone"),
    (r"Energy Drone", "Energy Drone"),
    (r"Jupiter Drone", "Jupiter Drone"),
    (r"Heavy Missi?le", "Heavy Missile"),
    (r"Seeker Missi?le", "Seeker Missile"),
    (r"Acid Missi?le|Corrosive Missi?le", "Acid Missile"),
    (r"Big Space Mine|Space Mine", "Space Mine"),
    (r"Repair Kit", "Repair Kit"),
    (r"\bGeodes?\b", "Geode"),
    (r"\b[Aa]steroids?\b|\b[Bb]oulders?\b|\b[Rr]ocks?\b", "Asteroid"),
    (r"\bFootball\b", "Football"),
    (r"[Mm]idrow [Oo]bjects?", "Midrow Object"),
    (r"\b[Dd]rones?\b", "Midrow Object"),
    (r"\b[Mm]issi?les?\b", "Missile"),
    (r"Stun Charge", "Stun Charge"),
    (r"Stun Source", "Stun Source"),
    (r"\b[Ss]tun(?:s|ned|ning)?\b", "Stun"),
    (r"Temp Payback", "Temp Payback"),
    (r"\bPayback\b", "Payback"),
    (r"Lose All Evade Next Turn", "Lose All Evade Next Turn"),
    (r"(?:Lose|Less) Energy Next Turn", "Less Energy Next Turn"),
    (r"Energy Next Turn", "Energy Next Turn"),
    (r"Draw Less Next Turn|Shaken", "Shaken"),
    (r"Draw Next Turn", "Draw Next Turn"),
    (r"Engine Lock", "Engine Lock"),
    (r"Engine Stall", "Engine Stall"),
    (r"Hermes Boots", "Hermes Boots"),
    (r"Clean Exhaust", "Clean Exhaust"),
    (r"Cheap Fix", "Cheap Fix"),
    (r"Endless Magazine", "Endless Magazine"),
    (r"Rock Factory", "Rock Factory"),
    (r"Table Flip", "Table Flip"),
    (r"Time ?[Ss]top", "Time Stop"),
    (r"Max Shard", "Max Shard"),
    (r"\bShards?\b", "Shard"),
    (r"\bQuarry\b", "Quarry"),
    (r"Autododge", "Autododge"),
    (r"\bAutopilot\b", "Autopilot"),
    (r"\bOverdrive\b", "Overdrive"),
    (r"\bPowerdrive\b", "Powerdrive"),
    (r"\b[Oo]verheat(?:s|ing)?\b", "Overheat"),
    (r"\bHeat\b", "Heat"),
    (r"\bSerenity\b", "Serenity"),
    (r"\bCorro(?:sion|de)\b", "Corrode"),
    (r"\bMitosis\b", "Mitosis"),
    (r"\bStrafe\b", "Strafe"),
    (r"\bFlux\b", "Flux"),
    (r"\bAce\b", "Ace"),
    (r"\bBoost\b", "Boost"),
    (r"\bBubble\b", "Bubble"),
    (r"\bShields?\b", "Shield"),
    (r"\bEvade\b", "Evade"),
    (r"\b[Pp]ierc(?:e|es|ing)\b", "Pierce"),
    (r"\bWeak\b", "Weak"),
    (r"\bBrittle\b", "Brittle"),
    (r"\bArmou?r(?:ed)?\b", "Armored"),
    (r"\b[Ee]xhaust(?:s|ed)?\b", "Exhaust"),
    (r"\bRetains?\b", "Retain"),
    (r"\bRecycles?\b", "Recycle"),
    (r"\b[Tt]emporary\b", "Temporary"),
    (r"\bSingle [Uu]se\b", "Single Use"),
    (r"\bInfinite\b", "Infinite"),
    (r"\bBuoyant\b", "Buoyant"),
    (r"\b[Ff]lippable\b|\b[Ff]lip\b", "Flippable"),
    (r"Dual Card", "Dual Card"),
    (r"\b[Uu]nplayable\b", "Unplayable"),
    (r"\bDiscount(?:ed)?\b", "Discounted"),
    (r"\b[Aa]ctive cannon\b|\bcannons?\b", "Cannon"),
    (r"\b[Ll]aunch(?:es|ed)?\b", "Launch"),
    (r"\b[Aa]ttack(?:s)?\b", "Attack"),
    (r"\b[Mm]ove(?:s)?\b", "Move"),
    (r"\b[Hh]eal(?:s)?\b", "Heal"),
    (r"\bhull\b|\bHull\b", "Hull"),
    (r"\b[Dd]raw(?:s)?\b", "Draw"),
    (r"\b[Dd]iscard(?:s|ed)?\b", "Discard"),
    (r"\bEnergy\b|\benergy\b", "Energy"),
]
_KW = [(re.compile(rx), key) for rx, key in KEYWORD_PATTERNS]


def keywords(text, traits):
    found, s = [], text
    for rx, key in _KW:
        if rx.search(s):
            if key and key not in found:
                found.append(key)
            s = rx.sub(lambda m: "\0" * len(m.group(0)), s)
    for t in traits:
        if t not in found:
            found.append(t)
    return found


# ---------------------------------------------------------------- glossary
MANUAL_GLOSSARY = {  # non-status mechanics, paraphrased from the wiki's Shield / Hull / Energy / Midrow / Mechanics / character pages
    "Hull": "Ship health; damage persists between combats, reaching 0 loses the run. Max Hull can be raised by some effects.",
    "Shield": "Extra hit points in front of Hull that absorb damage first; kept between turns (not combats), capped by Max Shield; ignored by Pierce, Heat/Corrode and self-damage cards.",
    "Temp Shield": "Shield that lasts only until your next turn; separate from Shield and not capped by Max Shield (Time Stop keeps it).",
    "Max Shield": "Cap on regular Shield; any Shield gained above it is wasted.",
    "Energy": "Spent to play cards; 3 per turn by default, does not carry over between turns.",
    "Attack": "Fire from each active cannon straight up its lane for X damage; hits the enemy part (or midrow object) in that lane, misses on empty space.",
    "Cannon": "Ship part attacks come from; ships like Ares/Gemini have two, only the active one fires (Toggle Cannon / War Mode switch it).",
    "Launch": "Place a midrow object in the lane of your Missile Bay (or offset from it); a launch into an occupied lane damages both objects.",
    "Move": "Card action that instantly moves your ship X lanes left/right (Flippable reverses it); blocked by Engine Lock/Engine Stall. Unlike Evade it is not stored.",
    "Heal": "Restore Hull (up to Max Hull).",
    "Draw": "Draw cards from the draw pile (hand limit 10).",
    "Discard": "Move cards from hand to the discard pile (Retain cards survive end of turn but can still be discarded by effects).",
    "Pierce": "Piercing attacks ignore Shield and Armor and destroy midrow objects (even bubbled ones) in one hit.",
    "Stun": "A stunning hit cancels the intent of the enemy part it hits for that turn.",
    "Overheat": "Ending your turn at 3+ Heat (4+ with Next Gen Insulation): take 1 hull damage and Heat resets to 0.",
    "Midrow Object": "Drones, missiles, asteroids, mines etc. in the row between the ships; any attack (even 0 damage) destroys one; they block shots; drones/missiles act in the Drone Turn.",
    "Drone Turn": "Phase after the player's turn and before the enemy's: drones and missiles act left to right in their lanes (missiles sacrifice themselves).",
    "Bubble Shield": "Protects a midrow object from the first attack that hits it (piercing attacks still destroy it).",
    "Seeker Missile": "During the drone turn, sacrifices itself to hit the nearest non-empty ship part for 2 damage regardless of lane (cannot miss).",
    "Missing": "'X is Missing' status: that crew member's cards still cost energy and keep their traits but have no effect when played; each such play reduces the status by 1, at 0 the cards work again. Inflicted by The Tower's cockpit on a random crew member; CAT's Temporal Anomaly self-inflicts 'CAT is Missing' (Basic cards count as CAT cards).",
    "Intent": "Each enemy part telegraphs its action for the turn (attack, shield, launch, status); stun or Concussable hits cancel it.",
}
GLOSSARY_OVERRIDES = {  # wiki first sentence is not a definition
    "Unplayable": "Cannot be played (red line through the cost); leaves hand only at end of turn or via discard/exhaust effects; some have on-draw or in-hand effects.",
    "Dual Card": "Has two alternative action sets split by a line; the highlighted half is performed when played and you can right-click to switch halves.",
}
GLOSSARY_RENAMES = {"Character Is Missing": None,  # covered by MANUAL_GLOSSARY["Missing"]
                    "Autododge (Left)": "Autododge", "Autododge (Right)": None,
                    "Energy Next turn": "Energy Next Turn", "Attack Drone MK 2": None, "Big Space Mine": None}


def first_sentences(text, min_len=90):
    sents = re.split(r"(?<=[.!?])\s+(?=[A-Z(])", one_line(text))
    out = sents[0]
    if len(out) < min_len and len(sents) > 1:
        out += " " + sents[1]
    return out


def wikitable_rows(wikitext):
    rows = []
    for row in wikitext.split("|-")[1:]:
        cells = [one_line(plain(c)) for c in re.split(r"\|\||\n\|", row) if c.strip() and not c.strip().startswith("!")]
        cells = [c.lstrip("| ").strip() for c in cells]
        rows.append([c for c in cells if c and c != "}"])
    return rows


def build_glossary(pages):
    g = {}
    status = pages.get("Status", "")
    for cells in wikitable_rows(status.split("{|", 1)[-1].split("|}", 1)[0]):
        if len(cells) >= 2:
            name, eff = cells[-2], cells[-1]
            name = GLOSSARY_RENAMES.get(name, name)
            if name:
                if name == "Autododge":
                    eff = eff.replace("one space left", "one space left/right (per variant)")
                g[name] = eff
    for page in ("Card Traits", "Part Traits"):
        for head, body in sections(pages.get(page, "")).items():
            name = GLOSSARY_RENAMES.get(head, head)
            if name:
                g[name] = GLOSSARY_OVERRIDES.get(name) or first_sentences(plain(body))
    midrow = pages.get("Midrow Objects", "")
    if "{|" in midrow:
        for cells in wikitable_rows(midrow.split("{|", 1)[1].split("|}", 1)[0]):
            if len(cells) >= 3:
                name = GLOSSARY_RENAMES.get(cells[0], cells[0])
                if name:
                    g[name] = re.sub(r"\s*See [^.]* for details\.", "", cells[1]).replace("!*", "!")
    g.update(MANUAL_GLOSSARY)
    g["Corrode"] = g.get("Corrode", "") + " (card text calls it Corrosion)"
    if "Shaken" in g:
        g["Shaken"] += " (formerly 'Draw Less Next Turn')"
    return dict(sorted(g.items(), key=lambda kv: kv[0].lower()))


# ---------------------------------------------------------------- navboxes
def parse_navbox(wikitext):
    groups, lists = {}, {}
    for m in re.finditer(r"^\|\s*(group|list)(\d+)\s*=\s*(.*)$", wikitext, re.M):
        kind, n, val = m.groups()
        (groups if kind == "group" else lists)[n] = val
    out = {}
    for n, val in lists.items():
        label = one_line(plain(groups.get(n, "")))
        for link in re.findall(r"\[\[([^\]|]+)(?:\|[^\]]*)?\]\]", val):
            out[link.strip()] = label
    return out


# ---------------------------------------------------------------- main
def slug(name):
    return "cc." + re.sub(r"[^a-z0-9]+", "_", name.lower().replace("'", "")).strip("_")


def owner_of(wikitext):
    cats = [c.strip() for c in re.findall(r"\[\[Category:\s*([^\]|]+)", wikitext)]
    owners = [c[:-6] for c in cats if c.endswith(" Cards")]
    owners = ["Evil Riggs" if o == "Evilriggs" else o for o in owners]
    return owners


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    print("fetching Category:Cards ...", file=sys.stderr)
    raw = fetch_pages(generator="categorymembers", gcmtitle="Category:Cards", gcmtype="page", gcmlimit=50)
    raw.pop("Cards", None)  # the overview page, not a card
    embedded = set(template_users("Template:Card"))
    print("fetching navboxes + glossary pages ...", file=sys.stderr)
    navraw = fetch_titles([f"Template:{n} Card Navbox" for n in NAVBOXES])
    meta = fetch_titles(["Status", "Card Traits", "Part Traits", "Midrow Objects"])

    navbox = {}  # card -> (navbox, group)
    for n in NAVBOXES:
        for card, grp in parse_navbox(navraw.get(f"Template:{n} Card Navbox", "")).items():
            navbox.setdefault(card, (n, grp))

    cards, problems = [], []
    for title in sorted(raw, key=str.lower):
        wt = raw[title]
        owners = owner_of(wt)
        owner = owners[0] if owners else None
        if len(owners) != 1:
            problems.append(f"{title}: owner categories {owners}")
        rarity = (re.search(r"\|\s*rarity\s*=\s*([^\n|]*)", wt) or [None, None])[1]
        rarity = rarity.strip() if rarity else None
        deck_field = one_line(plain((re.search(r"\|\s*deck\s*=\s*([^\n]*)", wt) or [None, ""])[1]))
        secs = sections(wt)
        base = parse_version(secs.get("Description", ""))
        if base["cost"] is None and "unplayable" not in base["text"].lower():
            problems.append(f"{title}: no base cost parsed")
        ups = {}
        up_secs = sections(secs.get("Upgrades", ""), level=3)
        if not up_secs and secs.get("Upgrades", "").strip():  # no "===X A===" headings (e.g. Anchor)
            chunks = re.split(r"(?=\[\[File:Card[^|\]]*?[AB]\.png)", secs["Upgrades"])
            up_secs = {"x " + re.search(r"File:Card[^|\]]*?([AB])\.png", ch).group(1): ch
                       for ch in chunks if re.search(r"File:Card[^|\]]*?[AB]\.png", ch)}
        gallery = (re.search(r"<gallery>(.*?)</gallery>", wt, re.S) or [None, ""])[1]
        for head, body in up_secs.items():
            m = re.search(r"\s([AB])$", head)
            if not m:
                problems.append(f"{title}: odd upgrade heading {head!r}")
                continue
            v = parse_version(body)
            if v["cost"] is None:  # wiki omits the cost line when unchanged (e.g. Leech B)
                v["cost"] = base["cost"]
            v["keywords"] = keywords(v["text"], v["traits"])
            ups["upgrade_" + m.group(1).lower()] = v
        for x in "AB":
            if (f"Upgrade {x}" in gallery) != (f"upgrade_{x.lower()}" in ups):
                problems.append(f"{title}: infobox gallery and Upgrades section disagree on upgrade {x}")
        intro = wt.split("}}", 1)[-1].split("==", 1)[0]
        nb = navbox.get(title, (None, None))
        # infobox rarity is occasionally stale; take the majority of infobox / navbox group / intro sentence
        m = re.search(r"\bis an? (common|uncommon|rare)\b", plain(intro), re.I)
        votes = [r for r in (rarity, nb[1] if nb[1] in RARITY_ORDER else None, m.group(1).title() if m else None) if r]
        best = Counter(votes).most_common()
        if len(best) > 1:
            pick = best[0][0] if best[0][1] > best[1][1] else (nb[1] if nb[1] in RARITY_ORDER else rarity)
            problems.append(f"{title}: rarity sources disagree {votes} -> using {pick}")
            infobox_rarity, rarity = rarity, pick
        extra = {
            "upgrade_a": ups.get("upgrade_a"),
            "upgrade_b": ups.get("upgrade_b"),
            "traits": base["traits"],
            "player_obtainable": title not in NOT_OBTAINABLE,
            "source_group": SOURCE_GROUP.get(owner, "other"),
            "draftable": owner in CREW and nb[1] in RARITY_ORDER,
            "navbox": f"{nb[0]} / {nb[1]}" if nb[0] else None,
            "deck_field": deck_field,
            "wiki_intro": one_line(plain(intro)),
            "url": WIKI + urllib.parse.quote(title.replace(" ", "_")),
        }
        if title in NOT_OBTAINABLE:
            extra["not_obtainable_reason"] = NOT_OBTAINABLE[title]
        if len(best) > 1:
            extra["rarity_infobox"] = infobox_rarity
        if owner == "Basic":
            extra["counts_as_owner"] = "CAT"  # per Temporal Anomaly clarification on the wiki
        if "Clarification" in secs:
            extra["clarification"] = one_line(plain(secs["Clarification"]))
        cards.append({
            "id": slug(title),
            "name": title,
            "owner": owner,
            "type": None,  # Cobalt Core has no native card types (no Attack/Skill/Power split)
            "rarity": rarity,
            "cost": base["cost"],
            "cost_upgraded": None,  # two upgrade paths -> see extra.upgrade_a / extra.upgrade_b
            "text": base["text"],
            "text_upgraded": None,
            "keywords": keywords(base["text"], base["traits"]),
            "extra": extra,
        })

    # ------------------------------------------------ completeness check
    names = {c["name"] for c in cards}
    by_owner = defaultdict(Counter)
    for c in cards:
        by_owner[c["owner"]][c["rarity"]] += 1
    nb_by_owner = defaultdict(set)
    for card, (n, grp) in navbox.items():
        nb_by_owner[n].add(card)
    disc = []
    if embedded - names:
        disc.append(f"pages using Template:Card but not in Category:Cards: {sorted(embedded - names)}")
    if names - embedded:
        disc.append(f"Category:Cards pages without Template:Card: {sorted(names - embedded)}")
    if set(navbox) - names:
        disc.append(f"navbox links with no card page: {sorted(set(navbox) - names)}")
    if names - set(navbox):
        disc.append(f"card pages missing from every navbox: {sorted(names - set(navbox))}")
    for c in cards:
        n, grp = navbox.get(c["name"], (None, None))
        if c["owner"] in CREW and n != c["owner"]:
            disc.append(f"{c['name']}: category owner {c['owner']} but listed in {n} navbox")
        if c["owner"] in CREW and grp in RARITY_ORDER and grp != c["rarity"]:
            disc.append(f"{c['name']}: infobox rarity {c['rarity']} vs navbox {grp}")
    per_crew = {}
    for o in CREW:
        cat_n = sum(by_owner[o].values())
        nb_n = len(nb_by_owner[o] - {c["name"] for c in cards if c["owner"] == "Basic"})
        draft = Counter(c["rarity"] for c in cards if c["owner"] == o and c["extra"]["draftable"])
        per_crew[o] = {"category": cat_n, "navbox": nb_n, "draftable_C_U_R": [draft[r] for r in RARITY_ORDER],
                       "generated_only": sorted(c["name"] for c in cards if c["owner"] == o and not c["extra"]["draftable"])}
        if cat_n != nb_n:
            disc.append(f"{o}: {cat_n} pages in category vs {nb_n} in navbox")

    glossary = build_glossary(meta)
    used = Counter(k for c in cards for k in c["keywords"] + [k for u in ("upgrade_a", "upgrade_b") if c["extra"][u] for k in c["extra"][u]["keywords"]])
    undefined = sorted(k for k in used if k not in glossary)
    if undefined:
        disc.append(f"keywords without glossary entry: {undefined}")

    out = {
        "game": "Cobalt Core",
        "source": "https://cobaltcore.wiki.gg (CC BY-SA)",
        "retrieved": datetime.date.today().isoformat(),
        "notes": (
            "Wiki state as of retrieval (game patch history on wiki runs to 1.2.6, 2026-01-04). "
            "Every page in Category:Cards (= every page using Template:Card) is included. "
            "Each card has a base version plus two alternative upgrades A and B: base cost/text are top-level, "
            "upgrades are in extra.upgrade_a / extra.upgrade_b (cost, text, traits, keywords); top-level "
            "cost_upgraded/text_upgraded are null by design. Upgrades without their own cost line inherit the base cost. "
            "cost 'unplayable' = Unplayable card. type is null: the game has no native card types. "
            "keywords are extracted from the plain text (glossary terms incl. generic verbs Attack/Move/Draw/...). "
            "Wiki upgrade-delta markers like '(+1)' are stripped; '(Does not Exhaust when played.)' notes are kept. "
            "owner = wiki category ('Basic' cards count as CAT cards in game logic). "
            "extra.draftable = appears in a crew member's normal Common/Uncommon/Rare reward pool; generated cards "
            "(Chip Shot, Pebble, Load State, Crystal Shard, ...) are owned by the crew member but not draftable. "
            "Enemy-only/unobtainable cards are KEPT and marked extra.player_obtainable=false "
            "(Missile Swarm: Finale-only; Jupiter Eclipse: removed in 1.0.6). Trash/Corrupted cards are obtainable "
            "(enemies, boss artifacts, difficulty, events add them to your deck). The game's enemies have no decks, "
            "so there are no other enemy cards. Base game has no Oxidation/Lock-On keywords (Cockpit Lock-On is an artifact)."
        ),
        "completeness": {
            "card_pages": len(cards),
            "template_card_users": len(embedded),
            "per_owner_rarity": {o: dict(sorted(v.items(), key=lambda kv: RARITY_ORDER.index(kv[0]) if kv[0] in RARITY_ORDER else 9)) for o, v in sorted(by_owner.items())},
            "per_crew_vs_wiki_navbox": per_crew,
            "discrepancies": disc,
            "parse_problems": problems,
        },
        "keyword_glossary": glossary,
        "cards": cards,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    # ------------------------------------------------ summary
    print(f"wrote {args.out} ({len(cards)} cards, {len(glossary)} glossary terms)")
    print(f"{'owner':<12}{'Common':>8}{'Uncommon':>9}{'Rare':>6}{'total':>7}")
    for o, v in sorted(by_owner.items(), key=lambda kv: (SOURCE_GROUP.get(kv[0], 'z'), kv[0])):
        print(f"{o:<12}{v['Common']:>8}{v['Uncommon']:>9}{v['Rare']:>6}{sum(v.values()):>7}")
    for line in disc + problems:
        print("  !", line)


if __name__ == "__main__":
    main()
