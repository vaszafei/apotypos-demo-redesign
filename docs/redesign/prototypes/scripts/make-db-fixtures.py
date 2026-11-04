"""Add the days of the ta_blepo database (the backend dump of apotypos) to the media, stories, storyDetail and home fixtures.

Usage: PGPASSWORD=<password> python3 -I make-db-fixtures.py <prototypes-dir> --as-of YYYY-MM-DD [--dsn <postgres-uri>]

The base is the fixture of the live site (window 2026-08-01 to 2026-09-30). The script keeps every value of the base and appends the days
after it, so a day index that points at a base day still points at it. The fixture keeps `volumeFrom`, the first day that comes from the
database: a second run cuts the fixture there before it appends, so a run on the same dump, or on a newer one, never doubles a day.

The database holds the raw articles of each domain. It has no topic, frame, stance or clickbait label, so those cells of the new days are null,
never 0. data/media.js has analysed rows per outlet and day: the database only gives the first of its four numbers.
A day is an Athens day: the story rule of the database (stories-v1, day_time_zone) says Europe/Athens.
An outlet is mapped to its domain by outlet-domains.json. An outlet with no domain gets null cells.

The crawler of the database ramped up in October, so a day counts only when 75% of the mapped outlets have articles on it. The days from
the first such day that holds to the last one before --as-of are the covered range. The days before it are in the dates with null cells.

A story of the database is a chain: each daily story is a node and each `continues` link of story_links joins two nodes. The stories and
storyDetail fixtures get one row for each chain with 3 or more articles of the mapped outlets in the covered range, like the stories of the base.
The name is the title of its first article. The topic is the catch-all topic. The labels of storyDetail (frame, stance, section, clickbait) are null.
The ids of the new stories start after the last id of the base; `dbStoryFrom` keeps the first, so a second run cuts them before it appends.
"""

import argparse
import csv
import html
import io
import json
import re
import statistics
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path

DEFAULT_DSN = "postgresql://postgres@127.0.0.1:54329/ta_blepo"
COVER_SHARE = 0.75
RATIO_LIMIT = 3
DAY_TZ = "Europe/Athens"


def read_fixture(path, key):
    text = path.read_text(encoding="utf-8")
    head = f"window.FIXTURES=window.FIXTURES||{{}};window.FIXTURES[{json.dumps(key)}]="
    if not (text.startswith(head) and text.endswith(";\n")):
        sys.exit(f"{path} is not a fixture of the format of make-fixtures.py")
    return json.loads(text[len(head):-2])


def write_fixture(path, key, data):
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    path.write_text(f"window.FIXTURES=window.FIXTURES||{{}};window.FIXTURES[{json.dumps(key)}]={text};\n", encoding="utf-8")


def query(dsn, sql):
    run = subprocess.run(["psql", dsn, "--csv", "-v", "ON_ERROR_STOP=1", "-c", sql], capture_output=True, text=True)
    if run.returncode:
        sys.exit(f"psql failed: {run.stderr.strip()}")
    return list(csv.DictReader(io.StringIO(run.stdout)))


def days_between(first, last):
    return [(first + timedelta(days=i)).isoformat() for i in range((last - first).days + 1)]


MARKERS = ("volumeFrom", "dbCovered", "dbStoryFrom")


def cut_stories(fixture):
    """The stories and storyDetail fixtures as they were before the database: without the stories from dbStoryFrom. Returns the number of stories left."""
    if "dbStoryFrom" in fixture:
        fixture["stories"] = [s for s in fixture["stories"] if s["id"] < fixture["dbStoryFrom"]]
    return len(fixture["stories"])


def cut_home(home, cut):
    """The home fixture as it was before the database days. Its outlets keep the collected articles of each day, and its topics the articles of each day."""
    home["dates"] = home["dates"][:cut]
    for outlet in home["outlets"]:
        outlet["daily"] = outlet["daily"][:cut]
    home["issueDaily"] = [row[:cut] for row in home["issueDaily"]]
    for key in MARKERS:
        home.pop(key, None)


