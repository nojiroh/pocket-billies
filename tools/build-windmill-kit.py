#!/usr/bin/env python3
"""Buildings track BD-6: the windmill kit (the owner, 2026-10-29: "more windmill variety and variants"). Windmills are
one catalogue kind, `windmill` (its old key), whose `variants` swap the model: nine designs times three colourways
(copper and cream; white, red and navy; brass and teal). Each design is one recipe; a colourway is a palette `swap`
of its four colour tokens (the walk view's variants already swap a model's colours, prop-models.js swappedRecipe).
Every rotor turns as one `spin` (one draw per mesh, prop-models.js spinGroups).

  tower      the copper tower mill (today's, redone): a tapering tower, a reefing stage, an onion cap, lattice sails
  needle     the Googie needle: a spire on boomerang fins, a saucer pod, a halo ring, a starburst rotor
  helix      the helix turbine: a twisted vertical scoop round a glowing core, on a round pavilion
  postmill   the solar-sail post mill: a wooden body on a post over a roundhouse, lattice sails of solar cloth
  rocket     the rocket mill: a finned rocket, a propeller on its nose, a glowing exhaust ring
  windpump   the farm windpump: a lattice tower, a many-bladed wheel, a tail vane, a water tank, a pump house
  saucer     the saucer tower: a flying-saucer lookout on a column, two rotors turning opposite ways
  kite       the sky kite turbine: a ring turbine flying on a tether over a mooring hut
  treemill   the tree mill: a rotor bolted to a great tree, a cabin in its branches, a door in the trunk

The look: the owner's pick, B with C's extras on the showpieces; tall mills lean less (about 1.5-2.5 degrees,
converted by each model's height). Footprint 3.6 x 3.6 m for all (today's), the door on the front middle. Not placed
on Copperleaf: BD-7 places three to five round the island, no two the same design. The kite's ring does not bob:
a part's own bob would need the engine (a whole model bobs with the catalogue's `bob`).

Writes game/art/scene/next/models/windmill_<design>.json, the `windmill` catalogue entry (its first design and
colourway the base, the other 26 as variants, each with a picture baked from its model) and the test map
test_landmarks (debug menu, Test scenes): BD-6's landmarks along its front, the bubble cars (build-props-hub.py) by
the station, every windmill behind them.

    python3 tools/build-windmill-kit.py          # rerunnable
    python3 tools/build-windmill-kit.py --list   # the designs' triangle estimates, writes nothing
"""
import importlib.util
import math
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


LP = _load('landmark_parts', 'landmark_parts.py')
box, prism, lathe, cyl, sphere, limb = LP.box, LP.prism, LP.lathe, LP.cyl, LP.sphere, LP.limb
DEG, PPU = LP.DEG, LP.PPU
KIND, MAP_ID, MODELS = 'windmill', 'test_landmarks', 'scene/next/models'
CY, BOX = 1.8, [3.6, 3.6]  # the footprint's middle in depth; the footprint

# the colour tokens every design is built in (copper and cream), swapped for the other colourways
BODY, ROOF, TRIM, CLOTH = '#F2E2BF', '#C9773F', '#8A4A2B', '#F2E8D1'
COLOURWAYS = {
    'copper': ('copper and cream', {}),
    'navy': ('white, red and navy', {BODY: '#F4F1EA', ROOF: '#D4483E', TRIM: '#3E5288', CLOTH: '#FAF6F0'}),
    'teal': ('brass and teal', {BODY: '#2E7F8A', ROOF: '#D8B048', TRIM: '#F2E2BE', CLOTH: '#E8D8A8'}),
}
WOOD, BARK, IRON = '#9A6A44', '#7A5A40', LP.IRON


def door(y, z=0.15, w=0.78, h=1.6):
    return LP.door_arch(0, y, z, w, h, TRIM)


def spin(x, y, z, axis='y', rps=0.18):
    return {'axis': axis, 'x': round(x, 3), 'y': round(y, 3), 'z': round(z, 3), 'rps': rps}


