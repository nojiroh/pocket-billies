#!/usr/bin/env python3
"""Buildings track BD-4a: the house kit. About two dozen houses put together from modules by a seed, in the owner's
look "B base + C showpieces" (docs/phases/buildings-track.md, section 1): every house storybook B (about 4 degrees of
lean, some sag and bulge, medium detail), two showpieces with C's dense extras.

Slots, each house one of each (style rules: one dominant shape, at most one round body part, the shared palette,
add-ons only on free walls, the door on the front):
  bodies   narrow tall, wide low, L-shape, round tower-house, jettied, A-frame, half-dome cob, brick townhouse,
           saucer pod (on legs; its door is the fold-down stair's foot)
  roofs    steep gable, low-pitch slab, butterfly, gambrel, saltbox, upswept, bulb dome, mushroom thatch, mansard,
           flat with a roof garden (each body takes the roofs that suit it, BODY_ROOFS)
  add-ons  0-3 of ADDONS, at least one retro-future one; one rooftop ornament at most (the antenna with a glowing tip
           when no other is picked)
  details  chimneys (crooked brick, stovepipe, copper rocket), doors (round, arched, porthole, Dutch), windows
           (porthole, round-top, crossed square, ribbon; bay as an add-on), neon under the eaves on about two thirds
  nature   flower boxes, ivy (about 60% of tall bodies), hanging baskets, roof moss, shrubs by the walls; the plot's
           trees and bushes as `garden` hints for the town tools (existing prop kinds and the sides they go on)
  palettes PALETTES (track section 5: the copper ones, white walls with red, navy or teal roofs)

Writes game/art/scene/next/models/house_kit_NN.json, one catalogue kind `house_kit` whose variants swap model, box,
door, fx, name, garden and kit (body, roof, palette, size), and the test map test_house_kit (debug menu, Test
scenes). Glass ids and roof marks (roof 1, moss 2) are the kit's own. Doors and fx are in picture pixels at the
catalogue's ppu (34), the scale the game reads them at. Not placed on Copperleaf: BD-7 and BD-4b do that.
Contact sheet: python3 tools/look-house-kit.py

    python3 tools/build-house-kit.py            # rerunnable: the same seed makes the same houses
    python3 tools/build-house-kit.py --list     # print the houses (body, roof, palette, add-ons), write nothing
"""
import importlib.util
import json
import math
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import gamedata  # noqa: E402


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'tools' / file)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


SK = _load('look_sketches', 'build-look-sketches.py')  # BD-3's parts: the look B house is the kit's template
box, prism, lathe, cyl, sphere, limb, r3 = SK.box, SK.prism, SK.lathe, SK.cyl, SK.sphere, SK.limb, SK.r3
arc, arch, star = SK.arc, SK.arch, SK.star
CREAM, BUTTER, WHITE, WOOD, DARK = SK.CREAM, SK.BUTTER, SK.WHITE, SK.WOOD, SK.DARK
COPPER, VERDI, TEAL, TERRA, BRASS, NAVY, RED = SK.COPPER, SK.VERDI, SK.TEAL, SK.TERRA, SK.BRASS, SK.NAVY, SK.RED
GLASS, STONE, LEAF, LEAF2, MOSS = SK.GLASS, SK.STONE, SK.LEAF, SK.LEAF2, SK.MOSS
NEON_T, NEON_P, NEON_A = SK.NEON_T, SK.NEON_P, SK.NEON_A
IRON, STEEL = '#3E3E4A', '#8C8C98'
DEG = math.pi / 180

MODELS = 'scene/next/models'
KIND = 'house_kit'
MAP_ID = 'test_house_kit'
SEED = 7
PPU = 34  # the catalogue's picture pixels a metre (scenery.json ppu): doors and fx are read at it
LEAN_DEG = (3.5, 4.5)  # the owner's pick: look B, about 4 degrees
SAG, BULGE = (0.08, 0.16), (0.03, 0.06)
MAX_BOX = (4.6, 3.44)  # the largest house plot today (track section 3)

PALETTES = {  # wall, upper wall, trim, roof, door, the night neon, flower colours
    'copper': dict(wall=CREAM, wall2=BUTTER, trim=WHITE, roof=COPPER, door=TEAL, neon=NEON_T, flowers=['#E85A6A', '#F4E04A']),
    'verdigris': dict(wall=BUTTER, wall2=CREAM, trim=CREAM, roof=VERDI, door=TERRA, neon=NEON_A, flowers=['#F09AC0', '#FFFFFF']),
    'terracotta': dict(wall='#E3A27C', wall2=CREAM, trim=CREAM, roof=TEAL, door=NAVY, neon=NEON_P, flowers=['#F4E04A', '#FFFFFF']),
    'moss': dict(wall=CREAM, wall2='#E8D6B0', trim=WOOD, roof=MOSS, door=RED, neon=NEON_A, flowers=['#E85A6A', '#C478D0']),
    'white_red': dict(wall=WHITE, wall2='#ECE6DC', trim=NAVY, roof=RED, door=NAVY, neon=NEON_T, flowers=['#E85A6A', '#F4E04A']),
    'white_navy': dict(wall=WHITE, wall2='#ECE6DC', trim=RED, roof=NAVY, door=RED, neon=NEON_A, flowers=['#F09AC0', '#F4E04A']),
    'white_teal': dict(wall=WHITE, wall2='#E6EEEA', trim=COPPER, roof=TEAL, door=BUTTER, neon=NEON_P, flowers=['#E85A6A', '#FFFFFF']),
    'timber': dict(wall='#C99A68', wall2=CREAM, trim=CREAM, roof=TERRA, door=TEAL, neon=NEON_T, flowers=['#F4E04A', '#F09AC0'], tex='battens'),
    'brick': dict(wall='#B95A42', wall2='#C8704F', trim=WHITE, roof='#4A5272', door=TEAL, neon=NEON_P, flowers=['#FFFFFF', '#F4E04A'], tex='brick'),
}
PAL_WORDS = {'copper': 'cream and copper', 'verdigris': 'butter and verdigris', 'terracotta': 'terracotta and teal',
             'moss': 'cream and moss', 'white_red': 'white and red', 'white_navy': 'white and navy',
             'white_teal': 'white and teal', 'timber': 'timber and terracotta', 'brick': 'red brick and slate'}

BODIES = ['narrow', 'wide', 'lshape', 'tower', 'jettied', 'aframe', 'cob', 'townhouse', 'saucer']
BODY_COUNT = {'narrow': 3, 'wide': 3, 'lshape': 3, 'tower': 3, 'jettied': 3, 'aframe': 2, 'cob': 2, 'townhouse': 3, 'saucer': 2}
BODY_WORDS = {'narrow': 'narrow tall house', 'wide': 'wide low house', 'lshape': 'L-shaped house', 'tower': 'round tower-house',
              'jettied': 'jettied house', 'aframe': 'A-frame', 'cob': 'half-dome cob house', 'townhouse': 'brick townhouse',
              'saucer': 'saucer pod'}
BODY_ROOFS = {
    'narrow': ['gable', 'gambrel', 'saltbox', 'mansard', 'upswept'],
    'wide': ['slab', 'butterfly', 'upswept', 'gable', 'garden', 'saltbox'],
    'lshape': ['gable', 'gambrel', 'slab', 'butterfly', 'saltbox', 'mansard'],
    'tower': ['bulb', 'mushroom'],
    'jettied': ['gable', 'gambrel', 'saltbox', 'mansard'],
    'aframe': ['gable', 'saltbox'],
    'cob': ['mushroom', 'bulb', 'garden'],
    'townhouse': ['slab', 'mansard', 'garden'],
    'saucer': ['bulb', 'garden'],
}
ROOF_WORDS = {'gable': 'steep gable', 'slab': 'low slab roof', 'butterfly': 'butterfly roof', 'gambrel': 'gambrel',
              'saltbox': 'saltbox roof', 'upswept': 'upswept roof', 'bulb': 'bulb dome', 'mushroom': 'mushroom thatch',
              'mansard': 'mansard', 'garden': 'roof garden'}
ROOF_TEX = {'gable': 'fishscale', 'slab': 'barreltile', 'butterfly': 'standingseam', 'gambrel': 'standingseam',
            'saltbox': 'shingles', 'upswept': 'standingseam', 'bulb': 'fishscale', 'mushroom': 'hay', 'mansard': 'slate',
            'garden': 'leaves'}
ROUND_BODIES = {'tower', 'cob', 'saucer'}
BOX_BODIES = {'narrow', 'wide', 'lshape', 'jettied', 'townhouse'}
SHOWPIECES = ('jettied', 'narrow')  # the first of each body: C's dense extras (the owner's pick)

# add-ons: (retro-future, rooftop ornament)
ADDONS = {
    'turret': (False, False), 'bay': (False, False), 'dormer': (False, False), 'leanto': (False, False),
    'balcony': (False, False), 'porch': (False, False), 'greenhouse': (True, False), 'solar_sail': (True, True),
    'water_tower': (False, True), 'fire_escape': (False, False), 'awning': (False, False), 'weathervane': (False, True),
    'antenna': (True, True), 'spinner': (True, False), 'stair': (False, False), 'finial': (True, True),
    'dish': (True, True), 'tube': (True, False), 'starburst_lamp': (True, False),
}
SIDE_WIDTH = {'leanto': 1.35, 'greenhouse': 1.3, 'fire_escape': 0.85, 'stair': 0.9, 'turret': 0.85}  # metres out of a side
ADD_USE = {}  # add-ons used so far across the kit (the picker spreads them)
RETRO = {k for k, (r, _) in ADDONS.items() if r} | {'rocket_chimney'}
ORNAMENTS = {k for k, (_, o) in ADDONS.items() if o}
NATURE = ('flower box', 'ivy', 'hanging basket', 'roof moss', 'shrub', 'roof garden', 'box plant', 'planter')
# names the test looks for: a retro-future touch on every house (a part named with one of these)
RETRO_NAMES = ('antenna tip', 'finial ball', 'satellite dish', 'solar sail', 'wind spinner', 'bubble greenhouse',
               'pneumatic tube', 'starburst lamp', 'rocket chimney')

TREES = ['tree_oak', 'tree_pine', 'tree_blossom', 'tree_fruit', 'tree_birch']
BUSHES = ['bush_round', 'bush_flower', 'bush_roses', 'bush_box', 'flowers_mixed']


def px(m):
    """a door's x in the catalogue's pixels (ppu 34, prop-turn.js propDoor)"""
    return round(m * PPU)


def fxpx(m):
    """an fx point in the model's own pixels: fx are read at the kind's ppm, 32 (walk/frame-items.js `mpp`)"""
    return round(m * 32)


def ccw(pts):
    a = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))
    return pts if a > 0 else pts[::-1]


def clip(poly, axis, val, keep_above):
    """Sutherland-Hodgman: the part of a polygon on one side of the line (axis 0: x = val, 1: z = val)"""
    out = []
    inside = (lambda p: p[axis] >= val - 1e-9) if keep_above else (lambda p: p[axis] <= val + 1e-9)
    for i in range(len(poly)):
        a, b = poly[i - 1], poly[i]
        if inside(b):
            if not inside(a):
                out.append(_cut(a, b, axis, val))
            out.append(b)
        elif inside(a):
            out.append(_cut(a, b, axis, val))
    # drop repeats
    res = []
    for p in out:
        if not res or abs(res[-1][0] - p[0]) > 1e-4 or abs(res[-1][1] - p[1]) > 1e-4:
            res.append(p)
    if len(res) > 1 and abs(res[0][0] - res[-1][0]) < 1e-4 and abs(res[0][1] - res[-1][1]) < 1e-4:
        res.pop()
    return res


