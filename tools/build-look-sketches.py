#!/usr/bin/env python3
"""Buildings track BD-3: the look sketches. One house body and the shop, each in three directions, built only from
BD-1's shapes (prism, lathe, box taper/lean/bevel, warp, glow), BD-2a's surfaces and BD-2b's normal sheet, for the
owner to pick from (the pick sets the house kit's ranges, BD-4a, and the civic buildings', BD-5):
  A gentle wonk, sparse details; B storybook wonk, medium details (the track's default); C strong wonk, dense details.
The shop keeps its lean turned down at every level (track section 5: tidier civic buildings).
One catalogue kind, look_sketch, its variants each one of the six models, and the test map test_look_sketches (the
debug menu's Test scenes). Pictures: tools/look-hub-buildings.py --scene=test_look_sketches --only=look_sketch

    python3 tools/build-look-sketches.py      # rerunnable: writes the recipes, the catalogue kind and the map
"""
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gamedata  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MODELS = 'scene/next/models'
ID = 'test_look_sketches'
KIND = 'look_sketch'
LEVELS = 'abc'

# the palette (track section 5): cream walls, butter plaster, warm wood; copper and verdigris roofs; brass trims
CREAM, BUTTER, WHITE, WOOD, DARK = '#F2E2BE', '#F4D99A', '#F4F1EA', '#9A6A44', '#3A2E2A'
COPPER, VERDI, TEAL, TERRA, BRASS, NAVY, RED = '#C9773E', '#5FA898', '#2E7F8A', '#C8603E', '#D8B048', '#3E5288', '#D4483E'
GLASS, STONE, LEAF, LEAF2, MOSS = '#9FC4D8', '#B8B0A8', '#5E9A48', '#86B85A', '#7AA64E'
NEON_T, NEON_P, NEON_A = '#5AE0FF', '#FF5AB4', '#FFB040'
DEG = math.pi / 180


def box(x, y, z, w, d, h, col, tex='plain', **k):
    return {'k': 'box', 'x': r3(x), 'y': r3(y), 'z': r3(z), 'w': r3(w), 'd': r3(d), 'h': r3(h), 'col': col, 'tex': tex, **k}


def prism(x, y, z, pts, d, col, tex='plain', **k):
    return {'k': 'prism', 'x': r3(x), 'y': r3(y), 'z': r3(z), 'pts': [[r3(a), r3(b)] for a, b in pts], 'd': r3(d),
            'col': col, 'tex': tex, **k}


def lathe(x, y, z, pts, col, tex='plain', **k):
    return {'k': 'lathe', 'x': r3(x), 'y': r3(y), 'z': r3(z), 'pts': [[r3(a), r3(b)] for a, b in pts], 'col': col,
            'tex': tex, **k}


def cyl(x, y, z, r, h, col, tex='plain', sides=12, **k):
    return {'k': 'cyl', 'x': r3(x), 'y': r3(y), 'z': r3(z), 'r': r3(r), 'h': r3(h), 'col': col, 'tex': tex,
            'sides': sides, **k}


def sphere(x, y, z, r, col, tex='plain', sides=8, rings=4, **k):
    return {'k': 'sphere', 'x': r3(x), 'y': r3(y), 'z': r3(z), 'r': r3(r), 'col': col, 'tex': tex, 'sides': sides,
            'rings': rings, **k}


def limb(a, b, r, col, tex='plain', sides=6, **k):
    return {'k': 'limb', 'x': r3(a[0]), 'y': r3(a[1]), 'z': r3(a[2]), 'x2': r3(b[0]), 'y2': r3(b[1]), 'z2': r3(b[2]),
            'r': r3(r), 'r1': r3(r), 'col': col, 'tex': tex, 'sides': sides, **k}


def r3(v):
    return round(v, 3)


def arc(cx, cz, r, a0, a1, n):
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cz + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


def arch(w, h, n=6):
    """a round-topped opening's outline (door or window), its bottom middle at 0"""
    s = w / 2
    return [(-s, 0), (s, 0), (s, h - s)] + arc(0, h - s, s, 0, math.pi, n)[1:-1] + [(-s, h - s)]


