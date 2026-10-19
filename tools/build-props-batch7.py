#!/usr/bin/env python3
"""Phase 09, batch 7 (Marigold Town, part 3): the town's buildings, from one kit of house parts, in the style of the
clinic and the market (Unova-style town crossed with retro-futuristic solarpunk): plinths, walls with corner posts,
hip and gable roofs with thick eaves, square windows with crossed frames, sills, shutters and flower boxes, portholes,
round plank doors and panelled doors under little canopies, lamps, chimneys, copper gutters and plants.

  house_cottage house_blue house_green house_red house_large townhouse_red townhouse_yellow bakery greenhouse inn
  library shop

Each keeps its town looks (the old colour variants, as colour swaps of the model) and takes a placement's solarpunk
roof (moss, solar): its roof parts are marked roof: 1.

    python3 tools/build-props-batch7.py      (after batch1 to batch6)
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
B5 = load('batch5', 'build-props-batch5.py')
B6 = load('batch6', 'build-props-batch6.py')
PPM, A = B1.PPM, B1.AIR
box, limb, disc, sphere, cyl, img, porthole = B1.box, B1.limb, B1.disc, B1.sphere, B1.cyl, B1.img, B1.porthole
r2, np = B1.r2, B1.np
S2 = math.sqrt(2)
WHITE, GLASS, DARK, LEAF, LEAF2 = B5.WHITE, '#7EB8D4', B5.DARK, B5.LEAF, B5.LEAF2
px = lambda m: round(m * PPM)
B5.GLYPHS.update({
    'B': ['11110', '11011', '11011', '11110', '11011', '11011', '11110'],
    'Y': ['11011', '11011', '11011', '01110', '00100', '00100', '00100'],
    'S': ['01111', '11000', '11000', '01110', '00011', '00011', '11110'],
    'H': ['11011', '11011', '11011', '11111', '11011', '11011', '11011'],
    'O': ['01110', '11011', '11011', '11011', '11011', '11011', '01110'],
    'P': ['11110', '11011', '11011', '11110', '11000', '11000', '11000'],
})


# ---------------------------------------------------------------- the kit
class House:
    """A building being put together: its size, colours and the parts so far, plus where its windows, lamps and chimney
    are (for the night effects)."""

    def __init__(s, w, d, floors, fh, wall, wtex, trim, roof, rtex, kind, pitch, over=0.3, plinth=A['stone']):
        s.w, s.d, s.floors, s.fh = w, d, floors, fh
        s.wall, s.wtex, s.trim, s.roof, s.rtex, s.kind, s.pitch, s.over = wall, wtex, trim, roof, rtex, kind, pitch, over
        s.fy = -d / 2
        s.top = 0.24 + floors * fh
        s.L, s.wins, s.glows, s.smoke = [], [], [], None
        L = s.L
        L += [box(0, 0, 0, w + 0.3, d + 0.3, 0.12, plinth, 'stone', 'plinth'),
              box(0, 0, 0.12, w + 0.16, d + 0.16, 0.12, '#BDB9C6', 'stone', 'plinth top'),
              box(0, 0, 0.24, w, d, s.top - 0.24, wall, wtex, 'walls')]
        for sx in (-1, 1):
            for sy in (-1, 1):
                L.append(box(sx * (w / 2 - 0.02), sy * (d / 2 - 0.02), 0.24, 0.12, 0.12, s.top - 0.24, trim, 'wood', 'corner post'))
        for f in range(1, floors):
            L.append(box(0, 0, 0.24 + f * fh - 0.05, w + 0.08, d + 0.08, 0.1, trim, 'wood', 'floor band'))
        L.append(box(0, 0, s.top - 0.08, w + 0.12, d + 0.12, 0.1, trim, 'wood', 'wall plate'))
        s.roof_parts()

    def z(s, floor, k=0.5):
        """A height on a floor: 0 is the ground floor, k how far up it (0 to 1)."""
        return 0.24 + floor * s.fh + k * s.fh

    def roof_parts(s):
        L, w, d = s.L, s.w, s.d
        hw, hd = w / 2 + s.over, d / 2 + s.over
        rz = s.top + 0.02
        t = math.tan(math.radians(s.pitch))
        L += [box(0, 0, rz - 0.04, 2 * hw, 2 * hd, 0.1, s.trim, 'wood', 'fascia'),
              box(0, s.fy - s.over + 0.02, rz - 0.1, 2 * hw, 0.08, 0.08, A['copper'], 'metal', 'gutter')]
        if s.kind == 'hip':
            hd2 = min(hd, hw)
            s.rh = hd2 * t
            L.append(cyl(0, 0, rz + 0.06, hw * S2, s.rh, s.roof, s.rtex, 'roof', 4, k='cone', ry=r2(hd * S2),
                         r1=r2(max(0.02, hw - hd) * S2), ry1=0.02, rot=r2(math.pi / 4)) | {'roof': 1})
            s.slope = ('y', hd)
        elif s.kind == 'gable':
            s.rh = hd * t
            L.append(cyl(0, 0, rz + 0.06, hw * S2, s.rh, s.roof, s.rtex, 'roof', 4, k='cone', ry=r2(hd * S2),
                         r1=r2(hw * S2), ry1=0.02, rot=r2(math.pi / 4)) | {'roof': 1})
            s.slope = ('y', hd)
        else:  # gableF: the gable to the front, the ridge running back
            s.rh = hw * t
            L.append(cyl(0, 0, rz + 0.06, hw * S2, s.rh, s.roof, s.rtex, 'roof', 4, k='cone', ry=r2(hd * S2),
                         r1=0.02, ry1=r2(hd * S2), rot=r2(math.pi / 4)) | {'roof': 1})
            a = hw - 0.22
            L.append(cyl(0, -hd - 0.035, rz + 0.12, a * S2, a * t, s.wall, s.wtex, 'gable', 4, k='cone', ry=r2(0.03 * S2),
                         r1=0.02, ry1=r2(0.03 * S2), rot=r2(math.pi / 4)))
            L.append(box(0, -hd - 0.06, rz + 0.08, 2 * a + 0.1, 0.04, 0.06, s.trim, 'wood', 'gable foot'))
            s.slope = ('x', hw)
        s.rz = rz + 0.06
        s.ridge = s.rz + s.rh

    def on_front_slope(s, x, k):
        """A point k of the way up the front of the roof (hip or gable roofs), and the slope's outward normal."""
        hd = s.d / 2 + s.over
        t = math.tan(math.radians(s.pitch))
        return (x, -hd * (1 - k), s.rz + hd * t * k), (0, -t, 1)

    def gable_window(s, kind='port', r=0.26):
        """A window in the front gable (gableF roofs)."""
        hd = s.d / 2 + s.over
        z = s.rz + s.rh * 0.42
        if kind == 'port':
            porthole(s.L, 0, -hd - 0.06, z, (0, -1, 0), r, 'gable window')
        else:
            s.window(0, z - 0.25, 0.45, 0.5, y=-hd - 0.06, box_=False, shutters=None)
        s.wins.append((0, z))

    def dormer(s, x, k=0.45, r=0.22):
        """A round roof window under a little hood, on the front slope."""
        (dx, dy, dz), n = s.on_front_slope(x, k)
        s.L.append(sphere(dx, dy + 0.12, dz - 0.14, r + 0.16, s.roof, s.rtex, 'dormer hood', 12, 5, h=r * 2.2) | {'roof': 1})
        porthole(s.L, dx, dy - 0.08, dz, n, r, 'roof window')
        s.wins.append((dx, dz))

    def window(s, x, z0, ww, wh, y=None, box_=True, shutters=None, frame=WHITE, flowers=True, seed=3, cross=True):
        """A square window, its foot at z0: glass, a slim frame, a crossed mullion, a sill, shutters if a colour is given,
        a flower box under it."""
        L, fy = s.L, (s.fy if y is None else y)
        L.append(box(x, fy - 0.02, z0, ww, 0.04, wh, GLASS, 'plain', 'window glass'))
        B3.frame_box(L, x, fy - 0.03, z0, ww, wh, frame, 0.06, 0.05, 'window frame')
        if cross:
            L += [box(x, fy - 0.06, z0, 0.04, 0.04, wh, frame, 'wood', 'mullion'),
                  box(x, fy - 0.06, z0 + wh * 0.55, ww, 0.04, 0.04, frame, 'wood', 'mullion')]
        L.append(box(x, fy - 0.08, z0 - 0.07, ww + 0.16, 0.14, 0.05, frame, 'wood', 'sill'))
        if shutters:
            for sx in (-1, 1):
                L += [box(x + sx * (ww / 2 + 0.17), fy - 0.04, z0, 0.26, 0.04, wh, shutters, 'wood', 'shutter'),
                      box(x + sx * (ww / 2 + 0.17), fy - 0.065, z0 + wh * 0.3, 0.2, 0.01, 0.03, DARK, 'plain', 'shutter slat')]
        if box_ and flowers:
            B3.flower_box(L, x, fy, z0 - 0.3, ww + 0.12, seed)
        s.wins.append((x, z0 + wh / 2))

    def square_door(s, x, col, dw=0.9, dh=1.85, canopy=True, glass=False):
        """A panelled door with a fanlight, a brass knob, a canopy on brackets, a step."""
        L, fy = s.L, s.fy
        L += [box(x, fy - 0.03, 0.24, dw + 0.16, 0.06, dh + 0.1, s.trim, 'wood', 'door frame'),
              box(x, fy - 0.06, 0.24, dw, 0.04, dh, col, 'wood', 'door')]
        if glass:
            L.append(box(x, fy - 0.085, 0.24 + dh * 0.45, dw * 0.6, 0.01, dh * 0.45, '#A8DCE8', 'plain', 'door glass'))
        else:
            for k in (0.12, 0.55):
                L.append(box(x, fy - 0.085, 0.24 + dh * k, dw * 0.65, 0.02, dh * 0.33, col, 'wood', 'door panel'))
        L += [sphere(x + dw * 0.32, fy - 0.1, 0.24 + dh * 0.48, 0.04, A['brass'], 'metal', 'door knob', 8, 4),
              box(x, fy - 0.05, 0.24 + dh + 0.1, dw, 0.03, 0.2, '#A8DCE8', 'plain', 'fanlight'),
              box(x, fy - 0.4, 0, dw + 0.5, 0.55, 0.12, A['stone'], 'stone', 'door step'),
              box(x, fy - 0.3, 0.12, dw + 0.3, 0.36, 0.1, '#BDB9C6', 'stone', 'door step top')]
        if canopy:
            cz = 0.24 + dh + 0.36
            L += [box(x, fy - 0.3, cz, dw + 0.5, 0.6, 0.08, s.trim, 'wood', 'canopy'),
                  box(x, fy - 0.3, cz + 0.08, dw + 0.4, 0.5, 0.04, A['copper'], 'metal', 'canopy top')]
            for sx in (-1, 1):
                L.append(limb((x + sx * (dw / 2 + 0.15), fy, cz - 0.3), (x + sx * (dw / 2 + 0.15), fy - 0.5, cz), 0.02, 0.02, A['iron'], 'metal', 'canopy bracket', 4))
        B3.path_stones(L, x, fy, 3)

    def round_door(s, x, col, col2, dr=0.55, surround=None):
        L, fy = s.L, s.fy
        B3.round_door(L, x, fy, 0.24, dr, col, col2, s.trim, 7, surround=surround)
        L += [box(x, fy - 0.3, 0, 2 * dr + 0.2, 0.6, 0.12, A['stone'], 'stone', 'door step'),
              box(x, fy - 0.24, 0.12, 2 * dr, 0.42, 0.1, '#BDB9C6', 'stone', 'door step top')]
        B3.path_stones(L, x, fy, 3)

    def lamp(s, x, z=1.45):
        B3.wall_lamp(s.L, x, s.fy, z)
        s.glows.append((x, z + 0.15))

    def chimney(s, x, y, col='#B65A44', tex='brick'):
        top = s.ridge + 0.55
        s.L += [box(x, y, s.top - 0.2, 0.46, 0.46, top - s.top + 0.2, col, tex, 'chimney'),
                box(x, y, top, 0.56, 0.56, 0.08, A['stone'], 'stone', 'chimney cap'),
                cyl(x, y, top + 0.08, 0.09, 0.18, A['copper'], 'metal', 'chimney pot', 8)]
        s.smoke = (x, top + 0.4 + y * 0.5)

    def side_windows(s, z=None, port=True):
        z = z or s.z(0, 0.55)
        for sx in (-1, 1):
            if port: porthole(s.L, sx * s.w / 2, 0.1, z, (sx, 0, 0), 0.26, 'side porthole')
            else: s.L.append(box(sx * (s.w / 2 + 0.01), 0.1, z - 0.3, 0.03, 0.7, 0.6, GLASS, 'plain', 'side window'))
        s.L.append(box(0, s.d / 2 + 0.01, z - 0.3, 0.7, 0.03, 0.6, GLASS, 'plain', 'back window'))

    def done(s, cel=0.62):
        return {'ppm': PPM, 'cel': cel, 'layers': sorted(B1.shift_y(s.L, s.d / 2), key=lambda l: l['k'] == 'img')}

    def fx(s):
        out = [{'k': 'window', 'x': px(x), 'y': -px(z)} for x, z in s.wins]
        out += [{'k': 'glow', 'x': px(x), 'y': -px(z)} for x, z in s.glows]
        if s.smoke: out.append({'k': 'smoke', 'x': px(s.smoke[0]), 'y': -px(s.smoke[1])})
        return out


