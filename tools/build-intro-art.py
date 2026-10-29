#!/usr/bin/env python3
"""Intro track IN-3: the intro's art (docs/phases/intro-track.md section 5), in the low-poly 32 px/m style.

  train_wreck      the crashed sky train on the prepared run's landing: a Skyline Station train (tools/build-station-
                   trains.py) broken in two, its front carriage nosed into the ground, the second tipped on its side,
                   a broken piece of the sky rail under them, Bureau crates (bureau_crate) spilled from the cargo, the
                   ground scorched and heaped at the nose. Battered colours (the trains' own "battered" swap) and
                   smoke (fx plume, walk/effects.js: thinner on a struggling phone, the walk view's quality step).
                   One look per train: the base is the Lakeland Clipper, v 1-4 the Greenbelt Sunrunner, the Wildwood
                   Zephyr, the Highland Arrow, the Harvest Comet (each with its region theme as its form)
  sky_rail_broken  a piece of the sky rail snapped in two, its far end heaved up, its rails bent, sleepers loose
  bureau_portal    the Bureau's portal: a square of light on the ground, like a filing drawer pulled open (Kappi, DL-7:
                   "like someone shutting a drawer"); nothing but light, as the sky portal is. Its opens frames draw it
                   from a line to the square (walk/frame-items.js: a placement's open time; its shut time plays them
                   back and hides it). Flat on purpose
  robots.json      pictures for RL-14's four boss parts (the Intake Frame and its head, the Seizure Arm, the Franking
                   Cannon, the Conveyor Treads), drawn in the placeholder sheet's look (game/art/robots/): the Bureau's
                   clerks and the first run's retrieval bot are built from them
  people           bureau_clerk_a, bureau_clerk_b: two Bureau clerk bots as cutscene actors (a creature person on a
                   bot rig, person-art.js), each with the stamp pose (`act <clerk> stamp`)

The tipped pieces can't be recipes (a recipe's boxes stand upright), so the wreck and the broken rail are prebuilt
meshes in the airship's format (tools/build-airship.py pack: the buildings' 32 px texture cells), tessellated here from
the trains' own recipes the way prop-models.js lowPolyFromRecipe draws them, then turned and placed.

    python tools/build-intro-art.py      # rerunnable; the models, pictures, scenery rows, robot pictures, people
    python tools/look-intro-art.py       # pictures of all of it (validation/look-intro-art/)

The showcase map test_intro_art: game/index.html?test=1&scene=test_intro_art (the five wrecks, the broken rail, the
portal, the two clerks).
"""
import importlib.util
import json
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
ST = load('station', 'build-station-trains.py')
AIRSHIP = load('airship', 'build-airship.py')
RT = load('routes', 'build-props-routes.py')
PPM = B1.PPM
PICS = B1.NEXT / 'intro'  # this tool's pictures
ISL.PICS = PICS
MODELS = B1.NEXT / 'models'
FIXED = {'rot': 0, 'lean': 0, 'size': 0}
Mesh = AIRSHIP.Mesh

# prop-models.js LOW_POLY_TEXTURE_CELLS: a recipe texture's cell on the building sheet
CELLS = {'plain': 15, 'wood': 14, 'grain': 0, 'stone': 3, 'metal': 12, 'cloth': 18, 'hay': 11, 'leaves': 16, 'rust': 19,
         'stripes': 20, 'rings': 15, 'bark': 22, 'rock': 23, 'plaster': 0, 'siding': 1, 'brick': 2, 'battens': 4,
         'panels': 5, 'corrugated': 6, 'tilewall': 7, 'rooftiles': 8, 'shingles': 9, 'slate': 10, 'solar': 17}


MAX_SIDES = 12  # fewer sides than the game's limit: the wreck is big and stays a few thousand triangles


def cell(t, round_=False):
    return 0 if t == 'stone' and round_ else CELLS.get(t or 'plain', 15)


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def v3(a):
    return np.array(a, float)


def unit(a):
    a = v3(a)
    n = np.linalg.norm(a)
    return a / n if n > 1e-9 else a


# ================================================================ a recipe as a mesh (prop-models.js lowPolyFromRecipe)
# The mesh is in the game's model space: x across, y up, z depth (away from the viewer). A recipe's (x, y, z) is
# (across, depth, up), so G() swaps them.
def G(x, y, z):
    return (float(x), float(z), float(y))


# details too small to read on a wreck seen from the walking camera (a porthole's brass cross, a crate's ribs and
# barcode): left out, so the five wrecks stay small files
SMALL = ('cross', 'barcode', 'rib', 'clock hand')


def tess(M, layers, swap=None, ground=True):
    """every solid layer of a recipe into the mesh M; swap maps colours (a look's swap); ground clamps a box's foot at
    0 as the game does (a piece built in place)"""
    swap = swap or {}
    for L in layers:
        k = L['k']
        if k in ('img', 'raw') or L.get('hide') or any(w in L.get('name', '') for w in SMALL): continue
        col = rgb(swap.get(L.get('col', '#888888'), L.get('col', '#888888')))
        t = L.get('tex', 'plain')
        if k == 'box':
            x0, x1 = L['x'] - L['w'] / 2, L['x'] + L['w'] / 2
            y0, y1 = L['y'] - L['d'] / 2, L['y'] + L['d'] / 2
            z0 = max(0, L['z']) if ground else L['z']
            z1 = L['z'] + L['h']
            if z1 <= z0: continue
            AIRSHIP.box(M, x0, x1, z0, z1, y0, y1, cell(t), col)
        elif k == 'limb':
            pts = L.get('pts') or [[L['x'], L['y'], L['z'], L['r']], [L['x2'], L['y2'], L['z2'], L.get('r1', L['r'])]]
            limb(M, [(G(*p[:3]), p[3]) for p in pts], L.get('sides'), cell(t, True), col)
        else:
            round_shape(M, L, cell(t, True), col)


