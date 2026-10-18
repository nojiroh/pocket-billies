#!/usr/bin/env python3
"""v46: the world update's places. All 8 towns and 11 routes laid out again at their new size, with the v46 ground
(clover, moss, mud, wet sand, pebbles, cobbles, leaf litter, heather, marsh, marble, ice, crystal) and buildings
(bakery, inn, market hall, bank, library, school, station, fire station, mansion, barn, greenhouse, ski lodge, and
every building's colour variants), following one set of rules so the places feel grown rather than placed:

  Towns   a heart (a square) with a landmark you see from the way in; a main street through the square to the
          roads; lanes of buildings facing the streets with gardens, fences and lamps; edges that thin out into
          countryside, so a town fades into its roads.
  Routes  a path that winds between the exits; tall grass in drifts beside it (where the billionaires wait); one
          feature (a stream, a ruin, a lookout...); clearings; ground that follows the land; plants in families.

Before a place is rebuilt, the scene as it was is kept as "<id>@v45" (open it in the Studio, copy from it). A
place marked "keep": true in the Studio is never rebuilt. The roads between places keep their names; the exits
are made again where the roads leave (by compass bearing) and the road table (links: a, b) is updated to match.
Everything the game relies on is kept: shops (and which shop), the clinic, the lab, your house, ladders, the
fountain in Sundown, the look of each place (sky, haze, music, weather, folk, what people say).

    python3 tools/build-places-v46.py               # rebuild every place not marked keep (backups first)
    python3 tools/build-places-v46.py marigold clovercrest  # just these
    python3 tools/build-places-v46.py --dry         # build and report, write nothing
    python3 tools/build-places-v46.py --map out/    # also draw a top-down map of each place
"""
import gamedata  # phase 04b: the data files in game/data
import copy, importlib.util, json, math, random, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('bscenes', ROOT / 'tools' / 'build-scenes.py')
B = importlib.util.module_from_spec(spec); spec.loader.exec_module(B)
spec3 = importlib.util.spec_from_file_location('v28', ROOT / 'tools' / 'build-v28.py')
V28 = importlib.util.module_from_spec(spec3); spec3.loader.exec_module(V28)
spec2 = importlib.util.spec_from_file_location('grow', ROOT / 'tools' / 'grow-wild.py')
GW = importlib.util.module_from_spec(spec2); spec2.loader.exec_module(GW)
spec4 = importlib.util.spec_from_file_location('clearwin', ROOT / 'tools' / 'clear-windows.py')   # alpha 0.1: nothing in front of a window
CW = importlib.util.module_from_spec(spec4); spec4.loader.exec_module(CW)
DATA, meta, radius, GROUPS, PPU = B.DATA, B.meta, B.radius, B.GROUPS, B.PPU

# v46 ground: paved kinds join the road network and nothing grows on them
B.ROADS = 'pcmqhaeKTv'
AV = 'pcwdaqhebmKTIv'            # nothing grows here (paths, plazas, water, paving, ice)
SOFT = 'gGflytCMLHRDSPnuzjsk'     # ground where plants and grass can be
LAYOUT = {'w', 'h', 'tiles', 'heights', 'props', 'steps', 'stepm', 'stepsV', 'exits', 'edgeExits', 'hub', 'streams', 'bridges', 'rails', 'arches',
          'escalators', 'npcSpots', 'grown', 'wild', '_exk', 'life', 'keep', 'v46'}
SIZE = {'marigold': (96, 72), 'clovercrest': (96, 72), 'fizzwell': (80, 60), 'pepperpot': (80, 60), 'lanternhall': (80, 60), 'verdigris': (128, 96), 'palmhaven': (96, 72),
        'frostcrown': (96, 72)}
ROUTE_SIZE = (112, 64)


def load():
    src = gamedata.js_text(); i = src.index('window.GAMEDATA=')
    return src[:i], json.JSONDecoder().raw_decode(src[i + len('window.GAMEDATA='):])[0]