def potted(L, x, y, col=A['copper']):
    B3.potted_plant(L, x, y, col, LEAF, 0.55)


def rain_barrel(L, x, y):
    L += [cyl(x, y, 0, 0.26, 0.6, A['wood'], 'wood', 'rain barrel', 14, k='barrel', bulge=0.1),
          cyl(x, y, 0.1, 0.27, 0.035, A['iron'], 'metal', 'barrel hoop', 14),
          cyl(x, y, 0.46, 0.27, 0.035, A['iron'], 'metal', 'barrel hoop', 14),
          cyl(x, y, 0.57, 0.22, 0.03, '#4E7AA0', 'plain', 'barrel water', 14)]


def name_board(H, text, x, z, board, letters_col, shade, rim=A['brass'], name='name board'):
    p, lw, lh = B5.letters(text, letters_col, f'{text.lower()}_word', shade)
    H.L += [box(x, H.fy - 0.04, z, lw + 0.3, 0.05, lh + 0.14, board, 'wood', name),
            box(x, H.fy - 0.03, z - 0.03, lw + 0.4, 0.05, lh + 0.2, rim, 'metal', name + ' rim'),
            img(p, x, H.fy - 0.08, z + 0.07, face='fixed', recv=0, shadow=0, sway=0, name='lettering')]


