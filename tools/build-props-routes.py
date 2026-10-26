#!/usr/bin/env python3
"""Route props track (docs/phases/route-props-track.md): more props for the run routes, low-poly at 32 px to the metre
in the style of phase 09's batches (tools/build-props-batch1.py .. batch11b.py and the island's).

  swapped in under their own keys (the last standing pictures the set pieces place; the pictures stay as the
  fallback when 3D props are off):
          firewood, firewood_b, scrap, statue, tires, tollbooth
  new (each with a picture baked from its model, scene/next/routes/<key>.png, the fallback and the far view):
    crossings  footbridge_wood, stile, pier_deck
    ruins      pillar_broken, arch_ruin, wall_ruin_corner
    wayside    milestone, waymarker_post, shrine_small (a stone niche, a solar cell on its roof, a glowing seed)
    farm       haystack, rain_barrel, water_pump, beehive_stand, tool_shed, veg_patch_frame
    solarpunk  wind_turbine_small, solar_post_light, seed_library_box
    Bureau     bureau_barrier, bureau_crate (no logo: the Bureau's look is the owner's call)

    python3 tools/build-props-routes.py      (after batches 1-11 and the island's; rerunnable)

Writes game/art/scene/next/models/<key>.json, the baked pictures, the catalogue entries in game/data/scenery.json and
the showcase map test_props_routes. The set pieces that use them are data (game/data/setPieces.json).
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
BI = load('island', 'build-props-island.py')
PPM, A = B1.PPM, B1.AIR
box, limb, disc, sphere, cyl, img, r2 = B1.box, B1.limb, B1.disc, B1.sphere, B1.cyl, B1.img, B1.r2
stone, plank, rec, ring = BI.stone, BI.plank, BI.rec, B4.ring
BI.PICS = B1.ART / 'scene' / 'next' / 'routes'  # where new_prop bakes this script's pictures
FIXED = {'rot': 0, 'lean': 0}
OLD_PPM = 34

BARK, END, END_L = '#96684A', '#DBB27E', '#EBD3B3'
STONE, STONE_D, STONE_L = '#AAA6B4', '#8C8698', '#C8C4D4'
MOSS, MOSS_L = '#76AA50', '#9FC073'
LEAF, LEAF2 = B4.LEAF, B4.LEAF2
TIRE, TIRE_D, HUB = '#4E4C5C', '#3A3550', '#837E7B'
RUST, RUST_D, RUST_L = '#C47046', '#904F47', '#D6A26C'
STATUE, STATUE_L, STATUE_D = '#D0CCD6', '#DED8D1', '#98929F'
CREAM, TAN, TAN_D = '#E2D2A4', '#D6C496', '#9D8C7C'
RED, RED_D, NAVY = '#DE4048', '#B0303C', '#465470'
GLASS = '#70C4E4'
HAY, HAY_D = BI.HAY, BI.HAY_D
SOLAR = '#3E5A8C'
SLATE, SLATE_D, MUSTARD = '#7E8496', '#5E6274', '#E0B040'
WHITE = '#F4F0E8'


# ================================================================ swapped in: the set pieces' last pictures
def logs_end_on(L, x, z, r, d, col=BARK, name='log'):
    """A log lying end on to the camera (along y, front at y=-d/2), its sawn end showing its rings."""
    L += [limb((x, -d / 2 + 0.02, z), (x, d / 2, z), r, r * 0.95, col, 'bark', name, 8),
          disc(x, -d / 2 + 0.02, z, (0, -1, 0), r * 0.86, 0.02, END, 'rings', name + ' end', 8)]


def firewood():
    """A stack of split logs between two stakes, end on to the road: four rows, the top one shorter."""
    d, r = 0.6, 0.12
    L = []
    for row, n in enumerate((6, 5, 6, 5)):
        for i in range(n):
            x = (i - (n - 1) / 2) * 0.27 + ((row * 7 + i * 3) % 5 - 2) * 0.01
            logs_end_on(L, x, r + row * 0.22, r * (0.92 + 0.08 * ((i + row) % 3) / 2), d, BARK if (i + row) % 3 else '#7A5444')
    for sx in (-1, 1):
        L.append(box(sx * 0.86, 0, 0, 0.08, 0.08, 0.98, A['dwood'], 'wood', 'stake'))
    return rec(B1.shift_y(L, d / 2))


def firewood_b():
    """A woodpile beside a chopping stump: three rows of logs, an axe sunk in the stump, a few chips."""
    L = []
    for row, n in enumerate((5, 4, 3)):
        for i in range(n):
            logs_end_on(L, -0.55 + (i - (n - 1) / 2) * 0.26, 0.12 + row * 0.21, 0.115, 0.55)
    L += [cyl(0.95, 0.05, 0, 0.36, 0.52, BARK, 'bark', 'chopping stump', 12),
          cyl(0.95, 0.05, 0.52, 0.34, 0.02, END, 'rings', 'stump top', 12),
          limb((1.0, 0.0, 0.54), (1.38, -0.2, 0.92), 0.025, 0.022, A['plank'], 'wood', 'axe handle', 5),
          box(0.98, 0.02, 0.5, 0.2, 0.04, 0.1, '#8E8A98', 'metal', 'axe head'),
          sphere(0.78, -0.3, 0.42, 0.1, MOSS, 'leaves', 'moss', 7, 3, 0.35, h=0.1)]
    for x, y in ((0.4, -0.45), (1.45, -0.35), (0.65, -0.55)):
        L.append(box(x, y, 0, 0.1, 0.05, 0.03, END_L, 'wood', 'chip'))
    return rec(L)


def tire(L, x, y, z, r=0.36, h=0.22, name='tire'):
    L += [cyl(x, y, z, r, h, TIRE, 'plain', name, 14),
          cyl(x, y, z + h * 0.35, r + 0.02, h * 0.3, TIRE_D, 'plain', name + ' tread', 14),
          cyl(x, y, z + h, r * 0.55, 0.01, '#2A2638', 'plain', name + ' hole', 12)]


def tires():
    """Three tyres stacked a little askew, a puddle of rainwater in the top one."""
    L = []
    for i, (dx, dy) in enumerate(((0, 0), (0.04, -0.02), (-0.03, 0.02))):
        tire(L, dx, dy, i * 0.23, name=f'tire {i + 1}')
    L.append(cyl(-0.03, 0.02, 0.68, 0.17, 0.01, '#6E96AE', 'plain', 'rainwater', 10))
    return rec(L)


def scrap():
    """A scrap heap: a mound of rubble, a corrugated sheet propped up, a rusty drum on its side, a teal pipe, a cog,
    a broken crate and two tyres at its foot."""
    L = [{**sphere(0, 0.1, -0.3, 1.45, '#9D8C7C', 'rock', 'heap', 9, 4, 0.25, h=1.0), 'ry': 0.95, 'facet': 1}]
    for i, (x, y, z) in enumerate(((-0.6, -0.5, 0.25), (0.4, -0.6, 0.2), (0.0, -0.2, 0.55), (0.9, -0.1, 0.35))):
        L.append(stone(x, y, z, 0.18, 0.2, ('#807990', '#AAA6B4', '#766879', '#9C8C92')[i], 'rubble', sides=5, rings=2))
    L += [box(-0.75, 0.15, 0.1, 0.9, 0.06, 1.15, '#B4AEC0', 'corrugated', 'corrugated sheet'),
          box(-0.75, 0.11, 0.55, 0.18, 0.02, 0.18, RUST, 'rust', 'rust patch'),
          limb((0.05, -0.05, 0.62), (0.85, 0.15, 0.6), 0.27, 0.27, RUST, 'rust', 'drum', 10),
          disc(0.05, -0.05, 0.62, (-1, -0.25, 0), 0.25, 0.02, RUST_D, 'rust', 'drum end', 10),
          limb((0.3, -0.3, 0.95), (1.45, -0.05, 0.42), 0.09, 0.09, '#2EA4A0', 'metal', 'pipe', 8),
          cyl(0.35, 0.25, 1.05, 0.28, 0.07, '#AAA6B4', 'metal', 'cog', 8),
          cyl(0.35, 0.25, 1.1, 0.08, 0.04, '#807990', 'metal', 'cog hub', 6)]
    for i in range(8):
        a = i * math.pi / 4
        L.append(box(0.35 + math.cos(a) * 0.32, 0.25 + math.sin(a) * 0.32, 1.05, 0.1, 0.1, 0.07, '#AAA6B4', 'metal', 'cog tooth'))
    L += [box(0.05, -0.85, 0, 0.5, 0.42, 0.42, A['plank'], 'wood', 'broken crate'),
          box(0.05, -1.07, 0.16, 0.5, 0.02, 0.06, A['wood'], 'wood', 'crate slat')]
    tire(L, -0.95, -0.75, 0, 0.32, 0.2, 'tire')
    tire(L, 1.05, -0.7, 0, 0.3, 0.2, 'tire')
    return rec(L)


def statue():
    """A creature statue on a plinth: a round, smiling, big-eared stone beast with its paws over the edge and a stone
    sprout on its head (now really sprouting), a gold leaf set in the plinth's face."""
    L = [box(0, 0, 0, 1.3, 1.0, 0.16, STATUE_D, 'stone', 'plinth foot'),
         box(0, 0, 0.16, 1.1, 0.82, 1.0, STATUE, 'stone', 'plinth'),
         box(0, 0, 1.16, 1.3, 1.0, 0.16, STATUE_L, 'stone', 'plinth top'),
         box(0, -0.42, 0.42, 0.72, 0.02, 0.42, STATUE_L, 'stone', 'panel'),
         {**sphere(0, -0.44, 0.63, 0.12, '#F2C84C', 'metal', 'gold leaf', 8, 3, h=0.16), 'ry': 0.04}]
    z = 1.32
    L += [{**sphere(0, 0.08, z - 0.05, 0.56, STATUE, 'stone', 'body', 12, 6), 'h': 1.0},
          sphere(0, -0.02, z + 0.78, 0.5, STATUE, 'stone', 'head', 12, 6)]
    for sx in (-1, 1):
        L += [sphere(sx * 0.42, 0.0, z + 1.18, 0.2, STATUE, 'stone', 'ear', 10, 5),
              sphere(sx * 0.42, -0.08, z + 1.18, 0.12, STATUE_L, 'stone', 'ear inside', 8, 4),
              {**sphere(sx * 0.28, -0.46, z - 0.02, 0.17, STATUE_L, 'stone', 'paw', 8, 4), 'h': 0.2},
              limb((sx * 0.17, -0.47, z + 0.82), (sx * 0.08, -0.48, z + 0.84), 0.02, 0.02, STATUE_D, 'plain', 'shut eye', 4)]
    L += [limb((0.0, -0.49, z + 0.66), (0.0, -0.49, z + 0.64), 0.03, 0.03, STATUE_D, 'plain', 'smile', 4),
          limb((0.45, 0.4, z + 0.1), (0.72, 0.25, z + 0.55), 0.09, 0.06, STATUE, 'stone', 'tail'),
          limb((0.72, 0.25, z + 0.55), (0.6, 0.15, z + 0.8), 0.06, 0.04, STATUE, 'stone', 'tail tip'),
          limb((0, -0.02, z + 1.25), (0, -0.02, z + 1.42), 0.025, 0.02, '#5E9A48', 'plain', 'sprout stem', 5),
          {**sphere(-0.09, -0.02, z + 1.42, 0.09, LEAF2, 'leaves', 'sprout leaf', 6, 3), 'h': 0.06},
          {**sphere(0.09, -0.02, z + 1.45, 0.09, LEAF, 'leaves', 'sprout leaf', 6, 3), 'h': 0.06},
          sphere(-0.48, -0.36, 1.33, 0.08, MOSS, 'leaves', 'moss', 6, 3, 0.35, h=0.06)]
    return rec(L)