# ---------------------------------------------------------------------------------------------------- the designs
def tower():
    """the copper tower mill, redone: a stone foot, a cream tower narrowing up, a reefing stage, a copper onion cap with
    a finial, four lattice sails"""
    z0, h = 1.0, 4.8
    rad = lambda z: 1.5 - 0.45 * (z - z0) / h
    L = [cyl(0, CY, 0, 1.78, 0.25, LP.STONE, 'stone', sides=16, name='plinth'),
         lathe(0, CY, 0.25, [(1.62, 0), (1.55, 0.75)], '#AAA6B4', 'stone', sides=16, name='stone foot'),
         lathe(0, CY, z0, [(rad(z0), 0), (rad(z0 + h * 0.5) + 0.04, h * 0.5), (rad(z0 + h), h)], BODY, 'plaster',
               sides=16, smooth=1, name='tower')]
    L += door(CY - 1.56, 0.25)
    for i, (z, a) in enumerate(((2.2, -90), (3.9, 0), (3.9, 180), (4.6, 90))):
        r, t = rad(z) - 0.03, a * DEG
        if a == -90:
            L += LP.porthole(0, CY - r, z, 0.22, 1 + i)
        else:
            L += [LP.box(r * math.cos(t), CY + r * math.sin(t), z - 0.3, 0.32 if a in (0, 180) else 0.42,
                         0.42 if a in (0, 180) else 0.32, 0.55, LP.GLASS, glass=1 + i, name='window')]
    sz = 2.6
    L += [cyl(0, CY, sz, 2.0, 0.1, WOOD, 'wood', sides=16, name='stage'),
          LP.ring(0, CY, sz + 0.62, 1.97, 0.05, TRIM, 'wood', sides=16, name='stage rail')]
    for i in range(8):
        a = i * math.pi / 4 + math.pi / 8
        c, s = math.cos(a), math.sin(a)
        L += [limb((c * rad(sz - 0.7), CY + s * rad(sz - 0.7), sz - 0.7), (c * 1.9, CY + s * 1.9, sz), 0.035, TRIM, 'wood', sides=4, name='stage brace'),
              limb((c * 1.97, CY + s * 1.97, sz + 0.1), (c * 1.97, CY + s * 1.97, sz + 0.65), 0.025, TRIM, 'wood', sides=4, name='stage post')]
    cz = z0 + h
    L += [cyl(0, CY, cz, 1.12, 0.12, TRIM, 'wood', sides=16, name='cap curb'),
          lathe(0, CY, cz + 0.12, [(1.18, 0), (1.25, 0.35), (1.0, 0.85), (0.5, 1.3), (0.12, 1.55), (0, 1.6)], ROOF,
                'standingseam', sides=16, smooth=1, name='roof', roof=1)]
    L += LP.atomic_finial(0, CY, cz + 1.65, 0.6)
    hy, hz = CY - 1.45, cz + 0.55
    L.append(limb((0, CY - 0.5, hz), (0, hy + 0.05, hz), 0.11, IRON, 'metal', sides=8, name='windshaft'))
    S = spin(0, hy, hz)
    L += LP.spun([sphere(0, hy - 0.1, hz - 0.18, 0.18, ROOF, 'metal', sides=10, rings=5, name='sail hub')], S)
    for q in range(4):
        L += LP.lattice_sail(0, hy - 0.12, hz, q * math.pi / 2 + math.pi / 4, 3.1, 0.55, CLOTH, TRIM, S)
    L += [LP.box(1.25, -0.15, 0, 0.45, 0.45, 0.38, LP.TERRA, 'brick', bevel=0.03, name='planter'),
          sphere(1.25, -0.15, 0.38, 0.28, LP.LEAF, 'leaves', sides=7, rings=4, lump=0.25, name='planter shrub')]
    return L, 2.5


def needle():
    """the Googie needle: a round lobby, three boomerang fins, a tall spire, a saucer pod with a ribbon of windows, a
    halo ring lit at every hour, a starburst rotor at the top"""
    L = [cyl(0, CY, 0, 1.0, 0.15, LP.STONE, 'stone', sides=14, name='plinth'),
         cyl(0, CY, 0.15, 0.85, 2.0, BODY, 'panels', sides=14, name='lobby'),
         cyl(0, CY, 2.15, 0.95, 0.12, ROOF, 'metal', sides=14, name='lobby cornice')]
    L += door(CY - 0.85)
    for deg in (90, 210, 330):
        L.append(prism(0, CY, 0, [(0.5, 0), (1.76, 0), (1.62, 0.32), (0.85, 1.6), (0.6, 4.2), (0.4, 4.4)], 0.12, TRIM,
                       'metal', rot=round(deg * DEG, 3), name='boomerang fin'))
    L.append(lathe(0, CY, 2.27, [(0.42, 0), (0.3, 3.0), (0.2, 5.6), (0.08, 6.8), (0, 7.2)], BODY, 'metal', sides=12,
                   smooth=1, name='spire'))
    sz = 4.6
    L += [lathe(0, CY, sz, [(0.3, 0), (1.15, 0.3), (1.35, 0.5), (1.25, 0.66), (0.7, 0.85), (0.35, 0.9)], ROOF,
                'metal', sides=18, smooth=1, name='saucer pod'),
          lathe(0, CY, sz + 0.5, [(1.33, 0), (1.3, 0.14)], '#9FC4D8', sides=18, glass=5, name='window ribbon'),
          LP.bubble(0, CY, sz + 0.84, 0.42, 6, h=0.36),
          LP.glow_ring(0, CY, sz - 0.02, 0.6, LP.NEON_T, name='pod glow')]
    hz = sz + 2.0
    L.append(LP.glow_ring(0, CY, hz, 0.85, LP.NEON_T, t=0.07, sides=18, day=True, name='halo ring'))
    for k in range(3):
        a = k * 2 * math.pi / 3
        L.append(limb((0.18 * math.cos(a), CY + 0.18 * math.sin(a), hz - 0.6), (0.82 * math.cos(a), CY + 0.82 * math.sin(a), hz),
                      0.02, TRIM, 'metal', sides=4, name='halo strut'))
    rz, ry = 2.27 + 6.1, CY - 0.4
    L.append(limb((0, CY - 0.1, rz), (0, ry, rz), 0.06, IRON, 'metal', sides=6, name='rotor shaft'))
    S = spin(0, ry, rz, rps=0.3)
    L += LP.spun(LP.starburst(0, ry - 0.04, rz, 0.5, 0.18, 8, ROOF, d=0.04, name='rotor starburst'), S)
    L += LP.rotor(0, ry - 0.08, rz, 8, 0.3, 1.5, 0.08, 0.22, BODY, S, hub_col=ROOF, d=0.03)
    return L, 1.5


