#!/usr/bin/env python3
"""alpha 0.4: the new things the new places are built from, drawn with the scene-prop kit (tools/build-scene-props.py:
the same walls, windows, outlines and ramps as every house in the game), each with its 3D plan where it is a building.
Pictures that are already there are never drawn again (a picture you painted over stays yours); pass --force KEY to
redraw one on purpose.

  Copperleaf Town   cottage_moss      a cottage with a round door, a crooked chimney and a roof of moss
                    cottage_solar     a cottage with a round door under solar shingles
                    cottage_juniper   Granny Juniper's cottage among her beehives (your room is inside)
                    wind_sail_flower  a flower-shaped wind sail: its petals turn in the wind
                    banner_bunting    bunting strung between two posts (it flutters)
  Airships          airship_mast      a lattice mooring mast with an airship moored at the top (every town has one; tap it
                                      to fly back to a town you've been to); sky_lift, the way up from a town under the
                                      ground; map/airship.png, the airship that flies you over the world map
                    tree_giant_swing  the great oak with a rope swing (the oak's own picture; the swing is a layer of
                                      its own that swings from the branch)
  Roofs             two new roof textures for the 3D buildings, Moss and Solar shingles, in a new texture sheet
                    (scene/build/detail-a04.png: the sixteen there were, copied pixel for pixel, and the new ones), which
                    the game data then points at (scenery.buildArt.detail)

    python3 tools/build-props-a04.py                  # draw what is missing, add it to props.json and the game data
    python3 tools/build-props-a04.py --sheet out.png  # also a contact sheet of everything this tool makes
    python3 tools/build-props-a04.py --force cottage_moss
"""
import gamedata  # phase 04b: the data files in game/data
import os, sys, json, math, random, zlib, importlib.util
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
spec = importlib.util.spec_from_file_location('bbv46', os.path.join(HERE, 'build-buildings-v46.py')); BV = importlib.util.module_from_spec(spec); spec.loader.exec_module(BV)
bsp, bbld = BV.bsp, BV.bbld
g = vars(bsp)
Cv, R, P, ramp, olc, mix = bsp.Cv, bsp.R, bsp.P, bsp.ramp, bsp.olc, bsp.mix
wall, window, door_step, stone_band, shade_below, wall_lamp, flowerbox, layer_out, v17_plan = (g[k] for k in (
    'wall', 'window', 'door_step', 'stone_band', 'shade_below', 'wall_lamp', 'flowerbox', 'layer_out', 'v17_plan'))
OUT, META = bsp.OUT, bsp.META
ART = os.path.join(ROOT, 'game', 'art')
DATA = os.path.join(ROOT, 'game', 'data', 'gamedata.js')

# the Copperleaf colours: copper, moss and cream (and the green copper goes when it ages)
R.update({k: ramp(v) for k, v in dict(
    copper=(206, 124, 76), verdigris=(98, 176, 152), honey=(242, 220, 160), sage3=(214, 230, 200), peach2=(246, 216, 190),
    lilac2=(226, 214, 238), navy2=(58, 76, 126), solarf=(170, 178, 196), petal=(250, 236, 214), petal2=(246, 186, 160),
    moss2=(126, 178, 84), mossd=(92, 140, 70), bee=(238, 186, 52), rope=(196, 160, 112), cream2=(240, 228, 200)).items()})
HX = lambda c: '#%02X%02X%02X' % tuple(c)
NEW = {}
EXTRA = {}          # catalogue fields a prop needs beyond the kit's (blades, layers, landmark, ...)


def aprop(key, name, tags, shadow=.6, sway=0, box=None, group=None, solid=0, posts=None, flat=0, building=False):
    def deco(fn):
        d = dict(fn=fn, name=name, shadow=shadow, sway=sway, tags=tags, flat=flat, group=group or key, solid=solid, box=box, posts=posts, building=building)
        NEW[key] = d; bsp.PROPS[key] = d
        return fn
    return deco


# ============================================================================= building parts
def roof_shape(top, bot, xlt, xrt, xlb, xrb, r=10, bulge=True):
    """the rows of a roof face seen from the front: [(y, a, b)], convex and with rounded ends like a thatch"""
    rows = []
    for y in range(top, bot + 1):
        f = (y + .5 - top) / (bot + 1 - top)
        gg = math.sin(f * math.pi / 2) ** .8 if bulge else f
        a = xlt + (xlb - xlt) * gg; b = xrt + (xrb - xrt) * gg
        if y - top < r:
            k = r - math.sqrt(max(0, r * r - (r - (y + .5 - top)) ** 2)); a += k; b -= k
        rows.append((y, a, b))
    return rows


