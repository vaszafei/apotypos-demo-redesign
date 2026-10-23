"""Read the public data of the sections Πολιτική and Κόσμος one time and write their fixtures.

Usage: python3 -I make-politics-world.py <cache-dir> <out-dir> [fixture ...]

It uses fetch() and write() of make-fixtures.py, so the cache and the fixture format are the same.
It writes only the fixtures of these two sections. The other fixtures stay as they are.
"""

import importlib.util
import json
import re
import sys
from collections import Counter
from pathlib import Path

spec = importlib.util.spec_from_file_location("make_fixtures", Path(__file__).with_name("make-fixtures.py"))
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

FILES = {
    "topics_facts": "/topics-data/aug_sep_2026/facts.json",
    "war_index": "/war-data/index.json",
    "israel_index": "/israel-data/aug_sep_2026/index.json",
    "gaza_index": "/gaza-data/aug_sep_2026/index.json",
    "language_index": "/language-data/index.json",
    "speeches_index": "/data/speeches/unga81/index.json",
    "statement_speakers": "/api/statements/speakers?limit=25",
    "cases_coverage": "/api/cases/coverage?q=%CE%A1%CE%BF%CF%85%CE%B2%CE%AF%CE%BA%CF%89%CE%BD%CE%B1%CF%82",
    "page_contradictions": "/contradictions",
    "page_elections": "/elections",
}
# The files each fixture reads. A run with fixture names after the two directories reads and writes only those.
NEEDS = {"elections": ["page_elections"]}
# The statement tracker lists one person under two names (C11). The short name joins the full name.
SPEAKER_ALIASES = {"Τραμπ": "Ντόναλντ Τραμπ", "Ζελένσκι": "Βολοντίμιρ Ζελένσκι", "Ερντογάν": "Ρετζέπ Ταγίπ Ερντογάν"}


def nuxt_payload(text):
    """The data of a page that the server renders. Nuxt writes it as one flat list with references by index."""
    flat = json.loads(re.search(r'id="__NUXT_DATA__"[^>]*>(.*?)</script>', text, re.S).group(1))
    wrappers = {"Reactive", "ShallowReactive", "Ref", "ShallowRef", "EmptyRef", "EmptyShallowRef", "Set", "Map", "Date", "NuxtError"}
    memo = {}

    def value(i):
        if not isinstance(i, int) or i < 0:
            return None
        if i in memo:
            return memo[i]
        v = flat[i]
        if isinstance(v, list) and v and isinstance(v[0], str) and v[0] in wrappers:
            out = value(v[1]) if len(v) > 1 else None
        elif isinstance(v, list):
            out = []
            memo[i] = out
            out.extend(value(x) for x in v)
        elif isinstance(v, dict):
            out = {}
            memo[i] = out
            out.update((k, value(x)) for k, x in v.items())
        else:
            out = v
        memo[i] = out
        return out

    return value(0)


