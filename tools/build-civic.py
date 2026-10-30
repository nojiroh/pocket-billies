#!/usr/bin/env python3
"""Buildings track BD-5: Copperleaf's civic buildings, new models under their old keys: the shop, the inn, the
library (the Bureau's archive) and the lab. The owner's look pick (2026-10-30): "B base + C showpieces": BD-3's look B
(medium detail; the lean turned down on civic buildings: plumb or a soft swell) with one or two of look C's showpiece
extras each. Built from BD-1's shapes (prism, lathe, box bevel, rot, tilt, warp, glow) and BD-2a's surfaces, with BD-3's
helpers (tools/build-look-sketches.py).

  shop     a Streamline corner store: a rounded corner with speed lines, a big front window, a striped awning, a starburst,
           a round leaf emblem board and the SHOP board; showpieces: a Googie canopy over the door, string lights
  inn      the inn and cafe: three floors stacked, each turned a little, balconies, a teacup sign with the INN board, an
           atomic finial; showpieces: string lights, a blossom street tree
  library  the Bureau's archive: a rotunda with a clock over its door, wings fronted with filing drawers, an upswept
           book-fan roof, ivy and the LIBRARY board; showpiece: a glowing tube under the cornice
  lab      Professor Hazel's lab: an observatory dome with a slit and a telescope, a radio dish, a copper tower with a
           glowing ring, Kappi's corner (a porthole nook with a bench by the big window); showpiece: a rocket chimney

Footprints (box) and doors stay as they were (shop 3.8 x 2.4, door 30 px; inn 5.6 x 3.4, door 0; library 5.4 x 3.4,
door 0; lab 6 x 3, door 62 px), so the town tools (BD-7) have nothing to move for these four. Lettering stays
pixel-font decals that face the front (never mirrored). Each model's picture (the fallback and the far view) is baked
from the game's own mesh (tools/model-triangles.mjs) into scene/next/hub/<key>.png.

    python3 tools/build-civic.py      # rerunnable: writes the four recipes, their pictures and catalogue entries
"""
import importlib.util
import json
import math
import subprocess
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


LS = load('look_sketches', 'build-look-sketches.py')
B1 = load('batch1', 'build-props-batch1.py')
B5 = load('batch5', 'build-props-batch5.py')
ISL = load('island', 'build-props-island.py')
B5.GLYPHS.update({  # batch 7's capitals for the boards' words
    'B': ['11110', '11011', '11011', '11110', '11011', '11011', '11110'],
    'Y': ['11011', '11011', '11011', '01110', '00100', '00100', '00100'],
    'S': ['01111', '11000', '11000', '01110', '00011', '00011', '11110'],
    'H': ['11011', '11011', '11011', '11111', '11011', '11011', '11011'],
    'O': ['01110', '11011', '11011', '11011', '11011', '11011', '01110'],
    'P': ['11110', '11011', '11011', '11110', '11000', '11000', '11000'],
})

box, prism, lathe, cyl, sphere, limb, disc = LS.box, LS.prism, LS.lathe, LS.cyl, LS.sphere, LS.limb, LS.disc
arc, arch, star, r3 = LS.arc, LS.arch, LS.star, LS.r3
CREAM, BUTTER, WHITE, WOOD, DARK = LS.CREAM, LS.BUTTER, LS.WHITE, LS.WOOD, LS.DARK
COPPER, VERDI, TEAL, TERRA, BRASS, NAVY, RED = LS.COPPER, LS.VERDI, LS.TEAL, LS.TERRA, LS.BRASS, LS.NAVY, LS.RED
GLASS, STONE, LEAF, LEAF2, MOSS = LS.GLASS, LS.STONE, LS.LEAF, LS.LEAF2, LS.MOSS
NEON_T, NEON_P, NEON_A = LS.NEON_T, LS.NEON_P, LS.NEON_A
DEG = math.pi / 180
PPM = 32
MODELS = 'scene/next/models'
PICS = B1.ART / 'scene' / 'next' / 'hub'
px = lambda m: round(m * PPM)

# the old footprints and doors, kept (door x in picture pixels at 32 px/m, as batch 7 and batch 3 wrote them)
KEEP = {'shop': ([3.8, 2.4], 0.94), 'inn': ([5.6, 3.4], 0.0), 'library': ([5.4, 3.4], 0.0), 'lab': ([6, 3], 1.94)}


def warp(lean_deg=0.0, height=1.0, bulge=0.0, sag=0.0):
    """the recipe's warp with its lean given in degrees: the warp's lean is metres at the model's top (BD-3's note)"""
    W = {}
    if lean_deg: W['lean'] = [r3(math.tan(lean_deg * DEG) * height), 0.0]
    if bulge: W['bulge'] = bulge
    if sag: W['sag'] = sag
    return W or None


def turned(L, cx, cy, ang):
    """parts turned together about the upright through (cx, cy): a floor of the inn set a little askew"""
    c, s = math.cos(ang), math.sin(ang)
    rot = lambda x, y: (cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c)
    for l in L:
        if l['k'] == 'img': continue
        l['x'], l['y'] = (r3(v) for v in rot(l['x'], l['y']))
        if l['k'] == 'limb':
            l['x2'], l['y2'] = (r3(v) for v in rot(l['x2'], l['y2']))
        else:
            l['rot'] = r3((l.get('rot') or 0) + ang)
    return L


def word_board(x, y, z, text, board, letters, shade, rim=BRASS, round_ends=True):
    """a rounded board with a word in the game's pixel capitals (a decal facing the front, never mirrored)"""
    p, lw, lh = B5.letters(text, letters, f'{text.lower()}_word', shade)
    w, h = lw + 0.3, lh + 0.16
    L = [box(x, y, z, w, 0.06, h, board, 'wood', name=f'{text.lower()} board'),
         box(x, y + 0.02, z - 0.04, w + 0.08, 0.05, h + 0.08, rim, 'metal', name=f'{text.lower()} board rim')]
    if round_ends:
        for sx in (-1, 1):
            L.append(disc(x + sx * w / 2, y + 0.02, z - 0.04 + (h + 0.08) / 2, (h + 0.08) / 2, rim, 'metal',
                          sides=12, name='board end'))
    L.append(B1.img(p, x, y - 0.07, z + 0.08, face='fixed', recv=0, shadow=0, sway=0, name='lettering'))
    return L


def string_lights(a, b, n, drop, name='string light'):
    """a sagging string of coloured bulbs from a to b (lit at night)"""
    L = []
    for i in range(n):
        t = i / (n - 1)
        x, y, z = (a[q] + (b[q] - a[q]) * t for q in range(3))
        L.append(sphere(x, y, z - drop * math.sin(math.pi * t), 0.045, ['#FFE0A0', '#FFB0D0', '#A0F0FF'][i % 3],
                        sides=5, rings=2, glow=[NEON_A, NEON_P, NEON_T][i % 3], name=name))
    return L


