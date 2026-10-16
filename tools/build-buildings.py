#!/usr/bin/env python3
"""3D buildings for the walk scenes (v17).

    python3 tools/build-buildings.py           # writes missing textures, refreshes game/art/scene/build.json
    python3 tools/build-buildings.py --force   # also redraws the textures

The engine builds every house, shop and tower as a small 3D model: the front is the building's own picture (so a
picture you repaint shows up as the front), the side and back walls, the roof at its real pitch with an overhang,
the chimney and the parapet are geometry with tiled pixel textures, and the windows are glass you can look into:
a simple room (back wall with furniture, side walls, floor, ceiling) drawn behind each pane, lit at night.

Writes
  game/art/scene/build/detail.png  surface textures in 5 shade levels (walls 0-7, roofs 8-13, 14-15 trim), 64x64 px each
                                   (2 x 2 m); the game colours them with the building's own colours
  game/art/scene/build/rooms.png   8 rooms x (back wall, side wall, floor, ceiling), 32x32 px each
  game/art/scene/build.json        a 3D plan for each building picture (see PLANS); game data keeps your edits

Plan fields ("build" on a prop in game data; pixel values are from the prop's base point, y negative is up):
  kind    hip | gable (ridge left-right) | gableF (ridge front-back, gable facing you) | flat | shed
  wall    [left, right] where the walls stand in the picture        eave  the picture row where the roof begins
  apex    gableF: the row of the gable's peak                          pitch roof angle in degrees   over  overhang (m)
  wallCol wallTex roofCol roofTex trimCol   colours and texture numbers   floors  storeys (side windows per storey)
  chimney {x, top, w, col}   win [[x, y, w, h], ...] glass panes in the picture   glass  the picture's glass colours
  rooms   which rooms show through the windows
"""
import json, math, random, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'game' / 'art' / 'scene'
OUT = ART / 'build'
PPU = 34


def mix(a, b, t): return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))
def dk(c, k): return tuple(max(0, min(255, int(v * k))) for v in c)
def ramp(b):
    b = tuple(b)
    return [mix(dk(b, .55), (60, 42, 112), .30), mix(dk(b, .79), (96, 74, 152), .17), b, mix(b, (255, 244, 196), .30), mix(b, (255, 252, 234), .60)]
def hx(c): return '#%02X%02X%02X' % tuple(c)
OL = (36, 25, 54)
def olc(c): return mix(dk(c, .45), OL, .80)

P = dict(cream=(246, 230, 190), peach=(248, 214, 178), white=(234, 238, 236), teal=(46, 164, 160), sky=(78, 154, 214), coral=(232, 98, 86),
         lav=(166, 152, 204), glass=(112, 196, 228), lamp=(255, 222, 120), brick=(196, 108, 84), stone=(170, 166, 180), dwood=(132, 84, 60),
         blue=(96, 140, 236), lilac=(178, 136, 226), mint=(126, 212, 172), marble=(208, 204, 214), wood=(178, 118, 72), gold=(244, 192, 60))
R = {k: ramp(v) for k, v in P.items()}

# ------------------------------------------------------------------ surface textures (levels 0..4, stored as grey)
T = 64
def tex_cell(fn, seed):
    rng = random.Random(seed); g = [[2] * T for _ in range(T)]
    fn(g, rng)
    return g

