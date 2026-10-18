#!/usr/bin/env python3
"""v47 part 3: a lived-in world. Adds to the places (it never moves or removes anything of yours):

  signs of people   washing lines beside houses, crates and barrels by shops and the inn, a bin behind the shop,
                    bikes by the library, school and station, planters and a gnome or two by front doors, chalk on the
                    paving outside a few (hopscotch or a drawing, "dry": gone in the rain; pictures from
                    tools/build-landmarks-v47.py, so run that first)
  routines          the baker's bread out in the morning (a rack by the bakery door, hours 6 to 12)
  market day        on Saturdays stalls and a cart fill Sundown's square, and more people come (scene "market")
  the seasons       raked leaves under the town trees in autumn (season "autumn")
  cats              a couple of cats in every town
  worn shortcuts    the lines people really walk across the grass (scene "worn": the ground painter wears them)
  crops             the farm's fields grow and are harvested on rounds of their own ("grow" on each crop)
  crows             the scrap yard's pigeons are crows (a new animal, art/scene/life/crow.png)

Everything added carries "v47life": 1, so running this again first takes the previous run's things away. A place
marked "keep" in the Studio is left alone.

    python3 tools/build-life-v47.py            # all towns
    python3 tools/build-life-v47.py sundown    # just these
    python3 tools/build-life-v47.py --dry      # report, write nothing
    python3 tools/build-life-v47.py --map out/ # draw a top-down map of each place (worn lines in orange)
"""
import gamedata  # phase 04b: the data files in game/data
import json, math, random, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'data' / 'gamedata.js'
PPU = 34
PAVED = set('pcmqhaeKTvb')       # streets, squares, boards: nothing is put down on them
WATER = set('wd')
SOFT = set('gGflytCMLHRDSPnuzjskoV')
TAG = 'v47life'


def load():
    src = gamedata.js_text(); i = src.index('window.GAMEDATA=')
    return src[:i], json.JSONDecoder().raw_decode(src[i + len('window.GAMEDATA='):])[0]


