"""#214 spike: the platform's batch_topics.py method on the October bge-m3 embeddings.

Same steps and defaults as batch_topics.py (UMAP 10-d cosine, MiniBatchKMeans k=80 on a 50k sample,
Ward merge to 30 themes, 3-sigma outliers to -1, c-TF-IDF title keywords). Differences, all forced by the data:
- vectors are bge-m3 halfvec(1024) in article_embeddings, chunk 0 (the platform ran on articles.embedding, 768-d nomic);
- scope is the demo's own outlets (outlet-domains.json) and its window 14-27 Oct, Athens day, moved_to_id is null;
- no LLM labels (no Ollama or API key on this machine): keyword labels only.
Writes out/topics.json and out/assign.npy. Read-only on the database.
"""
import html
import json
import os
import random
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import psycopg2
import umap
from sklearn.cluster import AgglomerativeClustering, MiniBatchKMeans
from sklearn.feature_extraction.text import CountVectorizer

REPO = Path("/home/zafnitlab/Documents/apotypos-demo-redesign")
OUT = Path(__file__).parent / "out"
FIRST, LAST = "2026-10-14", "2026-10-27"
OVER, THEMES, UMAP_DIMS, OUT_STD, SAMPLE = int(os.environ.get("OVER", 80)), int(os.environ.get("THEMES", 30)), int(os.environ.get("UMAP_DIMS", 10)), 3.0, 50000
TAG = os.environ.get("TAG", f"{THEMES}")

sys.path.insert(0, str(Path.home() / "Desktop/Projects/apotypos/platform/services/worker"))
GR_STOP = set()
exec(Path(sys.path[0], "batch_topics.py").read_text().split("# --- data load")[0].split("log = setup_logging")[1].split("\n", 1)[1],
     {"re": __import__("re")}, ns := {})
GR_STOP, BOILER = ns["GR_STOP"], ns["_BOILER"]

t0 = time.time()
stamp = lambda msg: print(f"[{time.time() - t0:6.1f}s] {msg}", flush=True)

pw = subprocess.run(["docker", "exec", "apotypos-scratch-pg", "printenv", "POSTGRES_PASSWORD"], capture_output=True, text=True).stdout.strip()
conn = psycopg2.connect(host="127.0.0.1", port=54329, dbname="ta_blepo", user="postgres", password=pw)

outlets = json.loads((REPO / "docs/redesign/prototypes/scripts/outlet-domains.json").read_text())["outlets"]
domains = sorted(o["domain"] for o in outlets.values() if o.get("domain"))
day_of = "(coalesce(a.published_at, a.first_seen_at) at time zone 'Europe/Athens')::date"
with conn.cursor(name="emb") as cur:
    cur.itersize = 5000
    cur.execute(f"""select a.id, s.domain, {day_of}::text, a.title, e.embedding::text
      from articles a join sources s on s.id = a.source_id
      join article_embeddings e on e.article_id = a.id and e.chunk_no = 0
      where s.domain = any(%s) and a.moved_to_id is null and {day_of} between %s and %s""", (domains, FIRST, LAST))
    ids, dom, day, title, vecs = [], [], [], [], []
    for i, d, dy, t, v in cur:
        ids.append(i); dom.append(d); day.append(dy); title.append(html.unescape(t or ""))
        vecs.append(np.fromstring(v[1:-1], sep=",", dtype=np.float32))
with conn.cursor() as cur:
    cur.execute(f"""select count(*) from articles a join sources s on s.id = a.source_id
      where s.domain = any(%s) and a.moved_to_id is null and {day_of} between %s and %s""", (domains, FIRST, LAST))
    in_scope = cur.fetchone()[0]
X = np.vstack(vecs); del vecs
X /= np.linalg.norm(X, axis=1, keepdims=True) + 1e-9
stamp(f"loaded {len(X)} embedded articles of {in_scope} in scope ({len(domains)} domains), {X.nbytes / 1e6:.0f} MB")

