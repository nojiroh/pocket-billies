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


# ================================================================ the Workshop
def workshop():
    """The Workshop: corrugated walls on a brick base under a low gable roof, a roll-up door in mustard slats under
    the word WORKSHOP, a window of tools, a brass gear turning slowly over it, a crane arm with a hook on the left,
    a stove chimney, crates and a barrel by the wall."""
    H = House(4.6, 3.0, 1, 2.9, '#8FA0AC', 'corrugated', '#84543C', '#5A6878', 'corrugated', 'gable', 24)
    L, fy = H.L, H.fy
    L.append(box(0, 0, 0.24, H.w + 0.04, H.d + 0.04, 0.85, '#B5603F', 'brick', 'brick base'))
    # the roll-up door: a frame, slats, the roller's housing, a step
    dx, dw, dh = -0.85, 1.8, 1.95
    L += [box(dx, fy - 0.03, 0.24, dw + 0.2, 0.06, dh + 0.1, A['iron'], 'metal', 'door frame'),
          box(dx, fy - 0.12, 0.24 + dh, dw + 0.3, 0.24, 0.24, '#5A6878', 'metal', 'door roller')]
    for i in range(7):
        L.append(box(dx, fy - 0.06, 0.24 + i * dh / 7, dw, 0.04, dh / 7 - 0.03, '#E8B450' if i % 2 else '#D9A040',
                     'metal', 'door slat'))
    L += [box(dx, fy - 0.08, 0.5, 0.36, 0.03, 0.06, A['iron'], 'metal', 'door handle'),
          box(dx, fy - 0.35, 0, dw + 0.5, 0.5, 0.12, A['stone'], 'stone', 'door step')]
    B3.path_stones(L, dx, fy, 3)
    sign(L, 'WORKSHOP', 'workshop_word', dx, fy, 2.55, '#2E3A4A', '#F8E8B0', '#1A222E')
    # the window of tools and the gear over it
    H.window(1.35, 0.95, 1.0, 0.85, frame=WHITE, flowers=False)
    for i, c in enumerate(('#E04848', '#F4D040', '#8CC850')):
        L.append(box(1.05 + i * 0.3, fy + 0.05, 1.1, 0.06, 0.03, 0.45, c, 'metal', 'tool'))
    gear(L, 1.35, fy - 0.05, 2.5, 0.32, A['brass'], {'axis': 'y', 'x': 1.35, 'y': fy - 0.05, 'z': 2.5, 'rps': 0.08})
    H.lamp(0.35, 1.7)
    # the crane arm on the left side: a post, a jib out over the front, a chain and a hook
    cx = -H.w / 2 - 0.2
    L += [limb((cx, -0.4, 0.2), (cx, -0.4, 3.2), 0.07, 0.06, A['iron'], 'metal', 'crane post', 6),
          limb((cx, -0.4, 3.1), (cx, fy - 1.0, 3.1), 0.05, 0.04, '#E8B450', 'metal', 'crane jib', 6),
          limb((cx, -0.4, 2.5), (cx, fy - 0.6, 3.05), 0.025, 0.025, A['iron'], 'metal', 'crane stay', 4),
          limb((cx, fy - 0.9, 3.05), (cx, fy - 0.9, 2.1), 0.012, 0.012, A['iron'], 'metal', 'crane chain', 4),
          cyl(cx, fy - 0.9, 1.95, 0.08, 0.16, A['copper'], 'metal', 'crane hook', 8)]
    # the stove chimney, the side and back windows, things by the wall
    L += [cyl(1.6, 0.6, H.top - 0.2, 0.14, H.ridge - H.top + 1.0, A['iron'], 'metal', 'stove pipe', 10),
          cyl(1.6, 0.6, H.ridge + 0.8, 0.2, 0.18, A['copper'], 'metal', 'stove pipe hat', 10, k='cone', r1=0.04)]
    H.smoke = (1.6, H.ridge + 1.2)
    H.side_windows()
    for i, (x, y, s) in enumerate(((2.0, fy - 0.45, 0.5), (2.05, fy - 0.45 + 0.02, 0.35))):
        L.append(box(x, y, i * 0.5, s, s, s, '#B27648', 'wood', 'crate'))
    rain_barrel(L, -H.w / 2 + 0.35, H.d / 2 + 0.35)
    return H