def blossom_tree(x, y, s=1.0):
    return [cyl(x, y, 0, 0.1 * s, 1.2 * s, WOOD, 'bark', sides=7, name='street tree trunk'),
            sphere(x, y, 1.05 * s, 0.68 * s, '#F4B6C8', 'leaves', sides=8, rings=5, lump=0.25, name='blossom crown'),
            sphere(x + 0.2 * s, y - 0.15, 0.95 * s, 0.4 * s, '#EE9AB4', 'leaves', sides=7, rings=4, lump=0.25,
                   name='blossom crown'),
            cyl(x, y, 0, 0.36 * s, 0.1, STONE, 'stone', sides=10, name='tree ring')]


def planter(x, y, col=TERRA):
    return [box(x, y, 0, 0.45, 0.45, 0.4, col, 'brick', bevel=0.03, name='planter'),
            sphere(x, y, 0.35, 0.3, LEAF, 'leaves', sides=7, rings=4, lump=0.25, name='planter shrub')]


def arch_window(x, y, z, w, h, glass, frame=WHITE):
    """a round-topped window: its glass, a frame drawn round it, a sill"""
    return [prism(x, y - 0.03, z, arch(w + 0.14, h + 0.07), 0.05, frame, 'wood', name='window frame'),
            prism(x, y - 0.05, z + 0.035, arch(w, h), 0.03, GLASS, glass=glass, name='window'),
            box(x, y - 0.08, z - 0.06, w + 0.22, 0.14, 0.07, frame, 'wood', name='sill')]


class Model:
    """parts so far, with the windows (picture points of the night window glows), lamps and the chimney's smoke"""

    def __init__(s):
        s.L, s.wins, s.glows, s.smoke, s.glass = [], [], [], None, 0

    def g(s):
        s.glass += 1
        return min(31, s.glass)

    def win(s, x, z):
        s.wins.append((x, z))

    def fx(s):
        out = [{'k': 'window', 'x': px(x), 'y': -px(z)} for x, z in s.wins]
        out += [{'k': 'glow', 'x': px(x), 'y': -px(z)} for x, z in s.glows]
        if s.smoke: out.append({'k': 'smoke', 'x': px(s.smoke[0]), 'y': -px(s.smoke[1])})
        return out


# ---------------------------------------------------------------------------------------------------------- the shop
def shop():
    """A Streamline corner store on look B (plumb, a soft swell): the rounded front-left corner ringed with speed lines,
    a big window of goods under a striped awning, the glass door on the right, a thick slab roof over a dark underside,
    the round leaf emblem board, a starburst and the SHOP board on the roof; C's Googie canopy and string lights."""
    M, (W, Dp), dx = Model(), KEEP['shop'][0], KEEP['shop'][1]
    H, D, R = 2.4, KEEP['shop'][0][1] / 2, 0.65
    zr = 0.15 + H
    L = M.L
    L += [box(0, D, 0, W + 0.3, Dp + 0.3, 0.15, STONE, 'stone', bevel=0.04, name='plinth'),
          box(R / 2, D, 0.15, W - R, Dp, H, WHITE, 'plaster', name='body'),
          box(-W / 2 + R / 2, D + R / 2, 0.15, R, Dp - R, H, WHITE, 'plaster', name='body corner back'),
          cyl(-W / 2 + R, R, 0.15, R, H, WHITE, 'plaster', sides=16, name='round corner'),
          box(0, D, 0.15, W + 0.04, Dp + 0.04, 0.35, TEAL, 'tilewall', name='base band'),
          cyl(-W / 2 + R, R, 0.15, R + 0.02, 0.35, TEAL, 'tilewall', sides=16, name='base band corner')]
    # the slab roof: thick and wide over a dark underside, a white rim
    L += [box(0, D, zr, W + 0.6, Dp + 0.6, 0.12, DARK, 'wood', name='eaves'),
          box(0, D, zr + 0.12, W + 0.6, Dp + 0.6, 0.22, RED, 'barreltile', bevel=0.06, name='slab roof', roof=1)]
    for y, w, d in ((-0.27, W + 0.6, 0.06), (Dp + 0.27, W + 0.6, 0.06)):
        L.append(box(0, y, zr + 0.34, w, d, 0.06, WHITE, 'metal', name='roof rim', roof=1))
    for sx in (-1, 1):
        L.append(box(sx * ((W + 0.6) / 2 - 0.03), D, zr + 0.34, 0.06, Dp + 0.6, 0.06, WHITE, 'metal', name='roof rim',
                     roof=1))
    # the big window of goods; the glass door
    wx = -0.55
    L += [box(wx, -0.02, 0.55, 2.0, 0.04, 1.3, GLASS, glass=M.g(), name='shop window'),
          box(wx, 0.0, 0.5, 2.15, 0.06, 0.08, BRASS, 'metal', name='window frame'),
          box(wx, 0.0, 1.85, 2.15, 0.06, 0.08, BRASS, 'metal', name='window frame'),
          box(wx, -0.03, 1.15, 2.0, 0.03, 0.03, BRASS, 'metal', name='shelf')]
    M.win(wx, 1.2)
    for i, c in enumerate(['#C478D0', '#F49A3A', '#8CC850', '#E04848', '#F07090', '#F49A3A']):
        L.append(box(wx - 0.8 + i * 0.32, -0.04, 0.6 + (i % 2) * 0.6, 0.18, 0.03, 0.25, c, name='goods'))
    L += [box(dx, -0.02, 0.15, 1.1, 0.05, 1.95, BRASS, 'metal', name='door frame'),
          box(dx, -0.05, 0.2, 0.95, 0.03, 1.85, '#A8DCE8', glass=M.g(), name='glass door'),
          box(dx, -0.07, 0.2, 0.04, 0.03, 1.85, BRASS, 'metal', name='door edge'),
          box(dx, -0.3, 0, 1.5, 0.55, 0.15, STONE, 'stone', bevel=0.03, name='door step')]
    M.win(dx, 1.1)
    # the striped awning over the window
    L += [box(wx, -0.35, 2.05, 2.3, 0.75, 0.04, RED, 'stripes', tilt=[-22 * DEG, 0], name='striped awning'),
          box(wx, -0.72, 1.9, 2.3, 0.03, 0.14, RED, 'cloth', name='awning valance')]
    # speed lines round the corner and along the left side
    for i in range(3):
        z = 1.3 + i * 0.18
        L += [box(-1.35, -0.02, z, 0.3, 0.04, 0.06, TEAL, 'metal', name='speed line'),
              cyl(-W / 2 + R, R, z, R + 0.02, 0.06, TEAL, 'metal', sides=16, name='speed line round'),
              box(-W / 2 - 0.02, R + (Dp - R) / 2, z, 0.04, Dp - R, 0.06, TEAL, 'metal', name='speed line side')]
    # on the roof: the round leaf emblem board (lit ring), a starburst, the SHOP board
    sy, sz = -0.05, zr + 0.95
    L += [disc(0.4, sy + 0.02, sz, 0.6, WHITE, sides=18, name='sign ring'),
          disc(0.4, sy, sz, 0.5, TEAL, sides=18, name='sign board'),
          box(0.4, D, zr + 0.34, 0.12, 0.12, 0.3, DARK, 'metal', name='sign post'),
          lathe(0.4, sy - 0.01, sz, [(0.6, 0), (0.64, 0), (0.64, 0.03), (0.6, 0.03), (0.6, 0)], '#FFFFFF',
                tilt=[-90 * DEG, 0], sides=18, glow=NEON_T, name='sign neon')]
    L += LS.leaf_emblem(0.4, sy - 0.03, sz, 0.3, '#7CC060')
    L += [prism(1.6, -0.04, zr + 0.85, star(0.42, 0.16, 8), 0.05, BRASS, 'metal', name='starburst'),
          sphere(1.6, -0.08, zr + 0.81, 0.08, '#FFF0C0', sides=6, rings=3, glow=NEON_A, name='starburst core'),
          limb((1.6, 0.4, zr + 0.34), (1.6, 0.0, zr + 0.85), 0.03, DARK, 'metal', name='starburst stay')]
    L += word_board(-1.15, -0.02, zr + 0.42, 'SHOP', '#2E6A9A', '#FFFFFF', '#1E3A5A')
    L += [box(-1.15, 0.3, zr + 0.34, 0.08, 0.6, 0.1, DARK, 'metal', name='board foot')]
    L.append(box(0, -0.31, zr - 0.05, W + 0.5, 0.04, 0.04, '#FFFFFF', glow=NEON_P, name='neon under the eaves'))
    # a lamp by the door, planters
    L += LS.lamp(1.65, -0.02, 2.1)
    M.glows.append((1.65, 1.9))
    L += planter(-1.75, -0.3) + planter(1.75, -0.35)
    # C's showpieces: the Googie canopy over the door (a neon edge under it), string lights along the eaves
    L += [prism(dx, -0.5, 2.18, [(-0.7, 0), (0.7, 0), (0.92, 0.26), (0.7, 0.12), (-0.7, 0.12), (-0.92, 0.26)], 0.5,
                TEAL, 'metal', bend=0.18, segs=4, name='Googie canopy'),
          box(dx, -0.48, 2.15, 1.3, 0.05, 0.04, '#FFFFFF', glow=NEON_A, name='canopy neon')]
    L += string_lights((-1.9, -0.33, zr - 0.1), (0.2, -0.33, zr - 0.1), 7, 0.18)
    # side and back windows
    for y in (1.2,):
        L += [box(W / 2 + 0.01, y, 1.0, 0.04, 0.9, 0.8, GLASS, glass=M.g(), name='side window'),
              box(W / 2 + 0.02, y, 0.95, 0.05, 1.0, 0.05, WHITE, 'wood', name='side sill')]
    L += [box(0, Dp + 0.01, 1.0, 0.9, 0.04, 0.8, GLASS, glass=M.g(), name='back window')]
    return {'about': 'BD-5: the shop, a Streamline corner store (look B, C showpieces)', 'warp': warp(0, 4, 0.02, 0.04),
            'layers': L}, M


