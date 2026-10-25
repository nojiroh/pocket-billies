#!/usr/bin/env python3
"""Marks the window glass in the building models (art/scene/next/models/*.json) with a `glass` number.

A layer with `"glass": n` (1-31) is a window's glass: the low-poly model draws it as glass (the sky in it by day) and
lights it from inside after dark (prop-models.js). Layers with the same n are one window and light together (a tall
window and its arched top). Run it once; a model that already has glass numbers is left as it is. The Studio's model
editor sets the number by hand from then on.

    python3 tools/mark-window-glass.py           # write the numbers
    python3 tools/mark-window-glass.py --dry     # only say what it would mark
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCENERY = ROOT / 'game/data/scenery.json'

# names of glass that is a window (portholes, gables, side and back windows); not a lamp's glass, a solar panel or a
# roof dome
WINDOW_NAMES = {'side window', 'back window', 'tall window', 'shop window', 'loft window', 'ribbon window',
                'gable window', 'front window', 'window', 'lobby glass', 'door glass'}
NOT_WINDOWS = ('lamp', 'lantern', 'solar', 'scope', 'dome')
# an arched top belongs to the window under it
TOPS = {'window top', 'side window top'}


def is_window(L):
    n = (L.get('name') or '').lower()
    if L.get('k') == 'img' or any(w in n for w in NOT_WINDOWS):
        return False
    return n in WINDOW_NAMES or n.endswith('glass')


def mark(rec):
    L = rec.get('layers') or []
    if any('glass' in l for l in L):
        return None
    n = 0
    done = []
    for l in L:
        nm = (l.get('name') or '').lower()
        if nm in TOPS:
            # the window it caps: the nearest marked one across, then in depth
            best = min(done, key=lambda q: abs(q.get('x', 0) - l.get('x', 0)) * 4 + abs(q.get('y', 0) - l.get('y', 0)),
                       default=None)
            if best is not None and abs(best.get('x', 0) - l.get('x', 0)) < 0.1:
                l['glass'] = best['glass']
                continue
        if not (is_window(l) or nm in TOPS):
            continue
        n += 1
        l['glass'] = min(n, 31)
        done.append(l)
    return n


def main():
    dry = '--dry' in sys.argv
    P = json.loads(SCENERY.read_text())
    P = P.get('props', P)
    paths = sorted({v['model'] for v in P.values()
                    if isinstance(v, dict) and isinstance(v.get('model'), str)
                    and any(e.get('k') == 'window' for e in v.get('fx', []))})
    for p in paths:
        f = ROOT / 'game/art' / p
        rec = json.loads(f.read_text())
        n = mark(rec)
        if n is None:
            print(f'{p}: already marked')
            continue
        print(f'{p}: {n} window{"" if n == 1 else "s"}' + (' (over 31: the rest share 31)' if n > 31 else ''))
        if not dry:
            f.write_text(json.dumps(rec, separators=(',', ':'), ensure_ascii=False) + '\n')


if __name__ == '__main__':
    main()
