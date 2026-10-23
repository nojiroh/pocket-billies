#!/usr/bin/env python3
"""RF-2: the catch pyramids' icons and 3D models (game/art/coins/<id>_16.png, _32.png and <id>.json; the ids stay
the coins' until RF-4).

Each icon is drawn at its own size (never scaled): a pyramid seen from a little above and to the left, the left face
lit and the right face in shade, a dark outline. The tier colours stay the coins' so the four read apart at 16 px:
  penny  Pyramid       copper sandstone, courses of stone blocks
  silver Step Pyramid  silver-grey limestone, steps
  gold   Gold Pyramid  gold, a shine down the lit face
  tbtf   Capstone      a small platinum-blue tip with a gold point and a few glints round it

The models are recipes for the 3D props' code (prop-models.js; low-poly, the buildings' 32 px textures), thrown in
battle (battle-3d.js). They stand 2 cm up (PYRAMID_LIFT in battle-3d.js takes it back off): a shape on the ground
gets no underside, and a thrown pyramid shows its underside as it tumbles.

  python3 tools/build-pyramids.py            writes the eight PNGs and the four recipes
  python3 tools/build-pyramids.py --sheet F  also writes a 4x zoomed contact sheet to F
"""
import argparse
import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'game', 'art', 'coins')


def hx(s):
    return (int(s[1:3], 16), int(s[3:5], 16), int(s[5:7], 16), 255)


# hi, lit, mid, shade, dark, outline
PALETTES = {
    'penny': ['#ffd2a8', '#f0a066', '#d47a3e', '#a5532a', '#6b3218', '#2e1408'],
    'silver': ['#ffffff', '#d4dce2', '#b4bec7', '#8c97a2', '#5f6b75', '#252c33'],
    'gold': ['#fff6c8', '#ffd866', '#f0bb40', '#c98a1b', '#9c6a0c', '#3a2405'],
    'tbtf': ['#eef1ff', '#b4c0ff', '#8fa0f0', '#5d6fd0', '#33449a', '#0e1230'],
}
GOLD_TIP = ['#fff6c8', '#ffd866', '#f0bb40', '#c98a1b', '#9c6a0c', '#3a2405']