# ---------------------------------------------------------------- the houses
def house_cottage():
    """A thatched cottage: a thick hip roof of straw with a round roof window, cream walls, a round door, a window
    with a flower box, a stone chimney, a rain barrel."""
    H = House(3.0, 2.2, 1, 2.0, '#F6E6BE', 'plaster', '#84543C', '#D6AC5E', 'hay', 'hip', 50, over=0.38)
    H.round_door(0.66, '#A0683C', '#8A5A34', 0.52)
    H.window(-0.68, 0.95, 0.62, 0.62, shutters='#6EAE52', seed=11)
    H.dormer(0.0, 0.42)
    H.chimney(0.85, 0.35, A['stone'], 'stone')
    H.side_windows()
    rain_barrel(H.L, -H.w / 2 - 0.2, H.fy - 0.25)
    potted(H.L, 1.25, H.fy - 0.4)
    return H


def house_blue():
    """A white house under a blue shingle hip roof: a red panelled door with a canopy, a window with a flower box, a
    lamp, a roof window, a chimney."""
    H = House(3.4, 2.2, 1, 2.1, '#EAEEEC', 'plaster', '#84543C', '#608CEC', 'shingles', 'hip', 40)
    H.square_door(-0.72, '#E04848')
    H.window(0.66, 1.0, 0.85, 0.6, seed=4)
    H.lamp(-0.12)
    H.dormer(0.0, 0.45, 0.2)
    H.chimney(-0.95, 0.3)
    H.side_windows()
    potted(H.L, -1.45, H.fy - 0.4)
    return H


