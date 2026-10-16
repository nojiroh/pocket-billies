"""Phase 04b: the game data for the Python tools, read from its files in game/data.

index.json lists the files: `keys` is the order of the top-level sections; a section in `split` has a file per entry
in a folder of its name (scenes/<id>.json, ...), in the order of its `ids` (an array when `array` is set); every other
section is <section>.json. The same layout as game/js/data-files.js, which the game, the Studio and the build use.

    import gamedata; D = gamedata.load()
"""
import json
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / 'game' / 'data'


def _read(path):
    return json.loads((DATA / path).read_text(encoding='utf-8'))


def load():
    """The whole game data, sections and entries in the index's order."""
    index = _read('index.json'); D = {}
    for key in index['keys']:
        s = index.get('split', {}).get(key)
        if not s:
            D[key] = _read(f'{key}.json')
        elif s.get('array'):
            D[key] = [_read(f'{key}/{i}.json') for i in s['ids']]
        else:
            D[key] = {i: _read(f'{key}/{i}.json') for i in s['ids']}
    return D
