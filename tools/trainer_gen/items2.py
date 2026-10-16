"""Hair, faces, hats, glasses, neckwear and bags."""
import math
import numpy as np
from core import capsule, smooth_poly, grow_mask
from body import canvas, shape, VIEWS
from items import Item

# ================= HAIR =================
def hair(it, vol=1.0, fringe=None, side=-8.5, back=-4.0, width=7.5, spikes=0, curls=False, tail=None, bun=None, twin=False, buzz=False, fringe_side=-11.5):
    A = it.col(0)
    fr = fringe or (lambda x: -12.5)
    long_ = back > 1
    for v in VIEWS:
        cv = canvas(v, 'head'); head = shape(v, 'head', cv)
        if v == 'side':
            m = cv.ell_mask(-.6, -11.6, width - .3, 6.9 + vol) & cv.yband(-40, -5)
            m |= cv.poly_mask(smooth_poly([(-6.9, -13), (-7.3, min(back, 2) if long_ else back), (-2.6, min(back, 2) if long_ else back), (-1.6, -7)], 1))
            face = cv.poly_mask([(1.2, fringe_side), (9, fringe_side - 1), (9, 3), (1.2, 3)])
            m &= ~face
            if side < -6: m &= ~cv.ell_mask(-1.2, -8, 1.5, 2.4)
            if buzz: m &= grow_mask(head, 1)
        else:
            m = cv.ell_mask(0, -11.6, width, 6.9 + vol) & cv.yband(-40, -8)
            if v == 'front':
                sides = cv.poly_mask(smooth_poly([(-width, -12), (width, -12), (width + (1.1 if side > 0 else 0), side), (-width - (1.1 if side > 0 else 0), side)], 1))
                m |= sides
                xs = np.arange(-6, 6.01, .5)
                win = [(x, fr(x)) for x in xs] + [(6, 4), (-6, 4)]
                m &= ~cv.poly_mask([(-5.4, fr(-5.4))] + [(x, fr(x)) for x in xs if abs(x) <= 5.4] + [(5.4, fr(5.4)), (5.4, 1), (4.6, 30), (-4.6, 30), (-5.4, 1)])
                if side < -6: m &= ~(cv.ell_mask(-6.7, -8, 1.6, 2.4) | cv.ell_mask(6.7, -8, 1.6, 2.4))
            else:
                m |= cv.poly_mask(smooth_poly([(-width, -12), (width, -12), (width - .2, back if not long_ else min(back, 1.5)), (-width + .2, back if not long_ else min(back, 1.5))], 1))
                if back < -4 and not long_: m &= ~(cv.ell_mask(-6.7, -8, 1.4, 2.3) | cv.ell_mask(6.7, -8, 1.4, 2.3)) | cv.yband(-40, -9.5)
            if buzz: m &= grow_mask(head, 1)
        if spikes:
            for i in range(spikes):
                x = -5.5 + 11 * i / max(1, spikes - 1); x = x * (.8 if v == 'side' else 1) - (.6 if v == 'side' else 0)
                m |= cv.poly_mask([(x - 2.2, -15.5), (x + 2.2, -15.5), (x + (1.2 if v == 'side' else .6), -21.5 - (i % 2) * 1.2)])
        if curls:
            for a in range(0, 360, 30):
                r = math.radians(a); m |= cv.ell_mask(math.cos(r) * (width + .2), -12.5 + math.sin(r) * (7.4 + vol), 2.3, 2.3) & cv.yband(-40, side + 1 if v == 'front' else back)
            if v == 'front': m &= ~cv.poly_mask([(-5.2, fr(-5)), (5.2, fr(5)), (5.2, 4), (-5.2, 4)])
            if v == 'side': m &= ~cv.poly_mask([(1.4, fringe_side), (9, fringe_side), (9, 3), (1.4, 3)])
        cv.paint(m, A, ch=1)
        # strands and a highlight
        tex = grow_mask(m, -1)
        if curls:
            ys, xs = np.where(tex)
            for k in range(0, len(ys), 7):
                y, x = ys[k], xs[k]
                if (x * 7 + y * 13) % 5 == 0: cv.rgba[y, x, :3] *= .78
        else:
            for x0 in (-4, -1.5, 1.5, 4):
                cv.tint_line([(x0 * .9, -16.5), (x0 * 1.15, -12.5 if v == 'front' else back - 1)], .86, only=tex)
            cv.tint_line([(-4.5, -14.8), (-2.5, -16.2), (.5, -16.8)] if v != 'side' else [(-4.5, -15), (-1.5, -16.6), (1.5, -16.6)], 1.22, only=tex)
        it.add(v, 'head', cv)
        # long hair behind the shoulders
        if long_ and v in ('front', 'side'):
            bk = canvas(v, 'head')
            if v == 'front':
                bm = bk.poly_mask(smooth_poly([(-width + .4, -13), (width - .4, -13), (width - .2, back), (-width + .2, back)], 2))
            else:
                bm = bk.poly_mask(smooth_poly([(-7, -9), (-2.4, -6), (-2.2, back), (-8, back)], 2))
            bk.paint(bm, A, ch=1)
            for x0 in (-5, -2, 2, 5): bk.tint_line([(x0, -10), (x0 * 1.2, back - 1)], .86, only=grow_mask(bm, -1))
            it.add(v, 'head', bk, z=1 if v == 'front' else 22)
        if long_ and v == 'back':
            bk = canvas(v, 'head'); bm = bk.poly_mask(smooth_poly([(-width, -6), (width, -6), (width + 1, back), (-width - 1, back)], 2))
            bk.paint(bm, A, ch=1)
            for x0 in (-5, -2, 2, 5): bk.tint_line([(x0, -5), (x0 * 1.15, back - 1)], .86, only=grow_mask(bm, -1))
            it.add(v, 'head', bk, z=30.65)
        if tail and v != 'front':
            tl = canvas(v, 'head')
            tm = tl.poly_mask(capsule(0, -11, 0, tail, 2.4, 1.6)) if v == 'back' else tl.poly_mask(capsule(-6.4, -11.5, -8.6, tail, 2.4, 1.4))
            tl.paint(tm, A, ch=1); tl.tint_line([(0, -9), (0, tail - 1)] if v == 'back' else [(-7, -9), (-8.3, tail - 1)], .84, only=grow_mask(tm, -1))
            tl.paint(tl.ell_mask(0, -11.5, 1.6, 1.1) if v == 'back' else tl.ell_mask(-6.3, -11.5, 1.1, 1.6), it.col(1) if len(it.colors) > 1 else '#D9434B', ch=2)
            it.add(v, 'head', tl, z=30.75 if v == 'back' else 29.5)
        if bun:
            bn = canvas(v, 'head'); cx, cy = {'front': (0, -18.4), 'back': (0, -15.8), 'side': (-4.6, -16.6)}[v]
            bm = bn.ell_mask(cx, cy, 3.4, 3); bn.paint(bm, A, ch=1); bn.tint_line([(cx - 2, cy), (cx + 2, cy - 1)], .84, only=grow_mask(bm, -1))
            it.add(v, 'head', bn, z=29.5 if v == 'front' else None)
        if twin:
            for s in (-1, 1):
                if v == 'side' and s == 1: continue
                tw = canvas(v, 'head'); x0 = 7.6 * s if v != 'side' else -5
                tm = tw.poly_mask(capsule(x0, -12, x0 + 1.8 * (s if v != 'side' else -1), 6, 2.3, 1.5))
                tw.paint(tm, A, ch=1); tw.tint_line([(x0, -10), (x0 + 1.5 * s, 5)], .85, only=grow_mask(tm, -1))
                it.add(v, 'head', tw, z=29 if v == 'front' else 30.75 if v == 'back' else 29.5)