def star(r0, r1, n):
    return [((r1 if i % 2 else r0) * math.cos(math.pi / 2 + i * math.pi / n),
             (r1 if i % 2 else r0) * math.sin(math.pi / 2 + i * math.pi / n)) for i in range(2 * n)]


def disc(x, y, z, r, col, tex='plain', sides=14, **k):
    """a flat round plate facing the front (a porthole, a sign board)"""
    return lathe(x, y, z, [(0, 0), (r, 0)], col, tex, tilt=[-90 * DEG, 0], sides=sides, **k)


def porthole(x, y, z, r, glass):
    return [disc(x, y + 0.01, z, r + 0.07, BRASS, 'metal', name='porthole rim'),
            disc(x, y, z, r, GLASS, sides=14, glass=glass, name='porthole')]


def window(x, y, z, w, h, glass, frame=WHITE, sill=True):
    L = [box(x, y + 0.02, z - 0.05, w + 0.12, 0.05, h + 0.1, frame, 'wood', name='window frame'),
         box(x, y, z, w, 0.04, h, GLASS, glass=glass, name='window'),
         box(x, y - 0.01, z + h / 2 - 0.02, w, 0.03, 0.04, frame, 'wood', name='window bar')]
    if sill:
        L.append(box(x, y - 0.06, z - 0.08, w + 0.2, 0.14, 0.06, frame, 'wood', name='sill'))
    return L


def flower_box(x, y, z, w, cols):
    L = [box(x, y - 0.1, z, w, 0.2, 0.16, WOOD, 'wood', name='flower box')]
    n = max(2, int(w / 0.16))
    for i in range(n):
        px = x - w / 2 + (i + 0.5) * w / n
        L.append(sphere(px, y - 0.1, z + 0.2, 0.09, LEAF if i % 2 else LEAF2, 'leaves', sides=6, rings=3,
                        name='box plant'))
        L.append(sphere(px + 0.03, y - 0.15, z + 0.27, 0.045, cols[i % len(cols)], sides=5, rings=2, name='flower'))
    return L


def ivy(x, y, z0, z1, side=1):
    """ivy up a corner: leaf clumps climbing, thinning out at the top"""
    L, n = [], max(3, int((z1 - z0) / 0.32))
    for i in range(n):
        t = i / (n - 1)
        L.append(sphere(x + side * 0.03 * math.sin(i * 2.1), y - 0.04, z0 + (z1 - z0) * t, 0.22 * (1 - 0.45 * t),
                        LEAF if i % 2 else MOSS, 'leaves', sides=6, rings=3, name='ivy'))
    return L


def lamp(x, y, z):
    return [limb((x, y, z), (x, y - 0.25, z), 0.015, '#333344', 'metal', name='lamp arm'),
            sphere(x, y - 0.27, z - 0.08, 0.08, '#FFE9B0', sides=8, rings=4, glow='#FFC860', name='lamp globe'),
            lathe(x, y - 0.27, z - 0.02, [(0.1, 0), (0.02, 0.1)], '#333344', 'metal', sides=8, name='lamp hood')]


def atomic_finial(x, y, z, tall=0.5):
    """a brass ball on a spike with two orbit rings (retro-future, track section 5)"""
    ring = [(0.17, 0), (0.2, 0), (0.2, 0.025), (0.17, 0.025), (0.17, 0)]
    return [limb((x, y, z), (x, y, z + tall), 0.025, BRASS, 'metal', name='finial spike'),
            sphere(x, y, z + tall * 0.6, 0.07, BRASS, 'metal', sides=8, rings=4, name='finial ball'),
            lathe(x, y, z + tall * 0.6, ring, BRASS, 'metal', sides=12, tilt=[60 * DEG, 0], name='orbit ring'),
            lathe(x, y, z + tall * 0.6, ring, BRASS, 'metal', sides=12, tilt=[-60 * DEG, 30 * DEG], name='orbit ring')]


def antenna(x, y, z, tall):
    return [limb((x, y, z), (x, y, z + tall), 0.02, '#8C8C98', 'metal', name='antenna'),
            limb((x - 0.22, y, z + tall * 0.6), (x + 0.22, y, z + tall * 0.6), 0.012, '#8C8C98', 'metal', name='antenna bar'),
            limb((x - 0.14, y, z + tall * 0.8), (x + 0.14, y, z + tall * 0.8), 0.012, '#8C8C98', 'metal', name='antenna bar'),
            sphere(x, y, z + tall + 0.03, 0.05, '#FFE0E8', sides=6, rings=3, glow={'col': NEON_P, 'day': 1},
                   name='antenna tip')]


