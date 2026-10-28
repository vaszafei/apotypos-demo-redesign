"""Read the public data of apotypos.org one time and write the small fixtures of the prototypes.

Usage: python3 -I make-fixtures.py <cache-dir> <out-dir>

The script keeps each download in <cache-dir>. A second run reads the cache and makes no request.
Each fixture is a JavaScript file that sets one key of window.FIXTURES, so the pages also open from file://.
"""

import html
import json
import re
import sys
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

BASE = "https://apotypos.org"
FILES = {
    "topics_facts": "/topics-data/aug_sep_2026/facts.json",
    "topics_volume": "/topics-data/aug_sep_2026/volume.json",
    "media_facts": "/media-data/aug_sep_2026/facts.json",
    "media_outlet": "/media-data/aug_sep_2026/outlets/17661f5754.json",
    "gaza_index": "/gaza-data/aug_sep_2026/index.json",
    "fingerprints": "/api/analytics/fingerprints?days=30&top=10",
    "groups": "/api/groups?days=30",
    "owner_bias": "/api/analytics/owner-interest-bias",
    "stance_ratings": "/api/analytics/stance-ratings?days=30&top=15",
    "originality": "/api/analytics/originality",
    "campaigns": "/api/campaigns/detect",
    "page_methodology": "/methodology",
}
OUTLET_SLUG = "17661f5754"
# The topics that the coding uses for the articles that fit no other topic. The movers of the Topics page leave them out (APO-168).
CATCH_ALL = {"Άλλα"}
# The current page writes the methodology headings in capitals, which have no accents in Greek.
SENTENCE_CASE = {
    "ΠΕΡΙΟΔΟΣ & ΠΗΓΕΣ": "Περίοδος & πηγές",
    "ΣΥΛΛΟΓΗ (CRAWLING)": "Συλλογή (crawling)",
    "ΕΞΑΓΩΓΗ ΚΕΙΜΕΝΟΥ": "Εξαγωγή κειμένου",
    "ΔΥΟ ΕΠΙΠΕΔΑ: ΜΕΤΡΗΣΗ & ΚΩΔΙΚΟΠΟΙΗΣΗ": "Δύο επίπεδα: μέτρηση & κωδικοποίηση",
    "ΘΕΜΑΤΑ, ΜΜΕ & ΕΚΛΟΓΕΣ": "Θέματα, ΜΜΕ & εκλογές",
    "ΕΛΕΓΧΟΣ ΤΩΝ ΕΤΙΚΕΤΩΝ AI": "Έλεγχος των ετικετών AI",
    "ΘΕΜΑΤΙΚΑ ΠΑΡΑΤΗΡΗΤΗΡΙΑ": "Θεματικά παρατηρητήρια",
    "ΟΜΙΛΙΕΣ & ΦΑΚΕΛΟΣ ΠΡΟΣΩΠΟΥ": "Ομιλίες & φάκελος προσώπου",
    "ΙΔΙΟΚΤΗΣΙΑ": "Ιδιοκτησία",
    "ΑΡΧΕΙΟ ΑΝΑΦΟΡΑΣ": "Αρχείο αναφοράς",
    "ΟΡΙΑ & ΕΠΙΚΥΡΩΣΗ": "Όρια & επικύρωση",
}


def fetch(cache, name, path):
    body = cache / name
    meta = cache / f"{name}.meta.json"
    if not (body.exists() and meta.exists()):
        req = urllib.request.Request(BASE + path, headers={"User-Agent": "apotypos-prototype-fixtures"})
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
            if not name.startswith("page_"):
                json.loads(data)  # Stop on a body that is not JSON. The cache keeps only valid bodies.
            info = {
                "url": BASE + path,
                "status": r.status,
                "read_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "last_modified": r.headers.get("Last-Modified"),
                "bytes": len(data),
            }
        # Write the meta file first and move the body into place last, so a stopped run leaves no body without meta.
        tmp = cache / f"{name}.part"
        tmp.write_bytes(data)
        meta.write_text(json.dumps(info))
        tmp.replace(body)
    return body, json.loads(meta.read_text())


def issue_row(i):
    return {"el": i["el"], "en": i["en"], "soft": i["soft"], "catchAll": i["el"] in CATCH_ALL}


