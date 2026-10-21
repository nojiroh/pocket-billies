#!/usr/bin/env python3
"""v46: furniture for the new rooms (a bakery, an inn, a bank, a library, a school, a station, a fire station, a
mansion, a barn, a greenhouse, a ski lodge, a market hall), drawn with the scene-prop kit like the v26 furniture
(the v26 part of tools/build-scene-props.py). Pictures that already exist are kept.

    python3 tools/build-furniture.py                 # draws what is missing, adds it to props.json and game data
    python3 tools/build-furniture.py --sheet out.png
    python3 tools/build-furniture.py piano --force   # redraws one
"""
import gamedata  # phase 04b: the data files in game/data
import os, sys, json, math, random, zlib, importlib.util
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
spec = importlib.util.spec_from_file_location('bsp', os.path.join(HERE, 'build-scene-props.py')); bsp = importlib.util.module_from_spec(spec); spec.loader.exec_module(bsp)
g = vars(bsp)
Cv, R, P, ramp, block, goods, xt, layer_out = bsp.Cv, bsp.R, bsp.P, bsp.ramp, g['block'], g['goods'], g['xt'], g['layer_out']
OUT, META = bsp.OUT, bsp.META
DATA = os.path.join(ROOT, 'game', 'data', 'gamedata.js')
R.update({k: ramp(v) for k, v in dict(
    steel=(150, 160, 174), chalk=(58, 86, 72), brass=(206, 164, 72), quilt=(176, 92, 96), quiltb=(86, 120, 168), loaf=(208, 146, 78),
    velvet=(140, 50, 64), ivory=(238, 230, 210), soil=(110, 78, 56), pot=(196, 110, 76), board=(40, 44, 54), amber=(250, 196, 90),
    skired=(206, 60, 56), skiblue=(70, 120, 200), green2=(84, 150, 92), pane=(176, 214, 230), navy=(60, 78, 120)).items() if k not in R})
NEW = {}


def fprop(key, name, shadow, tags, box=None, flat=0, solid=0):
    def deco(fn):
        d = dict(fn=fn, name=name, shadow=shadow, sway=0, tags=tags, flat=flat, group=key, solid=solid, box=box, posts=None)
        NEW[key] = d; bsp.PROPS[key] = d
        return fn
    return deco


def legs(cv, xs, G, h, Rl):
    for x in xs: cv.rect(x, G - h, x + 2, G, Rl[1])


