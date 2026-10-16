#!/usr/bin/env python3
"""v17 world: the stops stand farther apart and the big city, Capital Gains, sits in the middle.

    python3 tools/build-world-v17.py

Game data: every stop moves away from Sundown (east-west by 1.18, north-south by 1.7), every road costs 40% more
steps, and node 12 "Capital Gains" is added with roads to Hillside Farm, the Bubbling Grotto and the Scrap
Yard (the Scrap Yard now also needs the Ground Badge, like the canyon steps, so the city is no shortcut).
The city gets a general store, a clothes outlet (it sells the other boutiques' clothes), two trainers and a wild
pool. The world picture (game/art/map/world.png) gets its stop patches moved with the stops and a new city patch;
the trails are repainted afterwards by tools/repaint-world-trails.py and the 3D relief by tools/build-world-relief.py.
Runs once: a second run sees the city and only repaints nothing."""
import json, math, random, shutil
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'data' / 'gamedata.js'
WORLD = ROOT / 'game' / 'art' / 'map' / 'world.png'
KLON, KLAT, KCOST = 1.18, 1.7, 1.4
CITY = 'Capital Gains'


def load():
    s = DATA.read_text(encoding='utf-8'); i = s.index('window.GAMEDATA=')
    return s[:i], json.JSONDecoder().raw_decode(s[i + 16:])[0]


def uv(lon, lat, W, H):
    return ((lon / 360) % 1 * W, (.5 - lat / 180) * H)


def move_patches(old, new, city):
    """cut each stop's painted patch out (pixels whose colours the open land never uses), fill the hole with the
    nearest land pixels, and paste the patch where the stop now stands"""
    from scipy import ndimage
    src = ROOT / 'tools' / 'backup' / 'world_v16.png'
    im = np.asarray(Image.open(src).convert('RGB')).astype(np.int32); H, W, _ = im.shape
    R = 26
    yy, xx = np.mgrid[0:H, 0:W]; near = np.zeros((H, W), bool); discs = []
    for (lon, lat) in old:
        cx, cy = uv(lon, lat, W, H); dx = (xx - cx + W / 2) % W - W / 2
        d = dx * dx + (yy - cy) ** 2 <= R * R; discs.append((int(round(cx)), int(round(cy)))); near |= d
    key = (im[..., 0] << 16) | (im[..., 1] << 8) | im[..., 2]
    vals, cnt = np.unique(key[~near], return_counts=True); land = set(vals[cnt > 150].tolist())
    patch = near & ~np.isin(key, list(land))
    patch = ndimage.binary_closing(patch, iterations=2) & near
    # holes filled from the nearest land pixel
    idx = ndimage.distance_transform_edt(patch, return_distances=False, return_indices=True)
    base = im[idx[0], idx[1]]
    out = base.copy()
    for (cx, cy), (lon, lat) in zip(discs, new):
        nx, ny = [int(round(v)) for v in uv(lon, lat, W, H)]
        ys = np.arange(cy - R, cy + R + 1); xs = np.arange(cx - R, cx + R + 1) % W
        ys = np.clip(ys, 0, H - 1)
        m = patch[np.ix_(ys, xs)]; blk = im[np.ix_(ys, xs)]
        ty = np.clip(np.arange(ny - R, ny + R + 1), 0, H - 1); tx = np.arange(nx - R, nx + R + 1) % W
        cur = out[np.ix_(ty, tx)]; out[np.ix_(ty, tx)] = np.where(m[..., None], blk, cur)
    # the city: a grey grid of blocks with a green park and a gold plaza
    clon, clat = city; cx, cy = [int(round(v)) for v in uv(clon, clat, W, H)]
    rng = random.Random(12)
    for y in range(cy - 16, cy + 17):
        for x in range(cx - 22, cx + 23):
            d = ((x - cx) / 22) ** 2 + ((y - cy) / 16) ** 2
            if d > 1 + .1 * math.sin(x * .7) * math.cos(y * .5): continue
            X = x % W
            if (x - cx) % 7 in (0,) or (y - cy) % 6 in (0,): c = (226, 222, 212)
            else:
                g = rng.random(); c = (150, 154, 168) if g < .45 else (178, 170, 184) if g < .7 else (204, 132, 112) if g < .85 else (120, 126, 146)
                if abs(x - cx) < 4 and abs(y - cy) < 3: c = (230, 196, 90)
                if 6 < (x - cx) < 15 and 3 < (y - cy) < 11: c = (96, 168, 84) if (x + y) % 5 else (70, 140, 70)
            out[y, X] = c
    Image.fromarray(out.astype(np.uint8)).save(WORLD)


