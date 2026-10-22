#!/usr/bin/env python3
"""Phase 09, batch 10: the last picture trees the runs place, as models in the batch 1 tree style (a modelled trunk,
roots and branches; the leaves the old drawing, cut into clumps that face the camera and sway). Swapped straight in
under their own keys, as batches 1-8 were, so every placement draws the new tree.

  1. Ridge: the pine, the tall pine, the young pine and the cypress; and the larch (batch 2's, its crown one picture)
     rebuilt the same way, so every conifer matches. The pines keep their drawn tiers (the owner: keep
     how they look now, as 3D props): a modelled trunk, mast and roots, and each drawn tier a part of its own that
     sways on its own; the cypress the same with its drawn lobes. A conifer looks the same from every side, so its
     parts stay centred on the mast and are pulled a little toward the eye (a picture layer's new 'front').
  2. Autumn: the autumn rowan (the rowan's model with its leaves recoloured to its own drawing, as the autumn hazel and
     poplar are) and the great autumn oak (built like Copperleaf's great oak from its own drawing, without the swing).

    python3 tools/build-props-batch10.py        # writes everything below; run it again after changing it

Writes game/art/scene/next/models/tree_*.json, game/art/scene/next/leaves/*.png, the catalogue entries in
game/data/scenery.json, and the showcase map test_props_wild (this batch's rows; test_props_next is full).
Independent of batches 1-9 apart from their helpers: it reads batch 1's tree tool and the rowan batch 2 built.
"""
import importlib.util
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import gamedata  # noqa: E402

spec = importlib.util.spec_from_file_location('batch1', ROOT / 'tools' / 'build-props-batch1.py')
B1 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(B1)
PPM, r2 = B1.PPM, B1.r2
LEAVES = B1.NEXT / 'leaves'

# 1. the ridge's trees: (picture, clumps, limbs as ((x, y) at the foot, (x, y) at the top, width there, width there)).
# A conifer's second limb is its mast, hidden in the crown, carrying the tiers (the larch's way, batch 2).
# 'tiers': the clumps are the drawing's own tiers (found from the drawing, tiers_of), not k-means blobs
CONIFERS = {
    'tree_pine': ('tree_pine', 'tiers', [((45.5, 191), (45.5, 172), 12, 11), ((45.5, 174), (45.5, 24), 6, 2)]),
    'tree_pine_b': ('tree_pine_b', 'tiers', [((39.5, 241), (39.5, 220), 10, 9), ((39.5, 222), (39.5, 30), 5, 2)]),
    'tree_pine_small': ('tree_pine_small', 'tiers', [((30.5, 113), (30.5, 93), 9, 8), ((30.5, 95), (30.5, 16), 4, 1.5)]),
    # the larch (batch 2 built it with its crown one picture) gets the pines' build, so every conifer matches
    'tree_larch': ('tree_larch', 'tiers', [((44.5, 137), (45, 118), 11, 9), ((45, 120), (45, 40), 6, 2)]),
    # the cypress's crown is drawn as stacked lobes: clumps, like a broadleaf's
    'tree_cypress': ('tree_cypress', 5, [((16.5, 170), (16.5, 160), 10, 9), ((16.5, 162), (16.5, 24), 5, 2)]),
}
# 2. looks that are another tree's model with their leaves recoloured to their own drawing: key -> the tree it uses
AUTUMN = {'tree_rowan_autumn': 'tree_rowan'}
# the great autumn oak: the great oak's trunk and arms (batch 1's GIANT_LIMBS), its drawing one row lower
GIANT_DY = 1


