#!/usr/bin/env python3
"""Phase 09: variants of the flat plants the first playable cut uses (Copperleaf, its rooms, and the generated routes
of the finished biomes: meadow, lake, thicket, ridge, autumn), so a place gets its variety from drawings instead of
scaling pictures (placement `s` and the renderer's random size resample the picture and break the 32 px/m grid).
Trees, shrubs, rocks and furniture are left out: they become models.

Every variant is drawn with the scene-prop kit itself, never resampled, in four forms per prop with a shape of its own:

  flowers (from the prop's own flower_bed / flower_patch call: bloom kind, colours, heights, leaf ramp)
    sprig    one young plant: a little rosette, two or three stems, a bud
    cluster  a rounded posy: blooms highest in the middle, a bud, a fallen petal
    drift    a wide, uneven patch: three leaf mounds (the back one in shade), blooms in groups, buds, grass blades
             coming through, petals fallen on the leaves
    tall     (tall kinds) a few long, leaning stems with leaves along them
    scatter  (low kinds) three separate rosettes across the ground
  grasses, reeds, iris, wheat, thistles: the prop's own drawing at other sizes, combined
    tuft     young and small
    clump    two tufts grown together, the back one in shade
    windswept  the blades leaning one way (the kit's own blade, with a wind bias)
    meadow   three tufts tapering away, with seeding stalks on the grasses
  ferns and bracken: fiddlehead (young fronds and curled fiddleheads), clump, spread, tall
  pads and ground cover (lying flat): single, pair, raft, trail
  low things standing up (molehills, roots, scree, nettles, horsetail, heather, the flowering bush): small, pair,
  row, big

Back parts are shaded one step down their own colour ramp (the kit's ramps), so depth stays inside the palette.

    python3 tools/build-flat-variants.py                 # pictures and the variants in game/data
    python3 tools/build-flat-variants.py --sheet out.png # also a contact sheet (each prop: as it is, then its forms)
    python3 tools/build-flat-variants.py --dry           # pictures and sheet only, game data untouched

Writes game/art/scene/props/<key>_<form>.png and the prop's `variants` in game/data/scenery.json: v 1..4 in the order
above, each with img, ox, oy, name, form, weight (how often the map generator picks it; the prop as drawn counts 1)
and span (its width over the prop's own, for the generator's footprint). Turns off the renderer's random size on these
props (vary.size 0) and puts them on 32 px/m. At size 1 the kit still draws today's pictures exactly (checked).
"""
import ast
import importlib.util
import inspect
import math
import os
import random
import re
import sys
import zlib

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
spec = importlib.util.spec_from_file_location('nat', os.path.join(HERE, 'build-nature-props.py'))
N = importlib.util.module_from_spec(spec); spec.loader.exec_module(N)
bsp = N.bsp
R, Cv, layer_out = bsp.R, bsp.Cv, bsp.layer_out
PROPS_DIR = os.path.join(ROOT, 'game', 'art', 'scene', 'props')

# ----------------------------------------------------------------------------------------------- which props, how
FLOWER_BED = """bluebells buttercups clover_white cornflowers crocuses daisies dandelion_clocks dandelions foxgloves lavender
lupins marigolds marsh_marigold poppies seedheads snowdrops sunflowers tulips_pink tulips_red tulips_yellow
water_mint""".split()
FLOWER_PATCH = 'flowers_blue flowers_mixed flowers_purple flowers_red flowers_white flowers_yellow'.split()
GRASS = 'tallgrass tallgrass_b tallgrass_c tussock tussock_rust sedge'.split()          # get seeding stalks
TUFTED = 'wild_wheat thistles bulrush cattails reeds iris_purple iris_yellow'.split()   # grass with heads or blooms
FERNS = 'bracken fern fern_b'.split()
PADS = 'lilypad pond_lily lily_flowers lotus_pink lotus_white duckweed moss_patch clover_patch fallen_leaves stones_flat'.split()
LOW = 'molehill roots scree nettles horsetail heather bush_flower'.split()
KEYS = FLOWER_BED + FLOWER_PATCH + GRASS + TUFTED + FERNS + PADS + LOW
# not here: crops (a crop row is one design; place it at 1) and flowers_meadow (no drawing code: a picture of its own)

