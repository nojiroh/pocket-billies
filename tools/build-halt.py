#!/usr/bin/env python3
"""Assets track AS-2: the sky train halt that stands on every run's landing, where the airship's mast stood. A country
halt in the props' low-poly style, its pictures (the name board, the kiosk's sign, the lamp's glass) painted at
48 px/m (docs/ART.md, "The style": crisp pixels, hue-shifted ramps, light planes, a coloured light line on lit
edges, outlines only where a form must separate).

  train_halt   a short brick platform with a pale coping and the yellow line, steps up in the middle of its front,
               a timber canopy with a verdigris roof and a fretted valance, a ticket kiosk with a solar panel and a
               stovepipe, a lamp post, the halt's name board, a bench facing the track, flower boxes, railings at the
               platform's ends; behind it (+y) the track on its ballast bed with a buffer stop at its left end, and
               at its right end the line curving away into the grass

Its platform is laid out as Skyline Station's (tools/build-station-trains.py station(); logic/train-path.js
TRAIN_RIDE and TRAIN_PLATFORM: the steps from y 0 to 0.9 up to the top 0.93 m over the ground, the boarding edge,
the track's line 6.1 m behind the front, the gap at x 0.35 where you cross between the benches), so the sky train's
ride sets down at it and you walk off it the way you do at the station (game/js/halt-arrival.js). Built from y 0 at
the steps' front, so the footprint (box 12.6 x 7.6) lies behind the base point, as every building's does.

    python3 tools/build-halt.py      # rerunnable; the model, its pictures, the catalogue entry, test_halt

The showcase map test_halt: game/index.html?test=1&scene=test_halt (or the Studio's test run).
Uses batch 1's parts (tools/build-props-batch1.py), the island batch's picture baker (tools/build-props-island.py)
and the station's track pieces (tools/build-station-trains.py).
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
ST = load('stations', 'build-station-trains.py')
PPM = 48  # the assets track's scale for new models and their pictures (docs/ART.md, "The style")
ISL.PICS = B1.ART / 'scene' / 'next' / 'halt'  # the fallback picture (the island batch's baker writes it here)
ISL.PPM = PPM  # the baker draws the fallback at the halt's own scale
A = B1.AIR
box, limb, cyl, sphere, img, r2 = B1.box, B1.limb, B1.cyl, B1.sphere, B1.img, B1.r2
S2 = math.sqrt(2)
DECALS = B1.NEXT / 'decals'
FIXED = {'rot': 0, 'lean': 0, 'size': 0}

# the platform as Skyline Station's (logic/train-path.js TRAIN_RIDE.track, TRAIN_PLATFORM)
Y0, PD, TOP = 0.9, 3.6, 0.93  # the platform's front, its depth, its walking height
YB = Y0 + PD + 1.6  # the track's line behind it: 6.1
HALF_LEN = 5.0  # the platform runs from x -5 to 5
TRACK = (-6.3, 6.3)  # the straight track under the train (11.8 m long, stopping at x -0.5)

# the materials, each a hue-shifted family (shadows cooler, lights warmer); the low-poly cells add the grain
BRICK, BRICK_D = '#B8664C', '#7E4A48'
COPING = '#E8DAB8'
TIMBER, TIMBER_D = '#3E7A58', '#2C5446'  # the halt's green paint
CREAM = '#F2E2BC'
ROOF = A['verd']
IRON = A['iron']
BALLAST, SLEEPER = ST.BALLAST, ST.SLEEPER
SOIL = '#7A6248'


def rec(L, cel=0.7):
    return {'ppm': PPM, 'cel': cel, 'layers': sorted(L, key=lambda l: l['k'] == 'img')}


# ================================================================ pictures, painted at 48 px/m
def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def put(a, x, y, col):
    if 0 <= y < a.shape[0] and 0 <= x < a.shape[1]: a[y, x] = (*rgb(col), 255)


def text(a, s, x, y, col, light=None):
    """the station's 3 x 5 letters, each with a warm light pixel on its top row when light is given (the lit edge)"""
    for ch in s:
        for j, row in enumerate(ST.GLYPHS[ch]):
            for k, c in enumerate(row):
                if c == '#': put(a, x + k, y + j, light if light and j == 0 else col)
        x += 4