def tiers_of(canopy):
    """A conifer's tiers from its drawing: going down the crown, a tier ends where the crown's width steps in again
    (the scalloped hem of one tier over the narrow top of the next). Returns [(top row, bottom row)], top first."""
    rows = [(y, np.nonzero(canopy[y])[0]) for y in range(canopy.shape[0])]
    width = {y: (xs[-1] - xs[0] + 1) if len(xs) else 0 for y, xs in rows}
    ys = [y for y, w in width.items() if w]
    top, bottom = ys[0], ys[-1]
    # a hem: the widest row of a tier (none wider in the three above), with the crown narrower by at least 3 px (and
    # 6% of its width) within the four rows below it (a hem can taper in over a few rows), where the next tier's top shows under it
    cuts = []
    for y in range(top + 6, bottom - 4):
        w = width[y]
        if w < 10 or any(width[y - d] > w for d in range(1, 4)): continue
        if min(width[y + d] for d in range(1, 5)) <= w - max(3, 0.06 * w):
            # the hem's own row: the widest (the lowest of equals) before the crown steps in
            end = next((y + d for d in range(1, 5) if width[y + d] <= w - max(3, 0.06 * w)), y + 1)
            c = max(range(y, end), key=lambda r: (width[r], r))
            if not cuts or c - cuts[-1] >= 8:
                cuts.append(c)
    bands, y0 = [], top
    for c in cuts:
        bands.append((y0, c)); y0 = c + 1
    bands.append((y0, bottom))
    # a sliver of a band (under 6 rows) joins the band above it
    out = []
    for b in bands:
        if out and b[1] - b[0] < 6: out[-1] = (out[-1][0], b[1])
        else: out.append(b)
    return out


def conifer_recipe(key, pic, k, limbs, seed):
    """A conifer as batch 1's tree tool makes the larch (a modelled trunk, mast and roots), then its crown cut into
    parts that each sway on their own: a pine's drawn tiers as bands (box clips), or a cypress's lobes as clumps
    (circles). A conifer is the same from every side, so every part stays centred on the mast (a broadleaf's clumps
    stand off it in depth; a pine's tiers would zigzag as the camera turns) and is pulled toward the eye by a little
    more than the mast is thick there (front), so the mast never shows through the crown."""
    clumped = k != 'tiers'
    rec, sheet_path, sheet, canopy = B1.tree_recipe(key.replace('tree_', ''), pic, k if clumped else 0, limbs, LEAVES, seed)
    a = B1.rgba(B1.PROPS / f'{pic}.png')
    H, W = a.shape[:2]
    ax, by = W / 2, H - 1
    ys, xs = np.nonzero(canopy)
    sx0, sy0 = xs.min(), ys.min()
    # the clumps' branches reach out to clumps standing off the mast; these stand on it
    L = [l for l in rec['layers'] if l.get('name') != 'branch']
    rec['layers'] = L
    core = next(l for l in L if l.get('name', '').startswith('crown'))
    # the whole crown stays behind its parts, a shade darker, and casts the crown's shadow
    core.update({'shade': 0.8, 'name': 'crown core', 'y': 0, 'sway': 0.5})
    # the mast stands straight up the middle: the tool bends an arm in depth, but a conifer's mast is its stem
    for l in L:
        if l.get('name') == 'limb':
            for q in l['pts']: q[1] = 0
    mast_r = max(p[3] for l in L if l.get('name') == 'limb' for p in l['pts'])
    if clumped:
        parts = [l for l in L if l.get('name', '').startswith('leaves')]
        parts.sort(key=lambda l: -l['z'])  # top first
        for i, l in enumerate(parts):
            t = i / max(1, len(parts) - 1)
            l.update({'y': 0, 'front': r2(mast_r + 0.06 + 0.02 * i), 'sway': r2(0.6 + 0.5 * (1 - t))})
        return rec
    for i, (t0, t1) in enumerate(tiers_of(canopy)):
        band = canopy[t0:t1 + 1]
        bx = np.nonzero(band.any(0))[0]
        x0, x1 = bx.min(), bx.max()
        # the band: the tier's rows, as wide as the tier (a box clip: prop-models.js leafCut), in the leaf picture's
        # pixels; it stands on its bottom middle
        clip = [int(x0 - sx0), int(t0 - sy0), int(x1 + 1 - sx0), int(t1 + 1 - sy0)]
        n = len(tiers_of(canopy))
        t = i / max(1, n - 1)  # 0 at the top, 1 at the foot
        L.append({'k': 'img', 'img': sheet_path, 'clip': clip, 'x': r2(((x0 + x1 + 1) / 2 - ax) / PPM), 'y': 0,
                  'z': r2((by - t1) / PPM), 'front': r2(mast_r + 0.06 + 0.02 * i), 'recv': 0,
                  'sway': r2(0.6 + 0.5 * (1 - t)), 'name': f'tier {i + 1}'})
    # the solid parts first, then the pictures: the core, then the tiers from the top down
    L.sort(key=lambda l: (l['k'] == 'img', l.get('name', '').startswith('tier'), int(l['name'].split()[1]) if l.get('name', '').startswith('tier') else 0))
    return rec


