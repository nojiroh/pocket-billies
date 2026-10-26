#!/usr/bin/env python3
"""Phase 09, batch 11 (part 1): the rooms' furniture and the made things the run generator places, as models in the
style of batches 4 and 7 (low-poly, 32 px to the metre, the airship's warm palette and the building sheet's materials).
Swapped straight in under their own keys, as batches 1-10 were, so every placement draws the model; the old pictures
stay as the fallback when 3D props are off.

  rooms      plant_tall bookshelf sack crate_goods shop_counter shop_shelf sofa fireplace barrel clinic_bed
             counter_white fridge_drinks haybale_stack lab_desk lab_machine privacy_screen
  wall       wall_clock wall_painting wall_window blackboard (shallow reliefs on the back wall)
  generator  campfire lookout_tower tent (the waystation) mine_entrance

Each keeps its size, its base point and its footprint (box), so the rooms' layouts and walking round things don't
change. What reads better drawn stays a picture inside the model, cut from the old picture: the painting's canvas, the
window's view, the chalk, the fridge's bottles, the desk's screen, the lab machine's glass tube and the campfire's flames.
Furniture that stands against the back wall (z 8.5 in every room; wall pieces are placed at 8.45) is no deeper than the
gap, so nothing pokes through the wall.

    python3 tools/build-props-batch11.py      (independent of batches 1-10 apart from their helpers; rerunnable)

Writes game/art/scene/next/models/<key>.json, game/art/scene/next/decals/*.png, the catalogue entries in
game/data/scenery.json, and the showcase map test_props_rooms.
"""
import importlib.util
import math
import sys
from pathlib import Path

import numpy as np

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
B5 = load('batch5', 'build-props-batch5.py')
B7 = load('batch7', 'build-props-batch7.py')
BI = load('island', 'build-props-island.py')
PPM, A = B1.PPM, B1.AIR
box, limb, disc, sphere, cyl, img, r2 = B1.box, B1.limb, B1.disc, B1.sphere, B1.cyl, B1.img, B1.r2
plank, stone, arc, rec = BI.plank, BI.stone, B5.arc, B4.rec
S2 = math.sqrt(2)
OLD_PPM = 34                       # the old pictures' scale; a cut of one keeps its size in metres at this scale
CUT = round(PPM / OLD_PPM, 3)
FIXED = {'rot': 0, 'lean': 0}
px = lambda m: round(m * PPM)
WALL = 0.05                        # wall pieces stand 5 cm in front of the back wall: their backs touch it

INK = '#2E2A3A'
SHELF, SHELF_D, SHELF_L = '#7A5238', '#5E3E2C', '#A8764E'
BOOKS = ('#E8C050', '#5E9AD0', '#E86A5A', '#62B098', '#F4F0E8', '#C478D0', '#F49A3A', '#8CC850', '#4E6AA8', '#D85A78')
GOODS = ('#F07090', '#7ED4AC', '#F49A3A', '#C9A0E8', '#F4D040', '#86C8DC', '#F4F0E8', '#E86A5A')
WHITE, WHITE_D, PINK, RED = '#F2EEE6', '#D8D2CA', '#F2A2B4', '#E04848'
SLATE, SLATE_D, SLATE_L = '#4A5268', '#323A4E', '#9AA0B0'
SCREEN, CYAN = '#86DCC4', '#5ED8E8'
BRICK, BRICK_D = '#C8644A', '#A44E3C'
SOFA, SOFA_D, CUSHION = '#5E7CB0', '#47608E', '#F2C85A'
BURLAP, BURLAP_D = '#D8C49A', '#B8A276'
HAY, HAY_D, TWINE = BI.HAY, BI.HAY_D, '#B8403A'
DRUM, DRUM_D = '#5A80C0', '#3E5C94'
MINT, MINT_D = '#86D8AC', '#5EB48A'
GOLD, GOLD_D = '#F0C048', '#C8962C'
CHALK_FRAME = '#B07848'
ROCK, ROCK_L, ROCK_D, PIT = '#6E6878', '#8C8696', '#544E5E', '#14101C'
TENT_RED, TENT_CREAM, TENT_BACK = '#E8604E', '#FAF0DC', '#7E6E9E'


def cut(pic, b, name, clear=()):
    return B1.decal(pic, b, name, clear)


def face(path, x, y, z, **kw):
    """a cut of an old picture standing flat on a front face (it turns with the model), at its old size"""
    return img(path, x, y, z, face='fixed', s=CUT, recv=0, shadow=0, sway=0, **kw)


def fx(*items):
    """the effects (fire, glow, window, sparkle) at points of the model: (kind, x across, z up) in metres"""
    return [{'k': k, 'x': px(x), 'y': -px(z)} for k, x, z in items]


def frame(L, x, y, z, w, h, t, d, col, tex, name):
    """a picture frame's four bars round a w x h opening whose bottom is at z, standing at depth y (its front)"""
    L += [box(x, y + d / 2, z - t, w + 2 * t, d, t, col, tex, name),
          box(x, y + d / 2, z + h, w + 2 * t, d, t, col, tex, name),
          box(x - w / 2 - t / 2, y + d / 2, z, t, d, h, col, tex, name),
          box(x + w / 2 + t / 2, y + d / 2, z, t, d, h, col, tex, name)]


# ================================================================ the rooms
def plant_tall_recipe():
    """An aloe in a terracotta pot: a tapered pot with a rim and a ring of long spiky leaves curving out and up."""
    L = [cyl(0, 0, 0, 0.2, 0.46, '#C8664A', 'plain', 'pot', 12, k='cone', r1=0.25),
         cyl(0, 0, 0.42, 0.27, 0.07, '#D87A5A', 'plain', 'pot rim', 12),
         cyl(0, 0, 0.44, 0.22, 0.03, '#5E4430', 'plain', 'soil', 12)]
    rng = np.random.default_rng(11)
    n = 13
    for i in range(n):
        a = 2 * math.pi * i / n + rng.random() * 0.3
        out = 0.28 + 0.2 * rng.random() if i % 3 else 0.1 + 0.1 * rng.random()   # every third leaf stands near upright
        up = 0.8 + 0.25 * rng.random()
        pts = []
        for k in range(4):
            f = k / 3
            pts.append([r2(math.cos(a) * (0.04 + out * f ** 1.4)), r2(math.sin(a) * (0.04 + out * f ** 1.4)),
                        r2(0.46 + up * math.sin(f * math.pi / 2) * 0.95), r2(0.045 * (1 - f) + 0.008)])
        L.append({'k': 'limb', 'pts': pts, 'sides': 4, 'col': '#5E9A48' if i % 2 else '#76B856', 'tex': 'leaves', 'name': 'leaf'})
    return rec(L)


