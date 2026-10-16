"""Every wardrobe item, drawn to fit the body in all three views.
An item is pieces on bones; each piece is cel-shaded in the item's default colours with colour areas
(channel 1-3) the game recolours."""
import numpy as np
from core import capsule, smooth_poly, grow_mask
from body import SKEL, canvas, shape, kind, VIEWS

ITEMS = []


class Item:
    def __init__(self, id, name, slot, colors, price=0, shop=None, starter=False, link=None, tags=()):
        self.id, self.name, self.slot, self.colors, self.price, self.shop, self.starter = id, name, slot, colors, price, shop, starter
        self.link = link or {}; self.tags = list(tags); self.pieces = []
        ITEMS.append(self)

    def add(self, view, bone, cv, z=None, x=None):
        if cv is not None and cv.opaque().any(): self.pieces.append((view, bone, cv, z, x))
        return cv

    def col(self, i):
        return self.colors[i][1]


def bones_of(view, k):
    return [n for n, p, at, z, c in SKEL[view] if kind(n) == k]


def limb_sides(view):
    return ('L', 'R') if view != 'side' else ('N', 'F')


# ================= TOPS =================
def top(it, sleeve='short', neck='crew', length='waist', g=1, c1=0, c2=None, collar=False, hood=False, buttons=False, stripe=False, zip_=False, rib=False, logo=False, pocket=False):
    A, B = it.col(c1), (it.col(c2) if c2 is not None else None)
    for v in VIEWS:
        # torso
        cv = canvas(v, 'torso'); m = shape(v, 'torso', cv, g)
        if sleeve == 'none':  # tank: narrow shoulders
            if v != 'side': m &= ~(cv.yband(-30, -16.5) & ~cv.xband(-5.6, 5.6))
        if v == 'front':
            if neck == 'crew': m &= ~cv.ell_mask(0, -21, 2.8, 1.8)
            elif neck == 'v': m &= ~cv.poly_mask([(-3, -22), (3, -22), (0, -15.5)])
            elif neck == 'scoop': m &= ~cv.ell_mask(0, -21, 4.2, 3.2)
            elif neck == 'collar': m &= ~cv.poly_mask([(-2, -22), (2, -22), (0, -17.5)])
        elif v == 'back':
            if neck != 'turtle': m &= ~cv.ell_mask(0, -21.2, 2.6, 1.2)
        else:
            m &= ~cv.ell_mask(2.2, -21.4, 2.2, 1.6) if neck not in ('turtle', 'collar') else ~cv.ell_mask(3, -21.6, 1.2, 1)
        cv.paint(m, A, ch=1 + c1, open_bottom=None)
        if stripe and B:
            for y in (-14, -10, -6, -2):
                cv.paint(m & cv.yband(y, y + 1.4) & grow_mask(m, -1), B, ch=2, outline=False, flat=True)
        if rib: cv.tint_line([(-7, 0.2), (7, 0.2)], .82, only=m); cv.tint_line([(-7, -1), (7, -1)], .9, only=m)
        else: cv.tint_line([(-7.5, 0.5), (7.5, 0.5)], .86, only=m)
        if v == 'front':
            if buttons: cv.dots([(0, -16), (0, -12), (0, -8), (0, -4)], '#E9E4DA', 0)
            if zip_: cv.tint_line([(0, -20), (0, 1)], .72, only=m)
            if logo and B: cv.paint(cv.ell_mask(-3, -13, 1.6, 1.4), B, ch=2, outline=False, flat=True)
            if pocket: cv.tint_line([(-4, -4), (4, -4), (4.5, 0)], .8, only=m); cv.tint_line([(-4, -4), (-4.5, 0)], .8, only=m)
            if collar:
                cv.paint(cv.poly_mask([(-3.6, -21.6), (-.4, -21.6), (-.6, -17.8)]) | cv.poly_mask([(3.6, -21.6), (.4, -21.6), (.6, -17.8)]), B or A, ch=2 if B else 1)
        if hood and v == 'front':
            ring = cv.ell_mask(0, -21.2, 6.2, 2.9) & ~cv.ell_mask(0, -21.8, 2.9, 1.9)
            cv.paint(ring, A, ch=1 + c1)
            cv.line([(-1.6, -19.4), (-1.8, -15)], it.col(1) if len(it.colors) > 1 else '#EDE7DC', ch=2); cv.line([(1.6, -19.4), (1.8, -15)], it.col(1) if len(it.colors) > 1 else '#EDE7DC', ch=2)
        it.add(v, 'torso', cv)
        if hood and v in ('back', 'side'):
            hv = canvas(v, 'torso')
            hm = hv.poly_mask(smooth_poly([(-6, -24), (6, -24), (6.5, -18), (0, -15.5), (-6.5, -18)], 2)) if v == 'back' else hv.poly_mask(smooth_poly([(-6.5, -24.5), (-1, -24), (-.5, -19), (-4, -16), (-7, -19)], 2))
            hv.paint(hm, A, ch=1 + c1); hv.tint_line([(-3, -21), (0, -19.5), (3, -21)] if v == 'back' else [(-5, -21), (-2, -19)], .8, only=hm)
            it.add(v, 'torso', hv, z=20.8)
        # chest (fits any bust size)
        cc = canvas(v, 'chest'); cm = shape(v, 'chest', cc, 1)
        if v != 'back': cc.paint(cm, A, ch=1 + c1); it.add(v, 'chest', cc)
        # hem below the waist
        if length in ('hip', 'tunic'):
            pv = canvas(v, 'pelvis'); pm = shape(v, 'pelvis', pv, g) & pv.yband(-3, 3 if length == 'hip' else 7.5)
            pv.paint(pm, A, ch=1 + c1); pv.tint_line([(-8, 2.4 if length == 'hip' else 6.8), (8, 2.4 if length == 'hip' else 6.8)], .84, only=pm)
            it.add(v, 'pelvis', pv)
        # sleeves
        if sleeve != 'none':
            for s in limb_sides(v):
                u = canvas(v, 'armU' + s); um = shape(v, 'armU' + s, u, g)
                if sleeve == 'short': um &= u.yband(-9, 5.5)
                if sleeve == 'mid': um &= u.yband(-9, 9.5)
                u.paint(um, A, ch=1 + c1, open_top=-1.2)
                if sleeve in ('short', 'mid'): u.tint_line([(-4, 5.0 if sleeve == 'short' else 9), (4, 5.0 if sleeve == 'short' else 9)], .84, only=um)
                if stripe and B and sleeve == 'long': pass
                it.add(v, 'armU' + s, u)
                if sleeve == 'long':
                    l = canvas(v, 'armL' + s); lm = shape(v, 'armL' + s, l, g) & l.yband(-9, 8.3)
                    l.paint(lm, A, ch=1 + c1, open_top=1.2); l.tint_line([(-4, 7.6), (4, 7.6)], .8 if not rib else .72, only=lm)
                    it.add(v, 'armL' + s, l)


