#!/usr/bin/env python3
"""Routes track RT-1: the forest canopy pieces that fill a forest mass on a laid-out route (logic/mapgen.js
mapgenStageLayout). A mass is a wall of the biome's real trees along its edge and these inside: one low-poly piece
about 6 x 5 m, made of mesh shapes only (a dark understorey and lumpy leaf globes or cones; no picture layers), so a
piece is one draw and its shadow, where a model tree is a draw plus one per drawn leaf clump. A piece blocks walking
by its `solid` disc; pieces overlap, so the mass is solid as a whole.

    python3 tools/build-forest-canopy.py      # writes everything below; run it again after changing it

Writes game/art/scene/next/models/forest_canopy*.json, their fallback pictures game/art/scene/next/forest/*.png
(shown when models are off), and the catalogue entries in game/data/scenery.json.
"""
import json
import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import gamedata  # noqa: E402

PPM = 32
MODELS = ROOT / 'game' / 'art' / 'scene' / 'next' / 'models'
PICS = ROOT / 'game' / 'art' / 'scene' / 'next' / 'forest'
SOLID = 2.4  # the walk disc's radius (metres): pieces 3.6 m apart leave no gap

# key: (name, kind of crown, understorey colour, crown colours dark to light)
PIECES = {
    'forest_canopy': ('Forest canopy', 'globe', '#22391F', ['#2F5428', '#3D6B30', '#4F833A', '#679B48']),
    'forest_canopy_pine': ('Pine forest canopy', 'cone', '#1B2E1E', ['#22402B', '#2C5235', '#386542', '#4A7A52']),
    'forest_canopy_autumn': ('Autumn forest canopy', 'globe', '#3A2A18', ['#8A3F1C', '#B45721', '#C97A2A', '#DDA040']),
}


def r2(v):
    return round(v, 3)


def crown(kind, cols, rnd):
    """the leaf shapes: [layer], each with its colour index for the picture"""
    out = []
    if kind == 'globe':
        for i in range(10):
            a = rnd.uniform(0, math.tau)
            d = math.sqrt(rnd.random())
            r = rnd.uniform(1.25, 1.75)
            out.append({'k': 'sphere', 'x': r2(math.cos(a) * d * 1.7), 'y': r2(0.3 + math.sin(a) * d * 1.3),
                        'z': r2(rnd.uniform(1.0, 2.0)), 'r': r2(r), 'ry': r2(r * 0.9), 'h': r2(rnd.uniform(2.8, 3.8)),
                        'sides': 9, 'rings': 4, 'lump': 0.3, 'col': cols[rnd.randrange(len(cols))], 'tex': 'leaves',
                        'name': 'crown'})
    else:
        for i in range(8):
            a = rnd.uniform(0, math.tau)
            d = math.sqrt(rnd.random())
            r = rnd.uniform(0.95, 1.35)
            out.append({'k': 'cone', 'x': r2(math.cos(a) * d * 1.9), 'y': r2(0.3 + math.sin(a) * d * 1.4),
                        'z': r2(rnd.uniform(0.6, 1.2)), 'r': r2(r), 'ry': r2(r), 'r1': 0, 'h': r2(rnd.uniform(4.2, 5.6)),
                        'sides': 7, 'col': cols[rnd.randrange(len(cols))], 'tex': 'leaves', 'name': 'crown'})
    out.sort(key=lambda L: -L['y'])
    return out


def model_of(key, kind, under, cols):
    rnd = random.Random(key)
    cols = [c[:7] for c in cols]
    layers = [{'k': 'cyl', 'x': 0, 'y': 0.3, 'z': 0, 'r': 2.5, 'ry': 2.0, 'h': 1.7, 'sides': 10, 'col': under,
               'tex': 'leaves', 'name': 'understorey'}]
    for x in (-1.4, -0.2, 1.1):  # trunks peeking out under the front
        layers.append({'k': 'limb', 'x': r2(x), 'y': -1.55, 'z': 0, 'x2': r2(x + rnd.uniform(-0.1, 0.1)), 'y2': -1.45,
                       'z2': 1.6, 'r': 0.16, 'r1': 0.11, 'sides': 6, 'col': '#5A4130', 'tex': 'bark', 'name': 'trunk'})
    layers += crown(kind, cols, rnd)
    return {'ppm': PPM, 'cel': 0.7, 'layers': layers}


def shade(hexc, f):
    c = [int(hexc[i:i + 2], 16) for i in (1, 3, 5)]
    return tuple(max(0, min(255, round(v * f))) for v in c) + (255,)


def picture_of(M):
    """a front view of the model, back to front, at 32 px/m: the base point (front middle) at (ox, oy)"""
    W, H = int(7.2 * PPM), int(7.4 * PPM)
    bx, by = W // 2, H - 4
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    for L in sorted(M['layers'], key=lambda L: -L.get('y', 0)):
        x, z, col = L['x'], L['z'], L['col']
        if L['k'] == 'limb':
            dr.rectangle([bx + (x - 0.14) * PPM, by - L['z2'] * PPM, bx + (x + 0.14) * PPM, by], fill=shade(col, 1))
        elif L['k'] == 'cyl':
            dr.ellipse([bx + (x - L['r']) * PPM, by - (z + L['h'] + 0.3) * PPM, bx + (x + L['r']) * PPM, by - z * PPM],
                       fill=shade(col, 1))
        elif L['k'] == 'sphere':
            box = [bx + (x - L['r']) * PPM, by - (z + L['h']) * PPM, bx + (x + L['r']) * PPM, by - z * PPM]
            dr.ellipse(box, fill=shade(col, 0.85))
            dr.ellipse([box[0] + 6, box[1] + 3, box[2] - 10, box[3] - 12], fill=shade(col, 1.08))
        elif L['k'] == 'cone':
            top, x0, x1 = by - (z + L['h']) * PPM, bx + (x - L['r']) * PPM, bx + (x + L['r']) * PPM
            dr.polygon([(x0, by - z * PPM), (x1, by - z * PPM), (bx + x * PPM, top)], fill=shade(col, 0.85))
            dr.polygon([(x0 + 4, by - z * PPM - 2), (bx + x * PPM, by - z * PPM - 2), (bx + x * PPM, top + 4)],
                       fill=shade(col, 1.08))
    return im, -bx, -by


def main():
    MODELS.mkdir(parents=True, exist_ok=True)
    PICS.mkdir(parents=True, exist_ok=True)
    D = gamedata.load()
    C = D['scenery']['props']
    for key, (name, kind, under, cols) in PIECES.items():
        M = model_of(key, kind, under, cols)
        (MODELS / f'{key}.json').write_text(json.dumps(M, separators=(',', ':')) + '\n', encoding='utf-8')
        im, ox, oy = picture_of(M)
        im.save(PICS / f'{key}.png')
        C[key] = {'name': name, 'img': f'scene/next/forest/{key}.png', 'ox': ox, 'oy': oy, 'shadow': 2.2, 'sway': 0,
                  'flat': 0, 'tags': ['route', 'forest'], 'group': 'forest_canopy', 'solid': SOLID, 'ppm': PPM,
                  'model': f'scene/next/models/{key}.json', 'vary': {'rot': 1, 'lean': 0}}
        print(f'{key}: {len(M["layers"])} layers, picture {im.size[0]}x{im.size[1]}')
    gamedata.save(D)


if __name__ == '__main__':
    main()