def shelf_carcass(L, w, h, d, shelves, col=SHELF, dark=SHELF_D, name='shelf'):
    """the case of a shelf unit (sides, top, plinth, back) and its boards; gives each board's top z"""
    t = 0.06
    L += [box(-w / 2 + t / 2, 0, 0, t, d, h, col, 'wood', name + ' side'),
          box(w / 2 - t / 2, 0, 0, t, d, h, col, 'wood', name + ' side'),
          box(0, 0, h - t, w, d + 0.02, t, SHELF_L, 'wood', name + ' top'),
          box(0, 0, 0, w - 2 * t, d, 0.12, dark, 'wood', name + ' plinth'),
          box(0, d / 2 - 0.02, 0.1, w - 2 * t, 0.03, h - 0.15, dark, 'wood', name + ' back')]
    tops = []
    gap = (h - 0.12 - t) / shelves
    for i in range(shelves):
        z = 0.12 + gap * i
        if i: L.append(box(0, 0, z - 0.03, w - 2 * t, d - 0.04, 0.03, SHELF_L, 'wood', name + ' board'))
        tops.append((z, gap - 0.06))
    return tops


def books(L, x0, x1, z, room, d, seed, cols=BOOKS):
    rng = np.random.default_rng(seed)
    x = x0 + 0.02
    while True:
        bw = 0.05 + 0.05 * rng.random()
        if x + bw > x1 - 0.02: break
        bh = room * (0.62 + 0.3 * rng.random())
        c = cols[int(rng.integers(len(cols)))]
        L.append(box(x + bw / 2, 0.02 + (rng.random() - 0.5) * 0.04, z, bw - 0.008, d * (0.7 + 0.15 * rng.random()), bh, c, 'plain', 'book'))
        x += bw + (0.06 if rng.random() < 0.08 else 0)


def bookshelf_recipe():
    """A tall bookcase in dark wood: five shelves of books of every colour and height, a gap here and there."""
    w, h, d = 1.85, 2.85, 0.42
    L = []
    for i, (z, room) in enumerate(shelf_carcass(L, w, h, d, 5)):
        books(L, -w / 2 + 0.06, w / 2 - 0.06, z, room, d - 0.06, 40 + i)
    return rec(B1.shift_y(L, d / 2))


def shop_shelf_recipe():
    """A shop's shelf unit: four shelves of bottles, jars and boxes in bright packaging."""
    w, h, d = 2.05, 2.74, 0.5
    L = []
    rng = np.random.default_rng(7)
    for i, (z, room) in enumerate(shelf_carcass(L, w, h, d, 4)):
        x = -w / 2 + 0.12
        while x < w / 2 - 0.16:
            c = GOODS[int(rng.integers(len(GOODS)))]
            k = rng.random()
            if k < 0.45:                                                       # a bottle
                L += [cyl(x, 0, z, 0.06, room * 0.55, c, 'plain', 'bottle', 8),
                      cyl(x, 0, z + room * 0.55, 0.03, room * 0.12, WHITE, 'plain', 'cap', 6)]
                x += 0.15
            elif k < 0.75:                                                     # a box
                bw = 0.14 + 0.06 * rng.random()
                L.append(box(x + bw / 2 - 0.06, 0, z, bw, 0.22, room * (0.5 + 0.25 * rng.random()), c, 'plain', 'box'))
                x += bw + 0.04
            else:                                                              # a jar
                L += [cyl(x, 0, z, 0.08, room * 0.38, c, 'plain', 'jar', 10),
                      cyl(x, 0, z + room * 0.38, 0.085, 0.04, A['brass'], 'metal', 'jar lid', 10)]
                x += 0.19
        L.append(box(0, -d / 2 + 0.01, z - 0.03, w - 0.12, 0.02, 0.05, '#F4E2B8', 'plain', 'price strip'))
    return rec(B1.shift_y(L, d / 2))


def sack_recipe():
    """Three burlap sacks, tied at the neck: a big one in front, one behind it and a smaller one at its side."""
    L = []
    for x, y, r, h in ((-0.42, -0.05, 0.42, 0.95), (0.08, 0.22, 0.38, 1.1), (0.5, -0.1, 0.34, 0.82)):
        L += [sphere(x, y, 0, r, BURLAP, 'cloth', 'sack', 10, 6, 0.1, h * 0.88),
              cyl(x, y, h * 0.8, r * 0.36, h * 0.14, BURLAP_D, 'cloth', 'sack neck', 8, k='cone', r1=r * 0.22),
              cyl(x, y, h * 0.86, r * 0.25, 0.04, '#8A6A44', 'plain', 'tie', 8),
              cyl(x, y, h * 0.92, r * 0.16, 0.08, BURLAP, 'cloth', 'sack top', 7, k='cone', r1=r * 0.3)]
    return rec(L)


def crate_goods_recipe():
    """A slatted crate of goods: bottles and rolls standing up out of it."""
    w, d, h = 0.92, 0.66, 0.56
    L = [box(0, 0, 0, w, d, h, A['plank'], 'wood', 'crate')]
    for z in (0.06, 0.3):
        L.append(box(0, -d / 2 - 0.01, z, w, 0.02, 0.16, A['wood'], 'wood', 'crate slat'))
    for sx in (-1, 1):
        L.append(box(sx * (w / 2 - 0.04), -d / 2 - 0.02, 0, 0.08, 0.03, h, A['dwood'], 'wood', 'crate post'))
    rng = np.random.default_rng(3)
    for i in range(7):
        c = ('#F49A3A', '#8CC850', '#E86A5A', '#F4D040', '#E86A5A', '#62B098', '#F49A3A')[i]
        x, y = -w / 2 + 0.13 + (w - 0.26) * (i % 4) / 3, -0.1 if i < 4 else 0.12
        L.append(cyl(x + (rng.random() - 0.5) * 0.05, y, h - 0.1, 0.06, 0.32 + 0.12 * rng.random(), c, 'plain', 'goods', 8))
    return rec(B1.shift_y(L, d / 2))


def counter_top_things(L, x, y, z):
    """a till on the counter: a dark body, a sloping keyboard, a screen"""
    L += [box(x, y, z, 0.5, 0.42, 0.28, SLATE, 'metal', 'till'),
          box(x, y - 0.12, z + 0.28, 0.46, 0.16, 0.05, SLATE_L, 'metal', 'till keys'),
          box(x, y + 0.08, z + 0.28, 0.42, 0.18, 0.26, SLATE_D, 'metal', 'till screen box'),
          box(x, y - 0.015, z + 0.33, 0.3, 0.02, 0.16, SCREEN, 'plain', 'till screen')]