h = Item('hair_short', 'Short swept', 'hair', [('Hair', '#3B2A22')], starter=True); hair(h, fringe=lambda x: -13.6 + (x + 5.4) * .22)
h = Item('hair_spiky', 'Spiky', 'hair', [('Hair', '#E2B84A')], starter=True); hair(h, vol=2, spikes=5, fringe=lambda x: -11.4 - (abs(math.sin(x * 1.3)) * 1.6))
h = Item('hair_buzz', 'Buzz cut', 'hair', [('Hair', '#2C2420')], starter=True); hair(h, vol=0, buzz=True, fringe=lambda x: -14.4, side=-9.8, back=-5)
h = Item('hair_bob', 'Bob', 'hair', [('Hair', '#1E1A22')], starter=True); hair(h, vol=1.4, fringe=lambda x: -11.8, side=-1.2, back=-.5, width=8)
h = Item('hair_long', 'Long', 'hair', [('Hair', '#8C4A2A')], starter=True); hair(h, vol=1.3, fringe=lambda x: -11.4 - 2.6 * max(0, 1 - abs(x) / 4.6), side=10, back=14, width=7.8)
h = Item('hair_pony', 'Ponytail', 'hair', [('Hair', '#6A3A24'), ('Tie', '#D9434B')], starter=True); hair(h, fringe=lambda x: -12.8 + (x + 5) * .12, side=-7, back=-4, tail=6)
h = Item('hair_bun', 'Bun', 'hair', [('Hair', '#B9BFC4')], price=320, shop='thrift'); hair(h, vol=.4, fringe=lambda x: -13.2 - 1.2 * max(0, 1 - abs(x - 1) / 3), side=-8, back=-5, bun=True)
h = Item('hair_curly', 'Curly', 'hair', [('Hair', '#2A1E1A')], starter=True); hair(h, vol=2.2, curls=True, width=8.6, fringe=lambda x: -12.2, side=-4, back=-2)
h = Item('hair_sidepart', 'Side part', 'hair', [('Hair', '#C46A3A')], price=280, shop='thrift'); hair(h, vol=1.2, fringe=lambda x: -9.6 - (x + 5.4) * .42, side=-6.5, back=-4)
h = Item('hair_twin', 'Twin tails', 'hair', [('Hair', '#D97AA8')], price=380, shop='sports'); hair(h, vol=1, fringe=lambda x: -11.8, side=-6, back=-4, twin=True)