t = Item('tee', 'T-shirt', 'top', [('Shirt', '#3E8FB0')], price=0, starter=True, tags=['basics']); top(t)
t = Item('tee_stripe', 'Striped tee', 'top', [('Shirt', '#F2EEE4'), ('Stripes', '#2E4E8C')], price=420, shop='thrift'); top(t, c2=1, stripe=True)
t = Item('tank', 'Tank top', 'top', [('Top', '#E8E2D4')], price=180, shop='sports'); top(t, sleeve='none', neck='scoop')
t = Item('longsleeve', 'Long-sleeve shirt', 'top', [('Shirt', '#C9584A')], starter=True); top(t, sleeve='long')
t = Item('hoodie', 'Hoodie', 'top', [('Hoodie', '#6F5BA8'), ('Strings', '#EDE7DC')], price=650, shop='sports'); top(t, sleeve='long', length='hip', hood=True, pocket=True, g=1)
t = Item('sweater', 'Knit sweater', 'top', [('Knit', '#D9A441')], price=520, shop='thrift'); top(t, sleeve='long', length='hip', neck='turtle', rib=True)
t = Item('polo', 'Polo shirt', 'top', [('Shirt', '#3F8A63'), ('Collar', '#F2EEE4')], price=380, shop='sports'); top(t, neck='collar', collar=True, c2=1, buttons=False)
t = Item('dress_shirt', 'Dress shirt', 'top', [('Shirt', '#F1F2F4'), ('Collar', '#F1F2F4')], price=900, shop='designer'); top(t, sleeve='long', neck='collar', collar=True, c2=1, buttons=True)
t = Item('jersey', 'Sports jersey', 'top', [('Jersey', '#D13B3B'), ('Number', '#F4F1EA')], price=560, shop='sports'); top(t, neck='v', c2=1, logo=True, sleeve='short')
t = Item('track_top', 'Track jacket', 'top', [('Jacket', '#2A4E8F'), ('Stripes', '#F4F1EA')], price=720, shop='sports'); top(t, sleeve='long', neck='turtle', zip_=True, length='hip', c2=1)
t = Item('tunic', 'Tunic', 'top', [('Tunic', '#7DB6A0')], price=480, shop='thrift'); top(t, sleeve='mid', neck='v', length='tunic')
t = Item('crop', 'Crop top', 'top', [('Top', '#E07AA4')], price=300, shop='thrift')
for v in VIEWS:
    cv = canvas(v, 'torso'); m = shape(v, 'torso', cv, 1) & cv.yband(-30, -8)
    m &= ~cv.ell_mask(0, -21, 3.4, 2.2) if v == 'front' else ~cv.ell_mask(0, -21.2, 2.6, 1.2) if v == 'back' else ~cv.ell_mask(2.2, -21.4, 2.2, 1.6)
    cv.paint(m, t.col(0), ch=1); t.add(v, 'torso', cv)
    cc = canvas(v, 'chest')
    if v != 'back': cc.paint(shape(v, 'chest', cc, 1), t.col(0), ch=1); t.add(v, 'chest', cc)
    for s in limb_sides(v):
        u = canvas(v, 'armU' + s); um = shape(v, 'armU' + s, u, 1) & u.yband(-9, 4.5); u.paint(um, t.col(0), ch=1); t.add(v, 'armU' + s, u)


