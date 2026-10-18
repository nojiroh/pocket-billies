#!/usr/bin/env python3
"""Builds the walk-scene catalog (ground types and props) and a scene for every route stop, and writes them into
game/data/gamedata.js as "scenery" and "scenes".

    python3 tools/build-scenes.py            # adds anything missing, keeps scenes you already have
    python3 tools/build-scenes.py --force    # rebuilds every scene from scratch (your scene edits are lost)
    python3 tools/build-scenes.py --scenes   # rebuilds every scene but keeps your catalog (prop and ground settings)
    python3 tools/build-scenes.py --catalog  # only refreshes the prop and ground catalog

v18 scenes also carry a step field ("steps"/"stepm": cliffs, terraces, stairs, ledges, ravines at half-metre
resolution) and lists of bridges, rails, arches, escalators and streams.

v10 scenes are places you walk around in: each has a hub (where you stand when you stay), one exit per road
(placed in the direction of the neighbouring stop on the world map), roads from the hub to every exit, buildings
with doors you can walk up to (shop, clinic, lab, houses), signposts at the exits, townsfolk in towns, distant
hills behind, and plenty of prop variants scattered in natural clumps.
Edit scenes afterwards in Pocket Billies Studio (World & encounters → Scenes)."""
import gamedata  # phase 04b: the data files in game/data
import base64, json, math, random, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'data' / 'gamedata.js'
PJ = json.loads((ROOT / 'game' / 'art' / 'scene' / 'props.json').read_text())
PPU = 34

TERRAINS = {
 'g': ('Grass', 'grass', 4, '#3F7F3C'), 'G': ('Meadow', 'meadow', 4, '#356E34'), 'f': ('Flowers', 'flowers', 4, '#3F7F3C'),
 't': ('Tall grass', 'tallgrass', 5, '#2E6A33'), 'p': ('Path', 'path', 2, '#A98050'), 'c': ('Plaza', 'plaza', 3, '#8D8574'),
 's': ('Sand', 'sand', 1, '#C8A86A'), 'w': ('Water', 'water', 0, '#2E7FB4'), 'd': ('Deep water', 'deep', 0, '#24679E'),
 'r': ('Rock', 'rock', 3, '#6F6A62'), 'k': ('Cave floor', 'cave', 3, '#4A4558'), 'm': ('Mall floor', 'mall', 3, '#B9AE98'),
 'o': ('Farm soil', 'soil', 2, '#5E3E26'), 'b': ('Boards', 'boards', 3, '#6E4A2A'), 'x': ('Scrap ground', 'scrap', 2, '#5C564E'),
 'n': ('Snow', 'snow', 4, '#AFC0D4'),
 # v17
 'a': ('Asphalt', 'asphalt', 2, '#3E4046'), 'q': ('Pavers', 'pavers', 3, '#B8B2A4'), 'h': ('Brick paving', 'bricks', 3, '#7A3E30'),
 'v': ('Gravel', 'gravel', 2, '#837D72'), 'u': ('Dirt', 'dirt', 2, '#6A4A30'), 'y': ('Forest floor', 'forest', 4, '#33482A'),
 'e': ('Stone steps', 'steps', 3, '#8E897E'), 'l': ('Lawn', 'lawn', 4, '#4A8A3C'),
 # v24
 'z': ('Ash', 'ash', 3, '#4A4340'), 'j': ('Basalt', 'basalt', 3, '#2E2E38'),
}
# hard-edged man-made surfaces: crisp borders in the ground picture, quicker to walk on
PAVED = set('mbaqhe')
FLIPPABLE = {'grass', 'meadow', 'flowers', 'tallgrass', 'path', 'sand', 'rock', 'cave', 'snow', 'gravel', 'dirt', 'forest', 'scrap', 'water', 'deep', 'asphalt', 'ash', 'basalt'}
GLOW = {'lamp': ('#FFE3A0', 1.8, 3.2), 'crystal': ('#8EF0FF', 1.5, 1.0), 'crystal_pink': ('#FF9EE0', 1.4, .9), 'crystal_purple': ('#C79BFF', 1.4, .9)}
GROUPS = {}
for _k, _m in PJ.items():
    GROUPS.setdefault(_m.get('group', _k), []).append(_k)

def scenery():
    props = {}
    for k, m in PJ.items():
        p = {'name': m['name'], 'img': f'scene/props/{k}.png', 'ox': m['ox'], 'oy': m['oy'], 'shadow': m['shadow'], 'sway': m['sway'], 'flat': m['flat'], 'tags': m.get('tags', []),
             'group': m.get('group', k)}
        for f in ('solid', 'box', 'door', 'fx', 'blades', 'posts'):
            if m.get(f) is not None: p[f] = m[f]
        if k == 'stepping': p['walk'] = .9
        props[k] = p
    man = (ROOT / 'game' / 'art' / 'manifest.js').read_text()
    M = json.loads(man[man.index('=') + 1:].strip().rstrip(';'))
    from PIL import Image
    nice = {'tree': 'Battle tree', 'flowers': 'Flower bed', 'busstop': 'Bus stop', 'fence': 'Picket fence', 'bush': 'Low bush', 'lamp': 'Lamp post',
            'flag': 'Golf flag', 'bunker': 'Sand bunker', 'cart': 'Golf cart', 'mailbox': 'Mailbox', 'derrick': 'Oil derrick', 'rock': 'Rock',
            'barrel': 'Barrel', 'pipe': 'Pipe', 'mesa': 'Mesa', 'escal': 'Escalator', 'cactus': 'Cactus', 'bin': 'Dumpster', 'cartS': 'Shopping cart',
            'salesign': 'Sign board', 'table': 'Umbrella table', 'pretzel': 'Pretzel stand', 'trash': 'Trash can', 'planter': 'Planter',
            'bench': 'Bench', 'fountain': 'Fountain', 'kioskP': 'Kiosk'}
    boxes = {'bunker': None, 'escal': [3.0, 1.6], 'pretzel': [2.6, 1.2], 'kioskP': [2.4, 1.4], 'busstop': [2.4, .8], 'fence': [2.0, .25], 'bin': [1.8, 1.0], 'cart': [1.8, 1.0], 'derrick': [2.4, 2.4], 'mesa': [6.0, 3.0]}
    for k, b in M['battle']['props'].items():
        im = Image.open(ROOT / 'game' / 'art' / 'battle' / 'props' / f'{k}.png')
        w = im.width
        p = {'name': nice.get(k, k), 'img': f'battle/props/{k}.png', 'ox': b['ox'], 'oy': b['oy'], 'shadow': round(min(2, w / 34 * .42), 2),
             'sway': .35 if k == 'tree' else .3 if k in ('bush', 'flowers') else 0, 'flat': b.get('flat', 0), 'tags': ['battle'], 'group': k}
        if boxes.get(k): p['box'] = boxes[k]
        if k in ('flowers', 'bunker'): p['solid'] = 0
        props.setdefault(k, p)
    for k, (c, r, y) in GLOW.items():
        if k in props and not any(f['k'] == 'glow' for f in props[k].get('fx', [])):
            props[k]['glow'] = {'c': c, 'r': r, 'y': y}
    # v17: 3D plans for the building pictures (tools/build-buildings.py)
    bj = ROOT / 'game' / 'art' / 'scene' / 'build.json'
    BJ = json.loads(bj.read_text()) if bj.exists() else {'plans': {}}
    for k, plan in BJ['plans'].items():
        if k in props: props[k]['build'] = plan
    # v17: back and front crowns for every tree and bush (tools/build-prop-layers.py)
    lj = ROOT / 'game' / 'art' / 'scene' / 'layers.json'
    for k, L in (json.loads(lj.read_text()) if lj.exists() else {}).items():
        if k in props: props[k]['layers'] = L
    ter = {}
    for ch, (n, t, z, e) in TERRAINS.items():
        T = {'name': n, 'tile': f'scene/tiles/{t}.png', 'z': z, 'edge': e}
        vs = [f'scene/tiles/{t}_{i}.png' for i in range(1, 6) if (ROOT / 'game' / 'art' / 'scene' / 'tiles' / f'{t}_{i}.png').exists()]
        if vs: T['vars'] = vs
        if t in FLIPPABLE: T['flip'] = 1
        if ch in PAVED: T['paved'] = 1
        ter[ch] = T
    lf = ROOT / 'game' / 'art' / 'scene' / 'life.json'
    life = json.loads(lf.read_text()) if lf.exists() else {}
    return {'ppu': PPU, 'tile': 16, 'terrains': ter, 'props': props, 'person': 1.75, 'life': life,
            'buildArt': {'detail': BJ.get('detail', 'scene/build/detail.png'), 'rooms': BJ.get('rooms', 'scene/build/rooms.png')},
            'wallArt': 'scene/build/walls.png'}

def meta(k):
    return PJ.get(k) or {}

def radius(k, s=1):
    m = meta(k)
    if m.get('box'): return max(m['box']) / 2 * s
    if m.get('solid') is not None: return max(.2, m['solid']) * s
    return max(.25, m.get('shadow', .5) * .5) * s

def seg_dist(px, pz, a, b):
    vx, vz = b[0] - a[0], b[1] - a[1]; l2 = vx * vx + vz * vz or 1e-9
    k = max(0, min(1, ((px - a[0]) * vx + (pz - a[1]) * vz) / l2))
    return math.hypot(a[0] + vx * k - px, a[1] + vz * k - pz)

AV = 'pcwdaqhebm'      # ground nothing grows on: paths, plazas, water, paving, steps, boards, floors
ROADS = 'pcmqhae'      # ground a door path can join

