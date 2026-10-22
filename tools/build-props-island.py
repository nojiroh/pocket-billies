#!/usr/bin/env python3
"""Island track IS-4: the island's props in the low-poly 32 px/m style (phase 09), with phase 09 batch 11's barn folded
in. Copperleaf becomes an island seen from every side by an orbit camera, so every model here is finished all round.

  barn (swapped in under its key: the gambrel barn of its old picture, its five looks as colour swaps)
  pasture: fence_gate, water_trough, hay_round, hay_feeder       (beside fence_wood, fence_wood_post and haybale)
  beach: driftwood, beach_grass (flat on purpose), shells (a ground decal), shore_rocks, tidepool_rim
  cove: fishing_boat, net_rack                                   (beside rowboat, dock_post, buoy; the walkable dock is
                                                                  a map's `bridges` entry with pier: 1, as Copperleaf's)
  mountain: boulder_granite, cairn, summit_lookout, scree (swapped in: its four forms as models)
  forest floor: forest_litter (a ground decal), log_mossy and stump_mossy (swapped in)

A shape or colour of one thing is a variant of one prop (phase 09 task 4). Each new model gets a picture baked from it
(scene/next/island/<key>.png): the fallback when models are off and the far view. Swapped props keep their old picture.

    python3 tools/build-props-island.py      # rerunnable; writes the models, pictures, catalogue and test_props_island

Uses batch 1's parts (tools/build-props-batch1.py), batch 4's ring and batch 7's House kit for the barn.
"""
import importlib.util
import math
import sys
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
B3 = load('batch3', 'build-props-batch3.py')
B4 = load('batch4', 'build-props-batch4.py')
B7 = load('batch7', 'build-props-batch7.py')
PPM, A = B1.PPM, B1.AIR
box, limb, disc, sphere, cyl, r2 = B1.box, B1.limb, B1.disc, B1.sphere, B1.cyl, B1.r2
ring = B4.ring
S2 = math.sqrt(2)
PICS = B1.ART / 'scene' / 'next' / 'island'
INK = (42, 30, 52)
FIXED = {'rot': 0, 'lean': 0}
DRIFT, DRIFT_D = '#C9BBA6', '#A8977F'
GRANITE, GRANITE_D, WET = '#A7A2B0', '#878295', '#5E5868'
HAY, HAY_D = '#E0BC6A', '#C49A4C'
WATER = '#4E86A8'
SAIL = '#F2E8D0'


def rec(L, cel=0.7):
    return {'ppm': PPM, 'cel': cel, 'layers': sorted(L, key=lambda l: l['k'] == 'img')}


def stone(x, y, z, r, h, col=GRANITE, name='stone', ry=None, sides=7, rings=4, lump=0.3):
    S = {'k': 'sphere', 'x': r2(x), 'y': r2(y), 'z': r2(z), 'r': r2(r), 'h': r2(h), 'sides': sides, 'rings': rings,
         'lump': lump, 'facet': 1, 'col': col, 'tex': 'rock', 'name': name}
    if ry: S['ry'] = r2(ry)
    return S


def plank(a, b, t, col, name, tex='wood'):
    """A squared board or beam from a to b (a 4-sided limb), for anything that runs at a slant."""
    return limb(a, b, t, t, col, tex, name, 4)


# ================================================================ the barn
class Barn(B7.House):
    """The House kit with a gambrel roof (two slopes a side, the ridge running back), as the old barn picture."""

    def roof_parts(s):
        L, w, d = s.L, s.w, s.d
        hw, hd = w / 2 + s.over, d / 2 + s.over
        rz = s.top + 0.02
        k, h1, h2 = 0.56, 1.45, 0.95  # the knee (how far in the steep slope ends), the steep and the shallow rise
        L += [box(0, 0, rz - 0.04, 2 * hw, 2 * hd, 0.1, s.trim, 'wood', 'fascia')]
        L.append(cyl(0, 0, rz + 0.06, hw * S2, h1, s.roof, s.rtex, 'roof', 4, k='cone', ry=r2(hd * S2),
                     r1=r2(hw * k * S2), ry1=r2(hd * S2), rot=r2(math.pi / 4)) | {'roof': 1})
        L.append(cyl(0, 0, rz + 0.06 + h1, hw * k * S2, h2, s.roof, s.rtex, 'roof', 4, k='cone', ry=r2(hd * S2),
                     r1=0.02, ry1=r2(hd * S2), rot=r2(math.pi / 4)) | {'roof': 1})
        # the knee and the ridge as trim lines, front to back
        for sx in (-1, 1):
            L.append(limb((sx * hw * k, -hd - 0.02, rz + 0.08 + h1), (sx * hw * k, hd + 0.02, rz + 0.08 + h1), 0.05, 0.05, s.trim, 'wood', 'knee', 4))
        L.append(limb((0, -hd - 0.02, rz + 0.06 + h1 + h2), (0, hd + 0.02, rz + 0.06 + h1 + h2), 0.07, 0.07, '#3E4458', 'slate', 'ridge cap', 4))
        # the gable ends, front and back, just outside the roof's closed ends (as the kit's gableF), under its line
        a, b = hw - 0.22, hw * k - 0.16
        for sy in (-1, 1):
            y = sy * (hd + 0.035)
            L.append(cyl(0, y, rz, a * S2, h1, s.wall, s.wtex, 'gable', 4, k='cone', ry=r2(0.03 * S2), r1=r2(b * S2),
                         ry1=r2(0.03 * S2), rot=r2(math.pi / 4)))
            L.append(cyl(0, y, rz + h1, b * S2, h2 * b / (hw * k), s.wall, s.wtex, 'gable', 4, k='cone', ry=r2(0.03 * S2),
                         r1=0.02, ry1=r2(0.03 * S2), rot=r2(math.pi / 4)))
            # the bargeboards: white trim along the roof's edge
            pts = [(-hw, rz + 0.02), (-hw * k, rz + 0.08 + h1), (0, rz + 0.1 + h1 + h2), (hw * k, rz + 0.08 + h1), (hw, rz + 0.02)]
            yy = sy * (hd + 0.02)
            for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
                L.append(plank((x0, yy, z0), (x1, yy, z1), 0.06, s.trim, 'bargeboard'))
        s.rz, s.rh = rz + 0.06, h1 + h2
        s.ridge = s.rz + s.rh
        s.slope = ('x', hw)
        s.knee = (hw * k, rz + 0.06 + h1)


def barn_door(L, x, fy, dw, dh, col, trim, name='door'):
    """Two plank leaves with a white frame, each braced with a white X, a rail along the middle, the iron track
    above that they slide on, and two handles."""
    L += [box(x, fy - 0.03, 0.24, dw + 0.2, 0.06, dh + 0.12, trim, 'wood', name + ' frame'),
          box(x, fy - 0.06, 0.24, dw, 0.04, dh, col, 'battens', name)]
    for sx in (-1, 1):
        cx = x + sx * dw / 4
        x0, x1, z0, z1 = cx - dw / 4 + 0.07, cx + dw / 4 - 0.07, 0.3, 0.24 + dh - 0.06
        L += [plank((x0, fy - 0.09, z0), (x1, fy - 0.09, z1), 0.035, trim, name + ' brace'),
              plank((x1, fy - 0.09, z0), (x0, fy - 0.09, z1), 0.035, trim, name + ' brace'),
              box(cx, fy - 0.085, 0.24, dw / 2 - 0.02, 0.03, 0.07, trim, 'wood', name + ' rail'),
              box(cx, fy - 0.085, 0.24 + dh - 0.07, dw / 2 - 0.02, 0.03, 0.07, trim, 'wood', name + ' rail'),
              box(cx - sx * (dw / 4 - 0.04), fy - 0.085, 0.24, 0.07, 0.03, dh, trim, 'wood', name + ' stile'),
              sphere(x + sx * 0.12, fy - 0.12, 0.24 + dh * 0.45, 0.04, A['iron'], 'metal', name + ' handle', 6, 3)]
    L += [box(x, fy - 0.085, 0.24 + dh / 2 - 0.035, dw, 0.03, 0.07, trim, 'wood', name + ' middle rail'),
          box(x, fy - 0.03, 0.24 + dh + 0.12, dw * 2 + 0.3, 0.06, 0.06, A['iron'], 'metal', name + ' track'),
          box(x, fy - 0.03, 0.24 + dh + 0.18, dw * 2 + 0.3, 0.05, 0.04, '#5A6278', 'metal', name + ' track cover')]


