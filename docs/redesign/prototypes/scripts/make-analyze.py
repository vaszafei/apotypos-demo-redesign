"""Read the data of the live /analyze page of apotypos.org one time and write data/analyze.js.

Usage: python3 -I make-analyze.py <cache-dir> <out-dir>

The live page calls three endpoints with ?days= from its period chips. On 2026-10-22 the answer is the same for every
value of days: one window that ends on the reference date of /api/analytics/meta. So the fixture keeps one answer of each.
The script keeps each download in <cache-dir>. A second run reads the cache and makes no request.
"""

import json
import sys
import urllib.request
from collections import Counter
from datetime import date, timedelta
from pathlib import Path

BASE = "https://apotypos.org/api"
FILES = {
    "meta": "/analytics/meta",
    "sources": "/sources",
    "volume": "/analytics/volume-by-source?days=30",
    "groups": "/analytics/group-distribution?days=30",
    "categories": "/analytics/category-distribution?days=30",
}


def fetch(cache, name):
    path = cache / f"analyze-{name}.json"
    if not path.exists():
        req = urllib.request.Request(BASE + FILES[name], headers={"User-Agent": "apotypos-prototype-fixtures"})
        with urllib.request.urlopen(req, timeout=60) as r:
            path.write_bytes(r.read())
    return json.loads(path.read_text(encoding="utf-8"))


def main(cache, out):
    cache.mkdir(parents=True, exist_ok=True)
    meta, sources, volume, groups, categories = (fetch(cache, n) for n in FILES)
    end = date.fromisoformat(meta["reference_date"])
    start = end - timedelta(days=30)
    days = [(start + timedelta(days=i)).isoformat() for i in range((end - start).days + 1)]
    index = {d: i for i, d in enumerate(days)}
    # A row outside the window is a date error of the crawler (one row of 2026-12-06). It does not count.
    dropped = sum(r["total"] for r in volume if r["day"] not in index)
    per_source = {}
    for r in volume:
        if r["day"] in index:
            per_source.setdefault(r["source"], [0] * len(days))[index[r["day"]]] += r["total"]
    group_of = {s["name"]: s for s in sources}
    source_rows = sorted(({
        "name": name,
        "group": group_of.get(name, {}).get("group_name"),
        "lean": group_of.get(name, {}).get("political_lean"),
        "medium": group_of.get(name, {}).get("medium"),
        "daily": daily,
    } for name, daily in per_source.items()), key=lambda s: -sum(s["daily"]))
    leans = {s["group_name"]: s["political_lean"] for s in sources if s["group_name"]}
    outlets = Counter(s["group_name"] for s in sources if s["group_name"])
    fixture = {
        "window": [days[0], days[-1]],
        "fetchedAt": "2026-10-22",
        "dates": days,
        "sources": source_rows,
        "droppedRows": dropped,
        "groups": [{**g, "lean": leans.get(g["group"]), "outlets": outlets.get(g["group"], 0)} for g in groups],
        "groupsOnRecord": sorted(outlets),
        "categories": categories,
    }
    out.mkdir(parents=True, exist_ok=True)
    text = json.dumps(fixture, ensure_ascii=False, separators=(",", ":"))
    (out / "analyze.js").write_text(f'window.FIXTURES=window.FIXTURES||{{}};window.FIXTURES["analyze"]={text};\n', encoding="utf-8")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
