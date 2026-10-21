#!/usr/bin/env python3
"""Phase 09 batch 9: the test map for turned props (a placement's rot, degrees). Each row is one prop at five turns,
0, 30, 90, 180 and -45, so the model, its pictures and decals, its shadow, its footprint (walk into it), its door and
its lights can be checked turning the same way. In the game's debug menu under Test scenes, or
game/index.html?test=1&scene=test_props_turn

    python3 tools/build-turn-test-map.py      # rerunnable: writes game/data/maps/test_props_turn.json
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gamedata  # noqa: E402

TURNS = [0, 30, 90, 180, -45]
ROWS = [
    # (prop, what it checks)
    ('bench_wood', 'a model with a footprint'),
    ('house_blue', 'a model with a door, windows and a chimney'),
    ('stall', 'a wide footprint'),
    ('fence_wood', 'a long thin footprint'),
    ('tree_oak', 'a modelled trunk with drawn leaf clumps'),
    ('signpost', 'a model with picture decals'),
    ('flag_pole', 'a pole with its flag'),
    ('bus_shelter', 'a picture standee with a footprint (3D models off)'),
    ('arch', 'a picture with posts'),
    ('clinic', 'a big model with decals and lettering'),
]
COL, ROW, X0, Z0 = 8.0, 10.0, 8.0, 7.0
ID = 'test_props_turn'


def test_map():
    W = int(X0 * 2 + COL * (len(TURNS) - 1) + 2)
    H = int(Z0 + ROW * len(ROWS) + 4)
    tiles = ['g' * W for _ in range(H)]
    props, shots = [], []
    for r, (k, what) in enumerate(ROWS):
        z = Z0 + r * ROW
        for c, t in enumerate(TURNS):
            p = {'k': k, 'x': round(X0 + c * COL, 2), 'z': z}
            if t:
                p['rot'] = t
            props.append(p)
        mid = X0 + COL * (len(TURNS) - 1) / 2
        shots.append({'x': mid, 'z': z - 3, 'yaw': 0, 'label': f'{k}-turns'})
        shots.append({'x': mid, 'z': z - 3, 'yaw': 0.9, 'label': f'{k}-turns-side'})
    return {
        'name': 'Test: turned props (phase 09 batch 9)',
        'w': W,
        'h': H,
        'edge': 'g',
        'sky': ['#8CC6E6', '#BFE3EE', '#F4E8C8'],
        'haze': '#EAD9C0',
        'hazeD': 34,
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
        'hub': [X0 + COL * (len(TURNS) - 1) / 2, 2.5],
        'kind': 'test',
        'tiles': tiles,
        'props': props,
    }


def main():
    D = gamedata.load()
    C = D['scenery']['props']
    missing = [k for k, _ in ROWS if k not in C]
    if missing:
        sys.exit('not in the catalogue: ' + ', '.join(missing))
    D['maps'][ID] = test_map()
    gamedata.save(D)
    print(f'wrote game/data/maps/{ID}.json: {len(ROWS)} props at {len(TURNS)} turns each')


if __name__ == '__main__':
    main()
