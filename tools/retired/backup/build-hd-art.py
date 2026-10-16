#!/usr/bin/env python3
"""v34: the detailed pixel art. Every prop, prop layer, ground tile, animal or car sheet and battle prop gets a picture
of its own at twice the pixels (68 per metre for props, the same as the people), made from the current picture so
your edits carry over:

  1. Doubled with EPX (Scale2x): stair-stepped diagonals and curves come out smooth, flat areas stay flat.
  2. Outlines thinned to one fine pixel and coloured from what they enclose ("sel-out"): darker on the shadow side
     (bottom, right), lighter where the sun comes from (top, left), so things read as solid, not stickered.
  3. Lines inside a picture (cracks, planks, folds) thinned the same way, with a soft shade beside them.
  4. Material detail on flat areas only (hand-drawn detail is left alone): leaves, grain, speckle, sheen, weave.
  5. One shared palette: every colour is snapped to a master palette taken from all the art, and every shade comes
     from the same hue-shifted ramp (shadows cooler, light warmer), so all the sets look like one hand made them.

The originals are never touched: the new pictures go to game/art/hd/<same path>, and game/data/hdart.js lists them.
A picture that's already there is only made again when it is still exactly what this tool made last time (recorded
in game/art/hd/made.json), so a 2x picture you painted over by hand is kept.

    python3 tools/build-hd-art.py            # everything missing or out of date
    python3 tools/build-hd-art.py --only scene/props/crate.png
    python3 tools/build-hd-art.py --sheet out.png   # a before/after sheet for checking
"""
import argparse, hashlib, json, re, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'game' / 'art'
HD = ART / 'hd'
LIST = ROOT / 'game' / 'data' / 'hdart.js'
MADE = HD / 'made.json'
VERSION = 1
SETS = ['scene/props', 'scene/props/layers', 'scene/tiles', 'scene/life', 'battle/props']
TILED = ('scene/tiles',)

MATS = [  # same groups the 3D renderer uses (diorama-gl.js dglMatOf), plus a few
    ('building', r'house|shop|clinic|lab|bunker|tent|stall|windmill|busstop|bus_shelter|kiosk|apartment|hall|villa|chalet|mart|cafe|boutique|tower|townhouse|city_hall|bank|museum|station|hotel|office|gym|school|library|store'),
    ('crystal', r'crystal|glass|coral|ice'),
    ('foliage', r'tree|bush|hedge|flower|reed|cattail|lily|grass|crop|seaweed|cactus|mushroom|vine|plant|hay|fern|leaves|ivy|palm|moss|bamboo'),
    ('metal', r'lamp|lantern|pipe|derrick|tire|scrap|bin|trash|escal|salesign|cartS|pretzel|mailbox|flag|car_|bike|hydrant|meter|bollard|vending|phone|traffic|truck|bus|rack|metal|sign_metal'),
    ('stone', r'rock|boulder|well|fountain|statue|stalag|mesa|stepping|planter|flowerpot|cave|arch|basalt|obsidian|column|pillar|stone|pebble|cobble|brick|wall|marble|concrete|ash|lava|granite|gravel|asphalt|paving|tile'),
    ('wood', r'fence|bench|sign|crate|barrel|log|stump|cart|picnic|table|campfire|chair|board|plank|dock|deck|shelf|bookshelf|firewood|wood|beehive|birdhouse|wheelbarrow'),
    ('fabric', r'umbrella|tent|banner|laundry|awning|rug|carpet|towel|sack|pillow|bed|sofa|curtain'),
    ('earth', r'dirt|sand|mud|soil|path|farm|field|snow|beach|dune'),
    ('water', r'water|pond|pool|sea|river|deep'),
    ('animal', r'cat|chicken|crab|duck|frog|goat|gull|lizard|pigeon|rabbit|sheep|squirrel|dog|cow|horse|bird'),
]

def material(rel):
    n = Path(rel).stem.lower()
    for m, rx in MATS:
        if re.search(rx, n): return m
    return 'plain'

