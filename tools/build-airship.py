#!/usr/bin/env python3
"""alpha 0.4: the airship and its mooring mast as a low-poly model, painted with the buildings' 32 px textures.

The model is made the way the 3D buildings are: few polygons, and on them the pixel textures of the building sheet
(scene/build/detail-*.png: 64 px cells, one cell covers 2 m, so 32 pixels to the metre, the same as the art), each in
its own colour through the game's five-tone ramp, lit and shaded by the scene like a house. What it is:

- the mast: a stone footing, four verdigris legs drawing in as they climb, a ring every 75 cm and a brace across each
  face, the gallery you board from (its rail opens where the gangplank meets it), the copper mooring cone, the beacon;
- the airship, moored by the nose of its balloon: a wooden ship (planked hull with a copper strake, the deck, rails, a
  white cabin at the stern with lit windows, a bowsprit) hung on its rigging well below a banded cream-and-copper
  balloon with verdigris tail fins, and a turbine either side of the stern whose brass propellers turn. The ship lies
  turned toward you, so you see its stern and its propellers.

Writes (new files; --force writes them again):
  game/art/scene/models/airship_mast.json   the model (vertex data in base64; the propellers as parts that turn)
  game/art/scene/build/detail-a04b.png      the building sheet with four more textures: balloon cloth, rivets, stripes, rings
  game/art/scene/props/airship_mast.png     its picture (Lite, and with 3D models off), rendered from the model
  game/art/map/airship.png                  the airship that carries you over the world map
and points the catalogue's airship_mast at the model.

    python3 tools/build-airship.py            # what is missing
    python3 tools/build-airship.py --force    # all of it again
    python3 tools/build-airship.py --views out.png   # the model from a few sides, for checking
"""
import gamedata  # phase 04b: the data files in game/data
import json, math, os, sys, base64, struct, random, importlib.util
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
ART = os.path.join(ROOT, 'game', 'art'); DATA = os.path.join(ROOT, 'game', 'data', 'gamedata.js')
MODEL_REL = 'scene/models/airship_mast.json'
SHIP_REL = 'scene/models/airship.json'   # alpha 0.4.1: the airship is a prop of its own, moored at the mast (same base point)
ATLAS_FROM, ATLAS_REL = 'scene/build/detail-a04.png', 'scene/build/detail-a04b.png'
T = 64                       # an atlas cell, in pixels; it covers 2 m
PPM = 32                     # the art: pixels to the metre
TEX = dict(plaster=0, siding=1, stone=3, batten=4, corrugated=6, metal=12, flat=13, planks=14, plain=15, cloth=18, rivets=19, stripes=20)
CREAM, COPPER, VERD, WOOD, DWOOD, PLANK = (240, 228, 200), (206, 124, 76), (98, 176, 152), (178, 118, 72), (132, 84, 60), (204, 150, 96)
IRON, LAMP, STONE, ROPE, BRASS, WHITE = (70, 84, 112), (255, 222, 120), (170, 166, 180), (110, 84, 60), (232, 192, 96), (236, 232, 222)
LIFT = 2.9                   # the balloon's middle above the deck
MAST_H = 8.2                 # the top of the lattice, where the cone holds the balloon's nose
GALLERY = 6.0                # the gallery you board from, level with the deck
YAW = 35                     # the ship lies turned this many degrees toward you (its stern comes forward)
BOW, LEN, BEAM, HD = 1.45, 4.4, .72, .95
RPS = 2.4                    # the propellers' turns a second


# ---------------------------------------------------------------------------------------------- vectors
def add(a, b): return (a[0] + b[0], a[1] + b[1], a[2] + b[2])
def sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def mul(a, k): return (a[0] * k, a[1] * k, a[2] * k)
def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def norm(a):
    l = math.sqrt(dot(a, a)) or 1.0; return (a[0] / l, a[1] / l, a[2] / l)
def lerp(a, b, t): return add(a, mul(sub(b, a), t))


class Mesh:
    """vertices (position in metres: x across, y up, z depth, away from you; normal; texture coordinates in metres;
    the atlas cell; flat: the colour as it is, no texture; the colour) and triangles"""
    def __init__(s): s.V, s.I = [], []

    def v(s, p, n, uv, tex, col, flat=0):
        s.V.append((tuple(p), tuple(n), tuple(uv), tex, flat, tuple(col))); return len(s.V) - 1

    def poly(s, P, UV, tex, col, flat=0, N=None):
        n = N or norm(cross(sub(P[1], P[0]), sub(P[2], P[0])))
        k = [s.v(P[j], n, UV[j], tex, col, flat) for j in range(len(P))]
        for j in range(1, len(P) - 1): s.I += [k[0], k[j], k[j + 1]]

    def add(s, o):
        b = len(s.V); s.V += o.V; s.I += [i + b for i in o.I]

    def turned(s, f, fn):
        o = Mesh(); o.V = [(f(p), fn(n), uv, t, fl, c) for (p, n, uv, t, fl, c) in s.V]; o.I = list(s.I); return o


def box(M, x0, x1, y0, y1, z0, z1, tex, col, skip=''):
    """an upright box, each face textured flat across it (in metres)"""
    F = {'X': ((-1, 0, 0), [(x0, y0, z1), (x0, y0, z0), (x0, y1, z0), (x0, y1, z1)], lambda p: (p[2], p[1])),
         'x': ((1, 0, 0), [(x1, y0, z0), (x1, y0, z1), (x1, y1, z1), (x1, y1, z0)], lambda p: (p[2], p[1])),
         'Y': ((0, -1, 0), [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], lambda p: (p[0], p[2])),
         'y': ((0, 1, 0), [(x0, y1, z0), (x0, y1, z1), (x1, y1, z1), (x1, y1, z0)], lambda p: (p[0], p[2])),
         'Z': ((0, 0, -1), [(x0, y0, z0), (x0, y1, z0), (x1, y1, z0), (x1, y0, z0)], lambda p: (p[0], p[1])),
         'z': ((0, 0, 1), [(x1, y0, z1), (x1, y1, z1), (x0, y1, z1), (x0, y0, z1)], lambda p: (p[0], p[1]))}
    for k, (n, P, uvf) in F.items():
        if k not in skip: M.poly(P, [uvf(p) for p in P], tex, col, N=n)


def frame_of(d):
    up = (0, 1, 0) if abs(d[1]) < .95 else (1, 0, 0)
    s = norm(cross(d, up)); t = cross(s, d); return s, t


