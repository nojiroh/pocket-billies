#!/usr/bin/env python3
"""Marks the cottages' roofs (art/scene/next/models/cottage_*.json) so a placed roof style works on them (HB-5).

A layer with `"roof": 1` is a roof part: a placement's `roof: moss|solar|chrome` gives it that colour and material.
`"roof": 2` is dressing that fits only the model's own roof (moss tufts, roof flowers): hidden under another style
(prop-models.js swappedRecipe). Run it once; a model that already has roof parts is left as it is. The Studio's model
editor ("Roof part") sets them by hand from then on.

    python3 tools/mark-cottage-roofs.py           # write the marks
    python3 tools/mark-cottage-roofs.py --dry     # only say what it would mark
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / 'game/art/scene/next/models'

# the layer names of each cottage's roof and of its roof dressing
ROOFS = {
    'cottage_moss': ({'mossy roof', 'roof edge'}, {'moss tuft', 'roof flower'}),
    'cottage_solar': ({'solar roof'}, set()),
    'cottage_juniper': ({'mossy roof', 'thatch skirt', 'thatch lip'}, {'moss tuft', 'roof flower'}),
}


def mark(rec, roof, dressing):
    L = rec.get('layers') or []
    if any('roof' in l for l in L):
        return None
    n = [0, 0]
    for l in L:
        nm = (l.get('name') or '').lower()
        if nm in roof:
            l['roof'] = 1
            n[0] += 1
        elif nm in dressing:
            l['roof'] = 2
            n[1] += 1
    return n


def main():
    dry = '--dry' in sys.argv
    for k, (roof, dressing) in ROOFS.items():
        f = MODELS / f'{k}.json'
        rec = json.loads(f.read_text())
        n = mark(rec, roof, dressing)
        if n is None:
            print(f'{k}: already marked')
            continue
        print(f'{k}: {n[0]} roof parts, {n[1]} dressing')
        if not dry:
            f.write_text(json.dumps(rec, separators=(',', ':'), ensure_ascii=False) + '\n')


if __name__ == '__main__':
    main()
