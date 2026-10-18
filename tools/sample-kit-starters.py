#!/usr/bin/env python3
"""Phase 16 sample: the three starter lines remade from the placeholder part kits (game/art/next/parts).

A sample only: it draws every form (front and back) into one preview sheet and writes each form's recipe (which
part in which slot, at what size and colour). Nothing in the game changes. If a look is approved, the recipe becomes
a real sheet and rig the same way tools/build-rework-placeholders.py builds Trump and Zuckerberg.

    python3 tools/sample-kit-starters.py   # -> docs/samples/kit-starters.png and kit-starters.json

No clothing: every feature is an animal part. Needs Pillow and numpy.
"""
import colorsys
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

PARTS = 'game/art/next/parts'
OUT = 'docs/samples'
STAGE = [0.62, 0.8, 0.98, 0.98]   # calf, middle, both finals

# colours (hue 0-1, saturation scale, value scale); None keeps the kit's own colours
GREY_OX = (0.07, 0.35, 0.82)       # dusty grey-brown muskox
EMBER = (0.05, 1.7, 1.12)           # flame orange
RED_DUST = (0.02, 1.25, 0.9)
POST_BLUE = (0.58, 1.3, 1.08)       # Memeox: floats on a cloud of posts
OTTER = (0.07, 1.25, 0.72)          # dark river-otter brown
OTTER_BELLY = (0.09, 0.8, 1.05)
ROCKET = (0.6, 1.2, 0.95)
CARDBOARD = (0.09, 1.1, 0.95)
GOAT = (0.12, 0.15, 1.12)           # off-white kid goat
HORN = (0.11, 0.6, 1.0)
LEAF = (0.3, 1.6, 0.9)
SCREEN = (0.57, 1.8, 1.05)

