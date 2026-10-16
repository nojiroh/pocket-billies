#!/usr/bin/env python3
"""alpha 0.4: tall props made properly 3D. The landmarks and the other tall structures that were still flat pictures get
a body made from their own picture (props3d.js, "vol"), so they keep their look and gain their depth: towers, machines
and buildings pushed back through their depth ("block"), round things turned like a pot on a wheel ("lathe"), rocks,
statues and crystals bulged ("puff"), lattices and boards as thick cut-outs ("slab"). Trees and plants stay layered
pictures (they already read as 3D); a prop that already has a body (vol, a voxel or low-poly model, a building plan,
parts) is left as it is, and so is anything listed in KEEP.

    python3 tools/build-landmarks-3d.py          # set what is missing
    python3 tools/build-landmarks-3d.py --dry    # say what it would set
"""
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent; DATA = ROOT / 'game' / 'data' / 'gamedata.js'
BODY = {   # prop: (kind, depth in metres at scale 1; 0 for a turned body)
    'bear_rock': ('puff', 2.4), 'bridge_broken': ('block', 2.0), 'clock_tower': ('block', 2.6), 'closing_bell': ('puff', 2.0), 'cloud_server': ('block', 3.0),
    'coral_tower': ('lathe', 0), 'crane': ('slab', .6), 'crystal_beacon': ('puff', 1.6), 'crystal_spire': ('puff', 2.2), 'ferris_wheel': ('slab', .9),
    'festival_stage': ('block', 4.0), 'geode_great': ('puff', 3.5), 'golden_cushion': ('puff', 2.4), 'ice_block_safe': ('block', 2.0), 'lighthouse_small': ('lathe', 0),
    'lookout_tower': ('block', 2.4), 'mushroom_colossal': ('lathe', 0), 'pearl_tower': ('lathe', 0), 'penthouse_gate': ('slab', .5), 'pressing_plant': ('block', 4.0),
    'shipwreck': ('puff', 3.0), 'spire_tower': ('lathe', 0), 'spore_mill': ('block', 3.0), 'statue_goldbull': ('puff', 1.4), 'stilt_hut': ('block', 3.0),
    'sun_press': ('block', 3.5), 'sunflower_giant': ('slab', .5), 'ticker_column': ('lathe', 0), 'tollbooth': ('block', 2.4), 'unicorn_statue': ('puff', 1.4),
    'vault_door_hill': ('block', 2.0), 'waystone': ('puff', .9), 'windmill': ('lathe', 0), 'yacht_super': ('block', 3.0),
    'arch': ('slab', .8), 'billboard_tour': ('slab', .3), 'bubble_gate': ('slab', .8), 'carousel_broken': ('lathe', 0), 'glass_lift': ('lathe', 0), 'mine_entrance': ('block', 2.0),
    'mine_headframe': ('slab', .8), 'mushroom_house': ('lathe', 0), 'needle_works': ('block', 3.0), 'sky_lift': ('block', 2.0), 'wind_sail_flower': ('slab', .3)}
KEEP = {'mirror_shaft': 'its shaft of light is soft: a body would make it a cone', 'neon_sign': 'its lit letters are a layer of their own'}


def main():
    dry = '--dry' in sys.argv; src = DATA.read_text(encoding='utf-8'); i = src.index('window.GAMEDATA=')
    D = json.JSONDecoder().raw_decode(src[i + len('window.GAMEDATA='):])[0]; C = D['scenery']['props']; done = []
    for k, (kind, d) in BODY.items():
        M = C.get(k)
        if not M or M.get('vol') or M.get('vox') or M.get('build') or M.get('parts'): continue
        M['vol'] = kind
        if d: M['volDepth'] = d
        done.append(f'{k} {kind}' + (f' {d} m' if d else ''))
    print(f'{len(done)} props made 3D: ' + ', '.join(done) if done else 'nothing to do')
    if done and not dry: DATA.write_text(src[:i] + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8'); print('saved')


if __name__ == '__main__':
    main()