rng = np.random.default_rng(42)
fit = rng.choice(len(X), size=min(SAMPLE, len(X)), replace=False)
Z = umap.UMAP(n_components=UMAP_DIMS, n_neighbors=15, min_dist=0.0, metric="cosine", random_state=42).fit_transform(X[fit]) if UMAP_DIMS else X[fit]
stamp("UMAP done")
km = MiniBatchKMeans(n_clusters=OVER, random_state=42, n_init=3, batch_size=4096, max_iter=200)
over = km.fit_predict(Z)
lab = AgglomerativeClustering(n_clusters=THEMES, linkage="ward").fit_predict(km.cluster_centers_) if THEMES < OVER else np.arange(OVER)
sample_theme = lab[over]
C = np.vstack([X[fit][sample_theme == t].mean(axis=0) for t in range(THEMES)])
C /= np.linalg.norm(C, axis=1, keepdims=True) + 1e-9
sdist = 1.0 - np.sum(X[fit] * C[sample_theme], axis=1)
thr = float(sdist.mean() + OUT_STD * sdist.std())
stamp(f"KMeans {OVER} -> {THEMES} themes, outlier dist > {thr:.3f}")

sims = X @ C.T
best = sims.argmax(axis=1)
dist = 1.0 - sims[np.arange(len(X)), best]
best[dist > thr] = -1
stamp("assigned all")

order = sorted(set(best.tolist()) - {-1}, key=lambda t: -(best == t).sum())
titles = {t: [BOILER.sub("", title[i]).strip() for i in np.flatnonzero(best == t)[:600]] for t in order}
keys = list(order)
vec = CountVectorizer(stop_words=list(GR_STOP), ngram_range=(1, 2), min_df=2, max_features=8000,
                      token_pattern=r"(?u)\b\w\w+\b", lowercase=True)
counts = vec.fit_transform([" ".join(titles[k]) for k in keys]).toarray().astype(float)
tf = counts / (counts.sum(axis=1, keepdims=True) + 1e-9)
idf = np.log(1.0 + len(keys) / ((counts > 0).sum(axis=0) + 1e-9))
terms = np.array(vec.get_feature_names_out())
kw = {k: terms[(tf * idf)[n].argsort()[::-1][:10]].tolist() for n, k in enumerate(keys)}

random.seed(42)
topics = []
for new, t in enumerate(order):
    m = np.flatnonzero(best == t)
    near = m[np.argsort(dist[m])[:3]]
    rest = random.sample([i for i in m.tolist() if i not in set(near.tolist())], min(7, len(m) - len(near)))
    topics.append({
        "id": new, "n": int(len(m)), "share": round(100 * len(m) / len(X), 1),
        "outlets": len({dom[i] for i in m}), "keywords": kw[t], "label": " ".join(w.capitalize() for w in kw[t][:3]),
        "samples": [{"near": bool(j < 3), "outlet": dom[i], "day": day[i], "title": title[i]} for j, i in enumerate(near.tolist() + rest)],
    })
misc = int((best == -1).sum())
OUT.mkdir(exist_ok=True)
(OUT / f"topics-{TAG}.json").write_text(json.dumps({
    "window": [FIRST, LAST], "domains": domains, "in_scope": in_scope, "embedded": len(X), "misc": misc,
    "params": {"over": OVER, "themes": THEMES, "umap_dims": UMAP_DIMS, "outlier_std": OUT_STD, "sample": len(fit), "outlier_dist": thr},
    "seconds": round(time.time() - t0, 1), "topics": topics}, ensure_ascii=False, indent=1))
stamp(f"wrote {len(topics)} topics, misc {misc}")
for tp in topics:
    print(f"{tp['id']:3d} {tp['share']:5.1f}% {tp['n']:6d} {tp['outlets']:2d} {', '.join(tp['keywords'][:6])}")
