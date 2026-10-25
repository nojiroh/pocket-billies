#!/usr/bin/env python3
"""Builds the test scenes: small places that each put one tricky situation in front of the renderer and the walking
code, so a change can be checked on purpose instead of hoping a route scene happens to show it. They are stored in
game/data/gamedata.js with the other scenes (ids starting with "test_", marked "test": 1) and never appear on the
route. Open them in the game from the debug menu (Test scenes) or in the Studio (Walk scenes, at the bottom).

    python3 tools/build-test-scenes.py          # (re)builds every test scene; route scenes are not touched
    python3 tools/build-test-scenes.py --only=test_graphics   # (re)builds only these test scenes

Each test scene can carry
  "checks": [{"from": [x, z], "to": [x, z], "reach": true|false, "what": "..."}]   walking expectations, run by the
            game's full test, tools/check-quick.py --tests and the Studio's check
  "shots":  [{"x": .., "z": .., "yaw": .., "label": ".."}]                            where to stand for pictures
"""
import gamedata  # phase 04b: the data files in game/data
import importlib.util, json, math, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('bscenes', ROOT / 'tools' / 'build-scenes.py')
B = importlib.util.module_from_spec(spec); spec.loader.exec_module(B)
Scene, DATA = B.Scene, B.DATA


def base(sid, name, W=32, H=24, ground='g', seed=900, **kw):
    s = Scene(sid, name, ground, seed, W, H, far=kw.pop('far', 'hills'), **kw)
    s.d['test'] = 1; s.d['kind'] = 'test'; s.d['exits'] = []; s.d['checks'] = []; s.d['shots'] = []
    return s


def hub(s, x, z):
    s.d['hub'] = [x, z]; s.clear.append((x, z, 1.2))


def check(s, a, b, reach, what):
    s.d['checks'].append({'from': [round(a[0], 2), round(a[1], 2)], 'to': [round(b[0], 2), round(b[1], 2)], 'reach': reach, 'what': what})


def shot(s, x, z, label, yaw=0):
    s.d['shots'].append({'x': x, 'z': z, 'yaw': yaw, 'label': label})


# ---------------------------------------------------------------- stairs of every kind
def t_stairs():
    s = base('test_stairs', 'Test: stairs', 40, 26, 'g', 901)
    hub(s, 20, 4)
    cols = [(1, 8, .7), (9, 16, 1.3), (17, 24, 2.0), (25, 32, 3.0), (33, 39.5, 4.4)]
    for x0, x1, h in cols:
        s.terrace(x0, 13, x1, 30, h, wall=True, wobble=0, mat=5)
        cx = (x0 + x1) / 2
        s.road((cx, 5), (cx, 21), 'p', 1.6 if h > 2 else 1.0, amp=0)
        check(s, (20, 4), (cx, 21), True, f'up a {h} m terrace by its stairs')
        shot(s, cx, 9, f'stairs-{h}m')
    s.road((20, 4), (6.5, 9), 'p', 1.0, amp=0)
    s.road((4, 7), (12, 18), 'p', 1.0, amp=0)  # a path meeting the cliff at an angle
    check(s, (20, 4), (10.5, 15.5), True, 'stairs reached at an angle')
    s.pond(36, 6, 3, 2, ducks=0, reeds=4, lilies=2, dip=.4)
    s.patches('G', .6, 6, seed=3)
    s.rolling(.15, 6)
    def gate():
        for f in s.stairs:
            if 'a' in f and 19 < f['a'][0] < 22: s.arch(f['b'][0], f['b'][1] + .15, 2.6, .8, 3.0, 'z', 'brick')
    s.after_stairs = [gate]
    shot(s, 20.5, 16, 'arch-top', .4)
    return s.out(8, 'iron', 'c')


# ---------------------------------------------------------------- ledges right at the limits
def t_ledges():
    s = base('test_ledges', 'Test: ledges and limits', 36, 24, 'g', 902)
    hub(s, 21, 4)
    for i, h in enumerate((.3, .4, 1.0, 1.75, 1.9)):
        x0 = 1 + i * 7; cx = x0 + 3
        s.ledge(x0, 13, x0 + 6, 25, h, wobble=0)
        check(s, (cx, 10), (cx, 18), h <= .34, f'walk up a {h} m step' + ('' if h <= .34 else ' (should be impossible)'))
        check(s, (cx, 18), (cx, 10), h < 1.8, f'hop down {h} m' + ('' if h < 1.8 else ' (too high, should be impossible)'))
        shot(s, cx, 10.5, f'ledge-{h}m')
    s.patches('G', .55, 5, seed=4)
    # a narrow gap between two cliffs
    s.terrace(6, 1.5, 12, 8, 1.2, wall=False, wobble=0); s.terrace(12.8, 1.5, 18, 8, 1.2, wall=False, wobble=0)
    check(s, (12.4, .8), (12.4, 10.5), True, 'through an 0.8 m gap between cliffs')
    return s.out(7, 'wood')


