"""Read the network of whoownsthemedia.gr one time and write data/ownerRecord.js: the business of each owner of the record.

Usage: python3 -I make-owner-record.py <cache-dir> <out-dir>

The record (Solomon, «Σε ποιον ανήκουν τα ελληνικά Μέσα») has one tree for each owner: the companies they control, each with a sector.
A company can sit in more than one place of a tree, so the script counts each name one time.
"""

import html
import json
import re
import sys
import urllib.request
from collections import Counter
from datetime import date
from pathlib import Path

URL = "https://whoownsthemedia.gr/network.json"
# The name of each tree of the record, and the group of the same owner in the data of Απότυπος (data/groups.js, data/ownership.json).
GROUP_OF = {
    "ΣΥΜΦΕΡΟΝΤΩΝ ΜΑΡΙΝΑΚΗ": "Alter Ego Media",
    "ΣΥΜΦΕΡΟΝΤΩΝ ΓΙΑΝΝΑΚΟΠΟΥΛΟΥ": "DPG Digital Media",
    "ΣΥΜΦΕΡΟΝΤΩΝ ΜΠΑΚΟΥ-ΚΑΫΜΕΝΑΚΗ": "Συμφέροντα Μπάκου-Καϋμενάκη",
    "ΣΥΜΦΕΡΟΝΤΩΝ ΜΕΛΙΣΣΑΝΙΔΗ": "Συμφέροντα Μελισσανίδη",
    "ΣΥΜΦΕΡΟΝΤΩΝ ΑΛΑΦΟΥΖΟΥ": "Όμιλος ΣΚΑΪ",
    "ΣΥΜΦΕΡΟΝΤΩΝ ΣΑΒΒΙΔΗ": "Συμφέροντα Σαββίδη",
    "ΣΥΜΦΕΡΟΝΤΩΝ ΒΑΡΔΙΝΟΓΙΑΝΝΗ": "Όμιλος Βαρδινογιάννη",
    "ΣΥΜΦΕΡΟΝΤΩΝ ΚΥΡΙΑΚΟΥ": "Antenna Group",
    "ΣΥΜΦΕΡΟΝΤΩΝ ΡΕΣΤΗ": "Συμφέροντα Ρέστη",
}
# The sectors of the record, in the order of the columns. The small ones are one column, «Άλλοι».
SECTORS = ["ΜΜΕ", "Ναυτιλία", "Ενέργεια", "Χρηματοοικονομικά", "Real Estate", "Κατασκευές", "Βιομηχανία", "Αθλητισμός"]
OTHER = "Άλλοι"


def read(cache):
    path = cache / "network.json"
    if not path.exists():
        req = urllib.request.Request(URL, headers={"User-Agent": "apotypos-prototype"})
        path.write_bytes(urllib.request.urlopen(req, timeout=60).read())
    return json.loads(path.read_text())


def owners_of(description):
    """The owners are the bold names at the top of the description of a tree."""
    names = [html.unescape(re.sub(r"<[^>]+>", "", m)).strip() for m in re.findall(r"<strong>(.*?)</strong>", description or "")]
    return [n for n in names if n and len(n) < 40]


def tree(node):
    companies = {}
    media = []

    def walk(n):
        if n.get("type") in ("mothercompany", "subcompany"):
            name = n["name"].strip()
            companies.setdefault(name, n.get("sector"))
            if n.get("type") == "subcompany" and n.get("sector") == "ΜΜΕ" and name not in media:
                media.append(name)
        for c in n.get("children") or []:
            walk(c)

    walk(node)
    sectors = Counter(s if s in SECTORS else OTHER for s in companies.values())
    return {
        "record": node["name"],
        "group": GROUP_OF[node["name"]],
        "owners": owners_of(node.get("description")),
        "companies": len(companies),
        "sectors": [sectors.get(s, 0) for s in SECTORS + [OTHER]],
        "brands": media,
    }


def main():
    cache, out = Path(sys.argv[1]), Path(sys.argv[2])
    cache.mkdir(parents=True, exist_ok=True)
    root = read(cache)
    rows = sorted((tree(n) for n in root["children"]), key=lambda r: -r["companies"])
    body = {"source": "whoownsthemedia.gr", "url": URL, "readAt": date.today().isoformat(), "sectors": SECTORS + [OTHER], "owners": rows}
    text = json.dumps(body, ensure_ascii=False, separators=(",", ":"))
    (out / "ownerRecord.js").write_text(f'window.FIXTURES=window.FIXTURES||{{}};window.FIXTURES["ownerRecord"]={text};\n')


if __name__ == "__main__":
    main()
