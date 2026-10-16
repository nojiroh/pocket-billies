#!/usr/bin/env python3
"""Find global names defined twice across the game's and the Studio's scripts.

The game loads plain <script> files that share one global scope, so a second
`function foo` silently replaces the first, and a second `let/const foo` stops
the page with an error. This reads each app's index.html, follows the script
load order and lists every top-level name declared more than once.

Top-level means the declaration starts at column 0 (how this code base writes
them) and is not inside a multi-line template string (paint.js keeps its worker's
source in one). Exit code 1 if anything is found.

Usage: python3 tools/check-globals.py
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APPS = ['game/index.html', 'studio/index.html']
SRC = re.compile(r'<script[^>]*\bsrc="([^"]+\.js)(?:\?[^"]*)?"')
TICK = re.compile(r'(?<!\\)`')
DECL = re.compile(r'^(?:async\s+)?(function\*?|class|let|const|var)\s+([A-Za-z_$][\w$]*)')


def scripts(html):
    base = os.path.dirname(html)
    with open(os.path.join(ROOT, html), encoding='utf-8') as f:
        for src in SRC.findall(f.read()):
            if '://' in src:
                continue
            path = os.path.normpath(os.path.join(base, src))
            if os.path.exists(os.path.join(ROOT, path)):
                yield path


def check(html):
    seen, dups, files = {}, [], 0
    for path in scripts(html):
        files += 1
        in_tpl = False
        with open(os.path.join(ROOT, path), encoding='utf-8') as f:
            for n, line in enumerate(f, 1):
                m = None if in_tpl else DECL.match(line)
                if len(TICK.findall(line)) % 2:
                    in_tpl = not in_tpl
                if not m:
                    continue
                kind, name = m.group(1).rstrip('*'), m.group(2)
                where = f'{path}:{n} ({kind})'
                if name in seen:
                    dups.append(f'  {name}: {seen[name]} -> {where}')
                else:
                    seen[name] = where
    print(f'{html}: {files} scripts, {len(seen)} top-level names, {len(dups)} duplicates')
    for d in dups:
        print(d)
    return len(dups)


def main():
    total = sum(check(h) for h in APPS)
    sys.exit(1 if total else 0)


if __name__ == '__main__':
    main()
