"""Draws the cliff and wall textures for the v18 step field: game/art/scene/build/walls.png.

    python3 tools/build-walls.py            # only writes the file if it isn't there yet (keeps your edits)
    python3 tools/build-walls.py --force    # redraws it

A 4 x 3 atlas of 64 px cells; one cell covers 2 m of wall, so a pixel is about 3 cm. Each cell tiles seamlessly.
Pixels are greyscale in five levels (0, 64, 128, 191, 255): the game colours each level through the same ramp as the
props (dark shadow, shadow, base colour, light, highlight) in the wall's own colour, so one drawing serves every biome.
Cells, left to right, top to bottom:
    0 rock (the scene's own default)   1 rock          2 layered sandstone   3 cave rock
    4 brick                            5 dressed stone 6 hedge               7 wooden boards
    8 stone steps (risers)             9 mossy rock   10 concrete           11 dark slate
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'game' / 'art' / 'scene' / 'build' / 'walls.png'
T = 64


def pnoise(rng, cells, size=T):
    """smooth periodic value noise in 0..1"""
    g = rng.random((cells, cells))
    x = np.arange(size) * cells / size
    i0 = np.floor(x).astype(int) % cells
    i1 = (i0 + 1) % cells
    f = x - np.floor(x)
    f = f * f * (3 - 2 * f)
    a = g[i0][:, i0] * (1 - f)[None, :] + g[i0][:, i1] * f[None, :]
    b = g[i1][:, i0] * (1 - f)[None, :] + g[i1][:, i1] * f[None, :]
    return a * (1 - f)[:, None] + b * f[:, None]


def fbm(rng, octaves=((4, .6), (8, .3), (16, .1))):
    return sum(pnoise(rng, c) * w for c, w in octaves)


def voronoi(rng, n, sy=1.0):
    """periodic voronoi: nearest and second-nearest distance, and the cell id"""
    pts = rng.random((n, 2)) * T
    yy, xx = np.mgrid[0:T, 0:T].astype(float)
    d = np.full((n, T, T), 1e9)
    for k, (px, py) in enumerate(pts):
        dx = np.abs(xx - px); dx = np.minimum(dx, T - dx)
        dy = np.abs(yy - py); dy = np.minimum(dy, T - dy)
        d[k] = np.hypot(dx, dy * sy)
    o = np.sort(d, axis=0)
    return o[0], o[1], np.argmin(d, axis=0)


def shade_blocks(ids, edge, base=2):
    """light on the top-left of each block, shadow on the bottom-right, dark cracks between"""
    L = np.full((T, T), base, int)
    up = np.roll(ids, 1, 0) != ids; left = np.roll(ids, 1, 1) != ids
    down = np.roll(ids, -1, 0) != ids; right = np.roll(ids, -1, 1) != ids
    L[up | left] = base + 1
    L[down | right] = base - 1
    L[edge] = 0
    return L


def rock(rng, n=11, base=2, sy=1.25):
    d1, d2, ids = voronoi(rng, n, sy)
    edge = (d2 - d1) < 1.3
    L = shade_blocks(ids, edge, base)
    nz = fbm(rng)
    L[(nz > .68) & (L == base)] = base + 1
    L[(nz < .3) & (L == base)] = base - 1
    # a few chips and pits
    sp = rng.random((T, T))
    L[(sp < .012) & ~edge] = max(0, base - 2)
    return L


def sandstone(rng):
    yy, xx = np.mgrid[0:T, 0:T].astype(float)
    wav = (pnoise(rng, 4) - .5) * 5 + (pnoise(rng, 8) - .5) * 2
    y = (yy + wav) % T
    bands = [0, 7, 15, 20, 30, 37, 46, 52, 59, 64]
    L = np.full((T, T), 2, int)
    for k in range(len(bands) - 1):
        m = (y >= bands[k]) & (y < bands[k + 1])
        L[m] = [2, 3, 2, 1, 3, 2, 3, 2, 2][k % 9]
        top = m & (y < bands[k] + 1)
        L[top] = np.minimum(4, L[top] + 1)
        bot = m & (y >= bands[k + 1] - 1)
        L[bot] = 0 if k % 3 == 0 else 1
    nz = fbm(rng, ((8, .5), (16, .5)))
    L[(nz > .72) & (L >= 2)] += 1
    L[(nz < .25) & (L >= 2)] -= 1
    return np.clip(L, 0, 4)


def brick(rng, bw=16, bh=8, mortar=1, base=2, jitter=True):
    yy, xx = np.mgrid[0:T, 0:T]
    row = yy // bh
    x = (xx + (row % 2) * (bw // 2)) % T
    col = x // bw
    L = np.full((T, T), base, int)
    ids = row * 100 + col
    tone = rng.random((T // bh + 1, T // bw + 1))
    if jitter:
        t = tone[row, col % (T // bw)]
        L += np.where(t < .12, -1, np.where(t > .78, 1, 0))
    L[(yy % bh) == 1] = np.minimum(4, L[(yy % bh) == 1] + 1)  # lit top edge of each brick
    L[(yy % bh) == bh - 2] = np.maximum(1, L[(yy % bh) == bh - 2] - 1)
    L[((yy % bh) == 0) | ((x % bw) == 0)] = mortar
    sp = rng.random((T, T))
    L[(sp > .97) & (L == base)] = base - 1
    return np.clip(L, 0, 4)


def hedge(rng):
    L = np.full((T, T), 1, int)
    for _ in range(140):
        cx, cy, r = rng.integers(0, T), rng.integers(0, T), rng.integers(2, 5)
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if dx * dx + dy * dy <= r * r:
                    v = 3 if (dy < -r / 3 and dx < r / 3) else 2
                    if dy > r / 2: v = 1
                    L[(cy + dy) % T, (cx + dx) % T] = v
    sp = rng.random((T, T))
    L[sp > .985] = 4
    L[sp < .02] = 0
    return L


def boards(rng):
    yy, xx = np.mgrid[0:T, 0:T]
    ph = 8
    row = yy // ph
    L = np.full((T, T), 2, int)
    grain = pnoise(rng, 16)
    g2 = np.sin(xx / T * np.pi * 2 * 3 + grain * 6 + row * 1.7)
    L[g2 > .75] = 3
    L[g2 < -.85] = 1
    L[(yy % ph) == 1] = 3
    L[(yy % ph) == 0] = 0
    # board ends and nails
    for r in range(T // ph):
        e = int(rng.integers(0, T))
        L[r * ph:(r + 1) * ph, e] = 0
        for nx in (e + 3, (e + 35) % T):
            L[r * ph + 3, nx % T] = 4
    return L


def risers(rng):
    """stone stair risers: a lit nosing on top, the face, a dark shadow under the step above"""
    yy, xx = np.mgrid[0:T, 0:T]
    p = 8
    k = yy % p
    L = np.full((T, T), 2, int)
    L[k == 0] = 4
    L[k == 1] = 3
    L[k == p - 1] = 0
    L[k == p - 2] = 1
    # joints between the slabs, offset per course
    row = yy // p
    x = (xx + row * 13) % 24
    L[(x == 0) & (k > 1) & (k < p - 1)] = 1
    nz = fbm(rng, ((8, .5), (16, .5)))
    L[(nz > .75) & (L == 2)] = 3
    return L


def concrete(rng):
    L = np.full((T, T), 2, int)
    nz = fbm(rng, ((8, .4), (16, .4), (32, .2)))
    L[nz > .7] = 3
    L[nz < .28] = 1
    yy, xx = np.mgrid[0:T, 0:T]
    L[(yy % 32) == 0] = 1  # formwork joints
    L[(yy % 32) == 1] = 3
    L[((xx % 32) == 16) & ((yy % 8) == 4)] = 0  # tie holes
    return L


def slate(rng):
    yy, xx = np.mgrid[0:T, 0:T].astype(float)
    wav = (pnoise(rng, 4) - .5) * 3
    y = (yy + wav + xx * .12) % T
    k = (y % 5).astype(int)
    L = np.full((T, T), 1, int)
    L[k == 0] = 3
    L[k == 1] = 2
    L[k == 4] = 0
    d1, d2, ids = voronoi(rng, 7, 2.2)
    L[(d2 - d1) < 1.0] = 0
    nz = fbm(rng, ((16, 1.0),))
    L[(nz > .8) & (L == 2)] = 4
    return L


def mossy(rng):
    L = rock(rng, 10, 2)
    m = fbm(rng)
    yy = np.mgrid[0:T, 0:T][0]
    moss = (m + (1 - yy / T) * .0) > .6
    speck = rng.random((T, T))
    L[moss] = np.where(speck[moss] > .93, 4, 3)
    edge = moss & ~np.roll(moss, 1, 0)
    L[np.roll(edge, 1, 0) & ~moss] = 1  # moss throws a little shadow under its lip
    return L


def build():
    rng = np.random.default_rng(1808)
    cells = [
        rock(rng), rock(rng, 13), sandstone(rng), rock(rng, 9, 1, 1.0),
        brick(rng), brick(rng, 32, 16, 1), hedge(rng), boards(rng),
        risers(rng), mossy(rng), concrete(rng), slate(rng),
    ]
    img = np.zeros((T * 3, T * 4), np.uint8)
    for i, c in enumerate(cells):
        r, k = divmod(i, 4)
        img[r * T:(r + 1) * T, k * T:(k + 1) * T] = np.array([0, 64, 128, 191, 255])[np.clip(c, 0, 4)]
    rgba = np.dstack([img, img, img, np.full_like(img, 255)])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, 'RGBA').save(OUT, optimize=True)
    print('wrote', OUT.relative_to(ROOT))


if __name__ == '__main__':
    if '--force' in sys.argv or not OUT.exists():
        build()
    else:
        print(OUT.relative_to(ROOT), 'is already there; --force redraws it')
