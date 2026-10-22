"""Read the data of the live /media page of apotypos.org (ΜΜΕ & πρόσωπα) one time and write data/mme.js.

Usage: python3 -I make-mme.py <cache-dir> <out-dir>

The live page reads one file of article rows for each set: media-data/<set>/facts.json. The outlet page reads
media-data/<set>/outlets/<slug>.json for its headlines. The script sums the rows by outlet, topic, story, person and day,
so the prototype can sum any period of days in the browser. The groups of the outlets come from data/media.js.
The script keeps each download in <cache-dir>. A second run reads the cache and makes no request.
"""

import json
import math
import sys
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

BASE = "https://apotypos.org/media-data"
SETS = {"gr": "aug_sep_2026", "il": "il_2026"}
# The people of the matrices and the person cards: the live page shows 7 for Greece. Israel has 148 people, most with a few quotes.
PEOPLE = {"gr": 7, "il": 8}
# The stories with outlet and day rows. The other stories keep only their rows per day, for the count of stories.
STORIES = {"gr": 320, "il": 60}
# The next stories, down to 15 rows, keep only their rows per outlet over the whole window: the outlet page needs them for the stories it skipped.
LITE_MIN = 15
HEADLINES = 15
ATTACKS = 10


def fetch(cache, path):
    file = cache / path.replace("/", "__")
    if not file.exists():
        req = urllib.request.Request(f"{BASE}/{path}", headers={"User-Agent": "apotypos-prototype-fixtures"})
        with urllib.request.urlopen(req, timeout=120) as res:
            file.write_bytes(res.read())
    return json.loads(file.read_text())


def pairs(counter):
    """A day counter as flat pairs [day, n, ...] in day order."""
    return [x for day in sorted(counter) for x in (day, counter[day])]


def cosine(a, b):
    keys = set(a) | set(b)
    dot = sum(a.get(k, 0) * b.get(k, 0) for k in keys)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    return round(dot / (na * nb), 3) if na and nb else 0