def shop_counter_recipe():
    """The shop's wooden counter: panelled front, a light top, a till, a red bag and a brass bell."""
    w, d, h = 2.66, 0.84, 1.0
    L = [box(0, 0, 0, w - 0.06, d - 0.06, h - 0.06, A['wood'], 'wood', 'counter'),
         box(0, 0, h - 0.07, w, d, 0.07, '#D8A878', 'wood', 'counter top'),
         box(0, -d / 2 + 0.02, 0, w - 0.06, 0.04, 0.1, A['dwood'], 'wood', 'kick board')]
    for i in range(4):
        x = -w / 2 + 0.36 + (w - 0.72) * i / 3
        frame(L, x, -d / 2 + 0.01, 0.24, 0.42, 0.42, 0.04, 0.03, A['dwood'], 'wood', 'panel')
    counter_top_things(L, 0.78, 0.05, h)
    L += [box(-0.15, 0.05, h, 0.36, 0.24, 0.3, '#E86A5A', 'cloth', 'bag'),
          box(-0.15, 0.05, h + 0.3, 0.36, 0.25, 0.04, '#C84E40', 'cloth', 'bag fold'),
          limb((-0.27, 0.05, h + 0.32), (-0.15, 0.05, h + 0.45), 0.012, 0.012, '#C84E40', 'cloth', 'bag handle', 4),
          limb((-0.15, 0.05, h + 0.45), (-0.03, 0.05, h + 0.32), 0.012, 0.012, '#C84E40', 'cloth', 'bag handle', 4),
          cyl(-0.85, -0.1, h, 0.1, 0.02, A['iron'], 'metal', 'bell base', 10),
          {**sphere(-0.85, -0.1, h + 0.02, 0.09, GOLD, 'metal', 'bell', 10, 4), 'h': 0.1},
          sphere(-0.85, -0.1, h + 0.11, 0.025, GOLD_D, 'metal', 'bell button', 6, 3)]
    return rec(B1.shift_y(L, d / 2))


def sofa_recipe():
    """A blue three-seater: a deep seat with two cushions, a high back, rolled arms, dark wooden feet, a yellow pillow."""
    w, d = 2.2, 0.85
    L = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            L.append(cyl(sx * (w / 2 - 0.12), sy * (d / 2 - 0.12), 0, 0.04, 0.1, A['dwood'], 'wood', 'foot', 6, k='cone', r1=0.03))
    L += [box(0, 0.02, 0.1, w - 0.1, d - 0.08, 0.28, SOFA_D, 'cloth', 'base'),
          box(0, d / 2 - 0.13, 0.36, w - 0.1, 0.24, 0.66, SOFA, 'cloth', 'back'),
          box(0, d / 2 - 0.13, 1.0, w - 0.06, 0.28, 0.06, SOFA, 'cloth', 'back top')]
    for sx in (-1, 1):
        L += [box(sx * (w / 2 - 0.11), 0.0, 0.36, 0.2, d - 0.06, 0.28, SOFA, 'cloth', 'arm'),
              limb((sx * (w / 2 - 0.11), -d / 2 + 0.04, 0.66), (sx * (w / 2 - 0.11), d / 2 - 0.04, 0.66), 0.11, 0.11, SOFA, 'cloth', 'arm roll', 8),
              box(sx * 0.46, -0.1, 0.38, 0.88, d - 0.32, 0.14, SOFA, 'cloth', 'seat cushion')]
    L += [box(-0.62, d / 2 - 0.33, 0.52, 0.42, 0.14, 0.38, CUSHION, 'cloth', 'pillow')]
    return rec(B1.shift_y(L, d / 2))


def fireplace_recipe():
    """A brick fireplace against the wall: an arched dark firebox with logs, a stone hearth, a grey mantel with a red
    vase and a gold photo frame on it. Shallow (0.35 m), so it stays in front of the back wall."""
    w, d, H = 1.85, 0.35, 1.68
    L = [box(0, 0, 0, w, d, H, BRICK, 'brick', 'chimney breast'),
         box(0, -0.08, H, 2.06, d + 0.16, 0.1, '#C8C4D4', 'stone', 'mantel'),
         box(0, -0.06, H - 0.06, 1.95, d + 0.1, 0.06, '#A8A2B2', 'stone', 'mantel moulding'),
         box(0, -d / 2 - 0.2, 0, 1.5, 0.42, 0.06, '#A8A2B2', 'stone', 'hearth'),
         box(0, -d / 2 + 0.05, 0, 0.9, 0.12, 0.8, PIT, 'plain', 'firebox'),
         disc(0, -d / 2 + 0.03, 0.8, (0, -1, 0), 0.45, 0.04, PIT, 'plain', 'firebox arch', 14)]
    for sx in (-1, 1):
        L.append(box(sx * 0.53, -d / 2 - 0.005, 0, 0.16, 0.02, 1.25, BRICK_D, 'brick', 'arch jamb'))
    L += [limb((-0.32, -d / 2 - 0.02, 0.1), (0.3, -d / 2 + 0.06, 0.16), 0.06, 0.055, A['dwood'], 'bark', 'log', 6),
          limb((-0.28, -d / 2 + 0.06, 0.16), (0.34, -d / 2 - 0.02, 0.1), 0.055, 0.05, A['wood'], 'bark', 'log', 6),
          box(0, -d / 2 + 0.02, 0.06, 0.6, 0.12, 0.04, '#F49A3A', 'plain', 'embers')]
    L += [cyl(-0.65, -0.05, H + 0.1, 0.07, 0.04, '#C84E40', 'plain', 'vase foot', 8),
          sphere(-0.65, -0.05, H + 0.13, 0.1, '#E86A5A', 'plain', 'vase', 10, 5),
          cyl(-0.65, -0.05, H + 0.3, 0.04, 0.07, '#E86A5A', 'plain', 'vase neck', 8),
          box(0.5, 0.0, H + 0.1, 0.36, 0.06, 0.3, GOLD, 'metal', 'photo frame'),
          box(0.5, -0.032, H + 0.15, 0.24, 0.01, 0.2, '#F4F0E8', 'plain', 'photo')]
    return rec(B1.shift_y(L, d / 2)), fx(('fire', 0, 0.3))


