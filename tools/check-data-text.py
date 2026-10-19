#!/usr/bin/env python3
"""Check that no text in the game data could become HTML.

The game and the Studio put names and lines from the game data (game/data/*.json) into
pages without escaping them (place names, Billie names, moves, scene names...).
That data changes through Studio pull requests, which are too big to read line
by line, so this guards it instead:
- no text anywhere has < > or a backtick (none does today), and
- no name or id has a double quote (they also go inside HTML attributes).
Quotes and & in descriptions and dialogue are fine: those are page text.
Story scripts (a `script` list, docs/SCRIPTS.md) may use > and < as syntax only: the option marker at the
start of a line and the comparisons in a condition (if / elif / [if ...]). Everything the player sees in them
is still checked.

Exit code 1 if anything is found, with the path of each value.

Usage: python3 tools/check-data-text.py
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gamedata  # noqa: E402

DATA = 'game/data'
ANY = re.compile(r'[<>`]')
NAME_KEYS = {'id', 'name', 'n', 'names', 'title', 'locationId'}
OPS = re.compile(r'>=|<=|!=|==|[<>]')


def script_text(line):
    """a script line without its syntax: the option marker, and the comparisons in its conditions"""
    s = re.sub(r'^(\s*)>', r'\1', line)
    s = re.sub(r'\[if [^\]]*\]', lambda m: OPS.sub(' ', m.group(0)), s)
    m = re.match(r'^(\s*(?:if|elif)\s)(.*)$', s)
    return m.group(1) + OPS.sub(' ', m.group(2)) if m else s


def walk(v, path, key, out):
    if isinstance(v, str):
        if ANY.search(v) or (key in NAME_KEYS and '"' in v):
            out.append((path, v[:80]))
    elif isinstance(v, dict):
        for k, x in v.items():
            walk(x, f'{path}.{k}', k, out)
    elif isinstance(v, list):
        for i, x in enumerate(v):
            if key == 'script' and isinstance(x, str):
                if ANY.search(script_text(x)):
                    out.append((f'{path}[{i}]', x[:80]))
                continue
            walk(x, f'{path}[{i}]', key, out)


def main():
    bad = []
    walk(gamedata.load(), 'GAMEDATA', '', bad)
    for path, v in bad[:50]:
        print(f'  {path}: {v!r}')
    if bad:
        print(f'{DATA}: {len(bad)} text values could become HTML (no < > ` anywhere, no " in names)')
        return 1
    print(f'{DATA}: no text that could become HTML')
    return 0


if __name__ == '__main__':
    sys.exit(main())
