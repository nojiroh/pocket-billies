#!/usr/bin/env python3
"""Phase 09: a small and a large size of the flat plants the first playable cut uses (Copperleaf, its rooms, and the
generated routes of the finished biomes: meadow, lake, thicket, ridge, autumn), so places stop scaling pictures
(placement `s`), which breaks the 32 px/m grid. Trees, shrubs, rocks and furniture are left out: they become models.

Each size is drawn again by the prop's own drawing code (tools/build-nature-props.py, build-scene-props.py and the
scene_props_v*.py files it loads), not resampled: the layout of the drawing (canvas, spread, heights, ellipses, how
many stems, blades, fronds or pads) is scaled, while everything drawn pixel by pixel stays exactly as it is (blooms,
leaf clumps, blade and frond widths, tone patterns, outlines, the ramps). A bigger clump has more flowers, not bigger
flowers. At size 1 the code still gives today's pictures exactly (checked on every run).

    python3 tools/build-flat-sizes.py                 # write the pictures and the variants in game/data
    python3 tools/build-flat-sizes.py --sheet out.png # also a contact sheet (each prop: small, as it is, large)
    python3 tools/build-flat-sizes.py --dry           # pictures and sheet only, game data untouched

Also turns off the renderer's random size for these props (`vary.size: 0`; prop-look.js gives flowers up to 16%,
which resamples the picture like `s` does; colour and wear variety stay), and moves the few of these props still at 34 px/m to 32 (as batch 2 did for the rest: the picture is unchanged).

Writes game/art/scene/props/<key>_sm.png and <key>_lg.png and, in the catalogue (game/data/scenery.json), the prop's
`variants`: v 1 = small, v 2 = large (walk-view.js plainPropVariant: a variant replaces img, ox, oy, name). Each
size is a whole drawing, so a placement picks a size with `v` and keeps `s` at 1.
"""
import ast
import importlib.util
import json
import math
import os
import random
import sys
import zlib

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
spec = importlib.util.spec_from_file_location('nat', os.path.join(HERE, 'build-nature-props.py'))
N = importlib.util.module_from_spec(spec); spec.loader.exec_module(N)
bsp = N.bsp
PROPS_DIR = os.path.join(ROOT, 'game', 'art', 'scene', 'props')

SIZES = (('sm', 0.7, 'small'), ('lg', 1.4, 'large'))
# a gentler small size where the full-size heads would crowd a shorter clump
SIZE_OVERRIDE = {('sunflowers', 'sm'): 0.85}

# the flat plants of the first cut that stay flat (phase 09: flat plants stay flat at 32 px/m)
KEYS = """bluebells bracken bulrush bush_flower buttercups cattails clover_patch clover_white cornflowers crocuses
daisies dandelion_clocks dandelions duckweed fallen_leaves fern fern_b flowers_blue flowers_mixed flowers_purple
flowers_red flowers_white flowers_yellow foxgloves heather horsetail iris_purple iris_yellow lavender lily_flowers
lilypad lotus_pink lotus_white lupins marigolds marsh_marigold molehill moss_patch nettles pond_lily poppies reeds
roots scree sedge seedheads snowdrops stones_flat sunflowers tallgrass tallgrass_b tallgrass_c thistles tulips_pink
tulips_red tulips_yellow tussock tussock_rust water_mint wild_wheat""".split()

# not sized: crops (a crop row is one design; place it at 1) and flowers_meadow (no drawing code: a picture of its own)

# layout helpers drawn again at the new size; the motif helpers they call (bloom, stem, grass_tuft's blade, frond's
# leaflets, blob's clumps, leafy, tiny_flower, lily_bloom, ball) are not touched
LAYOUT = ('flower_bed', 'flower_patch', 'tuft', 'iris', 'lotus', 'shrub', 'heads', 'rock_pile')
# keyword arguments that are pixel-level sizes, never scaled
KEEP_KW = {'cell', 'width', 'w', 'size', 'cap', 'dr', 'bump', 'bias', 'floor', 'base_t', 'centre', 'sprigs', 'steps'}
NO_SCALE_CALLS = {'ramp', 'randint_tone'}
TWO_PI = (6.28, 6.283, 6.2832)