def _cut(a, b, axis, val):
    t = (val - a[axis]) / (b[axis] - a[axis])
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def interp(line, x):
    """the height of a polyline (sorted by x) at x, flat past its ends"""
    if x <= line[0][0]:
        return line[0][1]
    for a, b in zip(line, line[1:]):
        if a[0] <= x <= b[0]:
            return a[1] + (b[1] - a[1]) * (x - a[0]) / max(1e-6, b[0] - a[0])
    return line[-1][1]


def coin(x, y, z, r, h, col, tex='plain', face='front', sides=14, **k):
    """a thin disc facing the front (-y) or a side (face 'left' -x, 'right' +x): portholes, signs, rims"""
    tilt = {'front': [-90 * DEG, 0], 'left': [0, -90 * DEG], 'right': [0, 90 * DEG]}[face]
    return cyl(x, y, z, r, h, col, tex, sides=sides, tilt=tilt, **k)


def top_of(L):
    """the model's top (metres): its still parts' highest point, as the mesher's warp frame measures it (roughly)"""
    t = 0.0
    for l in L:
        k, z = l['k'], l.get('z', 0)
        if k == 'box' or k == 'cyl' or k == 'dome':
            t = max(t, z + l.get('h', 0))
        elif k == 'sphere':
            t = max(t, z + l['r'])
        elif k in ('lathe', 'prism'):
            t = max(t, z + max(p[1] for p in l['pts']) * (1 if k == 'lathe' or not l.get('rotz') else 1))
        elif k == 'limb':
            t = max(t, max(z, l['z2']) + l['r'])
    return t


