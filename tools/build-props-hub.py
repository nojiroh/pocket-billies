#!/usr/bin/env python3
"""Hub track HB-5: Copperleaf's new buildings and landmarks in the low-poly 32 px/m style (phase 09), finished all
round for the orbit camera.

  workshop    the Workshop (Scrap upgrades): a corrugated shed on a brick base, a roll-up door, a gear that turns,
              a crane arm, the word WORKSHOP
  gene_bank   the Gene Bank (the splicing track): a white and mint lab-vault, a round body under a verdigris dome,
              seed-vault drawers by a glass door, the words GENE BANK, a double helix turning on the roof
  lighthouse  (swapped in under its key) a striped tower, a gallery, the light room's glass lit after dark and a
              shutter turning round it, so the light sweeps
  windmill    (swapped in under its key) a tower mill, a reefing stage, a shingled cap and four lattice sails turning

Turning parts are layers with `spin` (prop-models.js; still under reduced motion). Windows carry `glass` numbers
(tools/mark-window-glass.py's rules); roofs `roof: 1`. Lettering is a fixed decal, never mirrored (HB-1). The new
kinds get a picture baked from the model (scene/next/hub/<key>.png: the fallback when models are off); the swapped
ones keep their old picture, name, tags and landmark flag (batch 7's way). Rooms: tools/build-hub-rooms.py.

    python3 tools/build-props-hub.py      # rerunnable; writes the models, pictures and these catalogue entries only
"""
import importlib.util
import math
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


ISL = load('island', 'build-props-island.py')
B1, B3, B5, B7 = ISL.B1, ISL.B3, ISL.B7.B5, ISL.B7  # batch 7's batch 5 has its extra letters
GLASS_MARK = load('glass', 'mark-window-glass.py')
PPM, A = B1.PPM, B1.AIR
box, limb, disc, sphere, cyl, img, porthole, r2 = B1.box, B1.limb, B1.disc, B1.sphere, B1.cyl, B1.img, B1.porthole, B1.r2
House, potted, rain_barrel = B7.House, B7.potted, B7.rain_barrel
WHITE, GLASS, MINT, MINT_D, CORAL = B5.WHITE, B7.GLASS, B5.MINT, B5.MINT_D, B5.CORAL
ISL.PICS = B1.ART / 'scene' / 'next' / 'hub'  # the baked pictures of the new kinds
px = lambda m: round(m * PPM)
B5.GLYPHS.update({
    'W': ['110001', '110001', '110001', '110101', '111111', '111011', '110001'],
    'G': ['01111', '11000', '11000', '11011', '11011', '11011', '01111'],
    ' ': ['00', '00', '00', '00', '00', '00', '00'],
})


def letters(text, col, name, shade):
    """batch 5's lettering, under a file name of our own (the words have spaces)."""
    return B5.letters(text, col, name, shade)


def sign(L, text, name, x, y, z, board, ink, shade, rim=A['brass']):
    """A name board on a front wall at depth y (its face), the word as a fixed decal on it."""
    p, lw, lh = letters(text, ink, name, shade)
    L += [box(x, y - 0.04, z, lw + 0.3, 0.05, lh + 0.14, board, 'wood', 'name board'),
          box(x, y - 0.03, z - 0.03, lw + 0.4, 0.05, lh + 0.2, rim, 'metal', 'name board rim'),
          img(p, x, y - 0.08, z + 0.07, face='fixed', recv=0, shadow=0, sway=0, name='lettering')]


def gear(L, x, y, z, r, col, spin=None, name='gear'):
    """A cog facing the front: a disc, a hub and eight teeth; turning when spin is given."""
    parts = [disc(x, y, z, (0, -1, 0), r, 0.06, col, 'metal', name, 16),
             disc(x, y - 0.03, z, (0, -1, 0), r * 0.35, 0.06, A['iron'], 'metal', name + ' hub', 10)]
    for i in range(8):
        a = i * math.pi / 4
        c, s = math.cos(a), math.sin(a)
        parts.append(limb((x + c * r * 0.9, y + 0.01, z + s * r * 0.9), (x + c * r * 1.25, y + 0.01, z + s * r * 1.25),
                          0.05, 0.05, col, 'metal', name + ' tooth', 4))
    if spin:
        parts = [p | {'spin': dict(spin)} for p in parts]
    L += parts


def mark_glass(rec):
    """glass numbers by the glass tool's names (window glass, portholes, door glass, a light room's glass)."""
    GLASS_MARK.mark(rec)
    return rec