# Two constants of the live /elections page (its script, not its API): the 2023 vote (June 2023) and the monthly poll averages of 2025.
VOTE_2023 = {"ΝΔ": 40.56, "ΣΥΡΙΖΑ": 17.83, "ΠΑΣΟΚ": 11.85, "ΚΚΕ": 7.69, "ΕΛ": 4.45, "ΠΛΕΥΣΗ": 3.17, "ΝΙΚΗ": 3.69, "ΜΕΡΑ25": 2.5}
POLLS_2025 = {
    "2025-01": {"ΝΔ": 30.3, "ΣΥΡΙΖΑ": 7.3, "ΠΑΣΟΚ": 16, "ΚΚΕ": 9, "ΕΛ": 9.1, "ΠΛΕΥΣΗ": 4.7, "ΜΕΡΑ25": 2.8, "ΝΙΚΗ": 3.5, "ΦΛ": 1.5, "ΝΕΑΡ": 4.2},
    "2025-02": {"ΝΔ": 28.1, "ΣΥΡΙΖΑ": 7.3, "ΠΑΣΟΚ": 15.1, "ΚΚΕ": 9.3, "ΕΛ": 10.4, "ΠΛΕΥΣΗ": 8.9, "ΜΕΡΑ25": 2.7, "ΝΙΚΗ": 3.5, "ΦΛ": 2, "ΝΕΑΡ": 5},
    "2025-03": {"ΝΔ": 26.9, "ΣΥΡΙΖΑ": 6.8, "ΠΑΣΟΚ": 14, "ΚΚΕ": 8.9, "ΕΛ": 10.5, "ΠΛΕΥΣΗ": 14.6, "ΜΕΡΑ25": 2.9, "ΝΙΚΗ": 3.4, "ΦΛ": 2.3, "ΝΕΑΡ": 4},
    "2025-04": {"ΝΔ": 28, "ΣΥΡΙΖΑ": 6.2, "ΠΑΣΟΚ": 13, "ΚΚΕ": 8.3, "ΕΛ": 10.3, "ΠΛΕΥΣΗ": 12.6, "ΜΕΡΑ25": 3.2, "ΝΙΚΗ": 3, "ΦΛ": 2.1, "ΝΕΑΡ": 3.6},
    "2025-05": {"ΝΔ": 30.2, "ΣΥΡΙΖΑ": 5.9, "ΠΑΣΟΚ": 13.6, "ΚΚΕ": 8.5, "ΕΛ": 9.4, "ΠΛΕΥΣΗ": 13.8, "ΜΕΡΑ25": 3.3, "ΝΙΚΗ": 3.2, "ΦΛ": 2.8, "ΝΕΑΡ": 3.5},
    "2025-06": {"ΝΔ": 30.1, "ΣΥΡΙΖΑ": 5.8, "ΠΑΣΟΚ": 13.7, "ΚΚΕ": 8.6, "ΕΛ": 10, "ΠΛΕΥΣΗ": 12.6, "ΜΕΡΑ25": 3.5, "ΝΙΚΗ": 3, "ΦΛ": 2.5, "ΝΕΑΡ": 3.2},
    "2025-07": {"ΝΔ": 28.7, "ΣΥΡΙΖΑ": 6.8, "ΠΑΣΟΚ": 13.5, "ΚΚΕ": 8.5, "ΕΛ": 10.8, "ΠΛΕΥΣΗ": 12.3, "ΜΕΡΑ25": 4.4, "ΝΙΚΗ": 2.5, "ΦΛ": 2, "ΝΕΑΡ": 3.8},
    "2025-08": {"ΝΔ": 26.5, "ΣΥΡΙΖΑ": 9.9, "ΠΑΣΟΚ": 14, "ΚΚΕ": 10.4, "ΕΛ": 10.5, "ΠΛΕΥΣΗ": 4.8},
    "2025-09": {"ΝΔ": 28.4, "ΣΥΡΙΖΑ": 6.4, "ΠΑΣΟΚ": 14.5, "ΚΚΕ": 9, "ΕΛ": 10.8, "ΠΛΕΥΣΗ": 9, "ΜΕΡΑ25": 4, "ΝΙΚΗ": 2.5, "ΦΛ": 2.8, "ΝΕΑΡ": 4.5},
    "2025-10": {"ΝΔ": 29.5, "ΣΥΡΙΖΑ": 6.7, "ΠΑΣΟΚ": 14.5, "ΚΚΕ": 9.2, "ΕΛ": 10.6, "ΠΛΕΥΣΗ": 9.5, "ΜΕΡΑ25": 3.1, "ΝΙΚΗ": 3, "ΦΛ": 2, "ΝΕΑΡ": 3.8},
    "2025-11": {"ΝΔ": 29.8, "ΣΥΡΙΖΑ": 6, "ΠΑΣΟΚ": 14.8, "ΚΚΕ": 9.4, "ΕΛ": 10.6, "ΠΛΕΥΣΗ": 7.1, "ΜΕΡΑ25": 3.1, "ΝΙΚΗ": 3.1, "ΦΛ": 1.8, "ΝΕΑΡ": 3.5},
    "2025-12": {"ΝΔ": 29.4, "ΣΥΡΙΖΑ": 7.1, "ΠΑΣΟΚ": 17.8, "ΚΚΕ": 9.2, "ΕΛ": 9.4, "ΠΛΕΥΣΗ": 5.8, "ΜΕΡΑ25": 2.8, "ΝΙΚΗ": 3.2, "ΦΛ": 2.3, "ΝΕΑΡ": 4.1},
}