def extend_home(home, media, cut):
    """The pages read home, media and stories on one axis of days, so home gets the days of media. A day with no data is null."""
    if home["dates"] != media["dates"][:cut]:
        sys.exit("home.js and media.js do not start with the same days")
    if [o["name"] for o in home["outlets"]] != [o["name"] for o in media["outlets"]]:
        sys.exit("home.js and media.js do not list the same outlets in the same order")
    n = len(media["dates"]) - cut
    for k, outlet in enumerate(home["outlets"]):
        outlet["daily"] += [cell[0] for cell in media["outletDaily"][k][cut:]]
    for row in home["issueDaily"]:
        row += [None] * n
    home["dates"] = media["dates"]
    for key in ("window", "updatedAt", "volumeFrom", "dbCovered"):
        home[key] = media[key]


def cut_base(media, story_count):
    """The media fixture as it was before the database days: everything before volumeFrom, or all of it when the field is not set yet."""
    cut = media["dates"].index(media["volumeFrom"]) if "volumeFrom" in media else len(media["dates"])
    media["dates"] = media["dates"][:cut]
    media["outletDaily"] = [row[:cut] for row in media["outletDaily"]]
    media["issueDaily"] = [row[:cut] for row in media["issueDaily"]]
    for story in media["stories"]:
        story["daily"] = story["daily"][:cut]
    media["storyDays"] = [[x for i in range(0, len(pairs), 2) if pairs[i] < cut for x in pairs[i:i + 2]] for pairs in media["storyDays"][:story_count]]
    for key in MARKERS:
        media.pop(key, None)
    return cut


def article_counts(dsn, domains, first, as_of):
    """Articles per domain and Athens day, from `first` to the day before `as_of`. An article moved to another one is a duplicate and does not count."""
    if not all(re.fullmatch(r"[a-z0-9.-]+", d) for d in domains):
        sys.exit("a domain of outlet-domains.json has a character outside a-z, 0-9, dot and dash")
    listed = ",".join(f"'{d}'" for d in sorted(domains))
    day_of = f"(coalesce(a.published_at, a.first_seen_at) at time zone '{DAY_TZ}')::date"
    sql = f"""select d.domain, {day_of} as day, count(*) as n
      from articles a join sources d on d.id = a.source_id
      where d.domain in ({listed}) and a.moved_to_id is null
        and {day_of} >= '{first}' and {day_of} < '{as_of}'
      group by 1, 2"""
    return {(r["domain"], r["day"]): int(r["n"]) for r in query(dsn, sql)}


def covered_range(counts, domains, days):
    """The last day with articles from 75% of the domains, and the first day from which every day up to it has them."""
    present = {day: sum(1 for d in domains if counts.get((d, day), 0) > 0) for day in days}
    ok = [present[day] >= COVER_SHARE * len(domains) for day in days]
    if not any(ok):
        sys.exit("no day of the database has articles from 75% of the mapped outlets")
    last = max(i for i, v in enumerate(ok) if v)
    first = last
    while first > 0 and ok[first - 1]:
        first -= 1
    return days[first], days[last], present


def extend_media(media, dsn, outlet_domains, as_of):
    base_days = len(media["dates"])
    first_new = date.fromisoformat(media["dates"][-1]) + timedelta(days=1)
    names = [o["name"] for o in media["outlets"]]
    unmapped = [n for n in names if n not in outlet_domains]
    if unmapped:
        sys.exit(f"outlet-domains.json has no entry for: {', '.join(unmapped)}")
    domains = {n: outlet_domains[n]["domain"] for n in names}
    mapped = sorted(d for d in domains.values() if d)
    counts = article_counts(dsn, mapped, first_new, as_of)
    candidate = days_between(first_new, date.fromisoformat(as_of) - timedelta(days=1))
    first, last, present = covered_range(counts, mapped, candidate)
    new_days = days_between(first_new, date.fromisoformat(last))

    ratios = {}
    for k, name in enumerate(names):
        if not domains[name]:
            continue
        before = [c[0] for c in media["outletDaily"][k]]
        after = [counts.get((domains[name], day), 0) for day in days_between(date.fromisoformat(first), date.fromisoformat(last))]
        if statistics.mean(before) > 0:
            ratios[name] = statistics.mean(after) / statistics.mean(before)
    off = {n: r for n, r in ratios.items() if (r > RATIO_LIMIT or r < 1 / RATIO_LIMIT) and not outlet_domains[n].get("jump_accepted")}

    media["dates"] += new_days
    for k, name in enumerate(names):
        for day in new_days:
            covered = domains[name] and first <= day <= last
            media["outletDaily"][k].append([counts.get((domains[name], day), 0), None, None, None] if covered else [None, None, None, None])
    for row in media["issueDaily"]:
        row += [None] * len(new_days)
    for story in media["stories"]:
        story["daily"] += [None] * len(new_days)
    media["window"] = [media["dates"][0], last]
    media["updatedAt"] = as_of
    media["volumeFrom"] = new_days[0]
    media["dbCovered"] = [first, last]
    covered_days = days_between(date.fromisoformat(first), date.fromisoformat(last))
    return {"base_days": base_days, "new_days": len(new_days), "covered": [first, last], "present": present, "ratios": ratios, "off": off,
            "articles": sum(counts.get((d, day), 0) for d in mapped for day in covered_days),
            "outlets_with_domain": len(mapped), "outlets_null": len(names) - len(mapped),
            "outlet_of_domain": {domains[n]: k for k, n in enumerate(names) if domains[n]}}


