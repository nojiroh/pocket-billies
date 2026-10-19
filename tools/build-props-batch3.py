#!/usr/bin/env python3
"""Phase 09, batch 3: the buildings of Copperleaf Town and Route 1 · Hedgerow Lane in the new style, after Granny
Juniper's cottage (tools/build-props-batch1.py cottage_recipe): fully modelled, slim parts and the small things that
make a place lived in, the building sheet's 32 px materials and the airship's warm palette, in a retro-futuristic
solarpunk village of the Hollow Earth. Only what reads better drawn stays a picture (the lab's window, with the
desk, plant and machines behind the glass). Swapped straight in under their own keys.

  cottage_moss    the moss-roof cottage: a smaller cousin of Juniper's, green round door, porthole, roof window
  cottage_solar   the solar-shingle cottage: a hip roof of solar panels, a coral round door, a little wind turbine
  lab             Professor Hazel's research lab: white panels, teal trim, a big window, a dish, an antenna, solar
                  panels and planters on the roof

    python3 tools/build-props-batch3.py
"""
import importlib.util
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import gamedata  # noqa: E402

spec = importlib.util.spec_from_file_location('batch1', ROOT / 'tools' / 'build-props-batch1.py')
B1 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(B1)
spec2 = importlib.util.spec_from_file_location('batch2', ROOT / 'tools' / 'build-props-batch2.py')
B2 = importlib.util.module_from_spec(spec2)
spec2.loader.exec_module(B2)
PPM, A = B1.PPM, B1.AIR
box, limb, disc, sphere, cyl, img, porthole = B1.box, B1.limb, B1.disc, B1.sphere, B1.cyl, B1.img, B1.porthole
r2 = B1.r2
np = B1.np


# ---------------------------------------------------------------- shared pieces
def frame_box(L, cx, y, z0, w, h, col, t=0.07, depth=0.06, name='frame'):
    """A slim frame round a w x h opening on a front wall at depth y (the wall's face), its foot at z0."""
    L += [box(cx - w / 2, y - depth / 2, z0, t, depth, h, col, 'wood', name),
          box(cx + w / 2, y - depth / 2, z0, t, depth, h, col, 'wood', name),
          box(cx, y - depth / 2, z0 + h - t / 2, w + t, depth, t, col, 'wood', name),
          box(cx, y - depth / 2, z0 - t / 2, w + t, depth, t, col, 'wood', name)]


def round_door(L, dx, fy, base, dr, col, col2, frame_col, n_pl=8, surround=None):
    """A round plank door on a front wall (fy), its foot at base: an optional stone surround, a frame, planks stepped
    to the circle in two tones, iron straps with nails, a brass knob."""
    dcz = base + dr * 0.86
    if surround:
        L.append(disc(dx, fy, dcz, (0, -1, 0), dr + 0.18, 0.03, surround, 'stone', 'door surround', 28))
    L.append(disc(dx, fy, dcz, (0, -1, 0), dr + 0.06, 0.06, frame_col, 'wood', 'door frame', 28))
    pw = 2 * dr / n_pl
    for i in range(n_pl):
        x0 = dx - dr + pw * (i + 0.5)
        hh = math.sqrt(max(0, dr * dr - (abs(x0 - dx) + pw * 0.3) ** 2))
        bot = max(base, dcz - hh)
        L.append(box(x0, fy - 0.075, bot, pw - 0.02, 0.04, dcz + hh - bot, col if i % 2 else col2, 'wood', 'door plank'))
    for hz in (dcz - dr * 0.5, dcz + dr * 0.38):
        L.append(box(dx - 0.12, fy - 0.1, hz, dr * 1.4, 0.02, 0.06, A['iron'], 'metal', 'door strap'))
        L.append(sphere(dx - 0.12 - dr * 0.7, fy - 0.11, hz + 0.03, 0.03, A['iron'], 'metal', 'strap nail', 6, 3))
    L.append(sphere(dx + dr * 0.55, fy - 0.12, dcz - 0.06, 0.05, A['brass'], 'metal', 'door knob', 10, 5))
    return dcz