def barn():
    """The ranch barn: red board walls under a grey slate gambrel roof with white trim; big braced sliding doors to the
    front, the hay loft door above them with its hoist beam and pulley, a lamp, a copper weather vane on the ridge;
    windows down both sides; a small door, a loft window and a lean-to woodpile behind (the camera sees every side
    on the island)."""
    H = Barn(5.2, 3.8, 1, 2.75, '#A8382E', 'battens', '#EAEEEC', '#545C70', 'slate', 'gableF', 40, over=0.3)
    L, fy, by = H.L, H.fy, H.d / 2
    gy = -(H.d / 2 + H.over) - 0.07  # the front gable's face (the roof's end), where the loft door is
    barn_door(L, 0, fy, 2.3, 2.35, '#7E2E34', H.trim)
    H.lamp(0, 2.95)
    # the loft door, open on its hay, and the hoist beam over it
    lz, lw = H.top + 0.35, 0.95
    L += [box(0, gy, lz, lw, 0.05, lw, '#4A2A26', 'plain', 'loft opening'),
          sphere(-0.15, gy - 0.02, lz - 0.02, 0.28, HAY, 'hay', 'loft hay', 8, 3, 0.3, 0.42),
          sphere(0.2, gy - 0.03, lz - 0.02, 0.24, HAY_D, 'hay', 'loft hay', 8, 3, 0.3, 0.36)]
    B3.frame_box(L, 0, gy - 0.02, lz, lw, lw, H.trim, 0.08, 0.06, 'loft frame')
    L += [box(-lw / 2 - 0.3, gy - 0.08, lz, 0.5, 0.04, lw, '#7E2E34', 'battens', 'loft door leaf'),
          box(0, gy - 0.4, lz + lw + 0.3, 0.14, 0.9, 0.14, A['dwood'], 'wood', 'hoist beam'),
          disc(0, gy - 0.75, lz + lw + 0.17, (1, 0, 0), 0.09, 0.05, A['iron'], 'metal', 'pulley', 10),
          limb((0.02, gy - 0.75, lz + lw + 0.09), (0.02, gy - 0.75, lz + 0.2), 0.012, 0.012, '#D6C08A', 'cloth', 'hoist rope', 4),
          cyl(0.02, gy - 0.75, lz + 0.05, 0.05, 0.15, A['iron'], 'metal', 'hoist hook', 6, k='cone', r1=0.01)]
    H.wins.append((0, lz + lw / 2))
    # the weather vane: a rod, the arrow and a little rooster, copper
    vz = H.ridge + 0.05
    L += [limb((0, fy + 0.3, vz), (0, fy + 0.3, vz + 0.75), 0.018, 0.015, A['iron'], 'metal', 'vane rod', 5),
          sphere(0, fy + 0.3, vz + 0.02, 0.07, A['copper'], 'metal', 'vane ball', 8, 4),
          plank((-0.32, fy + 0.3, vz + 0.55), (0.32, fy + 0.3, vz + 0.55), 0.018, A['copper'], 'vane arrow', 'metal'),
          cyl(0.34, fy + 0.3, vz + 0.5, 0.06, 0.1, A['copper'], 'metal', 'vane head', 4, k='cone', r1=0.01, rot=r2(math.pi / 4)),
          sphere(-0.04, fy + 0.3, vz + 0.63, 0.09, A['verd'], 'metal', 'vane rooster', 6, 3, h=0.16),
          cyl(0.06, fy + 0.3, vz + 0.74, 0.03, 0.08, '#D6403C', 'metal', 'vane comb', 5),
          cyl(-0.16, fy + 0.3, vz + 0.66, 0.06, 0.14, A['verd'], 'metal', 'vane tail', 4, k='cone', r1=0.01)]
    for sx in (-1, 1):  # x and y letters of the compass
        L.append(plank((sx * 0.22, fy + 0.3, vz + 0.35), (-sx * 0.22, fy + 0.3, vz + 0.35), 0.012, A['iron'], 'vane cross', 'metal'))
    # the sides: two crossed windows each, a downpipe at each front corner
    for sx in (-1, 1):
        for y in (-0.8, 0.8):
            x = sx * (H.w / 2 + 0.01)
            L += [box(x, y, 1.15, 0.03, 0.7, 0.75, B7.GLASS, 'plain', 'side window'),
                  box(x + sx * 0.02, y, 1.15, 0.03, 0.84, 0.06, H.trim, 'wood', 'side window frame'),
                  box(x + sx * 0.02, y, 1.84, 0.03, 0.84, 0.06, H.trim, 'wood', 'side window frame'),
                  box(x + sx * 0.02, y - 0.39, 1.15, 0.03, 0.06, 0.75, H.trim, 'wood', 'side window frame'),
                  box(x + sx * 0.02, y + 0.39, 1.15, 0.03, 0.06, 0.75, H.trim, 'wood', 'side window frame'),
                  box(x + sx * 0.03, y, 1.15, 0.03, 0.04, 0.75, H.trim, 'wood', 'mullion'),
                  box(x + sx * 0.03, y, 1.5, 0.03, 0.7, 0.04, H.trim, 'wood', 'mullion'),
                  box(x + sx * 0.06, y, 1.08, 0.12, 0.84, 0.05, H.trim, 'wood', 'sill')]
        L.append(limb((sx * (H.w / 2 + 0.05), fy - 0.05, 0.2), (sx * (H.w / 2 + 0.05), fy - 0.05, H.top), 0.035, 0.035, A['copper'], 'metal', 'downpipe', 6))
    # the back: a plain door, a loft window, the woodpile under a little lean-to
    L += [box(1.3, by + 0.03, 0.24, 0.95, 0.06, 1.95, H.trim, 'wood', 'back door frame'),
          box(1.3, by + 0.06, 0.24, 0.8, 0.04, 1.85, '#7E2E34', 'battens', 'back door'),
          plank((0.95, by + 0.09, 0.3), (1.65, by + 0.09, 2.0), 0.03, H.trim, 'back door brace'),
          box(1.3, by + 0.4, 0, 1.0, 0.5, 0.12, A['stone'], 'stone', 'back step'),
          box(0, -gy, H.top + 0.5, 0.7, 0.04, 0.6, B7.GLASS, 'plain', 'loft window')]
    B3.frame_box(L, 0, -gy + 0.03, H.top + 0.5, 0.7, 0.6, H.trim, 0.07, -0.06, 'loft window frame')
    H.wins.append((0, H.top + 0.8))
    wx = -1.25
    L += [box(wx, by + 0.45, 1.55, 1.9, 0.95, 0.06, '#545C70', 'slate', 'lean-to roof') | {'roof': 1},
          box(wx - 0.92, by + 0.82, 0, 0.08, 0.08, 1.55, A['dwood'], 'wood', 'lean-to post'),
          box(wx + 0.92, by + 0.82, 0, 0.08, 0.08, 1.55, A['dwood'], 'wood', 'lean-to post')]
    for row in range(4):
        for i in range(6 - (row % 2)):
            x = wx - 0.75 + i * 0.3 + (row % 2) * 0.15
            L.append(limb((x, by + 0.12, 0.13 + row * 0.24), (x, by + 0.78, 0.13 + row * 0.24), 0.12, 0.12, '#96684A', 'bark', 'log', 7))
            L.append(disc(x, by + 0.12, 0.13 + row * 0.24, (0, -1, 0), 0.105, 0.015, '#DBB27E', 'plain', 'log end', 7))
    # a hay bale and a pitchfork by the door, a trough of flowers on the other side
    L += [box(-1.95, fy - 0.45, 0, 0.9, 0.5, 0.48, HAY, 'hay', 'hay bale'),
          box(-1.95, fy - 0.705, 0.1, 0.9, 0.01, 0.03, HAY_D, 'plain', 'bale string'),
          box(-1.95, fy - 0.705, 0.34, 0.9, 0.01, 0.03, HAY_D, 'plain', 'bale string'),
          limb((-1.45, fy - 0.2, 0.0), (-1.3, fy - 0.12, 1.4), 0.025, 0.025, A['wood'], 'wood', 'fork handle', 5)]
    for j in (-1, 0, 1):
        L.append(limb((-1.3 + j * 0.05, fy - 0.12, 1.4), (-1.27 + j * 0.06, fy - 0.1, 1.68), 0.01, 0.006, A['iron'], 'metal', 'fork tine', 4))
    B3.flower_box(L, 1.95, fy - 0.2, 0.0, 0.9, 61)
    B3.path_stones(L, 0, fy, 3)
    return H


# ================================================================ the pasture
def fence_gate():
    """A field gate for the rail fence (fence_wood, 2.2 m a length): two stout posts with caps, a five-bar gate of
    planks between them with its diagonal brace, iron hinges and a latch."""
    w, d = 2.2, 0.25
    L = []
    for x in (-1.0, 1.0):
        L += [box(x, 0, 0, 0.17, 0.17, 1.18, A['wood'], 'wood', 'gate post'),
              cyl(x, 0, 1.18, 0.12, 0.1, A['wood'], 'wood', 'post cap', 4, k='cone', r1=0.02, rot=r2(math.pi / 4))]
    x0, x1, y = -0.88, 0.9, -0.03
    for i in range(5):
        z = 0.2 + i * 0.19
        L.append(box((x0 + x1) / 2, y, z, x1 - x0, 0.05, 0.08, A['plank'], 'wood', 'gate bar'))
    for x in (x0 + 0.04, 0.0, x1 - 0.04):
        L.append(box(x, y - 0.03, 0.18, 0.09, 0.05, 0.86, A['plank'] if x else A['wood'], 'wood', 'gate stile'))
    L += [plank((x0 + 0.1, y - 0.06, 0.24), (x1 - 0.1, y - 0.06, 0.98), 0.04, A['wood'], 'gate brace')]
    for z in (0.3, 0.92):
        L += [box(x0 - 0.02, y - 0.05, z, 0.18, 0.03, 0.05, A['iron'], 'metal', 'hinge'),
              cyl(-0.93, 0, z - 0.04, 0.025, 0.12, A['iron'], 'metal', 'hinge pin', 6)]
    L += [box(0.92, y - 0.06, 0.82, 0.16, 0.04, 0.05, A['iron'], 'metal', 'latch'),
          box(0.98, -0.1, 0.78, 0.05, 0.06, 0.13, A['iron'], 'metal', 'latch keep')]
    return rec(B1.shift_y(L, d / 2))