def limb(M, P, sides, tex, col):
    """a tapered branch through points (game space, radius): rings round each, a frame carried along so the sides
    don't twist, the far end capped"""
    P = [(v3(p), r) for p, r in P]
    if len(P) < 2: return
    r0 = max(P[0][1], 0.01)
    n = max(3, min(MAX_SIDES, sides)) if sides else max(5, min(10, round(2 * math.pi * r0 * 32 / 6)))
    if r0 < 0.03: n = min(n, 4)
    D = [unit(P[min(len(P) - 1, i + 1)][0] - P[max(0, i - 1)][0]) for i in range(len(P))]
    u = unit(np.cross(D[0], [0, 1, 0] if abs(D[0][1]) < 0.9 else [1, 0, 0]))
    rings, along = [], 0.0
    for i, (p, r) in enumerate(P):
        a = D[i]
        if i:
            along += float(np.linalg.norm(p - P[i - 1][0]))
            u = unit(u - a * float(np.dot(u, a)))
        v = np.cross(a, u)
        rr = max(r, 0.004)
        ring = []
        for j in range(n + 1):
            an = 2 * math.pi * (j % n) / n
            nr = u * math.cos(an) + v * math.sin(an)
            ring.append((p + nr * rr, nr, along))
        rings.append(ring)
    arc = 2 * math.pi * r0 / n
    K = [[M.v(tuple(q[0]), tuple(q[1]), (j * arc, q[2]), tex, col) for j, q in enumerate(ring)] for ring in rings]
    for i in range(len(rings) - 1):
        for j in range(n):
            M.I += [K[i][j], K[i + 1][j], K[i + 1][j + 1], K[i][j], K[i + 1][j + 1], K[i][j + 1]]
    for ring, (p, r), d in ((rings[-1], P[-1], D[-1]), (rings[0], P[0], -D[0])):
        c = M.v(tuple(p), tuple(d), (1, 1), tex, col)
        E = [M.v(tuple(q[0]), tuple(d), (1 + r * math.cos(2 * math.pi * j / n), 1 + r * math.sin(2 * math.pi * j / n)), tex, col)
             for j, q in enumerate(ring[:n])]
        for j in range(n): M.I += [c, E[(j + 1) % n], E[j]]


def round_shape(M, L, tex, col):
    """a cylinder, cone, barrel, dome or sphere standing up from its foot (rings of r across, ry in depth)"""
    k = L['k']
    r = max(L.get('r', 0.1), 0.01)
    ry = max(L.get('ry', r), 0.01)
    h = L.get('h', 2 * r)
    if k == 'cyl': R = [(0, 1), (1, 1)]
    elif k == 'cone': R = [(0, 1), (1, (L.get('r1') or 0) / r)]
    elif k == 'barrel':
        bu = L.get('bulge', 0.15)
        R = [(i / 6, 1 - bu + bu * math.sin(i / 6 * math.pi) * 2 - bu) for i in range(7)]
    elif k == 'dome':
        nb = max(2, min(12, L.get('rings', 5)))
        R = [(math.sin(math.pi / 2 * i / nb), math.cos(math.pi / 2 * i / nb)) for i in range(nb + 1)]
    else:
        nb = max(2, min(16, L.get('rings', 8)))
        R = []
        for i in range(nb + 1):
            q = (1 - math.cos(math.pi * i / nb)) / 2
            R.append((q, math.sqrt(max(0, 1 - (2 * q - 1) ** 2))))
    n = max(3, min(MAX_SIDES, L['sides'])) if L.get('sides') else max(6, min(MAX_SIDES, round(2 * math.pi * max(r, ry) * 32 / 5)))
    rot = L.get('rot', 0)
    x0, y0, z0 = L.get('x', 0), L.get('y', 0), L.get('z', 0)
    Gd = []
    for q, f in R:
        z = max(0, z0 + q * h)
        fy = 1 - q + q * L['ry1'] / ry if k == 'cone' and L.get('ry1') is not None else f
        Gd.append([v3(G(x0 + math.cos(2 * math.pi * j / n + rot) * r * f, y0 + math.sin(2 * math.pi * j / n + rot) * ry * fy, z))
                   for j in range(n + 1)])
    NR = len(Gd)
    NM = [[np.zeros(3) for _ in range(n + 1)] for _ in range(NR)]
    axis = lambda p: v3((x0, p[1], y0))
    for i in range(NR - 1):
        for j in range(n):
            a, b, c, d = Gd[i][j], Gd[i + 1][j], Gd[i + 1][j + 1], Gd[i][j + 1]
            w = np.cross(c - a, d - b)
            if np.dot(w, (a + c) / 2 - axis((a + c) / 2)) < 0: w = -w
            for ii, jj in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)): NM[ii][jj] += w
    for i in range(NR):  # the seam: both ends of a ring share their normal
        s = NM[i][0] + NM[i][n]
        NM[i][0] = NM[i][n] = s
    arc = 2 * math.pi * max(r, ry) / n
    K = [[M.v(tuple(Gd[a][b]), tuple(unit(NM[a][b])), (b * arc, Gd[a][b][1]), tex, col) for b in range(n + 1)] for a in range(NR)]
    for i in range(NR - 1):
        for j in range(n):
            M.I += [K[i][j], K[i + 1][j], K[i + 1][j + 1], K[i][j], K[i + 1][j + 1], K[i][j + 1]]
    top = Gd[-1]
    if R[-1][1] > 0.02:
        ct = v3((x0, top[0][1], y0))
        for j in range(n):
            M.poly([tuple(ct), tuple(top[j + 1]), tuple(top[j])], [(1, 1), (top[j + 1][0] - x0 + 1, top[j + 1][2] - y0 + 1),
                   (top[j][0] - x0 + 1, top[j][2] - y0 + 1)], cell('rings') if L.get('tex') == 'rings' else tex, col, N=(0, 1, 0))
    if Gd[0][0][1] > 0.01 and R[0][1] > 0.02:
        cb = v3((x0, Gd[0][0][1], y0))
        for j in range(n):
            M.poly([tuple(cb), tuple(Gd[0][j]), tuple(Gd[0][j + 1])], [(1, 1), (1, 1), (1, 1)], tex, col, N=(0, -1, 0))


