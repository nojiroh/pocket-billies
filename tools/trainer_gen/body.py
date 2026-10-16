"""The trainer skeleton (front, back and side views) and the bare body drawn on it.
Coordinates are design pixels, y down, relative to each bone's joint. A standing trainer is 74 px to the crown."""
from core import Canvas, capsule, smooth_poly

VIEWS = ('front', 'back', 'side')
BS, HS = 1.5, 1.95   # pixels per design unit: body, head (a big, expressive head; about 3.7 heads tall)
SKIN = '#E6B08A'

# name, parent, at, z, canvas (w, h, jx, jy)
_LIMBS = lambda s, x, zA: [
    (f'armU{s}', 'torso', (x, -18), zA, (12, 20, 6, 4)), (f'armL{s}', f'armU{s}', (0, 11), zA + .3, (10, 17, 5, 3)), (f'hand{s}', f'armL{s}', (0, 9.5), zA + .6, (10, 10, 5, 3))]
_LEGS = lambda s, x, z: [
    (f'thigh{s}', 'pelvis', (x, 2), z, (14, 22, 7, 4)), (f'shin{s}', f'thigh{s}', (0, 14.5), z + .3, (12, 20, 6, 3)), (f'foot{s}', f'shin{s}', (0, 13), z + .6, (16, 10, 8, 4))]
_CORE = [('pelvis', None, (0, -32.1), 14, (24, 16, 12, 5)), ('torso', 'pelvis', (0, 0), 20, (28, 30, 14, 26)), ('chest', 'torso', (0, -13), 21, (22, 14, 11, 7)),
         ('neck', 'torso', (0, -20), 19, (12, 10, 6, 6)), ('head', 'neck', (0, -3), 30, (44, 70, 22, 42))]
SKEL = {
    'front': _CORE + _LIMBS('L', -8, 25) + _LIMBS('R', 8, 25) + _LEGS('L', -3.5, 10) + _LEGS('R', 3.5, 10),
    'back': _CORE + _LIMBS('L', -8, 25) + _LIMBS('R', 8, 25) + _LEGS('L', -3.5, 10) + _LEGS('R', 3.5, 10),
    # side view faces right (+x): N = near limb, F = far limb behind the body
    'side': [(n, p, ((1, -13) if n == 'chest' else (1, -20) if n == 'neck' else at), z, c) for n, p, at, z, c in _CORE] +
            _LIMBS('N', 0, 25) + _LIMBS('F', 0, 3) + _LEGS('N', 0, 11) + _LEGS('F', 0, 6),
}
ROLE = {}  # bone -> animation role (same names)


def canvas(view, bone):
    for n, p, at, z, c in SKEL[view]:
        if n == bone: return Canvas(*c, k=HS if bone == 'head' else BS)
    raise KeyError(bone)


def bones(view):
    return [b[0] for b in SKEL[view]]


def kind(bone):
    return bone[:-1] if bone not in ('pelvis', 'torso', 'chest', 'neck', 'head') else bone


def side_of(bone):
    return bone[-1] if bone[-1] in 'LRNF' and bone not in ('head',) else ''