class Scene:
    def __init__(self, sid, name, base, seed, W=32, H=24, **kw):
        self.sid, self.W, self.H, self.r, self.seed = sid, W, H, random.Random(seed), seed
        self.terraces = []
        self.g = [[base] * W for _ in range(H)]
        # v18: the step field, half-metre cells, row 0 at the near edge: heights added to the land (cliffs, terraces,
        # stairs, ledges, ravines) and the wall material of each cell (low 4 bits; 16 = a ledge you may hop down from)
        self.st = [[0.0] * (2 * W) for _ in range(2 * H)]
        self.wm = [[0] * (2 * W) for _ in range(2 * H)]
        self.stairs, self.nostairs, self.stream_tiles, self.ramps, self.voids = [], [], set(), [], set()
        self.props, self.roads, self.blocks, self.clear = [], [], [], []
        self.d = {'name': name, 'w': W, 'h': H, 'edge': base, 'sky': ['#8CC6E6', '#BFE3EE', '#F4E8C8'], 'haze': '#EAD9C0', 'hazeD': 34,
                  'cam': {'pitch': 34, 'h': 9, 'fov': 1}, 'blur': 1, 'amb': 'pollen', 'tint': None, 'indoor': 0, 'far': 'hills', 'farH': 8, 'folk': 0}
        self.d.update(kw)
    # ---- terrain: (x, z) are world meters, z = 0 at the near edge
    def cell(self, x, z, ch):
        i, j = int(math.floor(x)), self.H - 1 - int(math.floor(z))
        if 0 <= i < self.W and 0 <= j < self.H: self.g[j][i] = ch
    def at(self, x, z):
        i, j = int(math.floor(x)), self.H - 1 - int(math.floor(z))
        return self.g[j][i] if 0 <= i < self.W and 0 <= j < self.H else self.d['edge']
    def rect(self, x0, z0, x1, z1, ch):
        for x in range(int(x0), int(math.ceil(x1))):
            for z in range(int(z0), int(math.ceil(z1))): self.cell(x + .5, z + .5, ch)
    def blob(self, cx, cz, rx, rz, ch, rough=.25, keep=''):
        for x in range(int(cx - rx - 2), int(cx + rx + 3)):
            for z in range(int(cz - rz - 2), int(cz + rz + 3)):
                e = ((x + .5 - cx) / rx) ** 2 + ((z + .5 - cz) / rz) ** 2
                if e <= 1 + (self.noise(x + .5, z + .5, 2.6, 7) - .5) * 2.2 * rough and self.at(x + .5, z + .5) not in keep: self.cell(x + .5, z + .5, ch)
    def line(self, pts, ch, width=1.2, keep=''):
        for a, b in zip(pts, pts[1:]):
            n = int(math.hypot(b[0] - a[0], b[1] - a[1]) * 4) + 1
            for k in range(n + 1):
                t = k / n; x, z = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
                for dx in (-width, -width / 2, 0, width / 2, width):
                    for dz in (-width / 2, 0, width / 2):
                        if self.at(x + dx * .5, z + dz) not in keep: self.cell(x + dx * .5, z + dz, ch)
    def road(self, a, b, ch='p', width=1.0, amp=.9, keep='c'):
        L = math.hypot(b[0] - a[0], b[1] - a[1]); n = max(4, int(L / 1.6)); ph = self.r.uniform(0, 6)
        nx, nz = -(b[1] - a[1]) / (L or 1), (b[0] - a[0]) / (L or 1); pts = []
        for k in range(n + 1):
            t = k / n; o = math.sin(t * math.pi) * math.sin(t * 2.6 + ph) * amp
            pts.append([round(a[0] + (b[0] - a[0]) * t + nx * o, 2), round(a[1] + (b[1] - a[1]) * t + nz * o, 2)])
        self.line(pts, ch, width, keep); self.roads.append((pts, width)); return pts
    def near_road(self, x, z, m):
        for pts, w in self.roads:
            for a, b in zip(pts, pts[1:]):
                if seg_dist(x, z, a, b) < w * .5 + m: return True
        return False
    # ---- props
    def put(self, k, x, z, s=1, f=0, block=True, **extra):
        p = {'k': k, 'x': round(x, 2), 'z': round(z, 2)}
        if abs(s - 1) > .005: p['s'] = round(s, 2)
        if f: p['f'] = 1
        p.update(extra); self.props.append(p)
        m = meta(k)
        if block:
            if m.get('box'): w, d = m['box']; self.blocks.append((x - w * s / 2 - .4, z - .5, x + w * s / 2 + .4, z + d * s + .3))
            else: self.clear.append((x, z, radius(k, s)))
        return p
    def free(self, x, z, r, avoid=AV, road=.8, gap=.25):
        if not (.3 < x < self.W - .3 and .2 < z < self.H - .2): return False
        if self.at(x, z) in avoid: return False
        if road is not None and self.near_road(x, z, road + r * .5): return False
        for x0, z0, x1, z1 in self.blocks:
            if x0 - r < x < x1 + r and z0 - r < z < z1 + r: return False
        for cx, cz, cr in self.clear:
            if math.hypot(cx - x, cz - z) < cr + r + gap: return False
        return True
    def keys(self, spec):
        out = []
        for s in spec:
            if s.startswith('@'): out += GROUPS.get(s[1:], [])
            else: out.append(s)
        return out
    def scatter(self, spec, n, box, avoid=AV, gap=.25, svar=.15, road=.8, flip=.45, on=None, s0=1, inside=None, steep=None):
        ks = self.keys(spec); x0, z0, x1, z1 = box; tries = 0
        while n > 0 and tries < n * 60 + 60:
            tries += 1; k = self.r.choice(ks); s = s0 * (1 + self.r.uniform(-svar, svar))
            x, z = self.r.uniform(x0, x1), self.r.uniform(z0, z1)
            if inside and ((x - inside[0]) / inside[2]) ** 2 + ((z - inside[1]) / inside[3]) ** 2 > 1: continue
            if on and self.at(x, z) not in on: continue
            if self.near_terrace_edge(x, z, .9): continue
            if not self.free(x, z, radius(k, s), avoid, road, gap): continue
            hp = self.d.get('hub')
            if hp and meta(k).get('group', k).startswith('tree') and abs(x - hp[0]) < 5.5 and z < hp[1] + 1.5: continue  # keep the view of where you stand open
            self.put(k, x, z, s, self.r.random() < flip); n -= 1
    def clump(self, spec, cx, cz, n, rad, **kw):
        self.scatter(spec, n, (cx - rad, cz - rad * .75, cx + rad, cz + rad * .75), **kw)
    def grass(self, cx, cz, rx, rz, density=.8, rough=.35):
        """a patch of tall grass where billionaires hide, with tufts on it"""
        self.blob(cx, cz, rx, rz, 't', rough, keep='pcwdo')
        for _ in range(int(rx * rz * density)):
            a, d = self.r.uniform(0, 6.28), self.r.random() ** .5
            x, z = cx + math.cos(a) * rx * d, cz + math.sin(a) * rz * d
            if self.at(x, z) == 't' and self.free(x, z, .15, 'pcwdo', .3, 0):
                self.put(self.r.choice(GROUPS['tallgrass']), x, z, self.r.uniform(.85, 1.25), self.r.random() < .5, block=False)
    def building(self, k, x, z, act=None, label=None, say=None, s=1, f=0, path=True, shop=None):
        p = self.put(k, x, z, s, f)
        if act: p['act'] = act
        if shop: p['shop'] = shop
        if label: p['label'] = label
        if say: p['say'] = say
        m = meta(k)
        if path and m.get('door') is not None:
            dx = x + m['door']['x'] / PPU * s * (-1 if f else 1); hit = None
            # straight toward the camera if a road or the plaza is just in front of the door
            for k2 in range(2, 12):
                zz = z - .4 - k2 * .5
                if zz < .5: break
                if self.at(dx, zz) in ROADS: hit = [dx, zz]; break
            if hit:
                self.line([[dx, z - .3], hit], 'p', .7, keep='cmbwdaqhe'); self.roads.append(([[dx, z - .3], hit], .7))
            else:
                # otherwise a short walk out of the door, then the shortest way to the nearest road or plaza
                best, bd = None, 1e9
                for j in range(self.H):
                    for i in range(self.W):
                        if self.g[j][i] not in ROADS: continue
                        cx, cz = i + .5, self.H - j - .5
                        if cz > z + 3: continue
                        d = math.hypot(cx - dx, cz - (z - 1.2))
                        if d < bd: bd, best = d, [cx, cz]
                if best and bd < 14: self.line([[dx, z - .3], [dx, z - 1.2], best], 'p', .7, keep='cmbwdaqhe'); self.roads.append(([[dx, z - .3], [dx, z - 1.2], best], .7)) if best and bd < 14 else None
            self.clear.append((dx, z - .8, .5))
        return p
    def hub_exits(self, D, i, hub, road='p', width=1.0, signs=True, lamps=None):
        R = D['locations']; me = R[i]; self.d['hub'] = [round(hub[0], 2), round(hub[1], 2)]; ex = []
        self.clear.append((hub[0], hub[1], 1.2))
        nb = [b if a == i else a for a, b, _c in D['roads'] if i in (a, b)]
        ang = [math.atan2(R[j].get('lat', 0) - me.get('lat', 0), R[j].get('lon', 0) - me.get('lon', 0)) for j in nb]
        # roads that leave in nearly the same direction are fanned out so their exits don't overlap (order is kept)
        for _ in range(60):
            for p in range(len(ang)):
                for q in range(len(ang)):
                    if p == q: continue
                    d = (ang[q] - ang[p] + math.pi) % (2 * math.pi) - math.pi
                    if abs(d) < math.radians(55): ang[p] -= math.copysign(math.radians(1.5), d or 1)
        for j, an in zip(nb, ang):
            o = R[j]; ux, uz = math.cos(an), math.sin(an)
            m = 1.1; ts = []
            if ux > 1e-6: ts.append((self.W - m - hub[0]) / ux)
            if ux < -1e-6: ts.append((m - hub[0]) / ux)
            if uz > 1e-6: ts.append((self.H - m - hub[1]) / uz)
            if uz < -1e-6: ts.append((m - hub[1]) / uz)
            t = min(ts); e = [round(hub[0] + ux * t, 2), round(hub[1] + uz * t, 2)]; ex.append(e)
            if road: self.road(hub, e, road, width)
            else: self.roads.append(([list(hub), e], width))
            self.clear.append((e[0], e[1], 1.4))
            if signs:
                px, pz = -uz, ux; sv = lambda x, z: self.stv(int(x * 2), int(z * 2))
                cand = [(e[0] - ux * d + px * o, e[1] - uz * d + pz * o) for d in (2.2, 3.2, 1.6, 4.2, 1.0) for o in (1.5, -1.5, 1.9, -1.9, 2.6, -2.6)]
                ok = [(x, z) for x, z in cand if 1 < z < self.H - 1 and .8 < x < self.W - .8 and self.at(x, z) not in 'wd' and all(abs(sv(x + dx, z + dz) - sv(e[0] - ux * .8, e[1] - uz * .8)) < .25 for dx in (-1.3, -.6, 0, .6, 1.3) for dz in (0, -.6, -1.1, -1.7)) and self.at(x + 1, z - .6) not in 'wd' and self.at(x - 1, z - .6) not in 'wd']
                sx, sz = ok[0] if ok else cand[0]
                sx, sz = min(self.W - .8, max(.8, sx)), min(self.H - .8, max(.8, sz))
                self.put('signpost', sx, sz, act='sign', say=f"{o['name']} this way. {'Route ' + o['route'].split()[-1] + '.' if o.get('route') else ''}".strip())
            if lamps:
                for side in (1, -1):
                    lx, lz = e[0] - ux * 3.4 + -uz * 1.3 * side, e[1] - uz * 3.4 + ux * 1.3 * side
                    if .8 < lx < self.W - .8 and .8 < lz < self.H - .8: self.put(lamps, lx, lz)
        self.d['exits'] = ex
        return ex
    def frame(self, spec, n=6, depth=2.2, avoid=AV):
        """foreground props along the near edge, for depth"""
        self.scatter(spec, n, (0, .2, self.W, depth), avoid=avoid, road=1.2, gap=.6)
    def back(self, spec, z0, n, svar=.22, gap=.05, avoid=AV, s0=1.05):
        """a dense band of trees (or rocks) at the back"""
        self.scatter(spec, n, (-.5, z0, self.W + .5, self.H), avoid=avoid, svar=svar, gap=gap, road=.6, s0=s0)
    # ---- height (v11): a grid of heights at tile corners, meters; shaped here, then smoothed under roads, plazas and buildings
    def hgrid(self):
        if not hasattr(self, 'ht'): self.ht = [[0.0] * (self.W + 1) for _ in range(self.H + 1)]  # ht[zi][xi]
        return self.ht
    def hadd(self, fn):
        g = self.hgrid()
        for zi in range(self.H + 1):
            for xi in range(self.W + 1): g[zi][xi] += fn(xi, zi)
    def hill(self, cx, cz, r, h):
        self.hadd(lambda x, z: h * (math.cos(min(1, math.hypot(x - cx, z - cz) / r) * math.pi) * .5 + .5))
    def plateau(self, x0, z0, x1, z1, h, edge=1.0):
        def f(x, z):
            d = min(x - x0, x1 - x, z - z0, z1 - z)
            return h * max(0, min(1, (d + edge * .5) / edge)) ** 1.5 if d > -edge * .5 else 0
        self.hadd(f)
    def rolling(self, amp, scale=6.0, seed=0):
        ph = [self.r.uniform(0, 6.3) for _ in range(4)]
        self.hadd(lambda x, z: amp * (math.sin(x / scale + ph[0]) * math.cos(z / (scale * 1.3) + ph[1]) * .6 + math.sin((x + z) / (scale * .7) + ph[2]) * .4))
    def rise_back(self, z0, h):
        self.hadd(lambda x, z: h * max(0, min(1, (z - z0) / max(1, self.H - z0))) ** 1.6)
    def hat(self, x, z):
        g = self.hgrid(); xi, zi = max(0, min(self.W, x)), max(0, min(self.H, z)); i, j = min(self.W - 1, int(xi)), min(self.H - 1, int(zi)); u, v = xi - i, zi - j
        return (g[j][i] * (1 - u) + g[j][i + 1] * u) * (1 - v) + (g[j + 1][i] * (1 - u) + g[j + 1][i + 1] * u) * v
    def settle(self):
        if not hasattr(self, 'ht'): return
        g = self.ht; W, H = self.W, self.H
        def blend(pred_w, target):
            for zi in range(H + 1):
                for xi in range(W + 1):
                    w = pred_w(xi, zi)
                    if w > 0: g[zi][xi] = g[zi][xi] * (1 - w) + target(xi, zi) * w
        # water: a level pond bed
        still = lambda x, z: self.at(x, z) in 'wd' and (int(math.floor(x)), self.H - 1 - int(math.floor(z))) not in self.stream_tiles
        wv = [(xi, zi) for zi in range(H + 1) for xi in range(W + 1) if any(still(xi + a, zi + b) for a in (-.5, .5) for b in (-.5, .5))]
        left = set(wv)
        while left:
            st = [left.pop()]; comp = list(st)
            while st:
                x, z = st.pop()
                for q in ((x + 1, z), (x - 1, z), (x, z + 1), (x, z - 1)):
                    if q in left: left.remove(q); st.append(q); comp.append(q)
            lvl = min(g[z][x] for x, z in comp)
            for x, z in comp: g[z][x] = lvl
        # plaza and mall floors flat
        pc = [(xi, zi) for zi in range(H + 1) for xi in range(W + 1) if all(self.at(xi + a, zi + b) in 'cm' for a in (-.5, .5) for b in (-.5, .5))]
        # each plaza on its own level (a plaza up on a terrace stays up there)
        left = set(pc)
        while left:
            st = [left.pop()]; comp = list(st)
            while st:
                x, z = st.pop()
                for q in ((x + 1, z), (x - 1, z), (x, z + 1), (x, z - 1)):
                    if q in left: left.remove(q); st.append(q); comp.append(q)
            lvl = sum(g[z][x] for x, z in comp) / len(comp)
            near = lambda x, z, comp=comp: min((math.hypot(x - a, z - b) for a, b in comp), default=9)
            blend(lambda x, z: max(0, 1 - near(x, z) / 2.5), lambda x, z, lvl=lvl: lvl)
        # buildings, fences and big things sit on level ground
        for p in self.props:
            m = meta(p['k']); b = m.get('box')
            if not b and not m.get('door'): continue
            s = p.get('s', 1); w, d = (b or [2, 1.5]); w *= s; d *= s; base = self.hat(p['x'], p['z'])
            x0, x1, z0, z1 = p['x'] - w / 2 - .8, p['x'] + w / 2 + .8, p['z'] - 1.6, p['z'] + d + .6
            blend(lambda x, z: max(0, min(1, 1.6 - max(x0 - x, x - x1, z0 - z, z - z1, 0) / 1.2)) if True else 0, lambda x, z: base)
        # roads: a smoothed profile along each road, so every road is an easy walk (ramps up hills)
        for pts, wd in self.roads:
            samp = []
            for a, b in zip(pts, pts[1:]):
                n = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / .5))
                for k in range(n): t = k / n; samp.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
            samp.append(tuple(pts[-1]))
            raw = [self.hat(x, z) for x, z in samp]; R = 7
            sm = [sum(raw[max(0, k - R):k + R + 1]) / len(raw[max(0, k - R):k + R + 1]) for k in range(len(raw))]
            for zi in range(H + 1):
                for xi in range(W + 1):
                    best, bd = None, 9
                    for k in range(0, len(samp), 2):
                        d = math.hypot(samp[k][0] - xi, samp[k][1] - zi)
                        if d < bd: bd, best = d, k
                    if best is not None and bd < wd * .5 + 2.2:
                        w = max(0, min(1, 1 - (bd - wd * .5 - .4) / 1.8))
                        g[zi][xi] = g[zi][xi] * (1 - w) + sm[best] * w
        # (v18: real stairs are built in the step field where a road meets a cliff; a hillside path stays a path)
        # where you stand is level
        hx, hz = self.d.get('hub', [W / 2, H / 2]); base = self.hat(hx, hz)
        blend(lambda x, z: max(0, 1 - math.hypot(x - hx, z - hz) / 2.5), lambda x, z: base)
        # props sit on the result automatically (the game reads heights); store with 2 decimals, far row first
        if any(abs(v) > .02 for row in g for v in row):
            self.d['heights'] = [[round(g[H - r][xi], 2) for xi in range(W + 1)] for r in range(H + 1)]
    # ---- v17: noise, natural patches, groves, drifts, ponds, gardens, terraces, life
    def noise(self, x, z, sc=5.0, seed=0):
        def h(i, j): return (math.sin(i * 127.1 + j * 311.7 + seed * 17.31 + self.seed * 3.17) * 43758.5453) % 1
        x /= sc; z /= sc; i, j = math.floor(x), math.floor(z); fx, fz = x - i, z - j
        sm = lambda t: t * t * (3 - 2 * t)
        a, b, c, d = h(i, j), h(i + 1, j), h(i, j + 1), h(i + 1, j + 1)
        return a + (b - a) * sm(fx) + (c - a) * sm(fz) + (a - b - c + d) * sm(fx) * sm(fz)
    def fbm(self, x, z, sc=6.0, seed=0):
        return self.noise(x, z, sc, seed) * .6 + self.noise(x, z, sc * .45, seed + 5) * .3 + self.noise(x, z, sc * .2, seed + 9) * .1
    def patches(self, ch, thr, sc=6, box=None, on=None, seed=0):
        x0, z0, x1, z1 = box or (0, 0, self.W, self.H)
        for x in range(max(0, int(x0)), min(self.W, int(math.ceil(x1)))):
            for z in range(max(0, int(z0)), min(self.H, int(math.ceil(z1)))):
                if on and self.at(x + .5, z + .5) not in on: continue
                if self.fbm(x + .5, z + .5, sc, seed) > thr: self.cell(x + .5, z + .5, ch)
    def grove(self, cx, cz, rx, rz, n, trees, floor='y', under=('@fern', '@fern', '@bush_round', '@mushroom', 'stump'), leaves=2, gap=.2, s0=1.0):
        if floor: self.blob(cx, cz, rx + .9, rz + .9, floor, .45, keep=AV + 'ot')
        self.scatter(trees, n, (cx - rx, cz - rz, cx + rx, cz + rz), gap=gap, svar=.22, inside=(cx, cz, rx, rz), s0=s0)
        if under: self.scatter(list(under), int(n * 1.2) + 2, (cx - rx - 1.2, cz - rz - 1.2, cx + rx + 1.2, cz + rz + 1.2), gap=.1, svar=.25, inside=(cx, cz, rx + 1.2, rz + 1.2), road=.5)
        for _ in range(leaves):
            x, z = self.r.gauss(cx, rx * .4), self.r.gauss(cz, rz * .4)
            if self.at(x, z) not in AV: self.put('fallen_leaves', x, z, self.r.uniform(.8, 1.3), self.r.random() < .5, block=False)
    def drift(self, spec, cx, cz, rx, rz, n, avoid=AV):
        ks = self.keys(spec); main = self.r.choice(ks); tries = 0
        while n > 0 and tries < n * 8:
            tries += 1; x = self.r.gauss(cx, rx * .5); z = self.r.gauss(cz, rz * .5)
            k = main if self.r.random() < .7 else self.r.choice(ks)
            if self.free(x, z, .12, avoid, .35, .02) and not self.near_terrace_edge(x, z, .6):
                self.put(k, x, z, self.r.uniform(.8, 1.15), self.r.random() < .5, block=False); n -= 1
    def pond(self, cx, cz, rx, rz, sand=True, reeds=12, lilies=6, deep=True, ducks=0, rocks=4, dip=.8):
        if sand: self.blob(cx, cz, rx + 1.1, rz + .9, 's', .25)
        self.blob(cx, cz, rx, rz, 'w', .25)
        if deep and rx > 3: self.blob(cx + .4, cz + .3, rx * .45, rz * .42, 'd', .3)
        tries = 0
        while reeds > 0 and tries < 200:
            tries += 1; a = self.r.uniform(0, 6.28); k = self.r.uniform(.92, 1.12); x, z = cx + math.cos(a) * rx * k, cz + math.sin(a) * rz * k
            if self.free(x, z, .2, 'pcqhaed', .5, .05): self.put(self.r.choice(['reeds', 'cattails']), x, z, self.r.uniform(.85, 1.15), x > cx, block=False); reeds -= 1
        for _ in range(lilies * 3):
            if lilies <= 0: break
            x, z = self.r.uniform(cx - rx, cx + rx), self.r.uniform(cz - rz, cz + rz)
            if self.at(x, z) in 'wd': self.put(self.r.choice(['pond_lily', 'pond_lily', 'lily_flowers']), x, z, self.r.uniform(.7, 1), self.r.random() < .5, block=False); lilies -= 1
        for _ in range(rocks):
            a = self.r.uniform(0, 6.28); x, z = cx + math.cos(a) * (rx + 1.2), cz + math.sin(a) * (rz + 1)
            if self.free(x, z, .3, 'pcqhaewd', .5): self.put(self.r.choice(['rocks_mossy', 'rocks', 'rock_flat']), x, z, self.r.uniform(.8, 1.1), self.r.random() < .5)
        if ducks: self.life('duck', ducks)
        self.hill(cx, cz, max(rx, rz) + 2, -dip)
    def life(self, k, n, **kw):
        L = self.d.setdefault('life', []); e = {'k': k, 'n': n}; e.update(kw); L.append(e)
    def plot(self, k, x, z, act='house', say=None, label=None, f=0, lawn='l', fence=True, decor=True):
        m = meta(k); w, d = m.get('box', [3, 2.2])
        if lawn:
            for xx in range(int(x - w / 2 - 1.5), int(x + w / 2 + 2.5)):
                for zz in range(int(z - 2.2), int(z + d + 1.2)):
                    if self.at(xx + .5, zz + .5) not in AV + 'ot': self.cell(xx + .5, zz + .5, lawn)
        p = self.building(k, x, z, act, label, say, f=f)
        door = x + (m.get('door') or {'x': 0})['x'] / PPU * (-1 if f else 1)
        if fence:
            for side in (-1, 1):
                fx = door + side * 2.1
                if abs(fx - x) < w / 2 + 1.4 and self.free(fx, z - 2.0, .5, AV, .4, .05): self.put('picket_fence', fx, z - 2.0, .9, block=True)
        if decor:
            r = self.r
            for _ in range(2):
                sx = x + r.choice((-1, 1)) * (w / 2 + r.uniform(.2, .9)); sz = z + r.uniform(-.6, d * .6)
                if self.free(sx, sz, .3, AV, .4, .05): self.put(r.choice(['@bush_round', 'bush_flower', 'planter_round', 'flowerpot']), sx, sz, r.uniform(.85, 1.05), r.random() < .5)
            self.drift(['@flowers', 'flowers_mixed'], x - w * .25, z - 1.1, w * .5, .5, 4)
            gx = x + r.choice((-1, 1)) * (w / 2 - .3)
            extra = r.choice(['garden_gnome', 'birdhouse', 'mailbox_red', 'mailbox_red', 'flowerpot'])
            if self.free(gx, z - 1.3, .2, AV, .3, .05): self.put(extra, gx, z - 1.3, 1, r.random() < .5)
            if r.random() < .45 and self.free(x, z + d + .9, .4, AV, .4): self.put('laundry_line', x + r.uniform(-.5, .5), z + d + .9, .9, block=False)
        return p
    # ---- v18: cliffs, terraces, ledges, ravines, stairs, bridges, streams and arches, all in the step field
    def terrace(self, x0, z0, x1, z1, h, wall=True, wobble=.6, mat=None, hop=False):
        """raised level ground with a vertical front: a cliff (natural) or a retaining wall (wall=True: dressed stone)"""
        self.cliff(x0, z0, x1, z1, h, mat if mat is not None else (5 if wall else 0), wobble, hop)
    def in_terrace(self, x, z, t):
        x0, z0, x1, z1, h, mat, wob = t[:7]
        o = (self.noise(x, z, 3.0, 31) - .5) * 2 * wob
        of = (self.noise(x, z0, 2.4, 37) - .5) * 1.6 * wob
        return x0 + o <= x <= x1 - o and z0 + of <= z <= z1 - o
    def cliff(self, x0, z0, x1, z1, h, mat=0, wobble=.6, hop=False):
        t = (x0, z0, x1, z1, h, mat, wobble); W2, H2 = 2 * self.W, 2 * self.H
        inside = set()
        for j in range(max(0, int(z0 * 2) - 4), min(H2, int(z1 * 2) + 5)):
            for i in range(max(0, int(x0 * 2) - 4), min(W2, int(x1 * 2) + 5)):
                if self.in_terrace((i + .5) / 2, (j + .5) / 2, t): inside.add((i, j))
        for i, j in inside:
            self.st[j][i] += h
            if h > 0 and mat: self.wm[j][i] = (self.wm[j][i] & 16) | mat
        nb = lambda i, j: ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1))
        if h < 0:
            # a ravine or a pit: the banks around it carry the wall material, nothing grows in it
            for i, j in inside:
                for a, b in nb(i, j):
                    if (a, b) not in inside and 0 <= a < W2 and 0 <= b < H2 and mat: self.wm[b][a] = (self.wm[b][a] & 16) | mat
            if h <= -.5: self.blocks.append((x0 + .2, z0 + .2, x1 - .2, z1 - .2)); self.voids |= inside
        else:
            self.terraces.append(t)
        if hop:
            for i, j in inside:
                if any((a, b) not in inside for a, b in nb(i, j)): self.wm[j][i] |= 16
        return inside
    def ledge(self, x0, z0, x1, z1, h=.7, mat=0, wobble=.4):
        """a low step of ground you can hop down from anywhere along its edge (and climb at a road's stairs)"""
        return self.cliff(x0, z0, x1, z1, h, mat, wobble, hop=True)
    def near_terrace_edge(self, x, z, m):
        for t in self.terraces:
            x0, z0, x1, z1 = t[:4]
            if x0 - m < x < x1 + m and z0 - m - 1 < z < z1 + m and (abs(z - (z0 - .5)) < m + .9 or abs(x - x0) < m + .6 or abs(x - x1) < m + .6 or abs(z - z1) < m + .6): return True
        return False
    def stv(self, i, j):
        i, j = max(0, min(2 * self.W - 1, i)), max(0, min(2 * self.H - 1, j)); return self.st[j][i]
    def total(self, i, j):
        return self.hat((i + .5) / 2, (j + .5) / 2) + self.stv(i, j)
    def stream(self, pts, width=1.0, speed=.6, banks='s'):
        """running water along a line (source first); it falls in a sheet wherever it drops over a step"""
        before = [row[:] for row in self.g]
        self.line(pts, 'w', width)
        for j in range(self.H):
            for i in range(self.W):
                if self.g[j][i] == 'w' and before[j][i] != 'w': self.stream_tiles.add((i, j))
        if banks:
            for (i, j) in list(self.stream_tiles):
                for a, b in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
                    if 0 <= a < self.W and 0 <= b < self.H and self.g[b][a] in 'gGflyt' and self.noise(a, b, 1.3, 77) > .45: self.g[b][a] = banks
        self.d.setdefault('streams', []).append({'pts': [[round(x, 2), round(z, 2)] for x, z in pts], 'speed': speed})
        for a, b in zip(pts, pts[1:]):
            n = int(math.hypot(b[0] - a[0], b[1] - a[1]) / .5) + 1
            for k in range(n + 1): self.clear.append((a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, width * .55))
    def arch(self, x, z, w=2.6, d=1.0, h=2.8, dir='z', kind='stone'):
        """an arch you walk under (x, z: the middle of its near face; it runs d metres along dir)"""
        self.d.setdefault('arches', []).append({'x': round(x, 2), 'z': round(z, 2), 'w': w, 'd': d, 'h': h, 'dir': dir, 'kind': kind})
        pr = .95 if kind == 'rock' else .55
        for s2 in (-1, 1):
            o = s2 * (w / 2 + pr / 2)
            if dir == 'z': self.blocks.append((x + o - pr / 2 - .3, z - .3, x + o + pr / 2 + .3, z + d + .3))
            else: self.blocks.append((x - .3, z + o - pr / 2 - .3, x + d + .3, z + o + pr / 2 + .3))
    def road_point(self, k, dist):
        """the point dist metres along road k, and the direction there"""
        pts = self.roads[k][0]; left = dist
        for a, b in zip(pts, pts[1:]):
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            if L >= left or b is pts[-1]:
                t = min(1, left / (L or 1)); return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), ((b[0] - a[0]) / (L or 1), (b[1] - a[1]) / (L or 1))
            left -= L
    def arch_on_road(self, k, dist, **kw):
        if k >= len(self.roads): return
        (x, z), (ux, uz) = self.road_point(k, dist); d = kw.get('d', 1.0)
        if abs(uz) >= abs(ux): self.arch(x, z - d / 2, dir='z', **kw)
        else: self.arch(x - d / 2, z, dir='x', **kw)
    # -- stairs
    def flight(self, axis, sgn, aH, b0, nw, into='low', mat=8, rails=None, tile=None):
        """a straight flight of stairs between a high cell row aH and the low ground on the other side (sgn: +1 when
        high is toward +axis); built out into the low ground, or cut back into the high ground"""
        W2, H2 = 2 * self.W, 2 * self.H
        def ij(a, b): return (b, a) if axis == 'z' else (a, b)
        def tot(a, b): i, j = ij(a, b); return self.total(i, j)
        def inb(a, b): i, j = ij(a, b); return 0 <= i < W2 and 0 <= j < H2
        bm = b0 + nw // 2
        if into == 'low':
            aL = aH - sgn; n = 4
            for _ in range(3):
                tH, tL = tot(aH, bm), tot(aL - sgn * n, bm); dh = tH - tL; n = max(1, math.ceil(abs(dh) / .26) - 1)
            cells = [aL - sgn * (n - 1 - k) for k in range(n)]           # bottom first
            land = [aH, aH + sgn]; tland = tH
        else:
            n = 4
            for _ in range(3):
                tL, tH = tot(aH - sgn, bm), tot(aH + sgn * n, bm); dh = tH - tL; n = max(1, math.ceil(abs(dh) / .26) - 1)
            cells = [aH + sgn * k for k in range(n)]
            land = [aH - sgn, aH - 2 * sgn]; tland = tL
        if dh < .3 or not all(inb(a, b) for a in cells for b in range(b0, b0 + nw)): return None
        # never fill a ravine or a pond with stairs
        for a in cells:
            for b in range(b0, b0 + nw):
                i, j = ij(a, b)
                if (i, j) in self.voids or self.at((i + .5) / 2, (j + .5) / 2) in 'wd': return None
        done = set()
        for b in range(b0, b0 + nw):
            for a in land:
                if inb(a, b): i, j = ij(a, b); self.st[j][i] = round(tland - self.hat((i + .5) / 2, (j + .5) / 2), 2); self.wm[j][i] &= 15
            for k, a in enumerate(cells):
                i, j = ij(a, b); y = tL + (k + 1) * dh / (n + 1)
                self.st[j][i] = round(y - self.hat((i + .5) / 2, (j + .5) / 2), 2); self.wm[j][i] = mat; done.add((i, j))
                if tile: self.cell((i + .5) / 2, (j + .5) / 2, tile)
        # ends in metres: bottom edge and top edge of the flight, middle of its width
        a_bot = (min(cells) if sgn > 0 else max(cells) + 1) / 2; a_top = (max(cells) + 1 if sgn > 0 else min(cells)) / 2
        mid = (b0 + nw / 2) / 2
        A, B = ((mid, a_bot), (mid, a_top)) if axis == 'z' else ((a_bot, mid), (a_top, mid))
        rec = {'a': [round(A[0], 2), round(A[1], 2)], 'b': [round(B[0], 2), round(B[1], 2)], 'w': nw / 2, 'cells': done, 'dh': dh}
        self.stairs.append(rec)
        if rails and dh >= .9:
            for side in (b0 / 2 + .12, (b0 + nw) / 2 - .12):
                p0 = (side, a_bot - sgn * .1) if axis == 'z' else (a_bot - sgn * .1, side)
                p1 = (side, a_top + sgn * .35) if axis == 'z' else (a_top + sgn * .35, side)
                self.d.setdefault('rails', []).append({'pts': [[round(p0[0], 2), round(p0[1], 2)], [round(p1[0], 2), round(p1[1], 2)]], 'kind': rails})
        return rec
    def auto_stairs(self, mat=8, rails=None, tile=None):
        """stairs wherever a road crosses a step too tall to walk up"""
        W2, H2 = 2 * self.W, 2 * self.H; used = set()
        for c in self.stairs: used |= c['cells']
        for pts, wd in self.roads:
            samp = []
            for a, b in zip(pts, pts[1:]):
                n = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / .2))
                for k in range(n): t = k / n; samp.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
            samp.append(tuple(pts[-1]))
            for p, q in zip(samp, samp[1:]):
                cp, cq = (int(p[0] * 2), int(p[1] * 2)), (int(q[0] * 2), int(q[1] * 2))
                if cp == cq or not (0 <= cp[0] < W2 and 0 <= cp[1] < H2 and 0 <= cq[0] < W2 and 0 <= cq[1] < H2): continue
                if cp in used or cq in used: continue
                if any(x0 <= p[0] <= x1 and z0 <= p[1] <= z1 for x0, z0, x1, z1 in self.nostairs): continue
                # only real steps (cliffs, terraces, ledges); a steep hillside stays a slope
                if abs(self.stv(*cq) - self.stv(*cp)) <= .3: continue
                tp, tq = self.total(*cp), self.total(*cq)
                if abs(tq - tp) <= .3: continue
                hi, lo = (cq, cp) if tq > tp else (cp, cq)
                ux, uz = q[0] - p[0], q[1] - p[1]
                axis = 'z' if (hi[0] == lo[0]) or (hi[1] != lo[1] and abs(uz) >= abs(ux)) else 'x'
                if axis == 'z': sgn = 1 if hi[1] > lo[1] else -1; aH = hi[1]; across = (p[0] + q[0]) / 2
                else: sgn = 1 if hi[0] > lo[0] else -1; aH = hi[0]; across = (p[1] + q[1]) / 2
                nw = max(2, math.ceil(wd * 2)); b0 = int(math.floor(across * 2 - nw / 2 + .5))
                r = self.flight(axis, sgn, aH, b0, nw, 'low', mat, rails, tile) or self.flight(axis, sgn, aH, b0, nw, 'high', mat, rails, tile)
                if r: used |= r['cells']
    def bridges_over(self, kind='wood', ravine_kind=None):
        """a bridge wherever a road runs over water or across a ravine"""
        W2, H2 = 2 * self.W, 2 * self.H; out = self.d.setdefault('bridges', [])
        def gap(x, z):
            if self.at(x, z) in 'wd': return 'w'
            i, j = int(x * 2), int(z * 2)
            if (i, j) in self.voids: return 'r'
            return None
        for pts, wd in self.roads:
            samp = []
            for a, b in zip(pts, pts[1:]):
                n = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / .2))
                for k in range(n): t = k / n; samp.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
            samp.append(tuple(pts[-1])); run = []; typ = None; dry = 0
            gaps = [gap(*p) for p in samp]
            for idx, p in enumerate(samp + [None]):
                g = gaps[idx] if p else None
                if not g and run and p is not None and any(gaps[idx:idx + 5]): g = typ   # a short dry stretch between two pools: one bridge
                if g:
                    if not run: first = idx
                    run.append(p); typ = typ or g; continue
                if len(run) >= 3 and p is not None and first > 0:
                    a, b = run[0], run[-1]; L = math.hypot(b[0] - a[0], b[1] - a[1]) or 1; ux, uz = (b[0] - a[0]) / L, (b[1] - a[1]) / L
                    ext = .8 if typ == 'r' else .6
                    A = [round(a[0] - ux * ext, 2), round(a[1] - uz * ext, 2)]; B = [round(b[0] + ux * ext, 2), round(b[1] + uz * ext, 2)]
                    if not any(math.hypot(o['a'][0] - A[0], o['a'][1] - A[1]) < 1.5 for o in out):
                        w = round(max(1.4, wd + .5), 2)
                        out.append({'a': A, 'b': B, 'w': w, 'kind': (ravine_kind or kind) if typ == 'r' else kind})
                        self.nostairs.append((min(A[0], B[0]) - w, min(A[1], B[1]) - w, max(A[0], B[0]) + w, max(A[1], B[1]) + w))
                run = []; typ = None
        if not out: del self.d['bridges']
    def bridge(self, a, b, w=1.6, kind='wood'):
        self.d.setdefault('bridges', []).append({'a': [round(a[0], 2), round(a[1], 2)], 'b': [round(b[0], 2), round(b[1], 2)], 'w': w, 'kind': kind})
        self.nostairs.append((min(a[0], b[0]) - w, min(a[1], b[1]) - w, max(a[0], b[0]) + w, max(a[1], b[1]) + w))
        L = math.hypot(b[0] - a[0], b[1] - a[1]) or 1; ux, uz = (b[0] - a[0]) / L, (b[1] - a[1]) / L
        self.roads.append(([[a[0] - ux * .8, a[1] - uz * .8], [b[0] + ux * .8, b[1] + uz * .8]], w * .7))
    def ramp(self, x0, x1, za, zb):
        """a gentle slope cut through a step between rows za (low) and zb (high), for streets"""
        for i in range(int(x0 * 2), int(math.ceil(x1 * 2))):
            lo, hi = self.total(i, int(za * 2) - 1), self.total(i, int(zb * 2))
            n = int(zb * 2) - int(za * 2)
            for k, j in enumerate(range(int(za * 2), int(zb * 2))):
                y = lo + (hi - lo) * (k + 1) / (n + 1); self.st[j][i] = round(y - self.hat((i + .5) / 2, (j + .5) / 2), 2); self.wm[j][i] = (self.wm[j][i] & 15) | 32
        self.stairs.append({'cells': {(i, j) for i in range(int(x0 * 2), int(math.ceil(x1 * 2))) for j in range(int(za * 2), int(zb * 2))}})
    def slope(self, x0, z0, x1, z1, up='+z'):
        """v23: a smooth ramp over the rectangle (step flag 32: the ground leans, no risers), climbing toward one side
        ('+z', '-z', '+x' or '-x') from the ground just outside its low end to the ground just outside its high end"""
        W2, H2 = 2 * self.W, 2 * self.H; ax, sg = up[1], (1 if up[0] == '+' else -1)
        I = [i for i in range(int(x0 * 2), int(math.ceil(x1 * 2))) if 0 <= i < W2]; J = [j for j in range(int(z0 * 2), int(math.ceil(z1 * 2))) if 0 <= j < H2]
        along, across = (J, I) if ax == 'z' else (I, J)
        if sg < 0: along = along[::-1]
        n, cells = len(along), set()
        for b in across:
            ij = (lambda a: (b, a)) if ax == 'z' else (lambda a: (a, b))
            lo, hi = self.total(*ij(along[0] - sg)), self.total(*ij(along[-1] + sg))
            for k, a in enumerate(along):
                i, j = ij(a); y = lo + (hi - lo) * (k + 1) / (n + 1)
                self.st[j][i] = round(y - self.hat((i + .5) / 2, (j + .5) / 2), 2); self.wm[j][i] = (self.wm[j][i] & 15) | 32; cells.add((i, j))
        self.stairs.append({'cells': cells})
    def plinths(self):
        """a building on a slope stands on a stone plinth, with steps down from its door"""
        for p in self.props:
            m = meta(p['k']); b = m.get('box')
            if not b or not m.get('door'): continue
            s = p.get('s', 1); w, d = b[0] * s, b[1] * s
            I = range(max(0, int((p['x'] - w / 2 - .3) * 2)), min(2 * self.W, int(math.ceil((p['x'] + w / 2 + .3) * 2))))
            J = range(max(0, int((p['z'] - .5) * 2)), min(2 * self.H, int(math.ceil((p['z'] + d + .2) * 2))))
            T = [self.total(i, j) for i in I for j in J]
            if not T or max(T) - min(T) < .35: continue
            top = max(T)
            for i in I:
                for j in J: self.st[j][i] = round(top - self.hat((i + .5) / 2, (j + .5) / 2), 2); self.wm[j][i] = 5
            dx = p['x'] + m['door']['x'] / PPU * s * (-1 if p.get('f') else 1)
            self.flight('z', 1, J[0], int(dx * 2) - 1, 2, 'low', 8)
    def encode_steps(self):
        flat = [v for row in self.st for v in row]; mats = [v for row in self.wm for v in row]
        if not any(abs(v) > .02 for v in flat) and not any(mats): return
        import struct
        raw = struct.pack('<%dh' % len(flat), *[max(-32000, min(32000, int(round(v * 20)))) for v in flat])
        self.d['steps'] = base64.b64encode(raw).decode()
        self.d['stepm'] = base64.b64encode(bytes(mats)).decode()
    def out(self, stair_mat=None, rails=None, stair_tile=None, bridge='wood', ravine_bridge=None):
        self.bridges_over(bridge, ravine_bridge)
        self.settle()
        for f in getattr(self, 'before_stairs', []): f()
        self.auto_stairs(stair_mat if stair_mat is not None else 8, rails, stair_tile)
        self.plinths()
        for f in getattr(self, 'after_stairs', []): f()
        self.encode_steps()
        self.d['tiles'] = [''.join(row) for row in self.g]
        self.d['props'] = sorted(self.props, key=lambda p: -p['z'])
        return self.d