# ----------------------------------------------------------------------------------------------------------- the inn
def teacup_sign(x, y, z):
    """the cafe's sign: a teacup on its saucer, a curl of steam, on an iron bracket out from the wall"""
    cup = [(0, 0), (0.16, 0), (0.22, 0.04), (0.28, 0.2), (0.3, 0.34), (0.27, 0.34), (0.25, 0.2), (0.0, 0.06)]
    return [limb((x, y, z + 0.5), (x, y - 0.95, z + 0.5), 0.025, DARK, 'metal', name='sign bracket'),
            limb((x, y, z + 0.1), (x, y - 0.6, z + 0.5), 0.015, DARK, 'metal', name='sign brace'),
            limb((x, y - 0.6, z + 0.5), (x, y - 0.6, z + 0.36), 0.01, DARK, 'metal', name='sign chain'),
            lathe(x, y - 0.6, z - 0.02, [(0, 0), (0.36, 0), (0.38, 0.03), (0.0, 0.03)], WHITE, sides=14, name='saucer'),
            lathe(x, y - 0.6, z, cup, WHITE, sides=12, name='teacup'),
            sphere(x, y - 0.6, z + 0.2, 0.2, TERRA, sides=10, rings=3, h=0.06, name='tea'),
            lathe(x + 0.3, y - 0.6, z + 0.17, [(0.08, 0), (0.11, 0), (0.11, 0.025), (0.08, 0.025), (0.08, 0)], WHITE,
                  sides=8, tilt=[-90 * DEG, 0], name='cup handle'),
            box(x, y - 0.6, z + 0.12, 0.62, 0.02, 0.05, TEAL, name='cup band'),
            sphere(x - 0.04, y - 0.6, z + 0.42, 0.07, '#F4F4F6', sides=6, rings=3, glow={'col': '#FFF4E0'},
                   name='steam'),
            sphere(x + 0.05, y - 0.6, z + 0.56, 0.055, '#F4F4F6', sides=6, rings=3, glow={'col': '#FFF4E0'},
                   name='steam')]


def railing(x0, x1, y, z, h=0.55, col=BRASS):
    L = [box((x0 + x1) / 2, y, z + h, x1 - x0, 0.06, 0.05, col, 'metal', name='balcony rail')]
    n = max(2, int((x1 - x0) / 0.22))
    for i in range(n + 1):
        L.append(box(x0 + (x1 - x0) * i / n, y, z, 0.035, 0.035, h, col, 'metal', name='baluster'))
    return L


