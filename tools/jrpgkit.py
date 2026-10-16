#!/usr/bin/env python3
"""v37 round four: props and tiles drawn the way 16-bit JRPG artists build them, composed into one scene so the style
can be judged as a whole, then rendered through three palette moods.

Everything is drawn into an INDEXED canvas (ramp id + step per pixel), so the same pixels can be shown through any
palette. The look comes from construction, not filters:
  trees     a dark back mass, then leaf clumps front-to-back, each a sphere lit top-left with a scalloped underside,
            every clump casting a one-pixel shade on what is below it; a lit crown; holes in the shadow; a trunk with
            a root flare, a lit side, a knot and the canopy's shadow across it
  rocks     three planes (top lit, left mid, right dark) with a crack, chipped corners, moss and a tuft at the foot
  house     stone footing, plaster with timber frame and braces, an arched door, cross-bar windows with sills and a
            flower box, a deep eave shadow, shingle rows that step and darken toward the eave, a capped chimney
  tiles     grass with dark patches and W-tufts, a dirt path with a worn centre and pebbles, water with wave dashes and
            a deep band, cobbles packed irregularly and lit from the top left
Palette: ramps shade toward blue-violet and light toward cream (moods change how far), with contrast higher than v35.
"""
import math, random, colorsys, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RAMPS = [  # name, hue, sat, mid value
    ('skin', 26, .50, .80), ('bark', 22, .55, .50), ('ember', 12, .85, .85), ('crimson', 350, .75, .68), ('gold', 44, .85, .88),
    ('straw', 48, .50, .86), ('olive', 74, .55, .60), ('leaf', 104, .62, .66), ('pine', 148, .58, .46), ('mint', 165, .45, .82),
    ('teal', 185, .60, .62), ('sky', 205, .55, .85), ('cobalt', 220, .72, .66), ('indigo', 245, .55, .48), ('violet', 272, .55, .70),
    ('orchid', 300, .50, .78), ('rose', 338, .55, .84), ('rust', 20, .70, .60), ('steel', 215, .12, .68), ('stone', 38, .12, .64),
]
RID = {n: i for i, (n, *_r) in enumerate(RAMPS)}
INK = -2

MOODS = {
    'Mana':   dict(shade_hue=.22, light_hue=.14, k_dark=.74, k_light=.60, sat_up=.14, sat_down=.20, sat=1.05, note='warm and saturated, shadows go violet: Secret of Mana / Chrono Trigger'),
    'Golden': dict(shade_hue=.14, light_hue=.10, k_dark=.66, k_light=.52, sat_up=.18, sat_down=.26, sat=1.10, note='high contrast, hard light, cream highlights: Golden Sun / Pokemon Emerald'),
    'Dusk':   dict(shade_hue=.30, light_hue=.18, k_dark=.78, k_light=.66, sat_up=.06, sat_down=.30, sat=.82, note='muted, cool shadows, soft light: Octopath / Final Fantasy VI towns'),
}

def hue_toward(h, target, f):
    d = ((target - h + 180) % 360) - 180; return (h + d * f) % 360

def build_palette(M):
    pal = np.zeros((len(RAMPS), 8, 3), np.uint8)
    for i, (n, h, s, v) in enumerate(RAMPS):
        s = min(1, s * M['sat'])
        for st in range(8):
            d = st - 3
            if d < 0:
                k = -d; hh = hue_toward(h, 250, M['shade_hue'] * k / 3); ss = min(1, s * (1 + M['sat_up'] * k)); vv = v * (M['k_dark'] ** k)
            else:
                k = d; hh = hue_toward(h, 52, M['light_hue'] * k / 4); ss = max(0, s * (1 - M['sat_down'] * k)); vv = v + (1 - v) * (1 - M['k_light'] ** k)
            r, g, b = colorsys.hsv_to_rgb(hh / 360, ss, vv); pal[i, st] = (round(r * 255), round(g * 255), round(b * 255))
    return pal

