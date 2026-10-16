#!/usr/bin/env python3
"""v31: bigger towns and longer routes, grown around what is already there.

Every scene listed below gets new ground on its right-hand side and at the back. Nothing that exists is moved or
rebuilt: the old tiles, heights, cliffs, props, streams and anything you changed in the Studio stay exactly where they
are, so the new land is added in metres beyond the old edges (x > old width, z > old depth). An exit that sat on a
grown edge moves out to the new edge, its road is carried on to it, and the signpost that pointed down it moves with
it. Cliffs and terraces running into a grown edge carry on into the new land at the same level, streams keep flowing
from the new edge, and sea and sand carry on along the coast.

The three towns get a new district each, laid out around a street so you can see where to go:
  Sundown         Maple Row: a lane of cottages under maples, a little orchard with beehives, a green with benches.
  Tax Haven       The Marina: a seafront promenade with piers and sailboats, beach umbrellas, villas up the hill and
                  the Offshore Bank, which answers no questions.
  Summit Capital  Upper Village: chalets round a frozen pond, a cocoa stall, a lookout with a flag, deep pine woods.
Every route gets a longer stretch in its own style (its own trees, rocks and flowers): a path on to the moved exit,
new tall grass where billionaires hide, a grove, a quiet resting spot with a bench and a sign, and a wooded back.

    python3 tools/build-v31.py          # grows the scenes that haven't been grown yet (marked "grown": 31)
    python3 tools/build-v31.py --dry    # prints what it would do
"""
import base64, copy, importlib.util, json, math, random, struct, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('bscenes', ROOT / 'tools' / 'build-scenes.py')
B = importlib.util.module_from_spec(spec); spec.loader.exec_module(B)
DATA, AV, meta, radius = B.DATA, B.AV, B.meta, B.radius

# scene: (extra width, extra depth)
GROW = {'sundown': (18, 6), 'taxhaven': (16, 6), 'summit': (16, 6),
        'longgrass': (14, 6), 'golf': (14, 6), 'thicket': (14, 6), 'canyon': (12, 4), 'scrapyard': (14, 6),
        'pond': (14, 6), 'ridge': (12, 6), 'offshore': (12, 4), 'volcano': (12, 4), 'pass': (12, 4), 'lake': (12, 4)}


def load():
    src = DATA.read_text(encoding='utf-8'); head = src[:src.index('window.GAMEDATA=')]
    D = json.JSONDecoder().raw_decode(src[src.index('window.GAMEDATA=') + len('window.GAMEDATA='):])[0]
    return head, D