TREES = ['@tree_oak', '@tree_oak', '@tree_pine', '@tree_birch', 'tree_fruit', 'tree_blossom', 'tree_maple']
LEAFY = ['@tree_oak', '@tree_oak', '@tree_birch', 'tree_blossom', 'tree_maple', 'tree_oak_autumn']
BUSH = ['@bush_round', 'bush_berry', 'bush_flower', '@flowers', '@flowers', '@fern']
FLOW = ['@flowers', '@flowers', 'bush_flower', '@bush_round']
UNDER = ('@fern', '@fern', '@bush_round', '@mushroom', 'stump', 'bush_berry')
CHAT_SUNDOWN = ['Welcome to Sundown! The Professor’s lab is up the steps at the back.', 'The clinic heals your team for free. Just walk up to the door.',
                'Tap the road sign to see where the road goes.', 'I once saw a billionaire try to buy a cloud.', 'The ducks on the pond have names. I won’t tell you them.',
                'Steps add up. My dog has walked to the Long Grass and back twice today.', 'The General Store sells Gold Cards. Very shiny.',
                'They built a whole city in the middle of the world. Capital Gains, they call it.']


def ground_mix(s, base, seed=0):
    """meadow, flowers, dirt and gravel in soft natural patches over plain grass"""
    s.patches('G', .62, 7, on=base, seed=seed + 1)
    s.patches('f', .7, 4.5, on=base + 'G', seed=seed + 2)
    s.patches('u', .8, 4.5, on=base + 'G', seed=seed + 3)


