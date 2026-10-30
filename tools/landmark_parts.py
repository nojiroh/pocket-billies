"""Buildings track BD-6: parts shared by the landmark builders (build-props-hub.py, build-props-island.py's barn,
build-station-trains.py's station, build-windmill-kit.py). BD-3's shapes and palette (tools/build-look-sketches.py)
plus what the landmarks add: cogs, starbursts, rotors, rings, bubble domes, neon, and the warp's lean given in
degrees (the owner's pick "B base + C showpieces": the warp's `lean` is metres at the model's top, so it is
converted by the model's own height).

Recipes here face the front at y 0 (the camera's side), their footprint behind it (y 0..d), up is z.
"""
import importlib.util
import math
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, _ROOT / 'tools' / file)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


SK = _load('look_sketches_parts', 'build-look-sketches.py')
box, prism, lathe, cyl, sphere, limb, r3 = SK.box, SK.prism, SK.lathe, SK.cyl, SK.sphere, SK.limb, SK.r3
arc, arch, star, disc, porthole, window, lamp = SK.arc, SK.arch, SK.star, SK.disc, SK.porthole, SK.window, SK.lamp
flower_box, ivy, atomic_finial, antenna = SK.flower_box, SK.ivy, SK.atomic_finial, SK.antenna
CREAM, BUTTER, WHITE, WOOD, DARK = SK.CREAM, SK.BUTTER, SK.WHITE, SK.WOOD, SK.DARK
COPPER, VERDI, TEAL, TERRA, BRASS, NAVY, RED = SK.COPPER, SK.VERDI, SK.TEAL, SK.TERRA, SK.BRASS, SK.NAVY, SK.RED
GLASS, STONE, LEAF, LEAF2, MOSS = SK.GLASS, SK.STONE, SK.LEAF, SK.LEAF2, SK.MOSS
NEON_T, NEON_P, NEON_A = SK.NEON_T, SK.NEON_P, SK.NEON_A
IRON, STEEL, CHROME, MINT = '#3E3E4A', '#8C8C98', '#DCE2EC', '#9AD8C0'
DEG = math.pi / 180
PPU = 34  # the catalogue's picture pixels a metre (scenery.json ppu): doors are read at it (prop-turn.js propDoor)
FX_PPM = 32  # fx (windows, glows, smoke) are read at the kind's own ppm (walk/frame-items.js `mpp`), 32 for models


def px(m):
    """a door's x in the catalogue's pixels"""
    return round(m * PPU)


def fxpx(m):
    """an fx point in the model's own pixels (BD-7: not the catalogue's, see FX_PPM)"""
    return round(m * FX_PPM)


def top_of(L):
    """the still parts' highest point in metres (what the warp's lean is measured at)"""
    t = 0.0
    for l in L:
        if l.get('spin') or l.get('k') == 'img':
            continue
        k, z = l['k'], l.get('z', 0)
        if k in ('prism', 'lathe'):
            h = max(p[1] for p in l['pts'])
        elif k == 'limb':
            h = max(0, l['z2'] - z) + l.get('r', 0)
        elif k == 'sphere':
            h = 2 * l['r']
        else:
            h = l.get('h', 0)
        t = max(t, z + h)
    return t


def lean_warp(L, deg, sag=0.0, bulge=0.0, twist=0.0, side=(1.0, 0.15)):
    """the warp for a lean of `deg` degrees (measured by the model's own height), toward `side` [across, depth]"""
    m = math.tan(deg * DEG) * top_of(L)
    n = math.hypot(*side) or 1
    W = {'lean': [r3(m * side[0] / n), r3(m * side[1] / n)]}
    if sag: W['sag'] = r3(sag)
    if bulge: W['bulge'] = r3(bulge)
    if twist: W['twist'] = r3(twist)
    return W


def spun(parts, spin):
    """the parts turning together: one spin, so the game draws them as one turning mesh (prop-models.js spinGroups)"""
    return [p | {'spin': dict(spin)} for p in parts]


def cog_pts(r, teeth, depth=0.18):
    """a cog's outline (centred), its teeth `depth` deep out of the rim"""
    P, n = [], teeth * 4
    for i in range(n):
        a = 2 * math.pi * i / n
        rr = r + (depth * r if i % 4 in (1, 2) else 0)
        P.append((rr * math.cos(a + math.pi / n), rr * math.sin(a + math.pi / n)))
    return P


