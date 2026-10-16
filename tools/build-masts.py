#!/usr/bin/env python3
"""alpha 0.4: an airship mast in every town. The mast and its moored airship (a voxel model: the lattice mast, a wooden
ship hung under a balloon, turned a little toward you, two turbines at the stern) stands on open ground near where you arrive, with room round
it for the airship to ride above the grass (no building or tall tree under it, nothing in front of a window behind
it), a few steps from a path. Towns under the ground (Fizzwell, Lanternhall, Glimmershaft) get a sky lift up to the
mooring instead. In Verdigris City the old station is the airship terminal: its ticket window inside sells the
tickets, its board is the airship timetable, and a mast stands beside it. Tap any of them to fly to a town you have
been to (game/js/airship.js). What this adds carries "a04mast": 1, so running it again first takes its own away.

    python3 tools/build-masts.py           # every town
    python3 tools/build-masts.py --dry     # say where they would go
"""
import json, math, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'data' / 'gamedata.js'
TAG = 'a04mast'
OPEN = set('gGflCMHsuyLtEBnvU')           # ground a mast may stand on: grass, meadow, flowers, lawn, clover, moss, heather, sand, dirt, cloud...
NEAR = set('pKqhcmaTe-;vb')               # paths, streets and squares (you walk up to it from one)


def load():
    src = DATA.read_text(encoding='utf-8'); i = src.index('window.GAMEDATA=')
    return src[:i], json.JSONDecoder().raw_decode(src[i + len('window.GAMEDATA='):])[0]