def save(head, D):
    gamedata.save_js(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n')


def seg_d(px, pz, a, b): return B.seg_dist(px, pz, a, b)


class Place(B.Scene):
    """a scene with the v46 layout helpers"""
    def out(self, *a, **k):
        self.place_lamps(); return super().out(*a, **k)

    def setup(self, old, hub):
        for k, v in old.items():
            if k not in LAYOUT: self.d[k] = copy.deepcopy(v)
        self.d['w'], self.d['h'] = self.W, self.H; self.d['edge'] = self.g[0][0]
        self.d['kind'] = 'town' if self.sid in SIZE else 'route'; self.d['locationId'] = self.sid
        self.d.pop('backup', None)
        if self.d.get('name', '').endswith(' (v45)'): self.d['name'] = self.d['name'][:-6]
        self.old = old; self.hub = hub; self.d['v46'] = 46
        oh = old.get('hub') or [old['w'] / 2, old['h'] / 2]
        k = min(self.W / old['w'], self.H / old['h'])
        sp = [[round(min(self.W - 2, max(2, hub[0] + (q[0] - oh[0]) * k)), 2), round(min(self.H - 2, max(2, hub[1] + (q[1] - oh[1]) * k)), 2)] for q in old.get('npcSpots') or [] if isinstance(q, list)]
        if sp: self.d['npcSpots'] = sp
        for e in old.get('life') or []:
            q = {a: b for a, b in e.items() if a not in ('area', 'path')}; self.life(q.pop('k'), q.pop('n'), **q)
        for pk, pv in (('w', 0),): pass
        return self

    # -- free space for a box (a building's footprint) ------------------------------------------------------------
    def box_free(self, x0, z0, x1, z1, road_m=.6, front=None):
        if x0 < .5 or z0 < .5 or x1 > self.W - .5 or z1 > self.H - .5: return False
        for a0, b0, a1, b1 in self.blocks:
            if x0 < a1 and x1 > a0 and z0 < b1 and z1 > b0: return False
        for cx, cz, cr in self.clear:
            if x0 - cr < cx < x1 + cr and z0 - cr < cz < z1 + cr: return False
        for zz in frange(z0, z1, .5):
            for xx in frange(x0, x1, .5):
                if self.at(xx, zz) in 'wd': return False
                if self.near_road(xx, zz, road_m) and not (front and zz < front): return False
        return True

    def house(self, k, x, z, act='house', v=None, say=None, label=None, shop=None, f=0, garden=True, fence=None, lawn='l'):
        """a building with its door to the street in front, a little garden and maybe a fence"""
        m = meta(k); w, d = m.get('box', [3, 2.2]); r = self.r
        if not self.box_free(x - w / 2 - .4, z - .4, x + w / 2 + .4, z + d + .4, .6, front=z + .3):
            print(f'    (no room for {k} at {x:.1f},{z:.1f})') if k not in ROWFILL else None; return None
        if lawn and garden:
            for xx in range(int(x - w / 2 - 1), int(x + w / 2 + 2)):
                for zz in range(int(z - 1), int(z + d + 2)):
                    if self.at(xx + .5, zz + .5) in SOFT: self.cell(xx + .5, zz + .5, lawn)
        under = lawn or self.d['edge']
        for xx in range(int(x - w / 2), int(math.ceil(x + w / 2))):
            for zz in range(int(z + .5), int(math.ceil(z + d))):
                if self.at(xx + .5, zz + .5) not in 'wd': self.cell(xx + .5, zz + .5, under if under in SOFT + 'l' else self.at(xx + .5, zz + .5))
        p = self.building(k, x, z, act, label, say, f=f, shop=shop)
        nv = len(((CAT.get(k) or {}).get('build') or {}).get('variants') or [])
        if v is None and nv and r.random() < .65: v = r.randint(1, nv)
        if v: p['v'] = v
        if garden:
            door = x + (m.get('door') or {'x': 0})['x'] / PPU * (-1 if f else 1)
            if fence if fence is not None else r.random() < .5:
                for side in (-1, 1):
                    fx = door + side * 2.1
                    if abs(fx - x) < w / 2 + 1.2 and self.free(fx, z - 1.1, .4, AV, .35, .05): self.put('picket_fence', fx, z - 1.1, .9)
            for _ in range(2):
                sx = x + r.choice((-1, 1)) * (w / 2 + r.uniform(.3, 1.0)); sz = z + r.uniform(-.4, d * .5)
                if self.free(sx, sz, .3, AV, .4, .05): self.put(r.choice(['@bush_round', 'bush_flower', 'planter_round', 'flowerpot', 'bush_box', 'bush_roses']), sx, sz, r.uniform(.85, 1.05), r.random() < .5)
            if r.random() < .5: self.drift(['@flowers', 'flowers_mixed'], x + r.uniform(-w * .3, w * .3), z - .8, w * .4, .35, 3, avoid=AV)
            if r.random() < .35 and self.free(x, z + d + 1.0, .4, AV, .4): self.put('laundry_line', x + r.uniform(-.5, .5), z + d + 1.0, .9, block=False)
        return p

    def row(self, z, x0, x1, keys, acts=None, gap=(1.0, 2.6), **kw):
        """a lane of buildings with their fronts on the line z (facing the street just in front)"""
        x = x0 + self.r.uniform(0, 1.5); out = []
        keys = list(keys)
        while x < x1 and keys:
            k = keys[0]; w = meta(k).get('box', [3, 2])[0]
            if x + w > x1: break
            a = (acts or {}).get(k, 'house')
            p = self.house(k, x + w / 2, z + self.r.uniform(-.15, .15), a, **kw)
            if p: out.append(p); keys.append(keys.pop(0)); x += w + self.r.uniform(*gap)
            else: x += 1.2
        return out

    def street(self, pts, ch='K', width=2.2, lamps='streetlamp', every=11, kerb=None):
        """a town street: paved, with lamps along it"""
        self.line(pts, ch, width / 2 + .5, keep='wd'); self.roads.append((pts, width))
        if lamps: self.__dict__.setdefault('lamp_req', []).append((pts, width, lamps, every))
        return pts

    def place_lamps(self):
        """the street lamps, once the buildings stand (a lamp gives way to a front door)"""
        for pts, width, lamps, every in self.__dict__.pop('lamp_req', []):
            dist = 0; side = 1
            for a, b in zip(pts, pts[1:]):
                L = math.hypot(b[0] - a[0], b[1] - a[1]); ux, uz = (b[0] - a[0]) / (L or 1), (b[1] - a[1]) / (L or 1)
                t = (every - dist % every) % every
                while t < L:
                    x, z = a[0] + ux * t - uz * side * (width / 2 + .9), a[1] + uz * t + ux * side * (width / 2 + .9)
                    if self.free(x, z, .3, 'wd', None, .3) and not self.near_road(x, z, .2): self.put(lamps, x, z)
                    side = -side; t += every
                dist += L

    def wind(self, a, b, ch='p', width=1.2, amp=2.6, waves=1.4, keep='wdKTqcm'):
        """a path that winds naturally from a to b"""
        L = math.hypot(b[0] - a[0], b[1] - a[1]); n = max(6, int(L / 1.1)); nx, nz = -(b[1] - a[1]) / (L or 1), (b[0] - a[0]) / (L or 1)
        ph, ph2 = self.r.uniform(0, 6.3), self.r.uniform(0, 6.3); pts = []
        for k in range(n + 1):
            t = k / n; env = math.sin(math.pi * t) ** .8
            o = env * (math.sin(t * waves * 2 * math.pi + ph) * amp + math.sin(t * waves * 5.1 + ph2) * amp * .25)
            pts.append([round(a[0] + (b[0] - a[0]) * t + nx * o, 2), round(a[1] + (b[1] - a[1]) * t + nz * o, 2)])
        self.line(pts, ch, width, keep); self.roads.append((pts, width)); return pts

    def drifts(self, n, size=(4, 7, 2.2, 3.6), box=None, keep_off=7, near=(2.5, 9), density=.75):
        """tall grass in drifts beside the paths"""
        x0, z0, x1, z1 = box or (2, 2, self.W - 2, self.H - 2); tries = 0; made = 0; spots = [tuple(self.hub)] + [tuple(e) for e in self.d.get('exits', [])]
        while made < n and tries < n * 80:
            tries += 1; cx, cz = self.r.uniform(x0, x1), self.r.uniform(z0, z1)
            if any(math.hypot(cx - a, cz - b) < keep_off for a, b in spots): continue
            if self.at(cx, cz) not in SOFT: continue
            if near and not (not self.near_road(cx, cz, near[0]) and self.near_road(cx, cz, near[1])): continue
            rx, rz = self.r.uniform(size[0], size[1]), self.r.uniform(size[2], size[3])
            self.grass(cx, cz, rx, rz, density, .5); made += 1
        return made

    def tint_ground(self, spec, seed=0):
        """soft natural patches of other ground: [(letter, threshold, scale, on)]"""
        for k, (ch, thr, sc, on) in enumerate(spec): self.patches(ch, thr, sc, on=on, seed=seed + k * 7 + 3)

    def belt(self, trees, side, depth, n, under=None, gap=.08):
        """trees thick along an edge (back, left, right), leaving the exits open"""
        W, H = self.W, self.H
        box = {'back': (-.5, H - depth, W + .5, H), 'left': (-.5, 0, depth, H), 'right': (W - depth, 0, W + .5, H), 'front': (-.5, -.3, W + .5, depth)}[side]
        ex = self.d.get('exits', [])
        old = self.clear[:]; self.clear += [(e[0], e[1], 4.5) for e in ex]
        self.scatter(trees, n, box, avoid=AV + 't', svar=.22, gap=gap, road=1.2, s0=1.05)
        if under: self.scatter(under, int(n * .8), box, avoid=AV + 't', svar=.25, gap=.05, road=.8)
        self.clear = old + [c for c in self.clear[len(old) + len(ex):]]

    def clearing(self, cx, cz, things, r=2.6):
        """a resting spot: a bench or a log by a path, maybe a campfire"""
        for k, dx, dz in things:
            x, z = cx + dx, cz + dz
            if self.free(x, z, radius(k) * .6, AV, .3, .1): self.put(k, x, z)
        self.clear.append((cx, cz, r))

    def ring(self, k, cx, cz, rad, n, s=1, a0=0):
        for j in range(n):
            a = a0 + j * 2 * math.pi / n; x, z = cx + math.cos(a) * rad, cz + math.sin(a) * rad * .8
            if self.free(x, z, .3, 'wd', None, .1): self.put(k, x, z, s)


def frange(a, b, st):
    v = a
    while v < b: yield v; v += st


CAT = {}
ROWFILL = {'house_red', 'house_green', 'house_blue', 'house_cottage', 'house_large', 'townhouse_red', 'townhouse_blue', 'townhouse_yellow', 'chalet', 'chalet_b', 'villa', 'apartment_a', 'apartment_b', 'apartment_c'}


def exits_for(s, D, i, hub, keep_roads=True, **kw):
    Dx = {'locations': D['locations'], 'roads': [L[:3] for L in D['roads']]}
    n0 = len(s.roads); ex = s.hub_exits(Dx, i, hub, road=None, **kw)
    if not keep_roads: del s.roads[n0:]
    return ex


def connect(s, e, ch='p', width=1.6, amp=1.2):
    """a way from the nearest street to an exit"""
    best, bd = None, 1e9
    for pts, w in s.roads:
        for a, b in zip(pts, pts[1:]):
            L = math.hypot(b[0] - a[0], b[1] - a[1]); n = max(1, int(L / 1.5))
            for k in range(n + 1):
                q = (a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n); d = math.hypot(q[0] - e[0], q[1] - e[1])
                if d < bd: bd, best = d, q
    if best is None or bd < 1.5: return None
    return s.wind([round(best[0], 2), round(best[1], 2)], e, ch, width, min(amp, bd * .08))


# ======================================================================================================== TOWNS
LEAFY = ['@tree_oak', '@tree_oak', '@tree_birch', 'tree_blossom', 'tree_maple', 'tree_chestnut', 'tree_beech']
TOWN_TREES = ['street_tree', 'tree_blossom', 'tree_maple', 'tree_birch', 'tree_oak_small']
UNDER = ['@fern', '@fern', '@bush_round', '@mushroom', 'stump', 'bush_berry', 'bracken']


def town_sundown(D, i, old):
    W, H = SIZE['marigold']; s = Place('marigold', 'Sundown', 'g', 4601, W, H); hub = (48, 18); s.setup(old, hub)
    s.d.update(folk=12)
    ex = exits_for(s, D, i, hub, keep_roads=False, lamps='streetlamp_b')
    # the square: cobbles round the fountain; the inn, the market hall and the bakery on its north side
    s.blob(48, 23, 12.5, 5.6, 'K', .1); s.clear.append((48, 23.6, 3.6))
    s.street([[2, 22], [24, 22.2], [48, 22], [72, 22.2], [W - 2, 22]], 'K', 2.6, 'streetlamp', 12)
    for x in (41.8, 54.4): s.street([[x, 27], [x, 40]], 'K', 2.0, None)
    s.street([[6, 40], [28, 40.2], [48, 40], [70, 40.2], [90, 40]], 'K', 2.4, 'streetlamp', 12)
    s.street([[48, 40], [48, 50]], 'K', 2.0, None); s.blob(52, 52, 7.4, 3.2, 'K', .06)
    s.street([[10, 56], [26, 56.2], [41, 56]], 'p', 1.6, None); s.street([[58, 55.6], [72, 56], [86, 56]], 'p', 1.6, None)
    s.street([[20, 40.2], [20, 56.2]], 'p', 1.4, None); s.street([[76, 40.2], [76, 56]], 'p', 1.4, None)
    s.put('fountain', 48, 24.6)
    for x, z in ((43, 20.4), (53, 20.4)): s.put('bench_wood', x, z)
    for x, z in ((38.5, 25.6), (57.5, 25.6)): s.put('planter_box', x, z)
    s.put('flag_pole', 52, 27.4)
    s.house('market_hall', 48, 29.6, 'shop', garden=False, label='Market')
    s.house('inn', 35.6, 29.6, 'house', garden=False, label='Inn')
    s.house('bakery', 59.6, 29.8, 'shop', garden=False, label='Bakery', say='The baker waves you in. It smells of cinnamon.')
    s.house('shop', 28.2, 24.8, 'shop', garden=False); s.house('clinic', 68.4, 24.8, 'clinic', garden=False)
    s.put('sign_shop', 24.8, 24.6, act='shop'); s.put('sign_clinic', 71.8, 24.4, act='clinic')
    s.house('house_cottage', 14.4, 25.2, 'home', label='Your house', v=0, fence=True)
    s.house('house_red', 19.8, 25, fence=False)
    s.row(24.8, 73.5, 93, ['house_blue', 'house_cottage', 'house_red', 'house_green'])
    s.row(31, 64, 92, ['house_large', 'house_green', 'house_cottage'])
    s.row(31, 4, 30, ['townhouse_red', 'house_blue', 'house_green'])
    s.row(42.6, 4, 18.4, ['house_large', 'house_red']); s.row(42.6, 22, 40, ['library', 'house_cottage'], acts={'library': 'house'})
    s.row(42.6, 56.5, 74.4, ['townhouse_yellow', 'house_green', 'house_blue']); s.row(42.6, 78, 93, ['house_red', 'house_cottage'])
    # the lab at the back, with room in front of its door (the opening scene is filmed there)
    lab = s.house('lab', 48, 55, 'lab', garden=False, v=0, say='Professor: Every billionaire you meet adds to your Index. Walk, battle and catch them all!')
    s.row(58.4, 8, 40, ['house_cottage', 'house_green', 'house_blue', 'house_cottage']); s.row(58.4, 60, 90, ['house_red', 'house_cottage', 'house_blue'])
    for e in ex: connect(s, e, 'p', 1.6)
    # a stream from the hills at the back, under the streets, into the duck pond
    s.stream([(9.2, H + .2), (10, 60), (11.4, 50), (10.2, 40), (9.4, 30), (8.8, 20), (9.4, 14)], 1.1, .5)
    s.pond(10, 10, 6.6, 3.6, ducks=4, reeds=14, lilies=7, dip=.7)
    s.bridges_over('stone')
    # countryside at the edges
    s.tint_ground([('G', .62, 8, 'g'), ('C', .66, 5, 'gG'), ('f', .73, 4.5, 'gGC'), ('u', .84, 4, 'gG')], 11)
    shoulders_v46(s)
    s.belt(LEAFY + ['@tree_pine'], 'back', 7, 40, UNDER)
    s.grove(88, 10, 6, 4, 8, LEAFY, under=UNDER); s.grove(66, 9, 5, 3, 6, ['tree_fruit', 'tree_fruit', 'tree_blossom'], floor='l', under=['beehive', '@flowers', '@flowers'])
    s.grove(28, 9, 5, 3, 6, LEAFY + ['tree_blossom'], under=UNDER)
    for cx, cz in ((80, 7), (40, 7), (92, 32), (3, 46)): s.grass(cx, cz, 4.4, 2.6, .75, .5)
    s.drift(['@flowers'], 40, 13, 5, 2, 12, avoid=AV); s.drift(['@flowers'], 58, 13, 5, 2, 12, avoid=AV); s.drift(['sunflowers', '@flowers'], 70, 63, 4, 1.6, 8, avoid=AV)
    s.scatter(['@rocks', '@bush_round', 'pebbles', 'puddle', '@fern', 'bush_berry'], 26, (0, 0, W, H), avoid=AV + 't', gap=.6)
    s.frame(['@bush_round', 'bush_berry', 'bush_flower', '@flowers', 'tree_oak_small'], 18)
    s.life('pigeon', 6, area=[38, 18, 58, 27]); s.life('chicken', 3, area=[2, 30, 8, 36])
    s.rolling(.35, 7); s.rise_back(46, 2.0)
    out = s.out(8, 'iron', 'K', bridge='stone')
    return out, {'lab': lab}


def town_farm(D, i, old):
    W, H = SIZE['clovercrest']; s = Place('clovercrest', old.get('name', 'Hillside Farm'), 'g', 4602, W, H); hub = (48, 16); s.setup(old, hub)
    ex = exits_for(s, D, i, hub, keep_roads=False, lamps=None)
    # the farmyard: packed earth round the well, the lane through it, the barn, the windmill and the shop on it
    s.blob(48, 19, 11, 5, 'u', .2); s.blob(48, 19, 5, 2.6, 'v', .2); s.clear.append((48, 19.6, 2.6))
    s.street([[2, 22], [24, 22.4], [48, 22], [72, 22.4], [W - 2, 22]], 'D', 2.2, 'lantern', 16)
    s.street([[48, 22], [48.4, 31], [48, 40]], 'u', 1.8, None)
    s.street([[8, 40], [30, 40.4], [48, 40], [66, 40.4], [88, 40]], 'u', 1.8, 'lantern', 18)
    s.put('well', 48, 20.4); s.put('flag_pole', 54, 18)
    s.house('barn', 36.4, 25, 'house', garden=False, label='Barn', lawn=None); s.house('windmill', 60.6, 26, None, garden=False, lawn=None)
    s.house('shop', 26, 24.8, 'shop', garden=False); s.house('clinic', 70.6, 24.8, 'clinic', garden=False)
    s.put('market_cart', 43.4, 24.4, act='talk', say='Farmer: “Carrots! Fresher than any billionaire’s smile.”')
    s.row(24.8, 4, 20, ['house_cottage', 'house_red'], fence=True); s.row(24.8, 76, 93, ['house_red', 'house_cottage'], fence=True)
    s.house('greenhouse', 62, 42.6, 'house', garden=False, label='Greenhouse')
    s.row(42.6, 6, 44, ['house_cottage', 'house_large', 'house_green', 'house_cottage'], fence=True); s.row(42.6, 70, 92, ['house_red', 'house_cottage'], fence=True)
    for e in ex: connect(s, e, 'D', 1.8)
    # a brook between the yard and the upper lane, under little bridges
    s.stream([(-.4, 34), (16, 33.4), (34, 34.6), (52, 33.6), (70, 34.4), (W + .4, 33.6)], 1.0, .4)
    s.bridges_over('wood')
    # fields: soil in rows with crops behind fences, clover meadows between, hay by the barn
    for (x0, z0, x1, z1) in ((6, 50, 28, 63), (34, 50, 60, 63), (66, 50, 90, 63), (70, 4, 90, 13)):
        s.rect(x0, z0, x1, z1, 'o')
        for z in frange(z0 + .8, z1 - .4, 1.6):
            for x in frange(x0 + .8, x1 - .6, 1.5):
                if s.r.random() < .85: s.put('crops', x + s.r.uniform(-.1, .1), z, s.r.uniform(.85, 1.05), s.r.random() < .5, block=False)
        s.put('scarecrow', (x0 + x1) / 2 + s.r.uniform(-4, 4), (z0 + z1) / 2)
        for x in frange(x0 - .5, x1 + .5, 2.2):
            if s.free(x, z0 - .7, .3, 'wd', .4, .02): s.put('fence_wood', x, z0 - .7)
    s.tint_ground([('C', .55, 6, 'g'), ('G', .62, 8, 'gC'), ('D', .8, 4, 'gC'), ('f', .75, 4, 'gGC')], 21)
    for x, z in ((30, 29.6), (32.4, 30.6), (42, 30), (80, 30)): s.put(s.r.choice(['haybale', 'haybale_stack', 'haybale']), x, z)
    s.pond(16, 10, 5.4, 3, ducks=4, reeds=10, lilies=4)
    s.put('beehive', 86, 31); s.put('beehive', 88, 31.6); s.put('wheelbarrow', 40, 19); s.put('cart', 56, 21)
    s.grove(86, 30, 5, 2.6, 6, ['tree_fruit', 'tree_fruit_b'], floor='C', under=['@flowers'])
    s.grove(28, 9, 6, 3, 7, ['tree_fruit', 'tree_fruit_b', 'tree_blossom'], floor='C', under=['@flowers', 'beehive'])
    s.place_lamps()
    s.belt(['tree_fruit', '@tree_oak', 'tree_poplar', 'tree_poplar_autumn'], 'back', 5, 20)
    for cx, cz in ((6, 30), (90, 46), (58, 7), (40, 7)): s.grass(cx, cz, 4.6, 2.6, .7, .5)
    s.frame(['@bush_round', 'haybale', '@flowers', 'bush_berry', 'wild_wheat'], 14)
    s.scatter(['@rocks', 'sunflowers', 'wild_wheat', 'puddle', 'molehill'], 20, (0, 0, W, H), avoid=AV + 'to', gap=.6)
    s.life('chicken', 6, area=[38, 16, 58, 22])
    s.rolling(.6, 9); s.rise_back(44, 2.4)
    return s.out(8, None, 'u'), {}


def town_grotto(D, i, old):
    W, H = SIZE['fizzwell']; s = Place('fizzwell', old.get('name', 'Bubbling Grotto'), 'k', 4603, W, H); hub = (40, 14); s.setup(old, hub)
    ex = exits_for(s, D, i, hub, keep_roads=False, lamps='lantern')
    # the cave walls high all round the back and sides; a crystal-floored hall in the middle
    s.terrace(-1, 50, W + 1, H + 1, 4.5, wall=False, mat=3); s.terrace(-1, -1, 6, H + 1, 3.6, wall=False, mat=3); s.terrace(W - 6, -1, W + 1, H + 1, 3.6, wall=False, mat=3)
    s.blob(40, 22, 17, 10, 'X', .2); s.blob(40, 18, 7, 3.6, 'q', .12); s.clear.append((40, 18.6, 2.6))
    s.street([[10, 22], [26, 22.6], [40, 22], [54, 22.6], [70, 22]], 'v', 2.0, 'lantern', 9)
    s.street([[14, 36], [40, 36.6], [66, 36]], 'v', 1.8, 'lantern', 9); s.street([[30, 22.4], [30, 36.4]], 'v', 1.6, None); s.street([[52, 22.4], [52, 36.4]], 'v', 1.6, None)
    s.put('well', 40, 19)
    s.house('cave_house', 22, 24.6, 'house', garden=False, lawn=None); s.house('cave_house', 58, 24.6, 'clinic', garden=False, label='Clinic', lawn=None)
    s.house('tent', 40.6, 25, 'shop', garden=False, label='Supply Co.', lawn=None); s.house('inn', 40.6, 38.6, 'house', garden=False, label='Inn', lawn=None)
    s.row(38.6, 12, 34, ['cave_house', 'cave_house'], garden=False, lawn=None); s.row(38.6, 48, 70, ['cave_house', 'cave_house'], garden=False, lawn=None)
    for e in ex: connect(s, e, 'v', 1.6)
    # hot springs: steaming pools with pebble rims
    for cx, cz, rx, rz in ((18, 12, 4.2, 2.6), (62, 12, 3.6, 2.2), (66, 44, 3, 2)):
        s.blob(cx, cz, rx + 1, rz + .8, 'P', .2); s.blob(cx, cz, rx, rz, 'w', .2)
        for _ in range(3): s.put('steam_vent', cx + s.r.uniform(-rx * .6, rx * .6), cz + s.r.uniform(-rz * .5, rz * .5), block=False)
    s.place_lamps()
    for _ in range(40):
        x, z = s.r.uniform(7, W - 7), s.r.uniform(4, 49)
        if s.free(x, z, .5, AV, .8, .3): s.put(s.r.choice(['crystal', 'crystal_pink', 'crystal_purple', 'stalagmite', 'stalagmite_b', 'crystal']), x, z, s.r.uniform(.8, 1.3), s.r.random() < .5)
    s.tint_ground([('M', .66, 4, 'k'), ('P', .74, 3.5, 'k')], 31)
    s.scatter(['@mushroom', 'mushroom_blue', 'mushroom_giant', 'rocks', 'boulder', 'moss_patch'], 34, (6, 3, W - 6, 50), avoid=AV + 'X', gap=.5)
    s.rolling(.3, 6)
    return s.out(3, None, 'v'), {}


def town_food(D, i, old):
    W, H = SIZE['pepperpot']; s = Place('pepperpot', old.get('name', 'The Food Court'), 'g', 4604, W, H); hub = (40, 14); s.setup(old, hub)
    ex = exits_for(s, D, i, hub, keep_roads=False, lamps='streetlamp_b')
    s.blob(40, 22, 19, 8, 'h', .06); s.blob(40, 22, 8, 3.6, 'q', .06); s.clear.append((40, 22.4, 3.2))
    s.street([[3, 32], [40, 32.4], [W - 3, 32]], 'K', 2.4, 'streetlamp', 12)
    s.street([[28, 32.4], [28, 46]], 'K', 1.8, None); s.street([[52, 32.4], [52, 46]], 'K', 1.8, None); s.street([[8, 46], [40, 46.4], [72, 46]], 'K', 2.0, 'streetlamp', 12)
    s.put('fountain', 40, 23)
    s.house('market_hall', 40, 35, 'shop', garden=False, label='Market Hall')
    s.house('shop_boutique', 21, 34.8, 'shop', garden=False, label='Personal Best Sports', shop='sports')
    s.house('shop_cafe', 59, 34.8, 'talk', garden=False, say='Café: “Our coffee is fair trade. Our prices are not.”')
    s.house('clinic', 67, 34.8, 'clinic', garden=False); s.house('bakery', 13, 34.8, 'shop', garden=False, label='Bakery')
    s.put('pretzel', 56, 25, act='shop', label='Pretzel Pavilion')
    for x, z, k in ((25, 20, 'food_truck'), (27, 26.4, 'stall'), (53, 19.4, 'market_cart'), (31, 16.6, 'stall'), (49, 16.4, 'market_cart')):
        s.put(k, x, z, act='talk', say={'food_truck': 'Food truck: “Billionaire burgers! (No billionaires were harmed.)”', 'stall': 'Stall: “Fresh juice, freshly priced.”', 'market_cart': 'Cart: “Get your hot chestnuts!”'}[k])
    for x in (33, 36.4, 43.6, 47):
        for z in (19.4, 26.4): s.put(s.r.choice(['cafe_table', 'cafe_table', 'picnic']), x + s.r.uniform(-.3, .3), z)
    s.row(48.6, 4, 26, ['house_blue', 'house_large', 'townhouse_red']); s.row(48.6, 30, 50, ['house_green', 'house_cottage']); s.row(48.6, 54, 77, ['townhouse_yellow', 'house_red', 'house_blue'])
    for e in ex: connect(s, e, 'h', 2.0)
    s.place_lamps()
    s.tint_ground([('C', .66, 6, 'g'), ('f', .72, 4.5, 'gC')], 41)
    s.belt(TOWN_TREES + LEAFY, 'back', 5, 22, UNDER); s.belt(LEAFY, 'left', 4, 10); s.belt(LEAFY, 'right', 4, 10)
    for cx, cz in ((10, 8), (70, 8)): s.grass(cx, cz, 4.4, 2.4, .7, .5)
    s.frame(['planter_box', '@bush_round', 'bush_flower', 'bench_wood'], 10)
    s.scatter(['planter', 'planter_round', 'bin', 'bench_metal', 'bollard'], 18, (14, 12, 66, 30), avoid='wd', gap=.9)
    s.life('pigeon', 8, area=[24, 16, 56, 28])
    s.rolling(.25, 8); s.rise_back(42, 1.4)
    return s.out(8, 'iron', 'K'), {}


def town_mall(D, i, old):
    W, H = SIZE['lanternhall']; s = Place('lanternhall', old.get('name', 'Mall of the Deep'), 'm', 4605, W, H); hub = (40, 12); s.setup(old, hub)
    ex = exits_for(s, D, i, hub, keep_roads=False, signs=True)
    # two floors: the ground-floor concourse and the mezzanine up the escalators, shopfronts along both
    s.terrace(2, 36, W - 2, H + 1, 2.0, wall=False, wobble=0)
    s.blob(40, 20, 30, 9, 'T', .03); s.blob(40, 46, 32, 6, 'T', .03); s.clear.append((40, 19, 3.6))
    for x in (12, 68): s.road((x, 26), (x, 42), 'T', 2.2, amp=0)
    s.put('fountain', 40, 19.6)
    s.row(30.6, 16, 64, ['shop', 'library', 'shop_cafe', 'clinic', 'bakery'], acts={'shop': 'shop', 'clinic': 'clinic', 'shop_cafe': 'talk', 'library': 'house', 'bakery': 'shop'},
          garden=False, lawn=None, gap=(.6, 1.2))
    for p in s.props:
        if p['k'] == 'shop': p['label'] = 'Concierge Desk'
        if p['k'] == 'shop_cafe': p['say'] = 'Café: “Espresso, aged 18 years.”'
    s.house('shop_boutique', 40, 49.6, 'shop', garden=False, label='Maison Margin', shop='designer', lawn=None)
    s.house('shop_mart', 22, 49.8, 'talk', garden=False, say='Mall Mart: “Aisle 400: Bigger Aisles.”', lawn=None)
    s.house('bank', 58, 49.8, 'house', garden=False, label='Savings & Loan', lawn=None)
    s.row(49.8, 4, 15, ['shop_cafe'], acts={'shop_cafe': 'talk'}, garden=False, lawn=None); s.row(49.8, 65, 76, ['shop_boutique'], acts={'shop_boutique': 'talk'}, garden=False, lawn=None)
    s.put('kioskP', 40, 26.4, act='talk', say='Kiosk: “Try our new scented air. Only 9.99!”')
    for e in ex: connect(s, e, 'T', 2.2)
    for x, z in ((26, 14), (54, 14), (26, 23), (54, 23), (14, 18), (66, 18)): s.put('planter', x, z)
    for x, z in ((33, 11), (47, 11), (30, 44), (50, 44)): s.put('bench', x, z)
    for x, z in ((8, 10), (72, 10), (70, 24), (10, 24)): s.put('salesign', x, z)
    s.put('cartS', 56, 11); s.put('vending', 74, 30); s.put('vending', 6, 30); s.put('stall', 8, 17)
    for x, z in ((18, 9), (62, 9), (18, 25), (62, 25), (28, 42), (52, 42), (16, 44), (64, 44)): s.put('lamp', x, z)
    s.scatter(['planter', 'bench', 'trash', 'salesign', 'cartS', 'planter_round', 'plant_tall'], 24, (2, 2, W - 2, H - 2), avoid='cw', gap=.9)
    def escalators():
        for f in s.stairs:
            if 'a' in f and f['w'] >= 1.5: s.d.setdefault('escalators', []).append({'a': f['a'], 'b': f['b'], 'w': f['w']})
    s.after_stairs = [escalators]
    return s.out(10), {}


def town_city(D, i, old):
    W, H = SIZE['verdigris']; s = Place('verdigris', old.get('name', 'Capital Gains'), 'g', 4606, W, H); hub = (64, 22); s.setup(old, hub)
    ex = exits_for(s, D, i, hub, keep_roads=False, lamps='streetlamp_b')
    # avenues (asphalt with pavements) in a grid, a plaza at the front with the coin statue, a canal along the front
    s.blob(64, 24, 15, 5, 'T', .05); s.clear.append((64, 24.6, 3.4))
    AV_X = (18, 46, 82, 110)
    for z in (30, 50, 70):
        s.line([[1, z], [W - 1, z]], 'q', 2.4, keep='wd'); s.street([[1, z], [W - 1, z]], 'a', 2.6, 'streetlamp_b', 13)
    for x in AV_X:
        s.line([[x, 30], [x, 86]], 'q', 2.0, keep='wd'); s.street([[x, 30], [x, 86]], 'a', 2.4, None)
    s.street([[64, 24], [64, 30]], 'T', 2.4, None)
    s.stream([(-.4, 10), (40, 10.4), (88, 10.2), (W + .4, 10)], 2.6, .25, banks='q')
    s.put('statue_coin' if 'statue_coin' in CAT else 'statue', 64, 25.6); s.put('flag_pole', 72, 27.6)
    blocks = [(32.4, ['city_hall', 'bank', 'shop_mart', 'clinic', 'library', 'shop_boutique', 'shop_cafe', 'station', 'townhouse_blue']),
              (52.4, ['school', 'apartment_a', 'townhouse_blue', 'fire_station', 'apartment_b', 'office_tower', 'townhouse_red', 'apartment_c']),
              (72.4, ['apartment_c', 'townhouse_yellow', 'apartment_b', 'house_large', 'apartment_a', 'townhouse_blue', 'mansion', 'townhouse_red'])]
    acts = {'city_hall': 'talk', 'office_tower': 'talk', 'shop_mart': 'shop', 'clinic': 'clinic', 'shop_boutique': 'shop', 'shop_cafe': 'talk'}
    lab = {'shop_mart': dict(label='Capital Mart', shop='capital'), 'shop_boutique': dict(label='Capital Outlet', shop='outlet'), 'bank': dict(label='Savings & Loan'),
           'station': dict(label='Station'), 'library': dict(label='Library'), 'school': dict(label='School'), 'fire_station': dict(label='Fire Station')}
    say = {'city_hall': 'City Hall: “The mayor is in a meeting about meetings.”', 'office_tower': 'Reception: “Floors 1 to 40 are all the same company.”', 'shop_cafe': 'Café: “Flat white, flat rate.”'}
    fill = {32.4: ['townhouse_blue', 'townhouse_red', 'shop_cafe', 'townhouse_yellow'], 52.4: ['apartment_a', 'townhouse_blue', 'apartment_b', 'townhouse_red', 'apartment_c'],
            72.4: ['townhouse_yellow', 'apartment_b', 'house_large', 'townhouse_blue', 'apartment_c', 'townhouse_red']}
    edges = [1.5] + [v for ax in AV_X for v in (ax - 2.4, ax + 2.4)] + [W - 1.5]
    for z, keys in blocks:
        segs = [(edges[k], edges[k + 1]) for k in range(0, len(edges), 2)]
        if z < 40: segs = [q for sg in segs for q in ([(sg[0], 60.5), (67.5, sg[1])] if sg[0] < 64 < sg[1] else [sg])]
        specials = list(keys)
        for x0, x1 in segs:
            x = x0 + .3
            while x < x1 - 2:
                k = specials[0] if specials else s.r.choice(fill[z]); w = meta(k).get('box', [4, 3])[0]
                if x + w > x1:
                    if specials: break
                    k = next((q for q in fill[z] if x + meta(q).get('box', [4, 3])[0] <= x1), None)
                    if not k: break
                    w = meta(k).get('box', [4, 3])[0]
                p = s.house(k, x + w / 2, z, acts.get(k, 'house'), garden=False, lawn=None, say=say.get(k), **lab.get(k, {}))
                if p:
                    if specials and k == specials[0]: specials.pop(0)
                    x += w + s.r.uniform(.4, 1.1)
                else: x += 1.0
    for e in ex: connect(s, e, 'q', 2.2)
    s.bridges_over('stone')
    s.put('food_truck', 52, 22, act='talk', say='Food truck: “Lunch for the 1%: one per cent off.”')
    for x, z in ((58, 20.6), (70, 20.6)): s.put('bench_metal', x, z)
    for x in (46, 82): s.put('traffic_light', x - 2.4, 28.2)
    s.place_lamps()
    for x in range(5, W - 4, 8):
        for z in (27.4, 47.6, 67.6):
            if s.free(x, z, .4, 'wd', .3, .3): s.put('street_tree', x + s.r.uniform(-.4, .4), z)
    s.tint_ground([('l', .55, 8, 'g'), ('C', .7, 5, 'gl')], 51)
    s.belt(TOWN_TREES + LEAFY, 'back', 7, 34, UNDER); s.grove(16, 19, 8, 4, 10, LEAFY, floor='l', under=['@flowers', 'bench_wood'])
    s.grove(112, 19, 8, 4, 10, LEAFY, floor='l', under=['@flowers'])
    for cx, cz in ((10, 4), (118, 4)): s.grass(cx, cz, 5, 2.2, .7, .5)
    s.scatter(['bin', 'bench_metal', 'hydrant', 'bollard', 'phone_booth', 'mailbox_blue', 'newsstand', 'bike_rack'], 30, (2, 14, W - 2, H - 10), avoid='wd', gap=.9)
    s.life('pigeon', 8, area=[50, 20, 78, 28])
    s.rolling(.2, 10); s.rise_back(80, 1.6)
    return s.out(8, 'iron', 'q', bridge='stone'), {}


def town_taxhaven(D, i, old):
    W, H = SIZE['palmhaven']; s = Place('palmhaven', old.get('name', 'Tax Haven'), 's', 4607, W, H); hub = (48, 22); s.setup(old, hub)
    ex = exits_for(s, D, i, hub, keep_roads=False, lamps='streetlamp_b')
    # the sea along the front, wet sand, a marble promenade, the harbour square, villas and mansions up the slope
    s.rect(0, 0, W, 8, 'd'); s.blob(48, 8.6, 60, 3.6, 'w', .3); s.blob(48, 12, 60, 2.6, 'S', .35)
    s.street([[2, 17], [48, 17.4], [W - 2, 17]], 'T', 2.6, 'streetlamp_b', 10)
    s.blob(48, 25, 13, 5, 'T', .05); s.clear.append((48, 25.6, 3.2))
    s.street([[6, 33], [48, 33.4], [90, 33]], 'T', 2.2, 'streetlamp_b', 12); s.street([[12, 50], [48, 50.4], [84, 50]], 'q', 1.8, 'streetlamp_b', 14)
    s.street([[36, 33.4], [36, 50.4]], 'T', 1.6, None); s.street([[60, 33.4], [60, 50.4]], 'T', 1.6, None)
    s.put('fountain', 48, 26); s.put('flag_pole', 56, 29)
    s.house('city_hall', 48, 35.6, 'talk', garden=False, say='Harbour Office: “Your money is safe here. Mostly from you.”', lawn=None)
    s.house('shop', 66, 35.4, 'shop', garden=False); s.house('clinic', 73, 35.4, 'clinic', garden=False); s.house('bank', 27, 35.6, 'house', garden=False, label='Offshore Bank')
    s.row(35.4, 4, 22, ['villa', 'villa'], fence=False); s.row(35.4, 78, 93, ['villa', 'villa'], fence=False)
    s.row(52.6, 4, 33, ['mansion', 'villa', 'villa'], fence=False); s.row(52.6, 40, 57, ['villa', 'villa'], fence=False); s.row(52.6, 63, 93, ['villa', 'mansion', 'villa'], fence=False)
    s.house('lighthouse', 88, 11.4, None, garden=False, lawn=None)
    for e in ex: connect(s, e, 'T', 2.0)
    s.place_lamps()
    for x in frange(4, W - 4, 6.5):
        if s.free(x, 19.8, .5, 'wd', .3, .3): s.put(s.r.choice(['palm_tree', 'palm_tree_b']), x + s.r.uniform(-1, 1), 19.8)
    for x in frange(8, W - 8, 8):
        if s.free(x, 12.2, .4, 'wd', .3, .3): s.put(s.r.choice(['beach_umbrella', 'deck_chair', 'beach_umbrella']), x + s.r.uniform(-1.5, 1.5), 12.2 + s.r.uniform(-.6, .6))
    for x in (20, 34, 62, 76): s.put('sailboat', x, 3 + s.r.uniform(0, 2), block=False)
    s.line([[44, 10.6], [44, 4]], 'b', 1.4); s.put('dock_post', 43, 4.2); s.put('dock_post', 45, 4.2); s.put('rowboat', 47, 5, block=False)
    s.tint_ground([('l', .5, 7, 's'), ('P', .78, 3, 'sS')], 61)
    s.belt(['@palm_tree', 'tree_cypress', 'tree_olive'], 'back', 6, 24, ['bush_rosemary', 'lavender', '@flowers'])
    s.scatter(['hedge', 'tree_cypress', 'planter_round', 'lavender', 'bush_box', 'tree_olive'], 30, (2, 28, W - 2, H - 8), avoid=AV, gap=.6)
    s.life('gull', 4); s.life('crab', 3)
    s.rolling(.25, 9); s.rise_back(26, 3.6)
    return s.out(8, 'iron', 'T'), {}


def town_summit(D, i, old):
    W, H = SIZE['frostcrown']; s = Place('frostcrown', old.get('name', 'Summit Capital'), 'n', 4608, W, H); hub = (48, 16); s.setup(old, hub)
    ex = exits_for(s, D, i, hub, keep_roads=False, lamps='lantern_b')
    s.blob(48, 20, 12, 5, 'q', .1); s.clear.append((48, 20.6, 3.0))
    s.street([[4, 23], [48, 23.4], [92, 23]], 'q', 2.4, 'lantern_b', 11); s.street([[10, 40], [48, 40.4], [86, 40]], 'v', 1.8, 'lantern_b', 12)
    s.street([[30, 23.4], [30, 40.4]], 'v', 1.6, None); s.street([[66, 23.4], [66, 40.4]], 'v', 1.6, None)
    s.terrace(-1, 50, W + 1, H + 1, 2.4, wall=False)
    s.street([[48, 40.4], [48, 52], [48, 58]], 'v', 1.6, None)
    s.put('statue', 48, 21.4); s.put('flag_pole', 55, 18.6)
    s.house('ski_lodge', 48, 26, 'house', garden=False, label='Ski Lodge'); s.house('inn', 38, 25.8, 'house', garden=False, label='Inn')
    s.house('shop', 58.6, 25.6, 'shop', garden=False); s.house('clinic', 74, 25.6, 'clinic', garden=False)
    s.house('city_hall', 20, 26, 'talk', garden=False, say='Town Hall: “The mountain is closed for tax reasons.”')
    s.row(25.6, 78, 93, ['chalet', 'chalet_b'], lawn='n'); s.row(25.6, 3, 14, ['chalet_b'], lawn='n')
    s.row(42.6, 4, 28, ['chalet', 'chalet_b', 'chalet'], lawn='n'); s.row(42.6, 33, 46, ['chalet_b', 'chalet'], lawn='n')
    s.row(42.6, 50.5, 64, ['chalet', 'chalet_b'], lawn='n'); s.row(42.6, 68, 93, ['chalet_b', 'chalet', 'chalet_b'], lawn='n')
    s.row(54, 8, 40, ['chalet', 'chalet_b', 'chalet'], lawn='n'); s.row(54, 56, 88, ['chalet_b', 'chalet', 'chalet_b'], lawn='n')
    for e in ex: connect(s, e, 'v', 1.8)
    s.place_lamps()
    s.blob(20, 10, 6, 3, 'I', .2); s.put('snowman', 27, 12.6, act='talk', say='The snowman says nothing. It’s a snowman.'); s.blob(76, 10, 5, 2.6, 'I', .2)
    s.tint_ground([('r', .8, 4, 'n'), ('I', .86, 4, 'n')], 71)
    s.belt(['tree_pine_snow', 'tree_pine_snow_b', 'tree_pine_snow_small'], 'back', 9, 40, ['rocks_snow', 'boulder_snow'])
    s.grove(8, 32, 5, 5, 8, ['tree_pine_snow', 'tree_pine_snow_b']); s.grove(90, 33, 5, 5, 8, ['tree_pine_snow', 'tree_pine_snow_small'])
    s.scatter(['rocks_snow', 'boulder_snow', 'firewood', 'ski_sign', 'snowman'], 18, (2, 2, W - 2, H - 2), avoid=AV, gap=.7)
    for cx, cz in ((10, 6), (86, 6)): s.grass(cx, cz, 4, 2.2, .6, .5)
    s.put('ladder', 74, 49.6, act='climb', label='Ladder')
    s.rolling(.4, 9)
    return s.out(8, 'wood', 'q'), {}


# ======================================================================================================= ROUTES
def route_base(sid, D, i, old, base, seed, hub=(56, 14), path='p', amp=3.2, width=1.3):
    W, H = ROUTE_SIZE; s = Place(sid, old.get('name', sid), base, seed, W, H); s.setup(old, list(hub))
    ex = exits_for(s, D, i, hub, keep_roads=False, lamps=None)
    for e in ex: s.wind(list(hub), e, path, width, amp, s.r.uniform(1.0, 1.8))
    s.clear.append((hub[0], hub[1], 2.4))
    return s, ex


def route_grass(D, i, old):
    s, ex = route_base('tallgrass_meadow', D, i, old, 'g', 4611)
    s.tint_ground([('G', .58, 9, 'g'), ('C', .62, 6, 'gG'), ('f', .74, 4.5, 'gGC'), ('u', .84, 4, 'gG')], 3)
    s.drifts(11, (5, 9, 2.6, 4.2), density=.8)
    s.clearing(44, 22, [('bench_wood', 0, 0), ('campfire', 2.4, .8), ('log', -2.2, 1.4), ('firewood', 3.8, 1.8)])
    s.put('mailbox', 60, 12.6); s.put('billboard', 88, 26)
    for x in frange(8, 20, 2.2): s.put('fence_wood', x, 30)
    s.grove(14, 52, 9, 5, 14, LEAFY, under=UNDER); s.grove(96, 50, 8, 5, 12, ['@tree_pine', '@tree_birch', '@tree_oak'], under=UNDER)
    s.grove(70, 44, 5, 3, 6, LEAFY); s.grove(30, 40, 4, 3, 5, ['tree_birch', 'tree_birch_b'])
    s.belt(LEAFY + ['@tree_pine'], 'back', 6, 30, UNDER)
    s.drift(['@flowers', 'buttercups', 'daisies', 'cornflowers'], 40, 12, 6, 2.2, 16, avoid=AV + 't'); s.drift(['@flowers', 'poppies'], 74, 18, 6, 2.2, 14, avoid=AV + 't')
    s.scatter(['@rocks', 'stump', '@bush_round', 'log', '@mushroom', 'rock_flat', '@fern', 'pebbles', 'molehill'], 30, (0, 0, 112, 50), avoid=AV + 't', gap=.6)
    s.frame(['@bush_round', 'bush_berry', '@flowers', '@rocks'], 14)
    s.rolling(.9, 7); s.hill(30, 30, 9, 1.6); s.hill(84, 34, 10, 1.8); s.rise_back(44, 2)
    return s.out(7, 'wood'), {}


def route_golf(D, i, old):
    s, ex = route_base('old_fairway', D, i, old, 'G', 4612, path='v')
    for cx, cz, rx, rz in ((36, 30, 16, 6), (82, 36, 14, 6), (58, 50, 12, 4)): s.blob(cx, cz, rx, rz, 'l', .14)
    bunkers = ((30, 33, 2.6, 1.4), (44, 27, 2, 1.1), (88, 39, 2.2, 1.2), (76, 33, 1.8, 1), (60, 52, 2, 1))
    for cx, cz, rx, rz in bunkers: s.blob(cx, cz, rx, rz, 's', .15)
    for cx, cz, rx, rz in bunkers:
        for j in range(int((cz - rz - 1) * 2), int((cz + rz + 1) * 2)):
            for i2 in range(int((cx - rx - 1) * 2), int((cx + rx + 1) * 2)):
                x, z = (i2 + .5) / 2, (j + .5) / 2
                if 0 <= j < 2 * s.H and 0 <= i2 < 2 * s.W and ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 < .8 and s.at(x, z) == 's': s.st[j][i2] -= .3; s.wm[j][i2] = 2
    s.tint_ground([('L', .62, 5, 'G'), ('u', .78, 3.5, 'G'), ('C', .7, 5, 'Gl')], 13)
    s.pond(96, 16, 6, 3.4, ducks=4, reeds=14, lilies=6)
    for x, z in ((24, 34), (90, 40), (56, 52)): s.put('flag', x, z)
    s.put('cart', 52, 22); s.put('bench_wood', 64, 20); s.put('busstop', 18, 12)
    s.drifts(9, (5, 8, 2.4, 3.6))
    s.grove(10, 46, 7, 5, 12, ['tree_beech', 'tree_oak_autumn', 'tree_maple', 'tree_chestnut'], floor='L', under=UNDER)
    s.grove(104, 48, 6, 6, 10, ['tree_beech_autumn', 'tree_oak', 'tree_birch'], floor='L', under=UNDER)
    s.belt(['tree_beech', 'tree_oak_autumn', '@tree_oak', 'tree_maple'], 'back', 6, 26, UNDER)
    s.scatter(['tree_oak_small', 'tree_beech', 'tree_maple'], 8, (14, 18, 100, 46), avoid=AV + 'tls', gap=1.5)
    s.scatter(['fallen_leaves', '@rocks', 'stump', '@mushroom', '@bush_round'], 26, (0, 0, 112, 58), avoid=AV + 'tls', gap=.6)
    s.life('duck', 4); s.life('squirrel', 2)
    s.rolling(.7, 8); s.hill(36, 30, 12, 1.2); s.hill(82, 36, 10, 1.1)
    return s.out(7, 'wood'), {}


def route_thicket(D, i, old):
    s, ex = route_base('thicket', D, i, old, 'y', 4613, path='u', amp=3.6, width=1.2)
    s.tint_ground([('M', .55, 5, 'y'), ('L', .6, 6, 'yM'), ('G', .75, 6, 'y')], 23)
    s.stream([(30, s.H + .2), (32, 52), (36, 40), (44, 32), (52, 26), (70, 20), (90, 12), (s.W + .2, 6)], 1.2, .5, banks='M')
    s.bridges_over('wood')
    for cx, cz, rx, rz, n in ((16, 40, 10, 8, 24), (90, 44, 12, 8, 26), (66, 46, 6, 5, 12), (16, 14, 6, 4, 9), (100, 22, 6, 4, 9)):
        s.grove(cx, cz, rx, rz, n, ['tree_oak_deep', 'tree_pine_deep', 'tree_birch_deep', 'tree_oak_b_deep', 'tree_hazel', '@tree_oak'], floor=None, under=UNDER, gap=.05)
    # the mushroom glade: a ring of mushrooms in a mossy clearing, a ledge with a ladder above it
    s.blob(60, 34, 5, 3.4, 'M', .2); s.ring('mushroom_ring', 60, 34, 3.2, 1); s.put('mushroom_giant', 64, 36.4); s.put('mushroom_giant', 56.4, 35.6, .8)
    s.ring('mushroom', 60, 34, 4.2, 7, .9)
    s.terrace(70, 46, 100, 65, 1.9, wall=False, wobble=.3)
    s.drifts(10, (4, 7, 2.2, 3.4), density=.7)
    s.scatter(['@fern', 'bracken', 'log_mossy', 'stump_mossy', '@mushroom', 'boulder_mossy', 'rocks_mossy', 'fallen_leaves', 'tree_fallen'], 50, (0, 0, 112, 64), avoid=AV + 't', gap=.4)
    s.belt(['tree_pine_deep', 'tree_oak_deep', 'tree_birch_deep'], 'back', 6, 34, UNDER)
    s.rolling(.8, 6); s.hill(20, 40, 10, 1.4)
    return s.out(7, 'wood'), {}


def route_canyon(D, i, old):
    s, ex = route_base('stepstone_canyon', D, i, old, 's', 4614, path='v', amp=2.6)
    s.tint_ground([('r', .55, 7, 's'), ('P', .72, 3.5, 'sr'), ('v', .82, 4, 's')], 33)
    # terraces of red rock rising to the back, a dry riverbed of pebbles across the middle
    s.terrace(-1, 40, 44, 65, 2.4, wall=False, mat=1); s.terrace(70, 36, s.W + 1, 65, 2.8, wall=False, mat=1); s.terrace(44, 54, 70, 65, 2.0, wall=False, mat=1)
    s.line([[-1, 26], [30, 24], [58, 28], [84, 24], [s.W + 1, 22]], 'P', 3.4, keep='pv')
    s.put('ladder', 30, 39.6, act='climb', label='Ladder'); s.put('ladder', 92, 35.6, act='climb', label='Ladder')
    s.drifts(8, (4, 6, 2, 3), density=.6)
    s.scatter(['@cactus', 'cactus_tall', 'cactus_round', 'dry_bush', 'dry_grass', 'mesa', '@rocks', 'boulder'], 50, (0, 0, 112, 64), avoid=AV + 't', gap=.7)
    s.arch(56, 44, 3.2, 1.2, 3.4, 'z', 'rock')
    s.rolling(.5, 9)
    return s.out(7, 'wood', None, 'wood', 'rope'), {}


def route_scrap(D, i, old):
    s, ex = route_base('rustgear', D, i, old, 'x', 4615, path='a', amp=2.2, width=1.6)
    s.tint_ground([('a', .62, 7, 'x'), ('D', .75, 4, 'x'), ('v', .72, 5, 'x')], 43)
    for cx, cz in ((20, 40), (36, 48), (80, 44), (96, 30), (60, 52)):
        for _ in range(9):
            x, z = cx + s.r.gauss(0, 3.4), cz + s.r.gauss(0, 2)
            if s.free(x, z, .7, AV, .8, .1): s.put(s.r.choice(['scrap', 'tires', 'crate_stack', 'barrels', 'pipe', 'crates']), x, z, s.r.uniform(.85, 1.2), s.r.random() < .5)
    s.house('barn', 70, 30, 'house', garden=False, lawn=None, label='Warehouse')
    s.put('derrick', 46, 34); s.put('bunker', 90, 50)
    for _ in range(14):
        x, z = s.r.uniform(4, 108), s.r.uniform(4, 58)
        if s.at(x, z) in 'axD' and s.free(x, z, .4, 'wd', .2, .2): s.put('puddle', x, z, block=False)
    s.drifts(8, (4, 6, 2, 3), density=.65)
    for x in frange(4, 108, 2.4):
        if s.free(x, 61.6, .3, 'wd', .5, .02): s.put('fence', x, 61.6)
    s.scatter(['dry_grass', 'nettles', 'thistles', 'bin', 'trash', 'tires', 'stump'], 30, (0, 0, 112, 60), avoid=AV + 't', gap=.6)
    s.life('pigeon', 4, area=[40, 20, 70, 36]); s.life('cat', 2)
    s.rolling(.4, 7)
    return s.out(7, 'iron'), {}


def route_pond(D, i, old):
    s, ex = route_base('willowmere', D, i, old, 'g', 4616, path='p', amp=3)
    s.pond(60, 36, 16, 8, ducks=6, reeds=30, lilies=16, dip=1.0)
    s.blob(60, 26.6, 9, 2.4, 'P', .3)
    s.tint_ground([('R', .58, 4.5, 'g'), ('M', .64, 5, 'gR'), ('G', .64, 8, 'g'), ('f', .78, 4, 'gG')], 53)
    s.line([[60, 26], [60, 32]], 'b', 1.4); s.roads.append(([[60, 22], [60, 32]], 1.2)); s.put('dock_post', 59, 32.2); s.put('dock_post', 61, 32.2); s.put('rowboat', 62.6, 33.6, block=False)
    s.stream([(96, s.H + .2), (90, 52), (80, 44), (74, 40)], 1.1, .5, banks='R')
    s.bridges_over('wood')
    for cx, cz in ((36, 40), (86, 30), (44, 52), (78, 50)): s.put('tree_willow', cx, cz, s.r.uniform(1, 1.2))
    s.drifts(10, (4, 7, 2.2, 3.4))
    s.grove(14, 46, 8, 6, 14, ['tree_willow', 'tree_birch', 'tree_alder' if 'tree_alder' in CAT else 'tree_birch_b', '@tree_oak'], under=UNDER)
    s.grove(100, 20, 6, 5, 10, LEAFY, under=UNDER)
    s.belt(LEAFY + ['tree_willow'], 'back', 6, 26, UNDER)
    s.scatter(['bulrush', 'cattails', 'iris_yellow', 'marsh_marigold', 'water_mint', 'sedge', 'horsetail'], 40, (36, 22, 86, 52), avoid='pcdqhaeb', gap=.2, on='Rgs')
    s.scatter(['@rocks', 'stump', 'log_mossy', '@fern', '@flowers'], 26, (0, 0, 112, 60), avoid=AV + 't', gap=.5)
    s.rolling(.6, 8)
    return s.out(7, 'wood'), {}


def route_ridge(D, i, old):
    s, ex = route_base('kitewind', D, i, old, 'H', 4617, path='v', amp=2.6)
    s.tint_ground([('G', .5, 7, 'H'), ('r', .58, 6, 'HG'), ('P', .78, 3.5, 'Hr')], 63)
    s.terrace(66, 34, 104, 60, 3.2, wall=False, mat=1)
    s.put('ladder', 84, 33.6, act='climb', label='Ladder'); s.wind(list(s.hub), [84, 32], 'v', 1.2, 1.2)
    s.put('bench_wood', 86, 48); s.put('signpost', 80.6, 31.4, act='sign', say='Lookout Ridge. Climb up: on a clear day you can see Capital Gains.')
    s.put('lantern', 82, 46); s.put('flag', 90, 50)
    s.drifts(8, (4, 6, 2, 3), density=.6)
    s.grove(20, 44, 9, 7, 16, ['tree_pine', 'tree_pine_b', 'tree_larch', 'tree_rowan'], under=['@rocks', 'heather', '@fern'])
    s.scatter(['heather', 'heather', '@rocks', 'boulder_lichen', 'scree', 'tussock', 'bush_juniper', 'tree_pine_small'], 60, (0, 0, 112, 64), avoid=AV + 't', gap=.5)
    s.belt(['tree_pine', 'tree_pine_b', 'tree_larch'], 'back', 5, 20)
    s.rolling(1.2, 8); s.hill(30, 40, 12, 2.2)
    return s.out(7, 'wood', None, 'wood', 'rope'), {}


def route_offshore(D, i, old):
    s, ex = route_base('driftwreck', D, i, old, 'd', 4618, path='S', amp=2.4, width=1.6)
    s.roads.clear()
    for cx, cz, rx, rz in ((56, 14, 14, 6), (24, 34, 10, 5), (88, 40, 12, 6), (60, 50, 8, 4)):
        s.blob(cx, cz, rx + 3, rz + 2.4, 'w', .3); s.blob(cx, cz, rx + 1.2, rz + .8, 'S', .3); s.blob(cx, cz, rx, rz, 's', .35)
    for e in ex: s.wind([56, 14], e, 'S', 2.2, 2.4, keep='')
    for cx, cz in ((24, 34), (88, 40), (60, 50)):
        for _ in range(4):
            x, z = cx + s.r.gauss(0, 3), cz + s.r.gauss(0, 1.6)
            if s.at(x, z) == 's' and s.free(x, z, .5, 'wdp', .4, .3): s.put(s.r.choice(['palm_small', 'palm_tree', 'shell_pile', 'rocks', 'seaweed']), x, z)
    s.put('rowboat', 92, 37.4, block=False); s.put('scrap', 90, 42); s.put('buoy', 40, 24, block=False); s.put('buoy', 76, 24, block=False)
    s.scatter(['seaweed', 'shell_pile', 'coral', 'rocks'], 26, (0, 0, 112, 64), avoid='pd', gap=.6, on='sSw')
    return s.out(7, 'wood'), {}


def route_volcano(D, i, old):
    s, ex = route_base('cinderpeak', D, i, old, 'z', 4619, path='v', amp=2.4)
    s.tint_ground([('j', .58, 6, 'z'), ('r', .74, 5, 'z')], 73)
    s.terrace(-1, 42, s.W + 1, 65, 3.0, wall=False, mat=6)
    s.stream([(70, s.H + .2), (72, 52), (66, 44), (60, 36), (48, 30), (30, 26), (-.4, 22)], 1.4, .25, banks='j')
    s.wind(list(s.hub), [36, 39.6], 'v', 1.3, 1.6)
    s.bridges_over('stone')
    s.put('ladder', 36, 41.6, act='climb', label='Ladder')
    s.scatter(['lava_rock', 'obsidian', 'basalt_columns', 'boulder_basalt', 'rocks_basalt', 'steam_vent', 'lava_vent', 'tree_dead'], 60, (0, 0, 112, 64), avoid=AV + 't', gap=.6)
    s.drifts(7, (4, 6, 2, 3), density=.55)
    s.rolling(.7, 8)
    return s.out(7, 'iron', None, 'stone'), {}


def route_pass(D, i, old):
    s, ex = route_base('hornpass', D, i, old, 'n', 4620, path='v', amp=4.2, width=1.3)
    s.tint_ground([('H', .72, 6, 'n'), ('r', .68, 5, 'nH'), ('I', .8, 4, 'n')], 83)
    s.terrace(-1, 36, 46, 65, 2.4, wall=False, mat=1); s.terrace(70, 30, s.W + 1, 65, 2.6, wall=False, mat=1)
    s.put('ladder', 24, 35.6, act='climb', label='Ladder'); s.put('ladder', 86, 29.6, act='climb', label='Ladder')
    s.house('house_cottage', 64, 22, 'house', say='A mountain hut. The stove is still warm.', fence=False, lawn='n')
    s.drifts(8, (4, 6, 2, 3), density=.6)
    s.scatter(['tree_pine_snow', 'tree_pine_snow_b', 'tree_pine_snow_small', 'rocks_snow', 'boulder_snow', 'heather', 'grass_snow'], 60, (0, 0, 112, 64), avoid=AV + 't', gap=.6)
    s.belt(['tree_pine_snow', 'tree_pine_snow_b'], 'back', 5, 20)
    s.rolling(1.0, 8)
    return s.out(7, 'wood', None, 'wood', 'rope'), {}


def route_lake(D, i, old):
    s, ex = route_base('mirrormere', D, i, old, 'g', 4621, path='p', amp=2.6)
    s.blob(60, 46, 50, 16, 'S', .25); s.blob(60, 50, 48, 14, 'w', .25); s.blob(60, 56, 44, 10, 'd', .3)
    s.tint_ground([('R', .6, 4.5, 'g'), ('C', .66, 6, 'gR'), ('G', .66, 8, 'g')], 93)
    s.rect(78, 33, 82, 40, 'b'); s.roads.append(([[80, 28], [80, 40]], 1.2)); s.house('house_cottage', 86, 30, 'house', say='The boathouse. Oars, nets, a very old map.', lawn=None, fence=False)
    for x in (77, 83): s.put('dock_post', x, 40.2)
    s.put('rowboat', 74, 42, block=False); s.put('sailboat', 50, 50, block=False)
    s.put('market_cart', 46, 20, act='talk', say='Bait seller: “Worms! Fresh worms! Billionaires love them.”')
    s.drifts(9, (4, 7, 2.2, 3.4))
    s.grove(12, 30, 8, 6, 12, LEAFY + ['tree_willow'], under=UNDER); s.grove(104, 24, 6, 5, 9, LEAFY, under=UNDER)
    s.scatter(['bulrush', 'cattails', 'iris_yellow', 'reeds', 'sedge'], 40, (8, 28, 104, 42), avoid='pcdqhaeb', gap=.2, on='RgSs')
    s.scatter(['@rocks', 'stump', '@bush_round', '@flowers'], 22, (0, 0, 112, 30), avoid=AV + 't', gap=.6)
    s.life('duck', 6); s.life('gull', 2)
    s.rolling(.5, 8)
    return s.out(7, 'wood'), {}


def shoulders_v46(s, ch='u'):
    B.shoulders(s, ch)


BUILD = {'marigold': town_sundown, 'tallgrass_meadow': route_grass, 'old_fairway': route_golf, 'thicket': route_thicket, 'fizzwell': town_grotto, 'stepstone_canyon': route_canyon,
         'rustgear': route_scrap, 'pepperpot': town_food, 'lanternhall': town_mall, 'willowmere': route_pond, 'clovercrest': town_farm, 'kitewind': route_ridge, 'verdigris': town_city,
         'driftwreck': route_offshore, 'palmhaven': town_taxhaven, 'cinderpeak': route_volcano, 'hornpass': route_pass, 'frostcrown': town_summit, 'mirrormere': route_lake}


# ================================================================================================ after building
def finish(sc, D, i, nature, cat):
    # groups to real keys, and nothing the catalogue doesn't know
    r = random.Random(46 + i)
    for p in sc['props']:
        if p['k'].startswith('@'): p['k'] = r.choice(GROUPS.get(p['k'][1:]) or ['bush_round'])
    sc['props'] = [p for p in sc['props'] if p['k'] in cat]
    # the edge exits, named, and the road table pointing at them
    W, H = sc['w'], sc['h']; exs = sc.get('exits') or []
    nb = [(n, L[1] if L[0] == i else L[0]) for n, L in enumerate(D['roads']) if i in (L[0], L[1])]
    E, used = [], {}
    for (n, j), e in zip(nb, exs):
        d = {'W': e[0], 'E': W - e[0], 'S': e[1], 'N': H - e[1]}; side = min(d, key=d.get); t = e[0] / W if side in 'NS' else e[1] / H
        base = {'N': 'north', 'S': 'south', 'E': 'east', 'W': 'west'}[side]; used[base] = used.get(base, 0) + 1
        eid = base if used[base] == 1 else base + str(used[base])
        E.append({'id': eid, 'side': side, 't': round(t, 4), 'in': round(d[side], 2), 'width': 2})
        J = D['roads'][n][3]
        if D['roads'][n][0] == i: J['a'] = eid
        else: J['b'] = eid
    sc['edgeExits'] = E
    # ladders where a cliff faces the camera (tools/build-v28.py's finder, reaching farther in the bigger places)
    want = {'kitewind': 2, 'stepstone_canyon': 2, 'hornpass': 2, 'frostcrown': 1, 'cinderpeak': 1, 'thicket': 1}.get(sc.get('locationId'))
    sc['props'] = [p for p in sc['props'] if p['k'] != 'ladder']
    if want:
        src = V28.ladders.__code__.co_consts; hub0 = sc['hub']
        L = ladders_far(sc, want)
        for x, zf, d in L:
            sc['props'].append({'k': 'ladder', 'x': round(x, 2), 'z': round(zf - .12, 2), 's': round((d + .35) / V28.LADDER_M, 2), 'act': 'climb', 'label': 'Ladder',
                                'to': [round(x, 2), round(zf + .8, 2)], 'h': round(d, 2)})
        if not L: print(f'    !! {sc.get("locationId")}: no cliff for a ladder')
    # wild growth, in plant families, on the v46 ground too
    occ = sum(1 for p in sc['props']); grown = GW.grow_scene(sc.get('locationId') or '', sc, cat, nature, .55 if sc.get('kind') == 'town' else .8, random.Random(4600 + i))
    sc['grown'] = 31
    CW.clear_scene(sc, cat, CW.ppu(D))          # alpha 0.1: what grew or was placed in front of a window moves aside
    return occ, len(grown)



def ladders_far(sc, want):
    """build-v28's ladder finder, allowed up to 45 m from where you arrive"""
    import types
    code = V28.ladders.__code__
    consts = tuple(45 if c == 20 else c for c in code.co_consts)
    f = types.FunctionType(code.replace(co_consts=consts), V28.ladders.__globals__)
    return f(sc, want)


NEWLET = {'C': 'g', 'M': 'y', 'L': 'y', 'H': 'G', 'R': 'g', 'D': 'u', 'S': 's', 'P': 'v', 'X': 'k', 'n': 'n'}


def nature_pool(cat):
    """the nature props, with the v46 ground letters added to where they grow"""
    out = {}
    for k, M in cat.items():
        if not M.get('family') or not M.get('grow'): continue
        g = set(M['grow'])
        for nl, ol in NEWLET.items():
            if ol in g: g.add(nl)
        if M['family'] == 'water' and 'w' in g: g.add('R')
        out[k] = dict(M, grow=''.join(sorted(g)), weight=M.get('weight', 1))
    return out


def draw_map(sid, sc, cat, path):
    from PIL import Image, ImageDraw
    T = {'g': (90, 150, 70), 'G': (70, 130, 60), 'f': (120, 160, 80), 't': (50, 110, 50), 'p': (190, 150, 100), 'c': (170, 165, 150), 's': (220, 200, 140), 'w': (60, 130, 200), 'd': (40, 100, 170),
         'r': (130, 120, 110), 'k': (80, 75, 95), 'm': (200, 190, 170), 'o': (110, 76, 50), 'b': (140, 100, 60), 'x': (110, 105, 95), 'n': (230, 236, 244), 'a': (70, 72, 80), 'q': (190, 186, 172),
         'h': (150, 80, 60), 'v': (150, 145, 135), 'u': (130, 95, 65), 'y': (60, 85, 50), 'e': (160, 155, 145), 'l': (100, 170, 80), 'z': (80, 70, 68), 'j': (50, 50, 60), 'C': (80, 160, 80),
         'M': (70, 120, 60), 'D': (100, 75, 55), 'S': (190, 170, 120), 'P': (160, 150, 140), 'K': (150, 140, 130), 'L': (140, 110, 60), 'H': (130, 90, 130), 'R': (80, 120, 90), 'T': (230, 228, 220),
         'I': (200, 230, 245), 'X': (150, 120, 200)}
    k = 6; W, H = sc['w'], sc['h']; im = Image.new('RGB', (W * k, H * k)); d = ImageDraw.Draw(im)
    for j, row in enumerate(sc['tiles']):
        for i2, ch in enumerate(row): d.rectangle([i2 * k, j * k, i2 * k + k - 1, j * k + k - 1], fill=T.get(ch, (255, 0, 255)))
    for p in sc['props']:
        M = cat.get(p['k'], {}); x, y = p['x'] * k, (H - p['z']) * k
        if M.get('box'): w, dd = M['box']; s = p.get('s', 1); d.rectangle([x - w * s / 2 * k, y - dd * s * k, x + w * s / 2 * k, y], outline=(255, 255, 255), fill=(200, 60, 60) if p.get('act') else (120, 60, 60))
        else:
            g = M.get('group', p['k']); c = (20, 70, 20) if 'tree' in g or 'palm' in g else (230, 230, 60) if 'flower' in g else (40, 40, 40) if 'tallgrass' in g else (90, 60, 40)
            d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=c)
    hx, hz = sc['hub']; d.ellipse([hx * k - 5, (H - hz) * k - 5, hx * k + 5, (H - hz) * k + 5], outline=(255, 0, 0), width=2)
    for e in sc.get('exits', []): d.rectangle([e[0] * k - 4, (H - e[1]) * k - 4, e[0] * k + 4, (H - e[1]) * k + 4], outline=(0, 0, 255), width=2)
    im.save(path)