def t_plaster(g, r):
    for _ in range(46):
        x, y = r.randrange(T), r.randrange(T); v = r.choice((1, 3, 3))
        for dx in range(r.randint(1, 3)): g[y][(x + dx) % T] = v
    for _ in range(3):  # hairline crack
        x, y = r.randrange(T), r.randrange(T)
        for k in range(r.randint(3, 7)): g[(y + k) % T][(x + (k // 2) * r.choice((1, -1))) % T] = 1
def t_siding(g, r):
    for y in range(T):
        k = y % 8
        for x in range(T): g[y][x] = 3 if k == 0 else 1 if k == 7 else 0 if k == 6 and x % 32 == 0 else 2
    for _ in range(14): g[r.randrange(T)][r.randrange(T)] = 3
def t_brick(g, r):
    for y in range(T):
        row = y // 5; k = y % 5
        for x in range(T):
            c = (x + (5 if row % 2 else 0)) % 10
            g[y][x] = 4 if k == 4 or c == 0 else 3 if k == 0 else 2
    for row in range(T // 5 + 1):
        for b in range(7):
            if r.random() < .3:
                v = r.choice((1, 3)); x0 = b * 10 + (5 if row % 2 else 0) + 1
                for y in range(row * 5 + 1, min(T, row * 5 + 4)):
                    for x in range(x0, x0 + 9): g[y][x % T] = v if g[y][x % T] == 2 else g[y][x % T]
def t_stone(g, r):
    y = 0
    while y < T:
        h = 8 if (y // 8) % 2 else 10; h = min(h, T - y); x = (y * 7) % 13
        while x < T + 13:
            w = r.randint(12, 20)
            for yy in range(y, y + h):
                for xx in range(x, x + w):
                    v = 0 if yy == y + h - 1 or xx == x + w - 1 else 3 if yy == y or xx == x else 2
                    g[yy][xx % T] = v
            x += w
        y += h
def t_battens(g, r):
    for y in range(T):
        for x in range(T):
            k = x % 10; g[y][x] = 3 if k == 0 else 1 if k in (8, 9) else 2
    for _ in range(20): g[r.randrange(T)][r.randrange(T) // 10 * 10 + r.randint(2, 6)] = 1
def t_panels(g, r):
    for y in range(T):
        for x in range(T):
            g[y][x] = 1 if x % 32 == 31 or y % 32 == 31 else 3 if x % 32 == 0 or y % 32 == 0 else 2
    for _ in range(24): g[r.randrange(T)][r.randrange(T)] = r.choice((1, 3))
def t_corrugated(g, r):
    for y in range(T):
        for x in range(T): g[y][x] = (3, 2, 2, 1)[x % 4]
    for _ in range(5):
        x, y = r.randrange(T), r.randrange(T)
        for k in range(r.randint(2, 6)): g[(y + k) % T][x] = 0
def t_shopfront(g, r):  # tiled lower wall (shops)
    for y in range(T):
        for x in range(T): g[y][x] = 1 if x % 8 == 7 or y % 8 == 7 else 3 if x % 8 == 0 or y % 8 == 0 else 2
def t_tiles(g, r):  # clay tiles: rows of rounded tiles, the slope runs up the texture
    for y in range(T):
        row = y // 8; k = y % 8
        for x in range(T):
            c = (x + (4 if row % 2 else 0)) % 8
            v = 2
            if k == 7: v = 0
            elif k == 6: v = 1
            elif k == 0: v = 3
            if c == 0 and k < 6: v = 1
            elif c in (1, 2) and k < 6: v = min(4, v + 1)
            g[y][x] = v
def t_shingles(g, r):
    for y in range(T):
        row = y // 6; k = y % 6
        off = (row * 5) % 9
        for x in range(T):
            c = (x + off) % 9
            g[y][x] = 0 if k == 5 else 3 if k == 0 else 1 if c == 0 else 2
    for _ in range(12):
        row = r.randrange(T // 6); x = r.randrange(T)
        for yy in range(row * 6 + 1, row * 6 + 5):
            for xx in range(x, x + 4): g[yy][xx % T] = 1 if g[yy][xx % T] == 2 else g[yy][xx % T]
def t_slate(g, r):
    for y in range(T):
        row = y // 5; k = y % 5
        for x in range(T):
            c = (x + (3 if row % 2 else 0)) % 6
            g[y][x] = 0 if k == 4 else 2 if k else 3
            if c == 0 and k < 4: g[y][x] = 1
    for _ in range(30): g[r.randrange(T)][r.randrange(T)] = r.choice((1, 3))
def t_thatch(g, r):
    for y in range(T):
        k = (y + int(2 * math.sin(y * .7))) % 10
        for x in range(T):
            h = (x * 37 + (y // 10) * 11) % 6
            v = 2 + (1 if h == 3 else -1 if h == 0 else 0)
            if k >= 8: v -= 1 + (x % 2)
            elif k == 0: v += 1
            g[y][x] = max(0, min(4, v))
def t_seam(g, r):
    for y in range(T):
        for x in range(T):
            k = x % 12; g[y][x] = 4 if k == 0 else 3 if k == 1 else 1 if k == 11 else 2
def t_tar(g, r):
    for y in range(T):
        for x in range(T): g[y][x] = 2
    for _ in range(420): g[r.randrange(T)][r.randrange(T)] = r.choice((1, 1, 3, 0))
    for y in range(T):
        g[y][31] = 1; g[31][y] = 1
def t_planks(g, r):
    for y in range(T):
        for x in range(T):
            k = y % 8; g[y][x] = 3 if k == 0 else 0 if k == 7 else 2
        if y % 8 == 3:
            for x in range(r.randrange(8), T, 24): g[y][x] = 1
def t_trim(g, r):
    for _ in range(30): g[r.randrange(T)][r.randrange(T)] = r.choice((1, 3))

DETAIL = [t_plaster, t_siding, t_brick, t_stone, t_battens, t_panels, t_corrugated, t_shopfront,
          t_tiles, t_shingles, t_slate, t_thatch, t_seam, t_tar, t_planks, t_trim]
DETAIL_NAMES = ['plaster', 'siding', 'brick', 'stone', 'battens', 'panels', 'corrugated', 'tile wall',
                'clay tiles', 'shingles', 'slate', 'thatch', 'metal seams', 'flat roof', 'planks', 'plain']

def write_detail():
    im = Image.new('RGBA', (T * 8, T * 2))
    for i, fn in enumerate(DETAIL):
        g = tex_cell(fn, 100 + i); ox, oy = (i % 8) * T, (i // 8) * T
        for y in range(T):
            for x in range(T):
                v = g[y][x] * 63
                im.putpixel((ox + x, oy + y), (v, v, v, 255))
    im.save(OUT / 'detail.png', optimize=True)

# ------------------------------------------------------------------ rooms seen through windows
C = 32
ROOMS = ['living room', 'kitchen', 'bedroom', 'shop', 'office', 'clinic', 'lab', 'stairs']

def room_cells(kind, rng):
    wallc = {'living room': (226, 196, 150), 'kitchen': (214, 226, 196), 'bedroom': (196, 206, 236), 'shop': (240, 226, 196),
             'office': (210, 214, 220), 'clinic': (230, 240, 236), 'lab': (214, 230, 236), 'stairs': (200, 188, 170)}[kind]
    Rw = ramp(wallc); Rwood = ramp((160, 108, 70))
    floor = {'kitchen': 'tile', 'clinic': 'tile', 'lab': 'tile', 'office': 'carpet', 'shop': 'tile'}.get(kind, 'wood')
    back = [[Rw[2]] * C for _ in range(C)]
    for y in range(C):
        for x in range(C):
            if (x * 7 + y * 3) % 11 == 0: back[y][x] = Rw[3]
            if y >= C - 3: back[y][x] = Rwood[1] if y == C - 3 else Rwood[0]  # skirting
            if y < 2: back[y][x] = Rw[1]
    side = [row[:] for row in back]
    def rect(g, x0, y0, x1, y1, c):
        for y in range(max(0, y0), min(C, y1 + 1)):
            for x in range(max(0, x0), min(C, x1 + 1)): g[y][x] = c(x, y) if callable(c) else c
    def frame_pic(g, x0, y0, w, h, col):
        rect(g, x0, y0, x0 + w, y0 + h, Rwood[1]); rect(g, x0 + 1, y0 + 1, x0 + w - 1, y0 + h - 1, col)
    if kind == 'living room':
        Rs = ramp(rng.choice([(196, 92, 92), (92, 140, 196), (120, 170, 110)]))
        rect(back, 5, 19, 26, 26, Rs[2]); rect(back, 5, 17, 26, 18, Rs[3]); rect(back, 4, 19, 5, 27, Rs[1]); rect(back, 26, 19, 27, 27, Rs[1])
        rect(back, 7, 21, 15, 22, Rs[3]); rect(back, 17, 21, 24, 22, Rs[3])
        frame_pic(back, 11, 6, 10, 7, (120, 180, 220)); rect(back, 12, 10, 20, 12, (90, 150, 80))
        rect(side, 22, 6, 23, 26, (90, 70, 60)); rect(side, 19, 4, 26, 7, (250, 226, 150))  # standing lamp
        rect(side, 4, 10, 12, 26, Rwood[2]); [rect(side, 5, y, 11, y, Rwood[0]) for y in (14, 18, 22)]
        for y in (13, 17, 21):
            for x in range(5, 11, 2): side[y][x] = rng.choice([(200, 80, 80), (80, 120, 200), (220, 190, 80)])
    elif kind == 'kitchen':
        rect(back, 0, 18, 31, 28, Rwood[2]); rect(back, 0, 18, 31, 18, (220, 220, 210)); [rect(back, x, 20, x, 28, Rwood[0]) for x in (8, 16, 24)]
        rect(back, 0, 4, 31, 11, Rwood[3]); [rect(back, x, 4, x, 11, Rwood[1]) for x in (8, 16, 24)]
        rect(back, 18, 14, 23, 17, (230, 230, 230)); back[15][20] = (90, 90, 90)
        rect(side, 6, 8, 25, 28, (236, 236, 240)); rect(side, 6, 16, 25, 16, (180, 180, 190)); rect(side, 22, 10, 23, 14, (150, 150, 160))
    elif kind == 'bedroom':
        Rb = ramp(rng.choice([(236, 160, 180), (150, 190, 236), (240, 220, 140)]))
        rect(back, 4, 20, 27, 27, (240, 240, 236)); rect(back, 4, 22, 27, 27, Rb[2]); rect(back, 3, 15, 5, 28, Rwood[1]); rect(back, 26, 17, 28, 28, Rwood[1])
        rect(back, 6, 18, 11, 21, (250, 250, 250)); frame_pic(back, 12, 5, 8, 9, (240, 200, 120))
        rect(side, 8, 12, 22, 28, Rwood[2]); rect(side, 15, 12, 15, 28, Rwood[0]); side[20][13] = side[20][17] = (230, 200, 100)
    elif kind == 'shop':
        for sy in (8, 15, 22):
            rect(back, 0, sy, 31, sy, Rwood[1])
            for x in range(1, 31, 3): rect(back, x, sy - rng.randint(2, 5), x + 1, sy - 1, rng.choice([(222, 90, 90), (90, 150, 222), (240, 200, 80), (120, 200, 140), (200, 130, 220)]))
        rect(back, 0, 26, 31, 28, Rwood[2]); rect(side, 4, 18, 27, 28, Rwood[2]); rect(side, 4, 18, 27, 18, Rwood[3]); rect(side, 18, 14, 23, 17, (80, 80, 90))
    elif kind == 'office':
        rect(back, 4, 20, 27, 21, (150, 130, 110)); rect(back, 6, 22, 7, 28, (90, 90, 100)); rect(back, 24, 22, 25, 28, (90, 90, 100))
        rect(back, 9, 13, 16, 19, (50, 56, 70)); rect(back, 10, 14, 15, 18, (110, 200, 230)); rect(back, 19, 17, 23, 19, (240, 240, 240))
        rect(side, 3, 6, 28, 16, (240, 240, 244)); [rect(side, x, 8, x + 4, 9, (90, 140, 200)) for x in (6, 14, 21)]
        rect(side, 20, 19, 25, 28, (120, 90, 70)); rect(side, 21, 14, 24, 18, (80, 150, 80))
    elif kind == 'clinic':
        rect(back, 3, 21, 28, 24, (250, 250, 250)); rect(back, 3, 19, 8, 21, (250, 250, 250)); rect(back, 3, 25, 4, 28, (160, 170, 180)); rect(back, 27, 25, 28, 28, (160, 170, 180))
        rect(back, 14, 5, 18, 13, (220, 70, 80)); rect(back, 12, 7, 20, 11, (220, 70, 80))
        rect(side, 6, 10, 20, 28, (200, 220, 230)); rect(side, 6, 18, 20, 18, (150, 170, 180))
    elif kind == 'lab':
        rect(back, 0, 19, 31, 20, (200, 204, 210)); rect(back, 0, 21, 31, 28, (150, 160, 175))
        for x, c in ((3, (120, 220, 160)), (8, (230, 120, 200)), (13, (120, 180, 240))): rect(back, x, 14, x + 2, 18, c); back[13][x + 1] = (230, 230, 230)
        rect(back, 19, 9, 28, 18, (50, 56, 70)); rect(back, 20, 10, 27, 17, (90, 230, 200))
        rect(side, 5, 4, 26, 28, (180, 190, 200)); [rect(side, 7, y, 24, y + 2, (90, 100, 120)) for y in (7, 13, 19)]
        for y in (8, 14, 20): side[y][9] = (80, 240, 120); side[y][12] = (240, 80, 80)
    elif kind == 'stairs':
        for k in range(8): rect(back, 4 + k * 3, 26 - k * 3, 30, 28 - k * 3, Rwood[2 + (k % 2)])
        rect(side, 0, 14, 31, 14, Rwood[1]); [rect(side, x, 14, x, 28, Rwood[1]) for x in range(2, 31, 5)]
    # floor and ceiling
    flo = [[None] * C for _ in range(C)]
    for y in range(C):
        for x in range(C):
            if floor == 'wood': flo[y][x] = Rwood[3] if y % 6 == 0 else Rwood[1] if (x + (y // 6) * 11) % 16 == 0 else Rwood[2]
            elif floor == 'tile': flo[y][x] = (236, 236, 230) if (x // 8 + y // 8) % 2 else (206, 210, 214)
            else: flo[y][x] = (112, 120, 150) if (x * 3 + y * 5) % 7 else (100, 108, 138)
    if kind == 'living room': rect(flo, 6, 6, 25, 22, (180, 80, 90)); rect(flo, 8, 8, 23, 20, (210, 120, 110))
    ceil = [[mix(wallc, (255, 255, 255), .5)] * C for _ in range(C)]
    for y in range(13, 19):
        for x in range(13, 19): ceil[y][x] = (255, 240, 190)
    return [back, side, flo, ceil]

def write_rooms():
    im = Image.new('RGBA', (C * 4, C * len(ROOMS)))
    for r, kind in enumerate(ROOMS):
        for c, g in enumerate(room_cells(kind, random.Random(500 + r))):
            for y in range(C):
                for x in range(C): im.putpixel((c * C + x, r * C + y), tuple(g[y][x]) + (255,))
    im.save(OUT / 'rooms.png', optimize=True)

# ------------------------------------------------------------------ plans for the building pictures
# base-relative pixels (x from the base point, y up is negative); detected glass panes are added below
PLANS = {
 'house':         dict(kind='hip', wall=[-55, 55], eave=-78, pitch=42, over=.28, wallCol=P['cream'], wallTex=0, roofCol=P['teal'], roofTex=8, trimCol=P['dwood'], chimney=dict(x=28, top=-144, w=.5, col=P['brick'], tex=2), rooms=[0, 1, 2]),
 'house_red':     dict(kind='gableF', wall=[-53, 53], eave=-74, apex=-125, over=.3, wallCol=P['peach'], wallTex=0, roofCol=P['coral'], roofTex=8, trimCol=P['dwood'], chimney=dict(x=32, top=-138, w=.42, col=P['stone'], tex=3), rooms=[0, 2]),
 'house_blue':    dict(kind='hip', wall=[-53, 53], eave=-78, pitch=42, over=.28, wallCol=P['white'], wallTex=0, roofCol=P['blue'], roofTex=9, trimCol=P['dwood'], chimney=dict(x=-29, top=-140, w=.42, col=P['stone'], tex=3), rooms=[1, 0, 2]),
 'house_green':   dict(kind='gableF', wall=[-51, 51], eave=-74, apex=-123, over=.3, wallCol=(224, 212, 238), wallTex=4, roofCol=(108, 178, 98), roofTex=9, trimCol=P['dwood'], chimney=dict(x=-35, top=-132, w=.42, col=P['brick'], tex=2), rooms=[2, 0]),
 'house_large':   dict(kind='hip', wall=[-90, 90], eave=-134, pitch=38, over=.32, wallCol=P['peach'], wallTex=0, roofCol=P['lilac'], roofTex=10, trimCol=P['dwood'], floors=2, chimney=dict(x=55, top=-204, w=.5, col=P['brick'], tex=2), rooms=[0, 1, 2, 7]),
 'house_cottage': dict(kind='hip', wall=[-47, 47], eave=-59, pitch=52, over=.42, wallCol=P['cream'], wallTex=0, roofCol=(214, 172, 94), roofTex=11, trimCol=P['dwood'], chimney=dict(x=25, top=-136, w=.45, col=P['stone'], tex=3), rooms=[0, 1], base=(P['stone'], 3, .65)),
 'shop':          dict(kind='hip', wall=[-62, 62], eave=-123, pitch=34, over=.3, wallCol=P['peach'], wallTex=1, roofCol=P['sky'], roofTex=8, trimCol=P['mint'], rooms=[3]),
 'clinic':        dict(kind='flat', wall=[-66, 66], eave=-124, wallCol=P['white'], wallTex=5, roofCol=P['lav'], roofTex=13, trimCol=P['mint'], floors=2, rooms=[5]),
 'lab':           dict(kind='flat', wall=[-100, 100], eave=-116, wallCol=P['white'], wallTex=5, roofCol=P['lav'], roofTex=13, trimCol=P['teal'], rooms=[6, 4]),
}
GLASS = [c for c in R['glass']] + [c for c in R['lamp']]

def detect_windows(im, ox, oy, plan):
    """glass panes in the part of the picture that stays as the front: same-coloured glass pixels grouped into panes"""
    w, h = im.size; px = im.load(); gs = set(GLASS)
    cut = plan['eave'] - oy  # picture row of the eave
    if plan['kind'] == 'gableF': cut = plan['apex'] - oy
    seen = set(); boxes = []
    for y in range(max(0, cut), h):
        for x in range(w):
            if (x, y) in seen: continue
            c = px[x, y]
            if c[3] < 128 or c[:3] not in gs: continue
            st = [(x, y)]; seen.add((x, y)); x0 = x1 = x; y0 = y1 = y; n = 0
            while st:
                a, b = st.pop(); n += 1; x0, x1, y0, y1 = min(x0, a), max(x1, a), min(y0, b), max(y1, b)
                for da, db in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    q = (a + da, b + db)
                    if 0 <= q[0] < w and cut <= q[1] < h and q not in seen and px[q][3] >= 128 and px[q][:3] in gs:
                        seen.add(q); st.append(q)
            boxes.append([x0, y0, x1, y1, n])
    # panes of one window (split by the cross) join up; tiny bits (door glass, lamps) are dropped
    merged = True
    while merged:
        merged = False
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                A, B = boxes[i], boxes[j]
                if A[0] - 3 <= B[2] and B[0] - 3 <= A[2] and A[1] - 3 <= B[3] and B[1] - 3 <= A[3]:
                    boxes[i] = [min(A[0], B[0]), min(A[1], B[1]), max(A[2], B[2]), max(A[3], B[3]), A[4] + B[4]]; del boxes[j]; merged = True; break
            if merged: break
    out = []
    for x0, y0, x1, y1, n in boxes:
        if x1 - x0 < 9 or y1 - y0 < 9 or n < 50: continue
        out.append([x0 + ox, y0 + oy, x1 - x0 + 1, y1 - y0 + 1])
    return sorted(out, key=lambda r: (r[1], r[0]))

def plan_json(k, plan, meta):
    im = Image.open(ART / 'props' / f'{k}.png').convert('RGBA')
    d = {f: v for f, v in plan.items()}
    for f in ('wallCol', 'roofCol', 'trimCol'):
        if f in d: d[f] = hx(d[f])
    if 'chimney' in d: d['chimney'] = dict(d['chimney'], col=hx(d['chimney']['col']))
    if 'base' in d: c, t, hgt = d['base']; d['base'] = dict(col=hx(c), tex=t, h=hgt)
    d['win'] = d.get('win') or detect_windows(im, meta['ox'], meta['oy'], plan)
    d['glass'] = [hx(c) for c in GLASS]
    d['roofRamp'] = [hx(c) for c in ramp(plan['roofCol'])]
    d.setdefault('floors', 1); d.setdefault('over', .25); d.setdefault('pitch', 40); d.setdefault('sideWin', True)
    return d

def main():
    force = '--force' in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    if force or not (OUT / 'detail.png').exists(): write_detail()
    if force or not (OUT / 'rooms.png').exists(): write_rooms()
    meta = json.loads((ART / 'props.json').read_text())
    plans = {}
    for k, plan in PLANS.items():
        if k in meta: plans[k] = plan_json(k, plan, meta[k])
    # props drawn with a plan of their own (the v17 city buildings) carry it in props.json as "bld"
    for k, m in meta.items():
        if m.get('bld') and k not in plans:
            b = dict(m['bld'])
            for f in ('wallCol', 'roofCol', 'trimCol'):
                if f in b: b[f] = tuple(int(b[f][i:i + 2], 16) for i in (1, 3, 5)) if isinstance(b[f], str) else tuple(b[f])
            if 'chimney' in b: b['chimney'] = dict(b['chimney'], col=tuple(int(b['chimney']['col'][i:i + 2], 16) for i in (1, 3, 5)) if isinstance(b['chimney']['col'], str) else tuple(b['chimney']['col']))
            if 'base' in b and isinstance(b['base'], dict): b['base'] = (tuple(int(b['base']['col'][i:i + 2], 16) for i in (1, 3, 5)), b['base']['tex'], b['base']['h'])
            plans[k] = plan_json(k, b, m)
    (ART / 'build.json').write_text(json.dumps({'detail': 'scene/build/detail.png', 'rooms': 'scene/build/rooms.png', 'textures': DETAIL_NAMES, 'roomNames': ROOMS, 'plans': plans}, indent=1))
    for k, p in plans.items(): print(f"{k:16s} {p['kind']:6s} windows {len(p['win'])}")

if __name__ == '__main__':
    main()