def save(head, D):
    gamedata.save_js(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n')


class Place:
    """what is where in a scene: footprints of the things in it, and the ground"""
    def __init__(self, sid, sc, cat):
        self.sid, self.sc, self.cat = sid, sc, cat; self.W, self.H = sc['w'], sc['h']; self.added = []

    def tile(self, x, z):
        if x < 0 or z < 0 or x >= self.W or z >= self.H: return None
        row = self.sc['tiles'][self.H - 1 - int(z)]
        return row[int(x)] if int(x) < len(row) else self.sc.get('edge', 'g')

    def foot(self, p):
        """a footprint: ('box', x0, z0, x1, z1) or ('disc', x, z, r)"""
        M = self.cat.get(p['k']) or {}; s = p.get('s', 1)
        if M.get('box'):
            w, d = M['box'][0] * s, M['box'][1] * s; return ('box', p['x'] - w / 2, p['z'] - .1, p['x'] + w / 2, p['z'] + d)
        r = M.get('solid'); r = r * s if r is not None else (0 if M.get('flat') else (M.get('shadow') or 0) * .42 * s)
        return ('disc', p['x'], p['z'], max(.25, r))

    def clear(self, x, z, r, ground=SOFT, ignore_flat=True):
        """nothing within r of (x, z), on the right kind of ground, inside the place"""
        if x < r + 1 or z < r + 1 or x > self.W - r - 1 or z > self.H - r - 1: return False
        for dx, dz in ((0, 0), (r, 0), (-r, 0), (0, r), (0, -r)):
            t = self.tile(x + dx, z + dz)
            if t is None or t in WATER or (ground is not None and t not in ground): return False
        for p in self.sc['props'] + self.added:
            M = self.cat.get(p['k']) or {}
            if ignore_flat and M.get('flat') and not M.get('box'): continue
            f = self.foot(p)
            if f[0] == 'box':
                if f[1] - r < x < f[3] + r and f[2] - r < z < f[4] + r: return False
            elif math.hypot(f[1] - x, f[2] - z) < f[3] + r: return False
        return True

    def clear_rect(self, x, z, hw, hd, ground=SOFT, small=.3):
        """a thin thing (a washing line): its ends on the right ground, nothing bigger than a flowerpot in the way"""
        if x < hw + 1 or z < hd + 1 or x > self.W - hw - 1 or z > self.H - hd - 1: return False
        for dx in (-hw, 0, hw):
            t = self.tile(x + dx, z)
            if t is None or t in WATER or (ground is not None and t not in ground): return False
        for p in self.sc['props'] + self.added:
            M = self.cat.get(p['k']) or {}
            if M.get('flat') and not M.get('box'): continue
            f = self.foot(p)
            if f[0] == 'box':
                if f[1] - hw < x < f[3] + hw and f[2] - hd < z < f[4] + hd: return False
            elif f[3] > small and abs(f[1] - x) < f[3] + hw and abs(f[2] - z) < f[3] + hd: return False
        return True

    def put(self, k, x, z, **kw):
        p = {'k': k, 'x': round(x, 2), 'z': round(z, 2), TAG: 1}; p.update(kw); self.added.append(p); return p

    def door(self, p):
        M = self.cat.get(p['k']) or {}; d = M.get('door') or {}; s = p.get('s', 1); f = -1 if p.get('f') else 1
        return (p['x'] + (d.get('x') or 0) / PPU * s * f, p['z'] - .55)


WORK = ('shop', 'clinic', 'bakery', 'inn', 'market_hall', 'library', 'school', 'station', 'bank', 'shop_mart', 'shop_cafe', 'shop_boutique', 'fire_station', 'greenhouse', 'barn')
HOME = ('house', 'cottage', 'townhouse', 'apartment', 'cave_house', 'chalet', 'villa')
LEAFY = ('tree_oak', 'tree_birch', 'tree_blossom', 'tree_fruit', 'tree_maple', 'tree_round')


def is_home(p, M): return bool(M.get('door')) and (p.get('act') == 'house' or any(h in p['k'] for h in HOME)) and not any(w == p['k'] for w in WORK)


def is_work(p, M): return bool(M.get('door')) and any(w == p['k'] or w == (M.get('group') or '') for w in WORK)


def dress(P, rnd):
    """signs of people round the buildings"""
    sc, cat = P.sc, P.cat; n = {'washing': 0, 'crates': 0, 'bin': 0, 'bikes': 0, 'planters': 0, 'gnomes': 0, 'bread': 0}
    city = P.sid in ('city', 'mall') or (sc.get('biome') == 'city')
    for p in list(sc['props']):
        M = cat.get(p['k']) or {}
        if not M.get('box') or not M.get('door') or p.get(TAG): continue
        s = p.get('s', 1); w, d = M['box'][0] * s, M['box'][1] * s; x, z = p['x'], p['z']
        if is_home(p, M):
            # washing on a line beside some houses, out of the way of the street
            if rnd.random() < (.25 if city else .5):
                sd = rnd.choice((-1, 1)); done = False
                for side, gap, back in ((sd, 2.1, .55), (-sd, 2.1, .55), (sd, 2.7, .8), (-sd, 2.7, .8), (sd, 0, 1.25), (-sd, 0, 1.25)):
                    cx, cz = x + side * (w / 2 + gap) if gap else x + side * .6, z + d * back + (1.0 if not gap else 0)
                    if P.clear_rect(cx, cz, 1.95, .45): P.put('laundry_line', cx, cz, f=side < 0); n['washing'] += 1; done = True; break
            # a planter or a gnome by the front corner
            r = rnd.random()
            if r < .3:
                for side in (1, -1):
                    cx, cz = x + side * (w / 2 - .6), z - .8
                    if P.clear(cx, cz, .5, ground=SOFT | PAVED): P.put('planter_box', cx, cz); n['planters'] += 1; break
            elif r < .42:
                for side in (1, -1):
                    cx, cz = x + side * (w / 2 + .55), z - .7
                    if P.clear(cx, cz, .3): P.put('garden_gnome', cx, cz); n['gnomes'] += 1; break
            # a barrel by the side of the odd house
            if rnd.random() < .22:
                cx, cz = x + rnd.choice((-1, 1)) * (w / 2 + .45), z + .5
                if P.clear(cx, cz, .45, ground=SOFT | PAVED): P.put('barrel_wood', cx, cz); n['crates'] += 1
        elif is_work(p, M):
            g = p['k']
            # crates and barrels stacked by the side of shops, the inn and the bakery
            if g in ('shop', 'bakery', 'inn', 'market_hall', 'shop_mart', 'shop_cafe', 'barn', 'greenhouse'):
                for side in (1, -1):
                    cx, cz = x + side * (w / 2 + .7), z + .6
                    if P.clear(cx, cz, .75, ground=SOFT | PAVED):
                        P.put(rnd.choice(('crates', 'crate_stack', 'barrels')), cx, cz); n['crates'] += 1; break
            # a bin round the back of the shop and the inn
            if g in ('shop', 'inn', 'shop_mart', 'shop_cafe'):
                cx, cz = x + rnd.choice((-1, 1)) * (w / 2 + 1.3), z + d * .7
                if P.clear(cx, cz, 1.1, ground=SOFT | PAVED): P.put('bin', cx, cz); n['bin'] += 1
            # bikes by the library, the school and the station
            if g in ('library', 'school', 'station'):
                cx, cz = x + rnd.choice((-1, 1)) * (w / 2 + .9), z - .6
                if P.clear(cx, cz, .6, ground=SOFT | PAVED): P.put('bike_rack', cx, cz); n['bikes'] += 1
            # the baker puts bread out in the morning
            if g == 'bakery':
                dx, dz = P.door(p)
                for cx in (dx + 1.6, dx - 1.6, dx + 2.4):
                    if P.clear(cx, z - .55, .55, ground=SOFT | PAVED): P.put('bread_rack', cx, z - .55, hours=[6, 12]); n['bread'] += 1; break
    return n


def chalk(P, rnd):
    """chalk on the paving in front of some front doors: hopscotch or a drawing. "dry": the rain washes it away and
    it is drawn again once the ground has dried (walk-view.js dioPropOn). The pictures come from tools/build-landmarks-v47.py"""
    if 'chalk_hopscotch' not in P.cat: return 0
    n = 0; homes = [p for p in P.sc['props'] if (P.cat.get(p['k']) or {}).get('box') and is_home(p, P.cat.get(p['k']) or {}) and not p.get(TAG)]
    rnd.shuffle(homes)
    for p in homes:
        if n >= 3: break
        if rnd.random() > .45: continue
        dx, dz = P.door(p); done = False
        for k in (('chalk_hopscotch', 'chalk_sun') if n % 2 == 0 else ('chalk_sun', 'chalk_hopscotch')):
            for (ox, oz) in ((1.4, -1.8), (-1.4, -1.8), (2.2, -2.6), (-2.2, -2.6), (0, -3.0), (2.6, -1.4), (-2.6, -1.4), (0, -4.2)):
                x, z = dx + ox, dz + oz; L = 1.0 if k == 'chalk_hopscotch' else .5
                if all(P.clear(x, z + t, .55, ground=PAVED, ignore_flat=False) for t in (-L, 0, L)):
                    P.put(k, x, z, dry=True); n += 1; done = True; break
            if done: break
    return n


def market(P, rnd):
    """Saturday: stalls and a cart round the square, and more people about"""
    sc = P.sc; hub = sc.get('hub') or [P.W / 2, P.H / 2]
    sq = next((p for p in sc['props'] if p['k'] == 'fountain'), None); cx, cz = (sq['x'], sq['z']) if sq else hub
    want = [('stall', -7.5, -2.6), ('stall', 7.5, -2.6), ('stall', -10.5, 1.6), ('stall', 10.5, 1.6), ('market_cart', -4.2, -4.4), ('market_cart', 4.6, -4.6)]
    n = 0
    for k, ox, oz in want:
        for t in range(14):
            x, z = cx + ox + (rnd.random() - .5) * t * .5, cz + oz + (rnd.random() - .5) * t * .4
            if P.clear(x, z, 1.9 if k == 'stall' else 1.5, ground=SOFT | PAVED): P.put(k, x, z, days=[6], hours=[7, 18]); n += 1; break
    sc['market'] = {'days': [6], 'folk': 8}
    return n


def leaves(P, rnd):
    """raked leaf piles under the town's leafy trees in autumn"""
    n = 0; trees = [p for p in P.sc['props'] if any(p['k'].startswith(t) for t in LEAFY)]; rnd.shuffle(trees)
    for p in trees[:40]:
        if n >= 9: break
        a = rnd.random() * 6.28; x, z = p['x'] + math.cos(a) * 1.4, p['z'] - .6 + math.sin(a) * .5
        if P.clear(x, z, .7, ignore_flat=False): P.put('fallen_leaves', x, z, season='autumn', s=round(.9 + rnd.random() * .5, 2)); n += 1
    return n


def cats(P):
    L = P.sc.setdefault('life', [])
    if any(e.get('k') == 'cat' for e in L): return 0
    L.append({'k': 'cat', 'n': 2, TAG: 1}); return 2


def worn(P, rnd):
    """the shortcuts: from the square to the doors people use most, and from doors to the nearest street, wherever
    the straight way crosses grass. The ground painter wears them in (walk-view.js dioWearLines)."""
    sc, cat = P.sc, P.cat; hub = sc.get('hub') or [P.W / 2, P.H / 2]; L = []

    def soft_share(a, b):
        n = max(2, int(math.hypot(b[0] - a[0], b[1] - a[1]) * 2)); k = 0
        for i in range(n + 1):
            t = P.tile(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n)
            if t in WATER or t is None: return -1
            if t in SOFT: k += 1
        return k / (n + 1)

    def blocked(a, b):
        n = max(2, int(math.hypot(b[0] - a[0], b[1] - a[1]) * 2))
        for i in range(1, n):
            x, z = a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n
            for p in sc['props']:
                M = cat.get(p['k']) or {}
                if M.get('box'):
                    f = P.foot(p)
                    if f[1] < x < f[3] and f[2] < z < f[4]: return True
        return False

    doors = []
    for p in sc['props']:
        M = cat.get(p['k']) or {}
        if M.get('door') and M.get('box'): doors.append((P.door(p), is_work(p, M)))
    for (d, work) in doors:
        if not work: continue
        L0 = math.hypot(d[0] - hub[0], d[1] - hub[1])
        if 6 < L0 < 30:
            sh = soft_share(hub, d)
            if sh > .35 and not blocked(hub, d): L.append([round(hub[0], 2), round(hub[1], 2), round(d[0], 2), round(d[1], 2)])
    # house doors out to the nearest bit of street, where they don't have a path already
    for (d, work) in doors:
        if work or len(L) > 16: continue
        best = None
        for r in range(2, 16):
            for a in range(0, 360, 20):
                x, z = d[0] + math.cos(math.radians(a)) * r * .5, d[1] + math.sin(math.radians(a)) * r * .5
                if P.tile(x, z) in PAVED: best = (x, z); break
            if best: break
        if best and math.hypot(best[0] - d[0], best[1] - d[1]) > 1.4 and soft_share(d, best) > .5 and not blocked(d, best) and rnd.random() < .6:
            L.append([round(d[0], 2), round(d[1], 2), round(best[0], 2), round(best[1], 2)])
    sc['worn'] = L
    return len(L)


def crops(sc):
    """the farm's fields grow and are harvested on rounds of their own (walk-view.js dioGrowK): each crop gets its
    field's number from where it stands"""
    n = 0
    for p in sc.get('props', []):
        if p['k'] == 'crops': p['grow'] = (int(p['x'] // 12) * 7 + int(p['z'] // 10) * 3) % 9; n += 1
    return n


def crows(sc):
    """the scrap yard's pigeons are crows"""
    n = 0
    for e in sc.get('life', []):
        if e.get('k') == 'pigeon': e['k'] = 'crow'; n += e.get('n', 1)
    return n


def draw_map(sid, sc, cat, path):
    from PIL import Image, ImageDraw
    k = 6; W, H = sc['w'], sc['h']; im = Image.new('RGB', (W * k, H * k), (90, 150, 70)); d = ImageDraw.Draw(im)
    col = lambda ch: (190, 150, 100) if ch in PAVED else (60, 130, 200) if ch in WATER else (90, 150, 70)
    for j, row in enumerate(sc['tiles']):
        for i2, ch in enumerate(row): d.rectangle([i2 * k, j * k, i2 * k + k - 1, j * k + k - 1], fill=col(ch))
    for w in sc.get('worn') or []: d.line([w[0] * k, (H - w[1]) * k, w[2] * k, (H - w[3]) * k], fill=(255, 150, 30), width=5)
    for p in sc['props']:
        M = cat.get(p['k'], {}); x, y = p['x'] * k, (H - p['z']) * k; new = p.get(TAG)
        if M.get('box'):
            w, dd = M['box']; s = p.get('s', 1); d.rectangle([x - w * s / 2 * k, y - dd * s * k, x + w * s / 2 * k, y], outline=(255, 255, 255), fill=(240, 220, 40) if new else (150, 60, 60))
        else: d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(240, 220, 40) if new else (40, 60, 40))
    im.save(path)


def main():
    args = sys.argv[1:]; dry = '--dry' in args; args = [a for a in args if a != '--dry']; mp = None
    if '--map' in args: j = args.index('--map'); mp = Path(args[j + 1]); del args[j:j + 2]; mp.mkdir(parents=True, exist_ok=True)
    head, D = load(); cat = D['scenery']['props']; S = D['scenes']
    life = D['scenery'].setdefault('life', {})
    if 'crow' not in life: life['crow'] = {'name': 'Crow', 'img': 'scene/life/crow.png', 'w': 24, 'h': 22, 'frames': 5, 'where': 'junk'}
    for sid, sc in S.items():
        if '@' in sid or sc.get('test'): continue
        c = crops(sc); w = crows(sc) if sid == 'scrapyard' else 0
        if c or w: print(f'{sid}: ' + ', '.join(x for x in (f'{c} crops on a round of their own' if c else '', f'{w} crows' if w else '') if x))
    towns = [r['scene'] for r in D['route'] if r.get('kind') == 'town' and r.get('scene') in S]
    want = args or towns
    for sid in want:
        sc = S.get(sid)
        if not sc: print(sid, 'no such scene'); continue
        # what the last run added goes first
        sc['props'] = [p for p in sc.get('props', []) if not p.get(TAG)]; sc['life'] = [e for e in sc.get('life', []) if not e.get(TAG)]
        sc.pop('worn', None); sc.pop('market', None)
        if sc.get('keep'): print(f'{sid}: kept as it is (marked keep)'); continue
        rnd = random.Random(f'life47-{sid}'); P = Place(sid, sc, cat)
        n = dress(P, rnd); mk = market(P, rnd) if sid == 'sundown' else 0; lv = leaves(P, rnd); ct = cats(P); wl = worn(P, rnd); n['chalk'] = chalk(P, random.Random(f'chalk47-{sid}'))
        sc['props'] = sc['props'] + P.added
        print(f'{sid}: ' + ', '.join(f'{v} {k}' for k, v in n.items() if v) + (f', {mk} market things' if mk else '') + f', {lv} leaf piles, {ct} cats, {wl} worn shortcuts')
        if mp: draw_map(sid, sc, cat, mp / f'{sid}.png')
    if not dry: save(head, D)


if __name__ == '__main__':
    main()