SOURCES = ['build-nature-props.py', 'build-scene-props.py'] + sorted(
    f for f in os.listdir(HERE) if f.startswith('scene_props_v') and f.endswith('.py'))
DEFS = {}
for f in SOURCES:
    src = open(os.path.join(HERE, f)).read()
    for n in ast.walk(ast.parse(src)):
        if isinstance(n, ast.FunctionDef):
            DEFS.setdefault(n.name, n)


class Scale(ast.NodeTransformer):
    """multiply the drawing's layout numbers (literals above 5) by f; counts in range() by f (or f*f on the ground)"""

    def __init__(s, f, area):
        s.f, s.area = f, area

    def keep_h(s, name):
        """when shrinking, the canvas keeps its size (G = H - 2 stays the ground line), so nothing drawn at full size
        round the scaled layout (a bloom, a cattail's head, a rock at the end of a pile) is cut off; finish() crops it"""
        return s.f < 1 and name in ('W', 'H')

    def visit_Assign(s, node):
        t = node.targets[0]
        if isinstance(t, ast.Tuple) and isinstance(node.value, ast.Tuple) and len(t.elts) == len(node.value.elts):
            node.value.elts = [v if isinstance(n, ast.Name) and s.keep_h(n.id) else s.visit(v) for n, v in zip(t.elts, node.value.elts)]
            return node
        if isinstance(t, ast.Name) and s.keep_h(t.id):
            return node
        node.value = s.visit(node.value)
        return node

    def num(s, v, count=False):
        f = s.f * s.f if (count and s.area) else s.f
        return max(1, int(round(v * f))) if isinstance(v, int) else v * f

    def scale_node(s, node, count=False):
        if isinstance(node, ast.Constant):
            v = node.value
            if isinstance(v, (int, float)) and not isinstance(v, bool) and abs(v) > 5 and v not in TWO_PI:
                return ast.copy_location(ast.Constant(s.num(v, count) if v > 0 else -s.num(-v, count)), node)
            return node
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
            node.operand = s.scale_node(node.operand, count)
            return node
        return s.visit(node)

    def visit_Constant(s, node):
        return s.scale_node(node)

    def visit_Subscript(s, node):           # R['leaf'][3], cv.a[i]: indices stay
        node.value = s.visit(node.value)
        return node

    def visit_BinOp(s, node):               # a pattern's period (x % 6) stays
        node.left = s.visit(node.left)
        if not isinstance(node.op, (ast.Mod, ast.Pow)):
            node.right = s.visit(node.right)
        return node

    def visit_Tuple(s, node):               # (dx, dy, tone) motif offsets stay
        e = node.elts
        if len(e) == 3 and isinstance(e[2], ast.Constant) and isinstance(e[2].value, int) and 0 <= e[2].value <= 4:
            return node
        return s.generic_visit(node)

    def visit_Call(s, node):
        name = node.func.id if isinstance(node.func, ast.Name) else node.func.attr if isinstance(node.func, ast.Attribute) else ''
        if name in NO_SCALE_CALLS or name == 'choice':
            return node
        if name == 'range':                 # how many: scaled as a count; a range's step stays
            a = node.args
            if len(a) == 1:
                a[0] = s.scale_node(a[0], count=True)
            else:
                a[0] = s.visit(a[0]); a[1] = s.visit(a[1])
            return node
        node.func = s.visit(node.func)
        node.args = [s.visit(x) for x in node.args]
        for kw in node.keywords:
            if kw.arg not in KEEP_KW and not s.keep_h(kw.arg):
                kw.value = s.visit(kw.value)
        return node

    def visit_FunctionDef(s, node):
        node.decorator_list = []
        a = node.args
        for i, d in enumerate(a.defaults):  # a helper's default sizes (flower_bed's W=56...) scale too
            arg = a.args[len(a.args) - len(a.defaults) + i].arg
            if arg not in KEEP_KW and not s.keep_h(arg):
                a.defaults[i] = s.visit(d)
        node.body = [s.visit(b) for b in node.body]
        return node


def entry(key):
    return N.NAT.get(key) or bsp.PROPS[key]


