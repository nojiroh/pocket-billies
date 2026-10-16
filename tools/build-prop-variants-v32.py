"""v32: new prop variants, made from the existing prop pictures.

Each variant is a NEW file in game/art/scene/props/ (an existing file is never written over, so a picture you have
painted stays as it is) and a NEW entry in GD.scenery.props (existing entries are never changed). Run it again and it
only adds what is missing. Variants:
  barrels         two barrels and one behind               mushroom_ring  a little ring of mixed mushrooms
  haybale_stack   bales stacked two high                   flowers_meadow red, yellow and white flowers together
  stump_mossy     a stump with moss on its top and foot     rocks_c        mossy rocks with pebbles
  log_mossy       a fallen log grown over with moss         crate_stack    crates side by side, one on top
  cactus_pair     a tall and a round cactus                 firewood_b     a log pile with an axe-split stump beside it
Usage: python3 tools/build-prop-variants-v32.py
"""
import json, random, colorsys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PROPS = ROOT / 'game' / 'art' / 'scene' / 'props'
DATA = ROOT / 'game' / 'data' / 'gamedata.js'


def im(k):
    return Image.open(PROPS / (k + '.png')).convert('RGBA')


def compose(parts, pad=1):
    """parts: [(image, x, y)] placed with their bottom-centre at (x, y) on a shared ground line; later parts in front"""
    boxes = []
    for p, x, y in parts:
        w, h = p.size; boxes.append((x - w // 2, y - h + 1, x - w // 2 + w, y + 1))
    x0 = min(b[0] for b in boxes) - pad; y0 = min(b[1] for b in boxes) - pad
    x1 = max(b[2] for b in boxes) + pad; y1 = max(b[3] for b in boxes)
    out = Image.new('RGBA', (x1 - x0, y1 - y0), (0, 0, 0, 0))
    for (p, x, y), b in zip(parts, boxes):
        out.alpha_composite(p, (b[0] - x0, b[1] - y0))
    return out, -(0 - x0)  # second value unused


def moss(img, top=.4, foot=.12, amt=.75, seed=1):
    """moss over the upper part of a shape (and a little round its foot): the art's own light and dark kept, only the
    colour turned mossy; the dark outline is left alone"""
    rng = random.Random(seed); img = img.copy(); w, h = img.size; px = img.load()
    bb = img.getbbox(); ys0, ys1 = bb[1], bb[3]
    # topmost opaque row per column, so moss sits on the surface whatever its slope
    topr = {}
    for x in range(w):
        for y in range(h):
            if px[x, y][3] > 127: topr[x] = y; break
    noise = [[rng.random() for _ in range(w)] for _ in range(h)]
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 128 or x not in topr: continue
            l = (r * .3 + g * .59 + b * .11) / 255
            if l < .16: continue  # outline
            dtop = (y - topr[x]) / max(1, ys1 - ys0)
            hf = (ys1 - y) / max(1, ys1 - ys0)
            p = (1 - dtop / top) if dtop < top else 0
            p = max(p, (1 - hf / foot) * .7 if hf < foot else 0)
            n = (noise[y][x] + noise[y][max(0, x - 1)] + noise[max(0, y - 1)][x]) / 3
            if p * amt > n * .9 + .1:
                mr, mg, mb = .33, .47, .17
                k = .55 + .9 * l
                px[x, y] = (int(min(255, mr * k * 255)), int(min(255, mg * k * 255)), int(min(255, mb * k * 255)), a)
    return img


def flip(img):
    return img.transpose(Image.FLIP_LEFT_RIGHT)


def build():
    V = {}
    b = im('barrel_wood')
    V['barrels'] = (compose([(b, 22, 37), (b, 8, 41), (flip(b), 36, 42)]), dict(name='Barrels', tags=['town', 'farm', 'junk'], group='barrels', solid=.7, shadow=.7, vol=['puff', .55]))
    hb = im('haybale')
    V['haybale_stack'] = (compose([(hb, 45, 18), (hb, 24, 40), (flip(hb), 64, 41)]), dict(name='Stacked hay bales', tags=['farm', 'route'], group='haybale_stack', solid=1, shadow=1.2, vol=['puff', 1]))
    V['stump_mossy'] = ((moss(im('stump'), .45, .15, .9, 7), 0), dict(name='Mossy stump', tags=['route'], group='stump', solid=.45, shadow=.45))
    V['log_mossy'] = ((moss(im('log'), .5, .1, .85, 11), 0), dict(name='Mossy log', tags=['route'], group='log', solid=0, shadow=.6))
    m1, m2, m3 = im('mushroom'), im('mushroom_brown'), im('mushroom_blue')
    V['mushroom_ring'] = (compose([(m2, 18, 14), (flip(m1), 48, 12), (m3, 70, 18), (flip(m2), 54, 30), (m1, 22, 31)]), dict(name='Mushroom ring', tags=['route', 'cave'], group='mushroom_ring', solid=0, shadow=.3, vol=['puff', .3]))
    fr, fy, fw = im('flowers_red'), im('flowers_yellow'), im('flowers_white')
    V['flowers_meadow'] = (compose([(fw, 40, 14), (fy, 18, 20), (fr, 62, 22), (flip(fy), 46, 27)]), dict(name='Meadow flowers', tags=['route', 'town'], group='flowers', solid=0, shadow=0, sway=.6))
    V['rocks_c'] = (compose([(im('pebbles'), 46, 22), (im('rocks_mossy'), 30, 18), (flip(im('pebbles')), 14, 24)]), dict(name='Rocks and pebbles', tags=['route', 'mountains'], group='rocks', solid=0, shadow=.4))
    cr, cg = im('crate'), im('crate_goods')
    V['crate_stack'] = (compose([(cr, 18, 70), (flip(cg), 52, 68), (cr, 35, 70 - 33)]), dict(name='Crate stack', tags=['town', 'farm', 'junk'], group='crate_stack', solid=.9, shadow=.8, vol=['block', .9]))
    V['cactus_pair'] = (compose([(im('cactus_tall'), 30, 100), (im('cactus_round'), 62, 104)]), dict(name='Cactus pair', tags=['desert', 'canyon'], group='cactus_pair', solid=.5, shadow=.6, vol=['puff', .5]))
    V['firewood_b'] = (compose([(im('firewood'), 40, 36), (moss(im('stump'), .08, .05, .3, 3), 86, 38)]), dict(name='Woodpile and chopping stump', tags=['farm', 'route', 'town'], group='firewood', solid=.6, shadow=.6))
    return V


def main():
    src = DATA.read_text(encoding='utf-8'); head = src[:src.index('window.GAMEDATA=')]
    D = json.JSONDecoder().raw_decode(src[src.index('window.GAMEDATA=') + len('window.GAMEDATA='):])[0]
    cat = D['scenery']['props']; made, added = [], []
    for key, ((img, _), meta) in build().items():
        path = PROPS / (key + '.png')
        if not path.exists():
            img.save(path, optimize=True); made.append(key)
        disk = Image.open(path)
        if key in cat: continue
        w, h = disk.size
        e = dict(name=meta['name'], img='scene/props/%s.png' % key, ox=-(w // 2), oy=-(h - 1), shadow=meta.get('shadow', .5), sway=meta.get('sway', 0),
                 flat=0, tags=meta['tags'], group=meta['group'], solid=meta.get('solid', 0))
        if meta.get('vol'): e['vol'] = meta['vol']
        cat[key] = e; added.append(key)
    if added:
        pj = ROOT / 'game' / 'art' / 'scene' / 'props.json'; P = json.loads(pj.read_text())
        for k in added:
            if k in P: continue
            e = cat[k]; w, h = Image.open(PROPS / (k + '.png')).size
            P[k] = dict(name=e['name'], w=w, h=h, ox=e['ox'], oy=e['oy'], shadow=e['shadow'], sway=e['sway'], flat=0, tags=e['tags'], group=e['group'], solid=e['solid'])
        pj.write_text('{\n' + ',\n'.join('  ' + json.dumps(k) + ': ' + json.dumps(v, separators=(', ', ': ')) for k, v in P.items()) + '\n}\n')
        DATA.write_text(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
    print('pictures written:', made or 'none (all there already)'); print('catalog entries added:', added or 'none')


if __name__ == '__main__':
    main()
