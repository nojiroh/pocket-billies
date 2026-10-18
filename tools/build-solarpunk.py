#!/usr/bin/env python3
"""alpha 0.4: a solarpunk touch in every town, and Verdigris Park.

Every town keeps what it is and gains its own take on a bright future (the plan's table): green moss roofs and solar
shingles on some of its houses, and a few things of the new kit in free ground near its paths, chosen by its
character:

  solar_tree       a copper tree whose leaves are round solar panels, on a planter; it glows a little at night
  vertical_garden  a copper frame of troughs, herbs and flowers spilling down it
  solar_canopy     a bench under a tilted solar roof on two verdigris posts (you walk under it)
  heat_dome        a glass dome of copper ribs over a little orchard (the snowy towns)
  floating_solar   solar panels on floats, out on the water (the harbour and island towns)
  light_pipe       under the ground: a brass column whose lens glows with daylight piped down from the surface

Verdigris City gets its new central park between the plaza and the canal: a lawn round a duck pond, a gravel loop with
benches and lamps, flower beds, solar trees and garden walls, its old trees kept where they stood.

Pictures are written only where missing (--force writes them again). What this tool adds to the places carries
"a04solar": 1 (roofs "a04roof": 1), so running it again first takes its own away. The roofs are a prop's "roof":
'moss' or 'solar' (walk-view.js propWithVariant turns them into the building's roof texture and colours).

    python3 tools/build-solarpunk.py            # pictures that are missing, the catalogue, every town, the park
    python3 tools/build-solarpunk.py --dry      # say what it would place
    python3 tools/build-solarpunk.py --sheet out.png
"""
import gamedata  # phase 04b: the data files in game/data
import os, sys, json, math, random, importlib.util
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sp_ = importlib.util.spec_from_file_location('a4', os.path.join(HERE, 'build-props-a04.py')); A4 = importlib.util.module_from_spec(sp_); sp_.loader.exec_module(A4)
bsp, Cv, R, layer_out = A4.bsp, A4.Cv, A4.R, A4.layer_out
ART = os.path.join(ROOT, 'game', 'art'); DATA = os.path.join(ROOT, 'game', 'data', 'gamedata.js'); OUT, META = bsp.OUT, bsp.META
TAG, RTAG = 'a04solar', 'a04roof'
NEW = {}


def aprop(key, name, tags, shadow=.6, sway=0, box=None, group=None, solid=0, posts=None, flat=0, extra=None):
    def deco(fn):
        d = dict(fn=fn, name=name, shadow=shadow, sway=sway, tags=tags, flat=flat, group=group or key, solid=solid, box=box, posts=posts, building=False)
        NEW[key] = dict(d, extra=extra or {}); bsp.PROPS[key] = d
        return fn
    return deco


def lit_ell(cv, cx, cy, rx, ry, Rr, rim=None):
    """a filled ellipse lit from the top left"""
    for (x, y) in cv.ellpts(cx, cy, rx, ry):
        dx, dy = (x + .5 - cx) / max(1, rx), (y + .5 - cy) / max(1, ry); k = -dx * .6 - dy * .8
        cv.px(x, y, Rr[4 if k > .7 else 3 if k > .15 else 2 if k > -.45 else 1])
    if rim:
        for (x, y) in cv.ellpts(cx, cy, rx, ry):
            dx, dy = (x + .5 - cx) / max(1, rx), (y + .5 - cy) / max(1, ry)
            if dx * dx + dy * dy > .78: cv.px(x, y, rim[3 if dy < 0 else 1])


def panel_ell(cv, cx, cy, rx, ry, rng):
    """a round solar panel seen a little from above: navy cells, light grid lines, a copper rim, a sheen"""
    for (x, y) in cv.ellpts(cx, cy, rx, ry):
        dx, dy = (x + .5 - cx) / rx, (y + .5 - cy) / ry; d = dx * dx + dy * dy
        if d > .8: cv.px(x, y, R['copper'][3 if dy < -.1 else 2 if dy < .4 else 1]); continue
        v = R['navy2'][2 if dy < 0 else 1]
        if (x - int(cx)) % 4 == 0 or (y - int(cy)) % 3 == 0: v = R['solarf'][1 if dy > 0 else 2]
        if -2 < (x - cx) + (y - cy) * 1.6 + rx * .3 < 1.5: v = R['solarf'][3]
        cv.px(x, y, v)


def foliage(cv, cx, cy, rx, ry, rng, Rr=None, flowers=0, cols=('petal2', 'gold', 'white')):
    Rr = Rr or R['leaf']
    for _ in range(int(rx * ry * .9) + 3):
        x, y = cx + rng.uniform(-rx, rx), cy + rng.uniform(-ry, ry)
        if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1: continue
        r_ = rng.uniform(1.6, 3.2)
        for (px, py) in cv.ellpts(x, y, r_, r_ * .8):
            k = -(px + .5 - x) * .6 - (py + .5 - y) * .8
            cv.px(px, py, Rr[3 if k > .9 else 2 if k > -.6 else 1])
    for _ in range(flowers):
        x, y = int(cx + rng.uniform(-rx, rx) * .9), int(cy + rng.uniform(-ry, ry) * .9)
        if cv.get(x, y) is not None: bsp.tiny_flower(cv, x, y, R[rng.choice(cols)])


