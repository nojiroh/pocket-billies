#!/usr/bin/env python3
"""Procedural pixel-art scene props for Pocket Billies (towns and routes of the hollow earth).

Usage:  python3 tools/build-scene-props.py [--all] [--sheet out.png] [--far-sheet out.png] [key ...]
Needs only Pillow. Every prop is drawn pixel by pixel from code (seeded, so the
output is reproducible) and written to game/art/scene/props/<key>.png, plus
game/art/scene/props.json with anchors and placement hints. Horizon strips go to
game/art/scene/far/ (+ far.json) and small animated sprites to game/art/scene/fx/ (+ fx.json).

Existing PNGs are never overwritten (they may have been touched up by hand): a run
only writes files that are missing, but always refreshes the json metadata for every
prop. Pass --all to redraw every PNG; pass keys to limit which PNGs may be written.

props.json fields: name w h ox oy shadow sway flat tags, plus
  group  base prop this one is a variant of (equal to its own key for a base)
  solid  blocking radius in metres (0 = walk through)   | box [width_m, depth_m] for buildings
  door   {x, y} door bottom centre, px from the base point (buildings)
  fx     [{k, x, y}] effect anchors, px from the base point (y<0 is up):
         smoke (chimneys) spray (fountain) fire (campfire) sparkle (crystals)
         glow (lamps) window (lit/glazed windows) spin (windmill hub)
  blades {img, x, y, w, h, px, py} separate rotating sails for windmill_tower (hub at x, y; pivot px, py)
  posts  [{x, r}] separate blocking posts (the town gate)

Style follows game/art/battle/props: 1px crisp pixels, transparent background,
dark hue-shifted outline, 4-5 tone cel shading lit from the top-left.
Scale: 34 px per world unit. The bottom row of every upright prop is its ground
line; drawing the PNG at (x+ox, y+oy) puts its base centre on (x, y).
Flat decals (flat=1) are anchored at their centre instead.
"""
import json, math, os, random, sys, zlib
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.normpath(os.path.join(HERE, '..', 'game'))
OUT = os.path.join(GAME, 'art', 'scene', 'props')
META = os.path.join(GAME, 'art', 'scene', 'props.json')
PPU = 34

# ----------------------------------------------------------------------------- colour
OL = (36, 25, 54)          # outline anchor (dark plum, like the battle props)


def mix(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def dk(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c)


def ramp(b):
    """[deep shadow, shadow, base, light, highlight]; shadows lean lavender, lights lean warm."""
    b = tuple(b)
    return [mix(dk(b, .55), (60, 42, 112), .30), mix(dk(b, .79), (96, 74, 152), .17), b,
            mix(b, (255, 244, 196), .30), mix(b, (255, 252, 234), .60)]


def olc(c):
    return mix(dk(c, .45), OL, .80)


P = dict(
    cream=(246, 230, 190), peach=(248, 214, 178), white=(234, 238, 236), teal=(46, 164, 160),
    sky=(78, 154, 214), coral=(232, 98, 86), gold=(244, 192, 60), mint=(126, 212, 172),
    lav=(166, 152, 204), leaf=(96, 166, 74), leafy=(150, 196, 74), oak=(78, 150, 78),
    pine=(46, 128, 98), wood=(178, 118, 72), dwood=(132, 84, 60), plank=(204, 150, 96),
    stone=(170, 166, 180), rock=(156, 140, 146), cave=(132, 120, 140), glass=(112, 196, 228),
    iron=(70, 84, 112), hay=(234, 192, 92), pink=(246, 132, 166), cyan=(84, 224, 236),
    red=(222, 64, 72), orange=(246, 146, 50), soil=(146, 98, 70), brick=(196, 108, 84),
    berry=(214, 52, 80), lilac=(178, 136, 226), blue=(96, 140, 236), yellow=(250, 214, 70),
    kelp=(92, 168, 104), tire=(78, 76, 92), rust=(196, 112, 70), bark=(150, 104, 74),
    birch=(236, 232, 220), moss=(118, 170, 80), fire=(250, 160, 50), water=(82, 168, 210),
    marble=(208, 204, 214), lamp=(255, 222, 120),
)
R = {k: ramp(v) for k, v in P.items()}

LUT = {}
for _k, _r in R.items():
    for _i, _c in enumerate(_r):
        LUT.setdefault(_c, (_r, _i))


def darken(cv, x, y, n=1):
    c = cv.get(x, y)
    if c in LUT:
        r, i = LUT[c]
        cv.px(x, y, r[max(0, i - n)])


def shade_below(cv, x0, x1, y, rows=3):
    for x in range(x0, x1 + 1):
        for k in range(rows):
            darken(cv, x, y + k, 2 if k == 0 else 1)


LX, LY, LZ = -.55, -.62, .56


def sph(nx, ny, bias=0.0):
    nz = math.sqrt(max(0.0, 1 - nx * nx - ny * ny))
    d = LX * nx + LY * ny + LZ * nz + bias
    return 4 if d > .97 else 3 if d > .64 else 2 if d > .24 else 1 if d > -.10 else 0


def xt(x, a, b, cuts=(.22, .62, .86)):
    """tone across a vertical surface lit from the left"""
    r = (x + .5 - a) / max(1e-6, (b - a))
    return 3 if r < cuts[0] else 2 if r < cuts[1] else 1 if r < cuts[2] else 0


def pip(x, y, pts):
    c = False
    j = len(pts) - 1
    for i in range(len(pts)):
        xi, yi = pts[i]
        xj, yj = pts[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            c = not c
        j = i
    return c


# ----------------------------------------------------------------------------- canvas
class Cv:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.a = [None] * (w * h)
        s.fx = []          # effect anchors (kind, x, y) in canvas pixels; merged by paste()
        s.door = None      # canvas x of the door's bottom centre for buildings

    def ok(s, x, y):
        return 0 <= x < s.w and 0 <= y < s.h

    def get(s, x, y):
        return s.a[y * s.w + x] if s.ok(x, y) else None

    def px(s, x, y, c):
        if c is not None and s.ok(x, y):
            s.a[y * s.w + x] = c

    def put(s, x, y, c):
        s.px(int(x), int(y), c(int(x), int(y)) if callable(c) else c)

    def rect(s, x0, y0, x1, y1, c):
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                s.put(x, y, c)

    def orect(s, x0, y0, x1, y1, c):
        for x in range(x0, x1 + 1):
            s.px(x, y0, c); s.px(x, y1, c)
        for y in range(y0, y1 + 1):
            s.px(x0, y, c); s.px(x1, y, c)

    def ell(s, cx, cy, rx, ry, c):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1:
                    s.put(x, y, c)

    def ellpts(s, cx, cy, rx, ry):
        out = []
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1:
                    out.append((x, y))
        return out

    def poly(s, pts, c):
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        for y in range(int(min(ys)) - 1, int(max(ys)) + 2):
            for x in range(int(min(xs)) - 1, int(max(xs)) + 2):
                if pip(x + .5, y + .5, pts):
                    s.put(x, y, c)

    def polypts(s, pts):
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        return [(x, y) for y in range(int(min(ys)) - 1, int(max(ys)) + 2)
                for x in range(int(min(xs)) - 1, int(max(xs)) + 2) if pip(x + .5, y + .5, pts)]

    def line(s, x0, y0, x1, y1, c, w=1):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(n + 1):
            t = i / n
            x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t
            if w == 1:
                s.put(round(x - .5), round(y - .5), c)
            else:
                for dy in range(w):
                    for dx in range(w):
                        s.put(round(x - .5 - (w - 1) / 2) + dx, round(y - .5 - (w - 1) / 2) + dy, c)

    def paste(s, o, dx=0, dy=0):
        for y in range(o.h):
            for x in range(o.w):
                c = o.a[y * o.w + x]
                if c is not None:
                    s.px(x + dx, y + dy, c)
        s.fx.extend((k, x + dx, y + dy) for (k, x, y) in o.fx)
        if o.door is not None and s.door is None:
            s.door = o.door + dx

    def outline(s, col=None, diag=False):
        add = []
        nb = ((1, 0), (-1, 0), (0, 1), (0, -1)) + (((1, 1), (-1, 1), (1, -1), (-1, -1)) if diag else ())
        for y in range(s.h):
            for x in range(s.w):
                if s.a[y * s.w + x] is None:
                    for ax, ay in nb:
                        c = s.get(x + ax, y + ay)
                        if c is not None:
                            add.append((x, y, col or olc(c)))
                            break
        for x, y, c in add:
            s.px(x, y, c)
        return s

    def has(s, x, y):
        return s.get(x, y) is not None


def blade(cv, x0, y0, x1, y1, bend, w0, c, steps=14):
    """tapered curved blade from base (x0,y0) to tip (x1,y1); c = fn(t, side) or colour"""
    L, Rr = [], []
    for i in range(steps + 1):
        t = i / steps
        x = x0 + (x1 - x0) * t + bend * math.sin(t * math.pi * .5) * t
        y = y0 + (y1 - y0) * t
        hw = w0 * (1 - t) * .5 + .15
        L.append((x - hw, y)); Rr.append((x + hw, y))
    pts = L + Rr[::-1]
    cv.poly(pts, c)


# ----------------------------------------------------------------------------- foliage
def blob(cv, cx, cy, rx, ry, Rm, rng, cell=7, bump=.06, bias=0.0, sep=True, cap=4, floor=0):
    """leafy cluster: bumpy ellipse, sphere-lit, broken into scalloped leaf clumps"""
    k = rng.choice([7, 8, 9, 10, 11]); ph = rng.random() * 6.283
    rowh = cell * .78
    oy0 = cy - ry - cell; ox0 = cx - rx - cell
    grid = []
    r = 0; y = oy0
    while y < cy + ry + cell * 2:
        row = []; x = ox0 + (cell / 2 if r % 2 else 0)
        while x < cx + rx + cell * 2:
            row.append((x + rng.uniform(-1.4, 1.4), y + rng.uniform(-1.1, 1.1)))
            x += cell
        grid.append(row); r += 1; y += rowh
    pts = []
    for y in range(int(cy - ry * 1.2) - 1, int(cy + ry * 1.2) + 2):
        for x in range(int(cx - rx * 1.2) - 1, int(cx + rx * 1.2) + 2):
            dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry
            rr = math.hypot(dx, dy); th = math.atan2(dy, dx)
            lim = 1 + bump * math.sin(k * th + ph) + bump * .6 * math.sin((2 * k + 3) * th + ph * 2.1)
            if rr <= lim:
                pts.append((x, y, dx / lim, dy / lim))
    mask = set((p[0], p[1]) for p in pts)
    if sep:
        for (x, y) in mask:
            for ax, ay in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, 1)):
                q = (x + ax, y + ay)
                if q not in mask and cv.has(*q):
                    cv.px(q[0], q[1], Rm[0] if ay >= 0 else Rm[1])
    for (x, y, nx, ny) in pts:
        t = sph(nx * .96, ny * .96, bias)
        ri = int(round((y + .5 - oy0) / rowh))
        best = None; bd = 1e9
        for rj in (ri - 1, ri, ri + 1):
            if 0 <= rj < len(grid):
                row = grid[rj]
                ci = int(round((x + .5 - ox0 - (cell / 2 if rj % 2 else 0)) / cell))
                for cj in (ci - 1, ci, ci + 1):
                    if 0 <= cj < len(row):
                        px_, py_ = row[cj]
                        d = (x + .5 - px_) ** 2 + (y + .5 - py_) ** 2
                        if d < bd:
                            bd = d; best = (px_, py_)
        ddx = (x + .5 - best[0]) / cell; ddy = (y + .5 - best[1]) / cell
        dd = ddx * ddx + ddy * ddy
        if ddy > .16 and dd > .15:
            t -= 1
        elif ddy < -.12 and ddx < .15 and dd > .10 and t >= 2:
            t += 1
        cv.px(x, y, Rm[max(floor, min(cap, t))])
    return mask


def trunk(cv, pts, Rw, rng, streaks=True):
    xs = [p[0] for p in pts]
    a, b = min(xs), max(xs)
    for (x, y) in cv.polypts(pts):
        # local width at this row for proper shading
        row = [q for q in range(int(a) - 1, int(b) + 2) if pip(q + .5, y + .5, pts)]
        t = xt(x, row[0], row[-1] + 1) if row else 2
        cv.px(x, y, Rw[t])
    if streaks:
        for _ in range(int((b - a) * 1.5)):
            x = rng.randint(int(a) + 1, int(b) - 1)
            y0 = rng.randint(int(min(p[1] for p in pts)), int(max(p[1] for p in pts)))
            for y in range(y0, y0 + rng.randint(2, 5)):
                c = cv.get(x, y)
                if c in Rw[1:]:
                    cv.px(x, y, Rw[max(0, Rw.index(c) - 1)])


# ----------------------------------------------------------------------------- building parts
def tile_roof(cv, top, bot, xlt, xrt, xlb, xrb, Rr, tw=8, th=6):
    """hipped roof face seen from the front and a little above"""
    for y in range(top, bot + 1):
        f = (y + .5 - top) / (bot + 1 - top)
        a = xlt + (xlb - xlt) * f; b = xrt + (xrb - xrt) * f
        for x in range(int(math.floor(a)), int(math.ceil(b)) + 1):
            if x + .5 < a or x + .5 > b:
                continue
            ry = (y - top) % th; rw = (y - top) // th
            col = (x - int(xlb) + (tw // 2) * (rw % 2)) % tw
            t = 2
            if ry == th - 1: t = 0
            elif ry == th - 2: t = 1 if col in (0, 1, tw - 1) else 2
            elif ry == 0: t = 3
            if col == 0 and ry < th - 1: t = 1
            if x + .5 - a < 3.2: t = min(4, t + 1)            # left hip catches the light
            elif b - (x + .5) < 3.2: t = max(0, t - 1)
            if y - top < 3: t = 4 if y == top else 3       # ridge cap
            if y == top + 3: t = 1
            if y >= bot - 1: t = 0 if y == bot else 1      # eave
            cv.px(x, y, Rr[t])


def gable_roof(cv, ax, ay, xl, xr, yb, T, Rr):
    """front gable: an inverted V of tiles, left slope lit, right slope shaded"""
    for y in range(ay, yb + 1):
        for x in range(xl - 1, xr + 2):
            X = x + .5; Y = y + .5
            if X <= ax:
                ey = ay + (ax - X) * (yb - ay) / (ax - xl); side = 0
            else:
                ey = ay + (X - ax) * (yb - ay) / (xr - ax); side = 1
            v = Y - ey
            if v < 0 or v > T or Y > yb + .5:
                continue
            u = abs(X - ax) * 1.2
            rw = int(v // 5); rv = v % 5
            cu = (u + (3.5 if rw % 2 else 0)) % 8
            base = 3 if side == 0 else 2
            t = base
            if rv >= 4: t = base - 2
            elif rv >= 3: t = base - 1
            elif rv < 1: t = base + 1
            if cu < 1 and rv < 4: t = base - 1
            if v < 2.2: t = 4 if side == 0 else 3
            if v > T - 2: t = 0
            cv.px(x, y, Rr[max(0, min(4, t))])


def wall(cv, x0, y0, x1, y1, Rw, siding=0, eave=3):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            t = 2
            if siding and (y - y0) % siding == siding - 1: t = 1
            if x == x0: t = 3
            elif x >= x1 - 1: t = 1
            if y - y0 < eave: t = 1 if y - y0 < eave - 1 else min(t, 1)
            if y - y0 < eave - 2: t = 0
            cv.px(x, y, Rw[t])


def window(cv, x0, y0, w, h, Rf=None, Rg=None, cross=True, box=None, rng=None, sill=True, glow=False, rec='window'):
    Rf = Rf or R['white']; Rg = Rg or (R['lamp'] if glow else R['glass'])
    if rec:
        cv.fx.append((rec, x0 + (w - 1) / 2, y0 + (h - 1) / 2))
    x1 = x0 + w - 1; y1 = y0 + h - 1
    cv.rect(x0, y0, x1, y1, Rf[2])
    cv.orect(x0, y0, x1, y1, olc(Rf[1]))
    for x in range(x0 + 1, x1):
        cv.px(x, y0 + 1, Rf[4])
    for y in range(y0 + 1, y1):
        cv.px(x0 + 1, y, Rf[3]); cv.px(x1 - 1, y, Rf[1])
    gx0, gy0, gx1, gy1 = x0 + 2, y0 + 2, x1 - 2, y1 - 2
    per = max(12, (w + h) // 2)
    for y in range(gy0, gy1 + 1):
        for x in range(gx0, gx1 + 1):
            d = (x - gx0) + (y - gy0)
            t = 2
            if y <= gy0 + 1: t = 0 if y == gy0 else 1                 # shadow under frame
            elif (d % per) in (5, 6, 7) and (x - gx0) < (gx1 - gx0) * .75: t = 4
            elif (d % per) == 9 and (x - gx0) < (gx1 - gx0) * .75: t = 3
            elif x >= gx1 - 1 or y >= gy1: t = 1
            cv.px(x, y, Rg[t])
    if cross:
        mx = (x0 + x1) // 2; my = (y0 + y1) // 2
        for y in range(gy0, gy1 + 1):
            cv.px(mx, y, Rf[2])
        for x in range(gx0, gx1 + 1):
            cv.px(x, my, Rf[3])
        for x in range(gx0, gx1 + 1):
            if cv.get(x, my + 1) not in (Rf[2], Rf[3]): cv.px(x, my + 1, Rg[1])
    if sill:
        cv.rect(x0 - 2, y1 + 1, x1 + 2, y1 + 2, Rf[3])
        for x in range(x0 - 2, x1 + 3):
            cv.px(x, y1 + 2, Rf[1])
        cv.px(x0 - 3, y1 + 1, olc(Rf[1])); cv.px(x1 + 3, y1 + 1, olc(Rf[1]))
        cv.px(x0 - 3, y1 + 2, olc(Rf[1])); cv.px(x1 + 3, y1 + 2, olc(Rf[1]))
        for x in range(x0 - 3, x1 + 4):
            cv.px(x, y1 + 3, olc(Rf[1]))
    if box:
        flowerbox(cv, x0 - 1, x1 + 1, y1 + 3, box, rng or random.Random(1))


def flowerbox(cv, x0, x1, y, cols, rng):
    Rw = R['wood']
    cv.rect(x0, y, x1, y + 4, Rw[2])
    for x in range(x0, x1 + 1):
        cv.px(x, y, Rw[3]); cv.px(x, y + 4, Rw[0]); cv.px(x, y + 5, olc(Rw[1]))
    for yy in range(y, y + 5):
        cv.px(x0 - 1, yy, olc(Rw[1])); cv.px(x1 + 1, yy, olc(Rw[1]))
    cv.px(x0 + 2, y + 2, Rw[1]); cv.px(x1 - 2, y + 2, Rw[1])
    # leaves
    for x in range(x0, x1 + 1):
        h = 2 + ((x * 7) % 3)
        for yy in range(y - h, y):
            cv.px(x, yy, R['leaf'][2 if (x + yy) % 3 else 1])
        cv.px(x, y - h - 1, olc(R['leaf'][1]))
    i = 0
    for x in range(x0 + 1, x1, 4):
        c = R[cols[i % len(cols)]]; i += 1
        fy = y - 4 - (i % 2)
        cv.px(x, fy, c[3]); cv.px(x + 1, fy, c[2]); cv.px(x, fy + 1, c[2]); cv.px(x + 1, fy + 1, c[1])
        cv.px(x, fy - 1, olc(c[1])); cv.px(x + 1, fy - 1, olc(c[1]))
        cv.px(x - 1, fy, olc(c[1])); cv.px(x + 2, fy, olc(c[1])); cv.px(x + 2, fy + 1, olc(c[1]))


def door(cv, cx, bot, w, h, Rw=None, arch=True, glass=True, Rfr=None):
    Rw = Rw or R['wood']; Rfr = Rfr or R['dwood']
    x0 = cx - w // 2; x1 = x0 + w - 1; y0 = bot - h + 1
    rr = w / 2

    def inside(x, y, m):
        if x < x0 + m or x > x1 - m or y > bot or y < y0 + m:
            return False
        if arch and y < y0 + rr:
            return ((x + .5 - (x0 + rr)) / (rr - m)) ** 2 + ((y + .5 - (y0 + rr)) / (rr - m)) ** 2 <= 1
        return True
    for y in range(y0 - 1, bot + 1):
        for x in range(x0 - 1, x1 + 2):
            if inside(x, y, 0):
                c = Rfr[2] if x - x0 < 2 or x1 - x < 1 else Rfr[1]
                if inside(x, y, 2):
                    pw = 5
                    i = (x - x0 - 2)
                    t = 2
                    if i % pw == 0: t = 1
                    elif i % pw == 1: t = 3
                    if x >= x1 - 3: t = min(t, 1)
                    if y < y0 + 4 or (arch and not inside(x, y - 2, 2)): t = 0
                    c = Rw[t]
                cv.px(x, y, c)
    # outline
    for y in range(y0 - 2, bot + 1):
        for x in range(x0 - 2, x1 + 3):
            if not inside(x, y, 0) and any(inside(x + a, y + b, 0) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                cv.px(x, y, olc(Rfr[1]))
    # cross rail, little window and knob
    my = bot - int(h * .38)
    for x in range(x0 + 2, x1 - 1):
        cv.px(x, my, Rw[1]); cv.px(x, my - 1, Rw[3])
    if glass:
        gy = y0 + int(rr) + 1
        for dy in range(4):
            for dx in range(-3, 4):
                if dx == 0: continue
                cv.px(cx + dx - (1 if w % 2 == 0 else 0), gy + dy, R['lamp'][3 if dy < 2 else 2] if abs(dx) > 0 else None)
        for dx in range(-4, 5):
            cv.px(cx + dx - (1 if w % 2 == 0 else 0), gy - 1, olc(Rw[1])); cv.px(cx + dx - (1 if w % 2 == 0 else 0), gy + 4, olc(Rw[1]))
        for dy in range(-1, 5):
            cv.px(cx - 4 - (1 if w % 2 == 0 else 0), gy + dy, olc(Rw[1])); cv.px(cx + 4 - (1 if w % 2 == 0 else 0), gy + dy, olc(Rw[1]))
            cv.px(cx - (1 if w % 2 == 0 else 0), gy + dy, olc(Rw[1]))
    kx = x1 - 5; ky = bot - int(h * .5)
    cv.px(kx, ky, R['gold'][4]); cv.px(kx + 1, ky, R['gold'][2]); cv.px(kx, ky + 1, R['gold'][2]); cv.px(kx + 1, ky + 1, R['gold'][1])
    cv.px(kx - 1, ky, OL); cv.px(kx + 2, ky + 1, olc(R['gold'][1]))


def stone_band(cv, x0, x1, y0, y1, Rs, bw=9, bh=3):
    for y in range(y0, y1 + 1):
        r = (y - y0) // bh; ry = (y - y0) % bh
        for x in range(x0, x1 + 1):
            c = (x - x0 + (bw // 2) * (r % 2)) % bw
            t = 2
            if ry == bh - 1 or c == 0: t = 0 if ry == bh - 1 else 1
            elif ry == 0: t = 3
            if x == x0: t = max(t, 3)
            if x >= x1 - 1: t = min(t, 1)
            cv.px(x, y, Rs[t])


def shingles(cv, pts, Rr, tw=6, th=4, lit_left=True):
    xs = [p[0] for p in pts]; a, b = min(xs), max(xs)
    for (x, y) in cv.polypts(pts):
        rw = y // th; ry = y % th
        col = (x + (tw // 2) * (rw % 2)) % tw
        t = 2
        if ry == th - 1: t = 0
        elif ry == 0: t = 3
        if col == 0 and ry != th - 1: t = 1
        rel = (x - a) / max(1, b - a)
        if lit_left and rel < .25: t = min(4, t + 1)
        if rel > .8: t = max(0, t - 1)
        cv.px(x, y, Rr[t])


# ============================================================================= PROPS
PROPS = {}


def prop(key, name, shadow, sway, tags, flat=0):
    def deco(fn):
        PROPS[key] = dict(fn=fn, name=name, shadow=shadow, sway=sway, tags=tags, flat=flat)
        return fn
    return deco


# ----------------------------------------------------------------------------- buildings
def cottage_walls(cv, x0, x1, top, G, Rwall, rng, posts=True):
    wall(cv, x0, top, x1, G - 6, Rwall, siding=0, eave=4)
    # plaster texture: a few soft cracks/patches
    for _ in range((x1 - x0) // 30):
        x = rng.randint(x0 + 8, x1 - 10); y = rng.randint(top + 30, G - 12)
        cv.px(x, y, Rwall[1]); cv.px(x + 1, y, Rwall[1]); cv.px(x + 2, y + 1, Rwall[1]); cv.px(x, y - 1, Rwall[3]); cv.px(x + 1, y - 1, Rwall[3])
    if posts:
        Rp = R['dwood']
        for px0 in (x0, x1 - 4):
            for y in range(top, G - 5):
                for x in range(px0, px0 + 5):
                    cv.px(x, y, Rp[[3, 2, 2, 1, 0][x - px0]])
        for x in range(x0, x1 + 1):
            for k, t in enumerate((0, 1, 2, 1)):
                cv.px(x, top + 4 + k, Rp[t] if x > x0 + 4 and x < x1 - 4 else cv.get(x, top + 4 + k))
    stone_band(cv, x0 - 2, x1 + 2, G - 5, G, R['stone'])


@prop('house', 'Cottage', 1.6, 0, ['town'])
def p_house(rng):
    W, H = 170, 160; G = H - 2; cx = 85
    cv = Cv(W, H)
    x0, x1 = 30, 140
    cottage_walls(cv, x0, x1, 76, G, R['cream'], rng)
    # chimney (behind roof edge, poking up)
    ch = Cv(W, H)
    Rb = R['brick']
    for y in range(18, 50):
        for x in range(106, 120):
            t = 2
            if (y - 18) % 4 == 3 or ((x - 106 + (3 if ((y - 18) // 4) % 2 else 0)) % 7 == 0): t = 1
            if x == 106: t = 3
            if x >= 118: t = 0
            ch.px(x, y, Rb[t])
    ch.rect(104, 14, 121, 18, lambda x, y: R['stone'][3 if y == 14 else 2 if x < 118 else 1])
    ch.outline()
    cv.paste(ch)
    tile_roof(cv, 34, 80, 46, 124, 18, 152, R['teal'])
    shade_below(cv, x0, x1, 81, 3)
    # wall shadow under eaves already from wall(); timber beam under roof
    door(cv, cx, G - 6, 26, 50)
    # door step
    cv.rect(cx - 16, G - 5, cx + 15, G, lambda x, y: R['stone'][3 if y == G - 5 else 2 if x < cx + 12 else 1])
    for x in range(cx - 17, cx + 17):
        cv.px(x, G - 6, olc(R['stone'][1]))
    cv.px(cx - 17, G - 5, olc(R['stone'][1])); cv.px(cx + 16, G - 5, olc(R['stone'][1]))
    window(cv, 44, 92, 24, 22, box=['pink', 'gold', 'coral'], rng=rng)
    window(cv, 102, 92, 24, 22, box=['gold', 'pink', 'lilac'], rng=rng)
    # little attic dormer window in the roof
    window(cv, 76, 50, 18, 14, sill=False, glow=True)
    cv.outline()
    cv.fx.append(('smoke', 112, 13)); cv.door = cx
    return cv, cx


@prop('house_red', 'Red-roof cottage', 1.6, 0, ['town'])
def p_house_red(rng):
    W, H = 170, 160; G = H - 2; cx = 85
    cv = Cv(W, H)
    x0, x1 = 32, 138
    ax, ay, xl, xr, yb = cx, 14, 12, 158, 84
    # gable wall + body
    Rw = R['peach']
    for y in range(ay, G - 5):
        for x in range(x0, x1 + 1):
            X = x + .5; Y = y + .5
            ey = ay + abs(X - ax) * (yb - ay) / (ax - xl)
            if Y >= ey:
                t = 2
                if x == x0: t = 3
                elif x >= x1 - 1: t = 1
                if y < 84:                       # board-and-batten gable
                    k = (x - cx) % 6
                    t = 3 if k == 1 else 1 if k == 0 else 2
                    cv.px(x, y, R['cream'][t])
                else:
                    cv.px(x, y, Rw[t])
    # timber frame on the gable
    Rp = R['dwood']
    for x in range(x0, x1 + 1):
        for k, t in enumerate((1, 0, 2, 1)):
            cv.px(x, 84 + k, Rp[(0, 1, 2, 1)[k]])
    for px0 in (x0, x1 - 4):
        for y in range(88, G - 5):
            for x in range(px0, px0 + 5):
                cv.px(x, y, Rp[[3, 2, 2, 1, 0][x - px0]])
    stone_band(cv, x0 - 2, x1 + 2, G - 5, G, R['stone'])
    # chimney on right slope
    ch = Cv(W, H)
    for y in range(24, 58):
        for x in range(112, 124):
            t = 2
            if (y - 24) % 4 == 3 or ((x - 112 + (3 if ((y - 24) // 4) % 2 else 0)) % 6 == 0): t = 1
            if x == 112: t = 3
            if x >= 122: t = 0
            ch.px(x, y, R['stone'][t])
    ch.rect(110, 20, 125, 24, lambda x, y: R['dwood'][3 if y == 20 else 2 if x < 122 else 1])
    ch.outline(); cv.paste(ch)
    gable_roof(cv, ax, ay, xl, xr, yb, 19, R['coral'])
    for x in range(x0, x1 + 1):
        for y in range(ay, yb + 2):
            if cv.get(x, y) in R['coral'] and cv.get(x, y + 1) not in R['coral']:
                darken(cv, x, y + 1, 2); darken(cv, x, y + 2, 1); darken(cv, x, y + 3, 1)
                break
    # finial
    cv.rect(ax - 1, ay - 4, ax, ay, R['gold'][3]); cv.px(ax, ay - 1, R['gold'][1])
    # round window in the gable
    rc = (cx, 56)
    for (x, y) in cv.ellpts(rc[0], rc[1], 10, 10):
        cv.px(x, y, R['white'][2])
    for (x, y) in cv.ellpts(rc[0], rc[1], 10, 10):
        if not all(((xx + .5 - rc[0]) ** 2 + (yy + .5 - rc[1]) ** 2) <= 100 for xx, yy in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))):
            cv.px(x, y, olc(R['white'][1]))
    for (x, y) in cv.ellpts(rc[0], rc[1], 7, 7):
        d = (x - rc[0] + 7) + (y - rc[1] + 7)
        t = 2
        if y < rc[1] - 4: t = 0
        elif d % 9 in (3, 4) and x < rc[0] + 2: t = 4
        elif x > rc[0] + 3 or y > rc[1] + 4: t = 1
        cv.px(x, y, R['glass'][t])
    for k in range(-7, 7):
        cv.px(rc[0] + k, rc[1], R['white'][3]); cv.px(rc[0], rc[1] + k, R['white'][2])
    for (x, y) in cv.ellpts(rc[0], rc[1], 8, 8):
        if (x + .5 - rc[0]) ** 2 + (y + .5 - rc[1]) ** 2 > 49 and y < rc[1]:
            cv.px(x, y, R['white'][4])
    door(cv, cx + 18, G - 6, 26, 50, Rw=R['teal'], Rfr=R['dwood'])
    cv.rect(cx + 2, G - 5, cx + 33, G, lambda x, y: R['stone'][3 if y == G - 5 else 2 if x < cx + 30 else 1])
    for x in range(cx + 1, cx + 35): cv.px(x, G - 6, olc(R['stone'][1]))
    window(cv, 46, 100, 30, 22, box=['gold', 'lilac', 'pink'], rng=rng)
    # small lamp by the door
    lx = cx - 2
    cv.rect(lx - 2, 102, lx + 2, 108, lambda x, y: R['lamp'][4 if x < lx else 3])
    cv.orect(lx - 3, 101, lx + 3, 109, olc(R['iron'][1]))
    cv.rect(lx - 3, 99, lx + 3, 100, R['iron'][2]); cv.px(lx, 98, R['iron'][1])
    cv.outline()
    cv.fx += [('smoke', 117, 19), ('glow', lx, 105)]; cv.door = cx + 18
    return cv, cx


def awning(cv, x0, x1, y0, h, Ra, Rb, sw=6, slope=4):
    """striped awning sloping toward the viewer with a scalloped hem"""
    for y in range(y0, y0 + h):
        f = (y - y0) / max(1, h - 1)
        a = x0 + slope * (1 - f); b = x1 - slope * (1 - f)
        for x in range(int(a), int(b) + 1):
            u = (x - a) / max(1, (b - a)) * (x1 - x0)
            stripe = int(u // sw) % 2
            Rx = Ra if stripe == 0 else Rb
            t = 2
            if y == y0: t = 4
            elif y == y0 + 1: t = 3
            elif y > y0 + h - 3: t = 1
            cv.px(x, y, Rx[t])
    # scallops
    yb = y0 + h
    for x in range(x0, x1 + 1):
        u = x - x0
        stripe = int(u // sw) % 2
        Rx = Ra if stripe == 0 else Rb
        k = u % sw
        dep = 3 if 1 <= k <= sw - 2 else 2 if k in (0, sw - 1) else 1
        if sw >= 6 and k in (0, sw - 1): dep = 1
        for d in range(dep):
            cv.px(x, yb + d, Rx[1 if d < dep - 1 else 0])
    # shadow cast on the wall below
    for x in range(x0 + 1, x1):
        for d in range(3, 6):
            c = cv.get(x, yb + d)
            if c is not None:
                for RR in R.values():
                    if c in RR and RR.index(c) > 0:
                        cv.px(x, yb + d, RR[max(0, RR.index(c) - 1)]); break


def shop_window(cv, x0, y0, w, h, rng):
    window(cv, x0, y0, w, h, Rf=R['mint'], cross=False, sill=True)
    # shelves with goods seen through the glass
    gx0, gx1 = x0 + 2, x0 + w - 3
    for sy in (y0 + h // 2 - 1, y0 + h - 4):
        for x in range(gx0, gx1 + 1):
            cv.px(x, sy, R['wood'][1]); cv.px(x, sy + 1, R['wood'][0])
        x = gx0 + 1
        while x < gx1 - 3:
            col = rng.choice(['coral', 'gold', 'mint', 'lilac', 'pink', 'sky'])
            ww = rng.choice([2, 3, 3]); hh = rng.randint(3, 6)
            for yy in range(sy - hh, sy):
                for xx in range(x, x + ww):
                    cv.px(xx, yy, R[col][3 if xx == x else 2 if yy > sy - hh else 4])
            x += ww + 1
    # big glint
    for k in range(10):
        cv.px(gx0 + 4 + k, y0 + 4 + k, R['glass'][4]); cv.px(gx0 + 5 + k, y0 + 4 + k, R['glass'][4])


def potion_icon(cv, cx, cy):
    Rg = R['teal']
    cv.rect(cx - 1, cy - 5, cx, cy - 3, R['white'][2])
    cv.rect(cx - 2, cy - 6, cx + 1, cy - 6, R['wood'][2])
    for (x, y) in cv.ellpts(cx, cy + 1, 4.6, 4.2):
        t = 2 if y > cy - 1 else 4
        if x >= cx + 2: t = 1
        cv.px(x, y, Rg[t] if y >= cy - 1 else R['white'][3])
    cv.px(cx - 2, cy, R['white'][4]); cv.px(cx - 2, cy + 1, R['white'][4])


@prop('shop', 'General store', 1.8, 0, ['town'])
def p_shop(rng):
    W, H = 200, 170; G = H - 2; cx = 92
    cv = Cv(W, H)
    x0, x1 = 30, 154
    Rw = R['peach']
    wall(cv, x0, 50, x1, G - 6, Rw, siding=6, eave=4)
    stone_band(cv, x0 - 2, x1 + 2, G - 5, G, R['stone'])
    # corner pilasters
    for px0 in (x0, x1 - 4):
        for y in range(50, G - 5):
            for x in range(px0, px0 + 5):
                cv.px(x, y, R['white'][[4, 3, 2, 2, 1][x - px0]])
    # roof (blue tiles) and cornice band
    tile_roof(cv, 18, 46, 46, 138, 22, 162, R['sky'], tw=9)
    for y in range(46, 52):
        for x in range(24, 161):
            t = (4, 3, 2, 2, 1, 0)[y - 46]
            if x < 27: t = min(4, t + 1)
            if x > 157: t = max(0, t - 1)
            cv.px(x, y, R['mint'][t])
    for x in range(26, 160, 6):
        cv.px(x, 51, R['mint'][0]); cv.px(x + 1, 51, R['mint'][0]); cv.px(x, 52, R['mint'][0])
    # display window and door
    shop_window(cv, 40, 70, 54, 38, rng)
    dc = 122
    door(cv, dc, G - 6, 28, 50, Rw=R['mint'], Rfr=R['white'], arch=False)
    shade_below(cv, x0, x1, 52, 3)
    awning(cv, dc - 24, dc + 23, 92, 14, R['coral'], R['white'], sw=6, slope=5)
    cv.rect(dc - 18, G - 5, dc + 17, G, lambda x, y: R['stone'][3 if y == G - 5 else 2 if x < dc + 14 else 1])
    for x in range(dc - 19, dc + 19): cv.px(x, G - 6, olc(R['stone'][1]))
    # hanging sign on an iron bracket off the right corner
    sg = Cv(W, H)
    by = 62
    for x in range(x1 - 2, x1 + 24):
        sg.px(x, by, R['iron'][3]); sg.px(x, by + 1, R['iron'][1])
    sg.line(x1 + 2, by + 1, x1 + 2 + 7, by - 6, R['iron'][2])
    for x in (x1 + 7, x1 + 19):
        sg.px(x, by + 2, R['iron'][2]); sg.px(x, by + 3, R['iron'][1])
    bx0, bx1, byy0, byy1 = x1 + 1, x1 + 25, by + 4, by + 25
    for y in range(byy0, byy1 + 1):
        for x in range(bx0, bx1 + 1):
            t = 2
            if y == byy0: t = 4
            elif y == byy0 + 1 or x == bx0: t = 3
            elif y >= byy1 - 1 or x >= bx1 - 1: t = 1
            if (y - byy0) % 6 == 5 and byy0 < y < byy1 - 1: t = 1
            sg.px(x, y, R['wood'][t])
    sg.rect(bx0 + 4, byy0 + 3, bx1 - 4, byy1 - 3, R['cream'][2])
    sg.orect(bx0 + 3, byy0 + 2, bx1 - 3, byy1 - 2, R['wood'][0])
    potion_icon(sg, (bx0 + bx1) // 2 + 1, (byy0 + byy1) // 2 + 1)
    sg.outline()
    cv.paste(sg)
    # potted plant by the door
    pp = Cv(W, H)
    pcx = 98
    pp.rect(pcx - 5, G - 10, pcx + 4, G - 6, lambda x, y: R['brick'][3 if x < pcx - 2 else 2 if x < pcx + 2 else 1])
    pp.rect(pcx - 6, G - 11, pcx + 5, G - 11, R['brick'][4])
    blob(pp, pcx, G - 18, 7, 8, R['leaf'], rng, cell=5, sep=False)
    pp.outline(); cv.paste(pp)
    cv.outline()
    cv.door = dc
    return cv, cx


@prop('clinic', 'Clinic', 1.8, 0, ['town'])
def p_clinic(rng):
    W, H = 200, 170; G = H - 2; cx = 100
    cv = Cv(W, H)
    x0, x1 = 34, 166
    Rw = R['white']
    wall(cv, x0, 50, x1, G - 6, Rw, siding=0, eave=3)
    # mint stripe band and corner pillars
    for y in range(96, 102):
        for x in range(x0, x1 + 1):
            cv.px(x, y, R['mint'][(4, 3, 2, 2, 1, 0)[y - 96]] if x < x1 - 1 else R['mint'][0])
    for px0 in (x0, x1 - 5):
        for y in range(50, G - 5):
            for x in range(px0, px0 + 6):
                cv.px(x, y, R['mint'][[4, 3, 2, 2, 1, 0][x - px0]])
    stone_band(cv, x0 - 2, x1 + 2, G - 5, G, R['lav'])
    shade_below(cv, x0, x1, 51, 3)
    # flat roof: visible top surface + mint cornice
    for y in range(36, 44):
        f = (y - 36) / 8
        a = 30 + 6 * (1 - f); b = 170 - 6 * (1 - f)
        for x in range(int(a), int(b) + 1):
            t = 3 if (x // 10 + y // 4) % 2 else 2
            if y == 36: t = 4
            cv.px(x, y, R['lav'][t])
    for y in range(44, 51):
        for x in range(28, 173):
            t = (4, 3, 3, 2, 2, 1, 0)[y - 44]
            if x > 169: t = max(0, t - 1)
            cv.px(x, y, R['mint'][t])
    # raised pediment with the cross sign
    pc = Cv(W, H)
    for y in range(20, 51):
        for x in range(cx - 30, cx + 30):
            t = 2
            if x < cx - 28: t = 3
            elif x > cx + 26: t = 1
            if y < 24: t = 4 if y < 22 else 3
            pc.px(x, y, R['mint'][t] if y < 24 or x < cx - 26 or x > cx + 25 else R['white'][t])
    pc.outline()
    cv.paste(pc)
    # round sign
    sx, sy = cx, 38
    for (x, y) in cv.ellpts(sx, sy, 14, 14):
        cv.px(x, y, olc(R['red'][1]))
    for (x, y) in cv.ellpts(sx, sy, 13, 13):
        nx = (x + .5 - sx) / 13; ny = (y + .5 - sy) / 13
        cv.px(x, y, R['white'][min(4, sph(nx, ny) + 1)])
    for (x, y) in cv.ellpts(sx, sy, 13, 13):
        if (x + .5 - sx) ** 2 + (y + .5 - sy) ** 2 > 11 ** 2:
            cv.px(x, y, R['red'][3] if y < sy else R['red'][1])
    for y in range(sy - 8, sy + 8):
        for x in range(sx - 8, sx + 8):
            if (abs(x + .5 - sx) < 3 and abs(y + .5 - sy) < 8) or (abs(y + .5 - sy) < 3 and abs(x + .5 - sx) < 8):
                t = 2
                if x < sx - 1 and y < sy - 1: t = 3
                if x >= sx + 2 or y >= sy + 2: t = 1
                cv.px(x, y, R['red'][t])
    # glass double door
    dx0, dx1, dy0 = cx - 16, cx + 15, G - 52
    cv.rect(dx0 - 3, dy0 - 3, dx1 + 3, G - 6, R['mint'][2])
    for y in range(dy0 - 3, G - 5):
        cv.px(dx0 - 3, y, R['mint'][4]); cv.px(dx1 + 3, y, R['mint'][0])
    for x in range(dx0 - 3, dx1 + 4): cv.px(x, dy0 - 3, R['mint'][4])
    cv.orect(dx0 - 4, dy0 - 4, dx1 + 4, G - 5, olc(R['mint'][1]))
    for half in ((dx0, cx - 1), (cx, dx1)):
        window(cv, half[0], dy0, half[1] - half[0] + 1, G - 6 - dy0, Rf=R['white'], cross=False, sill=False, rec=None)
        for y in range(dy0 + 18, dy0 + 22):
            cv.px(half[1] - 3 if half[0] == dx0 else half[0] + 3, y, R['lav'][1])
    # canopy over the door
    awning(cv, cx - 24, cx + 23, 102, 7, R['mint'], R['white'], sw=8, slope=3)
    # windows
    for wx in (48, 136):
        window(cv, wx, 62, 18, 26, Rf=R['mint'])
        window(cv, wx, 108, 18, 26, Rf=R['mint'])
    cv.rect(cx - 22, G - 5, cx + 21, G, lambda x, y: R['white'][3 if y == G - 5 else 2 if x < cx + 18 else 1])
    for x in range(cx - 23, cx + 23): cv.px(x, G - 6, olc(R['white'][1]))
    cv.outline()
    cv.door = cx
    return cv, cx


@prop('lab', 'Research lab', 2.2, 0, ['town'])
def p_lab(rng):
    W, H = 240, 170; G = H - 2; cx = 120
    cv = Cv(W, H)
    x0, x1 = 20, 220
    Rw = R['white']
    # rooftop box + dish behind the parapet
    rb = Cv(W, H)
    for y in range(28, 48):
        for x in range(36, 76):
            t = xt(x, 36, 76)
            if y < 31: t = 4 if y == 28 else 3
            rb.px(x, y, R['marble'][t])
    for x in range(40, 72, 4):
        for y in range(34, 44): rb.px(x, y, R['marble'][0])
    rb.outline(); cv.paste(rb)
    # antenna
    an = Cv(W, H)
    for y in range(18, 46): an.px(96, y, R['marble'][3]); an.px(97, y, R['marble'][1])
    an.rect(95, 15, 98, 17, R['red'][3]); an.px(95, 15, R['red'][4])
    for k in (26, 34): an.px(94, k, R['marble'][2]); an.px(95, k, R['marble'][2]); an.px(98, k, R['marble'][1]); an.px(99, k, R['marble'][1])
    an.outline(); cv.paste(an)
    # satellite dish (tilted up-left)
    ds = Cv(W, H)
    dcx, dcy = 180, 30
    for y in range(36, 48):
        for x in range(176, 182): ds.px(x, y, R['iron'][xt(x, 176, 182)])
    ds.rect(170, 44, 188, 47, lambda x, y: R['iron'][3 if y == 44 else 2 if x < 185 else 1])
    for (x, y) in ds.ellpts(dcx, dcy, 17, 11):
        nx = (x + .5 - dcx) / 17; ny = (y + .5 - dcy) / 11
        # bowl: lit rim at bottom-right inside, shadowed inner top-left (concave)
        t = 2
        r = nx * nx + ny * ny
        if r > .72: t = 4 if (nx + ny) < 0 else 2
        elif nx + ny < -.35: t = 1
        elif nx + ny > .5: t = 3
        ds.px(x, y, R['white'][t])
    ds.line(dcx, dcy, dcx - 12, dcy - 10, R['iron'][2])
    ds.line(dcx + 9, dcy + 7, dcx - 12, dcy - 10, R['iron'][1])
    ds.rect(dcx - 14, dcy - 12, dcx - 11, dcy - 9, R['gold'][3])
    ds.rect(dcx - 1, dcy - 1, dcx + 1, dcy + 1, R['iron'][1])
    ds.outline(); cv.paste(ds)
    # roof slab
    for y in range(44, 52):
        f = (y - 44) / 8
        a = x0 - 2 + 6 * (1 - f); b = x1 + 2 - 6 * (1 - f)
        for x in range(int(a), int(b) + 1):
            t = 3 if (x // 12 + y // 3) % 2 else 2
            if y == 44: t = 4
            cv.px(x, y, R['lav'][t])
    for y in range(52, 58):
        for x in range(x0 - 4, x1 + 5):
            t = (4, 3, 2, 2, 1, 0)[y - 52]
            if x > x1 + 1: t = max(0, t - 1)
            cv.px(x, y, R['teal'][t])
    wall(cv, x0, 58, x1, G - 6, Rw, siding=0, eave=4)
    # panel seams
    for x in range(x0 + 34, x1, 34):
        for y in range(61, G - 6):
            cv.px(x, y, Rw[1]); cv.px(x + 1, y, Rw[3])
    for x in range(x0, x1 + 1):
        for k, t in enumerate((4, 3, 2, 1)):
            cv.px(x, 122 + k, R['teal'][t] if x < x1 - 1 else R['teal'][0])
    stone_band(cv, x0 - 2, x1 + 2, G - 5, G, R['lav'], bw=12)
    # big panoramic window
    wx0, wy0, ww, wh = 32, 68, 112, 46
    window(cv, wx0, wy0, ww, wh, Rf=R['marble'], cross=False, sill=True)
    for k in range(1, 4):
        x = wx0 + k * ww // 4
        for y in range(wy0 + 2, wy0 + wh - 2):
            cv.px(x, y, R['marble'][2]); cv.px(x + 1, y, R['marble'][1])
    for x in range(wx0 + 2, wx0 + ww - 2):
        cv.px(x, wy0 + 15, R['marble'][3]); cv.px(x, wy0 + 16, R['marble'][1])
    # interior silhouettes: desk, monitor, plant
    Rin = R['glass']
    for x in range(wx0 + 10, wx0 + 50):
        for y in range(wy0 + 32, wy0 + 35): cv.px(x, y, Rin[0])
    cv.rect(wx0 + 18, wy0 + 24, wx0 + 30, wy0 + 31, Rin[0]); cv.rect(wx0 + 20, wy0 + 26, wx0 + 28, wy0 + 29, R['mint'][3])
    cv.rect(wx0 + 70, wy0 + 26, wx0 + 76, wy0 + 43, Rin[0])
    cv.ell(wx0 + 73, wy0 + 24, 6, 6, R['leaf'][1])
    cv.rect(wx0 + 86, wy0 + 30, wx0 + 104, wy0 + 43, Rin[0])
    for k in range(0, 18, 4): cv.rect(wx0 + 88 + k, wy0 + 32, wx0 + 89 + k, wy0 + 33, R['gold'][3] if k % 8 else R['coral'][3])
    for k in range(14):
        cv.px(wx0 + 36 + k, wy0 + 2 + k, R['glass'][4]); cv.px(wx0 + 38 + k, wy0 + 2 + k, R['glass'][4])
        cv.px(wx0 + 62 + k // 2, wy0 + 20 + k, R['glass'][3])
    # sliding door
    dc = 182
    cv.rect(dc - 19, G - 58, dc + 18, G - 6, R['teal'][2])
    cv.orect(dc - 20, G - 59, dc + 19, G - 5, olc(R['teal'][1]))
    for y in range(G - 58, G - 5): cv.px(dc - 19, y, R['teal'][4]); cv.px(dc + 18, y, R['teal'][0])
    for x in range(dc - 19, dc + 19): cv.px(x, G - 58, R['teal'][4])
    window(cv, dc - 16, G - 54, 16, 48, Rf=R['marble'], cross=False, sill=False, rec=None)
    window(cv, dc, G - 54, 16, 48, Rf=R['marble'], cross=False, sill=False, rec=None)
    # little light over the door
    cv.rect(dc - 4, G - 64, dc + 3, G - 62, R['lamp'][3]); cv.orect(dc - 5, G - 65, dc + 4, G - 61, olc(R['iron'][1]))
    cv.rect(dc - 22, G - 5, dc + 21, G, lambda x, y: R['white'][3 if y == G - 5 else 2 if x < dc + 18 else 1])
    for x in range(dc - 23, dc + 23): cv.px(x, G - 6, olc(R['white'][1]))
    cv.outline()
    cv.fx.append(('glow', dc - 1, G - 63)); cv.door = dc
    return cv, cx


def rock_mass(cv, pts, Rs, rng, cx, cy, rx, ry, cell=13, bias=0.0, cracks=True):
    """chunky stone made of facetted blocks"""
    cs = []
    for _ in range(int((2 * rx * 2 * ry) / (cell * cell)) + 4):
        cs.append((rng.uniform(cx - rx, cx + rx), rng.uniform(cy - ry, cy + ry), rng.choice([-1, 0, 0, 1])))
    for (x, y) in pts:
        nx = (x + .5 - cx) / rx; ny = (y + .5 - cy) / ry
        rr = nx * nx + ny * ny
        if rr > 1: nx /= math.sqrt(rr); ny /= math.sqrt(rr)
        t = sph(nx * .97, ny * .97, bias)
        ds = sorted(((x + .5 - a) ** 2 + (y + .5 - b) ** 2, a, b, o) for a, b, o in cs)
        d0, a, b, o = ds[0]; d1 = ds[1][0]
        if cracks and math.sqrt(d1) - math.sqrt(d0) < 1.1:
            t -= 1 if (y + .5) > b else 0
            t = max(0, t - 1)
        else:
            # facet tilt: upper-left part of each block brighter
            lx = (x + .5 - a); ly = (y + .5 - b)
            if lx + ly < -cell * .45: t += 1
            t += o if 0 < t < 4 else 0
        cv.px(x, y, Rs[max(0, min(4, t))])


@prop('cave_house', 'Cave dwelling', 1.6, 0, ['cave', 'town'])
def p_cave_house(rng):
    W, H = 170, 140; G = H - 2; cx = 80
    cv = Cv(W, H)
    # stovepipe first so the rock overlaps its foot
    sp = Cv(W, H)
    for y in range(G - 108, G - 70):
        for x in range(cx + 30, cx + 37): sp.px(x, y, R['iron'][xt(x, cx + 30, cx + 37)])
    sp.rect(cx + 28, G - 112, cx + 38, G - 108, lambda x, y: R['iron'][3 if y == G - 112 else 2 if x < cx + 36 else 1])
    sp.outline(); cv.paste(sp)
    rcx, rcy, rx, ry = cx, G - 16, 68, 80
    pts = []
    for y in range(G - 100, G + 1):
        for x in range(cx - 74, cx + 75):
            dx = (x + .5 - rcx) / rx; dy = (y + .5 - rcy) / ry
            th = math.atan2(dy, dx)
            lim = 1 + .035 * math.sin(th * 9 + 1) + .025 * math.sin(th * 17)
            if dx * dx + dy * dy <= lim * lim:
                pts.append((x, y))
    rk = Cv(W, H)
    rock_mass(rk, pts, R['cave'], rng, rcx, rcy - 20, rx, 70, cell=17, bias=.05)
    tops = {}
    for (x, y) in pts:
        tops[x] = min(tops.get(x, 999), y)
    # moss / grass cap with drips
    for (x, y) in pts:
        top = tops[x]
        depth = 9 + 4 * math.sin(x * .31) + 3 * math.sin(x * .13 + 1) + (5 if (x * 7) % 23 < 3 else 0)
        if y - top < depth and abs(x - rcx) < 60:
            nx = (x + .5 - rcx) / rx
            t = 3 if nx < -.25 else 2 if nx < .35 else 1
            if y - top < 2: t += 1
            if y - top >= depth - 1.5: t = 0
            rk.px(x, y, R['moss'][max(0, min(4, t))])
    # grass tufts on the crown
    for gx in range(cx - 50, cx + 52, 9):
        top = tops.get(gx, None)
        if top is None: continue
        for k, hgt in enumerate((3, 5, 4)):
            for yy in range(top - hgt, top + 1):
                rk.px(gx + k - 1, yy, R['moss'][3 if k == 0 else 2])
    rk.outline(); cv.paste(rk)
    # stone arch and door
    dcx = cx + 6
    for (x, y) in cv.ellpts(dcx, G - 30, 21, 21):
        if y <= G - 1:
            a = math.atan2(y + .5 - (G - 30), x + .5 - dcx)
            seg = int((a + math.pi) / (math.pi / 6))
            t = 3 if seg % 2 else 2
            if x > dcx + 12: t -= 1
            if (x + .5 - dcx) ** 2 + (y + .5 - G + 30) ** 2 > 20 ** 2: t = 0
            cv.px(x, y, R['stone'][t])
    for y in range(G - 30, G + 1):
        for x in range(dcx - 21, dcx + 21):
            if abs(x + .5 - dcx) > 15 and abs(x + .5 - dcx) < 21:
                t = 3 if ((y // 5) % 2) else 2
                if x > dcx + 15: t -= 1
                cv.px(x, y, R['stone'][t] if y % 5 != 4 else R['stone'][0])
    door(cv, dcx, G, 28, 44, Rw=R['wood'], Rfr=R['dwood'])
    # round lit window
    wcx, wcy = cx - 36, G - 44
    for (x, y) in cv.ellpts(wcx, wcy, 11, 11): cv.px(x, y, R['wood'][2] if x + y < wcx + wcy else R['wood'][1])
    for (x, y) in cv.ellpts(wcx, wcy, 11, 11):
        if any(((x + a + .5 - wcx) ** 2 + (y + b + .5 - wcy) ** 2) > 121 for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            cv.px(x, y, olc(R['wood'][1]))
    for (x, y) in cv.ellpts(wcx, wcy, 8, 8):
        cv.px(x, y, R['lamp'][4 if x + y < wcx + wcy - 3 else 3 if x + y < wcx + wcy + 5 else 2])
    for (x, y) in cv.ellpts(wcx, wcy, 9, 9):
        if (x + .5 - wcx) ** 2 + (y + .5 - wcy) ** 2 > 64: cv.px(x, y, olc(R['wood'][1]))
    for k in range(-8, 8): cv.px(wcx, wcy + k, R['wood'][1]); cv.px(wcx + k, wcy, R['wood'][1])
    # hanging lantern on an iron bracket
    lt = Cv(W, H)
    lx, ly = dcx + 34, G - 44
    for x in range(dcx + 20, lx + 3): lt.px(x, ly - 14, R['iron'][3]); lt.px(x, ly - 13, R['iron'][1])
    lt.line(dcx + 22, ly - 6, dcx + 30, ly - 13, R['iron'][2])
    for y in range(ly - 12, ly - 8): lt.px(lx, y, R['iron'][2])
    lt.poly([(lx - 5, ly - 4), (lx + .5, ly - 9), (lx + 6, ly - 4)], R['iron'][2])
    lt.rect(lx - 4, ly - 4, lx + 4, ly + 6, lambda x, y: R['lamp'][4 if x < lx - 1 else 3 if x < lx + 2 else 2])
    lt.rect(lx - 5, ly - 4, lx + 5, ly - 4, R['iron'][3]); lt.rect(lx - 5, ly + 6, lx + 5, ly + 7, R['iron'][1])
    for y in range(ly - 3, ly + 6): lt.px(lx - 5, y, R['iron'][2]); lt.px(lx + 5, y, R['iron'][1]); lt.px(lx, y, R['iron'][2])
    lt.outline(); cv.paste(lt)
    # door step stones
    cv.ell(dcx - 1, G - 1, 18, 2.6, R['stone'][3])
    for x in range(dcx - 18, dcx + 17): 
        if cv.get(x, G) == R['stone'][3]: cv.px(x, G, R['stone'][1])
    cv.outline()
    cv.fx += [('smoke', cx + 33, G - 113), ('window', wcx, wcy), ('glow', lx, ly + 1)]; cv.door = dcx
    return cv, cx


# ----------------------------------------------------------------------------- trees
@prop('tree_pine', 'Pine tree', 0.9, 0.35, ['route', 'town'])
def p_tree_pine(rng):
    return pine_tree(rng, 110, 200, [(10, 34, 11), (22, 60, 18), (38, 88, 25), (56, 118, 32), (76, 148, 38), (98, 176, 44)])


def pine_tree(rng, W, H, tiers, th=40, tw=(6, 4), Rp=None):
    G = H - 2; cx = W // 2
    cv = Cv(W, H)
    tr = Cv(W, H)
    trunk(tr, [(cx - tw[0], G + 1), (cx - tw[1], G - th), (cx + tw[1], G - th), (cx + tw[0], G + 1)], R['bark'], rng)
    tr.outline(); cv.paste(tr)
    fol = Cv(W, H)
    Rp = Rp or R['pine']

    def hem(X, i, bot, hw, ph=0.0):
        return bot + 2.6 * abs(math.sin((X + i * 3 + ph) * math.pi / 7.5)) - 2.2 + abs(X) / hw * 3
    for i in range(len(tiers) - 1, -1, -1):
        top, bot, hw = tiers[i]
        hw += rng.uniform(-1, 1)
        pts = []
        for y in range(top, bot + 5):
            f = (y + .5 - top) / (bot - top)
            w = hw * (f ** .8) + (1.3 * abs(math.sin(y * .9 + i)) if f > .15 else 0)
            for x in range(int(cx - hw) - 2, int(cx + hw) + 3):
                X = x + .5 - cx
                if abs(X) > w + .2: continue
                hh = hem(X, i, bot, hw)
                if y + .5 > hh: continue
                pts.append((x, y, X / max(1, w), f, hh - (y + .5)))
        tp = []
        for (x, y, nx, f, dh) in pts:
            t = 3 if nx < -.5 else 2 if nx < .15 else 1 if nx < .68 else 0
            if f < .2 and nx < .3: t = min(4, t + 1)
            if dh < 2.4 and nx < .6: t = min(4, t + 1)        # lit needle tips along the hem
            if i > 0:
                ptop, pbot, phw = tiers[i - 1]
                X = x + .5 - cx
                d = y + .5 - hem(X, i - 1, pbot, phw)
                if 0 <= d < 4 and abs(X) <= phw + 1:
                    t = 0 if d < 2.5 else min(t, 1)
            tp.append((x, y, t))
        leafy(fol, tp, Rp, rng, cell=5)
    fol.outline()
    cv.paste(fol)
    return cv, cx


@prop('tree_oak', 'Oak tree', 1.3, 0.35, ['route', 'town'])
def p_tree_oak(rng):
    W, H = 160, 164; G = H - 2; cx = 80
    cv = Cv(W, H)
    tr = Cv(W, H)
    trunk(tr, [(cx - 14, G + 1), (cx - 9, G - 6), (cx - 8, G - 50), (cx - 18, G - 76), (cx - 13, G - 78), (cx - 2, G - 58),
               (cx + 4, G - 80), (cx + 10, G - 78), (cx + 8, G - 50), (cx + 9, G - 6), (cx + 15, G + 1)], R['bark'], rng)
    # roots
    for (a, b) in ((cx - 16, G), (cx + 15, G)):
        tr.px(a, b, R['bark'][2 if a < cx else 1])
    tr.outline(); cv.paste(tr)
    fol = Cv(W, H)
    Rl = R['oak']
    blobs = [(cx - 2, 52, 52, 36, 0), (cx - 44, 72, 28, 24, 0), (cx + 42, 72, 30, 24, -.05), (cx - 30, 38, 30, 26, .05),
             (cx + 26, 36, 32, 26, 0), (cx, 26, 26, 20, .05), (cx - 22, 84, 30, 20, -.05), (cx + 22, 86, 30, 20, -.08),
             (cx - 50, 56, 18, 18, .05), (cx + 52, 56, 18, 18, -.05), (cx - 4, 48, 26, 20, .05)]
    order = [0, 5, 3, 4, 10, 8, 9, 1, 2, 6, 7]
    for i in order:
        bx, by, rx, ry, b = blobs[i]
        blob(fol, bx, by, rx, ry, Rl, rng, cell=8, bias=b, bump=.05)
    fol.outline()
    cv.paste(fol)
    # trunk visible through a gap under the canopy: redraw lowest trunk part on top
    return cv, cx


@prop('tree_fruit', 'Fruit tree', 0.8, 0.35, ['farm', 'route', 'town'])
def p_tree_fruit(rng):
    cx = 60
    return fruit_tree(rng, 120, 124, [(cx - 7, 1), (cx - 5, -8), (cx - 4, -34), (cx - 16, -62), (cx - 10, -64), (cx, -44),
                                      (cx + 8, -66), (cx + 13, -63), (cx + 4, -34), (cx + 5, -8), (cx + 8, 1)],
                      [(cx, 36, 34, 26, 0), (cx - 26, 48, 22, 18, 0), (cx + 26, 48, 22, 18, -.05),
                       (cx - 12, 22, 22, 16, .05), (cx + 14, 24, 20, 16, 0), (cx, 58, 26, 14, -.06)],
                      [(cx - 24, 40), (cx - 8, 30), (cx + 14, 36), (cx + 30, 50), (cx - 30, 56), (cx + 4, 52), (cx - 14, 60),
                       (cx + 20, 22), (cx - 4, 16), (cx + 36, 38), (cx - 36, 44), (cx + 16, 60)], R['orange'])


def fruit_tree(rng, W, H, tpts, blobs, fr, Ro, Rl=None, fr_r=3.2):
    """trunk points are (x, dy from ground); blobs/fruit in canvas pixels"""
    G = H - 2; cx = W // 2
    cv = Cv(W, H)
    tr = Cv(W, H)
    trunk(tr, [(x, G + dy) for (x, dy) in tpts], R['bark'], rng)
    tr.outline(); cv.paste(tr)
    fol = Cv(W, H)
    Rl = Rl or R['leaf']
    for (bx, by, rx, ry, b) in blobs:
        blob(fol, bx, by, rx, ry, Rl, rng, cell=7, bias=b)
    fol.outline(); cv.paste(fol)
    ro = fr_r + 1
    for (fx, fy) in fr:
        fx += rng.randint(-2, 2); fy += rng.randint(-2, 2)
        for (x, y) in cv.ellpts(fx + .5, fy + .5, fr_r, fr_r):
            nx = (x + .5 - fx - .5) / fr_r; ny = (y + .5 - fy - .5) / fr_r
            cv.px(x, y, Ro[min(4, sph(nx, ny, .1) + 1)])
        for (x, y) in cv.ellpts(fx + .5, fy + .5, ro, ro):
            if not ((x + .5 - fx - .5) ** 2 + (y + .5 - fy - .5) ** 2 <= fr_r ** 2):
                cv.px(x, y, olc(Ro[1]))
        cv.px(fx, fy - int(ro - .2), R['leaf'][3])
    return cv, cx


@prop('tree_birch', 'Birch tree', 0.6, 0.45, ['route'])
def p_tree_birch(rng):
    W, H = 90, 154; G = H - 2; cx = 45
    cv = Cv(W, H)
    tr = Cv(W, H)
    Rb = R['birch']
    pts = [(cx - 4, G + 1), (cx - 3, G - 50), (cx - 5, G - 110), (cx - 1, G - 112), (cx + 1, G - 70), (cx + 3, G - 50), (cx + 5, G + 1)]
    trunk(tr, pts, Rb, rng, streaks=False)
    tr.line(cx, G - 72, cx + 16, G - 100, Rb[2], w=2)
    tr.line(cx - 2, G - 92, cx - 14, G - 112, Rb[2], w=2)
    for y in range(G - 112, G):
        if rng.random() < .22:
            x0 = rng.randint(cx - 5, cx + 1)
            for x in range(x0, x0 + rng.randint(2, 4)):
                if tr.has(x, y): tr.px(x, y, OL if rng.random() < .5 else mix(OL, Rb[1], .3))
    tr.outline(); cv.paste(tr)
    fol = Cv(W, H)
    Rl = R['leafy']
    for (bx, by, rx, ry, b) in [(cx - 4, 30, 18, 22, .05), (cx + 10, 52, 18, 16, 0), (cx - 14, 64, 16, 14, 0), (cx + 4, 80, 18, 14, -.05),
                                (cx + 18, 92, 10, 10, -.05), (cx - 10, 96, 12, 10, -.05), (cx + 2, 14, 12, 12, .1)]:
        blob(fol, bx, by, rx, ry, Rl, rng, cell=6, bias=b, bump=.09)
    fol.outline(); cv.paste(fol)
    return cv, cx


# ----------------------------------------------------------------------------- shared small-prop helpers
def leafy(cv, pts, Rm, rng, cell=6, cap=4):
    """apply scalloped leaf-clump texture to [(x, y, tone)]"""
    if not pts:
        return
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    cs = {}
    rowh = cell * .78
    for r in range(int((max(ys) - min(ys)) / rowh) + 4):
        for c in range(int((max(xs) - min(xs)) / cell) + 4):
            cs[(r, c)] = (min(xs) - cell + c * cell + (cell / 2 if r % 2 else 0) + rng.uniform(-1.3, 1.3),
                          min(ys) - cell + r * rowh + rng.uniform(-1, 1))
    for (x, y, t) in pts:
        r0 = int(round((y + .5 - min(ys) + cell) / rowh))
        best = None; bd = 1e9
        for r in (r0 - 1, r0, r0 + 1):
            c0 = int(round((x + .5 - min(xs) + cell - (cell / 2 if r % 2 else 0)) / cell))
            for c in (c0 - 1, c0, c0 + 1):
                q = cs.get((r, c))
                if q:
                    d = (x + .5 - q[0]) ** 2 + (y + .5 - q[1]) ** 2
                    if d < bd: bd = d; best = q
        ddx = (x + .5 - best[0]) / cell; ddy = (y + .5 - best[1]) / cell
        dd = ddx * ddx + ddy * ddy
        if ddy > .16 and dd > .15: t -= 1
        elif ddy < -.12 and ddx < .15 and dd > .10 and t >= 2: t += 1
        cv.px(x, y, Rm[max(0, min(cap, t))])


def ball(cv, cx, cy, rx, ry, Rm, bias=0.0, lo=0, hi=4):
    for (x, y) in cv.ellpts(cx, cy, rx, ry):
        nx = (x + .5 - cx) / rx; ny = (y + .5 - cy) / ry
        cv.px(x, y, Rm[max(lo, min(hi, sph(nx * .97, ny * .97, bias)))])


def edge_light(cv, pts, Rm, base=2):
    """tone a filled silhouette by its own edges: lit on top/left, dark on bottom/right"""
    S = set(pts)
    for (x, y) in pts:
        t = base
        if (x - 1, y) not in S: t += 1
        if (x, y - 1) not in S: t += 1
        if (x + 1, y) not in S: t -= 1
        if (x, y + 1) not in S: t -= 1
        if (x + 1, y + 1) not in S and (x + 1, y) in S and (x, y + 1) in S: t -= 1
        cv.px(x, y, Rm[max(0, min(4, t))])


def disc_path(pts_xy, r):
    out = set()
    for i in range(len(pts_xy) - 1):
        (x0, y0), (x1, y1) = pts_xy[i], pts_xy[i + 1]
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for k in range(n + 1):
            t = k / n
            x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t
            rr = r(i + t) if callable(r) else r
            for yy in range(int(y - rr) - 1, int(y + rr) + 2):
                for xx in range(int(x - rr) - 1, int(x + rr) + 2):
                    if (xx + .5 - x) ** 2 + (yy + .5 - y) ** 2 <= rr * rr:
                        out.add((xx, yy))
    return out


def layer_out(cv, lay):
    lay.outline(); cv.paste(lay)


# ----------------------------------------------------------------------------- foliage props
@prop('bush_round', 'Round bush', 0.4, 0.25, ['route', 'town'])
def p_bush_round(rng):
    W, H = 70, 50; G = H - 2; cx = 35
    cv = Cv(W, H)
    blob(cv, cx - 7, G - 15, 15, 13, R['leaf'], rng, cell=6, bias=.04)
    blob(cv, cx + 8, G - 13, 14, 12, R['leaf'], rng, cell=6, bias=-.02)
    blob(cv, cx, G - 10, 20, 10, R['leaf'], rng, cell=6, bias=-.04)
    cv.outline()
    return cv, cx


@prop('bush_berry', 'Berry bush', 0.45, 0.25, ['route', 'farm'])
def p_bush_berry(rng):
    W, H = 80, 54; G = H - 2; cx = 40
    cv = Cv(W, H)
    blob(cv, cx - 12, G - 17, 15, 14, R['oak'], rng, cell=6, bias=.04)
    blob(cv, cx + 12, G - 16, 15, 13, R['oak'], rng, cell=6)
    blob(cv, cx, G - 22, 15, 12, R['oak'], rng, cell=6, bias=.06)
    blob(cv, cx, G - 11, 26, 11, R['oak'], rng, cell=6, bias=-.04)
    cv.outline()
    spots = [(cx - 20, G - 18), (cx - 10, G - 26), (cx + 2, G - 30), (cx + 14, G - 24), (cx + 21, G - 14), (cx - 4, G - 14),
             (cx + 8, G - 10), (cx - 16, G - 8), (cx + 4, G - 21), (cx - 12, G - 16), (cx + 18, G - 8)]
    for (bx, by) in spots:
        bx += rng.randint(-1, 1); by += rng.randint(-1, 1)
        for (dx, dy) in ((0, 0), (3, 1), (1, 3)):
            if rng.random() < .8 or (dx, dy) == (0, 0):
                x, y = bx + dx, by + dy
                cv.px(x, y, R['berry'][3]); cv.px(x + 1, y, R['berry'][2]); cv.px(x, y + 1, R['berry'][2]); cv.px(x + 1, y + 1, R['berry'][1])
                cv.px(x, y, R['berry'][4]) if dx == 0 else None
    return cv, cx


@prop('hedge', 'Hedge', 0.6, 0.15, ['town', 'route'])
def p_hedge(rng):
    W, H = 140, 56; G = H - 2; cx = 70
    cv = Cv(W, H)
    x0, x1, top = cx - 58, cx + 57, G - 40
    pts = []
    for y in range(top, G + 1):
        for x in range(x0, x1 + 1):
            # rounded corners
            r = 7
            dx = max(x0 + r - x, 0, x - (x1 - r)); dy = max(top + r - y, 0)
            if dx * dx + dy * dy > r * r: continue
            fy = y - top
            t = 3 if fy < 12 else 2
            if fy < 2: t = 4
            if fy == 12 or fy == 13: t = 1
            if x - x0 < 4: t = min(4, t + 1)
            if x1 - x < 6: t = max(0, t - 1)
            if G - y < 5: t = max(0, t - 1)
            pts.append((x, y, t))
    leafy(cv, pts, R['oak'], rng, cell=6)
    # a few lighter sprigs sticking out on top
    for sx in range(x0 + 14, x1 - 10, 29):
        sx += rng.randint(-3, 3)
        cv.px(sx, top - 1, R['oak'][3]); cv.px(sx + 1, top - 1, R['oak'][3])
    cv.outline()
    return cv, cx


def grass_tuft(cv, cx, G, n, hmin, hmax, spread, Rs, rng, width=4.0, base_t=(1, 2, 3)):
    bl = []
    for i in range(n):
        f = (i + .5) / n
        x = cx + (f - .5) * spread + rng.uniform(-1.5, 1.5)
        h = rng.uniform(hmin, hmax) * (1 - .35 * abs(f - .5) * 2)
        lean = (f - .5) * 14 + rng.uniform(-3, 3)
        bl.append((rng.random(), x, h, lean))
    bl.sort()
    for k, (z, x, h, lean) in enumerate(bl):
        lay = Cv(cv.w, cv.h)
        pts = []
        steps = 18
        L, Rr = [], []
        for i in range(steps + 1):
            t = i / steps
            px_ = x + lean * t * t
            py_ = G + 1 - h * t
            hw = width * .5 * (1 - t) + .2
            L.append((px_ - hw, py_)); Rr.append((px_ + hw, py_))
        ps = lay.polypts(L + Rr[::-1])
        S = set(ps)
        tb = base_t[min(len(base_t) - 1, int(z * len(base_t)))]
        for (xx, yy) in ps:
            t = tb
            if (xx - 1, yy) not in S: t += 1
            if (xx + 1, yy) not in S and (xx - 1, yy) in S: t -= 1
            if yy < G + 1 - h * .75: t += 1
            if yy > G - 3: t -= 1
            cv.px(xx, yy, Rs[max(0, min(4, t))])
        # thin dark line on the right edge to separate overlapping blades
        for (xx, yy) in ps:
            if (xx + 1, yy) not in S and cv.get(xx + 1, yy) is not None and yy < G - 1:
                cv.px(xx + 1, yy, Rs[0])


@prop('tallgrass', 'Tall grass', 0.3, 1.0, ['route'])
def p_tallgrass(rng):
    W, H = 50, 40; G = H - 2; cx = 25
    cv = Cv(W, H)
    grass_tuft(cv, cx, G, 13, 18, 27, 28, R['leaf'], rng, width=4.6)
    cv.outline()
    return cv, cx


@prop('reeds', 'Cattail reeds', 0.25, 1.0, ['water', 'route'])
def p_reeds(rng):
    W, H = 56, 64; G = H - 2; cx = 28
    cv = Cv(W, H)
    grass_tuft(cv, cx, G, 7, 22, 38, 22, R['kelp'], rng, width=3.4)
    stalks = [(cx - 7, 46, -3), (cx + 2, 54, 1), (cx + 9, 40, 4)]
    for (sx, h, lean) in stalks:
        lay = Cv(W, H)
        for y in range(G - h + 8, G + 1):
            t = (G - y) / h
            x = round(sx + lean * t * t)
            lay.px(x, y, R['kelp'][3]); lay.px(x + 1, y, R['kelp'][1])
        hx = round(sx + lean * ((h - 10) / h) ** 2)
        hy = G - h + 6
        for (x, y) in lay.ellpts(hx + 1, hy, 2.6, 6.2):
            t = 3 if x <= hx else 2
            if y < hy - 4: t += 1
            if y > hy + 3: t -= 1
            lay.px(x, y, R['dwood'][t])
        lay.px(hx, hy - 8, R['kelp'][2]); lay.px(hx, hy - 9, R['kelp'][3]); lay.px(hx, hy - 10, R['kelp'][3])
        layer_out(cv, lay)
    grass_tuft(cv, cx + 1, G, 5, 10, 16, 20, R['leaf'], rng, width=3.6)
    cv.outline()
    return cv, cx


def flower_patch(rng, col):
    W, H = 56, 28; G = H - 2; cx = 28
    cv = Cv(W, H)
    pts = []
    for (x, y) in cv.ellpts(cx, G - 3, 21, 5):
        ny = (y + .5 - (G - 3)) / 5
        pts.append((x, y, 3 if ny < -.3 else 2 if ny < .4 else 1))
    leafy(cv, pts, R['leaf'], rng, cell=4)
    # leaf sprigs
    for k in range(9):
        x = cx - 18 + k * 4.5 + rng.uniform(-1, 1)
        for d in range(rng.randint(2, 4)):
            cv.px(int(x) + (d % 2), G - 6 - d, R['leaf'][3 if d else 2])
    cv.outline()
    spots = [(-16, -7), (-9, -11), (-2, -8), (5, -12), (12, -8), (17, -11), (-13, -13), (1, -15), (9, -16)]
    rng.shuffle(spots)
    for i, (dx, dy) in enumerate(spots[:8]):
        c = col[i % len(col)] if isinstance(col, list) else col
        Rf = R[c]
        x = cx + dx + rng.randint(-1, 1); y = G + dy + rng.randint(0, 2)
        for yy in range(y + 2, G - 2):
            if cv.get(x, yy) is None or cv.get(x, yy) in [olc(c) for c in R['leaf']]:
                cv.px(x, yy, R['leaf'][1])
        lay = Cv(W, H)
        for (a, b, t) in ((0, -1, 4), (-1, 0, 3), (1, 0, 2), (0, 1, 1), (0, 0, None)):
            lay.px(x + a, y + b, Rf[t] if t is not None else R['yellow'][4] if c != 'yellow' else R['coral'][3])
        layer_out(cv, lay)
    return cv, cx


@prop('flowers_red', 'Red flowers', 0, 0.6, ['route', 'town'])
def p_flowers_red(rng): return flower_patch(rng, 'red')


@prop('flowers_blue', 'Blue flowers', 0, 0.6, ['route', 'town'])
def p_flowers_blue(rng): return flower_patch(rng, 'blue')


@prop('flowers_yellow', 'Yellow flowers', 0, 0.6, ['route', 'town', 'farm'])
def p_flowers_yellow(rng): return flower_patch(rng, 'yellow')


def mush(cv, cx, G, cw, ch, sh, sw, Rc, rng, spots=True, Rs=None):
    Rs = Rs or R['cream']
    lay = Cv(cv.w, cv.h)
    top = G - sh - ch
    # stem
    for y in range(G - sh - 1, G + 1):
        f = (y - (G - sh)) / max(1, sh)
        hw = sw / 2 + f * sw * .18
        for x in range(int(cx - hw), int(cx + hw) + 1):
            if abs(x + .5 - cx) <= hw:
                lay.px(x, y, Rs[xt(x, cx - hw, cx + hw, (.3, .7, .9))])
    # cap (upper half-ellipse with slightly curled rim)
    cy = G - sh
    for (x, y) in lay.ellpts(cx, cy, cw / 2, ch):
        if y <= cy:
            nx = (x + .5 - cx) / (cw / 2); ny = (y + .5 - cy) / ch
            t = sph(nx * .95, ny * .9 + .15, .05)
            if y >= cy - 1: t = max(0, min(t, 1))
            lay.px(x, y, Rc[t])
    # underside band
    for x in range(int(cx - cw / 2 + 2), int(cx + cw / 2 - 1)):
        lay.px(x, cy + 1, Rs[1])
    if spots:
        n = max(3, int(cw * ch / 50))
        placed = []
        for _ in range(n * 6):
            if len(placed) >= n: break
            nx = rng.uniform(-.75, .75); ny = rng.uniform(-.85, -.2)
            if nx * nx + ny * ny > .7: continue
            if any((nx - a) ** 2 + (ny - b) ** 2 < .12 for a, b in placed): continue
            placed.append((nx, ny))
            sx = cx + nx * cw / 2; sy = cy + ny * ch
            rr = max(1.0, cw / 12 * (1 - abs(nx) * .5))
            for (x, y) in lay.ellpts(sx, sy, rr * (1 - abs(nx) * .35), rr * .8):
                if lay.get(x, y) in Rc:
                    lay.px(x, y, R['white'][4] if (x + y) < sx + sy else R['white'][2] if abs(nx) < .5 else R['white'][1])
    layer_out(cv, lay)


@prop('mushroom', 'Mushrooms', 0.2, 0, ['route', 'cave'])
def p_mushroom(rng):
    W, H = 40, 34; G = H - 2; cx = 20
    cv = Cv(W, H)
    mush(cv, cx - 4, G, 16, 8, 9, 5, R['red'], rng)
    mush(cv, cx + 7, G, 10, 5, 5, 3, R['red'], rng)
    for k in range(-9, 12, 3):
        cv.px(cx + k, G, R['leaf'][2]); cv.px(cx + k + 1, G, R['leaf'][2]); cv.px(cx + k, G - 1, R['leaf'][3])
    cv.outline()
    return cv, cx


@prop('mushroom_giant', 'Giant mushroom', 1.3, 0.05, ['route', 'cave'])
def p_mushroom_giant(rng):
    W, H = 140, 170; G = H - 2; cx = 70
    cv = Cv(W, H)
    # stem with a frilly ring
    st = Cv(W, H)
    sh = 92
    for y in range(G - sh, G + 1):
        f = (y - (G - sh)) / sh
        hw = 11 + 5 * f * f + (6 if y > G - 6 else 0) * ((y - (G - 6)) / 6)
        for x in range(int(cx - hw) - 1, int(cx + hw) + 2):
            if abs(x + .5 - cx) <= hw:
                t = xt(x, cx - hw, cx + hw, (.24, .64, .86))
                if (x * 3 + y) % 17 == 0 and t > 0: t -= 1
                st.px(x, y, R['cream'][t])
    ry0 = G - 58
    for y in range(ry0, ry0 + 9):
        f = (y - ry0) / 9
        hw = 14 + 6 * f
        for x in range(int(cx - hw), int(cx + hw) + 1):
            k = (x + 40) % 5
            t = 3 if f < .3 else 2
            if x > cx + hw * .5: t -= 1
            if y == ry0 + 8 and k in (0, 1): continue
            if k == 0: t -= 1
            st.px(x, y, R['white'][max(0, t)])
    layer_out(cv, st)
    for y in range(ry0 + 9, ry0 + 12):
        for x in range(cx - 12, cx + 12): darken(cv, x, y, 1)
    # little round door in the stem
    for (x, y) in cv.ellpts(cx - 1, G - 14, 6, 9):
        if y <= G - 1:
            cv.px(x, y, R['wood'][2 if x < cx + 2 else 1])
    for (x, y) in cv.ellpts(cx - 1, G - 14, 7, 10):
        if y <= G - 1 and (x + .5 - cx + 1) ** 2 / 36 + (y + .5 - G + 14) ** 2 / 81 > 1:
            cv.px(x, y, olc(R['wood'][1]))
    cv.px(cx + 2, G - 10, R['gold'][3])
    # cap
    cp = Cv(W, H)
    cy = G - sh + 6; crx, cry = 62, 52
    Rc = R['coral']
    for (x, y) in cp.ellpts(cx, cy, crx, cry):
        if y <= cy + 4 - 0.0016 * (x - cx) ** 2 * 0:
            nx = (x + .5 - cx) / crx; ny = (y + .5 - cy) / cry
            t = sph(nx * .96, ny * .95 + .12, .05)
            if y > cy - 2: t = min(t, 1)
            cp.px(x, y, Rc[t])
    # rim: thick curled lip
    for x in range(cx - crx + 2, cx + crx - 1):
        nx = (x + .5 - cx) / crx
        yy = cy + 3 + int(2 * (1 - nx * nx))
        for d in range(3):
            if cp.has(x, yy - d):
                cp.px(x, yy - d, Rc[0] if d == 0 else Rc[1])
        cp.px(x, yy + 1, R['cream'][1] if abs(nx) < .9 else None)
    # spots, squashed toward the edges
    placed = []
    for _ in range(400):
        if len(placed) >= 13: break
        nx = rng.uniform(-.85, .85); ny = rng.uniform(-.92, -.12)
        if nx * nx + ny * ny > .8: continue
        rr = rng.uniform(5, 9) * (1 - .4 * (nx * nx + ny * ny))
        if any(math.hypot((nx - a) * crx, (ny - b) * cry) < rr + r2 + 3 for a, b, r2 in placed): continue
        placed.append((nx, ny, rr))
    for (nx, ny, rr) in placed:
        sx = cx + nx * crx; sy = cy + ny * cry
        k = math.sqrt(max(.15, 1 - nx * nx - ny * ny))
        ex = rr * (1 - abs(nx) * .5); ey = rr * .62 * (.5 + .5 * k)
        for (x, y) in cp.ellpts(sx, sy, ex, ey):
            if cp.get(x, y) in Rc:
                t = sph((x + .5 - cx) / crx * .9, (y + .5 - cy) / cry * .9 + .1, .05)
                lx = (x + .5 - sx) / ex + (y + .5 - sy) / ey
                cp.px(x, y, R['cream'][4 if lx < -.6 else 3 if t >= 2 else 2])
    layer_out(cv, cp)
    # small mushrooms and grass at the foot
    mush(cv, cx - 30, G, 14, 7, 8, 4, R['coral'], rng)
    mush(cv, cx + 26, G, 10, 5, 6, 3, R['coral'], rng)
    for gx in (cx - 42, cx - 20, cx + 16, cx + 36):
        for k in range(5):
            cv.px(gx + k, G - (k % 3), R['moss'][3 if k % 2 else 2])
            cv.px(gx + k, G, R['moss'][1])
    cv.outline()
    return cv, cx

# ----------------------------------------------------------------------------- wood and stone
def rings(cv, cx, cy, rx, ry, Rw):
    for (x, y) in cv.ellpts(cx, cy, rx, ry):
        d = math.sqrt(((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2)
        k = int(d * 4.2)
        t = 4 if k % 2 == 0 else 3
        if d > .86: t = 1
        if d < .12: t = 2
        cv.px(x, y, Rw[t])


@prop('stump', 'Tree stump', 0.45, 0, ['route'])
def p_stump(rng):
    W, H = 56, 40; G = H - 2; cx = 28
    cv = Cv(W, H)
    Rb = R['bark']
    top = G - 22
    for y in range(top, G + 1):
        f = (y - top) / (G - top)
        hw = 15 + (5 * (f - .6) / .4 if f > .6 else 0)
        for x in range(int(cx - hw), int(cx + hw) + 1):
            t = xt(x, cx - hw, cx + hw)
            if (x - cx + 40) % 5 == 0 and t > 0: t -= 1
            cv.px(x, y, Rb[t])
    # roots
    for (a, b) in ((-19, 1), (17, 1)):
        cv.rect(cx + a, G - 2, cx + a + 3, G, Rb[2 if a < 0 else 1])
    for (x, y) in cv.ellpts(cx, top, 15, 6):
        cv.px(x, y, Rb[1])
    rings(cv, cx, top, 13, 5, R['plank'])
    for x in range(cx - 14, cx + 15):
        if cv.get(x, top + 5) in R['plank']: cv.px(x, top + 5, Rb[2])
    # a crack
    cv.line(cx + 2, top - 3, cx + 7, top + 1, R['plank'][1])
    # moss
    for k in range(-14, -4):
        cv.px(cx + k, top + 6 + abs(k + 9) // 3, R['moss'][3]); cv.px(cx + k, top + 7 + abs(k + 9) // 3, R['moss'][2])
    cv.outline()
    return cv, cx


@prop('log', 'Fallen log', 0.6, 0, ['route'])
def p_log(rng):
    W, H = 96, 36; G = H - 2; cx = 48
    cv = Cv(W, H)
    Rb = R['bark']
    x0, x1 = cx - 34, cx + 36
    cy, ry = G - 11, 11
    for y in range(cy - ry, cy + ry + 1):
        ny = (y + .5 - cy) / ry
        for x in range(x0, x1 + 1):
            # rounded far end
            if x > x1 - 6 and ((x - (x1 - 6)) / 7) ** 2 + ny * ny > 1: continue
            t = 3 if ny < -.5 else 2 if ny < .2 else 1 if ny < .7 else 0
            if (y + (x // 9)) % 5 == 0 and 0 < t: t -= 1
            if ny < -.85: t = 4 if x < cx else 3
            cv.px(x, y, Rb[t])
    # stub branch
    st = Cv(W, H)
    for (x, y) in st.polypts([(cx + 6, cy - ry + 2), (cx + 12, cy - ry - 8), (cx + 17, cy - ry - 6), (cx + 13, cy - ry + 2)]):
        st.px(x, y, Rb[3 if x < cx + 12 else 1])
    rings(st, cx + 15, cy - ry - 7, 2.6, 2, R['plank'])
    tmp = Cv(W, H); st.outline(); tmp.paste(st); tmp.paste(cv); cv = tmp
    # end face with rings
    for (x, y) in cv.ellpts(x0, cy, 7.5, ry + .5): cv.px(x, y, Rb[1])
    rings(cv, x0 - 1, cy, 6.5, ry - 1, R['plank'])
    # moss on the top
    for x in range(cx - 14, cx + 12):
        d = 2 + int(2 * math.sin(x * .5)) + (1 if x % 7 == 0 else 0)
        for k in range(d):
            cv.px(x, cy - ry + k, R['moss'][3 if k == 0 else 2])
    cv.outline()
    return cv, cx


@prop('boulder', 'Boulder', 1.0, 0, ['route', 'cave'])
def p_boulder(rng):
    W, H = 110, 84; G = H - 2; cx = 55
    cv = Cv(W, H)
    poly = [(cx - 44, G + 1), (cx - 42, G - 22), (cx - 32, G - 46), (cx - 12, G - 62), (cx + 10, G - 64), (cx + 30, G - 52),
            (cx + 42, G - 30), (cx + 45, G + 1)]
    pts = Cv(W, H).polypts(poly)
    rock_mass(cv, pts, R['rock'], rng, cx - 4, G - 28, 46, 42, cell=20, bias=.08)
    # moss cap
    tops = {}
    for (x, y) in pts: tops[x] = min(tops.get(x, 999), y)
    for x, top in tops.items():
        if cx - 30 < x < cx + 24:
            d = 4 + int(3 * math.sin(x * .27)) + (3 if (x * 5) % 19 < 2 else 0)
            for k in range(d):
                cv.px(x, top + k, R['moss'][4 if k == 0 and x < cx else 3 if k < 2 else 2 if k < d - 1 else 1])
    cv.outline()
    return cv, cx


@prop('rocks', 'Small rocks', 0.35, 0, ['route', 'cave'])
def p_rocks(rng):
    W, H = 64, 32; G = H - 2; cx = 32
    cv = Cv(W, H)
    for (dx, rx, ry) in ((-12, 11, 9), (10, 9, 7), (-1, 7, 5), (21, 5, 4)):
        lay = Cv(W, H)
        pts = [(x, y) for (x, y) in lay.ellpts(cx + dx, G - ry + 2, rx, ry + 1) if y <= G]
        rock_mass(lay, pts, R['rock'], rng, cx + dx, G - ry + 2, rx, ry, cell=8, bias=.1)
        layer_out(cv, lay)
    return cv, cx


CRYSTAL_SHARDS = [(-14, 30, -.38, 7), (13, 34, .32, 7), (2, 62, .04, 10), (-5, 40, -.12, 7), (22, 20, .62, 5), (-24, 18, -.75, 5)]
CRYSTAL_SPARKS = ((-26, -44), (24, -56), (6, -72), (-16, -62))


@prop('crystal', 'Glow crystals', 0.5, 0, ['cave'])
def p_crystal(rng):
    return crystal_cluster(rng, R['cyan'], CRYSTAL_SHARDS, CRYSTAL_SPARKS)


def crystal_cluster(rng, Rc, shards, sparks, W=76, H=84, srx=26):
    G = H - 2; cx = W // 2
    cv = Cv(W, H)
    # rock socket
    base = Cv(W, H)
    pts = [(x, y) for (x, y) in base.ellpts(cx, G, srx, 9) if y <= G]
    rock_mass(base, pts, R['cave'], rng, cx, G - 4, srx, 9, cell=9)
    shards = list(shards)
    shards.sort(key=lambda s: -abs(s[2]))
    lay_all = []
    for (dx, L, ang, hw) in shards:
        lay = Cv(W, H)
        bx, by = cx + dx, G - 3
        ux, uy = math.sin(ang), -math.cos(ang)       # axis
        px_, py_ = -uy, ux                            # across
        tip = (bx + ux * L, by + uy * L)
        sh = (bx + ux * (L - hw * 1.6), by + uy * (L - hw * 1.6))
        poly = [(bx - px_ * hw, by - py_ * hw), (sh[0] - px_ * hw, sh[1] - py_ * hw), tip,
                (sh[0] + px_ * hw, sh[1] + py_ * hw), (bx + px_ * hw, by + py_ * hw)]
        for (x, y) in lay.polypts(poly):
            # across-coordinate decides the facet
            a = ((x + .5 - bx) * px_ + (y + .5 - by) * py_) / hw
            along = ((x + .5 - bx) * ux + (y + .5 - by) * uy) / L
            t = 4 if a < -.45 else 3 if a < .05 else 2 if a < .5 else 1
            if along > .85: t = min(4, t + 1)
            if along < .12: t = max(0, t - 1)
            lay.px(x, y, Rc[t])
        # inner glint line
        for k in range(int(L * .2), int(L * .7)):
            x = bx + ux * k - px_ * hw * .55; y = by + uy * k - py_ * hw * .55
            lay.px(int(x), int(y), R['white'][4])
        lay.outline(col=mix(Rc[0], OL, .55))
        lay_all.append(lay)
    for lay in lay_all: cv.paste(lay)
    base.outline(); cv.paste(base)
    # sparkles
    for (sx, sy) in ((cx + a, G + b) for (a, b) in sparks):
        cv.px(sx, sy, R['white'][4])
        for (a, b) in ((1, 0), (-1, 0), (0, 1), (0, -1)): cv.px(sx + a, sy + b, Rc[3])
        cv.fx.append(('sparkle', sx, sy))
    return cv, cx


@prop('stalagmite', 'Stalagmite', 0.5, 0, ['cave'])
def p_stalagmite(rng):
    W, H = 60, 100; G = H - 2; cx = 30
    cv = Cv(W, H)
    Rr = R['cave']
    top = G - 88
    pts = []
    for y in range(top, G + 1):
        f = (y - top) / (G - top)
        hw = 2 + 17 * f ** 1.25 + 1.6 * math.sin(f * 30) * f + (4 * ((f - .9) / .1) if f > .9 else 0)
        off = 2.5 * math.sin(f * 4)
        for x in range(int(cx + off - hw) - 1, int(cx + off + hw) + 2):
            if abs(x + .5 - cx - off) <= hw:
                pts.append((x, y, (x + .5 - cx - off) / hw, f))
    for (x, y, nx, f) in pts:
        t = 3 if nx < -.45 else 2 if nx < .25 else 1 if nx < .7 else 0
        band = (f * 30) % (2 * math.pi)
        if 4.4 < band < 5.2: t = max(0, t - 1)          # drip ridges
        elif 3.6 < band < 4.4 and nx < .3: t = min(4, t + 1)
        if f < .06: t = min(4, t + 1)
        cv.px(x, y, Rr[t])
    # wet tip glint
    cv.px(cx - 1, top + 3, R['white'][4]); cv.px(cx - 1, top + 4, R['lav'][4])
    cv.outline()
    # pebbles
    for (dx, r) in ((-24, 3), (22, 4), (-19, 2)):
        lay = Cv(W, H)
        ball(lay, cx + dx, G - r + 1, r + 1, r, Rr, .1)
        layer_out(cv, lay)
    return cv, cx


@prop('well', 'Stone well', 0.9, 0, ['town', 'farm'])
def p_well(rng):
    W, H = 90, 104; G = H - 2; cx = 45
    cv = Cv(W, H)
    Rs = R['stone']; Rw = R['wood']
    # posts (behind the rim at the back, so draw first)
    for px0 in (cx - 27, cx + 22):
        lay = Cv(W, H)
        for y in range(G - 74, G - 18):
            for x in range(px0, px0 + 5): lay.px(x, y, Rw[[3, 2, 2, 1, 0][x - px0]])
        layer_out(cv, lay)
    # crossbar, rope, bucket
    lay = Cv(W, H)
    for x in range(cx - 24, cx + 24):
        lay.px(x, G - 66, Rw[3]); lay.px(x, G - 65, Rw[2]); lay.px(x, G - 64, Rw[1])
    lay.rect(cx + 22, G - 67, cx + 30, G - 63, Rw[1])      # crank
    lay.rect(cx + 29, G - 63, cx + 30, G - 58, Rw[2])
    layer_out(cv, lay)
    for y in range(G - 63, G - 44): cv.px(cx, y, R['hay'][2 if y % 3 else 1])
    lay = Cv(W, H)
    for y in range(G - 44, G - 33):
        f = (y - (G - 44)) / 11
        hw = 6 - 1.5 * f
        for x in range(int(cx - hw), int(cx + hw) + 1):
            t = xt(x, cx - hw, cx + hw)
            lay.px(x, y, (R['iron'] if (y - (G - 44)) in (1, 8) else Rw)[t])
    lay.line(cx - 6, G - 44, cx, G - 50, R['iron'][2]); lay.line(cx + 6, G - 44, cx, G - 50, R['iron'][2])
    layer_out(cv, lay)
    # stone cylinder body
    body = Cv(W, H)
    x0, x1, top = cx - 28, cx + 28, G - 28
    for y in range(top, G + 1):
        r = (y - top) // 6; ry = (y - top) % 6
        for x in range(x0, x1 + 1):
            nx = (x + .5 - cx) / 28
            u = math.asin(max(-1, min(1, nx))) * 28
            c = int(u + 100 + (6 if r % 2 else 0)) % 12
            t = 3 if nx < -.5 else 2 if nx < .35 else 1 if nx < .8 else 0
            if ry == 5: t = 0
            elif ry == 0 and t < 4: t += 1
            if c == 0 and ry < 5: t = max(0, t - 1)
            body.px(x, y + int(3 * max(0.0, 1 - nx * nx) ** .5), Rs[t])
    # rim top (ellipse) with dark water
    for (x, y) in body.ellpts(cx, top, 29, 8):
        nx = (x + .5 - cx) / 29; ny = (y + .5 - top) / 8
        body.px(x, y, Rs[4 if ny < -.4 else 3 if nx < .3 else 2])
    for (x, y) in body.ellpts(cx, top, 22, 5):
        ny = (y + .5 - top) / 5
        body.px(x, y, R['water'][0] if ny < .1 else R['water'][1])
    for x in range(cx - 8, cx + 3): body.px(x, top + 2, R['water'][3])
    layer_out(cv, body)
    # roof
    rf = Cv(W, H)
    shingles(rf, [(cx, G - 96), (cx - 38, G - 70), (cx - 34, G - 66), (cx + 34, G - 66), (cx + 38, G - 70)], R['coral'], tw=6, th=4)
    for x in range(cx - 36, cx + 37):
        rf.px(x, G - 68 + 0, R['coral'][0] if rf.has(x, G - 68) else None)
    rf.outline()
    cv.paste(rf)
    return cv, cx


def crate(cv, x0, y0, w, h, rng, top=6, Rw=None):
    Rw = Rw or R['plank']; Rf = ramp((160, 104, 66))
    lay = Cv(cv.w, cv.h)
    x1 = x0 + w - 1; y1 = y0 + h - 1
    fy = y0 + top
    # top face (planks running left-right, seen from above)
    for y in range(y0, fy):
        f = (y - y0) / top
        a = x0 + 3 * (1 - f); b = x1 - 3 * (1 - f)
        for x in range(int(a), int(b) + 1):
            t = 4 if (y - y0) % 3 == 0 else 3
            if b - x < 2: t = 2
            lay.px(x, y, Rw[t])
    # front: planks inside a thick frame
    for y in range(fy, y1 + 1):
        for x in range(x0, x1 + 1):
            fx = x - x0 < 3 or x1 - x < 3
            fyy = y - fy < 3 or y1 - y < 3
            if fx or fyy:
                t = 2
                if (x - x0 == 0 and not fyy) or y - fy == 0: t = 3
                if x1 - x == 0 or y1 - y == 0: t = 0
                elif x1 - x < 3 and not fyy: t = 1
                lay.px(x, y, Rf[t])
            else:
                k = (y - fy - 3) % 6
                t = 1 if k == 5 else 3 if k == 0 else 2
                if x1 - x < 5: t = max(0, t - 1)
                lay.px(x, y, Rw[t])
    # diagonal brace
    n = (x1 - 3) - (x0 + 3)
    for i in range(n + 1):
        x = x0 + 3 + i
        yc = y1 - 3 - i * ((y1 - 3) - (fy + 3)) / max(1, n)
        for d in range(-1, 2):
            y = int(round(yc)) + d
            if fy + 3 <= y <= y1 - 3:
                lay.px(x, y, Rf[4 if d == -1 else 2 if d == 0 else 0])
    for (nx_, ny_) in ((x0 + 1, fy + 1), (x1 - 1, fy + 1), (x0 + 1, y1 - 1), (x1 - 1, y1 - 1)):
        lay.px(nx_, ny_, R['iron'][3])
    for x in range(x0, x1 + 1):
        lay.px(x, fy, Rf[4])
    layer_out(cv, lay)


@prop('crate', 'Crate', 0.4, 0, ['town', 'farm', 'junk'])
def p_crate(rng):
    W, H = 50, 50; G = H - 2; cx = 25
    cv = Cv(W, H)
    crate(cv, cx - 16, G - 32, 32, 33, rng)
    return cv, cx


@prop('crates', 'Crate stack', 0.75, 0, ['town', 'farm', 'junk'])
def p_crates(rng):
    W, H = 76, 76; G = H - 2; cx = 38
    cv = Cv(W, H)
    crate(cv, cx - 6, G - 58, 26, 27, rng)
    crate(cv, cx - 28, G - 28, 28, 29, rng)
    crate(cv, cx + 1, G - 28, 28, 29, rng)
    return cv, cx


@prop('haybale', 'Hay bale', 0.6, 0, ['farm'])
def p_haybale(rng):
    W, H = 64, 50; G = H - 2; cx = 32
    cv = Cv(W, H)
    Rh = R['hay']
    fx, fy, frx, fry = cx - 8, G - 18, 15, 18.5
    # body going back to the right
    for y in range(int(fy - fry), G + 1):
        ny = (y + .5 - fy) / fry
        for x in range(int(fx), cx + 22):
            if ((x + .5 - (cx + 8)) / 15) ** 2 + ny * ny > 1 and x > cx + 8: continue
            if abs(ny) > 1: continue
            t = 3 if ny < -.55 else 2 if ny < .3 else 1 if ny < .75 else 0
            if (x * 2 + y * 5) % 11 == 0 and t > 0: t -= 1
            cv.px(x, y, Rh[t])
    for bx in (cx + 2, cx + 13):
        for y in range(int(fy - fry), G + 1):
            if cv.has(bx, y): cv.px(bx, y, R['coral'][1]);
            if cv.has(bx + 1, y): cv.px(bx + 1, y, R['coral'][0])
    # round face with spiral
    for (x, y) in cv.ellpts(fx, fy, frx, fry):
        dx = (x + .5 - fx) / frx; dy = (y + .5 - fy) / fry
        r = math.hypot(dx, dy); a = math.atan2(dy, dx)
        s = (r * 5 + a / (2 * math.pi)) % 1
        t = 3 if s < .55 else 2
        if r > .9: t = 2 if dx + dy < 0 else 1
        if dx + dy < -.9: t = min(4, t + 1)
        if dx + dy > .9: t = max(0, t - 1)
        if r < .12: t = 1
        cv.px(x, y, Rh[t])
    cv.outline()
    return cv, cx


@prop('crops', 'Crop row', 0.5, 0.2, ['farm'])
def p_crops(rng):
    W, H = 104, 34; G = H - 2; cx = 52
    cv = Cv(W, H)
    Rs = R['soil']
    for (x, y) in cv.ellpts(cx, G - 4, 46, 5):
        ny = (y + .5 - (G - 4)) / 5
        t = 3 if ny < -.4 else 2 if ny < .3 else 1
        if (x * 3 + y * 7) % 13 == 0: t = max(0, t - 1)
        cv.px(x, y, Rs[t])
    cv.outline()
    Rc = ramp((128, 196, 98))
    for i in range(6):
        x = cx - 38 + i * 15 + rng.randint(-1, 1)
        lay = Cv(W, H)
        # outer leaves
        for side in (-1, 1):
            for (px_, py_) in lay.polypts([(x, G - 6), (x + side * 9, G - 12), (x + side * 10, G - 7), (x + side * 5, G - 4)]):
                lay.px(px_, py_, Rc[2 if side < 0 else 1])
        ball(lay, x, G - 10, 6.5, 6, Rc, .05)
        # wrapped leaves: two arcs crossing the heart
        for (qx, qy) in lay.ellpts(x, G - 10, 6.5, 6):
            for (ax, ay, r) in ((x + 4, G - 5, 6.0), (x - 5, G - 6, 6.5)):
                if abs(math.hypot(qx + .5 - ax, qy + .5 - ay) - r) < .55:
                    lay.px(qx, qy, Rc[1])
                elif abs(math.hypot(qx + .5 - ax, qy + .5 - ay) - r + 1) < .5 and qy < G - 9:
                    lay.px(qx, qy, Rc[4])
        layer_out(cv, lay)
    return cv, cx


# ----------------------------------------------------------------------------- town furniture
def board(cv, x0, y0, x1, y1, dirn, Rw):
    """wooden arrow board; dirn=+1 points right, -1 left"""
    lay = Cv(cv.w, cv.h)
    my = (y0 + y1) / 2 + .5
    tip = 6
    if dirn > 0:
        poly = [(x0, y0), (x1 - tip, y0), (x1, my), (x1 - tip, y1 + 1), (x0, y1 + 1)]
    else:
        poly = [(x0 + tip, y0), (x1, y0), (x1, y1 + 1), (x0 + tip, y1 + 1), (x0, my)]
    for (x, y) in lay.polypts(poly):
        t = 2
        if y == y0: t = 4
        elif y == y0 + 1: t = 3
        elif y >= y1 - 1: t = 1
        if (y - y0) == 5 and y0 + 1 < y < y1 - 1: t = 1
        if (x * 7 + y * 3) % 23 == 0 and 1 < t < 4: t -= 1
        lay.px(x, y, Rw[t])
    lay.outline(); cv.paste(lay)


@prop('signpost', 'Signpost', 0.3, 0, ['route', 'town'])
def p_signpost(rng):
    W, H = 56, 80; G = H - 2; cx = 28
    cv = Cv(W, H)
    lay = Cv(W, H)
    for y in range(G - 66, G + 1):
        for x in range(cx - 3, cx + 3): lay.px(x, y, R['wood'][[3, 2, 2, 1, 1, 0][x - cx + 3]])
    lay.rect(cx - 4, G - 68, cx + 3, G - 66, lambda x, y: R['wood'][4 if y == G - 68 else 3])
    layer_out(cv, lay)
    board(cv, cx - 10, G - 60, cx + 22, G - 49, 1, R['plank'])
    board(cv, cx - 22, G - 44, cx + 9, G - 34, -1, R['plank'])
    # nails
    cv.px(cx - 1, G - 55, R['iron'][1]); cv.px(cx - 1, G - 39, R['iron'][1])
    # grass at the foot
    for k in range(-6, 6, 2):
        cv.px(cx + k, G, R['moss'][2]); cv.px(cx + k + 1, G - 1, R['moss'][3])
    cv.outline()
    return cv, cx


def glow_box(cv, x0, y0, w, h):
    Rl = R['lamp']
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            t = 4 if (x - x0) + (y - y0) < 4 else 3 if x - x0 < w - 2 else 2
            cv.px(x, y, Rl[t])


@prop('lantern', 'Lantern post', 0.25, 0.1, ['town', 'route', 'cave'])
def p_lantern(rng):
    W, H = 50, 110; G = H - 2; cx = 25
    cv = Cv(W, H)
    Rw = R['wood']
    lay = Cv(W, H)
    for y in range(G - 92, G + 1):
        for x in range(cx - 3, cx + 3): lay.px(x, y, Rw[[3, 2, 2, 1, 1, 0][x - cx + 3]])
    lay.rect(cx - 4, G - 95, cx + 3, G - 93, lambda x, y: Rw[4 if y == G - 95 else 3])
    for x in range(cx + 3, cx + 18): lay.px(x, G - 86, Rw[3]); lay.px(x, G - 85, Rw[2]); lay.px(x, G - 84, Rw[1])
    lay.line(cx + 3, G - 74, cx + 12, G - 84, Rw[2], w=2)
    lay.rect(cx - 5, G - 3, cx + 4, G, lambda x, y: R['stone'][3 if y == G - 3 else 2])
    layer_out(cv, lay)
    lx = cx + 14
    lt = Cv(W, H)
    for y in range(G - 83, G - 78): lt.px(lx, y, R['iron'][2])
    lt.poly([(lx - 6, G - 72), (lx + .5, G - 79), (lx + 7, G - 72)], lambda x, y: R['iron'][3 if x < lx else 2])
    glow_box(lt, lx - 4, G - 71, 9, 12)
    for y in range(G - 72, G - 58):
        lt.px(lx - 5, y, R['iron'][2]); lt.px(lx + 5, y, R['iron'][1])
    for x in range(lx - 5, lx + 6): lt.px(x, G - 72, R['iron'][3]); lt.px(x, G - 59, R['iron'][1]); lt.px(x, G - 58, R['iron'][1])
    lt.px(lx, G - 57, R['iron'][1])
    lt.px(lx - 1, G - 66, R['white'][4]); lt.px(lx, G - 67, R['white'][4])
    layer_out(cv, lt)
    cv.fx.append(('glow', lx, G - 65))
    return cv, cx


@prop('streetlamp', 'Street lamp', 0.25, 0, ['town', 'mall'])
def p_streetlamp(rng):
    W, H = 40, 130; G = H - 2; cx = 20
    cv = Cv(W, H)
    Ri = R['iron']
    lay = Cv(W, H)
    # base
    for y in range(G - 12, G + 1):
        f = (y - (G - 12)) / 12
        hw = 3 + 4 * f * f + (1 if y > G - 3 else 0)
        for x in range(int(cx - hw), int(cx + hw) + 1):
            if abs(x + .5 - cx) <= hw + .01: lay.px(x, y, Ri[xt(x, cx - hw, cx + hw)])
    for y in range(G - 96, G - 11):
        for x in range(cx - 2, cx + 2): lay.px(x, y, Ri[[3, 2, 1, 0][x - cx + 2]])
    for ry in (G - 40, G - 94, G - 14):
        lay.rect(cx - 3, ry, cx + 2, ry + 1, lambda x, y: Ri[3 if x < cx else 1])
    # lamp housing
    lay.rect(cx - 5, G - 98, cx + 4, G - 96, lambda x, y: Ri[3 if x < cx else 1])
    glow_box(lay, cx - 5, G - 112, 10, 14)
    for y in range(G - 113, G - 97):
        lay.px(cx - 6, y, Ri[2]); lay.px(cx + 5, y, Ri[1])
    for y in range(G - 112, G - 98): lay.px(cx, y, Ri[2])
    lay.poly([(cx - 9, G - 113), (cx - 3, G - 120), (cx + 3, G - 120), (cx + 9, G - 113)], lambda x, y: Ri[3 if x < cx - 1 else 2 if x < cx + 3 else 1])
    lay.rect(cx - 1, G - 124, cx, G - 121, Ri[2]); lay.px(cx - 1, G - 124, Ri[3])
    for x in range(cx - 9, cx + 9): lay.px(x, G - 113, Ri[1])
    layer_out(cv, lay)
    cv.fx.append(('glow', cx, G - 105))
    return cv, cx

@prop('tent', 'Market tent', 1.4, 0.05, ['town', 'farm'])
def p_tent(rng):
    W, H = 130, 116; G = H - 2; cx = 65
    cv = Cv(W, H)
    ey = G - 62
    # interior + poles
    lay = Cv(W, H)
    for y in range(ey, G + 1):
        for x in range(cx - 46, cx + 46):
            t = 0 if y < ey + 8 else 1
            lay.px(x, y, R['lav'][t])
    # counter with goods
    for y in range(G - 18, G + 1):
        for x in range(cx - 38, cx + 38):
            t = 3 if y < G - 15 else 2 if (y - G) % 4 else 1
            if x > cx + 33: t = min(t, 1)
            lay.px(x, y, R['wood'][t])
    for i, col in enumerate(['orange', 'red', 'mint', 'gold', 'pink', 'red', 'orange']):
        bx = cx - 32 + i * 10
        ball(lay, bx, G - 21, 4, 3.5, R[col], .1)
        ball(lay, bx + 4, G - 22, 3, 3, R[col], .1)
    for px0 in (cx - 48, cx + 45):
        for y in range(ey - 2, G + 1):
            for x in range(px0, px0 + 4): lay.px(x, y, R['wood'][[3, 2, 1, 0][x - px0]])
    layer_out(cv, lay)
    # roof: radiating stripes
    rf = Cv(W, H)
    apex = (cx + .5, G - 106)
    poly = [apex, (cx - 56, ey), (cx + 57, ey)]
    for (x, y) in rf.polypts(poly):
        a = math.atan2(x + .5 - apex[0], y + .5 - apex[1])
        s = int((a + 1.6) / .19) % 2
        Rr = R['coral'] if s == 0 else R['cream']
        f = (y - apex[1]) / (ey - apex[1])
        t = 3 if x < cx - 6 else 2 if x < cx + 20 else 1
        if f < .15: t = min(4, t + 1)
        rf.px(x, y, Rr[t])
    # scalloped valance
    for x in range(cx - 56, cx + 57):
        u = x - (cx - 56)
        s = (u // 8) % 2
        Rr = R['coral'] if s == 0 else R['cream']
        k = u % 8
        dep = 7 + (2 if 2 <= k <= 5 else 1 if k in (1, 6) else 0)
        for d in range(dep):
            t = 3 if d < 2 else 2 if d < dep - 1 else 1
            if x > cx + 30: t = max(0, t - 1)
            rf.px(x, ey + d, Rr[t])
    rf.outline()
    cv.paste(rf)
    # pennant
    fl = Cv(W, H)
    for y in range(int(apex[1]) - 10, int(apex[1]) + 1): fl.px(cx, y, R['wood'][2])
    fl.poly([(cx + 1, apex[1] - 10), (cx + 10, apex[1] - 7), (cx + 1, apex[1] - 4)], lambda x, y: R['gold'][3 if y < apex[1] - 7 else 2])
    layer_out(cv, fl)
    return cv, cx


@prop('stall', 'Fruit stall', 1.5, 0, ['town', 'farm', 'mall'])
def p_stall(rng):
    W, H = 150, 124; G = H - 2; cx = 75
    cv = Cv(W, H)
    # back posts
    lay = Cv(W, H)
    for px0 in (cx - 58, cx + 55):
        for y in range(G - 82, G + 1):
            for x in range(px0, px0 + 4): lay.px(x, y, R['wood'][[3, 2, 1, 0][x - px0]])
    layer_out(cv, lay)
    # counter
    ct = Cv(W, H)
    x0, x1, top = cx - 54, cx + 54, G - 34
    for y in range(top, G + 1):
        for x in range(x0, x1 + 1):
            t = 2
            if (x - x0) % 9 == 0: t = 1
            elif (x - x0) % 9 == 1: t = 3
            if y < top + 4: t = 4 if y == top else 3
            if y == top + 4: t = 0
            if G - y < 2: t = 1
            if x1 - x < 2: t = min(t, 1)
            ct.px(x, y, R['plank'][t])
    layer_out(cv, ct)
    # crates of produce on the counter
    for i, col in enumerate(['red', 'orange', 'leafy', 'gold']):
        bx = x0 + 6 + i * 26
        cr = Cv(W, H)
        for y in range(top - 9, top + 1):
            for x in range(bx, bx + 22):
                t = 3 if y == top - 9 else 2 if (y - top) % 3 else 1
                if x > bx + 19: t = 1
                cr.px(x, y, R['wood'][t])
        layer_out(cv, cr)
        fr = Cv(W, H)
        for k in range(5):
            fx = bx + 3 + k * 4; fy = top - 11 - (k % 2)
            ball(fr, fx + .5, fy + .5, 3, 3, R[col], .1)
        for k in range(3):
            fx = bx + 5 + k * 5; fy = top - 15
            ball(fr, fx + .5, fy + .5, 3, 3, R[col], .15)
        fr.outline(); cv.paste(fr)
    # front posts
    lay = Cv(W, H)
    for px0 in (cx - 60, cx + 57):
        for y in range(G - 80, G + 1):
            for x in range(px0, px0 + 4): lay.px(x, y, R['wood'][[3, 2, 1, 0][x - px0]])
    layer_out(cv, lay)
    # canopy
    can = Cv(W, H)
    awning(can, cx - 66, cx + 65, G - 102, 20, R['mint'], R['white'], sw=10, slope=10)
    can.outline()
    cv.paste(can)
    # little blank price board hanging from the canopy
    hb = Cv(W, H)
    for y in range(G - 79, G - 75): hb.px(cx - 6, y, R['iron'][2]); hb.px(cx + 5, y, R['iron'][2])
    hb.rect(cx - 10, G - 75, cx + 9, G - 66, lambda x, y: R['cream'][4 if y == G - 75 else 3 if y < G - 72 else 2])
    hb.rect(cx - 6, G - 72, cx - 3, G - 69, R['red'][3]); hb.rect(cx + 1, G - 71, cx + 5, G - 71, R['dwood'][1]); hb.rect(cx + 1, G - 69, cx + 4, G - 69, R['dwood'][1])
    layer_out(cv, hb)
    return cv, cx


@prop('picnic', 'Picnic table', 0.9, 0, ['town', 'route'])
def p_picnic(rng):
    W, H = 104, 54; G = H - 2; cx = 52
    cv = Cv(W, H)
    Rw = R['plank']
    # A-frame legs under the table
    lay = Cv(W, H)
    for sx in (cx - 30, cx + 28):
        lay.line(sx - 6, G, sx + 1, G - 26, R['wood'][2], w=3)
        lay.line(sx + 8, G, sx + 1, G - 26, R['wood'][1], w=3)
    layer_out(cv, lay)
    # table top: visible top face + front edge
    tp = Cv(W, H)
    t0 = G - 34
    for y in range(t0, t0 + 8):
        f = (y - t0) / 8
        a = cx - 40 - 2 * f; b = cx + 40 + 2 * f
        for x in range(int(a), int(b) + 1):
            t = 3 if (y - t0) % 3 != 2 else 2
            if y == t0: t = 4
            if b - x < 3: t -= 1
            tp.px(x, y, Rw[t])
    for y in range(t0 + 8, t0 + 11):
        for x in range(cx - 42, cx + 43):
            tp.px(x, y, Rw[1] if y < t0 + 10 else Rw[0])
    layer_out(cv, tp)
    # front bench
    bn = Cv(W, H)
    b0 = G - 16
    for y in range(b0, b0 + 4):
        for x in range(cx - 44, cx + 45):
            bn.px(x, y, Rw[4 if y == b0 else 3 if y < b0 + 2 else 1])
    for y in range(b0 + 4, b0 + 6):
        for x in range(cx - 44, cx + 45): bn.px(x, y, Rw[0])
    for sx in (cx - 36, cx + 33):
        for y in range(b0 + 6, G + 1):
            for x in range(sx, sx + 4): bn.px(x, y, R['wood'][[3, 2, 1, 0][x - sx]])
    layer_out(cv, bn)
    # a checked cloth and a basket on the table
    for y in range(t0 + 1, t0 + 8):
        for x in range(cx - 16, cx + 6):
            ch = ((x - cx) // 3 + (y - t0) // 2) % 2
            cv.px(x, y, R['red'][3] if ch else R['white'][4])
    bk = Cv(W, H)
    for (x, y) in bk.ellpts(cx + 20, t0 + 1, 8, 4):
        if y >= t0 - 2: bk.px(x, y, R['hay'][3 if x < cx + 18 else 2])
    for (x, y) in bk.ellpts(cx + 20, t0 - 1, 6, 6):
        if y <= t0 - 2 and (x + .5 - cx - 20) ** 2 + (y + .5 - t0 + 1) ** 2 >= 16: bk.px(x, y, R['hay'][1])
    layer_out(cv, bk)
    return cv, cx


@prop('campfire', 'Campfire', 0.5, 0.3, ['route', 'cave'])
def p_campfire(rng):
    W, H = 56, 48; G = H - 2; cx = 28
    cv = Cv(W, H)
    # back stones
    stones = [(a, math.cos(a) * 17, math.sin(a) * 5.5) for a in [i * 2 * math.pi / 10 + .2 for i in range(10)]]
    for (a, dx, dy) in sorted(stones, key=lambda s: s[2]):
        if dy < 0:
            lay = Cv(W, H); ball(lay, cx + dx, G - 6 + dy, 4.2, 3.4, R['stone'], .15); layer_out(cv, lay)
    # logs
    for (x0, y0, x1, y1) in ((cx - 12, G - 3, cx + 9, G - 10), (cx + 12, G - 3, cx - 9, G - 10)):
        lay = Cv(W, H)
        lay.line(x0, y0, x1, y1, R['bark'][2], w=4)
        lay.line(x0, y0 - 1, x1, y1 - 1, R['bark'][3], w=1)
        layer_out(cv, lay)
    # flame: three tongues, each layered red > orange > yellow > white
    fl = Cv(W, H)
    for (dx, h, hw, lean) in ((-6, 16, 5.5, -4), (6, 14, 5, 4), (0, 25, 7, 1)):
        for (col, k) in ((R['red'], 1.0), (R['orange'], .78), (R['yellow'], .52), (R['white'], .26)):
            hh = h * (k ** .7); ww = hw * k
            for y in range(G - 5 - int(hh) - 1, G - 3):
                f = min(1.0, max(0.0, (G - 4 - y) / hh))
                w = ww * math.sin(min(1.0, f * 2.2 + .25) * math.pi * .5) * (1 - f) ** .75
                c = cx + dx + lean * f * f
                for x in range(int(c - w) - 1, int(c + w) + 2):
                    if abs(x + .5 - c) <= w:
                        fl.px(x, y, col[3] if x + .5 < c else col[2])
    fl.outline(col=mix(R['red'][0], OL, .5))
    cv.paste(fl)
    # front stones
    for (a, dx, dy) in sorted(stones, key=lambda s: s[2]):
        if dy >= 0:
            lay = Cv(W, H); ball(lay, cx + dx, G - 6 + dy, 4.2, 3.4, R['stone'], .15); layer_out(cv, lay)
    # embers
    for (ex, ey) in ((cx - 10, G - 30), (cx + 9, G - 36), (cx - 3, G - 40)):
        cv.px(ex, ey, R['yellow'][4])
    cv.fx.append(('fire', cx, G - 12))
    return cv, cx


@prop('arch', 'Town gate', 1.8, 0, ['town'])
def p_arch(rng):
    W, H = 190, 164; G = H - 2; cx = 95
    cv = Cv(W, H)
    Rs = R['stone']
    # pillars
    for px0 in (cx - 78, cx + 54):
        lay = Cv(W, H)
        stone_band(lay, px0, px0 + 23, G - 100, G, Rs, bw=8, bh=6)
        lay.rect(px0 - 3, G - 7, px0 + 26, G, lambda x, y: Rs[3 if y == G - 7 else 2 if x < px0 + 23 else 1])
        lay.rect(px0 - 2, G - 104, px0 + 25, G - 100, lambda x, y: Rs[4 if y == G - 104 else 3 if x < px0 + 22 else 1])
        layer_out(cv, lay)
        # planter at the foot
        pl = Cv(W, H)
        blob(pl, px0 + 12 + (-20 if px0 < cx else 20), G - 10, 10, 9, R['leaf'], rng, cell=5, sep=False)
        layer_out(cv, pl)
    # wooden beam with curved brackets
    bm = Cv(W, H)
    for y in range(G - 116, G - 102):
        for x in range(cx - 88, cx + 89):
            t = 2
            if y < G - 113: t = 3 if y > G - 116 else 4
            if y >= G - 104: t = 1
            if x > cx + 84: t = max(0, t - 1)
            if x < cx - 85: t = min(4, t + 1)
            bm.px(x, y, R['wood'][t])
    for side in (-1, 1):
        for y in range(G - 102, G - 86):
            f = (y - (G - 102)) / 16
            w = int(26 * (1 - f) ** 1.6)
            for k in range(w):
                x = cx + side * (54 - k) if side > 0 else cx - 55 + k
                x = (cx + 54 - k) if side > 0 else (cx - 55 + k)
                bm.px(x, y, R['wood'][2 if side < 0 else 1] if k > 1 else R['wood'][0])
    layer_out(cv, bm)
    # little roof on top of the beam
    rf = Cv(W, H)
    tile_roof(rf, G - 140, G - 116, cx - 64, cx + 64, cx - 94, cx + 94, R['teal'], tw=8, th=6)
    rf.outline(); cv.paste(rf)
    # round emblem with a leaf (no text)
    em = Cv(W, H)
    ex, ey = cx, G - 110
    ball(em, ex, ey, 10, 10, R['gold'], .1)
    for (x, y) in em.ellpts(ex, ey, 7, 7):
        em.px(x, y, R['cream'][3])
    for (x, y) in em.polypts([(ex - 4, ey + 4), (ex - 3, ey - 2), (ex + 1, ey - 5), (ex + 5, ey - 5), (ex + 4, ey), (ex, ey + 3)]):
        em.px(x, y, R['leaf'][3 if x + y < ex + ey else 2])
    em.line(ex - 4, ey + 4, ex + 3, ey - 3, R['leaf'][1])
    layer_out(cv, em)
    # hanging lanterns under the beam
    for lx in (cx - 40, cx + 40):
        lt = Cv(W, H)
        for y in range(G - 102, G - 96): lt.px(lx, y, R['iron'][2])
        glow_box(lt, lx - 3, G - 96, 7, 9)
        lt.rect(lx - 4, G - 97, lx + 4, G - 97, R['iron'][2]); lt.rect(lx - 4, G - 87, lx + 4, G - 87, R['iron'][1])
        layer_out(cv, lt)
        cv.fx.append(('glow', lx, G - 92))
    return cv, cx


# ----------------------------------------------------------------------------- water and junk
@prop('coral', 'Coral', 0.4, 0.3, ['water'])
def p_coral(rng):
    W, H = 76, 76; G = H - 2; cx = 38
    cv = Cv(W, H)
    pts = set()
    tips = []

    def grow(x, y, ang, L, r, depth):
        nx_ = x + math.sin(ang) * L; ny_ = y - math.cos(ang) * L
        pts.update(disc_path([(x, y), (nx_, ny_)], lambda t: r - t * .6))
        if depth == 0 or L < 6:
            tips.append((nx_, ny_, r))
            return
        for da in (-.5 - rng.uniform(0, .25), .45 + rng.uniform(0, .25)):
            grow(nx_, ny_, ang + da, L * rng.uniform(.62, .78), max(1.6, r * .78), depth - 1)
    grow(cx, G, 0, 16, 4.2, 3)
    grow(cx - 4, G, -.7, 13, 3.4, 2)
    grow(cx + 4, G, .75, 12, 3.4, 2)
    for (tx, ty, r) in tips:
        for (x, y) in Cv(1, 1).ellpts(tx, ty, r + .8, r + .8): pts.add((x, y))
    pts = [p for p in pts if p[1] <= G]
    edge_light(cv, pts, R['pink'])
    for (tx, ty, r) in tips:
        cv.px(int(tx) - 1, int(ty) - 1, R['pink'][4])
    # polyp dots
    for (x, y) in pts:
        if (x * 7 + y * 13) % 29 == 0 and cv.get(x, y) == R['pink'][2]:
            cv.px(x, y, R['pink'][1])
    cv.outline()
    rk = Cv(W, H)
    rp = [(x, y) for (x, y) in rk.ellpts(cx, G + 1, 14, 5) if y <= G]
    rock_mass(rk, rp, R['rock'], rng, cx, G - 1, 14, 4, cell=7, bias=.1)
    layer_out(cv, rk)
    return cv, cx


@prop('seaweed', 'Kelp', 0.25, 1.0, ['water'])
def p_seaweed(rng):
    W, H = 56, 100; G = H - 2; cx = 28
    cv = Cv(W, H)
    for (bx, h, ph, w0, col) in ((cx - 9, 78, 0.0, 6.5, ramp((70, 146, 112))), (cx + 9, 64, 2.0, 6.0, ramp((112, 166, 84))),
                                 (cx, 92, 1.0, 7.5, R['kelp'])):
        lay = Cv(W, H)
        for y in range(G - h, G + 1):
            f = (G - y) / h
            c = bx + 5 * math.sin(f * 7 + ph) * f
            w = w0 * (.55 + .7 * math.sin(f * math.pi) ** .6) * (1 - f * .35)
            w *= 1 + .15 * math.sin(f * 23 + ph)
            if f > .93: w *= (1 - f) / .07
            for x in range(int(c - w / 2) - 1, int(c + w / 2) + 2):
                u = (x + .5 - c) / max(.5, w / 2)
                if abs(u) <= 1:
                    t = 3 if u < -.4 else 2 if u < .45 else 1
                    if abs(u) < .14 and f < .9: t = 1
                    if math.sin(f * 7 + ph + .7) < -.6 and u > -.2: t = max(0, t - 1)
                    lay.px(x, y, col[t])
        # float bladders
        for f in (.35, .62):
            y = int(G - h * f); c = bx + 5 * math.sin(f * 7 + ph) * f
            ball(lay, c + 4, y, 2.2, 2.6, R['gold'], .1)
        layer_out(cv, lay)
    return cv, cx


def tire(cv, cx, by, rx, th, top_face=False):
    Rt = R['tire']
    lay = Cv(cv.w, cv.h)
    # side band (front of the torus)
    for y in range(by - th, by + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            nx = (x + .5 - cx) / rx
            if abs(nx) > 1: continue
            ry = (y - (by - th)) / th
            yy = y + int(round(3 * (1 - nx * nx) ** .5))
            t = 3 if ry < .3 else 2 if ry < .7 else 1
            if nx > .6: t = max(0, t - 1)
            if nx < -.7: t = min(4, t + 1)
            if (int(math.asin(max(-1, min(1, nx))) * rx) % 5 == 0) and .25 < ry < .8: t = max(0, t - 1)
            lay.px(x, yy, Rt[t])
    if top_face:
        ty = by - th
        for (x, y) in lay.ellpts(cx, ty + 2, rx, 6):
            nx = (x + .5 - cx) / rx; ny = (y + .5 - ty - 2) / 6
            lay.px(x, y, Rt[3 if ny < -.3 and nx < .4 else 2])
        for (x, y) in lay.ellpts(cx, ty + 2, rx * .5, 2.8):
            lay.px(x, y, OL if y < ty + 2 else Rt[0])
    layer_out(cv, lay)


@prop('tires', 'Tire stack', 0.6, 0, ['junk'])
def p_tires(rng):
    W, H = 56, 56; G = H - 2; cx = 28
    cv = Cv(W, H)
    tire(cv, cx, G - 3, 19, 10)
    tire(cv, cx + 1, G - 15, 18, 10)
    tire(cv, cx - 1, G - 27, 18, 10, top_face=True)
    return cv, cx


@prop('scrap', 'Scrap heap', 1.5, 0, ['junk'])
def p_scrap(rng):
    W, H = 130, 86; G = H - 2; cx = 65
    cv = Cv(W, H)
    # dirt/rust mound
    md = Cv(W, H)
    pts = [(x, y) for (x, y) in md.ellpts(cx, G + 6, 54, 30) if y <= G]
    for (x, y) in pts:
        nx = (x + .5 - cx) / 54; ny = (y + .5 - G - 6) / 30
        t = sph(nx, ny, .05)
        if (x * 5 + y * 3) % 17 == 0: t = max(0, t - 1)
        md.px(x, y, R['soil'][t])
    layer_out(cv, md)
    # metal sheet leaning back-left
    sh = Cv(W, H)
    for (x, y) in sh.polypts([(cx - 46, G - 14), (cx - 38, G - 50), (cx - 8, G - 44), (cx - 14, G - 10)]):
        u = (x - cx + 60 + (G - y) * .2) % 5
        t = 3 if u < 1.5 else 2 if u < 3.5 else 1
        if y < G - 45 + (x - cx + 38) * .2: t = 4
        if x > cx - 15: t = max(0, t - 1)
        sh.px(x, y, R['stone'][t])
    # a rust patch
    for (x, y) in sh.ellpts(cx - 30, G - 24, 5, 4):
        if sh.has(x, y): sh.px(x, y, R['rust'][2 if (x + y) % 3 else 1])
    for (rx_, ry_) in ((cx - 38, G - 44), (cx - 14, G - 39), (cx - 41, G - 18)):
        sh.px(rx_, ry_, R['lav'][0])
    layer_out(cv, sh)
    # wheel rim / cog
    cg = Cv(W, H)
    gx, gy = cx + 18, G - 46
    for (x, y) in cg.ellpts(gx, gy, 9, 9):
        a = math.atan2(y + .5 - gy, x + .5 - gx); r = math.hypot(x + .5 - gx, y + .5 - gy)
        if r > 7.2 and (int((a + math.pi) / (math.pi / 5)) % 2): continue
        if r < 2.5: continue
        cg.px(x, y, R['stone'][3 if (x - gx) + (y - gy) < 0 else 1])
    layer_out(cv, cg)
    # pipe across the back right
    pp = Cv(W, H)
    pp.line(cx + 4, G - 40, cx + 46, G - 22, R['teal'][2], w=6)
    pp.line(cx + 4, G - 42, cx + 46, G - 24, R['teal'][3], w=2)
    for (x, y) in pp.ellpts(cx + 4, G - 40, 3.2, 3.6): pp.px(x, y, R['teal'][0])
    layer_out(cv, pp)
    # rusty barrel lying
    br = Cv(W, H)
    for y in range(G - 34, G - 14):
        for x in range(cx - 2, cx + 26):
            ny = (y - (G - 34)) / 20
            t = 3 if ny < .3 else 2 if ny < .7 else 1
            if (x - cx) % 9 in (0, 1): t = max(0, t - 1)
            br.px(x, y, R['rust'][t])
    for (x, y) in br.ellpts(cx - 2, G - 24, 5, 10): br.px(x, y, R['rust'][1] if x > cx - 3 else R['rust'][2])
    for (x, y) in br.ellpts(cx - 2, G - 24, 3, 7): br.px(x, y, R['rust'][0])
    layer_out(cv, br)
    # tires
    tire(cv, cx - 30, G - 4, 15, 8, top_face=True)
    tire(cv, cx + 34, G - 2, 13, 7, top_face=True)
    # small crate in front
    crate(cv, cx - 10, G - 18, 18, 19, rng)
    # a few bolts / bits on the mound
    for (bx, by) in ((cx - 50, G - 2), (cx + 50, G - 4), (cx + 22, G - 2)):
        cv.px(bx, by, R['stone'][3]); cv.px(bx + 1, by, R['stone'][1])
    return cv, cx


# ----------------------------------------------------------------------------- ground decals
@prop('pond_lily', 'Lily pad', 0, 0.2, ['water'], flat=1)
def p_pond_lily(rng):
    W, H = 50, 30; G = H - 2; cx = 25
    cv = Cv(W, H)
    for (px_, py_, rx, ry, notch) in ((cx + 9, G - 12, 8, 4, 2.2), (cx - 3, G - 9, 15, 7, .6)):
        lay = Cv(W, H)
        for (x, y) in lay.ellpts(px_, py_, rx, ry):
            a = math.atan2((y + .5 - py_) / ry, (x + .5 - px_) / rx)
            if abs(a - notch) < .28: continue
            nx = (x + .5 - px_) / rx; ny = (y + .5 - py_) / ry
            t = 3 if ny < -.3 else 2 if ny < .5 else 1
            if nx > .7: t -= 1
            if abs(int(a * 3.2) - a * 3.2) < .08 and nx * nx + ny * ny > .1: t -= 1
            lay.px(x, y, R['leaf'][max(0, t)])
        layer_out(cv, lay)
    # flower
    fl = Cv(W, H)
    fx, fy = cx - 5, G - 12
    for (dx, dy, t) in ((-3, 0, 3), (3, 0, 2), (-2, -2, 4), (2, -2, 3), (0, -3, 4), (-1, 1, 2), (1, 1, 2), (0, -1, 3), (-1, -1, 3), (1, -1, 3), (0, 0, 2)):
        fl.px(fx + dx, fy + dy, R['pink'][t])
    fl.px(fx - 4, fy, R['pink'][2]); fl.px(fx + 4, fy, R['pink'][1])
    fl.px(fx, fy - 1, R['yellow'][4]); fl.px(fx, fy, R['yellow'][2])
    layer_out(cv, fl)
    return cv, cx


@prop('stepping', 'Stepping stones', 0, 0, ['route', 'water', 'town'], flat=1)
def p_stepping(rng):
    W, H = 84, 32; G = H - 2; cx = 42
    cv = Cv(W, H)
    for (dx, dy, rx, ry) in ((-24, -6, 10, 5.5), (0, -12, 11, 6), (24, -7, 10, 5.5)):
        lay = Cv(W, H)
        sx, sy = cx + dx, G + dy
        for (x, y) in lay.ellpts(sx, sy, rx, ry):
            nx = (x + .5 - sx) / rx; ny = (y + .5 - sy) / ry
            t = 3 if nx + ny < -.5 else 2 if nx + ny < .6 else 1
            if ny > .55: t = 1
            lay.px(x, y, R['stone'][t])
        # side lip
        for x in range(int(sx - rx) + 2, int(sx + rx) - 1):
            yb = max(y for (xx, y) in lay.ellpts(sx, sy, rx, ry) if xx == x)
            lay.px(x, yb + 1, R['stone'][0])
        lay.px(int(sx - rx * .4), int(sy - ry * .4), R['stone'][4]); lay.px(int(sx - rx * .4) + 1, int(sy - ry * .4), R['stone'][4])
        layer_out(cv, lay)
    return cv, cx


# ----------------------------------------------------------------------------- landmarks
@prop('statue', 'Creature statue', 0.8, 0, ['town'])
def p_statue(rng):
    W, H = 84, 124; G = H - 2; cx = 42
    cv = Cv(W, H)
    Rm = R['marble']
    # plinth
    pl = Cv(W, H)
    pl.rect(cx - 28, G - 6, cx + 27, G, lambda x, y: Rm[3 if y == G - 6 else 2 if x < cx + 24 else 1])
    for y in range(G - 38, G - 6):
        for x in range(cx - 23, cx + 23):
            t = xt(x, cx - 23, cx + 23, (.12, .7, .9))
            pl.px(x, y, Rm[t])
    pl.rect(cx - 17, G - 30, cx + 16, G - 14, Rm[1]); pl.rect(cx - 16, G - 29, cx + 15, G - 15, Rm[2])
    for x in range(cx - 16, cx + 16): pl.px(x, G - 29, Rm[3])
    pl.rect(cx - 27, G - 44, cx + 26, G - 38, lambda x, y: Rm[4 if y == G - 44 else 3 if y < G - 40 else 1])
    # little leaf emblem on the plaque
    for (x, y) in pl.polypts([(cx - 5, G - 18), (cx - 4, G - 24), (cx + 1, G - 27), (cx + 5, G - 26), (cx + 4, G - 21), (cx, G - 18)]):
        pl.px(x, y, R['gold'][3 if x + y < cx + G - 22 else 2])
    layer_out(cv, pl)
    # creature: chubby round body, round ears, curled tail, carved closed eyes
    cr = Cv(W, H)
    by = G - 64
    # tail behind
    tp = disc_path([(cx + 14, by + 14), (cx + 25, by + 8), (cx + 27, by - 4), (cx + 22, by - 10)], lambda t: 4.2 - t * .7)
    for (x, y) in tp:
        cr.px(x, y, Rm[2 if (x + y) % 2 else 1])
    edge_light(cr, list(tp), Rm, base=2)
    cr.outline()
    cv.paste(cr)
    bd = Cv(W, H)
    for (ex, ey) in ((cx - 13, by - 18), (cx + 13, by - 18)):
        ball(bd, ex, ey, 6.5, 7, Rm, .1)
    ball(bd, cx, by, 21, 19, Rm, .05)
    # inner ears
    for (ex, ey) in ((cx - 13, by - 18), (cx + 13, by - 18)):
        for (x, y) in bd.ellpts(ex, ey, 3, 3.5): bd.px(x, y, Rm[1])
    # feet
    for fx in (cx - 11, cx + 11):
        ball(bd, fx, by + 18, 6, 3.5, Rm, .2)
    # face: closed happy eyes, cheeks, tiny mouth
    for (ex, s) in ((cx - 8, 1), (cx + 8, 1)):
        bd.px(ex - 2, by - 3, Rm[0]); bd.px(ex - 1, by - 4, Rm[0]); bd.px(ex, by - 4, Rm[0]); bd.px(ex + 1, by - 4, Rm[0]); bd.px(ex + 2, by - 3, Rm[0])
    bd.px(cx - 1, by + 2, Rm[0]); bd.px(cx, by + 3, Rm[0]); bd.px(cx + 1, by + 2, Rm[0])
    for (ex) in (cx - 13, cx + 12):
        bd.px(ex, by + 1, Rm[3]); bd.px(ex + 1, by + 1, Rm[3])
    # arms
    for sx in (-1, 1):
        for (x, y) in bd.ellpts(cx + sx * 15, by + 7, 4, 5.5):
            bd.px(x, y, Rm[3] if sx < 0 else Rm[1])
        for (x, y) in bd.ellpts(cx + sx * 15, by + 7, 5, 6.5):
            if (x + .5 - cx - sx * 15) ** 2 / 16 + (y + .5 - by - 7) ** 2 / 30.25 > 1 and bd.get(x, y) in Rm[1:]:
                bd.px(x, y, Rm[0] if sx > 0 or y > by + 7 else Rm[1])
    # sprout on the head
    bd.line(cx, by - 18, cx, by - 23, R['leaf'][2])
    for (x, y) in bd.polypts([(cx, by - 23), (cx - 7, by - 27), (cx - 2, by - 22)]): bd.px(x, y, R['leaf'][3])
    for (x, y) in bd.polypts([(cx, by - 23), (cx + 7, by - 28), (cx + 2, by - 22)]): bd.px(x, y, R['leaf'][2])
    layer_out(cv, bd)
    # moss on the plinth corner
    for k in range(7):
        cv.px(cx - 26 + k, G - 37 + (k % 2), R['moss'][3])
    return cv, cx


@prop('windmill', 'Windmill', 1.6, 0, ['farm'])
def p_windmill(rng):
    return windmill_draw(True, True), 70


WM_W, WM_H, WM_CX, WM_HY = 140, 210, 70, 210 - 2 - 138      # canvas, base x, hub y


def windmill_draw(tower=True, sails=True):
    W, H = WM_W, WM_H; G = H - 2; cx = WM_CX
    cv = Cv(W, H)
    hy = WM_HY            # hub height
    cv.fx.append(('spin', cx, hy))
    if not tower:
        return windmill_sails(cv, cx, hy)
    cv.door = cx
    # tower
    tw = Cv(W, H)
    top = G - 132
    for y in range(top, G + 1):
        f = (y - top) / (G - top)
        hw = 16 + 10 * f
        for x in range(int(cx - hw), int(cx + hw) + 1):
            if abs(x + .5 - cx) > hw: continue
            t = xt(x, cx - hw, cx + hw)
            if (y - top) % 7 == 6: t = max(0, t - 1)
            elif (y - top) % 7 == 0 and t < 4: t += 0
            tw.px(x, y, R['cream'][t])
    stone_band(tw, cx - 28, cx + 28, G - 8, G, R['stone'], bw=8, bh=4)
    layer_out(cv, tw)
    door(cv, cx, G - 9, 18, 30, Rw=R['coral'], Rfr=R['dwood'])
    window(cv, cx - 6, G - 86, 12, 14, Rf=R['wood'], glow=True, sill=True)
    window(cv, cx - 5, G - 58, 10, 11, Rf=R['wood'], sill=True)
    # cap roof
    cp = Cv(W, H)
    shingles(cp, [(cx, G - 168), (cx - 24, G - 130), (cx + 25, G - 130)], R['coral'], tw=6, th=4)
    for x in range(cx - 25, cx + 26): cp.px(x, G - 130, R['coral'][0]); cp.px(x, G - 129, R['dwood'][1])
    cp.rect(cx - 1, G - 173, cx, G - 168, R['gold'][3])
    layer_out(cv, cp)
    if sails:
        windmill_sails(cv, cx, hy)
    return cv


def windmill_sails(cv, cx, hy):
    W, H = cv.w, cv.h
    # sails: four lattice blades in an X
    sl = Cv(W, H)
    for ang in (math.pi / 4, 3 * math.pi / 4, 5 * math.pi / 4, 7 * math.pi / 4):
        ux, uy = math.cos(ang), math.sin(ang)
        px_, py_ = -uy, ux
        L = 62; w = 14
        # spar
        sl.line(cx + ux * 4, hy + uy * 4, cx + ux * L, hy + uy * L, R['dwood'][2], w=2)
        poly = [(cx + ux * 12 + px_ * .5, hy + uy * 12 + py_ * .5), (cx + ux * L + px_ * .5, hy + uy * L + py_ * .5),
                (cx + ux * L + px_ * w, hy + uy * L + py_ * w), (cx + ux * 12 + px_ * w, hy + uy * 12 + py_ * w)]
        for (x, y) in sl.polypts(poly):
            k = (x + .5 - cx) * ux + (y + .5 - hy) * uy
            j = (x + .5 - cx) * px_ + (y + .5 - hy) * py_
            lat = ((k - 12) % 8 < 1.3) or j < 2 or j > w - 1.6 or abs(j - w / 2) < .7
            if lat:
                c = R['wood'][3 if j < 2 else 1 if j > w - 1.6 else 2]
            else:
                c = R['cream'][3 if uy < 0 else 2]
            sl.px(x, y, c)
    sl.outline()
    cv.paste(sl)
    # hub
    hb = Cv(W, H)
    ball(hb, cx + .5, hy + .5, 6, 6, R['dwood'], .1)
    hb.px(cx - 1, hy - 1, R['gold'][4])
    layer_out(cv, hb)
    return cv


# ============================================================================= VARIANTS AND NEW PROPS
# group: base prop a variant belongs to (scenes pick randomly within a group)
# solid: blocking radius in metres; box: [width_m, depth_m] footprint for buildings
def vprop(key, name, shadow, sway, tags, flat=0, group=None, solid=0, box=None, posts=None):
    def deco(fn):
        PROPS[key] = dict(fn=fn, name=name, shadow=shadow, sway=sway, tags=tags, flat=flat,
                          group=group or key, solid=solid, box=box, posts=posts)
        return fn
    return deco


def post(cv, x0, y0, y1, Rw, w=5):
    for y in range(y0, y1 + 1):
        for x in range(x0, x0 + w):
            cv.px(x, y, Rw[xt(x, x0, x0 + w)])


def tiny_flower(cv, x, y, Rf, center=None):
    lay = Cv(cv.w, cv.h)
    for (a, b, t) in ((0, -1, 4), (-1, 0, 3), (1, 0, 2), (0, 1, 1)):
        lay.px(x + a, y + b, Rf[t])
    lay.px(x, y, center or R['yellow'][4])
    layer_out(cv, lay)


def oak_tree(rng, W, H, tpts, blobs, order, pal, cell=8, bump=.05):
    """trunk points (x, dy from ground); pal = ramp or list of ramps indexed by blob"""
    G = H - 2; cx = W // 2
    cv = Cv(W, H)
    tr = Cv(W, H)
    trunk(tr, [(x, G + dy) for (x, dy) in tpts], R['bark'], rng)
    tr.outline(); cv.paste(tr)
    fol = Cv(W, H)
    for i in order:
        bx, by, rx, ry, b = blobs[i]
        Rl = pal[i % len(pal)] if isinstance(pal[0], list) else pal
        blob(fol, bx, by, rx, ry, Rl, rng, cell=cell, bias=b, bump=bump)
    fol.outline(); cv.paste(fol)
    return cv, cx


# ----------------------------------------------------------------------------- tree variants
@vprop('tree_oak_b', 'Spreading oak', 1.4, 0.35, ['route', 'town'], group='tree_oak', solid=0.45)
def p_tree_oak_b(rng):
    W, H = 184, 152; cx = 92
    tp = [(cx - 15, 1), (cx - 9, -6), (cx - 7, -44), (cx - 30, -70), (cx - 24, -74), (cx - 1, -54), (cx + 3, -60),
          (cx + 24, -78), (cx + 30, -74), (cx + 8, -48), (cx + 9, -6), (cx + 16, 1)]
    blobs = [(cx, 44, 46, 24, 0), (cx - 46, 54, 30, 20, .02), (cx + 48, 52, 32, 21, -.04), (cx - 72, 66, 16, 13, .03),
             (cx + 74, 64, 16, 13, -.06), (cx - 22, 30, 26, 17, .06), (cx + 22, 30, 26, 17, .03),
             (cx - 32, 72, 30, 15, -.08), (cx + 30, 74, 30, 15, -.1), (cx, 68, 30, 15, -.06)]
    return oak_tree(rng, W, H, tp, blobs, [0, 5, 6, 1, 2, 3, 4, 7, 8, 9], R['oak'])


@vprop('tree_oak_autumn', 'Autumn oak', 1.3, 0.35, ['route', 'town'], group='tree_oak', solid=0.45)
def p_tree_oak_autumn(rng):
    W, H = 160, 164; cx = 80; G = H - 2
    tp = [(cx - 14, 1), (cx - 9, -6), (cx - 8, -50), (cx - 18, -76), (cx - 13, -78), (cx - 2, -58),
          (cx + 4, -80), (cx + 10, -78), (cx + 8, -50), (cx + 9, -6), (cx + 15, 1)]
    blobs = [(cx + 2, 50, 50, 34, 0), (cx - 46, 76, 26, 22, 0), (cx + 44, 70, 28, 24, -.05), (cx - 28, 34, 30, 24, .05),
             (cx + 30, 38, 30, 24, 0), (cx - 4, 22, 24, 18, .06), (cx - 18, 88, 30, 18, -.05), (cx + 24, 86, 28, 18, -.08),
             (cx - 54, 54, 16, 16, .05), (cx + 54, 56, 17, 17, -.05)]
    # one autumn ramp: rust-red shadows, orange body, gold light
    pal = [[(132, 58, 72), (196, 86, 56), (230, 136, 56), (244, 186, 72), (252, 222, 128)]]
    cv, cx = oak_tree(rng, W, H, tp, blobs, [0, 5, 3, 4, 8, 9, 1, 2, 6, 7], pal)
    pal = pal + [ramp((238, 180, 64)), ramp((214, 96, 58))]
    # fallen leaves around the roots
    for _ in range(26):
        x = cx + int(rng.gauss(0, 22)); y = G - rng.randint(0, 2)
        if abs(x - cx) < 15 and y < G: continue
        c = rng.choice(pal)
        cv.px(x, y, c[3]); cv.px(x + 1, y, c[1])
    return cv, cx


@vprop('tree_oak_small', 'Oak sapling', 0.8, 0.45, ['route', 'town'], group='tree_oak', solid=0.3)
def p_tree_oak_small(rng):
    W, H = 104, 104; cx = 52
    tp = [(cx - 6, 1), (cx - 4, -5), (cx - 3, -32), (cx - 11, -48), (cx - 7, -50), (cx, -38), (cx + 5, -52),
          (cx + 9, -50), (cx + 3, -32), (cx + 4, -5), (cx + 7, 1)]
    blobs = [(cx - 1, 34, 31, 21, 0), (cx - 27, 46, 17, 14, 0), (cx + 26, 45, 18, 15, -.05), (cx - 17, 24, 18, 15, .05),
             (cx + 16, 23, 19, 15, 0), (cx, 15, 16, 12, .05), (cx - 13, 54, 18, 11, -.05), (cx + 13, 55, 18, 11, -.08)]
    return oak_tree(rng, W, H, tp, blobs, [0, 5, 3, 4, 1, 2, 6, 7], R['oak'], cell=7)


@vprop('tree_pine_b', 'Tall pine', 0.8, 0.3, ['route', 'town'], group='tree_pine', solid=0.35)
def p_tree_pine_b(rng):
    return pine_tree(rng, 84, 250, [(10, 36, 9), (22, 62, 13), (36, 88, 17), (52, 114, 21), (70, 140, 25),
                                    (90, 166, 28), (112, 194, 32), (136, 224, 36)], th=44, tw=(5, 4))


@vprop('tree_pine_small', 'Young pine', 0.5, 0.4, ['route', 'town'], group='tree_pine', solid=0.25)
def p_tree_pine_small(rng):
    return pine_tree(rng, 64, 120, [(8, 28, 9), (16, 48, 14), (30, 70, 20), (46, 94, 26)], th=30, tw=(4, 3))


@vprop('tree_birch_b', 'Birch pair', 0.7, 0.45, ['route'], group='tree_birch', solid=0.35)
def p_tree_birch_b(rng):
    W, H = 100, 172; G = H - 2; cx = 50
    cv = Cv(W, H)
    Rb = R['birch']
    tr = Cv(W, H)
    for pts, br in (([(cx - 11, G + 1), (cx - 9, G - 60), (cx - 13, G - 132), (cx - 9, G - 134), (cx - 5, G - 60), (cx - 3, G + 1)],
                     [(cx - 9, G - 86, cx - 24, G - 112), (cx - 10, G - 112, cx + 2, G - 140)]),
                    ([(cx + 2, G + 1), (cx + 4, G - 50), (cx + 12, G - 104), (cx + 16, G - 103), (cx + 9, G - 50), (cx + 8, G + 1)],
                     [(cx + 8, G - 74, cx + 24, G - 96)])):
        lay = Cv(W, H)
        trunk(lay, pts, Rb, rng, streaks=False)
        for (a, b, c, d) in br:
            lay.line(a, b, c, d, Rb[2], w=2)
        ys = [p[1] for p in pts]
        for y in range(min(ys), G):
            if rng.random() < .24:
                row = [x for x in range(cx - 20, cx + 20) if lay.has(x, y)]
                if len(row) > 3:
                    x0 = rng.choice(row[:-2])
                    for x in range(x0, x0 + rng.randint(2, 3)):
                        if lay.has(x, y): lay.px(x, y, OL if rng.random() < .5 else mix(OL, Rb[1], .3))
        lay.outline(); cv.paste(lay)
    fol = Cv(W, H)
    for (bx, by, rx, ry, b) in [(cx - 12, 34, 16, 20, .05), (cx + 12, 52, 17, 16, 0), (cx - 22, 64, 14, 14, 0),
                                (cx + 20, 78, 14, 12, -.05), (cx - 4, 80, 15, 13, -.03), (cx + 2, 20, 11, 12, .1),
                                (cx - 18, 98, 10, 9, -.05), (cx + 24, 100, 9, 8, -.05), (cx + 6, 106, 10, 8, -.06)]:
        blob(fol, bx, by, rx, ry, R['leafy'], rng, cell=6, bias=b, bump=.09)
    fol.outline(); cv.paste(fol)
    return cv, cx


@vprop('tree_fruit_b', 'Apple tree', 0.85, 0.35, ['farm', 'route', 'town'], group='tree_fruit', solid=0.35)
def p_tree_fruit_b(rng):
    cx = 62
    return fruit_tree(rng, 124, 120, [(cx - 7, 1), (cx - 5, -8), (cx - 4, -30), (cx - 20, -54), (cx - 14, -57), (cx, -40),
                                      (cx + 14, -58), (cx + 19, -55), (cx + 4, -30), (cx + 5, -8), (cx + 8, 1)],
                      [(cx, 38, 38, 24, 0), (cx - 30, 46, 22, 18, .02), (cx + 30, 44, 22, 18, -.06),
                       (cx - 6, 20, 26, 15, .06), (cx + 18, 24, 18, 14, 0), (cx - 18, 60, 22, 12, -.06), (cx + 16, 60, 22, 12, -.08)],
                      [(cx - 26, 38), (cx - 10, 28), (cx + 12, 34), (cx + 32, 46), (cx - 34, 54), (cx + 2, 50), (cx - 16, 62),
                       (cx + 22, 20), (cx - 2, 14), (cx + 40, 34), (cx - 40, 42), (cx + 18, 60), (cx - 22, 18)],
                      R['red'], Rl=R['oak'], fr_r=3.4)


@vprop('tree_blossom', 'Blossom tree', 0.9, 0.35, ['town', 'route'], solid=0.35)
def p_tree_blossom(rng):
    W, H = 132, 130; G = H - 2; cx = 66
    Rk = ramp((120, 86, 82))
    cv = Cv(W, H)
    tr = Cv(W, H)
    trunk(tr, [(cx - 8, G + 1), (cx - 5, G - 8), (cx - 6, G - 30), (cx - 24, G - 58), (cx - 18, G - 61), (cx - 1, G - 42),
               (cx + 4, G - 50), (cx + 20, G - 66), (cx + 25, G - 62), (cx + 5, G - 30), (cx + 6, G - 8), (cx + 9, G + 1)], Rk, rng)
    tr.outline(); cv.paste(tr)
    fol = Cv(W, H)
    Rp = ramp((244, 160, 192)); Rq = ramp((250, 196, 214))
    bl = [(cx, 38, 40, 24, 0, Rp), (cx - 34, 48, 22, 17, .02, Rq), (cx + 36, 46, 22, 17, -.05, Rp),
          (cx - 14, 22, 24, 15, .06, Rq), (cx + 18, 22, 22, 14, .04, Rp), (cx - 20, 62, 22, 12, -.06, Rp),
          (cx + 20, 62, 24, 12, -.08, Rq), (cx, 58, 20, 10, -.05, Rq)]
    for (bx, by, rx, ry, b, Rm) in bl:
        blob(fol, bx, by, rx, ry, Rm, rng, cell=6, bias=b, bump=.07)
    # petal speckles: bright florets on the lit side, deep pink in the shade
    for (x, y) in [(x, y) for y in range(H) for x in range(W) if fol.has(x, y)]:
        h = (x * 7 + y * 13) % 23
        if h == 0 and fol.get(x, y) in (Rp[3], Rq[3], Rp[2], Rq[2]):
            fol.px(x, y, R['white'][4])
        elif h == 11 and fol.get(x, y) in (Rp[1], Rq[1], Rp[2]):
            fol.px(x, y, Rp[0])
    fol.outline(); cv.paste(fol)
    for _ in range(22):
        x = cx + int(rng.gauss(0, 24)); y = G - rng.randint(0, 2)
        if abs(x - cx) < 12 and y < G: continue
        cv.px(x, y, Rq[3] if rng.random() < .6 else Rp[2])
    return cv, cx


# ----------------------------------------------------------------------------- bushes, grass, flowers
@vprop('bush_round_b', 'Big round bush', 0.55, 0.22, ['route', 'town'], group='bush_round', solid=0.6)
def p_bush_round_b(rng):
    W, H = 88, 64; G = H - 2; cx = 44
    cv = Cv(W, H)
    for (bx, by, rx, ry, b) in [(cx - 13, G - 24, 16, 16, .04), (cx + 13, G - 25, 17, 17, 0), (cx, G - 36, 15, 13, .06),
                                (cx - 22, G - 11, 14, 10, 0), (cx + 22, G - 11, 15, 10, -.04), (cx, G - 12, 27, 12, -.05)]:
        blob(cv, bx, by, rx, ry, R['leaf'], rng, cell=6, bias=b)
    cv.outline()
    return cv, cx


@vprop('bush_round_c', 'Low bush', 0.35, 0.28, ['route', 'town'], group='bush_round', solid=0.4)
def p_bush_round_c(rng):
    W, H = 66, 34; G = H - 2; cx = 33
    cv = Cv(W, H)
    for (bx, by, rx, ry, b) in [(cx - 13, G - 9, 12, 9, .04), (cx + 11, G - 8, 13, 8, 0), (cx - 1, G - 13, 11, 9, .07),
                                (cx, G - 6, 25, 6, -.06)]:
        blob(cv, bx, by, rx, ry, R['leaf'], rng, cell=5, bias=b)
    cv.outline()
    return cv, cx


@vprop('bush_flower', 'Flowering bush', 0.5, 0.25, ['route', 'town'], solid=0.55)
def p_bush_flower(rng):
    W, H = 80, 56; G = H - 2; cx = 40
    cv = Cv(W, H)
    for (bx, by, rx, ry, b) in [(cx - 12, G - 19, 15, 14, .04), (cx + 12, G - 18, 15, 14, 0), (cx, G - 27, 14, 11, .06),
                                (cx, G - 11, 26, 11, -.04)]:
        blob(cv, bx, by, rx, ry, R['oak'], rng, cell=6, bias=b)
    cv.outline()
    Rk = ramp((250, 168, 196))
    spots = []
    for _ in range(300):
        if len(spots) >= 15: break
        x = cx + rng.randint(-26, 26); y = G - rng.randint(5, 36)
        if not cv.has(x, y) or not cv.has(x, y - 2) or not cv.has(x - 2, y) or not cv.has(x + 2, y): continue
        if any(abs(x - a) + abs(y - b) < 6 for a, b in spots): continue
        spots.append((x, y))
    for i, (x, y) in enumerate(spots):
        tiny_flower(cv, x, y, R['white'] if i % 2 else Rk, R['yellow'][4] if i % 2 else R['gold'][3])
    return cv, cx


@vprop('tallgrass_b', 'Lush grass', 0.35, 1.0, ['route'], group='tallgrass')
def p_tallgrass_b(rng):
    W, H = 66, 40; G = H - 2; cx = 33
    cv = Cv(W, H)
    grass_tuft(cv, cx - 9, G, 12, 17, 26, 24, R['oak'], rng, width=4.4)
    grass_tuft(cv, cx + 10, G, 11, 15, 23, 22, R['leaf'], rng, width=4.4)
    grass_tuft(cv, cx, G, 15, 11, 19, 38, R['leafy'], rng, width=4.2)
    cv.outline()
    return cv, cx


@vprop('tallgrass_c', 'Tall reedy grass', 0.35, 1.0, ['route'], group='tallgrass')
def p_tallgrass_c(rng):
    W, H = 56, 52; G = H - 2; cx = 28
    cv = Cv(W, H)
    grass_tuft(cv, cx + 2, G, 14, 30, 42, 26, R['moss'], rng, width=4.6)
    grass_tuft(cv, cx - 6, G, 10, 22, 32, 20, R['oak'], rng, width=4.4)
    grass_tuft(cv, cx + 4, G, 13, 12, 20, 30, R['leaf'], rng, width=4.0)
    cv.outline()
    return cv, cx


@vprop('flowers_white', 'White flowers', 0, 0.6, ['route', 'town'], group='flowers')
def p_flowers_white(rng): return flower_patch(rng, 'white')


@vprop('flowers_purple', 'Purple flowers', 0, 0.6, ['route', 'town'], group='flowers')
def p_flowers_purple(rng): return flower_patch(rng, 'lilac')


@vprop('flowers_mixed', 'Mixed flowers', 0, 0.6, ['route', 'town', 'farm'], group='flowers')
def p_flowers_mixed(rng): return flower_patch(rng, ['red', 'white', 'yellow', 'lilac', 'pink', 'blue'])


# ----------------------------------------------------------------------------- stones
def rock_pile(rng, W, H, specs, Rr, moss=False):
    G = H - 2; cx = W // 2
    cv = Cv(W, H)
    for (dx, rx, ry) in specs:
        lay = Cv(W, H)
        pts = [(x, y) for (x, y) in lay.ellpts(cx + dx, G - ry + 2, rx, ry + 1) if y <= G]
        rock_mass(lay, pts, Rr, rng, cx + dx, G - ry + 2, rx, ry, cell=8, bias=.1)
        if moss:
            tops = {}
            for (x, y) in pts: tops[x] = min(tops.get(x, 999), y)
            for x, top in tops.items():
                if abs(x - cx - dx) < rx * .75:
                    d = 2 + int(1.5 + 1.5 * math.sin(x * .7 + dx)) + (1 if abs(x - cx - dx) < rx * .3 else 0)
                    for k in range(d):
                        lay.px(x, top + k, R['moss'][4 if k == 0 and x < cx + dx else 3 if k < 2 else 2 if k < d - 1 else 1])
        layer_out(cv, lay)
    return cv, cx


@vprop('rocks_b', 'Rock cluster', 0.35, 0, ['route', 'cave'], group='rocks')
def p_rocks_b(rng):
    return rock_pile(rng, 64, 34, ((-7, 13, 10), (13, 8, 6), (-22, 6, 4), (4, 5, 3)), R['rock'])


@vprop('rocks_mossy', 'Mossy rocks', 0.35, 0, ['route'], group='rocks')
def p_rocks_mossy(rng):
    return rock_pile(rng, 64, 32, ((-11, 11, 8), (11, 10, 7), (0, 6, 4), (-24, 5, 3)), R['stone'], moss=True)


def boulder_shape(rng, W, H, poly, Rr, moss_span=None, moss_depth=4, extra=(), bias=.08):
    G = H - 2; cx = W // 2
    cv = Cv(W, H)
    for (dx, rx, ry) in extra:        # small rocks behind
        lay = Cv(W, H)
        pts = [(x, y) for (x, y) in lay.ellpts(cx + dx, G - ry + 2, rx, ry + 1) if y <= G]
        rock_mass(lay, pts, Rr, rng, cx + dx, G - ry + 2, rx, ry, cell=8, bias=.1)
        layer_out(cv, lay)
    lay = Cv(W, H)
    poly = [(cx + a, G + b) for (a, b) in poly]
    pts = lay.polypts(poly)
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
    rx = (max(xs) - min(xs)) / 2; ry = (max(ys) - min(ys)) / 2
    rock_mass(lay, pts, Rr, rng, (max(xs) + min(xs)) / 2 - 3, (max(ys) + min(ys)) / 2 + 4, rx, ry, cell=18, bias=bias)
    if moss_span:
        tops = {}
        for (x, y) in pts: tops[x] = min(tops.get(x, 999), y)
        for x, top in tops.items():
            if cx + moss_span[0] < x < cx + moss_span[1]:
                e = min(x - cx - moss_span[0], cx + moss_span[1] - x)          # thin out toward the ends
                d = min(e // 2 + 2, moss_depth + int(3 * math.sin(x * .27)) + (5 if (x * 5) % 19 < 3 else 0) + int(2 * math.sin(x * .9)))
                for k in range(max(2, d)):
                    lay.px(x, top + k, R['moss'][4 if k == 0 and x < cx else 3 if k < 2 else 2 if k < d - 2 else 1])
    layer_out(cv, lay)
    return cv, cx


@vprop('boulder_b', 'Tall boulder', 0.9, 0, ['route', 'cave'], group='boulder', solid=1.0)
def p_boulder_b(rng):
    cv, cx = boulder_shape(rng, 104, 96, [(-34, 1), (-36, -24), (-26, -60), (-8, -84), (8, -86), (22, -70), (34, -40), (36, 1)],
                           R['rock'], extra=(), bias=-.06)
    G = 94
    lay = Cv(104, 96)
    pts = [(x, y) for (x, y) in lay.ellpts(cx + 36, G - 7, 13, 9) if y <= G]
    rock_mass(lay, pts, R['rock'], rng, cx + 36, G - 7, 13, 9, cell=9, bias=.1)
    layer_out(cv, lay)
    return cv, cx


@vprop('boulder_mossy', 'Mossy boulder', 1.0, 0, ['route'], group='boulder', solid=1.2)
def p_boulder_mossy(rng):
    cv, cx = boulder_shape(rng, 116, 80, [(-48, 1), (-44, -24), (-30, -46), (-8, -58), (16, -58), (36, -44), (46, -20), (48, 1)],
                           R['stone'], moss_span=(-34, 30), moss_depth=8, bias=0)
    G = 78
    for (gx, n) in ((cx - 40, 5), (cx + 38, 6)):
        lay = Cv(cv.w, cv.h)
        grass_tuft(lay, gx, G, n, 7, 13, 11, R['moss'], rng, width=3.2)
        layer_out(cv, lay)
    mush(cv, cx + 22, G, 8, 4, 4, 3, R['coral'], rng)
    return cv, cx


@vprop('mushroom_brown', 'Brown mushrooms', 0.2, 0, ['route'], group='mushroom')
def p_mushroom_brown(rng):
    W, H = 44, 30; G = H - 2; cx = 22
    cv = Cv(W, H)
    Rb = ramp((176, 112, 70))
    mush(cv, cx - 6, G, 17, 6, 8, 6, Rb, rng, spots=False)
    mush(cv, cx + 8, G, 12, 5, 6, 4, Rb, rng, spots=False)
    mush(cv, cx + 1, G, 8, 3, 3, 3, Rb, rng, spots=False)
    for k in range(-12, 14, 3):
        cv.px(cx + k, G, R['leaf'][2]); cv.px(cx + k + 1, G, R['leaf'][2]); cv.px(cx + k, G - 1, R['leaf'][3])
    cv.outline()
    return cv, cx


@vprop('mushroom_blue', 'Blue mushrooms', 0.2, 0, ['cave', 'route'], group='mushroom')
def p_mushroom_blue(rng):
    W, H = 42, 42; G = H - 2; cx = 21
    cv = Cv(W, H)
    Rb = ramp((84, 146, 236))
    mush(cv, cx - 5, G, 13, 7, 15, 4, Rb, rng, Rs=R['lav'])
    mush(cv, cx + 7, G, 10, 5, 9, 3, Rb, rng, Rs=R['lav'])
    mush(cv, cx - 14, G, 7, 4, 4, 2, Rb, rng, spots=False, Rs=R['lav'])
    for k in range(-14, 14, 3):
        cv.px(cx + k, G, R['moss'][1]); cv.px(cx + k + 1, G, R['moss'][2])
    cv.outline()
    return cv, cx


# ----------------------------------------------------------------------------- house variants
def chimney(cv, x0, x1, y0, y1, Rb, cap=None, brick=True):
    """chimney stack drawn on its own layer (call before the roof); returns the smoke point"""
    ch = Cv(cv.w, cv.h)
    for y in range(y0 + 4, y1):
        for x in range(x0, x1 + 1):
            t = 2
            if brick and ((y - y0) % 4 == 3 or ((x - x0 + (3 if ((y - y0) // 4) % 2 else 0)) % 6 == 0)): t = 1
            if not brick and ((y - y0) % 5 == 4 or (x - x0 + 2 * ((y - y0) // 5)) % 7 == 0): t = 1
            if x == x0: t = 3
            if x >= x1 - 1: t = 0
            ch.px(x, y, Rb[t])
    Rc = cap or R['stone']
    ch.rect(x0 - 2, y0, x1 + 2, y0 + 4, lambda x, y: Rc[3 if y == y0 else 2 if x < x1 else 1])
    ch.outline(); cv.paste(ch)
    return ((x0 + x1) // 2, y0 - 1)


def door_step(cv, dx, G, half, Rs=None):
    Rs = Rs or R['stone']
    cv.rect(dx - half, G - 5, dx + half - 1, G, lambda x, y: Rs[3 if y == G - 5 else 2 if x < dx + half - 4 else 1])
    for x in range(dx - half - 1, dx + half + 1): cv.px(x, G - 6, olc(Rs[1]))


def shutters(cv, x0, y0, w, h, Rs):
    for sx in (x0 - 7, x0 + w + 1):
        for y in range(y0, y0 + h):
            for x in range(sx, sx + 6):
                t = 3 if x == sx else 1 if x == sx + 5 else 2
                if (y - y0) % 4 == 3: t = max(0, t - 1)
                cv.px(x, y, Rs[t])
        cv.orect(sx - 1, y0 - 1, sx + 6, y0 + h, olc(Rs[1]))


def wall_lamp(cv, lx, ly):
    cv.rect(lx - 2, ly - 3, lx + 2, ly + 3, lambda x, y: R['lamp'][4 if x < lx else 3])
    cv.orect(lx - 3, ly - 4, lx + 3, ly + 4, olc(R['iron'][1]))
    cv.rect(lx - 3, ly - 6, lx + 3, ly - 5, R['iron'][2]); cv.px(lx, ly - 7, R['iron'][1])
    cv.fx.append(('glow', lx, ly))


@vprop('house_blue', 'Blue-roof cottage', 1.6, 0, ['town'], group='house', box=[3.4, 2.2])
def p_house_blue(rng):
    W, H = 170, 160; G = H - 2; cx = 85
    cv = Cv(W, H)
    x0, x1 = 32, 138
    cottage_walls(cv, x0, x1, 76, G, R['white'], rng)
    sm = chimney(cv, 50, 62, 18, 52, R['stone'], cap=R['dwood'], brick=False)
    tile_roof(cv, 34, 80, 48, 122, 20, 150, R['blue'], tw=9)
    shade_below(cv, x0, x1, 81, 3)
    dx = 62
    door(cv, dx, G - 6, 24, 48, Rw=R['coral'])
    door_step(cv, dx, G, 15)
    window(cv, 90, 94, 34, 22, Rf=R['sky'], box=['pink', 'white', 'lilac'], rng=rng)
    window(cv, 78, 48, 16, 14, sill=False, glow=True)
    wall_lamp(cv, dx + 19, 104)
    cv.outline()
    cv.fx.append(('smoke',) + sm); cv.door = dx
    return cv, cx


@vprop('house_green', 'Green-roof cottage', 1.6, 0, ['town'], group='house', box=[3.2, 2.2])
def p_house_green(rng):
    W, H = 170, 160; G = H - 2; cx = 85
    cv = Cv(W, H)
    x0, x1 = 34, 136
    ax, ay, xl, xr, yb = cx, 16, 14, 156, 84
    Rw = ramp((224, 212, 238)); Rg = ramp((108, 178, 98))
    for y in range(ay, G - 5):
        for x in range(x0, x1 + 1):
            ey = ay + abs(x + .5 - ax) * (yb - ay) / (ax - xl)
            if y + .5 >= ey:
                t = 3 if x == x0 else 1 if x >= x1 - 1 else 2
                if y < 84:
                    k = (x - cx) % 6
                    t = 3 if k == 1 else 1 if k == 0 else 2
                    cv.px(x, y, R['white'][t])
                else:
                    cv.px(x, y, Rw[t])
    Rp = R['dwood']
    for x in range(x0, x1 + 1):
        for k in range(4):
            cv.px(x, 84 + k, Rp[(0, 1, 2, 1)[k]])
    for px0 in (x0, x1 - 4):
        for y in range(88, G - 5):
            for x in range(px0, px0 + 5):
                cv.px(x, y, Rp[[3, 2, 2, 1, 0][x - px0]])
    stone_band(cv, x0 - 2, x1 + 2, G - 5, G, R['stone'])
    sm = chimney(cv, 44, 56, 26, 62, R['brick'])
    gable_roof(cv, ax, ay, xl, xr, yb, 19, Rg)
    for x in range(x0, x1 + 1):
        for y in range(ay, yb + 2):
            if cv.get(x, y) in Rg and cv.get(x, y + 1) not in Rg:
                darken(cv, x, y + 1, 2); darken(cv, x, y + 2, 1); darken(cv, x, y + 3, 1)
                break
    cv.rect(ax - 1, ay - 4, ax, ay, R['gold'][3]); cv.px(ax, ay - 1, R['gold'][1])
    window(cv, cx - 8, 50, 16, 18, sill=False, glow=True)
    dx = cx - 22
    door(cv, dx, G - 6, 26, 50, Rw=R['wood'])
    door_step(cv, dx, G, 16)
    window(cv, 98, 100, 22, 22, Rf=R['white'], box=['gold', 'pink', 'coral'], rng=rng)
    shutters(cv, 98, 100, 22, 22, Rg)
    cv.outline()
    cv.fx.append(('smoke',) + sm); cv.door = dx
    return cv, cx


@vprop('house_large', 'Two-storey house', 2.2, 0, ['town'], group='house', box=[5.4, 3.0])
def p_house_large(rng):
    W, H = 240, 214; G = H - 2; cx = 120
    cv = Cv(W, H)
    x0, x1 = 30, 210
    cottage_walls(cv, x0, x1, 74, G, R['peach'], rng)
    # floor band between storeys
    for x in range(x0, x1 + 1):
        for k, t in enumerate((1, 0, 2, 1)):
            cv.px(x, 138 + k, R['dwood'][t])
    sm = chimney(cv, 168, 182, 8, 44, R['brick'])
    tile_roof(cv, 22, 78, 60, 180, 16, 224, R['lilac'], tw=9)
    shade_below(cv, x0, x1, 79, 3)
    for wx in (82, 142):
        window(cv, wx, 40, 16, 14, sill=False, glow=True)
    boxes = (['pink', 'gold', 'coral'], ['lilac', 'pink', 'gold'], ['gold', 'coral', 'white'])
    for i, wx in enumerate((50, cx - 12, 166)):
        window(cv, wx, 94, 24, 26, box=boxes[i], rng=rng)
    for wx in (50, 166):
        window(cv, wx, 156, 24, 24, rng=rng)
    dx = cx
    door(cv, dx, G - 6, 28, 48, Rw=R['teal'])
    awning(cv, dx - 22, dx + 21, 145, 8, R['coral'], R['cream'], sw=7, slope=3)
    door_step(cv, dx, G, 18)
    wall_lamp(cv, dx + 26, 168)
    cv.outline()
    cv.fx.append(('smoke',) + sm); cv.door = dx
    return cv, cx


def thatch(cv, top, bot, xlt, xrt, xlb, xrb, Rh, r=10):
    for y in range(top, bot + 1):
        f = (y + .5 - top) / (bot + 1 - top)
        g = math.sin(f * math.pi / 2) ** .8                       # convex, bulging sides
        a = xlt + (xlb - xlt) * g; b = xrt + (xrb - xrt) * g
        if y - top < r:                                           # rounded ridge ends
            k = r - math.sqrt(max(0, r * r - (r - (y + .5 - top)) ** 2))
            a += k; b -= k
        for x in range(int(a), int(b) + 2):
            if x + .5 < a or x + .5 > b: continue
            u = (x + .5 - a) / max(1, b - a)
            v = y - top + .8 * math.sin(x * .13)                       # straw courses, nearly level
            c = int(v // 9); cy = v % 9
            t = 3 if u < .3 else 2 if u < .72 else 1
            h = (x * 37 + c * 11) % 6                                  # fine vertical straw streaks
            if h == 0: t -= 1
            elif h == 3 and t < 4: t += 1
            if cy >= 7.5: t -= 2 if (x + c) % 2 else 1                  # toothed lower edge of each course
            elif cy < 1: t = min(4, t + 1)
            if y - top < 7:                                       # ridge cap
                t = (3 if u < .3 else 2 if u < .7 else 1) + (1 if y - top < 2 else 0)
                if (x + (y - top)) % 6 == 0: t -= 1
                if y - top == 6: t = 0
            cv.px(x, y, Rh[max(0, min(4, t))])
    # ragged fringe along the eave
    for x in range(int(xlb) + 3, int(xrb) - 2):
        d = 1 + (x * 7) % 3 + (1 if (x * 13) % 5 == 0 else 0)
        for k in range(1, d + 1):
            cv.px(x, bot + k, Rh[1 if k < d else 0])


@vprop('house_cottage', 'Thatched cottage', 1.5, 0, ['town', 'farm'], group='house', box=[3.0, 2.2])
def p_house_cottage(rng):
    W, H = 170, 152; G = H - 2; cx = 85
    cv = Cv(W, H)
    x0, x1 = 38, 132
    cottage_walls(cv, x0, x1, 80, G, R['cream'], rng)
    stone_band(cv, x0 - 2, x1 + 2, G - 22, G, R['stone'], bw=10, bh=5)
    sm = chimney(cv, 104, 116, 14, 52, R['stone'], cap=R['stone'], brick=False)
    Rh = ramp((214, 172, 94))
    th = Cv(W, H)
    thatch(th, 28, 88, 52, 118, 22, 148, Rh)
    th.outline(); cv.paste(th)
    shade_below(cv, x0, x1, 93, 3)
    dx = 106
    door(cv, dx, G - 6, 24, 44, Rw=R['wood'])
    door_step(cv, dx, G, 14)
    window(cv, 50, 104, 24, 20, box=['pink', 'gold', 'white'], rng=rng)
    # eyebrow window in the thatch
    window(cv, cx - 10, 54, 16, 12, sill=False, glow=True)
    for x in range(cx - 13, cx + 9):
        k = abs(x + 2.5 - cx) / 11
        yy = 51 - int(4 * (1 - k * k))
        for d in range(3):
            cv.px(x, yy + d, Rh[3 - d] if d < 2 else Rh[0])
    cv.outline()
    cv.fx.append(('smoke',) + sm); cv.door = dx
    return cv, cx


# ----------------------------------------------------------------------------- fences, containers
RAIL = ramp((184, 136, 92))


def fence_post(cv, x0, G, h, Rw):
    lay = Cv(cv.w, cv.h)
    post(lay, x0, G - h + 2, G, Rw, w=5)
    lay.poly([(x0, G - h + 2.5), (x0 + 2.5, G - h), (x0 + 5, G - h + 2.5)], lambda x, y: Rw[4 if x < x0 + 2 else 2])
    for y in range(G - h + 6, G, 7):
        lay.px(x0 + 3, y, Rw[1])
    layer_out(cv, lay)


@vprop('fence_wood', 'Rail fence', 0.3, 0, ['route', 'farm', 'town'], box=[2.2, 0.25])
def p_fence_wood(rng):
    W, H = 84, 40; G = H - 2; cx = 42
    cv = Cv(W, H)
    Rw = R['wood']
    for px0 in (cx - 39, cx + 34):
        fence_post(cv, px0, G, 34, Rw)
    # two split rails, slightly sagging, in front of the end posts
    for (ry, sag) in ((G - 27, 1.4), (G - 14, 1.0)):
        lay = Cv(W, H)
        for x in range(cx - 40, cx + 40):
            u = (x - cx) / 40
            yo = ry + int(round(sag * (1 - u * u)))
            for k in range(4):
                t = (4, 3, 2, 1)[k]
                if (x * 5 + k * 3) % 13 == 0 and 0 < t < 4: t -= 1
                lay.px(x, yo + k, RAIL[t])
        layer_out(cv, lay)
    fence_post(cv, cx - 2, G, 32, Rw)
    for (px0, ry) in ((cx - 39, G - 26), (cx + 34, G - 26), (cx - 39, G - 13), (cx + 34, G - 13), (cx - 2, G - 25), (cx - 2, G - 12)):
        cv.px(px0 + 2, ry, R['iron'][1])
    for gx in (cx - 37, cx, cx + 36):
        for k in range(-3, 4):
            cv.px(gx + k, G - (1 if k % 2 else 0), R['moss'][3 if k < 0 else 2])
    return cv, cx


@vprop('fence_wood_post', 'Fence post', 0.15, 0, ['route', 'farm', 'town'], group='fence_wood', solid=0.15)
def p_fence_wood_post(rng):
    W, H = 20, 40; G = H - 2; cx = 10
    cv = Cv(W, H)
    fence_post(cv, cx - 2, G, 34, R['wood'])
    for k in range(-4, 5):
        cv.px(cx + k, G - (1 if k % 2 else 0), R['moss'][3 if k < 0 else 2])
    return cv, cx


@vprop('barrel_wood', 'Barrel', 0.45, 0, ['town', 'farm', 'junk'], group='crates', solid=0.4)
def p_barrel_wood(rng):
    W, H = 40, 44; G = H - 2; cx = 20
    cv = Cv(W, H)
    Rw = ramp((170, 112, 70)); Ri = R['iron']
    lay = Cv(W, H)
    top = G - 32
    for y in range(top, G + 1):
        f = (y - top) / (G - top)
        hw = 10.5 + 2.6 * math.sin(math.pi * f)
        for x in range(int(cx - hw) - 1, int(cx + hw) + 2):
            nx = (x + .5 - cx) / hw
            if abs(nx) > 1: continue
            t = 3 if nx < -.45 else 2 if nx < .35 else 1 if nx < .8 else 0
            st = math.asin(max(-1, min(1, nx))) * 10.5
            if int(st + 40) % 5 == 0 and t > 0: t -= 1
            R_ = Rw
            for hf in (.1, .3, .7, .9):
                if abs(f - hf) < .045: R_ = Ri
            lay.px(x, y + int(round(2 * math.sqrt(max(0, 1 - nx * nx)))) - 2, R_[t])
    for (x, y) in lay.ellpts(cx, top, 10.8, 3.6):
        nx = (x + .5 - cx) / 10.8; ny = (y + .5 - top) / 3.6
        r = nx * nx + ny * ny
        lay.px(x, y, Rw[1] if r > .62 else Rw[4] if (x - cx) % 4 == 0 and nx < .2 else Rw[3])
    layer_out(cv, lay)
    return cv, cx


def sack(cv, cx, G, w, h, Rs):
    lay = Cv(cv.w, cv.h)
    cy = G - h * .42; rx = w / 2; ry = h * .45
    for (x, y) in lay.ellpts(cx, cy, rx, ry):
        if y > G: continue
        nx = (x + .5 - cx) / rx; ny = (y + .5 - cy) / ry
        t = sph(nx * .95, ny * .95, .1)
        if (x * 3 + y * 5) % 7 == 0 and 0 < t: t -= 1
        lay.px(x, y, Rs[max(0, min(4, t))])
    for y in range(int(G - h * .4), G + 1):              # flat bottom bulge
        for x in range(int(cx - rx * .9), int(cx + rx * .9) + 1):
            if not lay.has(x, y):
                lay.px(x, y, Rs[1 if x > cx else 2])
    ny0 = int(cy - ry)
    for y in range(ny0 - 5, ny0 + 1):                     # gathered neck
        for x in range(cx - 3, cx + 3):
            lay.px(x, y, Rs[3 if x < cx - 1 else 2 if x < cx + 1 else 1])
    for (dx, dy) in ((-4, -6), (-3, -7), (2, -7), (3, -6), (0, -7), (-1, -8), (1, -8)):
        lay.px(cx + dx, ny0 + dy, Rs[3 if dx < 0 else 2])
    for x in range(cx - 4, cx + 4):
        lay.px(x, ny0 - 2, R['dwood'][2 if x < cx else 1])
    layer_out(cv, lay)


@vprop('sack', 'Grain sacks', 0.6, 0, ['farm', 'town'], group='crates', solid=0.5)
def p_sack(rng):
    W, H = 70, 44; G = H - 2; cx = 35
    cv = Cv(W, H)
    Rs = ramp((214, 184, 136))
    sack(cv, cx + 10, G - 2, 26, 32, Rs)
    sack(cv, cx - 12, G, 26, 30, Rs)
    sack(cv, cx + 16, G, 20, 22, ramp((200, 176, 140)))
    for (x, y) in ((cx - 26, G), (cx - 24, G - 1), (cx + 2, G), (cx + 28, G), (cx - 28, G - 1)):
        cv.px(x, y, R['hay'][3]); cv.px(x + 1, y, R['hay'][2])
    return cv, cx


# ----------------------------------------------------------------------------- cave variants
def stalag(cv, cx, G, hgt, hwm, ph, Rr):
    lay = Cv(cv.w, cv.h)
    top = G - hgt
    for y in range(top, G + 1):
        f = (y - top) / (G - top)
        hw = 2 + hwm * f ** 1.25 + 1.4 * math.sin(f * 26 + ph) * f + (3 * ((f - .9) / .1) if f > .9 else 0)
        off = 2.5 * math.sin(f * 4 + ph)
        for x in range(int(cx + off - hw) - 1, int(cx + off + hw) + 2):
            nx = (x + .5 - cx - off) / hw
            if abs(nx) > 1: continue
            t = 3 if nx < -.45 else 2 if nx < .25 else 1 if nx < .7 else 0
            band = (f * 26 + ph) % (2 * math.pi)
            if 4.4 < band < 5.2: t = max(0, t - 1)
            elif 3.6 < band < 4.4 and nx < .3: t = min(4, t + 1)
            if f < .06: t = min(4, t + 1)
            lay.px(x, y, Rr[t])
    lay.px(int(cx + 2.5 * math.sin(ph)) - 1, top + 3, R['white'][4])
    layer_out(cv, lay)


@vprop('stalagmite_b', 'Stalagmite cluster', 0.6, 0, ['cave'], group='stalagmite', solid=0.6)
def p_stalagmite_b(rng):
    W, H = 80, 90; G = H - 2; cx = 40
    cv = Cv(W, H)
    Rr = R['cave']
    stalag(cv, cx + 10, G, 76, 15, 1.3, Rr)
    stalag(cv, cx - 14, G, 52, 12, 2.6, Rr)
    stalag(cv, cx + 26, G, 26, 8, .4, Rr)
    for (dx, r) in ((-30, 3), (4, 2), (34, 2)):
        lay = Cv(W, H)
        ball(lay, cx + dx, G - r + 1, r + 1, r, Rr, .1)
        layer_out(cv, lay)
    return cv, cx


@vprop('crystal_pink', 'Pink crystals', 0.5, 0, ['cave'], group='crystal', solid=0.6)
def p_crystal_pink(rng):
    return crystal_cluster(rng, ramp((240, 128, 182)),
                           [(-12, 44, -.26, 8), (12, 30, .4, 7), (0, 54, .08, 9), (-24, 20, -.7, 5), (22, 18, .72, 5)],
                           ((-24, -36), (20, -46), (2, -64), (-14, -52)))


@vprop('crystal_purple', 'Purple crystals', 0.5, 0, ['cave'], group='crystal', solid=0.55)
def p_crystal_purple(rng):
    return crystal_cluster(rng, ramp((156, 104, 226)),
                           [(-8, 58, -.14, 9), (10, 42, .24, 8), (-20, 26, -.55, 6), (20, 22, .6, 5), (2, 24, .02, 6)],
                           ((-22, -48), (18, -50), (-6, -68), (12, -30)), W=70, H=78, srx=22)


# ----------------------------------------------------------------------------- town furniture
def paper_lantern(cv, x, y, Rc):
    lay = Cv(cv.w, cv.h)
    for (px_, py_) in lay.ellpts(x + .5, y + .5, 5, 6):
        nx = (px_ - x) / 5; ny = (py_ - y) / 6
        t = 4 if nx + ny < -.7 else 3 if nx < .35 else 2
        if (py_ - y) % 3 == 2 and abs(nx) < .9: t -= 1
        lay.px(px_, py_, Rc[t])
    lay.rect(x - 2, y - 7, x + 2, y - 6, R['iron'][2]); lay.rect(x - 2, y + 6, x + 2, y + 7, R['iron'][1])
    lay.px(x, y + 8, Rc[1]); lay.px(x, y + 9, Rc[1])
    layer_out(cv, lay)
    cv.fx.append(('glow', x, y))


@vprop('lantern_b', 'Paper lantern pole', 0.3, 0.12, ['town', 'route'], group='lantern', solid=0.3)
def p_lantern_b(rng):
    W, H = 80, 118; G = H - 2; cx = 40
    cv = Cv(W, H)
    Rw = R['wood']
    lay = Cv(W, H)
    post(lay, cx - 3, G - 98, G, Rw, w=6)
    lay.rect(cx - 30, G - 96, cx + 29, G - 93, lambda x, y: Rw[4 if y == G - 96 else 3 if y < G - 94 else 1])
    lay.line(cx - 3, G - 80, cx - 14, G - 93, Rw[2], w=2)
    lay.line(cx + 2, G - 80, cx + 13, G - 93, Rw[1], w=2)
    lay.rect(cx - 5, G - 3, cx + 4, G, lambda x, y: R['stone'][3 if y == G - 3 else 2])
    layer_out(cv, lay)
    # sagging string
    st = Cv(W, H)
    pts = []
    for x in range(cx - 28, cx + 28):
        u = (x - cx) / 28
        pts.append((x, G - 92 + int(round(10 * (1 - u * u)))))
    for (x, y) in pts: st.px(x, y, R['dwood'][1])
    layer_out(cv, st)
    for (dx, Rc) in ((-26, R['coral']), (-12, R['gold']), (12, R['orange']), (26, R['coral'])):
        y = dict(pts).get(cx + dx, G - 92) + 1
        for k in range(3): cv.px(cx + dx, y + k, R['dwood'][1])
        paper_lantern(cv, cx + dx, y + 10, Rc)
    return cv, cx


@vprop('bench_wood', 'Park bench', 0.7, 0, ['town', 'mall', 'route'], box=[1.6, 0.6])
def p_bench_wood(rng):
    W, H = 66, 44; G = H - 2; cx = 33
    cv = Cv(W, H)
    Rw = R['plank']; Ri = R['iron']
    # back slats
    for sy in (G - 32, G - 26):
        lay = Cv(W, H)
        for y in range(sy, sy + 4):
            for x in range(cx - 27, cx + 27):
                t = (4, 3, 2, 0)[y - sy]
                if x > cx + 24: t = max(0, t - 1)
                lay.px(x, y, Rw[t])
        layer_out(cv, lay)
    # iron end frames
    for fx in (cx - 25, cx + 22):
        lay = Cv(W, H)
        post(lay, fx, G - 34, G, Ri, w=3)
        lay.line(fx - 2, G - 14, fx + 5, G - 14, Ri[2], w=2)
        lay.rect(fx - 3, G - 1, fx + 5, G, Ri[1])
        layer_out(cv, lay)
    # seat: top face then front edge
    lay = Cv(W, H)
    for y in range(G - 18, G - 12):
        f = (y - (G - 18)) / 6
        a = cx - 28 - f; b = cx + 27 + f
        for x in range(int(a), int(b) + 1):
            t = 3 if (y - (G - 18)) % 3 != 2 else 2
            if y == G - 18: t = 4
            if b - x < 3: t -= 1
            lay.px(x, y, Rw[t])
    for y in range(G - 12, G - 9):
        for x in range(cx - 29, cx + 29): lay.px(x, y, Rw[1] if y < G - 10 else Rw[0])
    layer_out(cv, lay)
    for fx in (cx - 25, cx + 22):
        lay = Cv(W, H)
        post(lay, fx, G - 9, G, Ri, w=3)
        layer_out(cv, lay)
    return cv, cx


@vprop('flowerpot', 'Flower pot', 0.25, 0.3, ['town', 'mall'], solid=0.25)
def p_flowerpot(rng):
    W, H = 34, 40; G = H - 2; cx = 17
    cv = Cv(W, H)
    pl = Cv(W, H)
    blob(pl, cx, G - 20, 10, 8, R['leaf'], rng, cell=5, sep=False)
    pl.outline(); cv.paste(pl)
    for (dx, dy, c) in ((-6, -24, 'pink'), (2, -27, 'gold'), (7, -21, 'pink'), (-2, -19, 'white'), (-8, -17, 'gold')):
        tiny_flower(cv, cx + dx, G + dy, R[c], R['yellow'][4] if c != 'gold' else R['coral'][3])
    Rp = R['brick']
    lay = Cv(W, H)
    for y in range(G - 13, G + 1):
        f = (y - (G - 13)) / 13
        hw = 9 - 2.5 * f
        for x in range(int(cx - hw), int(cx + hw) + 1):
            if abs(x + .5 - cx) > hw: continue
            lay.px(x, y, Rp[xt(x, cx - hw, cx + hw)])
    lay.rect(cx - 10, G - 15, cx + 9, G - 12, lambda x, y: Rp[4 if y == G - 15 else 3 if x < cx + 6 else 1])
    for x in range(cx - 8, cx + 8): lay.px(x, G - 16, R['soil'][0] if not cv.has(x, G - 16) else None)
    layer_out(cv, lay)
    return cv, cx


@vprop('mailbox_red', 'Mailbox', 0.25, 0, ['town'], solid=0.25)
def p_mailbox_red(rng):
    W, H = 34, 50; G = H - 2; cx = 17
    cv = Cv(W, H)
    lay = Cv(W, H)
    post(lay, cx - 2, G - 28, G, R['wood'], w=5)
    layer_out(cv, lay)
    Rr = R['red']
    bx = Cv(W, H)
    x0, x1, yb, yt = cx - 12, cx + 11, G - 28, G - 38
    for (x, y) in bx.ellpts(cx, yt + .5, 12, 7):
        if y <= yt:
            nx = (x + .5 - cx) / 12; ny = (y + .5 - yt) / 7
            bx.px(x, y, Rr[min(4, sph(nx * .6, ny, .15) + 1)])
    for y in range(yt, yb + 1):
        for x in range(x0, x1 + 1):
            t = 3 if y < yt + 3 else 2 if y < yb - 2 else 1
            bx.px(x, y, Rr[t])
    # door on the front end
    for y in range(yt - 6, yb + 1):
        for x in range(x0, x0 + 4):
            if bx.has(x, y): bx.px(x, y, Rr[4] if x == x0 else Rr[3 if y < yt else 2])
    for y in range(yt - 5, yb): bx.px(x0 + 4, y, Rr[0]) if bx.has(x0 + 4, y) else None
    bx.rect(x0 + 1, yt + 1, x0 + 2, yt + 2, R['iron'][3])
    layer_out(cv, bx)
    fl = Cv(W, H)
    for y in range(yt - 8, yt + 4): fl.px(x1 + 2, y, R['iron'][2])
    fl.rect(x1 + 3, yt - 8, x1 + 7, yt - 5, lambda x, y: R['gold'][3 if y < yt - 6 else 2])
    layer_out(cv, fl)
    return cv, cx


# ----------------------------------------------------------------------------- desert and water
RCACT = ramp((96, 168, 100))


def cactus_col(cv, cx, ytop, ybot, hw, Rc, spines=True):
    lay = Cv(cv.w, cv.h)
    for y in range(int(ytop - hw), ybot + 1):
        for x in range(int(cx - hw) - 1, int(cx + hw) + 2):
            nx = (x + .5 - cx) / hw
            if abs(nx) > 1: continue
            if y < ytop and ((y + .5 - ytop) / hw) ** 2 + nx * nx > 1: continue
            t = 3 if nx < -.4 else 2 if nx < .3 else 1 if nx < .75 else 0
            if y < ytop - hw * .4 and nx < .3: t = min(4, t + 1)
            if any(abs(nx - r) < .1 for r in (-.55, 0, .55)) and t > 0: t -= 1
            lay.px(x, y, Rc[t])
            if spines and t > 0:
                for ri, r in enumerate((-.55, 0, .55)):
                    if abs(nx - r) < .1 and (y + ri * 3) % 7 == 0:
                        lay.px(x, y, R['cream'][4] if ri == 0 else R['cream'][3] if ri == 1 else R['cream'][2])
    return lay


@vprop('cactus_tall', 'Saguaro cactus', 0.4, 0, ['desert', 'canyon'], group='cactus', solid=0.35)
def p_cactus_tall(rng):
    W, H = 64, 112; G = H - 2; cx = 32
    cv = Cv(W, H)
    # arms: horizontal elbow then upright, behind the trunk
    for (side, ey, ax, at) in ((-1, G - 42, cx - 19, G - 70), (1, G - 56, cx + 18, G - 84)):
        el = Cv(W, H)
        for y in range(ey - 5, ey + 5):
            for x in range(min(cx, ax), max(cx, ax) + 1):
                ny = (y + .5 - ey) / 5
                el.px(x, y, RCACT[3 if ny < -.4 else 2 if ny < .4 else 1])
        up = cactus_col(cv, ax, at, ey + 2, 5, RCACT)
        for (x, y) in ((x, y) for y in range(H) for x in range(W) if el.has(x, y)):
            if not up.has(x, y): up.px(x, y, el.get(x, y))
        layer_out(cv, up)
    tr = cactus_col(cv, cx, G - 88, G, 7.5, RCACT)
    layer_out(cv, tr)
    tiny_flower(cv, cx - 1, G - 96, R['pink'])
    for k in range(-9, 10, 3):
        cv.px(cx + k, G, R['hay'][2]); cv.px(cx + k + 1, G, R['hay'][1])
    return cv, cx


@vprop('cactus_round', 'Barrel cactus', 0.35, 0, ['desert', 'canyon'], group='cactus', solid=0.35)
def p_cactus_round(rng):
    W, H = 48, 36; G = H - 2; cx = 24
    cv = Cv(W, H)
    for (dx, rx, ry, fl) in ((14, 7, 7, False), (-3, 13, 13, True)):
        lay = Cv(W, H)
        ccx, ccy = cx + dx, G - ry + 1
        for (x, y) in lay.ellpts(ccx, ccy, rx, ry):
            if y > G: continue
            nx = (x + .5 - ccx) / rx; ny = (y + .5 - ccy) / ry
            t = sph(nx * .9, ny * .9, .05)
            u = math.asin(max(-1, min(1, nx))) * rx * .9
            if int(u + 40) % 4 == 0 and t > 0: t -= 1
            elif int(u + 40) % 4 == 1 and (y * 2) % 5 == 0: t = 5
            lay.px(x, y, R['cream'][4] if t == 5 else RCACT[max(0, min(4, t))])
        layer_out(cv, lay)
        if fl:
            for (fx, c) in ((ccx - 3, R['pink']), (ccx + 3, R['coral'])):
                tiny_flower(cv, fx, ccy - ry + 1, c)
    return cv, cx


@vprop('dry_bush', 'Tumbleweed', 0.35, 0.15, ['desert', 'canyon', 'junk'], solid=0.4)
def p_dry_bush(rng):
    W, H = 52, 38; G = H - 2; cx = 26
    cv = Cv(W, H)
    Rd = ramp((182, 144, 98))
    ecx, ecy, rx, ry = cx, G - 14, 19, 14
    core = Cv(W, H)
    for (x, y) in core.ellpts(ecx, ecy, rx - 3, ry - 3):
        if (x * 3 + y * 7) % 5 < 2: core.px(x, y, Rd[0])
    tw = Cv(W, H)
    for _ in range(95):
        a = rng.uniform(0, 6.283); r = math.sqrt(rng.random())
        x = ecx + math.cos(a) * r * (rx - 2); y = ecy + math.sin(a) * r * (ry - 2)
        d = rng.uniform(0, 6.283); L = rng.uniform(4, 9)
        nx = (x - ecx) / rx; ny = (y - ecy) / ry
        t = max(1, min(4, sph(nx, ny, .1)))
        x1 = x + math.cos(d) * L; y1 = y + math.sin(d) * L
        if ((x1 - ecx) / rx) ** 2 + ((y1 - ecy) / ry) ** 2 > 1: continue
        tw.line(x, y, x1, y1, Rd[t])
    cv.paste(core); cv.paste(tw)
    cv.outline()
    return cv, cx


@vprop('cattails', 'Cattail clump', 0.25, 1.0, ['water', 'route'], group='reeds')
def p_cattails(rng):
    W, H = 64, 58; G = H - 2; cx = 32
    cv = Cv(W, H)
    grass_tuft(cv, cx - 4, G, 8, 20, 32, 28, R['kelp'], rng, width=3.4)
    stalks = [(cx - 14, 36, -4), (cx - 6, 48, -1), (cx + 3, 42, 1), (cx + 11, 50, 3), (cx + 18, 32, 5)]
    for (sx, h, lean) in stalks:
        lay = Cv(W, H)
        for y in range(G - h + 8, G + 1):
            t = (G - y) / h
            x = round(sx + lean * t * t)
            lay.px(x, y, R['kelp'][3]); lay.px(x + 1, y, R['kelp'][1])
        hx = round(sx + lean * ((h - 10) / h) ** 2)
        hy = G - h + 6
        for (x, y) in lay.ellpts(hx + 1, hy, 2.6, 5.6):
            t = 3 if x <= hx else 2
            if y < hy - 3: t += 1
            if y > hy + 2: t -= 1
            lay.px(x, y, R['dwood'][t])
        lay.px(hx, hy - 7, R['kelp'][2]); lay.px(hx, hy - 8, R['kelp'][3])
        layer_out(cv, lay)
    grass_tuft(cv, cx + 4, G, 7, 10, 18, 30, R['leaf'], rng, width=3.6)
    cv.outline()
    return cv, cx


def lily_bloom(cv, fx, fy, Rp):
    fl = Cv(cv.w, cv.h)
    for (dx, dy, t) in ((-4, 0, 3), (4, 0, 1), (-3, -1, 3), (3, -1, 2), (-2, -2, 4), (2, -2, 3), (0, -3, 4), (-1, -3, 4),
                        (1, -3, 3), (-2, 1, 2), (2, 1, 1), (0, -1, 3), (-1, -1, 3), (1, -1, 3), (0, 0, 2), (-1, 0, 2),
                        (1, 0, 2), (-3, 0, 2), (3, 0, 2), (-2, -1, 3), (2, -1, 2), (-1, -2, 4), (1, -2, 3), (0, -2, 4)):
        fl.px(fx + dx, fy + dy, Rp[t])
    fl.px(fx, fy - 1, R['yellow'][4]); fl.px(fx - 1, fy - 1, R['yellow'][3]); fl.px(fx, fy, R['gold'][2])
    layer_out(cv, fl)


@vprop('lily_flowers', 'Flowering lilies', 0, 0.2, ['water'], flat=1, group='pond_lily')
def p_lily_flowers(rng):
    W, H = 66, 36; G = H - 2; cx = 33
    cv = Cv(W, H)
    for (px_, py_, rx, ry, notch) in ((cx + 16, G - 16, 9, 4.5, 2.4), (cx - 18, G - 15, 10, 5, .3),
                                      (cx - 1, G - 8, 15, 7, 1.2), (cx + 20, G - 6, 7, 3.5, -.6)):
        lay = Cv(W, H)
        for (x, y) in lay.ellpts(px_, py_, rx, ry):
            a = math.atan2((y + .5 - py_) / ry, (x + .5 - px_) / rx)
            if abs(a - notch) < .28: continue
            nx = (x + .5 - px_) / rx; ny = (y + .5 - py_) / ry
            t = 3 if ny < -.3 else 2 if ny < .5 else 1
            if nx > .7: t -= 1
            if abs(int(a * 3.2) - a * 3.2) < .08 and nx * nx + ny * ny > .1: t -= 1
            lay.px(x, y, R['leaf'][max(0, t)])
        layer_out(cv, lay)
    Rp = R['pink']
    lily_bloom(cv, cx - 4, G - 11, Rp)
    lily_bloom(cv, cx - 19, G - 17, ramp((250, 176, 204)))
    lily_bloom(cv, cx + 15, G - 18, Rp)
    return cv, cx


# ----------------------------------------------------------------------------- signs and street things
def hanging_sign(rng, icon):
    W, H = 64, 86; G = H - 2; cx = 18
    cv = Cv(W, H)
    lay = Cv(W, H)
    post(lay, cx - 3, G - 72, G, R['wood'], w=6)
    lay.rect(cx - 4, G - 75, cx + 3, G - 73, lambda x, y: R['wood'][4 if y == G - 75 else 3])
    lay.rect(cx - 5, G - 3, cx + 4, G, lambda x, y: R['stone'][3 if y == G - 3 else 2])
    layer_out(cv, lay)
    br = Cv(W, H)
    by = G - 66
    for x in range(cx + 3, cx + 36):
        br.px(x, by, R['iron'][3]); br.px(x, by + 1, R['iron'][1])
    br.line(cx + 3, by + 10, cx + 12, by + 1, R['iron'][2])
    for x in (cx + 11, cx + 29):
        for k in range(2, 5): br.px(x, by + k, R['iron'][2 if k % 2 else 1])
    layer_out(cv, br)
    sg = Cv(W, H)
    bx0, bx1, byy0, byy1 = cx + 7, cx + 33, by + 5, by + 28
    for y in range(byy0, byy1 + 1):
        for x in range(bx0, bx1 + 1):
            t = 2
            if y == byy0: t = 4
            elif y == byy0 + 1 or x == bx0: t = 3
            elif y >= byy1 - 1 or x >= bx1 - 1: t = 1
            if (y - byy0) % 6 == 5 and byy0 < y < byy1 - 1: t = 1
            sg.px(x, y, R['wood'][t])
    mx, my = (bx0 + bx1) // 2 + 1, (byy0 + byy1) // 2 + 1
    sg.rect(bx0 + 4, byy0 + 3, bx1 - 4, byy1 - 3, R['cream'][2] if icon == 'coin' else R['white'][3])
    sg.orect(bx0 + 3, byy0 + 2, bx1 - 3, byy1 - 2, R['wood'][0])
    if icon == 'coin':
        Rg = R['gold']
        for (x, y) in sg.ellpts(mx, my, 7, 7):
            nx = (x + .5 - mx) / 7; ny = (y + .5 - my) / 7
            sg.px(x, y, Rg[min(4, sph(nx, ny, .15) + 1)])
        for (x, y) in sg.ellpts(mx, my, 7, 7):
            r = math.hypot(x + .5 - mx, y + .5 - my)
            if 4.2 < r < 5.2: sg.px(x, y, Rg[1] if x + y > mx + my else Rg[4])
        sg.rect(mx - 1, my - 2, mx, my + 1, Rg[1]); sg.px(mx - 1, my - 2, Rg[0])
        for (x, y) in sg.ellpts(mx, my, 8, 8):
            if math.hypot(x + .5 - mx, y + .5 - my) > 7: sg.px(x, y, olc(Rg[1]))
    else:
        Rr = R['red']
        for y in range(my - 7, my + 7):
            for x in range(mx - 7, mx + 7):
                if (abs(x + .5 - mx) < 2.6 and abs(y + .5 - my) < 7) or (abs(y + .5 - my) < 2.6 and abs(x + .5 - mx) < 7):
                    t = 2
                    if x < mx - 1 and y < my - 1: t = 3
                    if x >= mx + 1 or y >= my + 1: t = 1
                    sg.px(x, y, Rr[t])
    layer_out(cv, sg)
    return cv, cx


@vprop('sign_shop', 'Shop sign', 0.3, 0.05, ['town'], solid=0.3)
def p_sign_shop(rng): return hanging_sign(rng, 'coin')


@vprop('sign_clinic', 'Clinic sign', 0.3, 0.05, ['town'], solid=0.3)
def p_sign_clinic(rng): return hanging_sign(rng, 'cross')


@vprop('planter_box', 'Planter box', 0.6, 0.2, ['town', 'mall'], box=[1.5, 0.5])
def p_planter_box(rng):
    W, H = 64, 40; G = H - 2; cx = 32
    cv = Cv(W, H)
    pl = Cv(W, H)
    for (bx, by, rx, ry) in ((cx - 15, G - 19, 12, 7), (cx + 14, G - 19, 13, 7), (cx, G - 22, 12, 7)):
        blob(pl, bx, by, rx, ry, R['leaf'], rng, cell=5, sep=False)
    pl.outline(); cv.paste(pl)
    cols = ['pink', 'gold', 'lilac', 'white', 'coral', 'gold', 'pink']
    for i, dx in enumerate(range(-22, 23, 7)):
        c = cols[i % len(cols)]
        tiny_flower(cv, cx + dx, G - 22 - (i % 2) * 4 - (2 if i % 3 == 0 else 0), R[c],
                    R['yellow'][4] if c not in ('gold',) else R['coral'][3])
    crate_ = Cv(W, H)
    Rw = R['wood']
    x0, x1, y0 = cx - 26, cx + 25, G - 14
    for y in range(y0, G + 1):
        for x in range(x0, x1 + 1):
            fx = x - x0 < 3 or x1 - x < 3
            k = (y - y0) % 5
            t = 2 if k else 3
            if k == 4: t = 1
            if fx: t = 3 if x - x0 < 3 else 1
            if y == y0: t = 4
            if y == G: t = 0
            crate_.px(x, y, Rw[t])
    layer_out(cv, crate_)
    return cv, cx


@vprop('streetlamp_b', 'Double street lamp', 0.3, 0, ['town', 'mall'], group='streetlamp', solid=0.3)
def p_streetlamp_b(rng):
    W, H = 64, 136; G = H - 2; cx = 32
    cv = Cv(W, H)
    Ri = R['iron']
    lay = Cv(W, H)
    for y in range(G - 12, G + 1):
        f = (y - (G - 12)) / 12
        hw = 3 + 4 * f * f + (1 if y > G - 3 else 0)
        for x in range(int(cx - hw), int(cx + hw) + 1):
            if abs(x + .5 - cx) <= hw + .01: lay.px(x, y, Ri[xt(x, cx - hw, cx + hw)])
    for y in range(G - 104, G - 11):
        for x in range(cx - 2, cx + 2): lay.px(x, y, Ri[[3, 2, 1, 0][x - cx + 2]])
    for ry in (G - 40, G - 14):
        lay.rect(cx - 3, ry, cx + 2, ry + 1, lambda x, y: Ri[3 if x < cx else 1])
    # cross arm with scroll braces
    for x in range(cx - 21, cx + 21): lay.px(x, G - 98, Ri[3]); lay.px(x, G - 97, Ri[1])
    for s in (-1, 1):
        for k in range(12):
            a = k / 11 * math.pi * .5
            lay.px(int(cx + s * (2 + 10 * math.sin(a))), int(G - 86 - 10 * (1 - math.cos(a))), Ri[2])
    lay.rect(cx - 1, G - 108, cx, G - 105, Ri[2]); lay.px(cx - 1, G - 108, Ri[3])
    lay.poly([(cx - 3, G - 104), (cx + .5, G - 108), (cx + 4, G - 104)], Ri[2])
    for lx in (cx - 18, cx + 17):
        lay.rect(lx - 4, G - 101, lx + 4, G - 99, lambda x, y: Ri[3 if x < lx else 1])
        glow_box(lay, lx - 4, G - 114, 9, 13)
        for y in range(G - 115, G - 100):
            lay.px(lx - 5, y, Ri[2]); lay.px(lx + 5, y, Ri[1])
        for y in range(G - 114, G - 101): lay.px(lx, y, Ri[2])
        lay.poly([(lx - 8, G - 115), (lx - 3, G - 121), (lx + 3, G - 121), (lx + 8, G - 115)],
                 lambda x, y, lx=lx: Ri[3 if x < lx - 1 else 2 if x < lx + 3 else 1])
        lay.rect(lx - 1, G - 124, lx, G - 122, Ri[2])
        for x in range(lx - 8, lx + 8): lay.px(x, G - 115, Ri[1])
        lay.fx.append(('glow', lx, G - 108))
    layer_out(cv, lay)
    return cv, cx


@vprop('market_cart', 'Vegetable cart', 1.2, 0, ['town', 'farm'], box=[2.6, 1.0])
def p_market_cart(rng):
    W, H = 132, 96; G = H - 2; cx = 62
    cv = Cv(W, H)
    Rw = R['plank']
    # handles and stand behind
    lay = Cv(W, H)
    lay.line(cx + 30, G - 30, cx + 60, G - 22, R['wood'][2], w=3)
    lay.line(cx + 40, G - 26, cx + 44, G, R['wood'][1], w=3)
    layer_out(cv, lay)
    # umbrella pole + canopy
    um = Cv(W, H)
    for y in range(G - 82, G - 30): um.px(cx + 22, y, R['wood'][2]); um.px(cx + 23, y, R['wood'][1])
    ucx, ucy = cx + 22, G - 74
    for (x, y) in um.ellpts(ucx, ucy, 44, 16):
        if y > ucy: continue
        a = math.atan2(x + .5 - ucx, -(y + .5 - ucy) * 2.6)
        s = int((a + 1.6) / .32) % 2
        Rr = R['coral'] if s == 0 else R['cream']
        t = 3 if x < ucx - 10 else 2 if x < ucx + 18 else 1
        if y < ucy - 12: t = min(4, t + 1)
        um.px(x, y, Rr[t])
    for x in range(ucx - 43, ucx + 44):
        u = x - (ucx - 43); s = (u // 8) % 2
        Rr = R['coral'] if s == 0 else R['cream']
        k = u % 8
        dep = 2 + (2 if 2 <= k <= 5 else 1 if k in (1, 6) else 0)
        for d in range(dep):
            um.px(x, ucy + 1 + d, Rr[1 if d < dep - 1 else 0])
    layer_out(cv, um)
    # produce piled in the bed
    fr = Cv(W, H)
    for (dx, dy, col, r) in ((-34, -42, 'leafy', 6), (-24, -44, 'red', 4), (-16, -42, 'red', 4), (-6, -43, 'leafy', 6),
                             (4, -44, 'orange', 4), (12, -42, 'orange', 4), (20, -43, 'lilac', 4.5), (-28, -48, 'red', 4),
                             (-12, -49, 'leafy', 5.5), (8, -49, 'orange', 4), (26, -46, 'gold', 4)):
        ball(fr, cx + dx, G + dy, r, r * .9, R[col], .1)
    fr.outline(); cv.paste(fr)
    # cart bed
    bd = Cv(W, H)
    x0, x1, y0, y1 = cx - 42, cx + 32, G - 40, G - 20
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            t = 2
            k = (y - y0) % 5
            if k == 4: t = 1
            elif k == 0: t = 3
            if x - x0 < 3: t = 3
            if x1 - x < 3: t = 1
            if y == y0: t = 4
            bd.px(x, y, Rw[t])
    for x in range(x0 + 2, x1 - 1): bd.px(x, y1 + 1, R['wood'][0])
    layer_out(cv, bd)
    # big spoked wheel
    wh = Cv(W, H)
    wx, wy, wr = cx - 18, G - 15, 15
    for (x, y) in wh.ellpts(wx, wy, wr, wr):
        r = math.hypot(x + .5 - wx, y + .5 - wy)
        if r > wr - 3.2:
            a = math.atan2(y + .5 - wy, x + .5 - wx)
            wh.px(x, y, R['wood'][3 if a < -1.2 else 2 if a < 1.0 else 1] if r < wr - 1 else R['iron'][1])
    for k in range(8):
        a = k * math.pi / 4 + .2
        wh.line(wx, wy, wx + math.cos(a) * (wr - 3), wy + math.sin(a) * (wr - 3), R['wood'][2 if k % 2 else 1])
    ball(wh, wx + .5, wy + .5, 3, 3, R['iron'], .1)
    layer_out(cv, wh)
    return cv, cx


@vprop('fountain', 'Fountain', 1.8, 0, ['town', 'mall'], solid=1.6)
def p_fountain(rng):
    W, H = 132, 100; G = H - 2; cx = 66
    cv = Cv(W, H)
    Rs = R['marble']; Rq = R['water']
    # basin wall and water surface
    bs = Cv(W, H)
    top = G - 18
    for y in range(top, G + 1):
        for x in range(cx - 56, cx + 57):
            nx = (x + .5 - cx) / 56.5
            if abs(nx) > 1: continue
            yy = y + int(round(4 * math.sqrt(1 - nx * nx)))
            if yy > G: continue
            t = 3 if nx < -.45 else 2 if nx < .4 else 1 if nx < .8 else 0
            if (y - top) % 6 == 5: t = max(0, t - 1)
            if int(math.asin(max(-1, min(1, nx))) * 56 + 300) % 14 == 0 and (y - top) % 6 != 5: t = max(0, t - 1)
            bs.px(x, yy, Rs[t])
    for (x, y) in bs.ellpts(cx, top, 57, 10):
        ny = (y + .5 - top) / 10
        bs.px(x, y, Rs[4 if ny < -.5 else 3])
    for (x, y) in bs.ellpts(cx, top, 50, 7):
        nx = (x + .5 - cx) / 50; ny = (y + .5 - top) / 7
        t = 1 if ny < -.3 else 2
        r = math.hypot(nx, ny)
        if abs(r - .55) < .05 or abs(r - .82) < .04: t = 3
        bs.px(x, y, Rq[t])
    layer_out(cv, bs)
    # pedestal and upper bowl
    pd = Cv(W, H)
    for y in range(G - 56, top + 2):
        f = (y - (G - 56)) / (top + 2 - (G - 56))
        hw = 4 + 4 * f * f
        for x in range(int(cx - hw), int(cx + hw) + 1):
            if abs(x + .5 - cx) <= hw: pd.px(x, y, Rs[xt(x, cx - hw, cx + hw)])
    by = G - 56
    for (x, y) in pd.ellpts(cx, by, 22, 8):
        if y >= by:
            nx = (x + .5 - cx) / 22
            pd.px(x, y, Rs[3 if nx < -.4 else 2 if nx < .4 else 1] if y < by + 6 else Rs[0])
    for (x, y) in pd.ellpts(cx, by, 22, 4.5):
        ny = (y + .5 - by) / 4.5
        pd.px(x, y, Rs[4] if ny < -.4 else Rs[3])
    for (x, y) in pd.ellpts(cx, by, 18, 3):
        pd.px(x, y, Rq[2 if y >= by else 1])
    for y in range(G - 70, by):
        for x in range(cx - 2, cx + 2): pd.px(x, y, Rs[[3, 2, 1, 0][x - cx + 2]])
    ball(pd, cx, G - 71, 3.5, 3, Rs, .1)
    layer_out(cv, pd)
    # streams falling from the bowl rim into the basin, and the top jet
    wt = Cv(W, H)
    for s in (-1, 1):
        for k in range(26):
            f = k / 25
            x = cx + s * (21 + 9 * f ** .7); y = by + 2 + 34 * f ** 1.6
            wt.px(int(x), int(y), Rq[4] if k % 4 else R['white'][4])
            wt.px(int(x) - s, int(y), Rq[3])
    for y in range(G - 82, G - 74): wt.px(cx - 1, y, R['white'][4] if y % 3 else Rq[4]); wt.px(cx, y, Rq[3])
    for (dx, dy) in ((-4, -80), (3, -82), (-2, -85), (4, -77), (-5, -76)):
        wt.px(cx + dx, G + dy, Rq[4])
    for (x, y) in ((x, y) for y in range(H) for x in range(W) if wt.has(x, y)):
        cv.px(x, y, wt.get(x, y))
    cv.fx.append(('spray', cx, G - 82))
    return cv, cx


@vprop('windmill_tower', 'Windmill tower', 1.6, 0, ['farm'], box=[1.6, 1.6])
def p_windmill_tower(rng):
    return windmill_draw(True, False), WM_CX


# ============================================================================= v17: CITY, LIFE AND NATURE PROPS
# (Its own file until RL-1's follow-up; it uses the helpers above: Cv, R, ramp, wall, window, door, awning, tile_roof,
# gable_roof, stone_band, blob, leafy, trunk, ball, vprop ...)
# City buildings carry a 3D plan (cv.bld, canvas pixels; prop_meta turns it into base-relative "bld" in props.json and
# tools/build-buildings.py turns that into the "build" plan the engine draws). Moving life (ducks, pigeons, chickens,
# sheep, cars) is drawn as frame strips into game/art/scene/life/ by build_life().

def v17_plan(cv, **kw):
    cv.bld = kw


def quoins(cv, x0, x1, y0, y1, Rq, w=7, h=8):
    for k, y in enumerate(range(y0, y1, h)):
        ww = w if k % 2 else w - 3
        for x in range(x0, x0 + ww):
            for yy in range(y, min(y1, y + h - 1)): cv.px(x, yy, Rq[3 if yy == y else 2 if x < x0 + ww - 1 else 1])
        for x in range(x1 - ww + 1, x1 + 1):
            for yy in range(y, min(y1, y + h - 1)): cv.px(x, yy, Rq[3 if yy == y else 2 if x > x1 - ww + 1 else 1])


def band(cv, x0, x1, y, Rt, tones=(4, 3, 2, 1), over=0):
    for k, t in enumerate(tones):
        for x in range(x0 - over, x1 + over + 1):
            tt = t
            if x < x0 - over + 2: tt = min(4, t + 1)
            if x > x1 + over - 2: tt = max(0, t - 1)
            cv.px(x, y + k, Rt[tt])


def cornice(cv, x0, x1, y0, h, Rt, over=4, dent=True):
    tones = [4, 3, 3, 2, 2, 2, 1, 1, 0, 0, 0, 0][:h]
    for k in range(h):
        for x in range(x0 - over, x1 + over + 1):
            t = tones[k] if k < len(tones) else 1
            if x > x1 + over - 2: t = max(0, t - 1)
            cv.px(x, y0 + k, Rt[t])
    if dent:
        for x in range(x0 - over + 2, x1 + over - 1, 6):
            cv.px(x, y0 + h - 2, Rt[0]); cv.px(x + 1, y0 + h - 2, Rt[0]); cv.px(x, y0 + h - 1, Rt[0])


def roof_top(cv, x0, x1, y0, y1, Rr, inset=6):
    """the top of a flat roof seen a little from above, behind the cornice"""
    for y in range(y0, y1 + 1):
        f = (y - y0) / max(1, y1 - y0)
        a = x0 + inset * (1 - f); b = x1 - inset * (1 - f)
        for x in range(int(a), int(b) + 1):
            t = 3 if (x // 11 + y // 4) % 2 else 2
            if y == y0: t = 4
            cv.px(x, y, Rr[t])


def glass_doors(cv, cx, G, w, h, Rf, n=2):
    x0 = cx - w // 2; y0 = G - 6 - h
    cv.rect(x0 - 3, y0 - 3, x0 + w + 2, G - 6, Rf[2]); cv.orect(x0 - 4, y0 - 4, x0 + w + 3, G - 5, olc(Rf[1]))
    for y in range(y0 - 3, G - 5): cv.px(x0 - 3, y, Rf[4]); cv.px(x0 + w + 2, y, Rf[0])
    for x in range(x0 - 3, x0 + w + 3): cv.px(x, y0 - 3, Rf[4])
    pw = w // n
    for i in range(n):
        window(cv, x0 + i * pw, y0, pw, h, Rf=Rf, cross=False, sill=False, rec=None)


def lintel(cv, x0, w, y, Rs):
    for x in range(x0 - 3, x0 + w + 3):
        cv.px(x, y - 4, Rs[4 if x < x0 else 3]); cv.px(x, y - 3, Rs[2]); cv.px(x, y - 2, Rs[1])
    cv.px(x0 - 4, y - 3, olc(Rs[1])); cv.px(x0 + w + 3, y - 3, olc(Rs[1]))


def coin_emblem(cv, cx, cy, r):
    Rg = R['gold']
    for (x, y) in cv.ellpts(cx, cy, r + 1, r + 1): cv.px(x, y, olc(Rg[1]))
    for (x, y) in cv.ellpts(cx, cy, r, r):
        nx = (x + .5 - cx) / r; ny = (y + .5 - cy) / r
        cv.px(x, y, Rg[min(4, sph(nx, ny) + 1)])
    for (x, y) in cv.ellpts(cx, cy, r * .72, r * .72):
        if (x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 > (r * .6) ** 2: cv.px(x, y, Rg[1])
    # a dollar-ish S made of pixels
    s = max(2, int(r * .3))
    for k in range(-s, s + 1):
        cv.px(cx, cy + k - s - 1, Rg[0])
    for x in range(cx - s, cx + s): cv.px(x, cy - s, Rg[0]); cv.px(x, cy, Rg[0]); cv.px(x, cy + s, Rg[0])
    for y in range(cy - s, cy): cv.px(cx - s, y, Rg[0])
    for y in range(cy, cy + s): cv.px(cx + s - 1, y, Rg[0])


def hanger_icon(cv, cx, cy, Rc):
    cv.px(cx, cy - 6, Rc[1]); cv.px(cx + 1, cy - 7, Rc[1]); cv.px(cx + 2, cy - 6, Rc[1]); cv.px(cx + 1, cy - 5, Rc[1])
    for k in range(9):
        cv.px(cx - k, cy - 4 + k // 2, Rc[1]); cv.px(cx + 1 + k, cy - 4 + k // 2, Rc[1])
    for x in range(cx - 8, cx + 10): cv.px(x, cy + 1, Rc[1])


def bag_icon(cv, cx, cy, Rc):
    cv.rect(cx - 7, cy - 3, cx + 7, cy + 7, Rc[2]); cv.orect(cx - 8, cy - 4, cx + 8, cy + 8, Rc[0])
    for x in range(cx - 7, cx + 8): cv.px(x, cy - 3, Rc[3])
    for k in range(5):
        cv.px(cx - 4, cy - 4 - k, Rc[0]); cv.px(cx + 4, cy - 4 - k, Rc[0])
    for x in range(cx - 4, cx + 5): cv.px(x, cy - 9, Rc[0])


# ----------------------------------------------------------------------------- city buildings
@vprop('apartment_a', 'Brick apartments', 2.4, 0, ['city'], group='apartment', box=[6.0, 4.0])
def p_apartment_a(rng):
    W, H = 250, 380; G = H - 2; cx = 125
    cv = Cv(W, H); x0, x1 = 22, 228; top = G - 352
    stone_band(cv, x0, x1, top, G - 6, R['brick'], bw=10, bh=5)
    quoins(cv, x0, x1, top, G - 6, R['stone'])
    stone_band(cv, x0 - 2, x1 + 2, G - 5, G, R['stone'])
    for k in range(3): band(cv, x0, x1, G - 100 - k * 84, R['white'])
    cornice(cv, x0, x1, top - 10, 10, R['white'], over=5)
    roof_top(cv, x0 - 3, x1 + 3, top - 20, top - 11, R['stone'])
    # water tank on the roof
    tk = Cv(W, H)
    for y in range(top - 46, top - 18):
        for x in range(x1 - 52, x1 - 30): tk.px(x, y, R['wood'][xt(x, x1 - 52, x1 - 30)] if (y - top) % 6 else R['dwood'][1])
    tk.poly([(x1 - 55, top - 46), (x1 - 41, top - 56), (x1 - 27, top - 46)], lambda x, y: R['dwood'][3 if x < x1 - 41 else 1])
    for x in (x1 - 50, x1 - 33):
        for y in range(top - 18, top - 10): tk.px(x, y, R['iron'][1])
    layer_out(cv, tk)
    sx = [x0 + 20, x0 + 67, x0 + 113, x0 + 160]
    for k in range(3):
        fy = G - 100 - k * 84
        for i, x in enumerate(sx):
            wy = fy - 84 + 24
            lintel(cv, x, 26, wy, R['stone'])
            window(cv, x, wy, 26, 36, Rf=R['white'], box=(['coral', 'gold', 'pink'] if (i + k) % 3 == 0 else None), rng=rng)
    glass_doors(cv, cx, G, 34, 54, R['white'])
    awning(cv, cx - 30, cx + 29, G - 74, 12, R['teal'], R['white'], sw=6, slope=4)
    for x in (x0 + 18, x1 - 54):
        lintel(cv, x, 36, G - 70, R['stone']); window(cv, x, G - 70, 36, 40, Rf=R['white'], rng=rng)
    cv.rect(cx - 24, G - 5, cx + 23, G, lambda x, y: R['stone'][3 if y == G - 5 else 2])
    cv.outline(); cv.door = cx
    v17_plan(cv, kind='flat', wall=[x0, x1], eave=top - 10, roofCol=P['stone'], roofTex=13, wallCol=P['brick'], wallTex=2, trimCol=P['white'], floors=4, rooms=[0, 1, 2, 7, 4])
    return cv, cx


def pastel_apartment(rng, Rw, Rr, Rt, wallc, roofc, trimc):
    W, H = 220, 320; G = H - 2; cx = 110
    cv = Cv(W, H); x0, x1 = 24, 196; top = G - 252
    wall(cv, x0, top, x1, G - 6, Rw, siding=0, eave=4)
    for _ in range(14):
        x = rng.randint(x0 + 8, x1 - 10); y = rng.randint(top + 20, G - 20); cv.px(x, y, Rw[1]); cv.px(x + 1, y, Rw[3])
    stone_band(cv, x0 - 2, x1 + 2, G - 5, G, R['stone'])
    for k in range(2): band(cv, x0, x1, G - 92 - k * 80, Rt, (3, 2, 1))
    tile_roof(cv, 12, top + 4, x0 + 34, x1 - 34, x0 - 12, x1 + 12, Rr, tw=9)
    shade_below(cv, x0, x1, top + 5, 3)
    sm = chimney(cv, x1 - 46, x1 - 32, 4, top - 10, R['brick'])
    for k in range(2):
        fy = G - 92 - k * 80
        for i, x in enumerate((x0 + 22, x0 + 74, x0 + 126)):
            window(cv, x, fy - 80 + 20, 24, 34, Rf=Rt, rng=rng, box=(['pink', 'gold', 'white'] if k == 0 else None))
            shutters(cv, x, fy - 80 + 20, 24, 34, Rt)
    # small balcony in the middle of the top floor
    by = G - 92 - 80 + 58
    for x in range(x0 + 116, x0 + 160):
        cv.px(x, by, R['iron'][3]); cv.px(x, by + 12, R['iron'][1])
        if x % 4 == 0:
            for y in range(by, by + 12): cv.px(x, y, R['iron'][2])
    door(cv, cx, G - 6, 28, 52, Rw=Rt, arch=True)
    door_step(cv, cx, G, 18)
    for x in (x0 + 16, x1 - 50):
        window(cv, x, G - 74, 34, 36, Rf=Rt, rng=rng, box=['gold', 'coral', 'lilac'])
    cv.outline(); cv.door = cx
    cv.fx.append(('smoke',) + sm)
    v17_plan(cv, kind='hip', wall=[x0, x1], eave=top + 4, pitch=36, over=.3, roofCol=roofc, roofTex=8, wallCol=wallc, wallTex=0, trimCol=trimc, floors=3, rooms=[0, 1, 2],
             chimney=dict(x=x1 - 39, top=4, w=.45, col=P['brick'], tex=2))
    return cv, cx


@vprop('apartment_b', 'Pastel apartments', 2.2, 0, ['city', 'town'], group='apartment', box=[5.0, 3.6])
def p_apartment_b(rng):
    return pastel_apartment(rng, R['mint'], R['coral'], R['white'], P['mint'], P['coral'], P['white'])


@vprop('apartment_c', 'Yellow apartments', 2.2, 0, ['city', 'town'], group='apartment', box=[5.0, 3.6])
def p_apartment_c(rng):
    return pastel_apartment(rng, ramp((248, 222, 140)), R['teal'], R['dwood'], (248, 222, 140), P['teal'], P['dwood'])


@vprop('office_tower', 'Capital Tower', 2.8, 0, ['city'], group='office', box=[6.8, 5.0])
def p_office_tower(rng):
    W, H = 270, 576; G = H - 2; cx = 135
    cv = Cv(W, H); x0, x1 = 20, 250; top = G - 504
    Rm = R['marble']
    for y in range(top, G - 6):
        for x in range(x0, x1 + 1):
            t = 2
            if x - x0 < 3: t = 3
            elif x1 - x < 3: t = 1
            if (x - x0) % 38 == 0: t = 1
            cv.px(x, y, Rm[t])
    stone_band(cv, x0 - 2, x1 + 2, G - 5, G, R['stone'], bw=14)
    for k in range(5):
        fy = G - 104 - k * 80
        band(cv, x0, x1, fy, R['iron'], (3, 2, 1))
        for i in range(6):
            x = x0 + 8 + i * 38
            window(cv, x, fy - 80 + 12, 26, 56, Rf=R['iron'], cross=False, sill=False)
            for y in range(fy - 80 + 40, fy - 80 + 42):
                for xx in range(x + 2, x + 24): cv.px(xx, y, R['iron'][2])
    cornice(cv, x0, x1, top - 12, 12, R['iron'], over=4)
    roof_top(cv, x0 - 2, x1 + 2, top - 22, top - 13, R['stone'])
    em = Cv(W, H)
    for y in range(top - 30, top - 22):
        for x in range(cx - 10, cx + 10): em.px(x, y, R['iron'][xt(x, cx - 10, cx + 10)])
    coin_emblem(em, cx, top - 52, 22)
    layer_out(cv, em)
    # lobby: glass front with a canopy
    cv.rect(x0 + 6, G - 98, x1 - 6, G - 6, R['iron'][1])
    for i in range(5):
        x = x0 + 12 + i * 44
        if i == 2: glass_doors(cv, x + 18, G, 40, 70, R['iron'])
        else: window(cv, x, G - 80, 36, 74, Rf=R['iron'], cross=False, sill=False)
    for y in range(G - 96, G - 88):
        for x in range(x0 + 60, x1 - 60): cv.px(x, y, R['gold'][(4, 3, 3, 2, 2, 1, 1, 0)[y - (G - 96)]])
    cv.outline(); cv.door = cx
    v17_plan(cv, kind='flat', wall=[x0, x1], eave=top - 12, roofCol=P['stone'], roofTex=13, wallCol=P['marble'], wallTex=5, trimCol=P['iron'], floors=6, rooms=[4, 4, 7, 4])
    return cv, cx


def townhouse(rng, body, Rr, Rt, wallc, roofc, trimc, brick=False, doorc='teal'):
    W, H = 150, 332; G = H - 2; cx = 75
    cv = Cv(W, H); x0, x1 = 17, 133
    yb = G - 244; ay = yb - 80; xl, xr = x0 - 16, x1 + 16; T = 17
    for y in range(ay, G - 5):
        for x in range(x0, x1 + 1):
            ey = ay + abs(x + .5 - cx) * (yb - ay) / (cx - xl)
            if y + .5 >= ey:
                t = 3 if x == x0 else 1 if x >= x1 - 1 else 2
                if y < yb:
                    k = (x - cx) % 6
                    cv.px(x, y, R['white'][3 if k == 1 else 1 if k == 0 else 2])
                else:
                    cv.px(x, y, body[t])
    if brick: stone_band(cv, x0, x1, yb, G - 6, body, bw=10, bh=5)
    stone_band(cv, x0 - 2, x1 + 2, G - 5, G, R['stone'])
    band(cv, x0, x1, yb, R['dwood'], (1, 0, 2, 1))
    for k in range(2): band(cv, x0, x1, G - 92 - k * 76, Rt, (3, 2, 1))
    gable_roof(cv, cx, ay, xl, xr, yb, T, Rr)
    cv.rect(cx - 1, ay - 5, cx, ay, R['gold'][3]); cv.px(cx, ay - 1, R['gold'][1])
    rc = (cx, yb - 34)
    for (x, y) in cv.ellpts(rc[0], rc[1], 9, 9): cv.px(x, y, R['white'][2])
    for (x, y) in cv.ellpts(rc[0], rc[1], 6, 6):
        cv.px(x, y, R['glass'][0 if y < rc[1] - 3 else 4 if (x + y) % 7 == 0 else 2])
    for k in range(-6, 7): cv.px(rc[0] + k, rc[1], R['white'][3]); cv.px(rc[0], rc[1] + k, R['white'][2])
    for k in range(2):
        fy = G - 92 - k * 76
        for x in (x0 + 18, x1 - 42):
            window(cv, x, fy - 76 + 18, 24, 34, Rf=Rt, rng=rng, box=(['pink', 'gold', 'coral'] if k == 0 else None))
    dx = x0 + 32
    door(cv, dx, G - 6, 26, 50, Rw=R[doorc], arch=True)
    door_step(cv, dx, G, 16)
    window(cv, x1 - 46, G - 72, 30, 34, Rf=Rt, rng=rng, box=['gold', 'lilac', 'pink'])
    wall_lamp(cv, dx + 20, G - 46)
    cv.outline(); cv.door = dx
    v17_plan(cv, kind='gableF', wall=[x0, x1], eave=yb, apex=ay + T, over=.3, roofCol=roofc, roofTex=10, wallCol=wallc, wallTex=2 if brick else 0, trimCol=trimc, floors=3, rooms=[0, 2, 1, 7])
    return cv, cx


@vprop('townhouse_red', 'Brick townhouse', 1.8, 0, ['city', 'town'], group='townhouse', box=[3.4, 3.6])
def p_townhouse_red(rng):
    return townhouse(rng, R['brick'], R['iron'], R['white'], P['brick'], P['iron'], P['white'], brick=True)


@vprop('townhouse_blue', 'Blue townhouse', 1.8, 0, ['city', 'town'], group='townhouse', box=[3.4, 3.6])
def p_townhouse_blue(rng):
    return townhouse(rng, ramp((150, 182, 226)), R['lilac'], R['white'], (150, 182, 226), P['lilac'], P['white'], doorc='coral')


@vprop('townhouse_yellow', 'Cream townhouse', 1.8, 0, ['city', 'town'], group='townhouse', box=[3.4, 3.6])
def p_townhouse_yellow(rng):
    return townhouse(rng, R['cream'], ramp((108, 178, 98)), R['dwood'], P['cream'], (108, 178, 98), P['dwood'], doorc='wood')


@vprop('shop_cafe', 'Corner café', 2.0, 0, ['city', 'town'], group='shop_city', box=[4.6, 3.2])
def p_shop_cafe(rng):
    W, H = 200, 248; G = H - 2; cx = 100
    cv = Cv(W, H); x0, x1 = 22, 178; top = G - 184
    wall(cv, x0, top, x1, G - 100, R['cream'], siding=0, eave=4)
    stone_band(cv, x0, x1, G - 100, G - 6, R['brick'], bw=10, bh=5)
    stone_band(cv, x0 - 2, x1 + 2, G - 5, G, R['stone'])
    band(cv, x0, x1, G - 102, R['dwood'], (3, 2, 1, 0))
    tile_roof(cv, 12, top + 4, x0 + 30, x1 - 30, x0 - 12, x1 + 12, R['teal'], tw=9)
    shade_below(cv, x0, x1, top + 5, 3)
    sm = chimney(cv, x0 + 30, x0 + 44, 2, top - 6, R['brick'])
    for x in (x0 + 18, x0 + 66, x0 + 114):
        window(cv, x, top + 22, 24, 32, Rf=R['white'], rng=rng, box=['coral', 'gold', 'pink'])
    shop_window(cv, x0 + 12, G - 82, 70, 46, rng)
    dc = x1 - 40
    door(cv, dc, G - 6, 28, 52, Rw=R['teal'], Rfr=R['white'], arch=False)
    awning(cv, x0 + 4, x1 - 4, G - 98, 16, R['teal'], R['white'], sw=7, slope=5)
    # hanging cup sign
    sg = Cv(W, H)
    for x in range(x1 - 2, x1 + 18): sg.px(x, G - 120, R['iron'][2])
    sg.rect(x1 + 2, G - 118, x1 + 18, G - 102, R['wood'][2]); sg.orect(x1 + 1, G - 119, x1 + 19, G - 101, R['wood'][0])
    sg.rect(x1 + 6, G - 114, x1 + 13, G - 106, R['white'][3]); sg.px(x1 + 14, G - 112, R['white'][2]); sg.px(x1 + 15, G - 111, R['white'][2]); sg.px(x1 + 14, G - 109, R['white'][2])
    sg.outline(); cv.paste(sg)
    cv.outline(); cv.door = dc
    cv.fx.append(('smoke',) + sm)
    v17_plan(cv, kind='hip', wall=[x0, x1], eave=top + 4, pitch=38, over=.3, roofCol=P['teal'], roofTex=8, wallCol=P['cream'], wallTex=0, trimCol=P['dwood'], floors=2, rooms=[3, 0],
             base=dict(col='#%02X%02X%02X' % P['brick'], tex=2, h=2.8), chimney=dict(x=x0 + 37, top=2, w=.42, col=P['brick'], tex=2))
    return cv, cx


@vprop('shop_boutique', 'Boutique', 2.0, 0, ['city', 'town'], group='shop_city', box=[4.5, 3.2])
def p_shop_boutique(rng):
    W, H = 200, 242; G = H - 2; cx = 100
    cv = Cv(W, H); x0, x1 = 24, 176; top = G - 188
    Rl = R['lilac']
    wall(cv, x0, top, x1, G - 104, R['white'], siding=0, eave=3)
    for y in range(G - 104, G - 6):
        for x in range(x0, x1 + 1): cv.px(x, y, Rl[1 if (x - x0) % 30 == 0 else xt(x, x0, x1, (.06, .9, .97))])
    stone_band(cv, x0 - 2, x1 + 2, G - 5, G, R['marble'])
    band(cv, x0, x1, G - 106, R['gold'], (3, 2, 1))
    cornice(cv, x0, x1, top - 10, 10, R['white'], over=5)
    roof_top(cv, x0 - 3, x1 + 3, top - 18, top - 11, R['lav'])
    sg = Cv(W, H)
    for y in range(top - 44, top - 18):
        for x in range(cx - 38, cx + 38):
            r = 8
            ddx = max(cx - 38 + r - x, 0, x - (cx + 37 - r)); ddy = max(top - 44 + r - y, 0)
            if ddx * ddx + ddy * ddy > r * r: continue
            sg.px(x, y, Rl[3 if y < top - 40 else 2] if (x - cx + 38) > 3 and (cx + 37 - x) > 3 and y > top - 41 and y < top - 21 else R['gold'][3])
    hanger_icon(sg, cx, top - 30, R['white'])
    layer_out(cv, sg)
    for x in (x0 + 16, x0 + 64, x0 + 112):
        # arched upper windows
        window(cv, x, top + 26, 24, 38, Rf=R['white'], rng=rng)
        for k in range(24):
            yy = top + 26 - int(5 * math.sin((k + .5) / 24 * math.pi))
            cv.px(x + k, yy, R['white'][3]); cv.px(x + k, yy + 1, R['white'][2])
    for wx in (x0 + 8, x1 - 58):
        window(cv, wx, G - 90, 50, 64, Rf=R['gold'], cross=False, sill=True)
        # mannequin with a dress behind the glass
        mx = wx + 25
        cv.rect(mx - 2, G - 80, mx + 1, G - 77, R['peach'][2])
        dc_ = rng.choice(['coral', 'teal', 'gold', 'pink'])
        for k in range(22):
            hw = 3 + k * .45
            for x in range(int(mx - hw), int(mx + hw) + 1): cv.px(x, G - 76 + k, R[dc_][3 if x < mx - hw + 2 else 2])
        for y in range(G - 54, G - 30): cv.px(mx, y, R['iron'][1])
    glass_doors(cv, cx, G, 30, 58, R['gold'])
    awning(cv, x0 + 4, x1 - 4, G - 102, 12, Rl, R['white'], sw=8, slope=4)
    cv.outline(); cv.door = cx
    v17_plan(cv, kind='flat', wall=[x0, x1], eave=top - 10, roofCol=P['lav'], roofTex=13, wallCol=P['white'], wallTex=0, trimCol=P['lilac'], floors=2, rooms=[3, 2],
             base=dict(col='#%02X%02X%02X' % P['lilac'], tex=5, h=3.0))
    return cv, cx


@vprop('shop_mart', 'City Mart', 2.0, 0, ['city'], group='shop_city', box=[5.3, 3.4])
def p_shop_mart(rng):
    W, H = 220, 176; G = H - 2; cx = 110
    cv = Cv(W, H); x0, x1 = 20, 200; top = G - 120
    wall(cv, x0, top, x1, G - 6, R['white'], siding=0, eave=3)
    for x in range(x0 + 30, x1, 30):
        for y in range(top + 4, G - 6): cv.px(x, y, R['white'][1])
    stone_band(cv, x0 - 2, x1 + 2, G - 5, G, R['stone'])
    band(cv, x0, x1, top + 8, R['leaf'], (4, 3, 3, 2, 2, 1))
    cornice(cv, x0, x1, top - 8, 8, R['leaf'], over=4, dent=False)
    roof_top(cv, x0 - 2, x1 + 2, top - 16, top - 9, R['stone'])
    sg = Cv(W, H)
    for y in range(top - 46, top - 16):
        for x in range(cx - 56, cx + 56):
            edge = y in (top - 46, top - 17) or x in (cx - 56, cx + 55)
            sg.px(x, y, R['leaf'][4 if y == top - 46 else 0 if edge else 2 if (x // 8) % 2 else 3])
    for x in (cx - 40, cx + 40):
        for y in range(top - 16, top - 8): sg.px(x, y, R['iron'][1])
    sg.rect(cx - 16, top - 42, cx + 16, top - 20, R['white'][3]); bag_icon(sg, cx, top - 30, R['coral'])
    layer_out(cv, sg)
    window(cv, x0 + 10, G - 92, 104, 66, Rf=R['white'], cross=False, sill=True)
    for k in range(1, 4):
        for y in range(G - 90, G - 28): cv.px(x0 + 10 + k * 26, y, R['white'][2])
    # goods on shelves behind the glass
    for sy in (G - 62, G - 38):
        for x in range(x0 + 13, x0 + 111): cv.px(x, sy, R['wood'][1])
        for x in range(x0 + 14, x0 + 110, 4):
            if (x // 26) != ((x + 3) // 26): continue
            c = rng.choice(['coral', 'gold', 'mint', 'sky', 'pink'])
            for y in range(sy - rng.randint(3, 7), sy): cv.px(x, y, R[c][3]); cv.px(x + 1, y, R[c][2])
    dc = x1 - 40
    glass_doors(cv, dc, G, 40, 66, R['leaf'])
    cv.outline(); cv.door = dc
    v17_plan(cv, kind='flat', wall=[x0, x1], eave=top - 8, roofCol=P['stone'], roofTex=13, wallCol=P['white'], wallTex=5, trimCol=P['leaf'], floors=1, rooms=[3])
    return cv, cx


@vprop('city_hall', 'Capital Hall', 3.0, 0, ['city'], group='hall', box=[8.0, 4.6])
def p_city_hall(rng):
    W, H = 320, 272; G = H - 2; cx = 160
    cv = Cv(W, H); x0, x1 = 24, 296; top = G - 196
    stone_band(cv, x0, x1, top, G - 12, R['marble'], bw=18, bh=8)
    for k in range(3):
        y = G - 12 + k * 4
        for x in range(x0 - 6 - k * 4, x1 + 7 + k * 4):
            for yy in range(y, min(G + 1, y + 4)): cv.px(x, yy, R['stone'][3 if yy == y else 2 if x < x1 else 1])
    band(cv, x0, x1, G - 110, R['white'], (4, 3, 2, 1))
    cornice(cv, x0, x1, top - 12, 12, R['white'], over=6)
    roof_top(cv, x0 - 4, x1 + 4, top - 22, top - 13, R['stone'])
    pd = Cv(W, H)
    pts = [(cx - 82, top - 12), (cx, top - 58), (cx + 82, top - 12)]
    pd.poly(pts, lambda x, y: R['white'][3 if y < top - 50 + abs(x - cx) * .2 else 2])
    for k in range(165):
        x = cx - 82 + k; y = top - 12 - int(46 * (1 - abs(k - 82) / 82))
        pd.px(x, y, R['white'][4]); pd.px(x, y + 1, R['white'][3])
    coin_emblem(pd, cx, top - 30, 12)
    layer_out(cv, pd)
    cols = [x0 + 18 + i * 52 for i in range(6)]
    for i, x in enumerate(cols):
        if i < 5:
            for f, (wy, wh) in enumerate(((top + 22, 54), (G - 98, 60))):
                if i == 2 and f == 1: continue
                window(cv, x + 16, wy, 22, wh, Rf=R['white'], cross=True, sill=True)
        for y in range(top + 6, G - 12):
            for xx in range(x, x + 12): cv.px(xx, y, R['marble'][[4, 3, 3, 2, 2, 2, 2, 1, 1, 1, 0, 0][xx - x]])
        cv.rect(x - 3, top + 2, x + 14, top + 6, R['marble'][3]); cv.rect(x - 3, G - 18, x + 14, G - 13, R['marble'][2])
    dcx = cols[2] + 27
    door(cv, dcx, G - 12, 34, 64, Rw=R['dwood'], arch=True, glass=True)
    for x in (cols[1] + 40, cols[3] + 14):
        glow_box(cv, x - 3, G - 70, 7, 9); cv.fx.append(('glow', x, G - 66))
    cv.outline(); cv.door = dcx
    v17_plan(cv, kind='flat', wall=[x0, x1], eave=top - 12, roofCol=P['stone'], roofTex=13, wallCol=P['marble'], wallTex=3, trimCol=P['white'], floors=2, rooms=[4, 7])
    return cv, cx


# ----------------------------------------------------------------------------- street furniture
def pole(cv, cx, y0, y1, Ri, w=4):
    for y in range(y0, y1 + 1):
        for x in range(cx - w // 2, cx - w // 2 + w): cv.px(x, y, Ri[[3, 2, 1, 0, 0][x - cx + w // 2]])


@vprop('traffic_light', 'Traffic light', 0.25, 0, ['city'], solid=0.2)
def p_traffic_light(rng):
    W, H = 40, 132; G = H - 2; cx = 20
    cv = Cv(W, H); lay = Cv(W, H); Ri = R['iron']
    pole(lay, cx, G - 92, G, Ri)
    lay.rect(cx - 6, G - 3, cx + 5, G, lambda x, y: Ri[3 if x < cx else 1])
    lay.rect(cx - 9, G - 128, cx + 8, G - 90, lambda x, y: R['tire'][3 if x < cx - 6 else 2 if x < cx + 6 else 1])
    for i, (c, on) in enumerate((('red', 0), ('gold', 0), ('leaf', 1))):
        cy = G - 120 + i * 12
        for (x, y) in lay.ellpts(cx, cy, 4.2, 4.2): lay.px(x, y, R[c][4 if on and (x + y) % 3 == 0 else 3 if on else 1])
        for x in range(cx - 6, cx + 6): lay.px(x, cy - 6, R['tire'][0])
    layer_out(cv, lay)
    cv.fx.append(('glow', cx, G - 96))
    return cv, cx


@vprop('hydrant', 'Fire hydrant', 0.2, 0, ['city', 'town'], solid=0.2)
def p_hydrant(rng):
    W, H = 30, 40; G = H - 2; cx = 15
    cv = Cv(W, H); Rr = R['red']
    for y in range(G - 26, G - 2):
        for x in range(cx - 6, cx + 6): cv.px(x, y, Rr[xt(x, cx - 6, cx + 6)])
    for (x, y) in cv.ellpts(cx, G - 27, 6, 5): cv.px(x, y, Rr[3 if y < G - 28 else 2])
    cv.rect(cx - 1, G - 34, cx, G - 31, Rr[3])
    for s in (-1, 1): cv.rect(cx + s * 7 - 1, G - 20, cx + s * 7 + 1, G - 16, Rr[2 if s < 0 else 1])
    cv.rect(cx - 8, G - 3, cx + 7, G, R['iron'][2])
    cv.outline()
    return cv, cx


@vprop('phone_booth', 'Phone booth', 0.5, 0, ['city'], box=[1.0, 1.0])
def p_phone_booth(rng):
    W, H = 50, 104; G = H - 2; cx = 25
    cv = Cv(W, H); Rr = R['red']
    for y in range(G - 92, G + 1):
        for x in range(cx - 18, cx + 18): cv.px(x, y, Rr[xt(x, cx - 18, cx + 18)])
    cv.poly([(cx - 20, G - 92), (cx - 14, G - 100), (cx + 14, G - 100), (cx + 20, G - 92)], lambda x, y: Rr[3 if x < cx else 2])
    cv.rect(cx - 13, G - 90, cx + 12, G - 84, R['white'][3])
    for i in range(3):
        for j in range(2):
            window(cv, cx - 13 + j * 13, G - 80 + i * 22, 12, 20, Rf=Rr, cross=False, sill=False, rec=None)
    cv.outline()
    return cv, cx


@vprop('food_truck', 'Food truck', 1.0, 0, ['city', 'town'], box=[3.4, 1.6])
def p_food_truck(rng):
    W, H = 136, 92; G = H - 2; cx = 68
    cv = Cv(W, H); Rb = R['white']; Rt = R['teal']
    body = Cv(W, H)
    for y in range(G - 78, G - 10):
        for x in range(cx - 60, cx + 58):
            t = 2
            if y < G - 76: t = 4
            elif y > G - 16: t = 1
            if x > cx + 54: t = 1
            body.px(x, y, Rb[t])
    for y in range(G - 40, G - 32):
        for x in range(cx - 60, cx + 58): body.px(x, y, Rt[(4, 3, 3, 2, 2, 1, 1, 0)[y - (G - 40)]])
    # cab window and serving hatch
    window(body, cx + 30, G - 70, 22, 22, Rf=Rb, cross=False, sill=False, rec=None)
    body.rect(cx - 50, G - 70, cx + 18, G - 46, R['tire'][1])
    for x in range(cx - 48, cx + 16, 9):
        c = rng.choice(['coral', 'gold', 'mint'])
        body.rect(x, G - 56, x + 5, G - 47, R[c][2]); body.px(x, G - 56, R[c][4])
    body.rect(cx - 52, G - 46, cx + 20, G - 43, R['wood'][3])
    layer_out(cv, body)
    awning(cv, cx - 54, cx + 22, G - 82, 12, R['coral'], R['white'], sw=6, slope=4)
    for wx in (cx - 38, cx + 36):
        for (x, y) in cv.ellpts(wx, G - 9, 9, 9): cv.px(x, y, R['tire'][1 if (x - wx) ** 2 + (y - G + 9) ** 2 > 30 else 3])
    cv.outline()
    return cv, cx


@vprop('newsstand', 'Newsstand', 0.8, 0, ['city'], box=[1.9, 1.2])
def p_newsstand(rng):
    W, H = 76, 88; G = H - 2; cx = 38
    cv = Cv(W, H); Rg = R['leaf']
    for y in range(G - 62, G + 1):
        for x in range(cx - 32, cx + 32): cv.px(x, y, Rg[xt(x, cx - 32, cx + 32)] if y < G - 30 or y > G - 4 else R['wood'][2])
    cv.poly([(cx - 36, G - 62), (cx - 28, G - 78), (cx + 28, G - 78), (cx + 36, G - 62)], lambda x, y: Rg[4 if y < G - 74 else 3])
    cv.rect(cx - 26, G - 58, cx + 25, G - 34, R['tire'][1])
    for i in range(6):
        c = rng.choice(['coral', 'gold', 'sky', 'pink', 'mint', 'lilac']); x = cx - 25 + i * 8 + (i // 3) * 2
        cv.rect(x, G - 30, x + 6, G - 6, R[c][2]); cv.rect(x + 1, G - 28, x + 5, G - 26, R['white'][3])
    cv.outline()
    return cv, cx


@vprop('bus_shelter', 'Bus shelter', 0.9, 0, ['city', 'town'], box=[2.8, 1.0])
def p_bus_shelter(rng):
    W, H = 104, 92; G = H - 2; cx = 52
    cv = Cv(W, H); Ri = R['iron']
    for x0 in (cx - 46, cx + 42):
        pole(cv, x0 + 2, G - 80, G, Ri)
    for y in range(G - 86, G - 78):
        for x in range(cx - 50, cx + 50): cv.px(x, y, R['teal'][(4, 3, 3, 2, 2, 1, 1, 0)[y - (G - 86)]])
    window(cv, cx - 42, G - 74, 84, 46, Rf=Ri, cross=False, sill=False, rec=None)
    cv.rect(cx - 28, G - 66, cx - 8, G - 44, R['gold'][3]); coin_emblem(cv, cx - 18, G - 55, 6)
    for x in range(cx - 36, cx + 36): cv.px(x, G - 20, R['wood'][3]); cv.px(x, G - 19, R['wood'][1])
    for x in (cx - 30, cx + 28):
        for y in range(G - 18, G): cv.px(x, y, Ri[1])
    cv.outline()
    return cv, cx


@vprop('bollard', 'Bollard', 0.12, 0, ['city'], solid=0.15)
def p_bollard(rng):
    W, H = 16, 32; G = H - 2; cx = 8
    cv = Cv(W, H)
    for y in range(G - 24, G + 1):
        for x in range(cx - 4, cx + 4): cv.px(x, y, R['iron'][xt(x, cx - 4, cx + 4)] if not (G - 20 < y < G - 16) else R['gold'][3])
    for (x, y) in cv.ellpts(cx, G - 24, 4, 3): cv.px(x, y, R['iron'][3])
    cv.outline()
    return cv, cx


@vprop('bike_rack', 'Bike rack', 0.4, 0, ['city'], solid=0.4)
def p_bike_rack(rng):
    W, H = 80, 44; G = H - 2; cx = 40
    cv = Cv(W, H)
    for i, c in enumerate(('coral', 'sky')):
        bx = cx - 18 + i * 34; lay = Cv(W, H)
        for wx in (bx - 10, bx + 10):
            for (x, y) in lay.ellpts(wx, G - 8, 8, 8):
                d = (x + .5 - wx) ** 2 + (y + .5 - G + 8) ** 2
                if d > 40: lay.px(x, y, R['tire'][1])
                elif d < 4: lay.px(x, y, R['iron'][3])
        for a, b in (((bx - 10, G - 8), (bx, G - 8)), ((bx, G - 8), (bx + 6, G - 20)), ((bx - 10, G - 8), (bx - 4, G - 20)), ((bx - 4, G - 20), (bx + 6, G - 20)), ((bx + 6, G - 20), (bx + 10, G - 8))):
            lay.line(a[0], a[1], b[0], b[1], R[c][2], 2)
        lay.rect(bx - 6, G - 24, bx - 2, G - 22, R['tire'][2]); lay.line(bx + 6, G - 20, bx + 8, G - 26, R['iron'][2])
        layer_out(cv, lay)
    for x in range(cx - 32, cx + 32): cv.px(x, G - 1, R['iron'][2])
    return cv, cx


@vprop('bench_metal', 'Park bench', 0.5, 0, ['city', 'town'], box=[1.7, 0.6])
def p_bench_metal(rng):
    W, H = 64, 38; G = H - 2; cx = 32
    cv = Cv(W, H); Rw = R['plank']; Ri = R['iron']
    for k in range(3):
        y = G - 30 + k * 5
        for x in range(cx - 28, cx + 28): cv.px(x, y, Rw[3]); cv.px(x, y + 1, Rw[2]); cv.px(x, y + 2, Rw[1])
    for k in range(2):
        y = G - 14 + k * 4
        for x in range(cx - 29, cx + 29): cv.px(x, y, Rw[4 if k == 0 else 2]); cv.px(x, y + 1, Rw[2])
    for x in (cx - 25, cx + 23):
        for y in range(G - 32, G + 1): cv.px(x, y, Ri[2]); cv.px(x + 1, y, Ri[1])
    cv.outline()
    return cv, cx


@vprop('trash_city', 'Litter bin', 0.25, 0, ['city', 'town'], solid=0.22)
def p_trash_city(rng):
    W, H = 30, 42; G = H - 2; cx = 15
    cv = Cv(W, H); Rg = R['pine']
    for y in range(G - 30, G + 1):
        hw = 9 - (y - (G - 30)) * .06
        for x in range(int(cx - hw), int(cx + hw) + 1): cv.px(x, y, Rg[xt(x, cx - hw, cx + hw)] if (x - cx) % 4 else Rg[0])
    cv.rect(cx - 10, G - 33, cx + 9, G - 30, R['iron'][3])
    cv.outline()
    return cv, cx


@vprop('street_tree', 'Street tree', 0.9, 0.3, ['city', 'town'], group='tree_street', solid=0.35)
def p_street_tree(rng):
    W, H = 96, 136; G = H - 2; cx = 48
    cv = Cv(W, H)
    gr = Cv(W, H)
    for x in range(cx - 18, cx + 18):
        for y in range(G - 3, G + 1): gr.px(x, y, R['iron'][1 if (x - cx) % 4 == 0 else 2 if y == G - 3 else 1])
    layer_out(cv, gr)
    tr = Cv(W, H)
    trunk(tr, [(cx - 5, G - 2), (cx - 3, G - 60), (cx - 14, G - 78), (cx - 10, G - 80), (cx, G - 66), (cx + 9, G - 84), (cx + 12, G - 82), (cx + 3, G - 60), (cx + 5, G - 2)], R['bark'], rng)
    tr.outline(); cv.paste(tr)
    fol = Cv(W, H)
    for (bx, by, rx, ry, b) in ((cx - 18, G - 90, 22, 18, .04), (cx + 18, G - 92, 22, 18, -.02), (cx, G - 106, 26, 20, .06), (cx, G - 84, 30, 14, -.05)):
        blob(fol, bx, by, rx, ry, R['leafy'], rng, cell=7, bias=b)
    fol.outline(); cv.paste(fol)
    return cv, cx


@vprop('planter_round', 'Round planter', 0.4, 0.2, ['city', 'town'], solid=0.45)
def p_planter_round(rng):
    W, H = 56, 46; G = H - 2; cx = 28
    cv = Cv(W, H)
    for y in range(G - 14, G + 1):
        hw = 20 - (y - (G - 14)) * .3
        for x in range(int(cx - hw), int(cx + hw) + 1): cv.px(x, y, R['stone'][xt(x, cx - hw, cx + hw)] if y > G - 13 else R['stone'][4])
    fl = Cv(W, H)
    blob(fl, cx, G - 22, 18, 9, R['leaf'], rng, cell=5)
    fl.outline(); cv.paste(fl)
    for _ in range(9):
        x = cx + rng.randint(-15, 14); y = G - 22 + rng.randint(-7, 4); c = R[rng.choice(['pink', 'gold', 'coral', 'white'])]
        cv.px(x, y, c[3]); cv.px(x + 1, y, c[2]); cv.px(x, y + 1, c[2]); cv.px(x + 1, y + 1, c[1])
    return cv, cx


@vprop('banner_pole', 'Banner lamp', 0.3, 0.15, ['city'], solid=0.2)
def p_banner_pole(rng):
    W, H = 56, 142; G = H - 2; cx = 22
    cv = Cv(W, H); lay = Cv(W, H); Ri = R['iron']
    pole(lay, cx, G - 118, G, Ri)
    lay.rect(cx - 6, G - 3, cx + 5, G, lambda x, y: Ri[3 if x < cx else 1])
    glow_box(lay, cx - 5, G - 134, 10, 14)
    lay.poly([(cx - 8, G - 134), (cx, G - 140), (cx + 8, G - 134)], Ri[2])
    for x in range(cx, cx + 26): lay.px(x, G - 108, Ri[2])
    layer_out(cv, lay)
    bn = Cv(W, H)
    for y in range(G - 106, G - 60):
        for x in range(cx + 3, cx + 25):
            if y > G - 66 and abs(x - (cx + 14)) < (y - (G - 66)) * 1.2: continue
            bn.px(x, y, R['teal'][3 if x < cx + 6 else 2 if x < cx + 22 else 1])
    coin_emblem(bn, cx + 14, G - 90, 7)
    layer_out(cv, bn)
    cv.fx.append(('glow', cx, G - 127))
    return cv, cx


@vprop('billboard', 'Billboard', 1.2, 0, ['city', 'route'], box=[3.6, 0.5])
def p_billboard(rng):
    W, H = 140, 120; G = H - 2; cx = 70
    cv = Cv(W, H)
    for x0 in (cx - 40, cx + 34):
        for y in range(G - 60, G + 1):
            for x in range(x0, x0 + 6): cv.px(x, y, R['iron'][xt(x, x0, x0 + 6)])
    for y in range(G - 112, G - 58):
        for x in range(cx - 64, cx + 64):
            edge = y in (G - 112, G - 59) or x in (cx - 64, cx + 63)
            cv.px(x, y, R['white'][4 if edge and y == G - 112 else 1 if edge else 3])
    cv.rect(cx - 60, G - 108, cx + 59, G - 63, R['sky'][3])
    for y in range(G - 90, G - 63):
        for x in range(cx - 60, cx + 60):
            if y > G - 90 + 10 * math.sin((x - cx) / 20) + 8: cv.px(x, y, R['leaf'][3 if (x + y) % 9 else 2])
    coin_emblem(cv, cx + 30, G - 90, 13)
    for k, c in enumerate(('coral', 'gold', 'white')):
        cv.rect(cx - 52, G - 102 + k * 9, cx - 52 + 50 - k * 12, G - 97 + k * 9, R[c][3])
    cv.outline()
    return cv, cx


@vprop('crosswalk', 'Crosswalk', 0, 0, ['city'], flat=1)
def p_crosswalk(rng):
    W, H = 104, 60; cx = 52
    cv = Cv(W, H)
    for i in range(7):
        x0 = 4 + i * 14
        for y in range(4, 56):
            for x in range(x0, x0 + 9):
                if rng.random() < .04: continue
                cv.px(x, y, (232, 232, 226) if (x + y) % 11 else (210, 210, 204))
    return cv, cx


@vprop('manhole', 'Manhole', 0, 0, ['city'], flat=1)
def p_manhole(rng):
    W, H = 30, 22; cx = 15
    cv = Cv(W, H)
    for (x, y) in cv.ellpts(15, 11, 13, 9): cv.px(x, y, R['iron'][1 if (x + y) % 3 else 0])
    for (x, y) in cv.ellpts(15, 11, 11, 7):
        if (x + y) % 4 == 0: cv.px(x, y, R['iron'][2])
    return cv, cx


@vprop('cafe_table', 'Café table', 0.5, 0.05, ['city', 'town'], solid=0.55)
def p_cafe_table(rng):
    W, H = 80, 90; G = H - 2; cx = 40
    cv = Cv(W, H); c = rng.choice(['coral', 'teal'])
    for s in (-1, 1):
        ch = Cv(W, H); x0 = cx + s * 22
        for y in range(G - 24, G + 1): ch.px(x0 - 6, y, R['iron'][1]); ch.px(x0 + 6, y, R['iron'][1])
        ch.rect(x0 - 7, G - 13, x0 + 7, G - 11, R['plank'][3])
        for y in range(G - 26, G - 12): ch.px(x0 + s * 6, y, R['iron'][2])
        layer_out(cv, ch)
    tb = Cv(W, H)
    for y in range(G - 74, G + 1): tb.px(cx, y, R['iron'][2]); tb.px(cx + 1, y, R['iron'][1])
    for (x, y) in tb.ellpts(cx, G - 20, 14, 3): tb.px(x, y, R['white'][3 if y < G - 20 else 2])
    tb.rect(cx - 5, G - 24, cx - 2, G - 21, R['white'][4]); tb.px(cx + 4, G - 23, R['coral'][3])
    layer_out(cv, tb)
    um = Cv(W, H)
    for y in range(G - 86, G - 70):
        f = (y - (G - 86)) / 16; hw = 6 + 30 * f
        for x in range(int(cx - hw), int(cx + hw) + 1):
            u = int((x - cx + 40) // 9) % 2
            um.px(x, y, R[c if u else 'white'][3 if x < cx - hw * .3 else 2 if x < cx + hw * .5 else 1])
    for x in range(cx - 36, cx + 37): um.px(x, G - 70, R[c][0])
    layer_out(cv, um)
    return cv, cx


@vprop('vending', 'Vending machine', 0.4, 0, ['city'], box=[1.0, 0.8])
def p_vending(rng):
    W, H = 44, 76; G = H - 2; cx = 22
    cv = Cv(W, H); Rc = R['coral']
    for y in range(G - 70, G + 1):
        for x in range(cx - 17, cx + 17): cv.px(x, y, Rc[xt(x, cx - 17, cx + 17)])
    cv.rect(cx - 13, G - 64, cx + 4, G - 26, R['glass'][1])
    for row in range(4):
        for i in range(3):
            c = rng.choice(['gold', 'sky', 'mint', 'white', 'pink'])
            cv.rect(cx - 11 + i * 5, G - 60 + row * 9, cx - 9 + i * 5, G - 55 + row * 9, R[c][3])
    cv.rect(cx + 7, G - 60, cx + 12, G - 40, R['tire'][1]); cv.rect(cx - 11, G - 18, cx + 4, G - 12, R['tire'][0])
    cv.outline()
    cv.fx.append(('glow', cx - 4, G - 46))
    return cv, cx


@vprop('mailbox_blue', 'Post box', 0.25, 0, ['city', 'town'], solid=0.22)
def p_mailbox_blue(rng):
    W, H = 30, 52; G = H - 2; cx = 15
    cv = Cv(W, H); Rb = R['blue']
    for y in range(G - 40, G - 8):
        for x in range(cx - 9, cx + 9): cv.px(x, y, Rb[xt(x, cx - 9, cx + 9)])
    for (x, y) in cv.ellpts(cx, G - 40, 9, 6): cv.px(x, y, Rb[3 if y < G - 41 else 2])
    cv.rect(cx - 6, G - 34, cx + 5, G - 32, R['tire'][0])
    for x in (cx - 7, cx + 6):
        for y in range(G - 8, G + 1): cv.px(x, y, R['iron'][1])
    cv.outline()
    return cv, cx


@vprop('flag_pole', 'Flag pole', 0.3, 0.5, ['city', 'town'], solid=0.2)
def p_flag_pole(rng):
    W, H = 70, 170; G = H - 2; cx = 16
    cv = Cv(W, H); lay = Cv(W, H)
    pole(lay, cx, G - 160, G, R['white'], 3)
    lay.rect(cx - 6, G - 6, cx + 5, G, R['stone'][2])
    for (x, y) in lay.ellpts(cx, G - 162, 3, 3): lay.px(x, y, R['gold'][3])
    layer_out(cv, lay)
    fl = Cv(W, H)
    for y in range(G - 156, G - 124):
        for x in range(cx + 2, cx + 50):
            k = x - cx; wv = int(3 * math.sin(k / 8))
            yy = y + wv
            fl.px(x, yy, R['teal'][3 if (k // 4 + (y // 3)) % 7 == 0 else 2] if y < G - 140 else R['gold'][2])
    coin_emblem(fl, cx + 24, G - 140, 7)
    layer_out(cv, fl)
    return cv, cx


@vprop('statue_coin', 'Golden coin sculpture', 1.0, 0, ['city'], solid=0.9)
def p_statue_coin(rng):
    W, H = 96, 140; G = H - 2; cx = 48
    cv = Cv(W, H); Rm = R['marble']
    pl = Cv(W, H)
    pl.rect(cx - 34, G - 8, cx + 33, G, lambda x, y: Rm[3 if y == G - 8 else 2 if x < cx + 30 else 1])
    for y in range(G - 44, G - 8):
        for x in range(cx - 26, cx + 26): pl.px(x, y, Rm[xt(x, cx - 26, cx + 26, (.12, .7, .9))])
    pl.rect(cx - 30, G - 50, cx + 29, G - 44, lambda x, y: Rm[4 if y == G - 50 else 3 if y < G - 46 else 1])
    pl.rect(cx - 16, G - 34, cx + 15, G - 18, R['gold'][1]); pl.rect(cx - 15, G - 33, cx + 14, G - 19, R['gold'][3])
    layer_out(cv, pl)
    cn = Cv(W, H)
    coin_emblem(cn, cx, G - 86, 34)
    cn.outline(); cv.paste(cn)
    cv.fx.append(('sparkle', cx - 14, G - 104))
    return cv, cx


@vprop('fountain_big', 'Plaza fountain', 1.8, 0, ['city', 'town'], solid=1.7)
def p_fountain_big(rng):
    W, H = 170, 120; G = H - 2; cx = 85
    cv = Cv(W, H); Rs = R['marble']
    bs = Cv(W, H)
    for (x, y) in bs.ellpts(cx, G - 14, 78, 18):
        bs.px(x, y, Rs[3 if y < G - 22 else 2 if x < cx + 50 else 1])
    for (x, y) in bs.ellpts(cx, G - 20, 70, 13): bs.px(x, y, R['water'][3 if (x + 2 * y) % 13 == 0 else 2 if y < G - 22 else 1])
    for y in range(G - 14, G + 1):
        for x in range(cx - 78, cx + 78):
            if ((x + .5 - cx) / 78) ** 2 <= 1: bs.px(x, y, Rs[xt(x, cx - 78, cx + 78)] if y > G - 12 else Rs[3])
    layer_out(cv, bs)
    tw = Cv(W, H)
    for y in range(G - 60, G - 18):
        for x in range(cx - 8, cx + 8): tw.px(x, y, Rs[xt(x, cx - 8, cx + 8)])
    for (x, y) in tw.ellpts(cx, G - 60, 32, 8): tw.px(x, y, Rs[3 if y < G - 61 else 1])
    for (x, y) in tw.ellpts(cx, G - 62, 26, 5): tw.px(x, y, R['water'][2])
    for y in range(G - 92, G - 62):
        for x in range(cx - 5, cx + 5): tw.px(x, y, Rs[xt(x, cx - 5, cx + 5)])
    for (x, y) in tw.ellpts(cx, G - 92, 16, 5): tw.px(x, y, Rs[3])
    layer_out(cv, tw)
    cv.fx += [('spray', cx, G - 96), ('spray', cx, G - 64)]
    return cv, cx


def car_side(Rc, rng, W=124, H=60):
    G = H - 2; cx = W // 2
    cv = Cv(W, H)
    b = Cv(W, H)
    pts = [(cx - 58, G - 10), (cx - 58, G - 24), (cx - 50, G - 30), (cx - 30, G - 32), (cx - 20, G - 48), (cx + 22, G - 48), (cx + 36, G - 32), (cx + 56, G - 28), (cx + 58, G - 12)]
    b.poly(pts, lambda x, y: Rc[4 if y < G - 44 else 3 if y < G - 30 else 2 if y < G - 18 else 1])
    for (a0, a1) in (((cx - 16, G - 45), (cx + 2, G - 33)), ((cx + 5, G - 45), (cx + 30, G - 33))):
        b.poly([(a0[0], a1[1]), (a0[0] + 4, a0[1]), (a1[0] - (6 if a1[0] > cx + 20 else 0), a0[1]), (a1[0], a1[1])], lambda x, y: R['glass'][3 if (x + y) % 9 < 3 else 1])
    for x in range(cx - 56, cx + 57): b.px(x, G - 22, Rc[1])
    b.rect(cx - 58, G - 26, cx - 54, G - 22, R['gold'][4]); b.rect(cx + 54, G - 24, cx + 58, G - 20, R['red'][3])
    b.rect(cx - 4, G - 30, cx + 2, G - 29, Rc[0])
    layer_out(cv, b)
    for wx in (cx - 34, cx + 36):
        for (x, y) in cv.ellpts(wx, G - 8, 9, 9):
            d = (x + .5 - wx) ** 2 + (y + .5 - G + 8) ** 2
            cv.px(x, y, R['tire'][1] if d > 26 else R['iron'][3] if d > 8 else R['iron'][1])
    cv.outline()
    return cv, cx


for _ck, _cn, _cc in (('car_red', 'Parked car (red)', 'coral'), ('car_blue', 'Parked car (blue)', 'sky'), ('car_yellow', 'Parked car (yellow)', 'gold'), ('car_mint', 'Parked car (mint)', 'mint')):
    def _mk(cc):
        return lambda rng: car_side(R[cc], rng)
    vprop(_ck, _cn, 1.0, 0, ['city'], group='car', box=[3.4, 1.4])(_mk(_cc))


# ----------------------------------------------------------------------------- nature and farm
def frond(cv, x0, y0, ang, L, Rf, rng, w=3.0):
    pts = []
    for k in range(int(L)):
        t = k / L; a = ang + .9 * t * t * (1 if ang < -1.57 else -1)
        x = x0 + math.cos(a) * k; y = y0 + math.sin(a) * k
        pts.append((x, y))
        hw = w * (1 - t) + .5
        for s in (-1, 1):
            for j in range(1, int(hw * 2) + 1):
                if (k + j) % 3 == 0: continue
                xx = x + math.cos(a + s * 1.2) * j * .6; yy = y + math.sin(a + s * 1.2) * j * .6
                cv.px(int(xx), int(yy), Rf[3 if s < 0 and j < 3 else 2 if j < 4 else 1])
        cv.px(int(x), int(y), Rf[1])


@vprop('fern', 'Fern', 0.25, 0.7, ['route', 'forest'], group='fern')
def p_fern(rng):
    W, H = 60, 40; G = H - 2; cx = 30
    cv = Cv(W, H)
    for a, L in ((-2.7, 26), (-2.2, 30), (-1.75, 32), (-1.35, 30), (-.9, 27), (-.45, 22), (-2.95, 18)):
        frond(cv, cx + rng.randint(-2, 2), G, a, L, R['pine'] if rng.random() < .5 else R['leaf'], rng)
    cv.outline()
    return cv, cx


@vprop('fern_b', 'Young fern', 0.2, 0.7, ['route', 'forest'], group='fern')
def p_fern_b(rng):
    W, H = 44, 32; G = H - 2; cx = 22
    cv = Cv(W, H)
    for a, L in ((-2.5, 20), (-1.9, 24), (-1.3, 23), (-.7, 19)):
        frond(cv, cx, G, a, L, R['leafy'], rng, 2.5)
    cv.outline()
    return cv, cx


@vprop('fallen_leaves', 'Fallen leaves', 0, 0, ['route', 'forest', 'town'], flat=1)
def p_fallen_leaves(rng):
    W, H = 64, 34; cx = 32
    cv = Cv(W, H)
    for _ in range(40):
        a = rng.uniform(0, 6.28); r = rng.random() ** .6
        x = int(32 + math.cos(a) * 28 * r); y = int(17 + math.sin(a) * 14 * r)
        c = R[rng.choice(['orange', 'gold', 'rust', 'coral', 'hay'])]
        cv.px(x, y, c[3]); cv.px(x + 1, y, c[2]); cv.px(x, y + 1, c[1])
    return cv, cx


@vprop('pebbles', 'Pebbles', 0, 0, ['route', 'town'], flat=1)
def p_pebbles(rng):
    W, H = 44, 24; cx = 22
    cv = Cv(W, H)
    for _ in range(14):
        x = rng.randint(4, 38); y = rng.randint(3, 19); rx = rng.uniform(1.5, 3.2)
        for (xx, yy) in cv.ellpts(x, y, rx, rx * .7): cv.px(xx, yy, R['stone'][3 if yy < y else 1 if xx > x else 2])
    return cv, cx


@vprop('puddle', 'Puddle', 0, 0, ['route', 'town', 'city'], flat=1)
def p_puddle(rng):
    W, H = 64, 30; cx = 32
    cv = Cv(W, H)
    pts = cv.ellpts(32, 15, 28, 11) + cv.ellpts(20, 12, 14, 8)
    for (x, y) in set(pts):
        d = ((x - 32) / 28) ** 2 + ((y - 15) / 11) ** 2
        cv.px(x, y, R['water'][4 if (x - y) % 17 == 0 and d < .6 else 3 if d < .5 else 2])
    return cv, cx


@vprop('rock_flat', 'Flat stone', 0.5, 0, ['route', 'town'], solid=0.6)
def p_rock_flat(rng):
    W, H = 76, 28; G = H - 2; cx = 38
    cv = Cv(W, H)
    pts = [(cx - 34, G), (cx - 30, G - 10), (cx - 14, G - 16), (cx + 16, G - 15), (cx + 33, G - 8), (cx + 35, G)]
    for (x, y) in cv.polypts(pts):
        t = 3 if y < G - 11 else 2 if y < G - 4 else 1
        if x > cx + 24: t = max(0, t - 1)
        cv.px(x, y, R['rock'][t])
    for _ in range(6):
        x = cx + rng.randint(-24, 20); y = G - rng.randint(5, 12)
        cv.px(x, y, R['moss'][3]); cv.px(x + 1, y, R['moss'][2])
    cv.outline()
    return cv, cx


@vprop('tree_willow', 'Willow', 1.5, 0.45, ['route', 'water'], group='tree_willow', solid=0.45)
def p_tree_willow(rng):
    W, H = 180, 168; G = H - 2; cx = 90
    cv = Cv(W, H)
    tr = Cv(W, H)
    trunk(tr, [(cx - 12, G), (cx - 8, G - 50), (cx - 26, G - 90), (cx - 20, G - 92), (cx - 2, G - 64), (cx + 4, G - 96), (cx + 10, G - 94), (cx + 8, G - 52), (cx + 13, G)], R['bark'], rng)
    tr.outline(); cv.paste(tr)
    fol = Cv(W, H)
    for (bx, by, rx, ry, b) in ((cx - 30, G - 112, 36, 24, .05), (cx + 30, G - 110, 36, 24, -.02), (cx, G - 128, 40, 24, .07)):
        blob(fol, bx, by, rx, ry, R['leafy'], rng, cell=7, bias=b)
    # hanging strands
    for k in range(34):
        x0 = cx - 70 + k * 4.2 + rng.uniform(-1, 1); y0 = G - 118 + abs(k - 17) * 1.2 + rng.randint(-4, 4)
        L = rng.randint(34, 70) - abs(k - 17)
        for j in range(L):
            x = int(x0 + math.sin(j / 9 + k) * 1.5); y = int(y0 + j)
            if y > G - 6: break
            fol.px(x, y, R['leafy'][3 if j % 5 == 0 else 2 if x < cx else 1])
            if j % 3 == 0: fol.px(x + 1, y, R['leafy'][1])
    fol.outline(); cv.paste(fol)
    return cv, cx


@vprop('tree_maple', 'Red maple', 1.3, 0.35, ['route', 'town'], group='tree_maple', solid=0.45)
def p_tree_maple(rng):
    W, H = 160, 160; G = H - 2; cx = 80
    tp = [(cx - 12, 1), (cx - 7, -8), (cx - 6, -44), (cx - 26, -66), (cx - 20, -70), (cx - 1, -52), (cx + 3, -58), (cx + 22, -74), (cx + 28, -70), (cx + 7, -46), (cx + 8, -8), (cx + 13, 1)]
    blobs = [(cx, 52, 40, 26, 0), (cx - 40, 64, 26, 20, .02), (cx + 40, 62, 26, 20, -.04), (cx - 18, 36, 26, 18, .06), (cx + 18, 36, 26, 18, .03), (cx, 74, 34, 16, -.05)]
    Rm = ramp((214, 92, 52)); Ro = ramp((236, 150, 62))
    return oak_tree(rng, W, H, tp, blobs, [5, 1, 2, 0, 3, 4], [Rm, Ro, Rm, Ro, Rm, Rm], cell=7)


@vprop('birdhouse', 'Birdhouse', 0.15, 0, ['town', 'farm', 'route'], solid=0.15)
def p_birdhouse(rng):
    W, H = 30, 84; G = H - 2; cx = 15
    cv = Cv(W, H)
    pole(cv, cx, G - 56, G, R['wood'])
    for y in range(G - 74, G - 54):
        for x in range(cx - 9, cx + 9): cv.px(x, y, R['plank'][xt(x, cx - 9, cx + 9)])
    cv.poly([(cx - 12, G - 72), (cx, G - 82), (cx + 12, G - 72)], lambda x, y: R['coral'][3 if x < cx else 1])
    for (x, y) in cv.ellpts(cx, G - 64, 3, 3): cv.px(x, y, R['dwood'][0])
    cv.outline()
    return cv, cx


@vprop('beehive', 'Beehives', 0.35, 0, ['farm'], solid=0.35)
def p_beehive(rng):
    W, H = 44, 50; G = H - 2; cx = 22
    cv = Cv(W, H)
    for k in range(3):
        y0 = G - 12 - k * 11
        for y in range(y0, y0 + 11):
            for x in range(cx - 14, cx + 14): cv.px(x, y, R['cream'][3 if y == y0 else xt(x, cx - 14, cx + 14)])
    cv.rect(cx - 17, G - 46, cx + 16, G - 43, R['white'][3])
    cv.rect(cx - 4, G - 4, cx + 3, G - 2, R['dwood'][0])
    for y in range(G - 2, G + 1):
        for x in range(cx - 16, cx + 16): cv.px(x, y, R['wood'][1])
    cv.outline()
    return cv, cx


@vprop('scarecrow', 'Scarecrow', 0.35, 0.35, ['farm'], solid=0.2)
def p_scarecrow(rng):
    W, H = 70, 110; G = H - 2; cx = 35
    cv = Cv(W, H)
    pole(cv, cx, G - 80, G, R['wood'])
    for x in range(cx - 30, cx + 30): cv.px(x, G - 70, R['wood'][3]); cv.px(x, G - 69, R['wood'][1])
    sh = Cv(W, H)
    sh.poly([(cx - 26, G - 72), (cx + 26, G - 72), (cx + 14, G - 40), (cx - 14, G - 40)], lambda x, y: R['sky'][3 if x < cx - 6 else 2 if (x // 6) % 2 else 1])
    for x in (cx - 26, cx + 22):
        for k in range(6): sh.px(x + k, G - 72 + 3, R['hay'][3]); sh.px(x + k, G - 72 + 4 + (k % 2), R['hay'][2])
    sh.rect(cx - 12, G - 40, cx + 11, G - 36, R['soil'][2])
    layer_out(cv, sh)
    hd = Cv(W, H)
    ball(hd, cx, G - 82, 9, 9, R['hay'])
    hd.px(cx - 3, G - 83, R['dwood'][0]); hd.px(cx + 3, G - 83, R['dwood'][0])
    for x in range(cx - 4, cx + 5): hd.px(x, G - 78, R['dwood'][1])
    hd.poly([(cx - 16, G - 88), (cx + 16, G - 88), (cx + 8, G - 92), (cx + 4, G - 102), (cx - 6, G - 102), (cx - 8, G - 92)], lambda x, y: R['wood'][3 if y < G - 96 else 2])
    layer_out(cv, hd)
    return cv, cx


@vprop('wheelbarrow', 'Wheelbarrow', 0.4, 0, ['farm', 'town'], solid=0.4)
def p_wheelbarrow(rng):
    W, H = 72, 40; G = H - 2; cx = 36
    cv = Cv(W, H)
    cv.poly([(cx - 22, G - 24), (cx + 18, G - 24), (cx + 12, G - 10), (cx - 16, G - 10)], lambda x, y: R['leaf'][3 if y < G - 20 else 2])
    cv.poly([(cx - 20, G - 25), (cx + 16, G - 25), (cx + 10, G - 30), (cx - 14, G - 30)], lambda x, y: R['soil'][2])
    for (x, y) in cv.ellpts(cx - 22, G - 7, 7, 7): cv.px(x, y, R['tire'][1])
    cv.line(cx + 12, G - 14, cx + 32, G - 22, R['wood'][2], 2)
    for x in (cx + 4, cx + 10): cv.line(x, G - 10, x + 2, G, R['iron'][1])
    cv.outline()
    return cv, cx


@vprop('firewood', 'Firewood stack', 0.6, 0, ['farm', 'route', 'town'], box=[1.8, 0.6])
def p_firewood(rng):
    W, H = 72, 42; G = H - 2; cx = 36
    cv = Cv(W, H)
    for row in range(4):
        n = 6 - (row % 2); y = G - 6 - row * 9
        for i in range(n):
            x = cx - 28 + i * 11 + (5 if row % 2 else 0)
            for (xx, yy) in cv.ellpts(x, y, 5, 4.5):
                d = (xx - x) ** 2 + (yy - y) ** 2
                cv.px(xx, yy, R['plank'][4 if d < 3 else 3 if d < 9 else R['bark'] and 1] if d < 14 else R['bark'][1])
    cv.outline()
    return cv, cx


@vprop('rowboat', 'Rowboat', 0.6, 0.05, ['water'], solid=0.9)
def p_rowboat(rng):
    W, H = 116, 40; G = H - 2; cx = 58
    cv = Cv(W, H)
    cv.poly([(cx - 52, G - 22), (cx + 52, G - 22), (cx + 40, G - 6), (cx - 40, G - 6)], lambda x, y: R['wood'][3 if y < G - 18 else 2 if y < G - 12 else 1])
    cv.poly([(cx - 46, G - 22), (cx + 46, G - 22), (cx + 38, G - 26), (cx - 38, G - 26)], R['dwood'][1])
    for x in range(cx - 50, cx + 51): cv.px(x, G - 16, R['white'][3])
    cv.line(cx - 10, G - 30, cx + 30, G - 18, R['wood'][3], 2)
    cv.outline()
    return cv, cx


@vprop('laundry_line', 'Laundry line', 0.3, 0.6, ['town', 'farm'], solid=0, posts=[{'x': -60, 'r': 0.2}, {'x': 60, 'r': 0.2}])
def p_laundry_line(rng):
    W, H = 136, 84; G = H - 2; cx = 68
    cv = Cv(W, H)
    for x in (cx - 60, cx + 60): pole(cv, x, G - 70, G, R['wood'])
    pts = []
    for k in range(121):
        x = cx - 60 + k; y = G - 66 + int(8 * math.sin(k / 120 * math.pi)); pts.append((x, y)); cv.px(x, y, R['white'][1])
    for i, (x, w, h, c) in enumerate(((cx - 46, 16, 22, 'coral'), (cx - 24, 22, 16, 'sky'), (cx + 4, 14, 26, 'gold'), (cx + 24, 18, 18, 'white'), (cx + 44, 10, 14, 'mint'))):
        y = pts[x - (cx - 60)][1]
        for yy in range(y, y + h):
            for xx in range(x, x + w): cv.px(xx, yy, R[c][3 if xx < x + 3 else 2 if xx < x + w - 2 else 1])
    cv.outline()
    return cv, cx


@vprop('garden_gnome', 'Garden gnome', 0.1, 0, ['town', 'farm'])
def p_garden_gnome(rng):
    W, H = 22, 34; G = H - 2; cx = 11
    cv = Cv(W, H)
    cv.rect(cx - 5, G - 12, cx + 4, G, lambda x, y: R['sky'][xt(x, cx - 5, cx + 5)])
    ball(cv, cx, G - 16, 4, 4, R['peach'])
    cv.rect(cx - 4, G - 13, cx + 3, G - 10, R['white'][3])
    cv.poly([(cx - 6, G - 18), (cx + 6, G - 18), (cx, G - 30)], lambda x, y: R['red'][3 if x < cx else 2])
    cv.outline()
    return cv, cx


@vprop('picket_fence', 'Picket fence', 0.3, 0, ['town', 'farm'], box=[2.2, 0.25])
def p_picket_fence(rng):
    W, H = 84, 36; G = H - 2; cx = 42
    cv = Cv(W, H); Rw = R['white']
    for x0 in range(cx - 40, cx + 36, 8):
        lay = Cv(W, H)
        for y in range(G - 26, G + 1):
            for x in range(x0, x0 + 5): lay.px(x, y, Rw[xt(x, x0, x0 + 5)])
        lay.poly([(x0, G - 26), (x0 + 2.5, G - 30), (x0 + 5, G - 26)], Rw[3])
        layer_out(cv, lay)
    for y in (G - 20, G - 8):
        for x in range(cx - 41, cx + 41): cv.px(x, y, Rw[3]); cv.px(x, y + 1, Rw[1])
    return cv, cx


@vprop('stone_wall', 'Stone wall', 0.4, 0, ['route', 'farm', 'town'], box=[2.2, 0.45])
def p_stone_wall(rng):
    W, H = 84, 36; G = H - 2; cx = 42
    cv = Cv(W, H)
    y = G
    for row in range(4):
        h = 7; x = cx - 40 + (row % 2) * 5
        while x < cx + 40:
            w = rng.randint(9, 15)
            for (xx, yy) in cv.ellpts(x + w / 2, y - h / 2, w / 2, h / 2 + .5):
                if cx - 41 <= xx <= cx + 40: cv.px(xx, yy, R['stone'][3 if yy < y - h + 2 else 1 if yy > y - 2 else 2])
            if rng.random() < .25: cv.px(x + 3, y - h + 1, R['moss'][3]); cv.px(x + 4, y - h + 1, R['moss'][2])
            x += w
        y -= h
    cv.outline()
    return cv, cx


@vprop('dock_post', 'Mooring post', 0.15, 0, ['water'], solid=0.15)
def p_dock_post(rng):
    W, H = 16, 44; G = H - 2; cx = 8
    cv = Cv(W, H)
    for y in range(G - 36, G + 1):
        for x in range(cx - 4, cx + 4): cv.px(x, y, R['dwood'][xt(x, cx - 4, cx + 4)])
    for (x, y) in cv.ellpts(cx, G - 36, 4, 2): cv.px(x, y, R['plank'][3])
    for y in (G - 24, G - 22): cv.rect(cx - 4, y, cx + 3, y, R['hay'][2])
    cv.outline()
    return cv, cx


# ----------------------------------------------------------------------------- moving life: frame strips
LIFE_DIR = os.path.join(GAME, 'art', 'scene', 'life')


def life_duck(f):
    W, H = 28, 22; cv = Cv(W, H); G = H - 3
    bob = (0, 1, 0, -1)[f % 4]
    for (x, y) in cv.ellpts(14, G - 5 + bob, 10, 5): cv.px(x, y, R['white'][3 if y < G - 6 + bob else 2])
    for (x, y) in cv.ellpts(16, G - 6 + bob, 5, 3): cv.px(x, y, R['hay'][2 if f % 2 else 3])
    for (x, y) in cv.ellpts(6, G - 12 + bob, 4, 4): cv.px(x, y, R['pine'][3 if y < G - 13 + bob else 2])
    cv.px(5, G - 13 + bob, OL); cv.rect(0, G - 12 + bob, 2, G - 11 + bob, R['orange'][3])
    for x in range(4, 26): cv.px(x, G + bob, R['water'][4] if x % 3 == f % 3 else None)
    cv.outline()
    return cv


def life_pigeon(f):
    W, H = 24, 22; cv = Cv(W, H); G = H - 2; Rg = ramp((150, 152, 176))
    if f >= 3:  # flying
        up = f == 3
        for (x, y) in cv.ellpts(12, G - 10, 7, 4): cv.px(x, y, Rg[3 if y < G - 10 else 2])
        cv.poly([(8, G - 11), (16, G - 11), (12 + (3 if up else 0), G - (20 if up else 4))], Rg[3 if up else 1])
        ball(cv, 5, G - 12, 3, 3, Rg); cv.px(1, G - 12, R['orange'][2])
    else:
        peck = f == 2; st = f % 2
        for (x, y) in cv.ellpts(13, G - 6, 7, 5): cv.px(x, y, Rg[3 if y < G - 7 else 2])
        cv.rect(14, G - 8, 19, G - 6, Rg[1])
        hx, hy = (6, G - 5) if peck else (7, G - 12)
        ball(cv, hx, hy, 3, 3, Rg); cv.px(hx - 1, hy - 1, OL); cv.px(hx - 3, hy, R['orange'][2])
        for (x, y) in ((8, G - 8), (9, G - 8)): cv.px(x, y, R['mint'][2])
        cv.px(11 + st, G - 1, R['coral'][1]); cv.px(14 - st, G - 1, R['coral'][1]); cv.px(11 + st, G, R['coral'][1]); cv.px(14 - st, G, R['coral'][1])
    cv.outline()
    return cv


def life_chicken(f):
    W, H = 26, 28; cv = Cv(W, H); G = H - 2; Rw = R['white']
    peck = f == 2; st = f % 2
    for (x, y) in cv.ellpts(14, G - 9, 8, 7): cv.px(x, y, Rw[3 if y < G - 10 else 2])
    cv.poly([(19, G - 14), (24, G - 20), (22, G - 10)], Rw[2])
    hx, hy = (7, G - 6) if peck else (8, G - 17)
    ball(cv, hx, hy, 4, 4, Rw); cv.rect(hx - 1, hy - 7, hx + 1, hy - 5, R['red'][3]); cv.px(hx - 2, hy - 1, OL); cv.rect(hx - 6, hy, hx - 4, hy + 1, R['gold'][3])
    for x in (12 + st, 16 - st):
        for y in range(G - 2, G + 1): cv.px(x, y, R['gold'][2])
    cv.outline()
    return cv


def life_sheep(f):
    W, H = 46, 34; cv = Cv(W, H); G = H - 2; Rw = ramp((236, 232, 222))
    graze = f == 2; st = f % 2
    for (bx, by, r) in ((16, G - 15, 9), (25, G - 17, 10), (33, G - 14, 8), (24, G - 11, 11)):
        ball(cv, bx, by, r, r * .85, Rw)
    hx, hy = (8, G - 8) if graze else (8, G - 18)
    ball(cv, hx, hy, 5, 4, R['tire']); cv.px(hx - 2, hy - 1, R['white'][4])
    for x in (14 + st * 2, 20, 28, 33 - st * 2):
        for y in range(G - 4, G + 1): cv.px(x, y, R['tire'][1]); cv.px(x + 1, y, R['tire'][0])
    cv.outline()
    return cv


def life_car(Rc, view, f):
    if view == 'side':
        cv, _ = car_side(Rc, random.Random(1)); return cv
    W, H = 70, 60; G = H - 2; cx = 35; cv = Cv(W, H)
    b = Cv(W, H)
    b.poly([(cx - 30, G - 8), (cx - 30, G - 26), (cx - 22, G - 30), (cx - 18, G - 46), (cx + 18, G - 46), (cx + 22, G - 30), (cx + 30, G - 26), (cx + 30, G - 8)],
           lambda x, y: Rc[4 if y < G - 42 else 3 if y < G - 30 else 2 if x < cx + 20 else 1])
    b.poly([(cx - 16, G - 32), (cx - 13, G - 43), (cx + 13, G - 43), (cx + 16, G - 32)], lambda x, y: R['glass'][3 if (x + y) % 9 < 3 else 1])
    if view == 'front':
        for s in (-1, 1): b.rect(cx + s * 22 - 4, G - 24, cx + s * 22 + 3, G - 19, R['lamp'][4])
        b.rect(cx - 12, G - 20, cx + 11, G - 14, R['iron'][1])
    else:
        for s in (-1, 1): b.rect(cx + s * 22 - 4, G - 24, cx + s * 22 + 3, G - 20, R['red'][3])
        b.rect(cx - 8, G - 20, cx + 7, G - 16, R['white'][3])
    layer_out(cv, b)
    for s in (-1, 1): cv.rect(cx + s * 24 - 4, G - 8, cx + s * 24 + 3, G, R['tire'][1])
    cv.outline()
    return cv


LIFE = {
    'duck': ('Duck', [lambda: life_duck(i) for i in range(4)], 1, 'water'),
    'pigeon': ('Pigeon', [lambda i=i: life_pigeon(i) for i in range(5)], 1, 'city'),
    'chicken': ('Chicken', [lambda i=i: life_chicken(i) for i in range(3)], 1, 'farm'),
    'sheep': ('Sheep', [lambda i=i: life_sheep(i) for i in range(3)], 1, 'farm'),
}
LIFE['duck'] = ('Duck', [lambda i=i: life_duck(i) for i in range(4)], 1, 'water')
for _ck, _cc in (('car_red', 'coral'), ('car_blue', 'sky'), ('car_yellow', 'gold'), ('car_mint', 'mint')):
    LIFE[_ck] = ('Car', [lambda cc=_cc, v=v: life_car(R[cc], v, 0) for v in ('side', 'front', 'back')], 1, 'city')


def build_life(keys, overwrite, written):
    """frame strips: every frame the same size, the base point at the bottom centre"""
    os.makedirs(LIFE_DIR, exist_ok=True); meta = {}
    for k, (name, fns, _, where) in LIFE.items():
        frames = [fn() for fn in fns]
        fw = max(f.w for f in frames); fh = max(f.h for f in frames)
        img = Image.new('RGBA', (fw * len(frames), fh), (0, 0, 0, 0))
        for i, f in enumerate(frames):
            ox = i * fw + (fw - f.w) // 2; oy = fh - f.h
            for y in range(f.h):
                for x in range(f.w):
                    c = f.a[y * f.w + x]
                    if c is not None: img.putpixel((ox + x, oy + y), c + (255,))
        if (not keys or k in keys) and save_png(img, os.path.join(LIFE_DIR, k + '.png'), overwrite): written.append('life/' + k)
        meta[k] = dict(name=name, img='scene/life/%s.png' % k, w=fw, h=fh, frames=len(frames), where=where)
    write_json(os.path.join(GAME, 'art', 'scene', 'life.json'), meta)


# ============================================================================= FAR LAYERS
# Wide horizon strips that tile horizontally. Same cel style, but hazier: softer outlines,
# colours pulled toward the air colour, fewer tones.
FW, FH = 640, 120
FAR = {}
FAR_DIR = os.path.join(GAME, 'art', 'scene', 'far')
FAR_META = os.path.join(GAME, 'art', 'scene', 'far.json')


def far(key, name):
    def deco(fn):
        FAR[key] = dict(fn=fn, name=name)
        return fn
    return deco


class WCv(Cv):
    """canvas that wraps horizontally so strips tile seamlessly"""
    def ok(s, x, y):
        return 0 <= y < s.h

    def get(s, x, y):
        return s.a[y * s.w + x % s.w] if 0 <= y < s.h else None

    def px(s, x, y, c):
        if c is not None and 0 <= y < s.h:
            s.a[y * s.w + x % s.w] = c


def pn(x, terms):
    """periodic noise: integer frequencies over the strip width keep the seam invisible"""
    return sum(a * math.sin(2 * math.pi * k * x / FW + p) for (a, k, p) in terms)


def wdx(x, c):
    return (x - c + FW / 2) % FW - FW / 2


def soft_outline(cv, k=.45):
    add = []
    for y in range(cv.h):
        for x in range(cv.w):
            if cv.a[y * cv.w + x] is None:
                for ax, ay in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    c = cv.get(x + ax, y + ay)
                    if c is not None:
                        add.append((x, y, mix(olc(c), c, k)))
                        break
    for x, y, c in add:
        cv.px(x, y, c)
    return cv


def haze(cv, hz, f):
    for i, c in enumerate(cv.a):
        if c is not None:
            cv.a[i] = mix(c, hz, f)
    return cv


def sprite(cv, w, h, x, y, fn, k=.45):
    """draw fn(local) on a small canvas, soft-outline it and paste it with its (x, y) at local (w//2, h-3)"""
    lc = Cv(w, h)
    fn(lc, w // 2, h - 3)
    soft_outline(lc, k)
    cv.paste(lc, int(x) - w // 2, int(y) - (h - 3))


def ridge(cv, yf, Rm, rim=True, alt=None, period=80, slant=1.3, hedge=None):
    ys = [yf(x) for x in range(FW)]
    for x in range(FW):
        y0 = int(round(ys[x])); sl = ys[(x + 1) % FW] - ys[x - 1]
        base = 3 if sl < -.5 else 2 if sl < .7 else 1
        band = min(9, 2 + 5 * abs(sl))                 # slope-lit band, thin where the slope flattens
        for y in range(max(0, y0), FH):
            d = y - y0
            t = base if d < band else 2
            Rx = Rm
            if alt is not None and d > 3:
                u = (x + d * slant) % period
                if int((x + d * slant) // period) % 2: Rx = alt
                if hedge and u < 1.6:
                    cv.px(x, y, hedge[1]); continue
            if rim and d < 2: t = min(4, t + 1)
            hh = (x * 73856093 ^ y * 19349663) % 41                  # scattered tufts, no visible grid
            if hh == 0 and d > 2: t = max(1, t - 1)
            elif hh == 1 and d > 2 and t < 3: t += 1
            cv.px(x, y, Rx[t])
    return ys


def far_tree(lc, x, g, r, Rl):
    for y in range(g - int(r * .9), g + 1):
        lc.px(x, y, R['bark'][2]); lc.px(x + 1, y, R['bark'][1])
    ball(lc, x + 1, g - r * 1.5, r, r * 1.1, Rl, .05, lo=1)


def far_pine(lc, x, g, w, h, Rp):
    for i in range(3):
        top = g - h + i * h * .28; bot = top + h * .48
        hw = w * (.45 + .25 * i) / 2
        for y in range(int(top), int(bot) + 1):
            f = (y + .5 - top) / (bot - top)
            ww = hw * f
            for xx in range(int(x - ww) - 1, int(x + ww) + 2):
                if abs(xx + .5 - x) <= ww:
                    nx = (xx + .5 - x) / max(1, ww)
                    lc.px(xx, y, Rp[3 if nx < -.35 else 2 if nx < .35 else 1])
    lc.rect(x - 1, g - 2, x, g, R['bark'][1])


@far('hills', 'Rolling hills')
def f_hills(rng):
    cv = WCv(FW, FH)
    hz = (200, 218, 236)
    layers = [(lambda x: 52 + pn(x, [(9, 2, 1.0), (5, 5, 2.2), (2, 11, .3)]), ramp((150, 192, 128)), None, .5, 10, 3),
              (lambda x: 72 + pn(x, [(8, 3, 2.0), (4, 7, .5), (2, 13, 1.1)]), ramp((124, 182, 100)), None, .32, 12, 4),
              (lambda x: 93 + pn(x, [(6, 4, .4), (4, 9, 2.5), (1.5, 17, .9)]), ramp((106, 170, 84)), ramp((138, 182, 86)), .16, 9, 5)]
    for (yf, Rm, alt, f, nt, tr) in layers:
        lay = WCv(FW, FH)
        ridge(lay, yf, Rm, alt=alt, hedge=ramp((70, 130, 70)) if alt else None)
        for i in range(nt):
            x = (i + rng.uniform(.1, .9)) * FW / nt
            for j in range(rng.choice([1, 1, 2, 3])):
                xx = x + j * (tr * 2 + 1)
                g = int(yf(xx)) + 2
                r = tr + rng.choice([-1, 0, 0, 1])
                sprite(lay, r * 4 + 6, r * 5 + 6, xx, g, lambda lc, a, b, r=r: far_tree(lc, a, b, r, R['oak']))
        soft_outline(lay); haze(lay, hz, f); cv.paste(lay)
    return cv


@far('forest', 'Forest edge')
def f_forest(rng):
    cv = WCv(FW, FH)
    hz = (196, 214, 232)
    # back canopy
    for (base, n, rr, Rl, f, pines) in ((44, 34, (11, 15), ramp((86, 150, 96)), .5, 0),
                                       (68, 30, (10, 13), ramp((78, 146, 82)), .3, 14),
                                       (94, 26, (12, 16), ramp((66, 132, 74)), .14, 10)):
        lay = WCv(FW, FH)
        lay.rect(0, base + 4, FW - 1, FH - 1, lambda x, y, Rl=Rl: Rl[1 if (x * 3 + y * 5) % 11 else 0])
        items = []
        for i in range(n):
            items.append(('r', (i + rng.uniform(0, 1)) * FW / n, base + rng.uniform(-5, 4), rng.uniform(*rr)))
        for i in range(pines):
            items.append(('p', rng.uniform(0, FW), base + 8 + rng.uniform(-3, 4), rng.uniform(rr[0] * 1.6, rr[1] * 1.8)))
        items.sort(key=lambda it: it[2])
        for (k, x, y, r) in items:
            if k == 'r':
                rr_ = r; sd = rng.random()
                sprite(lay, int(r * 2 + 10), int(r * 2.3 + 10), x, y + r,
                       lambda lc, a, b, rr_=rr_, sd=sd: blob(lc, a + .5, b - rr_ * 1.05, rr_, rr_ * 1.08, Rl, random.Random(sd),
                                                           cell=5, bump=.07, sep=False))
            else:
                h_ = r * 1.5
                sprite(lay, int(r + 10), int(h_ + 8), x, y,
                       lambda lc, a, b, r=r, h_=h_: far_pine(lc, a, b, r, h_, ramp((52, 120, 96))))
        soft_outline(lay); haze(lay, hz, f); cv.paste(lay)
    return cv


@far('mountains', 'Snowy mountains')
def f_mountains(rng):
    cv = WCv(FW, FH)
    hz = (206, 214, 240)
    Rsn = R['white']
    for (n, ytop, ybase, k, Rm, f, snow) in ((5, (6, 22), 96, (.75, 1.0), ramp((156, 146, 206)), .42, 1.0),
                                             (7, (34, 52), 110, (.8, 1.1), ramp((134, 124, 190)), .24, .55)):
        lay = WCv(FW, FH)
        pk = [((i + rng.uniform(.15, .85)) * FW / n, rng.uniform(*ytop), rng.uniform(*k)) for i in range(n)]
        for x in range(FW):
            best = None
            for (px_, py_, kk) in pk:
                yy = py_ + abs(wdx(x, px_)) * kk + 3 * abs(math.sin(x * .21 + px_)) + pn(x, [(1.5, 37, .3)])
                if best is None or yy < best[0]: best = (yy, px_, py_)
            y0, px_, py_ = best
            y0 = max(2, min(ybase, y0))
            side = wdx(x, px_)
            for y in range(int(y0), FH):
                d = y - y0
                t = 3 if side < 0 else 1
                if abs(side) < 1.5: t = 2
                g = side / max(4.0, y - py_) * 3.2 + .12 * math.sin(y * .23 + px_)       # gullies radiate from the peak
                if d > 3 and (g - math.floor(g)) < .1 and y - py_ > 8: t = max(0, t - 1)
                if d < 1.5: t = min(4, t + 1)
                sn = (16 + 5 * math.sin(x * .3) + 3 * math.sin(x * .71)) * snow
                if y < py_ + sn and py_ < ytop[1] + 4 and snow:
                    lay.px(x, y, Rsn[(4 if side < 0 else 2) if d < 1.5 else (3 if side < 0 else 1)])
                    continue
                lay.px(x, y, Rm[t])
        soft_outline(lay); haze(lay, hz, f); cv.paste(lay)
    lay = WCv(FW, FH)
    yf = lambda x: 104 + pn(x, [(4, 5, 1.0), (2, 12, .2), (1, 23, 2.0)])
    ridge(lay, yf, ramp((112, 156, 138)))
    for i in range(46):
        x = rng.uniform(0, FW); g = int(yf(x)) + 3
        h_ = rng.uniform(7, 12)
        sprite(lay, 14, int(h_) + 8, x, g, lambda lc, a, b, h_=h_: far_pine(lc, a, b, h_ * .65, h_, ramp((70, 128, 112))))
    soft_outline(lay); haze(lay, hz, .2); cv.paste(lay)
    return cv


def butte_y(x, c, hw, top, base):
    d = abs(wdx(x, c))
    if d <= hw: return top
    talus = base - (base - top) * .3
    dc = (talus - top) / 5.0
    if d <= hw + dc: return top + (d - hw) * 5.0
    return min(base, talus + (d - hw - dc) * .9)


@far('canyon', 'Canyon mesas')
def f_canyon(rng):
    cv = WCv(FW, FH)
    hz = (226, 210, 220)
    for (n, tops, hws, base, Rm, f) in ((4, (52, 62), (40, 70), 94, ramp((216, 150, 116)), .45),
                                        (5, (26, 46), (14, 34), 112, ramp((206, 124, 86)), .2)):
        lay = WCv(FW, FH)
        bt = [((i + rng.uniform(.2, .8)) * FW / n, rng.uniform(*hws), rng.uniform(*tops)) for i in range(n)]
        for x in range(FW):
            ys = [(butte_y(x, c, hw, top, base), c, hw, top) for (c, hw, top) in bt]
            y0, c, hw, top = min(ys)
            if y0 >= base: continue
            dx = wdx(x, c)
            for y in range(int(y0), FH):
                d = y - y0
                talus = base - (base - top) * .3
                t = 2
                if dx < -hw * .55: t = 3
                elif dx > hw * .5: t = 1
                if y < talus:
                    sv = y - int(top) + 1.2 * math.sin(x * .19 + c)                            # wavy strata
                    if sv % 7 >= 6: t = max(0, t - 1)
                    elif sv % 14 < 3 and t < 3: t += 1
                    if (x * 7) % 17 == 0 and d > 4 and abs(dx) < hw: t = max(0, t - 1)            # erosion grooves
                else:
                    t = 2 if (x * 3 + y * 5) % 7 else 1
                    if dx < -hw: t = 3
                if d < 2 and y < talus: t = 4 if d < 1 else 3
                lay.px(x, y, Rm[t])
        soft_outline(lay); haze(lay, hz, f); cv.paste(lay)
    lay = WCv(FW, FH)
    yf = lambda x: 108 + pn(x, [(3, 4, .5), (1.5, 11, 2.0)])
    ridge(lay, yf, ramp((232, 192, 134)))
    for i in range(14):
        x = rng.uniform(0, FW); g = int(yf(x)) + 2
        if i % 2:
            sprite(lay, 10, 16, x, g, lambda lc, a, b: (lc.rect(a - 1, b - 9, a, b, RCACT[2]), lc.rect(a - 3, b - 6, a - 3, b - 4, RCACT[3]),
                                                       lc.rect(a + 2, b - 7, a + 2, b - 5, RCACT[1])))
        else:
            sprite(lay, 12, 10, x, g, lambda lc, a, b: ball(lc, a, b - 1.5, 3.5, 2.5, R['rock'], .1))
    soft_outline(lay); haze(lay, hz, .12); cv.paste(lay)
    return cv


def vor_rock(lay, pts, Rm, rng, cell=18, ytone=None):
    cs = {}
    gx = FW // cell
    for gy in range(FH // cell + 2):
        for i in range(gx):
            cs[(i, gy)] = (i * cell + rng.uniform(0, cell), gy * cell + rng.uniform(0, cell), rng.choice([-1, 0, 0, 1]))
    for (x, y) in pts:
        i0 = int(x % FW) // cell; j0 = y // cell
        ds = []
        for j in (j0 - 1, j0, j0 + 1):
            for i in (i0 - 1, i0, i0 + 1):
                q = cs.get((i % gx, j))
                if q:
                    ds.append(((wdx(x + .5, q[0])) ** 2 + (y + .5 - q[1]) ** 2, q))
        ds.sort()
        (d0, q), d1 = ds[0], ds[1][0]
        t = ytone(x, y) if ytone else 2
        if math.sqrt(d1) - math.sqrt(d0) < 1.1:
            t -= 1
        else:
            lx = wdx(x + .5, q[0]); ly = y + .5 - q[1]
            if lx + ly < -cell * .4: t += 1
            elif lx + ly > cell * .5: t -= 1
            t += q[2] if 0 < t < 4 else 0
        lay.px(x, y, Rm[max(0, min(4, t))])


def far_crystal(cv, x, g, Rc, rng, n=3):
    lc = Cv(30, 30)
    cx, G = 15, 27
    for k in range(n):
        ang = (k - (n - 1) / 2) * .45 + rng.uniform(-.1, .1)
        L = rng.uniform(8, 14) * (1.25 if k == n // 2 else 1)
        hw = 2.4
        ux, uy = math.sin(ang), -math.cos(ang); px_, py_ = -uy, ux
        bx = cx + (k - (n - 1) / 2) * 3
        tip = (bx + ux * L, G + uy * L); sh = (bx + ux * (L - 4), G + uy * (L - 4))
        poly = [(bx - px_ * hw, G - py_ * hw), (sh[0] - px_ * hw, sh[1] - py_ * hw), tip, (sh[0] + px_ * hw, sh[1] + py_ * hw), (bx + px_ * hw, G + py_ * hw)]
        for (xx, yy) in lc.polypts(poly):
            a = ((xx + .5 - bx) * px_ + (yy + .5 - G) * py_) / hw
            lc.px(xx, yy, Rc[4 if a < -.3 else 3 if a < .4 else 2])
    lc.outline(col=mix(Rc[0], OL, .4))
    # soft glow on the rock around the crystal
    for yy in range(-14, 6):
        for xx in range(-16, 17):
            r = math.hypot(xx, yy * 1.3)
            c = cv.get(x + xx, g + yy)
            if c is not None and r < 15:
                cv.px(x + xx, g + yy, mix(c, Rc[3], .32 * (1 - r / 15)))
    cv.paste(lc, int(x) - cx, int(g) - G)


@far('cave', 'Cave wall')
def f_cave(rng):
    cv = WCv(FW, FH)
    hz = (34, 28, 54)
    lay = WCv(FW, FH)
    Rb = ramp((92, 82, 116))
    top = [8 + pn(x, [(5, 3, .2), (3, 8, 1.4), (2, 19, 2.2)]) + (6 * max(0, math.sin(x * .09)) ** 6) for x in range(FW)]
    pts = [(x, y) for x in range(FW) for y in range(int(top[x]), FH)]
    vor_rock(lay, pts, Rb, rng, cell=20, ytone=lambda x, y: 2 if y < 70 else 1)
    soft_outline(lay, .3); haze(lay, hz, .42); cv.paste(lay)
    # glowing crystals on the back wall
    for (x, y, c) in ((70, 46, 'cyan'), (250, 30, 'lilac'), (420, 52, 'cyan'), (560, 38, 'pink')):
        far_crystal(cv, x, y, R[c], rng, n=2)
    # front ledge with stalagmites
    lay = WCv(FW, FH)
    yf = lambda x: 84 + pn(x, [(5, 4, 2.2), (3, 9, .6), (1.5, 21, 1.0)])
    spikes = [(rng.uniform(0, FW), rng.uniform(10, 30), rng.uniform(5, 9)) for _ in range(9)]
    ys = []
    for x in range(FW):
        y0 = yf(x)
        for (sx, sh_, sw) in spikes:
            d = abs(wdx(x, sx))
            if d < sw: y0 = min(y0, yf(sx) - sh_ * (1 - d / sw) ** 1.3)
        ys.append(y0)
    pts = [(x, y) for x in range(FW) for y in range(int(ys[x]), FH)]
    Rf = ramp((112, 100, 136))
    vor_rock(lay, pts, Rf, rng, cell=14, ytone=lambda x, y: 3 if y < ys[x] + 3 else 2)
    soft_outline(lay, .35); haze(lay, hz, .22); cv.paste(lay)
    for (x, c) in ((150, 'cyan'), (330, 'pink'), (505, 'lilac'), (610, 'cyan')):
        far_crystal(cv, x, int(ys[x]) + 4, R[c], rng)
    return cv


@far('mall', 'Mall interior')
def f_mall(rng):
    cv = WCv(FW, FH)
    Rw = ramp((236, 228, 214)); Rm = R['marble']; Rg = ramp((150, 206, 228))
    cols = ['coral', 'teal', 'gold', 'lilac', 'sky', 'mint', 'pink', 'orange']
    rng.shuffle(cols)
    lay = WCv(FW, FH)
    lay.rect(0, 4, FW - 1, FH - 1, lambda x, y: Rw[2 if (y // 3) % 7 else 1])
    for y in range(4, 10):
        for x in range(FW): lay.px(x, y, Rm[(4, 3, 3, 2, 1, 0)[y - 4]])

    def store(x0, y0, w, h, col, low):
        Rc = R[col]
        sy1 = y0 + (9 if low else 7)
        for y in range(y0, sy1):                              # sign band (no text)
            for x in range(x0 + 2, x0 + w - 2):
                lay.px(x, y, Rc[4 if y == y0 else 1 if y == sy1 - 1 else 2 if x > x0 + w - 6 else 3])
        icx, icy = x0 + w // 2, (y0 + sy1) // 2
        shape = cols.index(col) % 3
        for (x, y) in lay.ellpts(icx, icy, 2.6, 2.6) if shape == 0 else \
                [(icx + a, icy + b) for a in range(-2, 3) for b in range(-2, 3) if abs(a) + abs(b) <= 2] if shape == 1 else \
                [(icx + a, icy + b) for a in range(-6, 7) for b in (-1, 0, 1)]:
            lay.px(x, y, R['white'][4])
        gy0, gy1 = sy1 + 2, y0 + h - 1
        for y in range(gy0, gy1 + 1):
            for x in range(x0 + 4, x0 + w - 4):
                t = 2
                if y < gy0 + 2: t = 0
                elif ((x - x0) + (y - gy0)) % 17 in (3, 4): t = 4
                elif x > x0 + w - 7: t = 1
                lay.px(x, y, Rg[t])
        dx0, dx1 = x0 + w // 2 - (6 if low else 5), x0 + w // 2 + (5 if low else 4)
        for y in range(gy0 + (3 if low else 2), gy1 + 1):         # open doorway
            for x in range(dx0, dx1 + 1):
                lay.px(x, y, R['lav'][1 if x < dx1 - 1 else 0])
        # goods on shelves either side of the door
        for (a, b) in ((x0 + 6, dx0 - 3), (dx1 + 3, x0 + w - 6)):
            for sy in ([gy1 - 3, gy1 - 13] if low else [gy1 - 3]):
                for x in range(a, b + 1): lay.px(x, sy, R['wood'][1])
                x = a
                while x < b - 2:
                    c = R[rng.choice(['coral', 'gold', 'mint', 'lilac', 'pink', 'sky', 'white'])]
                    hh = rng.randint(2, 5)
                    for yy in range(sy - hh, sy):
                        lay.px(x, yy, c[3]); lay.px(x + 1, yy, c[2])
                    x += 3
        for y in range(gy0, gy1 + 1):
            lay.px(x0 + 3, y, Rm[1]); lay.px(x0 + w - 4, y, Rm[0])

    for m in range(8):
        x0 = m * 80
        store(x0 + 6, 12, 68, 33, cols[m], False)
        store(x0 + 6, 56, 68, 52, cols[(m + 3) % 8], True)
        for y in range(10, 110):                                  # pillars
            for x in range(x0, x0 + 6): lay.px(x, y, Rm[[4, 3, 2, 2, 1, 0][x - x0]])
    for y in range(45, 54):                                       # upper floor slab
        for x in range(FW):
            t = (4, 3, 2, 2, 1, 1, 0, 2, 1)[y - 45]
            lay.px(x, y, R['teal'][t] if y in (49, 50) else Rm[t])
    for y in range(108, FH):                                      # skirting / floor line
        for x in range(FW): lay.px(x, y, Rm[1] if y < 111 else Rm[2] if (x // 16 + y // 4) % 2 else Rm[3])
    # glass balustrade along the upper floor
    for y in range(34, 45):
        for x in range(FW):
            c = lay.get(x, y)
            lay.px(x, y, mix(c, (196, 236, 244), .38))
    for x in range(FW):
        lay.px(x, 33, Rm[4]); lay.px(x, 34, Rm[2])
    for x in range(0, FW, 40):
        for y in range(33, 45): lay.px(x + 2, y, Rm[3]); lay.px(x + 3, y, Rm[1])
    # potted palms in front of every other pillar
    for m in range(0, 8, 2):
        x = m * 80 + 3
        def plant(lc, a, b):
            lc.rect(a - 3, b - 5, a + 3, b, lambda xx, yy: R['brick'][3 if xx < a else 1])
            blob(lc, a, b - 11, 6, 7, R['leaf'], random.Random(m), cell=4, sep=False)
        sprite(lay, 20, 24, x, 108, plant)
    soft_outline(lay, .5)
    haze(lay, (226, 220, 242), .2); cv.paste(lay)
    return cv


@far('town', 'Distant town')
def f_town(rng):
    cv = WCv(FW, FH)
    hz = (204, 218, 236)
    roofs = ['teal', 'coral', 'sky', 'lilac', 'brick', 'coral', 'teal']
    walls = ['cream', 'peach', 'white', 'cream']

    def house(lay, x0, w, wall_top, base, rh, roof, wallc, gable, chim, wcol):
        Rr = R[roof]; Rw = R[wallc]
        for y in range(wall_top, base + 1):
            for x in range(x0, x0 + w):
                lay.px(x, y, Rw[3 if x == x0 else 1 if x >= x0 + w - 2 else 2])
        for k in range(max(1, w // 8)):                            # windows
            wx = x0 + 3 + k * 8
            if wx + 2 >= x0 + w - 2: break
            for wy in range(wall_top + 4, base - 3, 9):
                lay.rect(wx, wy, wx + 2, wy + 2, wcol[3]); lay.px(wx + 2, wy + 2, wcol[1])
        if chim:
            cxh = x0 + int(w * .7)
            lay.rect(cxh, wall_top - rh, cxh + 3, wall_top - 2, lambda x, y: R['brick'][3 if x == cxh else 1])
        for y in range(wall_top - rh, wall_top + 2):
            f = (y - (wall_top - rh)) / rh
            if gable:
                a = x0 + w / 2 - (w / 2 + 2) * f; b = x0 + w / 2 + (w / 2 + 2) * f
            else:
                a = x0 + w * .25 - (w * .25 + 2) * f; b = x0 + w * .75 + (w * .25 + 2) * f
            for x in range(int(a), int(b) + 1):
                u = (x - a) / max(1, b - a)
                t = 3 if u < .4 else 2 if u < .8 else 1
                if (y - wall_top) % 3 == 0: t = max(0, t - 1)
                if y >= wall_top: t = 0
                lay.px(x, y, Rr[t])

    for (base, wtop, rh, ws, f) in ((84, (58, 66), (8, 12), (16, 28), .42), (119, (86, 96), (12, 18), (28, 44), .18)):
        lay = WCv(FW, FH)
        x = 0
        while x < FW:
            w = rng.randint(*ws)
            house(lay, x, w, rng.randint(*wtop), base, rng.randint(*rh), rng.choice(roofs), rng.choice(walls),
                  rng.random() < .5, rng.random() < .4, R['lamp'] if rng.random() < .5 else R['glass'])
            x += w + rng.choice([0, 0, 2, 6])
            if rng.random() < .35 and f < .3:
                r = rng.randint(6, 9)
                sprite(lay, r * 3 + 6, r * 4 + 8, x - 2, base - 6, lambda lc, a, b, r=r: far_tree(lc, a, b, r, R['oak']))
        if f > .3:
            # the clock-less town tower: belfry, round window, pointed roof with a ball finial
            tx, tw_ = 300, 22
            Rs = R['stone']
            for y in range(24, base + 1):
                for xx in range(tx, tx + tw_):
                    t = 3 if xx < tx + 3 else 1 if xx > tx + tw_ - 4 else 2
                    if (y - 24) % 6 == 5: t = max(0, t - 1)
                    lay.px(xx, y, Rs[t])
            for y in range(30, 40):
                for xx in range(tx + 6, tx + tw_ - 6):
                    if y > 33 or abs(xx + .5 - tx - tw_ / 2) < 5 - (34 - y) * .8:
                        lay.px(xx, y, R['lav'][0])
            for (xx, yy) in lay.ellpts(tx + tw_ / 2, 50, 5, 5):
                lay.px(xx, yy, R['cream'][3 if xx + yy < tx + tw_ / 2 + 50 else 2])
            for (xx, yy) in lay.ellpts(tx + tw_ / 2, 50, 6, 6):
                if math.hypot(xx + .5 - tx - tw_ / 2, yy + .5 - 50) > 5: lay.px(xx, yy, R['dwood'][1])
            lay.poly([(tx - 3, 25), (tx + tw_ / 2, 2), (tx + tw_ + 3, 25)],
                     lambda xx, yy: R['teal'][3 if xx < tx + tw_ / 2 - 2 else 2 if xx < tx + tw_ / 2 + 3 else 1])
            ball(lay, tx + tw_ / 2, 1.5, 1.6, 1.6, R['gold'], .1)
        soft_outline(lay); haze(lay, hz, f); cv.paste(lay)
    return cv


@far('farm', 'Farmland')
def f_farm(rng):
    cv = WCv(FW, FH)
    hz = (206, 220, 236)
    lay = WCv(FW, FH)
    yf = lambda x: 58 + pn(x, [(7, 2, .8), (4, 5, 2.0), (1.5, 13, .4)])
    ridge(lay, yf, ramp((140, 190, 120)))
    for i in range(11):
        x = (i + rng.uniform(.1, .9)) * FW / 11; g = int(yf(x)) + 2
        sprite(lay, 18, 22, x, g, lambda lc, a, b: far_tree(lc, a, b, 3, R['oak']))
    soft_outline(lay); haze(lay, hz, .48); cv.paste(lay)
    # patchwork fields
    lay = WCv(FW, FH)
    crops = [ramp((226, 196, 108)), ramp((132, 186, 92)), ramp((168, 204, 106)), ramp((178, 132, 94)), ramp((120, 176, 90))]
    hedge = ramp((70, 128, 72))
    y0f = lambda x: 74 + pn(x, [(2, 3, 1.0), (1, 7, .2)])
    for x in range(FW):
        y0 = int(round(y0f(x)))
        for y in range(y0, FH):
            d = y - y0
            band = 0 if d < 18 else 1
            sl = 1.4 if band == 0 else -1.1
            u = x + d * sl + band * 40
            fid = int(u // 80) % 8
            Rc = crops[(fid * 3 + band * 2) % len(crops)]
            t = 2
            if (u % 80) < 1.6 or (band == 1 and d - 18 < 2) or d < 1:
                lay.px(x, y, hedge[1 if d else 2]); continue
            ci = crops.index(Rc)
            if ci == 0: t = 3 if y % 3 == 0 else 2
            elif ci == 3: t = 1 if (y % 4 == 0) else 2
            else: t = 3 if (int(u) + y) % 5 == 0 else 2
            lay.px(x, y, Rc[t])
    soft_outline(lay); haze(lay, hz, .26); cv.paste(lay)
    # red barn and silo
    lay = WCv(FW, FH)
    bx, by = 200, 98
    Rb = ramp((198, 72, 66)); Rro = ramp((118, 74, 84))
    for y in range(by - 22, by + 1):
        for x in range(bx, bx + 40):
            t = 3 if x < bx + 3 else 1 if x > bx + 36 else 2
            if (x - bx) % 4 == 3: t = max(0, t - 1)
            lay.px(x, y, Rb[t])
    lay.poly([(bx - 3, by - 21), (bx + 4, by - 33), (bx + 20, by - 40), (bx + 36, by - 33), (bx + 43, by - 21)],
             lambda x, y: Rro[3 if x < bx + 14 else 2 if x < bx + 28 else 1])
    for x in range(bx - 2, bx + 42): lay.px(x, by - 21, Rro[0])
    dx0, dx1 = bx + 13, bx + 27
    lay.rect(dx0, by - 15, dx1, by, Rb[1])
    lay.orect(dx0, by - 15, dx1, by, R['white'][3])
    lay.line(dx0, by - 15, dx1, by, R['white'][3]); lay.line(dx1, by - 15, dx0, by, R['white'][3])
    lay.rect(bx + 17, by - 31, bx + 23, by - 26, R['white'][3]); lay.rect(bx + 18, by - 30, bx + 22, by - 27, R['lav'][1])
    sx = bx + 46
    for y in range(by - 46, by + 1):
        for x in range(sx, sx + 14):
            t = xt(x, sx, sx + 14)
            if (y - by) % 6 == 0: t = max(0, t - 1)
            lay.px(x, y, R['marble'][t])
    for (x, y) in lay.ellpts(sx + 7, by - 46, 7, 6):
        if y <= by - 46: lay.px(x, y, R['sky'][3 if x < sx + 6 else 1])
    for k, x in enumerate(range(150, 290, 9)):
        lay.rect(x, by - 4, x + 1, by + 2, R['wood'][3 if k % 2 else 2])
    for x in range(150, 290): lay.px(x, by - 2, R['wood'][3])
    for (x, r) in ((186, 7), (196, 5), (276, 8), (420, 7), (430, 6), (560, 8)):
        sprite(lay, r * 3 + 6, r * 4 + 8, x, by + 4 if x < 300 else 100, lambda lc, a, b, r=r: far_tree(lc, a, b, r, R['oak']))
    soft_outline(lay); haze(lay, hz, .16); cv.paste(lay)
    return cv


# ============================================================================= FX SPRITES
FX_DIR = os.path.join(GAME, 'art', 'scene', 'fx')
FX_META = os.path.join(GAME, 'art', 'scene', 'fx.json')


def fx_grid(frames, pal):
    """frames: list of row strings; pal: char -> RGBA"""
    w = len(frames[0][0]); h = len(frames[0])
    img = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        for y, row in enumerate(fr):
            for x, ch in enumerate(row):
                if ch in pal:
                    img.putpixel((i * w + x, y), pal[ch])
    return img


def a(c, al=255):
    return (c[0], c[1], c[2], al)


def fx_butterfly():
    pal = {'w': a(R['white'][4]), 's': a(R['white'][1]), 'y': a(R['yellow'][3]), 'g': a(R['yellow'][2]), 'b': a(OL)}
    return fx_grid([["wwb..bww",
                     "wyybbyyw",
                     "wyybbyyw",
                     ".swbbws.",
                     ".wgbbgw.",
                     ".ss..ss.",
                     "........"],
                    ["..b..b..",
                     "...ww...",
                     "..wyyw..",
                     "..wyyw..",
                     "..swws..",
                     "...bb...",
                     "...bb..."]], pal), 8, 7, 2


def fx_bird():
    Rb = ramp((70, 64, 98))
    pal = {'d': a(Rb[0]), 'm': a(Rb[1]), 'l': a(Rb[2]), 'k': a(R['gold'][2])}
    return fx_grid([["d........d",
                     "md......dm",
                     ".md....dm.",
                     "..mlddlm..",
                     "....dddk..",
                     ".........."],
                    ["..........",
                     "..........",
                     "...mldddk.",
                     "..mmdddm..",
                     ".md....dm.",
                     "d........d"]], pal), 10, 6, 2


def fx_leaf():
    g, o, y = R['leaf'], R['orange'], R['gold']
    pal = {}
    for i, Rl in enumerate((g, y, o)):
        for j, t in enumerate((4, 3, 2, 1, 0)):
            pal['%d%d' % (i, j)] = a(Rl[t])
    shapes = [["...12",
               "..122",
               ".123.",
               "233..",
               "4...."],
              [".....",
               ".112.",
               "11223",
               ".233.",
               "....4"],
              ["4....",
               "212..",
               ".223.",
               "..233",
               "...3."]]
    img = Image.new('RGBA', (15, 5), (0, 0, 0, 0))
    for i, sh in enumerate(shapes):
        for yy, row in enumerate(sh):
            for xx, ch in enumerate(row):
                if ch != '.':
                    img.putpixel((i * 5 + xx, yy), pal['%d%s' % (i, ch)])
    return img, 5, 5, 3


def fx_smoke():
    img = Image.new('RGBA', (48, 12), (0, 0, 0, 0))
    Rs = ramp((214, 212, 226))
    puffs = [[(6, 8, 2.6)], [(5.5, 7, 3.2), (8, 8.5, 2.2)], [(5, 6, 3.8), (8.5, 7, 2.8), (3.5, 8.5, 2.4)],
             [(4.5, 4.5, 3.6), (8.5, 5.5, 3.0), (6, 8, 2.6)]]
    alpha = [235, 215, 175, 110]
    for i, ps in enumerate(puffs):
        for yy in range(12):
            for xx in range(12):
                hit = None
                for (cx, cy, r) in ps:
                    dx, dy = xx + .5 - cx, yy + .5 - cy
                    if dx * dx + dy * dy <= r * r:
                        nx, ny = dx / r, dy / r
                        hit = max(hit or 0, sph(nx * .9, ny * .9, .25))
                if hit is not None:
                    if i == 3 and (xx * 3 + yy * 5) % 7 == 0: continue
                    img.putpixel((i * 12 + xx, yy), a(Rs[max(1, hit)], alpha[i]))
    return img, 12, 12, 4


def fx_spray():
    q = R['water']
    pal = {'w': a(R['white'][4]), 'l': a(q[4]), 'b': a(q[3]), 'f': a(q[4], 150), 'g': a(q[3], 110)}
    return fx_grid([["......",
                     "..w...",
                     "..lb..",
                     "..bb..",
                     "......",
                     "......"],
                    ["...w..",
                     "...l..",
                     ".w.b..",
                     ".l....",
                     ".b..w.",
                     "....b."],
                    ["w....w",
                     "l....b",
                     "...f..",
                     "..w...",
                     "..b..f",
                     "f....."],
                    ["f.....",
                     ".....g",
                     "......",
                     "..g...",
                     "......",
                     "g...f."]], pal), 6, 6, 4


def fx_sparkle():
    pal = {'w': a(R['white'][4]), 'y': a(R['lamp'][4]), 'c': a(R['cyan'][4]), 'f': a(R['lamp'][4], 140)}
    return fx_grid([[".......",
                     ".......",
                     ".......",
                     "...w...",
                     ".......",
                     ".......",
                     "......."],
                    [".......",
                     ".......",
                     "...y...",
                     "..ywy..",
                     "...y...",
                     ".......",
                     "......."],
                    ["...y...",
                     "...y...",
                     "..cyc..",
                     "yyywyyy",
                     "..cyc..",
                     "...y...",
                     "...y..."],
                    [".......",
                     "...f...",
                     "...y...",
                     ".fywyf.",
                     "...y...",
                     "...f...",
                     "......."]], pal), 7, 7, 4


FX = dict(butterfly=fx_butterfly, bird=fx_bird, leaf=fx_leaf, smoke=fx_smoke, spray=fx_spray, sparkle=fx_sparkle)


# ============================================================================= output
def finish(cv, bx, flat):
    """crop to content, keep the base centre in the middle; ground line = last row"""
    xs, ys = [], []
    for y in range(cv.h):
        for x in range(cv.w):
            if cv.a[y * cv.w + x] is not None:
                xs.append(x); ys.append(y)
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    if getattr(cv, 'hang', 0): y1 = cv.h - 1          # v26: hangs on a wall, the empty space below stays
    half = max(bx - x0, x1 + 1 - bx) + 1
    w = 2 * half; h = (y1 - y0 + 1) + 1
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = img.load()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            c = cv.a[y * cv.w + x]
            if c is not None:
                px[x - bx + half, y - y0 + 1] = (c[0], c[1], c[2], 255)
    return img


# ============================================================================= v24: ISLAND, VOLCANO AND MOUNTAIN PROPS

P.update(terra=(214, 112, 74), sea=(64, 150, 206), snow=(236, 242, 248), palm=(84, 160, 70), palmbark=(176, 136, 92),
         ash=(96, 86, 82), basalt=(70, 70, 84), obsid=(58, 44, 80), lava=(250, 120, 40), chalet=(170, 110, 70), sail=(244, 240, 228))
for _k in ('terra', 'sea', 'snow', 'palm', 'palmbark', 'ash', 'basalt', 'obsid', 'lava', 'chalet', 'sail'):
    R[_k] = ramp(P[_k])


def snow_cap(cv, depth=3, every=1, Rs=None):
    """snow lying on every upward-facing edge: the first few pixels below an open sky pixel turn white"""
    Rs = Rs or R['snow']
    src = list(cv.a)
    for x in range(cv.w):
        for y in range(1, cv.h):
            if src[y * cv.w + x] is not None and src[(y - 1) * cv.w + x] is None:
                d = depth + (1 if (x * 7) % 5 == 0 else 0) - (1 if (x * 3) % 7 == 0 else 0)
                for k in range(1, d + 1):
                    yy = y + k
                    if yy < cv.h and src[yy * cv.w + x] is not None:
                        cv.px(x, yy, Rs[4 if k == 1 else 3 if k < d else 2])


# ----------------------------------------------------------------------------- the island
def palm(rng, W, H, lean, crown_h, nfr=9, nuts=True):
    G = H - 2; cx = W // 2
    cv = Cv(W, H)
    tr = Cv(W, H)
    top = (cx + lean, G - crown_h)
    n = 26
    for i in range(n + 1):
        t = i / n
        x = cx + lean * (t ** 1.6); y = G - crown_h * t
        hw = 5.5 - 2.2 * t
        for xx in range(int(x - hw), int(x + hw) + 1):
            for yy in range(int(y) - 4, int(y) + 1):
                u = (xx + .5 - (x - hw)) / (2 * hw)
                tt = 3 if u < .3 else 2 if u < .7 else 1
                if int(yy - G) % 6 in (0, 1): tt = max(0, tt - 1)          # the ring scars
                tr.px(xx, yy, R['palmbark'][tt])
    tr.outline(); cv.paste(tr)
    fr = Cv(W, H)
    for k in range(nfr):
        a = -math.pi * .95 + k * (math.pi * 1.9) / (nfr - 1) + rng.uniform(-.12, .12)
        L = rng.uniform(.75, 1.0) * W * .42
        x1 = top[0] + math.cos(a) * L; y1 = top[1] + math.sin(a) * L * .55 + L * .32
        droop = 10 if abs(math.cos(a)) > .4 else 4
        lit = math.cos(a) < .2 and math.sin(a) < .3
        blade(fr, top[0], top[1], x1, y1 + droop, droop * (1 if x1 > top[0] else -1) * .2, 9,
              lambda x, y, lit=lit: R['palm'][(3 if lit else 2) if (x + y) % 5 else (2 if lit else 1)])
        # leaflets: a comb of short dark notches along the underside
        for j in range(4, 15):
            t = j / 16; bx = top[0] + (x1 - top[0]) * t; by = top[1] + (y1 + droop - top[1]) * t + droop * .4 * math.sin(t * math.pi)
            fr.px(int(bx), int(by + 3), R['palm'][0]); fr.px(int(bx + 1), int(by + 4), R['palm'][1])
    fr.outline(); cv.paste(fr)
    if nuts:
        for dx, dy in ((-4, 4), (3, 5), (0, 8)):
            for (x, y) in cv.ellpts(top[0] + dx, top[1] + dy, 3, 3): cv.px(x, y, R['dwood'][3 if x < top[0] + dx else 1])
    cv.outline()
    return cv, cx


@vprop('palm_tree', 'Palm tree', 1.0, 0.45, ['beach', 'island'], group='palm', solid=.4)
def p_palm_tree(rng):
    return palm(rng, 130, 190, 18, 150)


@vprop('palm_tree_b', 'Leaning palm', 1.0, 0.5, ['beach', 'island'], group='palm', solid=.4)
def p_palm_tree_b(rng):
    return palm(rng, 150, 160, -34, 118, nfr=8)


@vprop('palm_small', 'Young palm', 0.5, 0.5, ['beach', 'island'], group='palm', solid=.2)
def p_palm_small(rng):
    return palm(rng, 80, 96, 6, 66, nfr=7, nuts=False)


@vprop('villa', 'White villa', 1.7, 0, ['island', 'town'], group='house', box=[3.8, 2.6])
def p_villa(rng):
    W, H = 190, 168; G = H - 2; cx = 95
    cv = Cv(W, H)
    x0, x1 = 26, 164; top = 78
    wall(cv, x0, top, x1, G - 6, R['white'], siding=0, eave=4)
    stone_band(cv, x0 - 2, x1 + 2, G - 5, G, R['sand'] if 'sand' in R else R['hay'])
    tile_roof(cv, 40, top + 4, 52, 138, 16, 174, R['terra'], tw=8)
    shade_below(cv, x0, x1, top + 5, 3)
    dx = cx
    door(cv, dx, G - 6, 26, 50, Rw=R['sea'], Rfr=R['white'], arch=True)
    door_step(cv, dx, G, 16)
    for wx in (x0 + 14, x1 - 40):
        window(cv, wx, 96, 26, 30, Rf=R['white'], rng=rng, box=['pink', 'coral', 'gold'])
        shutters(cv, wx, 96, 26, 30, R['sea'])
    window(cv, cx - 9, 50, 18, 16, Rf=R['white'], sill=False, glow=True)
    wall_lamp(cv, dx + 21, 104)
    # a bougainvillea climbing the left corner
    for _ in range(70):
        x = rng.randint(x0 - 2, x0 + 16); y = rng.randint(top + 2, G - 30)
        if (x - x0) * .8 + (y - top) * .25 < 22: cv.px(x, y, R['pink'][rng.choice((2, 3, 4))])
    cv.outline(); cv.door = dx
    v17_plan(cv, kind='hip', wall=[x0, x1], eave=top + 4, pitch=30, over=.35, roofCol=P['terra'], roofTex=8, wallCol=P['white'], wallTex=0, trimCol=P['sea'], floors=1, rooms=[0, 1])
    return cv, cx


@vprop('lighthouse', 'Lighthouse', 1.6, 0, ['island', 'beach'], solid=1.0)
def p_lighthouse(rng):
    W, H = 96, 300; G = H - 2; cx = 48
    cv = Cv(W, H)
    base_w, top_w, y_top = 30, 18, 70
    for y in range(y_top, G - 4):
        f = (y - y_top) / (G - 4 - y_top); hw = top_w + (base_w - top_w) * f
        band_ = int((y - y_top) / 34) % 2
        Rb = R['red'] if band_ == 0 else R['white']
        for x in range(int(cx - hw), int(cx + hw) + 1):
            u = (x + .5 - (cx - hw)) / (2 * hw)
            cv.px(x, y, Rb[4 if u < .12 else 3 if u < .35 else 2 if u < .72 else 1])
    cv.rect(cx - base_w - 4, G - 5, cx + base_w + 4, G, lambda x, y: R['stone'][3 if y == G - 5 else 2])
    door(cv, cx, G - 6, 16, 30, Rw=R['dwood'], arch=True, glass=False)
    for wy in (G - 90, G - 150):
        window(cv, cx - 5, wy, 10, 14, Rf=R['white'], cross=False, sill=False, rec=None)
    # gallery and lamp room
    cv.rect(cx - top_w - 6, y_top - 4, cx + top_w + 6, y_top, lambda x, y: R['iron'][3 if y == y_top - 4 else 1])
    for x in range(cx - top_w - 6, cx + top_w + 7, 4): cv.rect(x, y_top - 14, x, y_top - 5, R['iron'][1])
    cv.rect(cx - top_w - 6, y_top - 15, cx + top_w + 6, y_top - 14, R['iron'][2])
    cv.rect(cx - 12, y_top - 40, cx + 12, y_top - 5, lambda x, y: R['lamp'][4 if (x + y) % 9 < 3 else 3])
    for x in (cx - 12, cx - 4, cx + 4, cx + 12): cv.rect(x, y_top - 40, x, y_top - 5, R['iron'][1])
    cv.poly([(cx - 16, y_top - 40), (cx, y_top - 58), (cx + 16, y_top - 40)], lambda x, y: R['red'][3 if x < cx else 1])
    cv.rect(cx - 1, y_top - 64, cx, y_top - 58, R['iron'][2])
    cv.outline()
    cv.fx.append(('glow', cx, y_top - 22))
    return cv, cx


@vprop('buoy', 'Buoy', 0.3, 0.6, ['beach', 'island', 'water'], solid=.3)
def p_buoy(rng):
    W, H = 30, 52; G = H - 2; cx = 15
    cv = Cv(W, H)
    for (x, y) in cv.ellpts(cx, G - 6, 11, 6): cv.px(x, y, R['red'][3 if x < cx - 3 else 2 if x < cx + 4 else 1])
    for y in range(G - 34, G - 8):
        hw = 4 + (y - (G - 34)) * .18
        for x in range(int(cx - hw), int(cx + hw) + 1):
            Rb = R['white'] if ((y - (G - 34)) // 7) % 2 else R['red']
            cv.px(x, y, Rb[3 if x < cx - 1 else 2 if x < cx + 2 else 1])
    cv.rect(cx - 2, G - 42, cx + 2, G - 35, lambda x, y: R['lamp'][4 if x < cx else 3])
    for x in range(cx - 9, cx + 10): cv.px(x, G - 1, R['water'][4] if x % 3 else None)
    cv.outline(); cv.fx.append(('glow', cx, G - 39))
    return cv, cx


@vprop('beach_umbrella', 'Beach umbrella', 0.9, 0.2, ['beach', 'island'], solid=.2)
def p_beach_umbrella(rng):
    W, H = 96, 96; G = H - 2; cx = 48
    cv = Cv(W, H)
    cv.line(cx + 2, G - 2, cx - 4, G - 70, R['white'][2], 2)
    can = Cv(W, H)
    for y in range(G - 82, G - 56):
        for x in range(cx - 44, cx + 40):
            X = x + .5 - (cx - 3); Y = y + .5 - (G - 56)
            e = (X / 42) ** 2 + ((Y + 4) / 26) ** 2
            if e > 1 or Y > -2 + abs(math.sin(X / 42 * math.pi * 3.5)) * -3: continue
            seg = int((math.atan2(-Y, X) + math.pi) / (math.pi / 7)) % 2
            Rc = R['coral'] if seg else R['white']
            cv_t = 3 if X < -12 else 2 if X < 16 else 1
            can.px(x, y, Rc[cv_t])
    can.outline(); cv.paste(can)
    cv.outline()
    return cv, cx


@vprop('deck_chair', 'Deck chair', 0.3, 0, ['beach', 'island'], solid=.3)
def p_deck_chair(rng):
    W, H = 56, 40; G = H - 2; cx = 28
    cv = Cv(W, H)
    cv.line(cx - 20, G, cx - 6, G - 14, R['wood'][1], 2); cv.line(cx + 18, G, cx + 6, G - 12, R['wood'][1], 2)
    cv.poly([(cx - 22, G - 12), (cx + 8, G - 12), (cx + 18, G - 30), (cx + 12, G - 32), (cx + 2, G - 16), (cx - 22, G - 16)],
            lambda x, y: (R['sea'] if (x // 4) % 2 else R['white'])[3 if y < G - 20 else 2])
    cv.outline()
    return cv, cx


@vprop('sailboat', 'Sailboat', 1.2, 0.3, ['beach', 'island', 'water'], solid=1.0)
def p_sailboat(rng):
    W, H = 150, 170; G = H - 2; cx = 75
    cv = Cv(W, H)
    hull = Cv(W, H)
    hull.poly([(cx - 66, G - 30), (cx + 70, G - 30), (cx + 50, G - 6), (cx - 54, G - 6)], lambda x, y: R['white'][3 if y < G - 22 else 2 if y < G - 12 else 1])
    for x in range(cx - 60, cx + 66): hull.px(x, G - 24, R['sea'][2]); hull.px(x, G - 23, R['sea'][1])
    hull.poly([(cx - 30, G - 30), (cx + 20, G - 30), (cx + 14, G - 42), (cx - 22, G - 42)], R['plank'][2])
    for wx in (cx - 16, cx - 4, cx + 8): hull.rect(wx, G - 39, wx + 6, G - 34, R['glass'][2])
    hull.outline(); cv.paste(hull)
    cv.rect(cx - 1, G - 160, cx + 1, G - 42, lambda x, y: R['iron'][3 if x < cx else 1])
    sail = Cv(W, H)
    sail.poly([(cx + 3, G - 156), (cx + 3, G - 48), (cx + 58, G - 52)], lambda x, y: R['sail'][3 if (x - cx) < 20 else 2])
    sail.poly([(cx - 3, G - 140), (cx - 3, G - 50), (cx - 44, G - 54)], lambda x, y: R['sail'][2 if (cx - x) < 16 else 1])
    for k in range(3): sail.line(cx + 3, G - 120 + k * 24, cx + 30 + k * 8, G - 76 + k * 8, R['sail'][1])
    sail.outline(); cv.paste(sail)
    cv.rect(cx - 2, G - 166, cx + 8, G - 160, R['coral'][3])
    for x in range(cx - 60, cx + 64): cv.px(x, G, R['water'][4] if (x // 3) % 2 else None)
    cv.outline()
    return cv, cx


@vprop('shell_pile', 'Shells', 0, 0, ['beach', 'island'])
def p_shell_pile(rng):
    W, H = 34, 16; G = H - 2; cx = 17
    cv = Cv(W, H)
    for k in range(6):
        x = rng.randint(4, W - 6); y = G - rng.randint(0, 4)
        Rc = R[rng.choice(('pink', 'peach', 'white', 'coral'))]
        for (xx, yy) in cv.ellpts(x, y, 3, 2): cv.px(xx, yy, Rc[3 if xx < x else 2])
        cv.px(x, y - 1, Rc[4])
    cv.outline()
    return cv, cx


# ----------------------------------------------------------------------------- the mountains
@vprop('tree_pine_snow', 'Snowy pine', 1.4, 0.15, ['snow', 'mountain'], group='tree_pine_snow', solid=.5)
def p_tree_pine_snow(rng):
    cv, cx = pine_tree(rng, 110, 200, [(10, 34, 11), (22, 60, 18), (38, 88, 25), (56, 118, 32), (76, 148, 38), (98, 176, 44)], Rp=ramp((40, 104, 92)))
    snow_cap(cv, 4)
    return cv, cx


@vprop('tree_pine_snow_b', 'Tall snowy pine', 1.6, 0.15, ['snow', 'mountain'], group='tree_pine_snow', solid=.5)
def p_tree_pine_snow_b(rng):
    cv, cx = pine_tree(rng, 100, 240, [(8, 40, 9), (24, 70, 15), (44, 104, 21), (66, 140, 27), (90, 176, 33), (116, 212, 39)], th=34, Rp=ramp((36, 96, 88)))
    snow_cap(cv, 4)
    return cv, cx


@vprop('tree_pine_snow_small', 'Small snowy pine', 0.7, 0.2, ['snow', 'mountain'], group='tree_pine_snow', solid=.3)
def p_tree_pine_snow_small(rng):
    cv, cx = pine_tree(rng, 64, 100, [(8, 30, 9), (20, 50, 15), (34, 72, 21)], th=20, tw=(4, 3), Rp=ramp((44, 110, 96)))
    snow_cap(cv, 3)
    return cv, cx


def chalet(rng, Rw, Rr, roofc, wallc, x0=30, x1=140, W=170, H=184):
    G = H - 2; cx = W // 2
    cv = Cv(W, H)
    yb = 92; ay = 26; xl, xr = x0 - 18, x1 + 18; T = 18
    for y in range(ay + 10, G - 5):
        for x in range(x0, x1 + 1):
            ey = ay + 10 + abs(x + .5 - cx) * (yb - ay - 10) / (cx - xl)
            if y + .5 < ey: continue
            t = 3 if x == x0 else 1 if x >= x1 - 1 else 2
            if (y - yb) % 7 == 6 and y > yb: t = max(0, t - 1)
            cv.px(x, y, Rw[t])
    stone_band(cv, x0 - 2, x1 + 2, G - 22, G, R['stone'], bw=10, bh=5)
    # balcony
    by = yb + 34
    cv.rect(x0 - 6, by, x1 + 6, by + 3, R['dwood'][2])
    for x in range(x0 - 6, x1 + 7, 6): cv.rect(x, by - 14, x + 1, by, R['dwood'][1])
    cv.rect(x0 - 6, by - 16, x1 + 6, by - 14, R['dwood'][3])
    gable_roof(cv, cx, ay, xl, xr, yb, T, Rr)
    snow_cap(cv, 5)
    for wx in (x0 + 12, x1 - 36):
        window(cv, wx, yb + 2, 24, 22, Rf=R['white'], rng=rng, sill=False)
        shutters(cv, wx, yb + 2, 24, 22, R['red'])
    window(cv, cx - 9, ay + 30, 18, 20, Rf=R['white'], sill=False, glow=True)
    dx = cx
    door(cv, dx, G - 6, 26, 50, Rw=R['dwood'], arch=False)
    door_step(cv, dx, G, 16)
    window(cv, x1 - 38, G - 64, 26, 26, Rf=R['white'], rng=rng, box=['red', 'gold', 'pink'])
    wall_lamp(cv, dx + 21, G - 44)
    sm = chimney(cv, x1 - 30, x1 - 18, ay + 2, ay + 40, R['stone'], brick=False)
    cv.outline(); cv.door = dx; cv.fx.append(('smoke',) + sm)
    v17_plan(cv, kind='gableF', wall=[x0, x1], eave=yb, apex=ay + T, over=.45, roofCol=roofc, roofTex=10, wallCol=wallc, wallTex=1, trimCol=P['dwood'], floors=2, rooms=[1, 0])
    return cv, cx


@vprop('chalet', 'Chalet', 1.7, 0, ['snow', 'mountain', 'town'], group='house', box=[3.6, 2.6])
def p_chalet(rng):
    return chalet(rng, R['chalet'], ramp((120, 60, 56)), (120, 60, 56), P['chalet'])


@vprop('chalet_b', 'Blue chalet', 1.7, 0, ['snow', 'mountain', 'town'], group='house', box=[3.6, 2.6])
def p_chalet_b(rng):
    return chalet(rng, ramp((150, 120, 96)), ramp((70, 90, 130)), (70, 90, 130), (150, 120, 96))


@vprop('snowman', 'Snowman', 0.4, 0, ['snow', 'mountain'], solid=.35)
def p_snowman(rng):
    W, H = 44, 66; G = H - 2; cx = 22
    cv = Cv(W, H)
    for (r, y) in ((13, G - 12), (10, G - 33), (8, G - 49)):
        for (x, yy) in cv.ellpts(cx, y, r, r * .9): cv.px(x, yy, R['snow'][4 if (x - cx) + (yy - y) < -r * .4 else 3 if x < cx + r * .3 else 2])
    for dy in (G - 37, G - 31, G - 25): cv.rect(cx - 1, dy, cx, dy + 1, OL)
    cv.px(cx - 3, G - 52, OL); cv.px(cx + 2, G - 52, OL)
    cv.poly([(cx, G - 49), (cx + 9, G - 48), (cx, G - 47)], R['orange'][3])
    cv.rect(cx - 9, G - 44, cx + 9, G - 41, R['red'][2]); cv.rect(cx + 5, G - 41, cx + 8, G - 34, R['red'][1])
    cv.rect(cx - 7, G - 64, cx + 7, G - 56, R['iron'][2]); cv.rect(cx - 10, G - 57, cx + 10, G - 55, R['iron'][1])
    cv.line(cx - 10, G - 33, cx - 20, G - 44, R['dwood'][2], 2); cv.line(cx + 10, G - 33, cx + 19, G - 42, R['dwood'][2], 2)
    cv.outline()
    return cv, cx


@vprop('boulder_snow', 'Snowy boulder', 0.9, 0, ['snow', 'mountain'], group='boulder', solid=1.0)
def p_boulder_snow(rng):
    cv, cx = boulder_shape(rng, 110, 76, [(-46, 1), (-42, -22), (-26, -46), (-4, -56), (18, -54), (36, -40), (46, -16), (48, 1)], R['stone'], bias=.04)
    snow_cap(cv, 7)
    return cv, cx


@vprop('rocks_snow', 'Snowy rocks', 0.35, 0, ['snow', 'mountain'], group='rocks')
def p_rocks_snow(rng):
    cv, cx = rock_pile(rng, 64, 34, ((-7, 13, 10), (13, 8, 6), (-22, 6, 4), (4, 5, 3)), R['stone'])
    snow_cap(cv, 3)
    return cv, cx


@vprop('ski_sign', 'Trail sign', 0.3, 0, ['snow', 'mountain'], solid=.2)
def p_ski_sign(rng):
    W, H = 44, 70; G = H - 2; cx = 22
    cv = Cv(W, H)
    cv.rect(cx - 2, G - 56, cx + 1, G, lambda x, y: R['dwood'][3 if x < cx else 1])
    for k, (c, d) in enumerate((('red', 1), ('blue', -1), ('iron', 1))):
        y = G - 56 + k * 13
        x0, x1 = (cx, cx + 20) if d > 0 else (cx - 20, cx)
        cv.poly([(x0, y), (x1, y), (x1 + 5 * d if d > 0 else x0 - 5, y + 5), (x1, y + 10), (x0, y + 10)] if d > 0 else [(x1, y), (x0, y), (x0 - 5, y + 5), (x0, y + 10), (x1, y + 10)], R[c][2])
    snow_cap(cv, 2)
    cv.outline()
    return cv, cx


# ----------------------------------------------------------------------------- the volcano
@vprop('tree_dead', 'Charred tree', 0.9, 0.05, ['volcano'], solid=.3)
def p_tree_dead(rng):
    W, H = 110, 150; G = H - 2; cx = 55
    cv = Cv(W, H)
    Rt = ramp((70, 58, 56))
    trunk(cv, [(cx - 7, G + 1), (cx - 3, G - 90), (cx + 3, G - 90), (cx + 7, G + 1)], Rt, rng)

    def branch(x, y, a, L, w, d):
        if d == 0 or L < 6: return
        x1 = x + math.cos(a) * L; y1 = y - math.sin(a) * L
        cv.line(x, y, x1, y1, Rt[2 if math.cos(a) < 0 else 1], max(1, int(w)))
        for s in (-1, 1):
            branch(x1, y1, a + s * rng.uniform(.3, .6), L * rng.uniform(.55, .72), w * .65, d - 1)
    branch(cx, G - 88, math.pi / 2, 30, 4, 4)
    branch(cx - 2, G - 60, math.pi * .78, 26, 3, 3)
    branch(cx + 2, G - 50, math.pi * .2, 24, 3, 3)
    for _ in range(14):
        x = rng.randint(cx - 6, cx + 5); y = rng.randint(G - 90, G - 4)
        if cv.get(x, y): cv.px(x, y, R['lava'][1] if rng.random() < .2 else Rt[0])
    cv.outline()
    return cv, cx


@vprop('rocks_basalt', 'Basalt rocks', 0.35, 0, ['volcano'], group='rocks_basalt')
def p_rocks_basalt(rng):
    return rock_pile(rng, 70, 36, ((-8, 14, 11), (14, 9, 7), (-24, 6, 4), (4, 6, 3)), R['basalt'])


@vprop('boulder_basalt', 'Basalt boulder', 0.9, 0, ['volcano'], group='rocks_basalt', solid=1.0)
def p_boulder_basalt(rng):
    return boulder_shape(rng, 104, 80, [(-40, 1), (-38, -28), (-22, -56), (2, -66), (24, -56), (38, -30), (42, 1)], R['basalt'], bias=-.04)


@vprop('basalt_columns', 'Basalt columns', 1.2, 0, ['volcano'], solid=1.1)
def p_basalt_columns(rng):
    W, H = 120, 130; G = H - 2; cx = 60
    cv = Cv(W, H)
    for k, (dx, h) in enumerate(((-40, 60), (-24, 92), (-8, 118), (8, 104), (24, 80), (40, 52))):
        lay = Cv(W, H)
        x0 = cx + dx - 8; x1 = cx + dx + 7; top = G - h
        for y in range(top, G + 1):
            for x in range(x0, x1 + 1):
                t = 3 if x < x0 + 3 else 2 if x < x1 - 3 else 1
                if (y - top) % 23 == 22: t = 0
                lay.px(x, y, R['basalt'][t])
        for x in range(x0, x1 + 1):
            for y in range(top - 4, top):
                lay.px(x, y, R['basalt'][4 if x < cx + dx else 3])
        lay.outline(); cv.paste(lay)
    return cv, cx


@vprop('obsidian', 'Obsidian shards', 0.5, 0, ['volcano'], solid=.5)
def p_obsidian(rng):
    return crystal_cluster(rng, R['obsid'], [(-10, 46, -.16, 9), (6, 60, .08, 10), (18, 34, .3, 7), (-22, 26, -.36, 6), (0, 22, 0, 6)], [(-8, -40), (10, -52)], W=76, H=72, srx=26)


@vprop('steam_vent', 'Steam vent', 0.4, 0, ['volcano', 'snow'], solid=.4)
def p_steam_vent(rng):
    W, H = 56, 30; G = H - 2; cx = 28
    cv = Cv(W, H)
    for (x, y) in cv.ellpts(cx, G - 6, 24, 8): cv.px(x, y, R['ash'][3 if y < G - 9 else 2 if x < cx + 10 else 1])
    for (x, y) in cv.ellpts(cx, G - 9, 12, 4): cv.px(x, y, R['ash'][0])
    for (x, y) in cv.ellpts(cx, G - 9, 7, 2): cv.px(x, y, R['yellow'][2])
    cv.outline(); cv.fx.append(('smoke', cx, G - 12))
    return cv, cx


@vprop('lava_rock', 'Glowing lava rock', 0.6, 0, ['volcano'], solid=.6)
def p_lava_rock(rng):
    cv, cx = boulder_shape(rng, 80, 56, [(-32, 1), (-30, -18), (-14, -38), (8, -42), (26, -28), (32, 1)], R['basalt'], bias=0)
    for _ in range(4):
        x = rng.randint(cx - 22, cx + 18); y = rng.randint(20, 48)
        for k in range(rng.randint(6, 14)):
            if cv.get(x, y) is not None and cv.get(x, y - 1) is not None: cv.px(x, y, R['lava'][4 if k % 3 == 0 else 3])
            x += rng.choice((-1, 0, 1)); y += rng.choice((0, 1, 1))
    cv.fx.append(('glow', cx, 30))
    return cv, cx


@vprop('lava_vent', 'Lava vent', 0.5, 0, ['volcano'], solid=.6)
def p_lava_vent(rng):
    W, H = 70, 44; G = H - 2; cx = 35
    cv = Cv(W, H)
    cv.poly([(cx - 32, G), (cx - 14, G - 30), (cx + 14, G - 30), (cx + 32, G)], lambda x, y: R['basalt'][3 if x < cx - 6 else 2 if x < cx + 10 else 1])
    for (x, y) in cv.ellpts(cx, G - 30, 14, 4): cv.px(x, y, R['lava'][4 if abs(x - cx) < 6 else 3])
    for k in range(5):
        x = cx + rng.randint(-8, 8)
        for y in range(G - 30, G - rng.randint(4, 18)): cv.px(x + (y % 3 == 0), y, R['lava'][3])
    cv.outline(); cv.fx.append(('glow', cx, G - 32)); cv.fx.append(('smoke', cx, G - 34))
    return cv, cx


@vprop('ash_sign', 'Danger sign', 0.3, 0, ['volcano'], solid=.2)
def p_ash_sign(rng):
    W, H = 40, 64; G = H - 2; cx = 20
    cv = Cv(W, H)
    cv.rect(cx - 2, G - 40, cx + 1, G, lambda x, y: R['iron'][3 if x < cx else 1])
    cv.poly([(cx, G - 62), (cx + 17, G - 34), (cx - 17, G - 34)], lambda x, y: R['yellow'][3 if x < cx else 2])
    cv.rect(cx - 1, G - 54, cx, G - 44, OL); cv.rect(cx - 1, G - 41, cx, G - 39, OL)
    cv.outline()
    return cv, cx


# ============================================================================= v24 FAR LAYERS
@far('volcano', 'Volcanic peaks')
def f_volcano(rng):
    cv = WCv(FW, FH)
    hz = (150, 120, 120)
    back = ridge(cv, lambda x: 54 + pn(x, [(10, 2, 1.4), (5, 5, .7), (2, 11, 2.1)]), [mix(c, hz, .5) for c in ramp((92, 78, 84))], rim=False)
    # the great cone, with a glowing crater and a lava streak
    c0 = FW * .35
    for x in range(FW):
        d = abs(wdx(x, c0))
        if d > 150: continue
        top = 10 + d * .62 + (0 if d > 18 else (18 - d) * .5)
        for y in range(int(top), FH):
            t = 3 if wdx(x, c0) < -20 else 2 if wdx(x, c0) < 20 else 1
            if d < 18 and y < top + 3: t = 4
            cv.px(x, y, mix(ramp((84, 70, 74))[t], hz, .25))
        if d < 16:
            cv.px(x, int(top), (255, 170, 80)); cv.px(x, int(top) + 1, (240, 110, 50))
    for k in range(70):
        x = int(c0 + 6 + k * .35 + 3 * math.sin(k * .3)); y = 18 + k
        if y < FH: cv.px(x, y, (240, 110, 50)); cv.px(x + 1, y, (200, 80, 40))
    ridge(cv, lambda x: 92 + pn(x, [(6, 3, .2), (3, 8, 1.9), (1.5, 17, .5)]), [mix(c, hz, .15) for c in ramp((70, 62, 66))], rim=True)
    return cv


@far('sea', 'Open sea')
def f_sea(rng):
    cv = WCv(FW, FH)
    hz = (196, 220, 236)
    for x in range(FW):
        for y in range(96, FH):
            t = 2 if (x * 7 + y * 13) % 29 else 3
            cv.px(x, y, mix(ramp((70, 140, 196))[t], hz, .45 - (y - 96) * .01))
    for cxi in (90, 300, 470, 590):
        w = rng.randint(30, 70); h = rng.randint(6, 16)
        for x in range(cxi - w, cxi + w):
            top = 96 - h * (1 - (abs(x - cxi) / w) ** 2)
            for y in range(int(top), 96):
                cv.px(x, y, mix(ramp((96, 150, 110))[2 if x < cxi else 1], hz, .55))
    return cv
# ============================================================================= v26: ROOMS YOU CAN WALK INTO
# Shops, the clinic, the lab and houses get insides: counters, shelves of goods, beds, bookcases, a lab machine,
# rugs, tables and chairs, a sofa, a fireplace, plants, and pictures, a clock and a window to hang on the back wall.

P.update(apron=(214, 96, 92), linen=(240, 236, 228), blush=(242, 168, 176), rug=(180, 74, 84), rugb=(70, 112, 170), sofa=(96, 132, 178), screenc=(130, 220, 200))
for _k in ('apron', 'linen', 'blush', 'rug', 'rugb', 'sofa', 'screenc'):
    R[_k] = ramp(P[_k])


def block(cv, x0, x1, ytop, G, Rf, Rt=None, top=6, tones=True):
    """a box seen from the front and a little above: a lit top band, then the front face shaded left to right"""
    Rt = Rt or Rf
    for y in range(ytop, ytop + top):
        for x in range(x0, x1 + 1): cv.px(x, y, Rt[4 if y == ytop else 3])
    for y in range(ytop + top, G + 1):
        for x in range(x0, x1 + 1): cv.px(x, y, Rf[xt(x, x0, x1)] if tones else Rf[2])
    for x in range(x0, x1 + 1): cv.px(x, ytop + top, Rf[1])


def goods(cv, x0, x1, y0, y1, rng, cols=('coral', 'gold', 'sky', 'mint', 'pink', 'lilac', 'orange', 'white')):
    """a shelf of boxes, jars and tins"""
    x = x0
    while x < x1 - 3:
        w = rng.randint(3, 6); h = rng.randint(max(3, (y1 - y0) // 2), y1 - y0); c = R[rng.choice(cols)]
        kind = rng.random()
        for yy in range(y1 - h, y1 + 1):
            for xx in range(x, min(x1, x + w)):
                if kind < .3 and yy < y1 - h + 2 and (xx == x or xx == x + w - 1): continue      # a jar's rounded shoulders
                cv.px(xx, yy, c[3 if xx == x else 2 if xx < x + w - 1 else 1])
        if h > 5: cv.px(x + 1, y1 - h // 2, R['white'][4])
        x += w + (1 if rng.random() < .6 else 0)


@vprop('shop_counter', 'Shop counter', 0.9, 0, ['indoor'], box=[2.6, 0.9])
def p_shop_counter(rng):
    W, H = 96, 58; G = H - 2; cx = 48
    cv = Cv(W, H)
    block(cv, cx - 44, cx + 44, G - 34, G, R['wood'], R['plank'], top=7)
    for x0 in range(cx - 40, cx + 40, 20):          # panels on the front
        cv.orect(x0 + 2, G - 22, x0 + 17, G - 4, R['dwood'][1])
    # the till, a bell and a little stack of bags
    lay = Cv(W, H)
    block(lay, cx + 14, cx + 32, G - 50, G - 34, R['iron'], R['stone'], top=4)
    lay.rect(cx + 17, G - 46, cx + 29, G - 41, R['mint'][3]); lay.rect(cx + 18, G - 45, cx + 22, G - 43, R['tire'][0])
    for (x, y) in lay.ellpts(cx - 22, G - 37, 4, 3): lay.px(x, y, R['gold'][3 if x < cx - 22 else 2])
    lay.px(cx - 22, G - 41, R['gold'][4])
    lay.rect(cx - 6, G - 44, cx + 4, G - 35, R['coral'][2]); lay.rect(cx - 4, G - 47, cx + 2, G - 44, R['coral'][1])
    layer_out(cv, lay)
    cv.outline()
    return cv, cx


@vprop('counter_white', 'Reception desk', 0.9, 0, ['indoor'], box=[2.6, 0.9])
def p_counter_white(rng):
    W, H = 96, 56; G = H - 2; cx = 48
    cv = Cv(W, H)
    block(cv, cx - 44, cx + 44, G - 32, G, R['linen'], R['white'], top=7)
    for x in range(cx - 44, cx + 45): cv.px(x, G - 14, R['blush'][2]); cv.px(x, G - 13, R['blush'][2]); cv.px(x, G - 12, R['blush'][1])
    # a red cross on the front
    cv.rect(cx - 3, G - 27, cx + 3, G - 17, R['red'][2]); cv.rect(cx - 8, G - 25, cx + 8, G - 19, R['red'][2]); cv.rect(cx - 2, G - 26, cx, G - 18, R['red'][3])
    lay = Cv(W, H)
    block(lay, cx + 18, cx + 34, G - 46, G - 32, R['iron'], R['stone'], top=3)
    lay.rect(cx + 20, G - 43, cx + 32, G - 36, R['screenc'][3])
    for (x, y) in lay.ellpts(cx - 26, G - 36, 5, 4): lay.px(x, y, R['leaf'][3 if y < G - 37 else 2])
    lay.rect(cx - 29, G - 34, cx - 23, G - 32, R['terra'][2])
    layer_out(cv, lay)
    cv.outline()
    cv.fx.append(('glow', cx + 26, G - 40))
    return cv, cx


@vprop('shop_shelf', 'Shelves of goods', 0.6, 0, ['indoor'], box=[2.0, 0.6])
def p_shop_shelf(rng):
    W, H = 74, 98; G = H - 2; cx = 37
    cv = Cv(W, H)
    block(cv, cx - 34, cx + 34, G - 90, G, R['dwood'], R['wood'], top=4)
    for k in range(4):
        y1 = G - 70 + k * 20
        cv.rect(cx - 30, y1 - 15, cx + 30, y1, R['dwood'][0])
        goods(cv, cx - 30, cx + 30, y1 - 13, y1, rng)
        for x in range(cx - 31, cx + 32): cv.px(x, y1 + 1, R['plank'][3]); cv.px(x, y1 + 2, R['dwood'][1])
    cv.outline()
    return cv, cx


@vprop('fridge_drinks', 'Drinks fridge', 0.5, 0, ['indoor'], box=[1.0, 0.7])
def p_fridge_drinks(rng):
    W, H = 42, 92; G = H - 2; cx = 21
    cv = Cv(W, H)
    block(cv, cx - 18, cx + 18, G - 86, G, R['white'], R['white'], top=4)
    cv.rect(cx - 15, G - 78, cx + 15, G - 12, R['glass'][1])
    for k in range(4):
        y1 = G - 64 + k * 14
        for i in range(6):
            c = R[rng.choice(['coral', 'mint', 'gold', 'sky', 'orange'])]
            cv.rect(cx - 13 + i * 5, y1 - 9, cx - 11 + i * 5, y1, c[3]); cv.px(cx - 12 + i * 5, y1 - 10, c[2])
        for x in range(cx - 15, cx + 16): cv.px(x, y1 + 1, R['white'][2])
    cv.rect(cx - 16, G - 84, cx + 16, G - 81, R['sky'][3])
    cv.outline()
    cv.fx.append(('glow', cx, G - 46))
    return cv, cx


@vprop('clinic_bed', 'Clinic bed', 0.8, 0, ['indoor'], box=[1.0, 2.0])
def p_clinic_bed(rng):
    W, H = 52, 70; G = H - 2; cx = 26
    cv = Cv(W, H)
    # a bed seen from the foot end: frame, mattress running back, pillow at the far end, blanket folded at the near end
    for y in range(G - 44, G - 10):
        f = (y - (G - 44)) / 34; hw = 15 + f * 6
        for x in range(int(cx - hw), int(cx + hw) + 1):
            cv.px(x, y, R['linen'][4 if y < G - 40 else 3 if x < cx + hw * .5 else 2])
    for y in range(G - 46, G - 38):
        for x in range(cx - 10, cx + 10): cv.px(x, y, R['white'][4 if y < G - 43 else 3])
    for y in range(G - 26, G - 10):
        f = (y - (G - 44)) / 34; hw = 15 + f * 6
        for x in range(int(cx - hw), int(cx + hw) + 1): cv.px(x, y, R['blush'][3 if y < G - 22 else 2 if x < cx + hw * .4 else 1])
    block(cv, cx - 22, cx + 22, G - 10, G, R['iron'], R['stone'], top=2)
    for x in (cx - 22, cx + 21):
        for y in range(G - 18, G + 1): cv.px(x, y, R['iron'][2]); cv.px(x + 1, y, R['iron'][1])
    cv.outline()
    return cv, cx


@vprop('privacy_screen', 'Privacy screen', 0.3, 0, ['indoor'], box=[1.6, 0.3])
def p_privacy_screen(rng):
    W, H = 60, 74; G = H - 2; cx = 30
    cv = Cv(W, H)
    for k in range(3):
        x0 = cx - 27 + k * 18
        for y in range(G - 62, G - 4):
            for x in range(x0, x0 + 17): cv.px(x, y, R['mint'][3 if x < x0 + 5 else 2 if x < x0 + 13 else 1])
        for y in range(G - 64, G + 1): cv.px(x0, y, R['iron'][2]); cv.px(x0 + 17, y, R['iron'][1])
    cv.outline()
    return cv, cx


@vprop('bookshelf', 'Bookcase', 0.6, 0, ['indoor'], box=[1.8, 0.5])
def p_bookshelf(rng):
    W, H = 66, 100; G = H - 2; cx = 33
    cv = Cv(W, H)
    block(cv, cx - 30, cx + 30, G - 94, G, R['dwood'], R['wood'], top=4)
    for k in range(5):
        y1 = G - 76 + k * 18
        cv.rect(cx - 26, y1 - 14, cx + 26, y1, R['dwood'][0])
        x = cx - 26
        while x < cx + 24:
            w = rng.randint(2, 4); h = rng.randint(9, 14); c = R[rng.choice(['red', 'teal', 'gold', 'lav', 'sky', 'leaf', 'brick', 'cream'])]
            lean = rng.random() < .1
            for yy in range(y1 - h, y1 + 1):
                for xx in range(x, min(cx + 26, x + w)): cv.px(xx + (1 if lean and yy < y1 - h // 2 else 0), yy, c[3 if xx == x else 2])
            cv.px(x, y1 - h + 3, R['gold'][4])
            x += w + (2 if rng.random() < .15 else 0)
        for xx in range(cx - 27, cx + 28): cv.px(xx, y1 + 1, R['wood'][3]); cv.px(xx, y1 + 2, R['dwood'][1])
    cv.outline()
    return cv, cx


@vprop('lab_desk', 'Desk with a computer', 0.7, 0, ['indoor'], box=[1.8, 0.8])
def p_lab_desk(rng):
    W, H = 70, 66; G = H - 2; cx = 35
    cv = Cv(W, H)
    for y in range(G - 30, G - 24):
        for x in range(cx - 32, cx + 33): cv.px(x, y, R['plank'][4 if y == G - 30 else 3])
    for x in range(cx - 32, cx + 33): cv.px(x, G - 24, R['wood'][1])
    for x0 in (cx - 30, cx + 26):
        for y in range(G - 23, G + 1):
            for x in range(x0, x0 + 4): cv.px(x, y, R['wood'][xt(x, x0, x0 + 4)])
    block(cv, cx + 10, cx + 26, G - 23, G - 4, R['wood'], R['plank'], top=2)
    cv.px(cx + 18, G - 14, R['gold'][4])
    lay = Cv(W, H)
    block(lay, cx - 18, cx + 10, G - 58, G - 34, R['iron'], R['stone'], top=2)
    lay.rect(cx - 15, G - 55, cx + 7, G - 38, R['screenc'][2])
    for k in range(4): lay.rect(cx - 13, G - 52 + k * 4, cx - 13 + rng.randint(6, 18), G - 51 + k * 4, R['screenc'][4])
    lay.rect(cx - 6, G - 34, cx - 2, G - 31, R['iron'][1]); lay.rect(cx - 16, G - 33, cx + 8, G - 31, R['tire'][2])
    for (x, y) in lay.ellpts(cx + 20, G - 34, 3, 3): lay.px(x, y, R['white'][3])
    layer_out(cv, lay)
    cv.outline()
    cv.fx.append(('glow', cx - 4, G - 46))
    return cv, cx


@vprop('lab_machine', 'Evolution machine', 1.0, 0, ['indoor'], box=[1.8, 1.2])
def p_lab_machine(rng):
    W, H = 70, 108; G = H - 2; cx = 35
    cv = Cv(W, H)
    block(cv, cx - 30, cx + 30, G - 24, G, R['iron'], R['stone'], top=4)
    # a glass tube with a glowing coin floating inside
    for y in range(G - 92, G - 24):
        for x in range(cx - 16, cx + 17):
            cv.px(x, y, R['cyan'][3 if x < cx - 8 else 2 if x < cx + 8 else 1] if (x + y) % 9 else R['cyan'][4])
    for (x, y) in cv.ellpts(cx, G - 92, 17, 4): cv.px(x, y, R['iron'][3])
    block(cv, cx - 20, cx + 20, G - 100, G - 92, R['iron'], R['stone'], top=2)
    for (x, y) in cv.ellpts(cx, G - 58, 7, 7): cv.px(x, y, R['gold'][4 if (x - cx) + (y - G + 58) < -3 else 3 if x < cx + 2 else 2])
    cv.rect(cx - 1, G - 62, cx + 1, G - 54, R['gold'][1])
    for k, c in enumerate(('red', 'gold', 'mint', 'sky')):
        cv.rect(cx - 24 + k * 7, G - 16, cx - 20 + k * 7, G - 12, R[c][3])
    cv.outline()
    cv.fx.append(('glow', cx, G - 58)); cv.fx.append(('sparkle', cx, G - 70))
    return cv, cx


@vprop('table_round', 'Round table', 0.5, 0, ['indoor', 'town'], solid=0.5)
def p_table_round(rng):
    W, H = 50, 44; G = H - 2; cx = 25
    cv = Cv(W, H)
    for y in range(G - 26, G + 1): cv.px(cx - 2, y, R['dwood'][3]); cv.px(cx - 1, y, R['dwood'][2]); cv.px(cx, y, R['dwood'][2]); cv.px(cx + 1, y, R['dwood'][1])
    for x in range(cx - 10, cx + 11): cv.px(x, G, R['dwood'][1])
    for (x, y) in cv.ellpts(cx, G - 30, 22, 7): cv.px(x, y, R['wood'][4 if y < G - 33 else 3 if y < G - 28 else 2])
    for x in range(cx - 21, cx + 22): cv.px(x, G - 23, R['dwood'][1])
    lay = Cv(W, H)
    for (x, y) in lay.ellpts(cx - 6, G - 33, 4, 2): lay.px(x, y, R['white'][4])
    lay.rect(cx + 4, G - 38, cx + 8, G - 32, R['white'][3]); lay.rect(cx + 5, G - 37, cx + 7, G - 35, R['coral'][2])
    layer_out(cv, lay)
    cv.outline()
    return cv, cx


@vprop('chair_wood', 'Wooden chair', 0.25, 0, ['indoor', 'town'], solid=0.2)
def p_chair_wood(rng):
    W, H = 26, 46; G = H - 2; cx = 13
    cv = Cv(W, H)
    for x0 in (cx - 9, cx + 7):
        for y in range(G - 40, G + 1): cv.px(x0, y, R['wood'][3]); cv.px(x0 + 1, y, R['wood'][1])
    for k in range(3):
        for x in range(cx - 9, cx + 9): cv.px(x, G - 38 + k * 6, R['plank'][3])
    for y in range(G - 18, G - 14):
        for x in range(cx - 10, cx + 10): cv.px(x, y, R['plank'][4 if y == G - 18 else 2])
    cv.outline()
    return cv, cx


@vprop('sofa', 'Sofa', 0.8, 0, ['indoor'], box=[2.0, 0.9])
def p_sofa(rng):
    W, H = 76, 48; G = H - 2; cx = 38
    cv = Cv(W, H)
    block(cv, cx - 32, cx + 32, G - 40, G - 16, R['sofa'], R['sofa'], top=4)
    block(cv, cx - 30, cx + 30, G - 22, G - 4, R['sofa'], R['sofa'], top=5)
    for x0 in (cx - 36, cx + 28):
        block(cv, x0, x0 + 8, G - 28, G - 4, R['sofa'], R['sofa'], top=3)
    for x in range(cx - 1, cx + 1):
        for y in range(G - 21, G - 4): cv.px(x, y, R['sofa'][1])
    for x0 in (cx - 30, cx + 26):
        cv.rect(x0, G - 3, x0 + 3, G, R['dwood'][1])
    cv.rect(cx - 24, G - 34, cx - 12, G - 24, R['gold'][3]); cv.rect(cx - 23, G - 33, cx - 14, G - 31, R['gold'][4])
    cv.outline()
    return cv, cx


@vprop('fireplace', 'Fireplace', 0.6, 0, ['indoor'], box=[1.8, 0.6])
def p_fireplace(rng):
    W, H = 70, 80; G = H - 2; cx = 35
    cv = Cv(W, H)
    Rb = R['brick']
    for y in range(G - 66, G + 1):
        for x in range(cx - 30, cx + 31):
            t = 2
            if (y - (G - 66)) % 5 == 4 or ((x - cx + (3 if ((y - (G - 66)) // 5) % 2 else 0)) % 9 == 0): t = 1
            if x < cx - 26: t = 3
            cv.px(x, y, Rb[t])
    block(cv, cx - 34, cx + 34, G - 70, G - 62, R['stone'], R['marble'], top=3)
    for y in range(G - 40, G + 1):
        hw = 16 if y > G - 34 else 16 - (G - 34 - y) * .9
        for x in range(int(cx - hw), int(cx + hw) + 1): cv.px(x, y, R['tire'][0])
    for (x, y) in cv.ellpts(cx, G - 6, 11, 5): cv.px(x, y, R['fire'][4 if y > G - 6 else 3])
    for k in range(3): cv.rect(cx - 10 + k * 7, G - 4, cx - 5 + k * 7, G - 2, R['dwood'][2])
    lay = Cv(W, H)
    for (x, y) in lay.ellpts(cx - 18, G - 74, 3, 4): lay.px(x, y, R['coral'][3])
    lay.rect(cx + 12, G - 78, cx + 22, G - 70, R['gold'][2]); lay.rect(cx + 14, G - 76, cx + 20, G - 72, R['white'][3])
    layer_out(cv, lay)
    cv.outline()
    cv.fx.append(('fire', cx, G - 8))
    return cv, cx


@vprop('plant_tall', 'Potted plant', 0.35, 0.15, ['indoor', 'town'], solid=0.3)
def p_plant_tall(rng):
    W, H = 40, 66; G = H - 2; cx = 20
    cv = Cv(W, H)
    block(cv, cx - 8, cx + 8, G - 16, G, R['terra'], R['terra'], top=3)
    lv = Cv(W, H)
    for k in range(9):
        a = -math.pi * .9 + k * math.pi * .8 / 8 + rng.uniform(-.1, .1); L = rng.uniform(18, 30)
        x1 = cx + math.cos(a) * L * .7; y1 = G - 16 + math.sin(a) * L * 1.4
        lv.line(cx, G - 16, x1, y1, R['leaf'][2 if k % 2 else 3], 3)
        lv.px(int(x1), int(y1), R['leafy'][4])
    layer_out(cv, lv)
    cv.outline()
    return cv, cx


@vprop('rug_round', 'Round rug', 0.0, 0, ['indoor'], flat=1)
def p_rug_round(rng):
    W, H = 110, 44; G = H - 2; cx = 55
    cv = Cv(W, H)
    for (x, y) in cv.ellpts(cx, G - 20, 52, 19):
        e = ((x + .5 - cx) / 52) ** 2 + ((y + .5 - G + 20) / 19) ** 2
        cv.px(x, y, R['rug'][1 if e > .82 else 3 if e > .6 else 2 if e > .3 else 4 if (x + y) % 6 == 0 else 3])
    return cv, cx


@vprop('rug_long', 'Runner rug', 0.0, 0, ['indoor'], flat=1)
def p_rug_long(rng):
    W, H = 70, 120; G = H - 2; cx = 35
    cv = Cv(W, H)
    for y in range(G - 116, G + 1):
        for x in range(cx - 30, cx + 31):
            edge = x < cx - 26 or x > cx + 26 or y < G - 112 or y > G - 4
            cv.px(x, y, R['rugb'][1] if edge else R['gold'][3] if (abs(x - cx) + (y % 16)) % 16 == 0 else R['rugb'][2 if (y // 8) % 2 else 3])
    return cv, cx


@vprop('wall_painting', 'Painting on the wall', 0.0, 0, ['indoor'])
def p_wall_painting(rng):
    W, H = 56, 44; low = 50; cx = W // 2
    cv = Cv(W, H + low); cv.hang = 1
    cv.rect(2, 2, W - 3, H - 3, R['gold'][2]); cv.orect(2, 2, W - 3, H - 3, R['gold'][4]); cv.orect(4, 4, W - 5, H - 5, R['gold'][1])
    for y in range(6, H - 6):
        for x in range(6, W - 6):
            cv.px(x, y, R['sky'][3] if y < 22 else R['leaf'][2] if y < 30 else R['leaf'][1])
    for (x, y) in cv.ellpts(40, 14, 4, 4): cv.px(x, y, R['gold'][4])
    cv.poly([(10, 30), (22, 16), (34, 30)], R['stone'][3]); cv.poly([(26, 30), (36, 20), (46, 30)], R['stone'][2])
    cv.outline()
    return cv, cx


@vprop('wall_clock', 'Clock on the wall', 0.0, 0, ['indoor'])
def p_wall_clock(rng):
    W, H = 30, 30; low = 56; cx = W // 2
    cv = Cv(W, H + low); cv.hang = 1
    for (x, y) in cv.ellpts(cx, 15, 13, 13): cv.px(x, y, R['wood'][2])
    for (x, y) in cv.ellpts(cx, 15, 10, 10): cv.px(x, y, R['cream'][4 if x < cx else 3])
    cv.line(cx, 15, cx, 8, R['tire'][0]); cv.line(cx, 15, cx + 5, 15, R['tire'][0])
    for k in range(12):
        a = k * math.pi / 6; cv.px(int(cx + math.cos(a) * 8.5), int(15 + math.sin(a) * 8.5), R['tire'][1])
    cv.outline()
    return cv, cx


@vprop('wall_window', 'Window', 0.0, 0, ['indoor'])
def p_wall_window(rng):
    W, H = 52, 48; low = 44; cx = W // 2
    cv = Cv(W, H + low); cv.hang = 1
    cv.rect(2, 2, W - 3, H - 3, R['white'][3])
    for y in range(5, H - 7):
        for x in range(5, W - 5): cv.px(x, y, R['sky'][4] if y < 20 else R['sky'][3])
    for (x, y) in cv.ellpts(16, 16, 7, 3): cv.px(x, y, R['white'][4])
    for y in range(5, H - 7): cv.px(cx, y, R['white'][2]); cv.px(cx - 1, y, R['white'][3])
    for x in range(5, W - 5): cv.px(x, 22, R['white'][2])
    cv.rect(0, H - 7, W - 1, H - 4, R['white'][4])
    for (x, y) in cv.ellpts(12, H - 9, 4, 3): cv.px(x, y, R['leaf'][3])
    cv.rect(9, H - 8, 15, H - 7, R['terra'][2])
    cv.outline()
    cv.fx.append(('window', cx, 20))
    return cv, cx


@vprop('crate_goods', 'Crate of goods', 0.4, 0, ['indoor', 'town'], box=[0.9, 0.7])
def p_crate_goods(rng):
    W, H = 36, 36; G = H - 2; cx = 18
    cv = Cv(W, H)
    block(cv, cx - 15, cx + 15, G - 22, G, R['plank'], R['plank'], top=4)
    for y in (G - 12, G - 6):
        for x in range(cx - 15, cx + 16): cv.px(x, y, R['wood'][1])
    goods(cv, cx - 13, cx + 13, G - 30, G - 20, rng, ('coral', 'gold', 'leafy', 'orange'))
    cv.outline()
    return cv, cx
# ============================================================================= v27: MORE ANIMALS, FOOTPRINTS
# Frame strips for the walk scenes' animals (all facing
# left, like the duck; the game mirrors them), and the footprint sprite left in snow, sand, ash and mud.

P.update(bunny=(176, 146, 116), squir=(200, 108, 58), frog=(104, 176, 72), gull=(236, 238, 240), goat=(232, 226, 210), tabby=(232, 150, 72), crab=(222, 86, 60), lizard=(92, 170, 128))
for _k in ('bunny', 'squir', 'frog', 'gull', 'goat', 'tabby', 'crab', 'lizard'):
    R[_k] = ramp(P[_k])


def legs(cv, xs, G, top, Rl, w=1):
    for x in xs:
        for y in range(top, G + 1):
            for dx in range(w): cv.px(x + dx, y, Rl[1] if dx else Rl[2])


def life_rabbit(f):
    """0 sitting, 1 crouched to hop, 2 mid-hop, 3 nibbling"""
    W, H = 26, 24; cv = Cv(W, H); G = H - 2; Rb = R['bunny']
    lift = 4 if f == 2 else 0; stretch = 3 if f == 2 else 0; low = 2 if f in (1, 3) else 0
    ball(cv, 15 + stretch // 2, G - 6 - lift + low // 2, 7 + stretch, 6 - low // 2, Rb)
    ball(cv, 21 + stretch, G - 4 - lift, 3, 3, R['white'])                       # tail
    hx, hy = (7, G - 6) if f == 3 else (8 - stretch // 2, G - 11 - lift + low)
    ball(cv, hx, hy, 4, 4, Rb)
    for k, dx in enumerate((0, 3)):                                             # ears
        for y in range(hy - 11 + (3 if f == 2 else 0), hy - 2):
            cv.px(hx - 1 + dx, y, Rb[3 if k == 0 else 2]); cv.px(hx + dx, y, R['pink'][3] if y > hy - 9 else Rb[2])
    cv.px(hx - 2, hy - 1, OL); cv.px(hx - 4, hy + 1, R['pink'][2])
    if f != 2: legs(cv, (10, 18), G, G - 2, Rb, 2)
    else: cv.line(19, G - 4, 24, G - 1, Rb[1], 2); cv.line(10, G - 5, 6, G - 2, Rb[1], 2)
    cv.outline()
    return cv


def life_squirrel(f):
    """0 sitting up, tail curled, 1-2 running, 3 nibbling a nut"""
    W, H = 26, 24; cv = Cv(W, H); G = H - 2; Rs = R['squir']
    if f in (1, 2):
        ball(cv, 12, G - 5, 7, 4, Rs)
        for k in range(10):                                                      # bushy tail streaming back
            ball(cv, 19 + k * .5, G - 7 - k * .9 + (1 if f == 2 else 0), 3, 3, Rs, lo=1)
        ball(cv, 5, G - 7, 3, 3, Rs); cv.px(4, G - 8, OL); cv.px(5, G - 11, Rs[3])
        legs(cv, (8 + (f - 1) * 2, 15 - (f - 1) * 2), G, G - 2, Rs)
    else:
        ball(cv, 13, G - 7, 5, 6, Rs); ball(cv, 13, G - 5, 3, 3, R['cream'], lo=2)
        for k in range(12):
            a = k / 11 * math.pi * 1.1
            ball(cv, 19 + math.sin(a) * 4, G - 3 - k * 1.3, 3, 3, Rs, lo=1)
        hx, hy = 11, G - 14 + (2 if f == 3 else 0)
        ball(cv, hx, hy, 4, 3, Rs); cv.px(hx - 2, hy - 1, OL); cv.px(hx - 1, hy - 4, Rs[3]); cv.px(hx + 1, hy - 4, Rs[3])
        if f == 3: ball(cv, hx - 3, hy + 3, 2, 2, R['dwood'])
        legs(cv, (11, 15), G, G - 2, Rs)
    cv.outline()
    return cv


def life_frog(f):
    """0 sitting, 1 crouched, 2 leaping"""
    W, H = 22, 16; cv = Cv(W, H); G = H - 2; Rf = R['frog']
    if f == 2:
        ball(cv, 11, G - 7, 7, 3, Rf); cv.line(17, G - 7, 21, G - 2, Rf[1], 2); cv.line(5, G - 8, 1, G - 11, Rf[2])
        cv.px(6, G - 10, R['white'][4]); cv.px(6, G - 9, OL)
    else:
        lo = 1 if f == 1 else 0
        ball(cv, 11, G - 4 + lo, 7, 4 - lo, Rf); ball(cv, 11, G - 3 + lo, 4, 2, R['cream'], lo=2)
        for ex in (7, 12):
            ball(cv, ex, G - 8 + lo, 2, 2, Rf); cv.px(ex, G - 9 + lo, R['white'][4]); cv.px(ex, G - 8 + lo, OL)
        cv.rect(3, G - 1, 6, G, Rf[1]); cv.rect(16, G - 1, 19, G, Rf[1])
    cv.outline()
    return cv


def life_gull(f):
    """0 standing, 1 walking, 2 wings up, 3 wings down"""
    W, H = 32, 26; cv = Cv(W, H); G = H - 2; Rg = R['gull']; Rw = ramp((150, 156, 176))
    if f >= 2:
        ball(cv, 16, G - 12, 8, 3, Rg)
        up = f == 2
        for s in (-1, 1):
            tip = (16 + s * 15, G - (22 if up else 5))
            wing = [(16 + s * 1, G - 14), (16 + s * 8, G - (19 if up else 11)), tip, (16 + s * 10, G - (15 if up else 8)), (16 + s * 4, G - 10)]
            cv.poly(wing, lambda x, y: Rg[3] if abs(x - 16) < 9 else Rw[2])
            cv.px(tip[0], tip[1], R['tire'][1]); cv.px(tip[0] - s, tip[1] + (1 if up else -1), R['tire'][1])
        ball(cv, 8, G - 13, 3, 3, Rg); cv.px(7, G - 14, OL); cv.rect(3, G - 13, 5, G - 12, R['gold'][3])
    else:
        ball(cv, 16, G - 9, 8, 5, Rg); cv.poly([(14, G - 11), (26, G - 10), (29, G - 7), (18, G - 6)], Rw[2])
        ball(cv, 9, G - 15, 4, 4, Rg); cv.px(8, G - 16, OL); cv.rect(3, G - 15, 5, G - 14, R['gold'][3]); cv.px(3, G - 14, R['red'][2])
        st = f == 1
        for x in (14 + st * 2, 18 - st * 2):
            for y in range(G - 4, G + 1): cv.px(x, y, R['orange'][2])
    cv.outline()
    return cv


def life_goat(f):
    """0 standing, 1-2 walking, 3 grazing"""
    W, H = 42, 36; cv = Cv(W, H); G = H - 2; Rg = R['goat']
    ball(cv, 22, G - 14, 12, 7, Rg)
    hx, hy = (7, G - 6) if f == 3 else (8, G - 22)
    cv.line(13, G - 18, hx + 2, hy + 2, Rg[2], 4)
    ball(cv, hx, hy, 4, 4, Rg); cv.px(hx - 2, hy - 1, OL)
    cv.line(hx + 1, hy - 3, hx + 6, hy - 8, R['stone'][2], 2); cv.line(hx + 6, hy - 8, hx + 8, hy - 6, R['stone'][2], 2)   # horns
    for y in range(hy + 3, hy + 7): cv.px(hx - 1, y, Rg[1])                                                         # beard
    ball(cv, 34, G - 18, 2, 2, Rg)
    st = (f % 2) if f in (1, 2) else 0
    legs(cv, (14 + st * 2, 18, 27, 31 - st * 2), G, G - 8, ramp((150, 140, 128)), 2)
    for x in (14 + st * 2, 18, 27, 31 - st * 2): cv.px(x, G, R['tire'][1]); cv.px(x + 1, G, R['tire'][1])
    cv.outline()
    return cv


def life_cat(f):
    """0 sitting, 1-2 walking, 3 loafing"""
    W, H = 32, 26; cv = Cv(W, H); G = H - 2; Rc = R['tabby']
    if f == 3:
        ball(cv, 16, G - 4, 10, 4, Rc); ball(cv, 7, G - 6, 4, 4, Rc)
        for y in range(G - 2, G + 1): cv.px(26, y, Rc[2])
        eyes = (5, G - 7)
    elif f == 0:
        ball(cv, 15, G - 7, 6, 7, Rc); ball(cv, 13, G - 15, 5, 4, Rc)
        for k in range(8): cv.px(21 + k // 2, G - k, Rc[1]); cv.px(22 + k // 2, G - k, Rc[2])
        eyes = (11, G - 16)
        for dx in (0, 6): cv.poly([(9 + dx, G - 18), (11 + dx, G - 22), (13 + dx, G - 18)], Rc[3])
    else:
        ball(cv, 16, G - 8, 9, 4, Rc); ball(cv, 6, G - 12, 4, 4, Rc)
        for dx in (0, 4): cv.poly([(3 + dx, G - 15), (4 + dx, G - 18), (6 + dx, G - 15)], Rc[3])
        for k in range(8): cv.px(25 + k // 3, G - 9 - k, Rc[2])
        st = f - 1; legs(cv, (10 + st * 2, 13, 19, 22 - st * 2), G, G - 5, Rc)
        eyes = (5, G - 13)
    for k in range(3): cv.px(10 + k * 3 if f != 0 else 12 + k * 2, G - (6 if f != 0 else 9), Rc[1])          # stripes
    cv.px(eyes[0], eyes[1], R['mint'][3]); cv.px(eyes[0] + 2, eyes[1], R['mint'][3])
    cv.outline()
    return cv


def life_crab(f):
    """0 claws up, 1-2 scuttling"""
    W, H = 24, 16; cv = Cv(W, H); G = H - 2; Rc = R['crab']
    ball(cv, 12, G - 5, 7, 4, Rc)
    up = 2 if f == 0 else 0
    for s in (-1, 1):
        ball(cv, 12 + s * 9, G - 9 - up, 3, 2, Rc); cv.line(12 + s * 6, G - 6, 12 + s * 8, G - 8 - up, Rc[1])
        for k in range(3): cv.line(12 + s * (3 + k * 2), G - 3, 12 + s * (5 + k * 2) + (s if f == 2 else 0), G, Rc[1])
    for ex in (10, 14): cv.px(ex, G - 10, OL); cv.px(ex, G - 9, Rc[1])
    cv.outline()
    return cv


def life_lizard(f):
    """0 basking, 1-2 running"""
    W, H = 30, 12; cv = Cv(W, H); G = H - 2; Rl = R['lizard']
    ball(cv, 12, G - 3, 7, 2, Rl); ball(cv, 4, G - 4, 3, 2, Rl); cv.px(3, G - 5, OL)
    for k in range(10): cv.px(19 + k, G - 2 + (k // 4 if f != 2 else -(k // 5)), Rl[2])
    sp = 1 if f else 0
    for x, d in ((8, -1), (15, 1)):
        cv.px(x + d * sp, G, Rl[1]); cv.px(x + d * sp * 2, G - 1 if f == 2 else G, Rl[1])
    for k in range(3): cv.px(9 + k * 3, G - 4, R['gold'][3])
    cv.outline()
    return cv


LIFE['rabbit'] = ('Rabbit', [lambda i=i: life_rabbit(i) for i in range(4)], 1, 'meadow')
LIFE['squirrel'] = ('Squirrel', [lambda i=i: life_squirrel(i) for i in range(4)], 1, 'forest')
LIFE['frog'] = ('Frog', [lambda i=i: life_frog(i) for i in range(3)], 1, 'water')
LIFE['gull'] = ('Seagull', [lambda i=i: life_gull(i) for i in range(4)], 1, 'coast')
LIFE['goat'] = ('Mountain goat', [lambda i=i: life_goat(i) for i in range(4)], 1, 'mountains')
LIFE['cat'] = ('Cat', [lambda i=i: life_cat(i) for i in range(4)], 1, 'town')
LIFE['crab'] = ('Crab', [lambda i=i: life_crab(i) for i in range(3)], 1, 'coast')
LIFE['lizard'] = ('Lizard', [lambda i=i: life_lizard(i) for i in range(3)], 1, 'volcano')


def fx_print():
    """footprints seen from above: a shoe, and a small paw"""
    pal = {'d': a(R['white'][3]), 'm': a(R['white'][4])}
    return fx_grid([["..dd..",
                     ".dmmd.",
                     ".dmmd.",
                     ".dmmd.",
                     "..dd..",
                     ".dmmd.",
                     ".dmmd.",
                     "..dd.."],
                    ["......",
                     ".d..d.",
                     "......",
                     "..mm..",
                     ".dmmd.",
                     "..dd..",
                     "......",
                     "......"]], pal), 6, 8, 2


FX['print'] = fx_print
# ============================================================================= v28: A LADDER UP THE CLIFFS
# A wooden ladder leaning on a cliff face; the game scales
# it to the cliff's height and lets you climb it (tools/legacy/build-v28.py puts them in the scenes).

@vprop('ladder', 'Ladder', 0.2, 0, ['mountains', 'canyon'], solid=0)
def p_ladder(rng):
    W, H = 40, 112; G = H - 2; cx = 20
    cv = Cv(W, H); Rw = R['wood']
    for x0 in (cx - 14, cx + 10):
        for y in range(2, G + 1):
            for x in range(x0, x0 + 4): cv.px(x, y, Rw[xt(x, x0, x0 + 4)])
    for y in range(10, G - 2, 12):
        for x in range(cx - 10, cx + 10): cv.px(x, y, R['plank'][4]); cv.px(x, y + 1, R['plank'][2]); cv.px(x, y + 2, Rw[1])
    # rope lashings where the rungs meet the rails
    for y in range(10, G - 2, 12):
        for x0 in (cx - 11, cx + 9): cv.px(x0, y + 1, R['hay'][3]); cv.px(x0 + 1, y + 1, R['hay'][2])
    cv.outline()
    return cv, cx


def bounds(cv):
    xs, ys = [], []
    for y in range(cv.h):
        for x in range(cv.w):
            if cv.a[y * cv.w + x] is not None:
                xs.append(x); ys.append(y)
    return min(xs), max(xs), min(ys), max(ys)


# footprint / grouping for the props that predate vprop()
OLD_EXTRA = {
    'house': dict(group='house', box=[3.4, 2.2]), 'house_red': dict(group='house', box=[3.3, 2.2]),
    'shop': dict(box=[3.8, 2.4]), 'clinic': dict(box=[4.0, 2.6]), 'lab': dict(box=[6.0, 3.0]),
    'cave_house': dict(box=[4.0, 2.4]), 'windmill': dict(box=[1.6, 1.6]),
    'tent': dict(box=[3.2, 2.4]), 'stall': dict(box=[3.4, 1.4]), 'picnic': dict(box=[2.6, 1.2]),
    'hedge': dict(box=[3.4, 0.7]), 'log': dict(box=[2.1, 0.6]),
    'arch': dict(solid=0, posts=[{'x': -67, 'r': 0.4}, {'x': 66, 'r': 0.4}]),
    'tree_pine': dict(solid=0.4), 'tree_oak': dict(solid=0.45), 'tree_fruit': dict(solid=0.35), 'tree_birch': dict(solid=0.3),
    'bush_round': dict(solid=0.5), 'bush_berry': dict(solid=0.55), 'mushroom_giant': dict(solid=0.5),
    'flowers_red': dict(group='flowers'), 'flowers_blue': dict(group='flowers'), 'flowers_yellow': dict(group='flowers'),
    'stump': dict(solid=0.45), 'boulder': dict(solid=1.2), 'crystal': dict(solid=0.6), 'stalagmite': dict(solid=0.5),
    'well': dict(solid=0.85), 'crate': dict(solid=0.5), 'crates': dict(solid=0.8), 'haybale': dict(solid=0.6),
    'signpost': dict(solid=0.3), 'lantern': dict(solid=0.3), 'streetlamp': dict(solid=0.3), 'campfire': dict(solid=0.5),
    'coral': dict(solid=0.3), 'tires': dict(solid=0.55), 'scrap': dict(solid=1.4), 'statue': dict(solid=0.8),
}

BLADES = 'windmill_blades'


def render(key):
    P_ = PROPS[key]
    rng = random.Random(zlib.crc32(key.encode()))
    cv, bx = P_['fn'](rng)
    return cv, bx, finish(cv, bx, P_['flat'])


def save_png(img, path, overwrite):
    """never clobber an existing (possibly hand-edited) file unless asked; returns True if written"""
    if os.path.exists(path) and not overwrite:
        return False
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)
    return True


def write_json(path, d):
    with open(path, 'w') as f:
        f.write('{\n' + ',\n'.join('  ' + json.dumps(k) + ': ' + json.dumps(v, separators=(', ', ': ')) for k, v in d.items()) + '\n}\n')


def prop_meta(key, cv, bx, img):
    P_ = PROPS[key]
    w, h = img.size
    x0, x1, y0, y1 = bounds(cv)
    if getattr(cv, 'hang', 0): y1 = cv.h - 1
    flat = P_['flat']
    by = (y0 + y1 + 1) // 2 if flat else y1          # canvas row of the anchor point
    m = dict(name=P_['name'], w=w, h=h, ox=-(w // 2), oy=-(h // 2) if flat else -(h - 1),
             shadow=P_['shadow'], sway=P_['sway'], flat=flat, tags=P_['tags'])
    ex = dict(OLD_EXTRA.get(key, {}))
    if 'group' in P_:
        ex.update({k: P_[k] for k in ('group', 'solid', 'box', 'posts') if P_.get(k) is not None})
    m['group'] = ex.get('group', key)
    if ex.get('box'):
        m['box'] = ex['box']
    else:
        m['solid'] = ex.get('solid', 0)
    if ex.get('posts'):
        m['posts'] = ex['posts']
    if cv.door is not None:
        m['door'] = dict(x=int(cv.door) - bx, y=0)
    if getattr(cv, 'bld', None):
        b = dict(cv.bld); hx_ = lambda c: c if isinstance(c, str) else '#%02X%02X%02X' % tuple(c)
        b['wall'] = [b['wall'][0] - bx, b['wall'][1] - bx]
        for f in ('eave', 'apex'):
            if f in b: b[f] = b[f] - by
        for f in ('wallCol', 'roofCol', 'trimCol'):
            if f in b: b[f] = hx_(b[f])
        if 'chimney' in b: b['chimney'] = dict(b['chimney'], x=b['chimney']['x'] - bx, top=b['chimney']['top'] - by, col=hx_(b['chimney']['col']))
        m['bld'] = b
    if cv.fx:
        fx = []
        for (k, x, y) in cv.fx:
            x, y = int(round(x)), int(round(y))
            if k == 'smoke':                       # emit from the first clear pixel above the chimney top
                while cv.get(x, y) is not None: y -= 1
            fx.append(dict(k=k, x=x - bx, y=y - by))
        m['fx'] = fx
    return m


def build(keys=None, overwrite=False):
    """render every prop for metadata; write PNGs that are missing (or all of them with overwrite)"""
    os.makedirs(OUT, exist_ok=True)
    meta, written = {}, []
    for key in PROPS:
        cv, bx, img = render(key)
        path = os.path.join(OUT, key + '.png')
        if (not keys or key in keys) and save_png(img, path, overwrite):
            written.append(key)
        disk = Image.open(path) if os.path.exists(path) else img
        if disk.size != img.size:
            print('note: %s.png on disk is %dx%d, generator draws %dx%d; metadata uses the file' % ((key,) + disk.size + img.size))
            img = disk
        meta[key] = prop_meta(key, cv, bx, img)
        if key == 'windmill_tower':
            bl = windmill_draw(False, True)
            x0, x1, y0, y1 = bounds(bl)
            r = max(WM_CX - x0, x1 - WM_CX, WM_HY - y0, y1 - WM_HY) + 1
            bimg = Image.new('RGBA', (2 * r + 1, 2 * r + 1), (0, 0, 0, 0))
            for y in range(y0, y1 + 1):
                for x in range(x0, x1 + 1):
                    c = bl.a[y * bl.w + x]
                    if c is not None:
                        bimg.putpixel((x - WM_CX + r, y - WM_HY + r), c + (255,))
            if (not keys or BLADES in keys or key in keys) and save_png(bimg, os.path.join(OUT, BLADES + '.png'), overwrite):
                written.append(BLADES)
            _, _, _, ty1 = bounds(cv)
            meta[key]['blades'] = dict(img='scene/props/%s.png' % BLADES, x=0, y=WM_HY - ty1, w=2 * r + 1, h=2 * r + 1, px=r, py=r)
    # keep entries for keys this generator does not know about (hand-added props)
    if os.path.exists(META):
        try:
            old = json.load(open(META))
            for k, v in old.items():
                if k not in meta: meta[k] = v
        except ValueError:
            pass
    write_json(META, meta)
    # far layers
    fmeta = {}
    for key, F in FAR.items():
        cv = F['fn'](random.Random(zlib.crc32(('far_' + key).encode())))
        img = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
        for i, c in enumerate(cv.a):
            if c is not None: img.putpixel((i % FW, i // FW), c + (255,))
        if (not keys or key in keys) and save_png(img, os.path.join(FAR_DIR, key + '.png'), overwrite):
            written.append('far/' + key)
        fmeta[key] = dict(name=F['name'], w=FW, h=FH)
    write_json(FAR_META, fmeta)
    # fx sprites
    xmeta = {}
    for key, fn in FX.items():
        img, w, h, n = fn()
        if (not keys or key in keys) and save_png(img, os.path.join(FX_DIR, key + '.png'), overwrite):
            written.append('fx/' + key)
        xmeta[key] = dict(w=w, h=h, frames=n)
    write_json(FX_META, xmeta)
    build_life(keys, overwrite, written)
    return written, meta


def sheet(imgs, path, scale=2, maxw=1800):
    pad = 10
    rows = []; row = []; rw = 0
    for k, im in imgs.items():
        w = im.width * scale + pad
        if row and rw + w > maxw:
            rows.append(row); row = []; rw = 0
        row.append(k); rw += w
    if row: rows.append(row)
    H = sum(max(imgs[k].height for k in r) * scale + pad * 2 for r in rows) + pad
    out = Image.new('RGBA', (maxw + pad, H), (150, 202, 140, 255))
    y = pad
    for r in rows:
        rh = max(imgs[k].height for k in r) * scale
        x = pad
        for k in r:
            im = imgs[k].resize((imgs[k].width * scale, imgs[k].height * scale), Image.NEAREST)
            # ground tick
            for gx in range(x, x + im.width):
                out.putpixel((gx, y + rh + 1), (120, 170, 110, 255))
            out.alpha_composite(im, (x, y + rh - im.height))
            x += im.width + pad
        y += rh + pad * 2
    out.save(path)


def far_sheet(path, scale=2, extra=160):
    """each strip over a sky gradient, with `extra` px of wrap so the seam is visible; fx sprites below"""
    pad = 8
    keys = list(FAR)
    W = (FW + extra) * scale + pad * 2
    H = len(keys) * (FH * scale + pad) + pad + 140
    out = Image.new('RGBA', (W, H), (40, 40, 52, 255))
    y = pad
    for k in keys:
        im = Image.open(os.path.join(FAR_DIR, k + '.png')).convert('RGBA')
        strip = Image.new('RGBA', (FW + extra, FH))
        dark = k in ('cave', 'mall')
        for yy in range(FH):
            c = mix((22, 18, 40), (54, 46, 84), yy / FH) if dark else mix((150, 196, 236), (226, 236, 246), yy / FH)
            for xx in range(FW + extra): strip.putpixel((xx, yy), c + (255,))
        strip.alpha_composite(im, (0, 0)); strip.alpha_composite(im.crop((0, 0, extra, FH)), (FW, 0))
        out.alpha_composite(strip.resize(((FW + extra) * scale, FH * scale), Image.NEAREST), (pad, y))
        for yy in range(y, y + FH * scale, 4): out.putpixel((pad + FW * scale, yy), (255, 60, 60, 255))
        y += FH * scale + pad
    x = pad
    for k in FX:
        im = Image.open(os.path.join(FX_DIR, k + '.png')).convert('RGBA')
        s = 8
        bg = Image.new('RGBA', (im.width * s + 8, im.height * s + 8), (116, 168, 108, 255))
        bg.alpha_composite(im.resize((im.width * s, im.height * s), Image.NEAREST), (4, 4))
        out.alpha_composite(bg, (x, y))
        x += bg.width + 16
    out.save(path)


if __name__ == '__main__':
    args = sys.argv[1:]
    sp = fsp = None
    if '--sheet' in args:
        i = args.index('--sheet'); sp = args[i + 1]; del args[i:i + 2]
    if '--far-sheet' in args:
        i = args.index('--far-sheet'); fsp = args[i + 1]; del args[i:i + 2]
    overwrite = '--all' in args
    args = [a_ for a_ in args if a_ != '--all']
    written, meta = build(args or None, overwrite)
    if sp:
        imgs = {k: Image.open(os.path.join(OUT, k + '.png')).convert('RGBA') for k in meta if os.path.exists(os.path.join(OUT, k + '.png'))}
        imgs[BLADES] = Image.open(os.path.join(OUT, BLADES + '.png')).convert('RGBA')
        sheet(imgs, sp)
    if fsp:
        far_sheet(fsp)
    print('wrote %d files (%s); metadata for %d props, %d far layers, %d fx sprites' %
          (len(written), ', '.join(written) or 'none - existing PNGs kept, use --all to redraw', len(meta), len(FAR), len(FX)))
