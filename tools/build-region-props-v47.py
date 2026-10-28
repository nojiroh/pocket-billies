#!/usr/bin/env python3
"""v47 part 4: props for the new regions, drawn with the scene-prop kit in the style of the painted props (dark
coloured outlines, lit from the top left, 34 pixels to the metre). Each region's set is listed below; a landmark is
marked so the camera looks up at it (see tools/build-landmarks-v47.py).

The Meadowlands
  tree_mangrove        a mangrove on its arching stilt roots (with leaf layers)
  festival_stage       Vinylla's festival stage at Festival Fields: truss, lights, speakers, the tour backdrop (landmark)
  stall_merch          a merch stall: records, tour shirts, prices nobody agreed to
  billboard_tour       THE PRESSING TOUR, on two posts
  portaloo_vip         a festival toilet with a VIP sign (it is the same toilet)
  sunflower_giant      Twofold's sunflower that grew back twice as tall (landmark)
  tree_blossom_great   the great cherry in Blossom Vale (landmark, with leaf layers)
  stilt_hut            a boardwalk hut on stilts in the Mangrove Margins (landmark)

Golden Hills
  vineyard_row         a row of vines on a trellis, grapes hanging
  vault_door_hill      a round vault door set into the hillside, a gold V on its wheel (landmark of Vintage Rows)
  statue_goldbull      a gold bull charging on a marble plinth (landmark of Bullion Hill)
  tollbooth            a tollbooth alone on the salt flats: FLAT TAX (landmark of the Flat Tax Flats)
  salt_pile            a cone of raked salt
  bear_rock            a red rock carved by the wind into a sleeping bear (landmark of the Bear Market Badlands)
  mine_headframe       the timber headframe over an old mine shaft, its wheel at the top
  minecart             a rusty mine cart with gold ore, on a stub of rail

Pictures that exist are kept (yours); --force draws them again. Catalogue and props.json entries are added when
missing. Placing them was tools/build-regions-v47.py's job (deleted 2026-10-27; the legacy tag has an older copy);
tools/build-hub-rooms.py places the Gene Bank's racks, and the Studio's map editor places props by hand.

    python3 tools/build-region-props-v47.py                     # draw what's missing, add to the catalogue
    python3 tools/build-region-props-v47.py --preview out.png   # a sheet, writes nothing in the game
    python3 tools/build-region-props-v47.py --preview out.png tree_mangrove   # just these, at 2x
"""
import os, sys, json, math, random, importlib.util
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
spec = importlib.util.spec_from_file_location('lm47', os.path.join(HERE, 'build-landmarks-v47.py')); LM = importlib.util.module_from_spec(spec); spec.loader.exec_module(LM)
bsp = LM.bsp; g = vars(bsp)
Cv, R, ramp, xt, olc, sph = bsp.Cv, bsp.R, bsp.ramp, bsp.xt, bsp.olc, bsp.sph
door, window, stone_band, tile_roof, blob, trunk = g['door'], g['window'], g['stone_band'], g['tile_roof'], g['blob'], g['trunk']
limb, curve, tube_font, small_font = LM.limb, LM.curve, LM.tube_font, LM.small_font
OUT, META, PPU = bsp.OUT, bsp.META, 34
R.update({k: ramp(v) for k, v in dict(
    mangrove=(74, 128, 86), mroot=(128, 98, 74), stagebk=(46, 40, 70), truss=(150, 156, 170), vgold=(242, 196, 72), vpink=(232, 96, 168),
    vblack=(40, 36, 52), loo=(70, 140, 196), petal=(246, 176, 206), petalw=(250, 222, 234), sunpet=(250, 200, 52), sunseed=(110, 70, 40),
    stem=(96, 150, 70), thatch=(196, 160, 96), reed=(150, 140, 92)).items() if k not in R})
NEW = {}


def rprop(key, name, shadow, tags, solid=0, box=None, posts=None, sway=0, flat=0, landmark=False):
    def deco(fn):
        d = dict(fn=fn, name=name, shadow=shadow, sway=sway, tags=tags, flat=flat, group=key, solid=solid, box=box, posts=posts, landmark=landmark)
        NEW[key] = d; bsp.PROPS[key] = d
        return fn
    return deco


def text5(cv, s, x, y, col, sc=1, F=None):
    """letters from the 5 x 7 tube font (or the 3 x 5 small one), solid, at a scale"""
    F = F or tube_font()
    for ch in s:
        gl = F.get(ch) or F[' ']
        for j, row in enumerate(gl):
            for k, c in enumerate(row):
                if c == '#': cv.rect(x + k * sc, y + j * sc, x + k * sc + sc - 1, y + j * sc + sc - 1, col)
        x += (len(gl[0]) + 1) * sc
    return x


def text_w(s, sc=1, F=None):
    F = F or tube_font(); return sum((len((F.get(ch) or F[' '])[0]) + 1) * sc for ch in s) - sc