def shoulders(s, ch='u', w=.5):
    """worn dirt or gravel along the edges of every path"""
    for pts, wd in list(s.roads):
        for a, b in zip(pts, pts[1:]):
            n = int(math.hypot(b[0] - a[0], b[1] - a[1]) * 3) + 1; L = math.hypot(b[0] - a[0], b[1] - a[1]) or 1; nx, nz = -(b[1] - a[1]) / L, (b[0] - a[0]) / L
            for k in range(n + 1):
                t = k / n; x, z = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
                for side in (-1, 1):
                    if s.noise(x * 2, z * 2, 1.4, 40 + side) > .5:
                        q = (x + nx * side * (wd * .5 + w * .8), z + nz * side * (wd * .5 + w * .8))
                        if s.at(*q) in 'gGfl': s.cell(q[0], q[1], ch)


def town_sundown(D, i):
    s = Scene('sundown', 'Sundown', 'g', 1, 46, 34, far='hills', folk=6, chat=CHAT_SUNDOWN)
    hub = (23, 9.5)
    s.blob(23, 11.6, 7.4, 3.8, 'c', .06)
    s.terrace(3, 22, 43, 34, 1.7, wobble=.15)
    s.hub_exits(D, i, hub, lamps='streetlamp_b', width=1.1)
    s.stream([(5.6, 33.5), (5.8, 27), (6.2, 23.4), (6.8, 19.6)], .9, .5)
    s.road((23, 14.6), (23, 25.6), 'p', 1.3, amp=.1)
    s.blob(23, 27.4, 3.2, 1.7, 'c', .08)
    s.clear.append((23, 11.6, 7.5))
    ground_mix(s, 'g', 10)
    s.pond(7, 17.6, 3.6, 2.1, ducks=3, reeds=10, lilies=5, dip=.6)
    s.put('fountain', 23, 12.6)
    for x, z in ((19.4, 10.6), (26.6, 10.6)): s.put('bench_wood', x, z)
    for x, z in ((16.4, 9), (29.6, 9), (16.4, 14.2), (29.6, 14.2)): s.put('streetlamp', x, z)
    s.building('shop', 16, 16.6, 'shop')
    s.building('clinic', 30.4, 16.6, 'clinic')
    s.building('lab', 12.5, 26.2, 'lab', say='Professor: Every billionaire you meet adds to your Index. Walk, battle and catch them all!')
    s.plot('house_large', 34, 26.4, say='A note on the door: “Back in ten thousand steps.”')
    s.plot('house_red', 4.4, 9.6, say='You hear someone practicing the trombone. Badly.')
    s.plot('house_cottage', 9.6, 3.2, say='Nobody’s home. A cat watches you from the window.')
    s.plot('house_green', 38.6, 4.2, say='Someone inside is baking. It smells like cinnamon.')
    s.plot('house_blue', 41.6, 13.6, say='A wind chime tinkles by the door.', fence=False)
    s.put('well', 13.4, 12.4); s.put('sign_shop', 12.6, 15.6, act='shop'); s.put('sign_clinic', 34.2, 15.6, act='clinic')
    s.put('flag_pole', 27.6, 15.4); s.put('planter_box', 19.4, 15.2); s.put('planter_box', 26.6, 15.2)
    for x, z in ((20.2, 27), (25.8, 27)): s.put('bench_metal', x, z)
    s.put('streetlamp', 20.6, 25.2); s.put('streetlamp', 25.4, 25.2); s.put('statue', 23, 29.4)
    s.grove(8, 31, 5.5, 2.2, 8, LEAFY, under=UNDER)
    s.grove(38, 31.2, 5.5, 2.2, 7, LEAFY + ['@tree_pine'], under=UNDER)
    s.grove(43.5, 21, 2.4, 3, 4, ['@tree_pine', '@tree_oak'])
    s.grass(43, 7.6, 2.4, 3.2); s.grass(3, 27.4, 2.2, 2.6); s.grass(29, 31, 3, 1.6)
    s.drift(['@flowers'], 18, 5.2, 3, 1.4, 9); s.drift(['@flowers'], 30, 4.6, 3, 1.4, 8); s.drift(['@flowers', 'bush_flower'], 15, 23.6, 4, 1, 7)
    s.scatter(['@rocks', '@bush_round', 'pebbles', 'puddle', '@fern'], 10, (0, 0, 46, 21), gap=.6)
    s.frame(BUSH + ['tree_oak_small'], 10)
    s.life('pigeon', 5, area=[17, 8.5, 29, 15]); s.life('chicken', 3, area=[1, 5, 8, 8.5])
    s.rolling(.3, 5); s.hill(42, 17, 4, .8)
    def gate():
        for f in s.stairs:
            if 'a' in f and abs(f['a'][0] - 23) < 1.5: s.arch(f['b'][0], f['b'][1] + .15, 2.7, .8, 3.0, 'z', 'brick')
    s.after_stairs = [gate]
    return s.out(8, 'iron', 'c')


def route_grass(D, i):
    s = Scene('longgrass', 'The Long Grass', 'g', 2, 44, 34, far='hills')
    hub = (22, 11)
    s.terrace(30, 25, 46, 36, 1.9, wall=False)
    s.ledge(-1, 21.5, 18, 36, .8); s.ledge(26, 12.6, 45, 15.6, .7)
    s.hub_exits(D, i, hub, width=1.1)
    ground_mix(s, 'g', 20)
    for cx, cz, rx, rz in ((10, 18, 7, 4.4), (32, 18.5, 7.6, 4.2), (13, 5, 7, 2.6), (35, 6, 5, 2.8), (21, 27, 5, 2.4)): s.grass(cx, cz, rx, rz)
    s.put('mailbox', 25.6, 9.6); s.put('log', 25, 14.6); s.put('stump', 18.2, 14.4); s.put('campfire', 22.6, 15.6); s.put('bench_wood', 19.6, 15.8); s.put('firewood', 26.6, 16.6)
    for x in (3.2, 5.4): s.put('fence_wood', x, 13.2)
    s.put('fence_wood_post', 6.6, 13.2); s.put('billboard', 39, 12.4)
    s.grove(6, 29, 5.5, 3.2, 8, TREES, under=UNDER); s.grove(38, 30, 5.5, 2.4, 6, ['@tree_pine', '@tree_pine', '@tree_birch'])
    s.grove(4, 9.5, 2.8, 2.2, 4, LEAFY); s.grove(40, 19.5, 2.6, 2, 3, LEAFY)
    s.back(TREES, 31, 14)
    s.scatter(['@rocks', 'stump', '@bush_round', 'log', '@mushroom', 'rock_flat', '@fern', 'pebbles'], 16, (0, 0, 44, 25), avoid=AV + 't', gap=.6)
    s.drift(['@flowers'], 16, 11.5, 3, 1.6, 8); s.drift(['@flowers'], 29, 11.6, 3, 1.6, 7); s.drift(['@flowers'], 6, 22.5, 3, 1.4, 6)
    s.frame(BUSH + ['@rocks'], 9)
    s.rolling(.8, 5); s.hill(10, 18, 5, 1.2); s.hill(32, 18, 6, 1.4); s.rise_back(24, 1.6)
    return s.out(7, 'wood')