def barrel_recipe():
    """A blue steel drum: rolling hoops, a darker lid with a rim and a bung."""
    r, h = 0.36, 0.98
    L = [cyl(0, 0, 0, r, h, DRUM, 'metal', 'drum', 16)]
    for z in (0.03, h / 3, 2 * h / 3):
        L.append(cyl(0, 0, z, r + 0.015, 0.05, DRUM_D, 'metal', 'hoop', 16))
    L += [cyl(0, 0, h - 0.04, r + 0.012, 0.05, DRUM_D, 'metal', 'rim', 16),
          cyl(0, 0, h, r - 0.03, 0.01, '#2A2E3E', 'metal', 'lid', 16),
          cyl(0.15, -0.1, h, 0.05, 0.03, SLATE_L, 'metal', 'bung', 8)]
    return rec(L)


def clinic_bed_recipe():
    """A clinic bed, its head against the back: a grey frame on legs, a white mattress, a pink blanket over the front
    two thirds with a turned-down fold, a pillow, a rounded white headboard."""
    w, d = 1.0, 2.0
    L = []
    for sx in (-1, 1):
        for y in (-d / 2 + 0.08, d / 2 - 0.08):
            L.append(cyl(sx * (w / 2 - 0.06), y, 0, 0.035, 0.32, SLATE_L, 'metal', 'leg', 6))
    L += [box(0, 0, 0.3, w, d, 0.1, SLATE, 'metal', 'frame'),
          box(0, 0.02, 0.4, w - 0.06, d - 0.08, 0.16, WHITE, 'cloth', 'mattress'),
          box(0, -0.25, 0.42, w + 0.02, d * 0.66, 0.16, PINK, 'cloth', 'blanket'),
          box(0, 0.46, 0.42, w + 0.02, 0.14, 0.18, '#F8D2DA', 'cloth', 'blanket fold'),
          box(0, -0.25 - d * 0.33 - 0.005, 0.28, w + 0.02, 0.02, 0.3, PINK, 'cloth', 'blanket hem'),
          box(0, d / 2 - 0.3, 0.56, w - 0.2, 0.36, 0.12, '#FFFFFF', 'cloth', 'pillow'),
          box(0, d / 2 - 0.04, 0.3, w, 0.08, 0.8, WHITE, 'plain', 'headboard'),
          limb((-w / 2, d / 2 - 0.04, 1.1), (w / 2, d / 2 - 0.04, 1.1), 0.04, 0.04, WHITE, 'plain', 'headboard top', 8)]
    for sx in (-1, 1):
        L.append(sphere(sx * (w / 2 - 0.04), d / 2 - 0.04, 1.06, 0.06, WHITE, 'plain', 'headboard knob', 8, 4))
    return rec(B1.shift_y(L, d / 2))


def counter_white_recipe():
    """The clinic's reception desk: a white body with a pink band and the red cross, a screen and a little plant."""
    w, d, h = 2.66, 0.84, 1.02
    L = [box(0, 0, 0, w - 0.04, d - 0.04, h - 0.06, WHITE, 'panels', 'desk'),
         box(0, 0, h - 0.06, w, d, 0.06, '#FFFFFF', 'plain', 'desk top'),
         box(0, -d / 2 + 0.005, 0.38, w - 0.04, 0.02, 0.07, PINK, 'plain', 'pink band'),
         box(0, -d / 2 + 0.005, 0, w - 0.04, 0.02, 0.06, WHITE_D, 'plain', 'kick board'),
         box(-0.2, -d / 2 - 0.005, 0.5, 0.3, 0.03, 0.1, RED, 'plain', 'cross'),
         box(-0.2, -d / 2 - 0.005, 0.4, 0.1, 0.03, 0.3, RED, 'plain', 'cross')]
    x = 0.82
    L += [box(x, 0.1, h, 0.22, 0.16, 0.04, SLATE, 'metal', 'screen foot'),
          box(x, 0.1, h + 0.04, 0.06, 0.06, 0.12, SLATE, 'metal', 'screen stand'),
          box(x, 0.08, h + 0.14, 0.5, 0.08, 0.36, SLATE_D, 'metal', 'screen'),
          box(x, 0.035, h + 0.18, 0.42, 0.01, 0.28, SCREEN, 'plain', 'screen glass')]
    B4.leafy(L, -0.85, 0.05, h + 0.2, 0.12, 3, 5, 0.08, flowers=False)
    L.insert(0, cyl(-0.85, 0.05, h, 0.1, 0.16, '#D87A5A', 'plain', 'pot', 10, k='cone', r1=0.12))
    return rec(B1.shift_y(L, d / 2)), fx(('glow', x, h + 0.32))


def fridge_drinks_recipe():
    """A drinks fridge: a white case with a light-blue lit header, a glass door showing rows of bottles (the old
    drawing), a chrome handle. 0.5 m deep, so it stays in front of the back wall."""
    w, d, h = 1.12, 0.5, 2.6
    L = [box(0, 0, 0, w, d, h, WHITE, 'panels', 'fridge'),
         box(0, -d / 2 + 0.005, 0, w - 0.02, 0.02, 0.2, WHITE_D, 'plain', 'kick plate'),
         box(0, -d / 2 - 0.01, h - 0.22, w - 0.08, 0.03, 0.14, '#86B4D8', 'plain', 'header')]
    frame(L, 0, -d / 2 - 0.03, 0.3, 0.9, 1.98, 0.04, 0.04, '#E4E0DA', 'plain', 'door frame')
    L += [limb((0.38, -d / 2 - 0.07, 1.0), (0.38, -d / 2 - 0.07, 1.6), 0.018, 0.018, SLATE_L, 'metal', 'handle', 6),
          face(cut('fridge_drinks', (6, 9, 37, 77), 'fridge_drinks_glass'), 0, -d / 2 - 0.02, 0.3, name='bottles')]
    return rec(B1.shift_y(L, d / 2)), fx(('glow', 0, 1.3))


def haybale_stack_recipe():
    """Three round bales lying with their faces to the room, two below and one on top, tied round with red twine."""
    r, ln = 0.6, 1.0
    L = []
    for x, z in ((-0.64, 0), (0.64, 0), (0, 2 * r * 0.88)):
        zc = z + r
        L += [limb((x, -ln / 2, zc), (x, ln / 2, zc), r, r, HAY, 'hay', 'bale', 16),
              disc(x, -ln / 2, zc, (0, -1, 0), r - 0.04, 0.02, '#E8C878', 'rings', 'bale face', 16)]
        for y in (-0.22, 0.22):
            L.append(arc(x, y, zc, r + 0.01, 0, 2 * math.pi, 0.018, TWINE, 'plain', 'twine', 16))
    return rec(L)


