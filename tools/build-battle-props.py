#!/usr/bin/env python3
"""Lay out the billboard props of every battle stage (game/art/manifest.js -> ARTMAN.battle.areas[area].props).

Usage:  python3 tools/build-battle-props.py [--check]

Only the "props" arrays inside ARTMAN.battle.areas are rewritten; every other byte of manifest.js stays as it is.
The layout is seeded per area, so running it again gives the same result (as long as the set of available props is the same).
--check prints the counts without writing.

Kinds come from two catalogs:
  * battle props   (game/art/battle/props/<kind>.png, anchors in ARTMAN.battle.props, 30 px per meter)
  * scene props    (game/art/scene/props/<kind>.png, listed in game/art/scene/props.json and gameData.scenery.props, 34 px per meter)
A scene prop is used only if its PNG exists and data/gamedata.js lists it under scenery.props (that is where battle-stage.js reads it).

World space (see game/js/battle-stage.js): x to the right, z away from the camera, meters. The camera sits at (0, 1.6, 0) and looks down +z.
The two billionaires stand on rings at POS[0]=(-0.88, 2.6) (yours, back view) and POS[1]=(1.72, 5.7) (the foe).
Rules: their rings, the line between them and the view from the camera to each stay clear; the near foreground stays sparse and at the
edges; trees and other tall things go to the back and the sides; small ground cover fills the middle distance; nothing sits on the
dirt paths painted into the ground texture; indoor props stay inside the round room.
"""
import gamedata  # phase 04b: the data files in game/data
import json, math, os, random, re, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.normpath(os.path.join(HERE, '..', 'game'))
MANIFEST = os.path.join(GAME, 'art', 'manifest.js')
SCENE_META = os.path.join(GAME, 'art', 'scene', 'props.json')
GAMEDATA = os.path.join(GAME, 'data', 'gamedata.js')

POS = [(-0.88, 2.6), (1.72, 5.7)]
CX0, CZ0, TEXS = 0.55, 3.9, 16           # ground texture placement (battle-stage.js)
ROOM = (CX0, CZ0 + 2, 12.5)               # indoor wall cylinder (battle-stage.js castFloor)