@aprop('solar_tree', 'Solar tree', ['town', 'city', 'village', 'farm'], shadow=1.1, group='solar_tree', solid=.45)
def p_solar_tree(rng):
    """a copper tree whose leaves are round solar panels, its trunk in a planter of flowers; a lamp under its crown"""
    W, H = 112, 128; G = H - 2; cx = 56; cv = Cv(W, H)
    top = G - 84
    arms = [((cx, top - 6), (cx, G - 112), 19, 9), ((cx, top + 2), (cx - 32, G - 98), 16, 8), ((cx, top + 2), (cx + 32, G - 100), 16, 8),
            ((cx, top + 12), (cx - 40, G - 76), 12, 6), ((cx, top + 10), (cx + 41, G - 78), 12, 6)]
    br = Cv(W, H)
    for (a, b, _, _) in arms:
        n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1]))) + 1
        for k in range(n + 1):
            t = k / max(1, n); x, y = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t; w = 2.2 - t * .8
            for xx in range(int(x - w), int(x + w) + 1): br.px(xx, int(y), R['verdigris'][3 if xx < x - .5 else 2 if xx < x + .7 else 1])
    for y in range(top - 8, G - 14):                                         # the trunk, tapering, copper bands
        f = (y - top) / (G - 14 - top); hw = 2.6 + max(0, f) * 2.4
        for x in range(int(cx - hw), int(cx + hw) + 1):
            u = (x + .5 - (cx - hw)) / (2 * hw); br.px(x, y, R['verdigris'][3 if u < .3 else 2 if u < .7 else 1])
        if y % 18 == 0:
            for x in range(int(cx - hw) - 1, int(cx + hw) + 2): br.px(x, y, R['copper'][3]); br.px(x, y + 1, R['copper'][1])
    layer_out(cv, br)
    lp = Cv(W, H); lit_ell(lp, cx, top - 2, 3.5, 3, R['lamp']); layer_out(cv, lp)
    for (a, b, rx, ry) in sorted(arms, key=lambda q: q[1][1]):
        pl = Cv(W, H); panel_ell(pl, b[0], b[1], rx, ry, rng); layer_out(cv, pl)
    # the planter: a round copper-banded stone tub with flowers
    pt = Cv(W, H)
    for y in range(G - 16, G + 1):
        f = (y - (G - 16)) / 16; hw = 21 - f * 4
        for x in range(int(cx - hw), int(cx + hw) + 1):
            u = (x + .5 - (cx - hw)) / (2 * hw); t = 3 if u < .25 else 2 if u < .72 else 1
            pt.px(x, y, R['copper'][t] if y in (G - 15, G - 14, G - 4) else R['stone'][t])
    layer_out(cv, pt)
    fl = Cv(W, H); foliage(fl, cx, G - 18, 20, 5, rng, flowers=7); layer_out(cv, fl)
    cv.fx.append(('glow', cx, top - 2))
    return cv, cx


