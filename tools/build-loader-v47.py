#!/usr/bin/env python3
"""v47: the loading screen's little runner and its trail of coins, drawn as pixel art and written straight into
game/css/loader.css as data (so they show on the first paint, before any game art or script has loaded, and work the
same in the single-page version). Also writes the same pictures to game/art/ui/ for the Studio and the notes.

The runner: a young billionaire goat in a green tracksuit and a headband, jogging (4 frames). The coins: an empty
outline that fills with gold as the game loads.

    python3 tools/build-loader-v47.py
"""
import base64, io, re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CSS = ROOT / 'game' / 'css' / 'loader.css'
OUT = ROOT / 'game' / 'art' / 'ui'

PAL = {'k': (42, 34, 56), 'w': (246, 240, 226), 'c': (226, 214, 190), 'h': (184, 150, 104), 'H': (150, 116, 80), 'e': (42, 34, 56),
       'g': (63, 138, 99), 'G': (44, 104, 74), 'L': (98, 178, 130), 's': (246, 240, 226), 'r': (226, 74, 74), 'y': (242, 193, 78),
       'Y': (255, 236, 160), 'n': (232, 156, 132), 'p': (74, 78, 92), 'P': (52, 54, 66), 'o': (70, 62, 54)}

# 20 x 20, facing right. Head with horns and a red headband, green track top with a white stripe, a gold coin medal.
HEAD = ['......h.h...........',
        '.....hH.Hh..........',
        '.....kkkkkk.........',
        '....kwwwwwwk........',
        '...krrrrrrrrk.......',
        '...kwwwwkewwwk......',
        '...kwwwwwwwwnk......',
        '....kwwwwwwwkk......',
        '.....kcwwwck........',
        '......kcck..........']
BODY = ['.....kkggkk.........',
        '....kgggsggk........',
        '...kggggsgggk.......',
        '..kLgkgysggggk......',
        '..kgk.kYskgggk......',
        '......kgggggk.......']
LEGS = [['......kp..kp........',     # 1: front leg out, back leg behind
         '.....kp....kp.......',
         '....kp......kpk.....',
         '...koo.......koo....'],
        ['.......kpkp.........',     # 2: passing
         '.......kpkp.........',
         '.......kpkp.........',
         '......koo.koo.......'],
        ['.......kp.kp........',     # 3: legs swapped
         '........kpkp........',
         '.......kp..kp.......',
         '......koo..koo......'],
        ['.......kpkp.........',     # 4: passing, the other way
         '.......kppk.........',
         '.......kpkp.........',
         '......koo.koo.......']]

COIN = ['...kkkk...',
        '..kyyyyk..',
        '.kyYYyyyk.',
        'kyYyyyyyyk',
        'kyYyyyyyyk',
        'kyyyyyyHyk',
        'kyyyyyyHyk',
        '.kyyyyHHk.',
        '..kyHHHk..',
        '...kkkk...']


def draw(rows, img, ox, oy, pal=PAL):
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch in pal: img.putpixel((ox + i, oy + j), pal[ch] + (255,))


def runner():
    im = Image.new('RGBA', (80, 20), (0, 0, 0, 0))
    for f in range(4):
        bob = 1 if f in (1, 3) else 0
        draw(HEAD, im, f * 20, 0 + bob); draw(BODY, im, f * 20, 10 + bob); draw(LEGS[f], im, f * 20, 16)
    return im


def coins():
    im = Image.new('RGBA', (20, 10), (0, 0, 0, 0))
    empty = {'k': (255, 236, 200), 'y': (0, 0, 0), 'Y': (0, 0, 0), 'H': (0, 0, 0)}
    for j, r in enumerate(COIN):
        for i, ch in enumerate(r):
            if ch == 'k': im.putpixel((i, j), (255, 230, 190, 150))
    draw(COIN, im, 10, 0)
    return im


def uri(im):
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def main():
    OUT.mkdir(parents=True, exist_ok=True); r, c = runner(), coins()
    r.save(OUT / 'loader-runner.png'); c.save(OUT / 'loader-coins.png')
    css = CSS.read_text(encoding='utf-8')
    block = (f"/* v47 sprites (tools/build-loader-v47.py) */\n:root{{--ld-runner:url({uri(r)});--ld-coins:url({uri(c)})}}\n")
    css = re.sub(r'/\* v47 sprites \(tools/build-loader-v47\.py\) \*/\n:root\{[^\n]*\}\n', '', css)
    CSS.write_text(block + css, encoding='utf-8')
    print('runner and coins written into loader.css', r.size, c.size)


if __name__ == '__main__':
    main()