def cog(x, y, z, r, col, teeth=12, d=0.12, tex='metal', name='gear', hub=IRON):
    """a cog facing the front, centred on (x, z), at depth y (its middle): the toothed plate, a hub and spokes' holes
    read as a darker ring"""
    return [prism(x, y, z, cog_pts(r, teeth), d, col, tex, name=name),
            prism(x, y - d / 2 - 0.01, z, [(r * 0.62 * math.cos(a), r * 0.62 * math.sin(a)) for a in
                                          [2 * math.pi * i / 16 for i in range(16)]], 0.02, DARK, name=name + ' web'),
            prism(x, y - d / 2 - 0.02, z, [(r * 0.5 * math.cos(a), r * 0.5 * math.sin(a)) for a in
                                          [2 * math.pi * i / 16 for i in range(16)]], 0.02, col, tex, name=name + ' face'),
            lathe(x, y - d / 2 - 0.03, z, [(0, 0), (r * 0.2, 0), (r * 0.2, 0.06), (0.0, 0.06)], hub, 'metal',
                  tilt=[-90 * DEG, 0], sides=10, name=name + ' hub')]


def starburst(x, y, z, r0, r1, n, col, d=0.05, core=None, name='starburst', glow=None, tex='metal'):
    """a Googie starburst facing the front, centred on (x, z)"""
    L = [prism(x, y, z, star(r0, r1, n), d, col, tex, name=name)]
    if core:
        L.append(sphere(x, y - d / 2 - 0.02, z - r1 * 0.5, r1 * 0.5, core, sides=8, rings=4,
                        **({'glow': glow} if glow else {}), name=name + ' core'))
    return L


def ring(x, y, z, r, t, col, tex='metal', sides=16, tilt=None, name='ring', **k):
    """a flat ring (an annulus `t` wide and `t` thick), lying flat unless tilted"""
    pts = [(r - t / 2, 0), (r + t / 2, 0), (r + t / 2, t), (r - t / 2, t), (r - t / 2, 0)]
    kw = {'tilt': tilt} if tilt else {}
    return lathe(x, y, z, pts, col, tex, sides=sides, name=name, **kw, **k)


def front_ring(x, y, z, r, t, col, tex='metal', sides=16, name='ring', **k):
    """a ring standing in the front plane, centred on (x, z)"""
    return ring(x, y, z, r, t, col, tex, sides, tilt=[-90 * DEG, 0], name=name, **k)


def bubble(x, y, z, r, glass, col='#BFE6E8', h=None, ry=None, name='bubble dome', sides=12):
    """a glass bubble dome (a window: lit from inside at night)"""
    return {'k': 'dome', 'x': r3(x), 'y': r3(y), 'z': r3(z), 'r': r3(r), 'ry': r3(ry or r), 'h': r3(h or r),
            'sides': sides, 'rings': 4, 'col': col, 'tex': 'glassblock', 'name': name, 'glass': glass}


def neon(a, b, col, r=0.03, name='neon tube'):
    """a glowing tube from a to b (lit at night)"""
    return limb(a, b, r, '#F4F8FF', glow=col, sides=5, name=name)


def blade(x, y, z, a, r0, r1, w0, w1, col, tex='metal', d=0.03, pitch=0.0, name='blade'):
    """one rotor blade in the front plane, from r0 to r1 out of the hub at angle a (radians, 0 = right), w0..w1 wide
    (a flat prism, a little pitched)"""
    c, s = math.cos(a), math.sin(a)
    q = [(r0, -w0 / 2), (r1, -w1 / 2), (r1, w1 / 2), (r0, w0 / 2)]
    pts = [(x0 * c - y0 * s, x0 * s + y0 * c) for x0, y0 in q]
    return prism(x, y, z, pts, d, col, tex, name=name)