def inn():
    """The inn and cafe on look B: three floors stacked, the first turned a few degrees one way and the top the other,
    each jettied out over the one below; a stone and cream ground floor with the round double door, a half-timbered
    first floor with a balcony, a terracotta top floor with a little balcony and portholes under an upswept verdigris
    roof crowned with an atomic finial; the teacup sign and the INN board; C's string lights and a blossom tree."""
    M, (W, Dp), dx = Model(), KEEP['inn'][0], KEEP['inn'][1]
    L = M.L
    D = Dp / 2
    z1 = 0.2 + 2.2           # the first floor's foot
    z2 = z1 + 0.15 + 1.9     # the top floor's foot
    z3 = z2 + 0.15 + 1.6     # the top floor's roof
    # the ground floor
    L += [box(0, D, 0, W + 0.3, Dp + 0.3, 0.2, STONE, 'stone', bevel=0.04, name='plinth'),
          box(0, D, 0.2, W, Dp, 2.2, CREAM, 'plaster', name='ground floor'),
          box(0, D, 0.2, W + 0.04, Dp + 0.04, 0.55, '#B4B0C2', 'stone', name='stone skirt')]
    for sx in (-1, 1):
        L.append(box(sx * (W / 2 - 0.05), 0.05, 0.2, 0.16, 0.16, 2.2, '#B4B0C2', 'stone', name='quoin'))
    # the round double door and its surround; lamps either side; windows
    L += [prism(dx, -0.04, 0.2, arch(1.5, 2.15, 8), 0.06, '#9C98AC', 'stone', name='door surround'),
          prism(dx, -0.08, 0.2, arch(1.24, 2.0, 8), 0.06, '#7A4E34', 'wood', name='door'),
          box(dx, -0.1, 0.2, 0.04, 0.03, 1.95, '#5A3A28', 'wood', name='door split'),
          prism(dx, -0.1, 0.2 + 1.45, arch(0.9, 0.5, 6)[2:] + [(0.45, 0), (-0.45, 0)], 0.02, '#A8DCE8', glass=M.g(),
                name='fanlight'),
          sphere(dx - 0.14, -0.13, 1.05, 0.04, BRASS, 'metal', sides=6, rings=3, name='door knob'),
          sphere(dx + 0.14, -0.13, 1.05, 0.04, BRASS, 'metal', sides=6, rings=3, name='door knob'),
          box(dx, -0.35, 0, 2.0, 0.65, 0.12, STONE, 'stone', bevel=0.03, name='door step'),
          box(dx, -0.28, 0.12, 1.6, 0.45, 0.08, '#BDB9C6', 'stone', name='door step top')]
    M.win(dx, 1.9)
    for x in (-1.0, 1.0):
        L += LS.lamp(x, -0.02, 1.95)
        M.glows.append((x, 1.75))
    for x in (-2.0, 2.0):
        L += LS.window(x, 0, 0.9, 0.8, 0.8, M.g(), frame='#F4EEDC')
        L += LS.flower_box(x, -0.02, 0.72, 0.9, ['#F07090', '#F4D99A', '#C478D0'])
        M.win(x, 1.3)
    # the first floor, jettied out at the front and turned 3 degrees: half-timber, a balcony along it
    F1 = [box(0, D - 0.1, z1, W + 0.2, Dp + 0.1, 0.15, '#60402C', 'wood', name='jetty beam'),
          box(0, D - 0.12, z1 + 0.15, W - 0.1, Dp - 0.1, 1.9, BUTTER, 'halftimber', name='first floor')]
    for x in (-1.7, 0.0, 1.7):
        F1 += [box(x, -0.16, z1 + 0.3, 1.0, 0.04, 1.05, GLASS, glass=M.g(), name='window'),
               box(x, -0.14, z1 + 0.25, 1.14, 0.05, 1.15, '#F4EEDC', 'wood', name='window frame'),
               box(x, -0.18, z1 + 0.82, 1.0, 0.03, 0.04, '#F4EEDC', 'wood', name='window bar')]
        M.win(x, z1 + 0.8)
    F1 += [box(0, -0.55, z1 + 0.05, 3.2, 0.8, 0.1, '#60402C', 'wood', name='balcony floor')]
    F1 += railing(-1.6, 1.6, -0.93, z1 + 0.15)
    for sx in (-1, 1):
        F1.append(limb((sx * 1.4, -0.1, z1 - 0.45), (sx * 1.4, -0.85, z1 + 0.05), 0.03, '#60402C', 'wood',
                       name='balcony bracket'))
    L += turned(F1, 0, D, 3 * DEG)
    # the top floor, smaller, turned the other way: terracotta, portholes, a little balcony, the upswept roof
    w2, d2 = 3.6, 2.4
    F2 = [box(0, D, z2, w2 + 0.3, d2 + 0.3, 0.15, '#60402C', 'wood', name='floor band'),
          box(0, D, z2 + 0.15, w2, d2, 1.6, TERRA, 'plaster', name='top floor')]
    for x in (-0.9, 0.9):
        F2 += LS.porthole(x, D - d2 / 2 - 0.02, z2 + 0.95, 0.28, M.g())
        M.win(x, z2 + 0.95)
    F2 += [box(0, D - d2 / 2 - 0.35, z2 + 0.08, 1.4, 0.7, 0.08, '#60402C', 'wood', name='balcony floor')]
    F2 += railing(-0.7, 0.7, D - d2 / 2 - 0.68, z2 + 0.16, 0.45)
    F2 += [prism(0, D - d2 / 2 - 0.45, z3, [(-w2 / 2 - 0.5, 0.0), (w2 / 2 + 0.5, 0.0), (w2 / 2 + 0.75, 0.45),
                                          (0.0, 0.85), (-w2 / 2 - 0.75, 0.45)], d2 + 0.9, VERDI, 'standingseam',
                 name='upswept roof', roof=1),
           box(0, D, z3 - 0.1, w2 + 0.9, d2 + 0.9, 0.1, DARK, 'wood', name='eaves')]
    L += turned(F2, 0, D, -4 * DEG)
    # the atomic finial on the ridge, a chimney (smoke) at the back
    L += LS.atomic_finial(0, D, z3 + 0.8, 0.9)
    L += [box(1.9, Dp - 0.6, z1, 0.5, 0.5, z3 - z1 + 0.6, '#B65A44', 'brick', name='chimney'),
          box(1.9, Dp - 0.6, z3 + 0.6, 0.6, 0.6, 0.08, STONE, 'stone', name='chimney cap'),
          cyl(1.9, Dp - 0.6, z3 + 0.68, 0.1, 0.2, COPPER, 'metal', sides=8, name='chimney pot')]
    M.smoke = (1.9, z3 + 1.2)
    # the teacup sign by the door; the INN board on the balcony rail
    L += teacup_sign(-1.25, -0.02, z1 - 0.7)
    L += word_board(0.8, -1.0, z1 + 0.22, 'INN', '#7A4E34', '#F8E8B0', '#3A2418')  # hung on the balcony rail
    # C's showpieces: string lights from the balcony to a post by the tree; the blossom street tree
    L += string_lights((-1.6, -0.93, z1 + 0.7), (-2.75, -1.1, 2.4), 6, 0.22)
    L += string_lights((1.6, -0.93, z1 + 0.7), (2.75, -0.1, 2.0), 6, 0.2)
    L += [limb((2.75, -0.1, 0.2), (2.75, -0.1, 2.05), 0.03, DARK, 'metal', name='light post')]
    L += blossom_tree(-2.75, -1.1, 1.15)
    L += LS.flower_box(-0.8, -0.98, z1 + 0.2, 1.1, ['#F07090', '#F4D99A'])
    # side and back windows
    for sx in (-1, 1):
        L += [box(sx * (W / 2 + 0.01), D, 0.9, 0.04, 0.8, 0.8, GLASS, glass=M.g(), name='side window')]
    L += [box(0, Dp + 0.01, 0.9, 0.9, 0.04, 0.8, GLASS, glass=M.g(), name='back window')]
    H = z3 + 1.7
    return {'about': 'BD-5: the inn and cafe, stacked and turned floors (look B, C showpieces)',
            'warp': warp(1.0, H, 0.03, 0.06), 'layers': L}, M