def route_golf(D, i):
    s = Scene('golf', 'Overgrown Golf Course', 'G', 3, 44, 34, far='forest', amb='pollen')
    hub = (22, 10)
    s.blob(22, 18, 13, 5, 'l', .12); s.blob(9, 25, 5.5, 3, 'l', .1); s.blob(34, 26, 5, 2.6, 'l', .1)
    for cx, cz, rx, rz in ((15, 21, 2.4, 1.3), (29, 15, 2, 1.1), (12, 28.2, 1.8, 1), (36.5, 23.8, 1.6, .9)): s.blob(cx, cz, rx, rz, 's', .15)
    s.ledge(16, 27, 24, 31, .9)
    for cx, cz, rx, rz in ((15, 21, 2.4, 1.3), (29, 15, 2, 1.1), (12, 28.2, 1.8, 1), (36.5, 23.8, 1.6, .9)):
        for j in range(int((cz - rz - 1) * 2), int((cz + rz + 1) * 2)):
            for i2 in range(int((cx - rx - 1) * 2), int((cx + rx + 1) * 2)):
                x, z = (i2 + .5) / 2, (j + .5) / 2
                if ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 < .8 and s.at(x, z) == 's': s.st[j][i2] -= .3; s.wm[j][i2] = 2
    s.hub_exits(D, i, hub, width=1.1)
    s.patches('u', .76, 3.5, on='G', seed=31)
    s.pond(37, 8, 4.2, 2.4, ducks=4, reeds=12, lilies=6)
    s.grass(7, 9, 4.4, 2.8); s.grass(40, 30, 3.4, 2.4); s.grass(4, 18, 2.8, 3.2)
    s.put('flag', 9, 25.6); s.put('flag', 34.4, 26.4); s.put('flag', 20, 29); s.put('cart', 17, 12.4); s.put('bench_wood', 26.6, 11.2); s.put('busstop', 5.6, 13.2)
    s.put('bunker', 22, 22.4, 1, block=False); s.put('cart', 30.6, 21.6, 1, 1)
    for x, z in ((33, 11.6), (41.4, 11.4)): s.put('tree_willow', x, z, s.r.uniform(.9, 1.05), x > 37)
    s.back(['tree', '@tree_oak', '@tree_birch', 'tree_blossom', '@tree_pine', 'tree_maple'], 30.5, 16)
    s.scatter(['tree_maple', '@tree_oak', 'tree_blossom'], 6, (0, 4, 44, 28), avoid=AV + 'lst', gap=1.4)
    s.scatter(['@bush_round', '@flowers', '@rocks', 'tree_oak_small', 'pebbles'], 12, (0, 0, 44, 28), avoid=AV + 'lst', gap=.7)
    s.drift(['@flowers'], 27, 6, 3, 1.2, 7)
    s.frame(BUSH, 8)
    s.rolling(.5, 6); s.hill(22, 18, 6, .7); s.hill(9, 25, 3, .5); s.rise_back(26, 1.4)
    return s.out(7, 'wood')


def route_thicket(D, i):
    s = Scene('thicket', 'Bramble Thicket', 'G', 4, 44, 34, sky=['#7FB8D8', '#B3D9E6', '#E2E8C8'], haze='#C9D8B8', hazeD=28, amb='spore', far='forest', rays=1, waterKind='swamp')
    hub = (22, 10.5)
    s.terrace(13, 26, 31, 36, 1.5, wall=False)
    s.cliff(-1, 20.4, 45, 23.2, -1.3, mat=9, wobble=.5)
    s.hub_exits(D, i, hub, width=1.1)
    s.stream([(-.5, 21.8), (12, 21.6), (24, 22.0), (36, 21.7), (44.5, 21.9)], 1.0, .7, banks='u')
    s.stream([(36.2, 33.5), (36.4, 27.5), (36.1, 23.6), (36, 22.2)], .9, .9, banks='u')
    # v24: a ramp where the road climbs onto the back terrace (the road moved when the map was spread out)
    for pts, w in list(s.roads):
        for a, b in zip(pts, pts[1:]):
            if (a[1] - 26.2) * (b[1] - 26.2) <= 0 and a[1] != b[1] and 13 < a[0] < 31:
                xc = a[0] + (b[0] - a[0]) * (26.2 - a[1]) / (b[1] - a[1]); s.slope(xc - 1.4, 24.6, xc + 1.4, 29.0, '+z')
    shoulders(s, 'u')
    s.patches('y', .5, 6, on='Gg', seed=41)
    s.grass(12, 19, 5.4, 3.2); s.grass(32, 6, 6, 2.6); s.grass(8, 5, 4, 2.2); s.grass(33, 19, 3, 2)
    s.put('mushroom_giant', 28.6, 16); s.put('mushroom_giant', 35, 13.4, .8, 1); s.put('log', 17, 14.6); s.put('stump', 26.4, 8.4); s.put('mushroom_giant', 16, 27.8, .9)
    s.grove(7, 30, 6.5, 3.2, 11, ['@tree_pine', '@tree_pine', '@tree_oak', '@tree_birch'], under=UNDER, leaves=3)
    s.grove(37, 28, 6.5, 3.6, 11, ['@tree_pine', '@tree_oak', 'tree', 'tree_maple'], under=UNDER, leaves=3)
    s.grove(38, 13.5, 3.8, 3, 6, LEAFY, under=UNDER); s.grove(5, 13.5, 3.2, 2.6, 5, ['@tree_pine', '@tree_birch'], under=UNDER)
    s.back(['@tree_pine', '@tree_pine', '@tree_oak', '@tree_birch', 'tree'], 32, 18, gap=0)
    s.scatter(['bush_berry', '@bush_round', '@mushroom', '@mushroom', 'stump', 'log', 'hedge', '@rocks', '@fern', '@fern', 'fallen_leaves'], 24, (0, 1, 44, 25), avoid=AV + 't', gap=.4)
    s.frame(['@bush_round', 'bush_berry', '@mushroom', 'tree_pine_small', '@fern'], 10)
    s.rolling(.9, 4); s.rise_back(20, 1.6); s.hill(36, 14, 3.5, 1.1)
    return s.out(7, 'wood', None, 'wood', 'wood')


def town_grotto(D, i):
    s = Scene('grotto', 'Bubbling Grotto', 'k', 5, 46, 34, sky=['#2A2440', '#3E3658', '#5C5070'], haze='#4A4060', hazeD=26, amb='drip', tint='#2A2448', indoor=1, far='cave', farH=9, folk=4,
              chat=['Mind the drips. They’re warm.', 'The crystals hum at night. Very relaxing.', 'Supply Co. has everything a spelunker needs.', 'Somebody built a hot tub in the spring. We don’t talk about it.',
                    'The upper ledge has the best view of the springs.'])
    hub = (23, 9.6)
    s.blob(23, 11.6, 6.6, 3.4, 'c', .08)
    s.terrace(2, 21, 44, 36, 2.2, wall=False)
    s.cliff(3.6, 11.2, 9.8, 19.6, -.5, mat=3, wobble=.3); s.cliff(3.6, 11.2, 9.8, 15.4, -.5, mat=3, wobble=.3)
    s.hub_exits(D, i, hub, road='p', width=1.1, lamps='lantern_b')
    s.road((23, 14.6), (23, 25.4), 'p', 1.3, amp=.2)
    s.blob(23, 27, 3, 1.6, 'c', .1)
    s.clear.append((23, 11.6, 7))
    s.blob(6.7, 17.6, 2.2, 1.5, 'w', .15); s.blob(6.9, 13.4, 2.3, 1.5, 'w', .15)
    s.stream([(6.4, 33.5), (6.5, 24), (6.7, 18.6), (6.9, 14.5), (6.8, 10), (6.6, 7.4)], 1.1, .8, banks=None)
    s.patches('r', .62, 5, on='k', seed=51); s.patches('v', .75, 3, on='k', seed=52)
    s.building('cave_house', 14.6, 16.4, 'clinic', label='Clinic')
    s.building('tent', 31.4, 16.6, 'shop', label='Supply Co.')
    s.building('cave_house', 37, 25.6, 'house', f=1, say='Someone snores loudly inside. The whole cave echoes.')
    s.building('cave_house', 9, 26, 'house', say='A sign: “Hot spring tours, ask inside.”')
    s.put('campfire', 23, 12.6); s.put('crates', 27.6, 13.6); s.put('barrel_wood', 28.8, 13.2); s.put('sack', 18.2, 13.8); s.put('crate', 19, 14.4)
    for x, z in ((17.4, 9.2), (28.6, 9.2), (20.6, 25), (25.4, 25)): s.put('lantern_b', x, z)
    s.pond(6.6, 6.4, 3.2, 1.7, sand=False, reeds=0, lilies=0, deep=True, rocks=3, dip=.3); s.pond(40, 8.6, 2.8, 1.5, sand=False, reeds=0, lilies=0, rocks=3, dip=.3)
    s.pond(30, 30, 3, 1.4, sand=False, reeds=0, lilies=0, rocks=2, dip=.2)
    s.clump(['@crystal'], 10.4, 11.2, 3, 1.4); s.clump(['@crystal', '@mushroom'], 42, 15, 5, 2.4); s.clump(['@crystal'], 16, 31, 4, 2)
    s.back(['@stalagmite', '@stalagmite', '@crystal', '@boulder', '@rocks'], 30, 18)
    s.grass(41, 4.4, 3, 2); s.grass(40, 30, 3, 1.6)
    s.scatter(['@mushroom', '@rocks', '@stalagmite', '@boulder', 'pebbles'], 14, (0, 0, 46, 33), avoid=AV + 't', gap=.6)
    s.frame(['@rocks', '@crystal', '@mushroom', 'stalagmite_b'], 9)
    s.rolling(.3, 3.5)
    def portal():
        for f in s.stairs:
            if 'a' in f and abs(f['a'][0] - 23) < 1.5 and f['dh'] > 1.5: s.arch(f['b'][0], f['b'][1] + .1, 2.8, 1.6, 3.1, 'z', 'rock')
    s.after_stairs = [portal]
    return s.out(3, 'wood')


def route_canyon(D, i):
    s = Scene('canyon', 'Stairstep Canyon', 's', 6, 44, 34, sky=['#8CC2E2', '#D6E6E4', '#F6E2BE'], haze='#F0D9B2', hazeD=42, amb='sand', far='canyon')
    hub = (22, 8)
    for z0, h in ((14, 1.5), (20, 1.5), (26, 1.6)): s.terrace(-1, z0, 45, 36, h, wall=False, wobble=1.2)
    s.hub_exits(D, i, hub)
    s.arch_on_road(0, 4.2, w=3.0, d=1.4, h=3.4, kind='rock')
    s.patches('r', .5, 5, box=(0, 13, 44, 34), seed=61); s.patches('v', .77, 4, on='s', seed=62); s.patches('u', .76, 4, on='s', seed=63)
    s.put('mesa', 6, 30); s.put('mesa', 24, 31, 1.1); s.put('mesa', 38, 29.6, .9, 1)
    s.grass(33, 11, 3.4, 2.2, .5); s.grass(8, 10, 2.6, 2, .5); s.grass(14, 23, 3, 1.4, .5)
    s.scatter(['@boulder', '@stalagmite', '@rocks', 'rock_flat'], 14, (0, 14, 44, 30), gap=.5)
    s.scatter(['@cactus', 'cactus', '@rocks', 'dry_bush', 'dry_bush', '@boulder', 'pebbles'], 22, (0, 0, 44, 14), avoid=AV + 'rt', gap=.8)
    s.put('log', 27, 5.6); s.put('campfire', 16, 11.4); s.put('tent', 12, 12.2)
    s.clump(['@cactus', 'dry_bush', '@rocks'], 9, 5, 5, 2.6); s.clump(['@boulder', '@rocks', 'dry_bush'], 31, 5.6, 5, 2.6); s.clump(['@cactus', 'dry_bush'], 36, 18.6, 4, 1.6)
    s.frame(['dry_bush', '@rocks', 'cactus_round'], 8)
    s.rolling(.3, 4)
    return s.out(2)


def route_scrap(D, i):
    s = Scene('scrapyard', 'Scrap Yard', 'x', 7, 44, 34, sky=['#8FB6CF', '#C9D9DE', '#E8DCC6'], haze='#D8CCB8', amb='dust', far='town')
    hub = (22, 9.4)
    s.patches('v', .55, 5, seed=71); s.patches('u', .7, 3.5, seed=72)
    s.blob(29, 20, 7, 3.4, 'a', .25)
    s.terrace(-1, 26, 45, 36, 1.4, wall=False, wobble=.3, mat=10)
    s.hub_exits(D, i, hub)
    s.grass(8, 15, 3.6, 2.4, .5); s.grass(36, 5, 3.6, 2, .5); s.grass(12, 29, 3, 1.6, .5)
    s.put('derrick', 37, 29.6); s.put('billboard', 8, 22.6)
    s.put('car_red', 26, 20.6, 1, 0); s.put('car_blue', 33, 21.4, 1, 1); s.put('car_yellow', 30, 17.6, .95, 1)
    s.scatter(['scrap', 'scrap', 'tires', 'crates', 'barrel', 'bin', 'trash', 'cartS', 'pipe'], 26, (0, 12, 44, 33), avoid='pwdae', gap=.3)
    s.scatter(['tires', 'crate', '@rocks', 'pipe', 'barrel', 'dry_bush', 'puddle'], 14, (0, 0, 44, 12), avoid=AV + 't', gap=.6)
    s.clump(['scrap', 'tires', 'barrel', 'crates'], 13, 9, 5, 2.6); s.clump(['cartS', 'bin', 'trash', 'pipe', 'tires'], 32, 8.4, 5, 2.6)
    s.frame(['tires', 'crate', 'dry_bush', '@rocks'], 7)
    s.life('pigeon', 4, area=[20, 15, 38, 24])
    s.rolling(.3, 4); s.hill(9, 20, 4, 1.2); s.hill(30, 27, 6, .9)
    return s.out(10, 'iron')


def town_food(D, i):
    s = Scene('foodcourt', 'The Food Court', 'g', 8, 46, 34, sky=['#8CC6E6', '#BFE3EE', '#F6E6C6'], haze='#F2DFC4', amb='pollen', far='town', folk=7,
              chat=['The pretzels here are legendary.', 'I come for the fountain. I stay for the fries.', 'They say the Mall of the Deep sells everything. Even rain.', 'Try the lemonade at the cart!',
                    'The food truck moves every day. Today it’s right here.'])
    hub = (23, 9)
    s.blob(23, 12.6, 10.5, 5, 'h', .06)
    s.terrace(1, 25, 45, 36, 1.3, wobble=.15, mat=4)
    s.hub_exits(D, i, hub, lamps='streetlamp_b', width=1.1)
    s.clear.append((23, 12.6, 9))
    ground_mix(s, 'g', 80)
    s.put('fountain_big', 23, 14.2)
    s.building('pretzel', 12.4, 19.2, 'shop', label='Pretzel Pavilion', path=False)
    s.building('clinic', 31.6, 19.4, 'clinic')
    s.building('shop_boutique', 38.6, 19.6, 'shop', label='Personal Best Sports', shop='sports')
    s.building('stall', 5.6, 16, 'talk', say='Fresh fruit! Nothing here costs a billion. Yet.', path=False)
    s.put('food_truck', 24, 19.6, act='talk', say='Food truck: “Today’s special: a deep-fried pretzel. Tomorrow’s special: also that.”')
    s.put('market_cart', 33, 8.6, act='talk', say='Lemonade, one dollar. Billionaires pay double.')
    s.plot('house_large', 9, 27.6, say='Closed for a nap.'); s.plot('house_blue', 37.6, 27.8, say='It smells like popcorn in there.')
    s.building('shop_cafe', 23.4, 27.4, 'talk', say='Café: “Two coffees, one for each foot. It’s a long road.”')
    for x, z in ((16.6, 11.6), (29.4, 11.6), (17.4, 16), (28.6, 16), (19, 8.6), (27, 8.6)): s.put('cafe_table', x, z)
    for x, z in ((6.4, 7), (39.4, 6.4)): s.put('picnic', x, z)
    for x, z in ((12.6, 10), (33.4, 10), (12.6, 15), (33.4, 15)): s.put('planter_round', x, z)
    s.put('trash_city', 31.4, 13.6); s.put('bench_metal', 23, 17.2); s.put('vending', 35.2, 15.8); s.put('banner_pole', 13.6, 7.2); s.put('banner_pole', 32.4, 7.2)
    s.grove(4, 31, 3.4, 2, 4, ['tree_fruit', 'tree_fruit_b', 'tree_blossom'], floor=None, under=None)
    s.grove(43, 31, 2.6, 2, 3, ['tree_fruit', 'tree_fruit_b'], floor=None, under=None)
    s.back(['tree_fruit', 'tree_fruit_b', '@tree_oak', 'tree_blossom', '@tree_birch'], 32.2, 10)
    s.grass(42.4, 4, 2.6, 1.8); s.grass(3, 12, 2.2, 2)
    s.drift(['@flowers'], 16, 4, 3, 1.2, 8); s.drift(['@flowers'], 31, 4, 3, 1.2, 8)
    s.frame(FLOW + ['flowerpot'], 10)
    s.life('pigeon', 6, area=[14, 9, 32, 17])
    s.rolling(.2, 6)
    return s.out(8, 'iron', 'h')


