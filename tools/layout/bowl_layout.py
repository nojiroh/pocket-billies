"""Two centre-outward bowl layouts for Pocket Billies (session E-map-1). Top-down coordinates in a unit disc.
North is up. Seam exits (east/west/north/south, with suffix numbers) set the compass direction of each road."""
import json, math, collections, sys, os
import numpy as np
from scipy.optimize import minimize

REPO = sys.argv[1]
OUT = sys.argv[2]
L = json.load(open(f'{REPO}/game/data/locations.json'))
ROADS = json.load(open(f'{REPO}/game/data/roads.json'))
ID = [l['id'] for l in L]
IX = {k: i for i, k in enumerate(ID)}
N = len(ID)
DIR = {'east': (1, 0), 'west': (-1, 0), 'north': (0, 1), 'south': (0, -1)}

def exitdir(e):
    return np.array(DIR[e.rstrip('0123456789')], float)

seams, lifts = [], []
for r in ROADS:
    a, b = IX[r['a']['map']], IX[r['b']['map']]
    if r['kind'] == 'seam':
        d = exitdir(r['a']['exit']) - exitdir(r['b']['exit'])  # A's exit points to B; B's exit points back to A
        seams.append((a, b, d / np.linalg.norm(d), r))
    else:
        lifts.append((a, b, r))
SUB = {b for a, b, _ in lifts if L[b].get('noFly')}  # Pearlantis: drawn under its parent, not placed
SUB_PARENT = {b: a for a, b, _ in lifts if b in SUB}

# ---- progression stage: badges in order; a gated place needs that badge; a ride place needs Surf (after badge 3)
GATE_ORDER = {'oil': 1, 'retail': 2, 'haven': 3, 'peak': 4, 'bloom': 5, 'vault': 6, 'morel': 7, 'carat': 8}
def need(i):
    l = L[i]
    s = GATE_ORDER.get(l.get('gate'), 0)
    if l.get('ride'):
        s = max(s, 3)
    return s
adj = collections.defaultdict(list)
for a, b, _, _ in seams:
    adj[a].append(b); adj[b].append(a)
for a, b, _ in lifts:
    adj[a].append(b); adj[b].append(a)
start = IX['copperleaf']
# stage = minimal over paths of the max requirement; hops = BFS hops inside that stage
import heapq
stage = [math.inf] * N; hops = [math.inf] * N
stage[start] = 0; hops[start] = 0
pq = [(0, 0, start)]
while pq:
    s, h, u = heapq.heappop(pq)
    if (s, h) > (stage[u], hops[u]):
        continue
    for v in adj[u]:
        s2 = max(s, need(v)); h2 = h + 1
        if (s2, h2) < (stage[v], hops[v]):
            stage[v], hops[v] = s2, h2
            heapq.heappush(pq, (s2, h2, v))
# the post-badge regions: order by BFS hops from the first carat-stage place
order = sorted(range(N), key=lambda i: (stage[i], hops[i]))
rank = {i: k for k, i in enumerate(order)}

PLACED = [i for i in range(N) if i not in SUB]
P = len(PLACED)
PX = {i: k for k, i in enumerate(PLACED)}
S = [(PX[a], PX[b], d) for a, b, d, _ in seams]
SA = np.array([a for a, _, _ in S]); SB = np.array([b for _, b, _ in S]); SD = np.array([d for _, _, d in S])
L0 = 0.17
PROPOSED = [('driftwreck', 'conchshell'), ('cinderpeak', 'bellwether_rise'), ('petalfall', 'russetwood'),
            ('frostcrown', 'rimefrost'), ('mirrormere', 'skygarden')]
PA = np.array([PX[IX[a]] for a, _ in PROPOSED]); PB = np.array([PX[IX[b]] for _, b in PROPOSED])
USE_PROP = [False]
FRAME = [-1.0]
PIN = [start]

def energy(flat, target_r, target_a, w_r, w_a):
    X = flat.reshape(-1, 2)
    E = 0.0
    # 1 seam direction (local frame at the road's midpoint) and length
    e = X[SB] - X[SA]
    n = np.sqrt((e ** 2).sum(1) + 1e-9)
    m = 0.5 * (X[SA] + X[SB])
    rm = np.sqrt((m ** 2).sum(1)) + 1e-6
    nor = FRAME[0] * m / rm[:, None]                   # -1: north faces the centre; +1: north is up the wall
    eas = np.stack([nor[:, 1], -nor[:, 0]], 1)        # local east = counter-clockwise seen from above
    dw = SD[:, 0:1] * eas + SD[:, 1:2] * nor
    E += (10.0 * (1 + 2.0 * (rm < 0.25)) * (1 - (e * dw).sum(1) / n)).sum()
    E += 4.0 * ((n - L0) ** 2).sum()
    # 2 spread: no two places closer than 0.085
    diff = X[:, None, :] - X[None, :, :]
    dist = np.sqrt((diff ** 2).sum(-1) + 1e-9)
    iu = np.triu_indices(P, 1)
    dd = dist[iu]
    E += 3.0 * (np.clip(0.125 - dd, 0, None) ** 2).sum() * 400
    # 3 stay inside the bowl
    r = np.sqrt((X ** 2).sum(1))
    E += 50 * (np.clip(r - 1.0, 0, None) ** 2).sum()
    # 4 variant targets
    if w_r:
        E += w_r * ((r - target_r) ** 2).sum()
    if w_a:
        ang = np.arctan2(X[:, 1], X[:, 0])
        da = np.angle(np.exp(1j * (ang - target_a)))
        E += w_a * (np.minimum(r, 0.5) * da ** 2).sum()
    # 4b proposed cross-region links (natural variant only): soft pull, no direction
    if USE_PROP[0]:
        pe = X[PB] - X[PA]
        pn = np.sqrt((pe ** 2).sum(1) + 1e-9)
        E += 2.0 * (np.clip(pn - 0.2, 0, None) ** 2).sum()
    # 5 Copperleaf pinned at the centre
    E += 200 * (X[PX[PIN[0]]] ** 2).sum()
    return E