def water_trough():
    """A long wooden water trough on two trestle feet, iron bands round it, water in it, a little puddle and grass."""
    w, d, h = 1.7, 0.62, 0.52
    L = [box(0, 0, 0.12, w, d, h - 0.12, A['wood'], 'wood', 'trough'),
         box(0, 0, h - 0.04, w - 0.12, d - 0.12, 0.02, WATER, 'plain', 'water'),
         box(0, 0, h - 0.02, w + 0.04, d + 0.04, 0.04, A['dwood'], 'wood', 'rim')]
    for i, z in enumerate((0.16, 0.3)):
        L.append(box(0, -d / 2 - 0.01, z, w - 0.06, 0.02, 0.1, A['plank'] if i else '#D6A26C', 'wood', 'side plank'))
    for x in (-0.6, 0.6):
        L += [box(x, 0, h - 0.18, 0.06, d + 0.03, 0.06, A['iron'], 'metal', 'band'),
              box(x, 0, 0, 0.12, d + 0.16, 0.14, A['dwood'], 'wood', 'trestle foot')]
    L += [cyl(-0.9, -0.45, -0.02, 0.32, 0.03, '#6E96AE', 'plain', 'puddle', 10, ry=0.18)]
    for x, y in ((0.95, -0.25), (-0.95, 0.25), (0.7, 0.38)):
        L.append(sphere(x, y, 0, 0.13, B4.LEAF, 'leaves', 'tuft', 7, 3, 0.35, 0.18))
    return rec(L)


def hay_round():
    """A round bale lying on its side: hay rolled tight, its spiral on the ends, two bands of twine and loose wisps."""
    r, half = 0.62, 0.6
    L = [limb((-half, 0, r), (half, 0, r), r, r, HAY, 'hay', 'bale', 14),
         disc(-half, 0, r, (-1, 0, 0), r * 0.94, 0.02, HAY_D, 'hay', 'bale end', 14),
         disc(half, 0, r, (1, 0, 0), r * 0.94, 0.02, HAY_D, 'hay', 'bale end', 14)]
    for sx in (-1, 1):
        L.append(disc(sx * half, 0, r, (sx, 0, 0), r * 0.55, 0.03, HAY, 'hay', 'bale spiral', 12))
        L.append(disc(sx * half, 0, r, (sx, 0, 0), r * 0.2, 0.04, HAY_D, 'hay', 'bale spiral', 8))
    for x in (-0.3, 0.3):
        pts = [[r2(x), r2(math.cos(a) * (r + 0.01)), r2(r + math.sin(a) * (r + 0.01)), 0.01] for a in [2 * math.pi * i / 16 for i in range(17)]]
        L.append({'k': 'limb', 'pts': pts, 'sides': 5, 'col': '#C8A060', 'tex': 'cloth', 'name': 'twine'})
    for x, y in ((-0.7, -0.35), (0.5, -0.55), (0.75, 0.3)):
        L.append(sphere(x, y, 0, 0.12, HAY, 'hay', 'wisp', 6, 2, 0.4, 0.06))
    return rec(L)


def hay_feeder():
    """A hay rack for the pasture: a V of slats on four legs under a little plank roof, hay heaped in it, a trough
    board along the foot for what falls through."""
    w, d = 1.6, 0.9
    L = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            L.append(box(sx * (w / 2 - 0.05), sy * (d / 2 - 0.05), 0, 0.09, 0.09, 1.55, A['wood'], 'wood', 'leg'))
        L.append(plank((sx * (w / 2 - 0.05), -d / 2, 0.45), (sx * (w / 2 - 0.05), d / 2, 0.45), 0.04, A['dwood'], 'rail'))
    for sy in (-1, 1):
        for i in range(7):
            x = -w / 2 + 0.15 + i * (w - 0.3) / 6
            L.append(plank((x, sy * 0.06, 0.5), (x, sy * (d / 2 - 0.05), 1.15), 0.025, A['plank'], 'slat'))
        L += [plank((-w / 2, sy * (d / 2 - 0.05), 1.15), (w / 2, sy * (d / 2 - 0.05), 1.15), 0.035, A['wood'], 'top rail'),
              box(0, sy * (d / 2 + 0.05), 0.08, w, 0.18, 0.22, A['dwood'], 'wood', 'trough board')]
    L += [sphere(0, 0, 0.7, 0.55, HAY, 'hay', 'hay', 10, 4, 0.35, 0.65) | {'ry': 0.35},
          sphere(0.25, 0.05, 0.95, 0.35, HAY_D, 'hay', 'hay', 8, 3, 0.35, 0.4)]
    # the roof: two plank slopes on the legs
    for sy in (-1, 1):
        L.append(plank((-w / 2 - 0.15, sy * (d / 2 + 0.12), 1.5), (w / 2 + 0.15, sy * (d / 2 + 0.12), 1.5), 0.05, A['dwood'], 'roof edge'))
    L.append(B4.gable(0, 0, 1.55, w / 2 + 0.2, d / 2 + 0.2, 0.35, '#A06A42', 'wood', 'roof') | {'roof': 1})
    return rec(L)


# ================================================================ the beach
DRIFT_SHAPES = {
    # a branch: [(x, y, z, r), ...] along it; side twigs as (index on it, end x, end y, end z, r)
    'long': ([(-1.3, 0.05, 0.12, 0.13), (-0.5, -0.05, 0.14, 0.12), (0.4, 0.04, 0.12, 0.1), (1.25, -0.08, 0.09, 0.06)],
             [(1, -0.2, -0.45, 0.3, 0.04), (2, 0.75, 0.4, 0.28, 0.035)]),
    'root': ([(-0.75, 0.0, 0.22, 0.2), (0.0, 0.0, 0.17, 0.15), (0.8, 0.06, 0.1, 0.08)],
             [(0, -1.05, -0.35, 0.45, 0.06), (0, -1.0, 0.3, 0.55, 0.05), (0, -1.15, 0.0, 0.15, 0.06), (1, 0.2, 0.4, 0.05, 0.04)]),
    'sticks': ([(-0.6, -0.1, 0.06, 0.06), (0.65, 0.1, 0.06, 0.05)],
               [(0, 0.5, -0.35, 0.08, 0.05), (1, -0.4, 0.35, 0.07, 0.045)]),
}


def driftwood(shape):
    """Bleached driftwood on the sand: a sea-worn branch (or a root plate, or a few sticks), grey-white, smooth."""
    pts, twigs = DRIFT_SHAPES[shape]
    L = [{'k': 'limb', 'pts': [[r2(x), r2(y), r2(z), r2(r)] for x, y, z, r in pts], 'sides': 7, 'col': DRIFT, 'tex': 'grain', 'name': 'driftwood'}]
    for i, x, y, z, r in twigs:
        p = pts[i]
        L.append(limb(p[:3], (x, y, z), min(r * 1.6, p[3]), r * 0.5, DRIFT_D if i % 2 else DRIFT, 'grain', 'driftwood twig', 6))
    L.append(cyl(pts[0][0] - 0.02, pts[0][1], 0.0, pts[0][3] * 1.6, 0.03, '#E8D7B0', 'plain', 'sand drift', 8, ry=pts[0][3]))
    return rec(L, 0.75)


SHORE_SHAPES = {
    'a': [(-0.35, 0.0, 0.55, 0.62), (0.4, -0.1, 0.35, 0.4), (0.15, 0.35, 0.3, 0.32)],
    'b': [(0.0, 0.0, 0.7, 0.85), (0.75, -0.15, 0.28, 0.3)],
    'c': [(-0.6, 0.05, 0.36, 0.4), (0.0, -0.1, 0.42, 0.5), (0.6, 0.08, 0.3, 0.34), (0.25, 0.4, 0.22, 0.24)],
}


def shore_rocks(shape):
    """Rocks at the waterline: grey stones darkened where the sea wets them, a band of weed and a few barnacles and
    limpets."""
    rng = np.random.default_rng(len(shape) * 17 + ord(shape))
    L = []
    for i, (x, y, r, h) in enumerate(SHORE_SHAPES[shape]):
        L.append(stone(x, y, -h * 0.15, r, h, GRANITE if i % 2 else GRANITE_D, f'rock {i + 1}', ry=r * 0.85))
        L.append(stone(x, y, -0.05, r * 1.04, h * 0.32, WET, 'wet foot', ry=r * 0.9, rings=2, lump=0.2))
        L.append({'k': 'dome', 'x': r2(x), 'y': r2(y), 'z': 0.02, 'r': r2(r * 1.08), 'ry': r2(r * 0.94), 'h': 0.08, 'sides': 9,
                  'rings': 2, 'lump': 0.4, 'col': '#5E7A46', 'tex': 'leaves', 'name': 'weed'})
        for j in range(3):
            a = -math.pi / 2 + (rng.random() - 0.5) * 2.4
            k = 0.35 + rng.random() * 0.3
            L.append(sphere(x + math.cos(a) * r * 0.85, y + math.sin(a) * r * 0.75, h * k - h * 0.15, 0.04 + rng.random() * 0.02,
                            '#E6DED0' if j % 2 else '#C6B8A4', 'plain', 'barnacle', 5, 2, h=0.04))
    return rec(L, 0.8)


