#!/usr/bin/env python3
"""Phase 09, batch 1: the first ten props in the new style, and the test map that shows them next to the old ones.

The new style: low-poly models at 32 px to the metre, painted with the building sheet's textures (the airship's look),
and, where a drawing reads better than a model, drawn parts kept flat inside the model: a tree is a modelled trunk and
branches with its leaf clumps cut from its old picture, each clump a picture that faces the camera, sways in the wind
and casts its cut-out shadow. Props that stay flat (tall grass) are only redrawn at 32 px to the metre.

    python3 tools/build-props-batch1.py        # writes everything below; run it again after changing it

Writes
  game/art/scene/next/leaves/*.png        each tree's and bush's leaves as one picture, its crown as drawn (and the
                                          autumn oak's, recoloured); the clumps are circles cut from it at run time
  game/art/scene/next/decals/*.png        flat parts set on models: the cottage's door and windows, the washing,
                                          the lantern's glass, the roses' flowers
  game/art/scene/next/models/*.json       the recipes (prop-models.js reads them)
  game/art/scene/build/detail-a04b.png    two more textures on the building sheet: bark (cell 22), rock (cell 23)
  game/data/scenery.json                  the new props, keyed next_* (the old props are not touched)
  game/data/maps/test_props_next.json     the test map: each prop old (left) and new (right); in the game's debug
                                          menu under Test scenes, or game/index.html?test=1&scene=test_props_next

Nothing on a route changes: the old props stay as they are until the batch is approved and swapped in.
"""
import json, math, sys
from collections import Counter, deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import gamedata  # noqa: E402

ART = ROOT / 'game' / 'art'
PROPS = ART / 'scene' / 'props'
NEXT = ART / 'scene' / 'next'
PPM = 32  # the new style's scale: pixels to the metre


def rel(p):
    return str(Path(p).relative_to(ART)).replace('\\', '/')


def rgba(path):
    return np.array(Image.open(path).convert('RGBA'))