def lab_desk_recipe():
    """The lab's desk: a light top on two legs and a drawer pedestal, an old box monitor (its screen the old drawing)
    and a white desk globe on a stand."""
    w, d, h = 1.96, 0.76, 0.92
    L = [box(0, 0, h - 0.08, w, d, 0.08, '#D8A878', 'wood', 'desk top'),
         box(0, -d / 2 + 0.01, h - 0.1, w - 0.1, 0.03, 0.04, '#B88A60', 'wood', 'top edge')]
    for y in (-d / 2 + 0.08, d / 2 - 0.08):
        L.append(box(-w / 2 + 0.1, y, 0, 0.08, 0.08, h - 0.08, A['wood'], 'wood', 'leg'))
    L += [box(w / 2 - 0.3, 0, 0, 0.5, d - 0.06, h - 0.08, A['wood'], 'wood', 'pedestal'),
          box(w / 2 - 0.36, -d / 2 + 0.02, 0.08, 0.26, 0.02, 0.6, '#B07A50', 'wood', 'drawer front'),
          sphere(w / 2 - 0.27, -d / 2, 0.38, 0.02, A['brass'], 'metal', 'drawer knob', 6, 3)]
    mx, mw = -0.25, 0.74
    L += [box(mx, 0.05, h, 0.5, 0.4, 0.06, SLATE, 'metal', 'monitor foot'),
          box(mx, 0.1, h + 0.06, mw, 0.5, 0.66, SLATE_D, 'metal', 'monitor'),
          box(mx, -0.16, h + 0.06, mw, 0.04, 0.66, '#5A6278', 'metal', 'monitor bezel'),
          box(mx, -0.12, h + 0.68, mw - 0.06, 0.08, 0.04, SLATE_L, 'metal', 'monitor top'),
          face(cut('lab_desk', (20, 6, 43, 26), 'lab_desk_screen'), mx, -0.19, h + 0.17, name='screen')]
    L += [cyl(0.6, 0.0, h, 0.08, 0.02, A['brass'], 'metal', 'globe foot', 8),
          limb((0.6, 0.0, h + 0.02), (0.6, 0.0, h + 0.12), 0.015, 0.015, A['brass'], 'metal', 'globe stand', 4),
          sphere(0.6, 0.0, h + 0.1, 0.12, '#F4F0E0', 'plain', 'globe', 10, 5)]
    return rec(B1.shift_y(L, d / 2)), fx(('glow', mx, h + 0.42))


def lab_machine_recipe():
    """The lab's machine: a slate console with coloured buttons, a tall glass tube with the golden orb inside (the old
    drawing, facing you from every side, as a round tube does) and a cap with vents. 0.9 m deep (the back wall)."""
    w, d = 1.85, 0.9
    zb, zt = 0.76, 2.74
    L = [box(0, 0, 0, w, d, zb - 0.06, SLATE, 'metal', 'console'),
         box(0, 0, zb - 0.06, w + 0.04, d + 0.04, 0.06, SLATE_L, 'metal', 'console top'),
         box(-w / 2 + 0.3, -d / 2 - 0.005, 0.05, 0.5, 0.02, 0.6, '#7A8094', 'metal', 'console panel')]
    for i, c in enumerate(('#E86A5A', '#F4D040', '#A8DCB4', '#86B4D8')):
        L.append(box(-0.5 + i * 0.26, -d / 2 - 0.02, 0.38, 0.14, 0.04, 0.1, c, 'plain', 'button'))
    L += [cyl(0, 0, zb, 0.47, 0.06, SLATE_D, 'metal', 'tube foot', 16),
          cyl(0, 0, zt - 0.02, 0.47, 0.08, SLATE_D, 'metal', 'tube collar', 16),
          box(0, 0, zt + 0.04, 1.18, 0.62, 0.22, SLATE, 'metal', 'cap'),
          box(0, 0, zt + 0.26, 1.2, 0.64, 0.04, SLATE_L, 'metal', 'cap top'),
          img(cut('lab_machine', (15, 11, 45, 77), 'lab_machine_tube'), 0, 0, zb + 0.04, s=CUT, recv=0, sway=0, glow=0.4, name='glass tube')]
    for i in range(3):
        L.append(box(-0.3 + i * 0.3, -0.32, zt + 0.1, 0.18, 0.02, 0.05, '#2A2E3E', 'plain', 'vent'))
    return rec(B1.shift_y(L, d / 2)), fx(('glow', 0, 1.76), ('sparkle', 0, 2.09))


def privacy_screen_recipe():
    """A folding screen of three mint cloth panels in slim dark frames on little feet, the middle one set back."""
    pw, h = 0.5, 1.9
    L = []
    for i, (x, y) in enumerate(((-0.54, -0.06), (0, 0.06), (0.54, -0.06))):
        L.append(box(x, y, 0.12, pw - 0.06, 0.03, h - 0.2, MINT if i != 1 else MINT_D, 'cloth', 'panel'))
        for sx in (-1, 1):
            L += [box(x + sx * (pw / 2 - 0.02), y, 0.04, 0.04, 0.05, h - 0.04, '#3A4458', 'metal', 'frame post'),
                  box(x + sx * (pw / 2 - 0.02), y, 0, 0.06, 0.16, 0.04, '#3A4458', 'metal', 'foot')]
        for z in (0.08, h - 0.08):
            L.append(box(x, y, z, pw, 0.04, 0.04, '#3A4458', 'metal', 'frame rail'))
    return rec(B1.shift_y(L, 0.15))


# ---------------------------------------------------------------- on the back wall
def wall_clock_recipe():
    """A round wall clock: a wooden rim, a cream face with hour marks and dark hands."""
    zc, R = 2.09, 0.41
    L = [disc(0, WALL, zc, (0, -1, 0), R, 0.06, A['wood'], 'wood', 'clock rim', 20),
         disc(0, WALL - 0.04, zc, (0, -1, 0), R - 0.06, 0.035, '#F8F0DA', 'plain', 'clock face', 20)]
    for i in range(12):
        a = 2 * math.pi * i / 12
        t = 0.05 if i % 3 == 0 else 0.03
        L.append(box(math.sin(a) * 0.28, WALL - 0.08, zc + math.cos(a) * 0.28 - t / 2, 0.025, 0.01, t, INK, 'plain', 'hour mark'))
    L += [limb((0, WALL - 0.085, zc), (0, WALL - 0.085, zc + 0.22), 0.016, 0.01, INK, 'plain', 'minute hand', 4),
          limb((0, WALL - 0.09, zc), (0.15, WALL - 0.09, zc), 0.018, 0.012, INK, 'plain', 'hour hand', 4),
          disc(0, WALL - 0.08, zc, (0, -1, 0), 0.03, 0.02, A['brass'], 'metal', 'clock pin', 8)]
    return rec(L)