# ================================================================ cutting, turning, placing
def rot(yaw=0.0, pitch=0.0, roll=0.0):
    """a turn in game space, degrees: roll about x (along the train), pitch about z (depth: + lifts the +x end), yaw
    about y (up: + turns +x toward the back)"""
    a, b, c = (math.radians(v) for v in (roll, pitch, yaw))
    Rx = np.array([[1, 0, 0], [0, math.cos(a), -math.sin(a)], [0, math.sin(a), math.cos(a)]])
    Rz = np.array([[math.cos(b), -math.sin(b), 0], [math.sin(b), math.cos(b), 0], [0, 0, 1]])
    Ry = np.array([[math.cos(c), 0, math.sin(c)], [0, 1, 0], [-math.sin(c), 0, math.cos(c)]])
    return Ry @ Rz @ Rx


def placed(M, R, t=(0, 0, 0)):
    t = v3(t)
    return M.turned(lambda p: tuple(R @ v3(p) + t), lambda n: tuple(R @ v3(n)))


def cut(M, keep):
    """the part of a mesh on one side of the plane x = 0 (keep +1 or -1), its triangles clipped at it"""
    out = Mesh()
    for i in range(0, len(M.I), 3):
        tri = [M.V[M.I[i + j]] for j in range(3)]
        poly = []
        for j in range(3):
            a, b = tri[j], tri[(j + 1) % 3]
            da, db = a[0][0] * keep, b[0][0] * keep
            if da >= 0: poly.append(a)
            if (da >= 0) != (db >= 0):
                s = da / (da - db)
                L = lambda p, q: tuple(p[k] + (q[k] - p[k]) * s for k in range(len(p)))
                poly.append((L(a[0], b[0]), L(a[1], b[1]), L(a[2], b[2]), a[3], a[4], a[5]))
        if len(poly) < 3: continue
        ks = [len(out.V) + j for j in range(len(poly))]
        out.V += poly
        for j in range(1, len(poly) - 1): out.I += [ks[0], ks[j], ks[j + 1]]
    return out


def lowest(M, sel=lambda p: True):
    return min(p[1] for p, *_ in M.V if sel(p))


def lifted(M, dy):
    return M.turned(lambda p: (p[0], p[1] + dy, p[2]), lambda n: n)


def where(R, t, p):
    """a point of a piece (game space) where the piece was placed"""
    return R @ v3(p) + v3(t)


# ================================================================ the broken rail
def rail_half(L, x0, x1, broken_end=None):
    """a stretch of the sky rail along x (recipe space): the ballast bed, sleepers, the two rails"""
    L.append(B1.box((x0 + x1) / 2, 0, 0, x1 - x0, 2.9, 0.12, ST.BALLAST, 'rock', 'track bed'))
    ST.track(L, x0, x1, 0)


def broken_rail():
    """the sky rail snapped: a 5 m stretch lying flat, a 4 m stretch heaved up from the break (its far end 1.4 m up,
    resting on its own sleepers), the rails bent up out of the break and torn off ragged, loose sleepers, ballast
    spilled. Returns the mesh (game space, along x, the break near x = 0.4)."""
    M = Mesh()
    A = []
    rail_half(A, -5.0, 0.0)
    tess(M, [l for l in A if l['name'] != 'rail'])
    # the flat stretch's rails run on past the break and bend up, ragged
    for sy in (-1, 1):
        y = sy * ST.RAIL_GAUGE
        pts = [(-5.0, y, 0.28), (-0.4, y, 0.28), (0.3, y + sy * 0.05, 0.36), (0.8, y + sy * 0.18, 0.62), (1.05, y + sy * 0.25, 0.95)]
        limb(M, [(G(*p), 0.06) for p in pts], 4, cell('metal'), rgb(ST.STEEL))
    # the heaved stretch, its own recipe turned up about its near end
    Bp = []
    rail_half(Bp, 0.0, 4.0)
    Mb = Mesh()
    tess(Mb, Bp, ground=False)
    R = rot(pitch=20, roll=-4, yaw=6)
    M.add(placed(Mb, R, (1.0, 0.05, 0.1)))
    # loose sleepers and spilled ballast
    for x, y, a, tilt in ((-1.2, -1.9, 30, 8), (0.6, 1.8, -50, 14), (2.6, -2.0, 70, 0), (-3.1, 2.1, 10, 5)):
        Ms = Mesh()
        tess(Ms, [B1.box(0, 0, 0, 0.24, 2.1, 0.1, ST.SLEEPER, 'wood', 'sleeper')], ground=False)
        M.add(placed(Ms, rot(yaw=a, roll=tilt), (x, 0.02, y)))
    for x, y, r in ((0.3, -1.6, 0.5), (0.2, 1.7, 0.45), (-0.5, 0.0, 0.4)):
        Mh = Mesh()
        tess(Mh, [{'k': 'dome', 'x': x, 'y': y, 'z': 0, 'r': r, 'ry': r * 0.8, 'h': 0.22, 'sides': 7, 'rings': 2,
                   'col': ST.BALLAST, 'tex': 'rock'}])
        M.add(Mh)
    return M


# ================================================================ the wreck
DIRT, DIRT_D = '#8A6A4E', '#6A4E3A'
# the crash: the front carriage (+x of the train's middle) pitched nose down into the ground; the second tipped onto
# its front side (toward the camera), its back side and windows up; both behind the broken rail, in the wreck's own
# space (x across, y up, z depth from the wreck's middle)
FRONT_TURN = dict(yaw=-14, pitch=-21, roll=7)
FRONT_AT = (2.2, 0.0, 0.6)
BACK_TURN = dict(yaw=22, roll=-82)
BACK_AT = (-5.4, 0.0, 1.6)
RAIL_TURN = dict(yaw=8)
RAIL_AT = (-0.6, 0.0, 4.2)