def clean_title(title):
    """A title of the database holds HTML entities (&#8211;) and stray spaces."""
    return " ".join(html.unescape(title).split())


def find(parent, x):
    while parent[x] != x:
        parent[x] = parent[parent[x]]
        x = parent[x]
    return x


def database_stories(dsn, outlet_of_domain, dates, first, last, catch_all, first_id):
    """The chains of daily stories of the covered range as story rows. Returns (stories.js rows, storyDetail.js rows, report)."""
    day_of = f"(coalesce(a.published_at, a.first_seen_at) at time zone '{DAY_TZ}')::date"
    listed = ",".join(f"'{d}'" for d in sorted(outlet_of_domain))
    nodes = [int(r["id"]) for r in query(dsn, f"select id from daily_stories where day between '{first}' and '{last}'")]
    links = query(dsn, f"""select l.from_story_id as a, l.to_story_id as b from story_links l
      join daily_stories x on x.id = l.from_story_id join daily_stories y on y.id = l.to_story_id
      where l.kind = 'continues' and l.state = 'active' and x.day between '{first}' and '{last}' and y.day between '{first}' and '{last}'""")
    rows = query(dsn, f"""select ds.id as story, a.id as article, d.domain, {day_of} as day, a.title, ae.article_time
      from daily_stories ds join daily_story_events dse on dse.daily_story_id = ds.id
      join article_events ae on ae.event_id = dse.event_id
      join articles a on a.id = ae.article_id join sources d on d.id = a.source_id
      where ds.day between '{first}' and '{last}' and d.domain in ({listed}) and a.moved_to_id is null""")
    parent = {n: n for n in nodes}
    for link in links:
        a, b = find(parent, int(link["a"])), find(parent, int(link["b"]))
        if a != b:
            parent[max(a, b)] = min(a, b)
    index = {day: i for i, day in enumerate(dates) if first <= day <= last}
    chains = {}
    for r in rows:
        if r["day"] in index:
            chains.setdefault(find(parent, int(r["story"])), {})[int(r["article"])] = r
    built = []
    skipped = {"under_3": 0, "no_title": 0}
    for articles in chains.values():
        if len(articles) < 3:
            skipped["under_3"] += 1
            continue
        titled = sorted((r["article_time"], int(r["article"]), clean_title(r["title"])) for r in articles.values() if clean_title(r["title"]))
        if not titled:
            skipped["no_title"] += 1
            continue
        cells = {}
        for r in articles.values():
            key = (outlet_of_domain[r["domain"]], index[r["day"]])
            cells[key] = cells.get(key, 0) + 1
        built.append((titled[0][0], min(articles), titled[0][2], cells))
    built.sort(key=lambda x: (x[0], x[1]))
    story_rows, detail_rows = [], []
    for k, (_t, _a, name, cells) in enumerate(built):
        per_day = {}
        for (_o, day), n in cells.items():
            per_day[day] = per_day.get(day, 0) + n
        story_rows.append({"id": first_id + k, "el": name, "issue": catch_all, "outlets": len({o for o, _d in cells}), "generic": False,
                           "days": [x for day, n in sorted(per_day.items()) for x in (day, n)]})
        detail_rows.append({"id": first_id + k, "t": [x for (o, day), n in sorted(cells.items()) for x in (o, day, n)], "f": None, "s": None, "c": None, "k": None, "p": []})
    sizes = sorted((len(s["days"]) // 2 for s in story_rows), reverse=True)
    return story_rows, detail_rows, {"nodes": len(nodes), "links": len(links), "chains": len(chains), "kept": len(story_rows), "skipped": skipped,
                                     "longest_days": sizes[:3], "biggest_articles": sorted((sum(s["days"][1::2]) for s in story_rows), reverse=True)[:3]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("prototypes")
    ap.add_argument("--as-of", required=True, help="the day of the dump: the days from it on are not complete")
    ap.add_argument("--dsn", default=DEFAULT_DSN)
    ap.add_argument("--dump", help="the file name of the dump the database was restored from, kept in data/sources.json")
    args = ap.parse_args()
    root = Path(args.prototypes)
    domains = json.loads((root / "scripts" / "outlet-domains.json").read_text(encoding="utf-8"))["outlets"]

    paths = {key: root / "data" / f"{key}.js" for key in ("media", "stories", "storyDetail", "home")}
    media, stories, detail, home = (read_fixture(paths[key], key) for key in paths)
    base_stories = cut_stories(stories)
    cut_stories(detail)
    cut = cut_base(media, base_stories)
    cut_home(home, cut)
    base_dates = list(media["dates"])
    for fixture in (stories, detail):
        fixture["dates"] = base_dates
        for key in MARKERS:
            fixture.pop(key, None)

    report = extend_media(media, args.dsn, domains, args.as_of)
    if report["off"]:
        for name, ratio in sorted(report["off"].items(), key=lambda x: x[1]):
            print(f"STOP {name}: {ratio:.2f} times its Aug-Sep daily mean", file=sys.stderr)
        sys.exit(f"{len(report['off'])} outlets are more than {RATIO_LIMIT} times away from their Aug-Sep level: nothing written")

    catch_all = [k for k, issue in enumerate(stories["issues"]) if issue["catchAll"]]
    if len(catch_all) != 1:
        sys.exit("stories.js must have exactly one catch-all topic")
    first_id = max(s["id"] for s in stories["stories"]) + 1
    new_stories, new_detail, story_report = database_stories(args.dsn, report["outlet_of_domain"], media["dates"], *report["covered"], catch_all[0], first_id)
    stories["stories"] += new_stories
    detail["stories"] += new_detail
    media["storyDays"] += [s["days"] for s in new_stories]
    for fixture in (stories, detail):
        fixture["dates"] = media["dates"]
        for key in ("window", "updatedAt", "volumeFrom", "dbCovered"):
            fixture[key] = media[key]
        fixture["dbStoryFrom"] = first_id

    extend_home(home, media, cut)
    for key in paths:
        write_fixture(paths[key], key, {"media": media, "stories": stories, "storyDetail": detail, "home": home}[key])
    sources_path = root / "data" / "sources.json"
    sources = json.loads(sources_path.read_text(encoding="utf-8"))
    sources["database"] = {"dump": args.dump, "asOf": args.as_of, "covered": report["covered"], "dayTimeZone": DAY_TZ,
                           "outlets": f"{report['outlets_with_domain']} of {report['outlets_with_domain'] + report['outlets_null']}",
                           "articles": report["articles"], "stories": story_report["kept"]}
    sources_path.write_text(json.dumps(sources, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"media.js: {report['base_days']} base days + {report['new_days']} new days; covered {report['covered'][0]} to {report['covered'][1]}")
    print(f"outlets: {report['outlets_with_domain']} with a domain, {report['outlets_null']} with null cells")
    print("ratio of the October daily mean to the Aug-Sep daily mean: " + ", ".join(f"{n} {r:.2f}" for n, r in sorted(report["ratios"].items())))
    print(f"stories: {base_stories} base + {story_report['kept']} new (ids from {first_id}); {story_report}")


if __name__ == "__main__":
    main()