# ------------------------------------------------------------------------------------------------------- the library
def drawer_front(x, y, z, w, h, cols, rows, col):
    """a wall of filing drawers: panels in a frame, each with a brass pull and a label plate"""
    L = [box(x, y + 0.02, z, w + 0.1, 0.05, h + 0.1, '#60402C', 'wood', name='drawer frame')]
    dw, dh = w / cols, h / rows
    for i in range(cols):
        for j in range(rows):
            cx, cz = x - w / 2 + (i + 0.5) * dw, z + j * dh
            L.append(box(cx, y - 0.01, cz + 0.03, dw - 0.06, 0.04, dh - 0.06, col, 'wood', name='drawer'))
            if (i + j) % 2 == 0 or rows < 3:
                L.append(box(cx, y - 0.04, cz + dh * 0.62, dw * 0.36, 0.02, 0.07, '#F4EEDC', name='drawer label'))
            L.append(box(cx, y - 0.05, cz + dh * 0.38, dw * 0.3, 0.03, 0.035, BRASS, 'metal', name='drawer pull'))
    return L


def clock(x, y, z, r):
    """a round clock face, its brass rim, numerals as ticks and two hands (ten past ten)"""
    L = [disc(x, y + 0.02, z, r + 0.08, BRASS, 'metal', sides=18, name='clock rim'),
         disc(x, y, z, r, '#FBF4E2', sides=18, name='clock face')]
    for i in range(12):
        a = i * math.pi / 6
        L.append(box(x + 0.82 * r * math.sin(a), y - 0.01, z + 0.82 * r * math.cos(a) - 0.04, 0.03, 0.01, 0.08, DARK,
                     tilt=[0, a], name='clock tick'))
    L += [box(x, y - 0.03, z, 0.05, 0.02, r * 0.55, DARK, 'metal', tilt=[0, -60 * DEG], name='hour hand'),
          box(x, y - 0.04, z, 0.035, 0.02, r * 0.8, DARK, 'metal', tilt=[0, 60 * DEG], name='minute hand'),
          sphere(x, y - 0.06, z - 0.04, 0.04, BRASS, 'metal', sides=6, rings=3, name='clock pin')]
    return L