def train_parts(key):
    """a train's recipe (station tools), its battered colours, as a mesh cut into the front carriage (x > 0) and the
    second (x < 0); each half's middle moved to its own origin so it turns about itself"""
    fn = dict((k, f) for k, _, f in ST.TRAINS)[key]
    r = fn()
    swap = dict(ST.TRAIN_LOOKS[key][1])
    swap[B1.AIR['glass']] = '#2A3440'  # the windows dark (broken, no lamps behind them)
    L = r['layers']
    if key == 'train_wildwood':  # its gasbag and all that hangs off it come down (wreck(): a deflated bag on the ground)
        L = [l for l in L if max(l.get('z', 0), l.get('z2', 0), *(q[2] for q in l.get('pts', [[0, 0, 0]]))) < 3.1]
    M = Mesh()
    tess(M, L, swap)
    front, back = cut(M, 1), cut(M, -1)
    return front, back


def crate(R, t):
    Mc = Mesh()
    tess(Mc, RT.bureau_crate()['layers'], ground=False)
    return placed(Mc, rot(**R), t)


def wreck(key):
    """the whole wreck for one train: returns (mesh, smoke points (game space), the footprint's x and z extent)"""
    front, back = train_parts(key)
    W = Mesh()
    # the front carriage: turned, then sunk till its nose is 0.7 m into the ground
    Rf = rot(**FRONT_TURN)
    F = placed(front, Rf, FRONT_AT)
    dyf = -0.7 - lowest(F, lambda p: p[0] > FRONT_AT[0] + 2.5)
    F = lifted(F, dyf)
    W.add(F)
    # the second: rolled onto its side, resting on the ground
    Rb = rot(**BACK_TURN)
    Bk = placed(back, Rb, BACK_AT)
    dyb = -0.05 - lowest(Bk)
    Bk = lifted(Bk, dyb)
    W.add(Bk)
    # the broken rail under them
    W.add(placed(broken_rail(), rot(**RAIL_TURN), RAIL_AT))
    if key == 'train_wildwood':  # the Zephyr's gasbag, torn loose and deflated, draped on the ground behind
        bag, band = ST.TRAIN_LOOKS[key][1].get('#7EA858', '#5A6448'), ST.TRAIN_LOOKS[key][1].get(B1.AIR['brass'], ST.RUST)
        Mb = Mesh()
        tess(Mb, [{'k': 'sphere', 'x': 0, 'y': 0, 'z': -0.2, 'r': 3.2, 'ry': 1.5, 'h': 1.3, 'sides': 12, 'rings': 4,
                   'lump': 0, 'col': bag, 'tex': 'cloth'}] +
             [{'k': 'sphere', 'x': x, 'y': 0, 'z': -0.2, 'r': 0.12, 'ry': 1.55, 'h': 1.36 - abs(x) * 0.25, 'sides': 6,
               'rings': 3, 'col': band, 'tex': 'metal'} for x in (-1.5, 0.0, 1.5)])
        W.add(placed(Mb, rot(yaw=-12), (-2.0, 0.0, 5.6)))
    # the ground heaped up at the nose
    nose = where(Rf, (FRONT_AT[0], FRONT_AT[1] + dyf, FRONT_AT[2]), G(5.6, 0, ST.ZC))
    heap = []
    for dx, dz, r, h, c in ((0.5, -0.6, 1.1, 0.7, DIRT), (1.2, 0.5, 0.9, 0.55, DIRT_D), (-0.2, 0.9, 0.7, 0.4, DIRT),
                            (0.9, -1.4, 0.5, 0.3, DIRT_D), (1.9, -0.2, 0.6, 0.35, DIRT)):
        heap.append({'k': 'sphere', 'x': nose[0] + dx, 'y': nose[2] + dz, 'z': -h * 0.3, 'r': r, 'ry': r * 0.85, 'h': h,
                     'sides': 7, 'rings': 3, 'col': c, 'tex': 'rock'})
    Mh = Mesh()
    tess(Mh, heap)
    W.add(Mh)
    # the Bureau's crates, spilled from the second carriage's hold
    for R, t in ((dict(yaw=12), (-2.2, 0.0, -1.6)), (dict(yaw=-30, roll=90), (-3.4, 0.35, -2.6)),
                 (dict(yaw=40, pitch=18, roll=-12), (-0.9, 0.12, -2.4)), (dict(yaw=-8, pitch=-90), (-6.6, 0.45, -1.4)),
                 (dict(yaw=65, roll=24), (0.6, 0.08, -1.0))):
        W.add(crate(R, t))
    # torn panels and a skid lying loose
    for (x, z, a, tilt, w, col) in ((1.6, -2.6, 25, 10, 1.2, ST.TRAIN_LOOKS[key][1].get(ST.STEEL, ST.STEEL)),
                                    (-1.4, -3.4, -40, 6, 0.9, '#7A766E')):
        Mp = Mesh()
        tess(Mp, [B1.box(0, 0, 0, w, 0.7, 0.05, col, 'metal', 'panel')], ground=False)
        W.add(placed(Mp, rot(yaw=a, roll=tilt), (x, 0.02, z)))
    # smoke: from the front's tail (its rockets' bells) and from the second's split roof
    smoke = [where(Rf, (FRONT_AT[0], FRONT_AT[1] + dyf, FRONT_AT[2]), G(0.4, 0, ST.ZC + 0.6)),
             where(Rb, (BACK_AT[0], BACK_AT[1] + dyb, BACK_AT[2]), G(-1.5, 0.4, ST.ZC + 0.4)),
             where(Rb, (BACK_AT[0], BACK_AT[1] + dyb, BACK_AT[2]), G(-5.4, 0.9, 1.4))]
    return W, smoke


def centred(M, pts=()):
    """move a mesh so its middle across is at x 0 and its front (the nearest point) at depth 0: a prop with a footprint
    stands with its front at its base point (build-props-batch1.py shift_y); returns the mesh, the points moved the
    same way, its width and depth"""
    xs = [p[0] for p, *_ in M.V]
    zs = [p[2] for p, *_ in M.V]
    dx, dz = -(min(xs) + max(xs)) / 2, -min(zs)
    out = M.turned(lambda p: (p[0] + dx, p[1], p[2] + dz), lambda n: n)
    return out, [(p[0] + dx, p[1], p[2] + dz) for p in pts], max(xs) - min(xs), max(zs) - min(zs)


