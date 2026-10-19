#!/usr/bin/env python3
"""Phase 09, batch 5 (Marigold Town, part 1): the clinic and the market, redesigned. Unova-style town buildings (the
clean, chunky shapes, bold colour bands, big glass and crisp detail of the fifth-generation games) crossed with the
game's retro-futuristic solarpunk: streamlined rounded corners, a glass dome, brass and verdigris, solar glass, plants
everywhere. Original designs: no emblem, sign or shape is copied from anything.

  clinic        rounded white two-storey with a coral eave band, a glass lobby under a solar canopy, a ribbon window,
                portholes, a glass dome with brass ribs on a roof garden, the clinic's mint-plus emblem
  sign_clinic   the emblem on a slim brass post with a globe lamp
  market_hall   a brick arcade hall (three arches with iron fanlights and produce counters) under a verdigris barrel
                vault with a solar-glass ridge, a clock pediment, the town's colours as variants
  stall         a produce stall under a striped tent awning with scallops, crates, baskets, a chalkboard, a scale
  market_cart   a rounded vendor cart on two spoked wheels under a striped parasol with a solar cell
  bread_rack    an outdoor bread rack: shelves of loaves and baguettes under a little awning

    python3 tools/build-props-batch5.py      (after batch1 to batch4)
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


B1 = load('batch1', 'build-props-batch1.py')
B3 = load('batch3', 'build-props-batch3.py')
PPM, A = B1.PPM, B1.AIR
box, limb, disc, sphere, cyl, img, porthole = B1.box, B1.limb, B1.disc, B1.sphere, B1.cyl, B1.img, B1.porthole
r2, np = B1.r2, B1.np
S2 = math.sqrt(2)
CORAL, CORAL_D, WHITE, MINT, MINT_D = '#E8604E', '#C84E40', '#F4F6F2', '#7ED4AC', '#3EB489'
GLASS, SOLAR, DARK = '#86C8DC', '#3A4C7E', '#2E2A3A'
LEAF, LEAF2 = '#5E9A48', '#6EAE52'
FRUIT = ('#E04848', '#F49A3A', '#8CC850', '#F4D040', '#C478D0', '#F07090')


def rec(L, cel=0.65):
    return {'ppm': PPM, 'cel': cel, 'layers': sorted(L, key=lambda l: l['k'] == 'img')}


def arc(cx, y, cz, r, a0, a1, t, col, tex, name, n=10, plane='xz'):
    """A curved bar along a circle (an arch, a rib): from angle a0 to a1 (radians, 0 = across, pi/2 = up)."""
    pts = []
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        if plane == 'xz': pts.append([r2(cx + math.cos(a) * r), r2(y), r2(cz + math.sin(a) * r), t])
        else: pts.append([r2(cx), r2(y + math.cos(a) * r), r2(cz + math.sin(a) * r), t])
    return {'k': 'limb', 'pts': pts, 'sides': 6, 'col': col, 'tex': tex, 'name': name}


# ---------------------------------------------------------------- lettering and small pictures
GLYPHS = {
    'C': ['01110', '11011', '11000', '11000', '11000', '11011', '01110'],
    'L': ['11000', '11000', '11000', '11000', '11000', '11000', '11111'],
    'I': ['111', '010', '010', '010', '010', '010', '111'],
    'N': ['11001', '11101', '11111', '11011', '11001', '11001', '11001'],
    'M': ['110011', '111111', '111111', '110101', '110001', '110001', '110001'],
    'A': ['01110', '11011', '11011', '11111', '11011', '11011', '11011'],
    'R': ['11110', '11011', '11011', '11110', '11100', '11110', '11011'],
    'K': ['11011', '11011', '11110', '11100', '11110', '11011', '11011'],
    'E': ['11111', '11000', '11000', '11110', '11000', '11000', '11111'],
    'T': ['111111', '001100', '001100', '001100', '001100', '001100', '001100'],
}


def letters(text, col, name, shade=None):
    """A word in the game's chunky 7 px capitals at 32 px to the metre, on a clear ground, with a darker drop shade."""
    col = [int(col[i:i + 2], 16) for i in (1, 3, 5)]
    sh = [int(shade[i:i + 2], 16) for i in (1, 3, 5)] if shade else [max(0, int(c * 0.55)) for c in col]
    W = sum(len(GLYPHS[c][0]) + 1 for c in text) + 1
    a = np.zeros((9, W, 4), np.uint8)
    x = 0
    for c in text:
        g = GLYPHS[c]
        for y, row in enumerate(g):
            for i, v in enumerate(row):
                if v == '1':
                    a[y + 2, x + i + 1] = (*sh, 255)
        for y, row in enumerate(g):
            for i, v in enumerate(row):
                if v == '1':
                    a[y + 1, x + i] = (*col, 255)
        x += len(g[0]) + 1
    a = a[:, :x + 1]
    return B1.save_png(a, B1.NEXT / 'decals' / f'{name}.png'), a.shape[1] / PPM, a.shape[0] / PPM


def globe_sprite():
    """A warm glass globe for the retro lamps (it lights up when the lamps come on)."""
    a = np.zeros((9, 9, 4), np.uint8)
    for y in range(9):
        for x in range(9):
            d = (x - 4) ** 2 + (y - 4) ** 2
            if d <= 17: a[y, x] = (176, 120, 60, 255)
            if d <= 11: a[y, x] = (255, 222, 120, 255)
    a[2, 3] = a[2, 4] = a[3, 2] = (255, 246, 210, 255)
    return B1.save_png(a, B1.NEXT / 'decals' / 'globe_lamp.png')


