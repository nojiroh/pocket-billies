#!/usr/bin/env python3
"""Hub track HB-4a: relief-map sketches of the hub island's directions (tools/data/hub-sketches.json), for the owner to
pick from. Runs tools/island-sketches.mjs (the island generator in memory; nothing written to the game data), then
draws each direction north up: the ground coloured by kind and shaded by height (light from the north-west, contours
every 2 m), the streets (the second street gold), bridges, the barn and pasture, building plots by kind with a door
tick (green within 45 degrees of facing out from the orbit's pivot, red not), the pivot, and the landmarks (station,
sky rail and portal, lighthouse, windmill). Also a contact sheet of every direction side by side.

    python3 tools/island-sketches.py                  # validation/hub-sketches/<id>.png and sheet.png
    python3 tools/island-sketches.py OUT_DIR a b      # only these directions (the sheet holds what OUT_DIR has)
    python3 tools/island-sketches.py OUT_DIR --above  # also the game's own pictures of each direction (overview from
                                                      # the south-east, the orbit camera at the S, SE and E coast):
                                                      # draft test maps hb4a_<id> go into the game data for the run
                                                      # (stand-in buildings, the dressing), then out again: never
                                                      # commit them. OUT_DIR/above/<scene>/*.png; today is copperleaf

Nothing is sent anywhere."""
import json, math, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
ABOVE = '--above' in sys.argv[1:]
OUT = Path(ARGS[0] if ARGS else 'validation/hub-sketches').resolve()
ONLY = ARGS[1:]
SHOTS = 'overview-se,coast-s,coast-se,coast-e'
S = 4            # pixels a metre
PAD = 40         # metres of sky round the map (the rail and portal run past its edge; drawn to the panel's edge)
PANEL = 330      # the legend's width in pixels

# the ground letters' colours (as tools/island-shots.py's ground map)
COL = {'w': (90, 170, 205), 'd': (40, 95, 160), 'S': (196, 178, 130), 's': (232, 214, 160), 'B': (190, 180, 110),
       '2': (120, 150, 150), '3': (95, 110, 100), 'j': (90, 85, 90), 'G': (110, 165, 80), 'E': (125, 175, 85),
       'g': (100, 155, 70), 'l': (140, 180, 90), 'y': (60, 110, 55), 'L': (70, 105, 50), 'M': (80, 120, 60),
       'F': (55, 95, 50), 'H': (150, 110, 140), 'r': (140, 135, 125), 'P': (165, 155, 140), 'p': (200, 180, 140),
       'v': (185, 160, 120), 'c': (180, 170, 160), 'C': (130, 170, 100), 'u': (150, 170, 90), 't': (90, 140, 60),
       'f': (150, 175, 95)}
# the building plots: colour and a short label
KIND = {'lab': ((235, 235, 245), 'Lab'), 'home': ((255, 170, 90), "Juniper"), 'shop': ((250, 215, 60), 'Store'),
        'mast': ((175, 175, 190), 'Airship'), 'house': ((220, 120, 100), ''), 'farmhouse': ((200, 150, 110), 'Farm'),
        'inn': ((240, 140, 200), 'Inn'), 'workshop': ((150, 120, 90), 'Works'), 'genebank': ((120, 230, 200), 'Genes'),
        'library': ((150, 160, 240), 'Archive'), 'station': ((90, 220, 255), 'Station'),
        'lighthouse': ((255, 255, 255), 'Light'), 'windmill': ((250, 240, 200), 'Mill')}
SKY = (196, 214, 232)


def font(n):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf'):
        if Path(f).exists(): return ImageFont.truetype(f, n)
    return ImageFont.load_default()