# ---------------------------------------------------------------------------------------------------- the house
# The lean is metres at the model's top (about 6.8 m with the antenna): 0.5 m there is about 4 degrees.
# One body for all three: a cob ground floor, a jettied half-timber upper floor, a gable-front gambrel roof in
# verdigris standing seam over thick dark eaves. Front face at y=0 (the camera's side), up is z.
HOUSE_WARP = [
    {'lean': [0.15, 0.0], 'sag': 0.04, 'bulge': 0.02},                    # A: about 1.5 degrees
    {'lean': [0.5, 0.08], 'sag': 0.14, 'bulge': 0.05},                    # B: about 4 degrees, the track's default
    {'lean': [0.9, 0.12], 'sag': 0.26, 'bulge': 0.09, 'twist': 0.14},     # C: about 7 degrees, turned at the top
]


def house(lv):
    D, cx = 1.1, 0.0  # the body's depth middle
    z_up = 0.15 + 1.9 + 0.14
    z_roof = z_up + 1.4 + 0.12
    L = [
        box(0, D, 0, 3.4, 2.5, 0.15, STONE, 'stone', bevel=0.04, name='plinth'),
        box(0, D, 0.15, 3.0, 2.2, 1.9, CREAM, 'cob', name='ground floor'),
        box(0, D, 0.15 + 1.9, 3.3, 2.5, 0.14, WOOD, 'wood', bevel=0.03, name='jetty floor'),
        box(0, D, z_up, 3.2, 2.4, 1.4, BUTTER, 'halftimber', name='upper floor'),
        box(0, D, z_roof - 0.12, 3.8, 2.95, 0.12, DARK, 'wood', name='eaves'),
    ]
    # the roof: a gambrel, its eaves flared up at level C
    if lv < 2:
        prof = [(-1.95, 0), (1.95, 0), (1.6, 0.7), (0.7, 1.4), (-0.7, 1.4), (-1.6, 0.7)]
    else:
        prof = [(-2.15, 0.12), (-1.95, 0), (1.95, 0), (2.15, 0.12), (1.65, 0.7), (0.7, 1.45), (-0.7, 1.45), (-1.65, 0.7)]
    L.append(prism(0, D, z_roof, prof, 3.0, VERDI, 'standingseam', name='gambrel roof', roof=1))
    L.append(box(0, D, z_roof + prof[-2][1] - 0.02, 1.5, 3.05, 0.07, COPPER, 'metal', name='ridge band', roof=1))
    gable_y = D - 1.5 - 0.01
    # the door: oversized round-top, terracotta, in a stone arch, a step
    dx = -0.75
    L += [prism(dx, -0.02, 0.15, arch(1.1, 1.75, 8), 0.04, STONE, 'stone', name='door arch'),
          prism(dx, -0.05, 0.15, arch(0.9, 1.6, 8), 0.06, TERRA, 'wood', name='round door'),
          sphere(dx + 0.28, -0.1, 0.95, 0.05, BRASS, 'metal', sides=6, rings=3, name='door knob'),
          box(dx, -0.25, 0, 1.2, 0.5, 0.15, STONE, 'stone', bevel=0.03, name='door step')]
    # windows
    L += window(0.75, -0.02, 0.85, 0.75, 0.75, 1)
    L += window(-0.75, -0.12, z_up + 0.35, 0.7, 0.7, 2)
    if lv >= 1:
        L += window(0.75, -0.12, z_up + 0.35, 0.7, 0.7, 3)
        L += porthole(0, gable_y, z_roof + 0.65, 0.26, 4)
    else:
        L += window(0.75, -0.12, z_up + 0.35, 0.7, 0.7, 3, sill=False)
    # the chimney: straight brick (A), a flared crooked one (B), a copper rocket (C)
    chx, chy = 1.05, 1.7
    if lv == 0:
        L += [box(chx, chy, z_roof - 0.4, 0.45, 0.45, 2.0, TERRA, 'brick', name='chimney'),
              box(chx, chy, z_roof + 1.6, 0.55, 0.55, 0.1, STONE, 'stone', name='chimney cap')]
    elif lv == 1:
        L.append(lathe(chx, chy, z_roof - 0.4, [(0.26, 0), (0.24, 1.6), (0.38, 1.9), (0.38, 2.0), (0.2, 2.0)], TERRA,
                       'brick', sides=8, tilt=[-4 * DEG, 8 * DEG], name='crooked chimney'))
    else:
        L.append(lathe(chx, chy, z_roof - 0.4, [(0.26, 0), (0.3, 0.8), (0.3, 1.7), (0.22, 2.1), (0.08, 2.4), (0, 2.45)],
                       COPPER, 'riveted', sides=10, smooth=1, tilt=[-5 * DEG, 11 * DEG], name='rocket chimney'))
        for a in (0, 120, 240):
            L.append(prism(chx, chy, z_roof + 0.9, [(0.28, 0), (0.6, 0), (0.3, 0.6)], 0.05, RED, 'metal',
                           rot=(a + 90) * DEG, name='chimney fin'))
        L.append(sphere(chx + 0.1, chy, z_roof + 2.0, 0.1, '#FFE9B0', sides=6, rings=3, glow=NEON_A, name='rocket porthole'))
    # neon under the eaves, the night's teal line
    L.append(box(0, -0.38, z_roof - 0.17, 3.5, 0.05, 0.05, '#FFFFFF', glow=NEON_T, name='neon under the eaves'))
    # nature: A one flower box; B two, ivy, a lamp, a rain barrel; C all that and more
    L += flower_box(0.75, -0.02, 0.7, 0.9, ['#E85A6A', '#F4E04A'])
    if lv >= 1:
        L += flower_box(-0.75, -0.12, z_up + 0.2, 0.85, ['#F09AC0', '#FFFFFF'])
        L += flower_box(0.75, -0.12, z_up + 0.2, 0.85, ['#E85A6A', '#F4E04A'])
        L += ivy(1.45, 0.05, 0.3, z_up + 1.2 if lv == 2 else z_up, -1)
        L += lamp(-0.05, -0.02, 1.75)
        L += [cyl(1.75, 0.35, 0, 0.26, 0.6, WOOD, 'wood', sides=10, name='rain barrel'),
              cyl(1.75, 0.35, 0.6, 0.28, 0.05, '#666670', 'metal', sides=10, name='barrel hoop')]
        L += [sphere(-1.7, 0.2, 0.25, 0.32, LEAF, 'leaves', sides=7, rings=4, lump=0.25, name='shrub'),
              sphere(-1.65, 0.75, 0.22, 0.28, LEAF2, 'leaves', sides=7, rings=4, lump=0.25, name='shrub')]
    # retro-future: A an atomic finial; B a glowing-tip antenna too; C a turret, a dish, a spinner, a greenhouse, a tube
    L += atomic_finial(-0.45, D, z_roof + prof[-2][1] + 0.05)
    if lv >= 1:
        L += antenna(0.5, D + 0.8, z_roof + prof[-2][1], 1.1)
    if lv == 2:
        tx, ty = -1.75, 0.55  # the turret, on the front left corner: the one round body part
        L += [cyl(tx, ty, 0.15, 0.55, 3.5, WHITE, 'fishscale', sides=12, name='turret'),
              cyl(tx, ty, 3.65, 0.62, 0.1, DARK, 'wood', sides=12, name='turret eaves'),
              lathe(tx, ty, 3.75, [(0.6, 0), (0.62, 0.2), (0.5, 0.5), (0.25, 0.85), (0.08, 1.1), (0, 1.2)], RED, 'fishscale',
                    sides=12, smooth=1, name='onion dome', roof=1),
              box(tx, ty - 0.57, 3.55, 0.6, 0.04, 0.04, '#FFFFFF', glow=NEON_P, name='turret neon')]
        L += porthole(tx, ty - 0.56, 2.6, 0.2, 5)
        L += porthole(tx, ty - 0.56, 1.3, 0.2, 6)
        L += atomic_finial(tx, ty, 4.95, 0.45)
        # a bubble greenhouse on the right side
        L += [box(2.05, 1.4, 0.15, 1.0, 1.4, 0.3, STONE, 'stone', name='greenhouse base'),
              {'k': 'dome', 'x': 2.05, 'y': 1.4, 'z': 0.45, 'r': 0.62, 'ry': 1.25, 'h': 0.8, 'sides': 12, 'rings': 4,
               'col': '#BFE6E8', 'tex': 'glassblock', 'name': 'bubble greenhouse', 'glass': 7},
              sphere(2.05, 1.4, 0.6, 0.35, LEAF2, 'leaves', sides=6, rings=3, name='greenhouse plants')]
        # a satellite dish on the roof's right slope, a wind spinner on the eaves
        L += [lathe(1.3, 0.9, z_roof + 0.95, [(0, 0), (0.35, 0.12), (0.4, 0.16)], '#E8E4DA', 'metal', sides=12,
                    tilt=[-45 * DEG, -20 * DEG], name='satellite dish'),
              limb((1.3, 0.9, z_roof + 0.6), (1.3, 0.9, z_roof + 0.95), 0.03, '#8C8C98', 'metal', name='dish post')]
        L += [limb((-1.5, -0.35, z_roof - 0.1), (-1.5, -0.35, z_roof + 0.7), 0.02, BRASS, 'metal', name='spinner post')]
        for a in range(4):
            L.append(prism(-1.5, -0.4, z_roof + 0.7, [(0, 0), (0.28, 0.05), (0.26, 0.12)], 0.02,
                           [RED, BRASS, TEAL, WHITE][a], 'metal', tilt=[90 * DEG, 0], rot=0, name='spinner blade'))
            L[-1]['pts'] = [[r3(math.cos(a * math.pi / 2) * p[0] - math.sin(a * math.pi / 2) * p[1]),
                             r3(math.sin(a * math.pi / 2) * p[0] + math.cos(a * math.pi / 2) * p[1])]
                            for p in [(0, 0), (0.28, 0.05), (0.26, 0.14)]]
        # a pneumatic tube from the greenhouse up the side wall, glowing at night
        L += [limb((1.62, 1.4, 0.5), (1.62, 1.4, z_up + 1.0), 0.06, '#DDEEF0', glow=NEON_T, name='pneumatic tube'),
              limb((1.62, 1.4, z_up + 1.0), (1.2, 1.4, z_up + 1.3), 0.06, '#DDEEF0', glow=NEON_T, name='pneumatic tube')]
        # hanging baskets, moss on the roof
        for bx in (-1.25, 0.15):
            L += [limb((bx, -0.3, z_roof - 0.15), (bx, -0.3, z_roof - 0.55), 0.008, '#555560', 'metal', name='basket chain'),
                  sphere(bx, -0.3, z_roof - 0.65, 0.16, WOOD, 'hay', sides=7, rings=3, name='hanging basket'),
                  sphere(bx, -0.3, z_roof - 0.55, 0.15, LEAF2, 'leaves', sides=6, rings=3, name='basket flowers'),
                  sphere(bx + 0.05, -0.36, z_roof - 0.5, 0.05, '#F09AC0', sides=5, rings=2, name='flower')]
        for i, (mx, my, mz) in enumerate([(-1.7, 0.4, 0.1), (-1.5, 1.8, 0.3), (1.6, 0.4, 0.2), (1.45, 2.3, 0.15)]):
            L.append(sphere(mx, my, z_roof + mz + 0.25, 0.14, MOSS if i % 2 else LEAF2, 'leaves', sides=6, rings=3,
                            lump=0.3, name='roof moss', roof=2))
    return L