def tollbooth():
    """The tollbooth of its picture: a cream booth with a big window and its red FLAT TAX board (the drawing kept: its
    lettering reads better drawn), a navy post to its right and a red and white barrier arm across the way."""
    w, d, h = 1.9, 1.4, 2.2
    L = [box(0, 0, 0, w, d, 0.12, TAN_D, 'stone', 'kerb'),
         box(0, 0, 0.12, w - 0.1, d - 0.1, h - 0.12, CREAM, 'siding', 'booth'),
         box(0.62, 0.0, 0.12, 0.5, d - 0.06, h - 0.12, TAN, 'siding', 'booth side'),
         box(-0.1, -d / 2 + 0.03, 0.95, 1.1, 0.04, 0.95, GLASS, 'plain', 'window') | {'glass': 3},
         box(-0.1, -d / 2 + 0.01, 0.92, 1.18, 0.04, 0.05, WHITE, 'plain', 'sill'),
         box(-0.1, -d / 2 + 0.0, 1.42, 0.04, 0.04, 0.48, WHITE, 'plain', 'mullion'),
         box(0, 0, h, w + 0.14, d + 0.14, 0.42, RED, 'plain', 'sign band'),
         box(0, 0, h + 0.42, w + 0.2, d + 0.2, 0.08, WHITE, 'plain', 'roof')]
    sign = B1.decal('tollbooth', (88, 9, 154, 22), 'tollbooth_sign')
    L.append(img(sign, 0, -d / 2 - 0.09, h + 0.02, face='fixed', s=round(PPM / OLD_PPM, 3), name='FLAT TAX'))
    px = 1.32
    L += [box(px, -0.1, 0, 0.22, 0.22, 1.12, NAVY, 'metal', 'barrier post'),
          box(px, -0.1, 0.78, 0.3, 0.3, 0.3, '#3A4460', 'metal', 'barrier hinge box')]
    for i in range(9):  # the arm, striped
        L.append(box(px + 0.25 + i * 0.26, -0.1, 0.9, 0.26, 0.08, 0.08, RED if i % 2 == 0 else WHITE, 'plain', 'barrier arm'))
    return rec(L)


