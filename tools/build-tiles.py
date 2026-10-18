#!/usr/bin/env python3
"""v37: the 32 px/m ground tiles of the walk scenes (game/art/next/tiles/<name>_1..6.png, six per terrain).

They keep the colours of the 16 px tiles the world was built with (tools/build-scene-tiles.py), so props, buildings
and people sit on them as before, and draw the detail those colours only hinted at: blades with lit tips, clover,
pebbles with a lit top and a dark underside, cracks, cobbles with mortar, plank grain and knots, wave crests,
furrows, cinders. Shade and light steps come from the prop ramp (shadows lean lavender, lights lean warm), so the
ground and the props share one light. Every tile wraps on all four sides; the ground painter in walk-view.js mixes
the six variants per metre and wobbles the edges itself, so no edge pieces are needed any more.

    python3 tools/build-tiles.py                 # writes what is missing
    python3 tools/build-tiles.py --force         # redraws everything (hand-painted tiles are overwritten!)
    python3 tools/build-tiles.py --sheet out.png # a contact sheet, old 16 px tile above the six new ones"""
import argparse, math, random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'game' / 'art' / 'next' / 'tiles'
OLD = ROOT / 'game' / 'art' / 'scene' / 'tiles'
T = 32

def hx(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
def mix(a, b, t): return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))
def dk(c, k): return tuple(max(0, min(255, int(v * k))) for v in c)
def ramp(b):
    """[deep, shade, base, light, highlight] the way the props shade: shadows toward lavender, lights toward cream"""
    return [mix(dk(b, .55), (60, 42, 112), .30), mix(dk(b, .79), (96, 74, 152), .17), b, mix(b, (255, 244, 196), .30), mix(b, (255, 252, 234), .60)]