def bar(M, a, b, w, tex, col, h=None, caps=True):
    """a square bar from a to b, w across (and h the other way)"""
    h = h or w; d = norm(sub(b, a)); s, t = frame_of(d); L = math.sqrt(dot(sub(b, a), sub(b, a)))
    C = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
    pa = [add(a, add(mul(s, u), mul(t, v))) for u, v in C]; pb = [add(b, add(mul(s, u), mul(t, v))) for u, v in C]
    off = 0.0
    for j in range(4):
        k = (j + 1) % 4; n = norm(add(mul(s, C[j][0] + C[k][0]), mul(t, C[j][1] + C[k][1])))
        e = w if j % 2 == 0 else h
        M.poly([pa[j], pa[k], pb[k], pb[j]], [(0, off), (0, off + e), (L, off + e), (L, off)], tex, col, N=n); off += e
    if caps:
        M.poly(pa[::-1], [(u, v) for u, v in C[::-1]], tex, col, N=mul(d, -1)); M.poly(pb, [(u, v) for u, v in C], tex, col, N=d)


def tube(M, a, b, r, tex, col, n=6, rb=None):
    """a round rod (or a cone, rb at b) from a to b, smooth"""
    rb = r if rb is None else rb; d = norm(sub(b, a)); s, t = frame_of(d)
    ring = lambda c, rr: [add(c, add(mul(s, math.cos(2 * math.pi * j / n) * rr), mul(t, math.sin(2 * math.pi * j / n) * rr))) for j in range(n)]
    loft(M, [ring(a, r), ring(b, rb)], tex, lambda i, j: col, closed=True, centres=[a, b])


def loft(M, rings, tex, colf, closed=True, centres=None, smooth=True, texf=None):
    """a skin through rings of points (each ring the same count, in order round it): texture coordinates in metres
    along (between the rings' middles) and round; normals smooth across the skin and pointing out from the middles;
    colf(i, j) the colour of the patch between rings i, i+1 and points j, j+1 (texf the same for its texture)"""
    R = len(rings); m = len(rings[0]); C = centres or [mul(tuple(map(sum, zip(*rg))), 1 / m) for rg in rings]
    along = [0.0]
    for i in range(1, R): along.append(along[-1] + math.sqrt(dot(sub(C[i], C[i - 1]), sub(C[i], C[i - 1]))))
    seg = m if closed else m - 1
    nrm = [[(0, 0, 0)] * m for _ in range(R)]
    for i in range(R - 1):
        for j in range(seg):
            k = (j + 1) % m; p00, p01, p10, p11 = rings[i][j], rings[i][k], rings[i + 1][j], rings[i + 1][k]
            n = cross(sub(p11, p00), sub(p01, p10))
            mid = mul(add(add(p00, p01), add(p10, p11)), .25); cm = mul(add(C[i], C[i + 1]), .5)
            if dot(n, sub(mid, cm)) < 0: n = mul(n, -1)
            for (a, b) in ((i, j), (i, k), (i + 1, j), (i + 1, k)): nrm[a][b] = add(nrm[a][b], n)
    for i in range(R):
        for j in range(m):
            if dot(nrm[i][j], nrm[i][j]) < 1e-12: nrm[i][j] = norm(sub(rings[i][j], C[i]))
            nrm[i][j] = norm(nrm[i][j])
    round_ = []
    for i in range(R):
        acc = [0.0]
        for j in range(1, m + 1): acc.append(acc[-1] + math.sqrt(dot(sub(rings[i][j % m], rings[i][j - 1]), sub(rings[i][j % m], rings[i][j - 1]))))
        round_.append(acc)
    for i in range(R - 1):
        for j in range(seg):
            k = (j + 1) % m; col = colf(i, j); tx = texf(i, j) if texf else tex
            P = [rings[i][j], rings[i + 1][j], rings[i + 1][k], rings[i][k]]
            UV = [(along[i], round_[i][j]), (along[i + 1], round_[i + 1][j]), (along[i + 1], round_[i + 1][j + 1]), (along[i], round_[i][j + 1])]
            if smooth:
                ks = [M.v(P[q], nrm[(i, i + 1, i + 1, i)[q]][(j, j, k, k)[q]], UV[q], tx, col) for q in range(4)]
                M.I += [ks[0], ks[1], ks[2], ks[0], ks[2], ks[3]]
            else:
                M.poly(P, UV, tx, col)


def cap(M, ring, centre, tex, col, out):
    """a flat lid over a ring (out: the way it faces)"""
    s, t = frame_of(out)
    for j in range(len(ring)):
        a, b = ring[j], ring[(j + 1) % len(ring)]
        P = [centre, a, b]; M.poly(P, [(dot(sub(p, centre), s), dot(sub(p, centre), t)) for p in P], tex, col, N=out)


# ---------------------------------------------------------------------------------------------- the mast
def hw(y): return .82 - (.82 - .26) * y / MAST_H          # from the mast's middle to a leg, at height y