def wall_painting_recipe():
    """A landscape (the old drawing) in a deep gold frame with a darker inner edge."""
    cw, ch, z0 = 44 / OLD_PPM, 34 / OLD_PPM, 2.74 - 40 / OLD_PPM
    L = [box(0, WALL - 0.015, z0, cw, 0.03, ch, '#6E8E5A', 'plain', 'canvas board')]
    frame(L, 0, WALL - 0.08, z0, cw, ch, 0.07, 0.08, GOLD, 'metal', 'frame')
    frame(L, 0, WALL - 0.05, z0, cw, ch, 0.025, 0.05, GOLD_D, 'metal', 'frame lip')
    L.append(face(cut('wall_painting', (6, 6, 50, 40), 'wall_painting_canvas'), 0, WALL - 0.035, z0, name='canvas'))
    return rec(L)


def wall_window_recipe():
    """A window in the back wall: a deep cream frame and sill, the panes the old drawing (sky, a cloud, a pot plant)."""
    pw, ph, z0 = 43 / OLD_PPM, 36 / OLD_PPM, 2.68 - 40 / OLD_PPM
    L = [box(0, WALL - 0.01, z0, pw, 0.02, ph, '#86B4D0', 'plain', 'glass')]
    frame(L, 0, WALL - 0.1, z0, pw, ph, 0.08, 0.1, '#F2EEE0', 'plain', 'window frame')
    L += [box(0, WALL - 0.14, z0 - 0.12, pw + 0.3, 0.2, 0.05, '#F8F4EA', 'plain', 'sill'),
          box(0, WALL - 0.06, z0 + ph * 0.49, pw, 0.04, 0.035, '#F2EEE0', 'plain', 'transom'),
          box(-0.03, WALL - 0.06, z0, 0.035, 0.04, ph, '#F2EEE0', 'plain', 'mullion'),
          face(cut('wall_window', (6, 4, 49, 40), 'wall_window_view'), 0, WALL - 0.025, z0, name='view')]
    return rec(L), fx(('window', 0, z0 + ph * 0.6))


def blackboard_recipe():
    """A blackboard on the wall: the board (the old drawing, its chalk), a wooden frame, a tray with a stick of chalk."""
    bw, bh, z0 = 93 / OLD_PPM, 38 / OLD_PPM, 2.44 - 41 / OLD_PPM
    L = [box(0, WALL - 0.015, z0, bw, 0.03, bh, '#344A44', 'plain', 'board')]
    frame(L, 0, WALL - 0.06, z0, bw, bh, 0.07, 0.06, CHALK_FRAME, 'wood', 'board frame')
    L += [box(0, WALL - 0.12, z0 - 0.1, bw + 0.1, 0.14, 0.04, '#C89868', 'wood', 'chalk tray'),
          limb((-0.85, WALL - 0.1, z0 - 0.04), (-0.68, WALL - 0.12, z0 - 0.04), 0.018, 0.018, '#F4F0E8', 'plain', 'chalk', 5),
          face(cut('blackboard', (3, 3, 96, 41), 'blackboard_chalk'), 0, WALL - 0.035, z0, name='chalk writing')]
    return rec(L)


# ================================================================ what the run generator places
def campfire_recipe():
    """A campfire: a ring of grey stones round a bed of embers, three logs leant together, and the flames (the old
    drawing, facing you, with the fire effect over them)."""
    L = [cyl(0, 0, 0, 0.38, 0.03, '#3A2E2A', 'plain', 'ash bed', 12)]
    for i in range(9):
        a = 2 * math.pi * i / 9 + 0.2
        L.append(stone(math.cos(a) * 0.47, math.sin(a) * 0.4, 0, 0.13 + 0.03 * (i % 3), 0.16 + 0.03 * (i % 2),
                       '#A8A4B0' if i % 2 else '#8E8A98', 'fire stone', sides=6, rings=3))
    for i in range(3):
        a = 2 * math.pi * i / 3 + 0.5
        L.append(limb((math.cos(a) * 0.32, math.sin(a) * 0.28, 0.04), (0, 0, 0.42), 0.05, 0.035,
                      A['dwood'] if i % 2 else A['wood'], 'bark', 'log', 6))
    L += [sphere(0, 0, 0.02, 0.18, '#F49A3A', 'plain', 'embers', 8, 3, 0.2, 0.1),
          img(cut('campfire', (11, 12, 34, 33), 'campfire_flames', ('#A8A4B0',)), 0, 0, 0.06, s=CUT, recv=0, sway=1, glow=1, name='flames')]
    return rec(L), fx(('fire', 0, 0.36))