def helix():
    """the helix turbine: a round pavilion with a door and a glass band, a mast, two twisted scoops turning round a
    glowing core (one spin), copper end plates, an atomic finial"""
    L = [cyl(0, CY, 0, 1.35, 0.15, LP.STONE, 'stone', sides=16, name='plinth'),
         cyl(0, CY, 0.15, 1.2, 2.1, BODY, 'panels', sides=16, name='pavilion'),
         lathe(0, CY, 1.55, [(1.21, 0), (1.21, 0.35)], '#9FC4D8', sides=16, glass=1, name='window band'),
         lathe(0, CY, 2.25, [(1.35, 0), (1.3, 0.15), (0.6, 0.45), (0.3, 0.5)], ROOF, 'standingseam', sides=16,
               name='roof', roof=1)]
    L += door(CY - 1.2)
    z0, z1 = 3.0, 8.0
    L += [cyl(0, CY, 2.7, 0.14, z1 - 2.5, IRON, 'metal', sides=8, name='mast'),
          cyl(0, CY, z0 + 0.1, 0.17, z1 - z0 - 0.2, '#F4F8FF', sides=8, glow=LP.NEON_T, name='glowing core')]
    S = spin(0, CY, z0, axis='z', rps=0.35)
    H = [lathe(0, CY, z0 - 0.05, [(0, 0), (0.95, 0), (0.95, 0.06), (0, 0.06)], ROOF, 'metal', sides=14, name='end plate'),
         lathe(0, CY, z1, [(0, 0), (0.95, 0), (0.95, 0.06), (0, 0.06)], ROOF, 'metal', sides=14, name='end plate')]
    n = 16
    for b in (0, math.pi):
        for k in range(n):
            t = (k + 0.5) / n
            a = b + t * math.pi * 1.2
            r = 0.55
            H.append(box(r * math.cos(a), CY + r * math.sin(a), z0 + k * (z1 - z0) / n, 0.8, 0.05, (z1 - z0) / n + 0.02,
                         BODY if k % 2 else CLOTH, 'metal', rot=round(a, 3), name='scoop'))
    L += LP.spun(H, S)
    L += LP.atomic_finial(0, CY, z1 + 0.06, 0.6)
    return L, 2.0


