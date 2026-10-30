#!/usr/bin/env python3
"""Buildings track BD-4a: a contact sheet of the house kit (tools/build-house-kit.py). Takes a close-up of every kit
house on its test map (test_house_kit) from the high three-quarter view with tools/look-hub-buildings.py, then tiles
them into one picture, each labelled with its number, body, roof and palette (from the catalogue's `kit`).
Software drawing is slow here: about a minute a house.

    python3 tools/look-house-kit.py                 # shots and the sheet: validation/look-house-kit/contact-noon.png
    python3 tools/look-house-kit.py --times=noon,night
    python3 tools/look-house-kit.py --sheet-only    # tile the shots already taken
"""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'validation' / 'look-house-kit'
SHOTS = OUT / 'shots'
ARGS = sys.argv[1:]
TIMES = next((a.split('=', 1)[1].split(',') for a in ARGS if a.startswith('--times=')), ['noon'])
COLS, TILE = 6, (260, 360)


def rows():
    C = json.loads((ROOT / 'game/data/scenery.json').read_text())['props']
    return [(k, C[k]) for k in sorted(C) if C[k].get('group') == 'house_kit' and k[len('house_kit_'):].isdigit()]


def sheet(time):
    R = rows()
    W, H = COLS * TILE[0], ((len(R) + COLS - 1) // COLS) * (TILE[1] + 34)
    img = Image.new('RGB', (W, H), (246, 240, 228))
    d = ImageDraw.Draw(img)
    for i, (kind, row) in enumerate(R):
        f = SHOTS / f'{kind}-{time}.png'
        x, y = (i % COLS) * TILE[0], (i // COLS) * (TILE[1] + 34)
        if f.exists():
            im = Image.open(f).convert('RGB')
            im.thumbnail(TILE)
            img.paste(im, (x + (TILE[0] - im.width) // 2, y))
        k = row['kit']
        d.text((x + 6, y + TILE[1] + 3), f"{i + 1:02d} {k['body']} / {k['roof']}", fill=(40, 34, 30))
        d.text((x + 6, y + TILE[1] + 17), f"{k['palette']}  {k['size']} {row['box'][0]}x{row['box'][1]}", fill=(90, 80, 70))
    p = OUT / f'contact-{time}.png'
    img.save(p)
    print('wrote', p)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    if '--sheet-only' not in ARGS:
        subprocess.run([sys.executable, str(ROOT / 'tools/look-hub-buildings.py'), '--scene=test_house_kit', '--only=house_kit',
                        '--times=' + ','.join(TIMES), '--angle=35', f'--out={SHOTS}'], check=True)
    for t in TIMES:
        sheet(t)


if __name__ == '__main__':
    main()