def scaled_fn(key, f):
    """the prop's drawing function, with its layout (and the layout helpers it calls) scaled by f"""
    e = entry(key); fn = e['fn']
    ns = dict(fn.__globals__)
    area = bool(e.get('flat'))
    for h in LAYOUT:
        if h in DEFS and h in ns:
            t = Scale(f, area).visit(ast.fix_missing_locations(ast.parse(ast.unparse(DEFS[h]))))
            exec(compile(ast.fix_missing_locations(t), h, 'exec'), ns)
    t = Scale(f, area).visit(ast.parse(ast.unparse(DEFS[fn.__name__])))
    exec(compile(ast.fix_missing_locations(t), key, 'exec'), ns)
    return ns[fn.__name__]


def draw(key, f, salt=''):
    e = entry(key)
    fn = e['fn'] if f == 1 else scaled_fn(key, f)
    rng = random.Random(zlib.crc32((key + salt).encode()))
    cv, bx = fn(rng)
    return cv, bx, bsp.finish(cv, bx, e['flat'])


def anchor(key, img):
    """ox, oy as the prop tools work them out: bottom centre upright, the middle when it lies flat"""
    w, h = img.size
    return -(w // 2), (-(h // 2) if entry(key)['flat'] else -(h - 1))


def main():
    args = sys.argv[1:]
    sheet_path = args[args.index('--sheet') + 1] if '--sheet' in args else None
    dry = '--dry' in args
    import gamedata
    D = gamedata.load(); C = D['scenery']['props']
    out, bad = {}, []
    for key in KEYS:
        base = Image.open(os.path.join(PROPS_DIR, key + '.png')).convert('RGBA')
        if draw(key, 1)[2].tobytes() != base.tobytes():
            bad.append(key); continue   # painted over or redrawn since: leave it to a person
        out[key] = {}
        for tag, f, label in SIZES:
            f = SIZE_OVERRIDE.get((key, tag), f)
            img = draw(key, f, '_' + tag)[2]
            img.save(os.path.join(PROPS_DIR, f'{key}_{tag}.png'), optimize=True)
            out[key][tag] = img
            if not dry:
                C[key]['ppm'] = 32          # the sizes are drawn on the 32 px/m grid; a few were still at 34
                C[key]['vary'] = dict(C[key].get('vary') or {}, size=0)  # no random size from Prop variety either
                ox, oy = anchor(key, img)
                V = C[key].setdefault('variants', [])
                row = dict(img=f'scene/props/{key}_{tag}.png', ox=ox, oy=oy, name=f"{C[key]['name']} ({label})", size=tag)
                for i, r in enumerate(V):
                    if r.get('size') == tag:
                        V[i] = row; break
                else:
                    V.append(row)
        if not dry:
            C[key]['variants'].sort(key=lambda r: {'sm': 0, 'lg': 1}.get(r.get('size'), 2))
    if not dry:
        gamedata.save(D)
    if sheet_path:
        sheet(out, sheet_path)
    print(f'{len(out)} props, {2 * len(out)} pictures' + (f'; left alone (picture differs from its code): {", ".join(bad)}' if bad else ''))


def sheet(out, path, scale=3):
    cells = []
    for key, sz in out.items():
        base = Image.open(os.path.join(PROPS_DIR, key + '.png')).convert('RGBA')
        cells.append((key, [sz['sm'], base, sz['lg']]))
    W = 1800; x = y = 10; rowh = 0; placed = []
    for key, ims in cells:
        w = sum(i.width * scale + 8 for i in ims) + 16
        h = max(i.height * scale for i in ims) + 22
        if x + w > W: x = 10; y += rowh; rowh = 0
        placed.append((key, ims, x, y, h)); x += w; rowh = max(rowh, h)
    can = Image.new('RGBA', (W, y + rowh + 10), (196, 206, 182, 255)); d = ImageDraw.Draw(can)
    for key, ims, x0, y0, h in placed:
        xx = x0
        for im in ims:
            j = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
            can.alpha_composite(j, (xx, y0 + h - 18 - j.height)); xx += j.width + 8
        d.text((x0, y0 + h - 15), key, fill=(30, 30, 30, 255))
    can.save(path)


if __name__ == '__main__':
    main()
