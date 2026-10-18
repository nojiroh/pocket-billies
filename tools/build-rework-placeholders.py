#!/usr/bin/env python3
"""Phase 16 rework: placeholder sheets for the new prototype Billies.

Each placeholder is a recolour of an existing piece sheet with the same body
plan, so the existing rig (pieces, pivots, bones) works unchanged. Outlines,
eyes and highlights keep their value; only hue and saturation move.
Output: game/art/next/placeholders/<newid>.png + .json (copied piece map).
Replace these with real art in the Studio; nothing in the game loads them yet.
"""
import colorsys, json, os, shutil
from PIL import Image

SRC = 'game/art/next/billionaires'
OUT = 'game/art/next/placeholders'

# new id: (source sheet, target hue 0-1, saturation scale)
PLAN = {
    # Swift line, bird plan, from the jay line (stage 3 reuses the stage 2 sheet)
    'swiftlet':   ('jaylet', 0.86, 0.9),
    'versewift':  ('hovajay', 0.86, 0.9),
    'erastar':    ('hovajay', 0.80, 1.1),
    # Kardashian line, quad plan, from the gecko line
    'kontourlet': ('siliclet', 0.04, 0.55),
    'filterleon': ('jenzard', 0.95, 0.6),
    'kardashleon':('gigajenzard', 0.92, 0.75),
    # Trump line, quad plan, from the elephant line
    'tycalf':     ('tuskling', 0.08, 1.6),
    'towerphant': ('reliancephant', 0.08, 1.8),
    'tremendophant': ('antiliaphant_gold', 0.11, 1.2),
}

def recolour(im, hue, sat):
    px = im.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if v < 0.22 or s < 0.08 and v > 0.9:   # outlines and white highlights stay
                continue
            s = min(1.0, max(s, 0.18) * sat)
            r2, g2, b2 = colorsys.hsv_to_rgb(hue, s, v)
            px[x, y] = (round(r2 * 255), round(g2 * 255), round(b2 * 255), a)
    return im

os.makedirs(OUT, exist_ok=True)
for new, (src, hue, sat) in PLAN.items():
    im = recolour(Image.open(f'{SRC}/{src}.png').convert('RGBA'), hue, sat)
    im.save(f'{OUT}/{new}.png', optimize=True)
    base = src.replace('_gold', '')
    with open(f'{SRC}/{base}.json') as f:
        meta = json.load(f)
    meta['id'] = new
    meta['placeholder'] = {'from': src}
    with open(f'{OUT}/{new}.json', 'w') as f:
        json.dump(meta, f, separators=(',', ':'))
    print(new, '<-', src)