def elections(raw, meta):
    """The snapshot of the live /elections page (Παρατηρητήριο Εκλογών). Its Nuxt payload holds the answers of 7 API calls.
    The API gives the same 365 days for each period and for parties and leaders, so one read is the whole page.
    A point is [week, mentions, net tone or null]. A cell is [articles, share of coverage in percent, tone or null, scored articles]."""
    d = nuxt_payload(raw["page_elections"].read_text())["data"]["election-dashboard"]
    tl, sc = d["timeline"], d["scorecard"]
    keys = [p["key"] for p in sc["parties"]]
    assert [s["key"] for s in tl["series"]] == keys
    by_key = lambda cells, *fields: [[c[f] for f in fields] for c in sorted(cells, key=lambda c: keys.index(c["key"]))]
    return {
        "reference": tl["reference_date"],
        "days": tl["window_days"],
        "parties": [{"key": p["key"], "name": p["name"], "gov": p["lean"] == "Κυβέρνηση"} for p in sc["parties"]],
        "weeks": sorted({pt["week"] for s in tl["series"] for pt in s["points"]}),
        "series": [{pt["week"]: [pt["mentions"], pt["tone"]] for pt in s["points"]} for s in tl["series"]],
        "outlets": [{"name": o["source"], "group": o["group_slug"], "owner": o["owner"], "lean": o["political_lean"], "cells": by_key(o["cells"], "articles", "sov_pct", "tone", "tone_n")} for o in sc["outlets"]],
        "themes": [{"label": x["label"], "total": x["total"], "cells": by_key(x["cells"], "n", "pct")} for x in d["issues"]["themes"]],
        "blindspots": {k: d["blindspots"][k] for k in ["min_size", "stories_total", "covered_both"]} | {
            side: [{"topic": x["topic"], "articles": x["articles"]} for x in d["blindspots"][side]] for side in ["nd_only", "other_only"]},
        "anonymity": [{"lean": b["lean"], "cells": by_key(b["cells"], "total", "anon_pct")} for b in d["anonymity"]["buckets"]],
        "journalists": [{"name": j["author"], "outlets": j["outlets"], "total": j["total"], "cells": by_key(j["cells"], "n", "tone", "tone_n")} for j in d["journalists"]["journalists"]],
        # The page asks for the period before the window too (Momentum). The API answers with the same window, so the page has no change to show.
        "previousSame": d["previous"] == sc,
        "vote2023": VOTE_2023,
        "polls": POLLS_2025,
    }


def war(raw, meta):
    d = json.loads(raw["war_index"].read_text())
    cols = d["k_cols"]
    keep = ["total", "gt", "hot", "own", "hl", "norm", "war", "calm", "e1", "e2", "e3", "inc", "hot_inc", "coll", "unsrc", "demon", "trciv"]
    pick = lambda k: {c: k[cols.index(c)] for c in keep}
    gt, hot = cols.index("gt"), cols.index("hot")
    examples = sorted((e for week in d["examples"].values() for e in week if e.get("esc") == 4), key=lambda e: e["date"], reverse=True)
    return {
        "window": [d["window"]["from"], d["window"]["to"]],
        "generated": d["generated"],
        "nTagged": d["n_tagged"],
        "nGt": d["n_gt"],
        "minGt": d["min_gt"],
        "window4": d["window4"],
        "daily": [{"date": s["week"], "total": s["total"], "gt": s["gt"], "attention": s["attention"], "hot": s["hot_share"], "own": s["outlet_voice"], "hl": s["headline_hotter"]} for s in d["series_daily"]],
        "weeks": [{"week": s["week"], **pick(s["k"]), "voices": s["voices"], "frames": s["frames"]} for s in d["series_full"]],
        "events": d["events"],
        "airspace": d["airspace"],
        # The outlet profile of the file covers only the last weeks. The weekly rows of each outlet cover the full window.
        "outlets": [{"name": name, "lean": d["lean"].get(name, ""), **pick([sum(col) for col in zip(*w.values())])} for name, w in d["outlet_weeks"].items()],
        "outletWeeks": {name: [[w[k][gt], w[k][hot]] if k in w else [0, 0] for k in d["weeks"]] for name, w in d["outlet_weeks"].items()},
        "examples": [{k: e[k] for k in ("outlet", "date", "title", "url", "voice", "phrase")} for e in examples[:12]],
    }


