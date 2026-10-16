#!/usr/bin/env python3
"""alpha 0.4: Pearlantis City, the retro-futurist Atlantis at the bottom of the Abyssal Trench.

The old money's city, sunk under the weight of its own gold: chrome and pearl towers under a glass dome, bubble trams on
their rails, kelp gardens, and the mirror shafts that bring the Inner Sun's light down to the sea floor. It is off the
main road: a glass lift in Kelpport's harbour takes you down, and the same lift brings you back up (the main road carries
on over the trench to Vinyl Works). The story beat: Vinylla's pressing plant on the platform above has been pumping up
the sunken city's gold to pay for her tour, and the Curator of the Pearl Exchange has the ledger to prove it.

What it adds (only adds: the place is route node 48, appended, so every save's node numbers stay as they are):
  the new props (pearl tower, bubble tram, mirror shaft, glass lift, pearl lamp) and pearl-and-chrome colours of six
  building kinds (new variants, appended), the place and its scene, its shop (the Pearl Exchange) and clinic, the
  Curator, the lore (the place, the Curator, the ledger), and the glass lift at Kelpport's harbour (act "lift").
The place has no road: the lift is the way in and out (game/js/airship.js liftGo), and no airship flies down here.

    python3 tools/build-pearlantis.py           # what is missing
    python3 tools/build-pearlantis.py --force   # the place again (only what this tool made: tagged "a04pearl")
    python3 tools/build-pearlantis.py --map out/
then  python3 tools/build-map-minis.py pearlantis portfolio, python3 tools/build-postcards.py pearlantis
"""
import copy, importlib.util, json, math, os, random, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent; HERE = ROOT / 'tools'
spec = importlib.util.spec_from_file_location('rg47', HERE / 'build-regions-v47.py'); RG = importlib.util.module_from_spec(spec); spec.loader.exec_module(RG)
BP = RG.BP; B = BP.B; Place, AV, SOFT, UNDER = BP.Place, BP.AV, BP.SOFT, BP.UNDER
sp_ = importlib.util.spec_from_file_location('a4', HERE / 'build-props-a04.py'); A4 = importlib.util.module_from_spec(sp_); sp_.loader.exec_module(A4)
sp2 = importlib.util.spec_from_file_location('solar', HERE / 'build-solarpunk.py'); SOL = importlib.util.module_from_spec(sp2); sp2.loader.exec_module(SOL)
bsp, Cv, R, layer_out, BV = A4.bsp, A4.Cv, A4.R, A4.layer_out, A4.BV
ART = ROOT / 'game' / 'art'; OUT, META = bsp.OUT, bsp.META
TAG = 'a04pearl'; SID = 'pearlantis'; SIZE = (96, 84)
R.update({k: bsp.ramp(v) for k, v in dict(pearl=(236, 238, 242), chrome=(150, 176, 196), teal2=(70, 168, 184), abyss=(28, 70, 110), pearlg=(255, 236, 214)).items()})
NEW = {}


def aprop(key, name, tags, shadow=.6, box=None, group=None, solid=0, posts=None, flat=0, extra=None):
    def deco(fn):
        d = dict(fn=fn, name=name, shadow=shadow, sway=0, tags=tags, flat=flat, group=group or key, solid=solid, box=box, posts=posts, building=False)
        NEW[key] = dict(d, extra=extra or {}); bsp.PROPS[key] = d
        return fn
    return deco


lit_ell = SOL.lit_ell


def column(cv, cx, y0, y1, hw0, hw1, Rr, bands=None, Rb=None):
    """an upright column tapering from hw0 (bottom, y1) to hw1 (top, y0), lit from the left"""
    for y in range(int(y0), int(y1) + 1):
        f = (y - y0) / max(1, y1 - y0); hw = hw1 + (hw0 - hw1) * f
        for x in range(int(cx - hw), int(cx + hw) + 1):
            u = (x + .5 - (cx - hw)) / (2 * hw + 1e-6); cv.px(x, y, Rr[4 if u < .14 else 3 if u < .4 else 2 if u < .78 else 1])
        if bands and Rb and int(y - y0) % bands == 0:
            for x in range(int(cx - hw) - 1, int(cx + hw) + 2): cv.px(x, y, Rb[3]); cv.px(x, y + 1, Rb[1])