def board(s, name, field=('#F6E8C4', '#EAD6A8', '#D2B888'), rim=('#5A3E30', '#8A5E40', '#C08A58'),
          ink='#2E5A44', ink_light='#4E8A62'):
    """a painted board: a wooden frame lit from above (its top a warm light line, its bottom and right side in shade),
    a cream field in three bands of its ramp (lighter at the top), the letters in the halt's green with a light top row,
    and a drop shadow of a darker field tone under them. field and rim run light, mid, shadow... as named"""
    w, h = ST.text_w(s) + 10, 13
    a = np.zeros((h, w, 4), np.uint8)
    dark, mid, lite = rim
    a[...] = (*rgb(mid), 255)
    a[0, 1:-1] = (*rgb(lite), 255)  # the lit top edge
    a[-1, :] = (*rgb(dark), 255)
    a[:, -1] = (*rgb(dark), 255)
    a[1:, 0] = (*rgb(mid), 255)
    a[0, 0] = a[0, -1] = 0  # rounded corners
    a[-1, 0] = a[-1, -1] = 0
    hi, md, sh = field
    a[2:-2, 2:-2] = (*rgb(md), 255)
    a[2:4, 2:-2] = (*rgb(hi), 255)
    a[-4:-2, 2:-2] = (*rgb(sh), 255)
    tx = (w - ST.text_w(s)) // 2
    text(a, s, tx + 1, 5, sh)  # the letters' drop
    text(a, s, tx, 4, ink, ink_light)
    # two brass screws, each a lit pixel and a shadow pixel
    for x in (3, w - 4):
        put(a, x, 3, '#F4D488')
        put(a, x, 4, '#9A7440')
    return B1.save_png(a, DECALS / f'{name}.png')


