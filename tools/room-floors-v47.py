#!/usr/bin/env python3
"""v47: every room gets a floor of its own, from the indoor floors (tools/build-terrain-v47.py): five drawn for part 1
(red and blue carpet, parquet, green and terracotta tiles) and twelve more, so no two rooms share a floor.
Only the floor changes: the room's old floor letter becomes the new one in its tiles and as its edge; the doormat at
the door, the walls, the furniture and everything else stay as they are. A room marked "keep" is left alone, and so
is a room whose floor you've changed in the Studio (its edge isn't the floor it was built with).

    python3 tools/room-floors-v47.py          # lay the floors
    python3 tools/room-floors-v47.py --dry    # say what would change
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'data' / 'gamedata.js'
# room: (the floor it was built with, its own floor)
FLOORS = {
    'int_shop': ('b', 'O'),           # checked vinyl
    'int_clinic': ('m', '9'),         # green floor tiles
    'int_lab': ('m', 'Q'),            # the lab's resin floor
    'int_house': ('b', '8'),          # parquet
    'int_home': ('b', '7'),           # blue carpet, your room
    'int_bakery': ('K', '0'),         # terracotta tiles
    'int_inn': ('b', '!'),            # dark oak boards
    'int_bank': ('T', '#'),           # marble checks
    'int_library': ('b', '%'),        # herringbone parquet
    'int_school': ('b', ':'),         # linoleum
    'int_station': ('q', ';'),        # granite flags
    'int_fire_station': ('a', '='),   # red epoxy
    'int_mansion': ('T', '6'),        # red carpet
    'int_barn': ('u', '~'),           # straw on packed earth
    'int_greenhouse': ('P', '_'),     # brick basket weave
    'int_ski_lodge': ('b', '+'),      # pine boards
    'int_market_hall': ('K', '*'),    # hexagon tiles
}


def main():
    dry = '--dry' in sys.argv
    src = DATA.read_text(encoding='utf-8'); i = src.index('window.GAMEDATA='); head = src[:i]
    D = json.JSONDecoder().raw_decode(src[i + len('window.GAMEDATA='):])[0]
    T = D['scenery']['terrains']; S = D['scenes']; out = []
    assert len({v[1] for v in FLOORS.values()}) == len(FLOORS), 'two rooms share a floor'
    for sid, (old, new) in FLOORS.items():
        sc = S.get(sid)
        if not sc: out.append(f'{sid}: no such room'); continue
        if new not in T: out.append(f'{sid}: the floor {new} is not in the catalogue (run tools/build-terrain-v47.py)'); continue
        if sc.get('keep'): out.append(f'{sid}: kept as it is (marked keep)'); continue
        if sc.get('edge') == new: out.append(f'{sid}: already {T[new]["name"]}'); continue
        if sc.get('edge') != old: out.append(f'{sid}: its floor was changed in the Studio ({sc.get("edge")}), left alone'); continue
        n = sum(row.count(old) for row in sc['tiles'])
        sc['tiles'] = [row.replace(old, new) for row in sc['tiles']]; sc['edge'] = new
        out.append(f'{sid}: {T.get(old, {}).get("name", old)} → {T[new]["name"]} ({n} m²)')
    print('\n'.join(out))
    if not dry: DATA.write_text(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')


if __name__ == '__main__':
    main()
