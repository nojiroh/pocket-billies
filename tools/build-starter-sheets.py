#!/usr/bin/env python3
"""v36: the twelve starter species as puppet piece sheets (Black/White style) in the style guide's rules, painted by
tools/pixkit.py: four-tone cel shading lit from the top left, rim light, fur fringes, sel-out outlines, big anime eyes
with two highlights, brows that carry the expression, and a prop or two per species that says who it parodies.
~20 pieces per species on ONE sheet with a layout JSON, four face pieces (composited onto four heads), a three-step torso
(rest, squashed, stretched), the back view and a 64x64 portrait. Writes game/art/next/billionaires/<name>.png, .json,
_gold.png and game/art/next/rigs-next.js. A sheet that exists is kept (paint over it by hand); --force remakes it.

    python3 tools/build-starter-sheets.py [--force] [--sheet validation/v36-starters.png]"""
import argparse, json, math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixkit import *
import numpy as np
from PIL import Image, ImageDraw

OUT = NEXT / 'billionaires'

def part(pc, pivot, px, py, par='torso', z=5, zb=None, back=True, main=None):
    return {'pc': main or {'main': pc}, 'pivot': pivot, 'px': px, 'py': py, 'par': par, 'z': z, 'zb': z if zb is None else zb, 'back': back}
def bone_only(px, py, par='root'):
    """v38: a bone without a picture (the 'fly' hover bone of fish and fliers): its pivot is its position"""
    return {'pc': {}, 'pivot': (0, 0), 'px': px, 'py': py, 'par': par, 'z': 0, 'zb': 0, 'back': True, 'noimg': True}
def _pw(p): return p['pc']['main'].w if 'main' in p['pc'] else 0

def head_part(pc, pivot, px, py, face_fn, face_at, z=9):
    d = part(pc, pivot, px, py, 'torso', z); d['face'] = True; d['face_fn'] = face_fn; d['face_at'] = face_at; return d

# ======================= shared anatomy helpers =======================
import random
def quad_torso(pc, ramp, under, ccx, ccy, rx, ry, step=3, hump=.0, fur=2, mantle=True, seed=1, under_ramp_step=4):
    """a four-legged body from three overlapping blobs: a shoulder hump at the left, a round belly, a rump at the right;
    a darker mantle along the back, a pale undercoat under the belly, fur strokes, a fringed hem"""
    pc.blob(ramp, ccx + rx * .45, ccy + ry * .05, rx * .55, ry * .82, step)                  # rump
    pc.blob(ramp, ccx - rx * .38, ccy - ry * (.1 + hump), rx * .62, ry * .95, step)          # shoulders (higher: the hump)
    pc.blob(ramp, ccx + rx * .05, ccy + ry * .18, rx * .72, ry * .78, step)                  # belly
    if mantle: pc.blob(ramp, ccx - rx * .1, ccy - ry * .55, rx * .8, ry * .42, step - 1, flat=True)
    pc.blob(under, ccx + rx * .1, ccy + ry * .55, rx * .62, ry * .34, under_ramp_step, deep=False, hi=False, flat=True)
    rng = random.Random(seed)
    pc.strokes(ramp, step - 2, [(int(ccx - rx * .75 + rng.random() * rx * 1.5), int(ccy - ry * .3 + rng.random() * ry * .8)) for _ in range(int(rx * .5))], 3)
    pc.strokes(under, under_ramp_step - 1, [(int(ccx - rx * .3 + rng.random() * rx), int(ccy + ry * .4 + rng.random() * ry * .4)) for _ in range(int(rx * .22))], 2)
    if fur: pc.fringe(fur, 3, 1)
def quad_leg(ramp, under, lw, lh, near, hoof_ramp, step=3, fur=True, split=True, shank_step=None):
    """a leg: a thigh blob that tucks up into the body, a narrower shank, a hoof; the far legs a tone darker"""
    st = step if near else step - 1; pc = Piece(lw + 4, lh)
    pc.rrect(under if shank_step is None else ramp, 3, int(lh * .42), lw - 2, int(lh * .5), 2, (st if shank_step is None else shank_step), shade=True)
    pc.blob(ramp, lw / 2 + 2, lh * .28, lw / 2 + 2, lh * .34, st, fur=1 if fur else 0)
    hoof(pc, hoof_ramp, 2, lh - 4, lw, split); return pc.outline()
def contact_shadow(pc, x0, x1, y, ramp, step=1):
    """a darker row where a part tucks under another (ambient shadow at the joint)"""
    p = pc.im.load()
    for x in range(max(0, x0), min(pc.w, x1)):
        if 0 <= y < pc.h and p[x, y][3]: p[x, y] = C(ramp, step)

