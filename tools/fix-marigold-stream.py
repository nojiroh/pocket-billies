#!/usr/bin/env python3
"""alpha 0.4: no house stands in water. Marigold Town's stream came down from the hills at the back straight through
three houses on the west side (a cottage on the back lane, the large house and the blue house on the lanes below) and
under the street between them. It now bends west round the houses, through the grass behind them, and joins its old
course again just above the square, where it runs under the main street to the duck pond as before. Where its old bed
ran the ground is grass again (or the street, where the street crossed it); a little wooden footbridge carries the
lane to the townhouses over its new course. Nothing else in the town moves.

    python3 tools/fix-marigold-stream.py          # make the change (once: it checks the stream is where it was)
    python3 tools/fix-marigold-stream.py --dry    # draw before and after maps into the scratch folder, change nothing
    python3 tools/fix-marigold-stream.py --map out.png
"""
import gamedata  # phase 04b: the data files in game/data
import json, math, sys, random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'data' / 'gamedata.js'
OLD = [[21.2, 72.2], [22, 60], [23.4, 50], [22.2, 40], [21.4, 30], [20.8, 20], [21.4, 14]]
NEW = [[21.2, 75.6], [21.4, 70.6], [20.2, 66.8], [17.4, 63.2], [15.0, 59.4], [14.4, 54.0], [14.6, 48.0], [15.0, 42.6], [14.2, 37.8],
       [13.8, 33.0], [14.6, 29.6], [16.8, 27.4], [19.4, 26.0], [20.8, 23.8], [20.8, 20], [21.4, 14]]
ZCUT = 24.4          # below this the stream keeps its old course (under the main street, into the pond)
LAND = 'gGflCKpuqhv'


def load():
    src = gamedata.js_text(); i = src.index('window.GAMEDATA=')
    return src[:i], json.JSONDecoder().raw_decode(src[i + len('window.GAMEDATA='):])[0]


def save(head, D):
    gamedata.save_js(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n')


def seg_d(px, pz, a, b):
    vx, vz = b[0] - a[0], b[1] - a[1]; l2 = vx * vx + vz * vz or 1e-9
    k = max(0, min(1, ((px - a[0]) * vx + (pz - a[1]) * vz) / l2))
    return math.hypot(a[0] + vx * k - px, a[1] + vz * k - pz)


def line_d(px, pz, pts): return min(seg_d(px, pz, a, b) for a, b in zip(pts, pts[1:]))


def fix(D):
    sc = D['scenes']['sundown']; S = sc.get('streams') or []
    if not S or [[round(v, 1) for v in q] for q in S[0]['pts']] != OLD: return None
    H, W = sc['h'], sc['w']; rows = [list(r) for r in sc['tiles']]
    at = lambda x, z: rows[H - 1 - z][x] if 0 <= x < W and 0 <= z < H else None
    def put(x, z, ch):
        if 0 <= x < W and 0 <= z < H: rows[H - 1 - z][x] = ch
    rep = []
    # 1. the old bed above the square goes back to land: the ground most of its dry neighbours have
    old_cells = [(x, z) for z in range(int(ZCUT), H) for x in range(W) if at(x, z) in 'wds' and line_d(x + .5, z + .5, OLD + [[21.2, 76]]) < 1.9]
    new_d = lambda x, z: line_d(x + .5, z + .5, NEW)
    # the stream ran north to south: each square takes the dry ground found first to its west and to its east (the
    # street where the street crossed it, the grass elsewhere); where the two differ, the softer one
    orig = [r[:] for r in rows]; o_at = lambda x, z: orig[H - 1 - z][x] if 0 <= x < W and 0 <= z < H else None
    def first_dry(x, z, step):
        for k in range(1, 6):
            c = o_at(x + step * k, z)
            if c and c not in 'wds': return c
        return None
    for x, z in old_cells:
        if new_d(x, z) < 1.4: continue
        a, b = first_dry(x, z, -1), first_dry(x, z, 1)
        if a == b and a: ch = a
        else: ch = next((c for c in (a, b) if c and c in 'gGflC'), None) or next((c for c in (a, b) if c and c in LAND), 'g')
        if ch in 'Kpu' and not (a == b): ch = 'g'
        put(x, z, ch)
    left = sum(1 for x, z in old_cells if at(x, z) in 'wd' and new_d(x, z) >= 1.4)
    rep.append(f'{len(old_cells)} squares of the old bed are land again' + (f' ({left} still wet)' if left else ''))
    # 2. the new bed, west of the houses; banks of sand here and there, as the stream tool makes them
    r = random.Random(4402); new_cells = set()
    for z in range(int(ZCUT) - 1, H):
        for x in range(W):
            if new_d(x, z) <= .62 and z + .5 >= ZCUT - .6: new_cells.add((x, z))
    for x, z in new_cells: put(x, z, 'w')
    for x, z in new_cells:
        for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + a, z + b)
            if q not in new_cells and at(*q) in 'gGflyt' and r.random() < .45: put(q[0], q[1], 's')
    rep.append(f'{len(new_cells)} squares of new stream bed')
    sc['tiles'] = [''.join(rw) for rw in rows]
    S[0]['pts'] = NEW
    # 3. the street bridge over the old bed goes; a footbridge carries the townhouses' lane over the new one
    br = sc.get('bridges') or []
    sc['bridges'] = [b for b in br if not (abs(b['a'][1] - 40) < 1 and abs(b['a'][0] - 20.4) < 1)]
    if len(sc['bridges']) < len(br): rep.append('the street bridge at the old bed is gone (the street is whole again)')
    cross = [(x, z) for (x, z) in new_cells if 15 <= x <= 18 and 25 <= z <= 30]
    if cross:
        zs = sorted(z for x, z in cross if x in (16, 17)); xm = 16.6
        if zs:
            sc['bridges'].append({'a': [xm, round(zs[0] - .7, 2)], 'b': [xm, round(zs[-1] + 1.7, 2)], 'w': 1.6, 'kind': 'wood', 'a04stream': 1})
            rep.append(f'a footbridge over the new bed at x {xm}, z {zs[0] - .7:.1f} to {zs[-1] + 1.7:.1f}')
    # 4. nothing stands in the new water: plants, rocks and trees on it go
    C = D['scenery']['props']; gone = []
    def wet_near(p, rr):
        for dx in (-rr, 0, rr):
            for dz in (-rr, 0, rr):
                if at(int(math.floor(p['x'] + dx)), int(math.floor(p['z'] + dz))) in 'wd': return True
        return False
    keep = []
    for p in sc['props']:
        M = C.get(p['k']) or {}
        if not M.get('box') and not p.get('act') and new_d(p['x'] - .5, p['z'] - .5) < 2.2 and wet_near(p, .45 if (M.get('solid') or 0) > .3 else .2):
            gone.append(p['k']); continue
        keep.append(p)
    sc['props'] = keep
    rep.append(f'{len(gone)} plants and stones taken off the new bed: {", ".join(sorted(set(gone)))[:200]}')
    return rep


