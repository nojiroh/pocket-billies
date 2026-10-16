#!/usr/bin/env python3
"""alpha 0.5: the Graphics gallery, a small walkable place built to show each graphics setting (Settings → Graphics →
Expert → See it). A gravel loop round a meadow with a station for each group of dials: a grove of trees (shadows,
trees shading themselves, god rays, light shafts), a lamp-lit cottage (lamps, glow), a pond (water reflections), a
patch of long grass and flowers (grass), the open sky over a field (clouds, cloud shadows, mist, particles) and a long
view to far hills (depth of field, far trees). Each station has a signpost that names what it shows.

Writes scenes.gallery into game/data/gamedata.js (replacing an earlier gallery; nothing else is touched).
The stations' spots are also written to scenes.gallery.stations, which js/gallery.js reads."""
import json, random
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'game' / 'data' / 'gamedata.js'
W, H = 52, 40
rnd = random.Random(505)

def load():
    s = DATA.read_text(encoding='utf-8'); i = s.index('window.GAMEDATA=') + len('window.GAMEDATA=')
    return s[:i], json.loads(s[i:].rstrip().rstrip(';'))

def main():
    head, D = load()
    g = [['G'] * W for _ in range(H)]
    def fill(x0, z0, x1, z1, ch):
        for z in range(max(0, z0), min(H, z1)):
            for x in range(max(0, x0), min(W, x1)): g[z][x] = ch
    # a gravel loop (rows run from the far side, z = H-1, to the near side, z = 0, as in every scene: row i is z = H-1-i)
    def at(x, z, ch):
        if 0 <= x < W and 0 <= z < H: g[H - 1 - z][x] = ch
    for x in range(6, 46):
        for dz in (0, 1): at(x, 8 + dz, 'v'); at(x, 30 + dz, 'v')
    for z in range(8, 32):
        for dx in (0, 1): at(6 + dx, z, 'v'); at(44 + dx, z, 'v')
    for z in range(0, 8):
        for dx in (0, 1): at(25 + dx, z, 'v')
    # a pond, long grass, flowers, a lawn by the cottage
    for z in range(13, 20):
        for x in range(30, 40):
            if ((x - 35) / 5.2) ** 2 + ((z - 16.5) / 3.6) ** 2 < 1: at(x, z, 'w')
    for z in range(21, 28):
        for x in range(30, 41): at(x, z, 't' if (x + z) % 3 else 'E')
    for z in range(11, 18):
        for x in range(10, 20): at(x, z, 'l')
    tiles = [''.join(r) for r in g]
    P = []
    def prop(k, x, z, s=1.0, **o):
        d = {'k': k, 'x': round(x, 2), 'z': round(z, 2)}
        if s != 1: d['s'] = round(s, 2)
        d.update(o); P.append(d)
    # the grove: oaks, birches and pines close together, so their shade and the beams between them show
    for i in range(14):
        prop(rnd.choice(['tree_oak', 'tree_birch', 'tree_pine', 'tree_oak']), 11 + rnd.random() * 11, 21 + rnd.random() * 7, .9 + rnd.random() * .3, **({'f': 1} if rnd.random() < .5 else {}))
    # the cottage with its lamps
    prop('house_cottage', 15, 12.5)
    for x, z in ((11, 10.5), (19.5, 10.5)): prop('streetlamp', x, z)
    prop('lantern', 13, 10.2); prop('bench_wood', 17, 10.3)
    # by the pond
    prop('lily_flowers', 33, 15.5); prop('lily_flowers', 37, 17)
    for x, z in ((29, 13), (41, 14), (40, 19)): prop('bush_flower', x, z)
    # the meadow: flowers and long grass
    for i in range(10): prop(rnd.choice(['flowers_mixed', 'flowers_meadow', 'sunflowers', 'cornflowers']), 31 + rnd.random() * 9, 22 + rnd.random() * 5)
    # far trees along the back edge, for depth of field and far things
    for i in range(16): prop(rnd.choice(['tree_pine', 'tree_birch']), 2 + i * 3.1 + rnd.random(), 36 + rnd.random() * 2.5, 1.1)
    # stations: a signpost each, with what it shows
    stations = {
        'grove': (22.5, 20.5, 'The grove: shadows, trees that shade themselves, god rays and light shafts'),
        'cottage': (21.5, 11, 'The cottage: lamps and their glow (come back at night)'),
        'pond': (29, 17, 'The pond: water reflections'),
        'meadow': (29, 25, 'The meadow: grass, flowers, particles in the air'),
        'sky': (8.5, 28.5, 'The open field: clouds, cloud shadows and low mist'),
        'view': (25.5, 31.5, 'The long view: depth of field and far trees and hills'),
    }
    for k, (x, z, say) in stations.items(): prop('signpost', x, z, act='sign', label=say.split(':')[0], say=say)
    sc = {'name': 'Graphics gallery', 'kind': 'test', 'test': True, 'w': W, 'h': H, 'edge': 'G', 'far': 'hills', 'farH': 1, 'folk': 0,
          'hub': [26, 4], 'exits': [], 'tiles': tiles, 'props': P,
          'stations': {k: [v[0], v[1] - 2.2] for k, v in stations.items()},
          'blurb': 'A small place built to show each graphics setting. Walk to a signpost and switch the dial it names.'}
    D['scenes']['gallery'] = sc
    DATA.write_text(head + json.dumps(D, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
    print(f'gallery: {W}x{H}, {len(P)} props, {len(stations)} stations')

if __name__ == '__main__':
    main()