# ======================= MUSK LINE: the muskox =======================
def musk(stage):
    S_ = 96 if stage < 2 else 128; S = S_ / 96 * (1.12 if stage == 1 else 1); base = S_ - 6; cx = S_ // 2
    body = 'rust' if stage == 2 else 'stone'; under = 'straw' if stage != 2 else 'skin'
    parts = {}
    tw, th = int(52 * S), int(30 * S); lw, lh = int(11 * S), int(26 * S)
    tx, ty = cx - tw // 2 + int(4 * S), base - lh + int(9 * S) - th      # the legs tuck 9 px up into the body
    def torso(kind):
        sy = {'rest': 1, 'squash': .86, 'stretch': 1.1}[kind]; pc = Piece(tw + 6, th + 12)
        quad_torso(pc, body, under, tw / 2 + 3, th / 2 + 6, tw / 2, (th / 2) * sy, 3, hump=.18 if stage >= 1 else .08, seed=stage * 7 + 1)
        if stage == 1:   # flame humps: two glowing vents on the shoulders, scorched fur round them
            for k, (x, y) in enumerate(((tw * .26, th * .08), (tw * .46, th * .02))):
                pc.blob('indigo', x + 3, y + 6, 5 * S, 3 * S, 2, flat=True); pc.blob('ember', x + 3, y + 6, 3.5 * S, 2 * S, 4, flat=True); pc.dot(C('gold', 6), int(x + 2), int(y + 5), 2, 1)
            pc.strokes('rust', 1, [(int(tw * .2 + k * 5), int(th * .3 + (k % 3))) for k in range(6)], 3)
        if stage == 2:   # crater-rock plates grown along the back
            for k, (x, y, r) in enumerate(((tw * .2, th * .12, 5), (tw * .42, th * .04, 6), (tw * .64, th * .12, 5))):
                pc.blob('steel', x + 3, y + 6, r * S, r * .7 * S, 3, deep=False); pc.dot(C('steel', 1), int(x + 3), int(y + 6), 2, 1)
        return pc.outline()
    parts['torso'] = part(None, (tw // 2 + 3, th // 2 + 6), tx - 3, ty - 6, 'root', 5, main={'main': torso('rest'), 'squash': torso('squash'), 'stretch': torso('stretch')})
    hoofr = 'skin_deep' if stage != 2 else 'steel'
    for n, x, z, near in (('legBF', tx + tw - lw - int(10 * S), 3, False), ('legFF', tx + int(4 * S), 3, False), ('legBN', tx + tw - lw - int(3 * S), 7, True), ('legFN', tx + int(10 * S), 7, True)):
        parts[n] = part(quad_leg(body, under, lw, lh, near, hoofr, 3, True, True), (lw // 2 + 2, 4), x - 2, base - lh + 2, 'torso', z, 10 - z)
    # head: round skull, broad muzzle, nose, ears, the horn boss with curled horns; a neck blob joins it to the shoulders
    hw, hh = int(36 * S), int(31 * S); hp = Piece(hw + 18, hh + 16); hcx, hcy = hw / 2 + 8, hh / 2 + 9
    hp.blob(body, hcx + hw * .4, hcy + hh * .3, hw * .3, hh * .28, 2, deep=False, hi=False)   # neck, tucks under the shoulders
    hp.blob(body, hcx, hcy, hw / 2, hh / 2, 3, fur=1)
    hp.blob(body, hcx, hcy - hh * .28, hw * .44, hh * .24, 2, flat=True)
    hp.blob(under, hcx - hw * .1, hcy + hh * .3, hw * .36, hh * .24, 4, deep=False)   # muzzle
    hp.dot(C('indigo', 1), int(hcx - hw * .32), int(hcy + hh * .25), 4, 3); hp.dot(C('indigo', 3), int(hcx - hw * .32), int(hcy + hh * .25), 1, 1)
    hp.dot(C(under, 2), int(hcx - hw * .1), int(hcy + hh * .5), 5, 1)   # mouth line
    ear(hp, body, 'rose', hcx + hw * .47, hcy - hh * .02, 5 * S, 4 * S, tilt=.5)
    if stage == 3:
        hp.blob('sky', hcx - hw * .3, hcy - hh * .6, 12 * S, 5 * S, 4, deep=False, tilt=-.35); hp.blob('sky', hcx + hw * .3, hcy - hh * .6, 12 * S, 5 * S, 4, deep=False, tilt=.35)
        hp.dot(C('sky', 6), int(hcx - hw * .5), int(hcy - hh * .7), 4, 1); hp.dot(C('sky', 6), int(hcx + hw * .2), int(hcy - hh * .72), 4, 1)
    else:
        hr = 'straw' if stage != 2 else 'steel'; R = hw * (.42 if stage == 0 else .5 if stage == 1 else .56); th_ = (4 if stage == 0 else 5 if stage == 1 else 6) * S
        hp.blob(hr, hcx, hcy - hh * .4, hw * .26, 2.5 * S, 3, deep=False, hi=False)
        horn_arc(hp, hr, hcx - hw * .1, hcy - hh * .02, R, th_ * .8, 215, 330, 3); horn_arc(hp, hr, hcx + hw * .1, hcy - hh * .02, R, th_ * .8, 210, 325, 3)
    hp.strokes('ember' if stage == 0 else body, 4 if stage == 0 else 1, [(int(hcx - 3 + k * 2), int(hcy - hh * .52 - (k % 2))) for k in range(4)], 3)
    if stage == 2: hp.dot(C('steel', 5), int(hcx + hw * .12), int(hcy - hh * .64), 1, 5); hp.dot(C('ember', 4), int(hcx + hw * .12), int(hcy - hh * .7), 2, 2)
    hp.outline()
    hx, hy = tx - int(12 * S), ty - int(8 * S); ew, eh = int(8 * S), int(9 * S); fw, fh = int(hw * .7), int(hh * .5)
    face_fn = lambda k: face(fw, fh, k, 'skin' if stage != 3 else 'violet', ew, eh, gap=int(4 * S), mouth=False)
    parts['head'] = head_part(hp, (int(hcx + hw * .3), hh + 4), hx, hy, face_fn, (hx + 8 + (hw - fw) // 2 - int(3 * S), hy + 9 + int(hh * .2)))
    tl = Piece(int(16 * S), int(16 * S)); tl.blob(body, tl.w * .5, tl.h * .45, tl.w * .42, tl.h * .3, 2, fur=1, tilt=-.5); tl.blob(under, tl.w * .72, tl.h * .55, tl.w * .2, tl.h * .18, 4, flat=True); tl.outline()
    parts['tail'] = part(tl, (3, tl.h // 2), tx + tw - int(6 * S), ty + int(7 * S), 'torso', 4, 8)
    if stage == 0:
        sp = Piece(int(14 * S), int(16 * S)); flame(sp, sp.w / 2, sp.h * .55, sp.w * .36); sp.outline(('ember', 'gold'))
        parts['spark'] = part(sp, (2, sp.h // 2), tx + tw + int(4 * S), ty + int(3 * S), 'tail', 11, 11)
    if stage == 1:
        for k, x in enumerate((tx + int(12 * S), tx + int(24 * S))):
            fl = Piece(int(14 * S), int(20 * S)); flame(fl, fl.w / 2, fl.h * .55, fl.w * .36); fl.outline(('ember', 'gold'))
            parts[f'plume{k}'] = part(fl, (fl.w // 2, fl.h - 3), x, ty - int(14 * S) - k * int(2 * S), 'torso', 4, 4)
        sp = Piece(int(14 * S), int(16 * S)); flame(sp, sp.w / 2, sp.h * .55, sp.w * .36); sp.outline(('ember', 'gold'))
        parts['spark'] = part(sp, (2, sp.h // 2), tx + tw + int(4 * S), ty + int(3 * S), 'tail', 11, 11)
    if stage == 2:
        du = Piece(int(34 * S), int(12 * S)); du.blob('rust', du.w * .3, du.h * .6, du.w * .3, du.h * .35, 5, flat=True); du.blob('rust', du.w * .65, du.h * .5, du.w * .33, du.h * .42, 5, flat=True); du.outline()
        parts['dust'] = part(du, (du.w // 2, du.h // 2), tx + tw - int(10 * S), base - int(7 * S), 'root', 0, 0)
        sp = Piece(int(16 * S), int(18 * S)); flame(sp, sp.w / 2, sp.h * .5, sp.w * .38); sp.outline(('ember', 'gold'))
        parts['spark'] = part(sp, (2, sp.h // 2), tx + tw + int(4 * S), ty + int(3 * S), 'tail', 11, 11)
    if stage == 3:
        cl = Piece(int(96 * S), int(26 * S)); cl.blob('sky', cl.w * .5, cl.h * .62, cl.w * .48, cl.h * .36, 6, deep=False); cl.blob('sky', cl.w * .25, cl.h * .5, cl.w * .2, cl.h * .42, 7, flat=True); cl.blob('sky', cl.w * .6, cl.h * .42, cl.w * .24, cl.h * .46, 7, flat=True); cl.blob('sky', cl.w * .85, cl.h * .6, cl.w * .14, cl.h * .3, 7, flat=True); cl.outline()
        parts['cloud'] = part(cl, (cl.w // 2, 4), cx - cl.w // 2 + int(4 * S), base - int(16 * S), 'root', 0, 0)
        for k, (x, y) in enumerate(((cx - int(44 * S), ty - int(10 * S)), (cx + int(40 * S), ty - int(16 * S)), (cx + int(30 * S), ty - int(2 * S)))):
            bd = Piece(int(10 * S), int(8 * S)); bd.blob('sky', bd.w / 2, bd.h / 2, bd.w / 2 - 1, bd.h / 2 - 1, 4, flat=True); bd.dot(C('gold', 4), bd.w - 3, bd.h // 2, 2, 1); bd.outline()
            parts[f'bird{k}'] = part(bd, (bd.w // 2, bd.h // 2), x, y, 'root', 12, 12)
    return parts, S_, base

# ======================= BEZOS LINE: the river otter =======================
def bezos(stage):
    S_ = 96 if stage < 2 else 128; S = S_ / 96 * (1.12 if stage == 1 else 1); base = S_ - 6; cx = S_ // 2; parts = {}
    fur = 'skin_deep' if stage < 2 else ('indigo' if stage == 2 else 'skin_deep'); pale = 'skin' if stage != 2 else 'sky'
    tw, th = int(36 * S), int(38 * S); fh_ = int(10 * S); tx, ty = cx - tw // 2, base - fh_ + int(6 * S) - th
    def torso(kind):
        sy = {'rest': 1, 'squash': .86, 'stretch': 1.1}[kind]; pc = Piece(tw + 8, th + 10); ccx, ccy = tw / 2 + 4, th / 2 + 5; rx, ry = tw / 2, (th / 2) * sy
        pc.blob(fur, ccx, ccy + ry * .22, rx, ry * .78, 3)                                  # belly, wide and low
        pc.blob(fur, ccx, ccy - ry * .42, rx * .72, ry * .58, 3)                            # chest, narrower
        pc.blob(fur, ccx - rx * .9, ccy + ry * .55, rx * .36, ry * .36, 3, deep=False)      # haunches
        pc.blob(fur, ccx + rx * .9, ccy + ry * .55, rx * .36, ry * .36, 3, deep=False)
        pc.blob(pale, ccx, ccy + ry * .1, rx * .58, ry * .66, 4, deep=False, hi=False)       # pale bib down the front
        pc.dot(C(pale, 3), int(ccx - rx * .25), int(ccy + ry * .5), int(rx * .5), 1)
        if stage in (0, 1):   # the smile: a curved darker marking across the bib
            for i in range(int(rx * .9)): pc.dot(C(fur, 2), int(ccx - rx * .45 + i), int(ccy + ry * .25 + math.sin(i / max(1, rx * .9) * math.pi) * ry * .18), 1, 1)
            pc.dot(C(fur, 2), int(ccx + rx * .42), int(ccy + ry * .18), 1, 2)
        if stage == 1:   # a shaggy shoulder ruff
            pc.blob(fur, ccx, ccy - ry * .62, rx * .8, ry * .22, 2, deep=False, hi=False, fur=2)
        if stage == 3:   # the big one: broad, with a belly fold and shoulder bulk
            pc.blob(fur, ccx - rx * .55, ccy - ry * .5, rx * .4, ry * .3, 3, deep=False); pc.blob(fur, ccx + rx * .55, ccy - ry * .5, rx * .4, ry * .3, 3, deep=False)
            pc.dot(C(fur, 2), int(ccx - rx * .4), int(ccy + ry * .55), int(rx * .8), 1)
        if stage == 2:   # streamlined: a lighter racing stripe down the chest, sleek shine
            pc.dot(C('sky', 6), int(ccx - 1), int(ccy - ry * .8), 2, int(ry * 1.2))
        return pc.outline()
    parts['torso'] = part(None, (tw // 2 + 4, th + 3), tx - 4, ty - 5, 'root', 5, main={'main': torso('rest'), 'squash': torso('squash'), 'stretch': torso('stretch')})
    fw_ = int(15 * S)
    for n, x, z in (('legL', tx - int(3 * S), 7), ('legR', tx + tw - fw_ + int(3 * S), 7)):
        ft = Piece(fw_, fh_ + 4); ft.blob(fur, fw_ / 2, fh_ * .55 + 2, fw_ / 2 - 1, fh_ / 2, 2, deep=False)
        for k in (3, fw_ // 2, fw_ - 4): ft.dot(C(fur, 1), k, fh_ + 1, 1, 2)
        ft.dot(C(fur, 1), 2, fh_ * .55 + 2, fw_ - 4, 1); ft.outline()
        parts[n] = part(ft, (fw_ // 2, 4), x, base - fh_ - 2, 'torso', z, z)
    aw, ah = int(11 * S), int(22 * S)
    for n, x, z, zb in (('armL', tx - aw + int(6 * S), 8, 2), ('armR', tx + tw - int(6 * S), 8, 2)):
        ap = Piece(aw, ah); ap.blob(fur, aw / 2, ah * .32, aw / 2 - 1, ah * .34, 3, deep=False); ap.blob(fur, aw / 2, ah * .72, aw * .42, ah * .3, 3, deep=False); ap.blob(fur, aw / 2, ah - 3, aw / 2 - 1, 3, 2, flat=True)
        ap.dot(C(fur, 1), aw // 2 - 1, ah - 2, 1, 2); ap.outline()
        parts[n] = part(ap, (aw // 2, 3), x, ty + int(9 * S), 'torso', z, zb)
    hw, hh = int(36 * S), int(30 * S); hp = Piece(hw + 12, hh + 12); hcx, hcy = hw / 2 + 6, hh / 2 + 8
    hp.blob(fur, hcx, hcy + hh * .45, hw * .3, hh * .22, 2, deep=False, hi=False)       # neck tucks into the chest
    ear(hp, fur, 'rose', hcx - hw * .42, hcy - hh * .36, 5 * S, 5 * S); ear(hp, fur, 'rose', hcx + hw * .42, hcy - hh * .36, 5 * S, 5 * S)
    hp.blob(fur, hcx, hcy, hw / 2, hh / 2, 3); hp.blob(fur, hcx, hcy + hh * .15, hw * .46, hh * .34, 3, deep=False)   # full cheeks
    hp.blob(pale, hcx, hcy + hh * .26, hw * .3, hh * .22, 4, deep=False, hi=False)
    hp.dot(C('indigo', 1), int(hcx - 2), int(hcy + hh * .14), 5, 3); hp.dot(C('indigo', 3), int(hcx - 2), int(hcy + hh * .14), 1, 1)
    hp.dot(C(pale, 2), int(hcx - 2), int(hcy + hh * .32), 2, 1); hp.dot(C(pale, 2), int(hcx + 1), int(hcy + hh * .32), 2, 1)   # the otter grin
    for k in (-1, 1):
        for j in range(3): hp.dot(C(fur, 1), int(hcx + k * (hw * .26 + j * 2)), int(hcy + hh * .22 + (j - 1) * 2), 1, 1)   # whiskers
    hp.outline()
    hx, hy = cx - (hw + 12) // 2, ty - hh + int(8 * S); ew, eh = int(8 * S), int(9 * S); fw, fh = int(hw * .7), int(hh * .45)
    face_fn = lambda k: face(fw, fh, k, 'cobalt' if stage != 2 else 'gold', ew, eh, gap=int(5 * S), mouth=False, cheeks='rose')
    parts['head'] = head_part(hp, ((hw + 12) // 2, hh + 6), hx, hy, face_fn, (hx + 6 + (hw - fw) // 2, hy + 8 + int(hh * .14)))
    tl = Piece(int(28 * S), int(14 * S)); tl.blob(fur, tl.w * .55, tl.h * .5, tl.w * .44, tl.h * .4, 2, tilt=.2); tl.blob(fur, tl.w * .15, tl.h * .4, tl.w * .18, tl.h * .3, 2, deep=False)
    if stage == 1:
        for k in range(3): tl.dot(C(pale, 3), int(tl.w * .45 + k * 6), int(tl.h * .25), 2, int(tl.h * .5))   # tail rings
    tl.outline()
    parts['tail'] = part(tl, (3, tl.h // 2), tx + tw - int(4 * S), base - int(12 * S), 'torso', 1, 8)
    if stage == 0:   # a river pebble held to its chest
        pb = Piece(int(14 * S), int(11 * S)); pb.blob('steel', pb.w / 2, pb.h / 2, pb.w / 2 - 1, pb.h / 2 - 1, 4); pb.dot(C('steel', 6), 3, 2, 3, 1); pb.outline()
        parts['pebble'] = part(pb, (2, 2), tx + int(4 * S), ty + int(18 * S), 'armL', 11, 11)
    if stage == 1:   # a thicker ruff of fur at the shoulders and a ringed tail (drawn into the pieces below)
        pass
    if stage == 2:
        fl = Piece(int(30 * S), int(16 * S)); flame(fl, fl.w * .5, fl.h * .5, fl.h * .46); fl.outline(('ember', 'gold'))
        parts['jet'] = part(fl, (fl.w // 2, 2), cx - fl.w // 2 + int(8 * S), base - int(10 * S), 'tail', 0, 0)
    if stage == 3:
        for n, x, y, fl_ in (('gullL', tx - int(26 * S), ty - int(12 * S), 1), ('gullR', tx + tw + int(12 * S), ty - int(6 * S), -1)):   # river gulls circling the big one
            gl = Piece(int(14 * S), int(8 * S)); gl.blob('stone', gl.w / 2, gl.h * .6, gl.w * .22, gl.h * .3, 7, flat=True); gl.poly('stone', [(0, 2), (gl.w // 2 - 2, gl.h * .55), (gl.w // 2 - 2, gl.h * .8)], 6, False); gl.poly('stone', [(gl.w - 1, 2), (gl.w // 2 + 2, gl.h * .55), (gl.w // 2 + 2, gl.h * .8)], 6, False); gl.dot(C('gold', 4), gl.w // 2 + (2 if fl_ > 0 else -3), int(gl.h * .6), 2, 1); gl.outline()
            parts[n] = part(gl, (gl.w // 2, gl.h // 2), x, y, 'root', 12, 12)
        for i in range(3):   # a few river stones it has gathered, held against the belly
            pb = Piece(int(12 * S), int(9 * S)); pb.blob('steel' if i != 1 else 'stone', pb.w / 2, pb.h / 2, pb.w / 2 - 1, pb.h / 2 - 1, 4); pb.dot(C('steel', 6), 3, 2, 2, 1); pb.outline()
            parts[f'stone{i}'] = part(pb, (pb.w // 2, pb.h - 1), tx + int(4 * S) + i * int(11 * S), ty + int(30 * S) - (i % 2) * int(3 * S), 'armL' if i == 0 else 'armR', 11, 11)
    return parts, S_, base

# ======================= GATES LINE: the goat =======================
def gates(stage):
    S_ = 96 if stage < 2 else 128; S = S_ / 96 * (1.12 if stage == 1 else 1); base = S_ - 6; cx = S_ // 2; parts = {}
    coat = 'stone' if stage != 3 else 'olive'; cstep = 6 if stage != 3 else 3; under = 'stone' if stage != 3 else 'olive'
    tw, th = int(46 * S), int(28 * S); lw, lh = int(9 * S), int(24 * S)
    tx, ty = cx - tw // 2 + int(4 * S), base - lh + int(8 * S) - th
    def torso(kind):
        sy = {'rest': 1, 'squash': .86, 'stretch': 1.1}[kind]; pc = Piece(tw + 6, th + 12); ccx, ccy = tw / 2 + 3, th / 2 + 6
        quad_torso(pc, coat, under, ccx, ccy, tw / 2, (th / 2) * sy, cstep, hump=.05, mantle=False, seed=stage + 3, under_ramp_step=cstep + 1 if stage != 3 else 4, fur=2)
        if stage == 3:
            for i in range(3): pc.blob('olive', ccx + 2, ccy - (th / 2) * .45 + i * (th / 2) * .4, tw * .36, 1.5, 2, flat=True)
            for k in range(5): pc.dot(C('leaf', 4), int(ccx - tw * .35 + k * tw * .17), int(ccy - (th / 2) * .6 + (k % 2) * 3), 1, 3); pc.dot(C('leaf', 5), int(ccx - tw * .35 + k * tw * .17) - 1, int(ccy - (th / 2) * .6 + (k % 2) * 3), 3, 1)
        if stage == 1:   # the window grown into its flank: a pale pane of light in the wool
            wx, wy, ww = int(ccx + tw * .08), int(ccy - th * .22), int(14 * S)
            pc.blob('sky', wx + ww / 2, wy + ww / 2, ww / 2, ww / 2, 4, deep=False, hi=False)   # a round patch of sky-blue wool
            pc.dot(C('stone', 7), wx + ww // 2 - 1, wy + 2, 2, ww - 4); pc.dot(C('stone', 7), wx + 2, wy + ww // 2 - 1, ww - 4, 2)   # with a pale cross through it
            pc.dot(C('sky', 6), wx + 3, wy + 3, 2, 1)
        return pc.outline()
    parts['torso'] = part(None, (tw // 2 + 3, th // 2 + 6), tx - 3, ty - 6, 'root', 5, main={'main': torso('rest'), 'squash': torso('squash'), 'stretch': torso('stretch')})
    for n, x, z, near in (('legBF', tx + tw - lw - int(9 * S), 3, False), ('legFF', tx + int(5 * S), 3, False), ('legBN', tx + tw - lw - int(3 * S), 7, True), ('legFN', tx + int(11 * S), 7, True)):
        parts[n] = part(quad_leg(coat, coat, lw, lh, near, 'indigo', cstep, True, True, shank_step=cstep if near else cstep - 1), (lw // 2 + 2, 4), x - 2, base - lh + 2, 'torso', z, 10 - z)
    hw, hh = int(26 * S), int(32 * S); hp = Piece(hw + 22, hh + 18); hcx, hcy = hw / 2 + 11, hh / 2 + 12
    hp.blob(coat, hcx + hw * .5, hcy + hh * .25, hw * .36, hh * .26, cstep - 1, deep=False, hi=False)   # neck into the shoulders
    hp.blob(coat, hcx, hcy, hw / 2, hh / 2, cstep, fur=1); hp.blob(coat, hcx, hcy - hh * .28, hw * .52, hh * .24, cstep - 1, flat=True)
    hp.blob('skin', hcx, hcy + hh * .32, hw * .32, hh * .2, 5, deep=False, hi=False); hp.dot(C('indigo', 1), int(hcx - 1), int(hcy + hh * .2), 3, 2)
    hp.dot(C('skin', 2), int(hcx - 2), int(hcy + hh * .42), 5, 1)   # mouth
    hp.blob(coat, hcx, hcy + hh * .58, 3 * S, 6 * S, cstep, deep=False, fur=1)   # beard
    ear(hp, coat, 'rose', hcx - hw * .58, hcy - hh * .02, 8 * S, 4 * S, tilt=.3, step=cstep); ear(hp, coat, 'rose', hcx + hw * .58, hcy - hh * .02, 8 * S, 4 * S, tilt=-.3, step=cstep)
    if stage == 2:
        for x_, lean in ((int(hcx - hw * .26), -3), (int(hcx + hw * .26), 3)):   # crystal horns: blue, faceted, glowing at the tip
            hl = int(15 * S); horn_straight(hp, 'cobalt', x_, int(hcy - hh * .45 - hl), hl, 5, 4, lean=lean); hp.dot(C('sky', 7), x_ + lean, int(hcy - hh * .45 - hl) + 1, 1, 3); hp.dot(C('sky', 5), x_ + lean // 2, int(hcy - hh * .45 - hl // 2), 1, 2)
    else:
        hl = int((7 if stage == 0 else 11 if stage == 1 else 17) * S); horn_straight(hp, 'straw', int(hcx - hw * .24), int(hcy - hh * .45 - hl), hl, 4, 4, lean=-2); horn_straight(hp, 'straw', int(hcx + hw * .24), int(hcy - hh * .45 - hl), hl, 4, 4, lean=2)
    hp.outline()
    hx, hy = tx - int(13 * S), ty - int(15 * S); ew, eh = int(6 * S), int(8 * S); fw, fh = int(hw * .95), int(hh * .45)
    face_fn = lambda k: face(fw, fh, k, 'teal', ew, eh, gap=int(6 * S), mouth=False, cheeks='rose')
    parts['head'] = head_part(hp, (int(hcx + hw * .3), hh + 8), hx, hy, face_fn, (hx + 11 + (hw - fw) // 2, hy + 12 + int(hh * .18)))
    tl = Piece(int(12 * S), int(12 * S)); tl.blob(coat, tl.w * .5, tl.h * .4, tl.w * .35, tl.h * .3, cstep, fur=1, tilt=-.8); tl.outline()
    parts['tail'] = part(tl, (3, tl.h // 2), tx + tw - int(6 * S), ty + int(3 * S), 'torso', 4, 8)
    if stage == 0:
        lf = Piece(int(14 * S), int(9 * S)); lf.blob('leaf', lf.w * .5, lf.h * .5, lf.w * .46, lf.h * .36, 3, tilt=.3); lf.dot(C('leaf', 1), 2, lf.h // 2, lf.w - 4, 1); lf.outline()
        parts['leaf'] = part(lf, (lf.w - 2, lf.h // 2), hx + 6, hy + hh + 2, 'head', 10, 10)
    return parts, S_, base

# piece name -> animation role (anim.js), where the name itself isn't a role
ROLES = {'quad': {'torso': 'body'}, 'biped': {}, '*': {'spark': 'tail', 'plume0': 'mane', 'plume1': 'mane', 'cloud': 'hover', 'dust': 'hover', 'bird0': 'hover', 'bird1': 'hover', 'jet': 'tail', 'neck': 'head'}}
SPECIES = [('musk', ['emberox', 'boostox', 'marsox', 'memeox'], musk, 'quad'), ('bezos', ['cartotter', 'primotter', 'orbitotter', 'everyotter'], bezos, 'biped'), ('gates', ['kidling', 'billgoat', 'windowgoat', 'harvestgoat'], gates, 'quad')]

# ---------------- assembly ----------------
def build(sid, parts, canvas, base, plan):
    """pack pieces onto one sheet; write layout + rig meta; return (sheet image, layout, rig meta)"""
    # face pieces
    head = parts['head']; faces = {k: head['face_fn'](k) for k in ('idle', 'blink', 'happy', 'hurt')}
    # back view pieces: the same pieces, mirrored, the face hidden (a head seen from behind is the plain head)
    items = []  # (name, variant, Piece, group)
    fx, fy = head['face_at'][0] - head['px'], head['face_at'][1] - head['py']
    for n, p in parts.items():
        for v, pc in p['pc'].items():
            if n == 'head':  # the front head comes in four: the face composited on, one per expression
                for k2, fc in faces.items():
                    hv = Piece(pc.w, pc.h); hv.im = pc.im.copy(); hv.im.alpha_composite(fc.im, (fx, fy)); items.append(('head', k2, hv, 'front'))
            else: items.append((n, v, pc, 'front'))
    for k, pc in faces.items(): items.append(('face', k, pc, 'front'))
    back_names = [n for n in parts if n not in ('spark',) and parts[n].get('back', True) and not n.startswith('face')]
    for n in back_names:
        if parts[n].get('noimg'): continue
        pc = parts[n]['pc']['main']; m = Piece(pc.w, pc.h); m.im = pc.im.transpose(Image.FLIP_LEFT_RIGHT); items.append((n, 'main', m, 'back'))
    # portrait: head + face at 2x scaled into 64x64
    hp = parts['head']['pc']['main']; por = Image.new('RGBA', (64, 64), (0, 0, 0, 0)); hp2 = hp.im.copy(); fx, fy = head['face_at'][0] - head['px'], head['face_at'][1] - head['py']; hp2.alpha_composite(faces['idle'].im, (fx, fy))
    bb = hp2.getbbox(); crop = hp2.crop(bb); k = min(60 / crop.width, 60 / crop.height); crop = crop.resize((max(1, int(crop.width * k)), max(1, int(crop.height * k))), Image.NEAREST); por.paste(crop, ((64 - crop.width) // 2, 64 - crop.height - 2))
    items.append(('portrait', 'main', None, 'portrait'))
    # pack: rows of pieces, 2 px gutter
    W = 512; x = y = 2; rowh = 0; rects = {}
    for n, v, pc, g in items:
        im = por if n == 'portrait' else pc.im
        if x + im.width + 2 > W: x = 2; y += rowh + 2; rowh = 0
        rects[(n, v, g)] = (x, y, im.width, im.height); x += im.width + 2; rowh = max(rowh, im.height)
    H = y + rowh + 2; sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for n, v, pc, g in items:
        im = por if n == 'portrait' else pc.im; r = rects[(n, v, g)]; sheet.alpha_composite(im, (r[0], r[1]))
    lay = {'id': sid, 'w': canvas, 'h': canvas, 'cx': canvas // 2, 'base': base, 'plan': plan, 'pieces': []}
    for n, v, pc, g in items:
        if parts.get(n, {}).get('noimg'): continue
        r = rects[(n, v, g)]; e = {'n': n, 'v': v, 'group': g, 'x': r[0], 'y': r[1], 'w': r[2], 'h': r[3]}
        if n == 'face': e['face'] = v; e['px'], e['py'] = head['face_at']
        elif n == 'head' and g == 'front': p = parts[n]; e['px'], e['py'], e['pivot'], e['par'], e['expr'] = p['px'], p['py'], list(p['pivot']), p['par'], v
        elif n != 'portrait':
            p = parts[n]; e['px'], e['py'], e['pivot'], e['par'] = p['px'], p['py'], list(p['pivot']), p['par']
            if g == 'back': e['px'] = canvas - p['px'] - r[2]; e['pivot'] = [r[2] - 1 - p['pivot'][0], p['pivot'][1]]
        lay['pieces'].append(e)
    # rig meta (rig.js format, k = 1): bones hang from their parent by the pivot difference at rest
    def meta_for(group):
        imgs = []; bones = []; idx = {}
        names = [n for n in parts if group == 'front' or n in back_names]
        # parents before children (rigMatrices walks the list in order), z decides drawing, not this
        order = []; seen = set()
        def put(n):
            if n in seen or n not in names: return
            par = parts[n]['par']
            if par in names: put(par)
            seen.add(n); order.append(n)
        for n in sorted(names, key=lambda n: parts[n]['z']): put(n)
        for n in order:
            p = parts[n]; f = {}
            for v in p['pc']:
                if group == 'back' and v != 'main': continue
                if group == 'front' and n == 'head': continue
                r = rects[(n, v, group)]; f['main' if v == 'main' else v] = list(r)
            if group == 'front' and n == 'head':
                f = {k2: list(rects[('head', k2, 'front')]) for k2 in ('idle', 'blink', 'happy', 'hurt')}
            piv = p['pivot']; px0 = p['px']
            if p.get('noimg'): idx[n] = -1; continue
            if group == 'back': px0 = canvas - p['px'] - _pw(parts[n]); piv = (_pw(parts[n]) - 1 - piv[0], piv[1])
            imgs.append({'ox': -piv[0], 'oy': -piv[1], 'f': f}); idx[n] = len(imgs) - 1
        for n in order:
            p = parts[n]; par = p['par'] if p['par'] in idx else 'root'
            piv = p['pivot']; px0 = p['px']
            if group == 'back' and not p.get('noimg'): px0 = canvas - p['px'] - _pw(parts[n]); piv = (_pw(parts[n]) - 1 - piv[0], piv[1])
            if group == 'back' and p.get('noimg'): px0 = canvas - p['px']
            ax, ay = px0 + piv[0], p['py'] + piv[1]
            if par == 'root': rx, ry = canvas // 2, base
            else:
                q = parts[par]; qp = q['pivot']; qx = q['px']
                if group == 'back' and not q.get('noimg'): qx = canvas - q['px'] - _pw(q); qp = (_pw(q) - 1 - qp[0], qp[1])
                if group == 'back' and q.get('noimg'): qx = canvas - q['px']
                rx, ry = qx + qp[0], q['py'] + qp[1]
            b = {'n': n, 'par': par, 'at': [ax - rx, ay - ry], 'z': p['z'], 'zb': p['zb'], 'i': idx[n]}
            if group == 'back': b['at'][0] = -(b['at'][0])  # the back view mirrors the whole rig (rigMatrices mS(-1,1))
            if n == 'head' and group == 'front': b['face'] = True
            role = ROLES.get(plan, {}).get(n) or ROLES['*'].get(n)
            if role: b['a'] = role
            if n in ('tail', 'spark', 'hat', 'cloud') or p.get('lag'): b['lag'] = 1
            bones.append(b)
        return imgs, bones
    def geo():
        # rest silhouette extents from the pieces at rest
        x0 = y0 = 10 ** 6; x1 = y1 = -1
        for n, p in parts.items():
            if n in ('cloud',) or p.get('noimg'): continue
            pc = p['pc']['main']; bb = pc.im.getbbox()
            if not bb: continue
            x0 = min(x0, p['px'] + bb[0]); x1 = max(x1, p['px'] + bb[2]); y0 = min(y0, p['py'] + bb[1]); y1 = max(y1, p['py'] + bb[3])
        return {'cx': canvas // 2, 'base': base, 'top': float(y0), 'mid': float((y0 + base) / 2), 'hw': float((x1 - x0) / 2), 'lift': 0, 'k': 1, 'cy': float((y0 + base) / 2)}
    q = {'lift': 0, 'flapMs': 300} if plan == 'biped' else {}
    meta = {}
    for g in ('front', 'back'):
        imgs, bones = meta_for(g)
        meta[g] = {'k': 1, 'BW': canvas, 'BH': canvas, 'cx': canvas // 2, 'base': base, 'tipX': 0, 'plan': plan, 'q': q, 'geo': geo(), 'size': [W, H], 'imgs': imgs, 'bones': bones, 'clock': 12, 'sheet': f'next/billionaires/{sid}.png', 'portrait': list(rects[('portrait', 'main', 'portrait')])}   # v39: where the 64x64 bust sits on the sheet
    return sheet, lay, meta


RIGS_NEXT_HEADER = '/* v36: rigs for the new piece sheets (art/next/billionaires), made by tools/build-starter-sheets.py and tools/build-roster-sheets.py and edited by Pocket Billies Studio. k=1: pieces at the final scale. */\n'
def read_rigs_next():
    f = NEXT / 'rigs-next.js'
    if not f.exists(): return {}
    s = f.read_text(); i = s.index('window.RIGS_NEXT='); return json.loads(s[i + len('window.RIGS_NEXT='):s.rindex(';')])
def write_rigs_next(rigs):
    """merge these rigs into rigs-next.js (other species' rigs, and the Studio's edits to them, are kept)"""
    allr = read_rigs_next(); allr.update(rigs)
    (NEXT / 'rigs-next.js').write_text(RIGS_NEXT_HEADER + 'window.RIGS_NEXT=' + json.dumps(allr, separators=(',', ':')) + ';\n')

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--force', action='store_true'); ap.add_argument('--sheet'); a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True); rigs = {}; made = 0; thumbs = []; have = read_rigs_next()
    for line, ids, fn, plan in SPECIES:
        for st, sid in enumerate(ids):
            f = OUT / f'{sid}.png'
            parts, canvas, base = fn(st); sheet, lay, meta = build(sid, parts, canvas, base, plan)
            fresh = a.force or not f.exists()
            if fresh:
                sheet.save(f); gold_recolour(sheet).save(OUT / f'{sid}_gold.png'); (OUT / f'{sid}.json').write_text(json.dumps(lay, separators=(',', ':'))); made += 1
            if fresh or f'{line}{st}' not in have: rigs[f'{line}{st}'] = meta  # the game's species id is line + stage index; the sheet keeps the readable name; a rig the Studio edited is kept
            # a rest-pose composite for the review sheet
            comp = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
            for n in sorted(parts, key=lambda n: parts[n]['z']):
                comp.alpha_composite(parts[n]['pc']['main'].im, (parts[n]['px'], parts[n]['py']))
            comp.alpha_composite(parts['head']['face_fn']('idle').im, parts['head']['face_at'])
            thumbs.append((sid, comp))
    write_rigs_next(rigs)
    print(f'{made} sheets written, {len(rigs)} rigs -> rigs-next.js')
    if a.sheet:
        z = 2; cell = 128 * z + 12; sh = Image.new('RGB', (4 * cell, 3 * cell), (226, 222, 214)); d = ImageDraw.Draw(sh)
        for i, (sid, comp) in enumerate(thumbs):
            cx, cy = (i % 4) * cell, (i // 4) * cell; c2 = comp.resize((comp.width * z, comp.height * z), Image.NEAREST); sh.paste(c2, (cx + (cell - c2.width) // 2, cy + cell - c2.height - 14), c2); d.text((cx + 6, cy + cell - 12), sid, fill=(40, 40, 50))
        Path(a.sheet).parent.mkdir(parents=True, exist_ok=True); sh.save(a.sheet)

if __name__ == '__main__':
    main()