def globe_lamp(L, x, y, z, post=None):
    """A retro globe lamp: a brass cup holding a glowing globe; on a post of the given height, or on a wall bracket."""
    if post:
        L += [cyl(x, y, 0, 0.1, 0.08, A['iron'], 'metal', 'lamp foot', 8),
              limb((x, y, 0.08), (x, y, post), 0.035, 0.03, A['iron'], 'metal', 'lamp post', 6)]
        z = post
    L += [cyl(x, y, z, 0.07, 0.06, A['brass'], 'metal', 'lamp cup', 8, k='cone', r1=0.1),
          img(globe_sprite(), x, y, z + 0.04, s=0.95, glow=1, recv=0, sway=0, name='lamp globe')]


def scallop_awning(L, cx, cy, z, w, depth, h, cols, seg=0.28, both=True, name='awning'):
    """A striped cloth awning: alternating narrow strips, each a 4-sided cone drawn out to a ridge (both slopes, a tent;
    or set into a wall so only the front slope shows), with a valance and scallops along the front edge."""
    n = max(2, round(w / seg))
    sw = w / n
    for i in range(n):
        x = cx - w / 2 + sw * (i + 0.5)
        L.append(cyl(x, cy, z, (sw / 2) * S2 + 0.004, h, cols[i % 2], 'cloth', name, 4, k='cone', ry=r2(depth * S2),
                     r1=r2((sw / 2) * S2 + 0.004), ry1=0.02, rot=r2(math.pi / 4)))
    for sy in ((-1, 1) if both else (-1,)):
        ey = cy + sy * depth
        for i in range(n):
            x = cx - w / 2 + sw * (i + 0.5)
            L.append(box(x, ey + sy * 0.01, z - 0.1, sw, 0.02, 0.1, cols[i % 2], 'cloth', name + ' valance'))
            L.append(disc(x, ey, z - 0.1, (0, sy, 0), sw / 2, 0.015, cols[i % 2], 'cloth', name + ' scallop', 10))


def produce_crate(L, x, y, z, w, d, col, seed, n=7):
    rng = np.random.default_rng(seed)
    L += [box(x, y, z, w, d, 0.16, A['plank'], 'wood', 'crate'),
          box(x, y - d / 2 - 0.005, z + 0.05, w, 0.01, 0.04, A['dwood'], 'wood', 'crate slat')]
    for i in range(n):
        px = x - w / 2 + 0.08 + (w - 0.16) * (i % 4) / 3 + (rng.random() - 0.5) * 0.03
        py = y + (0.08 if i >= 4 else -0.06) + (rng.random() - 0.5) * 0.04
        L.append(sphere(px, py, z + 0.12 + (0.05 if i >= 4 else 0), 0.065, col, 'plain', 'fruit', 7, 4))


# ---------------------------------------------------------------- the clinic
def rounded(L, w, d, R, z, h, g, col, tex, name, sides=12):
    """A block with its two front corners rounded (radius R), grown by g on every side."""
    L += [box(0, (R + g) / 2, z, w + 2 * g, d - R + g, h, col, tex, name),
          box(0, -d / 2 + (R - g) / 2, z, w - 2 * R, R + g, h, col, tex, name)]
    for sx in (-1, 1):
        L.append(cyl(sx * (w / 2 - R), -d / 2 + R, z, R + g, h, col, tex, name, sides))