def buildings_in_water(D):
    """every building whose footprint (turned as it stands) has water in it"""
    C = D['scenery']['props']; out = []
    for sid, sc in D['scenes'].items():
        if '@' in sid or not sc.get('tiles'): continue
        T = sc['tiles']; H = len(T); W = len(T[0])
        at = lambda x, z: T[H - 1 - z][x] if 0 <= x < W and 0 <= z < H else None
        for p in sc.get('props', []):
            M = C.get(p['k']) or {}
            if not M.get('box') or not (M.get('build') or M.get('door')): continue
            s0 = p.get('s', 1); w, d = M['box'][0] * s0, M['box'][1] * s0; r = math.radians(p.get('rot', 0)); c, sn = math.cos(r), math.sin(r)
            wet = 0
            for ix in range(1, int(w * 2)):
                for iz in range(1, int(d * 2)):
                    lx, lz = -w / 2 + ix / 2, iz / 2; x = p['x'] + lx * c - lz * sn; z = p['z'] + lx * sn + lz * c
                    if at(int(math.floor(x)), int(math.floor(z))) in ('w', 'd'): wet += 1
            if wet: out.append((sid, p['k'], p['x'], p['z'], wet))
    return out


def draw(D, path):
    from PIL import Image, ImageDraw
    sc = D['scenes']['sundown']; T = sc['tiles']; H = sc['h']; k = 8
    col = {'w': (60, 130, 200), 'd': (40, 100, 170), 's': (220, 200, 140), 'K': (150, 140, 130), 'p': (190, 150, 100), 'u': (130, 95, 65), 'l': (100, 170, 80), 'g': (90, 150, 70)}
    x0, x1, z0, z1 = 4, 40, 10, 84
    im = Image.new('RGB', ((x1 - x0) * k, (z1 - z0) * k)); d = ImageDraw.Draw(im)
    for z in range(z0, z1):
        for x in range(x0, x1):
            ch = T[H - 1 - z][x]; d.rectangle([(x - x0) * k, (z1 - 1 - z) * k, (x - x0 + 1) * k - 1, (z1 - z) * k - 1], fill=col.get(ch, (70, 120, 60)))
    C = D['scenery']['props']
    for p in sc['props']:
        M = C.get(p['k']) or {}
        if M.get('box'):
            w, dd = M['box']; s0 = p.get('s', 1)
            d.rectangle([(p['x'] - w * s0 / 2 - x0) * k, (z1 - p['z'] - dd * s0) * k, (p['x'] + w * s0 / 2 - x0) * k, (z1 - p['z']) * k], outline=(255, 255, 255), fill=(200, 60, 60) if M.get('build') else None)
    for b in sc.get('bridges') or []:
        d.line([(b['a'][0] - x0) * k, (z1 - b['a'][1]) * k, (b['b'][0] - x0) * k, (z1 - b['b'][1]) * k], fill=(120, 70, 30), width=int(b['w'] * k))
    im.save(path)


def main():
    args = sys.argv[1:]; dry = '--dry' in args; mp = args[args.index('--map') + 1] if '--map' in args else None
    head, D = load()
    if mp: draw(D, mp.replace('.png', '-before.png'))
    rep = fix(D)
    if rep is None: print('Marigold Town’s stream isn’t where it was (changed already?): nothing done')
    else: print('\n'.join(rep))
    if mp: draw(D, mp)
    left = buildings_in_water(D)
    print(f'{len(left)} buildings with water in them' + (': ' + '; '.join(f'{a} {b} at {c},{d} ({e})' for a, b, c, d, e in left) if left else ''))
    if rep is not None and not dry: save(head, D); print('saved')


if __name__ == '__main__':
    main()