# ================================================================ new: crossings
def footbridge_wood():
    """A small arched footbridge for a stream: planks across a hump, rails on posts both sides (3.4 m by 1.2 m)."""
    span, half_w, rise = 3.4, 0.6, 0.38
    L = []
    n = 13
    for i in range(n):
        t = i / (n - 1)
        x = -span / 2 + 0.13 + t * (span - 0.26)
        z = rise * math.sin(math.pi * t) + 0.04
        L.append(box(x, 0, z, 0.24, 2 * half_w, 0.06, A['plank'] if i % 2 else '#D6A26C', 'wood', 'plank'))
    for sy in (-1, 1):
        y = sy * (half_w - 0.04)
        pts = []
        for i in range(5):
            t = i / 4
            x = -span / 2 + 0.15 + t * (span - 0.3)
            z = rise * math.sin(math.pi * t)
            L.append(box(x, y, 0, 0.09, 0.09, z + 0.8, A['wood'], 'wood', 'rail post'))
            pts.append([r2(x), r2(y), r2(z + 0.78), 0.035])
        L.append({'k': 'limb', 'pts': pts, 'sides': 5, 'col': A['dwood'], 'tex': 'wood', 'name': 'hand rail'})
        L.append(limb((-span / 2 + 0.1, y, 0.06), (span / 2 - 0.1, y, 0.06), 0.06, 0.06, A['dwood'], 'wood', 'stringer', 4))
    return rec(B1.shift_y(L, half_w))


def stile():
    """A rail fence's length (fence_wood, 2.2 m) with a stile in it: the rails stop at two tall posts, and a step on
    each side lets you climb over. Not solid: you walk through it."""
    L = []
    for x in (-1.0, 1.0):
        L.append(box(x, 0, 0, 0.14, 0.14, 1.0, A['wood'], 'wood', 'fence post'))
    for x0, x1 in ((-1.0, -0.38), (0.38, 1.0)):
        for z in (0.42, 0.78):
            L.append(box((x0 + x1) / 2, 0, z, x1 - x0, 0.06, 0.08, A['plank'], 'wood', 'rail'))
    for x in (-0.38, 0.38):
        L.append(box(x, 0, 0, 0.12, 0.12, 1.25, A['dwood'], 'wood', 'stile post'))
    L += [box(0, 0, 0.62, 0.76, 0.1, 0.07, A['plank'], 'wood', 'top bar'),
          box(0, -0.32, 0.28, 0.62, 0.26, 0.06, '#D6A26C', 'wood', 'step'),
          box(0, 0.32, 0.28, 0.62, 0.26, 0.06, '#D6A26C', 'wood', 'step')]
    for x in (-0.25, 0.25):
        for sy in (-1, 1):
            L.append(box(x, sy * 0.32, 0, 0.06, 0.06, 0.28, A['dwood'], 'wood', 'step leg'))
    L.append(sphere(-0.7, -0.15, 0, 0.13, LEAF, 'leaves', 'tuft', 7, 3, 0.35, 0.18))
    return rec(L)


def pier_deck():
    """A small landing stage on posts, moored beside a jetty: a deck of planks, a bollard, a coil of rope, a lantern
    hook. Placed on water."""
    w, d = 2.2, 1.6
    L = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            L.append(cyl(sx * (w / 2 - 0.1), sy * (d / 2 - 0.1), 0, 0.09, 0.62, A['dwood'], 'wood', 'pile', 8))
    for i in range(8):
        y = -d / 2 + 0.1 + i * (d - 0.2) / 7
        L.append(box(0, y, 0.38, w, 0.19, 0.06, A['plank'] if i % 2 else '#D6A26C', 'wood', 'deck plank'))
    L += [box(0, -d / 2 + 0.02, 0.3, w, 0.05, 0.1, A['wood'], 'wood', 'edge board'),
          cyl(0.7, -0.4, 0.44, 0.09, 0.2, A['iron'], 'metal', 'mooring bollard', 8),
          cyl(0.7, -0.4, 0.62, 0.12, 0.04, A['iron'], 'metal', 'bollard cap', 8),
          ring(-0.55, 0.2, 0.47, 0.18, 0.035, '#C8A060', 'cloth', 'rope coil', 12),
          ring(-0.55, 0.2, 0.51, 0.13, 0.035, '#C8A060', 'cloth', 'rope coil', 12),
          box(-0.95, 0.6, 0.44, 0.08, 0.08, 0.9, A['wood'], 'wood', 'lamp post'),
          limb((-0.95, 0.6, 1.3), (-0.95, 0.35, 1.3), 0.02, 0.02, A['iron'], 'metal', 'hook arm', 4)]
    return rec(L)


# ================================================================ new: ruins
def drum(L, x, y, z, r, h, col, name='drum', sides=10):
    L += [cyl(x, y, z, r, h, col, 'stone', name, sides),
          cyl(x, y, z + h - 0.03, r + 0.03, 0.03, STONE_D, 'stone', name + ' joint', sides)]


def pillar_broken():
    """A broken column: a square base, three drums of its shaft, a jagged break, a fallen drum and moss."""
    L = [box(0, 0, 0, 0.82, 0.82, 0.22, STONE_D, 'stone', 'column base')]
    drum(L, 0, 0, 0.22, 0.3, 0.55, STONE)
    drum(L, 0, 0, 0.77, 0.29, 0.55, STONE_L)
    L += [cyl(0, 0, 1.32, 0.28, 0.32, STONE, 'stone', 'broken drum', 10, k='cone', r1=0.12),
          stone(0.12, 0.05, 1.5, 0.14, 0.24, STONE_L, 'break', sides=5, rings=2),
          limb((0.45, -0.55, 0.24), (1.05, -0.35, 0.24), 0.24, 0.24, STONE, 'stone', 'fallen drum', 10),
          disc(0.45, -0.55, 0.24, (-1, -0.33, 0), 0.22, 0.02, STONE_L, 'stone', 'drum face', 10),
          sphere(-0.3, -0.3, 0.22, 0.13, MOSS, 'leaves', 'moss', 7, 3, 0.35, h=0.12),
          sphere(0.15, -0.28, 0.85, 0.1, MOSS_L, 'leaves', 'moss', 6, 3, 0.35, h=0.08),
          stone(-0.55, -0.45, 0, 0.14, 0.14, STONE_D, 'rubble', sides=5, rings=2)]
    return rec(L)