@aprop('pearl_tower', 'Pearl tower', ['city', 'water'], shadow=1.8, box=[3.6, 3.0], group='pearl_tower', extra={'landmark': 1})
def p_pearl_tower(rng):
    """the Pearl Exchange's tower: a stepped plinth, a tapering pearl shaft with chrome fins and lit portholes, teal bands,
    and at the top a great glowing pearl held in a chrome crown"""
    W, H = 150, 392; G = H - 2; cx = 75; cv = Cv(W, H)
    pl = Cv(W, H)
    for k, (hw, h) in enumerate(((62, 12), (54, 10), (46, 9))):
        y1 = G - sum(q[1] for q in ((62, 12), (54, 10), (46, 9))[:k]); y0 = y1 - h
        for y in range(y0, y1 + 1):
            for x in range(cx - hw, cx + hw + 1): pl.px(x, y, R['pearl'][3 if y == y0 else 2 if x < cx + hw * .6 else 1] if y > y0 + 1 else R['teal2'][3])
    layer_out(cv, pl)
    base = G - 31; top = G - 300
    fins = Cv(W, H)
    for side in (-1, 1):                                                   # the chrome fins
        for y in range(top + 20, base):
            f = (y - top) / (base - top); off = 22 + f * 16
            for d in range(4): fins.px(int(cx + side * (off + d)), y, R['chrome'][3 if side < 0 else 1 if d > 1 else 2])
        for y in range(base - 70, base):
            f = (y - (base - 70)) / 70; off = 38 + f * 14
            for d in range(5): fins.px(int(cx + side * (off + d)), y, R['chrome'][2 if side < 0 else 1])
    layer_out(cv, fins)
    sh = Cv(W, H); column(sh, cx, top, base, 34, 20, R['pearl'], bands=46, Rb=R['teal2']); layer_out(cv, sh)
    pw = Cv(W, H)
    for y in range(top + 30, base - 8, 23):
        lit_ell(pw, cx, y, 4.5, 4.5, R['lamp']);
        for (x, yy) in pw.ellpts(cx, y, 5.6, 5.6):
            if pw.get(x, yy) is None or abs(math.hypot(x + .5 - cx, yy + .5 - y) - 5.2) < .8: pw.px(x, yy, R['chrome'][2])
        cv.fx.append(('window', cx, y))
    layer_out(cv, pw)
    cr = Cv(W, H)                                                          # the crown: claws round the pearl
    for k in range(5):
        a = math.pi * (1.1 + k * .2); ex, ey = cx + math.cos(a) * 30, top - 36 + math.sin(a) * 16
        for t in range(16):
            f = t / 15; x, y = cx + (ex - cx) * f, top + 4 + (ey - top - 4) * f; w = 3 - f * 1.6
            for xx in range(int(x - w), int(x + w) + 1): cr.px(xx, int(y), R['chrome'][3 if xx < x else 1])
    layer_out(cv, cr)
    pe = Cv(W, H); lit_ell(pe, cx, top - 38, 24, 24, R['pearlg'])
    for (x, y) in pe.ellpts(cx - 9, top - 48, 7, 5): pe.px(x, y, R['white'][4])
    layer_out(cv, pe)
    sp = Cv(W, H)
    for y in range(top - 76, top - 60):
        for x in range(cx - 1, cx + 2): sp.px(x, y, R['chrome'][3 if x == cx - 1 else 1])
    layer_out(cv, sp)
    cv.fx.append(('glow', cx, top - 38)); cv.fx.append(('glow', cx, top - 38))
    return cv, cx