def clinic_recipe():
    """The clinic: the same in every town, so it is known at a glance. A rounded white block of two storeys under a thick
    coral eave, mint lines, a glass lobby with sliding doors under a solar canopy on brass posts, the word CLINIC, a
    ribbon window with flower boxes, portholes, and on the roof a garden round a glass dome with brass ribs, solar panels
    and a little wind turbine. The emblem, a mint plus on white in a copper ring, stands over the door."""
    w, d, R = 4.6, 2.6, 0.5
    fy = -d / 2
    L = [box(0, 0, 0, w + 0.3, d + 0.3, 0.16, '#B4B0C2', 'stone', 'plinth')]
    rounded(L, w, d, R, 0.16, 3.44, 0, WHITE, 'panels', 'walls', 16)
    rounded(L, w, d, R, 1.92, 0.16, 0.04, CORAL, 'metal', 'floor band', 16)
    rounded(L, w, d, R, 1.88, 0.04, 0.05, MINT, 'metal', 'mint line', 16)
    rounded(L, w, d, R, 3.6, 0.34, 0.26, CORAL, 'metal', 'eave', 16)
    rounded(L, w, d, R, 3.55, 0.05, 0.28, MINT, 'metal', 'eave line', 16)
    rounded(L, w, d, R, 3.94, 0.06, 0.18, '#D8D4E0', 'tilewall', 'roof deck', 16)
    # the lobby: a glass front with white mullions, sliding doors, a sensor, a mat and a step
    lw = 2.3
    L += [box(0, fy - 0.01, 0.16, lw, 0.03, 1.72, GLASS, 'plain', 'lobby glass'),
          box(0, fy - 0.03, 1.82, lw + 0.1, 0.05, 0.08, WHITE, 'metal', 'lobby head')]
    for x in (-lw / 2, -0.55, 0.55, lw / 2):
        L.append(box(x, fy - 0.03, 0.16, 0.06, 0.05, 1.68, WHITE, 'metal', 'mullion'))
    for sx in (-1, 1):
        L += [box(sx * 0.27, fy - 0.05, 0.16, 0.5, 0.02, 1.6, '#A8DCE8', 'plain', 'sliding door'),
              box(sx * 0.03, fy - 0.07, 0.16, 0.05, 0.03, 1.6, MINT_D, 'metal', 'door edge'),
              box(sx * 0.51, fy - 0.07, 0.16, 0.05, 0.03, 1.6, MINT_D, 'metal', 'door edge')]
    L += [box(0, fy - 0.07, 1.76, 1.08, 0.04, 0.05, MINT_D, 'metal', 'door top'),
          box(0, fy - 0.08, 1.66, 0.16, 0.04, 0.06, DARK, 'plain', 'door sensor'),
          box(0, fy - 0.45, 0, 1.6, 0.9, 0.12, '#C8C4D4', 'stone', 'step'),
          box(0, fy - 0.4, 0.12, 1.1, 0.55, 0.02, MINT_D, 'cloth', 'mat')]
    # the solar canopy on two brass posts
    cz = 2.02
    L += [box(0, fy - 0.5, cz, 2.8, 1.0, 0.12, CORAL, 'metal', 'canopy'),
          box(0, fy - 0.5, cz + 0.12, 2.6, 0.86, 0.035, SOLAR, 'solar', 'canopy solar glass'),
          box(0, fy - 1.0, cz - 0.03, 2.84, 0.04, 0.05, MINT, 'metal', 'canopy line')]
    for sx in (-1, 1):
        L += [limb((sx * 1.28, fy - 0.92, 0.12), (sx * 1.28, fy - 0.92, cz), 0.04, 0.035, A['brass'], 'metal', 'canopy post', 8),
              cyl(sx * 1.28, fy - 0.92, 0.12, 0.08, 0.06, A['brass'], 'metal', 'post foot', 8)]
        globe_lamp(L, sx * 0.9, fy - 0.92, cz - 0.15)
    # the word over the canopy, and the ribbon window above it with flower boxes
    p, lw_, lh = letters('CLINIC', '#FFFFFF', 'clinic_word', '#9A3A30')
    L += [box(0, fy - 0.03, 2.19, lw_ + 0.3, 0.05, 0.38, CORAL, 'metal', 'name band'),
          box(0, fy - 0.02, 2.17, lw_ + 0.38, 0.05, 0.42, MINT, 'metal', 'name band rim'),
          img(p, 0, fy - 0.07, 2.24, face='fixed', recv=0, shadow=0, sway=0, name='lettering')]
    rw = w - 2 * R
    L += [box(0, fy - 0.01, 2.62, rw, 0.03, 0.78, GLASS, 'plain', 'ribbon window'),
          box(0, fy - 0.04, 2.58, rw + 0.06, 0.06, 0.05, WHITE, 'metal', 'ribbon sill'),
          box(0, fy - 0.04, 3.38, rw + 0.06, 0.06, 0.05, WHITE, 'metal', 'ribbon head')]
    for i in range(7):
        L.append(box(-rw / 2 + rw * i / 6, fy - 0.04, 2.62, 0.05, 0.05, 0.78, WHITE, 'metal', 'ribbon mullion'))
    B3.flower_box(L, -1.4, fy, 2.3, 0.7, 4)
    B3.flower_box(L, 1.4, fy, 2.3, 0.7, 8)
    # the ground floor either side of the lobby: a porthole each and potted plants; side and back windows
    for sx in (-1, 1):
        porthole(L, sx * 1.72, fy, 1.05, (0, -1, 0), 0.34, 'porthole')
        B3.potted_plant(L, sx * 1.6, fy - 0.45, MINT_D, LEAF, 0.6)
        porthole(L, sx * w / 2, 0.25, 1.05, (sx, 0, 0), 0.32, 'side porthole')
        L.append(box(sx * (w / 2 + 0.01), 0.3, 2.62, 0.03, 1.2, 0.78, GLASS, 'plain', 'side ribbon'))
    L.append(box(0, d / 2 + 0.01, 2.62, w - 1.0, 0.03, 0.78, GLASS, 'plain', 'back ribbon'))
    # the roof garden: a glass dome with brass ribs and a finial, planters round it, solar panels and a turbine
    rz, dx, dy, dr = 4.0, -0.4, 0.15, 1.05
    L += [cyl(dx, dy, rz, dr + 0.08, 0.12, A['copper'], 'metal', 'dome ring', 20),
          {'k': 'dome', 'x': dx, 'y': dy, 'z': rz + 0.12, 'r': dr, 'h': 0.95, 'sides': 20, 'rings': 6, 'col': '#A8DCE8',
           'tex': 'plain', 'name': 'glass dome'}]
    for i in range(8):
        a = 2 * math.pi * i / 8
        pts = [[r2(dx + math.cos(a) * dr * math.cos(t) * 1.01), r2(dy + math.sin(a) * dr * math.cos(t) * 1.01),
                r2(rz + 0.12 + 0.95 * math.sin(t) * 1.01), 0.022] for t in (k * math.pi / 2 / 6 for k in range(7))]
        L.append({'k': 'limb', 'pts': pts, 'sides': 4, 'col': A['brass'], 'tex': 'metal', 'name': 'dome rib'})
    L += [cyl(dx, dy, rz + 1.06, 0.1, 0.08, A['brass'], 'metal', 'finial base', 8),
          limb((dx, dy, rz + 1.12), (dx, dy, rz + 1.45), 0.025, 0.01, A['brass'], 'metal', 'finial', 6),
          sphere(dx, dy, rz + 1.3, 0.05, MINT, 'plain', 'finial bead', 8, 4)]
    for x in (-2.0, 1.25, 2.05):
        L.append(box(x, fy + 0.25, rz, 0.5, 0.3, 0.22, A['copper'], 'metal', 'roof planter'))
        B1_leafy(L, x, fy + 0.25, rz + 0.2)
    for i in range(2):
        px = 1.35 + i * 0.75
        L.append(box(px, 0.75, rz + 0.22, 0.66, 0.6, 0.04, SOLAR, 'solar', 'solar panel'))
        for sx in (-0.28, 0.28):
            L.append(box(px + sx, 0.75, rz, 0.04, 0.04, 0.22, A['iron'], 'metal', 'panel leg'))
    tx, ty = -1.85, 0.75
    L.append(limb((tx, ty, rz), (tx, ty, rz + 0.95), 0.025, 0.02, A['iron'], 'metal', 'turbine mast', 6))
    spin = {'axis': 'z', 'x': tx, 'y': ty, 'z': rz + 0.8, 'rps': 0.5}
    for i in range(3):
        a = i * 2 * math.pi / 3
        bx, by = tx + math.cos(a) * 0.18, ty + math.sin(a) * 0.18
        L.append(limb((bx, by, rz + 0.6), (bx, by, rz + 1.0), 0.03, 0.03, WHITE, 'cloth', 'turbine blade', 5) | {'spin': dict(spin)})
        L.append(limb((tx, ty, rz + 0.8), (bx, by, rz + 0.8), 0.01, 0.01, A['brass'], 'metal', 'blade arm', 4) | {'spin': dict(spin)})
    # the emblem over the door, standing on the eave: a copper ring, white face, a mint plus, a mint leaf
    ez, ey = 4.6, fy - 0.12
    L += [box(0, ey + 0.12, 3.94, 0.16, 0.12, 0.3, A['iron'], 'metal', 'emblem stand'),
          disc(0, ey, ez, (0, -1, 0), 0.62, 0.12, A['copper'], 'metal', 'emblem ring', 24),
          disc(0, ey, ez, (0, -1, 0), 0.52, 0.14, WHITE, 'plain', 'emblem face', 24),
          box(0, ey - 0.16, ez - 0.08, 0.6, 0.04, 0.17, MINT_D, 'plain', 'emblem plus'),
          box(0, ey - 0.16, ez - 0.3, 0.17, 0.04, 0.6, MINT_D, 'plain', 'emblem plus'),
          sphere(0.3, ey - 0.15, ez + 0.2, 0.08, LEAF2, 'plain', 'emblem leaf', 6, 3, h=0.1)]
    # a vine up the left corner
    vx, vy = -w / 2 + 0.05, fy + R - 0.05
    for i in range(9):
        L.append(sphere(vx - 0.06 + 0.06 * math.sin(i * 1.9), vy - 0.42 + 0.04 * math.cos(i), 0.25 + i * 0.36, 0.11 + (i % 3) * 0.02,
                        LEAF if i % 2 else LEAF2, 'leaves', 'vine leaves', 7, 3, 0.35))
        if i % 3 == 1:
            L.append(sphere(vx - 0.02, vy - 0.55, 0.32 + i * 0.36, 0.035, '#E87EA8', 'plain', 'vine flower', 6, 3))
    return rec(B1.shift_y(L, d / 2))


