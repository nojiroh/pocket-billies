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
import math
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
    # third part: the last trees (the larch keeps its tiered crown whole: 0 clumps) and the bushes (clumps, no trunk)
    'tree_willow': ('tree_willow', 7, [((73, 155), (71, 88), 24, 20), ((66, 86), (50, 62), 12, 6), ((78, 86), (96, 60), 12, 6)], False),
    'tree_larch': ('tree_larch', 0, [((44.5, 137), (45, 118), 11, 9), ((45, 120), (45, 40), 6, 2)], False),
    'bush_berry': ('bush_berry', 3, [], False),
    'bush_holly': ('bush_holly', 3, [], False),
    'bush_juniper': ('bush_juniper', 3, [], False),
    'bush_bramble': ('bush_bramble', 3, [], False),
    'bush_rosemary': ('bush_rosemary', 2, [], False),
    'bush_hawthorn': ('bush_hawthorn', 3, [], False),
    'bush_rhododendron': ('bush_rhododendron', 4, [], False),
}
# looks that are another tree's model with its leaves recoloured: key -> (the tree it uses)
AUTUMN = {'tree_hazel_autumn': 'tree_hazel', 'tree_poplar_autumn': 'tree_poplar', 'tree_beech_autumn': 'tree_beech'}

# the rest of the nature: modelled from shapes (the batch 1 tool's helpers), in the colours of their pictures
def hedge_recipe():
    """A clipped hedge: a leafy block with a rounded top, darker at the foot, a few sprigs breaking the line."""
    G, GL, GD = '#4E964E', '#83B271', '#436F4C'
    w, d, h = 3.6, 0.66, 1.05
    L = [B1.box(0, 0, 0, w, d, h * 0.25, GD, 'leaves', 'hedge foot'),
         B1.box(0, 0, h * 0.25, w, d, h * 0.62, G, 'leaves', 'hedge'),
         B1.limb((-w / 2, 0, h * 0.86), (w / 2, 0, h * 0.86), d / 2, d / 2, G, 'leaves', 'hedge top', 10)]
    for i in range(7):
        x = -w / 2 + 0.25 + (w - 0.5) * i / 6
        L.append(B1.sphere(x, -d / 2 + 0.04 + (i % 2) * 0.05, h * (0.35 + 0.4 * ((i * 37) % 5) / 5), 0.13, GL, 'leaves', 'sprig', 7, 3, 0.35))
        L.append(B1.sphere(x + 0.2, (i % 3 - 1) * 0.15, h + 0.12 + (i % 2) * 0.04, 0.12, GL if i % 2 else G, 'leaves', 'top sprig', 7, 3, 0.35))
    return {'ppm': PPM, 'cel': 0.7, 'layers': L}


def log_layers(x0, x1, z, r, y=0, moss=True, name='log'):
    BARK, END, MOSS = '#96684A', '#DBB27E', '#86B45A'
    L = [B1.limb((x0, y, z), (x1, y, z), r, r * 0.92, BARK, 'bark', name, 10),
         B1.limb((x1 - 0.01, y, z), (x1 + 0.03, y, z), r * 0.84, r * 0.84, END, 'plain', name + ' cut end', 10),
         B1.limb((x0 + 0.01, y, z), (x0 - 0.03, y, z), r * 0.9, r * 0.9, END, 'plain', name + ' cut end', 10)]
    if moss:
        for i, f in enumerate((0.2, 0.55, 0.8)):
            L.append(B1.sphere(x0 + (x1 - x0) * f, y, z + r * 0.75, r * 0.55, MOSS if i % 2 else '#76AA50', 'leaves', 'moss', 8, 3, 0.3, h=r * 0.5))
    return L


def fallen_recipe():
    """The fallen tree: a long mossy trunk, a broken stub of a branch and three little white toadstools."""
    L = log_layers(-2.05, 2.05, 0.27, 0.3, name='trunk')
    L.append(B1.limb((0.5, -0.05, 0.4), (0.8, -0.25, 0.85), 0.07, 0.04, '#96684A', 'bark', 'branch stub', 6))
    for x in (-1.3, -0.4, 1.1):
        L += [B1.cyl(x, -0.32, 0, 0.025, 0.12, '#F4F0E8', 'plain', 'toadstool stem', 6),
              B1.cyl(x, -0.32, 0.1, 0.07, 0.05, '#F4F0E8', 'plain', 'toadstool cap', 8, k='dome')]
    return {'ppm': PPM, 'cel': 0.7, 'layers': L}


def log_recipe():
    """A sawn log lying on the ground with a little branch sticking up."""
    L = log_layers(-1.15, 1.15, 0.36, 0.36, moss=False)
    L.append(B1.limb((0.6, 0, 0.6), (0.78, -0.05, 1.05), 0.06, 0.04, '#96684A', 'bark', 'twig', 6))
    L.append(B1.sphere(0.79, -0.06, 1.04, 0.045, '#76AA50', 'leaves', 'leaf', 6, 3))
    return {'ppm': PPM, 'cel': 0.7, 'layers': L}


