#!/usr/bin/env python3
"""Phase 09, batch 11 (part 2): the last standing pictures the run biomes place, as models in the style of batches
1-11 (low-poly, 32 px to the metre). Swapped straight in under their own keys, as batches 1-11 part 1 were, so every
placement draws the model; the old pictures stay as the fallback when 3D props are off.

  trees   tree_pine_snow, tree_pine_snow_b, tree_pine_snow_small (batch 10's conifers: drawn tiers as bands on a
          modelled mast), tree_olive (batch 1's broadleaf: a modelled trunk, leaf clumps cut from the picture),
          tree_jungle (the same, its back and front leaf layers folded in and its hanging vines kept as cut strips),
          tree_dead (all branches modelled), palm_tree and palm_small (a ringed trunk, modelled fronds, coconuts)
  rocks   boulder, boulder_b, boulder_mossy, boulder_snow (IS-4's faceted stones, moss and snow as caps),
          boulder_basalt, rocks_basalt, lava_rock (glowing cracks), basalt_columns (hexagonal prisms)
  cave    stalagmite, stalagmite_b (stacked tapering cones), crystal, crystal_purple, crystal_cluster, crystal_spire
          (hexagonal prisms with pointed tips), cave_house (a rock mound with a door, a round window, a lantern, a
          chimney, moss on top)

Each keeps its base point, its collision radius (solid) and its footprint (box). The rocks, crystals and the cave
house keep their size in metres (the old pictures are 34 px to the metre); the trees cut from their pictures come out
at 32 px to the metre, as batch 10's did, so they stand about 6% taller, like the pines they grow beside.

    python3 tools/build-props-batch11b.py      (independent of batches 1-11 part 1 apart from their helpers; rerunnable)

Writes game/art/scene/next/models/<key>.json, game/art/scene/next/leaves/*.png, the catalogue entries in
game/data/scenery.json, and the showcase map test_props_biomes.
"""
import importlib.util
import math
import sys
import tempfile
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import gamedata  # noqa: E402


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'tools' / file)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


B1 = load('batch1', 'build-props-batch1.py')
B4 = load('batch4', 'build-props-batch4.py')
B10 = load('batch10', 'build-props-batch10.py')
BI = load('island', 'build-props-island.py')
B11 = load('batch11', 'build-props-batch11.py')
PPM = B1.PPM
box, limb, disc, sphere, cyl, img, r2 = B1.box, B1.limb, B1.disc, B1.sphere, B1.cyl, B1.img, B1.r2
stone, rec, fx = BI.stone, B4.rec, B11.fx
LEAVES = B1.NEXT / 'leaves'
OLD_PPM = 34                       # the old pictures' scale: a hand-built model keeps their size in metres
FIXED = {'rot': 0, 'lean': 0}

ROCK, ROCK_D, ROCK_L = '#9C8C92', '#766879', '#BAABA1'
GREY, GREY_D, GREY_L = '#AAA6B4', '#807990', '#C4BDB9'
MOSS, MOSS_L, MOSS_D = '#76AA50', '#9FC073', '#5E7C4E'
SNOW, SNOW_L = '#ECEEE6', '#F7F8F0'
BASALT, BASALT_D, BASALT_DD, BASALT_TOP = '#464654', '#3E3A51', '#2D2742', '#7E7A76'
LAVA = '#FC9D57'
CAVE, CAVE_L, CAVE_D, CAVE_DD = '#84788C', '#A99D9D', '#675B75', '#443B58'
ICE = ('#7CF0EC', '#B4F8F2', '#54E0EC', '#D6F8F4')
AMETHYST = ('#C89AF4', '#DCC4F4', '#A870EC', '#EADCF4')
AQUA = ('#7FE8F4', '#B6F2F4', '#5CD2EC', '#DDF6F6')
SPIRE_PURPLE = ('#C89AF4', '#A870EC')
PLATE = '#645E74'
PALM_BARK, PALM_LEAF, PALM_LEAF_D, NUT = '#D2AE7E', '#6CC058', '#54A046', '#9A7462'
DEAD_BARK = '#463A38'
WOOD, WOOD_D, IRON, LIT = '#B27648', '#84543C', '#3A3448', '#F8DC84'


def m(px_):
    """old picture pixels as metres"""
    return px_ / OLD_PPM


def old_fx(items):
    """an old entry's effects (pixels at 34 to the metre) at the same place in metres, at the model's 32"""
    return [{**e, 'x': round(e['x'] * PPM / OLD_PPM), 'y': round(e['y'] * PPM / OLD_PPM)} for e in items]


def on_stone(S, a, k, out=1.04):
    """a point on a stone's skin: a turn a round it (0 is +x, -pi/2 faces the camera), k of the way up"""
    f = math.sqrt(max(0.0, 1 - (2 * k - 1) ** 2)) * out
    return (S['x'] + math.cos(a) * S['r'] * f, S['y'] + math.sin(a) * S.get('ry', S['r']) * f, S['z'] + k * S['h'])


def cap(S, k, col, name, lump=0.15, over=1.05, extra=0.05):
    """a cap (moss, snow) over a stone's top from k of the way up: a dome as wide as the stone is there, a little more"""
    f = math.sqrt(max(0.0, 1 - (2 * k - 1) ** 2)) * over
    top = S['z'] + S['h']
    return {'k': 'dome', 'x': S['x'], 'y': S['y'], 'z': r2(S['z'] + k * S['h']), 'r': r2(S['r'] * f),
            'ry': r2(S.get('ry', S['r']) * f), 'h': r2(top - (S['z'] + k * S['h']) + extra), 'sides': S['sides'], 'rings': 3,
            'lump': lump, 'facet': 1, 'col': col, 'tex': 'leaves' if col in (MOSS, MOSS_L, MOSS_D) else 'plain', 'name': name}