def mesh_json(M, name, about):
    """the mesh file (the airship's format, tools/build-airship.py pack), in parts of at most 60,000 vertices"""
    xs = [v[0][0] for v in M.V]; ys = [v[0][1] for v in M.V]; zs = [v[0][2] for v in M.V]
    parts, i = [], 0
    while i < len(M.I):
        P = Mesh()
        remap = {}
        j = i
        while j < len(M.I) and len(P.V) < 60000:
            for q in M.I[j:j + 3]:
                if q not in remap:
                    remap[q] = len(P.V)
                    P.V.append(M.V[q])
                P.I.append(remap[q])
            j += 3
        parts.append(dict(name=f'{name} {len(parts) + 1}', **AIRSHIP.pack(P)))
        i = j
    return {'kind': 'mesh', 'v': 1, 'ppm': PPM, 'atlas': 'build', 'name': name, 'about': about,
            'box': [round(min(xs), 3), round(min(ys), 3), round(min(zs), 3), round(max(xs), 3), round(max(ys), 3), round(max(zs), 3)],
            'parts': parts, 'spins': []}


def write_mesh(key, M, name, about):
    p = MODELS / f'{key}.json'
    p.write_text(json.dumps(mesh_json(M, name, about), separators=(',', ':')) + '\n', newline='\n')
    return B1.rel(p)


def bake_mesh(M, key):
    """the mesh's picture (the fallback and the far view): the island batch's baker, given the mesh's triangles"""
    T = []
    for i in range(0, len(M.I), 3):
        a, b, c = (M.V[M.I[i + j]] for j in range(3))
        hexc = '#%02X%02X%02X' % a[5]
        T.append(((a[0][0], a[0][2], a[0][1]), (b[0][0], b[0][2], b[0][1]), (c[0][0], c[0][2], c[0][1]), hexc))
    was = ISL.mesh
    ISL.mesh = lambda _L: T
    try:
        return ISL.bake({'layers': [1]}, key)
    finally:
        ISL.mesh = was


def mesh_prop(key, M, name, about, **kw):
    kw.setdefault('about', about)
    path, ox, oy = bake_mesh(M, key)
    P = {'name': name, 'img': path, 'ox': ox, 'oy': oy, 'shadow': kw.pop('shadow', 1.0), 'sway': 0, 'flat': 0,
         'tags': list(kw.pop('tags', ('intro',))), 'group': kw.pop('group', key), 'model': write_mesh(key, M, name, about),
         'ppm': PPM, 'vary': dict(FIXED)}
    P.update(kw)
    return P


def mesh_variant(key, M, name, about, extra=None):
    path, ox, oy = bake_mesh(M, key)
    V = {'img': path, 'ox': ox, 'oy': oy, 'model': write_mesh(key, M, name, about), 'name': name}
    if extra: V.update(extra)
    return V


def plume_fx(pts):
    """the smoke as fx (walk/effects.js plume): pixels at 32 a metre from the base point (y up negative), z metres back"""
    return [{'k': 'plume', 'x': round(p[0] * PPM), 'y': -round(p[1] * PPM), 'z': round(p[2], 2)} for p in pts]


THEMES = [('train_lakeland', 'lakeland'), ('train_greenbelt', 'greenbelt'), ('train_wildwood', 'wildwood'),
          ('train_highland', 'highland'), ('train_harvest', 'harvest')]


