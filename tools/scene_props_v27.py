# ============================================================================= v27: MORE ANIMALS, FOOTPRINTS
# Loaded by build-scene-props.py (exec) after the v26 props. Frame strips for the walk scenes' animals (all facing
# left, like the duck; the game mirrors them), and the footprint sprite left in snow, sand, ash and mud.

P.update(bunny=(176, 146, 116), squir=(200, 108, 58), frog=(104, 176, 72), gull=(236, 238, 240), goat=(232, 226, 210), tabby=(232, 150, 72), crab=(222, 86, 60), lizard=(92, 170, 128))
for _k in ('bunny', 'squir', 'frog', 'gull', 'goat', 'tabby', 'crab', 'lizard'):
    R[_k] = ramp(P[_k])


def legs(cv, xs, G, top, Rl, w=1):
    for x in xs:
        for y in range(top, G + 1):
            for dx in range(w): cv.px(x + dx, y, Rl[1] if dx else Rl[2])


def life_rabbit(f):
    """0 sitting, 1 crouched to hop, 2 mid-hop, 3 nibbling"""
    W, H = 26, 24; cv = Cv(W, H); G = H - 2; Rb = R['bunny']
    lift = 4 if f == 2 else 0; stretch = 3 if f == 2 else 0; low = 2 if f in (1, 3) else 0
    ball(cv, 15 + stretch // 2, G - 6 - lift + low // 2, 7 + stretch, 6 - low // 2, Rb)
    ball(cv, 21 + stretch, G - 4 - lift, 3, 3, R['white'])                       # tail
    hx, hy = (7, G - 6) if f == 3 else (8 - stretch // 2, G - 11 - lift + low)
    ball(cv, hx, hy, 4, 4, Rb)
    for k, dx in enumerate((0, 3)):                                             # ears
        for y in range(hy - 11 + (3 if f == 2 else 0), hy - 2):
            cv.px(hx - 1 + dx, y, Rb[3 if k == 0 else 2]); cv.px(hx + dx, y, R['pink'][3] if y > hy - 9 else Rb[2])
    cv.px(hx - 2, hy - 1, OL); cv.px(hx - 4, hy + 1, R['pink'][2])
    if f != 2: legs(cv, (10, 18), G, G - 2, Rb, 2)
    else: cv.line(19, G - 4, 24, G - 1, Rb[1], 2); cv.line(10, G - 5, 6, G - 2, Rb[1], 2)
    cv.outline()
    return cv


def life_squirrel(f):
    """0 sitting up, tail curled, 1-2 running, 3 nibbling a nut"""
    W, H = 26, 24; cv = Cv(W, H); G = H - 2; Rs = R['squir']
    if f in (1, 2):
        ball(cv, 12, G - 5, 7, 4, Rs)
        for k in range(10):                                                      # bushy tail streaming back
            ball(cv, 19 + k * .5, G - 7 - k * .9 + (1 if f == 2 else 0), 3, 3, Rs, lo=1)
        ball(cv, 5, G - 7, 3, 3, Rs); cv.px(4, G - 8, OL); cv.px(5, G - 11, Rs[3])
        legs(cv, (8 + (f - 1) * 2, 15 - (f - 1) * 2), G, G - 2, Rs)
    else:
        ball(cv, 13, G - 7, 5, 6, Rs); ball(cv, 13, G - 5, 3, 3, R['cream'], lo=2)
        for k in range(12):
            a = k / 11 * math.pi * 1.1
            ball(cv, 19 + math.sin(a) * 4, G - 3 - k * 1.3, 3, 3, Rs, lo=1)
        hx, hy = 11, G - 14 + (2 if f == 3 else 0)
        ball(cv, hx, hy, 4, 3, Rs); cv.px(hx - 2, hy - 1, OL); cv.px(hx - 1, hy - 4, Rs[3]); cv.px(hx + 1, hy - 4, Rs[3])
        if f == 3: ball(cv, hx - 3, hy + 3, 2, 2, R['dwood'])
        legs(cv, (11, 15), G, G - 2, Rs)
    cv.outline()
    return cv


def life_frog(f):
    """0 sitting, 1 crouched, 2 leaping"""
    W, H = 22, 16; cv = Cv(W, H); G = H - 2; Rf = R['frog']
    if f == 2:
        ball(cv, 11, G - 7, 7, 3, Rf); cv.line(17, G - 7, 21, G - 2, Rf[1], 2); cv.line(5, G - 8, 1, G - 11, Rf[2])
        cv.px(6, G - 10, R['white'][4]); cv.px(6, G - 9, OL)
    else:
        lo = 1 if f == 1 else 0
        ball(cv, 11, G - 4 + lo, 7, 4 - lo, Rf); ball(cv, 11, G - 3 + lo, 4, 2, R['cream'], lo=2)
        for ex in (7, 12):
            ball(cv, ex, G - 8 + lo, 2, 2, Rf); cv.px(ex, G - 9 + lo, R['white'][4]); cv.px(ex, G - 8 + lo, OL)
        cv.rect(3, G - 1, 6, G, Rf[1]); cv.rect(16, G - 1, 19, G, Rf[1])
    cv.outline()
    return cv


def life_gull(f):
    """0 standing, 1 walking, 2 wings up, 3 wings down"""
    W, H = 32, 26; cv = Cv(W, H); G = H - 2; Rg = R['gull']; Rw = ramp((150, 156, 176))
    if f >= 2:
        ball(cv, 16, G - 12, 8, 3, Rg)
        up = f == 2
        for s in (-1, 1):
            tip = (16 + s * 15, G - (22 if up else 5))
            wing = [(16 + s * 1, G - 14), (16 + s * 8, G - (19 if up else 11)), tip, (16 + s * 10, G - (15 if up else 8)), (16 + s * 4, G - 10)]
            cv.poly(wing, lambda x, y: Rg[3] if abs(x - 16) < 9 else Rw[2])
            cv.px(tip[0], tip[1], R['tire'][1]); cv.px(tip[0] - s, tip[1] + (1 if up else -1), R['tire'][1])
        ball(cv, 8, G - 13, 3, 3, Rg); cv.px(7, G - 14, OL); cv.rect(3, G - 13, 5, G - 12, R['gold'][3])
    else:
        ball(cv, 16, G - 9, 8, 5, Rg); cv.poly([(14, G - 11), (26, G - 10), (29, G - 7), (18, G - 6)], Rw[2])
        ball(cv, 9, G - 15, 4, 4, Rg); cv.px(8, G - 16, OL); cv.rect(3, G - 15, 5, G - 14, R['gold'][3]); cv.px(3, G - 14, R['red'][2])
        st = f == 1
        for x in (14 + st * 2, 18 - st * 2):
            for y in range(G - 4, G + 1): cv.px(x, y, R['orange'][2])
    cv.outline()
    return cv


def life_goat(f):
    """0 standing, 1-2 walking, 3 grazing"""
    W, H = 42, 36; cv = Cv(W, H); G = H - 2; Rg = R['goat']
    ball(cv, 22, G - 14, 12, 7, Rg)
    hx, hy = (7, G - 6) if f == 3 else (8, G - 22)
    cv.line(13, G - 18, hx + 2, hy + 2, Rg[2], 4)
    ball(cv, hx, hy, 4, 4, Rg); cv.px(hx - 2, hy - 1, OL)
    cv.line(hx + 1, hy - 3, hx + 6, hy - 8, R['stone'][2], 2); cv.line(hx + 6, hy - 8, hx + 8, hy - 6, R['stone'][2], 2)   # horns
    for y in range(hy + 3, hy + 7): cv.px(hx - 1, y, Rg[1])                                                         # beard
    ball(cv, 34, G - 18, 2, 2, Rg)
    st = (f % 2) if f in (1, 2) else 0
    legs(cv, (14 + st * 2, 18, 27, 31 - st * 2), G, G - 8, ramp((150, 140, 128)), 2)
    for x in (14 + st * 2, 18, 27, 31 - st * 2): cv.px(x, G, R['tire'][1]); cv.px(x + 1, G, R['tire'][1])
    cv.outline()
    return cv


def life_cat(f):
    """0 sitting, 1-2 walking, 3 loafing"""
    W, H = 32, 26; cv = Cv(W, H); G = H - 2; Rc = R['tabby']
    if f == 3:
        ball(cv, 16, G - 4, 10, 4, Rc); ball(cv, 7, G - 6, 4, 4, Rc)
        for y in range(G - 2, G + 1): cv.px(26, y, Rc[2])
        eyes = (5, G - 7)
    elif f == 0:
        ball(cv, 15, G - 7, 6, 7, Rc); ball(cv, 13, G - 15, 5, 4, Rc)
        for k in range(8): cv.px(21 + k // 2, G - k, Rc[1]); cv.px(22 + k // 2, G - k, Rc[2])
        eyes = (11, G - 16)
        for dx in (0, 6): cv.poly([(9 + dx, G - 18), (11 + dx, G - 22), (13 + dx, G - 18)], Rc[3])
    else:
        ball(cv, 16, G - 8, 9, 4, Rc); ball(cv, 6, G - 12, 4, 4, Rc)
        for dx in (0, 4): cv.poly([(3 + dx, G - 15), (4 + dx, G - 18), (6 + dx, G - 15)], Rc[3])
        for k in range(8): cv.px(25 + k // 3, G - 9 - k, Rc[2])
        st = f - 1; legs(cv, (10 + st * 2, 13, 19, 22 - st * 2), G, G - 5, Rc)
        eyes = (5, G - 13)
    for k in range(3): cv.px(10 + k * 3 if f != 0 else 12 + k * 2, G - (6 if f != 0 else 9), Rc[1])          # stripes
    cv.px(eyes[0], eyes[1], R['mint'][3]); cv.px(eyes[0] + 2, eyes[1], R['mint'][3])
    cv.outline()
    return cv


def life_crab(f):
    """0 claws up, 1-2 scuttling"""
    W, H = 24, 16; cv = Cv(W, H); G = H - 2; Rc = R['crab']
    ball(cv, 12, G - 5, 7, 4, Rc)
    up = 2 if f == 0 else 0
    for s in (-1, 1):
        ball(cv, 12 + s * 9, G - 9 - up, 3, 2, Rc); cv.line(12 + s * 6, G - 6, 12 + s * 8, G - 8 - up, Rc[1])
        for k in range(3): cv.line(12 + s * (3 + k * 2), G - 3, 12 + s * (5 + k * 2) + (s if f == 2 else 0), G, Rc[1])
    for ex in (10, 14): cv.px(ex, G - 10, OL); cv.px(ex, G - 9, Rc[1])
    cv.outline()
    return cv


def life_lizard(f):
    """0 basking, 1-2 running"""
    W, H = 30, 12; cv = Cv(W, H); G = H - 2; Rl = R['lizard']
    ball(cv, 12, G - 3, 7, 2, Rl); ball(cv, 4, G - 4, 3, 2, Rl); cv.px(3, G - 5, OL)
    for k in range(10): cv.px(19 + k, G - 2 + (k // 4 if f != 2 else -(k // 5)), Rl[2])
    sp = 1 if f else 0
    for x, d in ((8, -1), (15, 1)):
        cv.px(x + d * sp, G, Rl[1]); cv.px(x + d * sp * 2, G - 1 if f == 2 else G, Rl[1])
    for k in range(3): cv.px(9 + k * 3, G - 4, R['gold'][3])
    cv.outline()
    return cv


LIFE['rabbit'] = ('Rabbit', [lambda i=i: life_rabbit(i) for i in range(4)], 1, 'meadow')
LIFE['squirrel'] = ('Squirrel', [lambda i=i: life_squirrel(i) for i in range(4)], 1, 'forest')
LIFE['frog'] = ('Frog', [lambda i=i: life_frog(i) for i in range(3)], 1, 'water')
LIFE['gull'] = ('Seagull', [lambda i=i: life_gull(i) for i in range(4)], 1, 'coast')
LIFE['goat'] = ('Mountain goat', [lambda i=i: life_goat(i) for i in range(4)], 1, 'mountains')
LIFE['cat'] = ('Cat', [lambda i=i: life_cat(i) for i in range(4)], 1, 'town')
LIFE['crab'] = ('Crab', [lambda i=i: life_crab(i) for i in range(3)], 1, 'coast')
LIFE['lizard'] = ('Lizard', [lambda i=i: life_lizard(i) for i in range(3)], 1, 'volcano')


def fx_print():
    """footprints seen from above: a shoe, and a small paw"""
    pal = {'d': a(R['white'][3]), 'm': a(R['white'][4])}
    return fx_grid([["..dd..",
                     ".dmmd.",
                     ".dmmd.",
                     ".dmmd.",
                     "..dd..",
                     ".dmmd.",
                     ".dmmd.",
                     "..dd.."],
                    ["......",
                     ".d..d.",
                     "......",
                     "..mm..",
                     ".dmmd.",
                     "..dd..",
                     "......",
                     "......"]], pal), 6, 8, 2


FX['print'] = fx_print