# ================= FACE =================
# Faces are little pixel patterns on the head. Every face item also has expression variants (pieces tagged x=...),
# used in cutscenes, portraits and battles: blink, happy, surprised, sad, angry, talk.
INK = '#2A1E2E'
from core import ramp, to_hex
EYE = {  # left eye (outer edge on the left); the right eye is mirrored
 'round': ['.kkkk.', 'kkkkkk', 'kwwiik', 'kwiiIk', 'kiiIIk', 'kIIIIk', '.kkkk.'],
 'lashes': ['kkkkk.', 'kkkkkk', 'kwwiik', 'kwiiIk', 'kiiIIk', 'kIIIIk', '.kkkk.'],
 'wide': ['.kkkkk.', 'ksiiwsk', 'ksiiisk', 'ksIIIsk', '.kssss.'],
 'sleepy': ['kkkkkk', 'kkkkkk', 'kiiiIk', '.IIII.'],
 'sharp': ['....kk', '..kkkk', 'kkkwik', 'kiiiIk', '.kIIk.'],
}
EYE_X = {'blink': ['......', '......', 'kkkkkk', '......'], 'happy': ['......', '.kkkk.', 'k....k', '......'], 'surprised': ['.kkkk.', 'kssssk', 'ksIIsk', 'ksIIsk', 'kssssk', '.kkkk.'],
         'angry': ['kk....', 'kkkkk.', 'kkkkkk', 'kwiiIk', 'kiIIIk', '.kkkk.'], 'sad': ['....kk', '.kkkkk', 'kkkkkk', 'kwiiIk', 'kiIIIk', '.kkkk.']}
SIDE_EYE = {'round': ['.kk', 'kkk', 'kwi', 'kiI', 'kII', '.kk'], 'lashes': ['kk.', 'kkk', 'kwi', 'kiI', 'kII', '.kk'], 'wide': ['.kk', 'swi', 'siI', 'sII', '.kk'], 'sleepy': ['kkk', 'kkk', 'kiI', '.II'], 'sharp': ['..k', 'kkk', 'kwi', 'kII']}
SIDE_EYE_X = {'blink': ['...', '...', 'kkk'], 'happy': ['...', '.kk', 'k..'], 'surprised': ['.kk', 'sss', 'sIk', 'sIk', '.kk']}


def eyes(it, style):
    iris = it.col(0); P = {'k': (INK, 0), 'w': ('#FFFFFF', 0), 's': ('#F4F1EA', 0), 'i': (iris, 1), 'I': (to_hex(ramp(iris)[1]), 1)}
    for x in [None] + list(EYE_X):
        for v in ('front', 'side'):
            cv = canvas(v, 'head')
            if v == 'front':
                rows = EYE[style] if x is None else EYE_X[x]
                cv.pat(rows, -2.65, -8.2, P); cv.pat(rows, 2.65, -8.2, P, mirror=True)
            else:
                rows = SIDE_EYE[style] if x is None else SIDE_EYE_X.get(x)
                if rows is None: continue
                cv.pat(rows, 3.9, -8.2, P)
            it.add(v, 'head', cv, x=x)


for sid, nm in (('round', 'Round eyes'), ('wide', 'Wide eyes'), ('sleepy', 'Sleepy eyes'), ('sharp', 'Sharp eyes'), ('lashes', 'Lashes')):
    e = Item('eyes_' + sid, nm, 'eyes', [('Eyes', '#4A7BBB')], starter=True); eyes(e, sid)

BROW = {'soft': ['.hhhh.'], 'straight': ['hhhhhh'], 'thick': ['hhhhhh', '.hhhhh'], 'arched': ['.hhhh.', 'h....h'], 'stern': ['hhh...', '..hhhh']}
BROW_X = {'angry': ['hh....', '..hhhh'], 'sad': ['....hh', 'hhhh..'], 'surprised': None}