# ================================================================ the Gene Bank
def gene_bank():
    """The Gene Bank: a round white body with a mint band under a verdigris dome, portholes round it, a square
    entrance with a glass door under the words GENE BANK, banks of seed-vault drawers either side, and on the dome a
    double helix of mint and pink beads turning slowly in an open frame."""
    L, d = [], 4.6
    cy, r, fy = 0.2, 2.1, -d / 2
    top = 0.24 + 2.6
    L += [cyl(0, cy, 0, r + 0.18, 0.12, A['stone'], 'stone', 'plinth', 24),
          cyl(0, cy, 0.12, r + 0.08, 0.12, '#BDB9C6', 'stone', 'plinth top', 24),
          cyl(0, cy, 0.24, r, 2.6, '#EAEEEC', 'panels', 'walls', 24),
          cyl(0, cy, 1.45, r + 0.04, 0.14, MINT, 'metal', 'band', 24),
          cyl(0, cy, top, r + 0.14, 0.12, A['copper'], 'metal', 'cornice', 24),
          {'k': 'dome', 'x': 0, 'y': cy, 'z': r2(top + 0.1), 'r': r2(r + 0.02), 'h': 1.3, 'sides': 24, 'rings': 5,
           'col': A['verd'], 'tex': 'metal', 'name': 'roof', 'roof': 1}]
    for deg in (-25, 20, 65, 115, 160, 205):  # portholes round the sides and back (not the front)
        a = math.radians(deg)
        porthole(L, math.cos(a) * r, cy + math.sin(a) * r, 2.05, (math.cos(a), math.sin(a), 0), 0.26, 'side porthole')
    # the entrance: a square porch, a glass door, a flat mint roof, steps, the sign over the door
    ew, ed, eh = 1.8, 0.9, 2.75
    ey = fy + ed / 2
    L += [box(0, ey, 0.24, ew, ed, eh - 0.24, '#EAEEEC', 'panels', 'entrance'),
          box(0, ey, eh, ew + 0.2, ed + 0.1, 0.1, MINT_D, 'metal', 'entrance roof'),
          box(0, fy - 0.03, 0.24, 1.16, 0.04, 2.0, MINT_D, 'metal', 'door frame'),
          box(0, fy - 0.05, 0.24, 0.98, 0.03, 1.9, '#A8DCE8', 'plain', 'door glass'),
          box(0, fy - 0.07, 0.24, 0.04, 0.02, 1.9, MINT_D, 'metal', 'door split'),
          box(0, fy - 0.4, 0, ew + 0.4, 0.55, 0.12, A['stone'], 'stone', 'door step'),
          box(0, fy - 0.3, 0.12, ew, 0.36, 0.1, '#BDB9C6', 'stone', 'door step top')]
    B3.path_stones(L, 0, fy, 3)
    sign(L, 'GENE BANK', 'gene_bank_word', 0, fy, 2.2, '#2E4A44', '#F4F6F2', '#14302A', rim=MINT)
    for x in (-0.65, 0.65):
        B3.wall_lamp(L, x, fy, 1.45)
    # the seed-vault drawers: a bank either side of the porch, 3 by 4 drawers with brass pulls
    for sx in (-1, 1):
        bx, bz = sx * 1.45, 0.3
        L.append(box(bx, fy + 0.65, bz, 0.95, 0.4, 1.7, '#D6E6C8', 'metal', 'drawer bank'))
        for i in range(3):
            for j in range(4):
                x, z = bx - 0.3 + i * 0.3, bz + 0.12 + j * 0.39
                L += [box(x, fy + 0.44, z, 0.26, 0.02, 0.34, '#C8DCEC', 'metal', 'drawer'),
                      box(x, fy + 0.42, z + 0.24, 0.1, 0.02, 0.03, A['brass'], 'metal', 'drawer pull')]
    # the helix on the dome: three posts, a cap, and two strands of beads with rungs, turning
    hz0, hz1 = top + 1.3, top + 3.0
    for i in range(3):
        a = i * 2 * math.pi / 3 + 0.5
        L.append(limb((math.cos(a) * 0.55, cy + math.sin(a) * 0.55, hz0 - 0.1), (math.cos(a) * 0.55, cy + math.sin(a) * 0.55, hz1 + 0.1),
                      0.03, 0.03, A['brass'], 'metal', 'helix post', 5))
    L += [cyl(0, cy, hz0 - 0.15, 0.65, 0.08, A['copper'], 'metal', 'helix base', 16),
          cyl(0, cy, hz1 + 0.1, 0.65, 0.08, A['copper'], 'metal', 'helix cap', 16),
          sphere(0, cy, hz1 + 0.22, 0.08, A['brass'], 'metal', 'helix finial', 8, 4)]
    spin = {'axis': 'z', 'x': 0, 'y': cy, 'z': hz0, 'rps': 0.12}
    n = 10
    for i in range(n):
        t = i / (n - 1)
        z, a = hz0 + t * (hz1 - hz0), t * 2 * math.pi * 1.25
        p = (math.cos(a) * 0.36, cy + math.sin(a) * 0.36, z)
        q = (-math.cos(a) * 0.36, cy - math.sin(a) * 0.36, z)
        L += [sphere(*p, 0.08, MINT, 'plain', 'helix bead', 8, 4) | {'spin': dict(spin)},
              sphere(*q, 0.08, '#E87EA8', 'plain', 'helix bead', 8, 4) | {'spin': dict(spin)},
              limb(p, q, 0.018, 0.018, WHITE, 'plain', 'helix rung', 4) | {'spin': dict(spin)}]
    for x in (-1.15, 1.15):
        potted(L, x * 1.8, fy - 0.3, MINT_D)
    rec = {'ppm': PPM, 'cel': 0.62, 'layers': sorted(B1.shift_y(L, d / 2), key=lambda l: l['k'] == 'img')}
    fx = [{'k': 'window', 'x': px(math.cos(math.radians(deg)) * r), 'y': -px(2.05)} for deg in (-25, 205)]
    fx += [{'k': 'glow', 'x': px(x), 'y': -px(1.6)} for x in (-0.65, 0.65)]
    return rec, fx, [4.4, 4.6]


