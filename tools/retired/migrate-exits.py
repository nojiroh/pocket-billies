#!/usr/bin/env python3
"""v42: exits become edge-relative and roads say which exit they use.

Until now a scene's exits were absolute points ([x, z] in metres) and the game matched roads to exits by compass
bearing on the world map. This pass keeps every exit exactly where it is and adds, for each scene:

    edgeExits: [{id: 'east', side: 'E', t: 0.544, in: 1.1, width: 2}, ...]

(side N/S/E/W, t = how far along that side from the left or the bottom, in = metres in from the edge, width = how
wide the opening is), and for each road in links a fourth entry naming the exit at each end:

    [a, b, steps, {a: 'east', b: 'south'}]

The ids are named by side (north, south, east, west; north2 when a side has two). The join table is filled from
the same bearing match the game used, so every road leaves through the exit it always did; the game recomputes
sc.exits from edgeExits, and the quick check compares the two matchings on every stop.

    python3 tools/migrate-exits.py          # write
    python3 tools/migrate-exits.py --dry    # report only"""
import sys, json, math
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'data' / 'gamedata.js'
NAMES = dict(N='north', S='south', E='east', W='west')


def load():
    src = DATA.read_text(encoding='utf-8'); i = src.index('window.GAMEDATA='); head = src[:i]
    return head, json.JSONDecoder().raw_decode(src[i + len('window.GAMEDATA='):])[0]


def save(head, D):
    DATA.write_text(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')


def edge_of(sc, p, old=None):
    w, h = sc['w'], sc['h']; x, z = p
    d = dict(W=x, E=w - x, S=z, N=h - z); side = min(d, key=d.get)
    t = x / w if side in 'NS' else z / h
    e = dict(old or {}); e.update(side=side, t=round(t, 4), **{'in': round(d[side], 2)}); e.setdefault('width', 2)
    return e


def point_of(sc, e):
    w, h = sc['w'], sc['h']; n = e.get('in', 1.1); r = lambda v: round(v * 100) / 100
    return [r(e['t'] * w), r(h - n)] if e['side'] == 'N' else [r(e['t'] * w), r(n)] if e['side'] == 'S' else [r(w - n), r(e['t'] * h)] if e['side'] == 'E' else [r(n), r(e['t'] * h)]


def hub_of(sc):
    return sc.get('hub') or [sc['w'] / 2, sc['h'] / 2]


def exits_by_bearing(D, node, ADJ):
    """port of sceneExits() in game/js/ui.js (v10-v41): road -> exit index by compass direction"""
    ROUTE = D['route']; r = ROUTE[node]; sid = r.get('scene'); sc = D['scenes'].get(sid) if sid else None
    ex = (sc or {}).get('exits') or []; out = {}
    if not sc or not ex: return out
    hub = hub_of(sc); me = r; pairs = []
    for e in ADJ[node]:
        o = ROUTE[e['to']]; a = math.atan2((o.get('lat') or 0) - (me.get('lat') or 0), (o.get('lon') or 0) - (me.get('lon') or 0))
        for k, p in enumerate(ex):
            d = abs(a - math.atan2(p[1] - hub[1], p[0] - hub[0])) % (2 * math.pi)
            if d > math.pi: d = 2 * math.pi - d
            pairs.append((d, e['to'], k))
    pairs.sort(key=lambda q: q[0]); taken = set()
    for (_, to, k) in pairs:
        if to in out or k in taken: continue
        out[to] = k; taken.add(k)
    for (_, to, k) in pairs:
        if to not in out: out[to] = k
    return out


def main():
    dry = '--dry' in sys.argv
    head, D = load(); n_sc = 0; n_ex = 0
    for sid, sc in D['scenes'].items():
        ex = sc.get('exits') or []
        if not ex: continue
        old = sc.get('edgeExits') or []
        E = [edge_of(sc, p, old[k] if k < len(old) else None) for k, p in enumerate(ex)]
        # ids: by side, west to east / bottom to top, a number when a side has more than one
        seen = {}
        for e in sorted(E, key=lambda e: (e['side'], e['t'])):
            if e.get('id'): seen[e['id']] = 1
        for e in sorted(E, key=lambda e: (e['side'], e['t'])):
            if e.get('id'): continue
            base = NAMES[e['side']]; nm = base; i = 2
            while nm in seen: nm = base + str(i); i += 1
            e['id'] = nm; seen[nm] = 1
        for k, e in enumerate(E):
            q = point_of(sc, e)
            if abs(q[0] - ex[k][0]) > .011 or abs(q[1] - ex[k][1]) > .011: raise SystemExit(f'{sid}: exit {k} would move from {ex[k]} to {q}')
        sc['edgeExits'] = E; n_sc += 1; n_ex += len(E)
    # the join table from the bearing match
    ROUTE = D['route']; LINKS = D['links']; ADJ = [[] for _ in ROUTE]
    for i, L in enumerate(LINKS):
        a, b, c = L[0], L[1], L[2]; ADJ[a].append(dict(to=b, cost=c, i=i)); ADJ[b].append(dict(to=a, cost=c, i=i))
    match = {n: exits_by_bearing(D, n, ADJ) for n in range(len(ROUTE))}
    n_j = 0
    for i, L in enumerate(LINKS):
        a, b = L[0], L[1]; J = L[3] if len(L) > 3 and isinstance(L[3], dict) else {}
        for end, node in (('a', a), ('b', b)):
            if J.get(end): continue
            k = match[node].get(b if end == 'a' else a); sc = D['scenes'].get(ROUTE[node].get('scene') or '')
            if k is None or not sc or k >= len(sc.get('edgeExits') or []): continue
            J[end] = sc['edgeExits'][k]['id']; n_j += 1
        if J:
            if len(L) > 3: L[3] = J
            else: L.append(J)
    for i, L in enumerate(LINKS):
        J = L[3] if len(L) > 3 else {}
        print(f"  {ROUTE[L[0]]['name']} ({J.get('a', '-')}) <-> {ROUTE[L[1]]['name']} ({J.get('b', '-')}) {L[2]} steps")
    print(f'{n_sc} scenes, {n_ex} exits made edge-relative; {n_j} road ends joined to a named exit')
    if not dry: save(head, D); print('game data written')


if __name__ == '__main__':
    main()
