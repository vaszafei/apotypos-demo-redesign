import time, numpy as np
from sklearn.cluster import KMeans, MiniBatchKMeans
from sklearn.metrics import adjusted_rand_score as ari
X = np.load("out/X-k36.npy")
def run(seed, full):
    t = time.time()
    km = (KMeans(36, n_init=3, max_iter=100, random_state=seed) if full else MiniBatchKMeans(36, n_init=3, batch_size=4096, max_iter=200, random_state=seed)).fit(X)
    return km.labels_, km.inertia_, time.time() - t
for full in (False, True):
    rs = []
    for s in (1, 2, 3):
        rs.append(run(s, full)); print("full" if full else "mb", s, round(rs[-1][2]), "s", flush=True)
    print("full" if full else "minibatch", "secs", [round(r[2]) for r in rs], "inertia", [round(r[1]) for r in rs],
          "ARI 1-2 %.2f 1-3 %.2f 2-3 %.2f" % (ari(rs[0][0], rs[1][0]), ari(rs[0][0], rs[2][0]), ari(rs[1][0], rs[2][0])))
    if full: np.save("out/full-labels-seed1.npy", rs[0][0])
