#!/usr/bin/env python3
"""v47: the ground, redrawn. Every ground kind gets a fresh set of twelve 32 px tiles in game/art/next/tiles47/
(new files: the v46 set in next/tiles is left as it was), and 22 new kinds join the 38.

What changed from v46 (tools/legacy/build-terrain.py):
  - no seams and no repeats: the soft patches of light and shade are no longer in the tiles (where every tile's edge
    cut them and every tile repeated them); the ground painter (walk-view.js) lays them across the whole ground in
    world metres, half a step lighter or darker, round, a checker where they meet. tone_at/tone_px below are the
    same sums, so the sheets show what the game lays. Nothing drawn in a tile crosses its edge; paving rows run on
    because the stone across each edge is the same in every tile of the kind
  - the plain tiles (most of the ground) carry nothing that catches the eye, and the painter lays the three of them
    equally often, never the same one twice side by side; it no longer mirrors tiles, so the light keeps to one side
  - detail comes as little drawn shapes lit from the top left (tufts, stones, leaves, flowers), not stray pixels
  - the damp tile of every kind was the same cool grey smudge; now each kind has its own darker patch in its own
    colours (lusher grass, wetter earth, a little moss on paving), and stains are never grey
  - kinds that looked like another got their own features: heather spikes, leaf-litter leaves, wet-sand sheen and
    puddles, glossy mud, round river pebbles, ice streaks and pale cracks, meadow seed heads, clover leaves and
    flower heads, flower clumps, plates parted by cracks (basalt, dry earth, salt), setts laid tight in rows
  - the trodden track along the lines people walk is laid by the painter too (bare soil in patches under plant
    cover, packed paler earth), so it runs on from tile to tile; the worn tiles only carry fewer details
  - seeds are stable (the same tiles every run)

Roles of the twelve (the ground painter, walk-view.js, places them): 1, 7, 8 plain; 2-6, 10 details; 9 the damp
patch; 11, 12 worn. The 16 px tiles of the new kinds (scene/tiles/<name>.png and _1.._5, Lite mode and the Studio)
are made from the 32 px ones, with the soft patches baked in (Lite has no painter patches).

    python3 tools/build-ground.py                       # writes what is missing (+ the catalogue entries)
    python3 tools/build-ground.py --force NAME[,NAME]   # redraws those kinds (their tiles47 files only)
    python3 tools/build-ground.py --preview --sheet out.png   # only the tiles47 files and the sheets
"""
import gamedata  # phase 04b: the data files in game/data
import argparse, importlib.util, json, math, random, zlib
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('btiles', ROOT / 'tools' / 'build-tiles.py'); BT = importlib.util.module_from_spec(spec); spec.loader.exec_module(BT)
T, hx, mix, dk = BT.T, BT.hx, BT.mix, BT.dk
OUT = ROOT / 'game' / 'art' / 'next' / 'tiles47'; OLD = BT.OLD; DATA = ROOT / 'game' / 'data' / 'gamedata.js'


def ramp(b):
    """[deep, shade, base, light, highlight]: shadows lean lavender, lights lean cream (the props' rule)"""
    return [mix(dk(b, .58), (60, 42, 112), .28), mix(dk(b, .8), (96, 74, 152), .15), b, mix(b, (255, 244, 196), .28), mix(b, (255, 252, 234), .58)]


# ----------------------------------------------------------------------------- the painter's soft patches
# v47: the soft patches of light and shade are no longer in the tiles: the ground painter (walk-view.js, dioTone47) lays
# them across the whole ground in world metres, so they run on from tile to tile and never repeat. The same sums here,
# for the sheets and for the 16 px tiles of Lite mode.
def _i32(v):
    v = int(v) % 4294967296
    return v - 4294967296 if v >= 2147483648 else v


def dio_hash(x, y):
    h = _i32(_i32(x * 374761393 + y * 668265263) ^ 0x5bd1e995)
    a = _i32(h ^ ((h % 4294967296) >> 13)); h = _i32((a * 1274126177) % 4294967296)
    return ((h ^ ((h % 4294967296) >> 16)) % 4294967296) / 4294967296


def dio_noise(x, y):
    xi, yi = math.floor(x), math.floor(y); fx, fy = x - xi, y - yi; s = lambda q: q * q * (3 - 2 * q)
    a, b, c, d = dio_hash(xi, yi), dio_hash(xi + 1, yi), dio_hash(xi, yi + 1), dio_hash(xi + 1, yi + 1)
    return a + (b - a) * s(fx) + (c - a) * s(fy) + (a - b - c + d) * s(fx) * s(fy)


_C1, _S1, _C2, _S2 = math.cos(.52), math.sin(.52), math.cos(-.35), math.sin(-.35)
TONE_LO, TONE_HI, TONE_D = .39, .635, .018          # a quarter of the ground a half step darker, a fifth lighter
TONE_DARK, TONE_LITE, TONE_ADD = (.895, .905, .935), (1.05, 1.05, 1.04), (5, 4, 1)


def tone_at(x, z):
    u, w = x * _C1 - z * _S1, x * _S1 + z * _C1; u2, w2 = x * _C2 - z * _S2, x * _S2 + z * _C2
    return .62 * dio_noise(u * 3.1, w * 3.1) + .38 * dio_noise(u2 * 6.3 + 17.3, w2 * 6.3 + 4.1)


def tone_px(c, v, odd, k=1.0):
    """shade: a touch richer and darker, leaning cool; light: a touch paler and lighter, leaning cream"""
    dark = v < TONE_LO - TONE_D or (v < TONE_LO + TONE_D and not odd); lite = not dark and (v > TONE_HI + TONE_D or (v > TONE_HI - TONE_D and not odd))
    if not (dark or lite): return c
    l = .3 * c[0] + .59 * c[1] + .11 * c[2]; sat, f, add = (1.12, TONE_DARK, (0, 0, 0)) if dark else (.92, TONE_LITE, TONE_ADD)
    return tuple(max(0, min(255, int(c[n] + ((l + (c[n] - l) * sat) * f[n] + add[n] - c[n]) * k))) for n in range(3))


def tone_image(im, x0=0.0, z0=0.0, k=1.0):
    """the soft patches over a picture whose top left is at world metres (x0, z0), 32 px a metre"""
    a = np.array(im.convert('RGB')); H, W = a.shape[:2]
    for y in range(H):
        for x in range(W):
            a[y, x] = tone_px(tuple(int(q) for q in a[y, x]), tone_at(x0 + (x + .5) / T, z0 + (y + .5) / T), (x + y) % 2 == 1, k)
    return Image.fromarray(a)


TONE_K = {'grass': 1.0, 'earth': 1.0, 'water': 1.0, 'paved': 0.0, 'floor': 0.0}
TONE_KIND = {'snow': .6, 'ice': .5, 'salt': .5, 'cloudfloor': .55, 'coralsand': .75, 'sand': .8, 'lawn': .35, 'water': .7, 'deep': .7,
             'tallgrass': .8, 'soil': .6}          # how strongly the painter lays its patches on a kind (the catalogue's `tone`)


def tone_k(name): return TONE_KIND.get(name, TONE_K[KINDS[name][1]]) if name in KINDS else 0


# ------------------------------------------------------------------------------------------- seamless noise
_I = np.arange(T); _E = np.minimum(_I, T - 1 - _I); EDGE = np.minimum(_E[None, :], _E[:, None]).astype(float)
BORDER = np.clip((6.0 - EDGE) / 5.0, 0, 1)           # 1 along the edge, 0 from 6 px in: there all twelve agree
_F = np.fft.fftfreq(T); _F2 = _F[None, :] ** 2 + _F[:, None] ** 2


def blur_noise(rs, sigma):
    """white noise blurred by a gaussian of sigma px, wrapping on all four sides (round blobs, no lattice)"""
    return np.real(np.fft.ifft2(np.fft.fft2(rs.rand(T, T)) * np.exp(-2 * math.pi ** 2 * sigma ** 2 * _F2)))


def rank(f): return f.ravel().argsort().argsort().reshape(f.shape) / (f.size - 1.0)


_SHARED = {}


def shared(name, sigma, salt=0):
    k = (name, sigma, salt)
    if k not in _SHARED: _SHARED[k] = rank(blur_noise(np.random.RandomState(zlib.crc32(f'{name}/shared/{salt}'.encode()) & 0x7fffffff), sigma))
    return _SHARED[k]


class Tile(BT.Tile):
    def __init__(self, name, i):
        super().__init__(zlib.crc32(f'{name}/{i}/v47'.encode()), (0, 0, 0)); self.name = name; self.i = i
        self.plain = i in (1, 7, 8)      # the plain tiles cover most ground: nothing on them may catch the eye
        self.thin = i in (11, 12)        # the worn tiles: fewer details (the painter lays the trodden track itself)
        self.np = np.random.RandomState(zlib.crc32(f'{name}/{i}/np'.encode()) & 0x7fffffff)

    def blotch(self, *a, **k): pass          # the v37 recipes' patches: now the painter's (world metres)

    def field(self, sigma=3.0, salt=0, seamless=True):
        """0..1 (evenly spread), round blobs about 2.5 sigma across; along the edges every tile of the kind agrees"""
        own = rank(blur_noise(self.np, sigma))
        return own * (1 - BORDER) + shared(self.name, sigma, salt) * BORDER if seamless else own

    def tone(self, R, sigma=3.0, lo=.28, hi=.74, k=.5, dither=.035, salt=0):
        """soft patches half a step (k) darker and lighter, with a checker where they meet the base"""
        f = self.field(sigma, salt); D = mix(R[2], R[1], k); L = mix(R[2], R[3], k)
        for y in range(T):
            for x in range(T):
                v = f[y, x]; ch = (x + y) % 2 == 0
                if v < lo - dither or (v < lo + dither and ch): self.px(x, y, D)
                elif v > hi + dither or (v > hi - dither and ch): self.px(x, y, L)
        return f

    def spot(self, w, h, m=0):
        """a top-left corner where a w x h shape fits inside the tile (no detail is cut by an edge)"""
        return self.r.randrange(m, T - w - m + 1), self.r.randrange(m, T - h - m + 1)

    def sprite(self, x, y, rows, pal, flip=False):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row[::-1] if flip else row):
                if ch in pal: self.px(x + i, y + j, pal[ch])

    def put(self, rows, pal, near=None, m=0, flip=None):
        w, h = max(len(r) for r in rows), len(rows)
        if near:
            x = min(T - w, max(0, near[0] + self.r.randrange(-near[2], near[2] + 1))); y = min(T - h, max(0, near[1] + self.r.randrange(-near[3], near[3] + 1)))
        else: x, y = self.spot(w, h, m)
        self.sprite(x, y, rows, pal, self.r.random() < .5 if flip is None else flip); return x, y

    def rock(self, x, y, w, h, S, sh=None, corner=None):
        """a rounded stone: light along the top and left, shade along the bottom and right, a highlight, a shadow below"""
        cut = 1 if min(w, h) >= 3 else 0; big = min(w, h) >= 5 if corner is None else corner >= 2
        def inside(i, j):
            if not cut: return True
            c = 2 if big else 1
            return not ((i < c or i >= w - c) and (j < c or j >= h - c) and (min(i, w - 1 - i) + min(j, h - 1 - j)) < c)
        for j in range(h):
            for i in range(w):
                if not inside(i, j): continue
                top = j == 0 or not inside(i, j - 1); left = i == 0 or not inside(i - 1, j)
                bot = j == h - 1 or not inside(i, j + 1); right = i == w - 1 or not inside(i + 1, j)
                c = S[1] if bot or (right and not top) else S[3] if top or left else S[2]
                self.px(x + i, y + j, c)
        if w >= 3 and h >= 2: self.px(x + 1 + (1 if big else 0), y + (1 if h >= 3 else 0), S[4])
        if sh is not None:
            for i in range(1 + cut, w + (0 if cut else 1)):
                if y + h < T and x + i < T and inside(min(i, w - 1), h - 1): self.px(x + i, y + h, sh)

    def stone_at(self, w, h, S, sh, m=0):
        x, y = self.spot(w + 1, h + 1, m); self.rock(x, y, w, h, S, sh); return x, y

    def line(self, x, y, n, c, c2=None, dy=lambda k: 0):
        for k in range(n):
            xx, yy = x + k, y + dy(k)
            if 0 <= xx < T and 0 <= yy < T:
                self.px(xx, yy, c)
                if c2 is not None and 0 <= yy - 1: self.px(xx, yy - 1, c2)

    def crack2(self, R, n=None, x=None, y=None, line=None, lip=None):
        """a thin crack in the deepest shade, its lower lip catching the light; it stays inside the tile"""
        n = n or self.r.randrange(5, 10); x = self.r.randrange(3, T - 3) if x is None else x; y = self.r.randrange(2, T - n - 2) if y is None else y
        dx = self.r.choice((-1, 1)); line = R[0] if line is None else line; lip = mix(R[2], R[3], .5) if lip is None else lip
        for k in range(n):
            if not (1 <= x < T - 1 and 1 <= y < T - 1): break
            self.px(x, y, line)
            if self.r.random() < .5: self.px(x + 1, y, lip)
            y += 1; x += dx if self.r.random() < .45 else 0
            if self.r.random() < .15: dx = -dx

    def soft(self, sigma, frac, fn, salt=7, dither=.03, edge=1.0):
        """applies fn(colour) where soft blobs cover frac of the tile (a checker along their rim); they keep clear
        of the edges, so nothing is cut where two tiles meet"""
        f = self.field(sigma, salt, False) * (1 - edge * BORDER); cut = float(np.quantile(f, 1 - frac))
        for y in range(T):
            for x in range(T):
                v = f[y, x]
                if v > cut + dither or (v > cut - dither and (x + y) % 2 == 0): self.px(x, y, fn(self.get(x, y)))
        return f, cut