def brows(it, style):
    P = {'h': (it.col(0), 1)}
    for x in [None, 'angry', 'sad', 'surprised']:
        for v in ('front', 'side'):
            cv = canvas(v, 'head'); rows = BROW[style] if x in (None, 'surprised') else BROW_X[x]; y = -11.9 - (.9 if x == 'surprised' else 0)
            if v == 'front': cv.pat(rows, -2.7, y, P); cv.pat(rows, 2.7, y, P, mirror=True)
            else: cv.pat([r[:3] for r in rows], 3.9, y, P, mirror=True)
            it.add(v, 'head', cv, x=x)


for sid, nm in (('soft', 'Soft brows'), ('straight', 'Straight brows'), ('thick', 'Thick brows'), ('arched', 'Arched brows'), ('stern', 'Stern brows')):
    b = Item('brows_' + sid, nm, 'brows', [('Brows', '#3B2A22')], starter=True, link={'1': 'hair'}); brows(b, sid)

LIP = '#8E4A40'
MOUTH = {'smile': ['m....m', '.mmmm.'], 'neutral': ['.mmmm.'], 'grin': ['mmmmmm', 'mttttm', '.mmmm.'], 'smirk': ['.....m', 'mmmmm.'], 'open': ['.mm.', 'mOOm', '.mm.']}
MOUTH_X = {'talk': ['.mmmm.', 'mOOOOm', '.mmmm.'], 'happy': ['m....m', 'mttttm', '.mOOm.'], 'surprised': ['.mm.', 'mOOm', 'mOOm', '.mm.'], 'sad': ['.mmmm.', 'm....m'], 'angry': ['mmmmmm', 'mttttm', '.mmmm.']}
SIDE_MOUTH = {'smile': ['m.', '.m'], 'neutral': ['mm'], 'grin': ['mm', 'tm'], 'smirk': ['.m', 'm.'], 'open': ['mO', 'mO']}
SIDE_MOUTH_X = {'talk': ['mO', 'mO'], 'happy': ['m.', 'tm'], 'surprised': ['mO', 'mO', 'm.'], 'sad': ['.m', 'm.']}


def mouth(it, style):
    P = {'m': (it.col(0), 1), 't': ('#FBF7F0', 0), 'O': ('#5A2A2A', 0)}
    for x in [None] + list(MOUTH_X):
        for v in ('front', 'side'):
            cv = canvas(v, 'head')
            if v == 'front': cv.pat(MOUTH[style] if x is None else MOUTH_X[x], 0, -3.3, P)
            else:
                rows = SIDE_MOUTH[style] if x is None else SIDE_MOUTH_X.get(x)
                if rows is None: continue
                cv.pat(rows, 5.3, -3.3, P)
            it.add(v, 'head', cv, x=x)


for sid, nm in (('smile', 'Smile'), ('neutral', 'Neutral'), ('grin', 'Grin'), ('smirk', 'Smirk'), ('open', 'Surprised')):
    m = Item('mouth_' + sid, nm, 'mouth', [('Lips', LIP)], starter=True); mouth(m, sid)


def facial(it, style):
    for v in ('front', 'side'):
        cv = canvas(v, 'head'); head = shape(v, 'head', cv)
        if v == 'front':
            if style == 'stache': m = cv.poly_mask(smooth_poly([(-3, -4.6), (3, -4.6), (3.4, -3.2), (0, -4), (-3.4, -3.2)], 1))
            elif style == 'beard': m = head & cv.yband(-6.5, 3) & ~cv.ell_mask(0, -3.2, 2.2, 1.1) & ~cv.rect_mask(-4, -7, 4, -4.4)
            elif style == 'goatee': m = cv.poly_mask(smooth_poly([(-1.8, -2), (1.8, -2), (1.4, 1), (-1.4, 1)], 1)) | cv.rect_mask(-2.5, -5, 2.5, -4)
            elif style == 'stubble': m = None
        else:
            if style == 'stache': m = cv.poly_mask([(3.6, -4.6), (6.4, -4.6), (6, -3.4), (3.6, -3.8)])
            elif style == 'beard': m = head & cv.yband(-6.5, 3) & cv.xband(-1.5, 9) & ~cv.ell_mask(5.2, -3.2, 1.2, .8)
            elif style == 'goatee': m = cv.poly_mask([(3, -2.4), (5.6, -2.4), (4.6, .8), (3, .6)])
            elif style == 'stubble': m = None
        if m is not None: cv.paint(m, it.col(0), ch=1, soft=.8)
        else:
            sm = head & cv.yband(-6, 1) & ~(cv.ell_mask(0, -3.2, 2, 1) if v == 'front' else cv.ell_mask(5.2, -3.2, 1, .8))
            ys, xs = np.where(sm)
            for y, x in zip(ys, xs):
                if (x + y) % 2 == 0: cv.rgba[y, x, :3] = [90, 70, 60]; cv.rgba[y, x, 3] = 110; cv.ch[y, x] = 1
        it.add(v, 'head', cv)


