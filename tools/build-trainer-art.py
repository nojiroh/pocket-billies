"""Draws the trainer body, hairstyles, faces and clothing (tools/trainer_gen) and writes them to game/art/trainer/,
with the wardrobe data in game/data/gamedata.js under "wardrobe".

    python3 tools/build-trainer-art.py            only adds what's missing (never touches art you've edited)
    python3 tools/build-trainer-art.py --force    redraws everything and resets the wardrobe data
    python3 tools/build-trainer-art.py --only=hat_cap,tee    redraws just those items (art and data)

Each item becomes two images: the picture in its default colours, and a colour-area mask (red, green and blue mark
the areas the game recolours)."""
import gamedata  # phase 04b: the data files in game/data
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools' / 'trainer_gen'))
import body as BODY  # noqa
import items, items2  # noqa  (items2 registers more items)
from items import ITEMS  # noqa

ART = ROOT / 'game' / 'art' / 'trainer'
DATA = ROOT / 'game' / 'data' / 'gamedata.js'
FORCE = '--force' in sys.argv
ONLY = next((a.split('=', 1)[1].split(',') for a in sys.argv if a.startswith('--only=')), None)  # redraw just these items

SLOTS = [  # id, name, dressing-room tab, layer within a bone, can be empty
    ('hair', 'Hair', 'hair', .70, True), ('eyes', 'Eyes', 'face', .55, False), ('brows', 'Brows', 'face', .72, True), ('mouth', 'Mouth', 'face', .55, False),
    ('facial', 'Facial hair & freckles', 'face', .57, True), ('top', 'Top', 'top', .30, False), ('outer', 'Jacket & coat', 'top', .40, True),
    ('bottom', 'Bottoms', 'bottom', .10, False), ('shoes', 'Shoes', 'shoes', .20, True), ('hat', 'Hat', 'hat', .80, True),
    ('glasses', 'Glasses', 'extras', .75, True), ('neck', 'Neck', 'extras', .45, True), ('bag', 'Bag', 'extras', .50, True)]
SLIDERS = [('height', 'Height', .88, 1.12, 1), ('legs', 'Leg length', .86, 1.16, 1), ('arms', 'Arm length', .88, 1.14, 1), ('body', 'Body size', .82, 1.35, 1),
           ('shoulders', 'Shoulders', .86, 1.18, 1), ('hips', 'Hips', .86, 1.22, 1), ('chest', 'Chest', 0, 1, .2), ('head', 'Head size', .9, 1.12, 1)]
PALETTES = {
    'skin': ['#F7D9C4', '#F0C3A0', '#E6B08A', '#D49A6E', '#B97D58', '#9A6446', '#7A4A34', '#5A3628'],
    'hair': ['#1E1A22', '#3B2A22', '#6A3A24', '#8C4A2A', '#C46A3A', '#E2B84A', '#F2E2B0', '#B9BFC4', '#D97AA8', '#5A7BD0', '#4FA58A', '#9A5BD0'],
    'eyes': ['#5A3A24', '#4A7BBB', '#3F8A63', '#7A5AAE', '#8A8A94', '#C88A2A'],
    'cloth': ['#F2EEE4', '#1E1A22', '#2E3A6A', '#3E8FB0', '#3F8A63', '#C8323C', '#D9A441', '#E07AA4', '#8B4F9E', '#7C7058', '#C2A574', '#E0703A'],
}


def pack(pieces):
    """shelf-pack piece crops into one sheet; returns (sheet rgba, sheet mask, rects)"""
    crops = []
    for i, pc in enumerate(pieces):
        view, bone, cv, z = pc[:4]; x = pc[4] if len(pc) > 4 else None
        c = cv.crop()
        if c: crops.append((i, view, bone, (z, x), c))
    W = 320; x = y = sh = 1; rects = []
    for i, view, bone, z, (rgba, chm, ox, oy) in sorted(crops, key=lambda t: -t[4][0].shape[0]):
        h, w = rgba.shape[:2]
        if x + w + 1 > W: x = 1; y += sh + 1; sh = 0
        rects.append((i, view, bone, z, (x, y, w, h), ox, oy, rgba, chm)); x += w + 1; sh = max(sh, h)
    H = y + sh + 1
    img = np.zeros((H, W, 4), np.uint8); msk = np.zeros((H, W, 4), np.uint8)
    out = []
    for i, view, bone, z, (rx, ry, w, h), ox, oy, rgba, chm in sorted(rects):
        img[ry:ry + h, rx:rx + w] = rgba; msk[ry:ry + h, rx:rx + w] = chm
        z, xp = z
        p = {'v': view, 'b': bone, 'r': [rx, ry, w, h], 'o': [ox, oy]}
        if z is not None: p['z'] = round(z, 3)
        if xp: p['x'] = xp
        out.append(p)
    return img, msk, out