def town_mall(D, i):
    s = Scene('mall', 'Mall of the Deep', 'm', 9, 46, 34, sky=['#1C1A34', '#2C2A50', '#4A4676'], haze='#3E3A68', hazeD=32, amb='dust', tint='#2A2850', indoor=1, far='mall', farH=9, folk=8, cliff='q',
              chat=['I’ve been looking for the exit since Tuesday.', 'The escalators go up forever. I checked.', 'Everything’s on sale. Nobody knows what the original price was.', 'The Concierge Desk can get you anything. Anything.',
                    'Maison Margin is up on the mezzanine. Bring a wheelbarrow of money.'])
    hub = (23, 9)
    s.blob(23, 11.6, 12, 5.2, 'c', .05)
    s.terrace(2, 21, 44, 36, 1.8, wall=False, wobble=0)
    s.hub_exits(D, i, hub, road='c', width=1.6, signs=True)
    for x in (15, 31): s.road((x, 15.5), (x, 25), 'c', 1.8, amp=0)
    s.blob(23, 27, 15, 3, 'c', .05)
    s.clear.append((23, 11.6, 9))
    s.building('shop', 11.6, 16.4, 'shop', label='Concierge Desk', path=False)
    s.building('clinic', 34.6, 16.4, 'clinic', path=False)
    s.building('shop_boutique', 23, 28.6, 'shop', label='Maison Margin', shop='designer', path=False)
    s.building('shop_mart', 9.4, 28.8, 'talk', say='Mall Mart: “Aisle 400: Bigger Aisles.”', path=False)
    s.put('kioskP', 23, 17.2, act='talk', say='Kiosk: “Try our new scented air. Only 9.99!”'); s.put('stall', 4.4, 12)
    s.put('fountain', 23, 12.4)
    for x, z in ((13.6, 10.6), (32.4, 10.6), (13.6, 14), (32.4, 14)): s.put('planter', x, z)
    for x, z in ((18.6, 7.6), (27.4, 7.6), (18, 26.4), (28, 26.4)): s.put('bench', x, z)
    for x, z in ((3.4, 5.4), (42.6, 5.4), (40, 12.2)): s.put('salesign', x, z)
    s.put('cartS', 35, 8); s.put('trash', 8.4, 7.6); s.put('vending', 41, 16.6); s.put('vending', 5.4, 17)
    for x, z in ((10, 6.6), (36, 6.6), (10, 14.6), (36, 14.6), (17, 24.6), (29, 24.6)): s.put('lamp', x, z)
    s.scatter(['planter', 'bench', 'trash', 'salesign', 'cartS', 'planter_round'], 8, (0, 1, 46, 32), avoid='cw', gap=.9)
    def escalators():
        for f in s.stairs:
            if 'a' in f and f['w'] >= 1.5: s.d.setdefault('escalators', []).append({'a': f['a'], 'b': f['b'], 'w': f['w']})
    s.after_stairs = [escalators]
    return s.out(10)


def route_pond(D, i):
    s = Scene('pond', 'Willow Pond', 'g', 10, 44, 34, sky=['#88C4E4', '#BEE2EC', '#F2EACB'], haze='#DCE6D0', far='forest', rays=1, amb='pollen')
    hub = (22, 8.5)
    s.terrace(-1, 27.4, 45, 36, 1.4, wall=False, wobble=.8, mat=9)
    s.hub_exits(D, i, hub)
    s.pond(22, 19.6, 9, 4.8, ducks=6, reeds=20, lilies=9, dip=1.0)
    s.stream([(29.2, 33.6), (28.8, 29.5), (27.4, 26.2), (25.6, 24.0)], 1.0, .7)
    s.bridge((28.2, 14.9), (28.2, 24.6), 1.4, 'wood')
    s.rect(14.6, 14, 16.2, 19.6, 'b'); s.put('dock_post', 14.4, 19.4); s.put('dock_post', 16.4, 19.4); s.put('rowboat', 18.2, 18.6, .9)
    s.road(hub, (15.4, 13.8), 'p', .9, amp=.3)
    ground_mix(s, 'g', 100); shoulders(s, 'u')
    for k, (x, z) in enumerate(((31.6, 15.4), (31, 17), (31.4, 18.8))): s.put('stepping', x, z, 1, k % 2, block=False)
    s.put('bench_wood', 22, 12.6); s.put('log', 29, 11.6); s.put('campfire', 36, 14.4); s.put('tent', 38.6, 17); s.put('firewood', 34.6, 17.6)
    for x, z in ((9.6, 16.6), (34.4, 22.6), (12, 25.6)): s.put('tree_willow', x, z, s.r.uniform(.95, 1.1), x > 22)
    s.grass(6, 9, 4, 3); s.grass(37, 7, 4, 2.4); s.grass(5, 27, 3, 2)
    s.grove(37, 29, 5.5, 3, 7, ['@tree_birch', '@tree_birch', '@tree_oak', 'tree_blossom'], under=UNDER)
    s.grove(6, 31, 5, 2.4, 6, ['@tree_birch', 'tree_maple', '@tree_oak'], under=UNDER)
    s.back(['@tree_birch', '@tree_birch', '@tree_oak', 'tree_blossom', '@tree_pine'], 30, 14)
    s.scatter(['@flowers', '@rocks', '@bush_round', 'bush_flower', '@mushroom', '@fern', 'pebbles'], 16, (0, 0, 44, 28), avoid=AV + 'st', gap=.5)
    s.drift(['@flowers'], 27, 10, 3, 1.4, 8); s.drift(['@flowers', 'bush_flower'], 13, 9.6, 3, 1.4, 7)
    s.frame(['@flowers', '@bush_round', 'rocks_mossy', 'bush_flower'], 9)
    s.rolling(.45, 4); s.rise_back(24, 2.4); s.hill(39, 15, 4, .9); s.hill(5, 14, 3.5, .7)
    return s.out(7, 'wood')


def town_farm(D, i):
    s = Scene('farm', 'Hillside Farm', 'g', 11, 46, 34, sky=['#8CC8EA', '#C4E4EE', '#F6E8C4'], haze='#EADDC0', far='farm', folk=4, wind=1.2,
              chat=['The windmill grinds our flour. And sometimes our nerves.', 'Help yourself to an apple. Just one!', 'The hay bales are not for sitting. Fine, they are.', 'Our clinic is small but the nurse is very kind.',
                    'Don’t chase the chickens. They know where you live.', 'The sheep are called Wool, Wooler and Woolest.'])
    hub = (23, 9.4)
    s.blob(23, 10.8, 4.6, 2.6, 'c', .15)
    s.terrace(2, 15, 16, 22, .9, wall=False, wobble=0, mat=7); s.terrace(30, 15, 44, 22, .9, wall=False, wobble=0, mat=7); s.terrace(-1, 25, 47, 36, 1.4, wall=False, wobble=.8, mat=9)
    s.hub_exits(D, i, hub)
    s.clear.append((23, 10.8, 5))
    s.stream([(24.2, 33.6), (24, 26.6), (23.6, 22.6), (24.4, 18.6), (24.2, 16.4)], .9, .6)
    s.pond(24.2, 15.6, 2.2, 1.0, sand=False, reeds=4, lilies=2, deep=False, rocks=0, dip=.3)
    s.bridge((21.9, 20.6), (26.3, 20.6), 1.3, 'wood')
    ground_mix(s, 'g', 110); shoulders(s, 'u')
    s.rect(3, 15.6, 15, 21.4, 'o'); s.rect(31, 15.6, 43, 21.4, 'o')
    for z in (16.2, 17.6, 19, 20.4):
        for x in (4.4, 7.2, 10, 12.8): s.put('crops', x, z, 1, block=False)
        for x in (32.4, 35.2, 38, 40.8): s.put('crops', x, z, 1, block=False)
    s.put('scarecrow', 9, 18.4); s.put('scarecrow', 37, 18.2, 1, 1)
    for x in (4, 6.2, 8.4, 10.6, 12.8):
        s.put('fence_wood', x, 3.4); s.put('fence_wood', x, 9.4)
    s.put('fence_wood_post', 2.9, 6.4); s.put('fence_wood_post', 13.9, 6.4)
    s.life('sheep', 4, area=[4, 4.4, 13, 8.6])
    s.put('windmill_tower', 37, 29.6); s.put('windmill_tower', 9, 30.4, .8, 1)
    s.building('clinic', 27.6, 16.6, 'clinic')
    s.plot('house_cottage', 18.4, 16.4, say='Grandma Ada waves at you from the window.', fence=False)
    s.plot('house_red', 39.6, 7.6, say='A sign: “Fresh eggs. Knock twice.”')
    s.life('chicken', 5, area=[30, 3, 38, 9])
    s.put('market_cart', 28.6, 8, act='talk', say='Apples! Pears! Absolutely no billionaires in the pies.')
    for x, z in ((15.6, 10.6), (16.8, 11.6), (30.6, 11.6), (44, 12)): s.put('haybale', x, z, 1, x > 20)
    s.put('well', 19, 6.6); s.put('barrel_wood', 26.6, 12.2); s.put('sack', 25.8, 11.4); s.put('wheelbarrow', 33, 13.6); s.put('beehive', 44, 23); s.put('beehive', 42.6, 23.6)
    s.put('firewood', 20.4, 21.6); s.put('birdhouse', 16, 13.6)
    s.grove(28, 29.6, 6, 2.6, 7, ['tree_fruit', 'tree_fruit_b'], floor=None, under=None, gap=.6)
    s.grove(4, 11.6, 2.2, 2, 3, ['tree_fruit', 'tree_fruit_b'], floor=None, under=None)
    s.back(['@tree_oak', 'tree_fruit', '@tree_birch', 'tree_blossom', 'tree_maple'], 32.6, 12)
    s.grass(44, 17, 2, 3); s.grass(2, 24, 2, 1.6); s.grass(19, 28, 3, 1.6)
    s.scatter(['@flowers', '@bush_round', 'bush_flower', 'haybale', 'pebbles'], 10, (0, 0, 46, 25), avoid=AV + 'ot', gap=.6)
    s.drift(['@flowers'], 30, 3.6, 3, 1.2, 6)
    s.frame(FLOW, 9)
    s.rolling(.2, 6)
    return s.out(7, 'wood')


def route_ridge(D, i):
    s = Scene('ridge', 'Lookout Ridge', 'r', 12, 44, 34, sky=['#7FBCE8', '#BFE0F0', '#EEF2EA'], haze='#DCE6EE', hazeD=48, far='mountains', farH=9, amb='dust', wind=1.6)
    hub = (22, 9)
    s.terrace(-1, 15, 45, 36, 1.8, wall=False, wobble=1.4); s.terrace(-1, 24, 45, 36, 2.0, wall=False, wobble=1.6, mat=11)
    s.cliff(-1, 27.6, 45, 30.0, -3.2, mat=11, wobble=.45)
    s.ledge(27, 2.8, 40, 6.6, .7)
    s.hub_exits(D, i, hub)
    s.road((22, 10.6), (22.4, 33.2), 'p', 1.0, amp=.3)
    s.put('bench_wood', 20.6, 32.6); s.put('flag_pole', 24.4, 33.0)
    s.patches('g', .48, 6, seed=121); s.patches('G', .62, 5, on='g', seed=122); s.patches('v', .7, 3, on='r', seed=123)
    s.grass(10, 19, 4, 2.2); s.grass(33, 6, 4, 1.8); s.grass(33, 19.6, 3, 1.8); s.grass(16, 28, 3, 1.6)
    s.put('bench_wood', 22, 4.6); s.put('campfire', 28, 10.6); s.put('tent', 32, 12.4); s.put('firewood', 30, 13.2); s.put('flag_pole', 16.6, 4.4)
    s.grove(8, 32, 6, 1.6, 7, ['@tree_pine', '@tree_pine', '@boulder'], floor=None, under=('@rocks', 'dry_bush', '@fern'))
    s.grove(37, 32, 6, 1.6, 7, ['@tree_pine', '@tree_pine', 'tree_pine_small'], floor=None, under=('@rocks', 'dry_bush'))
    s.scatter(['@boulder', '@rocks', '@tree_pine', 'dry_bush', '@bush_round', 'rock_flat'], 18, (0, 0, 44, 24), avoid=AV + 't', gap=.8)
    s.clump(['@tree_pine', '@boulder', 'dry_bush'], 9, 9, 5, 2.6); s.clump(['@rocks', '@bush_round', 'tree_pine_small'], 36, 16, 4, 2)
    s.frame(['@rocks', 'dry_bush', '@boulder'], 7)
    s.rolling(.4, 4); s.hadd(lambda x, z: -5.5 * max(0, min(1, (2.2 - z) / 1.6)) ** 1.3)
    return s.out(7, 'wood', None, 'wood', 'rope')


# ---------------------------------------------------------------------------------------------- the city
CHAT_CITY = ['Welcome to Capital Gains! Mind the traffic, the cars only stop for pedestrians and pigeons.', 'Capital Tower has forty floors. I’ve only seen six of them.',
             'The Capital Outlet sells last season from every boutique. Same prices, more mirrors.', 'The golden coin on the plaza is solid gold. Don’t lick it. I tried.',
             'Rent here is a billionaire’s favourite snack.', 'The park by the pond is the quietest place in town. Except for the ducks.',
             'Broker Bea battles anyone on the plaza. She calls it “market research”.', 'The upper street has the best view of the fountain.']


