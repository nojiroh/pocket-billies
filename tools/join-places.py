#!/usr/bin/env python3
"""alpha 0.2: places joined edge to edge. Two linked places meet at their exits: one place's exit edge is the next one's
entrance, with nothing in between, so the two exits of a link must face each other (east to west, or north to south).

    python3 tools/join-places.py            # move the exits that don't face their partner, then set every road's steps
    python3 tools/join-places.py --costs    # only measure the paths again and set the steps (after editing a place)
    python3 tools/join-places.py --dry      # say what would change, change nothing

1. Exits. Where a link's two exits are at right angles (19 of 54 in alpha 0.1), one of them moves to the side facing
   the other: a route's exit rather than a town's, onto the side that agrees with the world map. Its new spot is the
   one along that side with the shortest walk from the place's hub (away from corners and other exits), and a path is
   laid to it along the way the game itself would walk (dioFind, in a headless browser), in the ground the place's
   other paths use. Small plants on it are taken away. The old path stays as a trail.
2. Room on a side. Where one side of a place has two exits (the place and two neighbours that are neighbours of each
   other too), they sit at least SEP metres apart, so that each neighbour has its own stretch of the edge to meet the
   place on: the pair is moved apart along the side as little as it takes, by the shortest walks from the hub, keeping
   their order, and paths are laid to their new spots as for a moved exit.
3. Doorways. Nothing solid may stand across an exit: a fence, hedge, rock or lamp in the last couple of metres before
   the edge, within a metre of the exit, is taken away (a building or anything you can use there is only reported).
4. Steps. Every exit gets the walk from its place's hub to it, its length (edgeExits[k].len, metres) and its line
   (edgeExits[k].path, the corners of the walk, which a trip follows). A road's steps are the two walks it joins (hub to
   exit, then the next place's entrance to its hub) at one rate for the whole world, chosen so that the shortest way
   from Sundown to the Inner Sun costs what it did (51,600 steps). So a long route costs more than a short one, and
   passing through a place costs the walk across it.
Needs Playwright (python3 -m pip install playwright) and the Chromium it uses, like tools/check-quick.py."""
import importlib.util, json, math, sys, heapq, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'data' / 'gamedata.js'
OPP = {'E': 'W', 'W': 'E', 'N': 'S', 'S': 'N'}
TOTAL = 51600          # steps from Sundown to the Inner Sun, as before
SEP = 44               # metres between two exits on one side (each neighbour gets ±22 m of the edge to itself)
ARGS = sys.argv[1:]


def load():
    src = DATA.read_text(encoding='utf-8'); head, body = src.split('window.GAMEDATA=', 1)
    return head, json.loads(body.rstrip().rstrip(';'))


