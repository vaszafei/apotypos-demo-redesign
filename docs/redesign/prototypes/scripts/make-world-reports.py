"""Read the data of three live pages of apotypos.org one time and write their fixtures (#36, #37, #38).

Usage: python3 -I make-world-reports.py <cache-dir> <out-dir>

- /narrative (Ο πόλεμος της αφήγησης) ships its data in the Nuxt payload: narrative-data and intent-pilot-v1. Writes data/narrative.js.
- /coverage (Μία είδηση, πολλές εκδοχές) ships story-data-guilfoyle in the Nuxt payload. Writes data/storyCoverage.js.
- /france-riots (Γαλλία: ταραχές) frames six standalone reports. The script copies them to reports/france-riots/.

The Nuxt payload is a flat devalue array: each value points to other values by index. The script keeps each download
in <cache-dir>. A second run reads the cache and makes no request.
"""

import json
import re
import sys
import urllib.request
from pathlib import Path

BASE = "https://apotypos.org"
FRANCE_REPORTS = ["compare", "press", "facebook", "israel", "narrative", "claim"]
# The live page keeps the first 6 archive finds of a statement in view. The prototype keeps 12 of each statement.
MATCHES = 12
EXCERPT = 320


def fetch(cache, path):
    file = cache / (path.strip("/").replace("/", "__") or "home")
    if not file.exists():
        req = urllib.request.Request(f"{BASE}{path}", headers={"User-Agent": "apotypos-prototype-fixtures"})
        with urllib.request.urlopen(req, timeout=120) as res:
            file.write_bytes(res.read())
    return file.read_text(encoding="utf-8")


def payload(html):
    """The data block of the Nuxt payload, rebuilt from the devalue array."""
    raw = re.search(r'<script[^>]*id="__NUXT_DATA__"[^>]*>(.*?)</script>', html, re.S).group(1)
    arr = json.loads(raw)
    memo = {}
    wrappers = {"Reactive", "ShallowReactive", "Ref", "ShallowRef", "EmptyRef", "EmptyShallowRef", "NuxtError"}

    def walk(i):
        if not isinstance(i, int) or i < 0:
            return None
        if i in memo:
            return memo[i]
        v = arr[i]
        if isinstance(v, list):
            if v and isinstance(v[0], str) and v[0] in wrappers | {"Date", "Set", "Map", "null"}:
                tag = v[0]
                if tag == "Date":
                    out = v[1]
                elif tag == "Set":
                    out = [walk(x) for x in v[1:]]
                elif tag == "Map":
                    out = {str(walk(v[k])): walk(v[k + 1]) for k in range(1, len(v), 2)}
                elif tag == "null" or len(v) < 2:
                    out = None
                else:
                    out = walk(v[1])
                memo[i] = out
                return out
            out = []
            memo[i] = out
            out.extend(walk(x) for x in v)
            return out
        if isinstance(v, dict):
            out = {}
            memo[i] = out
            for k, x in v.items():
                out[k] = walk(x)
            return out
        memo[i] = v
        return v

    return walk(0)["data"]


def clip(text, n=EXCERPT):
    text = (text or "").strip()
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"