def plates(t, n_shared, n_own, line, lip=None, rim=None):
    """plates parted by thin cracks (dry earth, basalt). Along the edges only the kind's shared seeds count, so the
    cracks run on from tile to tile; inside, the tile's own seeds join them. lip: the lit far edge of each crack;
    rim: the shaded near edge"""
    def far(p, pts, d=7.0): return all(math.hypot(min(abs(p[0] - a), T - abs(p[0] - a)), min(abs(p[1] - b), T - abs(p[1] - b))) >= d for a, b in pts)
    rs = random.Random(zlib.crc32(f'{t.name}/plates'.encode())); S = []
    for _ in range(200):
        q = (rs.uniform(0, T), rs.uniform(0, T))
        if len(S) < n_shared and far(q, S): S.append(q)
    O = list(S)
    for _ in range(200):
        q = (t.r.uniform(7, T - 7), t.r.uniform(7, T - 7))
        if len(O) < n_shared + n_own and far(q, O): O.append(q)
    def gap(pts, x, y):
        d = sorted(math.hypot(min(abs(x - a), T - abs(x - a)), min(abs(y - b), T - abs(y - b))) for a, b in pts); return d[1] - d[0]
    G = np.array([[gap(S if BORDER[y, x] > .5 else O, x + .5, y + .5) for x in range(T)] for y in range(T)])
    crack = G < 1.0
    for y in range(T):
        for x in range(T):
            if crack[y, x]: t.px(x, y, line)
            elif lip is not None and crack[(y - 1) % T, x]: t.px(x, y, lip)
            elif rim is not None and crack[(y + 1) % T, x]: t.px(x, y, rim)


