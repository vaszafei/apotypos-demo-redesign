"""Make the data of the table of all pages from the route map and the KPI proposal.

Usage: python3 -I make-pages-table.py <knowledge-base-dir> <out-file>
The script stops if the counts differ from page-types.md: 58 routes, 40 with a type, 18 removed.
"""

import json
import re
import sys
from pathlib import Path

KPI_PAGES = {
    "Home": "/", "Media": "/media", "Media, group": "/groups/skai", "Media, outlet": "/media/outlet/17661f5754", "Media, issue": "/media/issue/10",
    "Media, person": "/media/person/1209a24515", "Media, story": "/media/story/1", "War": "/war", "Gaza": "/gaza",
    "Israel": "/israel", "Elections": "/elections", "Groups": "/groups", "Ownership": "/groups", "Stories": "/stories", "Echoes": "/echoes",
    "Originality": "/originality", "Markets": "/markets", "Overton": "/overton", "Cases": "/cases", "Speeches": "/speeches",
}
PROTOTYPES = {
    "/": "index.html", "/gaza": "gaza.html", "/groups": "groups-v2.html", "/groups/skai": "group.html?g=skai", "/media": "media-v2.html", "/trends": "topics-v2.html", "/stories": "stories-v2.html", "/echoes": "stories-v2.html", "/stories/8feb49e8-73f0-4801-b61a-2887113257cc": "story-v2.html?id=4502", "/media/story/1": "story-v2.html?id=4502", "/similarity": "similarity-v2.html", "/originality": "similarity-v2.html#originality", "/campaigns": "campaigns-v2.html",
    "/media/outlet/17661f5754": "outlet.html", "/fingerprints": "fingerprints-v2.html", "/methodology": "methodology.html",
}
TYPE_PROTOTYPE = {
    "Dashboard": "index.html", "Ranked list": "groups.html", "Detail": "outlet.html", "Matrix": "fingerprints.html",
    "Explorer": "media.html", "Text": "methodology.html", "Removed": "404.html",
}


def table_rows(text, heading):
    part = text.split(heading, 1)[1]
    lines = [line for line in part.splitlines() if line.startswith("|")]
    return [[cell.strip() for cell in line.strip("|").split("|")] for line in lines[2:]]


def strip_code(value):
    return value.replace("`", "")


def main():
    kb, out = Path(sys.argv[1]), Path(sys.argv[2])
    routes = table_rows((kb / "redesign" / "page-types.md").read_text(), "# Route map")
    routes = [r for r in routes if r and r[0].startswith("`")]
    proposal = (kb / "redesign" / "kpi-proposal.md").read_text()
    kpis = {}
    for line in proposal.splitlines():
        m = re.match(r"\| (K\d\d) \|", line)
        if not m:
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if cells[-1].startswith("reject"):
            continue
        route = KPI_PAGES[cells[1]]
        kpis.setdefault(route, []).append({"id": cells[0], "name": cells[2], "path": strip_code(cells[5])})

    rows = []
    for route, page_type, section, status, note in routes:
        route = strip_code(route)
        rows.append({
            "route": route,
            "type": page_type,
            "section": section,
            "status": status,
            "note": note,
            "kpis": kpis.get(route, []),
            "prototype": PROTOTYPES.get(route),
            "typePrototype": TYPE_PROTOTYPE[page_type],
        })

    typed = sum(r["type"] != "Removed" for r in rows)
    removed = len(rows) - typed
    missing = set(kpis) - {r["route"] for r in rows}
    assert (len(rows), typed, removed) == (58, 40, 18), (len(rows), typed, removed)
    assert not missing, missing
    data = {"rows": rows, "counts": {"routes": len(rows), "typed": typed, "removed": removed}}
    out.write_text("window.FIXTURES=window.FIXTURES||{};window.FIXTURES.pages=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"routes={len(rows)} typed={typed} removed={removed} kpis={sum(len(v) for v in kpis.values())}")


if __name__ == "__main__":
    main()