class Tile:
    def __init__(self, seed, base):
        self.a = np.zeros((T, T, 3), np.uint8); self.a[:] = base; self.r = random.Random(seed); self.base = base
    def px(self, x, y, c): self.a[y % T, x % T] = c
    def get(self, x, y): return tuple(int(v) for v in self.a[y % T, x % T])
    def rect(self, x, y, w, h, c):
        for j in range(h):
            for i in range(w): self.px(x + i, y + j, c)
    def noise(self, period, seed):
        """periodic value noise in [0,1): a lattice of period cells, bilinear, so the tile still wraps"""
        rr = random.Random(seed); n = T // period; g = [[rr.random() for _ in range(n)] for _ in range(n)]
        out = np.zeros((T, T))
        for y in range(T):
            for x in range(T):
                fx, fy = x / period, y / period; x0, y0 = int(fx), int(fy); tx, ty = fx - x0, fy - y0; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty)
                a, b, c, d = g[y0 % n][x0 % n], g[y0 % n][(x0 + 1) % n], g[(y0 + 1) % n][x0 % n], g[(y0 + 1) % n][(x0 + 1) % n]
                out[y, x] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty
        return out
    def blotch(self, R, period=8, amp=(.28, .72), seed=0):
        amp = (amp[0], amp[1]) if period < 16 else (.22, .8)
        """low-frequency patches a step darker / lighter than the base"""
        n = self.noise(period, seed * 31 + 7) * .7 + self.noise(period // 2 or 2, seed * 17 + 3) * .3
        for y in range(T):
            for x in range(T):
                v = n[y, x]
                if v < amp[0]: self.px(x, y, R[1])
                elif v > amp[1]: self.px(x, y, R[3])
    def speck(self, n, cols):
        for _ in range(n): self.px(self.r.randrange(T), self.r.randrange(T), self.r.choice(cols))
    def pebble(self, x, y, R, w=3):
        """a small rounded stone: lit top-left, dark underside, a one-pixel highlight"""
        h = max(2, w - 1)
        for j in range(h):
            for i in range(w):
                if (i == 0 or i == w - 1) and (j == 0 or j == h - 1) and w > 2: continue
                self.px(x + i, y + j, R[1] if j == h - 1 or i == w - 1 else R[2] if j else R[3])
        self.px(x + (1 if w > 2 else 0), y, R[4])
        for i in range(1 if w > 2 else 0, w - (1 if w > 2 else 0)): self.px(x + i, y + h, R[1])   # the shadow it sits in
    def crack(self, x, y, n, c, c2=None):
        dx = self.r.choice((-1, 1))
        for k in range(n):
            self.px(x, y, c)
            if c2 and self.r.random() < .4: self.px(x + 1, y, c2)
            y += 1; x += dx if self.r.random() < .45 else 0
            if self.r.random() < .15: dx = -dx
    def blade(self, x, y, h, dark, lite, lean=0):
        for k in range(h):
            self.px(x + (lean if k >= h // 2 else 0), y - k, lite if k == h - 1 else dark)
    def tuft(self, x, y, R, h=3):
        self.blade(x - 1, y, h - 1, R[1], R[3], -1); self.blade(x, y, h, R[1], R[4]); self.blade(x + 1, y, h - 1, R[1], R[3], 1)
    def clover(self, x, y, R):
        c, l = R[1], R[3]
        self.px(x, y, c); self.px(x - 1, y, c); self.px(x + 1, y, c); self.px(x, y - 1, c); self.px(x, y + 1, c); self.px(x - 1, y - 1, l); self.px(x, y + 2, R[0])
    def flower(self, x, y, col, R, big=False):
        self.px(x, y + 1, R[1]); self.px(x, y + 2, R[0])
        self.px(x, y, col); self.px(x + 1, y, col); self.px(x, y - 1, col); self.px(x + 1, y - 1, col)
        if big: self.px(x - 1, y - 1, col); self.px(x + 2, y, col); self.px(x, y - 2, col)
        self.px(x + 1, y - 1, mix(col, (255, 255, 240), .6))
    def wave(self, x, y, n, lite, lite2):
        for k in range(n):
            yy = y + (1 if n > 4 and (k < 1 or k > n - 2) else 0)
            self.px(x + k, yy, lite2 if k in (0, n - 1) else lite)
    def leaf(self, x, y, col, dark):
        self.px(x, y, col); self.px(x + 1, y, col); self.px(x + 1, y + 1, dark)
    def image(self): return Image.fromarray(self.a, 'RGB')

# --------------------------------------------------------------------------- recipes
# colours are the 16 px tiles' (base, lite, dark); the ramp adds the deep shade and the highlight
def grass(t, base, lite, dark, blades=22, clover=3, flowers=(), tufts=4, dens=1.0):
    R = ramp(hx(base)); R[1], R[3] = hx(dark), hx(lite); t.a[:] = R[2]
    t.blotch(R, 8, (.3, .72), t.r.randrange(99))
    for _ in range(int(blades * dens)):
        x, y = t.r.randrange(T), t.r.randrange(T); t.blade(x, y, t.r.randrange(2, 4), R[1], R[3] if t.r.random() < .7 else R[4], t.r.choice((0, 0, 1, -1)))
    for _ in range(tufts): t.tuft(t.r.randrange(T), t.r.randrange(T), R, t.r.randrange(3, 5))
    for _ in range(clover): t.clover(t.r.randrange(T), t.r.randrange(T), R)
    for col in flowers: t.flower(t.r.randrange(T), t.r.randrange(T), hx(col), R, big=t.r.random() < .3)
    t.speck(int(6 * dens), [R[3], R[1]])

def tallgrass(t):
    R = ramp(hx('#4E9A47')); R[1] = hx('#3B7E3A'); R[3] = hx('#7CC468'); R[4] = hx('#9ED783'); t.a[:] = R[2]
    t.blotch(R, 8, (.3, .7), 5)
    blades = [(t.r.randrange(T), t.r.randrange(T), t.r.randrange(6, 11), t.r.choice((-1, 0, 0, 1))) for _ in range(26)]
    for x, y, h, lean in sorted(blades, key=lambda b: b[1]):   # back blades first, so front ones cover them
        for k in range(h):
            xx = x + (lean if k >= h * .6 else 0); t.px(xx, y - k, R[4] if k == h - 1 else R[3] if k > h - 4 else R[1] if k > 1 else R[0])
            if k > 2 and k < h - 2: t.px(xx + 1, y - k, R[1])

def ground(t, base, lite, dark, grain=30, pebbles=5, cracks=0, period=8, specks=None, stones=None):
    """earth, sand, rock, snow, gravel: low patches, grain, pebbles"""
    R = ramp(hx(base)); R[1], R[3] = hx(dark), hx(lite); t.a[:] = R[2]
    t.blotch(R, period, (.3, .72), t.r.randrange(99))
    t.speck(grain, specks or [R[1], R[3], R[1]])
    for _ in range(cracks): t.crack(t.r.randrange(T), t.r.randrange(T), t.r.randrange(4, 9), R[1], R[0])
    SR = stones or R
    for _ in range(pebbles): t.pebble(t.r.randrange(T), t.r.randrange(T), SR, t.r.choice((2, 3, 3, 4)))
    return R

def cobble(t, a, b, mortar, sw=7, sh=5):
    """rounded cobbles in offset rows; each stone lit on top, dark along its lower edge, mortar between"""
    RA, RB, M = ramp(hx(a)), ramp(hx(b)), hx(mortar); t.a[:] = M
    rows = T // (sh + 1); cols = T // (sw + 1)
    for row in range(rows):
        off = 0 if row % 2 == 0 else (sw + 1) // 2
        for col in range(cols):
            x0, y0 = col * (sw + 1) + off + t.r.randrange(-1, 1), row * (sh + 1); R = RA if t.r.random() < .6 else RB
            w, h = sw - t.r.randrange(0, 2), sh
            for j in range(h):
                for i in range(w):
                    if (i == 0 or i == w - 1) and (j == 0 or j == h - 1): continue
                    t.px(x0 + i, y0 + j, R[1] if j == h - 1 or i == w - 1 else R[3] if j == 0 else R[2])
            t.px(x0 + 1, y0, R[4]); t.px(x0 + 2, y0 + 1, R[3] if t.r.random() < .5 else R[2])
            if t.r.random() < .25: t.px(x0 + t.r.randrange(1, w - 1), y0 + t.r.randrange(1, h - 1), R[1])

def pavers(t, a='#C9C3B6', b='#BDB6A8', joint='#8F887C', s=16):
    RA, RB, J = ramp(hx(a)), ramp(hx(b)), hx(joint)
    for y in range(T):
        for x in range(T):
            R = RA if ((x // s) + (y // s)) % 2 == 0 else RB
            if x % s == s - 1 or y % s == s - 1: c = J
            elif x % s == 0 or y % s == 0: c = R[3]
            elif x % s == s - 2 or y % s == s - 2: c = R[1]
            else: c = R[2]
            t.px(x, y, c)
    for _ in range(8): t.px(t.r.randrange(T), t.r.randrange(T), RA[3])
    for _ in range(3): t.crack(t.r.randrange(T), t.r.randrange(T), t.r.randrange(3, 6), RA[1])

def bricks(t, a='#B8664E', b='#A65A45', mortar='#7E4A3C', bw=15, bh=7):
    RA, RB, M = ramp(hx(a)), ramp(hx(b)), hx(mortar); t.a[:] = M
    for row in range(T // (bh + 1)):
        off = 0 if row % 2 == 0 else (bw + 1) // 2
        for col in range(T // (bw + 1) + 1):
            x0, y0 = col * (bw + 1) + off, row * (bh + 1); R = RA if t.r.random() < .55 else RB
            for j in range(bh):
                for i in range(bw): t.px(x0 + i, y0 + j, R[1] if j == bh - 1 else R[3] if j == 0 else R[2])
            t.px(x0 + 1, y0, R[4]); t.px(x0 + bw - 1, y0 + bh - 1, R[0])
            for _ in range(2): t.px(x0 + t.r.randrange(bw), y0 + t.r.randrange(1, bh - 1), R[1])

def checker(t, a, b, line, s=16):
    RA, RB, L = ramp(hx(a)), ramp(hx(b)), hx(line)
    for y in range(T):
        for x in range(T):
            R = RA if ((x // s) + (y // s)) % 2 == 0 else RB
            t.px(x, y, L if x % s == s - 1 or y % s == s - 1 else R[3] if (x + y) % s in (2, 3) and (x % s) < 6 else R[2])
    t.px(1, 1, (255, 255, 255)); t.px(17, 17, (255, 255, 255))

def water(t, base, lite, dark, waves=5):
    R = ramp(hx(base)); R[1], R[3] = hx(dark), hx(lite); R[4] = mix(hx(lite), (255, 255, 255), .5); t.a[:] = R[2]
    n = t.noise(8, t.r.randrange(99))
    for y in range(T):
        for x in range(T):
            v = n[y, x]
            if v < .35: t.px(x, y, R[1])
            elif v < .42 and (x + y) % 2 == 0: t.px(x, y, R[1])    # the 2x2 checker is allowed on water
    for _ in range(waves):
        x, y = t.r.randrange(T), t.r.randrange(T); t.wave(x, y, t.r.randrange(4, 10), R[3], R[4] if t.r.random() < .4 else R[3])
        if t.r.random() < .5: t.px(x + t.r.randrange(2, 5), y + 1, R[1])
    t.speck(4, [R[4]])

def soil(t):
    R = ramp(hx('#8A5E3C')); R[1] = hx('#6E4A2E'); R[3] = hx('#A87A52')
    for y in range(T):
        k = y % 8
        for x in range(T): t.px(x, y, R[3] if k == 0 else R[2] if k < 4 else R[1] if k < 6 else R[0] if k == 6 else R[1])
    for _ in range(12): x, y = t.r.randrange(T), t.r.randrange(T) // 8 * 8 + t.r.randrange(1, 4); t.pebble(x, y, R, 2)
    t.speck(16, [R[1], R[3]])

def boards(t, base='#B9844E', dark='#7E5530', lite='#CC9A62', w=8):
    R = ramp(hx(base)); R[1], R[3] = hx(dark), hx(lite)
    for y in range(T):
        k = y % w
        for x in range(T): t.px(x, y, R[0] if k == w - 1 else R[3] if k == 0 else R[2])
    for p in range(T // w):   # grain lines, a knot, nails
        y0 = p * w; x = t.r.randrange(T)
        for k in range(t.r.randrange(6, 14)): t.px(x + k, y0 + 2 + t.r.randrange(0, 2) + (k // 6) % 2, R[1])
        x = t.r.randrange(T)
        for k in range(t.r.randrange(5, 10)): t.px(x + k, y0 + 5, R[1])
        if t.r.random() < .6:
            kx, ky = t.r.randrange(T), y0 + 3; t.px(kx, ky, R[0]); t.px(kx + 1, ky, R[1]); t.px(kx, ky + 1, R[1]); t.px(kx + 1, ky + 1, R[0])
        nx = t.r.randrange(T); t.px(nx, y0 + 2, (70, 72, 84)); t.px(nx + 1, y0 + 2, (120, 124, 136)); t.px(nx + 16, y0 + 5, (70, 72, 84))

def steps(t):
    cols = ['#CFC8BA', '#B6AFA2', '#8E877B', '#6E685E']; R = ramp(hx('#B6AFA2'))
    for y in range(T):
        k = y % 8
        for x in range(T): t.px(x, y, hx(cols[0]) if k < 2 else hx(cols[1]) if k < 5 else hx(cols[2]) if k < 7 else hx(cols[3]))
    for y0 in range(0, T, 8):
        for _ in range(3): t.px(t.r.randrange(T), y0 + t.r.randrange(2, 5), R[1])
        t.px(t.r.randrange(T), y0, (240, 236, 226)); t.px(t.r.randrange(T), y0 + 6, hx(cols[3]))

def lawn(t):
    R = ramp(hx('#74C45E')); R[1] = hx('#68B654'); R[3] = hx('#86D06C')
    for y in range(T):
        for x in range(T): t.px(x, y, R[1] if (x // 8) % 2 else R[2])
    for _ in range(40): x, y = t.r.randrange(T), t.r.randrange(T); t.blade(x, y, 2, R[1] if (x // 8) % 2 else R[2], R[3])
    t.speck(10, [R[3]])

def forest(t):
    R = ramp(hx('#5B6B3A')); R[1] = hx('#4A5A30'); R[3] = hx('#6E7A44'); t.a[:] = R[2]
    t.blotch(R, 8, (.3, .7), t.r.randrange(99)); t.speck(30, [R[1], R[3], hx('#7A5A3A')])
    for _ in range(7): t.leaf(t.r.randrange(T), t.r.randrange(T), hx(t.r.choice(['#C27A3A', '#D8A040', '#9A5A2A'])), R[0])
    for _ in range(3): x, y = t.r.randrange(T), t.r.randrange(T); [t.px(x + k, y + k // 3, hx('#4A3A28')) for k in range(5)]
    for _ in range(2): t.tuft(t.r.randrange(T), t.r.randrange(T), R, 3)

def scrap(t):
    R = ground(t, '#8C8478', '#A9A194', '#6C655C', 30, 3, 2)
    for c in ('#C27A4A', '#7FA0B8', '#B9B2A6', '#5A5E66'):
        x, y = t.r.randrange(T), t.r.randrange(T); t.px(x, y, hx(c)); t.px(x + 1, y, hx(c)); t.px(x + 1, y + 1, R[0])
    x, y = t.r.randrange(T), t.r.randrange(T); t.rect(x, y, 3, 1, (70, 72, 84)); t.px(x + 1, y, (120, 124, 136))   # a bolt

def ash(t):
    R = ground(t, '#5A524E', '#6A625C', '#4A4340', 36, 0, 0, 8)
    for _ in range(6): x, y = t.r.randrange(T), t.r.randrange(T); t.px(x, y, hx('#2E2A2A')); t.px(x + 1, y, hx('#3A3434')); t.px(x, y - 1, hx('#7A706A'))
    for _ in range(2): x, y = t.r.randrange(T), t.r.randrange(T); t.px(x, y, hx('#E0703A')); t.px(x + 1, y, hx('#F0A050')); t.px(x - 1, y, hx('#8A4030'))

def basalt(t):
    """slate plates: a few big polygons split by dark cracks, each plate a hair different in tone"""
    R = ramp(hx('#3E3E48')); R[1] = hx('#2C2C34'); R[3] = hx('#4E4E5A'); R[4] = hx('#5E5E6C')
    pts = [(t.r.randrange(T), t.r.randrange(T)) for _ in range(8)]
    def near(x, y):
        best = []
        for i, (px_, py_) in enumerate(pts):
            dx = min(abs(x - px_), T - abs(x - px_)); dy = min(abs(y - py_), T - abs(y - py_)); best.append((dx * dx + dy * dy, i))
        best.sort(); return best
    tone = [t.r.choice((R[2], R[2], R[3], R[1])) for _ in pts]
    for y in range(T):
        for x in range(T):
            b = near(x, y); d0, i0 = b[0]; d1, i1 = b[1]
            c = tone[i0]
            if math.sqrt(d1) - math.sqrt(d0) < 1.0: c = R[0]
            elif math.sqrt(d1) - math.sqrt(d0) < 1.8 and (x + y) % 2 == 0: c = R[1]
            t.px(x, y, c)
    t.speck(8, [R[4], R[1]])

def asphalt(t):
    R = ground(t, '#5C5E66', '#6E717A', '#4A4C54', 60, 0, 2, 16)
    if t.r.random() < .5: x, y = t.r.randrange(T), t.r.randrange(T); t.rect(x, y, 5, 3, R[1]); t.px(x, y, R[2])

RECIPES = {
 'grass': lambda t: grass(t, '#6CBA59', '#8FD06F', '#4E9A47'),
 'meadow': lambda t: grass(t, '#5DA853', '#7DC064', '#418A3E', blades=16, clover=2, flowers=('#F2C14E',), tufts=5),
 'flowers': lambda t: grass(t, '#6CBA59', '#8FD06F', '#4E9A47', blades=14, clover=2, flowers=('#F7F1E3', '#F2C14E', '#E8708A', '#9C8CE8', '#F7F1E3'), tufts=3),
 'tallgrass': tallgrass,
 'path': lambda t: ground(t, '#D9B27C', '#E9C894', '#B88D5A', 30, 4, 1),
 'plaza': lambda t: cobble(t, '#D8D2C2', '#C4BCA8', '#9C9484'),
 'sand': lambda t: ground(t, '#EED9A2', '#F8EAC0', '#D6BC80', 36, 1, 0, 8),
 'water': lambda t: water(t, '#4BA8DA', '#BDEAF6', '#3A90C6'),
 'deep': lambda t: water(t, '#2F7DBA', '#7FC2E8', '#24679E', waves=3),
 'rock': lambda t: ground(t, '#A19B90', '#BAB4A8', '#837D74', 30, 5, 3),
 'cave': lambda t: ground(t, '#6E6878', '#857F90', '#58526A', 30, 4, 2),
 'mall': lambda t: checker(t, '#F2EBDD', '#D9E9E4', '#C5BCAA'),
 'soil': soil, 'boards': boards, 'scrap': scrap,
 'snow': lambda t: ground(t, '#EEF3F8', '#FFFFFF', '#C9D6E4', 20, 2, 0, 8),
 'asphalt': asphalt, 'pavers': pavers, 'bricks': bricks,
 'gravel': lambda t: ground(t, '#A59C8C', '#C2B9A8', '#8C8373', 90, 9, 0, 4, specks=[hx('#C2B9A8'), hx('#8C8373'), hx('#B4AB9A'), hx('#776F62')]),
 'dirt': lambda t: ground(t, '#9C7350', '#B48A62', '#7E5A3E', 30, 6, 2),
 'forest': forest, 'steps': steps, 'lawn': lawn, 'ash': ash, 'basalt': basalt,
}
# the extra touch each variant gets (the first variant is the plain tile)
FEATURES = {
 'grass': ['clover', 'pebble', 'flower', 'dark', 'light'], 'meadow': ['clover', 'flower', 'tuft', 'light', 'flower'], 'flowers': ['flower', 'flower', 'clover', 'light', 'tuft'],
 'tallgrass': ['dark', 'light', 'tuft', 'dark', 'light'], 'path': ['pebble', 'crack', 'puddle', 'leaves', 'tuft'], 'plaza': ['crack', 'moss', 'stain', 'light', 'dark'],
 'sand': ['pebble', 'shell', 'ripple', 'light', 'dark'], 'water': ['light', 'ripple', 'dark', 'light', 'ripple'], 'deep': ['dark', 'ripple', 'light', 'dark', 'ripple'],
 'rock': ['crack', 'moss', 'pebble', 'dark', 'light'], 'cave': ['crack', 'glint', 'pebble', 'dark', 'light'], 'mall': ['stain', 'light', 'light', 'dark', 'light'],
 'soil': ['pebble', 'tuft', 'dark', 'light', 'pebble'], 'boards': ['knot', 'dark', 'light', 'knot', 'nail'], 'scrap': ['stain', 'bolt', 'crack', 'pebble', 'dark'],
 'snow': ['light', 'pebble', 'ripple', 'light', 'dark'], 'asphalt': ['crack', 'stain', 'patch', 'light', 'manhole'], 'pavers': ['crack', 'moss', 'stain', 'light', 'dark'],
 'bricks': ['crack', 'moss', 'dark', 'light', 'stain'], 'gravel': ['pebble', 'dark', 'light', 'pebble', 'tuft'], 'dirt': ['pebble', 'crack', 'tuft', 'puddle', 'leaves'],
 'forest': ['leaves', 'tuft', 'dark', 'leaves', 'light'], 'steps': ['crack', 'moss', 'light', 'dark', 'light'], 'lawn': ['light', 'clover', 'dark', 'light', 'flower'],
 'ash': ['ember', 'dark', 'light', 'ember', 'pebble'], 'basalt': ['crack', 'glint', 'light', 'dark', 'crack'],
}

def feature(t, kind, R):
    r = t.r; x, y = r.randrange(T), r.randrange(T)
    if kind == 'clover': [t.clover(r.randrange(T), r.randrange(T), R) for _ in range(2)]
    elif kind == 'pebble': [t.pebble(r.randrange(T), r.randrange(T), R, r.choice((2, 3, 4))) for _ in range(3)]
    elif kind == 'flower': [t.flower(r.randrange(T), r.randrange(T), hx(r.choice(['#F7F1E3', '#F2C14E', '#E8708A', '#9C8CE8'])), R) for _ in range(2)]
    elif kind == 'dark': t.speck(12, [R[1]])
    elif kind == 'light': t.speck(12, [R[3]])
    elif kind == 'tuft': [t.tuft(r.randrange(T), r.randrange(T), ramp(hx('#4E9A47')) if R[2][1] < R[2][0] else R, 3) for _ in range(2)]
    elif kind == 'crack': [t.crack(r.randrange(T), r.randrange(T), r.randrange(4, 9), R[1], R[0]) for _ in range(2)]
    elif kind == 'puddle':
        P = ramp(hx('#4BA8DA'))
        for j in range(4):
            for i in range(7):
                if (i == 0 or i == 6) and (j == 0 or j == 3): continue
                t.px(x + i, y + j, P[1] if j == 0 else P[2])
        t.px(x + 2, y + 1, P[3]); t.px(x + 3, y + 1, P[3]); t.px(x + 5, y + 2, P[3])
    elif kind == 'leaves': [t.leaf(r.randrange(T), r.randrange(T), hx(r.choice(['#C27A3A', '#D8A040', '#9A5A2A'])), R[0]) for _ in range(3)]
    elif kind == 'moss':
        M = ramp(hx('#6CBA59'))
        for _ in range(2):
            x, y = r.randrange(T), r.randrange(T); t.rect(x, y, 3, 2, M[1]); t.px(x + 1, y, M[2]); t.px(x + 3, y + 1, M[1])
    elif kind == 'stain': [t.px(x + i + r.randrange(-1, 2), y + j, R[1]) for j in range(3) for i in range(4)]
    elif kind == 'shell':
        t.px(x, y, (240, 230, 220)); t.px(x + 1, y, (240, 230, 220)); t.px(x + 2, y, (220, 200, 190)); t.px(x + 1, y + 1, (220, 200, 190)); t.px(x + 1, y + 2, R[1])
    elif kind == 'ripple': t.wave(x, y, r.randrange(5, 9), R[3], R[3])
    elif kind == 'glint': t.px(x, y, (230, 236, 250)); t.px(x + 1, y + 1, (180, 190, 220))
    elif kind == 'knot':
        K = ramp(hx('#7E5530')); t.rect(x, y, 3, 2, K[1]); t.px(x + 1, y, K[0]); t.px(x + 3, y + 1, K[2]); t.px(x - 1, y, K[2])
    elif kind == 'nail': t.px(x, y, (70, 72, 84)); t.px(x + 1, y, (120, 124, 136))
    elif kind == 'bolt': t.rect(x, y, 2, 2, (70, 72, 84)); t.px(x, y, (120, 124, 136))
    elif kind == 'patch':
        t.rect(x, y, 6, 4, R[1]); t.px(x, y, R[2]); t.px(x + 5, y + 3, R[0])
    elif kind == 'manhole':
        for j in range(5):
            for i in range(7):
                if (i in (0, 6)) and (j in (0, 4)): continue
                t.px(x + i, y + j, R[1] if (i + j) % 2 else R[0])
        for i in range(1, 6): t.px(x + i, y, R[3])
    elif kind == 'ember': t.px(x, y, (224, 112, 58)); t.px(x + 1, y, (240, 160, 80)); t.px(x - 1, y, (138, 64, 48))

def draw(name, i):
    """variant i (1..6): the recipe re-rolled, plus one extra feature from the second on"""
    t = Tile(hash((name, i)) & 0xffff, (0, 0, 0)); RECIPES[name](t)
    if i > 1:
        base = tuple(int(v) for v in np.median(t.a.reshape(-1, 3), axis=0)); R = ramp(base)
        feature(t, FEATURES[name][(i - 2) % 5], R)
    return t.image()

def sheet(path):
    names = list(RECIPES); z = 3; cw = 6 * (T * z + 4) + 20; rh = 2 * (T * z + 24)
    im = Image.new('RGB', (cw * 2 + 10, rh * ((len(names) + 1) // 2) + 10), (90, 92, 100)); d = ImageDraw.Draw(im)
    for n, name in enumerate(names):
        x0, y0 = 10 + (n % 2) * cw, 10 + (n // 2) * rh; d.text((x0, y0), name, fill=(255, 255, 255))
        old = Image.open(OLD / f'{name}.png').convert('RGB'); o = Image.new('RGB', (T, T))
        for a in range(2):
            for b in range(2): o.paste(old, (a * 16, b * 16))
        im.paste(o.resize((T * z, T * z), Image.NEAREST), (x0, y0 + 12))
        for i in range(1, 7):
            v = Image.open(OUT / f'{name}_{i}.png').resize((T * z, T * z), Image.NEAREST); im.paste(v, (x0 + (i - 1) * (T * z + 4), y0 + 12 + T * z + 12))
    im.save(path); print(path, im.size)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--force', action='store_true'); ap.add_argument('--sheet'); a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True); n = 0
    for name in RECIPES:
        for i in range(1, 7):
            p = OUT / f'{name}_{i}.png'
            if a.force or not p.exists(): draw(name, i).save(p); n += 1
    print(f'{n} tiles written to {OUT}')
    if a.sheet: sheet(a.sheet)

if __name__ == '__main__':
    main()
