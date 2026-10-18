#!/usr/bin/env python3
"""alpha 0.4: jetties are flat, with water underneath. A jetty used to be a strip of Boards ground laid over the water,
so its planks followed the pond's bed down and up again. Now every strip of boards that runs out into water becomes a
jetty structure (scene.bridges, pier: 1): one flat wooden deck from the bank out over the water, level with the bank,
on posts, with the water running under it (structures.js draws it, walk-view.js walks on it). The squares under the
deck turn back into water; boards on dry land (the walk up to a jetty, a boardwalk through a marsh) stay as they are.

    python3 tools/fix-piers.py          # every place
    python3 tools/fix-piers.py --dry    # say what would change
"""
import gamedata  # phase 04b: the data files in game/data
import json, math, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'data' / 'gamedata.js'
WET = set('wd')
TAG = 'a04pier'


def load():
    src = gamedata.js_text(); i = src.index('window.GAMEDATA=')
    return src[:i], json.JSONDecoder().raw_decode(src[i + len('window.GAMEDATA='):])[0]


def save(head, D):
    gamedata.save_js(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n')


def piers_of(sc):
    """the strips of boards that run out into the water: [(cells over water, a, b, width)] in the place's metres"""
    T = sc['tiles']; H = len(T); W = len(T[0])
    at = lambda x, z: T[H - 1 - z][x] if 0 <= x < W and 0 <= z < H else None
    cells = {(x, z) for z in range(H) for x in range(W) if at(x, z) == 'b'}
    seen, out = set(), []
    for c in sorted(cells):
        if c in seen: continue
        comp, st = [c], [c]; seen.add(c)
        while st:
            x, z = st.pop()
            for q in ((x + 1, z), (x - 1, z), (x, z + 1), (x, z - 1)):
                if q in cells and q not in seen: seen.add(q); st.append(q); comp.append(q)
        if not any(at(*q) in WET for x, z in comp for q in ((x + 1, z), (x - 1, z), (x, z + 1), (x, z - 1))): continue
        # the strip's axis: the longer way of its spread (principal axis of the squares' middles)
        mx = sum(x + .5 for x, _ in comp) / len(comp); mz = sum(z + .5 for _, z in comp) / len(comp)
        sxx = sum((x + .5 - mx) ** 2 for x, _ in comp); szz = sum((z + .5 - mz) ** 2 for _, z in comp); sxz = sum((x + .5 - mx) * (z + .5 - mz) for x, z in comp)
        ang = .5 * math.atan2(2 * sxz, sxx - szz)
        for a90 in (-math.pi, -math.pi / 2, 0, math.pi / 2, math.pi):     # a strip that is nearly square to the map runs square to it
            if abs(ang - a90) < math.radians(10): ang = a90
        ux, uz = math.cos(ang), math.sin(ang); px, pz = -uz, ux
        rows = {}
        for x, z in comp:
            t = (x + .5 - mx) * ux + (z + .5 - mz) * uz; s = (x + .5 - mx) * px + (z + .5 - mz) * pz
            rows.setdefault(int(math.floor(t + .5)), []).append((x, z, s))
        def side_wet(row):
            """both sides of this row of boards are water"""
            lo = min(r[2] for r in row); hi = max(r[2] for r in row); tt = sum((r[0] + .5 - mx) * ux + (r[1] + .5 - mz) * uz for r in row) / len(row)
            def wet(s):
                x, z = mx + ux * tt + px * s, mz + uz * tt + pz * s
                return at(int(math.floor(x)), int(math.floor(z))) in WET
            return wet(lo - 1.0) and wet(hi + 1.0)
        ks = sorted(rows); over = [k for k in ks if side_wet(rows[k])]
        if not over: continue
        t0, t1 = min(over), max(over)
        land_lo = any(k < t0 for k in ks); land_hi = any(k > t1 for k in ks)
        def beyond(t):
            x, z = mx + ux * t, mz + uz * t
            return at(int(math.floor(x)), int(math.floor(z)))
        if not land_lo and not land_hi:                       # no boards on land: the bank is whichever end is dry
            land_lo = beyond(t0 - 1.2) not in WET
        if land_lo and land_hi: continue                      # boards across the water from bank to bank: a bridge, left alone
        if land_lo: ta, tb = t0 - .5 - .6, t1 + .5          # from the bank (a little onto the boards there) out to the end
        else: ta, tb = t1 + .5 + .6, t0 - .5
        lat = [r[2] for k in over for r in rows[k]]; sm = (min(lat) + max(lat)) / 2
        # its width: the squares under it over its length (a slanting strip of squares is wider than the boards were)
        L = max(1.0, t1 - t0 + 1); w = len([1 for k in over for r in rows[k]]) / L
        if abs(ux) > .2 and abs(uz) > .2: w = min(w * .62, 2.2)
        w = max(1.2, round(w - .3, 2))
        a = [round(mx + ux * ta + px * sm, 2), round(mz + uz * ta + pz * sm, 2)]; b = [round(mx + ux * tb + px * sm, 2), round(mz + uz * tb + pz * sm, 2)]
        wet_cells = [(r[0], r[1]) for k in over for r in rows[k]]
        out.append((wet_cells, a, b, w))
    return out


def main():
    dry = '--dry' in sys.argv; head, D = load(); n = 0
    for sid, sc in D['maps'].items():
        if '@' in sid or not sc.get('tiles') or sc.get('kind') == 'room': continue
        # boards left under a jetty already made (a row the first run missed) are water too
        rows = [list(r) for r in sc['tiles']]; H = len(rows); W = len(rows[0]); left = 0
        for B in sc.get('bridges') or []:
            if not B.get('pier'): continue
            ax, az = B['a']; bx, bz = B['b']; L = math.hypot(bx - ax, bz - az) or 1; ux, uz = (bx - ax) / L, (bz - az) / L
            for z in range(H):
                for x in range(W):
                    if rows[H - 1 - z][x] != 'b': continue
                    t = (x + .5 - ax) * ux + (z + .5 - az) * uz; s_ = -(x + .5 - ax) * uz + (z + .5 - az) * ux
                    if .7 < t <= L + .6 and abs(s_) <= B['w'] / 2 + .7:
                        wet = sum(1 for q in ((x + 1, z), (x - 1, z), (x, z + 1), (x, z - 1)) if 0 <= q[0] < W and 0 <= q[1] < H and rows[H - 1 - q[1]][q[0]] in WET)
                        if wet >= 1: rows[H - 1 - z][x] = 'w'; left += 1
        if left: sc['tiles'] = [''.join(r) for r in rows]; n += 1; print(f'{sid}: {left} squares of boards left under a jetty are water now')
        P = piers_of(sc)
        if not P: continue
        rows = [list(r) for r in sc['tiles']]; H = len(rows)
        for cells, a, b, w in P:
            for x, z in cells: rows[H - 1 - z][x] = 'w'
            sc.setdefault('bridges', []).append({'a': a, 'b': b, 'w': w, 'kind': 'wood', 'pier': 1, TAG: 1}); n += 1
            print(f'{sid}: a jetty from {a} out to {b}, {w} m wide, {len(cells)} squares of water under it')
        sc['tiles'] = [''.join(r) for r in rows]
    print(f'{n} changes' + (' (dry run: nothing written)' if dry else ''))
    if not dry and n: save(head, D)


if __name__ == '__main__':
    main()