# ---------------------------------------------------------------------------------------------- the house in hand
class House:
    def __init__(s, i, body, roof, pal, rnd, show):
        s.i, s.body, s.roof, s.pal, s.rnd, s.show = i, body, roof, PALETTES[pal], rnd, show
        s.palname = pal
        s.L, s.wins, s.glows, s.smoke = [], [], [], None
        s.glass = 0
        s.used = set()          # slots taken: side_L, side_R, front_up, door_top, roof_front, lamp, eave, pipe, corner_L/R
        s.addons = []
        s.ornament = None
        s.round_part = body in ROUND_BODIES
        s.foot = [0.0, 0.0, 0.0]  # x min, x max, depth
        s.front_slots = []      # ground-floor windows: [x, z, w, h, y]; upper ones in s.up_slots
        s.up_slots = []
        s.floors = 1
        s.tall = False
        s.neon = rnd.random() < 0.68
        s.wtex = s.pal.get('tex')
        s.extra_w = 0.0

    def gl(s):
        s.glass += 1
        return s.glass

    def add(s, *L):
        for l in L:
            if isinstance(l, list):
                s.L += l
            else:
                s.L.append(l)

    def widen(s, x0, x1, d=None):
        s.foot[0], s.foot[1] = min(s.foot[0], x0), max(s.foot[1], x1)
        if d is not None:
            s.foot[2] = max(s.foot[2], d)

    def pick(s, seq):
        return seq[s.rnd.randrange(len(seq))]

    # --------------------------------------------------------------------------- windows, doors, lamps, chimneys
    def window(s, kind, x, z, w, h, y, face='front', box_=True):
        """a window of a kind, its foot at z, its glass at y (just out of the wall); records it for the night fx"""
        T, L = s.pal['trim'], []
        g = s.gl()
        if kind == 'porthole':
            r = min(w, h) / 2
            L += [coin(x, y + 0.03, z + r, r + 0.08, 0.05, BRASS, 'metal', name='porthole rim'),
                  coin(x, y, z + r, r, 0.04, GLASS, glass=g, name='porthole')]
            zc = z + r
        elif kind == 'roundtop':
            L += [prism(x, y + 0.03, z - 0.05, arch(w + 0.14, h + 0.1, 6), 0.05, T, 'wood', name='window frame'),
                  prism(x, y, z, arch(w, h, 6), 0.04, GLASS, glass=g, name='window'),
                  box(x, y - 0.02, z, 0.04, 0.03, h - w / 2, T, 'wood', name='window bar')]
            zc = z + h / 2
        elif kind == 'ribbon':
            L += [box(x, y + 0.03, z - 0.05, w + 0.14, 0.05, h + 0.1, T, 'wood', name='window frame'),
                  box(x, y, z, w, 0.04, h, GLASS, glass=g, name='window')]
            for k in (1, 2):
                L.append(box(x - w / 2 + k * w / 3, y - 0.02, z, 0.04, 0.03, h, T, 'wood', name='window bar'))
            zc = z + h / 2
        else:  # crossed square
            L += SK.window(x, y, z, w, h, g, frame=T, sill=True)
            L.append(box(x, y - 0.02, z, 0.04, 0.03, h, T, 'wood', name='window bar'))
            zc = z + h / 2
        if face == 'front':
            if box_:
                L += s.flowers(x, y, z - 0.24, w + 0.1)
            s.wins.append((x, zc))
        s.add(L)

    def flowers(s, x, y, z, w):
        """a flower box under a front window (fewer plants than BD-3's: the triangle budget)"""
        L = [box(x, y - 0.1, z, w, 0.2, 0.16, WOOD, 'wood', name='flower box')]
        n = max(2, int(w / 0.24))
        cols = s.pal['flowers']
        for j in range(n):
            fx = x - w / 2 + (j + 0.5) * w / n
            L.append(sphere(fx, y - 0.1, z + 0.2, 0.1, LEAF if j % 2 else LEAF2, 'leaves', sides=5, rings=3, name='box plant'))
            L.append(sphere(fx + 0.03, y - 0.16, z + 0.27, 0.05, cols[j % 2], sides=5, rings=2, name='flower'))
        return L

    def door(s, kind, x, y, z):
        """the front door, its step and path: round, arched, porthole or Dutch"""
        col, T = s.pal['door'], s.pal['trim']
        L = []
        if kind == 'round':
            r = 0.55
            circ = lambda rr: [(rr * math.cos(a * math.pi / 8), rr + rr * math.sin(a * math.pi / 8) - 0.0) for a in range(16)]
            L += [prism(x, y + 0.01, z - 0.06, circ(r + 0.1), 0.04, STONE, 'stone', name='door ring'),
                  prism(x, y - 0.02, z, circ(r), 0.05, col, 'wood', name='round door'),
                  sphere(x, y - 0.07, z + r, 0.06, BRASS, 'metal', sides=6, rings=3, name='door knob')]
        elif kind == 'arched':
            L += [prism(x, y + 0.01, z, arch(1.1, 1.95, 8), 0.04, STONE, 'stone', name='door arch'),
                  prism(x, y - 0.02, z, arch(0.9, 1.85, 8), 0.05, col, 'wood', name='arched door'),
                  sphere(x + 0.28, y - 0.07, z + 0.95, 0.05, BRASS, 'metal', sides=6, rings=3, name='door knob')]
        elif kind == 'porthole':
            L += [box(x, y + 0.01, z, 1.05, 0.05, 2.0, T, 'wood', name='door frame'),
                  box(x, y - 0.02, z, 0.9, 0.05, 1.9, col, 'riveted', name='porthole door'),
                  coin(x, y - 0.03, z + 1.35, 0.24, 0.05, BRASS, 'metal', name='porthole rim'),
                  coin(x, y - 0.07, z + 1.35, 0.17, 0.04, GLASS, glass=s.gl(), name='door porthole'),
                  sphere(x + 0.32, y - 0.07, z + 0.95, 0.05, BRASS, 'metal', sides=6, rings=3, name='door knob')]
        else:  # Dutch: two halves, a ledge between
            L += [box(x, y + 0.01, z, 1.05, 0.05, 2.0, T, 'wood', name='door frame'),
                  box(x, y - 0.02, z, 0.9, 0.05, 0.92, col, 'wood', name='dutch door'),
                  box(x, y - 0.03, z + 0.96, 0.9, 0.05, 0.9, col, 'wood', name='dutch door top'),
                  box(x, y - 0.1, z + 0.9, 1.0, 0.18, 0.05, T, 'wood', name='dutch door ledge'),
                  sphere(x + 0.32, y - 0.07, z + 0.8, 0.05, BRASS, 'metal', sides=6, rings=3, name='door knob')]
        if z < 0.3:
            L.append(box(x, y - 0.25, 0, 1.25, 0.5, 0.15, STONE, 'stone', bevel=0.03, name='door step'))
        s.add(L)

    def lamp(s, x, y, z):
        if 'starburst_lamp' in s.addons:
            s.add(prism(x, y - 0.03, z, star(0.32, 0.12, 8), 0.04, BRASS, 'metal', name='starburst'),
                  sphere(x, y - 0.08, z, 0.08, '#FFF0C0', sides=6, rings=3, glow=NEON_A, name='starburst lamp'))
            s.glows.append((x, z))
        else:
            s.add(SK.lamp(x, y, z))
            s.glows.append((x, z - 0.27))

    def chimney(s, kind, x, y, z0, top):
        """crooked brick (look B's), a stovepipe, or the copper rocket (C's); smoke from its top"""
        h = max(0.9, top - z0)
        if kind == 'brick':
            s.add(lathe(x, y, z0, [(0.26, 0), (0.24, h - 0.4), (0.38, h - 0.1), (0.38, h), (0.2, h)], TERRA, 'brick',
                        sides=8, tilt=[-4 * DEG, 8 * DEG], name='crooked chimney'))
        elif kind == 'stove':
            s.add(cyl(x, y, z0, 0.11, h, STEEL, 'metal', sides=8, tilt=[0, 5 * DEG], name='stovepipe'),
                  lathe(x + h * 0.087, y, z0 + h, [(0.06, 0), (0.24, 0.12), (0.2, 0.2), (0, 0.24)], IRON, 'metal', sides=8,
                        name='stovepipe hat'))
        else:
            s.add(lathe(x, y, z0, [(0.24, 0), (0.28, h * 0.35), (0.28, h * 0.7), (0.2, h * 0.86), (0.07, h), (0, h + 0.05)],
                        COPPER, 'riveted', sides=10, smooth=1, tilt=[-5 * DEG, 9 * DEG], name='rocket chimney'))
            for a in (0, 120, 240):
                s.add(prism(x, y, z0 + h * 0.3, [(0.26, 0), (0.55, 0), (0.28, 0.55)], 0.05, RED, 'metal',
                            rot=(a + 90) * DEG, name='chimney fin'))
            s.add(sphere(x + 0.08, y - 0.12, z0 + h * 0.75, 0.08, '#FFE9B0', sides=6, rings=3, glow=NEON_A, name='rocket porthole'))
        s.smoke = (x + 0.15, z0 + h + 0.25)

    # --------------------------------------------------------------------------------------------------- bodies
    def plinth(s, w, d, cx=0.0, y0=0.0):
        s.add(box(cx, y0 + d / 2, 0, w + 0.3, d + 0.3, 0.15, STONE, 'stone', bevel=0.04, name='plinth'))

    def walls(s, x, y0, w, d, z, h, col, tex, name='walls'):
        s.add(box(x, y0 + d / 2, z, w, d, h, col, tex, name=name))

    def body_box(s, W, D, floors, fh, wall_tex='plaster', upper_tex=None):
        """a plain box body of 1-2 floors with a floor band and corner posts"""
        P = s.pal
        tex = s.wtex or wall_tex
        s.plinth(W, D)
        s.walls(0, 0, W, D, 0.15, fh, P['wall'], tex, 'ground floor')
        if floors > 1:
            s.add(box(0, D / 2, 0.15 + fh - 0.05, W + 0.1, D + 0.1, 0.1, P['trim'], 'wood', name='floor band'))
            s.walls(0, 0, W, D, 0.15 + fh, fh * (floors - 1), P['wall2'] if not s.wtex else P['wall'], upper_tex or tex,
                    'upper floor')
        top = 0.15 + fh * floors
        if tex not in ('brick', 'cob'):
            for sx in (-1, 1):
                s.add(box(sx * (W / 2 - 0.04), 0.04, 0.15, 0.1, 0.1, top - 0.15, P['trim'], 'wood', name='corner post'))
        s.W, s.D, s.cy, s.eave, s.floors, s.fh = W, D, D / 2, top, floors, fh
        s.cx = 0.0
        s.rw, s.rd = W, D
        s.side = {'L': (-W / 2, 0, D, top), 'R': (W / 2, 0, D, top)}  # x, y from, y to, height
        s.widen(-W / 2 - 0.15, W / 2 + 0.15, D + 0.15)
        s.face = lambda fl: 0.0
        s.tall = top > 3.0

    def build_body(s):
        r, b = s.rnd, s.body
        P = s.pal
        if b == 'narrow':
            s.body_box(r.uniform(2.6, 2.9), r.uniform(2.2, 2.4), 2, 1.6, 'plaster', 'siding')
            s.door_x = s.pick([-0.6, 0.6])
            s.front_slots = [[-s.door_x, 0.85, 0.7, 0.75]]
            s.up_slots = [[-0.62, 2.15, 0.62, 0.7], [0.62, 2.15, 0.62, 0.7]]
        elif b == 'wide':
            s.body_box(r.uniform(3.8, 4.1), r.uniform(2.6, 2.8), 1, 2.0, 'cob' if r.random() < 0.4 else 'plaster')
            s.door_x = s.pick([-0.3, 0.3])
            dx = s.door_x
            s.front_slots = [[dx - 1.25 * (1 if dx > 0 else -1) - (0.1 if dx > 0 else -0.1), 0.85, 0.8, 0.75],
                             [dx + 1.15 * (1 if dx > 0 else -1), 0.85, 0.6, 0.75]]
            s.front_slots = [[x, z, w, h] for x, z, w, h in s.front_slots if abs(x) < s.W / 2 - 0.4]
        elif b == 'jettied':
            W, D = r.uniform(2.9, 3.1), 2.2
            s.plinth(W, D)
            s.walls(0, 0, W, D, 0.15, 1.85, P['wall'], s.wtex or 'cob', 'ground floor')
            s.add(box(0, D / 2, 2.0, W + 0.3, D + 0.3, 0.14, WOOD, 'wood', bevel=0.03, name='jetty floor'))
            s.walls(0, -0.15, W + 0.2, D + 0.3, 2.14, 1.4, P['wall2'], 'halftimber', 'upper floor')
            for sx in (-1, 1):
                s.add(limb((sx * (W / 2 - 0.2), 0.0, 1.55), (sx * (W / 2 - 0.05), -0.13, 2.0), 0.05, WOOD, 'wood',
                           sides=4, name='jetty brace'))
            s.W, s.D, s.cy, s.eave, s.floors, s.fh, s.cx = W + 0.2, D + 0.3, D / 2, 3.54, 2, 1.7, 0.0
            s.rw, s.rd = W + 0.2, D + 0.3
            s.side = {'L': (-W / 2, 0, D, 2.0), 'R': (W / 2, 0, D, 2.0)}
            s.widen(-W / 2 - 0.2, W / 2 + 0.2, D + 0.15)
            s.face = lambda fl: -0.15 if fl else 0.0
            s.door_x = s.pick([-0.7, 0.7])
            s.front_slots = [[-s.door_x, 0.8, 0.75, 0.75]]
            s.up_slots = [[-0.75, 2.5, 0.7, 0.7], [0.75, 2.5, 0.7, 0.7]]
            s.tall = True
        elif b == 'lshape':
            # a two-floor main block set back, a one-floor wing forward on the other side; the door on the wing
            side = s.pick([-1, 1])
            W1, D1, W2, D2 = r.uniform(2.2, 2.35), 2.5, r.uniform(1.6, 1.75), 2.1
            back = 0.6
            x1 = -side * (W2 / 2 + 0.02)  # the main block's middle
            x2 = side * (W1 / 2 + 0.02)   # the wing's middle
            s.add(box(x1, back + D1 / 2, 0, W1 + 0.3, D1 + 0.3, 0.15, STONE, 'stone', bevel=0.04, name='plinth'),
                  box(x2, D2 / 2, 0, W2 + 0.3, D2 + 0.3, 0.15, STONE, 'stone', bevel=0.04, name='plinth'))
            s.walls(x1, back, W1, D1, 0.15, 1.7, P['wall'], s.wtex or 'plaster', 'ground floor')
            s.add(box(x1, back + D1 / 2, 1.8, W1 + 0.1, D1 + 0.1, 0.1, P['trim'], 'wood', name='floor band'))
            s.walls(x1, back, W1, D1, 1.85, 1.55, P['wall2'] if not s.wtex else P['wall'], s.wtex or 'siding', 'upper floor')
            s.walls(x2, 0, W2, D2, 0.15, 1.75, P['wall'], s.wtex or 'plaster', 'wing')
            # the wing's roof: a mono-pitch falling to the front, the house's roof colour
            s.add(prism(x2, D2 / 2, 1.9, [(-D2 / 2 - 0.3, 0), (D2 / 2 + 0.1, 0), (D2 / 2 + 0.1, 0.75), (-D2 / 2 - 0.3, 0.14)],
                        W2 + 0.4, P['roof'], 'shingles', rot=90 * DEG, name='wing roof', roof=1),
                  box(x2, -0.25, 1.82, W2 + 0.4, 0.12, 0.08, DARK, 'wood', name='wing eaves'))
            s.W, s.D, s.cy, s.eave, s.floors, s.fh, s.cx = W1, D1, back + D1 / 2, 3.4, 2, 1.65, x1
            s.rw, s.rd = W1, D1
            s.y0 = back
            s.side = {('L' if side > 0 else 'R'): (x1 - side * W1 / 2, back, back + D1, 3.4),
                      ('R' if side > 0 else 'L'): (x2 + side * W2 / 2, 0, D2, 1.9)}
            s.widen(min(x1 - W1 / 2, x2 - W2 / 2) - 0.15, max(x1 + W1 / 2, x2 + W2 / 2) + 0.15, back + D1 + 0.15)
            s.face = lambda fl: back
            s.door_x = x2
            s.front_slots = [[x1, 0.8, 0.75, 0.75]]
            s.front_y = back
            s.up_slots = [[x1, 2.2, 0.7, 0.7]]
            s.tall = True
            s.wing = (x2, W2, D2)
        elif b == 'townhouse':
            W, D = r.uniform(2.8, 3.0), 2.5
            stoop = 0.5
            s.add(box(0, D / 2, 0, W + 0.2, D + 0.2, stoop, STONE, 'stone', bevel=0.03, name='raised floor'))
            tex = 'brick'
            s.walls(0, 0, W, D, stoop, 1.65, P['wall'], tex, 'ground floor')
            s.add(box(0, D / 2, stoop + 1.6, W + 0.08, D + 0.08, 0.1, WHITE if P['trim'] != WHITE else CREAM, 'stone',
                      name='floor band'))
            s.walls(0, 0, W, D, stoop + 1.65, 1.6, P['wall'], tex, 'upper floor')
            top = stoop + 3.25
            # the cornice: a deep stepped band with brackets
            s.add(box(0, D / 2, top, W + 0.3, D + 0.3, 0.12, P['trim'], 'wood', name='cornice'),
                  box(0, D / 2, top + 0.12, W + 0.5, D + 0.5, 0.16, P['trim'], 'wood', bevel=0.04, name='cornice'))
            for j in range(5):
                s.add(box(-W / 2 + 0.2 + j * (W - 0.4) / 4, -0.08, top - 0.18, 0.08, 0.16, 0.2, P['trim'], 'wood', name='cornice bracket'))
            s.W, s.D, s.cy, s.eave, s.floors, s.fh, s.cx = W, D, D / 2, top + 0.28, 2, 1.65, 0.0
            s.rw, s.rd = W, D
            s.side = {'L': (-W / 2, 0, D, top), 'R': (W / 2, 0, D, top)}
            s.widen(-W / 2 - 0.15, W / 2 + 0.15, D + 0.15)
            s.face = lambda fl: 0.0
            s.door_x = s.pick([-0.65, 0.65])
            s.door_z = stoop
            s.front_slots = [[-s.door_x, stoop + 0.6, 0.62, 0.95]]
            s.up_slots = [[-0.65, stoop + 2.05, 0.6, 0.95], [0.65, stoop + 2.05, 0.6, 0.95]]
            s.tall = True
            s.win_kind = 'roundtop'  # Nacrene-like arched windows
            # the stoop: steps to the door, rails
            for j in range(3):
                s.add(box(s.door_x, -0.2 - j * 0.22, 0, 1.1, 0.24, stoop - j * 0.17, STONE, 'stone', name='stoop step'))
            for sx in (-1, 1):
                s.add(limb((s.door_x + sx * 0.55, -0.7, 0.45), (s.door_x + sx * 0.55, -0.05, 0.95), 0.025, IRON, 'metal',
                           sides=4, name='stoop rail'))
        elif b == 'tower':
            R = r.uniform(1.2, 1.35)
            s.plinth_round(R)
            s.add(cyl(0, R, 0.15, R, 1.75, P['wall'], s.wtex or 'cob', sides=14, name='tower ground floor'),
                  cyl(0, R, 1.85, R + 0.05, 0.1, P['trim'], 'wood', sides=14, name='floor band'),
                  cyl(0, R, 1.95, R - 0.05, 1.6, P['wall2'], 'fishscale' if r.random() < 0.5 else 'siding', sides=14,
                      name='tower upper floor'))
            s.W, s.D, s.cy, s.eave, s.floors, s.fh, s.cx = 2 * R, 2 * R, R, 3.55, 2, 1.7, 0.0
            s.rw = s.rd = 2 * R
            s.R = R
            s.side = {'L': (-R, R - 0.4, R + 0.4, 3.0), 'R': (R, R - 0.4, R + 0.4, 3.0)}
            s.widen(-R - 0.15, R + 0.15, 2 * R + 0.15)
            s.face = lambda fl: 0.0
            s.door_x = 0.0
            # windows on the curve: placed on the front, set back by the curve
            s.front_slots = []
            s.up_slots = [[-0.62, 2.35, 0.55, 0.6], [0.62, 2.35, 0.55, 0.6]]
            s.curve = lambda x: R - math.sqrt(max(0.0, R * R - x * x))
            s.tall = True
        elif b == 'cob':
            R = r.uniform(1.4, 1.5)
            s.plinth_round(R)
            s.add({'k': 'dome', 'x': 0, 'y': r3(R), 'z': 0.15, 'r': r3(R), 'h': 2.6, 'sides': 14, 'rings': 5,
                   'col': P['wall'], 'tex': 'cob', 'name': 'cob dome'})
            # the porch hood with the door, forward of the dome
            s.add(box(0, 0.35, 0.15, 1.25, 0.8, 1.95, P['wall'], 'cob', bevel=0.08, name='cob porch'),
                  prism(0, 0.35, 2.1, [(-0.75, 0), (0.75, 0), (0, 0.45)], 0.95, P['roof'], ROOF_TEX['mushroom']
                        if s.roof == 'mushroom' else 'barreltile', name='porch roof', roof=1))
            s.W, s.D, s.cy, s.eave, s.floors, s.fh, s.cx = 2 * R, 2 * R, R, 2.75, 1, 2.2, 0.0
            s.rw = s.rd = 2 * R
            s.R = R
            s.side = {'L': (-R, R - 0.4, R + 0.4, 1.4), 'R': (R, R - 0.4, R + 0.4, 1.4)}
            s.widen(-R - 0.15, R + 0.15, 2 * R + 0.15)
            s.face = lambda fl: 0.0
            s.door_x = 0.0
            s.door_y = -0.05
            s.front_slots = []
            s.dome_win = True
            s.tall = False
        elif b == 'aframe':
            hw, h, D = r.uniform(1.6, 1.75), r.uniform(4.0, 4.4), r.uniform(2.6, 2.9)
            apex = 0.0 if s.roof == 'gable' else hw * 0.35
            t = 0.28
            outer = [(-hw - 0.15, 0), (apex, h), (hw + 0.15, 0)]
            e = t / math.sin(math.atan2(h, hw))
            shell = ccw([(-hw - 0.15, 0), (apex, h), (hw + 0.15, 0), (hw + 0.15 - e, 0), (apex, h - t * 1.6), (-hw - 0.15 + e, 0)])
            s.plinth(2 * hw, D)
            s.add(prism(0, D / 2, 0.15, shell, D + 0.5, P['roof'], ROOF_TEX[s.roof], name='a-frame roof', roof=1))
            inner = ccw([(-hw - 0.15 + e, 0), (hw + 0.15 - e, 0), (apex, h - t * 1.6)])
            s.add(prism(0, D / 2, 0.15, inner, D, P['wall'], s.wtex or 'battens', name='a-frame walls'))
            s.W, s.D, s.cy, s.eave, s.floors, s.fh, s.cx = 2 * hw, D, D / 2, 0.15 + h, 2, 1.6, 0.0
            s.rw, s.rd = 2 * hw, D
            s.side = {'L': (-hw, 0.3, D - 0.3, 0.8), 'R': (hw, 0.3, D - 0.3, 0.8)}
            s.widen(-hw - 0.3, hw + 0.3, D + 0.4)
            s.face = lambda fl: 0.0
            s.door_x = s.pick([-0.55, 0.55]) if apex == 0 else -0.55
            s.front_slots = [[-s.door_x * 1.25, 0.8, 0.55, 0.7]]
            s.up_slots = [[apex, 2.55, 0.8, 0.8]]
            s.ridge = 0.15 + h
            s.top_spot = (apex, D / 2 + 0.3, 0.15 + h - 0.05)
            s.aframe = (outer, hw, h, apex)
            s.tall = True
            s.win_kind_up = 'porthole'
        elif b == 'saucer':
            R = r.uniform(1.3, 1.4)
            zb = 1.35
            cy = R + 0.25
            legs = []
            for a in (45, 135, 225, 315):
                lx, ly = (R - 0.35) * math.cos(a * DEG), cy + (R - 0.35) * math.sin(a * DEG)
                fx, fy = (R + 0.05) * math.cos(a * DEG), cy + (R + 0.05) * math.sin(a * DEG)
                legs += [limb((fx, fy, 0), (lx, ly, zb + 0.3), 0.07, STEEL, 'metal', sides=6, name='pod leg'),
                         cyl(fx, fy, 0, 0.2, 0.08, IRON, 'metal', sides=8, name='leg foot')]
            s.add(legs)
            prof = [(0.5, 0), (R * 0.85, 0.12), (R, 0.38), (R + 0.06, 0.52), (R * 0.88, 0.85), (R * 0.55, 1.12), (0.4, 1.2), (0, 1.2)]
            s.add(lathe(0, cy, zb, prof, P['wall'], 'riveted', sides=16, smooth=1, name='saucer pod'),
                  cyl(0, cy, zb + 0.44, R + 0.08, 0.08, P['trim'], 'metal', sides=16, name='saucer rim'),
                  sphere(0, cy, zb - 0.12, 0.55, '#FFFFFF', sides=10, rings=3, h=0.22, glow=s.pal['neon'], name='pod underglow'))
            # the fold-down stair from the hatch to the ground at the front: its foot is the door
            hz = zb + 0.2
            s.add(box(0, cy - R * 0.92, zb + 0.1, 0.8, 0.12, 0.85, s.pal['door'], 'riveted', tilt=[-12 * DEG, 0],
                      name='pod hatch'))
            for j in range(5):
                t = (j + 0.5) / 5
                s.add(box(0, cy - R * 0.85 - t * (cy - R * 0.85 + 0.25), hz * (1 - t), 0.7, 0.22, 0.06, STEEL, 'metal',
                          name='stair step'))
            for sx in (-1, 1):
                s.add(limb((sx * 0.37, -0.25, 0.0), (sx * 0.37, cy - R * 0.85, hz), 0.025, IRON, 'metal', sides=4,
                           name='stair rail'),
                      limb((sx * 0.37, -0.25, 0.75), (sx * 0.37, cy - R * 0.85, hz + 0.75), 0.02, IRON, 'metal', sides=4,
                           name='stair rail'))
            for sx in (-1, 1):  # planters either side of the stair's foot
                s.add(box(sx * 0.85, 0.05, 0, 0.5, 0.45, 0.35, TERRA, 'brick', bevel=0.03, name='planter'),
                      sphere(sx * 0.85, 0.05, 0.3, 0.26, LEAF if sx > 0 else LEAF2, 'leaves', sides=6, rings=3, lump=0.25,
                             name='shrub'))
            s.W, s.D, s.cy, s.eave, s.floors, s.fh, s.cx = 2 * R, 2 * R, cy, zb + 1.2, 1, 1.2, 0.0
            s.rw = s.rd = 2 * R
            s.R = R
            s.zb = zb
            s.side = {'L': (-R, cy - 0.3, cy + 0.3, zb), 'R': (R, cy - 0.3, cy + 0.3, zb)}
            s.widen(-R - 0.2, R + 0.2, cy + R + 0.2)
            s.face = lambda fl: 0.0
            s.door_x = 0.0
            s.front_slots = []
            s.tall = False
            s.used |= {'door_top', 'side_L', 'side_R', 'lamp'}
            # oval windows round the rim (portholes squashed): front-left, front-right, and the sides
            for a in (-150, -120, -60, -30):
                wx, wy = (R * 0.94) * math.cos(a * DEG), cy + (R * 0.94) * math.sin(a * DEG)
                g = s.gl()
                oval = lambda rx, rz: [(rx * math.cos(t * math.pi / 6), rz + rz * math.sin(t * math.pi / 6)) for t in range(12)]
                s.add(prism(wx, wy, zb + 0.52, oval(0.27, 0.2), 0.05, BRASS, 'metal', rot=(a + 90) * DEG, name='porthole rim'),
                      prism(wx - 0.03 * math.cos(a * DEG), wy - 0.03 * math.sin(a * DEG), zb + 0.56, oval(0.21, 0.16), 0.05,
                            GLASS, rot=(a + 90) * DEG, glass=g, name='oval window'))
                wx, wy = wx + 0.0, wy
                if -135 < a < -45:
                    s.wins.append((wx, zb + 0.7))
        if not hasattr(s, 'front_y'):
            s.front_y = 0.0

    def plinth_round(s, R):
        s.add(cyl(0, R, 0, R + 0.18, 0.15, STONE, 'stone', sides=14, name='plinth'))

    # ---------------------------------------------------------------------------------------------------- roofs
    def shell_roof(s, top, t, along, col, tex, length, infill_w, flare=False):
        """a roof from its top line (in the front plane, or across the depth when along is 'depth'), t thick, drawn
        out over the body; the wall under it filled to the body's width (the gable ends)"""
        if flare:
            a0, a1 = top[0], top[-1]
            top = [(a0[0] - 0.25, a0[1] + 0.22)] + top + [(a1[0] + 0.25, a1[1] + 0.22)]
        bottom = [(x, z - t) for x, z in top]
        outline = clip(top + bottom[::-1], 1, 0.0, True)
        rot = {'rot': 90 * DEG} if along == 'depth' else {}
        rz = s.eave
        s.add(prism(s.cx, s.cy, rz, ccw(outline), length, col, tex, name='roof', roof=1, **rot))
        half = infill_w / 2
        fill = bottom + [(bottom[-1][0], -5.0), (bottom[0][0], -5.0)]
        for ax, v, up in ((1, 0.0, True), (0, -half, True), (0, half, False)):
            fill = clip(fill, ax, v, up)
        if len(fill) >= 3:
            s.add(prism(s.cx, s.cy, rz, ccw(fill), (s.D if along != 'depth' else s.W) - 0.02, s.pal['wall2'],
                        s.wtex or 'plaster', name='gable', **rot))
        s.ridge = rz + max(z for _, z in top)
        s.roof_line = (top, along)

    def roof_z(s, x, y):
        """the roof's height over a point (shell roofs), else the ridge"""
        if not hasattr(s, 'roof_line'):
            return s.ridge
        top, along = s.roof_line
        return s.eave + interp(top, (y - s.cy) if along == 'depth' else (x - s.cx))

    def build_roof(s):
        P, r, k = s.pal, s.rnd, s.roof
        col, tex = P['roof'], ROOF_TEX[k]
        if s.body == 'aframe':
            outer, hw, h, apex = s.aframe
            s.roof_line = ([(o[0], o[1] - (s.eave - 0.15)) for o in outer], 'front')
            s.front_slope = False
            return
        flare = s.show
        over = 0.3
        a, b = s.rw / 2 + over, s.rd / 2 + over
        s.front_slope = False
        s.top_spot = None
        if s.body in BOX_BODIES and k not in ('mansard', 'garden') and s.body != 'townhouse':
            s.add(box(s.cx, s.cy, s.eave - 0.1, 2 * a - 0.1, 2 * b - 0.1, 0.1, DARK, 'wood', name='eaves'))
        if k == 'gable':
            front = r.random() < 0.5
            pitch = r.uniform(44, 50) * DEG
            hh = (a if front else b) * math.tan(pitch) * 0.85
            top = [(-(a if front else b), 0), (0, hh), ((a if front else b), 0)]
            s.shell_roof(top, 0.26, 'front' if front else 'depth', col, tex, 2 * b if front else 2 * a,
                         s.rw if front else s.rd, flare)
            s.front_slope = not front
            s.gable_front = front
            s.top_spot = (s.cx + (0.5 if front else -0.6), s.cy, s.ridge)
        elif k == 'saltbox':
            hh = b * 0.95
            top = [(-b, 0), (b * 0.4, hh), (b, 0)]
            s.shell_roof(top, 0.24, 'depth', col, tex, 2 * a, s.rd, flare)
            s.front_slope = True
            s.top_spot = (s.cx - 0.5, s.cy + b * 0.4, s.ridge)
        elif k == 'gambrel':
            front = r.random() < 0.5
            c = a if front else b
            hh = c * 0.85
            top = [(-c, 0), (-c * 0.8, hh * 0.55), (-c * 0.36, hh), (c * 0.36, hh), (c * 0.8, hh * 0.55), (c, 0)]
            s.shell_roof(top, 0.22, 'front' if front else 'depth', col, tex, 2 * b if front else 2 * a,
                         s.rw if front else s.rd, flare)
            s.front_slope = not front
            s.gable_front = front
            s.top_spot = (s.cx + 0.3, s.cy, s.ridge)
        elif k == 'slab':
            over = 0.5
            a, b = s.rw / 2 + over, s.rd / 2 + over
            hh = b * math.tan(14 * DEG)
            top = [(-b, 0), (0, hh), (b, 0)]
            s.add(box(s.cx, s.cy, s.eave - 0.12, 2 * a - 0.05, 2 * b - 0.05, 0.12, DARK, 'wood', name='eaves'))
            s.shell_roof(top, 0.32, 'depth', col, tex, 2 * a, s.rd)
            s.add(box(s.cx, s.cy - b + 0.04, s.eave - 0.04, 2 * a + 0.02, 0.08, 0.12, WHITE, 'metal', name='roof rim', roof=1))
            s.front_slope = True
            s.top_spot = (s.cx + 0.6, s.cy + 0.3, s.ridge - 0.05)
        elif k == 'butterfly':
            hh = 0.62
            top = [(-a, hh), (0, 0.12), (a, hh)]
            s.shell_roof(top, 0.18, 'front', col, tex, 2 * b, s.rw)
            s.add(box(s.cx, s.cy - b + 0.03, s.eave + 0.05, 0.2, 0.08, 0.1, DARK, 'metal', name='gutter spout'))
            s.top_spot = (s.cx - a * 0.55, s.cy + 0.2, s.eave + hh * 0.6)
        elif k == 'upswept':
            hh = 0.5
            top = [(-a - 0.35, 0.85), (-a + 0.2, 0.32), (0, hh), (a - 0.2, 0.32), (a + 0.35, 0.85)]
            s.add(box(s.cx, s.cy, s.eave, s.rw + 0.05, s.rd + 0.05, 0.12, DARK, 'wood', name='roof plate'))
            s.shell_roof(top, 0.2, 'front', col, tex, 2 * b, s.rw)
            s.top_spot = (s.cx + 0.4, s.cy + 0.2, s.eave + hh - 0.05)
        elif k == 'mansard':
            h = 1.0
            s.add(box(s.cx, s.cy, s.eave, s.rw + 0.5, s.rd + 0.5, 0.12, DARK, 'wood', name='eaves'),
                  box(s.cx, s.cy, s.eave + 0.12, s.rw + 0.4, s.rd + 0.4, h, col, tex, taper=[r3(s.rw - 0.5), r3(s.rd - 0.5)],
                      name='mansard roof', roof=1),
                  box(s.cx, s.cy, s.eave + 0.12 + h, s.rw - 0.4, s.rd - 0.4, 0.1, P['trim'], 'metal', name='mansard cap', roof=1))
            s.ridge = s.eave + 0.22 + h
            s.front_slope = True
            s.top_spot = (s.cx + 0.3, s.cy, s.ridge)
        elif k == 'garden':
            if s.body in ('cob', 'saucer'):
                z0 = s.eave - (0.35 if s.body == 'cob' else 0.15)
                rr = s.R * (0.55 if s.body == 'cob' else 0.58)
                s.add(cyl(s.cx, s.cy, z0, rr, 0.22, '#7AA64E', 'leaves', sides=12, name='roof garden', roof=1))
                for j in range(4):
                    a2 = j * math.pi / 2 + 0.4
                    s.add(sphere(s.cx + rr * 0.6 * math.cos(a2), s.cy + rr * 0.6 * math.sin(a2), z0 + 0.32, 0.22,
                                 LEAF if j % 2 else LEAF2, 'leaves', sides=6, rings=3, lump=0.25, name='roof garden shrub'))
                s.ridge = z0 + 0.22
                s.top_spot = (s.cx, s.cy, z0 + 0.22)
            else:
                s.add(box(s.cx, s.cy, s.eave, s.rw + 0.2, s.rd + 0.2, 0.12, P['trim'], 'stone', name='roof deck'),
                      box(s.cx, s.cy, s.eave + 0.12, s.rw - 0.2, s.rd - 0.2, 0.08, '#7AA64E', 'leaves', name='roof garden', roof=1))
                for sx in (-1, 1):
                    s.add(box(s.cx + sx * (s.rw / 2 + 0.05), s.cy, s.eave + 0.12, 0.1, s.rd + 0.2, 0.32, s.pal['trim'],
                              'stone', name='parapet'))
                s.add(box(s.cx, s.cy - s.rd / 2 - 0.05, s.eave + 0.12, s.rw + 0.2, 0.1, 0.32, s.pal['trim'], 'stone', name='parapet'),
                      box(s.cx, s.cy + s.rd / 2 + 0.05, s.eave + 0.12, s.rw + 0.2, 0.1, 0.32, s.pal['trim'], 'stone', name='parapet'))
                for j, (gx, gy) in enumerate([(-0.7, 0.3), (0.6, -0.2), (-0.1, 0.6)]):
                    s.add(sphere(s.cx + gx * s.rw / 3, s.cy + gy * s.rd / 3, s.eave + 0.42, 0.3 - j * 0.04,
                                 LEAF if j % 2 else LEAF2, 'leaves', sides=6, rings=3, lump=0.25, name='roof garden shrub'))
                s.add(box(s.cx + s.rw / 3, s.cy + s.rd / 4, s.eave + 0.2, 0.5, 0.3, 0.3, TERRA, 'brick', name='planter'))
                s.ridge = s.eave + 0.44
                s.top_spot = (s.cx + 0.5 * s.rw / 3, s.cy + 0.2, s.eave + 0.2)
        elif k in ('bulb', 'mushroom'):
            z0 = s.eave
            if s.body == 'cob':
                z0 = 0.15 + 2.6 * 0.62
                rr = s.R * math.sqrt(1 - 0.62 ** 2) + 0.05
            elif s.body == 'saucer':
                z0 = s.zb + 1.05
                rr = s.R * 0.5
            else:
                rr = s.R + 0.05
                s.add(cyl(s.cx, s.cy, z0 - 0.1, rr + 0.15, 0.12, DARK, 'wood', sides=14, name='eaves'))
            if k == 'bulb':
                if s.body == 'saucer':
                    prof = [(rr, 0), (rr * 1.05, 0.3), (rr * 0.85, 0.65), (rr * 0.4, 0.88), (0, 0.92)]
                    g = s.gl()
                    s.add(lathe(s.cx, s.cy, z0, prof, '#BFE6E8', 'glassblock', sides=14, smooth=1, glass=g, name='glass bubble'),
                          cyl(s.cx, s.cy, z0 - 0.12, rr + 0.12, 0.16, col, 'standingseam', sides=14, name='bubble collar', roof=1))
                else:
                    prof = [(rr + 0.1, 0), (rr + 0.18, 0.3), (rr * 0.9, 0.95), (rr * 0.45, 1.45), (0.12, 1.75), (0, 1.85)]
                    s.add(lathe(s.cx, s.cy, z0, prof, col, tex, sides=14, smooth=1, name='bulb dome', roof=1))
            else:
                prof = [(rr + 0.45, 0), (rr + 0.5, 0.14), (rr + 0.2, 0.55), (rr * 0.6, 1.05), (0.2, 1.3), (0, 1.38)]
                s.add(lathe(s.cx, s.cy, z0, prof, col, tex, sides=14, smooth=1, name='mushroom thatch', roof=1),
                      cyl(s.cx, s.cy, z0 - 0.04, rr + 0.42, 0.06, DARK, 'wood', sides=14, name='thatch underside'))
            s.ridge = z0 + max(p[1] for p in prof)
            s.top_spot = (s.cx, s.cy, s.ridge - 0.05)
            s.dome = (z0, prof)

    # --------------------------------------------------------------------------------------------- the front
    def build_front(s):
        r, P = s.rnd, s.pal
        b = s.body
        main_kind = getattr(s, 'win_kind', None) or s.pick(['cross', 'cross', 'roundtop', 'porthole', 'ribbon'])
        s.win_kind = main_kind
        dz = getattr(s, 'door_z', 0.15)
        door_kind = s.pick(['round', 'arched', 'porthole', 'dutch'])
        if b in ('tower', 'cob') and door_kind == 'dutch':
            door_kind = 'arched'
        s.door_kind = door_kind
        if b != 'saucer':
            s.door(door_kind, s.door_x, getattr(s, 'door_y', 0.0) - 0.0, dz)
        # ground windows (a bay takes one)
        for j, (x, z, w, h) in enumerate(s.front_slots):
            if 'bay' in s.addons and j == 0:
                s.bay(x, z, w, h)
                continue
            kind = 'cross' if (main_kind == 'ribbon' and w < 0.7) else main_kind
            if kind == 'ribbon':
                w, h = w * 1.4, h * 0.6
                z += 0.2
            s.window(kind, x, z, w, h, s.front_y - 0.02)
            if 'awning' in s.addons and j == 0:
                s.add(box(x, s.front_y - 0.32, z + h + 0.12, w + 0.5, 0.7, 0.04, s.pick([RED, TEAL, NAVY]), 'stripes',
                          tilt=[-22 * DEG, 0], name='striped awning'),
                      box(x, s.front_y - 0.66, z + h - 0.02, w + 0.5, 0.03, 0.14, RED, 'cloth', name='awning valance'))
        up_kind = getattr(s, 'win_kind_up', None) or ('porthole' if main_kind == 'porthole' else main_kind if main_kind != 'ribbon' else 'cross')
        for j, (x, z, w, h) in enumerate(s.up_slots):
            if 'balcony' in s.addons and j == 0:
                continue
            fy = s.face(1) if b != 'tower' else s.curve(x)
            if b == 'lshape':
                fy = s.front_y
            s.window(up_kind, x, z, w, h, fy - 0.02, box_=(b not in ('aframe', 'tower')))
        if b == 'tower':
            # ground windows on the curve beside the door
            for x in (-0.85, 0.85):
                s.window('porthole' if main_kind == 'porthole' else 'roundtop', x, 0.8, 0.45, 0.65, s.curve(x) + 0.0, box_=False)
        if b == 'cob':
            for x in (-1.05, 1.05):
                cz = 0.75
                yy = s.cy - math.sqrt(max(0.0, s.R ** 2 - x ** 2)) * math.sqrt(max(0.0, 1 - ((cz + 0.25) / 2.6) ** 2)) + 0.05
                s.window('porthole' if r.random() < 0.6 else 'roundtop', x, cz, 0.5, 0.55, yy - 0.04, box_=False)
        # the porthole of look B: in the front gable when there is one, else on a side
        if getattr(s, 'gable_front', False):
            zg = s.eave + (s.ridge - s.eave) * 0.35
            s.window('porthole', s.cx, zg, 0.48, 0.48, s.cy - s.D / 2 - 0.03, box_=False)
        elif b in BOX_BODIES and 'side_R' not in s.used and b != 'lshape':
            x0 = s.side['R'][0]
            g = s.gl()
            s.add(coin(x0 + 0.01, s.cy, s.eave - 0.9, 0.3, 0.05, BRASS, 'metal', face='right', name='porthole rim'),
                  coin(x0 + 0.04, s.cy, s.eave - 0.9, 0.22, 0.04, GLASS, face='right', glass=g, name='porthole'))
        # lamp by the door
        if 'lamp' not in s.used:
            lx = s.door_x + (0.75 if s.door_x <= 0 else -0.75)
            ly = getattr(s, 'door_y', 0.0) if b != 'tower' else s.curve(lx)
            if b == 'cob':
                lx, ly = s.door_x + 0.75, 0.0
                ly = -0.0
            s.lamp(lx, ly - 0.02 if b != 'cob' else -0.07, dz + 1.75)

    def bay(s, x, z, w, h):
        P = s.pal
        bw, bd = w + 0.4, 0.45
        y = s.front_y - bd / 2
        g = s.gl()
        s.add(box(x, y, 0.15, bw, bd, z - 0.15, P['wall'], s.wtex or 'plaster', name='bay base'),
              box(x, y - 0.02, z, bw - 0.1, bd - 0.06, h, GLASS, glass=g, name='bay window'),
              box(x, y, z + h, bw + 0.12, bd + 0.14, 0.1, P['trim'], 'wood', name='bay top'),
              box(x, y, z + h + 0.1, bw + 0.04, bd + 0.06, 0.18, P['roof'], 'standingseam', taper=[r3(bw - 0.3), r3(bd * 0.5)],
                  name='bay roof', roof=1))
        for sx in (-1, 1):
            s.add(box(x + sx * (bw / 2 - 0.04), s.front_y - bd + 0.04, z, 0.08, 0.08, h, P['trim'], 'wood', name='bay post'))
        s.add(s.flowers(x, s.front_y - bd, z - 0.24, bw - 0.1))
        s.wins.append((x, z + h / 2))

    # ------------------------------------------------------------------------------------------------- add-ons
    def free_side(s, prefer=None):
        for sd in ([prefer] if prefer else []) + ['L', 'R']:
            if sd and f'side_{sd}' not in s.used:
                return sd
        return None

    def can(s, a):
        b = s.body
        box_ = b in BOX_BODIES
        if a in s.addons:
            return False
        if a in SIDE_WIDTH and s.foot[1] - s.foot[0] + s.extra_w + SIDE_WIDTH[a] > MAX_BOX[0] - 0.05:
            return False  # the plot can't take it
        if ADDONS.get(a, (0, 0))[1]:
            return s.ornament is None and getattr(s, 'top_spot', None) is not None
        if a == 'turret':
            return box_ and not s.round_part and b not in ('townhouse',) and s.free_side() is not None
        if a == 'bay':
            return box_ and b != 'townhouse' and bool(s.front_slots)
        if a == 'dormer':
            return s.roof in ('gable', 'saltbox', 'gambrel', 'mansard', 'slab') and b in BOX_BODIES
        if a in ('leanto', 'greenhouse'):
            return b != 'saucer' and s.free_side() is not None
        if a in ('fire_escape', 'stair'):
            return box_ and s.floors > 1 and b != 'lshape' and s.free_side() is not None
        if a == 'balcony':
            return b in ('narrow', 'jettied', 'townhouse') and 'front_up' not in s.used
        if a == 'porch':
            return b in BOX_BODIES and b != 'townhouse' and 'door_top' not in s.used
        if a == 'awning':
            return box_ and bool(s.front_slots) and 'bay' not in s.addons
        if a == 'spinner':
            return 'eave' not in s.used
        if a == 'tube':
            return 'pipe' not in s.used and b not in ('saucer',)
        if a == 'starburst_lamp':
            return 'lamp' not in s.used
        return True

    def choose_addons(s):
        r = s.rnd
        if s.show:
            for a in ['turret', 'tube', 'dish', 'spinner']:
                if s.can(a):
                    s.claim(a)
            # C's bubble greenhouse behind the turret, on its side: they share the plot's width
            if 'turret' in s.addons:
                s.addons.append('greenhouse')
                s.addon_side['greenhouse'] = s.addon_side['turret']
                s.gh_back = True
            return
        n = r.choice([2, 2, 3, 3])
        retro = sorted(a for a in RETRO if a in ADDONS and not ADDONS[a][1])
        others = sorted(a for a in ADDONS if a not in RETRO and a not in ORNAMENTS)

        def least(cands):
            # the kit's least-used add-on so far, ties by the seed: variety across the houses
            low = min(ADD_USE.get(a, 0) for a in cands)
            return s.pick([a for a in cands if ADD_USE.get(a, 0) == low])
        # the first pick is a retro-future one (a retro rooftop one now and then: finial, dish, solar sail); then the
        # cosy and city ones (bay, dormer, porch, balcony, lean-to, awning, stair, fire escape, water tower, vane)
        pool = [a for a in retro + sorted(ORNAMENTS & RETRO - {'antenna'}) if s.can(a)]
        if pool:
            s.claim(least(pool))
        tries = 0
        while len(s.addons) < n and tries < 30:
            tries += 1
            cand = [a for a in others + sorted(ORNAMENTS - RETRO) if s.can(a)] or [a for a in retro if s.can(a)]
            if not cand:
                break
            s.claim(least(cand))

    def claim(s, a):
        s.addons.append(a)
        ADD_USE[a] = ADD_USE.get(a, 0) + 1
        s.extra_w += SIDE_WIDTH.get(a, 0)
        if ADDONS[a][1]:
            s.ornament = a
        if a in ('leanto', 'greenhouse', 'fire_escape', 'stair', 'turret'):
            prefer = 'L' if s.door_x > 0.1 else 'R' if s.door_x < -0.1 else None
            sd = s.free_side(prefer if a == 'turret' else None)
            s.used.add(f'side_{sd}')
            s.addon_side = getattr(s, 'addon_side', {})
            s.addon_side[a] = sd
        slot = {'balcony': 'front_up', 'porch': 'door_top', 'spinner': 'eave', 'tube': 'pipe', 'starburst_lamp': None,
                'dormer': 'roof_front'}.get(a)
        if slot:
            s.used.add(slot)

    def build_addons(s):
        P, r = s.pal, s.rnd
        for a in s.addons:
            sd = getattr(s, 'addon_side', {}).get(a)
            sx = -1 if sd == 'L' else 1
            if sd:
                x0, y0, y1, hh = s.side[sd]
            if a == 'turret':
                tx, ty = x0 + sx * 0.15, 0.55
                tr = 0.55
                th = s.eave + 0.25
                s.add(cyl(tx, ty, 0.15, tr, th - 0.15, P['wall'], 'fishscale', sides=12, name='turret'),
                      cyl(tx, ty, th, tr + 0.08, 0.1, DARK, 'wood', sides=12, name='turret eaves'),
                      lathe(tx, ty, th + 0.1, [(tr + 0.06, 0), (tr + 0.1, 0.22), (tr * 0.8, 0.55), (0.25, 0.9), (0.06, 1.15), (0, 1.25)],
                            RED if P['roof'] != RED else NAVY, 'fishscale', sides=12, smooth=1, name='onion dome', roof=1),
                      box(tx, ty - tr - 0.02, th - 0.12, 0.6, 0.04, 0.04, '#FFFFFF', glow=P['neon'], name='turret neon'))
                for zz in (1.1, th - 0.85):
                    g = s.gl()
                    s.add(coin(tx, ty - tr + 0.02, zz, 0.27, 0.05, BRASS, 'metal', name='porthole rim'),
                          coin(tx, ty - tr - 0.01, zz, 0.2, 0.04, GLASS, glass=g, name='porthole'))
                    s.wins.append((tx, zz))
                s.add(SK.atomic_finial(tx, ty, th + 1.3, 0.45))
                s.widen(tx - tr - 0.1, tx + tr + 0.1)
                s.round_part = True
            elif a == 'leanto':
                lw, ld, lh = 1.1, min(1.7, y1 - y0 - 0.2), 1.75
                lx = x0 + sx * lw / 2
                ly = y0 + (y1 - y0) / 2 + 0.1
                s.add(box(lx, ly, 0.15, lw, ld, lh, P['wall2'], 'battens', name='lean-to'),
                      prism(lx, ly, 0.15 + lh, [(-lw / 2 - 0.15, 0), (lw / 2 + 0.15, 0), (lw / 2 + 0.15, 0.12), (-lw / 2 - 0.15, 0.5)]
                            if sx > 0 else [(-lw / 2 - 0.15, 0), (lw / 2 + 0.15, 0), (lw / 2 + 0.15, 0.5), (-lw / 2 - 0.15, 0.12)],
                            ld + 0.3, P['roof'], 'corrugated', name='lean-to roof', roof=1),
                      box(lx, ly - ld / 2 - 0.01, 0.15, 0.6, 0.04, 1.4, WOOD, 'wood', name='lean-to door'))
                s.widen(lx - lw / 2 - 0.2, lx + lw / 2 + 0.2)
            elif a == 'greenhouse':
                back = getattr(s, 'gh_back', False)
                gx = x0 + sx * (0.5 if back else 0.55)
                gd = 1.05 if back else 1.35
                gy = y1 - gd / 2 - 0.05 if back else y0 + (y1 - y0) / 2 + 0.15
                g = s.gl()
                s.add(box(gx, gy, 0.0, 1.0 if back else 1.05, gd, 0.3, STONE, 'stone', name='greenhouse base'),
                      {'k': 'dome', 'x': r3(gx), 'y': r3(gy), 'z': 0.3, 'r': 0.55 if back else 0.6, 'ry': r3(gd / 2 - 0.05), 'h': 0.85,
                       'sides': 12, 'rings': 4,
                       'col': '#BFE6E8', 'tex': 'glassblock', 'name': 'bubble greenhouse', 'glass': g},
                      sphere(gx, gy, 0.5, 0.33, LEAF2, 'leaves', sides=6, rings=3, name='greenhouse plants'))
                s.widen(gx - 0.65, gx + 0.65)
                s.greenhouse_at = (gx, gy)
            elif a == 'fire_escape':
                fx = x0 + sx * 0.4
                fy0, fy1 = y0 + 0.3, y1 - 0.3
                for zz in (s.fh + 0.25, s.eave - 0.3):
                    s.add(box(fx, (fy0 + fy1) / 2, zz, 0.75, fy1 - fy0, 0.05, IRON, 'metal', name='fire escape deck'))
                    s.add(limb((fx + sx * 0.36, fy0, zz + 0.6), (fx + sx * 0.36, fy1, zz + 0.6), 0.02, IRON, 'metal', sides=4,
                               name='fire escape rail'))
                    for yy in (fy0, (fy0 + fy1) / 2, fy1):
                        s.add(limb((fx + sx * 0.36, yy, zz), (fx + sx * 0.36, yy, zz + 0.6), 0.015, IRON, 'metal', sides=4,
                                   name='fire escape post'))
                s.add(limb((fx, fy0 + 0.1, s.fh + 0.3), (fx, fy1 - 0.1, s.eave - 0.25), 0.03, IRON, 'metal', sides=4, name='fire escape ladder'))
                s.widen(fx - 0.45, fx + 0.45)
            elif a == 'stair':
                stx = x0 + sx * 0.42
                n = 6
                zt = s.fh + 0.15
                for j in range(n):
                    t = (j + 1) / n
                    s.add(box(stx, y0 + 0.25 + t * (y1 - y0 - 0.9), 0.15, 0.7, 0.3, zt * t, STONE if j % 2 else '#C4BCB2',
                              'stone', name='outside stair'))
                s.add(box(stx, y1 - 0.4, 0.15, 0.8, 0.7, zt, STONE, 'stone', name='stair landing'),
                      box(x0 + sx * 0.01, y1 - 0.4, zt, 0.04, 0.8, 1.6, P['door'], 'wood', name='upper door'))
                s.widen(stx - 0.45, stx + 0.45)
            elif a == 'balcony':
                bx, bz = s.up_slots[0][0], s.up_slots[0][1] - 0.35
                fy = s.face(1)
                s.add(box(bx, fy - 0.35, bz, 1.2, 0.7, 0.1, WOOD, 'wood', name='balcony'),
                      box(bx, fy - 0.03, bz + 0.1, 0.7, 0.04, 1.5, GLASS, glass=s.gl(), name='balcony door'))
                s.wins.append((bx, bz + 0.85))
                s.add(limb((bx - 0.58, fy - 0.68, bz + 0.6), (bx + 0.58, fy - 0.68, bz + 0.6), 0.025, P['trim'], 'metal', sides=4,
                           name='balcony rail'))
                for j in range(5):
                    xx = bx - 0.58 + j * 0.29
                    s.add(limb((xx, fy - 0.68, bz + 0.1), (xx, fy - 0.68, bz + 0.6), 0.015, P['trim'], 'metal', sides=4,
                               name='balcony post'))
                s.add(sphere(bx + 0.4, fy - 0.55, bz + 0.3, 0.18, LEAF2, 'leaves', sides=6, rings=3, name='balcony plant'))
            elif a == 'porch':
                px_, dz = s.door_x, getattr(s, 'door_z', 0.15)
                s.add(box(px_, s.front_y - 0.45, dz + 2.15, 1.5, 0.9, 0.08, P['trim'], 'wood', name='porch canopy'),
                      box(px_, s.front_y - 0.45, dz + 2.23, 1.4, 0.8, 0.05, P['roof'], 'standingseam', name='porch roof', roof=1))
                for sx2 in (-1, 1):
                    s.add(limb((px_ + sx2 * 0.65, s.front_y - 0.82, 0.15), (px_ + sx2 * 0.65, s.front_y - 0.82, dz + 2.15), 0.04,
                               P['trim'], 'wood', sides=6, name='porch post'))
            elif a == 'dormer':
                dx = 0.0 if abs(s.door_x) > 0.3 else 0.8
                dx += s.cx
                yy = s.cy - s.rd / 2 + 0.35
                zz = s.roof_z(dx, yy) if s.roof != 'mansard' else s.eave + 0.45
                if s.roof == 'mansard':
                    yy = s.cy - s.rd / 2 + 0.05
                s.add(box(dx, yy + 0.25, zz - 0.25, 0.8, 0.75, 0.7, P['wall2'], 'siding', name='dormer'),
                      prism(dx, yy + 0.25, zz + 0.45, [(-0.55, 0), (0.55, 0), (0, 0.42)], 0.85, P['roof'], ROOF_TEX.get(s.roof, 'shingles'),
                            name='dormer roof', roof=1))
                s.window('porthole' if s.win_kind == 'porthole' else 'cross', dx, zz - 0.1, 0.45, 0.45, yy - 0.15, box_=False)
            elif a in ('spinner',):
                ex = s.cx + (s.rw / 2 + 0.2) * (-1 if s.door_x > 0 else 1)
                ez = s.eave - 0.05
                s.add(limb((ex, -0.3, ez), (ex, -0.3, ez + 0.85), 0.02, BRASS, 'metal', sides=4, name='spinner post'))
                for j in range(4):
                    ca, sa = math.cos(j * math.pi / 2), math.sin(j * math.pi / 2)
                    pts = [(ca * p[0] - sa * p[1], sa * p[0] + ca * p[1]) for p in [(0, 0), (0.3, 0.05), (0.28, 0.15)]]
                    s.add(prism(ex, -0.36, ez + 0.85, pts, 0.02, [RED, BRASS, TEAL, WHITE][j], 'metal', tilt=[90 * DEG, 0],
                                name='wind spinner'))
            elif a == 'tube':
                tsd = 'R' if s.door_x <= 0 else 'L'
                x0, y0, y1, hh = s.side[tsd]
                tsx = -1 if tsd == 'L' else 1
                ty = (y0 + y1) / 2 + 0.3
                gx = x0 + tsx * 0.12
                zt = min(hh, s.eave) - 0.1
                s.add(limb((gx, ty, 0.3), (gx, ty, zt), 0.065, '#DDEEF0', glow=s.pal['neon'], sides=8, name='pneumatic tube'),
                      limb((gx, ty, zt), (gx - tsx * 0.5, ty, zt + 0.35), 0.065, '#DDEEF0', glow=s.pal['neon'], sides=8,
                           name='pneumatic tube'),
                      cyl(gx, ty, 0.15, 0.13, 0.25, BRASS, 'metal', sides=8, name='tube collar'))
            elif a == 'starburst_lamp':
                s.used.add('lamp_star')
        # the rooftop ornament: the one picked, else look B's antenna with its glowing tip
        orn = s.ornament or 'antenna'
        if s.ornament is None:
            s.addons.append('antenna')
        tx, ty, tz = s.top_spot
        if orn == 'antenna':
            s.add(SK.antenna(tx, ty, tz - 0.05, 1.0))
        elif orn == 'weathervane':
            s.add(limb((tx, ty, tz - 0.05), (tx, ty, tz + 0.9), 0.02, IRON, 'metal', sides=4, name='weathervane post'),
                  limb((tx - 0.35, ty, tz + 0.75), (tx + 0.35, ty, tz + 0.75), 0.015, IRON, 'metal', sides=4, name='weathervane arms'),
                  prism(tx, ty, tz + 0.9, [(-0.4, 0), (0.25, 0), (0.25, -0.06), (0.4, 0.06), (0.25, 0.18), (0.25, 0.12), (-0.4, 0.12)],
                        0.02, COPPER, 'metal', tilt=[0, 0], name='weathervane arrow'),
                  sphere(tx, ty, tz + 0.62, 0.06, BRASS, 'metal', sides=6, rings=3, name='weathervane ball'))
        elif orn == 'finial':
            s.add(SK.atomic_finial(tx, ty, tz - 0.05, 0.6))
        elif orn == 'dish':
            s.add(limb((tx, ty, tz - 0.1), (tx, ty, tz + 0.4), 0.03, STEEL, 'metal', sides=6, name='dish post'),
                  lathe(tx, ty, tz + 0.4, [(0, 0), (0.38, 0.13), (0.44, 0.18)], '#E8E4DA', 'metal', sides=12,
                        tilt=[-40 * DEG, -25 * DEG], name='satellite dish'),
                  sphere(tx - 0.1, ty - 0.2, tz + 0.75, 0.04, '#FFE0E8', sides=5, rings=2, glow={'col': NEON_P, 'day': 1},
                         name='dish tip'))
        elif orn == 'solar_sail':
            s.add(limb((tx, ty, tz - 0.05), (tx, ty, tz + 0.75), 0.035, STEEL, 'metal', sides=6, name='sail mast'),
                  box(tx, ty, tz + 0.7, 1.3, 0.8, 0.04, '#3A4C7E', 'solar', tilt=[-30 * DEG, 0], name='solar sail'),
                  box(tx, ty - 0.02, tz + 0.66, 1.36, 0.86, 0.03, BRASS, 'metal', tilt=[-30 * DEG, 0], name='sail frame'))
        elif orn == 'water_tower':
            for ang in (45, 135, 225, 315):
                s.add(limb((tx + 0.35 * math.cos(ang * DEG), ty + 0.35 * math.sin(ang * DEG), tz - 0.05),
                           (tx + 0.28 * math.cos(ang * DEG), ty + 0.28 * math.sin(ang * DEG), tz + 0.65), 0.03, DARK, 'wood',
                           sides=4, name='tower leg'))
            s.add(cyl(tx, ty, tz + 0.65, 0.42, 0.8, WOOD, 'battens', sides=10, name='water tower'),
                  lathe(tx, ty, tz + 1.45, [(0.47, 0), (0.22, 0.32), (0, 0.4)], COPPER, 'metal', sides=10, name='water tower roof', roof=1))

    # -------------------------------------------------------------------------------- chimney, neon, nature
    def build_rest(s):
        r, P, b = s.rnd, s.pal, s.body
        # the chimney: rocket on showpieces, otherwise brick on masonry, stovepipe on pods and A-frames
        kind = 'rocket' if s.show else ('stove' if b in ('saucer', 'aframe', 'tower') else s.pick(['brick', 'brick', 'stove', 'rocket']))
        if b in ('tower', 'cob', 'saucer'):
            cx_, cy_ = s.cx + (0.5 if s.door_x <= 0 else -0.5), s.cy + 0.55
            z0 = s.ridge - 0.9 if b != 'saucer' else s.zb + 0.95
            if b == 'cob' and s.roof == 'garden':
                z0 = s.ridge - 0.3
        elif b == 'aframe':
            outer, hw, h, apex = s.aframe
            cx_, cy_ = apex + 0.5, s.D * 0.7
            z0 = 0.15 + h * (1 - 0.5 / (hw + 0.15)) - 0.4
        else:
            side = -1 if s.door_x > 0.05 or (b == 'lshape' and s.door_x > 0) else 1
            cx_ = s.cx + side * (s.rw / 2 - 0.45)
            cy_ = s.cy + 0.45
            z0 = s.roof_z(cx_, cy_) - 0.35 if s.roof not in ('mansard', 'garden') else s.ridge - 0.35
        top = max(s.ridge + 0.5, z0 + 1.2)
        s.chimney(kind, cx_, cy_, z0, top)
        if kind == 'rocket' and 'rocket_chimney' not in s.addons:
            s.chimney_kind = 'rocket'
        else:
            s.chimney_kind = kind
        # neon under the eaves on about two thirds of houses (showpieces always)
        if (s.neon or s.show) and b not in ('aframe',):
            if b in ('tower', 'cob', 'saucer'):
                zz = s.eave - 0.15 if b == 'tower' else (s.zb + 0.42 if b == 'saucer' else 2.25)
                if b == 'saucer':
                    s.add(cyl(0, s.cy, zz, s.R + 0.1, 0.04, '#FFFFFF', sides=16, glow=P['neon'], name='neon under the eaves'))
                elif b == 'tower':
                    s.add(cyl(0, s.cy, zz, s.R + 0.03, 0.05, '#FFFFFF', sides=14, glow=P['neon'], name='neon under the eaves'))
                else:
                    s.add(box(0, -0.08, 2.0, 1.2, 0.04, 0.04, '#FFFFFF', glow=P['neon'], name='neon under the eaves'))
            else:
                s.add(box(s.cx, s.cy - s.rd / 2 - 0.25, s.eave - 0.17, s.rw + 0.2, 0.05, 0.05, '#FFFFFF', glow=P['neon'],
                          name='neon under the eaves'))
        # nature: ivy up a corner (about 60% of tall bodies), shrubs by the walls, baskets, moss
        s.nature = (['flower box'] if any(l.get('name') == 'flower box' for l in s.L) else []) + (['planter'] if b == 'saucer' else [])
        if s.tall and (r.random() < 0.6 or s.show) and b not in ('saucer',):
            iside = 1 if s.door_x <= 0 else -1
            if f"side_{'R' if iside > 0 else 'L'}" in s.used:
                iside = -iside
            if b in BOX_BODIES:
                ix = s.cx + iside * (s.rw / 2 - 0.05) if b != 'lshape' else s.side['L' if iside < 0 else 'R'][0] - iside * 0.05
                iy = s.front_y + 0.03
            else:
                ix, iy = iside * (s.W / 2 - 0.3), s.cy - s.D / 2 + 0.35
            s.add(SK.ivy(ix, iy, 0.3, min(s.eave, 3.6) - 0.2, -iside))
            s.nature.append('ivy')
        for j, (sx, sy) in enumerate([(-1, 0.15), (1, 0.8)]):
            sd = 'L' if sx < 0 else 'R'
            if f'side_{sd}' in s.used:
                continue
            xx = s.cx + sx * (s.rw / 2 + 0.25) if b in BOX_BODIES else sx * (s.W / 2 + 0.2)
            if b == 'lshape':
                xx = s.side[sd][0] + sx * 0.25
            s.add(sphere(xx, s.front_y + sy if b in BOX_BODIES else s.cy - 0.3 + sy, 0.25, 0.32, LEAF if j else LEAF2,
                         'leaves', sides=6, rings=3, lump=0.25, name='shrub'))
            s.nature.append('shrub')
        if (s.show or r.random() < 0.4) and b in BOX_BODIES and 'door_top' not in s.used:
            for bx in (s.door_x - 0.8, s.door_x + 0.8):
                if abs(bx - s.cx) > s.rw / 2:
                    continue
                zz = s.eave - 0.15
                s.add(limb((bx, s.front_y - 0.3, zz), (bx, s.front_y - 0.3, zz - 0.4), 0.008, '#555560', 'metal', sides=3,
                           name='basket chain'),
                      sphere(bx, s.front_y - 0.3, zz - 0.5, 0.16, WOOD, 'hay', sides=6, rings=3, name='hanging basket'),
                      sphere(bx, s.front_y - 0.3, zz - 0.4, 0.15, LEAF2, 'leaves', sides=6, rings=3, name='basket flowers'),
                      sphere(bx + 0.05, s.front_y - 0.37, zz - 0.36, 0.05, P['flowers'][0], sides=5, rings=2, name='flower'))
            s.nature.append('hanging basket')
        if (s.show or r.random() < 0.35) and hasattr(s, 'roof_line') and s.body != 'aframe':
            for j in range(3 + 2 * s.show):
                mx = s.cx + r.uniform(-0.4, 0.4) * s.rw
                my = s.cy + r.uniform(-0.35, 0.35) * s.rd
                s.add(sphere(mx, my, s.roof_z(mx, my) + 0.12, 0.14, MOSS if j % 2 else LEAF2, 'leaves', sides=6, rings=3,
                             lump=0.3, name='roof moss', roof=2))
            s.nature.append('roof moss')
        if s.roof == 'garden':
            s.nature.append('roof garden')

    # ---------------------------------------------------------------------------------------------- the result
    def centre(s):
        """move the house across so its footprint is centred on the base point (the front's middle): the box is
        read as x +-w/2 (prop-turn.js), so a lean-to on one side would otherwise widen both"""
        dx = -(s.foot[0] + s.foot[1]) / 2
        if abs(dx) < 0.005:
            return
        for l in s.L:
            l['x'] = r3(l['x'] + dx)
            if 'x2' in l:
                l['x2'] = r3(l['x2'] + dx)
        s.foot[0] += dx
        s.foot[1] += dx
        s.door_x += dx
        s.wins = [(x + dx, z) for x, z in s.wins]
        s.glows = [(x + dx, z) for x, z in s.glows]
        if s.smoke:
            s.smoke = (s.smoke[0] + dx, s.smoke[1])

    def warp(s):
        r = s.rnd
        top = top_of(s.L)
        deg = r.uniform(*LEAN_DEG)
        m = math.tan(deg * DEG) * top
        dy = r.uniform(-0.15, 0.25)
        dx = s.pick([-1, 1]) * math.sqrt(1 - dy * dy)
        sag = r.uniform(*SAG) if s.body not in ('saucer', 'tower', 'cob') else r.uniform(0.02, 0.05)
        s.lean = (dx * m, dy * m)
        s.lean_deg = deg
        s.top = top
        return {'lean': [r3(dx * m), r3(dy * m)], 'sag': r3(sag), 'bulge': r3(r.uniform(*BULGE))}

    def fx(s):
        """night effects in picture pixels at the catalogue's ppu, moved by the lean at their height"""
        sh = lambda x, z: x + s.lean[0] * min(1.0, z / s.top)
        out = [{'k': 'window', 'x': fxpx(sh(x, z)), 'y': -fxpx(z)} for x, z in s.wins[:6]]
        out += [{'k': 'glow', 'x': fxpx(sh(x, z)), 'y': -fxpx(z)} for x, z in s.glows]
        if s.smoke:
            out.append({'k': 'smoke', 'x': fxpx(sh(*s.smoke)), 'y': -fxpx(s.smoke[1])})
        return out

    def garden(s):
        """hints for the town tools: trees behind or beside, bushes on free sides (existing prop kinds)"""
        r = s.rnd
        free = [sd for sd in ('L', 'R') if f'side_{sd}' not in s.used]
        trees = [{'k': s.pick(TREES), 'side': 'back'}]
        if free:
            trees.append({'k': s.pick(TREES), 'side': 'back_' + ('left' if free[0] == 'L' else 'right')})
        bushes = [{'k': s.pick(BUSHES), 'side': 'left' if sd == 'L' else 'right'} for sd in free]
        bushes.append({'k': s.pick(BUSHES), 'side': 'front'})
        return {'trees': trees, 'bushes': bushes}


