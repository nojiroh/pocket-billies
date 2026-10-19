#!/usr/bin/env python3
"""Phase 09, batch 2 (the first part of Copperleaf Town and Route 1 · Hedgerow Lane): props in the new style, swapped
straight in under their own keys, as batch 1's were (tools/build-props-batch1.py swap_in).

  1. The flat plants of the two places (flowers, grass, ferns, reeds, crops, fallen leaves...) stay flat on purpose:
     they only move to the new scale, 32 px to the metre, like the rest of the new style.
  2. The first trees, built with batch 1's tree tool: a trunk and arms traced from the drawing, roots, branches into
     the crown, the leaves one picture with clumps cut from it at run time (paint it in the Studio: Props → Leaves).
     rowan, blossom, hazel (a shrub of four stems) and the autumn hazel (the hazel with its leaves recoloured).

    python3 tools/build-props-batch2.py        # writes everything below; run it again after changing it

Writes game/art/scene/next/models/tree_*.json, game/art/scene/next/leaves/*.png, the catalogue entries in
game/data/scenery.json, and adds this batch's rows to the showcase map test_props_next. Run build-props-batch1.py
first if you run both (it rebuilds that map from its own rows only).
"""
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import gamedata  # noqa: E402

spec = importlib.util.spec_from_file_location('batch1', ROOT / 'tools' / 'build-props-batch1.py')
B1 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(B1)
PPM = B1.PPM

# 1. the flat plants of Copperleaf and Hedgerow Lane: only their scale changes
FLAT = '''flowers_purple buttercups clover_patch bracken flowers_meadow cornflowers daisies flowers_yellow fallen_leaves
nettles poppies flowers_red clover_white tussock lavender reeds moss_patch flowers_blue crops molehill dandelions cattails
bluebells snowdrops flowers_mixed fern_b bush_flower marigolds fern sedge dandelion_clocks horsetail heather wild_wheat
thistles flowers_white pond_lily lupins roots tulips_red marsh_marigold stones_flat foxgloves tulips_yellow tulips_pink
crocuses iris_purple lily_flowers wind_sail_flower iris_yellow chalk_sun sunflowers seedheads water_mint'''.split()

# 2. the trees: (picture, clumps, limbs as ((x, y) at the foot, (x, y) at the top, width there, width there), stems)
TREES = {
    'tree_rowan': ('tree_rowan', 6, [((48.5, 117), (48.5, 57), 14, 9), ((48, 60), (38, 40), 7, 4), ((49, 60), (60, 38), 7, 4)], False),
    'tree_blossom': ('tree_blossom', 7, [((65, 125), (64, 88), 15, 13), ((60, 86), (47, 68), 10, 6), ((70, 86), (81, 68), 10, 6)], False),
    'tree_hazel': ('tree_hazel', 6, [((33.5, 88), (27.5, 56), 6, 5), ((42.5, 88), (40.5, 56), 7, 5),
                                     ((53.5, 88), (55.5, 56), 7, 5), ((62.5, 88), (69.5, 56), 6, 5)], True),
    # second part
    'tree_elm': ('tree_elm', 9, [((84, 180), (83, 118), 24, 18), ((78, 110), (54, 86), 14, 7), ((88, 110), (89, 88), 12, 7)], False),
    'tree_chestnut': ('tree_chestnut', 9, [((90, 164), (90, 112), 28, 21), ((82, 104), (65, 84), 16, 8), ((96, 104), (98, 88), 12, 7)], False),
    'tree_maple': ('tree_maple', 8, [((70, 144), (70, 96), 24, 14), ((66, 90), (52, 78), 12, 7), ((74, 90), (90, 72), 12, 6)], False),
    'tree_fruit': ('tree_fruit', 6, [((52, 120), (51.5, 74), 14, 11), ((48, 72), (42, 60), 8, 5), ((56, 72), (62, 58), 8, 5)], False),
    'tree_birch': ('tree_birch', 5, [((34, 154), (33.5, 108), 9, 7), ((34, 110), (34, 85), 6, 3)], False),
    'tree_birch_b': ('tree_birch_b', 5, [((31.5, 166), (31, 96), 8, 4), ((43.5, 166), (46, 108), 6, 4)], True),
    'tree_birch_gold': ('tree_birch_gold', 6, [((48.5, 148), (49, 70), 10, 6), ((49, 72), (50, 50), 5, 3)], False),
    'tree_poplar': ('tree_poplar', 4, [((20.5, 175), (20.5, 143), 11, 9), ((20.5, 145), (20.5, 90), 6, 3)], False),
}
# looks that are another tree's model with its leaves recoloured: key -> (the tree it uses)
AUTUMN = {'tree_hazel_autumn': 'tree_hazel', 'tree_poplar_autumn': 'tree_poplar', 'tree_beech_autumn': 'tree_beech'}