# ================================================================ the lighthouse
def lighthouse():
    """A striped lighthouse at the cove: a stone plinth, a tapering tower in white and coral bands with a door and
    little windows, an iron gallery with a rail, the light room's glass (lit after dark) behind a shutter that turns,
    a red cap with a vent ball and a vane."""
    L, d = [], 3.6
    L += [cyl(0, 0, 0, 1.9, 0.4, A['stone'], 'stone', 'plinth', 16),
          box(0, -1.95, 0, 1.1, 0.5, 0.2, '#BDB9C6', 'stone', 'door step')]
    z0, h, rb, rt = 0.4, 8.0, 1.45, 0.95
    rad = lambda z: rb + (rt - rb) * (z - z0) / h
    for i in range(4):
        za = z0 + i * h / 4
        L.append(cyl(0, 0, za, rad(za), h / 4, WHITE if i % 2 == 0 else CORAL, 'plaster', 'tower', 16, k='cone',
                     r1=r2(rad(za + h / 4))))
    L += [box(0, -rad(0.4) + 0.06, 0.4, 0.75, 0.2, 1.55, A['iron'], 'metal', 'door frame'),
          box(0, -rad(0.4) + 0.02, 0.4, 0.6, 0.2, 1.45, '#4E6E9E', 'wood', 'door'),
          sphere(0.2, -rad(0.4) - 0.1, 1.1, 0.04, A['brass'], 'metal', 'door knob', 6, 3)]
    for z, y in ((3.2, -1), (5.4, 1), (6.6, -1)):  # little windows up the tower, front and back
        rr = rad(z) - 0.02
        L += [box(0, y * rr, z, 0.36, 0.12, 0.55, A['iron'], 'metal', 'tower window frame'),
              box(0, y * (rr + 0.04), z + 0.04, 0.26, 0.06, 0.47, GLASS, 'plain', 'tower window glass')]
    # the gallery: a deck, posts and rails
    gz = z0 + h
    L.append(cyl(0, 0, gz, 1.4, 0.15, A['iron'], 'metal', 'gallery', 16))
    P = [(math.cos(i * math.pi / 6) * 1.32, math.sin(i * math.pi / 6) * 1.32) for i in range(12)]
    for i, (x, y) in enumerate(P):
        x2, y2 = P[(i + 1) % 12]
        L += [limb((x, y, gz + 0.15), (x, y, gz + 0.8), 0.02, 0.02, A['iron'], 'metal', 'rail post', 4),
              limb((x, y, gz + 0.8), (x2, y2, gz + 0.8), 0.02, 0.02, A['iron'], 'metal', 'rail', 4)]
    # the light room: a red base, the glass, mullions, the shutter that turns round it, the cap
    lz = gz + 0.15
    L += [cyl(0, 0, lz, 0.82, 0.4, CORAL, 'metal', 'light room base', 14),
          cyl(0, 0, lz + 0.4, 0.7, 1.1, '#FFE9A8', 'plain', 'light room glass', 14)]
    for i in range(7):
        a = i * 2 * math.pi / 7
        L.append(limb((math.cos(a) * 0.71, math.sin(a) * 0.71, lz + 0.4), (math.cos(a) * 0.71, math.sin(a) * 0.71, lz + 1.5),
                      0.025, 0.025, A['iron'], 'metal', 'mullion', 4))
    spin = {'axis': 'z', 'x': 0, 'y': 0, 'z': lz + 0.95, 'rps': 0.2}
    for sy in (-1, 1):
        L += [box(0, sy * 0.8, lz + 0.45, 0.75, 0.06, 1.0, A['iron'], 'metal', 'lamp shutter') | {'spin': dict(spin)},
              box(0, sy * 0.77, lz + 0.42, 0.85, 0.03, 0.06, A['brass'], 'metal', 'shutter rim') | {'spin': dict(spin)}]
    cz = lz + 1.5
    L += [cyl(0, 0, cz, 0.9, 0.08, A['iron'], 'metal', 'cap rim', 14),
          cyl(0, 0, cz + 0.08, 0.88, 0.75, '#C84E40', 'metal', 'roof', 14, k='cone', r1=0.05) | {'roof': 1},
          sphere(0, 0, cz + 0.85, 0.14, A['brass'], 'metal', 'vent ball', 8, 4),
          limb((0, 0, cz + 0.95), (0, 0, cz + 1.5), 0.015, 0.015, A['iron'], 'metal', 'vane pole', 4),
          box(0.12, 0, cz + 1.35, 0.4, 0.02, 0.12, A['copper'], 'metal', 'vane')]
    rec = {'ppm': PPM, 'cel': 0.62, 'layers': sorted(B1.shift_y(L, d / 2), key=lambda l: l['k'] == 'img')}
    fx = [{'k': 'glow', 'x': 0, 'y': -px(lz + 0.95)}]
    return rec, fx, [3.6, 3.6]