def narrative(cache):
    data = payload(fetch(cache, "/narrative"))
    n = data["narrative-data"]
    pilot = data["intent-pilot-v1"]
    statements = []
    for s in pilot["statements"]:
        cells = {}
        for outlet in pilot["outlets"]:
            week = [m for m in s["matches"] if m["outlet"] == outlet and m["in_week"]]
            later = [m for m in s["matches"] if m["outlet"] == outlet and not m["in_week"]]
            cells[outlet] = {"n": len(week), "ok": sum(m["status"] == "reviewed" for m in week), "later": len(later),
                             "articles": s["coverage"].get(outlet, {}).get("articles", 0)}
        days = sorted({d for c in s["coverage"].values() for d in c.get("days", [])})
        # Reviewed finds first, then the finds of the first week, in date order.
        matches = sorted(s["matches"], key=lambda m: (m["status"] != "reviewed", not m["in_week"], m["date"]))
        statements.append({
            "id": s["id"], "date": s["date"], "end": s["window_end"], "kind": s["kind"], "speaker": s["speaker_el"], "speakerEn": s["speaker"],
            "role": s["role"], "title": s["title"], "greek": s["greek"], "english": s["english"], "context": s["context"],
            "verification": s["verification"], "source": s["source"], "locator": s["locator"], "original": s["original"],
            "days": len(days), "cells": cells, "nMatches": len(s["matches"]), "nReviewed": sum(m["status"] == "reviewed" for m in s["matches"]),
            "matches": [{"outlet": m["outlet"], "date": m["date"], "title": re.sub(r"\s*-\s*iefimerida\.gr$", "", m["title"]), "url": m["url"],
                         "excerpt": clip(m["excerpt"]), "reviewed": m["status"] == "reviewed", "week": m["in_week"], "field": m["field"]}
                        for m in matches[:MATCHES]]
        })
    moments = [{k: m[k] for k in ("id", "start", "end", "label", "n", "genocide", "genocide_pct", "genocide_any_pct", "own_example")} |
                {"outlets": {o: {"n": x.get("n", 0), "own": x.get("gen_own", 0)} for o, x in m["outlets"].items()}} for m in n["moments"]]
    out = {
        "generated": n["generated"], "reviewed": pilot["reviewed_on"], "searched": pilot["articles_searched"], "outlets": pilot["outlets"],
        "sitemapOutlets": n["sitemap_outlets"], "moments": moments, "snapshot": n["snapshot"], "cases": n["cases"], "research": n["research"],
        "statements": statements
    }
    return out


def story(cache):
    d = payload(fetch(cache, "/coverage"))["story-data-guilfoyle"]
    articles = [{"outlet": a["outlet"], "t": a["t"], "title": a["title"], "url": a["url"], "about": a["about"], "angle": a["angle"], "depth": a["depth"],
                 "facts": [k for k, v in a["facts"].items() if v], "ev": clip(next(iter((a.get("ev") or {}).values()), ""), 360)} for a in d["articles"]]
    articles.sort(key=lambda a: a["t"])
    return {
        "generated": d["generated"], "story": d["story"], "window": d["window"], "facts": d["facts"], "angles": d["angles"],
        "outlets": [{k: o[k] for k in ("outlet", "published", "n", "n_about", "facts", "aktor_any", "angles", "first", "other_guilfoyle", "owner_link")} for o in d["outlets"]],
        "articles": articles, "daily": d["daily"], "ownerSources": d["owner_sources"], "prior": d["prior"], "nonPaper": d["non_paper"]
    }


def write_fixture(out, key, body):
    text = json.dumps(body, ensure_ascii=False, separators=(",", ":"))
    (out / "data" / f"{key}.js").write_text(f"window.FIXTURES=window.FIXTURES||{{}};window.FIXTURES[\"{key}\"]={text};\n", encoding="utf-8")


def main():
    cache, out = Path(sys.argv[1]), Path(sys.argv[2])
    cache.mkdir(parents=True, exist_ok=True)
    write_fixture(out, "narrative", narrative(cache))
    write_fixture(out, "storyCoverage", story(cache))
    reports = out / "reports" / "france-riots"
    reports.mkdir(parents=True, exist_ok=True)
    for name in FRANCE_REPORTS:
        html = fetch(cache, f"/france-riots/{name}.html")
        # The links between the reports point to the tabs of the live shell. In the prototype they point to the tabs of france-v2.html.
        html = html.replace('href="/france-riots?tab=', 'target="_top" href="../../france-v2.html?tab=')
        (reports / f"{name}.html").write_text(html, encoding="utf-8")
    print("narrative.js, storyCoverage.js and", len(FRANCE_REPORTS), "reports written")


if __name__ == "__main__":
    main()