def house_green():
    """A lavender board-and-batten house with a green front gable: a round door, a window with green shutters and a
    flower box, a square window in the gable, a chimney."""
    H = House(3.2, 2.2, 1, 2.1, '#E0D4EE', 'battens', '#84543C', '#6CB262', 'shingles', 'gableF', 40)
    H.round_door(-0.68, '#A0683C', '#8A5A34', 0.5)
    H.window(0.72, 1.0, 0.6, 0.6, shutters='#4E9A58', seed=6)
    H.gable_window('square')
    H.chimney(-1.0, 0.35)
    H.side_windows()
    potted(H.L, 1.35, H.fy - 0.4)
    return H


def house_red():
    """A peach house with a red-tiled front gable: a teal round door, a window with a flower box, a lamp, a porthole
    in the gable, a chimney, a bench by the door."""
    H = House(3.3, 2.2, 1, 2.1, '#F8D6B2', 'plaster', '#84543C', '#E86256', 'rooftiles', 'gableF', 40)
    H.round_door(0.56, '#3EA89A', '#36968A', 0.5)
    H.window(-0.8, 1.0, 0.85, 0.6, seed=8)
    H.lamp(-0.06)
    H.gable_window('port')
    H.chimney(1.05, 0.35)
    H.side_windows()
    return H


def house_large():
    """A big two-storey house under a lavender slate hip roof: a teal panelled door with a striped canopy, two windows
    below and three above with flower boxes, two roof windows, a lamp, a chimney, plants either side of the door."""
    H = House(5.4, 3.0, 2, 2.1, '#F8D6B2', 'plaster', '#84543C', '#B288E2', 'slate', 'hip', 36)
    H.square_door(0.0, '#3EA89A', canopy=False)
    B5.scallop_awning(H.L, 0, H.fy, 2.25, 1.4, 0.5, 0.3, (B5.CORAL, '#FAF0DC'), 0.28, both=False, name='door awning')
    for x in (-1.8, 1.8):
        H.window(x, 0.95, 0.8, 0.7, seed=12 + int(x))
    for i, x in enumerate((-1.8, 0.0, 1.8)):
        H.window(x, H.z(1, 0.3), 0.8, 0.7, seed=20 + i)
    for x in (-0.95, 0.95):
        H.dormer(x, 0.4, 0.2)
    H.lamp(0.8)
    H.chimney(1.7, 0.45)
    H.side_windows(port=False)
    for x in (-0.85,):
        potted(H.L, x, H.fy - 0.4)
    return H


def townhouse(wall, wtex, trim, roof):
    """A tall narrow townhouse of three storeys under a steep front gable: a stoop of steps to a panelled door with a
    canopy, two windows a floor with flower boxes, a little iron balcony with plants, a round window in the gable."""
    H = House(3.4, 3.6, 3, 2.35, wall, wtex, trim, roof, 'slate', 'gableF', 46)
    H.square_door(-0.82, '#3EA89A')
    H.window(0.84, 0.9, 0.8, 0.85, seed=31)
    for f in (1, 2):
        for i, x in enumerate((-0.86, 0.84)):
            H.window(x, H.z(f, 0.28), 0.7, 0.95, seed=33 + f * 2 + i, flowers=not (f == 1 and x > 0))
    # the balcony on the first floor, right
    bz = H.z(1, 0.2)
    H.L += [box(0.84, H.fy - 0.3, bz, 1.2, 0.6, 0.08, H.trim, 'wood', 'balcony')]
    for k in range(7):
        H.L.append(limb((0.26 + k * 0.193, H.fy - 0.58, bz + 0.08), (0.26 + k * 0.193, H.fy - 0.58, bz + 0.6), 0.012, 0.012, A['iron'], 'metal', 'balcony rail'))
    H.L.append(limb((0.24, H.fy - 0.58, bz + 0.6), (1.44, H.fy - 0.58, bz + 0.6), 0.02, 0.02, A['iron'], 'metal', 'balcony rail'))
    for x in (0.45, 1.25):
        H.L += [cyl(x, H.fy - 0.35, bz + 0.08, 0.12, 0.2, A['copper'], 'metal', 'balcony pot', 10),
                sphere(x, H.fy - 0.35, bz + 0.26, 0.15, LEAF2, 'leaves', 'balcony plant', 8, 4, 0.3)]
    H.gable_window('port', 0.3)
    H.side_windows(z=H.z(0, 0.55))
    H.L.append(box(0, 0, H.top - 0.02, H.w + 0.2, H.d + 0.2, 0.06, A['copper'], 'metal', 'cornice line'))
    return H