def iso_date(http_date):
    return parsedate_to_datetime(http_date).date().isoformat() if http_date else None


def write(out, key, data):
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    (out / f"{key}.js").write_text(f"window.FIXTURES=window.FIXTURES||{{}};window.FIXTURES[{json.dumps(key)}]={text};\n", encoding="utf-8")
    return len(text.encode())


def home(raw, meta):
    facts = json.loads(raw["topics_facts"].read_text())
    volume = json.loads(raw["topics_volume"].read_text())
    assert facts["dates"] == volume["dates"]
    n_dates, n_issues = len(facts["dates"]), len(facts["issues"])
    daily = [[0] * n_dates for _ in range(n_issues)]
    for row in facts["a"]:
        daily[row[2]][row[1]] += 1
    return {
        "window": facts["window"],
        "updatedAt": iso_date(meta["topics_volume"]["last_modified"]),
        "dates": facts["dates"],
        "outlets": [{"name": o["name"], "daily": o["daily"]} for o in volume["outlets"]],
        "issues": [issue_row(i) for i in facts["issues"]],
        "issueDaily": daily,
    }


# Outlets that volume.json has with no group, but that whoownsthemedia.gr (network.json, read 2026-10-28) places in a group:
# ethnos.gr and ΕΘΝΟΣ under ΣΥΜΦΕΡΟΝΤΩΝ ΣΑΒΒΙΔΗ, CNN.GR under ΣΥΜΦΕΡΟΝΤΩΝ ΓΙΑΝΝΑΚΟΠΟΥΛΟΥ.
RECORD_FIXES = {
    "Ethnos": ("Συμφέροντα Σαββίδη", "Ιβάν Σαββίδης"),
    "CNN Greece": ("DPG Digital Media", "Δημήτρης Γιαννακόπουλος"),
}


def group_of(volume):
    """The group and the owner of each outlet, from volume.json and RECORD_FIXES. The name is the key."""
    owners = {o["name"]: (o["group"], o["owner"]) for o in volume["outlets"]}
    owners.update({k: v for k, v in RECORD_FIXES.items() if k in owners and not owners[k][0]})
    return owners


def media(raw, meta):
    # APO-161: the page reads the topics file, so K05 and K06 count the same 36 outlets.
    facts = json.loads(raw["topics_facts"].read_text())
    volume = json.loads(raw["topics_volume"].read_text())
    owners = group_of(volume)
    n_dates = len(facts["dates"])
    soft = {i for i, x in enumerate(facts["issues"]) if x["soft"]}
    # For each outlet and day: analysed rows, news rows, rows with a clickbait label, clickbait rows.
    outlet_daily = [[[0, 0, 0, 0] for _ in range(n_dates)] for _ in facts["outlets"]]
    issue_daily = [[0] * n_dates for _ in facts["issues"]]
    story_rows = Counter()
    for o, d, issue, story, _frame, _stance, clickbait, _section in facts["a"]:
        cell = outlet_daily[o][d]
        cell[0] += 1
        cell[1] += issue not in soft
        cell[2] += clickbait >= 0
        cell[3] += clickbait == 1
        issue_daily[issue][d] += 1
        if story >= 0:
            story_rows[story] += 1
    top = [s for s, _ in story_rows.most_common(40)]
    story_daily = {s: [0] * n_dates for s in top}
    for row in facts["a"]:
        if row[3] in story_daily:
            story_daily[row[3]][row[1]] += 1
    # K07 counts the stories with 3 or more rows in the range, so the fixture keeps the daily rows
    # of every story with 3 or more rows in the window, as flat pairs [day, rows, day, rows, ...].
    story_days = {}
    for row in facts["a"]:
        if story_rows[row[3]] >= 3:
            days = story_days.setdefault(row[3], Counter())
            days[row[1]] += 1
    by_id = {s["id"]: s for s in facts["stories"]}
    return {
        "window": facts["window"],
        "updatedAt": iso_date(meta["topics_facts"]["last_modified"]),
        "dates": facts["dates"],
        "outlets": [{"name": o["name"], "slug": o["slug"], "group": owners[o["name"]][0], "owner": owners[o["name"]][1]} for o in facts["outlets"]],
        "outletDaily": outlet_daily,
        "issues": [issue_row(i) for i in facts["issues"]],
        "issueDaily": issue_daily,
        "storyDays": [[x for d, n in sorted(days.items()) for x in (d, n)] for days in story_days.values()],
        "stories": [{"el": by_id[s]["el"], "en": by_id[s]["en"], "issue": by_id[s]["issue"], "daily": story_daily[s]} for s in top],
        "people": [{"name": p["name"], "role": p["role"], "party": p["party"]} for p in facts["people"]],
    }


