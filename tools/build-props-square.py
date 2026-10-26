#!/usr/bin/env python3
"""Hub track HB-10b: new props for Copperleaf's square, in the low-poly 32 px/m style (phase 09; the hub buildings'
verdigris and brass, tools/build-props-hub.py).

  string_lights  two verdigris posts 6 m apart with a sagging wire of warm bulbs; each bulb a lamp glow, lit after
                 dusk (walk/effects.js glow, lampLit). Walk under it: only the posts block (`posts`)
  pennant_line   HB-10d: the win bunting, two posts 5.2 m apart with a sagging line of cloth pennants (three-sided
                 cones, point down) in the town's cream, brass, verdigris and copper. Shown on the square after a won
                 run (`when: "last:won"` on the placed prop, tools/square-props.mjs). Only the posts block

The new kinds get a picture baked from the model (scene/next/hub/<key>.png: the fallback when models are off).

    python3 tools/build-props-square.py      # rerunnable; writes the models, pictures and these catalogue entries only
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
B1, B5 = ISL.B1, ISL.B7.B5
PPM, A = B1.PPM, B1.AIR
limb, sphere, cyl, r2 = B1.limb, B1.sphere, B1.cyl, B1.r2
ISL.PICS = B1.ART / 'scene' / 'next' / 'hub'  # the baked pictures of the new kinds (with the hub's buildings)
px = lambda m: round(m * PPM)
IRON, VERD, BRASS = '#3E4A5E', A['verd'], A['brass']
BULB = '#FFD98A'

SPAN = 3.0  # half the distance between the posts (m)
TOP = 2.9  # where the wire hangs from (m)
SAG = 0.45  # how far the wire dips in the middle (m)
BULBS = 9


def wire_z(x):
    """the wire's height at x: a gentle catenary-like dip, SAG at the middle"""
    return TOP - SAG * (1 - (x / SPAN) ** 2)


def string_lights():
    L = []
    for sx in (-1, 1):
        x = sx * SPAN
        L += [cyl(x, 0, 0, 0.13, 0.12, IRON, 'metal', 'post foot', 8),
              limb((x, 0, 0.12), (x, 0, TOP + 0.25), 0.05, 0.04, VERD, 'metal', 'post', 8),
              sphere(x, 0, TOP + 0.28, 0.07, BRASS, 'metal', 'post cap', 8, 4),
              limb((x, 0, TOP - 0.25), (x - sx * 0.3, 0, TOP), 0.018, 0.018, VERD, 'metal', 'hook', 5)]
    n = 17
    pts = [[r2(-SPAN + 0.3 + (2 * SPAN - 0.6) * i / (n - 1)), 0, 0, 0.008] for i in range(n)]
    for p in pts:
        p[2] = r2(wire_z(p[0]))
    L.append({'k': 'limb', 'pts': pts, 'sides': 4, 'col': IRON, 'tex': 'metal', 'name': 'wire'})
    for x in bulb_xs():
        z = wire_z(x)
        L += [limb((x, 0, z), (x, 0, z - 0.08), 0.006, 0.006, IRON, 'metal', 'bulb stem', 4),
              sphere(x, 0, z - 0.13, 0.055, BULB, 'plain', 'bulb', 8, 4)]
    return B5.rec(L)


def bulb_xs():
    return [r2(-SPAN + 0.6 + (2 * SPAN - 1.2) * i / (BULBS - 1)) for i in range(BULBS)]


def string_lights_fx():
    return [{'k': 'glow', 'x': px(x), 'y': -px(wire_z(x) - 0.13)} for x in bulb_xs()]


PEN_SPAN = 2.6  # half the distance between the pennant line's posts (m)
PEN_TOP = 3.1
PEN_SAG = 0.4
PENNANTS = 11
PEN_COLS = ('#F2DCA0', BRASS, VERD, '#CE7C4C')  # cream, brass, verdigris, copper (the hub's buildings)


def pen_z(x):
    return PEN_TOP - PEN_SAG * (1 - (x / PEN_SPAN) ** 2)


def pennant_line():
    L = []
    for sx in (-1, 1):
        x = sx * PEN_SPAN
        L += [cyl(x, 0, 0, 0.12, 0.12, IRON, 'metal', 'post foot', 8),
              limb((x, 0, 0.12), (x, 0, PEN_TOP + 0.2), 0.045, 0.035, VERD, 'metal', 'post', 8),
              sphere(x, 0, PEN_TOP + 0.24, 0.07, BRASS, 'metal', 'post cap', 8, 4)]
    n = 15
    pts = [[r2(-PEN_SPAN + 2 * PEN_SPAN * i / (n - 1)), 0, 0, 0.008] for i in range(n)]
    for p in pts:
        p[2] = r2(pen_z(p[0]))
    L.append({'k': 'limb', 'pts': pts, 'sides': 4, 'col': '#D6C08A', 'tex': 'cloth', 'name': 'line'})
    for i in range(PENNANTS):
        x = r2(-PEN_SPAN + 0.45 + (2 * PEN_SPAN - 0.9) * i / (PENNANTS - 1))
        z = pen_z(x)
        L.append(cyl(x, 0, r2(z - 0.32), 0.012, 0.31, PEN_COLS[i % len(PEN_COLS)], 'cloth', 'pennant', 3, k='cone',
                     r1=0.15))
    return B5.rec(L)


def main():
    ISL.PICS.mkdir(parents=True, exist_ok=True)
    D = gamedata.load()
    C = D['scenery']['props']
    C['string_lights'] = ISL.new_prop('string_lights', 'String lights', string_lights(), shadow=0.3, tags=('town',),
                                      fx=string_lights_fx(), posts=[{'x': -px(SPAN), 'r': 0.1}, {'x': px(SPAN), 'r': 0.1}])
    C['pennant_line'] = ISL.new_prop('pennant_line', 'Pennant line', pennant_line(), shadow=0.3, tags=('town',),
                                     posts=[{'x': -px(PEN_SPAN), 'r': 0.1}, {'x': px(PEN_SPAN), 'r': 0.1}])
    gamedata.save(D)
    print('square props: string_lights, pennant_line')


if __name__ == '__main__':
    main()
