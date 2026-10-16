# ============================================================================= v26: ROOMS YOU CAN WALK INTO
# Loaded by build-scene-props.py (exec) after the v24 props, so every helper there is available here.
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
