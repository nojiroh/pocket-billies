#!/usr/bin/env python3
"""Phase 07: cut the portrait kit into pixel-art parts.

Input:  tools/art-source/portrait-kit/kit.json and its sheets (parts in a grid on magenta, drawn large with
        uneven "pixels", as image generators make them). Kept out of the game folder so they never ship.
Output: game/art/next/portraits/<id>.png, every part on one shared pixel grid (a portrait is 64x64 art pixels),
        and game/data/portraits.json: a part the data doesn't have yet is added with a first guess at where it
        sits. Parts already in the data keep everything you set in the Studio (Portraits); only their pictures
        are cut again. --reset forgets the data and starts from the guesses.

    python3 tools/slice-portrait-kit.py [--reset]

How a part is cut: the magenta is keyed out, each grid cell becomes one part (pairs such as eyes are split into
left and right), and the part is resampled so one art pixel is one pixel: every kind has a size it is scaled to
(a skull is 30 px wide, an eye 9 px, ...). Clothes are cut three times, for narrow, middle and wide shoulders.
Eye styles drawn with one frame get half-closed, closed and happy frames drawn from their darkest colour.
Needs Pillow, numpy and scipy.
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

SRC = 'tools/art-source/portrait-kit'
OUT = 'game/art/next/portraits'
DATA = 'game/data/portraits.json'
KIT = json.load(open(f'{SRC}/kit.json'))
T = KIT['size']
HW = round(T * 0.47)              # skull width in art px: everything else is sized from it
TOP_SIZES = {'s': 53, 'm': 59, 'l': 64}   # shoulder widths the clothes are cut for


# ---------------------------------------------------------------- cutting
def key_out(rgb):
    a = rgb.astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mag = ((r > g + 55) & (b > g + 55) & (np.abs(r - b) < 90)) | ((r > 200) & (b > 200) & (g < 140))
    return ndimage.binary_opening(~mag, iterations=1)


def cells(name):
    """{(row, col): RGBA crop} for one sheet"""
    sh = KIT['sheets'][name]
    R, C = sh['grid']
    im = np.array(Image.open(f'{SRC}/{name}.png').convert('RGB'))
    H, W = im.shape[:2]
    fg = key_out(im)
    lab, n = ndimage.label(fg)
    sizes = ndimage.sum(fg, lab, range(1, n + 1))
    cents = ndimage.center_of_mass(fg, lab, range(1, n + 1))
    groups = {}
    for i, (s, (cy, cx)) in enumerate(zip(sizes, cents), 1):
        if s >= 40:
            groups.setdefault((min(R - 1, int(cy / (H / R))), min(C - 1, int(cx / (W / C)))), []).append(i)
    out = {}
    for rc, ids in groups.items():
        m = np.isin(lab, ids)
        ys, xs = np.where(m)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        crop = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
        crop[..., :3] = im[y0:y1, x0:x1]
        crop[..., 3] = m[y0:y1, x0:x1] * 255
        # where the part sits in its cell: its left edge from the cell's centre (source px)
        out[rc] = dict(img=crop, left=x0 - (rc[1] + 0.5) * W / C, top=y0)
    return out


def named(name):
    """[(id, cell)] in the sheet's order, skipping null names and empty cells"""
    sh = KIT['sheets'][name]
    R, C = sh['grid']
    got = cells(name)
    res = []
    for i, n in enumerate(sh['names']):
        rc = (i // C, i % C)
        if n and rc in got:
            res.append((n, got[rc]))
    return res


def trim(a):
    ys, xs = np.where(a[..., 3] > 0)
    if not len(xs):
        return a[:1, :1]
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def resample(a, r, athresh=0.42):
    """hi-res fake pixel art -> one pixel per art pixel, r source px per art px. Alpha from coverage of the cell's
    centre; colour the commonest colour there, dark outline colours winning when there are enough of them"""
    h, w = a.shape[:2]
    W, H = max(1, round(w / r)), max(1, round(h / r))
    rx, ry = w / W, h / H
    out = np.zeros((H, W, 4), np.uint8)
    rgb = a[..., :3].astype(int)
    lum = rgb @ np.array([0.299, 0.587, 0.114])
    for j in range(H):
        y0, y1 = int(j * ry), max(int(j * ry) + 1, int(round((j + 1) * ry)))
        for i in range(W):
            x0, x1 = int(i * rx), max(int(i * rx) + 1, int(round((i + 1) * rx)))
            cx0 = x0 + int((x1 - x0) * 0.15); cx1 = max(cx0 + 1, x1 - int((x1 - x0) * 0.15))
            cy0 = y0 + int((y1 - y0) * 0.15); cy1 = max(cy0 + 1, y1 - int((y1 - y0) * 0.15))
            al = a[cy0:cy1, cx0:cx1, 3] > 0
            if al.mean() < athresh:
                continue
            px = rgb[cy0:cy1, cx0:cx1][al]
            dark = lum[cy0:cy1, cx0:cx1][al] < 75
            if dark.mean() > 0.3:
                sel = px[dark]
            else:
                q = px // 28
                k = q[:, 0] * 10000 + q[:, 1] * 100 + q[:, 2]
                v, c = np.unique(k, return_counts=True)
                sel = px[k == v[c.argmax()]]
            out[j, i, :3] = np.median(sel, axis=0)
            out[j, i, 3] = 255
    return out


def split_pair(a):
    """two halves (left, right) at the emptiest column near the middle"""
    fill = (a[..., 3] > 0).sum(0)
    w = a.shape[1]
    lo, hi = int(w * 0.3), int(w * 0.7)
    empty = [x for x in range(lo, hi) if fill[x] == 0]
    if not empty:
        x = lo + int(np.argmin(fill[lo:hi]))
    else:
        runs, cur = [], [empty[0]]
        for x in empty[1:]:
            if x == cur[-1] + 1:
                cur.append(x)
            else:
                runs.append(cur); cur = [x]
        runs.append(cur)
        run = max(runs, key=len)
        x = run[len(run) // 2]
    return trim(a[:, :x]), trim(a[:, x:])


def save(id_, a):
    Image.fromarray(a).save(f'{OUT}/{id_}.png', optimize=True)
    return a.shape[1], a.shape[0]


def ratio(cell, width, half=False):
    a = trim(cell['img'])
    if half:
        a = split_pair(a)[0]
    return a.shape[1] / width


# ---------------------------------------------------------------- the parts
def heads():
    """each head sheet cell -> head_<id> (above the chin) and body_<id> (neck stub, shoulders), plus its anchors"""
    out = {}
    for sheet in [s for s, v in KIT['sheets'].items() if v['kind'] == 'head']:
        for n, c in named(sheet):
            a = trim(c['img'])
            m = a[..., 3] > 0
            widths = m.sum(1); H = len(widths)
            lo, hi = int(H * 0.45), int(H * 0.88)
            neck_src = lo + int(np.argmin(widths[lo:hi]))
            skull = max(widths[y] for y in range(int(neck_src * 0.08), int(neck_src * 0.36)))
            s = resample(a, skull / HW)
            m = s[..., 3] > 0
            widths = m.sum(1); H = len(widths)
            neck = int(round(neck_src * HW / skull))
            row = m[int(neck * 0.22)]
            xs = np.where(row)[0]
            scx = (xs.min() + xs.max() + 1) / 2
            ear = [y for y in range(int(neck * 0.3), int(neck * 0.8)) if widths[y] > HW + 2] or [int(neck * .45), int(neck * .6)]
            ey = (min(ear) + max(ear)) // 2
            exs = np.where(m[ey])[0]
            x, y = int(round(T / 2 - scx)), round(T * 0.15)
            # the head above the neck; the body from a stub under the chin (as wide as the neck), so a turning head
            # never shows a gap
            nx = np.where(m[min(neck, H - 1)])[0]
            nx0, nx1 = int(nx.min()) + 1, int(nx.max())
            b0 = max(0, neck - round(HW * 0.25))
            body = s[b0:].copy()
            for yy in range(neck - b0):
                body[yy, :nx0] = 0; body[yy, nx1:] = 0
            save('head_' + n, s[:neck]); save('body_' + n, body)
            faceH = neck
            sw = int(widths[-1])
            out[n] = dict(
                name=n.replace('soft', 'Soft ').replace('clean', 'Clean '),
                img='head_' + n, body='body_' + n, x=x, y=y, bodyY=y + b0,
                cx=T // 2, crown=y, forehead=y + round(faceH * 0.33), eyeY=y + round(faceH * 0.60),
                noseY=y + round(faceH * 0.74), mouthY=y + round(faceH * 0.845), neck=y + neck - 1, bottom=y + H,
                eyeGap=round(HW * 0.25), earL=x + int(exs.min()), earR=x + int(exs.max()) + 1, earY=y + ey,
                lobeY=y + max(ear), top=min(TOP_SIZES, key=lambda k: abs(TOP_SIZES[k] - sw) if TOP_SIZES[k] >= sw - 1 else 99),
                _faceH=faceH)
    return out


def item(slot, name, img, at, ax=0.5, ay=0.5, dx=0, dy=0, tint=None, **more):
    d = dict(slot=slot, name=name, img=img, at=at, ax=ax, ay=ay, dx=dx, dy=dy)
    if tint:
        d['tint'] = tint
    d.update(more)
    return d


def title(n):
    return n.replace('_', ' ').capitalize()


# hand-measured nudges from the prototype: how far a hairstyle sits above the crown, where a hat's brim sits on the face
HAIR_PAD = {'tousled': 2, 'spiky': 3, 'mohawk': 4, 'bowl': 6, 'thinning': 8, 'undercut': 1, 'waves': 1, 'bun': 4, 'space_buns': 4}
HAT_BRIM = {'cap': 0.36, 'beanie': 0.33, 'bucket': 0.36, 'cowboy': 0.30, 'helmet': 0.42, 'beret': 0.26, 'flat_cap': 0.34,
            'bandana': 0.40, 'visor': 0.28, 'sun_hat': 0.30, 'top_hat': 0.30}


def parts(ref):
    """every part but the heads -> {id: data}. ref is a middle head, for the brim guesses"""
    items, eyes, mouths = {}, {}, {}
    fh = ref['_faceH']

    # hair: short ones sit on the crown; long ones have a back (behind the body) and a front
    r = ratio(named('hair-short')[0][1], HW * 1.10)
    for n, c in named('hair-short'):
        w, h = save('hair_' + n, trim(resample(trim(c['img']), r)))
        items['hair_' + n] = item('hair', title(n), 'hair_' + n, 'crown', 0.5, 0,
                                  round(c['left'] / r + w / 2), -3 - HAIR_PAD.get(n, 0), 'hair')
    front = named('hair-long-front')
    back = dict(named(KIT['sheets']['hair-long-front']['back']))
    r = 114 / (HW * 0.86)  # the long sheets: the face opening of "straight" (114 source px) matches the face
    for n, c in front:
        b = back[n]
        wf, hf = save(f'hair_{n}', trim(resample(trim(c['img']), r)))
        wb, hb = save(f'hair_{n}_back', trim(resample(trim(b['img']), r)))
        top = -round(HW * 0.26) - HAIR_PAD.get(n, 0)
        items['hair_' + n] = item('hair', title(n), 'hair_' + n, 'crown', 0.5, 0, round(c['left'] / r + wf / 2),
                                  top + round((c['top'] - b['top']) / r), 'hair',
                                  back=dict(img=f'hair_{n}_back', dx=round(b['left'] / r + wb / 2), dy=top))

    r = ratio(named('hats')[0][1], HW * 1.08)
    for n, c in named('hats'):
        w, h = save('hat_' + n, trim(resample(trim(c['img']), r)))
        dx = round(c['left'] / r + w / 2)
        if n == 'hood':
            items['hat_' + n] = item('hat', 'Hood', 'hat_' + n, 'crown', 0.5, 0, dx, -round(HW * 0.18), 'hat')
        else:
            items['hat_' + n] = item('hat', title(n), 'hat_' + n, 'forehead', 0.5, 1, dx,
                                     round(fh * (HAT_BRIM[n] - 0.33)), 'hat')

    # clothes, cut once per shoulder width; the head picks one (heads.<id>.top)
    tops = named('tops')
    ref_w = trim(tops[0][1]['img']).shape[1]
    for n, c in tops:
        imgs = {}
        for k, W in TOP_SIZES.items():
            save(f'top_{n}_{k}', trim(resample(trim(c['img']), ref_w / W)))
            imgs[k] = f'top_{n}_{k}'
        items['top_' + n] = item('top', title(n), imgs, 'bottom', 0.5, 1, 0, 0, 'top', layer='body')

    # eyes: the lashes set has a drawn frame for every look; the single styles get their closed frames drawn here
    r = ratio(named('eyes-lashes')[0][1], round(HW * 0.30), half=True)
    frames = {}
    for n, c in named('eyes-lashes'):
        L, R = split_pair(c['img'])
        save(f'eyes_lashes_{n}_l', trim(resample(L, r)))
        save(f'eyes_lashes_{n}_r', trim(resample(R, r)))
        frames[n] = f'eyes_lashes_{n}'
    eyes['lashes'] = dict(name='Lashes (every look drawn)', frames=frames, mid=['closed', 'happy'], dx=0, dy=0)
    r = ratio(named('eye-styles')[0][1], round(HW * 0.26), half=True)
    for n, c in named('eye-styles'):
        L, R = split_pair(c['img'])
        for side, part in (('l', L), ('r', R)):
            s = trim(resample(part, r))
            h, w = s.shape[:2]
            op = s[..., 3] > 0
            lum = np.where(op, s[..., :3].astype(int).sum(2), 999)
            lid = s[np.unravel_index(np.argmin(lum), lum.shape)].copy()
            closed, happy, half = np.zeros_like(s), np.zeros_like(s), s.copy()
            for x in range(w):
                edge = 1 if x in (0, w - 1) else 0
                closed[min(h - 1, round(h * 0.62) + edge), x] = lid
                happy[min(h - 1, round(h * 0.5) + edge), x] = lid
            cut = round(h * 0.42)
            half[:cut] = 0
            half[cut, :] = lid
            for fr, img in (('open', s), ('half', half), ('closed', closed), ('happy', happy)):
                save(f'eyes_{n}_{fr}_{side}', img)
        eyes[n] = dict(name=title(n), frames={fr: f'eyes_{n}_{fr}' for fr in ('open', 'half', 'closed', 'happy')},
                       mid=[], dx=0, dy=0)

    r = ratio(named('brows')[0][1], round(HW * 0.30), half=True)
    for n, c in named('brows'):
        L, R = split_pair(c['img'])
        save(f'brows_{n}_l', trim(resample(L, r))); save(f'brows_{n}_r', trim(resample(R, r)))
        items['brows_' + n] = item('brows', title(n), {'l': f'brows_{n}_l', 'r': f'brows_{n}_r'}, 'brow', 0.5, 1, 0, 0, 'hair')

    nose = named('noses')
    r = ratio(nose[1][1], round(HW * 0.22))
    for n, c in nose:
        save('nose_' + n, trim(resample(trim(c['img']), r)))
        items['nose_' + n] = item('nose', title(n), 'nose_' + n, 'nose', 0.5, 0.5, 0, 0, 'skin')

    for sheet, ref_i in (('mouths-lips', 0), ('mouths', 2)):
        cs = named(sheet)
        r = ratio(cs[ref_i][1], round(HW * 0.36))
        for n, c in cs:
            save('mouth_' + n, trim(resample(trim(c['img']), r)))
    lips = {'closed': 1, 'neutral': 2, 'smile': 8, 'grin': 5, 'o': 6, 'shout': 3, 'talk_a': 8, 'talk_b': 4, 'talk_c': 9,
            'angry': 5, 'frown': 2, 'kiss': 7, 'wince': 5, 'smirk': 8, 'tongue': 9}
    simple = {'closed': 10, 'neutral': 10, 'smile': 1, 'grin': 2, 'o': 7, 'shout': 11, 'talk_a': 7, 'talk_b': 12,
              'talk_c': 4, 'angry': 8, 'frown': 3, 'kiss': 5, 'wince': 8, 'smirk': 6, 'tongue': 9}
    mouths['lips'] = dict(name='Full lips', frames={k: f'mouth_lips_{v}' for k, v in lips.items()}, dx=0, dy=0)
    mouths['simple'] = dict(name='Simple', frames={k: f'mouth_simple_{v}' for k, v in simple.items()}, dx=0, dy=0)

    # face marks and facial hair
    marks = dict(named('face-marks'))
    r = ratio(marks['beard_full'], round(HW * 0.80))
    for n, c in marks.items():
        if n in KIT['sheets']['face-marks']['pairs']:
            L, R = split_pair(trim(c['img']))
            save(f'{n}_l', trim(resample(L, r, 0.3))); save(f'{n}_r', trim(resample(R, r, 0.3)))
        else:
            save(n, trim(resample(trim(c['img']), r, 0.3)))
    pair = lambda n: {'l': f'{n}_l', 'r': f'{n}_r'}
    items['freckles'] = item('marks', 'Freckles', pair('freckles'), 'cheek')
    items['blush'] = item('marks', 'Blush', pair('blush'), 'cheek', 0.5, 0.5, 1, 1)
    items['scar'] = item('marks', 'Scar', 'scar', 'nose', 0, 0, HW // 4 - 2, -2)
    items['smile_lines'] = item('marks', 'Smile lines', pair('smile_lines'), 'mouthSide', 0.5, 0.5, -1, 0)
    items['stubble'] = item('marks', 'Stubble', 'stubble', 'mouth', 0.5, 0, 0, -1, 'hair')
    items['beard_full'] = item('beard', 'Full beard', 'beard_full', 'mouth', 0.5, 0.45, 0, 0, 'hair')
    items['beard_chin'] = item('beard', 'Chin beard', 'beard_chin', 'mouth', 0.5, 0.25, 0, 0, 'hair')
    items['mustache'] = item('beard', 'Mustache', 'mustache', 'mouth', 0.5, 1, 0, -1, 'hair')
    items['goatee'] = item('beard', 'Goatee', 'goatee', 'mouth', 0.5, 0, 0, 3, 'hair')

    acc = dict(named('accessories'))
    r = ratio(acc['glasses_round'], round(HW * 0.98))
    for n, c in acc.items():
        if n in KIT['sheets']['accessories']['pairs']:
            L, R = split_pair(trim(c['img']))
            save(f'{n}_l', trim(resample(L, r))); save(f'{n}_r', trim(resample(R, r)))
        else:
            save(n, trim(resample(trim(c['img']), r)))
    for n in ('glasses_round', 'glasses_square', 'goggles'):
        items[n] = item('eyewear', title(n), n, 'eyes', tint='acc')
    items['sunglasses'] = item('eyewear', 'Sunglasses', 'sunglasses', 'eyes')
    items['eyepatch'] = item('eyewear', 'Eyepatch', 'eyepatch', 'eyeL', 0.3, 0.55)
    items['headband'] = item('band', 'Headband', 'headband', 'forehead', 0.5, 0, 0, round(fh * (0.2 - 0.33)), 'acc')
    items['earrings'] = item('ears', 'Earrings', pair('earrings'), 'lobe', 0.5, 0, -1, -1, 'acc')
    items['earpiece'] = item('ears', 'Earpiece', 'earpiece', 'earR', 0, 0.5, -4, 0, 'acc')
    items['headphones'] = item('phones', 'Headphones', pair('headphones'), 'ear', 0.5, 0.5, -1, 0, 'acc')
    items['plaster'] = item('face', 'Plaster', 'plaster', 'nose', 0, 0, HW // 4 - 2, -2)
    items['mask'] = item('face', 'Mask', 'mask', 'mouth', 0.5, 0.55, 0, 0, 'acc')
    items['necklace'] = item('neck', 'Necklace', 'necklace', 'neck', 0.5, 0, 0, 2, 'acc', layer='body')
    return items, eyes, mouths


# ---------------------------------------------------------------- the data
def seed_data(H, items, eyes, mouths):
    for h in H.values():
        h.pop('_faceH', None)
        h['nudge'] = {}
    return {
        '_help': 'Phase 07 portraits: 64x64 pixel art, a still body and a head that moves. Edit in the Studio '
                 '(Portraits). Pictures: game/art/next/portraits/, cut by tools/slice-portrait-kit.py.',
        'size': T,
        'slots': [
            {'id': 'top', 'name': 'Clothes', 'one': True, 'layer': 'body'},
            {'id': 'neck', 'name': 'Neck', 'one': True, 'layer': 'body'},
            {'id': 'nose', 'name': 'Nose', 'one': True},
            {'id': 'marks', 'name': 'Face marks', 'one': False},
            {'id': 'eyes', 'name': 'Eyes', 'one': True},
            {'id': 'brows', 'name': 'Brows', 'one': True},
            {'id': 'mouth', 'name': 'Mouth', 'one': True},
            {'id': 'beard', 'name': 'Facial hair', 'one': True},
            {'id': 'face', 'name': 'On the face', 'one': False},
            {'id': 'hair', 'name': 'Hair', 'one': True},
            {'id': 'ears', 'name': 'Ears', 'one': False},
            {'id': 'hat', 'name': 'Hat', 'one': True},
            {'id': 'band', 'name': 'Headband', 'one': True},
            {'id': 'phones', 'name': 'Headphones', 'one': True},
            {'id': 'eyewear', 'name': 'Eyewear', 'one': True},
        ],
        'heads': H,
        'items': items,
        'eyes': eyes,
        'mouths': mouths,
        'eyeFallback': {'angry': 'open', 'wide': 'open', 'narrow': 'half', 'bored': 'half', 'look_l': 'open',
                        'look_r': 'open', 'up': 'open', 'down': 'open'},
        'expressions': {
            'idle': dict(eyes='open', mouth='closed', browTilt=0, browLift=0, pose=[0, 0, 0], sway=1),
            'happy': dict(eyes='happy', mouth='smile', browTilt=0, browLift=-1, blush=True, talk=['smile', 'talk_b', 'talk_c'],
                          pose=[0, -0.8, 5], sway=1.4, hit='bounce'),
            'sad': dict(eyes='bored', mouth='frown', browTilt=-2, browLift=0, pose=[0, 1.8, -3], sway=0.5),
            'angry': dict(eyes='angry', mouth='angry', browTilt=2, browLift=1, pose=[0, 0.9, 0], sway=0.6, hit='shake'),
            'surprised': dict(eyes='wide', mouth='o', browTilt=0, browLift=-2, pose=[0, -1.2, 0], sway=0.4, hit='jolt'),
            'hurt': dict(eyes='narrow', mouth='wince', browTilt=-2, browLift=1, pose=[-1, 0.6, -6], sway=0.5, hit='recoil'),
            'smug': dict(eyes='half', mouth='smirk', browTilt=1, browLift=0, pose=[0.6, -0.4, -6], sway=0.8),
        },
        'motion': {'sway': 1, 'talkSway': 1.5, 'nod': 1, 'nodChance': 0.55, 'hits': 1, 'hairLag': 1, 'follow': 1},
        'palettes': {
            'skin': ['#f6d3b3', '#e8b48a', '#c98d62', '#9c6644', '#6e452d', '#4a2d1e'],
            'hair': ['#6b4423', '#2b211c', '#e2c27a', '#b5512b', '#d9d6d0', '#4f7fd1', '#d45b9a', '#3a9a6b'],
            'iris': ['#5b7d9a', '#6b4a2f', '#3f8a5a', '#8a5bc4', '#c48a2c', '#3a3a44'],
            'cloth': ['#d0d6d8', '#2f5f8f', '#b23a3a', '#3a7a4f', '#e0b84a', '#33343a', '#c46aa0', '#7a5a3a'],
        },
        'faces': {
            'juniper': dict(name='Juniper', head='clean2', eyes='lashes', mouth='simple',
                            items=['hair_waves', 'brows_soft', 'nose_button', 'top_tshirt', 'freckles'],
                            colors=dict(hair='#6b4423', iris='#5b7d9a', top='#2f5f8f', hat='#b23a3a', acc='#d0d6d8')),
            'rex': dict(name='Rex', head='soft6', eyes='almond', mouth='lips',
                        items=['hair_crop', 'brows_thick', 'nose_round', 'top_suit', 'beard_full', 'glasses_square'],
                        colors=dict(hair='#2b211c', iris='#6b4a2f', top='#33343a', hat='#b23a3a', acc='#d0d6d8')),
            'ada': dict(name='Ada', head='clean1', eyes='lashes', mouth='simple',
                        items=['hair_space_buns', 'brows_arched', 'nose_small', 'top_hoodie', 'blush', 'earrings'],
                        colors=dict(skin='#9c6644', hair='#2b211c', iris='#6b4a2f', top='#c46aa0', hat='#b23a3a', acc='#e0b84a')),
            'gus': dict(name='Gus', head='clean5', eyes='sharp', mouth='simple',
                        items=['hair_slick', 'brows_bushy', 'nose_big', 'top_uniform', 'mustache', 'hat_flat_cap', 'headphones'],
                        colors=dict(hair='#d9d6d0', iris='#3a3a44', top='#2f5f8f', hat='#b23a3a', acc='#d0d6d8')),
        },
    }


def merge(old, new):
    """keep everything already in the data; add what is new"""
    for k in ('heads', 'items', 'eyes', 'mouths'):
        for id_, v in new[k].items():
            old.setdefault(k, {}).setdefault(id_, v)
    for k, v in new.items():
        old.setdefault(k, v)
    return old


def main():
    os.makedirs(OUT, exist_ok=True)
    H = heads()
    items, eyes, mouths = parts(H['clean2'])
    new = seed_data(H, items, eyes, mouths)
    if os.path.exists(DATA) and '--reset' not in sys.argv:
        new = merge(json.load(open(DATA)), new)
    with open(DATA, 'w') as f:
        json.dump(new, f, indent=1, ensure_ascii=False)
        f.write('\n')
    # lay the file out as the Studio writes it (game/js/data-files.js), so a Studio save doesn't reformat it
    subprocess.run(['node', '--input-type=module', '-e',
                    "import {PB_DATA, readJson, writeFile} from './tools/data-files.mjs';"
                    "writeFile('portraits.json', PB_DATA.text(readJson('portraits.json')))"], check=True)
    n = len([f for f in os.listdir(OUT) if f.endswith('.png')])
    print(f'{n} pictures in {OUT}; {len(new["heads"])} heads, {len(new["items"])} parts, '
          f'{len(new["eyes"])} eye styles, {len(new["mouths"])} mouths in {DATA}')


if __name__ == '__main__':
    main()