def townhouse_red():
    return townhouse('#C46C54', 'brick', '#EAEEEC', '#465470')


def townhouse_yellow():
    return townhouse('#F6E6BE', 'plaster', '#84543C', '#6CB262')


# ---------------------------------------------------------------- the town's buildings
def bakery():
    """The bakery: a big shop window of loaves under an orange-striped awning, a glazed door, the word BAKERY, two
    windows with flower boxes above, a tall chimney (the ovens) under a terracotta hip roof."""
    H = House(4.0, 2.8, 2, 2.1, '#ECC4A0', 'plaster', '#84543C', '#D6704A', 'rooftiles', 'hip', 36)
    H.square_door(0.94, '#B88A54', canopy=False, glass=True)
    wx, ww = -0.7, 1.9
    H.L += [box(wx, H.fy - 0.02, 0.6, ww, 0.04, 1.2, GLASS, 'plain', 'shop window'),
            box(wx, H.fy - 0.1, 0.5, ww + 0.2, 0.2, 0.1, H.trim, 'wood', 'shop sill')]
    B3.frame_box(H.L, wx, H.fy - 0.03, 0.6, ww, 1.2, H.trim, 0.07, 0.06, 'shop frame')
    for i in range(7):  # the loaves on display
        H.L.append({'k': 'sphere', 'x': r2(wx - 0.75 + i * 0.25), 'y': r2(H.fy - 0.07), 'z': 0.62 + (0.35 if i % 2 else 0), 'r': 0.1, 'ry': 0.05,
                    'h': 0.12, 'sides': 8, 'rings': 3, 'col': '#C8884A', 'tex': 'plain', 'name': 'loaf'})
    H.wins.append((wx, 1.2))
    B5.scallop_awning(H.L, 0, H.fy, 2.2, H.w - 0.2, 0.75, 0.42, ('#F49A3A', '#FAF0DC'), 0.3, both=False)
    name_board(H, 'BAKERY', -0.5, 2.45, '#7A4E34', '#F8E8B0', '#3A2418')
    for i, x in enumerate((-1.2, 1.2)):
        H.window(x, H.z(1, 0.32), 0.75, 0.75, seed=41 + i)
    H.chimney(1.15, 0.6)
    H.smoke = (H.smoke[0], H.smoke[1] + 0.2)
    H.side_windows(port=False)
    potted(H.L, 1.75, H.fy - 0.4)
    return H


def shop():
    """The general store: blue-roofed and peach-sided, a big window of goods under a coral-striped awning, the word
    SHOP, sliding glass doors in a mint frame."""
    H = House(3.8, 2.4, 1, 2.3, '#F8D6B2', 'siding', '#7ED4AC', '#4E9AD6', 'rooftiles', 'hip', 34)
    dx = 0.94
    H.L += [box(dx, H.fy - 0.03, 0.24, 1.15, 0.06, 1.95, '#7ED4AC', 'metal', 'door frame')]
    for sx in (-1, 1):
        H.L += [box(dx + sx * 0.27, H.fy - 0.06, 0.24, 0.5, 0.02, 1.85, '#A8DCE8', 'plain', 'sliding door'),
                box(dx + sx * 0.03, H.fy - 0.08, 0.24, 0.05, 0.03, 1.85, '#3EB489', 'metal', 'door edge')]
    H.L += [box(dx, H.fy - 0.4, 0, 1.6, 0.55, 0.12, A['stone'], 'stone', 'door step'),
            box(dx, H.fy - 0.35, 0.12, 1.0, 0.4, 0.02, '#3EB489', 'cloth', 'mat')]
    wx, ww = -0.7, 1.8
    H.L += [box(wx, H.fy - 0.02, 0.65, ww, 0.04, 1.15, GLASS, 'plain', 'shop window'),
            box(wx, H.fy - 0.1, 0.55, ww + 0.2, 0.2, 0.1, H.trim, 'wood', 'shop sill')]
    B3.frame_box(H.L, wx, H.fy - 0.03, 0.65, ww, 1.15, WHITE, 0.07, 0.06, 'shop frame')
    rng = np.random.default_rng(5)
    for row, z in enumerate((0.7, 1.15)):  # shelves of goods
        H.L.append(box(wx, H.fy - 0.06, z - 0.03, ww - 0.1, 0.04, 0.03, WHITE, 'plain', 'shelf'))
        for i in range(8):
            H.L.append(box(wx - 0.75 + i * 0.21, H.fy - 0.07, z, 0.14, 0.03, 0.18 + rng.random() * 0.1,
                           B5.FRUIT[int(rng.random() * 6)], 'plain', 'goods'))
    H.wins.append((wx, 1.2))
    B5.scallop_awning(H.L, wx, H.fy, 2.1, ww + 0.3, 0.6, 0.36, (B5.CORAL, '#FAF0DC'), 0.28, both=False)
    name_board(H, 'SHOP', dx, 2.2, '#2E6A9A', '#FFFFFF', '#1E3A5A')
    H.chimney(-1.2, 0.4)
    H.smoke = None
    H.side_windows()
    potted(H.L, 1.75, H.fy - 0.4, '#3EB489')
    return H