FORMS = {
    'flower_tall': ('sprig', 'cluster', 'drift', 'tall'),
    'flower_low': ('sprig', 'cluster', 'drift', 'scatter'),
    'grass': ('tuft', 'clump', 'windswept', 'meadow'),
    'fern': ('fiddlehead', 'clump', 'spread', 'tall'),
    'pad': ('single', 'pair', 'raft', 'trail'),
    'low': ('small', 'pair', 'row', 'big'),
}
WEIGHT = dict(sprig=1.0, cluster=1.0, drift=0.6, tall=0.6, scatter=0.7, tuft=1.0, clump=1.0, windswept=0.8, meadow=0.5,
              fiddlehead=0.8, spread=0.7, single=1.0, pair=0.9, raft=0.5, trail=0.5, small=1.0, row=0.5, big=0.5)
LABEL = dict(sprig='sprig', cluster='cluster', drift='drift', tall='tall stems', scatter='scattered', tuft='young tuft',
             clump='clump', windswept='windswept', meadow='meadow', fiddlehead='fiddleheads', spread='spreading',
             single='single', pair='pair', raft='raft', trail='trail', small='small', row='row', big='big')


def family(key):
    if key in FLOWER_BED or key in FLOWER_PATCH:
        g = genes(key)
        return 'flower_tall' if g['hmax'] >= 12 else 'flower_low'
    if key in GRASS or key in TUFTED:
        return 'grass'
    if key in FERNS:
        return 'fern'
    if key in PADS:
        return 'pad'
    return 'low'


# ----------------------------------------------------------------------------------------------- the kit, scaled
LAYOUT = ('flower_bed', 'flower_patch', 'tuft', 'iris', 'lotus', 'shrub', 'heads', 'rock_pile')
KEEP_KW = {'cell', 'width', 'w', 'size', 'cap', 'dr', 'bump', 'bias', 'floor', 'base_t', 'centre', 'sprigs', 'steps'}
TWO_PI = (6.28, 6.283, 6.2832)
SOURCES = ['build-nature-props.py', 'build-scene-props.py'] + sorted(
    f for f in os.listdir(HERE) if f.startswith('scene_props_v') and f.endswith('.py'))
DEFS = {}
for _f in SOURCES:
    for _n in ast.walk(ast.parse(open(os.path.join(HERE, _f)).read())):
        if isinstance(_n, ast.FunctionDef):
            DEFS.setdefault(_n.name, _n)


class Scale(ast.NodeTransformer):
    """multiply a drawing's layout numbers (literals above 5) by f; counts in range() by f (f*f lying flat); pixel
    motifs (offset tuples, tone indices, a pattern's period, the kit's pixel-size arguments) stay as they are"""

    def __init__(s, f, area):
        s.f, s.area = f, area

    def keep(s, name):            # shrinking keeps the canvas, so nothing drawn round the layout is cut off
        return s.f < 1 and name in ('W', 'H')

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

    def visit_Assign(s, node):
        t = node.targets[0]
        if isinstance(t, ast.Tuple) and isinstance(node.value, ast.Tuple) and len(t.elts) == len(node.value.elts):
            node.value.elts = [v if isinstance(n, ast.Name) and s.keep(n.id) else s.visit(v) for n, v in zip(t.elts, node.value.elts)]
            return node
        if isinstance(t, ast.Name) and s.keep(t.id):
            return node
        node.value = s.visit(node.value)
        return node

    def visit_Subscript(s, node):
        node.value = s.visit(node.value)
        return node

    def visit_BinOp(s, node):
        node.left = s.visit(node.left)
        if not isinstance(node.op, (ast.Mod, ast.Pow)):
            node.right = s.visit(node.right)
        return node

    def visit_Tuple(s, node):
        e = node.elts
        if len(e) == 3 and isinstance(e[2], ast.Constant) and isinstance(e[2].value, int) and 0 <= e[2].value <= 4:
            return node
        return s.generic_visit(node)

    def visit_Call(s, node):
        name = node.func.id if isinstance(node.func, ast.Name) else node.func.attr if isinstance(node.func, ast.Attribute) else ''
        if name in ('ramp', 'choice'):
            return node
        if name == 'range':
            a = node.args
            if len(a) == 1:
                a[0] = s.scale_node(a[0], count=True)
            else:
                a[0] = s.visit(a[0]); a[1] = s.visit(a[1])
            return node
        node.func = s.visit(node.func)
        names = [a.arg for a in DEFS[name].args.args] if name in DEFS else []
        node.args = [x if (i < len(names) and (names[i] in KEEP_KW or s.keep(names[i]))) else s.visit(x)
                     for i, x in enumerate(node.args)]      # positional W, H, width... by the helper's own names
        for kw in node.keywords:
            if kw.arg not in KEEP_KW and not s.keep(kw.arg):
                kw.value = s.visit(kw.value)
        return node

    def visit_FunctionDef(s, node):
        node.decorator_list = []
        a = node.args
        for i, d in enumerate(a.defaults):
            arg = a.args[len(a.args) - len(a.defaults) + i].arg
            if arg not in KEEP_KW and not s.keep(arg):
                a.defaults[i] = s.visit(d)
        node.body = [s.visit(b) for b in node.body]
        return node