# ---------------------------------------------------------------- what each area is made of
# zone: back (tall things far away), side (middle distance, left and right of the action), cover (small ground cover
# anywhere it is allowed, mostly middle distance), near (close to the camera, only at the frame edges; keep it sparse)
RECIPES = {
    'grass': [
        ('back', 26, ['tree_oak', 'tree_oak', 'tree_pine', 'tree', 'tree_birch', 'tree_fruit']),
        ('side', 7, ['tree_birch', 'tree_oak', 'tree', 'tree_fruit']),
        ('side', 12, ['bush_round', 'bush', 'bush_berry', 'hedge', 'boulder', 'stump', 'log']),
        ('side', 3, ['fence', 'signpost', 'lamp']),
        ('cover', 34, ['tallgrass', 'tallgrass', 'tallgrass', 'flowers_red', 'flowers_yellow', 'flowers_blue', 'flowers', 'rocks', 'mushroom']),
        ('near', 3, ['tallgrass', 'flowers_yellow', 'bush_round']),
    ],
    'golf': [
        ('back', 22, ['tree_oak', 'tree_pine', 'tree', 'tree_birch', 'tree_oak']),
        ('side', 5, ['tree_birch', 'tree_oak', 'tree']),
        ('side', 4, ['flag']),
        ('side', 4, ['bunker']),
        ('side', 10, ['bush_round', 'hedge', 'cart', 'bush', 'picnic', 'signpost']),
        ('cover', 18, ['flowers_red', 'flowers_yellow', 'flowers_blue', 'tallgrass', 'rocks', 'flowers']),
        ('near', 2, ['flowers_yellow', 'tallgrass']),
    ],
    'shell': [
        ('back', 30, ['tree_pine', 'tree_pine', 'tree_oak', 'tree', 'tree_pine', 'mushroom_giant']),
        ('side', 8, ['tree_pine', 'tree_oak', 'tree_birch', 'mushroom_giant']),
        ('side', 16, ['bush', 'bush_berry', 'bush_berry', 'bush_round', 'stump', 'log', 'boulder', 'mailbox', 'lantern']),
        ('cover', 32, ['tallgrass', 'tallgrass', 'mushroom', 'mushroom', 'reeds', 'rocks', 'flowers_blue', 'bush_berry']),
        ('near', 3, ['tallgrass', 'mushroom', 'bush_berry']),
    ],
    'grotto': [
        ('back', 18, ['stalagmite', 'stalagmite', 'boulder', 'derrick', 'crystal', 'mushroom_giant']),
        ('side', 18, ['stalagmite', 'crystal', 'crystal', 'boulder', 'rock', 'derrick', 'barrel', 'pipe', 'lantern']),
        ('cover', 24, ['rocks', 'rocks', 'crystal', 'mushroom', 'rock', 'barrel', 'campfire', 'crate']),
        ('near', 3, ['rocks', 'crystal', 'mushroom']),
    ],
    'esc': [
        ('back', 12, ['mesa', 'mesa', 'boulder', 'cactus', 'escal']),
        ('side', 16, ['cactus', 'cactus', 'boulder', 'rock', 'escal', 'tent', 'signpost', 'crates']),
        ('cover', 22, ['rocks', 'rocks', 'cactus', 'rock', 'tallgrass', 'campfire']),
        ('near', 3, ['rocks', 'cactus', 'rock']),
    ],
    'clear': [
        ('back', 14, ['scrap', 'scrap', 'crates', 'streetlamp', 'tires', 'cartS']),
        ('side', 18, ['scrap', 'tires', 'tires', 'barrel', 'barrel', 'crates', 'bin', 'cartS', 'salesign', 'pipe']),
        ('cover', 14, ['tires', 'crate', 'barrel', 'trash', 'rocks']),
        ('near', 2, ['tires', 'crate']),
    ],
    'food': [
        ('back', 12, ['stall', 'stall', 'table', 'pretzel', 'streetlamp']),
        ('side', 18, ['table', 'table', 'picnic', 'planter', 'bench', 'pretzel', 'stall', 'lantern', 'crates']),
        ('cover', 10, ['trash', 'bin', 'crate', 'planter']),
        ('near', 2, ['trash', 'planter']),
    ],
    'mall': [
        ('back', 12, ['escal', 'kioskP', 'stall', 'fountain', 'statue', 'streetlamp']),
        ('side', 20, ['planter', 'planter', 'bench', 'bench', 'kioskP', 'streetlamp', 'salesign', 'fountain', 'escal']),
        ('cover', 10, ['bin', 'trash', 'planter', 'bench']),
        ('near', 2, ['planter', 'bin']),
    ],
}
MAXN = {  # at most this many of a kind per area
        'statue': 1, 'signpost': 1, 'tent': 1, 'campfire': 1, 'picnic': 2, 'mailbox': 1, 'lamp': 2, 'fountain': 2, 'busstop': 1,
        'mushroom_giant': 3, 'derrick': 4, 'escal': 3, 'mesa': 7, 'cart': 2, 'cartS': 2, 'flag': 4, 'salesign': 2, 'stall': 5, 'lantern': 3,
        'streetlamp': 6}


def load_manifest():
    s = open(MANIFEST, encoding='utf-8').read()
    head = 'window.ARTMAN='
    assert s.startswith(head), 'unexpected manifest.js header'
    body = s[len(head):].rstrip()
    assert body.endswith(';')
    return s, json.loads(body[:-1])


def catalog(man):
    """kind -> {w,h (meters), tall, src}"""
    cat = {}
    for k, o in man['battle']['props'].items():
        p = os.path.join(GAME, 'art', 'battle', 'props', k + '.png')
        if not os.path.exists(p):
            continue
        im = Image.open(p)
        bb = im.getbbox() or (0, 0, im.width, im.height)
        cat[k] = {'w': (bb[2] - bb[0]) / 30, 'h': o['h'], 'flat': o.get('flat', 0)}
    meta = json.load(open(SCENE_META, encoding='utf-8')) if os.path.exists(SCENE_META) else {}
    gd = gamedata.js_text()
    m = re.search(r'"scenery"\s*:\s*\{', gd)
    gds = gd[m.end():] if m else ''
    for k, o in meta.items():
        if k in cat:
            continue
        p = os.path.join(GAME, 'art', 'scene', 'props', k + '.png')
        if not os.path.exists(p) or ('"img": "scene/props/%s.png"' % k) not in gds:
            continue
        if o.get('flat'):
            continue  # flat decals lie on the ground in the walking scene; the battle stage only has upright billboards
        im = Image.open(p)
        bb = im.getbbox() or (0, 0, im.width, im.height)
        cat[k] = {'w': (bb[2] - bb[0]) / 34, 'h': im.height / 34, 'flat': 0}
    return cat


