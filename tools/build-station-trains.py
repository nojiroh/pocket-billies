#!/usr/bin/env python3
"""Hub track HB-7: Skyline Station, the sky rail, the sky portal and the five sky trains, in the low-poly 32 px/m style
(phase 09, the airship's palette). Runs (Expeditions) start from the station; HB-8 flies a train up the rail and through
the portal. The station stands in Copperleaf (tools/build-copperleaf.mjs); everything here is finished all round for the
hub's orbit camera.

  train_station   Skyline Station: a stone platform under a verdigris canopy on iron columns, the departures board, the
                  name boards, a ticket kiosk, a clock, benches, lamps; the trains' track bed behind it (+y), its rail
                  running out of the station's right end (+x)
  sky_rail        the rail on its pylons, 12 m a piece along x, chained end to end on one heading: flat (0.45 m up, out of
                  the station), then its looks bend (easing into the climb), rise, rise high and crest (easing out flat,
                  15.5 m up); a model can't stand above the ground, so each piece carries its pylon down to it
  sky_portal      the tear in the sky at the rail's top: the rail stops at a launch lip, the tear hangs in the air beyond
                  it (always turned to the eye), chrome stabilisers float round it and a brass hoop turns round it (its
                  gold look a swap)
  train_<theme>   one per region theme (regions.json themes; a run's region is RL-R1's): the Lakeland Clipper, the
                  Greenbelt Sunrunner, the Wildwood Zephyr, the Highland Arrow, the Harvest Comet. Each rides the rail
                  on hover skids either side of it, facing +x, pushed by rocket engines at its tail, and bobs a little

Lettering (the station's boards, the trains' names) is a fixed decal, never mirrored (HB-1, logic/prop-turn.js
decalPlace); every model here keeps its size, turn and lean (no wobble), so a decal stays where it was drawn.

    python3 tools/build-station-trains.py      # rerunnable; the models, decals, pictures, catalogue, test_station_trains

The showcase map test_station_trains: game/index.html?test=1&scene=test_station_trains (or the Studio's test run).
Uses batch 1's parts (tools/build-props-batch1.py) and the island batch's picture baker (tools/build-props-island.py).
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
ISL = load('island', 'build-props-island.py')
ISL.PICS = B1.ART / 'scene' / 'next' / 'station'  # the fallback pictures (the island batch's baker writes them here)
PPM, A = B1.PPM, B1.AIR
box, limb, cyl, sphere, img, r2 = B1.box, B1.limb, B1.cyl, B1.sphere, B1.img, B1.r2
S2 = math.sqrt(2)
DECALS = B1.NEXT / 'decals'
FIXED = {'rot': 0, 'lean': 0, 'size': 0}
LAMP = 'scene/next/decals/lantern_glass.png'
STEEL, STEEL_D, NAVY, BOARD = '#5A6278', '#3A4052', '#2C3A5C', '#2A2836'
STONE, COPING, CONCRETE = '#AAA6B4', '#D8D2C8', '#9C98A6'
GLOW = '#8FF4FF'
CHROME, RED = '#DCE2EC', '#D6403C'


def rec(L, cel=0.7):
    return {'ppm': PPM, 'cel': cel, 'layers': sorted(L, key=lambda l: l['k'] == 'img')}


def plank(a, b, t, col, name, tex='metal'):
    return limb(a, b, t, t, col, tex, name, 4)


# ================================================================ lettering: a 3 x 5 pixel font
GLYPHS = {
    'A': ['.#.', '#.#', '###', '#.#', '#.#'], 'B': ['##.', '#.#', '##.', '#.#', '##.'], 'C': ['.##', '#..', '#..', '#..', '.##'],
    'D': ['##.', '#.#', '#.#', '#.#', '##.'], 'E': ['###', '#..', '##.', '#..', '###'], 'F': ['###', '#..', '##.', '#..', '#..'],
    'G': ['.##', '#..', '#.#', '#.#', '.##'], 'H': ['#.#', '#.#', '###', '#.#', '#.#'], 'I': ['###', '.#.', '.#.', '.#.', '###'],
    'J': ['..#', '..#', '..#', '#.#', '.#.'], 'K': ['#.#', '#.#', '##.', '#.#', '#.#'], 'L': ['#..', '#..', '#..', '#..', '###'],
    'M': ['#.#', '###', '###', '#.#', '#.#'], 'N': ['##.', '#.#', '#.#', '#.#', '#.#'], 'O': ['.#.', '#.#', '#.#', '#.#', '.#.'],
    'P': ['##.', '#.#', '##.', '#..', '#..'], 'Q': ['.#.', '#.#', '#.#', '##.', '.##'], 'R': ['##.', '#.#', '##.', '#.#', '#.#'],
    'S': ['.##', '#..', '.#.', '..#', '##.'], 'T': ['###', '.#.', '.#.', '.#.', '.#.'], 'U': ['#.#', '#.#', '#.#', '#.#', '###'],
    'V': ['#.#', '#.#', '#.#', '#.#', '.#.'], 'W': ['#.#', '#.#', '###', '###', '#.#'], 'X': ['#.#', '#.#', '.#.', '#.#', '#.#'],
    'Y': ['#.#', '#.#', '.#.', '.#.', '.#.'], 'Z': ['###', '..#', '.#.', '#..', '###'], ' ': ['...'] * 5,
    '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['##.', '..#', '.#.', '#..', '###'],
    '3': ['##.', '..#', '.#.', '..#', '##.'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '##.', '..#', '##.'],
    '6': ['.##', '#..', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'], '8': ['###', '#.#', '###', '#.#', '###'],
    '9': ['###', '#.#', '###', '..#', '##.'], ':': ['...', '.#.', '...', '.#.', '...'], '.': ['...', '...', '...', '...', '.#.'],
    '-': ['...', '...', '###', '...', '...'],
}


def text_w(s):
    return 4 * len(s) - 1


def text(a, s, x, y, col):
    """letters into an RGBA array, top left at (x, y)"""
    for ch in s:
        for j, row in enumerate(GLYPHS[ch]):
            for k, c in enumerate(row):
                if c == '#' and 0 <= y + j < a.shape[0] and 0 <= x + k < a.shape[1]: a[y + j, x + k] = (*col, 255)
        x += 4


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def panel(w, h, fill, rim):
    a = np.zeros((h, w, 4), np.uint8)
    a[...] = (*rgb(rim), 255)
    a[1:-1, 1:-1] = (*rgb(fill), 255)
    return a


def save_decal(a, name):
    return B1.save_png(a, DECALS / f'{name}.png')


def name_board():
    """SKYLINE STATION in cream on navy, a brass rim"""
    s = 'SKYLINE STATION'
    a = panel(text_w(s) + 8, 11, NAVY, '#E8C060')
    text(a, s, 4, 3, rgb('#F2DCA0'))
    return save_decal(a, 'station_name')


def departures_board():
    """the flap board: DEPARTURES, then a row a region with its time and a lamp (lit: boarding)"""
    rows = [('LAKELAND', '9:10'), ('GREENBELT', '9:40'), ('WILDWOOD', '10:05'), ('HIGHLAND', '10:30'), ('HARVEST', '11:00')]
    a = panel(72, 44, BOARD, STEEL)
    a[2:9, 2:-2] = (*rgb('#3E3A50'), 255)
    text(a, 'DEPARTURES', (72 - text_w('DEPARTURES')) // 2, 3, rgb('#FFDE78'))
    for i, (r, t) in enumerate(rows):
        y = 11 + i * 6
        a[y - 1, 3:-3] = (*rgb('#34304A'), 255)  # the flaps' split
        text(a, r, 4, y, rgb('#F2DCA0'))
        text(a, t, 68 - text_w(t) - 4, y, rgb('#FFDE78'))
        a[y + 1:y + 4, 65:68] = (*rgb('#7CE08A' if i == 0 else '#5A5670'), 255)
    return save_decal(a, 'station_departures')


def small_sign(s, name, fill=NAVY, ink='#F2DCA0'):
    a = panel(text_w(s) + 6, 9, fill, '#E8C060')
    text(a, s, 3, 2, rgb(ink))
    return save_decal(a, name)


def livery(s, name, ink, shade):
    """a train's name along its side: letters with a dark drop, on nothing (the hull shows round them)"""
    a = np.zeros((7, text_w(s) + 2, 4), np.uint8)
    text(a, s, 1, 2, rgb(shade))
    text(a, s, 0, 1, rgb(ink))
    return save_decal(a, name)


