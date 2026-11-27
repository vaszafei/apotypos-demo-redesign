import numpy as np
from sklearn.cluster import KMeans
X = np.load("out/X-k36.npy"); lab = np.load("out/full-labels-seed1.npy")
sub = lab * 10
for t in (5, 25, 33, 35, 0, 14, 11, 21):
    m = np.flatnonzero(lab == t)
    sub[m] = t * 10 + KMeans(3, n_init=5, random_state=1).fit_predict(X[m])
np.save("out/sub-labels.npy", sub)