# a form: slot -> (part id, size factor, colour); extras: (part id, anchor, size, colour, mirrored pair)
FORMS = [
    # Musk line: a muskox. Calf with a sparking tail; the middle stage grows the shaggy coat; the finals split by body
    ('Emberox', 'musk', 0, {'head': ('bear_head', 1.0, GREY_OX), 'torso': ('bear_torso', 0.95, GREY_OX),
                            'arm': ('bear_arm', 0.9, GREY_OX), 'leg': ('bear_leg', 0.85, GREY_OX),
                            'tail': ('fox_tail', 0.8, EMBER)},
     [('beasts_horn', 'brow', 0.45, HORN, True)]),
    ('Boostox', 'musk', 1, {'head': ('bear_head', 1.0, GREY_OX), 'torso': ('bear_torso', 1.05, GREY_OX),
                            'arm': ('bear_arm', 1.0, GREY_OX), 'leg': ('bear_leg', 1.0, GREY_OX),
                            'tail': ('fox_tail', 1.0, EMBER)},
     [('beasts_mane', 'crown', 0.85, GREY_OX, False), ('beasts_horn', 'brow', 0.65, HORN, True)]),
    ('Marsox (L body)', 'musk', 2, {'head': ('bear_head', 1.0, RED_DUST), 'torso': ('bear_torso', 1.3, RED_DUST),
                                    'arm': ('bear_arm', 1.15, RED_DUST), 'leg': ('bear_leg', 1.2, RED_DUST),
                                    'tail': ('fox_tail', 1.0, EMBER)},
     [('beasts_mane', 'crown', 1.0, RED_DUST, False), ('beasts_horn', 'brow', 0.9, HORN, True)]),
    ('Memeox (S body)', 'musk', 3, {'head': ('bear_head', 1.0, GREY_OX), 'torso': ('bear_torso', 0.85, GREY_OX),
                                    'arm': ('bear_arm', 0.85, GREY_OX), 'leg': ('bear_leg', 0.8, GREY_OX),
                                    'tail': ('fox_tail', 1.0, POST_BLUE)},
     [('beasts_mane', 'crown', 0.8, GREY_OX, False), ('hawk_wing', 'brow', 0.6, POST_BLUE, True)]),
    # Bezos line: a river otter. Flat reptile tail, a cardboard-coloured shell as its box; the finals split by body
    ('Cartotter', 'bezos', 0, {'head': ('cat_head', 1.0, OTTER), 'torso': ('bear_torso', 0.9, OTTER_BELLY),
                               'arm': ('cat_arm', 0.85, OTTER), 'leg': ('cat_leg', 0.8, OTTER),
                               'tail': ('reptile_tail', 0.9, OTTER)},
     [('bear_ear', 'ears', 0.5, OTTER, True)]),
    ('Primotter', 'bezos', 1, {'head': ('cat_head', 1.0, OTTER), 'torso': ('bear_torso', 1.05, OTTER_BELLY),
                               'arm': ('cat_arm', 1.0, OTTER), 'leg': ('cat_leg', 0.95, OTTER),
                               'tail': ('reptile_tail', 1.1, OTTER)},
     [('bear_ear', 'ears', 0.55, OTTER, True), ('beasts_shell', 'back', 0.7, CARDBOARD, False)]),
    ('Orbitotter (S body)', 'bezos', 2, {'head': ('cat_head', 1.0, OTTER), 'torso': ('bear_torso', 0.85, OTTER_BELLY),
                                         'arm': ('cat_arm', 0.9, OTTER), 'leg': ('cat_leg', 0.9, OTTER),
                                         'tail': ('shark_tailfin', 1.1, ROCKET)},
     [('bear_ear', 'ears', 0.55, OTTER, True), ('fish_spike', 'crown', 0.8, ROCKET, False)]),
    ('Everyotter (L body)', 'bezos', 3, {'head': ('cat_head', 1.0, OTTER), 'torso': ('bear_torso', 1.3, OTTER_BELLY),
                                         'arm': ('cat_arm', 1.15, OTTER), 'leg': ('cat_leg', 1.15, OTTER),
                                         'tail': ('reptile_tail', 1.3, OTTER)},
     [('bear_ear', 'ears', 0.6, OTTER, True), ('beasts_shell', 'back', 1.05, CARDBOARD, False)]),
    # Gates line: a goat. Small horns grow; the light final's horns become a blue screen crest, the heavy one a field
    ('Kidling', 'gates', 0, {'head': ('rabbit_head', 1.0, GOAT), 'torso': ('rabbit_torso', 0.9, GOAT),
                             'arm': ('rabbit_arm', 0.85, GOAT), 'leg': ('rabbit_leg', 0.85, GOAT),
                             'tail': ('rabbit_tail', 0.9, GOAT)},
     [('cat_ear', 'ears', 0.8, GOAT, True), ('beasts_horn', 'brow', 0.45, HORN, True)]),
    ('Billgoat', 'gates', 1, {'head': ('rabbit_head', 1.0, GOAT), 'torso': ('rabbit_torso', 1.05, GOAT),
                              'arm': ('rabbit_arm', 1.0, GOAT), 'leg': ('rabbit_leg', 1.0, GOAT),
                              'tail': ('rabbit_tail', 1.0, GOAT)},
     [('cat_ear', 'ears', 0.85, GOAT, True), ('beasts_horn', 'brow', 0.6, HORN, True),
      ('beasts_spikes', 'chin', 0.5, GOAT, False)]),
    ('Windowgoat (S body)', 'gates', 2, {'head': ('rabbit_head', 1.0, GOAT), 'torso': ('rabbit_torso', 0.85, GOAT),
                                         'arm': ('rabbit_arm', 0.9, GOAT), 'leg': ('rabbit_leg', 0.95, GOAT),
                                         'tail': ('rabbit_tail', 1.0, SCREEN)},
     [('cat_ear', 'ears', 0.85, GOAT, True), ('koi_dorsal', 'crown', 0.9, SCREEN, False),
      ('beasts_spikes', 'chin', 0.55, GOAT, False)]),
    ('Harvestgoat (L body)', 'gates', 3, {'head': ('rabbit_head', 1.0, GOAT), 'torso': ('rabbit_torso', 1.3, GOAT),
                                          'arm': ('rabbit_arm', 1.15, GOAT), 'leg': ('rabbit_leg', 1.2, GOAT),
                                          'tail': ('rabbit_tail', 1.2, LEAF)},
     [('cat_ear', 'ears', 0.9, GOAT, True), ('beasts_horn', 'brow', 0.85, HORN, True),
      ('birds_plume', 'crown', 0.8, LEAF, False), ('beasts_spikes', 'chin', 0.6, GOAT, False)]),
]


def recolour(im, c):
    if c is None:
        return im
    hue, sat, val = c
    a = np.array(im).astype(float) / 255
    rgb = a[..., :3].reshape(-1, 3)
    al = a[..., 3].reshape(-1)
    for i in np.nonzero(al > 0)[0]:
        h, s, v = colorsys.rgb_to_hsv(*rgb[i])
        if v < 0.22:                       # outlines stay
            continue
        if s < 0.12 and v > 0.85:          # eye highlights and whites stay, a little tinted
            continue
        rgb[i] = colorsys.hsv_to_rgb(hue, min(1.0, max(s, 0.12) * sat), min(1.0, v * val))
    a[..., :3] = rgb.reshape(a.shape[0], a.shape[1], 3)
    return Image.fromarray((a * 255).round().astype(np.uint8), 'RGBA')


def keep_eyes(head, c):
    """recolour a head but keep its face (eyes, nose, mouth: the darkest and most saturated pixels) as drawn"""
    if c is None:
        return head
    src = np.array(head)
    out = np.array(recolour(head, c))
    hsv = np.array(head.convert('RGB').convert('HSV')).astype(int)
    face = (hsv[..., 2] < 90) | ((hsv[..., 1] > 120) & (hsv[..., 2] > 140))   # dark features, pink noses
    out[face] = src[face]
    return Image.fromarray(out, 'RGBA')


def part(pid, view, f, c, head=False):
    im = Image.open(f'{PARTS}/{view}/{pid}.png').convert('RGBA')
    w, h = im.size
    size = (max(1, round(w * f)), max(1, round(h * f)))
    im = im.resize(size, Image.NEAREST if f >= 1 else Image.BOX)
    a = np.array(im)
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    im = Image.fromarray(a, 'RGBA')
    return keep_eyes(im, c) if head else recolour(im, c)


