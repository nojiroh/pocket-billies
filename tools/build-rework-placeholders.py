#!/usr/bin/env python3
"""Phase 16 rework: placeholder art and rigs for the four new lines.

- Swift and Kardashian: a recolour of an existing sheet with the same body plan (outlines, eyes and highlights keep
  their value), and a copy of that species' rig pointing at the new sheet.
- Trump (a blob: huge body, tiny arms, slug tail) and Zuckerberg (an octopus stand-in): a sheet and a biped rig put
  together from the part kits (game/art/next/parts, sliced by the Studio's Art workbench), one size per stage.

Writes game/art/next/billionaires/<name>.png and the <name>.json piece layout (where the Studio
looks for every Billie's sheet), and adds the rigs (<line><stage>) to game/art/next/rigs-next.js, each marked
"placeholder". Replace any of it with real art in the Studio; run again to rebuild the placeholders.
Needs Pillow and numpy.
"""
import colorsys
import json
import math
import os
import re

import numpy as np
from PIL import Image

SRC = 'game/art/next/billionaires'
OUT = 'game/art/next/billionaires'
PARTS = 'game/art/next/parts'
RIGS = 'game/art/next/rigs-next.js'

# recolours: rig key -> (source rig key, source sheet, new sheet name, target hue 0-1, saturation scale)
RECOLOURS = {
    'swift0': ('jayz0', 'jaylet', 'swiftlet', 0.86, 0.9),
    'swift1': ('jayz1', 'hovajay', 'versewift', 0.86, 0.9),
    'swift2': ('jayz1', 'hovajay', 'erastar', 0.80, 1.1),
    'kardashian0': ('huang0', 'siliclet', 'kontourlet', 0.04, 0.55),
    'kardashian1': ('huang1', 'jenzard', 'filterleon', 0.95, 0.6),
    'kardashian2': ('huang2', 'gigajenzard', 'kardashleon', 0.92, 0.75),
}

# kit builds: per slot, a part id and a size factor; colours per piece group
STAGE_SCALE = [0.55, 0.75, 0.95]
KIT_BUILDS = {
    'trump': {
        'names': ['gildlet', 'gildslug', 'tremendoslug'],
        'legs': False,
        'parts': {'torso': ('bear_torso', 1.3), 'arm': ('bear_arm', 0.55), 'head': ('bear_head', 1.0),
                  'tail': ('reptile_tail', 1.25), 'crest': ('beasts_mane', 0.8)},
        # hide orange-tan; the crest gold
        'colour': {'*': (0.07, 1.5, 1.05), 'crest': (0.12, 1.6, 1.15)},
        # the slug tail is its back part, the golden crest its signature (Studio slot overrides)
        'slots': {'tail': 'back', 'crest': 'sig'},
    },
    'zuck': {
        'names': ['facelet', 'feedopus', 'metapus'],
        'legs': True,
        'parts': {'torso': ('carp_torso', 1.0), 'arm': ('koi_frontfin', 1.0), 'leg': ('piranha_backfin', 1.2),
                  'head': ('carp_head', 1.1), 'tail': ('shark_tailfin', 0.8), 'crest': ('beasts_mane', 0.45)},
        # pale, a little blue; the curly crest dark brown
        'colour': {'*': (0.58, 0.25, 1.12), 'crest': (0.07, 0.6, 0.55)},
        'slots': {'crest': 'head'},
    },
}


def recolour(im, hue, sat, val=1.0):
    a = np.array(im.convert('RGBA')).astype(float) / 255
    rgb = a[..., :3]
    out = rgb.copy()
    h, w = rgb.shape[:2]
    flat = rgb.reshape(-1, 3)
    al = a[..., 3].reshape(-1)
    res = out.reshape(-1, 3)
    for i in np.nonzero(al > 0)[0]:
        r, g, b = flat[i]
        hh, ss, vv = colorsys.rgb_to_hsv(r, g, b)
        if vv < 0.22 or (ss < 0.08 and vv > 0.9):   # outlines and white highlights stay
            continue
        ss = min(1.0, max(ss, 0.18) * sat)
        vv = min(1.0, vv * val)
        res[i] = colorsys.hsv_to_rgb(hue, ss, vv)
    a[..., :3] = res.reshape(h, w, 3)
    return Image.fromarray((a * 255).round().astype(np.uint8), 'RGBA')


