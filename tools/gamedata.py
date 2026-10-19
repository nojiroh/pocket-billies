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


# phase 08b: a road between two places (an entry of D['roads']), whatever shape roads.json has. The tools read and
# change roads only through these (as the Studio does through game/js/data-files.js). A place is its position in
# D['locations'] (a node).
_KEEP = object()


def road(D, L):
    """A road as {'a', 'b'} (the two places' nodes), 'exit_a', 'exit_b', 'id', 'name'."""
    J = L[3] if len(L) > 3 else {}
    return {'a': L[0], 'b': L[1], 'exit_a': J.get('a'), 'exit_b': J.get('b'), 'id': J.get('id'), 'name': J.get('name')}


def set_road_end(D, L, end, node=None, exit=_KEEP):
    """One end ('a' or 'b') of a road: its place (a node; None keeps it) and the exit it leaves by (None clears it)."""
    if node is not None: L[0 if end == 'a' else 1] = node
    if exit is _KEEP: return
    if len(L) < 4: L.append({})
    if exit: L[3][end] = exit
    else: L[3].pop(end, None)


def add_road(D, a, b, id=None, name=None):
    """A new road from place a to place b, added to D['roads']; its exits are set with set_road_end."""
    J = {k: v for k, v in (('id', id), ('from', D['locations'][a].get('id')), ('to', D['locations'][b].get('id')), ('name', name)) if v}
    L = [a, b, 800, J]; D['roads'].append(L); return L


HEAD = '/* Pocket Billies game data, put together from the files in game/data by tools/gamedata.py */\n'


def js_text():
    """The game data as the text of the old single gamedata.js (window.GAMEDATA=...), for the build scripts that parse
    that file."""
    return HEAD + 'window.GAMEDATA=' + json.dumps(load(), ensure_ascii=False, indent=1) + ';\n'


def save_js(text):
    """Save game data given as the text of the old single gamedata.js."""
    i = text.index('window.GAMEDATA=') + len('window.GAMEDATA=')
    save(json.JSONDecoder().raw_decode(text, i)[0])
