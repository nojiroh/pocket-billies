#!/usr/bin/env python3
"""v47 part 3: a landmark for every place whose lore names one that wasn't there yet, drawn with the scene-prop kit in
the style of the painted props (dark coloured outlines, lit from the top left), at the props' 34 pixels to the metre:

  clock_tower        Sundown's square. Its hands are pictures of their own (clock_tower_hm / _hh) that the game turns
                     to the time on the surface: the device's own clock ("nobody knows why it is always right")
  tree_giant         the giant tree on the rise in the Long Grass, older than the sinkholes (with leaf layers)
  tree_willow_lean   the willow at Willow Pond that leans so far it drinks from the pond (with leaf layers)
  crane              the Scrap Yard's crane, a magnet and a flattened car on its hook. It stands one way on some days
                     and the other way on the rest: it moves when nobody is watching
  neon_sign          the Food Court's neon sign, missing one letter since the day it opened (its tubes glow at night)
  lookout_tower      the lookout tower on Lookout Ridge
  shipwreck          the wreck on the Offshore's north sandbar
  waystone           the waystone at the top of Bull Run Pass
  golden_cushion     the golden cushion on the peak above Summit Capital
  lighthouse_small   the little lighthouse at the end of Liquidity Lake's pier
  bridge_broken      the broken rope bridge across Stairstep Canyon (CLOSED; everyone uses it anyway)

Pictures that exist are kept (yours); --force draws them again. Catalogue and props.json entries are added when
missing; each carries "landmark": 1, and the camera tilts up a little as you walk toward a landmark (the lighthouse
and the windmill get the mark too). Placing them: every landmark this tool puts down carries "v47mark": 1, so running it again first takes the
previous run's away; a place marked "keep" in the Studio is left alone.

    python3 tools/build-landmarks-v47.py                     # draw what's missing, add to the catalogue, place them
    python3 tools/build-landmarks-v47.py --preview out.png   # a sheet of the pictures, writes nothing in the game
    python3 tools/build-landmarks-v47.py --force             # draw them all again
    python3 tools/build-landmarks-v47.py --no-place          # pictures and catalogue only
"""
import gamedata  # phase 04b: the data files in game/data
import os, sys, json, math, random, importlib.util
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
spec = importlib.util.spec_from_file_location('bsp', os.path.join(HERE, 'build-scene-props.py')); bsp = importlib.util.module_from_spec(spec); spec.loader.exec_module(bsp)
g = vars(bsp)
Cv, R, P, ramp, xt, olc, mix, dk, sph = bsp.Cv, bsp.R, bsp.P, bsp.ramp, bsp.xt, bsp.olc, bsp.mix, bsp.dk, bsp.sph
door, window, stone_band, tile_roof, blob, trunk, pip = g['door'], g['window'], g['stone_band'], g['tile_roof'], g['blob'], g['trunk'], g['pip']
quoins, cornice, snow_cap = g['quoins'], g['cornice'], g['snow_cap']
OUT, META = bsp.OUT, bsp.META
LAYERS = os.path.join(ROOT, 'game', 'art', 'scene', 'props', 'layers')
DATA = os.path.join(ROOT, 'game', 'data', 'gamedata.js')
PPU = 34
TAG = 'v47mark'
R.update({k: ramp(v) for k, v in dict(
    slate=(96, 100, 128), crane=(240, 186, 46), steel=(150, 160, 174), navy=(44, 48, 82), neon=(255, 92, 186), neonb=(84, 232, 244),
    driftwood=(160, 140, 118), wreck=(122, 98, 80), sand=(230, 206, 156), granite=(150, 146, 154), lichen=(178, 190, 92),
    velvet=(176, 36, 58), satin=(250, 200, 70), carteal=(98, 160, 156), seaweed=(96, 120, 70)).items() if k not in R})
NEW = {}


def lprop(key, name, shadow, tags, solid=0, box=None, posts=None, sway=0, flat=0, landmark=True):
    def deco(fn):
        d = dict(fn=fn, name=name, shadow=shadow, sway=sway, tags=tags, flat=flat, group=key, solid=solid, box=box, posts=posts, landmark=landmark)
        NEW[key] = d; bsp.PROPS[key] = d
        return fn
    return deco