def build(cache, key, groups):
    f = fetch(cache, f"{SETS[key]}/facts.json")
    dates = f["dates"]
    outlets = f["outlets"]
    issues = f["issues"]
    nO, nI, nD = len(outlets), len(issues), len(dates)
    soft = [i["soft"] for i in issues]
    rows = f["a"]

    # Outlet x day: articles, news, clickbait known, clickbait yes, critical, neutral, supportive.
    od = [[[0] * 7 for _ in range(nD)] for _ in range(nO)]
    oi = [[Counter() for _ in range(nI)] for _ in range(nO)]
    ost = [[defaultdict(lambda: [0, 0, 0]) for _ in range(nI)] for _ in range(nO)]
    ofr = [[Counter() for _ in range(len(f["frames"]))] for _ in range(nO)]
    osec = [[0] * len(f["sections"]) for _ in range(nO)]
    story_days = defaultdict(Counter)
    story_rows = defaultdict(Counter)
    for o, day, issue, story, frame, stance, cb, section in rows:
        c = od[o][day]
        c[0] += 1
        if not soft[issue]:
            c[1] += 1
        if cb >= 0:
            c[2] += 1
            c[3] += cb
        if stance > 0:
            c[3 + stance] += 1
            ost[o][issue][day][stance - 1] += 1
        oi[o][issue][day] += 1
        if frame >= 0:
            ofr[o][frame][day] += 1
        if section >= 0:
            osec[o][section] += 1
        if story >= 0:
            story_days[story][day] += 1
            story_rows[story][(o, day)] += 1

    sizes = Counter({s: sum(c.values()) for s, c in story_days.items()})
    keep = [s for s, _ in sizes.most_common(STORIES[key])]
    stories = []
    for s in keep:
        meta = f["stories"][s]
        stories.append({
            "el": meta["el"], "en": meta.get("en") or meta["el"], "issue": next(i for i, x in enumerate(issues) if x["el"] == meta["issue"]) if any(x["el"] == meta["issue"] for x in issues) else -1,
            "generic": bool(meta.get("generic")),
            "t": [x for (o, day), n in sorted(story_rows[s].items(), key=lambda kv: (kv[0][1], kv[0][0])) for x in (o, day, n)],
        })
    kept = set(keep)
    lite = []
    for s, n in sizes.most_common():
        if s in kept or f["stories"][s].get("generic"):
            continue
        if n < LITE_MIN:
            break
        meta = f["stories"][s]
        per = Counter()
        for (o, _), m in story_rows[s].items():
            per[o] += m
        lite.append({"el": meta["el"], "en": meta.get("en") or meta["el"], "issue": next((i for i, x in enumerate(issues) if x["el"] == meta["issue"]), -1),
                     "o": [x for o in sorted(per) for x in (o, per[o])]})
    # The rows per day of every story with 3 rows or more, for the count of stories in a period.
    sd = [pairs(story_days[s]) for s, n in sizes.items() if n >= 3]

    # Quotes: [article, person, act, target]. Mentions: [article, person, portrayal, ...].
    quoted = Counter(p for _, p, _, _ in f["v"])
    people_idx = [p for p, _ in quoted.most_common(PEOPLE[key])]
    pos = {p: k for k, p in enumerate(people_idx)}
    people = [{"name": f["people"][p]["name"], "role": f["people"][p].get("role", ""), "party": f["people"][p].get("party", "")} for p in people_idx]
    q = [[Counter() for _ in people_idx] for _ in range(nO)]
    qi = [[Counter() for _ in people_idx] for _ in range(nI)]
    qact = [[0] * len(f["acts"]) for _ in people_idx]
    qtarget = [Counter() for _ in people_idx]
    attacks = [Counter() for _ in range(nO)]
    for art, p, act, target in f["v"]:
        o, day, issue = rows[art][0], rows[art][1], rows[art][2]
        if act == 1 and target >= 0:
            attacks[o][(f["people"][p]["name"], f["targets"][target])] += 1
        if p not in pos:
            continue
        k = pos[p]
        q[o][k][day] += 1
        qi[issue][k][day] += 1
        qact[k][act] += 1
        if target >= 0:
            qtarget[k][f["targets"][target]] += 1
    mt = [[defaultdict(lambda: [0, 0, 0]) for _ in people_idx] for _ in range(nO)]
    for m in f["m"]:
        art, p, tone = m[0], m[1], m[2]
        if p not in pos or tone < 0:
            continue
        o, day = rows[art][0], rows[art][1]
        mt[o][pos[p]][day][tone] += 1

    # Similarity of two outlets over the whole window: cosine of the story vectors and of the topic vectors.
    story_vec = [Counter() for _ in range(nO)]
    for s, c in story_rows.items():
        if f["stories"][s].get("generic"):
            continue
        for (o, _), n in c.items():
            story_vec[o][s] += n
    topic_vec = [Counter({i: sum(oi[o][i].values()) for i in range(nI) if not soft[i]}) for o in range(nO)]
    sim = [[[b, cosine(story_vec[a], story_vec[b]), cosine(topic_vec[a], topic_vec[b])] for b in range(nO) if b != a] for a in range(nO)]

    # The newest headlines of each outlet, with the frame and the story of the article.
    headlines = []
    for o in outlets:
        items = fetch(cache, f"{SETS[key]}/outlets/{o['slug']}.json")
        items = sorted(items, key=lambda x: (rows[x[0]][1], x[0]), reverse=True)[:HEADLINES]
        out = []
        for art, title, url, angle in items:
            r = rows[art]
            st = f["stories"][r[3]] if r[3] >= 0 else None
            out.append([dates[r[1]], title, url, (angle or "")[:200], r[4], st["el"] if st else "", r[2]])
        headlines.append(out)

    return {
        "window": [dates[0], dates[-1]], "country": f.get("country", key.upper()), "dates": dates,
        "outlets": [{"name": o["name"], "slug": o["slug"], "group": groups.get(o["slug"])} for o in outlets],
        # «Άλλα διεθνή» is the catch-all of the world news: the live page leaves it out of the topic chips and the agenda.
        "issues": [{**i, "catchAll": i["el"] == "Άλλα διεθνή"} for i in issues], "frames": f["frames"], "sections": f["sections"], "acts": f["acts"],
        "people": people,
        "od": [[x for c in days for x in c] for days in od],
        "oi": [[pairs(c) for c in row] for row in oi],
        "os": [[[x for day in sorted(c) for x in (day, *c[day])] for c in row] for row in ost],
        "of": [[pairs(c) for c in row] for row in ofr],
        "osec": osec,
        "stories": stories, "lite": lite, "sd": sd,
        "q": [[pairs(c) for c in row] for row in q],
        "qi": [[pairs(c) for c in row] for row in qi],
        "qact": qact,
        "qtarget": [[[n, c] for n, c in t.most_common(10)] for t in qtarget],
        "attacks": [[[a, b, n] for (a, b), n in c.most_common(ATTACKS)] for c in attacks],
        "mt": [[[x for day in sorted(c) for x in (day, *c[day])] for c in row] for row in mt],
        "sim": sim,
        "headlines": headlines,
    }


def main():
    cache, out = Path(sys.argv[1]), Path(sys.argv[2])
    cache.mkdir(parents=True, exist_ok=True)
    media = (out / "media.js").read_text()
    media = json.loads(media[media.index("=", media.index('["media"]')) + 1:].strip().rstrip(";"))
    groups = {o["slug"]: o.get("group") for o in media["outlets"]}
    body = {"updatedAt": "2026-10-22", "source": "apotypos.org/media", "sets": {k: build(cache, k, groups) for k in SETS}}
    text = json.dumps(body, ensure_ascii=False, separators=(",", ":"))
    (out / "mme.js").write_text(f'window.FIXTURES=window.FIXTURES||{{}};window.FIXTURES["mme"]={text};\n')
    print(f"mme.js: {len(text) // 1024} KB")


if __name__ == "__main__":
    main()
