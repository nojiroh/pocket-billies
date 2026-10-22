#!/usr/bin/env python3
"""Phase 16: every Billie built from the part kits.

Reads each form's recipe from game/data/kitBuilds.json (which part on which bone, at what size and
colour, plus extras such as horns, ears, a crest or a shell) and the sliced parts in game/art/next/parts (cut by the
Studio's Art workbench, sockets in game/data/partKits.json). For every form it writes:

- game/art/next/billionaires/<name>.png, the sheet (front and back pieces), and <name>.json, its piece layout (where
  the Studio looks for every Billie's sheet);
- the rig (<line><stage>) in game/art/next/rigs-next.js;
- the stage's native parts (its fitting set: one kit part per slot of rules.json "parts") in game/data/lines/<line>.json
  as "parts".

    python3 tools/build-kit-billies.py                 # build everything, and a preview sheet in docs/samples
    python3 tools/build-kit-billies.py --preview OUT   # only draw the preview sheet (front and back of every form)

The rigs use the biped plan: the kits are drawn straight-on and upright. Torsos get squash and stretch frames and
front heads a blink, so the poses that pick them still read. Needs Pillow and numpy.
"""
import argparse
import colorsys
import json
import math
import os
import re
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont

BUILDS = 'game/data/kitBuilds.json'
OUT = 'game/art/next/billionaires'
PARTS = 'game/art/next/parts'
RIGS = 'game/art/next/rigs-next.js'
LINES = 'game/data/lines'
PREVIEW = 'docs/samples/kit-billies.png'

BW = BH = 128          # the stage box every Billie fits in
CX, BASE = 64, 120     # its middle and ground line
MARGIN = 2             # keep this many pixels clear of the box's edges
PAD = 3                # room round a torso for its squash and stretch frames
SHEET_W = 512

# which slot of rules.json "parts" each bone kind fills (a form's "slots" and an extra's slot override it)
KIND_SLOT = {'head': 'head', 'torso': 'body', 'arm': 'front', 'leg': 'back', 'tail': 'sig'}
SLOTS = ['head', 'body', 'front', 'back', 'sig']

# where a tail points from the front (degrees, 0 = out to the right, 90 = up); from behind it sweeps flatter.
# Its base and tip come from partKits.json sockets; poms (no sockets) sit centred on the torso's tail socket.
TAIL_AIM = {'fox_tail': 60, 'cat_tail': 45, 'reptile_tail': -15, 'shark_tailfin': 10, 'duck_tail': -40}
ARM_OUT = 15           # how an arm rests: hanging straight down, the paw this many degrees out (a form can change it)

with open('game/data/partKits.json') as _f:
    KIT = json.load(_f)['parts']


# ---------------------------------------------------------------- pictures

def recolour(im, c):
    """move a part to a colour (hue, saturation scale, value scale); outlines and white highlights stay"""
    if c is None:
        return im
    hue, sat, val = c
    a = np.array(im).astype(float) / 255
    rgb = a[..., :3].reshape(-1, 3)
    al = a[..., 3].reshape(-1)
    for i in np.nonzero(al > 0)[0]:
        h, s, v = colorsys.rgb_to_hsv(*rgb[i])
        if v < 0.22:
            continue
        if s < 0.12 and v > 0.85:
            continue
        rgb[i] = colorsys.hsv_to_rgb(hue, min(1.0, max(s, 0.12) * sat), min(1.0, v * val))
    a[..., :3] = rgb.reshape(a.shape[0], a.shape[1], 3)
    return Image.fromarray((a * 255).round().astype(np.uint8), 'RGBA')


def face_mask(head):
    """a head's face (eyes, nose, mouth: the darkest and the most saturated pixels), kept as drawn when recoloured"""
    hsv = np.array(head.convert('RGB').convert('HSV')).astype(int)
    al = np.array(head)[..., 3] > 0
    return al & ((hsv[..., 2] < 90) | ((hsv[..., 1] > 120) & (hsv[..., 2] > 140)))


def recolour_head(head, c):
    if c is None:
        return head
    src = np.array(head)
    out = np.array(recolour(head, c))
    m = face_mask(head)
    out[m] = src[m]
    return Image.fromarray(out, 'RGBA')