ROWS = [
    ('flat plants', [(k, 0) for k in FLAT[:12]], None, 1.6),
    ('more flat plants', [(k, 0) for k in FLAT[12:26]], None, 1.6),
    ('rowan', [('tree_rowan', 0)] * 3, None, 4.5),
    ('blossom', [('tree_blossom', 0)] * 2, None, 5.5),
    ('hazel', [('tree_hazel', 0), ('tree_hazel_autumn', 0)], None, 4.5),
    ('birches', [('tree_birch', 0), ('tree_birch_b', 0), ('tree_birch_gold', 0), ('tree_poplar', 0), ('tree_poplar_autumn', 0)], None, 3.6),
    ('fruit and maple', [('tree_fruit', 0), ('tree_maple', 0), ('tree_beech_autumn', 0)], None, 6.0),
    ('elm and chestnut', [('tree_elm', 0), ('tree_chestnut', 0)], None, 7.5),
]


def main():
    leaves = B1.NEXT / 'leaves'
    D = gamedata.load()
    C = D['scenery']['props']
    n_flat = 0
    for k in FLAT:
        if k in C and C[k].get('ppm') != PPM:
            C[k]['ppm'] = PPM
            n_flat += 1
    built = {}
    for i, (key, (pic, k, limbs, stems)) in enumerate(TREES.items()):
        rec, sheet_path, sheet, canopy = B1.tree_recipe(key.replace('tree_', ''), pic, k, limbs, leaves, 400 + i, stems=stems)
        built[key] = (B1.write_recipe(key, rec), sheet_path, sheet)
    for key, base in AUTUMN.items():
        if base in built:
            model, sheet_path, sheet = built[base][:3]
        else:  # a tree an earlier batch built (the beech): its model and its leaf picture as they are
            model = C[base]['model']
            sheet_path = 'scene/next/leaves/' + base.replace('tree_', '') + '.png'
            sheet = B1.rgba(B1.ART / sheet_path)
        own = B1.rgba(B1.PROPS / f'{key}.png'); _, oc = B1.split_trunk(own)
        src = B1.rgba(B1.PROPS / f'{base}.png'); _, sc = B1.split_trunk(src)
        swapped = B1.save_png(B1.recolour(sheet, B1.leaf_colours(src, sc), B1.leaf_colours(own, oc)),
                              leaves / (key.replace('tree_', '') + '.png'))
        built[key] = (model, None, None, {sheet_path: swapped})
    for key, v in built.items():
        M = C[key]
        for f in ('layers', 'vol', 'volDepth', 'build'):
            M.pop(f, None)
        M['model'] = v[0]
        M['ppm'] = PPM
        if len(v) > 3:
            M['swap'] = v[3]
    # the showcase map: batch 1's rows, then this batch's
    B1.ROWS = B1.ROWS + ROWS
    D['maps']['test_props_next'] = B1.test_map(C)
    gamedata.save(D)
    print(f'{n_flat} flat props moved to {PPM} px/m; trees: {", ".join(built)}')


if __name__ == '__main__':
    main()
