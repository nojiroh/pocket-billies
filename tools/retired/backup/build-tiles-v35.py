#!/usr/bin/env python3
"""v35: the 32 px/m ground tiles for the new art style, from the master palette.

Two jobs, both writing only under game/art/next/tiles/ (the game doesn't load these until v37):

  1. Masters: one 32x32 picture per terrain in tiles/master/<name>.png, painted by the recipe below (flat-lit, no
     outlines, palette colours only, the kind of detail the style guide asks for). A master that already exists is
     left alone, so you can paint over any of them by hand and run the tool again.
  2. From each master: six variants (tiles/<name>_1..6.png: the same recipe re-rolled, so a field doesn't repeat) and,
     for natural terrains, a wobbly-edge mask set (tiles/edge/<name>_<n>.png, 16 pieces: which neighbours are
     the other terrain, as a bitmask N=1 E=2 S=4 W=8) the ground painter blends with.

    python3 tools/build-tiles.py            # everything missing
    python3 tools/build-tiles.py --force    # masters again too (your hand-painted ones are overwritten!)
    python3 tools/build-tiles.py --sheet out.png"""
import argparse, json, random
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
NEXT = ROOT / 'game' / 'art' / 'next'
TILES = NEXT / 'tiles'
T = 32

def palette():
    js = (NEXT / 'palette.js').read_text()
    d = json.loads(js[js.index('=') + 1:js.rindex(';')])
    R = {k: [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in v] for k, v in d['ramps'].items() if isinstance(v, list)}
    return R

# recipe: ramp, base step, kind, params. kind: grass | pebbles | bricks | boards | cobble | sand | water | plain | tiles
RECIPES = {
    'grass':   ('leaf', 3, 'grass', {'blades': 26, 'dark': .5}),
    'meadow':  ('leaf', 4, 'grass', {'blades': 18, 'dark': .4, 'flowers': ('rose', 3)}),
    'flowers': ('leaf', 3, 'grass', {'blades': 16, 'dark': .4, 'flowers': ('gold', 4), 'flowers2': ('rose', 5)}),
    'tallgrass': ('pine', 3, 'grass', {'blades': 40, 'dark': .7, 'tall': True}),
    'lawn':    ('leaf', 4, 'grass', {'blades': 10, 'dark': .3, 'stripes': True}),
    'forest':  ('pine', 2, 'grass', {'blades': 22, 'dark': .6, 'leaves': ('olive', 2)}),
    'path':    ('straw', 2, 'sand', {'grain': .5, 'stones': 3, 'stone_ramp': 'stone'}),
    'dirt':    ('rust', 2, 'sand', {'grain': .6, 'stones': 2, 'stone_ramp': 'skin_deep'}),
    'soil':    ('skin_deep', 2, 'sand', {'grain': .7, 'rows': True}),
    'sand':    ('straw', 4, 'sand', {'grain': .4, 'ripples': True}),
    'gravel':  ('stone', 3, 'pebbles', {'n': 60, 'r': 2}),
    'rock':    ('stone', 2, 'cobble', {'cells': 3, 'crack': .4, 'jitter': 3}),
    'basalt':  ('indigo', 1, 'cobble', {'cells': 4, 'crack': .5, 'hex': True}),
    'cave':    ('indigo', 2, 'pebbles', {'n': 30, 'r': 3, 'dark': True}),
    'ash':     ('stone', 1, 'sand', {'grain': .8, 'embers': ('ember', 4)}),
    'snow':    ('sky', 6, 'sand', {'grain': .25, 'sparkle': True}),
    'water':   ('sky', 3, 'water', {'deep': False}),
    'deep':    ('cobalt', 2, 'water', {'deep': True}),
    'plaza':   ('stone', 4, 'tiles', {'size': 16, 'gap': 1}),
    'pavers':  ('stone', 3, 'tiles', {'size': 8, 'gap': 1, 'stagger': True}),
    'bricks':  ('rust', 3, 'bricks', {'h': 4, 'w': 8}),
    'asphalt': ('steel', 1, 'sand', {'grain': .3}),
    'boards':  ('skin_deep', 3, 'boards', {'w': 8}),
    'scrap':   ('steel', 2, 'pebbles', {'n': 20, 'r': 4, 'metal': True}),
    'mall':    ('mint', 5, 'tiles', {'size': 16, 'gap': 1, 'shine': True}),
    'steps':   ('stone', 3, 'boards', {'w': 32, 'h': 8, 'stone': True}),
}
NATURAL = {'grass', 'meadow', 'flowers', 'tallgrass', 'lawn', 'forest', 'path', 'dirt', 'soil', 'sand', 'gravel', 'rock', 'cave', 'ash', 'snow', 'water', 'deep', 'basalt'}