# ================= OUTERWEAR =================
def outer(it, length=4, lapels=False, quilt=False, open_=True, c1=0, c2=None, pockets=False, sleeves=True, belt=False):
    A = it.col(c1); B = it.col(c2) if c2 is not None else A
    for v in VIEWS:
        cv = canvas(v, 'torso'); m = shape(v, 'torso', cv, 2) & cv.yband(-23.5, 9)
        if v == 'front':
            if open_: m &= ~cv.poly_mask([(-2.4, -23), (2.4, -23), (1.6, 3), (-1.6, 3)])
            m &= ~cv.ell_mask(0, -21.5, 3, 2)
        elif v == 'back': m &= ~cv.ell_mask(0, -21.6, 2.8, 1.4)
        else: m &= ~cv.ell_mask(2.4, -21.6, 2.2, 1.5)
        cv.paint(m, A, ch=1)
        if quilt:
            for y in (-16, -11, -6, -1): cv.tint_line([(-9, y), (9, y)], .8, only=m)
        if v == 'front':
            if lapels:
                cv.paint(cv.poly_mask([(-4.2, -21.6), (-1.6, -21.6), (-1.6, -11), (-4.4, -16)]), B, ch=2)
                cv.paint(cv.poly_mask([(4.2, -21.6), (1.6, -21.6), (1.6, -11), (4.4, -16)]), B, ch=2)
            if pockets: cv.tint_line([(-6.5, -3), (-3, -3)], .78, only=m); cv.tint_line([(3, -3), (6.5, -3)], .78, only=m)
            if not open_: cv.tint_line([(0, -20), (0, 1)], .74, only=m)
            if belt: cv.paint(m & cv.yband(-4, -2.5), B, ch=2, outline=False, flat=True)
        it.add(v, 'torso', cv)
        cc = canvas(v, 'chest')
        if v == 'side': cc.paint(shape(v, 'chest', cc, 2), A, ch=1); it.add(v, 'chest', cc)
        if v == 'front':
            cm = shape(v, 'chest', cc, 2) & ~cc.xband(-2.4, 2.4) if open_ else shape(v, 'chest', cc, 2)
            cc.paint(cm, A, ch=1); it.add(v, 'chest', cc)
        if length > 0:
            pv = canvas(v, 'pelvis')
            if v == 'front':
                pm = pv.poly_mask(smooth_poly([(-7.8, -2), (-1.6, -2), (-1.6 - length * .1, length), (-8.6 - length * .18, length)], 1)) | pv.poly_mask(smooth_poly([(7.8, -2), (1.6, -2), (1.6 + length * .1, length), (8.6 + length * .18, length)], 1)) if open_ else \
                    pv.poly_mask(smooth_poly([(-7.8, -2), (7.8, -2), (8.6 + length * .18, length), (-8.6 - length * .18, length)], 1))
            elif v == 'back': pm = pv.poly_mask(smooth_poly([(-7.8, -2), (7.8, -2), (8.6 + length * .18, length), (-8.6 - length * .18, length)], 1));
            else: pm = pv.poly_mask(smooth_poly([(-5.6, -2), (5, -2), (5.6 + length * .12, length), (-6.6 - length * .2, length)], 1))
            pv.paint(pm, A, ch=1)
            if v == 'back' and length > 6: pv.tint_line([(0, 3), (0, length - .5)], .8, only=pm)
            it.add(v, 'pelvis', pv, z=15.5 if length > 6 else None)
        if sleeves:
            for s in limb_sides(v):
                u = canvas(v, 'armU' + s); um = shape(v, 'armU' + s, u, 2) & u.yband(-9, 99); u.paint(um, A, ch=1, open_top=-1.2)
                if quilt: u.tint_line([(-4, 5), (4, 5)], .8, only=um)
                it.add(v, 'armU' + s, u)
                l = canvas(v, 'armL' + s); lm = shape(v, 'armL' + s, l, 2) & l.yband(-9, 8.6); l.paint(lm, A, ch=1, open_top=1.2); l.tint_line([(-4, 7.8), (4, 7.8)], .8, only=lm); it.add(v, 'armL' + s, l)


