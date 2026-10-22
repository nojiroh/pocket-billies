#!/usr/bin/env python3
"""Phase 09 task 4: merge each "_deep" tree into its base tree. A _deep tree was the v13 way to give a picture tree
depth (its own back and front layers, the same main picture as its base); every base tree is a model now (batches 1,
2 and 10), so the copies only hold old pictures. Each placement of a _deep tree, in the game's maps and the legacy
ones, and each biome's weight for it become its base tree's (weights added when a biome lists both); then the _deep
entries go from the catalogue, and the layer pictures nothing else names any more are deleted.

    python3 tools/merge-deep-trees.py        # rerunnable: once merged there is nothing left to do

Writes game/data (scenery.json, biomes.json, maps/*.json) and game/data/legacy/maps/*.json; deletes unused pictures
in game/art/scene/props/layers/.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import gamedata  # noqa: E402

ART = ROOT / 'game' / 'art'
LEGACY = ROOT / 'game' / 'data' / 'legacy' / 'maps'


def renamed(o, M):
    """every placement (a dict whose 'k' is a merged key) in o, its key swapped for the base's; returns the count"""
    n = 0
    if isinstance(o, dict):
        if isinstance(o.get('k'), str) and o['k'] in M:
            o['k'] = M[o['k']]; n += 1
        for v in o.values(): n += renamed(v, M)
    elif isinstance(o, list):
        for v in o: n += renamed(v, M)
    return n


def main():
    D = gamedata.load()
    C = D['scenery']['props']
    M = {k: k[:-len('_deep')] for k in C if k.endswith('_deep') and k[:-len('_deep')] in C}
    if not M:
        print('nothing to merge'); return
    layers = {L['img'] for k in M for L in C[k].get('layers', [])}
    n_maps = sum(renamed(m, M) for m in D['maps'].values())
    n_bio = 0
    for b in D['biomes'].values():
        for sect, W in b.items():
            if not isinstance(W, dict) or not any(k in M for k in W): continue
            out = {}
            for k, w in W.items():  # in place, so the biome's order (and its streams) stay as they were
                base = M.get(k, k)
                out[base] = out.get(base, 0) + w
                n_bio += k in M
            b[sect] = out
    for k in M: del C[k]
    gamedata.save(D)
    # the legacy maps (kept for the Studio, not loaded by the game flow): the same swap, file by file
    # (the quoted key swapped as text, so the file keeps the data writer's layout; each swap must be a placement's)
    n_leg = 0
    for f in sorted(LEGACY.glob('*.json')):
        t = f.read_text(encoding='utf-8')
        if '_deep' not in t: continue
        n = renamed(json.loads(t), M)
        assert sum(t.count(f'"{k}"') for k in M) == n, f'{f.name}: a merged key outside a placement'
        for k, b in M.items():
            t = t.replace(f'"{k}"', f'"{b}"')
        if n:
            f.write_text(t, encoding='utf-8')
            n_leg += n
    # the layer pictures only the merged entries named (nothing in the data, the game, the Studio or the tools names them)
    import subprocess
    gone = []
    for img in sorted(layers):
        name = Path(img).name
        used = subprocess.run(['git', 'grep', '-q', '-F', name, '--', 'game/data', 'game/js', 'studio', 'tools', ':!tools/merge-deep-trees.py'],
                              cwd=ROOT).returncode == 0
        if not used and (ART / img).exists():
            (ART / img).unlink(); gone.append(img)
    print(f'merged {len(M)} trees: {n_maps} placements in the maps, {n_leg} in the legacy maps, {n_bio} biome weights; '
          f'{len(gone)} layer pictures deleted')


if __name__ == '__main__':
    main()