# ----------------------------------------------------------------------------------------------------- the shop
# A Streamline corner store: a white body with a rounded front-left corner, a big front window, the door on the
# right (where the catalogue's door is today, x +0.94 m), a thick low slab roof with a dark underside, a striped
# awning and a round emblem sign with Copperleaf's leaf. Signs' lettering stays decals (not in the sketch).
SHOP_WARP = [
    None,                                                       # A: square and plumb
    {'bulge': 0.02, 'sag': 0.04},                               # B: a soft swell, no lean (tidy civic)
    {'lean': [0.15, 0.0], 'bulge': 0.04, 'sag': 0.08},          # C: about 1.5 degrees, the most a civic front gets
]


def leaf_emblem(x, y, z, s, col):
    pts = [(0, -s)] + [(s * 0.62 * math.sin(math.pi * t / 6) * (1 if t < 6 else -1), -s + 2 * s * (t % 6) / 6)
                       for t in range(1, 6)] + [(0, s)] + [(-s * 0.62 * math.sin(math.pi * t / 6), s - 2 * s * t / 6)
                                                           for t in range(1, 6)]
    return [prism(x, y, z, pts, 0.04, col, tilt=[0, 30 * DEG], name='leaf emblem'),
            box(x, y - 0.01, z - s * 0.5, 0.03, 0.03, s * 1.3, '#2E5E3A', tilt=[0, 30 * DEG], name='leaf vein')]