def save(head, D):
    DATA.write_text(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')


def exit_side(D, node, eid):
    for e in D['scenes'][D['route'][node]['scene']].get('edgeExits') or []:
        if e['id'] == eid: return e['side']


def bearing(D, a, b):
    R = D['route']; dx, dy = R[b]['lon'] - R[a]['lon'], R[b]['lat'] - R[a]['lat']
    dx = (dx + 180) % 360 - 180
    return ('E' if dx > 0 else 'W') if abs(dx) > abs(dy) else ('N' if dy > 0 else 'S')


def plan_moves(D):
    """for each link at right angles, which end moves where: a route's end over a town's (5 to 1), the map's direction
    (half a point), and two links on one side of a place cost a little (0.7), over every combination"""
    import itertools
    R, L = D['route'], D['links']; cur = {}
    for i, l in enumerate(L):
        J = l[3] or {}; cur[(l[0], i)] = exit_side(D, l[0], J.get('a')); cur[(l[1], i)] = exit_side(D, l[1], J.get('b'))
    perp = [i for i, l in enumerate(L) if cur[(l[0], i)] and cur[(l[1], i)] and OPP[cur[(l[0], i)]] != cur[(l[1], i)]]
    if not perp: return []
    best = None
    for choice in itertools.product((0, 1), repeat=len(perp)):
        sides = dict(cur); c = 0
        for i, ch in zip(perp, choice):
            a, b = L[i][0], L[i][1]
            if ch == 0: sides[(a, i)] = OPP[sides[(b, i)]]; mv = a
            else: sides[(b, i)] = OPP[sides[(a, i)]]; mv = b
            c += 5 if R[mv]['kind'] == 'town' else 1
            if sides[(a, i)] != bearing(D, a, b): c += .5
        per = {}
        for (n, i), s in sides.items(): per.setdefault((n, s), []).append(i)
        c += .7 * sum(len(v) - 1 for v in per.values() if len(v) > 1)
        if best is None or c < best[0]: best = (c, choice, sides)
    out = []
    for i, ch in zip(perp, best[1]):
        a, b = L[i][0], L[i][1]; mv = a if ch == 0 else b; J = L[i][3]
        out.append({'link': i, 'node': mv, 'scene': R[mv]['scene'], 'exit': J['a'] if ch == 0 else J['b'], 'from': cur[(mv, i)], 'to': best[2][(mv, i)]})
    return out


# ---------------------------------------------------------------- the game in a browser, for its own walking rules
def browser():
    spec = importlib.util.spec_from_file_location('cq', ROOT / 'tools' / 'check-quick.py'); cq = importlib.util.module_from_spec(spec); spec.loader.exec_module(cq)
    from playwright.sync_api import sync_playwright
    srv, base = cq.serve(ROOT / 'game')
    pw = sync_playwright().start(); b = pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    errs = []; ctx, pg = cq.open_game(b, base, 800, 600, False, errs)
    cq.play(pg); time.sleep(1)
    def close(): b.close(); pw.stop(); srv.shutdown()
    return pg, close


FIND = """([id,ax,az,bx,bz])=>{const sc=dioScene(id);const keep=[DIO.sc,DIO.nav,DIO.gkey];DIO.sc=sc;DIO.nav=null;DIO.gkey='join-'+id;
 const q=dioFind(ax,az,bx,bz)||null;[DIO.sc,DIO.nav,DIO.gkey]=keep;return q}"""
HUB = "(id)=>{const sc=dioScene(id);return dioHubOf(sc)}"


def plen(q):
    return sum(math.hypot(q[i + 1][0] - q[i][0], q[i + 1][1] - q[i][1]) for i in range(len(q) - 1)) if q and len(q) > 1 else 0


def exit_point(sc, e):
    w, h, n = sc['w'], sc['h'], e.get('in', 1.1)
    return {'N': (e['t'] * w, h - n), 'S': (e['t'] * w, n), 'E': (w - n, e['t'] * h), 'W': (n, e['t'] * h)}[e['side']]


def lay_path(D, sid, q, side):
    """paint the path along polyline q in the ground the place's paths use, out to the edge, and take small plants off it"""
    sc = D['scenes'][sid]; C = D['scenery']['props']; T = D['scenery']['terrains']; w, h = sc['w'], sc['h']
    rows = [list(r) for r in sc['tiles']]
    # the ground the other exits' paths are made of
    cnt = {}
    for e in sc.get('edgeExits') or []:
        x, z = exit_point(sc, e); ch = rows[h - 1 - min(h - 1, int(z))][min(w - 1, int(x))]
        if T.get(ch, {}).get('paved') or ch in 'pPc': cnt[ch] = cnt.get(ch, 0) + 1
    pch = max(cnt, key=cnt.get) if cnt else 'p'
    end = q[-1]; edge = {'N': (end[0], h), 'S': (end[0], 0), 'E': (w, end[1]), 'W': (0, end[1])}[side]
    pts = list(q) + [list(edge)]
    boxes = [(p['x'] - C[p['k']]['box'][0] * (p.get('s') or 1) / 2 - .3, p['z'] - .4, p['x'] + C[p['k']]['box'][0] * (p.get('s') or 1) / 2 + .3, p['z'] + C[p['k']]['box'][1] * (p.get('s') or 1) + .3)
             for p in sc['props'] if C.get(p['k'], {}).get('box')]
    painted = 0
    for a, b in zip(pts, pts[1:]):
        n = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / .25))
        for k in range(n + 1):
            x, z = a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n
            for tz in range(int(z - 1.6), int(z + 1.6) + 1):
                for tx in range(int(x - 1.6), int(x + 1.6) + 1):
                    if not (0 <= tx < w and 0 <= tz < h): continue
                    if math.hypot(tx + .5 - x, tz + .5 - z) > 1.05: continue
                    j = h - 1 - tz; ch = rows[j][tx]
                    if ch in 'wd' or ch == pch or T.get(ch, {}).get('paved'): continue
                    if any(b0 <= tx + .5 <= b2 and b1 <= tz + .5 <= b3 for b0, b1, b2, b3 in boxes): continue
                    rows[j][tx] = pch; painted += 1
    sc['tiles'] = [''.join(r) for r in rows]
    def near(p):
        best = 9
        for a, b in zip(pts, pts[1:]):
            vx, vz = b[0] - a[0], b[1] - a[1]; l2 = vx * vx + vz * vz or 1e-9; t = max(0, min(1, ((p['x'] - a[0]) * vx + (p['z'] - a[1]) * vz) / l2))
            best = min(best, math.hypot(a[0] + vx * t - p['x'], a[1] + vz * t - p['z']))
        return best
    before = len(sc['props'])
    sc['props'] = [p for p in sc['props'] if not ((p.get('w') in (42, 43) or not (C.get(p['k'], {}).get('box') or C.get(p['k'], {}).get('solid'))) and not p.get('act') and near(p) < 1.1)]
    return pch, painted, before - len(sc['props'])