FONT = dict(tube_font()); FONT.update({'V': ['#...#', '#...#', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'], 'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
                                      'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'], 'G': ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'],
                                      'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], 'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
                                      '$': ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'], '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
                                      'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'], 'W': ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
                                      'X': ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#']})


# ============================================================================= the Meadowlands
@rprop('tree_mangrove', 'Mangrove', 1.4, ['water', 'route'], solid=.6, sway=.25)
def p_tree_mangrove(rng):
    W, H = 170, 170; G = H - 2; cx = 85
    cv = Cv(W, H); tr = Cv(W, H)
    hub = (cx, G - 46)                                    # where the stilt roots meet the trunk
    trunk(tr, limb([(cx - 2, G - 40), (cx, G - 78), (cx - 6, G - 104)], [16, 13, 9]), R['mroot'], rng)
    trunk(tr, limb([(cx + 2, G - 74), (cx + 22, G - 100), (cx + 34, G - 112)], [9, 7, 5]), R['mroot'], rng)
    for k, (fx, h0) in enumerate(((-58, 6), (-40, 3), (-22, 1), (-6, 0), (12, 2), (30, 4), (48, 3), (62, 7))):
        x1 = cx + fx; pts = [(hub[0] + fx * .12, hub[1] + 2)]
        for t in (.3, .55, .8, 1.0):
            pts.append((hub[0] + fx * .12 + (x1 - hub[0] - fx * .12) * t, hub[1] - 10 * math.sin(t * math.pi) + (G - h0 - hub[1]) * t ** 1.6))
        trunk(tr, limb(pts, [7, 6, 5, 4, 4]), R['mroot'], rng, streaks=False)
    tr.outline(); cv.paste(tr)
    fol = Cv(W, H)
    for (bx, by, rx, ry, b) in ((cx - 4, G - 128, 46, 26, .05), (cx - 42, G - 112, 30, 20, .02), (cx + 38, G - 116, 32, 20, -.04),
                                (cx - 18, G - 146, 34, 18, .06), (cx + 18, G - 144, 34, 18, .02), (cx, G - 104, 40, 16, -.06)):
        blob(fol, bx, by, rx, ry, R['mangrove'], rng, cell=7, bias=b)
    fol.outline(); cv.paste(fol)
    return cv, cx


@rprop('festival_stage', 'Festival stage', 2.4, ['route', 'festival'], box=[8.0, 3.6], landmark=True)
def p_festival_stage(rng):
    W, H = 300, 230; G = H - 2; cx = 150
    cv = Cv(W, H)
    x0, x1 = cx - 128, cx + 127
    # the deck on its black skirt, steps at the front
    for y in range(G - 40, G + 1):
        for x in range(x0, x1 + 1): cv.px(x, y, R['vblack'][2 if (x // 9) % 2 else 1] if y > G - 34 else R['wood'][3 if y == G - 40 else 2 if x < cx + 80 else 1])
    for k in range(3):                                   # steps up to the deck: a lit tread on each riser
        y0 = G - 12 * (k + 1) - 2
        cv.rect(cx - 24, y0, cx + 24, G - 12 * k, lambda x, y: R['wood'][4 if y == y0 else 3 if y < y0 + 3 else 1 if x > cx + 16 else 2])
    # the backdrop: the record, VINYLLA, THE PRESSING TOUR
    b0, b1, bT, bB = cx - 108, cx + 107, G - 176, G - 41
    for y in range(bT, bB + 1):
        for x in range(b0, b1 + 1):
            t = (y - bT) / (bB - bT); c = bsp.mix(R['vpink'][1], R['stagebk'][1], t)
            cv.px(x, y, c if (x + y) % 23 else R['stagebk'][2])
    rx, ry, rr = cx, G - 116, 44
    for (x, y) in cv.ellpts(rx, ry, rr, rr):
        d = math.hypot(x + .5 - rx, y + .5 - ry)
        if d < 13: cv.px(x, y, R['vgold'][3 if d < 10 else 2]) if d > 2.5 else cv.px(x, y, R['vblack'][0]); continue
        groove = int(d) % 4 == 0; cv.px(x, y, R['vblack'][2] if groove else R['vblack'][1])
        if 0 < (x - rx) * .8 - (y - ry) < 4 and d > 16: cv.px(x, y, R['vblack'][4])      # the shine across the grooves
    nm = 'VINYLLA'; tw = text_w(nm, 3, FONT)
    text5(cv, nm, cx - tw // 2 + 1, G - 172 + 1, R['vblack'][0], 3, FONT); text5(cv, nm, cx - tw // 2, G - 172, R['vgold'][4], 3, FONT)
    sub = 'THE PRESSING TOUR'; sw = text_w(sub, 1, FONT)
    text5(cv, sub, cx - sw // 2, G - 62, R['white'][4], 1, FONT)
    # the truss: two towers and a beam, a row of lamps
    for tx in (x0 + 2, x1 - 12):
        for y in range(G - 206, G - 40):
            for x in range(tx, tx + 11):
                e = x in (tx, tx + 10) or ((x - tx) == ((y - (G - 206)) % 20) // 2) or ((x - tx) == 10 - ((y - (G - 206)) % 20) // 2)
                if e: cv.px(x, y, R['truss'][3 if x < tx + 5 else 1])
    for y in range(G - 210, G - 199):
        for x in range(x0 + 2, x1 - 1):
            e = y in (G - 210, G - 200) or ((x - x0) % 20) // 2 == (y - (G - 210)) or ((x - x0) % 20) // 2 == 10 - (y - (G - 210))
            if e: cv.px(x, y, R['truss'][3 if y < G - 205 else 1])
    for k, lx in enumerate(range(x0 + 24, x1 - 20, 30)):
        cv.rect(lx - 4, G - 198, lx + 4, G - 190, lambda x, y: R['vblack'][2 if x < lx else 1])
        col = (R['vpink'], R['vgold'], R['loo'])[k % 3]
        cv.rect(lx - 3, G - 190, lx + 3, G - 188, col[4]); cv.fx.append(('glow', lx, G - 186))
    # speaker stacks either side
    for sx in (x0 - 2, x1 - 30):
        for k in range(3):
            y0 = G - 40 - 30 * (k + 1)
            cv.rect(sx, y0, sx + 32, y0 + 28, lambda x, y: R['vblack'][2 if x < sx + 4 else 1])
            for (cx2, cy2, r2) in ((sx + 16, y0 + 9, 6), (sx + 16, y0 + 21, 4)):
                for (x, y) in cv.ellpts(cx2, cy2, r2, r2): cv.px(x, y, R['vblack'][0] if math.hypot(x + .5 - cx2, y + .5 - cy2) < r2 - 2 else R['truss'][1])
    cv.outline()
    return cv, cx


@rprop('stall_merch', 'Merch stall', 1.5, ['festival', 'town'], box=[3.4, 1.4])
def p_stall_merch(rng):
    W, H = 140, 116; G = H - 2; cx = 70
    cv = Cv(W, H)
    # the counter, records leaning in a crate, shirts hung on a line, the striped canopy, a price board
    cv.rect(cx - 58, G - 34, cx + 57, G, lambda x, y: R['vblack'][3 if y == G - 34 else 2 if x < cx + 40 else 1])
    cv.rect(cx - 58, G - 37, cx + 57, G - 34, R['vgold'][3])
    for k in range(7):
        rx = cx - 50 + k * 9; ry = G - 44
        for (x, y) in cv.ellpts(rx, ry, 6, 6): cv.px(x, y, R['vblack'][1] if math.hypot(x + .5 - rx, y + .5 - ry) > 2 else R['vgold'][3] if k % 2 else R['vpink'][3])
    for x in range(cx - 52, cx + 52): cv.px(x, G - 86, R['iron'][1])
    for k, (sx, col) in enumerate(((cx - 40, 'vpink'), (cx - 12, 'vblack'), (cx + 16, 'vgold'), (cx + 40, 'white'))):
        for y in range(G - 85, G - 62):
            hw = 10 if y < G - 78 else 7
            for x in range(sx - hw, sx + hw + 1): cv.px(x, y, R[col][3 if x < sx - 3 else 2 if x < sx + 4 else 1])
        cv.rect(sx - 2, G - 76, sx + 2, G - 71, R['vgold'][4] if col != 'vgold' else R['vblack'][1])      # a little V on each
    for y in range(G - 104, G - 90):
        for x in range(cx - 64, cx + 64):
            s = ((x - cx + 64) // 11) % 2; t = 3 if y < G - 100 else 2
            if y > G - 94 and (x + 3) % 11 > 7: continue                     # scalloped hem
            cv.px(x, y, (R['vgold'] if s else R['vblack'])[t])
    for px0 in (cx - 62, cx + 58):
        cv.rect(px0, G - 90, px0 + 3, G - 34, R['iron'][2])
    sb0 = cx + 30; cv.rect(sb0, G - 60, sb0 + 22, G - 46, lambda x, y: R['white'][3 if y == G - 60 else 2])
    text5(cv, '$$$', sb0 + 2, G - 57, R['red'][1], 1, FONT)
    cv.outline()
    return cv, cx


@rprop('billboard_tour', 'Tour billboard', .8, ['festival', 'route', 'town'], posts=[{'x': -50, 'r': .25}, {'x': 49, 'r': .25}])
def p_billboard_tour(rng):
    W, H = 140, 150; G = H - 2; cx = 70
    cv = Cv(W, H)
    for lx in (cx - 52, cx + 47):
        cv.rect(lx, G - 70, lx + 4, G, lambda x, y: R['iron'][3 if x < lx + 2 else 1])
    b0, b1, bT, bB = cx - 64, cx + 63, G - 146, G - 66
    for y in range(bT, bB + 1):
        for x in range(b0, b1 + 1):
            t = (y - bT) / (bB - bT); cv.px(x, y, bsp.mix(R['vpink'][2], R['stagebk'][2], t))
    for x in range(b0, b1 + 1):
        for k in range(3): cv.px(x, bT + k, R['vgold'][4 - k]); cv.px(x, bB - k, R['vgold'][2 - min(2, k)])
    for y in range(bT, bB + 1):
        for k in range(3): cv.px(b0 + k, y, R['vgold'][4 - k]); cv.px(b1 - k, y, R['vgold'][2 - min(2, k)])
    rx, ry = cx - 30, G - 106
    for (x, y) in cv.ellpts(rx, ry, 24, 24):
        d = math.hypot(x + .5 - rx, y + .5 - ry); cv.px(x, y, R['vgold'][3] if d < 7 else R['vblack'][2 if int(d) % 4 == 0 else 1])
    text5(cv, 'VINYLLA', cx - 2, G - 128, R['vgold'][4], 1, FONT)
    text5(cv, 'LIVE', cx + 6, G - 116, R['white'][4], 2, FONT)
    sub = 'LIMITED'; text5(cv, sub, cx - 2, G - 92, R['white'][3], 1, FONT)
    cv.outline()
    return cv, cx


@rprop('portaloo_vip', 'Festival toilet', .5, ['festival'], solid=.55)
def p_portaloo_vip(rng):
    W, H = 50, 90; G = H - 2; cx = 25
    cv = Cv(W, H); x0, x1 = cx - 16, cx + 15
    for y in range(G - 74, G + 1):
        for x in range(x0, x1 + 1): cv.px(x, y, R['loo'][xt(x, x0, x1 + 1)])
    cv.poly([(x0 - 2, G - 74), (cx, G - 82), (x1 + 2, G - 74)], lambda x, y: R['white'][3 if x < cx else 1])
    cv.rect(x0 + 4, G - 64, x1 - 4, G - 2, lambda x, y: R['loo'][1 if x > x1 - 8 else 2])
    cv.rect(x0 + 6, G - 58, x1 - 6, G - 52, R['white'][4]); text5(cv, 'VIP', x0 + 7, G - 57, R['vgold'][1], 1, small_font() | {'V': ['#.#', '#.#', '#.#', '#.#', '.#.']})
    cv.rect(x1 - 9, G - 34, x1 - 7, G - 30, R['iron'][1])
    for y in range(G - 72, G - 68): cv.px(cx - 1, y, R['white'][4])
    cv.outline()
    return cv, cx


@rprop('sunflower_giant', 'Giant sunflower', 1.0, ['town', 'farm'], solid=.4, sway=.15, landmark=True)
def p_sunflower_giant(rng):
    W, H = 120, 270; G = H - 2; cx = 60
    cv = Cv(W, H)
    st = Cv(W, H)
    trunk(st, limb([(cx, G + 1), (cx + 2, G - 80), (cx - 2, G - 160), (cx + 4, G - 214)], [11, 9, 8, 6]), R['stem'], rng, streaks=False)
    for (ly, sgn, L) in ((G - 60, -1, 34), (G - 104, 1, 38), (G - 150, -1, 30), (G - 186, 1, 26)):
        pts = [(cx, ly), (cx + sgn * L * .5, ly - 10), (cx + sgn * L, ly - 2)]
        for (x, y) in st.polypts([(cx, ly + 4), (cx + sgn * L * .5, ly - 12), (cx + sgn * L, ly), (cx + sgn * L * .5, ly + 6)]):
            st.px(x, y, R['stem'][3 if y < ly - 4 else 2])
        st.line(cx, ly, cx + sgn * L * .9, ly - 3, R['stem'][1], 1)
    st.outline(); cv.paste(st)
    hd = Cv(W, H); hx, hy = cx + 6, G - 222
    for k in range(22):
        an = k / 22 * math.tau; px0 = hx + math.cos(an) * 26; py0 = hy + math.sin(an) * 22
        for (x, y) in hd.ellpts(px0, py0, 9 if k % 2 else 8, 5):
            d = (x + .5 - hx) * math.cos(an) + (y + .5 - hy) * math.sin(an)
            hd.px(x, y, R['sunpet'][3 if math.sin(an) < -.2 else 2 if math.cos(an) < .4 else 1])
    for (x, y) in hd.ellpts(hx, hy, 19, 16):
        d = math.hypot(x + .5 - hx, (y + .5 - hy) * 1.18)
        t = 0 if (x * 7 + y * 3) % 5 == 0 else 1 if d > 12 else 2
        if (x + .5 - hx) + (y + .5 - hy) < -14: t = min(4, t + 2)
        hd.px(x, y, R['sunseed'][t])
    hd.outline(); cv.paste(hd)
    return cv, cx


@rprop('tree_blossom_great', 'Great cherry', 2.6, ['route', 'town'], solid=.7, sway=.25, landmark=True)
def p_tree_blossom_great(rng):
    W, H = 300, 300; G = H - 2; cx = 150
    cv = Cv(W, H); tr = Cv(W, H)
    trunk(tr, [(cx - 30, G + 1), (cx - 18, G - 10), (cx - 14, G - 60), (cx - 30, G - 110), (cx - 70, G - 150), (cx - 60, G - 156), (cx - 10, G - 120), (cx - 4, G - 160),
               (cx + 8, G - 162), (cx + 10, G - 118), (cx + 60, G - 148), (cx + 70, G - 140), (cx + 20, G - 104), (cx + 14, G - 60), (cx + 18, G - 10), (cx + 32, G + 1)], R['bark'], rng)
    for root in ([(cx - 50, G + 1), (cx - 30, G - 6), (cx - 18, G - 6), (cx - 20, G + 1)], [(cx + 18, G + 1), (cx + 24, G - 7), (cx + 40, G - 4), (cx + 54, G + 1)]):
        trunk(tr, root, R['bark'], rng, streaks=False)
    tr.outline(); cv.paste(tr)
    fol = Cv(W, H)
    bl = [(cx, G - 214, 92, 52, .04, 'petal'), (cx - 82, G - 182, 50, 36, .03, 'petal'), (cx + 84, G - 186, 50, 36, -.03, 'petal'),
          (cx - 40, G - 246, 56, 32, .06, 'petalw'), (cx + 40, G - 244, 56, 32, .03, 'petalw'), (cx - 108, G - 150, 32, 24, .02, 'petal'),
          (cx + 110, G - 152, 32, 24, -.05, 'petal'), (cx, G - 166, 70, 30, -.04, 'petal')]
    for (bx, by, rx, ry, b, rm) in bl: blob(fol, bx, by, rx, ry, R[rm], rng, cell=8, bias=b)
    for _ in range(90):                                    # petals falling below the crown
        x = rng.randint(cx - 130, cx + 130); y = rng.randint(G - 140, G - 10)
        if fol.get(x, y) is None and rng.random() < .6: fol.px(x, y, R['petalw'][rng.choice((2, 3))])
    fol.outline(); cv.paste(fol)
    return cv, cx


@rprop('stilt_hut', 'Stilt hut', 1.6, ['water', 'route'], box=[3.6, 2.6], landmark=True)
def p_stilt_hut(rng):
    W, H = 150, 170; G = H - 2; cx = 75
    cv = Cv(W, H)
    st = Cv(W, H)
    for sx in (cx - 50, cx - 24, cx + 20, cx + 46):
        st.rect(sx, G - 60, sx + 5, G, lambda x, y: R['mroot'][3 if x < sx + 2 else 1])
    st.line(cx - 50, G - 50, cx + 50, G - 10, R['mroot'][1], 2); st.line(cx + 50, G - 50, cx - 50, G - 10, R['mroot'][2], 2)
    st.outline(); cv.paste(st)
    hut = Cv(W, H); x0, x1 = cx - 52, cx + 51
    for y in range(G - 66, G - 58):
        for x in range(x0 - 8, x1 + 9): hut.px(x, y, R['wood'][3 if y == G - 66 else 2 if (x // 6) % 2 else 1])
    for y in range(G - 116, G - 66):
        for x in range(x0, x1 + 1): hut.px(x, y, R['plank'][xt(x, x0, x1 + 1)] if (x - x0) % 7 else R['plank'][max(0, xt(x, x0, x1 + 1) - 1)])
    door(hut, cx + 22, G - 67, 18, 36, Rw=R['dwood'], arch=False, glass=False)
    window(hut, x0 + 12, G - 104, 22, 18, Rf=R['wood'], cross=True, rng=rng)
    tile_roof(hut, G - 154, G - 114, cx - 4, cx + 3, x0 - 14, x1 + 14, R['thatch'], tw=5, th=4)
    for x in range(x0 - 14, x1 + 15, 3):
        L = rng.randint(2, 5)
        for k in range(L): hut.px(x, G - 114 + k, R['thatch'][1])
    for x in range(x0 - 8, x1 + 9, 10): hut.rect(x, G - 84, x + 1, G - 66, R['wood'][2])
    hut.rect(x0 - 8, G - 86, x1 + 8, G - 84, R['wood'][3])
    hut.outline(); cv.paste(hut)
    cv.fx.append(('window', x0 + 23, G - 95))
    for (fx_, fy_) in ((x1 + 4, G - 120),): pass
    return cv, cx


# ============================================================================= Golden Hills
R.update({k: ramp(v) for k, v in dict(vine=(96, 140, 70), grape=(122, 70, 140), vault=(150, 152, 160), goldb=(232, 178, 56), salt=(238, 236, 228),
                                      redrock=(196, 112, 76), redrock2=(170, 90, 66), booth=(214, 196, 150)).items() if k not in R})


@rprop('vineyard_row', 'Vineyard row', .6, ['route', 'farm', 'hills'], box=[3.2, .5], sway=.12)
def p_vineyard_row(rng):
    """a row of vines on a trellis, seen from the end of the row's side: posts, two wires, leaves and grapes"""
    W, H = 120, 70; G = H - 2; cx = 60
    cv = Cv(W, H); x0, x1 = cx - 54, cx + 53
    for px0 in (x0, cx - 1, x1 - 3):
        cv.rect(px0, G - 52, px0 + 3, G, lambda x, y: R['wood'][3 if x == px0 else 2 if x < px0 + 3 else 1])
    for wy in (G - 44, G - 26):
        for x in range(x0, x1): cv.px(x, wy, R['iron'][2])
    fol = Cv(W, H)
    for k in range(9):
        bx = x0 + 6 + k * 12 + rng.uniform(-2, 2)
        blob(fol, bx, G - 38 + rng.uniform(-3, 3), 9, 9, R['vine'], rng, cell=5, bias=.03)
    for k in range(10):
        gx = x0 + 8 + k * 10 + rng.randint(-2, 2); gy = G - 26 + rng.randint(0, 6)
        for j in range(5):
            w = 3 - j // 2
            for i2 in range(w): fol.px(gx + i2 - w // 2, gy + j, R['grape'][3 if (i2 + j) % 3 == 0 else 2 if i2 < w - 1 else 1])
    fol.outline(); cv.paste(fol)
    for x in range(x0 - 2, x1 + 3): cv.px(x, G, R['soil'][1]); cv.px(x, G - 1, R['soil'][2])
    return cv, cx


@rprop('vault_door_hill', 'Hillside vault door', 1.6, ['hills', 'route'], box=[4.4, 1.6], landmark=True)
def p_vault_door_hill(rng):   # (vault_door is the bank's, inside)
    """a round steel vault door set into the hillside in a stone frame, a gold V on its wheel (Vinylla's storage)"""
    W, H = 170, 170; G = H - 2; cx = 85
    cv = Cv(W, H)
    rk = Cv(W, H)
    shape = [(cx - 80, G + 1), (cx - 76, G - 70), (cx - 60, G - 120), (cx - 30, G - 150), (cx + 10, G - 158), (cx + 46, G - 140), (cx + 70, G - 104), (cx + 80, G - 50), (cx + 82, G + 1)]
    trunk(rk, shape, R['rock'], rng, streaks=False)
    for _ in range(120):
        x = rng.randint(cx - 78, cx + 80); y = rng.randint(G - 150, G)
        if rk.get(x, y) in R['rock']: rk.px(x, y, R['goldb'][3] if rng.random() < .25 else R['rock'][rng.choice((1, 3))])
    for (x, y) in rk.ellpts(cx, G - 62, 58, 58):
        if y < G: rk.px(x, y, R['stone'][3 if x + y < cx + G - 70 else 2 if math.hypot(x - cx, y - (G - 62)) < 56 else 1])
    for (x, y) in rk.ellpts(cx, G - 62, 50, 50):
        d = math.hypot(x + .5 - cx, y + .5 - (G - 62))
        if y >= G: continue
        t = 3 if (x - cx) + (y - (G - 62)) < -30 else 2 if (x - cx) + (y - (G - 62)) < 20 else 1
        if int(d) in (38, 39, 24): t = max(0, t - 1)
        rk.px(x, y, R['vault'][t])
    for k in range(12):                                    # bolts round the rim
        a = k / 12 * math.tau; bx_, by_ = cx + math.cos(a) * 44, G - 62 + math.sin(a) * 44
        if by_ < G - 2: rk.rect(int(bx_) - 1, int(by_) - 1, int(bx_) + 1, int(by_) + 1, R['vault'][4])
    for k in range(4):                                     # the wheel
        a = k / 4 * math.pi + .4
        rk.line(cx - math.cos(a) * 18, G - 62 - math.sin(a) * 18, cx + math.cos(a) * 18, G - 62 + math.sin(a) * 18, R['goldb'][2], 3)
    for (x, y) in rk.ellpts(cx, G - 62, 6, 6): rk.px(x, y, R['goldb'][3])
    text5(rk, 'V', cx - 5, G - 66, R['vblack'][1], 2, FONT)
    rk.outline(); cv.paste(rk)
    return cv, cx


@rprop('statue_goldbull', 'Golden bull', 1.4, ['town', 'hills'], solid=1.2, landmark=True)
def p_statue_goldbull(rng):
    """a gold bull on a marble plinth, head down, mid-charge (the market only goes up, says the plaque)"""
    W, H = 150, 150; G = H - 2; cx = 75
    cv = Cv(W, H); Rm = R['marble']; Rg = R['goldb']
    cv.rect(cx - 56, G - 10, cx + 55, G, lambda x, y: Rm[4 if y == G - 10 else xt(x, cx - 56, cx + 56)])
    for y in range(G - 44, G - 10):
        for x in range(cx - 46, cx + 46): cv.px(x, y, Rm[xt(x, cx - 46, cx + 46, (.2, .6, .9))])
    cv.rect(cx - 50, G - 48, cx + 49, G - 44, lambda x, y: Rm[4 if y == G - 48 else 2])
    cv.rect(cx - 14, G - 34, cx + 13, G - 24, lambda x, y: Rg[3 if y == G - 34 else 2 if x < cx + 10 else 1])
    bull = Cv(W, H); by = G - 48
    # a charging bull, side on: hindquarters at the left, the back rising to a great hump over the shoulders, the head
    # lowered at the right with the horns forward, the tail whipping up
    body = [(cx - 42, by - 18), (cx - 49, by - 30), (cx - 42, by - 42), (cx - 20, by - 45), (cx, by - 50), (cx + 14, by - 58), (cx + 27, by - 56), (cx + 36, by - 46),
            (cx + 46, by - 44), (cx + 58, by - 36), (cx + 66, by - 22), (cx + 62, by - 14), (cx + 48, by - 15), (cx + 36, by - 18), (cx + 28, by - 13), (cx - 10, by - 12), (cx - 30, by - 14)]
    pts = bull.polypts(body); col = {}
    for (x, y) in pts: col.setdefault(x, []).append(y)
    for (x, y) in pts:
        ys = col[x]; top, bot = min(ys), max(ys); v = (y - top) / max(1, bot - top)
        t = 4 if y - top < 1 else 3 if v < .35 else 2 if v < .72 else 1
        if x > cx + 44 and t > 1: t -= 1                     # the head turns from the light
        bull.px(x, y, Rg[t])
    for (lx, sl, front) in ((cx - 38, -6, 0), (cx - 24, 3, 0), (cx + 14, 5, 1), (cx + 28, 9, 1)):   # legs mid-stride, short and thick
        for k in range(16):
            y = by - 15 + k; x = lx + sl * k / 15
            for w in range(7): bull.px(int(x) + w, y, Rg[3 if w < 2 else 2 if w < 5 else 1])
        bull.rect(int(lx + sl) - 1, by - 2, int(lx + sl) + 6, by, Rg[0])
    for (x0_, y0_, x1_, y1_) in ((cx + 50, by - 42, cx + 60, by - 50), (cx + 60, by - 50, cx + 68, by - 47), (cx + 44, by - 44, cx + 51, by - 52), (cx + 51, by - 52, cx + 57, by - 51)):
        bull.line(x0_, y0_, x1_, y1_, Rg[4], 2)              # horns, forward
    bull.line(cx - 47, by - 32, cx - 58, by - 46, Rg[2], 2); bull.line(cx - 58, by - 46, cx - 54, by - 54, Rg[2], 2)    # the tail
    bull.rect(cx + 55, by - 34, cx + 56, by - 33, R['vblack'][0])                                                 # the eye
    bull.rect(cx + 63, by - 19, cx + 64, by - 18, Rg[0])                                                          # the nostril
    bull.outline(); cv.paste(bull)
    cv.outline()
    cv.fx.append(('sparkle', cx - 10, by - 44)); cv.fx.append(('sparkle', cx + 30, by - 36))
    return cv, cx


@rprop('tollbooth', 'Flat tax tollbooth', .9, ['hills', 'route'], solid=.9, landmark=True)
def p_tollbooth(rng):
    """a tollbooth alone on the salt flats, a barrier arm across nothing: FLAT TAX, the same for everyone"""
    W, H = 170, 120; G = H - 2; cx = 50
    cv = Cv(W, H); x0, x1 = cx - 28, cx + 27
    for y in range(G - 66, G + 1):
        for x in range(x0, x1 + 1): cv.px(x, y, R['booth'][xt(x, x0, x1 + 1)])
    cv.rect(x0 + 6, G - 58, x1 - 6, G - 34, lambda x, y: R['glass'][3 if (x - y) % 9 < 2 else 2 if x < x1 - 12 else 1])
    for x in (x0 + 6, cx, x1 - 6): cv.rect(x, G - 58, x, G - 34, R['white'][3])
    cv.rect(x0 - 4, G - 80, x1 + 4, G - 66, lambda x, y: R['red'][3 if y < G - 76 else 2])
    tw = text_w('FLAT TAX', 1, FONT); text5(cv, 'FLAT TAX', cx - tw // 2, G - 77, R['white'][4], 1, FONT)
    cv.rect(x0 - 2, G - 84, x1 + 2, G - 80, R['white'][3])
    cv.rect(x1 + 4, G - 30, x1 + 10, G, lambda x, y: R['iron'][2])
    for k in range(0, 104, 1):                              # the barrier arm, striped
        x = x1 + 10 + k; y = G - 26
        c = R['red'][3] if (k // 8) % 2 else R['white'][4]
        cv.px(x, y, c); cv.px(x, y + 1, c); cv.px(x, y + 2, R['red'][1] if (k // 8) % 2 else R['white'][2])
    cv.rect(x1 + 110, G - 30, x1 + 114, G, lambda x, y: R['iron'][2])
    cv.outline()
    return cv, cx


@rprop('salt_pile', 'Salt pile', .4, ['hills', 'route'], solid=.6)
def p_salt_pile(rng):
    W, H = 60, 44; G = H - 2; cx = 30
    cv = Cv(W, H)
    for y in range(G - 34, G + 1):
        hw = (y - (G - 34)) * .8 + 1
        for x in range(int(cx - hw), int(cx + hw) + 1):
            u = (x - cx) / max(1, hw); cv.px(x, y, R['salt'][4 if u < -.45 else 3 if u < .1 else 2 if u < .6 else 1])
    for _ in range(18):
        x = rng.randint(cx - 20, cx + 20); y = rng.randint(G - 20, G)
        if cv.get(x, y) is not None: cv.px(x, y, R['salt'][4])
    cv.outline()
    return cv, cx


@rprop('bear_rock', 'Bear Rock', 2.0, ['hills', 'route', 'canyon'], solid=1.8, landmark=True)
def p_bear_rock(rng):
    """a red rock outcrop the wind has carved into a sleeping bear (the badlands' landmark: it has been asleep for a
    very long time, and everyone is waiting for it to wake up)"""
    W, H = 220, 150; G = H - 2; cx = 110
    cv = Cv(W, H); Rr1, Rr2 = R['redrock'], R['redrock2']
    rk = Cv(W, H)
    def mass(pts, cxm, cym, rxm, rym, bias=.1):
        for (x, y) in rk.polypts(pts):
            band = int((y + (x - cx) * .08 - (G - 100)) / 11) % 2; n = sph(max(-1, min(1, (x - cxm) / rxm * .7)), max(-1, min(1, (y - cym) / rym * .9)), bias)
            if band and n > 0: n = max(0, n - 1) if (x + y) % 2 else n
            rk.px(x, y, (Rr1 if band else Rr2)[max(0, min(4, n))])
    # a sleeping bear curled on its side: the great round back, the head resting on its paws at the right
    back = [(cx - 92, G + 1)] + [(cx - 92 + 150 * (1 - math.cos(t * math.pi)) / 2, G - math.sin(t * math.pi) ** .8 * 96) for t in [k / 14 for k in range(1, 14)]] + [(cx + 58, G + 1)]
    mass(back, cx - 20, G - 60, 80, 60)
    head = [(cx + 30, G - 30), (cx + 40, G - 56), (cx + 62, G - 64), (cx + 84, G - 56), (cx + 100, G - 40), (cx + 112, G - 30), (cx + 112, G - 20), (cx + 98, G - 16), (cx + 60, G - 16)]
    mass(head, cx + 70, G - 44, 44, 26, .16)
    for (ex_, ey_) in ((cx + 56, G - 64), (cx + 72, G - 66)):
        for (x, y) in rk.ellpts(ex_, ey_, 7, 6):
            if rk.get(x, y) is None or y < ey_: rk.px(x, y, Rr2[3 if x < ex_ else 2])
    for (px_, pw) in ((cx + 40, 26), (cx + 76, 24)):        # the paws under the chin
        for (x, y) in rk.ellpts(px_ + pw / 2, G - 8, pw / 2, 8):
            if y <= G: rk.px(x, y, Rr1[3 if y < G - 10 else 2 if x < px_ + pw * .6 else 1])
        for k in range(3): rk.px(int(px_ + pw * .3 + k * pw * .2), G - 2, R['vblack'][1])
    for x in range(cx + 84, cx + 94): rk.px(x, G - 46 + (1 if x in (cx + 86, cx + 92) else 0), R['vblack'][1])   # the closed eye
    rk.rect(cx + 109, G - 30, cx + 111, G - 27, R['vblack'][0])                                                 # the nose
    rk.outline(); cv.paste(rk)
    for (sx, sy) in ((cx - 100, G - 4), (cx + 104, G - 2)):
        for (x, y) in cv.ellpts(sx, sy, 8, 4): cv.px(x, y, Rr2[2] if y < sy else Rr2[1])
    return cv, cx


@rprop('mine_headframe', 'Mine headframe', 1.6, ['hills', 'route'], solid=1.2)
def p_mine_headframe(rng):
    W, H = 120, 230; G = H - 2; cx = 60
    cv = Cv(W, H); Rw = R['dwood']
    fr = Cv(W, H)
    for s in (-1, 1): fr.line(cx + s * 36, G, cx + s * 12, G - 190, Rw[2 if s < 0 else 1], 4)
    for y0 in (G - 40, G - 90, G - 140):
        w = 36 - (G - y0) / 190 * 24
        fr.line(cx - w, y0, cx + w, y0, Rw[3], 3)
        fr.line(cx - w, y0, cx + w * .8, y0 - 46, Rw[2], 2)
    for (x, y) in fr.ellpts(cx, G - 196, 16, 16): fr.px(x, y, R['iron'][2] if math.hypot(x + .5 - cx, y + .5 - (G - 196)) > 12 else None)
    for k in range(6):
        a = k / 6 * math.tau; fr.line(cx, G - 196, cx + math.cos(a) * 13, G - 196 + math.sin(a) * 13, R['iron'][1], 1)
    fr.line(cx + 14, G - 196, cx + 14, G - 30, R['iron'][0], 1)
    fr.outline(); cv.paste(fr)
    return cv, cx


@rprop('minecart', 'Mine cart', .5, ['hills', 'route', 'cave'], solid=.6)
def p_minecart(rng):
    W, H = 70, 50; G = H - 2; cx = 35
    cv = Cv(W, H)
    for x in range(cx - 32, cx + 32): cv.px(x, G - 1, R['iron'][2]); cv.px(x, G, R['dwood'][1] if x % 6 < 3 else None)
    cart = [(cx - 24, G - 30), (cx + 24, G - 30), (cx + 20, G - 8), (cx - 20, G - 8)]
    for (x, y) in cv.polypts(cart): cv.px(x, y, R['rust'][3 if y < G - 26 else xt(x, cx - 24, cx + 24)])
    for x in range(cx - 24, cx + 25): cv.px(x, G - 30, R['iron'][3])
    for (x, y) in cv.ellpts(cx, G - 32, 18, 5):
        if y < G - 30: cv.px(x, y, R['goldb'][3] if (x + y) % 4 else R['rock'][2])
    for wx in (cx - 13, cx + 13):
        for (x, y) in cv.ellpts(wx, G - 6, 5, 5): cv.px(x, y, R['iron'][1] if math.hypot(x + .5 - wx, y + .5 - (G - 6)) > 2 else R['iron'][3])
    cv.outline()
    return cv, cx


# ============================================================================= Spore Forest
R.update({k: ramp(v) for k, v in dict(cap=(198, 82, 92), capdot=(246, 232, 220), stalk=(232, 214, 186), sporeg=(170, 236, 220), jungle=(52, 132, 80),
                                      jungle2=(84, 160, 74), liana=(110, 140, 60), unicorn=(236, 236, 244), autumn1=(214, 120, 52), autumn2=(232, 170, 60), autumn3=(190, 80, 56),
                                      mill=(120, 112, 132)).items() if k not in R})


def cap_dome(cv, cx, cy, rx, ry, Rc, dots=True, rng=None):
    """a mushroom cap: a dome lit from the top left, a rim, pale spots"""
    for y in range(int(cy - ry), int(cy + ry * .35) + 1):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            u = (x + .5 - cx) / rx; v = (y + .5 - cy) / ry
            if u * u + v * v > 1 or v > .35: continue
            n = sph(max(-1, min(1, u * .8)), max(-1, min(1, v * .9 - .1)), .1)
            if v > .22: n = max(0, n - 2)
            cv.px(x, y, Rc[n])
    if dots and rng:
        n = max(5, int(rx * ry / 420)); placed = []
        for _ in range(n * 6):
            if len(placed) >= n: break
            a = rng.uniform(-2.9, -.25); r = rng.uniform(.2, .9); dx, dy = math.cos(a) * r * rx, math.sin(a) * r * ry * .9
            sz = rng.uniform(.06, .11) * rx
            if any(math.hypot(dx - px_, dy - py_) < (sz + ps) * 1.4 for px_, py_, ps in placed): continue
            placed.append((dx, dy, sz))
            for (x, y) in cv.ellpts(cx + dx, cy + dy, sz, sz * .7):
                if cv.get(x, y) in Rc: cv.px(x, y, R['capdot'][4 if y < cy + dy - sz * .3 else 3 if y < cy + dy + sz * .2 else 2])


@rprop('mushroom_house', 'Mushroom house', 1.4, ['spore', 'town'], box=[3.2, 2.4])
def p_mushroom_house(rng):
    """a house in the stalk of a giant mushroom, its cap for a roof: a round door, two windows, a chimney pipe"""
    W, H = 140, 150; G = H - 2; cx = 70
    cv = Cv(W, H)
    st = Cv(W, H)
    for y in range(G - 74, G + 1):
        hw = 34 + (y - (G - 74)) * .12
        for x in range(int(cx - hw), int(cx + hw) + 1): st.px(x, y, R['stalk'][xt(x, cx - hw, cx + hw + 1)])
    door(st, cx + 4, G, 22, 34, Rw=R['dwood'], arch=True, glass=False)
    window(st, cx - 26, G - 58, 12, 12, Rf=R['wood'], cross=True, rng=rng, rec='window')
    window(st, cx + 22, G - 58, 12, 12, Rf=R['wood'], cross=True, rng=rng, rec='window')
    st.outline(); cv.paste(st)
    cp = Cv(W, H); cap_dome(cp, cx, G - 80, 66, 56, R['cap'], True, rng); cp.outline(); cv.paste(cp)
    cv.rect(cx + 30, G - 136, cx + 35, G - 116, lambda x, y: R['iron'][3 if x < cx + 32 else 1]); cv.rect(cx + 28, G - 140, cx + 37, G - 136, R['iron'][2])
    cv.fx.append(('smoke', cx + 32, G - 142))
    return cv, cx


@rprop('mushroom_colossal', 'Colossal mushroom', 3.6, ['spore', 'town'], solid=1.4, landmark=True)
def p_mushroom_colossal(rng):
    """the great mushroom Market Cap is built round: a stalk like a tower, a cap as wide as the square, puffing spores"""
    W, H = 380, 400; G = H - 2; cx = 190
    cv = Cv(W, H)
    st = Cv(W, H)
    for y in range(G - 250, G + 1):
        f = (y - (G - 250)) / 250; hw = 24 + 12 * f ** 2 + 6 * math.sin(f * 7) * (1 - f)
        for x in range(int(cx - hw), int(cx + hw) + 1): st.px(x, y, R['stalk'][xt(x, cx - hw, cx + hw + 1)])
    for k in range(5):                                      # the skirt (annulus) under the cap
        y = G - 236 + k
        for x in range(cx - 46 + k * 3, cx + 47 - k * 3): st.px(x, y, R['stalk'][3 if k < 2 else 1])
    for (x0, x1) in ((cx - 70, cx - 24), (cx + 24, cx + 76)):                  # roots spreading
        for x in range(x0, x1):
            y = G - int(6 * math.sin((x - x0) / (x1 - x0) * math.pi)); st.px(x, y, R['stalk'][1]); st.px(x, y + 1, R['stalk'][0])
    door(st, cx, G, 20, 30, Rw=R['dwood'], arch=True, glass=False)
    for wy in (G - 90, G - 150, G - 200): window(st, cx - 6, wy, 12, 14, Rf=R['wood'], cross=False, rng=rng, sill=False, rec='window')
    st.outline(); cv.paste(st)
    cp = Cv(W, H); cap_dome(cp, cx, G - 262, 180, 128, R['cap'], True, rng); cp.outline(); cv.paste(cp)
    for k in range(5): cv.fx.append(('sparkle', cx - 120 + k * 60, G - 330 + (k % 2) * 30))
    cv.fx.append(('glow', cx, G - 240))
    return cv, cx


@rprop('treehouse', 'Treehouse', 1.6, ['spore', 'town', 'forest'], solid=.8, sway=.06)
def p_treehouse(rng):
    W, H = 170, 230; G = H - 2; cx = 85
    cv = Cv(W, H); tr = Cv(W, H)
    trunk(tr, [(cx - 16, G + 1), (cx - 11, G - 30), (cx - 10, G - 150), (cx - 22, G - 196), (cx - 14, G - 198), (cx, G - 170), (cx + 14, G - 200), (cx + 22, G - 196),
               (cx + 10, G - 150), (cx + 11, G - 30), (cx + 17, G + 1)], R['bark'], rng)
    tr.outline(); cv.paste(tr)
    hut = Cv(W, H); x0, x1, yb = cx - 38, cx + 37, G - 110
    for y in range(yb - 40, yb):
        for x in range(x0, x1 + 1): hut.px(x, y, R['plank'][xt(x, x0, x1 + 1)] if (x - x0) % 6 else R['plank'][1])
    for x in range(x0 - 8, x1 + 9):
        for k, t in ((0, 4), (1, 3), (2, 2), (3, 1)): hut.px(x, yb + k, R['wood'][t])
    window(hut, cx - 22, yb - 32, 14, 12, Rf=R['wood'], cross=True, rng=rng, rec='window')
    hut.rect(cx + 8, yb - 34, cx + 22, yb - 1, lambda x, y: R['dwood'][2 if x < cx + 20 else 1])
    tile_roof(hut, yb - 66, yb - 40, cx - 2, cx + 1, x0 - 10, x1 + 10, R['moss'], tw=6, th=4)
    for y in range(yb + 4, G - 2, 7): hut.rect(cx + 24, y, cx + 34, y + 1, R['wood'][3])
    for x in (cx + 24, cx + 34): hut.rect(x, yb + 2, x, G - 2, R['wood'][2])
    hut.outline(); cv.paste(hut)
    fol = Cv(W, H)
    for (bx, by, rx, ry) in ((cx - 50, G - 190, 30, 20), (cx + 50, G - 194, 30, 20), (cx, G - 206, 40, 22)): blob(fol, bx, by, rx, ry, R['jungle2'], rng, cell=7, bias=.03)
    fol.outline(); cv.paste(fol)
    return cv, cx


@rprop('spore_mill', 'Spore mill', 2.0, ['spore', 'route'], box=[5.2, 2.6], landmark=True)
def p_spore_mill(rng):
    """the Variants' spore mill: a hopper fed with spores, a grinder, a chute into gold drums marked V, a pipe puffing
    glittering dust (the record's coating, so it will shine for ever)"""
    W, H = 220, 190; G = H - 2; cx = 110
    cv = Cv(W, H); Rm = R['mill']
    cv.rect(cx - 86, G - 10, cx + 86, G, lambda x, y: R['stone'][3 if y == G - 10 else 2])
    for y in range(G - 96, G - 10):
        for x in range(cx - 52, cx + 52): cv.px(x, y, Rm[xt(x, cx - 52, cx + 52)])
    for y0 in range(G - 90, G - 14, 16):
        for x in range(cx - 52, cx + 52): cv.px(x, y0, Rm[1])
    hop = [(cx - 44, G - 150), (cx + 44, G - 150), (cx + 18, G - 98), (cx - 18, G - 98)]
    for (x, y) in cv.polypts(hop): cv.px(x, y, R['vgold'][3 if x < cx - 10 else 2 if x < cx + 20 else 1])
    for (x, y) in cv.ellpts(cx, G - 152, 44, 6):
        if y <= G - 150: cv.px(x, y, R['sporeg'][3 if (x + y) % 3 else 4])
    for (x, y) in cv.ellpts(cx - 30, G - 60, 16, 16): cv.px(x, y, R['iron'][1] if math.hypot(x + .5 - cx + 30, y + .5 - G + 60) > 12 else R['iron'][3])
    for k in range(6):
        a = k / 6 * math.tau; cv.line(cx - 30, G - 60, cx - 30 + math.cos(a) * 12, G - 60 + math.sin(a) * 12, R['iron'][0], 1)
    cv.rect(cx + 52, G - 40, cx + 70, G - 34, R['iron'][2])
    for dx in (cx + 66, cx + 84):
        cv.rect(dx - 8, G - 34, dx + 8, G - 10, lambda x, y: R['vgold'][3 if x < dx - 3 else 2 if x < dx + 4 else 1])
        text5(cv, 'V', dx - 2, G - 26, R['vblack'][1], 1, small_font() | {'V': ['#.#', '#.#', '#.#', '#.#', '.#.']})
    cv.rect(cx - 60, G - 170, cx - 50, G - 96, lambda x, y: R['iron'][3 if x < cx - 56 else 1])
    for k in range(5):
        for (x, y) in cv.ellpts(cx - 55 + k * 4, G - 176 - k * 7, 5 + k, 4 + k * .6):
            if cv.get(x, y) is None: cv.px(x, y, R['sporeg'][4 if (x + y + k) % 4 == 0 else 3])
    cv.outline()
    cv.fx.append(('sparkle', cx - 50, G - 190)); cv.fx.append(('sparkle', cx, G - 160)); cv.fx.append(('smoke', cx - 55, G - 176))
    return cv, cx


@rprop('tree_giant_autumn', 'Giant tree in autumn', 4.2, ['route', 'forest'], solid=1.0, sway=.18, landmark=True)
def p_tree_giant_autumn(rng):
    """the giant tree drawn in its autumn colours (Fall Quarter's landmark: the Ledger Oak)"""
    LM.GIANT_PAL = (R['autumn3'], R['autumn2'])
    try: return LM.p_tree_giant(rng)
    finally: LM.GIANT_PAL = None


@rprop('tree_jungle', 'Jungle tree', 2.2, ['jungle', 'route'], solid=.7, sway=.25)
def p_tree_jungle(rng):
    """a tall jungle tree: a straight pale trunk with buttress roots, a broad crown, lianas hanging"""
    W, H = 220, 300; G = H - 2; cx = 110
    cv = Cv(W, H); tr = Cv(W, H)
    trunk(tr, [(cx - 30, G + 1), (cx - 12, G - 20), (cx - 9, G - 200), (cx - 30, G - 236), (cx - 22, G - 240), (cx, G - 214), (cx + 22, G - 242), (cx + 30, G - 238),
               (cx + 9, G - 200), (cx + 12, G - 20), (cx + 32, G + 1)], R['birch'] if 'birch' in R else R['bark'], rng)
    for (a, b) in ((-1, 30), (1, 32)):
        trunk(tr, [(cx + a * 10, G - 40), (cx + a * b, G + 1), (cx + a * (b - 10), G + 1)], R['bark'], rng, streaks=False)
    tr.outline(); cv.paste(tr)
    fol = Cv(W, H)
    for (bx, by, rx, ry, b) in ((cx, G - 262, 80, 30, .05), (cx - 70, G - 240, 40, 22, .02), (cx + 72, G - 244, 40, 22, -.03), (cx - 30, G - 280, 44, 20, .06), (cx + 30, G - 278, 44, 20, .03)):
        blob(fol, bx, by, rx, ry, R['jungle'], rng, cell=8, bias=b)
    for k in range(14):
        x0 = cx - 90 + k * 13 + rng.uniform(-3, 3); y0 = G - 236 + rng.randint(-6, 8); L = rng.randint(40, 130)
        for j in range(L):
            x = int(x0 + math.sin(j / 14 + k) * 2.5); y = int(y0 + j)
            if y > G - 8: break
            fol.px(x, y, R['liana'][2 if j % 4 else 3])
            if j % 9 == 0: fol.px(x + 1, y, R['jungle2'][3]); fol.px(x - 1, y + 1, R['jungle2'][2])
    fol.outline(); cv.paste(fol)
    return cv, cx


@rprop('jungle_fern', 'Jungle leaves', .6, ['jungle', 'route'], solid=.3, sway=.4)
def p_jungle_fern(rng):
    """a clump of huge jungle leaves (split ones, like a cheese plant) springing from the ground"""
    W, H = 110, 80; G = H - 2; cx = 55
    cv = Cv(W, H)
    for k in range(7):
        a = math.pi * (.15 + .7 * k / 6) + rng.uniform(-.08, .08); L = rng.uniform(34, 50)
        tx, ty = cx + math.cos(a) * L * 1.1, G - 6 - math.sin(a) * L
        cv.line(cx, G - 2, tx, ty + 8, R['jungle2'][1], 2)
        for (x, y) in cv.ellpts(tx, ty, 14, 9):
            u = (x + .5 - tx) / 14
            if abs(((x - tx) * 3 + (y - ty) * 2) % 9) < 1.2 and abs(u) > .25: continue          # the splits in the leaf
            cv.px(x, y, R['jungle2'][3 if u < -.3 and y < ty else 2 if u < .3 else 1])
    cv.outline()
    return cv, cx


@rprop('unicorn_statue', 'Overgrown unicorn', 1.8, ['jungle', 'route'], solid=1.2, landmark=True)
def p_unicorn_statue(rng):
    """a startup's statue of a unicorn (valued at a billion, once), swallowed by the jungle: vines up its legs, a fern on
    its back, its horn still gold"""
    W, H = 190, 200; G = H - 2; cx = 95
    cv = Cv(W, H); Rm = R['marble']; Ru = R['unicorn']
    cv.rect(cx - 62, G - 12, cx + 62, G, lambda x, y: Rm[4 if y == G - 12 else xt(x, cx - 62, cx + 62)])
    for y in range(G - 44, G - 12):
        for x in range(cx - 52, cx + 52): cv.px(x, y, Rm[xt(x, cx - 52, cx + 52, (.2, .6, .9))])
    hb = G - 44
    horse = Cv(W, H)
    body = [(cx - 40, hb - 40), (cx - 30, hb - 56), (cx + 10, hb - 58), (cx + 24, hb - 64), (cx + 34, hb - 92), (cx + 46, hb - 100), (cx + 56, hb - 96), (cx + 60, hb - 84),
            (cx + 50, hb - 80), (cx + 42, hb - 64), (cx + 38, hb - 42), (cx + 20, hb - 34), (cx - 30, hb - 34)]
    pts = horse.polypts(body); col = {}
    for (x, y) in pts: col.setdefault(x, []).append(y)
    for (x, y) in pts:
        ys = col[x]; v = (y - min(ys)) / max(1, max(ys) - min(ys)); horse.px(x, y, Ru[4 if v < .15 else 3 if v < .45 else 2 if v < .8 else 1])
    for (lx, sl) in ((cx - 32, -4), (cx - 20, 2), (cx + 18, 2), (cx + 30, 6)):
        for k in range(30):
            for w in range(5): horse.px(int(lx + sl * k / 30) + w, hb - 34 + k, Ru[3 if w < 2 else 1])
    horse.line(cx + 52, hb - 98, cx + 66, hb - 122, R['vgold'][4], 3)            # the horn, still gold
    for k in range(6): horse.line(cx + 26 - k * 2, hb - 70 - k * 4, cx + 34 - k * 3, hb - 88 - k * 3, R['lav'][2 + (k % 2)], 2)   # the mane
    horse.line(cx - 40, hb - 46, cx - 54, hb - 30, R['lav'][3], 3)                # the tail
    horse.px(cx + 54, hb - 92, R['vblack'][0])
    horse.outline(); cv.paste(horse)
    v = Cv(W, H)                                            # vines over it all, a fern on its back
    for k in range(9):
        x0 = cx - 50 + k * 13 + rng.randint(-3, 3); y = G - 2
        x = x0
        for j in range(rng.randint(40, 110)):
            y -= 1; x += math.sin(j / 7 + k) * .6
            if cv.get(int(x), y) is None and horse.get(int(x), y) is None and j > 30: break
            v.px(int(x), y, R['liana'][2 if j % 3 else 3])
            if j % 8 == 0: v.px(int(x) + 1, y, R['jungle2'][3]); v.px(int(x) - 1, y - 1, R['jungle2'][2])
    for k in range(5):
        a = math.pi * (.2 + .6 * k / 4); tx, ty = cx - 6 + math.cos(a) * 26, hb - 58 - math.sin(a) * 22
        v.line(cx - 6, hb - 56, tx, ty, R['jungle2'][2], 2)
        for (x, y) in v.ellpts(tx, ty, 7, 4): v.px(x, y, R['jungle2'][3 if y < ty else 2])
    v.outline(); cv.paste(v)
    cv.fx.append(('sparkle', cx + 62, hb - 118))
    return cv, cx


# ============================================================================= Crystal Caverns
R.update({k: ramp(v) for k, v in dict(crys=(92, 210, 236), amethyst=(166, 112, 226), icecr=(190, 226, 244), geoshell=(128, 112, 100), rockc=(100, 94, 116),
                                      agate=(236, 226, 214), lattice=(122, 92, 64), needle=(204, 244, 255), laser=(255, 70, 90), safe=(70, 76, 92),
                                      goldbar=(240, 192, 64)).items() if k not in R})


def shard(cv, x, yb, w, h, lean, Rc, tip=None):
    """one crystal: a six-sided prism standing on (x, yb), w wide, h tall to where the point starts, leaning `lean` px at
    the top; lit from the top left: the left faces light, the right ones dark, a bright ridge down the middle"""
    tip = tip if tip is not None else w * .95
    top = yb - h; apex = (x + lean * 1.12, top - tip)
    poly = [(x - w / 2, yb), (x - w / 2 + lean, top), apex, (x + w / 2 + lean, top), (x + w / 2, yb)]
    for (px_, py_) in cv.polypts(poly):
        f = (yb - py_) / max(1, yb - apex[1]); ridge = x + (apex[0] - x) * f
        u = (px_ + .5 - ridge) / max(1, w / 2)
        n = 4 if abs(u) < .12 else 3 if u < -.5 else 2 if u < 0 else 1 if u < .62 else 0
        if py_ < top + 2 and n < 4: n += 1                  # the point catches the light
        cv.px(px_, py_, Rc[n])
    return apex


def cluster(rng, Rc, W=96, H=110, n=6, big=66, base=True, glow=True):
    cv = Cv(W, H); G = H - 4; cx = W // 2
    if base:
        b = Cv(W, H)
        for (x, y) in b.ellpts(cx, G - 1, 32, 7): b.px(x, y, R['rockc'][xt(x, cx - 32, cx + 32) if y > G - 4 else 3])
        b.outline(); cv.paste(b)
    specs = []
    for k in range(n):
        h = big * (1 if k == 0 else rng.uniform(.3, .78)); dx = 0 if k == 0 else rng.uniform(-26, 26)
        specs.append((h, dx, max(7, h * rng.uniform(.18, .26)), (dx * .32 + rng.uniform(-6, 6)) if k else rng.uniform(-4, 4)))
    for h, dx, w, lean in sorted(specs, key=lambda s: -s[0]):
        s = Cv(W, H); yb = G - 3 + (1 - h / big) * 5; shard(s, cx + dx, yb, w, h, lean, Rc); s.outline(); cv.paste(s)
    if glow:
        for h, dx, w, lean in sorted(specs, key=lambda s: -s[0])[:2]: cv.fx.append(('glow', int(cx + dx + lean * .5), int(G - h * .55)))
    return cv, cx


@rprop('crystal_cluster', 'Crystal cluster', .6, ['cave', 'crystal', 'route'], solid=.5)
def p_crystal_cluster(rng): return cluster(rng, R['crys'])


@rprop('crystal_cluster_violet', 'Violet crystal cluster', .6, ['cave', 'crystal', 'route'], solid=.5)
def p_crystal_cluster_violet(rng): return cluster(rng, R['amethyst'], n=7, big=58)


@rprop('ice_spikes', 'Ice spikes', .5, ['snow', 'cave', 'route'], solid=.4)
def p_ice_spikes(rng): return cluster(rng, R['icecr'], W=90, H=96, n=7, big=54, glow=False)


@rprop('crystal_spire', 'Crystal spire', 2.8, ['cave', 'crystal', 'route'], solid=1.6, landmark=True)
def p_crystal_spire(rng):
    """a spire of crystal taller than a house rising out of the rock at the edge of the chasms (The Spread's landmark):
    one great cyan point, its sisters round it, a violet one, small ones at its feet"""
    W, H = 270, 360; G = H - 4; cx = 135
    cv = Cv(W, H)
    b = Cv(W, H)                                            # the rock it grows out of
    pts = [(cx - 110, G), (cx - 96, G - 22), (cx - 60, G - 38), (cx - 10, G - 46), (cx + 40, G - 40), (cx + 84, G - 26), (cx + 108, G)]
    for (x, y) in b.polypts(pts): b.px(x, y, R['rockc'][3 if y < G - 30 + (x - cx) * .1 else xt(x, cx - 110, cx + 110)])
    b.outline(); cv.paste(b)
    for (dx, h, w, lean, Rc) in ((-70, 150, 34, -26, R['crys']), (68, 170, 38, 22, R['amethyst']), (-30, 200, 40, -10, R['crys']), (34, 120, 30, 16, R['crys']),
                                 (0, 262, 62, 6, R['crys'])):
        s = Cv(W, H); shard(s, cx + dx, G - 30, w, h, lean, Rc); s.outline(); cv.paste(s)
    for (dx, h, w, lean, Rc) in ((-88, 44, 16, -10, R['amethyst']), (-52, 60, 18, -6, R['crys']), (46, 52, 18, 8, R['crys']), (86, 38, 14, 10, R['amethyst']), (12, 34, 14, 2, R['amethyst'])):
        s = Cv(W, H); shard(s, cx + dx, G - 10, w, h, lean, Rc); s.outline(); cv.paste(s)
    for (x, y) in ((cx + 2, G - 200), (cx - 34, G - 150), (cx + 74, G - 130), (cx + 6, G - 90)): cv.fx.append(('glow', x, y))
    cv.fx.append(('sparkle', cx + 10, G - 300))
    return cv, cx


@rprop('geode_great', 'The Great Geode', 2.6, ['cave', 'crystal', 'town'], solid=2.0, landmark=True)
def p_geode_great(rng):
    """Mintshaft's Great Geode, split open on a stone plinth on the square: a rough grey rind, bands of agate, and
    inside a cave of violet crystals all pointing in (the town's landmark)"""
    W, H = 250, 240; G = H - 4; cx = 125
    cv = Cv(W, H)
    cv.rect(cx - 96, G - 22, cx + 96, G, lambda x, y: R['marble'][4 if y == G - 22 else xt(x, cx - 96, cx + 96)])
    cv.rect(cx - 104, G - 6, cx + 104, G, lambda x, y: R['marble'][2 if y > G - 3 else 3])
    yc = G - 112; rx, ry = 104, 92
    sh = Cv(W, H)
    for (x, y) in sh.ellpts(cx, yc, rx, ry):
        if y > G - 22: continue
        u, v = (x + .5 - cx) / rx, (y + .5 - yc) / ry
        sh.px(x, y, R['geoshell'][sph(max(-1, min(1, u)), max(-1, min(1, v)), .05)])
    # bumps on the rind
    for _ in range(40):
        a = rng.uniform(0, math.tau); r = rng.uniform(.75, .98); x, y = cx + math.cos(a) * rx * r, yc + math.sin(a) * ry * r
        if y < G - 24:
            for (px_, py_) in sh.ellpts(x, y, 4, 3):
                if sh.get(px_, py_) is not None: sh.px(px_, py_, R['geoshell'][3 if py_ < y else 1])
    sh.outline(); cv.paste(sh)
    # the open face: agate bands, then the crystal cave
    crx, cry = 80, 70
    for (k, (fr, col)) in enumerate(((1.0, R['agate'][3]), (.93, R['agate'][1]), (.88, R['amethyst'][3]), (.84, R['amethyst'][0]))):
        for (x, y) in cv.ellpts(cx + 2, yc + 4, crx * fr, cry * fr): cv.px(x, y, col)
    inside = Cv(W, H)
    rays = 34
    for k in range(rays):
        a = k / rays * math.tau + rng.uniform(-.05, .05); r0 = .84
        bx, by = cx + 2 + math.cos(a) * crx * r0, yc + 4 + math.sin(a) * cry * r0
        L = rng.uniform(20, 34); tx, ty = bx - math.cos(a) * L, by - math.sin(a) * L * .9
        w = rng.uniform(7, 11); nx, ny = -math.sin(a) * w / 2, math.cos(a) * w / 2
        poly = [(bx + nx, by + ny), (tx, ty), (bx - nx, by - ny)]
        for (x, y) in inside.polypts(poly):
            side = (x - bx) * math.cos(a + math.pi / 2) + (y - by) * math.sin(a + math.pi / 2)
            lit = (math.cos(a) < 0) != (side > 0)
            inside.px(x, y, R['amethyst'][4 if abs(side) < .9 else 3 if lit else 1])
    inside.outline(); cv.paste(inside)
    for (x, y) in cv.ellpts(cx + 2, yc + 6, 20, 16): cv.px(x, y, R['amethyst'][0])
    for (x, y) in ((cx - 30, yc - 20), (cx + 34, yc + 10), (cx + 2, yc + 6)): cv.fx.append(('glow', x, y))
    cv.fx.append(('sparkle', cx - 40, yc - 40)); cv.fx.append(('sparkle', cx + 50, yc - 10))
    cv.rect(cx - 16, G - 16, cx + 16, G - 9, lambda x, y: R['brass'][3 if y < G - 13 else 2] if 'brass' in R else R['vgold'][2])
    return cv, cx


@rprop('needle_works', 'Needle works', 2.0, ['cave', 'crystal', 'route'], box=[6.0, 2.6])
def p_needle_works(rng):
    """the Variants' needle works: a gantry with a cutter over a block of crystal, a laser line, a rack of finished
    needles (the stylus has to be long enough to play the sun), drums marked V"""
    W, H = 240, 210; G = H - 3; cx = 120
    cv = Cv(W, H)
    cv.rect(cx - 104, G - 8, cx + 104, G, lambda x, y: R['iron'][3 if y == G - 8 else 1])
    # the block of crystal on its bench
    cv.rect(cx - 64, G - 40, cx + 4, G - 8, lambda x, y: R['iron'][2 if x < cx - 40 else 1])
    s = Cv(W, H)
    for (x, y) in s.polypts([(cx - 58, G - 40), (cx - 54, G - 92), (cx - 30, G - 104), (cx - 4, G - 92), (cx - 2, G - 40)]):
        s.px(x, y, R['crys'][3 if x < cx - 40 else 4 if x < cx - 34 else 2 if x < cx - 16 else 1])
    s.outline(); cv.paste(s)
    # the gantry
    g = Cv(W, H)
    for x0 in (cx - 82, cx + 16):
        g.rect(x0, G - 150, x0 + 7, G - 8, lambda x, y: R['iron'][3 if x < x0 + 3 else 1])
    g.rect(cx - 88, G - 158, cx + 30, G - 148, lambda x, y: R['vgold'][3 if y < G - 154 else 2])
    text5(g, 'V', cx - 34, G - 157, R['vblack'][1], 1, small_font() | {'V': ['#.#', '#.#', '#.#', '#.#', '.#.']})
    g.rect(cx - 38, G - 148, cx - 22, G - 128, lambda x, y: R['iron'][2 if x < cx - 30 else 1])
    g.outline(); cv.paste(g)
    cv.line(cx - 30, G - 127, cx - 30, G - 100, R['laser'][4], 1); cv.line(cx - 31, G - 127, cx - 31, G - 101, R['laser'][2], 1)
    # the rack of needles
    r = Cv(W, H)
    r.rect(cx + 36, G - 18, cx + 100, G - 8, lambda x, y: R['wood'][3 if y < G - 14 else 1])
    for k in range(6):
        x = cx + 42 + k * 11; h = rng.randint(120, 160)
        for y in range(G - 18 - h, G - 18):
            f = (G - 18 - y) / h; hw = 3 if f < .85 else 2 if f < .95 else 1
            for d in range(-hw, hw + 1): r.px(x + d, y, R['needle'][4 if d < 0 else 3 if d == 0 else 1])
    r.rect(cx + 34, G - 100, cx + 102, G - 96, R['wood'][2])
    r.outline(); cv.paste(r)
    for dx in (cx - 96, cx - 80):
        cv.rect(dx - 7, G - 30, dx + 7, G - 8, lambda x, y: R['vgold'][3 if x < dx - 2 else 2 if x < dx + 4 else 1])
    cv.fx.append(('sparkle', cx - 30, G - 100)); cv.fx.append(('glow', cx - 30, G - 70)); cv.fx.append(('glow', cx + 70, G - 120))
    return cv, cx


@rprop('crystal_beacon', 'Miners’ beacon', 1.4, ['cave', 'crystal', 'water', 'route'], solid=.9, landmark=True)
def p_crystal_beacon(rng):
    """the old miners' beacon on the Dark Pool: a timber lattice tower with a great glowing crystal caged at the top, so
    the boats could find the far shore"""
    W, H = 130, 300; G = H - 3; cx = 65
    cv = Cv(W, H); t = Cv(W, H)
    top, half0, half1 = G - 210, 34, 16
    for side in (-1, 1):
        t.line(cx + side * half0, G, cx + side * half1, top, R['lattice'][3 if side < 0 else 1], 5)
    for k in range(6):
        y0 = G - k * 35; y1 = y0 - 35; f0 = k / 6; f1 = (k + 1) / 6
        w0 = half0 + (half1 - half0) * f0; w1 = half0 + (half1 - half0) * f1
        t.line(cx - w0, y0, cx + w1, y1, R['lattice'][2], 2); t.line(cx + w0, y0, cx - w1, y1, R['lattice'][2], 2)
        t.rect(cx - w1, y1, cx + w1, y1 + 2, R['lattice'][3])
    t.rect(cx - 26, top - 4, cx + 26, top + 2, lambda x, y: R['lattice'][3 if y < top - 1 else 1])
    t.outline(); cv.paste(t)
    c = Cv(W, H); shard(c, cx, top - 4, 22, 34, 2, R['crys'], tip=18); c.outline(); cv.paste(c)
    k2 = Cv(W, H)
    for x in (cx - 18, cx - 6, cx + 6, cx + 18): k2.rect(x, top - 64, x + 1, top - 4, R['iron'][1])
    k2.rect(cx - 22, top - 70, cx + 22, top - 64, R['iron'][2]); k2.poly([(cx - 26, top - 70), (cx, top - 90), (cx + 26, top - 70)], R['iron'][3])
    k2.outline(); cv.paste(k2)
    cv.fx.append(('glow', cx, top - 30)); cv.fx.append(('sparkle', cx + 4, top - 40))
    return cv, cx


@rprop('ice_block_safe', 'Frozen assets', 1.6, ['snow', 'cave', 'route'], solid=1.4, landmark=True)
def p_ice_block_safe(rng):
    """Frozen Assets: a block of ice as big as a shed with a safe, gold bars and coins frozen inside it (the landmark):
    whoever owns them can't get at them, which they say is the point"""
    W, H = 170, 170; G = H - 3; cx = 85
    cv = Cv(W, H)
    # the block: front face, top face, right face
    fx0, fx1, fy0 = cx - 66, cx + 40, G - 110; sx = 26; sy = 16
    inner = Cv(W, H)
    inner.rect(cx - 40, G - 70, cx + 10, G - 10, lambda x, y: R['safe'][3 if x < cx - 30 else 2 if x < cx else 1])
    for (x, y) in inner.ellpts(cx - 15, G - 44, 9, 9): inner.px(x, y, R['iron'][4] if math.hypot(x + .5 - cx + 15, y + .5 - G + 44) > 6 else R['iron'][1])
    inner.rect(cx - 2, G - 48, cx + 4, G - 40, R['iron'][3])
    for k in range(4):
        y = G - 14 - k * 7; x0 = cx + 14 + (k % 2) * 4
        inner.rect(x0, y - 5, x0 + 18, y, lambda x, yy: R['goldbar'][4 if yy == y - 5 else 3 if x < x0 + 6 else 2])
    for k in range(9):
        x, y = cx - 56 + rng.uniform(0, 100), G - rng.uniform(8, 80)
        for (px_, py_) in inner.ellpts(x, y, 3, 2): inner.px(px_, py_, R['goldbar'][3])
    inner.outline(); cv.paste(inner)
    # the ice: clear enough to see what is frozen in it (the front face is a blue-white wash over whatever is behind),
    # its top face pale, its right face in shade
    mix = lambda c, d, k: tuple(int(c[i] * (1 - k) + d[i] * k) for i in range(3))
    for y in range(fy0, G + 1):
        for x in range(fx0, fx1 + 1):
            c = cv.get(x, y); depth = .62 - .22 * (y - fy0) / (G - fy0)
            cv.px(x, y, mix(c, R['icecr'][4], .42) if c is not None else mix(R['icecr'][2], R['icecr'][4], depth))
    for (x, y) in cv.polypts([(fx0, fy0), (fx0 + sx, fy0 - sy), (fx1 + sx, fy0 - sy), (fx1, fy0)]): cv.px(x, y, R['icecr'][4] if (x - y) % 9 else R['icecr'][3])
    for (x, y) in cv.polypts([(fx1, fy0), (fx1 + sx, fy0 - sy), (fx1 + sx, G - sy), (fx1, G)]): cv.px(x, y, R['icecr'][1] if (x + y) % 6 else R['icecr'][2])
    for k in range(5):                                        # streaks and a glint down the front
        x0 = fx0 + 8 + k * 22; cv.line(x0, fy0 + 6, x0 + 14, G - 8, R['icecr'][4], 1)
    cv.line(fx0 + 3, fy0 + 3, fx0 + 3, G - 4, R['icecr'][4], 1)
    o = Cv(W, H)
    for y in range(fy0 - sy - 2, G + 2):
        for x in range(fx0 - 2, fx1 + sx + 3):
            if cv.get(x, y) is not None: o.px(x, y, cv.get(x, y))
    o.outline(R['icecr'][0]); cv.paste(o)
    for k in range(9):                                        # icicles off the front edge, snow on top
        x = fx0 + 6 + k * 12 + rng.randint(-2, 2); L = rng.randint(6, 16)
        for j in range(L):
            hw = 2 if j < L * .4 else 1 if j < L * .8 else 0
            for d in range(-hw, hw + 1): cv.px(x + d, fy0 + j, R['icecr'][4 if d < 0 else 2])
    for (x, y) in cv.polypts([(fx0 - 2, fy0 + 1), (fx0 + sx - 4, fy0 - sy - 3), (fx1 + sx + 2, fy0 - sy - 4), (fx1 + 4, fy0 + 2)]):
        if y < fy0 - 2 + (x - fx0) * 0: cv.px(x, y, R['snow'][4] if 'snow' in R else (250, 252, 255))
    cv.fx.append(('sparkle', cx - 30, G - 90)); cv.fx.append(('sparkle', cx + 30, G - 60))
    return cv, cx


@rprop('mine_entrance', 'Mine entrance', 1.4, ['cave', 'crystal', 'town', 'route'], box=[4.6, 2.2])
def p_mine_entrance(rng):
    """a mine tunnel into a rock face: a timber portal, darkness inside, rails running out, a lantern on a hook"""
    W, H = 180, 160; G = H - 3; cx = 90
    cv = Cv(W, H)
    rk = Cv(W, H)
    pts = [(cx - 86, G), (cx - 80, G - 60), (cx - 62, G - 104), (cx - 30, G - 128), (cx + 10, G - 134), (cx + 50, G - 120), (cx + 76, G - 86), (cx + 86, G)]
    for (x, y) in rk.polypts(pts):
        n = rng.random(); rk.px(x, y, R['rockc'][xt(x, cx - 86, cx + 86) if n > .08 else 0])
    for _ in range(26):
        x, y = cx + rng.uniform(-70, 70), G - rng.uniform(10, 110)
        if rk.get(int(x), int(y)) is not None: rk.line(x, y, x + rng.uniform(4, 12), y + rng.uniform(-2, 3), R['rockc'][4], 1)
    rk.outline(); cv.paste(rk)
    for y in range(G - 74, G):
        for x in range(cx - 28, cx + 28):
            f = (y - (G - 74)) / 74; cv.px(x, y, (12, 10, 18) if f < .7 else (24 + int(f * 10), 20, 30))
    p = Cv(W, H)
    for x0 in (cx - 34, cx + 26): p.rect(x0, G - 80, x0 + 8, G, lambda x, y: R['wood'][3 if x < x0 + 3 else 1])
    p.rect(cx - 40, G - 88, cx + 40, G - 78, lambda x, y: R['wood'][4 if y < G - 85 else 2])
    p.outline(); cv.paste(p)
    for x in range(cx - 18, cx + 19):
        if x in (cx - 14, cx + 14) or True:
            pass
    for y in range(G - 30, G + 1, 5): cv.rect(cx - 20, y, cx + 20, y + 1, R['wood'][1])
    for x in (cx - 14, cx + 13): cv.rect(x, G - 30, x + 1, G, R['iron'][3])
    cv.rect(cx + 44, G - 74, cx + 45, G - 66, R['iron'][1]); cv.rect(cx + 41, G - 66, cx + 48, G - 56, lambda x, y: R['vgold'][3] if (x + y) % 3 else R['iron'][2])
    cv.fx.append(('glow', cx + 44, G - 61))
    return cv, cx

# ============================================================================= Coral Trench
R.update({k: ramp(v) for k, v in dict(hull=(236, 238, 242), hullb=(40, 62, 110), tint=(70, 96, 120), teak=(186, 136, 84), coral=(240, 120, 104), coralp=(232, 112, 170),
                                      coralo=(246, 168, 72), fan=(150, 98, 196), conch=(244, 196, 176), conchi=(236, 132, 140), kelp=(124, 120, 52), corrug=(148, 158, 170),
                                      vinyl=(44, 40, 52), sea=(64, 140, 170)).items() if k not in R})


def hull_shape(cv, x0, x1, yw, h, bow, Rh, stripe=None):
    """a boat's hull from the side: the stern at x0, the bow at x1 rising by `bow`, waterline yw, `h` high at the stern"""
    pts = []
    for k in range(41):
        t = k / 40; x = x0 + (x1 - x0) * t
        top = yw - h - bow * max(0, (t - .55) / .45) ** 1.6
        pts.append((x, top))
    bot = []
    for k in range(41):
        t = 1 - k / 40; x = x0 + (x1 - x0) * t
        y = yw - (h * .7) * max(0, (t - .78) / .22) ** 1.4               # the bow sweeps up from the waterline
        bot.append((x + 2 if t > .98 else x, y))
    poly = pts + bot
    for (x, y) in cv.polypts(poly):
        t = (x - x0) / (x1 - x0); top = yw - h - bow * max(0, (t - .55) / .45) ** 1.6
        v = (y - top) / max(1, yw - top)
        n = 4 if v < .08 else 3 if v < .35 else 2 if v < .75 else 1
        cv.px(x, y, Rh[n])
        if stripe and .5 < v < .66: cv.px(x, y, stripe[2 if v < .58 else 1])
    return poly


@rprop('yacht_super', 'Superyacht', 2.6, ['water', 'harbour', 'town'], box=[11.6, 3.0], landmark=True)
def p_yacht_super(rng):
    """the superyacht Diversified, moored at Port Folio (the landmark): three decks of dark glass, a radar mast, a
    helipad at the stern, a tender on its davits, and a name nobody can afford to paint over"""
    W, H = 420, 190; G = H - 6; x0, x1 = 14, 408
    cv = Cv(W, H)
    hl = Cv(W, H); hull_shape(hl, x0, x1, G, 44, 26, R['hull'], R['hullb']); hl.outline(); cv.paste(hl)
    # decks stepping back from the bow
    for (k, (a, b, h)) in enumerate(((40, 330, 30), (90, 300, 26), (150, 270, 22))):
        y1 = G - 44 - k * 30 - (2 if k else 0); y0 = y1 - h
        d = Cv(W, H)
        slope = 18
        for (x, y) in d.polypts([(x0 + a, y1), (x0 + a + 6, y0), (x0 + b - slope, y0), (x0 + b, y1)]):
            v = (y - y0) / h; d.px(x, y, R['hull'][4 if v < .14 else 3 if v < .3 else 2])
        for (x, y) in d.polypts([(x0 + a + 12, y0 + 7), (x0 + b - slope - 4, y0 + 7), (x0 + b - 8, y1 - 5), (x0 + a + 10, y1 - 5)]):
            d.px(x, y, R['tint'][3 if (x - y) % 17 < 3 else 1])
        d.rect(x0 + a, y1 - 2, x0 + b, y1, R['teak'][3])
        d.outline(); cv.paste(d)
    m = Cv(W, H)                                              # the mast, radar dome, aerials
    m.rect(x0 + 200, G - 158, x0 + 206, G - 134, R['hull'][2]); m.rect(x0 + 190, G - 160, x0 + 220, G - 156, R['hull'][3])
    for (x, y) in m.ellpts(x0 + 214, G - 168, 9, 9): m.px(x, y, R['hull'][sph((x + .5 - x0 - 214) / 9, (y + .5 - G + 168) / 9)])
    m.line(x0 + 196, G - 160, x0 + 192, G - 182, R['iron'][2], 1); m.line(x0 + 202, G - 160, x0 + 204, G - 178, R['iron'][2], 1)
    m.outline(); cv.paste(m)
    t = Cv(W, H); hull_shape(t, x0 + 52, x0 + 92, G - 52, 9, 4, R['hull'], R['vgold']); t.outline(); cv.paste(t)   # the tender
    for x in (x0 + 58, x0 + 86): cv.rect(x, G - 74, x + 1, G - 62, R['iron'][2])
    text5(cv, 'DIVERSIFIED', x0 + 150, G - 37, R['hullb'][1], 1, FONT)
    for x in range(x0 + 20, x1 - 30, 7): cv.px(x, G - 46, R['iron'][4])     # rail
    cv.fx.append(('window', x0 + 180, G - 84)); cv.fx.append(('window', x0 + 230, G - 112)); cv.fx.append(('glow', x0 + 214, G - 168))
    return cv, W // 2


@rprop('yacht_small', 'Motor yacht', 1.4, ['water', 'harbour', 'town'], box=[6.4, 2.0])
def p_yacht_small(rng):
    W, H = 230, 120; G = H - 5; x0, x1 = 8, 222
    cv = Cv(W, H); Rb = [R['hullb'], R['vgold'], R['coral']][rng.randrange(3)]
    hl = Cv(W, H); hull_shape(hl, x0, x1, G, 30, 16, R['hull'], Rb); hl.outline(); cv.paste(hl)
    d = Cv(W, H); y1 = G - 30; y0 = y1 - 26
    for (x, y) in d.polypts([(x0 + 40, y1), (x0 + 46, y0), (x0 + 140, y0), (x0 + 168, y1)]): d.px(x, y, R['hull'][4 if y < y0 + 4 else 3])
    for (x, y) in d.polypts([(x0 + 54, y0 + 6), (x0 + 136, y0 + 6), (x0 + 156, y1 - 4), (x0 + 52, y1 - 4)]): d.px(x, y, R['tint'][3 if (x - y) % 15 < 3 else 1])
    d.outline(); cv.paste(d)
    cv.rect(x0 + 96, y0 - 14, x0 + 99, y0, R['iron'][2]); cv.rect(x0 + 88, y0 - 16, x0 + 108, y0 - 13, R['hull'][3])
    return cv, W // 2


def coral_branch(cv, x, y, a, L, w, Rc, rng, depth=0):
    """antler coral: a branch that forks, thinning to rounded tips"""
    ex, ey = x + math.cos(a) * L, y - math.sin(a) * L
    cv.line(x, y, ex, ey, Rc[2 if math.cos(a) > 0 else 3], max(1, int(w)))
    cv.line(x - 1, y, ex - 1, ey, Rc[3], 1)
    if depth < 3 and L > 8:
        for da in (-.45, .4):
            coral_branch(cv, ex, ey, a + da + rng.uniform(-.15, .15), L * rng.uniform(.6, .78), w * .72, Rc, rng, depth + 1)
    else:
        for (px_, py_) in cv.ellpts(ex, ey, max(2, w * .8), max(2, w * .8)): cv.px(px_, py_, Rc[4] if py_ < ey else Rc[3])


@rprop('coral_tower', 'Coral tower', 3.0, ['water', 'reef', 'route'], solid=2.0, landmark=True)
def p_coral_tower(rng):
    """a reef taller than a house standing out of the shallows of Shell Company Shoals (the landmark): a pillar of old
    coral rock, its sides shelved with plate corals, brain coral domes, purple tube sponges and a sea fan, antler
    coral on top"""
    W, H = 300, 370; G = H - 4; cx = 150
    cv = Cv(W, H)
    col = Cv(W, H)                                              # the pillar, wider at the foot, a little crooked
    top = G - 250
    for y in range(top, G + 1):
        f = (y - top) / (G - top); hw = 34 + 54 * f ** 1.7 + 6 * math.sin(f * 9); off = 10 * math.sin(f * 3.2)
        for x in range(int(cx + off - hw), int(cx + off + hw) + 1):
            n = xt(x, cx + off - hw, cx + off + hw)
            if (x * 7 + y * 3) % 13 == 0: n = max(0, n - 1)
            col.px(x, y, R['coralo'][n] if f > .7 else R['coral'][n])
    for (x, y) in col.ellpts(cx + 4, top + 2, 36, 12): col.px(x, y, R['coral'][4 if y < top else 3])
    for _ in range(90):
        x, y = cx + rng.uniform(-80, 80), rng.uniform(top + 10, G - 6)
        if col.get(int(x), int(y)) is not None: col.px(int(x), int(y), R['coralo'][4] if rng.random() < .5 else R['coralp'][3])
    col.outline(); cv.paste(col)
    f = Cv(W, H)                                                # the fan, behind the right shoulder
    for k in range(90):
        a = math.pi * (.15 + .5 * k / 90); L = rng.uniform(50, 70)
        f.line(cx + 52, G - 130, cx + 52 + math.cos(a) * L, G - 130 - math.sin(a) * L, R['fan'][2 if k % 3 else 3], 1)
    f.outline()
    out = Cv(W, H); out.paste(f); out.paste(cv); cv = out
    for (x, y, w, h, Rc) in ((cx - 70, G - 120, 38, 9, R['coralo']), (cx + 62, G - 168, 34, 8, R['coralp']), (cx - 52, G - 200, 30, 7, R['coral']),
                             (cx + 72, G - 74, 40, 9, R['coralo']), (cx - 84, G - 50, 34, 8, R['coralp'])):       # plate corals, shelves off the sides
        d = Cv(W, H)
        for (px_, py_) in d.ellpts(x, y, w, h):
            v = (py_ + .5 - y) / h; d.px(px_, py_, Rc[4 if v < -.4 else 3 if v < .1 else 1])
        d.outline(); cv.paste(d)
    for (x, y, r, Rc) in ((cx - 30, G - 150, 16, R['coralo']), (cx + 24, G - 100, 20, R['coralp']), (cx - 6, G - 40, 22, R['coralo']), (cx + 40, G - 222, 13, R['coralp'])):  # brain coral
        d = Cv(W, H)
        for (px_, py_) in d.ellpts(x, y, r, r * .8):
            u, v = (px_ + .5 - x) / r, (py_ + .5 - y) / (r * .8); n = sph(max(-1, min(1, u)), max(-1, min(1, v)))
            if int(px_ * 1.3 + math.sin(py_ * .7) * 3) % 5 == 0: n = max(0, n - 1)
            d.px(px_, py_, Rc[n])
        d.outline(); cv.paste(d)
    for (x, y, n) in ((cx - 64, G - 150, 3), (cx + 30, G - 52, 4)):            # tube sponges
        d = Cv(W, H)
        for k in range(n):
            tx, th = x + k * 9 - n * 4, rng.randint(22, 40)
            d.rect(tx, y - th, tx + 6, y, lambda xx, yy: R['fan'][3 if xx < tx + 2 else 2 if xx < tx + 5 else 1])
            for (px_, py_) in d.ellpts(tx + 3, y - th, 4, 2): d.px(px_, py_, R['fan'][0] if py_ >= y - th else R['fan'][4])
        d.outline(); cv.paste(d)
    for (x, a, L, w, Rc) in ((cx - 14, 1.95, 36, 6, R['coralo']), (cx + 16, 1.25, 38, 6, R['coralp']), (cx + 2, 1.6, 30, 5, R['coral'])):   # antler coral on top
        c = Cv(W, H); coral_branch(c, x, top + 4, a, L, w, Rc, rng, 1); c.outline(); cv.paste(c)
    cv.fx.append(('sparkle', cx + 20, top - 40))
    return cv, cx


@rprop('shell_company', 'Shell company', 1.4, ['beach', 'reef', 'town', 'route'], box=[3.6, 2.2])
def p_shell_company(rng):
    """a giant conch lying on the sand with a little door in it and a brass plate: SHELL CO. LTD, REGISTERED OFFICE.
    The letterbox is full. Nobody has ever come out"""
    W, H = 140, 110; G = H - 3; cx = 70
    cv = Cv(W, H); s = Cv(W, H)
    # the body of the shell: a fat spiral cone lying on its side, its point to the left
    for (x, y) in s.polypts([(cx - 64, G - 30), (cx - 20, G - 74), (cx + 30, G - 84), (cx + 62, G - 58), (cx + 64, G - 10), (cx + 20, G), (cx - 30, G - 6)]):
        u = (x - cx + 64) / 128; v = (y - (G - 84)) / 84
        band = int((u * 9 + v * 3)) % 2
        s.px(x, y, R['conch'][(4 if v < .3 else 3 if v < .6 else 2) - band])
    for k in range(6):                                          # spines along the top
        x = cx - 40 + k * 16; y = G - 70 - (k % 3) * 4
        s.poly([(x - 5, y + 6), (x, y - 10), (x + 5, y + 6)], R['conch'][4])
    for (x, y) in s.ellpts(cx + 34, G - 36, 24, 26): s.px(x, y, R['conchi'][3 if x < cx + 30 else 2])        # the pink mouth
    s.outline(); cv.paste(s)
    door(cv, cx + 34, G - 12, 16, 26, Rw=R['dwood'], arch=True, glass=False)
    cv.rect(cx + 4, G - 50, cx + 22, G - 44, lambda x, y: R['vgold'][3 if y < G - 47 else 2])
    cv.rect(cx + 50, G - 30, cx + 60, G - 24, R['iron'][2])
    for k in range(4): cv.rect(cx + 50 + k * 2, G - 34 - k, cx + 55 + k * 2, G - 31 - k, (244, 240, 228))
    return cv, cx


@rprop('kelp_tall', 'Kelp', .3, ['water', 'reef', 'route'], sway=.6)
def p_kelp_tall(rng):
    """kelp: three or four stems rising and waving, long ribbon blades off them by turns, a float at each blade's foot"""
    W, H = 80, 130; G = H - 2; cx = 40
    cv = Cv(W, H)
    for k in range(4):
        x = cx - 15 + k * 10 + rng.uniform(-2, 2); ph = rng.uniform(0, 6); L = rng.randint(80, 122)
        st = Cv(W, H)
        pts = [(x + math.sin(j / 13 + ph) * 4, G - j) for j in range(L)]
        for (xx, y) in pts: st.px(int(xx), y, R['kelp'][2]); st.px(int(xx) + 1, y, R['kelp'][1])
        for j in range(10, L - 4, 12):
            xx, y = pts[j]; side = 1 if (j // 12) % 2 else -1; bl = rng.uniform(13, 19)
            for t in range(int(bl)):
                f = t / bl; bx = xx + side * (t * .8); by = y - t * .55 + math.sin(f * 3 + ph) * 1.5; w = 2.5 * math.sin(math.pi * min(1, f * 1.1 + .05))
                for d in range(-int(w), int(w) + 1): st.px(int(bx), int(by + d), R['kelp'][4 if d < 0 else 3 if d == 0 else 2])
            for (px_, py_) in st.ellpts(xx + side * 1.5, y, 2, 2): st.px(px_, py_, R['kelp'][4])
        st.outline(); cv.paste(st)
    return cv, cx


@rprop('pressing_plant', 'The pressing plant', 3.2, ['water', 'harbour', 'route'], box=[10.0, 4.4], landmark=True)
def p_pressing_plant(rng):
    """the Variants' pressing plant on its piles over the trench (the landmark): corrugated sheds, steam stacks, tanks
    of vinyl, a gold V on the roof, and through the great door the press itself, a black disc as big as a room"""
    W, H = 380, 300; G = H - 4; cx = 190
    cv = Cv(W, H)
    for x in range(cx - 170, cx + 170, 22):                     # the piles
        cv.rect(x, G - 30, x + 6, G, lambda xx, y: R['iron'][3 if xx < x + 2 else 1])
    cv.rect(cx - 178, G - 38, cx + 178, G - 28, lambda x, y: R['iron'][4 if y < G - 35 else 2])
    sh = Cv(W, H); y1 = G - 38; y0 = y1 - 130
    for (x, y) in sh.polypts([(cx - 160, y1), (cx - 160, y0), (cx - 40, y0 - 40), (cx + 80, y0), (cx + 80, y1)]):
        sh.px(x, y, R['corrug'][(3 if x < cx - 40 else 1) + (1 if x % 6 == 0 else 0) - (1 if x % 6 == 3 else 0)])
    sh.outline(); cv.paste(sh)
    for (x, y) in cv.polypts([(cx - 110, y1), (cx - 110, y1 - 96), (cx + 30, y1 - 96), (cx + 30, y1)]): cv.px(x, y, (22, 20, 30))      # the great door
    pr = Cv(W, H)                                                 # the press inside: a black disc, a gold label
    for (x, y) in pr.ellpts(cx - 40, y1 - 40, 58, 22):
        r = math.hypot((x + .5 - cx + 40) / 58, (y + .5 - y1 + 40) / 22)
        pr.px(x, y, R['vgold'][3] if r < .28 else R['vinyl'][3 if (int(r * 30)) % 3 == 0 else 1])
    pr.rect(cx - 46, y1 - 96, cx - 34, y1 - 60, R['iron'][2]); pr.rect(cx - 80, y1 - 18, cx, y1 - 2, R['iron'][1])
    pr.outline(); cv.paste(pr)
    for (tx, th) in ((cx + 100, 120), (cx + 140, 96)):           # vinyl tanks
        t = Cv(W, H)
        for y in range(y1 - th, y1):
            for x in range(tx - 18, tx + 18): t.px(x, y, R['vinyl'][xt(x, tx - 18, tx + 18) + (1 if y < y1 - th + 6 else 0)])
        for (x, y) in t.ellpts(tx, y1 - th, 18, 5): t.px(x, y, R['vinyl'][4 if y < y1 - th else 3])
        t.outline(); cv.paste(t)
    for (sx, sh_) in ((cx - 140, 60), (cx + 40, 74)):             # steam stacks
        cv.rect(sx, y0 - sh_, sx + 12, y0 + 10, lambda x, y: R['iron'][3 if x < sx + 4 else 1]); cv.fx.append(('smoke', sx + 6, y0 - sh_ - 4))
    cv.rect(cx - 70, y0 - 64, cx - 10, y0 - 36, lambda x, y: R['vgold'][3 if y < y0 - 50 else 2])
    text5(cv, 'V', cx - 46, y0 - 60, R['vblack'][1], 3, FONT)
    for k in range(3): cv.rect(cx + 160 - k * 4, y1 - 20 - k * 10, cx + 176 - k * 4, y1 - 12 - k * 10, R['vinyl'][2])
    cv.fx.append(('glow', cx - 40, y1 - 40)); cv.fx.append(('window', cx + 60, y0 + 20)); cv.fx.append(('glow', cx - 40, y0 - 50))
    return cv, cx


@rprop('record_crates', 'Crates of records', .5, ['harbour', 'town', 'route'], solid=.6)
def p_record_crates(rng):
    W, H = 70, 64; G = H - 2; cx = 35
    cv = Cv(W, H)
    for (x0, y0, w, h) in ((cx - 30, G - 22, 30, 22), (cx + 2, G - 22, 28, 22), (cx - 16, G - 42, 30, 20)):
        c = Cv(W, H); c.rect(x0, y0, x0 + w, y0 + h, lambda x, y: R['wood'][3 if x < x0 + 4 else 2 if x < x0 + w - 4 else 1])
        for k in range(5): c.rect(x0 + 3 + k * 5, y0 - 4, x0 + 5 + k * 5, y0, R['vinyl'][1 + k % 2])
        text5(c, 'V', x0 + w // 2 - 1, y0 + 8, R['vgold'][3], 1, small_font() | {'V': ['#.#', '#.#', '#.#', '#.#', '.#.']})
        c.outline(); cv.paste(c)
    return cv, cx

# ============================================================================= Cloud Spire
R.update({k: ramp(v) for k, v in dict(glass=(58, 92, 150), cloud=(236, 240, 250), awning=(214, 74, 150), awning2=(70, 186, 196), server=(64, 68, 82), led=(110, 240, 140),
                                      panel=(44, 70, 138), concrete=(172, 168, 160), ferris=(210, 214, 222), gond1=(232, 150, 160), gond2=(150, 196, 226), gond3=(236, 214, 130),
                                      carou=(214, 92, 96), bubble=(196, 226, 246), marble2=(240, 236, 230), velvet=(150, 30, 60)).items() if k not in R})


def puff(cv, x, y, r, Rc, rng, n=7):
    """a soft cloud: overlapping balls lit from the top"""
    for k in range(n):
        a = k / n * math.pi; px0, py0 = x + math.cos(a) * r * .9, y - math.sin(a) * r * .45; rr = r * rng.uniform(.42, .62)
        for (px_, py_) in cv.ellpts(px0, py0, rr, rr * .85):
            v = (py_ + .5 - (py0 - rr * .4)) / (rr * 1.6); cv.px(px_, py_, Rc[4 if v < .35 else 3 if v < .75 else 2])
    for (px_, py_) in cv.ellpts(x, y, r * 1.1, r * .45): cv.px(px_, py_, Rc[2] if cv.get(px_, py_) is None or py_ > y else cv.get(px_, py_))


@rprop('spire_tower', 'The Spire', 3.4, ['city', 'sky', 'town'], solid=2.4, landmark=True)
def p_spire_tower(rng):
    """the foot of the tower that goes up through the clouds (Upside City's landmark): dark glass, gold bands, a grand
    entrance with a gold canopy, and a ring of cloud where it disappears upwards"""
    W, H = 260, 500; G = H - 4; cx = 130
    cv = Cv(W, H)
    cv.rect(cx - 112, G - 10, cx + 112, G, lambda x, y: R['marble2'][4 if y == G - 10 else xt(x, cx - 112, cx + 112)])
    cv.rect(cx - 100, G - 18, cx + 100, G - 10, lambda x, y: R['marble2'][3 if y < G - 15 else 2])
    t = Cv(W, H); top = 70
    for y in range(top, G - 18):
        f = (y - top) / (G - 18 - top); hw = 46 + 40 * f ** 1.4
        for x in range(int(cx - hw), int(cx + hw) + 1):
            u = (x + .5 - cx) / hw; n = 3 if u < -.55 else 2 if u < 0 else 1 if u < .6 else 0
            if (y - top) % 14 in (0, 1) and abs(u) < .97: n = min(4, n + 1)                     # floors
            if int((x - cx) * 7 / max(8, hw)) % 2 == 0 and (y - top) % 14 > 3 and abs(u) < .9: n = max(0, n - 0)
            t.px(x, y, R['glass'][n])
        if (y - top) % 70 < 4:
            for x in range(int(cx - hw) - 2, int(cx + hw) + 3): t.px(x, y, R['vgold'][3 if (y - top) % 70 < 2 else 1])
    for k in range(6):                                          # the light catching the glass
        x0 = cx - 30 + k * 4; t.line(x0, top + 20 + k * 30, x0 - 8, top + 60 + k * 30, R['glass'][4], 1)
    t.outline(); cv.paste(t)
    cv.rect(cx - 40, G - 74, cx + 40, G - 18, lambda x, y: R['glass'][1] if (x - cx) % 16 else R['vgold'][2])          # the entrance
    for (x, y) in cv.polypts([(cx - 58, G - 80), (cx + 58, G - 80), (cx + 50, G - 90), (cx - 50, G - 90)]): cv.px(x, y, R['vgold'][3 if y < G - 85 else 2])
    cv.rect(cx - 58, G - 80, cx + 58, G - 77, R['vgold'][1])
    c = Cv(W, H)                                              # the cloud the tower goes up into
    for (x, y, r) in ((cx - 80, top + 34, 46), (cx + 76, top + 30, 50), (cx, top + 18, 60), (cx - 30, top + 44, 40), (cx + 34, top + 46, 42)):
        puff(c, x, y, r, R['cloud'], rng)
    c.outline(R['cloud'][1]); cv.paste(c)
    for (x, y) in ((cx - 30, G - 160), (cx + 20, G - 230), (cx - 10, G - 300), (cx + 30, G - 120)): cv.fx.append(('window', x, y))
    cv.fx.append(('glow', cx, G - 84))
    return cv, cx


@rprop('night_stall', 'Night market stall', .9, ['city', 'town', 'market'], box=[3.0, 1.4])
def p_night_stall(rng):
    W, H = 120, 120; G = H - 3; cx = 60
    cv = Cv(W, H); Ra, Rb = (R['awning'], R['awning2']) if rng.random() < .5 else (R['awning2'], R['awning'])
    cv.rect(cx - 46, G - 34, cx + 46, G, lambda x, y: R['wood'][3 if y < G - 30 else 2 if x < cx + 30 else 1])
    for k in range(6):
        x = cx - 40 + k * 15
        for (px_, py_) in cv.ellpts(x, G - 38, 5, 4): cv.px(px_, py_, [R['vgold'], R['coral'], R['awning2']][k % 3][3 if py_ < G - 38 else 2])
    for x0 in (cx - 48, cx + 44): cv.rect(x0, G - 86, x0 + 4, G - 34, R['wood'][2])
    a = Cv(W, H)
    for (x, y) in a.polypts([(cx - 56, G - 70), (cx - 50, G - 96), (cx + 50, G - 96), (cx + 56, G - 70)]):
        a.px(x, y, (Ra if ((x - cx + 56) // 12) % 2 else Rb)[3 if y < G - 84 else 2])
    for k in range(9): a.ellpts and [a.px(px_, py_, (Ra if k % 2 else Rb)[2]) for (px_, py_) in a.ellpts(cx - 50 + k * 12.5, G - 70, 6.5, 4) if py_ >= G - 70]
    a.outline(); cv.paste(a)
    for k in range(7):                                          # the string of lanterns
        x = cx - 48 + k * 16; y = G - 64 + int(3 * math.sin(k * .9))
        for (px_, py_) in cv.ellpts(x, y, 3, 4): cv.px(px_, py_, R['vgold'][4] if py_ < y else R['coral'][3])
        cv.fx.append(('glow', x, y))
    return cv, cx


@rprop('server_rack', 'Server racks', .8, ['city', 'tech', 'route'], box=[3.2, 1.2])
def p_server_rack(rng):
    W, H = 120, 90; G = H - 3; cx = 60
    cv = Cv(W, H)
    for k in range(3):
        x0 = cx - 50 + k * 34; c = Cv(W, H)
        c.rect(x0, G - 70, x0 + 30, G, lambda x, y: R['server'][3 if x < x0 + 4 else 2 if x < x0 + 26 else 1])
        c.rect(x0, G - 74, x0 + 30, G - 70, R['server'][4])
        for j in range(8):
            y = G - 64 + j * 7; c.rect(x0 + 5, y, x0 + 25, y + 4, R['server'][0])
            for d in range(3):
                if rng.random() < .7: c.px(x0 + 7 + d * 3, y + 2, R['led'][4] if rng.random() < .6 else (110, 170, 255))
        c.outline(); cv.paste(c); cv.fx.append(('window', x0 + 15, G - 40))
    for k in range(4): cv.line(cx - 40 + k * 26, G, cx - 52 + k * 30, G + 2, R['vblack'][1], 2)
    return cv, cx


@rprop('solar_panel', 'Solar panels', .7, ['city', 'tech', 'route'], box=[3.4, 1.4])
def p_solar_panel(rng):
    W, H = 130, 70; G = H - 3; cx = 65
    cv = Cv(W, H)
    for x in (cx - 44, cx + 40): cv.rect(x, G - 26, x + 3, G, R['iron'][2])
    p = Cv(W, H); pts = [(cx - 60, G - 18), (cx - 48, G - 56), (cx + 60, G - 56), (cx + 60, G - 18)]
    for (x, y) in p.polypts(pts):
        cell = ((x - cx) // 12 + (y - G) // 9) % 2; p.px(x, y, R['panel'][2 + cell] if (x - cx) % 12 and (y - G) % 9 else R['iron'][3])
    p.line(cx - 46, G - 54, cx + 30, G - 54, R['panel'][4], 1)
    p.outline(); cv.paste(p)
    return cv, cx


@rprop('cloud_server', 'The Cloud', 3.0, ['city', 'tech', 'route'], solid=2.6, landmark=True)
def p_cloud_server(rng):
    """the Server Farm's cooling tower, where the cloud is made (the landmark): a great concrete waist with THE CLOUD on
    it, and the cloud itself billowing out of the top"""
    W, H = 260, 340; G = H - 4; cx = 130
    cv = Cv(W, H); t = Cv(W, H); top = 110
    for y in range(top, G + 1):
        f = (y - top) / (G - top); hw = 64 + 36 * (2 * f - 1.1) ** 2
        for x in range(int(cx - hw), int(cx + hw) + 1):
            n = xt(x, cx - hw, cx + hw)
            if (y - top) % 22 == 0: n = max(0, n - 1)
            t.px(x, y, R['concrete'][n])
    for (x, y) in t.ellpts(cx, top, 70, 12): t.px(x, y, R['concrete'][0] if y > top - 6 else R['concrete'][4])
    t.outline(); cv.paste(t)
    text5(cv, 'THE', cx - text_w('THE', 2, FONT) // 2, G - 150, R['glass'][1], 2, FONT)
    text5(cv, 'CLOUD', cx - text_w('CLOUD', 2, FONT) // 2, G - 128, R['glass'][1], 2, FONT)
    c = Cv(W, H)
    for (x, y, r) in ((cx - 40, top - 20, 40), (cx + 44, top - 24, 44), (cx, top - 52, 52), (cx - 70, top - 60, 30), (cx + 76, top - 70, 34), (cx + 10, top - 92, 40)):
        puff(c, x, y, r, R['cloud'], rng)
    c.outline(R['cloud'][1]); cv.paste(c)
    cv.rect(cx - 100, G - 30, cx - 70, G, lambda x, y: R['server'][2]); cv.rect(cx + 70, G - 30, cx + 100, G, lambda x, y: R['server'][2])
    for x in (cx - 92, cx - 82, cx + 78, cx + 88): cv.px(x, G - 20, R['led'][4])
    cv.fx.append(('smoke', cx - 20, top - 40)); cv.fx.append(('smoke', cx + 30, top - 50)); cv.fx.append(('window', cx - 85, G - 20)); cv.fx.append(('window', cx + 85, G - 20))
    return cv, cx


@rprop('ferris_wheel', 'Old Ferris wheel', 3.0, ['park', 'route'], box=[6.0, 3.0], landmark=True)
def p_ferris_wheel(rng):
    """Bubbleland's Ferris wheel, stopped since the bubble burst (the landmark): faded gondolas, one hanging askew,
    rust down the legs, a vine starting up one side"""
    W, H = 380, 440; G = H - 4; cx = 190; cy = G - 236; r = 168
    cv = Cv(W, H)
    legs = Cv(W, H)
    for side in (-1, 1):
        legs.line(cx + side * 110, G, cx, cy, R['ferris'][3 if side < 0 else 1], 7); legs.line(cx + side * 70, G, cx, cy, R['ferris'][2], 5)
        legs.line(cx + side * 98, G - 30, cx + side * 62, G - 30, R['ferris'][2], 3)
    legs.outline(); cv.paste(legs)
    wh = Cv(W, H)
    for k in range(16):
        a = k / 16 * math.tau; wh.line(cx, cy, cx + math.cos(a) * r, cy + math.sin(a) * r, R['ferris'][2], 2)
    for rr, w in ((r, 4), (r - 12, 2)):
        for k in range(720):
            a = k / 720 * math.tau; x, y = cx + math.cos(a) * rr, cy + math.sin(a) * rr
            for d in range(w): wh.px(int(x + math.cos(a) * d), int(y + math.sin(a) * d), R['ferris'][3 if math.sin(a) < 0 else 1])
    for (x, y) in wh.ellpts(cx, cy, 16, 16): wh.px(x, y, R['ferris'][sph((x + .5 - cx) / 16, (y + .5 - cy) / 16)])
    for _ in range(30):                                          # rust
        a = rng.uniform(0, math.tau); x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
        for d in range(rng.randint(2, 6)): wh.px(int(x), int(y) + d, (150, 96, 70))
    wh.outline(); cv.paste(wh)
    for k in range(12):
        a = k / 12 * math.tau + .13; x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
        g = Cv(W, H); Rg = [R['gond1'], R['gond2'], R['gond3']][k % 3]; tilt = 7 if k == 4 else 0
        g.line(x, y, x + tilt, y + 12, R['iron'][1], 1)
        for (px_, py_) in g.polypts([(x - 13 + tilt, y + 12), (x + 13 + tilt, y + 12), (x + 11 + tilt * 1.4, y + 34), (x - 11 + tilt * 1.4, y + 34)]):
            g.px(px_, py_, Rg[3 if px_ < x + tilt - 4 else 2] if py_ > y + 20 else Rg[4])
        g.rect(int(x - 9 + tilt), int(y + 15), int(x + 9 + tilt), int(y + 20), R['glass'][1])
        g.outline(); cv.paste(g)
    v = Cv(W, H); x = cx - 104; y = G
    for j in range(150):
        y -= 1; x += .42 + math.sin(j / 9) * .5
        v.px(int(x), y, R['jungle2'][2]);
        if j % 8 == 0: v.px(int(x) - 1, y, R['jungle2'][3]); v.px(int(x) + 1, y - 1, R['jungle2'][1])
    cv.paste(v)
    return cv, cx


@rprop('carousel_broken', 'Old carousel', 2.0, ['park', 'route'], solid=2.4)
def p_carousel_broken(rng):
    W, H = 220, 200; G = H - 4; cx = 110
    cv = Cv(W, H)
    for (x, y) in cv.ellpts(cx, G - 10, 96, 18): cv.px(x, y, R['wood'][3 if y < G - 12 else 1])
    cv.rect(cx - 5, G - 140, cx + 5, G - 12, lambda x, y: R['vgold'][3 if x < cx else 1])
    for k, dx in enumerate((-60, -14, 36)):
        h = Cv(W, H); y0 = G - 64 - (k % 2) * 10
        h.rect(cx + dx, G - 136, cx + dx + 2, G - 14, R['vgold'][2])
        for (x, y) in h.polypts([(cx + dx - 22, y0), (cx + dx - 16, y0 - 14), (cx + dx + 14, y0 - 14), (cx + dx + 20, y0 - 30), (cx + dx + 28, y0 - 24), (cx + dx + 22, y0 - 8), (cx + dx + 16, y0 + 4), (cx + dx - 18, y0 + 4)]):
            h.px(x, y, R['marble2'][3 if y < y0 - 6 else 2])
        for lx in (cx + dx - 16, cx + dx + 12): h.rect(lx, y0 + 4, lx + 3, y0 + 16, R['marble2'][2])
        h.outline(); cv.paste(h)
    r = Cv(W, H)
    for (x, y) in r.polypts([(cx - 104, G - 128), (cx, G - 186), (cx + 104, G - 128)]):
        seg = int((math.atan2(y - (G - 186), x - cx) + math.pi) / math.pi * 12) % 2
        r.px(x, y, (R['carou'] if seg else R['marble2'])[3 if x < cx else 2])
    for k in range(13):
        x = cx - 100 + k * 16.6
        for (px_, py_) in r.ellpts(x, G - 128, 8, 6):
            if py_ >= G - 128: r.px(px_, py_, (R['carou'] if k % 2 else R['marble2'])[2])
    r.outline(); cv.paste(r)
    f = Cv(W, H); y0 = G - 6                                    # one horse, fallen off its pole
    for (x, y) in f.polypts([(cx + 64, y0), (cx + 70, y0 - 12), (cx + 100, y0 - 14), (cx + 108, y0 - 6), (cx + 100, y0)]): f.px(x, y, R['marble2'][2])
    f.outline(); cv.paste(f)
    return cv, cx


@rprop('bubble_gate', 'Bubbleland gate', 1.2, ['park', 'route'], posts=[{'x': -118, 'r': .3}, {'x': 118, 'r': .3}], landmark=False)
def p_bubble_gate(rng):
    """the gate of Bubbleland: BUBBLELAND on an arch between two posts (one letter has fallen off), and on top a
    great soap bubble, still shining"""
    W, H = 280, 250; G = H - 3; cx = 140
    cv = Cv(W, H)
    for x0 in (cx - 124, cx + 112): cv.rect(x0, G - 150, x0 + 12, G, lambda x, y: R['carou'][3 if x < x0 + 4 else 1] if (y // 12) % 2 else R['marble2'][3 if x < x0 + 4 else 1])
    s = Cv(W, H)
    for (x, y) in s.polypts([(cx - 130, G - 150), (cx - 120, G - 176), (cx + 120, G - 176), (cx + 130, G - 150)]): s.px(x, y, R['awning2'][3 if y < G - 166 else 2])
    s.outline(); cv.paste(s)
    word = 'BUBBLE ' + 'AND'
    x = cx - text_w('BUBBLELAND', 2, FONT) // 2
    for k, ch in enumerate('BUBBLELAND'):
        if k == 6: x += (len(FONT['L'][0]) + 1) * 2; continue      # the L fell off
        x = text5(cv, ch, x, G - 170, R['marble2'][4], 2, FONT)
    text5(cv, 'L', cx + 70, G - 14, R['marble2'][3], 2, FONT)      # ...and lies on the ground
    b = Cv(W, H); by = G - 214; br = 36
    for (x, y) in b.ellpts(cx, by, br, br):
        d = math.hypot(x + .5 - cx, y + .5 - by) / br; a = math.atan2(y - by, x - cx)
        if d > .82: b.px(x, y, [R['awning'], R['bubble'], R['awning2'], R['vgold']][int((a + math.pi) / math.tau * 4) % 4][3])
        elif (x - cx + 14) ** 2 + (y - by + 14) ** 2 < 60: b.px(x, y, R['bubble'][4])
        elif (x + y) % 3 == 0: b.px(x, y, R['bubble'][3])
    b.outline(R['bubble'][1]); cv.paste(b)
    cv.fx.append(('sparkle', cx - 12, by - 12))
    return cv, cx


@rprop('penthouse_gate', 'Penthouse gate', 1.8, ['sky', 'city', 'route'], box=[6.4, 1.6], landmark=True)
def p_penthouse_gate(rng):
    """the door to Vinylla's penthouse at the top of the walk (the landmark): a gold record for a door in a white
    marble frame, velvet ropes, a speaker stack on each side"""
    W, H = 240, 240; G = H - 3; cx = 120
    cv = Cv(W, H)
    f = Cv(W, H)
    f.rect(cx - 74, G - 170, cx + 74, G, lambda x, y: R['marble2'][xt(x, cx - 74, cx + 74)])
    for (x, y) in f.polypts([(cx - 84, G - 170), (cx - 74, G - 196), (cx + 74, G - 196), (cx + 84, G - 170)]): f.px(x, y, R['marble2'][4 if y < G - 186 else 3])
    f.outline(); cv.paste(f)
    for (x, y) in cv.ellpts(cx, G - 84, 62, 72):
        r = math.hypot((x + .5 - cx) / 62, (y + .5 - G + 84) / 72)
        cv.px(x, y, R['vblack'][2] if r < .2 else R['vgold'][3 if r < .32 else (4 if int(r * 26) % 3 == 0 else 2 if x < cx else 1)])
    text5(cv, 'V', cx - 2, G - 88, R['vgold'][4], 1, small_font() | {'V': ['#.#', '#.#', '#.#', '#.#', '.#.']})
    for x0 in (cx - 110, cx + 86):
        s = Cv(W, H)
        s.rect(x0, G - 96, x0 + 24, G, lambda x, y: R['vblack'][3 if x < x0 + 6 else 1])
        for y in (G - 80, G - 50, G - 20):
            for (px_, py_) in s.ellpts(x0 + 12, y, 9, 9): s.px(px_, py_, R['vblack'][0] if math.hypot(px_ + .5 - x0 - 12, py_ + .5 - y) > 4 else R['iron'][3])
        s.outline(); cv.paste(s)
    for x in (cx - 70, cx - 30, cx + 30, cx + 70):
        cv.rect(x, G - 26, x + 2, G, R['vgold'][2]); cv.rect(x - 2, G - 28, x + 4, G - 25, R['vgold'][4])
    for (a, b) in ((cx - 68, cx - 30), (cx + 32, cx + 70)):
        for x in range(a, b): cv.px(x, G - 22 + int(5 * math.sin((x - a) / (b - a) * math.pi)), R['velvet'][3]); cv.px(x, G - 21 + int(5 * math.sin((x - a) / (b - a) * math.pi)), R['velvet'][1])
    cv.fx.append(('sparkle', cx - 30, G - 130)); cv.fx.append(('glow', cx, G - 84))
    return cv, cx


# ============================================================================= The Inner Sun
R.update({k: ramp(v) for k, v in dict(sunstone=(226, 178, 112), bell=(198, 150, 70), sungold=(255, 214, 96)).items() if k not in R})


@rprop('ticker_column', 'All-time high', 1.4, ['desert', 'sun', 'route'], solid=1.0, landmark=True)
def p_ticker_column(rng):
    """a column of sun-baked stone with a band of ticker lights still running round it (All-Time High's landmark): the
    top broke off at the peak, which is where every column like it breaks"""
    W, H = 120, 340; G = H - 4; cx = 60
    cv = Cv(W, H); c = Cv(W, H)
    c.rect(cx - 40, G - 20, cx + 40, G, lambda x, y: R['sunstone'][4 if y == G - 20 else xt(x, cx - 40, cx + 40)])
    top = G - 300
    for y in range(top - 20, G - 20):
        jag = top - 20 + int(8 * math.sin((y) * 1.0)) if False else top
        for x in range(cx - 28, cx + 29):
            edge = top + int(14 * abs(math.sin((x - cx) * .21)) + (x - cx) * .3)
            if y < edge: continue
            n = xt(x, cx - 28, cx + 29)
            if (x - cx + 28) % 9 == 0: n = max(0, n - 1)                       # flutes
            c.px(x, y, R['sunstone'][n])
    c.outline(); cv.paste(c)
    yb = G - 170
    cv.rect(cx - 29, yb, cx + 29, yb + 18, R['vblack'][1])
    text5(cv, 'ATH', cx - 22, yb + 5, R['led'][4], 1, FONT)
    for k in range(3): cv.poly([(cx + 12 + k * 6, yb + 12), (cx + 15 + k * 6, yb + 6), (cx + 18 + k * 6, yb + 12)], R['led'][3])
    for k in range(4):
        x, y = cx + rng.uniform(-50, 50), G - rng.uniform(2, 8)
        for (px_, py_) in cv.ellpts(x, y, rng.uniform(5, 9), 3): cv.px(px_, py_, R['sunstone'][2 if py_ > y else 3])
    cv.fx.append(('glow', cx - 10, yb + 8)); cv.fx.append(('glow', cx + 14, yb + 8))
    return cv, cx


@rprop('closing_bell', 'The Closing Bell', 2.2, ['desert', 'sun', 'route'], box=[6.6, 2.0], landmark=True)
def p_closing_bell(rng):
    """the Closing Bell on the approach to the Inner Sun (the landmark): a bell the size of a room on a gantry of
    sun-baked stone. When it rings, everything stops trading"""
    W, H = 250, 300; G = H - 3; cx = 125
    cv = Cv(W, H)
    for x0 in (cx - 112, cx + 84):
        p = Cv(W, H); p.rect(x0, G - 250, x0 + 28, G, lambda x, y: R['sunstone'][3 if x < x0 + 8 else 2 if x < x0 + 22 else 1])
        for y in range(G - 250, G, 22): p.rect(x0, y, x0 + 28, y + 1, R['sunstone'][1])
        p.outline(); cv.paste(p)
    cv.rect(cx - 120, G - 268, cx + 120, G - 248, lambda x, y: R['sunstone'][4 if y < G - 262 else 2])
    cv.rect(cx - 3, G - 248, cx + 3, G - 222, R['iron'][2])
    b = Cv(W, H); top = G - 222
    for y in range(top, G - 40):
        f = (y - top) / (G - 40 - top); hw = 30 + 22 * f + 34 * f ** 4
        for x in range(int(cx - hw), int(cx + hw) + 1): b.px(x, y, R['bell'][xt(x, cx - hw, cx + hw)])
    for (x, y) in b.ellpts(cx, top, 30, 10): b.px(x, y, R['bell'][3])
    for (x, y) in b.ellpts(cx, G - 40, 86, 12): b.px(x, y, R['bell'][1] if y > G - 40 else R['bell'][2])
    b.outline(); cv.paste(b)
    text5(cv, 'CLOSE', cx - text_w('CLOSE', 1, FONT) // 2, G - 100, R['bell'][0], 1, FONT)
    cv.rect(cx - 2, G - 44, cx + 2, G - 20, R['bell'][1]); cv.line(cx + 2, G - 30, cx + 40, G - 4, (190, 160, 110), 2)
    cv.fx.append(('sparkle', cx - 30, G - 160))
    return cv, cx


@rprop('sun_press', 'The press', 3.6, ['sun', 'route'], box=[10.4, 4.6], landmark=True)
def p_sun_press(rng):
    """Vinylla's press at the Inner Sun (the landmark): a record as big as a house on a gold platform, a press head
    held over it on four hydraulic arms, the label a gold V, and the light of the sun coming up from under it"""
    W, H = 430, 380; G = H - 4; cx = 215
    cv = Cv(W, H)
    pl = Cv(W, H)
    for (x, y) in pl.polypts([(cx - 200, G), (cx - 180, G - 40), (cx + 180, G - 40), (cx + 200, G)]): pl.px(x, y, R['vgold'][3 if y < G - 34 else xt(x, cx - 200, cx + 200)])
    for x in range(cx - 190, cx + 190, 26): pl.rect(x, G - 30, x + 2, G, R['vgold'][1])
    pl.outline(); cv.paste(pl)
    d = Cv(W, H); dy = G - 66
    for (x, y) in d.ellpts(cx, dy, 168, 34):
        r = math.hypot((x + .5 - cx) / 168, (y + .5 - dy) / 34)
        d.px(x, y, R['vgold'][3] if r < .22 else R['vblack'][4 if r < .26 else (3 if int(r * 40) % 3 == 0 else 1 if x < cx + 60 else 0)])
    for (x, y) in d.ellpts(cx, dy + 8, 168, 34):
        if d.get(x, y) is None and y > dy: d.px(x, y, R['vblack'][0])
    d.outline(); cv.paste(d)
    text5(cv, 'V', cx - 2, dy - 3, R['vblack'][1], 1, small_font() | {'V': ['#.#', '#.#', '#.#', '#.#', '.#.']})
    arms = Cv(W, H); hy = G - 290
    for (bx, tx) in ((cx - 170, cx - 120), (cx + 170, cx + 120), (cx - 90, cx - 70), (cx + 90, cx + 70)):
        arms.line(bx, G - 44, tx, hy + 20, R['iron'][3], 8); arms.line(bx, G - 44, bx + (tx - bx) * .55, G - 44 + (hy + 20 - G + 44) * .55, R['vgold'][2], 10)
    arms.outline(); cv.paste(arms)
    h = Cv(W, H)
    for (x, y) in h.polypts([(cx - 150, hy + 30), (cx - 130, hy), (cx + 130, hy), (cx + 150, hy + 30), (cx + 120, hy + 44), (cx - 120, hy + 44)]):
        h.px(x, y, R['iron'][4 if y < hy + 6 else 3 if y < hy + 30 else 1])
    h.rect(cx - 30, hy - 40, cx + 30, hy, lambda x, y: R['vgold'][3 if x < cx - 10 else 2])
    h.outline(); cv.paste(h)
    text5(cv, 'V', cx - 8, hy - 32, R['vblack'][1], 3, FONT)
    for x in (cx - 120, cx - 40, cx + 40, cx + 120): cv.fx.append(('glow', x, G - 46))
    cv.fx.append(('sparkle', cx, hy - 50)); cv.fx.append(('glow', cx, dy))
    return cv, cx

# ============================================================================= pictures, layers, catalogue
def render_all(keys=None):
    out = []
    for key in NEW:
        if keys and key not in keys: continue
        cv, bx, img = bsp.render(key); files, extra = {}, {}
        if key in ('tree_mangrove', 'tree_blossom_great', 'tree_giant_autumn', 'tree_jungle'):
            L = LM.leaf_layers(key, img)
            if L:
                b, f, db, df = L; files[f'layers/{key}_lb.png'] = b; files[f'layers/{key}_lf.png'] = f
                extra['layers'] = [dict(img=f'scene/props/layers/{key}_lb.png', dz=db, sway=.7, shadow=0), dict(img=f'scene/props/layers/{key}_lf.png', dz=df, sway=1.4, shadow=0)]
        out.append((key, cv, bx, img, extra, files))
    return out


def main():
    args = sys.argv[1:]; prev = None
    if '--preview' in args: i = args.index('--preview'); prev = args[i + 1]; del args[i:i + 2]
    force = '--force' in args; only = [a for a in args if not a.startswith('--')] or None
    res = render_all(only)
    if prev:
        from PIL import ImageDraw
        items = []
        for key, cv, bx, img, extra, files in res:
            items.append((key, img)); items += list(files.items())
        zoom = 2 if only else 1
        W = 2400; x = y = 10; rowh = 0; out = Image.new('RGBA', (W, 6000), (116, 168, 108, 255)); d = ImageDraw.Draw(out)
        for k, im in items:
            im2 = im.resize((im.width * zoom, im.height * zoom), Image.NEAREST)
            if x + im2.width > W: x = 10; y += rowh + 24; rowh = 0
            d.text((x, y), k, fill=(20, 20, 30)); out.alpha_composite(im2, (x, y + 14)); rowh = max(rowh, im2.height + 14); x += im2.width + 20
        out.crop((0, 0, W, y + rowh + 30)).save(prev); print('preview', prev); return
    written = []; Pm = json.load(open(META)); head, D = LM.load_data(); cat = D['scenery']['props']; padd, cadd = [], []
    for key, cv, bx, img, extra, files in res:
        path = os.path.join(OUT, key + '.png')
        if bsp.save_png(img, path, force): written.append(key)
        disk = Image.open(path)
        m = bsp.prop_meta(key, cv, bx, disk if disk.size != img.size else img)
        if NEW[key]['landmark']: m['landmark'] = 1
        if extra.get('layers'): m['layers'] = extra['layers']
        for f, im in files.items():
            if bsp.save_png(im, os.path.join(OUT, f), force): written.append(f)
        if key not in Pm or force: Pm[key] = m; padd.append(key)
        if key not in cat or force:
            e = dict(name=m['name'], img='scene/props/%s.png' % key, ox=m['ox'], oy=m['oy'], shadow=m['shadow'], sway=m.get('sway', 0), flat=m.get('flat', 0), tags=m['tags'], group=m['group'])
            for f in ('box', 'fx', 'solid', 'posts', 'layers', 'glow', 'landmark'):
                if m.get(f): e[f] = m[f]
            cat[key] = e; cadd.append(key)
    bsp.write_json(META, Pm); LM.save_data(head, D)
    print(f'{len(res)} region props; pictures written: {", ".join(written) or "none (all there)"}; props.json added: {len(padd)}; catalogue added: {", ".join(cadd) or "none"}')


if __name__ == '__main__':
    main()