def read_rigs():
    s = open(RIGS).read()
    head, body = s.split('window.RIGS_NEXT=', 1)
    return head, json.loads(body.rstrip().rstrip(';'))


def write_rigs(head, rigs):
    with open(RIGS, 'w') as f:
        f.write(head + 'window.RIGS_NEXT=' + json.dumps(rigs, separators=(',', ':')) + ';\n')


def part_img(pid, view, f):
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


with open('game/data/partKits.json') as _f:
    PART_SOCKETS = {k: {v: e['views'][v].get('sockets', {}) for v in e['views']} for k, e in json.load(_f)['parts'].items()}
# where a tail points from the front, degrees (0 = out to the right, 90 = up); the same table as tools/sample-kit-starters.py
TAIL_AIM = {'fox_tail': 60, 'cat_tail': 45, 'reptile_tail': -15, 'shark_tailfin': 10}


def kit_rig(line, spec, stage, pivots):
    """one stage of a kit-built Billie: a sheet with both views and its rig entry"""
    f = STAGE_SCALE[stage]
    BW = BH = 128
    cx, base = 64, 120
    views = {}
    pieces = []      # (view, bone, image)
    for view in ('front', 'back'):
        imgs = {}
        for slot, (pid, k) in spec['parts'].items():
            im = part_img(pid, view, f * k)
            hue, sat, val = spec['colour'].get(slot, spec['colour']['*'])
            imgs[slot] = recolour(im, hue, sat, val)
        views[view] = imgs
    # sheet: pieces in a row (front then back), mirrored copies for the right-hand limbs
    order = [('torso', False), ('tail', False), ('arm', False), ('arm', True), ('head', False), ('crest', False)]
    if spec['legs']:
        order[2:2] = [('leg', False), ('leg', True)]
    x = y = 2
    rowh = 0
    sheet_items = []
    for view in ('front', 'back'):
        for slot, mirror in order:
            im = views[view][slot]
            if mirror:
                im = im.transpose(Image.FLIP_LEFT_RIGHT)
            if x + im.size[0] + 2 > 512:
                x, y, rowh = 2, y + rowh + 2, 0
            sheet_items.append((view, slot, mirror, im, x, y))
            x += im.size[0] + 2
            rowh = max(rowh, im.size[1])
    H = y + rowh + 2
    sheet = Image.new('RGBA', (512, H), (0, 0, 0, 0))
    for _, _, _, im, sx, sy in sheet_items:
        sheet.alpha_composite(im, (sx, sy))
    rigs = {}
    for view in ('front', 'back'):
        items = [it for it in sheet_items if it[0] == view]
        get = {(s, m): it for it in items for s, m in [(it[1], it[2])]}
        imgs, idx = [], {}

        def socket(slot, name, mirror=False):
            """a part's socket in pixels of its picture here (game/data/partKits.json, worked out by the Studio's Art workbench)"""
            _, _, _, im, _, _ = get[(slot, mirror)]
            fx, fy = PART_SOCKETS[spec['parts'][slot][0]][view][name]
            return ((1 - fx) if mirror else fx) * im.size[0], fy * im.size[1]

        def add(slot, mirror, pivot=None):
            _, _, _, im, sx, sy = get[(slot, mirror)]
            if pivot is None:
                px, py = pivots[slot]
                pivot = (((1 - px) if mirror else px) * im.size[0], py * im.size[1])
            idx[(slot, mirror)] = len(imgs)
            imgs.append({'ox': -round(pivot[0]), 'oy': -round(pivot[1]), 'f': {'main': [sx, sy, im.size[0], im.size[1]]}})
            return im.size
        # every part joins at its socket: limbs by their joint, the head by its chin, the tail by its base
        tw, th = add('torso', False, None)
        add('tail', False, socket('tail', 'base'))
        add('arm', False, socket('arm', 'joint'))
        add('arm', True, socket('arm', 'joint', True))
        hw_, hh = add('head', False, socket('head', 'chin'))
        add('crest', False)
        if spec['legs']:
            lw, lh = add('leg', False, socket('leg', 'joint'))
            add('leg', True, socket('leg', 'joint', True))
        T = lambda name: (socket('torso', name)[0] - tw / 2, socket('torso', name)[1] - th / 2)   # from the torso's middle
        if spec['legs']:
            jy = socket('leg', 'joint')[1]
            hip_y = T('hipL')[1]
            torso_y = -(lh - jy) - hip_y             # the feet meet the ground line
        else:
            torso_y = -round(th / 2)                 # a blob sits on its body
        bones = [{'n': 'torso', 'par': 'root', 'at': [0, round(torso_y)], 'z': 5, 'zb': 5, 'i': idx[('torso', False)]}]
        # the tail: from the torso's tail socket, turned to point the way the sample shows (TAIL_AIM)
        tb, tt = socket('tail', 'base'), socket('tail', 'tip')
        now = math.degrees(math.atan2(-(tt[1] - tb[1]), tt[0] - tb[0]))
        aim = TAIL_AIM.get(spec['parts']['tail'][0], 0)
        want = aim if view == 'front' else aim * 0.6   # the back view is drawn mirrored on screen
        bones.append({'n': 'tail', 'par': 'torso', 'at': [round(v) for v in T('tail')], 'z': 1, 'zb': 8,
                      'i': idx[('tail', False)], 'lag': 1, 'rr': round(-math.radians(want - now), 3)})
        if spec['legs']:
            bones.append({'n': 'legL', 'par': 'torso', 'at': [round(v) for v in T('hipL')], 'z': 7, 'zb': 7, 'i': idx[('leg', False)]})
            bones.append({'n': 'legR', 'par': 'torso', 'at': [round(v) for v in T('hipR')], 'z': 7, 'zb': 7, 'i': idx[('leg', True)]})
        # the kit draws each arm as the creature's own left arm (the viewer's right, paw reaching in); mirrored on the
        # viewer's left. Both hang from the torso's shoulder sockets.
        bones.append({'n': 'armL', 'par': 'torso', 'at': [round(v) for v in T('shoulderL')], 'z': 8, 'zb': 2, 'i': idx[('arm', True)],
                      'rr': arm_rest(get[('arm', True)][3], False)})
        bones.append({'n': 'armR', 'par': 'torso', 'at': [round(v) for v in T('shoulderR')], 'z': 8, 'zb': 2, 'i': idx[('arm', False)],
                      'rr': arm_rest(get[('arm', False)][3], True)})
        nx, ny = T('neck')
        head = {'n': 'head', 'par': 'torso', 'at': [round(nx), round(ny + hh * 0.12)], 'z': 9, 'zb': 9, 'i': idx[('head', False)]}
        if view == 'front':
            head['face'] = True
        bones.append(head)
        chin_y = socket('head', 'chin')[1]
        bones.append({'n': 'crest', 'par': 'head', 'at': [0, -round(chin_y * 0.92)], 'z': 10, 'zb': 10, 'i': idx[('crest', False)]})
        for b in bones:
            if b['n'] in spec['slots']:
                b['slot'] = spec['slots'][b['n']]
        # rest-pose bounds for geo
        pos = {'root': (0, 0)}
        top, left, right = 0, 0, 0
        for b in bones:
            p = pos[b['par']]
            q = (p[0] + b['at'][0], p[1] + b['at'][1])
            pos[b['n']] = q
            e = imgs[b['i']]
            w, h = e['f']['main'][2], e['f']['main'][3]
            top = min(top, q[1] + e['oy'])
            left = min(left, q[0] + e['ox'])
            right = max(right, q[0] + e['ox'] + w)
        t = base + top
        rigs[view] = {'k': 1, 'BW': BW, 'BH': BH, 'cx': cx, 'base': base, 'tipX': 0, 'plan': 'biped',
                      'q': {'lift': 0, 'flapMs': 300},
                      'geo': {'cx': cx, 'base': base, 'top': t, 'mid': (t + base) / 2, 'hw': (right - left) / 2,
                              'lift': 0, 'k': 1, 'cy': (t + base) / 2},
                      'size': [512, H], 'imgs': imgs, 'bones': bones, 'clock': 12,
                      'sheet': f"next/billionaires/{spec['names'][stage]}.png", 'placeholder': 'part kit'}
    return sheet, rigs