def h32(a):  # per-pixel hash in [0,1) from integer coordinate arrays
    x = a.astype(np.uint64)
    x = (x * np.uint64(0x9E3779B1)) & np.uint64(0xFFFFFFFF)
    x ^= x >> np.uint64(15); x = (x * np.uint64(0x85EBCA77)) & np.uint64(0xFFFFFFFF); x ^= x >> np.uint64(13)
    return (x & np.uint64(0xFFFFFF)).astype(np.float64) / float(0x1000000)

def hxy(x, y, s=0):
    return h32(x.astype(np.int64) * 73856093 ^ y.astype(np.int64) * 19349663 ^ (s * 83492791))

# ---------- colour: master palette and the shared ramp ----------
def lum(c):
    return c[..., 0] * .3 + c[..., 1] * .59 + c[..., 2] * .11

def ramp(c, s):
    """the shared ramp: s steps darker (negative) or lighter (positive). Darker steps lean cool and a touch richer,
    lighter steps lean warm and a touch paler, the way the hand-painted sets already do."""
    c = c.astype(np.float64) / 255.
    s = np.asarray(s, dtype=np.float64)
    if s.ndim: s = s[..., None]
    dk = np.clip(-s, 0, None); lt = np.clip(s, 0, None)
    out = c * (.86 ** dk)
    out = out * (1 + np.array([-.035, -.02, .05]) * dk)          # cooler shadow
    L = lum(out)[..., None]
    out = L + (out - L) * (1 + .06 * dk)                            # a little richer in shadow
    out = out + (1 - out) * (1 - .88 ** lt)
    out = out * (1 + np.array([.03, .015, -.04]) * lt)              # warmer light
    L = lum(out)[..., None]
    out = L + (out - L) * (1 - .08 * lt)
    return np.clip(np.round(out * 255), 0, 255).astype(np.uint8)

def build_palette(files, k=128):
    cols = []
    for f in files:
        a = np.asarray(Image.open(f).convert('RGBA'))
        m = a[..., 3] > 127
        cols.append(a[m][:, :3])
    c = np.concatenate(cols).astype(np.int32)
    key = (c[:, 0] << 16) | (c[:, 1] << 8) | c[:, 2]
    u, n = np.unique(key, return_counts=True)
    U = np.stack([(u >> 16) & 255, (u >> 8) & 255, u & 255], 1).astype(np.float64)
    W = n.astype(np.float64)
    # k-means (weighted), seeded from the most used colours spread apart
    rng = np.random.default_rng(34)
    order = np.argsort(-W)
    C = [U[order[0]]]
    for i in order[1:]:
        if len(C) >= k: break
        if np.min(np.sum((np.array(C) - U[i]) ** 2, 1)) > 18 ** 2: C.append(U[i])
    while len(C) < k: C.append(U[rng.integers(len(U))])
    C = np.array(C)
    for _ in range(12):
        d = np.sum((U[:, None, :] - C[None, :, :]) ** 2, 2)
        a = np.argmin(d, 1)
        for j in range(k):
            s = a == j
            if s.any(): C[j] = np.sum(U[s] * W[s, None], 0) / np.sum(W[s])
    return np.round(C).astype(np.uint8)

def snap(rgb, P, tol=12.):
    """colours close to a master palette colour become it (tolerance in 0-255 units); distinct colours stay"""
    f = rgb.reshape(-1, 3).astype(np.float64)
    out = f.copy()
    for i in range(0, len(f), 65536):
        d = np.sum((f[i:i + 65536, None, :] - P[None].astype(np.float64)) ** 2, 2)
        j = np.argmin(d, 1); ok = d[np.arange(len(j)), j] <= tol * tol
        out[i:i + 65536][ok] = P[j[ok]]
    return out.reshape(rgb.shape).astype(np.uint8)

# ---------- the doubling ----------
def epx(a, wrap=False):
    k = (a[..., 0].astype(np.uint32) << 24) | (a[..., 1].astype(np.uint32) << 16) | (a[..., 2].astype(np.uint32) << 8) | a[..., 3]
    p = np.pad(k, 1, mode='wrap' if wrap else 'edge')
    P, A, B, C, D = k, p[:-2, 1:-1], p[1:-1, 2:], p[1:-1, :-2], p[2:, 1:-1]
    o1 = np.where((C == A) & (C != D) & (A != B), A, P)
    o2 = np.where((A == B) & (A != C) & (B != D), B, P)
    o3 = np.where((D == C) & (D != B) & (C != A), C, P)
    o4 = np.where((B == D) & (B != A) & (D != C), D, P)
    H, W = k.shape
    o = np.empty((H * 2, W * 2), np.uint32)
    o[0::2, 0::2], o[0::2, 1::2], o[1::2, 0::2], o[1::2, 1::2] = o1, o2, o3, o4
    return np.stack([(o >> 24) & 255, (o >> 16) & 255, (o >> 8) & 255, o & 255], -1).astype(np.uint8)