# ----------------------------------------------------------------------------- small helpers
def bricks(cv, x0, y0, x1, y1, Rb, rng, bw=8, bh=4):
    """a brick face lit from the left: bricks a tone apart here and there, pale mortar"""
    Rm = R['stone']; tone = {}
    for y in range(y0, y1 + 1):
        r = (y - y0) // bh; ry = (y - y0) % bh
        for x in range(x0, x1 + 1):
            c = (x - x0 + (bw // 2) * (r % 2)) % bw; t = xt(x, x0, x1 + 1)
            if ry == bh - 1 or c == 0: cv.px(x, y, Rm[3 if t >= 2 else 2 if t == 1 else 1]); continue
            k = (r, (x - x0 + (bw // 2) * (r % 2)) // bw)
            if k not in tone: tone[k] = rng.choice((0, 0, 0, 1, -1))
            tt = max(1, min(3, t + tone[k]))
            if ry == 0 and tt < 3: tt += 1
            cv.px(x, y, Rb[tt])


def limb(pts, wid):
    """a polygon round a centre line (points top to bottom or along a branch) with a width at each point"""
    L, Rr = [], []
    for i, (x, y) in enumerate(pts):
        a = pts[max(0, i - 1)]; b = pts[min(len(pts) - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]; n = math.hypot(dx, dy) or 1
        nx, ny = -dy / n, dx / n; w = wid[i] / 2
        L.append((x + nx * w, y + ny * w)); Rr.append((x - nx * w, y - ny * w))
    return L + Rr[::-1]


def tube_font():
    """5 x 7 capitals for the neon sign"""
    F = {'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
         'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
         'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
         'C': ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
         'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
         'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
         'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
         'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
         'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
         'I': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
         'N': ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
         'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
         'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
         'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
         '.': ['.....', '.....', '.....', '..#..', '.....', '.....', '.....'],
         ' ': ['.....'] * 7}
    return F


def small_font():
    """3 x 5 capitals for the sign's second line"""
    return {'E': ['###', '#..', '##.', '#..', '###'], 'A': ['.#.', '#.#', '###', '#.#', '#.#'], 'T': ['###', '.#.', '.#.', '.#.', '.#.'],
            'D': ['##.', '#.#', '#.#', '#.#', '##.'], 'R': ['##.', '#.#', '##.', '#.#', '#.#'], 'I': ['###', '.#.', '.#.', '.#.', '###'],
            'N': ['#..#', '##.#', '#.##', '#..#', '#..#'], 'K': ['#.#', '#.#', '##.', '#.#', '#.#'], 'S': ['.##', '#..', '.#.', '..#', '##.'],
            'P': ['##.', '#.#', '##.', '#..', '#..'], '.': ['...', '...', '...', '...', '.#.'], ' ': ['...'] * 5}


# ----------------------------------------------------------------------------- Sundown: the clock tower
CLOCK = {}


@lprop('clock_tower', 'Clock tower', 1.8, ['town'], solid=1.25)
def p_clock_tower(rng):
    W, H = 124, 340; G = H - 2; cx = 62
    cv = Cv(W, H)
    yP, yS = G - 17, G - 150
    # the plinth
    stone_band(cv, cx - 44, cx + 43, yP, G, R['stone'], bw=12, bh=6)
    cv.rect(cx - 45, yP - 2, cx + 44, yP, lambda x, y: R['stone'][4 if y == yP - 2 else 3 if x < cx + 30 else 2])
    # the shaft: brick with stone corners
    x0, x1 = cx - 35, cx + 34
    bricks(cv, x0, yS, x1, yP - 3, R['brick'], rng)
    quoins(cv, x0, x1, yS, yP - 3, R['stone'], w=8, h=9)
    # a string course half way up, a slit window above it and the door
    cv.rect(x0 - 2, G - 96, x1 + 2, G - 92, lambda x, y: R['stone'][4 if y == G - 96 else 3 if x < cx + 20 else 2 if y < G - 93 else 1])
    for wy, wh in ((G - 132, 26),):
        for y in range(wy, wy + wh):
            for x in range(cx - 5, cx + 5):
                top = y < wy + 5 and ((x + .5 - cx) / 5) ** 2 + ((y + .5 - (wy + 5)) / 5) ** 2 > 1
                if not top: cv.px(x, y, R['iron'][0] if x > cx - 3 or y > wy + 8 else R['iron'][1])
        for x in range(cx - 7, cx + 7): cv.px(x, wy + wh, R['stone'][3 if x < cx + 3 else 2])
    cv.fx.append(('window', cx, G - 117))
    door(cv, cx, yP - 3, 22, 40, Rw=R['dwood'], arch=True, glass=False)
    for x in range(cx - 14, cx + 14): cv.px(x, yP - 46, R['stone'][3])     # the keystone lintel
    cv.rect(cx - 3, yP - 49, cx + 2, yP - 45, lambda x, y: R['stone'][4 if x < cx else 2])
    # the cornice under the clock stage
    cornice(cv, x0, x1, yS - 6, 6, R['stone'], over=4)
    # the clock stage: pale stone, wider, a face on its front
    c0, c1, yC0 = cx - 39, cx + 38, yS - 6 - 64
    for y in range(yC0, yS - 6):
        for x in range(c0, c1 + 1): cv.px(x, y, R['marble'][xt(x, c0, c1 + 1, (.18, .6, .9))])
    quoins(cv, c0, c1, yC0, yS - 6, R['stone'], w=7, h=8)
    fy = (yC0 + yS - 6) // 2; fr = 21
    CLOCK.update(y=fy, r=fr)
    for (x, y) in cv.ellpts(cx, fy, fr + 3, fr + 3): cv.px(x, y, R['gold'][3 if x + y < cx + fy - 6 else 2 if x + y < cx + fy + 8 else 1])
    for (x, y) in cv.ellpts(cx, fy, fr + 1, fr + 1): cv.px(x, y, R['iron'][1])
    for (x, y) in cv.ellpts(cx, fy, fr - 1, fr - 1):
        d = math.hypot(x + .5 - cx, y + .5 - fy) / fr; t = 4 if d < .55 else 3
        if (x + .5 - cx) + (y + .5 - fy) > fr * .9: t = 2
        cv.px(x, y, R['cream'][t])
    for h in range(12):
        a = h / 12 * math.tau; L = 4 if h % 3 == 0 else 2
        for k in range(L):
            rr = fr - 3 - k; x = cx + math.sin(a) * rr; y = fy - math.cos(a) * rr
            cv.px(int(math.floor(x)), int(math.floor(y)), R['iron'][0])
            if h % 3 == 0: cv.px(int(math.floor(x + math.cos(a) * .9)), int(math.floor(y + math.sin(a) * .9)), R['iron'][0])
    cv.rect(cx - 1, fy - 1, cx, fy, R['gold'][1])
    cv.fx.append(('glow', cx, fy))
    # a second cornice, the belfry (open arch, a bell) and the roof
    cornice(cv, c0, c1, yC0 - 6, 6, R['stone'], over=4)
    yB0 = yC0 - 6 - 40
    bricks(cv, x0, yB0, x1, yC0 - 7, R['brick'], rng)
    quoins(cv, x0, x1, yB0, yC0 - 7, R['stone'], w=7, h=8)
    ax0, ax1, aT, aB = cx - 20, cx + 19, yB0 + 6, yC0 - 8
    for y in range(aT, aB + 1):
        for x in range(ax0, ax1 + 1):
            if y < aT + 20 and ((x + .5 - cx) / 20) ** 2 + ((y + .5 - (aT + 20)) / 20) ** 2 > 1: continue
            cv.px(x, y, R['navy'][0] if x > cx - 12 else R['navy'][1])
    for (x, y) in cv.ellpts(cx, aT + 20, 21.5, 21.5):
        if y < aT + 20 and cv.get(x, y) not in (R['navy'][0], R['navy'][1]): cv.px(x, y, R['stone'][3 if x < cx else 2])
    bx, by = cx, aT + 17
    for y in range(by, by + 15):
        hw = 4 + (y - by) * .45
        for x in range(int(bx - hw), int(bx + hw) + 1): cv.px(x, y, R['gold'][3 if x < bx - hw * .3 else 2 if x < bx + hw * .4 else 1])
    cv.rect(bx - 1, by - 4, bx, by - 1, R['iron'][1]); cv.rect(bx - 1, by + 15, bx, by + 17, R['gold'][0])
    cv.rect(ax0 - 2, aB + 1, ax1 + 2, aB + 3, lambda x, y: R['stone'][3 if y == aB + 1 else 1])
    yR = yB0 - 1
    tile_roof(cv, yR - 50, yR, cx - 2, cx + 1, cx - 46, cx + 45, R['slate'], tw=7, th=5)
    cv.rect(cx - 1, yR - 64, cx, yR - 50, R['iron'][2])
    cv.rect(cx - 6, yR - 61, cx + 6, yR - 60, R['gold'][2]); cv.rect(cx + 4, yR - 63, cx + 6, yR - 58, R['gold'][3])
    cv.rect(cx - 2, yR - 67, cx + 1, yR - 65, R['gold'][3])
    cv.outline()
    return cv, cx


def hand_img(length, width, tip, col, cap=False):
    """a clock hand pointing up from the middle of a square picture (the game turns it about the middle)"""
    r = 16; im = Image.new('RGBA', (2 * r + 1, 2 * r + 1), (0, 0, 0, 0)); px = im.load()
    for y in range(r - length, r + 3):
        L = r - y; w = width if L < length - tip else max(1, int(width * (length - L) / tip + .5))
        for x in range(r - w // 2, r - w // 2 + w): px[x, y] = col + (255,)
    if cap:
        for (x, y) in ((r - 1, r - 1), (r, r - 1), (r + 1, r - 1), (r - 1, r), (r + 1, r), (r - 1, r + 1), (r, r + 1), (r + 1, r + 1)): px[x, y] = R['gold'][1] + (255,)
        px[r, r] = R['gold'][3] + (255,)
    return im


# ----------------------------------------------------------------------------- the Long Grass: the giant tree
GIANT_PAL = None          # (back, front) leaf ramps; tools/build-region-props-v47.py draws it in autumn with this
@lprop('tree_giant', 'Giant tree', 4.2, ['route'], solid=1.0, sway=.18)
def p_tree_giant(rng):
    W, H = 380, 402; G = H - 2; cx = 190
    cv = Cv(W, H); tr = Cv(W, H)
    # the trunk: a broad bole on spreading roots, three great limbs into the crown
    body = [(cx - 50, G + 1), (cx - 34, G - 8), (cx - 25, G - 30), (cx - 22, G - 90), (cx - 28, G - 140), (cx - 70, G - 196), (cx - 58, G - 204),
            (cx - 14, G - 160), (cx - 8, G - 214), (cx + 10, G - 216), (cx + 12, G - 160), (cx + 58, G - 206), (cx + 70, G - 198),
            (cx + 26, G - 138), (cx + 21, G - 88), (cx + 24, G - 30), (cx + 34, G - 8), (cx + 52, G + 1)]
    trunk(tr, body, R['bark'], rng)
    for root in ([(cx - 74, G + 1), (cx - 52, G - 7), (cx - 34, G - 10), (cx - 38, G + 1)], [(cx + 36, G + 1), (cx + 38, G - 9), (cx + 56, G - 6), (cx + 80, G + 1)],
                 [(cx - 14, G + 1), (cx - 8, G - 6), (cx + 4, G - 6), (cx + 10, G + 1)]):
        trunk(tr, root, R['bark'], rng, streaks=False)
    # a knothole and moss on the shaded roots
    for (x, y) in tr.ellpts(cx + 6, G - 96, 5, 7): tr.px(x, y, R['bark'][0] if y > G - 101 else R['navy'][0])
    for (x, y) in tr.ellpts(cx + 6, G - 96, 6.5, 8.5):
        if tr.get(x, y) in R['bark'][1:] and y < G - 98: tr.px(x, y, R['bark'][3])
    for _ in range(140):
        x = rng.randint(cx - 72, cx + 78); y = rng.randint(G - 26, G)
        if tr.get(x, y) in R['bark'] and (x < cx - 20 or x > cx + 18 or y > G - 8): tr.px(x, y, R['moss'][rng.choice((1, 2, 2, 3))])
    tr.outline(); cv.paste(tr)
    fol = Cv(W, H)
    deep, mid = GIANT_PAL or (ramp((64, 132, 72)), R['oak'])
    blobs = [(cx, G - 352, 64, 40, .06, deep), (cx - 62, G - 330, 72, 48, .05, deep), (cx + 58, G - 334, 72, 48, .02, deep),
             (cx, G - 292, 112, 66, 0, mid), (cx - 132, G - 288, 44, 38, .05, mid), (cx + 134, G - 292, 44, 38, -.03, mid),
             (cx - 100, G - 250, 72, 50, .02, mid), (cx + 100, G - 252, 72, 50, -.04, mid), (cx - 150, G - 226, 36, 30, .03, mid),
             (cx + 152, G - 228, 36, 30, -.06, mid), (cx - 56, G - 218, 62, 36, -.03, mid), (cx + 54, G - 216, 62, 36, -.06, mid),
             (cx, G - 244, 70, 40, .03, mid)]
    for (bx, by, rx, ry, b, Rl) in blobs: blob(fol, bx, by, rx, ry, Rl, rng, cell=9, bias=b, bump=.05)
    fol.outline(); cv.paste(fol)
    return cv, cx


# ----------------------------------------------------------------------------- Willow Pond: the leaning willow
@lprop('tree_willow_lean', 'Leaning willow', 1.6, ['route', 'water'], solid=.45, sway=.45)
def p_tree_willow_lean(rng):
    W, H = 320, 190; G = H - 2; cx = 70
    cv = Cv(W, H); tr = Cv(W, H)
    stem = [(cx + 1, G + 1), (cx + 5, G - 24), (cx + 18, G - 54), (cx + 42, G - 82), (cx + 74, G - 104), (cx + 104, G - 116), (cx + 128, G - 120)]
    trunk(tr, limb(stem, [26, 22, 19, 16, 13, 10, 7]), R['bark'], rng)
    trunk(tr, limb([(cx + 40, G - 80), (cx + 50, G - 104), (cx + 58, G - 128)], [11, 8, 5]), R['bark'], rng)
    trunk(tr, limb([(cx + 92, G - 112), (cx + 116, G - 134), (cx + 142, G - 142)], [8, 6, 4]), R['bark'], rng)
    for root in ([(cx - 24, G + 1), (cx - 12, G - 6), (cx - 2, G - 5), (cx - 4, G + 1)], [(cx + 8, G + 1), (cx + 12, G - 7), (cx + 26, G - 4), (cx + 34, G + 1)]):
        trunk(tr, root, R['bark'], rng, streaks=False)
    tr.outline(); cv.paste(tr)
    fol = Cv(W, H)
    for (bx, by, rx, ry, b) in ((cx + 56, G - 128, 34, 22, .05), (cx + 168, G - 130, 40, 22, -.04), (cx + 112, G - 148, 52, 26, .07),
                                (cx + 76, G - 150, 34, 20, .06), (cx + 146, G - 152, 36, 20, .02)):
        blob(fol, bx, by, rx, ry, R['leafy'], rng, cell=7, bias=b)
    # the strands hang straight down, the longest ones nearly into the water
    for k in range(44):
        x0 = cx + 22 + k * 4.0 + rng.uniform(-1, 1); mid = cx + 110
        y0 = G - 136 + abs(x0 - mid) * .28 + rng.randint(-4, 4)
        L = rng.randint(60, 104) - int(abs(x0 - mid) * .22)
        for j in range(L):
            x = int(x0 + math.sin(j / 9 + k) * 1.5); y = int(y0 + j)
            if y > G - 3 or (x < cx + 30 and y > G - 40): break
            fol.px(x, y, R['leafy'][3 if j % 5 == 0 else 2 if x < mid else 1])
            if j % 3 == 0: fol.px(x + 1, y, R['leafy'][1])
    fol.outline(); cv.paste(fol)
    return cv, cx


# ----------------------------------------------------------------------------- the Scrap Yard: the crane
@lprop('crane', 'Scrap yard crane', 2.2, ['route'], solid=1.9)
def p_crane(rng):
    W, H = 560, 420; G = H - 2; cx = 160
    cv = Cv(W, H)
    Ry, Rr, Rt = R['crane'], R['rust'], R['tire']
    # the boom first (it goes behind the cab): two chords and a zigzag of struts up to the sheave
    px0, py0 = cx + 18, G - 84; tx, ty = cx + 236, G - 392
    bl = Cv(W, H); n = math.hypot(tx - px0, ty - py0); ux, uy = (tx - px0) / n, (ty - py0) / n; nx, ny = -uy, ux
    def at(t, s): w = 15 * (1 - t) + 7 * t; return (px0 + ux * n * t + nx * w * s, py0 + uy * n * t + ny * w * s)
    for s, tone in ((-1, 3), (1, 1)):
        a, b = at(0, s), at(1, s); bl.line(a[0], a[1], b[0], b[1], Ry[tone], 3)
    segs = 14
    for i in range(segs):
        a = at(i / segs, -1 if i % 2 == 0 else 1); b = at((i + 1) / segs, 1 if i % 2 == 0 else -1); bl.line(a[0], a[1], b[0], b[1], Ry[2], 2)
    for (x, y) in bl.ellpts(tx, ty, 8, 8): bl.px(x, y, R['iron'][2 if x < tx else 1])
    bl.rect(tx - 1, ty - 1, tx, ty, R['iron'][4])
    # rust on the boom
    for _ in range(60):
        t = rng.random(); s = rng.choice((-1, 1)); x, y = at(t, s)
        if bl.get(int(x), int(y)) is not None: bl.px(int(x), int(y), Rr[rng.choice((1, 2))])
    bl.outline(); cv.paste(bl)
    # the backstay: cables from the top of the cab frame to the boom tip
    stay = Cv(W, H); ax, ay = cx - 30, G - 150
    stay.line(ax, ay, tx - 4, ty + 4, R['iron'][0], 1); stay.line(ax, ay, at(.5, -1)[0], at(.5, -1)[1], R['iron'][0], 1); cv.paste(stay)
    # the cable down to the magnet, the magnet, and a flattened car under it
    mx, my = tx, G - 170
    cv.rect(mx, ty + 8, mx, my - 18, R['iron'][0])
    for dx in (-20, 0, 20): cv.line(mx, my - 18, mx + dx, my - 5, R['iron'][1], 1)
    mag = Cv(W, H); mr = 32
    for y in range(my - 6, my + 14):
        for x in range(mx - mr, mx + mr):
            e = ((x + .5 - mx) / mr) ** 2
            if y < my - 1 and e > 1 - (my - 1 - y) * .2: continue
            t = 3 if x < mx - 18 else 2 if x < mx + 12 else 1
            if y >= my + 8: t = max(0, t - 1)
            if y == my - 1: t = min(4, t + 1)
            mag.px(x, y, R['iron'][t])
    for x in range(mx - mr, mx + mr):
        if (x // 6) % 2 == 0: mag.px(x, my + 5, R['yellow'][2]); mag.px(x, my + 6, R['yellow'][1])
        else: mag.px(x, my + 5, R['iron'][0]); mag.px(x, my + 6, R['iron'][0])
    mag.rect(mx - 4, my - 10, mx + 3, my - 6, lambda x, y: R['iron'][3 if x < mx else 1])
    mag.outline(); cv.paste(mag)
    # an old car, flattened, held up by its roof
    car = Cv(W, H); Rc = R['carteal']; c0, c1, cy0 = mx - 64, mx + 62, my + 15
    shape = [(c0, cy0 + 30), (c0 + 3, cy0 + 16), (c0 + 28, cy0 + 12), (c0 + 44, cy0 + 1), (c0 + 88, cy0 + 2), (c0 + 102, cy0 + 13), (c1, cy0 + 16), (c1 + 1, cy0 + 30)]
    for (x, y) in car.polypts(shape):
        t = 3 if y < cy0 + 6 else 2 if y < cy0 + 21 else 1
        if x > c1 - 16: t = max(0, t - 1)
        car.px(x, y, Rc[t])
    for (x, y) in car.polypts([(c0 + 36, cy0 + 12), (c0 + 47, cy0 + 4), (c0 + 64, cy0 + 4), (c0 + 64, cy0 + 12)]): car.px(x, y, R['glass'][1 if (x + y) % 6 else 3])
    for (x, y) in car.polypts([(c0 + 68, cy0 + 12), (c0 + 68, cy0 + 4), (c0 + 86, cy0 + 4), (c0 + 97, cy0 + 12)]): car.px(x, y, R['iron'][0])
    for x in range(c0 + 2, c1): car.px(x, cy0 + 21, Rc[0])
    for y in range(cy0 + 13, cy0 + 28): car.px(c0 + 66, y, Rc[0])
    car.rect(c0 + 54, cy0 + 16, c0 + 58, cy0 + 17, R['steel'][3])
    for wx in (c0 + 24, c1 - 24):
        for (x, y) in car.ellpts(wx, cy0 + 30, 10, 7):
            if y <= cy0 + 35: car.px(x, y, Rt[1 if x < wx else 0])
        for (x, y) in car.ellpts(wx, cy0 + 30, 3.5, 3): car.px(x, y, R['steel'][3 if x < wx else 2])
    for _ in range(120):
        x = rng.randint(c0, c1); y = rng.randint(cy0 + 2, cy0 + 30)
        if car.get(x, y) in Rc:
            for k in range(rng.randint(1, 3)):
                if car.get(x, y + k) in Rc: car.px(x, y + k, Rr[rng.choice((1, 2, 3))])
    for (dx, dy) in ((c0 + 18, cy0 + 18), (c0 + 80, cy0 + 24)):                 # dents
        for (x, y) in car.ellpts(dx, dy, 5, 3): car.px(x, y, Rc[1] if y < dy else Rc[3])
    car.rect(c0 + 1, cy0 + 18, c0 + 3, cy0 + 20, R['gold'][4]); car.rect(c1 - 2, cy0 + 18, c1, cy0 + 20, R['red'][2])
    car.outline(); cv.paste(car)
    # tracks
    trk = Cv(W, H); t0, t1 = cx - 68, cx + 66
    for y in range(G - 28, G + 1):
        for x in range(t0, t1 + 1):
            e = 14
            if x < t0 + e and ((x + .5 - (t0 + e)) / e) ** 2 + ((y + .5 - (G - 14)) / 14.5) ** 2 > 1: continue
            if x > t1 - e and ((x + .5 - (t1 - e)) / e) ** 2 + ((y + .5 - (G - 14)) / 14.5) ** 2 > 1: continue
            t = 1 if (x // 6) % 2 else 0
            if y < G - 25: t = 2 if (x // 6) % 2 else 1
            trk.px(x, y, Rt[t])
    for wx in range(t0 + 14, t1 - 10, 24):
        for (x, y) in trk.ellpts(wx, G - 13, 9, 9): trk.px(x, y, R['steel'][2 if x < wx else 1])
        for (x, y) in trk.ellpts(wx, G - 13, 3, 3): trk.px(x, y, Ry[2])
    trk.outline(); cv.paste(trk)
    # the turntable and the body: counterweight (hazard stripes) at the back, the engine house, the cab at the front
    cv.rect(cx - 40, G - 36, cx + 38, G - 29, lambda x, y: R['iron'][2 if x < cx else 1])
    bd = Cv(W, H); b0, b1, bT, bB = cx - 64, cx + 20, G - 112, G - 37
    for y in range(bT, bB + 1):
        for x in range(b0, b1 + 1): bd.px(x, y, Ry[xt(x, b0, b1 + 1)])
    for y in range(bB - 22, bB + 1):
        for x in range(b0, b0 + 30):
            s = ((x - y) // 6) % 2; bd.px(x, y, (Ry[3] if x < b0 + 10 else Ry[2]) if s else R['iron'][1 if x < b0 + 10 else 0])
    for y in range(bT + 10, bT + 40, 5):
        for x in range(b0 + 34, b1 - 6): bd.px(x, y, Ry[1])
    for x in range(b0, b1 + 1): bd.px(x, bT, Ry[4]); bd.px(x, bT + 1, Ry[3])
    cab = (cx + 18, cx + 56, G - 120, G - 37)
    for y in range(cab[2], cab[3] + 1):
        for x in range(cab[0], cab[1] + 1):
            if y < cab[2] + 10 and x > cab[1] - (cab[2] + 10 - y) * 1.4: continue
            bd.px(x, y, Ry[xt(x, cab[0], cab[1] + 1)])
    for (x, y) in bd.polypts([(cab[0] + 5, cab[2] + 6), (cab[1] - 12, cab[2] + 6), (cab[1] - 4, cab[2] + 16), (cab[1] - 4, cab[2] + 40), (cab[0] + 5, cab[2] + 40)]):
        bd.px(x, y, R['glass'][4 if (x - y) % 11 in (0, 1) else 2 if x < cab[1] - 14 else 1])
    for y in range(cab[2] + 6, cab[2] + 41): bd.px(cab[0] + 18, y, Ry[1])
    bd.rect(cab[0] + 4, cab[2] + 46, cab[0] + 16, cab[3] - 4, lambda x, y: Ry[1 if x > cab[0] + 14 else 2])
    bd.rect(b0 + 46, bT - 22, b0 + 51, bT, lambda x, y: R['iron'][3 if x < b0 + 48 else 1])
    bd.rect(b0 + 45, bT - 24, b0 + 52, bT - 22, R['iron'][0])
    for _ in range(60):
        x = rng.randint(b0, cab[1]); y = rng.randint(bT, bB)
        c = bd.get(x, y)
        if c in Ry:
            for k in range(rng.randint(1, 6)):
                if bd.get(x, y + k) in Ry: bd.px(x, y + k, Rr[2 if k == 0 else 1])
    bd.outline(); cv.paste(bd)
    cv.fx.append(('window', cab[0] + 20, cab[2] + 22))
    return cv, cx


# ----------------------------------------------------------------------------- the Food Court: the neon sign
NEON = {}


@lprop('neon_sign', 'Neon sign', 1.2, ['town'], posts=[{'x': -78, 'r': .3}, {'x': 77, 'r': .3}])
def p_neon_sign(rng):
    W, H = 220, 196; G = H - 2; cx = 110
    cv = Cv(W, H); lit = Cv(W, H)
    # two steel legs and a cross beam
    legs = Cv(W, H)
    for lx in (cx - 79, cx + 76):
        for y in range(G - 112, G + 1):
            for x in range(lx, lx + 5): legs.px(x, y, R['steel'][[3, 3, 2, 1, 0][x - lx]])
        legs.rect(lx - 3, G - 3, lx + 7, G, lambda x, y: R['iron'][2 if y == G - 3 else 1])
    legs.outline(); cv.paste(legs)
    # the board
    b0, b1, bT, bB = cx - 96, cx + 95, G - 186, G - 108
    for y in range(bT, bB + 1):
        for x in range(b0, b1 + 1):
            t = 1 if (x - b0) % 24 == 0 or (y - bT) % 20 == 0 else 0 if x > b1 - 30 else 1 if x < b0 + 20 else 0
            cv.px(x, y, R['navy'][t])
    for x in range(b0, b1 + 1):
        for k, t in ((0, 4), (1, 3), (2, 2)): cv.px(x, bT + k, R['steel'][t]); cv.px(x, bB - k, R['steel'][max(0, t - 2)])
    for y in range(bT, bB + 1):
        for k, t in ((0, 4), (1, 3), (2, 2)): cv.px(b0 + k, y, R['steel'][t]); cv.px(b1 - k, y, R['steel'][max(0, t - 2)])
    for (x, y) in ((b0 + 5, bT + 5), (b1 - 5, bT + 5), (b0 + 5, bB - 5), (b1 - 5, bB - 5)): cv.px(x, y, R['steel'][4])
    def tubes(text, x0, y0, sc, Rn, F, off=None):
        """letters as glass tubes: a bright core, the colour round it; a letter in 'off' is dead (grey glass)"""
        x = x0
        for i, ch in enumerate(text):
            g_ = F[ch]; dead = off is not None and i == off
            for j, row in enumerate(g_):
                for k, c in enumerate(row):
                    if c != '#': continue
                    for yy in range(sc):
                        for xx in range(sc):
                            X, Y = x + k * sc + xx, y0 + j * sc + yy
                            core = 0 < xx < sc - 1 and 0 < yy < sc - 1 if sc >= 3 else (xx == 0 and yy == 0)
                            if dead: cv.px(X, Y, R['lav'][1] if core else R['navy'][2]); continue
                            col = (R['white'][4] if sc >= 3 else Rn[4]) if core else Rn[3]
                            cv.px(X, Y, col); lit.px(X, Y, col)
            x += (len(g_[0]) + 1) * sc
        return x
    sc = 3; text = 'FOOD COURT'; tw = len(text) * 6 * sc - sc
    tubes(text, cx - tw // 2, bT + 12, sc, R['neon'], tube_font(), off=3)
    # the dead D: a loose end of tube hanging from its bracket
    dx = cx - tw // 2 + 3 * 6 * sc
    for k in range(6): cv.px(dx + 1 + (k // 3), bT + 12 + 21 + k, R['lav'][1])
    sub = 'EAT. DRINK. SPEND.'; SF = small_font(); sw = sum((len(SF[ch][0]) + 1) * 2 for ch in sub) - 2
    tubes(sub, cx - sw // 2, bT + 46, 2, R['neonb'], SF)
    # a cyan tube round the inside of the board
    for x in range(b0 + 6, b1 - 5):
        for y in (bT + 6, bB - 6): cv.px(x, y, R['neonb'][3]); lit.px(x, y, R['neonb'][3])
    for y in range(bT + 6, bB - 5):
        for x in (b0 + 6, b1 - 6): cv.px(x, y, R['neonb'][3]); lit.px(x, y, R['neonb'][3])
    cv.outline()
    NEON['lit'] = lit
    return cv, cx


# ----------------------------------------------------------------------------- Lookout Ridge: the lookout tower
@lprop('lookout_tower', 'Lookout tower', 1.8, ['route'], solid=1.5)
def p_lookout_tower(rng):
    W, H = 150, 288; G = H - 2; cx = 75
    cv = Cv(W, H); Rw, Rd = R['wood'], R['dwood']
    yD = G - 174
    fr = Cv(W, H)
    # back legs (darker, set in), then the cross bracing and the ladder, then the front legs over them
    for s in (-1, 1):
        fr.line(cx + s * 40, G, cx + s * 27, yD, Rd[1], 3)
    for t0, t1 in ((G, G - 60), (G - 60, G - 118), (G - 118, yD + 2)):
        wl = lambda y: 52 - (G - y) / (G - yD) * 18
        fr.line(cx - wl(t0) + 2, t0 - 2, cx + wl(t1) - 2, t1 + 2, Rd[2], 2); fr.line(cx + wl(t0) - 2, t0 - 2, cx - wl(t1) + 2, t1 + 2, Rd[1], 2)
        if t1 > yD + 4:
            for x in range(int(cx - wl(t1)), int(cx + wl(t1)) + 1):
                for k, tt in ((0, 3), (1, 2), (2, 1)): fr.px(x, t1 + k, Rw[tt])
    for y in range(yD, G + 1):
        for x in (cx - 10, cx + 8): fr.px(x, y, Rw[3 if x < cx else 1]); fr.px(x + 1, y, Rw[2 if x < cx else 0])
        if (G - y) % 12 == 0:
            for x in range(cx - 9, cx + 8): fr.px(x, y, Rw[3]); fr.px(x, y + 1, Rw[1])
    for s in (-1, 1):
        a, b = (cx + s * 52, G), (cx + s * 34, yD)
        for k in range(5): fr.line(a[0] + (k - 2) * 1, a[1], b[0] + (k - 2) * 1, b[1], Rw[[3, 3, 2, 1, 0][k] if s < 0 else [2, 2, 1, 1, 0][k]], 1)
        fr.rect(a[0] - 5, G - 4, a[0] + 5, G, lambda x, y: R['stone'][3 if y == G - 4 else 2])
    fr.outline(); cv.paste(fr)
    # the deck, the railing, the cabin with windows all round, the roof
    top = Cv(W, H)
    for x in range(cx - 50, cx + 51):
        for k, tt in ((0, 4), (1, 3), (2, 2), (3, 2), (4, 1), (5, 0)): top.px(x, yD - 2 + k, Rw[tt])
    c0, c1, cT = cx - 38, cx + 37, yD - 64
    for y in range(cT, yD - 2):
        for x in range(c0, c1 + 1):
            t = xt(x, c0, c1 + 1); top.px(x, y, R['plank'][t] if (x - c0) % 6 else R['plank'][max(0, t - 1)])
    gx0, gx1, gy0, gy1 = c0 + 4, c1 - 4, cT + 8, cT + 30
    for y in range(gy0, gy1 + 1):
        for x in range(gx0, gx1 + 1):
            t = 1 if y < gy0 + 2 else 3 if (x - y) % 13 in (0, 1, 2) and x < cx + 10 else 2
            top.px(x, y, R['glass'][t])
    for x in range(gx0, gx1 + 1, 17): top.rect(x, gy0, x + 1, gy1, Rw[1])
    top.rect(gx0 - 2, gy1 + 1, gx1 + 2, gy1 + 2, Rw[3])
    for x in range(cx - 50, cx + 51, 8): top.rect(x, yD - 24, x + 1, yD - 3, Rw[3 if x < cx else 2])
    top.rect(cx - 50, yD - 26, cx + 50, yD - 24, lambda x, y: Rw[4 if y == yD - 26 else 2])
    top.rect(cx - 50, yD - 14, cx + 50, yD - 13, lambda x, y: Rw[3 if y == yD - 14 else 1])
    tile_roof(top, cT - 30, cT, cx - 2, cx + 1, cx - 49, cx + 48, R['brick'], tw=7, th=5)
    top.rect(cx - 1, cT - 40, cx, cT - 30, R['iron'][2])
    top.outline(); cv.paste(top)
    cv.fx.append(('window', cx, cT + 19))
    return cv, cx


# ----------------------------------------------------------------------------- the Offshore: the shipwreck
def curve(pts):
    """a smooth curve through points sorted by x (Catmull-Rom), as a function of x"""
    def f(x):
        if x <= pts[0][0]: return pts[0][1]
        if x >= pts[-1][0]: return pts[-1][1]
        i = max(k for k in range(len(pts) - 1) if pts[k][0] <= x)
        p0, p1, p2, p3 = pts[max(0, i - 1)], pts[i], pts[i + 1], pts[min(len(pts) - 1, i + 2)]
        t = (x - p1[0]) / (p2[0] - p1[0]); m1 = (p2[1] - p0[1]) / 2; m2 = (p3[1] - p1[1]) / 2
        return (2 * t ** 3 - 3 * t ** 2 + 1) * p1[1] + (t ** 3 - 2 * t ** 2 + t) * m1 + (-2 * t ** 3 + 3 * t ** 2) * p2[1] + (t ** 3 - t ** 2) * m2
    return f


@lprop('shipwreck', 'Shipwreck', 2.6, ['beach', 'island'], box=[8.4, 2.4])
def p_shipwreck(rng):
    W, H = 420, 250; G = H - 2; cx = 210
    cv = Cv(W, H); Rh, Rk, Rn = R['wreck'], R['driftwood'], R['navy']
    # bow up on the left where she ran aground, the stern down in the sand and broken open
    rail = curve([(cx - 172, G - 132), (cx - 146, G - 114), (cx - 96, G - 101), (cx - 20, G - 94), (cx + 60, G - 89), (cx + 124, G - 85), (cx + 162, G - 83)])
    keel = curve([(cx - 172, G - 132), (cx - 165, G - 92), (cx - 150, G - 60), (cx - 118, G - 37), (cx - 60, G - 22), (cx + 40, G - 16), (cx + 140, G - 14), (cx + 162, G - 22)])
    deck = lambda x: rail(x) + 2
    # the masts behind the hull: the main one snapped high, leaning back with the ship; a stump at the stern
    ms = Cv(W, H); mx = cx - 34
    trunk(ms, limb([(mx, deck(mx) + 4), (mx + 6, G - 160), (mx + 12, G - 214)], [10, 9, 8]), Rk, rng)
    for (x, y) in ms.polypts([(mx + 7, G - 213), (mx + 9, G - 222), (mx + 12, G - 215), (mx + 15, G - 224), (mx + 17, G - 212)]): ms.px(x, y, Rk[3])
    trunk(ms, limb([(cx + 96, deck(cx + 96) + 4), (cx + 98, G - 128), (cx + 100, G - 142)], [8, 7, 6]), Rk, rng)
    for (x, y) in ms.polypts([(cx + 96, G - 141), (cx + 98, G - 147), (cx + 101, G - 142), (cx + 104, G - 145), (cx + 104, G - 139)]): ms.px(x, y, Rk[3])
    # the yard hangs crooked from the mast, rags of sail still on it
    ya, yb = (mx - 44, G - 168), (mx + 56, G - 190)
    ms.line(ya[0], ya[1], yb[0], yb[1], Rk[2], 3)
    for x in range(ya[0] + 4, yb[0] - 4):
        if (x - ya[0]) % 31 > 22: continue
        yt = ya[1] + (yb[1] - ya[1]) * (x - ya[0]) / (yb[0] - ya[0]) + 2; L = rng.randint(10, 40) - abs((x - ya[0]) % 31 - 11)
        for j in range(max(4, L)):
            if rng.random() < .08: continue
            ms.px(x, int(yt + j + math.sin(x * .35 + j * .1) * 2), R['sail'][3 if j < 3 else 2 if (x * 3 + j) % 9 else 1])
    # slack rigging: from the mast top down to the bow and to the stern
    for (ex, ey) in ((cx - 176, G - 130), (cx + 96, G - 140)):
        sx, sy = mx + 11, G - 206
        for k in range(60):
            t = k / 59; x = sx + (ex - sx) * t; y = sy + (ey - sy) * t + math.sin(t * math.pi) * 16
            ms.px(int(x), int(y), R['iron'][0])
    ms.outline(); cv.paste(ms)
    hull = Cv(W, H); N = 11
    for x in range(cx - 172, cx + 163):
        y0, y1 = rail(x), keel(x)
        if y1 - y0 < 1: continue
        for y in range(int(y0), int(y1) + 1):
            v = (y + .5 - y0) / (y1 - y0); s = int(v * N); sv = v * N - s
            t = 3 if v < .14 else 2 if v < .55 else 1 if v < .84 else 0
            if sv > .82: t = max(0, t - 1)
            elif sv < .14 and v > .1: t = min(4, t + 1)
            if x > cx + 150: t = max(0, t - 1)               # the transom faces away from the light
            Rr = Rk if s % 4 == 1 else Rh
            hull.px(x, y, Rr[t])
        for k in range(3): hull.px(x, int(y0) + k, Rk[4 - k] if x < cx + 150 else Rk[3 - k])
    # the broken stern: planks gone, ribs against the dark hold
    for x in range(cx + 66, cx + 158):
        y0, y1 = rail(x), keel(x); h = y1 - y0
        gt = y0 + h * (.16 + .1 * abs(math.sin(x * .13))); gb = y0 + h * (.72 - .14 * abs(math.sin(x * .09 + 1)))
        if x < cx + 80: gt += (cx + 80 - x) * 1.2; gb -= (cx + 80 - x) * 1.2
        for y in range(int(gt), int(gb)):
            rib = (x - cx) % 15
            hull.px(x, y, Rk[2 if rib == 0 else 1] if rib < 3 else Rn[0] if y > gt + 3 else Rn[1])
        for y in (int(gt), int(gb)):
            if gb > gt: hull.px(x, y, Rk[0])
    # portholes, a cleat of weed along the waterline, barnacles
    for hx in (cx - 112, cx - 72, cx - 32, cx + 8, cx + 46):
        hy = rail(hx) + (keel(hx) - rail(hx)) * .3
        for (x, y) in hull.ellpts(hx, hy, 4.5, 4.5): hull.px(x, y, Rk[1] if x + y < hx + hy else Rk[0])
        for (x, y) in hull.ellpts(hx, hy, 2.6, 2.6): hull.px(x, y, Rn[0])
    for _ in range(260):
        x = rng.randint(cx - 160, cx + 150); v = rng.uniform(.74, .98); y = int(rail(x) + (keel(x) - rail(x)) * v)
        if hull.get(x, y) is not None: hull.px(x, y, R['white'][2] if rng.random() < .35 else R['seaweed'][rng.choice((1, 2, 2))])
    for x in range(cx - 130, cx + 60, 4):
        L = rng.randint(3, 16)
        for j in range(L): hull.px(x + (j // 7), int(rail(x)) + 3 + j, R['seaweed'][2 if j < 3 else 1])
    hull.line(cx - 172, G - 132, cx - 212, G - 152, Rk[2], 4)                  # the bowsprit
    hull.outline(); cv.paste(hull)
    # sand drifted against her: a low bank under the raised bow, deeper along the sunk stern, tailing off past both ends
    sd = Cv(W, H)
    for x in range(cx - 214, cx + 196):
        if x < cx - 172: top = G - 3 - (30 - 3) * max(0, 1 - (cx - 172 - x) / 42)
        elif x > cx + 162: top = G - 3 - (16 - 3) * max(0, 1 - (x - cx - 162) / 34)
        else: top = max(keel(x) - 5, G - 30 - max(0, x - (cx - 60)) * .06)
        top = int(min(G - 2, top - abs(math.sin(x * .05)) * 4 - abs(math.sin(x * .17)) * 2))
        for y in range(top, G + 1): sd.px(x, y, R['sand'][4 if y == top else 3 if y < top + 3 else 2 if x < cx + 90 else 1])
    sd.outline(); cv.paste(sd)
    return cv, cx


# ----------------------------------------------------------------------------- Stairstep Canyon: the broken bridge
@lprop('bridge_broken', 'Broken rope bridge', 0, ['canyon', 'route'])
def p_bridge_broken(rng):
    """a rope bridge across the channel between the two mesas, 25 m from cliff to cliff: sagging, a stretch of planks
    gone in the middle with one board laid over the gap, a rope snapped and dangling, CLOSED on a board (everyone uses
    it anyway). A picture standing across the channel; the deck ends rest on the cliff tops (2.3 m on the left, 2.7 m
    on the right)"""
    half = 425; W, H = 2 * half + 60, 170; G = H - 2; cx = W // 2
    cv = Cv(W, H); xL, xR = cx - half, cx + half; Rw, Rd = R['wood'], R['dwood']; Rr = ramp((196, 160, 104))
    dl, dr, sag = 2.3 * PPU, 2.7 * PPU, 18
    deck = lambda x: G - (dl + (dr - dl) * (x - xL) / (xR - xL)) + sag * math.sin(math.pi * (x - xL) / (xR - xL))
    rail = lambda x: deck(x) - 36 - 8 * math.sin(math.pi * (x - xL) / (xR - xL))
    gap0, gap1 = xL + int((xR - xL) * .23), xL + int((xR - xL) * .36)       # left of the middle: the rock arch stands in front of the middle
    snapL, snapR = xL + int((xR - xL) * .26), xL + int((xR - xL) * .32)
    br = Cv(W, H)
    # the deck: plank ends seen from the side, a stretch of them gone; one board laid over the gap
    for x in range(xL + 6, xR - 5):
        if gap0 <= x <= gap1: continue
        y0 = int(deck(x)); k = (x - xL) % 7
        if k == 6: continue
        for dy in range(5): br.px(x, y0 + dy, (Rw[3] if dy == 0 else Rw[2] if dy < 3 else Rw[1]) if k else Rd[1])
    for x in range(gap0 - 4, gap1 + 5):
        y = int(deck(gap0 - 4) + (deck(gap1 + 4) - deck(gap0 - 4)) * (x - gap0 + 4) / (gap1 - gap0 + 8)) + 1
        br.px(x, y, R['plank'][3]); br.px(x, y + 1, R['plank'][1])
    # the hand rope with its hangers, snapped in the middle and dangling
    def rope(x0, x1):
        for x in range(x0, x1):
            y = int(rail(x)); br.px(x, y, Rr[3 if (x // 3) % 2 else 2]); br.px(x, y + 1, Rr[1])
            if (x - xL) % 16 == 0 and not (gap0 - 2 <= x <= gap1 + 2):
                for yy in range(y + 2, int(deck(x))): br.px(x, yy, Rr[2] if (yy // 2) % 2 else Rr[1])
    rope(xL + 4, snapL); rope(snapR, xR - 4)
    for (x0, dirn) in ((snapL, -1), (snapR, 1)):
        y0 = int(rail(x0))
        for k in range(34):
            x = x0 + dirn * int(math.sin(k / 34 * 1.2) * 6); br.px(x, y0 + k, Rr[2 if k % 3 else 1])
        br.px(x0 + dirn * 5 - 1, y0 + 34, Rr[3]); br.px(x0 + dirn * 5 + 1, y0 + 35, Rr[3])
    # the anchor posts on the cliff tops, rope wound round them
    for px0 in (xL - 2, xR - 8):
        top = int(min(deck(px0 + 5), deck(px0)) - 50); bot = int(max(deck(px0), deck(px0 + 9))) + 8
        for y in range(top, bot):
            for x in range(px0, px0 + 10): br.px(x, y, Rd[[3, 3, 2, 2, 2, 2, 1, 1, 0, 0][x - px0]])
        for yb in (top + 8, top + 30):
            for y in range(yb, yb + 4):
                for x in range(px0 - 1, px0 + 11): br.px(x, y, Rr[3 if y == yb else 2 if x < px0 + 6 else 1])
        for x in range(px0, px0 + 10): br.px(x, top, Rd[4])
    # CLOSED, on a board hung from the rope near the right end
    sx = xR - 90; sy = int(rail(sx)) + 4
    br.rect(sx - 1, sy - 3, sx - 1, sy, Rr[1]); br.rect(sx + 26, sy - 3, sx + 26, sy, Rr[1])
    br.rect(sx - 3, sy, sx + 28, sy + 11, lambda x, y: R['red'][3 if y == sy else 2 if x < sx + 22 else 1])
    SF = {'C': ['###', '#..', '#..', '#..', '###'], 'L': ['#..', '#..', '#..', '#..', '###'], 'O': ['###', '#.#', '#.#', '#.#', '###'],
          'S': ['###', '#..', '###', '..#', '###'], 'E': ['###', '#..', '##.', '#..', '###'], 'D': ['##.', '#.#', '#.#', '#.#', '##.']}
    x = sx
    for ch in 'CLOSED':
        for j, row in enumerate(SF[ch]):
            for k, c in enumerate(row):
                if c == '#': br.px(x + k, sy + 3 + j, R['white'][4])
        x += 4
    br.outline(); cv.paste(br)
    # boards that fell through, lying on the channel floor
    fl = Cv(W, H)
    for (fx, fw, tilt) in ((gap0 + 4, 30, 2), (gap0 + 26, 26, -1), (gap1 - 18, 32, 1)):
        for k in range(fw):
            y = G - 2 + int(tilt * k / fw)
            fl.px(fx + k, y, R['plank'][3]); fl.px(fx + k, y + 1, R['plank'][1])
    fl.outline(); cv.paste(fl)
    return cv, cx


# ----------------------------------------------------------------------------- Bull Run Pass: the waystone
@lprop('waystone', 'Waystone', .8, ['mountain', 'route'], solid=.6)
def p_waystone(rng):
    W, H = 64, 112; G = H - 2; cx = 32
    cv = Cv(W, H)
    st = Cv(W, H); Rg = R['granite']
    shape = [(cx - 17, G + 1), (cx - 18, G - 40), (cx - 15, G - 76), (cx - 9, G - 90), (cx + 1, G - 95), (cx + 11, G - 89), (cx + 16, G - 70), (cx + 18, G - 30), (cx + 17, G + 1)]
    trunk(st, shape, Rg, rng, streaks=False)
    for _ in range(90):
        x = rng.randint(cx - 16, cx + 16); y = rng.randint(G - 90, G)
        c = st.get(x, y)
        if c in Rg: st.px(x, y, Rg[max(0, min(4, Rg.index(c) + rng.choice((-1, 1))))])
    # carvings: an arrow up the pass, and rows of marks under it (a groove with a lit lower lip)
    def groove(x0, y0, x1, y1):
        st.line(x0, y0, x1, y1, Rg[0], 1); st.line(x0, y0 + 1, x1, y1 + 1, Rg[3], 1)
    groove(cx, G - 78, cx, G - 56); groove(cx - 6, G - 71, cx, G - 78); groove(cx + 6, G - 71, cx, G - 78)
    for row in range(4):
        y = G - 48 + row * 9; x = cx - 11
        while x < cx + 10:
            w = rng.randint(2, 4); groove(x, y, x + w, y)
            if rng.random() < .4: groove(x + w // 2, y - 2, x + w // 2, y)
            x += w + 2
    for _ in range(26):
        x = rng.randint(cx - 17, cx + 17); y = rng.randint(G - 70, G - 4)
        if st.get(x, y) in Rg and st.get(x + 1, y) in Rg: st.px(x, y, R['lichen'][2]); st.px(x + 1, y, R['lichen'][3 if rng.random() < .5 else 1])
    st.outline()
    snow_cap(st, depth=3)
    cv.paste(st)
    # a cairn at its foot
    cn = Cv(W, H)
    for (sx, sy, rx, ry) in ((cx + 22, G - 4, 8, 5), (cx + 12, G - 3, 6, 4), (cx + 20, G - 11, 6, 4), (cx + 22, G - 17, 4, 3), (cx - 22, G - 3, 5, 3)):
        for (x, y) in cn.ellpts(sx, sy, rx, ry):
            n = sph((x + .5 - sx) / rx, (y + .5 - sy) / ry); cn.px(x, y, R['stone'][max(1, n)])
    cn.outline(); snow_cap(cn, depth=2); cv.paste(cn)
    return cv, cx


# ----------------------------------------------------------------------------- Summit Capital: the golden cushion
@lprop('golden_cushion', 'Golden cushion', 1.2, ['mountain', 'town'], solid=1.0)
def p_golden_cushion(rng):
    W, H = 130, 112; G = H - 2; cx = 65
    cv = Cv(W, H); Rm = R['marble']
    pl = Cv(W, H)
    pl.rect(cx - 46, G - 8, cx + 45, G, lambda x, y: Rm[4 if y == G - 8 else xt(x, cx - 46, cx + 46)])
    for y in range(G - 52, G - 8):
        for x in range(cx - 36, cx + 36): pl.px(x, y, Rm[xt(x, cx - 36, cx + 36, (.2, .6, .9))])
    for (vx, vy) in ((cx - 26, G - 48), (cx + 12, G - 40), (cx - 6, G - 20)):
        x, y = vx, vy
        for k in range(18):
            if pl.get(x, y) is not None: pl.px(x, y, Rm[1])
            x += rng.choice((0, 1, 1)); y += 1
    pl.rect(cx - 42, G - 58, cx + 41, G - 52, lambda x, y: Rm[4 if y == G - 58 else 3 if y < G - 54 and x < cx + 30 else 2 if y < G - 53 else 1])
    pl.rect(cx - 13, G - 44, cx + 12, G - 34, lambda x, y: R['gold'][3 if y == G - 44 or x == cx - 13 else 2 if x < cx + 10 else 1])
    for y in (G - 41, G - 38):
        for x in range(cx - 9, cx + 9, 2): pl.px(x, y, R['gold'][0])
    pl.outline(); cv.paste(pl)
    # the cushion: plump gold satin, a button in the middle, piping and tassels
    # a plump square cushion seen from the front and a little above: the top (lit, tufted: a button in the middle, a
    # crease to each corner, each quarter puffed up), the front below a piped seam, the corners pinched to points
    cu = Cv(W, H); base = G - 58
    BL, BR, FL, FR = (cx - 38, base - 42), (cx + 38, base - 42), (cx - 47, base - 16), (cx + 47, base - 16)
    def edge(a, b, bulge, n=40):
        out = []
        for k in range(n + 1):
            t = k / n; x = a[0] + (b[0] - a[0]) * t; y = a[1] + (b[1] - a[1]) * t; dx, dy = b[1] - a[1], -(b[0] - a[0]); L = math.hypot(dx, dy) or 1
            w = bulge * math.sin(math.pi * t) ** .8; out.append((x + dx / L * w, y + dy / L * w))
        return out
    top = edge(BL, BR, 5)[:-1] + edge(BR, FR, 4)[:-1] + edge(FR, FL, 3)[:-1] + edge(FL, BL, 4)[:-1]
    front = edge(FL, FR, -3)[::-1][:-1] + [FR, (cx + 45, base - 6)] + edge((cx + 45, base - 6), (cx - 45, base - 6), 6)[1:-1] + [(cx - 45, base - 6), FL]
    mid = (cx, base - 28)
    for (x, y) in cu.polypts(front):
        v = (y + .5 - (base - 16)) / 14; u = (x + .5 - cx) / 47
        n = 2 if v < .55 else 1
        if u > .55: n -= 1
        if u < -.6 and v < .5: n += 1
        cu.px(x, y, R['satin'][max(0, min(4, n))])
    def segd(px_, py_, a, b):
        ax, ay = a; bx, by = b; vx, vy = bx - ax, by - ay; t = max(0, min(1, ((px_ - ax) * vx + (py_ - ay) * vy) / (vx * vx + vy * vy)))
        return math.hypot(px_ - ax - vx * t, py_ - ay - vy * t)
    creases = [(mid, (mid[0] + (c[0] - mid[0]) * .62, mid[1] + (c[1] - mid[1]) * .62)) for c in (BL, BR, FL, FR)]
    for (x, y) in cu.polypts(top):
        dx, dy = x + .5 - mid[0], y + .5 - mid[1]
        n = sph(max(-1, min(1, dx / 52)), max(-1, min(1, dy / 30 - .35)), .3)
        d = min(segd(x + .5, y + .5, a_, b_) for a_, b_ in creases)
        if d < 1.1: n = max(1, n - 2)
        elif d < 2.6 and dy > 0: n = max(1, n - 1)
        if math.hypot(dx, dy * 1.6) < 6: n = max(1, n - 1)
        cu.px(x, y, R['satin'][n])
    for (x, y) in cu.ellpts(mid[0], mid[1], 2.6, 2.0): cu.px(x, y, R['gold'][0])
    cu.px(mid[0] - 1, mid[1] - 1, R['gold'][4])
    for (x, y) in edge(FL, FR, -3, 90):                   # the piping along the front seam
        cu.px(int(x), int(y), R['gold'][4 if x < cx + 20 else 3]); cu.px(int(x), int(y) + 1, R['gold'][1])
    for (tx, ty) in (FL, FR):
        cu.rect(tx - 1, ty - 1, tx + 1, ty + 1, R['gold'][1])
        for y in range(ty + 2, ty + 11):
            w = 1 if y < ty + 4 else 2
            for x in range(tx - w, tx + w + 1): cu.px(x, y, R['gold'][3 if x < tx else 1 if x > tx else 2])
    for (tx, ty) in (BL, BR): cu.rect(tx - 1, ty - 1, tx, ty, R['gold'][2])
    cu.outline(); cv.paste(cu)
    # a velvet rope on two brass posts in front of it
    for sx in (cx - 58, cx + 56):
        cv.rect(sx, G - 30, sx + 2, G, lambda x, y: R['gold'][3 if x == sx else 1])
        cv.rect(sx - 2, G - 2, sx + 4, G, R['gold'][1])
        for (x, y) in cv.ellpts(sx + 1, G - 32, 2.5, 2.5): cv.px(x, y, R['gold'][4 if x <= sx else 2])
    for x in range(cx - 56, cx + 56):
        t = (x - (cx - 56)) / 112.0; y = int(G - 28 + math.sin(t * math.pi) * 9)
        for k in range(3): cv.px(x, y + k, R['velvet'][3 if k == 0 else 2 if k == 1 else 1])
    cv.outline()
    cv.fx.append(('sparkle', cx - 18, G - 84)); cv.fx.append(('sparkle', cx + 20, G - 80))
    return cv, cx


# ----------------------------------------------------------------------------- Liquidity Lake: the little lighthouse
@lprop('lighthouse_small', 'Little lighthouse', .7, ['beach', 'water'], solid=.5)
def p_lighthouse_small(rng):
    W, H = 52, 132; G = H - 2; cx = 26
    cv = Cv(W, H)
    stone_band(cv, cx - 16, cx + 15, G - 9, G, R['stone'], bw=8, bh=3)
    yT = G - 92
    for y in range(yT, G - 9):
        f = (y - yT) / (G - 9 - yT); hw = 8.5 + 4 * f
        Rb = R['red'] if y < yT + 16 or (G - 22 <= y < G - 15) else R['white']
        for x in range(int(cx - hw), int(cx + hw) + 1):
            u = (x + .5 - (cx - hw)) / (2 * hw)
            cv.px(x, y, Rb[4 if u < .14 else 3 if u < .38 else 2 if u < .74 else 1])
    door(cv, cx, G - 10, 10, 18, Rw=R['dwood'], arch=True, glass=False)
    window(cv, cx - 3, G - 66, 6, 9, Rf=R['white'], cross=False, sill=False, rec=None)
    cv.rect(cx - 13, yT - 3, cx + 13, yT, lambda x, y: R['iron'][3 if y == yT - 3 else 1])
    for x in range(cx - 13, cx + 14, 4): cv.rect(x, yT - 10, x, yT - 4, R['iron'][1])
    cv.rect(cx - 13, yT - 11, cx + 13, yT - 10, R['iron'][2])
    cv.rect(cx - 7, yT - 24, cx + 7, yT - 4, lambda x, y: R['lamp'][4 if (x + y) % 7 < 2 else 3])
    for x in (cx - 7, cx, cx + 7): cv.rect(x, yT - 24, x, yT - 4, R['iron'][1])
    cv.poly([(cx - 10, yT - 24), (cx, yT - 36), (cx + 10, yT - 24)], lambda x, y: R['red'][3 if x < cx else 1])
    cv.rect(cx - 1, yT - 40, cx, yT - 36, R['iron'][2])
    cv.outline()
    cv.fx.append(('glow', cx, yT - 14))
    return cv, cx


# ----------------------------------------------------------------------------- signs of people: chalk on the paving
# (not landmarks: tools/build-life-v47.py puts them down in the towns, with "dry", so the rain washes them away)
def chalk_line(cv, pts, col, rng, w=1):
    for (a, b) in zip(pts, pts[1:]):
        n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1]))) + 1
        for i in range(n + 1):
            if rng.random() < .12: continue                      # chalk skips on rough stone
            x = a[0] + (b[0] - a[0]) * i / n; y = a[1] + (b[1] - a[1]) * i / n
            for k in range(w): cv.px(int(x) + k, int(y), col)


DIGITS = {'1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['##.', '..#', '.#.', '#..', '###'], '3': ['##.', '..#', '.#.', '..#', '##.'], '4': ['#.#', '#.#', '###', '..#', '..#'],
          '5': ['###', '#..', '##.', '..#', '##.'], '6': ['.##', '#..', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'], '8': ['###', '#.#', '###', '#.#', '###']}


@lprop('chalk_hopscotch', 'Hopscotch in chalk', 0, ['town'], flat=1, landmark=False)
def p_chalk_hopscotch(rng):
    """lies flat: the top of the picture is the far end. 1, 2, 3|4, 5, 6|7, 8 and a half-moon home"""
    W, H = 46, 104; cx = 23; cv = Cv(W, H); col = R['white'][4]; num = R['pink'][3]
    s = 13; y = H - 4
    rows = [1, 1, 2, 1, 2, 1]; n = 1
    for r in rows:
        x0 = cx - s // 2 if r == 1 else cx - s
        for k in range(r):
            a = x0 + k * s
            chalk_line(cv, [(a, y), (a + s, y), (a + s, y - s), (a, y - s), (a, y)], col, rng)
            for j, row in enumerate(DIGITS[str(n)]):
                for i, c in enumerate(row):
                    if c == '#': cv.px(a + 5 + i, y - s + 4 + j, num)
            n += 1
        y -= s
    for i in range(0, 15):
        an = math.pi * i / 14; chalk_line(cv, [(cx + math.cos(an) * 8, y - math.sin(an) * 8)] * 2, col, rng)
    return cv, cx


@lprop('chalk_sun', 'Chalk drawing', 0, ['town'], flat=1, landmark=False)
def p_chalk_sun(rng):
    """lies flat: a smiling sun and a flower, drawn by someone small"""
    W, H = 64, 44; cx = 32; cv = Cv(W, H); yel = R['yellow'][3]; pk = R['pink'][3]; gr = R['leaf'][3]
    sx, sy, r = cx - 12, 22, 8
    for i in range(36):
        an = math.tau * i / 36; chalk_line(cv, [(sx + math.cos(an) * r, sy + math.sin(an) * r * .8)] * 2, yel, rng)
    for i in range(8):
        an = math.tau * i / 8; chalk_line(cv, [(sx + math.cos(an) * (r + 2), sy + math.sin(an) * (r + 2) * .8), (sx + math.cos(an) * (r + 6), sy + math.sin(an) * (r + 6) * .8)], yel, rng)
    cv.px(sx - 3, sy - 2, yel); cv.px(sx + 3, sy - 2, yel)
    for i in range(-3, 4): cv.px(sx + i, sy + 3 - (1 if abs(i) == 3 else 0), yel)
    fx, fy = cx + 16, 14
    chalk_line(cv, [(fx, fy + 4), (fx, fy + 22)], gr, rng); chalk_line(cv, [(fx, fy + 15), (fx + 5, fy + 11)], gr, rng)
    for i in range(5):
        an = math.tau * i / 5 - math.pi / 2
        for j in range(12):
            b = math.tau * j / 12; cv.px(int(fx + math.cos(an) * 4 + math.cos(b) * 2.4), int(fy + math.sin(an) * 4 + math.sin(b) * 2.4), pk)
    cv.px(fx, fy, yel)
    return cv, cx


# ============================================================================= pictures, layers, catalogue
def leaf_layers(key, img):
    """back and front leaf layers like every other tree's (tools/build-prop-layers.py)"""
    import numpy as np
    sp = importlib.util.spec_from_file_location('bpl', os.path.join(HERE, 'build-prop-layers.py')); bpl = importlib.util.module_from_spec(sp); sp.loader.exec_module(bpl)
    im = np.asarray(img.convert('RGBA')).copy(); L = bpl.layers_for(key, im, False)
    if not L: return None
    back, front, (top, cut) = L
    cw = (np.ptp(np.nonzero((im[top:cut, :, 3] > 0).any(0))[0]) + 1) / PPU
    return Image.fromarray(back, 'RGBA'), Image.fromarray(front, 'RGBA'), round(min(.6, cw * .2), 2), round(-min(.45, cw * .14), 2)


def crop_like(cv_img_src, lit, bx):
    """the neon tubes' picture, cut to the same box as the sign's own picture"""
    xs, ys = [], []
    for y in range(cv_img_src.h):
        for x in range(cv_img_src.w):
            if cv_img_src.a[y * cv_img_src.w + x] is not None: xs.append(x); ys.append(y)
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    half = max(bx - x0, x1 + 1 - bx) + 1; w = 2 * half; h = (y1 - y0 + 1) + 1
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0)); px = img.load()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            c = lit.a[y * lit.w + x]
            if c is not None: px[x - bx + half, y - y0 + 1] = (c[0], c[1], c[2], 255)
    return img


def render_all():
    """every landmark: (key, canvas, base x, picture, extras for the catalogue, extra pictures {path: image})"""
    out = []
    for key in NEW:
        CLOCK.clear(); NEON.clear()
        cv, bx, img = bsp.render(key)
        extra, files = {}, {}
        if key == 'clock_tower':
            x0, x1, y0, y1 = bsp.bounds(cv); fy = CLOCK['y'] - y1
            for suf, (L, w_, tip, col, cap, per) in (('hh', (10, 3, 3, R['iron'][0], False, 43200)), ('hm', (16, 2, 3, R['iron'][0], True, 3600))):
                files[f'clock_tower_{suf}.png'] = hand_img(L, w_, tip, col, cap)
            extra['hands'] = [dict(img='scene/props/clock_tower_hh.png', x=0, y=fy, w=33, h=33, px=16, py=16, per=43200),
                              dict(img='scene/props/clock_tower_hm.png', x=0, y=fy, w=33, h=33, px=16, py=16, per=3600)]
        if key == 'neon_sign':
            files['layers/neon_sign_lit.png'] = crop_like(cv, NEON['lit'], bx)
            extra['layers'] = [dict(img='scene/props/layers/neon_sign_lit.png', dz=-.03, sway=0, shadow=0, glow=1)]
            extra['glow'] = dict(c='#FF6EC7', r=2.6, y=4.3, day=.12)
        if key in ('tree_giant', 'tree_willow_lean'):
            L = leaf_layers(key, img)
            if L:
                b, f, db, df = L; files[f'layers/{key}_lb.png'] = b; files[f'layers/{key}_lf.png'] = f
                extra['layers'] = [dict(img=f'scene/props/layers/{key}_lb.png', dz=db, sway=.7, shadow=0), dict(img=f'scene/props/layers/{key}_lf.png', dz=df, sway=1.4, shadow=0)]
        out.append((key, cv, bx, img, extra, files))
    return out


def load_data():
    src = gamedata.js_text(); i = src.index('window.GAMEDATA=')
    return src[:i], json.JSONDecoder().raw_decode(src[i + len('window.GAMEDATA='):])[0]


def save_data(head, D):
    gamedata.save_js(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n')


# ============================================================================= placing them
# (scene, key, where to look first, how far to look, extra fields). Spots were picked from a map of each place.
SPOTS = [('sundown', 'clock_tower', (44.6, 27.3), 1.5, {}),
         ('longgrass', 'tree_giant', (84.0, 36.8), 4.0, {}),
         ('pond', 'tree_willow_lean', (42.4, 37.0), 2.5, {}),
         ('scrapyard', 'crane', (60.0, 41.0), 6.0, {'days': [0, 2, 4, 6]}),
         ('scrapyard', 'crane', None, 0, {'days': [1, 3, 5], 'f': True}),
         ('foodcourt', 'neon_sign', (51.6, 29.8), 1.5, {}),
         ('ridge', 'lookout_tower', (94.0, 51.0), 4.0, {}),
         ('offshore', 'shipwreck', (27.0, 29.8), 4.0, {}),
         ('canyon', 'bridge_broken', (57.0, 45.5), .6, {}),
         ('pass', 'waystone', (73.6, 57.5), 4.0, {}),
         ('summit', 'golden_cushion', (47.6, 66.0), 3.0, {}),
         ('lake', 'lighthouse_small', (80.6, 39.45), .6, {})]


def wet_ok(Pl, x, z):
    """a wreck's spot: sand under its middle and most of its length, nothing standing in its footprint"""
    M = Pl.cat['shipwreck']; hw, d = M['box'][0] / 2, M['box'][1]
    dry = sum(1 for dx in (-hw * .6, -hw * .3, 0, hw * .3, hw * .6) if Pl.tile(x + dx, z + d / 2) not in (None, 'w', 'd'))
    if Pl.tile(x, z + d / 2) in (None, 'w', 'd') or dry < 4: return False
    for p in Pl.sc['props'] + Pl.added:
        f = Pl.foot(p)
        if f[0] == 'box':
            if f[1] < x + hw + .3 and f[3] > x - hw - .3 and f[2] < z + d + .3 and f[4] > z - .4: return False
        elif x - hw - .3 - f[3] < f[1] < x + hw + .3 + f[3] and z - .4 - f[3] < f[2] < z + d + .3 + f[3]: return False
    return True


def place(D, dry=False):
    """put each landmark down near its spot. Wild growth (the plants tools/grow-wild.py scattered, "w": 42) doesn't
    count as in the way: the plants under a landmark's footprint are lifted and kept on the landmark ("under"), and
    put back when this tool runs again; anything else in the way moves the landmark instead"""
    lp = importlib.util.spec_from_file_location('life', os.path.join(HERE, 'build-life-v47.py')); life = importlib.util.module_from_spec(lp); lp.loader.exec_module(life)
    cat = D['scenery']['props']; S = D['maps']; report = []
    for sid in {s[0] for s in SPOTS}:
        sc = S.get(sid)
        if not sc: continue
        keep, back = [], []
        for p in sc.get('props', []):
            if p.get(TAG): back += p.get('under') or []
            else: keep.append(p)
        sc['props'] = keep + back
    last = None
    for sid, key, at, rad, kw in SPOTS:
        sc = S.get(sid)
        if not sc: report.append(f'{sid}: no such place'); continue
        if sc.get('keep'): report.append(f'{sid}: kept as it is (marked keep)'); continue
        if at is None:                                   # the same spot as the one before (the crane's other days)
            if last and last[0] == sid: p = dict(last[1]); p.pop('under', None); p.update(kw); sc['props'].append(p); report.append(f'{sid}: {key} again at the same spot ({", ".join(k for k in kw)})')
            continue
        firm = [p for p in sc['props'] if p.get('w') != 42]
        Pl = life.Place(sid, dict(sc, props=firm), cat); M = cat[key]; wet = key == 'shipwreck'      # a wreck may lie half in the shallows
        r = (M.get('solid') or 0) or (max(M['box']) / 2 if M.get('box') else .6)
        best = None
        for k in range(0, 40):
            ring = rad * k / 40
            for a in range(0, 360, 30 if k else 360):
                x = at[0] + math.cos(math.radians(a)) * ring; z = at[1] + math.sin(math.radians(a)) * ring
                if (not wet and Pl.clear(x, z, r * .9, ground=None)) or (key == 'lighthouse_small' and Pl.tile(x, z) == 'b' and Pl.clear(x, z, r * .9, ground={'b'})) or (wet and wet_ok(Pl, x, z)):
                    best = (x, z); break
            if best: break
        if not best: report.append(f'{sid}: no room for {key} near {at}'); continue
        p = {'k': key, 'x': round(best[0], 2), 'z': round(best[1], 2), TAG: 1}; p.update(kw)
        # lift the wild plants it would stand on
        if M.get('box'): bx0, bx1, bz0, bz1 = p['x'] - M['box'][0] / 2 - .3, p['x'] + M['box'][0] / 2 + .3, p['z'] - .5, p['z'] + M['box'][1] + .3
        else: rr = r + .5; bx0, bx1, bz0, bz1 = p['x'] - rr, p['x'] + rr, p['z'] - rr, p['z'] + rr
        hw = M['box'][0] / 2 if M.get('box') else max(r, -M['ox'] / PPU * .6)
        under = [q for q in sc['props'] if q.get('w') == 42 and ((bx0 < q['x'] < bx1 and bz0 < q['z'] < bz1 and (M.get('box') or math.hypot(q['x'] - p['x'], q['z'] - p['z']) < r + .5))
                 or (abs(q['x'] - p['x']) < hw + .6 and p['z'] - 3.5 < q['z'] <= p['z'] and (cat.get(q['k']) or {}).get('shadow', 0) > .5))]   # tall wild things just in front of it too
        if under: sc['props'] = [q for q in sc['props'] if not any(q is u for u in under)]; p['under'] = under
        sc['props'].append(p); last = (sid, p)
        report.append(f'{sid}: {key} at ({p["x"]}, {p["z"]})' + (f' ({", ".join(k for k in kw)})' if kw else '') + (f', {len(under)} wild plants lifted' if under else ''))
    return report


def main():
    args = sys.argv[1:]; prev = None
    if '--preview' in args: i = args.index('--preview'); prev = args[i + 1]; del args[i:i + 2]
    force = '--force' in args; noplace = '--no-place' in args
    res = render_all()
    if prev:
        from PIL import ImageDraw
        items = []
        for key, cv, bx, img, extra, files in res:
            items.append((key, img))
            for f, im in files.items(): items.append((f, im))
        only = [a for a in args if not a.startswith('--')]
        if only: items = [it for it in items if any(it[0].startswith(o) or ('/' + o) in it[0] for o in only)]
        zoom = 2 if only else 1
        W = 2400; x = y = 10; rowh = 0; out = Image.new('RGBA', (W, 6000), (116, 168, 108, 255)); d = ImageDraw.Draw(out)
        for k, im in items:
            im2 = im.resize((im.width * zoom, im.height * zoom), Image.NEAREST)
            if x + im2.width > W: x = 10; y += rowh + 24; rowh = 0
            d.text((x, y), k, fill=(20, 20, 30)); out.alpha_composite(im2, (x, y + 14)); rowh = max(rowh, im2.height + 14); x += im2.width + 20
        out.crop((0, 0, W, y + rowh + 30)).save(prev); print('preview', prev); return
    written = []
    Pm = json.load(open(META)); head, D = load_data(); cat = D['scenery']['props']; padd, cadd = [], []
    for key, cv, bx, img, extra, files in res:
        path = os.path.join(OUT, key + '.png')
        if bsp.save_png(img, path, force): written.append(key)
        disk = Image.open(path)
        m = bsp.prop_meta(key, cv, bx, disk if disk.size != img.size else img); m.update({k: v for k, v in extra.items() if k not in ('layers',)})
        if NEW[key]['landmark']: m['landmark'] = 1
        if extra.get('layers'): m['layers'] = extra['layers']
        for f, im in files.items():
            if bsp.save_png(im, os.path.join(OUT, f), force): written.append(f)
        if key not in Pm or force: Pm[key] = m; padd.append(key)
        if key not in cat or force:
            e = dict(name=m['name'], img='scene/props/%s.png' % key, ox=m['ox'], oy=m['oy'], shadow=m['shadow'], sway=m.get('sway', 0), flat=m.get('flat', 0), tags=m['tags'], group=m['group'])
            for f in ('box', 'fx', 'solid', 'posts', 'hands', 'layers', 'glow', 'landmark'):
                if m.get(f): e[f] = m[f]
            cat[key] = e; cadd.append(key)
        elif NEW[key]['landmark'] and not cat[key].get('landmark'): cat[key]['landmark'] = 1
    # the older landmarks the camera should look up at too
    for key in ('lighthouse', 'windmill'):
        if key in cat and not cat[key].get('landmark'): cat[key]['landmark'] = 1
        if key in Pm and not Pm[key].get('landmark'): Pm[key]['landmark'] = 1
    bsp.write_json(META, Pm)
    rep = [] if noplace else place(D)
    save_data(head, D)
    print(f'{len(NEW)} landmarks; pictures written: {", ".join(written) or "none (all there)"}; props.json added: {len(padd)}; catalogue added: {", ".join(cadd) or "none"}')
    for r in rep: print('  ' + r)


if __name__ == '__main__':
    main()