def library():
    """The Bureau's archive on look B (plumb, a soft swell): a cream rotunda in the middle with the big arched door, a
    clock over it and the LIBRARY board; brick wings either side fronted with filing drawers under arched windows; a
    slab roof on the wings; on the rotunda an upswept fan of books for a roof round a copper drum; ivy up the wing
    corners; C's glowing tube along the wings' cornice."""
    M, (W, Dp), dx = Model(), KEEP['library'][0], KEEP['library'][1]
    L = M.L
    D = Dp / 2
    Rr, ry = 1.45, 1.35          # the rotunda's radius and its middle (depth)
    hw = 3.1                      # the wings' wall height
    hr = 4.0                      # the rotunda's wall height
    L += [box(0, D, 0, W + 0.3, Dp + 0.3, 0.2, STONE, 'stone', bevel=0.04, name='plinth'),
          box(0, D + 0.1, 0.2, W, Dp - 0.2, hw, '#C46C54', 'brick', name='wings'),
          cyl(0, ry, 0.2, Rr, hr, CREAM, 'plaster', sides=20, name='rotunda'),
          cyl(0, ry, 0.2, Rr + 0.04, 0.5, '#DCD2BE', 'stone', sides=20, name='rotunda base')]
    # the wings' cornice and slab roof, thick, a dark underside
    L += [box(0, D + 0.1, 0.2 + hw, W + 0.4, Dp + 0.2, 0.1, DARK, 'wood', name='eaves'),
          box(0, D + 0.1, 0.3 + hw, W + 0.4, Dp + 0.2, 0.2, NAVY, 'slate', bevel=0.05, name='wing roof', roof=1),
          box(0, -0.12, 0.2 + hw - 0.25, W + 0.1, 0.12, 0.22, '#ECE6DA', 'stone', name='cornice')]
    # filing drawers along each wing's front, arched windows over them
    for sx in (-1, 1):
        cx = sx * 1.95
        L += drawer_front(cx, 0.08, 0.35, 1.3, 1.25, 3, 4, '#B07A50')
        L += arch_window(cx, 0.1, 1.85, 0.75, 1.0, M.g(), frame='#ECE6DA')
        M.win(cx, 2.3)
    # the rotunda's door, the steps, the LIBRARY board and the clock over them
    fy = ry - Rr  # the rotunda's front
    L += [prism(dx, fy - 0.03, 0.2, arch(1.5, 2.35, 8), 0.06, '#DCD2BE', 'stone', name='door arch'),
          prism(dx, fy - 0.07, 0.2, arch(1.2, 2.2, 8), 0.06, '#7A4E34', 'wood', name='door'),
          box(dx, fy - 0.1, 0.2, 0.04, 0.03, 2.1, '#5A3A28', 'wood', name='door split'),
          sphere(dx - 0.14, fy - 0.13, 1.1, 0.04, BRASS, 'metal', sides=6, rings=3, name='door ring'),
          sphere(dx + 0.14, fy - 0.13, 1.1, 0.04, BRASS, 'metal', sides=6, rings=3, name='door ring')]
    for i, (w_, d_) in enumerate(((2.4, 0.95), (2.0, 0.7), (1.6, 0.45))):
        L.append(box(dx, fy - d_ / 2 + 0.05, i * 0.08, w_, d_, 0.08, '#BDB9C6', 'stone', name='step'))
    L += word_board(dx, fy - 0.08, 2.62, 'LIBRARY', '#2E4A44', '#F8E8B0', '#1A2A26')
    L += clock(dx, fy - 0.05, 3.62, 0.36)
    # windows round the rotunda's sides
    for a in (-55, 55):
        x, y = Rr * math.sin(a * DEG), ry - Rr * math.cos(a * DEG)
        L.append(box(x, y, 2.6, 0.45, 0.04, 0.85, GLASS, glass=M.g(), rot=r3(a * DEG), name='rotunda window'))
        L.append(box(x, y + 0.02, 2.55, 0.57, 0.05, 0.95, '#ECE6DA', 'wood', rot=r3(a * DEG), name='rotunda frame'))
        M.win(x, 3.0)
    # the roof: a copper drum, then an upswept fan of books leaning out from it, a brass finial
    zt = 0.2 + hr
    L += [cyl(0, ry, zt, Rr + 0.18, 0.12, DARK, 'wood', sides=20, name='rotunda eaves'),
          cyl(0, ry, zt + 0.12, Rr + 0.1, 0.18, COPPER, 'standingseam', sides=20, name='rotunda roof', roof=1),
          cyl(0, ry, zt + 0.3, 0.55, 0.55, COPPER, 'standingseam', sides=12, name='drum', roof=1),
          lathe(0, ry, zt + 0.85, [(0.62, 0), (0.4, 0.2), (0.08, 0.32), (0, 0.33)], VERDI, 'metal', sides=12,
                name='drum cap', roof=1)]
    books = ['#C8603E', '#2E7F8A', '#D8B048', '#3E5288', '#8C5AA0', '#5E9A48', '#D4483E', '#2E7F8A', '#C8603E']
    for i, c in enumerate(books):
        a = (-60 + i * 15) * DEG
        hb = 1.35 + 0.25 * math.cos(a * 1.6)
        bx, bd = 0.62 * math.sin(a), 1.3 - 0.1 * (i % 2)
        L.append(box(bx, ry, zt + 0.3, 0.28, bd, hb, c, 'wood', tilt=[0, a], name='book'))
        for k in (0.18, 0.78):  # two gilt bands across the spine, up the book's own (tilted) length
            L.append(box(bx + k * hb * math.sin(a), ry - bd / 2 - 0.01, zt + 0.3 + k * hb * math.cos(a), 0.29, 0.03,
                         0.06, BRASS, 'metal', tilt=[0, a], name='spine band'))
    L += LS.atomic_finial(0, ry, zt + 1.15, 0.6)[:2]
    # ivy up the wings' outer corners and round the rotunda's foot
    L += LS.ivy(-W / 2 + 0.05, 0.05, 0.3, 3.2, 1) + LS.ivy(W / 2 - 0.05, 0.05, 0.3, 2.6, -1)
    for x in (-1.0, 1.0):
        L.append(sphere(x, fy + 0.15, 0.2, 0.32, LEAF, 'leaves', sides=7, rings=4, lump=0.25, name='shrub'))
    # C's showpiece: a glowing tube under the wings' cornice, lamps either side of the steps
    for sx in (-1, 1):
        L.append(limb((sx * 1.2, -0.03, 0.2 + hw - 0.32), (sx * (W / 2 - 0.1), -0.03, 0.2 + hw - 0.32), 0.035,
                      '#E0FAFF', 'plain', sides=6, glow=NEON_T, name='glowing tube'))
        L += LS.lamp(sx * 1.25, fy + 0.25, 2.0)
        M.glows.append((sx * 1.25, 1.8))
    # side and back windows
    for sx in (-1, 1):
        L += [box(sx * (W / 2 + 0.01), D, 1.4, 0.04, 0.9, 1.0, GLASS, glass=M.g(), name='side window')]
    L += [box(sx * 1.9, Dp + 0.01, 1.4, 0.9, 0.04, 1.0, GLASS, glass=M.g(), name='back window') for sx in (-1, 1)]
    return {'about': "BD-5: the library, the Bureau's archive (look B, C showpieces)", 'warp': warp(0, 6, 0.02, 0.03),
            'layers': L}, M


# ----------------------------------------------------------------------------------------------------------- the lab
LAB_WINDOW = 'scene/next/decals/lab_window.png'  # the drawn view inside the big window (batch 3's decal, kept)