# ================================================================ the windmill
def sail(L, cx, cy, cz, q, spin):
    """One lattice sail of a windmill facing the front (depth cy), pointing up, right, down or left (q = 0..3): the
    stock, a rail, the cloth between them and the bars across. Boxes only, so the four quarter turns stay square."""
    def part(a0, a1, b0, b1, dy, col, tex, name, depth=0.05):
        # a along the sail (out from the hub), b across it, in metres; turned by q quarter turns
        a, b, la, lb = (a0 + a1) / 2, (b0 + b1) / 2, a1 - a0, b1 - b0
        x, z, w, h = ((b, a, lb, la), (a, -b, la, lb), (-b, -a, lb, la), (-a, b, la, lb))[q]
        L.append(box(cx + x, cy + dy, cz + z - h / 2, w, depth, h, col, tex, name) | {'spin': dict(spin)})
    part(0.1, 3.3, -0.06, 0.06, 0, '#84543C', 'wood', 'sail stock', 0.1)
    part(0.6, 3.3, 0.5, 0.56, 0, '#84543C', 'wood', 'sail rail')
    part(0.6, 3.3, 0.06, 0.5, 0.02, ISL.SAIL, 'cloth', 'sail cloth', 0.02)
    for i in range(6):
        a = 0.65 + i * 0.52
        part(a, a + 0.05, 0.0, 0.56, -0.03, '#B27648', 'wood', 'sail bar', 0.04)