def B1_leafy(L, x, y, z):
    for i, (ox, oy) in enumerate(((-0.12, 0), (0.12, 0.02), (0, -0.05))):
        L.append(sphere(x + ox, y + oy, z, 0.14, LEAF if i % 2 else LEAF2, 'leaves', 'roof plant', 8, 4, 0.3))


def clinic_fx():
    px = lambda m: round(m * PPM)
    return [{'k': 'window', 'x': 0, 'y': -px(1.0)}, {'k': 'window', 'x': -px(1.0), 'y': -px(3.0)},
            {'k': 'window', 'x': px(1.0), 'y': -px(3.0)}, {'k': 'glow', 'x': 0, 'y': -px(4.6)}]


def sign_clinic_recipe():
    """The clinic's street sign: the emblem hanging from a slim brass post's arm, a globe lamp on top, a planter at its foot."""
    L = [box(0, 0, 0, 0.42, 0.42, 0.28, A['copper'], 'metal', 'planter'),
         box(0, 0, 0.28, 0.46, 0.46, 0.04, A['brass'], 'metal', 'planter rim')]
    B1_leafy(L, 0, 0, 0.28)
    L += [limb((0, 0, 0.3), (0, 0, 2.2), 0.04, 0.035, A['iron'], 'metal', 'post', 8),
          limb((0, 0, 2.0), (0.62, 0, 2.0), 0.025, 0.025, A['iron'], 'metal', 'arm', 6),
          limb((0, 0, 1.75), (0.25, 0, 2.0), 0.015, 0.015, A['iron'], 'metal', 'arm brace', 4)]
    for x in (0.28, 0.56):
        L.append(limb((x, 0, 2.0), (x, 0, 1.86), 0.008, 0.008, A['iron'], 'metal', 'chain', 4))
    ez = 1.5
    L += [disc(0.42, 0, ez, (0, -1, 0), 0.36, 0.06, A['copper'], 'metal', 'sign ring', 20),
          disc(0.42, 0, ez, (0, -1, 0), 0.29, 0.08, WHITE, 'plain', 'sign face', 20),
          box(0.42, -0.1, ez - 0.05, 0.34, 0.03, 0.1, MINT_D, 'plain', 'sign plus'),
          box(0.42, -0.1, ez - 0.17, 0.1, 0.03, 0.34, MINT_D, 'plain', 'sign plus'),
          disc(0.42, 0, ez, (0, 1, 0), 0.29, 0.08, WHITE, 'plain', 'sign back'),
          box(0.42, 0.1, ez - 0.05, 0.34, 0.03, 0.1, MINT_D, 'plain', 'sign plus back'),
          box(0.42, 0.1, ez - 0.17, 0.1, 0.03, 0.34, MINT_D, 'plain', 'sign plus back')]
    globe_lamp(L, 0, 0, 2.2)
    return rec(L)


# ---------------------------------------------------------------- the market hall
BRICK, VAULT, STONE = '#B65A44', '#62B098', '#DCD2BE'