def shift(m, dy, dx, fill=0, wrap=False):
    if wrap: return np.roll(np.roll(m, dy, 0), dx, 1)
    o = np.full_like(m, fill)
    H, W = m.shape[:2]
    ys, yd = (slice(0, H - dy), slice(dy, H)) if dy >= 0 else (slice(-dy, H), slice(0, H + dy))
    xs, xd = (slice(0, W - dx), slice(dx, W)) if dx >= 0 else (slice(-dx, W), slice(0, W + dx))
    o[yd, xd] = m[ys, xs]
    return o

def box_mean(v, w, r):
    """mean of v over a (2r+1)^2 box, counting only where w>0"""
    from scipy.ndimage import uniform_filter
    s = uniform_filter(v * w[..., None], size=(2 * r + 1, 2 * r + 1, 1), mode='nearest')
    n = uniform_filter(w.astype(np.float64), size=2 * r + 1, mode='nearest')
    return s / np.maximum(n, 1e-6)[..., None], n

def hd(a1, rel, P):
    tiled = rel.startswith(TILED)
    mat = material(rel)
    a1 = a1.copy()
    a1[a1[..., 3] < 8] = 0
    a1[..., 3] = np.where(a1[..., 3] >= 128, 255, a1[..., 3])
    H1, W1 = a1.shape[:2]
    op1 = a1[..., 3] > 0
    L1 = lum(a1[..., :3].astype(np.float64))
    # 1x analysis: outline pixels, inner line pixels, flat pixels
    nb = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    edge1 = op1 & np.any([~shift(op1, dy, dx, False, tiled) for dy, dx in nb], 0) if not tiled else np.zeros_like(op1)
    Ln = np.stack([shift(L1, dy, dx, 0, tiled) for dy, dx in nb + [(-1, -1), (-1, 1), (1, -1), (1, 1)]])
    On = np.stack([shift(op1, dy, dx, False, tiled) for dy, dx in nb + [(-1, -1), (-1, 1), (1, -1), (1, 1)]])
    with np.errstate(all='ignore'):
        import warnings; warnings.simplefilter('ignore')
        med = np.nan_to_num(np.nanmedian(np.where(On, Ln, np.nan), 0), nan=0)
    line1 = op1 & ~edge1 & (L1 < med * .72 - 4)
    same = np.all([shift(a1, dy, dx, 0, tiled).view(np.uint32)[..., 0] == a1.view(np.uint32)[..., 0] for dy, dx in nb], 0)
    flat1 = op1 & same & ~edge1 & ~line1

    a = epx(a1, tiled)
    rgb = snap(a[..., :3], P)
    al = a[..., 3]
    H, W = al.shape
    up = lambda m: np.repeat(np.repeat(m, 2, 0), 2, 1)
    op = al > 0
    yy, xx = np.mgrid[0:H, 0:W]
    lvl = np.zeros((H, W), np.float64)  # ramp steps to apply
    base = rgb.copy()

    # 2. outlines: the outer ring at 2x is the outline, the ring inside it (the old outline's second pixel) becomes fill
    if not tiled:
        ring1 = op & np.any([~shift(op, dy, dx, False) for dy, dx in nb], 0)
        inner = op & ~ring1
        ring2 = inner & np.any([~shift(inner, dy, dx, False) for dy, dx in nb], 0)
        core = inner & ~ring2
        Lc = lum(rgb.astype(np.float64))
        fillw = (core & (Lc > 40)).astype(np.float64)
        fill, n = box_mean(rgb.astype(np.float64), fillw, 3)
        fill2, n2 = box_mean(rgb.astype(np.float64), fillw, 6)
        fill = np.where((n > .02)[..., None], fill, fill2)
        has = (n > .02) | (n2 > .005)
        Lf = lum(fill)
        dark_edge = up(edge1) & (Lc < Lf * .7) & has
        # the old outline's inner pixel, where it is still outline-dark, takes the colour beside it inside
        r2 = ring2 & dark_edge & up(edge1)
        nearest = rgb.copy()
        for dy, dx in nb:
            s = shift(rgb, dy, dx, 0)
            ok = shift(core, dy, dx, False) & r2
            nearest[ok] = s[ok]
        still = r2 & (lum(nearest.astype(np.float64)) < Lf * .7)
        nearest[still] = np.round(fill[still]).astype(np.uint8)
        base[r2] = nearest[r2]
        lvl[r2] = -1
        # sel-out: the outline takes the enclosed colour, darker on the shadow side
        o = ring1 & has & (Lc < Lf * .75)
        lit = (~shift(op, 1, 0, False)) | (~shift(op, 0, 1, False))     # open above or to the left
        floor = ~shift(op, -1, 0, False)                                  # open below: the foot keeps it darkest
        selc = np.round(fill).astype(np.uint8)
        base[o] = selc[o]
        lvl[o] = np.where(floor[o], -5.6, np.where(lit[o], -4, -5))
        # very dark or black things keep their own outline
        keep = o & (Lf < 46)
        base[keep] = rgb[keep]; lvl[keep] = 0

    # 3. inner lines: one pixel of the doubled line stays (top left), the rest shades the fill beside it
    if line1.any():
        L2 = up(line1)
        sub = (yy % 2) * 2 + (xx % 2)  # 0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right
        for sb, (dy, dx) in ((1, (0, -1)), (2, (-1, 0)), (3, (-1, -1))):
            m = L2 & (sub == sb)
            nbr = shift(rgb, dy * 2, dx * 2, 0, tiled)
            nbl = shift(up(line1), dy * 2, dx * 2, False, tiled)
            nbo = shift(op, dy * 2, dx * 2, False, tiled)
            ok = m & ~nbl & nbo & (lum(nbr.astype(np.float64)) > lum(rgb.astype(np.float64)) + 18)
            base[ok] = nbr[ok]; lvl[ok] = -1.3

    # 4. material detail, on flat areas only
    F = up(flat1) & op
    n0 = hxy(xx, yy, 1); n1 = hxy(xx // 2, yy // 2, 2); n2 = hxy(xx // 3, yy // 3, 3)
    d = np.zeros((H, W))
    sub = (yy % 2) * 2 + (xx % 2)
    if mat == 'foliage':
        # small leaves: a lit pixel up-left in some 2x2 cells, a shaded one down-right in others, a rare bright leaf
        d += np.where((n1 < .16) & (sub == 0), 1, 0) - np.where((n1 > .84) & (sub == 3), 1, 0)
        d += np.where(n0 < .015, 1.5, 0)
    elif mat == 'wood':
        wide = W >= H * .8
        g = (yy if wide else xx) + np.floor(hxy((xx if wide else yy) // 9, (yy if wide else xx) // 5, 4) * 3)
        d += np.where((g % 5 == 0) & (n1 > .25), -.8, 0) + np.where((g % 5 == 2) & (n0 < .18), .6, 0)
        d += np.where(n0 > .985, -1.5, 0)  # a knot now and then
    elif mat in ('stone', 'earth'):
        # pits and grains: a dark pixel with a lit rim above it, here and there
        d += np.where((n1 > .91) & (sub == 3), -1, 0) + np.where((n1 > .91) & (sub == 0), .5, 0)
        d += np.where(n0 < .02, .8, 0)
    elif mat == 'metal':
        band = ((xx + yy // 3) % 11 == 0) | ((xx + yy // 3) % 11 == 1)
        d += np.where(band & (n1 > .2), .8, 0) - np.where(n0 > .975, .6, 0)
    elif mat == 'building':
        d += np.where((n1 > .95) & (sub == 3), -.5, 0) + np.where(n0 < .012, .5, 0)
    elif mat == 'fabric':
        d += np.where(((xx + yy) % 2 == 0) & (n1 > .4), -.45, 0)
    elif mat == 'crystal':
        d += np.where(((xx - yy) % 7 == 0) & (n1 > .3), 1.2, 0)
    elif mat == 'water':
        d += np.where(((xx + 2 * yy) % 9 == 0) & (n2 > .5), .9, 0)
    elif mat == 'animal':
        d += np.where(n0 < .05, .5, 0) - np.where(n0 > .96, .5, 0)
    else:
        d += np.where(n0 < .04, .5, 0) - np.where(n0 > .96, .5, 0)
    lvl = np.where(F, lvl + d, lvl)

    out = np.zeros((H, W, 4), np.uint8)
    steps = np.round(lvl * 2) / 2
    out[..., :3] = np.where((steps != 0)[..., None], ramp(base, steps), base)
    out[..., 3] = al
    out[al == 0] = 0
    return out

def made_hash(p):
    return hashlib.sha1(p.read_bytes()).hexdigest()[:16]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', action='append', default=[])
    ap.add_argument('--force', action='store_true', help='make again even pictures that were painted over by hand')
    ap.add_argument('--sheet')
    a = ap.parse_args()
    files = []
    for s in SETS:
        files += sorted((ART / s).glob('*.png'))
    rels = [f.relative_to(ART).as_posix() for f in files]
    palf = HD / 'palette.png'
    if palf.exists():
        P = np.asarray(Image.open(palf).convert('RGB')).reshape(-1, 3)
    else:
        P = build_palette(files)
        HD.mkdir(parents=True, exist_ok=True)
        Image.fromarray(P.reshape(8, -1, 3)).save(palf)
    made = json.loads(MADE.read_text()) if MADE.exists() else {}
    todo = [r for r in rels if not a.only or r in a.only]
    n = kept = 0
    for r in todo:
        src = ART / r; dst = HD / r
        srch = made_hash(src)
        rec = made.get(r)
        if dst.exists() and not a.force:
            if rec and rec.get('src') == srch and rec.get('v') == VERSION: continue          # up to date
            if (not rec or rec.get('out') != made_hash(dst)): kept += 1; continue  # painted over by hand: kept
        im = np.asarray(Image.open(src).convert('RGBA'))
        o = hd(im, r, P)
        dst.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(o).save(dst, optimize=True)
        made[r] = {'src': srch, 'out': made_hash(dst), 'v': VERSION, 'size': [im.shape[1], im.shape[0]]}
        n += 1
    MADE.write_text(json.dumps(made, indent=0, sort_keys=True))
    have = sorted(r for r in rels if (HD / r).exists())
    LIST.write_text('/* v34: the detailed (2x) pictures in art/hd/, made by tools/build-hd-art.py. Generated: edit the pictures, not this list. */\n'
                    'window.NW_HD=' + json.dumps({r: made.get(r, {}).get('size') for r in have}, separators=(',', ':')) + ';\n', encoding='utf-8')
    print(f'{n} made, {kept} kept (painted over by hand), {len(have)} listed')
    if a.sheet:
        pick = [r for r in rels if (HD / r).exists() and any(k in r for k in ('bench_wood', 'boulder.png', 'bush_round.png', 'crate.png', 'fountain', 'lamp_post', 'apartment_a', 'tree_oak', 'flowers_red', 'tiles/grass.png', 'tiles/cobble', 'life/sheep', 'battle/props/tree'))][:14]
        tiles = []
        for r in pick:
            s = Image.open(ART / r).convert('RGBA'); h = Image.open(HD / r).convert('RGBA')
            z = 2 if s.width > 60 else 4
            s2 = s.resize((s.width * 2 * z, s.height * 2 * z), Image.NEAREST); h2 = h.resize((h.width * z, h.height * z), Image.NEAREST)
            t = Image.new('RGBA', (s2.width * 2 + 12, s2.height), (196, 200, 214, 255)); t.paste(s2, (0, 0), s2); t.paste(h2, (s2.width + 12, 0), h2); tiles.append(t)
        Wd = max(t.width for t in tiles); Ht = sum(t.height + 10 for t in tiles)
        sheet = Image.new('RGBA', (Wd, Ht), (170, 176, 192, 255)); y = 0
        for t in tiles: sheet.paste(t, (0, y)); y += t.height + 10
        sheet.save(a.sheet)

if __name__ == '__main__':
    main()
