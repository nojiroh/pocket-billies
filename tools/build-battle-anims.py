#!/usr/bin/env python3
"""VFX track VFX-10: the battle's effect art, drawn as grayscale pixel strips (docs/phases/vfx-track.md, "The effect art").

Every sprite is a row of frames side by side in 8 greys (GREYS: index 0 the darkest, 7 pure white, the core); a type's
ramp (battleAnims.json `ramps`) colours them in the game, so one strip serves every type. Small things come from
character grids, the rest are drawn procedurally (rings, explosions, smoke), and their fades are erosion: a hard step
against a 4x4 Bayer pattern (the same one walk/battle-fx.js uses), frame by frame, with a bright rim on the edge that
is eroding. Modelled on tools/build-fx-v47.py (strips from character grids); the drawing helpers are this tool's own.

    python3 tools/build-battle-anims.py            draws the strips that are missing (game/art/battle/anims/<id>.png)
    python3 tools/build-battle-anims.py --force    draws every strip again (over any repaint made in the Studio)
    python3 tools/build-battle-anims.py --only=spark,orb   with --force: just those
    python3 tools/build-battle-anims.py --check    checks the strips against battleAnims.json `sprites` (sizes,
                                                   frames, the 8 greys, no strip without data or data without strip)
    python3 tools/build-battle-anims.py --sheet    a contact sheet of every sprite through every ramp
                                                   (validation/build-battle-anims/sheet.png)
    python3 tools/build-battle-anims.py --data     prints the `sprites` entries this tool draws (to paste into the data)

The data is the game's truth (the Studio edits it): this tool's table only says how to draw a strip the first time.
"""
import json, math, random, sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'game' / 'art' / 'battle' / 'anims'
DATA = ROOT / 'game' / 'data' / 'battleAnims.json'
SHEET = ROOT / 'validation' / 'build-battle-anims'

# the 8 greys: index 7 is pure white, the core that every ramp keeps white
GREYS = (36, 64, 96, 128, 160, 192, 224, 255)
BAYER = (0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5)


