#!/usr/bin/env python3
"""Phase 16: slice the placeholder part kits into separate pieces.

Input:  tools/art-source/part-kit/kits.json and, per kit, <name>-front.png and
        <name>-back.png (six animals as columns on a magenta background, one row
        per slot, then a row of extras). Kept out of the game folder so they
        never ship.
Output: game/art/next/parts/<view>/<id>.png at game scale and
        game/data/partKits.json (kit, animal, slot, pivot per piece).

Ids are <animal>_<row> and <kit>_<extra>, so adding a kit never renames old
parts. Run again after adding or replacing a kit. Needs Pillow, numpy and scipy.
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

SRC = 'tools/art-source/part-kit'
ROOT = 'game/art/next/parts'
SCALE = 1 / 4      # source is drawn large; at 1/4 a full biped fits the 128 px stage box
MIN_AREA = 800     # ignore specks smaller than this (source pixels)
JOIN = 6           # pieces closer than this (source pixels) are one part


def mask_of(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    magenta = (r > 150) & (b > 150) & (g < 120) & (np.abs(r - b) < 70)
    # No hole filling: magenta trapped between strands must stay out.
    return ndimage.binary_opening(~magenta, iterations=1)


def split_rows(items, count):
    """Split items (sorted by centre y) into `count` rows at the biggest gaps."""
    items.sort(key=lambda p: p['cy'])
    gaps = sorted(range(1, len(items)), key=lambda i: items[i]['cy'] - items[i - 1]['cy'], reverse=True)
    cuts = sorted(gaps[:count - 1])
    rows, start = [], 0
    for c in cuts + [len(items)]:
        rows.append(sorted(items[start:c], key=lambda p: p['cx']))
        start = c
    return rows


def pieces(path, kit):
    rgb = np.array(Image.open(path).convert('RGB')).astype(int)
    fg = mask_of(rgb)
    groups, _ = ndimage.label(ndimage.binary_dilation(fg, iterations=JOIN))
    items = []
    for i, sl in enumerate(ndimage.find_objects(groups)):
        m = fg[sl] & (groups[sl] == i + 1)
        if m.sum() < MIN_AREA:
            continue
        items.append({'cy': (sl[0].start + sl[0].stop) / 2, 'cx': (sl[1].start + sl[1].stop) / 2,
                      'sl': sl, 'm': m})
    names = kit['rows'] + ['extras']
    rows = split_rows(items, len(names))
    want = [len(kit['animals'])] * len(kit['rows']) + [len(kit['extras'])]
    got = [len(r) for r in rows]
    if got != want:
        sys.exit(f'{path}: expected parts per row {want}, found {got}. Check the sheet layout.')
    rgba = np.dstack([rgb, np.zeros(rgb.shape[:2], int)]).astype(np.uint8)
    for r, row in enumerate(rows):
        for c, it in enumerate(row):
            if r < len(kit['rows']):
                kind, animal, pid = kit['rows'][r], kit['animals'][c], f"{kit['animals'][c]}_{kit['rows'][r]}"
            else:
                kind, animal, pid = kit['extras'][c], 'any', f"{kit['name']}_{kit['extras'][c]}"
            piece = rgba[it['sl']].copy()
            m = ndimage.binary_erosion(it['m'], iterations=1)   # drop magenta fringe
            piece[..., 3] = np.where(m, 255, 0)
            yield pid, kind, animal, Image.fromarray(piece, 'RGBA')


def to_game_scale(img):
    w, h = img.size
    size = (max(1, round(w * SCALE)), max(1, round(h * SCALE)))
    a = np.array(img).astype(float)
    a[..., :3] *= a[..., 3:4] / 255            # premultiply so edges stay clean
    small = np.array(Image.fromarray(a.astype(np.uint8), 'RGBA').resize(size, Image.BOX)).astype(float)
    alpha = small[..., 3]
    rgb = np.where(alpha[..., None] > 0, small[..., :3] * 255 / np.maximum(alpha[..., None], 1), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    pinkish = (b - g > 40) & (r - g > 60)       # leftover background, also when mixed with outline
    keep = (alpha >= 128) & ~pinkish
    out = np.dstack([np.clip(rgb, 0, 255), np.where(keep, 255, 0)]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def opaque(img):
    a = np.array(img)[..., 3] > 0
    ys, xs = np.nonzero(a)
    return a, xs, ys


def row_span(a, y):
    """the leftmost and rightmost filled pixel on row y (or the nearest filled row)"""
    for dy in range(0, a.shape[0]):
        for yy in (y - dy, y + dy):
            if 0 <= yy < a.shape[0] and a[yy].any():
                xs = np.nonzero(a[yy])[0]
                return xs.min(), xs.max(), yy
    return 0, a.shape[1] - 1, y


def auto_sockets(kind, slot, img, view):
    """where this part connects, worked out from its outline (fractions of the picture)"""
    a, xs, ys = opaque(img)
    w, h = img.size
    top, bot = ys.min(), ys.max()
    f = lambda x, y: [round(x / w, 3), round(y / h, 3)]
    if slot == 'body' and kind in ('torso',):
        ht = bot - top
        nx = xs[ys <= top + 2].mean()
        sy = top + ht * 0.2
        l, r, sy = row_span(a, round(sy))
        hy = top + ht * 0.86
        hl, hr, hy = row_span(a, round(hy))
        hc, hw = (hl + hr) / 2, (hr - hl) / 2
        ty_ = top + ht * 0.8
        tl, tr, ty_ = row_span(a, round(ty_))
        return {
            'neck': f(nx, top + 1),
            'shoulderL': f(l + 3, sy), 'shoulderR': f(r - 3, sy),
            'hipL': f(hc - hw * 0.5, hy), 'hipR': f(hc + hw * 0.5, hy),
            # from the front the tail grows behind the hip at the side; from behind, from the middle of the rump
            'tail': f(tr - 4, ty_) if view == 'front' else f((tl + tr) / 2, top + ht * 0.9),
        }
    if slot in ('front', 'back') or kind in ('arm', 'leg', 'wing', 'frontfin', 'backfin', 'foot'):
        sel = ys <= top + 3
        sel_b = ys >= bot - 3
        return {'joint': f(xs[sel].mean(), top), 'end': f(xs[sel_b].mean(), bot)}
    if slot == 'head' and kind == 'head':
        sel = ys >= bot - 2
        return {'chin': f(xs[sel].mean(), bot - 1)}
    return {}


def main():
    with open(f'{SRC}/kits.json') as f:
        cfg = json.load(f)
    manifest = {}
    for view in ('front', 'back'):
        os.makedirs(f'{ROOT}/{view}', exist_ok=True)
    for kit in cfg['kits']:
        for view in ('front', 'back'):
            for pid, kind, animal, img in pieces(f"{SRC}/{kit['name']}-{view}.png", kit):
                if pid in manifest and manifest[pid]['kit'] != kit['name']:
                    sys.exit(f"Part id {pid} is used by kits {manifest[pid]['kit']} and {kit['name']}.")
                small = to_game_scale(img)
                small.save(f'{ROOT}/{view}/{pid}.png', optimize=True)
                e = manifest.setdefault(pid, {'kit': kit['name'], 'animal': animal, 'kind': kind,
                                              'slot': cfg['slots'][kind], 'pivot': cfg['pivots'][kind],
                                              'size': 'M', 'views': {}})
                sk = auto_sockets(kind, cfg['slots'][kind], small, view)
                sk.update((cfg.get('sockets', {}).get(pid, {}) or {}).get(view, {}))
                e['views'][view] = {'file': f'next/parts/{view}/{pid}.png', 'w': small.size[0], 'h': small.size[1],
                                    'sockets': sk}
    with open('game/data/partKits.json', 'w') as f:
        json.dump({'note': 'Placeholder part kits, phase 16. Made by tools/slice-part-kit.py from '
                           'tools/art-source/part-kit. Do not edit by hand.', 'parts': manifest}, f, indent=1)
    print(len(manifest), 'parts in', len(cfg['kits']), 'kits')


if __name__ == '__main__':
    main()
