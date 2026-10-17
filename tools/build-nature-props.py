#!/usr/bin/env python3
"""v42: seventy nature props in five families, drawn with the scene-prop kit (same ramps, outline and lighting as
tools/build-scene-props.py) and added to the prop catalogue. Pictures that already exist on disk are kept, so a prop
that has been painted over in the Studio is never redrawn (--force redraws the ones named, or all of them).

    python3 tools/build-nature-props.py                  # draw the missing ones, add them to props.json and game data
    python3 tools/build-nature-props.py --sheet validation/v42-nature.png
    python3 tools/build-nature-props.py tulips_red --force

Families (the Seamless World plan, v42):
  flowers        tulips (3), daisies, bluebells, poppies, sunflowers, lavender, foxgloves, lupins, dandelions and their
                 clocks, white clover, buttercups, cornflowers, marigolds, snowdrops, crocuses              18
  ground cover   tussock, sedge, wild wheat, dry grass, bracken, thistles, heather, moss patch, clover patch,
                 nettles, horsetail, snowy grass                                                              12
  shrubs         hawthorn, bramble, juniper, box ball, holly, rhododendron, rosemary, wild roses              8
  trees          rowan, poplar, beech, hazel, olive, cypress, elm, chestnut, larch, fallen tree              10
  water plants   yellow and purple iris, bulrush, duckweed, a lily pad, pink and white lotus, marsh marigold,
                 water mint                                                                                  9
  rocks, ground  lichen boulder, flat stones, scree, molehill, exposed roots                                  5
  seasons        rowan, beech, poplar, hazel and birch in autumn, hawthorn in autumn, dry seed heads, rust tussock  8

Every prop has a group (scenes and the wild-growth pass pick within a group) and the growth families below
(GROWTH) say which terrains each one grows on; tools/grow-wild.py reads them."""
import gamedata  # phase 04b: the data files in game/data
import os, sys, json, math, random, zlib, importlib.util
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
spec = importlib.util.spec_from_file_location('bsp', os.path.join(HERE, 'build-scene-props.py')); bsp = importlib.util.module_from_spec(spec); spec.loader.exec_module(bsp)
Cv, R, ramp, blob, leafy, grass_tuft, trunk, layer_out, oak_tree, rock_pile, tiny_flower, finish, prop_meta, save_png, write_json, sph, olc, frond, pine_tree, rock_mass, OUT, META = (
    bsp.Cv, bsp.R, bsp.ramp, bsp.blob, bsp.leafy, bsp.grass_tuft, bsp.trunk, bsp.layer_out, bsp.oak_tree, bsp.rock_pile, bsp.tiny_flower, bsp.finish, bsp.prop_meta,
    bsp.save_png, bsp.write_json, bsp.sph, bsp.olc, bsp.frond, bsp.pine_tree, bsp.rock_mass, bsp.OUT, bsp.META)
DATA = os.path.join(ROOT, 'game', 'data', 'gamedata.js')

# a few more ramps for the new plants
R.update({k: ramp(v) for k, v in dict(
    olive=(150, 168, 118), sage=(142, 164, 140), dry=(206, 178, 110), rustleaf=(214, 118, 56), goldleaf=(236, 190, 64),
    deep=(60, 118, 78), lime=(170, 206, 90), plum=(120, 72, 140), snowc=(238, 242, 248), brown=(120, 84, 56), lichen=(224, 186, 80),
    duck=(130, 196, 92), mud=(110, 84, 62)).items()})

NAT = {}
# family -> terrain letters it grows on (the wild-growth pass draws from these; a scene can narrow them)
GROWTH = {}


def nat(key, name, shadow, sway, tags, flat=0, group=None, solid=0, family='flowers', grow='gGf', weight=1.0, vol=None):
    def deco(fn):
        d = dict(fn=fn, name=name, shadow=shadow, sway=sway, tags=tags, flat=flat, group=group or key, solid=solid, box=None, posts=None, vol=vol)
        NAT[key] = d; bsp.PROPS[key] = d
        GROWTH[key] = dict(family=family, grow=grow, weight=weight)
        return fn
    return deco


# ----------------------------------------------------------------------------- shared drawing
def leaf_base(cv, cx, G, rx, ry, Rl, rng, cell=4, sprigs=9):
    pts = []
    for (x, y) in cv.ellpts(cx, G - ry + 2, rx, ry):
        ny = (y + .5 - (G - ry + 2)) / ry
        pts.append((x, y, 3 if ny < -.3 else 2 if ny < .4 else 1))
    leafy(cv, pts, Rl, rng, cell=cell)
    for k in range(sprigs):
        x = cx - rx * .85 + k * (rx * 1.7 / max(1, sprigs - 1)) + rng.uniform(-1, 1)
        for d in range(rng.randint(2, 4)):
            cv.px(int(x) + (d % 2), G - ry - 1 - d, Rl[3 if d else 2])
    cv.outline()


def stem(cv, x, y0, y1, Rl, lean=0):
    for y in range(y1, y0 + 1):
        xx = x + int(round(lean * (y0 - y) / max(1, y0 - y1)))
        if cv.get(xx, y) is None or cv.get(xx, y) in [olc(c) for c in Rl] or cv.get(xx, y) in Rl:
            cv.px(xx, y, Rl[1])


def bloom(cv, kind, x, y, Rf, rng, centre=None, size=1):
    """a flower head on its own layer with its outline; (x, y) is the bottom centre of the head"""
    lay = Cv(cv.w, cv.h); Y = R['yellow']
    if kind == 'star':
        for (a, b, t) in ((0, -1, 4), (-1, 0, 3), (1, 0, 2), (0, 1, 1)): lay.px(x + a, y - 1 + b, Rf[t])
        lay.px(x, y - 1, centre or Y[4])
    elif kind == 'cup':         # tulip
        for (a, b, t) in ((-1, -3, 4), (1, -3, 3), (-1, -2, 3), (0, -2, 3), (1, -2, 2), (-1, -1, 2), (0, -1, 2), (1, -1, 1), (0, 0, 1)): lay.px(x + a, y + b, Rf[t])
        lay.px(x, y - 3, Rf[2])
    elif kind == 'daisy':
        for (a, b) in ((0, -2), (0, 2), (-2, 0), (2, 0), (-1, -1), (1, -1), (-1, 1), (1, 1), (0, -1), (0, 1), (-1, 0), (1, 0)):
            lay.px(x + a, y - 2 + b, Rf[4 if b < 0 or a < 0 else 3 if b == 0 else 2])
        lay.px(x, y - 2, centre or R['gold'][3])
    elif kind == 'pom':
        r = 2 + size
        for (a, b) in lay.ellpts(x, y - r, r, r * .9):
            t = sph((a + .5 - x) / r, (b + .5 - y + r) / r); lay.px(a, b, Rf[max(1, t)])
    elif kind == 'disc':        # sunflower
        for (a, b) in lay.ellpts(x, y - 5, 5, 5):
            d = math.hypot(a + .5 - x, b + .5 - y + 5)
            if d < 2.6: lay.px(a, b, R['dwood'][1 if (a + b) % 2 else 2])
            else: lay.px(a, b, Rf[4 if b < y - 6 and a < x else 3 if b < y - 4 else 2])
        for (a, b) in ((0, -11), (0, 1), (-6, -5), (6, -5), (-4, -9), (4, -9), (-4, -1), (4, -1)): lay.px(x + a, y + b, Rf[3])
    elif kind == 'bell':
        for (a, b, t) in ((-1, -2, 3), (0, -2, 4), (1, -2, 3), (-1, -1, 2), (0, -1, 3), (1, -1, 2), (-1, 0, 1), (1, 0, 1)): lay.px(x + a, y + b, Rf[t])
    elif kind == 'spike':
        h = 7 + 3 * size
        for k in range(h):
            lay.px(x, y - k, Rf[2 if k % 2 else 3]); lay.px(x + (1 if k % 2 else -1), y - k, Rf[3 if k % 2 else 2])
            if k % 3 == 0: lay.px(x + (-1 if k % 2 else 1), y - k, Rf[1])
        lay.px(x, y - h, Rf[4])
    elif kind == 'poppy':
        for (a, b) in lay.ellpts(x, y - 2, 2.6, 2.2):
            lay.px(a, b, Rf[4 if b < y - 3 and a < x else 3 if b < y - 2 else 2])
        lay.px(x, y - 2, R['iron'][1]); lay.px(x - 1, y - 2, R['iron'][2])
    elif kind == 'seed':        # dandelion clock
        for (a, b) in lay.ellpts(x, y - 3, 3, 3):
            if (a + b) % 2 == 0 or abs(a - x) + abs(b - y + 3) < 2: lay.px(a, b, Rf[4 if b < y - 4 else 3])
    elif kind == 'drop':        # snowdrop, hanging
        for (a, b, t) in ((0, -3, 2), (-1, -2, 3), (0, -2, 4), (1, -2, 3), (-1, -1, 3), (0, -1, 3), (1, -1, 2), (0, 0, 2)): lay.px(x + a, y + b, Rf[t] if t else None)
        lay.px(x, y - 3, R['leaf'][2])
    layer_out(cv, lay)