def bayer(x, y):
    return (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16


# ---------- a frame: a grid of grey indices, -1 empty ----------
class Frame:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.p = [[-1] * w for _ in range(h)]

    def get(self, x, y):
        return self.p[y][x] if 0 <= x < self.w and 0 <= y < self.h else -1

    def put(self, x, y, v):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h:
            self.p[y][x] = max(-1, min(7, v))

    def lift(self, x, y, v):
        """put v only where it is brighter than what is there"""
        if v > self.get(int(x), int(y)):
            self.put(x, y, v)

    def copy(self):
        f = Frame(self.w, self.h)
        f.p = [r[:] for r in self.p]
        return f

    def count(self):
        return sum(1 for r in self.p for v in r if v >= 0)


def grid(rows):
    """a frame from a character grid: '.' empty, '0'-'7' a grey index"""
    f = Frame(len(rows[0]), len(rows))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch.isdigit():
                f.p[y][x] = int(ch)
    return f


def from_mask(img, w, h):
    """a frame from a PIL 'L' image whose pixel is 0 (empty) or 1 + the grey index"""
    f = Frame(w, h)
    px = img.load()
    for y in range(h):
        for x in range(w):
            if px[x, y]:
                f.p[y][x] = min(7, px[x, y] - 1)
    return f


def canvas(w, h):
    img = Image.new('L', (w, h), 0)
    return img, ImageDraw.Draw(img)


def g(v):
    """a grey index as a mask value"""
    return v + 1


# ---------- frame transforms ----------
def erode(f, a, rim=True, ox=0, oy=0):
    """keep a pixel only where the Bayer pattern is under a (the share still shown), as the game's shader does; the
    kept pixels next to an eroded one, close above the threshold, get a bright rim"""
    if a >= 1:
        return f.copy()
    o = f.copy()
    for y in range(f.h):
        for x in range(f.w):
            if f.p[y][x] >= 0 and bayer(x + ox, y + oy) >= a:
                o.p[y][x] = -1
    if rim:
        for y in range(f.h):
            for x in range(f.w):
                v = o.p[y][x]
                if v < 0 or bayer(x + ox, y + oy) < a - 0.25:
                    continue
                if any(f.get(x + dx, y + dy) >= 0 and o.get(x + dx, y + dy) < 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    o.p[y][x] = min(7, max(v + 2, 6))
    return o


def dim(f, n=1, floor=0):
    o = f.copy()
    for r in o.p:
        for i, v in enumerate(r):
            if v >= 0:
                r[i] = max(floor, v - n)
    return o


def shift(f, dx, dy):
    o = Frame(f.w, f.h)
    for y in range(f.h):
        for x in range(f.w):
            if f.p[y][x] >= 0:
                o.put(x + dx, y + dy, f.p[y][x])
    return o


def flip_x(f):
    o = Frame(f.w, f.h)
    o.p = [r[::-1] for r in f.p]
    return o


def flip_y(f):
    o = Frame(f.w, f.h)
    o.p = [r[:] for r in f.p[::-1]]
    return o


def rot90(f):
    """a quarter turn clockwise (square frames)"""
    o = Frame(f.h, f.w)
    for y in range(f.h):
        for x in range(f.w):
            o.p[x][f.h - 1 - y] = f.p[y][x]
    return o


def over(a, b):
    """b drawn over a"""
    o = a.copy()
    for y in range(b.h):
        for x in range(b.w):
            if b.p[y][x] >= 0:
                o.p[y][x] = b.p[y][x]
    return o


def fade_frames(f, n, start=0.0, rim=True):
    """n frames eroding from f: the first whole (or start eroded), the last nearly gone"""
    return [erode(f, 1 - (start + (1 - start) * i / n), rim) for i in range(n)]


# ---------- shapes ----------
def disc(w, h, cx, cy, r, ramp=(7, 6, 5, 4, 3), ry=None):
    """a shaded disc: white at the middle, darker toward the edge, lit from the top left"""
    f = Frame(w, h)
    ry = ry or r
    for y in range(h):
        for x in range(w):
            dx, dy = (x + 0.5 - cx) / r, (y + 0.5 - cy) / ry
            d = dx * dx + dy * dy
            if d > 1:
                continue
            l = math.sqrt(d) + 0.25 * (dx + dy)
            k = min(len(ramp) - 1, max(0, int(l * len(ramp) * 0.85)))
            f.p[y][x] = ramp[k]
    return f


def ring(w, h, cx, cy, r, th, v=6, inner=7, ry=None):
    """a ring r across and th wide, its inner edge brightest"""
    f = Frame(w, h)
    ry = ry or r
    for y in range(h):
        for x in range(w):
            d = math.hypot((x + 0.5 - cx) / r, (y + 0.5 - cy) / ry) * r
            if r - th <= d <= r:
                f.p[y][x] = inner if d < r - th + 1 else v if d < r - 0.5 else max(0, v - 2)
    return f


def star4(w, h, cx, cy, arm, diag=0, core=7, edge=5):
    """a four-pointed sparkle: arms of length arm, with optional short diagonals"""
    f = Frame(w, h)
    f.put(cx, cy, core)
    for i in range(1, arm + 1):
        v = core if i == 1 else max(edge - (i - 2), 2)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            f.put(cx + dx * i, cy + dy * i, v)
    for i in range(1, diag + 1):
        for dx, dy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
            f.put(cx + dx * i, cy + dy * i, edge - i)
    return f


def noise_blob(w, h, cx, cy, r, rng, bump=0.25, ramp=(7, 6, 5, 4, 3, 2), ry=None, holes=0.0):
    """a lumpy blob (smoke, explosions, puddles): a disc whose edge wobbles"""
    f = Frame(w, h)
    ry = ry or r
    waves = [(rng.uniform(0, 6.3), rng.randint(3, 7), rng.uniform(0.3, 1)) for _ in range(3)]
    for y in range(h):
        for x in range(w):
            dx, dy = (x + 0.5 - cx) / r, (y + 0.5 - cy) / ry
            a = math.atan2(dy, dx)
            edge = 1 + bump * sum(s * math.sin(k * a + p) for p, k, s in waves) / 2
            d = math.sqrt(dx * dx + dy * dy) / edge
            if d > 1:
                continue
            if holes and d > 0.4 and rng.random() < holes:
                continue
            l = d + 0.3 * (dx + dy) / max(1e-3, edge)
            k = min(len(ramp) - 1, max(0, int(l * len(ramp) * 0.8)))
            f.p[y][x] = ramp[k]
    return f


def line(f, x0, y0, x1, y1, v, lift=False):
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    for i in range(n + 1):
        t = i / max(1, n)
        x, y = round(x0 + (x1 - x0) * t), round(y0 + (y1 - y0) * t)
        (f.lift if lift else f.put)(x, y, v)


# ---------- the sprites ----------
# Each returns its frames; the table below says its cell, anchor, speed and kind.

def spark():
    return [star4(8, 8, 3, 3, 3, 1), star4(8, 8, 3, 3, 3), star4(8, 8, 3, 3, 2), erode(star4(8, 8, 3, 3, 1), 0.6)]


def ember():
    f0 = grid(['...4....',
               '...5....',
               '..565...',
               '..676...',
               '.46775..',
               '.36774..',
               '..365...',
               '...3....'])
    f1 = grid(['....4...',
               '...45...',
               '...56...',
               '..5765..',
               '.467753.',
               '.36774..',
               '..365...',
               '...3....'])
    return [f0, f1, erode(shift(f0, 0, -1), 0.7), erode(shift(f1, 0, -2), 0.4)]


def droplet():
    f0 = grid(['...5....',
               '...6....',
               '..576...',
               '..5764..',
               '.47763..',
               '.46653..',
               '..443...',
               '........'])
    f1 = grid(['........',
               '...5....',
               '..576...',
               '.57764..',
               '.46663..',
               '..443...',
               '........',
               '........'])
    splat = grid(['........',
                  '........',
                  '........',
                  '.5....5.',
                  '..6..6..',
                  '4.5765.4',
                  '.354453.',
                  '........'])
    return [f0, f1, splat, erode(splat, 0.45)]


def chip():
    f0 = grid(['........',
               '..56....',
               '.5774...',
               '.46653..',
               '..4543..',
               '...33...',
               '........',
               '........'])
    return [f0, rot90(f0), flip_x(flip_y(f0)), erode(rot90(flip_x(flip_y(f0))), 0.5)]


def star():
    f0 = grid(['...6....',
               '...7....',
               '5677765.',
               '.4777...',
               '..676...',
               '.56.65..',
               '.4...4..',
               '........'])
    f1 = dim(f0, 1, 2)
    f1.put(3, 3, 7)
    return [f0, f1, f0, erode(f1, 0.55)]


def chevron():
    f0 = grid(['...7....',
               '..767...',
               '.76.67..',
               '76...67.',
               '...6....',
               '..656...',
               '.54.45..',
               '54...45.'])
    return [shift(f0, 0, 1), f0, erode(shift(f0, 0, -1), 0.7), erode(shift(f0, 0, -2), 0.35)]


def bubble():
    def b(r, cx=3.5, cy=3.5):
        f = ring(8, 8, cx + 0.5, cy + 0.5, r, 1, 5, 5)
        f.put(int(cx - r * 0.4), int(cy - r * 0.4), 7)
        return f
    pop = Frame(8, 8)
    for x, y in ((1, 1), (6, 1), (1, 6), (6, 6), (3, 0), (0, 4), (7, 3), (4, 7)):
        pop.put(x, y, 6)
    return [b(2.6), b(3.2), b(3.9), pop]


def leaf():
    f0 = grid(['......5.',
               '....566.',
               '...5676.',
               '..56764.',
               '.46763..',
               '.4664...',
               '.43.....',
               '3.......'])
    return [f0, flip_x(f0), flip_y(flip_x(f0)), erode(flip_y(f0), 0.5)]


def petal():
    f0 = grid(['........',
               '...56...',
               '..5776..',
               '..67764.',
               '.46664..',
               '..444...',
               '...3....',
               '........'])
    return [f0, rot90(f0), rot90(rot90(f0)), erode(rot90(rot90(rot90(f0))), 0.5)]


def feather():
    f0 = grid(['.......5',
               '.....566',
               '....5676',
               '...5674.',
               '..5674..',
               '.4564...',
               '.344....',
               '3.......'])
    f1 = grid(['........',
               '......56',
               '....5676',
               '..56774.',
               '.456764.',
               '.3454...',
               '.3......',
               '3.......'])
    return [f0, f1, f0, erode(f1, 0.5)]


def pebble():
    f0 = grid(['........',
               '..566...',
               '.56774..',
               '.567543.',
               '.455433.',
               '..3432..',
               '...22...',
               '........'])
    return [f0, rot90(f0), rot90(rot90(f0)), rot90(rot90(rot90(f0)))]


def shard(rows):
    def make():
        f0 = grid(rows)
        f1 = f0.copy()
        for y in range(8):
            for x in range(8):
                if f1.p[y][x] >= 0 and x + y in (5, 6):
                    f1.p[y][x] = 7
        return [f0, f1, f0, erode(f0, 0.5)]
    return make


SHARD_A = ['.....6..',
           '....676.',
           '...5764.',
           '..5763..',
           '.4663...',
           '.453....',
           '.43.....',
           '........']
SHARD_B = ['........',
           '..6.....',
           '.6765...',
           '.47765..',
           '..4664..',
           '...4553.',
           '....33..',
           '........']
SHARD_C = ['...6....',
           '...76...',
           '..5764..',
           '..5763..',
           '..4663..',
           '...453..',
           '...43...',
           '...3....']


def note():
    f0 = grid(['....76..',
               '....7.6.',
               '....7..5',
               '....7...',
               '....7...',
               '.567....',
               '.4774...',
               '..44....'])
    return [shift(f0, 0, 1), f0, shift(f0, 0, -1), erode(shift(f0, 0, -2), 0.45)]


def zz():
    big = grid(['.777777.',
                '.66667..',
                '....76..',
                '...76...',
                '..76....',
                '.76.....',
                '.777777.',
                '........'])
    small = grid(['........',
                  '........',
                  '..7777..',
                  '....6...',
                  '...6....',
                  '..7777..',
                  '........',
                  '........'])
    return [small, big, shift(big, 0, -1), erode(shift(big, 0, -1), 0.45)]


def plus():
    def p(arm, v):
        f = Frame(8, 8)
        for i in range(-arm, arm + 1):
            f.put(3 + i, 3, v if abs(i) < arm else v - 1)
            f.put(3, 3 + i, v if abs(i) < arm else v - 1)
            f.put(4 + i, 3, max(2, v - 2) if abs(i) < arm else -1)
            f.put(3, 4 + i, max(2, v - 2) if abs(i) < arm else -1)
        f.put(3, 3, 7)
        return f
    return [p(1, 6), p(2, 7), p(3, 6), erode(p(3, 6), 0.5)]


def coin():
    def c(rx):
        f = Frame(8, 8)
        for y in range(8):
            for x in range(8):
                dx, dy = (x + 0.5 - 4) / max(0.6, rx), (y + 0.5 - 4) / 3.6
                d = dx * dx + dy * dy
                if d <= 1:
                    f.p[y][x] = 7 if (d < 0.25 and rx > 2) else 4 if d > 0.6 and dx > 0 else 6 if dx < 0 else 5
        return f
    return [c(3.6), c(2.4), c(0.8), c(2.4)]


def paper():
    """the Bureau's form: square, its lines as grey rows (no words), flipping as it flies"""
    f0 = grid(['777776..',
               '7666666.',
               '744446..',
               '766666..',
               '744456..',
               '766666..',
               '655554..',
               '........'])
    f1 = grid(['........',
               '77777776',
               '74444446',
               '66666665',
               '54444445',
               '........',
               '........',
               '........'])
    f2 = grid(['........',
               '........',
               '........',
               '66666666',
               '55555554',
               '........',
               '........',
               '........'])
    return [f0, f1, f2, f1]


def bolt():
    f0 = grid(['....56..',
               '...576..',
               '...76...',
               '..576...',
               '.5776...',
               '.677765.',
               '...776..',
               '...76...',
               '..576...',
               '..76....',
               '.576....',
               '.7765...',
               '..776...',
               '..675...',
               '...6....',
               '...4....'])
    f1 = dim(f0, 2, 3)
    for y in range(16):
        for x in range(8):
            if f0.p[y][x] == 7:
                f1.p[y][x] = 7
    return [f0, f1, f0, erode(f1, 0.4)]


# 16 px
def burst():
    """an impact: a white flash, a star of rays, then the rays eroding"""
    fr = []
    for i, (r, arm) in enumerate(((3, 4), (5, 7), (6, 7), (7, 7), (7, 7))):
        f = disc(16, 16, 8, 8, r * 0.55, (7, 7, 6, 5))
        for k in range(8):
            a = k * math.pi / 4
            L = arm if k % 2 == 0 else arm * 0.6
            line(f, 8 + math.cos(a) * r * 0.5, 8 + math.sin(a) * r * 0.5, 8 + math.cos(a) * L, 8 + math.sin(a) * L, 6 if k % 2 == 0 else 5, True)
        if i >= 2:
            f = erode(dim(f, i - 2, 2), 1 - (i - 1) * 0.28)
        fr.append(f)
    return fr


def hit_spark():
    """sharp lines out of the hit point, longer each frame, then gone"""
    rng = random.Random(7)
    dirs = [(rng.uniform(0, 6.3), rng.uniform(0.6, 1)) for _ in range(7)]
    fr = []
    for i in range(4):
        f = Frame(16, 16)
        f.put(8, 8, 7)
        for a, s in dirs:
            r0, r1 = 1 + i * 2.2 * s, 3 + i * 2.2 * s + 2
            line(f, 8 + math.cos(a) * r0, 8 + math.sin(a) * r0, 8 + math.cos(a) * r1, 8 + math.sin(a) * r1, 7 if i < 2 else 5)
        fr.append(f if i < 3 else erode(f, 0.5))
    return fr


def splash_crown():
    fr = []
    for i, h in enumerate((3, 6, 8, 8, 7)):
        f = Frame(16, 16)
        base = 13
        for x in range(2, 14):
            d = abs(x - 7.5) / 6
            top = base - int(h * (0.4 + 0.6 * d))
            for y in range(top, base + 1):
                v = 7 if y == top else 6 if y < top + 2 else 4 if (x + y) % 3 else 5
                if d < 0.45 and y < base - 1:
                    continue
                f.put(x, y, v)
        for k, x in enumerate((1, 4, 11, 14)):
            if i >= 1:
                f.put(x, base - h - 1 - (k % 2), 6)
        for x in range(1, 15):
            f.put(x, base + 1, 4)
        fr.append(f if i < 3 else erode(f, 1 - (i - 2) * 0.35))
    return fr


def smoke():
    rng = random.Random(11)
    fr = []
    for i in range(6):
        b = noise_blob(16, 16, 8, 9 - i * 0.6, 3 + i * 0.9, random.Random(11 + i // 2), 0.3, (5, 4, 4, 3, 2, 2))
        fr.append(erode(b, 1 - max(0, i - 2) * 0.22, True, rng.randint(0, 3), 0))
    return fr


def dust():
    fr = []
    for i in range(6):
        f = Frame(16, 16)
        for side in (-1, 1):
            b = noise_blob(16, 16, 8 + side * (2 + i * 0.9), 12 - i * 0.3, 2.2 + i * 0.5, random.Random(20 + side + i // 2), 0.3, (6, 5, 4, 3), 1.6 + i * 0.35)
            f = over(f, b)
        fr.append(erode(f, 1 - max(0, i - 2) * 0.24))
    return fr


def flame_tongue():
    rng = random.Random(5)
    fr = []
    for i in range(6):
        f = Frame(12, 16)
        sway = [math.sin(i * 1.1 + y * 0.5) * (0.9 + (15 - y) * 0.08) for y in range(16)]
        for y in range(16):
            t = y / 15
            w = 5.4 * math.sin(math.pi * min(1, t * 1.05)) ** 0.7 * (1 - 0.2 * (1 - t))
            cx = 6 + sway[y] * (1 - t)
            for x in range(12):
                d = abs(x + 0.5 - cx) / max(0.4, w)
                if d > 1:
                    continue
                v = 7 if d < 0.35 and t > 0.45 else 6 if d < 0.6 else 5 if d < 0.85 else 3
                if t < 0.25:
                    v = max(2, v - 2)
                f.put(x, y, v)
        if rng.random() < 0.8:
            f.put(int(6 + sway[0] * 2), 0 if i % 2 else 1, 5)
        fr.append(f)
    return fr


def orb():
    fr = []
    for i, r in enumerate((5, 5.6, 6, 5.6)):
        f = disc(16, 16, 8, 8, r, (7, 6, 6, 5, 4, 3))
        f = over(f, ring(16, 16, 8, 8, r + 1.4, 1, 5, 5) if i % 2 else Frame(16, 16))
        f.put(6, 5, 7)
        f.put(5, 6, 7)
        fr.append(f)
    return fr


def claw():
    """three marks raked across, drawn in over two frames, then eroding"""
    def marks(upto):
        f = Frame(16, 16)
        for k in range(3):
            ox = 3 + k * 4
            for j in range(int(14 * upto)):
                t = j / 13
                x = ox + t * 3.5 - 1.5 + 0.8 * math.sin(t * 3)
                y = 1 + j
                w = 1 if t < 0.15 or t > 0.85 else 2
                for d in range(w):
                    f.put(x + d, y, 7 if d == 0 else 5)
        return f
    full = marks(1)
    return [marks(0.45), full, dim(full, 1, 3), erode(dim(full, 1, 3), 0.55), erode(dim(full, 2, 2), 0.25)]


def jaws():
    def j(gap):
        f = Frame(16, 16)
        for x in range(1, 15):
            f.put(x, 7 - gap, 6)
            f.put(x, 8 + gap, 5)
        for k in range(4):
            tx = 2 + k * 3.6
            for d in range(3):
                for s in range(-1 + d // 2, 2 - (d + 1) // 2):
                    f.put(tx + 1 + s, 7 - gap + 1 + d, 7 if d < 2 else 6)
                    f.put(tx + 2.5 + s, 8 + gap - 1 - d, 6 if d < 2 else 5)
        return f
    shut = j(1)
    return [j(5), j(3), shut, erode(shut, 0.5)]


def swirl():
    f = Frame(16, 16)
    for i in range(70):
        t = i / 69
        a = t * math.pi * 3.2
        r = 1 + t * 6
        f.put(8 + math.cos(a) * r, 8 + math.sin(a) * r, 7 if t < 0.35 else 6 if t < 0.7 else 4)
    return [f, rot90(f), rot90(rot90(f)), erode(rot90(rot90(rot90(f))), 0.55)]


def heal_sparkle():
    fr = []
    spots = ((4, 11, 0), (11, 9, 1), (7, 5, 2))
    for i in range(6):
        f = Frame(16, 16)
        for x, y, ph in spots:
            k = i - ph
            if k < 0:
                continue
            arm = (1, 2, 2, 1)[k] if k < 4 else 0
            if k < 4:
                f = over(f, star4(16, 16, x, y - k, arm, 0, 7, 6))
        fr.append(f if i < 4 else erode(f, 1 - (i - 3) * 0.35))
    return fr


def stamp_frame():
    """the Bureau's stamp: a thick square frame that slams in big, lands, then wears off (no words: the stamp's text
    is the style track's translatable pb-stamp)"""
    def sq(m, th, v):
        f = Frame(16, 16)
        for y in range(m, 16 - m):
            for x in range(m, 16 - m):
                e = min(x - m, y - m, 15 - m - x, 15 - m - y)
                if e < th:
                    f.put(x, y, v if e == 0 else v - 1)
        return f
    landed = sq(1, 3, 6)
    for x, y in ((3, 3), (12, 3), (3, 12), (12, 12)):
        landed.put(x, y, 7)
    worn = erode(landed, 0.8, False, 1, 2)
    return [sq(0, 2, 7), landed, landed, worn, erode(landed, 0.45, True, 1, 2)]


def slash_arc():
    def arc(a0, a1, bright):
        f = Frame(32, 16)
        for i in range(160):
            t = i / 159
            a = a0 + (a1 - a0) * t
            for d in range(4):
                r = 13 - d * 0.9
                x, y = 16 + math.cos(a) * r * 1.15, 15 + math.sin(a) * r
                thin = 1 - abs(t - 0.5) * 2
                if d < 1 + 3 * thin:
                    f.lift(x, y, (7 if d == 0 else 6 if d == 1 else 4) if bright else (5 if d == 0 else 3))
        return f
    full = arc(math.pi * 1.05, math.pi * 1.95, True)
    return [arc(math.pi * 1.05, math.pi * 1.45, True), full, dim(full, 1, 3), erode(dim(full, 1, 3), 0.55), erode(dim(full, 2, 2), 0.25)]


# 32 px
def explosion():
    fr = []
    rng = random.Random(3)
    for i in range(8):
        r = (4, 8, 11, 13, 14, 15, 15, 15)[i]
        ramp = ((7, 7, 7, 6), (7, 7, 6, 6, 5), (7, 6, 6, 5, 4, 3), (6, 6, 5, 4, 3, 2), (5, 5, 4, 3, 2), (4, 4, 3, 2, 2), (3, 3, 2, 2), (3, 2, 2, 1))[i]
        b = noise_blob(32, 32, 16, 16 - i * 0.4, r, random.Random(30 + i // 3), 0.22 + i * 0.02, ramp)
        if i <= 2:
            b = over(b, disc(32, 32, 16, 16, max(2, r * 0.45), (7, 7)))
        fr.append(erode(b, 1 - max(0, i - 3) * 0.2, True, rng.randint(0, 3), rng.randint(0, 3)))
    return fr


def shock_ring():
    fr = []
    for i, (r, th) in enumerate(((5, 3), (9, 3), (12, 3), (14, 2), (15, 2), (15.5, 1))):
        f = ring(32, 32, 16, 16, r, th, 6, 7)
        fr.append(f if i < 3 else erode(f, 1 - (i - 2) * 0.27))
    return fr


def shield_hex():
    """a hex lattice inside a circle: comes in from the middle, holds (a flicker), then breaks up"""
    def hexes(rad, bright):
        f = Frame(32, 32)
        s = 5.0
        for y in range(32):
            for x in range(32):
                dx, dy = x + 0.5 - 16, y + 0.5 - 16
                if math.hypot(dx, dy) > rad:
                    continue
                q = (dx * math.sqrt(3) / 3 - dy / 3) / s
                r_ = (2 * dy / 3) / s
                # hex rounding: the distance to the nearest centre's edge
                cx_, cz_ = q, r_
                cy_ = -cx_ - cz_
                rx, ry, rz = round(cx_), round(cy_), round(cz_)
                ex, ey, ez = abs(rx - cx_), abs(ry - cy_), abs(rz - cz_)
                if ex > ey and ex > ez:
                    rx = -ry - rz
                elif ey > ez:
                    ry = -rx - rz
                else:
                    rz = -rx - ry
                edge = max(abs(cx_ - rx), abs(cy_ - ry), abs(cz_ - rz))
                if math.hypot(dx, dy) > rad - 1.2:
                    f.p[y][x] = 7 if bright else 6
                elif edge > 0.43:
                    f.p[y][x] = 7 if bright else 5
                elif edge > 0.38 and (x + y) % 2 == 0:
                    f.p[y][x] = 3
        return f
    full = hexes(15, False)
    return [hexes(7, True), hexes(12, True), hexes(15, True), full, full, erode(full, 0.55)]


def beam_cap():
    fr = []
    for i in range(4):
        r = (9, 10, 9, 8)[i]
        f = disc(32, 32, 16, 16, r, (7, 7, 6, 6, 5, 4))
        for k in range(6):
            a = k * math.pi / 3 + i * 0.5
            line(f, 16 + math.cos(a) * r, 16 + math.sin(a) * r, 16 + math.cos(a) * (r + 4 + (k + i) % 3), 16 + math.sin(a) * (r + 4 + (k + i) % 3), 6, True)
        fr.append(f)
    return fr


def beam_strip():
    """tiles along the beam's length (x): a white core, bands toward the edges, wisps scrolling one cell a frame"""
    fr = []
    for i in range(4):
        f = Frame(32, 32)
        for x in range(32):
            w = 9 + 1.5 * math.sin((x + i * 8) * math.pi / 16)
            for y in range(32):
                d = abs(y + 0.5 - 16)
                if d > w:
                    continue
                v = 7 if d < w * 0.35 else 6 if d < w * 0.6 else 5 if d < w * 0.85 else 3
                f.p[y][x] = v
            for s in (-1, 1):
                if (x + i * 8) % 16 < 3:
                    f.put(x, 16 + s * (w + 1.5), 5)
        fr.append(f)
    return fr


# on the ground, at 32 px/m, seen from above: one frame each (VFX-15 draws, sizes and fades them)
def scar_scorch():
    rng = random.Random(41)
    f = noise_blob(32, 32, 16, 16, 12, rng, 0.35, (0, 0, 1, 1, 2, 3), holes=0.0)
    for k in range(9):
        a = rng.uniform(0, 6.3)
        line(f, 16 + math.cos(a) * 9, 16 + math.sin(a) * 9, 16 + math.cos(a) * 15, 16 + math.sin(a) * 15, 2)
    for _ in range(14):
        x, y = rng.randint(4, 27), rng.randint(4, 27)
        if f.get(x, y) >= 0:
            f.put(x, y, 4)
    return [f]


def scar_puddle():
    rng = random.Random(42)
    f = noise_blob(36, 24, 18, 12, 15, rng, 0.25, (4, 4, 3, 3, 2), ry=9)
    for x, y in ((11, 8), (12, 8), (13, 9), (23, 12), (24, 12), (16, 15)):
        f.put(x, y, 7)
    edge = ring(36, 24, 18, 12, 15.5, 1, 5, 5, ry=9.5)
    for y in range(24):
        for x in range(36):
            if edge.p[y][x] >= 0 and f.get(x, y) >= 0:
                f.p[y][x] = 5
    return [f]


def scar_crack():
    rng = random.Random(43)
    f = Frame(32, 32)

    def branch(x, y, a, n, w):
        for _ in range(n):
            a += rng.uniform(-0.5, 0.5)
            x2, y2 = x + math.cos(a) * 2.2, y + math.sin(a) * 2.2
            line(f, x, y, x2, y2, 0)
            if w > 1:
                line(f, x + 1, y, x2 + 1, y2, 1)
            x, y = x2, y2
            if rng.random() < 0.18 and n > 2:
                branch(x, y, a + rng.choice((-1, 1)) * 0.9, n // 2, 1)
    for k in range(5):
        branch(16, 16, k * 1.25 + rng.uniform(-0.2, 0.2), 6, 2)
    for y in range(32):
        for x in range(32):
            if f.p[y][x] < 0 and any(f.get(x + dx, y + dy) == 0 for dx, dy in ((0, 1), (1, 0))):
                f.p[y][x] = 4
    return [f]


def scar_leaf():
    rng = random.Random(44)
    f = Frame(32, 32)
    leaves = [leaf()[0], flip_x(leaf()[0]), petal()[0], rot90(leaf()[0])]
    for _ in range(9):
        L = dim(rng.choice(leaves), rng.choice((0, 1, 2)), 2)
        ox, oy = rng.randint(0, 24), rng.randint(0, 24)
        for y in range(8):
            for x in range(8):
                if L.p[y][x] >= 0:
                    f.put(ox + x, oy + y, L.p[y][x])
    return [f]


def scar_sand():
    rng = random.Random(45)
    f = noise_blob(36, 24, 18, 12, 16, rng, 0.2, (5, 5, 5, 4, 4), ry=10)
    for y in range(24):
        for x in range(36):
            if f.p[y][x] >= 0 and (y + int(2 * math.sin(x * 0.35))) % 5 == 0:
                f.p[y][x] = 6
            elif f.p[y][x] >= 0 and (y + int(2 * math.sin(x * 0.35))) % 5 == 1:
                f.p[y][x] = 3
    return [f]


def scar_dent():
    f = Frame(32, 32)
    for y in range(32):
        for x in range(32):
            dx, dy = x + 0.5 - 16, y + 0.5 - 16
            d = math.hypot(dx, dy)
            if d > 13:
                continue
            lit = (dx + dy) / max(1, d)
            if d > 10:
                f.p[y][x] = 5 if lit < 0 else 3
            elif d > 8.5:
                f.p[y][x] = 2 if lit < 0 else 4
            else:
                f.p[y][x] = 1 if lit < 0.3 else 2
    return [erode(f, 0.95, False)]


# id: (draw, [w, h], anchor, extra data, about)
SPRITES = {
    'spark': (spark, [8, 8], [3, 3], {}, 'a four-pointed spark'),
    'ember': (ember, [8, 8], [3, 5], {'loop': True}, 'a glowing ember, flickering up'),
    'droplet': (droplet, [8, 8], [3, 4], {}, 'a drop of water, then its splat'),
    'chip': (chip, [8, 8], [3, 3], {}, 'a chip of rock or wood, tumbling'),
    'star': (star, [8, 8], [3, 3], {}, 'a small star, twinkling'),
    'chevron': (chevron, [8, 8], [3, 4], {}, 'a double chevron, rising (a stat up; flipped, down)'),
    'bubble': (bubble, [8, 8], [4, 4], {}, 'a bubble growing, then popping'),
    'leaf': (leaf, [8, 8], [3, 4], {}, 'a leaf, tumbling'),
    'petal': (petal, [8, 8], [3, 3], {}, 'a petal, turning'),
    'feather': (feather, [8, 8], [3, 4], {}, 'a feather, swaying'),
    'pebble': (pebble, [8, 8], [3, 3], {'loop': True}, 'a pebble, rolling'),
    'shard_a': (shard(SHARD_A), [8, 8], [3, 3], {}, 'a long shard, glinting'),
    'shard_b': (shard(SHARD_B), [8, 8], [3, 3], {}, 'a broad shard, glinting'),
    'shard_c': (shard(SHARD_C), [8, 8], [3, 4], {}, 'an upright shard, glinting'),
    'note': (note, [8, 8], [3, 4], {}, 'a music note, rising'),
    'zz': (zz, [8, 8], [3, 4], {}, 'a Z (asleep), rising'),
    'plus': (plus, [8, 8], [3, 3], {}, 'a plus (heal), pulsing'),
    'coin': (coin, [8, 8], [4, 4], {'loop': True}, 'a coin, spinning'),
    'paper': (paper, [8, 8], [3, 3], {'loop': True}, 'a square form (the Bureau), flipping; grey lines, no words'),
    'bolt': (bolt, [8, 16], [3, 8], {}, 'a piece of lightning, flickering'),
    'burst': (burst, [16, 16], [8, 8], {'impact': True}, 'an impact: a flash, rays, then the rays eroding'),
    'hit_spark': (hit_spark, [16, 16], [8, 8], {'impact': True}, 'sharp lines out of the hit point'),
    'splash_crown': (splash_crown, [16, 16], [8, 13], {'impact': True}, 'a splash rising in a crown'),
    'smoke': (smoke, [16, 16], [8, 9], {}, 'a puff of smoke, growing and wearing away'),
    'dust': (dust, [16, 16], [8, 12], {}, 'dust kicked up both ways along the ground'),
    'flame_tongue': (flame_tongue, [12, 16], [6, 15], {'loop': True}, 'a tongue of flame, licking up'),
    'orb': (orb, [16, 16], [8, 8], {'loop': True}, 'a glowing orb, pulsing'),
    'claw': (claw, [16, 16], [8, 8], {'impact': True}, 'three claw marks raked across'),
    'jaws': (jaws, [16, 16], [8, 8], {'impact': True}, 'jaws snapping shut'),
    'swirl': (swirl, [16, 16], [8, 8], {}, 'a spiral, turning'),
    'heal_sparkle': (heal_sparkle, [16, 16], [8, 8], {}, 'three sparkles rising, one after another'),
    'stamp_frame': (stamp_frame, [16, 16], [8, 8], {'impact': True}, "the Bureau's stamp frame slamming in (its word is the style track's text)"),
    'slash_arc': (slash_arc, [32, 16], [16, 10], {'impact': True}, 'a slashing arc, swept across'),
    'explosion': (explosion, [32, 32], [16, 16], {'impact': True}, 'an explosion: white, then billowing and eroding'),
    'shock_ring': (shock_ring, [32, 32], [16, 16], {'impact': True}, 'a shock ring spreading and eroding'),
    'shield_hex': (shield_hex, [32, 32], [16, 16], {}, 'a hex shield coming up from the middle, then breaking up'),
    'beam_cap': (beam_cap, [32, 32], [16, 16], {'loop': True}, "a beam's end: a glowing disc with spikes"),
    'beam_strip': (beam_strip, [32, 32], [0, 16], {'loop': True}, "a beam's body, tiling along its length (x), scrolling"),
    'scar_scorch': (scar_scorch, [32, 32], [16, 16], {'ground': True}, 'a scorch mark (Fire), from above'),
    'scar_puddle': (scar_puddle, [36, 24], [18, 12], {'ground': True}, 'a puddle (Water), from above'),
    'scar_crack': (scar_crack, [32, 32], [16, 16], {'ground': True}, 'cracks in the ground (Ground), from above'),
    'scar_leaf': (scar_leaf, [32, 32], [16, 16], {'ground': True}, 'leaf litter (Grass), from above'),
    'scar_sand': (scar_sand, [36, 24], [18, 12], {'ground': True}, 'a sand drift (Sandstorm), from above'),
    'scar_dent': (scar_dent, [32, 32], [16, 16], {'ground': True}, 'a dent (a heavy hit), from above'),
}


def draw(sid):
    fn, cell, _, _, _ = SPRITES[sid]
    frames = fn()
    w, h = cell
    for f in frames:
        if (f.w, f.h) != (w, h):
            raise SystemExit(f'{sid}: a frame is {f.w}x{f.h}, the cell {w}x{h}')
    im = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    px = im.load()
    for i, f in enumerate(frames):
        for y in range(h):
            for x in range(w):
                v = f.p[y][x]
                if v >= 0:
                    c = GREYS[v]
                    px[i * w + x, y] = (c, c, c, 255)
    return im, len(frames)


def entry(sid, n):
    _, cell, anchor, extra, about = SPRITES[sid]
    e = {'about': about, 'cell': cell, 'frames': n, 'anchor': anchor}
    e.update(extra)
    return e


def load_data():
    return json.loads(DATA.read_text())


def check():
    """the strips against the data: every sprite has its strip at cell x frames, every pixel empty or one of the 8
    greys (opaque), every strip has its sprite"""
    D = load_data()
    S = D.get('sprites') or {}
    bad = []
    for sid, e in S.items():
        p = OUT / f'{sid}.png'
        if not p.exists():
            bad.append(f'{sid}: no strip at {p.relative_to(ROOT)} (run this tool)')
            continue
        im = Image.open(p).convert('RGBA')
        w, h = e['cell']
        n = e['frames']
        if im.size != (w * n, h):
            bad.append(f'{sid}: the strip is {im.size[0]}x{im.size[1]}, {n} frames of {w}x{h} make {w * n}x{h}')
            continue
        odd = set()
        raw = im.tobytes()
        for r, g_, b, a in (raw[i:i + 4] for i in range(0, len(raw), 4)):
            if a == 0:
                continue
            if a != 255 or not (r == g_ == b) or r not in GREYS:
                odd.add((r, g_, b, a))
        if odd:
            bad.append(f'{sid}: {len(odd)} colours outside the 8 greys (e.g. {sorted(odd)[:3]}); repaint with the greys {GREYS}')
        ax, ay = e['anchor']
        if not (0 <= ax < w and 0 <= ay < h):
            bad.append(f'{sid}: its anchor {e["anchor"]} is outside its {w}x{h} cell')
        for i in range(n):
            if not im.crop((i * w, 0, i * w + w, h)).getbbox():
                bad.append(f'{sid}: frame {i + 1} is empty')
    for p in sorted(OUT.glob('*.png')):
        if p.stem not in S:
            bad.append(f'{p.relative_to(ROOT)}: no sprite of that id in battleAnims.json')
    for sid in SPRITES:
        if sid not in S:
            bad.append(f'{sid}: this tool draws it but battleAnims.json has no sprite of that id')
    for b in bad:
        print('  ' + b)
    print(f'battle anims: {len(S)} sprites, ' + ('all fine' if not bad else f'{len(bad)} problems'))
    return 0 if not bad else 1


def ramp_colours(D):
    """each ramp's 8 colours (index 7 white), as the game builds them (walk/battle-fx.js battleRampColors)"""
    js = (ROOT / 'game' / 'art' / 'next' / 'palette.js').read_text()
    pal = json.loads(js[js.index('=') + 1:js.rindex(';')])['ramps']
    out = {}
    for rid, r in (D.get('ramps') or {}).items():
        steps = pal[r['ramp']] if isinstance(r['ramp'], str) else r['ramp']
        cs = [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in steps[:7]] + [(255, 255, 255)]
        out[rid] = cs
    return out


def sheet():
    """every sprite through every ramp: a panel per ramp (the grey one first), each sprite's whole strip at 2x on a
    dark ground, five panels a row; the sprite ids down the left of each row of panels"""
    D = load_data()
    S = D.get('sprites') or {}
    R = ramp_colours(D)
    rids = ['grey'] + list(R)
    sc, pad, label = 2, 4, 90
    rows = [(sid, Image.open(OUT / f'{sid}.png').convert('RGBA')) for sid in S if (OUT / f'{sid}.png').exists()]
    pw = max(im.size[0] for _, im in rows) * sc + pad * 2
    ph = sum(im.size[1] * sc + pad for _, im in rows) + 16 + pad

    def panel(rid):
        o = Image.new('RGBA', (pw, ph), (24, 22, 32, 255))
        d = ImageDraw.Draw(o)
        d.text((pad, 2), rid, fill=(235, 235, 235, 255))
        y = 16
        for sid, im in rows:
            c = im.copy()
            if rid != 'grey':
                px = c.load()
                for yy in range(c.size[1]):
                    for xx in range(c.size[0]):
                        r_, _, _, a = px[xx, yy]
                        if a:
                            px[xx, yy] = (R[rid][GREYS.index(r_)] if r_ in GREYS else (255, 0, 255)) + (255,)
            o.alpha_composite(c.resize((c.size[0] * sc, c.size[1] * sc), Image.NEAREST), (pad, y))
            y += im.size[1] * sc + pad
        return o
    per = 5
    nrow = (len(rids) + per - 1) // per
    out = Image.new('RGBA', (label + per * (pw + pad), nrow * (ph + pad)), (44, 40, 56, 255))
    d = ImageDraw.Draw(out)
    for k, rid in enumerate(rids):
        r, c = divmod(k, per)
        out.paste(panel(rid), (label + c * (pw + pad), r * (ph + pad)))
    for r in range(nrow):
        y = r * (ph + pad) + 16
        for sid, im in rows:
            d.text((2, y), sid, fill=(235, 235, 235, 255))
            y += im.size[1] * sc + pad
    SHEET.mkdir(parents=True, exist_ok=True)
    p = SHEET / 'sheet.png'
    out.save(p)
    print(f'battle anims: contact sheet {p.relative_to(ROOT)} ({len(rows)} sprites x {len(rids)} ramps)')


def main():
    args = sys.argv[1:]
    if '--check' in args:
        sys.exit(check())
    if '--sheet' in args:
        return sheet()
    only = next((a.split('=', 1)[1].split(',') for a in args if a.startswith('--only=')), None)
    if '--data' in args:
        print(json.dumps({sid: entry(sid, len(SPRITES[sid][0]())) for sid in SPRITES}, indent=1))
        return
    force = '--force' in args
    OUT.mkdir(parents=True, exist_ok=True)
    done = []
    for sid in SPRITES:
        if only and sid not in only:
            continue
        p = OUT / f'{sid}.png'
        if force or not p.exists():
            im, _ = draw(sid)
            im.save(p, optimize=True)
            done.append(sid)
    print('battle anims: ' + (', '.join(done) or 'all there (use --force to draw them again)'))


if __name__ == '__main__':
    main()