def lookout_tower_recipe():
    """A fire lookout on a timber trestle: four splayed legs braced with crosses in three bays, a ladder up the front,
    a railed deck, a cabin of boards with a band of windows all round, a clay-tiled hip roof and an aerial."""
    R0, R1, zd = 1.55, 1.08, 4.85
    leg = lambda sx, sy, z: (sx * (R0 + (R1 - R0) * z / zd), sy * (R0 + (R1 - R0) * z / zd), z)
    L = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            L += [plank(leg(sx, sy, 0), leg(sx, sy, zd), 0.09, A['wood'], 'leg'),
                  box(sx * R0, sy * R0, 0, 0.36, 0.36, 0.14, '#9A96A6', 'stone', 'footing')]
    bays = (0.25, 1.75, 3.25, zd - 0.1)
    for i in range(3):
        za, zb = bays[i], bays[i + 1]
        for side in range(4):
            sx, sy = ((-1, -1), (1, -1), (1, 1), (-1, 1))[side]
            tx, ty = ((1, -1), (1, 1), (-1, 1), (-1, -1))[side]
            L += [plank(leg(sx, sy, za), leg(tx, ty, zb), 0.035, A['dwood'], 'brace'),
                  plank(leg(tx, ty, za), leg(sx, sy, zb), 0.035, A['dwood'], 'brace'),
                  plank(leg(sx, sy, zb), leg(tx, ty, zb), 0.045, A['wood'], 'girt')]
    # the ladder up the front, to the deck's edge
    D = 1.38
    yl, yt = -R0 - 0.4, -D - 0.06
    for sx in (-0.22, 0.22):
        L.append(plank((sx, yl, 0), (sx, yt, zd + 0.9), 0.035, A['plank'], 'ladder rail'))
    for k in range(17):
        f = (k + 0.5) / 17
        y, z = yl + (yt - yl) * f, (zd + 0.9) * f
        L.append(plank((-0.22, y, z), (0.22, y, z), 0.02, A['plank'], 'rung'))
    # the deck, its rail, the cabin
    L += [box(0, 0, zd, 2 * D, 2 * D, 0.14, A['plank'], 'wood', 'deck'),
          box(0, 0, zd - 0.14, 2 * D - 0.1, 2 * D - 0.1, 0.14, A['dwood'], 'wood', 'deck joists')]
    for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1), (0, -1), (0, 1), (-1, 0), (1, 0)):
        L.append(box(sx * (D - 0.04), sy * (D - 0.04), zd + 0.14, 0.07, 0.07, 0.86, A['dwood'], 'wood', 'rail post'))
    for z in (zd + 0.55, zd + 0.98):
        L += [box(0, -D + 0.04, z, 2 * D, 0.07, 0.06, A['wood'], 'wood', 'rail'),
              box(0, D - 0.04, z, 2 * D, 0.07, 0.06, A['wood'], 'wood', 'rail'),
              box(-D + 0.04, 0, z, 0.07, 2 * D, 0.06, A['wood'], 'wood', 'rail'),
              box(D - 0.04, 0, z, 0.07, 2 * D, 0.06, A['wood'], 'wood', 'rail')]
    C, zc, zr = 1.0, zd + 0.14, zd + 1.62
    L += [box(0, 0, zc, 2 * C, 2 * C, 0.62, '#C8925C', 'siding', 'cabin wall'),
          box(0, 0, zc + 1.3, 2 * C, 2 * C, 0.18, '#C8925C', 'siding', 'cabin wall top')]
    for (x, y, w_, d_) in ((0, -C, 2 * C - 0.1, 0.04), (0, C, 2 * C - 0.1, 0.04), (-C, 0, 0.04, 2 * C - 0.1), (C, 0, 0.04, 2 * C - 0.1)):
        L.append(box(x, y, zc + 0.62, w_, d_, 0.68, '#7EC4E4', 'plain', 'window band'))
    for k in range(5):
        f = -C + 2 * C * k / 4
        for (x, y) in ((f, -C), (f, C), (-C, f), (C, f)):
            L.append(box(x, y, zc + 0.62, 0.07, 0.07, 0.68, '#A8764E', 'wood', 'window post'))
    L += [box(0, -C - 0.02, zc + 0.6, 2 * C + 0.06, 0.05, 0.05, '#E8D8B0', 'plain', 'sill')]
    L += [cyl(0, 0, zr, (C + 0.35) * S2, 0.95, '#C86A4E', 'rooftiles', 'roof', 4, k='cone', rot=r2(math.pi / 4)),
          box(0, 0, zr - 0.08, 2 * C + 0.5, 2 * C + 0.5, 0.08, A['dwood'], 'wood', 'eaves'),
          limb((0, 0, zr + 0.9), (0, 0, 8.2), 0.03, 0.015, '#3A3442', 'metal', 'aerial', 5),
          sphere(0, 0, 8.18, 0.04, '#E8604E', 'plain', 'aerial tip', 6, 3)]
    return rec(L, 0.66), fx(('window', 0, zc + 0.95))


def tent_recipe():
    """The waystation: a marquee with a red and cream striped pyramid roof and a scalloped valance, a yellow pennant
    on top, four poles, a lavender back cloth and a plank counter of brightly wrapped goods."""
    w, d = 3.2, 2.4
    hw, hd, zr, ra = 1.7, 1.3, 1.78, 1.35       # half width / depth of the roof, its eaves, its rise
    L = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            L.append(limb((sx * (w / 2 - 0.1), sy * (d / 2 - 0.15), 0), (sx * (w / 2 - 0.1), sy * (d / 2 - 0.15), zr), 0.05, 0.04, A['dwood'], 'wood', 'pole', 6))
    L += [cyl(0, 0, zr, hw * S2, ra, TENT_CREAM, 'cloth', 'roof', 4, k='cone', ry=r2(hd * S2), rot=r2(math.pi / 4))]
    apex = (0, 0, zr + ra + 0.02)
    # the red stripes: boards from the apex down each face to its eave
    for i in range(9):
        f = -1 + 2 * (i + 0.5) / 9
        for p in ((f * hw, -hd), (f * hw, hd)):
            L.append(plank(apex, (p[0] * 1.01, p[1] * 1.01, zr + 0.01), 0.07, TENT_RED, 'roof stripe', 'cloth'))
    for i in range(7):
        f = -1 + 2 * (i + 0.5) / 7
        for p in ((-hw, f * hd), (hw, f * hd)):
            L.append(plank(apex, (p[0] * 1.01, p[1] * 1.01, zr + 0.01), 0.07, TENT_RED, 'roof stripe', 'cloth'))
    # the valance round the eaves, scalloped
    for (cx, cy, n_, along) in ((0, -hd, 9, 'x'), (0, hd, 9, 'x'), (-hw, 0, 7, 'y'), (hw, 0, 7, 'y')):
        span = 2 * (hw if along == 'x' else hd)
        sw = span / n_
        for i in range(n_):
            o = -span / 2 + sw * (i + 0.5)
            x, y = (cx + o, cy) if along == 'x' else (cx, cy + o)
            nrm = (0, -1 if cy < 0 else 1, 0) if along == 'x' else (-1 if cx < 0 else 1, 0, 0)
            col = TENT_RED if i % 2 == 0 else TENT_CREAM
            L += [box(x, y, zr - 0.14, sw if along == 'x' else 0.02, 0.02 if along == 'x' else sw, 0.15, col, 'cloth', 'valance'),
                  disc(x, y, zr - 0.14, nrm, sw / 2, 0.015, col, 'cloth', 'scallop', 10)]
    L += [limb(apex, (0, 0, zr + ra + 0.5), 0.025, 0.02, A['dwood'], 'wood', 'flag pole', 5),
          box(0.17, 0, zr + ra + 0.3, 0.32, 0.02, 0.18, '#F4C03C', 'cloth', 'pennant'),
          box(0, d / 2 - 0.15, 0, w - 0.25, 0.03, zr - 0.1, TENT_BACK, 'cloth', 'back cloth')]
    # the counter and its goods
    cy = -0.1
    L += [box(0, cy, 0, w - 0.5, 0.6, 0.62, A['wood'], 'wood', 'counter'),
          box(0, cy, 0.62, w - 0.4, 0.7, 0.05, A['plank'], 'wood', 'counter top')]
    for i in range(6):
        L.append(box(-w / 2 + 0.45 + (w - 0.9) * i / 5, cy - 0.31, 0.04, 0.3, 0.02, 0.54, '#D6A26C' if i % 2 else A['plank'], 'wood', 'counter board'))
    for i, c in enumerate(('#F49A3A', '#E86A5A', '#8CC850', '#F4D040', '#C478D0', '#F07090', '#86C8DC', '#F49A3A')):
        x = -1.05 + 2.1 * i / 7
        L.append(sphere(x, cy - 0.05 + 0.08 * (i % 2), 0.67, 0.12, c, 'plain', 'wrapped goods', 8, 4, 0, 0.14))
    return rec(B1.shift_y(L, d / 2))


