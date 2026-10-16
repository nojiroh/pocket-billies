# ============================================================================= v17: CITY, LIFE AND NATURE PROPS
# Loaded by build-scene-props.py (exec), so every helper there (Cv, R, ramp, wall, window, door, awning, tile_roof,
# gable_roof, stone_band, blob, leafy, trunk, ball, vprop ...) is available here.
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