def market_hall_recipe():
    """A brick arcade hall: stone quoins and cornice, three tall arches with iron fanlights and produce counters, globe
    lamps and hanging baskets between them; a verdigris barrel vault with iron ribs and a ridge of solar glass, brick
    gable ends, a clock in an arched pediment over the middle arch above a board reading MARKET."""
    w, d, wt = 6.4, 3.6, 3.1
    fy = -d / 2
    L = [box(0, 0, 0, w + 0.3, d + 0.3, 0.2, '#A8A4B4', 'stone', 'plinth'),
         box(0, 0, 0.2, w, d, wt - 0.2, BRICK, 'brick', 'walls'),
         box(0, 0, wt, w + 0.22, d + 0.22, 0.14, STONE, 'stone', 'cornice'),
         box(0, 0, wt + 0.14, w + 0.1, d + 0.1, 0.06, A['copper'], 'metal', 'gutter')]
    for sx in (-1, 1):
        for sy in (-1, 1):
            for i in range(9):
                big = i % 2 == 0
                L.append(box(sx * (w / 2 - (0.1 if big else 0.07)), sy * (d / 2 - (0.07 if big else 0.1)), 0.2 + i * 0.32,
                             0.24 if big else 0.18, 0.18 if big else 0.24, 0.3, STONE, 'stone', 'quoin'))
    # the barrel vault: a long round limb sunk to its middle in the walls, iron ribs, a ridge of solar glass
    vz, vr = wt + 0.2, d / 2
    L.append({'k': 'limb', 'x': -w / 2 + 0.01, 'y': 0, 'z': vz, 'x2': w / 2 - 0.01, 'y2': 0, 'z2': vz, 'r': vr, 'r1': vr,
              'sides': 24, 'col': VAULT, 'tex': 'corrugated', 'name': 'vault'})
    for i in range(7):
        x = -w / 2 + 0.1 + (w - 0.2) * i / 6
        L.append(arc(x, 0, vz, vr + 0.03, 0.05, math.pi - 0.05, 0.045, A['iron'], 'metal', 'vault rib', 12, plane='yz'))
    L += [box(0, 0, vz + vr - 0.12, w - 0.9, 0.9, 0.2, '#4A5E8E', 'metal', 'ridge frame'),
          box(0, 0, vz + vr + 0.08, w - 1.0, 0.8, 0.04, SOLAR, 'solar', 'solar ridge'),
          box(0, 0, vz + vr + 0.12, w - 1.0, 0.06, 0.04, A['brass'], 'metal', 'ridge cap')]
    for sx in (-1, 1):
        L += [disc(sx * (w / 2 - 0.01), 0, vz, (sx, 0, 0), vr - 0.1, 0.04, BRICK, 'brick', 'gable end', 24),
              disc(sx * (w / 2 + 0.03), 0, vz + 0.85, (sx, 0, 0), 0.32, 0.02, A['copper'], 'metal', 'gable window ring', 16),
              disc(sx * (w / 2 + 0.04), 0, vz + 0.85, (sx, 0, 0), 0.25, 0.02, GLASS, 'plain', 'gable window', 16)]
    # weathervane on the ridge
    L += [limb((w / 2 - 0.6, 0, vz + vr + 0.16), (w / 2 - 0.6, 0, vz + vr + 0.8), 0.02, 0.015, A['iron'], 'metal', 'vane post', 5),
          box(w / 2 - 0.6, 0, vz + vr + 0.62, 0.5, 0.02, 0.12, A['copper'], 'metal', 'vane'),
          sphere(w / 2 - 0.6, 0, vz + vr + 0.78, 0.04, A['brass'], 'metal', 'vane ball', 6, 3)]
    # the three arches
    sp, ar = 1.6, 0.74
    for i, x in enumerate((-2.1, 0.0, 2.1)):
        L += [box(x, fy - 0.035, 0.2, 2 * ar, 0.02, sp - 0.2, DARK, 'plain', 'arch opening'),
              disc(x, fy, sp, (0, -1, 0), ar, 0.025, '#9BD2DA', 'plain', 'fanlight', 20),
              box(x, fy - 0.05, sp - 0.04, 2 * ar, 0.03, 0.06, A['iron'], 'metal', 'transom'),
              arc(x, fy - 0.035, sp, ar * 0.45, 0.0, math.pi, 0.02, A['iron'], 'metal', 'fanlight ring', 8)]
        for a in (0.45, 0.95, 1.57, 2.19, 2.69):
            L.append(limb((x + math.cos(a) * ar * 0.45, fy - 0.04, sp + math.sin(a) * ar * 0.45),
                          (x + math.cos(a) * ar, fy - 0.04, sp + math.sin(a) * ar), 0.015, 0.015, A['iron'], 'metal', 'fanlight bar', 4))
        L.append(arc(x, fy - 0.05, sp, ar + 0.08, 0.0, math.pi, 0.08, STONE, 'stone', 'arch stones', 12))
        L.append(box(x, fy - 0.08, sp + ar - 0.04, 0.2, 0.06, 0.26, STONE, 'stone', 'keystone'))
        for sx in (-1, 1):
            L.append(box(x + sx * (ar + 0.08), fy - 0.05, 0.2, 0.16, 0.06, sp - 0.2, STONE, 'stone', 'jamb'))
        # a counter in the arch with produce
        L.append(box(x, fy - 0.3, 0.2, 1.3, 0.5, 0.7, A['wood'], 'wood', 'counter'))
        L.append(box(x, fy - 0.3, 0.9, 1.4, 0.56, 0.05, A['plank'], 'wood', 'counter top'))
        for j in range(3):
            produce_crate(L, x - 0.42 + j * 0.42, fy - 0.3, 0.95, 0.38, 0.4, FRUIT[(i * 3 + j) % 6], 31 + i * 3 + j, 6)
    # lamps and hanging baskets on the piers between arches
    for x in (-3.05, -1.05, 1.05, 3.05):
        globe_lamp(L, x, fy - 0.2, 2.1)
        L += [limb((x, fy, 2.05), (x, fy - 0.2, 2.05), 0.02, 0.02, A['iron'], 'metal', 'lamp bracket', 4)]
    for x in (-1.05, 1.05):
        L += [limb((x, fy, 2.95), (x, fy - 0.3, 2.95), 0.015, 0.015, A['iron'], 'metal', 'basket bracket', 4),
              limb((x, fy - 0.3, 2.95), (x, fy - 0.3, 2.76), 0.008, 0.008, A['iron'], 'metal', 'basket chain', 4),
              cyl(x, fy - 0.3, 2.62, 0.14, 0.14, A['straw'], 'hay', 'basket', 10, k='cone', r1=0.18)]
        B1_leafy(L, x, fy - 0.3, 2.72)
    # the clock pediment over the middle arch, and the MARKET board under it
    pz = wt + 0.14
    L += [box(0, fy + 0.15, pz, 1.7, 0.3, 0.8, BRICK, 'brick', 'pediment'),
          disc(0, fy + 0.15, pz + 0.8, (0, -1, 0), 0.85, 0.15, BRICK, 'brick', 'pediment top', 24),
          arc(0, fy - 0.02, pz + 0.8, 0.9, 0.0, math.pi, 0.07, STONE, 'stone', 'pediment coping', 14),
          disc(0, fy, pz + 0.75, (0, -1, 0), 0.5, 0.06, A['brass'], 'metal', 'clock ring', 24),
          disc(0, fy, pz + 0.75, (0, -1, 0), 0.42, 0.08, '#F8F2E0', 'plain', 'clock face', 24),
          box(0.0, fy - 0.1, pz + 0.75, 0.04, 0.02, 0.3, DARK, 'plain', 'minute hand'),
          box(0.09, fy - 0.11, pz + 0.73, 0.2, 0.02, 0.04, DARK, 'plain', 'hour hand'),
          sphere(0, fy - 0.12, pz + 0.72, 0.03, A['brass'], 'metal', 'clock pin', 6, 3)]
    for k in range(12):
        a = 2 * math.pi * k / 12
        L.append(box(math.cos(a) * 0.34, fy - 0.09, pz + 0.75 + math.sin(a) * 0.34 - 0.02, 0.04, 0.02, 0.04, DARK, 'plain', 'clock mark'))
    p, lw_, lh = letters('MARKET', '#F8E8B0', 'market_word', '#7A5A2A')
    L += [box(0, fy - 0.04, 2.62, lw_ + 0.3, 0.05, lh + 0.14, '#2E5A50', 'wood', 'name board'),
          box(0, fy - 0.03, 2.59, lw_ + 0.4, 0.05, lh + 0.2, A['brass'], 'metal', 'name board rim'),
          img(p, 0, fy - 0.08, 2.69, face='fixed', recv=0, shadow=0, sway=0, name='lettering')]
    # side windows, tall and arched, and a vine on the right corner
    for sx in (-1, 1):
        for y in (-0.8, 0.8):
            L += [box(sx * (w / 2 + 0.01), y, 1.0, 0.03, 0.7, 1.1, GLASS, 'plain', 'side window'),
                  disc(sx * (w / 2 + 0.01), y, 2.1, (sx, 0, 0), 0.35, 0.03, GLASS, 'plain', 'side window top', 12)]
    vx, vy = w / 2 + 0.08, fy - 0.08
    for i in range(10):
        L.append(sphere(vx + 0.05 * math.sin(i * 1.7), vy, 0.3 + i * 0.3, 0.12 + (i % 3) * 0.02, LEAF if i % 2 else LEAF2, 'leaves', 'vine leaves', 7, 3, 0.35))
    return rec(B1.shift_y(L, d / 2))