def stump_recipe():
    """A tree stump: a bark cylinder with its rings on top, four roots into the ground and a tuft of moss."""
    BARK = '#96684A'
    L = [B1.cyl(0, 0, 0, 0.38, 0.5, BARK, 'bark', 'stump', 12),
         B1.cyl(0, 0, 0.5, 0.36, 0.02, '#DBB27E', 'rings', 'rings', 12)]
    for i in range(4):
        a = i * math.pi / 2 + 0.5
        L.append(B1.limb((math.cos(a) * 0.2, math.sin(a) * 0.2, 0.2), (math.cos(a) * 0.62, math.sin(a) * 0.62, -0.04), 0.13, 0.05, BARK, 'bark', 'root', 6))
    L.append(B1.sphere(-0.2, -0.3, 0.38, 0.13, '#86B45A', 'leaves', 'moss', 7, 3, 0.35, h=0.12))
    return {'ppm': PPM, 'cel': 0.7, 'layers': L}


def boulder_recipe():
    """The lichen boulder: one big faceted stone, two small ones at its foot, and spots of yellow lichen."""
    R = '#9C8C92'
    L = [B1.sphere(0, 0.05, -0.15, 1.05, R, 'rock', 'boulder', 8, 5, 0.3, h=1.7) | {'facet': 1, 'ry': 0.9},
         B1.sphere(-1.0, -0.25, -0.05, 0.32, '#766879', 'rock', 'stone', 7, 3, 0.3, h=0.45) | {'facet': 1},
         B1.sphere(1.0, -0.15, -0.05, 0.26, R, 'rock', 'stone', 7, 3, 0.3, h=0.36) | {'facet': 1}]
    rng = B1.np.random.default_rng(31)
    for i in range(9):
        a, k = rng.random() * math.pi - math.pi, 0.25 + rng.random() * 0.55
        rr = 1.05 * math.sqrt(1 - k * k)
        L.append(B1.sphere(math.cos(a) * rr, 0.05 + math.sin(a) * rr * 0.86, -0.15 + 0.85 + k * 0.8, 0.09 + rng.random() * 0.05,
                           '#D8B640' if i % 2 else '#B8A040', 'leaves', 'lichen', 6, 2, h=0.06))
    return {'ppm': PPM, 'cel': 0.75, 'layers': L}


def flat_rock_recipe():
    return {'ppm': PPM, 'cel': 0.75, 'layers': [
        B1.sphere(0, 0, -0.1, 1.1, '#9C8C92', 'rock', 'flat rock', 8, 4, 0.25, h=0.62) | {'facet': 1, 'ry': 0.7},
        B1.sphere(0.7, -0.35, -0.03, 0.2, '#766879', 'rock', 'pebble', 6, 3, 0.3, h=0.2) | {'facet': 1}]}


def stepping_recipe():
    """Stepping stones: three flat stones barely above the ground, to walk on."""
    L = []
    for i, (x, y, r) in enumerate(((-0.75, 0.05, 0.3), (0.0, -0.08, 0.34), (0.78, 0.04, 0.28))):
        L.append(B1.cyl(x, y, 0, r, 0.07, '#AAA6B4' if i % 2 else '#C4BDB9', 'rock', 'stepping stone', 9, ry=r * 0.8))
    return {'ppm': PPM, 'cel': 0.75, 'layers': L}


SHAPED = {'hedge': hedge_recipe, 'tree_fallen': fallen_recipe, 'log': log_recipe, 'stump': stump_recipe,
          'boulder_lichen': boulder_recipe, 'rock_flat': flat_rock_recipe, 'stepping': stepping_recipe}

ROWS = [
    ('flat plants', [(k, 0) for k in FLAT[:12]], None, 1.6),
    ('more flat plants', [(k, 0) for k in FLAT[12:26]], None, 1.6),
    ('rowan', [('tree_rowan', 0)] * 3, None, 4.5),
    ('blossom', [('tree_blossom', 0)] * 2, None, 5.5),
    ('hazel', [('tree_hazel', 0), ('tree_hazel_autumn', 0)], None, 4.5),
    ('birches', [('tree_birch', 0), ('tree_birch_b', 0), ('tree_birch_gold', 0), ('tree_poplar', 0), ('tree_poplar_autumn', 0)], None, 3.6),
    ('fruit and maple', [('tree_fruit', 0), ('tree_maple', 0), ('tree_beech_autumn', 0)], None, 6.0),
    ('elm and chestnut', [('tree_elm', 0), ('tree_chestnut', 0)], None, 7.5),
    ('willow and larch', [('tree_willow', 0), ('tree_larch', 0), ('tree_fallen', 0)], None, 6.0),
    ('bushes', [(k, 0) for k in ('bush_berry', 'bush_holly', 'bush_juniper', 'bush_bramble', 'bush_rosemary', 'bush_hawthorn', 'bush_rhododendron')], None, 2.6),
    ('hedge and wood', [('hedge', 0), ('stump', 0), ('log', 0)], None, 4.2),
    ('stones', [('boulder_lichen', 0), ('rock_flat', 0), ('stepping', 0)], None, 3.6),
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
    for key, fn in SHAPED.items():
        built[key] = (B1.write_recipe(key, fn()),)
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