def build(i, body, roof, pal, show):
    rnd = random.Random(f'house-kit-{SEED}-{i}')
    h = House(i, body, roof, pal, rnd, show)
    h.build_body()
    h.build_roof()
    h.choose_addons()
    h.build_front()
    h.build_addons()
    h.build_rest()
    h.centre()
    warp = h.warp()
    w = round(h.foot[1] - h.foot[0], 2)
    d = round(h.foot[2] + 0.1, 2)
    h.box = [w, d]
    assert w <= MAX_BOX[0] and d <= MAX_BOX[1], f'house {i + 1}: box {w} x {d} outgrows the largest plot'
    size = 'small' if w <= 3.6 and d <= 2.8 else 'medium' if w <= 4.1 and d <= 3.1 else 'large'
    h.size = size
    rec = {'about': f'BD-4a house kit {i + 1:02d}: {BODY_WORDS[body]}, {ROOF_WORDS[roof]}, {PAL_WORDS[pal]}',
           'ppm': 32, 'cel': 0.6, 'warp': warp,
           'kit': {'body': body, 'roof': roof, 'palette': pal, 'addons': h.addons, 'chimney': h.chimney_kind,
                   'door': h.door_kind if body != 'saucer' else 'stair', 'windows': h.win_kind,
                   'show': bool(show), 'lean_deg': round(h.lean_deg, 2), 'nature': h.nature},
           'layers': h.L}
    return h, rec


