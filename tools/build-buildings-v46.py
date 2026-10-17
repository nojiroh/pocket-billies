#!/usr/bin/env python3
"""v46: the building kit. Twelve new kinds of building, drawn with the scene-prop kit (tools/build-scene-props.py: the
same walls, roofs, windows, doors and ramps as the town's houses), each with a 3D plan, and colour variants of the
23 buildings there were. Pictures that already exist are kept (a front you painted over is never redrawn).

    python3 tools/build-buildings-v46.py                # draws what is missing, adds it to props.json and game data
    python3 tools/build-buildings-v46.py --sheet out.png
    python3 tools/build-buildings-v46.py bakery --force  # redraws one

New kinds: bakery, inn, market hall, bank (Savings & Loan), library, school, train station, fire station, mansion,
barn, greenhouse, ski lodge. (The lighthouse and the windmill were already props.)

Variants: every building gets 3 to 5 colour sets (game data: build.variants, each {wallCol, roofCol, trimCol, img,
extra}); a placed building picks one with "v" (1, 2, ...; none or 0 = the picture as it was). A variant's front is the
original picture with its wall, roof and trim tones moved to the new colours, plus now and then shutters, window boxes
or an awning painted on; the 3D walls and roof take the same colours.
"""
import gamedata  # phase 04b: the data files in game/data
import os, sys, json, math, random, zlib, importlib.util
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
spec = importlib.util.spec_from_file_location('bsp', os.path.join(HERE, 'build-scene-props.py')); bsp = importlib.util.module_from_spec(spec); spec.loader.exec_module(bsp)
spec2 = importlib.util.spec_from_file_location('bbld', os.path.join(HERE, 'build-buildings.py')); bbld = importlib.util.module_from_spec(spec2); spec2.loader.exec_module(bbld)
g = vars(bsp)
Cv, R, P, ramp = bsp.Cv, bsp.R, bsp.P, bsp.ramp
wall, tile_roof, gable_roof, window, door, door_step, stone_band, awning, chimney, shutters, wall_lamp, shade_below = (g[k] for k in (
    'wall', 'tile_roof', 'gable_roof', 'window', 'door', 'door_step', 'stone_band', 'awning', 'chimney', 'shutters', 'wall_lamp', 'shade_below'))
band, cornice, roof_top, glass_doors, quoins, v17_plan, coin_emblem, layer_out, glow_box, shop_window, snow_cap = (g[k] for k in (
    'band', 'cornice', 'roof_top', 'glass_doors', 'quoins', 'v17_plan', 'coin_emblem', 'layer_out', 'glow_box', 'shop_window', 'snow_cap'))
OUT, META = bsp.OUT, bsp.META
DATA = os.path.join(ROOT, 'game', 'data', 'gamedata.js')

R.update({k: ramp(v) for k, v in dict(
    peach=(236, 196, 160), bread=(214, 150, 84), timber=(96, 64, 44), plaster=(232, 222, 200), navy=(60, 78, 120), firered=(196, 58, 48),
    barnred=(168, 56, 46), sage2=(150, 176, 140), pane=(176, 214, 230), pine=(130, 92, 60), slate2=(84, 92, 112), mint=(150, 210, 190),
    ochre=(212, 168, 82), rose=(214, 140, 140), plum2=(120, 84, 120)).items()})
HX = lambda c: '#%02X%02X%02X' % tuple(c)
NEW = {}


def bprop(key, name, tags, box, group=None):
    def deco(fn):
        d = dict(fn=fn, name=name, shadow=1.8, sway=0, tags=tags, flat=0, group=group or key, solid=0, box=box, posts=None)
        NEW[key] = d; bsp.PROPS[key] = d
        return fn
    return deco