def components(mask, least=1):
    """the mask's connected parts (8 neighbours) as lists of (y, x), the ones of at least `least` pixels"""
    H, W = mask.shape
    seen = np.zeros_like(mask)
    out = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]: continue
        comp, q = [], deque([(y0, x0)]); seen[y0, x0] = True
        while q:
            y, x = q.popleft(); comp.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < H and 0 <= xx < W and mask[yy, xx] and not seen[yy, xx]:
                        seen[yy, xx] = True; q.append((yy, xx))
        if len(comp) >= least: out.append(comp)
    return out


# ================================================================ trees
SNOW_PINES = {
    # key: (picture, limbs: the trunk and the mast hidden in the crown, as batch 10's pines)
    'tree_pine_snow': ('tree_pine_snow', [((45.5, 191), (45.5, 172), 12, 11), ((45.5, 174), (45.5, 24), 6, 2)]),
    'tree_pine_snow_b': ('tree_pine_snow_b', [((41.5, 233), (41.5, 212), 12, 10), ((41.5, 214), (41.5, 28), 5, 2)]),
    'tree_pine_snow_small': ('tree_pine_snow_small', [((25.5, 93), (25.5, 74), 8, 7), ((25.5, 76), (25.5, 12), 4, 1.5)]),
}


def snow_pine_recipe(key, i):
    pic, limbs = SNOW_PINES[key]
    return B10.conifer_recipe(key, pic, 'tiers', limbs, 1100 + i)


def olive_recipe():
    """The olive: a short gnarled trunk splitting in two, its grey-green crown cut into six clumps."""
    limbs = [((59, 94), (58.5, 58), 22, 18), ((53, 60), (44, 46), 10, 6), ((64, 60), (70, 46), 10, 6)]
    r, *_ = B1.tree_recipe('olive', 'tree_olive', 6, limbs, LEAVES, 1150)
    return r


def jungle_recipe():
    """The jungle tree: a tall pale trunk on brown buttress roots, its crown cut into clumps (the drawing's back leaf
    layer behind them, its front clumps before them), the hanging vines as strips cut from the drawing, each strip
    at its own depth under the crown so they hang all round when the camera turns."""
    P = 'tree_jungle'
    a = B1.rgba(B1.PROPS / f'{P}.png')
    H, W = a.shape[:2]
    ax, by = W / 2, H - 1
    trunk, canopy = B1.split_trunk(a)
    wide = [y for y in range(H) if canopy[y].sum() > 60]
    crown_bottom = max(wide)
    vines = canopy.copy(); vines[:crown_bottom + 1] = False
    clean = a.copy(); clean[vines, 3] = 0
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / P
        Image.fromarray(clean.astype(np.uint8), 'RGBA').save(src.with_suffix('.png'))
        limbs = [((111.5, 300), (111, 84), 30, 22), ((106, 86), (93, 66), 12, 7), ((117, 86), (128, 66), 12, 7)]
        r, sheet_path, sheet, crown = B1.tree_recipe('jungle', str(src), 8, limbs, LEAVES, 1160)
    L = r['layers']
    ys, xs = np.nonzero(crown)
    Rc = (xs.max() - xs.min() + 1) / 2 / PPM
    # the trunk is pale as drawn (the tool takes a middling bark colour); the buttress roots are brown
    for l in L:
        if l.get('name') in ('trunk', 'limb', 'branch'): l['col'] = '#EEE4CC'
        if l.get('name') == 'root':
            l['col'] = '#8A5A3C'
            for q in l['pts']: q[3] = r2(q[3] * 1.25)
    # the back leaf layer: its crown (without the vines and trunk drawn under it), behind the clumps
    lb = B1.rgba(B1.PROPS / 'layers' / 'tree_jungle_lb.png')
    lbm = lb[..., 3] > 0
    lb_bottom = max(y for y in range(H) if lbm[y].sum() > 100)
    lbm[lb_bottom + 1:] = False
    bys, bxs = np.nonzero(lbm)
    back = np.zeros_like(lb); back[lbm] = lb[lbm]
    back = back[bys.min():bys.max() + 1, bxs.min():bxs.max() + 1]
    back_path = B1.save_png(back, LEAVES / 'jungle_back.png')
    L.append(img(back_path, ((bxs.min() + bxs.max() + 1) / 2 - ax) / PPM, Rc * 0.45, (by - bys.max()) / PPM,
                 shade=0.85, recv=0, sway=0.6, name='back leaves'))
    # the front leaf layer's clumps (the green parts; the bits of trunk drawn on it are the model's now)
    lf = B1.rgba(B1.PROPS / 'layers' / 'tree_jungle_lf.png')
    lfm = (lf[..., 3] > 0) & (lf[..., 1].astype(int) > lf[..., 0].astype(int) + 8)
    parts = components(lfm, 150)
    fy, fx_ = np.nonzero(lfm)
    fy0, fx0 = fy.min(), fx_.min()
    front = np.zeros_like(lf); front[lfm] = lf[lfm]
    front = front[fy0:fy.max() + 1, fx0:fx_.max() + 1]
    front_path = B1.save_png(front, LEAVES / 'jungle_front.png')
    for i, comp in enumerate(sorted(parts, key=lambda c: min(x for _, x in c))):
        cy = [p[0] for p in comp]; cx = [p[1] for p in comp]
        x0, x1, y0, y1 = min(cx), max(cx), min(cy), max(cy)
        xm = ((x0 + x1 + 1) / 2 - ax) / PPM
        xn = max(-1, min(1, xm / Rc))
        L.append(img(front_path, xm, -math.sqrt(1 - xn * xn) * Rc * (0.35 + 0.08 * (i % 2)), (by - y1) / PPM,
                     clip=[int(x0 - fx0), int(y0 - fy0), int(x1 + 1 - fx0), int(y1 + 1 - fy0)], recv=0, sway=1.2,
                     name=f'front leaves {i + 1}'))
    # the vines: runs of columns, grouped into strips, each at its own depth under the crown
    vy, vx = np.nonzero(vines)
    vy0, vx0 = vy.min(), vx.min()
    vsheet = np.zeros_like(a); vsheet[vines] = a[vines]
    vsheet = vsheet[vy0:vy.max() + 1, vx0:vx.max() + 1]
    vine_path = B1.save_png(vsheet, LEAVES / 'jungle_vines.png')
    cols = vines.any(0)
    runs, cur = [], None
    for x in range(W):
        if cols[x] and cur is None: cur = x
        if not cols[x] and cur is not None: runs.append((cur, x - 1)); cur = None
    if cur is not None: runs.append((cur, W - 1))
    groups = [runs[i:i + 2] for i in range(0, len(runs), 2)]
    depth = (-0.55, 0.45, -0.15, 0.7, -0.75, 0.2, 0.55, -0.4, 0.05)
    for i, g in enumerate(groups):
        x0, x1 = g[0][0], g[-1][1]
        sub = vines[:, x0:x1 + 1]
        rows = np.nonzero(sub.any(1))[0]
        y0, y1 = rows.min(), rows.max()
        xm = ((x0 + x1 + 1) / 2 - ax) / PPM
        xn = max(-1, min(1, xm / Rc))
        L.append(img(vine_path, xm, depth[i % len(depth)] * math.sqrt(1 - xn * xn) * Rc * 0.8, (by - y1) / PPM,
                     clip=[int(x0 - vx0), int(y0 - vy0), int(x1 + 1 - vx0), int(y1 + 1 - vy0)], recv=0, sway=0.7,
                     name=f'vines {i + 1}'))
    L.sort(key=lambda l: l['k'] == 'img')
    return r