# ---------------------------------------------------------------- bridges
def t_bridges():
    s = base('test_bridges', 'Test: bridges', 40, 26, 'g', 903)
    hub(s, 20, 4)
    s.cliff(-1, 10, 41, 13, -1.4, mat=9, wobble=0)                       # a ravine all the way across
    s.stream([(-.5, 11.4), (40.5, 11.6)], 1.0, .5, banks='u')
    s.terrace(26, 13, 41, 27, 1.0, wall=False, wobble=0)                 # one bank higher than the other
    for x, kind in ((5, 'wood'), (13, 'stone'), (21, 'rope'), (31, 'wood')):
        s.road((x, 5), (x, 20), 'p', 1.0, amp=0)
        check(s, (x, 7), (x, 16), True, f'across the {kind} bridge at x {x}')
        shot(s, x, 7.5, f'bridge-{kind}-{x}')
    s.road((20, 4), (5, 5), 'p', 1.0, amp=0); s.road((20, 4), (31, 5), 'p', 1.0, amp=0)
    s.road((36, 5), (34, 9), 'p', 1.0, amp=0); s.road((34, 9), (37, 18), 'p', 1.0, amp=0)  # a bend onto a bridge
    s.road((20, 4), (36, 5), 'p', 1.0, amp=0)
    check(s, (36, 6), (37, 17), True, 'onto a bridge from a bend')
    s.patches('G', .6, 6, seed=5)
    def kinds():
        order = {5: 'wood', 13: 'stone', 21: 'rope', 31: 'wood'}
        for b in s.d.get('bridges', []):
            x = round((b['a'][0] + b['b'][0]) / 2)
            for k, v in order.items():
                if abs(x - k) < 1.5: b['kind'] = v
    s.after_stairs = [kinds]
    return s.out(7, 'wood', None, 'wood', 'wood')


# ---------------------------------------------------------------- water of every kind
def t_water():
    s = base('test_water', 'Test: water', 58, 28, 'g', 904, far='forest')
    hub(s, 20, 3)
    s.pond(8, 8, 5, 3, ducks=3, reeds=8, lilies=6, dip=.8)                             # a still pond, deep in the middle
    for z0, h in ((14, .5), (18, 1.0), (23, 1.6)):                                      # terraces for falls of rising height
        s.terrace(-1, z0, 41, 30, h, wall=False, wobble=.3, mat=9)
    s.stream([(30, 27.5), (30.5, 21), (29.8, 16), (30.4, 12), (31, 8.6)], 1.2, .8)    # a stream down every step
    s.pond(31, 6.5, 3.4, 2, sand=False, reeds=4, lilies=0, deep=False, dip=.3)
    s.cliff(17, 8, 25, 13, -.45, mat=3, wobble=.2); s.cliff(17, 8, 25, 10.5, -.45, mat=3, wobble=.2)   # stepped pools
    s.blob(21, 11.6, 3.3, 1.0, 'w', .1); s.blob(21, 9.2, 3.3, 1.0, 'w', .1)
    s.blob(36, 20, 2.5, 1.4, 'w', .15); s.blob(36, 25, 2.2, 1.2, 'd', .15)             # water up on the terraces
    # v22: one of each kind of water, painted with water rectangles (Studio: Ground > Water kinds)
    s.blob(6, 16, 3.0, 1.2, 'w', .2); s.blob(12.5, 20.6, 1.9, 1.3, 'w', .15); s.rect(2, 25, 17, 26, 'w')
    s.d['waters'] = [{'x': 1.5, 'z': 14.2, 'w': 9, 'h': 3.6, 'k': 'swamp'}, {'x': 9.8, 'z': 18.6, 'w': 5.4, 'h': 4, 'k': 'spring'},
                     {'x': 1.5, 'z': 24.5, 'w': 16, 'h': 2.6, 'k': 'canal'}, {'x': 32.5, 'z': 18, 'w': 7.5, 'h': 10, 'k': 'lake'}]
    s.put('rocks', 30.2, 18.6, .6); s.put('rocks', 30.0, 13.4, .55)                     # rocks in the stream throw foam
    # water track WA-0: a tall fall (a stream off a 6 m cliff into a plunge pool) and the kinds the west half lacks
    s.terrace(43, 17, 59, 30, 6.0, wall=False, wobble=.3, mat=3)
    s.stream([(50, 27.5), (50.3, 22), (49.8, 17.5), (50, 14.5)], 1.6, 1.0)
    s.pond(50, 12.4, 3.2, 2.2, sand=False, reeds=5, lilies=0, deep=False, rocks=3, dip=.6)
    s.blob(45.5, 6.5, 2.4, 1.6, 'w', .15); s.blob(50.8, 6.5, 2.0, 1.6, 'w', .15); s.rect(55, 2, 58, 10, 'w')
    s.d['waters'] += [{'x': 42.5, 'z': 4.5, 'w': 6, 'h': 4, 'k': 'lava'}, {'x': 48.6, 'z': 4.5, 'w': 5, 'h': 4, 'k': 'ice'},
                      {'x': 55, 'z': 2, 'w': 3, 'h': 8, 'k': 'sea'}]
    s.life('duck', 3)
    for x, z, l in ((8, 4, 'pond'), (30, 9, 'stream-and-falls'), (21, 6, 'stepped-pools'), (36, 15, 'high-water-lake'),
                    (6, 12, 'swamp'), (12.5, 16.5, 'spring'), (9, 21.5, 'canal'), (50, 8.2, 'tall-fall'),
                    (45.5, 3, 'lava'), (50.8, 3, 'ice'), (53.5, 6, 'sea-strip')):
        shot(s, x, z, l)
    check(s, (20, 3), (50, 8.2), True, 'the hub to the foot of the tall fall')
    check(s, (1.2, 9.4), (5.5, 9.3), True, "wade into the pond's shallows")                # WA-6a: shallows are waded
    check(s, (41, 6.5), (45.5, 6.5), False, 'the lava pool stays shut (should be impossible)')
    s.patches('G', .6, 6, seed=6)
    return s.out(7, 'wood')