def mast(th):
    M = Mesh()
    box(M, -.95, .95, 0, .25, -.95, .95, TEX['stone'], STONE)
    corners = ((-1, -1), (1, -1), (1, 1), (-1, 1))
    for sx, sz in corners:
        bar(M, (sx * hw(.25), .25, sz * hw(.25)), (sx * hw(MAST_H), MAST_H, sz * hw(MAST_H)), .12, TEX['rivets'], VERD)
    levels = [round(.25 + .75 * k, 3) for k in range(1, 12) if .25 + .75 * k < MAST_H - .2]
    for li, y in enumerate(levels):
        for f in range(4):
            (ax, az), (bx, bz) = corners[f], corners[(f + 1) % 4]; h = hw(y)
            bar(M, (ax * h, y, az * h), (bx * h, y, bz * h), .07, TEX['rivets'], VERD)
            if li + 1 < len(levels):
                y2 = levels[li + 1]; h2 = hw(y2)
                if (li + f) % 2: bar(M, (ax * h, y, az * h), (bx * h2, y2, bz * h2), .05, TEX['plain'], VERD, caps=False)
                else: bar(M, (bx * h, y, bz * h), (ax * h2, y2, az * h2), .05, TEX['plain'], VERD, caps=False)
    # the gallery, its rail open where the gangplank comes in
    g = hw(GALLERY) + .5; y0 = GALLERY
    box(M, -g, g, y0 - .08, y0, -g, g, TEX['planks'], PLANK)
    c, s = math.cos(th), math.sin(th)
    gate = lambda p: (p[0] * c - p[2] * s) > 0 and abs(p[0] * s + p[2] * c) < .3
    edge = [(-g, -g), (g, -g), (g, g), (-g, g)]
    for f in range(4):
        (ax, az), (bx, bz) = edge[f], edge[(f + 1) % 4]; n = 6
        pts = [(ax + (bx - ax) * k / n, az + (bz - az) * k / n) for k in range(n + 1)]
        for k in range(n + 1):
            p = (pts[k][0] * .97, y0, pts[k][1] * .97)
            if gate(p): continue
            bar(M, p, add(p, (0, .5, 0)), .045, TEX['plain'], IRON)
            if k < n:
                q = (pts[k + 1][0] * .97, y0, pts[k + 1][1] * .97)
                if gate(q) or gate(lerp(p, q, .5)): continue
                for hh in (.25, .5): bar(M, add(p, (0, hh, 0)), add(q, (0, hh, 0)), .04, TEX['plain'], IRON, caps=False)
    # the mooring cone, the spike, the beacon
    n = 10; rings = []
    for y, r in ((MAST_H, .44), (MAST_H + .12, .4), (MAST_H + .6, .07)):
        rings.append([(math.cos(2 * math.pi * j / n) * r, y, math.sin(2 * math.pi * j / n) * r) for j in range(n)])
    loft(M, rings, TEX['metal'], lambda i, j: COPPER if i else VERD, centres=[(0, MAST_H, 0), (0, MAST_H + .12, 0), (0, MAST_H + .6, 0)])
    cap(M, rings[0], (0, MAST_H, 0), TEX['metal'], COPPER, (0, -1, 0))
    tube(M, (0, MAST_H + .58, 0), (0, MAST_H + .8, 0), .025, TEX['plain'], IRON, n=4)
    bl = .065; yb = MAST_H + .86
    for a, b in (((0, yb + bl, 0), (0, yb - bl, 0)),):
        for k in range(4):
            q = (math.cos(k * math.pi / 2) * bl, yb, math.sin(k * math.pi / 2) * bl); q2 = (math.cos((k + 1) * math.pi / 2) * bl, yb, math.sin((k + 1) * math.pi / 2) * bl)
            M.poly([a, q, q2], [(0, 0), (.1, 0), (0, .1)], TEX['plain'], LAMP, flat=1); M.poly([b, q2, q], [(0, 0), (.1, 0), (0, .1)], TEX['plain'], LAMP, flat=1)
    return M


# ---------------------------------------------------------------------------------------------- the station
STATION_REL = 'scene/models/airship_station.json'
GLASS, DARK = (150, 196, 214), (60, 52, 64)
def station(th):
    """alpha 0.4.1: an airship station in the open, the mast at its back left (its foot is the base point, as the mast's
    is, so the airship moors to it the same way): a paved platform with a brass edge under where the ship hangs, a canopy
    of copper and glass on slender iron columns, a ticket kiosk with its awning and lit window, benches, two lamps and a
    glass lift cage running up inside the mast to the gallery. No rooms: tap it to fly."""
    M = mast(th)
    # the platform: flush paving with a brass kerb (you walk on it), x across under the ship
    x0, x1, z0, z1 = -1.3, 6.9, -3.3, 1.5
    box(M, x0, x1, 0, .05, z0, z1, TEX['stone'], (196, 188, 172))
    for a, b in (((x0, .07, z0), (x1, .07, z0)), ((x1, .07, z0), (x1, .07, z1)), ((x0, .07, z0), (x0, .07, z1))):
        bar(M, a, b, .1, TEX['metal'], BRASS, h=.06)
    # the lift cage up the mast: four glass sides and iron edges, a car at the bottom
    c = .34
    for (ax, az), (bx, bz) in (((-c, -c), (c, -c)), ((c, -c), (c, c)), ((c, c), (-c, c)), ((-c, c), (-c, -c))):
        M.poly([(ax, .25, az), (bx, .25, bz), (bx, GALLERY, bz), (ax, GALLERY, az)], [(0, 0), (.7, 0), (.7, GALLERY), (0, GALLERY)], TEX['plain'], GLASS)
    for sx, sz in ((-c, -c), (c, -c), (c, c), (-c, c)): bar(M, (sx, .25, sz), (sx, GALLERY, sz), .05, TEX['plain'], IRON)
    box(M, -.3, .3, .25, 2.2, -.3, .3, TEX['metal'], BRASS, skip='Y')
    # the canopy: six iron columns, a shallow copper roof with a glass middle, a fascia all round
    cx0, cx1, cz0, cz1, ch = 1.6, 6.4, -2.9, -.3, 3.0
    for x in (cx0 + .15, (cx0 + cx1) / 2, cx1 - .15):
        for z in (cz0 + .15, cz1 - .15):
            tube(M, (x, .05, z), (x, ch, z), .07, TEX['plain'], IRON, n=6)
            box(M, x - .14, x + .14, .05, .25, z - .14, z + .14, TEX['stone'], STONE)
    rise = .45
    for zA, zB, col, tx in ((cz0 - .2, (cz0 + cz1) / 2, COPPER, TEX['metal']), ((cz0 + cz1) / 2, cz1 + .2, COPPER, TEX['metal'])):
        yA = ch if zA < (cz0 + cz1) / 2 else ch + rise; yB = ch + rise if zA < (cz0 + cz1) / 2 else ch
        M.poly([(cx0 - .2, yA, zA), (cx1 + .2, yA, zA), (cx1 + .2, yB, zB), (cx0 - .2, yB, zB)], [(0, 0), (cx1 - cx0 + .4, 0), (cx1 - cx0 + .4, 1.4), (0, 1.4)], tx, col)
    zm = (cz0 + cz1) / 2
    box(M, cx0 + .6, cx1 - .6, ch + rise - .02, ch + rise + .22, zm - .35, zm + .35, TEX['plain'], GLASS)
    for a, b in (((cx0 - .2, ch, cz0 - .2), (cx1 + .2, ch, cz0 - .2)), ((cx0 - .2, ch, cz1 + .2), (cx1 + .2, ch, cz1 + .2))):
        bar(M, a, b, .08, TEX['plain'], VERD, h=.18)
    # the ticket kiosk at the back: panelled wood, a lit window, a striped awning, a brass sign
    kx0, kx1, kz0, kz1, kh = 4.4, 6.4, .2, 1.4, 2.5
    box(M, kx0, kx1, .05, kh, kz0, kz1, TEX['batten'], (120, 150, 132))
    box(M, kx0 - .08, kx1 + .08, kh, kh + .14, kz0 - .1, kz1 + .1, TEX['plain'], DWOOD)
    M.poly([(kx0 + .35, 1.0, kz0 - .01), (kx0 + .35, 1.9, kz0 - .01), (kx1 - .35, 1.9, kz0 - .01), (kx1 - .35, 1.0, kz0 - .01)], [(0, 0), (0, 1), (1, 1), (1, 0)], TEX['plain'], LAMP, flat=1)
    box(M, kx0 + .25, kx1 - .25, .92, 1.0, kz0 - .25, kz0, TEX['planks'], PLANK)
    M.poly([(kx0 - .1, 2.15, kz0 - .7), (kx1 + .1, 2.15, kz0 - .7), (kx1 + .1, 2.3, kz0 - .02), (kx0 - .1, 2.3, kz0 - .02)], [(0, 0), (2.2, 0), (2.2, .7), (0, .7)], TEX['stripes'], (226, 92, 80))
    box(M, kx0 + .3, kx1 - .3, kh + .2, kh + .55, kz0 + .3, kz0 + .38, TEX['metal'], BRASS)
    # benches under the canopy
    for bx in (2.2, 3.9):
        box(M, bx, bx + 1.2, .42, .5, -2.3, -1.9, TEX['planks'], PLANK)
        box(M, bx, bx + 1.2, .5, .9, -1.95, -1.88, TEX['planks'], PLANK)
        for lx in (bx + .1, bx + 1.05): box(M, lx, lx + .06, .05, .42, -2.25, -1.95, TEX['plain'], IRON)
    # two lamps at the front corners
    for lx, lz in ((-.9, -2.9), (6.6, -2.9)):
        tube(M, (lx, .05, lz), (lx, 3.1, lz), .05, TEX['plain'], IRON, n=6)
        box(M, lx - .14, lx + .14, 3.1, 3.42, lz - .14, lz + .14, TEX['plain'], LAMP)
        box(M, lx - .18, lx + .18, 3.42, 3.5, lz - .18, lz + .18, TEX['metal'], VERD)
    return M