def door_x(L):
    for l in L:
        if l.get('name') in ('door frame', 'door plank', 'door'):
            return l['x']
    return 0


# ================================================================ BD-6: the shared parts
LP = load('landmark_parts', 'landmark_parts.py')
DEG = LP.DEG


def ellipse(rx, rz, n=12, a0=0.0, a1=math.pi):
    return [(rx * math.cos(a0 + (a1 - a0) * i / n), rz * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


def band(outer, inner):
    """a closed outline between two open curves (an arch band, a rib): along the outer one, back along the inner"""
    return outer + inner[::-1]


def side_porthole(L, x, y, z, n, r, glass, name='side porthole'):
    """batch 1's copper porthole facing any way round, its glass numbered"""
    porthole(L, x, y, z, n, r, name)
    for l in L[-6:]:
        if l.get('name') == name + ' glass': l['glass'] = glass


def lettered(L, text, name, x, y, z, board, ink, shade, rim=A['brass']):
    """a name board (sign above) whose layers carry names of their own"""
    sign(L, text, name, x, y, z, board, ink, shade, rim)


# ================================================================ the Workshop
def workshop():
    """BD-6: the Workshop as a quonset hut: a half-round verdigris corrugated shell on a brick base, copper ribs, a cream
    riveted front with a roll-up door under a big brass gear standing over the roofline and turning slowly, a small gear
    meshing with it the other way, the crane kept (its hook swings), a copper rocket stove pipe with smoke, bubble
    skylights, a glowing arch of neon round the front at night, a workbench, crates, ivy. Look B with C's extras (a
    showpiece): about 3.5 degrees of lean."""
    W, D, z0 = 4.6, 3.0, 0.35
    rx, rz = 2.15, 2.75  # the arch's half width and height
    L = [LP.box(0, D / 2, 0, W, D, z0, '#B5603F', 'brick', bevel=0.04, name='brick base'),
         LP.prism(0, 1.66, z0, ellipse(rx, rz, 14), 2.68, LP.VERDI, 'corrugated', name='quonset roof', roof=1),
         LP.prism(0, 0.27, z0, ellipse(rx - 0.06, rz - 0.06, 14), 0.06, LP.CREAM, 'riveted', name='front wall'),
         LP.prism(0, 2.99, z0, ellipse(rx - 0.06, rz - 0.06, 14), 0.04, LP.CREAM, 'riveted', name='back wall')]
    for y in (0.33, 1.2, 2.1, 2.97):  # copper ribs over the shell
        L.append(LP.prism(0, y, z0, band(ellipse(rx + 0.07, rz + 0.07, 14), ellipse(rx - 0.02, rz - 0.02, 14)), 0.1,
                          LP.COPPER, 'metal', name='rib'))
    L.append(LP.prism(0, 0.22, z0, band(ellipse(rx - 0.1, rz - 0.1, 14), ellipse(rx - 0.15, rz - 0.15, 14)), 0.03,
                      '#FFFFFF', glow=LP.NEON_A, name='neon arch'))
    # the roll-up door under the big gear
    dx, dw, dh, fy = -0.5, 1.3, 1.85, 0.24
    L += [LP.box(dx, fy - 0.03, z0, dw + 0.2, 0.06, dh + 0.1, LP.IRON, 'metal', name='door frame'),
          LP.box(dx, fy - 0.12, z0 + dh, dw + 0.3, 0.24, 0.2, '#5A6878', 'metal', bevel=0.04, name='door roller')]
    for i in range(6):
        L.append(LP.box(dx, fy - 0.06, z0 + i * dh / 6, dw, 0.04, dh / 6 - 0.03, '#E8B450' if i % 2 else '#D9A040',
                        'metal', name='door slat'))
    L += [LP.box(dx, fy - 0.08, z0 + 0.25, 0.36, 0.03, 0.06, LP.IRON, 'metal', name='door handle'),
          LP.box(dx, -0.2, 0, dw + 0.5, 0.45, z0, LP.STONE, 'stone', bevel=0.03, name='door step')]
    B3.path_stones(L, dx, 0, 3)
    # the big gear (turning slowly) standing over the roofline, the small one meshing with it the other way
    gx, gz, gr = -0.4, 3.3, 0.78
    L += [LP.box(gx, 0.2, gz - 0.12, 0.2, 0.12, 0.24, LP.COPPER, 'metal', name='gear bracket'),
          LP.box(gx, 0.3, z0 + 2.1, 0.16, 0.12, gz - z0 - 2.1, LP.COPPER, 'metal', name='gear mast')]
    L += LP.spun(LP.cog(gx, 0.12, gz, gr, LP.BRASS, teeth=14, d=0.12, name='big gear'),
                 {'axis': 'y', 'x': gx, 'y': 0.12, 'z': gz, 'rps': 0.05})
    sx, sz, sr = 0.85, 2.58, 0.38
    L += LP.spun(LP.cog(sx, 0.14, sz, sr, LP.COPPER, teeth=8, d=0.1, name='small gear'),
                 {'axis': 'y', 'x': sx, 'y': 0.14, 'z': sz, 'rps': -0.1})
    # the porthole window of tools, the name board, the lamp
    L += LP.porthole(1.3, 0.23, 1.62, 0.3, 1)
    for i, c in enumerate(('#E04848', '#F4D040', '#8CC850')):
        L.append(LP.box(1.14 + i * 0.16, 0.22, 1.45, 0.05, 0.02, 0.3, c, 'metal', name='tool'))
    lettered(L, 'WORKSHOP', 'workshop_word', 1.12, fy, 0.72, '#2E3A4A', '#F8E8B0', '#1A222E')
    L += LP.lamp(0.42, fy, 2.05)
    # the crane on the left: a post, a yellow jib out over the front, a stay; its chain and hook swing a little
    cx = -2.05
    L += [LP.limb((cx, 1.0, z0), (cx, 1.0, 3.5), 0.07, LP.IRON, 'metal', sides=6, name='crane post'),
          LP.limb((cx, 1.0, 3.4), (cx - 0.25, -1.0, 3.4), 0.06, '#E8B450', 'metal', sides=6, name='crane jib'),
          LP.limb((cx, 1.0, 2.7), (cx - 0.2, -0.6, 3.35), 0.025, LP.IRON, 'metal', sides=4, name='crane stay'),
          LP.limb((cx, 1.2, 3.4), (cx, 1.7, 3.4), 0.05, '#E8B450', 'metal', sides=6, name='crane tail'),
          LP.box(cx, 1.75, 3.15, 0.35, 0.3, 0.3, LP.STONE, 'stone', name='crane weight')]
    hook = {'axis': 'x', 'x': cx - 0.22, 'y': -0.85, 'z': 3.38, 'rps': 0.22, 'swing': 0.12}
    L += LP.spun([LP.limb((cx - 0.22, -0.85, 3.38), (cx - 0.22, -0.85, 2.15), 0.012, LP.IRON, 'metal', sides=4, name='crane chain'),
                  LP.lathe(cx - 0.22, -0.85, 1.9, [(0.02, 0), (0.1, 0.12), (0.1, 0.22), (0.03, 0.27)], LP.COPPER, 'metal',
                           sides=8, name='crane hook')], hook)
    # the copper rocket stove pipe (smoke at its top), bubble skylights on the ridge
    px_, py_ = 1.25, 2.2
    L.append(LP.lathe(px_, py_, 2.2, [(0.14, 0), (0.16, 1.1), (0.24, 1.35), (0.24, 1.5), (0.08, 1.75), (0, 1.8)],
                      LP.COPPER, 'riveted', sides=10, tilt=[0, -6 * DEG], name='stove pipe'))
    for a in (0, 120, 240):
        L.append(LP.prism(px_, py_, 2.55, [(0.14, 0), (0.42, 0), (0.16, 0.5)], 0.04, LP.RED, 'metal',
                          rot=(a + 90) * DEG, name='stove pipe fin'))
    L += [LP.bubble(0, 1.3, z0 + rz - 0.08, 0.34, 2, name='skylight'), LP.bubble(0, 2.3, z0 + rz - 0.08, 0.3, 3, name='skylight')]
    # by the walls: a workbench with a vise, crates, a barrel; ivy up the right side; a pneumatic tube (C)
    L += [LP.box(1.7, -0.45, 0, 1.0, 0.5, 0.85, '#9A6A44', 'wood', name='workbench'),
          LP.box(1.45, -0.45, 0.85, 0.2, 0.25, 0.15, LP.IRON, 'metal', name='vise'),
          LP.box(2.05, 3.3, 0, 0.55, 0.55, 0.55, '#B27648', 'wood', bevel=0.02, name='crate'),
          LP.box(2.05, 3.3, 0.55, 0.38, 0.38, 0.38, '#C08A58', 'wood', bevel=0.02, name='crate')]
    rain_barrel(L, -1.6, 3.35)
    L += LP.ivy(1.95, 0.3, 0.4, 1.9, -1)
    L += [LP.neon((-1.65, 0.25, 0.4), (-1.65, 0.25, 1.75), LP.NEON_T, 0.05, 'pneumatic tube'),
          LP.neon((-1.65, 0.25, 1.75), (-1.2, 0.25, 2.3), LP.NEON_T, 0.05, 'pneumatic tube')]
    # no bulge: a bulge moves the walls out from under the name board's decal (picture layers don't follow the warp)
    rec = LP.recipe(L, LP.lean_warp(L, 3.5, sag=0.06), about='BD-6: the Workshop, a quonset hut')
    fx = [{'k': 'window', 'x': LP.px(1.3), 'y': -LP.px(1.62)}, {'k': 'glow', 'x': LP.px(0.42), 'y': -LP.px(1.9)},
          {'k': 'smoke', 'x': LP.px(px_ + 0.2), 'y': -LP.px(4.05)}]
    return rec, fx, [W, D], dx


# ================================================================ the Gene Bank
def gene_bank():
    """BD-6: the Gene Bank, rounder: a bulging white vault with a mint band under a verdigris dome, four glass bubble
    domes of seedlings round its shoulder, a barrel-vaulted porch with a round brass vault door (glass in its middle),
    the words GENE BANK on a marquee over it, seed-vault drawer banks following the wall, portholes round the sides,
    and on top the double helix, its beads lit at night, turning as one. Look B: a soft 2 degrees and a swell."""
    W, D = 4.4, 4.6
    cy, z0 = 2.45, 0.24
    wall = [(1.98, 0), (2.12, 0.6), (2.17, 1.5), (2.1, 2.5), (1.95, 3.0)]
    zt = z0 + 3.0
    L = [LP.cyl(0, cy, 0, 2.2, z0, LP.STONE, 'stone', sides=24, name='plinth'),
         LP.lathe(0, cy, z0, wall, '#EAEEEC', 'panels', sides=24, smooth=1, name='walls'),
         LP.lathe(0, cy, z0 + 1.45, [(2.19, 0), (2.2, 0.16)], MINT, 'metal', sides=24, name='band'),
         LP.cyl(0, cy, zt - 0.04, 2.05, 0.14, LP.COPPER, 'metal', sides=24, name='cornice'),
         LP.lathe(0, cy, zt + 0.1, [(2.0, 0), (1.92, 0.55), (1.55, 1.1), (0.95, 1.5), (0.35, 1.7), (0, 1.72)], LP.VERDI,
                  'standingseam', sides=24, smooth=1, name='roof', roof=1)]
    # four bubble domes of seedlings round the dome's shoulder
    for i, deg in enumerate((25, 155, 205, 335)):
        a = deg * DEG
        bx, by = 1.55 * math.cos(a), cy + 1.55 * math.sin(a)
        L += [LP.cyl(bx, by, zt + 0.32, 0.46, 0.12, LP.COPPER, 'metal', sides=12, name='bubble rim'),
              LP.bubble(bx, by, zt + 0.44, 0.42, 3 + i, h=0.5),
              LP.sphere(bx, by, zt + 0.44, 0.25, LP.LEAF2, 'leaves', sides=6, rings=3, name='seedlings')]
    for i, deg in enumerate((-20, 20, 70, 110, 160, 200)):  # portholes round the sides and back
        a = deg * DEG
        side_porthole(L, 2.13 * math.cos(a), cy + 2.13 * math.sin(a), 2.2, (math.cos(a), math.sin(a), 0), 0.24, 8 + i)
    # the porch: a barrel vault, its verdigris band, the round vault door, the marquee with the words
    pw, ph, pd = 2.0, 2.55, 1.15
    L += [LP.prism(0, pd / 2, z0, LP.arch(pw, ph, 10), pd, '#EAEEEC', 'panels', name='porch'),
          LP.prism(0, pd / 2 + 0.02, z0, band(LP.arch(pw + 0.24, ph + 0.12, 10)[2:], LP.arch(pw, ph, 10)[2:]), pd + 0.08,
                   LP.VERDI, 'standingseam', name='porch roof', roof=1),
          LP.box(0, 0.6, 0, pw + 0.4, 1.5, z0, LP.STONE, 'stone', name='porch floor')]
    vz = z0 + 1.0
    L += [LP.disc(0, -0.03, vz, 0.86, LP.BRASS, 'riveted', sides=20, name='vault door rim'),
          LP.disc(0, -0.05, vz, 0.74, MINT, 'metal', sides=20, name='door'),
          LP.disc(0, -0.07, vz, 0.24, '#A8DCE8', sides=14, glass=1, name='door glass'),
          LP.front_ring(0, -0.08, vz, 0.48, 0.06, LP.BRASS, sides=16, name='vault wheel')]
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        L.append(LP.limb((0.26 * math.cos(a), -0.09, vz + 0.26 * math.sin(a)), (0.48 * math.cos(a), -0.09, vz + 0.48 * math.sin(a)),
                         0.025, LP.BRASS, 'metal', sides=4, name='wheel spoke'))
    L += [LP.box(0, -0.35, 0, pw + 0.3, 0.5, 0.12, LP.STONE, 'stone', bevel=0.03, name='door step')]
    B3.path_stones(L, 0, 0, 3)
    L += [LP.box(0, 0.12, z0 + ph - 0.05, 2.3, 0.1, 0.5, '#2E4A44', 'metal', bevel=0.03, name='marquee')]
    lettered(L, 'GENE BANK', 'gene_bank_word', 0, 0.05, z0 + ph + 0.04, '#2E4A44', '#F4F6F2', '#14302A', rim=MINT)
    L += [LP.box(0, 0.05, z0 + ph + 0.48, 2.3, 0.06, 0.04, '#FFFFFF', glow=LP.NEON_T, name='marquee neon')]
    L += LP.lamp(-0.78, -0.02, 2.05) + LP.lamp(0.78, -0.02, 2.05)
    # the seed-vault drawers following the curved wall either side of the porch
    for s in (-1, 1):
        th = (-90 + s * 45) * DEG
        bx, by = 2.0 * math.cos(th), cy + 2.0 * math.sin(th)
        rot = th + math.pi / 2
        tx, ty = math.cos(rot), math.sin(rot)
        L.append(LP.box(bx, by, 0.3, 0.95, 0.35, 1.5, '#D6E6C8', 'metal', rot=r2(rot), name='drawer bank'))
        nx, ny = math.cos(th), math.sin(th)
        for i in range(3):
            for j in range(3):
                u = (i - 1) * 0.3
                x, y, z = bx + tx * u + nx * 0.19, by + ty * u + ny * 0.19, 0.42 + j * 0.45
                L += [LP.box(x, y, z, 0.26, 0.03, 0.38, '#C8DCEC', 'metal', rot=r2(rot), name='drawer'),
                      LP.box(x + nx * 0.02, y + ny * 0.02, z + 0.26, 0.1, 0.02, 0.03, LP.BRASS, 'metal', rot=r2(rot),
                             name='drawer pull')]
    # the helix on the dome: posts, a base and a cap, two strands of beads lit at night, turning as one
    h0, h1 = zt + 1.82, zt + 3.45
    for i in range(3):
        a = i * 2 * math.pi / 3 + 0.5
        L.append(LP.limb((math.cos(a) * 0.55, cy + math.sin(a) * 0.55, h0 - 0.1), (math.cos(a) * 0.55, cy + math.sin(a) * 0.55, h1 + 0.1),
                         0.03, LP.BRASS, 'metal', sides=5, name='helix post'))
    L += [LP.cyl(0, cy, h0 - 0.16, 0.66, 0.1, LP.COPPER, 'metal', sides=16, name='helix base'),
          LP.cyl(0, cy, h1 + 0.1, 0.66, 0.08, LP.COPPER, 'metal', sides=16, name='helix cap'),
          LP.sphere(0, cy, h1 + 0.18, 0.09, LP.BRASS, 'metal', sides=8, rings=4, name='helix finial')]
    H, n = [], 12
    for i in range(n):
        t = i / (n - 1)
        z, a = h0 + t * (h1 - h0), t * 2 * math.pi * 1.25
        p = (math.cos(a) * 0.36, cy + math.sin(a) * 0.36, z)
        q = (-math.cos(a) * 0.36, cy - math.sin(a) * 0.36, z)
        H += [LP.sphere(p[0], p[1], z - 0.08, 0.08, MINT, sides=8, rings=4, glow='#7FF0C8', name='helix bead'),
              LP.sphere(q[0], q[1], z - 0.08, 0.08, '#E87EA8', sides=8, rings=4, glow=LP.NEON_P, name='helix bead'),
              LP.limb(p, q, 0.018, WHITE, sides=4, name='helix rung')]
    L += LP.spun(H, {'axis': 'z', 'x': 0, 'y': cy, 'z': h0, 'rps': 0.12})
    for x in (-1.85, 1.85):
        potted(L, x, -0.3, MINT_D)
    # no bulge (the vault is round already): it would move the marquee out over its lettering's decal
    rec = LP.recipe(L, LP.lean_warp(L, 2.0, side=(1, 0.05)), about='BD-6: the Gene Bank, rounder')
    fx = [{'k': 'window', 'x': LP.px(2.13 * math.cos(a * DEG)), 'y': -LP.px(2.2)} for a in (-20, 200)]
    fx += [{'k': 'glow', 'x': LP.px(x), 'y': -LP.px(1.9)} for x in (-0.78, 0.78)]
    return rec, fx, [W, D], 0


# ================================================================ the lighthouse
def lighthouse():
    """BD-6: the lighthouse as a finned rocket: a white and coral rocket tower on four big fins round a stone launch
    pad, a glowing exhaust ring at its foot (night), a round door between the front fins, portholes up the tower, the
    iron gallery, the light room's glass (lit after dark) with its shutter turning round it, a red nose cone with a
    brass tip and a glowing antenna. Look B turned down for a tall tower: 1.5 degrees."""
    D, cy = 3.6, 1.8
    L = [LP.cyl(0, cy, 0, 1.78, 0.3, LP.STONE, 'stone', sides=16, name='plinth'),
         LP.cyl(0, cy, 0.3, 1.5, 0.08, '#BDB9C6', 'stone', sides=16, name='launch pad')]
    L.append(LP.glow_ring(0, cy, 0.38, 1.42, LP.NEON_T, t=0.08, name='exhaust ring'))
    z0, h = 0.38, 8.2
    rad = lambda z: 1.18 + 0.12 * math.sin(min(1, (z - z0) / 2.2) * math.pi / 2) - 0.42 * max(0, (z - z0 - 2.2) / (h - 2.2)) ** 1.3
    cuts = [z0 + h * f for f in (0, 0.22, 0.46, 0.7, 1.0)]
    for i in range(4):
        za, zb = cuts[i], cuts[i + 1]
        pts = [(rad(za + (zb - za) * k / 3), (zb - za) * k / 3) for k in range(4)]
        L.append(LP.lathe(0, cy, za, pts, WHITE if i % 2 == 0 else CORAL, 'riveted' if i % 2 else 'plaster', sides=16,
                          smooth=1, name='tower'))
    for i, deg in enumerate((45, 135, 225, 315)):  # the fins
        L.append(LP.prism(0, cy, 0.3, [(0.9, 0), (1.76, 0), (1.76, 0.75), (1.2, 2.9), (0.95, 3.2)], 0.14, '#C84E40', 'metal',
                          rot=r2(deg * DEG), name='fin'))
        a = deg * DEG
        L.append(LP.sphere(1.6 * math.cos(a), cy + 1.6 * math.sin(a), 0.38, 0.09, '#FFF0C0', sides=6, rings=3,
                           glow=LP.NEON_A, name='fin light'))
    fy = cy - rad(0.6)
    L += LP.door_arch(0, fy + 0.04, 0.38, 0.72, 1.55, '#4E6E9E', frame=LP.IRON)
    for i, z in enumerate((3.0, 4.9, 6.6)):
        L += LP.porthole(0, cy - rad(z) - 0.01, z, 0.22, 2 + i)
    side_porthole(L, 0, cy + rad(4.0), 4.0, (0, 1, 0), 0.22, 5)
    # the gallery: a deck, posts and rails
    gz = z0 + h
    L.append(LP.cyl(0, cy, gz, 1.32, 0.15, LP.IRON, 'metal', sides=16, name='gallery'))
    P = [(math.cos(i * math.pi / 5) * 1.25, cy + math.sin(i * math.pi / 5) * 1.25) for i in range(10)]
    for i, (x, y) in enumerate(P):
        x2, y2 = P[(i + 1) % 10]
        L += [LP.limb((x, y, gz + 0.15), (x, y, gz + 0.8), 0.02, LP.IRON, 'metal', sides=4, name='rail post'),
              LP.limb((x, y, gz + 0.8), (x2, y2, gz + 0.8), 0.02, LP.IRON, 'metal', sides=4, name='rail')]
    # the light room: a coral base, the glass, mullions, the shutter turning round it as one, the nose cone
    lz = gz + 0.15
    L += [LP.cyl(0, cy, lz, 0.8, 0.4, CORAL, 'metal', sides=14, name='light room base'),
          LP.cyl(0, cy, lz + 0.4, 0.68, 1.1, '#FFE9A8', sides=14, glass=1, name='light room glass')]
    for i in range(7):
        a = i * 2 * math.pi / 7
        L.append(LP.limb((math.cos(a) * 0.69, cy + math.sin(a) * 0.69, lz + 0.4), (math.cos(a) * 0.69, cy + math.sin(a) * 0.69, lz + 1.5),
                         0.025, LP.IRON, 'metal', sides=4, name='mullion'))
    S = []
    for sy in (-1, 1):
        S += [LP.box(0, cy + sy * 0.78, lz + 0.45, 0.75, 0.06, 1.0, LP.IRON, 'metal', name='lamp shutter'),
              LP.box(0, cy + sy * 0.75, lz + 0.42, 0.85, 0.03, 0.06, LP.BRASS, 'metal', name='shutter rim')]
    L += LP.spun(S, {'axis': 'z', 'x': 0, 'y': cy, 'z': lz + 0.95, 'rps': 0.2})
    cz = lz + 1.5
    L += [LP.cyl(0, cy, cz, 0.88, 0.08, LP.IRON, 'metal', sides=14, name='cap rim'),
          LP.lathe(0, cy, cz + 0.08, [(0.86, 0), (0.78, 0.45), (0.5, 0.95), (0.18, 1.3), (0, 1.4)], '#C84E40', 'metal',
                   sides=14, smooth=1, name='roof', roof=1),
          LP.sphere(0, cy, cz + 1.4, 0.12, LP.BRASS, 'metal', sides=8, rings=4, name='nose tip')]
    L += LP.antenna(0, cy, cz + 1.6, 0.8)
    rec = LP.recipe(L, LP.lean_warp(L, 1.5, bulge=0.02, side=(-1, 0.1)), about='BD-6: the lighthouse, a finned rocket')
    fx = [{'k': 'glow', 'x': 0, 'y': -LP.px(lz + 0.95)}]
    return rec, fx, [3.6, 3.6], 0


# ================================================================ the bubble car
CAR_BODY, CAR_STRIPE = '#8FD8C8', '#2E7F8B'
CAR_LOOKS = [('Bubble car (coral)', {CAR_BODY: '#F08A7A', CAR_STRIPE: '#F4F1EA'}),
             ('Bubble car (sky)', {CAR_BODY: '#86B8EE', CAR_STRIPE: '#3E5288'})]


def bubble_car():
    """BD-6: a small hovering retro car (section 5's bubble cars, by the shop and the station): a rounded body with a
    stripe and a chrome bumper ring, a glass bubble over two seats, tail fins, round headlights, and under it a hover
    pad and three thrusters that glow at night. It faces -x; its colour looks are swaps; it bobs (catalogue bob)."""
    cy, z0 = 0.6, 0.32
    ry = 0.56
    L = [LP.lathe(0, cy, z0, [(0.7, 0), (0.98, 0.1), (1.08, 0.28), (1.03, 0.45), (0.82, 0.56)], CAR_BODY, 'metal',
                  sides=16, ry=ry, smooth=1, name='car body'),
         LP.lathe(0, cy, z0 + 0.26, [(1.085, 0), (1.1, 0), (1.1, 0.06), (1.085, 0.06)], CHROME_C, 'metal', sides=16, ry=ry,
                  name='bumper ring'),
         LP.lathe(0, cy, z0 + 0.4, [(1.06, 0), (1.07, 0), (1.04, 0.07), (1.03, 0.07)], CAR_STRIPE, 'metal', sides=16,
                  ry=ry, name='stripe'),
         LP.lathe(-0.12, cy, z0 + 0.55, [(0.68, 0), (0.64, 0.24), (0.44, 0.48), (0, 0.58)], '#BFE6EE', 'plain', sides=14,
                  ry=0.78, smooth=1, glass=1, name='glass bubble'),
         LP.box(-0.15, cy, z0 + 0.56, 0.5, 0.7, 0.18, '#8A4A3A', 'cloth', name='seats')]
    for s in (-1, 1):  # tail fins, headlights, tail lights
        L += [LP.prism(0.75, cy + s * 0.42, z0 + 0.35, [(0, 0), (0.42, 0), (0.55, 0.55), (0.35, 0.5)], 0.05, CAR_STRIPE,
                       'metal', name='tail fin'),
              LP.sphere(-1.02, cy + s * 0.3, z0 + 0.26, 0.09, '#FFF4C8', sides=8, rings=4, glow=LP.NEON_A, name='headlight'),
              LP.sphere(1.0, cy + s * 0.3, z0 + 0.3, 0.06, '#FF7A7A', sides=6, rings=3, glow=LP.NEON_P, name='tail light')]
    L += [LP.lathe(0, cy, z0 - 0.12, [(0, 0), (0.7, 0), (0.75, 0.12)], LP.IRON, 'metal', sides=14, ry=ry, name='hover pad'),
          LP.lathe(0, cy, z0 - 0.14, [(0, 0), (0.55, 0), (0.55, 0.02)], '#F4F8FF', sides=14, ry=ry, glow=LP.NEON_T,
                   name='hover glow')]
    for i in range(3):
        a = i * 2 * math.pi / 3
        L.append(LP.lathe(0.42 * math.cos(a), cy + 0.25 * math.sin(a), z0 - 0.3, [(0.06, 0), (0.12, 0.18), (0.1, 0.2)],
                          LP.STEEL, 'metal', sides=8, name='thruster'))
        L.append(LP.sphere(0.42 * math.cos(a), cy + 0.25 * math.sin(a), z0 - 0.34, 0.06, '#F4F8FF', sides=6, rings=3,
                           glow=LP.NEON_T, name='thruster glow'))
    L += [LP.sphere(-0.15, cy - 0.62, z0 + 0.7, 0.03, LP.BRASS, sides=5, rings=2, name='aerial tip'),
          LP.limb((0.5, cy + 0.2, z0 + 0.5), (0.62, cy + 0.25, z0 + 1.15), 0.01, LP.STEEL, 'metal', sides=4, name='aerial'),
          LP.sphere(0.62, cy + 0.25, z0 + 1.12, 0.035, '#FFE0E8', sides=5, rings=2, glow={'col': LP.NEON_P, 'day': 1},
                    name='aerial tip')]
    return LP.recipe(L, about='BD-6: a bubble car, hovering')


CHROME_C = '#DCE2ED'


# ================================================================ the catalogue
NEW = {'workshop': ('Workshop', workshop, ('town',)), 'gene_bank': ('Gene Bank', gene_bank, ('town',))}
SWAP = {'lighthouse': lighthouse}  # BD-6: the windmill is tools/build-windmill-kit.py's now


def build_new(C, key, name, fn, tags):
    rec, fx, bx, dx = fn()
    M = ISL.new_prop(key, name, rec, shadow=1.8, tags=tags, box_=bx, vary={'rot': 0, 'lean': 0, 'size': 0},
                     door={'x': LP.px(dx), 'y': 0}, fx=fx)
    room = C.get(key, {}).get('room')  # kept on a rebuild (tools/build-hub-rooms.py sets it)
    if room: M['room'] = room
    C[key] = M


def swap_in(C, key, fn):
    """batch 7's way: the model under the old key; its picture, name, tags and landmark flag kept. BD-6: the picture
    is baked again from the new model."""
    M = C[key]
    rec, fx, bx, _dx = fn()
    path, ox, oy = ISL.bake(rec, key)
    M.update({'img': path, 'ox': ox, 'oy': oy})
    M['model'] = B1.write_recipe(key, rec)
    M['ppm'] = PPM
    M['fx'] = fx
    M['box'] = bx
    M['solid'] = 1
    M['vary'] = {'rot': 0, 'lean': 0, 'size': 0}
    for f in ('vol', 'volDepth', 'layers', 'build', 'blades'):
        M.pop(f, None)


def add_bubble_car(C):
    rec = bubble_car()
    vs = []
    for i, (name, sw) in enumerate(CAR_LOOKS):
        path, ox, oy = ISL.bake({**rec, 'layers': [l | ({'col': sw[l['col']]} if l.get('col') in sw else {}) for l in rec['layers']]},
                                f'bubble_car_v{i + 1}')
        vs.append({'img': path, 'ox': ox, 'oy': oy, 'swap': dict(sw), 'name': name})
    C['bubble_car'] = ISL.new_prop('bubble_car', 'Bubble car (mint)', rec, group='bubble_car', shadow=0.6,
                                   tags=('town', 'hub'), solid=0.5, vary={'rot': 0, 'lean': 0, 'size': 0}, bob=0.03,
                                   variants=vs, about='BD-6: a small hovering retro car, parked by the shop and the '
                                   'station (BD-7 places them); its looks are colour swaps; it bobs; its hover pad and '
                                   'thrusters glow at night')


def main():
    ISL.PICS.mkdir(parents=True, exist_ok=True)
    D = gamedata.load()
    C = D['scenery']['props']
    for key, (name, fn, tags) in NEW.items():
        build_new(C, key, name, fn, tags)
    for key, fn in SWAP.items():
        swap_in(C, key, fn)
    add_bubble_car(C)
    gamedata.save(D)
    print('hub buildings:', ', '.join([*NEW, *SWAP, 'bubble_car']))


if __name__ == '__main__':
    main()