def postmill():
    """the solar-sail post mill: a roundhouse with a door, the post through its roof, a wooden body with a gabled roof
    up on the post, four lattice sails of solar cloth, a tail pole and a ladder"""
    L = LP.roundhouse(0, CY, 1.2, 1.5, BODY, ROOF, 'shingles', door_col=TRIM)
    L.append(cyl(0, CY, 2.0, 0.18, 1.7, WOOD, 'wood', sides=8, name='post'))
    bz, bw, bd, bh = 3.6, 1.8, 2.0, 2.0
    L += [box(0, CY, bz, bw, bd, bh, BODY, 'battens', bevel=0.03, name='mill body'),
          box(0, CY, bz - 0.12, bw + 0.15, bd + 0.15, 0.12, TRIM, 'wood', name='body sill'),
          prism(0, CY, bz + bh, [(-1.1, 0), (1.1, 0), (0, 0.95)], bd + 0.3, ROOF, 'shingles', name='roof', roof=1),
          LP.box(0, CY - bd / 2 - 0.01, bz + 0.9, 0.5, 0.04, 0.55, LP.GLASS, glass=2, name='window'),
          LP.box(0, CY - bd / 2 - 0.02, bz + 0.85, 0.62, 0.03, 0.65, TRIM, 'wood', name='window frame')]
    L += [limb((0, CY + bd / 2, bz + 0.1), (0, 3.5, 0.3), 0.07, WOOD,
               'wood', sides=6, name='tail pole')]
    for s in (-1, 1):
        L.append(limb((s * 0.3, CY + bd / 2 + 0.05, bz), (s * 0.3, CY + 1.65, 0.9), 0.03, TRIM, 'wood', sides=4, name='ladder rail'))
    for k in range(5):
        t = (k + 0.5) / 5
        y, z = CY + bd / 2 + 0.05 + (1.65 - bd / 2 - 0.05) * t, bz + (0.9 - bz) * t
        L.append(limb((-0.3, y, z), (0.3, y, z), 0.02, TRIM, 'wood', sides=4, name='ladder rung'))
    hy, hz = CY - bd / 2 - 0.35, bz + 1.5
    L.append(limb((0, CY - bd / 2 + 0.2, hz), (0, hy + 0.05, hz), 0.1, IRON, 'metal', sides=8, name='windshaft'))
    S = spin(0, hy, hz, rps=0.16)
    L += LP.spun([sphere(0, hy - 0.1, hz - 0.16, 0.16, ROOF, 'metal', sides=10, rings=5, name='sail hub')], S)
    for q in range(4):
        L += LP.lattice_sail(0, hy - 0.12, hz, q * math.pi / 2, 3.0, 0.6, '#3A4C7E', TRIM, S, tex='solar')
    return L, 3.0


def rocket():
    """the rocket mill: a stone pad with an exhaust ring lit at night, a cream and copper rocket on three fins, a round
    door, portholes, a nose cone, a three-bladed propeller turning on its front"""
    L = [cyl(0, CY, 0, 1.7, 0.25, LP.STONE, 'stone', sides=16, name='launch pad'),
         LP.glow_ring(0, CY, 0.25, 1.15, LP.NEON_A, t=0.08, name='exhaust ring')]
    rad = lambda z: 1.0 + 0.08 * math.sin(min(1, z / 1.8) * math.pi / 2) - 0.3 * max(0, (z - 1.8) / 5.2)
    cuts = [0.25, 1.6, 3.4, 5.2, 7.2]
    for i in range(4):
        za, zb = cuts[i], cuts[i + 1]
        L.append(lathe(0, CY, za, [(rad(za + (zb - za) * k / 3), (zb - za) * k / 3) for k in range(4)],
                       BODY if i % 2 == 0 else ROOF, 'riveted' if i % 2 else 'plaster', sides=16, smooth=1, name='body'))
    L.append(lathe(0, CY, 7.2, [(rad(7.2), 0), (0.6, 0.6), (0.32, 1.05), (0.08, 1.35), (0, 1.4)], ROOF, 'metal',
                   sides=16, smooth=1, name='roof', roof=1))
    for deg in (90, 210, 330):
        L.append(prism(0, CY, 0.25, [(0.75, 0), (1.72, 0), (1.72, 0.55), (1.1, 2.6), (0.85, 2.85)], 0.12, TRIM, 'metal',
                       rot=round(deg * DEG, 3), name='fin'))
    L += door(CY - rad(0.5) + 0.04, 0.25, 0.7, 1.5)
    for i, z in enumerate((2.6, 4.2)):
        L += LP.porthole(0, CY - rad(z) - 0.01, z, 0.24, 1 + i)
    hz = 5.9
    hy = CY - rad(hz) - 0.45
    L.append(limb((0, CY - rad(hz) + 0.1, hz), (0, hy, hz), 0.09, IRON, 'metal', sides=8, name='prop shaft'))
    L += LP.rotor(0, hy, hz, 3, 0.15, 1.6, 0.34, 0.2, TRIM, spin(0, hy, hz, rps=0.4), hub_col=ROOF, d=0.05)
    L += LP.antenna(0, CY, 8.6, 0.6)
    return L, 2.0