def giant_autumn_recipe():
    """The great autumn oak: Copperleaf's great oak's build (16 clumps, its trunk and arms, the knot hole on the trunk's
    front) from its own drawing, without the swing."""
    limbs = [((x0, y0 + GIANT_DY), (x1, y1 + GIANT_DY), w0, w1) for (x0, y0), (x1, y1), w0, w1 in B1.GIANT_LIMBS]
    P = 'tree_giant_autumn'
    rec, sheet_path, sheet, canopy = B1.tree_recipe('giant_autumn', P, 16, limbs, LEAVES, 1300)
    L = rec['layers']
    tr = B1.rgba(B1.PROPS / f'{P}.png')
    from collections import Counter
    d = GIANT_DY
    tc = [c for c, n in Counter(tuple(tr[y, x, :3]) for y in range(300 + d, 360 + d) for x in range(170, 210) if tr[y, x, 3]).most_common(6)]
    kx0, ky0, kx1, ky1 = 186, 284 + d, 208, 312 + d
    knot = B1.decal(P, (kx0, ky0, kx1, ky1), 'giant_autumn_knot', clear=tuple(B1.hexc(c) for c in tc))
    trunk_r = next(l for l in L if l.get('name') == 'trunk')['pts'][4][3]
    kx, kz = B1.at(P, (kx0 + kx1) / 2, ky1 - 1)
    L.append(B1.img(knot, kx, -(trunk_r + 0.12), kz, face='fixed', name='knot hole'))
    L.sort(key=lambda l: l['k'] == 'img')
    return rec


# the showcase map: each row this batch's trees beside the trees they stand with in their biome
ROWS = [
    ('ridge', ['tree_pine', 'tree_pine_b', 'tree_pine_small', 'tree_cypress', 'tree_larch'], 3.6),
    ('autumn', ['tree_rowan', 'tree_rowan_autumn', 'tree_oak_autumn'], 4.5),
    ('giant', ['tree_giant_autumn', 'tree_giant_swing'], 10),
]


def showcase(C):
    rows = [(name, [(k, 0) for k in keys], None, gap) for name, keys, gap in ROWS]
    saved = B1.ROWS
    B1.ROWS = rows
    M = B1.test_map(C)
    B1.ROWS = saved
    M['name'] = 'Test: the run biomes’ trees in the new style (phase 09 batch 10)'
    return M


def main():
    D = gamedata.load()
    C = D['scenery']['props']
    built = {}
    for i, (key, (pic, k, limbs)) in enumerate(CONIFERS.items()):
        rec = conifer_recipe(key, pic, k, limbs, 1000 + i)
        built[key] = (B1.write_recipe(key, rec),)
    for key, base in AUTUMN.items():
        model = C[base]['model']
        sheet_path = 'scene/next/leaves/' + base.replace('tree_', '') + '.png'
        sheet = B1.rgba(B1.ART / sheet_path)
        own = B1.rgba(B1.PROPS / f'{key}.png'); _, oc = B1.split_trunk(own)
        src = B1.rgba(B1.PROPS / f'{base}.png'); _, sc = B1.split_trunk(src)
        swapped = B1.save_png(B1.recolour(sheet, B1.leaf_colours(src, sc), B1.leaf_colours(own, oc)),
                              LEAVES / (key.replace('tree_', '') + '.png'))
        built[key] = (model, {sheet_path: swapped})
    built['tree_giant_autumn'] = (B1.write_recipe('tree_giant_autumn', giant_autumn_recipe()),)
    for key, v in built.items():
        M = C[key]
        for f in ('layers', 'vol', 'volDepth', 'build'):
            M.pop(f, None)
        M['model'] = v[0]
        M['ppm'] = PPM
        if len(v) > 1:
            M['swap'] = v[1]
    D['maps']['test_props_wild'] = showcase(C)
    gamedata.save(D)
    print('trees:', ', '.join(built))


if __name__ == '__main__':
    main()