@aprop('bubble_tram', 'Bubble tram', ['city', 'water'], shadow=.8, group='bubble_tram', posts=[{'x': -40, 'r': .18}])
def p_bubble_tram(rng):
    """a glass bubble car with a chrome band, hanging from its rail on a chrome pylon"""
    W, H = 120, 150; G = H - 2; cx = 60; cv = Cv(W, H); px0 = cx - 40; ry = G - 116
    py = Cv(W, H); column(py, px0, ry, G, 4, 3, R['chrome'], bands=26, Rb=R['teal2'])
    for x in range(px0 - 8, px0 + 9): py.px(x, G, R['stone'][1]); py.px(x, G - 1, R['stone'][2])
    layer_out(cv, py)
    rl = Cv(W, H)
    for x in range(2, W - 2):
        for d in range(5): rl.px(x, ry - 4 + d, R['chrome'][3 if d == 0 else 2 if d < 3 else 1])
    for x in range(px0 - 10, px0 + 11):
        for d in range(4): rl.px(x, ry + 1 + d, R['teal2'][2 if d < 2 else 1])
    layer_out(cv, rl)
    car = Cv(W, H); bx, by, br = cx + 14, ry + 44, 34
    for y in range(ry + 1, by - br + 4):
        for x in range(bx - 2, bx + 3): car.px(x, y, R['chrome'][2])
    seat = Cv(W, H)
    for y in range(by + 4, by + 16):
        for x in range(bx - 16, bx + 17): seat.px(x, y, R['red'][2 if y > by + 8 else 3])
    for (x, y) in car.ellpts(bx, by, br, br):
        d = math.hypot(x + .5 - bx, y + .5 - by) / br; s = seat.get(x, y)
        g = R['glass'][3 if (x - bx) + (y - by) < -br * .6 else 2]
        c = tuple(int(a * .45 + b * .55) for a, b in zip(s, g)) if s is not None else g
        if d > .92: c = R['chrome'][3 if y < by else 1]
        if abs(y - by - 2) < 2.5: c = R['chrome'][3 if y < by + 2 else 1]
        if -1.5 < (x - bx) + (y - by) * .8 + br * .55 < 1.5 and d < .85: c = R['white'][4]
        car.px(x, y, c)
    layer_out(cv, car)
    lp = Cv(W, H); lit_ell(lp, bx, by + br + 3, 4, 3, R['lamp']); layer_out(cv, lp)
    cv.fx.append(('glow', bx, by + br + 3))
    return cv, cx


@aprop('mirror_shaft', 'Mirror shaft', ['city', 'water'], shadow=.6, group='mirror_shaft', solid=.5)
def p_mirror_shaft(rng):
    """a great polished dish on a chrome tripod, catching the Inner Sun's light where it comes down the shaft from the
    sea above and throwing it over the city (the beam itself is drawn by the tool after, soft)"""
    W, H = 96, 300; G = H - 2; cx = 48; cv = Cv(W, H)
    tp = Cv(W, H)
    for (lx, rx) in ((cx - 26, cx - 4), (cx + 26, cx + 4), (cx - 2, cx)):
        for t in range(62):
            f = t / 61; x = lx + (rx - lx) * f; y = G - f * 60
            for d in range(3): tp.px(int(x) + d - 1, int(y), R['chrome'][3 if d == 0 else 2 if d == 1 else 1])
    layer_out(cv, tp)
    dish = Cv(W, H); dy = G - 72
    for (x, y) in dish.ellpts(cx, dy, 36, 13):
        dx, ddy = (x + .5 - cx) / 36, (y + .5 - dy) / 13; d = dx * dx + ddy * ddy
        c = R['chrome'][1] if d > .8 else R['pearlg'][4] if (dx + .2) ** 2 + (ddy + .2) ** 2 < .12 else R['pearlg'][3] if ddy < .2 else R['chrome'][3]
        dish.px(x, y, c)
    layer_out(cv, dish)
    cv.fx.append(('glow', cx, dy))
    return cv, cx