def arch_ruin():
    """A ruined arch to walk under: two square piers, a round arch of voussoirs with its keystone, a gap where two
    have fallen (on the ground), ivy up one side."""
    half, top, r = 1.3, 2.0, 1.12
    L = []
    for sx in (-1, 1):
        L += [box(sx * half, 0, 0, 0.62, 0.62, 0.2, STONE_D, 'stone', 'pier foot'),
              box(sx * half, 0, 0.2, 0.52, 0.52, top - 0.2, STONE, 'stone', 'pier'),
              box(sx * half, 0, top, 0.62, 0.6, 0.12, STONE_L, 'stone', 'impost')]
    n = 9
    for i in range(n):
        if i in (6, 7): continue  # fallen
        a0, a1 = math.pi * i / n, math.pi * (i + 1) / n
        p0 = (-math.cos(a0) * r, 0, top + 0.12 + math.sin(a0) * r)
        p1 = (-math.cos(a1) * r, 0, top + 0.12 + math.sin(a1) * r)
        L.append(plank(p0, p1, 0.24, STONE_L if i == 4 else (STONE if i % 2 else '#BAB6C4'), 'keystone' if i == 4 else 'voussoir', 'stone'))
    L += [stone(1.9, -0.6, 0, 0.22, 0.26, STONE, 'fallen stone', sides=5, rings=2),
          stone(1.6, -0.95, 0, 0.18, 0.22, '#BAB6C4', 'fallen stone', sides=5, rings=2)]
    for i in range(7):  # ivy up the left pier
        L.append(sphere(-half + 0.28 - (i % 2) * 0.1, -0.24, 0.2 + i * 0.3, 0.13, MOSS if i % 2 else LEAF, 'leaves', 'ivy', 7, 3, 0.4, h=0.18))
    return rec(L)


def wall_ruin_corner():
    """The corner of a ruined house: an L of rough stone wall, high at the corner and broken down toward both ends,
    a window gap, moss on its tops and rubble at its foot."""
    L = []
    t = 0.42
    def course(x0, x1, y0, y1, z, h, col):
        L.append(box((x0 + x1) / 2, (y0 + y1) / 2, z, abs(x1 - x0), abs(y1 - y0), h, col, 'stone', 'wall course'))
    heights = (2.0, 1.7, 1.15, 0.7, 0.35)  # from the corner outwards
    for i, hh in enumerate(heights):  # the front wall, along x from the left corner
        x0 = -1.0 + i * 0.4
        if i == 1:
            course(x0, x0 + 0.4, 0, t, 0, 0.75, STONE)
            course(x0, x0 + 0.4, 0, t, 1.35, hh - 1.35, STONE_L)  # the window gap
        else:
            course(x0, x0 + 0.4, 0, t, 0, hh, STONE if i % 2 else STONE_L)
    for i, hh in enumerate(heights[1:]):  # the side wall, back along y from the corner
        y0 = t + i * 0.4
        course(-1.0, -1.0 + t, y0, y0 + 0.4, 0, hh, STONE_L if i % 2 else STONE)
    L += [sphere(-0.8, 0.2, 2.0, 0.18, MOSS, 'leaves', 'moss', 7, 3, 0.35, h=0.12),
          sphere(0.2, 0.2, 0.7, 0.14, MOSS_L, 'leaves', 'moss', 7, 3, 0.35, h=0.1),
          stone(0.7, -0.35, 0, 0.18, 0.18, STONE_D, 'rubble', sides=5, rings=2),
          stone(0.35, -0.45, 0, 0.13, 0.14, STONE, 'rubble', sides=5, rings=2),
          stone(-0.4, -0.4, 0, 0.12, 0.12, STONE_L, 'rubble', sides=5, rings=2)]
    return rec(L)


# ================================================================ new: wayside
def milestone():
    """A milestone: a squat stone with a round top, a carved band and a worn number plate, grass round its foot."""
    L = [box(0, 0, 0, 0.5, 0.3, 0.55, STONE, 'stone', 'milestone'),
         limb((-0.25, 0, 0.55), (0.25, 0, 0.55), 0.15, 0.15, STONE, 'stone', 'round top', 10),
         box(0, -0.16, 0.36, 0.36, 0.02, 0.14, STONE_D, 'stone', 'number plate'),
         box(0, -0.17, 0.4, 0.14, 0.01, 0.06, STONE_L, 'plain', 'carved number'),
         sphere(0.15, -0.12, 0.62, 0.06, MOSS, 'leaves', 'lichen', 6, 2, h=0.04)]
    for x, y in ((-0.28, -0.12), (0.26, -0.15), (0.05, 0.2)):
        L.append(sphere(x, y, 0, 0.1, LEAF, 'leaves', 'tuft', 7, 3, 0.35, 0.14))
    return rec(L)


def waymarker_post():
    """A trail post: a squared wooden post with painted bands and three coloured arrows pointing different ways."""
    L = [box(0, 0, 0, 0.14, 0.14, 1.55, A['wood'], 'wood', 'post'),
         cyl(0, 0, 1.55, 0.11, 0.1, A['dwood'], 'wood', 'post cap', 4, k='cone', r1=0.02, rot=r2(math.pi / 4)),
         box(0, 0, 1.05, 0.15, 0.15, 0.06, WHITE, 'plain', 'paint band'),
         box(0, 0, 0.98, 0.15, 0.15, 0.06, '#E86A5A', 'plain', 'paint band')]
    for z, col, sx in ((1.38, '#62B098', 1), (1.22, '#E8C060', -1)):
        L += [box(sx * 0.24, -0.02, z, 0.38, 0.03, 0.1, col, 'plain', 'arrow'),
              cyl(sx * 0.46, -0.02, z, 0.08, 0.1, col, 'plain', 'arrow head', 3, rot=0 if sx > 0 else r2(math.pi))]
    L += [box(0.02, -0.24, 0.88, 0.03, 0.34, 0.1, '#5492EC', 'plain', 'arrow')]
    for x, y in ((-0.12, -0.12), (0.14, -0.08)):
        L.append(sphere(x, y, 0, 0.09, LEAF2, 'leaves', 'tuft', 7, 3, 0.35, 0.14))
    return rec(L)