def shop(lv):
    W, Dp, H = 3.8, 2.4, 2.4
    D = Dp / 2
    R = 0.65  # the round corner's radius
    z_roof = 0.15 + H
    L = [
        box(0, D, 0, 4.1, 2.7, 0.15, STONE, 'stone', bevel=0.04, name='plinth'),
        box(R / 2, D, 0.15, W - R, Dp, H, WHITE, 'plaster', name='body'),
        box(-W / 2 + R / 2, D + R / 2, 0.15, R, Dp - R, H, WHITE, 'plaster', name='body corner back'),
        cyl(-W / 2 + R, R, 0.15, R, H, WHITE, 'plaster', sides=16, name='round corner'),
        box(0, D, 0.15, W + 0.04, Dp + 0.04, 0.35, TEAL, 'tilewall', name='base band'),
        cyl(-W / 2 + R, R, 0.15, R + 0.02, 0.35, TEAL, 'tilewall', sides=16, name='base band corner'),
    ]
    # the slab roof: thick, wide, a dark underside; at C an upswept Googie canopy over the door too
    L += [box(0, D, z_roof, W + 0.6, Dp + 0.6, 0.12, DARK, 'wood', name='eaves'),
          box(0, D, z_roof + 0.12, W + 0.6, Dp + 0.6, 0.22, NAVY if lv != 1 else RED, 'barreltile', bevel=0.06,
              name='slab roof', roof=1),
          box(0, -0.27, z_roof + 0.34, W + 0.6, 0.06, 0.06, WHITE, 'metal', name='roof rim', roof=1),
          box(0, Dp + 0.27, z_roof + 0.34, W + 0.6, 0.06, 0.06, WHITE, 'metal', name='roof rim', roof=1),
          box(-(W + 0.6) / 2 + 0.03, D, z_roof + 0.34, 0.06, Dp + 0.6, 0.06, WHITE, 'metal', name='roof rim', roof=1),
          box((W + 0.6) / 2 - 0.03, D, z_roof + 0.34, 0.06, Dp + 0.6, 0.06, WHITE, 'metal', name='roof rim', roof=1)]
    # the big front window with goods, the glass door on the right
    L += [box(-0.55, -0.02, 0.55, 2.0, 0.04, 1.3, GLASS, glass=1, name='shop window'),
          box(-0.55, 0.0, 0.5, 2.15, 0.06, 0.08, BRASS, 'metal', name='window frame'),
          box(-0.55, 0.0, 1.85, 2.15, 0.06, 0.08, BRASS, 'metal', name='window frame'),
          box(-0.55, -0.03, 1.15, 2.0, 0.03, 0.03, BRASS, 'metal', name='shelf')]
    for i, c in enumerate(['#C478D0', '#F49A3A', '#8CC850', '#E04848', '#F07090', '#F49A3A']):
        L.append(box(-1.35 + i * 0.32, -0.04, 0.6 + (i % 2) * 0.6, 0.18, 0.03, 0.25, c, name='goods'))
    L += [box(0.94, -0.02, 0.15, 1.1, 0.05, 1.95, BRASS, 'metal', name='door frame'),
          box(0.94, -0.05, 0.2, 0.95, 0.03, 1.85, '#A8DCE8', glass=2, name='glass door'),
          box(0.94, -0.3, 0, 1.5, 0.55, 0.15, STONE, 'stone', bevel=0.03, name='door step')]
    # the striped awning over the window
    L.append(box(-0.55, -0.35, 2.05, 2.3, 0.75, 0.04, RED, 'stripes', tilt=[-22 * DEG, 0], name='striped awning'))
    L.append(box(-0.55, -0.72, 1.9, 2.3, 0.03, 0.14, RED, 'cloth', name='awning valance'))
    # the round emblem sign on the roof front: Copperleaf's leaf
    sy, sz = -0.05, z_roof + 0.95
    L += [disc(0.4, sy + 0.02, sz, 0.6, WHITE, sides=18, name='sign ring'),
          disc(0.4, sy, sz, 0.5, TEAL, sides=18, name='sign board'),
          box(0.4, D, z_roof + 0.4, 0.12, 0.12, 0.25, DARK, 'metal', name='sign post')]
    L += leaf_emblem(0.4, sy - 0.03, sz, 0.3, '#7CC060')
    L.append(lathe(0.4, sy - 0.01, sz, [(0.6, 0), (0.64, 0), (0.64, 0.03), (0.6, 0.03), (0.6, 0)], '#FFFFFF',
                   tilt=[-90 * DEG, 0], sides=18, glow=NEON_T, name='sign neon'))
    L.append(box(0, -0.31, z_roof - 0.05, W + 0.5, 0.04, 0.04, '#FFFFFF', glow=NEON_P, name='neon under the eaves'))
    if lv >= 1:
        # speed lines round the corner, a starburst, planters, a lamp
        for i in range(3):
            z = 1.3 + i * 0.18
            L.append(box(-1.35, -0.02, z, 0.3, 0.04, 0.06, TEAL, 'metal', name='speed line'))
            L.append(cyl(-W / 2 + R, R, z, R + 0.02, 0.06, TEAL, 'metal', sides=16, name='speed line round'))
            L.append(box(-W / 2 - 0.02, R + (Dp - R) / 2, z, 0.04, Dp - R, 0.06, TEAL, 'metal', name='speed line side'))
        L.append(prism(1.55, -0.04, z_roof + 0.9, star(0.42, 0.16, 8), 0.05, BRASS, 'metal', name='starburst'))
        L.append(sphere(1.55, -0.08, z_roof + 0.9, 0.08, '#FFF0C0', sides=6, rings=3, glow=NEON_A, name='starburst core'))
        for px in (-1.65, 1.75):
            L += [box(px, -0.3, 0, 0.45, 0.45, 0.4, TERRA, 'brick', bevel=0.03, name='planter'),
                  sphere(px, -0.3, 0.6, 0.3, LEAF, 'leaves', sides=7, rings=4, lump=0.25, name='planter shrub')]
        L += lamp(1.65, -0.02, 2.1)
    if lv == 2:
        # an upswept Googie canopy over the door, a water tower on the roof (the New York streak), an antenna,
        # bunting lights, a street tree, a round bench
        L += [prism(0.94, -0.45, 2.15, [(-0.75, 0), (0.75, 0), (0.95, 0.25), (0.75, 0.12), (-0.75, 0.12), (-0.95, 0.25)],
                    0.9, TEAL, 'metal', bend=0.25, segs=6, name='Googie canopy'),
              box(0.94, -0.45, 2.12, 1.4, 0.06, 0.04, '#FFFFFF', glow=NEON_A, name='canopy neon')]
        wx, wy = 1.2, 1.6
        for a in (45, 135, 225, 315):
            L.append(limb((wx + 0.38 * math.cos(a * DEG), wy + 0.38 * math.sin(a * DEG), z_roof + 0.34),
                          (wx + 0.3 * math.cos(a * DEG), wy + 0.3 * math.sin(a * DEG), z_roof + 1.1), 0.03, DARK, 'wood',
                          name='tower leg'))
        L += [cyl(wx, wy, z_roof + 1.1, 0.45, 0.9, WOOD, 'battens', sides=12, name='water tower'),
              lathe(wx, wy, z_roof + 2.0, [(0.5, 0), (0.25, 0.35), (0, 0.45)], COPPER, 'metal', sides=12,
                    name='water tower roof', roof=1)]
        L += antenna(-1.2, 1.8, z_roof + 0.4, 1.2)
        for i in range(8):
            t = i / 7
            L.append(sphere(-1.8 + 3.6 * t, -0.35, z_roof - 0.12 - 0.18 * math.sin(math.pi * t), 0.045,
                            ['#FFE0A0', '#FFB0D0', '#A0F0FF'][i % 3], sides=5, rings=2, glow=[NEON_A, NEON_P, NEON_T][i % 3],
                            name='string light'))
        L += [cyl(-2.45, -0.6, 0, 0.1, 1.2, WOOD, 'bark', sides=7, name='street tree trunk'),
              sphere(-2.45, -0.6, 1.7, 0.65, '#F4B6C8', 'leaves', sides=8, rings=5, lump=0.25, name='blossom crown'),
              sphere(-2.3, -0.75, 1.35, 0.4, '#EE9AB4', 'leaves', sides=7, rings=4, lump=0.25, name='blossom crown'),
              cyl(-2.45, -0.6, 0, 0.35, 0.1, STONE, 'stone', sides=10, name='tree ring')]
        L += ivy(1.86, 0.05, 0.4, 2.3, -1)
    return L