def rotor(x, y, z, n, r0, r1, w0, w1, col, spin, hub_col=BRASS, tex='metal', phase=0.0, name='rotor blade', d=0.03):
    """n blades round a hub facing the front, all turning together (one spin)"""
    L = [blade(x, y, z, phase + 2 * math.pi * i / n, r0, r1, w0, w1, col, tex, d, name=name) for i in range(n)]
    L.append(lathe(x, y - d, z, [(0, 0), (max(r0, 0.12), 0), (max(r0, 0.12) * 0.6, 0.18), (0, 0.24)], hub_col, 'metal',
                   tilt=[-90 * DEG, 0], sides=10, name='rotor hub'))
    return spun(L, spin)


def lattice_sail(x, y, z, a, length, width, cloth, wood, spin, tex='cloth'):
    """one lattice sail of a mill facing the front, pointing at angle a: a stock, the cloth (or solar cloth) and bars"""
    c, s = math.cos(a), math.sin(a)

    def part(r0, r1, b0, b1, dy, col, t, name, d):
        q = [(r0, b0), (r1, b0), (r1, b1), (r0, b1)]
        return prism(x, y + dy, z, [(u * c - v * s, u * s + v * c) for u, v in q], d, col, t, name=name)
    L = [part(0.1, length, -0.06, 0.06, 0, wood, 'wood', 'sail stock', 0.1),
         part(0.25 * length, length, 0.08, 0.08 + width, 0.02, cloth, tex, 'sail cloth', 0.02),
         part(0.25 * length, length, 0.08 + width, 0.14 + width, 0, wood, 'wood', 'sail rail', 0.05)]
    for i in range(5):
        u = 0.28 * length + i * 0.17 * length
        L.append(part(u, u + 0.05, 0.0, 0.14 + width, -0.03, wood, 'wood', 'sail bar', 0.04))
    return spun(L, spin)


def roundhouse(x, y, r, h, wall, roof, roof_tex='fishscale', door_col=TEAL, glass=1, door=True):
    """a little round lobby with a conical roof and a door on its front (y - r)"""
    L = [cyl(x, y, 0, r + 0.1, 0.15, STONE, 'stone', sides=14, name='plinth'),
         cyl(x, y, 0.15, r, h, wall, 'plaster', sides=14, name='walls'),
         lathe(x, y, 0.15 + h, [(r + 0.25, 0), (r * 0.5, h * 0.45), (0.05, h * 0.62), (0, h * 0.62)], roof, roof_tex,
               sides=14, name='roof', roof=1)]
    if door:
        L += door_arch(x, y - r, 0.15, 0.8, 1.6, door_col)
    return L


def door_arch(x, y, z, w, h, col, frame=STONE):
    """a round-topped door on a front wall at depth y (the wall's face), a frame, a knob and a step"""
    return [prism(x, y - 0.02, z, arch(w + 0.2, h + 0.1, 8), 0.05, frame, 'stone', name='door frame'),
            prism(x, y - 0.05, z, arch(w, h, 8), 0.06, col, 'wood', name='door'),
            sphere(x + w * 0.3, y - 0.11, z + h * 0.48, 0.045, BRASS, 'metal', sides=6, rings=3, name='door knob'),
            box(x, y - 0.3, 0, w + 0.4, 0.5, max(0.08, z), STONE, 'stone', bevel=0.03, name='door step')]


def glow_ring(x, y, z, r, col, t=0.06, sides=16, name='glow ring', day=False):
    g = {'col': col, 'day': 1} if day else col
    return ring(x, y, z, r, t, '#F4F8FF', 'plain', sides, name=name, glow=g)


def recipe(L, warp=None, cel=0.62, about=None):
    r = {'ppm': 32, 'cel': cel, 'layers': L}
    if warp: r['warp'] = warp
    if about: r['about'] = about
    return r


def tris(rec):
    """a rough triangle count (the game's own count is in the unit tests)"""
    n = 0
    for l in rec['layers']:
        k, s = l['k'], l.get('sides', 12)
        if k == 'box': n += 12 if not (l.get('taper') or l.get('lean') or l.get('bevel')) else 28
        elif k == 'prism': n += 2 * len(l['pts']) * (1 + l.get('segs', 0)) + 2 * (len(l['pts']) - 2)
        elif k == 'lathe': n += 2 * s * (len(l['pts']) - 1)
        elif k == 'limb': n += 2 * s + 2 * (s - 2)
        elif k in ('sphere', 'dome'): n += 2 * s * l.get('rings', 4)
        else: n += 4 * s
    return n