def plan():
    """the houses: (body, roof, palette) each, picked by the seed so no two share all three and each roof and palette
    is used about evenly; two showpieces"""
    rnd = random.Random(f'house-kit-plan-{SEED}')
    order = []
    left = dict(BODY_COUNT)
    while any(left.values()):
        for b in BODIES:
            if left[b]:
                order.append(b)
                left[b] -= 1
    roof_n = {k: 0 for k in ROOF_WORDS}
    pal_n = {k: 0 for k in PALETTES}
    pair_n = {}
    seen, out, prev = set(), [], None
    shown = set()
    for i, b in enumerate(order):
        roofs = sorted(BODY_ROOFS[b], key=lambda k: (pair_n.get((b, k), 0), roof_n[k], rnd.random()))
        roof = roofs[0]
        pals = [p for p in PALETTES if p != prev and (b, roof, p) not in seen]
        if b == 'townhouse' and 'brick' in pals and pal_n['brick'] == 0:
            pal = 'brick'
        else:
            pals.sort(key=lambda p: (pal_n[p], rnd.random()))
            pal = pals[0]
        seen.add((b, roof, pal))
        roof_n[roof] += 1
        pal_n[pal] += 1
        pair_n[(b, roof)] = pair_n.get((b, roof), 0) + 1
        show = b in SHOWPIECES and b not in shown
        if show:
            shown.add(b)
        out.append((b, roof, pal, show))
        prev = pal
    return out