def windpump():
    """the farm windpump: a pump house with a door, a lattice tower over it, a wheel of eighteen blades, a tail vane, a
    water tank on legs"""
    L = [box(0, 0.75, 0, 1.4, 1.2, 1.55, BODY, 'battens', name='pump house'),
         prism(0, 0.75, 1.55, [(-0.85, 0), (0.85, 0), (0, 0.6)], 1.35, ROOF, 'shingles', name='roof', roof=1)]
    L += door(0.15, 0.0, 0.62, 1.3)
    tz = 6.6
    legs = [(-1.25, 0.45), (1.25, 0.45), (-1.25, 3.1), (1.25, 3.1)]
    top = [(-0.28, CY - 0.28), (0.28, CY - 0.28), (-0.28, CY + 0.28), (0.28, CY + 0.28)]
    for (x0, y0), (x1, y1) in zip(legs, top):
        L.append(limb((x0, y0, 0), (x1, y1, tz), 0.05, TRIM, 'metal', sides=4, name='tower leg'))
    for f in (0.3, 0.6):
        P = [(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f) for (x0, y0), (x1, y1) in zip(legs, top)]
        for i, j in ((0, 1), (1, 3), (3, 2), (2, 0)):
            L.append(limb((*P[i], tz * f), (*P[j], tz * f), 0.025, TRIM, 'metal', sides=4, name='tower brace'))
    L += [cyl(0, CY, tz, 0.45, 0.12, IRON, 'metal', sides=10, name='platform'),
          box(0, CY, tz + 0.12, 0.35, 0.8, 0.35, ROOF, 'metal', bevel=0.03, name='gearbox'),
          limb((0, CY, tz + 0.2), (0, 0.8, 2.2), 0.02, IRON, 'metal', sides=4, name='pump rod')]
    hy, hz = CY - 0.55, tz + 0.3
    S = spin(0, hy, hz, rps=0.25)
    L += LP.rotor(0, hy, hz, 18, 0.32, 1.4, 0.16, 0.3, BODY, S, hub_col=ROOF, d=0.02)
    L += LP.spun([LP.front_ring(0, hy + 0.02, hz, 1.38, 0.06, ROOF, sides=20, name='wheel rim'),
                  LP.front_ring(0, hy + 0.02, hz, 0.75, 0.05, ROOF, sides=16, name='wheel ring')], S)
    L += [limb((0, CY + 0.3, hz), (0, CY + 1.75, hz), 0.04, IRON, 'metal', sides=4, name='vane boom'),
          prism(0, CY + 1.45, hz - 0.3, [(-0.05, 0), (0.6, 0), (0.75, 0.6), (-0.05, 0.75)], 0.04, ROOF, 'metal',
                rot=round(90 * DEG, 3), name='tail vane'),
          prism(0, CY + 1.45, hz - 0.05, [(0.05, 0), (0.62, 0), (0.66, 0.15), (0.05, 0.15)], 0.05, BODY, 'metal',
                rot=round(90 * DEG, 3), name='vane stripe')]
    wx, wy = 1.15, 3.0
    for dx, dy in ((-0.3, -0.3), (0.3, -0.3), (-0.3, 0.3), (0.3, 0.3)):
        L.append(limb((wx + dx, wy + dy, 0), (wx + dx * 0.8, wy + dy * 0.8, 1.3), 0.03, WOOD, 'wood', sides=4, name='tank leg'))
    L += [cyl(wx, wy, 1.3, 0.5, 0.85, WOOD, 'battens', sides=12, name='water tank'),
          lathe(wx, wy, 2.15, [(0.56, 0), (0.25, 0.3), (0, 0.38)], ROOF, 'metal', sides=12, name='tank roof', roof=1),
          LP.ring(wx, wy, 1.65, 0.51, 0.05, IRON, sides=12, name='tank hoop')]
    return L, 2.0


def saucer():
    """the saucer tower: a flared column with a door, a flying-saucer lookout with a ribbon of windows and a glow round
    its rim at night, a glass dome, and two rotors on its mast turning opposite ways"""
    L = [cyl(0, CY, 0, 1.2, 0.15, LP.STONE, 'stone', sides=16, name='plinth'),
         lathe(0, CY, 0.15, [(1.0, 0), (0.75, 0.5), (0.45, 1.6), (0.38, 4.6)], BODY, 'riveted', sides=14, smooth=1,
               name='column')]
    L += door(CY - 0.92, 0.15, 0.7, 1.45)
    sz = 4.6
    L += [lathe(0, CY, sz, [(0.4, 0), (1.3, 0.3), (1.72, 0.55), (1.6, 0.75), (1.0, 0.95), (0.85, 1.0)], ROOF, 'metal',
                sides=20, smooth=1, name='saucer'),
          lathe(0, CY, sz + 0.58, [(1.69, 0), (1.62, 0.15)], '#9FC4D8', sides=20, glass=1, name='window ribbon'),
          LP.glow_ring(0, CY, sz + 0.45, 1.66, LP.NEON_P, t=0.06, sides=20, name='rim glow'),
          LP.bubble(0, CY, sz + 0.98, 0.82, 2, h=0.6, sides=14),
          cyl(0, CY, sz + 1.5, 0.08, 1.9, IRON, 'metal', sides=8, name='mast')]
    for lv, (z, rps, col) in enumerate(((sz + 2.2, 0.35, BODY), (sz + 2.75, -0.35, TRIM))):
        S = spin(0, CY, z, axis='z', rps=rps)
        B = [cyl(0, CY, z - 0.06, 0.16, 0.14, ROOF, 'metal', sides=8, name='rotor hub')]
        for k in range(3):
            a = k * 2 * math.pi / 3 + lv * 0.5
            B.append(box(0.85 * math.cos(a), CY + 0.85 * math.sin(a), z, 1.45, 0.2, 0.04, col, 'metal', rot=round(a, 3),
                         tilt=[0.12, 0], name='rotor blade'))
        L += LP.spun(B, S)
    L.append(sphere(0, CY, sz + 3.4, 0.08, '#FFE0E8', sides=6, rings=3, glow={'col': LP.NEON_P, 'day': 1}, name='mast tip'))
    return L, 2.0


