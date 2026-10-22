#!/usr/bin/env python3
"""Island track IS-0: a crude test island, so the orbit camera (IS-1), the sea (IS-3) and the props (IS-4) have an
island on day one. 120 x 120 m: a cone 16 m high in the middle (walkable: steepest 0.65 m a metre, the walk allows
1.05), a flat grass ring, sand and wet sand at the shore, sea past it (edge water, the coast biome's flat far sea).
It carries the island contract's fields (docs/phases/island-track.md): cam.orbit, island, zones, islandGen.
In the game's debug menu under Test scenes, game/index.html?test=1&scene=test_island, or ?fixture=island

    python3 tools/build-test-island.py      # rerunnable: writes game/data/maps/test_island.json
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gamedata  # noqa: E402

ID, N, C = 'test_island', 120, 60.0
TOP, FOOT, RING, SAND, COAST = 3, 27, 48, 51, 52  # radii, metres: flat top, cone's foot, grass, sand, wet sand
# the town's side is the south (small z: z grows northward), where the camera first looks from
PROPS = [('signpost', 55.5, 29), ('house_blue', 66, 19), ('bench_wood', 72, 32), ('tree_oak', 40, 40),
         ('tree_oak', 82, 76), ('streetlamp', 48, 32)]


def height(r):
    if r <= TOP:
        return 16.0
    if r <= FOOT:
        return round(0.5 + 15.5 * (FOOT - r) / (FOOT - TOP), 2)
    if r <= RING:
        return 0.5
    return round(max(0.0, 0.5 - 0.35 * (r - RING) / (COAST - RING)), 2) if r <= COAST else 0.0


def ground(r):
    return 'r' if r < FOOT else 'g' if r < RING else 's' if r < SAND else 'S' if r < COAST else 'w'


def ring(r, n, a0=0, a1=360):
    """n points on a circle round the middle, angles in degrees (0 = east, 90 = north: z grows northward)"""
    step = (a1 - a0) / (n if a1 - a0 == 360 else n - 1)
    return [[round(C + r * math.cos(math.radians(a0 + i * step)), 2),
             round(C + r * math.sin(math.radians(a0 + i * step)), 2)] for i in range(n)]


def test_map():
    rad = lambda x, z: math.hypot(x - C, z - C)
    return {
        'name': 'Test: an island (island track)', 'w': N, 'h': N, 'kind': 'test', 'test': 1,
        'edge': 'w', 'waterKind': 'sea', 'far': 'sea', 'farH': 5, 'flatFar': 1,
        'sky': ['#5E9EE0', '#A6D2F2', '#F2F0E0'], 'haze': '#D6E8F2', 'hazeD': 46, 'amb': 'pollen', 'wind': 1.4,
        'blur': 1, 'tint': None, 'indoor': 0, 'folk': 0,
        'cam': {'pitch': 34, 'h': 9, 'fov': 1, 'orbit': {'c': [C, C], 'dead': TOP, 'lag': 0.6, 'turn': 30}},
        'island': {'c': [C, C], 'coast': ring(COAST, 32)},
        'zones': [
            {'k': 'mountain', 'poly': ring(FOOT, 16)},
            {'k': 'town', 'poly': [[50, 16], [70, 16], [70, 28], [50, 28]], 'lock': True},
            {'k': 'beach', 'poly': ring(COAST + 1, 7, 240, 300) + ring(RING - 1, 7, 300, 240)},
        ],
        'islandGen': {'v': 0, 'seed': 'test', 'dials': {}},
        'hub': [C, 30], 'exits': [],
        'checks': [
            {'from': [C, 30], 'to': [C, C], 'reach': True, 'what': 'up the cone to its flat top'},
            {'from': [C, 30], 'to': [C, 98], 'reach': True, 'what': 'round the ring to the north side'},
            {'from': [C, 30], 'to': [C, 4], 'reach': False, 'what': 'out into the sea'},
        ],
        'shots': [{'x': C, 'z': 30, 'yaw': 0, 'label': 'island-south'}, {'x': C, 'z': C, 'yaw': 0, 'label': 'island-top'}],
        'heights': [[height(rad(x, N - z)) for x in range(N + 1)] for z in range(N + 1)],
        # rows far (north) first, as every map's: symmetric here, but kept right for whoever reuses this
        'tiles': [''.join(ground(rad(x + 0.5, N - z - 0.5)) for x in range(N)) for z in range(N)],
        'props': [{'k': k, 'x': x, 'z': z} for k, x, z in PROPS],
    }


def main():
    D = gamedata.load()
    missing = sorted({k for k, _, _ in PROPS} - set(D['scenery']['props']))
    if missing:
        sys.exit('not in the catalogue: ' + ', '.join(missing))
    D['maps'][ID] = test_map()
    gamedata.save(D)
    print(f'wrote game/data/maps/{ID}.json')


if __name__ == '__main__':
    main()
