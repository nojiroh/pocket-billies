#!/usr/bin/env python3
"""Phase 16 rework: placeholder art and rigs for the four new lines.

- Swift and Kardashian: a recolour of an existing sheet with the same body plan (outlines, eyes and highlights keep
  their value), and a copy of that species' rig pointing at the new sheet.
- Trump (a blob: huge body, tiny arms, slug tail) and Zuckerberg (an octopus stand-in): a sheet and a biped rig put
  together from the part kits (game/art/next/parts, tools/slice-part-kit.py), one size per stage.

Writes game/art/next/billionaires/<name>.png, <name>_gold.png and the <name>.json piece layout (where the Studio
looks for every Billie's sheet), and adds the rigs (<line><stage>) to game/art/next/rigs-next.js, each marked
"placeholder". Replace any of it with real art in the Studio; run again to rebuild the placeholders.
Needs Pillow and numpy.
"""
import colorsys
import json
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


def gold(im):
    """a Gold-Plated version: brightness mapped onto a gold ramp, outlines kept"""
    return recolour(im, 0.12, 1.4, 1.08)


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

        def add(slot, mirror):
            _, _, _, im, sx, sy = get[(slot, mirror)]
            px, py = pivots[slot]
            if mirror:
                px = 1 - px
            idx[(slot, mirror)] = len(imgs)
            imgs.append({'ox': -round(im.size[0] * px), 'oy': -round(im.size[1] * py),
                         'f': {'main': [sx, sy, im.size[0], im.size[1]]}})
            return im.size
        tw, th = add('torso', False)
        tlw, tlh = add('tail', False)
        aw, ah = add('arm', False)
        add('arm', True)
        hw_, hh = add('head', False)
        add('crest', False)
        if spec['legs']:
            lw, lh = add('leg', False)
            add('leg', True)
        legs_up = round(lh * 0.55) if spec['legs'] else 0
        # the torso's pivot is its middle: lift it so its bottom (or the feet) sits on the ground line
        bones = [{'n': 'torso', 'par': 'root', 'at': [0, -round(th / 2) - legs_up], 'z': 5, 'zb': 5, 'i': idx[('torso', False)]}]
        bones.append({'n': 'tail', 'par': 'torso', 'at': [round(tw * 0.32), round(th * 0.32)], 'z': 1, 'zb': 8,
                      'i': idx[('tail', False)], 'lag': 1})
        if spec['legs']:
            bones.append({'n': 'legL', 'par': 'torso', 'at': [-round(tw * 0.22), round(th * 0.38)], 'z': 7, 'zb': 7, 'i': idx[('leg', False)]})
            bones.append({'n': 'legR', 'par': 'torso', 'at': [round(tw * 0.22), round(th * 0.38)], 'z': 7, 'zb': 7, 'i': idx[('leg', True)]})
        bones.append({'n': 'armL', 'par': 'torso', 'at': [-round(tw * 0.42), -round(th * 0.28)], 'z': 8, 'zb': 2, 'i': idx[('arm', False)]})
        bones.append({'n': 'armR', 'par': 'torso', 'at': [round(tw * 0.42), -round(th * 0.28)], 'z': 8, 'zb': 2, 'i': idx[('arm', True)]})
        head = {'n': 'head', 'par': 'torso', 'at': [0, -round(th * 0.42)], 'z': 9, 'zb': 9, 'i': idx[('head', False)]}
        if view == 'front':
            head['face'] = True
        bones.append(head)
        bones.append({'n': 'crest', 'par': 'head', 'at': [0, -round(hh * 0.78)], 'z': 10, 'zb': 10, 'i': idx[('crest', False)]})
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
    with open(f'{PARTS}/parts.json') as f:
        P = json.load(f)['parts']
    for key, (src_key, src, new, hue, sat) in RECOLOURS.items():
        recolour(Image.open(f'{SRC}/{src}.png'), hue, sat).save(f'{OUT}/{new}.png', optimize=True)
        Image.open(f'{SRC}/{src}_gold.png').save(f'{OUT}/{new}_gold.png', optimize=True)
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
            gold(sheet).save(f'{OUT}/{name}_gold.png', optimize=True)
            rigs[f'{line}{stage}'] = r
            with open(f'{OUT}/{name}.json', 'w') as f:
                json.dump(kit_layout(name, r), f, separators=(',', ':'))
            print(f'{line}{stage}', '<- part kit')
    write_rigs(re.sub(r'\n?$', '\n', head) if not head.endswith('\n') else head, rigs)


if __name__ == '__main__':
    main()