def kite():
    """the sky kite turbine: a round mooring hut with a winch, a tether up to a ring turbine flying high (its ring and
    tether are model layers), the ring's rotor turning, fins and a glow round the ring"""
    L = LP.roundhouse(0, CY, 1.05, 1.6, BODY, ROOF, 'standingseam', door_col=TRIM)
    L += [cyl(0, CY, 2.45, 0.3, 0.3, IRON, 'metal', sides=10, name='winch'),
          box(0.74, CY - 0.74, 0.8, 0.4, 0.04, 0.4, LP.GLASS, rot=round(-45 * DEG, 3), glass=1, name='window'),
          box(0.75, CY - 0.75, 0.75, 0.5, 0.03, 0.5, TRIM, 'wood', rot=round(-45 * DEG, 3), name='window frame')]
    rx, ry, rz = 0.35, CY - 0.4, 9.0
    L.append(limb((0, CY, 2.75), (rx, ry + 0.1, rz - 1.2), 0.015, '#E8E0D0', 'cloth', sides=4, name='tether'))
    L += [LP.front_ring(rx, ry + 0.1, rz, 1.25, 0.22, ROOF, sides=20, name='turbine ring'),
          LP.front_ring(rx, ry, rz, 1.13, 0.05, '#F4F8FF', 'plain', sides=20, glow={'col': LP.NEON_T, 'day': 1},
                        name='ring glow')]
    for deg in (210, 330):
        a = deg * DEG
        L.append(prism(rx + 1.2 * math.cos(a), ry + 0.25, rz + 1.2 * math.sin(a),
                       [(0, 0), (0.45 * math.cos(a) - 0.1, 0.45 * math.sin(a)), (0.45 * math.cos(a) + 0.1, 0.45 * math.sin(a))],
                       0.3, TRIM, 'metal', name='ring fin'))
    for k in range(3):
        a = math.pi / 2 + k * 2 * math.pi / 3
        L.append(limb((rx + 0.15 * math.cos(a), ry + 0.15, rz + 0.15 * math.sin(a)), (rx + 1.15 * math.cos(a), ry + 0.15, rz + 1.15 * math.sin(a)),
                      0.025, TRIM, 'metal', sides=4, name='ring strut'))
    L += LP.rotor(rx, ry - 0.05, rz, 6, 0.18, 1.08, 0.26, 0.4, BODY, spin(rx, ry - 0.05, rz, rps=0.45), hub_col=ROOF, d=0.03)
    return L, 1.0