def crack_net(t, n, line, lip, length=(8, 18), branch=.12, lip_dy=1):
    """wandering lines that branch now and then, every one inside the tile; lip: the pixel beside each (below)"""
    pts = set()
    def walk(x, y, a, L, depth):
        for _ in range(L):
            x += math.cos(a); y += math.sin(a); a += t.r.uniform(-.45, .45); xi, yi = int(round(x)), int(round(y))
            if not (1 <= xi < T - 1 and 1 <= yi < T - 1 - lip_dy): return
            pts.add((xi, yi))
            if depth < 2 and t.r.random() < branch: walk(x, y, a + t.r.choice((-1.2, 1.2)), L // 2, depth + 1)
    for _ in range(n): walk(t.r.uniform(3, T - 3), t.r.uniform(3, T - 3), t.r.uniform(0, 2 * math.pi), t.r.randrange(*length), 0)
    for x, y in pts:
        if lip is not None and (x, y + lip_dy) not in pts: t.px(x, y + lip_dy, lip)
    for x, y in pts: t.px(x, y, line)


# ------------------------------------------------------------------------------------------------- shapes
# letters: k deep, d shade, b base, l light, h highlight (of the kind's ramp, or a palette passed in)
TUFTS = [["l...l", "d.l.d", ".ddd."], [".l.", "ldl", ".d."], ["l.h..", "d.d.l", ".dd.d", "..dd."], ["..l..", "l.d.l", "d.d.d", ".ddd."]]
MARKS = [["l.l", ".d."], ["h.", "dl", "d."], ["l", "d"]]
GRAIN = [["l", "d"], ["l.", ".d"], ["ld"]]
FLOWER = [["hp", "pq", "d."], ["hpp", "ppq", ".d."], [".h", "hq", ".d"], ["hp.", "pqc", ".d."]]
TREFOIL = [[".a.", "aba", ".s."], ["a.a", ".b.", "as."], [".aa", "ab.", ".s."]]
SEEDS = [["c", "s", "d", "d"], ["c.", "sc", "d.", "d."], [".c", "cs", ".d", ".d"]]
SPIKE = [["p", "q", "p", "d"], ["p.", "qp", "pq", "d."], ["q", "p", "d"]]
LEAVES = [["ab", "bc", ".s"], ["ab.", ".bc", "..s"], [".a.", "abc", ".s."], ["aab", ".bc"]]
SHELL = [[".w.", "wpw", ".s."], ["wp", "ps"], ["w.w", "wpw"]]
WAVE = [[".ll.", "l..l"], ["lhl"], [".lhl.", "l...l"], ["ll", "..l"]]
REED = [["l", "b", "b", "d", "d"], ["l.", "b.", ".b", ".d", ".d"], ["l", "l", "b", "d"]]
NEEDLE = [["a.", ".b"], [".a", "b."], ["ab"], ["a", "b"]]
FLOWER_COLS = {'white': ('#F7F1E3', '#F2C14E'), 'yellow': ('#F2C14E', '#E8863A'), 'pink': ('#E8708A', '#F7F1E3'),
               'violet': ('#9C8CE8', '#F2C14E'), 'red': ('#E05A4A', '#F2C14E'), 'blue': ('#6A9CE8', '#F7F1E3')}


def kpal(R): return {'k': R[0], 'd': R[1], 'b': R[2], 'l': R[3], 'h': R[4]}


def stone_ramp(R, tint=(150, 146, 140), k=.55): return ramp(mix(R[2], tint, k))


def flower_pal(name, R):
    p, c = FLOWER_COLS[name]; P = ramp(hx(p)); return {'h': P[3], 'p': P[2], 'q': P[1], 'c': hx(c), 'd': R[1]}


def clump(t, R, cols, n=4, spread=(4, 3)):
    x, y = t.r.randrange(T), t.r.randrange(T); pal = flower_pal(t.r.choice(cols), R)
    for _ in range(n): t.put(t.r.choice(FLOWER), pal, near=(x, y, spread[0], spread[1]))


# ------------------------------------------------------------------------------------------------ recipes
def grassy(base, lite, dark, tufts=11, marks=9, extra=None, sigma=3.0, k=.5):
    def f(t):
        R = ramp(hx(base)); R[1], R[3] = hx(dark), hx(lite); t.a[:] = R[2]; P = kpal(R)
        for _ in range(tufts // 3 if t.thin else tufts): t.put(TUFTS[t.r.randrange(len(TUFTS))], P)
        for _ in range(marks // 2 if t.thin else marks): t.put(MARKS[t.r.choice((0, 0, 1, 2))], P)
        if extra and not t.thin: extra(t, R)
        return R
    return f


def meadow_extra(t, R):
    pal = {'c': hx('#EDE2AC'), 's': mix(R[3], hx('#D8C888'), .5), 'd': R[1]}
    for _ in range(9): t.put(t.r.choice(SEEDS), pal)
    for _ in range(t.r.choice((0, 1, 1))): clump(t, R, ['yellow', 'white'], 2, (3, 2))


def flowers_extra(t, R):
    cols = t.r.choice([['white', 'yellow'], ['pink', 'white'], ['violet', 'yellow'], ['yellow', 'red'], ['blue', 'white']])
    for _ in range(3): clump(t, R, cols, t.r.randrange(3, 6))


def wild_extra(t, R):
    for _ in range(5): clump(t, R, list(FLOWER_COLS), t.r.randrange(2, 5), (5, 3))
    meadow_extra(t, R)


def clover_extra(t, R):
    L = ramp(hx('#4C9A4E')); pal = {'a': L[3], 'b': L[2], 's': L[0]}
    for _ in range(12): t.put(t.r.choice(TREFOIL), pal)
    for _ in range(3): t.put([".w.", "wpw", ".s."], {'w': hx('#F6F2EA'), 'p': hx('#E8C8D4'), 's': L[1]})


def heather_extra(t, R):
    pal = {'p': hx('#C88AD0'), 'q': hx('#9A62AE'), 'd': R[1]}
    for _ in range(5):
        x, y = t.r.randrange(T), t.r.randrange(T)
        for _ in range(t.r.randrange(3, 6)): t.put(t.r.choice(SPIKE), pal, near=(x, y, 4, 2))


def moss_extra(t, R):
    pal = {'h': R[4], 'l': R[3], 'd': R[1]}
    for _ in range(26): t.put(t.r.choice([["hl", "ld"], ["l", "d"], ["hl.", "lld", ".d."]]), pal)


def marsh_extra(t, R):
    pal = {'l': hx('#C2C878'), 'b': hx('#8EA05A'), 'd': R[1]}
    for _ in range(4):
        x, y = t.r.randrange(T), t.r.randrange(T)
        for _ in range(t.r.randrange(2, 5)): t.put(t.r.choice(REED), pal, near=(x, y, 3, 1))
    if t.r.random() < .5: puddle(t, R, 7, 3, hx('#3E6A66'))


def sunburnt_extra(t, R):
    meadow_extra(t, R)
    S = stone_ramp(R, (160, 150, 130)); sh = mix(R[2], R[1], .6)
    for _ in range(t.r.randrange(0, 2)): t.stone_at(t.r.choice((2, 3)), 2, S, sh)


def earthy(base, lite, dark, grain=22, pebbles=3, cracks=0, sigma=3.0, k=.5, extra=None, tint=(150, 146, 140)):
    def f(t):
        R = ramp(hx(base)); R[1], R[3] = hx(dark), hx(lite); t.a[:] = R[2]
        P = {'l': mix(R[2], R[3], .75), 'd': mix(R[2], R[1], .75)}
        for _ in range(grain // 2 if t.thin else grain): t.put(GRAIN[t.r.randrange(3)], P)
        S = stone_ramp(R, tint); sh = mix(R[2], R[1], .7)
        for _ in range(0 if t.thin else pebbles): t.stone_at(t.r.choice((2, 2, 3, 3, 4)) if not t.plain else t.r.choice((2, 2, 3)), 2, S, sh)
        for _ in range(0 if t.plain or t.thin else cracks): t.crack2(R)
        if extra and not t.thin: extra(t, R)
        return R
    return f


def rocky(base, lite, dark, tint, slabs=4):
    """rocky ground: flat stones set in it (low, lit along the top), grit between"""
    def f(t):
        R = earthy(base, lite, dark, 16, 0)(t); S = ramp(mix(R[2], tint, .35)); sh = mix(R[2], R[1], .8)
        for _ in range(slabs): t.stone_at(t.r.choice((4, 5, 6, 7)), t.r.choice((3, 3, 4)), S, sh, 1)
        for _ in range(3): t.stone_at(2, 2, stone_ramp(R, tint), sh)
        return R
    return f


def puddle(t, R, w=7, h=3, deep=None):
    """a small puddle: sky in it, lighter at the far (top) side, a dark lip along the top"""
    x, y = t.spot(w, h + 1, 1); W = ramp(deep or hx('#5E98B8'))
    for j in range(h):
        for i in range(w):
            if (i in (0, w - 1)) and (j in (0, h - 1)): continue
            t.px(x + i, y + j, W[3] if j == 1 and 1 < i < w - 2 else W[2])
    for i in range(1, w - 1): t.px(x + i, y - 1, mix(R[2], R[1], .8))
    t.px(x + w - 3, y + h - 1, W[4])


def sand_extra(t, R):
    if t.r.random() < .5:
        c, l = mix(R[2], R[1], .45), mix(R[2], R[3], .6)
        for _ in range(2):
            x, y = t.r.randrange(2, T - 14), t.r.randrange(3, T - 3); ph = t.r.random() * 6
            t.line(x, y, t.r.randrange(8, 13), c, l, lambda k: int(round(math.sin(k / 2.2 + ph))))


def wetsand(t):
    R = earthy('#B89C66', '#CDB27A', '#9E8452', 16, 1)(t)
    for _ in range(3):                    # a sheen in soft streaks
        x, y = t.r.randrange(1, T - 10), t.r.randrange(1, T - 1)
        for k in range(t.r.randrange(5, 10)): t.px(x + k, y, mix(t.get(x + k, y), (236, 232, 222), .4))
    if not t.plain and t.r.random() < .6: puddle(t, R, t.r.randrange(6, 9), 3)
    for _ in range(0 if t.plain else t.r.randrange(0, 2)): t.put(t.r.choice(SHELL), {'w': hx('#F2EAE0'), 'p': hx('#E0C4BC'), 's': R[1]})
    return R


def mud(t):
    R = earthy('#5E4430', '#76583C', '#46321F', 14, 1)(t)
    for _ in range(10):                   # wet shine on the lumps
        x, y = t.spot(2, 2, 1); t.px(x, y, mix(R[3], (236, 226, 206), .45)); t.px(x + 1, y + 1, R[1])
    if not t.plain and t.r.random() < .55: puddle(t, R, t.r.randrange(6, 9), 3, hx('#6E6458'))
    return R


def pebbles(t):
    """round river stones, all sizes, on a little sand"""
    R = ramp(hx('#A89A80')); R[1], R[3] = hx('#8C7E66'), hx('#BEB094'); t.a[:] = R[2]
    cols = [ramp(hx(c)) for c in ('#B9B2A6', '#A8A094', '#C8C2B4', '#9C958A', '#BCA88E', '#8E8A86')]; sh = mix(R[2], R[1], .8)
    taken = np.zeros((T, T), bool)
    for _ in range(60):
        w = t.r.choice((3, 4, 4, 5, 5, 6)); h = max(2, w - t.r.choice((1, 1, 2))); x, y = t.spot(w + 1, h + 1)
        if taken[max(0, y - 1):y + h + 1, max(0, x - 1):x + w + 1].any(): continue
        taken[y:y + h + 1, x:x + w + 1] = True; t.rock(x, y, w, h, t.r.choice(cols), sh)
    return R


def ice(t):
    R = ramp(hx('#BFDCEC')); R[1] = hx('#A6C8DE'); R[3] = hx('#DAEEF8'); t.a[:] = R[2]
    for _ in range(2):                    # glossy streaks
        x, y = t.r.randrange(1, T - 12), t.r.randrange(5, T - 2); n = t.r.randrange(6, 11)
        for k in range(n):
            if k % 5 != 3: t.px(x + k, y - k // 3, (244, 250, 255))
    for _ in range(t.r.randrange(2, 5)):  # little bubbles caught in it
        x, y = t.spot(1, 1, 1); t.px(x, y, (236, 246, 252))
    return R


def snowy(t):
    R = ramp(hx('#EEF3F8')); R[1], R[3] = hx('#CBD8EA'), hx('#FBFDFF'); t.a[:] = R[2]
    for _ in range(5):                    # little dimples, lit on the far side
        x, y = t.spot(2, 2, 1); t.px(x, y, mix(R[2], R[1], .7)); t.px(x + 1, y + 1, R[3])
    for _ in range(3): x, y = t.spot(1, 1, 1); t.px(x, y, (255, 255, 255))
    return R


def gravelly(t):
    R = ramp(hx('#A59C8C')); R[1], R[3] = hx('#8C8373'), hx('#C2B9A8'); t.a[:] = mix(R[2], R[1], .6)
    cols = [ramp(hx(c)) for c in ('#C2B9A8', '#B4AB9A', '#A59C8C', '#9A9282', '#BDB0A0')]
    for _ in range(140):
        x, y = t.spot(3, 3); S = t.r.choice(cols); w = t.r.choice((2, 2, 3))
        t.px(x, y, S[3]); t.px(x + 1, y, S[2]);
        if w == 3: t.px(x + 2, y, S[1]); t.px(x + 1, y + 1, S[1])
        else: t.px(x, y + 1, S[2]); t.px(x + 1, y + 1, S[1])
    return R


def leaflitter(t):
    R = earthy('#6E5A3A', '#86704C', '#54432A', 12, 0)(t)
    for _ in range(26):
        c = ramp(hx(t.r.choice(['#C8783A', '#DCA040', '#A0522E', '#B8402C', '#8A6A30', '#D88A38'])))
        t.put(t.r.choice(LEAVES), {'a': c[3], 'b': c[2], 'c': c[1], 's': R[1]})
    for _ in range(2): x, y = t.spot(6, 2, 1); t.line(x, y, t.r.randrange(4, 7), hx('#4A3A28'), None, lambda k: k // 3)   # twigs
    return R


def forest(t):
    R = grassy('#5B6B3A', '#6E7A44', '#4A5A30', 6, 6, sigma=3.0)(t)
    for _ in range(9):
        c = ramp(hx(t.r.choice(['#C27A3A', '#D8A040', '#9A5A2A', '#8A6A30'])))
        t.put(t.r.choice(LEAVES), {'a': c[3], 'b': c[2], 'c': c[1], 's': R[0]})
    for _ in range(2): x, y = t.spot(6, 2, 1); t.line(x, y, t.r.randrange(4, 7), hx('#4A3A28'), None, lambda k: k // 3)
    return R


def cobblestones(a, b, mortar, moss=.15, grid=8):
    """round stones in staggered rows of 8 px cells: they fill the tile, so the rows run on from tile to tile"""
    def f(t):
        RA, RB, M = ramp(hx(a)), ramp(hx(b)), hx(mortar); t.a[:] = M; sh = mix(M, (40, 30, 60), .25)
        n = T // grid; rs = random.Random(zlib.crc32(f'{t.name}/seam'.encode()))
        for row in range(n):
            off = grid // 2 if row % 2 else 0
            for col in range(n):
                g = rs if off and col == n - 1 else t.r                  # the stone across the edge: the same in every tile
                if g is t.r and g.random() < .03: continue               # a missing stone now and then
                R = RA if g.random() < .6 else RB
                if g.random() < .12: R = ramp(mix(R[2], (180, 150, 120), .25))   # an odd one
                w, h = g.choice((grid - 1, grid - 1, grid - 2)), g.choice((grid - 1, grid - 2)); x0 = col * grid + off + g.randrange(0, grid - w); y0 = row * grid + g.randrange(0, grid - h)
                t.rock(x0, y0, w, h, R)
                for i in range(1, w - 1):
                    if y0 + h < T and t.get(x0 + i, y0 + h) == M: t.px(x0 + i, y0 + h, sh)
        G = ramp(hx('#5E8C46'))
        for _ in range(int(40 * moss)):                                  # moss in the joints
            x, y = t.r.randrange(T), t.r.randrange(T)
            if t.get(x, y) in (M, sh): t.px(x, y, G[t.r.choice((1, 2))])
        return RA
    return f


def setts(a, b, mortar, rows=(6, 5, 5, 6, 5, 5), widths=(6, 7, 8, 9), moss=.15, odd=.1, corner=1):
    """stones laid tight in rows: each row starts somewhere else, the stone across the edge is the same in every tile
    (so rows run on without a seam), now and then an odd stone, moss in the joints"""
    def f(t):
        RA, RB, M = ramp(hx(a)), ramp(hx(b)), hx(mortar); t.a[:] = M; sh = mix(M, (40, 30, 60), .3)
        rs = random.Random(zlib.crc32(f'{t.name}/seam'.encode())); y = 0
        def stone(g, x, w, h):
            R = RA if g.random() < .55 else RB
            if g.random() < odd: R = ramp(mix(R[2], g.choice([(196, 164, 132), (150, 152, 164), (206, 196, 176)]), .3))
            t.rock(x, y, w - 1, h - 1, R, sh, corner)
        for rh in rows:
            ws = rs.choice(widths); a0 = rs.randrange(2, ws - 1)
            stone(rs, T - a0, ws, rh)
            x, end = ws - a0, T - a0
            while x < end:
                w = t.r.choice(widths); left = end - x
                if left - w < min(widths): w = left if left <= max(widths) + 2 else left // 2
                stone(t.r, x, w, rh); x += w
            y += rh
        G = ramp(hx('#5E8C46'))
        for _ in range(int(40 * moss)):
            x, y = t.r.randrange(T), t.r.randrange(T)
            if t.get(x, y) in (M, sh): t.px(x, y, G[t.r.choice((1, 2))])
        return RA
    return f


def bond(a, b, joint, rows=(16, 16), widths=(12, 16, 16, 20, 24), moss=5):
    """slabs in a running bond: rows of slabs of a few widths, each row starting somewhere else"""
    def f(t):
        RA, RB, J = ramp(hx(a)), ramp(hx(b)), hx(joint); t.a[:] = J; y = 0; rs = random.Random(zlib.crc32(f'{t.name}/seam'.encode()))
        def slab(x, w, rh, R, hi):
            for j in range(rh - 1):
                for i in range(w - 1):
                    t.px(x + i, y + j, R[3] if j == 0 or i == 0 else R[1] if j == rh - 2 or i == w - 2 else R[2])
            if hi: t.px(x + 1, y + 1, R[4])
        for rh in rows:
            ws = rs.choice(widths); a0 = rs.randrange(3, ws - 2)        # the slab across the edge: the same in every tile
            slab(T - a0, ws, rh, RA if rs.random() < .55 else RB, rs.random() < .5)
            x, end = ws - a0, T - a0
            while x < end:
                w = t.r.choice(widths)
                if end - (x + w) < 8: w = end - x
                slab(x, w, rh, RA if t.r.random() < .55 else RB, t.r.random() < .5); x += w
            y += rh
        G = ramp(hx('#5E8C46'))
        for _ in range(moss):
            x, y = t.r.randrange(T), t.r.randrange(T)
            if t.get(x, y) == J: t.px(x, y, G[1])
        return RA
    return f


def marble(t):
    R = bond('#ECE8E0', '#E4DED4', '#C2BAAE', rows=(16, 16), widths=(16, 16, 20, 24), moss=0)(t)
    for _ in range(2):                    # soft veins
        x, y = t.r.randrange(1, T - 18), t.r.randrange(2, T - 3); ph = t.r.random() * 6
        for k in range(t.r.randrange(10, 18)):
            yy = y + int(round(math.sin(k / 3.5 + ph) * 1.5))
            c = t.get(x + k, yy)
            if c[0] > 200: t.px(x + k, yy, mix(c, hx('#B4AEC0'), .45 if k % 4 else .7))
    return R


def bricks(t):
    BT.bricks(t)
    G = ramp(hx('#5E8C46'))
    for _ in range(4):
        x, y = t.r.randrange(T), t.r.randrange(T)
        if t.get(x, y) == hx('#7E4A3C'): t.px(x, y, G[1])
    return ramp(hx('#B8664E'))


def watery(base, lite, dark, waves=5, sigma=4.0):
    def f(t):
        R = ramp(hx(base)); R[1], R[3] = hx(dark), hx(lite); R[4] = mix(hx(lite), (255, 255, 255), .5); t.a[:] = R[2]
        t.tone(R, sigma, .32, .86, k=.5)
        P = {'l': mix(R[2], R[3], .6), 'h': R[4], 'd': mix(R[2], R[1], .7)}
        for _ in range(waves): t.put(t.r.choice(WAVE), P)
        for _ in range(2): x, y = t.spot(1, 1, 1); t.px(x, y, R[4])
        return R
    return f


def dry_earth(t):
    """baked into plates: thin cracks, the far lip of each catching the light"""
    R = earthy('#B48A5A', '#C8A070', '#946C44', 8, 1)(t)
    plates(t, 6, 2, R[0], mix(R[2], R[3], .8), mix(R[2], R[1], .5))
    return R


def basalt(t):
    """the tops of basalt columns: dark plates, a hair of light on each far edge"""
    R = ramp(hx('#3E3E48')); R[1] = hx('#2C2C34'); R[3] = hx('#4E4E5A'); R[4] = hx('#5E5E6C'); t.a[:] = R[2]
    plates(t, 7, 2, R[0], R[3], R[1])
    for _ in range(4): x, y = t.spot(2, 1, 2); t.px(x, y, R[4])
    return R


def mushroom_mat(t):
    R = grassy('#6A5A7E', '#8270A0', '#54476A', 4, 4)(t)
    for _ in range(9):                    # little caps
        c = ramp(hx(t.r.choice(['#E89AC8', '#9AD8E8', '#F0D890'])))
        t.put(t.r.choice([[".hl.", "lbbd", ".s.."], [".hl.", "lbbd", "..s."], ["hl", "bd", "s."]]), {'h': c[4], 'l': c[3], 'b': c[2], 'd': c[1], 's': hx('#E8E0D0')})
    for _ in range(5): x, y = t.spot(1, 1, 1); t.px(x, y, hx(t.r.choice(['#C8F0F8', '#F8D0F0'])))   # spores
    return R


def cloud(t):
    R = ramp(hx('#E8EEF6')); R[1] = hx('#C8D4E6'); R[3] = hx('#FAFCFF'); t.a[:] = R[2]
    for _ in range(4):                    # soft puffs: lit on top, a blue shade below
        x, y = t.spot(7, 4, 1)
        t.sprite(x, y, [".hhh..", "hhhhh.", ".dddd."], {'h': R[3], 'd': R[1]})
    return R


def gold_rock(t):
    R = earthy('#8E7E64', '#A69478', '#6E6250', 18, 3, 2)(t)
    for _ in range(1 if t.plain else 3):  # gold veins with a glint (one on a plain tile: three would repeat)
        x, y = t.r.randrange(1, T - 10), t.r.randrange(3, T - 3); n = t.r.randrange(4, 9)
        for k in range(n): t.px(x + k, y + int(round(math.sin(k / 2) * 1)), hx('#E8C050') if k % 3 else hx('#FFF0A0'))
    return R


def ember_ash(t):
    R = earthy('#4A4240', '#5C5250', '#363030', 20, 0, sigma=3)(t)
    for _ in range(5): t.put([".e.", "eEe", ".s."] if t.r.random() < .4 else ["eE", "s."], {'e': hx('#E0703A'), 'E': hx('#F8B060'), 's': hx('#2E2626')})
    return R


def concrete(t):
    R = earthy('#9A9890', '#AEACA4', '#82807A', 30, 0, 0, sigma=4, k=.35)(t)
    for _ in range(0 if t.plain else t.r.choice((0, 1, 1, 2))):            # oil stains
        x, y = t.spot(7, 5, 1)
        for j in range(5):
            for i in range(7):
                if ((i - 3) / 3.5) ** 2 + ((j - 2) / 2.5) ** 2 < 1 and t.r.random() < .85: t.px(x + i, y + j, mix(t.get(x + i, y + j), (52, 50, 58), .3))
    for k in range(T): t.px(k, 0, R[1]); t.px(0, k, R[1]); t.px(k, 1, mix(R[2], R[3], .6)); t.px(1, k, mix(R[2], R[3], .6))   # the joints of 1 m slabs
    return R


def rubber(t):
    R = ramp(hx('#4A4E56')); t.a[:] = R[2]
    for y in range(T):
        for x in range(T):
            if x % 4 == 1 and y % 4 == 1: t.px(x, y, R[3])
            elif x % 4 == 2 and y % 4 == 2: t.px(x, y, R[1])
    return R


def tidepool(t):
    R = earthy('#7E786C', '#948E80', '#625C52', 14, 2)(t)
    if t.i not in (1, 3, 5, 10): return R
    P = ramp(hx('#3E86A4')); w, h = t.r.choice(((12, 6), (10, 5), (14, 6))); x, y = t.spot(w + 2, h + 2, 1); wet = mix(R[2], R[1], .6)
    for j in range(-1, h + 1):
        for i in range(-1, w + 1):
            d = ((i - (w - 1) / 2) / (w / 2)) ** 2 + ((j - (h - 1) / 2) / (h / 2)) ** 2
            if d < 1: t.px(x + i, y + j, P[1] if j == 0 else P[3] if j == h // 2 - 1 and abs(i - w / 2) < w / 4 else P[2])
            elif d < 1.45: t.px(x + i, y + j, wet)
    for _ in range(2): t.px(x + t.r.randrange(2, w - 2), y + t.r.randrange(2, h - 1), hx(t.r.choice(['#E86A6A', '#F0A040', '#E888C0'])))
    return R


def seaweed_rock(t):
    R = earthy('#6E6A62', '#86827A', '#56524C', 14, 3, 1)(t)
    S = ramp(hx('#4E6E3A'))
    for _ in range(6): t.put(t.r.choice([["a.", ".b", "a.", ".b"], ["ab", ".a", "b."], ["a", "b", "a"]]), {'a': S[3], 'b': S[1]})
    return R


def salt(t):
    """a crust of plates with low white rims, each rim's faint shadow below it"""
    R = ramp(hx('#F2EEE6')); R[1] = hx('#DCD6CA'); R[3] = hx('#FFFFFF'); t.a[:] = R[2]
    plates(t, 5, 2, R[3], mix(R[2], R[1], .7))
    return R


def duckboards(t):
    BT.boards(t, '#8A6A44', '#5E4428', '#A0804E', 8)
    for y in range(7, T, 8):
        for x in range(T): t.px(x, y, (52, 70, 60))
    return ramp(hx('#8A6A44'))


def carpet(base, pattern):
    def f(t):
        R = ramp(hx(base)); t.a[:] = R[2]
        for y in range(T):
            for x in range(T):
                if (x + y) % 2 == 0 and (x * 7 + y * 3) % 5 == 0: t.px(x, y, mix(R[2], R[1], .6))
        P = ramp(hx(pattern))
        for y in range(0, T, 16):
            for x in range(0, T, 16):
                for a, b in ((7, 4), (4, 7), (10, 7), (7, 10), (7, 7)): t.px(x + a, y + b, P[2] if (a, b) != (7, 7) else P[4])
        return R
    return f


def parquet(t):
    R = ramp(hx('#B08454')); D = ramp(hx('#96703E')); t.a[:] = R[2]
    for by in range(0, T, 8):
        for bx in range(0, T, 8):
            horiz = ((bx + by) // 8) % 2 == 0; S = R if horiz else D
            for j in range(8):
                for i in range(8):
                    k = j if horiz else i
                    t.px(bx + i, by + j, S[1] if k % 4 == 3 else S[3] if k % 4 == 0 else S[2])
    return R


def floor_tiles(a, b, line):
    def f(t):
        BT.checker(t, a, b, line, 8)
        return ramp(hx(a))
    return f


def crystal_ground(t):
    R = earthy('#4E4866', '#6A6290', '#3A3550', 12, 1, sigma=3)(t)
    for _ in range(3):
        c = ramp(hx(t.r.choice(['#7FD0E8', '#B48CF0', '#E8A0E0'])))
        t.put(t.r.choice([[".h.", "lbd", "lbd", ".s."], ["h.", "bd", "s."], [".h", "lb", "bd", "s."]]), {'h': c[4], 'l': c[3], 'b': c[2], 'd': c[1], 's': R[0]})
    return R


def pine_needles(t):
    R = earthy('#7A5E3E', '#946E48', '#5E4630', 6, 0)(t)
    for _ in range(60): t.put(t.r.choice(NEEDLE), {'a': hx(t.r.choice(['#A47A48', '#B88A54', '#8A6A3E'])), 'b': hx('#5E4630')})
    return R


def coral_sand(t):
    R = earthy('#F2D6C2', '#FCE8DA', '#DAB8A2', 18, 0, extra=sand_extra)(t)
    for _ in range(t.r.randrange(1, 3)): t.put(t.r.choice(SHELL), {'w': hx('#FFF6EE'), 'p': hx('#F0B8A8'), 's': R[1]})
    return R


def sun_stone(t):
    R = bond('#F0D8A0', '#E6C888', '#C8A060', rows=(16, 16), widths=(16, 12, 20), moss=0)(t)
    return R


# ----------------------------------------------------------------------------- v47: a floor of its own for every room
def vinyl_check(t):
    """the shop: big squares of cream and dove-grey vinyl, a fleck in the vinyl"""
    BT.checker(t, '#E6E0CC', '#A6AAB0', '#C6C0B2', 16)
    for _ in range(40):
        x, y = t.r.randrange(T), t.r.randrange(T); t.px(x, y, mix(t.get(x, y), (90, 90, 96), .12))
    return ramp(hx('#E6E0CC'))


def lab_floor(t):
    """the lab: pale, cool resin in square panels, chips of grey and white in it"""
    R = ramp(hx('#D6DEE6')); t.a[:] = R[2]
    for y in range(T):
        for x in range(T):
            if x % 16 == 15 or y % 16 == 15: t.px(x, y, mix(R[2], R[1], .45))
    for _ in range(70):
        x, y = t.r.randrange(T), t.r.randrange(T)
        if x % 16 != 15 and y % 16 != 15: t.px(x, y, hx(t.r.choice(['#9AA8BA', '#F4F8FC', '#B8C4D2', '#7C8CA0'])))
    return R


def oak_boards(t):
    """the inn: wide dark oak boards across the room, the joints staggered, grain along each board"""
    R = ramp(hx('#7E5636')); t.a[:] = R[2]
    for row in range(4):
        y0 = row * 8; jx = t.r.randrange(2, T - 2) if t.r.random() < .55 else None      # long boards: a joint only now and then
        for y in range(y0, y0 + 8):
            for x in range(T):
                c = R[0] if y == y0 + 7 else R[3] if y == y0 else R[2]
                if y in (y0 + 2, y0 + 5) and (x + row * 7 + y) % 11 < 6: c = mix(R[2], R[1], .55)
                if x == jx and y < y0 + 7: c = R[0]
                t.px(x, y, c)
    return R


def marble_check(t):
    """the Savings & Loan: black and white marble squares, a vein wandering through each"""
    W, K = ramp(hx('#ECE8E2')), ramp(hx('#34403E'))
    for y in range(T):
        for x in range(T):
            S = W if ((x // 16) + (y // 16)) % 2 == 0 else K
            t.px(x, y, S[1] if x % 16 == 15 or y % 16 == 15 else S[2])
    for sq in range(4):
        bx, by = (sq % 2) * 16, (sq // 2) * 16; S = W if (sq % 2 + sq // 2) % 2 == 0 else K
        x, y = bx + t.r.randrange(1, 5), by + t.r.randrange(2, 13)
        for k in range(13):
            if bx <= x < bx + 15 and by <= y < by + 15: t.px(x, y, S[1] if S is W else S[3])
            x += 1; y += t.r.choice((-1, 0, 0, 1))
    return W


def herringbone(t):
    """the library: honey-coloured wood in a herringbone (a chevron of short blocks)"""
    R, D = ramp(hx('#C08C52')), ramp(hx('#A87644'))
    for y in range(T):
        for x in range(T):
            v = (x + y) if (x // 8) % 2 == 0 else (y - x + 32)
            S = R if (v // 4) % 2 else D
            c = S[1] if v % 4 == 3 else S[3] if v % 4 == 0 else S[2]
            if x % 8 == 7: c = mix(c, S[0], .5)
            t.px(x, y, c)
    return R


def linoleum(t):
    """the school: sage linoleum, marbled, a seam between the sheets"""
    R = ramp(hx('#C4CEBC')); t.a[:] = R[2]
    f = t.field(2.5, salt=3)
    for y in range(T):
        for x in range(T):
            v = f[y, x]
            if v < .22: t.px(x, y, mix(R[2], R[1], .5))
            elif v > .8: t.px(x, y, mix(R[2], R[3], .55))
    for y in range(T): t.px(T - 1, y, mix(t.get(T - 1, y), R[1], .35))
    for _ in range(25):
        x, y = t.r.randrange(T), t.r.randrange(T); t.px(x, y, mix(t.get(x, y), (255, 255, 255), .35))
    return R


def granite(t):
    """the station: big polished granite flags, salt and pepper, thin dark joints"""
    R = ramp(hx('#8E9096'))
    for y in range(T):
        for x in range(T): t.px(x, y, R[0] if x % 16 == 15 or y % 16 == 15 else R[2])
    for _ in range(170):
        x, y = t.r.randrange(T), t.r.randrange(T)
        if x % 16 != 15 and y % 16 != 15: t.px(x, y, t.r.choice([R[0], R[1], R[3], R[4], hx('#E8E4E0'), hx('#2E3036')]))
    for k in range(4):
        bx, by = (k % 2) * 16, (k // 2) * 16; t.px(bx + 2, by + 2, R[4]); t.px(bx + 3, by + 2, R[3])
    return R


def epoxy(t):
    """the fire station: glossy red painted concrete"""
    R = ramp(hx('#A84A40')); t.a[:] = R[2]
    t.tone(R, sigma=3.0, lo=.2, hi=.86, k=.25)
    for _ in range(8):
        x, y = t.r.randrange(T), t.r.randrange(T); t.px(x, y, R[4])
    return R


STRAW = [["ab.", ".ab"], ["aab"], ["a", "b", "a"], ["ba.", ".ba", "..b"], ["aaab"], [".a", "ab", "b."]]


def straw_floor(t):
    """the barn: packed earth strewn with straw"""
    R = earthy('#7E6040', '#94744E', '#664C32', 14, 1)(t)
    for _ in range(48): t.put(t.r.choice(STRAW), {'a': hx(t.r.choice(['#E8C870', '#D8B058', '#F2DA8A'])), 'b': hx('#B08A3E')})
    return R


def brick_floor(t):
    """the greenhouse: bricks in a basket weave, moss in the joints"""
    A, B = ramp(hx('#B85E44')), ramp(hx('#A44E3A')); J = hx('#6E5A44'); G = ramp(hx('#5E8C46'))
    for y in range(T):
        for x in range(T):
            cx, cy = x // 8, y // 8; horiz = (cx + cy) % 2 == 0
            u, v = (x % 8, y % 8) if horiz else (y % 8, x % 8)
            S = A if ((cx * 3 + cy * 5) + v // 4) % 2 else B
            t.px(x, y, J if v % 4 == 3 or u == 7 else S[3] if v % 4 == 0 else S[2])
    for _ in range(14):
        x, y = t.r.randrange(T), t.r.randrange(T)
        if t.get(x, y) == J: t.px(x, y, G[2] if t.r.random() < .6 else G[3])
    return A


def pine_boards(t):
    """the ski lodge: light knotty pine boards running away from you"""
    R = ramp(hx('#D4A266'))
    for x in range(T):
        col = x // 8
        for y in range(T):
            c = R[0] if x % 8 == 7 else R[3] if x % 8 == 0 else R[2]
            if x % 8 in (2, 3, 5) and (y + col * 7) % 13 in (0, 6): c = R[1]
            t.px(x, y, c)
    for col in range(4):
        jy = (col * 11 + 3) % T
        for x in range(col * 8, col * 8 + 7): t.px(x, jy, R[0])
    for _ in range(3):
        x, y = t.r.randrange(1, T - 3), t.r.randrange(1, T - 3)
        if x % 8 < 5: t.px(x, y, hx('#8A5A30')); t.px(x + 1, y, hx('#6E4422')); t.px(x, y + 1, hx('#A8743E'))
    return R


def hex_tiles(t):
    """the market hall: hexagonal quarry tiles in two ochres, dark grout"""
    A, B = ramp(hx('#C88A52')), ramp(hx('#B27444')); G = hx('#6A4E38')
    C = [(8 * i + 4 * (j % 2), 8 * j, (i + j) % 2) for j in range(-1, 6) for i in range(-1, 6)]
    for y in range(T):
        for x in range(T):
            ds = sorted((math.hypot(x + .5 - cx, y + .5 - cy), k, cx, cy) for (cx, cy, k) in C)[:2]
            (d1, k, cx, cy), d2 = ds[0], ds[1][0]
            if d2 - d1 < .9: t.px(x, y, G); continue
            S = A if k else B; s = (x + .5 - cx) + (y + .5 - cy)
            t.px(x, y, S[3] if s < -3.5 else S[2] if s < 3 else S[1])
    return A


# ---------------------------------------------------- v47 part 4: the region towns' shops, each a room with its own floor
def painted_boards(t):
    """Twofold Market: floorboards painted the Meadowlands' teal, worn back to the wood along the joints, and now and
    then a pink flower stencilled on (the market's own idea, not Poppy's)"""
    R, Wd = ramp(hx('#7CB8AE')), ramp(hx('#B08A5C'))
    for row in range(4):
        y0 = row * 8; jx = t.r.randrange(3, T - 3) if t.r.random() < .5 else None
        for y in range(y0, y0 + 8):
            for x in range(T):
                c = R[0] if y == y0 + 7 else R[3] if y == y0 else R[2]
                if y in (y0 + 1, y0 + 6) and (x * 5 + row * 11 + y) % 13 < 3: c = Wd[2] if y == y0 + 6 else Wd[3]   # paint worn off
                if x == jx and y < y0 + 7: c = R[0]
                t.px(x, y, c)
    if not t.plain and not t.thin and t.r.random() < .6:
        P = ramp(hx('#E89AC0')); x, y = t.spot(5, 5, 1); y = (y // 8) * 8 + 1
        for i, j in ((2, 0), (0, 2), (4, 2), (2, 4), (1, 1), (3, 1), (1, 3), (3, 3)): t.px(x + i, y + j, P[2] if (i + j) % 2 == 0 else P[3])
        t.px(x + 2, y + 2, hx('#F6D86A'))
    return R


def gold_terrazzo(t):
    """the Bullion Exchange: charcoal terrazzo full of white chips and gold flakes, brass strips between the squares"""
    R = ramp(hx('#3A3632')); B = ramp(hx('#B08C40'))
    for y in range(T):
        for x in range(T): t.px(x, y, mix(B[2], R[2], .35) if x % 16 == 15 or y % 16 == 15 else R[2])
    for _ in range(90):
        x, y = t.r.randrange(T), t.r.randrange(T)
        if x % 16 != 15 and y % 16 != 15: t.px(x, y, t.r.choice([R[1], R[1], R[3], R[3], mix(R[2], hx('#D8D2C4'), .5)]))
    for _ in range(4 if t.plain else 7):
        x, y = t.r.randrange(T), t.r.randrange(T)
        if x % 16 != 15 and y % 16 != 15: t.px(x, y, t.r.choice([B[3], B[4]]))
    return R


def cork_tiles(t):
    """the Cap Market: squares of cork, the granules in two browns, the grain turned in every other square"""
    A, B = ramp(hx('#B88A5A')), ramp(hx('#A87C50')); G = hx('#7A5634')
    for y in range(T):
        for x in range(T):
            S = A if ((x // 16) + (y // 16)) % 2 == 0 else B
            t.px(x, y, G if x % 16 == 15 or y % 16 == 15 else S[2])
    for _ in range(260):
        x, y = t.r.randrange(T), t.r.randrange(T)
        if x % 16 == 15 or y % 16 == 15: continue
        S = A if ((x // 16) + (y // 16)) % 2 == 0 else B; c = t.r.choice([S[1], S[1], S[3], S[0]])
        t.px(x, y, c)
        if t.r.random() < .4 and (x + 1) % 16 != 15 and x + 1 < T: t.px(x + 1, y, c)
    return A


def slate_flags(t):
    """the Assay Office: dark blue-grey slate flags split along their layers, a grain of crystal caught in a joint"""
    R = ramp(hx('#4E5664')); J = hx('#262A32')
    rows = [(0, 11), (11, 21), (21, 32)]
    for k, (y0, y1) in enumerate(rows):
        cuts = [0, 13 + 3 * k % 7, 32] if k % 2 == 0 else [0, 7 + 2 * k, 21 + k, 32]
        for y in range(y0, y1):
            for x in range(T):
                edge = y == y1 - 1 or x in cuts[1:-1]
                c = J if edge else R[3] if y == y0 else R[2]
                if not edge and (y * 3 + (x // 5) * 7 + k) % 9 == 0: c = mix(R[2], R[1], .6)          # the cleft layers
                t.px(x, y, c)
    if not t.plain:
        for _ in range(t.r.randrange(1, 3)):
            x, y = t.r.randrange(1, T - 1), t.r.choice([10, 20]); c = ramp(hx(t.r.choice(['#7FD0E8', '#B48CF0'])))
            t.px(x, y, c[3]); t.px(x, y - 1, c[4])
    return R


def teak_deck(t):
    """the Chandlery: narrow teak deck planks with black caulking between them, a brass nail at each plank's end"""
    R = ramp(hx('#A8784A')); K = hx('#2A2018'); N = hx('#D8B060')
    for row in range(8):
        y0 = row * 4; jx = (row * 11 + t.r.randrange(0, 7)) % T if t.r.random() < .4 else None
        for y in range(y0, y0 + 4):
            for x in range(T):
                c = K if y == y0 + 3 else R[3] if y == y0 else R[2]
                if y == y0 + 1 and (x + row * 5) % 9 < 3: c = mix(R[2], R[1], .5)              # the grain
                if x == jx and y < y0 + 3: c = K
                t.px(x, y, c)
        if jx is not None:
            for nx in (jx - 1, jx + 1):
                if 0 <= nx < T: t.px(nx, y0 + 1, N)
    return R


def neon_tiles(t):
    """the Night Market: near-black tiles, their grout lit pink and teal in places by the signs, a sheen on the glaze"""
    R = ramp(hx('#26242E')); C, P = ramp(hx('#3ED8C8')), ramp(hx('#F05AAE'))
    for y in range(T):
        for x in range(T): t.px(x, y, mix(R[1], R[0], .4) if x % 16 == 15 or y % 16 == 15 else R[2])
    if not t.plain:                                                                       # the sheen on a square or two
        for k in t.r.sample(range(4), 2):
            bx, by = (k % 2) * 16, (k // 2) * 16; ox, oy = t.r.randrange(2, 7), t.r.randrange(2, 7)
            for i in range(5): t.px(bx + ox + i, by + oy + i // 2, mix(R[2], R[4], .22))
    if not t.thin:
        n = 1 if t.plain else 2
        for _ in range(n):
            S = C if t.r.random() < .6 else P; horiz = t.r.random() < .5; at = t.r.choice([15, 31]); a = t.r.randrange(0, 12); L = t.r.randrange(6, 12)
            for k in range(a, min(T, a + L)):
                x, y = (k, at) if horiz else (at, k)
                t.px(x, y, mix(S[2], R[1], .35))
    return R

# name: (recipe, class, detail touches for tiles 2-6 and 10)
KINDS = {
 'grass': (grassy('#6CBA59', '#8FD06F', '#4E9A47'), 'grass', ['clover', 'pebble', 'flower', 'tuft', 'dark', 'light']),
 'meadow': (grassy('#7CAE52', '#9CC466', '#5E8E3E', 9, 6, meadow_extra), 'grass', ['flower', 'tuft', 'seed', 'flower', 'light', 'seed']),
 'flowers': (grassy('#68B656', '#8CCC6C', '#4C9644', 6, 6, flowers_extra), 'grass', ['flower', 'flower', 'clover', 'flower', 'tuft', 'flower']),
 'tallgrass': (lambda t: (BT.tallgrass(t), ramp(hx('#4E9A47')))[1], 'grass', ['dark', 'light', 'tuft', 'dark', 'light', 'tuft']),
 'path': (earthy('#D9B27C', '#E9C894', '#B88D5A', 22, 3, 0), 'earth', ['pebble', 'crack', 'puddle', 'leaves', 'tuft', 'pebble']),
 'plaza': (setts('#D8D2C2', '#C8C0AC', '#A8A090', (8, 8, 8, 8), (8, 10, 12, 14)), 'paved', ['crack', 'moss', 'stain', 'light', 'dark', 'moss']),
 'sand': (earthy('#EED9A2', '#F8EAC0', '#D6BC80', 14, 0, extra=sand_extra), 'earth', ['pebble', 'shell', 'ripple', 'light', 'dark', 'shell']),
 'water': (watery('#4BA8DA', '#BDEAF6', '#3A90C6'), 'water', ['light', 'ripple', 'dark', 'light', 'ripple', 'glint']),
 'deep': (watery('#2F7DBA', '#7FC2E8', '#24679E', 3), 'water', ['dark', 'ripple', 'light', 'dark', 'ripple', 'glint']),
 'rock': (rocky('#A19B90', '#BAB4A8', '#837D74', (178, 172, 162)), 'earth', ['crack', 'moss', 'pebble', 'dark', 'light', 'crack']),
 'cave': (rocky('#6E6878', '#857F90', '#58526A', (128, 120, 142), 3), 'earth', ['crack', 'glint', 'pebble', 'dark', 'light', 'glint']),
 'mall': (lambda t: (BT.checker(t, '#F2EBDD', '#D9E9E4', '#C5BCAA'), ramp(hx('#F2EBDD')))[1], 'floor', ['scuff', 'light', 'scuff', 'light', 'glint', 'scuff']),
 'soil': (lambda t: (BT.soil(t), ramp(hx('#8A5E3C')))[1], 'earth', ['pebble', 'tuft', 'dark', 'light', 'pebble', 'tuft']),
 'boards': (lambda t: (BT.boards(t), ramp(hx('#B9844E')))[1], 'floor', ['knot', 'dark', 'light', 'knot', 'nail', 'knot']),
 'scrap': (lambda t: (BT.scrap(t), ramp(hx('#8C8478')))[1], 'earth', ['stain', 'bolt', 'crack', 'pebble', 'dark', 'bolt']),
 'snow': (snowy, 'earth', ['light', 'pebble', 'ripple', 'light', 'dark', 'ripple']),
 'asphalt': (earthy('#5C5E66', '#6E717A', '#4A4C54', 46, 0, 0, sigma=4, k=.35), 'paved', ['crack', 'stain', 'patch', 'light', 'manhole', 'crack']),
 'pavers': (bond('#C9C3B6', '#BDB6A8', '#8F887C'), 'paved', ['crack', 'moss', 'stain', 'light', 'dark', 'moss']),
 'bricks': (bricks, 'paved', ['crack', 'moss', 'dark', 'light', 'stain', 'moss']),
 'gravel': (gravelly, 'earth', ['pebble', 'dark', 'light', 'pebble', 'tuft', 'pebble']),
 'dirt': (earthy('#9C7350', '#B48A62', '#7E5A3E', 22, 4, 1), 'earth', ['pebble', 'crack', 'tuft', 'puddle', 'leaves', 'pebble']),
 'forest': (forest, 'grass', ['leaves', 'tuft', 'dark', 'leaves', 'light', 'leaves']),
 'steps': (lambda t: (BT.steps(t), ramp(hx('#B6AFA2')))[1], 'paved', ['crack', 'moss', 'light', 'dark', 'light', 'moss']),
 'lawn': (lambda t: (BT.lawn(t), ramp(hx('#74C45E')))[1], 'grass', ['light', 'clover', 'dark', 'light', 'flower', 'clover']),
 'ash': (lambda t: (BT.ash(t), ramp(hx('#5A524E')))[1], 'earth', ['ember', 'dark', 'light', 'ember', 'pebble', 'ember']),
 'basalt': (basalt, 'earth', ['crack', 'glint', 'light', 'dark', 'crack', 'glint']),
 # v46 kinds, redrawn with their own features
 'clover': (grassy('#5AA852', '#7EC266', '#428A40', 5, 5, clover_extra), 'grass', ['flower', 'clover', 'light', 'dark', 'tuft', 'clover']),
 'moss': (grassy('#5E8C46', '#7EAA58', '#466E36', 0, 3, moss_extra, sigma=2.0), 'grass', ['pebble', 'dark', 'light', 'pebble', 'dark', 'pebble']),
 'mud': (mud, 'earth', ['puddle', 'pebble', 'dark', 'puddle', 'leaves', 'puddle']),
 'wetsand': (wetsand, 'earth', ['shell', 'puddle', 'pebble', 'shell', 'light', 'puddle']),
 'pebbles': (pebbles, 'earth', ['moss', 'dark', 'light', 'moss', 'tuft', 'light']),
 'cobble': (setts('#9E968A', '#8C8478', '#5E584F', (7, 6, 7, 6, 6), (5, 6, 7, 8, 9), .3, .12), 'paved', ['moss', 'crack', 'stain', 'dark', 'light', 'moss']),
 'leaflitter': (leaflitter, 'earth', ['leaves', 'pebble', 'leaves', 'dark', 'leaves', 'tuft']),
 'heather': (grassy('#5E6A40', '#76825A', '#465030', 5, 5, heather_extra), 'grass', ['flower', 'tuft', 'flower', 'dark', 'light', 'flower']),
 'marsh': (grassy('#557A48', '#6E9258', '#3F5E3A', 7, 5, marsh_extra), 'grass', ['puddle', 'tuft', 'puddle', 'dark', 'light', 'puddle']),
 'marble': (marble, 'paved', ['crack', 'stain', 'light', 'dark', 'light', 'crack']),
 'ice': (ice, 'earth', ['crack', 'light', 'glint', 'crack', 'dark', 'glint']),
 'crystal': (crystal_ground, 'earth', ['glint', 'crystal', 'glint', 'crystal', 'dark', 'crystal']),
 # v47 kinds
 'dryearth': (dry_earth, 'earth', ['pebble', 'crack', 'dark', 'light', 'pebble', 'tuft']),
 'sunburnt': (grassy('#B8A458', '#D0BC70', '#98863E', 8, 6, sunburnt_extra), 'grass', ['tuft', 'seed', 'light', 'dark', 'pebble', 'seed']),
 'wildflowers': (grassy('#78B058', '#98C870', '#5A9244', 5, 5, wild_extra), 'grass', ['flower', 'flower', 'flower', 'seed', 'flower', 'flower']),
 'pineneedles': (pine_needles, 'earth', ['pinecone', 'root', 'dark', 'pinecone', 'root', 'light']),
 'mushroommat': (mushroom_mat, 'grass', ['glow', 'glow', 'dark', 'light', 'glow', 'glow']),
 'coralsand': (coral_sand, 'earth', ['shell', 'coral', 'shell', 'light', 'coral', 'shell']),
 'cloudfloor': (cloud, 'earth', ['light', 'light', 'dark', 'light', 'glint', 'light']),
 'skystone': (setts('#C8D0E0', '#B8C2D6', '#8C96AE', (8, 8, 8, 8), (8, 10, 12, 12), 0, .08), 'paved', ['glint', 'crack', 'light', 'dark', 'glint', 'glint']),
 'goldrock': (gold_rock, 'earth', ['gold', 'crack', 'gold', 'dark', 'light', 'gold']),
 'sunstone': (sun_stone, 'paved', ['crack', 'light', 'gold', 'light', 'dark', 'gold']),
 'emberash': (ember_ash, 'earth', ['ember', 'ember', 'dark', 'ember', 'light', 'ember']),
 'concrete': (concrete, 'paved', ['stain', 'crack', 'stain', 'patch', 'light', 'stain']),
 'rubber': (rubber, 'floor', ['stain', 'light', 'dark', 'stain', 'light', 'dark']),
 'tidepool': (tidepool, 'earth', ['shell', 'crab', 'dark', 'light', 'shell', 'crab']),
 'seaweedrock': (seaweed_rock, 'earth', ['shell', 'moss', 'dark', 'light', 'shell', 'moss']),
 'salt': (salt, 'earth', ['light', 'glint', 'light', 'dark', 'glint', 'light']),
 'duckboards': (duckboards, 'floor', ['knot', 'moss', 'dark', 'knot', 'nail', 'moss']),
 'carpetred': (carpet('#A84A4A', '#E0B060'), 'floor', ['stain', 'light', 'dark', 'light', 'dark', 'light']),
 'carpetblue': (carpet('#4A5E9A', '#D8C890'), 'floor', ['stain', 'light', 'dark', 'light', 'dark', 'light']),
 'parquet': (parquet, 'floor', ['knot', 'light', 'dark', 'stain', 'light', 'dark']),
 'tilesgreen': (floor_tiles('#E8EEE4', '#9CC4A8', '#B8C0B4'), 'floor', ['scuff', 'light', 'glint', 'light', 'scuff', 'light']),
 'tilesterra': (floor_tiles('#D88A5E', '#C8784C', '#A86040'), 'floor', ['crack', 'light', 'scuff', 'stain', 'light', 'scuff']),
 # v47: a floor of its own for every room
 'vinylcheck': (vinyl_check, 'floor', ['scuff', 'light', 'glint', 'stain', 'scuff', 'light']),
 'labfloor': (lab_floor, 'floor', ['scuff', 'glint', 'light', 'stain', 'scuff', 'glint']),
 'oakboards': (oak_boards, 'floor', ['knot', 'light', 'dark', 'nail', 'knot', 'stain']),
 'marblecheck': (marble_check, 'floor', ['glint', 'light', 'scuff', 'glint', 'light', 'stain']),
 'herringbone': (herringbone, 'floor', ['knot', 'light', 'dark', 'stain', 'light', 'glint']),
 'linoleum': (linoleum, 'floor', ['scuff', 'light', 'stain', 'scuff', 'glint', 'light']),
 'granite': (granite, 'floor', ['glint', 'light', 'crack', 'glint', 'light', 'stain']),
 'epoxy': (epoxy, 'floor', ['scuff', 'manhole', 'glint', 'stain', 'scuff', 'light']),
 'strawfloor': (straw_floor, 'floor', ['dark', 'light', 'stain', 'dark', 'light', 'stain']),
 'brickfloor': (brick_floor, 'floor', ['moss', 'light', 'crack', 'moss', 'dark', 'light']),
 'pineboards': (pine_boards, 'floor', ['knot', 'light', 'nail', 'knot', 'dark', 'light']),
 'hextiles': (hex_tiles, 'floor', ['crack', 'light', 'scuff', 'stain', 'light', 'scuff']),
 # v47 part 4: the shops of the region towns
 'paintedboards': (painted_boards, 'floor', ['scuff', 'light', 'knot', 'scuff', 'dark', 'light']),
 'goldterrazzo': (gold_terrazzo, 'floor', ['glint', 'stain', 'scuff', 'glint', 'scuff', 'glint']),   # no light/dark patches: they show as blotches on a dark floor
 'corktiles': (cork_tiles, 'floor', ['scuff', 'light', 'dark', 'stain', 'light', 'scuff']),
 'slateflags': (slate_flags, 'floor', ['crack', 'glint', 'light', 'crack', 'dark', 'glint']),
 'teakdeck': (teak_deck, 'floor', ['knot', 'light', 'stain', 'knot', 'dark', 'light']),
 'neontiles': (neon_tiles, 'floor', ['glint', 'scuff', 'stain', 'glint', 'scuff', 'glint']),
}

# the v47 kinds' catalogue entries: letter, name, z (higher laps over lower), edge colour, paved, walk
NEW47 = {
 'A': ('dryearth', 'Dry earth', 2, '#7E5E3A', False, True), 'B': ('sunburnt', 'Sunburnt grass', 4, '#7A6A32', False, True),
 'E': ('wildflowers', 'Wildflower meadow', 4, '#46803A', False, True), 'F': ('pineneedles', 'Pine needles', 3, '#4E3A26', False, True),
 'J': ('mushroommat', 'Mushroom mat', 4, '#3E3452', False, True), 'N': ('coralsand', 'Coral sand', 1, '#C49C86', False, True),
 'U': ('cloudfloor', 'Cloud floor', 2, '#A8B6CC', False, True), 'V': ('skystone', 'Sky stone', 3, '#7C86A0', True, True),
 'W': ('goldrock', 'Gold-veined rock', 3, '#5E5040', False, True), 'Y': ('sunstone', 'Sun-baked stone', 3, '#A8844E', True, True),
 'Z': ('emberash', 'Ember ash', 2, '#2E2626', False, True), 'i': ('concrete', 'Concrete', 3, '#6E6C66', True, True),
 '1': ('rubber', 'Rubber matting', 3, '#33363C', True, True), '2': ('tidepool', 'Tide pools', 2, '#4E4A42', False, True),
 '3': ('seaweedrock', 'Seaweed rock', 2, '#46423C', False, True), '4': ('salt', 'Salt crust', 1, '#BEB6A8', False, True),
 '5': ('duckboards', 'Duckboards', 3, '#4E3A22', True, True), '6': ('carpetred', 'Carpet (red)', 3, '#6E2E2E', True, True),
 '7': ('carpetblue', 'Carpet (blue)', 3, '#2E3A62', True, True), '8': ('parquet', 'Parquet', 3, '#6E522E', True, True),
 '9': ('tilesgreen', 'Floor tiles (green)', 3, '#7E9A86', True, True), '0': ('tilesterra', 'Floor tiles (terracotta)', 3, '#8A4E32', True, True),
 # v47: a floor of its own for every room (the letters and digits are all taken, so these are signs)
 'O': ('vinylcheck', 'Checked vinyl', 3, '#7E7A70', True, True), 'Q': ('labfloor', 'Lab floor', 3, '#7E8A98', True, True),
 '!': ('oakboards', 'Oak boards', 3, '#3E2A1A', True, True), '#': ('marblecheck', 'Marble checks', 3, '#4A5250', True, True),
 '%': ('herringbone', 'Herringbone parquet', 3, '#6E4E2C', True, True), ':': ('linoleum', 'Linoleum', 3, '#7E8A78', True, True),
 ';': ('granite', 'Granite flags', 3, '#4E5056', True, True), '=': ('epoxy', 'Red epoxy floor', 3, '#5E2A24', True, True),
 '~': ('strawfloor', 'Straw-strewn floor', 3, '#5A4430', True, True), '_': ('brickfloor', 'Brick basket weave', 3, '#6E3A2C', True, True),
 '+': ('pineboards', 'Pine boards', 3, '#7E5C38', True, True), '*': ('hextiles', 'Hexagon tiles', 3, '#6E4A30', True, True),
 # v47 part 4: a floor for each region town's shop
 '$': ('paintedboards', 'Painted boards', 3, '#3E6E66', True, True), '(': ('goldterrazzo', 'Gold terrazzo', 3, '#2A2622', True, True),
 ')': ('corktiles', 'Cork tiles', 3, '#6E4E30', True, True), '-': ('slateflags', 'Slate flags', 3, '#262A32', True, True),
 '[': ('teakdeck', 'Teak deck', 3, '#4E3620', True, True), ']': ('neontiles', 'Neon-lit tiles', 3, '#16141C', True, True),
}
SOIL = '#8A6A44'
SOIL_OF = {'mushroommat': '#4A3E56', 'sunburnt': '#9A7A4A', 'heather': '#5E4A36', 'marsh': '#4E4434', 'moss': '#5A4A36',
           'forest': '#5A4632', 'tallgrass': '#7A5E3E'}


# ------------------------------------------------------------------------------------- the touched tiles
def touch(t, kind, R, cls):
    r = t.r; P = kpal(R)
    if kind == 'seed': meadow_extra(t, R)
    elif kind == 'tuft':
        G = R if cls == 'grass' else ramp(hx('#5E9A4A'))
        x, y = r.randrange(T), r.randrange(T)
        for _ in range(r.randrange(2, 4)): t.put(r.choice(TUFTS), kpal(G), near=(x, y, 4, 2))
    elif kind == 'pebble':
        S = stone_ramp(R, (160, 154, 146)); sh = mix(R[2], R[1], .7)
        for _ in range(r.randrange(2, 4)): t.stone_at(r.choice((2, 3, 4)), r.choice((2, 3)), S, sh)
    elif kind == 'flower': clump(t, R, list(FLOWER_COLS), r.randrange(3, 5))
    elif kind == 'clover': clover_extra(t, R) if cls == 'grass' else None
    elif kind == 'dark': t.soft(4, .35, lambda c: mix(c, R[1], .35))
    elif kind == 'light': t.soft(4, .35, lambda c: mix(c, R[3], .35))
    elif kind == 'crack':
        line = (240, 248, 255) if t.name == 'ice' else mix(R[1], R[0], .5) if cls in ('paved', 'floor') else None
        lip = R[1] if t.name == 'ice' else None
        for _ in range(r.randrange(1, 3)): t.crack2(R, line=line, lip=lip)
    elif kind == 'puddle': puddle(t, R, r.randrange(6, 9), 3)
    elif kind == 'leaves':
        for _ in range(r.randrange(3, 6)):
            c = ramp(hx(r.choice(['#C27A3A', '#D8A040', '#9A5A2A', '#B8402C'])))
            t.put(r.choice(LEAVES), {'a': c[3], 'b': c[2], 'c': c[1], 's': R[1]})
    elif kind == 'moss':
        G = ramp(hx('#5E8C46')); x, y = r.randrange(T), r.randrange(T)
        for _ in range(r.randrange(4, 8)): t.put(r.choice([["hl", "ld"], ["l", "d"], ["hl.", "lld"]]), {'h': G[4], 'l': G[3], 'd': G[1]}, near=(x, y, 3, 2))
    elif kind == 'stain': t.soft(3, .14, lambda c: mix(c, R[1], .22), salt=r.randrange(99))      # in the kind's own shade, never grey
    elif kind == 'shell': [t.put(r.choice(SHELL), {'w': hx('#F4EEE6'), 'p': hx('#E6C8C0'), 's': R[1]}) for _ in range(r.randrange(1, 3))]
    elif kind == 'ripple':
        if cls == 'water': t.put(["..ll..", ".l..l.", "l....l"], {'l': mix(R[2], R[3], .6)})
        else:
            c, l = mix(R[2], R[1], .45), mix(R[2], R[3], .6)
            for _ in range(2):
                x, y = r.randrange(2, T - 14), r.randrange(3, T - 3); ph = r.random() * 6
                t.line(x, y, r.randrange(8, 13), c, l, lambda k: int(round(math.sin(k / 2.2 + ph))))
    elif kind == 'glint':
        for _ in range(r.randrange(1, 3)): t.put([".h.", "hHh", ".h."], {'h': mix(R[3], (255, 255, 255), .5), 'H': (255, 255, 255)})
    elif kind == 'pinecone': x, y = t.spot(4, 5, 1); t.rock(x, y, 3, 4, ramp(hx('#8A5E34')), mix(R[2], R[1], .7))
    elif kind == 'root':
        x, y = r.randrange(1, T - 15), r.randrange(4, T - 4)
        t.line(x, y, r.randrange(8, 14), hx('#5A3E28'), hx('#7A5A3A'), lambda k: int(round(math.sin(k / 3) * 1.4)))
    elif kind == 'glow':
        for _ in range(4): x, y = t.spot(2, 1, 1); c = hx(r.choice(['#B8F0FF', '#F8C0F0', '#F8F0A0'])); t.px(x, y, c); t.px(x + 1, y, mix(c, (255, 255, 255), .5))
    elif kind == 'coral':
        c = ramp(hx(r.choice(['#E86A6A', '#F0A060', '#E888C0']))); t.put(["a.a", "bab", ".b."], {'a': c[3], 'b': c[2]})
    elif kind == 'gold':
        x, y = r.randrange(1, T - 7), r.randrange(2, T - 3)
        for k in range(5): t.px(x + k, y + (k % 2), hx('#F0C850') if k % 2 else hx('#FFF0A0'))
    elif kind == 'crab': t.put(["c..c", ".bb.", "c..c"], {'b': hx('#E06040'), 'c': hx('#C04830')})
    elif kind == 'crystal':
        c = ramp(hx(r.choice(['#7FD0E8', '#B48CF0', '#E8A0E0']))); t.put([".h.", "lbd", "lbd", ".s."], {'h': c[4], 'l': c[3], 'b': c[2], 'd': c[1], 's': R[0]})
    elif kind == 'ember': t.put(["eE", "s."], {'e': hx('#E0703A'), 'E': hx('#F8B060'), 's': R[0]})
    elif kind == 'scuff':                          # polished floors: a short scuff, a glint of polish
        x, y = t.spot(5, 2, 2); t.line(x, y, r.randrange(3, 5), mix(R[2], R[1], .35))
        x, y = t.spot(3, 3, 2); t.put([".h.", "hHh", ".h."], {'h': mix(R[2], (255, 255, 255), .5), 'H': (255, 255, 255)}, near=(x, y, 0, 0))
    else: x, y = t.spot(8, 6, 1); _feature_at(t, kind, R, x, y)


def _feature_at(t, kind, R, x, y):
    """knots, nails, bolts, patches and manholes, drawn inside the tile"""
    if kind == 'knot':
        K = ramp(hx('#7E5530')); t.rect(x, y, 3, 2, K[1]); t.px(x + 1, y, K[0]); t.px(x + 3, y + 1, K[2])
    elif kind == 'nail': t.px(x, y, (70, 72, 84)); t.px(x + 1, y, (120, 124, 136))
    elif kind == 'bolt': t.rect(x, y, 2, 2, (70, 72, 84)); t.px(x, y, (120, 124, 136))
    elif kind == 'patch': t.rect(x, y, 6, 4, mix(R[2], R[1], .5)); t.px(x + 5, y + 3, R[1])
    elif kind == 'manhole':
        for j in range(5):
            for i in range(7):
                if (i in (0, 6)) and (j in (0, 4)): continue
                t.px(x + i, y + j, R[1] if (i + j) % 2 else R[0])
        for i in range(1, 6): t.px(x + i, y, R[3])


def damp(t, R, cls):
    """a patch a step darker and a touch richer in the kind's own colours (no grey), inside the tile"""
    if cls == 'grass' and R[2][1] > max(R[2][0], R[2][2]): fn = lambda c: (int(c[0] * .82), int(min(255, c[1] * .94)), int(c[2] * .82))
    elif cls == 'grass': fn = lambda c: mix(c, R[1], .45)
    elif cls == 'paved': fn = lambda c: mix(c, R[1], .16)
    elif cls == 'floor': fn = lambda c: mix(c, R[1], .1)
    else: fn = lambda c: mix(c, R[1], .45)
    t.soft(4.0, .3, fn)
    if cls == 'paved':
        G = ramp(hx('#5E8C46'))
        for _ in range(12):
            x, y = t.r.randrange(T), t.r.randrange(T); c = t.get(x, y)
            if sum(c) < sum(R[2]) * .82: t.px(x, y, G[1])                 # moss only in the joints and shade


def worn(t, R, cls, strength):
    """v47: the trodden track is laid by the painter in world metres (walk-view.js: bare soil in patches on plant
    cover, packed and paler earth), most along the middle of the line people walk, so it runs on from tile to tile.
    The worn tiles themselves only carry fewer details (Tile.thin). Floors and paving (never worn by the painter)
    get a soft polish, so their twelve still differ"""
    if cls in ('paved', 'floor'): t.soft(4.0, .3 * strength, lambda c: mix(c, R[3], .14), salt=11)


def vary(t, R):
    """floors laid from a pattern would come out the same twelve times: one block a hair darker, one a hair lighter"""
    for c in (R[1], R[3]):
        bx, by = t.r.randrange(0, T, 8), t.r.randrange(0, T, 8)
        for y in range(by, by + 8):
            for x in range(bx, bx + 8): t.px(x, y, mix(t.get(x, y), c, .07))


# kinds the painter lets reach a few pixels over their neighbours (the catalogue's `grow`): plant cover (blades over a
# path's edge, moss in the joints of paving), snow (drifting onto rock), leaf litter (leaves strewn on the road)
GROW = {n: 'plant' for n in ('grass', 'meadow', 'flowers', 'tallgrass', 'lawn', 'clover', 'moss', 'heather', 'marsh', 'forest', 'sunburnt', 'wildflowers', 'mushroommat')}
GROW.update({'snow': 'snow', 'leaflitter': 'litter', 'pineneedles': 'litter'})


# what the painter shows where people walk (the catalogue's `wear`): the soil under plant cover, or 'pack'
WEAR = {'grass': '#A07E52', 'meadow': '#A07E52', 'flowers': '#A07E52', 'clover': '#A07E52', 'lawn': '#A07E52', 'wildflowers': '#A07E52',
        'tallgrass': '#8E7048', 'forest': '#6E5638', 'heather': '#6E5840', 'marsh': '#5E5238', 'moss': '#6E5C40', 'leaflitter': '#5A4630',
        'pineneedles': '#5A4630', 'mushroommat': '#4E425A', 'sunburnt': '#A88A58',
        'path': 'pack', 'dirt': 'pack', 'sand': 'pack', 'wetsand': 'pack', 'gravel': 'pack', 'rock': 'pack', 'cave': 'pack', 'scrap': 'pack',
        'ash': 'pack', 'snow': 'pack', 'dryearth': 'pack', 'coralsand': 'pack', 'emberash': 'pack', 'goldrock': 'pack'}


def draw(name, i):
    t = Tile(name, i); fn, cls, touches = KINDS[name]; R = fn(t)
    if R is None: R = ramp(tuple(int(v) for v in np.median(t.a.reshape(-1, 3), axis=0)))
    if cls == 'floor': vary(t, R)
    if 2 <= i <= 6: touch(t, touches[i - 2], R, cls)
    elif i == 9: damp(t, R, cls)
    elif i == 10: touch(t, touches[5], R, cls)
    elif i in (11, 12): worn(t, R, cls, .75 if i == 11 else 1.0)
    return t.image()


def small(im, name=None, k=0):
    """the 16 px tile for Lite mode and the Studio (Lite has no world patches, so they are baked in)"""
    if name and tone_k(name): im = tone_image(im, 13.7 * k + 3.1, 7.3 * k + 1.9, tone_k(name))
    return im.resize((16, 16), Image.BOX)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--force'); ap.add_argument('--sheet'); ap.add_argument('--preview', action='store_true'); a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    force = set((a.force or '').split(',')) - {''}; n = 0
    for name in KINDS:
        for i in range(1, 13):
            p = OUT / f'{name}_{i}.png'
            if name in force or 'all' in force or not p.exists(): draw(name, i).save(p); n += 1
    if a.preview:
        print(f'{n} tiles written to {OUT} (preview: the catalogue and the 16 px tiles are left alone)')
        if a.sheet: sheet(a.sheet)
        return
    src = gamedata.js_text(); k0 = src.index('window.GAMEDATA='); head = src[:k0]; D = json.JSONDecoder().raw_decode(src[k0 + 16:])[0]
    terr = D['scenery']['terrains']; added = []
    for ch, (name, label, z, edge, paved, walk) in NEW47.items():
        base = OLD / f'{name}.png'
        if name in force or 'all' in force or not base.exists(): small(Image.open(OUT / f'{name}_1.png').convert('RGB'), name, 0).save(base); n += 1
        for k in range(1, 6):
            p = OLD / f'{name}_{k}.png'
            if name in force or 'all' in force or not p.exists(): small(Image.open(OUT / f'{name}_{k + 1}.png').convert('RGB'), name, k).save(p); n += 1
        if ch not in terr:
            terr[ch] = {'name': label, 'tile': f'scene/tiles/{name}.png', 'z': z, 'edge': edge, 'vars': [f'scene/tiles/{name}_{k}.png' for k in range(1, 6)]}
            if paved: terr[ch]['paved'] = True
            if not walk: terr[ch]['walk'] = False
            added.append(ch)
    # how strongly the painter lays its soft patches on each kind (tone; paved kinds have none) and what it shows
    # where people walk (wear: the soil under plant cover, or 'pack' for earth); the name comes from the tile path
    for ch, T_ in terr.items():
        name = T_['tile'].rsplit('/', 1)[-1][:-4]
        if name not in KINDS: continue
        if name in TONE_KIND: T_['tone'] = TONE_KIND[name]
        if name in WEAR: T_['wear'] = WEAR[name]
        if name in GROW: T_['grow'] = GROW[name]
    D['scenery']['tileSet'] = 'tiles47'
    gamedata.save_js(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n')
    print(f'{n} tiles written; new kinds in the catalogue: {", ".join(added) or "none (all there)"}; {len(terr)} kinds in all')
    if a.sheet: sheet(a.sheet)


# ------------------------------------------------------------------------------------------------- sheets
FLIPS = {'grass', 'meadow', 'flowers', 'tallgrass', 'path', 'sand', 'water', 'deep', 'rock', 'cave', 'scrap', 'snow', 'asphalt', 'gravel', 'dirt', 'forest', 'ash', 'basalt'}
PLAIN, DETAIL = [1, 7, 8], [2, 3, 4, 5, 6, 9, 10]


def pick(sx, sz, v47=True):
    """the tile the ground painter lays on the metre (sx, sz), as walk-view.js picks it. v47: the three plain tiles
    equally often, and not the same one as the metre to the left or behind (v46 laid the first half the time)"""
    r = dio_hash(sx * 3 + 11, sz * 7 + 5)
    if dio_noise(sx / 4.7, sz / 4.7 + 31) > .63: return DETAIL[int(r * 7)]
    if not v47: return 1 if r < .5 else 7 if r < .75 else 8
    p = int(r * 3); L = int(dio_hash((sx - 1) * 3 + 11, sz * 7 + 5) * 3); U = int(dio_hash(sx * 3 + 11, (sz - 1) * 7 + 5) * 3)
    for k in range(3):
        if (p + k) % 3 not in (L, U): return PLAIN[(p + k) % 3]
    return PLAIN[p]


def patch(folder, name, w=5, h=4, v47=True):
    """a w x h metre patch laid the way the ground painter lays it (v46: the old picks, tiles of most natural kinds
    mirrored at random, no world patches; v47: the new picks, no mirroring, the painter's soft patches on top)"""
    sx0, sz0 = zlib.crc32(name.encode()) % 997, zlib.crc32(name.encode()) % 991; P = Image.new('RGB', (w * T, h * T))
    for y in range(h):
        for x in range(w):
            i = pick(sx0 + x, sz0 + y, v47); p = folder / f'{name}_{i}.png'
            if not p.exists(): return None
            im = Image.open(p).convert('RGB'); f = int(dio_hash(sx0 + x + 71, sz0 + y + 13) * 4) if not v47 and name in FLIPS else 0
            if f & 1: im = im.transpose(Image.FLIP_LEFT_RIGHT)
            if f & 2: im = im.transpose(Image.FLIP_TOP_BOTTOM)
            P.paste(im, (x * T, y * T))
    k = tone_k(name) if v47 else 0
    return tone_image(P, sx0, sz0, k) if k else P


def sheet(path):
    """three pictures: the v38-46 kinds before and after (as the painter lays them), the new kinds, and every tile"""
    path = Path(path); z = 2; pw, ph = 5 * T * z, 4 * T * z; bg = (34, 36, 44)
    old = [k for k in KINDS if (BT.OUT / f'{k}_1.png').exists()]; new = [k for k in KINDS if k not in old]
    cols = 2; cw = 2 * pw + 40; rh = ph + 34
    im = Image.new('RGB', (cols * cw + 20, ((len(old) + cols - 1) // cols) * rh + 20), bg); d = ImageDraw.Draw(im)
    for n, k in enumerate(old):
        x0, y0 = 20 + (n % cols) * cw, 14 + (n // cols) * rh
        d.text((x0, y0), f'{k}:  v46  |  v47', fill=(236, 236, 240))
        for j, f in enumerate((BT.OUT, OUT)):
            P = patch(f, k, v47=(j == 1))
            if P: im.paste(P.resize((pw, ph), Image.NEAREST), (x0 + j * (pw + 8), y0 + 16))
    p1 = path.with_name(path.stem + '-before-after.png'); im.save(p1)
    cols = 3; cw = pw + 24
    im = Image.new('RGB', (cols * cw + 20, ((len(new) + cols - 1) // cols) * rh + 20), bg); d = ImageDraw.Draw(im)
    letter = {v[0]: ch for ch, v in NEW47.items()}
    for n, k in enumerate(new):
        x0, y0 = 20 + (n % cols) * cw, 14 + (n // cols) * rh
        d.text((x0, y0), f'{NEW47[letter[k]][1]}  ({k})', fill=(236, 236, 240))
        im.paste(patch(OUT, k).resize((pw, ph), Image.NEAREST), (x0, y0 + 16))
    p2 = path.with_name(path.stem + '-new.png'); im.save(p2)
    kinds = list(KINDS); cell = T * z + 4
    im = Image.new('RGB', (12 * cell + 116, len(kinds) * cell + 30), bg); d = ImageDraw.Draw(im)
    for i, lab in enumerate(['plain', 'detail', 'detail', 'detail', 'detail', 'detail', 'plain', 'plain', 'damp', 'detail', 'worn', 'worn']):
        d.text((112 + i * cell, 6), lab, fill=(180, 184, 196))
    for r, name in enumerate(kinds):
        d.text((6, 24 + r * cell + T * z // 2 - 6), name, fill=(236, 236, 240))
        for i in range(1, 13): im.paste(Image.open(OUT / f'{name}_{i}.png').convert('RGB').resize((T * z, T * z), Image.NEAREST), (112 + (i - 1) * cell, 22 + r * cell))
    p3 = path.with_name(path.stem + '-all-tiles.png'); im.save(p3)
    print('sheets:', p1, p2, p3)


if __name__ == '__main__':
    main()
