#!/usr/bin/env python3
"""v42: the wild-growth pass. Scatters the nature props (tools/build-nature-props.py) over the outdoor scenes by
family and terrain: every nature prop says which ground letters it grows on ("grow" in the catalogue) and how
common it is ("weight"). The pass is deterministic (a fixed seed per scene), only adds, and marks what it adds with
"w": 42, so hand-placed props are never moved and a later pass can take its own props out and grow again.

It keeps clear of: paved ground and paths (plus half a metre), water unless the plant grows in water, the hub and
the exits (two metres), doors (a strip in front of every building), and every prop already there (by its footprint).

    python3 tools/grow-wild.py                 # grow every outdoor scene that has not been grown (marked "wild": 42)
    python3 tools/grow-wild.py tallgrass_meadow willowmere  # just these
    python3 tools/grow-wild.py --regrow        # take out what an earlier pass added and grow again
    python3 tools/grow-wild.py --density 1.5   # thicker (1 = about one plant per 30 square metres)
    python3 tools/grow-wild.py --dry           # report only"""
import gamedata  # phase 04b: the data files in game/data
import sys, json, math, random, zlib
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'data' / 'gamedata.js'
PAVED = set('pcmbaqheo')          # path, plaza, mall floor, boards, asphalt, pavers, brick, steps, farm soil
WATER = set('wd')
FAMILY_SHARE = dict(flowers=.36, ground=.34, shrubs=.09, water=.10, rocks=.06, trees=.02, seasons=.03)
MARK = 42
DENSITY = 0.8


def load():
    src = gamedata.js_text(); i = src.index('window.GAMEDATA='); head = src[:i]
    return head, json.JSONDecoder().raw_decode(src[i + len('window.GAMEDATA='):])[0]