def israel(raw, meta):
    d = json.loads(raw["israel_index"].read_text())
    a = d["achilles"]
    return {
        "window": [d["window"]["from"], d["window"]["to"]],
        "generated": d["generated"],
        "n": d["n"],
        "labels": d["labels"],
        "overall": d["overall"]["2026"],
        "contexts": {k: v for k, v in d["by_context26"].items() if v["state"]["n"]},
        "monthly": d["monthly"],
        "outlets": d["outlets"]["2026"],
        "achilles": {k: a[k] for k in ("n", "signed", "events", "daily", "mention_gaza", "who", "issues", "outlets", "tone", "labels", "gaza_tone", "gaza_labels", "gaza_n", "before_after_gaza")},
        "examples": {k: v[:4] for k, v in d["examples"].items()},
    }


def gaza_coverage(raw, meta):
    g = json.loads(raw["gaza_index"].read_text())
    full = set(g["full_outlets"])
    return {
        "window": [g["window"]["from"], g["window"]["to"]],
        "generated": g["generated"],
        "nCandidates": g["n_candidates"],
        "nGaza": g["n_gaza"],
        "fullOutlets": len(full),
        "daily": [{"date": d["date"], "gaza": d["gaza"], "total": d["total"], "per1k": d["per_1k"]} for d in g["daily"]],
        "weekly": g["weekly"],
        "peaks": [{"date": p["date"], "gaza": p["gaza"], "titles": p["titles"][:2]} for p in g["peaks"]],
        "overall": g["overall"],
        "months": g["months"],
        "termsWeekly": g["terms_weekly"],
        "greece": {k: v for k, v in g["greece"].items() if k != "deal_examples"},
        "israel": g["israel"],
        "outlets": {n: v for n, v in g["outlets"].items() if n in full},
        "examples": {k: v[:5] for k, v in g["examples"].items()},
    }


def conflict_language(raw, meta):
    d = json.loads(raw["language_index"].read_text())
    keys = d["keys"]
    months = {}
    for cube in d["cube"].values():
        for week, values in cube.items():
            m = max(week, d["window"]["from"])[:7]
            months[m] = [a + b for a, b in zip(months.get(m, [0] * len(keys)), values)]
    return {
        "window": [d["window"]["from"], d["window"]["to"]],
        "generated": d["generated"],
        "nRel": d["n_rel"],
        "keys": keys,
        "total": [sum(v) for v in zip(*months.values())],
        "months": months,
        "outlets": [{"name": n, "lean": d["lean"].get(n, ""), "values": [sum(v) for v in zip(*d["cube"][n].values())]} for n in d["outlets"]],
        "evidence": {k: [{"outlet": e[0], "date": e[1], "title": e[2], "url": e[3]} for e in v[:4]] for k, v in d["evidence"].items()},
    }


