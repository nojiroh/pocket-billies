#!/usr/bin/env python3
"""v35: the three starter lines as silhouette and colour studies (the plan's v35 gate: "3 starters approved as
silhouettes"). Not finished art: blocked shapes in palette colours at the battle scale (96 px canvas; 128 px for
stage 3) to judge the read of each line at 24 px, the shape family (stage 3 contains stage 1) and the colour split.
Writes game/art/next/starters/<id>.png (colour study), <id>_sil.png (black, 24 px) and a sheet for review.

    python3 tools/build-starter-studies.py --sheet validation/v35-starters.png

A study that exists is left alone (paint over it by hand in any editor); --force remakes them."""
import argparse, json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
NEXT = ROOT / 'game' / 'art' / 'next'
OUT = NEXT / 'starters'

def palette():
    js = (NEXT / 'palette.js').read_text(); d = json.loads(js[js.index('=') + 1:js.rindex(';')])
    return {k: [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in v] for k, v in d['ramps'].items() if isinstance(v, list)}

# shape language: (kind, ramp, step, x, y, w, h [, extra]) on a 96x96 canvas, origin bottom-centre at (48, 90)
# kinds: e = ellipse, r = rect, t = triangle (apex up), tl/tr = triangle leaning left/right, c = circle
def E(r, s, x, y, w, h): return ('e', r, s, x, y, w, h)
def R(r, s, x, y, w, h): return ('r', r, s, x, y, w, h)
def T(r, s, x, y, w, h): return ('t', r, s, x, y, w, h)
STUDIES = {
 # Musk line: muskox. Stage 1 small and round; horns grow into landing legs; the final splits: Mars (red dust, big) / Meme (floats on a cloud)
 'emberox': (96, [E('stone', 2, 48, 70, 40, 26), E('stone', 3, 48, 66, 34, 20), E('stone', 3, 36, 56, 22, 20), E('stone', 1, 30, 52, 10, 6), E('stone', 1, 44, 50, 8, 5),
             R('stone', 1, 34, 78, 6, 12), R('stone', 1, 54, 78, 6, 12), E('ember', 5, 70, 60, 8, 8), E('ember', 3, 72, 56, 5, 5), E('skin', 0, 32, 60, 4, 4)]),
 'boostox': (96, [E('stone', 2, 50, 62, 52, 32), E('stone', 3, 50, 58, 44, 24), E('stone', 3, 30, 46, 26, 24), T('stone', 1, 24, 34, 10, 14), T('stone', 1, 40, 34, 10, 14),
             R('stone', 1, 32, 76, 7, 16), R('stone', 1, 60, 76, 7, 16), R('steel', 4, 62, 48, 22, 12), E('ember', 4, 86, 54, 10, 10), E('ember', 6, 86, 54, 5, 5), E('skin', 0, 26, 50, 4, 4)]),
 'marsox': (128, [E('rust', 2, 64, 78, 90, 50), E('rust', 3, 64, 72, 78, 38), E('rust', 3, 34, 52, 40, 36), T('stone', 4, 22, 28, 14, 26), T('stone', 4, 50, 28, 14, 26),
            R('rust', 1, 40, 100, 10, 24), R('rust', 1, 84, 100, 10, 24), R('steel', 3, 30, 118, 10, 6), R('steel', 3, 84, 118, 10, 6), E('ember', 5, 110, 70, 14, 14), E('skin', 0, 28, 56, 5, 5)]),
 'memeox': (128, [E('sky', 6, 64, 100, 90, 26), E('sky', 7, 44, 94, 40, 22), E('sky', 7, 84, 92, 44, 24), E('stone', 2, 64, 64, 70, 40), E('stone', 3, 64, 60, 60, 30), E('stone', 3, 36, 44, 34, 30),
            E('sky', 4, 22, 24, 22, 14), E('sky', 4, 50, 24, 22, 14), R('steel', 6, 90, 50, 16, 24), E('violet', 4, 108, 40, 10, 10), E('skin', 0, 30, 48, 6, 6)]),
 # Bezos line: river otter with a box; the final splits: rocket (blue shell, cowboy hat) / warehouse with legs
 'cartotter': (96, [E('skin_deep', 3, 48, 68, 30, 40), E('skin_deep', 4, 48, 72, 20, 26), E('skin_deep', 3, 48, 46, 24, 22), E('skin_deep', 2, 38, 36, 8, 8), E('skin_deep', 2, 58, 36, 8, 8),
               R('straw', 2, 28, 74, 22, 18), R('straw', 4, 30, 76, 18, 14), R('skin_deep', 1, 39, 80, 18, 3), E('skin_deep', 2, 68, 82, 18, 8), E('skin', 0, 44, 46, 4, 4)]),
 'primotter': (96, [E('skin_deep', 3, 48, 64, 36, 46), E('skin_deep', 4, 48, 68, 24, 30), E('skin_deep', 3, 44, 38, 28, 26), E('skin_deep', 2, 32, 28, 9, 9), E('skin_deep', 2, 56, 28, 9, 9),
               R('straw', 3, 62, 24, 22, 18), R('straw', 3, 66, 44, 22, 18), R('straw', 4, 64, 64, 22, 16), R('skin_deep', 1, 75, 64, 22, 3), E('skin_deep', 2, 20, 84, 20, 8), E('skin', 0, 40, 38, 5, 5)]),
 'orbitotter': (128, [E('cobalt', 3, 64, 78, 56, 90), E('cobalt', 4, 64, 80, 36, 60), E('skin_deep', 3, 64, 40, 38, 34), E('skin_deep', 2, 48, 26, 12, 12), E('skin_deep', 2, 80, 26, 12, 12),
                R('straw', 1, 40, 14, 48, 8), E('straw', 2, 64, 10, 28, 12), T('steel', 4, 30, 100, 14, 24), T('steel', 4, 98, 100, 14, 24), E('sky', 5, 64, 126, 50, 10), E('skin', 0, 58, 40, 6, 6)]),
 'everyotter': (128, [R('steel', 3, 64, 70, 100, 70), R('steel', 4, 64, 66, 90, 56), R('steel', 2, 64, 44, 100, 10), E('skin_deep', 3, 64, 30, 36, 30), E('skin_deep', 2, 48, 16, 10, 10), E('skin_deep', 2, 80, 16, 10, 10),
                 R('steel', 1, 32, 116, 10, 24), R('steel', 1, 96, 116, 10, 24), R('straw', 3, 40, 76, 18, 16), R('straw', 3, 64, 76, 18, 16), R('straw', 3, 88, 76, 18, 16), E('steel', 6, 112, 20, 10, 6), E('steel', 6, 20, 24, 10, 6), E('skin', 0, 58, 30, 6, 6)]),
 # Gates line: goat kid in a sweater; a plain window on its flank (no real logos anywhere); final splits: screen horns / farmland goat
 'kidling': (96, [E('stone', 6, 48, 70, 32, 28), R('teal', 3, 48, 72, 30, 18), E('stone', 6, 46, 46, 24, 22), E('stone', 5, 34, 42, 10, 6), E('stone', 5, 58, 42, 10, 6), T('stone', 4, 40, 32, 6, 10), T('stone', 4, 52, 32, 6, 10),
             R('stone', 3, 36, 84, 6, 10), R('stone', 3, 56, 84, 6, 10), R('steel', 2, 66, 66, 12, 12), E('skin', 0, 42, 48, 4, 4)]),
 'billgoat': (96, [E('stone', 6, 48, 64, 46, 34), E('stone', 6, 30, 42, 28, 26), T('stone', 4, 18, 22, 10, 18), T('stone', 4, 38, 22, 10, 18), R('stone', 3, 30, 84, 7, 14), R('stone', 3, 64, 84, 7, 14),
              R('sky', 4, 63, 59, 18, 18), R('stone', 7, 63, 59, 2, 18), R('stone', 7, 63, 59, 18, 2), E('skin', 0, 24, 44, 4, 4)]),
 'windowgoat': (128, [E('stone', 6, 64, 80, 70, 50), E('stone', 6, 36, 50, 40, 36), R('cobalt', 3, 18, 20, 20, 26), R('cobalt', 3, 50, 20, 20, 26), R('sky', 6, 20, 24, 6, 4), R('sky', 6, 52, 24, 6, 4),
                R('stone', 3, 36, 112, 10, 22), R('stone', 3, 92, 112, 10, 22), E('teal', 4, 100, 70, 16, 10), E('skin', 0, 28, 52, 6, 6)]),
 'harvestgoat': (128, [E('olive', 3, 64, 82, 96, 52), E('olive', 2, 64, 74, 80, 12), E('olive', 2, 64, 90, 80, 12), E('stone', 6, 32, 50, 42, 38), T('stone', 4, 14, 20, 14, 26), T('stone', 4, 50, 20, 14, 26),
                 E('steel', 1, 44, 66, 30, 14), R('stone', 3, 34, 114, 10, 20), R('stone', 3, 96, 114, 10, 20), E('straw', 4, 108, 70, 18, 10), E('skin', 0, 24, 52, 6, 6)]),
}
ORDER = ['emberox', 'boostox', 'marsox', 'memeox', 'cartotter', 'primotter', 'orbitotter', 'everyotter', 'kidling', 'billgoat', 'windowgoat', 'harvestgoat']