DEAD_BRANCHES = [
    # the charred tree's limbs in its drawing's pixels: (x, y, width), and how far each bends back (+) or forward (-)
    ([(50.5, 150, 14), (50.5, 120, 12), (50.5, 90, 11), (50.5, 60, 8), (50, 40, 6), (50, 28, 5.5), (47, 14, 4), (45, 2, 2)], 0.0),
    ([(48, 88, 8), (38, 80, 6), (28, 71, 5), (14, 66, 3), (2, 65, 1.5)], -0.35),
    ([(28, 71, 4), (24, 60, 3), (21, 45, 1.5)], 0.25),
    ([(25, 66, 3), (18, 56, 2.2), (12, 47, 1.2)], -0.15),
    ([(53, 96, 7), (64, 89, 5), (74, 82, 4), (86, 83, 3), (97, 85, 1.5)], 0.35),
    ([(74, 82, 3), (79, 70, 2.5), (82, 60, 1.2)], -0.2),
    ([(80, 70, 2), (88, 63, 1)], -0.3),
    ([(50, 30, 4.5), (56, 16, 3), (63, 2, 1.5)], 0.25),
    ([(46, 16, 2.5), (38, 9, 1.8), (28, 8, 1)], -0.25),
    ([(57, 14, 2.5), (67, 8, 1.6), (74, 4, 1)], 0.2),
]


def dead_recipe():
    """The charred tree: every limb modelled, bending in depth so it reads from every side, a few roots."""
    ax, by = 51, 150
    L = []
    for i, (pts, bend) in enumerate(DEAD_BRANCHES):
        n = len(pts)
        P = [[r2((x - ax) / PPM), r2(bend * (j / (n - 1)) ** 1.3), r2((by - y) / PPM), r2(max(w, 1.6) / 2 / PPM)] for j, (x, y, w) in enumerate(pts)]
        if i:  # a limb starts inside the one it grows from
            P[0][1] = 0.0 if i in (1, 4, 7) else P[0][1]
        L.append({'k': 'limb', 'pts': P, 'sides': 7 if i == 0 else 5, 'col': DEAD_BARK, 'tex': 'bark', 'name': 'trunk' if i == 0 else 'limb'})
    # branches that grow from another: start where their parent passes
    for child, parent, at in ((2, 1, 2), (3, 1, 2), (5, 4, 2), (6, 5, 1), (8, 0, 6), (9, 7, 1)):
        L[child]['pts'][0][1] = L[parent]['pts'][at][1]
    fr = 7 / PPM * 1.3
    for i in range(4):
        an = i * math.pi / 2 + 0.6
        ca, sa = math.cos(an), math.sin(an)
        L.append({'k': 'limb', 'pts': [[r2(ca * fr * 0.3), r2(sa * fr * 0.3), r2(fr * 1.1), r2(fr * 0.42)],
                                       [r2(ca * fr * 1.2), r2(sa * fr * 1.2), r2(fr * 0.3), r2(fr * 0.28)],
                                       [r2(ca * fr * 2.0), r2(sa * fr * 2.0), -0.03, r2(fr * 0.1)]],
                  'sides': 5, 'col': DEAD_BARK, 'tex': 'bark', 'name': 'root'})
    return rec(L, 0.75)