def load_part(pid, view, f):
    """a kit part at f times its size, with hard alpha (pixel art: a pixel is there or it isn't)"""
    if pid not in KIT:
        raise SystemExit(f'unknown part {pid} (not in game/data/partKits.json)')
    img = Image.open(f'{PARTS}/{view}/{pid}.png').convert('RGBA')
    w, h = img.size
    size = (max(1, round(w * f)), max(1, round(h * f)))
    a = np.array(img).astype(float)
    a[..., :3] *= a[..., 3:4] / 255
    small = np.array(Image.fromarray(a.astype(np.uint8), 'RGBA').resize(size, Image.BOX)).astype(float)
    al = small[..., 3]
    rgb = np.where(al[..., None] > 0, small[..., :3] * 255 / np.maximum(al[..., None], 1), 0)
    out = np.dstack([np.clip(rgb, 0, 255), np.where(al >= 128, 255, 0)]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def sockets(pid, view, im, mirror=False):
    """a part's sockets in pixels of its picture (mirrored when the picture is)"""
    s = KIT[pid]['views'][view].get('sockets', {})
    w, h = im.size
    return {n: (((1 - fx) if mirror else fx) * w, fy * h) for n, (fx, fy) in s.items()}


def squash_frames(im):
    """a torso padded by PAD, plus its squashed (wider, lower) and stretched (thinner, taller) frames on the same
    ground and middle, for the poses that pick them (rigFrame's P.sq)"""
    w, h = im.size
    W, H = w + 2 * PAD, h + 2 * PAD
    out = {}
    for name, (fx, fy) in (('main', (1, 1)), ('squash', (1.08, 0.9)), ('stretch', (0.93, 1.08))):
        nw, nh = max(1, min(W, round(w * fx))), max(1, min(H, round(h * fy)))
        s = im.resize((nw, nh), Image.NEAREST)
        c = Image.new('RGBA', (W, H))
        c.alpha_composite(s, ((W - nw) // 2, H - PAD - nh))   # stands on the same bottom line
        out[name] = c
    return out


def blink_frame(head):
    """the head with its eyes shut: each eye (a dark blob inside the face, with its highlight) is painted over with
    the skin round it and a closed-lid line across its lower middle. None if no pair of eyes is found."""
    a = np.array(head).copy()
    h, w = a.shape[:2]
    al = a[..., 3] > 0
    hsv = np.array(head.convert('RGB').convert('HSV')).astype(int)
    dark = al & (hsv[..., 2] < 70)
    # the outline: dark pixels within 2 px of the edge of the picture's shape
    edge = np.zeros_like(al)
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            edge |= ~np.roll(np.roll(al, dy, 0), dx, 1)
    inner = dark & ~edge
    # connected blobs
    seen = np.zeros_like(inner)
    blobs = []
    for y in range(h):
        for x in range(w):
            if inner[y, x] and not seen[y, x]:
                st, pts = [(y, x)], []
                seen[y, x] = True
                while st:
                    cy, cx = st.pop()
                    pts.append((cy, cx))
                    for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                        if 0 <= ny < h and 0 <= nx < w and inner[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            st.append((ny, nx))
                blobs.append(pts)
    eyes = []
    for pts in blobs:
        ys = [p[0] for p in pts]
        xs = [p[1] for p in pts]
        bw, bh = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
        cy = sum(ys) / len(ys)
        cx = sum(xs) / len(xs)
        if (3 <= len(pts) <= w * h * 0.08 and 2 <= bw <= w * 0.3 and 2 <= bh <= h * 0.35 and h * 0.2 < cy < h * 0.75
                and abs(cx - w / 2) > w * 0.1):            # not the nose or mouth, in the middle
            eyes.append((min(xs), min(ys), max(xs), max(ys)))
    # the pair: the two biggest blobs on either side of the middle, level with each other
    left = [e for e in eyes if (e[0] + e[2]) / 2 < w / 2]
    right = [e for e in eyes if (e[0] + e[2]) / 2 >= w / 2]
    if not left or not right:
        return None
    area = lambda e: (e[2] - e[0] + 1) * (e[3] - e[1] + 1)
    L, R = max(left, key=area), max(right, key=area)
    if abs((L[1] + L[3]) / 2 - (R[1] + R[3]) / 2) > max(2, h * 0.08):
        return None
    line = a[dark].mean(axis=0) if dark.any() else np.array([40, 30, 30, 255])
    val, sat = hsv[..., 2], hsv[..., 1]
    eyeish = al & ~edge & ((val < 140) | ((sat < 46) & (val > 200)))   # the eye, its rim and its highlight
    for x0, y0, x1, y1 in (L, R):
        X0, Y0, X1, Y1 = max(0, x0 - 1), max(0, y0 - 1), min(w - 1, x1 + 1), min(h - 1, y1 + 1)
        # the skin: the fur in a ring round the eye that is not part of it
        ring = []
        for y in range(max(0, Y0 - 2), min(h, Y1 + 3)):
            for x in range(max(0, X0 - 2), min(w, X1 + 3)):
                if (X0 <= x <= X1 and Y0 <= y <= Y1) or not al[y, x] or edge[y, x] or eyeish[y, x]:
                    continue
                ring.append(a[y, x])
        skin = np.median(np.array(ring), axis=0).round() if ring else a[y0, x0]
        for y in range(Y0, Y1 + 1):
            for x in range(X0, X1 + 1):
                if eyeish[y, x]:
                    a[y, x] = skin
        ly = y0 + round((y1 - y0) * 0.6)
        for x in range(x0, x1 + 1):
            a[ly, x] = line
    return Image.fromarray(a, 'RGBA')


def opaque_width(im):
    xs = np.nonzero(np.array(im)[..., 3].any(axis=0))[0]
    return (xs.max() - xs.min() + 1) if len(xs) else 0


def arm_rest(im, joint, out_right, out_deg):
    """the rest tilt (radians, as a rig bone's rr: positive turns clockwise on screen) that hangs a limb straight
    down from its joint with its far end out_deg degrees out from the body; the idle animation sways around it"""
    ys, xs = np.nonzero(np.array(im)[..., 3] > 0)
    bot = ys.max()
    px, py = xs[ys >= bot - 3].mean(), bot
    now = math.degrees(math.atan2(-(py - joint[1]), px - joint[0]))
    want = -90 + (out_deg if out_right else -out_deg)
    return round(-math.radians(want - now), 3)


# ---------------------------------------------------------------- one form, one view

def colour_of(spec, C):
    return None if spec is None else (C[spec] if isinstance(spec, str) else spec)


def build_view(form, C, view, k):
    """the pieces of one view at stage scale k: a list of pieces (bone, parent, image frames, pivot, at, z, zb, ...)"""
    P = form['parts']
    get = {}
    for kind, (pid, size, col) in P.items():
        im = load_part(pid, view, size * k)
        get[kind] = recolour_head(im, colour_of(col, C)) if kind == 'head' else recolour(im, colour_of(col, C))
    torso = get['torso']
    tw, th = torso.size
    T0 = sockets(P['torso'][0], view, torso)
    T = lambda n: (T0[n][0] - tw / 2, T0[n][1] - th / 2)      # from the torso's middle (its pivot)
    pieces = []

    def piece(n, par, frames, pivot, at, z, zb=None, **kw):
        pieces.append(dict(n=n, par=par, frames=frames, pivot=pivot, at=at, z=z, zb=z if zb is None else zb, **kw))

    # legs hang from the hips; the torso stands as high as the legs are long, so the feet meet the ground line
    if 'leg' in get:
        leg = get['leg']
        lw, lh = leg.size
        jx, jy = sockets(P['leg'][0], view, leg)['joint']
        torso_y = -(lh - jy) - T('hipL')[1]
        hl, hr = T('hipL')[0], T('hipR')[0]
        gap = opaque_width(leg) * 1.15                          # feet stand clear of each other
        if hr - hl < gap:
            mid = (hl + hr) / 2
            hl, hr = mid - gap / 2, mid + gap / 2
        hip_y = T('hipL')[1]
        piece('legL', 'torso', {'main': leg}, (jx, jy), (hl, hip_y), 7)
        legr = leg.transpose(Image.FLIP_LEFT_RIGHT)
        piece('legR', 'torso', {'main': legr}, (lw - jx, jy), (hr, hip_y), 7)
    else:
        torso_y = -th / 2                                      # a blob sits on its body
    fr = squash_frames(torso)
    piece('torso', 'root', fr, (tw / 2 + PAD, th / 2 + PAD), (0, torso_y), 5)
    pieces.insert(0, pieces.pop())                             # the torso first: everything hangs on it

    # arms (or wings, or fins) from the shoulders; the kit draws each as the creature's own left arm (the viewer's
    # right), mirrored for the viewer's left
    if 'arm' in get:
        arm = get['arm']
        out = form.get('armOut', ARM_OUT)
        for side, mirror in (('L', True), ('R', False)):
            im = arm.transpose(Image.FLIP_LEFT_RIGHT) if mirror else arm
            j = sockets(P['arm'][0], view, arm, mirror)['joint']
            piece('arm' + side, 'torso', {'main': im}, j, T('shoulder' + side), 8, 2,
                  rr=arm_rest(im, j, not mirror, out))

    # the tail from the torso's tail socket, turned to its aim (from behind it sweeps flatter: drawn mirrored)
    if 'tail' in get:
        tail = get['tail']
        ts = sockets(P['tail'][0], view, tail)
        if 'base' in ts and P['tail'][0] in TAIL_AIM:
            (bx, by), (px, py) = ts['base'], ts['tip']
            now = math.degrees(math.atan2(-(py - by), px - bx))
            aim = TAIL_AIM[P['tail'][0]]
            want = aim if view == 'front' else aim * 0.6
            piece('tail', 'torso', {'main': tail}, (bx, by), T('tail'), 1, 8, rr=round(-math.radians(want - now), 3), lag=1)
        else:
            piece('tail', 'torso', {'main': tail}, (tail.size[0] / 2, tail.size[1] / 2), T('tail'), 1, 8, lag=1)

    # the head on the neck, its chin a little below the neck socket so there is no gap
    head = get['head']
    hw, hh = head.size
    chx, chy = sockets(P['head'][0], view, head).get('chin', (hw / 2, hh * 0.9))
    nx, ny = T('neck')
    hf = {'main': head}
    if view == 'front':
        b = blink_frame(head)
        if b is not None:
            hf = {'idle': head, 'blink': b}
    piece('head', 'torso', hf, (chx, chy), (nx, ny + hh * 0.12), 9, face=view == 'front')

    # extras: placed on the head (or the torso) the way the starter sample placed them
    names = {}
    for i, ex in enumerate(form.get('extras', [])):
        pid, anchor, size, col, pair = ex[:5]
        slot = ex[5] if len(ex) > 5 else None
        e = recolour(load_part(pid, view, size * k), colour_of(col, C))
        ew, eh = e.size
        on_head = anchor in ('brow', 'ears', 'crown', 'chin')
        if anchor == 'brow':      # horns: either side of the top of the head
            dx, dy, z, zb, base = hw * 0.08 - ew * 0.5, -eh * 0.55, 10, 10, 'horn'
        elif anchor == 'ears':
            dx, dy, z, zb, base = hw * 0.14 - ew * 0.5, -eh * 0.45, 8, 8, 'ear'
        elif anchor == 'crown':
            dx, dy, z, zb, base = hw / 2 - ew / 2, -eh * 0.55, 11, 11, 'crest'
        elif anchor == 'chin':    # a beard, hanging from the chin
            e = e.transpose(Image.FLIP_TOP_BOTTOM)
            dx, dy, z, zb, base = hw / 2 - ew / 2, hh * 0.78, 10, 4, 'beard'
        elif anchor == 'back':    # carried on the back: behind it from the front, over it from behind
            dx, dy, z, zb, base = tw / 2 - ew / 2, -eh * 0.15, 4, 6, 'pack'
        elif anchor == 'collar':  # round the neck, under the head
            dx, dy, z, zb, base = T0['neck'][0] - ew / 2, T0['neck'][1] - eh * 0.45, 8.5, 8.5, 'ruff'
        else:
            raise SystemExit(f"{form['name']}: unknown anchor {anchor}")
        z, zb = z + i * 0.01, zb + i * 0.01                    # later extras over earlier ones
        # the top-left of the extra from its parent's origin (the head's chin pivot, the torso's middle)
        ox, oy = (-chx, -chy) if on_head else (-tw / 2, -th / 2)
        piv = (ew / 2, 0) if anchor == 'chin' else (ew / 2, eh)
        par = 'head' if on_head else 'torso'
        names[base] = names.get(base, 0) + 1
        nm = base if names[base] == 1 else f'{base}{names[base]}'
        if pair:
            piece(nm + 'L', par, {'main': e}, piv, (ox + dx + piv[0], oy + dy + piv[1]), z, zb, slot=slot)
            em = e.transpose(Image.FLIP_LEFT_RIGHT)
            mdx = hw - dx - ew if on_head else tw - dx - ew
            piece(nm + 'R', par, {'main': em}, piv, (ox + mdx + piv[0], oy + dy + piv[1]), z, zb, slot=slot)
        else:
            piece(nm, par, {'main': e}, piv, (ox + dx + piv[0], oy + dy + piv[1]), z, zb, slot=slot)
    # bone kinds that fill another slot (the slug's tail is its back part)
    for p in pieces:
        kind = re.sub(r'[LR]$', '', p['n'])
        if kind in form.get('slots', {}):
            p['slot'] = form['slots'][kind]
    return pieces


# ---------------------------------------------------------------- rest pose: matrices, drawing, bounds

def mat_mul(m, n):
    return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3],
            m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]


def world(pieces, back):
    """each piece's matrix in the rest pose, as skeleton-rig.js works them out (the back view drawn mirrored)"""
    M = [1, 0, 0, 1, CX, BASE]
    if back:
        M = mat_mul(M, [-1, 0, 0, 1, 0, 0])
    W = {'root': M}
    out = []
    for p in pieces:
        m = mat_mul(W[p['par']], [1, 0, 0, 1, round(p['at'][0]), round(p['at'][1])])
        r = p.get('rr', 0)
        if r:
            c, s = math.cos(r), math.sin(r)
            m = mat_mul(m, [c, s, -s, c, 0, 0])
        W[p['n']] = m
        out.append((p['zb'] if back else p['z'], m, p))
    out.sort(key=lambda t: t[0])
    return out


def draw(pieces, back, size=(BW, BH)):
    cv = Image.new('RGBA', size)
    for _, m, p in world(pieces, back):
        im = p['frames'].get('main') or p['frames'].get('idle')
        ox, oy = -round(p['pivot'][0]), -round(p['pivot'][1])
        # image pixel (u, v) lands at m * (u + ox, v + oy); PIL wants the inverse map
        a, b, c, d, e, f = m
        det = a * d - b * c
        ia, ib, ic, id_ = d / det, -b / det, -c / det, a / det
        ie, iff = -(ia * e + ic * f), -(ib * e + id_ * f)
        # screen (x, y) -> local (lx, ly) = inv * (x, y); image = local - (ox, oy)
        inv = (ia, ic, ie - ox, ib, id_, iff - oy)
        layer = im.transform(size, Image.AFFINE, inv, resample=Image.NEAREST)
        cv.alpha_composite(layer)
    return cv


def bounds(img):
    a = np.array(img)[..., 3]
    ys, xs = np.nonzero(a)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


# ---------------------------------------------------------------- one form: fit, sheet, rig, layout

def fit_form(form, C):
    """the stage scale that keeps both views inside the stage box (shrunk from the recipe's if it doesn't fit)"""
    k = form['scale']
    for _ in range(30):
        ok = True
        for view in ('front', 'back'):
            x0, y0, x1, y1 = bounds(draw(build_view(form, C, view, k), view == 'back'))
            if y0 < MARGIN or x0 < MARGIN or x1 > BW - MARGIN:
                ok = False
        if ok:
            return k
        k = round(k * 0.96, 4)
    raise SystemExit(f"{form['name']} doesn't fit the stage box")


def pack(images):
    """shelf-pack pictures into one sheet SHEET_W wide; returns the sheet and each picture's place"""
    x = y = 2
    rowh = 0
    spots = []
    for im in images:
        w, h = im.size
        if x + w + 2 > SHEET_W:
            x, y, rowh = 2, y + rowh + 2, 0
        spots.append((x, y))
        x += w + 2
        rowh = max(rowh, h)
    H = y + rowh + 2
    sheet = Image.new('RGBA', (SHEET_W, H))
    for im, (sx, sy) in zip(images, spots):
        sheet.alpha_composite(im, (sx, sy))
    return sheet, spots


def build_form(form, C):
    k = fit_form(form, C)
    views = {v: build_view(form, C, v, k) for v in ('front', 'back')}
    pics, where = [], []
    for v in ('front', 'back'):
        for pi, p in enumerate(views[v]):
            for fn, im in p['frames'].items():
                where.append((v, pi, fn))
                pics.append(im)
    sheet, spots = pack(pics)
    place = {w: (s, im.size) for w, s, im in zip(where, spots, pics)}
    rig, layout = {}, {'id': form['name'], 'w': BW, 'h': BH, 'cx': CX, 'base': BASE, 'plan': 'biped',
                       'kit': 'builds.json', 'pieces': []}
    for v in ('front', 'back'):
        ps = views[v]
        imgs, bones = [], []
        for pi, p in enumerate(ps):
            f = {fn: [place[(v, pi, fn)][0][0], place[(v, pi, fn)][0][1], *place[(v, pi, fn)][1]] for fn in p['frames']}
            imgs.append({'ox': -round(p['pivot'][0]), 'oy': -round(p['pivot'][1]), 'f': f})
            b = {'n': p['n'], 'par': p['par'], 'at': [round(p['at'][0]), round(p['at'][1])], 'z': p['z'], 'zb': p['zb'], 'i': pi}
            for key in ('rr', 'lag', 'slot'):
                if p.get(key) not in (None, 0):
                    b[key] = p[key]
            if p.get('face'):
                b['face'] = True
            bones.append(b)
        rest = draw(ps, False)                                  # bounds in the view's own (unmirrored) drawing
        x0, y0, x1, y1 = bounds(rest)
        rig[v] = {'k': 1, 'BW': BW, 'BH': BH, 'cx': CX, 'base': BASE, 'tipX': 0, 'plan': 'biped',
                  'q': {'lift': 0, 'flapMs': 300},
                  'geo': {'cx': CX, 'base': BASE, 'top': int(y0), 'mid': (int(y0) + BASE) / 2, 'hw': (int(x1) - int(x0)) / 2,
                          'lift': 0, 'k': 1, 'cy': (int(y0) + BASE) / 2},
                  'size': list(sheet.size), 'imgs': imgs, 'bones': bones, 'clock': 12,
                  'sheet': f"next/billionaires/{form['name']}.png", 'kit': 'builds.json'}
        # the piece layout (as tools/build-roster-sheets.py writes them): rest-pose boxes without turns
        pos = {'root': (CX, BASE)}
        for b, e in zip(bones, imgs):
            pp = pos[b['par']]
            q = (pp[0] + b['at'][0], pp[1] + b['at'][1])
            pos[b['n']] = q
            fn = 'main' if 'main' in e['f'] else 'idle'
            x, y, w, h = e['f'][fn]
            layout['pieces'].append({'n': b['n'], 'v': 'main', 'group': v, 'x': x, 'y': y, 'w': w, 'h': h,
                                     'px': q[0] + e['ox'], 'py': q[1] + e['oy'], 'pivot': [-e['ox'], -e['oy']], 'par': b['par']})
    return k, views, sheet, rig, layout


def native_parts(form):
    """the stage's fitting set: the kit part on the bone that fills each slot"""
    slots = {}
    over = form.get('slots', {})
    for kind, (pid, _, _) in form['parts'].items():
        s = over.get(kind, KIND_SLOT[kind])
        if s in slots:
            raise SystemExit(f"{form['name']}: two parts fill slot {s}")
        slots[s] = pid
    for ex in form.get('extras', []):
        if len(ex) > 5 and ex[5]:
            if ex[5] in slots:
                raise SystemExit(f"{form['name']}: two parts fill slot {ex[5]}")
            slots[ex[5]] = ex[0]
    miss = [s for s in SLOTS if s not in slots]
    if miss:
        raise SystemExit(f"{form['name']}: no part fills {miss}")
    return {s: slots[s] for s in SLOTS}


# ---------------------------------------------------------------- files

def read_rigs():
    s = open(RIGS).read()
    head, body = s.split('window.RIGS_NEXT=', 1)
    return head, json.loads(body.rstrip().rstrip(';'))


def write_rigs(head, rigs):
    with open(RIGS, 'w') as f:
        f.write(head + 'window.RIGS_NEXT=' + json.dumps(rigs, separators=(',', ':')) + ';\n')


def write_data_file(path, value):
    """a game data file in the layout the Studio writes (game/js/data-files.js PB_DATA.text), so a rebuild only
    changes what changed"""
    js = ("import('./tools/data-files.mjs').then(m => { let s = ''; process.stdin.on('data', d => (s += d));"
          " process.stdin.on('end', () => require('fs').writeFileSync(process.argv[1], m.PB_DATA.text(JSON.parse(s)))); })")
    subprocess.run(['node', '-e', js, path], input=json.dumps(value), text=True, check=True)


def preview(built, path):
    cell, pad, lab = 128, 6, 16
    cols = 4
    rows = math.ceil(len(built) / cols)
    W = pad + cols * (cell * 2 + pad)
    H = 30 + rows * (cell + lab + pad) + pad
    sh = Image.new('RGBA', (W, H), (246, 241, 230, 255))
    d = ImageDraw.Draw(sh)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 11)
        big = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 14)
    except OSError:
        font = big = ImageFont.load_default()
    d.text((pad, 8), 'Billies from the part kits - front and back (as the game draws them at rest)', fill=(60, 50, 40), font=big)
    for i, (form, k, views) in enumerate(built):
        r, c = divmod(i, cols)
        x0 = pad + c * (cell * 2 + pad)
        y0 = 30 + r * (cell + lab + pad)
        d.rectangle([x0, y0, x0 + cell * 2 - 1, y0 + cell - 1], fill=(255, 252, 244, 255), outline=(220, 210, 190))
        d.line([x0, y0 + BASE, x0 + cell * 2 - 1, y0 + BASE], fill=(225, 215, 195))
        for j, v in enumerate(('front', 'back')):
            sh.alpha_composite(draw(views[v], v == 'back'), (x0 + j * cell, y0))
        shrunk = '' if k == form['scale'] else f' (fit {k:.2f})'
        d.text((x0 + 4, y0 + cell + 2), f"{form['name']}  {form['rig']}{shrunk}", fill=(60, 50, 40), font=font)
    sh = sh.resize((W * 2, H * 2), Image.NEAREST)
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    sh.save(path, optimize=True)
    print('preview', path, sh.size)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', metavar='OUT', help='only draw the preview sheet to OUT')
    args = ap.parse_args()
    with open(BUILDS) as f:
        B = json.load(f)
    C = {k: tuple(v) for k, v in B['colours'].items()}
    built, results = [], []
    for form in B['forms']:
        k, views, sheet, rig, layout = build_form(form, C)
        built.append((form, k, views))
        results.append((form, sheet, rig, layout))
        print(f"{form['rig']:<12} {form['name']:<13} scale {form['scale']}" + ('' if k == form['scale'] else f' -> {k}'))
    if args.preview:
        preview(built, args.preview)
        return
    head, rigs = read_rigs()
    lines = {}
    for form, sheet, rig, layout in results:
        sheet.save(f"{OUT}/{form['name']}.png", optimize=True)
        with open(f"{OUT}/{form['name']}.json", 'w') as f:
            json.dump(layout, f, separators=(',', ':'))
        rigs[form['rig']] = rig
        lines.setdefault(form['line'], {})[form['stage']] = native_parts(form)
    write_rigs(head, rigs)
    for line, by_stage in lines.items():
        p = f'{LINES}/{line}.json'
        with open(p) as f:
            L = json.load(f)
        n = len(L['names'])
        if sorted(by_stage) != list(range(n)):
            raise SystemExit(f'{line}: recipes for stages {sorted(by_stage)}, the line has {n}')
        L['parts'] = [by_stage[i] for i in range(n)]
        write_data_file(p, L)
    preview(built, PREVIEW)


if __name__ == '__main__':
    main()
