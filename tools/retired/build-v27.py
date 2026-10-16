#!/usr/bin/env python3
"""v27 game data: the new animals join the walk scenes (rabbits in the meadows, squirrels in the woods, frogs at
the ponds, seagulls and crabs on the coast, goats in the mountains, cats in town, lizards on warm rock).

    python3 tools/build-v27.py

Only adds a kind of animal to a scene that doesn't have it yet, so anything you set in the Studio stays."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'data' / 'gamedata.js'
ADD = {
 'sundown': [('cat', 2), ('rabbit', 2)], 'longgrass': [('rabbit', 4)], 'golf': [('rabbit', 3), ('squirrel', 2)],
 'thicket': [('squirrel', 3), ('frog', 2), ('rabbit', 2)], 'canyon': [('lizard', 4)], 'scrapyard': [('cat', 2)],
 'pond': [('frog', 4), ('rabbit', 2)], 'farm': [('cat', 1), ('rabbit', 2)], 'ridge': [('goat', 3), ('rabbit', 1)],
 'city': [('cat', 2)], 'offshore': [('gull', 4), ('crab', 3)], 'taxhaven': [('gull', 3), ('crab', 3), ('cat', 2)],
 'volcano': [('lizard', 4)], 'pass': [('goat', 3)], 'summit': [('goat', 2), ('cat', 1)], 'lake': [('frog', 3), ('gull', 2)],
}


def main():
    s = DATA.read_text(encoding='utf-8'); i = s.index('window.GAMEDATA=')
    head, D = s[:i], json.JSONDecoder().raw_decode(s[i + 16:])[0]
    n = 0
    for sid, kinds in ADD.items():
        sc = D['scenes'].get(sid)
        if not sc: continue
        L = sc.setdefault('life', []); have = {x['k'] for x in L}
        for k, cnt in kinds:
            if k not in have: L.append({'k': k, 'n': cnt}); n += 1
    DATA.write_text(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
    print('animals added to scenes:', n)


if __name__ == '__main__':
    main()