@fprop('bakery_oven', 'Bread oven', .6, ['indoor'], box=[1.6, 0.8])
def p_bakery_oven(rng):
    W, H = 70, 84; G = H - 2; cx = 35; cv = Cv(W, H)
    for y in range(G - 64, G + 1):
        for x in range(cx - 30, cx + 31):
            if y < G - 48 and abs(x - cx) > (y - (G - 64)) * 1.6 + 12: continue
            cv.px(x, y, R['brick'][2 if ((y // 4) + (x // 8 + (y // 4) % 2)) % 5 else 1] if (y % 4) else R['brick'][1])
    for (x, y) in cv.ellpts(cx, G - 24, 15, 13):
        if y < G - 14: cv.px(x, y, R['tire'][0])
    for (x, y) in cv.ellpts(cx, G - 20, 11, 7):
        if y < G - 14: cv.px(x, y, R['amber'][3 if y > G - 22 else 2])
    for x in range(cx - 8, cx + 9, 4): cv.px(x, G - 17, R['amber'][4])
    cv.rect(cx - 18, G - 14, cx + 18, G - 11, R['stone'][3]); cv.rect(cx - 6, G - 74, cx + 6, G - 64, R['brick'][1])
    for x0 in (cx - 24, cx + 14):
        cv.rect(x0, G - 7, x0 + 10, G - 2, R['wood'][2])
    cv.outline(); cv.fx.append(('fire', cx, 20)); cv.fx.append(('smoke', cx, 78))
    return cv, cx


@fprop('bread_rack', 'Rack of bread', .4, ['indoor'], box=[1.4, 0.6])
def p_bread_rack(rng):
    W, H = 64, 78; G = H - 2; cx = 32; cv = Cv(W, H)
    block(cv, cx - 28, cx + 28, G - 72, G, R['dwood'], R['wood'], top=4)
    for k in range(4):
        y1 = G - 54 + k * 16; cv.rect(cx - 25, y1 - 12, cx + 25, y1, R['dwood'][0])
        x = cx - 24
        while x < cx + 20:
            w = rng.randint(6, 10)
            for (px_, py_) in cv.ellpts(x + w // 2, y1 - 3, w // 2, 3 if k else 4): cv.px(px_, py_, R['loaf'][3 if py_ < y1 - 4 else 2])
            cv.px(x + w // 2 - 1, y1 - 5, R['loaf'][1]); cv.px(x + w // 2 + 1, y1 - 5, R['loaf'][1])
            x += w + 1
        for xx in range(cx - 26, cx + 27): cv.px(xx, y1 + 1, R['wood'][3])
    cv.outline()
    return cv, cx


@fprop('bed_inn', 'Bed', .6, ['indoor'], box=[1.3, 1.9])
def p_bed_inn(rng):
    W, H = 60, 64; G = H - 2; cx = 30; cv = Cv(W, H)
    block(cv, cx - 26, cx + 26, G - 60, G - 34, R['dwood'], R['wood'], top=4)          # headboard
    for y in range(G - 40, G - 6):                                                      # the bed, seen from its foot
        for x in range(cx - 25, cx + 26):
            q = R['quilt'] if ((x - cx + 40) // 9 + (y // 9)) % 2 else R['quiltb']
            cv.px(x, y, q[3 if y < G - 34 else 2 if x < cx + 18 else 1])
    for (x, y) in cv.ellpts(cx - 10, G - 42, 9, 4): cv.px(x, y, R['ivory'][4 if y < G - 42 else 3])
    for (x, y) in cv.ellpts(cx + 10, G - 42, 9, 4): cv.px(x, y, R['ivory'][4 if y < G - 42 else 3])
    block(cv, cx - 26, cx + 26, G - 10, G, R['dwood'], R['wood'], top=3)
    cv.outline()
    return cv, cx


@fprop('bar_counter', 'Bar counter', .9, ['indoor'], box=[3.0, 0.8])
def p_bar_counter(rng):
    W, H = 110, 66; G = H - 2; cx = 55; cv = Cv(W, H)
    block(cv, cx - 50, cx + 50, G - 34, G, R['dwood'], R['wood'], top=6)
    for x0 in range(cx - 46, cx + 44, 18): cv.orect(x0 + 2, G - 24, x0 + 15, G - 4, R['dwood'][0])
    cv.rect(cx - 50, G - 4, cx + 50, G - 2, R['brass'][2])
    lay = Cv(W, H)
    for k, x in enumerate((cx - 12, cx - 4, cx + 4)):
        lay.rect(x, G - 48, x + 2, G - 34, R['brass'][3]); lay.rect(x - 1, G - 50, x + 3, G - 48, R['brass'][4])
    for x in (cx + 22, cx + 30):
        lay.rect(x, G - 42, x + 5, G - 34, R['amber'][2]); lay.rect(x, G - 43, x + 5, G - 42, R['white'][4])
    for x in (cx - 36, cx - 30):
        lay.rect(x, G - 46, x + 3, G - 34, R['leaf'][1]); lay.rect(x + 1, G - 50, x + 2, G - 46, R['leaf'][1])
    layer_out(cv, lay); cv.outline()
    return cv, cx


@fprop('teller_counter', 'Bank counter', .9, ['indoor'], box=[3.0, 0.8])
def p_teller_counter(rng):
    W, H = 110, 76; G = H - 2; cx = 55; cv = Cv(W, H)
    block(cv, cx - 50, cx + 50, G - 30, G, R['ivory'], R['stone'], top=6)
    for x0 in range(cx - 46, cx + 44, 23): cv.orect(x0 + 2, G - 22, x0 + 20, G - 4, R['ivory'][1])
    lay = Cv(W, H)
    for x in range(cx - 48, cx + 49):
        for y in range(G - 62, G - 30):
            if (x - cx + 48) % 24 in (0, 1): lay.px(x, y, R['brass'][2])
    for x in range(cx - 48, cx + 49): lay.px(x, G - 62, R['brass'][3]); lay.px(x, G - 61, R['brass'][2])
    for xc in (cx - 36, cx - 12, cx + 12, cx + 36):
        lay.rect(xc - 4, G - 38, xc + 4, G - 31, R['brass'][1]); lay.rect(xc - 3, G - 37, xc + 3, G - 35, R['gold'][4])
    layer_out(cv, lay); cv.outline()
    return cv, cx


@fprop('vault_door', 'Vault door', 0, ['indoor'])
def p_vault_door(rng):
    W, H = 70, 70; low = 2; cx = W // 2; cv = Cv(W, H + low); cv.hang = 1
    cv.rect(2, 2, W - 3, H - 3, R['steel'][1])
    for (x, y) in cv.ellpts(cx, 35, 30, 30): cv.px(x, y, R['steel'][3 if x + y < 70 else 2])
    for (x, y) in cv.ellpts(cx, 35, 22, 22): cv.px(x, y, R['steel'][2 if x + y < 70 else 1])
    for k in range(6):
        a = k * math.pi / 3; cv.line(cx, 35, int(cx + math.cos(a) * 14), int(35 + math.sin(a) * 14), R['steel'][4])
    for (x, y) in cv.ellpts(cx, 35, 4, 4): cv.px(x, y, R['brass'][3])
    for y in (14, 56): cv.rect(cx + 24, y - 3, cx + 30, y + 3, R['steel'][0])
    cv.outline()
    return cv, cx


@fprop('reading_desk', 'Reading desk', .6, ['indoor'], box=[1.6, 0.8])
def p_reading_desk(rng):
    W, H = 72, 62; G = H - 2; cx = 36; cv = Cv(W, H)
    block(cv, cx - 32, cx + 32, G - 26, G - 18, R['dwood'], R['wood'], top=4)
    legs(cv, (cx - 30, cx + 28), G, 18, R['dwood'])
    lay = Cv(W, H)
    lay.rect(cx + 14, G - 30, cx + 22, G - 27, R['brass'][2]); lay.rect(cx + 17, G - 44, cx + 18, G - 30, R['brass'][2])
    lay.poly([(cx + 10, G - 44), (cx + 25, G - 44), (cx + 21, G - 52), (cx + 14, G - 52)], R['leaf'][2])
    for x in range(cx - 20, cx + 4): lay.px(x, G - 28 - (1 if abs(x - cx + 8) < 10 else 0), R['ivory'][4 if x < cx - 8 else 3])
    lay.rect(cx - 20, G - 27, cx + 3, G - 26, R['red'][1])
    layer_out(cv, lay); cv.outline(); cv.fx.append(('glow', cx + 17, 16))
    return cv, cx


@fprop('school_desk', 'School desk', .4, ['indoor'], box=[0.9, 0.7])
def p_school_desk(rng):
    W, H = 40, 46; G = H - 2; cx = 20; cv = Cv(W, H)
    block(cv, cx - 16, cx + 16, G - 24, G - 18, R['wood'], R['plank'], top=4)
    legs(cv, (cx - 14, cx + 12), G, 18, R['steel'])
    cv.rect(cx - 10, G - 12, cx + 10, G - 9, R['wood'][1]); legs(cv, (cx - 9, cx + 7), G, 9, R['steel'])
    cv.rect(cx - 6, G - 27, cx + 2, G - 25, R['ivory'][4]); cv.rect(cx + 6, G - 27, cx + 7, G - 25, R['gold'][3])
    cv.outline()
    return cv, cx


@fprop('blackboard', 'Blackboard', 0, ['indoor'])
def p_blackboard(rng):
    W, H = 100, 50; low = 34; cx = W // 2; cv = Cv(W, H + low); cv.hang = 1
    cv.rect(2, 2, W - 3, H - 3, R['wood'][2]); cv.rect(5, 5, W - 6, H - 8, R['chalk'][1])
    for (y, x0, x1) in ((12, 10, 40), (18, 10, 52), (24, 10, 32), (14, 60, 88), (22, 62, 80)):
        for x in range(x0, x1):
            if (x * 7) % 5: cv.px(x, y + ((x // 3) % 2), R['white'][3])
    for (x, y) in cv.ellpts(74, 30, 9, 6):
        if abs(((x - 74) / 9) ** 2 + ((y - 30) / 6) ** 2 - .8) < .25: cv.px(x, y, R['white'][3])
    cv.rect(4, H - 8, W - 5, H - 5, R['wood'][3]); cv.rect(20, H - 10, 26, H - 8, R['white'][4])
    cv.outline()
    return cv, cx


@fprop('wall_map', 'Map on the wall', 0, ['indoor'])
def p_wall_map(rng):
    W, H = 66, 44; low = 44; cx = W // 2; cv = Cv(W, H + low); cv.hang = 1
    cv.rect(2, 2, W - 3, H - 3, R['ivory'][3])
    rr = random.Random(46)
    for (x, y) in cv.ellpts(24, 20, 14, 10): cv.px(x, y, R['leaf'][3] if rr.random() > .1 else R['leaf'][2])
    for (x, y) in cv.ellpts(46, 26, 10, 9): cv.px(x, y, R['sand'][3] if 'sand' in R else R['gold'][3])
    for x in range(6, W - 6):
        y = 30 + int(math.sin(x / 6) * 3)
        if x % 3: cv.px(x, y, R['red'][2])
    for (x, y) in ((24, 18), (46, 26), (14, 30)): cv.rect(x - 1, y - 1, x + 1, y + 1, R['red'][1])
    cv.orect(2, 2, W - 3, H - 3, R['wood'][1])
    cv.outline()
    return cv, cx


@fprop('ticket_window', 'Ticket window', .9, ['indoor'], box=[2.4, 0.8])
def p_ticket_window(rng):
    W, H = 90, 96; G = H - 2; cx = 45; cv = Cv(W, H)
    block(cv, cx - 40, cx + 40, G - 90, G, R['dwood'], R['wood'], top=5)
    cv.rect(cx - 30, G - 70, cx + 30, G - 38, R['pane'][3])
    for x in range(cx - 30, cx + 31):
        if (x - cx) % 20 == 0: cv.rect(x, G - 70, x + 1, G - 38, R['dwood'][1])
    cv.rect(cx - 30, G - 70, cx + 30, G - 62, R['pane'][4])
    cv.rect(cx - 34, G - 38, cx + 34, G - 34, R['brass'][2])
    cv.rect(cx - 26, G - 86, cx + 26, G - 76, R['navy'][2] if 'navy' in R else R['sky'][1])
    for x in range(cx - 22, cx + 22, 3): cv.px(x, G - 81, R['amber'][4])
    cv.outline(); cv.fx.append(('glow', cx, 52))
    return cv, cx


@fprop('timetable_board', 'Departures board', 0, ['indoor'])
def p_timetable_board(rng):
    W, H = 80, 40; low = 60; cx = W // 2; cv = Cv(W, H + low); cv.hang = 1
    cv.rect(2, 2, W - 3, H - 3, R['board'][1]); cv.orect(2, 2, W - 3, H - 3, R['steel'][3])
    rr = random.Random(7)
    for row in range(4):
        y = 8 + row * 7
        for x in range(6, W - 6):
            if x in (30, 31) or rr.random() < .25: continue
            cv.px(x, y, R['amber'][4 if x < 30 else 3]); cv.px(x, y + 1, R['amber'][3 if x < 30 else 2])
    cv.outline(); cv.fx.append(('glow', cx, 20))
    return cv, cx


@fprop('piano', 'Piano', .7, ['indoor'], box=[1.6, 0.7])
def p_piano(rng):
    W, H = 72, 70; G = H - 2; cx = 36; cv = Cv(W, H)
    block(cv, cx - 32, cx + 32, G - 66, G - 4, R['board'], R['board'], top=5)
    cv.rect(cx - 30, G - 36, cx + 30, G - 30, R['ivory'][4])
    for x in range(cx - 29, cx + 30, 4):
        cv.px(x, G - 36, R['board'][0]); cv.px(x, G - 35, R['board'][0])
        if (x // 4) % 7 not in (2, 6): cv.rect(x + 1, G - 36, x + 2, G - 33, R['board'][0])
    cv.rect(cx - 32, G - 30, cx + 32, G - 27, R['board'][2])
    legs(cv, (cx - 28, cx + 26), G, 4, R['board'])
    cv.rect(cx - 8, G - 58, cx + 8, G - 48, R['ivory'][3]); cv.rect(cx - 7, G - 56, cx + 7, G - 55, R['board'][1])
    for x in (cx - 22, cx + 20): cv.rect(x, G - 62, x + 2, G - 58, R['brass'][3])
    cv.outline()
    return cv, cx


@fprop('armchair', 'Armchair', .4, ['indoor'], box=[0.9, 0.8])
def p_armchair(rng):
    W, H = 44, 46; G = H - 2; cx = 22; cv = Cv(W, H)
    block(cv, cx - 16, cx + 16, G - 40, G - 16, R['velvet'], R['velvet'], top=4)
    block(cv, cx - 15, cx + 15, G - 22, G - 4, R['velvet'], R['velvet'], top=5)
    for x0 in (cx - 20, cx + 13): block(cv, x0, x0 + 7, G - 28, G - 4, R['velvet'], R['velvet'], top=3)
    for x0 in (cx - 17, cx + 14): cv.rect(x0, G - 3, x0 + 2, G, R['dwood'][1])
    cv.outline()
    return cv, cx


@fprop('dresser', 'Chest of drawers', .5, ['indoor'], box=[1.2, 0.6])
def p_dresser(rng):
    W, H = 56, 60; G = H - 2; cx = 28; cv = Cv(W, H)
    block(cv, cx - 24, cx + 24, G - 44, G - 3, R['wood'], R['plank'], top=4)
    for k in range(3):
        y = G - 36 + k * 11; cv.orect(cx - 21, y, cx + 21, y + 9, R['wood'][1]); cv.rect(cx - 3, y + 4, cx + 3, y + 5, R['brass'][3])
    legs(cv, (cx - 23, cx + 21), G, 3, R['dwood'])
    lay = Cv(W, H)
    for (x, y) in lay.ellpts(cx - 12, G - 52, 5, 6): lay.px(x, y, R['pot'][2])
    for (x, y) in lay.ellpts(cx - 12, G - 58, 6, 3): lay.px(x, y, R['leaf'][3])
    lay.rect(cx + 6, G - 56, cx + 16, G - 48, R['gold'][2]); lay.rect(cx + 8, G - 54, cx + 14, G - 50, R['sky'][3])
    layer_out(cv, lay); cv.outline()
    return cv, cx


@fprop('trophy_case', 'Glass cabinet', .5, ['indoor'], box=[1.4, 0.6])
def p_trophy_case(rng):
    W, H = 62, 90; G = H - 2; cx = 31; cv = Cv(W, H)
    block(cv, cx - 27, cx + 27, G - 84, G, R['dwood'], R['wood'], top=4)
    cv.rect(cx - 23, G - 76, cx + 23, G - 8, R['pane'][2])
    for k in range(3):
        y = G - 56 + k * 22; cv.rect(cx - 23, y, cx + 23, y + 1, R['dwood'][2])
        for x in (cx - 15, cx, cx + 15):
            cv.rect(x - 3, y - 9, x + 3, y - 4, R['gold'][3 if x < cx + 10 else 2]); cv.rect(x - 1, y - 4, x + 1, y - 1, R['gold'][2])
    for y in range(G - 76, G - 8, 3): cv.px(cx - 20 + (y % 7), y, R['white'][4])
    cv.outline()
    return cv, cx


@fprop('ski_rack', 'Rack of skis', .3, ['indoor', 'snow'], box=[1.4, 0.4])
def p_ski_rack(rng):
    W, H = 64, 80; G = H - 2; cx = 32; cv = Cv(W, H)
    for k, x in enumerate(range(cx - 24, cx + 24, 8)):
        c = R['skired'] if k % 2 else R['skiblue']
        for y in range(G - 72, G - 2):
            cv.px(x, y, c[3]); cv.px(x + 1, y, c[2]); cv.px(x + 3, y, c[3]); cv.px(x + 4, y, c[2])
        for xx in range(x, x + 5): cv.px(xx, G - 73 - (1 if xx in (x + 1, x + 4) else 0), c[4])
    block(cv, cx - 28, cx + 28, G - 22, G - 16, R['wood'], R['plank'], top=3)
    legs(cv, (cx - 27, cx + 25), G, 16, R['dwood'])
    cv.outline()
    return cv, cx


@fprop('potting_bench', 'Potting bench', .5, ['indoor', 'farm'], box=[2.0, 0.7])
def p_potting_bench(rng):
    W, H = 84, 58; G = H - 2; cx = 42; cv = Cv(W, H)
    block(cv, cx - 38, cx + 38, G - 26, G - 20, R['wood'], R['plank'], top=4)
    legs(cv, (cx - 36, cx + 34), G, 20, R['dwood']); cv.rect(cx - 36, G - 8, cx + 36, G - 6, R['wood'][1])
    lay = Cv(W, H)
    for k, x in enumerate(range(cx - 30, cx + 31, 15)):
        lay.poly([(x - 5, G - 36), (x + 5, G - 36), (x + 4, G - 27), (x - 4, G - 27)], R['pot'][2])
        for (px_, py_) in lay.ellpts(x, G - 41, 7, 6):
            if py_ < G - 36: lay.px(px_, py_, R['green2'][3 if py_ < G - 42 else 2])
        if k % 2: lay.px(x, G - 46, R['red'][3]); lay.px(x + 3, G - 43, R['gold'][4])
    for x in (cx - 26, cx + 20): lay.rect(x, G - 6, x + 8, G - 1, R['soil'][2])
    layer_out(cv, lay); cv.outline()
    return cv, cx


@fprop('fire_pole', 'Fire pole', .1, ['indoor'], solid=0.2)
def p_fire_pole(rng):
    W, H = 20, 120; G = H - 2; cx = 10; cv = Cv(W, H)
    for y in range(2, G - 2): cv.px(cx - 1, y, R['brass'][4]); cv.px(cx, y, R['brass'][3]); cv.px(cx + 1, y, R['brass'][2])
    for (x, y) in cv.ellpts(cx, G - 1, 7, 2): cv.px(x, y, R['skired'][2])
    cv.outline()
    return cv, cx


def load_data():
    src = gamedata.js_text(); i = src.index('window.GAMEDATA=')
    return src[:i], json.JSONDecoder().raw_decode(src[i + len('window.GAMEDATA='):])[0]


def save_data(head, D):
    gamedata.save_js(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n')


def main():
    args = sys.argv[1:]; sp = None
    if '--sheet' in args: i = args.index('--sheet'); sp = args[i + 1]; del args[i:i + 2]
    force = '--force' in args; keys = [a for a in args if a != '--force'] or None
    meta, written = {}, []
    for key in NEW:
        cv, bx, img = bsp.render(key); path = os.path.join(OUT, key + '.png')
        if (keys is None or key in keys) and bsp.save_png(img, path, force and (keys is None or key in keys)): written.append(key)
        disk = Image.open(path)
        meta[key] = bsp.prop_meta(key, cv, bx, disk if disk.size != img.size else img)
    Pm = json.load(open(META)); padd = []
    for k, m in meta.items():
        if k not in Pm or force: Pm[k] = m; padd.append(k)
    bsp.write_json(META, Pm)
    head, D = load_data(); cat = D['scenery']['props']; cadd = []
    for k, m in meta.items():
        if k in cat and not force: continue
        e = dict(name=m['name'], img='scene/props/%s.png' % k, ox=m['ox'], oy=m['oy'], shadow=m['shadow'], sway=0, flat=m.get('flat', 0), tags=m['tags'], group=m['group'])
        for f in ('box', 'fx', 'solid', 'hang'):
            if m.get(f): e[f] = m[f]
        cat[k] = e; cadd.append(k)
    save_data(head, D)
    print(f'{len(NEW)} pieces of furniture; pictures written: {len(written)}; props.json added: {len(padd)}; catalogue added: {", ".join(cadd) or "none"}')
    if sp:
        from PIL import ImageDraw
        W = 1400; x = y = 10; rowh = 0; out = Image.new('RGBA', (W, 1600), (200, 180, 150, 255)); d = ImageDraw.Draw(out)
        for k in NEW:
            im = Image.open(os.path.join(OUT, k + '.png')).convert('RGBA'); im = im.resize((im.width * 2, im.height * 2), Image.NEAREST)
            if x + im.width > W: x = 10; y += rowh + 24; rowh = 0
            d.text((x, y), k, fill=(20, 20, 30)); out.alpha_composite(im, (x, y + 14)); rowh = max(rowh, im.height + 14); x += im.width + 20
        out.crop((0, 0, W, y + rowh + 30)).save(sp); print('sheet', sp)


if __name__ == '__main__':
    main()