# ---------------------------------------------------------------- indexed canvas
class Cv:
    def __init__(self, w, h):
        self.w, self.h = w, h; self.r = np.full((h, w), -1, np.int16); self.s = np.zeros((h, w), np.int8)
    def put(self, mask, ramp, step):
        rid = RID[ramp] if isinstance(ramp, str) else ramp; m = mask & (np.ones_like(mask)); self.r[m] = rid; self.s[m] = max(0, min(7, step))
    def px(self, x, y, ramp, step):
        if 0 <= x < self.w and 0 <= y < self.h: self.r[y, x] = RID[ramp] if isinstance(ramp, str) else ramp; self.s[y, x] = max(0, min(7, step))
    def ink(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h: self.r[y, x] = INK; self.s[y, x] = 0
    def op(self): return self.r != -1
    def shift(self, mask, d):
        """move the step of masked pixels by d (clamped)"""
        m = mask & self.op(); self.s[m] = np.clip(self.s[m] + d, 0, 7)
    def mask(self):
        return np.zeros((self.h, self.w), bool)
    def poly(self, pts):
        im = Image.new('L', (self.w, self.h)); ImageDraw.Draw(im).polygon(pts, fill=255); return np.asarray(im) > 0
    def ell(self, cx, cy, rx, ry):
        im = Image.new('L', (self.w, self.h)); ImageDraw.Draw(im).ellipse((cx - rx, cy - ry, cx + rx - 1, cy + ry - 1), fill=255); return np.asarray(im) > 0
    def rect(self, x, y, w, h):
        m = self.mask(); m[max(0, y):max(0, y + h), max(0, x):max(0, x + w)] = True; return m
    def line(self, x0, y0, x1, y1, ramp, step, ink=False):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            x = round(x0 + (x1 - x0) * i / n); y = round(y0 + (y1 - y0) * i / n)
            self.ink(x, y) if ink else self.px(x, y, ramp, step)
    def blit(self, other, x, y):
        for yy in range(other.h):
            for xx in range(other.w):
                if other.r[yy, xx] != -1:
                    X, Y = x + xx, y + yy
                    if 0 <= X < self.w and 0 <= Y < self.h: self.r[Y, X] = other.r[yy, xx]; self.s[Y, X] = other.s[yy, xx]
    def render(self, pal, bg=None):
        out = np.zeros((self.h, self.w, 4), np.uint8)
        op = self.r >= 0; out[op, :3] = pal[self.r[op], self.s[op]]; out[op, 3] = 255
        ik = self.r == INK; out[ik, :3] = (26, 20, 40); out[ik, 3] = 255
        if bg is not None: out[~(op | ik), :3] = bg; out[~(op | ik), 3] = 255
        return Image.fromarray(out)

def dil(m):
    """4-neighbour dilation without wrap-around"""
    o = m.copy(); o[1:, :] |= m[:-1, :]; o[:-1, :] |= m[1:, :]; o[:, 1:] |= m[:, :-1]; o[:, :-1] |= m[:, 1:]; return o

def edges(op):
    e = op & ~(np.roll(op, 1, 0) & np.roll(op, -1, 0) & np.roll(op, 1, 1) & np.roll(op, -1, 1))
    e[0, :] |= op[0, :]; e[-1, :] |= op[-1, :]; e[:, 0] |= op[:, 0]; e[:, -1] |= op[:, -1]; return e

def selout(cv, lit_skip=True):
    """outline = darkest step of the pixel's own ramp; on the lit (top-left) edge keep it one step above darkest"""
    op = cv.op(); e = edges(op)
    up = ~np.roll(op, 1, 0); left = ~np.roll(op, 1, 1)
    for y, x in zip(*np.nonzero(e)):
        if cv.r[y, x] == INK: continue
        cv.s[y, x] = 1 if (lit_skip and (up[y, x] or left[y, x]) and not (y + 1 < cv.h and not op[y + 1, x])) else 0

def sphere(cv, ramp, cx, cy, rx, ry, base=3, light=(-.6, -.8), scallop=3, tones=(-2, -1, 0, 1, 2), hole=False):
    """a lit ball with a scalloped underside: the leaf-clump / bush unit"""
    m = cv.ell(cx, cy, rx, ry)
    # scallop the underside: bite small arcs out of the bottom edge
    if scallop:
        step = max(3, int(rx * 2 / scallop))
        for i in range(scallop):
            bx = cx - rx + step // 2 + i * step + (i % 2); by = cy + ry - 1
            m &= ~cv.ell(bx, by + 1, max(2, step // 2 - 1), 2)
    ys, xs = np.nonzero(m)
    for y, x in zip(ys, xs):
        u, v = (x + .5 - cx) / rx, (y + .5 - cy) / ry; d = math.hypot(u, v); l = -(u * light[0] + v * light[1])
        t = base
        if l > .72 and d > .45: t = base + tones[4]
        elif l > .28: t = base + tones[3]
        elif l < -.72 and d > .5: t = base + tones[0]
        elif l < -.2: t = base + tones[1]
        cv.px(x, y, ramp, t)
    return m

# ---------------------------------------------------------------- props
def tree_oak(seed=1, lean=0):
    rng = random.Random(seed); cv = Cv(60, 76); cx = 30 + lean
    # trunk with root flare and a knot
    for y in range(44, 76):
        f = max(0, (y - 60) / 16)
        w = 11 + int(9 * f * f); x0 = cx - w // 2 + (1 if y > 70 else 0)
        for x in range(x0, x0 + w):
            t = 4 if x < x0 + 2 else 3 if x < x0 + w // 2 else 2 if x < x0 + w - 3 else 1
            if y > 72 and (x < x0 + 3 or x > x0 + w - 4): t = max(1, t - 1)
            cv.px(x, y, 'bark', t)
    for x in range(cx - 6, cx + 7): cv.px(x, 75, 'bark', 1)
    cv.px(cx - 1, 60, 'bark', 1); cv.px(cx, 60, 'bark', 1); cv.px(cx - 1, 61, 'bark', 0); cv.px(cx, 61, 'bark', 2)   # knot
    cv.line(cx - 2, 46, cx - 3, 58, 'bark', 1); cv.line(cx + 2, 50, cx + 2, 70, 'bark', 1)            # grain
    # branches poking out of the canopy (drawn before clumps so they are mostly hidden)
    cv.line(cx, 46, cx - 14, 36, 'bark', 2); cv.line(cx, 46, cx + 12, 38, 'bark', 2); cv.line(cx - 14, 36, cx - 22, 30, 'bark', 1)
    # back mass: the dark interior of the crown
    back = cv.ell(cx + 1, 26, 25, 21); cv.put(back, 'leaf', 1)
    hole = cv.ell(cx - 4, 36, 9, 5) | cv.ell(cx + 10, 38, 6, 4); cv.put(hole & back, 'leaf', 0)
    # clumps, back to front, bottom to top; each casts a shade on what is under it
    clumps = [(cx - 18, 34, 9, 7), (cx + 17, 32, 9, 7), (cx - 2, 38, 10, 7), (cx + 9, 36, 8, 6),
              (cx - 16, 22, 10, 8), (cx + 14, 20, 10, 8), (cx - 2, 26, 12, 9), (cx + 6, 14, 10, 8), (cx - 9, 11, 9, 7), (cx + 1, 7, 7, 5)]
    for i, (x, y, rx, ry) in enumerate(clumps):
        x += rng.randrange(-1, 2); below = cv.ell(x, y + 2, rx + 1, ry + 1) & cv.op(); cv.shift(below, -1)
        gl = -((x - cx) / 26 * .6 + (y - 24) / 22 * .8)   # the crown as one big ball: clumps low-right sit a step darker
        sphere(cv, 'leaf', x, y, rx, ry, base=3 + (1 if gl > .55 else -1 if gl < -.35 else 0), scallop=3 if rx > 7 else 2)
    # a few highlight leaves on the crown, holes low down, one hanging leaf tip
    for _ in range(14):
        x, y = cx - 14 + rng.randrange(0, 22), 6 + rng.randrange(0, 14)
        if cv.r[y, x] == RID['leaf'] and cv.s[y, x] >= 4: cv.px(x, y, 'leaf', 6); cv.px(x + 1, y, 'leaf', 5)
    for _ in range(8):
        x, y = cx - 16 + rng.randrange(0, 32), 30 + rng.randrange(0, 12)
        if cv.r[y, x] == RID['leaf'] and cv.s[y, x] <= 2: cv.px(x, y, 'leaf', 0)
    for x, y in ((cx - 20, 42), (cx + 6, 45), (cx + 20, 40)):
        if cv.r[y - 1, x] == RID['leaf']: cv.px(x, y, 'leaf', 2); cv.px(x, y + 1, 'leaf', 1)
    # canopy shadow across the trunk top
    cv.shift(cv.rect(cx - 8, 44, 16, 6) & (cv.r == RID['bark']), -1)
    selout(cv); return cv

def tree_pine(seed=2):
    cv = Cv(44, 80); cx = 22; rng = random.Random(seed)
    for y in range(66, 80):
        w = 6 + (2 if y > 76 else 0)
        for x in range(cx - w // 2, cx + w // 2): cv.px(x, y, 'bark', 3 if x < cx - 1 else 2 if x < cx + 1 else 1)
    tiers = [(60, 20), (46, 17), (33, 14), (21, 11), (11, 7), (4, 3)]
    for i, (y, hw) in enumerate(tiers):
        top = y - 14 if i < 5 else y - 6; pts = [(cx, top), (cx + hw, y), (cx + hw - 3, y + 2), (cx, y + 1), (cx - hw + 3, y + 2), (cx - hw, y)]
        m = cv.poly(pts)
        # skirt: jagged bottom edge
        for k in range(-hw, hw, 3): m &= ~cv.rect(cx + k + (i % 2), y + 1, 1, 2)
        below = np.roll(m, 2, 0) & cv.op(); cv.shift(below, -1)
        ys, xs = np.nonzero(m)
        for yy, xx in zip(ys, xs):
            u = (xx - cx) / hw; t = 4 if u < -.45 else 3 if u < .15 else 2 if u < .6 else 1
            if yy > y - 3: t -= 1
            cv.px(xx, yy, 'pine', t)
    for _ in range(10):
        x, y = cx - 10 + rng.randrange(0, 12), 8 + rng.randrange(0, 50)
        if cv.r[y, x] == RID['pine'] and cv.s[y, x] >= 3: cv.px(x, y, 'pine', 5)
    selout(cv); return cv

def bush(seed=3, flowers=True):
    cv = Cv(34, 24); rng = random.Random(seed)
    cv.put(cv.ell(17, 15, 15, 8), 'leaf', 1)
    for x, y, rx, ry in ((7, 15, 7, 5), (27, 14, 7, 5), (16, 16, 8, 6), (11, 9, 7, 5), (23, 8, 7, 5), (17, 6, 6, 4)):
        cv.shift(cv.ell(x, y + 2, rx + 1, ry + 1) & cv.op(), -1); sphere(cv, 'leaf', x, y, rx, ry, scallop=2)
    if flowers:
        for x, y in ((9, 7), (22, 5), (28, 12), (14, 13)):
            cv.px(x, y, 'rose', 5); cv.px(x - 1, y, 'rose', 4); cv.px(x + 1, y, 'rose', 4); cv.px(x, y - 1, 'rose', 4); cv.px(x, y + 1, 'rose', 3); cv.px(x, y, 'gold', 6)
    selout(cv); return cv

def rock(seed=4, big=True):
    cv = Cv(40, 30) if big else Cv(22, 16); W, H = cv.w, cv.h; rng = random.Random(seed)
    if big:
        top = [(10, 8), (22, 4), (34, 9), (30, 13), (14, 14)]; left = [(10, 8), (14, 14), (12, 26), (3, 22), (2, 14)]; right = [(14, 14), (30, 13), (34, 9), (38, 17), (34, 27), (12, 26)]
        crack = [(26, 13), (28, 19), (25, 24)]
    else:
        top = [(5, 5), (12, 2), (18, 5), (15, 8), (7, 8)]; left = [(5, 5), (7, 8), (6, 14), (1, 11), (1, 7)]; right = [(7, 8), (15, 8), (18, 5), (20, 10), (18, 14), (6, 14)]
        crack = [(14, 8), (15, 11)]
    cv.put(cv.poly(right), 'stone', 2); cv.put(cv.poly(left), 'stone', 3); cv.put(cv.poly(top), 'stone', 5)
    # the right plane darkens toward its base; the left plane has a lighter upper edge
    ys, xs = np.nonzero(cv.poly(right))
    for y, x in zip(ys, xs):
        if y > H * .72: cv.px(x, y, 'stone', 1)
    for i in range(len(crack) - 1): cv.line(*crack[i], *crack[i + 1], 'stone', 0)
    cv.line(top[0][0], top[0][1], top[1][0], top[1][1], 'stone', 6)   # lit top-left edge
    cv.line(left[0][0], left[0][1], left[1][0], left[1][1], 'stone', 1)   # ridge between top and left plane
    if big:  # chips, moss, tuft at the foot
        cv.px(22, 5, 'stone', 7); cv.px(23, 5, 'stone', 6); cv.px(33, 9, 'stone', 1)
        for x, y in ((12, 9), (13, 10), (14, 9), (16, 10), (12, 10), (31, 11)): cv.px(x, y, 'leaf', 2)
        for x, y in ((13, 9), (15, 9)): cv.px(x, y, 'leaf', 3)
        for dx, h in ((-1, 2), (0, 3), (1, 2)):
            for k in range(h): cv.px(6 + dx, 27 - k, 'leaf', 4 if k == h - 1 else 2)
    selout(cv); return cv

def stump(seed=5):
    cv = Cv(24, 20)
    cv.put(cv.ell(12, 13, 11, 6) & ~cv.ell(12, 13, 11, 6) | cv.rect(2, 8, 20, 9), 'bark', 2)
    for x in range(2, 22): cv.px(x, 16, 'bark', 1)
    cv.put(cv.rect(0, 14, 5, 4), 'bark', 2); cv.put(cv.rect(19, 15, 5, 3), 'bark', 2)  # root flares
    for x in range(2, 10): cv.px(x, 9, 'bark', 3)
    cv.put(cv.ell(12, 8, 10, 4), 'straw', 4); cv.put(cv.ell(12, 8, 7, 3) & ~cv.ell(12, 8, 5, 2), 'straw', 3); cv.put(cv.ell(12, 8, 3, 1), 'straw', 3)
    cv.line(12, 8, 19, 10, 'bark', 1)
    selout(cv); return cv

def lamp():
    cv = Cv(14, 52)
    for x in range(3, 11): cv.px(x, 50, 'steel', 1); cv.px(x, 49, 'steel', 2)
    for x in range(4, 10): cv.px(x, 48, 'steel', 3)
    for y in range(18, 48): cv.px(6, y, 'steel', 3); cv.px(7, y, 'steel', 1)
    for y in (22, 34): cv.px(5, y, 'steel', 2); cv.px(8, y, 'steel', 1); cv.px(6, y, 'steel', 4)
    # lantern
    for x in range(3, 11): cv.px(x, 6, 'steel', 1); cv.px(x, 17, 'steel', 1)
    for y in range(7, 17): cv.px(3, y, 'steel', 2); cv.px(10, y, 'steel', 1)
    for y in range(7, 17):
        for x in range(4, 10): cv.px(x, y, 'gold', 5 if y < 11 else 4)
    for x in range(5, 9): cv.px(x, 8, 'gold', 7)
    cv.px(5, 9, 'gold', 6); cv.px(6, 10, 'gold', 6); cv.px(7, 13, 'gold', 3); cv.px(8, 14, 'gold', 3)
    cv.px(6, 5, 'steel', 2); cv.px(7, 5, 'steel', 2); cv.px(6, 4, 'steel', 3); cv.px(7, 3, 'steel', 3); cv.px(6, 2, 'steel', 4)
    selout(cv); return cv

def bench():
    cv = Cv(40, 22)
    for x in range(4, 36):   # two back slats with a gap, lit top edge
        cv.px(x, 2, 'bark', 5); cv.px(x, 3, 'bark', 4); cv.px(x, 4, 'bark', 2)
        cv.px(x, 6, 'bark', 5); cv.px(x, 7, 'bark', 4); cv.px(x, 8, 'bark', 2)
    for x in range(3, 37):   # seat: two planks, the front one catching the light
        cv.px(x, 11, 'bark', 5); cv.px(x, 12, 'bark', 4); cv.px(x, 13, 'bark', 3); cv.px(x, 14, 'bark', 4); cv.px(x, 15, 'bark', 2); cv.px(x, 16, 'bark', 1)
    for x in (9, 22, 31): cv.px(x, 3, 'bark', 2); cv.px(x + 1, 3, 'bark', 3); cv.px(x, 12, 'bark', 2)   # grain knots
    for x in (4, 34):   # iron ends: arm with a curl, leg
        for y in range(1, 11): cv.px(x, y, 'steel', 2); cv.px(x + 1, y, 'steel', 1)
        cv.px(x - 1, 0, 'steel', 3); cv.px(x, 0, 'steel', 3); cv.px(x + 1, 0, 'steel', 2); cv.px(x - 1, 1, 'steel', 2)
        for y in range(16, 21): cv.px(x, y, 'steel', 2); cv.px(x + 1, y, 'steel', 1)
        for xx in range(x - 1, x + 3): cv.px(xx, 21, 'steel', 1)
    selout(cv); return cv

def fence(seg=3):
    cv = Cv(seg * 24 + 4, 28)
    for i in range(seg + 1):
        x = i * 24
        for y in range(4, 28): cv.px(x, y, 'bark', 3); cv.px(x + 1, y, 'bark', 2); cv.px(x + 2, y, 'bark', 1)
        cv.px(x, 3, 'bark', 4); cv.px(x + 1, 3, 'bark', 4); cv.px(x + 1, 2, 'bark', 4)   # pointed cap
        cv.px(x + 1, 10, 'bark', 1); cv.px(x + 1, 18, 'bark', 1)
    for i in range(seg):
        for k, ry in enumerate((9, 18)):
            x0 = i * 24 + 3; sag = 1 if i % 2 else 0
            for x in range(x0, x0 + 21):
                y = ry + (sag if 5 < x - x0 < 16 else 0)
                cv.px(x, y, 'bark', 4); cv.px(x, y + 1, 'bark', 3); cv.px(x, y + 2, 'bark', 1)
            cv.px(x0 + 7 + k * 6, ry + 1, 'bark', 1); cv.px(x0 + 8 + k * 6, ry + 1, 'bark', 0)   # knot
    selout(cv); return cv

def signpost():
    cv = Cv(26, 34)
    for y in range(8, 34): cv.px(12, y, 'bark', 3); cv.px(13, y, 'bark', 2); cv.px(14, y, 'bark', 1)
    cv.put(cv.poly([(2, 4), (22, 2), (24, 7), (22, 14), (2, 15), (0, 9)]), 'straw', 4)
    for y in range(5, 15): cv.px(2, y, 'straw', 5)
    for x in range(3, 22): cv.px(x, 14, 'straw', 2)
    cv.line(5, 8, 11, 8, 'bark', 1); cv.line(13, 7, 19, 7, 'bark', 1); cv.line(5, 11, 16, 11, 'bark', 1)
    selout(cv); return cv

def flowers(seed=6):
    cv = Cv(16, 12); rng = random.Random(seed)
    for x, y, c in ((3, 6, 'rose'), (9, 4, 'gold'), (13, 8, 'rose'), (7, 9, 'sky')):
        cv.line(x, y + 1, x, 11, 'leaf', 2); cv.px(x + 1, y + 3, 'leaf', 3)
        cv.px(x, y, c, 5); cv.px(x - 1, y, c, 4); cv.px(x + 1, y, c, 4); cv.px(x, y - 1, c, 5); cv.px(x, y + 1, c, 3); cv.px(x, y, 'gold' if c != 'gold' else 'ember', 6)
    return cv

def cottage(seed=7):
    cv = Cv(100, 104); rng = random.Random(seed); W = 100
    wall_top, wall_bot, x0, x1 = 48, 94, 8, 92
    # stone footing
    y = 94
    while y > 84:
        x = x0 - rng.randrange(0, 4); h = 5
        while x < x1:
            w = rng.randrange(6, 12); t = 3 + rng.choice((-1, 0, 0, 1))
            for yy in range(y - h + 1, y):
                for xx in range(max(x0, x + 1), min(x1, x + w)):
                    cv.px(xx, yy, 'stone', t + (1 if yy == y - h + 1 else -1 if yy == y - 1 else 0))
            x += w
        y -= h
    for xx in range(x0, x1): cv.px(xx, 94, 'stone', 1); cv.px(xx, 95, 'stone', 0)
    # plaster wall
    for yy in range(wall_top, 85):
        for xx in range(x0, x1): cv.px(xx, yy, 'straw', 5 if yy < 55 or xx < x0 + 2 else 4)
    for _ in range(40): xx, yy = rng.randrange(x0 + 2, x1 - 2), rng.randrange(wall_top + 4, 84); cv.px(xx, yy, 'straw', 3)
    # timber frame: posts, beams, braces
    def beam(xa, ya, xb, yb, w=2):
        for k in range(w): cv.line(xa, ya + k, xb, yb + k, 'bark', 3 - k)
    def post(x, ya, yb):
        for yy in range(ya, yb): cv.px(x, yy, 'bark', 3); cv.px(x + 1, yy, 'bark', 2); cv.px(x + 2, yy, 'bark', 1)
    beam(x0, wall_top, x1 - 1, wall_top, 3); beam(x0, 66, x1 - 1, 66, 2)
    for px_ in (x0, 30, 54, 76, x1 - 3): post(px_, wall_top, 85)
    cv.line(12, 83, 28, 69, 'bark', 2); cv.line(12, 84, 28, 70, 'bark', 1); cv.line(78, 69, 90, 83, 'bark', 2); cv.line(78, 70, 90, 84, 'bark', 1)
    # door (arched) between posts 54 and 76
    door = cv.rect(57, 72, 17, 23) | (cv.ell(65, 72, 9, 6) & cv.rect(57, 66, 17, 7))
    cv.put(door, 'bark', 3)
    ys_, xs_ = np.nonzero(door)
    for yy, xx in zip(ys_, xs_):
        cv.px(xx, yy, 'bark', 4 if xx < 60 else 3 if xx < 66 else 2 if xx < 71 else 1)
        if (xx - 57) % 4 == 3: cv.px(xx, yy, 'bark', 1)
    frame = (cv.rect(55, 72, 21, 23) | (cv.ell(65, 72, 11, 8) & cv.rect(55, 64, 21, 9))) & ~door
    cv.put(frame, 'stone', 3); cv.shift(frame & cv.rect(66, 64, 10, 32), -1)
    for xx in range(58, 73): cv.px(xx, 81, 'bark', 1); cv.px(xx, 82, 'bark', 4)   # cross strap
    cv.px(70, 84, 'gold', 6); cv.px(70, 85, 'gold', 4)
    for xx in range(56, 75): cv.px(xx, 95, 'stone', 4); cv.px(xx, 96, 'stone', 2)   # doorstep
    # windows: between posts 8-30 and 30-54
    for wx in (14, 36):
        for yy in range(54, 66):
            for xx in range(wx, wx + 12): cv.px(xx, yy, 'sky', 4 if (xx - wx) + (yy - 54) < 11 else 3)
        cv.px(wx + 1, 55, 'sky', 7); cv.px(wx + 2, 55, 'sky', 6); cv.px(wx + 1, 56, 'sky', 6)
        for yy in range(54, 66): cv.px(wx + 5, yy, 'bark', 1)
        for xx in range(wx, wx + 12): cv.px(xx, 59, 'bark', 1)
        for xx in range(wx - 1, wx + 13): cv.px(xx, 53, 'bark', 2); cv.px(xx, 66, 'straw', 6); cv.px(xx, 67, 'bark', 1)   # lintel, sill
        for yy in range(54, 66): cv.px(wx - 1, yy, 'bark', 3); cv.px(wx + 12, yy, 'bark', 1)
    # flower box under the left window
    for xx in range(13, 27): cv.px(xx, 68, 'bark', 3); cv.px(xx, 69, 'bark', 2); cv.px(xx, 70, 'bark', 1)
    for xx in range(14, 26, 3): cv.px(xx, 67, 'leaf', 3); cv.px(xx + 1, 66, 'rose' if xx % 2 else 'gold', 5); cv.px(xx + 1, 67, 'leaf', 2)
    # eave shadow across the wall top
    for yy in range(wall_top + 3, wall_top + 9):
        for xx in range(x0, x1):
            if cv.r[yy, xx] in (RID['straw'], RID['bark']): cv.s[yy, xx] = max(0, cv.s[yy, xx] - (2 if yy < wall_top + 6 else 1))
    # roof: shingle rows stepping from the ridge down to the eaves, overhanging the wall
    ridge_y, eave_y = 6, 50; rx0, rx1 = 0, W; ridge_x0, ridge_x1 = 36, 64
    rows = list(range(ridge_y, eave_y, 4))
    for i, ry in enumerate(rows):
        f = (ry - ridge_y) / (eave_y - ridge_y); xa = round(ridge_x0 + (rx0 - ridge_x0) * f); xb = round(ridge_x1 + (rx1 - ridge_x1) * f)
        t = 4 if f < .25 else 3 if f < .6 else 2
        for yy in range(ry, min(eave_y, ry + 4)):
            for xx in range(xa, xb):
                tt = t
                if yy == ry: tt = t + 1   # lit top of each row
                if yy == ry + 3: tt = t - 1
                cv.px(xx, yy, 'rust', tt)
        off = (i % 2) * 4
        for xx in range(xa + off, xb, 8):
            if ry + 1 < eave_y: cv.px(xx, ry + 1, 'rust', t - 2); cv.px(xx, ry + 2, 'rust', t - 2); cv.px(xx + 1, ry + 3, 'rust', t - 2)   # shingle gaps
            if ry + 3 < eave_y and xx + 4 < xb: cv.px(xx + 4, ry + 3, 'rust', t); cv.px(xx + 3, ry + 3, 'rust', t)   # the round bottom of each shingle
    # roof edges: a dark line under the eave, lit ridge cap
    for xx in range(rx0, rx1): cv.px(xx, eave_y, 'rust', 0); cv.px(xx, eave_y - 1, 'rust', 1)
    for xx in range(ridge_x0 - 2, ridge_x1 + 2): cv.px(xx, ridge_y - 1, 'rust', 5); cv.px(xx, ridge_y - 2, 'rust', 4)
    cv.line(ridge_x0, ridge_y, rx0, eave_y - 1, 'rust', 5); cv.line(ridge_x1 - 1, ridge_y, rx1 - 1, eave_y - 1, 'rust', 1)
    # chimney with cap and two smoke puffs
    for yy in range(2, 26):
        for xx in range(66, 76): cv.px(xx, yy, 'stone', 3 if xx < 71 else 2)
    for xx in range(65, 77): cv.px(xx, 2, 'stone', 5); cv.px(xx, 3, 'stone', 4); cv.px(xx, 4, 'stone', 1)
    for yy in (8, 13, 18): cv.px(69, yy, 'stone', 1); cv.px(73, yy + 2, 'stone', 1)
    for xx in range(66, 76): cv.px(xx, 25, 'stone', 0)
    selout(cv)
    # soft chimney smoke after the outline so it has none
    smoke = Cv(100, 104)
    return cv

# ---------------------------------------------------------------- tiles
def tile_grass(seed=1, n_tufts=7):
    cv = Cv(32, 32); rng = random.Random(seed); cv.put(cv.rect(0, 0, 32, 32), 'leaf', 3)
    def patch(step, n):
        for _ in range(n):
            x, y = rng.randrange(32), rng.randrange(32); m = cv.mask(); w, h = rng.randrange(5, 10), rng.randrange(3, 6)
            for dy in range(h):
                for dx in range(w):
                    if abs(dx - w / 2) / (w / 2) + abs(dy - h / 2) / (h / 2) < 1.25 + rng.random() * .3: m[(y + dy) % 32, (x + dx) % 32] = True
            cv.put(m, 'leaf', step)
    patch(2, 3); patch(4, 2)
    for _ in range(n_tufts):   # W tufts: three blades with a dark root, lit side left
        x, y = rng.randrange(32), rng.randrange(32); t = cv.s[y % 32, x % 32]
        cv.px((x - 1) % 32, (y - 1) % 32, 'leaf', t + 2); cv.px(x, (y - 2) % 32, 'leaf', t + 2); cv.px((x + 1) % 32, (y - 1) % 32, 'leaf', t + 1)
        cv.px(x, (y - 1) % 32, 'leaf', t - 1); cv.px(x, y, 'leaf', t - 2); cv.px((x - 1) % 32, y, 'leaf', t - 1); cv.px((x + 1) % 32, y, 'leaf', t - 1)
    for _ in range(6): x, y = rng.randrange(32), rng.randrange(32); cv.px(x, y, 'leaf', cv.s[y, x] - 1)
    if seed % 3 == 0:
        x, y = rng.randrange(32), rng.randrange(32); c = 'rose' if seed % 2 else 'gold'
        cv.px(x, y, c, 5); cv.px((x - 1) % 32, y, c, 4); cv.px((x + 1) % 32, y, c, 4); cv.px(x, (y - 1) % 32, c, 5); cv.px(x, (y + 1) % 32, c, 3); cv.px(x, y, 'gold' if c == 'rose' else 'ember', 6)
    return cv

def tile_dirt(seed=2):
    cv = Cv(32, 32); rng = random.Random(seed); cv.put(cv.rect(0, 0, 32, 32), 'straw', 3)
    for _ in range(5):   # worn lighter patches and darker damp ones
        x, y = rng.randrange(32), rng.randrange(32); w, h = rng.randrange(6, 12), rng.randrange(3, 6); st = 4 if rng.random() < .6 else 2; m = cv.mask()
        for dy in range(h):
            for dx in range(w):
                if abs(dx - w / 2) / (w / 2) + abs(dy - h / 2) / (h / 2) < 1.2: m[(y + dy) % 32, (x + dx) % 32] = True
        cv.put(m, 'straw', st)
    for _ in range(10): x, y = rng.randrange(32), rng.randrange(32); cv.px(x, y, 'straw', 2); cv.px((x + 1) % 32, y, 'straw', 2)
    for _ in range(3): x, y = rng.randrange(32), rng.randrange(32); cv.px(x, y, 'stone', 5); cv.px((x + 1) % 32, y, 'stone', 4); cv.px(x, (y + 1) % 32, 'stone', 2); cv.px((x + 1) % 32, (y + 1) % 32, 'stone', 1); cv.px((x + 2) % 32, (y + 1) % 32, 'straw', 1)
    for _ in range(2): x, y = rng.randrange(32), rng.randrange(32); cv.px(x, y, 'leaf', 2); cv.px(x, (y - 1) % 32, 'leaf', 3); cv.px((x + 1) % 32, (y - 1) % 32, 'leaf', 4)
    return cv

def tile_water(seed=3):
    cv = Cv(32, 32); rng = random.Random(seed); cv.put(cv.rect(0, 0, 32, 32), 'sky', 3)
    for y in range(32):
        for x in range(32):
            w = math.sin(x / 9 + y / 4.5 + seed * 2) + .4 * math.sin(x / 3.5 - y / 7 + seed)
            if w < -1.05: cv.px(x, y, 'sky', 2)
            elif w > 1.2: cv.px(x, y, 'sky', 4)
    for r in range(3):   # wave dashes in wavy rows: a lit dash with a shadow dash under its right end
        y0 = r * 11 + seed; x = rng.randrange(32)
        for k in range(2):
            L = rng.randrange(4, 8); y = (y0 + (k % 2)) % 32
            for i in range(L): cv.px((x + i) % 32, y, 'sky', 6 if i < L - 1 else 5)
            for i in range(2, L): cv.px((x + i + 1) % 32, (y + 1) % 32, 'sky', 1)
            x += L + rng.randrange(6, 12)
    x, y = rng.randrange(32), rng.randrange(32); cv.px(x, y, 'sky', 7); cv.px((x + 1) % 32, y, 'sky', 7)
    return cv

def tile_cobble(seed=4):
    cv = Cv(32, 32); rng = random.Random(seed); cv.put(cv.rect(0, 0, 32, 32), 'stone', 0)
    y = -2
    while y < 34:
        x = -rng.randrange(0, 6); h = rng.randrange(6, 9)
        while x < 34:
            w = rng.randrange(6, 11); t = 3 + rng.choice((-1, 0, 0, 1)); m = cv.mask()
            for yy in range(y + 1, y + h - 1):
                for xx in range(x + 1, x + w - 1):
                    if (yy == y + 1 or yy == y + h - 2) and (xx == x + 1 or xx == x + w - 2): continue   # rounded corners
                    m[yy % 32, xx % 32] = True
            cv.put(m, 'stone', t)
            for yy in range(y + 1, y + h - 1):
                for xx in range(x + 1, x + w - 1):
                    if not m[yy % 32, xx % 32]: continue
                    if yy == y + 1 or xx == x + 1: cv.px(xx % 32, yy % 32, 'stone', t + 1)
                    if yy == y + h - 2 or xx == x + w - 2: cv.px(xx % 32, yy % 32, 'stone', t - 1)
            x += w
        y += h
    for _ in range(3): x, y = rng.randrange(32), rng.randrange(32); cv.px(x, y, 'leaf', 2); cv.px(x, (y - 1) % 32, 'leaf', 3)
    return cv

# ---------------------------------------------------------------- scene
def scene():
    TW, TH = 14, 10; cv = Cv(TW * 32, TH * 32)
    grass = [tile_grass(s, 4 + s % 3) for s in range(1, 7)]; water = [tile_water(s) for s in range(1, 4)]; dirt = [tile_dirt(s) for s in range(1, 4)]; cob = [tile_cobble(s) for s in range(1, 3)]
    path = {(6, 9), (6, 8), (6, 7), (7, 7), (7, 6), (8, 6), (8, 5), (8, 4), (9, 4), (10, 4), (10, 3)}
    wat = {(x, y) for x in range(0, 2) for y in range(0, 10)} | {(2, y) for y in range(0, 4)}
    for ty in range(TH):
        for tx in range(TW):
            k = (tx * 7 + ty * 13) % 6
            if (tx, ty) in wat: t = water[k % 3]
            elif (tx, ty) in path: t = dirt[k % 3]
            else: t = grass[k]
            cv.blit(t, tx * 32, ty * 32)
    rng = random.Random(9)
    def tile_of(tx, ty):
        tx, ty = max(0, min(TW - 1, tx)), max(0, min(TH - 1, ty)); return 'w' if (tx, ty) in wat else 'p' if (tx, ty) in path else 'g'
    # organic edges: the path and the water eat into the grass by a wobbling 0..4 px so no tile corner shows
    def wobble(k, phase): return int(2.2 + 1.6 * math.sin(k / 4.5 + phase) + rng.random() * 1.4)
    dirt_m = cv.mask(); wat_m = cv.mask()
    for ty in range(TH):
        for tx in range(TW):
            if tile_of(tx, ty) == 'p': dirt_m[ty * 32:ty * 32 + 32, tx * 32:tx * 32 + 32] = True
            if tile_of(tx, ty) == 'w': wat_m[ty * 32:ty * 32 + 32, tx * 32:tx * 32 + 32] = True
    def grow(m, kind):
        out = m.copy(); H, W = m.shape
        for ty in range(TH):
            for tx in range(TW):
                if tile_of(tx, ty) != kind: continue
                ph = tx * 1.7 + ty * 2.3
                for k in range(32):
                    X, Y = tx * 32 + k, ty * 32 + k
                    if tile_of(tx, ty - 1) == 'g':
                        for d in range(1, wobble(k, ph) + 1): out[ty * 32 - d, X] = True
                    if tile_of(tx, ty + 1) == 'g':
                        for d in range(0, wobble(k, ph + 1)): out[min(H - 1, ty * 32 + 32 + d), X] = True
                    if tile_of(tx - 1, ty) == 'g':
                        for d in range(1, wobble(k, ph + 2) + 1): out[Y, tx * 32 - d] = True
                    if tile_of(tx + 1, ty) == 'g':
                        for d in range(0, wobble(k, ph + 3)): out[Y, min(W - 1, tx * 32 + 32 + d)] = True
        # round the outer corners, fill the inner ones
        for ty in range(TH):
            for tx in range(TW):
                if tile_of(tx, ty) != kind: continue
                for sx, sy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
                    if tile_of(tx + sx, ty) == 'g' and tile_of(tx, ty + sy) == 'g':   # outer corner: cut a quarter circle
                        cxp = tx * 32 + (0 if sx < 0 else 31); cyp = ty * 32 + (0 if sy < 0 else 31)
                        for dy in range(0, 9):
                            for dx in range(0, 9):
                                if dx * dx + dy * dy > 36 and 0 <= cyp + sy * dy < H and 0 <= cxp + sx * dx < W and dx < 9 and dy < 9:
                                    if (8 - dx) ** 2 + (8 - dy) ** 2 > 64: out[cyp + sy * dy, cxp + sx * dx] = False
                    if tile_of(tx + sx, ty) == kind and tile_of(tx, ty + sy) == kind and tile_of(tx + sx, ty + sy) == 'g':   # inner corner: fill it
                        cxp = tx * 32 + (0 if sx < 0 else 31); cyp = ty * 32 + (0 if sy < 0 else 31)
                        for dy in range(1, 9):
                            for dx in range(1, 9):
                                if (dx - 1) ** 2 + (dy - 1) ** 2 < 56 and 0 <= cyp + sy * dy < H and 0 <= cxp + sx * dx < W: out[cyp + sy * dy, cxp + sx * dx] = True
        return out
    dirt_m = grow(dirt_m, 'p'); wat_m = grow(wat_m, 'w')
    # paint the grown dirt with the dirt tiles, the grown water with the water tiles
    ys, xs = np.nonzero(dirt_m & ~(cv.r == RID['straw']))
    for y, x in zip(ys, xs): t = dirt[(x // 32 * 7 + y // 32 * 13) % 3]; cv.r[y, x] = t.r[y % 32, x % 32]; cv.s[y, x] = t.s[y % 32, x % 32]
    ys, xs = np.nonzero(wat_m & ~(cv.r == RID['sky']))
    for y, x in zip(ys, xs): t = water[(x // 32 * 7 + y // 32 * 13) % 3]; cv.r[y, x] = t.r[y % 32, x % 32]; cv.s[y, x] = t.s[y % 32, x % 32]
    # edges: the dirt gets a dark grass rim with a few lit blades; the water gets a sand lip, a wet band and foam
    e_d = edges(dirt_m) & dirt_m; grass_rim = dil(dirt_m) & ~dirt_m & ~wat_m
    cv.put(grass_rim, 'leaf', 1); cv.put(e_d, 'straw', 2)
    ys, xs = np.nonzero(grass_rim)
    for y, x in zip(ys, xs):
        if (x * 3 + y) % 7 == 0 and y > 0 and not dirt_m[y - 1, x]: cv.px(x, y - 1, 'leaf', 4); cv.px(x, y, 'leaf', 2)
    inner = wat_m.copy(); ring = []
    for d in range(4):
        e = edges(inner) & inner; ring.append(e); inner = inner & ~e
    land_rim = dil(wat_m) & ~wat_m
    land_rim2 = dil(land_rim) & ~wat_m & ~land_rim
    cv.put(land_rim2, 'straw', 4); cv.put(land_rim, 'straw', 3); cv.put(ring[0], 'sky', 7); cv.put(ring[1], 'sky', 5); cv.put(ring[2], 'sky', 2); cv.put(ring[3], 'sky', 2)
    ys, xs = np.nonzero(ring[0])
    for y, x in zip(ys, xs):
        if (x + y * 2) % 5 == 0: cv.px(x, y, 'sky', 5)
    ys, xs = np.nonzero(land_rim2)
    for y, x in zip(ys, xs):
        if (x * 2 + y) % 6 == 0: cv.px(x, y, 'straw', 2)
    def ground_shadow(x, y, rx, ry):
        m = cv.ell(x, y, rx, ry); sel = m & ((cv.r == RID['leaf']) | (cv.r == RID['skin']) | (cv.r == RID['stone'])); cv.shift(sel, -1)
    # props (anchor = bottom centre)
    props = []
    def place(p, ax, ay, sh=None):
        if sh: ground_shadow(ax + sh[0], ay + sh[1], sh[2], sh[3])
        props.append((p, ax - p.w // 2, ay - p.h))
    place(cottage(), 10 * 32 + 16, 4 * 32 + 2, (0, -6, 52, 8))
    place(fence(3), 7 * 32 + 20, 4 * 32 + 6); place(fence(2), 13 * 32 - 4, 4 * 32 + 6)
    place(tree_oak(1, 0), 3 * 32 + 20, 3 * 32 + 10, (2, -4, 20, 7)); place(tree_oak(5, 2), 12 * 32 + 20, 8 * 32 + 20, (2, -4, 20, 7))
    place(tree_pine(2), 5 * 32 + 10, 1 * 32 + 28, (0, -3, 14, 5)); place(tree_pine(3), 13 * 32 + 2, 1 * 32 + 20, (0, -3, 14, 5))
    place(rock(4, True), 4 * 32 + 10, 8 * 32 + 12, (2, -2, 18, 5)); place(rock(5, False), 9 * 32 + 8, 8 * 32 + 26, (1, -1, 10, 3))
    place(bush(3), 8 * 32 + 10, 2 * 32 + 20, (0, -2, 15, 4)); place(bush(4, False), 3 * 32 + 8, 6 * 32 + 10, (0, -2, 15, 4))
    place(lamp(), 8 * 32 + 10, 6 * 32 + 10, (0, -1, 5, 2)); place(bench(), 10 * 32 + 10, 6 * 32 + 20, (0, -2, 18, 3))
    place(signpost(), 5 * 32 + 20, 8 * 32 + 4, (0, -1, 4, 2)); place(stump(), 11 * 32 + 10, 2 * 32 + 10, (0, -2, 10, 3))
    for i, (x, y) in enumerate(((6 * 32 + 4, 5 * 32 + 8), (2 * 32 + 20, 8 * 32 + 20), (12 * 32 + 6, 6 * 32 + 26), (7 * 32 + 8, 9 * 32 + 12))): place(flowers(i), x, y)
    props.sort(key=lambda t: t[2] + t[0].h)
    for p, x, y in props: cv.blit(p, x, y)
    return cv

def strip(pal, z=3):
    items = [tree_oak(1), tree_pine(2), bush(3), rock(4), rock(5, False), stump(), lamp(), bench(), fence(2), signpost(), cottage()]
    tiles = [tile_grass(1), tile_grass(2), tile_dirt(1), tile_water(1), tile_cobble(1)]
    W = sum(p.w * z + 10 for p in items) + sum(32 * z + 10 for _ in tiles); H = max(p.h for p in items) * z
    im = Image.new('RGB', (W, H), (74, 70, 86)); x = 0
    for p in items:
        r = p.render(pal).resize((p.w * z, p.h * z), Image.NEAREST); im.paste(r, (x, H - r.height), r); x += p.w * z + 10
    for t in tiles:
        r = t.render(pal).resize((32 * z, 32 * z), Image.NEAREST); im.paste(r, (x, H - r.height)); x += 32 * z + 10
    return im

def main():
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'validation' / 'v37-variants-4.png')
    z = 3; sc = scene(); pals = {k: build_palette(M) for k, M in MOODS.items()}
    panels = []
    for name, M in MOODS.items():
        pal = pals[name]; im = sc.render(pal).resize((sc.w * z, sc.h * z), Image.NEAREST); panels.append((name, M['note'], im))
    st = strip(pals['Mana'], z)
    W = max(max(p[2].width for p in panels), st.width) + 20; H = sum(p[2].height + 34 for p in panels) + st.height + 40
    sheet = Image.new('RGB', (W, H), (52, 50, 62)); d = ImageDraw.Draw(sheet); y = 6
    d.text((10, y), 'Props and tiles at 3x (Mana palette); every pixel from the ramps, sel-out outlines, light top-left', fill=(230, 228, 240)); y += 16
    sheet.paste(st, (10, y)); y += st.height + 18
    for name, note, im in panels:
        d.text((10, y), f'{name}: {note}', fill=(230, 228, 240)); y += 16; sheet.paste(im, (10, y)); y += im.height + 18
    out.parent.mkdir(parents=True, exist_ok=True); sheet.save(out); print(out, sheet.size)

if __name__ == '__main__':
    main()