def treemill():
    """the tree mill: a great tree with a round door in its trunk, a cabin in its branches on a deck, a rope ladder,
    lattice sails bolted to the trunk's front, a lantern"""
    L = [lathe(0, CY, 0, [(1.15, 0), (0.85, 0.35), (0.62, 1.4), (0.55, 3.6), (0.4, 5.4), (0.2, 6.2)], BARK, 'bark',
               sides=12, smooth=1, name='trunk')]
    L += LP.door_arch(0, CY - 0.75, 0.0, 0.62, 1.35, TRIM)
    for (x, y, z), (x2, y2, z2) in ((( 0.3, CY, 3.9), (1.45, CY + 0.4, 5.3)), ((-0.3, CY, 4.2), (-1.5, CY + 0.3, 5.6)),
                                    ((0.0, CY + 0.3, 4.6), (0.2, CY + 1.5, 6.2))):
        L.append(limb((x, y, z), (x2, y2, z2), 0.16, BARK, 'bark', sides=6, name='branch'))
    for (x, y, z, r, c) in ((1.3, CY + 0.4, 5.2, 0.95, LP.LEAF), (-1.35, CY + 0.3, 5.5, 1.0, LP.LEAF2),
                            (0.1, CY + 1.0, 6.0, 1.15, LP.LEAF), (0.0, CY + 0.2, 6.9, 0.9, LP.LEAF2)):
        L.append(sphere(x, y, z, r, c, 'leaves', sides=8, rings=5, lump=0.25, name='crown'))
    dz = 3.5
    L += [cyl(-0.2, CY + 0.55, dz, 1.15, 0.12, WOOD, 'wood', sides=10, name='deck'),
          box(-0.45, CY + 0.75, dz + 0.12, 1.4, 1.1, 1.15, BODY, 'battens', bevel=0.03, name='cabin'),
          prism(-0.45, CY + 0.75, dz + 1.27, [(-0.85, 0), (0.85, 0), (0, 0.7)], 1.3, ROOF, 'shingles', name='roof',
                roof=1),
          LP.box(-0.95, CY + 0.19, dz + 0.5, 0.36, 0.04, 0.4, LP.GLASS, glass=1, name='window'),
          LP.box(-0.95, CY + 0.2, dz + 0.46, 0.46, 0.03, 0.48, TRIM, 'wood', name='window frame'),
          LP.ring(-0.2, CY + 0.55, dz + 0.65, 1.12, 0.04, TRIM, 'wood', sides=10, name='deck rail')]
    L += [LP.box(-0.45, CY + 1.31, dz + 0.5, 0.36, 0.04, 0.4, LP.GLASS, glass=2, name='window')]
    for s in (-1, 1):
        L.append(limb((-1.3 + s * 0.18, CY - 0.1, dz), (-1.3 + s * 0.18, CY - 0.25, 0.0), 0.015, '#D6C08A', 'cloth', sides=4,
                      name='ladder rope'))
    for k in range(6):
        z = 0.4 + k * 0.52
        L.append(limb((-1.48, CY - 0.24 + z * 0.04, z), (-1.12, CY - 0.24 + z * 0.04, z), 0.02, WOOD, 'wood', sides=4,
                      name='ladder rung'))
    L += [limb((0.5, CY - 0.2, dz - 0.2), (0.5, CY - 0.55, dz - 0.5), 0.015, IRON, 'metal', sides=4, name='lantern arm'),
          sphere(0.5, CY - 0.55, dz - 0.75, 0.1, '#FFE9B0', sides=8, rings=4, glow='#FFC860', name='lantern')]
    hy, hz = CY - 0.95, 3.0
    L.append(limb((0, CY - 0.4, hz), (0, hy + 0.05, hz), 0.1, IRON, 'metal', sides=8, name='windshaft'))
    S = spin(0, hy, hz, rps=0.2)
    L += LP.spun([sphere(0, hy - 0.1, hz - 0.15, 0.15, ROOF, 'metal', sides=10, rings=5, name='sail hub')], S)
    for q in range(4):
        L += LP.lattice_sail(0, hy - 0.12, hz, q * math.pi / 2 + math.pi / 4, 2.3, 0.5, CLOTH, TRIM, S)
    return L, 2.5


DESIGNS = [  # key, name, builder; the lean in degrees comes back with the layers
    ('tower', 'Copper tower mill', tower), ('needle', 'Googie needle', needle), ('helix', 'Helix turbine', helix),
    ('postmill', 'Solar-sail post mill', postmill), ('rocket', 'Rocket mill', rocket),
    ('windpump', 'Farm windpump', windpump), ('saucer', 'Saucer tower', saucer), ('kite', 'Sky kite turbine', kite),
    ('treemill', 'Tree mill', treemill),
]


def recipe(key):
    fn = next(f for k, _n, f in DESIGNS if k == key)
    L, deg = fn()
    return LP.recipe(L, LP.lean_warp(L, deg, sag=0.04, bulge=0.025), about=f'BD-6: the windmill kit, {key}')


def swapped(rec, sw):
    return {**rec, 'layers': [l | ({'col': sw[l['col']]} if l.get('col') in sw else {}) for l in rec['layers']]}


def fx_of(rec):
    """a window fx at the lowest glass facing the front (in picture pixels at the catalogue's ppu)"""
    G = [l for l in rec['layers'] if l.get('glass')]
    if not G: return []
    g = min(G, key=lambda l: l.get('z', 0))
    return [{'k': 'window', 'x': LP.px(g.get('x', 0)), 'y': -LP.px(g.get('z', 0) + 0.2)}]