def windmill():
    """A tower mill by the farm: a stone foot, a whitewashed tower narrowing up, a wooden reefing stage, a door and
    little windows, a shingled cap and four lattice sails that turn on the front."""
    L, d = [], 3.6
    L += [cyl(0, 0, 0, 2.0, 0.3, A['stone'], 'stone', 'plinth', 16),
          cyl(0, 0, 0.3, 1.75, 0.9, '#AAA6B4', 'stone', 'stone foot', 16, k='cone', r1=1.68)]
    z0, h, rb, rt = 1.2, 4.6, 1.68, 1.15
    rad = lambda z: rb + (rt - rb) * (z - z0) / h
    L.append(cyl(0, 0, z0, rb, h, '#E8DEC8', 'plaster', 'tower', 16, k='cone', r1=rt))
    L += [box(0, -1.72, 0.3, 0.95, 0.2, 1.75, '#84543C', 'wood', 'door frame'),
          box(0, -1.76, 0.3, 0.8, 0.2, 1.65, '#4E957C', 'wood', 'door'),
          sphere(0.25, -1.88, 1.1, 0.04, A['brass'], 'metal', 'door knob', 6, 3),
          box(0, -2.05, 0, 1.2, 0.5, 0.15, '#BDB9C6', 'stone', 'door step')]
    for z, (x, y) in ((2.5, (0, -1)), (4.6, (1, 0)), (4.6, (-1, 0)), (3.3, (0, 1))):
        rr = rad(z) - 0.02
        if y:
            L += [box(0, y * rr, z, 0.42, 0.12, 0.6, '#84543C', 'wood', 'window frame'),
                  box(0, y * (rr + 0.04), z + 0.05, 0.32, 0.06, 0.5, GLASS, 'plain', 'window glass')]
        else:
            L += [box(x * rr, 0, z, 0.12, 0.42, 0.6, '#84543C', 'wood', 'window frame'),
                  box(x * (rr + 0.04), 0, z + 0.05, 0.06, 0.32, 0.5, GLASS, 'plain', 'side window glass')]
    # the reefing stage round the tower, on braces
    sz = 3.6
    L.append(cyl(0, 0, sz, 2.05, 0.1, '#B27648', 'wood', 'stage', 16))
    for i in range(8):
        a = i * math.pi / 4 + math.pi / 8
        c, s = math.cos(a), math.sin(a)
        L += [limb((c * rad(sz - 0.8), s * rad(sz - 0.8), sz - 0.8), (c * 1.95, s * 1.95, sz), 0.035, 0.035, '#84543C', 'wood', 'stage brace', 4),
              limb((c * 2.0, s * 2.0, sz + 0.1), (c * 2.0, s * 2.0, sz + 0.75), 0.025, 0.025, '#84543C', 'wood', 'stage post', 4)]
        a2 = a + math.pi / 4
        L.append(limb((c * 2.0, s * 2.0, sz + 0.72), (math.cos(a2) * 2.0, math.sin(a2) * 2.0, sz + 0.72), 0.022, 0.022, '#84543C', 'wood', 'stage rail', 4))
    # the cap, the windshaft and the sails
    cz = z0 + h
    L += [cyl(0, 0, cz, 1.25, 0.12, '#84543C', 'wood', 'cap curb', 16),
          cyl(0, 0, cz + 0.12, 1.3, 1.25, '#5A6878', 'shingles', 'roof', 16, k='cone', r1=0.08) | {'roof': 1},
          sphere(0, 0, cz + 1.4, 0.12, A['brass'], 'metal', 'cap finial', 8, 4)]
    hy, hz = -1.75, cz + 0.55
    L += [limb((0, -0.6, hz), (0, hy + 0.05, hz), 0.12, 0.1, A['iron'], 'metal', 'windshaft', 8)]
    spin = {'axis': 'y', 'x': 0, 'y': hy, 'z': hz, 'rps': 0.18}
    L.append(sphere(0, hy - 0.05, hz, 0.2, A['copper'], 'metal', 'sail hub', 10, 5) | {'spin': dict(spin)})
    for q in range(4):
        sail(L, 0, hy - 0.12, hz, q, spin)
    potted(L, 1.2, -2.1)
    rain_barrel(L, -1.55, -1.1)
    rec = {'ppm': PPM, 'cel': 0.62, 'layers': sorted(B1.shift_y(L, d / 2), key=lambda l: l['k'] == 'img')}
    fx = [{'k': 'window', 'x': 0, 'y': -px(2.8)}]
    return rec, fx, [3.6, 3.6]