for sid, nm, pr in (('stache', 'Moustache', 0), ('beard', 'Beard', 0), ('goatee', 'Goatee', 0), ('stubble', 'Stubble', 0)):
    f = Item('facial_' + sid, nm, 'facial', [('Hair', '#3B2A22')], starter=True, link={'1': 'hair'}); facial(f, sid)
f = Item('facial_freckles', 'Freckles', 'facial', [('Freckles', '#B86A4E')], starter=True)
for v in ('front', 'side'):
    cv = canvas(v, 'head'); pts = [(-3.6, -5.6), (-2.6, -5), (-4.4, -4.8), (3.6, -5.6), (2.6, -5), (4.4, -4.8)] if v == 'front' else [(2.6, -5.4), (3.6, -4.8), (1.8, -4.8)]
    cv.dots(pts, f.col(0), 1); f.add(v, 'head', cv)


# ================= HATS =================
def hat(it, kind_):
    A = it.col(0); B = it.col(1) if len(it.colors) > 1 else A
    for v in VIEWS:
        cv = canvas(v, 'head'); sx = -.6 if v == 'side' else 0
        if kind_ == 'cap':
            crown = cv.ell_mask(sx, -13.6, 7.5, 5.6) & cv.yband(-40, -10.8)
            cv.paint(crown, A, ch=1); cv.tint_line([(sx, -18.6), (sx, -11.5)], .86, only=grow_mask(crown, -1))
            if v == 'front': cv.paint(cv.ell_mask(0, -10.6, 6.6, 1.5), B, ch=2)
            elif v == 'side': cv.paint(cv.poly_mask(smooth_poly([(3, -12.2), (10.6, -11.6), (10.4, -10.4), (3, -10.6)], 1)), B, ch=2)
            else: cv.erase(cv.ell_mask(0, -11, 1.4, .9))
            cv.paint(cv.ell_mask(sx, -19, 1, .8), B, ch=2, outline=False, flat=True)
        elif kind_ == 'beanie':
            crown = cv.ell_mask(sx, -12.6, 7.7, 6.6) & cv.yband(-40, -10)
            cv.paint(crown, A, ch=1)
            for x in (-4, -1.5, 1, 3.5): cv.tint_line([(x + sx, -18), (x * 1.1 + sx, -12)], .86, only=grow_mask(crown, -1))
            cv.paint(crown & cv.yband(-12.4, -10), B, ch=2)
            cv.paint(cv.ell_mask(sx, -19.6, 1.8, 1.6), B, ch=2)
        elif kind_ == 'cowboy':
            cv.paint(cv.poly_mask(smooth_poly([(-4.8 + sx, -13), (-4.4 + sx, -20.6), (-1 + sx, -21.4), (0 + sx, -20.2), (1 + sx, -21.4), (4.4 + sx, -20.6), (4.8 + sx, -13)], 1)), A, ch=1)
            cv.paint(cv.rect_mask(-4.8 + sx, -15.2, 4.8 + sx, -13.6), B, ch=2, outline=False, flat=True)
            cv.paint(cv.ell_mask(sx, -13, 11 if v != 'side' else 10.4, 1.9 if v != 'side' else 1.4), A, ch=1)
        elif kind_ == 'hardhat':
            d = cv.ell_mask(sx, -13.8, 7.9, 5.9) & cv.yband(-40, -11.4); cv.paint(d, A, ch=1)
            cv.tint_line([(sx, -19.4), (sx, -12)], 1.18, only=grow_mask(d, -1))
            cv.paint(cv.ell_mask(sx + (1.2 if v == 'side' else 0), -11.4, 8.8 if v != 'side' else 8.6, 1.3), A, ch=1)
        elif kind_ == 'tophat':
            cv.paint(cv.rect_mask(-4.6 + sx, -26, 4.6 + sx, -14), A, ch=1)
            cv.paint(cv.rect_mask(-4.6 + sx, -16.4, 4.6 + sx, -14.6), B, ch=2, outline=False, flat=True)
            cv.paint(cv.ell_mask(sx, -14, 8.2, 1.5), A, ch=1)
        elif kind_ == 'chef':
            m = cv.rect_mask(-5.6 + sx, -16.2, 5.6 + sx, -12.6) | cv.ell_mask(-3 + sx, -19.6, 3.6, 3.4) | cv.ell_mask(3 + sx, -19.6, 3.6, 3.4) | cv.ell_mask(sx, -22, 4, 3.4)
            cv.paint(m, A, ch=1)
        elif kind_ == 'crown':
            m = cv.poly_mask([(-5.6 + sx, -14.6), (5.6 + sx, -14.6), (5.8 + sx, -21), (3.4 + sx, -17.6), (1.6 + sx, -22), (0 + sx, -18), (-1.6 + sx, -22), (-3.4 + sx, -17.6), (-5.8 + sx, -21)])
            cv.paint(m, A, ch=1); cv.dots([(sx, -16.2)] if v != 'back' else [(sx - 3, -16.2), (sx + 3, -16.2)], B, 2); cv.dots([(sx - 3.4, -16.4), (sx + 3.4, -16.4)] if v == 'front' else [], '#5DB4E0')
        elif kind_ == 'bucket':
            cv.paint(cv.ell_mask(sx, -14, 6.4, 5) & cv.yband(-40, -12), A, ch=1)
            cv.paint(cv.poly_mask(smooth_poly([(-6.6 + sx, -13), (6.6 + sx, -13), (8.8 + sx, -9.6), (-8.8 + sx, -9.6)], 1)), A, ch=1)
            cv.paint(cv.rect_mask(-6.4 + sx, -13.8, 6.4 + sx, -12.6), B, ch=2, outline=False, flat=True)
        it.add(v, 'head', cv)