GRASS_LEAN = 'lean = (f - 0.5) * 14 + rng.uniform(-3, 3)'


class MCv(Cv):
    """the kit's canvas with a hidden margin all round: the drawing code keeps its own coordinates (0..w-1), and
    whatever a variant draws past the edge (a blade in the wind, a pad moved out) lands in the margin, not lost"""
    M = 32

    def __init__(s, w, h):
        super().__init__(w, h)
        s.rw, s.rh = w + 2 * s.M, h + 2 * s.M
        s.a = [None] * (s.rw * s.rh)

    def ok(s, x, y):
        return -s.M <= x < s.w + s.M and -s.M <= y < s.h + s.M

    def get(s, x, y):
        return s.a[(y + s.M) * s.rw + x + s.M] if s.ok(x, y) else None

    def px(s, x, y, c):
        if c is not None and s.ok(x, y):
            s.a[(y + s.M) * s.rw + x + s.M] = c

    def cells(s):
        for i, c in enumerate(s.a):
            yield i % s.rw - s.M, i // s.rw - s.M, c

    def paste(s, o, dx=0, dy=0):
        if isinstance(o, MCv):
            for x, y, c in o.cells():
                if c is not None: s.px(x + dx, y + dy, c)
        else:
            Cv.paste(s, o, dx, dy)

    def outline(s, col=None, diag=False):
        nb = ((1, 0), (-1, 0), (0, 1), (0, -1)) + (((1, 1), (-1, 1), (1, -1), (-1, -1)) if diag else ())
        add = []
        for x, y, c in s.cells():
            if c is None:
                for ax, ay in nb:
                    n = s.get(x + ax, y + ay)
                    if n is not None:
                        add.append((x, y, col or bsp.olc(n))); break
        for x, y, c in add:
            s.px(x, y, c)
        return s

    def plain(s, bx):
        """a plain canvas of the whole thing, margin included; the ground row kept as gy"""
        out = Cv(s.rw, s.rh); out.a = list(s.a); out.gy = s.M + s.h - 2
        return out, bx + s.M


def foliage_px_m(cv, pal, below=None):
    cols = set(tuple(c) for c in pal)
    return [(x, y) for x, y, c in cv.cells() if c is not None and tuple(c) in cols and (below is None or y < below)]


class margins:
    """while drawing a variant, every canvas the kit makes has the margin"""

    def __enter__(s):
        s.old = (bsp.__dict__['Cv'], N.__dict__['Cv'], N.__dict__['foliage_px'])
        bsp.__dict__['Cv'] = N.__dict__['Cv'] = MCv; N.__dict__['foliage_px'] = foliage_px_m

    def __exit__(s, *a):
        bsp.__dict__['Cv'], N.__dict__['Cv'], N.__dict__['foliage_px'] = s.old


def entry(key):
    return N.NAT.get(key) or bsp.PROPS[key]