PALMS = {
    # the trunk in the drawing's pixels (x, y, width) from the foot up to the crown; the fronds' reach (metres)
    'palm_tree': (66, 161, [(66, 161, 14), (66.5, 140, 14), (68.5, 110, 13.5), (72, 80, 12.5), (76, 55, 11), (80, 35, 10), (83, 20, 9)], 1.55),
    'palm_small': (38, 74, [(38, 74, 14), (38, 60, 13.5), (39, 48, 12.5), (41, 36, 10.5), (43, 26, 9)], 1.0),
}


def palm_recipe(key):
    """A palm: a ringed trunk curving up (rings as the bark swelling and narrowing), a crown of fronds arching out
    and drooping (each a stem with pairs of leaflets), young fronds pointing up, and coconuts under them."""
    ax, by, pts, reach = PALMS[key]
    X = lambda x: (x - ax) / OLD_PPM
    Z = lambda y: (by - y) / OLD_PPM
    # the trunk: the drawing's line, a ring every 0.22 m
    line = [(X(x), Z(y), w / 2 / OLD_PPM) for x, y, w in pts]
    T = []
    total = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(line, line[1:]))
    steps = max(4, int(total / 0.11))
    seg = [math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(line, line[1:])]
    for s in range(steps + 1):
        d = total * s / steps
        i = 0
        while i < len(seg) - 1 and d > seg[i]: d -= seg[i]; i += 1
        t = min(1, d / seg[i]) if seg[i] else 0
        x = line[i][0] + (line[i + 1][0] - line[i][0]) * t
        z = line[i][1] + (line[i + 1][1] - line[i][1]) * t
        w = line[i][2] + (line[i + 1][2] - line[i][2]) * t
        T.append([r2(x), 0.0, r2(z), r2(w * (1.0 if s % 2 == 0 else 0.86))])
    T[0][3] = r2(T[0][3] * 1.15)
    L = [{'k': 'limb', 'pts': T, 'sides': 8, 'col': PALM_BARK, 'tex': 'bark', 'name': 'trunk'}]
    cx, cy, cz = T[-1][0], 0.0, T[-1][2]
    L.append(sphere(cx, cy, cz - 0.12, 0.16 * reach, PALM_LEAF_D, 'leaves', 'crown heart', 7, 3, h=0.3 * reach))
    rng = np.random.default_rng(len(key))
    n = 8
    for f in range(n):
        an = 2 * math.pi * f / n + 0.3 + (rng.random() - 0.5) * 0.3
        dx, dy = math.cos(an), math.sin(an)
        rise = 0.35 + 0.15 * (f % 2)
        R = reach * (0.9 + 0.2 * rng.random())
        prof = [(0, 0), (0.3, rise * 0.9), (0.6, rise * 0.75), (0.85, rise * 0.2), (1.0, -rise * 0.6)]
        stem = [[r2(cx + dx * R * a), r2(cy + dy * R * a), r2(cz + h * reach), r2(0.035 * reach * (1 - a * 0.8) + 0.006)] for a, h in prof]
        col = PALM_LEAF if f % 2 else PALM_LEAF_D
        L.append({'k': 'limb', 'pts': stem, 'sides': 4, 'col': PALM_LEAF_D, 'tex': 'leaves', 'name': 'frond stem'})
        sx, sy = -dy, dx
        for j in range(7):
            a = 0.14 + 0.13 * j
            k = 0
            while k < len(prof) - 2 and prof[k + 1][0] < a: k += 1
            t = (a - prof[k][0]) / (prof[k + 1][0] - prof[k][0])
            h = prof[k][1] + (prof[k + 1][1] - prof[k][1]) * t
            px_, py_, pz_ = cx + dx * R * a, cy + dy * R * a, cz + h * reach
            ln = reach * 0.5 * (1 - 0.4 * a)
            for side in (-1, 1):
                L.append(limb((px_, py_, pz_), (px_ + (sx * side * 0.9 + dx * 0.4) * ln, py_ + (sy * side * 0.9 + dy * 0.4) * ln, pz_ - ln * 0.45),
                              0.085 * reach, 0.012, col, 'leaves', 'leaflet', 3))
    for f in range(3):  # young fronds standing up from the heart
        an = 2 * math.pi * f / 3 + 1.0
        L.append(limb((cx, cy, cz), (cx + math.cos(an) * 0.25 * reach, cy + math.sin(an) * 0.25 * reach, cz + 0.6 * reach),
                      0.07 * reach, 0.01, PALM_LEAF, 'leaves', 'young frond', 4))
    for f in range(3):
        an = 2 * math.pi * f / 3 - 0.9
        L.append(sphere(cx + math.cos(an) * 0.13 * reach, cy + math.sin(an) * 0.13 * reach, cz - 0.28 * reach, 0.1 * reach, NUT, 'plain', 'coconut', 7, 3))
    return rec(L, 0.75)


