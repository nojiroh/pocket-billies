# ============================================================================= v24: ISLAND, VOLCANO AND MOUNTAIN PROPS
# Loaded by build-scene-props.py (exec) after the v17 props, so every helper there is available here.

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