def market_hall_fx():
    px = lambda m: round(m * PPM)
    return [{'k': 'window', 'x': px(x), 'y': -px(1.9)} for x in (-2.1, 0, 2.1)] + [{'k': 'glow', 'x': 0, 'y': -px(3.9)}]


# ---------------------------------------------------------------- the market's stalls
def stall_recipe():
    """A produce stall: a plank counter on four posts under a striped tent awning with scallops, crates of fruit on the
    counter, baskets in front, a chalkboard price sign, a brass scale and a globe lamp under the awning."""
    w, d = 3.2, 1.3
    fy = -d / 2
    L = [box(0, 0.05, 0, w - 0.2, 0.7, 0.85, A['wood'], 'wood', 'counter')]
    for i in range(8):
        x = -w / 2 + 0.3 + (w - 0.6) * i / 7
        L.append(box(x, fy + 0.29, 0.04, 0.3, 0.02, 0.76, A['plank'] if i % 2 else '#D6A26C', 'wood', 'front board'))
    L += [box(0, 0.05, 0.85, w, 0.84, 0.05, A['plank'], 'wood', 'counter top'),
          box(0, fy + 0.29, 0.62, w - 0.3, 0.04, 0.08, '#E8D8A8', 'cloth', 'cloth band')]
    for sx in (-1, 1):
        for sy in (-1, 1):
            L.append(limb((sx * (w / 2 - 0.05), sy * 0.45 + 0.05, 0), (sx * (w / 2 - 0.05), sy * 0.45 + 0.05, 2.15), 0.04, 0.035, A['dwood'], 'wood', 'post', 6))
    scallop_awning(L, 0, 0.05, 2.12, w + 0.2, 0.85, 0.45, (CORAL, '#FAF0DC'), 0.3)
    for j in range(4):
        produce_crate(L, -1.15 + j * 0.77, -0.05, 0.9, 0.62, 0.48, FRUIT[j], 51 + j)
    for x, c in ((-1.0, FRUIT[4]), (0.9, FRUIT[1])):
        L += [cyl(x, fy - 0.35, 0, 0.2, 0.26, A['straw'], 'hay', 'basket', 10, k='cone', r1=0.24),
              ]
        for k in range(5):
            a = k * 1.3
            L.append(sphere(x + math.cos(a) * 0.1, fy - 0.35 + math.sin(a) * 0.08, 0.22, 0.07, c, 'plain', 'fruit', 7, 4))
    # chalkboard on its own legs, a scale, a lamp
    L += [box(1.45, fy - 0.45, 0.2, 0.5, 0.04, 0.6, DARK, 'plain', 'chalkboard'),
          box(1.45, fy - 0.47, 0.18, 0.56, 0.04, 0.66, A['wood'], 'wood', 'chalkboard frame')]
    for k in range(3):
        L.append(box(1.4 + (k % 2) * 0.06, fy - 0.48, 0.62 - k * 0.15, 0.3 - k * 0.05, 0.01, 0.03, '#F4F0E8', 'plain', 'chalk'))
    for sx in (-0.2, 0.2):
        L.append(limb((1.45 + sx, fy - 0.45, 0), (1.45 + sx * 0.6, fy - 0.45, 0.8), 0.02, 0.02, A['wood'], 'wood', 'chalkboard leg', 4))
    L += [cyl(-1.45, 0.25, 0.9, 0.12, 0.04, A['brass'], 'metal', 'scale foot', 8),
          limb((-1.45, 0.25, 0.94), (-1.45, 0.25, 1.2), 0.015, 0.015, A['brass'], 'metal', 'scale post', 4),
          cyl(-1.45, 0.25, 1.2, 0.14, 0.03, A['brass'], 'metal', 'scale pan', 10)]
    L += [limb((0, 0.05, 2.12), (0, 0.05, 1.85), 0.01, 0.01, A['iron'], 'metal', 'lamp chain', 4)]
    globe_lamp(L, 0, 0.05, 1.72)
    return rec(B1.shift_y(L, 0.55))