def main():
    import sys
    head, D = load(); R = D['route']
    if any(r['name'] == CITY for r in R):
        if '--repaint' in sys.argv:
            old = [(r['lon'] / KLON, r['lat'] / KLAT) for r in R[:-1]]
            move_patches(old, [(r['lon'], r['lat']) for r in R[:-1]], (R[-1]['lon'], R[-1]['lat'])); print('repainted the patches')
        else: print('the city is already there; nothing to do (--repaint paints the map again)')
        return
    (ROOT / 'tools' / 'backup').mkdir(exist_ok=True); shutil.copy(WORLD, ROOT / 'tools' / 'backup' / 'world_v16.png')
    old = [(r['lon'], r['lat']) for r in R]
    for r in R:
        r['lon'] = round(r['lon'] * KLON, 2); r['lat'] = round(r['lat'] * KLAT, 2)
    D['links'] = [[a, b, int(round(c * KCOST / 10) * 10)] for a, b, c in D['links']]
    for r in R:
        if r.get('cost'): r['cost'] = int(round(r['cost'] * KCOST / 10) * 10)
    clon, clat = round(42 * KLON, 2), round(9 * KLAT, 2)
    R.append({'name': CITY, 'town': 1, 'cost': 0, 'pool': 'city', 'route': 'Route 1', 't': 'city',
              'blurb': 'The big city in the middle of the inner world: towers, traffic, a fountain plaza and shops that never close.',
              'lon': clon, 'lat': clat, 'shop': 'capital', 'boutique': 'outlet', 'area': 'food', 'scene': 'city'})
    c = len(R) - 1
    D['links'] += [[10, c, 1400], [4, c, 1600], [c, 6, 1800]]
    sy = R[6]; sy['gate'] = 'oil'; sy['gateText'] = 'The road into the Scrap Yard opens once you earn Leader Rocco’s Ground Badge.'
    D['pools']['city'] = {'lv': [12, 16], 'list': [['latte0', 30], ['kiosk0', 30], ['hype0', 25], ['goss0', 20], ['comp0', 18], ['logo0', 14], ['oprah0', 8], ['trend1', 5], ['latte1', 4]]}
    D['shops']['capital'] = {'name': 'Capital Mart', 'keeper': 'Penny Ledger', 'who': 'cashier', 'greeting': 'Welcome to Capital Mart! Open all hours, every hour, including the extra ones.',
                             'stock': [{'item': 'taxbreak', 'price': 150}, {'item': 'apology', 'price': 190}, {'item': 'settlement', 'price': 200}, {'item': 'appeal', 'price': 200},
                                       {'item': 'trailmix', 'price': 240}, {'item': 'loophole', 'price': 380}, {'item': 'bailout', 'price': 580}, {'coin': 'penny', 'price': 290}]}
    D['shops']['outlet'] = {'name': 'Capital Outlet', 'keeper': 'Vera Velvet', 'who': 'vera', 'kind': 'wardrobe', 'sells': ['thrift', 'sports', 'designer'],
                            'greeting': 'Last season from every boutique in the inner world, all under one roof. Same prices, more mirrors.',
                            'thanks': ['A city look if I ever saw one.', 'Walk tall, the pigeons are watching.', 'Come back when the window display changes.']}
    P = D['people']
    P['cashier'] = {'hair': '#3A2A22', 'style': 'pony', 'top': '#3E8A4E', 'top2': '#2A6436', 'bottom': '#3A3E4A', 'shoe': '#2A2220', 'skin': '#D9A07A', 'apron': 1,
                    'look': {'name': 'Penny', 'body': {'chest': .5, 'hips': 1.04}, 'skin': '#D9A07A', 'hair': '#3A2A22', 'eyes': '#4A3A24',
                             'wear': {'hair': 'hair_bun', 'top': 'dress_shirt', 'outer': 'apron', 'bottom': 'trousers', 'shoes': 'oxfords', 'mouth': 'mouth_smile', 'neck': 'nametag'}, 'colors': {'apron': ['#3E8A4E', '#2A6436']}}}
    P['vera'] = {'hair': '#1E1A22', 'style': 'bob', 'top': '#2A2A34', 'top2': '#1A1A22', 'bottom': '#7A3A5A', 'shoe': '#1E1A22', 'skin': '#8A5A3A',
                 'look': {'name': 'Vera', 'body': {'chest': .6, 'hips': 1.08, 'height': 1.04}, 'skin': '#8A5A3A', 'hair': '#1E1A22', 'eyes': '#3A2A1A',
                          'wear': {'hair': 'hair_bob', 'eyes': 'eyes_sharp', 'brows': 'brows_arched', 'mouth': 'mouth_smirk', 'top': 'dress_shirt', 'outer': 'blazer', 'bottom': 'skirt', 'shoes': 'oxfords', 'glasses': 'glasses_round'},
                          'colors': {'blazer': ['#7A3A5A', '#5A2440'], 'skirt': ['#2A2A34']}}}
    P['broker'] = {'hair': '#C9A24A', 'style': 'short', 'top': '#3A4E7A', 'top2': '#2A3A5E', 'bottom': '#2A2A34', 'shoe': '#1E1410', 'skin': '#F0C3A0', 'tie': '#C8323C'}
    P['intern'] = {'hair': '#6A3A22', 'style': 'pony', 'hat': '#3E8FB0', 'top': '#E8E2D4', 'top2': '#C8C2B4', 'bottom': '#3E6FB0', 'shoe': '#F4F4F4', 'skin': '#C98E66', 'pack': '#3E8A6E'}
    T = D['trainers']
    T['broker'] = {'name': 'Broker Bea', 'who': 'broker', 'area': 'food', 'node': c, 'blocks': False,
                   'team': [{'sp': 'latte0', 'lvl': 14}, {'sp': 'hype0', 'lvl': 15}, {'sp': 'kiosk0', 'lvl': 16}], 'reward': 900, 'egg': 5, 'market': None,
                   'lines': ['“Buy low, battle high!”', '“My team is fully diversified.”'], 'win': '“A correction. Happens to the best of us.”', 'lose': '“Ka-ching. Better luck next quarter.”',
                   'hint': 'Broker Bea waits on the city plaza with a level 14–16 team.'}
    T['intern'] = {'name': 'Intern Ollie', 'who': 'intern', 'area': 'food', 'node': c, 'blocks': False,
                   'team': [{'sp': 'goss0', 'lvl': 13}, {'sp': 'comp0', 'lvl': 14}], 'reward': 600, 'egg': 2, 'market': None,
                   'lines': ['“I’m only here for the experience. And the battles.”', '“Unpaid, but very motivated!”'], 'win': '“Can I put this on my résumé anyway?”', 'lose': '“Promotion, here I come!”',
                   'hint': 'Intern Ollie is trying to impress the bosses outside Capital Tower.'}
    move_patches(old, [(r['lon'], r['lat']) for r in R[:-1]], (clon, clat))
    DATA.write_text(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
    print('moved', len(old), 'stops; city at', clon, clat, '| links', len(D['links']))


if __name__ == '__main__':
    main()