# ---------------------------------------------------------------- shadows
def t_shadows():
    s = base('test_shadows', 'Test: shadows', 36, 26, 'c', 905, look={'sun': {'angle': 25, 'height': 28}})
    hub(s, 18, 5)
    for i, k in enumerate(['streetlamp', 'flag_pole', 'traffic_light', 'signpost', 'banner_pole', 'lamp', 'tree_pine', 'tree_oak']):
        s.put(k, 3 + i * 4, 10)
    s.terrace(-1, 17, 37, 27, 2.2, wall=True, wobble=0, mat=4)
    s.road((18, 6), (18, 22), 'c', 2.0, amp=0)
    for i, k in enumerate(['crate', 'bench_wood', 'barrel', 'boulder', 'cactus_tall', 'vending']):
        s.put(k, 5 + i * 5, 14)
    s.put('crate', 30, 6, vol='card'); s.put('crate', 32, 6)                            # the same prop flat and solid
    s.rect(24, 1, 36, 5, 'w')
    for x, z, l, y in ((10, 7, 'casters', 0), (18, 13, 'on-the-stairs', .3), (28, 4, 'on-water', 0), (12, 12, 'solid-vs-flat', .6)):
        shot(s, x, z, l, y)
    return s.out(8, 'iron', 'c')


# ---------------------------------------------------------------- every prop
def t_props():
    src = gamedata.js_text(); D = json.JSONDecoder().raw_decode(src[src.index('window.GAMEDATA=') + len('window.GAMEDATA='):])[0]
    keys = sorted((k for k, M in D['scenery']['props'].items() if not M.get('build') and 'battle' not in M.get('tags', [])), key=lambda k: (D['scenery']['props'][k].get('group', k), k))
    W = 56; rows = []; row = []; x = 1
    for k in keys:
        M = D['scenery']['props'][k]; w = max(1.2, (M.get('box') or [0])[0] or 0, 74 / 34 if M.get('flat') else 0)
        im = B.ROOT / 'game' / 'art' / M['img']
        try:
            from PIL import Image
            w = max(w, Image.open(im).width / 34)
        except Exception: pass
        if x + w > W - 1: rows.append(row); row = []; x = 1
        row.append((k, x + w / 2)); x += w + .8
    rows.append(row)
    H = 6 + len(rows) * 4
    s = base('test_props', 'Test: every prop', W, H, 'c', 906)
    hub(s, W / 2, 2.5)
    for j, row in enumerate(rows):
        z = 6 + j * 4
        for k, xx in row: s.put(k, xx, z, block=False)
        shot(s, W / 2, z - 3, f'row-{j + 1}', .5 if j % 2 else -.5)
    s.d['folk'] = 0
    return s.out(8)