def catalogue(C, ISL, B1):
    old = C.get(KIND, {})
    recs = {k: recipe(k) for k, _n, _f in DESIGNS}
    entries = []
    for k, name, _f in DESIGNS:
        path = B1.write_recipe(f'windmill_{k}', recs[k])
        used = {l.get('col') for l in recs[k]['layers']}
        for c, (cname, sw) in COLOURWAYS.items():
            sw = {a: b for a, b in sw.items() if a in used}  # only the tokens this design has
            pic, ox, oy = ISL.bake(swapped(recs[k], sw), f'windmill_{k}_{c}')
            V = {'img': pic, 'ox': ox, 'oy': oy, 'model': path, 'fx': fx_of(recs[k]), 'name': f'{name} ({cname})',
                 'kit': {'design': k, 'colours': c}}
            if sw: V['swap'] = dict(sw)
            entries.append(V)
    base = entries[0]
    M = {'name': 'Windmill', 'img': base['img'], 'ox': base['ox'], 'oy': base['oy'], 'shadow': 1.6, 'sway': 0, 'flat': 0,
         'tags': old.get('tags', ['farm']), 'group': 'windmill', 'box': list(BOX), 'door': {'x': 0, 'y': 0},
         'fx': base['fx'], 'landmark': 1, 'model': base['model'], 'ppm': 32, 'solid': 1,
         'vary': {'rot': 0, 'lean': 0, 'size': 0}, 'kit': base['kit'],
         'about': 'BD-6: the windmill kit, nine designs times three colourways (tools/build-windmill-kit.py); a '
                  'placement picks one with v (its variants: model and colour swaps); every rotor turns as one part',
         'variants': entries[1:]}
    C[KIND] = M
    return M


LANDMARKS = [('workshop', 6.0), ('gene_bank', 13.0), ('lighthouse', 20.0), ('barn', 28.0), ('train_station', 44.0)]


def test_map(n_variants):
    """BD-6's landmarks along the front (the Workshop, the Gene Bank, the lighthouse, the barn, Skyline Station, the
    bubble cars by the station), and behind them every windmill: a design a column, its three colourways one behind
    the other"""
    step = 7.0
    W, H = int(step * len(DESIGNS) + 10), 46
    tiles = ['g' * W for _ in range(H)]
    props, shots = [], []
    for k, x in LANDMARKS:
        props.append({'k': k, 'x': x, 'z': 8.0})
        shots.append({'x': x, 'z': 0.0, 'yaw': 0, 'label': k})
    for i in range(3):
        p = {'k': 'bubble_car', 'x': 54.0 + i * 3.0, 'z': 5.0}
        if i: p['v'] = i
        props.append(p)
    for i, (k, name, _f) in enumerate(DESIGNS):
        x = round(7 + i * step, 2)
        for j in range(3):
            v = i * 3 + j
            p = {'k': KIND, 'x': x, 'z': 22.0 + j * 8}
            if v: p['v'] = v
            props.append(p)
        shots.append({'x': x, 'z': 14.0, 'yaw': 0, 'label': f'windmill_{k}'})
    for i in range(H - 7, H - 5):
        tiles[i] = 'p' * W
    return {
        'name': 'Test: the landmarks, the windmill kit and the bubble cars (buildings track BD-6)',
        'w': W, 'h': H, 'edge': 'g',
        'sky': ['#8CC6E6', '#BFE3EE', '#F4E8C8'], 'haze': '#EAD9C0', 'hazeD': 60,
        'cam': {'pitch': 30, 'h': 14, 'fov': 1}, 'blur': 0, 'amb': None, 'plain': 1, 'tint': None, 'indoor': 0,
        'far': 'hills', 'farH': 8, 'folk': 0, 'test': 1, 'exits': [], 'checks': [], 'shots': shots,
        'hub': [3, 2], 'kind': 'test', 'tiles': tiles, 'props': props,
    }


def main():
    if '--list' in sys.argv:
        for k, name, _f in DESIGNS:
            r = recipe(k)
            print(f'{k:10} {name:24} ~{LP.tris(r)} triangles, {sum(1 for l in r["layers"] if l.get("spin"))} turning layers, lean {r["warp"]["lean"]}')
        return
    ISL = _load('island', 'build-props-island.py')
    B1 = ISL.B1
    ISL.PICS = B1.ART / 'scene' / 'next' / 'hub'
    ISL.PICS.mkdir(parents=True, exist_ok=True)
    D = gamedata.load()
    M = catalogue(D['scenery']['props'], ISL, B1)
    D['maps'][MAP_ID] = test_map(len(M['variants']) + 1)
    gamedata.save(D)
    print(f'windmill kit: {len(DESIGNS)} designs, {len(M["variants"]) + 1} looks; the {KIND} kind and {MAP_ID}')


if __name__ == '__main__':
    main()
