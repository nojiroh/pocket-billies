#!/usr/bin/env python3
"""Kappi the Wise's bath (Project Story, 2026-10-26): the lab's hot tub, where Kappi thinks best. A low cooper's tub
of staves and two iron hoops, steaming water with three yuzu and a leaf floating in it, a wooden step at its side.
Low-poly at 32 px/m (phase 09), its picture baked from the model (the fallback when models are off), a wisp of steam
(the smoke effect) over the water. Placed in the lab (maps/int_lab.json) beside Kappi's spot.

    python3 tools/build-props-kappi.py      # rerunnable; writes the model, the picture and this catalogue entry only
"""
import importlib.util
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import gamedata  # noqa: E402


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'tools' / file)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


ISL = load('island', 'build-props-island.py')
B1 = ISL.B1
PPM, A = B1.PPM, B1.AIR
box, cyl, sphere = B1.box, B1.cyl, B1.sphere
WATER, YUZU, LEAF = '#7CC4C4', '#F2C230', '#5E9A48'


def ring(z, r, t, col, tex, name, n=18):
    """A ring lying flat: a closed limb round a circle (batch 4's ring)."""
    pts = [[B1.r2(math.cos(2 * math.pi * i / n) * r), B1.r2(math.sin(2 * math.pi * i / n) * r), B1.r2(z), B1.r2(t)]
           for i in range(n + 1)]
    return {'k': 'limb', 'pts': pts, 'sides': 6, 'col': col, 'tex': tex, 'name': name}


def yuzu_bath_recipe():
    """The tub: bellied staves (their lid is the water, laid on top), a rim ring, two thin hoops; the fruit and a step."""
    r, h, bu = 0.56, 0.46, 0.05
    L = [cyl(0, 0, 0, r, h, A['wood'], 'wood', 'staves', 18, k='barrel', bulge=bu)]
    for z in (0.08, h - 0.15):
        L.append(cyl(0, 0, z, r * (1 + bu * 0.8) + 0.01, 0.03, A['iron'], 'metal', 'hoop', 18))
    L.append(cyl(0, 0, h - 0.005, r - 0.03, 0.012, WATER, 'plain', 'water', 18))
    L.append(ring(h + 0.01, r - 0.02, 0.035, A['dwood'], 'wood', 'rim'))
    for a, f in ((0.6, 0.25), (2.4, 0.3), (4.3, 0.18)):
        L.append(sphere(math.cos(a) * f, math.sin(a) * f, h + 0.01, 0.07, YUZU, 'plain', 'yuzu', 8, 4))
    L.append(box(-0.08, 0.12, h + 0.01, 0.12, 0.06, 0.01, LEAF, 'plain', 'leaf'))
    L.append(box(r + 0.12, 0, 0, 0.24, 0.42, 0.16, A['plank'], 'wood', 'step'))
    return {'ppm': PPM, 'cel': 0.7, 'layers': L}


def main():
    ISL.PICS.mkdir(parents=True, exist_ok=True)
    D = gamedata.load()
    C = D['scenery']['props']
    rec = yuzu_bath_recipe()
    C['yuzu_bath'] = ISL.new_prop('yuzu_bath', 'Yuzu bath', rec, shadow=0.9, tags=('indoor',), solid=0.6,
                                  fx=[{'k': 'smoke', 'x': 0, 'y': -round(0.5 * PPM)}])
    gamedata.save(D)
    print('made: yuzu_bath')


if __name__ == '__main__':
    main()