def flower_bed(rng, kind, cols, n=8, W=56, H=30, rx=21, ry=5, hmin=5, hmax=12, Rl=None, size=1, centre=None, lean=False, stems=True):
    G = H - 2; cx = W // 2; Rl = Rl or R['leaf']
    cv = Cv(W, H)
    leaf_base(cv, cx, G, rx, ry, Rl, rng)
    spots = []
    for i in range(n):
        f = (i + .5) / n
        spots.append((cx + int((f - .5) * rx * 1.8) + rng.randint(-2, 2), G - ry - rng.randint(hmin, hmax)))
    rng.shuffle(spots)
    for i, (x, y) in enumerate(spots):
        c = cols[i % len(cols)] if isinstance(cols, list) else cols
        Rf = R[c] if isinstance(c, str) else c
        if stems: stem(cv, x, G - ry, y, Rl, lean=rng.choice([-2, 0, 2]) if lean else 0)
        bloom(cv, kind, x, y, Rf, rng, centre=centre, size=size)
    return cv, cx


def dots(cv, Rd, n, rng, where, r=1, tone=(3, 2)):
    """berries or blossom scattered over foliage: 'where' = list of (x, y) foliage pixels"""
    if not where: return
    lay = Cv(cv.w, cv.h)
    for _ in range(n):
        x, y = rng.choice(where)
        if r == 1:
            lay.px(x, y, Rd[tone[0]]); lay.px(x + 1, y, Rd[tone[1]]); lay.px(x, y + 1, Rd[tone[1]]); lay.px(x + 1, y + 1, Rd[max(0, tone[1] - 1)])
        else:
            for (a, b) in lay.ellpts(x, y, r, r): lay.px(a, b, Rd[sph((a + .5 - x) / r, (b + .5 - y) / r)])
    layer_out(cv, lay)