# ================================================================ rocks
def boulder_recipe(key):
    """The run biomes' boulders as IS-4's faceted stones: the old picture's size and look in metres."""
    rng = np.random.default_rng(len(key) * 13)
    L = []
    if key == 'boulder':
        S = stone(0, 0.05, -0.12, 1.3, 2.05, ROCK, 'boulder', ry=1.0, sides=8, rings=5, lump=0.22)
        L += [S, stone(-1.15, -0.3, -0.04, 0.3, 0.4, ROCK_D, 'stone', sides=6, rings=3),
              stone(1.1, -0.15, -0.04, 0.24, 0.32, ROCK_L, 'stone', sides=6, rings=3)]
        for i in range(4):  # a little moss in the cracks, as drawn
            L.append(sphere(*on_stone(S, -math.pi / 2 + (rng.random() - 0.5) * 2.2, 0.55 + 0.3 * rng.random()), 0.08, MOSS, 'leaves', 'moss', 6, 2, h=0.06))
    elif key == 'boulder_b':
        S = stone(-0.2, 0.05, -0.12, 1.05, 2.75, ROCK_D, 'tall boulder', ry=0.85, sides=8, rings=5, lump=0.2)
        L += [S, stone(0.35, -0.2, -0.1, 0.75, 1.6, ROCK, 'boulder side', ry=0.6, sides=7, rings=4, lump=0.22),
              stone(1.15, -0.35, -0.03, 0.3, 0.38, ROCK_L, 'stone', sides=6, rings=3)]
    elif key == 'boulder_mossy':
        S = stone(0, 0.05, -0.12, 1.4, 1.9, GREY, 'boulder', ry=1.05, sides=9, rings=5, lump=0.15)
        L += [S, cap(S, 0.78, MOSS, 'moss cap')]
        for i in range(6):  # moss dripping down from the cap
            a = -math.pi / 2 + (i - 2.5) * 0.55
            L.append(sphere(*on_stone(S, a, 0.68 - 0.06 * (i % 2)), 0.13, MOSS_L if i % 2 else MOSS, 'leaves', 'moss', 6, 2, 0.3, h=0.16))
        for i in range(5):  # grass at its foot and a small toadstool
            a = -math.pi / 2 + (i - 2) * 0.7
            x, y, _ = on_stone(S, a, 0.05, 1.08)
            L.append(cyl(x, y, 0, 0.09, 0.22, MOSS_D if i % 2 else MOSS, 'leaves', 'grass', 5, k='cone'))
        x, y, _ = on_stone(S, -math.pi / 2 + 0.45, 0.05, 1.12)
        L += [cyl(x, y, 0, 0.025, 0.12, '#F4F0E8', 'plain', 'toadstool stem', 6),
              cyl(x, y, 0.11, 0.07, 0.05, '#D6704A', 'plain', 'toadstool cap', 8, k='dome')]
    elif key == 'boulder_snow':
        S = stone(0, 0.05, -0.12, 1.4, 1.85, GREY, 'boulder', ry=1.05, sides=9, rings=5, lump=0.15)
        L += [S, cap(S, 0.72, SNOW, 'snow cap', lump=0.08)]
        for x, y, r, h in ((-1.25, -0.35, 0.32, 0.42), (1.2, -0.2, 0.26, 0.34)):
            s = stone(x, y, -0.04, r, h, GREY_D, 'stone', sides=6, rings=3, lump=0.15)
            L += [s, cap(s, 0.6, SNOW_L, 'snow', lump=0.05)]
    elif key == 'boulder_basalt':
        S = stone(0, 0.05, -0.12, 1.1, 2.15, BASALT_D, 'boulder', ry=0.9, sides=7, rings=4, lump=0.18)
        L += [S, stone(-0.95, -0.35, -0.04, 0.3, 0.42, BASALT, 'stone', sides=5, rings=3),
              stone(0.95, -0.25, -0.04, 0.24, 0.3, BASALT_DD, 'stone', sides=5, rings=3)]
    elif key == 'rocks_basalt':
        for i, (x, y, r, h) in enumerate(((-0.55, 0.05, 0.24, 0.62), (-0.1, -0.12, 0.28, 0.42), (0.38, 0.08, 0.22, 0.72), (0.7, -0.18, 0.18, 0.3))):
            L += [cyl(x, y, 0, r, h, BASALT if i % 2 else BASALT_D, 'rock', 'column stub', 6, rot=0.3 * i),
                  cyl(x, y, h, r * 0.96, 0.03, BASALT_TOP, 'rock', 'column top', 6, rot=0.3 * i)]
        L += [stone(-0.85, -0.25, -0.02, 0.14, 0.16, BASALT_DD, 'pebble', sides=5, rings=2),
              stone(0.12, -0.4, -0.02, 0.12, 0.13, BASALT, 'pebble', sides=5, rings=2)]
    return rec(L, 0.8)


def lava_rock_recipe():
    """A lava rock: a dark faceted stone with glowing orange cracks all round it, and its glow."""
    S = stone(0, 0.0, -0.1, 0.95, 1.45, BASALT_D, 'lava rock', ry=0.8, sides=7, rings=4, lump=0.1)
    L = [S, stone(-0.85, -0.25, -0.03, 0.22, 0.28, BASALT, 'stone', sides=5, rings=3)]
    rng = np.random.default_rng(57)
    for i in range(7):
        a = -math.pi / 2 + (i - 3) * 0.85 + (rng.random() - 0.5) * 0.3
        k = 0.3 + 0.4 * rng.random()
        pts = []
        for j in range(3):
            x, y, z = on_stone(S, a + (j - 1) * 0.16 + (rng.random() - 0.5) * 0.1, k + (j - 1) * 0.12, 1.1)
            pts.append([r2(x), r2(y), r2(z), 0.025])
        L.append({'k': 'limb', 'pts': pts, 'sides': 4, 'col': LAVA, 'tex': 'plain', 'name': 'crack'})
    return rec(L, 0.8), fx(('glow', 0, 0.75))


BASALT_COLUMNS = [
    # (x, y, height) metres; the front row as drawn (heights from its picture), a lower row behind
    (-1.2, 0.12, 1.94), (-0.72, -0.12, 2.91), (-0.24, 0.05, 3.68), (0.24, -0.1, 3.26), (0.72, 0.1, 2.56), (1.2, -0.06, 1.76),
    (-0.45, 0.5, 2.4), (0.05, 0.55, 3.0), (0.55, 0.48, 2.1), (-0.95, 0.5, 1.5), (1.0, 0.45, 1.3),
]


