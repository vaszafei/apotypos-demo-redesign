"""What the article drawer of a story page shows of each article of the stories of the ta_blepo database: the link, the author, the section, the length,
how late the crawler saw it, the title of its page when it differs, and the opening of its text, two or three sentences (the whole text of all the stories is 220 MB).

Usage: PGPASSWORD=<password> python3 -I make-story-articles.py <prototypes-dir> [--dsn <postgres-uri>]

The stories and the order of their articles are those of make-article-times.py (it must have been run on the same database).

Output: data/story-articles/<story id>.json, read only when the drawer opens: a list in the order of data/story-times/, one object per article:
{"u": url, "a": author, "s": section, "w": words, "l": minutes from publication to the crawler, "v": "rss" | "sitemap", "p": title of the page, "o": opening}.
A key is left out when it has nothing.
"""

import argparse
import html
import importlib.util
import json
import re
from pathlib import Path

here = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("article_times", here / "make-article-times.py")
times = importlib.util.module_from_spec(spec)
spec.loader.exec_module(times)
db = times.db

OPENING = 300
OPENING_MAX = 450


def norm(text):
    return re.sub(r"\W+", " ", text or "").strip().lower()


def opening(body, title):
    """The first paragraphs of the text, about OPENING characters, cut at the end of a sentence; the title, menus and short lines before the text are left out."""
    lines = [" ".join(html.unescape(x).split()) for x in (body or "").splitlines()]
    head = norm(title)
    out = []
    for line in lines:
        if not out and (len(line) < 40 or line.startswith("-") or norm(line) == head or (head and norm(line).startswith(head))):
            continue
        if line:
            out.append(line)
        if sum(len(x) for x in out) >= OPENING:
            break
    text = "\n".join(out)
    if len(text) <= OPENING_MAX:
        return text
    cut = text[:OPENING_MAX]
    end = max(cut.rfind(". "), cut.rfind(".\n"), cut.rfind("» "), cut.rfind("; "))
    return (cut[: end + 1] if end > OPENING // 2 else cut.rsplit(" ", 1)[0] + " …").strip()


def section(value):
    """A section as the outlet names it; a slug of an article (long, or with digits) is not a section."""
    value = (value or "").strip()
    return value if value and len(value) <= 28 and value.count("-") <= 2 and not re.search(r"\d", value) else ""


def page_title(page, title):
    """The title of the page when it says something the title does not (the name of the outlet after | or - is left out)."""
    page = " ".join(html.unescape(page or "").split())
    page = re.split(r"\s+[|–—]\s+|\s+-\s+(?=[^-]*$)", page)[0].strip() if page else ""
    return page if page and norm(page) != norm(title) and norm(title) not in norm(page) and norm(page) not in norm(title) else ""


def author(value):
    parts = [" ".join(x.split()) for x in (value or "").split(";")]
    seen = []
    for p in parts:
        if p and p.lower() not in (s.lower() for s in seen):
            seen.append(p)
    return ", ".join(seen)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("prototypes")
    ap.add_argument("--dsn", default=db.DEFAULT_DSN)
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

    ids = [a for _n, arts in chains for *_x, a in arts]
    rows = {}
    for k in range(0, len(ids), 2000):
        chunk = ",".join(str(i) for i in ids[k:k + 2000])
        for r in db.query(args.dsn, f"""select id, canonical_url as u, author as a, section as s, title, page_title, date_source as v,
          coalesce(array_length(regexp_split_to_array(trim(body), '\\s+'), 1), 0) as w,
          case when published_at is null then null else round(extract(epoch from first_seen_at - published_at) / 60) end as l, left(body, 6000) as body
          from articles where id in ({chunk})"""):
            rows[int(r["id"])] = r

    out_dir = root / "data" / "story-articles"
    out_dir.mkdir(exist_ok=True)
    for old in out_dir.glob("*.json"):
        old.unlink()
    for k, (_name, arts) in enumerate(chains):
        items = []
        for *_x, a in arts:
            r = rows[a]
            title = db.clean_title(r["title"] or "")
            item = {"u": r["u"], "a": author(r["a"]), "s": section(r["s"]), "w": int(r["w"] or 0), "l": int(float(r["l"])) if r["l"] not in (None, "") else None,
                    "v": r["v"] or "", "p": page_title(r["page_title"], title), "o": opening(r["body"], title)}
            items.append({key: v for key, v in item.items() if v not in ("", None, 0)})
        (out_dir / f"{first_id + k}.json").write_text(json.dumps(items, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size = sum(p.stat().st_size for p in out_dir.glob("*.json"))
    print(f"{len(chains)} stories, {len(ids)} articles, {size // 1024} KB in {out_dir}")


if __name__ == "__main__":
    main()
