#!/usr/bin/env python3
"""Phase 09, batch 6 (Marigold Town, part 2): the town's nature and its made things, in the style of batch 5 (Unova-style
town crossed with retro-futuristic solarpunk: verdigris and brass, globe lamps, solar glass, plants everywhere).

  nature   bush_box (clipped ball), bush_hawthorn_autumn (the hawthorn with autumn leaves), dry_grass, pebbles, puddle (flat: only the scale); the pines stay as drawn
  made     clock_tower (its moving hands kept), fountain, solar_canopy, solar_tree, vertical_garden, streetlamp,
           streetlamp_b, bin (a recycling station), flag_pole (the town's flag kept), bike_rack, sign_shop

    python3 tools/build-props-batch6.py      (after batch1 to batch5)
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
B3 = load('batch3', 'build-props-batch3.py')
B5 = load('batch5', 'build-props-batch5.py')
PPM, A = B1.PPM, B1.AIR
box, limb, disc, sphere, cyl, img = B1.box, B1.limb, B1.disc, B1.sphere, B1.cyl, B1.img
r2, np = B1.r2, B1.np
S2 = math.sqrt(2)
rec, arc, leafy = B5.rec, B5.arc, B5.B1_leafy
IRON, VERD, BRASS, COPPER = '#3E4A5E', A['verd'], A['brass'], A['copper']
SOLAR, WHITE, LEAF, LEAF2, DARK = B5.SOLAR, B5.WHITE, B5.LEAF, B5.LEAF2, B5.DARK
px = lambda m: round(m * PPM)


def globe(L, x, y, z, s=1.6):
    """A big glowing globe on a brass cup (street lamps)."""
    L += [cyl(x, y, z, 0.08, 0.08, BRASS, 'metal', 'lamp cup', 10, k='cone', r1=0.14),
          img(B5.globe_sprite(), x, y, z + 0.06, s=s, glow=1, recv=0, sway=0, name='lamp globe')]


def planter_round(L, x, y, r, h, col='#B4B0C2'):
    L += [cyl(x, y, 0, r, h, col, 'stone', 'planter', 14, k='cone', r1=r * 1.15),
          cyl(x, y, h - 0.02, r * 1.2, 0.06, '#C8C4D4', 'stone', 'planter rim', 14)]
    leafy(L, x, y, h)


# ---------------------------------------------------------------- nature
# the pines stay as they were drawn (the owner's call, 2026-10-19)


def bush_box_recipe():
    """A clipped box ball: a dense round of small dark leaves, lighter sprigs where it has grown since the last trim."""
    G, GL = '#3E7A44', '#5E9A58'
    L = [sphere(0, 0, -0.05, 0.52, G, 'leaves', 'box ball', 12, 7, 0.12, h=0.98)]
    for i in range(8):
        a = i * 0.8
        L.append(sphere(math.cos(a) * 0.38, math.sin(a) * 0.32 - 0.05, 0.35 + (i % 3) * 0.18, 0.1, GL, 'leaves', 'sprig', 6, 3, 0.35))
    return rec(L, 0.7)


# ---------------------------------------------------------------- the street
def streetlamp_recipe():
    """A street lamp: a fluted iron foot, a slim post with brass collars, a globe under a little verdigris hood with a
    solar cell."""
    L = [cyl(0, 0, 0, 0.17, 0.16, IRON, 'metal', 'foot', 8),
         cyl(0, 0, 0.16, 0.12, 0.42, IRON, 'metal', 'fluted base', 8, k='cone', r1=0.07),
         limb((0, 0, 0.58), (0, 0, 3.05), 0.055, 0.04, IRON, 'metal', 'post', 8)]
    for z in (0.6, 1.4, 2.95):
        L.append(cyl(0, 0, z, 0.075, 0.05, BRASS, 'metal', 'collar', 8))
    globe(L, 0, 0, 3.05)
    L += [limb((0, 0, 3.05), (0, 0, 3.62), 0.012, 0.012, IRON, 'metal', 'hood stem', 4),
          cyl(0, 0, 3.55, 0.26, 0.14, VERD, 'metal', 'hood', 10, k='cone', r1=0.05),
          cyl(0, 0, 3.69, 0.08, 0.02, SOLAR, 'solar', 'solar cell', 8),
          sphere(0, 0, 3.7, 0.035, BRASS, 'metal', 'finial', 6, 3)]
    return rec(L)


def streetlamp_b_recipe():
    """The double street lamp: the same post with a curled cross arm and a globe at each end."""
    L = [cyl(0, 0, 0, 0.19, 0.16, IRON, 'metal', 'foot', 8),
         cyl(0, 0, 0.16, 0.13, 0.42, IRON, 'metal', 'fluted base', 8, k='cone', r1=0.075),
         limb((0, 0, 0.58), (0, 0, 3.2), 0.06, 0.045, IRON, 'metal', 'post', 8)]
    for z in (0.6, 1.4):
        L.append(cyl(0, 0, z, 0.08, 0.05, BRASS, 'metal', 'collar', 8))
    for sx in (-1, 1):
        L += [limb((0, 0, 2.95), (sx * 0.55, 0, 3.0), 0.03, 0.025, IRON, 'metal', 'arm', 6),
              arc(sx * 0.27, 0, 2.85, 0.12, math.pi if sx > 0 else 0, (math.pi if sx > 0 else 0) + sx * 2.6, 0.015, IRON, 'metal', 'curl', 8)]
        globe(L, sx * 0.55, 0, 3.0, 1.4)
        L += [cyl(sx * 0.55, 0, 3.5, 0.2, 0.1, VERD, 'metal', 'hood', 10, k='cone', r1=0.04),
              limb((sx * 0.55, 0, 3.0), (sx * 0.55, 0, 3.52), 0.01, 0.01, IRON, 'metal', 'hood stem', 4)]
    L += [cyl(0, 0, 3.2, 0.09, 0.08, BRASS, 'metal', 'top', 8), sphere(0, 0, 3.27, 0.05, BRASS, 'metal', 'finial', 6, 3)]
    return rec(L)


def flag_pole_recipe():
    """A flag pole: a stone foot, a tall white pole with a brass ball, a cleat and the halyard (the flag itself is the
    town's own, drawn and waved by the game)."""
    L = [cyl(0, 0, 0, 0.3, 0.18, '#B4B0C2', 'stone', 'foot', 8),
         cyl(0, 0, 0.18, 0.2, 0.1, '#C8C4D4', 'stone', 'foot top', 8),
         limb((0, 0, 0.28), (0, 0, 4.75), 0.06, 0.035, '#E8E8EC', 'metal', 'pole', 8),
         sphere(0, 0, 4.73, 0.07, BRASS, 'metal', 'ball', 8, 4),
         box(0.06, 0, 1.2, 0.03, 0.03, 0.14, BRASS, 'metal', 'cleat'),
         limb((0.05, 0, 1.25), (0.05, 0, 4.65), 0.006, 0.006, '#D6C08A', 'cloth', 'halyard', 4)]
    return rec(L)


def bike(L, cx, y, col):
    """A town bike along x: spoked wheels, a diamond frame, saddle, bars, a bell."""
    for wx in (cx - 0.52, cx + 0.52):
        L.append(B5.arc(wx, y, 0.34, 0.31, 0, 2 * math.pi, 0.03, '#2E2A3A', 'plain', 'tyre', 14))
        for k in range(4):
            a = k * math.pi / 4
            L.append(limb((wx - math.cos(a) * 0.28, y, 0.34 - math.sin(a) * 0.28), (wx + math.cos(a) * 0.28, y, 0.34 + math.sin(a) * 0.28),
                          0.006, 0.006, '#C8C4D4', 'metal', 'spoke', 3))
    rh, bb, st, hd, fh = (cx - 0.52, y, 0.34), (cx - 0.05, y, 0.34), (cx - 0.17, y, 0.78), (cx + 0.36, y, 0.8), (cx + 0.52, y, 0.34)
    for a, b in ((rh, st), (st, hd), (hd, fh), (bb, st), (bb, hd), (rh, bb)):
        L.append(limb(a, b, 0.024, 0.024, col, 'metal', 'frame', 5))
    L += [box(cx - 0.2, y, 0.8, 0.22, 0.09, 0.05, DARK, 'cloth', 'saddle'),
          limb((cx + 0.36, y, 0.8), (cx + 0.32, y, 0.95), 0.018, 0.018, '#C8C4D4', 'metal', 'stem', 4),
          limb((cx + 0.3, y - 0.22, 0.96), (cx + 0.3, y + 0.22, 0.96), 0.016, 0.016, '#C8C4D4', 'metal', 'bars', 4),
          sphere(cx + 0.3, y - 0.12, 0.98, 0.025, BRASS, 'metal', 'bell', 6, 3)]


def bike_rack_recipe():
    """A bike rack of verdigris hoops on a rail, a red bike with a basket and a blue one."""
    L = [box(0, 0.05, 0, 2.2, 0.08, 0.05, IRON, 'metal', 'rail')]
    for x in (-0.8, -0.27, 0.27, 0.8):
        L.append(arc(x, 0.05, 0.05, 0.24, 0, math.pi, 0.025, VERD, 'metal', 'hoop', 8, plane='yz'))
    bike(L, -0.3, -0.18, '#E04848')
    bike(L, 0.35, 0.28, '#4A86D8')
    L += [box(0.07, -0.18, 0.85, 0.24, 0.24, 0.16, A['straw'], 'hay', 'basket')]
    return rec(L)


def bin_recipe():
    """A recycling station: three bins (green, blue, yellow) with rounded lids, slots and white marks, under a small
    solar roof on verdigris posts."""
    L = [box(0, 0, 0, 1.8, 0.8, 0.08, '#B4B0C2', 'stone', 'pad')]
    for i, col in enumerate(('#5EAA58', '#4A86D8', '#F4C03C')):
        x = -0.58 + i * 0.58
        L += [box(x, 0, 0.08, 0.52, 0.62, 0.86, col, 'panels', 'bin'),
              {'k': 'limb', 'x': r2(x - 0.27), 'y': 0, 'z': 0.94, 'x2': r2(x + 0.27), 'y2': 0, 'z2': 0.94, 'r': 0.31, 'r1': 0.31,
               'sides': 14, 'col': col, 'tex': 'plain', 'name': 'lid'},
              box(x, -0.32, 0.86, 0.3, 0.02, 0.05, DARK, 'plain', 'slot'),
              disc(x, -0.31, 0.5, (0, -1, 0), 0.1, 0.02, WHITE, 'plain', 'mark', 10),
              box(x, -0.33, 0.48, 0.1, 0.01, 0.04, col, 'plain', 'mark arrow')]
    for sx in (-1, 1):
        L.append(limb((sx * 0.9, 0.3, 0.08), (sx * 0.9, 0.3, 1.55), 0.035, 0.035, VERD, 'metal', 'post', 6))
    L += [box(0, 0.1, 1.55, 2.0, 0.95, 0.06, VERD, 'metal', 'roof'),
          box(0, 0.1, 1.61, 1.85, 0.82, 0.03, SOLAR, 'solar', 'solar panel'),
          box(0, -0.38, 1.5, 2.02, 0.03, 0.08, BRASS, 'metal', 'roof edge')]
    return rec(B1.shift_y(L, 0.5))


def sign_shop_recipe():
    """The shop's street sign, a twin of the clinic's: a blue ring, a white face and a coral shopping bag, hanging from
    a brass post's arm, a globe lamp on top, a planter at its foot."""
    BLUE = '#4E9AD6'
    L = [box(0, 0, 0, 0.42, 0.42, 0.28, COPPER, 'metal', 'planter'),
         box(0, 0, 0.28, 0.46, 0.46, 0.04, BRASS, 'metal', 'planter rim')]
    leafy(L, 0, 0, 0.28)
    L += [limb((0, 0, 0.3), (0, 0, 2.2), 0.04, 0.035, A['iron'], 'metal', 'post', 8),
          limb((0, 0, 2.0), (0.62, 0, 2.0), 0.025, 0.025, A['iron'], 'metal', 'arm', 6),
          limb((0, 0, 1.75), (0.25, 0, 2.0), 0.015, 0.015, A['iron'], 'metal', 'arm brace', 4)]
    for x in (0.28, 0.56):
        L.append(limb((x, 0, 2.0), (x, 0, 1.86), 0.008, 0.008, A['iron'], 'metal', 'chain', 4))
    ez = 1.5
    L += [disc(0.42, 0, ez, (0, -1, 0), 0.36, 0.06, BLUE, 'metal', 'sign ring', 20),
          disc(0.42, 0, ez, (0, -1, 0), 0.29, 0.08, WHITE, 'plain', 'sign face', 20),
          disc(0.42, 0, ez, (0, 1, 0), 0.29, 0.08, WHITE, 'plain', 'sign back', 20)]
    for sy in (-1, 1):
        L += [box(0.42, sy * 0.1, ez - 0.18, 0.28, 0.03, 0.24, B5.CORAL, 'plain', 'bag'),
              arc(0.42, sy * 0.11, ez + 0.06, 0.08, 0, math.pi, 0.015, B5.CORAL_D, 'plain', 'bag handle', 6)]
    B5.globe_lamp(L, 0, 0, 2.2)
    return rec(L)


# ---------------------------------------------------------------- the square
def fountain_recipe():
    """The town fountain: a round stone basin with a pale rim, two bowls on fluted pedestals, a brass finial spout, and
    water in each."""
    W_ = '#5E9AC8'
    L = [cyl(0, 0, 0, 1.75, 0.12, '#A8A4B4', 'stone', 'basin foot', 24),
         cyl(0, 0, 0.1, 1.68, 0.42, '#C4C0CE', 'stone', 'basin wall', 24),
         ring(0, 0, 0.53, 1.6, 0.1, '#DCD8E4', 'stone', 'basin rim', 24),
         cyl(0, 0, 0.5, 1.52, 0.04, W_, 'plain', 'basin water', 24)]
    L += [cyl(0, 0, 0.45, 0.32, 0.95, '#C4C0CE', 'stone', 'pedestal', 8, k='cone', r1=0.2),
          cyl(0, 0, 1.38, 0.2, 0.32, '#C4C0CE', 'stone', 'bowl', 16, k='cone', r1=0.8),
          ring(0, 0, 1.7, 0.78, 0.05, '#DCD8E4', 'stone', 'bowl rim', 20),
          cyl(0, 0, 1.69, 0.72, 0.03, W_, 'plain', 'bowl water', 20),
          cyl(0, 0, 1.68, 0.12, 0.45, '#C4C0CE', 'stone', 'upper pedestal', 8),
          cyl(0, 0, 2.1, 0.1, 0.14, '#C4C0CE', 'stone', 'top bowl', 12, k='cone', r1=0.32),
          cyl(0, 0, 2.23, 0.29, 0.02, W_, 'plain', 'top water', 12),
          sphere(0, 0, 2.22, 0.08, BRASS, 'metal', 'finial', 8, 4),
          limb((0, 0, 2.3), (0, 0, 2.48), 0.03, 0.015, BRASS, 'metal', 'spout', 6)]
    # HB-10a: each water a little over its bowl's solid top (it was under it, hidden), under the rim
    # lily pads and a few flowers in the basin
    for i, a in enumerate((0.6, 2.2, 3.9, 5.2)):
        L.append(cyl(math.cos(a) * 1.15, math.sin(a) * 1.0, 0.54, 0.14, 0.015, '#6EAE52', 'leaves', 'lily pad', 8))
        if i % 2 == 0:
            L.append(sphere(math.cos(a) * 1.15, math.sin(a) * 1.0, 0.555, 0.045, '#F4B8D0', 'plain', 'lily', 6, 3))
    return rec(L, 0.75)


def ring(x, y, z, r, t, col, tex, name, n=16):
    pts = [[r2(x + math.cos(2 * math.pi * i / n) * r), r2(y + math.sin(2 * math.pi * i / n) * r), r2(z), r2(t)] for i in range(n + 1)]
    return {'k': 'limb', 'pts': pts, 'sides': 6, 'col': col, 'tex': tex, 'name': name}


def solar_canopy_recipe():
    """A shelter: a solar roof on two verdigris posts over a bench, a globe lamp under the roof, planters at the posts."""
    L = []
    for sx in (-1, 1):
        L += [cyl(sx * 1.31, 0, 0, 0.12, 0.1, IRON, 'metal', 'post foot', 8),
              limb((sx * 1.31, 0, 0.1), (sx * 1.31, 0, 2.62), 0.06, 0.05, VERD, 'metal', 'post', 8),
              limb((sx * 1.31, 0, 2.2), (sx * 0.95, 0, 2.6), 0.025, 0.025, VERD, 'metal', 'brace', 5)]
        planter_round(L, sx * 1.31, -0.4, 0.18, 0.3, COPPER)
    L += [box(0, 0, 2.6, 3.2, 1.3, 0.1, VERD, 'metal', 'roof frame'),
          box(0, 0, 2.7, 3.0, 1.15, 0.04, SOLAR, 'solar', 'solar roof'),
          box(0, -0.66, 2.58, 3.22, 0.03, 0.08, BRASS, 'metal', 'roof edge')]
    for x in (-0.75, 0.0, 0.75):
        L.append(box(x, 0, 2.745, 0.03, 1.15, 0.01, '#8A94B0', 'metal', 'panel line'))
    L += [box(0, 0.1, 0.42, 1.8, 0.42, 0.05, A['plank'], 'wood', 'bench seat'),
          box(0, 0.3, 0.47, 1.8, 0.05, 0.35, A['plank'], 'wood', 'bench back')]
    for sx in (-0.75, 0.75):
        L.append(box(sx, 0.1, 0, 0.06, 0.38, 0.42, IRON, 'metal', 'bench leg'))
    L.append(limb((0, 0, 2.6), (0, 0, 2.35), 0.01, 0.01, IRON, 'metal', 'lamp stem', 4))
    B5.globe_lamp(L, 0, 0, 2.2)
    return rec(L)


def solar_tree_recipe():
    """A solar tree: a verdigris trunk from a stone planter, branching to five round solar panels tipped to the sky, a
    globe lamp in the fork."""
    L = []
    planter_round(L, 0, 0, 0.45, 0.45)
    L.append(limb((0, 0, 0.45), (0, 0, 2.55), 0.09, 0.06, VERD, 'metal', 'trunk', 8))
    for z in (0.5, 1.6):
        L.append(cyl(0, 0, z, 0.1, 0.05, BRASS, 'metal', 'trunk ring', 8))
    arms = [(-1.15, -0.2, 2.75), (1.15, -0.15, 2.85), (-0.6, 0.35, 3.55), (0.65, 0.3, 3.45), (0.0, -0.1, 3.8)]
    for i, (ax, ay, az) in enumerate(arms):
        base = (0, 0, 2.3 + 0.2 * (i % 3))
        mid = (ax * 0.6, ay * 0.6, az - 0.35)
        L += [{'k': 'limb', 'pts': [[*base, 0.045], [r2(mid[0]), r2(mid[1]), r2(mid[2]), 0.035], [ax, ay, az - 0.06, 0.028]],
               'sides': 6, 'col': VERD, 'tex': 'metal', 'name': 'branch'},
              disc(ax, ay, az, (ax * 0.25, ay * 0.4 - 0.25, 1), 0.46, 0.05, COPPER, 'metal', 'panel rim', 16),
              disc(ax, ay, az + 0.01, (ax * 0.25, ay * 0.4 - 0.25, 1), 0.4, 0.06, SOLAR, 'solar', 'solar panel', 16)]
    B5.globe_lamp(L, 0, -0.08, 2.6)
    return rec(L)


def vertical_garden_recipe():
    """A vertical garden: a verdigris frame with four copper troughs of herbs and flowers, a trellis behind, and a drip
    pipe along the top."""
    w = 1.9
    L = [box(0, 0.12, 0, w - 0.1, 0.04, 2.8, '#8A6A4E', 'wood', 'trellis')]
    for sx in (-1, 1):
        L.append(box(sx * w / 2, 0, 0, 0.08, 0.3, 2.9, VERD, 'metal', 'frame post'))
    L.append(box(0, 0, 2.85, w + 0.1, 0.32, 0.08, VERD, 'metal', 'frame top'))
    for i, z in enumerate((0.2, 0.85, 1.5, 2.15)):
        L += [box(0, -0.02, z, w - 0.12, 0.26, 0.18, COPPER, 'metal', 'trough'),
              box(0, -0.16, z + 0.04, w - 0.12, 0.02, 0.04, BRASS, 'metal', 'trough band')]
        for j in range(6):
            x = -w / 2 + 0.2 + (w - 0.4) * j / 5
            L.append(sphere(x, -0.04, z + 0.12, 0.14 + 0.02 * ((i + j) % 2), LEAF if (i + j) % 2 else LEAF2, 'leaves', 'plant', 8, 4, 0.3))
            if (i + j) % 3 == 0:
                L.append(sphere(x + 0.04, -0.14, z + 0.32, 0.04, B5.FRUIT[(i + j) % 6], 'plain', 'flower', 6, 3))
    L += [limb((-w / 2, -0.1, 2.8), (w / 2, -0.1, 2.8), 0.025, 0.025, COPPER, 'metal', 'drip pipe', 6)]
    return rec(B1.shift_y(L, 0.18))


def clock_tower_recipe():
    """The clock tower: a stone plinth, a brick shaft with stone quoins and bands, an arched door and window, a stone
    clock stage with a brass-ringed face on each side (the front one carries the game's moving hands), an open belfry
    with a brass bell, and a verdigris copper spire with a brass weathervane."""
    BR, ST = '#B65A44', '#DCD2BE'
    sw, cw = 1.8, 2.0
    L = [box(0, 0, 0, 2.3, 2.3, 0.4, '#A8A4B4', 'stone', 'plinth'),
         box(0, 0, 0.4, sw, sw, 5.4, BR, 'brick', 'shaft')]
    for sx in (-1, 1):
        for sy in (-1, 1):
            for i in range(14):
                big = i % 2 == 0
                L.append(box(sx * (sw / 2 - 0.08), sy * (sw / 2 - 0.08), 0.4 + i * 0.385, 0.22 if big else 0.18, 0.18 if big else 0.22, 0.37, ST, 'stone', 'quoin'))
    for z in (2.3, 4.2):
        L.append(box(0, 0, z, sw + 0.08, sw + 0.08, 0.14, ST, 'stone', 'band'))
    fy = -sw / 2
    # the door and the window
    L += [box(0, fy - 0.03, 0.4, 0.8, 0.04, 1.2, '#7A4E34', 'wood', 'door'),
          disc(0, fy, 1.6, (0, -1, 0), 0.4, 0.07, '#7A4E34', 'wood', 'door top', 14),
          B5.arc(0, fy - 0.06, 1.6, 0.48, 0, math.pi, 0.07, ST, 'stone', 'door arch', 10),
          sphere(0.25, fy - 0.08, 1.0, 0.035, BRASS, 'metal', 'door knob', 6, 3),
          box(0, fy - 0.02, 3.1, 0.34, 0.04, 0.7, A['glass'], 'plain', 'window'),
          disc(0, fy, 3.8, (0, -1, 0), 0.17, 0.05, A['glass'], 'plain', 'window top', 10)]
    # the clock stage
    L += [box(0, 0, 5.8, cw + 0.15, cw + 0.15, 0.15, ST, 'stone', 'stage base'),
          box(0, 0, 5.95, cw, cw, 1.25, '#CAC4D2', 'stone', 'clock stage'),
          box(0, 0, 7.2, cw + 0.2, cw + 0.2, 0.15, ST, 'stone', 'stage cornice')]
    cz = 6.55
    for n in ((0, -1, 0), (0, 1, 0), (-1, 0, 0), (1, 0, 0)):
        x, y = n[0] * cw / 2, n[1] * cw / 2
        L += [disc(x, y, cz, n, 0.55, 0.04, BRASS, 'metal', 'clock ring', 24),
              disc(x, y, cz, n, 0.48, 0.05, '#F8F2E0', 'plain', 'clock face', 24)]
    for k in range(12):
        a = 2 * math.pi * k / 12
        L.append(box(math.cos(a) * 0.4, -cw / 2 - 0.055, cz + math.sin(a) * 0.4 - 0.025, 0.05, 0.01, 0.05, DARK, 'plain', 'hour mark'))
    # the belfry: four corner piers, arches, a bell
    bz = 7.35
    for sx in (-1, 1):
        for sy in (-1, 1):
            L.append(box(sx * 0.82, sy * 0.82, bz, 0.3, 0.3, 1.1, BR, 'brick', 'belfry pier'))
    for n in ((0, -1), (0, 1), (-1, 0), (1, 0)):
        L.append(B5.arc(n[0] * 0.95, n[1] * 0.95, bz + 0.75, 0.55, 0, math.pi, 0.08, ST, 'stone', 'belfry arch', 10)
                 if n[0] == 0 else B5.arc(n[0] * 0.95, 0, bz + 0.75, 0.55, 0, math.pi, 0.08, ST, 'stone', 'belfry arch', 10, plane='yz'))
    L += [box(0, 0, bz + 1.1, 2.05, 2.05, 0.15, ST, 'stone', 'belfry cornice'),
          limb((0, 0, bz + 1.1), (0, 0, bz + 0.85), 0.02, 0.02, IRON, 'metal', 'bell hanger', 4),
          cyl(0, 0, bz + 0.35, 0.36, 0.52, BRASS, 'metal', 'bell', 12, k='cone', r1=0.14),
          sphere(0, 0, bz + 0.3, 0.07, '#B88A3C', 'metal', 'clapper', 6, 3)]
    # the spire
    rz = bz + 1.25
    L += [cyl(0, 0, rz, 1.28 * S2, 1.9, VERD, 'metal', 'spire', 4, k='cone', r1=0.04, rot=r2(math.pi / 4)),
          sphere(0, 0, rz + 1.85, 0.08, BRASS, 'metal', 'spire ball', 8, 4),
          limb((0, 0, rz + 1.9), (0, 0, rz + 2.45), 0.025, 0.015, BRASS, 'metal', 'vane post', 5),
          box(0, 0, rz + 2.25, 0.5, 0.02, 0.12, BRASS, 'metal', 'vane'),
          limb((-0.25, 0, rz + 2.1), (0.25, 0, rz + 2.1), 0.012, 0.012, BRASS, 'metal', 'vane arms', 4),
          limb((0, -0.25, rz + 2.1), (0, 0.25, rz + 2.1), 0.012, 0.012, BRASS, 'metal', 'vane arms', 4)]
    # ivy up one corner, and flowers at the foot
    for i in range(12):
        L.append(sphere(-sw / 2 - 0.05 + 0.05 * math.sin(i * 1.7), fy - 0.06, 0.45 + i * 0.32, 0.12 + (i % 3) * 0.02,
                        LEAF if i % 2 else LEAF2, 'leaves', 'ivy', 7, 3, 0.35))
    return rec(B1.shift_y(L, cw / 2 + 0.06), 0.7)


CLOCK_Z = 6.55


def clock_tower_fx():
    return [{'k': 'window', 'x': 0, 'y': -px(3.45)}, {'k': 'glow', 'x': 0, 'y': -px(CLOCK_Z)}]


def fountain_fx():
    """its spray; HB-10b: lit from below after dusk (three lamp glows round the basin) and fireflies round it"""
    return [{'k': 'spray', 'x': 0, 'y': -px(2.5)},
            {'k': 'glow', 'x': -px(1.0), 'y': -px(0.6), 'z': -0.5}, {'k': 'glow', 'x': px(1.0), 'y': -px(0.6), 'z': -0.5},
            {'k': 'glow', 'x': 0, 'y': -px(0.6), 'z': 0.9},
            {'k': 'fireflies', 'x': 0, 'y': 0, 'n': 7, 'r': 3.2}]


# ---------------------------------------------------------------- the catalogue
FIXED = {'rot': 0, 'lean': 0, 'size': 0}
MADE = {
    # key: (recipe, fx, vary)
    'bush_box': (bush_box_recipe, None, None),
    'streetlamp': (streetlamp_recipe, lambda: [{'k': 'glow', 'x': 0, 'y': -px(3.25)}], FIXED),
    'streetlamp_b': (streetlamp_b_recipe, lambda: [{'k': 'glow', 'x': -px(0.55), 'y': -px(3.2)}, {'k': 'glow', 'x': px(0.55), 'y': -px(3.2)}], FIXED),
    'flag_pole': (flag_pole_recipe, None, FIXED),
    'bike_rack': (bike_rack_recipe, None, FIXED),
    'bin': (bin_recipe, None, FIXED),
    'sign_shop': (sign_shop_recipe, None, FIXED),
    'fountain': (fountain_recipe, fountain_fx, FIXED),
    'solar_canopy': (solar_canopy_recipe, lambda: [{'k': 'glow', 'x': 0, 'y': -px(2.3)}], FIXED),
    'solar_tree': (solar_tree_recipe, lambda: [{'k': 'glow', 'x': 0, 'y': -px(2.72)}], FIXED),
    'vertical_garden': (vertical_garden_recipe, None, FIXED),
    'clock_tower': (clock_tower_recipe, clock_tower_fx, FIXED),
}
FLAT = ['dry_grass', 'pebbles', 'puddle']
ROWS = [('marigold-ground', ['dry_grass', 'pebbles', 'puddle', 'bush_box', 'bush_hawthorn_autumn'], 2.2),
        ('marigold-street', ['streetlamp', 'streetlamp_b', 'flag_pole', 'bike_rack', 'bin', 'sign_shop'], 3.2),
        ('marigold-square', ['fountain', 'solar_canopy', 'solar_tree', 'vertical_garden', 'clock_tower'], 5.0)]


def main():
    D = gamedata.load()
    C = D['scenery']['props']
    leaves = B1.NEXT / 'leaves'
    # the autumn hawthorn: the hawthorn's model, its leaf picture recoloured to the autumn picture's colours
    base, key = 'bush_hawthorn', 'bush_hawthorn_autumn'
    sheet_path = 'scene/next/leaves/bush_hawthorn.png'
    sheet = B1.rgba(B1.ART / sheet_path)
    own = B1.rgba(B1.PROPS / f'{key}.png')
    src = B1.rgba(B1.PROPS / f'{base}.png')
    mo, ms = own[..., 3] > 0, src[..., 3] > 0
    swapped = B1.save_png(B1.recolour(sheet, B1.leaf_colours(src, ms), B1.leaf_colours(own, mo)), leaves / 'bush_hawthorn_autumn.png')
    M = C[key]
    M.update(model=C[base]['model'], ppm=PPM, swap={sheet_path: swapped})
    for f in ('vol', 'volDepth'):
        M.pop(f, None)
    for k in FLAT:
        C[k]['ppm'] = PPM
    for key, (fn, fx, vary) in MADE.items():
        M = C[key]
        M['model'] = B1.write_recipe(key, fn())
        M['ppm'] = PPM
        if fx: M['fx'] = fx()
        if vary: M['vary'] = dict(vary)
        for f in ('build', 'layers', 'vol', 'volDepth'):
            M.pop(f, None)
    # the clock tower now stands on a footprint (its front at its base point, where the game draws its moving hands)
    T = C['clock_tower']
    T.pop('solid', None)
    T['box'] = [2.3, 2.3]
    for h in T.get('hands', []):
        h['x'], h['y'] = 0, -px(CLOCK_Z)
    C['vertical_garden']['box'] = [1.9, 0.35]
    B5.ROWS = B5.ROWS + ROWS
    D['maps']['test_props_marigold'] = B5.showcase(C)
    gamedata.save(D)
    print('marigold part 2:', ', '.join(['bush_hawthorn_autumn'] + FLAT + list(MADE)))


if __name__ == '__main__':
    main()
