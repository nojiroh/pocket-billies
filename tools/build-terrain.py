#!/usr/bin/env python3
"""v46: the terrain kit. Every ground kind gets twelve 32 px tiles instead of six, and twelve new kinds join the 26.

Variants of a kind (game/art/next/tiles/<name>_1..12.png): 1 is the plain tile, 2-6 the v37 ones (one extra touch
each), and the six new ones have roles the ground painter (walk-view.js) places them by:
   7, 8   plain re-rolls        (most of the ground, so it repeats less)
   9      a damp or shaded patch  (in slow patches of detail)
   10     a second touch of its own kind (stones, weeds, cracks)
   11, 12 worn                  (along the lines people walk: hub to exits)

New kinds (capital letters; the catalogue entries go into game/data/gamedata.js under scenery.terrains):
   C clover   M moss   D mud   S wet sand   P pebbles   K cobblestone   L leaf litter   H heather   R marsh
   T marble   I ice    X crystal floor
Each also gets its 16 px tiles (scene/tiles/<name>.png and _1.._5, the Lite renderer's and the Studio's picture),
made from the 32 px ones.

    python3 tools/build-terrain.py                # writes what is missing (your painted tiles are never touched)
    python3 tools/build-terrain.py --force NAME   # redraws one kind's generated tiles
    python3 tools/build-terrain.py --sheet out.png
"""
import gamedata  # phase 04b: the data files in game/data
import argparse, importlib.util, json, random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('btiles', ROOT / 'tools' / 'build-tiles.py'); BT = importlib.util.module_from_spec(spec); spec.loader.exec_module(BT)
T, Tile, hx, ramp, mix, dk = BT.T, BT.Tile, BT.hx, BT.ramp, BT.mix, BT.dk
OUT, OLD, DATA = BT.OUT, BT.OLD, ROOT / 'game' / 'data' / 'gamedata.js'


# ---------------------------------------------------------------- new features for the new variant roles
def damp(t, R):
    """a soft darker, cooler patch (wet ground, shade)"""
    n = t.noise(8, t.r.randrange(10 ** 6)) * .6 + t.noise(4, t.r.randrange(10 ** 6)) * .4
    for y in range(T):
        for x in range(T):
            if n[y, x] > .56:
                c = t.get(x, y); k = .9 - min(.12, (n[y, x] - .56) * .5)
                t.px(x, y, (int(c[0] * k * .96), int(c[1] * k), int(min(255, c[2] * k * 1.06))))