def inn():
    """The inn: a stone ground floor and a half-timbered upper floor under a slate hip roof, an arched double door
    between two lamps, the inn's hanging sign, windows with flower boxes, a tall chimney."""
    H = House(5.6, 3.4, 2, 2.2, '#E8DEC8', 'plaster', '#60402C', '#545C70', 'slate', 'hip', 38)
    fy = H.fy
    H.L.append(box(0, 0, 0.24, H.w + 0.02, H.d + 0.02, H.fh, '#B4B0C2', 'stone', 'stone floor'))
    # the timber frame of the upper floor
    z0, z1 = H.z(1, 0), H.top - 0.08
    for x in (-2.7, -1.35, 0.0, 1.35, 2.7):
        H.L.append(box(x, fy - 0.02, z0, 0.12, 0.05, z1 - z0, H.trim, 'wood', 'timber'))
    for x0, x1 in ((-2.7, -1.35), (1.35, 2.7)):
        H.L.append(limb((x0, fy - 0.03, z0 + 0.1), (x1, fy - 0.03, z1 - 0.1), 0.04, 0.04, H.trim, 'wood', 'brace', 4))
    H.L.append(box(0, fy - 0.02, H.z(1, 0.5), H.w, 0.05, 0.1, H.trim, 'wood', 'rail'))
    H.round_door(0.0, '#7A4E34', '#6A4430', 0.68, surround='#9C98AC')
    for x in (-0.95, 0.95):
        H.lamp(x, 1.55)
    for x in (-1.95, 1.95):
        H.window(x, 0.9, 0.8, 0.7, seed=50 + int(x))
    for i, x in enumerate((-2.0, 0.0, 2.0)):
        H.window(x, H.z(1, 0.25), 1.1 if x == 0 else 0.75, 0.8, seed=55 + i, frame='#F4EEDC')
    # the hanging sign: INN on a board on an iron bracket
    sx_, sz = 1.35, H.z(1, 0.05)
    H.L += [limb((sx_, fy, sz), (sx_, fy - 0.8, sz), 0.025, 0.025, A['iron'], 'metal', 'sign bracket', 5),
            limb((sx_, fy, sz - 0.35), (sx_, fy - 0.5, sz), 0.015, 0.015, A['iron'], 'metal', 'sign brace', 4)]
    p, lw, lh = B5.letters('INN', '#F8E8B0', 'inn_word', '#3A2418')
    H.L += [box(sx_, fy - 0.55, sz - 0.55, 0.05, 0.6, 0.45, '#7A4E34', 'wood', 'inn sign'),
            box(sx_, fy - 0.55, sz - 0.58, 0.06, 0.66, 0.51, A['brass'], 'metal', 'inn sign rim'),
            img(p, sx_ - 0.04, fy - 0.55, sz - 0.42, face='fixed', recv=0, shadow=0, sway=0.3, name='lettering')]
    H.chimney(-1.85, 0.6, '#9C98AC', 'stone')
    H.side_windows(port=False)
    for x in (-0.95, 0.95):
        potted(H.L, x + (0.35 if x > 0 else -0.35), fy - 0.45)
    return H