def ground_mask(area_art):
    """True where the ground texture is 'path' (far from the texture's dominant colour family) -> keep props off it."""
    p = os.path.join(GAME, 'art', 'battle', area_art + '_ground.png')
    if not os.path.exists(p):
        return None
    im = Image.open(p).convert('RGB')
    W, H = im.size
    px = im.load()
    # dominant hue by majority vote of "green dominant" vs "red dominant" pixels
    g = sum(1 for y in range(0, H, 4) for x in range(0, W, 4) if px[x, y][1] > px[x, y][0] + 12)
    if g < (W // 4) * (H // 4) * .6:
        return None  # not a grass texture: no paths to avoid
    return lambda u, v: (lambda c: c[1] <= c[0] + 4)(px[u % W, v % H])


def on_path(mask, x, z, r):
    if mask is None:
        return False
    for dx in (-r, 0, r):
        for dz in (-.4, 0, .4):
            u = int(math.floor((x + dx - CX0) * TEXS + 256))
            v = int(math.floor((z + dz - CZ0) * TEXS + 256))
            if mask(u, v):
                return True
    return False


def seg_dist(px, pz, a, b):
    ax, az = a; bx, bz = b
    dx, dz = bx - ax, bz - az
    t = max(0, min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)))
    return math.hypot(px - ax - t * dx, pz - az - t * dz)


FOC, CAMY = 170, 1.6


def screen_rect(x, z, r, h):
    """stage-pixel rect (x0, x1, top, bottom) of an upright billboard at (x, z), relative to the view center"""
    return (FOC * (x - r) / z, FOC * (x + r) / z, -FOC * (h - CAMY) / z, FOC * CAMY / z)


def zone_tall(h):
    return h > 1.7


# the billionaires' rough on-screen boxes (half width, height in meters) at the home camera
BILL = [screen_rect(POS[0][0], POS[0][1], .8, 1.7) + (POS[0][1],), screen_rect(POS[1][0], POS[1][1], 1.3, 2.0) + (POS[1][1],)]


def allowed(kind, info, x, z, placed, indoor, mask):
    r = info['w'] / 2
    h = info['h']
    if z < 1.1:
        return False
    if indoor and math.hypot(x - ROOM[0], z - ROOM[1]) > ROOM[2] - 1.4 - r * .6:
        return False
    # the two rings and a margin around them
    if math.hypot(x - POS[0][0], z - POS[0][1]) < 2.1 + r or math.hypot(x - POS[1][0], z - POS[1][1]) < 2.3 + r:
        return False
    # line of sight between the two
    if seg_dist(x, z, POS[0], POS[1]) < 1.5 + r:
        return False
    # screen space, seen from the home camera: nothing in front of either billionaire may cover it, and only low ground cover
    # may peek out from behind one (a tree growing out of a head reads badly)
    a0, a1, top, bot = screen_rect(x, z, r, h)
    for (bx0, bx1, btop, bbot, bz) in BILL:
        if a1 < bx0 - 4 or a0 > bx1 + 4 or top > bbot or bot < btop - 6:
            continue
        if z < bz + .4 or (h > .75 and z < 14):  # far scenery may stand behind them; the middle distance may not
            return False
    if z < 3.6 and h > .7:
        return False  # the near foreground: only low tufts, flowers and stones
    if z < 5 and h > 1.0:
        return False  # close to the camera only low things, or they wall off the stage
    if zone_tall(h) and z < 8.5 and abs(x) < 1.3 * z:
        return False  # big things stay well back unless they are out at the far edges
    # the camera's view of the middle stays open close up: near props only at the frame edges
    if z < 3.4 and abs(x) / z < .62:
        return False
    if on_path(mask, x, z, max(.3, r * .8)):
        return False
    for (k2, x2, z2, r2, _) in placed:
        d = math.hypot(x - x2, z - z2)
        small = h < .9 and CAT[k2]['h'] < .9
        if d < (r + r2) * (.55 if small else .85) + .15:
            return False
    return True