def render(key, f=1.0, salt='', wind=0.0, margin=True):
    """(canvas, anchor x) of the prop drawn by its own code with its layout scaled by f, the blades leaning by wind"""
    e = entry(key); fn = e['fn']
    ns = dict(fn.__globals__)
    area = bool(e.get('flat'))
    for h in LAYOUT:
        if h in DEFS and h in ns:
            t = Scale(f, area).visit(ast.parse(ast.unparse(DEFS[h])))
            exec(compile(ast.fix_missing_locations(t), h, 'exec'), ns)
    if wind:
        src = ast.unparse(DEFS['grass_tuft'])
        assert GRASS_LEAN in src, 'grass_tuft changed: update GRASS_LEAN'
        exec(src.replace(GRASS_LEAN, 'lean = (f - 0.5) * 5 + rng.uniform(-2, 2) + WIND'), ns)
        ns['WIND'] = wind
    t = Scale(f, area).visit(ast.parse(ast.unparse(DEFS[fn.__name__])))
    exec(compile(ast.fix_missing_locations(t), key, 'exec'), ns)
    rng = random.Random(zlib.crc32((key + salt).encode()))
    if not margin:
        return ns[fn.__name__](rng)
    ns['Cv'] = MCv; ns['foliage_px'] = foliage_px_m
    with margins():
        cv, bx = ns[fn.__name__](rng)
    return cv.plain(bx)


# ----------------------------------------------------------------------------------------------- colour and layers
RAMP_OF = {}
for _rp in R.values():
    for _i, _c in enumerate(_rp):
        RAMP_OF.setdefault(tuple(_c), (_rp, _i))


def shade(cv, steps=1):
    """one step down each colour's own ramp: the part further back, in the shade of the one in front"""
    for i, c in enumerate(cv.a):
        if c is not None and tuple(c) in RAMP_OF:
            rp, j = RAMP_OF[tuple(c)]
            cv.a[i] = rp[max(0, j - steps)]
    return cv


def content(cv):
    return bsp.bounds(cv)


def compose(parts, flat=False, chain=None):
    """parts back to front: (canvas, anchor x, dx, dy, shaded). Standing: anchors on one ground line (dy < 0 is
    further back). Lying flat: each part's middle at (dx, dy). chain: standing parts side by side in the order of
    their dx, each overlapping the one before by that share of the narrower one's drawn width (so they always join,
    however wide each drawing comes out)."""
    if chain is not None and not flat and len(parts) > 1:
        ext = []
        for (cv, bx, dx, dy, sh) in parts:
            x0, x1, _, _ = content(cv); ext.append((x0 - bx, x1 - bx))
        order = sorted(range(len(parts)), key=lambda i: parts[i][2])
        pos = {order[0]: 0.0}
        for a, b in zip(order, order[1:]):
            wa = ext[a][1] - ext[a][0] + 1; wb = ext[b][1] - ext[b][0] + 1
            pos[b] = pos[a] + ext[a][1] + 1 - chain * min(wa, wb) - ext[b][0]
        lo = min(pos[i] + ext[i][0] for i in pos); hi = max(pos[i] + ext[i][1] for i in pos)
        parts = [(cv, bx, pos[i] - (lo + hi) / 2, dy, sh) for i, (cv, bx, dx, dy, sh) in enumerate(parts)]
    placed = []
    for (cv, bx, dx, dy, sh) in parts:
        x0, x1, y0, y1 = content(cv)
        if flat:
            ax, ay = (x0 + x1 + 1) // 2, (y0 + y1 + 1) // 2
        else:
            ax, ay = bx, getattr(cv, 'gy', cv.h - 2)
        placed.append((cv, int(round(dx)) - ax, int(round(dy)) - ay, sh, (x0, x1, y0, y1)))
    lo_x = min(ox + b[0] for (_, ox, _, _, b) in placed); hi_x = max(ox + b[1] for (_, ox, _, _, b) in placed)
    lo_y = min(oy + b[2] for (_, _, oy, _, b) in placed); hi_y = max(oy + b[3] for (_, _, oy, _, b) in placed)
    half = max(-lo_x, hi_x + 1) + 12                    # room round it for stalks, shoots and petals
    W = 2 * half; top = -lo_y + 14; H = top + max(hi_y, 0) + 3
    big = Cv(W, H)
    for (cv, ox, oy, sh, _) in placed:
        lay = Cv(cv.w, cv.h); lay.a = list(cv.a)
        if sh: shade(lay, sh)
        big.paste(lay, half + ox, top + oy)
    return big, half