def recipes():
    out = {}
    for i, lv in enumerate(LEVELS):
        out[f'look_house_{lv}'] = {'about': f'BD-3 look sketch {lv.upper()}: the house', 'warp': HOUSE_WARP[i],
                                   'layers': house(i)}
    for i, lv in enumerate(LEVELS):
        r = {'about': f'BD-3 look sketch {lv.upper()}: the shop', 'layers': shop(i)}
        if SHOP_WARP[i]:
            r['warp'] = SHOP_WARP[i]
        out[f'look_shop_{lv}'] = r
    for r in out.values():
        r['ppm'] = 32
        r['cel'] = 0.6
    return out


def catalogue(names):
    return {
        'name': 'Look sketches (BD-3)',
        'img': 'scene/props/well.png',
        'ox': -40,
        'oy': -99,
        'shadow': 1.8,
        'sway': 0,
        'flat': 0,
        'tags': [],
        'group': 'test',
        'solid': 1,
        'model': f'{MODELS}/{names[0]}.json',
        'ppm': 32,
        'box': [4.4, 3.0],
        'vary': {'rot': 0, 'lean': 0, 'size': 0},
        'variants': [{'model': f'{MODELS}/{n}.json', 'name': n} for n in names[1:]],
    }


def test_map(names):
    step = 14.0
    W = int(step * len(names) + 12)
    H = 26
    tiles = ['g' * W for _ in range(H)]
    z = 12.0
    tiles[H - 1 - int(z - 4)] = 'p' * W
    props, shots = [], []
    for i, n in enumerate(names):
        p = {'k': KIND, 'x': round(9 + i * step, 2), 'z': z}
        if i:
            p['v'] = i
        props.append(p)
        shots.append({'x': p['x'], 'z': z - 8, 'yaw': 0, 'label': n})
    return {
        'name': 'Test: the look sketches A, B, C (buildings track BD-3)',
        'w': W, 'h': H, 'edge': 'g',
        'sky': ['#8CC6E6', '#BFE3EE', '#F4E8C8'], 'haze': '#EAD9C0', 'hazeD': 40,
        'cam': {'pitch': 30, 'h': 12, 'fov': 1}, 'blur': 0, 'amb': None, 'plain': 1, 'tint': None, 'indoor': 0,
        'far': 'hills', 'farH': 8, 'folk': 0, 'test': 1, 'exits': [], 'checks': [], 'shots': shots,
        'hub': [9, 4], 'kind': 'test', 'tiles': tiles, 'props': props,
    }


def main():
    R = recipes()
    names = list(R)
    for n, r in R.items():
        (ROOT / 'game/art' / MODELS / f'{n}.json').write_text(json.dumps(r, indent=1) + '\n')
    D = gamedata.load()
    D['scenery']['props'][KIND] = catalogue(names)
    D['maps'][ID] = test_map(names)
    gamedata.save(D)
    print(f'wrote {len(R)} recipes, the {KIND} kind and game/data/maps/{ID}.json')


if __name__ == '__main__':
    main()