def speeches(raw, meta):
    d = json.loads(raw["speeches_index"].read_text())
    rows = []
    for s in d["speakers"]:
        shares = sorted(s["shares"].items(), key=lambda kv: -kv[1])
        rows.append({
            "vid": s["vid"], "speaker": s["speaker"], "role": s["role"], "country": s["country"], "region": s["region"],
            "date": s["date"], "seconds": round(s["seconds"]), "words": s["words"],
            "shares": [[k, round(v, 3)] for k, v in shares[:6]], "counts": s["counts"],
            "targets": s["attack_targets"][:5], "greece": s["greece"],
        })
    # The agenda: the minutes of each topic over all speeches, the leaders with one minute or more, and the three leaders with the most time.
    agenda = {}
    for sp in d["speakers"]:
        for topic, share in sp["shares"].items():
            row = agenda.setdefault(topic, {"topic": topic, "minutes": 0, "leaders": 0, "top": []})
            minutes = share * sp["seconds"] / 60
            row["minutes"] += minutes
            row["leaders"] += minutes >= 1
            row["top"].append((minutes, sp["speaker"]))
    for row in agenda.values():
        row["minutes"] = round(row["minutes"], 1)
        row["top"] = [name for _, name in sorted(row["top"], reverse=True)[:3]]
    return {"batch": d["batch"], "topics": len(d["topics"]), "agenda": sorted(agenda.values(), key=lambda r: -r["minutes"])[:20], "rows": rows}


def statements(raw, meta):
    merged = {}
    for s in json.loads(raw["statement_speakers"].read_text()):
        name = SPEAKER_ALIASES.get(s["speaker"], s["speaker"])
        row = merged.setdefault(name, {"speaker": name, "names": [], "total": 0, "promises": 0, "predictions": 0})
        row["names"].append(s["speaker"])
        for k in ("total", "promises", "predictions"):
            row[k] += s[k]
    return {"limit": 25, "rows": sorted(merged.values(), key=lambda r: -r["total"])}


def person_file(raw, meta):
    data = nuxt_payload(raw["page_contradictions"].read_text(encoding="utf-8"))["data"]
    key = data["contradictions-people"][0]["key"]
    c, fc, views = data[f"contradictions-{key}"], data[f"factcheck-{key}"], data[f"views-{key}"]
    side = lambda x: {k: x[k] for k in ("date", "quote", "proposition", "video", "t")}
    return {
        "person": c["person"],
        "summary": data["contradictions-people"][0],
        "videos": len(c["videos"]),
        "videosSampled": c["videos_sampled"],
        "noCaptions": c["videos_no_captions"],
        "claimsByMonth": sorted(Counter(x["date"][:7] for x in c["claims"]).items()),
        "kinds": Counter(x["kind"] for x in c["claims"]).most_common(),
        "pairs": [{"type": p["type"], "confidence": p["confidence"], "topic": p["topic"], "conflict": p["conflict_el"], "earlier": side(p["earlier"]), "later": side(p["later"])} for p in c["pairs"]],
        "checks": {"pool": fc["pool"], "checkable": fc["checkable"], "checked": fc["checked"], "verdicts": fc["verdicts"]},
        "checked": [{k: i[k] for k in ("date", "video", "t", "quote", "assertion_el", "verdict", "check_kind", "deadline", "summary_el")} for i in fc["items"]],
        "themes": [{"el": t["el"], "n": t["n"], "from": t["from"], "to": t["to"], "kinds": t["kinds"], "summary": t["summary_el"], "quarters": t["quarters"]} for t in views["themes"]],
    }


def cases(raw, meta):
    return json.loads(raw["cases_coverage"].read_text())


def main():
    cache, out = Path(sys.argv[1]), Path(sys.argv[2])
    cache.mkdir(parents=True, exist_ok=True)
    only = sys.argv[3:]
    names = [n for k in only for n in NEEDS.get(k, FILES)] if only else list(FILES)
    raw, meta = {}, {}
    for name in names:
        raw[name], meta[name] = base.fetch(cache, name, FILES[name])
    for key, fn in [("elections", elections), ("war", war), ("israel", israel), ("gazaCoverage", gaza_coverage), ("conflictLanguage", conflict_language), ("speeches", speeches), ("statements", statements), ("personFile", person_file), ("cases", cases)]:
        if not only or key in only:
            print(f"{base.write(out, key, fn(raw, meta)):>8} {key}.js")
    sources = out / "sources-politics-world.json"
    reads = {r["url"]: r for r in (json.loads(sources.read_text())["reads"] if only and sources.exists() else [])}
    reads.update((m["url"], m) for m in meta.values())
    sources.write_text(json.dumps({"reads": list(reads.values())}, indent=1, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