o = Item('labcoat', 'Lab coat', 'outer', [('Coat', '#F2F4F3')], price=1100, shop='designer'); outer(o, length=13, pockets=True)
o = Item('blazer', 'Blazer', 'outer', [('Blazer', '#2E3A6A'), ('Lapels', '#24305A')], price=1800, shop='designer'); outer(o, length=4, lapels=True, c2=1, pockets=True)
o = Item('puffer', 'Puffer jacket', 'outer', [('Jacket', '#E0703A')], price=1300, shop='sports'); outer(o, length=2, quilt=True, open_=False)
o = Item('trench', 'Trench coat', 'outer', [('Coat', '#B48A58'), ('Belt', '#7A5A34')], price=2400, shop='designer'); outer(o, length=15, lapels=True, c2=1, belt=True)
o = Item('denim_jacket', 'Denim jacket', 'outer', [('Denim', '#4D6E9C')], price=760, shop='thrift'); outer(o, length=1, pockets=True)
o = Item('apron', 'Apron', 'outer', [('Apron', '#3E8A6E'), ('Straps', '#2A6450')], price=240, shop='thrift')
for v in VIEWS:
    cv = canvas(v, 'torso')
    if v == 'front':
        m = cv.poly_mask(smooth_poly([(-5, -17), (5, -17), (6.5, 2), (-6.5, 2)], 1)); cv.paint(m, o.col(0), ch=1)
        cv.paint(cv.poly_mask([(-5, -17), (-4, -17), (-6.2, -21.4), (-7.2, -21.4)]) | cv.poly_mask([(5, -17), (4, -17), (6.2, -21.4), (7.2, -21.4)]), o.col(1), ch=2, outline=False, flat=True)
        cv.tint_line([(-3, -10), (3, -10)], .82, only=m)
    elif v == 'back':
        m = cv.rect_mask(-6.5, -6, 6.5, -4.5); cv.paint(m, o.col(1), ch=2, outline=False, flat=True)
        cv.paint(cv.ell_mask(0, -5.2, 1.6, 1.4), o.col(1), ch=2)
    else:
        m = cv.poly_mask([(3.4, -17), (5.6, -17), (6, 2), (3.8, 2)]); cv.paint(m, o.col(0), ch=1)
        cv.paint(cv.rect_mask(-5, -6, 4, -4.6), o.col(1), ch=2, outline=False, flat=True)
    o.add(v, 'torso', cv)
    pv = canvas(v, 'pelvis')
    if v == 'front': pm = pv.poly_mask(smooth_poly([(-6.5, -2), (6.5, -2), (7.4, 13), (-7.4, 13)], 1)); pv.paint(pm, o.col(0), ch=1); pv.tint_line([(-4, 3), (-1, 3)], .8, only=pm); o.add(v, 'pelvis', pv, z=15.5)
    elif v == 'side': pm = pv.poly_mask([(3, -2), (5.6, -2), (6.6, 13), (4, 13)]); pv.paint(pm, o.col(0), ch=1); o.add(v, 'pelvis', pv, z=15.5)