def lab():
    """Professor Hazel's lab on look B (plumb, a soft swell): white panels on a lavender plinth, a teal band with a
    glowing pneumatic tube along it, the big window onto the lab (the drawn view kept), the teal glass doors; on the
    roof an observatory dome with its slit open and a telescope looking out, a radio dish, and at the back corner a
    copper tower with a glowing ring; Kappi's corner by the window (a porthole nook, a bench and a cushion); C's
    showpiece: a copper rocket chimney."""
    M, (_, Dp), dx = Model(), KEEP['lab'][0], KEEP['lab'][1]
    L = M.L
    w = 6.25
    D = Dp / 2
    ht = 3.6
    LAV, PANEL = '#A698CC', '#EAEEEC'
    L += [box(0, D, 0, w + 0.24, Dp + 0.24, 0.26, '#9A8CC0', 'brick', bevel=0.04, name='plinth'),
          box(0, D, 0.26, w, Dp, ht - 0.26, PANEL, 'panels', bevel=0.05, name='walls'),
          box(0, D, 1.2, w + 0.06, Dp + 0.06, 0.12, TEAL, 'metal', name='teal band'),
          limb((-w / 2 + 0.1, -0.08, 1.02), (0.6, -0.08, 1.02), 0.04, '#E0FAFF', 'plain', sides=6,
               glow=NEON_T, name='pneumatic tube'),
          limb((0.6, -0.08, 1.02), (0.6, -0.08, 0.26), 0.04, '#E0FAFF', 'plain', sides=6, glow=NEON_T,
               name='pneumatic tube'),
          sphere(0.6, -0.08, 0.97, 0.06, BRASS, 'metal', sides=6, rings=3, name='tube elbow')]
    for sx in (-1, 1):
        L.append(box(sx * (w / 2 - 0.02), 0.03, 0.26, 0.1, 0.1, ht - 0.26, '#D6DADC', 'metal', name='corner trim'))
    # the roof: teal trim, a lavender tiled edge round a flat roof
    L += [box(0, D, ht, w + 0.4, Dp + 0.4, 0.16, TEAL, 'metal', name='roof trim'),
          box(0, D, ht + 0.16, w + 0.3, Dp + 0.3, 0.14, LAV, 'tilewall', name='roof edge'),
          box(0, D, ht + 0.16, w - 0.1, Dp - 0.1, 0.16, '#C8C2D8', 'plain', name='roof', roof=1)]
    rt = ht + 0.32
    # the observatory dome over the left half: a drum, a white dome, the slit open (a dark band) and the telescope
    ox, oy, orr = -1.5, D, 1.2
    L += [cyl(ox, oy, rt, orr + 0.05, 0.55, '#D6DADC', 'riveted', sides=20, name='dome drum'),
          cyl(ox, oy, rt + 0.5, orr + 0.12, 0.08, TEAL, 'metal', sides=20, name='dome ring'),
          lathe(ox, oy, rt + 0.58, [(orr, 0)] + [(orr * math.cos(a), orr * math.sin(a))
                                                 for a in [i * math.pi / 12 for i in range(1, 6)]] + [(0, orr)],
                PANEL, 'standingseam', sides=20, name='observatory dome', roof=1),
          ] + dome_band(ox, oy, rt + 0.58, orr + 0.015, orr - 0.06, 0.42, '#2A2440', 'dome slit')
    L += [dome_band(ox + sx * 0.24, oy, rt + 0.58, orr + 0.05, orr - 0.02, 0.06, TEAL, 'slit rail')[0] for sx in (-1, 1)]
    # the telescope looks out of the slit, up at 50 degrees
    tel = (ox, oy - 1.05 * math.cos(50 * DEG), rt + 0.95 + 1.6 * math.sin(50 * DEG))
    L += [limb((ox, oy + 0.15, rt + 0.75), tel, 0.13, BRASS, 'metal', sides=10, name='telescope') | {'r1': 0.17},
          lathe(*tel, [(0.18, 0), (0.2, 0), (0.2, 0.08), (0.18, 0.08), (0.18, 0)], DARK, 'metal', sides=10,
                tilt=[-40 * DEG, 0], name='telescope rim')]
    # the radio dish on the right, tipped up toward the sky, its feed glowing
    rx, ryy = 0.9, D + 0.2
    dish = [(0, 0), (0.25, 0.02), (0.5, 0.08), (0.7, 0.18), (0.78, 0.24), (0.74, 0.25), (0.48, 0.12), (0.0, 0.04)]
    L += [box(rx, ryy, rt, 0.4, 0.4, 0.1, '#8A90A0', 'metal', name='dish foot'),
          cyl(rx, ryy, rt + 0.1, 0.08, 0.6, '#8A90A0', 'metal', sides=8, name='dish post'),
          lathe(rx, ryy, rt + 0.7, dish, '#F4F0E8', 'metal', sides=16, tilt=[-35 * DEG, 0], name='radio dish'),
          limb((rx, ryy, rt + 0.75), (rx, ryy - 0.42, rt + 1.35), 0.02, '#5E6474', 'metal', name='feed arm'),
          sphere(rx, ryy - 0.42, rt + 1.3, 0.07, '#FFE9B0', sides=8, rings=4, glow={'col': NEON_A, 'day': 1},
                 name='feed')]
    # the copper tower at the back right: a tapering lathe, a glowing ring, a ball tip
    tx, ty = 2.45, Dp - 0.55
    tower = [(0.42, 0), (0.36, 1.2), (0.28, 2.3), (0.2, 3.1), (0.12, 3.5), (0.0, 3.55)]
    L += [lathe(tx, ty, rt, tower, COPPER, 'standingseam', sides=10, name='copper tower', roof=1),
          lathe(tx, ty, rt + 2.4, [(0.5, 0), (0.56, 0), (0.56, 0.08), (0.5, 0.08), (0.5, 0)], '#E0FAFF', 'plain',
                sides=16, glow={'col': NEON_T, 'day': 1}, name='glowing ring'),
          lathe(tx, ty, rt + 2.36, [(0.25, 0), (0.5, 0.06), (0.25, 0.12)], VERDI, 'metal', sides=10, name='ring hub'),
          sphere(tx, ty, rt + 3.5, 0.12, BRASS, 'metal', sides=8, rings=4, name='tower ball'),
          limb((tx, ty, rt + 3.6), (tx, ty, rt + 4.2), 0.015, '#8C8C98', 'metal', name='tower spike'),
          sphere(tx, ty, rt + 4.2, 0.05, '#FFE0E8', sides=6, rings=3, glow={'col': NEON_P, 'day': 1}, name='beacon')]
    # C's showpiece: a copper rocket chimney with fins, at the back left (smoke)
    cx_, cy_ = -2.75, Dp - 0.45
    L += [lathe(cx_, cy_, rt, [(0.2, 0), (0.24, 0.5), (0.22, 1.0), (0.14, 1.25), (0.1, 1.3)], COPPER, 'metal',
                sides=10, name='rocket chimney'),
          cyl(cx_, cy_, rt + 1.3, 0.11, 0.12, DARK, 'metal', sides=8, name='chimney mouth')]
    for a in (0, 120, 240):
        L.append(prism(cx_, cy_, rt, [(0.18, 0), (0.45, 0), (0.22, 0.55)], 0.04, TEAL, 'metal', rot=r3(a * DEG),
                       name='rocket fin'))
    M.smoke = (cx_, rt + 1.7)
    # planters along the roof's front edge
    for x in (0.0, 2.3):
        L.append(box(x, 0.45, rt, 0.7, 0.36, 0.26, '#7A5A3C', 'wood', name='roof planter'))
        for j in range(3):
            L.append(sphere(x - 0.22 + j * 0.22, 0.45, rt + 0.2, 0.14, LEAF if j % 2 else LEAF2, 'leaves', sides=8,
                            rings=4, name='roof plant'))
    # the big window: the drawn view inside, a slim white frame with mullions, a sill
    wx, ww, wz0, wh = -0.85, 108 / PPM, 1.5, 41 / PPM
    L.append(B1.img(LAB_WINDOW, wx, -0.05, wz0, face='fixed', recv=0, name='window view'))
    L += [box(wx, -0.03, wz0 - 0.08, ww + 0.16, 0.06, 0.08, '#F4F4F6', 'metal', name='window frame'),
          box(wx, -0.03, wz0 + wh, ww + 0.16, 0.06, 0.08, '#F4F4F6', 'metal', name='window frame'),
          box(wx - ww / 2 - 0.04, -0.03, wz0, 0.08, 0.06, wh, '#F4F4F6', 'metal', name='window frame'),
          box(wx + ww / 2 + 0.04, -0.03, wz0, 0.08, 0.06, wh, '#F4F4F6', 'metal', name='window frame')]
    for i in (1, 2, 3):
        L.append(box(wx - ww / 2 + ww * i / 4, -0.06, wz0, 0.05, 0.04, wh, '#F4F4F6', 'metal', name='mullion'))
    L.append(box(wx, -0.12, wz0 - 0.12, ww + 0.25, 0.22, 0.08, '#D6DADC', 'metal', name='window sill'))
    M.win(wx, wz0 + wh / 2)
    # the doors: a teal frame, two glass leaves, a lamp over them, a step and a mat
    dw, dh = 1.22, 1.75
    L += [box(dx, -0.05, 0.26, dw + 0.2, 0.1, dh + 0.12, TEAL, 'metal', name='door frame'),
          box(dx, -0.08, 0.26, dw, 0.04, dh, '#9BD2DA', glass=M.g(), name='door glass'),
          box(dx, -0.1, 0.26, 0.06, 0.04, dh, TEAL, 'metal', name='door middle'),
          box(dx, -0.1, 0.26 + dh - 0.04, dw, 0.04, 0.06, TEAL, 'metal', name='door top'),
          box(dx, -0.12, 2.25, 0.45, 0.12, 0.14, '#FFDE78', glow={'col': '#FFC860'}, name='door lamp'),
          box(dx, -0.35, 0, dw + 0.5, 0.7, 0.12, '#BDB9C6', 'stone', name='door step'),
          box(dx, -0.35, 0.12, dw - 0.1, 0.5, 0.02, '#5E6474', 'cloth', name='door mat')]
    for sx in (-1, 1):
        L.append(box(dx + sx * 0.1, -0.12, 0.26 + dh * 0.45, 0.03, 0.03, 0.3, '#D6DADC', 'metal', name='door handle'))
    M.win(dx, 1.1)
    M.glows.append((dx, 2.3))
    # a Googie canopy over the doors
    L += [prism(dx, -0.6, 2.42, [(-0.8, 0), (0.8, 0), (1.0, 0.22), (0.8, 0.1), (-0.8, 0.1), (-1.0, 0.22)], 0.6, TEAL,
                'metal', name='door canopy')]
    # Kappi's corner, between the window and the doors: a porthole at Kappi's height, a little bench with a round
    # cushion, a tiny lamp and a pot of herbs
    kx = 1.0
    L += LS.porthole(kx, -0.02, 0.95, 0.2, M.g())
    M.win(kx, 0.95)
    L += [box(kx, -0.25, 0.26, 0.6, 0.36, 0.06, WOOD, 'wood', name="Kappi's bench"),
          box(kx - 0.24, -0.25, 0, 0.06, 0.3, 0.26, WOOD, 'wood', name='bench leg'),
          box(kx + 0.24, -0.25, 0, 0.06, 0.3, 0.26, WOOD, 'wood', name='bench leg'),
          cyl(kx, -0.25, 0.32, 0.17, 0.07, '#F07090', 'cloth', sides=10, name="Kappi's cushion"),
          lathe(kx, -0.04, 1.35, [(0.16, 0), (0.1, 0.06), (0.0, 0.08)], TEAL, 'metal', sides=8, name='nook hood'),
          sphere(kx, -0.1, 1.24, 0.05, '#FFE9B0', sides=6, rings=3, glow={'col': '#FFC860'}, name='nook lamp')]
    L += [cyl(-3.0, -0.3, 0, 0.18, 0.3, TEAL, 'metal', sides=10, name='pot'),
          sphere(-3.0, -0.3, 0.25, 0.25, LEAF, 'leaves', sides=7, rings=4, lump=0.25, name='herbs')]
    M.glows.append((kx, 1.25))
    # side and back windows
    for sx in (-1, 1):
        L += [box(sx * (w / 2 + 0.01), D, 1.65, 0.04, 1.2, 0.9, GLASS, glass=M.g(), name='side window'),
              box(sx * (w / 2 + 0.02), D, 1.6, 0.05, 1.3, 0.06, '#F4F4F6', 'metal', name='side sill')]
    L += [box(x, Dp + 0.01, 1.65, 1.3, 0.04, 0.9, GLASS, glass=M.g(), name='back window') for x in (-1.6, 1.6)]
    return {'about': "BD-5: Professor Hazel's lab, an observatory (look B, C showpiece)", 'warp': warp(0, 8, 0.02, 0.02),
            'layers': L}, M