def save(head, D):
    DATA.write_text(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')


def footprint(p, C):
    """the box a prop takes on the ground (x0, z0, x1, z1), or a circle for a solid thing, or None"""
    M = C.get(p['k']) or {}; s = p.get('s', 1)
    if M.get('box'):
        w, d = M['box'][0] * s, M['box'][1] * s; return ('box', p['x'] - w / 2, p['z'] - .1, p['x'] + w / 2, p['z'] + d)
    r = (M.get('solid') or 0) * s
    return ('disc', p['x'], p['z'], r) if r > .05 else None


def tall(p, C):
    M = C.get(p['k']) or {}; g = M.get('group') or p['k']
    return bool(M.get('box')) or g.startswith('tree') or g.startswith('palm') or (M.get('solid') or 0) > .45 or bool(M.get('landmark'))


def place(sid, sc, C, kind, near=None, rep=None, paved=False):
    T = sc['tiles']; H = len(T); W = len(T[0]); hub = near or sc['hub']
    at = lambda x, z: T[H - 1 - int(math.floor(z))][int(math.floor(x))] if 0 <= x < W and 0 <= z < H else None
    hts = sc.get('heights')
    def hgt(x, z):
        if not hts: return 0.0
        r = hts[H - int(round(min(H, max(0, z))))]; return float(r[int(round(min(W, max(0, x))))] or 0)
    props = sc['props']; boxes = [(p, footprint(p, C)) for p in props]; exits = sc.get('exits') or []
    big = kind == 'airship_mast'; bw, bd = (1.8, 1.8) if big else (2.0, 1.4)
    floor = set(OPEN)
    if not big or paved:                                             # under the ground (or a city all paved): any dry floor that isn't a path
        floor |= {ch for row in T for ch in set(row)} - set('wdpr')
    # the opening is filmed east of the lab's door: nothing goes on that stage
    stage = []
    for p in props:
        if p.get('act') == 'lab':
            M = C.get(p['k']) or {}; dx = ((M.get('door') or {}).get('x') or 0) / 34 * p.get('s', 1) * (-1 if p.get('f') else 1)
            stage.append((p['x'] + dx - 3, p['z'] - 9, p['x'] + dx + 12, p['z'] + 1))
    found = []
    for r10 in range(60, 360, 5):
        rr = r10 / 10
        for a in range(0, 360, 8):
            cx = hub[0] + math.cos(math.radians(a)) * rr; cz = hub[1] + math.sin(math.radians(a)) * rr * .9
            if not (6 < cx < W - (10 if big else 4) and (8 if big else 5) < cz < H - 4): continue
            x0, z0, x1, z1 = cx - bw / 2 - .4, cz - .5, cx + bw / 2 + .4, cz + bd + .4
            if any(at(x, z) not in floor for x in (x0, cx, x1) for z in (z0, (z0 + z1) / 2, z1)): continue
            if any(a0 - 1 < cx < a1 + (9 if big else 1) and b0 < cz < b1 for a0, b0, a1, b1 in stage): continue
            if any(math.hypot(e[0] - cx, e[1] - cz) < 8 for e in exits): continue
            hs = [hgt(x, z) for x in (x0, x1) for z in (z0, z1)]
            if max(hs) - min(hs) > .35: continue
            if at(cx, cz - 1.0) in (None, 'w', 'd'): continue
            if big and not paved and not any(at(cx + dx, cz - 1.2 + dz) in NEAR for dx in (-2.5, -1, 0, 1, 2.5) for dz in (-2.5, -1.2, 0)): continue
            bad = False
            for p, f in boxes:
                if not f: continue
                if f[0] == 'box':
                    _, a0, b0, a1, b1 = f
                    if a0 < x1 + .3 and a1 > x0 - .3 and b0 < z1 + .3 and b1 > z0 - .8: bad = True; break
                    # the airship rides out to the right above the ground, its stern turned toward you: no building under it or close behind it
                    if big and a0 < cx + 7.8 and a1 > cx - 1.4 and b0 < cz + 9 and b1 > cz - 5.4: bad = True; break
                else:
                    _, px, pz, pr = f
                    if math.hypot(px - cx, pz - (cz + bd / 2)) < pr + 1.5: bad = True; break
                    if big and tall(p, C) and cx - 1.4 < px < cx + 7.8 and cz - 5.4 < pz < cz + 2.6: bad = True; break
            if bad: continue
            score = rr + (0 if any(at(cx + dx, cz - 1.2) in NEAR for dx in (-1, 0, 1)) else 4)
            found.append((score, round(cx, 2), round(cz, 2)))
    return sorted(found)


def main():
    global CW, PPU
    import importlib.util as ilu
    sp = ilu.spec_from_file_location('clearwin', ROOT / 'tools' / 'clear-windows.py'); CW = ilu.module_from_spec(sp); sp.loader.exec_module(CW)
    dry = '--dry' in sys.argv; head, D = load(); C = D['scenery']['props']; rep = []; PPU = CW.ppu(D)
    for r in D['route']:
        if r.get('kind') != 'town' or not r.get('scene'): continue
        sid = r['scene']; sc = D['scenes'][sid]
        sc['props'] = [p for p in sc['props'] if not p.get(TAG)]
        under = bool(sc.get('indoor') or sc.get('under')); kind = 'sky_lift' if under else 'airship_mast'
        near = None
        if sid == 'city':
            st = next((p for p in sc['props'] if p['k'] == 'station'), None)
            if st:
                st['label'] = 'Airship terminal'; near = [st['x'] + 6, st['z'] - 3]
        spots = place(sid, sc, C, kind, near, rep) or place(sid, sc, C, kind, near, rep, paved=True)
        done = False
        for _, x, z in spots[:60]:
            p = {'k': kind, 'x': x, 'z': z, 'act': 'fly', 'label': 'Sky lift to the airships' if under else 'Airship mast', TAG: 1}
            sc['props'].append(p); n = len(sc['props']) - 1
            if any(o[1] == n for o in CW.occluders(sc, C, PPU, CW.windows_of(sc, C, PPU))): sc['props'].pop(); continue     # it would stand in front of a window
            rep.append(f'{sid}: {kind} at {x}, {z} ({math.hypot(x - sc["hub"][0], z - sc["hub"][1]):.0f} m from where you arrive)'); done = True; break
        if not done: rep.append(f'!! {sid}: no room for a {kind}')
    # Verdigris City's terminal: the ticket window sells airship tickets, the board is the timetable
    st = D['scenes'].get('int_station')
    if st:
        st['name'] = 'Inside the airship terminal'
        st['chat'] = ['The airships leave when they’re full. Or when the wind is right. Whichever is later.', 'Window seat? Every seat is a window seat on an airship.',
                      'Mind the gangplank. And the Billies.']
        for p in st['props']:
            if p['k'] == 'ticket_window': p['act'] = 'fly'; p['label'] = 'Airship tickets'
            if p['k'] == 'timetable_board': p['book'] = 'airships'
        books = D.setdefault('lore', {}).setdefault('books', {})
        if 'airships' not in books:
            books['airships'] = {'title': 'Airship timetable', 'by': 'Verdigris Air & Mooring Co.',
                                 'pages': ['Airships leave from every mast for every town you have been to. Your ticket is good for one flight; your steps are good for everything else.',
                                           'Fares go by distance across the world, not by height. The Inner Sun is not a destination. Please stop asking.',
                                           'Lost property is returned at the next mast. The company is not responsible for Billies that board without a ticket.']}
        rep.append('Verdigris City: the station is the airship terminal (its ticket window sells tickets, its board is the timetable)')
    print('\n'.join(rep))
    if not dry: save(head, D); print('saved')


if __name__ == '__main__':
    main()