# ================= BOTTOMS =================
def bottoms(it, kind_='pants', g=1, c1=0, c2=None, cuffs=False, seam=True, pockets=False, belt=False, crease=False, cargo=False):
    A = it.col(c1)
    for v in VIEWS:
        pv = canvas(v, 'pelvis')
        if kind_ == 'skirt':
            pm = pv.poly_mask(smooth_poly([(-7, -2), (7, -2), (9.2, 11), (-9.2, 11)], 1)) if v != 'side' else pv.poly_mask(smooth_poly([(-5.6, -2), (4.8, -2), (6.8, 11), (-7.4, 11)], 1))
            pv.paint(pm, A, ch=1)
            for x in (-4, 0, 4) if v != 'side' else (-2, 2): pv.tint_line([(x * .8, 2), (x * 1.2, 10.6)], .84, only=pm)
            pv.tint_line([(-8, -.6), (8, -.6)], .82, only=pm); it.add(v, 'pelvis', pv, z=15)
            continue
        pm = shape(v, 'pelvis', pv, g) & pv.yband(-2, 99)
        pv.paint(pm, A, ch=1)
        pv.tint_line([(-8, -.4), (8, -.4)], .84, only=pm)
        if belt and it.colors[1:]:
            pv.paint(pm & pv.yband(-2, -.5), it.col(1), ch=2, outline=False, flat=True)
        if v == 'front' and seam: pv.tint_line([(0, -.5), (0, 5.5)], .82, only=pm)
        if v == 'front' and pockets: pv.tint_line([(-5.8, -.5), (-3.6, 2.6)], .8, only=pm); pv.tint_line([(5.8, -.5), (3.6, 2.6)], .8, only=pm)
        if v == 'back' and pockets: pv.tint_line([(-5, 1.5), (-2, 1.5), (-2, 4)], .82, only=pm); pv.tint_line([(5, 1.5), (2, 1.5), (2, 4)], .82, only=pm)
        it.add(v, 'pelvis', pv)
        for s in limb_sides(v):
            th = canvas(v, 'thigh' + s); tm = shape(v, 'thigh' + s, th, g)
            if kind_ == 'shorts': tm &= th.yband(-9, 8.5)
            if kind_ == 'bermuda': tm &= th.yband(-9, 12.5)
            th.paint(tm, A, ch=1, open_top=1.5)
            if kind_ in ('shorts', 'bermuda'): th.tint_line([(-5, 7.8 if kind_ == 'shorts' else 11.9), (5, 7.8 if kind_ == 'shorts' else 11.9)], .82, only=tm)
            if crease and v != 'side': th.tint_line([(0, 1), (0, 13.5)], .9, only=tm)
            if cargo and v != 'back': th.paint(th.rect_mask(-3.5 if v == 'side' else (1 if s == 'R' else -4), 6, 3.5 if v == 'side' else (4 if s == 'R' else -1), 10), A, ch=1)
            it.add(v, 'thigh' + s, th)
            if kind_ in ('pants', 'tights'):
                sh = canvas(v, 'shin' + s); sm = shape(v, 'shin' + s, sh, g) & sh.yband(-9, 13.1 if kind_ == 'pants' else 11.6)
                sh.paint(sm, A, ch=1, open_top=1.5)
                if cuffs: sh.paint(sm & sh.yband(11.2, 13.1), A, ch=1, outline=False, light=np.array([-.3, -.3, .9]))
                if crease and v != 'side': sh.tint_line([(0, 0), (0, 11.8)], .9, only=sm)
                it.add(v, 'shin' + s, sh)