def tri_area(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def inside(p, a, b, c):
    d1, d2, d3 = tri_area(a, b, p), tri_area(b, c, p), tri_area(c, a, p)
    neg = d1 < 0 or d2 < 0 or d3 < 0
    pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (neg and pos)


def shape(n, kind):
    """the four corners (apex, left, front, right) in pixels, for an n x n icon"""
    s = n / 32
    if kind == 'tbtf':
        # the capstone is the small tip: a squat pyramid low in the frame
        return [(16 * s, 7 * s), (4.5 * s, 25 * s), (17 * s, 29 * s), (28.5 * s, 24 * s)]
    return [(16 * s, 2.5 * s), (2.5 * s, 25 * s), (17 * s, 29.5 * s), (29.5 * s, 24 * s)]


def draw(kind, n):
    P = [hx(c) for c in PALETTES[kind]]
    G = [hx(c) for c in GOLD_TIP]
    hi, lit, mid, shade, dark, line = P
    A, L, F, R = shape(n, kind)
    im = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    px = im.load()
    face = [[None] * n for _ in range(n)]
    tier_h = max(3, round(n / 32 * 7))
    for y in range(n):
        for x in range(n):
            p = (x + 0.5, y + 0.5)
            f = 'l' if inside(p, A, L, F) else 'r' if inside(p, A, F, R) else None
            if kind == 'silver' and p[1] > A[1]:
                # steps: each tier a block with upright sides, as wide as the triangle near the tier's foot
                t = int((p[1] - A[1]) // tier_h)
                k = min(0.88, (t + 0.9) * tier_h / (L[1] - A[1]))
                lx = A[0] + (L[0] - A[0]) * k
                rx = A[0] + (R[0] - A[0]) * k
                above_base = tri_area(L, F, p) <= 0 and tri_area(F, R, p) <= 0
                if lx <= p[0] <= rx and above_base:
                    kr = (p[1] - A[1]) / (F[1] - A[1])
                    f = 'l' if p[0] < A[0] + (F[0] - A[0]) * kr else 'r'
                else:
                    f = None
            face[y][x] = f
    for y in range(n):
        for x in range(n):
            f = face[y][x]
            if not f:
                continue
            c = lit if f == 'l' else shade
            # the bottom row of each face sits in its own shadow
            below = face[y + 1][x] if y + 1 < n else None
            if not below:
                c = mid if f == 'l' else dark
            if kind == 'penny':
                # courses of stone blocks: a darker line every few rows, joints offset course to course
                ch = max(3, round(n / 32 * 4))
                row = int(y - A[1])
                if row > 1 and row % ch == 0:
                    c = mid if f == 'l' else dark
                elif n >= 32 and row > ch and (x + (row // ch) * 3) % 7 == 0:
                    c = mid if f == 'l' else dark
            if kind == 'silver':
                row = y - A[1]
                if row > 0 and int(row) % tier_h == 0:
                    c = hi if f == 'l' else mid  # the top of each step catches the light
            if kind == 'gold' and f == 'l':
                # a shine down the lit face, parallel to the left edge
                k = (y + 0.5 - A[1]) / (L[1] - A[1])
                ex = A[0] + (L[0] - A[0]) * k
                d = x + 0.5 - ex
                if n / 32 * 3 <= d <= n / 32 * 3 + max(1, n / 32 * 1.6) and 0.15 < k < 0.8:
                    c = hi
            if kind == 'tbtf':
                # the gold point: the top of the capstone
                if y + 0.5 < A[1] + (F[1] - A[1]) * 0.36:
                    c = G[1] if f == 'l' else G[3]
                    if not below:
                        c = G[2]
            px[x, y] = c
    # the ridge between the faces catches the light
    for y in range(n):
        k = (y + 0.5 - A[1]) / (F[1] - A[1])
        if 0.05 < k < 0.97:
            x = int(A[0] + (F[0] - A[0]) * k)
            if 0 <= x < n and face[y][x]:
                tip = kind == 'tbtf' and k < 0.36
                px[x, y] = (G if tip else P)[0] if k < 0.5 else (G if tip else P)[1]
    # outline: every empty pixel that touches the pyramid
    for y in range(n):
        for x in range(n):
            if face[y][x]:
                continue
            if any(
                0 <= x + dx < n and 0 <= y + dy < n and face[y + dy][x + dx]
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            ):
                px[x, y] = line
    if kind == 'tbtf':
        # glints round the capstone: it never fails
        g = [(5, 9), (27, 10), (7, 4)] if n >= 32 else [(2, 4), (13, 5)]
        for gx, gy in g:
            px[gx, gy] = P[0]
            if n >= 32:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    px[gx + dx, gy + dy] = P[2]
    return im


LIFT = 0.02  # metres
SIDE = 0.34  # the base's side, metres
HIGH = 0.3  # the height, metres


def recipe(kind):
    """the model: x across, y in depth, z up (metres), as a prop's recipe"""
    P = PALETTES[kind]
    r = SIDE / 2 ** 0.5  # a 4-sided cone's corner radius, turned 45 degrees so its faces are square to x and y
    cone = {'k': 'cone', 'x': 0, 'y': 0, 'sides': 4, 'rot': 0.7854, 'facet': 1}
    if kind == 'penny':
        L = [{**cone, 'z': LIFT, 'r': r, 'h': HIGH, 'col': P[2], 'tex': 'brick', 'name': 'pyramid'}]
    elif kind == 'silver':
        n = 3
        L = [
            {
                'k': 'box', 'x': 0, 'y': 0, 'z': round(LIFT + i * HIGH / n, 3),
                'w': round(SIDE * (1 - i / n), 3), 'd': round(SIDE * (1 - i / n), 3), 'h': round(HIGH / n, 3),
                'col': P[2], 'tex': 'stone', 'name': f'step {i + 1}',
            }
            for i in range(n)
        ]
    elif kind == 'gold':
        L = [{**cone, 'z': LIFT, 'r': r, 'h': HIGH, 'col': P[2], 'tex': 'plain', 'name': 'pyramid'}]
    else:
        # the capstone: a smaller pyramid, platinum blue with its top in gold
        cr, ch, cut = r * 0.8, HIGH * 0.75, 0.6
        L = [
            {**cone, 'z': LIFT, 'r': round(cr, 4), 'r1': round(cr * (1 - cut), 4), 'h': round(ch * cut, 4),
             'col': P[2], 'tex': 'plain', 'name': 'stone'},
            {**cone, 'z': round(LIFT + ch * cut, 4), 'r': round(cr * (1 - cut), 4), 'h': round(ch * (1 - cut), 4),
             'col': GOLD_TIP[1], 'tex': 'plain', 'name': 'gold point'},
        ]
    for l in L:
        if 'r' in l:
            l['r'] = round(l['r'], 4)
    return {'about': f'RF-2: the {kind} catch pyramid (tools/build-pyramids.py)', 'cel': 0.6, 'layers': L}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sheet')
    a = ap.parse_args()
    kinds = ['penny', 'silver', 'gold', 'tbtf']
    for k in kinds:
        for n in (16, 32):
            draw(k, n).save(os.path.join(OUT, f'{k}_{n}.png'), optimize=True)
        with open(os.path.join(OUT, f'{k}.json'), 'w') as f:
            f.write(json.dumps(recipe(k), ensure_ascii=False) + '\n')
    if a.sheet:
        z = 4
        sh = Image.new('RGBA', (len(kinds) * (48 + 4) * z, 36 * z), (40, 44, 56, 255))
        for i, k in enumerate(kinds):
            for j, n in enumerate((32, 16)):
                im = draw(k, n).resize((n * z, n * z), Image.NEAREST)
                sh.paste(im, ((i * 52 + j * 34) * z, 2 * z), im)
        sh.save(a.sheet)
    print('wrote', len(kinds) * 2, 'icons and', len(kinds), 'models to', os.path.relpath(OUT, ROOT))


if __name__ == '__main__':
    main()