def city(D, i):
    W, H = 64, 48
    s = Scene('city', 'Capital Gains', 'g', 13, W, H, far='town', folk=10, chat=CHAT_CITY, sky=['#86C0E6', '#BEDCEC', '#F2E6CE'], haze='#E6DACA', hazeD=44)
    AVE_A, AVE_B = (12, 15), (29, 32)          # asphalt bands (z from, to)
    STREETS = ((20, 23), (42, 45))             # north-south asphalt (x from, to)
    # park in front, lawns behind the blocks
    s.rect(0, 0, W, 10.4, 'l'); s.patches('G', .6, 5, box=(0, 0, W, 10.4), seed=131)
    s.rect(0, 16.6, W, 27.4, 'l'); s.rect(0, 33.6, W, H, 'g')
    # avenues and streets with pavement on both sides
    for z0, z1 in (AVE_A, AVE_B):
        s.rect(0, z0 - 1.6, W, z0, 'q'); s.rect(0, z1, W, z1 + 1.6, 'q'); s.rect(0, z0, W, z1, 'a')
    for x0, x1 in STREETS:
        s.rect(x0 - 1.4, AVE_A[1], x0, H, 'q'); s.rect(x1, AVE_A[1], x1 + 1.4, H, 'q'); s.rect(x0, AVE_A[0], x1, H, 'a')
    # the plaza between the streets, bricks
    s.rect(23, 16.6, 42, 27.4, 'h'); s.rect(23, 10.4, 42, 12, 'h')
    hub = (32.5, 18.2); s.d['hub'] = list(hub)
    # park paths and pond
    s.road((32.5, 10.4), (32.5, 1), 'v', 1.4, amp=.6, keep='')
    s.road((5, 10.4), (14, 4), 'v', 1.1, amp=.8, keep=''); s.road((60, 10.4), (50, 3.6), 'v', 1.1, amp=.8, keep='')
    s.pond(14.6, 5.4, 5, 2.3, ducks=4, reeds=10, lilies=5, dip=.5, rocks=3)
    s.pond(50, 5.6, 3.6, 2, sand=False, ducks=2, reeds=6, lilies=3, deep=False, dip=.4)
    s.cliff(20, 4, 46, 7, -.8, mat=5, wobble=0); s.rect(20, 4, 46, 7, 'w')
    for x in range(20, 46):
        for z in range(4, 7): s.stream_tiles.add((x, H - 1 - z))
    s.d.setdefault('streams', []).append({'pts': [[19.5, 5.5], [46.5, 5.5]], 'speed': .25})
    # the upper town stands on a terrace; the streets climb to it, a wall faces the avenue
    s.terrace(-1, 33.6, W + 1, H + 2, 1.5, wall=False, wobble=0, mat=5)
    s.rect(0, 33.6, W, 34.5, 'q'); s.rect(24, 33.6, 41, 37, 'q')
    for x0, x1 in STREETS: s.rect(x0 - 1.4, 33.6, x1 + 1.4, 34.5, 'q'); s.rect(x0, 33.6, x1, H, 'a')
    s.blocks.append((28, 32.4, 37, 37))
    # exits at the ends of the avenues and streets, picked by the direction of each neighbouring stop
    R = D['locations']; me = R[i]; nb = [b if a == i else a for a, b, _c in D['roads'] if i in (a, b)]
    ends = [(.6, sum(AVE_A) / 2), (W - .6, sum(AVE_A) / 2), (.6, sum(AVE_B) / 2), (W - .6, sum(AVE_B) / 2), (sum(STREETS[0]) / 2, H - .6), (sum(STREETS[1]) / 2, H - .6), (32.5, .6)]
    used = []; ex = []
    for j in nb:
        an = math.atan2(R[j].get('lat', 0) - me.get('lat', 0), R[j].get('lon', 0) - me.get('lon', 0))
        best = max((e for e in ends if e not in used), key=lambda e: math.cos(math.atan2(e[1] - hub[1], e[0] - hub[0]) - an))
        used.append(best); ex.append([round(best[0], 2), round(best[1], 2)])
        sx, sz = best[0] + (2.2 if best[0] < 1 else -2.2 if best[0] > W - 1 else 2.4), best[1] + (2.6 if best[1] < 20 and best[0] in (.6, W - .6) else -2.2 if best[1] > H - 1 else 2.2)
        s.put('signpost', min(W - .8, max(.8, sx)), min(H - .8, max(.8, sz)), act='sign', say=f"{R[j]['name']} this way.")
        s.clear.append((best[0], best[1], 1.6))
    s.d['exits'] = ex
    # buildings: fronts on the pavement, facing the avenues
    def row(keys, x0, x1, z, acts=None):
        ws = [meta(k).get('box', [3, 3])[0] for k in keys]; gap = max(.3, (x1 - x0 - sum(ws)) / max(1, len(keys) - 1)); x = x0
        out = []
        for k, w in zip(keys, ws):
            a = (acts or {}).get(k, {}); p = s.building(k, x + w / 2, z, a.get('act', 'house'), a.get('label'), a.get('say'), path=False, shop=a.get('shop'))
            out.append(p); x += w + gap
        return out
    SAY = {'house': ['A window box of geraniums, very tidy.', 'Someone is practicing scales on a piano upstairs.', 'A sign: “Quiet please, night shift sleeping.”', 'The doormat says “Go Away (Nicely)”.']}
    acts = {'shop_cafe': {'act': 'talk', 'say': 'Café: “The coffee here is fair trade. The prices are not.”'},
            'shop_mart': {'act': 'shop', 'label': 'Capital Mart', 'shop': 'capital'}, 'clinic': {'act': 'clinic'},
            'shop_boutique': {'act': 'shop', 'label': 'Capital Outlet', 'shop': 'outlet'}, 'office_tower': {'act': 'talk', 'say': 'Capital Tower. The lobby guard says the elevator is “currently ascending”.'},
            'city_hall': {'act': 'talk', 'say': 'Capital Hall. A notice: “Tax forms, floor 2. Tax loopholes, floor 3.”'}}
    for k in ('townhouse_red', 'townhouse_blue', 'townhouse_yellow', 'apartment_a', 'apartment_b', 'apartment_c'):
        acts[k] = {'act': 'house', 'say': s.r.choice(SAY['house'])}
    row(['townhouse_red', 'townhouse_blue', 'shop_cafe', 'townhouse_yellow'], 1, 18.3, 16.8, acts)
    row(['shop_mart', 'clinic', 'shop_boutique'], 46.6, 63, 16.8, acts)
    row(['apartment_a', 'apartment_b', 'apartment_c'], 1, 18.4, 34.6, acts)
    row(['city_hall', 'office_tower'], 24, 41, 37.2, acts)
    row(['apartment_b', 'townhouse_blue', 'apartment_a'], 46.6, 63.2, 34.6, acts)
    # the plaza
    s.put('fountain_big', 32.5, 22.6); s.put('statue_coin', 26.4, 24.6); s.put('flag_pole', 38.8, 25.6); s.put('flag_pole', 36.2, 25.8)
    for x, z in ((28.4, 20.6), (36.6, 20.6)): s.put('bench_metal', x, z)
    for x in (24.6, 40.4):
        for z in (18.4, 22.4, 26.2): s.put('street_tree', x, z, s.r.uniform(.9, 1.05), s.r.random() < .5)
    s.put('food_truck', 37.4, 17.6, act='talk', say='Food truck: “City special: a pretzel with a pretzel on it.”')
    for x, z in ((29, 25.8), (34.6, 26.4)): s.put('cafe_table', x, z)
    s.put('newsstand', 25.8, 11.4); s.put('phone_booth', 39.8, 11.2); s.put('bus_shelter', 52.6, 10.6); s.put('bus_shelter', 8.6, 27.9)
    # street furniture along the pavements
    for z in (AVE_A[0] - .9, AVE_A[1] + .9, AVE_B[0] - .9, AVE_B[1] + .9):
        x = 1.6
        while x < W - 1:
            if not any(x0 - 2 < x < x1 + 2 for x0, x1 in STREETS) and not (23 < x < 42 and z in (AVE_A[1] + .9,)):
                k = 'streetlamp' if int(x) % 12 < 2 else 'street_tree' if z in (AVE_A[0] - .9, AVE_B[0] - .9) and int(x) % 12 in (6, 7) else None
                if k: s.put(k, x, z, 1, s.r.random() < .5)
            x += 6
    for x, z in ((19.2, 11.6), (24.2, 11.6), (41.2, 11.6), (46, 11.6), (19.2, 15.6), (46, 15.6), (19.2, 28.6), (46, 28.6)): s.put('traffic_light', x, z)
    for x, z in ((3.6, 11.4), (60, 11.4), (12.6, 15.8), (55.2, 15.8)): s.put('hydrant', x, z)
    for x, z in ((16.6, 11.6), (48.6, 11.6), (30, 15.9), (56, 28.6)): s.put('trash_city', x, z)
    for x, z in ((11, 11.4), (44.2, 28.7), (2.4, 28.8)): s.put('mailbox_blue', x, z)
    for x in (27, 38): s.put('banner_pole', x, 15.9)
    s.put('bike_rack', 21.2, 28.6); s.put('vending', 45.8, 16.2); s.put('billboard', 60.6, 41.6)
    for x, z in ((21.5, 11.2), (43.5, 11.2), (21.5, 15.8), (43.5, 15.8)): s.put('crosswalk', x, z, block=False)
    for x, z in ((10, 13.5), (54, 13.6), (32, 30.5), (21.5, 22)): s.put('manhole', x, z, block=False)
    for x, z, k in ((47.6, 40.6, 'car_red'), (19, 41, 'car_mint')): s.put(k, x, z, 1, 1)
    # the park
    s.grove(6, 6.4, 4, 2.6, 5, LEAFY, floor=None, under=None, gap=.8); s.grove(58, 6.4, 4, 2.6, 5, LEAFY, floor=None, under=None, gap=.8)
    s.grove(41, 4.6, 3.6, 2.4, 4, ['tree_maple', 'tree_blossom', '@tree_birch'], floor=None, under=None, gap=.8)
    for x, z in ((27, 6.4), (38, 6.4), (24, 2.6)): s.put('bench_metal', x, z)
    s.drift(['@flowers'], 32.5, 7.4, 4, 1.2, 10); s.drift(['@flowers'], 46, 8, 3, 1, 6); s.drift(['@flowers'], 20.6, 8, 3, 1, 6)
    s.scatter(['planter_round', '@bush_round', 'bush_flower'], 8, (0, 0.4, W, 9.8), avoid=AV + 's', gap=.8)
    # behind the blocks: back yards, trees and the hills
    s.scatter(['@tree_oak', 'tree_blossom', '@tree_birch', 'tree_maple', '@bush_round'], 14, (0, 21.6, W, 27.4), avoid=AV + 'h', gap=.8)
    s.back(['@tree_oak', '@tree_pine', 'tree_blossom', '@tree_birch'], 40.6, 22)
    # life: traffic on a loop round the plaza block and along the avenue, pigeons, ducks
    sA, sB = sum(AVE_A) / 2, sum(AVE_B) / 2; xs0, xs1 = sum(STREETS[0]) / 2, sum(STREETS[1]) / 2
    s.life('car', 3, path=[[xs0 - .7, sA - .7], [xs1 + .7, sA - .7], [xs1 + .7, sB + .7], [xs0 - .7, sB + .7]])
    s.life('car', 2, path=[[1, sA + .8], [W - 1, sA + .8], [W - 1, sA + .8 - .05], [1, sA - .8]], loop=True)
    s.life('pigeon', 8, area=[24, 17, 41, 27]); s.life('pigeon', 4, area=[26, 1, 40, 9])
    # heights: the park dips toward the ponds; everything else flat
    s.hgrid(); s.d['cliff'] = 'q'
    for x0, x1 in STREETS: s.roads.append(([[(x0 + x1) / 2, 22], [(x0 + x1) / 2, 44]], x1 - x0))
    def climb():
        for x0, x1 in STREETS: s.ramp(x0 - 1.4, x1 + 1.4, 33.6, 39.0)
        s.flight('z', 1, 67, 57, 16, 'high', 8, 'iron', 'q')
    s.before_stairs = [climb]
    return s.out(8, 'iron', 'q', 'stone')


# ---------------------------------------------------------------------------------------------- v24: sea, island, volcano, mountains, lake
PALMS = ['palm_tree', 'palm_tree_b', 'palm_small']
SNOWPINE = ['tree_pine_snow', 'tree_pine_snow_b', 'tree_pine_snow_small']


def islet(s, cx, cz, rx, rz, shallow=1.6, palms=3, rocks=2, grass=True):
    """a little sandy island in shallow water"""
    s.blob(cx, cz, rx + shallow, rz + shallow * .8, 'w', .3)
    s.blob(cx, cz, rx, rz, 's', .3)
    if grass and rx > 2.2: s.blob(cx, cz + .3, rx * .55, rz * .5, 'G', .35)
    s.hill(cx, cz, max(rx, rz) + 1, .35)
    for _ in range(palms * 8):
        if palms <= 0: break
        a, d = s.r.uniform(0, 6.28), s.r.random() ** .5 * .75
        x, z = cx + math.cos(a) * rx * d, cz + math.sin(a) * rz * d
        if s.at(x, z) in 'sG' and s.free(x, z, .5, 'wdpb', None, .4): s.put(s.r.choice(PALMS), x, z, s.r.uniform(.85, 1.1), s.r.random() < .5); palms -= 1
    for _ in range(rocks * 6):
        if rocks <= 0: break
        a = s.r.uniform(0, 6.28); x, z = cx + math.cos(a) * (rx + .3), cz + math.sin(a) * (rz + .2)
        if s.free(x, z, .3, 'pb', None, .2): s.put(s.r.choice(['rocks', 'rocks_b', 'rock_flat', 'shell_pile']), x, z, s.r.uniform(.8, 1.1), s.r.random() < .5, block=False); rocks -= 1


def route_offshore(D, i):
    s = Scene('offshore', 'The Offshore', 'd', 14, 48, 36, sky=['#5E9EE0', '#A6D2F2', '#F2F0E0'], haze='#D6E8F2', hazeD=46, far='sea', farH=5, amb='pollen',
              ride=1, waterKind='sea', flatFar=1, wind=1.4)
    hub = (24, 7.5)
    s.blob(24, 13, 22, 12, 'w', .5)                      # the shallows over a sunken bank
    islet(s, 24, 7.2, 4.2, 2.6, palms=3)
    s.hub_exits(D, i, hub, road=None, signs=False)
    s.rect(23.2, 9.6, 24.8, 13.2, 'b'); s.put('dock_post', 22.9, 13); s.put('dock_post', 25.1, 13); s.put('rowboat', 26.6, 12, .9)
    s.put('beach_umbrella', 21, 6.4); s.put('deck_chair', 22.2, 5.8); s.put('signpost', 27.6, 6.2, act='sign', say='The Offshore. Sundown to the east, Tax Haven to the west. Mind the sandbars.')
    islet(s, 9, 22, 3.2, 2, palms=2)                     # Diver Dee's sandbar
    islet(s, 37, 25, 3.6, 2.6, palms=1, rocks=3)
    s.put('lighthouse', 38, 26.2)
    islet(s, 18, 30, 2.4, 1.4, palms=1, grass=False); islet(s, 42, 10, 1.8, 1.2, palms=1, grass=False)
    for x, z in ((14, 12), (33, 15), (8, 9), (40, 18), (27, 22), (13, 27)): s.put('buoy', x, z, 1, block=False)
    for x, z in ((30, 30), (5, 30)): s.put('sailboat', x, z, s.r.uniform(.9, 1.1), s.r.random() < .5)
    s.d['npcSpots'] = [[9.2, 21.6]]
    return s.out(7, 'wood')


