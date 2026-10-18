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


HEAD = '/* Pocket Billies game data, put together from the files in game/data by tools/gamedata.py */\n'


def js_text():
    """The game data as the text of the old single gamedata.js (window.GAMEDATA=...), for the build scripts that parse
    that file."""
    return HEAD + 'window.GAMEDATA=' + json.dumps(load(), ensure_ascii=False, indent=1) + ';\n'


def save_js(text):
    """Save game data given as the text of the old single gamedata.js."""
    i = text.index('window.GAMEDATA=') + len('window.GAMEDATA=')
    save(json.JSONDecoder().raw_decode(text, i)[0])