def shrine_small():
    """A wayside shrine (solarpunk): a stone niche on a plinth, a slab roof with a small solar cell on it, a seed in the
    niche that glows at night, flowers and a candle stub on the step."""
    L = [box(0, 0, 0, 0.9, 0.7, 0.22, STONE_D, 'stone', 'plinth'),
         box(0, -0.38, 0, 0.7, 0.16, 0.1, STONE, 'stone', 'step'),
         box(0, 0.22, 0.22, 0.7, 0.16, 0.9, STONE, 'stone', 'back'),
         box(-0.3, 0, 0.22, 0.12, 0.56, 0.9, STONE_L, 'stone', 'side'),
         box(0.3, 0, 0.22, 0.12, 0.56, 0.9, STONE_L, 'stone', 'side'),
         box(0, 0.0, 0.22, 0.5, 0.42, 0.04, STONE_D, 'stone', 'niche floor'),
         box(0, 0.02, 1.12, 0.92, 0.74, 0.1, STONE_D, 'stone', 'roof slab'),
         plank((-0.32, 0.18, 1.24), (0.32, 0.18, 1.24), 0.03, A['iron'], 'solar frame', 'metal'),
         box(0, 0.06, 1.22, 0.6, 0.32, 0.04, SOLAR, 'solar', 'solar cell'),
         cyl(0, 0.0, 0.26, 0.1, 0.06, A['brass'], 'metal', 'seed dish', 10),
         {**sphere(0, 0.0, 0.32, 0.09, '#9FE8C8', 'plain', 'seed', 8, 4), 'h': 0.15},
         img(B1.glass_sprite(), 0, -0.1, 0.3, s=0.45, glow=1, recv=0, sway=0, name='seed glow'),
         cyl(0.22, -0.4, 0.1, 0.03, 0.08, '#F4F0E8', 'plain', 'candle stub', 6),
         sphere(-0.38, -0.12, 1.2, 0.1, MOSS, 'leaves', 'moss', 6, 3, 0.35, h=0.08)]
    for i, x in enumerate((-0.42, -0.2, 0.42)):
        L += [limb((x, -0.45, 0), (x, -0.45, 0.22), 0.012, 0.01, '#5E9A48', 'plain', 'stem', 4),
              sphere(x, -0.45, 0.24, 0.05, ('#E87EA8', '#F4D040', '#C478D0')[i], 'plain', 'flower', 6, 3)]
    return rec(L)


# ================================================================ new: farm
def haystack():
    """A traditional haystack: a tall rounded heap of hay round a pole, a fork leaning on it, wisps at its foot."""
    L = [cyl(0, 0, 0, 0.82, 1.15, HAY, 'hay', 'haystack', 12, k='barrel', bulge=0.08),
         {'k': 'dome', 'x': 0, 'y': 0, 'z': 1.1, 'r': 0.86, 'h': 1.25, 'sides': 12, 'rings': 5, 'lump': 0.06,
          'col': HAY, 'tex': 'hay', 'name': 'stack top'},
         cyl(0, 0, 2.15, 0.3, 0.3, HAY_D, 'hay', 'stack cap', 10, k='cone', r1=0.05),
         cyl(0, 0, 0.55, 0.86, 0.06, '#C8A060', 'cloth', 'rope band', 12),
         limb((0, 0, 2.3), (0, 0, 2.75), 0.035, 0.03, A['dwood'], 'wood', 'pole', 5),
         limb((0.75, -0.62, 0), (0.55, -0.55, 1.35), 0.02, 0.02, A['plank'], 'wood', 'fork handle', 5),
         box(0.54, -0.56, 1.32, 0.16, 0.02, 0.14, '#8E8A98', 'metal', 'fork tines')]
    for x, y in ((-0.85, -0.6), (0.2, -0.95), (0.95, -0.2)):
        L.append(sphere(x, y, 0, 0.14, HAY, 'hay', 'wisp', 6, 2, 0.4, 0.07))
    return rec(L)


def rain_barrel():
    """A rain barrel: a wooden barrel with iron hoops on a little stand, a lid with a funnel and a brass tap."""
    L = [box(0, 0, 0, 0.66, 0.66, 0.16, A['dwood'], 'wood', 'stand'),
         cyl(0, 0, 0.16, 0.3, 0.86, A['wood'], 'wood', 'barrel', 12, k='barrel', bulge=0.12)]
    for z in (0.24, 0.84):
        L.append(cyl(0, 0, z, 0.32, 0.05, A['iron'], 'metal', 'hoop', 12))
    L += [cyl(0, 0, 1.02, 0.29, 0.03, A['dwood'], 'wood', 'lid', 12),
          cyl(0.06, 0.04, 1.05, 0.12, 0.12, '#8E8A98', 'metal', 'funnel', 10, k='cone', r1=0.04),
          limb((0, -0.3, 0.32), (0, -0.4, 0.32), 0.03, 0.03, A['brass'], 'metal', 'tap', 6),
          limb((0, -0.4, 0.32), (0, -0.4, 0.26), 0.025, 0.02, A['brass'], 'metal', 'tap spout', 6),
          cyl(-0.12, -0.42, 0, 0.14, 0.02, '#6E96AE', 'plain', 'puddle', 10, ry=0.08)]
    return rec(L)


def water_pump():
    """A cast iron hand pump on a stone slab: its body, the long handle up, the spout over a wooden bucket."""
    L = [box(0, 0, 0, 0.7, 0.6, 0.12, STONE, 'stone', 'slab'),
         cyl(0, 0.1, 0.12, 0.1, 0.95, '#3E7E78', 'metal', 'pump body', 10),
         cyl(0, 0.1, 1.07, 0.13, 0.08, '#2E5E5A', 'metal', 'pump cap', 10),
         sphere(0, 0.1, 1.15, 0.06, A['brass'], 'metal', 'knob', 8, 3),
         limb((0, 0.1, 0.8), (0, -0.2, 0.74), 0.04, 0.03, '#3E7E78', 'metal', 'spout', 6),
         limb((0.05, 0.1, 1.05), (0.4, 0.2, 1.45), 0.025, 0.02, '#2E5E5A', 'metal', 'handle', 5),
         cyl(0, -0.22, 0.12, 0.16, 0.24, A['wood'], 'wood', 'bucket', 10, k='cone', r1=0.19),
         cyl(0, -0.22, 0.2, 0.18, 0.03, A['iron'], 'metal', 'bucket hoop', 10),
         cyl(0, -0.22, 0.32, 0.17, 0.01, '#6E96AE', 'plain', 'water', 10)]
    return rec(L)


def hive(L, x, col, roof):
    L += [box(x, 0, 0.46, 0.5, 0.44, 0.22, col, 'battens', 'hive box'),
          box(x, 0, 0.68, 0.5, 0.44, 0.2, col, 'battens', 'hive super'),
          box(x, 0, 0.66, 0.52, 0.46, 0.02, '#C8B490', 'wood', 'hive joint'),
          cyl(x, 0, 0.88, 0.4, 0.14, roof, 'wood', 'hive roof', 4, k='cone', r1=0.04, ry=0.36, rot=r2(math.pi / 4)),
          box(x, -0.23, 0.48, 0.16, 0.04, 0.03, '#5A4636', 'plain', 'hive door')]