STATION_LAMPS = ((-.9, 3.26, -2.9), (6.6, 3.26, -2.9), (5.4, 1.45, .19))


# ---------------------------------------------------------------------------------------------- the airship
def half_beam(u):
    return BEAM * (min(1, u / .36)) ** .62 if u < .36 else BEAM * (1 - .12 * max(0, u - .85) / .15)


def keel_y(u):
    k = GALLERY - HD
    if u < .25: k += (.25 - u) / .25 * .38 * HD               # the bow rises from the keel
    if u > .9: k += (u - .9) / .1 * .1
    return k


def ship(props, moored=True):
    """the airship along +x, its bow at BOW by the mast, its deck level with the gallery; the propellers go into props
    as (pivot, axis, mesh); moored: with its gangplank and its mooring line"""
    M = Mesh(); stern = BOW + LEN; D = GALLERY
    # the hull: rings from the bow to the stern, each a U from the port rail down round the keel to the starboard rail
    us = [0, .03, .08, .16, .26, .38, .5, .62, .74, .86, .95, 1.0]
    hs = [1, .88, .78, .55, .3, .1, 0]
    rings, cents = [], []
    for u in us:
        x = BOW + u * LEN; b = half_beam(u); ky = keel_y(u); ring = []
        for h in hs:
            w = b * (.42 + .58 * h ** .65); ring.append((x, ky + h * (D - ky), -w))
        ring.append((x, ky - .05, 0))
        for h in reversed(hs):
            w = b * (.42 + .58 * h ** .65); ring.append((x, ky + h * (D - ky), w))
        rings.append(ring); cents.append((x, (ky + D) / 2, 0))
    band = lambda j: min(j, 2 * len(hs) - 1 - j)                # how far round from the rail: 0 the top plank
    hcol = lambda i, j: COPPER if band(j) == 1 else WOOD if band(j) < 4 else DWOOD
    loft(M, rings, TEX['planks'], hcol, closed=False, centres=cents, texf=lambda i, j: TEX['metal'] if band(j) == 1 else TEX['planks'])
    cap(M, rings[-1], cents[-1], TEX['planks'], DWOOD, (1, 0, 0))   # the transom
    # the deck, planked along the ship
    for i in range(len(us) - 1):
        a, b = rings[i], rings[i + 1]; P = [a[0], b[0], b[-1], a[-1]]
        M.poly([(p[0], D + .005, p[2]) for p in P], [(p[0], p[2]) for p in P], TEX['planks'], PLANK, N=(0, 1, 0))
    # the rails: posts and a top rail along both sides
    for side in (-1, 1):
        prev = None; x = BOW + .3
        while x < stern - .05:
            u = (x - BOW) / LEN; zz = side * (half_beam(u) - .04); p = (x, D, zz)
            bar(M, p, add(p, (0, .36, 0)), .045, TEX['plain'], DWOOD)
            if prev: bar(M, add(prev, (0, .36, 0)), add(p, (0, .36, 0)), .05, TEX['planks'], WOOD, caps=False)
            prev = p; x += .4
    # the cabin at the stern: white boards, a copper roof, lit windows, a door
    c0, c1 = stern - 1.75, stern - .45; cw = .48
    box(M, c0, c1, D, D + .9, -cw, cw, TEX['batten'], WHITE, skip='Y')
    box(M, c0 - .08, c1 + .08, D + .9, D + .98, -cw - .08, cw + .08, TEX['metal'], COPPER)
    for side in (-1, 1):
        for k in range(3):
            xa = c0 + .2 + k * .38; z = side * (cw + .004); P = [(xa, D + .42, z), (xa + .22, D + .42, z), (xa + .22, D + .66, z), (xa, D + .66, z)]
            M.poly(P, [(0, 0)] * 4, TEX['plain'], LAMP, flat=1, N=(0, 0, side))
            for (p, q) in ((P[0], P[1]), (P[3], P[2])): bar(M, add(p, (0, 0, side * .01)), add(q, (0, 0, side * .01)), .03, TEX['plain'], COPPER, caps=False)
    P = [(c0 - .004, D, -.16), (c0 - .004, D, .16), (c0 - .004, D + .7, .16), (c0 - .004, D + .7, -.16)]
    M.poly(P, [(p[2], p[1]) for p in P], TEX['planks'], DWOOD, N=(-1, 0, 0))
    # the bowsprit
    tube(M, (BOW + .15, D + .02, 0), (BOW - .7, D + .5, 0), .045, TEX['plain'], DWOOD, n=6, rb=.025)
    # the balloon, banded, longer than the hull; its nose at the mast's cone
    hc = (BOW + stern) / 2; cy = D + LIFT; rx, ry, rz = LEN / 2 + 1.0, 1.2, 1.15; nose = hc - rx
    xs = sorted(set([0, .05, .14, .28] + [round(.3 * k, 3) for k in range(1, 22)] + [6.12, 6.26, 6.35, 6.4]))
    xs = [x for x in xs if x <= 2 * rx]; n = 18; rings, cents = [], []
    for uu in xs:
        t = uu / rx - 1; r = math.sqrt(max(0, 1 - t * t)) * (1 - .1 * max(0, t)); x = nose + uu
        rings.append([(x, cy + math.cos(2 * math.pi * j / n) * ry * r, math.sin(2 * math.pi * j / n) * rz * r) for j in range(n)]); cents.append((x, cy, 0))
    def bcol(i, j):
        mid = (xs[i] + xs[i + 1]) / 2
        return COPPER if (int(mid / .6) % 2 == 1 and .4 < mid < 2 * rx - .5) else CREAM
    loft(M, rings, TEX['cloth'], bcol, centres=cents)
    # tail fins: one up, one to each side, swept back
    tail = nose + 2 * rx
    def fin(dirv):
        root = [(tail - 1.5, None), (tail - .25, None)]
        pts = []
        for x, _ in root:
            uu = x - nose; t = uu / rx - 1; r = math.sqrt(max(0, 1 - t * t)) * (1 - .1 * max(0, t))
            pts.append((x, cy + dirv[1] * ry * r * .9, dirv[2] * rz * r * .9))
        tip0 = (tail - .55, cy + dirv[1] * (ry * .55 + .75), dirv[2] * (rz * .55 + .75)); tip1 = (tail + .08, cy + dirv[1] * (ry * .45 + .72), dirv[2] * (rz * .45 + .72))
        P = [pts[0], pts[1], tip1, tip0]; nn = norm(cross(sub(P[1], P[0]), sub(P[3], P[0])))
        for sgn in (1, -1):
            Q = [add(p, mul(nn, .02 * sgn)) for p in P]
            M.poly(Q if sgn > 0 else Q[::-1], [(q[0], q[1] + q[2]) for q in (Q if sgn > 0 else Q[::-1])], TEX['metal'], VERD, N=mul(nn, sgn))
    for dv in ((0, 1, 0), (0, 0, 1), (0, 0, -1)): fin(dv)
    # the rigging: ropes from the rails up to the balloon's belly
    for xr in (hc - LEN * .36, hc - LEN * .04, hc + LEN * .28):
        u = (xr - BOW) / LEN; b = half_beam(u); uu = xr - nose; t = uu / rx - 1; r = math.sqrt(max(0, 1 - t * t))
        for side in (-1, 1):
            a = (xr, D + .36, side * (b - .04)); top = (xr + .05, cy - ry * r * .86, side * rz * r * .5)
            tube(M, a, top, .018, TEX['plain'], ROPE, n=4)
    # the gangplank from the mast's gallery to the bow
    if moored: box(M, .7, BOW + .15, D - .06, D, -.17, .17, TEX['planks'], PLANK)
    # the mooring line from the cone to the balloon's nose
    if moored: tube(M, (.05, MAST_H + .52, 0), (nose + .06, cy, 0), .02, TEX['plain'], ROPE, n=4)
    # two turbines at the stern, out on struts, and their propellers
    ty_ = D + .35
    for side in (-1, 1):
        tz = side * (BEAM + .55); x0 = stern - .7
        st = [(0, .1), (.05, .2), (.12, .27), (.25, .34), (.5, .34), (.58, .34), (.85, .34), (.93, .34), (1.05, .3), (1.1, .26)]
        n = 12; rings = [[(x0 + xf, ty_ + math.cos(2 * math.pi * j / n) * r, tz + math.sin(2 * math.pi * j / n) * r) for j in range(n)] for xf, r in st]
        cents = [(x0 + xf, ty_, tz) for xf, _ in st]
        loft(M, rings, TEX['rivets'], lambda i, j: VERD if i in (4, 6) else COPPER, centres=cents)
        cap(M, rings[0], cents[0], TEX['rivets'], COPPER, (-1, 0, 0)); cap(M, rings[-1], cents[-1], TEX['plain'], IRON, (1, 0, 0))
        u = (stern - .25 - BOW) / LEN
        bar(M, (stern - .3, ty_, side * (half_beam(u) - .1)), (stern - .3, ty_, tz - side * .3), .08, TEX['rivets'], IRON)
        bar(M, (stern - .3, ty_ - .15, side * (half_beam(u) - .1)), (stern - .3, ty_ - .05, tz - side * .25), .05, TEX['plain'], IRON, caps=False)
        # the propeller: a brass hub and three twisted blades, turning about the ship's length
        Pm = Mesh(); px = stern + .5; pv = (px, ty_, tz)
        tube(Pm, (stern + .4, ty_, tz), (px + .06, ty_, tz), .1, TEX['plain'], BRASS, n=8, rb=.06)
        tube(Pm, (px + .06, ty_, tz), (px + .16, ty_, tz), .06, TEX['plain'], IRON, n=8, rb=.01)
        for k in range(3):
            an = math.pi / 2 + k * 2 * math.pi / 3; ca, sa = math.cos(an), math.sin(an)
            def bp(rad, wid, off):          # a point on the blade: rad out along it, wid across it (twisted by the pitch)
                tw = math.radians(28) * (1 - .4 * rad / .8)
                return (px + wid * math.sin(tw) + off, ty_ + ca * rad - sa * wid * math.cos(tw), tz + sa * rad + ca * wid * math.cos(tw))
            for off in (-.012, .012):
                P = [bp(.07, -.06, off), bp(.07, .06, off), bp(.45, .1, off), bp(.8, .055, off), bp(.8, -.04, off), bp(.45, -.08, off)]
                Pm.poly(P if off > 0 else P[::-1], [(q[1], q[2]) for q in (P if off > 0 else P[::-1])], TEX['plain'], BRASS)
        props.append((pv, (1, 0, 0), Pm))
    return M