def basalt_columns_recipe():
    """Basalt columns: hexagonal prisms of different heights, each with a pale worn top and a joint or two."""
    L = []
    for i, (x, y, h) in enumerate(BASALT_COLUMNS):
        r, rot = 0.27, (i % 3) * 0.17
        col = BASALT if i % 2 == 0 else BASALT_D
        L += [cyl(x, y, 0, r, h, col, 'rock', 'column', 6, rot=rot),
              cyl(x, y, h, r * 0.97, 0.04, BASALT_TOP, 'rock', 'column top', 6, rot=rot)]
        for jz in np.arange(0.95, h - 0.4, 0.95):
            L.append(cyl(x, y, float(jz), r * 1.02, 0.03, BASALT_DD, 'rock', 'joint', 6, rot=rot))
    L += [stone(-1.4, -0.4, -0.02, 0.2, 0.22, BASALT_DD, 'fallen piece', sides=6, rings=2),
          stone(1.35, -0.45, -0.02, 0.15, 0.18, BASALT, 'fallen piece', sides=6, rings=2)]
    return rec(L, 0.8)


# ================================================================ the cave
def stalag(L, x, y, h, r, cols=(CAVE_L, '#BDB2B0', CAVE), name='stalagmite'):
    """a stalagmite: four tapering cones stacked, each a ledge narrower, up to a rounded point"""
    z = 0.0
    for i in range(4):
        hi = h * (0.32, 0.27, 0.24, 0.22)[i]
        r0 = r * (1, 0.72, 0.5, 0.32)[i]
        r1 = r0 * 0.68 if i < 3 else 0.03
        L.append(cyl(x, y, z, r0, hi * 1.08, cols[i % len(cols)], 'rock', name, 7, k='cone', r1=r2(r1), rot=0.4 * i))
        z += hi


def stalagmite_recipe(key):
    L = []
    if key == 'stalagmite':
        stalag(L, 0, 0, 2.62, 0.42)
        L += [stone(-0.55, -0.2, -0.02, 0.16, 0.2, CAVE_D, 'rubble', sides=5, rings=2),
              stone(0.5, -0.1, -0.02, 0.13, 0.16, CAVE, 'rubble', sides=5, rings=2)]
    else:
        stalag(L, 0.3, 0.1, 2.3, 0.4)
        stalag(L, -0.5, -0.05, 1.55, 0.3, ('#BDB2B0', CAVE_L, CAVE))
        stalag(L, 0.88, -0.25, 0.9, 0.2, (CAVE, CAVE_L, '#BDB2B0'))
        stalag(L, -0.1, 0.55, 1.1, 0.22)
        L += [stone(-0.95, -0.3, -0.02, 0.15, 0.18, CAVE_D, 'rubble', sides=5, rings=2),
              stone(0.2, -0.45, -0.02, 0.12, 0.14, CAVE, 'rubble', sides=5, rings=2)]
    return rec(L, 0.8)


def shard(x, y, z, length, r, lean, turn, col, name='crystal'):
    """a crystal: a hexagonal prism leaning `lean` (radians from upright) toward `turn`, ending in a point"""
    dx, dy, dz = math.sin(lean) * math.cos(turn), math.sin(lean) * math.sin(turn), math.cos(lean)
    mid = length * 0.78
    return {'k': 'limb', 'pts': [[r2(x - dx * 0.15), r2(y - dy * 0.15), r2(z - dz * 0.15), r2(r)],
                                 [r2(x + dx * mid), r2(y + dy * mid), r2(z + dz * mid), r2(r)],
                                 [r2(x + dx * length), r2(y + dy * length), r2(z + dz * length), 0.004]],
            'sides': 6, 'col': col, 'tex': 'plain', 'name': name}


def crystals_recipe(key):
    """Glow crystals: prisms fanning out of a bed of cave rock, the tallest in the middle."""
    pal = {'crystal': ICE, 'crystal_purple': AMETHYST, 'crystal_cluster': AQUA}[key]
    rng = np.random.default_rng(len(key) * 31)
    L = []
    if key == 'crystal_cluster':
        L.append(cyl(0, 0, 0, 0.95, 0.18, PLATE, 'rock', 'stone plate', 9, ry=0.55))
        L.append(shard(0.05, 0.05, 0.1, 2.5, 0.2, 0.04, 0, pal[0], 'crystal'))
        for i, (x, y, ln, r, lean, turn) in enumerate(((-0.32, -0.1, 1.5, 0.12, 0.2, math.pi), (0.3, -0.12, 1.25, 0.1, 0.18, 0),
                                                       (0.15, 0.25, 1.1, 0.1, 0.25, 1.4), (-0.25, 0.25, 0.9, 0.09, 0.35, 2.4),
                                                       (0.42, 0.12, 0.8, 0.08, 0.4, 0.4), (-0.1, -0.3, 0.75, 0.08, 0.3, -1.6))):
            L.append(shard(x, y, 0.1, ln, r, lean, turn, pal[1 + i % 3], 'crystal'))
        return rec(L, 0.75)
    # a bed of rock, then the crystals
    L += [stone(0, 0.05, -0.08, 0.75, 0.32, CAVE_D, 'rock bed', ry=0.55, sides=7, rings=3, lump=0.2),
          stone(-0.55, -0.15, -0.04, 0.22, 0.2, CAVE, 'rock', sides=5, rings=2),
          stone(0.6, 0.0, -0.04, 0.2, 0.18, CAVE_L, 'rock', sides=5, rings=2)]
    L.append(shard(0, 0.05, 0.15, 1.95, 0.22, 0.05, 0, pal[0], 'crystal'))
    for i in range(7):
        turn = 2 * math.pi * i / 7 + rng.random() * 0.4
        lean = 0.45 + 0.35 * rng.random()
        L.append(shard(math.cos(turn) * 0.28, 0.05 + math.sin(turn) * 0.22, 0.08, 0.7 + 0.55 * rng.random(), 0.1 + 0.05 * rng.random(),
                       lean, turn, pal[1 + i % 3], 'crystal'))
    return rec(L, 0.75)