# ---------------------------------------------------------------- slopes
def t_slopes():
    s = base('test_slopes', 'Test: slopes', 40, 28, 'g', 907)
    hub(s, 20, 3)
    for i, g in enumerate((.2, .4, .6, .7, .9)):                                       # strips of rising steepness
        x0 = 1 + i * 8
        s.hadd(lambda x, z, x0=x0, g=g: (max(0, min(z, 24) - 8) * g) if x0 <= x <= x0 + 6 else 0)
        cx = x0 + 3
        check(s, (cx, 6), (cx, 14), g <= .66, f'walk up a {int(g * 100)}% slope' + ('' if g <= .66 else ' (too steep, should be impossible)'))
        shot(s, cx, 5, f'slope-{int(g * 100)}')
    s.patches('G', .6, 6, seed=7); s.scatter(['@rocks', '@flowers', 'fence_wood'], 14, (0, 8, 40, 26), gap=.6)
    return s.out(7, 'wood')


# ---------------------------------------------------------------- v23: ramps, a hill town on three levels, a misty gorge
def t_hilltown():
    s = base('test_hilltown', 'Test: ramps and a hill town', 40, 32, 'g', 914)
    hub(s, 8, 3)
    s.terrace(-1, 10, 41, 33, 1.5, wall=False, wobble=.3, mat=0)                        # level 1: natural rock, a grassy lip
    s.terrace(-1, 18, 41, 33, 1.5, wall=True, wobble=0, mat=5)                          # level 2: a retaining wall
    s.terrace(14, 25, 30, 33, 1.5, wall=True, wobble=0, mat=5)                          # level 3
    s.cliff(14, -1, 19, 10, -3.0, mat=1, wobble=.25)                                    # a gorge across the low ground
    s.cliff(30, 2, 38, 8, .5, mat=5, wobble=0)                                          # a half-metre platform
    s.cliff(33, 12, 38, 16, 1.2, mat=5, wobble=0)                                       # a block on level 1 with a too-steep ramp
    s.slope(4, 6.5, 7, 13, '+z')                                                        # 6.5 m ramp up to level 1 (23%)
    s.slope(20, 15, 23, 21, '+z')                                                       # level 1 to level 2
    s.slope(27, 3, 30, 7, '+x')                                                         # up onto the platform
    s.slope(33, 11, 38, 12, '+z')                                                       # 1.2 m in one metre: too steep
    s.road((26, 22), (26, 29), 'p', 1.4, amp=0)                                          # stairs from level 2 to level 3
    s.bridge((13.4, 5), (19.6, 5), 1.6, 'wood')
    s.put('house_red', 10, 13.5); s.put('house_cottage', 30, 13); s.put('townhouse_blue', 9, 21); s.put('house_blue', 34, 21)
    s.put('shop_cafe', 18, 27.5); s.put('townhouse_yellow', 23, 27.5)
    for x, z in ((3.5, 7), (7.5, 7), (19.5, 16), (23.5, 16), (26.5, 4), (26.5, 7)): s.put('fence_wood', x, z)
    for x, z in ((12, 11), (25, 19), (31, 26)): s.put('streetlamp', x, z)
    s.put('bench_wood', 32, 5); s.put('planter_box', 35, 6.5)
    check(s, (8, 3), (5.5, 15), True, 'up the long ramp onto level 1')
    check(s, (8, 3), (21.5, 23), True, 'up the second ramp onto level 2')
    check(s, (8, 3), (26.5, 30.5), True, 'up the stairs onto level 3')
    check(s, (8, 3), (34, 5), True, 'over the gorge bridge and up the ramp onto the half-metre platform')
    check(s, (35.5, 10.6), (35.5, 14), False, 'a ramp too steep to walk (should be impossible)')
    for x, z, l in ((5.5, 4.5, 'long-ramp'), (16.5, 1.5, 'gorge-mist'), (21.5, 13, 'second-ramp-and-lip'), (30, 3.5, 'half-metre-platform'), (24, 20, 'town-levels')):
        shot(s, x, z, l)
    return s.out(8, 'iron')


# ---------------------------------------------------------------- the camera in tight spots
def t_camera():
    s = base('test_camera', 'Test: camera trouble', 32, 26, 'g', 908)
    hub(s, 16, 10)
    s.terrace(-1, 13, 33, 27, 4.0, wall=True, wobble=0, mat=5)                         # high ground right behind you
    s.road((16, 10), (16, 20), 'p', 1.2, amp=0)
    s.cliff(4, -1, 12, 4, 3.0, mat=5, wobble=0)                                         # a wall between you and the camera
    s.put('house_red', 22, 6); s.put('house_blue', 26.2, 6)                             # a narrow alley
    s.road((16, 10), (24.1, 4), 'p', .8, amp=0)
    check(s, (16, 10), (24.1, 7), True, 'into the alley between two houses')
    for x, z, l in ((8, 5.2, 'behind-a-wall'), (24.1, 7.5, 'alley'), (16, 11, 'cliff-behind'), (22, 9.5, 'behind-a-house')):
        shot(s, x, z, l)
    return s.out(8, 'iron', 'c')