def build(th=None, what='both'):
    """(the still model, [(pivot, axis, mesh) of each propeller]), the ship turned th radians toward you.
    what: 'both', 'mast' (the tower alone) or 'ship' (the airship alone, in the same metres: its base point is the mast's foot)"""
    th = math.radians(YAW) if th is None else th
    c, s = math.cos(th), math.sin(th)
    rot = lambda p: (p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c)
    P = []; Sm = ship(P); M = station(th) if what == 'station' else mast(th) if what != 'ship' else Mesh()
    if what in ('both', 'ship'): M.add(Sm.turned(rot, rot))
    return M, ([] if what in ('mast', 'station') else [(rot(pv), rot(ax), pm.turned(rot, rot)) for pv, ax, pm in P])


# ---------------------------------------------------------------------------------------------- the file
def pack(M):
    """the vertex data the game reads: 24 bytes a vertex (position in 1/256 m as int16, normal as int8, texture
    coordinates in 1/64 m as int16, atlas cell x, y and flat as uint8, the colour as uint8), then the triangles (uint16)"""
    b = bytearray()
    for (p, n, uv, tex, flat, col) in M.V:
        b += struct.pack('<hhhxx', *(int(round(v * 256)) for v in p))
        b += struct.pack('<bbbx', *(int(round(max(-1, min(1, v)) * 127)) for v in n))
        b += struct.pack('<hh', int(round(uv[0] * 64)), int(round(uv[1] * 64)))
        b += struct.pack('<BBBx', tex % 8, tex // 8, 1 if flat else 0)
        b += struct.pack('<BBBB', col[0], col[1], col[2], 255)
    assert len(M.V) < 65536
    b += struct.pack('<%dH' % len(M.I), *M.I)
    return {'n': len(M.V), 'ni': len(M.I), 'data': base64.b64encode(bytes(b)).decode()}


def model_json(what='mast'):
    M, props = build(what=what)
    xs = [v[0][0] for v in M.V]; ys = [v[0][1] for v in M.V]; zs = [v[0][2] for v in M.V]
    out = {'kind': 'mesh', 'v': 1, 'ppm': PPM, 'atlas': 'build', 'name': {'ship': 'Airship', 'station': 'Airship station'}.get(what, 'Airship mast'),
           'about': ('tools/build-airship.py: the airship, moored by the nose at the mast (its base point is the mast’s foot); low-poly, the buildings’ 32 px textures; the propellers turn'
                     if what == 'ship' else 'tools/build-airship.py: an airship station in the open (platform, canopy, kiosk, lamps) with its mast; low-poly, the buildings’ 32 px textures' if what == 'station' else 'tools/build-airship.py: the mooring mast, low-poly, painted with the buildings’ 32 px textures'),
           'box': [round(min(xs), 3), round(min(ys), 3), round(min(zs), 3), round(max(xs), 3), round(max(ys), 3), round(max(zs), 3)],
           'parts': [dict(name=what, **pack(M))], 'spins': []}
    for k, (pv, ax, pm) in enumerate(props):
        out['spins'].append(dict(name='propeller ' + ('near' if pv[2] < props[1 - k][0][2] else 'far'), c=[round(v, 4) for v in pv], a=[round(v, 5) for v in ax],
                                 rps=RPS if k == 0 else -RPS, **pack(pm)))
    return out, M, props


# ---------------------------------------------------------------------------------------------- textures
def t_cloth(g_, r):
    """balloon cloth: gores 16 px wide along the length, each puffed (lit along its top), the seams stitched"""
    for y in range(T):
        k = y % 16
        for x in range(T):
            v = 2
            if k == 0: v = 1
            elif k == 1: v = 3 if x % 4 < 2 else 2
            elif 3 <= k <= 5: v = 3 if (x + y) % 7 else 2
            elif k == 15: v = 1 if x % 6 else 2
            g_[y][x] = v
    for _ in range(14): g_[r.randrange(T)][r.randrange(T)] = 1


def t_rivets(g_, r):
    """riveted plates: 32 x 16 px, offset every other row, bevelled, a rivet every 4 px along the seams"""
    for y in range(T):
        row = y // 16; k = y % 16
        for x in range(T):
            c = (x + (16 if row % 2 else 0)) % 32; v = 2
            if k == 0 or c == 0: v = 3
            elif k == 15 or c == 31: v = 1
            if (k == 2 and c % 4 == 2) or (c == 2 and k % 4 == 2): v = 4
            elif (k == 3 and c % 4 == 2) or (c == 3 and k % 4 == 2): v = 1
            g_[y][x] = v
    for _ in range(20):
        x, y = r.randrange(T), r.randrange(T)
        if g_[y][x] == 2: g_[y][x] = 1 if r.random() < .5 else 3


def t_stripes(g_, r):
    """awning stripes: bands 8 px wide (25 cm), every other one a shade darker, a lit edge on each"""
    for y in range(T):
        for x in range(T):
            k = x % 16; v = 2 if k < 8 else 1
            if k == 0 or k == 8: v += 1
            g_[y][x] = v
    for _ in range(10): g_[r.randrange(T)][r.randrange(T)] = 3


def t_rings(g_, r):
    """a cut log's rings round the cell's middle: a ring every 4 px (12 cm), cracks out from the heart"""
    for y in range(T):
        for x in range(T):
            d = math.hypot(x + .5 - T / 2, y + .5 - T / 2); k = int(d) % 4
            g_[y][x] = 1 if k == 0 else 3 if k == 2 else 2
    for _ in range(3):
        a = r.uniform(0, 2 * math.pi)
        for t in range(2, 14): g_[int(T / 2 + math.sin(a) * t) % T][int(T / 2 + math.cos(a) * t) % T] = 0


NEW_TEX = {18: ('Balloon cloth', t_cloth), 19: ('Rivets', t_rivets), 20: ('Stripes', t_stripes), 21: ('Rings', t_rings)}


def write_atlas(force=False):
    path = os.path.join(ART, ATLAS_REL)
    if os.path.exists(path) and not force: return False
    im = Image.open(os.path.join(ART, ATLAS_FROM)).convert('RGBA'); cols = im.width // T
    for i, (name, fn) in NEW_TEX.items():
        g_ = [[2] * T for _ in range(T)]; fn(g_, random.Random(1800 + i)); ox, oy = (i % cols) * T, (i // cols) * T
        assert oy + T <= im.height
        for y in range(T):
            for x in range(T):
                v = g_[y][x] * 63; im.putpixel((ox + x, oy + y), (v, v, v, 255))
    im.save(path); return True


# ---------------------------------------------------------------------------------------------- pictures
_ATL = None


def atlas_level(tex, u, v):
    """the texture's level (0-4) at u, v metres, as the game reads it: a cell covers 2 m, 32 px a metre"""
    global _ATL
    if _ATL is None:
        p = os.path.join(ART, ATLAS_REL); im = Image.open(p if os.path.exists(p) else os.path.join(ART, ATLAS_FROM)).convert('L'); _ATL = (im.load(), im.width // T)
    A, cols = _ATL; gx, gy = (u * .5) % 1.0, 1 - (v * .5) % 1.0
    x = (tex % cols) * T + min(T - 1, int(gx * T)); y = (tex // cols) * T + min(T - 1, int(gy * T))
    return int(round(A[x, y] / 63))


def ramp(b, t):
    mix = lambda a, c, k: tuple(a[i] + (c[i] - a[i]) * k for i in range(3))
    b = tuple(v / 255 for v in b)
    if t <= 0: c = mix(tuple(v * .55 for v in b), (.235, .165, .439), .30)
    elif t == 1: c = mix(tuple(v * .79 for v in b), (.376, .29, .596), .17)
    elif t == 2: c = b
    elif t == 3: c = mix(b, (1, .957, .769), .30)
    else: c = mix(b, (1, .988, .918), .60)
    return tuple(max(0, min(255, int(round(v * 255)))) for v in c)


SUN = norm((-.55, .75, -.45))


def render(M, ppm, proj, light=SUN):
    """the model drawn as the props are drawn: each pixel its texture's level in its colour's ramp, one step darker
    away from the light and one lighter where it faces it, a dark outline round it (proj: position -> (x, y, depth),
    y down, depth smaller nearer). Returns (Cv-like dict of pixels, x0, y0)"""
    pts = [proj(v[0]) for v in M.V]
    X0 = math.floor(min(p[0] for p in pts) * ppm) - 3; X1 = math.ceil(max(p[0] for p in pts) * ppm) + 3
    Y0 = math.floor(min(p[1] for p in pts) * ppm) - 3; Y1 = math.ceil(max(p[1] for p in pts) * ppm) + 3
    W, H = X1 - X0, Y1 - Y0; zb = [1e9] * (W * H); col = [None] * (W * H)
    for t in range(0, len(M.I), 3):
        ia, ib, ic = M.I[t], M.I[t + 1], M.I[t + 2]
        A, B, C = [(pts[i][0] * ppm - X0, pts[i][1] * ppm - Y0, pts[i][2]) for i in (ia, ib, ic)]
        den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1])
        if abs(den) < 1e-9: continue
        va, vb, vc = M.V[ia], M.V[ib], M.V[ic]
        n = norm(add(add(va[1], vb[1]), vc[1])); nd = dot(n, light)
        tex, flat, cc = va[3], va[4], va[5]
        for y in range(max(0, int(min(A[1], B[1], C[1]))), min(H, int(max(A[1], B[1], C[1])) + 1)):
            for x in range(max(0, int(min(A[0], B[0], C[0]))), min(W, int(max(A[0], B[0], C[0])) + 1)):
                px, py = x + .5, y + .5
                w0 = ((B[1] - C[1]) * (px - C[0]) + (C[0] - B[0]) * (py - C[1])) / den
                w1 = ((C[1] - A[1]) * (px - C[0]) + (A[0] - C[0]) * (py - C[1])) / den
                w2 = 1 - w0 - w1
                if w0 < -1e-6 or w1 < -1e-6 or w2 < -1e-6: continue
                d = w0 * A[2] + w1 * B[2] + w2 * C[2]; k = y * W + x
                if d >= zb[k] - 1e-5: continue
                zb[k] = d
                if flat: col[k] = cc; continue
                u = w0 * va[2][0] + w1 * vb[2][0] + w2 * vc[2][0]; v = w0 * va[2][1] + w1 * vb[2][1] + w2 * vc[2][1]
                lv = atlas_level(tex, u, v) + (1 if nd > .6 else 0 if nd > .1 else -1)
                col[k] = ramp(cc, max(0, min(4, lv)))
    return col, W, H, X0, Y0


def oblique(p):
    """seen from the front, a little from above, like the props' pictures: up is up, the far side a little higher"""
    return (p[0], -(p[1] + p[2] * .5), p[2] - p[1] * .02)


def to_cv(col, W, H, Cv):
    cv = Cv(W, H)
    for y in range(H):
        for x in range(W):
            c = col[y * W + x]
            if c is not None: cv.px(x, y, c)
    return cv


def picture(Cv, what='mast'):
    """a prop's picture: the model with its propellers still, at the props' 34 px a metre; (cv, foot x, base y)"""
    M, props = build(what=what)
    for _, _, pm in props: M.add(pm)
    col, W, H, X0, Y0 = render(M, 34, oblique)   # the ship's picture keeps the mast's foot as its base point (below and beside it)
    # the canvas: the mast's foot (x 0, ground level at the front of the footing) is the base point, the picture
    # wide enough each side of it
    half = max(-X0, W + X0) + 2; cv = Cv(2 * half, H + 4); dx = half + X0
    for y in range(H):
        for x in range(W):
            c = col[y * W + x]
            if c is not None: cv.px(x + dx, y, c)
    cv.outline()
    return cv, half, -Y0


def map_sprite(Cv):
    """the airship over the world map: the ship alone, turned a little toward you, small"""
    P = []; S = ship(P, moored=False)
    for pv, ax, pm in P: S.add(pm)
    th = math.radians(20); c, s = math.cos(th), math.sin(th)
    rot = lambda p: (p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c)
    S = S.turned(rot, rot)
    S.V = [v for v in S.V]
    col, W, H, X0, Y0 = render(S, 8, oblique)
    cv = to_cv(col, W, H, Cv); cv.outline()
    return cv


def views(path):
    """the model from four sides (checking)"""
    M, props = build()
    for _, _, pm in props: M.add(pm)
    ims = []
    for name, f in (('front', oblique), ('game camera', lambda p: (p[0], -(p[1] * .83 + p[2] * .56), p[2] * .83 - p[1] * .56)),
                    ('side', lambda p: (-p[2], -p[1], p[0])), ('top', lambda p: (p[0], p[2] * -1 + 0, -p[1]))):
        col, W, H, X0, Y0 = render(M, 26, f)
        im = Image.new('RGBA', (W, H), (40, 46, 60, 255))
        for y in range(H):
            for x in range(W):
                c = col[y * W + x]
                if c is not None: im.putpixel((x, y), c + (255,))
        ims.append(im)
    Wt = sum(i.width for i in ims) + 10 * len(ims); Ht = max(i.height for i in ims)
    sheet = Image.new('RGBA', (Wt, Ht), (30, 34, 44, 255)); x = 0
    for im in ims: sheet.paste(im, (x, 0)); x += im.width + 10
    sheet.save(path)


# ---------------------------------------------------------------------------------------------- main
def main():
    args = sys.argv[1:]; force = '--force' in args
    if '--views' in args: views(args[args.index('--views') + 1]); print('views written'); return
    spec = importlib.util.spec_from_file_location('bsp', os.path.join(HERE, 'build-scene-props.py')); bsp = importlib.util.module_from_spec(spec); spec.loader.exec_module(bsp)
    done = []
    if write_atlas(force): done.append(ATLAS_REL)
    for what, rel in (('mast', MODEL_REL), ('ship', SHIP_REL), ('station', STATION_REL)):
        mp = os.path.join(ART, rel)
        if force or not os.path.exists(mp):
            os.makedirs(os.path.dirname(mp), exist_ok=True); out, M, props = model_json(what)
            json.dump(out, open(mp, 'w'), separators=(',', ':')); done.append(f'{rel} ({out["parts"][0]["n"]} vertices, {out["parts"][0]["ni"] // 3} triangles'
                                                                           + (f'; {len(out["spins"])} propellers' if out['spins'] else '') + ')')
    feet = {}
    for what, name in (('mast', 'airship_mast'), ('ship', 'airship'), ('station', 'airship_station')):
        pic = os.path.join(ART, 'scene', 'props', name + '.png'); cv, foot, base = picture(bsp.Cv, what); feet[name] = (foot, base)
        img = Image.new('RGBA', (cv.w, cv.h), (0, 0, 0, 0)); px = img.load()
        for y in range(cv.h):
            for x in range(cv.w):
                c = cv.get(x, y)
                if c is not None: px[x, y] = tuple(c[:3]) + (255,)
        if force or not os.path.exists(pic): img.save(pic); done.append(f'scene/props/{name}.png')
    ms = os.path.join(ART, 'map', 'airship.png')
    if force or not os.path.exists(ms):
        mc = map_sprite(bsp.Cv); mi = Image.new('RGBA', (mc.w, mc.h), (0, 0, 0, 0)); q = mi.load()
        for y in range(mc.h):
            for x in range(mc.w):
                c = mc.get(x, y)
                if c is not None: q[x, y] = tuple(c[:3]) + (255,)
        mi = mi.crop(mi.getbbox()); mi.save(ms); done.append(f'map/airship.png ({mi.width}x{mi.height})')
    # the catalogue: the prop draws as the model; its picture's foot and the beacon's glow from the picture
    src = gamedata.js_text(); i = src.index('window.GAMEDATA=')
    D = json.JSONDecoder().raw_decode(src[i + len('window.GAMEDATA='):])[0]
    BA = D['scenery'].setdefault('buildArt', {'detail': 'scene/build/detail.png', 'rooms': 'scene/build/rooms.png'})
    if BA.get('detail') in (ATLAS_FROM, 'scene/build/detail.png'): BA['detail'] = ATLAS_REL
    CP = D['scenery']['props']; E = CP.get('airship_mast')
    if E is not None:
        foot, base = feet['airship_mast']
        E['model'] = MODEL_REL; E['ox'] = -foot; E['oy'] = -base
        E['fx'] = [{'k': 'glow', 'x': 0, 'y': -int(round((MAST_H + .86) * 34))}]
        E['name'] = 'Airship mast'; E['box'] = [1.8, 1.8]
        # the airship: its own prop, moored at the mast (same base point), no footprint (it flies), bobbing in the wind
        foot, base = feet['airship']
        A = CP.setdefault('airship', {})
        A.update({'name': 'Airship', 'img': 'scene/props/airship.png', 'ox': -foot, 'oy': -base, 'shadow': 1.0, 'sway': 0, 'flat': 0,
                  'tags': ['town', 'city', 'village'], 'group': 'airship', 'model': SHIP_REL, 'bob': .09, 'noHit': 1,
                  'about': 'Moored at an airship mast: place it on the mast (same spot); it swings round the mast a little and bobs in the wind'})
        # alpha 0.4.1: the airship station (no rooms; tap it to fly) takes every mast's place in the towns, and the old
        # train station in Verdigris City goes (its terminal room with it)
        foot, base = feet['airship_station']
        S_ = CP.setdefault('airship_station', {})
        S_.update({'name': 'Airship station', 'img': 'scene/props/airship_station.png', 'ox': -foot, 'oy': -base, 'shadow': 1.0, 'sway': 0, 'flat': 0,
                   'tags': ['town', 'city', 'village'], 'group': 'airship_station', 'model': STATION_REL, 'box': [1.8, 1.8], 'act': 'fly',
                   'fx': [{'k': 'glow', 'x': int(round(x * 34)), 'y': -int(round((y + z * .5) * 34))} for x, y, z in STATION_LAMPS]
                         + [{'k': 'glow', 'x': 0, 'y': -int(round((MAST_H + .86) * 34))}],
                   'about': 'An airship station in the open: the mast with a lift, a canopy, a ticket kiosk. Tap it to fly; the airship moors at its mast (same spot)'})
        conv = 0
        for sc in D['maps'].values():
            for q in sc.get('props') or []:
                if q.get('k') == 'airship_mast': q['k'] = 'airship_station'; q['act'] = 'fly'; q['label'] = 'Airship station'; conv += 1
        city = D['maps'].get('city') or {}
        old = [q for q in city.get('props', []) if q.get('k') == 'station']
        for q in old:
            city['props'].remove(q)
            for k, dx, dz in (('bench_wood', -1.6, 1.0), ('bench_wood', 1.6, 1.0), ('planter', -3.0, 0.4), ('planter', 3.0, 0.4), ('tree_oak', 0, 2.6)):
                if k in CP: city['props'].append({'k': k, 'x': round(q['x'] + dx, 2), 'z': round(q['z'] + dz, 2)})
        tw = D['maps'].get('test_windows') or {}
        tw['props'] = [q for q in tw.get('props', []) if q.get('k') != 'station']
        if 'int_station' in D['maps']: del D['maps']['int_station']; done.append('the terminal room (int_station) removed')
        if conv or old: done.append(f'{conv} masts are airship stations now; the train station in Verdigris City gave way to benches and a tree')
        n = 0
        for sc in D['maps'].values():
            P = sc.get('props') or []
            for m in [q for q in P if q.get('k') in ('airship_mast', 'airship_station')]:
                if not any(q.get('k') == 'airship' and abs(q['x'] - m['x']) < .05 and abs(q['z'] - m['z']) < .05 for q in P):
                    s = dict(k='airship', x=m['x'], z=m['z'])
                    if m.get('s'): s['s'] = m['s']
                    if m.get('f'): s['f'] = m['f']
                    P.append(s); n += 1
        if n: done.append(f'{n} airships moored at their masts')
    gamedata.save_js(src[:i] + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n')
    print('\n'.join(done) or 'nothing missing'); print('catalogue: airship_mast draws as', MODEL_REL)


if __name__ == '__main__':
    main()