def moss_roof(cv, top, bot, xlt, xrt, xlb, xrb, Rm, rng, flowers=14):
    """a roof grown over with moss: soft cushions lit from the top left, a few flowers, tufts hanging off the eave"""
    lay = Cv(cv.w, cv.h); rows = roof_shape(top, bot, xlt, xrt, xlb, xrb)
    inside = set()
    for y, a, b in rows:
        for x in range(int(a), int(b) + 2):
            if x + .5 < a or x + .5 > b: continue
            u = (x + .5 - a) / max(1, b - a)
            lay.px(x, y, Rm[3 if u < .22 else 2 if u < .7 else 1]); inside.add((x, y))
    # cushions: overlapping mounds, each lit on its upper left and shaded along its lower edge
    cells = []
    for y in range(top + 3, bot - 1, 6):
        for x in range(int(min(a for _, a, _ in rows)), int(max(b for _, _, b in rows)), 8):
            cells.append((x + rng.randint(-2, 3) + (4 if (y // 6) % 2 else 0), y + rng.randint(-1, 2)))
    rng.shuffle(cells)
    for cx, cy in sorted(cells, key=lambda c: c[1]):
        if (cx, cy) not in inside: continue
        rx, ry = rng.uniform(4.5, 7.5), rng.uniform(2.6, 3.8)
        rowa = next((a for y, a, b in rows if y == cy), None); rowb = next((b for y, a, b in rows if y == cy), None)
        u = (cx - rowa) / max(1, rowb - rowa) if rowa is not None else .5
        base = 3 if u < .25 else 2 if u < .72 else 1
        for (x, y) in lay.ellpts(cx, cy, rx, ry):
            if (x, y) not in inside: continue
            dx, dy = (x + .5 - cx) / rx, (y + .5 - cy) / ry
            t = base
            if dy < -.35 and dx < .3: t = min(4, base + 1)
            elif dy > .55: t = max(0, base - 1)
            if dy > .82: t = max(0, base - 2)
            lay.px(x, y, Rm[t])
    # a few little flowers and stones in the moss
    cols = [R['petal'], R['bee'], R['pink'], R['white'], R['lilac']]
    pts = sorted(inside)
    for _ in range(flowers):
        x, y = rng.choice(pts)
        if y > bot - 4 or y < top + 4: continue
        c = rng.choice(cols); lay.px(x, y, c[4]); lay.px(x + 1, y, c[2]); lay.px(x, y + 1, c[2]); lay.px(x + 1, y + 1, c[1])
    # the ridge: a soft darker crest so the shape reads
    for y, a, b in rows[:2]:
        for x in range(int(a) + 2, int(b) - 1): lay.px(x, y, Rm[4 if y == top else 3])
    # tufts hanging off the eave
    y0, a0, b0 = rows[-1]
    for x in range(int(a0) + 2, int(b0) - 1):
        d = 1 + (x * 7) % 3 + (2 if (x * 13) % 7 == 0 else 0)
        for k in range(1, d + 1): lay.px(x, y0 + k, Rm[1 if k < d else 0])
    lay.outline(); cv.paste(lay)
    return rows


def solar_roof(cv, top, bot, xlt, xrt, xlb, xrb, Rs, Rf, Rc):
    """a hipped roof laid with solar shingles: dark glassy tiles in a fine grid, a sheen across them, a copper ridge"""
    lay = Cv(cv.w, cv.h)
    for y in range(top, bot + 1):
        f = (y + .5 - top) / (bot + 1 - top)
        a = xlt + (xlb - xlt) * f; b = xrt + (xrb - xrt) * f
        for x in range(int(math.floor(a)), int(math.ceil(b)) + 1):
            if x + .5 < a or x + .5 > b: continue
            ry = (y - top) % 9; rw = (y - top) // 9; col = (x - int(xlb) + (6 if rw % 2 else 0)) % 12
            t = 1
            if ry == 8: c = Rf[1]                                  # the frame between courses
            elif col == 0: c = Rf[2] if ry else Rf[3]
            else:
                if ry == 0: t = 2
                elif (x + y) % 3 == 0 and ry % 3 == 1: t = 2       # the cells of each tile
                sh = (x - y * 1.7) % 58
                if sh < 9 and ry < 8: t = 3 if 3 < sh < 6 else 2   # a soft sheen running across the roof
                if x + .5 - a < 3: t = min(4, t + 1)                # the left hip catches the light
                elif b - (x + .5) < 3: t = 0
                c = Rs[t]
            if y - top < 3: c = Rc[4 if y == top else 3 if y == top + 1 else 2]   # copper ridge
            if y >= bot - 1: c = Rc[1] if y == bot - 1 else Rc[0]                  # copper eave trim
            lay.px(x, y, c)
    lay.outline(); cv.paste(lay)


def round_door(cv, cx, bot, r, Rw, Rfr, knob=None):
    """a round door, a plank disc in a ring frame, the knob in the middle; its foot cut level with the step"""
    cy = bot - r + 2.5; lay = Cv(cv.w, cv.h)
    for y in range(int(cy - r) - 1, bot + 1):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            d = math.hypot(x + .5 - cx, y + .5 - cy)
            if d > r: continue
            if d > r - 2.6:                                        # the frame ring, lit from the top left
                ang = math.atan2(y + .5 - cy, x + .5 - cx)
                t = 3 if -2.6 < ang < -.9 else 1 if .5 < ang < 2.4 else 2
                lay.px(x, y, Rfr[t]); continue
            i = int(x - (cx - r)); pw = 6
            t = 2
            if i % pw == 0: t = 1
            elif i % pw == 1: t = 3
            if d > r - 4.2: t = max(0, t - 1)                      # shade just inside the ring
            if y + .5 < cy - r * .55: t = max(0, t - 1)
            lay.px(x, y, Rw[t])
    # iron hinges and the knob
    for k in (-1, 1):
        hy = int(cy + k * r * .45)
        for x in range(int(cx - r + 3), int(cx - r * .2)): lay.px(x, hy, R['iron'][2]); lay.px(x, hy + 1, R['iron'][1])
    kc = knob or R['gold']
    lay.px(int(cx), int(cy), kc[4]); lay.px(int(cx) + 1, int(cy), kc[2]); lay.px(int(cx), int(cy) + 1, kc[2]); lay.px(int(cx) + 1, int(cy) + 1, kc[1])
    lay.outline(); cv.paste(lay)
    cv.door = int(round(cx))


def round_window(cv, cx, cy, r, Rf=None, Rg=None, glow=False, cross=True):
    """a round window: a ring frame, the glass shaded like the square ones, a cross of glazing bars"""
    Rf = Rf or R['white']; Rg = Rg or (R['lamp'] if glow else R['glass'])
    cv.fx.append(('window', cx, cy)); lay = Cv(cv.w, cv.h)
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            d = math.hypot(x + .5 - cx, y + .5 - cy)
            if d > r: continue
            if d > r - 2.2:
                ang = math.atan2(y + .5 - cy, x + .5 - cx); lay.px(x, y, Rf[3 if -2.6 < ang < -.6 else 1 if .6 < ang < 2.5 else 2]); continue
            t = 2
            if y + .5 < cy - r + 4: t = 1
            dd = (x - (cx - r)) + (y - (cy - r))
            if dd % 14 in (5, 6) and x < cx + r * .4: t = 4
            elif dd % 14 == 8 and x < cx + r * .4: t = 3
            if x + .5 > cx + r - 4: t = min(t, 1)
            lay.px(x, y, Rg[t])
    if cross:
        for k in range(int(-r + 2), int(r - 1)):
            lay.px(int(cx), int(cy + k), Rf[2]); lay.px(int(cx + k), int(cy), Rf[3])
    lay.outline(); cv.paste(lay)


def crooked_chimney(cv, x0, w, ybot, ytop, lean, Rb, Rcap=None, cowl=None):
    """a chimney that leans as it climbs (drawn before the roof, on its own layer); returns the smoke point"""
    ch = Cv(cv.w, cv.h); H = ybot - ytop
    off = lambda y: lean * ((ybot - y) / H) ** 2.2
    for y in range(ytop + 4, ybot):
        xs = x0 + off(y)
        for k in range(w):
            x = int(round(xs + k)); t = 2
            if (y - ytop) % 5 == 4 or ((k + (3 if ((y - ytop) // 5) % 2 else 0)) % 6 == 0): t = 1
            if k == 0: t = 3
            if k >= w - 2: t = 0 if k == w - 1 else 1
            ch.px(x, y, Rb[t])
    Rc = Rcap or R['stone']; xc = int(round(x0 + off(ytop)))
    ch.rect(xc - 2, ytop, xc + w + 1, ytop + 3, lambda x, y: Rc[3 if y == ytop else 2 if x < xc + w - 1 else 1])
    top = ytop
    if cowl:   # a little pointed copper hat on two legs
        m = xc + w / 2; hh = 7
        for k in range(hh):
            half = (w / 2 + 2) * (k + 1) / hh
            for x in range(int(m - half), int(m + half) + 1): ch.px(x, ytop - 3 - hh + k, cowl[4 if x < m - half * .4 else 3 if x < m + half * .3 else 1])
        for yy in (ytop - 2, ytop - 1): ch.px(xc + 1, yy, cowl[1]); ch.px(xc + w - 2, yy, cowl[1])
        top = ytop - 3 - hh
    ch.outline(); cv.paste(ch)
    return (xc + w // 2, top - 1)


def copper_gutter(cv, x0, x1, y, Rc, pipe=None, G=None):
    for x in range(x0, x1 + 1):
        cv.px(x, y, Rc[4] if x < x0 + 6 else Rc[3]); cv.px(x, y + 1, Rc[2]); cv.px(x, y + 2, Rc[1])
    for x in range(x0 - 1, x1 + 2): cv.px(x, y + 3, olc(Rc[1]))
    if pipe is not None and G is not None:
        for yy in range(y + 3, G - 4):
            cv.px(pipe, yy, Rc[3]); cv.px(pipe + 1, yy, Rc[2]); cv.px(pipe + 2, yy, Rc[1])
            if (yy - y) % 14 == 0:
                for k in range(-1, 4): cv.px(pipe + k, yy, Rc[1])
        cv.rect(pipe - 2, G - 6, pipe + 4, G - 4, lambda x, yy: Rc[3 if x < pipe + 1 else 1])


def cl_walls(cv, x0, x1, top, G, Rwall, Rtrim, rng, battens=0, base_h=6):
    """plastered (or boarded) walls with copper corner trims on a stone footing"""
    wall(cv, x0, top, x1, G - base_h, Rwall, siding=0, eave=3)
    if battens:
        for x in range(x0 + battens, x1 - 3, battens):
            for y in range(top + 3, G - base_h):
                cv.px(x, y, Rwall[3]); cv.px(x + 1, y, Rwall[1])
    else:
        for _ in range((x1 - x0) // 26):
            x = rng.randint(x0 + 8, x1 - 10); y = rng.randint(top + 12, G - 14)
            cv.px(x, y, Rwall[1]); cv.px(x + 1, y, Rwall[1]); cv.px(x + 2, y + 1, Rwall[1]); cv.px(x, y - 1, Rwall[3])
    for px0 in (x0, x1 - 3):
        for y in range(top, G - base_h):
            for x in range(px0, px0 + 4): cv.px(x, y, Rtrim[[3, 2, 1, 0][x - px0]])
    stone_band(cv, x0 - 2, x1 + 2, G - base_h + 1, G, R['stone'], bw=10, bh=3)


def hive_sign(cv, cx, y, Rb):
    """a little painted board with a skep on it, hanging from a bracket"""
    cv.rect(cx - 10, y - 2, cx + 6, y - 1, R['iron'][1]); cv.px(cx - 10, y - 3, R['iron'][2])
    for k in (-6, 2): cv.px(cx + k, y, R['iron'][1]); cv.px(cx + k, y + 1, R['iron'][1])
    lay = Cv(cv.w, cv.h)
    lay.rect(cx - 9, y + 2, cx + 5, y + 14, lambda x, yy: Rb[3 if yy == y + 2 else 2 if x < cx + 3 else 1])
    for k, (r_, yy) in enumerate(((5, y + 11), (4, y + 8), (2.6, y + 6))):
        for x in range(int(cx - 2 - r_), int(cx - 2 + r_) + 1): lay.px(x, yy, R['bee'][3 if x < cx - 2 else 2]); lay.px(x, yy + 1, R['bee'][1])
    lay.px(cx - 2, y + 12, R['dwood'][0])
    lay.outline(); cv.paste(lay)


# ============================================================================= Copperleaf's buildings
@aprop('cottage_moss', 'Moss-roof cottage', ['town', 'village'], shadow=1.6, box=[3.4, 2.4], group='cottage_moss', building=True)
def p_cottage_moss(rng):
    W, H = 184, 178; G = H - 2; cx = 92
    cv = Cv(W, H); x0, x1, top = 38, 146, 96
    cl_walls(cv, x0, x1, top, G, R['cream'], R['copper'], rng)
    sm = crooked_chimney(cv, 110, 13, 76, 18, 13, R['stone'], R['stone'], cowl=R['copper'])
    moss_roof(cv, 36, 100, 58, 126, 24, 160, R['moss'], rng)
    shade_below(cv, x0, x1, 103, 3)
    copper_gutter(cv, x0 - 2, x1 + 2, 102, R['copper'], pipe=x1 - 8, G=G)
    dx = 70
    round_door(cv, dx, G - 6, 22, R['verdigris'], R['dwood'])
    door_step(cv, dx, G, 15)
    round_window(cv, 118, G - 46, 12, Rf=R['copper'])
    flowerbox(cv, 104, 132, G - 30, ['pink', 'gold', 'white'], rng)
    wall_lamp(cv, dx + 29, G - 52)
    window(cv, cx - 9, 62, 16, 12, sill=False, glow=True)
    for x in range(cx - 12, cx + 10):                                     # the moss lifts over the little window
        k = abs(x + 1.5 - cx) / 11; yy = 58 - int(4 * (1 - k * k))
        for d in range(3): cv.px(x, yy + d, R['moss'][3 - d] if d < 2 else R['moss'][0])
    cv.outline()
    cv.fx.append(('smoke',) + sm); cv.door = dx
    v17_plan(cv, kind='hip', wall=[x0, x1], eave=104, pitch=50, over=.4, roofCol=P['moss'] if 'moss' in P else (118, 170, 80), roofTex=16,
             wallCol=(246, 230, 190), wallTex=0, trimCol=(206, 124, 76), floors=1, rooms=[0, 1], sideWin=True,
             chimney=dict(x=116, top=18, w=.42, col=(170, 166, 180), tex=3, lean=round(13 / 34, 3)), base=((170, 166, 180), 3, .2))
    return cv, cx


@aprop('cottage_solar', 'Solar-shingle cottage', ['town', 'village'], shadow=1.6, box=[3.4, 2.2], group='cottage_solar', building=True)
def p_cottage_solar(rng):
    W, H = 184, 172; G = H - 2; cx = 92
    cv = Cv(W, H); x0, x1, top = 36, 148, 90
    cl_walls(cv, x0, x1, top, G, R['sage3'], R['copper'], rng, battens=12)
    sm = crooked_chimney(cv, 58, 12, 70, 14, -11, R['brick'], R['stone'])
    solar_roof(cv, 34, 94, 60, 124, 22, 162, R['navy2'], R['solarf'], R['copper'])
    shade_below(cv, x0, x1, 95, 3)
    dx = 116
    round_door(cv, dx, G - 6, 21, R['coral'], R['copper'])
    door_step(cv, dx, G, 14)
    round_window(cv, 64, G - 64, 10, Rf=R['white'])
    window(cv, 50, G - 42, 28, 20, Rf=R['white'], box=['lilac', 'white', 'pink'], rng=rng)
    wall_lamp(cv, dx - 30, G - 50)
    cv.outline()
    cv.fx.append(('smoke',) + sm); cv.door = dx
    v17_plan(cv, kind='hip', wall=[x0, x1], eave=97, pitch=44, over=.36, roofCol=(58, 76, 126), roofTex=17,
             wallCol=(214, 230, 200), wallTex=4, trimCol=(206, 124, 76), floors=1, rooms=[2, 0], sideWin=True,
             chimney=dict(x=64, top=14, w=.4, col=(196, 108, 84), tex=2, lean=round(-11 / 34, 3)), base=((170, 166, 180), 3, .2))
    return cv, cx


@aprop('cottage_juniper', 'Beekeeper’s cottage', ['town', 'village'], shadow=2.0, box=[4.8, 2.8], group='cottage_juniper', building=True)
def p_cottage_juniper(rng):
    W, H = 236, 196; G = H - 2; cx = 118
    cv = Cv(W, H); x0, x1, top = 36, 200, 106
    cl_walls(cv, x0, x1, top, G, R['honey'], R['copper'], rng)
    sm = crooked_chimney(cv, 158, 15, 84, 16, 14, R['stone'], R['stone'], cowl=R['copper'])
    sm2 = crooked_chimney(cv, 62, 11, 84, 34, -5, R['brick'], R['stone'])
    moss_roof(cv, 40, 112, 70, 166, 22, 214, R['moss2'], rng, flowers=22)
    shade_below(cv, x0, x1, 115, 3)
    copper_gutter(cv, x0 - 2, x1 + 2, 114, R['copper'], pipe=x0 + 6, G=G)
    dx = 98
    round_door(cv, dx, G - 6, 24, R['bee'], R['dwood'], knob=R['copper'])
    door_step(cv, dx, G, 16)
    hive_sign(cv, dx + 34, G - 74, R['wood'])
    window(cv, 140, G - 54, 30, 24, Rf=R['white'], box=['lilac', 'lilac', 'white'], rng=rng)
    round_window(cv, 60, G - 50, 11, Rf=R['copper'])
    wall_lamp(cv, dx - 32, G - 56)
    for (wx, k) in ((cx - 30, 0), (cx + 22, 1)):                       # two little windows peeping out of the moss
        window(cv, wx - 7, 70 + k * 2, 14, 11, sill=False, glow=True)
        for x in range(wx - 10, wx + 11):
            q = abs(x + .5 - wx) / 10.5; yy = 66 + k * 2 - int(4 * (1 - q * q))
            for d in range(3): cv.px(x, yy + d, R['moss2'][3 - d] if d < 2 else R['moss2'][0])
    cv.outline()
    cv.fx.append(('smoke',) + sm); cv.door = dx
    v17_plan(cv, kind='hip', wall=[x0, x1], eave=116, pitch=48, over=.42, roofCol=(126, 178, 84), roofTex=16,
             wallCol=(242, 220, 160), wallTex=0, trimCol=(206, 124, 76), floors=1, rooms=[1, 0, 2], sideWin=True,
             chimney=dict(x=165, top=16, w=.46, col=(170, 166, 180), tex=3, lean=round(14 / 34, 3)), base=((170, 166, 180), 3, .2))
    return cv, cx


# ============================================================================= Copperleaf's things
@aprop('wind_sail_flower', 'Flower wind sail', ['town', 'village', 'route'], shadow=.5, solid=.35, group='wind_sail')
def p_wind_sail_flower(rng):
    """a slim verdigris mast on a ring of stones; the petals (wind_sail_flower_blades.png) turn on the hub at its top"""
    W, H = 96, 204; G = H - 2; cx = 48
    cv = Cv(W, H)
    # the mast, tapering, with copper bands
    lay = Cv(W, H)
    for y in range(44, G - 6):
        f = (y - 44) / (G - 50); hw = 2.2 + f * 2.4
        for x in range(int(cx - hw), int(cx + hw) + 1):
            u = (x + .5 - (cx - hw)) / (2 * hw); lay.px(x, y, R['verdigris'][3 if u < .3 else 2 if u < .7 else 1])
        if y % 26 == 0:
            for x in range(int(cx - hw) - 1, int(cx + hw) + 2): lay.px(x, y, R['copper'][3]); lay.px(x, y + 1, R['copper'][1])
    layer_out(cv, lay)
    # the hub housing: a copper bud
    hb = Cv(W, H)
    for (x, y) in hb.ellpts(cx, 38, 7, 8):
        dx, dy = (x + .5 - cx) / 7, (y + .5 - 38) / 8; hb.px(x, y, R['copper'][4 if dx < -.3 and dy < -.2 else 3 if dx < .2 else 2 if dx < .6 else 1])
    for k in range(-3, 4): hb.px(cx + k, 47, R['verdigris'][2]); hb.px(cx + k, 48, R['verdigris'][1])
    layer_out(cv, hb)
    # leaves at the foot of the mast and a ring of stones
    for side in (-1, 1):
        lf = Cv(W, H)
        bsp.blade(lf, cx + side * 2, G - 8, cx + side * 16, G - 30, side * 3, 7, lambda x, y: R['leaf'][3 if (x - cx) * side < 6 else 2])
        layer_out(cv, lf)
    st = Cv(W, H)
    for k, (sx, sr) in enumerate(((-18, 6), (-9, 7), (0, 6.5), (9, 7), (18, 6))):
        for (x, y) in st.ellpts(cx + sx, G - 3, sr, 3.2):
            st.px(x, y, R['stone'][3 if y < G - 4 and x < cx + sx else 2 if y < G - 2 else 1])
    layer_out(cv, st)
    for k in range(5):
        fx_, fy = cx + rng.choice((-1, 1)) * rng.randint(6, 20), G - rng.randint(7, 12)
        bsp.tiny_flower(cv, fx_, fy, R[rng.choice(['petal2', 'gold', 'white'])])
    return cv, cx


def wind_sail_blades():
    """the flower: eight petals round a seed-head hub, alternating cream and peach, for the engine to turn"""
    S = 124; c = S / 2; cv = Cv(S, S); n = 8
    for i in range(n):
        a = i * 2 * math.pi / n + math.pi / n / 2; ux, uy = math.cos(a), math.sin(a); px_, py_ = -uy, ux
        Rp = R['petal'] if i % 2 == 0 else R['petal2']; lay = Cv(S, S)
        for y in range(S):
            for x in range(S):
                vx, vy = x + .5 - c, y + .5 - c; t = vx * ux + vy * uy; s = vx * px_ + vy * py_
                if t < 9 or t > 58: continue
                k = (t - 9) / 49; half = 13 * math.sin(math.pi * min(1, k * 1.05) ** .8) + 1
                if abs(s) > half: continue
                # lit from the top left: the side of the petal facing the light is lighter
                lit = (-.6 * px_ - .7 * py_) * (s / max(1, half))
                tone = 3 if lit > .25 else 2 if lit > -.3 else 1
                if abs(s) < 1.2 and k < .85: tone = max(0, tone - 1)          # the vein
                if k > .9: tone = max(0, tone - 1)
                lay.px(x, y, Rp[tone])
        lay.outline(); cv.paste(lay)
    hub = Cv(S, S)
    for (x, y) in hub.ellpts(c, c, 11, 11):
        d = math.hypot(x + .5 - c, y + .5 - c); hub.px(x, y, R['copper'][3] if d > 8 else R['bee'][3 if (x + y) % 3 else 2] if d > 3 else R['dwood'][2])
    hub.outline(); cv.paste(hub)
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0)); px = img.load()
    for y in range(S):
        for x in range(S):
            q = cv.a[y * S + x]
            if q is not None: px[x, y] = tuple(q) + (255,)
    return img


@aprop('banner_bunting', 'Bunting', ['town', 'village'], shadow=.3, sway=.4, group='banner_bunting', posts=[{'x': -80, 'r': .15}, {'x': 80, 'r': .15}])
def p_banner_bunting(rng):
    """two posts with a line of little triangular flags sagging between them"""
    W, H = 176, 104; G = H - 2; cx = 88
    cv = Cv(W, H); Rw = R['wood']
    for px0 in (cx - 82, cx + 78):
        bsp.fence_post(cv, px0, G, 96, Rw) if 'fence_post' in g else None
    cols = ['copper', 'moss', 'cream', 'coral', 'verdigris', 'gold']
    lay = Cv(W, H); yA = G - 88
    pts = [(x, yA + 16 * (1 - ((x - cx) / 80) ** 2)) for x in range(cx - 78, cx + 79)]
    for x, y in pts: lay.px(x, int(y), R['rope'][1])
    k = 0
    for i in range(4, len(pts) - 6, 13):
        x, y = pts[i]; C = R[cols[k % len(cols)]]; k += 1
        tri = [(x, y + 1), (x + 10, y + 1), (x + 5, y + 13)]
        lay.poly(tri, lambda xx, yy: C[3 if xx < x + 5 else 2])
    layer_out(cv, lay)
    return cv, cx


# ============================================================================= airships (alpha 0.4)
def lattice(cv, xl0, xr0, yb, xl1, xr1, yt, Rm, step=22):
    """a tapering lattice tower: two legs, rungs and X bracing between them"""
    lay = Cv(cv.w, cv.h)
    L = lambda y: xl0 + (xl1 - xl0) * (yb - y) / (yb - yt); Rr = lambda y: xr0 + (xr1 - xr0) * (yb - y) / (yb - yt)
    for y in range(yt, yb + 1):
        for k in range(3):
            lay.px(int(round(L(y))) + k, y, Rm[3 if k == 0 else 2]); lay.px(int(round(Rr(y))) - k, y, Rm[1 if k == 0 else 2])
    y = yb
    while y - step >= yt:
        y2 = y - step
        lay.line(L(y) + 2, y, Rr(y2) - 2, y2, Rm[2]); lay.line(Rr(y) - 2, y, L(y2) + 2, y2, Rm[1])
        for x in range(int(L(y2)), int(Rr(y2)) + 1): lay.px(x, y2, Rm[3]); lay.px(x, y2 + 1, Rm[1])
        y = y2
    lay.outline(); cv.paste(lay)


def airship(cv, x0, y0, L, Hh, Renv, Rstripe, Rfin, flip=False):
    """a small airship seen from the side: a cigar envelope with stripes, fins at the tail, a gondola and a propeller"""
    lay = Cv(cv.w, cv.h); cx, cy = x0 + L / 2, y0 + Hh / 2
    sgn = -1 if flip else 1
    for (x, y) in lay.ellpts(cx, cy, L / 2, Hh / 2):
        dx, dy = (x + .5 - cx) / (L / 2), (y + .5 - cy) / (Hh / 2)
        t = 3 if dy < -.45 else 2 if dy < .35 else 1
        if dy < -.7 and abs(dx) < .6: t = 4
        if dy > .78: t = 0
        R_ = Rstripe if (int((x - x0) / 9) % 2 == 0 and abs(dx) < .82) else Renv
        lay.px(x, y, R_[t])
    # the tail fins (the tail is at the far end from the nose)
    tx = cx - sgn * L / 2 * .78
    for k in range(int(Hh * .55)):
        w = int((Hh * .55 - k) * .7)
        for j in range(w): lay.px(int(tx - sgn * j), int(cy - Hh / 2 - k + 3), Rfin[3 if k < 3 else 2]); lay.px(int(tx - sgn * j), int(cy + Hh / 2 + k - 3), Rfin[1])
    # the gondola, slung under the middle, with three little windows
    gx0, gy0, gw, gh = int(cx - L * .18), int(cy + Hh / 2 - 1), int(L * .36), int(Hh * .36)
    lay.rect(gx0, gy0, gx0 + gw, gy0 + gh, lambda x, y: R['wood'][3 if y == gy0 else 2 if y < gy0 + gh - 1 else 1])
    for k in range(3):
        wx = gx0 + 3 + k * (gw - 6) // 3
        lay.rect(wx, gy0 + 2, wx + max(2, gw // 7), gy0 + gh - 3, R['lamp'][3])
    for k in (gx0 + 2, gx0 + gw - 2): lay.line(k, gy0, k + sgn * 3, cy + Hh * .2, R['iron'][1])
    # the propeller at the back of the gondola
    px_ = gx0 - 2 if not flip else gx0 + gw + 2
    if flip: px_ = gx0 + gw + 3
    else: px_ = gx0 - 3
    for k in range(-4, 5): lay.px(px_, gy0 + gh // 2 + k, R['iron'][2 if abs(k) < 3 else 1])
    lay.outline(); cv.paste(lay)


@aprop('airship_mast', 'Airship mast', ['town', 'city', 'village'], shadow=1.0, box=[1.8, 1.8], group='airship_mast')
def p_airship_mast(rng):
    """a lattice mooring mast with the airship moored to it: in the game a low-poly model painted with the buildings'
    32 px textures (tools/build-airship.py, scene/models/airship_mast.json, its propellers turning); this picture of the
    same model is for Lite and with the 3D props off"""
    sp_ = importlib.util.spec_from_file_location('bair', os.path.join(HERE, 'build-airship.py')); A = importlib.util.module_from_spec(sp_); sp_.loader.exec_module(A)
    cv, cx, base = A.picture(Cv)
    cv.fx.append(('glow', cx, int(base - (A.MAST_H + .86) * 34)))
    return cv, cx


@aprop('sky_lift', 'Sky lift', ['cave', 'town', 'mall'], shadow=.8, box=[2.0, 1.4], group='sky_lift')
def p_sky_lift(rng):
    """under the ground, the way up to the airships: a brass cage in a timber frame, the pulley wheel above, a lamp"""
    W, H = 96, 150; G = H - 2; cx = 48
    cv = Cv(W, H); Rw = R['dwood']
    for px0 in (cx - 34, cx + 30): bsp.fence_post(cv, px0, G, 136, Rw)
    beam = Cv(W, H); beam.rect(cx - 38, 12, cx + 37, 18, lambda x, y: Rw[3 if y == 12 else 2 if y < 17 else 1]); layer_out(cv, beam)
    wh = Cv(W, H)
    for (x, y) in wh.ellpts(cx, 26, 9, 9):
        d = math.hypot(x + .5 - cx, y + .5 - 26); wh.px(x, y, R['copper'][3] if d > 6.5 else R['iron'][2] if d > 2 else R['copper'][4])
    layer_out(cv, wh)
    for y in range(34, 52): cv.px(cx - 1, y, R['iron'][1]); cv.px(cx + 1, y, R['iron'][1])
    cage = Cv(W, H)
    cage.rect(cx - 22, 52, cx + 21, 56, lambda x, y: R['gold'][3 if y == 52 else 2])
    cage.rect(cx - 22, G - 6, cx + 21, G - 2, lambda x, y: R['gold'][2 if y == G - 6 else 1])
    for x in range(cx - 22, cx + 22, 5):
        for y in range(57, G - 6): cage.px(x, y, R['gold'][3 if x < cx else 2])
    for y in range(57, G - 6):
        for x in range(cx - 21, cx + 21):
            if cage.get(x, y) is None: cage.px(x, y, R['navy2'][0] if y < 64 else R['iron'][0])
    layer_out(cv, cage)
    wall_lamp(cv, cx + 26, 70)
    return cv, cx


# ============================================================================= the roof textures (64 x 64 levels, like build-buildings.py's)
T = 64


def t_moss(g_, r):
    for y in range(T):
        for x in range(T): g_[y][x] = 2
    for _ in range(90):                                       # soft cushions, lit on top
        cx, cy = r.randrange(T), r.randrange(T); rx, ry = r.uniform(3, 6), r.uniform(2, 3.6)
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                dx, dy = (x + .5 - cx) / rx, (y + .5 - cy) / ry
                if dx * dx + dy * dy > 1: continue
                g_[y % T][x % T] = 3 if dy < -.35 else 1 if dy > .6 else 2
    for _ in range(26): g_[r.randrange(T)][r.randrange(T)] = 4
    for _ in range(18): g_[r.randrange(T)][r.randrange(T)] = 0


def t_solar(g_, r):
    for y in range(T):
        row = y // 16; k = y % 16
        for x in range(T):
            c = (x + (8 if row % 2 else 0)) % 16
            v = 1
            if k == 15 or c == 15: v = 3                              # the light frame between tiles
            elif k == 0: v = 2
            elif (x % 4 == 0 or k % 4 == 0): v = 2                    # the cells
            if (x - y * 1.4) % 37 < 2.2 and k not in (0, 15): v = 4   # sheen
            g_[y][x] = v


NEW_TEX = [('moss', t_moss), ('solar shingles', t_solar)]


def write_atlas(D):
    """the building texture sheet with the new roofs: the old sheet's cells copied as they are, then the new ones"""
    old_rel = (D['scenery'].get('buildArt') or {}).get('detail') or 'scene/build/detail.png'
    new_rel = 'scene/build/detail-a04.png'; path = os.path.join(ART, new_rel)
    old = Image.open(os.path.join(ART, old_rel)).convert('RGBA')
    if old_rel == new_rel:
        return new_rel, False
    cols, rows = old.width // T, old.height // T; n_old = cols * rows
    rows2 = (n_old + len(NEW_TEX) + cols - 1) // cols
    im = Image.new('RGBA', (cols * T, rows2 * T), (126, 126, 126, 255))
    im.paste(old, (0, 0))
    for j, (name, fn) in enumerate(NEW_TEX):
        gcell = bbld.tex_cell(fn, 1600 + j); i = n_old + j; ox, oy = (i % cols) * T, (i // cols) * T
        for y in range(T):
            for x in range(T):
                v = gcell[y][x] * 63; im.putpixel((ox + x, oy + y), (v, v, v, 255))
    # the cells after the new ones are plain (level 2), so a texture number past the end still reads as plaster
    for i in range(n_old + len(NEW_TEX), cols * rows2):
        ox, oy = (i % cols) * T, (i // cols) * T
        for y in range(T):
            for x in range(T): im.putpixel((ox + x, oy + y), (126, 126, 126, 255))
    wrote = bsp.save_png(im, path, False)
    return new_rel, wrote


# ============================================================================= the data
def load_data():
    src = gamedata.js_text(); i = src.index('window.GAMEDATA=')
    return src[:i], json.JSONDecoder().raw_decode(src[i + len('window.GAMEDATA='):])[0]


def save_data(head, D):
    gamedata.save_js(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n')


VARIANTS = {   # (wall, trim) colour sets for the cottages' variants; the roofs stay moss or solar
    'cottage_moss': [((240, 214, 190), (206, 124, 76)), ((214, 230, 200), (98, 176, 152)), ((226, 214, 238), (206, 124, 76)), ((236, 222, 176), (132, 84, 60))],
    'cottage_solar': [((246, 230, 190), (206, 124, 76)), ((246, 216, 190), (98, 176, 152)), ((214, 226, 240), (206, 124, 76))],
}


def variant(key, M, k, wc, tc):
    B = M['build']; wc0, tc0 = BV.hx2rgb(B['wallCol']), BV.hx2rgb(B.get('trimCol', '#CE7C4C'))
    src = Image.open(os.path.join(ART, M['img'])).convert('RGBA')
    im = BV.recolour(src.copy(), [BV.tone_map(wc0, wc), BV.tone_map(tc0, tc)])
    return im, dict(wallCol=HX(wc), roofCol=B['roofCol'], trimCol=HX(tc), roofRamp=B.get('roofRamp'), extra=[])


def main():
    args = sys.argv[1:]; sp = None
    if '--sheet' in args: i = args.index('--sheet'); sp = args[i + 1]; del args[i:i + 2]
    force = '--force' in args; keys = [a for a in args if not a.startswith('--')] or None
    meta, written = {}, []
    for key in NEW:
        cv, bx, img = bsp.render(key); path = os.path.join(OUT, key + '.png')
        if bsp.save_png(img, path, force and (keys is None or key in keys)): written.append(key)
        disk = Image.open(path)
        meta[key] = bsp.prop_meta(key, cv, bx, disk if disk.size != img.size else img)
    # the wind sail's petals, a picture of their own
    bp = os.path.join(OUT, 'wind_sail_flower_blades.png')
    if bsp.save_png(wind_sail_blades(), bp, force and (keys is None or 'wind_sail_flower' in keys)): written.append('wind_sail_flower_blades')
    # the great oak's swing: a layer the size of the oak's picture
    head, D = load_data(); cat = D['scenery']['props']
    oak = cat.get('tree_giant')
    if oak:
        lp = os.path.join(ART, 'scene', 'props', 'layers', 'tree_giant_swing.png')
        im0 = Image.open(os.path.join(ART, oak['img'])).convert('RGBA')
        if bsp.save_png(swing_layer(im0.size), lp, force and (keys is None or 'tree_giant_swing' in keys)): written.append('layers/tree_giant_swing')
    Pm = json.load(open(META)); padd = []
    for k, m in meta.items():
        if k not in Pm or (force and (keys is None or k in keys)): Pm[k] = {f: v for f, v in m.items() if f != 'bld'}; padd.append(k)
    bsp.write_json(META, Pm)
    # the texture sheet with the new roofs
    rel, wrote = write_atlas(D)
    if wrote: written.append(rel)
    BA = D['scenery'].setdefault('buildArt', {'detail': 'scene/build/detail.png', 'rooms': 'scene/build/rooms.png'}); BA['detail'] = rel
    cadd = []
    for k, m in meta.items():
        if k in cat and not (force and (keys is None or k in keys)): continue
        e = dict(name=m['name'], img='scene/props/%s.png' % k, ox=m['ox'], oy=m['oy'], shadow=m['shadow'], sway=m['sway'], flat=m.get('flat', 0), tags=m['tags'], group=m['group'])
        for f in ('box', 'door', 'fx', 'posts'):
            if m.get(f) is not None: e[f] = m[f]
        if not m.get('box') and m.get('solid'): e['solid'] = m['solid']
        if m.get('bld'):
            b = dict(m['bld'])
            for f in ('wallCol', 'roofCol', 'trimCol'): b[f] = BV.hx2rgb(b[f])
            if 'chimney' in b: b['chimney'] = dict(b['chimney'], col=BV.hx2rgb(b['chimney']['col']))
            if 'base' in b and isinstance(b['base'], (list, tuple)): b['base'] = (tuple(b['base'][0]), b['base'][1], b['base'][2])
            e['build'] = bbld.plan_json(k, b, m)
        cat[k] = e; cadd.append(k)
    # extras: the petals that turn, the oak with its swing
    if 'wind_sail_flower' in cat and not cat['wind_sail_flower'].get('blades'):
        # the hub is drawn at canvas row 38 of a picture whose ground row is 202: 164 px above the foot
        cat['wind_sail_flower']['blades'] = {'img': 'scene/props/wind_sail_flower_blades.png', 'x': 0, 'y': -164, 'w': 124, 'h': 124, 'px': 62, 'py': 62}
    if oak and ('tree_giant_swing' not in cat or (force and (keys is None or 'tree_giant_swing' in keys))):
        e = json.loads(json.dumps(oak)); e['name'] = 'Great oak with a swing'
        e['layers'] = (e.get('layers') or []) + [{'img': 'scene/props/layers/tree_giant_swing.png', 'dz': -.25, 'sway': 0, 'shadow': 0, 'swing': .05, 'pivot': 5.5}]
        e['tags'] = sorted(set((e.get('tags') or []) + ['town', 'village'])); cat['tree_giant_swing'] = e; cadd.append('tree_giant_swing')
    # the mast and its airship draw as a low-poly model (tools/build-airship.py makes it and its picture)
    if 'airship_mast' in cat: cat['airship_mast']['model'] = 'scene/models/airship_mast.json'
    for k, a in (('airship_mast', 'fly'), ('sky_lift', 'fly')):
        if k in cat: cat[k].setdefault('act', a)
    # colour variants of the cottages (the roofs keep their moss or their solar shingles)
    vadd = []
    for k, sets in VARIANTS.items():
        M = cat.get(k)
        if not M or not M.get('build') or M['build'].get('variants'): continue
        V = []
        for j, (wc, tc) in enumerate(sets, 1):
            p = os.path.join(OUT, f'{k}_v{j}.png'); im, info = variant(k, M, j, wc, tc)
            if not os.path.exists(p): im.save(p, optimize=True); written.append(f'{k}_v{j}')
            V.append(dict(info, img=f'scene/props/{k}_v{j}.png'))
        M['build']['variants'] = V; vadd.append(k)
    save_data(head, D)
    print(f'{len(NEW)} new props; pictures written: {", ".join(written) or "none"}; props.json added: {len(padd)}; catalogue added: {", ".join(cadd) or "none"}; variants for {", ".join(vadd) or "none"}')
    if sp: sheet(sp, D)


def swing_layer(size):
    """the rope swing on the great oak: a branch under the crown's left side, two ropes and a plank seat half a metre up"""
    w, h = size; cv = Cv(w, h); G = h - 1
    Rb = ramp((150, 104, 74)); Rr = R['rope']
    by = lambda i: 232 - 30 * math.sin(i / 96 * math.pi / 2) - 4 * math.sin(i / 96 * math.pi * 2)
    br = Cv(w, h)                                    # the branch: out of the left limb, curving up into the leaves, tapering
    for i in range(0, 96):
        x = 152 - i; y = int(by(i)); th = max(2, round(8 - i / 15))
        for k in range(th): br.px(x, y + k, Rb[3 if k == 0 else 1 if k >= th - 1 else 2] if i < 70 else Rb[1 if k else 2])
    for i in (30, 58):                               # two twigs with a leaf or two
        x = 152 - i; y = int(by(i))
        for k in range(5): br.px(x - k, y - k // 2 - 1, Rb[2])
        br.px(x - 6, y - 4, R['leaf'][3]); br.px(x - 7, y - 4, R['leaf'][2]); br.px(x - 6, y - 5, R['leaf'][2])
    br.outline(); cv.paste(br)
    seat_y = G - 17
    for rx_ in (78, 114):                            # the ropes
        y_top = int(by(152 - rx_)) + max(2, round(8 - (152 - rx_) / 15))
        for y in range(y_top, seat_y):
            cv.px(rx_, y, Rr[3 if (y // 3) % 2 else 2]); cv.px(rx_ + 1, y, Rr[1])
        cv.px(rx_ - 1, y_top, Rr[2]); cv.px(rx_ + 2, y_top, Rr[1])
    st = Cv(w, h)
    st.rect(72, seat_y, 121, seat_y + 4, lambda x, y: R['wood'][3 if y == seat_y else 2 if y < seat_y + 3 else 1])
    for x in (80, 112): st.px(x, seat_y + 1, R['dwood'][1])
    st.outline(); cv.paste(st)
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0)); px = img.load()
    for y in range(h):
        for x in range(w):
            q = cv.a[y * w + x]
            if q is not None: px[x, y] = tuple(q) + (255,)
    return img


def sheet(path, D):
    from PIL import ImageDraw
    cat = D['scenery']['props']; ks = [k for k in list(NEW) + ['tree_giant_swing'] if k in cat]
    tiles = []
    for k in ks:
        M = cat[k]; base = Image.open(os.path.join(ART, M['img'])).convert('RGBA')
        for l in M.get('layers') or []:
            if l.get('dz', 0) <= 0:
                li = Image.open(os.path.join(ART, l['img'])).convert('RGBA'); base.alpha_composite(li)
        if M.get('blades'):
            b = M['blades']; bi = Image.open(os.path.join(ART, b['img'])).convert('RGBA')
            ax, ay = -M['ox'], -M['oy']; big = Image.new('RGBA', (max(base.width, ax + b['w']), base.height + 80), (0, 0, 0, 0)); off = 80
            big.alpha_composite(base, (0, off)); big.alpha_composite(bi, (ax + b['x'] - b['px'], off + ay + b['y'] - b['py'])); base = big
        ims = [base] + [Image.open(os.path.join(ART, v['img'])).convert('RGBA') for v in (M.get('build') or {}).get('variants', [])[:4]]
        tiles.append((k, ims))
    Wd = 1700; x = y = 10; rowh = 0; out = Image.new('RGBA', (Wd, 3000), (150, 202, 140, 255)); d = ImageDraw.Draw(out)
    for k, ims in tiles:
        tw = sum(i.width for i in ims) + 8 * len(ims)
        if x + tw > Wd: x = 10; y += rowh + 24; rowh = 0
        d.text((x, y), k, fill=(20, 20, 30)); xx = x
        for im in ims: out.alpha_composite(im, (xx, y + 14)); xx += im.width + 8
        rowh = max(rowh, max(i.height for i in ims) + 14); x += tw + 20
    out.crop((0, 0, Wd, y + rowh + 30)).save(path); print('sheet', path)


if __name__ == '__main__':
    main()
