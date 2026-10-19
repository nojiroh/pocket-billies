#!/usr/bin/env python3
"""v38: the roster beyond the starters as puppet piece sheets, from one short spec per line.

Every species is an animal drawn in the style guide's rules by tools/pixkit.py (four-tone cel shading, rim light, fur
fringes, sel-out outlines, anime eyes) from a body-plan template (quad, biped, bird, lizard, serpent, shell, insect,
fish, hopper, plant, blob, crab, flyer) and a few words of spec: ramps, head shape, ears, horns, tail, feet, crest,
wings, markings and extras. Nothing is worn and nothing manufactured sits on a body: who a billionaire parodies shows
in its shape, colours and markings. The pieces go on ONE sheet per species with a layout JSON, four face pieces, a
three-step torso, the back view and a portrait, exactly like the starters (tools/build-starter-sheets.py), and the
rigs go into art/next/rigs-next.js. A sheet that exists is kept (paint over it by hand); --force remakes it.

    python3 tools/build-roster-sheets.py [--force] [--only huang,ellison] [--sheet validation/v38-roster.png]"""
import argparse, importlib.util, json, math, random, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixkit import *
from PIL import Image, ImageDraw
_spec = importlib.util.spec_from_file_location('bss', Path(__file__).resolve().parent / 'build-starter-sheets.py'); bss = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(bss)
part, head_part, bone_only, quad_torso, quad_leg, contact_shadow, build = bss.part, bss.head_part, bss.bone_only, bss.quad_torso, bss.quad_leg, bss.contact_shadow, bss.build
OUT = NEXT / 'billionaires'
TORSO = {'rest': 1, 'squash': .86, 'stretch': 1.1}

# ------------------------------------------------------------------ small drawing helpers
def blobp(ramp, w, h, step=3, fur=0, tilt=0, **kw):
    pc = Piece(int(w) + 4, int(h) + 4); pc.blob(ramp, pc.w / 2, pc.h / 2, w / 2, h / 2, step, fur=fur, tilt=tilt, **kw); return pc
def marks(pc, kind, ramp, cx, cy, rx, ry, S, seed=1):
    """markings on a body blob: only over painted pixels"""
    rng = random.Random(seed); p = pc.im.load()
    def on(x, y): return 0 <= x < pc.w and 0 <= y < pc.h and p[x, y][3]
    if kind == 'spots':
        for _ in range(int(5 + rx * .25)):
            x, y = int(cx + (rng.random() - .5) * rx * 1.6), int(cy + (rng.random() - .5) * ry * 1.4); r = max(1, int(1.5 * S + rng.random() * 2 * S))
            pc.blob(ramp, x, y, r, r * .8, 3, flat=True, mask=on)
    elif kind == 'stripes':
        for i in range(int(3 + rx * .08)):
            x = int(cx - rx * .7 + i * rx * 1.4 / max(1, int(2 + rx * .08)))
            for y in range(int(cy - ry * .9), int(cy + ry * .5)):
                xx = x + int((y - cy) * .25)
                if on(xx, y): p[xx, y] = C(ramp, 2)
                if on(xx + 1, y) and S > 1: p[xx + 1, y] = C(ramp, 2)
    elif kind == 'patch': pc.blob(ramp, cx - rx * .15, cy - ry * .2, rx * .42, ry * .36, 4, flat=True, mask=on)
    elif kind == 'belly': pc.blob(ramp, cx, cy + ry * .4, rx * .62, ry * .36, 4, deep=False, hi=False, flat=True, mask=on)
    elif kind == 'saddle': pc.blob(ramp, cx, cy - ry * .5, rx * .8, ry * .42, 2, flat=True, mask=on)
    elif kind == 'glow':
        for _ in range(int(3 + rx * .1)):
            x, y = int(cx + (rng.random() - .5) * rx * 1.5), int(cy + (rng.random() - .5) * ry * 1.2)
            if on(x, y): pc.dot(C(ramp, 5), x, y, 2, 1); pc.dot(C(ramp, 6), x, y, 1, 1)
    elif kind == 'rings':
        for i in range(3):
            y = int(cy - ry * .6 + i * ry * .6)
            for x in range(int(cx - rx), int(cx + rx)):
                if on(x, y): p[x, y] = C(ramp, 3)
                if on(x, y + 1) and S > 1: p[x, y + 1] = C(ramp, 3)
def spikes(pc, ramp, x0, y0, x1, y1, n, size, step=4):
    """a row of wedges along a line (back spines, a crest)"""
    for i in range(n):
        t = (i + .5) / n; x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        pc.poly(ramp, [(x - size * .5, y), (x + size * .5, y), (x + size * .1, y - size * 1.3)], step, shade=False); pc.dot(C(ramp, step + 2), int(x), int(y - size * .9), 1, 1)
def plates(pc, ramp, x0, y0, x1, y1, n, size, step=3):
    for i in range(n):
        t = (i + .5) / n; x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        pc.rrect(ramp, int(x - size / 2), int(y - size * .35), int(size), int(size * .7), 1, step); pc.dot(C(ramp, step + 2), int(x - size / 2 + 1), int(y - size * .35 + 1), 1, 1)