def worn(t, R, strength=1.0):
    """trodden: a lighter, flatter band across the tile, the fine detail rubbed out where feet go most"""
    r = t.r; horiz = r.random() < .5; w = r.randrange(9, 15); c0 = r.randrange(T)
    base = tuple(int(v) for v in np.median(t.a.reshape(-1, 3), axis=0)); flat = mix(base, R[3], .35 * strength)
    for a in range(T):
        wob = int(round(2 * np.sin(a / 5 + c0)))
        for b in range(-w // 2, w // 2 + 1):
            x, y = (a, c0 + b + wob) if horiz else (c0 + b + wob, a)
            edge = abs(b) > w // 2 - 2
            if edge and r.random() < .5: continue
            c = t.get(x, y); k = .55 if not edge else .25
            t.px(x, y, mix(c, flat, k * strength))
    for _ in range(int(6 * strength)): t.px(r.randrange(T), r.randrange(T), R[1])


SECOND = {   # the second touch each kind gets (variant 10)
 'grass': 'tuft', 'meadow': 'clover', 'flowers': 'flower', 'tallgrass': 'tuft', 'path': 'pebble', 'plaza': 'moss', 'sand': 'shell',
 'water': 'ripple', 'deep': 'ripple', 'rock': 'crack', 'cave': 'glint', 'mall': 'stain', 'soil': 'pebble', 'boards': 'knot', 'scrap': 'bolt',
 'snow': 'ripple', 'asphalt': 'crack', 'pavers': 'moss', 'bricks': 'crack', 'gravel': 'pebble', 'dirt': 'leaves', 'forest': 'leaves',
 'steps': 'moss', 'lawn': 'clover', 'ash': 'ember', 'basalt': 'glint',
 'clover': 'flower', 'moss': 'pebble', 'mud': 'puddle', 'wetsand': 'shell', 'pebbles': 'pebble', 'cobble': 'moss', 'leaflitter': 'leaves',
 'heather': 'flower', 'marsh': 'puddle', 'marble': 'crack', 'ice': 'crack', 'crystal': 'glint'}


# ---------------------------------------------------------------- the new kinds (32 px recipes)
def moss(t):
    t.a[:] = hx('#5E8C46'); R = ramp(hx('#5E8C46')); t.blotch(R, 8, (.3, .7), t.r.randrange(1000)); t.speck(40, [R[3], R[1]]); t.speck(10, [hx('#8EBB5E')])
    for _ in range(5):
        x, y = t.r.randrange(T), t.r.randrange(T); t.rect(x, y, 2, 1, R[3]); t.px(x, y + 1, R[1])
    return R


def leaflitter(t):
    R = BT.ground(t, '#7A6440', '#8E7650', '#5E4A2E', 30, 2, 0, 8)
    for _ in range(9): t.leaf(t.r.randrange(T), t.r.randrange(T), hx(t.r.choice(['#C27A3A', '#D8A040', '#9A5A2A', '#B0482E', '#8A6A30'])), R[0])
    return R


def heather(t):
    R = BT.grass(t, '#6E7A4E', '#8A9462', '#55603C', blades=14, clover=0, flowers=(), tufts=4)
    for _ in range(14):
        x, y = t.r.randrange(T), t.r.randrange(T); c = hx(t.r.choice(['#9A6AA8', '#B886C4', '#7E5A92'])); t.px(x, y, c); t.px(x, y - 1, mix(c, (255, 255, 255), .25))
    return R


def marsh(t):
    R = BT.grass(t, '#557A48', '#6E9258', '#3F5E3A', blades=18, clover=0, flowers=(), tufts=3)
    n = t.noise(8, t.r.randrange(10 ** 6)); W = ramp(hx('#3E5A50'))
    for y in range(T):
        for x in range(T):
            if n[y, x] > .66: t.px(x, y, W[2] if n[y, x] < .78 else W[3])
    return R


def crystal(t):
    R = BT.ground(t, '#4E4866', '#6A6290', '#3A3550', 20, 0, 2, 8)
    for _ in range(4):
        x, y = t.r.randrange(T), t.r.randrange(T); c = hx(t.r.choice(['#7FD0E8', '#B48CF0', '#E8A0E0']))
        t.px(x, y, c); t.px(x, y + 1, mix(c, (40, 30, 70), .45)); t.px(x + 1, y + 1, mix(c, (255, 255, 255), .4))
    return R


NEW = {   # letter, name, 32 px recipe, z (higher laps over lower), edge colour, paved (crisp edges)
 'C': ('clover', lambda t: BT.grass(t, '#5FAE57', '#86CC6E', '#468F44', blades=10, clover=10, flowers=('#F7F1E3',), tufts=2), 4, '#3F7A3A', False),
 'M': ('moss', moss, 4, '#3E6A34', False),
 'D': ('mud', lambda t: BT.ground(t, '#6B5038', '#7E6146', '#523C2A', 40, 2, 0, 8), 2, '#4A3626', False),
 'S': ('wetsand', lambda t: BT.ground(t, '#C9B07A', '#D9C28E', '#AE945E', 30, 2, 0, 8), 1, '#A88E5A', False),
 'P': ('pebbles', lambda t: BT.ground(t, '#9A9284', '#B5AD9E', '#7B7468', 40, 14, 0, 4, specks=[hx('#B5AD9E'), hx('#7B7468'), hx('#A39B8C'), hx('#6A6458')]), 2, '#6E685E', False),
 'K': ('cobble', lambda t: BT.cobble(t, '#9E968A', '#8A8276', '#5E584F', 6, 5), 3, '#5E584F', True),
 'L': ('leaflitter', leaflitter, 4, '#5A4628', False),
 'H': ('heather', heather, 4, '#4E5838', False),
 'R': ('marsh', marsh, 3, '#3A5638', False),
 'T': ('marble', lambda t: BT.pavers(t, a='#ECE8E0', b='#DED8CE', joint='#BAB2A6', s=16), 3, '#A8A096', True),
 'I': ('ice', lambda t: BT.ground(t, '#CFE4F0', '#E8F4FA', '#A9C8DC', 10, 0, 2, 16), 2, '#8FB0C8', False),
 'X': ('crystal', crystal, 3, '#2E2A40', False),
}
NAMES = {'clover': 'Clover', 'moss': 'Moss', 'mud': 'Mud', 'wetsand': 'Wet sand', 'pebbles': 'Pebbles', 'cobble': 'Cobblestone', 'leaflitter': 'Leaf litter',
         'heather': 'Heather', 'marsh': 'Marsh', 'marble': 'Marble', 'ice': 'Ice', 'crystal': 'Crystal floor'}
FEATS_NEW = {   # the v37-style touches of variants 2-6 for the new kinds
 'clover': ['flower', 'clover', 'light', 'dark', 'tuft'], 'moss': ['pebble', 'dark', 'light', 'moss', 'pebble'], 'mud': ['puddle', 'pebble', 'dark', 'light', 'leaves'],
 'wetsand': ['shell', 'ripple', 'pebble', 'dark', 'light'], 'pebbles': ['pebble', 'moss', 'dark', 'light', 'pebble'], 'cobble': ['moss', 'crack', 'stain', 'dark', 'light'],
 'leaflitter': ['leaves', 'pebble', 'dark', 'leaves', 'light'], 'heather': ['flower', 'tuft', 'dark', 'light', 'flower'], 'marsh': ['puddle', 'tuft', 'dark', 'light', 'ripple'],
 'marble': ['crack', 'stain', 'light', 'dark', 'light'], 'ice': ['crack', 'light', 'glint', 'dark', 'crack'], 'crystal': ['glint', 'crack', 'pebble', 'dark', 'light']}


def recipe(name):
    if name in BT.RECIPES: return BT.RECIPES[name]
    return next(v[1] for v in NEW.values() if v[0] == name)


def feats(name):
    return BT.FEATURES.get(name) or FEATS_NEW[name]


def draw(name, i):
    """variant i (1..12) of a kind"""
    t = Tile(hash((name, i)) & 0xffff, (0, 0, 0)); recipe(name)(t)
    base = tuple(int(v) for v in np.median(t.a.reshape(-1, 3), axis=0)); R = ramp(base)
    if 2 <= i <= 6: BT.feature(t, feats(name)[(i - 2) % 5], R)
    elif i == 9: damp(t, R)
    elif i == 10: BT.feature(t, SECOND.get(name, 'light'), R)
    elif i in (11, 12): worn(t, R, .8 if i == 11 else 1.0)
    return t.image()


def small(im):
    """a 16 px tile from a 32 px one (2 x 2 averaged)"""
    return im.resize((16, 16), Image.BOX)


def load_data():
    src = gamedata.js_text(); i = src.index('window.GAMEDATA=')
    return src[:i], json.JSONDecoder().raw_decode(src[i + len('window.GAMEDATA='):])[0]


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--force'); ap.add_argument('--sheet'); a = ap.parse_args()
    head, D = load_data(); terr = D['scenery']['terrains']; n = 0
    names = [Path(t['tile']).stem for t in terr.values()] + [v[0] for v in NEW.values()]
    seen = set()
    for name in names:
        if name in seen: continue
        seen.add(name)
        for i in range(1, 13):
            p = OUT / f'{name}_{i}.png'
            if (a.force == name and (i >= 7 or name not in BT.RECIPES)) or not p.exists(): draw(name, i).save(p); n += 1
    # 16 px tiles and catalogue entries of the new kinds
    added = []
    for ch, (name, fn, z, edge, paved) in NEW.items():
        base = OLD / f'{name}.png'
        if a.force == name or not base.exists(): small(Image.open(OUT / f'{name}_1.png').convert('RGB')).save(base); n += 1
        for k in range(1, 6):
            p = OLD / f'{name}_{k}.png'
            if a.force == name or not p.exists(): small(Image.open(OUT / f'{name}_{k + 1}.png').convert('RGB')).save(p); n += 1
        if ch not in terr:
            terr[ch] = {'name': NAMES[name], 'tile': f'scene/tiles/{name}.png', 'z': z, 'edge': edge, 'vars': [f'scene/tiles/{name}_{k}.png' for k in range(1, 6)]}
            if paved: terr[ch]['paved'] = True
            added.append(ch)
    if added: gamedata.save_js(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n')
    print(f'{n} tiles written; new kinds in the catalogue: {", ".join(added) or "none (all there)"}; {len(terr)} kinds in all')
    if a.sheet:
        kinds = list(dict.fromkeys(names)); z = 2; cell = T * z + 4
        im = Image.new('RGB', (12 * cell + 110, len(kinds) * cell + 10), (90, 92, 100)); d = ImageDraw.Draw(im)
        for r, name in enumerate(kinds):
            d.text((6, 10 + r * cell + T * z // 2 - 6), name, fill=(255, 255, 255))
            for i in range(1, 13): im.paste(Image.open(OUT / f'{name}_{i}.png').convert('RGB').resize((T * z, T * z), Image.NEAREST), (106 + (i - 1) * cell, 6 + r * cell))
        im.save(a.sheet); print('sheet', a.sheet, im.size)


if __name__ == '__main__':
    main()
