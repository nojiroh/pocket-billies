#!/usr/bin/env python3
"""Towns track TW-3: the notice board on a run town's square (logic/mapgen.js mapgenStageTown puts it on the square's
`board` spot, act `notice`: tap it to hand in the quests that are done). Low-poly, mesh shapes only, at 32 px/m like the
airship and the other model props: two posts, a planked board under a little roof, pinned papers, a pin each.

    python3 tools/build-notice-board.py      # writes everything below; run it again after changing it

Writes game/art/scene/next/models/notice_board.json, its fallback picture game/art/scene/next/town/notice_board.png
(shown when models are off), and the catalogue entry in game/data/scenery.json.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import gamedata  # noqa: E402

PPM = 32
KEY = 'notice_board'
MODELS = ROOT / 'game' / 'art' / 'scene' / 'next' / 'models'
PICS = ROOT / 'game' / 'art' / 'scene' / 'next' / 'town'
POST, BOARD, EDGE, ROOF = '#7A5536', '#B88A58', '#6A4630', '#8E4A3A'
# the papers: (x, z of its middle, w, h, colour), on the board's face; a red or blue pin at each one's top
PAPERS = [
    (-0.48, 1.32, 0.42, 0.5, '#F2E8CF', '#C8463C'),
    (0.02, 1.38, 0.36, 0.34, '#FFF7E4', '#3E6FB8'),
    (0.47, 1.28, 0.4, 0.52, '#EADFC2', '#C8463C'),
    (0.0, 1.0, 0.3, 0.26, '#F7EFD9', '#3E6FB8'),
]


def box(name, x, y, z, w, d, h, col, tex):
    return {'k': 'box', 'x': x, 'y': y, 'z': z, 'w': w, 'd': d, 'h': h, 'col': col, 'tex': tex, 'name': name}


def model():
    L = [box('foot', x, 0, 0, 0.22, 0.22, 0.1, '#9C98A6', 'stone') for x in (-0.82, 0.82)]
    L += [box('post', x, 0, 0.1, 0.12, 0.12, 1.85, POST, 'wood') for x in (-0.82, 0.82)]
    L.append(box('board', 0, 0, 0.72, 1.56, 0.08, 0.98, BOARD, 'wood'))
    L += [box('plank line', 0, -0.045, z, 1.56, 0.01, 0.02, EDGE, 'wood') for z in (0.96, 1.2, 1.44)]
    L.append(box('frame', 0, -0.03, 1.68, 1.64, 0.1, 0.06, EDGE, 'wood'))
    L.append(box('frame', 0, -0.03, 0.68, 1.64, 0.1, 0.06, EDGE, 'wood'))
    L.append(box('roof', 0, 0, 1.95, 1.96, 0.5, 0.08, ROOF, 'wood'))
    L.append(box('roof ridge', 0, 0, 2.03, 1.9, 0.2, 0.06, '#753C2F', 'wood'))
    for x, z, w, h, col, pin in PAPERS:
        L.append(box('paper', x, -0.055, round(z - h / 2, 3), w, 0.01, h, col, 'plain'))
        L.append({'k': 'sphere', 'x': x, 'y': -0.07, 'z': round(z + h / 2 - 0.05, 3), 'r': 0.03, 'sides': 6, 'rings': 3,
                  'col': pin, 'tex': 'metal', 'name': 'pin'})
        for k in range(3 if h > 0.4 else 2):  # lines of writing
            L.append(box('writing', x, -0.062, round(z + h / 2 - 0.14 - k * 0.09, 3), round(w * 0.7, 3), 0.005, 0.025,
                         '#6B5E50', 'plain'))
    return {'ppm': PPM, 'cel': 0.7, 'layers': L}


def picture(M):
    """a front view of the model at 32 px/m: the base point (front middle) at (ox, oy)"""
    W, H = int(2.2 * PPM), int(2.3 * PPM)
    bx, by = W // 2, H - 2
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    for L in sorted(M['layers'], key=lambda L: -L.get('y', 0)):
        x, z, col = L['x'], L['z'], L['col']
        if L['k'] == 'box':
            y0 = by - (z + L['h']) * PPM
            dr.rectangle([bx + (x - L['w'] / 2) * PPM, y0, bx + (x + L['w'] / 2) * PPM - 1,
                          max(y0, by - z * PPM - 1)], fill=col)
        else:
            r = max(1, L['r'] * PPM)
            dr.ellipse([bx + x * PPM - r, by - z * PPM - r, bx + x * PPM + r, by - z * PPM + r], fill=col)
    return im, -bx, -by


def main():
    MODELS.mkdir(parents=True, exist_ok=True)
    PICS.mkdir(parents=True, exist_ok=True)
    M = model()
    (MODELS / f'{KEY}.json').write_text(json.dumps(M, separators=(',', ':')) + '\n', encoding='utf-8')
    im, ox, oy = picture(M)
    im.save(PICS / f'{KEY}.png')
    D = gamedata.load()
    D['scenery']['props'][KEY] = {'name': 'Notice board', 'img': f'scene/next/town/{KEY}.png', 'ox': ox, 'oy': oy,
                                  'shadow': 0.6, 'sway': 0, 'flat': 0, 'tags': ['town'], 'group': 'signpost',
                                  'solid': 0.5, 'ppm': PPM, 'model': f'scene/next/models/{KEY}.json',
                                  'vary': {'rot': 0, 'lean': 0}}
    gamedata.save(D)
    print(f'{KEY}: {len(M["layers"])} layers, picture {im.size[0]}x{im.size[1]}')


if __name__ == '__main__':
    main()