def save(head, D):
    DATA.write_text(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')


def smooth(t): t = max(0., min(1., t)); return t * t * (3 - 2 * t)


class Grown:
    """an existing scene with room added on the right (dx metres) and at the back (dz metres)"""
    def __init__(self, sid, sc, dx, dz, seed):
        self.sid, self.old, self.W0, self.H0 = sid, sc, sc['w'], sc['h']
        W, H = self.W0 + dx, self.H0 + dz; self.dx, self.dz = dx, dz
        s = B.Scene(sid, sc.get('name', sid), sc.get('edge', 'g'), seed, W, H)
        s.d = copy.deepcopy(sc); s.d['w'], s.d['h'] = W, H; self.s = s
        base = sc.get('edge', 'g'); rows = sc.get('tiles') or []; W0, H0 = self.W0, self.H0
        carry = 'wds'
        # tiles: old rows keep their place counted from the near edge; new rows at the back, new columns on the right
        for j in range(H):
            jo = j - dz
            for i in range(W):
                if jo >= 0 and i < W0: ch = (rows[jo] if jo < len(rows) else '').ljust(W0, base)[i]
                else:
                    oj, oi = min(max(jo, 0), H0 - 1), min(i, W0 - 1)
                    e = (rows[oj] if oj < len(rows) else '').ljust(W0, base)[oi]
                    near = (i - (W0 - 1) <= 1 if i >= W0 else True) and (jo >= -1 if jo < 0 else True)
                    ch = e if e in carry or (near and e not in 'pqcuaheb') else base
                s.g[j][i] = ch
        # the step field: carried on from the nearest old cell, so cliffs and terraces run on into the new land
        W2o, H2o = 2 * W0, 2 * H0; st, wm = [[0.] * W2o for _ in range(H2o)], [[0] * W2o for _ in range(H2o)]
        if sc.get('steps'):
            raw = base64.b64decode(sc['steps']); vals = struct.unpack('<%dh' % (len(raw) // 2), raw)
            mats = base64.b64decode(sc.get('stepm', '')) if sc.get('stepm') else bytes(len(vals))
            for j in range(H2o):
                for i in range(W2o): st[j][i] = vals[j * W2o + i] / 20; wm[j][i] = mats[j * W2o + i] if j * W2o + i < len(mats) else 0
        for j in range(2 * H):
            for i in range(2 * W):
                oj, oi = min(j, H2o - 1), min(i, W2o - 1); s.st[j][i] = st[oj][oi]; s.wm[j][i] = wm[oj][oi] & 15
        self.st0 = st
        # heights at tile corners: the old ones exactly, the new ones carried on from the edge with a gentle roll
        hs = sc.get('heights'); g = s.hgrid()
        old = [[0.] * (W0 + 1) for _ in range(H0 + 1)]
        if hs:
            for r in range(H0 + 1):
                for xi in range(W0 + 1): old[H0 - r][xi] = hs[r][xi]
        self.ht0 = old
        for zi in range(H + 1):
            for xi in range(W + 1):
                if zi <= H0 and xi <= W0: g[zi][xi] = old[zi][xi]; continue
                e = old[min(zi, H0)][min(xi, W0)]; dist = max(xi - W0, zi - H0, 0)
                g[zi][xi] = e + (s.fbm(xi, zi, 7.0, 3) - .5) * .7 * smooth(dist / 6)
        # what's already there: kept, and in the way of anything new
        s.props = [dict(p) for p in sc.get('props', [])]
        for p in s.props:
            m = meta(p['k']); sz = p.get('s', 1)
            if m.get('box'): w, d = m['box']; s.blocks.append((p['x'] - w * sz / 2 - .4, p['z'] - .5, p['x'] + w * sz / 2 + .4, p['z'] + d * sz + .3))
            else: s.clear.append((p['x'], p['z'], radius(p['k'], sz)))
        # nothing new goes near a cliff edge (old or carried on)
        s.near_terrace_edge = self.near_wall
        self.new_props_from = len(s.props)

    def near_wall(self, x, z, m):
        s = self.s; i0, j0 = int(x * 2), int(z * 2); r = int(m * 2) + 1; v = s.stv(i0, j0)
        for j in range(j0 - r, j0 + r + 1):
            for i in range(i0 - r, i0 + r + 1):
                if abs(s.stv(i, j) - v) > .05: return True
        return False

    def new_box(self):
        """the new land: the strip on the right and the strip at the back"""
        return (self.W0, 0, self.s.W, self.s.H), (0, self.H0, self.W0, self.s.H)

    def move_exits(self):
        s, W0, H0 = self.s, self.W0, self.H0; moved = []
        for n, e in enumerate(s.d.get('exits', [])):
            x, z = e
            if x >= W0 - 1.6:
                ne = [round(s.W - 1.1, 2), z]; road_ch = self.road_char(x - 1.6, z)
                pts = s.road([x - .6, z], ne, road_ch, 1.0, amp=1.4)
                moved.append((n, e, ne, (s.W - W0, 0)))
            elif z >= H0 - 1.6:
                ne = [x, round(s.H - 1.1, 2)]; road_ch = self.road_char(x, z - 1.6)
                s.road([x, z - .6], ne, road_ch, 1.0, amp=.9)
                moved.append((n, e, ne, (0, s.H - H0)))
            else: continue
            s.d['exits'][n] = ne
            # the signpost that points down this road goes with it
            for p in s.props[:self.new_props_from]:
                if p['k'] == 'signpost' and math.hypot(p['x'] - x, p['z'] - z) < 6.5:
                    p['x'] = round(min(s.W - .8, p['x'] + moved[-1][3][0]), 2); p['z'] = round(min(s.H - .8, p['z'] + moved[-1][3][1]), 2)
        return moved

    def road_char(self, x, z):
        for d in (0, .6, 1.2, 2, 3):
            for a, b in ((x, z), (x - d, z), (x, z - d), (x + d, z), (x, z + d)):
                c = self.s.at(a, b)
                if c in 'pqcuahv': return c
        return 'p'

    def streams_on(self):
        """streams that ran off a grown edge now start (or end) at the new edge"""
        s = self.s
        for S in s.d.get('streams', []):
            P = S['pts']
            for k in (0, -1):
                x, z = P[k]
                if z >= self.H0 - 1.6: np_ = [x - .2 if k == 0 else x, round(s.H - .4, 2)]
                elif x >= self.W0 - 1.6: np_ = [round(s.W - .4, 2), z]
                else: continue
                if k == 0: P.insert(0, np_)
                else: P.append(np_)
                s.line([np_, [x, z]], 'w', 1.0)
                break

    def finish(self):
        s = self.s; W0, H0 = self.W0, self.H0; g = s.ht
        # new buildings and big things stand on level ground (only the new land is reshaped)
        for p in s.props[self.new_props_from:]:
            m = meta(p['k']); b = m.get('box')
            if not b and not m.get('door'): continue
            sz = p.get('s', 1); w, d = (b or [2, 1.5]); w *= sz; d *= sz; base = s.hat(p['x'], p['z'])
            x0, x1, z0, z1 = p['x'] - w / 2 - .8, p['x'] + w / 2 + .8, p['z'] - 1.6, p['z'] + d + .6
            for zi in range(s.H + 1):
                for xi in range(s.W + 1):
                    k = max(0, min(1, 1.6 - max(x0 - xi, xi - x1, z0 - zi, zi - z1, 0) / 1.2))
                    if k > 0: g[zi][xi] = g[zi][xi] * (1 - k) + base * k
        for zi in range(H0 + 1):
            for xi in range(W0 + 1): g[zi][xi] = self.ht0[zi][xi]
        for zi in range(H0 * 2):
            for xi in range(W0 * 2): s.st[zi][xi] = self.st0[zi][xi]
        rows = self.old.get('tiles') or []
        for jo in range(H0):
            row = (rows[jo] if jo < len(rows) else '').ljust(W0, self.old.get('edge', 'g'))
            for i in range(W0): s.g[jo + self.dz][i] = row[i]
        s.encode_steps()
        s.d['tiles'] = [''.join(row) for row in s.g]
        s.d['heights'] = [[round(g[s.H - r][xi], 2) for xi in range(s.W + 1)] for r in range(s.H + 1)]
        for p in s.props[self.new_props_from:]:
            if p['k'].startswith('@'): p['k'] = s.r.choice(B.GROUPS.get(p['k'][1:]) or ['bush_round'])
        s.d['props'] = sorted(s.props, key=lambda p: -p['z'])
        s.d['grown'] = 31
        return s.d


# ---------------------------------------------------------------- the scene's own style
def palette(sc):
    """trees, bushes, rocks and flowers this scene already uses, so the new land looks like it belongs"""
    from collections import Counter
    C = Counter(p['k'] for p in sc.get('props', []))
    pick = lambda pat, dflt: [k for k, _ in C.most_common() if any(t in k for t in pat)][:5] or dflt
    return {'trees': pick(['tree', 'palm'], ['@tree_oak', '@tree_birch']), 'bush': pick(['bush', 'fern', 'cactus', 'dry_bush', 'hedge'], ['@bush_round', '@fern']),
            'rocks': pick(['rock', 'boulder', 'basalt', 'obsidian', 'lava_rock'], ['rocks', 'rocks_mossy']), 'flowers': pick(['flower'], ['@flowers'])}


def grow_route(G, rnd):
    s = G.s; P = palette(G.old); W0, H0, W, H = G.W0, G.H0, s.W, s.H; base = G.old.get('edge', 'g')
    G.streams_on(); moved = G.move_exits()
    soft = base in 'gGflyt'
    if soft: B.ground_mix(s, base, seed=31)
    cx = (W0 + W) / 2
    # tall grass where billionaires hide, a grove, and a resting spot with a view
    if base not in 'wdkm':
        for k in range(3):
            gx, gz = rnd.uniform(W0 + 2.5, W - 2.5), rnd.uniform(3, H - 6)
            if s.at(gx, gz) not in 'wdsbq' and not G.near_wall(gx, gz, 1.2): s.grass(gx, gz, rnd.uniform(1.8, 2.8), rnd.uniform(1.4, 2.2), .7)
    s.scatter(P['trees'], 7, (W0 + .5, H * .55, W - .5, H - .5), svar=.2)
    s.scatter(P['trees'], 4, (W0 + .5, 2, W - .5, H * .5), svar=.2, gap=1.2)
    s.scatter(P['bush'], 8, (W0 + .3, .5, W - .3, H - .5), svar=.2)
    s.scatter(P['rocks'], 5, (W0 + .3, .5, W - .3, H - .5), svar=.2)
    s.drift(P['flowers'], cx, H * .4, 4, 3, 6)
    # the resting spot
    for _ in range(40):
        bx, bz = rnd.uniform(W0 + 3, W - 3), rnd.uniform(H * .35, H * .7)
        if s.free(bx, bz, 1.4, AV + 'wds', .6) and not G.near_wall(bx, bz, 1.6):
            s.put('bench_wood', bx, bz); lamp = 'lantern' if base not in 'nsz' else 'streetlamp_b'
            if s.free(bx + 1.5, bz + .3, .3, AV, .4): s.put(lamp, bx + 1.5, bz + .3)
            if s.free(bx - 1.6, bz - .4, .3, AV, .4): s.put('signpost', bx - 1.6, bz - .4, act='sign', say=rnd.choice(['A good place to sit. The view is free.', 'Rest here. Billionaires never do.', 'Bench donated by an anonymous philanthropist. Tax deductible.']))
            break
    # a wooded back along the whole width
    s.scatter(P['trees'], int(W / 4), (0, H0 + .5, W, H - .2), svar=.22, gap=.1, road=.6)
    s.scatter(P['bush'], int(W / 6), (0, H0 + .3, W, H - .3), svar=.25, gap=.05, road=.5)
    return moved


def grow_sundown(G, rnd):
    s = G.s; W0, H0, W, H = G.W0, G.H0, s.W, s.H
    G.streams_on(); moved = G.move_exits()
    B.ground_mix(s, 'g', seed=31)
    # Maple Row: the lane carries on to the Long Grass, cottages along its far side, a green and an orchard below
    lane = [p for p in s.roads][-1][0] if s.roads else None
    for k, x, z in (('house_cottage', 50.2, 25.4), ('house_green', 56.4, 25.8), ('house_red', 61.0, 26.6)):
        s.plot(k, x, z, act='house', say=None, lawn='l')
    s.plot('house_blue', 52.0, 12.6, act='house', lawn='l')
    s.blob(57.5, 15.2, 3.4, 2.2, 'G', .3)
    for x, z in ((55.6, 14.2), (59.4, 14.6)): s.put('bench_wood', x, z)
    s.put('statue', 57.5, 16.0, .9, act='sign', say='Maple Row was paid for by a bake sale. The statue is of the best cake.')
    s.put('streetlamp', 54.0, 18.4); s.put('streetlamp', 60.6, 18.6)
    s.scatter(['tree_maple', 'tree_oak_autumn', 'tree_maple'], 5, (W0 + .5, 13, W - .5, 21), gap=1.0, svar=.18)
    s.drift(['fallen_leaves'], 57, 17.5, 6, 2.5, 6)
    # the orchard and the bees
    s.blob(56.5, 6.0, 5.2, 3.2, 'u', .25)
    for i in range(4):
        for j in range(2):
            x, z = 52.8 + i * 2.5, 4.4 + j * 2.6
            if s.free(x, z, .6, AV, .4): s.put(rnd.choice(['tree_fruit', 'tree_fruit_b']), x + rnd.uniform(-.2, .2), z + rnd.uniform(-.2, .2), rnd.uniform(.85, 1))
    for x, z in ((61.6, 4.6), (62.4, 6.8)): s.put('beehive', x, z)
    s.put('wheelbarrow', 51.0, 8.6, f=1); s.put('haybale', 62.0, 9.2, .9)
    s.put('hedge', 56.5, 1.2, 1.2)
    s.drift(['@flowers', 'flowers_mixed'], 50, 18.5, 3, 1.2, 6)
    s.grass(61.0, 31.5, 2.4, 1.8, .7)
    # the back: maples and oaks on the slope behind the town
    s.scatter(['tree_maple', 'tree_oak_autumn', '@tree_oak', 'tree_birch'], 18, (0, H0 + .4, W, H - .2), svar=.22, gap=.1, road=.6)
    s.scatter(['@fern', '@bush_round', 'fallen_leaves'], 12, (0, H0 + .2, W, H - .2), svar=.25, gap=.05, road=.5)
    s.life('pigeon', 3, area=[53, 13, 62, 18]); s.life('rabbit', 2)
    s.d['folk'] = s.d.get('folk', 6) + 3
    s.d.setdefault('chat', []).extend(['Maple Row is the new street past the square. The leaves never stop falling there.', 'The orchard bees only sting people who talk about interest rates.'])
    return moved


def grow_taxhaven(G, rnd):
    s = G.s; W0, H0, W, H = G.W0, G.H0, s.W, s.H
    G.streams_on(); moved = G.move_exits()
    # the Marina: a promenade along the shore, piers with boats, umbrellas on the sand
    shore = None
    for z in range(H0):
        if s.at(W0 + 4, z + .5) == 's': shore = z; break
    shore = shore or 6
    s.rect(W0, shore, W, shore + 2, 'q')
    for px in (W0 + 4.5, W0 + 11.5):
        s.rect(px - 1, 0, px + 1, shore, 'b')
        for zz in (1.2, shore - 1.2):
            s.put('dock_post', px - 1.15, zz); s.put('dock_post', px + 1.15, zz)
        s.put('sailboat', px + 2.6, 2.2, rnd.uniform(.9, 1.05), f=rnd.random() < .5)
    s.put('rowboat', W0 + 8, 1.6, .9)
    for x in range(int(W0) + 1, W - 1, 4): s.put('streetlamp_b', x + .5, shore + 2.3)
    for k in range(5):
        x, z = W0 + 1.5 + k * 3.1, shore + 4.6 + rnd.uniform(-.4, .4)
        if s.free(x, z, .6, AV, .3): s.put('beach_umbrella', x, z, rnd.uniform(.9, 1.05)); s.put('deck_chair', x + .9, z - .4, f=rnd.random() < .5)
    s.drift(['shell_pile'], W0 + 8, shore + 6.5, 6, 1.2, 4)
    # up the hill: the Offshore Bank, two villas with pools, palms
    s.rect(W0 + 3, 21.5, W0 + 12, 23.5, 'q')
    s.building('office_tower', W0 + 7.5, 24.2, act='sign', label='Offshore Bank', say='Offshore Bank. Deposits welcome. Questions are not. Opening hours: depends who’s asking.')
    for k, x, z in (('villa', W0 + 2.6, 29.6), ('villa', W0 + 12.6, 29.2)):
        s.plot(k, x, z, act='house', lawn='l', fence=False)
        s.blob(x + 3.2, z - 2.6, 1.6, 1.0, 'w', .1)
    s.scatter(['palm_tree', 'palm_tree_b', 'palm_small'], 12, (W0 + .5, shore + 3, W - .5, H - .5), svar=.15, gap=.6)
    s.scatter(['bush_flower', 'flowers_purple', 'flowers_mixed'], 8, (W0 + .5, shore + 3, W - .5, H - .5))
    s.scatter(['palm_tree', 'palm_small', 'bush_flower', 'rocks'], 14, (0, H0 + .3, W, H - .3), svar=.2, gap=.2, road=.6)
    s.life('gull', 4); s.life('crab', 3)
    s.d['folk'] = s.d.get('folk', 6) + 3
    s.d.setdefault('chat', []).extend(['The Marina is just along the promenade. Every boat there is registered somewhere else.', 'The Offshore Bank has no windows on the inside.'])
    return moved


def grow_summit(G, rnd):
    s = G.s; W0, H0, W, H = G.W0, G.H0, s.W, s.H
    G.streams_on(); moved = G.move_exits()
    # Upper Village: the town's streets carry on to the right, chalets round a frozen pond, a cocoa stall, a lookout
    for z0 in (15, 23):
        if s.at(W0 - 1.5, z0 + 1.5) in 'q' or s.at(W0 - 2.5, z0 + 1.5) in 'q': s.rect(W0, z0, W - 2, z0 + 3, 'q')
    s.rect(W - 4, 15, W - 1, 26, 'q')
    for k, x, z in (('chalet', W0 + 3.4, 19.6), ('chalet_b', W0 + 9.6, 19.8), ('chalet', W0 + 4.4, 27.6), ('chalet_b', W0 + 10.6, 27.8)):
        s.plot(k, x, z, act='house', lawn='l', fence=False)
    s.pond(W0 + 7.5, 8.6, 3.4, 2.2, sand=False, reeds=0, lilies=0, deep=False, rocks=3, dip=.5)
    s.put('snowman', W0 + 3.0, 6.2); s.put('snowman', W0 + 12.2, 11.0, .85, f=1)
    s.put('stall', W0 + 6.8, 13.2, act='sign', say='Hot cocoa, one coin. Marshmallows are a premium subscription.')
    s.put('bench_wood', W0 + 10.0, 13.0)
    s.put('flag_pole', W - 2.6, 31.2); s.put('bench_wood', W - 5.0, 31.0); s.put('ski_sign', W - 7.2, 31.4, act='sign', say='Lookout. On a clear day you can see the money.')
    for x in (W0 + 1, W0 + 7, W0 + 13): s.put('streetlamp_b', x, 18.2)
    s.scatter(['tree_pine_snow', 'tree_pine_snow_b', 'tree_pine_snow_small'], 12, (W0 + .5, 1, W - .5, H - .5), svar=.2, gap=.5)
    s.scatter(['rocks_snow', 'boulder_snow'], 6, (W0 + .5, 1, W - .5, H - .5))
    s.scatter(['tree_pine_snow', 'tree_pine_snow_b', 'tree_pine_snow', 'boulder_snow'], 22, (0, H0 + .3, W, H - .2), svar=.22, gap=.1, road=.6)
    s.d['folk'] = s.d.get('folk', 6) + 3
    s.d.setdefault('chat', []).extend(['Upper Village is past the last street. The pond freezes so hard you could skate on it.', 'The cocoa stall takes coins, cards and future earnings.'])
    return moved


def grow_water(G, rnd):
    """open water: the sea (or lake) runs on, with a small island to steer past"""
    s = G.s; W0, H0, W, H = G.W0, G.H0, s.W, s.H; P = palette(G.old)
    moved = G.move_exits()
    cx, cz = (W0 + W) / 2 + rnd.uniform(-1, 1), H * .55
    s.blob(cx, cz, 3.2, 2.2, 's', .3); s.blob(cx, cz + .3, 1.8, 1.1, 'G', .3)
    lake = 'reeds' in ''.join(P['bush'] + P['trees'] + [p['k'] for p in G.old.get('props', [])])
    s.scatter(P['trees'][:3], 3, (cx - 2.4, cz - 1.4, cx + 2.4, cz + 1.6), svar=.15, gap=.3, avoid='wdpqcb')
    s.scatter(['reeds', 'cattails'] if lake else ['shell_pile', 'rock_flat', 'rocks'], 6, (cx - 3.6, cz - 2.6, cx + 3.6, cz + 2.6), avoid='dpqcb', gap=.1)
    for k in range(3):
        x, z = rnd.uniform(W0 + 1, W - 1), rnd.uniform(2, H - 2)
        if s.at(x, z) in 'wd' and math.hypot(x - cx, z - cz) > 5: s.put('buoy' if not lake else 'pond_lily', x, z, block=False)
    return moved


TOWN = {'sundown': grow_sundown, 'taxhaven': grow_taxhaven, 'summit': grow_summit, 'offshore': grow_water, 'lake': grow_water}


def main():
    dry = '--dry' in sys.argv
    head, D = load(); n = 0
    for sid, (dx, dz) in GROW.items():
        sc = D['scenes'].get(sid)
        if not sc: print('  no scene', sid); continue
        if sc.get('grown', 0) >= 31: print(f'  {sid}: already grown'); continue
        seed = 3100 + sum(map(ord, sid)); rnd = random.Random(seed)
        G = Grown(sid, sc, dx, dz, seed)
        moved = (TOWN.get(sid) or grow_route)(G, rnd)
        out = G.finish(); n += 1
        print(f"  {sid}: {G.W0}x{G.H0} -> {out['w']}x{out['h']}, {len(out['props']) - len(sc.get('props', []))} new props, exits moved {[(m[1], m[2]) for m in moved]}")
        if not dry: D['scenes'][sid] = out
    if not dry and n: save(head, D); print(f'grew {n} scenes')


if __name__ == '__main__':
    main()