def library():
    """The library: red brick with white trim under a slate hip roof, four tall arched windows, a big arched door in
    a stone surround between two stone columns under a little pediment, steps, the word LIBRARY, and a glass lantern
    with a verdigris dome on the roof."""
    H = House(5.4, 3.4, 2, 2.0, '#C46C54', 'brick', '#EAEEEC', '#545C70', 'slate', 'hip', 32)
    fy = H.fy
    for x in (-1.85, -0.95, 0.95, 1.85):
        H.L += [box(x, fy - 0.02, 0.85, 0.5, 0.04, 2.3, GLASS, 'plain', 'tall window'),
                disc(x, fy, 3.15, (0, -1, 0), 0.25, 0.04, GLASS, 'plain', 'window top', 12),
                B5.arc(x, fy - 0.04, 3.15, 0.3, 0, math.pi, 0.05, H.trim, 'stone', 'window arch', 8),
                box(x, fy - 0.06, 0.78, 0.66, 0.12, 0.07, H.trim, 'stone', 'window sill'),
                box(x, fy - 0.05, 0.85, 0.04, 0.04, 2.3, H.trim, 'wood', 'mullion')]
        for z in (1.5, 2.3):
            H.L.append(box(x, fy - 0.05, z, 0.5, 0.04, 0.04, H.trim, 'wood', 'transom'))
        H.wins.append((x, 2.0))
    # the door, its surround, columns and pediment, the steps
    H.L += [box(0, fy - 0.02, 0.24, 1.1, 0.06, 1.6, '#7A4E34', 'wood', 'door'),
            disc(0, fy, 1.84, (0, -1, 0), 0.55, 0.08, '#7A4E34', 'wood', 'door top', 16),
            box(0, fy - 0.1, 0.24, 0.04, 0.02, 2.1, '#5A3A28', 'wood', 'door split'),
            B5.arc(0, fy - 0.08, 1.84, 0.66, 0, math.pi, 0.1, '#DCD2BE', 'stone', 'door arch', 12),
            sphere(0.15, fy - 0.12, 1.15, 0.04, A['brass'], 'metal', 'door ring', 6, 3),
            sphere(-0.15, fy - 0.12, 1.15, 0.04, A['brass'], 'metal', 'door ring', 6, 3)]
    for sx in (-1, 1):
        H.L += [cyl(sx * 0.92, fy - 0.35, 0.36, 0.14, 2.4, '#ECE6DA', 'stone', 'column', 10),
                box(sx * 0.92, fy - 0.35, 0.24, 0.36, 0.36, 0.12, '#DCD2BE', 'stone', 'column base'),
                box(sx * 0.92, fy - 0.35, 2.76, 0.36, 0.36, 0.1, '#DCD2BE', 'stone', 'column top')]
    H.L += [box(0, fy - 0.3, 2.86, 2.3, 0.6, 0.12, '#ECE6DA', 'stone', 'entablature'),
            cyl(0, fy - 0.3, 2.98, 1.15 * S2, 0.5, '#ECE6DA', 'stone', 'pediment', 4, k='cone', ry=r2(0.3 * S2), r1=0.02, ry1=r2(0.3 * S2), rot=r2(math.pi / 4))]
    for i, (w_, d_) in enumerate(((2.6, 1.0), (2.2, 0.75), (1.8, 0.5))):
        H.L.append(box(0, fy - d_ / 2, i * 0.08, w_, d_, 0.08, '#BDB9C6', 'stone', 'step'))
    name_board(H, 'LIBRARY', 0, 3.25, '#2E4A44', '#F8E8B0', '#1A2A26')
    # the roof lantern
    H.L += [box(0, 0, H.ridge - 0.3, 1.2, 0.9, 0.6, '#A8DCE8', 'plain', 'lantern glass'),
            {'k': 'dome', 'x': 0, 'y': 0, 'z': r2(H.ridge + 0.3), 'r': 0.62, 'ry': 0.5, 'h': 0.45, 'sides': 14, 'rings': 4,
             'col': A['verd'], 'tex': 'metal', 'name': 'lantern dome'},
            sphere(0, 0, H.ridge + 0.72, 0.06, A['brass'], 'metal', 'lantern finial', 6, 3)]
    for sx in (-1, 1):
        H.L.append(box(sx * 0.6, 0, H.ridge - 0.3, 0.05, 0.92, 0.6, WHITE, 'metal', 'lantern frame'))
    H.side_windows(port=False)
    for x in (-2.4, 2.4):
        potted(H.L, x, fy - 0.4)
    return H


