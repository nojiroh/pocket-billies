#!/usr/bin/env python3
"""v37 preview, round three: props drawn from scratch by tools/propkit.py in five JRPG-inspired styles.
    python3 tools/style-variants3.py validation/v37-variants-3.png"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import propkit as K
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parent.parent
def main():
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'validation' / 'v37-variants-3.png'); z = 3
    rows = []
    for name, S in K.STYLES.items():
        props = [K.tree(S, 'oak', 1), K.tree(S, 'birch', 2), K.bush(S), K.rock(S), K.lamp(S), K.bench(S), K.fence(S), K.cottage(S)]
        tiles = [K.tile_grass(S), K.tile_path(S), K.tile_water(S), K.tile_cobble(S)]
        rows.append((name, S['note'], props, tiles))
    W = 60 + sum(max(r[2][i].w for r in rows) * z + 10 for i in range(8)) + 4 * (64 * z + 10) + 30
    rh = max(max(p.h for p in r[2]) for r in rows) * z + 40
    sheet = Image.new('RGB', (W, rh * len(rows) + 20), (150, 160, 150)); d = ImageDraw.Draw(sheet)
    for ri, (name, note, props, tiles) in enumerate(rows):
        y0 = 10 + ri * rh; d.text((8, y0), f'{name}: {note}', fill=(15, 15, 25)); x = 60; base = y0 + rh - 20
        for i, p in enumerate(props):
            colw = max(r[2][i].w for r in rows) * z; im = p.im.resize((p.w * z, p.h * z), Image.NEAREST); sheet.paste(im, (x + (colw - im.width) // 2, base - im.height), im); x += colw + 10
        x += 20
        for t in tiles:
            big = Image.new('RGB', (64, 64))
            for i in range(2):
                for j in range(2): big.paste(t.im.convert('RGB'), (i * 32, j * 32))
            big = big.resize((64 * z, 64 * z), Image.NEAREST); sheet.paste(big, (x, base - 64 * z)); x += 64 * z + 10
    sheet.save(out); print(out, sheet.size)
if __name__ == '__main__': main()