def wall_lamp(L, lx, fy, z, roof=None):
    """A little lamp on a wall, its glass lit when the lamps come on."""
    L += [limb((lx, fy, z + 0.3), (lx, fy - 0.22, z + 0.3), 0.014, 0.014, A['iron'], 'metal', 'lamp arm', 5),
          cyl(lx, fy - 0.22, z - 0.02, 0.08, 0.035, A['iron'], 'metal', 'lamp base', 8),
          cyl(lx, fy - 0.22, z + 0.27, 0.11, 0.08, roof or A['verd'], 'metal', 'lamp roof', 8, k='cone', r1=0.02),
          img(B1.glass_sprite(), lx, fy - 0.22, z, s=0.45, glow=1, recv=0, sway=0, name='lamp glass')]


def flower_box(L, cx, y, z, w, seed=3):
    rng = np.random.default_rng(seed)
    L.append(box(cx, y - 0.14, z, w, 0.26, 0.22, A['dwood'], 'wood', 'flower box'))
    n = max(3, int(w / 0.13))
    for i in range(n):
        x = cx - w / 2 + 0.05 + (w - 0.1) * i / (n - 1)
        L.append(sphere(x, y - 0.18, z + 0.2, 0.085, '#5E9A48', 'leaves', 'leaves', 7, 3, 0.3))
        if i % 2 == 0:
            L.append(sphere(x + 0.03, y - 0.26, z + 0.26 + rng.random() * 0.04, 0.042,
                            ('#E87EA8', A['lamp'], '#F4F0E8', '#C478D0', '#E86A5A')[i // 2 % 5], 'plain', 'flower', 6, 3))


def potted_plant(L, x, y, pot=A['copper'], leaf='#5E9A48', h=0.5):
    L += [cyl(x, y, 0, 0.17, 0.3, pot, 'metal', 'pot', 12, k='cone', r1=0.21),
          cyl(x, y, 0.28, 0.21, 0.04, A['brass'], 'metal', 'pot rim', 12)]
    for i, (dx_, dy_, dz) in enumerate(((0, 0, 0.0), (-0.1, -0.05, -0.08), (0.1, 0.04, -0.06), (0.02, -0.08, 0.1))):
        L.append(sphere(x + dx_, y + dy_, 0.3 + h * 0.4 + dz, 0.16 - i * 0.015, leaf if i % 2 else '#6EAE52', 'leaves', 'plant', 8, 4, 0.3))


def path_stones(L, x, y0, n=4):
    for i in range(n):
        L.append(cyl(x + (0.25 if i % 2 else -0.1), y0 - 0.45 - i * 0.5, -0.02, 0.22, 0.05, A['stone'], 'stone', 'path stone', 8, ry=0.17))


def moss_tufts(L, on_dome, n, seed):
    rng = np.random.default_rng(seed)
    for i in range(n):
        x, k, sd = (rng.random() - 0.5) * 3.0, 0.15 + rng.random() * 0.7, -1 if i % 3 else 1
        (px, py, pz), _ = on_dome(x, k, sd)
        L.append(sphere(px, py, pz - 0.05, 0.09 + rng.random() * 0.05, '#9CC468' if i % 2 else '#6E9E4C', 'leaves', 'moss tuft', 7, 3, 0.35, h=0.12))
        if i % 3 == 0:
            L.append(sphere(px + 0.04, py - 0.03 * sd, pz + 0.04, 0.032, ('#F4F0E8', '#E8A0C0', A['lamp'])[i % 3], 'plain', 'roof flower', 5, 2))


def base_and_walls(L, w, d, wall_top, wall_col, wall_tex, post_col=A['wood']):
    L += [box(0, 0, 0, w + 0.3, d + 0.3, 0.12, A['stone'], 'stone', 'plinth'),
          box(0, 0, 0.12, w + 0.16, d + 0.16, 0.12, '#BDB9C6', 'stone', 'plinth top'),
          box(0, 0, 0.24, w, d, wall_top - 0.24, wall_col, wall_tex, 'walls')]
    for sx in (-1, 1):
        for sy in (-1, 1):
            L.append(box(sx * (w / 2 - 0.02), sy * (d / 2 - 0.02), 0.24, 0.12, 0.12, wall_top - 0.24, post_col, 'wood', 'corner post'))
    L.append(box(0, 0, wall_top - 0.08, w + 0.12, d + 0.12, 0.1, post_col, 'wood', 'wall plate'))


# ---------------------------------------------------------------- the moss-roof cottage
def cottage_moss_recipe():
    """A smaller cousin of Juniper's cottage: a mossy dome, a green round door, a copper porthole with a flower box,
    a lamp between them, a roof window, a stone chimney with a verdigris hat, a bench and a water butt round the side."""
    w, d, wall_top = 3.3, 2.3, 2.25
    fy = -d / 2
    L = []
    base_and_walls(L, w, d, wall_top, A['cream'], 'plaster')
    rz = wall_top + 0.02
    L += [cyl(0, 0, rz, 2.08, 0.07, A['copper'], 'metal', 'gutter', 32, ry=1.55),
          cyl(0, 0, rz + 0.04, 2.14, 0.24, '#C49E58', 'hay', 'roof edge', 32, k='cone', ry=1.6, r1=1.94)]
    dz, drx, dry, dh = rz + 0.24, 1.96, 1.44, 1.95
    L.append({'k': 'dome', 'x': 0, 'y': 0, 'z': r2(dz), 'r': drx, 'ry': dry, 'h': dh, 'sides': 32, 'rings': 10, 'lump': 0.03,
              'col': '#76AA50', 'tex': 'leaves', 'name': 'mossy roof'})

    def on_dome(x, k, side=-1):
        zz = dz + dh * k
        y = side * dry * math.sqrt(max(0.02, 1 - (x / drx) ** 2 - k * k))
        return (x, y, zz), (x / drx ** 2, y / dry ** 2, (zz - dz) / dh ** 2)

    moss_tufts(L, on_dome, 10, 21)
    (px, py, pz), n = on_dome(0.0, 0.45)
    L.append(sphere(px, py + 0.1, pz - 0.16, 0.4, A['straw'], 'hay', 'dormer hood', 14, 5, h=0.55))
    porthole(L, px, py - 0.1, pz, n, 0.24, 'roof window')
    cx, cy = 1.1, 0.35
    L += [box(cx, cy, dz + 0.7, 0.42, 0.42, 1.5, A['stone'], 'stone', 'chimney'),
          box(cx, cy, dz + 2.2, 0.5, 0.5, 0.06, A['copper'], 'metal', 'chimney rim'),
          cyl(cx, cy, dz + 2.26, 0.36, 0.3, A['copper'], 'metal', 'chimney hat', 8, k='cone', r1=0.03),
          cyl(cx, cy, dz + 2.5, 0.06, 0.06, A['verd'], 'metal', 'hat top', 8)]
    dx, dr = -0.68, 0.62
    round_door(L, dx, fy, 0.24, dr, '#5EA88E', '#4E957C', A['dwood'], 7, surround=A['stone'])
    L += [box(dx, fy - 0.3, 0, 1.3, 0.6, 0.12, A['stone'], 'stone', 'door step'),
          box(dx, fy - 0.24, 0.12, 1.1, 0.42, 0.1, '#BDB9C6', 'stone', 'door step top')]
    path_stones(L, dx, fy)
    wall_lamp(L, 0.22, fy, 1.55)
    porthole(L, 0.85, fy, 1.5, (0, -1, 0), 0.36, 'porthole')
    flower_box(L, 0.85, fy, 0.92, 0.95, 5)
    porthole(L, -w / 2, 0.2, 1.5, (-1, 0, 0), 0.3, 'left porthole')
    porthole(L, 0.5, d / 2, 1.5, (0, 1, 0), 0.32, 'back porthole')
    # round the right side: a bench against the wall and a water butt at the corner
    bx = w / 2 + 0.3
    L += [box(bx, 0.1, 0.42, 0.42, 1.3, 0.06, A['plank'], 'wood', 'bench seat'),
          box(bx + 0.18, 0.1, 0.48, 0.06, 1.3, 0.4, A['plank'], 'wood', 'bench back')]
    for sy in (-0.45, 0.65):
        L.append(box(bx, sy, 0, 0.36, 0.08, 0.42, A['dwood'], 'wood', 'bench leg'))
    L += [cyl(bx + 0.05, fy - 0.2, 0, 0.26, 0.6, A['wood'], 'wood', 'water butt', 14, k='barrel', bulge=0.1),
          cyl(bx + 0.05, fy - 0.2, 0.1, 0.275, 0.035, A['iron'], 'metal', 'butt hoop', 14),
          cyl(bx + 0.05, fy - 0.2, 0.46, 0.275, 0.035, A['iron'], 'metal', 'butt hoop', 14),
          cyl(bx + 0.05, fy - 0.2, 0.57, 0.23, 0.03, '#4E7AA0', 'plain', 'water', 14)]
    potted_plant(L, dx - 0.95, fy - 0.35)
    return {'ppm': PPM, 'cel': 0.6, 'layers': sorted(B1.shift_y(L, d / 2), key=lambda l: l['k'] == 'img')}


def cottage_moss_fx():
    px = lambda m: round(m * PPM)
    return [{'k': 'window', 'x': px(0.85), 'y': -px(1.5)}, {'k': 'window', 'x': 0, 'y': -px(3.4)},
            {'k': 'glow', 'x': px(0.22), 'y': -px(1.6)}, {'k': 'smoke', 'x': px(1.1), 'y': -px(5.35)}]


# ---------------------------------------------------------------- the solar-shingle cottage
def cottage_solar_recipe():
    """Board-and-batten walls in pale green under a hip roof of solar panels with copper trim, a coral round door, a
    porthole and a window with a flower box, a brick chimney, a little wind turbine turning on the ridge, a vine up the
    corner and a rain barrel: the village's solarpunk house."""
    w, d, wall_top = 3.5, 2.2, 2.3
    fy = -d / 2
    L = []
    base_and_walls(L, w, d, wall_top, '#D6E6C8', 'battens')
    # the hip roof: a 4-sided cone turned square to the house, narrowing to a ridge (ry1), solar panels on it
    hw, hd, hh = w / 2 + 0.32, d / 2 + 0.32, 1.35
    rz = wall_top + 0.02
    s2 = math.sqrt(2)
    L += [box(0, 0, rz - 0.02, 2 * hw, 2 * hd, 0.1, A['copper'], 'metal', 'fascia'),
          cyl(0, 0, rz + 0.08, r2(hw * s2), hh, '#3A4C7E', 'solar', 'solar roof', 4, k='cone', ry=r2(hd * s2),
              r1=r2((hw - hd) * s2), ry1=0.02, rot=r2(math.pi / 4)),
          box(0, 0, rz + 0.08 + hh - 0.03, 2 * (hw - hd) + 0.1, 0.12, 0.08, A['copper'], 'metal', 'ridge cap')]
    # the brick chimney on the left, through the roof
    cx, cy = -1.0, 0.3
    L += [box(cx, cy, rz + 0.3, 0.46, 0.46, 2.05, '#C46C54', 'brick', 'chimney'),
          box(cx, cy, rz + 2.35, 0.56, 0.56, 0.1, A['stone'], 'stone', 'chimney cap'),
          cyl(cx, cy, rz + 2.45, 0.08, 0.16, A['iron'], 'metal', 'flue', 8)]
    # a little vertical wind turbine on the ridge, its blades turning
    tx, tz = 0.6, rz + 0.08 + hh
    L.append(limb((tx, 0, tz), (tx, 0, tz + 0.75), 0.025, 0.02, A['iron'], 'metal', 'turbine mast', 6))
    spin = {'axis': 'z', 'x': tx, 'y': 0, 'z': tz + 0.6, 'rps': 0.6}
    for i in range(3):
        a = i * 2 * math.pi / 3
        bx_, by_ = tx + math.cos(a) * 0.2, math.sin(a) * 0.2
        L.append(limb((bx_, by_, tz + 0.42), (bx_, by_, tz + 0.82), 0.035, 0.035, '#F4F0E8', 'cloth', 'turbine blade', 5) | {'spin': dict(spin)})
        L.append(limb((tx, 0, tz + 0.62), (bx_, by_, tz + 0.62), 0.012, 0.012, A['brass'], 'metal', 'blade arm', 4) | {'spin': dict(spin)})
    L.append(sphere(tx, 0, tz + 0.84, 0.04, A['brass'], 'metal', 'turbine cap', 8, 4))
    # the front: a coral round door on the right, a porthole and a window with a flower box on the left, a lamp
    dx, dr = 0.75, 0.6
    round_door(L, dx, fy, 0.24, dr, '#E86A5A', '#D65C4E', A['dwood'], 7)
    L += [box(dx, fy - 0.3, 0, 1.25, 0.6, 0.12, A['stone'], 'stone', 'door step'),
          box(dx, fy - 0.24, 0.12, 1.05, 0.42, 0.1, '#BDB9C6', 'stone', 'door step top')]
    path_stones(L, dx, fy)
    porthole(L, -0.88, fy, 1.95, (0, -1, 0), 0.3, 'porthole')
    wx, wz, ww, wh = -0.88, 1.1, 0.85, 0.6
    L.append(box(wx, fy - 0.02, wz - wh / 2, ww, 0.04, wh, A['glass'], 'plain', 'window glass'))
    frame_box(L, wx, fy - 0.03, wz - wh / 2, ww, wh, '#F4F0E8', 0.06, 0.05, 'window frame')
    L += [box(wx, fy - 0.06, wz - wh / 2, 0.04, 0.04, wh, '#F4F0E8', 'wood', 'mullion'),
          box(wx, fy - 0.06, wz - 0.02, ww, 0.04, 0.04, '#F4F0E8', 'wood', 'mullion')]
    flower_box(L, wx, fy, wz - wh / 2 - 0.3, ww + 0.2, 9)
    wall_lamp(L, -0.2, fy, 1.45, A['copper'])
    porthole(L, w / 2, 0, 1.5, (1, 0, 0), 0.3, 'right porthole')
    porthole(L, -0.6, d / 2, 1.5, (0, 1, 0), 0.3, 'back porthole')
    # a vine climbing the front left corner, and a rain barrel under a copper downpipe at the right
    vx, vy = -w / 2 - 0.05, fy - 0.05
    pts = [[r2(vx + 0.04 * math.sin(i)), r2(vy - 0.03), r2(0.2 + i * 0.3), 0.025] for i in range(8)]
    L.append({'k': 'limb', 'pts': pts, 'sides': 5, 'col': '#5E7A3A', 'tex': 'bark', 'name': 'vine'})
    for i in range(10):
        L.append(sphere(vx + 0.08 * math.sin(i * 1.7), vy - 0.06, 0.35 + i * 0.22, 0.09 + (i % 3) * 0.02, '#5E9A48' if i % 2 else '#6EAE52', 'leaves', 'vine leaves', 7, 3, 0.35))
        if i % 3 == 1:
            L.append(sphere(vx + 0.1, vy - 0.12, 0.4 + i * 0.22, 0.035, '#C478D0', 'plain', 'vine flower', 6, 3))
    bx_, by2 = w / 2 + 0.1, fy - 0.35
    L += [cyl(bx_, by2, 0, 0.27, 0.62, A['wood'], 'wood', 'rain barrel', 14, k='barrel', bulge=0.1),
          cyl(bx_, by2, 0.1, 0.285, 0.035, A['iron'], 'metal', 'barrel hoop', 14),
          cyl(bx_, by2, 0.48, 0.285, 0.035, A['iron'], 'metal', 'barrel hoop', 14),
          cyl(bx_, by2, 0.59, 0.24, 0.03, '#4E7AA0', 'plain', 'barrel water', 14),
          limb((w / 2 - 0.02, fy - 0.05, rz), (w / 2 - 0.02, fy - 0.05, 0.85), 0.04, 0.04, A['copper'], 'metal', 'downpipe', 8),
          limb((w / 2 - 0.02, fy - 0.05, 0.85), (bx_, by2 + 0.05, 0.72), 0.04, 0.04, A['copper'], 'metal', 'downpipe shoe', 8)]
    return {'ppm': PPM, 'cel': 0.6, 'layers': sorted(B1.shift_y(L, d / 2), key=lambda l: l['k'] == 'img')}


def cottage_solar_fx():
    px = lambda m: round(m * PPM)
    return [{'k': 'window', 'x': px(-0.88), 'y': -px(1.1)}, {'k': 'window', 'x': px(-0.88), 'y': -px(1.95)},
            {'k': 'glow', 'x': px(-0.2), 'y': -px(1.55)}, {'k': 'smoke', 'x': px(-1.0), 'y': -px(4.9)}]


# ---------------------------------------------------------------- Professor Hazel's lab
def lab_recipe():
    """White wall panels with a teal band and trim on a lavender plinth, a big window onto the lab (kept drawn: the
    desk, the plant and the machines inside), teal double glass doors under a lamp, and on the flat roof a cooling
    unit, an antenna with a red beacon, a satellite dish, a row of solar panels and planters along the edge."""
    w, d, wall_top = 6.25, 3.0, 3.6
    fy = -d / 2
    TEAL, LAV, WHITE = '#2EA4A0', '#A698CC', '#EAEEEC'
    L = [box(0, 0, 0, w + 0.24, d + 0.24, 0.26, '#9A8CC0', 'brick', 'plinth'),
         box(0, 0, 0.26, w, d, wall_top - 0.26, WHITE, 'panels', 'walls'),
         box(0, 0, 1.2, w + 0.06, d + 0.06, 0.12, TEAL, 'metal', 'teal band')]
    for sx in (-1, 1):
        for sy in (-1, 1):
            L.append(box(sx * (w / 2 - 0.02), sy * (d / 2 - 0.02), 0.26, 0.1, 0.1, wall_top - 0.26, '#D6DADC', 'metal', 'corner trim'))
    # the roof: teal trim, then a lavender checkered edge round the flat roof
    L += [box(0, 0, wall_top, w + 0.3, d + 0.3, 0.16, TEAL, 'metal', 'roof trim'),
          box(0, 0, wall_top + 0.16, w + 0.22, d + 0.22, 0.14, LAV, 'tilewall', 'roof edge'),
          box(0, 0, wall_top + 0.16, w - 0.1, d - 0.1, 0.16, '#C8C2D8', 'plain', 'roof')]
    rt = wall_top + 0.32
    # the cooling unit with its fins
    ux, uy = -1.9, 0.2
    L.append(box(ux, uy, rt, 1.2, 0.8, 0.62, '#E2E2E6', 'metal', 'cooling unit'))
    L.append(box(ux + 0.35, uy - 0.41, rt + 0.06, 0.4, 0.02, 0.5, '#5E6474', 'metal', 'unit grille'))
    for i in range(6):
        L.append(box(ux - 0.45 + i * 0.1, uy - 0.41, rt + 0.1, 0.03, 0.03, 0.42, '#8A90A0', 'metal', 'unit fin'))
    # the antenna and its red beacon (it glows when the lamps are on: a picture of the lantern's glass, tinted)
    ax_ = -0.1
    L += [limb((ax_, 0.4, rt), (ax_, 0.4, rt + 1.7), 0.05, 0.03, '#5E6474', 'metal', 'antenna', 8)]
    for z in (rt + 0.6, rt + 1.0, rt + 1.35):
        L.append(cyl(ax_, 0.4, z, 0.09, 0.04, '#8A90A0', 'metal', 'antenna ring', 10))
    L.append(sphere(ax_, 0.4, rt + 1.7, 0.08, '#E86A5A', 'plain', 'beacon', 10, 5))
    # the satellite dish, tipped up toward the sky, with its feed arm
    dxp, dyp = 1.9, 0.4
    n = (-0.35, -0.55, 0.75)
    L += [box(dxp, dyp, rt, 0.3, 0.3, 0.08, '#8A90A0', 'metal', 'dish foot'),
          limb((dxp, dyp, rt + 0.08), (dxp, dyp, rt + 0.6), 0.05, 0.05, '#8A90A0', 'metal', 'dish post', 8),
          disc(dxp, dyp, rt + 0.85, n, 0.75, 0.06, '#F4F0E8', 'plain', 'dish', 20),
          disc(dxp, dyp, rt + 0.85, n, 0.5, 0.08, '#E2E2E6', 'plain', 'dish centre', 20)]
    nl = math.sqrt(sum(v * v for v in n))
    tip = (dxp + n[0] / nl * 0.55, dyp + n[1] / nl * 0.55, rt + 0.85 + n[2] / nl * 0.55)
    L += [limb((dxp, dyp, rt + 0.85), tip, 0.02, 0.02, '#5E6474', 'metal', 'feed arm', 5),
          sphere(*tip, 0.07, A['lamp'], 'plain', 'feed', 8, 4)]
    # solar panels along the back, raised on little legs, and planters along the front edge
    for i in range(4):
        px_ = -2.4 + i * 1.0
        L.append(box(px_, d / 2 - 0.55, rt + 0.18, 0.9, 0.7, 0.05, '#3A4C7E', 'solar', 'solar panel'))
        for sx in (-0.38, 0.38):
            L.append(box(px_ + sx, d / 2 - 0.55, rt, 0.05, 0.05, 0.18, '#8A90A0', 'metal', 'panel leg'))
    for i, x in enumerate((-2.6, -1.0, 0.7, 2.6)):
        L.append(box(x, fy + 0.35, rt, 0.7, 0.36, 0.26, '#7A5A3C', 'wood', 'roof planter'))
        for j in range(3):
            L.append(sphere(x - 0.22 + j * 0.22, fy + 0.35, rt + 0.3, 0.14, '#5E9A48' if (i + j) % 2 else '#6EAE52', 'leaves', 'roof plant', 8, 4, 0.3))
        if i % 2 == 0:
            L.append(sphere(x + 0.1, fy + 0.25, rt + 0.45, 0.05, ('#E87EA8', A['lamp'])[i // 2], 'plain', 'roof flower', 6, 3))
    # the big window: the drawn view inside, behind a slim white frame with mullions and a sill
    P = 'lab'
    wx0, wy0, wx1, wy1 = 21, 58, 129, 99
    wx, ww = B1.at(P, (wx0 + wx1) / 2, wy1)[0], (wx1 - wx0) / PPM
    wz0, wh = B1.at(P, 0, wy1 - 1)[1], (wy1 - wy0) / PPM
    L.append(img(B1.decal(P, (wx0, wy0, wx1, wy1), 'lab_window'), wx, fy - 0.01, wz0, face='fixed', recv=0, name='window view'))
    frame_box(L, wx, fy - 0.05, wz0, ww, wh, '#F4F4F6', 0.08, 0.08, 'window frame')
    for i in (1, 2, 3):
        L.append(box(wx - ww / 2 + ww * i / 4, fy - 0.08, wz0, 0.05, 0.05, wh, '#F4F4F6', 'metal', 'mullion'))
    L.append(box(wx, fy - 0.08, wz0 + wh * 0.62, ww, 0.05, 0.05, '#F4F4F6', 'metal', 'transom'))
    L.append(box(wx, fy - 0.14, wz0 - 0.1, ww + 0.25, 0.22, 0.08, '#D6DADC', 'metal', 'window sill'))
    # the doors: teal frame, two glass leaves with handles, a lamp above, a step with a mat
    ddx, dw, dh = 1.94, 1.22, 1.75
    L += [box(ddx, fy - 0.06, 0.26, dw + 0.2, 0.1, dh + 0.12, TEAL, 'metal', 'door frame'),
          box(ddx, fy - 0.1, 0.26, dw, 0.04, dh, '#9BD2DA', 'plain', 'door glass'),
          box(ddx, fy - 0.12, 0.26, 0.06, 0.04, dh, TEAL, 'metal', 'door middle')]
    for sx in (-1, 1):
        L += [box(ddx + sx * (dw / 2 - 0.03), fy - 0.12, 0.26, 0.06, 0.04, dh, TEAL, 'metal', 'door edge'),
              box(ddx + sx * 0.1, fy - 0.14, 0.26 + dh * 0.45, 0.03, 0.03, 0.3, '#D6DADC', 'metal', 'door handle')]
    L += [box(ddx, fy - 0.12, 0.26 + dh - 0.04, dw, 0.04, 0.06, TEAL, 'metal', 'door top'),
          box(ddx, fy - 0.12, 2.25, 0.45, 0.12, 0.14, A['lamp'], 'plain', 'door lamp'),
          box(ddx, fy - 0.35, 0, dw + 0.5, 0.7, 0.12, '#BDB9C6', 'stone', 'door step'),
          box(ddx, fy - 0.35, 0.12, dw - 0.1, 0.5, 0.02, '#5E6474', 'cloth', 'door mat')]
    potted_plant(L, ddx - dw / 2 - 0.45, fy - 0.35, TEAL, '#4F8E44', 0.7)
    potted_plant(L, ddx + dw / 2 + 0.45, fy - 0.35, TEAL, '#4F8E44', 0.7)
    # side and back windows: slim white frames with blue glass
    for sx in (-1, 1):
        L.append(box(sx * (w / 2 + 0.01), 0, 1.65, 0.04, 1.2, 0.9, A['glass'], 'plain', 'side window'))
        L.append(box(sx * (w / 2 + 0.02), 0, 1.6, 0.05, 1.3, 0.06, '#F4F4F6', 'metal', 'side sill'))
    for x in (-1.6, 1.6):
        L.append(box(x, d / 2 + 0.01, 1.65, 1.3, 0.04, 0.9, A['glass'], 'plain', 'back window'))
    return {'ppm': PPM, 'cel': 0.6, 'layers': sorted(B1.shift_y(L, d / 2), key=lambda l: l['k'] == 'img')}


def lab_fx():
    px = lambda m: round(m * PPM)
    return [{'k': 'window', 'x': -32, 'y': -px(2.5)}, {'k': 'glow', 'x': 62, 'y': -px(2.3)}]


BUILDINGS = {
    'cottage_moss': (cottage_moss_recipe, cottage_moss_fx, {'x': -22, 'y': 0}),
    'cottage_solar': (cottage_solar_recipe, cottage_solar_fx, {'x': 24, 'y': 0}),
    'lab': (lab_recipe, lab_fx, {'x': 62, 'y': 0}),
}


def main():
    D = gamedata.load()
    C = D['scenery']['props']
    for key, (fn, fx, door) in BUILDINGS.items():
        M = C[key]
        M['model'] = B1.write_recipe(key, fn())
        M['ppm'] = PPM
        M['fx'] = fx()
        M['door'] = door
        M['vary'] = {'rot': 0, 'lean': 0, 'size': 0}
        for f in ('build', 'layers', 'vol'):
            M.pop(f, None)
    B1.ROWS = B1.ROWS + B2.ROWS + [('buildings', [('cottage_moss', 0), ('cottage_solar', 0), ('lab', 0)], None, 8.0)]
    D['maps']['test_props_next'] = B1.test_map(C)
    gamedata.save(D)
    print('buildings:', ', '.join(BUILDINGS))


if __name__ == '__main__':
    main()