def market_cart_recipe():
    """A vendor cart with rounded ends in cream and verdigris on two big spoked wheels, a handle, a tray of produce, and
    a striped parasol with a little solar cell on top."""
    L = []
    bw, bd = 1.5, 0.8
    L += [box(0, 0, 0.5, bw, bd, 0.5, '#F2E2C0', 'panels', 'cart body'),
          box(0, 0, 0.62, bw + 0.04, bd + 0.04, 0.08, VAULT, 'metal', 'cart band')]
    for sx in (-1, 1):
        L += [cyl(sx * bw / 2, 0, 0.5, bd / 2, 0.5, '#F2E2C0', 'panels', 'cart end', 14),
              cyl(sx * bw / 2, 0, 0.62, bd / 2 + 0.02, 0.08, VAULT, 'metal', 'cart band', 14)]
    L += [box(0, 0, 1.0, bw + 0.3, bd + 0.1, 0.06, A['plank'], 'wood', 'tray'),
          box(0, -bd / 2 - 0.05, 1.06, bw + 0.3, 0.04, 0.1, A['dwood'], 'wood', 'tray lip'),
          box(0, bd / 2 + 0.05, 1.06, bw + 0.3, 0.04, 0.1, A['dwood'], 'wood', 'tray lip')]
    rng = np.random.default_rng(77)
    for i in range(16):
        x = -0.75 + (i % 8) * 0.21 + (rng.random() - 0.5) * 0.04
        y = -0.18 if i < 8 else 0.15
        L.append(sphere(x, y, 1.06 + (0.03 if i % 3 == 0 else 0), 0.09, FRUIT[(i * 5) % 6], 'plain', 'produce', 7, 4))
    # wheels on both sides, spoked, with brass hubs
    for sy in (-1, 1):
        y = sy * (bd / 2 + 0.08)
        L += [disc(0.25, y, 0.42, (0, sy, 0), 0.42, 0.06, '#3A3442', 'plain', 'tyre', 20),
              disc(0.25, y + sy * 0.005, 0.42, (0, sy, 0), 0.36, 0.065, A['wood'], 'wood', 'wheel rim', 20),
              disc(0.25, y + sy * 0.01, 0.42, (0, sy, 0), 0.3, 0.07, '#F2E2C0', 'plain', 'wheel face', 20)]
        for k in range(8):
            a = 2 * math.pi * k / 8
            L.append(limb((0.25, y + sy * 0.08, 0.42), (0.25 + math.cos(a) * 0.32, y + sy * 0.08, 0.42 + math.sin(a) * 0.32), 0.02, 0.02, A['dwood'], 'wood', 'spoke', 4))
        L.append(disc(0.25, y + sy * 0.08, 0.42, (0, sy, 0), 0.07, 0.04, A['brass'], 'metal', 'hub', 10))
    for sy in (-1, 1):
        L.append(limb((-bw / 2 - 0.3, sy * 0.3, 0.75), (-bw / 2 - 0.85, sy * 0.3, 0.85), 0.03, 0.03, A['brass'], 'metal', 'handle', 6))
    L += [limb((-bw / 2 - 0.85, -0.3, 0.85), (-bw / 2 - 0.85, 0.3, 0.85), 0.04, 0.04, A['dwood'], 'wood', 'grip', 6),
          limb((-bw / 2 - 0.2, 0, 0.5), (-bw / 2 - 0.3, 0, 0.0), 0.03, 0.03, A['iron'], 'metal', 'stand', 5)]
    # the parasol
    L += [limb((0.55, 0.2, 1.06), (0.55, 0.2, 2.25), 0.025, 0.025, A['brass'], 'metal', 'parasol pole', 6),
          cyl(0.55, 0.2, 2.0, 1.05, 0.38, CORAL, 'stripes', 'parasol', 16, k='cone', r1=0.06),
          cyl(0.55, 0.2, 1.92, 1.06, 0.08, '#FAF0DC', 'cloth', 'parasol fringe', 16),
          cyl(0.55, 0.2, 2.36, 0.1, 0.05, A['brass'], 'metal', 'parasol top', 10),
          cyl(0.55, 0.2, 2.41, 0.12, 0.02, SOLAR, 'solar', 'solar cell', 10)]
    return rec(B1.shift_y(L, 0.5))


