#!/usr/bin/env python3
"""Phase 09, batch 4: the last made things of Copperleaf Town and Route 1 · Hedgerow Lane in the new style, after the
cottages (tools/build-props-batch3.py): fully modelled, slim parts and small details, the building sheet's 32 px
materials and the airship's warm palette. Only what reads better drawn stays a picture (the bunting's pennants, which
flutter). Swapped straight in under their own keys, so every placement in every scene draws the new one.

  barrel_wood banner_bunting beehive bench_wood birdhouse dock_post fence_wood flowerpot garden_gnome picket_fence
  planter_box planter_round rowboat scarecrow signpost waystone well wheelbarrow

The airship and its station were already models (tools/build-airship.py); their pictures and effects are at 34 px to
the metre, so they keep the scenery's scale and are not touched here.

    python3 tools/build-props-batch4.py      (after batch1, batch2 and batch3)
"""
import importlib.util
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import gamedata  # noqa: E402


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'tools' / file)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


B1 = load('batch1', 'build-props-batch1.py')
B2 = load('batch2', 'build-props-batch2.py')
B3 = load('batch3', 'build-props-batch3.py')
PPM, A = B1.PPM, B1.AIR
box, limb, disc, sphere, cyl, img = B1.box, B1.limb, B1.disc, B1.sphere, B1.cyl, B1.img
r2, np = B1.r2, B1.np
S2 = math.sqrt(2)
INK = (42, 30, 52)
TERRACOTTA, WHITE, LEAF, LEAF2 = '#C8664A', '#F4F0E8', '#5E9A48', '#6EAE52'
FLOWERS = ('#E87EA8', A['lamp'], WHITE, '#C478D0', '#E86A5A')


def rec(L, cel=0.7):
    return {'ppm': PPM, 'cel': cel, 'layers': sorted(L, key=lambda l: l['k'] == 'img')}


def gable(x, y, z, hw, hd, h, col, tex, name, ridge='x'):
    """A gable roof: a 4-sided cone turned square, its top drawn out to a ridge along x (or y)."""
    kw = {'r1': r2(hw * S2), 'ry1': 0.02} if ridge == 'x' else {'r1': 0.02, 'ry1': r2(hd * S2)}
    return cyl(x, y, z, hw * S2, h, col, tex, name, 4, k='cone', ry=r2(hd * S2), rot=r2(math.pi / 4), **kw)


def ring(x, y, z, r, t, col, tex, name, n=16, ry=None):
    """A ring lying flat (a well's rim, a rope coil): a closed limb round a circle."""
    ry = ry or r
    pts = [[r2(x + math.cos(2 * math.pi * i / n) * r), r2(y + math.sin(2 * math.pi * i / n) * ry), r2(z), r2(t)] for i in range(n + 1)]
    return {'k': 'limb', 'pts': pts, 'sides': 6, 'col': col, 'tex': tex, 'name': name}