def stories(raw, meta):
    # APO-180: every story with 3 or more rows in the window. days are flat pairs [day, rows, ...]. issue is an index of issues. en is missing when it equals el.
    facts = json.loads(raw["topics_facts"].read_text())
    story_rows = Counter(row[3] for row in facts["a"] if row[3] >= 0)
    days, outlets = {}, {}
    for outlet, day, _issue, story, *_rest in facts["a"]:
        if story_rows[story] >= 3:
            days.setdefault(story, Counter())[day] += 1
            outlets.setdefault(story, set()).add(outlet)
    by_id = {s["id"]: s for s in facts["stories"]}
    issue_index = {i["el"]: k for k, i in enumerate(facts["issues"])}
    return {
        "window": facts["window"],
        "updatedAt": iso_date(meta["topics_facts"]["last_modified"]),
        "dates": facts["dates"],
        "issues": [issue_row(i) for i in facts["issues"]],
        "stories": [
            {"id": s, "el": by_id[s]["el"], **({"en": by_id[s]["en"]} if by_id[s]["en"] != by_id[s]["el"] else {}), "issue": issue_index[by_id[s]["issue"]], "outlets": len(outlets[s]), "generic": by_id[s]["generic"],
             "days": [x for d, n in sorted(days[s].items()) for x in (d, n)]}
            for s in days
        ],
    }


def story_detail(raw, meta):
    # The Story page. For each story of the Stories tab (3 rows or more, not generic) the fixture keeps:
    # t = flat triples [outlet, day, rows, ...]; f, s, c = rows for each frame, stance and section; k = [rows with a clickbait label, clickbait rows];
    # p = flat groups [person, negative, neutral, positive, ...] from the table m. `base` has the same counts for all rows.
    facts = json.loads(raw["topics_facts"].read_text())
    volume = json.loads(raw["topics_volume"].read_text())
    owners = group_of(volume)
    n_f, n_s, n_c = len(facts["frames"]), len(facts["stances"]), len(facts["sections"])
    story_rows = Counter(row[3] for row in facts["a"] if row[3] >= 0)
    generic = {s["id"] for s in facts["stories"] if s["generic"]}
    keep = {s for s, n in story_rows.items() if n >= 3 and s not in generic}
    cells, stat = {}, {}
    base = {"f": [0] * n_f, "s": [0] * n_s, "c": [0] * n_c, "k": [0, 0]}
    for outlet, day, _issue, story, frame, stance, clickbait, section in facts["a"]:
        base["f"][frame] += 1
        base["s"][stance] += 1
        base["c"][section] += 1
        base["k"][0] += clickbait >= 0
        base["k"][1] += clickbait == 1
        if story not in keep:
            continue
        cells.setdefault(story, Counter())[(outlet, day)] += 1
        rec = stat.setdefault(story, {"f": [0] * n_f, "s": [0] * n_s, "c": [0] * n_c, "k": [0, 0], "p": {}})
        rec["f"][frame] += 1
        rec["s"][stance] += 1
        rec["c"][section] += 1
        rec["k"][0] += clickbait >= 0
        rec["k"][1] += clickbait == 1
    for row, person, portrayal in facts["m"]:
        story = facts["a"][row][3]
        if story in keep:
            stat[story]["p"].setdefault(person, [0, 0, 0])[portrayal] += 1
    return {
        "window": facts["window"],
        "updatedAt": iso_date(meta["topics_facts"]["last_modified"]),
        "dates": facts["dates"],
        "outlets": [{"name": o["name"], "slug": o["slug"], "group": owners[o["name"]][0], "total": o["total"]} for o in facts["outlets"]],
        "frames": facts["frames"],
        "stances": facts["stances"],
        "sections": facts["sections"],
        "portrayals": facts["portrayals"],
        "people": [{"name": p["name"], "role": p["role"], "party": p["party"]} for p in facts["people"]],
        "base": base,
        "stories": [
            {"id": s, "t": [x for (o, d), n in sorted(cells[s].items(), key=lambda kv: (kv[0][1], kv[0][0])) for x in (o, d, n)],
             "f": stat[s]["f"], "s": stat[s]["s"], "c": stat[s]["c"], "k": stat[s]["k"],
             "p": [x for person, counts in sorted(stat[s]["p"].items()) for x in (person, *counts)]}
            for s in sorted(keep)
        ],
    }