# ----------------------------------------------------------------------------------------------- flowers
def genes(key):
    """the prop's own flower_bed (or flower_patch) call: bloom kind, colours, heights, spread, leaf ramp"""
    if key in FLOWER_PATCH:
        src = ast.unparse(DEFS[entry(key)['fn'].__name__])
        col = ast.literal_eval(re.search(r"flower_patch\(rng, (.+)\)", src).group(1))
        return dict(kind='star', cols=col, n=8, hmin=1, hmax=11, rx=21, ry=5, Rl=R['leaf'], size=1, centre=None,
                    lean=False, stems=True, patch=True)
    rec = {}
    real = N.flower_bed; sig = inspect.signature(real)

    def fb(*a, **kw):
        b = sig.bind(*a, **kw); b.apply_defaults()
        rec.update({x: y for x, y in b.arguments.items() if x != 'rng'})
        return real(*a, **kw)
    fn = entry(key)['fn']; g = fn.__globals__; old = g['flower_bed']; g['flower_bed'] = fb
    try:
        fn(random.Random(1))
    finally:
        g['flower_bed'] = old
    rec['Rl'] = rec['Rl'] or R['leaf']
    rec['patch'] = False
    return rec


def colour_of(g, i):
    c = g['cols'][i % len(g['cols'])] if isinstance(g['cols'], list) else g['cols']
    return (R[c] if isinstance(c, str) else c), c


def centre_of(g, cname):
    if g['patch']:
        return R['yellow'][4] if cname != 'yellow' else R['coral'][3]
    return g['centre']


def bud(cv, x, y, Rf, Rl):
    lay = Cv(cv.w, cv.h)
    for (a, b, t) in ((0, -2, 4), (0, -1, 3), (1, -1, 2), (0, 0, 2), (1, 0, 1)):
        lay.px(x + a, y + b, Rf[t])
    lay.px(x - 1, y + 1, Rl[3]); lay.px(x + 2, y + 1, Rl[2])
    layer_out(cv, lay)


def stem_leaf(cv, x, y, side, Rl):
    for (a, b, t) in ((1, 0, 3 if side < 0 else 2), (2, -1, 3 if side < 0 else 2), (3, -1, 2 if side < 0 else 1), (2, 0, 2)):
        if cv.get(x + side * a, y + b) is None:
            cv.px(x + side * a, y + b, Rl[t])