ARM_OUT = 15   # how an arm rests: hanging straight down, the paw this many degrees out from the body


def arm_rest(im, out_right):
    """the rest tilt (radians, as a rig bone's rr: positive turns clockwise on screen) that hangs an arm straight down
    with its paw ARM_OUT degrees out from the body; the idle animation sways around it"""
    import math
    ys, xs = np.nonzero(np.array(im)[..., 3] > 0)
    top, bot = ys.min(), ys.max()
    sx, sy = xs[ys <= top + 3].mean(), top
    px, py = xs[ys >= bot - 3].mean(), bot
    now = math.degrees(math.atan2(-(py - sy), px - sx))
    want = -90 + (ARM_OUT if out_right else -ARM_OUT)
    return round(-math.radians(want - now), 3)


def kit_layout(name, rig):
    """the piece layout file the Studio reads beside a sheet (as tools/build-roster-sheets.py writes them)"""
    f = rig['front']
    out = {'id': name, 'w': f['BW'], 'h': f['BH'], 'cx': f['cx'], 'base': f['base'], 'plan': f['plan'],
           'placeholder': 'part kit', 'pieces': []}
    for view in ('front', 'back'):
        R = rig[view]
        pos = {'root': (R['cx'], R['base'])}
        for b in R['bones']:
            p = pos[b['par']]
            q = (p[0] + b['at'][0], p[1] + b['at'][1])
            pos[b['n']] = q
            e = R['imgs'][b['i']]
            x, y, w, h = e['f']['main']
            out['pieces'].append({'n': b['n'], 'v': 'main', 'group': view, 'x': x, 'y': y, 'w': w, 'h': h,
                                  'px': q[0] + e['ox'], 'py': q[1] + e['oy'], 'pivot': [-e['ox'], -e['oy']],
                                  'par': b['par']})
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    head, rigs = read_rigs()
    with open('game/data/partKits.json') as f:
        P = json.load(f)['parts']
    for key, (src_key, src, new, hue, sat) in RECOLOURS.items():
        recolour(Image.open(f'{SRC}/{src}.png'), hue, sat).save(f'{OUT}/{new}.png', optimize=True)
        with open(f'{SRC}/{src}.json') as f:
            lay = json.load(f)
        lay['id'] = new
        lay['placeholder'] = 'recolour of ' + src
        with open(f'{OUT}/{new}.json', 'w') as f:
            json.dump(lay, f, separators=(',', ':'))
        r = json.loads(json.dumps(rigs[src_key]))
        for v in r.values():
            v['sheet'] = f'next/billionaires/{new}.png'
            v['placeholder'] = 'recolour of ' + src
        rigs[key] = r
        print(key, '<-', src)
    for line, spec in KIT_BUILDS.items():
        pivots = {slot: P[pid]['pivot'] for slot, (pid, _) in spec['parts'].items()}
        for stage in range(3):
            sheet, r = kit_rig(line, spec, stage, pivots)
            name = spec['names'][stage]
            sheet.save(f'{OUT}/{name}.png', optimize=True)
            rigs[f'{line}{stage}'] = r
            with open(f'{OUT}/{name}.json', 'w') as f:
                json.dump(kit_layout(name, r), f, separators=(',', ':'))
            print(f'{line}{stage}', '<- part kit')
    write_rigs(re.sub(r'\n?$', '\n', head) if not head.endswith('\n') else head, rigs)


if __name__ == '__main__':
    main()