def bread_rack_recipe():
    """A baker's rack: dark wood sides, four shelves of round loaves and baguettes, a little striped awning, a price tag."""
    w, d, h = 1.3, 0.5, 1.75
    L = [box(0, d / 2 - 0.02, 0, w, 0.04, h, A['dwood'], 'wood', 'back')]
    for sx in (-1, 1):
        L.append(box(sx * (w / 2 - 0.03), 0, 0, 0.06, d, h, A['dwood'], 'wood', 'side'))
    rng = np.random.default_rng(9)
    for i, z in enumerate((0.15, 0.55, 0.95, 1.35)):
        L.append(box(0, 0, z, w - 0.06, d - 0.04, 0.04, A['plank'], 'wood', 'shelf'))
        if i % 2 == 0:
            for k in range(4):
                x = -0.45 + k * 0.3
                L.append({'k': 'sphere', 'x': r2(x), 'y': r2(-0.05 + (rng.random() - 0.5) * 0.06), 'z': r2(z + 0.04), 'r': 0.12, 'ry': 0.09,
                          'h': 0.14, 'sides': 9, 'rings': 4, 'col': '#C8884A', 'tex': 'plain', 'name': 'loaf'})
                L.append(box(x, -0.05, z + 0.17, 0.12, 0.02, 0.01, '#E8C890', 'plain', 'loaf score'))
        else:
            for k in range(5):
                y = -0.15 + k * 0.07
                L.append(limb((-0.5, y, z + 0.08), (0.5, y + 0.02, z + 0.08), 0.045, 0.04, '#D49A58', 'plain', 'baguette', 7))
    scallop_awning(L, 0, 0.0, h + 0.1, w + 0.2, 0.45, 0.22, (VAULT, '#FAF0DC'), 0.26, both=False)
    L += [box(0.35, -d / 2 - 0.02, 0.62, 0.22, 0.02, 0.12, '#F4F0E8', 'plain', 'price tag'),
          box(0.35, -d / 2 - 0.03, 0.66, 0.14, 0.01, 0.03, CORAL, 'plain', 'price')]
    return rec(B1.shift_y(L, d / 2 + 0.05))


# ---------------------------------------------------------------- the catalogue
FIXED = {'rot': 0, 'lean': 0, 'size': 0}
# the market hall in each town's colours (the old variants: wall, roof and trim), as colour swaps of the model
HALL_SWAPS = [{BRICK: '#E2CFA8', VAULT: '#6A7488'}, {BRICK: '#B88A6C', VAULT: '#9A4A3C'},
              {BRICK: '#A8BCC4', VAULT: '#4A5E8E'}, {BRICK: '#D8B880', VAULT: '#6E8A5C'}]
MADE = {
    'clinic': (clinic_recipe, clinic_fx),
    'sign_clinic': (sign_clinic_recipe, None),
    'market_hall': (market_hall_recipe, market_hall_fx),
    'stall': (stall_recipe, None),
    'market_cart': (market_cart_recipe, None),
    'bread_rack': (bread_rack_recipe, None),
}
BOXES = {'clinic': [4.6, 2.6]}
ROWS = [('market-small', ['bread_rack', 'sign_clinic', 'market_cart', 'stall'], 3.6),
        ('clinic', ['clinic', 'clinic'], 7.0),
        ('market-hall', [('market_hall', 0), ('market_hall', 1), ('market_hall', 2), ('market_hall', 3), ('market_hall', 4)], 8.0)]


def showcase(C):
    rows = [(name, [k if isinstance(k, tuple) else (k, 0) for k in keys], None, gap) for name, keys, gap in ROWS]
    B1.ROWS = rows
    M = B1.test_map(C)
    # the hall's looks: test_map shows each key once, so place its variants by hand
    hall = [p for p in M['props'] if p['k'] == 'market_hall']
    z = hall[0]['z'] if hall else 0
    M['props'] = [p for p in M['props'] if p['k'] != 'market_hall']
    for i in range(5):
        M['props'].append({'k': 'market_hall', 'x': round(M['w'] / 2 + (i - 2) * 8.5, 2), 'z': z} | ({'v': i} if i else {}))
    M['name'] = 'Test: Marigold props in the new style (phase 09)'
    return M


def main():
    D = gamedata.load()
    C = D['scenery']['props']
    for key, (fn, fx) in MADE.items():
        M = C[key]
        old_vars = (M.get('build') or {}).get('variants') or []
        M['model'] = B1.write_recipe(key, fn())
        M['ppm'] = PPM
        if fx: M['fx'] = fx()
        if key in BOXES: M['box'] = BOXES[key]
        if key == 'market_hall':
            M['variants'] = [{'img': V['img'], 'swap': HALL_SWAPS[i]} for i, V in enumerate(old_vars[:4]) if V.get('img')]
        M['vary'] = dict(FIXED)
        for f in ('build', 'layers', 'vol', 'volDepth'):
            M.pop(f, None)
    D['maps']['test_props_marigold'] = showcase(C)
    gamedata.save(D)
    print('made:', ', '.join(MADE))


if __name__ == '__main__':
    main()