def originality(raw, meta):
    """Πρωτοτυπία: one row for each outlet that the API scores. The window is the one of the API, not the window of the other pages."""
    rows = json.loads(raw["originality"].read_text())
    return {
        "readAt": meta["originality"]["read_at"][:10],
        "window": [rows[0]["window_start"], rows[0]["window_end"]],
        "outlets": [{"name": r["source_name"], "scored": r["scored"], "originals": r["originals"], "rewrites": r["rewrites"], "pct": r["originality_pct"],
                     "lagMin": r["median_lag_min"], "anonPct": r["anon_pct"]} for r in rows],
    }


def campaigns(raw, meta):
    """Καμπάνιες: the 4 detector lists of the API. A list can be empty. Only the political list has rows in this read."""
    d = json.loads(raw["campaigns"].read_text())
    political = [
        {"person": r["person"], "week": r["week"], "mentions": r["mentions"], "burst": r["burst_ratio"], "groups": r["groups"], "anonPct": r["anon_pct"],
         "attackPct": r["attack_pct"], "haloPct": r["halo_pct"], "netTone": r["net_tone"], "toneN": r["tone_n"], "score": r["score"], "kind": r["kind"],
         "first": {"source": r["first"]["source"], "at": r["first"]["at"]} if r["first"] else None,
         "samples": [{"title": x["title"], "source": x["source"]} for x in r["samples"]]}
        for r in d["political"]
    ]
    return {
        "readAt": meta["campaigns"]["read_at"][:10],
        "referenceDate": d["reference_date"],
        "window": [d["window"]["from"], d["window"]["to"]],
        "marketAnonPct": d["market_anon_pct"],
        "political": political,
        "other": {key: len(d[key]) for key in ("pushes", "sustained", "dissemination")},
    }


def outlet(raw, meta):
    facts = json.loads(raw["topics_facts"].read_text())
    volume = json.loads(raw["topics_volume"].read_text())
    idx = next(i for i, o in enumerate(facts["outlets"]) if o["slug"] == OUTLET_SLUG)
    name = facts["outlets"][idx]["name"]
    vol = next(o for o in volume["outlets"] if o["name"] == name)
    # Rows of the outlet: date, issue, stance, clickbait.
    rows = [[r[1], r[2], r[5], r[6]] for r in facts["a"] if r[0] == idx]
    headlines = json.loads(raw["media_outlet"].read_text())[:12]
    return {
        "name": name,
        "slug": OUTLET_SLUG,
        "index": idx,
        "group": vol["group"],
        "owner": vol["owner"],
        "collectedDaily": vol["daily"],
        "stances": facts["stances"],
        "rows": rows,
        "headlines": [{"title": h[1], "url": h[2]} for h in headlines],
    }


def gaza(raw, meta):
    g = json.loads(raw["gaza_index"].read_text())
    full = set(g["full_outlets"])
    keys = ["n", "any_isr_voice", "any_pal_voice", "first_isr", "first_pal"]
    return {
        "window": [g["window"]["from"], g["window"]["to"]],
        "generated": g["generated"],
        "nGaza": g["n_gaza"],
        "total": sum(d["total"] for d in g["daily"]),
        "fullOutlets": len(g["full_outlets"]),
        "daily": [{"date": d["date"], "gaza": d["gaza"], "per1k": d["per_1k"]} for d in g["daily"]],
        "peaks": [{"date": p["date"], "gaza": p["gaza"], "titles": [{"outlet": t["outlet"], "title": t["title"], "url": t["url"]} for t in p["titles"][:2]]} for p in g["peaks"]],
        "overall": {k: g["overall"][k] for k in keys},
        "outlets": sorted(({"name": n, **{k: v[k] for k in keys}} for n, v in g["outlets"].items() if n in full), key=lambda x: -x["n"]),
    }