for args in (('cap', 'Baseball cap', [('Cap', '#2F6FB8'), ('Brim', '#24518A')], 240, 'sports', True), ('beanie', 'Beanie', [('Beanie', '#2A9D8F'), ('Fold', '#1D6F66')], 220, 'thrift', False),
             ('cowboy', 'Cowboy hat', [('Hat', '#8A5A30'), ('Band', '#3E2414')], 780, 'thrift', False), ('hardhat', 'Hard hat', [('Hat', '#F4C542')], 300, 'thrift', False),
             ('tophat', 'Top hat', [('Hat', '#1E1A22'), ('Band', '#8E2A3A')], 2600, 'designer', False), ('chef', 'Chef hat', [('Hat', '#F6F4EE')], 400, 'thrift', False),
             ('crown', 'Crown', [('Gold', '#F2C14E'), ('Jewel', '#D9434B')], 9800, 'designer', False), ('bucket', 'Bucket hat', [('Hat', '#C9B98A'), ('Band', '#7C6A44')], 360, 'sports', False)):
    k, nm, cols, pr, shop, st = args
    hh = Item('hat_' + k, nm, 'hat', cols, price=0 if st else pr, shop=None if st else shop, starter=st); hat(hh, k)


# ================= GLASSES & HEADSET =================
def glasses(it, kind_):
    A = it.col(0); B = it.col(1) if len(it.colors) > 1 else None
    for v in ('front', 'side', 'back'):
        cv = canvas(v, 'head')
        if v == 'back':
            if kind_ == 'headset': cv.paint(cv.ell_mask(0, -12, 7.6, 7.4) & ~cv.ell_mask(0, -12, 6.6, 6.4) & cv.yband(-40, -12), A, ch=1, outline=False, flat=True); cv.paint(cv.ell_mask(-7.2, -8, 1.6, 2.2) | cv.ell_mask(7.2, -8, 1.6, 2.2), A, ch=1)
            it.add(v, 'head', cv); continue
        xs = (-2.7, 2.7) if v == 'front' else (3.8,)
        if kind_ in ('round', 'square', 'sun'):
            for cx in xs:
                if kind_ == 'square': ring = cv.rect_mask(cx - 2, -10, cx + 2, -6.4); inner = cv.rect_mask(cx - 1, -9, cx + 1, -7.4)
                else: ring = cv.ell_mask(cx, -8.1, 2.9, 2.6); inner = cv.ell_mask(cx, -8.1, 2.3, 2.05)
                if v == 'side': ring &= cv.xband(cx - 1.2, 9); inner &= cv.xband(cx - 1.2, 9)
                cv.paint(ring & ~inner, A, ch=1, outline=False, flat=True)
                if kind_ == 'sun': cv.paint(inner, B, ch=2, outline=False, flat=True); cv.dots([(cx - .5, -8.6)], '#9FB8D8')
                elif v == 'front': cv.dots([(cx + 1.2, -9.4)], '#F4FAFF')
            if v == 'front': cv.dots([(-.5, -8.4), (.5, -8.4)], A, 1)
            else: cv.line([(2.4, -8.4), (-1, -8.8)], A, 1)
        elif kind_ == 'monocle':
            cx = xs[-1]; ring = cv.ell_mask(cx, -8.1, 2.2, 2) & ~cv.ell_mask(cx, -8.1, 1.2, 1.1)
            cv.paint(ring, A, ch=1, outline=False, flat=True); cv.line([(cx + 2, -7), (cx + 3.4, -4), (cx + 3, 0)], A, 1)
        elif kind_ == 'headset':
            if v == 'front':
                cv.paint(cv.ell_mask(0, -12, 7.8, 7.4) & ~cv.ell_mask(0, -12, 6.8, 6.4) & cv.yband(-40, -12), A, ch=1, outline=False, flat=True)
                cv.paint(cv.ell_mask(-7.1, -8, 1.6, 2.3) | cv.ell_mask(7.1, -8, 1.6, 2.3), A, ch=1)
                cv.line([(7.4, -6), (5.6, -3.6), (2.4, -3.2)], B or A, 2)
            else:
                cv.paint(cv.ell_mask(-1.2, -8, 2, 2.6), A, ch=1); cv.line([(-1.2, -10.6), (-.4, -17.6)], A, 1); cv.line([(0, -6), (3, -3.6), (5, -3.2)], B or A, 2)
        it.add(v, 'head', cv)


