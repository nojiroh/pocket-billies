#!/usr/bin/env python3
"""Hub track HB-5: the showcase of Copperleaf's buildings, before they are placed on the island (the placing half,
after HB-4b). Rows of: the cottages with each colour variant (v) and each roof style (roof), the coloured houses and
townhouses with their variants, the buildings with rooms (the General store, the inn, the library, the Workshop, the
Gene Bank; walk in through their doors), the lighthouse and the windmill with their turning parts, and the new
buildings at quarter turns (their rooms turn with them). In the game's debug menu under Test scenes, or
game/index.html?test=1&scene=test_hub_buildings

    python3 tools/build-hub-showcase.py      # rerunnable: writes game/data/maps/test_hub_buildings.json
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gamedata  # noqa: E402

ID = 'test_hub_buildings'
ROOFS = ('moss', 'solar', 'chrome')
# (label, step between props in metres, [(prop, extra keys)])
ROWS = [
    ('cottage_moss', 6.5, [('cottage_moss', {'v': v}) for v in range(4)] + [('cottage_moss', {'roof': r}) for r in ('solar', 'chrome')]),
    ('cottage_solar', 6.5, [('cottage_solar', {'v': v}) for v in range(4)] + [('cottage_solar', {'roof': r}) for r in ('moss', 'chrome')]),
    ('cottage_juniper', 6.5, [('cottage_juniper', {})] + [('cottage_juniper', {'roof': r}) for r in ROOFS]),
    ('houses', 7.5, [(k, {'v': v}) for k in ('house_red', 'house_blue') for v in range(3)]),
    ('houses-2', 8.5, [(k, {'v': v}) for k in ('house_green', 'house_large') for v in range(3)]),
    ('townhouses', 7.0, [(k, {'v': v}) for k in ('townhouse_red', 'townhouse_yellow') for v in range(3)]),
    ('rooms', 9.0, [('shop', {'act': 'shop', 'label': 'General store'}), ('inn', {'act': 'enter', 'label': 'Inn'}),
                    ('library', {'act': 'enter', 'label': 'Library'}), ('workshop', {'act': 'enter', 'label': 'Workshop'}),
                    ('gene_bank', {'act': 'enter', 'label': 'Gene Bank'})]),
    ('landmarks', 9.0, [('lighthouse', {}), ('windmill', {}), ('workshop', {'act': 'enter', 'rot': 90}),
                        ('gene_bank', {'act': 'enter', 'rot': 180}), ('windmill', {'rot': -90})]),
]
ROW, X0, Z0 = 18.0, 8.0, 8.0


def test_map():
    W = int(max(X0 * 2 + step * (len(ps) - 1) for _, step, ps in ROWS)) + 2
    H = int(Z0 + ROW * len(ROWS) + 6)
    tiles = ['g' * W for _ in range(H)]
    for r in range(len(ROWS)):  # a path along the front of each row
        z = int(Z0 + r * ROW - 3)
        row = H - 1 - z
        tiles[row] = 'p' * W
    props, shots = [], []
    for r, (label, step, ps) in enumerate(ROWS):
        z = Z0 + r * ROW
        x0 = (W - step * (len(ps) - 1)) / 2
        for c, (k, extra) in enumerate(ps):
            p = {'k': k, 'x': round(x0 + c * step, 2), 'z': z}
            p.update({f: v for f, v in extra.items() if v})
            props.append(p)
        mid = W / 2
        shots.append({'x': mid, 'z': z - 4, 'yaw': 0, 'label': label})
        shots.append({'x': mid, 'z': z - 4, 'yaw': 0.9, 'label': label + '-side'})
    return {
        'name': 'Test: the hub buildings (hub track HB-5)',
        'w': W,
        'h': H,
        'edge': 'g',
        'sky': ['#8CC6E6', '#BFE3EE', '#F4E8C8'],
        'haze': '#EAD9C0',
        'hazeD': 40,
        'cam': {'pitch': 30, 'h': 12, 'fov': 1},
        'blur': 0,
        'amb': None,
        'plain': 1,
        'tint': None,
        'indoor': 0,
        'far': 'hills',
        'farH': 8,
        'folk': 0,
        'test': 1,
        'exits': [],
        'checks': [],
        'shots': shots,
        'hub': [W / 2, 2.5],
        'kind': 'test',
        'tiles': tiles,
        'props': props,
    }


def main():
    D = gamedata.load()
    C = D['scenery']['props']
    missing = sorted({k for _, _, ps in ROWS for k, _ in ps if k not in C})
    if missing:
        sys.exit('not in the catalogue: ' + ', '.join(missing))
    D['maps'][ID] = test_map()
    gamedata.save(D)
    print(f'wrote game/data/maps/{ID}.json: {len(D["maps"][ID]["props"])} props in {len(ROWS)} rows')


if __name__ == '__main__':
    main()