def draw(d):
    w, h, T, Hs = d['w'], d['h'], d['T'], d['H']
    W1 = w + 1
    mw, mh = (w + 2 * PAD) * S, (h + 2 * PAD) * S
    im = Image.new('RGB', (mw + PANEL, mh), SKY)
    px = im.load()
    P = lambda x, z: ((x + PAD) * S, (h - z + PAD) * S)   # north up
    hc = lambda i, j: Hs[min(h, max(0, j)) * W1 + min(w, max(0, i))]
    for j in range(h):
        for i in range(w):
            t = T[j * w + i]
            c = COL.get(t, (200, 0, 200))
            y = (hc(i, j) + hc(i + 1, j + 1)) / 2
            if t in 'wd':
                k = 1
            else:
                # light from the north-west: the slope toward it lights, away from it darkens
                gx = (hc(i + 1, j) + hc(i + 1, j + 1) - hc(i, j) - hc(i, j + 1)) / 2
                gz = (hc(i, j + 1) + hc(i + 1, j + 1) - hc(i, j) - hc(i + 1, j)) / 2
                k = max(0.55, min(1.45, 0.92 + y / 70 + (-gx * 0.7 + gz * 0.7) * 0.22))
            c = tuple(min(255, int(v * k)) for v in c)
            # contours every 2 m
            band = lambda v: int(v // 2)
            if t not in 'wd' and y > 1 and (band(hc(i, j)) != band(hc(i + 1, j)) or band(hc(i, j)) != band(hc(i, j + 1))):
                c = tuple(int(v * 0.8) for v in c)
            X, Y = P(i, j + 1)
            for a in range(S):
                for b in range(S):
                    px[X + a, Y + b] = c
    dr = ImageDraw.Draw(im, 'RGBA')
    dr.rectangle([PAD * S, PAD * S, (w + PAD) * S - 1, (h + PAD) * S - 1], outline=(120, 150, 180, 160), width=1)
    for Z in d['zones']:
        dr.polygon([P(*p) for p in Z['poly']], outline=(255, 255, 255, 200), fill=(255, 255, 255, 30))
    for r in d['roads']:
        pts = [P(*p) for p in r['pts']]
        if len(pts) < 2: continue
        town = r['name'].startswith('town')
        col = (255, 200, 40, 255) if r['name'] == 'town second street' else (245, 235, 215, 255) if town else (225, 205, 165, 220)
        dr.line(pts, fill=col, width=max(3, int(r['w'] * S * (1 if town else 0.8))), joint='curve')
    for a, b, pier in d['bridges']:
        dr.line([P(*a), P(*b)], fill=(255, 255, 255) if pier else (200, 70, 40), width=5)
    f = font(12)
    for o in d['doors']:
        col, lab = KIND.get(o['k'], ((255, 0, 255), o['k']))
        a = math.radians(o['a'])
        ca, sa = math.cos(a), math.sin(a)
        # the plot's rectangle: front along (ca, sa), w across
        cs = []
        for u, v in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            ox, oz = u * o['w'] / 2, v * o['d'] / 2
            cs.append(P(o['x'] - sa * ox + ca * oz, o['z'] + ca * ox + sa * oz))
        dr.polygon(cs, fill=col + (255,), outline=(40, 30, 30, 255))
        good = abs(o['off']) <= 45
        fx, fz = o['x'] + ca * (o['d'] / 2), o['z'] + sa * (o['d'] / 2)
        dr.line([P(fx, fz), P(fx + ca * 3.2, fz + sa * 3.2)], fill=(30, 200, 60) if good else (230, 30, 30), width=4)
        if lab:
            X, Y = P(o['x'], o['z'])
            dr.text((X + 1, Y - 6 + 1), lab, fill=(0, 0, 0), font=f, anchor='mm')
            dr.text((X, Y - 6), lab, fill=(255, 255, 255), font=f, anchor='mm')
    L = d.get('landmarks') or {}
    if L.get('rail'):
        pts = [P(p[0], p[1]) for p in L['rail']]
        dr.line(pts, fill=(60, 60, 80, 255), width=7)
        dr.line(pts, fill=(90, 220, 255, 255), width=3)
        for k, p in enumerate(L['rail']):
            if k % 3 == 0:
                X, Y = P(p[0], p[1]); dr.ellipse([X - 3, Y - 3, X + 3, Y + 3], fill=(60, 60, 80))
    if L.get('portal'):
        X, Y = P(*L['portal'][:2])
        dr.ellipse([X - 16, Y - 16, X + 16, Y + 16], outline=(170, 80, 255), width=6)
        dr.text((X, Y + 26), f"portal {L['portal'][2]:.0f} m up", fill=(80, 30, 140), font=f, anchor='mm')
    for F in d.get('falls') or []:
        X, Y = P(F['x'], F['z'])
        tx, ty = P(F['x'] + F['dir'][0] * 6, F['z'] + F['dir'][1] * 6)
        dr.line([X, Y, tx, ty], fill=(255, 255, 255), width=5)
        dr.ellipse([X - 7, Y - 7, X + 7, Y + 7], fill=(40, 140, 255), outline=(255, 255, 255), width=2)
        lab = f"fall? {F['h']:.0f} m" + (' (sea cliff)' if F['site'] == 'cliff' else ' (into the pond)')
        dr.text((X + 11, Y - 14 + 1), lab, fill=(0, 0, 0), font=f, anchor='lm')
        dr.text((X + 10, Y - 14), lab, fill=(255, 255, 255), font=f, anchor='lm')
    X, Y = P(*d['pivot'])
    dr.line([X - 9, Y, X + 9, Y], fill=(20, 20, 20), width=3); dr.line([X, Y - 9, X, Y + 9], fill=(20, 20, 20), width=3)
    dr.text((X - 12, Y), 'orbit pivot (summit)', fill=(20, 20, 20), font=f, anchor='rm')
    # the panel
    x0 = mw + 14
    dr.rectangle([mw, 0, mw + PANEL, mh], fill=(250, 248, 242))
    big, mid = font(22), font(14)
    dr.text((x0, 16), d['name'], fill=(20, 20, 20), font=big)
    y = 50
    for line in wrap(d.get('blurb', ''), 40):
        dr.text((x0, y), line, fill=(60, 60, 60), font=mid); y += 19
    y += 8
    n = len(d['doors'])
    dr.text((x0, y), f"Doors facing out (<=45): {d['n45']} of {n}", fill=(20, 110, 40) if d['n45'] == n else (160, 40, 30), font=mid); y += 20
    dr.text((x0, y), f"On a quarter turn too: {d['quarter']} of {n}", fill=(20, 20, 20), font=mid); y += 26
    counts = {}
    for o in d['doors']: counts[o['k']] = counts.get(o['k'], 0) + 1
    for k, cnt in sorted(counts.items(), key=lambda kv: -kv[1]):
        col, lab = KIND.get(k, ((255, 0, 255), k))
        dr.rectangle([x0, y + 2, x0 + 14, y + 14], fill=col, outline=(40, 30, 30))
        dr.text((x0 + 22, y), f"{lab or 'Cottage'} x{cnt}", fill=(20, 20, 20), font=mid); y += 20
    y += 10
    for col, lab in (((255, 200, 40), 'the second street'), ((245, 235, 215), 'town streets'), ((225, 205, 165), 'paths'),
                     ((200, 70, 40), 'bridges'), ((90, 220, 255), 'sky rail'),
                     (COL['w'], 'shallows: wading (water track WA-6a)'), (COL['d'], 'deep: Surf (WA-6b)'),
                     ((40, 140, 255), "waterfall site (WA-2b, you decide)"), ((30, 200, 60), 'door faces out'),
                     ((230, 30, 30), 'door does not')):
        dr.line([x0, y + 8, x0 + 16, y + 8], fill=col, width=5)
        dr.text((x0 + 22, y), lab, fill=(20, 20, 20), font=mid); y += 20
    y += 10
    rail = (d.get('landmarks') or {}).get('rail')
    if rail:
        run = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(rail, rail[1:]))
        for l in wrap(f"sky rail: {run:.0f} m from the platform, climbing to the portal {rail[-1][2]:.0f} m up "
                      "(the map holds 10 m of sea past the coast: the rail's outer part and the portal stand past "
                      "its edge, in the sky)", 42):
            dr.text((x0, y), l, fill=(40, 90, 120), font=font(12)); y += 16
        y += 6
    for line in [f"seed {d['seed']}, {w} x {h} m, north up", 'white outlines: barn and pasture'] + \
            [f'note: {x}' for x in d['notes']]:
        for l in wrap(line, 42):
            dr.text((x0, y), l, fill=(90, 90, 90), font=font(12)); y += 16
    return im


