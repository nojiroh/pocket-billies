#!/usr/bin/env python3
"""Buildings track BD-1: the showcase of the low-poly models' new recipe shapes (game/js/prop-models.js
lowPolyFromRecipe): parts turned and leaned (rot, tilt), prisms (a profile drawn out: gambrel, saltbox, arch, a
Googie swoop, steps), lathes (a profile turned round: onion and bulb domes, a flared chimney, a finned rocket, a
mushroom cap, a tank), boxes tapered, leaned and bevelled, glowing layers (at night, and by day), and the recipe's
warp on two small storybook houses made only of these. One catalogue kind, shape_showcase, its variants each one of
these models (walk-view.js plainPropVariant swaps the model). In the game's debug menu under Test scenes, or
game/index.html?test=1&scene=test_shapes

    python3 tools/build-shape-showcase.py      # rerunnable: writes the recipes, the catalogue kind and the map
"""
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gamedata  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MODELS = 'scene/next/models'
ID = 'test_shapes'
KIND = 'shape_showcase'

CREAM, COPPER, TEAL, TERRA, BRASS, WOOD, NAVY, RED = (
    '#F2E2BE', '#C9773E', '#4FA294', '#C8603E', '#D8B048', '#A06A44', '#3E5288', '#D4483E')


def box(x, y, z, w, d, h, col, tex='plain', **k):
    return {'k': 'box', 'x': x, 'y': y, 'z': z, 'w': w, 'd': d, 'h': h, 'col': col, 'tex': tex, **k}


def prism(x, y, z, pts, d, col, tex='plain', **k):
    return {'k': 'prism', 'x': x, 'y': y, 'z': z, 'pts': [[round(a, 3), round(b, 3)] for a, b in pts], 'd': d,
            'col': col, 'tex': tex, **k}


def lathe(x, y, z, pts, col, tex='plain', **k):
    return {'k': 'lathe', 'x': x, 'y': y, 'z': z, 'pts': [[round(a, 3), round(b, 3)] for a, b in pts], 'col': col,
            'tex': tex, **k}


def arc(cx, cz, r, a0, a1, n):
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cz + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


def turns():
    """rot and tilt: a box turned, a crooked chimney, a post leaned right, a cylinder laid on its side"""
    return [
        box(-1.6, 1, 1.0, 1.0, 1.0, 0.25, COPPER, 'metal', rot=math.radians(30), name='cap turned'),
        box(-1.6, 1, 0, 1.2, 1.2, 1.0, CREAM, 'plaster', rot=math.radians(30), name='turned body'),
        box(0, 1, 0, 0.5, 0.5, 2.2, TERRA, 'brick', tilt=[math.radians(-6), math.radians(8)], name='crooked chimney'),
        box(0.9, 1, 0, 0.18, 0.18, 2.0, WOOD, 'wood', tilt=[0, math.radians(12)], name='leaning post'),
        {'k': 'cyl', 'x': 1.8, 'y': 1, 'z': 0.35, 'r': 0.35, 'h': 1.4, 'col': BRASS, 'tex': 'metal',
         'tilt': [0, math.radians(-90)], 'sides': 12, 'name': 'barrel laid down'},
    ]


