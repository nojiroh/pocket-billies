#!/usr/bin/env python3
"""v46: every place, scene and road says plainly what it is.

Places (the `route` list, in its order: saves point into it by position, so the order never changes) get
  id        the place's scene id (stable, used by roads and scenes)
  kind      'town' or 'route'
  biome     what the old `t` field meant (grass, golf, food, island...); `t` stays for old code
  routeName on routes only: 'Route 1', 'Sea Route 1'...
Scenes get
  kind      'town' | 'route' | 'room' | 'test'
  place     the place they belong to (a room: the town it was made for, or None for the shared rooms)
  building  on rooms: the kind of building they are the inside of (shop, clinic, lab, house, home)
Roads were given their id and name here too (v46); every road has them now, so phase 08b took that part out and
--check only reports a road without an id or with a place that doesn't exist.

    python3 tools/migrate-places.py           # fills what is missing; never changes a value that is already set
    python3 tools/migrate-places.py --check   # only reports what is missing or inconsistent
"""
import gamedata  # phase 04b: the data files in game/data
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'data' / 'gamedata.js'


def load():
    src = gamedata.js_text(); i = src.index('window.GAMEDATA=')
    return src[:i], json.JSONDecoder().raw_decode(src[i + len('window.GAMEDATA='):])[0]


def problems(D):
    out = []; places = D['locations']; ids = {p.get('id') for p in places}
    for n, p in enumerate(places):
        if p.get('kind') not in ('town', 'route'): out.append(f'place {n} ({p.get("name")}): no kind')
        if p.get('id') != p.get('mapId'): out.append(f'place {n} ({p.get("name")}): id {p.get("id")} is not its scene {p.get("mapId")}')
        if p.get('kind') == 'town' and not p.get('town'): out.append(f'{p.get("name")}: kind town but not marked town')
        if p.get('kind') == 'route' and p.get('town'): out.append(f'{p.get("name")}: kind route but marked town')
    for sid, sc in D['maps'].items():
        k = sc.get('kind')
        if k not in ('town', 'route', 'room', 'test'): out.append(f'scene {sid}: no kind'); continue
        if k in ('town', 'route'):
            # RL-5: a town or route scene that no place uses is a scene of its own (one copied from the parked world in
            # the Studio's Legacy section, or made by Generate), until a place uses it
            pl = next((p for p in places if p.get('mapId') == sid), None)
            if pl and pl.get('kind') != k: out.append(f'scene {sid}: kind {k} but its place is a {pl.get("kind")}')
        if k == 'room' and not sc.get('building'): out.append(f'scene {sid}: a room without a building')
    for i, L in enumerate(D['roads']):
        r = gamedata.road(D, L)
        if not r['id'] or not all(isinstance(r[e], int) and 0 <= r[e] < len(places) for e in 'ab'): out.append(f'road {i}: not named or its places unknown')
    return out


def main():
    head, D = load()
    if '--check' in sys.argv:
        p = problems(D); print('\n'.join(p) or 'places, scenes and roads all say what they are'); sys.exit(1 if p else 0)
    places, n = D['locations'], 0
    for p in places:
        for k, v in (('id', p.get('mapId')), ('kind', 'town' if p.get('town') else 'route'), ('biome', p.get('t'))):
            if p.get(k) is None and v is not None: p[k] = v; n += 1
        if p['kind'] == 'route' and not p.get('routeName') and p.get('route'): p['routeName'] = p['route']; n += 1
    by_scene = {p['mapId']: p for p in places}
    for sid, sc in D['maps'].items():
        if sc.get('kind'): continue
        if sc.get('test') or sid.startswith('test_'): sc['kind'] = 'test'
        elif sc.get('room') or sid.startswith('int_'): sc['kind'] = 'room'; sc.setdefault('building', sc.get('room')); sc.setdefault('locationId', None)
        elif sid in by_scene: sc['kind'] = by_scene[sid]['kind']; sc['locationId'] = sid
        else: print(f'  {sid}: no place uses it; left without a kind'); continue
        n += 1
    gamedata.save_js(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n')
    p = problems(D)
    print(f'{n} fields filled; ' + ('all consistent' if not p else f'{len(p)} problems:\n  ' + '\n  '.join(p)))


if __name__ == '__main__':
    main()
