#!/usr/bin/env python3
"""alpha 0.4: buildings turned a little. Houses and shops turn a few degrees, along curved streets and toward their
squares, instead of all facing the camera. Each 3D building in an outdoor place gets `rot` (degrees, turning about its
door, the middle of its front; positive turns its front toward the left as you look at it): the street in front of it
sets the angle (its front runs along the street), a square in front of it draws it round toward its middle, and a
little hand-placed unevenness keeps a row from looking ruled. At most 6 degrees; civic buildings (the city hall, the
station, the bank...) at most 2. No turned building may touch another building or a solid prop it didn't touch before.

    python3 tools/turn-buildings.py            # write rot into the game data (a building with rot already set is left alone)
    python3 tools/turn-buildings.py --dry      # only report
    python3 tools/turn-buildings.py --redo     # work every building out again (also those with rot set)
"""
import json, math, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'data' / 'gamedata.js'
ARGS = sys.argv[1:]
MAX_ROT, CIVIC_ROT = 6.0, 2.0
CIVIC = {'city_hall', 'station', 'bank', 'library', 'school', 'market_hall', 'fire_station', 'mansion', 'office_tower', 'lab', 'clinic'}
STREET = set('pcmbaqheKTVYi;-uvC')   # paved kinds, paths and plazas: what a building's front faces


def load():
    s = DATA.read_text(encoding='utf-8'); i = s.index('window.GAMEDATA=') + len('window.GAMEDATA=')
    D, end = json.JSONDecoder().raw_decode(s, i)
    return s[:i - len('window.GAMEDATA=')], D


def save(head, D):
    DATA.write_text(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')


def hsh(x, z, k=0):
    h = (int(x * 73856093) ^ int(z * 19349663) ^ (k * 83492791)) & 0xffffffff
    h = (h ^ (h >> 13)) * 1274126177 & 0xffffffff
    return ((h ^ (h >> 16)) & 0xffffffff) / 4294967296


def footprint(p, M, rot=None):
    """the four corners of a prop's box in place metres (front at p.z - .1, back at p.z + depth), turned by rot"""
    s = p.get('s', 1); w, d = M['box'][0] * s, M['box'][1] * s
    r = math.radians(p.get('rot', 0) if rot is None else rot); c, sn = math.cos(r), math.sin(r)
    pts = [(-w / 2, -.1), (w / 2, -.1), (w / 2, d), (-w / 2, d)]
    return [(p['x'] + x * c - z * sn, p['z'] + x * sn + z * c) for x, z in pts]


def overlap(A, B):
    """two convex quads overlap (separating axis test)"""
    for P in (A, B):
        for i in range(4):
            x0, z0 = P[i]; x1, z1 = P[(i + 1) % 4]; nx, nz = z1 - z0, x0 - x1
            a = [nx * x + nz * z for x, z in A]; b = [nx * x + nz * z for x, z in B]
            if max(a) < min(b) + 1e-6 or max(b) < min(a) + 1e-6: return False
    return True


def street_angle(sc, p, M):
    """the angle (degrees) a building's front would turn to run along the street in front of it: the street's near edge
    across the building's width (and 2 m either side), a robust straight fit (the median of the slopes between every
    two columns, so a side street or the building's own way in doesn't tip it). In front of a square instead (mostly
    paved ahead), it turns a little toward the square's middle. None when there's no street in front"""
    rows = sc['tiles']; H = len(rows); W = sc['w']; s = p.get('s', 1); w = M['box'][0] * s
    at = lambda x, z: rows[H - 1 - z][x] if 0 <= H - 1 - z < H and 0 <= x < W else ''
    cols = []
    for xx in range(int(p['x'] - w / 2 - 2), int(p['x'] + w / 2 + 3)):
        if abs(xx + .5 - p['x']) < 1.4: continue          # the building's own way in runs across the street
        for zz in range(int(p['z'] - 1.5), int(p['z'] - 10), -1):
            if at(xx, zz) in STREET: cols.append((xx + .5, zz + .5)); break
    # a square: most of the ground ahead is paved
    ahead = [(xx + .5, zz + .5) for zz in range(int(p['z'] - 12), int(p['z'] - 1)) for xx in range(int(p['x'] - 8), int(p['x'] + 9)) if at(xx, zz) in STREET]
    if len(ahead) > .55 * 11 * 17:
        mx = sum(x for x, _ in ahead) / len(ahead); mz = sum(z for _, z in ahead) / len(ahead)
        v = math.degrees(math.atan2(mx - p['x'], p['z'] - mz))
        return max(-20, min(20, v)) * .4, 'square'
    if len(cols) < 4: return None
    sl = sorted((b[1] - a[1]) / (b[0] - a[0]) for i, a in enumerate(cols) for b in cols[i + 1:] if b[0] != a[0])
    m = sl[len(sl) // 2]
    return math.degrees(math.atan(m)), 'street'


def main():
    head, D = load(); C = D['scenery']['props']; changed = 0; report = []
    for sid, sc in D['scenes'].items():
        if '@' in sid or sc.get('indoor') or sid.startswith('test'): continue
        props = sc.get('props', []); blds = [p for p in props if C.get(p['k'], {}).get('build') and C.get(p['k'], {}).get('box')]
        if not blds: continue
        solids = [p for p in props if C.get(p['k'], {}).get('box') and p not in blds]
        raw = {id(p): street_angle(sc, p, C[p['k']]) for p in blds}
        for p in blds:
            if 'rot' in p and '--redo' not in ARGS: continue
            M = C[p['k']]; a = raw[id(p)]
            near = [raw[id(q)][0] for q in blds if raw[id(q)] and abs(q['z'] - p['z']) < 2 and abs(q['x'] - p['x']) < 9]
            base = sum(near) / len(near) if near else 0.0
            civic = p['k'] in CIVIC; lim = CIVIC_ROT if civic else MAX_ROT
            jit = 0 if civic else (hsh(p['x'], p['z'], 7) - .5) * 5.0
            want = max(-lim, min(lim, round((base + jit) * 2) / 2))
            # never into a neighbour: step back toward 0 until it touches nothing it didn't touch straight
            others = [footprint(q, C[q['k']]) for q in blds + solids if q is not p]
            before = {i for i, o in enumerate(others) if overlap(footprint(p, M, 0), o)}
            r = want
            while abs(r) > 0:
                F = footprint(p, M, r)
                if not any(overlap(F, o) for i, o in enumerate(others) if i not in before): break
                r = math.copysign(max(0, abs(r) - .5), r)
            if r:
                if p.get('rot') != r: changed += 1
                p['rot'] = r
            elif 'rot' in p:
                del p['rot']; changed += 1
            report.append((sid, p['k'], round(p['x'], 1), round(p['z'], 1), a[1] if a else '-', round(base, 1), r))
    by = {}
    for r in report: by.setdefault(r[0], []).append(r[6])
    for sid, L in by.items():
        nz = [x for x in L if x]
        print(f'{sid:12s} {len(L):3d} buildings, {len(nz):3d} turned, mean |rot| {sum(abs(x) for x in L) / len(L):.1f}°, range {min(L):+.1f}..{max(L):+.1f}')
    if '--verbose' in ARGS:
        for r in report: print(*r)
    if '--dry' in ARGS: print('dry run:', changed, 'would change'); return
    save(head, D); print('turned', changed, 'buildings')


if __name__ == '__main__':
    main()