def tidepool_rim():
    """A tide pool's rim: a ring of low wet rocks round a disc of clear water, weed, a starfish and an anemone."""
    rng = np.random.default_rng(71)
    R = 0.85
    L = [cyl(0, 0, -0.02, R, 0.04, '#3E6E8C', 'plain', 'pool bed', 16, ry=R * 0.8),
         cyl(0, 0, 0.0, R * 0.92, 0.05, '#5E9EB8', 'plain', 'pool water', 16, ry=R * 0.72)]
    n = 9
    for i in range(n):
        a = 2 * math.pi * i / n + rng.random() * 0.3
        r = 0.2 + rng.random() * 0.12
        x, y = math.cos(a) * R, math.sin(a) * R * 0.8
        L.append(stone(x, y, -0.05, r, r * (1.1 + rng.random() * 0.5), WET if i % 3 else GRANITE_D, 'rim rock', ry=r * 0.8, sides=6, rings=3))
        if i % 3 == 0:
            L.append({'k': 'dome', 'x': r2(x * 0.9), 'y': r2(y * 0.9), 'z': 0.03, 'r': r2(r * 0.8), 'ry': r2(r * 0.6), 'h': 0.06,
                      'sides': 7, 'rings': 2, 'lump': 0.4, 'col': '#5E7A46', 'tex': 'leaves', 'name': 'weed'})
    for j in range(5):  # the starfish's arms
        a = j * 2 * math.pi / 5 + 0.3
        L.append(limb((0.25, -0.1, 0.06), (0.25 + math.cos(a) * 0.13, -0.1 + math.sin(a) * 0.13, 0.06), 0.035, 0.012, '#E8704A', 'plain', 'starfish', 5))
    L += [cyl(-0.3, 0.15, 0.03, 0.06, 0.08, '#C8506E', 'plain', 'anemone', 8),
          sphere(-0.3, 0.15, 0.09, 0.08, '#E07090', 'plain', 'anemone top', 8, 2, 0.4, 0.06)]
    return rec(L, 0.8)


# ================================================================ the cove
def fishing_boat():
    """A small fishing boat moored at the dock: a broad clinker hull in cream and copper with a teal top strake, a
    little wheelhouse with portholes and a verdigris roof, a short mast with a furled sail and a lamp, a net heaped on
    the stern, fenders on the side, a lobster pot."""
    hl, L = 2.15, []

    def strake(z, beam, t, col, name, side):
        pts = []
        for i in range(13):
            x = -hl + 2 * hl * i / 12
            k = x / hl
            kk = k if k > 0 else k * 0.8  # a fuller stern
            pts.append([r2(x * (1 - 0.05 * (z > 0.4))), r2(side * beam * max(0, 1 - kk * kk) ** 0.6), r2(z + 0.25 * max(0, -k) ** 3 * 0 + 0.3 * max(0, k) ** 3), t])
        return {'k': 'limb', 'pts': pts, 'sides': 6, 'col': col, 'tex': 'wood', 'name': name}

    for side in (-1, 1):
        for i, (z, beam, col) in enumerate(((0.12, 0.42, A['dwood']), (0.26, 0.66, A['copper']), (0.42, 0.8, A['cream']),
                                            (0.58, 0.88, A['cream']), (0.72, 0.9, A['verd']))):
            L.append(strake(z, beam, 0.09 if i < 4 else 0.06, col, 'top strake' if i == 4 else 'plank', side))
    L += [cyl(0, 0, 0.02, hl * 0.84, 0.16, A['dwood'], 'wood', 'keel', 16, ry=0.42),
          box(-0.1, 0, 0.18, 3.0, 1.2, 0.05, '#A06A42', 'wood', 'deck'),
          limb((hl + 0.02, 0, 0.12), (hl + 0.12, 0, 1.15), 0.06, 0.05, A['dwood'], 'wood', 'stem', 6),
          box(-hl + 0.06, 0, 0.12, 0.1, 1.0, 0.68, A['cream'], 'wood', 'transom'),
          box(-hl + 0.02, 0, 0.62, 0.12, 1.04, 0.08, A['verd'], 'wood', 'transom cap'),
          ring(hl + 0.1, 0, 0.9, 0.06, 0.014, A['brass'], 'metal', 'bow ring', 8)]
    # the wheelhouse, a little forward of the middle
    wx = 0.35
    L += [box(wx, 0, 0.2, 1.05, 0.95, 1.0, A['cream'], 'panels', 'wheelhouse'),
          box(wx, 0, 1.2, 1.25, 1.15, 0.08, A['verd'], 'metal', 'wheelhouse roof'),
          box(wx, 0, 1.28, 1.05, 0.95, 0.05, '#7EC8B0', 'metal', 'roof top'),
          box(wx + 0.53, 0, 0.75, 0.03, 0.7, 0.35, B7.GLASS, 'plain', 'front window')]
    B1.porthole(L, wx, -0.48, 0.85, (0, -1, 0), 0.14, 'porthole')
    B1.porthole(L, wx, 0.48, 0.85, (0, 1, 0), 0.14, 'porthole')
    L += [box(wx - 0.53, 0, 0.2, 0.03, 0.5, 0.85, A['dwood'], 'wood', 'wheelhouse door'),
          cyl(wx, 0.3, 1.33, 0.04, 0.35, A['iron'], 'metal', 'stove pipe', 6),
          cyl(wx, 0.3, 1.66, 0.07, 0.06, A['iron'], 'metal', 'pipe cap', 6, k='cone', r1=0.02)]
    # the mast with its furled sail and a lamp, aft of the wheelhouse
    mx = -0.6
    L += [limb((mx, 0, 0.2), (mx, 0, 3.1), 0.06, 0.04, A['wood'], 'wood', 'mast', 6),
          limb((mx, 0, 0.95), (mx - 1.3, 0, 1.05), 0.035, 0.03, A['wood'], 'wood', 'boom', 6),
          limb((mx - 0.05, 0, 1.0), (mx - 1.2, 0, 1.1), 0.09, 0.06, SAIL, 'cloth', 'furled sail', 7),
          limb((mx, 0, 3.05), (hl + 0.1, 0, 1.15), 0.008, 0.008, '#D6C08A', 'cloth', 'forestay', 4),
          limb((mx, 0, 3.05), (-hl + 0.05, 0, 0.7), 0.008, 0.008, '#D6C08A', 'cloth', 'backstay', 4),
          cyl(mx, -0.08, 2.45, 0.06, 0.12, A['brass'], 'metal', 'mast lamp', 6),
          cyl(mx, -0.08, 2.57, 0.08, 0.06, A['iron'], 'metal', 'lamp top', 6, k='cone', r1=0.02),
          box(mx, 0.0, 3.12, 0.02, 0.3, 0.16, '#D6403C', 'cloth', 'pennant')]
    # the net heaped on the stern, floats on it, a lobster pot
    L += [sphere(-1.55, 0.1, 0.2, 0.45, '#5E7A8A', 'cloth', 'net', 9, 3, 0.4, 0.4) | {'ry': 0.38}]
    for i, (x, y) in enumerate(((-1.75, -0.15), (-1.4, 0.3), (-1.6, 0.35), (-1.3, -0.1))):
        L.append(sphere(x, y, 0.45 + (i % 2) * 0.05, 0.06, '#F49A3A', 'plain', 'float', 6, 3))
    L += [box(1.35, 0.15, 0.2, 0.5, 0.42, 0.36, A['dwood'], 'wood', 'lobster pot'),
          {'k': 'dome', 'x': 1.35, 'y': 0.15, 'z': 0.56, 'r': 0.25, 'ry': 0.21, 'h': 0.18, 'sides': 8, 'rings': 2, 'col': A['wood'], 'tex': 'wood', 'name': 'pot hoops'}]
    for x in (-0.8, 0.9):  # fenders on the dock side and the far side
        for sy in (-1, 1):
            L.append(limb((x, sy * 0.9, 0.62), (x, sy * 0.93, 0.32), 0.07, 0.07, '#F4F0E8', 'plain', 'fender', 8))
    return rec(L, 0.7)