def move_exits(D, pg, moves, dry):
    report = []
    for m in moves:
        sid = m['scene']; sc = D['scenes'][sid]; E = sc['edgeExits']; k = next(i for i, e in enumerate(E) if e['id'] == m['exit'])
        hub = pg.evaluate(HUB, sid); side = m['to']; L = sc['w'] if side in 'NS' else sc['h']
        others = [exit_point(sc, e) for j, e in enumerate(E) if j != k and e['side'] == side]
        best = None
        for t10 in range(12, 89, 3):
            t = t10 / 100; e2 = dict(E[k], side=side, t=t, **{'in': 1.1}); p = exit_point(sc, e2)
            if any(math.hypot(p[0] - o[0], p[1] - o[1]) < 10 for o in others): continue
            q = pg.evaluate(FIND, [sid, hub[0], hub[1], p[0], p[1]])
            if not q or math.hypot(q[-1][0] - p[0], q[-1][1] - p[1]) > 1.6: continue
            sc_ = plen(q) + 18 * abs(t - .5)
            if best is None or sc_ < best[0]: best = (sc_, t, q)
        if not best:
            report.append(f"!! {sid}: no way from the hub to its {side} side; exit {m['exit']} stays {m['from']}"); continue
        _, t, q = best
        if not dry:
            pch, painted, gone = lay_path(D, sid, q, side)
            E[k] = dict(E[k], side=side, t=round(t, 4), **{'in': 1.1})
            sc.pop('_exk', None); sc['exits'] = [[round(v, 2) for v in exit_point(sc, e)] for e in E]
            report.append(f"{sid}: exit {m['exit']} {m['from']} → {side} at {t:.2f} (link {m['link']}), a {plen(q):.0f} m path of '{pch}' ({painted} squares), {gone} plants taken off it")
        else:
            report.append(f"{sid}: exit {m['exit']} would move {m['from']} → {side} at {t:.2f}, {plen(q):.0f} m from the hub")
    return report


