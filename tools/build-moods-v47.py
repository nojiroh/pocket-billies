#!/usr/bin/env python3
"""v47: a mood per place. Writes the mood presets into the game data (moods) and gives each place one (its route entry's
`mood`); a scene can name its own (sc.mood). The renderer eases from one place's mood to the next as you walk
(diorama-gl.js, dglMood) and lays it on top of the chosen colour grade in the post pass (engine/post.js).

A mood: sat and con multiply saturation and contrast, warm adds to warmth (+ warmer, - cooler), lift/gain/sh/hi are the
grade's lift (shadows), gain (highlights, as a share), and tints for the darks and the lights (RGB, added).

Only writes what is missing: a place keeps a mood you gave it in the Studio. --force sets them all again.

    python3 tools/build-moods-v47.py
    python3 tools/build-moods-v47.py --force
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'data' / 'gamedata.js'

MOODS = {
 'golden': {'name': 'Golden afternoon', 'sat': 1.06, 'con': 1.03, 'warm': .35, 'lift': [.008, .004, 0], 'gain': [.02, .01, -.02], 'sh': [.01, -.004, .02], 'hi': [.025, .012, -.015]},
 'green': {'name': 'Green and lush', 'sat': 1.06, 'con': 1.0, 'warm': .08, 'hi': [.01, .015, -.01]},
 'misty': {'name': 'Cool and misty', 'sat': .9, 'con': .94, 'warm': -.25, 'lift': [.01, .018, .022], 'gain': [-.02, 0, .01], 'sh': [-.01, .01, .03], 'hi': [0, .01, .02]},
 'heat': {'name': 'Hazy heat', 'sat': .94, 'con': .93, 'warm': .4, 'lift': [.03, .022, .008], 'gain': [.02, .01, -.03], 'sh': [.015, .005, 0], 'hi': [.03, .02, -.01]},
 'glow': {'name': 'Glowing and soft', 'sat': 1.12, 'con': .92, 'warm': -.05, 'lift': [.02, 0, .03], 'gain': [0, 0, .02], 'sh': [.01, -.01, .04], 'hi': [.02, -.005, .03]},
 'crisp': {'name': 'Crisp and cold', 'sat': .95, 'con': 1.06, 'warm': -.3, 'lift': [0, .005, .015], 'gain': [0, .005, .02], 'sh': [-.01, 0, .03], 'hi': [0, .008, .02]},
 'seaside': {'name': 'Sea air', 'sat': 1.05, 'con': 1.0, 'warm': .05, 'lift': [0, .008, .015], 'gain': [0, .005, .01], 'sh': [-.01, .008, .025], 'hi': [.01, .01, 0]},
 'lakeside': {'name': 'Lakeside', 'sat': 1.02, 'con': .98, 'warm': -.05, 'lift': [0, .008, .012], 'sh': [-.005, .008, .02]},
 'cave': {'name': 'Cave glow', 'sat': 1.04, 'con': 1.04, 'warm': -.1, 'lift': [.004, 0, .016], 'sh': [0, 0, .03], 'hi': [.01, 0, .02]},
 'city': {'name': 'City', 'sat': .96, 'con': 1.05, 'warm': 0, 'sh': [-.005, 0, .015], 'hi': [.01, .01, .005]},
 'harvest': {'name': 'Harvest', 'sat': 1.05, 'con': 1.02, 'warm': .2, 'hi': [.02, .012, -.01]},
 'ember': {'name': 'Ember', 'sat': 1.06, 'con': 1.07, 'warm': .3, 'lift': [.01, 0, 0], 'sh': [.03, 0, -.005], 'hi': [.03, .01, -.02]},
 'dusty': {'name': 'Dusty', 'sat': .86, 'con': 1.02, 'warm': .12, 'lift': [.02, .018, .012], 'sh': [.01, .008, 0]},
 'clear': {'name': 'Clear air', 'sat': 1.02, 'con': 1.05, 'warm': 0, 'hi': [0, .005, .01]},
 'indoors': {'name': 'Indoors', 'sat': 1.0, 'con': 1.0, 'warm': .05},
 # for the regions of v47 part 4
 'pastel': {'name': 'Pastel spring', 'sat': 1.08, 'con': .95, 'warm': .05, 'lift': [.02, .012, .02], 'hi': [.02, .01, .02]},
 'crystal': {'name': 'Crystal hum', 'sat': 1.1, 'con': 1.05, 'warm': -.2, 'lift': [.008, 0, .02], 'sh': [.005, -.005, .04], 'hi': [.01, .01, .03]},
 'deepsea': {'name': 'Deep sea', 'sat': 1.04, 'con': .97, 'warm': -.3, 'lift': [0, .015, .025], 'sh': [-.02, .015, .04], 'hi': [0, .015, .02]},
 'sky': {'name': 'High sky', 'sat': .98, 'con': 1.02, 'warm': -.08, 'lift': [.015, .015, .025], 'hi': [.02, .02, .03]},
 'noon': {'name': 'Endless noon', 'sat': 1.0, 'con': 1.1, 'warm': .45, 'lift': [.02, .015, 0], 'gain': [.04, .03, -.02], 'hi': [.04, .03, -.02]},
}

PLACES = {'sundown': 'golden', 'longgrass': 'green', 'golf': 'green', 'thicket': 'misty', 'grotto': 'cave', 'canyon': 'heat',
          'scrapyard': 'dusty', 'foodcourt': 'harvest', 'mall': 'indoors', 'pond': 'lakeside', 'farm': 'harvest', 'ridge': 'clear',
          'city': 'city', 'offshore': 'seaside', 'taxhaven': 'seaside', 'volcano': 'ember', 'pass': 'crisp', 'summit': 'crisp',
          'lake': 'lakeside'}


def main():
    force = '--force' in sys.argv
    src = DATA.read_text(encoding='utf-8'); k0 = src.index('window.GAMEDATA='); head = src[:k0]
    D = json.JSONDecoder().raw_decode(src[k0 + len('window.GAMEDATA='):])[0]
    M = D.setdefault('moods', {}); added = []
    for k, v in MOODS.items():
        if force or k not in M: M[k] = v; added.append(k)
    set_ = []
    for r in D['route']:
        m = PLACES.get(r.get('id'))
        if m and (force or not r.get('mood')): r['mood'] = m; set_.append(f"{r['id']}={m}")
    DATA.write_text(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
    print(f'moods: {len(M)} presets ({len(added)} written); places: {", ".join(set_) or "all had one"}')


if __name__ == '__main__':
    main()
