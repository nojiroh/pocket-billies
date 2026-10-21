#!/usr/bin/env python3
"""v47 part 3: small pixel sprites for a living world (only writes what's missing; --force draws them again):

  art/scene/fx/bee.png     a bee, 2 frames (wings up, wings down), 5 x 4 px each
  art/scene/fx/fish.png    a fish jumping clear of the water, 2 frames (bent, straight), 9 x 5 px each
  art/scene/fx/moth.png    a glowing moth (Spore Forest at night), 2 frames, 7 x 5 px each
  art/scene/life/crow.png  a crow: the pigeon strip, recoloured black with a blue sheen (5 frames, 24 x 22)

    python3 tools/build-critters.py [--force]
"""
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FX = ROOT / 'game' / 'art' / 'scene' / 'fx'
LIFE = ROOT / 'game' / 'art' / 'scene' / 'life'


def strip(frames, pal):
    h = len(frames[0]); w = len(frames[0][0]); im = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for f, rows in enumerate(frames):
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch in pal: im.putpixel((f * w + i, j), pal[ch])
    return im


BEE = [['.ww..',
        'kyky.',
        'ykyk.',
        '.....'],
       ['.....',
        'kykyw',
        'ykyk.',
        '.w...']]
BEE_PAL = {'k': (40, 30, 22, 255), 'y': (242, 196, 64, 255), 'w': (230, 240, 250, 200)}

FISH = [['.........',
         '...sss...',
         '.ssSSss.t',
         's.sssss.t',
         '.........'],
        ['.........',
         '.sssssst.',
         'sSSSsssst',
         '.sssssst.',
         '.........']]
FISH_PAL = {'s': (176, 196, 210, 255), 'S': (236, 244, 250, 255), 't': (130, 150, 170, 255)}

MOTH = [['w.....w',
         'ww.b.ww',
         '.wwbww.',
         '..wbw..',
         '.......'],
        ['.......',
         '.w.b.w.',
         'wwwbwww',
         '..wbw..',
         '.......']]
MOTH_PAL = {'w': (190, 240, 255, 255), 'b': (120, 150, 200, 255)}


def crow():
    """the pigeon's shapes on a crow's ramp: an inky outline, blue-black body, a bluish sheen on the light feathers"""
    src = Image.open(LIFE / 'pigeon.png').convert('RGBA'); out = Image.new('RGBA', src.size, (0, 0, 0, 0)); px = src.load(); po = out.load()
    for y in range(src.height):
        for x in range(src.width):
            r, g, b, a = px[x, y]
            if a == 0: continue
            lum = (r * 3 + g * 6 + b) / 10
            if r > 150 and g < 140 and b < 100: po[x, y] = (120, 118, 128, a); continue      # the beak
            if r > 120 and g < 90: po[x, y] = (46, 42, 50, a); continue                    # the feet
            if g > r + 20 and g > b - 10: po[x, y] = (74, 78, 120, a); continue           # the neck's sheen
            po[x, y] = (14, 12, 20, a) if lum < 60 else (36, 34, 48, a) if lum < 130 else (54, 52, 70, a) if lum < 178 else (84, 86, 112, a)
    return out


def main():
    force = '--force' in sys.argv; FX.mkdir(parents=True, exist_ok=True); done = []
    for name, frames, pal in (('bee', BEE, BEE_PAL), ('fish', FISH, FISH_PAL), ('moth', MOTH, MOTH_PAL)):
        p = FX / f'{name}.png'
        if force or not p.exists(): strip(frames, pal).save(p); done.append(p.name)
    p = LIFE / 'crow.png'
    if force or not p.exists(): crow().save(p); done.append(p.name)
    print('fx: ' + (', '.join(done) or 'all there (use --force to draw them again)'))


if __name__ == '__main__':
    main()
