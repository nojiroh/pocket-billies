#!/usr/bin/env python3
"""Draws the 16×16 seamless ground tiles used by the walk scenes (game/art/scene/tiles/*.png).
Each tile wraps on all sides.

    python3 tools/build-scene-tiles.py              only adds what's missing: new ground types and the variants
    python3 tools/build-scene-tiles.py --force      redraws every base tile too

Variants (name_1.png … name_5.png) are drawn in the colours of the base tile as it is now, so a base tile you
repainted in the Studio keeps its look; they add pebbles, cracks, clover, leaves, puddles and so on. The walk scenes
mix them per square metre (base most often) so big areas don't repeat."""
import random, sys
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / 'game' / 'art' / 'scene' / 'tiles'
N = 16

def hx(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)

def tile(seed, base):
    r = random.Random(seed)
    im = Image.new('RGBA', (N, N), hx(base))
    return im, r

def put(im, x, y, c):
    im.putpixel((x % N, y % N), hx(c))

def grass(seed, base, lite, dark, extra=None, dens=26):
    im, r = tile(seed, base)
    for _ in range(dens):
        x, y = r.randrange(N), r.randrange(N)
        put(im, x, y, dark); put(im, x, y - 1, dark if r.random() < .5 else lite)
    for _ in range(dens // 2):
        x, y = r.randrange(N), r.randrange(N)
        put(im, x, y, lite)
    if extra:
        extra(im, r)
    return im

def flowers(im, r):
    for c in ('#F7F1E3', '#F2C14E', '#E8708A', '#F7F1E3', '#9C8CE8'):
        x, y = r.randrange(N), r.randrange(N)
        put(im, x, y, c); put(im, x + 1, y, c); put(im, x, y + 1, c); put(im, x + 1, y + 1, '#3F7F3C')

def tall(seed):
    im, r = tile(seed, '#4E9A47')
    for x in range(0, N, 2):
        h = r.randrange(5, 9); y0 = r.randrange(N)
        for k in range(h):
            put(im, x + (k // 4), y0 + k, '#3B7E3A' if k > 1 else '#7CC468')
        put(im, x, y0, '#9ED783')
    return im

def dirt(seed, base, lite, dark, pebble=6):
    im, r = tile(seed, base)
    for _ in range(30):
        put(im, r.randrange(N), r.randrange(N), lite if r.random() < .5 else dark)
    for _ in range(pebble):
        x, y = r.randrange(N), r.randrange(N)
        put(im, x, y, lite); put(im, x + 1, y, lite); put(im, x, y + 1, dark); put(im, x + 1, y + 1, dark)
    return im

def cobble(seed, a, b, mortar):
    im, r = tile(seed, mortar)
    for row in range(4):
        off = 0 if row % 2 == 0 else 4
        for col in range(2):
            x0, y0 = col * 8 + off, row * 4
            c = a if r.random() < .6 else b
            for y in range(y0, y0 + 3):
                for x in range(x0, x0 + 7):
                    put(im, x, y, c)
            put(im, x0, y0, '#FFFFFF' if c == a else a)
    return im

def water(seed, base, lite, dark):
    im, r = tile(seed, base)
    for _ in range(14):
        put(im, r.randrange(N), r.randrange(N), dark)
    for y in (2, 7, 12):
        x = r.randrange(N)
        for k in range(r.randrange(3, 6)):
            put(im, x + k, y + (k // 3), lite)
    return im

def checker(a, b, line):
    im = Image.new('RGBA', (N, N))
    for y in range(N):
        for x in range(N):
            c = a if ((x // 8) + (y // 8)) % 2 == 0 else b
            if x % 8 == 7 or y % 8 == 7:
                c = line
            im.putpixel((x, y), hx(c))
    im.putpixel((1, 1), hx('#FFFFFF')); im.putpixel((9, 9), hx('#FFFFFF'))
    return im

def soil(seed):
    im, r = tile(seed, '#8A5E3C')
    for y in range(N):
        for x in range(N):
            if y % 4 == 0:
                put(im, x, y, '#6E4A2E')
            elif y % 4 == 1 and r.random() < .3:
                put(im, x, y, '#A87A52')
    return im

def boards(seed):
    im, r = tile(seed, '#B9844E')
    for y in range(N):
        for x in range(N):
            if y % 4 == 3:
                put(im, x, y, '#7E5530')
            elif r.random() < .08:
                put(im, x, y, '#CC9A62')
    for y0 in (0, 4, 8, 12):
        put(im, r.randrange(N), y0 + 1, '#7E5530')
    return im

def scrapdirt(seed):
    im = dirt(seed, '#8C8478', '#A9A194', '#6C655C', pebble=4)
    r = random.Random(seed + 9)
    for c in ('#C27A4A', '#7FA0B8', '#B9B2A6'):
        x, y = r.randrange(N), r.randrange(N)
        put(im, x, y, c); put(im, x + 1, y, c)
    return im

TILES = {
 'grass': lambda: grass(1, '#6CBA59', '#8FD06F', '#4E9A47'),
 'meadow': lambda: grass(2, '#5DA853', '#7DC064', '#418A3E'),
 'flowers': lambda: grass(3, '#6CBA59', '#8FD06F', '#4E9A47', flowers, dens=18),
 'tallgrass': lambda: tall(4),
 'path': lambda: dirt(5, '#D9B27C', '#E9C894', '#B88D5A'),
 'plaza': lambda: cobble(6, '#D8D2C2', '#C4BCA8', '#9C9484'),
 'sand': lambda: dirt(7, '#EED9A2', '#F8EAC0', '#D6BC80', pebble=2),
 'water': lambda: water(8, '#4BA8DA', '#BDEAF6', '#3A90C6'),
 'deep': lambda: water(9, '#2F7DBA', '#7FC2E8', '#24679E'),
 'rock': lambda: dirt(10, '#A19B90', '#BAB4A8', '#837D74', pebble=5),
 'cave': lambda: dirt(11, '#6E6878', '#857F90', '#58526A', pebble=4),
 'mall': lambda: checker('#F2EBDD', '#D9E9E4', '#C5BCAA'),
 'soil': lambda: soil(12),
 'boards': lambda: boards(13),
 'scrap': lambda: scrapdirt(14),
 'snow': lambda: dirt(15, '#EEF3F8', '#FFFFFF', '#C9D6E4', pebble=2),
}

# ---------- v17: new ground types ----------
def asphalt(seed, base='#5C5E66', lite='#6E717A', dark='#4A4C54'):
    im, r = tile(seed, base)
    for _ in range(46):
        put(im, r.randrange(N), r.randrange(N), lite if r.random() < .45 else dark)
    return im

def pavers(seed, a='#C9C3B6', b='#BDB6A8', joint='#8F887C'):
    im, r = tile(seed, a)
    for y in range(N):
        for x in range(N):
            if x % 8 == 7 or y % 8 == 7: put(im, x, y, joint)
            elif ((x // 8) + (y // 8)) % 2: put(im, x, y, b)
    for _ in range(8): put(im, r.randrange(N), r.randrange(N), '#D6D1C6')
    return im

def bricks(seed, a='#B8664E', b='#A65A45', mortar='#7E4A3C'):
    im, r = tile(seed, mortar)
    for row in range(4):
        off = 0 if row % 2 == 0 else 4
        for col in range(2):
            x0, y0 = col * 8 + off, row * 4
            c = a if r.random() < .55 else b
            for y in range(y0, y0 + 3):
                for x in range(x0, x0 + 7): put(im, x, y, c)
            put(im, x0 + 1, y0, '#D08068')
    return im

def gravel(seed):
    im, r = tile(seed, '#A59C8C')
    for _ in range(90):
        x, y = r.randrange(N), r.randrange(N)
        put(im, x, y, r.choice(['#C2B9A8', '#8C8373', '#B4AB9A', '#776F62']))
    return im

def steps(seed):
    """stone steps that climb toward the back of the scene: lit treads, dark risers"""
    im, r = tile(seed, '#B6AFA2')
    for y in range(N):
        for x in range(N):
            k = y % 8
            c = '#CFC8BA' if k < 2 else '#B6AFA2' if k < 5 else '#8E877B' if k < 7 else '#6E685E'
            put(im, x, y, c)
    for _ in range(6): put(im, r.randrange(N), r.randrange(N) // 8 * 8 + 3, '#A39C8F')
    return im

def lawn(seed):
    im, r = tile(seed, '#74C45E')
    for y in range(N):
        for x in range(N):
            if (x // 4) % 2: put(im, x, y, '#68B654')
            if r.random() < .08: put(im, x, y, '#86D06C')
    return im

def forest(seed):
    im, r = tile(seed, '#5B6B3A')
    for _ in range(40): put(im, r.randrange(N), r.randrange(N), r.choice(['#4A5A30', '#6E7A44', '#7A5A3A']))
    for _ in range(5):
        x, y = r.randrange(N), r.randrange(N)
        c = r.choice(['#C27A3A', '#D8A040', '#9A5A2A'])
        put(im, x, y, c); put(im, x + 1, y, c)
    return im

TILES.update({
 'asphalt': lambda: asphalt(21), 'pavers': lambda: pavers(22), 'bricks': lambda: bricks(23), 'gravel': lambda: gravel(24),
 'dirt': lambda: dirt(25, '#9C7350', '#B48A62', '#7E5A3E', pebble=7), 'forest': lambda: forest(26), 'steps': lambda: steps(27), 'lawn': lambda: lawn(28),
})

# ---------- v24: volcano ground ----------
def ash(seed):
    """volcanic ash: soft grey-brown with darker cinders and the odd glowing ember"""
    im, r = tile(seed, '#5A524E')
    for _ in range(40):
        put(im, r.randrange(N), r.randrange(N), r.choice(['#4A4340', '#6A625C', '#3E3836']))
    for _ in range(5):
        x, y = r.randrange(N), r.randrange(N)
        put(im, x, y, '#2E2A2A'); put(im, x + 1, y, '#3A3434'); put(im, x, y - 1, '#7A706A')
    for _ in range(2):
        put(im, r.randrange(N), r.randrange(N), '#E0703A')
    return im

def basalt(seed):
    """basalt: dark slate plates with cracks"""
    im, r = tile(seed, '#3E3E48')
    for y in range(N):
        for x in range(N):
            if (x + (y // 5) * 3) % 7 == 0 or y % 5 == 0: put(im, x, y, '#2C2C34')
            elif r.random() < .12: put(im, x, y, '#4E4E5A')
    for _ in range(3): put(im, r.randrange(N), r.randrange(N), '#5E5E6C')
    return im

TILES.update({'ash': lambda: ash(31), 'basalt': lambda: basalt(32)})

# ---------- v17: variants of every tile, in the base tile's own colours ----------
def palette(im):
    from collections import Counter
    c = Counter(im.convert('RGBA').getdata()); cols = [k for k, _ in c.most_common() if k[3] > 0]
    lum = lambda k: k[0] * .3 + k[1] * .59 + k[2] * .11
    base = cols[0]; srt = sorted(cols, key=lum)
    return base, srt[0], srt[-1], cols

def hexs(c): return '#%02X%02X%02X' % c[:3]

def shade(c, k): return tuple(max(0, min(255, int(v * k))) for v in c[:3]) + (255,)

FLIPPABLE = {'grass', 'meadow', 'flowers', 'tallgrass', 'path', 'sand', 'rock', 'cave', 'snow', 'gravel', 'dirt', 'forest', 'scrap', 'water', 'deep', 'asphalt', 'ash', 'basalt'}
FEATURES = {
 'grass': ['clover', 'pebbles', 'dark', 'flowers1', 'light'], 'meadow': ['clover', 'dark', 'flowers1', 'light', 'tufts'], 'flowers': ['flowers1', 'flowers1', 'clover', 'light', 'dark'],
 'tallgrass': ['tufts', 'dark', 'light', 'tufts', 'dark'], 'path': ['pebbles', 'cracks', 'puddle', 'light', 'leaves'], 'plaza': ['cracks', 'moss', 'light', 'dark', 'stain'],
 'sand': ['pebbles', 'shell', 'light', 'dark', 'ripple'], 'water': ['light', 'dark', 'light', 'ripple', 'dark'], 'deep': ['light', 'dark', 'ripple', 'dark', 'light'],
 'rock': ['cracks', 'pebbles', 'moss', 'dark', 'light'], 'cave': ['cracks', 'pebbles', 'dark', 'glint', 'light'], 'mall': ['light', 'stain', 'light', 'dark', 'light'],
 'soil': ['pebbles', 'dark', 'light', 'tufts', 'dark'], 'boards': ['knot', 'dark', 'light', 'knot', 'nail'], 'scrap': ['stain', 'pebbles', 'cracks', 'dark', 'bolt'],
 'snow': ['light', 'pebbles', 'dark', 'light', 'ripple'], 'asphalt': ['cracks', 'stain', 'patch', 'light', 'manhole'], 'pavers': ['cracks', 'moss', 'stain', 'light', 'dark'],
 'bricks': ['cracks', 'moss', 'dark', 'light', 'stain'], 'gravel': ['pebbles', 'dark', 'light', 'pebbles', 'tufts'], 'dirt': ['pebbles', 'cracks', 'tufts', 'puddle', 'leaves'],
 'forest': ['leaves', 'tufts', 'pebbles', 'dark', 'leaves'], 'ash': ['pebbles', 'dark', 'cracks', 'light', 'pebbles'], 'basalt': ['cracks', 'dark', 'light', 'cracks', 'pebbles'], 'steps': ['cracks', 'moss', 'dark', 'light', 'stain'], 'lawn': ['clover', 'light', 'dark', 'flowers1', 'light'],
}

def variant(base_im, name, i):
    im = base_im.convert('RGBA').copy(); r = random.Random(hash((name, i)) & 0xffffff)
    base, dark, light, cols = palette(im)
    px = im.load(); flip = name in FLIPPABLE
    # reshuffle the base noise a little (for flippable textures), keeping the tile seamless
    if flip:
        for _ in range(40):
            x, y = r.randrange(N), r.randrange(N); x2, y2 = r.randrange(N), r.randrange(N)
            px[x, y], px[x2, y2] = px[x2, y2], px[x, y]
    f = FEATURES.get(name, ['light', 'dark', 'pebbles', 'cracks', 'light'])[(i - 1) % 5]
    P = lambda x, y, c: px.__setitem__((x % N, y % N), c)
    if f == 'light':
        for _ in range(10): P(r.randrange(N), r.randrange(N), light)
        for y in range(N):
            for x in range(N):
                if r.random() < .5 and px[x, y] == base: P(x, y, shade(base, 1.05))
    elif f == 'dark':
        for y in range(N):
            for x in range(N):
                if px[x, y] == base and r.random() < .55: P(x, y, shade(base, .93))
    elif f == 'pebbles':
        for _ in range(4):
            x, y = r.randrange(N), r.randrange(N); c = r.choice([shade(light, 1.02), shade(dark, 1.1), (170, 164, 156, 255)])
            P(x, y, c); P(x + 1, y, c); P(x, y + 1, shade(c, .7)); P(x + 1, y + 1, shade(c, .7))
    elif f == 'cracks':
        x, y = r.randrange(N), r.randrange(N)
        for _ in range(7): P(x, y, shade(dark, .85)); x += r.choice([1, 1, 0]); y += r.choice([1, 0, -1])
    elif f == 'clover':
        for _ in range(3):
            x, y = r.randrange(N), r.randrange(N); c = shade(base, 1.2)
            for dx, dy in ((0, 0), (1, 0), (0, 1), (-1, 0), (0, -1)): P(x + dx, y + dy, c if (dx or dy) else shade(base, .8))
    elif f == 'flowers1':
        for _ in range(3):
            x, y = r.randrange(N), r.randrange(N); c = r.choice([(247, 241, 227, 255), (242, 193, 78, 255), (232, 112, 138, 255), (156, 140, 232, 255)])
            P(x, y, c); P(x + 1, y, shade(c, .85))
    elif f == 'tufts':
        for _ in range(4):
            x, y = r.randrange(N), r.randrange(N)
            P(x, y, shade(base, .8)); P(x, y - 1, shade(base, 1.15)); P(x + 1, y - 1, shade(base, .9))
    elif f == 'puddle':
        x, y = r.randrange(N), r.randrange(N)
        for dx in range(-2, 3):
            for dy in range(-1, 2):
                if abs(dx) + abs(dy) < 3: P(x + dx, y + dy, (120, 150, 170, 255) if dy < 0 else (98, 122, 140, 255))
        P(x - 1, y - 1, (190, 214, 226, 255))
    elif f == 'leaves':
        for _ in range(5):
            x, y = r.randrange(N), r.randrange(N); c = r.choice([(196, 122, 58, 255), (216, 160, 64, 255), (154, 90, 42, 255), (120, 150, 60, 255)])
            P(x, y, c); P(x + 1, y, shade(c, .8))
    elif f == 'moss':
        x, y = r.randrange(N), r.randrange(N)
        for _ in range(9): P(x + r.randrange(-2, 3), y + r.randrange(-1, 2), r.choice([(110, 150, 70, 255), (130, 170, 80, 255)]))
    elif f == 'stain':
        x, y = r.randrange(N), r.randrange(N)
        for dx in range(-2, 3):
            for dy in range(-1, 2):
                if abs(dx) + abs(dy) < 3 and r.random() < .8: P(x + dx, y + dy, shade(px[(x + dx) % N, (y + dy) % N], .82))
    elif f == 'shell':
        x, y = r.randrange(N), r.randrange(N); P(x, y, (246, 230, 222, 255)); P(x + 1, y, (232, 196, 186, 255))
    elif f == 'ripple':
        y = r.randrange(N); x0 = r.randrange(N)
        for k in range(6): P(x0 + k, y + (k // 3), light)
    elif f == 'glint':
        for _ in range(2): x, y = r.randrange(N), r.randrange(N); P(x, y, (176, 140, 236, 255)); P(x, y - 1, (220, 200, 255, 255))
    elif f == 'knot':
        x, y = r.randrange(N), r.randrange(4) * 4 + 1; P(x, y, shade(dark, .9)); P(x + 1, y, shade(dark, .8))
    elif f == 'nail':
        for x in (2, 10): P(x, r.randrange(4) * 4 + 1, (90, 90, 100, 255))
    elif f == 'bolt':
        x, y = r.randrange(N), r.randrange(N); P(x, y, (140, 150, 170, 255)); P(x + 1, y, (100, 110, 130, 255))
    elif f == 'patch':
        x0, y0 = r.randrange(N), r.randrange(N); c = shade(base, .85)
        for y in range(y0, y0 + 5):
            for x in range(x0, x0 + 6): P(x, y, c)
    elif f == 'manhole':
        cx, cy = 8, 8
        for y in range(N):
            for x in range(N):
                d = ((x + .5 - cx) ** 2 + (y + .5 - cy) ** 2) ** .5
                if d < 5.5: P(x, y, (88, 90, 98, 255) if d < 4.6 else (64, 66, 74, 255))
                if d < 4.6 and (x + y) % 3 == 0: P(x, y, (104, 106, 114, 255))
    return im

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    force = '--force' in sys.argv; made = []
    for k, f in TILES.items():
        p = OUT / f'{k}.png'
        if force or not p.exists(): f().save(p); made.append(k)
    nv = 0
    for k in TILES:
        base = Image.open(OUT / f'{k}.png')
        for i in range(1, 6):
            p = OUT / f'{k}_{i}.png'
            if force or not p.exists(): variant(base, k, i).save(p); nv += 1
    print('new base tiles:', ', '.join(made) or 'none', '| variants written:', nv)

if __name__ == '__main__':
    main()
