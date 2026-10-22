"""Read the public data of the sections Πολιτική and Κόσμος one time and write their fixtures.

Usage: python3 -I make-politics-world.py <cache-dir> <out-dir>

It uses fetch() and write() of make-fixtures.py, so the cache and the fixture format are the same.
It writes only the fixtures of these two sections. The other fixtures stay as they are.
"""

import importlib.util
import json
import re
import sys
from collections import Counter
from datetime import date, timedelta
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
}
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


def week_of(iso):
    d = date.fromisoformat(iso)
    return (d - timedelta(days=d.weekday())).isoformat()


def elections(raw, meta):
    """Stance to the government: each article of `a` has a stance (0 n/a, 1 critical, 2 neutral, 3 supportive).
    A row of `v` is [row of `a`, person, act, target]. A row of `m` is [row of `a`, person, portrayal]."""
    f = json.loads(raw["topics_facts"].read_text())
    n_o, n_i, n_p = len(f["outlets"]), len(f["issues"]), len(f["people"])
    weeks = sorted({week_of(d) for d in f["dates"]})
    day_week = [weeks.index(week_of(d)) for d in f["dates"]]
    stance = [[0, 0, 0] for _ in range(n_o)]
    stance_week = [[[0, 0, 0] for _ in weeks] for _ in range(n_o)]
    issue_stance = [[0, 0, 0] for _ in range(n_i)]
    analysed = [0] * n_o
    for o, day, issue, _story, _frame, s, _cb, _sec in f["a"]:
        analysed[o] += 1
        if s > 0:
            stance[o][s - 1] += 1
            stance_week[o][day_week[day]][s - 1] += 1
            issue_stance[issue][s - 1] += 1
    mention_week = [[0] * len(weeks) for _ in range(n_p)]
    portrayal = [[0, 0, 0] for _ in range(n_p)]
    for row, p, pr in f["m"]:
        mention_week[p][day_week[f["a"][row][1]]] += 1
        portrayal[p][pr] += 1
    acts = [[0] * len(f["acts"]) for _ in range(n_p)]
    attacks = [Counter() for _ in range(n_p)]
    for _row, p, act, target in f["v"]:
        acts[p][act] += 1
        if f["acts"][act] == "attack" and target >= 0:
            attacks[p][f["targets"][target]] += 1
    return {
        "window": f["window"],
        "weeks": weeks,
        "analysed": sum(analysed),
        "outlets": [{"name": o["name"], "slug": o["slug"], "analysed": analysed[k], "stance": stance[k], "weeks": stance_week[k]} for k, o in enumerate(f["outlets"])],
        "issues": [{"el": i["el"], "en": i["en"], "soft": i["soft"], "stance": issue_stance[k]} for k, i in enumerate(f["issues"])],
        "acts": f["acts"],
        "people": [{**p, "weeks": mention_week[k], "portrayal": portrayal[k], "acts": acts[k], "attacks": attacks[k].most_common(8)} for k, p in enumerate(f["people"])],
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
    raw, meta = {}, {}
    for name, path in FILES.items():
        raw[name], meta[name] = base.fetch(cache, name, path)
    for key, fn in [("elections", elections), ("war", war), ("israel", israel), ("gazaCoverage", gaza_coverage), ("conflictLanguage", conflict_language), ("speeches", speeches), ("statements", statements), ("personFile", person_file), ("cases", cases)]:
        print(f"{base.write(out, key, fn(raw, meta)):>8} {key}.js")
    (out / "sources-politics-world.json").write_text(json.dumps({"reads": list(meta.values())}, indent=1, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