def catalogue(houses):
    first = houses[0]

    def row(h, i):
        return {'name': f'Kit house {i + 1:02d}: {BODY_WORDS[h.body]}, {ROOF_WORDS[h.roof]}',
                'model': f'{MODELS}/house_kit_{i + 1:02d}.json', 'box': h.box,
                'door': {'x': px(h.door_x), 'y': 0}, 'fx': h.fx(), 'garden': h.garden(),
                'kit': {'body': h.body, 'roof': h.roof, 'palette': h.palname, 'size': h.size}}

    base = row(first, 0)
    return {
        **{'name': base['name']},
        'img': 'scene/props/cottage_moss.png', 'ox': -71, 'oy': -172,  # a stand-in picture until BD-7 bakes them
        'shadow': 1.6, 'sway': 0, 'flat': 0, 'tags': [], 'group': KIND,
        'box': base['box'], 'door': base['door'], 'fx': base['fx'], 'model': base['model'], 'ppm': 32,
        'garden': base['garden'], 'kit': base['kit'],
        'vary': {'rot': 0, 'lean': 0, 'size': 0},
        'variants': [row(h, i) for i, h in enumerate(houses) if i],
    }


def test_map(n):
    cols, step_x, step_z = 6, 9.0, 11.0
    rows = (n + cols - 1) // cols
    W, H = int(cols * step_x + 10), int(rows * step_z + 10)
    tiles = ['g' * W for _ in range(H)]
    props, shots = [], []
    for i in range(n):
        c, rw = i % cols, i // cols
        x, z = round(8 + c * step_x, 2), round(8 + rw * step_z, 2)
        p = {'k': KIND, 'x': x, 'z': z}
        if i:
            p['v'] = i
        props.append(p)
        row_ = H - 1 - int(z - 3)
        tiles[row_] = 'p' * W
    for rw in range(rows):
        shots.append({'x': round(8 + 2.5 * step_x, 2), 'z': round(8 + rw * step_z - 8, 2), 'yaw': 0, 'label': f'row{rw + 1}'})
    return {
        'name': 'Test: the house kit (buildings track BD-4a)',
        'w': W, 'h': H, 'edge': 'g',
        'sky': ['#8CC6E6', '#BFE3EE', '#F4E8C8'], 'haze': '#EAD9C0', 'hazeD': 40,
        'cam': {'pitch': 30, 'h': 12, 'fov': 1}, 'blur': 0, 'amb': None, 'plain': 1, 'tint': None, 'indoor': 0,
        'far': 'hills', 'farH': 8, 'folk': 0, 'test': 1, 'exits': [], 'checks': [], 'shots': shots,
        'hub': [8, 3], 'kind': 'test', 'tiles': tiles, 'props': props,
    }


def main():
    P = plan()
    houses, recs = [], []
    for i, (b, roof, pal, show) in enumerate(P):
        h, rec = build(i, b, roof, pal, show)
        houses.append(h)
        recs.append(rec)
    if '--list' in sys.argv:
        for i, h in enumerate(houses):
            print(f'{i + 1:02d} {h.body:9} {h.roof:9} {h.palname:10} {h.size:6} box {h.box} lean {h.lean_deg:.1f} '
                  f'{"SHOW " if h.show else ""}{",".join(h.addons)} chimney {h.chimney_kind} glass {h.glass}')
        return
    for i, rec in enumerate(recs):
        (ROOT / 'game/art' / MODELS / f'house_kit_{i + 1:02d}.json').write_text(json.dumps(rec, indent=1) + '\n')
    D = gamedata.load()
    D['scenery']['props'][KIND] = catalogue(houses)
    D['maps'][MAP_ID] = test_map(len(houses))
    gamedata.save(D)
    print(f'wrote {len(recs)} house recipes, the {KIND} kind and game/data/maps/{MAP_ID}.json')


if __name__ == '__main__':
    main()