def prisms():
    """the roof profiles drawn out deep, each on a plain block"""
    L = []
    gambrel = [(-1.0, 0), (1.0, 0), (0.85, 0.55), (0.4, 1.0), (-0.4, 1.0), (-0.85, 0.55)]
    saltbox = [(-1.0, 0), (1.0, 0), (1.0, 0.35), (-0.2, 1.2), (-1.0, 0.75)]
    for i, (prof, col, tex, name) in enumerate([(gambrel, COPPER, 'metal', 'gambrel'), (saltbox, TEAL, 'shingles', 'saltbox')]):
        x = -3.2 + i * 2.6
        L.append(box(x, 1.0, 0, 1.8, 1.8, 1.2, CREAM, 'plaster', name=name + ' walls'))
        L.append(prism(x, 1.0, 1.2, prof, 2.1, col, tex, name=name + ' roof'))
    # an arch gate (a concave profile)
    gate = [(-0.8, 0), (-0.45, 0), (-0.45, 0.9)] + arc(0, 0.9, 0.45, math.pi, 0, 8)[1:-1] + [(0.45, 0.9), (0.45, 0), (0.8, 0),
                                                                                              (0.8, 1.7), (-0.8, 1.7)]
    L.append(prism(2.0, 1.0, 0, gate, 0.4, TERRA, 'brick', name='arch gate'))
    # a Googie swoop canopy on two posts, its ends lifted along its length (bend), turned across
    L.append(box(3.8, 0.4, 0, 0.12, 0.12, 1.6, BRASS, 'metal', name='post'))
    L.append(box(3.8, 1.6, 0, 0.12, 0.12, 1.6, BRASS, 'metal', name='post'))
    L.append(prism(3.8, 1.0, 1.6, [(-0.5, 0), (0.5, 0), (0.5, 0.12), (-0.5, 0.12)], 2.6, RED, 'metal', bend=0.5, segs=8,
                   name='swoop canopy'))
    # steps up to a door, as one profile
    steps = [(-0.6, 0), (0.6, 0), (0.6, 0.6), (0.2, 0.6), (0.2, 0.4), (-0.2, 0.4), (-0.2, 0.2), (-0.6, 0.2)]
    L.append(prism(5.4, 1.0, 0, steps, 1.0, '#B8B0A8', 'stone', rot=math.pi / 2, name='steps'))
    return L


def lathes():
    """turned profiles: onion dome, bulb, flared chimney, finned rocket, mushroom, tank"""
    onion = [(0.55, 0), (0.62, 0.25), (0.6, 0.5), (0.4, 0.85), (0.15, 1.15), (0.04, 1.4), (0, 1.5)]
    bulb = [(0.25, 0), (0.5, 0.3), (0.55, 0.6), (0.4, 0.95), (0.1, 1.1), (0, 1.12)]
    flare = [(0.22, 0), (0.22, 1.6), (0.36, 1.85), (0.36, 1.95), (0.18, 1.95)]
    rocket = [(0.32, 0), (0.42, 0.6), (0.42, 1.6), (0.3, 2.2), (0.08, 2.6), (0, 2.7)]
    mush = [(0.12, 0), (0.12, 0.5), (0.7, 0.45), (0.72, 0.6), (0.5, 0.85), (0.15, 0.98), (0, 1.0)]
    tank = [(0.45, 0), (0.45, 1.3), (0.4, 1.45), (0.25, 1.55), (0, 1.58)]
    L = [
        box(-4.0, 1, 0, 1.4, 1.4, 0.8, CREAM, 'plaster', name='onion base'),
        lathe(-4.0, 1, 0.8, onion, TEAL, 'metal', sides=12, name='onion dome', smooth=1),
        lathe(-2.3, 1, 0, bulb, COPPER, 'metal', sides=10, ry=0.75, name='oval bulb', smooth=1),
        lathe(-0.9, 1, 0, flare, TERRA, 'brick', sides=8, name='flared chimney'),
        lathe(0.6, 1, 0, rocket, '#E8E4DA', 'metal', sides=12, name='rocket', smooth=1),
        lathe(2.1, 1, 0, mush, RED, 'plain', sides=14, name='mushroom'),
        lathe(3.7, 1, 0, tank, BRASS, 'metal', sides=12, ry=1.0, name='tank'),
    ]
    for a in (0, 120, 240):  # the rocket's fins: one profile, turned three ways
        L.append(prism(0.6, 1, 0, [(0.3, 0), (0.75, 0), (0.42, 0.9)], 0.06, RED, 'metal', rot=math.radians(a + 90),
                       name='fin'))
    return L


