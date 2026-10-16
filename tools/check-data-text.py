#!/usr/bin/env python3
"""Check that no text in the game data could become HTML.

The game and the Studio put names and lines from game/data/gamedata.js into
pages without escaping them (place names, Billie names, moves, scene names...).
That data changes through Studio pull requests, which are too big to read line
by line, so this guards it instead:
- no text anywhere has < > or a backtick (none does today), and
- no name or id has a double quote (they also go inside HTML attributes).
Quotes and & in descriptions and dialogue are fine: those are page text.

Exit code 1 if anything is found, with the path of each value.

Usage: python3 tools/check-data-text.py
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = 'game/data/gamedata.js'
ANY = re.compile(r'[<>`]')
NAME_KEYS = {'id', 'name', 'n', 'names', 'title', 'place'}


def load(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        text = f.read()
    m = re.search(r'window\.GAMEDATA\s*=', text)
    return json.loads(text[m.end():].strip().rstrip(';'))


def walk(v, path, key, out):
    if isinstance(v, str):
        if ANY.search(v) or (key in NAME_KEYS and '"' in v):
            out.append((path, v[:80]))
    elif isinstance(v, dict):
        for k, x in v.items():
            walk(x, f'{path}.{k}', k, out)
    elif isinstance(v, list):
        for i, x in enumerate(v):
            walk(x, f'{path}[{i}]', key, out)


def main():
    bad = []
    walk(load(DATA), 'GAMEDATA', '', bad)
    for path, v in bad[:50]:
        print(f'  {path}: {v!r}')
    if bad:
        print(f'{DATA}: {len(bad)} text values could become HTML (no < > ` anywhere, no " in names)')
        return 1
    print(f'{DATA}: no text that could become HTML')
    return 0


if __name__ == '__main__':
    sys.exit(main())