def leafy(L, x, y, z, r, n, seed, spread, flowers=True, h=None):
    """A clump of leafy balls with a few flowers on top, for pots and planters."""
    rng = np.random.default_rng(seed)
    for i in range(n):
        a = rng.random() * 2 * math.pi
        f = 0 if i == 0 else spread * (0.5 + 0.5 * rng.random())
        px, py = x + math.cos(a) * f, y + math.sin(a) * f * 0.7
        rr = r * (1 if i == 0 else 0.7 + 0.25 * rng.random())
        L.append(sphere(px, py, z - rr * 0.3, rr, LEAF2 if i % 2 else LEAF, 'leaves', 'leaves', 9, 4, 0.3, h))
        if flowers and i % 2 == 0:
            L.append(sphere(px + 0.02, py - rr * 0.6, z + rr * 1.15, 0.045, FLOWERS[(i // 2 + seed) % 5], 'plain', 'flower', 6, 3))


# ---------------------------------------------------------------- small things
def barrel_recipe():
    """A cooper's barrel: bellied staves, three iron hoops, a lid of planks with a bung."""
    r, h, bu = 0.36, 0.95, 0.1
    L = [cyl(0, 0, 0, r, h, A['wood'], 'wood', 'staves', 16, k='barrel', bulge=bu)]
    for z in (0.1, h / 2 - 0.03, h - 0.15):
        rr = r * (1 - 2 * bu + 2 * bu * math.sin(math.pi * (z + 0.03) / h)) + 0.012
        L.append(cyl(0, 0, z, rr, 0.06, A['iron'], 'metal', 'hoop', 16))
    L += [cyl(0, 0, h - 0.02, r * 0.78, 0.03, A['plank'], 'rings', 'lid', 16),
          box(0, 0, h + 0.005, r * 1.5, 0.02, 0.02, A['dwood'], 'wood', 'lid seam'),
          cyl(0.12, -0.1, h + 0.005, 0.045, 0.03, A['dwood'], 'wood', 'bung', 8),
          disc(0, -r - 0.005, 0.55, (0, -1, 0), 0.04, 0.02, A['brass'], 'metal', 'tap plate', 8)]
    return rec(L)


def beehive_recipe():
    """Juniper's hives: three stacked boxes in cream and honey on a little stand, a landing board and entrance, a
    copper-topped roof, a few bees out front."""
    w, d = 0.62, 0.56
    L = [box(0, 0, 0.18, w + 0.08, d + 0.08, 0.06, A['dwood'], 'wood', 'stand top')]
    for sx in (-1, 1):
        for sy in (-1, 1):
            L.append(box(sx * (w / 2 - 0.03), sy * (d / 2 - 0.03), 0, 0.07, 0.07, 0.18, A['dwood'], 'wood', 'stand leg'))
    z = 0.24
    L += [box(0, -d / 2 - 0.06, z, w * 0.8, 0.14, 0.03, A['plank'], 'wood', 'landing board')]
    for i, (hh, col) in enumerate(((0.3, A['cream']), (0.26, '#F0C878'), (0.26, A['cream']))):
        L += [box(0, 0, z, w, d, hh - 0.01, col, 'wood', 'hive box'),
              box(0, 0, z + hh - 0.02, w + 0.02, d + 0.02, 0.025, A['plank'], 'wood', 'box lip'),
              box(0, -d / 2 - 0.005, z + hh * 0.55, 0.14, 0.02, 0.04, A['dwood'], 'wood', 'hand hold')]
        if i == 0:
            L.append(box(0, -d / 2 - 0.006, z + 0.01, w * 0.55, 0.02, 0.04, '#2A1E34', 'plain', 'entrance'))
        z += hh
    L += [box(0, 0, z, w + 0.12, d + 0.12, 0.1, A['plank'], 'wood', 'roof rim'),
          box(0, 0, z + 0.1, w + 0.16, d + 0.16, 0.05, A['copper'], 'metal', 'roof top'),
          sphere(0, 0, z + 0.14, 0.05, A['brass'], 'metal', 'roof knob', 8, 4)]
    for bx, bz in ((-0.18, 0.45), (0.12, 0.62), (0.3, 0.38)):
        L += [sphere(bx, -d / 2 - 0.25, bz, 0.025, '#F4C03C', 'stripes', 'bee', 6, 3),
              sphere(bx + 0.01, -d / 2 - 0.25, bz + 0.04, 0.018, '#E8F4FF', 'plain', 'bee wing', 5, 2)]
    return rec(L)


def bench_recipe():
    """A park bench: dark wood ends with armrests, honey slats for the seat and back."""
    w, d = 1.6, 0.6
    L = []
    for sx in (-1, 1):
        x = sx * (w / 2 - 0.08)
        L += [box(x, -0.2, 0, 0.08, 0.08, 0.42, A['dwood'], 'wood', 'front leg'),
              limb((x, 0.2, 0), (x, 0.27, 0.92), 0.045, 0.04, A['dwood'], 'wood', 'back leg', 4),
              box(x, 0, 0.36, 0.06, 0.46, 0.05, A['dwood'], 'wood', 'seat rail'),
              box(x, -0.04, 0.62, 0.1, 0.56, 0.05, A['dwood'], 'wood', 'armrest'),
              box(x, -0.2, 0.42, 0.06, 0.06, 0.2, A['dwood'], 'wood', 'arm post'),
              sphere(x, -0.33, 0.6, 0.035, A['brass'], 'metal', 'arm knob', 8, 4)]
    for i, y in enumerate((-0.2, -0.06, 0.08)):
        L.append(box(0, y, 0.41, w - 0.08, 0.12, 0.04, A['plank'] if i % 2 else '#D6A26C', 'wood', 'seat slat'))
    for i, z in enumerate((0.56, 0.7, 0.84)):
        L.append(box(0, 0.22 + (z - 0.56) * 0.08, z, w - 0.08, 0.04, 0.1, A['plank'] if i % 2 else '#D6A26C', 'wood', 'back slat'))
    L.append(box(0, 0.05, 0.12, w - 0.2, 0.05, 0.05, A['dwood'], 'wood', 'stretcher'))
    return rec(B1.shift_y(L, d / 2))


def birdhouse_recipe():
    """A birdhouse on a pole: a cream house under a steep red roof, a round door, a perch, a bird on the roof."""
    pz = 2.0
    L = [cyl(0, 0, 0, 0.1, 0.06, A['stone'], 'stone', 'foot', 8),
         limb((0, 0, 0), (0, 0, pz), 0.05, 0.045, A['wood'], 'wood', 'pole', 6),
         box(0, 0, pz, 0.46, 0.4, 0.05, A['dwood'], 'wood', 'shelf'),
         limb((0, 0, pz - 0.35), (0, -0.16, pz - 0.02), 0.02, 0.02, A['dwood'], 'wood', 'brace', 4),
         box(0, 0, pz + 0.05, 0.34, 0.3, 0.38, A['cream'], 'siding', 'house'),
         gable(0, 0, pz + 0.43, 0.24, 0.22, 0.26, '#D8584A', 'shingles', 'roof', 'y'),
         disc(0, -0.15, pz + 0.27, (0, -1, 0), 0.065, 0.015, A['dwood'], 'wood', 'hole rim', 12),
         disc(0, -0.15, pz + 0.27, (0, -1, 0), 0.05, 0.02, '#2A1E34', 'plain', 'hole', 12),
         limb((0, -0.15, pz + 0.15), (0, -0.25, pz + 0.15), 0.012, 0.012, A['dwood'], 'wood', 'perch', 4)]
    # a little bird on the ridge
    L += [sphere(0.02, 0.05, pz + 0.67, 0.06, '#6A8CC8', 'plain', 'bird', 8, 4, h=0.1),
          sphere(0.02, -0.02, pz + 0.73, 0.04, '#6A8CC8', 'plain', 'bird head', 8, 4),
          sphere(0.02, -0.05, pz + 0.71, 0.02, '#F4E8C8', 'plain', 'bird chest', 6, 3),
          cyl(0.02, -0.07, pz + 0.745, 0.012, 0.01, A['lamp'], 'plain', 'beak', 4)]
    return rec(L)


def dock_post_recipe():
    """A weathered mooring post: a round pile with a cut top, an iron band, a coil of rope and green at the waterline."""
    h = 1.25
    L = [{'k': 'limb', 'pts': [[0, 0, -0.3, 0.13], [0.01, 0, 0.6, 0.125], [0, 0, h, 0.12]], 'sides': 8, 'col': '#8E6A4E', 'tex': 'bark', 'name': 'pile'},
         cyl(0, 0, -0.1, 0.14, 0.25, '#4E7A4A', 'leaves', 'weed', 8),
         cyl(0, 0, h - 0.2, 0.135, 0.06, A['iron'], 'metal', 'band', 8),
         ring(0, 0, 0.75, 0.15, 0.03, '#D6C08A', 'cloth', 'rope coil', 12),
         ring(0, 0, 0.8, 0.15, 0.03, '#C8B07A', 'cloth', 'rope coil', 12),
         limb((0, -0.15, 0.77), (0.05, -0.32, 0.5), 0.03, 0.03, '#D6C08A', 'cloth', 'rope end', 5)]
    return rec(L)


def fence_wood_recipe():
    """A rustic fence: three split posts with sloped tops and two round rails that carry on into the next length."""
    w, d = 2.2, 0.25
    L = []
    for x in (-1.0, 0.0, 1.0):
        L += [box(x, 0, 0, 0.13, 0.13, 0.96, A['wood'], 'wood', 'post'),
              cyl(x, 0, 0.96, 0.092, 0.08, A['wood'], 'wood', 'post top', 4, k='cone', r1=0.02, rot=r2(math.pi / 4))]
    for z, sag in ((0.42, 0.02), (0.78, 0.03)):
        pts = [[r2(-w / 2 + w * i / 4), -0.08, r2(z - sag * math.sin(math.pi * i / 4)), 0.045] for i in range(5)]
        L.append({'k': 'limb', 'pts': pts, 'sides': 6, 'col': '#A06A42', 'tex': 'bark', 'name': 'rail'})
    return rec(B1.shift_y(L, d / 2))


def picket_fence_recipe():
    """A white picket fence: pointed pickets on two rails, a post at the middle."""
    w, d = 2.2, 0.25
    L = [box(0, 0.03, 0.18, w, 0.04, 0.08, '#E6E2DA', 'wood', 'rail'),
         box(0, 0.03, 0.6, w, 0.04, 0.08, '#E6E2DA', 'wood', 'rail'),
         box(0, 0.06, 0, 0.12, 0.1, 0.92, '#E6E2DA', 'wood', 'post'),
         sphere(0, 0.06, 0.9, 0.07, WHITE, 'plain', 'post cap', 8, 4)]
    for i in range(11):
        x = -1.0 + i * 0.2
        if abs(x) < 0.01: continue
        L += [box(x, 0, 0, 0.1, 0.03, 0.74, WHITE, 'wood', 'picket'),
              cyl(x, 0, 0.74, 0.05 * S2, 0.1, WHITE, 'wood', 'picket point', 4, k='cone', ry=r2(0.015 * S2), r1=0, rot=r2(math.pi / 4))]
    return rec(B1.shift_y(L, d / 2))


def flowerpot_recipe():
    """A terracotta pot with a rim and a saucer, a leafy plant and pink flowers."""
    L = [cyl(0, 0, 0, 0.24, 0.04, '#B85A40', 'plain', 'saucer', 14),
         cyl(0, 0, 0.03, 0.17, 0.3, TERRACOTTA, 'stone', 'pot', 14, k='cone', r1=0.22),
         cyl(0, 0, 0.3, 0.235, 0.07, '#D8785A', 'stone', 'pot rim', 14),
         cyl(0, 0, 0.36, 0.2, 0.02, '#5A3C2C', 'plain', 'soil', 12)]
    leafy(L, 0, 0, 0.42, 0.17, 5, 3, 0.13)
    return rec(L)


def gnome_recipe():
    """A garden gnome: brown boots, a blue coat with a belt, a white beard, a round nose, a tall red hat."""
    SKIN = '#F2C8A0'
    L = [cyl(0, 0, 0, 0.16, 0.04, A['stone'], 'stone', 'base', 10)]
    for sx in (-1, 1):
        L.append(sphere(sx * 0.06, -0.03, 0.03, 0.06, '#6A4434', 'plain', 'boot', 8, 4, h=0.08))
    L += [cyl(0, 0, 0.08, 0.13, 0.3, '#4E78C0', 'cloth', 'coat', 12, k='cone', r1=0.08),
          cyl(0, 0, 0.18, 0.115, 0.04, '#3A2A2A', 'plain', 'belt', 12),
          box(0, -0.115, 0.18, 0.05, 0.02, 0.04, A['brass'], 'metal', 'buckle')]
    for sx in (-1, 1):
        L += [limb((sx * 0.1, 0, 0.34), (sx * 0.12, -0.08, 0.22), 0.035, 0.03, '#4E78C0', 'cloth', 'arm', 6),
              sphere(sx * 0.12, -0.09, 0.19, 0.03, SKIN, 'plain', 'hand', 6, 3)]
    L += [sphere(0, 0, 0.34, 0.1, SKIN, 'plain', 'head', 10, 5),
          cyl(0, -0.03, 0.22, 0.1, 0.18, WHITE, 'plain', 'beard', 10, k='cone', ry=0.06, r1=0.02),
          sphere(0, -0.1, 0.4, 0.028, '#E89A80', 'plain', 'nose', 6, 3)]
    for sx in (-1, 1):
        L.append(sphere(sx * 0.04, -0.09, 0.45, 0.012, '#2A1E34', 'plain', 'eye', 5, 2))
    L += [cyl(0, 0, 0.47, 0.11, 0.05, '#D6403C', 'cloth', 'hat brim', 12),
          {'k': 'limb', 'pts': [[0, 0, 0.5, 0.1], [0, 0.01, 0.62, 0.065], [0, 0.04, 0.74, 0.03], [0, 0.08, 0.8, 0.008]],
           'sides': 10, 'col': '#E04A44', 'tex': 'cloth', 'name': 'hat'}]
    return rec(L)


def planter_box_recipe():
    """A long wooden planter: plank sides on corner posts, soil, a row of leafy plants and flowers."""
    w, d, h = 1.5, 0.5, 0.42
    L = [box(0, 0, 0, w, d, h, A['wood'], 'wood', 'planter')]
    for i, z in enumerate((0.03, 0.17, 0.31)):
        L.append(box(0, -d / 2 - 0.01, z, w - 0.1, 0.02, 0.12, A['plank'] if i % 2 else '#D6A26C', 'wood', 'front plank'))
    for sx in (-1, 1):
        for sy in (-1, 1):
            L.append(box(sx * (w / 2 - 0.02), sy * (d / 2 - 0.02), 0, 0.08, 0.08, h + 0.04, A['dwood'], 'wood', 'corner post'))
    L.append(box(0, 0, h - 0.01, w - 0.1, d - 0.1, 0.02, '#5A3C2C', 'plain', 'soil'))
    rng = np.random.default_rng(11)
    for i in range(7):
        x = -w / 2 + 0.17 + (w - 0.34) * i / 6
        r = 0.13 + rng.random() * 0.04
        L.append(sphere(x, (rng.random() - 0.5) * 0.12, h - 0.05, r, LEAF2 if i % 2 else LEAF, 'leaves', 'plant', 9, 4, 0.3))
        if i % 2 == 0:
            L.append(sphere(x + 0.02, -0.1, h + r * 1.6, 0.045, FLOWERS[i // 2 % 5], 'plain', 'flower', 6, 3))
            L.append(sphere(x - 0.07, -0.04, h + r * 1.3, 0.04, FLOWERS[(i // 2 + 2) % 5], 'plain', 'flower', 6, 3))
    return rec(B1.shift_y(L, d / 2))


def planter_round_recipe():
    """A round stone planter, wider at the top, with a band and a rim, a round bush in it."""
    L = [cyl(0, 0, 0, 0.36, 0.08, '#9C98AC', 'stone', 'foot', 16),
         cyl(0, 0, 0.08, 0.36, 0.38, '#B4B0C2', 'stone', 'bowl', 16, k='cone', r1=0.48),
         cyl(0, 0, 0.22, 0.43, 0.05, '#9C98AC', 'stone', 'band', 16),
         cyl(0, 0, 0.44, 0.52, 0.07, '#C8C4D4', 'stone', 'rim', 16),
         cyl(0, 0, 0.5, 0.44, 0.02, '#5A3C2C', 'plain', 'soil', 14)]
    leafy(L, 0, 0, 0.56, 0.26, 6, 7, 0.24)
    return rec(L)


# ---------------------------------------------------------------- bigger things
def rowboat_recipe():
    """A little double-ended rowing boat: lapped planks swept up at bow and stern, a teal top strake, two thwarts and a
    pair of oars laid in it."""
    hl = 1.6
    L = []

    def strake(z, beam, t, col, name, side):
        pts = []
        for i in range(11):
            x = -hl + 2 * hl * i / 10
            k = x / hl
            pts.append([r2(x * (1 - 0.06 * (z > 0.3))), r2(side * beam * (1 - k * k) ** 0.7), r2(z + 0.16 * k ** 4), t])
        return {'k': 'limb', 'pts': pts, 'sides': 6, 'col': col, 'tex': 'wood', 'name': name}

    for side in (-1, 1):
        for i, (z, beam, col) in enumerate(((0.12, 0.34, A['dwood']), (0.22, 0.48, A['wood']), (0.33, 0.56, A['wood']), (0.43, 0.6, A['verd']))):
            L.append(strake(z, beam, 0.075 if i < 3 else 0.05, col, 'top strake' if i == 3 else 'plank', side))
    L += [cyl(0, 0, 0.02, hl * 0.82, 0.12, A['dwood'], 'wood', 'keel', 14, ry=0.3),
          box(0, 0, 0.14, 2.0, 0.6, 0.04, '#A06A42', 'wood', 'floor boards'),
          limb((-hl - 0.02, 0, 0.1), (-hl - 0.04, 0, 0.66), 0.05, 0.04, A['dwood'], 'wood', 'stem', 6),
          limb((hl + 0.02, 0, 0.1), (hl + 0.04, 0, 0.66), 0.05, 0.04, A['dwood'], 'wood', 'stern post', 6),
          ring(-hl - 0.06, 0, 0.5, 0.05, 0.012, A['brass'], 'metal', 'bow ring', 8)]
    for x, bw in ((-0.55, 0.9), (0.45, 0.95)):
        L.append(box(x, 0, 0.36, 0.22, bw, 0.04, A['plank'], 'wood', 'thwart'))
    for sy in (-1, 1):
        L.append(cyl(0.45, sy * 0.52, 0.45, 0.025, 0.08, A['brass'], 'metal', 'rowlock', 6))
    for sy, a in ((-1, 0.12), (1, -0.1)):
        p0, p1 = (-1.2, sy * 0.18, 0.42), (1.05, sy * 0.08 + a, 0.42)
        L += [limb(p0, p1, 0.025, 0.025, A['plank'], 'wood', 'oar', 6),
              box(p1[0] + 0.22, p1[1], 0.4, 0.42, 0.14, 0.03, A['plank'], 'wood', 'oar blade')]
    return rec(L)


def scarecrow_recipe():
    """A scarecrow on a pole: a sack head with button eyes and a stitched smile, a straw hat with a red band, a blue
    shirt with a patch, straw at the cuffs, the collar and the hem."""
    SACK, STRAW = '#E8C878', A['straw']
    L = [limb((0, 0, 0), (0, 0, 2.15), 0.055, 0.045, A['wood'], 'wood', 'pole', 6),
         limb((-0.85, 0, 1.55), (0.85, 0, 1.55), 0.04, 0.04, A['wood'], 'wood', 'crossbar', 6),
         cyl(0, 0, 0.8, 0.22, 0.78, '#5C94D0', 'cloth', 'shirt', 10, k='cone', ry=0.16, r1=0.27),
         box(0.1, -0.2, 1.05, 0.14, 0.03, 0.14, '#E8A050', 'cloth', 'patch'),
         box(-0.06, -0.2, 1.2, 0.03, 0.02, 0.36, '#4878B0', 'plain', 'placket')]
    for i in range(7):
        a = -math.pi * 0.95 + i * 0.3
        L.append(cyl(math.cos(a) * 0.18, math.sin(a) * 0.13 + 0.01, 0.62, 0.04, 0.22, STRAW, 'hay', 'straw', 4, k='cone', r1=0.01))
    for sx in (-1, 1):
        L += [limb((sx * 0.2, 0, 1.5), (sx * 0.8, -0.02, 1.48), 0.1, 0.085, '#5C94D0', 'cloth', 'sleeve', 8)]
        for j in range(3):
            L.append(limb((sx * 0.82, -0.02, 1.48), (sx * 1.02, -0.04 + j * 0.04, 1.4 + j * 0.06), 0.035, 0.008, STRAW, 'hay', 'straw cuff', 4))
    L += [cyl(0, 0, 1.56, 0.12, 0.08, STRAW, 'hay', 'collar straw', 8, k='cone', r1=0.06),
          sphere(0, 0, 1.6, 0.23, SACK, 'cloth', 'head', 12, 6, h=0.42)]
    for sx in (-1, 1):
        L.append(disc(sx * 0.08, -0.2, 1.84, (0, -1, 0.15), 0.03, 0.02, '#2A1E34', 'plain', 'button eye', 8))
    for i in range(5):
        x = -0.1 + i * 0.05
        L.append(box(x, -0.21, 1.7 - 0.02 * math.sin(math.pi * i / 4), 0.035, 0.02, 0.012, '#6A4434', 'plain', 'stitch'))
    L += [box(0, -0.22, 1.76, 0.03, 0.02, 0.03, '#D68A50', 'plain', 'nose'),
          cyl(0, 0, 1.93, 0.36, 0.035, '#E0BC6A', 'hay', 'hat brim', 16),
          cyl(0, 0, 1.96, 0.18, 0.22, '#E0BC6A', 'hay', 'hat crown', 12, k='cone', r1=0.13),
          cyl(0, 0, 1.97, 0.18, 0.05, '#D6403C', 'cloth', 'hat band', 12)]
    return rec(L)


def signpost_recipe():
    """A finger post: a squared post on a stone foot, two arrow boards (one each way) with painted letters, a cap."""
    L = [box(0, 0, 0, 0.3, 0.3, 0.12, A['stone'], 'stone', 'foot'),
         box(0, 0, 0.12, 0.14, 0.14, 2.0, A['wood'], 'wood', 'post'),
         cyl(0, 0, 2.12, 0.14, 0.12, A['copper'], 'metal', 'cap', 4, k='cone', r1=0.02, rot=r2(math.pi / 4))]
    for side, z, ln in ((1, 1.72, 0.85), (-1, 1.3, 0.8)):
        x0 = side * 0.04
        cx = x0 + side * ln / 2
        bh = 0.26
        L.append(box(cx, -0.1, z, ln, 0.05, bh, A['plank'], 'wood', 'arrow board'))
        # the point: steps narrowing to the tip
        for j, f in enumerate((0.8, 0.55, 0.3)):
            L.append(box(x0 + side * (ln + 0.04 + j * 0.07), -0.1, z + bh * (1 - f) / 2, 0.08, 0.05, bh * f, A['plank'], 'wood', 'arrow point'))
        L.append(box(cx, -0.1, z - 0.02, ln + 0.02, 0.06, 0.03, A['dwood'], 'wood', 'board edge'))
        for k in range(3):
            lw = (0.12, 0.2, 0.1)[k]
            L.append(box(cx - side * 0.22 + side * k * 0.2, -0.13, z + 0.1, lw, 0.01, 0.06, '#5A3C2C', 'plain', 'letters'))
        L.append(sphere(x0 + side * 0.08, -0.13, z + 0.1, 0.02, A['iron'], 'metal', 'nail', 6, 3))
    return rec(L)


def waystone_recipe():
    """The old waystone of the lane: a tall worn standing stone, a ring and a line carved on its face, lichen, moss at
    its foot and a few fallen stones round it."""
    G = '#9A96A8'
    L = [cyl(0, 0, -0.05, 0.62, 2.35, G, 'rock', 'stone', 9, k='cone', ry=0.42, r1=0.46, lump=0.12, facet=1),
         {'k': 'dome', 'x': 0, 'y': 0, 'z': 2.28, 'r': 0.47, 'ry': 0.33, 'h': 0.5, 'sides': 9, 'rings': 3, 'lump': 0.1, 'facet': 1,
          'col': G, 'tex': 'rock', 'name': 'stone top'}]
    # the carving: a ring with a line through it, pale and worn
    pts = [[r2(math.cos(2 * math.pi * i / 16) * 0.22), -0.45, r2(1.65 + math.sin(2 * math.pi * i / 16) * 0.22), 0.025] for i in range(17)]
    L += [{'k': 'limb', 'pts': pts, 'sides': 4, 'col': '#CFE6DC', 'tex': 'plain', 'name': 'carved ring'},
          limb((0, -0.47, 1.2), (0, -0.4, 2.15), 0.025, 0.025, '#CFE6DC', 'plain', 'carved line', 4)]
    for x, z, r in ((-0.3, 0.9, 0.14), (0.35, 1.9, 0.1), (0.25, 0.5, 0.12)):
        L.append({'k': 'dome', 'x': x, 'y': -0.42 + abs(x) * 0.2, 'z': z, 'r': r, 'ry': 0.06, 'h': 0.05, 'sides': 7, 'rings': 2,
                  'lump': 0.3, 'facet': 1, 'col': '#B8C878', 'tex': 'leaves', 'name': 'lichen'})
    L.append({'k': 'dome', 'x': 0, 'y': 0, 'z': -0.05, 'r': 0.78, 'ry': 0.56, 'h': 0.22, 'sides': 12, 'rings': 3, 'lump': 0.35,
              'col': B1.MOSS, 'tex': 'leaves', 'name': 'moss'})
    for i, (x, y, r) in enumerate(((0.7, -0.2, 0.2), (0.95, 0.05, 0.13), (-0.75, -0.1, 0.16))):
        L.append({'k': 'sphere', 'x': x, 'y': y, 'z': -0.05, 'r': r, 'h': r * 1.3, 'sides': 6, 'rings': 3, 'lump': 0.35, 'facet': 1,
                  'col': B1.ROCK, 'tex': 'rock', 'name': 'fallen stone'})
    return rec(L, 0.8)


def well_recipe():
    """The village well: a round stone wall with a pale rim round the water, two posts, a red-tiled roof, a windlass
    with a crank and a bucket on its rope."""
    R = 0.85
    L = [cyl(0, 0, 0, R, 0.82, A['stone'], 'stone', 'well wall', 18),
         cyl(0, 0, 0, R + 0.05, 0.12, '#9C98AC', 'stone', 'wall foot', 18),
         cyl(0, 0, 0.8, R - 0.13, 0.015, '#4E7AA0', 'plain', 'water', 18),
         ring(0, 0, 0.84, R - 0.06, 0.08, '#C8C4D4', 'stone', 'rim', 18)]
    for sx in (-1, 1):
        x = sx * (R + 0.02)
        L += [box(x, 0, 0.6, 0.14, 0.14, 1.85, A['wood'], 'wood', 'post'),
              limb((x, 0, 1.5), (x - sx * 0.35, 0, 2.38), 0.03, 0.03, A['dwood'], 'wood', 'brace', 4)]
    L += [box(0, 0, 2.38, 2 * R + 0.3, 0.16, 0.08, A['dwood'], 'wood', 'roof beam'),
          gable(0, 0, 2.45, R + 0.35, 0.72, 0.62, '#D8584A', 'rooftiles', 'roof', 'x'),
          box(0, 0, 3.04, 2 * R + 0.72, 0.1, 0.06, '#B84A40', 'rooftiles', 'ridge'),
          limb((-R + 0.05, 0, 1.55), (R + 0.12, 0, 1.55), 0.07, 0.07, A['wood'], 'wood', 'windlass', 8),
          ring(-0.1, 0, 1.55, 0.075, 0.02, '#D6C08A', 'cloth', 'rope wraps', 8),
          limb((R + 0.12, 0, 1.55), (R + 0.12, -0.25, 1.55), 0.02, 0.02, A['iron'], 'metal', 'crank', 4),
          limb((R + 0.12, -0.25, 1.55), (R + 0.12, -0.25, 1.35), 0.02, 0.02, A['iron'], 'metal', 'crank', 4),
          limb((R + 0.12, -0.25, 1.35), (R + 0.26, -0.25, 1.35), 0.025, 0.025, A['dwood'], 'wood', 'handle', 6),
          limb((0, -0.07, 1.5), (0, -0.07, 1.12), 0.012, 0.012, '#D6C08A', 'cloth', 'rope', 4),
          cyl(0, -0.07, 0.86, 0.13, 0.2, A['wood'], 'wood', 'bucket', 10, k='cone', r1=0.16),
          cyl(0, -0.07, 0.9, 0.15, 0.03, A['iron'], 'metal', 'bucket hoop', 10),
          limb((-0.14, -0.07, 1.06), (0, -0.07, 1.14), 0.01, 0.01, A['iron'], 'metal', 'bail', 4),
          limb((0, -0.07, 1.14), (0.14, -0.07, 1.06), 0.01, 0.01, A['iron'], 'metal', 'bail', 4)]
    # a few flowers in the grass at the foot
    for a in (-2.2, -1.2, -0.6):
        L.append(sphere(math.cos(a) * (R + 0.15), math.sin(a) * (R + 0.15), 0, 0.1, LEAF, 'leaves', 'tuft', 7, 3, 0.35, 0.14))
        L.append(sphere(math.cos(a) * (R + 0.18), math.sin(a) * (R + 0.18), 0.1, 0.035, FLOWERS[int(-a * 3) % 5], 'plain', 'flower', 5, 2))
    return rec(L)


def wheelbarrow_recipe():
    """A green wheelbarrow: a tapered tray, a spoked wheel with a dark tyre, two handles with wooden grips, iron legs,
    a heap of soil with a seedling in it."""
    GREEN, DGREEN = '#5EAA58', '#4A8E48'
    L = [cyl(-0.05, 0, 0.32, 0.36 * S2, 0.32, GREEN, 'metal', 'tray', 4, k='cone', ry=r2(0.26 * S2), r1=r2(0.52 * S2), ry1=r2(0.38 * S2), rot=r2(math.pi / 4)),
         box(-0.05, 0, 0.62, 1.08, 0.8, 0.04, DGREEN, 'metal', 'tray lip'),
         {'k': 'dome', 'x': -0.05, 'y': 0, 'z': 0.64, 'r': 0.42, 'ry': 0.3, 'h': 0.14, 'sides': 10, 'rings': 3, 'lump': 0.3,
          'col': '#6A4A34', 'tex': 'plain', 'name': 'soil'},
         sphere(0.05, -0.05, 0.74, 0.07, LEAF2, 'leaves', 'seedling', 7, 3, 0.3),
         sphere(-0.1, 0.06, 0.74, 0.06, LEAF, 'leaves', 'seedling', 7, 3, 0.3)]
    wx = -0.85
    L += [disc(wx, 0.0, 0.22, (0, 1, 0), 0.22, 0.05, '#3A3442', 'plain', 'tyre', 16),
          disc(wx, -0.01, 0.22, (0, 1, 0), 0.15, 0.07, A['brass'], 'metal', 'wheel', 12),
          disc(wx, -0.02, 0.22, (0, 1, 0), 0.04, 0.09, A['iron'], 'metal', 'hub', 8)]
    for sy in (-1, 1):
        y = sy * 0.24
        L += [limb((wx, y * 0.4, 0.22), (-0.45, y, 0.36), 0.025, 0.025, A['iron'], 'metal', 'fork', 5),
              limb((-0.45, y, 0.36), (0.75, y * 1.1, 0.62), 0.03, 0.03, A['iron'], 'metal', 'handle', 6),
              limb((0.75, y * 1.1, 0.62), (1.05, y * 1.15, 0.7), 0.04, 0.035, A['plank'], 'wood', 'grip', 6),
              limb((0.35, y, 0.5), (0.4, y, 0.0), 0.02, 0.02, A['iron'], 'metal', 'leg', 5),
              box(0.4, y, 0, 0.1, 0.06, 0.02, A['iron'], 'metal', 'foot')]
    return rec(L)


# ---------------------------------------------------------------- the bunting: modelled poles and string, drawn pennants
PENNANT_COLS = ['#E8625A', '#F9EAC0', '#62B098', '#F4C03C', '#76AA50', '#EF8E77']


def pennant_sprite(i, col):
    """A small cloth pennant, pointing down: its colour, a lighter half toward the light and a dark outline."""
    W, H = 11, 13
    a = np.zeros((H, W, 4), np.uint8)
    c = np.array([int(col[j:j + 2], 16) for j in (1, 3, 5)])
    hi = np.minimum(255, c * 1.12 + 22).astype(np.uint8)
    for y in range(H):
        half = (W / 2) * (1 - y / H)
        for x in range(W):
            dx = x + 0.5 - W / 2
            if abs(dx) <= half + 0.01:
                edge = abs(dx) > half - 1 or y == 0
                a[y, x] = (*INK, 255) if edge else (*(hi if dx < -0.5 and y < H - 4 else c), 255)
    return B1.save_png(a, B1.NEXT / 'decals' / f'pennant_{i}.png')


def bunting_recipe():
    half = 2.5
    L = []
    for sx in (-1, 1):
        L += [cyl(sx * half, 0, 0, 0.11, 0.08, A['stone'], 'stone', 'pole foot', 8),
              limb((sx * half, 0, 0), (sx * half, 0, 3.0), 0.055, 0.045, A['wood'], 'wood', 'pole', 6),
              sphere(sx * half, 0, 2.98, 0.07, A['brass'], 'metal', 'finial', 8, 4)]
    rope = lambda x: 2.82 - 0.5 * (1 - (x / half) ** 2)
    xs = [-half + 2 * half * i / 10 for i in range(11)]
    L.append({'k': 'limb', 'pts': [[r2(x), 0, r2(rope(x)), 0.012] for x in xs], 'sides': 4, 'col': '#D6C08A', 'tex': 'cloth', 'name': 'string'})
    sprites = [pennant_sprite(i, c) for i, c in enumerate(PENNANT_COLS)]
    n = 13
    for i in range(n):
        x = -half + 0.3 + (2 * half - 0.6) * i / (n - 1)
        L.append(img(sprites[i % len(sprites)], x, 0, r2(rope(x) - 13 / PPM + 0.03), face='fixed', shadow=1, sway=1, name='pennant'))
    return rec(L)


# ---------------------------------------------------------------- the catalogue
FIXED = {'rot': 0, 'lean': 0}
MADE = {
    # key: (recipe, vary or None to keep the old)
    'barrel_wood': (barrel_recipe, None),
    'flowerpot': (flowerpot_recipe, None),
    'garden_gnome': (gnome_recipe, None),
    'beehive': (beehive_recipe, FIXED),
    'dock_post': (dock_post_recipe, None),
    'planter_round': (planter_round_recipe, None),
    'planter_box': (planter_box_recipe, FIXED),
    'bench_wood': (bench_recipe, FIXED),
    'wheelbarrow': (wheelbarrow_recipe, FIXED),
    'picket_fence': (picket_fence_recipe, FIXED),
    'fence_wood': (fence_wood_recipe, FIXED),
    'birdhouse': (birdhouse_recipe, FIXED),
    'signpost': (signpost_recipe, FIXED),
    'scarecrow': (scarecrow_recipe, FIXED),
    'rowboat': (rowboat_recipe, FIXED),
    'well': (well_recipe, FIXED),
    'waystone': (waystone_recipe, FIXED),
    'banner_bunting': (bunting_recipe, FIXED),
}
# two rows (the showcase map may be at most 400 tiles deep): the small things, then the big ones
ROW_SETS = [('made-small', ['barrel_wood', 'flowerpot', 'garden_gnome', 'beehive', 'dock_post', 'planter_round', 'planter_box',
                            'bench_wood', 'wheelbarrow', 'birdhouse'], 2.5),
            ('made-big', ['picket_fence', 'fence_wood', 'signpost', 'scarecrow', 'waystone', 'well', 'rowboat', 'banner_bunting'], 5.6)]


def main():
    D = gamedata.load()
    C = D['scenery']['props']
    for key, (fn, vary) in MADE.items():
        M = C[key]
        M['model'] = B1.write_recipe(key, fn())
        M['ppm'] = PPM
        if vary is not None:
            M['vary'] = dict(vary)
        for f in ('build', 'layers', 'vol', 'volDepth'):
            M.pop(f, None)
    B1.ROWS = B1.ROWS + B2.ROWS + [('buildings', [('cottage_moss', 0), ('cottage_solar', 0), ('lab', 0)], None, 8.0)] + \
        [(name, [(k, 0) for k in keys], None, gap) for name, keys, gap in ROW_SETS]
    D['maps']['test_props_next'] = B1.test_map(C)
    gamedata.save(D)
    print('made:', ', '.join(MADE))


if __name__ == '__main__':
    main()