for k, nm, cols, pr, shop, st in (('round', 'Round glasses', [('Frames', '#3A2E2A')], 0, None, True), ('square', 'Square glasses', [('Frames', '#22242E')], 0, None, True),
                                  ('sun', 'Sunglasses', [('Frames', '#1E1A22'), ('Lenses', '#2A3550')], 450, 'sports', False), ('monocle', 'Monocle', [('Gold', '#E2B13C')], 3200, 'designer', False),
                                  ('headset', 'Headset', [('Headset', '#2A2E3A'), ('Mic', '#7A808C')], 520, 'sports', False)):
    g = Item('glasses_' + k if k != 'headset' else 'headset', nm, 'glasses', cols, price=pr, shop=shop, starter=st); glasses(g, k)


# ================= NECK =================
n = Item('tie', 'Tie', 'neck', [('Tie', '#C8323C')], price=420, shop='designer')
for v in ('front', 'side'):
    cv = canvas(v, 'torso')
    if v == 'front': cv.paint(cv.poly_mask([(-1.1, -20.6), (1.1, -20.6), (.8, -19.2), (1.4, -10), (0, -8.2), (-1.4, -10), (-.8, -19.2)]), n.col(0), ch=1, soft=.7)
    else: cv.paint(cv.poly_mask([(3.6, -20), (5, -20), (5.6, -10), (4.6, -9), (4, -10)]), n.col(0), ch=1, soft=.7)
    n.add(v, 'torso', cv, z=21.6)
n = Item('bowtie', 'Bow tie', 'neck', [('Bow', '#2A2E5A')], price=380, shop='designer')
cv = canvas('front', 'torso'); cv.paint(cv.poly_mask([(-3, -21.6), (0, -20.4), (3, -21.6), (3, -18.8), (0, -20), (-3, -18.8)]), n.col(0), ch=1, soft=.6); n.add('front', 'torso', cv, z=21.6)
cv = canvas('side', 'torso'); cv.paint(cv.ell_mask(4.2, -20.2, 1.2, 1.4), n.col(0), ch=1); n.add('side', 'torso', cv, z=21.6)
n = Item('scarf', 'Scarf', 'neck', [('Scarf', '#D9434B'), ('Stripes', '#F4F1EA')], price=300, shop='thrift')
for v in VIEWS:
    cv = canvas(v, 'torso'); ring = cv.ell_mask(.8 if v == 'side' else 0, -20.6, 5.4 if v != 'side' else 4.4, 2.2)
    cv.paint(ring, n.col(0), ch=1)
    if v == 'front': cv.paint(cv.rect_mask(1.5, -20, 4, -11), n.col(0), ch=1); cv.paint(cv.rect_mask(1.5, -13.4, 4, -12.2), n.col(1), ch=2, outline=False, flat=True)
    if v == 'back': cv.paint(cv.rect_mask(-4, -20, -1.5, -13), n.col(0), ch=1)
    n.add(v, 'torso', cv, z=21.7)