def flower(key, form):
    g = genes(key)
    rng = random.Random(zlib.crc32((key + '|' + form).encode()))
    kind, Rl, rx0, ry0, n0, h0, h1 = g['kind'], g['Rl'], g['rx'], g['ry'], g['n'], g['hmin'], g['hmax']
    tall = form == 'tall'
    hmax = int(h1 * 1.6) if tall else h1
    W = int(rx0 * 4 + 60); H = hmax + 44 + 8 * g['size']; G = H - 2; cx = W // 2
    cv = Cv(W, H)
    mounds, groups, buds, petals, blades, leaves = [], [], 0, 0, 0, 0
    if form == 'sprig':
        r = max(5, rx0 * .3); mounds = [(0, r, max(2, ry0 - 2), 0)]
        groups = [(0, r * .8, 1 + rng.random() * 1.2, (h0 + h1) / 2, h1 * 1.05, 0)]; buds = 1
        leaves = 1 if h1 >= 12 else 0
    elif form == 'cluster':
        r = max(9, rx0 * .55); mounds = [(0, r, ry0, 0)]
        groups = [(0, r * .9, max(4, round(n0 * .75)), h0, h1 * 1.1, .55)]; buds = 1; petals = 1
    elif form == 'drift':
        mounds = [(-rx0 * .6, rx0 * .62, ry0, 1), (rx0 * .35, rx0 * .78, ry0 + 1, 0), (rx0 * 1.25, rx0 * .36, max(2, ry0 - 1), 0)]
        groups = [(-rx0 * .6, rx0 * .5, max(2, round(n0 * .45)), h0, h1, .2), (rx0 * .3, rx0 * .65, max(3, round(n0 * .8)), h0, h1 * 1.1, .3),
                  (rx0 * 1.25, rx0 * .3, max(1, round(n0 * .2)), h0 * .7, h1 * .7, 0)]
        buds = 2; petals = 3; blades = 4
    elif form == 'tall':
        r = max(8, rx0 * .45); mounds = [(0, r, ry0, 0)]
        groups = [(0, r * .9, max(3, round(n0 * .55)), h1 * 1.05, hmax, 0)]; buds = 1; blades = 3; leaves = 2
    elif form == 'scatter':
        for i, dx in enumerate((-rx0 * .8, rx0 * .05, rx0 * .85)):
            r = max(4, rx0 * (.22 if i != 1 else .3)) + rng.uniform(-1, 1)
            mounds.append((dx + rng.uniform(-2, 2), r, max(2, ry0 - 2), 1 if i == 0 else 0))
            groups.append((dx, r * .8, 1 + (i == 1) + rng.randint(0, 1), h0, h1, 0))
        buds = 1; petals = 1
    if g['kind'] == 'disc':
        leaves = max(leaves, 1)
    # leaf mounds, back to front (a mound in shade is further back, a little higher)
    for (dx, r, ry, sh) in mounds:
        lay = Cv(W, H)
        N.leaf_base(lay, int(cx + dx), G - (2 if sh else 0), r, ry, Rl, rng, sprigs=max(3, int(r / 2.4)))
        if sh: shade(lay, sh)
        cv.paste(lay)
    # grass blades coming through
    if blades:
        lay = Cv(W, H)
        for _ in range(2):                                # among the stems, never off on their own
            gx, spread = rng.choice([(g_[0], g_[1]) for g_ in groups])
            bx = cx + gx + rng.uniform(-spread, spread) * .7
            bsp.grass_tuft(lay, bx, G - 1, blades // 2 + 1, h0 + 4, min(h1 + 3, hmax * .8), 8, Rl, rng, width=2.4, base_t=(2, 3))
        layer_out(cv, lay)
    # stems, blooms and buds
    spots = []
    for (gx, spread, n, ha, hb, dome) in groups:
        n = max(1, int(round(n)))
        for i in range(n):
            u = (i + .5) / n - .5 if n > 1 else 0
            x = int(round(cx + gx + u * 2 * spread + rng.uniform(-1.5, 1.5)))
            h = rng.uniform(ha, hb) * (1 - dome * abs(u) * 2)
            spots.append((x, max(2, h)))
    rng.shuffle(spots)
    bud_ix = set(rng.sample(range(len(spots)), min(buds, max(0, len(spots) - 1)))) if len(spots) > 1 else set()
    spots.sort(key=lambda s: -s[1])                       # tallest first, so short ones overlap them
    base_top = G - ry0 + 1
    for i, (x, h) in enumerate(spots):
        y = int(base_top - h)
        lean = rng.choice([-2, -1, 1, 2]) if (g['lean'] or tall) else (rng.choice([-1, 0, 1]) if form == 'sprig' else 0)
        if g['stems']:
            N.stem(cv, x, base_top, y, Rl, lean=lean)
            if leaves:
                for k in range(leaves):
                    yy = base_top - int(h * (.35 + .3 * k)) ; side = 1 if (i + k) % 2 else -1
                    stem_leaf(cv, x + int(round(lean * (base_top - yy) / max(1, base_top - y))), yy, side, Rl)
        Rf, cname = colour_of(g, i)
        if i in bud_ix:
            bud(cv, x + lean, y + 2, Rf, Rl)
        else:
            N.bloom(cv, kind, x + lean, y, Rf, rng, centre=centre_of(g, cname), size=g['size'])
    # petals fallen on the leaves
    for _ in range(petals * 6):
        if petals <= 0: break
        x = int(cx + rng.uniform(-rx0 * .9, rx0 * 1.3)); y = G - rng.randint(1, 2)
        c = cv.get(x, y)
        if c is not None and tuple(c) in RAMP_OF and RAMP_OF[tuple(c)][0] is Rl and cv.get(x, y - 1) is not None:
            Rf, _ = colour_of(g, rng.randint(0, 5))
            cv.px(x, y, Rf[3]); petals -= 1
    if touches_edge(cv): CLIPPED.append((key, form, 'flower'))
    return cv, cx


# ----------------------------------------------------------------------------------------------- the others
def seeding(cv, bx, rng, n=3, pal='hay'):
    """seeding stalks just above a grass: a fine stem (no outline, as the kit draws flower stems) and a short
    outlined head of grains"""
    x0, x1, y0, y1 = content(cv)
    for _ in range(n):
        x = int(rng.uniform(x0 + (x1 - x0) * .25, x1 - (x1 - x0) * .25)); top = y0 - rng.randint(2, 5)
        lean = rng.choice([-1, 1])
        for y in range(top + 3, y1 - 2):
            xx = x + (lean if y < top + (y1 - top) // 3 else 0)
            if cv.get(xx, y) is None or y < y0 + 4:
                cv.px(xx, y, R[pal][1])
        lay = Cv(cv.w, cv.h)
        for k in range(4):
            lay.px(x + lean + (k % 2), top + 3 - k, R[pal][3 if k % 2 else 2])
        lay.px(x + lean, top - 1, R[pal][4])
        layer_out(cv, lay)
    return cv


def fiddleheads(cv, bx, rng, n=2, pal='lime'):
    """young fern shoots: a stalk bending over at the top into a tight curl"""
    x0, x1, y0, y1 = content(cv)
    Rp = R[pal]
    for i in range(n):
        s = 1 if i % 2 else -1
        x = int(bx + s * rng.uniform(1, max(2, (x1 - x0) / 2 - 2))); h = rng.randint(5, 8) + i; top = y0 + (y1 - y0) // 3 - h + 6
        lay = Cv(cv.w, cv.h)
        for y in range(top, y1 + 1):
            t = min(1, (y1 - y) / max(1, y1 - top))
            lay.px(x + int(round(s * 2 * t * t)), y, Rp[2 if t < .6 else 3])
        cx_ = x + s * 2
        for (a, b, t) in ((0, -1, 3), (0, -2, 4), (1, -3, 4), (2, -3, 3), (3, -2, 2), (3, -1, 2), (2, 0, 1), (1, -1, 1), (2, -1, 3)):
            lay.px(cx_ + s * (a - 1), top + b, Rp[t])
        layer_out(cv, lay)
    return cv


def width_of(key):
    cv, bx = render(key, margin=False)
    x0, x1, y0, y1 = content(cv)
    return x1 - x0 + 1, y1 - y0 + 1


def other(key, form):
    fam = family(key); flat = bool(entry(key).get('flat'))
    bw, bh = width_of(key)
    rng = random.Random(zlib.crc32((key + '|' + form).encode()))
    S = lambda f, i, wind=0.0: render(key, f, '|%s|%d' % (form, i), wind)

    def part(f, i, dx, dy=0, sh=0, wind=0.0):
        cv, bx = S(f, i, wind)
        if touches_edge(cv): CLIPPED.append((key, form, i))
        return (cv, bx, dx * bw, dy if not flat else dy * bh, sh)
    if fam == 'grass':
        wind = rng.choice([-1, 1]) * 7; chain = None
        if form == 'tuft':
            P = [part(.6, 0, 0)]
        elif form == 'clump':
            P = [part(.85, 0, -.2, -2, 1), part(.8, 1, .18)]; chain = .45
        elif form == 'windswept':
            P = [part(1.0, 0, 0, wind=wind)]
        else:  # meadow
            P = [part(.65, 0, -.5, -2, 1), part(1.05, 1, 0), part(.55, 2, .55, -1, 1)]; chain = .3
        cv, bx = compose(P, chain=chain)
        if key in GRASS and form in ('windswept', 'meadow'):
            seeding(cv, bx, rng, 3 if form == 'meadow' else 2, 'hay' if key != 'tussock_rust' else 'goldleaf')
        return cv, bx
    if fam == 'fern':
        if form == 'fiddlehead':
            cv, bx = compose([part(.7, 0, 0)])
            return fiddleheads(cv, bx, rng, 3, 'lime' if key != 'fern' else 'leafy'), bx
        if form == 'clump':
            return compose([part(.8, 0, -.22, -2, 1), part(.85, 1, .2)], chain=.4)
        if form == 'spread':
            return compose([part(.6, 0, -.45, -1, 1), part(.9, 1, 0), part(.6, 2, .45, -1, 1)], chain=.3)
        return compose([part(1.3, 0, 0)])
    if fam == 'pad':
        if form == 'single':
            return compose([part(.6, 0, 0, 0)], flat=True)
        if form == 'pair':
            return compose([part(.75, 0, -.28, -.18), part(.6, 1, .3, .2)], flat=True)
        if form == 'raft':
            return compose([part(.6, 0, -.42, -.25), part(.55, 1, .4, -.3), part(.85, 2, 0, .05), part(.5, 3, .5, .35)], flat=True)
        return compose([part(.8, 0, -.55, .1), part(.6, 1, 0, -.1), part(.45, 2, .48, -.25)], flat=True)
    # low things standing up
    if form == 'small':
        return compose([part(.6, 0, 0)])
    if form == 'pair':
        return compose([part(.75, 0, -.25, -2, 1), part(.65, 1, .25)], chain=.3)
    if form == 'row':
        return compose([part(.6, 0, -.45, -1, 1), part(.75, 1, 0), part(.5, 2, .42, -1, 1)], chain=.25)
    return compose([part(1.3, 0, 0)])


CLIPPED = []


def touches_edge(cv):
    x0, x1, y0, y1 = content(cv)
    return x0 <= 0 or y0 <= 0 or x1 >= cv.w - 1


def variant(key, form):
    if key in FLOWER_BED or key in FLOWER_PATCH:
        cv, bx = flower(key, form)
    else:
        cv, bx = other(key, form)
    return bsp.finish(cv, bx, entry(key)['flat'])


def anchor(key, img):
    w, h = img.size
    return -(w // 2), (-(h // 2) if entry(key)['flat'] else -(h - 1))


# ----------------------------------------------------------------------------------------------- build
def main():
    args = sys.argv[1:]
    sheet_path = args[args.index('--sheet') + 1] if '--sheet' in args else None
    only = [a for a in args if a in KEYS]
    dry = '--dry' in args
    import gamedata
    D = None if dry else gamedata.load()
    out, bad = {}, []
    for key in (only or KEYS):
        base = Image.open(os.path.join(PROPS_DIR, key + '.png')).convert('RGBA')
        cv, bx = render(key, margin=False)
        if bsp.finish(cv, bx, entry(key)['flat']).tobytes() != base.tobytes():
            bad.append(key); continue          # painted over or redrawn since: leave it to a person
        out[key] = {}
        rows = []
        for form in FORMS[family(key)]:
            img = variant(key, form)
            img.save(os.path.join(PROPS_DIR, f'{key}_{form}.png'), optimize=True)
            out[key][form] = img
            ox, oy = anchor(key, img)
            rows.append(dict(img=f'scene/props/{key}_{form}.png', ox=ox, oy=oy, form=form, weight=WEIGHT[form],
                             span=round(img.width / base.width, 2)))
        if D:
            M = D['scenery']['props'][key]
            for r in rows:
                r['name'] = f"{M['name']} ({LABEL[r['form']]})"
            M['variants'] = [r for r in (M.get('variants') or []) if not r.get('form') and not r.get('size')] + rows
            M['ppm'] = 32
            M['vary'] = dict(M.get('vary') or {}, size=0)
    if D:
        gamedata.save(D)
    if sheet_path:
        sheet(out, sheet_path)
    if CLIPPED: print('cut off by the canvas edge:', CLIPPED)
    print(f'{len(out)} props, {sum(len(v) for v in out.values())} pictures' + (f'; left alone (picture differs from its code): {", ".join(bad)}' if bad else ''))


def sheet(out, path, scale=3):
    cells = []
    for key, forms in out.items():
        base = Image.open(os.path.join(PROPS_DIR, key + '.png')).convert('RGBA')
        cells.append((key, [base] + list(forms.values())))
    W = 1900; x = y = 10; rowh = 0; placed = []
    for key, ims in cells:
        w = sum(i.width * scale + 10 for i in ims) + 24
        h = max(i.height * scale for i in ims) + 22
        if x + w > W: x = 10; y += rowh; rowh = 0
        placed.append((key, ims, x, y, h)); x += w; rowh = max(rowh, h)
    can = Image.new('RGBA', (W, y + rowh + 10), (196, 206, 182, 255)); d = ImageDraw.Draw(can)
    for key, ims, x0, y0, h in placed:
        xx = x0
        for n, im in enumerate(ims):
            j = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
            can.alpha_composite(j, (xx, y0 + h - 18 - j.height)); xx += j.width + 10
            if n == 0: d.line([(xx - 5, y0 + 6), (xx - 5, y0 + h - 20)], fill=(150, 160, 140, 255))
        d.text((x0, y0 + h - 15), key, fill=(30, 30, 30, 255))
    can.save(path)


if __name__ == '__main__':
    main()