def feather_wing(ramp, w, h, step=3, folded=True, bat=False, bug=False, accent=None):
    pc = Piece(int(w) + 4, int(h) + 4)
    if bug:
        pc.blob(accent or 'sky', pc.w * .5, pc.h * .5, w * .48, h * .46, 6, deep=False, rim=False); pc.blob(accent or 'sky', pc.w * .5, pc.h * .5, w * .3, h * .25, 7, flat=True)
        pc.line(C(accent or 'sky', 3), 2, pc.h // 2, pc.w - 3, pc.h // 2); return pc.outline()
    if bat:
        pts = [(2, 2), (pc.w - 3, pc.h * .25), (pc.w - 3, pc.h * .55), (pc.w * .7, pc.h - 3), (pc.w * .4, pc.h * .8), (pc.w * .15, pc.h * .95), (2, pc.h * .5)]
        pc.poly(ramp, pts, step)
        for k in range(1, 3): pc.line(C(ramp, step - 2), 3, 3, int(pc.w * .75 - k * 4), int(pc.h * .3 + k * pc.h * .3))
        return pc.outline()
    pc.blob(ramp, pc.w * .45, pc.h * .42, w * .46, h * .36, step, tilt=.35)
    for k in range(4):   # feather tips along the lower edge
        x = int(pc.w * .25 + k * pc.w * .17); pc.blob(ramp, x, pc.h * .72, w * .09, h * .22, step - 1 if k % 2 else step, deep=False, tilt=.3)
    pc.strokes(ramp, step - 1, [(int(pc.w * .3 + k * 3), int(pc.h * .4)) for k in range(int(w * .18))], 3)
    return pc.outline()

# ------------------------------------------------------------------ the head
def make_head(sp, S, hw, hh, stage):
    """skull + muzzle + ears + horns + crest + markings; returns the Piece, the face rectangle and the neck join point"""
    kind = sp.get('head', 'round'); body, under, acc = sp['body'], sp['under'], sp.get('accent', sp['under'])
    ext = int(hh * .5) if sp.get('trunk') else 0
    pc = Piece(int(hw + 30 * S), int(hh + 26 * S) + ext); hcx, hcy = pc.w / 2, (pc.h - ext) / 2 + 2 * S
    # neck stub (tucks under the body): drawn first so the skull covers it
    pc.blob(body, hcx + hw * .3, hcy + hh * .36, hw * .3, hh * .3, 2, deep=False, hi=False)
    fur = sp.get('fur', 1); crest = sp.get('crest')
    if crest == 'mane': pc.blob(sp.get('mane_ramp') or acc, hcx + hw * .12, hcy - hh * .3, hw * .5, hh * .42, 3, fur=2, deep=False)   # behind the skull
    if kind == 'long':   # horse, goat, deer: a long face, the muzzle below
        pc.blob(body, hcx, hcy - hh * .1, hw * .46, hh * .4, 3, fur=fur); pc.blob(body, hcx - hw * .1, hcy + hh * .3, hw * .34, hh * .32, 3)
        pc.blob(under, hcx - hw * .12, hcy + hh * .42, hw * .26, hh * .2, 4, deep=False); nose = (hcx - hw * .3, hcy + hh * .4)
    elif kind == 'snout':   # dog, bear, croc pup: a round skull and a short wide muzzle
        pc.blob(body, hcx, hcy, hw * .5, hh * .48, 3, fur=fur); pc.blob(under, hcx - hw * .08, hcy + hh * .28, hw * .36, hh * .26, 4, deep=False); nose = (hcx - hw * .3, hcy + hh * .22)
    elif kind == 'croc':   # a flat long jaw to the left
        pc.blob(body, hcx + hw * .1, hcy, hw * .42, hh * .44, 3); pc.blob(body, hcx - hw * .35, hcy + hh * .12, hw * .4, hh * .26, 3, deep=False)
        pc.blob(under, hcx - hw * .35, hcy + hh * .26, hw * .36, hh * .14, 4, deep=False, hi=False); nose = (hcx - hw * .68, hcy + hh * .05)
        for k in range(3): pc.dot(WHITE, int(hcx - hw * .55 + k * 4 * S), int(hcy + hh * .34), 1, 2)
    elif kind == 'beak':   # bird: round head, a beak wedge to the left
        pc.blob(body, hcx, hcy, hw * .48, hh * .48, 3, fur=0); bk = sp.get('beak', 'gold'); bl = hw * (.5 if sp.get('beak_long') else .3)
        pc.poly(bk, [(hcx - hw * .35, hcy - hh * .05), (hcx - hw * .35 - bl, hcy + hh * .12), (hcx - hw * .3, hcy + hh * .25)], 4, shade=True); nose = None
    elif kind == 'fish':
        pc.blob(body, hcx, hcy, hw * .5, hh * .42, 3, fur=0); pc.blob(under, hcx - hw * .1, hcy + hh * .26, hw * .3, hh * .18, 4, deep=False, flat=True); nose = None
        pc.dot(INK, int(hcx - hw * .45), int(hcy + hh * .2), int(hw * .3), 1)
    else:   # round
        pc.blob(body, hcx, hcy, hw * .5, hh * .5, 3, fur=fur); pc.blob(under, hcx - hw * .05, hcy + hh * .3, hw * .3, hh * .2, 4, deep=False, flat=True); nose = (hcx - hw * .2, hcy + hh * .25)
    for m in sp.get('headmarks', []):
        if m[0] == 'mask': pc.blob(m[1], hcx - hw * .1, hcy - hh * .05, hw * .42, hh * .2, 2, flat=True, mask=lambda x, y: pc.im.load()[x, y][3] > 0)
        elif m[0] == 'blaze': pc.blob(m[1], hcx - hw * .05, hcy - hh * .25, hw * .1, hh * .35, 5, flat=True, mask=lambda x, y: pc.im.load()[x, y][3] > 0)
        elif m[0] == 'cheeks': pc.blob(m[1], hcx - hw * .42, hcy + hh * .2, hw * .1, hh * .09, 5, flat=True); pc.blob(m[1], hcx + hw * .38, hcy + hh * .2, hw * .1, hh * .09, 5, flat=True)
        elif m[0] == 'rings': pc.blob(m[1], hcx - hw * .2, hcy - hh * .05, hw * .17, hh * .17, 1, flat=True); pc.blob(m[1], hcx + hw * .2, hcy - hh * .05, hw * .17, hh * .17, 1, flat=True)
    if nose: pc.dot(C('indigo', 1), int(nose[0]), int(nose[1]), int(3 * S), int(2 * S)); pc.dot(C('indigo', 3), int(nose[0]), int(nose[1]), 1, 1)
    ears = sp.get('ears', 'none'); ew, eh = hw * .16, hh * .2
    if ears == 'round': ear(pc, body, acc, hcx - hw * .4, hcy - hh * .42, ew * 1.1, eh * .9); ear(pc, body, acc, hcx + hw * .4, hcy - hh * .42, ew * 1.1, eh * .9)
    elif ears == 'point': ear(pc, body, acc, hcx - hw * .38, hcy - hh * .5, ew, eh * 1.5, tilt=-.4); ear(pc, body, acc, hcx + hw * .38, hcy - hh * .5, ew, eh * 1.5, tilt=.4)
    elif ears == 'long': ear(pc, body, acc, hcx - hw * .3, hcy - hh * .62, ew * .8, eh * 2.4, tilt=-.25); ear(pc, body, acc, hcx + hw * .3, hcy - hh * .62, ew * .8, eh * 2.4, tilt=.25)
    elif ears == 'flop': ear(pc, body, acc, hcx - hw * .5, hcy - hh * .05, ew * .9, eh * 1.8, tilt=.2); ear(pc, body, acc, hcx + hw * .5, hcy - hh * .05, ew * .9, eh * 1.8, tilt=-.2)
    elif ears == 'side': ear(pc, body, acc, hcx - hw * .55, hcy - hh * .15, ew * 1.6, eh * .7, tilt=-.3); ear(pc, body, acc, hcx + hw * .55, hcy - hh * .15, ew * 1.6, eh * .7, tilt=.3)
    elif ears == 'big': ear(pc, body, acc, hcx - hw * .55, hcy - hh * .1, ew * 2, eh * 2, tilt=-.2); ear(pc, body, acc, hcx + hw * .55, hcy - hh * .1, ew * 2, eh * 2, tilt=.2)
    horns = sp.get('horns'); hr = sp.get('horn_ramp', 'straw')
    if horns == 'straight': horn_straight(pc, hr, int(hcx - hw * .22), int(hcy - hh * .8), int(hh * .4), max(3, int(4 * S)), 4, lean=-2); horn_straight(pc, hr, int(hcx + hw * .22), int(hcy - hh * .8), int(hh * .4), max(3, int(4 * S)), 4, lean=2)
    elif horns == 'curl': horn_arc(pc, hr, hcx - hw * .15, hcy - hh * .05, hw * .45, 4 * S, 215, 330, 3); horn_arc(pc, hr, hcx + hw * .15, hcy - hh * .05, hw * .45, 4 * S, 210, 325, 3)
    elif horns == 'antler':
        for d in (-1, 1):
            x0 = hcx + d * hw * .25; pc.line(C(hr, 4), int(x0), int(hcy - hh * .42), int(x0 + d * hw * .25), int(hcy - hh * .95)); pc.line(C(hr, 4), int(x0 + d * hw * .1), int(hcy - hh * .66), int(x0 + d * hw * .4), int(hcy - hh * .75))
            pc.line(C(hr, 4), int(x0 + d * hw * .18), int(hcy - hh * .8), int(x0 + d * hw * .05), int(hcy - hh * 1.05)); pc.dot(C(hr, 6), int(x0 + d * hw * .25), int(hcy - hh * .95), 1, 1)
    elif horns == 'single': horn_straight(pc, hr, int(hcx), int(hcy - hh * .95), int(hh * .5), max(3, int(5 * S)), 5, lean=0)
    elif horns == 'tusks': pc.poly(hr, [(hcx - hw * .2, hcy + hh * .3), (hcx - hw * .55, hcy + hh * .55), (hcx - hw * .1, hcy + hh * .45)], 6, shade=False); pc.poly(hr, [(hcx + hw * .2, hcy + hh * .3), (hcx + hw * .55, hcy + hh * .55), (hcx + hw * .1, hcy + hh * .45)], 6, shade=False)
    elif horns == 'nose': horn_straight(pc, hr, int(hcx - hw * .3), int(hcy - hh * .15), int(hh * .38), max(3, int(5 * S)), 4, lean=-1)
    if sp.get('trunk'):   # an elephant's trunk: a thick curve down and forward from the muzzle, ringed
        tw_ = max(3, int(5 * S))
        for k in range(int(hh * .55)):
            t = k / max(1, hh * .55); x = hcx - hw * .2 - math.sin(t * 1.4) * hw * .22; y = hcy + hh * .3 + k
            pc.dot(C(body, 2 if k % 4 == 3 else 3), int(x - tw_ / 2), int(y), tw_, 1); pc.dot(C(body, 4), int(x - tw_ / 2), int(y), 1, 1)
        pc.dot(C(sp.get('accent', under), 5), int(hcx - hw * .2 - math.sin(1.4) * hw * .22 - tw_ / 2), int(hcy + hh * .3 + hh * .55), tw_, 2)
    if crest == 'plume': spikes(pc, acc, hcx - hw * .2, hcy - hh * .45, hcx + hw * .25, hcy - hh * .45, 3, hh * .28, 4)
    elif crest == 'spikes': spikes(pc, acc, hcx - hw * .15, hcy - hh * .48, hcx + hw * .35, hcy - hh * .35, 3, hh * .22, 4)
    elif crest == 'fin': pc.poly(acc, [(hcx - hw * .1, hcy - hh * .45), (hcx + hw * .1, hcy - hh * .9), (hcx + hw * .35, hcy - hh * .4)], 4)
    elif crest == 'tuft': pc.blob(acc, hcx - hw * .05, hcy - hh * .55, hw * .16, hh * .2, 4, fur=1, tilt=-.5)
    elif crest == 'beard': pc.blob(under, hcx - hw * .05, hcy + hh * .62, hw * .16, hh * .22, 3, fur=2, deep=False)
    elif crest == 'ruff': pc.blob(acc, hcx + hw * .1, hcy + hh * .45, hw * .55, hh * .25, 3, fur=2, deep=False)
    if sp.get('whiskers'):
        for d in (-1, 1):
            for k in range(2): pc.line(C(under, 6), int(hcx - hw * .2 + d * hw * .15), int(hcy + hh * .22 + k * 2), int(hcx - hw * .2 + d * hw * .5), int(hcy + hh * .15 + k * 4))
    for m in sp.get('headmarks', []):
        if m[0] == 'glow': pc.dot(C(m[1], 6), int(hcx - hw * .05), int(hcy - hh * .3), int(3 * S), int(2 * S))
    pc.outline(('indigo',) if nose else ())
    # face rectangle: eyes sit in the upper half of the skull
    fw, fh = int(hw * .66), int(hh * .5); ew_, eh_ = max(5, int(hw * .19)), max(6, int(hh * .28))
    if kind in ('beak', 'fish'): fw = int(hw * .62); eh_ = max(5, int(hh * .24))
    fx, fy = int(hcx - fw / 2 - hw * .04), int(hcy - hh * (.36 if kind not in ('beak', 'fish') else .26))
    return pc, (fx, fy, fw, fh, ew_, eh_), (int(hcx + hw * .3), int(hcy + hh * .45))

def face_for(sp, fw, fh, ew, eh, S):
    iris = sp.get('iris', 'cobalt'); kindm = sp.get('head', 'round')
    return lambda k: face(fw, fh, k, iris, ew, eh, gap=max(3, int(4 * S)), mouth=kindm in ('round', 'snout', 'long') and sp.get('mouth', True), cheeks=sp.get('cheeks'), nose=None)

# ------------------------------------------------------------------ body-plan templates
def sizes(sp, stage, nst):
    """canvas and scale: the last stage of a line fills a 128 canvas, the others sit in 96"""
    last = stage == nst - 1 and nst > 1
    S_ = 128 if (last or nst == 1) else 96
    S = {3: [.92, 1.1, 1.3], 2: [.96, 1.32], 1: [1.22]}[nst][stage] * sp.get('size', 1)
    return S_, S, S_ - 6, S_ // 2

def t_quad(sp, stage, nst):
    S_, S, base, cx = sizes(sp, stage, nst); body, under = sp['body'], sp['under']; low = sp.get('low'); stout = sp.get('stout')
    parts = {}
    tw, th = int((54 if not low else 58) * S), int((28 if not low else 20) * S * (1.15 if stout else 1)); lw, lh = int((11 if not low else 9) * S * (1.3 if stout else 1)), int((26 if not low else 14) * S)
    tx, ty = cx - tw // 2 + int((4 if not low else -6) * S), base - lh + int(9 * S) - th
    def torso(kind):
        sy = TORSO[kind]; pc = Piece(tw + 6, th + 14); ccx, ccy = tw / 2 + 3, th / 2 + 8
        quad_torso(pc, body, under, ccx, ccy, tw / 2, (th / 2) * sy, 3, hump=sp.get('hump', .1), fur=sp.get('fur', 2), mantle=sp.get('mantle', True), seed=stage * 7 + hash(sp['id']) % 97, under_ramp_step=sp.get('under_step', 4))
        for m in sp.get('marks', []): marks(pc, m[0], m[1], ccx, ccy, tw / 2, th / 2, S, seed=stage + 3)
        for e in sp.get('extras', []):
            if e[0] == 'spines': spikes(pc, e[1], ccx - tw * .35, ccy - th * .42, ccx + tw * .3, ccy - th * .36, 4 + stage, 4 * S, 4)
            elif e[0] == 'plates': plates(pc, e[1], ccx - tw * .3, ccy - th * .3, ccx + tw * .3, ccy - th * .25, 3 + stage, 6 * S, 3)
            elif e[0] == 'glowrow':
                for k in range(3 + stage): pc.dot(C(e[1], 6), int(ccx - tw * .3 + k * tw * .18), int(ccy - th * .3), int(2 * S), int(2 * S))
            elif e[0] == 'hump2': pc.blob(body, ccx - tw * .12, ccy - th * .58, tw * .14, th * .3, 3, fur=1); pc.blob(body, ccx + tw * .12, ccy - th * .58, tw * .14, th * .3, 3, fur=1)
        return pc.outline()
    parts['torso'] = part(None, (tw // 2 + 3, th // 2 + 8), tx - 3, ty - 8, 'root', 5, main={'main': torso('rest'), 'squash': torso('squash'), 'stretch': torso('stretch')})
    feet = sp.get('feet', 'hoof'); hoofr = sp.get('hoof_ramp', 'skin_deep' if feet == 'hoof' else under)
    for n, x, z, near in (('legBF', tx + tw - lw - int(10 * S), 3, False), ('legFF', tx + int(4 * S), 3, False), ('legBN', tx + tw - lw - int(3 * S), 7, True), ('legFN', tx + int(10 * S), 7, True)):
        leg = quad_leg(body, under, lw, lh, near, hoofr, 3, feet != 'claw', feet == 'hoof', shank_step=None if feet == 'hoof' else 3)
        if feet == 'claw':
            for k in range(3): leg.dot(C('stone', 6), 3 + k * max(2, lw // 3), lh - 2, 1, 2)
        parts[n] = part(leg, (lw // 2 + 2, 4), x - 2, base - lh + 2, 'torso', z, 10 - z)
    hw, hh = int((34 if not low else 30) * S), int((30 if not low else 22) * S); hp, (fx, fy, fw, fh, ew, eh), neck = make_head(sp, S, hw, hh, stage)
    hx, hy = tx - int((12 if not low else 20) * S), ty - int((8 if not low else 10) * S)
    parts['head'] = head_part(hp, neck, hx, hy, face_for(sp, fw, fh, ew, eh, S), (hx + fx, hy + fy))
    tail(sp, parts, S, tx + tw - int(6 * S), ty + int(7 * S), 'torso')
    if sp.get('wings'): wings(sp, parts, S, tx + int(8 * S), ty - int(6 * S), tw - int(16 * S), th, 'torso', big=True)
    extras(sp, parts, S, stage, cx, base, tx, ty, tw, th)
    return parts, S_, base

def t_biped(sp, stage, nst):
    S_, S, base, cx = sizes(sp, stage, nst); body, under = sp['body'], sp['under']; parts = {}
    tw, th = int(36 * S), int(38 * S); fh_ = int(10 * S); tx, ty = cx - tw // 2, base - fh_ + int(6 * S) - th
    def torso(kind):
        sy = TORSO[kind]; pc = Piece(tw + 8, th + 10); ccx, ccy = tw / 2 + 4, th / 2 + 5; rx, ry = tw / 2, (th / 2) * sy
        pc.blob(body, ccx, ccy + ry * .22, rx, ry * .78, 3); pc.blob(body, ccx, ccy - ry * .42, rx * .72, ry * .58, 3)
        pc.blob(body, ccx - rx * .9, ccy + ry * .55, rx * .36, ry * .36, 3, deep=False); pc.blob(body, ccx + rx * .9, ccy + ry * .55, rx * .36, ry * .36, 3, deep=False)
        pc.blob(under, ccx, ccy + ry * .1, rx * .58, ry * .66, 4, deep=False, hi=False)
        for m in sp.get('marks', []): marks(pc, m[0], m[1], ccx, ccy, rx, ry, S, seed=stage + 5)
        for e in sp.get('extras', []):
            if e[0] == 'spines': spikes(pc, e[1], ccx - rx * .6, ccy - ry * .9, ccx + rx * .6, ccy - ry * .9, 3 + stage, 4 * S, 4)
            elif e[0] == 'quills':
                for k in range(6 + stage * 2): spikes(pc, e[1], ccx - rx * .9 + k * rx * .3, ccy - ry * .95 + (k % 2) * 3, ccx - rx * .9 + k * rx * .3, ccy - ry * .95 + (k % 2) * 3, 1, 5 * S, 2)
        if sp.get('fur', 1): pc.fringe(2, 3, 1)
        return pc.outline()
    parts['torso'] = part(None, (tw // 2 + 4, th // 2 + 5), tx - 4, ty - 5, 'root', 5, main={'main': torso('rest'), 'squash': torso('squash'), 'stretch': torso('stretch')})
    aw, ah = int(11 * S), int(22 * S)
    for n, x, z in (('armL', tx - int(6 * S), 7), ('armR', tx + tw - aw + int(6 * S), 7)):
        a = Piece(aw + 4, ah + 4); a.blob(body, aw / 2 + 2, ah * .4, aw / 2, ah * .42, 3, fur=1); a.blob(under if sp.get('paws') else body, aw / 2 + 2, ah * .82, aw * .45, ah * .2, 4, deep=False); a.outline()
        parts[n] = part(a, (aw // 2 + 2, 4), x, ty + int(10 * S), 'torso', z, 10 - z)
    lw, lh = int(13 * S), int(14 * S)
    for n, x, z in (('legL', tx + int(4 * S), 6), ('legR', tx + tw - lw - int(4 * S), 6)):
        l = Piece(lw + 4, lh + 2); l.blob(body, lw / 2 + 2, lh * .4, lw / 2, lh * .45, 3); l.blob(under if sp.get('paws') else body, lw / 2 + 2, lh * .78, lw * .5, lh * .24, 4, deep=False)
        for k in range(3): l.dot(C('stone', 6 if sp.get('feet') == 'claw' else 2), 3 + k * max(2, lw // 3), lh - 1, 1, 1)
        l.outline(); parts[n] = part(l, (lw // 2 + 2, 2), x, base - lh - 1, 'torso', z, 10 - z)
    hw, hh = int(34 * S), int(30 * S); hp, (fx, fy, fw, fh, ew, eh), neck = make_head(sp, S, hw, hh, stage)
    hx, hy = tx - int(6 * S), ty - int(24 * S)
    parts['head'] = head_part(hp, (hp.w // 2, hp.h - int(6 * S)), hx, hy, face_for(sp, fw, fh, ew, eh, S), (hx + fx, hy + fy))
    tail(sp, parts, S, tx + tw - int(4 * S), ty + th - int(14 * S), 'torso')
    if sp.get('wings'): wings(sp, parts, S, tx, ty, tw, th, 'torso')
    extras(sp, parts, S, stage, cx, base, tx, ty, tw, th)
    return parts, S_, base

def t_bird(sp, stage, nst):
    S_, S, base, cx = sizes(sp, stage, nst); body, under = sp['body'], sp['under']; parts = {}
    tw, th = int(38 * S), int(30 * S); lh = int(10 * S); tx, ty = cx - tw // 2 + int(2 * S), base - lh + int(4 * S) - th
    def torso(kind):
        sy = TORSO[kind]; pc = Piece(tw + 8, th + 8); ccx, ccy = tw / 2 + 4, th / 2 + 4; rx, ry = tw / 2, (th / 2) * sy
        pc.blob(body, ccx, ccy, rx, ry, 3, tilt=.2); pc.blob(under, ccx - rx * .15, ccy + ry * .3, rx * .55, ry * .5, 4, deep=False, hi=False)
        pc.strokes(body, 2, [(int(ccx - rx * .6 + k * 3), int(ccy - ry * .2 + (k % 3))) for k in range(int(rx * .4))], 2)
        for m in sp.get('marks', []): marks(pc, m[0], m[1], ccx, ccy, rx, ry, S, seed=stage + 7)
        pc.fringe(2, 3, 1); return pc.outline()
    parts['torso'] = part(None, (tw // 2 + 4, th // 2 + 4), tx - 4, ty - 4, 'root', 5, main={'main': torso('rest'), 'squash': torso('squash'), 'stretch': torso('stretch')})
    lw = int(5 * S); legr = sp.get('leg_ramp', 'gold')
    for n, x, z in (('legL', tx + int(10 * S), 4), ('legR', tx + tw - int(14 * S), 6)):
        l = Piece(lw + 8, lh + 4); l.rrect(legr, 4, 0, lw, lh, 1, 3, shade=False); l.dot(C(legr, 2), 4 + lw - 1, 0, 1, lh)
        for k in range(3): l.line(C(legr, 3), 4 + lw // 2, lh, 1 + k * (lw + 2), lh + 3)
        l.outline(); parts[n] = part(l, (lw // 2 + 4, 1), x, base - lh - 3, 'torso', z, 10 - z)
    ww, wh = int(24 * S), int(20 * S)
    for n, x, z, fl in (('wingL', tx - int(8 * S), 6, False), ('wingR', tx + tw - ww + int(8 * S), 4, True)):
        w = feather_wing(sp.get('wing_ramp', body), ww, wh, 3)
        if fl: w = w.flip()
        parts[n] = part(w, (ww // 2 + 2 if not fl else ww // 2 + 2, 3), x, ty + int(4 * S), 'torso', z, 10 - z)
    hw, hh = int(26 * S), int(24 * S); sp2 = dict(sp); sp2['head'] = 'beak'; hp, (fx, fy, fw, fh, ew, eh), neck = make_head(sp2, S, hw, hh, stage)
    hx, hy = tx - int(4 * S), ty - int(20 * S)
    parts['head'] = head_part(hp, (hp.w // 2, hp.h - int(5 * S)), hx, hy, face_for(sp2, fw, fh, ew, eh, S), (hx + fx, hy + fy))
    tl = Piece(int(18 * S), int(12 * S))
    for k in range(3): tl.blob(sp.get('tail_ramp', body), tl.w * .6, tl.h * .3 + k * tl.h * .22, tl.w * .38, tl.h * .14, 3 if k % 2 else 2, deep=False, tilt=.35)
    tl.outline(); parts['tail'] = part(tl, (2, tl.h // 2), tx + tw - int(6 * S), ty + th - int(14 * S), 'torso', 3, 8)
    extras(sp, parts, S, stage, cx, base, tx, ty, tw, th)
    return parts, S_, base

def t_serpent(sp, stage, nst):
    S_, S, base, cx = sizes(sp, stage, nst); body, under = sp['body'], sp['under']; parts = {}; n = 3 + (1 if stage >= 2 else 0)
    cw, ch = int(50 * S), int(18 * S); cxp, cyp = cx - cw // 2, base - ch
    coil = Piece(cw + 6, ch + 6); coil.blob(body, cw / 2 + 3, ch / 2 + 3, cw / 2, ch / 2, 3); coil.blob(body, cw * .28 + 3, ch * .4 + 3, cw * .26, ch * .34, 3, deep=False); coil.blob(under, cw / 2 + 3, ch * .7 + 3, cw * .4, ch * .2, 4, flat=True)
    for m in sp.get('marks', []): marks(coil, m[0], m[1], cw / 2 + 3, ch / 2 + 3, cw / 2, ch / 2, S, seed=stage)
    coil.outline(); parts['coil'] = part(coil, (cw // 2 + 3, ch // 2 + 3), cxp - 3, cyp - 3, 'root', 2, 2)
    sw, sh = int(16 * S), int(14 * S); x, y = cxp + int(8 * S), cyp - sh + int(6 * S); par = 'coil'
    for i in range(n):
        seg = Piece(sw + 4, sh + 4); seg.blob(body, sw / 2 + 2, sh / 2 + 2, sw / 2, sh / 2, 3, deep=False); seg.blob(under, sw / 2 + 2, sh * .7 + 2, sw * .34, sh * .2, 4, flat=True)
        for e in sp.get('extras', []):
            if e[0] == 'glowrow': seg.dot(C(e[1], 6), sw // 2, 3, int(3 * S), int(2 * S))
            if e[0] == 'rings': seg.dot(C(e[1], 3), 3, sh // 2 + 2, sw - 2, 1)
        seg.outline(); parts[f'n{i}'] = part(seg, (sw // 2 + 2, sh - 2), x, y, par, 3 + i, 3 + i); par = f'n{i}'; y -= sh - int(5 * S); x += int((6 if i % 2 == 0 else -9) * S)
    hw, hh = int(26 * S), int(20 * S); hp, (fx, fy, fw, fh, ew, eh), neck = make_head(sp, S, hw, hh, stage)
    hx, hy = x - int(14 * S), y - hh + int(6 * S)
    parts['head'] = head_part(hp, (hp.w // 2 + int(6 * S), hp.h - int(6 * S)), hx, hy, face_for(sp, fw, fh, ew, eh, S), (hx + fx, hy + fy)); parts['head']['par'] = par
    tl = Piece(int(22 * S), int(10 * S)); tl.blob(body, tl.w * .4, tl.h * .5, tl.w * .4, tl.h * .3, 3, deep=False, tilt=-.15); tl.blob(sp.get('accent', under), tl.w * .85, tl.h * .4, tl.w * .14, tl.h * .2, 5, flat=True); tl.outline()
    parts['tail'] = part(tl, (2, tl.h // 2), cxp + cw - int(8 * S), cyp + int(4 * S), 'coil', 1, 1)
    extras(sp, parts, S, stage, cx, base, cxp, cyp, cw, ch)
    return parts, S_, base, {'n': n}

def t_shell(sp, stage, nst):
    S_, S, base, cx = sizes(sp, stage, nst); body, under, shr = sp['body'], sp['under'], sp.get('shell_ramp', 'olive'); parts = {}
    bw, bh = int(44 * S), int(18 * S); bx, by = cx - bw // 2, base - bh - int(2 * S)
    bd = Piece(bw + 6, bh + 6); bd.blob(body, bw / 2 + 3, bh / 2 + 3, bw / 2, bh / 2, 3); bd.blob(under, bw / 2 + 3, bh * .65 + 3, bw * .4, bh * .25, 4, flat=True); bd.outline()
    parts['body'] = part(bd, (bw // 2 + 3, bh // 2 + 3), bx - 3, by - 3, 'root', 3, 3)
    sw, sh = int(46 * S), int(26 * S); sx, sy = cx - sw // 2 + int(2 * S), by - sh + int(10 * S)
    def shell(kind):
        k = TORSO[kind]; pc = Piece(sw + 6, sh + 6); pc.blob(shr, sw / 2 + 3, sh * .55 + 3, sw / 2, sh * .5 * k, 3)
        for i in range(3): pc.blob(shr, sw * (.3 + i * .2) + 3, sh * .4 + 3, sw * .09, sh * .2, 4, deep=False, hi=False)
        for e in sp.get('extras', []):
            if e[0] == 'glowrow':
                for i in range(3): pc.dot(C(e[1], 6), int(sw * (.3 + i * .2) + 3), int(sh * .4 + 3), int(2 * S), int(2 * S))
            if e[0] == 'spines': spikes(pc, e[1], sw * .2, sh * .15, sw * .8, sh * .15, 4, 4 * S, 4)
        pc.dot(C(shr, 1), 4, int(sh * .78 + 3), sw - 2, 1); return pc.outline()
    parts['shell'] = part(None, (sw // 2 + 3, sh // 2 + 3), sx - 3, sy - 3, 'root', 6, 6, main={'main': shell('rest'), 'squash': shell('squash'), 'stretch': shell('stretch')})
    lw, lh = int(10 * S), int(9 * S)
    for n, x, z in (('l1', bx + int(2 * S), 4), ('l2', bx + bw - lw - int(2 * S), 4), ('l3', bx + bw // 2 - lw // 2, 2)):
        l = Piece(lw + 4, lh + 2); l.blob(body, lw / 2 + 2, lh / 2, lw / 2, lh / 2, 3, deep=False)
        for k in range(3): l.dot(C('stone', 6), 3 + k * max(2, lw // 3), lh - 1, 1, 1)
        l.outline(); parts[n] = part(l, (lw // 2 + 2, 2), x, base - lh - 1, 'root', z, z)
    aw, ah = int(9 * S), int(12 * S)
    for n, x, z in (('armL', bx - int(2 * S), 7), ('armR', bx + bw - aw + int(2 * S), 7)):
        a = Piece(aw + 4, ah + 2); a.blob(body, aw / 2 + 2, ah / 2, aw / 2, ah / 2, 3, deep=False); a.outline(); parts[n] = part(a, (aw // 2 + 2, 2), x, by + int(2 * S), 'body', z, 10 - z)
    hw, hh = int(24 * S), int(22 * S); hp, (fx, fy, fw, fh, ew, eh), neck = make_head(sp, S, hw, hh, stage)
    hx, hy = bx - int(10 * S), by - hh - int(2 * S)
    parts['head'] = head_part(hp, (hp.w // 2 + int(4 * S), hp.h - int(6 * S)), hx, hy, face_for(sp, fw, fh, ew, eh, S), (hx + fx, hy + fy)); parts['head']['par'] = 'body'
    extras(sp, parts, S, stage, cx, base, bx, by, bw, bh)
    return parts, S_, base

def t_insect(sp, stage, nst):
    S_, S, base, cx = sizes(sp, stage, nst); body, under, acc = sp['body'], sp['under'], sp.get('accent', sp['under']); parts = {}; spider = sp.get('spider'); stick = sp.get('stick')
    tw, th = int((30 if not stick else 50) * S), int((22 if not stick else 8) * S); lh = int(12 * S); tx, ty = cx - tw // 2, base - lh - th + int(4 * S)
    def torso(kind):
        k = TORSO[kind]; pc = Piece(tw + 6, th + 6); pc.blob(body, tw / 2 + 3, th / 2 + 3, tw / 2, th / 2 * k, 3)
        if not stick: pc.dot(C(body, 1), 4, th // 2 + 3, tw - 2, 1)
        for m in sp.get('marks', []): marks(pc, m[0], m[1], tw / 2 + 3, th / 2 + 3, tw / 2, th / 2, S, seed=stage + 9)
        for e in sp.get('extras', []):
            if e[0] == 'rivets':
                for i in range(4 + stage): pc.dot(C(e[1], 5), int(6 + i * (tw - 8) / (3 + stage)), int(th * .3 + 3), int(2 * S), int(2 * S))
            if e[0] == 'spines': spikes(pc, e[1], tw * .2, 3, tw * .8, 3, 3 + stage, 4 * S, 4)
        return pc.outline()
    parts['torso'] = part(None, (tw // 2 + 3, th // 2 + 3), tx - 3, ty - 3, 'root', 5, main={'main': torso('rest'), 'squash': torso('squash'), 'stretch': torso('stretch')})
    aw, ah = int((24 if spider else 20) * S), int((20 if spider else 16) * S)
    ab = Piece(aw + 6, ah + 6); ab.blob(body, aw / 2 + 3, ah / 2 + 3, aw / 2, ah / 2, 3); ab.blob(under, aw / 2 + 3, ah * .7 + 3, aw * .35, ah * .2, 4, flat=True)
    for m in sp.get('marks', []): marks(ab, m[0], m[1], aw / 2 + 3, ah / 2 + 3, aw / 2, ah / 2, S, seed=stage + 11)
    ab.outline(); parts['abdomen'] = part(ab, (4, ah // 2 + 3), tx + tw - int(6 * S), ty + th // 2 - ah // 2, 'torso', 4, 4)
    legs = 4 if spider else 3; ll = int(14 * S)
    for i in range(legs):
        for side, d, z in (('L', -1, 7), ('R', 1, 3)):
            l = Piece(ll + 4, lh + 4)
            for o in range(max(2, int(2 * S))): l.line(C(body, 3 if o else 2), 2, 2 + o, ll // 2 + 2, lh // 2 + 2 + o); l.line(C(body, 3 if o else 2), ll // 2 + 2, lh // 2 + 2 + o, ll + 1, lh + 1 + o)
            l.outline()
            if side == 'L': l = l.flip()
            x = tx + int(tw * (.15 + i * .3)) + (0 if side == 'R' else -ll); parts[f'leg{side}{i}'] = part(l, (ll + 1 if side == 'L' else 2, 2), x, ty + th - int(4 * S) + i, 'torso', z, 10 - z)
    hw, hh = int(22 * S), int(20 * S); hp, (fx, fy, fw, fh, ew, eh), neck = make_head(sp, S, hw, hh, stage)
    hx, hy = tx - int(14 * S), ty - int(8 * S)
    parts['head'] = head_part(hp, (hp.w // 2 + int(6 * S), hp.h // 2 + int(2 * S)), hx, hy, face_for(sp, fw, fh, ew, eh, S), (hx + fx, hy + fy))
    for side, d in (('L', -1), ('R', 1)):
        an = Piece(int(10 * S) + 2, int(12 * S) + 2); an.line(C(acc, 4), an.w // 2, an.h - 2, an.w // 2 + d * (an.w // 2 - 2), 2); an.dot(C(acc, 6), an.w // 2 + d * (an.w // 2 - 2), 1, 2, 2)
        parts[f'ant{side}'] = part(an, (an.w // 2, an.h - 2), hx + hp.w // 2 - an.w // 2 + d * int(4 * S), hy + int(2 * S), 'head', 10, 10)
    if sp.get('wings'): wings(sp, parts, S, tx, ty, tw, th, 'torso', bug=True)
    extras(sp, parts, S, stage, cx, base, tx, ty, tw, th)
    return parts, S_, base

def t_fish(sp, stage, nst):
    S_, S, base, cx = sizes(sp, stage, nst); body, under, acc = sp['body'], sp['under'], sp.get('accent', sp['under']); parts = {}
    lift = int(14 * S); tw, th = int(50 * S), int(26 * S); tx, ty = cx - tw // 2, base - lift - th
    parts['fly'] = bone_only(cx, base - lift, 'root')
    def torso(kind):
        k = TORSO[kind]; pc = Piece(tw + 6, th + 6); pc.blob(body, tw / 2 + 3, th / 2 + 3, tw / 2, th / 2 * k, 3, tilt=.08); pc.blob(under, tw * .45 + 3, th * .68 + 3, tw * .4, th * .22, 4, deep=False, flat=True)
        pc.poly(body, [(tw * .35, 3), (tw * .5, th * .5 - th * .55 * k), (tw * .62, 3)], 3)   # dorsal fin
        for k2 in range(2): pc.line(C(body, 2), int(tw * .15 + k2 * 4 * S), int(th * .45 + 3), int(tw * .15 + k2 * 4 * S), int(th * .62 + 3))   # gill lines
        for m in sp.get('marks', []): marks(pc, m[0], m[1], tw / 2 + 3, th / 2 + 3, tw / 2, th / 2, S, seed=stage + 13)
        return pc.outline()
    parts['torso'] = part(None, (tw // 2 + 3, th // 2 + 3), tx - 3, ty - 3, 'fly', 5, main={'main': torso('rest'), 'squash': torso('squash'), 'stretch': torso('stretch')})
    tl = Piece(int(18 * S), int(22 * S)); tl.poly(body, [(2, tl.h * .5), (tl.w - 2, 2), (tl.w * .6, tl.h * .5), (tl.w - 2, tl.h - 2)], 3); tl.outline()
    parts['tail'] = part(tl, (2, tl.h // 2), tx + tw - int(4 * S), ty + th // 2 - tl.h // 2, 'torso', 4, 4)
    fw_, fh_ = int(14 * S), int(10 * S)
    for n, x, z, fl in (('wingL', tx + int(8 * S), 7, False), ('wingR', tx + int(18 * S), 3, True)):
        f = Piece(fw_ + 4, fh_ + 4); f.poly(body, [(2, 2), (fw_ + 2, fh_ * .3 + 2), (fw_ * .4 + 2, fh_ + 2)], 3)
        if fl: f = f.flip()
        f.outline(); parts[n] = part(f, (2 if not fl else fw_ + 2, 2), x, ty + th - int(6 * S), 'torso', z, 10 - z)
    hw, hh = int(26 * S), int(22 * S); sp2 = dict(sp); sp2['head'] = 'fish'; hp, (fx, fy, fw, fh, ew, eh), neck = make_head(sp2, S, hw, hh, stage)
    hx, hy = tx - int(8 * S), ty - int(2 * S)
    parts['head'] = head_part(hp, (hp.w - int(8 * S), hp.h // 2), hx, hy, face_for(sp2, fw, fh, ew, eh, S), (hx + fx, hy + fy))
    extras(sp, parts, S, stage, cx, base, tx, ty, tw, th)
    return parts, S_, base, {'lift': lift, 'bh': th * .3}

def t_hopper(sp, stage, nst):
    S_, S, base, cx = sizes(sp, stage, nst); body, under = sp['body'], sp['under']; parts = {}
    tw, th = int(40 * S), int(26 * S); tx, ty = cx - tw // 2, base - th - int(6 * S)
    def torso(kind):
        k = TORSO[kind]; pc = Piece(tw + 6, th + 6); pc.blob(body, tw / 2 + 3, th / 2 + 3, tw / 2, th / 2 * k, 3); pc.blob(under, tw / 2 + 3, th * .7 + 3, tw * .4, th * .25, 4, deep=False, hi=False)
        for m in sp.get('marks', []): marks(pc, m[0], m[1], tw / 2 + 3, th / 2 + 3, tw / 2, th / 2, S, seed=stage + 17)
        return pc.outline()
    parts['torso'] = part(None, (tw // 2 + 3, th // 2 + 3), tx - 3, ty - 3, 'root', 5, main={'main': torso('rest'), 'squash': torso('squash'), 'stretch': torso('stretch')})
    thw, thh = int(16 * S), int(14 * S)
    for n, x, z, fl in (('thighL', tx - int(6 * S), 6, False), ('thighR', tx + tw - thw + int(6 * S), 6, True)):
        t = Piece(thw + 4, thh + 4); t.blob(body, thw / 2 + 2, thh / 2 + 2, thw / 2, thh / 2, 3, tilt=.4 if not fl else -.4); t.outline()
        parts[n] = part(t, (thw // 2 + 2, 3), x, base - thh - int(4 * S), 'torso', z, 10 - z)
        f = Piece(int(16 * S), int(6 * S) + 2); f.blob(under, f.w * .45, f.h * .5, f.w * .45, f.h * .4, 4, deep=False)
        for k in range(3): f.dot(C(under, 2), int(f.w * .15 + k * f.w * .25), f.h - 2, 1, 1)
        if fl: f = f.flip()
        f.outline(); parts['foot' + n[-1]] = part(f, (f.w // 2, 2), x + (0 if not fl else thw - f.w + 4), base - f.h, n, z - 1, 10 - z)
    aw, ah = int(7 * S), int(14 * S)
    for n, x, z in (('armL', tx + int(4 * S), 7), ('armR', tx + tw - aw - int(4 * S), 7)):
        a = Piece(aw + 4, ah + 4); a.blob(body, aw / 2 + 2, ah / 2 + 2, aw / 2, ah / 2, 3, deep=False); a.outline(); parts[n] = part(a, (aw // 2 + 2, 3), x, ty + th - int(8 * S), 'torso', z, 10 - z)
    hw, hh = int(36 * S), int(24 * S); hp, (fx, fy, fw, fh, ew, eh), neck = make_head(sp, S, hw, hh, stage)
    hx, hy = tx - int(4 * S), ty - int(16 * S)
    parts['head'] = head_part(hp, (hp.w // 2, hp.h - int(6 * S)), hx, hy, face_for(sp, fw, fh, ew, eh, S), (hx + fx, hy + fy))
    if sp.get('ears') in ('long',):   # ears as their own pieces so the hopper plan can move them
        for n, d in (('earL', -1), ('earR', 1)):
            e = Piece(int(8 * S) + 4, int(18 * S) + 4); e.blob(body, e.w / 2, e.h / 2, int(4 * S), int(9 * S), 3, tilt=d * .2); e.blob(sp.get('accent', under), e.w / 2, e.h / 2, int(2 * S), int(6 * S), 4, flat=True, tilt=d * .2); e.outline()
            parts[n] = part(e, (e.w // 2, e.h - 3), hx + hp.w // 2 - e.w // 2 + d * int(9 * S), hy + int(2 * S), 'head', 10, 10)
    tail(sp, parts, S, tx + tw - int(6 * S), ty + th - int(10 * S), 'torso')
    extras(sp, parts, S, stage, cx, base, tx, ty, tw, th)
    return parts, S_, base

def t_plant(sp, stage, nst):
    S_, S, base, cx = sizes(sp, stage, nst); body, under, acc = sp['body'], sp['under'], sp.get('accent', 'rose'); parts = {}
    sw, sh = int(10 * S), int(30 * S); sx, sy = cx - sw // 2, base - sh - int(2 * S)
    def torso(kind):
        k = TORSO[kind]; pc = Piece(sw + 6, sh + 6); pc.rrect(body, 3, 3 + int(sh * (1 - k)), sw, int(sh * k), 3, 3)
        for i in range(3): pc.dot(C(body, 2), 4, 6 + i * sh // 3, sw - 2, 1)
        return pc.outline()
    parts['torso'] = part(None, (sw // 2 + 3, sh + 3), sx - 3, sy - 3, 'root', 5, main={'main': torso('rest'), 'squash': torso('squash'), 'stretch': torso('stretch')})
    pot = Piece(int(28 * S), int(10 * S)); pot.blob(under, pot.w * .35, pot.h * .5, pot.w * .3, pot.h * .4, 3, deep=False); pot.blob(under, pot.w * .68, pot.h * .55, pot.w * .3, pot.h * .36, 3, deep=False); pot.outline()
    parts['pot'] = part(pot, (pot.w // 2, pot.h - 2), cx - pot.w // 2, base - pot.h, 'root', 1, 1)
    lw, lh = int(18 * S), int(9 * S)
    for i in range(2 + (1 if stage >= 1 else 0)):
        for side, d in (('L', -1), ('R', 1)):
            l = Piece(lw + 4, lh + 4); l.blob(body, lw / 2 + 2, lh / 2 + 2, lw / 2, lh / 2, 4 if i % 2 else 3, tilt=d * .3, deep=False); l.line(C(body, 1), 2, lh // 2 + 2, lw + 1, lh // 2 + 2)
            l.outline(); parts[f'leaf{side}{i}'] = part(l, (lw + 2 if d < 0 else 2, lh // 2 + 2), sx + (sw // 2 - lw - 2 if d < 0 else sw // 2 - 2), sy + int(sh * (.75 - i * .25)) - lh // 2, 'torso', 4 + i, 4 + i)
    hw, hh = int(34 * S), int(30 * S); sp2 = dict(sp); sp2['head'] = 'round'; sp2['ears'] = 'none'; hp, (fx, fy, fw, fh, ew, eh), neck = make_head(sp2, S, hw, hh, stage)
    pet = sp.get('petals', 6)
    if pet:   # petals round the head
        pp = Piece(hp.w, hp.h); hcx, hcy = hp.w / 2, hp.h / 2 + 2 * S
        for i in range(pet):
            a = i / pet * 2 * math.pi - math.pi / 2; pp.blob(acc, hcx + math.cos(a) * hw * .5, hcy + math.sin(a) * hh * .5, hw * .2, hh * .16, 4 if i % 2 else 5, deep=False, tilt=a)
        pp.outline(); pp.im.alpha_composite(hp.im); hp = pp
    hx, hy = sx + sw // 2 - hp.w // 2, sy - hh - int(6 * S)
    parts['head'] = head_part(hp, (hp.w // 2, hp.h - int(6 * S)), hx, hy, face_for(sp2, fw, fh, ew, eh, S), (hx + fx, hy + fy))
    extras(sp, parts, S, stage, cx, base, sx, sy, sw, sh)
    return parts, S_, base

def t_blob(sp, stage, nst):
    S_, S, base, cx = sizes(sp, stage, nst); body, under, acc = sp['body'], sp['under'], sp.get('accent', sp['under']); parts = {}
    hw, hh = int(44 * S), int(40 * S); lift = int(sp.get('hover', 6) * S)
    sp2 = dict(sp); sp2['head'] = 'round'; hp, (fx, fy, fw, fh, ew, eh), neck = make_head(sp2, S, hw, hh, stage)
    if sp.get('glass'):   # a marble: a highlight arc and a see-through sheen
        hp.blob(acc, hp.w * .38, hp.h * .3, hw * .14, hh * .08, 7, flat=True, tilt=-.6)
    hx, hy = cx - hp.w // 2, base - lift - hp.h + int(4 * S)
    parts['head'] = head_part(hp, (hp.w // 2, hp.h - int(6 * S)), hx, hy, face_for(sp2, fw, fh, ew, eh, S), (hx + fx, hy + fy)); parts['head']['par'] = 'root'
    if sp.get('arms', True):
        aw, ah = int(8 * S), int(12 * S)
        for n, x, z in (('armL', hx - int(2 * S), 7), ('armR', hx + hp.w - aw - int(2 * S), 7)):
            a = Piece(aw + 4, ah + 4); a.blob(body, aw / 2 + 2, ah / 2 + 2, aw / 2, ah / 2, 3, deep=False); a.outline(); parts[n] = part(a, (aw // 2 + 2, 3), x, hy + hp.h // 2, 'head', z, 10 - z)
    extras(sp, parts, S, stage, cx, base, hx, hy, hp.w, hp.h)
    return parts, S_, base

def t_crab(sp, stage, nst):
    S_, S, base, cx = sizes(sp, stage, nst); body, under, acc = sp['body'], sp['under'], sp.get('accent', sp['under']); parts = {}; lob = sp.get('lobster')
    tw, th = int((36 if not lob else 44) * S), int((22 if not lob else 18) * S); tx, ty = cx - tw // 2, base - th - int(6 * S)
    def torso(kind):
        k = TORSO[kind]; pc = Piece(tw + 6, th + 6); pc.blob(body, tw / 2 + 3, th / 2 + 3, tw / 2, th / 2 * k, 3); pc.blob(under, tw / 2 + 3, th * .7 + 3, tw * .4, th * .2, 4, flat=True)
        if lob:
            for i in range(4): pc.dot(C(body, 2), int(tw * .5 + i * tw * .12) + 3, 4, 1, th - 2)
        for m in sp.get('marks', []): marks(pc, m[0], m[1], tw / 2 + 3, th / 2 + 3, tw / 2, th / 2, S, seed=stage + 19)
        for e in sp.get('extras', []):
            if e[0] == 'shellhouse': pc.blob(e[1], tw * .68 + 3, th * .2 + 3, tw * .34, th * .5, 3); pc.blob(e[1], tw * .6 + 3, th * .25 + 3, tw * .14, th * .22, 2, flat=True)
        return pc.outline()
    parts['torso'] = part(None, (tw // 2 + 3, th // 2 + 3), tx - 3, ty - 3, 'root', 5, main={'main': torso('rest'), 'squash': torso('squash'), 'stretch': torso('stretch')})
    cw, chh = int(16 * S), int(14 * S)
    for n, x, z, fl in (('clawL', tx - cw + int(4 * S), 7, False), ('clawR', tx + tw - int(4 * S), 7, True)):
        c = Piece(cw + 4, chh + 4); c.blob(body, cw * .55 + 2, chh * .55 + 2, cw * .42, chh * .42, 3); c.poly(body, [(2, 2), (cw * .5, chh * .3), (cw * .3, chh * .6)], 4); c.dot(C(body, 0), int(cw * .25), int(chh * .35), int(cw * .3), 1)
        if fl: c = c.flip()
        c.outline(); parts[n] = part(c, (cw + 1 if not fl else 2, chh // 2 + 2), x, ty + int(2 * S), 'torso', z, 10 - z)
    ll = int(12 * S); lh = int(8 * S)
    for i in range(4):
        for side, d, z in (('L', -1, 6), ('R', 1, 4)):
            l = Piece(ll + 4, lh + 4)
            for o in range(max(2, int(2 * S))): l.line(C(body, 3 if o else 2), 2, 2 + o, ll // 2 + 2, lh + 1 + o); l.line(C(body, 3 if o else 2), ll // 2 + 2, lh + 1 + o, ll + 1, lh + 1 + o)
            l.outline()
            if side == 'L': l = l.flip()
            x = tx + int(tw * (.05 + i * .25)) + (0 if side == 'R' else -ll // 2); parts[f'leg{side}{i}'] = part(l, (ll + 1 if side == 'L' else 2, 2), x, ty + th - int(6 * S) + (i % 2) * 2, 'torso', z, 10 - z)
    hw, hh = int(22 * S), int(16 * S); sp2 = dict(sp); sp2['head'] = 'round'; hp, (fx, fy, fw, fh, ew, eh), neck = make_head(sp2, S, hw, hh, stage)
    hx, hy = tx + tw // 2 - hp.w // 2 - int(4 * S), ty - int(10 * S)
    parts['head'] = head_part(hp, (hp.w // 2, hp.h - int(6 * S)), hx, hy, face_for(sp2, fw, fh, ew, eh, S), (hx + fx, hy + fy))
    for side, d in (('L', -1), ('R', 1)):
        st = Piece(int(6 * S) + 2, int(10 * S) + 2); st.dot(C(body, 3), st.w // 2 - 1, 2, 2, st.h - 2); st.blob(acc, st.w / 2, 3, 2.5 * S, 2.5 * S, 5, deep=False); st.outline()
        parts[f'eye{side}'] = part(st, (st.w // 2, st.h - 2), hx + hp.w // 2 - st.w // 2 + d * int(7 * S), hy + int(2 * S), 'head', 10, 10)
    extras(sp, parts, S, stage, cx, base, tx, ty, tw, th)
    return parts, S_, base

def t_flyer(sp, stage, nst):
    S_, S, base, cx = sizes(sp, stage, nst); body, under, acc = sp['body'], sp['under'], sp.get('accent', sp['under']); parts = {}
    lift = int(16 * S); tw, th = int(26 * S), int(30 * S); tx, ty = cx - tw // 2, base - lift - th
    parts['fly'] = bone_only(cx, base - lift, 'root')
    def torso(kind):
        k = TORSO[kind]; pc = Piece(tw + 6, th + 6); pc.blob(body, tw / 2 + 3, th / 2 + 3, tw / 2, th / 2 * k, 3, fur=2); pc.blob(under, tw / 2 + 3, th * .6 + 3, tw * .36, th * .3, 4, deep=False, hi=False)
        for m in sp.get('marks', []): marks(pc, m[0], m[1], tw / 2 + 3, th / 2 + 3, tw / 2, th / 2, S, seed=stage + 23)
        return pc.outline()
    parts['torso'] = part(None, (tw // 2 + 3, th // 2 + 3), tx - 3, ty - 3, 'fly', 5, main={'main': torso('rest'), 'squash': torso('squash'), 'stretch': torso('stretch')})
    wings(sp, parts, S, tx, ty, tw, th, 'torso', big=True)
    lw, lh = int(6 * S), int(8 * S)
    for n, x, z in (('legL', tx + int(4 * S), 6), ('legR', tx + tw - lw - int(4 * S), 6)):
        l = Piece(lw + 4, lh + 2); l.blob(body, lw / 2 + 2, lh / 2, lw / 2, lh / 2, 3, deep=False); l.outline(); parts[n] = part(l, (lw // 2 + 2, 2), x, ty + th - int(4 * S), 'torso', z, 10 - z)
    hw, hh = int(30 * S), int(26 * S); hp, (fx, fy, fw, fh, ew, eh), neck = make_head(sp, S, hw, hh, stage)
    hx, hy = tx + tw // 2 - hp.w // 2, ty - hh + int(4 * S)
    parts['head'] = head_part(hp, (hp.w // 2, hp.h - int(6 * S)), hx, hy, face_for(sp, fw, fh, ew, eh, S), (hx + fx, hy + fy))
    extras(sp, parts, S, stage, cx, base, tx, ty, tw, th)
    return parts, S_, base, {'lift': lift, 'per': 420, 'flapAmp': .35}

# ------------------------------------------------------------------ shared add-ons
def tail(sp, parts, S, x, y, par):
    kind = sp.get('tail', 'tuft'); body, under, acc = sp['body'], sp['under'], sp.get('accent', sp['under']); tr = sp.get('tail_ramp', body)
    if kind == 'none': return
    if kind == 'tuft': tl = Piece(int(16 * S), int(16 * S)); tl.blob(tr, tl.w * .5, tl.h * .45, tl.w * .42, tl.h * .3, 2, fur=1, tilt=-.5); tl.blob(under, tl.w * .72, tl.h * .55, tl.w * .2, tl.h * .18, 4, flat=True)
    elif kind == 'long': tl = Piece(int(26 * S), int(14 * S)); tl.blob(tr, tl.w * .45, tl.h * .5, tl.w * .45, tl.h * .28, 3, tilt=-.12); tl.blob(acc, tl.w * .88, tl.h * .42, tl.w * .1, tl.h * .14, 5, flat=True)
    elif kind == 'bushy': tl = Piece(int(26 * S), int(20 * S)); tl.blob(tr, tl.w * .5, tl.h * .5, tl.w * .46, tl.h * .4, 3, fur=2, tilt=-.3); tl.blob(under, tl.w * .8, tl.h * .4, tl.w * .14, tl.h * .2, 5, flat=True)
    elif kind == 'flat': tl = Piece(int(30 * S), int(14 * S)); tl.blob(tr, tl.w * .5, tl.h * .5, tl.w * .48, tl.h * .4, 3, tilt=-.1); [tl.line(C(tr, 2), int(tl.w * .2 + k * 5 * S), 3, int(tl.w * .2 + k * 5 * S) + 3, tl.h - 3) for k in range(4)]
    elif kind == 'fan':
        tl = Piece(int(28 * S), int(26 * S))
        for k in range(5): a = -.9 + k * .45; tl.blob(acc if k % 2 else tr, tl.w * .55 + math.cos(a) * tl.w * .25, tl.h * .5 + math.sin(a) * tl.h * .3, tl.w * .3, tl.h * .1, 4, deep=False, tilt=a); tl.dot(C('cobalt', 4), int(tl.w * .55 + math.cos(a) * tl.w * .42), int(tl.h * .5 + math.sin(a) * tl.h * .5), 2, 2)
    elif kind == 'flame': tl = Piece(int(16 * S), int(18 * S)); flame(tl, tl.w / 2, tl.h * .55, tl.w * .36); tl.outline(('ember', 'gold')); parts['tail'] = part(tl, (2, tl.h // 2), x, y, par, 11, 11); return
    elif kind == 'cord':
        tl = Piece(int(30 * S), int(16 * S)); p = tl.im.load()
        for i in range(tl.w - 4):
            yy = tl.h / 2 + math.sin(i / 2.2) * tl.h * .28
            for k in range(max(2, int(3 * S))): tl.dot(C(tr, 3 if k else 4), 2 + i, int(yy) + k, 1, 1)
    elif kind == 'stub': tl = Piece(int(10 * S), int(10 * S)); tl.blob(tr, tl.w * .5, tl.h * .5, tl.w * .4, tl.h * .35, 3, fur=1)
    elif kind == 'fluke': tl = Piece(int(24 * S), int(18 * S)); tl.blob(tr, tl.w * .3, tl.h * .5, tl.w * .3, tl.h * .2, 3); tl.poly(tr, [(tl.w * .5, tl.h * .5), (tl.w - 2, 2), (tl.w * .7, tl.h * .5), (tl.w - 2, tl.h - 2)], 3)
    elif kind == 'spiral': tl = Piece(int(20 * S), int(20 * S)); horn_arc(tl, tr, tl.w * .5, tl.h * .5, tl.w * .42, 4 * S, 100, 400, 3, tip_step=5)
    elif kind == 'club': tl = Piece(int(26 * S), int(16 * S)); tl.blob(tr, tl.w * .35, tl.h * .5, tl.w * .35, tl.h * .2, 3); tl.blob(acc, tl.w * .82, tl.h * .5, tl.w * .17, tl.h * .4, 4)
    else: return
    tl.outline(); parts['tail'] = part(tl, (3, tl.h // 2), x, y, par, 4, 8)

def wings(sp, parts, S, tx, ty, tw, th, par, big=False, bug=False):
    kind = sp.get('wings', 'feather'); body = sp.get('wing_ramp', sp['body']); ww, wh = (int(34 * S), int(26 * S)) if big else (int(22 * S), int(16 * S))
    for n, x, z, fl in (('wingL', tx - ww + int(6 * S), 3, False), ('wingR', tx + tw - int(6 * S), 3, True)):
        w = feather_wing(body, ww, wh, 3, bat=kind == 'bat', bug=bug or kind == 'bug', accent=sp.get('accent'))
        if not fl: w = w.flip()
        parts[n] = part(w, (ww + 1 if not fl else 2, 4), x, ty + int(4 * S), par, z, 10 - z)

def extras(sp, parts, S, stage, cx, base, tx, ty, tw, th):
    """loose pieces round the body: a glow, a cloud, a pebble, a pair of birds, a puddle"""
    for e in sp.get('extras', []):
        k = e[0]
        if k == 'cloud':
            cl = Piece(int(70 * S), int(20 * S)); cl.blob(e[1], cl.w * .5, cl.h * .62, cl.w * .48, cl.h * .36, 6, deep=False); cl.blob(e[1], cl.w * .25, cl.h * .5, cl.w * .2, cl.h * .42, 7, flat=True); cl.blob(e[1], cl.w * .65, cl.h * .42, cl.w * .24, cl.h * .46, 7, flat=True); cl.outline()
            parts['cloud'] = part(cl, (cl.w // 2, 4), cx - cl.w // 2 + int(4 * S), base - int(14 * S), 'root', 0, 0)
        elif k == 'puddle':
            pu = Piece(int(54 * S), int(10 * S)); pu.blob(e[1], pu.w * .5, pu.h * .5, pu.w * .48, pu.h * .4, 4, flat=True); pu.blob(e[1], pu.w * .4, pu.h * .4, pu.w * .2, pu.h * .15, 6, flat=True); pu.outline()
            parts['puddle'] = part(pu, (pu.w // 2, pu.h // 2), cx - pu.w // 2, base - pu.h // 2 - 1, 'root', 0, 0)
        elif k == 'birds':
            for i, (x, y) in enumerate(((cx - int(40 * S), ty - int(10 * S)), (cx + int(36 * S), ty - int(16 * S)))):
                bd = Piece(int(10 * S), int(8 * S)); bd.blob(e[1], bd.w / 2, bd.h / 2, bd.w / 2 - 1, bd.h / 2 - 1, 4, flat=True); bd.dot(C('gold', 4), bd.w - 3, bd.h // 2, 2, 1); bd.outline()
                parts[f'bird{i}'] = part(bd, (bd.w // 2, bd.h // 2), x, y, 'root', 12, 12)
        elif k == 'pebble':
            pb = Piece(int(12 * S), int(10 * S)); pb.blob(e[1], pb.w / 2, pb.h / 2, pb.w * .42, pb.h * .4, 4); pb.outline()
            parts['pebble'] = part(pb, (pb.w // 2, pb.h // 2), tx + int(4 * S), base - pb.h + 1, 'root', 9, 9)
        elif k == 'sparks':
            for i in range(2):
                sk = Piece(int(8 * S), int(8 * S)); sk.dot(C(e[1], 6), sk.w // 2 - 1, 1, 2, sk.h - 2); sk.dot(C(e[1], 6), 1, sk.h // 2 - 1, sk.w - 2, 2); sk.dot(C(e[1], 7), sk.w // 2 - 1, sk.h // 2 - 1, 2, 2)
                parts[f'spark{i}'] = part(sk, (sk.w // 2, sk.h // 2), tx + tw + int(2 * S) - i * (tw + int(12 * S)), ty - int(4 * S) + i * int(10 * S), 'root', 12, 12)
        elif k == 'leaf':
            lf = Piece(int(12 * S), int(8 * S)); lf.blob('leaf', lf.w / 2, lf.h / 2, lf.w * .45, lf.h * .35, 4, deep=False, tilt=-.4); lf.line(C('leaf', 1), 2, lf.h - 3, lf.w - 3, 2); lf.outline()
            parts['leaf'] = part(lf, (lf.w // 2, 2), tx - int(6 * S), ty + int(10 * S), 'head', 10, 10)
        elif k == 'shellback':
            sh = Piece(int(34 * S), int(20 * S)); sh.blob(e[1], sh.w / 2, sh.h * .55, sh.w * .48, sh.h * .45, 3); horn_arc(sh, e[1], sh.w * .62, sh.h * .5, sh.w * .3, 3 * S, 180, 500, 3, tip_step=4); sh.outline()
            parts['shell'] = part(sh, (sh.w // 2, sh.h - 2), tx + tw // 2 - sh.w // 2 + int(6 * S), ty - sh.h + int(8 * S), 'torso', 6, 6)
        elif k == 'back_tree':   # a tree of screens, a library: a mound with a crown, as a back piece (plants grown on a back)
            bt = Piece(int(40 * S), int(34 * S)); bt.rrect('skin_deep', bt.w // 2 - int(3 * S), int(12 * S), int(6 * S), bt.h - int(12 * S), 1, 3); bt.blob(e[1], bt.w / 2, int(12 * S), bt.w * .45, int(11 * S), 3, fur=1); bt.blob(e[1], bt.w * .3, int(16 * S), bt.w * .2, int(6 * S), 4, deep=False); bt.outline()
            parts['tree'] = part(bt, (bt.w // 2, bt.h - 2), tx + tw // 2 - bt.w // 2 + int(8 * S), ty + int(6 * S), 'torso', 2, 9)
        elif k == 'houseback':   # a mound of rock/earth carried on the back
            hb = Piece(int(36 * S), int(22 * S)); hb.blob(e[1], hb.w / 2, hb.h * .6, hb.w * .48, hb.h * .4, 3); hb.blob(e[1], hb.w * .5, hb.h * .35, hb.w * .3, hb.h * .3, 4, deep=False); hb.outline()
            parts['mound'] = part(hb, (hb.w // 2, hb.h - 2), tx + tw // 2 - hb.w // 2 + int(6 * S), ty - hb.h + int(10 * S), 'torso', 2, 9)
        elif k == 'tuftback':
            tb = Piece(int(24 * S), int(14 * S)); tb.blob(e[1], tb.w / 2, tb.h * .6, tb.w * .45, tb.h * .4, 3, fur=2); tb.outline()
            parts['mane'] = part(tb, (tb.w // 2, tb.h - 2), tx + int(8 * S), ty - tb.h + int(8 * S), 'torso', 2, 9)

TEMPLATES = {'quad': t_quad, 'lizard': t_quad, 'biped': t_biped, 'bird': t_bird, 'serpent': t_serpent, 'shell': t_shell, 'insect': t_insect, 'fish': t_fish, 'hopper': t_hopper, 'plant': t_plant, 'blob': t_blob, 'crab': t_crab, 'flyer': t_flyer}
PLAN_OF = {'lizard': 'quad'}
ROLES = {'quad': {'torso': 'body'}, '*': {'cloud': 'hover', 'puddle': 'hover', 'bird0': 'hover', 'bird1': 'hover', 'spark0': 'hover', 'spark1': 'hover', 'pebble': 'hover', 'leaf': 'head', 'mound': 'mane', 'tree': 'mane', 'mane': 'mane'}}

# ------------------------------------------------------------------ the lines
# one dict per line: ids (one per stage) and a spec, with per-stage overrides in 'stages' (a list of dicts)
def L(line, ids, **spec): spec['line'] = line; spec['ids'] = ids; return spec
LINES = [
 # three-stage lines
 L('huang', ['siliclet', 'jenzard', 'gigajenzard'], plan='lizard', low=True, body='leaf', under='straw', accent='mint', iris='gold', head='round', ears='none', tail='long', feet='claw', fur=0, mantle=False,
   stages=[dict(extras=[('plates', 'mint')]), dict(extras=[('plates', 'mint'), ('spines', 'leaf')], crest='spikes'), dict(body='pine', extras=[('plates', 'mint'), ('spines', 'pine'), ('sparks', 'mint')], crest='spikes', marks=[('glow', 'mint')])]),
 L('ellison', ['ternlet', 'regatern', 'islatern'], plan='bird', body='stone', under='stone', accent='cobalt', iris='cobalt', wing_ramp='stone', leg_ramp='ember', beak='ember', headmarks=[('mask', 'indigo')],
   stages=[dict(size=.9, under_step=6), dict(marks=[('saddle', 'indigo')]), dict(marks=[('saddle', 'indigo')], extras=[('houseback', 'olive')], beak_long=True)]),
 L('ma', ['sesamander', 'taobaomander', 'alibabamander'], plan='lizard', low=True, body='ember', under='gold', accent='crimson', iris='teal', head='round', ears='none', tail='long', feet='claw', fur=0, mantle=False, marks=[('spots', 'gold')],
   stages=[dict(size=.9), dict(crest='fin', extras=[('spines', 'crimson')]), dict(body='crimson', crest='fin', extras=[('spines', 'ember'), ('plates', 'gold')], tail='flame')]),
 L('walton', ['pupcart', 'vestbull', 'waltonbull'], plan='quad', body='skin', under='skin', accent='rose', iris='cobalt', head='snout', ears='flop', tail='stub', feet='paw', hump=.05, fur=1, under_step=5,
   stages=[dict(size=.9, cheeks='rose'), dict(marks=[('patch', 'cobalt')], cheeks='rose'), dict(body='skin_deep', marks=[('patch', 'cobalt'), ('saddle', 'stone')], extras=[('houseback', 'stone')], stout=True)]),
 L('bloomberg', ['tickerbud', 'bloomburst', 'terminalia'], plan='plant', body='leaf', under='skin_deep', accent='ember', iris='gold',
   stages=[dict(petals=0, size=.9, headmarks=[('blaze', 'mint')]), dict(petals=6, accent='ember', headmarks=[('glow', 'ember')]), dict(petals=8, accent='ember', extras=[('back_tree', 'leaf')], headmarks=[('glow', 'ember')])]),
 L('jobs', ['seedpip', 'turtleneck', 'realitydistortoise'], plan='shell', body='olive', under='straw', accent='indigo', iris='teal', head='round', ears='none', shell_ramp='skin_deep',
   stages=[dict(plan='blob', body='skin_deep', under='skin', hover=2, arms=False, headmarks=[('blaze', 'leaf')], size=.8), dict(headmarks=[('mask', 'indigo')], shell_ramp='olive'), dict(shell_ramp='violet', extras=[('glowrow', 'orchid')], headmarks=[('mask', 'indigo')])]),
 L('knight', ['laceling', 'swooshare', 'nikeknight'], plan='hopper', body='straw', under='skin', accent='ember', iris='cobalt', head='round', ears='long', tail='cord', tail_ramp='ember', cheeks='rose',
   stages=[dict(size=.85), dict(wings='feather', marks=[('patch', 'ember')]), dict(body='steel', under='stone', wings='feather', marks=[('patch', 'ember')], extras=[('spines', 'steel')])]),
 L('kroc', ['frylet', 'patticroc', 'krocodile'], plan='lizard', low=True, body='pine', under='straw', accent='gold', iris='gold', head='croc', ears='none', tail='long', feet='claw', fur=0, mantle=False,
   stages=[dict(size=.9, marks=[('spots', 'gold')]), dict(marks=[('saddle', 'straw'), ('stripes', 'pine')], extras=[('spines', 'olive')]), dict(body='olive', marks=[('saddle', 'straw'), ('stripes', 'olive')], extras=[('spines', 'gold'), ('plates', 'gold')], horns='tusks', horn_ramp='gold')]),
 L('ambani', ['tuskling', 'reliancephant', 'antiliaphant'], plan='quad', stout=True, trunk=True, body='stone', under='stone', accent='rose', iris='teal', head='snout', ears='big', tail='cord', tail_ramp='stone', feet='paw', fur=0, hump=.02, mantle=False, under_step=4,
   stages=[dict(size=.85, headmarks=[('glow', 'sky')]), dict(horns='tusks', horn_ramp='steel', marks=[('saddle', 'crimson')]), dict(horns='tusks', horn_ramp='steel', marks=[('saddle', 'crimson')], extras=[('houseback', 'stone'), ('plates', 'steel')])]),
 L('ortega', ['spoolspider', 'zaraknid', 'ortegaweaver'], plan='insect', spider=True, body='indigo', under='violet', accent='rose', iris='rose', head='round', ears='none',
   stages=[dict(size=.9, marks=[('spots', 'rose')]), dict(marks=[('patch', 'rose'), ('stripes', 'violet')]), dict(body='violet', under='indigo', marks=[('patch', 'rose'), ('stripes', 'indigo')], extras=[('spines', 'rose')])]),
 L('hughes', ['gosling', 'sprucegoose', 'aviatorgoose'], plan='bird', body='stone', under='stone', accent='straw', iris='sky', wing_ramp='skin_deep', leg_ramp='ember', beak='ember', under_step=6, headmarks=[('rings', 'skin_deep')],
   stages=[dict(size=.9, body='straw', under='straw', wing_ramp='straw'), dict(tail_ramp='skin_deep'), dict(tail_ramp='skin_deep', marks=[('stripes', 'skin_deep')], beak_long=True, extras=[('tuftback', 'skin_deep')])]),
 L('carnegie', ['rivetle', 'girderbeetle', 'carnegiant'], plan='insect', body='steel', under='stone', accent='rust', iris='ember', head='round', ears='none', extras=[('rivets', 'rust')],
   stages=[dict(size=.85), dict(horns='straight', horn_ramp='steel', extras=[('rivets', 'rust'), ('spines', 'steel')]), dict(body='rust', horns='straight', horn_ramp='steel', extras=[('rivets', 'steel'), ('spines', 'steel')], marks=[('saddle', 'steel')])]),
 L('lauren', ['polofoal', 'laurenpony', 'ralphorse'], plan='quad', body='skin_deep', under='skin', accent='cobalt', iris='cobalt', head='long', ears='point', tail='long', tail_ramp='indigo', feet='hoof', hoof_ramp='indigo', hump=.0, mantle=False, fur=0,
   stages=[dict(size=.9, marks=[('patch', 'cobalt')]), dict(crest='mane', mane_ramp='indigo', marks=[('patch', 'cobalt')]), dict(body='rust', crest='mane', mane_ramp='indigo', marks=[('patch', 'cobalt'), ('saddle', 'crimson')], tail='bushy')]),
 L('ford', ['foalt', 'modeltee', 'fordhorse'], plan='quad', body='straw', under='skin', accent='steel', iris='steel', head='long', ears='point', tail='cord', tail_ramp='steel', feet='hoof', hoof_ramp='steel', hump=.0, mantle=False, fur=0,
   stages=[dict(size=.9), dict(body='indigo', under='steel', crest='mane', mane_ramp='steel', marks=[('belly', 'steel')]), dict(body='indigo', under='steel', crest='mane', mane_ramp='steel', marks=[('belly', 'steel')], extras=[('plates', 'steel'), ('sparks', 'ember')])]),
 L('slim', ['cordlet', 'telmexnake', 'slimboa'], plan='serpent', body='cobalt', under='sky', accent='gold', iris='gold', head='round', ears='none', extras=[('rings', 'sky')],
   stages=[dict(size=.9), dict(marks=[('rings', 'indigo')], extras=[('rings', 'sky'), ('glowrow', 'gold')]), dict(body='indigo', under='cobalt', marks=[('rings', 'cobalt')], extras=[('rings', 'sky'), ('glowrow', 'gold'), ('sparks', 'gold')], crest='fin')]),
 # two-stage lines (the first eight)
 L('cuban', ['pupfin', 'sharktank'], plan='fish', body='steel', under='sky', accent='cobalt', iris='cobalt', head='fish',
   stages=[dict(size=.9), dict(marks=[('stripes', 'cobalt')], extras=[('sparks', 'gold')])]),
 L('pagebrin', ['sniffpup', 'pagebrinhound'], plan='quad', body='straw', under='skin', accent='cobalt', iris='cobalt', head='snout', ears='flop', tail='tuft', feet='paw', hump=.05, fur=1, cheeks='rose',
   stages=[dict(size=.9, marks=[('spots', 'cobalt')]), dict(marks=[('spots', 'cobalt'), ('patch', 'crimson')], ears='long')]),
 L('thiel', ['seerlet', 'palantiel'], plan='blob', body='sky', under='sky', accent='violet', iris='violet', glass=True, arms=False, hover=6, mouth=False,
   stages=[dict(size=.85), dict(plan='insect', spider=True, body='indigo', under='sky', accent='violet', head='round', marks=[('glow', 'violet')], headmarks=[('glow', 'violet')])]),
 L('dorsey', ['tweetfinch', 'blockfinch'], plan='bird', body='sky', under='skin', accent='indigo', iris='indigo', beak='gold', leg_ramp='gold', crest='beard',
   stages=[dict(size=.85), dict(body='cobalt', wing_ramp='indigo', marks=[('patch', 'skin')], extras=[('pebble', 'stone')])]),
 L('ek', ['shufflet', 'spotifrog'], plan='hopper', body='leaf', under='mint', accent='indigo', iris='indigo', head='round', ears='none', cheeks='mint', tail='fluke',
   stages=[dict(plan='fish', size=.85, head='fish', tail='fluke', marks=[('spots', 'mint')]), dict(marks=[('spots', 'indigo')], tail='none', headmarks=[('rings', 'indigo')])]),
 L('son', ['softpup', 'visionhound'], plan='quad', body='stone', under='stone', accent='sky', iris='ember', head='snout', ears='point', tail='bushy', feet='paw', hump=.05, fur=2, under_step=7,
   stages=[dict(size=.9, body='stone', under_step=7), dict(crest='ruff', marks=[('glow', 'sky')], headmarks=[('glow', 'sky')])]),
 L('buterin', ['etherfoal', 'vitalicorn'], plan='quad', body='sky', under='sky', accent='violet', iris='violet', head='long', ears='point', tail='long', tail_ramp='violet', feet='hoof', hoof_ramp='violet', hump=.0, mantle=False, fur=0, under_step=6,
   stages=[dict(size=.85, marks=[('glow', 'violet')]), dict(horns='single', horn_ramp='violet', crest='mane', mane_ramp='violet', marks=[('glow', 'violet'), ('stripes', 'sky')])]),
 L('saylor', ['hodlcalf', 'saylorbull'], plan='quad', body='straw', under='skin', accent='ember', iris='ember', head='snout', ears='side', tail='tuft', feet='hoof', hump=.12, fur=1,
   stages=[dict(size=.9, extras=[('pebble', 'ember')], headmarks=[('blaze', 'ember')]), dict(body='indigo', under='straw', horns='curl', horn_ramp='straw', extras=[('pebble', 'ember'), ('sparks', 'ember')], headmarks=[('glow', 'ember')], marks=[('belly', 'straw')])]),
 # the last twelve two-stage lines
 L('winklevoss', ['scullet', 'winklevossel'], plan='biped', body='skin_deep', under='skin', accent='cobalt', iris='cobalt', head='round', ears='round', tail='flat', paws=True, whiskers=True,
   stages=[dict(size=.9, marks=[('belly', 'skin')]), dict(marks=[('belly', 'skin'), ('stripes', 'cobalt')], extras=[('tuftback', 'skin_deep')])]),
 L('jayz', ['jaylet', 'hovajay'], plan='bird', body='cobalt', under='sky', accent='indigo', iris='indigo', beak='steel', leg_ramp='steel', crest='plume', headmarks=[('mask', 'indigo')],
   stages=[dict(size=.85), dict(tail_ramp='indigo', marks=[('stripes', 'indigo')], extras=[('sparks', 'gold')])]),
 L('woods', ['cublet', 'tigerwoods'], plan='quad', body='ember', under='skin', accent='indigo', iris='gold', head='snout', ears='round', tail='tuft', tail_ramp='ember', feet='paw', fur=2, hump=.05, marks=[('stripes', 'indigo')], whiskers=True,
   stages=[dict(size=.9, cheeks='rose'), dict(body='crimson', marks=[('stripes', 'indigo'), ('belly', 'skin')], extras=[('pebble', 'skin')])]),
 L('lebron', ['cubron', 'lebrion'], plan='quad', body='straw', under='skin', accent='rust', iris='ember', head='snout', ears='round', tail='tuft', tail_ramp='straw', feet='paw', fur=2, hump=.08, whiskers=True,
   stages=[dict(size=.9, headmarks=[('blaze', 'rust')], extras=[('cloud', 'stone')]), dict(crest='mane', mane_ramp='rust', marks=[('belly', 'skin')], extras=[('cloud', 'stone'), ('sparks', 'gold')])]),
 L('spielberg', ['clapperbeaver', 'spielbeaver'], plan='biped', body='rust', under='skin_deep', accent='indigo', iris='cobalt', head='round', ears='round', tail='flat', tail_ramp='indigo', paws=True,
   stages=[dict(size=.9), dict(marks=[('belly', 'skin_deep')], extras=[('cloud', 'sky'), ('birds', 'indigo')])]),
 L('dyson', ['snufflet', 'dysonteater'], plan='quad', body='stone', under='skin', accent='orchid', iris='orchid', head='long', ears='round', tail='bushy', feet='claw', fur=2, hump=.12, mantle=True,
   stages=[dict(size=.9, headmarks=[('glow', 'orchid')]), dict(body='indigo', under='stone', marks=[('rings', 'orchid')], headmarks=[('glow', 'orchid')], extras=[('sparks', 'orchid')])]),
 L('kamprad', ['flatpackrat', 'kamprat'], plan='biped', body='straw', under='skin', accent='cobalt', iris='cobalt', head='snout', ears='big', tail='cord', tail_ramp='skin', paws=True, whiskers=True,
   stages=[dict(size=.85, marks=[('patch', 'cobalt')]), dict(marks=[('patch', 'cobalt'), ('belly', 'gold')], cheeks='rust', extras=[('pebble', 'stone')])]),
 L('mateschitz', ['canlet', 'redbullwing'], plan='quad', body='cobalt', under='steel', accent='crimson', iris='crimson', head='snout', ears='side', tail='tuft', feet='hoof', hoof_ramp='steel', hump=.14, fur=1, marks=[('stripes', 'steel')],
   stages=[dict(size=.85), dict(horns='straight', horn_ramp='crimson', wings='feather', wing_ramp='crimson', extras=[('sparks', 'crimson')])]),
 L('rinehart', ['orelet', 'rinewombat'], plan='quad', stout=True, body='skin_deep', under='skin', accent='rust', iris='ember', head='snout', ears='round', tail='stub', feet='claw', fur=2, hump=.02, mantle=False,
   stages=[dict(size=.9, extras=[('pebble', 'rust')]), dict(marks=[('saddle', 'rust')], extras=[('pebble', 'rust'), ('plates', 'gold')], crest='tuft')]),
 L('dangote', ['sacklet', 'dangoterhino'], plan='quad', stout=True, body='stone', under='stone', accent='straw', iris='teal', head='snout', ears='round', tail='cord', tail_ramp='leaf', feet='paw', fur=0, hump=.05, mantle=False, under_step=5,
   stages=[dict(size=.9, horns='nose', horn_ramp='stone', extras=[('pebble', 'stone')]), dict(horns='nose', horn_ramp='stone', marks=[('saddle', 'steel')], extras=[('houseback', 'steel'), ('plates', 'stone')])]),
 L('yanai', ['clawlet', 'uniqlobster'], plan='crab', lobster=True, body='crimson', under='skin', accent='rose', iris='indigo',
   stages=[dict(size=.85), dict(body='indigo', under='stone', marks=[('stripes', 'steel')])]),
 L('kashing', ['portcrane', 'kashingcrane'], plan='bird', body='stone', under='skin', accent='rose', iris='rose', beak='ember', leg_ramp='ember', beak_long=True, headmarks=[('blaze', 'crimson')],
   stages=[dict(size=.9, marks=[('spots', 'rose')]), dict(body='steel', wing_ramp='stone', extras=[('plates', 'steel')], marks=[('stripes', 'stone')])]),
 # the eighteen singles
 L('mittal', ['mittalion'], plan='quad', body='steel', under='stone', accent='ember', iris='ember', head='snout', ears='round', tail='flame', feet='paw', fur=0, hump=.1, crest='mane', mane_ramp='ember', extras=[('plates', 'steel'), ('sparks', 'ember')], stages=[dict()]),
 L('dalio', ['dalhog'], plan='biped', body='skin_deep', under='skin', accent='straw', iris='cobalt', head='snout', ears='round', tail='stub', paws=True, extras=[('quills', 'straw'), ('pebble', 'stone')], stages=[dict()]),
 L('griffin', ['citagriffin'], plan='quad', body='straw', under='skin', accent='cobalt', iris='cobalt', head='beak', beak='gold', ears='point', tail='tuft', feet='claw', fur=1, hump=.1, wings='feather', wing_ramp='stone', extras=[('houseback', 'stone')], stages=[dict()]),
 L('schultz', ['sirenbucks'], plan='fish', body='pine', under='mint', accent='leaf', iris='leaf', head='fish', crest='mane', mane_ramp='leaf', marks=[('stripes', 'leaf')], extras=[('pebble', 'skin')], stages=[dict()]),
 L('chesky', ['cheskycrab'], plan='crab', body='rose', under='skin', accent='rose', iris='cobalt', extras=[('shellhouse', 'straw')], stages=[dict()]),
 L('hastings', ['bingebat'], plan='flyer', body='crimson', under='rose', accent='indigo', iris='indigo', head='round', ears='point', wings='bat', wing_ramp='crimson', marks=[('belly', 'rose')], stages=[dict()]),
 L('altman', ['altmowl'], plan='bird', body='skin_deep', under='skin', accent='sky', iris='sky', beak='gold', leg_ramp='gold', crest='tuft', headmarks=[('rings', 'skin')], extras=[('cloud', 'sky')], stages=[dict()]),
 L('newell', ['gabenwalrus'], plan='quad', stout=True, body='skin_deep', under='skin', accent='steel', iris='cobalt', head='snout', ears='none', tail='fluke', feet='paw', fur=0, hump=.05, mantle=False, horns='tusks', horn_ramp='skin', whiskers=True, extras=[('puddle', 'sky'), ('sparks', 'steel')], stages=[dict()]),
 L('yiming', ['tiktokferret'], plan='biped', body='stone', under='skin', accent='rose', iris='rose', head='snout', ears='round', tail='long', paws=True, marks=[('rings', 'rose')], headmarks=[('glow', 'rose'), ('mask', 'indigo')], extras=[('sparks', 'teal')], stages=[dict()]),
 L('ponyma', ['tencentaur'], plan='bird', body='indigo', under='skin', accent='sky', iris='sky', beak='gold', leg_ramp='gold', wing_ramp='indigo', marks=[('belly', 'skin')], crest='ruff', extras=[('pebble', 'gold')], stages=[dict()]),
 L('dell', ['delldeer'], plan='quad', body='skin_deep', under='skin', accent='sky', iris='sky', head='long', ears='point', tail='stub', feet='hoof', hoof_ramp='indigo', hump=.0, mantle=False, fur=1, horns='antler', horn_ramp='steel', marks=[('spots', 'skin')], extras=[('sparks', 'sky')], stages=[dict()]),
 L('ballmer', ['ballmerilla'], plan='biped', body='indigo', under='skin_deep', accent='ember', iris='ember', head='snout', ears='round', tail='none', paws=True, size=1.15, marks=[('belly', 'skin_deep')], headmarks=[('cheeks', 'rose')], extras=[('cloud', 'stone'), ('sparks', 'ember')], stages=[dict()]),
 L('federer', ['federswan'], plan='bird', body='skin', under='skin', accent='ember', iris='cobalt', beak='ember', leg_ramp='steel', beak_long=True, under_step=6, headmarks=[('mask', 'ember')], crest='tuft', stages=[dict()]),
 L('ronaldo', ['siucock'], plan='bird', body='teal', under='sky', accent='leaf', iris='gold', beak='gold', leg_ramp='gold', crest='plume', wing_ramp='cobalt', tail_ramp='leaf', extras=[('tuftback', 'leaf'), ('sparks', 'gold')], stages=[dict()]),
 L('forrest', ['forrestick'], plan='insect', stick=True, body='rust', under='leaf', accent='leaf', iris='leaf', head='round', ears='none', extras=[('rivets', 'stone'), ('spines', 'leaf')], stages=[dict()]),
 L('scott', ['scottelican'], plan='bird', body='skin', under='straw', accent='gold', iris='cobalt', beak='gold', leg_ramp='gold', beak_long=True, under_step=6, extras=[('pebble', 'gold'), ('sparks', 'gold')], stages=[dict()]),
 L('hershey', ['hersheymoose'], plan='quad', body='skin_deep', under='rust', accent='straw', iris='cobalt', head='long', ears='side', tail='stub', feet='hoof', hoof_ramp='indigo', hump=.14, fur=1, horns='antler', horn_ramp='straw', crest='beard', extras=[('houseback', 'rust')], stages=[dict()]),
 L('vanderbilt', ['vanderbolt'], plan='serpent', body='steel', under='stone', accent='ember', iris='ember', head='round', ears='none', crest='fin', marks=[('rings', 'ember')], extras=[('rings', 'stone'), ('glowrow', 'ember'), ('cloud', 'stone')], stages=[dict()]),
 # the two legendaries: canvas 128, oversized, one feature breaking the edge (the smoke cloud, the wings)
 L('rockefeller', ['oilympus'], plan='biped', body='stone', under='indigo', accent='ember', iris='ember', head='snout', ears='none', tail='none', size=1.25, feet='claw', fur=0, horns='straight', horn_ramp='steel', marks=[('glow', 'ember'), ('stripes', 'indigo')], headmarks=[('rings', 'gold'), ('glow', 'ember')], extras=[('spines', 'steel'), ('cloud', 'indigo'), ('sparks', 'ember'), ('puddle', 'indigo')], stages=[dict()]),
 L('mansa', ['aurumansa'], plan='quad', body='gold', under='straw', accent='ember', iris='ember', head='long', ears='point', tail='long', tail_ramp='gold', feet='hoof', hoof_ramp='rust', size=1.2, hump=.1, fur=1, horns='curl', horn_ramp='rust', crest='spikes', wings='feather', wing_ramp='gold', marks=[('glow', 'gold')], extras=[('hump2', 'gold'), ('puddle', 'gold'), ('sparks', 'gold')], stages=[dict()]),
]

def spec_for(line, stage):
    sp = {k: v for k, v in line.items() if k not in ('stages', 'ids')}; sp.update(line['stages'][stage]); sp['id'] = line['ids'][stage]; return sp

def draw(line, stage):
    sp = spec_for(line, stage); nst = len(line['ids']); fn = TEMPLATES[sp['plan']]; r = fn(sp, stage, nst)
    parts, canvas, base = r[0], r[1], r[2]; q = r[3] if len(r) > 3 else {}
    return sp, parts, canvas, base, q

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--force', action='store_true'); ap.add_argument('--only'); ap.add_argument('--sheet'); a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True); rigs = {}; made = 0; thumbs = []; have = bss.read_rigs_next()
    only = set(a.only.split(',')) if a.only else None
    for line in LINES:
        if only and line['line'] not in only: continue
        for st in range(len(line['ids'])):
            sp, parts, canvas, base, q = draw(line, st); sid = sp['id']; plan = PLAN_OF.get(sp['plan'], sp['plan'])
            bss.ROLES = {**bss.ROLES, **ROLES, plan: {**ROLES.get(plan, {}), **bss.ROLES.get(plan, {})}}
            sheet, lay, meta = build(sid, parts, canvas, base, plan)
            for g in ('front', 'back'):
                meta[g]['q'] = dict(q) if q else ({'lift': 0, 'flapMs': 300} if plan == 'biped' else {}); meta[g]['geo']['lift'] = q.get('lift', 0) if q else 0
            f = OUT / f'{sid}.png'; fresh = a.force or not f.exists(); key = f"{line['line']}{st}"
            if fresh:
                sheet.save(f); (OUT / f'{sid}.json').write_text(json.dumps(lay, separators=(',', ':'))); made += 1
            if fresh or key not in have: rigs[key] = meta
            comp = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
            for n in sorted(parts, key=lambda n: parts[n]['z']):
                if parts[n].get('noimg'): continue
                comp.alpha_composite(parts[n]['pc']['main'].im, (parts[n]['px'], parts[n]['py']))
            comp.alpha_composite(parts['head']['face_fn']('idle').im, parts['head']['face_at']); thumbs.append((sid, comp))
    bss.write_rigs_next(rigs)
    print(f'{made} sheets written, {len(rigs)} rigs -> rigs-next.js')
    if a.sheet:
        z = 2; cell = 128 * z + 12; cols = 6; rows = (len(thumbs) + cols - 1) // cols
        sh = Image.new('RGB', (cols * cell, rows * cell), (226, 222, 214)); d = ImageDraw.Draw(sh)
        for i, (sid, comp) in enumerate(thumbs):
            cx, cy = (i % cols) * cell, (i // cols) * cell; c2 = comp.resize((comp.width * z, comp.height * z), Image.NEAREST); sh.paste(c2, (cx + (cell - c2.width) // 2, cy + cell - c2.height - 14), c2); d.text((cx + 6, cy + cell - 12), sid, fill=(40, 40, 50))
        Path(a.sheet).parent.mkdir(parents=True, exist_ok=True); sh.save(a.sheet); print(a.sheet)

if __name__ == '__main__':
    main()