def beehive_stand():
    """Two beehives on a low wooden bench: white and yellow boxes with pitched roofs, little doors, a few bees."""
    w, d = 1.6, 0.6
    L = [box(0, 0, 0.34, w, d, 0.08, A['plank'], 'wood', 'bench top')]
    for sx in (-1, 1):
        for sy in (-1, 1):
            L.append(box(sx * (w / 2 - 0.08), sy * (d / 2 - 0.08), 0, 0.08, 0.08, 0.34, A['dwood'], 'wood', 'bench leg'))
    hive(L, -0.4, '#F4F0E8', '#C46C54')
    hive(L, 0.4, '#F4D278', '#2EA4A0')
    for x, y, z in ((-0.2, -0.45, 0.72), (0.55, -0.4, 0.95), (0.1, -0.55, 0.6)):
        L.append(sphere(x, y, z, 0.025, '#3A3448', 'plain', 'bee', 4, 2))
    return rec(B1.shift_y(L, d / 2))


def tool_shed():
    """A small tool shed: plank walls, a lean-to roof of corrugated iron, a door with a latch, a rake and a spade
    leaning by it, a flowerpot."""
    w, d, hf, hb = 1.8, 1.4, 2.05, 1.7
    L = [box(0, 0, 0, w + 0.1, d + 0.1, 0.1, STONE_D, 'stone', 'base'),
         box(0, 0, 0.1, w, d, hb - 0.1, '#7E9A72', 'battens', 'walls'),
         box(0, -d / 4, hb, w, d / 2, hf - hb, '#7E9A72', 'battens', 'front gable'),
         box(-0.2, -d / 2 - 0.01, 0.1, 0.72, 0.03, 1.65, '#6E8562', 'battens', 'door'),
         box(0.1, -d / 2 - 0.03, 0.85, 0.06, 0.02, 0.12, A['iron'], 'metal', 'latch'),
         box(-0.2, -d / 2 - 0.02, 1.0, 0.72, 0.02, 0.06, A['dwood'], 'wood', 'door brace'),
         plank((-w / 2 - 0.12, -d / 2 - 0.2, hf + 0.04), (w / 2 + 0.12, -d / 2 - 0.2, hf + 0.04), 0.04, A['dwood'], 'roof edge')]
    for i in range(6):  # the roof sheets, sloping down to the back
        y0 = -d / 2 - 0.2 + i * (d + 0.4) / 6
        z = hf - (hf - hb) * (i + 0.5) / 6 + 0.02
        L.append(box(0, y0 + (d + 0.4) / 12, z, w + 0.24, (d + 0.4) / 6 + 0.02, 0.05, '#A8A2B2', 'corrugated', 'roof sheet'))
    L += [limb((0.55, -d / 2 - 0.2, 0), (0.68, -d / 2 - 0.05, 1.45), 0.02, 0.02, A['plank'], 'wood', 'rake handle', 5),
          box(0.68, -d / 2 - 0.06, 1.42, 0.3, 0.03, 0.04, '#8E8A98', 'metal', 'rake head'),
          limb((0.8, -d / 2 - 0.25, 0.15), (0.88, -d / 2 - 0.04, 1.2), 0.02, 0.02, A['plank'], 'wood', 'spade handle', 5),
          box(0.8, -d / 2 - 0.25, 0, 0.16, 0.03, 0.2, '#8E8A98', 'metal', 'spade blade'),
          cyl(-0.75, -d / 2 - 0.25, 0, 0.12, 0.2, '#C8664A', 'plain', 'flowerpot', 8, k='cone', r1=0.14),
          sphere(-0.75, -d / 2 - 0.25, 0.22, 0.12, LEAF, 'leaves', 'plant', 7, 3, 0.35)]
    return rec(B1.shift_y(L, d / 2 + 0.25))


def veg_patch_frame():
    """A raised vegetable bed: a plank frame of soil, rows of cabbages, carrot tops and a bean frame of canes."""
    w, d = 2.0, 1.0
    L = [box(0, 0, 0, w, d, 0.32, A['wood'], 'wood', 'bed frame'),
         box(0, 0, 0.3, w - 0.1, d - 0.1, 0.04, '#6A4E40', 'plain', 'soil')]
    for sx in (-1, 1):
        for sy in (-1, 1):
            L.append(box(sx * (w / 2 - 0.03), sy * (d / 2 - 0.03), 0, 0.08, 0.08, 0.38, A['dwood'], 'wood', 'corner post'))
    for i in range(4):
        L.append({**sphere(-0.75 + i * 0.26, -0.24, 0.32, 0.12, '#8CC860' if i % 2 else '#6EAE52', 'leaves', 'cabbage', 8, 4, 0.25), 'h': 0.18})
    for i in range(5):
        L += [cyl(-0.75 + i * 0.2, 0.12, 0.33, 0.06, 0.16, LEAF2, 'leaves', 'carrot tops', 5, k='cone', r1=0.0),
              sphere(-0.75 + i * 0.2, 0.08, 0.33, 0.03, '#F49A3A', 'plain', 'carrot', 5, 2)]
    for x in (0.45, 0.85):  # the bean canes: a tent of sticks with leaves
        L += [limb((x - 0.15, -0.25, 0.32), (x, 0.0, 1.5), 0.015, 0.012, '#B8A070', 'wood', 'cane', 4),
              limb((x + 0.15, 0.25, 0.32), (x, 0.0, 1.5), 0.015, 0.012, '#B8A070', 'wood', 'cane', 4)]
        for k in range(4):
            L.append(sphere(x + (0.08 if k % 2 else -0.08), -0.02, 0.55 + k * 0.24, 0.1, LEAF if k % 2 else LEAF2, 'leaves', 'bean leaves', 6, 3, 0.35))
    return rec(B1.shift_y(L, d / 2))


# ================================================================ new: solarpunk
def wind_turbine_small():
    """A small three-bladed wind turbine for a farm or a rest stop: a slim mast on a concrete foot, a nacelle with a
    tail vane, three white blades and a copper hub."""
    H = 4.6
    L = [box(0, 0, 0, 0.6, 0.6, 0.18, STONE, 'stone', 'foot'),
         cyl(0, 0, 0.18, 0.1, H - 0.18, '#E8E6EE', 'metal', 'mast', 8, k='cone', r1=0.06),
         box(0.25, 0.05, 0.5, 0.22, 0.12, 0.3, '#62B098', 'metal', 'control box'),
         limb((0, 0.25, H), (0, -0.18, H), 0.11, 0.08, '#E8E6EE', 'metal', 'nacelle', 8),
         limb((0, 0.25, H), (0, 0.85, H + 0.05), 0.02, 0.02, '#E8E6EE', 'metal', 'tail boom', 4),
         box(0, 0.88, H - 0.15, 0.03, 0.3, 0.42, A['copper'], 'metal', 'tail vane'),
         {**sphere(0, -0.24, H, 0.1, A['copper'], 'metal', 'hub', 8, 4), 'h': 0.2}]
    for i in range(3):
        a = math.pi / 2 + i * 2 * math.pi / 3
        L.append(limb((0, -0.26, H), (math.cos(a) * 1.25, -0.28, H + math.sin(a) * 1.25), 0.07, 0.025, '#F4F0E8', 'plain', 'blade', 4))
    return rec(L)