def paint(name, seed, R):
    ramp, base, kind, p = RECIPES[name]
    rng = random.Random(seed)
    C = R[ramp]
    st = lambda d: C[max(0, min(7, base + d))]
    a = np.zeros((T, T, 3), np.uint8); a[:, :] = st(0)
    def px(x, y, c):
        a[y % T, x % T] = c
    # soft large patches of light and shade first (coarse noise, 2 levels), so a field isn't flat
    for y in range(T):
        for x in range(T):
            v = rng.random()
    patch = [[rng.random() for _ in range(5)] for _ in range(5)]
    for i in range(5): patch[i][4] = patch[i][0]
    patch[4] = patch[0][:]
    for y in range(T):
        for x in range(T):
            u, v = x / T * 4, y / T * 4
            i, j = int(u), int(v); fu, fv = u - i, v - j
            n = (patch[j][i] * (1 - fu) + patch[j][i + 1] * fu) * (1 - fv) + (patch[j + 1][i] * (1 - fu) + patch[j + 1][i + 1] * fu) * fv
            if kind in ('grass', 'sand', 'pebbles') and not p.get('dark'):
                if n > .78: px(x, y, st(1))
                elif n < .2: px(x, y, st(-1))
    if kind == 'grass':
        for _ in range(p['blades']):
            x, y = rng.randrange(T), rng.randrange(T); h = 3 if p.get('tall') else rng.choice((1, 2, 2))
            d = st(-1) if rng.random() < p['dark'] else st(1)
            for k in range(h): px(x, y - k, d)
            if p.get('tall'): px(x + 1, y, st(-2))
        if p.get('stripes'):
            for y in range(T):
                if (y // 8) % 2: a[y] = [st(1) if tuple(c) == st(0) else c for c in a[y]]
        for key in ('flowers', 'flowers2'):
            if key in p:
                fr, fs = p[key]; col = R[fr][fs]
                for _ in range(rng.randrange(3, 6)):
                    x, y = rng.randrange(T), rng.randrange(T); px(x, y, col); px(x + 1, y, col); px(x, y + 1, col); px(x + 1, y + 1, R[fr][min(7, fs + 2)])
        if 'leaves' in p:
            lr, ls = p['leaves']
            for _ in range(5):
                x, y = rng.randrange(T), rng.randrange(T); px(x, y, R[lr][ls]); px(x + 1, y, R[lr][ls + 1])
    elif kind == 'sand':
        for _ in range(int(T * T * p['grain'] * .12)):
            x, y = rng.randrange(T), rng.randrange(T); px(x, y, st(rng.choice((-1, 1))))
        if p.get('ripples'):
            for y in range(2, T, 7):
                for x in range(T):
                    if (x + y) % 9 < 5: px(x, y + (x // 6) % 2, st(1))
        if p.get('rows'):
            for y in range(3, T, 8):
                for x in range(T): px(x, y, st(-1)); px(x, y + 1, st(-2) if x % 3 else st(-1))
        for _ in range(p.get('stones', 0)):
            x, y = rng.randrange(T), rng.randrange(T); sc = R[p['stone_ramp']]
            px(x, y, sc[4]); px(x + 1, y, sc[4]); px(x, y + 1, sc[2]); px(x + 1, y + 1, sc[2])
        if 'embers' in p:
            er, es = p['embers']
            for _ in range(4):
                x, y = rng.randrange(T), rng.randrange(T); px(x, y, R[er][es]); px(x + 1, y, R[er][es + 2])
        if p.get('sparkle'):
            for _ in range(5):
                x, y = rng.randrange(T), rng.randrange(T); px(x, y, (255, 255, 255))
    elif kind == 'pebbles':
        for _ in range(p['n']):
            x, y, r = rng.randrange(T), rng.randrange(T), rng.randrange(1, p['r'] + 1)
            lit, dk = (st(2), st(-2)) if p.get('metal') else (st(1), st(-1))
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    if dx * dx + dy * dy <= r * r:
                        px(x + dx, y + dy, lit if dx + dy < 0 else st(0) if dx + dy < r else dk)
            if p.get('dark'): px(x + r, y + r, st(-2))
    elif kind == 'cobble':
        n = p['cells']; cells = [(rng.randrange(T), rng.randrange(T), rng.randrange(-1, 2)) for _ in range(n * n)]
        for y in range(T):
            for x in range(T):
                best = None; bd = 1e9; sd = 1e9
                for cx, cy, tone in cells:
                    for ox in (-T, 0, T):
                        for oy in (-T, 0, T):
                            d = (x - cx - ox) ** 2 + (y - cy - oy) ** 2 * (1.0 if not p.get('hex') else .8)
                            if d < bd: sd = bd; bd = d; best = tone
                            elif d < sd: sd = d
                if sd - bd < 4.5 * (1 + p['crack']): px(x, y, st(-2))
                else: px(x, y, st(best))
        # a lit top-left edge per stone
        for y in range(T):
            for x in range(T):
                if tuple(a[y, x]) != st(-2) and (tuple(a[y, (x - 1) % T]) == st(-2) or tuple(a[(y - 1) % T, x]) == st(-2)): px(x, y, st(2))
    elif kind == 'water':
        for y in range(T):
            for x in range(T):
                w = (x + y * 2 + int(3 * np.sin(x / 5 + y / 3))) % 13
                px(x, y, st(1) if w < 2 else st(-1) if w == 7 else st(0))
        if p['deep']:
            for y in range(0, T, 11):
                for x in range(T):
                    if (x // 4) % 3 == 0: px(x, y + (x // 8) % 2, st(2))
    elif kind == 'tiles':
        s, g = p['size'], p['gap']
        for y in range(T):
            for x in range(T):
                xx = x + (s // 2 if p.get('stagger') and (y // s) % 2 else 0)
                if xx % s < g or y % s < g: px(x, y, st(-2))
                elif xx % s == g or y % s == g: px(x, y, st(1))
                elif p.get('shine') and (xx % s + y % s) % 9 == 0: px(x, y, st(2))
                elif rng.random() < .03: px(x, y, st(-1))
    elif kind == 'bricks':
        h, w = p['h'], p['w']
        for y in range(T):
            for x in range(T):
                xx = x + (w // 2 if (y // h) % 2 else 0)
                if y % h == 0 or xx % w == 0: px(x, y, R['stone'][5])
                elif y % h == 1 or xx % w == 1: px(x, y, st(1))
                elif rng.random() < .06: px(x, y, st(-1))
    elif kind == 'boards':
        w, h = p['w'], p.get('h', T)
        for y in range(T):
            for x in range(T):
                if x % w == 0 or (h < T and y % h == 0): px(x, y, st(-2))
                elif x % w == 1 or (h < T and y % h == 1): px(x, y, st(1))
                elif not p.get('stone') and (y + x // 3) % 7 == 0 and rng.random() < .5: px(x, y, st(-1))
                elif p.get('stone') and h < T and y % h == h - 1: px(x, y, st(-1))
    return Image.fromarray(a)

def edge_mask(name, n, seed):
    """alpha mask for a tile whose neighbours n (bitmask N1 E2 S4 W8) are another terrain: this terrain shows where
    the mask is white; a wobbly line a few pixels in from each such side"""
    rng = random.Random(seed * 131 + n)
    m = np.full((T, T), 255, np.uint8)
    wob = [rng.randrange(2, 7) for _ in range(T + 1)]
    for y in range(T):
        for x in range(T):
            cut = False
            if n & 1 and y < wob[x]: cut = True
            if n & 4 and y >= T - wob[(x + 7) % T]: cut = True
            if n & 8 and x < wob[(y + 13) % T]: cut = True
            if n & 2 and x >= T - wob[(y + 19) % T]: cut = True
            if cut: m[y, x] = 0
    return Image.fromarray(m, 'L')

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--force', action='store_true'); ap.add_argument('--sheet'); a = ap.parse_args()
    R = palette(); (TILES / 'master').mkdir(parents=True, exist_ok=True); (TILES / 'edge').mkdir(exist_ok=True)
    made = 0
    for name in RECIPES:
        m = TILES / 'master' / f'{name}.png'
        if a.force or not m.exists(): paint(name, 1, R).save(m); made += 1
        for v in range(1, 7):
            f = TILES / f'{name}_{v}.png'
            if a.force or not f.exists(): paint(name, 100 + v, R).save(f); made += 1
        if name in NATURAL:
            for n in range(1, 16):
                f = TILES / 'edge' / f'{name}_{n}.png'
                if a.force or not f.exists(): edge_mask(name, n, 7).save(f); made += 1
    (TILES / 'tiles.json').write_text(json.dumps({'tile': T, 'terrains': {k: {'ramp': v[0], 'natural': k in NATURAL, 'variants': 6} for k, v in RECIPES.items()}}, indent=1))
    print(f'{made} pictures made, {len(RECIPES)} terrains')
    if a.sheet:
        names = list(RECIPES); cols = 7; rows = (len(names) + cols - 1) // cols; z = 3
        sh = Image.new('RGB', (cols * (T * 3 * z + 8), rows * (T * 2 * z + 8)), (40, 40, 48))
        for i, name in enumerate(names):
            x0, y0 = (i % cols) * (T * 3 * z + 8), (i // cols) * (T * 2 * z + 8)
            for j in range(6):
                im = Image.open(TILES / f'{name}_{j + 1}.png').resize((T * z, T * z), Image.NEAREST)
                sh.paste(im, (x0 + (j % 3) * T * z, y0 + (j // 3) * T * z))
        sh.save(a.sheet)

if __name__ == '__main__':
    main()