def dome_band(x, y, z, r0, r1, w, col, name):
    """a band lying on a dome's front, from its foot over toward the top (the slit and its rails): an arc profile
    across the depth, drawn out w wide across (a prism turned a quarter)"""
    A = [a * DEG for a in range(8, 101, 12)]
    pts = [(-r0 * math.cos(a), r0 * math.sin(a)) for a in A] + [(-r1 * math.cos(a), r1 * math.sin(a)) for a in A[::-1]]
    return [prism(x + w / 2, y, z, pts, w, col, rot=r3(math.pi / 2), name=name)]


BUILDINGS = {'shop': shop, 'inn': inn, 'library': library, 'lab': lab}


# ------------------------------------------------------------------------------------------------------ the pictures
def triangles(paths):
    """the recipes' triangles as the game makes them (tools/model-triangles.mjs)"""
    out = subprocess.run(['node', str(ROOT / 'tools/model-triangles.mjs'), *map(str, paths)], cwd=ROOT, check=True,
                         capture_output=True, text=True).stdout
    return {Path(o['file']).stem: [tuple(t) for t in o['tris']] for o in json.loads(out)}


def bake(key, T):
    """the model's picture with the island batch's baker, given the game's own triangles; in scene/next/hub"""
    was, was_pics = ISL.mesh, ISL.PICS
    ISL.mesh, ISL.PICS = (lambda _L: T), PICS
    try:
        return ISL.bake({'layers': [1]}, key)
    finally:
        ISL.mesh, ISL.PICS = was, was_pics


def main():
    D = gamedata.load()
    C = D['scenery']['props']
    built = {}
    for key, fn in BUILDINGS.items():
        rec, M = fn()
        rec = {'ppm': PPM, 'cel': 0.62, **{k: v for k, v in rec.items() if v is not None}}
        rec['layers'] = sorted(rec['layers'], key=lambda l: l['k'] == 'img')
        built[key] = (B1.write_recipe(key, rec), M)
    T = triangles([B1.ART / p for p, _ in built.values()])
    for key, (path, M) in built.items():
        P = C[key]
        img, ox, oy = bake(key, T[key])
        P.update({'model': path, 'img': img, 'ox': ox, 'oy': oy, 'ppm': PPM, 'fx': M.fx(),
                  'box': KEEP[key][0], 'door': {'x': px(KEEP[key][1]), 'y': 0},
                  'vary': {'rot': 0, 'lean': 0, 'size': 0}})
        for f in ('build', 'layers', 'vol', 'volDepth', 'variants'):
            P.pop(f, None)
        print(f'{key}: {len(T[key])} triangles, {M.glass} glass, picture {img}')
    gamedata.save(D)


if __name__ == '__main__':
    main()