def boxes():
    """box taper, lean and bevel"""
    return [
        box(-3.0, 1, 0, 1.6, 1.6, 2.2, CREAM, 'plaster', taper=[1.0, 1.0], name='tapered tower'),
        box(-1.0, 1, 0, 1.2, 1.2, 2.2, TERRA, 'brick', lean=[0.35, 0.0], name='leaning stack'),
        box(1.0, 1, 0, 1.6, 1.6, 1.4, TEAL, 'panels', bevel=0.2, name='bevelled block'),
        box(3.0, 1, 0, 1.6, 1.2, 1.8, COPPER, 'metal', taper=[1.1, 0.8], lean=[0.0, 0.25], bevel=0.12,
            name='all three'),
    ]


def glows():
    """glowing layers: a neon tube under eaves (at night), a sign ring (by day too), lamp globes"""
    ring = [(0.5, 0), (0.6, 0), (0.6, 0.08), (0.5, 0.08)]
    return [
        box(-1.2, 1.2, 0, 2.4, 2.0, 2.0, CREAM, 'plaster', name='walls'),
        prism(-1.2, 1.2, 2.0, [(-1.4, 0), (1.4, 0), (0, 0.9)], 2.4, NAVY, 'shingles', name='roof'),
        box(-1.2, 0.12, 1.92, 2.6, 0.08, 0.06, '#FFFFFF', glow='#FF5AB4', name='neon tube'),
        box(-1.6, 0.18, 0.8, 0.5, 0.04, 0.6, '#9FC4D8', glass=1, name='window'),
        box(-0.6, 0.18, 0.8, 0.5, 0.04, 0.6, '#9FC4D8', glass=2, name='window'),
        lathe(1.8, 1.0, 1.0, ring, '#E8E4DA', tilt=[math.radians(90), 0], sides=16, glow={'col': '#5AE0FF', 'day': 1},
              name='sign ring (by day too)'),
        box(1.8, 1.0, 0, 0.12, 0.12, 1.0, BRASS, 'metal', name='sign post'),
        {'k': 'sphere', 'x': 3.2, 'y': 1.0, 'z': 1.3, 'r': 0.18, 'col': '#FFE9B0', 'glow': '#FFC860', 'name': 'lamp globe'},
        box(3.2, 1.0, 0, 0.08, 0.08, 1.3, '#333344', 'metal', name='lamp post'),
    ]


def house(seed):
    """a storybook house made only of the new shapes, with the recipe's warp"""
    roof = [(-1.4, 0), (1.4, 0), (1.15, 0.6), (0.5, 1.15), (-0.5, 1.15), (-1.15, 0.6)]
    door = [(-0.38, 0), (0.38, 0), (0.38, 0.75)] + arc(0, 0.75, 0.38, 0, math.pi, 6)[1:-1] + [(-0.38, 0.75)]
    L = [
        box(0, 1.2, 0, 2.4, 2.2, 0.15, '#B8B0A8', 'stone', bevel=0.05, name='plinth'),
        box(0, 1.2, 0.15, 2.2, 2.0, 2.0, CREAM if seed == 0 else '#F4F1EA', 'plaster', bevel=0.06, name='walls', roof=0),
        box(0, 1.2, 2.15, 2.5, 2.3, 0.18, WOOD, 'wood', bevel=0.05, name='jetty floor'),
        prism(0, 1.2, 2.33, roof, 2.5, COPPER if seed == 0 else RED, 'metal' if seed == 0 else 'rooftiles', name='gambrel roof',
              roof=1),
        prism(0, 0.17, 0.15, door, 0.06, NAVY, 'wood', name='round-top door'),
        lathe(0.75, 0.16, 1.25, [(0.0, 0), (0.24, 0)], BRASS, 'metal', tilt=[math.radians(-90), 0], sides=12,
              name='porthole rim'),
        lathe(0.75, 0.14, 1.25, [(0.0, 0), (0.19, 0)], '#9FC4D8', tilt=[math.radians(-90), 0], sides=12, glass=1,
              name='porthole'),
        box(-0.7, 0.16, 1.1, 0.5, 0.04, 0.55, '#9FC4D8', glass=2, name='window'),
        lathe(0.7, 1.8, 2.6, [(0.2, 0), (0.2, 1.1), (0.32, 1.3), (0.32, 1.38), (0.16, 1.38)], TERRA, 'brick', sides=8,
              tilt=[0, math.radians(7)], name='crooked chimney'),
        lathe(-0.6, 1.2, 3.42, [(0.12, 0), (0.18, 0.12), (0.1, 0.3), (0.02, 0.45), (0, 0.5)], BRASS, 'metal', sides=8,
              smooth=1, name='onion finial'),
        box(0, 0.06, 2.06, 2.3, 0.06, 0.05, '#FFFFFF', glow='#FF5AB4' if seed == 0 else '#5AE0FF', name='neon under the eaves'),
    ]
    warp = {'lean': [0.18, 0.05], 'sag': 0.12, 'bulge': 0.05} if seed == 0 else {'lean': [-0.12, 0], 'twist': 0.12,
                                                                                  'bulge': 0.07, 'sag': 0.08}
    return L, warp