def save(img, path, force=False):
    if path.exists() and not (FORCE or force): return False
    path.parent.mkdir(parents=True, exist_ok=True); Image.fromarray(img, 'RGBA').save(path, optimize=True); return True


def main():
    # the body: every bone in every view
    pieces = [(v, n, BODY.draw_body(v, n), None) for v in BODY.VIEWS for n in BODY.bones(v)]
    img, msk, P = pack(pieces)
    wrote = save(img, ART / 'body.png'); save(msk, ART / 'body_m.png')
    BS, HS = BODY.BS, BODY.HS
    J = {}
    for n, p, at, z, c in BODY.SKEL['front']:
        px, py = J[p] if p else (0, 0); J[n] = (px + at[0] * BS, py + at[1] * BS)
    hy, py = J['head'][1], J['pelvis'][1]; top = hy - 17.3 * HS
    crops = {'head': [-12 * HS, hy - 25 * HS, 12 * HS, hy + 3 * HS], 'face': [-8.5 * HS, hy - 15 * HS, 8.5 * HS, hy + 1.5 * HS], 'body': [-13 * BS, py - 22 * BS, 13 * BS, py + 8 * BS],
             'legs': [-9 * BS, py - 1 * BS, 9 * BS, 2], 'feet': [-8 * BS, -6 * BS, 8 * BS, 2], 'bust': [-16 * HS, hy - 26 * HS, 16 * HS, hy + 13 * HS], 'all': [-15 * BS, top - 10, 15 * BS, 2]}
    W = {'version': 2, 'figure': round(-top, 1), 'ppm': round(-top / 1.75, 1), 'legs': {'hip': 2 * BS, 'thigh': 14.5 * BS, 'shin': 13 * BS, 'sole': 2.6 * BS},
         'crops': {k: [round(v, 1) for v in c] for k, c in crops.items()},
         'skeleton': {v: [{'n': n, 'par': p, 'at': [round(at[0] * BS, 2), round(at[1] * BS, 2)], 'z': z} for n, p, at, z, c in BODY.SKEL[v]] for v in BODY.VIEWS},
         'body': {'img': 'trainer/body.png', 'mask': 'trainer/body_m.png', 'colors': [['Skin', BODY.SKIN]], 'pieces': P},
         'slots': [{'id': a, 'name': b, 'tab': c, 'layer': d, 'empty': e} for a, b, c, d, e in SLOTS],
         'sliders': [{'k': a, 'name': b, 'min': c, 'max': d, 'def': e} for a, b, c, d, e in SLIDERS],
         'palettes': PALETTES, 'items': {}}
    for it in ITEMS:
        img, msk, P = pack(it.pieces)
        mine = bool(ONLY) and it.id in ONLY
        save(img, ART / 'items' / f'{it.id}.png', mine); save(msk, ART / 'items' / f'{it.id}_m.png', mine)
        d = {'name': it.name, 'slot': it.slot, 'img': f'trainer/items/{it.id}.png', 'mask': f'trainer/items/{it.id}_m.png', 'colors': [list(c) for c in it.colors], 'pieces': P}
        if it.link: d['link'] = it.link
        if it.price: d['price'] = it.price
        if it.shop: d['shop'] = it.shop
        if it.starter: d['starter'] = True
        if it.tags: d['tags'] = it.tags
        W['items'][it.id] = d
    s = gamedata.js_text(); i = s.index('window.GAMEDATA='); head = s[:i]; D = json.loads(s[i + len('window.GAMEDATA='):].rstrip().rstrip(';'))
    if 'wardrobe' in D and not FORCE:
        old = D['wardrobe']; added = [k for k in W['items'] if k not in old.get('items', {})]
        for k in added + [k for k in (ONLY or []) if k in W['items']]: old['items'][k] = W['items'][k]
        print(f'wardrobe exists; added {len(added)} new items'); W = old
    D['wardrobe'] = W
    gamedata.save_js(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n')
    print(f'{len(ITEMS)} items, body {"written" if wrote else "kept"}')


if __name__ == '__main__':
    main()