@aprop('vertical_garden', 'Garden wall', ['town', 'city', 'mall'], shadow=.9, box=[1.9, .35], group='vertical_garden', extra={'vol': 'slab', 'volDepth': .3})
def p_vertical_garden(rng):
    """a copper frame holding four troughs of herbs and flowers, the green spilling down over each one"""
    W, H = 72, 92; G = H - 2; cx = 36; cv = Cv(W, H)
    back = Cv(W, H)
    for y in range(G - 82, G - 4):
        for x in range(cx - 27, cx + 28): back.px(x, y, R['mossd'][1 if (x + y) % 5 else 0])
    layer_out(cv, back)
    for i, ty in enumerate((G - 70, G - 52, G - 34, G - 16)):
        fg = Cv(W, H); foliage(fg, cx, ty - 5, 26, 7, rng, Rr=R['leaf' if i % 2 else 'moss2'], flowers=5 + i, cols=('petal2', 'gold', 'white', 'lilac2'))
        for _ in range(9):                                                 # trailing strands over the trough
            x = cx + rng.randint(-25, 25)
            for d in range(rng.randint(3, 9)):
                if fg.get(x, ty + d - 1) is None: fg.px(x + (d // 4) * rng.choice((-1, 0, 1)), ty + d, R['leaf'][2 if d % 2 else 1])
        layer_out(cv, fg)
        tr = Cv(W, H)
        for y in range(ty, ty + 5):
            for x in range(cx - 27, cx + 28): tr.px(x, y, R['copper'][3 if y == ty else 2 if y < ty + 4 else 1])
        layer_out(cv, tr)
    fr = Cv(W, H)
    for sx in (cx - 30, cx + 28):
        for y in range(G - 86, G + 1):
            for x in range(sx, sx + 3): fr.px(x, y, R['verdigris'][3 if x == sx else 2 if x == sx + 1 else 1])
    for x in range(cx - 31, cx + 32): fr.px(x, G - 86, R['verdigris'][3]); fr.px(x, G - 85, R['verdigris'][2]); fr.px(x, G - 84, R['verdigris'][1])
    for sx in (cx - 30, cx + 30): lit_ell(fr, sx, G - 88, 2.2, 2.2, R['copper'])
    layer_out(cv, fr)
    return cv, cx


@aprop('solar_canopy', 'Solar canopy', ['town', 'city', 'village'], shadow=1.3, group='solar_canopy', posts=[{'x': -42, 'r': .12}, {'x': 42, 'r': .12}])
def p_solar_canopy(rng):
    """a bench under a tilted roof of solar panels on two verdigris posts; a lamp under the roof"""
    W, H = 104, 100; G = H - 2; cx = 52; cv = Cv(W, H)
    bn = Cv(W, H)                                                          # the bench
    for k, y in enumerate((G - 18, G - 14, G - 10)):
        for x in range(cx - 26, cx + 27):
            for d in range(3): bn.px(x, y + d if k < 2 else y, R['wood'][3 if d == 0 else 2 if d == 1 else 1])
    for lx in (cx - 22, cx + 20):
        for y in range(G - 8, G + 1):
            for x in range(lx, lx + 3): bn.px(x, y, R['iron'][2 if x == lx else 1])
    layer_out(cv, bn)
    po = Cv(W, H)
    for sx in (cx - 44, cx + 41):
        for y in range(G - 80, G + 1):
            for x in range(sx, sx + 3): po.px(x, y, R['verdigris'][3 if x == sx else 2 if x == sx + 1 else 1])
        for x in range(sx - 1, sx + 4): po.px(x, G, R['stone'][1]); po.px(x, G - 1, R['stone'][2])
    layer_out(cv, po)
    rf = Cv(W, H)                                                          # the roof: tilted toward you, three by two panels
    yb, yt = G - 78, G - 94
    for y in range(yt, yb + 1):
        f = (y - yt) / (yb - yt); xl, xr = cx - 46 - f * 4, cx + 46 + f * 4
        for x in range(int(xl), int(xr) + 1):
            u = (x - xl) / (xr - xl); v = R['navy2'][2 if f < .5 else 1]
            if abs(u * 3 - round(u * 3)) * (xr - xl) / 3 < 1 or abs(f - .5) * (yb - yt) < .8: v = R['solarf'][2]
            if -2 < (x - xl) - f * 30 - 20 < 2 or -1.5 < (x - xl) - f * 30 - 64 < 1.5: v = R['solarf'][3]
            if y in (yt, yb) or x in (int(xl), int(xr)): v = R['copper'][3 if y == yt else 1 if y == yb else 2]
            rf.px(x, y, v)
    for x in range(cx - 50, cx + 51): rf.px(x, yb + 1, R['copper'][2]); rf.px(x, yb + 2, R['copper'][1])
    layer_out(cv, rf)
    lp = Cv(W, H); lit_ell(lp, cx, yb + 5, 3, 2.2, R['lamp']); layer_out(cv, lp)
    cv.fx.append(('glow', cx, yb + 5))
    return cv, cx


@aprop('heat_dome', 'Heat dome', ['town', 'snow'], shadow=1.6, box=[3.2, 3.0], group='heat_dome')
def p_heat_dome(rng):
    """a glass dome on copper ribs over a little orchard, warm inside; the snow slides off it"""
    W, H = 120, 100; G = H - 2; cx = 60; cv = Cv(W, H); rx, ry, base = 52, 78, G - 7
    inn = Cv(W, H)                                                         # what grows inside, seen through the glass
    for k, (tx, th) in enumerate(((cx - 22, 40), (cx + 4, 52), (cx + 26, 36))):
        for y in range(base - th + 10, base):
            for x in range(tx - 1, tx + 2): inn.px(x, y, R['bark'][2])
        foliage(inn, tx, base - th + 6, 13, 10, rng, Rr=R['leaf'], flowers=0)
        for _ in range(5):
            fx_, fy = int(tx + rng.uniform(-10, 10)), int(base - th + 6 + rng.uniform(-7, 7))
            if inn.get(fx_, fy) is not None: inn.px(fx_, fy, R['orange'][3]); inn.px(fx_ + 1, fy, R['orange'][2])
    foliage(inn, cx, base - 3, 44, 4, rng, Rr=R['moss2'], flowers=8)
    dome = Cv(W, H)
    for y in range(base - ry, base + 1):
        for x in range(cx - rx, cx + rx + 1):
            dx, dy = (x + .5 - cx) / rx, (y + .5 - base) / ry
            if dx * dx + dy * dy > 1 or dy > 0: continue
            c = inn.get(x, y); glass = R['glass'][3 if dx < -.2 and dy < -.4 else 2]
            col = tuple(int(a * .55 + b * .45) for a, b in zip(c, glass)) if c is not None else glass
            if -.55 < dx + dy * .55 + .3 < -.42 and dy < -.25: col = R['white'][4]           # the sheen
            dome.px(x, y, col)
    for k in range(-3, 4):                                                 # the ribs: meridians and two rings
        s = k / 3.6
        for y in range(base - ry, base + 1):
            dy = (y + .5 - base) / ry
            if dy > 0: continue
            w = math.sqrt(max(0, 1 - dy * dy)); x = cx + s * rx * w
            if dome.get(int(x), y) is not None: dome.px(int(x), y, R['copper'][3 if s < 0 else 2])
    for ring in (.45, .78):
        y = int(base - ry * ring); w = math.sqrt(1 - ring * ring) * rx
        for x in range(int(cx - w), int(cx + w) + 1): dome.px(x, y, R['copper'][2])
    for y in range(base - 18, base + 1):                                   # the door
        for x in range(cx - 7, cx + 8):
            if abs(x - cx) in (6, 7) or y == base - 18: dome.px(x, y, R['copper'][3 if x < cx else 1])
    layer_out(cv, dome)
    bs = Cv(W, H)
    for y in range(base, G + 1):
        for x in range(cx - rx - 3, cx + rx + 4): bs.px(x, y, R['stone'][3 if y == base else 2 if y < G - 1 else 1])
    layer_out(cv, bs)
    cv.fx.append(('glow', cx, base - 30))
    return cv, cx


@aprop('floating_solar', 'Floating solar garden', ['water', 'town'], shadow=0, group='floating_solar', flat=1)
def p_floating_solar(rng):
    """solar panels on white floats, out on the water, seen from above; a planter of green at one end"""
    W, H = 108, 52; cx = 54; cv = Cv(W, H); G = H - 2
    fl = Cv(W, H)
    for row, y0 in enumerate((8, 26)):
        for x in range(6, W - 6):
            for d in range(4): fl.px(x - row * 4, y0 + 14 + d, R['white'][3 if d < 2 else 2])
    layer_out(cv, fl)
    for row, y0 in enumerate((6, 24)):
        for col in range(3):
            pn = Cv(W, H); x0 = 10 + col * 30 - row * 4
            for y in range(y0, y0 + 15):
                f = (y - y0) / 15; xs = x0 + f * 3
                for x in range(int(xs), int(xs + 26)):
                    v = R['navy2'][2 if f < .5 else 1]
                    if (x - int(xs)) % 6 == 0 or (y - y0) % 5 == 0: v = R['solarf'][2]
                    if -1.5 < (x - xs) - f * 10 - 6 < 1.5: v = R['solarf'][3]
                    if y in (y0, y0 + 14): v = R['iron'][2]
                    pn.px(x, y, v)
            layer_out(cv, pn)
    gr = Cv(W, H); foliage(gr, W - 10, 30, 7, 8, rng, Rr=R['leaf'], flowers=3); layer_out(cv, gr)
    return cv, cx


@aprop('light_pipe', 'Light pipe', ['cave', 'mall'], shadow=.3, group='light_pipe', solid=.25)
def p_light_pipe(rng):
    """under the ground: a brass column on a stone foot; at its top a glass lens glows with daylight piped down from
    the surface, in a collar of copper petals"""
    W, H = 44, 116; G = H - 2; cx = 22; cv = Cv(W, H)
    col = Cv(W, H)
    for y in range(G - 92, G - 4):
        for x in range(cx - 3, cx + 4):
            u = (x + 3.5 - cx) / 7; col.px(x, y, R['gold'][3 if u < .3 else 2 if u < .7 else 1])
        if y % 16 == 0:
            for x in range(cx - 4, cx + 5): col.px(x, y, R['copper'][3]); col.px(x, y + 1, R['copper'][1])
    layer_out(cv, col)
    ft = Cv(W, H)
    for y in range(G - 6, G + 1):
        for x in range(cx - 9, cx + 10): ft.px(x, y, R['stone'][3 if y == G - 6 else 2 if y < G - 1 else 1])
    layer_out(cv, ft)
    pe = Cv(W, H)
    for k in range(6):
        a = math.pi + k * math.pi / 5; ex, ey = cx + math.cos(a) * 15, G - 96 + math.sin(a) * 9
        for t in range(12):
            f = t / 11; x, y = cx + (ex - cx) * f, G - 92 + (ey - (G - 92)) * f; w = 2.4 * math.sin(math.pi * min(1, f + .1))
            for xx in range(int(x - w), int(x + w) + 1): pe.px(xx, int(y), R['copper'][3 if xx < x else 2])
    layer_out(cv, pe)
    ln = Cv(W, H); lit_ell(ln, cx, G - 97, 9, 6, R['lamp'])
    for (x, y) in ln.ellpts(cx - 2, G - 99, 3, 2): ln.px(x, y, R['white'][4])
    layer_out(cv, ln)
    cv.fx.append(('glow', cx, G - 97))
    return cv, cx


# ============================================================================= the catalogue
def load():
    src = gamedata.js_text(); i = src.index('window.GAMEDATA=')
    return src[:i], json.JSONDecoder().raw_decode(src[i + len('window.GAMEDATA='):])[0]


def save(head, D):
    gamedata.save_js(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n')


def pictures(D, force=False, keys=None):
    meta, written = {}, []
    for key in NEW:
        cv, bx, img = bsp.render(key); path = os.path.join(OUT, key + '.png')
        if bsp.save_png(img, path, force and (keys is None or key in keys)): written.append(key)
        disk = Image.open(path); meta[key] = bsp.prop_meta(key, cv, bx, disk if disk.size != img.size else img)
    Pm = json.load(open(META))
    for k, m in meta.items():
        if k not in Pm or (force and (keys is None or k in keys)): Pm[k] = {f: v for f, v in m.items() if f != 'bld'}
    bsp.write_json(META, Pm)
    cat = D['scenery']['props']; added = []
    for k, m in meta.items():
        if k in cat and not (force and (keys is None or k in keys)): continue
        e = dict(name=m['name'], img='scene/props/%s.png' % k, ox=m['ox'], oy=m['oy'], shadow=m['shadow'], sway=m['sway'], flat=m.get('flat', 0), tags=m['tags'], group=m['group'])
        for f in ('box', 'door', 'fx', 'posts'):
            if m.get(f) is not None: e[f] = m[f]
        if not m.get('box') and m.get('solid'): e['solid'] = m['solid']
        e.update(NEW[k]['extra']); cat[k] = e; added.append(k)
    return written, added


# ============================================================================= where things go
OPEN = set('gGflCMHyLtEBn')                 # ground a thing may stand on (grass, lawn, flowers, clover, moss, heather...)
PAVED = set('pKqhcaTie;-v')                 # streets and squares
WET = set('wd')


def spots(sc, C, kind, want, rng, ground, CW, PPU, near_path=True, clear=1.2, avoid=()):
    """places for want things of this kind: on the given ground, flat, near a path, clear of every footprint, exit,
    window and other new thing; the best (nearest the town's middle, a little at random) first"""
    T = sc['tiles']; H = len(T); W = len(T[0]); hub = sc.get('hub') or [W / 2, H / 2]
    at = lambda x, z: T[H - 1 - int(math.floor(z))][int(math.floor(x))] if 0 <= x < W and 0 <= z < H else None
    hts = sc.get('heights')
    def hgt(x, z):
        if not hts: return 0.0
        r = hts[H - int(round(min(H, max(0, z))))]; return float(r[int(round(min(W, max(0, x))))] or 0)
    M = C[kind]; s = 1.0
    bw, bd = (M['box'][0], M['box'][1]) if M.get('box') else (1.6, 1.0) if M.get('posts') else (1.0, .8)
    if kind == 'solar_canopy': bw, bd = 2.9, 1.4
    exits = sc.get('exits') or []; out = []
    foot = []
    for p in sc['props']:
        Q = C.get(p['k']) or {}; ps = p.get('s', 1)
        if Q.get('box'): foot.append(('b', p['x'] - Q['box'][0] * ps / 2, p['z'] - .1, p['x'] + Q['box'][0] * ps / 2, p['z'] + Q['box'][1] * ps))
        elif Q.get('posts'): foot.append(('c', p['x'], p['z'], max(abs(q['x']) for q in Q['posts']) / 34 * ps + .4))
        elif (Q.get('solid') or 0) > .05: foot.append(('c', p['x'], p['z'], max(.35, (Q.get('solid') or .3) * ps)))
        elif not Q.get('flat') and (Q.get('group') or '').startswith(('tree', 'palm', 'bush')): foot.append(('c', p['x'], p['z'], .5))
    cand = []
    for _ in range(4000):
        a = rng.uniform(0, 2 * math.pi); rr = rng.uniform(4, max(W, H) * .55)
        x, z = hub[0] + math.cos(a) * rr, hub[1] + math.sin(a) * rr * .9
        if not (3 < x < W - 3 and 3 < z < H - 4): continue
        x0, z0, x1, z1 = x - bw / 2 - .3, z - .3, x + bw / 2 + .3, z + bd + .3
        pts = [(xx, zz) for xx in (x0, x, x1) for zz in (z0, (z0 + z1) / 2, z1)]
        if any(at(*q) not in ground for q in pts): continue
        hs = [hgt(*q) for q in pts]
        if max(hs) - min(hs) > (.6 if kind == 'floating_solar' else .3): continue
        if any(math.hypot(e[0] - x, e[1] - z) < 7 for e in exits): continue
        if any(math.hypot(q[0] - x, q[1] - z) < q[2] for q in avoid): continue
        if any(p.get(TAG) and math.hypot(p['x'] - x, p['z'] - z) < 4.5 for p in sc['props']): continue      # the new things keep apart
        if any(p['k'] == 'airship_mast' and p['x'] - 2.5 < x < p['x'] + 8.5 and p['z'] - 6.5 < z < p['z'] + 10 for p in sc['props']): continue   # not under the moored airship
        if any(seg_d(x, z + bd / 2, B_['a'], B_['b']) < B_.get('w', 1.4) / 2 + max(bw, bd) / 2 + .8 for B_ in sc.get('bridges') or []): continue   # off bridges and jetties
        bad = False
        for f in foot:
            if f[0] == 'b':
                if f[1] - clear < x1 and f[3] + clear > x0 and f[2] - clear < z1 and f[4] + clear * .6 > z0: bad = True; break
            elif math.hypot(f[1] - x, f[2] - (z + bd / 2)) < f[3] + max(bw, bd) / 2 + .4: bad = True; break
        if bad: continue
        if near_path and not any(at(x + dx, z + dz) in PAVED for dx in (-2.5, 0, 2.5) for dz in (-2.2, -1.2, bd + 1.2)): continue
        cand.append((math.hypot(x - hub[0], z - hub[1]) + rng.uniform(0, 8), round(x, 2), round(z, 2)))
    cand.sort()
    for _, x, z in cand:
        if len(out) >= want: break
        if any(math.hypot(x - q[0], z - q[1]) < max(6.0, bw + 3) for q in out + [(a[0], a[1]) for a in avoid]): continue
        p = {'k': kind, 'x': x, 'z': z, TAG: 1}
        if rng.random() < .5 and kind not in ('floating_solar',): p['f'] = 1
        sc['props'].append(p); n = len(sc['props']) - 1
        if CW and any(o[1] == n for o in CW.occluders(sc, C, PPU, CW.windows_of(sc, C, PPU))): sc['props'].pop(); continue
        out.append((x, z, max(bw, bd))); foot.append(('c', x, z, max(bw, bd) / 2 + .3))
    return out


def seg_d(px, pz, a, b):
    vx, vz = b[0] - a[0], b[1] - a[1]; l2 = vx * vx + vz * vz or 1e-9
    k = max(0, min(1, ((px - a[0]) * vx + (pz - a[1]) * vz) / l2)); return math.hypot(a[0] + vx * k - px, a[1] + vz * k - pz)


# the touches, town by town: [(kind, how many, ground)], then (moss roofs, solar roofs)
G_OPEN, G_ANY = OPEN | PAVED, OPEN | PAVED | set('kmuxsb')
TOUCH = {
    'sundown':   ([('solar_canopy', 2, G_OPEN), ('vertical_garden', 2, G_OPEN), ('solar_tree', 1, OPEN)], (6, 4)),
    'grotto':    ([('light_pipe', 3, G_ANY), ('vertical_garden', 1, G_ANY)], (0, 0)),
    'foodcourt': ([('vertical_garden', 3, G_ANY), ('solar_canopy', 1, G_ANY)], (3, 2)),
    'mall':      ([('vertical_garden', 3, G_ANY), ('light_pipe', 2, G_ANY)], (0, 0)),
    'farm':      ([('solar_tree', 4, OPEN | set('o')), ('solar_canopy', 1, G_OPEN)], (0, 4)),
    'city':      ([('solar_canopy', 2, G_OPEN), ('vertical_garden', 2, G_OPEN), ('solar_tree', 1, OPEN)], (8, 8)),
    'taxhaven':  ([('floating_solar', 3, WET), ('solar_canopy', 1, G_OPEN | set('sN'))], (2, 3)),
    'summit':    ([('heat_dome', 2, G_OPEN | set('n')), ('solar_tree', 1, OPEN | set('n'))], (0, 5)),
    'twofold':   ([('wind_sail_flower', 2, OPEN), ('banner_bunting', 2, G_OPEN), ('solar_tree', 1, OPEN)], (3, 3)),
    'bullion':   ([('solar_canopy', 2, G_OPEN), ('vertical_garden', 1, G_OPEN), ('solar_tree', 1, OPEN)], (2, 3)),
    'marketcap': ([('solar_tree', 2, OPEN | set('J')), ('vertical_garden', 1, G_ANY | set('J'))], (0, 0)),
    'mintshaft': ([('light_pipe', 3, G_ANY | set('rX'))], (0, 0)),
    'portfolio': ([('wind_sail_flower', 2, G_OPEN), ('solar_canopy', 1, G_OPEN), ('floating_solar', 2, WET)], (2, 3)),
    'upside':    ([('solar_canopy', 2, G_OPEN | set('UV')), ('vertical_garden', 2, G_OPEN | set('UV')), ('solar_tree', 1, OPEN | set('UV'))], (0, 6)),
}


def roofs(sc, C, n_moss, n_solar, rng):
    """green moss roofs and solar shingles on some of the town's houses (never its lab, clinic, shop or the player's home)"""
    sc_props = [p for p in sc['props'] if (C.get(p['k']) or {}).get('build') and p.get('act') not in ('lab', 'clinic', 'shop', 'home') and not any(w in p['k'] for w in ('greenhouse', 'lighthouse', 'tower', 'chapel', 'church'))]
    for p in sc['props']:
        if p.get(RTAG): p.pop('roof', None); p.pop(RTAG, None)
    rng.shuffle(sc_props); done = [0, 0]
    for p in sc_props:
        B = C[p['k']]['build']
        if B.get('roofTex') in (16, 17): continue
        if done[0] < n_moss and B.get('kind') in ('flat', 'hip', 'gable', 'lean') and (B.get('kind') == 'flat' or rng.random() < .6): p['roof'] = 'moss'; p[RTAG] = 1; done[0] += 1; continue
        if done[1] < n_solar: p['roof'] = 'solar'; p[RTAG] = 1; done[1] += 1
    return done


# ============================================================================= Verdigris Park
PARK = (11.0, 25.6, 58.5, 39.2)        # x0, z0, x1, z1: between the plaza and the canal


def park(sc, C, rng, CW, PPU):
    T = [list(r) for r in sc['tiles']]; H = len(T); W = len(T[0]); x0, z0, x1, z1 = PARK
    at = lambda x, z: T[H - 1 - z][x] if 0 <= x < W and 0 <= z < H else None
    def put(x, z, ch):
        if 0 <= x < W and 0 <= z < H: T[H - 1 - z][x] = ch
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2; prx, prz = 5.6, 2.6
    first = not sc.get('a04park'); sc['a04park'] = {'box': list(PARK), 'pond': [cx, cz, prx, prz]}
    ell = lambda x, z, rx, rz: ((x + .5 - cx) / rx) ** 2 + ((z + .5 - cz) / rz) ** 2
    loop = lambda x, z: abs(math.sqrt(ell(x, z, 15.5, 5.6)) - 1) < .1
    for z in range(int(z0), int(z1)) if first else ():
        for x in range(int(x0), int(x1)):
            if at(x, z) not in set('gGflCq'): continue
            e = ell(x, z, prx, prz)
            if e <= 1: put(x, z, 'd' if ell(x, z, prx * .5, prz * .5) <= 1 else 'w')
            elif e <= 1.55: put(x, z, 's')
            elif loop(x, z) or abs(z + .5 - cz) < .7 and abs(x + .5 - cx) > 6.6 or abs(x + .5 - cx) < .7 and abs(z + .5 - cz) > 3.6: put(x, z, 'v')
            elif rng.random() < .08 or ((x + z) % 9 == 0 and ell(x, z, 21, 7) > 1): put(x, z, 'f' if rng.random() < .5 else 'C')
            else: put(x, z, 'l')
    sc['tiles'] = [''.join(r) for r in T]
    # the pond sits a little lower than the lawn
    hts = sc.get('heights')
    if hts and first:
        for zz in range(int(cz - prz - 3), int(cz + prz + 4)):
            for xx in range(int(cx - prx - 3), int(cx + prx + 4)):
                e = ((xx - cx) / (prx + 1.2)) ** 2 + ((zz - cz) / (prz + 1)) ** 2
                if e < 1.6 and 0 <= H - zz < len(hts) and 0 <= xx < len(hts[0]):
                    hts[H - zz][xx] = round(float(hts[H - zz][xx] or 0) - .55 * max(0, 1 - e / 1.6) ** 1.5, 3)
    # what stood on the new paths and in the pond goes; trees and bushes elsewhere stay
    keep = []
    for p in sc['props']:
        if x0 <= p['x'] <= x1 and z0 <= p['z'] <= z1:
            ch = at(int(p['x']), int(p['z']))
            M = C.get(p['k']) or {}; g = M.get('group') or p['k']
            if ch in 'wdsv' or (not g.startswith(('tree', 'street_tree', 'bush')) and not M.get('flat') and p['k'] not in ('streetlamp_b',)): continue
        keep.append(p)
    sc['props'] = keep
    put_ = lambda k, x, z, f=0, **kw: sc['props'].append(dict({'k': k, 'x': round(x, 2), 'z': round(z, 2), TAG: 1}, **({'f': 1} if f else {}), **kw))
    # benches round the loop, facing in; lamps between them; the park's sign at the plaza end
    for k in range(10):
        a = k * 2 * math.pi / 10 + .2; x, z = cx + math.cos(a) * 15.5 * 1.08, cz + math.sin(a) * 5.6 * 1.18
        if math.sin(a) < -.2: put_('bench_wood', x, z + .2, f=math.cos(a) > 0)
        elif k % 2 == 0: put_('streetlamp_b', x, z)
    for (x, z) in ((cx - 9, cz + 4.6), (cx + 9, cz + 4.4), (cx + 3.6, cz - 4.3)):
        put_('solar_tree', x, z, f=x > cx)
    for (x, z) in ((x0 + 1.6, cz + 3.4), (x1 - 2.4, cz - 3.6)):
        put_('vertical_garden', x, z)
    put_('signpost', x1 - 1.2, z1 - 1.6, act='sign', label='Verdigris Park', say='Verdigris Park. Free to all, like the sun that keeps it green.')
    put_('wind_sail_flower', x0 + 2.4, z0 + 1.6)
    for _ in range(7):
        a = rng.uniform(0, 2 * math.pi); r_ = rng.uniform(.2, .8)
        put_(rng.choice(['pond_lily', 'pond_lily', 'lily_flowers']), cx + math.cos(a) * prx * r_, cz + math.sin(a) * prz * r_, f=rng.random() < .5)
    for k in range(10):
        a = rng.uniform(0, 2 * math.pi); put_(rng.choice(['reeds', 'cattails']), cx + math.cos(a) * prx * 1.05, cz + math.sin(a) * prz * 1.08, f=rng.random() < .5)
    # flower beds in the corners and trees along the edges, where there's room
    for (x, z) in ((x0 + 3, z0 + 2), (x1 - 3, z0 + 2), (x0 + 3, z1 - 2), (x1 - 4, z1 - 3)):
        for _ in range(4): put_(rng.choice(['flowers_mixed', 'flowers_red', 'flowers_yellow', 'tulips_yellow', 'lavender']), x + rng.uniform(-1.5, 1.5), z + rng.uniform(-1, 1), f=rng.random() < .5)
    trees = [k for k in ('tree_oak_small', 'tree_birch', 'tree_blossom', 'tree_beech', 'tree_hazel') if k in C]
    for k in range(9):
        x = x0 + 2 + k * (x1 - x0 - 4) / 8
        for z in (z0 + .8, z1 - .6):
            if at(int(x), int(z)) in 'lfC' and not any(math.hypot(p['x'] - x, p['z'] - z) < 2.5 for p in sc['props']):
                put_(rng.choice(trees), x, z, f=rng.random() < .5)
    sc.setdefault('life', [])
    if not any(l.get('k') == 'duck' and l.get(TAG) for l in sc['life']): sc['life'].append({'k': 'duck', 'n': 3, TAG: 1})
    return (cx, cz)


def main():
    args = sys.argv[1:]; dry = '--dry' in args; force = '--force' in args
    sheet = args[args.index('--sheet') + 1] if '--sheet' in args else None
    keys = [a for a in args if not a.startswith('--') and a != sheet] or None
    head, D = load(); C = D['scenery']['props']
    written, added = pictures(D, force, keys)
    print('pictures written:', ', '.join(written) or 'none', '; catalogue added:', ', '.join(added) or 'none')
    if sheet:
        ims = [Image.open(os.path.join(OUT, k + '.png')) for k in NEW]; Wt = sum(i.width for i in ims) + 12 * len(ims); Ht = max(i.height for i in ims)
        s = Image.new('RGBA', (Wt, Ht), (60, 70, 60, 255)); x = 0
        for im in ims: s.paste(im, (x, Ht - im.height), im); x += im.width + 12
        s = s.resize((s.width * 2, s.height * 2), Image.NEAREST); s.save(sheet); print('sheet', sheet)
    spc = importlib.util.spec_from_file_location('clearwin', os.path.join(HERE, 'clear-windows.py')); CW = importlib.util.module_from_spec(spc); spc.loader.exec_module(CW); PPU = CW.ppu(D)
    rep = []
    for r in D['locations']:
        if r.get('kind') != 'town': continue
        sid = r['mapId']; sc = D['maps'][sid]
        if sid not in TOUCH: continue
        sc['props'] = [p for p in sc['props'] if not p.get(TAG)]
        if sc.get('life'): sc['life'] = [l for l in sc['life'] if not l.get(TAG)]
        rng = random.Random('solar-' + sid); kinds, (nm, ns) = TOUCH[sid]; got = []; avoid = []
        if sid == 'city':
            if dry: rep.append('city: the park would go at x 11-58, z 26-39')
            else:
                c = park(sc, C, rng, CW, PPU); avoid.append((c[0], c[1], 26)); got.append('Verdigris Park')
        for kind, n, ground in kinds:
            if kind not in C: continue
            s_ = spots(sc, C, kind, n, rng, ground, CW, PPU, near_path=kind not in ('floating_solar',), avoid=avoid)
            got.append(f'{len(s_)}/{n} {kind}')
        mr = roofs(sc, C, nm, ns, rng) if (nm or ns) else (0, 0)
        if mr[0] or mr[1]: got.append(f'{mr[0]} moss roofs, {mr[1]} solar roofs')
        rep.append(f'{r["id"]}: ' + ', '.join(got))
    print('\n'.join(rep))
    if not dry: save(head, D); print('saved')


if __name__ == '__main__':
    main()