b = Item('jeans', 'Jeans', 'bottom', [('Denim', '#3F5F94')], starter=True); bottoms(b, cuffs=True, pockets=True)
b = Item('chinos', 'Chinos', 'bottom', [('Chinos', '#C2A574')], price=380, shop='thrift'); bottoms(b, pockets=True)
b = Item('shorts', 'Shorts', 'bottom', [('Shorts', '#5F7F4E')], starter=True); bottoms(b, kind_='shorts', pockets=True)
b = Item('cargo', 'Cargo shorts', 'bottom', [('Cargo', '#7C7058')], price=340, shop='thrift'); bottoms(b, kind_='bermuda', cargo=True, pockets=True)
b = Item('skirt', 'Skirt', 'bottom', [('Skirt', '#8B4F9E')], starter=True); bottoms(b, kind_='skirt')
b = Item('trousers', 'Suit trousers', 'bottom', [('Trousers', '#2E3346'), ('Belt', '#1E1A22')], price=1100, shop='designer'); bottoms(b, crease=True, belt=True)
b = Item('track_pants', 'Track pants', 'bottom', [('Pants', '#2A2F3E')], price=420, shop='sports'); bottoms(b, seam=False, cuffs=True)
b = Item('leggings', 'Leggings', 'bottom', [('Leggings', '#2B2B38')], price=300, shop='sports'); bottoms(b, kind_='tights', g=0, seam=False)
b = Item('work_pants', 'Work pants', 'bottom', [('Pants', '#4A4E5A')], price=260, shop='thrift'); bottoms(b, pockets=True, cargo=True)


# ================= SHOES =================
def shoes(it, kind_='sneaker'):
    A = it.col(0); B = it.col(1) if len(it.colors) > 1 else '#F2F0EA'
    for v in VIEWS:
        for s in limb_sides(v):
            f = canvas(v, 'foot' + s); fm = shape(v, 'foot' + s, f, 1 if kind_ != 'sandal' else 0)
            if kind_ == 'sandal':
                f.paint(fm & f.yband(1.2, 9), A, ch=1); f.paint(fm & f.yband(-1.6, -.4) & (f.xband(-1.5, 1.5) if v != 'side' else f.xband(-1, 3)), A, ch=1, outline=False, flat=True)
                it.add(v, 'foot' + s, f); continue
            f.paint(fm, A, ch=1)
            sole = fm & f.yband(2.2, 9)
            f.paint(sole, B, ch=2 if len(it.colors) > 1 else 0, outline=True, light=np.array([0, -1, .4]))
            if kind_ == 'sneaker' and v != 'back': f.tint_line([(-1.5, .2), (1.5, .2)] if v == 'front' else [(0, .2), (2.5, .6)], 1.25, only=fm)
            if kind_ == 'dress': f.paint(fm & f.yband(-9, 1) & grow_mask(fm, -1), A, ch=1, outline=False, light=np.array([-.5, -.8, .4]))
            it.add(v, 'foot' + s, f)
            if kind_ in ('boot', 'hightop'):
                sh = canvas(v, 'shin' + s); sm = shape(v, 'shin' + s, sh, 1) & sh.yband(7.6 if kind_ == 'boot' else 10.3, 99)
                sh.paint(sm, A, ch=1); sh.tint_line([(-4, 8 if kind_ == 'boot' else 10.7), (4, 8 if kind_ == 'boot' else 10.7)], .8, only=sm)
                it.add(v, 'shin' + s, sh, z=None)


s = Item('sneakers', 'Sneakers', 'shoes', [('Shoes', '#D94B4B'), ('Soles', '#F2F0EA')], starter=True); shoes(s)
s = Item('hightops', 'High-tops', 'shoes', [('Shoes', '#2E2E3A'), ('Soles', '#F2F0EA')], price=680, shop='sports'); shoes(s, 'hightop')
s = Item('boots', 'Boots', 'shoes', [('Leather', '#6A4428'), ('Soles', '#2A1E16')], price=560, shop='thrift'); shoes(s, 'boot')
s = Item('oxfords', 'Dress shoes', 'shoes', [('Leather', '#2A1E1A'), ('Soles', '#18120F')], price=1500, shop='designer'); shoes(s, 'dress')
s = Item('sandals', 'Sandals', 'shoes', [('Straps', '#B07A48')], price=160, shop='thrift'); shoes(s, 'sandal')
s = Item('runners', 'Running shoes', 'shoes', [('Shoes', '#3FB0C8'), ('Soles', '#F6E04A')], price=820, shop='sports'); shoes(s)