def add_wreck(C):
    names = dict((k, n) for k, n, _ in ST.TRAINS)
    looks = []
    for key, theme in THEMES:
        M, smoke = wreck(key)
        M, smoke, w, d = centred(M, smoke)
        looks.append((key, theme, M, smoke, w, d))
    about = ('Intro track IN-3: the crashed sky train on the prepared run\'s landing (tools/build-intro-art.py): a '
             'Skyline Station train broken in two, the front carriage nosed into the ground, the second tipped on its '
             'side, a broken piece of the sky rail, Bureau crates spilled from the cargo; battered, smoking (fx plume, '
             'thinner at the walk view\'s lower quality steps). A prebuilt mesh (the airship\'s format). One look per '
             'train, its region theme as the form: base lakeland, v 1 greenbelt, v 2 wildwood, v 3 highland, v 4 harvest')
    key, theme, M, smoke, w, d = looks[0]
    C['train_wreck'] = mesh_prop('train_wreck', M, f'Wrecked sky train ({names[key]})', about, shadow=1.2,
                                 tags=('intro', 'station', 'train'), box=[round(w, 1), round(d, 1)], fx=plume_fx(smoke),
                                 form=theme)
    C['train_wreck']['variants'] = [
        mesh_variant(f'train_wreck_{theme}', M, f'Wrecked sky train ({names[key]})', about, {'form': theme, 'fx': plume_fx(smoke)})
        for key, theme, M, smoke, w, d in looks[1:]]
    Mr, _, wr, dr = centred(broken_rail())
    C['sky_rail_broken'] = mesh_prop('sky_rail_broken', Mr, 'Track (broken)', 'Intro track IN-3: a piece of the sky rail '
                                     'snapped in two, its far end heaved up, its rails bent, sleepers loose (tools/build-intro-art.py; a prebuilt mesh)',
                                     shadow=0.6, tags=('intro', 'station'), box=[round(wr, 1), round(dr, 1)])
    return [(k, t, len(M.V), len(M.I) // 3) for k, t, M, *_ in looks] + [('sky_rail_broken', '', len(Mr.V), len(Mr.I) // 3)]


# ================================================================ the square portal
PORTAL_M = 2.5  # the square's side, metres
PORTAL_COLS = ['#0E1430', '#1C2C5A', '#2E58A0', '#4A9ADA', '#9FE8F4', '#F4FFFC']  # darkest first
PORTAL_FRAMES = [0.04, 0.12, 0.26, 0.44, 0.62, 0.8]  # the opening's depths (of the full square), before the full one
PAD = 3  # room round the square for the sparks


def portal_square(w, h, seed=7):
    """the Bureau's portal seen from above at w x h pixels (the square pulled open to h deep): a bright rim, the
    drawer's walls going down in rings that close in toward a bright eye at the bottom (each ring 0.7 of the one
    before, darker the deeper), specks drifting down, the drawer's handle of light under its front edge, sparks off the
    rim. Pixel art: every pixel drawn or not; the light round it is the prop's glow"""
    P = [rgb(c) for c in PORTAL_COLS]
    W, H = w + 2 * PAD, h + 2 * PAD
    a = np.zeros((H, W, 4), np.uint8)
    rng = np.random.default_rng(seed)

    def fill(x0, y0, x1, y1, c):
        x0, y0, x1, y1 = (int(round(v)) for v in (x0, y0, x1, y1))
        if x1 > x0 and y1 > y0: a[max(0, y0):y1, max(0, x0):x1] = (*c, 255)

    def ring(x0, y0, x1, y1, c, t=1):
        fill(x0, y0, x1, y0 + t, c); fill(x0, y1 - t, x1, y1, c); fill(x0, y0, x0 + t, y1, c); fill(x1 - t, y0, x1, y1, c)

    x0, y0, x1, y1 = PAD, PAD, PAD + w, PAD + h
    fill(x0, y0, x1, y1, P[0])
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    # the walls: bands between rings, the far wall (top) lit, the left a little darker, the right and near walls darkest
    q, d = 1.0, 0
    while True:
        nq = q * 0.7
        hx, hy = w / 2 * nq, h / 2 * nq
        if hy < 1.5 or hx < 3: break
        ox, oy = w / 2 * q, h / 2 * q
        lit = max(1, 4 - d)
        fill(cx - ox, cy - oy, cx + ox, cy - hy, P[min(lit, 3)])  # the far wall
        fill(cx - ox, cy - hy, cx - hx, cy + hy, P[max(1, lit - 1)])  # the left wall
        fill(cx + hx, cy - hy, cx + ox, cy + hy, P[max(1, lit - 2)])  # the right wall
        fill(cx - ox, cy + hy, cx + ox, cy + oy, P[max(1, lit - 3)])  # the near wall, in its own shade
        fill(cx - hx, cy - hy, cx + hx, cy + hy, P[0])
        ring(cx - hx, cy - hy, cx + hx, cy + hy, P[max(2, 4 - d)])  # the next ring down
        q, d = nq, d + 1
    # the eye at the bottom
    ex, ey = max(2, w * 0.07), max(1, h * 0.07)
    fill(cx - ex - 1, cy - ey - 1, cx + ex + 1, cy + ey + 1, P[4])
    fill(cx - ex, cy - ey, cx + ex, cy + ey, P[5])
    # specks drifting down
    for _ in range(int(w * h / 90) if h > 8 else 0):
        x, y = rng.uniform(x0 + 3, x1 - 3), rng.uniform(y0 + 2, y1 - 2)
        if abs(x - cx) < ex + 2 and abs(y - cy) < ey + 2: continue
        k = 5 if rng.random() < 0.3 else 4
        fill(x, y, x + 1, y + 1, P[k])
    # the rim: white outside, pale cyan inside
    ring(x0, y0, x1, y1, P[4], 2)
    ring(x0, y0, x1, y1, P[5], 1)
    # the drawer's handle: a bar of light under the front edge
    hw = w * 0.14
    fill(cx - hw, y1 + 1, cx + hw, y1 + 2, P[5])
    fill(cx - hw, y1 + 2, cx - hw + 1, y1 + 3, P[4]); fill(cx + hw - 1, y1 + 2, cx + hw, y1 + 3, P[4])
    # sparks off the rim
    for _ in range(int((w + h) / 4)):
        side = rng.integers(4)
        if side < 2:
            x, y = rng.uniform(x0, x1), (y0 - rng.integers(1, PAD)) if side == 0 else (y1 + rng.integers(0, PAD - 1))
        else:
            y, x = rng.uniform(y0, y1), (x0 - rng.integers(1, PAD)) if side == 2 else (x1 + rng.integers(0, PAD - 1))
        if side == 1 and abs(x - cx) < hw + 1: continue
        fill(x, y, x + 1, y + 1, P[5 if rng.random() < 0.5 else 4])
    return a


def add_portal(C):
    n = int(round(PORTAL_M * PPM))
    full = portal_square(n, n)
    path = ISL.save_pic(full, 'bureau_portal')
    frames = []
    for i, f in enumerate(PORTAL_FRAMES):
        h = max(2, int(round(n * f)))
        a = portal_square(n, h, seed=7 + i)
        frames.append({'img': ISL.save_pic(a, f'bureau_portal_open{i + 1}'), 'ox': -(a.shape[1] // 2), 'oy': -(a.shape[0] // 2)})
    C['bureau_portal'] = {
        'name': 'Bureau portal', 'img': path, 'ox': -(full.shape[1] // 2), 'oy': -(full.shape[0] // 2), 'shadow': 0,
        'sway': 0, 'flat': 1, 'emit': 1, 'tags': ['intro', 'bureau'], 'group': 'bureau', 'solid': 0, 'ppm': PPM,
        'vary': {'rot': 0, 'lean': 0, 'size': 0},
        'glow': {'c': '#9FE8F4', 'r': 4.5, 'y': 0.4, 'day': 0.6, 'light': 0.6},
        'opens': {'ms': 700, 'frames': frames},
        'about': 'Intro track IN-3: the Bureau\'s portal, a square of light on the ground like a filing drawer pulled '
                 'open (Kappi, DL-7: "like someone shutting a drawer"); nothing but light (emit: drawn unlit), its middle '
                 'at its base point. opens: its frames from a line to the square, played over ms when a placement gets '
                 'open (walkView.t when it starts); shut plays them back and hides it (walk/frame-items.js)'}


# ================================================================ the Bureau's bots: RL-14's boss parts drawn
INK = '#24202E'
KNOB, KNOB_L, KNOB_D = '#5A5E6A', '#8A8E9A', '#3A3E48'
MUSTARD, MUSTARD_D, TAPE, CREAM = '#E0B040', '#8A6A20', '#DE4048', '#F2E8D0'


def tone(c, f):
    """a colour lighter (f > 0) or darker (f < 0)"""
    r = np.array(rgb(c) if isinstance(c, str) else c, float)
    r = r + (255 - r) * f if f > 0 else r * (1 + f)
    return tuple(int(round(v)) for v in np.clip(r, 0, 255))


class Pix:
    """a robot part's picture: shapes filled, shaded from the top left, outlined in ink (the placeholder sheet's look)"""
    def __init__(s, w, h):
        s.a = np.zeros((h, w, 4), np.uint8)

    def put(s, x, y, c):
        if 0 <= y < s.a.shape[0] and 0 <= x < s.a.shape[1]: s.a[y, x] = (*(rgb(c) if isinstance(c, str) else c), 255)

    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.put(x, y, c)

    def block(s, x0, y0, x1, y1, c, cut=1):
        """a lit block: pale top row, light left column, dark bottom rows and right column, corners cut"""
        s.rect(x0, y0, x1, y1, c)
        s.rect(x0, y0, x1, y0, tone(c, 0.3)); s.rect(x0, y0 + 1, x0, y1, tone(c, 0.15))
        s.rect(x1, y0 + 1, x1, y1, tone(c, -0.2)); s.rect(x0 + 1, y1 - 1, x1, y1, tone(c, -0.28))
        if cut:
            for x, y in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)): s.a[y, x] = 0

    def knob(s, x0, y0, x1, y1):
        s.block(x0, y0, x1, y1, KNOB)
        s.put(x0 + 1 if x1 > x0 + 1 else x0, y0 + 1 if y1 > y0 + 1 else y0, KNOB_L)

    def line(s, P, c, t=1):
        for (xa, ya), (xb, yb) in zip(P, P[1:]):
            n = max(abs(xb - xa), abs(yb - ya), 1)
            for i in range(n + 1):
                x, y = round(xa + (xb - xa) * i / n), round(ya + (yb - ya) * i / n)
                s.rect(x, y, x + t - 1, y + t - 1, c)

    def done(s):
        """the ink outline round what's drawn, inside the picture's edge (its pixels are kept clear of it)"""
        a = s.a
        m = a[..., 3] > 0
        e = np.zeros_like(m)
        e[1:] |= m[:-1]; e[:-1] |= m[1:]; e[:, 1:] |= m[:, :-1]; e[:, :-1] |= m[:, 1:]
        e &= ~m
        a[e] = (*rgb(INK), 255)
        return a


def intake_torso(back=False):
    """the Intake Frame: a filing cabinet that walks; two drawers (label holders, mustard handles), the gem's socket
    between them, red tape down one side; its back a vent and a form plate"""
    S, F, Fd = '#4F5A6E', '#5E6A80', '#3E475A'
    p = Pix(32, 29)
    p.knob(14, 1, 17, 4)  # the neck
    p.block(2, 3, 29, 25, S)
    for x0 in (1, 28): p.knob(x0, 9, x0 + 2, 13)  # the shoulders
    for x0 in (6, 22): p.knob(x0, 25, x0 + 3, 27)  # the hips
    if not back:
        for y0 in (5, 16):
            p.rect(5, y0, 26, y0 + 7, Fd); p.block(6, y0 + 1, 25, y0 + 6, F, cut=0)
            p.rect(13, y0 + 2, 18, y0 + 3, CREAM); p.put(13, y0 + 2, '#BFB49C'); p.put(18, y0 + 3, '#BFB49C')
            p.rect(12, y0 + 5, 19, y0 + 5, MUSTARD); p.rect(12, y0 + 6, 19, y0 + 6, MUSTARD_D)
        for dy in range(-2, 3):  # the gem's socket, half way up
            w = 2 - abs(dy)
            p.rect(16 - w, 14 + dy, 16 + w, 14 + dy, '#2A2836')
        p.rect(8, 3, 9, 25, TAPE); p.rect(9, 3, 9, 25, tone(TAPE, -0.25))
    else:
        for y in (7, 9, 11, 13): p.rect(9, y, 22, y, Fd)
        p.block(12, 17, 19, 21, MUSTARD); p.rect(14, 19, 17, 19, MUSTARD_D)
        for x, y in ((5, 5), (26, 5), (5, 22), (26, 22)): p.put(x, y, tone(S, 0.35))
        p.rect(22, 3, 23, 25, TAPE)
    return p.done()


def intake_head(back=False):
    """the Intake Frame's head: a slate box, a visor with two red lamps (the Bureau's glow), an antenna with a tag"""
    S = '#5E6A80'
    p = Pix(21, 20)
    p.knob(8, 15, 12, 18)  # the neck
    p.line([(10, 1), (10, 3)], KNOB_D)
    p.rect(11, 1, 13, 2, MUSTARD)
    p.block(2, 4, 18, 15, S)
    for x0 in (1, 17): p.knob(x0, 8, x0 + 2, 11)
    if not back:
        p.rect(4, 7, 16, 11, '#2A2836')
        for x in (6, 13):
            p.rect(x, 8, x + 1, 9, '#FF5A7A'); p.put(x, 8, '#FFC0CC')
        p.rect(7, 13, 13, 13, tone(S, -0.3))
    else:
        p.rect(4, 7, 16, 7, MUSTARD); p.rect(4, 8, 16, 8, MUSTARD_D)
    return p.done()


def seizer_arm(back=False):
    """the Seizure Arm: a purple-grey arm ending in a claw that grips a manila folder (its back: the claw only)"""
    C = '#6E6A8C'
    p = Pix(21, 30)
    p.knob(8, 0, 12, 3)
    p.block(7, 3, 13, 12, C)
    p.knob(8, 12, 12, 15)
    p.block(8, 15, 12, 19, tone(C, -0.1))
    if not back:
        p.block(7, 21, 13, 27, '#E8C878'); p.rect(7, 21, 9, 21, '#C8A050'); p.rect(8, 24, 12, 24, '#C8A050')
    for sx in (-1, 1):
        x = lambda d: 10 + sx * d
        p.line([(x(1), 19), (x(5), 21), (x(7), 24), (x(7), 26), (x(5), 28)], tone(C, 0.15), 2)
        p.put(x(5), 28, tone(C, -0.3))
    return p.done()


def franker_arm(back=False):
    """the Franking Cannon: a red arm ending in a big rubber stamp, its ink pad down (it stamps everything it hits)"""
    C = '#B5473A'
    p = Pix(15, 29)
    p.knob(5, 0, 9, 3)
    p.block(4, 3, 10, 12, C)
    p.knob(5, 12, 9, 15)
    p.block(5, 15, 9, 18, '#7A2E28')
    p.rect(4, 18, 10, 18, MUSTARD)
    p.block(1, 19, 13, 25, C)
    p.rect(1, 26, 13, 27, '#2A1A22')
    if not back:
        p.rect(3, 21, 11, 22, tone(C, 0.25)); p.rect(2, 27, 12, 27, '#5A1A24')
        for x in (3, 6, 9, 11): p.put(x, 27, '#C83040')
    return p.done()


def conveyor_legs(back=False):
    """the Conveyor Treads: a conveyor belt that walks, rollers in it, parcels riding on top (taped red), a hazard
    stripe along its foot"""
    C = '#3F4A3E'
    p = Pix(34, 18)
    p.knob(15, 0, 18, 3)
    p.block(1, 4, 32, 16, C)
    p.rect(3, 6, 30, 13, '#2A322A')
    for x in (6, 12, 18, 24, 29):
        p.rect(x - 1, 8, x + 1, 11, KNOB); p.put(x - 1, 8, KNOB_L); p.put(x, 10, KNOB_D)
    for x in range(3, 31, 2): p.put(x, 15, MUSTARD)
    if not back:
        p.block(4, 1, 9, 4, '#A8784A'); p.rect(6, 1, 6, 4, TAPE)
        p.block(24, 2, 28, 4, '#A8784A'); p.rect(26, 2, 26, 4, TAPE)
    return p.done()


BOT_PARTS = {  # part id: its picture's maker, and a torso's head's
    'intake': (intake_torso, intake_head),
    'seizer': (seizer_arm, None),
    'franker': (franker_arm, None),
    'conveyor': (conveyor_legs, None),
}
CLERKS = {  # RL-14's parts: the Intake Clerk's frame and arms, on legs that walk
    'bureau_clerk_a': 'bot:volt.intake.seizer.franker.striders',
    'bureau_clerk_b': 'bot:tide.intake.franker.seizer.hover',
}


def add_bots(D):
    """the boss parts' pictures into game/art/robots and robots.json; the two clerks as people"""
    from PIL import Image
    R = D['robots']['parts']
    out = B1.ART / 'robots'
    for part, (body, head) in BOT_PARTS.items():
        art = R[part]['art']
        for back, key in ((False, 'img'), (True, 'imgB')):
            name = f'{part}_back' if back else part
            Image.fromarray(body(back)).save(out / f'{name}.png')
            art[key] = f'robots/{name}.png'
        if head:
            for back, key in ((False, 'head'), (True, 'headB')):
                name = f'{part}_head_back' if back else f'{part}_head'
                Image.fromarray(head(back)).save(out / f'{name}.png')
                art[key] = f'robots/{name}.png'
    for pid, rig in CLERKS.items():
        D['people'][pid] = {'look': {'name': 'Bureau clerk'}, 'creature': {'rig': rig, 'ht': 1.5}}


# ================================================================ the showcase map
def showcase():
    """test_intro_art: the five wrecks in a row on the grass (base, v 1-4), and nearer the camera the broken rail, the
    Bureau's portal on a path and the two clerks either side of it"""
    W, H = 132, 50
    tiles = [''.join('p' if 6 <= (H - 1 - row) < 9 else 'g' for x in range(W)) for row in range(H)]
    P = []
    for i in range(5):
        P.append({'k': 'train_wreck', 'x': 14 + i * 26, 'z': 22, **({'v': i} if i else {}), 'label': THEMES[i][1]})
    P.append({'k': 'sky_rail_broken', 'x': 20, 'z': 12})
    P.append({'k': 'bureau_portal', 'x': 44, 'z': 7.5})
    people = [{'id': 'clerk_a', 'who': 'bureau_clerk_a', 'name': 'Bureau clerk', 'x': 42.2, 'z': 7.5, 'dir': 'down'},
              {'id': 'clerk_b', 'who': 'bureau_clerk_b', 'name': 'Bureau clerk', 'x': 45.8, 'z': 7.5, 'dir': 'down'}]
    return {
        'name': 'Test: the intro art (intro track IN-3)', 'w': W, 'h': H, 'kind': 'test', 'test': 1, 'edge': 'g',
        'sky': ['#8CC6E6', '#BFE3EE', '#F4E8C8'], 'haze': '#EAD9C0', 'hazeD': 60,
        'cam': {'pitch': 30, 'h': 14, 'fov': 1}, 'blur': 0, 'amb': None, 'plain': 1, 'tint': None, 'indoor': 0,
        'far': 'hills', 'farH': 8, 'folk': 0, 'exits': [], 'checks': [], 'shots': [], 'hub': [44, 4], 'tiles': tiles,
        'props': P, 'people': people,
    }


def main():
    PICS.mkdir(parents=True, exist_ok=True)
    D = gamedata.load()
    C = D['scenery']['props']
    stats = add_wreck(C)
    for s in stats: print('%-18s %-10s %6d vertices %6d triangles' % s)
    add_portal(C)
    add_bots(D)
    D['maps']['test_intro_art'] = showcase()
    gamedata.save(D)


if __name__ == '__main__':
    main()