# ---------- body silhouettes (grow = clothing a little bigger than the body) ----------
def shape(view, bone, cv, g=0):
    """boolean mask of the body part, grown by g pixels"""
    k = kind(bone)
    side = view == 'side'
    if k == 'pelvis':
        pts = [(-4.2 - g, -1.5), (4.2 + g, -1.5), (4.6 + g, 3), (3.6 + g, 6.5 + g), (-2, 7 + g), (-5 - g, 4.5), (-5.2 - g, 1)] if side else \
              [(-6.6 - g, -1.5), (6.6 + g, -1.5), (6.9 + g, 3), (5.6 + g, 6.5 + g), (1.2, 7 + g), (0, 5.5 + g), (-1.2, 7 + g), (-5.6 - g, 6.5 + g), (-6.9 - g, 3)]
        return cv.poly_mask(smooth_poly(pts, 2))
    if k == 'torso':
        if side:
            pts = [(-4.2 - g, -20.2 - g), (2.8 + g, -20.6 - g), (4.4 + g, -18.4), (4.8 + g, -13), (4.1 + g, -8), (3.9 + g, -3), (4.3 + g, 1.5), (-4.3 - g, 1.5), (-4.1 - g, -4), (-4.6 - g, -10), (-4.9 - g, -16)]
        else:
            pts = [(-8.6 - g, -18.2), (-7.4 - g, -20.6 - g), (7.4 + g, -20.6 - g), (8.6 + g, -18.2), (8.1 + g, -14), (6.6 + g, -8.5), (6.1 + g, -3.5), (6.7 + g, 1.5), (-6.7 - g, 1.5), (-6.1 - g, -3.5), (-6.6 - g, -8.5), (-8.1 - g, -14)]
        return cv.poly_mask(smooth_poly(pts, 2))
    if k == 'chest':
        if side: return cv.ell_mask(3.4 + g * .5, 1.6, 2.5 + g, 2.7 + g)
        return cv.ell_mask(-3.1, 1.2, 3.3 + g, 2.7 + g) | cv.ell_mask(3.1, 1.2, 3.3 + g, 2.7 + g)
    if k == 'neck':
        return cv.rect_mask(-1.8 - g, -4.5, 2.4 + g, 1.5) if side else cv.rect_mask(-2.3 - g, -4.5, 2.3 + g, 1.5)
    if k == 'head':
        if side:
            pts = [(-6.1, -12), (-5.2, -15.6), (-2, -17.4), (2, -17.2), (5, -15.2), (6, -12.2), (6.2, -9.3), (7.3, -7.4), (6.4, -6.1), (6.2, -4.2), (4.6, -1.3), (2, 0), (-1, -.3), (-3.6, -1.6), (-5.6, -4.6), (-6.4, -8.2)]
            return cv.poly_mask(smooth_poly(pts, 1))
        pts = [(-6.5, -11), (-6.2, -14.2), (-4.4, -16.6), (0, -17.3), (4.4, -16.6), (6.2, -14.2), (6.5, -11), (6.2, -6.2), (4.8, -2.6), (2.5, -.3), (0, .3), (-2.5, -.3), (-4.8, -2.6), (-6.2, -6.2)]
        return cv.poly_mask(smooth_poly(pts, 2))
    if k == 'armU': return cv.poly_mask(capsule(0, 0, 0, 11, 2.5 + g, 2.1 + g))
    if k == 'armL': return cv.poly_mask(capsule(0, 0, 0, 9.5, 2.1 + g, 1.75 + g))
    if k == 'hand':
        return cv.ell_mask(0, 2.5, 2.2 + g, 2.8 + g) | (cv.ell_mask(1.8 if view != 'side' else 1.2, 1.4, .9 + g, 1.4 + g) if view != 'back' else cv.ell_mask(0, 2.5, 2.2 + g, 2.8 + g))
    if k == 'thigh': return cv.poly_mask(capsule(0, 0, 0, 14.5, 3.6 + g, 2.6 + g))
    if k == 'shin': return cv.poly_mask(capsule(0, 0, 0, 13, 2.6 + g, 1.9 + g)) | cv.ell_mask(0, 4.2, 2.75 + g, 3.8 + g)
    if k == 'foot':
        if side: return cv.poly_mask(smooth_poly([(-2.6 - g, -.6), (-2.6 - g, 2.6 + g), (5.8 + g, 2.6 + g), (6 + g, 1.1), (3.6, -.4 - g), (1.4, -1.3 - g), (-1, -1.3 - g)], 1))
        return cv.poly_mask(smooth_poly([(-2.5 - g, -1), (2.5 + g, -1), (3.1 + g, 1.5), (3 + g, 2.6 + g), (-3 - g, 2.6 + g), (-3.1 - g, 1.5)], 1))
    raise KeyError(k)


def draw_body(view, bone, skin=SKIN):
    cv = canvas(view, bone)
    if bone == 'chest' and view == 'back': return cv
    m = shape(view, bone, cv)
    open_top = {'armL': 1.2, 'hand': 1.0, 'shin': 1.5, 'foot': .3, 'thigh': 1.5, 'neck': -1}.get(kind(bone))
    cv.paint(m, skin, ch=1, open_top=open_top, open_bottom=0.5 if kind(bone) == 'neck' else None)
    k = kind(bone)
    if k == 'head':
        if view == 'side':
            cv.paint(cv.ell_mask(-1.2, -8, 1.4, 2.3), skin, ch=1, soft=.6)
            cv.shade_px(-1.2, -8, .8); cv.shade_px(-1.2, -7.5, .85)
            cv.shade_px(6.9, -6.5, .85)   # under the nose
        else:
            for s in (-1, 1):
                e = cv.ell_mask(6.6 * s, -8, 1.4, 2.3) & ~m
                cv.paint(e, skin, ch=1, soft=.6)
            if view == 'front':
                for y in (-7.6, -7.1): cv.shade_px(-.6, y, .9)   # nose bridge in shade
                cv.shade_px(-.6, -6.3, .82); cv.shade_px(.1, -6.1, .9)
                for s in (-1, 1): cv.shade_px(6.6 * s, -8, .85); cv.shade_px(6.6 * s, -7.4, .85)   # inner ear
    if k == 'hand' and view != 'back':
        cv.dots([(0, 3.4)], '#B9785C', 1)
    if k == 'torso' and view == 'front':
        cv.tint_line([(-1.5, -19.5), (0, -18.5), (1.5, -19.5)], .9)  # collarbone hint
    return cv