# ---------------------------------------------------------------- night lights
def t_night():
    s = base('test_night', 'Test: lights at night', 32, 24, 'c', 909, tint='#1C1A3A', look={'sun': {'strength': .25, 'height': 20}, 'lights': {'windowsDay': 1}})
    hub(s, 16, 5)
    for i in range(12):
        s.put(['streetlamp', 'lantern_b', 'lamp', 'streetlamp_b'][i % 4], 2 + (i % 6) * 5.5, 9 + (i // 6) * 7)
    for x in (6, 16, 26): s.put('campfire', x, 13)
    s.put('house_red', 8, 19); s.put('shop', 22, 19, act='shop')
    s.scatter(['crystal', 'crystal_pink'], 6, (0, 1, 32, 8), gap=1)
    shot(s, 16, 8, 'lamps'); shot(s, 12, 14, 'fires-and-windows', .4)
    return s.out(8)


# ---------------------------------------------------------------- a dense forest
def t_forest():
    s = base('test_forest', 'Test: dense forest', 44, 34, 'y', 910, far='forest')
    hub(s, 22, 5)
    s.road((22, 5), (22, 32), 'u', 1.2, amp=1.2)
    s.scatter(B.TREES + B.LEAFY, 260, (0, 6, 44, 34), gap=0, svar=.25, road=.5)
    s.scatter(list(B.UNDER), 120, (0, 1, 44, 34), gap=0, road=.4)
    s.grass(10, 10, 6, 3); s.grass(34, 12, 6, 3)
    s.rolling(.6, 5)
    check(s, (22, 5), (22, 31), True, 'along the path through the trees')
    shot(s, 22, 12, 'deep-forest'); shot(s, 22, 26, 'far-in', .5)
    return s.out(7, 'wood')


# ---------------------------------------------------------------- tiny and huge
def t_tiny():
    s = base('test_tiny', 'Test: a tiny scene', 10, 8, 'g', 911)
    hub(s, 5, 3)
    s.put('bench_wood', 3, 6); s.put('streetlamp', 8, 5)
    for c in ((1, 1), (9, 1), (1, 7), (9, 7)): check(s, (5, 3), c, True, f'to the corner {c}')
    shot(s, 5, 3, 'tiny')
    return s.out(8)


def t_huge():
    s = base('test_huge', 'Test: a huge scene', 80, 60, 'g', 912)
    hub(s, 40, 6)
    s.road((40, 6), (40, 56), 'p', 1.4, amp=2); s.road((4, 30), (76, 30), 'p', 1.2, amp=2)
    for cx, cz in ((15, 15), (65, 15), (15, 45), (65, 45)): s.grove(cx, cz, 8, 5, 18, B.TREES, under=B.UNDER)
    s.pond(40, 42, 6, 3, ducks=4, dip=.8); s.terrace(-1, 50, 81, 61, 1.6, wall=False, wobble=1)
    s.scatter(['@rocks', '@bush_round', '@flowers'], 80, (0, 0, 80, 50), gap=.6)
    s.rolling(.6, 7)
    check(s, (40, 6), (40, 55), True, 'to the far end'); check(s, (40, 6), (5, 30), True, 'to the left end')
    shot(s, 40, 8, 'start'); shot(s, 40, 36, 'middle'); shot(s, 70, 30, 'east-end', .5)
    return s.out(7, 'wood')


# ---------------------------------------------------------------- traffic and animals
def t_life():
    s = base('test_life', 'Test: traffic and animals', 40, 28, 'g', 913)
    hub(s, 20, 4)
    s.rect(0, 9, 40, 13, 'a'); s.rect(18, 0, 22, 28, 'a'); s.rect(0, 8, 40, 9, 'q'); s.rect(0, 13, 40, 14, 'q')
    s.life('car', 4, path=[[1, 10], [39, 10], [39, 12], [21, 12], [21, 27], [19, 27], [19, 12], [1, 12]])
    s.life('pigeon', 10, area=[4, 14.5, 16, 20])
    s.cliff(26, 15, 37, 26, -.4, mat=3, wobble=.2); s.cliff(26, 15, 37, 20, -.4, mat=3, wobble=.2)
    s.blob(31.5, 22.5, 4.5, 2, 'w', .1); s.blob(31.5, 17.5, 4.5, 2, 'w', .1); s.life('duck', 5)
    s.life('chicken', 5, area=[2, 2, 14, 7]); s.life('sheep', 4, area=[4, 21, 15, 26]); s.hill(9, 23, 6, 1.2)
    shot(s, 20, 7, 'crossing'); shot(s, 31, 14, 'ducks-on-steps'); shot(s, 9, 18, 'sheep-on-a-hill', .4)
    return s.out(8)



# ---------------------------------------------------------------- v44: the light lab (tools/check-quick.py measures these)
def t_light_terrain():
    """a ridge running north-south (its west slope faces the afternoon sun), rolling ground, a tall block and a wall for
    shadows, every ground kind in strips: the normal map, the slope shading and the shadow depth can be measured"""
    s = base('test_light_terrain', 'Test: light on the land', 44, 30, 'g', 940, look={'sun': {'angle': 35, 'height': 24}})
    hub(s, 10, 4)
    s.hadd(lambda x, z: max(0, 3.2 - abs(x - 30) * .8) if 8 <= z <= 28 else 0)          # the ridge: top at x=30, 4 m wide slopes
    s.hadd(lambda x, z: .5 * math.sin(x / 3.1) * math.cos(z / 2.7) if x < 20 else 0)      # rolling ground on the west half
    s.terrace(2, 20, 8, 26, 3, wall=True, wobble=0, mat=4)                                 # a block that casts a long shadow
    for i, ch in enumerate('gpcsokr'):                                                    # a strip of every ground kind
        s.rect(1 + i * 2.6, 8, 1 + i * 2.6 + 2.4, 14, ch)
    for x in (12, 15, 18): s.put('boulder', x, 17)
    s.put('crate', 24, 4); s.put('bench_wood', 27, 4); s.put('tree_oak', 36, 6)
    s.d['lab'] = {'ridge': [30, 8, 28], 'block': [2, 20, 8, 26, 3], 'strips': [8, 14], 'flat': [20, 2, 26, 7]}
    shot(s, 22, 4, 'ridge-and-block', .3); shot(s, 10, 6, 'ground-kinds', -.2); shot(s, 5, 16, 'block-shadow', 0)
    return s.out(8, 'iron')


def t_light_room():
    """a room: the daylight through the window at the back, two pendant lamps, a lit fridge, crates against the walls and
    a person's spot; indoors the brightness range and the lamp pools after dark can be measured"""
    spec2 = importlib.util.spec_from_file_location('binter', ROOT / 'tools' / 'build-interiors.py')
    BI = importlib.util.module_from_spec(spec2); spec2.loader.exec_module(BI)
    s = BI.room('test_light_room', 'Test: light in a room', 'b', '#E6CFA2', 941, 'shop', None, (7, 7.7), [])
    s.d['test'] = 1; s.d['kind'] = 'test'; s.d['checks'] = []; s.d['shots'] = []; s.d['npcSpots'] = []; s.d['keeper'] = None; s.d['exits'] = []
    s.put('shop_counter', 7, 6.6, label='Counter'); s.put('fridge_drinks', 3.2, 8.9); s.put('bookshelf', 10.8, 8.6)
    for x in (4, 10): s.put('lamp', x, 5.2)
    for x, z in ((1.6, 5.4), (12.4, 5.4), (1.6, 3)): s.put('crate_goods', x, z)
    s.put('table_round', 10.5, 3.2); s.put('chair_wood', 9.4, 3.2); s.put('plant_tall', 12.5, 1.8, 1, 1); s.put('rug_round', 7, 3.6, block=False)
    BI.hang(s, 'wall_window', 7); BI.hang(s, 'wall_clock', 4.4); BI.hang(s, 'wall_painting', 9.6)
    s.d['lab'] = {'floor': [3, 2, 11, 5], 'lamps': [[4, 5.2], [10, 5.2]]}
    shot(s, 7, 2.2, 'room'); shot(s, 7, 4.5, 'lamps', 0)
    return s.out(10)


def t_light_props():
    """one of each kind of thing the light touches, side by side on flat ground: a picture prop, a swaying tree, a solid
    (voxel) prop, a solid picture prop, two buildings, a lamp, a flag; each must draw and sit in the same light"""
    s = base('test_light_props', 'Test: light on props', 40, 22, 'g', 942, look={'sun': {'angle': 30, 'height': 30}})
    hub(s, 20, 3)
    s.road((2, 9), (38, 9), 'c', 2.4, amp=0)
    for i, k in enumerate(['signpost', 'tree_oak', 'bench_wood', 'crate_stack', 'boulder', 'barrel_wood', 'streetlamp', 'flag_pole', 'planter_box', 'bush_box']):
        s.put(k, 3 + i * 3.8, 12)
    s.put('house_red', 9, 18); s.put('shop', 22, 18); s.put('clinic', 33, 18)
    for i, k in enumerate(['crate', 'crate', 'hydrant', 'mailbox', 'trash', 'bollard']):
        s.put(k, 5 + i * 5, 6, **({'model': 'card'} if i == 1 else {}))                    # the second crate stays a picture
    s.d['lab'] = {'row': [3, 12, 38], 'buildings': 3}
    shot(s, 20, 7, 'props-and-buildings', 0); shot(s, 8, 8, 'west-end', -.3); shot(s, 32, 8, 'east-end', .3)
    return s.out(8)


def t_light_air():
    """a misty wood with the low sun behind the trees: the god rays and the sun-coloured fog, with an open patch in front
    so the air with and without trees can be compared"""
    s = base('test_light_air', 'Test: light in the air', 36, 28, 'g', 943, look={'sun': {'angle': 10, 'height': 16}, 'air': {'mist': .55, 'hazeDistance': 22, 'godRays': 1}})
    hub(s, 18, 4)
    s.road((18, 2), (18, 24), 'p', 2.0, amp=.3)
    s.scatter(['tree_pine', 'tree_oak', 'tree_birch'], 36, (2, 12, 34, 26), gap=1.4)
    s.scatter(['@rocks', 'fern', 'mushroom'], 14, (2, 8, 34, 26), gap=.8)
    s.d['lab'] = {'open': [4, 2, 32, 7], 'wood': [4, 14, 32, 24]}
    shot(s, 18, 6, 'rays', 0); shot(s, 18, 10, 'into-the-wood', 0)
    return s.out(8)


# ---------------------------------------------------------------- the graphics bench
def t_graphics():
    """the Graphics test's place (docs/graphics-bench.md): nine stations, each built so one group of settings has
    something to work on, and a fixed spot to stand and look from. The test (game/js/graphics-bench-test.js) reads `bench`."""
    s = base('test_graphics', 'Test: graphics bench', 60, 46, 'g', 950, far='hills', look={'sun': {'angle': 35, 'height': 40}})
    s.d['farH'] = 1
    hub(s, 30, 3)
    s.road((30, 1), (30, 45), 'p', 1.6, amp=0)
    s.road((2, 18.5), (58, 18.5), 'p', 1.4, amp=0)
    s.road((2, 31.5), (58, 31.5), 'p', 1.4, amp=0)
    # A1 control pad: bare pavers, nothing on them, seen close up (what the full-screen passes cost)
    s.rect(3, 4, 17, 15, 'q')
    # A2 shadow court: casters of every kind on a plaza, houses behind, sun from the side
    s.rect(21, 5, 39, 16, 'c')
    for i, k in enumerate(['tree_oak', 'streetlamp', 'tree_pine', 'flag_pole', 'tree_birch', 'signpost', 'tree_oak']):
        s.put(k, 22.5 + i * 2.5, 10)
    for i, k in enumerate(['crate_stack', 'bench_wood', 'barrel', 'boulder', 'vending']):
        s.put(k, 23 + i * 3.5, 7.6)
    s.building('house_red', 24, 13.5, path=False); s.building('shop', 30.5, 13.5, path=False); s.building('clinic', 36.5, 13.5, path=False)
    # A3 pond: still water with trees and a house on the far bank to mirror
    s.pond(50, 10, 5.5, 3.2, reeds=6, lilies=4, ducks=0, rocks=2)
    for i, k in enumerate(['tree_oak', 'tree_birch', 'tree_pine', 'tree_maple', 'tree_oak']):
        s.put(k, 44.5 + i * 2.7, 15.2)
    s.building('house_red', 55.5, 15.6, path=False)
    # B1 sun gap: a tight grove with one gap and two roofs, low sun straight ahead (light shafts, god rays)
    s.grove(10.5, 26.5, 7.5, 4, 34, ['tree_oak', 'tree_pine', 'tree_birch', 'tree_maple'], under=('fern', 'stump'))
    s.rect(9, 21, 12, 31, 'p')
    s.building('house_red', 6.5, 22.2, path=False); s.building('house_red', 14.5, 22.2, path=False, f=1)
    # B2 lamp square: brick paving, lamps, fires and lit windows, measured at night (glow, lamps)
    s.rect(21, 20, 39, 30, 'h')
    for i in range(10):
        s.put(['streetlamp', 'lantern_b', 'lamp', 'streetlamp_b'][i % 4], 22.5 + (i % 5) * 3.75, 22.5 + (i // 5) * 3.2)
    s.put('campfire', 26, 24); s.put('campfire', 34, 24)
    s.building('house_red', 24.5, 28.2, path=False); s.building('shop', 30.5, 28.2, path=False); s.building('house_red', 36.5, 28.2, path=False, f=1)
    s.scatter(['crystal', 'crystal_pink'], 4, (22, 20.5, 38, 21.5), gap=1, road=0)
    # B3 meadow: deep grass and flowers, open to the air (grass, particles, low mist)
    s.rect(41, 20, 59, 30, 'G')
    s.grass(50, 25, 7.5, 4.2, density=1.1)
    s.patches('f', .55, 4, box=(41, 20, 59, 30), seed=3)
    # C1 everything: a little of all of the above round one spot (all dials at their lowest, default, highest)
    s.grove(10, 38.5, 6.5, 3.5, 14, ['tree_oak', 'tree_pine'], under=('fern',))
    s.pond(7, 42.5, 3, 1.6, reeds=3, lilies=2, ducks=0, rocks=1)
    s.grass(14.5, 35.5, 3, 1.8, density=1.0)
    for x in (5, 9, 13, 17): s.put('streetlamp', x, 34)
    s.building('house_red', 15.5, 42.2, path=False)
    # C2 depth corridor: an avenue of trees from close by to the far hills past the edge (depth of field, far things)
    for i in range(6):
        z = 35 + i * 2
        s.put('tree_oak' if i % 2 else 'tree_pine', 26.5, z); s.put('tree_birch' if i % 2 else 'tree_oak', 33.5, z + 1)
    s.scatter(['bush_round', 'bush_flower', 'fern'], 10, (24, 34, 36, 45), gap=.6)
    # C3 open sky: a wide, empty plain (clouds, cloud shadows)
    s.rect(41, 33, 59, 45, 'G')
    s.scatter(['flowers_meadow', 'flowers_mixed', 'bush_round'], 6, (42, 34, 58, 44), gap=2)
    s.patches('G', .6, 6, seed=6)
    # where the test stands: [x, z, camera turn, zoom]; the rest of the stations' setup lives with the test
    st = {'control': [10, 6, 0, .6], 'shadows': [30, 5.5, 0, 1], 'pond': [50, 5, 0, 1],
          'sun': [10.5, 20, 0, 1.1], 'lamps': [30, 20, 0, 1], 'meadow': [50, 23.5, 0, 1],
          'everything': [10, 32.5, 0, 1.3], 'depth': [30, 35.5, 0, 1.3], 'sky': [50, 33, 0, 1.7]}
    # (2026-10-19: the meadow spot moved into the grass, so the pond's trees no longer stand in front of it, and the depth
    # spot into the avenue's mouth at a closer zoom, so the avenue, not the lamp square, fills the picture)
    s.d['bench'] = st
    for k, (x, z, y, _) in st.items(): shot(s, x, z, k, y)
    check(s, (30, 3), (10, 32.5), True, 'from where you arrive to the far corner')
    return s.out(8)


BUILD = [t_stairs, t_ledges, t_bridges, t_water, t_shadows, t_props, t_slopes, t_hilltown, t_camera, t_night, t_forest, t_tiny, t_huge, t_life, t_light_terrain, t_light_room, t_light_props, t_light_air, t_graphics]


def main():
    only = [a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--only=')]
    if only:  # one test scene into the data files, nothing else touched (the full rebuild below is out of date, HANDOFF)
        D = gamedata.load()
        for f in BUILD:
            if 'test_' + f.__name__[2:] not in only[0].split(','): continue
            sc = f(); sid = sc_id(sc, f); D['maps'][sid] = sc
            print(f'  {sid}: {sc["w"]}x{sc["h"]}, {len(sc.get("props", []))} props, {len(sc.get("shots", []))} shots')
        gamedata.save(D)
        return
    src = gamedata.js_text(); head = src[:src.index('window.GAMEDATA=')]
    D = json.JSONDecoder().raw_decode(src[src.index('window.GAMEDATA=') + len('window.GAMEDATA='):])[0]
    for k in [k for k, v in D['maps'].items() if v.get('test')]: del D['maps'][k]
    for f in BUILD:
        sc = f(); D['maps'][sc_id(sc, f)] = sc
        print(f'  {sc_id(sc, f)}: {sc["w"]}x{sc["h"]}, {len(sc.get("props", []))} props, {len(sc.get("checks", []))} checks, {len(sc.get("shots", []))} shots')
    gamedata.save_js(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n')


def sc_id(sc, f):
    return 'test_' + f.__name__[2:]


if __name__ == '__main__':
    main()