GROUP_SLUGS = {"Politis Group": "politis"}


def ownership(raw, meta):
    """The record of the owners, one export of /groups. Politis Group is not in the API, so its political lean is not known."""
    api = json.loads(raw["groups"].read_text())
    volume = json.loads(raw["topics_volume"].read_text())
    record = {r["name"]: {"slug": r["slug"], "name": r["name"], "owner": r["owner"], "lean": r["political_lean"]} for r in api}
    for o in volume["outlets"]:
        if o["group"] and o["group"] not in record:
            record[o["group"]] = {"slug": GROUP_SLUGS[o["group"]], "name": o["group"], "owner": o["owner"], "lean": None}
    return {
        "exportedAt": meta["groups"]["read_at"][:10],
        "source": "whoownsthemedia.gr",
        "recordDate": None,
        "groups": sorted(record.values(), key=lambda g: g["slug"]),
    }


def groups(raw, meta):
    facts = json.loads(raw["topics_facts"].read_text())
    volume = json.loads(raw["topics_volume"].read_text())
    record = {g["name"]: g for g in ownership(raw, meta)["groups"]}
    owners = group_of(volume)
    n_issues = len(facts["issues"])
    soft = {i for i, x in enumerate(facts["issues"]) if x["soft"]}
    per = {}
    for idx, o in enumerate(facts["outlets"]):
        name = o["name"]
        per[idx] = {"name": name, "slug": o["slug"], "collected": 0, "analysed": 0, "news": 0, "stance": [0, 0, 0], "cbKnown": 0, "cbYes": 0, "topics": [0] * n_issues}
    for vo in volume["outlets"]:
        idx = next(i for i, o in enumerate(facts["outlets"]) if o["name"] == vo["name"])
        per[idx]["collected"] = sum(vo["daily"])
    for o, _d, issue, _story, _frame, stance, clickbait, _section in facts["a"]:
        p = per[o]
        p["analysed"] += 1
        p["news"] += issue not in soft
        p["topics"][issue] += 1
        if stance in (1, 2, 3):
            p["stance"][stance - 1] += 1
        p["cbKnown"] += clickbait >= 0
        p["cbYes"] += clickbait == 1
    by_group, ungrouped = {}, []
    for idx, p in per.items():
        group, _owner = owners[p["name"]]
        (by_group.setdefault(group, []) if group else ungrouped).append(p)
    rows = []
    for name, outlets in by_group.items():
        rec = record[name]
        rows.append({
            "slug": rec["slug"], "name": name, "owner": rec["owner"], "lean": rec["lean"],
            "collected": sum(p["collected"] for p in outlets),
            "analysed": sum(p["analysed"] for p in outlets),
            "topics": [sum(p["topics"][i] for p in outlets) for i in range(n_issues)],
            "outlets": [{k: v for k, v in p.items() if k != "topics"} for p in sorted(outlets, key=lambda x: -x["collected"])],
        })
    rows.sort(key=lambda g: -g["collected"])
    return {
        "window": facts["window"],
        "updatedAt": iso_date(meta["topics_volume"]["last_modified"]),
        "record": {"exportedAt": ownership(raw, meta)["exportedAt"], "source": "whoownsthemedia.gr"},
        "issues": [issue_row(i) for i in facts["issues"]],
        "totalCollected": sum(p["collected"] for p in per.values()),
        "totalAnalysed": sum(p["analysed"] for p in per.values()),
        "topicsAll": [sum(p["topics"][i] for p in per.values()) for i in range(n_issues)],
        "groups": rows,
        "ungrouped": [{k: v for k, v in p.items() if k != "topics"} for p in sorted(ungrouped, key=lambda x: -x["collected"])],
    }


