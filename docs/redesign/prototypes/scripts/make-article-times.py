"""The time and the outlet of each article of the stories of the ta_blepo database (#215), as small files read only when a story page opens.

Usage: PGPASSWORD=<password> python3 -I make-article-times.py <prototypes-dir> [--dsn <postgres-uri>] [--shards 50]

The stories are the chains that make-db-fixtures.py made (same rows, same order, same ids): this script rebuilds them and stops when a name
differs from the one in data/stories.js. For each story it writes the outlet of each article (an index into storyDetail.outlets) and the minute
of its publication in UTC (published_at, or the first time the crawler saw it when that is missing), sorted by time.

Output: data/story-times/<k>.json for k in 0..shards-1, each {"<story id>": [t0, outlet, minutes, outlet, minutes, ...]}, where a story is in
shard id % shards, t0 is the minute of its first article (minutes since 1970 UTC) and each minutes is counted from t0.
"""

import argparse
import importlib.util
import json
from datetime import datetime
from pathlib import Path

here = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("db_fixtures", here / "make-db-fixtures.py")
db = importlib.util.module_from_spec(spec)
spec.loader.exec_module(db)


def minute(stamp):
    """A timestamp of psql (UTC, '2026-10-14 06:03:11+00') as minutes since 1970."""
    return int(datetime.fromisoformat(stamp.replace(" ", "T")).timestamp() // 60)


def chains_with_times(dsn, outlet_of_domain, dates, first, last):
    """The chains of database_stories in make-db-fixtures.py, in its order, each with its articles: (name, [(minute, outlet, day index)])."""
    day_of = f"(coalesce(a.published_at, a.first_seen_at) at time zone '{db.DAY_TZ}')::date"
    listed = ",".join(f"'{d}'" for d in sorted(outlet_of_domain))
    nodes = [int(r["id"]) for r in db.query(dsn, f"select id from daily_stories where day between '{first}' and '{last}'")]
    links = db.query(dsn, f"""select l.from_story_id as a, l.to_story_id as b from story_links l
      join daily_stories x on x.id = l.from_story_id join daily_stories y on y.id = l.to_story_id
      where l.kind = 'continues' and l.state = 'active' and x.day between '{first}' and '{last}' and y.day between '{first}' and '{last}'""")
    rows = db.query(dsn, f"""select ds.id as story, a.id as article, d.domain, {day_of} as day, a.title, ae.article_time,
      to_char(coalesce(a.published_at, a.first_seen_at) at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') as at
      from daily_stories ds join daily_story_events dse on dse.daily_story_id = ds.id
      join article_events ae on ae.event_id = dse.event_id
      join articles a on a.id = ae.article_id join sources d on d.id = a.source_id
      where ds.day between '{first}' and '{last}' and d.domain in ({listed}) and a.moved_to_id is null""")
    parent = {n: n for n in nodes}
    for link in links:
        a, b = db.find(parent, int(link["a"])), db.find(parent, int(link["b"]))
        if a != b:
            parent[max(a, b)] = min(a, b)
    index = {day: i for i, day in enumerate(dates) if first <= day <= last}
    chains = {}
    for r in rows:
        if r["day"] in index:
            chains.setdefault(db.find(parent, int(r["story"])), {})[int(r["article"])] = r
    built = []
    for articles in chains.values():
        if len(articles) < 3:
            continue
        titled = sorted((r["article_time"], int(r["article"]), db.clean_title(r["title"])) for r in articles.values() if db.clean_title(r["title"]))
        if not titled:
            continue
        arts = sorted((minute(r["at"] + "+00:00"), outlet_of_domain[r["domain"]], index[r["day"]]) for r in articles.values())
        built.append((titled[0][0], min(articles), titled[0][2], arts))
    built.sort(key=lambda x: (x[0], x[1]))
    return [(name, arts) for _t, _a, name, arts in built]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("prototypes")
    ap.add_argument("--dsn", default=db.DEFAULT_DSN)
    ap.add_argument("--shards", type=int, default=50)
    args = ap.parse_args()
    root = Path(args.prototypes)
    domains = json.loads((root / "scripts" / "outlet-domains.json").read_text(encoding="utf-8"))["outlets"]
    media = db.read_fixture(root / "data" / "media.js", "media")
    stories = db.read_fixture(root / "data" / "stories.js", "stories")
    names = [o["name"] for o in media["outlets"]]
    outlet_of_domain = {domains[n]["domain"]: k for k, n in enumerate(names) if domains[n].get("domain")}
    first, last = media["dbCovered"]

    chains = chains_with_times(args.dsn, outlet_of_domain, media["dates"], first, last)
    first_id = stories["dbStoryFrom"]
    by_id = {s["id"]: s for s in stories["stories"]}
    if len(chains) != sum(1 for s in stories["stories"] if s["id"] >= first_id):
        raise SystemExit(f"{len(chains)} chains, but stories.js has {sum(1 for s in stories['stories'] if s['id'] >= first_id)} stories from the database")
    shards = [{} for _ in range(args.shards)]
    for k, (name, arts) in enumerate(chains):
        sid = first_id + k
        if by_id[sid]["el"] != name:
            raise SystemExit(f"story {sid}: the chain is named {name!r}, stories.js has {by_id[sid]['el']!r}")
        t0 = arts[0][0]
        shards[sid % args.shards][str(sid)] = [t0] + [x for m, o, _d in arts for x in (o, m - t0)]

    out = root / "data" / "story-times"
    out.mkdir(exist_ok=True)
    for old in out.glob("*.json"):
        old.unlink()
    for k, shard in enumerate(shards):
        (out / f"{k}.json").write_text(json.dumps(shard, separators=(",", ":")), encoding="utf-8")
    size = sum(p.stat().st_size for p in out.glob("*.json"))
    print(f"{len(chains)} stories, {sum(len(a) for _n, a in chains)} articles, {args.shards} shards, {size // 1024} KB in {out}")


if __name__ == "__main__":
    main()
