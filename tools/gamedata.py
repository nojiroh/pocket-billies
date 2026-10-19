"""Phase 04b: the game data for the Python tools, read from its files in game/data.

index.json lists the files: `keys` is the order of the top-level sections; a section in `split` has a file per entry
in a folder of its name (maps/<id>.json, ...), in the order of its `ids` (an array when `array` is set); every other
section is <section>.json. The same layout as game/js/data-files.js, which the game, the Studio and the build use.

    import gamedata; D = gamedata.load(); ...; gamedata.save(D)

save() writes through tools/write-data.mjs (Node), so the files are laid out exactly as the Studio writes them.
The build scripts written for the single gamedata.js read js_text() and write save_js(text) instead of that file.
"""
import json
import subprocess
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


def save(D):
    """Write the whole game data back as its files (only the ones that changed; files of removed entries go)."""
    subprocess.run(['node', str(Path(__file__).resolve().parent / 'write-data.mjs')],
                   input=json.dumps(D, ensure_ascii=False).encode('utf-8'), check=True)


# phase 08b: the roads between places. roads.json is a list of typed links,
#   {'id', 'name', 'kind': 'seam', 'a': {'map', 'exit'}, 'b': {'map', 'exit'}}
# each end naming a place by its map (the place's mapId, or its id when it has none) and the edge exit it leaves by.
# The tools read and change roads only through these (as the Studio does through game/js/data-files.js); they speak of
# a place as its position in D['locations'] (a node), as the rest of the data does.
_KEEP = object()


def _place_of(D, m):
    return next((i for i, r in enumerate(D['locations']) if m in (r.get('mapId'), r.get('id'))), -1)


def _map_of(D, node):
    r = D['locations'][node]; return r.get('mapId') or r.get('id')


def road(D, L):
    """A road as {'a', 'b'} (the two places' nodes), 'exit_a', 'exit_b', 'id', 'name'."""
    A, B = L.get('a') or {}, L.get('b') or {}
    return {'a': _place_of(D, A.get('map')), 'b': _place_of(D, B.get('map')), 'exit_a': A.get('exit'), 'exit_b': B.get('exit'),
            'id': L.get('id'), 'name': L.get('name')}


def set_road_end(D, L, end, node=None, exit=_KEEP):
    """One end ('a' or 'b') of a road: its place (a node; None keeps it) and the exit it leaves by (None clears it)."""
    E = L.setdefault(end, {})
    if node is not None: E['map'] = _map_of(D, node)
    if exit is _KEEP: return
    if exit: E['exit'] = exit
    else: E.pop('exit', None)


def add_road(D, a, b, id=None, name=None):
    """A new road from place a to place b, added to D['roads']; its exits are set with set_road_end."""
    L = {k: v for k, v in (('id', id), ('name', name)) if v}
    L.update(kind='seam', a={'map': _map_of(D, a)}, b={'map': _map_of(D, b)}); D['roads'].append(L); return L


HEAD = '/* Pocket Billies game data, put together from the files in game/data by tools/gamedata.py */\n'


def js_text():
    """The game data as the text of the old single gamedata.js (window.GAMEDATA=...), for the build scripts that parse
    that file."""
    return HEAD + 'window.GAMEDATA=' + json.dumps(load(), ensure_ascii=False, indent=1) + ';\n'


def save_js(text):
    """Save game data given as the text of the old single gamedata.js."""
    i = text.index('window.GAMEDATA=') + len('window.GAMEDATA=')
    save(json.JSONDecoder().raw_decode(text, i)[0])