def draw(spec, P, black=False):
    size, shapes = spec; im = Image.new('RGBA', (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for k, ramp, step, x, y, w, h in shapes:
        col = (24, 20, 34, 255) if black else P[ramp][step] + (255,)
        x0, y0, x1, y1 = x - w // 2, y - h // 2, x + w // 2, y + h // 2
        if k == 'e': d.ellipse([x0, y0, x1, y1], fill=col)
        elif k == 'r': d.rectangle([x0, y0, x1, y1], fill=col)
        elif k == 't': d.polygon([(x, y0), (x1, y1), (x0, y1)], fill=col)
    if not black:  # sel-out outline: darkest step of the shape's ramp, one pixel, where a shape meets empty
        px = im.load(); W = H = size; out = im.copy(); po = out.load()
        for yy in range(H):
            for xx in range(W):
                if px[xx, yy][3] == 0: continue
                edge = any(0 <= xx + dx < W and 0 <= yy + dy < H and px[xx + dx, yy + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                if edge:
                    c = px[xx, yy][:3]; ramp = next((r for r in P if c in P[r]), None)
                    po[xx, yy] = (P[ramp][0] + (255,)) if ramp else (24, 20, 34, 255)
        im = out
    return im

def sil24(im):
    bb = im.getbbox(); c = im.crop(bb); k = min(24 / c.width, 24 / c.height); s = c.resize((max(1, round(c.width * k)), max(1, round(c.height * k))), Image.LANCZOS)
    o = Image.new('RGBA', (24, 24), (0, 0, 0, 0)); o.paste(s, ((24 - s.width) // 2, 24 - s.height)); p = o.load()
    for y in range(24):
        for x in range(24): p[x, y] = (24, 20, 34, 255) if p[x, y][3] > 90 else (0, 0, 0, 0)
    return o

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--force', action='store_true'); ap.add_argument('--sheet'); a = ap.parse_args()
    P = palette(); OUT.mkdir(parents=True, exist_ok=True); n = 0
    for sid in ORDER:
        f = OUT / f'{sid}.png'
        if a.force or not f.exists(): draw(STUDIES[sid], P).save(f); n += 1
        g = OUT / f'{sid}_sil.png'
        if a.force or not g.exists(): sil24(draw(STUDIES[sid], P, True)).save(g); n += 1
    print(f'{n} studies written to {OUT}')
    if a.sheet:
        z = 2; cell = 128 * z + 16; sh = Image.new('RGB', (4 * cell, 3 * (cell + 60)), (230, 226, 218)); d = ImageDraw.Draw(sh)
        for i, sid in enumerate(ORDER):
            cx, cy = (i % 4) * cell, (i // 4) * (cell + 60)
            im = Image.open(OUT / f'{sid}.png'); im2 = im.resize((im.width * z, im.height * z), Image.NEAREST)
            sh.paste(im2, (cx + (cell - im2.width) // 2, cy + cell - im2.height - 8), im2)
            s = Image.open(OUT / f'{sid}_sil.png'); sh.paste(s, (cx + 8, cy + cell + 8), s); s3 = s.resize((72, 72), Image.NEAREST); sh.paste(s3, (cx + 40, cy + cell - 10), s3)
            d.text((cx + 8, cy + cell + 36), sid, fill=(40, 40, 50))
        Path(a.sheet).parent.mkdir(parents=True, exist_ok=True); sh.save(a.sheet)

if __name__ == '__main__':
    main()