def lantern():
    """the lamp's glass, 14 x 18 px (0.29 x 0.38 m): a warm core falling off to amber at the frame, the iron frame's
    bars, a cool reflection pixel on the upper left"""
    w, h = 14, 18
    a = np.zeros((h, w, 4), np.uint8)
    cx, cy = (w - 1) / 2, h * 0.55
    ramp = ['#FFF6D4', '#FFE69A', '#FFCF6A', '#F0A24A']
    for y in range(2, h - 2):
        for x in range(2, w - 2):
            d = math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2))
            a[y, x] = (*rgb(ramp[min(3, int(d * 4.2))]), 255)
    frame = '#3A3446'
    a[0:2, 1:-1] = (*rgb(frame), 255)
    a[-2:, 1:-1] = (*rgb(frame), 255)
    a[1:-1, 0:2] = (*rgb(frame), 255)
    a[1:-1, -2:] = (*rgb(frame), 255)
    a[2:-2, w // 2] = (*rgb('#5A4A50'), 255)  # the middle bar
    a[1, 2:-2] = (*rgb('#6A6078'), 255)  # the frame's lit top
    put(a, 3, 3, '#FFFFFF')
    put(a, 3, 4, '#FFF6D4')
    return B1.save_png(a, DECALS / 'halt_lantern.png')


# ================================================================ the halt's parts
def steps(L):
    """three steps up to the platform in the middle of its front (x -1.1 to 1.5: the walk's gap at x 0.35 is on them),
    their cheeks in brick"""
    cx, w = 0.2, 2.6
    for i in range(3):
        L.append(box(cx, Y0 - (3 - i) * 0.3 + 0.15, 0, w, 0.3, (i + 1) * 0.29, COPING, 'stone', 'step'))
    for sx in (-1, 1):
        L.append(box(cx + sx * (w / 2 + 0.08), Y0 - 0.45, 0, 0.16, 0.9, 0.95, BRICK, 'brick', 'step cheek'))


def platform(L):
    """the brick platform, a darker plinth at its foot, the pale coping, the yellow line at the boarding edge"""
    L += [box(0, Y0 + PD / 2, 0, 2 * HALF_LEN, PD, 0.85, BRICK, 'brick', 'platform'),
          box(0, Y0 + PD / 2, 0, 2 * HALF_LEN + 0.06, PD + 0.06, 0.16, BRICK_D, 'stone', 'plinth'),
          box(0, Y0 + PD / 2, 0.85, 2 * HALF_LEN + 0.2, PD + 0.2, 0.08, COPING, 'stone', 'coping'),
          box(0, Y0 + PD - 0.14, TOP, 2 * HALF_LEN, 0.16, 0.012, '#E8C040', 'plain', 'safety line')]


def canopy(L):
    """four green posts with curved brackets, two beams, a hipped verdigris roof over the middle of the platform and a
    fretted valance (alternate long and short boards) round its eaves"""
    hl, hd = 3.3, 1.95  # the roof's half length and half depth
    yc = Y0 + PD / 2
    eave = TOP + 2.65
    for x in (-2.6, 2.6):
        for y in (Y0 + 0.55, Y0 + PD - 0.55):
            L.append(box(x, y, TOP, 0.16, 0.16, 2.6, TIMBER, 'wood', 'post'))
            L.append(box(x, y, TOP, 0.24, 0.24, 0.18, TIMBER_D, 'wood', 'post foot'))
            for sx in (-1, 1):  # a bracket each way along the beam
                L.append(limb((x + sx * 0.06, y, eave - 0.55), (x + sx * 0.5, y, eave - 0.05), 0.035, 0.035, TIMBER, 'wood', 'bracket', 4))
    for y in (Y0 + 0.55, Y0 + PD - 0.55):
        L.append(box(0, y, eave - 0.08, 2 * hl - 0.4, 0.18, 0.16, TIMBER_D, 'wood', 'beam'))
    L.append(cyl(0, yc, eave + 0.05, hl * S2, 0.85, ROOF, 'corrugated', 'canopy roof', 4, k='cone', ry=r2(hd * S2),
                 r1=r2((hl - 1.0) * S2), ry1=0.04, rot=r2(math.pi / 4)) | {'roof': 1})
    L.append(box(0, yc, eave + 0.86, 2 * (hl - 1.0) + 0.3, 0.12, 0.08, A['copper'], 'metal', 'ridge cap'))
    # the valance: boards hanging from the eaves along the front and the back, long and short by turns
    n = int(2 * hl / 0.18)
    for i in range(n):
        x = -hl + 0.09 + i * (2 * hl - 0.18) / (n - 1)
        h = 0.3 if i % 2 == 0 else 0.18
        for sy in (-1, 1):
            L.append(box(x, yc + sy * (hd + 0.02), eave + 0.04 - h, 0.12, 0.03, h, CREAM, 'battens', 'valance'))
    for sx in (-1, 1):
        L.append(box(sx * (hl + 0.02), yc, eave - 0.22, 0.03, 2 * hd, 0.26, CREAM, 'battens', 'valance end'))


def kiosk(L, pics):
    """the ticket kiosk at the platform's right end: cream boards on a green frame, a glazed window and a counter to the
    street, a hipped copper roof with a solar panel on its sunny side and a stovepipe"""
    kx, ky, kw, kd, kh = 3.75, Y0 + 1.15, 1.5, 1.4, 2.0
    L += [box(kx, ky, TOP, kw, kd, kh, CREAM, 'battens', 'kiosk'),
          box(kx, ky, TOP, kw + 0.08, kd + 0.08, 0.2, TIMBER_D, 'wood', 'kiosk skirting'),
          box(kx, ky, TOP + kh, kw + 0.16, kd + 0.16, 0.1, TIMBER, 'wood', 'kiosk cornice')]
    for sx in (-1, 1):
        for sy in (-1, 1):
            L.append(box(kx + sx * kw / 2, ky + sy * kd / 2, TOP, 0.1, 0.1, kh, TIMBER, 'wood', 'kiosk corner'))
    L += [box(kx, ky - kd / 2 - 0.01, TOP + 0.95, 0.9, 0.04, 0.7, A['glass'], 'plain', 'kiosk window') | {'glass': 3},
          box(kx, ky - kd / 2 - 0.05, TOP + 0.9, 1.1, 0.12, 0.06, A['wood'], 'wood', 'kiosk counter'),
          box(kx, ky - kd / 2 - 0.02, TOP + 1.68, 1.0, 0.04, 0.06, TIMBER_D, 'wood', 'window head')]
    rz = TOP + kh + 0.1
    L.append(cyl(kx, ky, rz, (kw / 2 + 0.2) * S2, 0.62, A['copper'], 'metal', 'kiosk roof', 4, k='cone',
                 ry=r2((kd / 2 + 0.2) * S2), r1=0.04, ry1=0.04, rot=r2(math.pi / 4)) | {'roof': 1})
    L.append(box(kx - 0.12, ky - 0.36, rz + 0.18, 0.62, 0.42, 0.05, '#2E4A6A', 'solar', 'solar panel'))
    L.append(limb((kx + 0.42, ky + 0.3, rz), (kx + 0.42, ky + 0.3, rz + 0.95), 0.06, 0.06, IRON, 'metal', 'stovepipe', 6))
    L.append(cyl(kx + 0.42, ky + 0.3, rz + 0.95, 0.11, 0.08, IRON, 'metal', 'stovepipe cap', 6, k='cone', r1=0.02))
    L.append(img(pics['tickets'], kx, ky - kd / 2 - 0.04, TOP + 1.82, face='fixed', recv=0, sway=0, name='tickets sign'))


def lamp_post(L, pics, x, y):
    """an iron lamp post on the platform: a fluted foot, the post, a scrolled arm and the lantern under a copper hood"""
    z0 = TOP
    L += [cyl(x, y, z0, 0.12, 0.3, IRON, 'metal', 'lamp foot', 8, k='cone', r1=0.06),
          limb((x, y, z0 + 0.3), (x, y, z0 + 2.7), 0.045, 0.035, IRON, 'metal', 'lamp post', 6),
          limb((x, y, z0 + 2.62), (x + 0.42, y, z0 + 2.62), 0.025, 0.025, IRON, 'metal', 'lamp arm', 4),
          sphere(x, y, z0 + 2.75, 0.07, A['brass'], 'metal', 'lamp finial', 6, 3),
          cyl(x + 0.42, y, z0 + 2.48, 0.19, 0.12, A['copper'], 'metal', 'lamp hood', 8, k='cone', r1=0.04),
          img(pics['lantern'], x + 0.42, y, z0 + 2.08, glow=1, recv=0, sway=0, name='lamp glass')]


def name_board(L, pics, x, y):
    """the halt's name on a board between two green posts, facing the street (and a second face to the trains)"""
    z = TOP + 1.55
    for sx in (-1, 1):
        L.append(box(x + sx * 0.72, y, TOP, 0.09, 0.09, 1.9, TIMBER, 'wood', 'sign post'))
    L.append(box(x, y, z - 0.04, 1.5, 0.06, 0.34, TIMBER_D, 'wood', 'name board'))
    for yaw, dy in ((0, -0.04), (math.pi, 0.04)):
        L.append(img(pics['name'], x, y + dy, z - 0.03, face='fixed', yaw=r2(yaw), recv=0, sway=0, name='name board letters'))


def bench(L, x, y):
    """a slatted bench facing the track (+y): green iron ends, three seat slats and two back slats"""
    for i in range(3):
        L.append(box(x, y - 0.12 + i * 0.12, TOP + 0.42, 1.5, 0.1, 0.05, A['plank'], 'wood', 'bench slat'))
    for i in range(2):
        L.append(box(x, y - 0.22, TOP + 0.58 + i * 0.16, 1.5, 0.04, 0.1, A['plank'], 'wood', 'bench back'))
    for sx in (-1, 1):
        L.append(box(x + sx * 0.68, y - 0.04, TOP, 0.06, 0.44, 0.47, TIMBER_D, 'metal', 'bench end'))
        L.append(box(x + sx * 0.68, y - 0.22, TOP + 0.47, 0.06, 0.06, 0.4, TIMBER_D, 'metal', 'bench end'))


def flower_box(L, x, y, seed):
    """a timber trough of flowers: soil, a leafy mound and a few blooms (warm reds, golds, a cool violet)"""
    rnd = np.random.default_rng(seed)
    L += [box(x, y, TOP, 0.9, 0.42, 0.34, TIMBER_D, 'wood', 'flower box'),
          box(x, y, TOP + 0.3, 0.82, 0.34, 0.05, SOIL, 'plain', 'soil'),
          sphere(x, y, TOP + 0.28, 0.42, '#5E9A48', 'leaves', 'flower leaves', 8, 3, lump=0.35, h=0.36) | {'ry': 0.2}]
    for i in range(6):
        col = ['#E2564A', '#F2C04A', '#9A6ACC', '#F4E4D0'][i % 4]
        L.append(sphere(x - 0.32 + i * 0.13, y + rnd.uniform(-0.1, 0.1), TOP + 0.5 + rnd.uniform(0, 0.08), 0.05, col, 'plain', 'bloom', 5, 2))


def railings(L, x, side):
    """a short iron railing across the platform's end"""
    y0, y1 = Y0 + 0.2, Y0 + PD - 0.35
    for y in np.linspace(y0, y1, 5):
        L.append(limb((x, y, TOP), (x, y, TOP + 0.95), 0.025, 0.025, IRON, 'metal', 'railing post', 4))
    for z in (TOP + 0.5, TOP + 0.92):
        L.append(limb((x, y0, z), (x, y1, z), 0.025, 0.025, IRON, 'metal', 'railing', 4))
    L.append(sphere(x, y0, TOP + 0.98, 0.04, A['brass'], 'metal', 'railing knob', 6, 3))


def parcels(L, x, y):
    """the halt's luggage: two parcels and a milk churn by the kiosk"""
    L += [box(x, y, TOP, 0.42, 0.34, 0.3, '#C89A64', 'cloth', 'parcel'),
          box(x + 0.05, y + 0.02, TOP + 0.3, 0.3, 0.26, 0.2, '#B07E52', 'cloth', 'parcel'),
          cyl(x + 0.5, y + 0.05, TOP, 0.16, 0.5, '#C8CCD4', 'metal', 'churn', 10),
          cyl(x + 0.5, y + 0.05, TOP + 0.5, 0.16, 0.12, '#C8CCD4', 'metal', 'churn neck', 10, k='cone', r1=0.08),
          cyl(x + 0.5, y + 0.05, TOP + 0.62, 0.1, 0.05, '#9AA0AC', 'metal', 'churn lid', 10)]


def track_bed(L):
    """the straight track behind the platform on its ballast bed, the buffer stop at its left end, and past its right end
    the line curving away from the street into the grass, its sleepers sinking as it goes (the line runs on beyond the
    halt, overgrown)"""
    L.append(box(0, YB, 0, TRACK[1] - TRACK[0], 2.9, 0.12, BALLAST, 'rock', 'track bed'))
    ST.track(L, TRACK[0], TRACK[1], YB)
    ST.buffer_stop(L, TRACK[0] + 0.3, YB, -1)
    # the curve: 6 m on a circle bending back (+y), as a polyline of rails and sleepers across it
    R, n = 22.0, 9
    cx, cy = TRACK[1], YB + R  # the circle's middle, so the curve leaves the straight line tangent to it
    pts = []
    for i in range(n + 1):
        a = -math.pi / 2 + (6.0 / R) * i / n
        pts.append((cx + R * math.cos(a) + 0, cy + R * math.sin(a), a, i / n))
    for sy in (-1, 1):
        rail = []
        for x, y, a, f in pts:
            nx, ny = -math.cos(a), -math.sin(a)  # toward the circle's middle
            rail.append([r2(x - nx * sy * ST.RAIL_GAUGE), r2(y - ny * sy * ST.RAIL_GAUGE), r2(0.28 - 0.18 * f), 0.06])
        L.append({'k': 'limb', 'pts': rail, 'sides': 4, 'col': ST.STEEL, 'tex': 'metal', 'name': 'rail'})
    for x, y, a, f in pts[1:]:
        nx, ny = -math.cos(a), -math.sin(a)
        z = 0.17 - 0.16 * f
        L.append(limb((x - nx * 1.05, y - ny * 1.05, z), (x + nx * 1.05, y + ny * 1.05, z), 0.07, 0.07, SLEEPER, 'wood', 'sleeper', 4))
        L.append(sphere(x, y, -0.05, 0.9, BALLAST, 'rock', 'ballast', 6, 2, lump=0.3, h=0.14 - 0.1 * f) | {'ry': 1.25})


def halt(pics):
    L = []
    platform(L)
    steps(L)
    canopy(L)
    kiosk(L, pics)
    lamp_post(L, pics, -4.35, Y0 + 0.4)
    name_board(L, pics, -2.9, Y0 + 0.3)
    bench(L, -1.5, Y0 + PD - 0.95)
    bench(L, 1.9, Y0 + PD - 0.95)
    flower_box(L, -4.4, Y0 + PD - 0.6, 3)
    flower_box(L, 4.4, Y0 + PD - 0.6, 5)
    railings(L, -HALF_LEN + 0.06, -1)
    railings(L, HALF_LEN - 0.06, 1)
    parcels(L, 2.65, Y0 + 0.55)
    track_bed(L)
    return rec(L, 0.7)


# ================================================================ the catalogue
def add_props(C):
    pics = {'name': board('SKY TRAIN HALT', 'halt_name'), 'tickets': board('TICKETS', 'halt_tickets'), 'lantern': lantern()}
    C['train_halt'] = ISL.new_prop('train_halt', 'Sky train halt', halt(pics), shadow=1.2, tags=('run', 'station'),
                                   box_=(12.6, 7.6), vary=FIXED, stand=[0, -1.4],
                                   fx=[{'k': 'glow', 'x': round(-3.93 * PPM), 'y': -round((TOP + 2.2) * PPM)}],
                                   about='The sky train halt (assets track AS-2) on every run\'s landing: a platform laid out '
                                   'as Skyline Station\'s, its track behind it (+y), where the run\'s sky train sets down '
                                   '(halt-arrival.js) and waits for the end of the run. stand: where you stand, metres '
                                   'from its base point (at the foot of its steps). Its act (fly) and label come from the map')
    C['train_halt']['ppm'] = PPM


# ================================================================ the showcase map
def showcase():
    """test_halt: the halt on the grass by a road, the Greenbelt Sunrunner parked at its platform"""
    W, H = 48, 34
    tiles = [''.join('p' if 7 <= (H - 1 - row) < 9 else 'g' for x in range(W)) for row in range(H)]
    P = []
    add = lambda k, x, z, **kw: P.append({'k': k, 'x': round(x, 2), 'z': round(z, 2), **kw})
    hx, hz = 22, 11
    add('train_halt', hx, hz, act='fly', label='Sky train halt')
    add('train_greenbelt', hx - 0.5, hz + YB - ST.TRAIN_HALF, label='Greenbelt Sunrunner')
    for x, z, k in ((6, 14, 'tree_oak_b'), (38, 16, 'tree_oak_b'), (9, 22, 'tree_oak_b'), (35, 25, 'tree_oak_b')):
        add(k, x, z)
    shots = [{'x': hx, 'z': hz - 9, 'yaw': 0, 'label': 'halt'},
             {'x': hx + 8, 'z': hz - 6, 'yaw': -0.5, 'label': 'side'},
             {'x': hx, 'z': hz + 15, 'yaw': 3.14, 'label': 'track side'}]
    return {
        'name': 'Test: the sky train halt (assets track AS-2)', 'w': W, 'h': H, 'kind': 'test', 'test': 1,
        'edge': 'g', 'sky': ['#8CC6E6', '#BFE3EE', '#F4E8C8'], 'haze': '#EAD9C0', 'hazeD': 60,
        'cam': {'pitch': 30, 'h': 14, 'fov': 1}, 'blur': 0, 'amb': None, 'plain': 1, 'tint': None, 'indoor': 0,
        'far': 'hills', 'farH': 8, 'folk': 0, 'exits': [], 'checks': [], 'shots': shots, 'hub': [hx, hz - 4],
        'tiles': tiles, 'props': P,
    }


def main():
    ISL.PICS.mkdir(parents=True, exist_ok=True)
    D = gamedata.load()
    add_props(D['scenery']['props'])
    D['maps']['test_halt'] = showcase()
    gamedata.save(D)
    print('the halt built: train_halt, test_halt')


if __name__ == '__main__':
    main()
