#!/usr/bin/env python3
"""v35: the master palette for the new art style. 20 hue ramps x 8 steps = 160 colours, built the way the hand-painted
sets shade: each step darker is cooler and a touch richer, each step lighter is warmer and a touch paler, so one
ramp reads as one material under one light. Writes game/art/next/palette.png (a 20x8 picture, one pixel a colour, plus
a 10x blown-up copy for looking at) and game/art/next/palette.js (window.NW_PALETTE: the ramps by name).

    python3 tools/build-palette.py

Ramps (name: base hue, saturation): the name says what it's for, not what colour it must be used as."""
import colorsys, json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'game' / 'art' / 'next'
RAMPS = [  # name, hue (deg), sat, mid value, notes
    ('skin', 24, .48, .82, 'skin, leather, sand'),
    ('skin_deep', 20, .55, .55, 'deep skin, bark, cocoa'),
    ('ember', 14, .85, .85, 'fire, warnings, red paint'),
    ('crimson', 350, .75, .70, 'blood-red, velvet, ties'),
    ('gold', 44, .85, .88, 'gold, coins, brass, Golden billionaires'),
    ('straw', 50, .55, .85, 'hay, dry grass, sand, pale wood'),
    ('olive', 72, .55, .62, 'olive, moss, dry leaves'),
    ('leaf', 105, .62, .70, 'grass, leaves, Grass type'),
    ('pine', 150, .55, .50, 'pine, deep foliage, felt'),
    ('mint', 165, .45, .82, 'mint, hospital, soft tech'),
    ('teal', 185, .60, .62, 'teal, water in shade, UI'),
    ('sky', 205, .55, .85, 'sky, water, glass'),
    ('cobalt', 222, .70, .68, 'denim, deep water, Water type'),
    ('indigo', 245, .55, .50, 'night, shadow tint, suits'),
    ('violet', 272, .55, .70, 'Psychic, magic, neon'),
    ('orchid', 300, .50, .78, 'pink-purple, candy, hair'),
    ('rose', 335, .55, .82, 'pink, cheeks, flowers'),
    ('rust', 22, .70, .62, 'rust, brick, copper, Ground'),
    ('steel', 215, .12, .70, 'steel, concrete, Steel type'),
    ('stone', 35, .10, .66, 'warm grey: stone, paper, fur'),
]
STEPS = 8  # 0 darkest .. 7 lightest, 3 = base

def ramp(h, s, v):
    out = []
    for i in range(STEPS):
        d = i - 3
        if d < 0:
            k = -d
            hh = (h - 9 * k) % 360          # cooler in shadow
            ss = min(1, s * (1 + .09 * k))  # richer
            vv = v * (.78 ** k)
        else:
            k = d
            hh = (h + 6 * k) % 360          # warmer in light
            ss = max(0, s * (1 - .16 * k))  # paler
            vv = v + (1 - v) * (1 - .62 ** k)
        r, g, b = colorsys.hsv_to_rgb(hh / 360, ss, vv)
        out.append((round(r * 255), round(g * 255), round(b * 255)))
    return out

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    pal = {n: ramp(h, s, v) for n, h, s, v, _ in RAMPS}
    # the fixed extras every sprite may use: outline ink, pure white, eye white, eye black
    extras = {'ink': (24, 20, 34), 'white': (255, 255, 255), 'eye': (246, 244, 250), 'black': (14, 12, 20)}
    a = np.zeros((len(RAMPS), STEPS, 3), np.uint8)
    for i, (n, *_r) in enumerate(RAMPS):
        a[i] = pal[n]
    im = Image.fromarray(a); im.save(OUT / 'palette.png')
    im.resize((STEPS * 24, len(RAMPS) * 24), Image.NEAREST).save(OUT / 'palette-big.png')
    hexs = {n: ['#%02x%02x%02x' % c for c in cs] for n, cs in pal.items()}
    hexs.update({k: '#%02x%02x%02x' % v for k, v in extras.items()})
    (OUT / 'palette.js').write_text('/* v35 master palette, made by tools/build-palette.py. 20 ramps x 8 steps (0 darkest, 3 base, 7 lightest) + extras. */\n'
                                    'window.NW_PALETTE=' + json.dumps({'steps': STEPS, 'ramps': hexs, 'notes': {n: note for n, *_x, note in RAMPS}}, separators=(',', ':')) + ';\n')
    print(f'{len(RAMPS) * STEPS + len(extras)} colours -> {OUT}')

if __name__ == '__main__':
    main()
