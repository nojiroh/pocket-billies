#!/usr/bin/env python3
"""Hub track HB-5: the rooms of Copperleaf's new buildings (the owner, 2026-10-25: all five get one).

  int_shop       the General store: the room it already has (a door with act 'shop')
  int_inn        the inn, int_library the library (the Bureau's archive): brought back from game/data/legacy/maps
  int_workshop   the Workshop: workbenches, parts shelves, an Upgrade bench (SP-5: act 'workshop' opens the Augment
                 screen), crates
  int_gene_bank  the Gene Bank: sample racks, a splice console (SP-4: act 'genebank' opens the splice screen), desks

A door with act 'enter' walks into its kind's room (scenery.json `room`, data-files.js doorRooms). The new rooms take
the General store's frame (12 x 10, the door on the south side, its walk grid and light); what stands in them is new.

    python3 tools/build-hub-rooms.py      # rerunnable: writes the rooms and the two kinds' `room`
"""
import copy
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gamedata  # noqa: E402

LEGACY = gamedata.DATA / 'legacy' / 'maps'
BACK = ('int_inn', 'int_library')


def floor(letter):
    """12 x 10 of one floor, the doormat by the door."""
    return [letter * 12] * 8 + [letter * 5 + 'qq' + letter * 5] * 2


def workshop(base):
    R = copy.deepcopy(base)
    R.update(name='Inside the Workshop', edge='i', tiles=floor('i'), room='workshop', building='workshop',
             keeper='folk:12', npcSpots=[[6, 6.95]],
             chat=['Bring me Scrap and I’ll bring you upgrades. Mostly upgrades.',
                   'Every bolt in here used to hold up something more important.',
                   'The crane is load-bearing. Emotionally.'])
    R['wallCol'] = [None] * 10 + ['#B8C4CC', None]
    R['props'] = [
        {'k': 'wall_clock', 'x': 6, 'z': 8.45},
        {'k': 'wall_window', 'x': 3.6, 'z': 8.45},
        {'k': 'wall_window', 'x': 8.4, 'z': 8.45},
        {'k': 'lab_machine', 'x': 6, 'z': 7.55, 'act': 'workshop', 'label': 'Upgrade bench'},
        {'k': 'shop_shelf', 'x': 1.99, 'z': 7.72, 'label': 'Parts'},
        {'k': 'shop_shelf', 'x': 10.01, 'z': 7.72, 'label': 'Parts'},
        {'k': 'lab_desk', 'x': 2.49, 'z': 5.6, 'label': 'Workbench'},
        {'k': 'lab_desk', 'x': 9.51, 'z': 5.6, 'label': 'Workbench'},
        {'k': 'crate_stack', 'x': 1.5, 'z': 3.4},
        {'k': 'crate_goods', 'x': 10.5, 'z': 3.3, 'f': 1},
        {'k': 'pipe', 'x': 10.6, 'z': 1.8},
        {'k': 'rug_long', 'x': 6, 'z': 3.44},
    ]
    return R


def gene_bank(base):
    R = copy.deepcopy(base)
    R.update(name='Inside the Gene Bank', edge='*', tiles=floor('*'), room='gene_bank', building='gene_bank',
             keeper='folk:23', npcSpots=[[6, 6.7]],
             chat=['Every gene is filed in triplicate. The forms are on the left.',
                   'Please don’t lick the samples. We have a form for that too.',
                   'Splicing opens as soon as the paperwork clears.'])
    R['wallCol'] = [None] * 10 + ['#D8ECE2', None]
    R['props'] = [
        {'k': 'wall_clock', 'x': 6, 'z': 8.45},
        {'k': 'server_rack', 'x': 1.6, 'z': 7.9, 'label': 'Sample racks'},
        {'k': 'server_rack', 'x': 2.7, 'z': 7.9},
        {'k': 'server_rack', 'x': 9.3, 'z': 7.9},
        {'k': 'server_rack', 'x': 10.4, 'z': 7.9, 'label': 'Sample racks'},
        {'k': 'lab_machine', 'x': 6, 'z': 7.55, 'act': 'genebank', 'label': 'Splice console'},
        {'k': 'lab_desk', 'x': 2.49, 'z': 5.4},
        {'k': 'lab_desk', 'x': 9.51, 'z': 5.4},
        {'k': 'chair_wood', 'x': 2.49, 'z': 4.4},
        {'k': 'chair_wood', 'x': 9.51, 'z': 4.4, 'f': 1},
        {'k': 'rug_long', 'x': 6, 'z': 3.44},
        {'k': 'plant_tall', 'x': 1.4, 'z': 1.8},
        {'k': 'plant_tall', 'x': 10.6, 'z': 1.8, 'f': 1},
    ]
    return R


def main():
    D = gamedata.load()
    M, C = D['maps'], D['scenery']['props']
    for rid in BACK:
        f = LEGACY / f'{rid}.json'
        if rid not in M:
            M[rid] = json.loads(f.read_text(encoding='utf-8'))
    base = M['int_shop']
    M['int_workshop'] = workshop(base)
    M['int_gene_bank'] = gene_bank(base)
    C['workshop']['room'] = 'int_workshop'
    C['gene_bank']['room'] = 'int_gene_bank'
    missing = sorted({p['k'] for r in ('int_workshop', 'int_gene_bank') for p in M[r]['props'] if p['k'] not in C})
    if missing:
        sys.exit('not in the catalogue: ' + ', '.join(missing))
    gamedata.save(D)
    # the room lives in game/data/maps now: out of the legacy folder and its index
    index = LEGACY.parent / 'index.json'
    text = index.read_text(encoding='utf-8')
    for rid in BACK:
        (LEGACY / f'{rid}.json').unlink(missing_ok=True)
        text = text.replace(f'    "{rid}",\n', '')
    index.write_text(text, encoding='utf-8')
    print('rooms:', ', '.join(('int_shop',) + BACK + ('int_workshop', 'int_gene_bank')))


if __name__ == '__main__':
    main()