def sign_board(cv, cx, y, w, Rb, Rt, icon=None):
    """a painted board over the door"""
    cv.rect(cx - w // 2, y, cx + w // 2, y + 12, Rb[2]); cv.orect(cx - w // 2 - 1, y - 1, cx + w // 2 + 1, y + 13, Rb[0])
    cv.rect(cx - w // 2 + 2, y + 2, cx + w // 2 - 2, y + 2, Rb[3])
    if icon: icon(cv, cx, y + 6)
    else:
        for k in range(-w // 2 + 6, w // 2 - 5, 4): cv.rect(cx + k, y + 5, cx + k + 2, y + 7, Rt[3])


def bread_icon(cv, cx, cy):
    for (x, y) in cv.ellpts(cx, cy, 7, 3): cv.px(x, y, R['bread'][3 if y < cy else 2])
    for k in (-3, 0, 3): cv.px(cx + k, cy - 1, R['bread'][1])


def book_icon(cv, cx, cy):
    cv.rect(cx - 7, cy - 4, cx - 1, cy + 3, R['white'][3]); cv.rect(cx + 1, cy - 4, cx + 7, cy + 3, R['white'][2]); cv.rect(cx, cy - 4, cx, cy + 3, R['dwood'][1])


def bell_icon(cv, cx, cy):
    cv.poly([(cx - 5, cy + 4), (cx, cy - 5), (cx + 5, cy + 4)], lambda x, y: R['gold'][3 if x < cx else 2]); cv.px(cx, cy + 5, R['gold'][1])


def timber_frame(cv, x0, x1, y0, y1, Rt, step=26):
    """dark beams over a plastered upper floor: posts, a rail and crosses"""
    for x in range(x0, x1 + 1, step): cv.rect(x, y0, x + 2, y1, Rt[1])
    cv.rect(x0, y0, x1, y0 + 2, Rt[1]); cv.rect(x0, (y0 + y1) // 2, x1, (y0 + y1) // 2 + 1, Rt[2])
    for x in range(x0, x1 - step + 1, step * 2):
        for k in range(step):
            yy = y0 + int(k * (y1 - y0) / step)
            if (y0 + y1) // 2 - 2 < yy < (y0 + y1) // 2 + 3: continue
            cv.px(x + k, yy, Rt[1])


def columns(cv, xs, y0, y1, Rc, w=10):
    for x in xs:
        for y in range(y0, y1):
            for xx in range(x, x + w): cv.px(xx, y, Rc[[4, 3, 3, 2, 2, 2, 2, 1, 1, 0, 0, 0][min(11, (xx - x) * 12 // w)]])
        cv.rect(x - 3, y0 - 4, x + w + 2, y0, Rc[3]); cv.rect(x - 3, y1, x + w + 2, y1 + 4, Rc[2])


# ----------------------------------------------------------------------------- the new kinds
@bprop('bakery', 'Bakery', ['town', 'farm'], [4.0, 2.8], group='shop_town')
def p_bakery(rng):
    W, H = 176, 220; G = H - 2; cx = 88
    cv = Cv(W, H); x0, x1 = 20, 156; top = G - 150
    wall(cv, x0, top, x1, G - 70, R['peach'], siding=0, eave=4)
    stone_band(cv, x0, x1, G - 70, G - 6, R['stone'], bw=10, bh=5)
    stone_band(cv, x0 - 2, x1 + 2, G - 5, G, R['stone'])
    tile_roof(cv, 18, top + 4, x0 + 26, x1 - 26, x0 - 12, x1 + 12, R['terra'], tw=8)
    shade_below(cv, x0, x1, top + 5, 3)
    sm = chimney(cv, x1 - 40, x1 - 28, 8, top - 4, R['brick'])
    for x in (x0 + 16, x1 - 42): window(cv, x, top + 18, 26, 30, Rf=R['white'], rng=rng, box=['gold', 'coral', 'pink'])
    shop_window(cv, x0 + 10, G - 60, 62, 40, rng)
    dc = x1 - 38
    door(cv, dc, G - 6, 26, 50, Rw=R['bread'], Rfr=R['white'], arch=False)
    door_step(cv, dc, G, 15)
    awning(cv, x0 + 4, x1 - 4, G - 72, 14, R['bread'], R['cream'], sw=7, slope=5)
    sign_board(cv, cx, top + 54, 52, R['dwood'], R['cream'], bread_icon)
    wall_lamp(cv, dc - 20, G - 44)
    cv.outline(); cv.door = dc; cv.fx.append(('smoke',) + sm)
    v17_plan(cv, kind='hip', wall=[x0, x1], eave=top + 4, pitch=36, over=.32, roofCol=P['terra'], roofTex=8, wallCol=(236, 196, 160), wallTex=0, trimCol=P['dwood'], floors=2, rooms=[3, 0],
             base=dict(col=HX(P['stone']), tex=3, h=2.0), chimney=dict(x=x1 - 34, top=8, w=.36, col=P['brick'], tex=2))
    return cv, cx


@bprop('inn', 'Inn', ['town', 'snow', 'mountain'], [5.6, 3.4], group='inn')
def p_inn(rng):
    W, H = 232, 262; G = H - 2; cx = 116
    cv = Cv(W, H); x0, x1 = 22, 210; top = G - 186
    wall(cv, x0, top, x1, G - 92, R['plaster'], siding=0, eave=4)
    timber_frame(cv, x0, x1, top + 4, G - 94, R['timber'], 30)
    stone_band(cv, x0, x1, G - 92, G - 6, R['stone'], bw=12, bh=6)
    stone_band(cv, x0 - 2, x1 + 2, G - 5, G, R['stone'])
    band(cv, x0 - 4, x1 + 4, G - 94, R['timber'], (2, 1, 0, 1), over=4)
    tile_roof(cv, 14, top + 4, x0 + 34, x1 - 34, x0 - 14, x1 + 14, R['slate2'], tw=9)
    shade_below(cv, x0, x1, top + 5, 3)
    sm = chimney(cv, x0 + 30, x0 + 44, 4, top - 6, R['stone'], brick=False)
    for x in (x0 + 16, x0 + 70, x1 - 96, x1 - 42): window(cv, x, top + 30, 24, 32, Rf=R['timber'], rng=rng, box=['coral', 'gold', 'pink', 'lilac'])
    for x in (x0 + 18, x1 - 48): window(cv, x, G - 74, 30, 36, Rf=R['timber'], rng=rng)
    door(cv, cx, G - 6, 30, 56, Rw=R['dwood'], arch=True, glass=True)
    door_step(cv, cx, G, 18)
    # the hanging sign on its bracket
    sg = Cv(W, H)
    for x in range(cx + 20, cx + 44): sg.px(x, G - 100, R['iron'][2])
    sg.rect(cx + 28, G - 98, cx + 46, G - 80, R['wood'][2]); sg.orect(cx + 27, G - 99, cx + 47, G - 79, R['wood'][0])
    for (x, y) in sg.ellpts(cx + 37, G - 89, 5, 5): sg.px(x, y, R['gold'][3])
    sg.outline(); cv.paste(sg)
    wall_lamp(cv, cx - 26, G - 48); wall_lamp(cv, cx + 26, G - 48)
    cv.outline(); cv.door = cx; cv.fx.append(('smoke',) + sm)
    v17_plan(cv, kind='hip', wall=[x0, x1], eave=top + 4, pitch=40, over=.36, roofCol=(84, 92, 112), roofTex=10, wallCol=(232, 222, 200), wallTex=0, trimCol=(96, 64, 44), floors=2, rooms=[0, 5],
             base=dict(col=HX(P['stone']), tex=3, h=2.7), chimney=dict(x=x0 + 37, top=4, w=.42, col=P['stone'], tex=3))
    return cv, cx


@bprop('market_hall', 'Market hall', ['town', 'city'], [6.4, 3.6], group='market_hall')
def p_market_hall(rng):
    W, H = 260, 210; G = H - 2; cx = 130
    cv = Cv(W, H); x0, x1 = 20, 240; top = G - 130
    stone_band(cv, x0, x1, top, G - 6, R['sand'] if 'sand' in R else R['hay'], bw=14, bh=6)
    stone_band(cv, x0 - 2, x1 + 2, G - 5, G, R['stone'])
    # three open arches with stalls glimpsed inside
    for i in range(3):
        ax = x0 + 26 + i * 66; aw = 52
        for y in range(top + 30, G - 5):
            for x in range(ax, ax + aw):
                r = aw / 2; dy = (top + 30 + r) - y
                if dy > 0 and (x + .5 - ax - r) ** 2 + dy ** 2 > r * r: continue
                cv.px(x, y, R['iron'][0] if y < G - 30 else R['dwood'][1])
        for x in range(ax + 6, ax + aw - 6, 10): cv.rect(x, G - 28, x + 6, G - 22, R[rng.choice(['coral', 'gold', 'teal', 'pink'])][3])
        cv.rect(ax + 4, G - 22, ax + aw - 4, G - 20, R['wood'][2])
    gable_roof_l = tile_roof
    gable_roof_l(cv, 30, top + 4, x0 + 10, x1 - 10, x0 - 14, x1 + 14, R['terra'], tw=10)
    shade_below(cv, x0, x1, top + 5, 3)
    cv.rect(cx - 12, 34, cx + 12, 54, R['white'][2]); cv.orect(cx - 13, 33, cx + 13, 55, R['dwood'][0])
    for (x, y) in cv.ellpts(cx, 44, 7, 7): cv.px(x, y, R['white'][4])
    cv.px(cx, 40, R['iron'][0]); cv.px(cx, 41, R['iron'][0]); cv.px(cx + 1, 44, R['iron'][0]); cv.px(cx + 2, 44, R['iron'][0])
    cv.outline(); cv.door = cx
    v17_plan(cv, kind='gable', wall=[x0, x1], eave=top + 4, pitch=30, over=.4, roofCol=P['terra'], roofTex=8, wallCol=(222, 200, 150), wallTex=3, trimCol=P['dwood'], floors=1, rooms=[3], sideWin=False)
    return cv, cx


@bprop('bank', 'Savings & Loan', ['city', 'town', 'island'], [5.6, 3.4], group='bank')
def p_bank(rng):
    W, H = 220, 230; G = H - 2; cx = 110
    cv = Cv(W, H); x0, x1 = 20, 200; top = G - 160
    stone_band(cv, x0, x1, top, G - 12, R['marble'], bw=16, bh=8)
    for k in range(3):
        y = G - 12 + k * 4
        for x in range(x0 - 4 - k * 4, x1 + 5 + k * 4):
            for yy in range(y, min(G + 1, y + 4)): cv.px(x, yy, R['stone'][3 if yy == y else 2])
    cornice(cv, x0, x1, top - 12, 12, R['white'], over=6)
    roof_top(cv, x0 - 4, x1 + 4, top - 22, top - 13, R['stone'])
    pd = Cv(W, H); pts = [(cx - 60, top - 12), (cx, top - 46), (cx + 60, top - 12)]
    pd.poly(pts, lambda x, y: R['white'][3 if y < top - 40 + abs(x - cx) * .2 else 2]); coin_emblem(pd, cx, top - 26, 10); layer_out(cv, pd)
    columns(cv, [x0 + 14, x0 + 54, x1 - 64, x1 - 24], top + 4, G - 14, R['marble'], 12)
    for x in (x0 + 30, x1 - 48): window(cv, x, top + 30, 18, 60, Rf=R['white'], cross=True, sill=True)
    door(cv, cx, G - 12, 36, 70, Rw=R['dwood'], arch=True, glass=True)
    for x in (cx - 30, cx + 30): glow_box(cv, x - 3, G - 76, 7, 9); cv.fx.append(('glow', x, G - 72))
    cv.outline(); cv.door = cx
    v17_plan(cv, kind='flat', wall=[x0, x1], eave=top - 12, roofCol=P['stone'], roofTex=13, wallCol=P['marble'], wallTex=3, trimCol=P['white'], floors=2, rooms=[4, 7])
    return cv, cx


@bprop('library', 'Library', ['city', 'town'], [5.4, 3.4], group='library')
def p_library(rng):
    W, H = 216, 250; G = H - 2; cx = 108
    cv = Cv(W, H); x0, x1 = 22, 194; top = G - 176
    wall(cv, x0, top, x1, G - 8, R['brick'], siding=0, eave=4); stone_band(cv, x0, x1, top + 4, G - 8, R['brick'], bw=10, bh=5)
    quoins(cv, x0, x1, top + 4, G - 8, R['white'])
    stone_band(cv, x0 - 2, x1 + 2, G - 7, G, R['stone'])
    tile_roof(cv, 20, top + 4, x0 + 36, x1 - 36, x0 - 14, x1 + 14, R['slate2'], tw=9)
    shade_below(cv, x0, x1, top + 5, 3)
    for x in (x0 + 18, x0 + 54, x1 - 80, x1 - 44):
        window(cv, x, top + 24, 22, 108, Rf=R['white'], cross=True, sill=True)
        for (xx, y) in cv.ellpts(x + 11, top + 24, 11, 9):
            if y < top + 24: cv.px(xx, y, R['glass'][2])
    door(cv, cx, G - 8, 32, 60, Rw=R['dwood'], arch=True, glass=True)
    for k in range(3): cv.rect(cx - 24 - k * 4, G - 8 + k * 2, cx + 24 + k * 4, G - 7 + k * 2, R['stone'][3 - k])
    sign_board(cv, cx, top + 12, 48, R['dwood'], R['gold'], book_icon)
    cv.outline(); cv.door = cx
    v17_plan(cv, kind='hip', wall=[x0, x1], eave=top + 4, pitch=34, over=.3, roofCol=(84, 92, 112), roofTex=10, wallCol=P['brick'], wallTex=2, trimCol=P['white'], floors=2, rooms=[4, 4])
    return cv, cx


@bprop('school', 'School', ['city', 'town'], [6.6, 3.6], group='school')
def p_school(rng):
    W, H = 268, 238; G = H - 2; cx = 134
    cv = Cv(W, H); x0, x1 = 20, 248; top = G - 168
    wall(cv, x0, top, x1, G - 6, R['brick'], siding=0, eave=4); stone_band(cv, x0, x1, top + 4, G - 6, R['brick'], bw=10, bh=5)
    stone_band(cv, x0 - 2, x1 + 2, G - 5, G, R['stone'])
    for y in (top + 4, G - 86): band(cv, x0, x1, y, R['white'], (4, 3, 2))
    cornice(cv, x0, x1, top - 8, 8, R['white'], over=4); roof_top(cv, x0 - 2, x1 + 2, top - 16, top - 9, R['stone'])
    for row, wy in enumerate((top + 18, G - 72)):
        for i in range(5):
            x = x0 + 14 + i * 44
            if row == 1 and i == 2: continue
            window(cv, x, wy, 28, 40, Rf=R['white'], cross=True, sill=True)
    # the bell turret
    cv.rect(cx - 12, top - 46, cx + 12, top - 16, R['white'][2]); cv.orect(cx - 13, top - 47, cx + 13, top - 15, R['dwood'][0])
    cv.poly([(cx - 16, top - 46), (cx, top - 64), (cx + 16, top - 46)], lambda x, y: R['slate2'][3 if x < cx else 1])
    bell_icon(cv, cx, top - 32)
    door(cv, cx, G - 6, 34, 58, Rw=R['teal'], arch=False, glass=True)
    door_step(cv, cx, G, 20)
    cv.outline(); cv.door = cx
    v17_plan(cv, kind='flat', wall=[x0, x1], eave=top - 8, roofCol=P['stone'], roofTex=13, wallCol=P['brick'], wallTex=2, trimCol=P['white'], floors=2, rooms=[4, 0])
    return cv, cx


@bprop('station', 'Train station', ['city', 'town'], [7.2, 3.6], group='station')
def p_station(rng):
    W, H = 290, 214; G = H - 2; cx = 145
    cv = Cv(W, H); x0, x1 = 24, 266; top = G - 140
    wall(cv, x0, top, x1, G - 6, R['cream'], siding=0, eave=4); stone_band(cv, x0, x1, G - 40, G - 6, R['stone'], bw=12, bh=6)
    stone_band(cv, x0 - 2, x1 + 2, G - 5, G, R['stone'])
    cornice(cv, x0, x1, top - 8, 8, R['dwood'], over=4); roof_top(cv, x0 - 2, x1 + 2, top - 16, top - 9, R['slate2'])
    for x in (x0 + 14, x0 + 60, x1 - 94, x1 - 48): window(cv, x, top + 24, 30, 44, Rf=R['dwood'], cross=True, sill=False)
    glass_doors(cv, cx, G - 6, 54, 58, R['dwood'], n=3)
    # the canopy over the door and the clock above it
    cv.rect(cx - 70, G - 74, cx + 70, G - 68, R['iron'][2]); cv.rect(cx - 70, G - 68, cx + 70, G - 66, R['iron'][0])
    for x in (cx - 64, cx + 62): cv.rect(x, G - 66, x + 2, G - 6, R['iron'][1])
    for (x, y) in cv.ellpts(cx, top + 22, 11, 11): cv.px(x, y, R['white'][4] if (x - cx) ** 2 + (y - top - 22) ** 2 < 80 else R['dwood'][1])
    cv.rect(cx, top + 15, cx, top + 22, R['iron'][0]); cv.rect(cx, top + 22, cx + 5, top + 22, R['iron'][0])
    cv.outline(); cv.door = cx
    v17_plan(cv, kind='flat', wall=[x0, x1], eave=top - 8, roofCol=(84, 92, 112), roofTex=13, wallCol=P['cream'], wallTex=0, trimCol=P['dwood'], floors=1, rooms=[4],
             base=dict(col=HX(P['stone']), tex=3, h=1.0))
    return cv, cx


@bprop('fire_station', 'Fire station', ['city', 'town'], [5.6, 3.6], group='fire_station')
def p_fire_station(rng):
    W, H = 224, 262; G = H - 2; cx = 100
    cv = Cv(W, H); x0, x1 = 20, 204; top = G - 160
    wall(cv, x0, top, x1, G - 6, R['brick'], siding=0, eave=4); stone_band(cv, x0, x1, top + 4, G - 6, R['brick'], bw=10, bh=5)
    stone_band(cv, x0 - 2, x1 + 2, G - 5, G, R['stone'])
    cornice(cv, x0, x1, top - 8, 8, R['white'], over=4); roof_top(cv, x0 - 2, x1 + 2, top - 16, top - 9, R['stone'])
    # the hose tower
    tx0, tx1 = x1 - 44, x1 - 4
    wall(cv, tx0, top - 70, tx1, top, R['brick'], siding=0, eave=2); stone_band(cv, tx0, tx1, top - 68, top, R['brick'], bw=8, bh=4)
    window(cv, tx0 + 12, top - 56, 16, 24, Rf=R['white'], cross=False, sill=False)
    cv.rect(tx0 - 3, top - 76, tx1 + 3, top - 70, R['firered'][2])
    # two big red doors
    for k in range(2):
        gx = x0 + 18 + k * 74
        for y in range(G - 80, G - 6):
            for x in range(gx, gx + 62): cv.px(x, y, R['firered'][3 if (y - (G - 80)) % 10 == 0 else 2 if x < gx + 58 else 1])
        cv.orect(gx - 1, G - 81, gx + 62, G - 6, R['white'][2])
        for x in range(gx + 4, gx + 58, 14): cv.rect(x, G - 74, x + 10, G - 62, R['glass'][2])
    for x in (x0 + 18, x0 + 92): window(cv, x, top + 18, 28, 36, Rf=R['white'], cross=True, sill=True)
    dc = x1 - 24
    door(cv, dc, G - 6, 22, 46, Rw=R['firered'], arch=False, glass=True)
    cv.outline(); cv.door = dc
    v17_plan(cv, kind='flat', wall=[x0, x1], eave=top - 8, roofCol=P['stone'], roofTex=13, wallCol=P['brick'], wallTex=2, trimCol=P['white'], floors=2, rooms=[0, 7])
    return cv, cx


@bprop('mansion', 'Mansion', ['island', 'town', 'snow'], [7.4, 4.4], group='mansion')
def p_mansion(rng):
    W, H = 300, 300; G = H - 2; cx = 150
    cv = Cv(W, H); x0, x1 = 26, 274; top = G - 222
    wall(cv, x0, top, x1, G - 8, R['white'], siding=0, eave=4); quoins(cv, x0, x1, top + 4, G - 8, R['stone'])
    stone_band(cv, x0 - 2, x1 + 2, G - 7, G, R['stone'])
    for y in (G - 86, G - 156): band(cv, x0, x1, y, R['stone'], (3, 2, 1))
    tile_roof(cv, 18, top + 4, x0 + 50, x1 - 50, x0 - 16, x1 + 16, R['slate2'], tw=10)
    shade_below(cv, x0, x1, top + 5, 3)
    for sx in (x0 + 40, x1 - 54): chimney(cv, sx, sx + 14, 10, top - 2, R['brick'])
    for row, wy in enumerate((top + 16, G - 148, G - 78)):
        for i in range(6):
            x = x0 + 16 + i * 40
            if row == 2 and i in (2, 3): continue
            window(cv, x, wy, 22, 40, Rf=R['white'], cross=True, sill=True, rng=rng, box=(['pink', 'coral', 'gold'] if row == 1 else None))
            shutters(cv, x, wy, 22, 40, R['navy'])
    # the porch: columns and a little pediment
    columns(cv, [cx - 46, cx - 22, cx + 12, cx + 36], G - 84, G - 10, R['white'], 10)
    cv.poly([(cx - 54, G - 88), (cx, G - 112), (cx + 54, G - 88)], lambda x, y: R['white'][3 if y < G - 104 + abs(x - cx) * .3 else 2])
    door(cv, cx, G - 8, 30, 58, Rw=R['navy'], arch=True, glass=True)
    for x in (cx - 30, cx + 30): wall_lamp(cv, x, G - 56)
    cv.outline(); cv.door = cx
    v17_plan(cv, kind='hip', wall=[x0, x1], eave=top + 4, pitch=34, over=.4, roofCol=(84, 92, 112), roofTex=10, wallCol=P['white'], wallTex=0, trimCol=(60, 78, 120), floors=3, rooms=[0, 1, 2, 5])
    return cv, cx


@bprop('barn', 'Barn', ['farm'], [5.4, 4.0], group='barn')
def p_barn(rng):
    W, H = 220, 250; G = H - 2; cx = 110
    cv = Cv(W, H); x0, x1 = 24, 196
    yb = G - 120; ay = yb - 92; xl, xr = x0 - 16, x1 + 16; T = 18
    for y in range(ay + 10, G - 5):
        for x in range(x0, x1 + 1):
            # a gambrel's two slopes: steep at the sides, shallow at the top
            d = abs(x + .5 - cx); ey = (ay + 10 + d * .45) if d < 52 else (ay + 10 + 52 * .45 + (d - 52) * 1.6)
            if y + .5 < ey: continue
            t = 3 if x == x0 else 1 if x >= x1 - 1 else 2
            if (x - x0) % 8 == 0: t = max(0, t - 1)
            cv.px(x, y, R['barnred'][t])
    stone_band(cv, x0 - 2, x1 + 2, G - 5, G, R['stone'])
    # the roof edge, the big doors with their white crosses, the loft door
    for x in range(xl, xr + 1):
        d = abs(x + .5 - cx); ey = (ay + 10 + d * .45) if d < 52 else (ay + 10 + 52 * .45 + (d - 52) * 1.6)
        for k in range(6): cv.px(x, int(ey) - k + 2, R['slate2'][3 if k < 2 else 2])
    dx0, dx1 = cx - 40, cx + 40
    cv.rect(dx0, G - 92, dx1, G - 6, R['barnred'][1]); cv.orect(dx0 - 2, G - 94, dx1 + 2, G - 6, R['white'][3])
    for (a, b) in ((dx0, cx), (cx, dx1)):
        for k in range(86):
            t = k / 85; cv.px(int(a + (b - a) * t), G - 92 + k, R['white'][3]); cv.px(int(b - (b - a) * t), G - 92 + k, R['white'][3])
        cv.rect(a, G - 50, b, G - 48, R['white'][3])
    cv.rect(cx - 16, ay + 46, cx + 16, ay + 76, R['dwood'][1]); cv.orect(cx - 18, ay + 44, cx + 18, ay + 78, R['white'][3])
    for k in range(10): cv.px(cx - 14 + rng.randrange(28), ay + 70 + rng.randrange(6), R['hay'][3])
    cv.outline(); cv.door = cx
    v17_plan(cv, kind='gableF', wall=[x0, x1], eave=yb, apex=ay + T, over=.35, roofCol=(84, 92, 112), roofTex=12, wallCol=(168, 56, 46), wallTex=4, trimCol=P['white'], floors=1, rooms=[6], sideWin=False)
    return cv, cx


@bprop('greenhouse', 'Greenhouse', ['farm', 'town'], [4.8, 3.0], group='greenhouse')
def p_greenhouse(rng):
    W, H = 196, 160; G = H - 2; cx = 98
    cv = Cv(W, H); x0, x1 = 20, 176
    yb = G - 64; ay = G - 128
    for y in range(ay, G - 5):
        for x in range(x0, x1 + 1):
            ey = ay + abs(x + .5 - cx) * (yb - ay) / (cx - x0)
            if y + .5 < ey: continue
            frame = (x - x0) % 16 == 0 or (y - ay) % 18 == 0 or x in (x0, x1)
            leaf = y > G - 40 and ((x * 7 + y * 3) % 11 < 4)
            cv.px(x, y, R['white'][3] if frame else R['sage2'][3 if leaf else 2] if y > G - 40 else R['pane'][4 if (x + y) % 13 == 0 else 3 if y < yb else 2])
    stone_band(cv, x0 - 2, x1 + 2, G - 5, G, R['stone'])
    for x in range(x0 + 6, x1 - 6, 9):
        for k in range(rng.randrange(6, 14)): cv.px(x + rng.randrange(-2, 3), G - 8 - k, R['sage2'][rng.choice((1, 2, 3))])
        cv.px(x, G - 10 - rng.randrange(8, 16), R[rng.choice(['coral', 'gold', 'pink'])][3])
    door(cv, cx, G - 6, 24, 46, Rw=R['white'], arch=False, glass=True)
    cv.outline(); cv.door = cx
    v17_plan(cv, kind='gableF', wall=[x0, x1], eave=yb, apex=ay + 6, over=.1, roofCol=(176, 214, 230), roofTex=12, wallCol=(176, 214, 230), wallTex=5, trimCol=P['white'], floors=1, rooms=[6], sideWin=False)
    return cv, cx


@bprop('ski_lodge', 'Ski lodge', ['snow', 'mountain', 'town'], [6.0, 4.0], group='ski_lodge')
def p_ski_lodge(rng):
    W, H = 240, 290; G = H - 2; cx = 120
    cv = Cv(W, H); x0, x1 = 30, 210
    yb = G - 132; ay = 18; xl, xr = x0 - 22, x1 + 22; T = 22
    for y in range(ay + 10, G - 5):
        for x in range(x0, x1 + 1):
            ey = ay + 10 + abs(x + .5 - cx) * (yb - ay - 10) / (cx - xl)
            if y + .5 < ey: continue
            t = 3 if x == x0 else 1 if x >= x1 - 1 else 2
            if (y - yb) % 8 == 7: t = max(0, t - 1)
            cv.px(x, y, R['pine'][t])
    stone_band(cv, x0 - 2, x1 + 2, G - 30, G, R['stone'], bw=12, bh=6)
    # the great triangular window under the gable
    for y in range(ay + 50, yb - 4):
        half = (y - ay - 50) * .62
        for x in range(int(cx - half), int(cx + half) + 1):
            cv.px(x, y, R['white'][3] if (x - cx) % 14 == 0 or (y - ay) % 16 == 0 else R['glass'][4 if (x + y) % 9 == 0 else 2])
    by = yb + 30
    cv.rect(x0 - 8, by, x1 + 8, by + 3, R['dwood'][2])
    for x in range(x0 - 8, x1 + 9, 6): cv.rect(x, by - 14, x + 1, by, R['dwood'][1])
    cv.rect(x0 - 8, by - 16, x1 + 8, by - 14, R['dwood'][3])
    gable_roof(cv, cx, ay, xl, xr, yb, T, R['slate2'])
    snow_cap(cv, 6)
    for wx in (x0 + 14, x1 - 46): window(cv, wx, G - 96, 32, 34, Rf=R['white'], rng=rng); shutters(cv, wx, G - 96, 32, 34, R['firered'])
    door(cv, cx, G - 6, 34, 60, Rw=R['dwood'], arch=False, glass=True)
    door_step(cv, cx, G, 20)
    sm = chimney(cv, x1 - 34, x1 - 18, ay + 6, ay + 52, R['stone'], brick=False)
    wall_lamp(cv, cx - 28, G - 50); wall_lamp(cv, cx + 28, G - 50)
    cv.outline(); cv.door = cx; cv.fx.append(('smoke',) + sm)
    v17_plan(cv, kind='gableF', wall=[x0, x1], eave=yb, apex=ay + T, over=.5, roofCol=(84, 92, 112), roofTex=10, wallCol=(130, 92, 60), wallTex=1, trimCol=P['dwood'], floors=2, rooms=[5, 0])
    return cv, cx


# ----------------------------------------------------------------------------- variants of the buildings there are
PALETTES = {   # (wall, roof, trim) colour sets a building's variants are drawn from
 'cottage': [((246, 230, 190), (160, 80, 64), (132, 84, 60)), ((222, 236, 214), (84, 120, 84), (110, 84, 60)), ((240, 214, 214), (120, 84, 120), (96, 72, 96)),
             ((214, 226, 240), (70, 90, 130), (90, 70, 60)), ((236, 222, 176), (176, 110, 64), (120, 80, 56))],
 'town': [((240, 226, 200), (84, 92, 112), (96, 64, 44)), ((212, 180, 150), (140, 64, 52), (232, 222, 200)), ((200, 216, 220), (60, 78, 120), (232, 232, 232)), ((232, 210, 160), (96, 120, 80), (96, 64, 44))],
 'city': [((214, 156, 128), (84, 92, 112), (232, 232, 232)), ((190, 196, 206), (60, 64, 74), (232, 232, 232)), ((232, 216, 180), (120, 84, 60), (90, 70, 60))],
}
FAMILY = {'house': 'cottage', 'house_red': 'cottage', 'house_blue': 'cottage', 'house_green': 'cottage', 'house_cottage': 'cottage', 'house_large': 'cottage',
          'villa': 'cottage', 'chalet': 'cottage', 'chalet_b': 'cottage', 'shop': 'town', 'clinic': 'town', 'lab': 'town', 'shop_cafe': 'town', 'shop_boutique': 'town',
          'shop_mart': 'city', 'townhouse_red': 'city', 'townhouse_blue': 'city', 'townhouse_yellow': 'city', 'apartment_a': 'city', 'apartment_b': 'city',
          'apartment_c': 'city', 'office_tower': 'city', 'city_hall': 'city',
          'bakery': 'town', 'inn': 'town', 'market_hall': 'town', 'bank': 'city', 'library': 'city', 'school': 'city', 'station': 'city', 'fire_station': 'city',
          'mansion': 'cottage', 'barn': 'cottage', 'greenhouse': 'town', 'ski_lodge': 'cottage'}


def hx2rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def tone_map(src, dst):
    """each tone of a ramp (and its outline colour) to the matching one of another"""
    a, b = ramp(src), ramp(dst); m = {}
    for i in range(5):
        m[a[i]] = b[i]; m[bsp.olc(a[i])] = bsp.olc(b[i])
    return m


def recolour(im, maps, tol=14):
    """move every pixel that is (close to) a mapped tone to its new tone"""
    px = im.load(); w, h = im.size; keys = []
    for M in maps: keys += list(M.items())
    cache = {}
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if c[3] < 128: continue
            k = c[:3]
            if k not in cache:
                best, bd = None, tol * tol * 3
                for s, d in keys:
                    dd = (s[0] - k[0]) ** 2 + (s[1] - k[1]) ** 2 + (s[2] - k[2]) ** 2
                    if dd < bd: best, bd = d, dd
                if best is not None:
                    off = (k[0] - [s for s, d in keys if d == best][0][0]) if False else 0
                cache[k] = best
            if cache[k] is not None: px[x, y] = cache[k] + (c[3],)
    return im


def window_boxes(im, plan, ox, oy, rng):
    """flower boxes under the ground-floor windows"""
    px = im.load(); w, h = im.size; cols = [ramp(c) for c in ((214, 92, 92), (236, 190, 70), (230, 140, 190), (170, 140, 230))]
    for (x, y, ww, hh) in plan.get('win', []):
        X0, Y = x - ox, y - oy + hh + 1
        if Y + 5 >= h or X0 < 1 or X0 + ww + 1 >= w: continue
        C = rng.choice(cols)
        for i in range(-1, ww + 1):
            for j in range(3): px[X0 + i, Y + j] = (bsp.R['dwood'][2 if j else 3]) + (255,)
            if rng.random() < .55: px[X0 + i, Y - 1] = C[rng.choice((2, 3, 4))] + (255,)
            elif rng.random() < .5: px[X0 + i, Y - 1] = bsp.R['leaf'][2] + (255,) if 'leaf' in bsp.R else (90, 150, 70, 255)


def make_variant(key, M, k, rng):
    """variant k (1..) of building key: new colours, now and then window boxes"""
    B = M['build']; fam = FAMILY.get(key, 'town'); pal = PALETTES[fam]; wc0, rc0, tc0 = hx2rgb(B['wallCol']), hx2rgb(B.get('roofCol', '#A05040')), hx2rgb(B.get('trimCol', '#7A5440'))
    opts = [p for p in pal if abs(p[0][0] - wc0[0]) + abs(p[0][1] - wc0[1]) + abs(p[0][2] - wc0[2]) > 40 or abs(p[1][0] - rc0[0]) + abs(p[1][1] - rc0[1]) > 40]
    wc, rc, tc = opts[(k - 1) % len(opts)] if opts else pal[(k - 1) % len(pal)]
    src = Image.open(os.path.join(ROOT, 'game', 'art', M['img'])).convert('RGBA')
    im = recolour(src.copy(), [tone_map(wc0, wc), tone_map(rc0, rc), tone_map(tc0, tc)])
    extra = []
    if k % 2 == 1 and B.get('win'): window_boxes(im, B, M['ox'], M['oy'], rng); extra.append('window boxes')
    return im, dict(wallCol=HX(wc), roofCol=HX(rc), trimCol=HX(tc), roofRamp=[HX(c) for c in ramp(rc)], extra=extra)


# ----------------------------------------------------------------------------- the data
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
        e = dict(name=m['name'], img='scene/props/%s.png' % k, ox=m['ox'], oy=m['oy'], shadow=m['shadow'], sway=m['sway'], flat=0, tags=m['tags'], group=m['group'])
        for f in ('box', 'door', 'fx'):
            if m.get(f) is not None: e[f] = m[f]
        b = dict(m['bld'])
        for f in ('wallCol', 'roofCol', 'trimCol'): b[f] = hx2rgb(b[f])
        if 'chimney' in b: b['chimney'] = dict(b['chimney'], col=hx2rgb(b['chimney']['col']))
        if 'base' in b and isinstance(b['base'], dict): b['base'] = (hx2rgb(b['base']['col']), b['base']['tex'], b['base']['h'])
        e['build'] = bbld.plan_json(k, b, m)
        cat[k] = e; cadd.append(k)
    # colour variants of every building
    vadd = []
    for k, M in cat.items():
        if not M.get('build') or M['build'].get('variants'): continue
        n = 5 if FAMILY.get(k) == 'cottage' else 3 if FAMILY.get(k) == 'city' else 4
        rng = random.Random(zlib.crc32(('v46' + k).encode())); V = []
        for j in range(1, n + 1):
            p = os.path.join(OUT, f'{k}_v{j}.png'); im, info = make_variant(k, M, j, rng)
            if not os.path.exists(p): im.save(p, optimize=True); written.append(f'{k}_v{j}')
            V.append(dict(info, img=f'scene/props/{k}_v{j}.png'))
        M['build']['variants'] = V; vadd.append(k)
    save_data(head, D)
    print(f'{len(NEW)} new buildings; pictures written: {len(written)}; props.json added: {len(padd)}; catalogue added: {", ".join(cadd) or "none"}; variants for {len(vadd)} buildings')
    if sp:
        from PIL import ImageDraw
        ks = list(NEW) + [k for k in cat if cat[k].get('build') and k not in NEW]
        tiles = []
        for k in ks:
            ims = [Image.open(os.path.join(ROOT, 'game', 'art', cat[k]['img'])).convert('RGBA')] + [Image.open(os.path.join(ROOT, 'game', 'art', v['img'])).convert('RGBA') for v in cat[k]['build'].get('variants', [])[:3]]
            tiles.append((k, ims))
        W = 2000; x = y = 10; rowh = 0; out = Image.new('RGBA', (W, 6000), (150, 202, 140, 255)); d = ImageDraw.Draw(out)
        for k, ims in tiles:
            tw = sum(i.width for i in ims) + 8 * len(ims)
            if x + tw > W: x = 10; y += rowh + 24; rowh = 0
            d.text((x, y), k, fill=(20, 20, 30)); xx = x
            for im in ims: out.alpha_composite(im, (xx, y + 14)); xx += im.width + 8
            rowh = max(rowh, max(i.height for i in ims) + 14); x += tw + 20
        out.crop((0, 0, W, y + rowh + 30)).save(sp); print('sheet', sp)


if __name__ == '__main__':
    main()