def main():
    args = sys.argv[1:]; dry = '--dry' in args; mp = None
    if '--map' in args: j = args.index('--map'); mp = Path(args[j + 1]); del args[j:j + 2]; mp.mkdir(parents=True, exist_ok=True)
    only = [a for a in args if not a.startswith('--')]
    head, D = load(); cat = D['scenery']['props']; CAT.update(cat); nature = nature_pool(cat)
    for n, pl in enumerate(D['locations']):
        sid = pl['mapId']
        if only and sid not in only: continue
        old = D['maps'].get(sid)
        if not old or sid not in BUILD: continue
        if old.get('keep'): print(f'  {sid}: marked keep, left alone'); continue
        base_old = D['maps'].get(sid + '@v45') or old
        if old.get('v46') and sid + '@v45' in D['maps']: base_old = D['maps'][sid + '@v45']
        sc, info = BUILD[sid](D, n, base_old)
        occ, grown = finish(sc, D, n, nature, cat)
        if sid + '@v45' not in D['maps']:
            bk = copy.deepcopy(old); bk['name'] = (old.get('name') or sid) + ' (v45)'; bk['kind'] = 'test'; bk['locationId'] = sid; bk['backup'] = 'v45'
            D['maps'][sid + '@v45'] = bk
        D['maps'][sid] = sc
        lab = info.get('lab')
        need = lambda S: sorted({(p['act'], p.get('shop') or '') for p in S.get('props', []) if p.get('act') in ('shop', 'clinic', 'lab', 'home', 'climb')})
        lost = [x for x in need(base_old) if x not in need(sc)]
        if lost: print(f'    !! {sid} lost: {lost}')
        tg = sum(r.count('t') for r in sc['tiles'])
        print(f'  {sid}: {sc["w"]}×{sc["h"]}, tall grass {tg} m², {occ} placed + {grown} grown, exits {[(e["id"], e["side"]) for e in sc["edgeExits"]]}' + (f', lab at {lab["x"]},{lab["z"]}' if lab else ''))
        if mp: draw_map(sid, sc, cat, mp / f'{sid}.png')
    if not dry: save(head, D)


if __name__ == '__main__':
    main()