def crystal_spire_recipe():
    """The crystal spire, a landmark: a great blue prism with others round it, one tall purple, small ones all round
    its foot, on a broad slab of cave rock."""
    L = [cyl(0, 0, 0, 3.0, 0.55, PLATE, 'rock', 'slab', 8, ry=1.7, rot=0.2),
         cyl(0, 0, 0.55, 2.7, 0.06, CAVE_D, 'rock', 'slab top', 8, ry=1.5, rot=0.2)]
    big = [(0.0, 0.0, 10.0, 0.78, 0.02, 0, AQUA[0]), (-1.1, -0.15, 7.6, 0.55, 0.1, math.pi, AQUA[1]),
           (-2.2, 0.1, 5.9, 0.45, 0.2, math.pi + 0.1, AQUA[2]), (1.15, -0.25, 5.4, 0.4, 0.12, -0.2, AQUA[1]),
           (2.3, 0.05, 8.0, 0.55, 0.16, 0.05, SPIRE_PURPLE[0]), (0.4, 0.75, 6.5, 0.5, 0.15, 1.4, AQUA[2]),
           (-0.8, 0.8, 4.8, 0.4, 0.22, 2.2, SPIRE_PURPLE[1])]
    for x, y, ln, r, lean, turn, col in big:
        L.append(shard(x, y, 0.5, ln, r, lean, turn, col, 'crystal'))
    rng = np.random.default_rng(311)
    for i in range(10):
        turn = 2 * math.pi * i / 10 + rng.random() * 0.3
        x, y = math.cos(turn) * 2.3, math.sin(turn) * 1.25
        L.append(shard(x, y, 0.45, 1.3 + rng.random() * 1.3, 0.16 + rng.random() * 0.08, 0.3 + rng.random() * 0.3, turn,
                       SPIRE_PURPLE[i % 2] if i % 3 == 0 else AQUA[1 + i % 3], 'small crystal'))
    return rec(L, 0.75)


def cave_house_recipe():
    """A cave dwelling: a big rock mound with moss on its top, a stone porch round an arched wooden door, a round lit
    window, a lantern on a bracket and an iron chimney. Built round its middle, then moved back so its front is at the
    base point and its footprint (4 x 2.4 m) behind it, as the picture stood."""
    L = []
    M = stone(0, 0, -0.15, 2.1, 3.15, CAVE_L, 'mound', ry=1.25, sides=10, rings=5, lump=0.1)
    L += [M, stone(-1.65, 0.1, -0.1, 0.85, 1.9, CAVE, 'mound side', ry=0.95, sides=8, rings=4, lump=0.15),
          stone(1.7, 0.15, -0.1, 0.8, 2.1, CAVE_D, 'mound side', ry=0.95, sides=8, rings=4, lump=0.15),
          cap(M, 0.8, MOSS, 'moss cap', lump=0.2)]
    for i in range(7):  # moss hanging over the edge and grass on top
        a = -math.pi / 2 + (i - 3) * 0.45
        L.append(sphere(*on_stone(M, a, 0.74 - 0.05 * (i % 2)), 0.16, MOSS_L if i % 2 else MOSS, 'leaves', 'moss', 6, 2, 0.3, h=0.2))
    for i in range(9):
        a = -math.pi / 2 + (i - 4) * 0.6
        x, y, z = on_stone(M, a, 0.9, 0.98)
        L.append(cyl(x, y, z, 0.08, 0.3, MOSS if i % 2 else MOSS_D, 'leaves', 'grass', 5, k='cone'))
    # the porch and the door (the door point is 6 px right of the base point: 0.18 m)
    dx = 0.18
    L += [box(dx, -1.05, 0, 1.16, 0.4, 1.3, GREY_L, 'rock', 'porch'),
          disc(dx, -1.06, 1.3, (0, -1, 0), 0.58, 0.2, GREY_L, 'rock', 'porch arch', 14),
          box(dx, -1.25, 0, 0.8, 0.12, 1.25, WOOD, 'wood', 'door'),
          disc(dx, -1.25, 1.25, (0, -1, 0), 0.4, 0.06, WOOD, 'wood', 'door top', 12),
          box(dx, -1.32, 0.95, 0.3, 0.04, 0.16, LIT, 'plain', 'door light'),
          sphere(dx + 0.26, -1.33, 0.62, 0.035, '#F0C048', 'metal', 'handle', 6, 3),
          box(dx, -1.4, 0, 1.0, 0.35, 0.08, GREY, 'rock', 'step')]
    # the round window, left of the door
    wx, wz = -1.09, 1.15
    wy = -M['ry'] * math.sqrt(max(0, 0.97 - (wx / M['r']) ** 2)) - 0.05
    n = (-0.35, -0.94, 0.0)
    L += [disc(wx, wy, wz, n, 0.32, 0.12, WOOD_D, 'wood', 'window frame', 14),
          disc(wx, wy, wz, n, 0.25, 0.15, LIT, 'plain', 'window glass', 14),
          limb((wx - 0.24 * 0.94, wy - 0.16 + 0.24 * 0.35, wz), (wx + 0.24 * 0.94, wy - 0.16 - 0.24 * 0.35, wz), 0.02, 0.02, WOOD_D, 'wood', 'window bar', 4),
          limb((wx + 0.35 * -0.16, wy - 0.16, wz - 0.24), (wx + 0.35 * -0.16, wy - 0.16, wz + 0.24), 0.02, 0.02, WOOD_D, 'wood', 'window bar', 4)]
    # the lantern, right of the door
    lx, lz = 1.18, 1.2
    ly = -M['ry'] * math.sqrt(max(0, 0.97 - (lx / M['r']) ** 2))
    L += [limb((lx - 0.3, ly + 0.1, lz + 0.42), (lx, ly - 0.25, lz + 0.42), 0.02, 0.02, IRON, 'metal', 'bracket', 4),
          box(lx, ly - 0.25, lz - 0.1, 0.2, 0.2, 0.3, LIT, 'plain', 'lantern glass'),
          box(lx, ly - 0.25, lz + 0.2, 0.26, 0.26, 0.06, IRON, 'metal', 'lantern top'),
          box(lx, ly - 0.25, lz - 0.14, 0.24, 0.24, 0.05, IRON, 'metal', 'lantern base')]
    # the chimney, out of the moss
    L += [cyl(0.97, 0.1, 2.2, 0.14, 1.4, IRON, 'metal', 'chimney', 8),
          cyl(0.97, 0.1, 3.58, 0.19, 0.08, CAVE_DD, 'metal', 'chimney cap', 8)]
    B1.shift_y(L, 1.3)
    return rec(L, 0.75), fx(('smoke', 0.97, 3.7), ('window', wx, wz), ('glow', lx, lz))