def spread_exits(D, pg, dry):
    """move two exits on one side apart (SEP), as little as it takes and by the shortest walks from the hub"""
    report = []
    for r in D['route']:
        sid = r.get('scene'); sc = D['scenes'].get(sid) if sid else None
        if not sc or not sc.get('edgeExits'): continue
        E = sc['edgeExits']; by = {}
        for k, e in enumerate(E): by.setdefault(e['side'], []).append(k)
        for side, ks in by.items():
            if len(ks) != 2: continue
            span = sc['w'] if side in 'NS' else sc['h']; al = lambda p: p[0] if side in 'NS' else p[1]
            x0 = [al(exit_point(sc, E[k])) for k in ks]
            if abs(x0[0] - x0[1]) >= SEP: continue
            hub = pg.evaluate(HUB, sid); lens = {}
            ts = [i / 100 for i in range(10, 91, 2)]
            for k in ks:
                for tt in ts:
                    p = exit_point(sc, dict(E[k], t=tt, **{'in': 1.1})); q = pg.evaluate(FIND, [sid, hub[0], hub[1], p[0], p[1]])
                    lens[(k, tt)] = (plen(q), q) if q and math.hypot(q[-1][0] - p[0], q[-1][1] - p[1]) <= 1.6 else None
            order = x0[0] < x0[1]; best = None
            for t1 in ts:
                for t2 in ts:
                    a, b = lens[(ks[0], t1)], lens[(ks[1], t2)]
                    if not a or not b: continue
                    p1, p2 = t1 * span, t2 * span
                    if (p1 < p2) != order: continue
                    gap = abs(p1 - p2); c = a[0] + b[0] + .6 * (abs(p1 - x0[0]) + abs(p2 - x0[1])) + (400 + 10 * (SEP - gap) if gap < SEP else 0)
                    if best is None or c < best[0]: best = (c, t1, t2, a[1], b[1], gap)
            if not best: report.append(f"!! {sid}: no room to move its {side} exits apart"); continue
            _, t1, t2, q1, q2, gap = best
            for k, tt, q in ((ks[0], t1, q1), (ks[1], t2, q2)):
                was = al(exit_point(sc, E[k])); now = tt * span
                if abs(now - was) < 1.5: continue
                if dry: report.append(f"{sid}: exit {E[k]['id']} would move along {side} {was:.0f} → {now:.0f} m"); continue
                pch, painted, gone = lay_path(D, sid, q, side)
                E[k] = dict(E[k], t=round(tt, 4), **{'in': 1.1}); E[k].pop('path', None); E[k].pop('len', None)
                report.append(f"{sid}: exit {E[k]['id']} moved along {side} {was:.0f} → {now:.0f} m (now {gap:.0f} m from the other), a {plen(q):.0f} m path of '{pch}'")
            if not dry: sc['exits'] = [[round(v, 2) for v in exit_point(sc, e)] for e in E]
    return report


LENS = """(ids)=>{const out={};for(const id of ids){const sc=dioScene(id);if(!sc)continue;const keep=[DIO.sc,DIO.nav,DIO.gkey];DIO.sc=sc;DIO.nav=null;DIO.gkey='len-'+id;const hub=dioHubOf(sc);
 out[id]=(sc.edgeExits||[]).map((e,k)=>{const p=sc.exits[k];const q=dioFind(hub[0],hub[1],p[0],p[1],{max:600000});if(!q)return null;let l=0;for(let i=1;i<q.length;i++)l+=Math.hypot(q[i][0]-q[i-1][0],q[i][1]-q[i-1][1]);
  const e2=q[q.length-1];return Math.hypot(e2[0]-p[0],e2[1]-p[1])>1.6?null:{len:+l.toFixed(1),path:q.map(([x,z])=>[+x.toFixed(2),+z.toFixed(2)])}});[DIO.sc,DIO.nav,DIO.gkey]=keep}return out}"""


SOLID_KEEP = ('build', 'door')


def clear_paths(D):
    """wild growth (w 42 or 43) never stands on a path or paving: a path laid since takes it away"""
    T = D['scenery']['terrains']; out = []
    for r in D['route']:
        sid = r.get('scene'); sc = D['scenes'].get(sid) if sid else None
        if not sc: continue
        keep = []
        for p in sc.get('props') or []:
            if p.get('w') in (42, 43):
                j, i = sc['h'] - 1 - int(math.floor(p['z'])), int(math.floor(p['x']))
                ch = sc['tiles'][j][i] if 0 <= j < sc['h'] and 0 <= i < sc['w'] else ''
                if ch and (ch in 'pcmbaqheo' or (T.get(ch) or {}).get('paved')): out.append(f"{sid}: {p['k']} taken off the path at ({p['x']}, {p['z']})"); continue
            keep.append(p)
        sc['props'] = keep
    return out


