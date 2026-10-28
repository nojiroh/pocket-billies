#!/usr/bin/env python3
"""Style track SY-7 (docs/phases/style-track.md): loose Bureau forms, an ambient-life kind (game/js/ambient-life.js
`form`, the fly and drift flags) that lies about the Bureau's places and blows past. Flat on purpose: a sheet of paper.

  art/scene/life/form.png   4 frames, 20 x 14: lying flat, a corner lifting, two tumbling in the air
  scenery.json life.form    its strip row

    python3 tools/build-bureau-forms.py      (rerunnable; repaint the strip in the Studio afterwards if you like)

The set pieces that place them are data (game/data/setPieces.json, the checkpoint's and the scrap heap's life).
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import gamedata  # noqa: E402

W, H = 20, 14
# o outline, w paper, s paper in shade, l typed lines, r the red stamp (the scenery's red, as the red tape)
COL = {'o': '#3A3448', 'w': '#F4F0E8', 's': '#CFC6B4', 'l': '#8C8698', 'r': '#DE4048'}
FRAMES = [
    # 0: lying flat, seen at the walk camera's slant
    ['....................',
     '....................',
     '....................',
     '....................',
     '....................',
     '....................',
     '....................',
     '....................',
     '.....oooooooooo.....',
     '....owwwwwwwwwwo....',
     '...owlllwwrrwwwo....',
     '...owwllllwwwwo.....',
     '..owllllwwwwwso.....',
     '..oooooooooooo......'],
    # 1: a corner lifting in the breeze
    ['....................',
     '....................',
     '....................',
     '....................',
     '....................',
     '....................',
     '....................',
     '.............oo.....',
     '............owso....',
     '.....ooooooowwso....',
     '....owwwwwwwwwo.....',
     '...owlllwwrrwwo.....',
     '..owllllwwwwwo......',
     '..ooooooooooo.......'],
    # 2: in the air, turned up to show its face
    ['....................',
     '...........oo.......',
     '.........oowwo......',
     '.......oowwwwwo.....',
     '.....oowwlllwwo.....',
     '...oowwllllwwwwo....',
     '..owwwwwwwwlllwo....',
     '..owllllwwwwwwwo....',
     '...owwwwwlllrrwo....',
     '...owlllwwwwrrso....',
     '....owwwwwwwwsso....',
     '....oowwwwsssoo.....',
     '......oooooo........',
     '....................'],
    # 3: in the air, curled as it tumbles
    ['....................',
     '....................',
     '....................',
     '..oo................',
     '..owoo..........oo..',
     '...owwoo......oowo..',
     '...owwwwoooooowwso..',
     '....owwllwwwwllwso..',
     '....owwwwwwwwwwsso..',
     '.....oowwwwwwsso....',
     '.......oooooooo.....',
     '....................',
     '....................',
     '....................'],
]


def strip():
    a = np.zeros((H, W * len(FRAMES), 4), np.uint8)
    for i, F in enumerate(FRAMES):
        assert len(F) == H and all(len(r) == W for r in F), f'frame {i} is not {W} x {H}'
        for y, row in enumerate(F):
            for x, ch in enumerate(row):
                if ch in COL:
                    c = COL[ch]
                    a[y, i * W + x] = [int(c[j:j + 2], 16) for j in (1, 3, 5)] + [255]
    return a


def main():
    path = ROOT / 'game' / 'art' / 'scene' / 'life' / 'form.png'
    Image.fromarray(strip(), 'RGBA').save(path, optimize=True)
    D = gamedata.load()
    D['scenery']['life']['form'] = {'name': 'Loose form', 'img': 'scene/life/form.png', 'w': W, 'h': H,
                                    'frames': len(FRAMES), 'where': 'bureau'}
    gamedata.save(D)
    print('wrote', path.relative_to(ROOT), 'and scenery.json life.form')


if __name__ == '__main__':
    main()