def recipes():
    out = {
        'shape_turns': {'about': 'BD-1: rot and tilt', 'layers': turns()},
        'shape_prisms': {'about': 'BD-1: prisms', 'layers': prisms()},
        'shape_lathes': {'about': 'BD-1: lathes', 'layers': lathes()},
        'shape_boxes': {'about': 'BD-1: box taper, lean, bevel', 'layers': boxes()},
        'shape_glow': {'about': 'BD-1: glowing layers', 'layers': glows()},
    }
    for i in (0, 1):
        L, W = house(i)
        out[f'shape_house_{i + 1}'] = {'about': 'BD-1: a storybook house with the warp', 'warp': W, 'layers': L}
    for r in out.values():
        r['ppm'] = 32
        r['cel'] = 0.6
    return out


def catalogue(names):
    first = names[0]
    return {
        'name': 'Shape showcase (BD-1)',
        'img': 'scene/props/well.png',
        'ox': -40,
        'oy': -99,
        'shadow': 1.2,
        'sway': 0,
        'flat': 0,
        'tags': [],
        'group': 'test',
        'solid': 1,
        'model': f'{MODELS}/{first}.json',
        'ppm': 32,
        'box': [6.0, 2.4],
        'vary': {'rot': 0, 'lean': 0, 'size': 0},
        'variants': [{'model': f'{MODELS}/{n}.json', 'name': n} for n in names[1:]],
    }


def test_map(names):
    step = 13.0
    W = int(step * len(names) + 10)
    H = 24
    tiles = ['g' * W for _ in range(H)]
    z = 10.0
    tiles[H - 1 - int(z - 3)] = 'p' * W
    props, shots = [], []
    for i, n in enumerate(names):
        p = {'k': KIND, 'x': round(8 + i * step, 2), 'z': z}
        if i:
            p['v'] = i
        props.append(p)
        shots.append({'x': p['x'], 'z': z - 7, 'yaw': 0, 'label': n})
    return {
        'name': 'Test: the new model shapes (buildings track BD-1)',
        'w': W, 'h': H, 'edge': 'g',
        'sky': ['#8CC6E6', '#BFE3EE', '#F4E8C8'], 'haze': '#EAD9C0', 'hazeD': 40,
        'cam': {'pitch': 30, 'h': 12, 'fov': 1}, 'blur': 0, 'amb': None, 'plain': 1, 'tint': None, 'indoor': 0,
        'far': 'hills', 'farH': 8, 'folk': 0, 'test': 1, 'exits': [], 'checks': [], 'shots': shots,
        'hub': [8, 4], 'kind': 'test', 'tiles': tiles, 'props': props,
    }


def main():
    R = recipes()
    names = list(R)
    for n, r in R.items():
        (ROOT / 'game/art' / MODELS / f'{n}.json').write_text(json.dumps(r, indent=1) + '\n')
    D = gamedata.load()
    D['scenery']['props'][KIND] = catalogue(names)
    D['maps'][ID] = test_map(names)
    gamedata.save(D)
    print(f'wrote {len(R)} recipes, the {KIND} kind and game/data/maps/{ID}.json')


if __name__ == '__main__':
    main()