def foliage_px(cv, pal, below=None):
    cols = set(c for Rr in (pal if isinstance(pal[0], list) else [pal]) for c in Rr[1:])
    return [(i % cv.w, i // cv.w) for i, c in enumerate(cv.a) if c in cols and (below is None or i // cv.w < below)]


def shrub(rng, blobs, pal, W=72, H=52, cell=6, dot=None, ndots=0, dr=1, floor=0):
    G = H - 2; cx = W // 2
    cv = Cv(W, H)
    for i, (dx, dy, rx, ry, b) in enumerate(blobs):
        blob(cv, cx + dx, G + dy, rx, ry, pal[i % len(pal)] if isinstance(pal[0], list) else pal, rng, cell=cell, bias=b, floor=floor)
    cv.outline()
    if dot: dots(cv, dot, ndots, rng, foliage_px(cv, pal), r=dr)
    return cv, cx


def round_tree(rng, W, H, tpts, blobs, pal, cell=8, bump=.05, dot=None, ndots=0, dr=1):
    cv, cx = oak_tree(rng, W, H, tpts, blobs, list(range(len(blobs))), pal, cell=cell, bump=bump)
    if dot: dots(cv, dot, ndots, rng, foliage_px(cv, pal), r=dr)
    return cv, cx


def tuft(rng, pal, n, hmin, hmax, spread, width=4.4, W=50, H=40, base_t=(1, 2, 3)):
    G = H - 2; cx = W // 2
    cv = Cv(W, H)
    if isinstance(pal[0], list):
        for i, Rr in enumerate(pal): grass_tuft(cv, cx + (i - len(pal) / 2 + .5) * 4, G, n, hmin, hmax, spread, Rr, rng, width=width, base_t=base_t)
    else:
        grass_tuft(cv, cx, G, n, hmin, hmax, spread, pal, rng, width=width, base_t=base_t)
    cv.outline()
    return cv, cx, G


def heads(cv, cx, G, n, spread, hmin, hmax, Rh, rng, kind='pom', size=0):
    for i in range(n):
        f = (i + .5) / n
        x = cx + int((f - .5) * spread) + rng.randint(-1, 1); y = G - rng.randint(hmin, hmax)
        stem(cv, x, G, y, R['leaf'])
        bloom(cv, kind, x, y, Rh, rng, size=size)


# ============================================================================= FLOWERS
@nat('tulips_red', 'Red tulips', 0, 0.5, ['route', 'town', 'farm'], group='tulips', grow='gfl', weight=.8)
def p_tulips_red(rng): return flower_bed(rng, 'cup', 'red', n=8, hmin=6, hmax=12)


@nat('tulips_yellow', 'Yellow tulips', 0, 0.5, ['route', 'town', 'farm'], group='tulips', grow='gfl', weight=.8)
def p_tulips_yellow(rng): return flower_bed(rng, 'cup', 'yellow', n=8, hmin=6, hmax=12)


@nat('tulips_pink', 'Pink tulips', 0, 0.5, ['route', 'town', 'farm'], group='tulips', grow='gfl', weight=.8)
def p_tulips_pink(rng): return flower_bed(rng, 'cup', ['pink', 'white'], n=8, hmin=6, hmax=12)


@nat('daisies', 'Daisies', 0, 0.6, ['route', 'town', 'farm'], group='daisies', grow='gGfl', weight=1.4)
def p_daisies(rng): return flower_bed(rng, 'daisy', 'white', n=9, hmin=4, hmax=9, W=60, rx=24)


@nat('bluebells', 'Bluebells', 0, 0.6, ['route', 'forest'], group='bluebells', grow='gGy', weight=1.2)
def p_bluebells(rng): return flower_bed(rng, 'bell', 'blue', n=10, hmin=5, hmax=11, W=60, rx=24, lean=True)


@nat('poppies', 'Poppies', 0, 0.7, ['route', 'farm'], group='poppies', grow='gGfo', weight=1.0)
def p_poppies(rng): return flower_bed(rng, 'poppy', 'red', n=8, hmin=8, hmax=15, H=34, lean=True)


@nat('sunflowers', 'Sunflowers', 0.3, 0.4, ['farm', 'route', 'town'], group='sunflowers', grow='gof', weight=.4, solid=0.2)
def p_sunflowers(rng):
    cv, cx = flower_bed(rng, 'disc', 'gold', n=4, hmin=22, hmax=36, W=60, H=62, rx=20, ry=5, Rl=R['oak'])
    G = 60
    for x in (cx - 14, cx - 2, cx + 11):           # big leaves on the stems
        for (a, b) in cv.ellpts(x + 3, G - 18, 4, 2.5): cv.px(a, b, R['oak'][3 if b < G - 18 else 2])
    cv.outline()
    return cv, cx


@nat('lavender', 'Lavender', 0.1, 0.5, ['route', 'town', 'farm'], group='lavender', grow='gfls', weight=1.0)
def p_lavender(rng): return flower_bed(rng, 'spike', 'lilac', n=11, hmin=9, hmax=15, W=60, H=36, rx=24, Rl=R['sage'], lean=True)


@nat('foxgloves', 'Foxgloves', 0.1, 0.5, ['route', 'forest'], group='foxgloves', grow='gGy', weight=.7)
def p_foxgloves(rng): return flower_bed(rng, 'spike', ['pink', 'lilac', 'white'], n=5, hmin=14, hmax=24, W=56, H=48, rx=18, size=2)


@nat('lupins', 'Lupins', 0.1, 0.5, ['route', 'mountains'], group='lupins', grow='gGr', weight=.7)
def p_lupins(rng): return flower_bed(rng, 'spike', ['plum', 'blue', 'pink'], n=6, hmin=12, hmax=22, W=56, H=46, rx=18, size=2)


@nat('dandelions', 'Dandelions', 0, 0.5, ['route', 'town', 'farm', 'city'], group='dandelions', grow='gGflv', weight=1.6)
def p_dandelions(rng): return flower_bed(rng, 'pom', 'yellow', n=7, hmin=4, hmax=10, size=0)


@nat('dandelion_clocks', 'Dandelion clocks', 0, 0.6, ['route', 'town', 'farm'], group='dandelions', grow='gGflv', weight=1.0)
def p_dandelion_clocks(rng): return flower_bed(rng, 'seed', 'snowc', n=6, hmin=6, hmax=12, H=32)


@nat('clover_white', 'White clover', 0, 0.4, ['route', 'town', 'farm'], group='clover', grow='gGl', weight=1.4)
def p_clover_white(rng): return flower_bed(rng, 'pom', 'white', n=9, hmin=2, hmax=5, W=60, H=26, rx=25, ry=6, Rl=R['deep'], size=0)


@nat('buttercups', 'Buttercups', 0, 0.6, ['route', 'farm'], group='buttercups', grow='gGfo', weight=1.5)
def p_buttercups(rng): return flower_bed(rng, 'star', 'gold', n=12, hmin=4, hmax=10, W=60, rx=24, centre=R['orange'][3])


@nat('cornflowers', 'Cornflowers', 0, 0.6, ['route', 'farm'], group='cornflowers', grow='gGfo', weight=1.0)
def p_cornflowers(rng): return flower_bed(rng, 'star', 'blue', n=10, hmin=8, hmax=14, H=34, Rl=R['sage'], centre=R['plum'][3], lean=True)


@nat('marigolds', 'Marigolds', 0, 0.5, ['town', 'farm', 'route'], group='marigolds', grow='gfl', weight=.8)
def p_marigolds(rng): return flower_bed(rng, 'pom', ['orange', 'gold'], n=8, hmin=3, hmax=8, size=0)


@nat('snowdrops', 'Snowdrops', 0, 0.5, ['snow', 'route', 'forest'], group='snowdrops', grow='ngy', weight=1.2)
def p_snowdrops(rng): return flower_bed(rng, 'drop', 'snowc', n=8, hmin=5, hmax=9, W=48, H=24, rx=17, ry=3, Rl=R['deep'])


@nat('crocuses', 'Crocuses', 0, 0.4, ['snow', 'route', 'town'], group='crocuses', grow='ngl', weight=1.0)
def p_crocuses(rng): return flower_bed(rng, 'cup', ['lilac', 'yellow', 'white'], n=9, hmin=2, hmax=5, W=52, H=24, rx=20, ry=3, Rl=R['deep'])


# ============================================================================= GROUND COVER
@nat('tussock', 'Tussock', 0.3, 0.9, ['route', 'mountains', 'farm'], group='tussock', family='ground', grow='gGro', weight=1.4)
def p_tussock(rng):
    cv, cx, G = tuft(rng, [R['dry'], R['leafy'], R['hay']], 7, 10, 20, 30, W=58, H=34, width=3.8)
    return cv, cx


@nat('sedge', 'Sedge', 0.25, 1.0, ['route', 'water'], group='sedge', family='ground', grow='gGw', weight=1.0)
def p_sedge(rng):
    cv, cx, G = tuft(rng, R['deep'], 14, 18, 30, 24, W=48, H=42, width=3.2)
    return cv, cx


@nat('wild_wheat', 'Wild wheat', 0.3, 1.0, ['farm', 'route'], group='wild_wheat', family='ground', grow='gGo', weight=1.0)
def p_wild_wheat(rng):
    cv, cx, G = tuft(rng, R['hay'], 11, 20, 32, 28, W=52, H=46, width=3.4)
    for i in range(7):                                 # heads: a short stack of gold grains
        x = cx + int((i + .5) / 7 * 26 - 13) + rng.randint(-1, 1); y = G - rng.randint(26, 36)
        stem(cv, x, G - 14, y, R['hay'])
        lay = Cv(cv.w, cv.h)
        for k in range(5): lay.px(x + (k % 2) - 0, y - k, R['gold'][3 if k % 2 else 2]); lay.px(x - 1 + (k % 2), y - k, R['gold'][2])
        layer_out(cv, lay)
    return cv, cx


@nat('dry_grass', 'Dry grass', 0.25, 0.9, ['desert', 'canyon', 'route'], group='dry_grass', family='ground', grow='svu', weight=1.4)
def p_dry_grass(rng):
    cv, cx, G = tuft(rng, [R['dry'], R['hay']], 9, 10, 22, 30, W=54, H=36, width=3.6)
    return cv, cx


@nat('bracken', 'Bracken', 0.3, 0.7, ['forest', 'route'], group='bracken', family='ground', grow='ygG', weight=1.2)
def p_bracken(rng):
    W, H = 64, 40; G = H - 2; cx = 32
    cv = Cv(W, H)
    for a, L in ((-2.8, 22), (-2.3, 28), (-1.9, 30), (-1.5, 31), (-1.1, 28), (-.7, 24), (-.3, 18)):
        frond(cv, cx + rng.randint(-3, 3), G, a, L, R['leafy'] if rng.random() < .6 else R['lime'], rng, 2.8)
    cv.outline()
    return cv, cx


@nat('thistles', 'Thistles', 0.2, 0.6, ['route', 'farm', 'mountains'], group='thistles', family='ground', grow='gGrov', weight=.9)
def p_thistles(rng):
    cv, cx, G = tuft(rng, R['sage'], 8, 8, 16, 26, W=52, H=42, width=4.0)
    heads(cv, cx, G, 5, 24, 18, 30, R['plum'], rng, kind='pom', size=0)
    return cv, cx


@nat('heather', 'Heather', 0.2, 0.3, ['mountains', 'route'], group='heather', family='ground', grow='grn', weight=1.2)
def p_heather(rng):
    cv, cx = shrub(rng, ((-14, -6, 12, 7, .02), (12, -5, 13, 6, -.03), (0, -8, 14, 7, .04)), R['deep'], W=64, H=30, cell=5, dot=R['lilac'], ndots=26)
    return cv, cx


@nat('moss_patch', 'Moss patch', 0, 0, ['forest', 'route', 'cave'], flat=1, group='moss_patch', family='ground', grow='ygGk', weight=1.0)
def p_moss_patch(rng):
    W, H = 56, 30; cx = 28
    cv = Cv(W, H)
    for (x, y) in set(cv.ellpts(28, 15, 24, 10) + cv.ellpts(16, 12, 12, 7)):
        cv.px(x, y, R['moss'][3 if (x * 7 + y * 13) % 11 < 3 else 2 if (x + y) % 5 else 1])
    return cv, cx


@nat('clover_patch', 'Clover patch', 0, 0, ['route', 'town', 'farm'], flat=1, group='clover', family='ground', grow='gGl', weight=1.2)
def p_clover_patch(rng):
    W, H = 56, 28; cx = 28
    cv = Cv(W, H)
    for _ in range(26):
        a = rng.uniform(0, 6.28); r = rng.random() ** .6
        x = int(28 + math.cos(a) * 24 * r); y = int(14 + math.sin(a) * 11 * r)
        for (dx, dy, t) in ((0, -1, 3), (-1, 0, 3), (1, 0, 2), (0, 0, 2), (0, 1, 1)): cv.px(x + dx, y + dy, R['deep'][t])
    return cv, cx


@nat('nettles', 'Nettles', 0.25, 0.6, ['route', 'forest', 'farm', 'junk'], group='nettles', family='ground', grow='gGyx', weight=1.0)
def p_nettles(rng):
    W, H = 56, 42; G = H - 2; cx = 28
    cv = Cv(W, H)
    lay = Cv(W, H)
    for i in range(4):
        x = cx + int((i + .5) / 4 * 40 - 20) + rng.randint(-1, 1); h = rng.randint(22, 34)
        for y in range(G - h, G + 1): lay.px(x, y, R['leaf'][1])
        for k in range(5, h - 2, 8):
            for s in (-1, 1):
                yy = G - k - (3 if s > 0 else 0)
                for (a, b, t) in ((1, 0, 3), (2, 0, 3 if s < 0 else 2), (3, 0, 2), (4, -1, 2), (2, -1, 3), (3, -1, 3 if s < 0 else 2), (3, 1, 1), (2, 1, 2), (5, -1, 1)):
                    lay.px(x + s * a, yy + b, R['leaf'][t])
        for k in range(4): lay.px(x + (k % 2), G - h - k, R['lime'][2 if k % 2 else 3]); lay.px(x - 1 + (k % 2), G - h - k, R['lime'][1])
    layer_out(cv, lay)
    return cv, cx


@nat('horsetail', 'Horsetail', 0.15, 0.7, ['water', 'route'], group='horsetail', family='ground', grow='gwu', weight=.8)
def p_horsetail(rng):
    W, H = 44, 44; G = H - 2; cx = 22
    cv = Cv(W, H)
    for i in range(9):
        x = cx + int((i + .5) / 9 * 32 - 16) + rng.randint(-1, 1); h = rng.randint(22, 38)
        for y in range(G - h, G + 1):
            cv.px(x, y, R['lime'][3 if (G - y) % 6 == 0 else 2]); cv.px(x + 1, y, R['lime'][1 if (G - y) % 6 == 0 else 2])
        for k in range(6, h, 7):
            cv.px(x - 1, G - k, R['lime'][3]); cv.px(x + 2, G - k, R['lime'][1]); cv.px(x - 2, G - k + 1, R['lime'][2]); cv.px(x + 3, G - k + 1, R['lime'][1])
    cv.outline()
    return cv, cx


@nat('grass_snow', 'Snowy grass', 0.2, 0.8, ['snow', 'mountains'], group='grass_snow', family='ground', grow='n', weight=1.4)
def p_grass_snow(rng):
    cv, cx, G = tuft(rng, R['dry'], 11, 14, 24, 28, W=50, H=38, width=4.0)
    lay = Cv(cv.w, cv.h)
    for x in range(cv.w):
        for y in range(cv.h):
            c = cv.get(x, y)
            if c is not None and cv.get(x, y - 1) is None and y < G - 4: lay.px(x, y, R['snowc'][4]); lay.px(x, y + 1, R['snowc'][2])
    cv.paste(lay)
    return cv, cx


# ============================================================================= SHRUBS
@nat('bush_hawthorn', 'Hawthorn in blossom', 0.6, 0.25, ['route', 'farm', 'town'], group='bush_hawthorn', family='shrubs', grow='gGo', weight=1.0, solid=0.55, vol=['puff', .55])
def p_bush_hawthorn(rng):
    return shrub(rng, ((-12, -16, 16, 14, .04), (12, -14, 15, 13, -.02), (0, -22, 14, 11, .06), (0, -9, 22, 9, -.05)), R['oak'], W=84, H=62, dot=R['white'], ndots=34)


@nat('bush_bramble', 'Bramble', 0.45, 0.3, ['route', 'forest', 'farm', 'junk'], group='bush_bramble', family='shrubs', grow='gGyx', weight=1.0, solid=0.5, vol=['puff', .5])
def p_bush_bramble(rng):
    return shrub(rng, ((-16, -8, 16, 8, .02), (14, -7, 15, 7, -.03), (0, -12, 18, 8, .05), (-6, -4, 24, 5, -.05)), R['deep'], W=84, H=40, cell=5, dot=R['berry'], ndots=18, dr=1)


@nat('bush_juniper', 'Juniper', 0.5, 0.15, ['mountains', 'route', 'snow'], group='bush_juniper', family='shrubs', grow='grn', weight=1.0, solid=0.5, vol=['puff', .5])
def p_bush_juniper(rng):
    return shrub(rng, ((-14, -8, 14, 8, .03), (12, -7, 13, 7, -.02), (-2, -14, 15, 9, .06), (6, -4, 20, 5, -.05)), R['pine'], W=76, H=40, cell=5, dot=R['sky'], ndots=6)


@nat('bush_box', 'Box ball', 0.45, 0.1, ['town', 'farm'], group='bush_box', family='shrubs', grow='l', weight=.6, solid=0.45, vol=['puff', .45])
def p_bush_box(rng):
    return shrub(rng, ((0, -15, 15, 15, .02),), R['deep'], W=48, H=38, cell=4, floor=1)


@nat('bush_holly', 'Holly', 0.6, 0.15, ['route', 'forest', 'snow', 'town'], group='bush_holly', family='shrubs', grow='gGyn', weight=.8, solid=0.5, vol=['puff', .5])
def p_bush_holly(rng):
    return shrub(rng, ((-10, -20, 13, 12, .04), (10, -18, 13, 12, -.02), (0, -30, 10, 9, .06), (0, -9, 18, 8, -.05)), R['pine'], W=66, H=64, cell=6, dot=R['red'], ndots=14)


@nat('bush_rhododendron', 'Rhododendron', 0.7, 0.2, ['route', 'forest', 'town', 'mountains'], group='bush_rhododendron', family='shrubs', grow='gGyr', weight=.7, solid=0.6, vol=['puff', .6])
def p_bush_rhododendron(rng):
    return shrub(rng, ((-16, -16, 18, 14, .04), (16, -15, 17, 13, -.02), (0, -24, 16, 12, .06), (0, -9, 26, 9, -.05)), R['deep'], W=92, H=64, cell=7, dot=R['pink'], ndots=12, dr=2.6)


@nat('bush_rosemary', 'Rosemary', 0.4, 0.3, ['town', 'farm', 'desert', 'route'], group='bush_rosemary', family='shrubs', grow='lsgv', weight=.8, solid=0.4, vol=['puff', .4])
def p_bush_rosemary(rng):
    cv, cx = shrub(rng, ((-10, -10, 12, 9, .03), (10, -9, 12, 8, -.02), (0, -15, 11, 8, .05)), R['sage'], W=60, H=40, cell=4, dot=R['lav'], ndots=14)
    return cv, cx


@nat('bush_roses', 'Wild roses', 0.5, 0.25, ['route', 'town', 'farm'], group='bush_roses', family='shrubs', grow='gGl', weight=.8, solid=0.5, vol=['puff', .5])
def p_bush_roses(rng):
    cv, cx = shrub(rng, ((-14, -12, 16, 11, .04), (14, -11, 15, 10, -.02), (0, -18, 15, 10, .06), (0, -7, 24, 7, -.05)), R['leaf'], W=84, H=52, cell=6)
    for (x, y) in rng.sample(foliage_px(cv, R['leaf']), 10):
        bloom(cv, 'star', x, y + 1, R['pink'], rng)
    return cv, cx


# ============================================================================= TREES
def tp_single(cx, w0, w1, h): return [(cx - w0, 1), (cx - w1, -h), (cx + w1, -h), (cx + w0, 1)]


@nat('tree_rowan', 'Rowan', 1.0, 0.4, ['route', 'mountains', 'town'], group='tree_rowan', family='trees', grow='gGr', weight=1.0, solid=0.35)
def p_tree_rowan(rng):
    W, H = 120, 128; cx = 60
    return round_tree(rng, W, H, tp_single(cx, 7, 4, 70), [(cx, 44, 30, 22, 0), (cx - 26, 56, 20, 15, .03), (cx + 26, 54, 20, 15, -.04), (cx, 26, 20, 14, .06)], R['leafy'], cell=7, dot=R['red'], ndots=22, dr=1.8)


@nat('tree_poplar', 'Poplar', 0.7, 0.45, ['route', 'farm', 'town'], group='tree_poplar', family='trees', grow='gGo', weight=.8, solid=0.3)
def p_tree_poplar(rng):
    W, H = 72, 176; cx = 36
    blobs = [(cx, 118, 16, 22, 0), (cx, 86, 18, 22, .03), (cx, 54, 16, 20, .04), (cx, 26, 11, 16, .07), (cx, 10, 6, 8, .1)]
    return round_tree(rng, W, H, tp_single(cx, 6, 3, 60), blobs, R['leafy'], cell=7)


@nat('tree_beech', 'Beech', 1.5, 0.35, ['route', 'forest', 'town'], group='tree_beech', family='trees', grow='gGy', weight=1.0, solid=0.5)
def p_tree_beech(rng):
    W, H = 190, 160; cx = 95
    tp = [(cx - 13, 1), (cx - 8, -40), (cx - 30, -80), (cx - 24, -84), (cx - 2, -56), (cx + 6, -86), (cx + 12, -82), (cx + 8, -40), (cx + 14, 1)]
    blobs = [(cx, 50, 50, 28, 0), (cx - 52, 64, 32, 22, .03), (cx + 54, 62, 32, 22, -.04), (cx - 24, 30, 30, 20, .06), (cx + 26, 28, 30, 20, .03), (cx, 16, 22, 14, .08)]
    return round_tree(rng, W, H, tp, blobs, R['oak'], cell=9)


@nat('tree_hazel', 'Hazel', 0.8, 0.4, ['route', 'forest', 'farm'], group='tree_hazel', family='trees', grow='gGyo', weight=1.0, solid=0.35)
def p_tree_hazel(rng):
    W, H = 110, 96; G = H - 2; cx = 55
    cv = Cv(W, H)
    tr = Cv(W, H)
    for (a, b) in ((-14, -40), (-5, -46), (6, -44), (15, -38)):          # several thin stems from the ground
        trunk(tr, [(cx + a - 3, G + 1), (cx + a * 1.6 - 2, G + b), (cx + a * 1.6 + 2, G + b), (cx + a + 3, G + 1)], R['bark'], rng, streaks=False)
    tr.outline(); cv.paste(tr)
    fol = Cv(W, H)
    for (bx, by, rx, ry, b) in ((cx - 22, 40, 22, 16, .03), (cx + 22, 38, 22, 16, -.03), (cx, 26, 26, 16, .06), (cx, 52, 34, 12, -.04)):
        blob(fol, bx, by, rx, ry, R['leafy'], rng, cell=7, bias=b)
    fol.outline(); cv.paste(fol)
    return cv, cx


@nat('tree_olive', 'Olive tree', 0.9, 0.3, ['desert', 'canyon', 'town', 'route'], group='tree_olive', family='trees', grow='svl', weight=.8, solid=0.4)
def p_tree_olive(rng):
    W, H = 120, 104; cx = 60
    tp = [(cx - 12, 1), (cx - 7, -24), (cx - 24, -50), (cx - 18, -54), (cx - 1, -34), (cx + 8, -56), (cx + 14, -52), (cx + 8, -26), (cx + 13, 1)]
    blobs = [(cx, 42, 34, 20, 0), (cx - 34, 52, 20, 14, .03), (cx + 36, 50, 20, 14, -.04), (cx - 10, 26, 22, 14, .06), (cx + 18, 28, 20, 13, .03)]
    return round_tree(rng, W, H, tp, blobs, R['olive'], cell=6, bump=.08)


@nat('tree_cypress', 'Cypress', 0.6, 0.25, ['town', 'desert', 'route'], group='tree_cypress', family='trees', grow='lsv', weight=.6, solid=0.3)
def p_tree_cypress(rng):
    W, H = 56, 170; cx = 28
    blobs = [(cx, 130, 13, 26, 0), (cx, 92, 14, 26, .03), (cx, 56, 12, 24, .04), (cx, 26, 8, 18, .07), (cx, 8, 4, 8, .1)]
    return round_tree(rng, W, H, tp_single(cx, 5, 3, 20), blobs, R['pine'], cell=6)


@nat('tree_elm', 'Elm', 1.5, 0.35, ['route', 'town', 'farm'], group='tree_elm', family='trees', grow='gGl', weight=.8, solid=0.5)
def p_tree_elm(rng):
    W, H = 170, 180; cx = 85
    tp = [(cx - 12, 1), (cx - 8, -50), (cx - 40, -100), (cx - 34, -106), (cx - 2, -70), (cx + 4, -110), (cx + 12, -104), (cx + 8, -50), (cx + 13, 1)]
    blobs = [(cx, 60, 44, 26, 0), (cx - 54, 70, 26, 20, .03), (cx + 54, 66, 26, 20, -.04), (cx - 28, 36, 30, 20, .06), (cx + 28, 34, 30, 20, .03), (cx, 16, 26, 16, .08)]
    return round_tree(rng, W, H, tp, blobs, R['leaf'], cell=9)


@nat('tree_chestnut', 'Horse chestnut', 1.6, 0.3, ['route', 'town', 'forest'], group='tree_chestnut', family='trees', grow='gGyl', weight=.8, solid=0.5)
def p_tree_chestnut(rng):
    W, H = 190, 164; cx = 95
    tp = [(cx - 14, 1), (cx - 10, -46), (cx - 28, -78), (cx - 22, -82), (cx - 2, -60), (cx + 8, -84), (cx + 14, -80), (cx + 10, -46), (cx + 15, 1)]
    blobs = [(cx, 56, 52, 30, 0), (cx - 56, 70, 30, 22, .03), (cx + 56, 68, 30, 22, -.04), (cx - 26, 32, 32, 22, .06), (cx + 28, 30, 32, 22, .03), (cx, 14, 24, 16, .08)]
    return round_tree(rng, W, H, tp, blobs, R['oak'], cell=10, dot=R['cream'], ndots=16, dr=1.6)


@nat('tree_larch', 'Larch', 0.8, 0.3, ['mountains', 'snow', 'route'], group='tree_larch', family='trees', grow='rng', weight=1.0, solid=0.35)
def p_tree_larch(rng):
    cv, cx = pine_tree(rng, 96, 150, [(14, 44, 18), (36, 72, 26), (62, 100, 34), (90, 128, 40)], th=130, tw=(6, 3), Rp=R['lime'])
    return cv, cx


@nat('tree_fallen', 'Fallen tree', 0.6, 0, ['forest', 'route'], group='tree_fallen', family='trees', grow='yg', weight=.5, solid=0, vol=['block', .5])
def p_tree_fallen(rng):
    W, H = 140, 44; G = H - 2; cx = 70
    cv = Cv(W, H)
    lay = Cv(W, H)
    pts = [(cx - 62, G - 4), (cx - 58, G - 16), (cx - 20, G - 20), (cx + 30, G - 19), (cx + 60, G - 14), (cx + 64, G - 2), (cx + 30, G), (cx - 30, G)]
    for (x, y) in lay.polypts(pts):
        t = 3 if y < G - 15 else 2 if y < G - 9 else 1 if y < G - 4 else 0
        if (x * 3 + y) % 17 == 0: t = max(0, t - 1)
        lay.px(x, y, R['bark'][t])
    for (x, y) in lay.ellpts(cx + 62, G - 9, 5, 8): lay.px(x, y, R['plank'][3 if (x + y) % 3 else 2])      # the cut end
    layer_out(cv, lay)
    for (x, y, rx, ry) in ((cx - 40, G - 18, 12, 4), (cx + 4, G - 20, 16, 4), (cx + 38, G - 17, 9, 3)):
        lay = Cv(W, H)
        for (a, b) in lay.ellpts(x, y, rx, ry): lay.px(a, b, R['moss'][3 if b < y else 2])
        layer_out(cv, lay)
    for (x, y) in ((cx - 50, G - 8), (cx - 10, G - 6), (cx + 20, G - 5)): bloom(cv, 'pom', x, y, R['cream'], rng, size=0)   # little bracket fungi
    return cv, cx


# ============================================================================= WATER PLANTS
def iris(rng, col):
    W, H = 52, 44; G = H - 2; cx = 26
    cv = Cv(W, H)
    grass_tuft(cv, cx, G, 9, 18, 30, 24, R['deep'], rng, width=3.6)
    cv.outline()
    for i in range(4):
        x = cx + int((i + .5) / 4 * 22 - 11) + rng.randint(-1, 1); y = G - rng.randint(26, 36)
        stem(cv, x, G - 10, y, R['deep'])
        lay = Cv(W, H)
        for (a, b, t) in ((0, -4, 4), (-1, -3, 3), (1, -3, 3), (-2, -2, 2), (2, -2, 2), (0, -2, 3), (-1, -1, 2), (1, -1, 2), (0, -1, 3), (0, 0, 1), (-2, 0, 1), (2, 0, 1)):
            lay.px(x + a, y + b, R[col][t])
        layer_out(cv, lay)
    return cv, cx


@nat('iris_yellow', 'Yellow iris', 0.15, 0.6, ['water', 'route'], group='iris', family='water', grow='wg', weight=1.0)
def p_iris_yellow(rng): return iris(rng, 'yellow')


@nat('iris_purple', 'Purple iris', 0.15, 0.6, ['water', 'route'], group='iris', family='water', grow='wg', weight=.8)
def p_iris_purple(rng): return iris(rng, 'plum')


@nat('bulrush', 'Bulrushes', 0.25, 0.9, ['water'], group='reeds', family='water', grow='w', weight=1.2)
def p_bulrush(rng):
    W, H = 50, 64; G = H - 2; cx = 25
    cv = Cv(W, H)
    grass_tuft(cv, cx, G, 9, 24, 40, 26, R['deep'], rng, width=3.2)
    cv.outline()
    for i in range(5):
        x = cx + int((i + .5) / 5 * 22 - 11) + rng.randint(-1, 1); y = G - rng.randint(42, 58)
        stem(cv, x, G - 20, y, R['deep'])
        lay = Cv(W, H)
        for k in range(9): lay.px(x, y + k, R['brown'][3 if k < 3 else 2]); lay.px(x + 1, y + k, R['brown'][1]); lay.px(x - 1, y + k, R['brown'][2])
        lay.px(x, y - 1, R['brown'][1]); lay.px(x, y - 2, R['brown'][1])
        layer_out(cv, lay)
    return cv, cx


@nat('duckweed', 'Duckweed', 0, 0, ['water'], flat=1, group='duckweed', family='water', grow='wd', weight=1.0)
def p_duckweed(rng):
    W, H = 60, 30; cx = 30
    cv = Cv(W, H)
    for _ in range(60):
        a = rng.uniform(0, 6.28); r = rng.random() ** .5
        x = int(30 + math.cos(a) * 27 * r); y = int(15 + math.sin(a) * 12 * r)
        cv.px(x, y, R['duck'][3]); cv.px(x + 1, y, R['duck'][2])
    return cv, cx


@nat('lilypad', 'Lily pad', 0, 0.2, ['water'], flat=1, group='pond_lily', family='water', grow='wd', weight=1.2)
def p_lilypad(rng):
    W, H = 30, 20; cx = 15; px_, py_, rx, ry = 15, 10, 12, 6
    cv = Cv(W, H)
    for (x, y) in cv.ellpts(px_, py_, rx, ry):
        a = math.atan2((y + .5 - py_) / ry, (x + .5 - px_) / rx)
        if abs(a - .8) < .3: continue
        nx = (x + .5 - px_) / rx; ny = (y + .5 - py_) / ry
        t = 3 if ny < -.3 else 2 if ny < .5 else 1
        if nx > .7: t -= 1
        cv.px(x, y, R['leaf'][max(0, t)])
    cv.outline()
    return cv, cx


def lotus(rng, Rp):
    W, H = 44, 26; cx = 22
    cv = Cv(W, H)
    for (px_, py_, rx, ry) in ((cx - 10, 14, 10, 5), (cx + 11, 15, 9, 4.5)):
        for (x, y) in cv.ellpts(px_, py_, rx, ry):
            ny = (y + .5 - py_) / ry; cv.px(x, y, R['leaf'][3 if ny < -.3 else 2 if ny < .5 else 1])
    cv.outline()
    lay = Cv(W, H); fx, fy = cx, 12
    for (dx, dy, t) in ((-5, 0, 2), (5, 0, 1), (-4, -1, 3), (4, -1, 2), (-3, -3, 3), (3, -3, 2), (-2, -5, 4), (2, -5, 3), (0, -6, 4), (-1, -6, 4), (1, -6, 3),
                        (-2, 1, 2), (2, 1, 1), (0, 1, 2), (-1, 1, 2), (1, 1, 1), (-3, -1, 3), (3, -1, 2), (-2, -2, 3), (2, -2, 3), (-1, -3, 4), (1, -3, 3), (0, -4, 4), (0, -2, 3), (-1, -1, 3), (1, -1, 3), (0, 0, 2), (-1, 0, 2), (1, 0, 2), (0, -1, 3), (-2, -4, 3), (2, -4, 3), (-3, -2, 3), (3, -2, 2)):
        lay.px(fx + dx, fy + dy, Rp[t])
    lay.px(fx, fy - 1, R['yellow'][4]); lay.px(fx - 1, fy - 1, R['gold'][3])
    layer_out(cv, lay)
    return cv, cx


@nat('lotus_pink', 'Pink lotus', 0, 0.2, ['water'], flat=1, group='pond_lily', family='water', grow='wd', weight=.8)
def p_lotus_pink(rng): return lotus(rng, R['pink'])


@nat('lotus_white', 'White lotus', 0, 0.2, ['water'], flat=1, group='pond_lily', family='water', grow='wd', weight=.8)
def p_lotus_white(rng): return lotus(rng, R['white'])


@nat('marsh_marigold', 'Marsh marigolds', 0, 0.5, ['water', 'route'], group='marsh_marigold', family='water', grow='wg', weight=1.0)
def p_marsh_marigold(rng): return flower_bed(rng, 'pom', 'gold', n=7, hmin=4, hmax=9, W=52, H=28, rx=19, ry=6, Rl=R['deep'], size=0)


@nat('water_mint', 'Water mint', 0, 0.5, ['water', 'route'], group='water_mint', family='water', grow='wg', weight=.9)
def p_water_mint(rng): return flower_bed(rng, 'pom', 'lilac', n=8, hmin=6, hmax=12, W=52, H=30, rx=19, ry=5, Rl=R['mint'], size=0)


# ============================================================================= ROCKS AND GROUND
@nat('boulder_lichen', 'Lichen boulder', 0.9, 0, ['route', 'mountains', 'canyon'], group='boulder', family='rocks', grow='grsv', weight=.6, solid=1.0)
def p_boulder_lichen(rng):
    cv, cx = rock_pile(rng, 80, 56, ((0, 30, 24), (-30, 10, 7), (26, 8, 5)), R['rock'])
    dots(cv, R['lichen'], 16, rng, [(x, y) for (x, y) in foliage_px(cv, R['rock']) if y < 40], r=1.6, tone=(3, 2))
    dots(cv, R['moss'], 8, rng, [(x, y) for (x, y) in foliage_px(cv, R['rock']) if y > 36], r=1.2)
    return cv, cx


@nat('stones_flat', 'Flat stones', 0, 0, ['route', 'mountains', 'water', 'town'], flat=1, group='stones_flat', family='rocks', grow='grsvw', weight=1.0)
def p_stones_flat(rng):
    W, H = 60, 30; cx = 30
    cv = Cv(W, H)
    for _ in range(9):
        x = rng.randint(6, 54); y = rng.randint(4, 25); rx = rng.uniform(3, 6); ry = rx * rng.uniform(.5, .8)
        lay = Cv(W, H)
        for (xx, yy) in lay.ellpts(x, y, rx, ry): lay.px(xx, yy, R['stone'][3 if yy < y - ry * .4 else 2 if xx < x + rx * .4 else 1])
        layer_out(cv, lay)
    return cv, cx


@nat('scree', 'Scree', 0.3, 0, ['mountains', 'canyon', 'snow'], group='scree', family='rocks', grow='rsn', weight=1.0)
def p_scree(rng):
    return rock_pile(rng, 80, 30, ((-28, 7, 5), (-14, 9, 6), (2, 8, 5), (16, 10, 7), (30, 6, 4), (-6, 5, 3), (24, 5, 3)), R['cave'])


@nat('molehill', 'Molehill', 0.2, 0, ['route', 'farm', 'town'], group='molehill', family='rocks', grow='gGlo', weight=.8)
def p_molehill(rng):
    W, H = 30, 18; G = H - 2; cx = 15
    cv = Cv(W, H)
    for (x, y) in cv.ellpts(cx, G - 1, 12, 7):
        if y > G: continue
        nx = (x + .5 - cx) / 12; ny = (y + .5 - G + 1) / 7
        cv.px(x, y, R['soil'][max(0, min(4, sph(nx, ny) - (1 if (x * 5 + y * 3) % 7 == 0 else 0)))])
    cv.outline()
    return cv, cx


@nat('roots', 'Exposed roots', 0.3, 0, ['forest', 'route'], group='roots', family='rocks', grow='yg', weight=.6)
def p_roots(rng):
    W, H = 76, 30; G = H - 2; cx = 38
    cv = Cv(W, H)
    for (x0, x1, h, w) in ((cx - 34, cx - 4, 10, 5), (cx - 10, cx + 20, 8, 4), (cx + 6, cx + 36, 11, 5), (cx - 22, cx + 8, 5, 3)):
        lay = Cv(W, H)
        for x in range(x0, x1 + 1):
            f = (x - x0) / (x1 - x0); y = G - h * math.sin(f * math.pi)
            for k in range(w):
                lay.px(x, int(y) + k, R['bark'][3 if k == 0 else 2 if k < w - 1 else 1])
        layer_out(cv, lay)
    return cv, cx


# ============================================================================= SEASON VARIANTS
@nat('tree_rowan_autumn', 'Rowan in autumn', 1.0, 0.4, ['route', 'mountains', 'town'], group='tree_rowan', family='seasons', grow='gGr', weight=.5, solid=0.35)
def p_tree_rowan_autumn(rng):
    W, H = 120, 128; cx = 60
    return round_tree(rng, W, H, tp_single(cx, 7, 4, 70), [(cx, 44, 30, 22, 0), (cx - 26, 56, 20, 15, .03), (cx + 26, 54, 20, 15, -.04), (cx, 26, 20, 14, .06)], R['rustleaf'], cell=7, dot=R['red'], ndots=26, dr=1.8)


@nat('tree_beech_autumn', 'Beech in autumn', 1.5, 0.35, ['route', 'forest', 'town'], group='tree_beech', family='seasons', grow='gGy', weight=.5, solid=0.5)
def p_tree_beech_autumn(rng):
    W, H = 190, 160; cx = 95
    tp = [(cx - 13, 1), (cx - 8, -40), (cx - 30, -80), (cx - 24, -84), (cx - 2, -56), (cx + 6, -86), (cx + 12, -82), (cx + 8, -40), (cx + 14, 1)]
    blobs = [(cx, 50, 50, 28, 0), (cx - 52, 64, 32, 22, .03), (cx + 54, 62, 32, 22, -.04), (cx - 24, 30, 30, 20, .06), (cx + 26, 28, 30, 20, .03), (cx, 16, 22, 14, .08)]
    return round_tree(rng, W, H, tp, blobs, [R['rustleaf'], R['orange'], R['rust'], R['goldleaf']], cell=9)


@nat('tree_poplar_autumn', 'Poplar in autumn', 0.7, 0.45, ['route', 'farm', 'town'], group='tree_poplar', family='seasons', grow='gGo', weight=.4, solid=0.3)
def p_tree_poplar_autumn(rng):
    W, H = 72, 176; cx = 36
    blobs = [(cx, 118, 16, 22, 0), (cx, 86, 18, 22, .03), (cx, 54, 16, 20, .04), (cx, 26, 11, 16, .07), (cx, 10, 6, 8, .1)]
    return round_tree(rng, W, H, tp_single(cx, 6, 3, 60), blobs, R['goldleaf'], cell=7)


@nat('tree_hazel_autumn', 'Hazel in autumn', 0.8, 0.4, ['route', 'forest', 'farm'], group='tree_hazel', family='seasons', grow='gGyo', weight=.5, solid=0.35)
def p_tree_hazel_autumn(rng):
    W, H = 110, 96; G = H - 2; cx = 55
    cv = Cv(W, H)
    tr = Cv(W, H)
    for (a, b) in ((-14, -40), (-5, -46), (6, -44), (15, -38)):
        trunk(tr, [(cx + a - 3, G + 1), (cx + a * 1.6 - 2, G + b), (cx + a * 1.6 + 2, G + b), (cx + a + 3, G + 1)], R['bark'], rng, streaks=False)
    tr.outline(); cv.paste(tr)
    fol = Cv(W, H)
    for i, (bx, by, rx, ry, b) in enumerate(((cx - 22, 40, 22, 16, .03), (cx + 22, 38, 22, 16, -.03), (cx, 26, 26, 16, .06), (cx, 52, 34, 12, -.04))):
        blob(fol, bx, by, rx, ry, [R['goldleaf'], R['hay'], R['orange'], R['goldleaf']][i], rng, cell=7, bias=b)
    fol.outline(); cv.paste(fol)
    return cv, cx


@nat('tree_birch_gold', 'Birch in autumn', 0.7, 0.45, ['route', 'forest', 'mountains'], group='tree_birch', family='seasons', grow='gGyr', weight=.5, solid=0.3)
def p_tree_birch_gold(rng):
    W, H = 96, 150; G = H - 2; cx = 48
    cv = Cv(W, H)
    tr = Cv(W, H)
    trunk(tr, [(cx - 5, G + 1), (cx - 3, G - 100), (cx + 3, G - 100), (cx + 5, G + 1)], R['birch'], rng, streaks=False)
    for y in range(G - 96, G, 9):                      # the dark bars on birch bark
        for x in range(cx - 4 + (y // 9) % 3, cx + 2 + (y // 9) % 3): tr.px(x, y, R['iron'][1])
    tr.outline(); cv.paste(tr)
    fol = Cv(W, H)
    for (bx, by, rx, ry, b) in ((cx, 40, 30, 26, 0), (cx - 24, 60, 20, 18, .03), (cx + 24, 58, 20, 18, -.04), (cx, 18, 18, 14, .07)):
        blob(fol, bx, by, rx, ry, R['goldleaf'], rng, cell=6, bias=b, bump=.1)
    fol.outline(); cv.paste(fol)
    return cv, cx


@nat('bush_hawthorn_autumn', 'Hawthorn with haws', 0.6, 0.25, ['route', 'farm', 'town'], group='bush_hawthorn', family='seasons', grow='gGo', weight=.5, solid=0.55, vol=['puff', .55])
def p_bush_hawthorn_autumn(rng):
    return shrub(rng, ((-12, -16, 16, 14, .04), (12, -14, 15, 13, -.02), (0, -22, 14, 11, .06), (0, -9, 22, 9, -.05)), [R['rustleaf'], R['oak'], R['orange'], R['oak']], W=84, H=62, dot=R['berry'], ndots=30)


@nat('seedheads', 'Dry seed heads', 0, 0.7, ['route', 'farm', 'mountains'], group='seedheads', family='seasons', grow='gGrov', weight=.8)
def p_seedheads(rng): return flower_bed(rng, 'pom', ['brown', 'dry'], n=8, hmin=8, hmax=16, H=36, Rl=R['dry'], size=0, lean=True)


@nat('tussock_rust', 'Rust tussock', 0.3, 0.9, ['route', 'mountains', 'farm'], group='tussock', family='seasons', grow='gGro', weight=.6)
def p_tussock_rust(rng):
    cv, cx, G = tuft(rng, [R['rust'], R['dry'], R['rustleaf']], 7, 10, 20, 30, W=58, H=34, width=3.8)
    return cv, cx


# ============================================================================= build
def render(key):
    rng = random.Random(zlib.crc32(key.encode()))
    cv, bx = NAT[key]['fn'](rng)
    return cv, bx, finish(cv, bx, NAT[key]['flat'])


def load_data():
    src = gamedata.js_text(); i = src.index('window.GAMEDATA='); head = src[:i]
    D = json.JSONDecoder().raw_decode(src[i + len('window.GAMEDATA='):])[0]
    return head, D


def save_data(head, D):
    gamedata.save_js(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n')


def build(keys=None, force=False):
    os.makedirs(OUT, exist_ok=True)
    written, meta = [], {}
    for key in NAT:
        if keys and key not in keys: continue
        cv, bx, img = render(key)
        path = os.path.join(OUT, key + '.png')
        if save_png(img, path, force): written.append(key)
        disk = Image.open(path)
        meta[key] = prop_meta(key, cv, bx, disk if disk.size != img.size else img)
        if NAT[key].get('vol'): meta[key]['vol'] = NAT[key]['vol']
        meta[key]['family'] = GROWTH[key]['family']; meta[key]['grow'] = GROWTH[key]['grow']; meta[key]['weight'] = GROWTH[key]['weight']
    # props.json: add what is missing, never touch an entry that is there (it may have been edited)
    P = json.load(open(META)) if os.path.exists(META) else {}
    added = []
    for k, m in meta.items():
        if k not in P or force: P[k] = m; added.append(k)
    write_json(META, P)
    # game data catalogue
    head, D = load_data(); cat = D['scenery']['props']; cadd = []
    for k, m in meta.items():
        if k in cat and not force: continue
        e = dict(name=m['name'], img='scene/props/%s.png' % k, ox=m['ox'], oy=m['oy'], shadow=m['shadow'], sway=m['sway'], flat=m['flat'], tags=m['tags'], group=m['group'], solid=m.get('solid', 0))
        for f in ('vol', 'family', 'grow', 'weight'):
            if m.get(f) is not None: e[f] = m[f]
        cat[k] = e; cadd.append(k)
    if cadd: save_data(head, D)
    return written, added, cadd


def sheet(path, scale=2):
    keys = list(NAT); imgs = {k: Image.open(os.path.join(OUT, k + '.png')).convert('RGBA') for k in keys}
    fams = {}
    for k in keys: fams.setdefault(GROWTH[k]['family'], []).append(k)
    from PIL import ImageDraw
    rows = []; W = 1900
    for fam, ks in fams.items():
        x = 8; line = []; h = 0
        for k in ks:
            im = imgs[k]; w = im.width * scale + 12
            if x + w > W: rows.append((fam, line, h)); line = []; x = 8; h = 0
            line.append((k, x)); x += w; h = max(h, im.height * scale)
        rows.append((fam, line, h))
    H = sum(h + 34 for _, _, h in rows) + 10
    out = Image.new('RGBA', (W, H), (62, 54, 84, 255)); d = ImageDraw.Draw(out); y = 6
    for fam, line, h in rows:
        d.text((8, y), fam, fill=(240, 236, 220)); y += 14
        for k, x in line:
            im = imgs[k].resize((imgs[k].width * scale, imgs[k].height * scale), Image.NEAREST)
            out.alpha_composite(im, (x, y + h - im.height)); d.text((x, y + h + 2), k, fill=(200, 196, 220))
        y += h + 20
    out.save(path)


if __name__ == '__main__':
    args = sys.argv[1:]; sp = None
    if '--sheet' in args:
        i = args.index('--sheet'); sp = args[i + 1]; del args[i:i + 2]
    force = '--force' in args; args = [a for a in args if a != '--force']
    written, added, cadd = build(args or None, force)
    print('%d nature props; pictures written: %s; props.json entries added: %d; catalogue entries added: %d' % (len(NAT), ', '.join(written) or 'none (all there already)', len(added), len(cadd)))
    if sp: sheet(sp); print('sheet', sp)