def greenhouse():
    """The greenhouse: a low brick base, glass walls and a glass gable roof in a slim white frame, glass doors, roof
    vents propped open, planters and climbing plants along the front."""
    w, d = 4.8, 3.0
    fy = -d / 2
    FR, GL_ = '#EAEEEC', '#B0D6E6'
    L = [box(0, 0, 0, w + 0.1, d + 0.1, 0.5, '#B65A44', 'brick', 'base wall'),
         box(0, 0, 0.5, w + 0.14, d + 0.14, 0.06, FR, 'stone', 'base cap'),
         box(0, 0, 0.56, w, d, 1.6, GL_, 'plain', 'glass walls')]
    t = math.tan(math.radians(36))
    hw, hd, rz = w / 2 + 0.05, d / 2 + 0.05, 2.16
    rh = hw * t
    L += [cyl(0, 0, rz, hw * S2, rh, GL_, 'plain', 'glass roof', 4, k='cone', ry=r2(hd * S2), r1=0.02, ry1=r2(hd * S2), rot=r2(math.pi / 4)) | {'roof': 1},
          box(0, 0, rz - 0.05, 2 * hw + 0.04, 2 * hd + 0.04, 0.06, FR, 'metal', 'eave')]
    for x in [-w / 2 + i * w / 8 for i in range(9)]:  # mullions, front and back
        for sy in (-1, 1):
            L.append(box(x, sy * (d / 2 + 0.01), 0.56, 0.05, 0.04, 1.6, FR, 'metal', 'mullion'))
        k = 1 - abs(x) / hw
        L.append(box(x, -hd - 0.02, rz, 0.05, 0.04, rh * k, FR, 'metal', 'gable mullion'))
    for y in [-d / 2 + i * d / 5 for i in range(6)]:  # rafters down both slopes, and the side mullions
        for sx in (-1, 1):
            L.append(limb((sx * hw, y, rz), (0, y, rz + rh), 0.025, 0.025, FR, 'metal', 'rafter', 4))
            L.append(box(sx * (w / 2 + 0.01), y, 0.56, 0.04, 0.05, 1.6, FR, 'metal', 'side mullion'))
    L += [limb((0, -hd, rz + rh), (0, hd, rz + rh), 0.04, 0.04, FR, 'metal', 'ridge', 6),
          box(0, fy - 0.02, 1.35, w, 0.04, 0.05, FR, 'metal', 'transom')]
    # a vent propped open on the left slope
    L += [box(-1.1, 0.3, rz + rh * 0.55, 0.8, 0.6, 0.04, GL_, 'plain', 'vent'),
          limb((-1.1, 0.0, rz + rh * 0.5), (-1.1, 0.0, rz + rh * 0.62), 0.015, 0.015, FR, 'metal', 'vent prop', 4)]
    # glass doors, step, plants inside showing as dark green shapes against the glass, planters and climbers outside
    L += [box(0, fy - 0.04, 0.12, 1.1, 0.06, 1.95, FR, 'metal', 'door frame'),
          box(-0.27, fy - 0.07, 0.15, 0.5, 0.02, 1.85, '#C8E4EE', 'plain', 'door'),
          box(0.27, fy - 0.07, 0.15, 0.5, 0.02, 1.85, '#C8E4EE', 'plain', 'door'),
          box(0, fy - 0.4, 0, 1.5, 0.55, 0.12, A['stone'], 'stone', 'door step')]
    for i, x in enumerate((-2.0, -1.4, -0.8, 0.8, 1.4, 2.0)):
        L.append(sphere(x, fy + 0.18, 0.56, 0.3, '#4E8E48' if i % 2 else '#3E7A40', 'leaves', 'plant inside', 8, 4, 0.3, h=0.7))
        if i % 2 == 0:
            L.append(sphere(x + 0.1, fy - 0.03, 1.0, 0.05, B5.FRUIT[i % 6], 'plain', 'flower inside', 6, 3))
    for x in (-1.6, 1.6):
        L.append(box(x, fy - 0.35, 0, 1.0, 0.36, 0.3, A['dwood'], 'wood', 'planter'))
        B5.B1_leafy(L, x - 0.25, fy - 0.35, 0.28)
        B5.B1_leafy(L, x + 0.25, fy - 0.35, 0.28)
    B3.path_stones(L, 0, fy, 3)
    return {'ppm': PPM, 'cel': 0.6, 'layers': B1.shift_y(L, d / 2)}


# ---------------------------------------------------------------- the catalogue
BUILDINGS = {
    'house_cottage': house_cottage, 'house_blue': house_blue, 'house_green': house_green, 'house_red': house_red,
    'house_large': house_large, 'townhouse_red': townhouse_red, 'townhouse_yellow': townhouse_yellow,
    'bakery': bakery, 'shop': shop, 'inn': inn, 'library': library, 'greenhouse': greenhouse,
}
ROWS = [('marigold-houses', ['house_cottage', 'house_blue', 'house_green', 'house_red'], 5.0),
        ('marigold-big-houses', ['house_large', 'townhouse_red', 'townhouse_yellow'], 7.0),
        ('marigold-town', ['bakery', 'shop', 'greenhouse'], 7.0),
        ('marigold-civic', ['inn', 'library'], 8.0)]


def main():
    D = gamedata.load()
    C = D['scenery']['props']
    for key, fn in BUILDINGS.items():
        M = C[key]
        B = M.get('build') or {}
        out = fn()
        if isinstance(out, House):
            M['model'] = B1.write_recipe(key, out.done())
            M['fx'] = out.fx()
            dx = 0
            for L in out.L:
                if L.get('name') in ('door frame', 'door plank', 'door'):
                    dx = L['x']
                    break
        else:
            M['model'] = B1.write_recipe(key, out)
            dx = 0
        M['ppm'] = PPM
        M['door'] = {'x': px(dx), 'y': 0}
        # the town looks: the old variants' wall, roof and trim colours as swaps of the model's
        base = {f: B.get(f) for f in ('wallCol', 'roofCol', 'trimCol')}
        vs = []
        for V in B.get('variants') or []:
            sw = {base[f]: V[f] for f in ('wallCol', 'roofCol', 'trimCol') if base.get(f) and V.get(f) and V[f] != base[f]}
            vs.append({k: v for k, v in (('img', V.get('img')), ('swap', sw)) if v})
        if vs: M['variants'] = vs
        else: M.pop('variants', None)
        M['vary'] = {'rot': 0, 'lean': 0, 'size': 0}
        for f in ('build', 'layers', 'vol', 'volDepth'):
            M.pop(f, None)
    B5.ROWS = B5.ROWS + B6.ROWS + ROWS
    D['maps']['test_props_marigold'] = B5.showcase(C)
    gamedata.save(D)
    print('marigold buildings:', ', '.join(BUILDINGS))


if __name__ == '__main__':
    main()
