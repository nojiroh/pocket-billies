#!/usr/bin/env python3
"""Phase 16: slice the placeholder part kit into separate pieces.

Input:  tools/art-source/part-kit/kit-front.png and kit-back.png (kept out of the game folder so they never ship)
        (a 6-column grid of parts on a magenta background, drawn large).
Output: game/art/next/parts/<view>/<animal>_<slot>.png at game scale
        and game/art/next/parts/parts.json (size, pivot, slot per piece).

Columns are animals, rows are slots. Row 7 holds four extras.
Run again after replacing a source sheet; ids stay the same. Needs Pillow, numpy and scipy.
"""
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = 'game/art/next/parts'
ANIMALS = ['cat', 'rabbit', 'fox', 'bear', 'bird', 'reptile']
ROWS = ['head', 'ear', 'torso', 'arm', 'leg', 'tail']
EXTRAS = ['horn', 'spikes', 'mane', 'shell']
# Game slot for each row (see docs/phases/16, section 2).
SLOT = {'head': 'head', 'ear': 'head-extra', 'torso': 'body', 'arm': 'front',
        'leg': 'back', 'tail': 'signature', 'horn': 'head-extra',
        'spikes': 'signature', 'mane': 'signature', 'shell': 'body-extra'}
# Pivot as a fraction of the piece box: where it attaches to its parent.
PIVOT = {'head': (0.5, 0.92), 'ear': (0.5, 0.95), 'torso': (0.5, 0.5),
         'arm': (0.5, 0.08), 'leg': (0.5, 0.1), 'tail': (0.1, 0.5),
         'horn': (0.5, 0.95), 'spikes': (0.5, 0.95), 'mane': (0.5, 0.6),
         'shell': (0.5, 0.6)}
SCALE = 1 / 4          # source is drawn large; at 1/4 a full biped fits the 128 px stage box
MIN_AREA = 800         # ignore specks smaller than this (source pixels)


def mask_of(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    magenta = (r > 150) & (b > 150) & (g < 120) & (np.abs(r - b) < 70)
    fg = ndimage.binary_opening(~magenta, iterations=1)
    return fg   # no hole filling: magenta trapped between strands must stay out


def pieces(path):
    rgb = np.array(Image.open(path).convert('RGB')).astype(int)
    fg = mask_of(rgb)
    lab, n = ndimage.label(fg)
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        area = (lab[sl] == i + 1).sum()
        if area < MIN_AREA:
            continue
        cy = (sl[0].start + sl[0].stop) / 2
        cx = (sl[1].start + sl[1].stop) / 2
        out.append((cy, cx, sl, lab[sl] == i + 1))
    # Group into rows by centre height, then sort each row left to right.
    out.sort(key=lambda p: p[0])
    rows, cur = [], [out[0]]
    for p in out[1:]:
        if p[0] - cur[-1][0] > 60:
            rows.append(cur)
            cur = []
        cur.append(p)
    rows.append(cur)
    rgba = np.dstack([rgb, np.zeros(rgb.shape[:2], int)]).astype(np.uint8)
    result = []
    for r, row in enumerate(rows):
        row.sort(key=lambda p: p[1])
        names = ROWS[r] if r < len(ROWS) else None
        for c, (_, _, sl, m) in enumerate(row):
            kind = names if names else EXTRAS[c]
            animal = ANIMALS[c] if names else 'any'
            piece = rgba[sl].copy()
            m = ndimage.binary_erosion(m, iterations=1)   # drop magenta fringe
            piece[..., 3] = np.where(m, 255, 0)
            result.append((animal, kind, Image.fromarray(piece, 'RGBA')))
    return result


def to_game_scale(img):
    w, h = img.size
    size = (max(1, round(w * SCALE)), max(1, round(h * SCALE)))
    a = np.array(img).astype(float)
    a[..., :3] *= a[..., 3:4] / 255            # premultiply so edges stay clean
    small = np.array(Image.fromarray(a.astype(np.uint8), 'RGBA').resize(size, Image.BOX)).astype(float)
    alpha = small[..., 3]
    rgb = np.where(alpha[..., None] > 0, small[..., :3] * 255 / np.maximum(alpha[..., None], 1), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    pinkish = (b - g > 40) & (r - g > 60)   # leftover background, also when mixed with outline
    keep = (alpha >= 128) & ~pinkish
    out = np.dstack([np.clip(rgb, 0, 255), np.where(keep, 255, 0)]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def main():
    manifest = {}
    for view in ('front', 'back'):
        os.makedirs(f'{ROOT}/{view}', exist_ok=True)
        for animal, kind, img in pieces(f'tools/art-source/part-kit/kit-{view}.png'):
            pid = f'{animal}_{kind}'
            small = to_game_scale(img)
            small.save(f'{ROOT}/{view}/{pid}.png', optimize=True)
            e = manifest.setdefault(pid, {'animal': animal, 'kind': kind, 'slot': SLOT[kind],
                                          'pivot': PIVOT[kind], 'size': 'M', 'views': {}})
            e['views'][view] = {'file': f'next/parts/{view}/{pid}.png', 'w': small.size[0], 'h': small.size[1]}
    with open(f'{ROOT}/parts.json', 'w') as f:
        json.dump({'note': 'Placeholder part kit, phase 16. Made by tools/slice-part-kit.py.',
                   'parts': manifest}, f, indent=1)
    print(len(manifest), 'parts')


if __name__ == '__main__':
    main()