# ================================================================ the catalogue
NEW = {'workshop': ('Workshop', workshop, ('town',)), 'gene_bank': ('Gene Bank', gene_bank, ('town',))}
SWAP = {'lighthouse': lighthouse, 'windmill': windmill}


def build_new(C, key, name, fn, tags):
    out = fn()
    if isinstance(out, House):
        rec, fx, bx = out.done(), out.fx(), [out.w, out.d]
    else:
        rec, fx, bx = out
    rec = mark_glass(rec)
    M = ISL.new_prop(key, name, rec, shadow=1.8, tags=tags, box_=bx, vary={'rot': 0, 'lean': 0, 'size': 0},
                     door={'x': px(door_x(rec['layers'])), 'y': 0}, fx=fx)
    room = C.get(key, {}).get('room')  # kept on a rebuild (tools/build-hub-rooms.py sets it)
    if room: M['room'] = room
    C[key] = M


def swap_in(C, key, fn):
    """batch 7's way: the model under the old key; its picture, name, tags and landmark flag kept."""
    M = C[key]
    rec, fx, bx = fn()
    rec = mark_glass(rec)
    M['model'] = B1.write_recipe(key, rec)
    M['ppm'] = PPM
    M['fx'] = fx
    M['box'] = bx
    M['solid'] = 1
    M['vary'] = {'rot': 0, 'lean': 0, 'size': 0}
    for f in ('vol', 'volDepth', 'layers', 'build', 'blades'):
        M.pop(f, None)


def main():
    ISL.PICS.mkdir(parents=True, exist_ok=True)
    D = gamedata.load()
    C = D['scenery']['props']
    for key, (name, fn, tags) in NEW.items():
        build_new(C, key, name, fn, tags)
    for key, fn in SWAP.items():
        swap_in(C, key, fn)
    gamedata.save(D)
    print('hub buildings:', ', '.join([*NEW, *SWAP]))


if __name__ == '__main__':
    main()