def net_rack():
    """A rack for drying nets: three poles with crossbars, a net hung over them in a sag, floats along its edge, a
    crate of floats and a coiled rope at the foot."""
    L, xs = [], (-1.2, 0.0, 1.2)
    for x in xs:
        L += [limb((x, 0, 0), (x, 0, 1.85), 0.05, 0.04, A['wood'], 'wood', 'pole', 6),
              limb((x, -0.28, 1.65), (x, 0.28, 1.65), 0.03, 0.03, A['wood'], 'wood', 'crossbar', 5)]
    for sy in (-1, 1):
        y = sy * 0.26
        top = [[r2(-1.25 + 2.5 * i / 8), r2(y), r2(1.66 - 0.06 * math.sin(math.pi * i / 4) ** 2), 0.02] for i in range(9)]
        L.append({'k': 'limb', 'pts': top, 'sides': 4, 'col': '#4E6A7A', 'tex': 'cloth', 'name': 'net edge'})
        for i in range(9):  # the net hangs in strands from the bar
            x = -1.15 + 2.3 * i / 8
            L.append(box(x, y, 0.55 + 0.1 * math.cos(i), 0.24, 0.02, 1.1 - 0.1 * math.cos(i), '#5E7A8A', 'cloth', 'net'))
            if i % 2 == 0:
                L.append(sphere(x, y + sy * 0.03, 0.5 + 0.1 * math.cos(i), 0.055, '#F49A3A', 'plain', 'float', 6, 3))
    L += [box(1.75, -0.2, 0, 0.6, 0.45, 0.35, A['dwood'], 'wood', 'crate')]
    for i in range(4):
        L.append(sphere(1.6 + (i % 2) * 0.28, -0.3 + (i // 2) * 0.2, 0.33, 0.08, '#F49A3A' if i % 2 else A['lamp'], 'plain', 'float', 6, 3))
    L += [ring(-1.75, -0.15, 0.04, 0.25, 0.04, '#D6C08A', 'cloth', 'rope coil', 12),
          ring(-1.75, -0.15, 0.1, 0.22, 0.04, '#C8B07A', 'cloth', 'rope coil', 12)]
    return rec(L)


# ================================================================ the mountain
GRANITE_SHAPES = {
    'a': [(0.0, 0.0, 0.95, 1.5, 0.85), (-0.95, -0.2, 0.32, 0.42, 1), (0.9, 0.1, 0.28, 0.36, 1)],
    'b': [(0.0, 0.0, 1.25, 1.1, 0.75), (1.1, 0.25, 0.55, 0.7, 0.9)],
    'c': [(-0.35, 0.05, 0.7, 1.9, 0.75), (0.55, -0.1, 0.55, 1.1, 0.85), (0.15, 0.55, 0.35, 0.5, 1)],
}


def boulder_granite(shape):
    """A mountain boulder: big faceted granite (a lump, a flat slab, a pair of tall stones), pale lichen and a little
    moss in the cracks, a few broken stones round its foot."""
    rng = np.random.default_rng(97 + ord(shape))
    L = []
    for i, (x, y, r, h, ry) in enumerate(GRANITE_SHAPES[shape]):
        L.append(stone(x, y, -0.12, r, h, GRANITE if i % 2 == 0 else GRANITE_D, f'boulder {i + 1}', ry=r * ry, sides=8, rings=5, lump=0.28))
        for j in range(3):
            a = (rng.random() - 0.5) * 3 - math.pi / 2
            k = 0.3 + rng.random() * 0.5
            rr = r * math.sqrt(1 - (2 * k - 1) ** 2) * 0.95
            L.append(sphere(x + math.cos(a) * rr, y + math.sin(a) * rr * ry, -0.12 + h * k, 0.07 + rng.random() * 0.05,
                            '#D8DCC0' if j % 2 else '#B8C890', 'leaves', 'lichen', 6, 2, h=0.05))
    for i in range(4):
        a = rng.random() * 6.28
        L.append(stone(math.cos(a) * 1.3, math.sin(a) * 0.7, -0.03, 0.1 + rng.random() * 0.08, 0.14, GRANITE_D, 'broken stone', sides=5, rings=2))
    return rec(L, 0.8)


SCREE_FORMS = {
    # (spread across, spread in depth, stones, biggest stone)
    '': (0.95, 0.45, 9, 0.2), 'small': (0.6, 0.35, 6, 0.14), 'pair': (1.15, 0.5, 12, 0.18),
    'row': (1.6, 0.35, 14, 0.17), 'big': (0.95, 0.55, 8, 0.3),
}


def scree(form):
    """Scree: loose broken stones lying in a spill, flat and angular, two greys."""
    sx, sy, n, big = SCREE_FORMS[form]
    rng = np.random.default_rng(301 + n)
    L = []
    for i in range(n):
        x, y = (rng.random() - 0.5) * 2 * sx, (rng.random() - 0.5) * 2 * sy
        r = big * (0.45 + 0.55 * rng.random()) * (1 - 0.4 * abs(x) / sx)
        L.append(stone(x, y, -0.04, r, r * (0.7 + rng.random() * 0.5), '#8E7F88' if i % 3 else '#A39AA8', 'scree stone',
                       ry=r * (0.6 + rng.random() * 0.3), sides=5, rings=2, lump=0.3))
    return rec(L, 0.8)


def cairn():
    """A trail cairn: flat stones stacked smaller toward the top on a base of rough ones, a tuft of grass at its foot."""
    rng = np.random.default_rng(13)
    L = []
    for i in range(5):
        a = i * 1.26
        L.append(stone(math.cos(a) * 0.38, math.sin(a) * 0.3, -0.04, 0.22, 0.26, GRANITE_D, 'base stone', sides=6, rings=3))
    z = 0.12
    for i, (r, h) in enumerate(((0.42, 0.2), (0.36, 0.18), (0.3, 0.18), (0.24, 0.16), (0.18, 0.14), (0.12, 0.14))):
        ox, oy = (rng.random() - 0.5) * 0.06, (rng.random() - 0.5) * 0.05
        L.append(stone(ox, oy, z, r, h, GRANITE if i % 2 else '#B4AEBA', 'cairn stone', ry=r * 0.85, sides=7, rings=3, lump=0.18))
        z += h * 0.82
    L.append(sphere(0.45, -0.25, 0, 0.12, '#7E9E52', 'leaves', 'tuft', 7, 3, 0.35, 0.16))
    return rec(L, 0.8)


def summit_lookout():
    """The summit lookout: a round platform of stone flags on a low dry-stone wall, a stone step up, an iron rail
    round it, a brass viewing scope on a post facing out, a flag on a pole and a bench."""
    R = 1.9
    L = [cyl(0, 0, 0, R + 0.08, 0.15, GRANITE_D, 'stone', 'wall foot', 18),
         cyl(0, 0, 0.1, R, 0.42, '#A8A2B2', 'stone', 'platform wall', 18),
         cyl(0, 0, 0.52, R + 0.05, 0.06, '#C8C4D4', 'stone', 'platform flags', 18)]
    for i, (w_, d_) in enumerate(((1.1, 0.6), (0.9, 0.35))):
        L.append(box(0, -R - d_ / 2 + 0.05, i * 0.2, w_, d_, 0.2, '#BDB9C6', 'stone', 'step'))
    n = 14
    for i in range(n):
        a = 2 * math.pi * i / n
        if abs(a - 3 * math.pi / 2) < 0.3: continue  # the gap at the step
        L.append(limb((math.cos(a) * (R - 0.08), math.sin(a) * (R - 0.08), 0.58), (math.cos(a) * (R - 0.08), math.sin(a) * (R - 0.08), 1.5),
                      0.028, 0.025, A['iron'], 'metal', 'rail post', 5))
    for z, t in ((1.5, 0.035), (1.05, 0.022)):
        pts = []
        for i in range(n + 1):
            a = 3 * math.pi / 2 + 0.36 + (2 * math.pi - 0.72) * i / n
            pts.append([r2(math.cos(a) * (R - 0.08)), r2(math.sin(a) * (R - 0.08)), z, t])
        L.append({'k': 'limb', 'pts': pts, 'sides': 5, 'col': A['iron'] if t < 0.03 else A['copper'], 'tex': 'metal', 'name': 'rail'})
    # the scope, looking out (toward the back: the camera stands out at sea, the sea is behind the summit)
    L += [cyl(0.6, 0.9, 0.58, 0.07, 0.95, A['iron'], 'metal', 'scope post', 8),
          sphere(0.6, 0.9, 1.5, 0.08, A['brass'], 'metal', 'scope joint', 8, 4),
          limb((0.6, 0.7, 1.52), (0.6, 1.25, 1.66), 0.07, 0.11, A['brass'], 'metal', 'scope', 10),
          disc(0.6, 1.25, 1.66, (0, 1, 0.25), 0.1, 0.02, B7.GLASS, 'plain', 'scope glass', 10),
          limb((0.6, 0.66, 1.51), (0.6, 0.58, 1.49), 0.04, 0.04, '#3A3442', 'plain', 'eyepiece', 8)]
    # the flag pole and the bench
    L += [limb((-1.2, 0.6, 0.58), (-1.2, 0.6, 3.6), 0.05, 0.035, '#E8E4DA', 'metal', 'flag pole', 6),
          sphere(-1.2, 0.6, 3.6, 0.07, A['brass'], 'metal', 'pole finial', 8, 4),
          box(-0.75, 0.62, 3.0, 0.85, 0.03, 0.52, A['verd'], 'cloth', 'flag'),
          box(-0.75, 0.6, 3.17, 0.85, 0.035, 0.17, A['lamp'], 'cloth', 'flag stripe')]
    L += [box(0.0, 1.05, 0.98, 1.3, 0.38, 0.06, A['plank'], 'wood', 'bench seat'),
          box(-0.5, 1.05, 0.58, 0.12, 0.34, 0.4, A['stone'], 'stone', 'bench leg'),
          box(0.5, 1.05, 0.58, 0.12, 0.34, 0.4, A['stone'], 'stone', 'bench leg')]
    for a in (0.4, 2.3, 4.0):
        L.append(sphere(math.cos(a) * (R + 0.2), math.sin(a) * (R + 0.15), 0, 0.15, '#7E9E52', 'leaves', 'tuft', 7, 3, 0.35, 0.18))
    return rec(L, 0.75)


# ================================================================ the forest floor
def log_mossy():
    """A mossy log rotting into the forest floor: moss along its back, a broken end, a bracket fungus, ferns at it."""
    B2 = load('batch2', 'build-props-batch2.py')
    L = B2.log_layers(-1.05, 1.05, 0.3, 0.3, name='log')
    L.append({'k': 'dome', 'x': 0.0, 'y': 0.02, 'z': 0.42, 'r': 1.05, 'ry': 0.24, 'h': 0.18, 'sides': 12, 'rings': 3, 'lump': 0.35,
              'col': '#76AA50', 'tex': 'leaves', 'name': 'moss back'})
    for x, z in ((-0.4, 0.38), (0.15, 0.3)):
        L.append({'k': 'dome', 'x': x, 'y': -0.31, 'z': z, 'r': 0.14, 'ry': 0.08, 'h': 0.05, 'sides': 8, 'rings': 2,
                  'col': '#D6A060' if x < 0 else '#E8C080', 'tex': 'plain', 'name': 'bracket fungus'})
    for x in (-1.15, 0.9):
        L.append(sphere(x, -0.2, 0, 0.18, '#5E9A48', 'leaves', 'fern', 7, 3, 0.4, 0.3))
    return rec(B1.shift_y(L, 0.25))


def stump_mossy():
    """A mossy stump: bark, old rings, a cap of moss half over its top, roots, toadstools at its foot."""
    BARK = '#8A604A'
    L = [cyl(0, 0, 0, 0.36, 0.55, BARK, 'bark', 'stump', 12),
         cyl(0, 0, 0.55, 0.34, 0.02, '#C8A070', 'rings', 'rings', 12),
         {'k': 'dome', 'x': -0.08, 'y': 0.05, 'z': 0.5, 'r': 0.3, 'ry': 0.28, 'h': 0.12, 'sides': 10, 'rings': 3, 'lump': 0.35,
          'col': '#76AA50', 'tex': 'leaves', 'name': 'moss cap'}]
    for i in range(4):
        a = i * math.pi / 2 + 0.4
        L.append(limb((math.cos(a) * 0.2, math.sin(a) * 0.2, 0.2), (math.cos(a) * 0.58, math.sin(a) * 0.58, -0.04), 0.13, 0.05, BARK, 'bark', 'root', 6))
    L += [sphere(-0.3, -0.25, 0.1, 0.14, '#86B45A', 'leaves', 'moss', 7, 3, 0.35, h=0.16),
          cyl(0.35, -0.32, 0, 0.02, 0.1, '#F4F0E8', 'plain', 'toadstool stem', 6),
          cyl(0.35, -0.32, 0.09, 0.06, 0.04, '#D6704A', 'plain', 'toadstool cap', 8, k='dome'),
          cyl(0.45, -0.24, 0, 0.018, 0.07, '#F4F0E8', 'plain', 'toadstool stem', 6),
          cyl(0.45, -0.24, 0.06, 0.045, 0.03, '#D6704A', 'plain', 'toadstool cap', 8, k='dome')]
    return rec(L)


# ================================================================ flat on purpose: beach grass, shells, forest litter
def pixel(a, x, y, c):
    if 0 <= y < a.shape[0] and 0 <= x < a.shape[1]: a[y, x] = (*c, 255)


def outline(a):
    """A dark rim round what's drawn (the pixel art's outline), where an empty pixel touches a drawn one."""
    m = a[..., 3] > 0
    e = np.zeros_like(m)
    e[1:] |= m[:-1]; e[:-1] |= m[1:]; e[:, 1:] |= m[:, :-1]; e[:, :-1] |= m[:, 1:]
    e &= ~m
    a[e] = (*INK, 255)
    return a


def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def beach_grass_picture(form):
    """Marram grass: long thin blades arching out from a sandy foot, pale sea-green with straw tips."""
    W, H, n, tall = {'': (30, 34, 11, 30), 'tuft': (22, 22, 7, 18), 'clump': (40, 36, 16, 31), 'windswept': (34, 30, 10, 26)}[form]
    rng = np.random.default_rng(len(form) * 13 + 5)
    a = np.zeros((H, W, 4), np.uint8)
    cols = [hexrgb(c) for c in ('#7E9A5E', '#98B070', '#B4C484', '#6E8452')]
    tip = hexrgb('#E2D49A')
    lean = 0.55 if form == 'windswept' else 0
    for i in range(n):
        x0 = W / 2 + (rng.random() - 0.5) * W * 0.35
        h = tall * (0.55 + 0.45 * rng.random())
        bend = (rng.random() - 0.5) * 1.1 + lean
        c = cols[i % len(cols)]
        steps = int(h)
        for s in range(steps):
            k = s / h
            x = int(round(x0 + bend * h * k * k))
            y = H - 2 - s
            pixel(a, x, y, tip if k > 0.82 else c)
            if k < 0.3: pixel(a, x + 1, y, c)
    for i in range(int(W * 0.5)):  # the sand at its foot
        pixel(a, int(W / 2 + (rng.random() - 0.5) * W * 0.55), H - 1 - int(rng.random() * 2), hexrgb('#E8D7B0'))
    return outline(a)


def shells_picture(form):
    """Shells lying on the sand (seen from above, as a ground decal): cockles, a spiral, a scallop, pebbles."""
    W, H, n = {'': (24, 12, 5), 'few': (16, 9, 3), 'scatter': (34, 16, 8)}[form]
    rng = np.random.default_rng(len(form) * 7 + 11)
    a = np.zeros((H, W, 4), np.uint8)
    kinds = [('#F6E4D4', '#E0B8A0'), ('#F4D0B8', '#D69A80'), ('#FFF2E4', '#C8B4A8'), ('#E8A88C', '#C47A64')]
    for i in range(n):
        cx, cy = 3 + rng.random() * (W - 6), 2 + rng.random() * (H - 4)
        c, d = (hexrgb(v) for v in kinds[i % len(kinds)])
        r = 1.6 + rng.random() * 1.2
        for y in range(int(cy - r) - 1, int(cy + r) + 2):
            for x in range(int(cx - r) - 1, int(cx + r) + 2):
                dx, dy = (x - cx) / r, (y - cy) / (r * 0.75)
                if dx * dx + dy * dy <= 1:
                    pixel(a, x, y, d if (x + (i % 2)) % 2 == 0 and dy > -0.3 else c)
    return outline(a)


def litter_picture(form):
    """The forest floor's litter (a ground decal): twigs, a pine cone or two, brown and yellow leaves."""
    W, H, n = {'': (28, 14, 9), 'twigs': (30, 12, 5), 'cones': (20, 12, 6)}[form]
    rng = np.random.default_rng(len(form) * 5 + 23)
    a = np.zeros((H, W, 4), np.uint8)
    twig, cone = hexrgb('#7A5238'), hexrgb('#94603E')
    leaves = [hexrgb(c) for c in ('#C08A3E', '#D6A84A', '#9A6A3A', '#7E9E52')]
    for i in range(n):
        x0, y0 = rng.random() * W, rng.random() * H
        kind = ('twig', 'leaf', 'leaf', 'cone')[i % 4] if form == '' else ('twig' if form == 'twigs' and i % 3 else 'cone' if form == 'cones' and i % 2 else 'leaf')
        if kind == 'twig':
            ln, ang = 6 + rng.random() * 8, rng.random() * math.pi
            for s in range(int(ln)):
                pixel(a, int(x0 + math.cos(ang) * s), int(y0 + math.sin(ang) * s * 0.5), twig)
        elif kind == 'cone':
            for dy in range(3):
                for dx in range(2):
                    pixel(a, int(x0) + dx, int(y0) + dy, cone if (dx + dy) % 2 else hexrgb('#B07A4E'))
        else:
            c = leaves[i % len(leaves)]
            for dy in range(2):
                for dx in range(3 - dy):
                    pixel(a, int(x0) + dx, int(y0) + dy, c)
    return outline(a)


def save_pic(arr, name):
    return B1.save_png(arr, PICS / f'{name}.png')


# ================================================================ a model's picture (the fallback and the far view)
def mesh(L):
    """The model's parts as triangles [(p0, p1, p2, colour)], metres (x across, y back, z up), close to how
    prop-models.js turns them (rocks without their lumps)."""
    T = []

    def quad(a, b, c, d, col):
        T.append((a, b, c, col)); T.append((a, c, d, col))

    for l in L:
        k, col = l['k'], l.get('col', '#888888')
        if k == 'img' or l.get('hide'): continue
        if k == 'box':
            x0, x1 = l['x'] - l['w'] / 2, l['x'] + l['w'] / 2
            y0, y1 = l['y'] - l['d'] / 2, l['y'] + l['d'] / 2
            z0, z1 = max(0, l['z']), l['z'] + l['h']
            if z1 <= z0: continue
            P = [(x, y, z) for z in (z0, z1) for y in (y0, y1) for x in (x0, x1)]
            for f in ((0, 1, 3, 2), (4, 5, 7, 6), (0, 1, 5, 4), (2, 3, 7, 6), (0, 2, 6, 4), (1, 3, 7, 5)):
                quad(*(P[i] for i in f), col)
        elif k == 'limb':
            pts = l.get('pts') or [[l['x'], l['y'], l['z'], l['r']], [l['x2'], l['y2'], l['z2'], l.get('r1', l['r'])]]
            n = l.get('sides') or 6
            for p, q in zip(pts, pts[1:]):
                d = np.array(q[:3], float) - np.array(p[:3], float)
                ln = np.linalg.norm(d)
                if ln < 1e-6: continue
                d /= ln
                u = np.cross(d, [0, 0, 1] if abs(d[2]) < 0.9 else [1, 0, 0]); u /= np.linalg.norm(u)
                v = np.cross(d, u)
                R0 = [np.array(p[:3]) + p[3] * (math.cos(2 * math.pi * j / n) * u + math.sin(2 * math.pi * j / n) * v) for j in range(n)]
                R1 = [np.array(q[:3]) + q[3] * (math.cos(2 * math.pi * j / n) * u + math.sin(2 * math.pi * j / n) * v) for j in range(n)]
                for j in range(n):
                    quad(R0[j], R0[(j + 1) % n], R1[(j + 1) % n], R1[j], col)
                for j in range(1, n - 1):
                    T.append((R0[0], R0[j], R0[j + 1], col)); T.append((R1[0], R1[j], R1[j + 1], col))
        else:
            r = max(l.get('r', 0.1), 0.01)
            ry = max(l.get('ry', r), 0.01)
            h = l.get('h', 2 * r)
            if k == 'cyl': R = [(0, 1), (1, 1)]
            elif k == 'cone': R = [(0, 1), (1, (l.get('r1') or 0) / r)]
            elif k == 'barrel':
                bu = l.get('bulge', 0.15)
                R = [(i / 6, 1 - bu + bu * math.sin(i / 6 * math.pi) * 2 - bu) for i in range(7)]
            elif k == 'dome':
                nb = max(2, min(12, l.get('rings', 5)))
                R = [(math.sin(math.pi / 2 * i / nb), math.cos(math.pi / 2 * i / nb)) for i in range(nb + 1)]
            else:
                nb = max(2, min(16, l.get('rings', 8)))
                R = [((1 - math.cos(math.pi * i / nb)) / 2,) for i in range(nb + 1)]
                R = [(kk, math.sqrt(max(0, 1 - (2 * kk - 1) ** 2))) for (kk,) in R]
            n = l.get('sides') or 12
            rot = l.get('rot', 0)
            G = []
            for kk, f in R:
                z = max(0, l['z'] + kk * h)
                fy = 1 - kk + kk * l['ry1'] / ry if k == 'cone' and l.get('ry1') is not None else f
                G.append([(l['x'] + math.cos(2 * math.pi * j / n + rot) * r * f, l['y'] + math.sin(2 * math.pi * j / n + rot) * ry * fy, z) for j in range(n)])
            for i in range(len(G) - 1):
                for j in range(n):
                    quad(G[i][j], G[i][(j + 1) % n], G[i + 1][(j + 1) % n], G[i + 1][j], col)
            for ringp in (G[0], G[-1]):
                for j in range(1, n - 1):
                    T.append((ringp[0], ringp[j], ringp[j + 1], col))
    return T


TILT = 0.5  # how much of the depth shows as height in the picture: the camera looks down at about 30 degrees
LIGHT = np.array([-0.45, -0.55, 0.7]) / np.linalg.norm([-0.45, -0.55, 0.7])


def bake(recipe, name):
    """The model drawn as a picture: seen from the front and a little above, cel-lit in three tones from the upper
    left, outlined; returns (path, ox, oy) with the base point at (-ox, -oy)."""
    T = mesh(recipe['layers'])
    if not T: return None
    P = np.array([[p for p in t[:3]] for t in T], float)  # (n, 3, 3)
    sx = P[..., 0]
    sy = P[..., 2] + P[..., 1] * TILT  # up in the picture
    x0, x1, y0, y1 = sx.min(), sx.max(), sy.min(), sy.max()
    W, H = int(math.ceil((x1 - x0) * PPM)) + 4, int(math.ceil((y1 - y0) * PPM)) + 4
    col = np.zeros((H, W, 3)); dep = np.full((H, W), np.inf); hit = np.zeros((H, W), bool)
    X = (sx - x0) * PPM + 2
    Y = (y1 - sy) * PPM + 2
    for i, t in enumerate(T):
        a, b, c = P[i]
        nrm = np.cross(b - a, c - a)
        ln = np.linalg.norm(nrm)
        if ln < 1e-9: continue
        nrm /= ln
        if np.dot(nrm, [0, -1, TILT]) < 0: nrm = -nrm  # the side that faces the viewer (two-sided here)
        lit = float(np.dot(nrm, LIGHT))
        tone = 1.12 if lit > 0.55 else 0.92 if lit > 0.1 else 0.7
        rgb = np.array(hexrgb(t[3]), float) * tone
        xs, ys = X[i], Y[i]
        bx0, bx1 = int(max(0, math.floor(xs.min()))), int(min(W - 1, math.ceil(xs.max())))
        by0, by1 = int(max(0, math.floor(ys.min()))), int(min(H - 1, math.ceil(ys.max())))
        if bx1 < bx0 or by1 < by0: continue
        gx, gy = np.meshgrid(np.arange(bx0, bx1 + 1) + 0.5, np.arange(by0, by1 + 1) + 0.5)
        d = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if abs(d) < 1e-9: continue
        w0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / d
        w1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / d
        w2 = 1 - w0 - w1
        m = (w0 >= -0.01) & (w1 >= -0.01) & (w2 >= -0.01)
        if not m.any(): continue
        depth = w0 * a[1] + w1 * b[1] + w2 * c[1]  # nearer is smaller y along the view line
        sub = dep[by0:by1 + 1, bx0:bx1 + 1]
        m &= depth < sub
        sub[m] = depth[m]
        col[by0:by1 + 1, bx0:bx1 + 1][m] = rgb
        hit[by0:by1 + 1, bx0:bx1 + 1] |= m
    a = np.zeros((H, W, 4), np.uint8)
    a[..., :3] = np.clip(col, 0, 255).astype(np.uint8)
    a[..., 3] = hit * 255
    outline(a)
    path = save_pic(a, name)
    return path, -int(round((0 - x0) * PPM + 2)), -int(round((y1 - 0) * PPM + 2))


# ================================================================ the catalogue
def new_prop(key, name, recipe, group=None, shadow=0.5, tags=('island',), solid=None, box_=None, vary=FIXED, **kw):
    path, ox, oy = bake(recipe, key)
    M = {'name': name, 'img': path, 'ox': ox, 'oy': oy, 'shadow': shadow, 'sway': 0, 'flat': 0, 'tags': list(tags),
         'group': group or key, 'model': B1.write_recipe(key, recipe), 'ppm': PPM, 'vary': dict(vary)}
    if solid is not None: M['solid'] = solid
    if box_: M['box'] = list(box_)
    M.update(kw)
    return M


def model_variant(key, label, recipe, extra=None):
    path, ox, oy = bake(recipe, key)
    V = {'img': path, 'ox': ox, 'oy': oy, 'model': B1.write_recipe(key, recipe), 'name': label}
    if extra: V.update(extra)
    return V


def flat_prop(key, name, pics, flat, sway, tags, group=None, shadow=0):
    """A drawn prop: pics is [(form, label, picture array, weight, span)], the first the base."""
    out = []
    for form, label, arr, weight, span in pics:
        h, w = arr.shape[:2]
        out.append((form, label, save_pic(arr, f'{key}_{form}' if form else key), -(w // 2), -(h - 1), weight, span))
    form, label, path, ox, oy, _, _ = out[0]
    M = {'name': name, 'img': path, 'ox': ox, 'oy': oy, 'shadow': shadow, 'sway': sway, 'flat': flat, 'tags': list(tags),
         'group': group or key, 'solid': 0, 'ppm': PPM, 'vary': {'size': 0}}
    M['variants'] = [{'img': p, 'ox': x, 'oy': y, 'form': f, 'weight': wt, 'span': sp, 'name': lb}
                     for f, lb, p, x, y, wt, sp in out[1:]]
    return M


def make_barn(C):
    """The barn swapped in under its key (batch 7's way for the town's buildings): its model, its door at the big
    doors, its lights; its old looks as colour swaps; its room, footprint, name and tags kept."""
    M = C['barn']
    B = M.get('build')
    H = barn()
    M['model'] = B1.write_recipe('barn', H.done(0.62))
    M['fx'] = H.fx()
    M['ppm'] = PPM
    M['door'] = {'x': 0, 'y': 0}
    M['box'] = [5.5, 4.1]
    # the town looks: the old wall, roof and trim colours swapped into the model's (barn_v1..v5 keep their pictures)
    base = {'wallCol': '#A8382E', 'roofCol': '#545C70', 'trimCol': '#EAEEEC'}
    if B is None: return  # swapped in already (a rerun): its looks are swaps now
    vs = []
    for V in B.get('variants') or []:
        sw = {base[f]: V[f] for f in base if V.get(f) and V[f] != base[f]}
        if V.get('wallCol') and V['wallCol'] != base['wallCol']:
            sw['#7E2E34'] = V.get('trimCol', '#7E2E34')  # the doors take the look's trim colour
        vs.append({k: v for k, v in (('img', V.get('img')), ('swap', sw)) if v})
    if vs: M['variants'] = vs
    M['vary'] = {'rot': 0, 'lean': 0, 'size': 0}
    for f in ('build', 'layers', 'vol', 'volDepth'):
        M.pop(f, None)


def swap_scree(C):
    """Scree as models: the base and each form its own spill of stones; the old pictures stay as their fallbacks."""
    M = C['scree']
    M['model'] = B1.write_recipe('scree', scree(''))
    for V in M.get('variants') or []:
        V['model'] = B1.write_recipe(f"scree_{V['form']}", scree(V['form']))
    M['ppm'] = PPM


def swap_forest(C):
    for key, fn in (('log_mossy', log_mossy), ('stump_mossy', stump_mossy)):
        C[key]['model'] = B1.write_recipe(key, fn())
        C[key]['ppm'] = PPM
        C[key]['vary'] = dict(FIXED)


def add_new(C):
    C['fence_gate'] = new_prop('fence_gate', 'Field gate', fence_gate(), shadow=0.35, tags=('island', 'farm'), box_=(2.2, 0.25))
    C['water_trough'] = new_prop('water_trough', 'Water trough', water_trough(), shadow=0.6, tags=('island', 'farm'), solid=0.8)
    C['hay_round'] = new_prop('hay_round', 'Round hay bale', hay_round(), shadow=0.8, tags=('island', 'farm'), solid=0.7)
    C['hay_feeder'] = new_prop('hay_feeder', 'Hay rack', hay_feeder(), shadow=0.8, tags=('island', 'farm'), solid=0.85)
    C['driftwood'] = new_prop('driftwood', 'Driftwood', driftwood('long'), shadow=0.3, tags=('island', 'beach'), solid=0, variants=[
        model_variant('driftwood_root', 'Driftwood (root)', driftwood('root')),
        model_variant('driftwood_sticks', 'Driftwood (sticks)', driftwood('sticks'))], vary={'rot': 1, 'lean': 0})
    C['shore_rocks'] = new_prop('shore_rocks', 'Shore rocks', shore_rocks('a'), shadow=0.6, tags=('island', 'beach'), solid=0.7, variants=[
        model_variant('shore_rocks_b', 'Shore rocks (big)', shore_rocks('b')),
        model_variant('shore_rocks_c', 'Shore rocks (row)', shore_rocks('c'))], vary={'rot': 1, 'lean': 0})
    C['tidepool_rim'] = new_prop('tidepool_rim', 'Tide pool', tidepool_rim(), shadow=0.2, tags=('island', 'beach'), solid=0)
    C['fishing_boat'] = new_prop('fishing_boat', 'Fishing boat', fishing_boat(), shadow=0.8, tags=('island', 'water'), solid=1.4, bob=0.09)
    C['net_rack'] = new_prop('net_rack', 'Net rack', net_rack(), shadow=0.6, tags=('island', 'beach'), solid=0.6)
    C['boulder_granite'] = new_prop('boulder_granite', 'Granite boulder', boulder_granite('a'), group='boulder', shadow=1, tags=('island', 'mountain'),
                                    solid=1.1, variants=[model_variant('boulder_granite_b', 'Granite boulder (slab)', boulder_granite('b')),
                                                         model_variant('boulder_granite_c', 'Granite boulder (pair)', boulder_granite('c'))], vary={'rot': 1, 'lean': 0})
    C['cairn'] = new_prop('cairn', 'Cairn', cairn(), shadow=0.4, tags=('island', 'mountain'), solid=0.45)
    C['summit_lookout'] = new_prop('summit_lookout', 'Summit lookout', summit_lookout(), shadow=1.6, tags=('island', 'mountain'), solid=2.0, landmark=1)
    C['beach_grass'] = flat_prop('beach_grass', 'Beach grass', [
        ('', 'Beach grass', beach_grass_picture(''), 1, 1.0), ('tuft', 'Beach grass (tuft)', beach_grass_picture('tuft'), 1, 0.7),
        ('clump', 'Beach grass (clump)', beach_grass_picture('clump'), 0.8, 1.3),
        ('windswept', 'Beach grass (windswept)', beach_grass_picture('windswept'), 0.6, 1.1)], 0, 1, ('island', 'beach'), shadow=0.2)
    C['shells'] = flat_prop('shells', 'Shells', [
        ('', 'Shells', shells_picture(''), 1, 0.75), ('few', 'Shells (a few)', shells_picture('few'), 1, 0.5),
        ('scatter', 'Shells (scatter)', shells_picture('scatter'), 0.6, 1.05)], 1, 0, ('island', 'beach'))
    C['forest_litter'] = flat_prop('forest_litter', 'Forest litter', [
        ('', 'Forest litter', litter_picture(''), 1, 0.9), ('twigs', 'Forest litter (twigs)', litter_picture('twigs'), 1, 0.95),
        ('cones', 'Forest litter (cones)', litter_picture('cones'), 0.8, 0.62)], 1, 0, ('island', 'forest'))


# ================================================================ the showcase map
def showcase():
    """test_props_island: the sea and a pier to the south (the front), the beach, the barn and its paddock, a corner
    of mountain rock to the north-east and of forest floor to the north-west."""
    W, H = 64, 58
    def letter(x, z):
        if z < 3: return 'd'
        if z < 7: return 'w'
        if z < 8.5: return 'S'
        if z < 13: return 's'
        if x >= 40 and z >= 32: return 'r' if (x + z) % 7 else 'P'
        if x < 36 and z >= 34: return 'y' if (x * 3 + z) % 5 else 'L'
        if 6 <= x < 27 and 16 <= z < 29: return 'G'
        if 13 <= z < 15 or (30 <= x < 32 and z < 34): return 'p'
        return 'g'
    tiles = [''.join(letter(x, H - 1 - row) for x in range(W)) for row in range(H)]
    P = []
    add = lambda k, x, z, **kw: P.append({'k': k, 'x': round(x, 2), 'z': round(z, 2), **kw})
    # the cove: a pier (the map's walkable bridge), boats moored, posts, a buoy, the net rack and crates on the sand
    for z in (11.0, 8.0, 5.0, 3.6):
        add('dock_post', 12.9, z); add('dock_post', 15.1, z)
    add('fishing_boat', 18.6, 5.2, rot=90)
    add('rowboat', 9.8, 4.6, rot=80)
    add('buoy', 24, 3.5)
    add('net_rack', 20.5, 10.6)
    add('crates', 16.8, 11.2)
    add('barrels', 9.5, 11.2)
    # the beach: driftwood, shells, beach grass, shore rocks and tide pools at the waterline
    for i, (x, v) in enumerate(((27, 0), (31, 1), (35.5, 2))):
        add('driftwood', x, 10.4, **({'v': v} if v else {}))
    for i, x in enumerate((29, 33, 37, 41)):
        add('shells', x, 9.2, **({'v': i % 3} if i % 3 else {}))
    for i, x in enumerate(range(40, 62, 3)):
        add('beach_grass', x, 11.8 + (i % 2) * 0.6, **({'v': i % 4} if i % 4 else {}))
    for i, (x, v) in enumerate(((44, 0), (48.5, 1), (54, 2))):
        add('shore_rocks', x, 7.2, **({'v': v} if v else {}))
    add('tidepool_rim', 51, 8.2); add('tidepool_rim', 58, 7.9)
    # the paddock: rail fence round 6..26 x 16..28, the gate in the south side, things in it
    for x in (7.1, 9.3, 11.5, 13.7, 18.3, 20.5, 22.7, 24.9):
        add('fence_wood', x, 16)
        add('fence_wood', x, 28)
    add('fence_gate', 16.0, 16)
    for z in (17.1, 19.3, 21.5, 23.7, 25.9):
        add('fence_wood', 6, z + 0.0, rot=-90)
        add('fence_wood', 26, z + 0.0, rot=90)
    add('water_trough', 10, 19.5)
    add('hay_feeder', 21, 24.5)
    add('hay_round', 13, 24.5)
    add('hay_round', 15.4, 25.2, rot=30)
    add('haybale', 22.5, 19)
    # the barn beside the paddock, facing the beach; a second look and a turned one for the orbit
    add('barn', 36, 18)
    add('barn', 50, 18, v=1)
    add('barn', 59, 25, rot=-90)
    # the mountain corner: boulders, scree, a cairn, the summit lookout
    for i, (x, z) in enumerate(((43, 34), (47, 37.5), (42, 41))):
        add('boulder_granite', x, z, **({'v': i} if i else {}))
    for i, (x, z) in enumerate(((50, 33.5), (45, 45), (52, 44), (58, 34), (60, 46))):
        add('scree', x, z, **({'v': i} if i else {}))
    add('cairn', 49, 41)
    add('summit_lookout', 55, 39)
    # the forest floor: a couple of trees, the mossy log and stump, litter, ferns
    add('tree_beech', 8, 46); add('tree_pine', 20, 48); add('tree_larch', 30, 44)
    add('log_mossy', 13, 40); add('stump_mossy', 24, 38.5); add('stump_mossy', 6, 37)
    for i, (x, z) in enumerate(((10, 36.5), (17, 37), (27, 41), (15, 44), (33, 37))):
        add('forest_litter', x, z, **({'v': i % 3} if i % 3 else {}))
    for x, z in ((11, 42), (19, 41), (26, 46)):
        add('fern', x, z)
    shots = [{'x': 18, 'z': 1, 'yaw': 0, 'label': 'cove'},
             {'x': 18, 'z': 8, 'yaw': 0, 'label': 'paddock'},
             {'x': 38, 'z': 10, 'yaw': 0, 'label': 'barn'},
             {'x': 44, 'z': 14, 'yaw': 0.9, 'label': 'barn-turned'},
             {'x': 48, 'z': 2, 'yaw': 0, 'label': 'beach'},
             {'x': 50, 'z': 28, 'yaw': 0, 'label': 'mountain'},
             {'x': 18, 'z': 30, 'yaw': 0, 'label': 'forest'}]
    return {
        'name': 'Test: the island props (island track IS-4)', 'w': W, 'h': H, 'kind': 'test', 'test': 1, 'edge': 'g',
        'waterKind': 'sea', 'sky': ['#8CC6E6', '#BFE3EE', '#F4E8C8'], 'haze': '#EAD9C0', 'hazeD': 40,
        'cam': {'pitch': 30, 'h': 12, 'fov': 1, 'orbit': {'c': [W / 2, 30], 'dead': 3, 'lag': 0.6, 'turn': 30}},
        'blur': 0, 'amb': None, 'plain': 1, 'tint': None, 'indoor': 0, 'far': 'hills', 'farH': 8, 'folk': 0,
        'exits': [], 'checks': [], 'shots': shots, 'hub': [30, 14],
        'bridges': [{'a': [14, 12.5], 'b': [14, 2.5], 'w': 1.7, 'kind': 'wood', 'pier': 1}],
        'tiles': tiles, 'props': P,
    }


STEPS = ('new', 'barn', 'scree', 'forest')


def main(steps=STEPS):
    """steps: which parts to build (all by default; a part can be built alone, e.g. `... barn`)."""
    PICS.mkdir(parents=True, exist_ok=True)
    D = gamedata.load()
    C = D['scenery']['props']
    if 'barn' in steps:
        M = C['barn']
        if M.get('build') is None and 'model' in M:
            M['model'] = B1.write_recipe('barn', barn().done(0.62))  # rebuilt; its looks stay as they are
        make_barn(C)
    if 'scree' in steps: swap_scree(C)
    if 'forest' in steps: swap_forest(C)
    if 'new' in steps:
        add_new(C)
        D['maps']['test_props_island'] = showcase()
    gamedata.save(D)
    print('island props built:', ', '.join(steps))


if __name__ == '__main__':
    main(tuple(a for a in sys.argv[1:] if a in STEPS) or STEPS)