def wrap(s, n):
    out, cur = [], ''
    for word in s.split():
        if len(cur) + len(word) + 1 > n: out.append(cur); cur = word
        else: cur = (cur + ' ' + word).strip()
    return out + ([cur] if cur else [])


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    subprocess.run(['node', str(ROOT / 'tools/island-sketches.mjs'), str(OUT), *ONLY], check=True, cwd=ROOT)
    order = [d['id'] for d in json.loads((ROOT / 'tools/data/hub-sketches.json').read_text())['directions']]
    ims = []
    for i in order:
        p = OUT / f'{i}.json'
        if not p.exists(): continue
        if not ONLY or i in ONLY:
            im = draw(json.loads(p.read_text()))
            im.save(OUT / f'{i}.png')
            print(f'{OUT / (i + ".png")}')
        if (OUT / f'{i}.png').exists(): ims.append(Image.open(OUT / f'{i}.png'))
    if ims:
        k = 0.5
        tw, th = int(ims[0].width * k), int(ims[0].height * k)
        cols = 2
        sheet = Image.new('RGB', (tw * cols, th * ((len(ims) + cols - 1) // cols)), (255, 255, 255))
        for n, im in enumerate(ims):
            sheet.paste(im.resize((tw, th), Image.LANCZOS), ((n % cols) * tw, (n // cols) * th))
        sheet.save(OUT / 'sheet.png')
        print(f'{OUT / "sheet.png"}')
    if ABOVE:
        above(order)


def above(order):
    run = lambda *a: subprocess.run(list(a), check=True, cwd=ROOT)
    ids = [i for i in order if not ONLY or i in ONLY]
    run('node', str(ROOT / 'tools/island-sketches.mjs'), str(OUT), *ids, '--drafts')
    try:
        run('npm', 'run', '-s', 'data')
        for i in ids:
            sc = 'copperleaf' if i == 'today' else f'hb4a_{i}'
            run(sys.executable, str(ROOT / 'tools/island-shots.py'), str(OUT / 'above' / sc), f'--scene={sc}', f'--only={SHOTS}')
    finally:
        run('node', str(ROOT / 'tools/island-sketches.mjs'), '--clean')
        run('npm', 'run', '-s', 'data')


if __name__ == '__main__':
    main()