def town_taxhaven(D, i):
    s = Scene('taxhaven', 'Tax Haven', 's', 15, 46, 34, sky=['#5A9EE4', '#A8D4F4', '#F4F0DC'], haze='#E2ECEA', hazeD=44, far='sea', farH=6, folk=6, wind=1.2,
              waterKind='sea', chat=['Welcome to Tax Haven, where the sun is free and so is everything else, on paper.', 'My yacht is parked behind my other yacht.',
                                    'The bank here has no windows and no doors. You just know.', 'Leader Marina trains her Water team in the lagoon every morning.',
                                    'Mount Margin Call grumbles when the market drops. Lately it grumbles a lot.', 'Try the coconut. It is the only thing here that pays tax.'])
    hub = (23, 11)
    s.rect(0, 0, 46, 4.5, 'w'); s.rect(0, 0, 46, 2, 'd')                     # the harbour in front
    s.blob(23, 12.5, 6.4, 3.2, 'q', .06)
    s.terrace(-1, 20, 47, 36, 1.2, wall=True, wobble=.1, mat=5)              # the villas' terrace
    s.hub_exits(D, i, hub, road='q', width=1.2, lamps='streetlamp_b')
    s.rect(20.6, 0, 22.4, 5.2, 'b'); s.rect(30, 0, 31.6, 4.8, 'b')          # piers
    for x in (20.4, 22.6): s.put('dock_post', x, .8)
    s.put('sailboat', 26, 2, 1.1); s.put('sailboat', 36, 1.6, .95, 1); s.put('rowboat', 33.4, 2.6, .9)
    s.clear.append((23, 12.5, 6.5))
    s.put('fountain', 23, 13.8)
    s.building('shop', 15, 15.4, 'shop')
    s.building('clinic', 31.4, 15.4, 'clinic')
    s.plot('villa', 7, 22.6, say='A brass plate: “Shell Holdings Ltd. No visitors, no questions.”', fence=False)
    s.plot('villa', 17, 23.2, say='Someone is counting money very loudly inside.', fence=False)
    s.plot('villa', 31, 23.2, say='A sign: “Beach house. Seventh of nine.”', fence=False)
    s.plot('villa', 41, 22.6, say='The doorbell plays a cash-register sound.', fence=False)
    s.put('city_hall', 23, 26.4, act='talk', say='Tax Haven Trust. The door is locked, and so are most of the accounts.')
    s.put('lighthouse', 43.6, 6.6)
    for x, z in ((19, 10.4), (27, 10.4)): s.put('bench_metal', x, z)
    for x, z in ((4, 7), (10, 6.2), (38, 7.4), (2.6, 13), (44, 14.4), (9.6, 18.2), (36.4, 18.6), (13.6, 30.6), (33, 30.4)): s.put(s.r.choice(PALMS), x, z, s.r.uniform(.9, 1.1), s.r.random() < .5)
    for x, z in ((6, 9.6), (12, 8.6), (35, 9.4), (40, 10.6)): s.put('beach_umbrella', x, z); s.put('deck_chair', x + 1.4, z - .5)
    s.scatter(['shell_pile', 'rocks', 'rock_flat', 'palm_small'], 10, (0, 4, 46, 19), avoid=AV, gap=.6)
    s.scatter(['@flowers', 'bush_flower', 'palm_small', 'planter_round'], 10, (0, 20, 46, 34), avoid=AV, gap=.6)
    s.life('pigeon', 3, area=[18, 10, 28, 15])
    s.d['npcSpots'] = [[23, 17.2]]
    return s.out(8, 'iron', 'q', 'stone')


def route_volcano(D, i):
    s = Scene('volcano', 'Mount Margin Call', 'z', 16, 44, 36, sky=['#3A2230', '#8A4A3A', '#E6A060'], haze='#B07060', hazeD=34, far='volcano', farH=10, amb='sand',
              waterKind='lava', tint='#3A1A1A', rays=1, wind=.8, cliff='j')
    hub = (22, 6.5)
    s.terrace(-1, 13, 45, 37, 1.6, wall=False, wobble=.9, mat=11)
    s.terrace(-1, 22, 45, 37, 1.8, wall=False, wobble=1.1, mat=11)
    s.terrace(10, 29, 34, 37, 1.6, wall=False, wobble=.8, mat=11)
    s.hub_exits(D, i, hub, road='v')
    s.road((22, 8), (21, 31), 'v', 1.1, amp=.8)
    s.stream([(36, 35.6), (35.4, 30), (34, 24), (35, 18), (36.4, 12), (37, 5), (37.4, -.5)], 1.4, .25)       # a lava river down the mountain
    s.pond(9, 9.4, 2.6, 1.6, sand=False, reeds=0, lilies=0, deep=False, rocks=0, dip=.3)                   # a lava pool
    s.blob(22, 33.2, 4.4, 2.2, 'w', .2)                                                                    # the crater lake at the top
    s.patches('j', .55, 4, seed=160); s.patches('r', .62, 5, seed=161)
    for x, z in ((14, 18), (29, 16), (8, 27), (31, 27)): s.put('steam_vent', x, z)
    for x, z in ((26, 9), (12, 14), (27, 20), (16, 25.6)): s.put('lava_vent', x, z)
    s.put('ash_sign', 24, 9.2, act='sign', say='DANGER: active volcano. Also, the summit café is closed.'); s.put('ash_sign', 19, 30.6)
    s.scatter(['tree_dead', 'tree_dead', '@rocks_basalt', 'obsidian', 'lava_rock', 'basalt_columns'], 22, (0, 0, 44, 36), avoid=AV, gap=.8)
    s.clump(['obsidian', 'lava_rock', '@rocks_basalt'], 6, 20, 5, 2.4); s.clump(['basalt_columns', 'boulder_basalt'], 40, 28, 3, 2)
    s.frame(['@rocks_basalt', 'lava_rock', 'tree_dead'], 7)
    s.put('tent', 30, 7.2); s.put('campfire', 27.6, 6.2)
    s.d['npcSpots'] = [[28.6, 8.8]]
    s.rolling(.3, 4)
    return s.out(8, 'rope', None, 'stone')


def route_pass(D, i):
    s = Scene('pass', 'Bull Run Pass', 'n', 17, 46, 36, sky=['#6E9AE0', '#B4D4F2', '#F2F4F6'], haze='#E2EAF4', hazeD=48, far='mountains', farH=12, amb='dust', wind=1.5,
              waterKind='ice')
    hub = (23, 7)
    s.terrace(-1, 14, 47, 37, 1.6, wall=False, wobble=1.0, mat=1)
    s.cliff(-1, 19.4, 47, 22.6, -3.6, mat=1, wobble=.5)                       # a misty gorge across the pass
    s.terrace(-1, 27, 47, 37, 1.8, wall=False, wobble=1.2, mat=1)
    s.hub_exits(D, i, hub, road='u')
    s.road((23, 8.4), (23.6, 33), 'u', 1.1, amp=.5)
    s.pond(9, 10, 3.4, 2, sand=False, reeds=0, lilies=0, deep=False, rocks=3, dip=.2)          # a frozen pond
    s.patches('r', .72, 5, seed=171); s.patches('v', .8, 3, on='n', seed=172)
    s.put('house_cottage', 34, 9.6, act='house', say='The hut smells of cocoa. A sign: “Hikers welcome. Billionaires wipe your paws.”')
    s.put('campfire', 30, 6.4); s.put('firewood', 36.6, 8.2); s.put('snowman', 15.6, 6.4); s.put('ski_sign', 26.4, 9.2, act='sign', say='Summit Capital: up and over. Capital Gains: back down.')
    s.grove(7, 31.4, 6, 2.4, 9, SNOWPINE, floor=None, under=('rocks_snow', 'boulder_snow'))
    s.grove(39, 31.6, 6, 2.4, 9, SNOWPINE, floor=None, under=('rocks_snow',))
    s.scatter(SNOWPINE + ['boulder_snow', 'rocks_snow', 'rocks_snow'], 26, (0, 0, 46, 36), avoid=AV, gap=.7)
    s.frame(['rocks_snow', 'tree_pine_snow_small', 'boulder_snow'], 8)
    s.d['npcSpots'] = [[31.6, 7.6]]
    s.rolling(.4, 4)
    return s.out(8, 'wood', None, 'wood', 'rope')


def town_summit(D, i):
    s = Scene('summit', 'Summit Capital', 'n', 18, 46, 36, sky=['#6A98E2', '#B0D2F2', '#F4F4F2'], haze='#E4ECF4', hazeD=50, far='mountains', farH=12, folk=7, wind=1.3,
              waterKind='ice', chat=['Welcome to Summit Capital! The air is thin, the rent is not.', 'The higher you live here, the richer you are. I live on the bottom row.',
                                     'Leader Alta trains at the very top. Bring a scarf.', 'You can ride across Liquidity Lake to Hillside Farm, if your billionaire can swim.',
                                     'The snowman by the clinic is called Gerald. Do not touch Gerald.', 'Every chalet here has a view. Most of them are of other chalets.'])
    hub = (23, 7)
    s.blob(23, 8.4, 6, 2.6, 'q', .06)
    s.terrace(-1, 13, 47, 37, 1.5, wall=True, wobble=.1, mat=5)              # three streets climbing the slope
    s.terrace(-1, 21, 47, 37, 1.5, wall=True, wobble=.1, mat=5)
    s.terrace(-1, 29, 47, 37, 1.5, wall=True, wobble=.1, mat=5)
    s.hub_exits(D, i, hub, road='q', width=1.2, lamps='streetlamp_b')
    for z0, z1 in ((10, 16), (18, 24), (26, 32)): s.slope(30.6, z0, 33.4, z1, '+z')            # ramps up the middle-right
    s.road((23, 9.6), (23, 33.6), 'q', 1.3, amp=0)                                               # and stairs up the middle
    for z in (16.6, 24.6, 32.6): s.rect(1, z - 1.2, 45, z + .6, 'q')                            # the street on each level
    s.clear.append((23, 8.4, 6))
    s.building('shop', 14, 11, 'shop')
    s.building('clinic', 32.2, 11, 'clinic', path=False)
    s.put('snowman', 37, 9.4, act='talk', say='This is Gerald. Gerald is not to be touched.')
    for k, x in enumerate((5, 13, 37, 43)):
        s.plot('chalet' if k % 2 else 'chalet_b', x, 17.6, say=['A pair of skis leans by the door.', 'Someone is yodelling, quietly.', 'A sign: “Chalet for rent. Ask your banker.”', 'Hot cocoa steam drifts from the window.'][k], fence=False)
    for k, x in enumerate((6, 15, 38)):
        s.plot('chalet_b' if k % 2 else 'chalet', x, 25.6, say=['The welcome mat says GO AWAY, NICELY.', 'Three pairs of boots, one billionaire-sized.', 'A brass telescope points at the town below.'][k], fence=False)
    s.put('city_hall', 13, 33.4, act='talk', say='Summit Capital Exchange. The highest stock market in the world, literally.'); s.put('chalet', 37, 33.6, act='house', say='The top floor. You can see all the way to Capital Gains.')
    s.put('flag_pole', 27, 33.2); s.put('statue_coin', 23, 34.6)
    for x, z in ((19.4, 7.2), (26.6, 7.2)): s.put('bench_wood', x, z)
    s.scatter(SNOWPINE + ['boulder_snow', 'rocks_snow', 'planter_box'], 14, (0, 0, 46, 36), avoid=AV, gap=.7)
    s.back(SNOWPINE, 34.4, 10)
    s.frame(['rocks_snow', 'tree_pine_snow_small'], 7)
    s.d['npcSpots'] = [[27.4, 31.4]]
    return s.out(8, 'iron', 'q', 'stone')


def route_lake(D, i):
    s = Scene('lake', 'Liquidity Lake', 'd', 19, 48, 36, sky=['#6A9EE0', '#ADD4F0', '#F0F2E6'], haze='#DAE8EC', hazeD=46, far='mountains', farH=8, amb='pollen',
              ride=1, waterKind='lake', flatFar=1, wind=1.0)
    hub = (24, 8)
    s.blob(24, 18, 24, 18, 'w', .4); s.blob(24, 20, 14, 9, 'd', .3)
    islet(s, 24, 7.6, 4, 2.4, palms=0, rocks=2)
    s.hub_exits(D, i, hub, road=None, signs=False)
    s.rect(22, 10, 26, 13, 'b'); s.put('market_cart', 23, 11.6, act='talk', say='Floating market! Fresh fish, fresh rumours, fresh liquidity.'); s.put('stall', 25.6, 12.2)
    for x in (21.8, 26.2): s.put('dock_post', x, 13)
    s.grove(24, 7.4, 3, 1.6, 3, ['@tree_birch', 'tree_willow'], floor=None, under=('@bush_round', 'reeds'))
    for cx, cz, rx, rz in ((8, 24, 3, 2), (39, 27, 3.4, 2.2), (13, 31, 2.2, 1.4), (40, 12, 2.4, 1.6)):
        s.blob(cx, cz, rx + 1.2, rz + 1, 'w', .3); s.blob(cx, cz, rx, rz, 'G', .3); s.hill(cx, cz, max(rx, rz) + 1, .4)
        s.grove(cx, cz, rx * .7, rz * .6, 3, ['@tree_birch', 'tree_willow', '@tree_pine'], floor=None, under=('@bush_round',))
        for _ in range(6):
            a = s.r.uniform(0, 6.28); x, z = cx + math.cos(a) * (rx + .6), cz + math.sin(a) * (rz + .5)
            if s.at(x, z) == 'w': s.put(s.r.choice(['reeds', 'cattails']), x, z, s.r.uniform(.85, 1.1), x > cx, block=False)
    for _ in range(14):
        x, z = s.r.uniform(2, 46), s.r.uniform(14, 34)
        if s.at(x, z) in 'wd': s.put(s.r.choice(['pond_lily', 'lily_flowers']), x, z, s.r.uniform(.8, 1.1), s.r.random() < .5, block=False)
    s.put('rowboat', 30, 16, .9); s.put('sailboat', 16, 18, .9, 1)
    s.life('duck', 6)
    s.d['npcSpots'] = [[26.6, 7.4]]
    return s.out(7, 'wood')


BUILD = [('sundown', town_sundown), ('longgrass', route_grass), ('golf', route_golf), ('thicket', route_thicket), ('grotto', town_grotto),
         ('canyon', route_canyon), ('scrapyard', route_scrap), ('foodcourt', town_food), ('mall', town_mall),
         ('pond', route_pond), ('farm', town_farm), ('ridge', route_ridge), ('city', city),
         ('offshore', route_offshore), ('taxhaven', town_taxhaven), ('volcano', route_volcano), ('pass', route_pass), ('summit', town_summit), ('lake', route_lake)]


def main():
    force = '--force' in sys.argv
    rescene = force or '--scenes' in sys.argv     # v18: rebuild the scenes but keep the catalog you have
    src = gamedata.js_text()
    head = src[:src.index('window.GAMEDATA=')]
    D = json.JSONDecoder().raw_decode(src[src.index('window.GAMEDATA=') + len('window.GAMEDATA='):])[0]
    cat = scenery()
    if force or 'scenery' not in D or '--catalog' in sys.argv:
        keep = D.get('scenery', {})
        D['scenery'] = cat
        # props the Studio added that the catalog doesn't know about are kept
        for k, v in keep.get('props', {}).items(): D['scenery']['props'].setdefault(k, v)
        for k, v in keep.get('terrains', {}).items(): D['scenery']['terrains'].setdefault(k, v)
    else:
        for k in ('terrains', 'props'):
            for kk, v in cat[k].items():
                cur = D['scenery'][k].setdefault(kk, v)
                # fields a newer catalog adds (variants, layers, 3D building plans) join entries you already have; your values stay
                for f, fv in v.items(): cur.setdefault(f, fv)
        D['scenery'].setdefault('buildArt', cat['buildArt'])
        D['scenery'].setdefault('wallArt', cat['wallArt'])
        for k, m in cat['life'].items(): D['scenery'].setdefault('life', {}).setdefault(k, m)
    D.setdefault('scenes', {})
    if '--catalog' not in sys.argv:
        D.setdefault('roads', [])
        for i, (sid, f) in enumerate(BUILD):
            if i >= len(D['locations']): break
            if rescene or sid not in D['scenes']:
                D['scenes'][sid] = f(D, i)
            if force or not D['locations'][i].get('scene'):
                D['locations'][i]['scene'] = sid
    gamedata.save_js(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n')
    print('scenes:', ', '.join(D['scenes']), '| props:', len(D['scenery']['props']))
    for sid in D['scenes']:
        sc = D['scenes'][sid]; print(f"  {sid}: {len(sc.get('props', []))} props, exits {sc.get('exits')}, hub {sc.get('hub')}")

if __name__ == '__main__':
    main()