def solar_post_light():
    """A path light that charges itself: a slim green post, a tilted solar cell on top and a lamp head that glows
    after dark."""
    L = [cyl(0, 0, 0, 0.14, 0.1, STONE, 'stone', 'foot', 8),
         cyl(0, 0, 0.1, 0.05, 1.9, '#3E7E78', 'metal', 'post', 8),
         limb((0, 0, 1.75), (0, -0.32, 1.75), 0.025, 0.02, '#3E7E78', 'metal', 'arm', 5),
         cyl(0, -0.32, 1.52, 0.1, 0.06, '#2E5E5A', 'metal', 'lamp base', 8),
         cyl(0, -0.32, 1.7, 0.14, 0.1, '#62B098', 'metal', 'lamp hood', 8, k='cone', r1=0.03),
         img(B1.glass_sprite(), 0, -0.32, 1.54, s=0.5, glow=1, recv=0, sway=0, name='lamp glass'),
         box(0, 0.02, 2.0, 0.46, 0.3, 0.04, SOLAR, 'solar', 'solar cell'),
         box(0, 0.02, 1.98, 0.5, 0.34, 0.02, A['iron'], 'metal', 'cell frame')]
    for i in range(3):  # a ring of flowers round its foot
        a = i * 2.1 + 0.4
        L.append(sphere(math.cos(a) * 0.22, math.sin(a) * 0.22, 0.04, 0.06, ('#F4D040', '#E87EA8', WHITE)[i], 'plain', 'flower', 6, 3))
    return rec(L)


def seed_library_box():
    """A seed library on a post: a little cabinet with a pitched roof and a glass door, seed packets inside in bright
    colours, a tag that reads TAKE ONE, LEAVE ONE (drawn as a white card)."""
    L = [box(0, 0, 0, 0.1, 0.1, 1.05, A['wood'], 'wood', 'post'),
         box(0, 0, 1.05, 0.62, 0.42, 0.06, A['dwood'], 'wood', 'shelf base'),
         box(0, 0.02, 1.11, 0.58, 0.36, 0.5, '#E86A5A', 'battens', 'cabinet'),
         box(0, -0.17, 1.15, 0.48, 0.02, 0.42, GLASS, 'plain', 'glass door') | {'glass': 2},
         box(0.22, -0.19, 1.34, 0.03, 0.02, 0.06, A['brass'], 'metal', 'knob'),
         cyl(0, 0.02, 1.61, 0.46, 0.22, '#2EA4A0', 'wood', 'roof', 4, k='cone', r1=0.02, ry=0.3, rot=r2(math.pi / 4)),
         box(-0.1, -0.2, 0.86, 0.22, 0.01, 0.14, WHITE, 'plain', 'tag')]
    for i, c in enumerate(('#F4D040', '#8CC850', '#C478D0', '#F49A3A', '#5492EC')):
        L.append(box(-0.17 + i * 0.085, -0.08, 1.16 + (i % 2) * 0.2, 0.07, 0.02, 0.14, c, 'plain', 'seed packet'))
    L.append(sphere(0.12, -0.12, 0, 0.1, LEAF, 'leaves', 'tuft', 7, 3, 0.35, 0.14))
    return rec(L)


# ================================================================ new: the Bureau
def bureau_barrier():
    """A Bureau road barrier: two grey A-frame legs holding a board striped slate and mustard, a laminated notice
    clipped to it, a warning lamp on top. No logo (to be decided)."""
    w = 1.6
    L = []
    for sx in (-1, 1):
        x = sx * (w / 2 - 0.12)
        L += [plank((x, -0.2, 0), (x, 0, 1.0), 0.035, SLATE_D, 'leg', 'metal'),
              plank((x, 0.2, 0), (x, 0, 1.0), 0.035, SLATE_D, 'leg', 'metal'),
              box(x, 0, 0, 0.1, 0.5, 0.04, SLATE_D, 'metal', 'foot')]
    for i in range(8):
        L.append(box(-w / 2 + 0.1 + i * 0.2, -0.03, 0.72, 0.2, 0.05, 0.22, MUSTARD if i % 2 else SLATE, 'plain', 'board stripe'))
    L += [box(0.0, -0.065, 0.74, 0.3, 0.01, 0.18, WHITE, 'plain', 'notice'),
          box(0.0, -0.07, 0.88, 0.1, 0.02, 0.03, '#3A3448', 'metal', 'clip'),
          cyl(w / 2 - 0.2, -0.03, 0.94, 0.06, 0.1, '#F49A3A', 'plain', 'warning lamp', 8),
          cyl(w / 2 - 0.2, -0.03, 1.04, 0.07, 0.02, '#3A3448', 'metal', 'lamp cap', 8)]
    return rec(B1.shift_y(L, 0.25))


def bureau_crate():
    """A Bureau evidence crate: grey ribbed metal with mustard corner guards, a white label with a barcode, a red wax
    seal over the lid and a smaller crate on top."""
    L = [box(0, 0, 0, 0.9, 0.7, 0.62, SLATE, 'metal', 'crate'),
         box(0, 0, 0.62, 0.94, 0.74, 0.05, SLATE_D, 'metal', 'lid')]
    for sx in (-1, 1):
        for sy in (-1, 1):
            L.append(box(sx * 0.42, sy * 0.32, 0, 0.1, 0.1, 0.67, MUSTARD, 'metal', 'corner guard'))
    for x in (-0.2, 0.2):
        L.append(box(x, -0.36, 0.08, 0.04, 0.02, 0.48, SLATE_D, 'metal', 'rib'))
    L += [box(0, -0.37, 0.3, 0.3, 0.01, 0.18, WHITE, 'plain', 'label'),
          box(0, -0.38, 0.33, 0.2, 0.01, 0.06, '#3A3448', 'plain', 'barcode'),
          {**sphere(0, -0.37, 0.64, 0.07, '#B0303C', 'plain', 'wax seal', 8, 3), 'ry': 0.03},
          box(0.1, 0.05, 0.67, 0.46, 0.4, 0.3, SLATE_D, 'metal', 'small crate'),
          box(0.1, -0.16, 0.76, 0.2, 0.01, 0.1, WHITE, 'plain', 'label')]
    return rec(L)


# ================================================================ the catalogue
SWAP = {'firewood': firewood, 'firewood_b': firewood_b, 'scrap': scrap, 'statue': statue, 'tires': tires,
        'tollbooth': tollbooth}