def open_doors(D):
    """take away what stands across an exit: anything solid within a metre of it, in the last 2.6 m before the edge
    (fences, hedges, rocks, lamps); a building or a thing you can use is left and reported"""
    C = D['scenery']['props']; out = []
    for r in D['route']:
        sid = r.get('scene'); sc = D['scenes'].get(sid) if sid else None
        if not sc or not sc.get('edgeExits'): continue
        w, h = sc['w'], sc['h']
        for e in sc['edgeExits']:
            x, z = exit_point(sc, e); s = e['side']; hw = (e.get('width') or 2) / 2 + .1
            # the doorway: along the edge within hw of the exit, from 2.6 m inside to the edge
            box = {'N': (x - hw, h - 2.6, x + hw, h), 'S': (x - hw, 0, x + hw, 2.6), 'E': (w - 2.6, z - hw, w, z + hw), 'W': (0, z - hw, 2.6, z + hw)}[s]
            keep = []
            for p in sc['props']:
                M = C.get(p['k']) or {}; sc_ = p.get('s') or 1
                if M.get('flat') or M.get('walk'): keep.append(p); continue
                if M.get('box'): f = (p['x'] - M['box'][0] * sc_ / 2, p['z'] - .1, p['x'] + M['box'][0] * sc_ / 2, p['z'] + M['box'][1] * sc_)
                else:
                    rr = M['solid'] * sc_ if M.get('solid') is not None else (M.get('shadow') or 0) * .42 * sc_
                    if rr <= .05: keep.append(p); continue
                    f = (p['x'] - rr, p['z'] + rr * .2 - rr, p['x'] + rr, p['z'] + rr * .2 + rr)
                hit = min(f[2], box[2]) - max(f[0], box[0]) > .05 and min(f[3], box[3]) - max(f[1], box[1]) > .05
                if not hit: keep.append(p); continue
                if any(M.get(k) for k in SOLID_KEEP) or p.get('act'):
                    out.append(f"!! {sid}: {p['k']} at ({p['x']}, {p['z']}) stands in exit {e['id']}"); keep.append(p); continue
                out.append(f"{sid}: {p['k']} at ({p['x']}, {p['z']}) taken out of exit {e['id']}")
            sc['props'] = keep
    return out


def set_costs(D, lens):
    """steps per road from the walks it joins, at one rate that keeps Sundown to the Inner Sun at TOTAL"""
    R, L = D['route'], D['links']; bad = []
    for sid, ls in lens.items():
        for e, l in zip(D['scenes'][sid].get('edgeExits') or [], ls):
            if l is None: bad.append(f"{sid}:{e['id']}"); continue
            e['len'] = l['len']; e['path'] = l['path']
    def elen(node, eid):
        for e in D['scenes'][R[node]['scene']].get('edgeExits') or []:
            if e['id'] == eid: return e.get('len')
    metres = []
    for i, l in enumerate(L):
        J = l[3] or {}; a, b = elen(l[0], J.get('a')), elen(l[1], J.get('b'))
        metres.append((a or 40) + (b or 40))
    start = next(i for i, r in enumerate(R) if r['scene'] == 'sundown'); goal = next(i for i, r in enumerate(R) if r['scene'] == 'innersun')
    adj = {}
    for i, l in enumerate(L): adj.setdefault(l[0], []).append((l[1], i)); adj.setdefault(l[1], []).append((l[0], i))
    dist = {start: 0}; h = [(0, start)]
    while h:
        d, n = heapq.heappop(h)
        if d > dist.get(n, 1e18): continue
        for m, i in adj.get(n, []):
            nd = d + metres[i]
            if nd < dist.get(m, 1e18): dist[m] = nd; heapq.heappush(h, (nd, m))
    rate = TOTAL / dist[goal]
    old = [l[2] for l in L]
    for i, l in enumerate(L): l[2] = int(round(metres[i] * rate / 10) * 10)
    return rate, dist[goal], old, bad


def main():
    dry = '--dry' in ARGS; head, D = load()
    moves = [] if '--costs' in ARGS else plan_moves(D)
    out = open_doors(D) + clear_paths(D)
    if out and not dry: save(head, D)          # the game measures the walks with the doorways open
    pg, close = browser()
    try:
        if moves:
            out += move_exits(D, pg, moves, dry)
            if not dry:
                save(head, D); close(); pg, close = browser()   # the moved exits and their paths, as the game will load them
        if '--costs' not in ARGS:
            sp = spread_exits(D, pg, dry); out += sp
            if sp and not dry:
                out += open_doors(D) + clear_paths(D); save(head, D); close(); pg, close = browser()
        lens = pg.evaluate(LENS, [r['scene'] for r in D['route'] if r.get('scene')])
        rate, metres, old, bad = set_costs(D, lens)
        out.append(f"{rate:.1f} steps a metre: Sundown to the Inner Sun is {metres:.0f} m of walking, {TOTAL} steps")
        out.append('roads: ' + ', '.join(f"{o}→{l[2]}" for o, l in zip(old, D['links'])))
        if bad: out.append('!! exits the hub can\'t reach: ' + ', '.join(bad))
        if not dry: save(head, D)
        print('\n'.join(out))
    finally:
        close()


if __name__ == '__main__':
    main()