n = Item('chain', 'Gold chain', 'neck', [('Gold', '#F2C14E')], price=5200, shop='designer')
cv = canvas('front', 'torso'); cv.dots([(-3.5, -21), (-3, -20), (-2.4, -19), (-1.5, -18.2), (-.5, -17.8), (.5, -17.8), (1.5, -18.2), (2.4, -19), (3, -20), (3.5, -21)], n.col(0), 1)
cv.paint(cv.ell_mask(0, -16.4, 1.6, 1.6), n.col(0), ch=1); n.add('front', 'torso', cv, z=21.7)
cv = canvas('side', 'torso'); cv.dots([(3.4, -20.4), (4, -19.2), (4.5, -18)], n.col(0), 1); n.add('side', 'torso', cv, z=21.7)
n = Item('nametag', 'Name tag', 'neck', [('Tag', '#F4F1EA'), ('Stripe', '#D9434B')], price=60, shop='thrift')
cv = canvas('front', 'torso'); cv.paint(cv.rect_mask(-6, -16, -2, -13), n.col(0), ch=1, soft=.5); cv.paint(cv.rect_mask(-5, -15, -3, -14.2), n.col(1), ch=2, outline=False, flat=True); n.add('front', 'torso', cv, z=21.7)


# ================= BAGS =================
bp = Item('backpack', 'Backpack', 'bag', [('Pack', '#D49C46'), ('Straps', '#8A5A2A')], starter=True)
for v in VIEWS:
    cv = canvas(v, 'torso')
    if v == 'front':
        cv.paint(cv.rect_mask(-5.6, -21, -3.8, -8) | cv.rect_mask(3.8, -21, 5.6, -8), bp.col(1), ch=2, soft=.6)
        bp.add(v, 'torso', cv, z=21.75)
    elif v == 'back':
        m = cv.rect_mask(-6, -20, 6, -4.5) | cv.rect_mask(-5, -21, 5, -3.5); cv.paint(m, bp.col(0), ch=1)
        cv.paint(cv.rect_mask(-6, -20, 6, -15), bp.col(0), ch=1, light=np.array([-.4, -.8, .5]))
        pk = cv.rect_mask(-4, -11, 4, -5.5) | cv.rect_mask(-3, -12, 3, -5); cv.paint(pk, bp.col(0), ch=1)
        cv.dots([(0, -15.6)], bp.col(1), 2); cv.paint(cv.rect_mask(-5.6, -22, -3.8, -19.5) | cv.rect_mask(3.8, -22, 5.6, -19.5), bp.col(1), ch=2, soft=.6)
        bp.add(v, 'torso', cv, z=21.75)
    else:
        m = cv.poly_mask(smooth_poly([(-9.6, -20), (-4.2, -20.4), (-4.2, -5), (-9.8, -5.5)], 2)); cv.paint(m, bp.col(0), ch=1)
        cv.paint(cv.rect_mask(-4.6, -20.4, -3.2, -6), bp.col(1), ch=2, soft=.6)
        cv.line([(2.6, -20), (3.8, -14), (2.6, -9)], bp.col(1), 2)
        bp.add(v, 'torso', cv, z=21.75)
sa = Item('satchel', 'Satchel', 'bag', [('Bag', '#8A5A34'), ('Strap', '#5A3A20')], price=640, shop='thrift')
for v in VIEWS:
    cv = canvas(v, 'torso')
    if v in ('front', 'back'):
        a, b = ((-6.5, -20.5), (6, -1)) if v == 'front' else ((6.5, -20.5), (-6, -1)); cv.line([a, (a[0] + (b[0] - a[0]) * .5, (a[1] + b[1]) / 2), b], sa.col(1), 2)
        cv.line([(a[0] + .8, a[1]), (b[0] + .8, b[1])], sa.col(1), 2)
    else: cv.line([(-3.5, -20), (4.4, -6)], sa.col(1), 2)
    sa.add(v, 'torso', cv, z=21.75)
    pv = canvas(v, 'pelvis'); x = 7.6 if v == 'front' else -7.6 if v == 'back' else 3.4
    pv.paint(pv.poly_mask(smooth_poly([(x - 3, -2), (x + 3, -2), (x + 3.2, 5), (x - 3.2, 5)], 1)), sa.col(0), ch=1); pv.tint_line([(x - 3, 0), (x + 3, 0)], .78)
    sa.add(v, 'pelvis', pv, z=26)
fp = Item('fannypack', 'Fanny pack', 'bag', [('Pack', '#3FB0C8'), ('Strap', '#1E1A22')], price=280, shop='sports')
for v in VIEWS:
    pv = canvas(v, 'pelvis'); band = shape(v, 'pelvis', pv, 1) & pv.yband(-1.8, -.4); pv.paint(band, fp.col(1), ch=2, outline=False, flat=True)
    if v != 'back': pv.paint(pv.ell_mask(0 if v == 'front' else 4.6, .2, 4.2 if v == 'front' else 2.2, 2.4), fp.col(0), ch=1)
    fp.add(v, 'pelvis', pv, z=21.9)