def tear(name, cols):
    """the portal: a tear in the sky, 5 m wide and 9.4 m tall (160 x 300 px), a lens with ragged edges that flicker
    out into sparks; inside, bands of colour streaming toward a bright seam down its middle"""
    w, h = 160, 300
    a = np.zeros((h, w, 4), np.uint8)
    rng = np.random.default_rng(len(name))
    yy, xx = np.mgrid[0:h, 0:w]
    v = (yy - (h - 1) / 2) / ((h - 1) / 2)  # -1 top to 1 bottom
    half = (w * 0.3) * (1 - np.abs(v) ** 1.8) ** 1.3 * (1 + 0.05 * np.sin(v * 9.0))  # a slit, widest a little above the middle
    rag = np.repeat(rng.normal(0, 1, (h // 4 + 1, 1)), 4, 0)[:h] * 3  # ragged edges, steps of 4 px
    rag2 = np.repeat(rng.normal(0, 1, (h // 4 + 1, 1)), 4, 0)[:h] * 3
    bend = 10 * np.sin(v * 2.4)  # the tear leans and bends a little
    u = xx - (w - 1) / 2 - bend
    left, right = -(half + rag), half + rag2
    inside = (u > left) & (u < right)
    k = np.zeros((h, w))
    span = np.maximum(right - left, 1)
    d = 1 - np.abs((u - (left + right) / 2) / (span / 2))  # 0 at the edge, 1 on the seam
    band = ((d * 3.0 + v * 2.2) % 1.0) > 0.6
    k = np.clip(d * (len(cols) - 1) + band * 0.8, 0, len(cols) - 1).astype(int)
    pal = np.array([rgb(c) for c in cols])
    a[..., :3] = pal[k]
    a[..., 3] = np.where(inside, 255, 0)
    edge = inside & (d < 0.08)
    a[edge, :3] = pal[-2]
    for _ in range(70):  # sparks off the edges
        y = int(rng.integers(8, h - 8))
        side = rng.choice([-1, 1])
        x = int((w - 1) / 2 + bend[y, 0] + side * (half[y, 0] + 3 + rng.integers(0, 14)))
        if 0 <= x < w - 1:
            a[y:y + 2, x:x + 2] = (*pal[-1], 255)
    return save_decal(a, name)


# ================================================================ Skyline Station
def lattice(L, x, y, h, foot=0.9, top=0.35, col=STEEL, name='pylon', step=3.0, base=0.0):
    """a lattice pylon: four legs leaning in from a concrete footing at base (under the ground: SINK), braced in X every
    few metres, a cap on top at h"""
    L.append(box(x, y, base, foot * 2 + 0.6, foot * 2 + 0.6, 0.4, CONCRETE, 'stone', name + ' footing'))
    at = lambda z, sx, sy: (x + sx * (foot + (top - foot) * (z - base) / (h - base)),
                            y + sy * (foot + (top - foot) * (z - base) / (h - base)), z)
    for sx in (-1, 1):
        for sy in (-1, 1):
            L.append(limb(at(base + 0.3, sx, sy), at(h, sx, sy), 0.08, 0.06, col, 'metal', name + ' leg', 5))
    n = max(1, int(round((h - base - 0.3) / step)))
    for i in range(n):
        z0, z1 = base + 0.3 + (h - base - 0.3) * i / n, base + 0.3 + (h - base - 0.3) * (i + 1) / n
        for (ax, ay), (bx, by) in (((-1, -1), (1, -1)), ((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1))):
            L.append(limb(at(z0, ax, ay), at(z1, bx, by), 0.035, 0.035, STEEL_D, 'metal', name + ' brace', 4))
            L.append(limb(at(z0, bx, by), at(z1, ax, ay), 0.035, 0.035, STEEL_D, 'metal', name + ' brace', 4))
    L.append(box(x, y, h, top * 2 + 0.5, top * 2 + 0.5, 0.25, STEEL_D, 'metal', name + ' cap'))


def beam(L, pts, name='rail'):
    """the rail: a steel tube 0.64 m thick (its top 0.32 m over the points), the guide rail on top, brass collars"""
    L.append({'k': 'limb', 'pts': [[r2(x), r2(y), r2(z), 0.32] for x, y, z in pts], 'sides': 8, 'col': STEEL, 'tex': 'metal', 'name': name})
    L.append({'k': 'limb', 'pts': [[r2(x), r2(y), r2(z + 0.34), 0.06] for x, y, z in pts], 'sides': 6, 'col': A['brass'], 'tex': 'metal',
              'name': name + ' guide'})
    for (x0, y0, z0), (x1, y1, z1) in zip(pts, pts[1:]):
        mx, my, mz = (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2
        d = math.hypot(x1 - x0, z1 - z0) or 1
        ux, uz = (x1 - x0) / d * 0.07, (z1 - z0) / d * 0.07
        L.append(limb((mx - ux, my, mz - uz), (mx + ux, my, mz + uz), 0.36, 0.36, A['copper'], 'metal', name + ' collar', 8))


def lamp(L, x, y, z, name='lamp'):
    """a lamp hung from the canopy: a rod, a copper hood, the lit glass"""
    L += [limb((x, y, z + 0.9), (x, y, z + 0.45), 0.02, 0.02, A['iron'], 'metal', name + ' rod', 4),
          cyl(x, y, z + 0.38, 0.2, 0.1, A['copper'], 'metal', name + ' hood', 8, k='cone', r1=0.05),
          img(LAMP, x, y, z - 0.12, glow=1, recv=0, sway=0, name=name + ' glass')]


def bench(L, x, y, face=1):
    """a station bench, facing +y (face 1) or -y"""
    L += [box(x, y, 1.33, 1.5, 0.42, 0.06, A['wood'], 'wood', 'bench seat'),
          box(x, y - face * 0.2, 1.39, 1.5, 0.05, 0.42, A['wood'], 'wood', 'bench back')]
    for sx in (-1, 1):
        L.append(box(x + sx * 0.65, y, 0.93, 0.06, 0.4, 0.42, A['iron'], 'metal', 'bench leg'))


def clock(L, x, y, z):
    """a two-faced clock hung under the ridge"""
    L.append(limb((x, y, z + 0.4), (x, y, z + 1.0), 0.025, 0.025, A['iron'], 'metal', 'clock rod', 4))
    L.append(limb((x, y - 0.11, z), (x, y + 0.11, z), 0.36, 0.36, A['brass'], 'metal', 'clock case', 16))
    for sy in (-1, 1):
        L.append(limb((x, y + sy * 0.1, z), (x, y + sy * 0.13, z), 0.3, 0.3, '#F4F0E4', 'plain', 'clock face', 16))
        yy = y + sy * 0.15
        L.append(limb((x, yy, z), (x, yy, z + 0.22), 0.018, 0.018, BOARD, 'plain', 'clock hand', 4))
        L.append(limb((x, yy, z), (x + 0.15, yy, z - 0.06), 0.018, 0.018, BOARD, 'plain', 'clock hand', 4))


def station():
    """Skyline Station. The platform runs along x (12 m), its front (-y) to the street with steps up in the middle; the
    trains stand behind it (+y) on the track bed, the rail on it running out of the right end (x 6.3) into sky_rail's
    flat piece. Built from y 0 at the steps' front, so the footprint (box 12.6 x 6.6) lies behind the base point."""
    L = []
    pd, top = 3.6, 0.93  # the platform's depth and its walking height
    y0 = 0.9  # the platform's front (the steps stand before it)
    yb = y0 + pd + 1.6  # the rail's middle behind the platform
    # the platform: stone, a pale coping, the yellow line at the boarding edge; steps up in the middle of the front
    L += [box(0, y0 + pd / 2, 0, 12, pd, 0.85, STONE, 'stone', 'platform'),
          box(0, y0 + pd / 2, 0.85, 12.2, pd + 0.2, 0.08, COPING, 'stone', 'coping'),
          box(0, y0 + pd - 0.12, top, 12, 0.18, 0.012, '#E8C040', 'plain', 'safety line')]
    for i in range(3):
        L.append(box(0, y0 - (3 - i) * 0.3 + 0.15, 0, 3.0, 0.3, (i + 1) * 0.29, COPING, 'stone', 'step'))
    for sx in (-1, 1):
        L.append(box(sx * 1.58, y0 - 0.45, 0, 0.16, 0.9, 0.95, STONE, 'stone', 'step cheek'))
    # the canopy: iron columns with brass capitals, beams, a verdigris roof with its ridge along the platform
    for x in (-5.0, -1.7, 1.7, 5.0):
        for y in (y0 + 0.5, y0 + pd - 0.5):
            L += [cyl(x, y, top, 0.09, 2.9, A['iron'], 'metal', 'column', 8),
                  box(x, y, top + 2.75, 0.3, 0.3, 0.15, A['brass'], 'metal', 'capital')]
    for y in (y0 + 0.5, y0 + pd - 0.5):
        L.append(box(0, y, top + 2.9, 12.4, 0.16, 0.16, A['iron'], 'metal', 'canopy beam'))
    rz, hl, hd = top + 3.06, 6.6, 2.7
    L.append(cyl(0, y0 + pd / 2, rz, hl * S2, 0.75, A['verd'], 'corrugated', 'canopy roof', 4, k='cone', ry=r2(hd * S2),
                 r1=r2(hl * S2), ry1=0.03, rot=r2(math.pi / 4)) | {'roof': 1})
    L.append(box(0, y0 + pd / 2, rz + 0.72, 13.3, 0.14, 0.08, A['copper'], 'metal', 'ridge cap'))
    for sy in (-1, 1):
        L.append(box(0, y0 + pd / 2 + sy * (hd + 0.02), rz - 0.1, 13.3, 0.06, 0.16, A['brass'], 'metal', 'fascia'))
    for sx in (-1, 1):  # the gable ends: a glazed fan under the roof's ends
        L.append(cyl(sx * (hl - 0.05), y0 + pd / 2, rz, 0.03 * S2, 0.7, '#9CC8D8', 'plain', 'gable glass', 4, k='cone',
                     ry=r2((hd - 0.2) * S2), r1=0.03 * S2, ry1=0.03, rot=r2(math.pi / 4)) | {'glass': 1 + (sx > 0)})
    # the name boards: over the steps to the street, and over the boarding edge to the trains
    nb = name_board()
    for y, yaw in ((y0 - 0.2, 0), (y0 + pd + 0.2, math.pi)):
        L.append(box(0, y, rz - 0.62, 2.35, 0.08, 0.5, NAVY, 'metal', 'name board'))
        for sx in (-1, 1):
            L.append(limb((sx * 0.9, y, rz - 0.12), (sx * 0.9, y, rz - 0.3), 0.02, 0.02, A['iron'], 'metal', 'board hanger', 4))
        L.append(img(nb, 0, y - 0.05 if not yaw else y + 0.05, rz - 0.6, face='fixed', yaw=r2(yaw), recv=0, sway=0, name='name board letters'))
    # the departures board, two-faced, hung between the columns on the left
    db = departures_board()
    bx, by_, bz = -3.35, y0 + pd / 2, top + 1.25
    L.append(box(bx, by_, bz, 2.4, 0.14, 1.5, BOARD, 'metal', 'departures board'))
    L.append(box(bx, by_, bz + 1.5, 2.5, 0.2, 0.08, A['brass'], 'metal', 'board top'))
    for sx in (-1, 1):
        L.append(limb((bx + sx * 1.0, by_, bz + 1.58), (bx + sx * 1.0, by_, rz - 0.05), 0.025, 0.025, A['iron'], 'metal', 'board hanger', 4))
    for sy, yaw in ((-1, 0), (1, math.pi)):
        L.append(img(db, bx, by_ + sy * 0.08, bz + 0.06, face='fixed', yaw=r2(yaw), recv=0, sway=0, glow=0.4, name='departures'))
    # the ticket kiosk on the right: panelled walls, a glazed window to the street, a copper dome
    kx, ky = 4.1, y0 + 1.25
    L += [box(kx, ky, top, 1.7, 1.5, 2.0, A['cream'], 'panels', 'kiosk'),
          box(kx, ky, top + 2.0, 1.85, 1.65, 0.1, A['wood'], 'wood', 'kiosk cornice'),
          {'k': 'dome', 'x': kx, 'y': ky, 'z': r2(top + 2.1), 'r': 0.85, 'ry': 0.75, 'h': 0.5, 'sides': 10, 'rings': 3,
           'col': A['copper'], 'tex': 'metal', 'name': 'kiosk dome', 'roof': 1},
          box(kx, ky - 0.76, top + 0.85, 1.1, 0.05, 0.75, A['glass'], 'plain', 'kiosk window') | {'glass': 3},
          box(kx, ky - 0.8, top + 0.8, 1.3, 0.12, 0.06, A['wood'], 'wood', 'kiosk counter')]
    L.append(img(small_sign('TICKETS', 'station_tickets'), kx, ky - 0.79, top + 1.7, face='fixed', recv=0, sway=0, name='tickets sign'))
    # a clock under the ridge, benches facing the trains, lamps
    clock(L, 0.0, y0 + pd / 2, rz - 0.75)
    bench(L, -0.9, y0 + pd - 1.0)
    bench(L, 1.6, y0 + pd - 1.0)
    bench(L, -5.0, y0 + 1.2, -1)
    for x in (-5.0, 0.0, 5.0):
        lamp(L, x, y0 + pd - 0.5 if x else y0 + 0.6, rz - 1.05)
    # the track bed behind, the rail on it (its right end meets sky_rail's flat piece), a buffer at its left end
    L.append(box(0, yb, 0, 12.6, 2.9, 0.12, '#8A8494', 'rock', 'track bed'))
    beam(L, [(-6.3, yb, 0.13), (-2.1, yb, 0.13), (2.1, yb, 0.13), (6.3, yb, 0.13)])
    L += [box(-6.0, yb, 0, 0.6, 1.2, 0.9, STEEL_D, 'metal', 'buffer'),
          box(-5.68, yb, 0.45, 0.06, 1.0, 0.35, '#D6403C', 'plain', 'buffer plate')]
    return rec(L, 0.7)


# ================================================================ the sky rail
RAIL_LEN = 12.0
Z_FLAT = 0.13  # the rail's middle out of the station (its top 0.45 m up)
CLIMB = 5.0  # what a straight piece climbs in its 12 m
# how far the rail's piers and pylons reach under their base: the hub's rail stands level with its station (a
# placement's y) out over the sea, about a metre lower, so its feet still go into the water (under the ground on land)
SINK = 2.5


def rail_piece(z0, z1, shape):
    """a 12 m piece of rail along x (-6 to 6), its middle from z0 to z1: 'flat', 'ease in' (flat to the climb), 'line',
    'ease out' (the climb to flat); its pylon at its right end (a low pier when it is near the ground)"""
    pts = []
    for i in range(9):
        t = i / 8
        k = {'flat': 0, 'ease in': t * t, 'line': t, 'ease out': 2 * t - t * t}[shape]
        pts.append((-RAIL_LEN / 2 + RAIL_LEN * t, 0, z0 + (z1 - z0) * k))
    L = []
    beam(L, pts)
    h = z1 - 0.69  # the cap and the saddle under the rail's bottom
    if h < 1.5:
        L += [box(RAIL_LEN / 2 - 0.6, 0, -SINK, 1.1, 1.4, max(0.2, h) + SINK, CONCRETE, 'stone', 'pier'),
              box(RAIL_LEN / 2 - 0.6, 0, max(0.2, h), 1.3, 1.6, 0.12, STEEL_D, 'metal', 'pier cap')]
    else:
        lattice(L, RAIL_LEN / 2 - 0.6, 0, h, base=-SINK)
        L.append(box(RAIL_LEN / 2 - 0.6, 0, h + 0.25, 0.9, 1.0, 0.12, A['brass'], 'metal', 'saddle'))
    if shape != 'flat' and z1 - z0 > 4:  # a mid pylon under the long climbs
        zm = pts[4][2] - 0.57
        lattice(L, 0, 0, zm, foot=0.75, top=0.3, base=-SINK)
    return rec(L, 0.7)


Z_TOP = Z_FLAT + CLIMB / 2 + CLIMB * 2 + CLIMB / 2  # the crest: ease in (half a climb), two straight, ease out (half)
RAIL_LOOKS = [  # (look, label, z0, z1, shape)
    ('', 'Sky rail (flat)', Z_FLAT, Z_FLAT, 'flat'),
    ('bend', 'Sky rail (bend)', Z_FLAT, Z_FLAT + CLIMB / 2, 'ease in'),
    ('rise', 'Sky rail (rise)', Z_FLAT + CLIMB / 2, Z_FLAT + CLIMB * 1.5, 'line'),
    ('rise_high', 'Sky rail (rise high)', Z_FLAT + CLIMB * 1.5, Z_FLAT + CLIMB * 2.5, 'line'),
    ('crest', 'Sky rail (crest)', Z_FLAT + CLIMB * 2.5, Z_TOP, 'ease out'),
]


# ================================================================ the sky portal
def emitter(L, x, y, z, ty, tz, spin_rps):
    """a floating stabiliser, Googie style: a chrome ball with its nose aimed at (ty, tz) in its own x plane, red fins
    out behind it, a brass ring round it turning like a planet's"""
    d = math.hypot(ty - y, tz - z) or 1
    ny, nz = (ty - y) / d, (tz - z) / d  # toward the target
    L.append(sphere(x, y, z - 0.55, 0.55, CHROME, 'metal', 'emitter', 14, 7) | {'h': 1.1})
    L.append(limb((x, y, z), (x, y + ny * 1.2, z + nz * 1.2), 0.3, 0.06, CHROME, 'metal', 'emitter nose', 10))
    L.append(sphere(x, y + ny * 1.25, z + nz * 1.25 - 0.12, 0.12, '#FFFCEC', 'plain', 'emitter tip', 8, 4) | {'h': 0.24})
    for f in (-1, 1):  # three fins out behind it: either side (across x) and one in its plane
        L.append(plank((x, y - ny * 0.3, z - nz * 0.3), (x + f * 0.8, y - ny * 1.0, z - nz * 1.0), 0.05, RED, 'emitter fin'))
    L.append(plank((x, y - ny * 0.3, z - nz * 0.3), (x, y - ny * 1.0 - nz * 0.7, z - nz * 1.0 + ny * 0.7), 0.05, RED, 'emitter fin'))
    ring = {'axis': 'z', 'x': r2(x), 'y': r2(y), 'z': r2(z), 'rps': spin_rps}
    n = 10
    P = lambda t: (x + 0.95 * math.cos(t), y + 0.95 * math.sin(t), z + 0.25 * math.sin(t))
    for i in range(n):
        L.append(limb(P(2 * math.pi * i / n), P(2 * math.pi * (i + 1) / n), 0.04, 0.04, A['brass'], 'metal', 'emitter ring', 5)
                 | {'spin': dict(ring)})


def sky_portal(tear_pic):
    """the tear in the sky at the rail's top. The rail climbs in from -x and stops at a launch lip on its last pylon
    (x -1.4); 3.4 m beyond it the tear hangs in the air (x 2), its middle a train's height over the rail, always turned
    to the eye (a picture, not a plane). Three chrome stabilisers float round it, aimed at it, and a brass hoop turns
    round its waist with lamps on it: a gateway in the sky as the old pulp covers drew one"""
    L = []
    xt, zt = 2.0, Z_TOP + 0.32 + 1.6  # the tear's middle
    beam(L, [(-8.0, 0, Z_TOP), (-5.0, 0, Z_TOP), (-2.0, 0, Z_TOP)])
    lattice(L, -4.0, 0, Z_TOP - 0.57, base=-SINK)
    L += [box(-1.7, 0, Z_TOP - 0.45, 0.6, 1.4, 0.95, STEEL_D, 'metal', 'launch lip'),
          box(-1.42, 0, Z_TOP + 0.1, 0.06, 1.2, 0.3, '#E8C040', 'plain', 'lip stripe')]
    for sy in (-1, 1):  # the lip's beacons
        L.append(sphere(-1.7, sy * 0.6, Z_TOP + 0.5, 0.12, '#FF6A4A', 'plain', 'beacon', 8, 4) | {'h': 0.24})
    L.append(img(tear_pic, xt, 0, r2(zt - 4.7), glow=1, recv=0, sway=0, name='portal'))
    for i, (y, z) in enumerate(((0.0, zt + 6.2), (-4.2, zt - 3.4), (4.2, zt - 3.4))):
        emitter(L, xt, y, z, 0.0, zt, 0.25 if i % 2 else -0.25)
    hoop = {'axis': 'z', 'x': xt, 'y': 0, 'z': r2(zt), 'rps': 0.08}
    P = lambda t: (xt + 3.4 * math.cos(t), 3.4 * math.sin(t), zt + 0.4 * math.sin(t * 2))
    n = 16
    for i in range(n):
        L.append(limb(P(2 * math.pi * i / n), P(2 * math.pi * (i + 1) / n), 0.07, 0.07, A['brass'], 'metal', 'hoop', 5) | {'spin': dict(hoop)})
    return rec(L, 0.65)


# ================================================================ the trains
ZC, R0 = 2.0, 1.15  # a round hull's middle and radius (bottom 0.85 m, top 3.15 m)


def skids(L, x0, x1):
    """hover skids either side of the rail, their glow strips under them, and the saddle between them over the rail"""
    for sy in (-1, 1):
        L += [box((x0 + x1) / 2, sy * 0.72, 0.52, x1 - x0, 0.3, 0.26, STEEL_D, 'metal', 'skid'),
              box((x0 + x1) / 2, sy * 0.72, 0.48, x1 - x0 - 0.3, 0.2, 0.04, GLOW, 'plain', 'skid glow')]
    L.append(box((x0 + x1) / 2, 0, 0.78, x1 - x0, 1.2, 0.14, STEEL, 'metal', 'saddle'))


def hull(L, x0, x1, col, tex, name, nose=1.2, tail=0.9, tip=0.35, droop=0.0, r=R0):
    """a round streamlined hull along x: full from x0 + tail to x1 - nose, tapering to tip at both ends (the nose may
    droop)"""
    pts = []
    for i in range(6):  # the tail
        t = i / 5
        pts.append([x0 + tail * t, 0, ZC, tip + (r - tip) * math.sin(t * math.pi / 2)])
    pts.append([x1 - nose, 0, ZC, r])
    for i in range(1, 7):  # the nose
        t = i / 6
        pts.append([x1 - nose + nose * t, 0, ZC - droop * t * t, r - (r - tip) * (1 - math.cos(t * math.pi / 2))])
    L.append({'k': 'limb', 'pts': [[r2(a), r2(b), r2(c), r2(d)] for a, b, c, d in pts], 'sides': 14, 'col': col, 'tex': tex, 'name': name})


def side_y(z, r=R0):
    """how far out a round hull's side is at a height"""
    return math.sqrt(max(0.0, r * r - (z - ZC) ** 2))


def windows_round(L, xs, g, z=ZC + 0.3, w=0.62, h=0.5, frame=None):
    """a window each side at each x on a round hull: glass a little proud of the side, a frame round it"""
    y = side_y(z) - 0.02
    for x in xs:
        for sy in (-1, 1):
            if frame: L.append(box(x, sy * y, z - h / 2 - 0.05, w + 0.1, 0.1, h + 0.1, frame, 'metal', 'window frame'))
            L.append(box(x, sy * (y + 0.03), z - h / 2, w, 0.1, h, A['glass'], 'plain', 'window') | {'glass': g[0]})
            g[0] = g[0] % 31 + 1


def windows_flat(L, xs, y, g, z=2.15, w=0.7, h=0.55, frame=None):
    for x in xs:
        for sy in (-1, 1):
            if frame: L.append(box(x, sy * y, z - h / 2 - 0.05, w + 0.1, 0.06, h + 0.1, frame, 'metal', 'window frame'))
            L.append(box(x, sy * (y + 0.02), z - h / 2, w, 0.06, h, A['glass'], 'plain', 'window') | {'glass': g[0]})
            g[0] = g[0] % 31 + 1


def doors(L, xs, y, col, z0=0.95, h=1.75):
    for x in xs:
        for sy in (-1, 1):
            L.append(box(x, sy * y, z0, 0.8, 0.06, h, col, 'panels', 'door'))


def headlamp(L, x, z, r=0.22, col=None):
    L.append(limb((x - 0.1, 0, z), (x + 0.06, 0, z), r + 0.06, r + 0.06, col or A['brass'], 'metal', 'headlamp rim', 12))
    L.append(img(LAMP, x + 0.12, -0.0, z - 0.25, glow=1, recv=0, sway=0, name='headlamp'))


def name_sides(L, pic, x, z, y):
    for sy, yaw in ((-1, 0), (1, math.pi)):
        L.append(img(pic, x, sy * y, z, face='fixed', yaw=r2(yaw), recv=0, sway=0, name='train name'))


def flame(name):
    """a rocket's plume, 2 m long (64 x 20 px), its root at the right: white core, yellow, orange, a ragged red tip"""
    w, h = 64, 20
    a = np.zeros((h, w, 4), np.uint8)
    rng = np.random.default_rng(7)
    yy, xx = np.mgrid[0:h, 0:w]
    t = (w - 1 - xx) / (w - 1)  # 0 at the root, 1 at the tip
    half = (h / 2 - 1) * (1 - t) ** 0.7 + rng.normal(0, 0.6, (h, w)) * t
    d = np.abs(yy - (h - 1) / 2)
    inside = d < half
    k = np.clip((d / np.maximum(half, 0.5)) * 2.2 + t * 2.2, 0, 3).astype(int)
    pal = np.array([rgb(c) for c in ('#FFFCEC', '#FFE08A', '#F49A3A', '#D6403C')])
    a[..., :3] = pal[k]
    a[..., 3] = np.where(inside, 255, 0)
    return save_decal(a, name)


FLAME = None


def rocket(L, x, y, z, r=0.36, col=None, band=None):
    """a rocket engine pointing back (-x), its nozzle at x: a chrome nacelle with a coloured band, red fins, a dark bell
    lit inside, the plume behind it (both faces of a fixed picture, so it reads from either side)"""
    global FLAME
    FLAME = FLAME or flame('train_rocket_flame')
    col = col or CHROME
    L += [limb((x + 1.9, y, z), (x + 0.5, y, z), r * 0.55, r, col, 'metal', 'rocket', 12),
          limb((x + 0.5, y, z), (x + 0.1, y, z), r, r * 0.95, col, 'metal', 'rocket', 12),
          limb((x + 0.95, y, z), (x + 0.75, y, z), r + 0.03, r + 0.03, band or RED, 'metal', 'rocket band', 12),
          limb((x + 0.12, y, z), (x - 0.35, y, z), r * 0.75, r * 1.15, '#2A2836', 'metal', 'rocket bell', 12),
          limb((x - 0.3, y, z), (x - 0.34, y, z), r * 1.0, r * 1.0, '#FFB45A', 'plain', 'rocket glow', 12)]
    for dy, dz in ((0, 1), (1, -0.6), (-1, -0.6)):  # three fins round its tail
        L.append(plank((x + 0.9, y + dy * r * 0.8, z + dz * r * 0.8), (x + 0.2, y + dy * (r + 0.45), z + dz * (r + 0.45)), 0.04, RED, 'rocket fin'))
    for yaw in (0, math.pi):
        L.append(img(FLAME, x - 1.35, y - 0.01 if not yaw else y + 0.01, z - 0.31, face='fixed', yaw=r2(yaw), glow=1, recv=0, sway=0,
                     name='rocket flame'))


def gangway(L, x, col):
    L.append(box(x, 0, 1.0, 0.36, 1.5, 1.7, col, 'cloth', 'gangway'))


def train_lakeland():
    """the Lakeland Clipper: a white and teal hydrofoil streamliner, foils out either side, a wave stripe, portholes"""
    W, T, Td = '#F2F0E6', '#2E9AA0', '#1E6E78'
    L, g = [], [1]
    skids(L, -5.4, 5.4)
    hull(L, 0.15, 5.7, W, 'panels', 'loco hull', nose=1.6, tail=0.2, tip=0.3)
    hull(L, -5.7, -0.15, W, 'panels', 'carriage hull', nose=0.2, tail=1.0, tip=0.45)
    gangway(L, 0, Td)
    for x0, x1 in ((0.2, 5.4), (-5.4, -0.2)):  # the teal band low on each side
        for sy in (-1, 1):
            L.append(limb((x0, sy * side_y(ZC - 0.45), ZC - 0.45), (x1, sy * side_y(ZC - 0.45), ZC - 0.45), 0.11, 0.11, T, 'metal', 'teal band', 6))
    for x in (-4.6, -3.4, -2.2, -1.0, 1.0):
        for sy in (-1, 1):
            B1.porthole(L, x, sy * (side_y(ZC + 0.3) + 0.02), ZC + 0.3, (0, sy, 0), 0.26, 'porthole')
    L.append(box(4.65, 0, ZC + 0.45, 0.9, 1.5, 0.45, A['glass'], 'plain', 'windscreen') | {'glass': 9})
    for x, sy in ((3.9, -1), (3.9, 1), (-3.0, -1), (-3.0, 1)):  # the foils: struts and blades
        y0 = sy * side_y(1.2)
        L.append(plank((x, y0, 1.2), (x, sy * 1.8, 0.75), 0.06, Td, 'foil strut'))
        L.append(box(x, sy * 1.85, 0.7, 1.5, 0.4, 0.06, T, 'metal', 'foil'))
    L.append(plank((-4.8, 0, ZC + 1.05), (-5.4, 0, ZC + 1.75), 0.09, T, 'tail fin'))
    headlamp(L, 5.62, ZC - 0.15, col=T)
    for sy in (-1, 1):
        rocket(L, -5.75, sy * 0.95, 1.35, band=T)
    name_sides(L, livery('LAKELAND CLIPPER', 'train_lakeland_name', '#1E6E78', '#C8D8D8'), 2.6, ZC - 0.35, side_y(ZC - 0.25) + 0.04)
    return rec(L, 0.7)


def train_greenbelt():
    """the Greenbelt Sunrunner: a green and brass solar loco, boxy, its roof a field of solar panels and a turning vent
    fan, a brass prow; a clerestory carriage behind"""
    G, Gd, BR = '#4E8A4A', '#3A6A3A', A['brass']
    L, g = [], [1]
    skids(L, -5.4, 5.2)
    L += [box(2.55, 0, 0.85, 4.8, 2.3, 2.05, G, 'panels', 'loco body'),
          box(2.55, 0, 2.9, 4.95, 2.45, 0.1, BR, 'metal', 'loco roof edge'),
          box(2.55, 0, 0.85, 4.9, 2.4, 0.14, BR, 'metal', 'loco sill')]
    L.append(limb((4.95, 0, 1.75), (5.75, 0, 1.35), 1.2, 0.35, BR, 'metal', 'prow', 4))
    L.append(box(4.98, 0, 2.05, 0.06, 1.7, 0.65, A['glass'], 'plain', 'cab window') | {'glass': 9})
    for x in (0.9, 1.75, 2.6, 3.45):  # the solar panels on short legs
        L.append(box(x, 0, 3.05, 0.78, 2.1, 0.06, '#3A4E7A', 'solar', 'solar panel'))
    L.append(cyl(4.3, 0, 3.0, 0.42, 0.28, Gd, 'metal', 'fan housing', 12))
    fan = {'axis': 'z', 'x': 4.3, 'y': 0, 'z': 3.3, 'rps': 1.2}
    for a in (0, 2.09, 4.19):
        L.append(plank((4.3, 0, 3.32), (4.3 + 0.36 * math.cos(a), 0.36 * math.sin(a), 3.32), 0.05, BR, 'fan blade') | {'spin': dict(fan)})
    windows_flat(L, (1.2, 2.4), 1.17, g, frame=BR)
    doors(L, (3.65,), 1.16, Gd)
    gangway(L, 0, Gd)
    L += [box(-2.85, 0, 0.85, 5.3, 2.3, 2.05, G, 'panels', 'carriage body'),
          box(-2.85, 0, 2.9, 5.45, 2.45, 0.1, BR, 'metal', 'carriage roof edge'),
          box(-2.85, 0, 0.85, 5.4, 2.4, 0.14, BR, 'metal', 'carriage sill'),
          box(-2.85, 0, 3.0, 3.6, 1.2, 0.42, Gd, 'panels', 'clerestory')]
    for sy in (-1, 1):
        L.append(box(-2.85, sy * 0.62, 3.12, 3.3, 0.04, 0.2, A['glass'], 'plain', 'clerestory glass') | {'glass': 10})
    windows_flat(L, (-4.6, -3.6, -2.6, -1.6), 1.17, g, frame=BR)
    doors(L, (-0.75,), 1.16, Gd)
    headlamp(L, 5.6, 1.55)
    for sy in (-1, 1):
        rocket(L, -5.75, sy * 0.85, 1.45, col=BR, band=Gd)
    name_sides(L, livery('GREENBELT SUNRUNNER', 'train_greenbelt_name', '#F2DCA0', '#2A4A2A'), 2.55, 1.05, 1.21)
    return rec(L, 0.7)


def train_wildwood():
    """the Wildwood Zephyr: a honey-wood tram carriage hung under a moss-green gasbag, brass bands round the bag, tail
    fins, two copper rocket engines on outriggers at the stern; skids under it all the same"""
    WD, CR, MOSS = A['wood'], A['cream'], '#7EA858'
    L, g = [], [1]
    skids(L, -4.4, 4.4)
    L += [box(0, 0, 0.85, 9.0, 2.2, 1.95, WD, 'wood', 'carriage'),
          box(0, 0, 1.75, 9.05, 2.25, 0.62, CR, 'panels', 'window band'),
          box(0, 0, 0.85, 9.1, 2.3, 0.12, A['dwood'], 'wood', 'sill')]
    L.append(cyl(0, 0, 2.8, 4.75 * S2, 0.55, '#5E8A4A', 'shingles', 'roof', 4, k='cone', ry=r2(1.25 * S2), r1=r2(4.75 * S2), ry1=0.03,
                 rot=r2(math.pi / 4)) | {'roof': 1})
    windows_flat(L, (-3.6, -2.4, -1.2, 0.0, 1.2, 2.4), 1.12, g, z=2.08, w=0.8, h=0.48)
    L.append(box(4.53, 0, 1.75, 0.06, 1.6, 0.6, A['glass'], 'plain', 'front window') | {'glass': 13})
    doors(L, (3.6,), 1.13, A['dwood'])
    # the gasbag and its bands, struts down to the roof
    zb = 5.1
    pts = [[-5.0, 0, zb, 0.4], [-4.3, 0, zb, 1.05], [-3.0, 0, zb, 1.4], [0, 0, zb, 1.5], [3.0, 0, zb, 1.4], [4.4, 0, zb, 0.95], [5.1, 0, zb, 0.3]]
    L.append({'k': 'limb', 'pts': pts, 'sides': 14, 'col': MOSS, 'tex': 'cloth', 'name': 'gasbag'})
    for x, r in ((-3.0, 1.42), (0, 1.52), (3.0, 1.42)):
        L.append(limb((x - 0.06, 0, zb), (x + 0.06, 0, zb), r + 0.02, r + 0.02, A['brass'], 'metal', 'gasbag band', 14))
    for x in (-3.0, 0.0, 3.0):
        for sy in (-1, 1):
            L.append(limb((x, sy * 1.0, 3.2), (x, sy * 0.95, zb - 1.3), 0.03, 0.03, A['iron'], 'metal', 'strut', 4))
    L += [plank((-4.2, 0, zb + 0.9), (-5.1, 0, zb + 1.7), 0.08, MOSS, 'tail fin'),
          box(-4.6, 0, zb - 0.05, 0.9, 3.0, 0.08, MOSS, 'cloth', 'tail plane')]
    # the rocket engines on outriggers from the bag
    for sy in (-1, 1):
        hy = sy * 1.75
        L.append(plank((-3.4, sy * 1.2, zb - 0.4), (-4.2, hy, zb - 0.6), 0.05, A['iron'], 'outrigger'))
        rocket(L, -5.2, hy, zb - 0.6, r=0.32, col=A['copper'], band=MOSS)
    headlamp(L, 4.6, 1.3)
    name_sides(L, livery('WILDWOOD ZEPHYR', 'train_wildwood_name', '#F2DCA0', '#4A3020'), 0.0, 1.05, 1.17)
    return rec(L, 0.7)


def train_highland():
    """the Highland Arrow: a silver maglev bullet, a long drooping nose, a red stripe, tail fins, a tapered tail"""
    SV, RD = '#E2E8F0', '#C8383C'
    L, g = [], [1]
    skids(L, -5.4, 5.4)
    hull(L, 0.15, 6.2, SV, 'metal', 'loco hull', nose=3.2, tail=0.2, tip=0.12, droop=0.6, r=1.1)
    hull(L, -5.9, -0.15, SV, 'metal', 'carriage hull', nose=0.2, tail=1.8, tip=0.2, r=1.1)
    gangway(L, 0, '#5A6278')
    for x0, x1 in ((0.2, 4.6), (-5.0, -0.2)):
        for sy in (-1, 1):
            L.append(limb((x0, sy * side_y(ZC - 0.2, 1.1), ZC - 0.2), (x1, sy * side_y(ZC - 0.2, 1.1), ZC - 0.2), 0.09, 0.09, RD, 'plain', 'stripe', 6))
    windows_round(L, (-4.2, -3.2, -2.2, -1.2, 0.9), g, w=0.7, h=0.42)
    L.append(plank((3.0, 0, ZC + 0.85), (4.4, 0, ZC + 0.25), 0.36, '#2E3E5C', 'cockpit glass') | {'glass': 12})
    L += [plank((-4.4, 0, ZC + 0.95), (-5.5, 0, ZC + 1.7), 0.08, RD, 'tail fin')]
    for sy in (-1, 1):
        L.append(plank((-4.6, sy * 0.85, ZC - 0.1), (-5.4, sy * 1.6, ZC - 0.25), 0.06, RD, 'stub fin'))
    headlamp(L, 6.05, ZC - 0.55, r=0.12, col=RD)
    for sy in (-1, 1):
        rocket(L, -6.05, sy * 0.85, 1.35, r=0.3)
    name_sides(L, livery('HIGHLAND ARROW', 'train_highland_name', '#C8383C', '#606878'), 2.0, ZC - 0.55, side_y(ZC - 0.45, 1.1) + 0.04)
    return rec(L, 0.7)


def train_harvest():
    """the Harvest Comet: a copper art-deco streamliner, a round bulb nose with speed whiskers, a cream window band,
    deco ribs on the roof, a great headlamp"""
    CU, OR, CR = A['copper'], '#F49A3A', A['cream']
    L, g = [], [1]
    skids(L, -5.4, 5.2)
    hull(L, 0.15, 5.0, CU, 'metal', 'loco hull', nose=0.3, tail=0.2, tip=0.9)
    L.append(sphere(4.85, 0, ZC - R0, R0, CU, 'metal', 'nose', 14, 6) | {'h': r2(2 * R0)})
    hull(L, -5.7, -0.15, CU, 'metal', 'carriage hull', nose=0.2, tail=0.6, tip=0.8)
    L.append(sphere(-5.55, 0, ZC - 0.95, 0.95, CU, 'metal', 'tail bulb', 12, 5) | {'h': 1.9})
    gangway(L, 0, A['dwood'])
    for x0, x1 in ((0.2, 4.6), (-5.4, -0.2)):  # the cream band the windows sit in
        for sy in (-1, 1):
            L.append(limb((x0, sy * (side_y(ZC + 0.3) - 0.08), ZC + 0.3), (x1, sy * (side_y(ZC + 0.3) - 0.08), ZC + 0.3), 0.3, 0.3, CR, 'panels', 'window band', 8))
    windows_round(L, (-4.5, -3.4, -2.3, -1.2, 1.0, 2.0), g, w=0.7, h=0.42)
    for i, dz in enumerate((-0.25, -0.5, -0.75)):  # the speed whiskers, sweeping back from the nose
        for sy in (-1, 1):
            z = ZC + dz
            L.append(limb((5.55 - i * 0.15, sy * side_y(z) * 0.55, z), (2.6 - i * 0.5, sy * (side_y(z) + 0.02), z), 0.05, 0.05, OR, 'plain', 'whisker', 5))
    for x in (2.4, 3.0, 3.6):
        L.append(box(x, 0, ZC + R0 - 0.1, 0.12, 0.5, 0.42, CR, 'metal', 'deco rib'))
    headlamp(L, 5.95, ZC + 0.05, r=0.32)
    for sy in (-1, 1):
        rocket(L, -6.0, sy * 0.95, 1.3, col=CU, band=OR)
    name_sides(L, livery('HARVEST COMET', 'train_harvest_name', '#F2DCA0', '#6A3A20'), -2.8, ZC - 0.65, side_y(ZC - 0.55) + 0.04)
    return rec(L, 0.7)


TRAINS = [  # (key, name, recipe): one per region theme (regions.json themes)
    ('train_lakeland', 'Lakeland Clipper', train_lakeland),
    ('train_greenbelt', 'Greenbelt Sunrunner', train_greenbelt),
    ('train_wildwood', 'Wildwood Zephyr', train_wildwood),
    ('train_highland', 'Highland Arrow', train_highland),
    ('train_harvest', 'Harvest Comet', train_harvest),
]
TRAIN_HALF = 1.3  # half a train's width: its footprint lies behind its base point, as a building's

# HB-8: each train's two homecoming looks (colour swaps of its own model): v 1 gold-trimmed after a won run, v 2
# battered and smoking after a lost one. The keys are the colours the train's recipe uses (above)
GOLD, GOLD_D, GOLD_L = '#E8B83A', '#B8862A', '#FFE08A'
SOOT, SOOT_D, RUST = '#7A766E', '#3E3A38', '#7A4A30'
TRAIN_LOOKS = {
    'train_lakeland': ({'#2E9AA0': GOLD, '#1E6E78': GOLD_D, CHROME: GOLD_L, RED: GOLD},
                       {'#F2F0E6': '#9A948A', '#2E9AA0': '#3E5A58', '#1E6E78': SOOT_D, CHROME: SOOT, RED: RUST}),
    'train_greenbelt': ({'#3A6A3A': GOLD_D, A['brass']: GOLD_L, RED: GOLD},
                        {'#4E8A4A': '#4E5644', '#3A6A3A': SOOT_D, A['brass']: RUST, RED: RUST}),
    'train_wildwood': ({A['brass']: GOLD_L, A['cream']: '#F8E4A0', '#7EA858': GOLD, RED: GOLD},
                       {'#7EA858': '#5A6448', A['wood']: '#6A5440', A['cream']: '#9A9080', A['brass']: RUST, RED: RUST}),
    'train_highland': ({'#C8383C': GOLD, CHROME: GOLD_L, RED: GOLD},
                       {'#E2E8F0': '#8A8C90', '#C8383C': '#6A3434', CHROME: SOOT, RED: RUST}),
    'train_harvest': ({'#F49A3A': GOLD, A['cream']: '#F8E4A0', RED: GOLD},
                      {A['copper']: '#6A4A38', A['cream']: '#8E8676', '#F49A3A': RUST, RED: RUST}),
}
# the battered look's smoke (fx, 32 px a metre from the base point; z metres back, the train's middle): the rockets and
# a split in the roof
TRAIN_SMOKE = [{'k': 'smoke', 'x': -176, 'y': -48, 'z': 1.3}, {'k': 'smoke', 'x': -40, 'y': -96, 'z': 1.3},
               {'k': 'smoke', 'x': 90, 'y': -88, 'z': 1.3}]


# HB-8: each train's carriage as the run's loading screen draws it (train-carriage.js): its wall, the trim round the
# windows and the rack, its seats, the shade under them; the bags on the rack; the portal's tunnel past the windows
CARRIAGES = {
    'train_lakeland': {'wall': '#E8E4D6', 'trim': '#2E9AA0', 'seat': '#1E6E78', 'dark': '#B8B2A0'},
    'train_greenbelt': {'wall': '#4E8A4A', 'trim': A['brass'], 'seat': '#8A3A2A', 'dark': '#3A6A3A'},
    'train_wildwood': {'wall': A['wood'], 'trim': A['brass'], 'seat': '#5E8A4A', 'dark': A['dwood']},
    'train_highland': {'wall': '#D6DCE6', 'trim': '#C8383C', 'seat': '#3A4660', 'dark': '#9AA2B2'},
    'train_harvest': {'wall': A['copper'], 'trim': A['cream'], 'seat': '#6A3A20', 'dark': '#9A5A34'},
}
CARRIAGE_BAGS = ['#8A5A34', '#3A4E7A', '#A04A3A', '#5E7C4E', '#6A4A70']
TUNNEL = ['#1A1240', '#2A1E5A', '#5A3AC8', '#3A8AE8', '#8FE4FF', '#F4FCFF']  # the tear's colours, darkest first


def train_variants(key, name):
    gold, bad = TRAIN_LOOKS[key]
    return [{'swap': gold, 'name': f'{name} (gold trim)'}, {'swap': bad, 'fx': TRAIN_SMOKE, 'name': f'{name} (battered)'}]


# ================================================================ the catalogue
def add_props(C):
    st = station()
    C['train_station'] = ISL.new_prop('train_station', 'Skyline Station', st, shadow=1.4, tags=('hub', 'station'), box_=(12.6, 6.6),
                                      vary=FIXED, about='Skyline Station (HB-7): the platform where runs start, its trains '
                                      'behind it (+y) on the rail, which runs out of its right end into sky_rail. Its act '
                                      '(station) comes from the map')
    flat = RAIL_LOOKS[0]
    C['sky_rail'] = ISL.new_prop('sky_rail', flat[1], rail_piece(*flat[2:]), shadow=0.6, tags=('hub', 'station'), solid=0.7,
                                 vary=FIXED, variants=[ISL.model_variant(f'sky_rail_{k}', label, rail_piece(z0, z1, sh), {'form': k})
                                                       for k, label, z0, z1, sh in RAIL_LOOKS[1:]],
                                 about='The sky rail (HB-7): 12 m pieces along x, chained end to end on one heading: flat, '
                                 'bend, rise, rise high, crest (the top, 15.5 m up), then sky_portal')
    blue = tear('sky_portal_tear', ['#2A1E5A', '#5A3AC8', '#3A8AE8', '#8FE4FF', '#F4FCFF'])
    gold = tear('sky_portal_tear_gold', ['#6A3A1A', '#C8702E', '#F4B44A', '#FFE08A', '#FFFCEC'])
    C['sky_portal'] = ISL.new_prop('sky_portal', 'Sky portal', sky_portal(blue), shadow=1.2, tags=('hub', 'station'), solid=1.2,
                                   vary=FIXED, glow={'c': '#7FD8FF', 'r': 6, 'y': r2(Z_TOP + 2), 'day': 0.5},
                                   variants=[{'swap': {blue: gold}, 'glow': {'c': '#FFC94A', 'r': 6, 'y': r2(Z_TOP + 2), 'day': 0.5},
                                              'name': 'Sky portal (gold)'}], tunnel=TUNNEL,
                                   about='The tear in the sky at the sky rail\'s top (HB-7): the rail climbs into it from -x and '
                                   'stops at a launch lip; HB-8 flies the train off it into the tear. Its gold look for the way '
                                   'home after a win')
    for key, name, fn in TRAINS:
        r = fn()
        B1.shift_y(r['layers'], TRAIN_HALF)
        C[key] = ISL.new_prop(key, name, r, group='sky_train', shadow=1.0, tags=('hub', 'station', 'train'), box_=(11.8, 2.6),
                              vary=FIXED, bob=0.04, variants=train_variants(key, name),
                              carriage={**CARRIAGES[key], 'bags': CARRIAGE_BAGS}, about=f'The {name} (HB-7), a sky '
                              "train for its region theme (regions.json, its theme's train): it rides the sky rail on its skids, "
                              'facing +x. HB-8: v 1 gold-trimmed (home from a won run), v 2 battered and smoking (a lost one)')


# ================================================================ the showcase map
def showcase():
    """test_station_trains: the station on the grass with the rail climbing east out over the sea to the portal; the
    other four trains in a row before it on flat pieces of rail"""
    W, H = 100, 46
    sea = 58

    def letter(x, z):
        if x >= sea + 10: return 'd'
        if x >= sea + 2: return 'w'
        if x >= sea: return 'S'
        if x >= sea - 5: return 's'
        if 13 <= z < 15 and x < sea - 5: return 'p'
        return 'g'
    tiles = [''.join(letter(x, H - 1 - row) for x in range(W)) for row in range(H)]
    P = []
    add = lambda k, x, z, **kw: P.append({'k': k, 'x': round(x, 2), 'z': round(z, 2), **kw})
    sx, sz = 14, 16  # the station's base point (the steps' front)
    rz = sz + 0.9 + 3.6 + 1.6  # the rail's middle (station(): y0 + pd + 1.6)
    add('train_station', sx, sz, act='station', label='Skyline Station')
    for i, (look, *_r) in enumerate(RAIL_LOOKS):
        add('sky_rail', sx + 6.3 + RAIL_LEN / 2 + RAIL_LEN * i, rz, **({'v': i} if i else {}))
    add('sky_portal', sx + 6.3 + RAIL_LEN * (len(RAIL_LOOKS) + 0.5), rz)
    add('train_greenbelt', sx - 0.5, rz - TRAIN_HALF, label='Greenbelt Sunrunner')
    for i, (key, name, _) in enumerate(t for t in TRAINS if t[0] != 'train_greenbelt'):
        x = 8 + i * 14
        add('sky_rail', x, 6.5)
        add(key, x, 6.5 - TRAIN_HALF, label=name)
    for x in (5, 24, 31):
        add('bench_wood', x, 12.4)
    shots = [{'x': 14, 'z': 9, 'yaw': 0, 'label': 'station'},
             {'x': 14, 'z': 27, 'yaw': 3.14, 'label': 'platform'},
             {'x': 22, 'z': 0, 'yaw': 0, 'label': 'trains'},
             {'x': 48, 'z': 4, 'yaw': 0, 'label': 'climb'},
             {'x': 68, 'z': 6, 'yaw': 0.4, 'label': 'portal'}]
    return {
        'name': 'Test: Skyline Station, the sky rail and the trains (hub track HB-7)', 'w': W, 'h': H, 'kind': 'test', 'test': 1,
        'edge': 'g', 'waterKind': 'sea', 'sky': ['#8CC6E6', '#BFE3EE', '#F4E8C8'], 'haze': '#EAD9C0', 'hazeD': 60,
        'cam': {'pitch': 30, 'h': 14, 'fov': 1, 'orbit': {'c': [44, 22], 'dead': 3, 'lag': 0.6, 'turn': 30}},
        'blur': 0, 'amb': None, 'plain': 1, 'tint': None, 'indoor': 0, 'far': 'hills', 'farH': 8, 'folk': 0,
        'exits': [], 'checks': [], 'shots': shots, 'hub': [14, 10], 'tiles': tiles, 'props': P,
    }


def main():
    ISL.PICS.mkdir(parents=True, exist_ok=True)
    D = gamedata.load()
    add_props(D['scenery']['props'])
    D['maps']['test_station_trains'] = showcase()
    gamedata.save(D)
    print('station and trains built: train_station, sky_rail (5 looks), sky_portal, ' + ', '.join(k for k, *_ in TRAINS))


if __name__ == '__main__':
    main()