def solve(init, target_r, target_a, w_r, w_a, seed):
    rng = np.random.default_rng(seed)
    x0 = init + rng.normal(0, 0.01, init.shape)
    res = minimize(energy, x0.ravel(), args=(target_r, target_a, w_r, w_a), method='L-BFGS-B',
                   options={'maxiter': 4000, 'maxfun': 400000})
    return res.x.reshape(-1, 2), res.fun

maxstage = max(stage[i] for i in PLACED if stage[i] < math.inf)
# ---- variant A: gate spiral. Radius by progression rank; the spiral winds once and a bit.
tr_A = np.array([0.1 + 0.86 * (rank[i] / (N - 1)) ** 0.8 for i in PLACED])
ta_A = np.array([-math.pi / 2 + 2 * math.pi * 1.0 * rank[i] / (N - 1) for i in PLACED])  # starts south, turns clockwise
init_A = np.stack([tr_A * np.cos(ta_A), tr_A * np.sin(ta_A)], 1)
# ---- variant B: today's order. Angle from today's longitude, radius from hops away from Copperleaf.
lon = np.array([L[i]['lon'] for i in PLACED])
ta_B = np.radians(-90 - (lon - lon.min()) / (lon.max() - lon.min()) * 330)  # from south, clockwise round the bowl
h = collections.deque([start]); hop = {start: 0}
while h:
    u = h.popleft()
    for v in adj[u]:
        if v not in hop:
            hop[v] = hop[u] + 1; h.append(v)
mh = max(hop.values())
lat = np.array([L[i]['lat'] for i in PLACED])
tr_B = np.clip(0.14 + 0.78 * (lon - lon.min()) / (lon.max() - lon.min()) - 0.12 * lat / 60, 0.08, 0.97)
ta_B = np.radians(-90 + (lon - L[start]['lon']) * 1.0)
init_B = np.stack([tr_B * np.cos(ta_B), tr_B * np.sin(ta_B)], 1)

ELEV = {'sea': .05, 'pond': .05, 'lake': .08, 'island': .08, 'trench': .1, 'town': .3, 'grass': .3, 'golf': .3,
        'farm': .32, 'food': .35, 'mall': .35, 'city': .38, 'bins': .38, 'thicket': .35, 'grotto': .3, 'feedl': .42,
        'spore': .5, 'vault': .55, 'canyon': .55, 'silicon': .6, 'ridge': .75, 'volcano': .78, 'pass': .8,
        'summit': .92, 'spire': .95, 'sun': 1.0}
prog = np.array([rank[i] / (N - 1) for i in PLACED])
elev = np.array([ELEV[L[i]['t']] for i in PLACED])
tr_N = np.clip(0.1 + 0.85 * (0.55 * prog + 0.45 * elev), 0.08, 0.96)
ta_N = np.radians(90 - (lon - L[start]['lon']) * 1.0)
init_N = np.stack([tr_N * np.cos(ta_N), tr_N * np.sin(ta_N)], 1)
out = {}
for name, init, tr, ta, wr, wa in [v for v in [('A', init_A, tr_A, ta_A, float(os.environ.get('WR_A', 3.0)), float(os.environ.get('WA_A', 0.6))), ('B', init_B, tr_B, ta_B, 1.5, 1.5), ('N', init_N, tr_N, ta_N, 2.0, 0.6)] if v[0] in os.environ.get('ONLY', 'AB')]:
    USE_PROP[0] = name == 'N'
    FRAME[0] = 1.0 if name == 'N' else -1.0
    PIN[0] = IX['marigold'] if name == 'N' else start
    best = None
    for seed in range(4):
        X, f = solve(init, tr, ta, wr, wa, seed)
        if best is None or f < best[1]:
            best = (X, f)
    X = best[0]
    X -= X[PX[PIN[0]]]
    X /= max(1.0, np.sqrt((X ** 2).sum(1)).max() / 0.96)
    pos = {ID[i]: [round(float(X[PX[i]][0]), 4), round(float(X[PX[i]][1]), 4)] for i in PLACED}
    frames_done = True
    for c, p in SUB_PARENT.items():
        pos[ID[c]] = pos[ID[p]]
    out[name] = pos
json.dump({'frame': {'B': -1, 'N': 1}, 'proposed': PROPOSED, 'layouts': out, 'stage': {ID[i]: (None if stage[i] == math.inf else stage[i]) for i in range(N)},
           'sub': {ID[c]: ID[p] for c, p in SUB_PARENT.items()}}, open(OUT, 'w'), indent=1)
print('ok', {k: len(v) for k, v in out.items()})
