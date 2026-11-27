"""The related stories of each story of the ta_blepo database, and which of its articles are about each one, from the bge-m3 vectors of the articles.

Usage: PGPASSWORD=<password> python3 -I make-story-related.py <prototypes-dir> [--dsn <postgres-uri>] [--shards 50]

The stories and the order of their articles are those of make-article-times.py (it must have been run on the same database). An article's vector is
the mean of its chunks in article_embeddings; a story's vector is the mean of its articles'. Another story is related when the two story vectors have a
cosine of at least STORY_MIN: below it the pairs share a kind of news (crime with crime), not a subject. An article of the story is lit for a related
story when its cosine with that story's vector is at least ARTICLE_MIN; a pair with no lit article is left out. KEEP per story, best first (the app
shows the first RELATED of them that are in its window).

Output: data/story-related/<k>.json, in the shards of data/story-times/, each {"<story id>": [[other id, cosine x 1000, [article index, ...]], ...]},
where an article index is the place of the article in the story's row of story-times.
"""

import argparse
import importlib.util
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np

STORY_MIN = 0.70
ARTICLE_MIN = 0.70
KEEP = 10

here = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("article_times", here / "make-article-times.py")
times = importlib.util.module_from_spec(spec)
spec.loader.exec_module(times)
db = times.db


def article_vectors(dsn, ids):
    """The mean vector of the chunks of each article, unit length: (ids in the order of the rows, matrix)."""
    with tempfile.TemporaryDirectory() as tmp:
        want = Path(tmp) / "ids.txt"
        out = Path(tmp) / "vectors.tsv"
        want.write_text("\n".join(map(str, ids)))
        run = subprocess.run(["psql", dsn, "-q", "-v", "ON_ERROR_STOP=1", "-c", "create temp table want(id bigint)", "-c", f"\\copy want from '{want}'",
                              "-c", f"\\copy (select e.article_id, avg(e.embedding::vector)::text from article_embeddings e join want w on w.id = e.article_id group by 1) to '{out}'"],
                             capture_output=True, text=True)
        if run.returncode:
            raise SystemExit(f"psql failed: {run.stderr.strip()}")
        got, rows = [], []
        with out.open() as f:
            for line in f:
                article, vector = line.split("\t")
                got.append(int(article))
                rows.append(np.array(vector.strip()[1:-1].split(","), dtype=np.float32))
    matrix = np.stack(rows)
    return got, matrix / np.linalg.norm(matrix, axis=1, keepdims=True)


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

    chains = times.chains_with_times(args.dsn, outlet_of_domain, media["dates"], first, last)
    first_id = stories["dbStoryFrom"]
    by_id = {s["id"]: s for s in stories["stories"]}
    order = {}
    for k, (name, arts) in enumerate(chains):
        if by_id[first_id + k]["el"] != name:
            raise SystemExit(f"story {first_id + k}: the chain is named {name!r}, stories.js has {by_id[first_id + k]['el']!r}")
        order[first_id + k] = [a for *_rest, a in arts]

    ids, vectors = article_vectors(args.dsn, sorted({a for arts in order.values() for a in arts}))
    row = {a: i for i, a in enumerate(ids)}
    sids = [s for s in sorted(order) if all(a in row for a in order[s])]
    centers = np.stack([vectors[[row[a] for a in order[s]]].mean(0) for s in sids])
    centers /= np.linalg.norm(centers, axis=1, keepdims=True)
    sim = centers @ centers.T
    np.fill_diagonal(sim, -1)

    shards = [{} for _ in range(args.shards)]
    pairs = 0
    for i, sid in enumerate(sids):
        mine = vectors[[row[a] for a in order[sid]]]
        out = []
        for j in np.argsort(-sim[i], kind="stable"):
            if sim[i, j] < STORY_MIN or len(out) == KEEP:
                break
            lit = np.flatnonzero(mine @ centers[j] >= ARTICLE_MIN)
            if len(lit):
                out.append([sids[j], int(round(float(sim[i, j]) * 1000)), lit.tolist()])
        if out:
            shards[sid % args.shards][str(sid)] = out
            pairs += len(out)

    out_dir = root / "data" / "story-related"
    out_dir.mkdir(exist_ok=True)
    for old in out_dir.glob("*.json"):
        old.unlink()
    for k, shard in enumerate(shards):
        (out_dir / f"{k}.json").write_text(json.dumps(shard, separators=(",", ":")), encoding="utf-8")
    size = sum(p.stat().st_size for p in out_dir.glob("*.json"))
    print(f"{len(sids)} stories with vectors, {sum(1 for s in shards for _ in s)} with related stories, {pairs} pairs, {size // 1024} KB in {out_dir}")


if __name__ == "__main__":
    main()