# key: (maker, name, group, shadow, tags, collision: {'solid': r} | {'box': [w, d]} | {'posts': [...]}, extra fields)
NEW = {
    'footbridge_wood': (footbridge_wood, 'Footbridge', 'bridge', 0.8, ('route', 'water'), {'box': [3.4, 1.2]}, {}),
    'stile': (stile, 'Stile', 'fence', 0.35, ('route', 'farm'), {'solid': 0}, {}),
    'pier_deck': (pier_deck, 'Landing stage', 'dock', 0.9, ('route', 'water'), {'solid': 0.9}, {}),
    'pillar_broken': (pillar_broken, 'Broken column', 'ruins', 0.5, ('route', 'ruins'), {'solid': 0.45}, {}),
    'arch_ruin': (arch_ruin, 'Ruined arch', 'ruins', 1.0, ('route', 'ruins'), {'posts': [{'x': -44, 'r': 0.35}, {'x': 44, 'r': 0.35}]}, {}),
    'wall_ruin_corner': (wall_ruin_corner, 'Ruined wall corner', 'ruins', 0.9, ('route', 'ruins'), {'box': [2.0, 1.6]}, {}),
    'milestone': (milestone, 'Milestone', 'wayside', 0.3, ('route',), {'solid': 0.3}, {}),
    'waymarker_post': (waymarker_post, 'Trail post', 'wayside', 0.2, ('route',), {'solid': 0.2}, {}),
    'shrine_small': (shrine_small, 'Wayside shrine', 'wayside', 0.5, ('route',), {'solid': 0.5}, {}),
    'haystack': (haystack, 'Haystack', 'haybale', 1.0, ('route', 'farm'), {'solid': 0.9}, {}),
    'rain_barrel': (rain_barrel, 'Rain barrel', 'crates', 0.4, ('route', 'farm'), {'solid': 0.4}, {}),
    'water_pump': (water_pump, 'Water pump', 'well', 0.4, ('route', 'farm'), {'solid': 0.35}, {}),
    'beehive_stand': (beehive_stand, 'Beehives', 'beehive', 0.6, ('route', 'farm'), {'box': [1.6, 0.6]}, {}),
    'tool_shed': (tool_shed, 'Tool shed', 'shed', 1.2, ('route', 'farm'), {'box': [2.0, 1.6]}, {}),
    'veg_patch_frame': (veg_patch_frame, 'Vegetable bed', 'garden', 0.6, ('route', 'farm'), {'box': [2.0, 1.0]}, {}),
    'wind_turbine_small': (wind_turbine_small, 'Wind turbine', 'turbine', 0.5, ('route', 'tech'), {'solid': 0.35}, {}),
    'solar_post_light': (solar_post_light, 'Solar path light', 'lamp', 0.2, ('route', 'tech'), {'solid': 0.15}, {}),
    'seed_library_box': (seed_library_box, 'Seed library', 'wayside', 0.3, ('route',), {'solid': 0.25}, {}),
    'bureau_barrier': (bureau_barrier, 'Bureau barrier', 'bureau', 0.5, ('route', 'bureau'), {'box': [1.6, 0.5]}, {}),
    'bureau_crate': (bureau_crate, 'Bureau crate', 'bureau', 0.5, ('route', 'bureau'), {'solid': 0.5}, {}),
}


def swap(C):
    """The set pieces' last pictures as models under their own keys: name, group, tags, picture, size and collision
    kept; the model and its scale added."""
    for key, fn in SWAP.items():
        M = C[key]
        M['model'] = B1.write_recipe(key, fn())
        M['ppm'] = PPM
        M['vary'] = dict(FIXED)
        for f in ('build', 'layers', 'vol', 'volDepth'):
            M.pop(f, None)


def add_new(C):
    for key, (fn, name, group, shadow, tags, coll, extra) in NEW.items():
        M = BI.new_prop(key, name, fn(), group=group, shadow=shadow, tags=tags, solid=coll.get('solid'), box_=coll.get('box'))
        if 'posts' in coll: M['posts'] = coll['posts']
        M.update(extra)
        C[key] = M


# ================================================================ the showcase map
ROWS = [('wayside', ['milestone', 'waymarker_post', 'shrine_small', 'seed_library_box', 'solar_post_light', 'stile'], 2.6),
        ('farm', ['rain_barrel', 'water_pump', 'beehive_stand', 'veg_patch_frame', 'haystack'], 3.4),
        ('farm-big', ['tool_shed', 'wind_turbine_small', 'footbridge_wood', 'pier_deck'], 4.4),
        ('ruins', ['pillar_broken', 'arch_ruin', 'wall_ruin_corner', 'statue'], 4.0),
        ('junk', ['firewood', 'firewood_b', 'tires', 'scrap'], 3.6),
        ('bureau', ['tollbooth', 'bureau_barrier', 'bureau_crate', 'bollard'], 4.6)]


def showcase(C):
    """test_props_routes: each row a group of this track's props side by side"""
    rows = [(name, [(k, 0) for k in keys], None, gap) for name, keys, gap in ROWS]
    saved = B1.ROWS
    B1.ROWS = rows
    M = B1.test_map(C)
    B1.ROWS = saved
    M['name'] = 'Test: route props (route props track)'
    # RP-2: a row of structures (game/js/structures.js) in the props' style: a stone and a brick arch, stone, wood and
    # iron rails
    z = 9.0 + 15 * len(ROWS)
    M['h'] += 15
    M['tiles'] += [M['tiles'][-1]] * 15
    M['arches'] = [{'x': 14, 'z': z, 'w': 2.6, 'd': 0.8, 'h': 3, 'dir': 'z', 'kind': 'stone'},
                   {'x': 21, 'z': z, 'w': 2.6, 'd': 0.8, 'h': 3, 'dir': 'z', 'kind': 'brick'}]
    M['rails'] = [{'pts': [[27, z], [31, z], [32.5, z + 1.5]], 'kind': 'stone'},
                  {'pts': [[34, z], [38, z]], 'kind': 'wood'},
                  {'pts': [[40, z], [44, z]], 'kind': 'iron'}]
    M['props'] += [{'k': 'arch_ruin', 'x': 7, 'z': z}, {'k': 'fence_wood', 'x': 36, 'z': z + 3}]  # props beside them
    M['shots'].append({'x': 28, 'z': z - 4, 'yaw': 0, 'label': 'structures'})
    return M


def main():
    BI.PICS.mkdir(parents=True, exist_ok=True)
    D = gamedata.load()
    C = D['scenery']['props']
    swap(C)
    add_new(C)
    D['maps']['test_props_routes'] = showcase(C)
    gamedata.save(D)
    print('swapped:', ', '.join(SWAP))
    print('new:', ', '.join(NEW))


if __name__ == '__main__':
    main()