def paste(canvas, im, x, y):
    canvas.alpha_composite(im, (round(x), round(y)))


def build(slots, extras, stage, view):
    k = STAGE[stage]
    W, H = 150, 190
    cv = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    get = lambda slot: part(slots[slot][0], view, slots[slot][1] * k, slots[slot][2], head=slot == 'head')
    torso, head, arm, leg, tail = get('torso'), get('head'), get('arm'), get('leg'), get('tail')
    cx, ground = W / 2, H - 6
    tw, th = torso.size
    lw, lh = leg.size
    ty = ground - lh * 0.6 - th            # torso top
    hw, hh = head.size
    hy = ty - hh * 0.82                    # head top
    layers = []                            # (z, image, x, y)
    back = view == 'back'
    # tail sits behind on the right (front view), in front when seen from behind
    layers.append((8 if back else 1, tail, cx + tw * 0.18, ty + th * 0.55 - tail.size[1] * 0.5))
    layers.append((3, leg, cx - tw * 0.36, ground - lh))
    layers.append((3, leg.transpose(Image.FLIP_LEFT_RIGHT), cx + tw * 0.36 - lw, ground - lh))
    layers.append((5, torso, cx - tw / 2, ty))
    aw, ah = arm.size
    layers.append((2 if back else 7, arm, cx - tw * 0.5 - aw * 0.45, ty + th * 0.12))
    layers.append((2 if back else 7, arm.transpose(Image.FLIP_LEFT_RIGHT), cx + tw * 0.5 - aw * 0.55, ty + th * 0.12))
    layers.append((9, head, cx - hw / 2, hy))
    for pid, anchor, f, c, pair in extras:
        e = part(pid, view, f * k, c)
        ew, eh = e.size
        if anchor == 'brow':      # horns: either side of the top of the head, curling out
            x, y, z = cx - hw * 0.42 - ew * 0.5, hy - eh * 0.55, 10
        elif anchor == 'ears':
            x, y, z = cx - hw * 0.36 - ew * 0.5, hy - eh * 0.45, 8
        elif anchor == 'crown':
            x, y, z = cx - ew / 2, hy - eh * 0.55, 11
        elif anchor == 'chin':    # a goat's beard
            x, y, z = cx - ew / 2, hy + hh * 0.78, 10 if not back else 4
            e = e.transpose(Image.FLIP_TOP_BOTTOM)
        else:                     # 'back': carried on its back, behind (front view) or in front (back view)
            x, y, z = cx - ew / 2, ty - eh * 0.15, 6 if back else 4
        if pair:
            layers.append((z, e, x, y))
            layers.append((z, e.transpose(Image.FLIP_LEFT_RIGHT), 2 * cx - x - ew, y))
        else:
            layers.append((z, e, x, y))
    for z, im, x, y in sorted(layers, key=lambda t: t[0]):
        paste(cv, im, x, y)
    return cv


def main():
    os.makedirs(OUT, exist_ok=True)
    cell, cellh, pad = 150, 190, 8
    cols = 4
    rows = 3
    label_h = 18
    sheet = Image.new('RGBA', (cols * (cell * 2 + pad) + pad, rows * (cellh + label_h + pad) + pad + 26), (246, 241, 230, 255))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 12)
        big = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
    except OSError:
        font = big = ImageFont.load_default()
    d.text((pad, 6), 'Starters from the part kits (sample) - front and back of every form', fill=(60, 50, 40), font=big)
    recipes = []
    for i, (name, line, stage, slots, extras) in enumerate(FORMS):
        r, c = divmod(i, cols)
        x0 = pad + c * (cell * 2 + pad)
        y0 = 26 + pad + r * (cellh + label_h + pad)
        d.rounded_rectangle([x0, y0, x0 + cell * 2, y0 + cellh + label_h], 8, fill=(255, 252, 244, 255), outline=(220, 210, 190))
        for j, view in enumerate(('front', 'back')):
            sheet.alpha_composite(build(slots, extras, stage, view), (x0 + j * cell, y0))
        d.text((x0 + 8, y0 + cellh + 2), name, fill=(60, 50, 40), font=font)
        recipes.append({'name': name, 'line': line, 'stage': stage,
                        'slots': {k: {'part': v[0], 'size': v[1]} for k, v in slots.items()},
                        'extras': [{'part': e[0], 'at': e[1], 'size': e[2], 'pair': e[4]} for e in extras]})
    big_sheet = sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST)
    big_sheet.save(f'{OUT}/kit-starters.png', optimize=True)
    with open(f'{OUT}/kit-starters.json', 'w') as f:
        json.dump({'note': 'Phase 16 sample: the starters from the part kits (tools/sample-kit-starters.py). Not used by '
                           'the game.', 'forms': recipes}, f, indent=1)
    print('wrote', f'{OUT}/kit-starters.png', big_sheet.size)


if __name__ == '__main__':
    main()