def mine_entrance_recipe():
    """A mine's mouth in a hump of dark rock: a squared timber frame (two posts, a lintel), the black shaft going in,
    rails on sleepers running out of it and a lantern on the rock beside it."""
    L = []
    # the rock: masses either side, over the frame and behind it, so the shaft's mouth stays clear
    for x, y, r, ry, h, c in ((-1.75, 0.95, 0.95, 0.9, 3.0, ROCK_L), (1.75, 0.95, 0.95, 0.9, 3.2, ROCK),
                              (-1.05, 1.25, 1.1, 0.9, 3.7, ROCK_L), (1.1, 1.25, 1.1, 0.9, 3.6, ROCK_D),
                              (0, 1.35, 1.5, 0.85, 4.0, ROCK)):
        L.append(stone(x, y, 0, r, h, c, 'rock', ry=ry, sides=8, rings=5, lump=0.18))
    L.append(stone(0, 0.75, 2.25, 1.1, 1.2, ROCK, 'rock over the frame', ry=0.55, sides=8, rings=4, lump=0.18))
    for x, y, r in ((-2.3, 0.4, 0.35), (2.35, 0.35, 0.3), (-1.6, 0.1, 0.22)):
        L.append(stone(x, y, 0, r, r * 1.2, ROCK_D, 'fallen rock', sides=6, rings=3))
    # the shaft and its frame
    L += [box(0, 0.45, 0, 1.3, 0.7, 2.0, PIT, 'plain', 'shaft'),
          box(0, 0.12, 2.0, 1.86, 0.36, 0.26, A['wood'], 'wood', 'lintel'),
          box(0, 0.12, 2.26, 1.6, 0.3, 0.06, A['dwood'], 'wood', 'lintel cap')]
    for sx in (-1, 1):
        L += [box(sx * 0.76, 0.12, 0, 0.22, 0.3, 2.0, A['wood'], 'wood', 'post'),
              box(sx * 0.76, 0.12, 0, 0.3, 0.36, 0.12, A['dwood'], 'wood', 'post foot')]
    for sx in (-0.3, 0.3):
        L.append(box(sx, -0.25, 0.04, 0.05, 1.3, 0.04, '#8A8E9E', 'metal', 'rail'))
    for k in range(5):
        L.append(box(0, -0.8 + k * 0.3, 0, 0.9, 0.1, 0.04, A['dwood'], 'wood', 'sleeper'))
    lx, lz = 1.3, 1.82
    L += [limb((lx - 0.05, 0.25, lz + 0.35), (lx - 0.05, 0.05, lz + 0.35), 0.015, 0.015, A['iron'], 'metal', 'lantern hook', 4),
          box(lx - 0.05, 0.05, lz - 0.05, 0.16, 0.16, 0.24, '#F4D060', 'plain', 'lantern glass'),
          box(lx - 0.05, 0.05, lz + 0.19, 0.2, 0.2, 0.05, A['iron'], 'metal', 'lantern top'),
          box(lx - 0.05, 0.05, lz - 0.08, 0.2, 0.2, 0.04, A['iron'], 'metal', 'lantern base')]
    return rec(L, 0.7), fx(('glow', lx - 0.05, lz + 0.07))


# ================================================================ the catalogue
MADE = {
    # key: recipe; a recipe gives the model, or (the model, its effects)
    'plant_tall': plant_tall_recipe, 'bookshelf': bookshelf_recipe, 'sack': sack_recipe, 'crate_goods': crate_goods_recipe,
    'shop_counter': shop_counter_recipe, 'shop_shelf': shop_shelf_recipe, 'sofa': sofa_recipe, 'fireplace': fireplace_recipe,
    'barrel': barrel_recipe, 'clinic_bed': clinic_bed_recipe, 'counter_white': counter_white_recipe,
    'fridge_drinks': fridge_drinks_recipe, 'haybale_stack': haybale_stack_recipe, 'lab_desk': lab_desk_recipe,
    'lab_machine': lab_machine_recipe, 'privacy_screen': privacy_screen_recipe,
    'wall_clock': wall_clock_recipe, 'wall_painting': wall_painting_recipe, 'wall_window': wall_window_recipe,
    'blackboard': blackboard_recipe,
    'campfire': campfire_recipe, 'lookout_tower': lookout_tower_recipe, 'tent': tent_recipe, 'mine_entrance': mine_entrance_recipe,
}
# loose things that may still turn and lean at random, as their pictures did; the rest stand square to the wall
TURN_FREE = ('plant_tall', 'sack', 'barrel', 'campfire')
# the showcase map's rows
ROWS = [('room-small', ['plant_tall', 'sack', 'crate_goods', 'barrel', 'privacy_screen', 'clinic_bed'], 3.0),
        ('room-big', ['bookshelf', 'shop_shelf', 'shop_counter', 'counter_white', 'sofa'], 3.6),
        ('room-tall', ['fireplace', 'fridge_drinks', 'lab_desk', 'lab_machine', 'haybale_stack'], 3.6),
        ('wall', ['wall_clock', 'wall_painting', 'wall_window', 'blackboard'], 3.6),
        ('outdoor', ['campfire', 'tent', 'mine_entrance', 'lookout_tower'], 6.5)]


def showcase(C):
    """test_props_rooms: each row this batch's models side by side (the wall pieces hang in the air there)"""
    rows = [(name, [(k, 0) for k in keys], None, gap) for name, keys, gap in ROWS]
    saved = B1.ROWS
    B1.ROWS = rows
    M = B1.test_map(C)
    B1.ROWS = saved
    M['name'] = 'Test: the rooms’ furniture and the run generator’s made things (phase 09 batch 11)'
    return M


def main():
    D = gamedata.load()
    C = D['scenery']['props']
    for key, fn in MADE.items():
        out = fn()
        model, effects = out if isinstance(out, tuple) else (out, None)
        M = C[key]
        M['model'] = B1.write_recipe(key, model)
        M['ppm'] = PPM
        if key not in TURN_FREE:
            M['vary'] = dict(FIXED)
        if effects is not None:
            M['fx'] = effects
        for f in ('build', 'layers', 'vol', 'volDepth'):
            M.pop(f, None)
    D['maps']['test_props_rooms'] = showcase(C)
    gamedata.save(D)
    print('made:', ', '.join(MADE))


if __name__ == '__main__':
    main()