def save(head, D):
    gamedata.save_js(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n')


def radius(M, s=1.0):
    if not M: return .5
    if M.get('box'): return max(M['box']) * .5 * s + .6
    if M.get('solid'): return M['solid'] * s + .15
    if M.get('flat'): return .35 * s
    return max(.3, (M.get('shadow') or 0) * .42 * s + .2)


def grow_scene(sid, sc, cat, nature, density, rnd):
    w, h = sc['w'], sc['h']; tiles = sc.get('tiles') or []
    def ch(x, z):
        row = tiles[h - 1 - int(z)] if 0 <= int(z) < h else ''
        return row[int(x)] if 0 <= int(x) < len(row) else ' '
    hub = sc.get('hub') or [w / 2, h / 2]
    keep = [(hub[0], hub[1], 2.2)] + [(e[0], e[1], 2.2) for e in sc.get('exits') or []]
    for spot in sc.get('npcSpots') or []:
        if isinstance(spot, list) and len(spot) >= 2 and isinstance(spot[0], (int, float)): keep.append((spot[0], spot[1], 1.0))
    occ = []                                   # (x, z, r) of what is there
    for p in sc.get('props') or []:
        M = cat.get(p['k']); s = p.get('s') or 1
        occ.append((p['x'], p['z'], radius(M, s)))
        if M and (M.get('door') or M.get('box')):      # a strip in front of the door
            bw = (M['box'][0] if M.get('box') else 2) * s
            occ.append((p['x'], p['z'] - 1.2, bw * .5 + .5))
    def along(a, b, r):
        n = int(math.hypot(b[0] - a[0], b[1] - a[1]) / .5) + 1
        for i in range(n + 1):
            t = i / n; occ.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, r))
    for br in sc.get('bridges') or []:
        if isinstance(br, dict) and br.get('a') and br.get('b'): along(br['a'], br['b'], (br.get('w') or 1.2) * .5 + .4)
    for rl in sc.get('rails') or []:
        pts = rl.get('pts') if isinstance(rl, dict) else None
        if pts:
            for i in range(len(pts) - 1): along(pts[i], pts[i + 1], .5)
    for ar in sc.get('arches') or []:
        if isinstance(ar, dict) and 'x' in ar: occ.append((ar['x'], ar['z'], max(ar.get('w') or 2, ar.get('d') or 1) * .5 + .8))
    steps = sc.get('steps') if isinstance(sc.get('steps'), str) else ''
    for st in sc.get('streams') or []:
        for q in st.get('pts') or []: occ.append((q[0], q[1], .8))
    letters = set(''.join(tiles)); wk = sc.get('waterKind') or 'pond'
    if wk in ('sea', 'lava', 'ice'): letters -= WATER        # nothing grows in the sea, in lava or under ice
    pool = {}
    for k, M in nature.items():
        if not set(M['grow']) & letters: continue
        if M['family'] == 'trees' and sc.get('indoor'): continue
        pool.setdefault(M['family'], []).append(k)
    if not pool: return []
    area = w * h; want = int(area / 30 * density)
    added = []
    def free(x, z, r):
        if x < .4 or z < .4 or x > w - .4 or z > h - .4: return False
        for (ox, oz, orr) in keep:
            if math.hypot(x - ox, z - oz) < orr + r: return False
        for (ox, oz, orr) in occ:
            if math.hypot(x - ox, z - oz) < orr + r: return False
        return True
    def paved_near(x, z):
        for dx in (-.5, 0, .5):
            for dz in (-.5, 0, .5):
                if ch(x + dx, z + dz) in PAVED: return True
        return False
    fams = [f for f in FAMILY_SHARE if f in pool]
    weights = [FAMILY_SHARE[f] for f in fams]
    tries = 0
    while len(added) < want and tries < want * 40:
        tries += 1
        fam = rnd.choices(fams, weights)[0]
        x = rnd.uniform(.5, w - .5); z = rnd.uniform(.5, h - .5); c = ch(x, z)
        if c in PAVED or paved_near(x, z): continue
        if steps and steps[(h - 1 - int(z)) * w + int(x):(h - 1 - int(z)) * w + int(x) + 1] not in ('', 'A'): continue
        if c in WATER and c not in letters: continue
        ks = [k for k in pool[fam] if c in nature[k]['grow'] and added.count(k) < max(6, want // 5)]   # no one plant takes over
        if not ks: continue
        k = rnd.choices(ks, [nature[q]['weight'] for q in ks])[0]; M = cat[k]
        if c in WATER and 'w' not in M['grow'] and 'd' not in M['grow']: continue
        s = round(rnd.uniform(.85, 1.15), 2); r = radius(M, s)
        if fam in ('trees', 'shrubs') and math.hypot(x - hub[0], z - hub[1]) < 6: continue
        if not free(x, z, r + .25): continue
        q = dict(k=k, x=round(x, 2), z=round(z, 2), w=MARK)
        if abs(s - 1) > .02: q['s'] = s
        if rnd.random() < .45: q['f'] = 1
        sc.setdefault('props', []).append(q); occ.append((x, z, r)); added.append(k)
    sc['wild'] = MARK
    return added


def main():
    args = sys.argv[1:]; density = DENSITY; dry = '--dry' in args; regrow = '--regrow' in args
    if '--density' in args:
        i = args.index('--density'); density = float(args[i + 1]); del args[i:i + 2]
    ids = [a for a in args if not a.startswith('--')]
    head, D = load(); cat = D['scenery']['props']
    nature = {k: M for k, M in cat.items() if M.get('family') and M.get('grow')}
    if not nature: print('no nature props in the catalogue; run tools/build-nature-props.py first'); return
    total = 0
    for sid, sc in D['maps'].items():
        if ids and sid not in ids: continue
        if not ids and (sid.startswith('test_') or sid.startswith('int_') or sc.get('indoor') or sc.get('room')): continue
        if regrow:
            before = len(sc.get('props') or []); sc['props'] = [p for p in sc.get('props') or [] if p.get('w') != MARK]
            if before != len(sc['props']): print(f'  {sid}: took out {before - len(sc["props"])} grown props')
            sc.pop('wild', None)
        if sc.get('wild') == MARK and not ids: print(f'  {sid}: already grown'); continue
        rnd = random.Random(zlib.crc32(('wild-' + sid).encode()))
        added = grow_scene(sid, sc, cat, nature, density, rnd)
        from collections import Counter
        top = ', '.join(f'{k} x{n}' for k, n in Counter(added).most_common(5))
        print(f'  {sid}: +{len(added)} ({top})'); total += len(added)
    if not dry: save(head, D); print(f'{total} props grown; game data written')
    else: print(f'{total} props would be grown (dry run)')


if __name__ == '__main__':
    main()