# ================================================================ the catalogue
MADE = {
    # key: recipe; a recipe gives the model, or (the model, its effects)
    'tree_pine_snow': lambda: snow_pine_recipe('tree_pine_snow', 0),
    'tree_pine_snow_b': lambda: snow_pine_recipe('tree_pine_snow_b', 1),
    'tree_pine_snow_small': lambda: snow_pine_recipe('tree_pine_snow_small', 2),
    'tree_olive': olive_recipe, 'tree_jungle': jungle_recipe, 'tree_dead': dead_recipe,
    'palm_tree': lambda: palm_recipe('palm_tree'), 'palm_small': lambda: palm_recipe('palm_small'),
    'boulder': lambda: boulder_recipe('boulder'), 'boulder_b': lambda: boulder_recipe('boulder_b'),
    'boulder_mossy': lambda: boulder_recipe('boulder_mossy'), 'boulder_snow': lambda: boulder_recipe('boulder_snow'),
    'boulder_basalt': lambda: boulder_recipe('boulder_basalt'), 'rocks_basalt': lambda: boulder_recipe('rocks_basalt'),
    'lava_rock': lava_rock_recipe, 'basalt_columns': basalt_columns_recipe,
    'stalagmite': lambda: stalagmite_recipe('stalagmite'), 'stalagmite_b': lambda: stalagmite_recipe('stalagmite_b'),
    'crystal': lambda: crystals_recipe('crystal'), 'crystal_purple': lambda: crystals_recipe('crystal_purple'),
    'crystal_cluster': lambda: crystals_recipe('crystal_cluster'), 'crystal_spire': crystal_spire_recipe,
    'cave_house': cave_house_recipe,
}
# made things that stand square, as their pictures did; the trees, rocks and stalagmites turn at random
SQUARE = ('crystal', 'crystal_purple', 'crystal_cluster', 'crystal_spire', 'basalt_columns', 'cave_house')
# effects drawn on the old pictures that move to the same place on the model
KEEP_FX = ('crystal', 'crystal_purple', 'crystal_cluster', 'crystal_spire')
# the showcase map's rows
ROWS = [('tundra', ['tree_pine_snow', 'tree_pine_snow_b', 'tree_pine_snow_small', 'boulder_snow', 'tree_pine'], 3.6),
        ('jungle-beach', ['tree_jungle', 'palm_tree', 'palm_small', 'tree_olive', 'boulder_mossy'], 6.0),
        ('volcano', ['tree_dead', 'boulder_basalt', 'rocks_basalt', 'lava_rock', 'basalt_columns'], 3.6),
        ('rocks', ['boulder', 'boulder_b', 'boulder_mossy', 'boulder_snow', 'boulder_lichen'], 3.6),
        ('cave', ['stalagmite', 'stalagmite_b', 'crystal', 'crystal_purple', 'crystal_cluster'], 3.0),
        ('cave-big', ['crystal_spire', 'cave_house'], 9.0)]


def showcase(C):
    """test_props_biomes: each row this batch's models side by side, with a neighbour already a model"""
    rows = [(name, [(k, 0) for k in keys], None, gap) for name, keys, gap in ROWS]
    saved = B1.ROWS
    B1.ROWS = rows
    M = B1.test_map(C)
    B1.ROWS = saved
    M['name'] = 'Test: the run biomes’ trees, rocks and cave things (phase 09 batch 11 part 2)'
    return M


def main():
    D = gamedata.load()
    C = D['scenery']['props']
    for key, fn in MADE.items():
        out = fn()
        model, effects = out if isinstance(out, tuple) else (out, None)
        M = C[key]
        first = 'model' not in M  # a rerun finds the effects already moved
        M['model'] = B1.write_recipe(key, model)
        M['ppm'] = PPM
        if key in SQUARE:
            M['vary'] = dict(FIXED)
        if effects is not None:
            M['fx'] = effects
        elif key in KEEP_FX and M.get('fx') and first:
            M['fx'] = old_fx(M['fx'])
        for f in ('build', 'layers', 'vol', 'volDepth'):
            M.pop(f, None)
    D['maps']['test_props_biomes'] = showcase(C)
    gamedata.save(D)
    print('made:', ', '.join(MADE))


if __name__ == '__main__':
    main()