def beam(img, cx, y_top, y_bot, w0, w1, col=(255, 236, 190)):
    """the shaft of light coming down onto the dish: soft, brightest in the middle (an RGBA picture's own pixels)"""
    px = img.load(); W, H = img.size; out = Image.new('RGBA', img.size, (0, 0, 0, 0)); q = out.load()
    for y in range(int(y_top), int(y_bot)):
        f = (y - y_top) / max(1, y_bot - y_top); hw = w0 + (w1 - w0) * f; a0 = .22 + .16 * f
        for x in range(int(cx - hw), int(cx + hw) + 1):
            if not (0 <= x < W): continue
            u = abs(x + .5 - cx) / hw; a = a0 * (1 - u * u)
            if (x + y // 3) % 9 == 0: a *= 1.25
            q[x, y] = col + (int(255 * min(1, a)),)
    out.alpha_composite(img); return out


@aprop('glass_lift', 'Glass lift', ['city', 'water', 'harbour'], shadow=1.0, box=[2.0, 2.0], group='glass_lift')
def p_glass_lift(rng):
    """the glass lift between Kelpport's harbour and Pearlantis: a glass cabin in chrome rings at the foot of a glass
    tube that runs up out of sight, its door open and lit"""
    W, H = 100, 316; G = H - 2; cx = 50; cv = Cv(W, H)
    tb = Cv(W, H)
    for y in range(0, G - 86):
        for x in range(cx - 26, cx + 27):
            u = (x + 26 - cx) / 52; c = R['glass'][3 if u < .2 else 2]
            if x in (cx - 26, cx + 26): c = R['chrome'][2]
            if 4 < x - (cx - 26) < 8: c = R['white'][4]
            tb.px(x, y, c)
        if y % 40 == 0:
            for x in range(cx - 28, cx + 29): tb.px(x, y, R['chrome'][3]); tb.px(x, y + 1, R['chrome'][1])
    layer_out(cv, tb)
    cab = Cv(W, H)
    for y in range(G - 88, G - 8):
        for x in range(cx - 28, cx + 29):
            u = (x + 28 - cx) / 56; c = R['glass'][3 if u < .22 else 2]
            if abs(x - cx) < 11 and y > G - 72: c = R['lamp'][3 if y < G - 60 else 2]
            if 3 < x - (cx - 28) < 7 and y < G - 20: c = R['white'][4]
            cab.px(x, y, c)
    for y in (G - 88, G - 87, G - 50, G - 9, G - 8):
        for x in range(cx - 30, cx + 31): cab.px(x, y, R['chrome'][3 if y < G - 60 else 1])
    for x in (cx - 30, cx - 29, cx + 29, cx + 30):
        for y in range(G - 88, G - 7): cab.px(x, y, R['chrome'][2])
    layer_out(cv, cab)
    bs = Cv(W, H)
    for y in range(G - 7, G + 1):
        for x in range(cx - 34, cx + 35): bs.px(x, y, R['teal2'][3 if y == G - 7 else 2 if y < G - 2 else 1])
    layer_out(cv, bs)
    cv.fx.append(('glow', cx, G - 66))
    return cv, cx


@aprop('pearl_lamp', 'Pearl lamp', ['city', 'water'], shadow=.25, group='pearl_lamp', solid=.25)
def p_pearl_lamp(rng):
    """a chrome lamp post with a glowing pearl globe on a curled arm"""
    W, H = 44, 124; G = H - 2; cx = 22; cv = Cv(W, H)
    po = Cv(W, H); column(po, cx, G - 100, G, 2.6, 1.6, R['chrome'], bands=30, Rb=R['teal2'])
    for x in range(cx - 6, cx + 7): po.px(x, G, R['chrome'][1]); po.px(x, G - 1, R['chrome'][2])
    layer_out(cv, po)
    gl = Cv(W, H); lit_ell(gl, cx, G - 108, 9, 9, R['pearlg'])
    for (x, y) in gl.ellpts(cx - 3, G - 112, 3, 2): gl.px(x, y, R['white'][4])
    layer_out(cv, gl)
    cv.fx.append(('glow', cx, G - 108))
    return cv, cx


# ================================================================================================ pictures, variants
PEARL_VARIANTS = {   # kind: (wall, trim) in pearl and chrome
    'villa': ((242, 240, 236), (79, 168, 184)), 'office_tower': ((232, 236, 242), (95, 158, 173)), 'apartment_a': ((238, 240, 244), (200, 162, 74)),
    'mansion': ((244, 242, 238), (63, 140, 156)), 'shop_boutique': ((240, 244, 246), (79, 176, 192)), 'clinic': ((242, 246, 246), (79, 184, 168))}


def pictures(D, force):
    meta, written = {}, []
    for key in NEW:
        cv, bx, img = bsp.render(key); path = os.path.join(OUT, key + '.png')
        if key == 'mirror_shaft':                                          # the shaft of light from above, soft, on a taller picture
            src = img.convert('RGBA'); up = 230; img = Image.new('RGBA', (src.width, src.height + up), (0, 0, 0, 0)); img.paste(src, (0, up))
            img = beam(img, bx + .5, 0, up + src.height - 76, 6, 15)
        if bsp.save_png(img, path, force): written.append(key)
        disk = Image.open(path); meta[key] = bsp.prop_meta(key, cv, bx, disk if disk.size != img.size else img)
    Pm = json.load(open(META))
    for k, m in meta.items():
        if k not in Pm or force: Pm[k] = {f: v for f, v in m.items() if f != 'bld'}
    bsp.write_json(META, Pm)
    cat = D['scenery']['props']; added = []
    for k, m in meta.items():
        if k in cat and not force: continue
        e = dict(name=m['name'], img='scene/props/%s.png' % k, ox=m['ox'], oy=m['oy'], shadow=m['shadow'], sway=m['sway'], flat=m.get('flat', 0), tags=m['tags'], group=m['group'])
        for f in ('box', 'door', 'fx', 'posts'):
            if m.get(f) is not None: e[f] = m[f]
        if not m.get('box') and m.get('solid'): e['solid'] = m['solid']
        e.update(NEW[k]['extra']); cat[k] = e; added.append(k)
    # pearl-and-chrome colours of the buildings Pearlantis is made of: a variant each, appended (old variant numbers stay)
    vidx = {}
    for k, (wc, tc) in PEARL_VARIANTS.items():
        M = cat.get(k)
        if not M or not M.get('build'): continue
        V = M['build'].setdefault('variants', [])
        img_rel = f'scene/props/{k}_pearl.png'; j = next((n for n, v in enumerate(V) if v.get('img') == img_rel), None)
        if j is None or force:
            im, fields = A4.variant(k, M, 0, wc, tc); p = os.path.join(ART, img_rel)
            if not os.path.exists(p) or force: im.save(p); written.append(img_rel)
            entry = dict(fields, img=img_rel, pearl=1)
            if j is None: V.append(entry); j = len(V) - 1
            else: V[j] = entry
        vidx[k] = j + 1
    return written, added, vidx


# ================================================================================================ the data
NODE = dict(id=SID, name='Pearlantis City', kind='town', route='City', lon=236.4, lat=6.2, area='beach', t='trench', pool='portfolio', biome='harbour',
            mood='deepsea', music='trench', shop='pearlantis', noFly=1, lift='portfolio',
            blurb='The old money’s city under a glass dome at the bottom of the trench: chrome and pearl towers, bubble trams, kelp gardens. A glass lift in Kelpport goes down.')
SHOP = {'name': 'The Pearl Exchange', 'keeper': 'Nacre', 'who': 'concierge', 'greeting': 'Everything here was paid for in pearls. Some of it twice.',
        'stock': [{'item': 'pretzel', 'price': 70}, {'item': 'trailmix', 'price': 240}, {'item': 'taxbreak', 'price': 150}, {'item': 'loophole', 'price': 420},
                  {'item': 'bailout', 'price': 950}, {'item': 'parachute', 'price': 2500}]}
CURATOR = {'id': 'nacre', 'who': 'nacre', 'name': 'Curator Nacre',
           'first': ['You came down the lift? Then you’ve seen the pipes. Everyone up there thinks they carry water.',
                     'They carry gold. Ours. Vinylla’s pressing plant has been pumping the city’s vaults dry for a year to pay for her tour.',
                     'The ledger is in the Exchange, if you can stomach the numbers. Somebody ought to send her the bill.'],
           'lines': ['The mirrors bring the Inner Sun down to us. Nobody can own the sun, not even in Pearlantis. Especially not in Pearlantis.',
                     'We sank because we wouldn’t spend. Now someone else is spending it for us. There’s a lesson in that, but I’m too cross to learn it.',
                     'The bubble trams run all night. There is no night down here, only the lamps.',
                     'Mind your coins on the lift. Things that fall in the trench stay in the trench.']}
PEOPLE_NACRE = {'look': {'name': 'Curator Nacre', 'body': {'height': 1.04, 'body': .96, 'chest': .5, 'hips': 1.0, 'shoulders': 1.0},
                         'skin': '#C98E6A', 'hair': '#EDEFF2', 'eyes': '#3F8C9C',
                         'wear': {'hair': 'hair_bun', 'eyes': 'eyes_sleepy', 'brows': 'brows_arched', 'mouth': 'mouth_smile', 'top': 'sweater', 'outer': 'apron',
                                  'bottom': 'skirt', 'shoes': 'boots', 'glasses': 'glasses_round', 'neck': 'scarf'},
                         'colors': {'sweater': ['#3F8C9C'], 'apron': ['#ECEEF2', '#96B0C4'], 'skirt': ['#2A4A6A'], 'boots': ['#2A3448', '#1A2232'],
                                    'scarf': ['#F2E2C8'], 'glasses_round': ['#C8A24A']}}}
LORE_PLACE = {'history': 'Built by the first billionaires, who took their gold down the trench where nobody could tax it. The city sank under the weight of what it would not spend, and the dome kept the sea out and the money in.',
              'known': 'Chrome and pearl towers, bubble trams, kelp gardens, and the mirror shafts that bring the Inner Sun’s light down to the sea floor.',
              'landmark': 'The Pearl Tower, with the city’s great pearl in its crown. It glows. Nobody remembers who is paying for that.',
              'legend': 'They say the vaults under the Exchange go deeper than the trench. The ledger says they are nearly empty.'}
LORE_PERSON = {'name': 'Curator Nacre', 'who': 'nacre', 'role': 'Curator of the Pearl Exchange, Pearlantis City', 'unlock': 'meet:nacre',
               'text': 'Keeps the Pearl Exchange’s books, and has been watching the city’s gold go up the pipes to Vinylla’s pressing plant on the platform above.',
               'voice': 'Dry, precise, very cross. “Somebody ought to send her the bill.”'}
BOOK = {'title': 'The Pearl Exchange ledger', 'by': 'Curator Nacre',
        'pages': ['Vault 1: gold, 40,000 bars. Vault 2: pearls, uncounted. Vault 3: the deeds to half the Hollow Earth, unsigned.',
                  'A year ago the pipes from the platform above began to hum. Every month since, the vaults weigh less.',
                  'Vault 1: 6,212 bars. Paid out to: VINYLLA WORLD TOUR LTD. Purpose: “pressing costs, merchandise, a bigger stage”.',
                  'Note for whoever reads this: the pipes run up the trench wall to the pressing plant on Vinyl Works. If you are going that way, take the bill.']}
CHAT = {'0': ['Welcome to Pearlantis. Please don’t tap the glass.', 'The bubble trams go round and round. That’s the whole idea.',
              'We used to be the richest city in the Hollow Earth. Now we’re the deepest.', 'The light comes down the mirror shafts. It’s the same sun as yours, just further to fall.']}


def add_data(D, force, rep, vidx):
    i = RG.node_index(D, SID)
    e = {'name': NODE['name'], 'cost': 0, 'pool': NODE['pool'], 'route': NODE['route'], 't': NODE['t'], 'blurb': NODE['blurb'], 'lon': NODE['lon'], 'lat': NODE['lat'],
         'area': NODE['area'], 'scene': SID, 'id': SID, 'kind': 'town', 'biome': NODE['biome'], 'mood': NODE['mood'], 'town': 1, 'music': NODE['music'], 'shop': 'pearlantis',
         'noFly': 1, 'lift': 'portfolio', 'region': 'coraltrench', TAG: 1}
    if i is None: D['route'].append(e); rep.append(f'place {SID} (node {len(D["route"]) - 1})')
    elif force and D['route'][i].get(TAG): D['route'][i] = e
    port = next((r for r in D['route'] if r['id'] == 'portfolio'), None)
    if port is not None: port['lift'] = SID
    if 'pearlantis' not in D['shops'] or force: D['shops']['pearlantis'] = SHOP
    if 'nacre' not in D['people'] or force: D['people']['nacre'] = copy.deepcopy(PEOPLE_NACRE)
    L = D.setdefault('lore', {})
    if SID not in L.setdefault('places', {}) or force: L['places'][SID] = LORE_PLACE
    if 'nacre' not in L.setdefault('people', {}) or force: L['people']['nacre'] = LORE_PERSON
    if 'pearl_ledger' not in L.setdefault('books', {}) or force: L['books']['pearl_ledger'] = BOOK
    if SID not in L.setdefault('chat', {}) or force: L['chat'][SID] = CHAT


# ================================================================================================ the place
LOOK = dict(sky=['#06243C', '#0C4462', '#1C7890'], haze='#145A72', hazeD=30, amb='spore', far='sea', farH=4, tint='#163E5A', grassCol=None, wind=.35)


def town(D, i, vidx):
    W, H = SIZE; BP.SIZE[SID] = (W, H)
    old = RG.fresh(SID, 'Pearlantis City', 'town', LOOK, (W, H))
    s = Place(SID, 'Pearlantis City', 'N', 4801, W, H); hub = (48.0, 16.0); s.setup(old, hub)
    s.d.update(folk=8, under=1)
    s.d['hub'] = [hub[0], hub[1]]; s.d['exits'] = []
    pv = lambda k: vidx.get(k)
    # ---- the ground: coral sand everywhere, seaweed rock and kelp beds round the edges, pearl plazas and avenues
    s.tint_ground([('3', .62, 7, 'N'), ('2', .78, 5, 'N')], 4802)
    s.blob(48, 50, 13, 9, 'T', .08)                                                             # the Pearl Plaza
    s.street([[48, .4], [48, 8], [48, 18], [48, 30], [48, 41]], 'T', 4.4, lamps='pearl_lamp', every=8)   # the Grand Avenue
    s.street([[6, 30], [20, 30], [34, 30], [48, 30], [62, 30], [76, 30], [90, 30]], 'q', 2.6, lamps='pearl_lamp', every=12)   # the tram street
    s.street([[30, 50], [36, 50]], 'T', 2.4, lamps=None); s.street([[60, 50], [68, 50]], 'T', 2.4, lamps=None)
    s.street([[24, 30], [24, 44], [30, 50]], 'q', 2.0, lamps='pearl_lamp', every=10); s.street([[72, 30], [72, 44], [66, 50]], 'q', 2.0, lamps='pearl_lamp', every=10)
    s.blob(48, 9.5, 7, 3.6, 'T', .06)                                                          # the lift's landing
    # ---- canals of seawater with little bridges, from the plaza out to the dome's edge
    s.stream([(-.2, 64), (14, 63), (28, 62.4), (36, 60)], 1.6, .2, banks='T')
    s.stream([(60, 60), (70, 62.4), (82, 63), (W + .2, 64)], 1.6, .2, banks='T')
    # ---- the glass lift up to Kelpport, at the foot of the avenue
    s.put('glass_lift', 48, 6.2, act='lift', to='portfolio', label='Glass lift to Kelpport'); s.clear.append((48, 6.2, 2.6)); s.clear.append((48, 9.5, 2.2))
    # ---- the Pearl Tower at the back of the plaza, mirror shafts round it, the fountain in the middle
    s.put('pearl_tower', 48, 56.6, label='The Pearl Tower', act='read', book='pearl_ledger'); s.clear.append((48, 56.6, 4))
    for (x, z) in ((37, 44.8), (59, 44.8), (36.4, 55.6), (59.6, 55.6)): s.put('mirror_shaft', x, z, f=x > 48); s.clear.append((x, z, 1.4))
    s.put('fountain_big', 48, 47.2); s.clear.append((48, 47.2, 3))
    # ---- the towers and houses: pearl and chrome
    s.house('shop_boutique', 40.2, 20.6, 'shop', v=pv('shop_boutique'), garden=False, label='The Pearl Exchange', shop='pearlantis')
    s.house('clinic', 56.0, 20.6, 'clinic', v=pv('clinic'), garden=False, label='Clinic')
    for (k, x, z) in (('office_tower', 33.4, 33.2), ('office_tower', 63.0, 33.2), ('apartment_a', 14.0, 33.0), ('apartment_a', 82.0, 33.0), ('mansion', 30.4, 56.0),
                      ('mansion', 66.0, 56.0), ('villa', 12.0, 46.0), ('villa', 84.0, 46.0), ('villa', 16.0, 20.4), ('villa', 80.0, 20.4), ('office_tower', 48.0, 66.0)):
        s.house(k, x, z, 'house', v=pv(k), garden=False)
    # ---- the bubble trams on their rail along the tram street
    for x in (18, 46, 74): s.put('bubble_tram', x, 31.8, f=x > 48)
    # ---- kelp gardens and coral round the edges, a few giant shells
    for (cx, cz, rx, rz, n) in ((10, 10, 7, 5, 9), (86, 10, 7, 5, 9), (10, 74, 8, 6, 10), (86, 74, 8, 6, 10), (30, 70, 6, 4, 6), (66, 70, 6, 4, 6), (22, 40, 4, 3, 4), (74, 40, 4, 3, 4)):
        s.blob(cx, cz, rx, rz, '3', .3)
        s.drift(['kelp_tall', 'kelp_tall', 'seaweed', 'coral', 'coral'], cx, cz, rx * .8, rz * .8, n, avoid='wdTq')
    for (x, z) in ((8.5, 15.5), (82, 14), (26, 72), (70, 72)): s.put('coral_tower', x, z)   # the first clear of the villa's windows
    s.scatter(['shell_pile', 'coral', 'seaweed', 'kelp_tall'], 26, (0, 0, W, H), avoid='wdTq', gap=.8)
    for x, z in ((40, 12), (56, 12), (32, 46), (64, 46)): s.put('bench_metal', x, z)
    s.d['npcSpots'] = [[44.4, 44], [53.6, 14.4], [30, 28], [66, 28], [48, 36]]
    s.life('crab', 4)
    s.rolling(.12, 10); s.rise_back(70, .8)
    return s.out(8, 'stone', 'T', bridge='stone')


def kelpport_lift(D, rep):
    """the glass lift in Kelpport's harbour: on the quay by the water, clear of windows, jetties and the moored airship"""
    sc = D['scenes']['portfolio']; C = D['scenery']['props']
    sc['props'] = [p for p in sc['props'] if not p.get(TAG)]
    spc = importlib.util.spec_from_file_location('clearwin', HERE / 'clear-windows.py'); CW = importlib.util.module_from_spec(spc); spc.loader.exec_module(CW); PPU = CW.ppu(D)
    T = sc['tiles']; Hh = len(T); at = lambda x, z: T[Hh - 1 - int(math.floor(z))][int(math.floor(x))] if 0 <= x < sc['w'] and 0 <= z < Hh else None
    best = None
    for z10 in range(40, sc['h'] * 10 - 40, 5):
        for x10 in range(60, sc['w'] * 10 - 60, 5):
            x, z = x10 / 10, z10 / 10
            if at(x, z) not in 'KqhcTpi;': continue
            if not any(at(x + dx, z + dz) in 'wd' for dx in (-3, 0, 3) for dz in (2.5, 3.5, 4.5)): continue           # the water just behind
            if any(at(x + dx, z + dz) in 'wd' for dx in (-1.4, 0, 1.4) for dz in (-.4, .6, 1.4)): continue
            if any(abs(p['x'] - x) < 3.2 and -2.6 < p['z'] - z < 3 for p in sc['props'] if (C.get(p['k']) or {}).get('box') or (C.get(p['k']) or {}).get('solid')): continue
            if any(p['k'] == 'airship_mast' and p['x'] - 2.5 < x < p['x'] + 8.5 and p['z'] - 6.5 < z < p['z'] + 10 for p in sc['props']): continue
            if any(SOL.seg_d(x, z + 1, b['a'], b['b']) < b.get('w', 1.4) / 2 + 1.8 for b in sc.get('bridges') or []): continue
            d = math.hypot(x - sc['hub'][0], z - sc['hub'][1])
            if best is None or d < best[0]:
                p = {'k': 'glass_lift', 'x': round(x, 2), 'z': round(z, 2), 'act': 'lift', 'to': SID, 'label': 'Glass lift to Pearlantis', TAG: 1}
                sc['props'].append(p); n = len(sc['props']) - 1; occ = any(o[1] == n for o in CW.occluders(sc, C, PPU, CW.windows_of(sc, C, PPU))); sc['props'].pop()
                if not occ: best = (d, p)
    if best: sc['props'].append(best[1]); rep.append(f'Kelpport: the glass lift at {best[1]["x"]}, {best[1]["z"]}')
    else: rep.append('!! Kelpport: no room on the quay for the glass lift')


def main():
    args = sys.argv[1:]; dry = '--dry' in args; force = '--force' in args; mp = None
    if '--map' in args: j = args.index('--map'); mp = Path(args[j + 1]); mp.mkdir(parents=True, exist_ok=True)
    head, D = RG.load(); rep = []
    written, added, vidx = pictures(D, force)
    rep.append('pictures written: ' + (', '.join(written) or 'none') + '; catalogue added: ' + (', '.join(added) or 'none'))
    add_data(D, force, rep, vidx)
    old = D['scenes'].get(SID)
    if old and not (force and old.get(TAG)): rep.append(f'{SID}: built already')
    else:
        cat = D['scenery']['props']; BP.CAT.update(cat); nature = BP.nature_pool(cat)
        i = RG.node_index(D, SID); sc = town(D, i, vidx)
        sc[TAG] = 1; sc['biome'] = 'harbour'; sc['kind'] = 'town'; sc['place'] = SID; sc['under'] = 1
        sc['chat'] = CHAT['0'][:3]
        sp = sc['npcSpots'][0]; sc['people'] = [dict(CURATOR, x=sp[0], z=sp[1], dir='down')]
        occ, grown = BP.finish(sc, D, i, nature, cat)
        RG.prune_wild(sc)
        for p in sc['props']:                                                                     # the city's roofs: chrome
            if (cat.get(p['k']) or {}).get('build') and p.get('act') not in ('shop', 'clinic'): p['roof'] = 'chrome'
        D['scenes'][SID] = sc
        rep.append(f'{SID}: {sc["w"]}×{sc["h"]}, {occ} placed + {grown} grown, {sum(1 for p in sc["props"] if (cat.get(p["k"]) or {}).get("build"))} buildings')
        if mp: BP.draw_map(SID, sc, cat, mp / f'{SID}.png')
    kelpport_lift(D, rep)
    print('\n'.join(rep))
    if not dry: RG.save(head, D); print('saved')
    else: print('dry run: nothing written')


if __name__ == '__main__':
    main()