def save_png(a, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(a.astype(np.uint8), 'RGBA').save(path, optimize=True)
    return rel(path)


def hexc(c):
    return '#%02X%02X%02X' % tuple(int(v) for v in c[:3])


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def r2(v):
    return round(float(v), 3)


# ---------------------------------------------------------------- the building sheet: bark and rock
def tile_noise(seed, n=64):
    rng = np.random.default_rng(seed)
    return rng.random((n, n))


def paint_textures():
    """Cells 22 and 23 of the building sheet (8 x 3 cells of 64 px, 2 m each): the red channel holds the tone step,
    0, 63, 126 (the colour itself), 189, 252. Both tile seamlessly."""
    path = ART / 'scene' / 'build' / 'detail-a04b.png'
    im = np.array(Image.open(path).convert('RGBA'))
    N = 64
    # bark: fissures up the trunk (u is round the trunk, v up it), wavy, with ridges lit beside them
    bark = np.full((N, N), 126, np.uint8)
    rng = np.random.default_rng(22)
    for f in range(9):
        x0 = (f * 7.1 + rng.random() * 3) % N
        ph, amp, ln0, ln1 = rng.random() * 6.28, 0.8 + rng.random() * 1.2, rng.integers(0, N), rng.integers(18, 50)
        for i in range(ln1):
            y = (ln0 + i) % N
            x = int(round(x0 + amp * math.sin(y / 9 + ph))) % N
            bark[y, x] = 63
            if i % 3 != 1: bark[y, (x + 1) % N] = 63 if i % 5 == 0 else 189
            if i % 11 == 4: bark[y, (x - 1) % N] = 0
    for _ in range(40):
        y, x = rng.integers(0, N, 2); bark[y, x] = 189
    # rock: soft blotches of the step above and below, a few cracks
    rock = np.full((N, N), 126, np.uint8)
    nz = tile_noise(23)
    b = np.zeros((N, N))
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            if dx * dx + dy * dy <= 9: b += np.roll(np.roll(nz, dy, 0), dx, 1)
    b = (b - b.mean()) / b.std()
    rock[b > 1.1] = 189
    rock[b < -1.2] = 63
    rng = np.random.default_rng(230)
    for c in range(5):
        y, x = rng.integers(0, N, 2)
        for i in range(rng.integers(6, 14)):
            rock[y % N, x % N] = 0
            x += rng.integers(-1, 2); y += 1 if rng.random() < .6 else 0; x += 1
    for cell, t in ((22, bark), (23, rock)):
        r, c = divmod(cell, 8)
        blk = im[r * N:(r + 1) * N, c * N:(c + 1) * N]
        blk[..., 0] = blk[..., 1] = blk[..., 2] = t; blk[..., 3] = 255
    Image.fromarray(im, 'RGBA').save(path, optimize=True)


# ---------------------------------------------------------------- cutting pictures into clumps
def split_trunk(a):
    """A tree picture's trunk (the colours of its bottom rows, flood-filled up from the ground) and its canopy (the rest)."""
    H, W = a.shape[:2]
    op = a[..., 3] > 0
    key = lambda y, x: tuple(a[y, x, :3])
    pal = {key(y, x) for y in range(H - 10, H) for x in range(W) if op[y, x]}
    trunk = np.zeros((H, W), bool)
    q = deque((H - 1, x) for x in range(W) if op[H - 1, x])
    for y, x in q: trunk[y, x] = True
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < H and 0 <= xx < W and not trunk[yy, xx] and op[yy, xx] and key(yy, xx) in pal:
                trunk[yy, xx] = True; q.append((yy, xx))
    canopy = op & ~trunk
    # loose bits (fallen leaves, a stray pixel) are not leaves of the crown
    seen = np.zeros_like(canopy)
    for y0, x0 in zip(*np.nonzero(canopy)):
        if seen[y0, x0]: continue
        comp, q = [], deque([(y0, x0)]); seen[y0, x0] = True
        while q:
            y, x = q.popleft(); comp.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and canopy[yy, xx] and not seen[yy, xx]:
                    seen[yy, xx] = True; q.append((yy, xx))
        if len(comp) < 30:
            for y, x in comp: canopy[y, x] = False
    return trunk, canopy


def kmeans(P, k, iters=30):
    """Deterministic k-means on pixel positions: started from the topmost pixel, then the farthest from those picked."""
    C = [P[np.argmin(P[:, 0])]]
    for _ in range(k - 1):
        d = np.min(((P[:, None, :] - np.array(C)[None]) ** 2).sum(-1), 1)
        C.append(P[np.argmax(d)])
    C = np.array(C, float)
    for _ in range(iters):
        lab = np.argmin(((P[:, None, :] - C[None]) ** 2).sum(-1), 1)
        for i in range(k):
            if (lab == i).any(): C[i] = P[lab == i].mean(0)
    return C, lab


def recolour(arr, src_cols, dst_cols):
    """Map one picture's colours onto another's by brightness rank (a green crown into the autumn oak's oranges)."""
    s = sorted(src_cols, key=lum); d = sorted(dst_cols, key=lum)
    M = {c: d[min(len(d) - 1, int(round(i / max(1, len(s) - 1) * (len(d) - 1))))] for i, c in enumerate(s)}
    o = arr.copy()
    for y, x in np.argwhere(arr[..., 3] > 0):
        c = tuple(arr[y, x, :3])
        if c in M: o[y, x, :3] = M[c]
    return o


def leaf_colours(a, mask, n=6):
    return [c for c, k in Counter(tuple(a[y, x, :3]) for y, x in np.argwhere(mask)).most_common() if k > n]


# ---------------------------------------------------------------- trees: a modelled trunk, drawn leaves
TREES = {
    # key: picture, clumps, the trunk's limbs in the picture's pixels ((x, y) -> (x, y), width at each end)
    'beech': ('tree_beech', 8, [((90, 159), (89.5, 112), 26, 18), ((88, 113), (67, 74), 14, 7), ((92, 113), (98, 76), 11, 6)]),
    'oak': ('tree_oak', 8, [((76, 160), (75.5, 100), 22, 18), ((75, 102), (64, 70), 10, 5), ((77, 102), (92, 66), 10, 5)]),
    'oak_b': ('tree_oak_b', 8, [((93, 141), (93, 88), 20, 16), ((90, 90), (74, 70), 12, 6), ((96, 90), (104, 70), 11, 6)]),
    'oak_small': ('tree_oak_small', 4, [((47, 103), (46.5, 66), 10, 7), ((46, 70), (44, 48), 5, 3)]),
}


def trace(trunk, a, b, w0, w1):
    """The centre line of a drawn trunk or limb from a to b (the picture's pixels, a below b): row by row, the drawn
    part nearest where the straight line would be, so the drawing's own lean, curve and taper come through.
    Returns [(x, y, width)] about every 6 rows."""
    H, W = trunk.shape
    (xa, ya), (xb, yb) = a, b
    out, prev = [], xa
    n = max(2, int(abs(ya - yb) // 6))
    for i in range(n + 1):
        t = i / n
        y = int(round(ya + (yb - ya) * t))
        want = xa + (xb - xa) * t
        xs = np.nonzero(trunk[min(H - 1, max(0, y))])[0]
        segs, cur = [], []
        for x in xs:
            if cur and x != cur[-1] + 1: segs.append(cur); cur = []
            cur.append(x)
        if cur: segs.append(cur)
        best = min(segs, key=lambda g: abs((g[0] + g[-1]) / 2 - (0.5 * want + 0.5 * prev)), default=None)
        guess = w0 + (w1 - w0) * t
        if best and abs((best[0] + best[-1]) / 2 - want) < 10 and len(best) < guess * 1.8:
            cx, w = (best[0] + best[-1]) / 2, len(best)
            w = min(max(w, guess * 0.7), guess * 1.3)
        else:
            cx, w = want, guess
        prev = cx
        out.append((cx, y, w))
    return out


def tree_recipe(key, pic, k, limbs, leaves_dir, seed, stems=False):
    """A tree (or, with no limbs, a bush): the trunk and limbs traced from the drawing and bent a little in depth,
    roots splaying into the ground, branches curving up to the leaf clumps; the leaves are one picture, the crown as
    drawn (game/art/scene/next/leaves/<key>.png), and each clump is a circle cut from it at run time. stems: a shrub
    of several stems from the ground (a hazel), each limb its own stem, with no trunk and no roots."""
    a = rgba(PROPS / f'{pic}.png')
    H, W = a.shape[:2]
    if limbs:
        trunk, canopy = split_trunk(a)
    else:  # a bush: all leaves, no trunk
        canopy = a[..., 3] > 0; trunk = np.zeros_like(canopy)
    ax, by = W / 2, H - 1  # the prop's anchor: bottom middle
    X = lambda x: r2((x - ax) / PPM)
    Z = lambda y: r2((by - y) / PPM)
    rng = np.random.default_rng(seed)
    tc = Counter(tuple(a[y, x, :3]) for y, x in np.argwhere(trunk)).most_common()
    bark = hexc(sorted([c for c, n in tc[:4]], key=lum)[len(tc[:4]) // 2]) if tc else '#7A5236'
    # the crown as one picture, and where its clumps are
    ys, xs = np.nonzero(canopy)
    sx0, sy0 = xs.min(), ys.min()
    sheet = np.zeros_like(a); sheet[canopy] = a[canopy]
    sheet = sheet[sy0:ys.max() + 1, sx0:xs.max() + 1]
    sheet_path = save_png(sheet, leaves_dir / f'{key}.png')
    P = np.argwhere(canopy).astype(float)
    C, lab = kmeans(P, k) if k else (None, None)
    clumps = []
    for i in range(k):
        Q = P[lab == i]
        if len(Q) < 20: continue
        cy, cx = Q.mean(0)
        d = np.hypot(Q[:, 0] - cy, Q[:, 1] - cx)
        r = float(np.percentile(d, 94) + 6)
        clumps.append({'cx': cx - sx0, 'cy': cy - sy0, 'r': r, 'n': len(Q)})
    Rc = (xs.max() - xs.min() + 1) / 2 / PPM
    L = []
    tops = []
    if limbs:
        for li, ((x0, y0), (x1, y1), w0, w1) in enumerate(limbs):
            path = trace(trunk, (x0, y0), (x1, y1), w0, w1)
            depth = (0.05 if li == 0 else 0.16) * (1 if rng.random() < 0.5 else -1)
            if stems:  # each stem leans a little out in depth too, fanning like a coppiced shrub
                depth = (li - (len(limbs) - 1) / 2) * 0.08 + (rng.random() - 0.5) * 0.06
            pts = []
            for i, (x, y, w) in enumerate(path):
                t = i / (len(path) - 1)
                pts.append([X(x), r2(math.sin(t * math.pi) * depth + (0 if li == 0 else depth * t)), Z(y), r2(w / 2 / PPM)])
            if stems:  # a stem from the ground, thinning up into the leaves
                pts[0][1] = 0
                (xa, ya, za, _), (xb, yb, zb, rb) = pts[-2], pts[-1]
                pts.append([r2(xb + (xb - xa) * 1.4), r2(yb + (yb - ya) * 1.4), r2(zb + (zb - za) * 1.4), r2(rb * 0.55)])
            elif li == 0:  # the foot: wider at the ground, as a trunk flares into its roots
                pts[0][3] = r2(pts[0][3] * 1.35)
                if len(pts) > 2: pts[1][3] = r2(pts[1][3] * 1.1)
                # the top: no wider than below it (where the arms part, the drawing is both arms wide), then it
                # narrows on up into the crown, so the arms grow out of it instead of out of a cut stump
                for q, qb in zip(pts[2:], pts[1:]):
                    q[3] = min(q[3], qb[3])
                tx_, ty_, tz_, tr_ = pts[-1]
                pts.append([tx_, ty_, r2(tz_ + 0.35), r2(tr_ * 0.45)])
                top0 = (tx_, ty_, tz_, tr_)
            else:  # an arm starts inside the trunk's top and goes on into the crown, thinning
                pts[0] = [r2(top0[0] + (pts[0][0] - top0[0]) * 0.3), top0[1], r2(top0[2] - 0.3), r2(max(pts[0][3], top0[3] * 0.7))]
                (xa, ya, za, _), (xb, yb, zb, rb) = pts[-2], pts[-1]
                pts.append([r2(xb + (xb - xa) * 1.6), r2(yb + (yb - ya) * 1.6), r2(zb + (zb - za) * 1.6), r2(rb * 0.55)])
            L.append({'k': 'limb', 'pts': pts, 'sides': 7 if li == 0 and not stems else 6, 'col': bark, 'tex': 'bark',
                      'name': 'stem' if stems else 'trunk' if li == 0 else 'limb'})
            tops += [(q[0], q[1], q[2]) for q in pts[len(pts) // 2:]]
        # roots: a few, splaying out from the foot and down into the ground
        foot = L[0]['pts'][0]
        fr = foot[3]
        for i in range(0 if stems else 5):
            an = (i / 5) * 2 * math.pi + rng.random() * 0.6
            ca, sa = math.cos(an), math.sin(an)
            L.append({'k': 'limb', 'pts': [[r2(foot[0] + ca * fr * 0.3), r2(sa * fr * 0.3), r2(fr * 1.1), r2(fr * 0.42)],
                                           [r2(foot[0] + ca * fr * 0.95), r2(sa * fr * 0.95), r2(fr * 0.32), r2(fr * 0.3)],
                                           [r2(foot[0] + ca * fr * 1.7), r2(sa * fr * 1.7), -0.03, r2(fr * 0.12)]],
                      'sides': 5, 'col': bark, 'tex': 'bark', 'name': 'root'})
    # the crown's core: the whole picture a shade darker, behind the clumps; it casts the crown's shadow
    # (k = 0: no clumps, the crown is the picture itself, whole and unshaded: a conifer's tiers)
    L.append({'k': 'img', 'img': sheet_path, 'shade': 0.78 if k else 1, 'x': X(sx0 + sheet.shape[1] / 2), 'y': r2(Rc * 0.3 if k else 0),
              'z': Z(sy0 + sheet.shape[0] - 1), 'shadow': 1, 'recv': 0, 'sway': 0.7 if k else 0.8, 'name': 'crown core' if k else 'crown'})
    order = sorted(range(len(clumps)), key=lambda i: -clumps[i]['n'])
    big = W > 120
    for rank, i in enumerate(order):
        c = clumps[i]
        R = max(1, math.ceil(c['r']))
        xm = (sx0 + round(c['cx']) - ax) / PPM
        xn = max(-1, min(1, xm / max(Rc, .1)))
        side = -1 if rank % 2 == 0 else 1  # toward the camera is -y
        d = side * math.sqrt(max(0, 1 - xn * xn)) * Rc * (0.22 + 0.1 * rng.random())
        if rank == 0: d = -Rc * 0.32
        zb = (by - (sy0 + round(c['cy']) + R - 1)) / PPM
        L.append({'k': 'img', 'img': sheet_path, 'clip': [round(c['cx'], 1), round(c['cy'], 1), round(c['r'], 1)],
                  'x': r2(xm), 'y': r2(d), 'z': r2(zb), 'recv': 0, 'sway': 1, 'name': f'leaves {rank + 1}'})
        # a branch out to it from the nearest point on a limb, curving up, hidden in the crown until the camera turns
        if not tops: continue
        tz_ = zb + R / PPM * 0.5
        sx, sy, sz = min(tops, key=lambda t: (t[0] - xm) ** 2 + (t[2] - tz_) ** 2)
        ex, ey, ez = xm * 0.85, d * 0.7, tz_
        mx, my, mz = sx + (ex - sx) * 0.55, sy + (ey - sy) * 0.55, sz + (ez - sz) * 0.35 + 0.12
        r0 = (0.08 if big else 0.045) * max(1, W / 200)
        L.append({'k': 'limb', 'pts': [[r2(sx), r2(sy), r2(sz - 0.1), r0], [r2(mx), r2(my), r2(mz), r2(r0 * 0.65)], [r2(ex), r2(ey), r2(ez), r2(r0 * 0.35)]],
                  'sides': 5, 'col': bark, 'tex': 'bark', 'name': 'branch'})
    # the solid parts first, then the leaves (drawn after, as sprites)
    L.sort(key=lambda l: l['k'] == 'img')
    return {'ppm': PPM, 'cel': 0.75, 'layers': L}, sheet_path, sheet, canopy


# ---------------------------------------------------------------- the great oak with the swing (Copperleaf Town)
GIANT_LIMBS = [((192, 396), (190, 232), 50, 44), ((172, 236), (140, 205), 26, 18), ((190, 236), (188, 195), 24, 16),
               ((210, 236), (232, 205), 28, 16)]


def giant_recipe(leaves_dir):
    """The great oak in Copperleaf: a tree like the others, bigger (16 clumps), with its knot hole on the trunk and
    the swing modelled: a branch reaching out to the left, two ropes and a seat that swing to and fro together."""
    rec, sheet_path, sheet, canopy = tree_recipe('giant', 'tree_giant', 16, GIANT_LIMBS, leaves_dir, 300)
    P, ax, by = 'tree_giant', 191, 396
    X = lambda x: r2((x - ax) / PPM)
    Z = lambda y: r2((by - y) / PPM)
    bark = next(l['col'] for l in rec['layers'] if l['k'] == 'limb')
    sw = rgba(PROPS / 'layers' / 'tree_giant_swing.png')
    sc = Counter(tuple(sw[y, x, :3]) for y in range(378, 385) for x in range(72, 121) if sw[y, x, 3]).most_common()
    rc = Counter(tuple(sw[y, x, :3]) for y in range(260, 370) for x in (78, 79, 114, 115) if sw[y, x, 3]).most_common()
    seat_col = hexc(sorted([c for c, n in sc[:3]], key=lum)[len(sc[:3]) // 2])
    rope_col = hexc(max((c for c, n in rc[:3]), key=lum))
    L = rec['layers']
    # the swing's branch, out of the trunk to the left, a little toward the camera so the swing hangs in the open
    branch = [[X(186), 0, Z(246), 0.2], [X(150), -0.25, Z(236), 0.16], [X(105), -0.45, Z(222), 0.11], [X(58), -0.55, Z(205), 0.06]]
    L.insert(0, {'k': 'limb', 'pts': [[a, b, c, d] for a, b, c, d in branch], 'sides': 6, 'col': bark, 'tex': 'bark', 'name': 'swing branch'})
    def branch_z(x):
        for (x0, y0, z0, _), (x1, y1, z1, _) in zip(branch, branch[1:]):
            if x1 <= x <= x0: t = (x - x0) / (x1 - x0); return z0 + (z1 - z0) * t, y0 + (y1 - y0) * t
        return branch[-1][2], branch[-1][1]
    seat_z = Z(381)
    xa, xb = X(78.5), X(114.5)
    (za, ya), (zb, yb) = branch_z(xa), branch_z(xb)
    yy = (ya + yb) / 2
    pivot = {'axis': 'x', 'x': r2((xa + xb) / 2), 'y': r2(yy), 'z': r2((za + zb) / 2 - 0.08), 'rps': 0.22, 'swing': 0.2}
    for x, z in ((xa, za), (xb, zb)):
        L.insert(0, {'k': 'limb', 'x': x, 'y': r2(yy), 'z': r2(z - 0.05), 'x2': x, 'y2': r2(yy), 'z2': r2(seat_z + 0.06),
                     'r': 0.018, 'r1': 0.018, 'sides': 4, 'col': rope_col, 'tex': 'cloth', 'name': 'rope', 'spin': dict(pivot)})
    L.insert(0, box((xa + xb) / 2, yy, seat_z, (xb - xa) + 0.35, 0.32, 0.07, seat_col, 'wood', 'seat') | {'spin': dict(pivot)})
    # the knot hole, a picture on the trunk's front
    tr = rgba(PROPS / f'{P}.png')
    tc = [c for c, n in Counter(tuple(tr[y, x, :3]) for y in range(300, 360) for x in range(170, 210) if tr[y, x, 3]).most_common(6)]
    kx0, ky0, kx1, ky1 = 186, 284, 208, 312
    knot = decal(P, (kx0, ky0, kx1, ky1), 'giant_knot', clear=tuple(hexc(c) for c in tc))
    trunk_r = next(l for l in L if l.get('name') == 'trunk')['pts'][4][3]
    kx, kz = at(P, (kx0 + kx1) / 2, ky1 - 1)
    L.append(img(knot, kx, -(trunk_r + 0.12), kz, face='fixed', name='knot hole'))
    return rec


# ---------------------------------------------------------------- flat parts set on models
def decal(pic, box, name, clear=()):
    """A part of an old picture (x0, y0, x1, y1 in its pixels, end excluded) as its own picture; the colours in clear
    (the wall behind a window) become see-through, so the model's own wall shows round it."""
    a = rgba(PROPS / f'{pic}.png')
    x0, y0, x1, y1 = box
    c = a[y0:y1, x0:x1].copy()
    for h in clear:
        rgb = [int(h[i:i + 2], 16) for i in (1, 3, 5)]
        c[(c[..., 0] == rgb[0]) & (c[..., 1] == rgb[1]) & (c[..., 2] == rgb[2]), 3] = 0
    return save_png(c, NEXT / 'decals' / f'{name}.png')


def at(pic, x, y):
    """A pixel of an old picture as metres from its anchor (bottom middle) at 32 px to the metre: (x across, z up)."""
    W, H = Image.open(PROPS / f'{pic}.png').size
    return r2((x - W / 2) / PPM), r2((H - 1 - y) / PPM)


def box(x, y, z, w, d, h, col, tex='plain', name=''):
    return {'k': 'box', 'x': r2(x), 'y': r2(y), 'z': r2(z), 'w': r2(w), 'd': r2(d), 'h': r2(h), 'col': col, 'tex': tex, 'name': name}


def limb(a, b, r, r1, col, tex='wood', name='', sides=None):
    L = {'k': 'limb', 'x': r2(a[0]), 'y': r2(a[1]), 'z': r2(a[2]), 'x2': r2(b[0]), 'y2': r2(b[1]), 'z2': r2(b[2]),
         'r': r2(r), 'r1': r2(r1), 'col': col, 'tex': tex, 'name': name}
    if sides: L['sides'] = sides
    return L


def img(path, x, y, z, **kw):
    return {'k': 'img', 'img': path, 'x': r2(x), 'y': r2(y), 'z': r2(z), **kw}


# ---------------------------------------------------------------- rocks: faceted stones
ROCK, ROCK_MOSS, MOSS = '#8E7F88', '#8C879A', '#8FB866'
STONES = {
    'rocks': [(-0.45, 0.05, 0.4, 0.55), (0.15, -0.08, 0.3, 0.42), (0.58, 0.12, 0.22, 0.3)],
    'rocks_b': [(-0.55, 0.1, 0.3, 0.42), (-0.05, -0.1, 0.36, 0.5), (0.45, 0.05, 0.28, 0.4), (0.15, 0.32, 0.22, 0.3)],
    'rocks_c': [(-0.62, 0.0, 0.34, 0.48), (0.05, 0.08, 0.42, 0.6), (0.7, -0.05, 0.25, 0.32)],
}


def rocks_recipe(key, moss=False):
    L, rng = [], np.random.default_rng(len(key) * 7 + moss)
    st = STONES[key]
    k = 1.2  # the old pictures' size
    for i, (x, y, r, h) in enumerate((x * k, y * k, r * k, h * k) for x, y, r, h in st):
        L.append({'k': 'sphere', 'x': x, 'y': y, 'z': -h * 0.18, 'r': r, 'ry': r2(r * (0.8 + 0.2 * rng.random())), 'h': h,
                  'sides': 7, 'rings': 4, 'lump': 0.35, 'facet': 1, 'col': ROCK_MOSS if moss else ROCK, 'tex': 'rock', 'name': f'stone {i + 1}'})
        if moss:
            L.append({'k': 'dome', 'x': r2(x - r * 0.1), 'y': r2(y - r * 0.05), 'z': r2(h * 0.82 - h * 0.18 - 0.1), 'r': r2(r * 0.7), 'ry': r2(r * 0.6),
                      'h': 0.14, 'sides': 8, 'rings': 2, 'lump': 0.3, 'facet': 1, 'col': MOSS, 'tex': 'leaves', 'name': f'moss {i + 1}'})
    if key == 'rocks_c':  # pebbles
        for i in range(6):
            a = rng.random() * 6.28
            L.append({'k': 'sphere', 'x': r2(math.cos(a) * 0.9), 'y': r2(math.sin(a) * 0.45 - 0.2), 'z': -0.02, 'r': 0.07, 'h': 0.08,
                      'sides': 5, 'rings': 2, 'facet': 1, 'col': ROCK, 'tex': 'rock', 'name': 'pebble'})
    return {'ppm': PPM, 'cel': 0.8, 'layers': L}


# ---------------------------------------------------------------- mushrooms: stems, domed caps, spots
CAP, SPOT, STEM = '#DE4048', '#F9EAC0', '#E9DDC8'


def mushrooms_recipe():
    L = []
    for i, (x, y, h, r, cr) in enumerate([(-0.24, 0.02, 0.42, 0.085, 0.3), (0.2, -0.12, 0.3, 0.07, 0.22), (0.42, 0.14, 0.18, 0.05, 0.15)]):
        L.append({'k': 'cyl', 'x': x, 'y': y, 'z': 0, 'r': r, 'h': h, 'sides': 7, 'col': STEM, 'tex': 'plain', 'name': f'stem {i + 1}'})
        z0, ch = h - 0.03, cr * 0.75
        L.append({'k': 'dome', 'x': x, 'y': y, 'z': r2(z0), 'r': cr, 'h': r2(ch), 'sides': 10, 'rings': 4, 'col': CAP, 'tex': 'plain', 'name': f'cap {i + 1}'})
        for j, (f, a) in enumerate([(0.55, -1.2), (0.6, -2.3), (0.2, -1.8), (0.7, -0.3)][:4 - i]):
            sx, sy = x + math.cos(a) * f * cr, y + math.sin(a) * f * cr
            sz = z0 + ch * math.sqrt(max(0, 1 - f * f))
            L.append({'k': 'sphere', 'x': r2(sx), 'y': r2(sy), 'z': r2(sz - 0.02), 'r': r2(cr * 0.16), 'h': r2(cr * 0.22),
                      'sides': 5, 'rings': 2, 'col': SPOT, 'tex': 'plain', 'name': 'spot'})
    return {'ppm': PPM, 'cel': 0.8, 'layers': L}


# ---------------------------------------------------------------- the wild rose: a leafy body, drawn flowers
def flower_sprite():
    a = np.zeros((7, 7, 4), np.uint8)
    pink, light, mid, line = (249, 166, 175), (255, 220, 228), (255, 228, 120), (140, 52, 92)
    for y in range(7):
        for x in range(7):
            d = (x - 3) ** 2 + (y - 3) ** 2
            if d <= 10: a[y, x] = (*line, 255)
            if d <= 5: a[y, x] = (*pink, 255)
    a[2, 2] = a[2, 3] = (*light, 255); a[3, 3] = (*mid, 255)
    return save_png(a, NEXT / 'decals' / 'rose_flower.png')


def roses_recipe():
    G = '#4F794A'
    body = [tuple(v * 0.85 for v in b) for b in
            [(0.0, 0.0, 0.62, 0.5, 0.95), (-0.58, 0.12, 0.42, 0.36, 0.68), (0.6, -0.04, 0.45, 0.38, 0.74), (0.1, 0.32, 0.4, 0.34, 0.7)]]
    L = [{'k': 'sphere', 'x': x, 'y': y, 'z': -0.12, 'r': r, 'ry': ry, 'h': h, 'sides': 12, 'rings': 6, 'lump': 0.3,
          'col': G, 'tex': 'leaves', 'name': f'leaves {i + 1}'} for i, (x, y, r, ry, h) in enumerate(body)]
    fl = flower_sprite()
    rng = np.random.default_rng(5)
    for i in range(16):
        x, y, r, ry, h = body[i % len(body)]
        a = -math.pi / 2 + (rng.random() - 0.5) * 2.6  # mostly the side toward the camera, and the top
        f = 0.55 + 0.4 * rng.random()
        zc = -0.12 + h / 2
        L.append(img(fl, x + math.cos(a) * r * f, y + math.sin(a) * ry * f, zc + h / 2 * math.sqrt(max(0, 1 - f * f)) * 0.95 - 0.06,
                     sway=1, recv=0, name='rose'))
    return {'ppm': PPM, 'cel': 0.75, 'layers': L}


# ---------------------------------------------------------------- Granny Juniper's cottage
# the airship's palette (tools/build-airship.py): cream, copper, verdigris, honey wood, brass, iron, lamp yellow
AIR = dict(cream='#F2DCA0', copper='#CE7C4C', verd='#62B098', wood='#B27648', dwood='#84543C', plank='#CC9660',
           iron='#465470', lamp='#FFDE78', stone='#AAA6B4', brass='#E8C060', straw='#D9B26A', moss='#86B45A',
           glass='#5E86A8')


def disc(x, y, z, n, r, depth, col, tex='plain', name='', sides=12):
    """A round thing facing along n (a door, a porthole): a short limb from the surface out along its normal."""
    l = math.sqrt(sum(v * v for v in n)) or 1
    n = [v / l for v in n]
    return limb((x - n[0] * 0.02, y - n[1] * 0.02, z - n[2] * 0.02), (x + n[0] * depth, y + n[1] * depth, z + n[2] * depth),
                r, r, col, tex, name, sides)


def porthole(L, x, y, z, n, r, name, sides=20):
    """A copper-ringed round window with a thin brass cross, as on the airship's cabin."""
    L.append(disc(x, y, z, n, r, 0.05, AIR['copper'], 'metal', name + ' frame', sides))
    L.append(disc(x, y, z, n, r * 0.8, 0.07, AIR['glass'], 'plain', name + ' glass', sides))
    l = math.sqrt(sum(v * v for v in n)) or 1
    n = [v / l for v in n]
    ox, oy, oz = x + n[0] * 0.08, y + n[1] * 0.08, z + n[2] * 0.08
    side = (n[1], -n[0], 0) if abs(n[2]) < 0.9 else (1, 0, 0)
    sl = math.hypot(*side) or 1
    side = [v / sl for v in side]
    up = (n[1] * side[2] - n[2] * side[1], n[2] * side[0] - n[0] * side[2], n[0] * side[1] - n[1] * side[0])
    for d in (side, up):
        L.append(limb((ox - d[0] * r * 0.8, oy - d[1] * r * 0.8, oz - d[2] * r * 0.8),
                      (ox + d[0] * r * 0.8, oy + d[1] * r * 0.8, oz + d[2] * r * 0.8), 0.012, 0.012, AIR['brass'], 'metal', name + ' cross', 5))


def sphere(x, y, z, r, col, tex='plain', name='', sides=8, rings=4, lump=0, h=None):
    S = {'k': 'sphere', 'x': r2(x), 'y': r2(y), 'z': r2(z), 'r': r2(r), 'sides': sides, 'rings': rings, 'col': col, 'tex': tex, 'name': name}
    if lump: S['lump'] = lump
    if h: S['h'] = r2(h)
    return S


def cyl(x, y, z, r, h, col, tex='plain', name='', sides=10, k='cyl', **kw):
    return {'k': k, 'x': r2(x), 'y': r2(y), 'z': r2(z), 'r': r2(r), 'h': r2(h), 'sides': sides, 'col': col, 'tex': tex, 'name': name, **kw}


def cottage_recipe():
    """Granny Juniper's cottage, after the airship's materials and palette but drawn finer, like the houses of the
    fifth-generation Pokémon games: smooth round shapes with more polygons, slim frames and trims, and the small things
    that make a house lived in. The building sheet's 32 px materials (stone, plaster, planks, thatch, moss, metal) in
    honey wood, cream, copper going verdigris and brass. Everything is modelled; only the shop sign stays a drawing."""
    P, A = 'cottage_juniper', AIR
    w, d, wall_top = 5.0, 3.1, 2.4
    fy, by_ = -d / 2, d / 2
    L = []
    # ground floor: a two-step stone plinth, plaster walls, slim honey-wood posts, beams and a wall plate
    L += [box(0, 0, 0, w + 0.34, d + 0.34, 0.12, A['stone'], 'stone', 'plinth'),
          box(0, 0, 0.12, w + 0.18, d + 0.18, 0.14, '#BDB9C6', 'stone', 'plinth top'),
          box(0, 0, 0.26, w, d, wall_top - 0.26, A['cream'], 'grain', 'walls')]
    for sx in (-1, 1):
        for sy in (-1, 1):
            L.append(box(sx * (w / 2 - 0.02), sy * (d / 2 - 0.02), 0.26, 0.13, 0.13, wall_top - 0.26, A['wood'], 'wood', 'corner post'))
    L.append(box(0, 0, wall_top - 0.08, w + 0.14, d + 0.14, 0.1, A['wood'], 'wood', 'wall plate'))
    for sx in (-1, 1):  # half-timbering on the side walls: a rail and two braces each
        x = sx * (w / 2 + 0.01)
        L.append(box(x, 0, 1.2, 0.05, d - 0.1, 0.08, A['wood'], 'wood', 'side rail'))
        for sy in (-1, 1):
            L.append(limb((x, sy * (d / 2 - 0.1), 0.3), (x, sy * 0.55, 1.2), 0.035, 0.035, A['wood'], 'wood', 'brace', 5))
    # the roof: a thin copper gutter, a thatch skirt with its eave turned out, and the smooth mossy dome
    rz = wall_top + 0.02
    L += [cyl(0, 0, rz, 3.12, 0.07, A['copper'], 'metal', 'gutter', 32, ry=2.3),
          cyl(0, 0, rz + 0.04, 3.2, 0.3, A['straw'], 'hay', 'thatch skirt', 32, k='cone', ry=2.36, r1=2.86),
          cyl(0, 0, rz + 0.3, 2.88, 0.08, '#C49E58', 'hay', 'thatch lip', 32, k='cone', ry=2.12, r1=2.8)]
    dz, drx, dry, dh = rz + 0.32, 2.84, 2.06, 1.9
    L.append({'k': 'dome', 'x': 0, 'y': 0, 'z': dz, 'r': drx, 'ry': dry, 'h': dh, 'sides': 32, 'rings': 10, 'lump': 0.025,
              'col': A['moss'], 'tex': 'leaves', 'name': 'mossy roof'})
    # a few tufts and flowers in the moss
    rng = np.random.default_rng(11)

    def on_dome(x, k, side=-1):
        zz = dz + dh * k
        y = side * dry * math.sqrt(max(0.02, 1 - (x / drx) ** 2 - k * k))
        return (x, y, zz), (x / drx ** 2, y / dry ** 2, (zz - dz) / dh ** 2)

    for i in range(14):
        x, k, sd = (rng.random() - 0.5) * 4.0, 0.15 + rng.random() * 0.7, -1 if i % 3 else 1
        (px, py, pz), n = on_dome(x, k, sd)
        L.append(sphere(px, py, pz - 0.06, 0.1 + rng.random() * 0.06, '#9CC468' if i % 2 else '#6E9E4C', 'leaves', 'moss tuft', 7, 3, 0.35, h=0.14))
        if i % 3 == 0:
            L.append(sphere(px + 0.05, py - 0.04 * sd, pz + 0.04, 0.035, ('#F4F0E8', '#E8A0C0', A['lamp'])[i % 3], 'plain', 'roof flower', 5, 2))
    # dormers: two round roof windows, each in a little thatched hood set into the dome
    for i, x in enumerate((-1.0, 1.0)):
        (px, py, pz), n = on_dome(x, 0.38)
        L.append(sphere(px, py + 0.12, pz - 0.18, 0.46, A['straw'], 'hay', f'dormer hood {i + 1}', 14, 5, h=0.62))
        porthole(L, px, py - 0.12, pz, n, 0.27, f'roof window {i + 1}')
    # chimney: stone with a brick top, a copper rim and a verdigris hat on four little legs
    cx, cy = 1.65, 0.45
    L += [box(cx, cy, dz + 0.8, 0.56, 0.56, 1.9, A['stone'], 'stone', 'chimney'),
          box(cx, cy, dz + 2.7, 0.6, 0.6, 0.3, '#B5603F', 'stone', 'chimney bricks'),
          box(cx, cy, dz + 3.0, 0.68, 0.68, 0.07, A['copper'], 'metal', 'chimney rim')]
    for sx in (-1, 1):
        for sy in (-1, 1):
            L.append(limb((cx + sx * 0.22, cy + sy * 0.22, dz + 3.07), (cx + sx * 0.22, cy + sy * 0.22, dz + 3.27), 0.018, 0.018, A['iron'], 'metal', 'hat leg', 4))
    L.append(cyl(cx, cy, dz + 3.25, 0.46, 0.28, A['verd'], 'metal', 'chimney hat', 4, k='cone', r1=0.03))
    # the copper stove pipe with brass bands and a verdigris cap
    qx, qy = -1.5, 0.6
    L += [cyl(qx, qy, dz + 0.7, 0.13, 1.7, A['copper'], 'metal', 'stove pipe', 14)]
    for bz in (dz + 1.2, dz + 1.8):
        L.append(cyl(qx, qy, bz, 0.155, 0.06, A['brass'], 'metal', 'pipe band', 14))
    L.append(cyl(qx, qy, dz + 2.45, 0.27, 0.2, A['verd'], 'metal', 'pipe hat', 14, k='cone', r1=0.03))
    # the weathervane: pole, ball, arrow and the four points
    tz = dz + dh
    L += [limb((0, 0, tz - 0.1), (0, 0, tz + 0.9), 0.022, 0.018, A['iron'], 'metal', 'vane pole', 6),
          sphere(0, 0, tz + 0.82, 0.06, A['brass'], 'metal', 'vane ball', 10, 5),
          box(0, 0, tz + 0.62, 0.8, 0.025, 0.04, A['copper'], 'metal', 'vane arrow'),
          cyl(0.42, 0, tz + 0.58, 0.08, 0.12, A['copper'], 'metal', 'vane tip', 3, k='cone', r1=0),
          box(-0.36, 0, tz + 0.55, 0.12, 0.02, 0.18, A['copper'], 'metal', 'vane tail'),
          box(0, 0, tz + 0.42, 0.5, 0.02, 0.02, A['iron'], 'metal', 'vane cross'),
          box(0, 0, tz + 0.42, 0.02, 0.5, 0.02, A['iron'], 'metal', 'vane cross')]
    # the round door: a stone surround, a dark frame, eight slim planks, iron straps, a brass knob and knocker,
    # a small canopy on brackets above it and a stone step
    dx, dr = -0.6, 0.76
    dcz = 0.26 + dr * 0.86
    L += [disc(dx, fy, dcz, (0, -1, 0), dr + 0.2, 0.03, A['stone'], 'stone', 'door surround', 28),
          disc(dx, fy, dcz, (0, -1, 0), dr + 0.06, 0.06, A['dwood'], 'wood', 'door frame', 28)]
    n_pl = 8
    pw = 2 * dr / n_pl
    for i in range(n_pl):
        x0 = dx - dr + pw * (i + 0.5)
        hh = math.sqrt(max(0, dr * dr - (abs(x0 - dx) + pw * 0.3) ** 2))
        bot = max(0.26, dcz - hh)
        L.append(box(x0, fy - 0.075, bot, pw - 0.02, 0.04, dcz + hh - bot, A['plank'] if i % 2 else '#C18A56', 'wood', 'door plank'))
    for hz in (dcz - 0.38, dcz + 0.3):
        L.append(box(dx - 0.15, fy - 0.1, hz, dr * 1.4, 0.02, 0.06, A['iron'], 'metal', 'door strap'))
        L.append(sphere(dx - 0.15 - dr * 0.7, fy - 0.11, hz + 0.03, 0.03, A['iron'], 'metal', 'strap nail', 6, 3))
    L += [sphere(dx + dr * 0.55, fy - 0.12, dcz - 0.08, 0.05, A['brass'], 'metal', 'door knob', 10, 5),
          limb((dx, fy - 0.1, dcz + 0.22), (dx, fy - 0.13, dcz + 0.05), 0.02, 0.02, A['brass'], 'metal', 'knocker', 8)]
    cz = dcz + dr + 0.28
    L += [box(dx, fy - 0.3, cz, dr * 2 + 0.6, 0.62, 0.06, A['wood'], 'wood', 'canopy'),
          box(dx, fy - 0.61, cz - 0.02, dr * 2 + 0.64, 0.04, 0.1, A['copper'], 'metal', 'canopy edge'),
          cyl(dx, fy - 0.3, cz + 0.06, (dr * 2 + 0.6) / 2, 0.16, A['straw'], 'hay', 'canopy thatch', 12, k='cone', ry=0.33, r1=(dr * 2 + 0.3) / 2)]
    for sx in (-1, 1):
        L.append(limb((dx + sx * (dr + 0.15), fy, cz - 0.45), (dx + sx * (dr + 0.15), fy - 0.55, cz), 0.03, 0.03, A['dwood'], 'wood', 'canopy bracket', 5))
    L += [box(dx, fy - 0.3, 0, 1.5, 0.6, 0.12, A['stone'], 'stone', 'door step'),
          box(dx, fy - 0.24, 0.12, 1.3, 0.42, 0.1, '#BDB9C6', 'stone', 'door step top')]
    for i, (sx, sy) in enumerate(((dx - 0.1, fy - 0.95), (dx + 0.25, fy - 1.45), (dx - 0.05, fy - 1.95), (dx + 0.3, fy - 2.45))):
        L.append(cyl(sx, sy, -0.02, 0.24, 0.05, A['stone'], 'stone', 'path stone', 8, ry=0.18))
    # portholes: one by the door, one on each side wall, one at the back
    porthole(L, -1.95, fy, 1.55, (0, -1, 0), 0.34, 'front porthole')
    porthole(L, -w / 2, -0.55, 1.75, (-1, 0, 0), 0.36, 'left porthole')
    porthole(L, w / 2, 0.55, 1.75, (1, 0, 0), 0.36, 'right porthole')
    porthole(L, -0.9, by_, 1.6, (0, 1, 0), 0.36, 'back porthole')
    # the front window: glass, a slim frame with mullions, verdigris shutters, a stone sill with honey jars, a flower box
    wx, wz, ww, wh = 1.3, 1.35, 1.0, 0.95
    L.append(box(wx, fy - 0.02, wz - wh / 2, ww, 0.04, wh, A['glass'], 'plain', 'window glass'))
    for bx, bw, bz, bh in ((wx - ww / 2, 0.07, wz - wh / 2, wh), (wx + ww / 2, 0.07, wz - wh / 2, wh), (wx, ww + 0.07, wz + wh / 2 - 0.035, 0.07),
                           (wx, 0.045, wz - wh / 2, wh), (wx, ww, wz - 0.02, 0.045)):
        L.append(box(bx, fy - 0.06, bz, bw, 0.06, bh, A['wood'], 'wood', 'window frame'))
    for sx in (-1, 1):
        shx = wx + sx * (ww / 2 + 0.22)
        L.append(box(shx, fy - 0.04, wz - wh / 2, 0.36, 0.04, wh, A['verd'], 'wood', 'shutter'))
        for zz in (wz - wh / 2 + 0.18, wz + wh / 2 - 0.18):
            L.append(box(shx, fy - 0.07, zz, 0.3, 0.02, 0.04, '#4E8C78', 'wood', 'shutter batten'))
    L.append(box(wx, fy - 0.1, wz - wh / 2 - 0.08, ww + 0.3, 0.2, 0.08, '#BDB9C6', 'stone', 'window sill'))
    for i, jx in enumerate((wx - 0.32, wx - 0.12, wx + 0.36)):
        L += [cyl(jx, fy - 0.1, wz - wh / 2, 0.06, 0.13, A['lamp'], 'plain', 'honey jar', 10),
              cyl(jx, fy - 0.1, wz - wh / 2 + 0.13, 0.065, 0.03, '#F4F0E8', 'cloth', 'jar lid', 10)]
    L.append(box(wx, fy - 0.2, wz - wh / 2 - 0.42, ww + 0.25, 0.28, 0.24, A['dwood'], 'wood', 'flower box'))
    for i in range(9):
        x = wx - ww / 2 + 0.02 + (ww - 0.04) * i / 8
        L.append(sphere(x, fy - 0.24, wz - wh / 2 - 0.2, 0.09, '#5E9A48', 'leaves', 'leaves', 7, 3, 0.3))
        if i % 2 == 0:
            L.append(sphere(x + 0.03, fy - 0.32, wz - wh / 2 - 0.14, 0.045, ('#E87EA8', A['lamp'], '#F4F0E8', '#C478D0')[i // 2 % 4], 'plain', 'flower', 6, 3))
    # a flower bed along the front wall, right of the step
    L.append(box(1.3, fy - 0.38, 0, 2.1, 0.5, 0.1, '#7A5A3C', 'grain', 'flower bed'))
    for i in range(11):
        x = 0.35 + 1.9 * i / 10
        L.append(sphere(x, fy - 0.38 + (i % 2) * 0.08, 0.1, 0.13 + (i % 3) * 0.02, '#4F8E44' if i % 2 else '#68A852', 'leaves', 'bed leaves', 7, 3, 0.35))
        L.append(sphere(x + 0.04, fy - 0.46, 0.24 + (i % 3) * 0.03, 0.045, ('#E87EA8', A['lamp'], '#F4F0E8', '#C478D0', '#E86A5A')[i % 5], 'plain', 'bed flower', 6, 3))
    # the shop sign: the drawing kept (its lettering is better drawn), on a board hung from an iron bracket
    sx_, sz_ = 0.42, wall_top - 0.4
    L += [limb((sx_, fy, wall_top - 0.14), (sx_, fy - 0.44, wall_top - 0.14), 0.018, 0.015, A['iron'], 'metal', 'sign bracket', 6),
          limb((sx_, fy - 0.02, wall_top - 0.42), (sx_, fy - 0.3, wall_top - 0.15), 0.012, 0.012, A['iron'], 'metal', 'bracket stay', 5)]
    for ox in (-0.2, 0.2):
        L.append(limb((sx_ + ox, fy - 0.4, wall_top - 0.14), (sx_ + ox, fy - 0.4, sz_ + 0.34), 0.008, 0.008, A['iron'], 'metal', 'sign chain', 4))
    L.append(box(sx_, fy - 0.4, sz_ - 0.32, 0.62, 0.05, 0.66, A['wood'], 'wood', 'sign board'))
    L.append(img(decal(P, (102, 113, 122, 134), 'cottage_sign', clear=(A['cream'],)), sx_, fy - 0.45, sz_ - 0.3,
                 face='fixed', s=round(PPM / 20 * 0.56, 3), name='sign'))
    # a little lamp by the door, its glass lit when the lamps come on
    lx = dx - dr - 0.42
    L += [limb((lx, fy, 1.75), (lx, fy - 0.24, 1.75), 0.015, 0.015, A['iron'], 'metal', 'lamp arm', 5),
          cyl(lx, fy - 0.24, 1.42, 0.09, 0.04, A['iron'], 'metal', 'lamp base', 8),
          cyl(lx, fy - 0.24, 1.72, 0.12, 0.09, A['verd'], 'metal', 'lamp roof', 8, k='cone', r1=0.02),
          img(glass_sprite(), lx, fy - 0.24, 1.46, s=0.5, glow=1, recv=0, sway=0, name='lamp glass')]
    # by the left corner: a rain barrel under a copper downpipe, and a stack of firewood along the side
    bx_, by2 = -w / 2 - 0.15, fy - 0.35
    L += [cyl(bx_, by2, 0, 0.3, 0.68, A['wood'], 'wood', 'rain barrel', 14, k='barrel', bulge=0.1),
          cyl(bx_, by2, 0.12, 0.315, 0.04, A['iron'], 'metal', 'barrel hoop', 14),
          cyl(bx_, by2, 0.52, 0.315, 0.04, A['iron'], 'metal', 'barrel hoop', 14),
          cyl(bx_, by2, 0.64, 0.27, 0.03, '#4E7AA0', 'plain', 'barrel water', 14),
          limb((-w / 2 - 0.08, fy - 0.08, rz + 0.04), (-w / 2 - 0.08, fy - 0.08, 0.95), 0.045, 0.045, A['copper'], 'metal', 'downpipe', 8),
          limb((-w / 2 - 0.08, fy - 0.08, 0.95), (bx_, by2 + 0.05, 0.8), 0.045, 0.045, A['copper'], 'metal', 'downpipe shoe', 8)]
    for row in range(3):
        for j in range(4 - row):
            yy = 0.2 + j * 0.24 + row * 0.12
            L.append(limb((-w / 2 - 0.12, yy, 0.12 + row * 0.2), (-w / 2 - 0.62, yy, 0.12 + row * 0.2), 0.1, 0.1, '#8A6A4A', 'bark', 'firewood', 7))
    # by the right side: Granny Juniper's beehive, a straw skep on a little stand
    hx, hy = w / 2 + 0.55, -0.4
    L += [box(hx, hy, 0, 0.5, 0.5, 0.3, A['dwood'], 'wood', 'skep stand'),
          box(hx, hy, 0.3, 0.6, 0.6, 0.05, A['wood'], 'wood', 'skep board'),
          cyl(hx, hy, 0.35, 0.3, 0.42, A['straw'], 'hay', 'skep', 16, k='barrel', bulge=0.18),
          sphere(hx, hy, 0.62, 0.28, A['straw'], 'hay', 'skep top', 16, 6, h=0.42),
          box(hx - 0.31, hy, 0.36, 0.04, 0.14, 0.08, '#3A2A2A', 'plain', 'skep door')]
    for i in range(4):
        L.append(cyl(hx, hy, 0.43 + i * 0.1, 0.31 - (i == 3) * 0.04, 0.025, '#C49E58', 'hay', 'skep band', 16))
    return {'ppm': PPM, 'cel': 0.6, 'layers': sorted(L, key=lambda l: l['k'] == 'img')}


def cottage_fx():
    """Its lights and smoke, in pixels from its base point at 32 px to the metre (x right, y up as negative)."""
    px = lambda m: round(m * PPM)
    return [{'k': 'window', 'x': px(1.3), 'y': -px(1.35)}, {'k': 'window', 'x': px(-1.95), 'y': -px(1.55)},
            {'k': 'window', 'x': px(-1.0), 'y': -px(3.45)}, {'k': 'window', 'x': px(1.0), 'y': -px(3.45)},
            {'k': 'glow', 'x': px(-1.78), 'y': -px(1.55)}, {'k': 'smoke', 'x': px(1.65), 'y': -px(5.9)}]


# ---------------------------------------------------------------- the lantern post: a model with a glowing glass
def glass_sprite():
    a = rgba(PROPS / 'lantern.png')[24:41, 31:44].copy()
    return save_png(a, NEXT / 'decals' / 'lantern_glass.png')


def lantern_recipe():
    WOOD, DARK, CAP, METAL = '#B27648', '#56393D', '#AAA6B4', '#465470'
    lx = 0.44
    L = [box(0, 0, 0, 0.3, 0.3, 0.16, CAP, 'stone', 'foot'),
         box(0, 0, 0.16, 0.2, 0.2, 2.86, WOOD, 'wood', 'post'),
         box(0, 0, 3.0, 0.27, 0.27, 0.09, '#C99C6D', 'plain', 'post cap'),
         box(0.33, 0, 2.62, 0.66, 0.13, 0.12, WOOD, 'wood', 'arm'),
         limb((0.08, 0, 2.25), (0.42, 0, 2.62), 0.035, 0.035, WOOD, 'wood', 'brace', 4),
         limb((lx, 0, 2.62), (lx, 0, 2.45), 0.012, 0.012, DARK, 'metal', 'hook', 4),
         {'k': 'cone', 'x': lx, 'y': 0, 'z': 2.3, 'r': 0.25, 'r1': 0.05, 'h': 0.16, 'sides': 4, 'col': METAL, 'tex': 'metal', 'name': 'lamp roof'},
         box(lx, 0, 1.78, 0.36, 0.36, 0.06, METAL, 'metal', 'lamp base')]
    for sx in (-1, 1):
        for sy in (-1, 1):
            L.append(box(lx + sx * 0.16, sy * 0.16, 1.84, 0.035, 0.035, 0.46, METAL, 'metal', 'frame'))
    L.append(img(glass_sprite(), lx, 0, 1.83, glow=1, recv=0, sway=0, name='glass'))
    return {'ppm': PPM, 'cel': 0.75, 'layers': L}


# ---------------------------------------------------------------- the washing line: posts and rope modelled, washing drawn
def laundry_recipe():
    P = 'laundry_line'
    WOOD, ROPE = '#B27648', '#AAA6B4'
    half, top = 1.97, 2.25
    rope = lambda x: 2.12 - 0.22 * (1 - (x / half) ** 2)
    L = [box(-half, 0, 0, 0.16, 0.16, top, WOOD, 'wood', 'post'), box(half, 0, 0, 0.16, 0.16, top, WOOD, 'wood', 'post')]
    xs = [-half + 2 * half * i / 6 for i in range(7)]
    for a, b in zip(xs, xs[1:]):
        L.append(limb((a, 0, rope(a)), (b, 0, rope(b)), 0.014, 0.014, ROPE, 'cloth', 'rope', 4))
    for i, b in enumerate(((16, 7, 36, 32), (39, 11, 64, 30), (67, 12, 84, 41), (87, 10, 108, 32), (107, 8, 120, 25))):
        x0, y0, x1, y1 = b
        x, _ = at(P, (x0 + x1) / 2, y1)
        h = (y1 - y0) / PPM
        L.append(img(decal(P, b, f'washing_{i}'), x, 0, r2(rope(x) - h + 0.03), face='fixed', shadow=1, sway=1, name='washing'))
    return {'ppm': PPM, 'cel': 0.75, 'layers': L}


# ---------------------------------------------------------------- write
def write_recipe(name, rec):
    p = NEXT / 'models' / f'{name}.json'
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(rec, separators=(',', ':')) + '\n')
    return rel(p)


def main():
    paint_textures()
    leaves = NEXT / 'leaves'
    for f in list(leaves.glob('*.png')) if leaves.exists() else []: f.unlink()
    built = {}
    recs = {}
    for i, (key, (pic, k, limbs)) in enumerate(TREES.items()):
        rec, sheet_path, sheet, canopy = tree_recipe(key, pic, k, limbs, leaves, 100 + i)
        recs[key] = (sheet_path, sheet)
        built[key] = write_recipe(f'tree_{key}', rec)
    # the autumn oak: the oak's own trunk and clumps, its leaf picture recoloured to the autumn oak's oranges
    aa = rgba(PROPS / 'tree_oak_autumn.png'); _, ac = split_trunk(aa)
    ga = rgba(PROPS / 'tree_oak.png'); _, gc = split_trunk(ga)
    sp, sh = recs['oak']
    built['oak_autumn_swap'] = {sp: save_png(recolour(sh, leaf_colours(ga, gc), leaf_colours(aa, ac)), leaves / 'oak_autumn.png')}
    # the bushes: crowns without a trunk, one model per shape
    for i, (key, pic, k) in enumerate((('bush_round', 'bush_round', 3), ('bush_round_b', 'bush_round_b', 4), ('bush_round_c', 'bush_round_c', 3))):
        rec, *_ = tree_recipe(key, pic, k, [], leaves, 200 + i)
        built[key] = write_recipe(key, rec)
    built['giant'] = write_recipe('tree_giant_swing', giant_recipe(leaves))
    built['roses'] = write_recipe('bush_roses', roses_recipe())
    for key in STONES:
        built[key] = write_recipe(key, rocks_recipe(key))
    built['rocks_mossy'] = write_recipe('rocks_mossy', rocks_recipe('rocks', moss=True))
    built['mushrooms'] = write_recipe('mushrooms', mushrooms_recipe())
    built['cottage'] = write_recipe('cottage_juniper', cottage_recipe())
    built['lantern'] = write_recipe('lantern', lantern_recipe())
    built['laundry'] = write_recipe('laundry_line', laundry_recipe())
    D = gamedata.load()
    C = D['scenery']['props']
    add_catalogue(C, built)
    swap_in(C)
    D['maps']['test_props_next'] = test_map(C)
    gamedata.save(D)
    return built


# ---------------------------------------------------------------- the catalogue
DROP = ('grow', 'family', 'weight', 'vol', 'volDepth', 'model', 'layers')


def entry(C, old, **kw):
    """A new prop from an old one: its picture (the fallback when models are off, and the far view), size and anchor,
    shadow and footprint; none of the fields that would let the scene builders grow it on a route."""
    M = {k: v for k, v in C[old].items() if k not in DROP}
    M['tags'] = ['test']
    M.update(kw)
    return M


def pic(C, old, **kw):
    """A variant's own picture and size (the old prop it stands for)."""
    M = C[old]
    V = {k: M[k] for k in ('img', 'w', 'h', 'ox', 'oy', 'shadow', 'name') if k in M}
    V.update(kw)
    return V


def add_catalogue(C, B):
    C['next_beech'] = entry(C, 'tree_beech', name='Beech (new)', model=B['beech'], ppm=PPM)
    C['next_oak'] = entry(C, 'tree_oak', name='Oak tree (new)', model=B['oak'], ppm=PPM, variants=[
        pic(C, 'tree_oak_b', model=B['oak_b']),
        pic(C, 'tree_oak_small', model=B['oak_small']),
        pic(C, 'tree_oak_autumn', model=B['oak'], swap=B['oak_autumn_swap']),
    ])
    C['next_tree_giant_swing'] = entry(C, 'tree_giant_swing', name='Great oak with a swing (new)', model=B['giant'], ppm=PPM,
                                       vary={'rot': 0, 'lean': 0, 'size': 0})
    C['next_bush_roses'] = entry(C, 'bush_roses', name='Wild roses (new)', model=B['roses'], ppm=PPM)
    C['next_bush_round'] = entry(C, 'bush_round', name='Round bush (new)', model=B['bush_round'], ppm=PPM, variants=[
        pic(C, 'bush_round_b', model=B['bush_round_b']),
        pic(C, 'bush_round_c', model=B['bush_round_c']),
    ])
    C['next_rocks'] = entry(C, 'rocks', name='Small rocks (new)', model=B['rocks'], ppm=PPM, variants=[
        pic(C, 'rocks_b', model=B['rocks_b']),
        pic(C, 'rocks_c', model=B['rocks_c']),
        pic(C, 'rocks_mossy', model=B['rocks_mossy']),
        pic(C, 'rocks_snow', model=B['rocks_mossy'], swap={MOSS: '#EEF3F8', ROCK_MOSS: '#A3A7B6'}),
    ])
    C['next_mushroom'] = entry(C, 'mushroom', name='Mushrooms (new)', model=B['mushrooms'], ppm=PPM, variants=[
        pic(C, 'mushroom_brown', model=B['mushrooms'], swap={CAP: '#B07046', SPOT: '#B07046'}),
        pic(C, 'mushroom_blue', model=B['mushrooms'], swap={CAP: '#5492EC', SPOT: '#C8DCF8', STEM: '#B9AEDC'}),
    ])
    C['next_cottage_juniper'] = entry(C, 'cottage_juniper', name='Beekeeper’s cottage (new)', model=B['cottage'], ppm=PPM,
                                      box=[5.3, 3.4], door={'x': -19, 'y': 0}, fx=cottage_fx(), vary={'rot': 0, 'lean': 0})
    C['next_cottage_juniper'].pop('build', None)  # a model now, not a picture made into a building
    C['next_lantern'] = entry(C, 'lantern', name='Lantern post (new)', model=B['lantern'], ppm=PPM, vary={'rot': 0, 'lean': 0})
    C['next_laundry_line'] = entry(C, 'laundry_line', name='Laundry line (new)', model=B['laundry'], ppm=PPM, vary={'rot': 0, 'lean': 0})
    # stays flat on purpose: only redrawn at the new scale, its three shapes as one prop
    C['next_tallgrass'] = entry(C, 'tallgrass', name='Tall grass (new scale)', ppm=PPM, variants=[pic(C, 'tallgrass_b'), pic(C, 'tallgrass_c')])


# ---------------------------------------------------------------- the test map
ROWS = [
    # (row, [(old prop, the new prop's variant), ...], new prop, metres between neighbours). Each old prop stands just
    # left of its new version. Small things first, so the tall ones behind don't hide them.
    ('tallgrass', [('tallgrass', 0), ('tallgrass_b', 1), ('tallgrass_c', 2)] * 2, 'next_tallgrass', 1.8),
    ('mushrooms', [('mushroom', 0), ('mushroom_brown', 1), ('mushroom_blue', 2)], 'next_mushroom', 1.8),
    ('rocks', [('rocks', 0), ('rocks_b', 1), ('rocks_c', 2), ('rocks_mossy', 3), ('rocks_snow', 4)], 'next_rocks', 2.4),
    ('roses', [('bush_roses', 0)] * 2, 'next_bush_roses', 2.8),
    ('round-bush', [('bush_round', 0), ('bush_round_b', 1), ('bush_round_c', 2)], 'next_bush_round', 2.8),
    ('lantern', [('lantern', 0)] * 2, 'next_lantern', 2.4),
    ('laundry', [('laundry_line', 0)], 'next_laundry_line', 5.0),
    ('cottage', [('cottage_juniper', 0)], 'next_cottage_juniper', 7.0),
    ('beech', [('tree_beech', 0)] * 2, 'next_beech', 6.5),
    ('oak', [('tree_oak', 0), ('tree_oak_b', 1), ('tree_oak_small', 2), ('tree_oak_autumn', 3)], 'next_oak', 6.2),
    ('giant', [('tree_giant_swing', 0)], 'next_tree_giant_swing', 14.0),
]


# the swap (approved 2026-10-19): each old prop takes on its new version, under its own key, so every placement in
# every scene draws the new one. Kept from the old entry: its name, group, tags, the scene builders' fields and its
# collision radius; the rest (picture fallback, size, base point, model, scale, effects, footprint) is the new one's.
KEEP_OLD = ('name', 'group', 'tags', 'family', 'grow', 'weight', 'landmark', 'posts', 'solid')


def swap_in(C):
    for _, pairs, new, _ in ROWS:
        N = C.pop(new, None)
        if not N: continue
        for old, v in dict.fromkeys(pairs):
            O = C.get(old, {})
            M = json.loads(json.dumps(N))
            V = (M.pop('variants', None) or [None] * 9)[v - 1] if v else None
            M.pop('variants', None)
            if V: M.update(V)
            M.pop('build', None)
            for f in KEEP_OLD:
                if f in O: M[f] = O[f]
                elif f in M and f != 'name': M.pop(f)
            if 'tags' in M and M['tags'] == ['test']: M.pop('tags')
            C[old] = M


def test_map(C):
    """A showcase of the swapped props in the plain look: each row one family, every look of it side by side."""
    W, H = 56, 8 + 15 * len(ROWS)
    tiles = [['g'] * W for _ in range(H)]
    props, shots = [], []
    for y in range(4): tiles[y] = ['p'] * W
    z = 9.0
    for name, pairs, new, gap in ROWS:
        keys = list(dict.fromkeys(o for o, _ in pairs))
        keys = (keys * 2)[:max(len(keys), 2)]
        x0 = W / 2 - gap * (len(keys) - 1) / 2
        for i, k in enumerate(keys):
            props.append({'k': k, 'x': round(x0 + gap * i, 2), 'z': z})
        shots += [{'x': W / 2, 'z': z - 3, 'yaw': 0, 'label': name},
                  {'x': W / 2 + 4, 'z': z - 2, 'yaw': 0.9, 'label': f'{name}-turned'}]
        z += 15
    return {
        'name': 'Test: props in the new style (phase 09)', 'w': W, 'h': H, 'edge': 'g',
        'sky': ['#8CC6E6', '#BFE3EE', '#F4E8C8'], 'haze': '#EAD9C0', 'hazeD': 34, 'cam': {'pitch': 30, 'h': 12, 'fov': 1},
        'blur': 0, 'amb': None, 'plain': 1, 'tint': None, 'indoor': 0, 'far': 'hills', 'farH': 8, 'folk': 0, 'test': 1,
        'exits': [], 'checks': [], 'shots': shots, 'hub': [W / 2, 2.5],
        'tiles': [''.join(r) for r in tiles], 'props': props, 'kind': 'test',
    }


if __name__ == '__main__':
    main()