def people_matrix(raw, meta):
    """Static view of Αποτυπώματα: 7 persons x 36 outlets. Attention is the share of the articles of the outlet that
    name the person, divided by the same share over all outlets (1 is the average). Stance is the net portrayal (positive minus negative) of the mentions, from 5 mentions."""
    facts = json.loads(raw["topics_facts"].read_text())
    n_o, n_p = len(facts["outlets"]), len(facts["people"])
    rows = [0] * n_o
    for r in facts["a"]:
        rows[r[0]] += 1
    mentions = [[[0, 0, 0] for _ in range(n_p)] for _ in range(n_o)]
    # A row of `m` is [row of `a`, person, portrayal]. The outlet is the first value of that row of `a`.
    for row, p, portrayal in facts["m"]:
        mentions[facts["a"][row][0]][p][portrayal] += 1
    total_rows = sum(rows)
    rate = [sum(sum(mentions[o][p]) for o in range(n_o)) / total_rows for p in range(n_p)]
    outlets = []
    for o in range(n_o):
        cells = []
        for p in range(n_p):
            n = sum(mentions[o][p])
            ratio = (n / rows[o]) / rate[p] if rows[o] else 0
            neg, neu, pos = mentions[o][p]
            cells.append({"ratio": round(ratio, 2), "n": n, "net": round((pos - neg) / n, 2) if n >= 5 else None})
        outlets.append({"name": facts["outlets"][o]["name"], "rows": rows[o], "cells": cells})
    return {"window": facts["window"], "persons": [p["name"] for p in facts["people"]], "outlets": outlets}


def stance_ratings(raw, meta):
    """The API stance of each outlet to the 15 persons. The API ignores `days` and answers with 365 days (D2)."""
    d = json.loads(raw["stance_ratings"].read_text())
    return {
        "days": d["days"],
        "referenceDate": d["reference_date"],
        "minN": d["min_n"],
        "persons": [{"name": p["entity"], "outlets": {x["source_name"]: [x["net"], x["n"]] for x in p["sources"]}} for p in d["persons"]],
    }


def interests(raw, meta):
    d = json.loads(raw["owner_bias"].read_text())
    return {
        "days": d["window_days"],
        "referenceDate": d["reference_date"],
        "clubs": d["clubs"],
        "market": d["market_share"],
        "groups": [{"name": g["name"], "owner": g["owner"], "owns": g["owns"], "cells": [{"club": c["club"], "index": c["index"], "share": c["share_pct"], "own": c["own"]} for c in g["cells"]]} for g in d["groups"]],
    }


def fingerprints(raw, meta):
    fp = json.loads(raw["fingerprints"].read_text())
    return {
        "days": fp["days"],
        "referenceDate": fp["reference_date"],
        "entities": fp["entities"],
        "sources": [{"name": s["source_name"], "total": s["total_articles"], "cells": [[c["z"], c["n"]] for c in s["cells"]]} for s in fp["sources"]],
    }


def methodology(raw, meta):
    text = raw["page_methodology"].read_text(encoding="utf-8")
    main = re.search(r"<main.*?</main>", text, re.S).group(0)
    main = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", main, flags=re.S)
    sections, current = [], None
    for tag, body in re.findall(r"<(h1|h2|h3|p|li)[^>]*>(.*?)</\1>", main, re.S):
        clean = html.unescape(re.sub(r"<[^>]+>", "", body)).strip()
        if not clean:
            continue
        if tag in ("h1", "h2", "h3"):
            current = {"heading": SENTENCE_CASE.get(clean, clean), "paragraphs": []}
            sections.append(current)
        elif current is not None:
            current["paragraphs"].append(clean)
    return {"sections": [s for s in sections if s["paragraphs"]]}


def main():
    cache, out = Path(sys.argv[1]), Path(sys.argv[2])
    cache.mkdir(parents=True, exist_ok=True)
    out.mkdir(parents=True, exist_ok=True)
    raw, meta = {}, {}
    for name, path in FILES.items():
        raw[name], meta[name] = fetch(cache, name, path)
    sizes = {}
    for key, fn in [("home", home), ("media", media), ("stories", stories), ("storyDetail", story_detail), ("originality", originality), ("campaigns", campaigns), ("outlet", outlet), ("gaza", gaza), ("groups", groups), ("fingerprints", fingerprints), ("peopleMatrix", people_matrix), ("stanceRatings", stance_ratings), ("interests", interests), ("methodology", methodology)]:
        sizes[key] = write(out, key, fn(raw, meta))
    (out / "ownership.json").write_text(json.dumps(ownership(raw, meta), indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    (out / "sources.json").write_text(json.dumps({"reads": list(meta.values()), "fixture_bytes": sizes}, indent=1, ensure_ascii=False) + "\n")
    for key, size in sizes.items():
        print(f"{size:>8} {key}.js")


if __name__ == "__main__":
    main()