def sample(zone, rng, indoor):
    """a candidate position for a zone. FOV: phones see |x| <= ~.75 z, wide screens ~1.3 z around the action."""
    zmax = 16.5 if indoor else 28
    if indoor and zone != 'near':
        # round room: back things line the wall, the rest stand around the floor
        lo, hi, th = {'back': (7.8, 10.8, 1.7), 'side': (4.0, 10.2, 2.3), 'cover': (2.5, 10.2, 2.6)}[zone]
        a, R = rng.uniform(-th, th), rng.uniform(lo, hi)
        return ROOM[0] + R * math.sin(a), ROOM[1] + R * math.cos(a)
    if zone == 'back':
        z = rng.uniform(11, zmax) if not indoor else rng.uniform(10.5, zmax)
        spread = .95 * z + 3
        x = rng.uniform(-spread, spread)
    elif zone == 'side':
        z = rng.uniform(5.5, 13)
        side = rng.choice((-1, 1))
        x = side * rng.uniform(.45 * z, 1.05 * z + 2) + (1.0 if side > 0 else 0)
    elif zone == 'cover':
        z = rng.uniform(3.6, 17 if not indoor else 14)
        x = rng.uniform(-(1.05 * z + 2), 1.05 * z + 2) + .4
    else:  # near
        z = rng.uniform(1.6, 3.4)
        side = rng.choice((-1, 1))
        x = side * rng.uniform(.7 * z, 1.2 * z)
    return x, z


def layout(area, art_key, info_area):
    rng = random.Random('nw-battle-props-' + area)
    indoor = bool(info_area.get('indoor'))
    mask = None if indoor else ground_mask(art_key)
    placed, out, count = [], [], {}
    for zone, n, kinds in RECIPES.get(area, RECIPES['grass']):
        kinds = [k for k in kinds if k in CAT]
        if not kinds:
            continue
        # the recipe's mix, in a shuffled order; each one gets a fair number of tries to find a free spot
        plan = [kinds[q % len(kinds)] for q in range(n)]
        rng.shuffle(plan)
        for k in plan:
            if count.get(k, 0) >= MAXN.get(k, 99):
                continue
            for _ in range(500):
                # back trees and ground cover like company: often start next to something already placed in this zone
                mates = [p for p in placed if p[4] == zone]
                if zone in ('back', 'cover') and mates and rng.random() < .45:
                    _, x0, z0, _, _ = mates[rng.randrange(len(mates))]
                    x, z = x0 + rng.uniform(-2.4, 2.4), z0 + rng.uniform(-1.8, 1.8)
                else:
                    x, z = sample(zone, rng, indoor)
                if allowed(k, CAT[k], x, z, placed, indoor, mask):
                    placed.append((k, x, z, CAT[k]['w'] / 2, zone))
                    out.append({'kind': k, 'x': round(x, 3), 'z': round(z, 3)})
                    count[k] = count.get(k, 0) + 1
                    break
    out.sort(key=lambda p: (-p['z'], p['x']))
    return out


def replace_props(src, area, props):
    """swap just the props array of one area inside the minified manifest"""
    m = re.search(r'"battle":\{"areas":\{', src)
    assert m, 'battle.areas not found'
    key = '"%s":{"props":[' % area
    i = src.find(key, m.end())
    assert i >= 0, 'area %s not found' % area
    a = i + len(key) - 1
    depth = 0
    for j in range(a, len(src)):
        c = src[j]
        if c == '[':
            depth += 1
        elif c == ']':
            depth -= 1
            if depth == 0:
                break
    new = json.dumps(props, separators=(',', ':'))
    return src[:a] + new + src[j + 1:]


def main():
    global CAT
    src, man = load_manifest()
    CAT = catalog(man)
    gd = gamedata.js_text()
    gdj = json.loads(gd[gd.index('window.GAMEDATA=') + len('window.GAMEDATA='):].rstrip().rstrip(';'))
    backs = gdj['battleStages']
    out = src
    for area, A in backs.items():
        art = A.get('art') or area
        if art not in man['battle']['areas']:
            continue
        props = layout(area, art, A)
        kinds = {}
        for p in props:
            kinds[p['kind']] = kinds.get(p['kind'], 0) + 1
        print('%-7s %3d props  %s' % (area, len(props), ' '.join('%s:%d' % kv for kv in sorted(kinds.items()))))
        out = replace_props(out, art, props)
    json.loads(out[len('window.ARTMAN='):].rstrip()[:-1])  # still valid
    if '--check' in sys.argv:
        return
    if out != src:
        with open(MANIFEST, 'w', encoding='utf-8', newline='') as f:
            f.write(out)
        print('wrote', os.path.relpath(MANIFEST, os.path.dirname(GAME)))
    else:
        print('manifest.js already up to date')


CAT = {}
if __name__ == '__main__':
    main()
