"""v37 prop kit: world props drawn from scratch the way pixel artists build them, not filtered from the old art.
Trees are leaf clusters (scalloped lobes, a lit rim on top-left, a dark underside, a few hanging leaf tips), rocks are
faceted planes lit by their facing, roofs have a ridge, eaves and a thatch or tile texture, wood has grain and knots,
metal has a hard specular. Every drawing takes a STYLE dict that changes construction, not just colour:
  outline  'ink' | 'selout' | 'none' | 'soft'    tones 3|4|5   dither 0|1   rim 0|1 (crescent highlight on clusters)
  round    0..1 (lobes rounder or more angular)   hi 'spot'|'crescent'   warm 0|1 (warm highlight / cool shade push)
"""
import math, random, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixkit import Piece, C, P, INK, ramp_of
from PIL import Image, ImageDraw
import numpy as np

def st(S, key, d=None): return S.get(key, d)

# ---------------- primitives with style ----------------
def shade_tones(S, base, l, d):
    """tone for a lit-ness l (-1 dark .. 1 lit) at radial distance d (0 centre .. 1 edge)"""
    t = st(S, 'tones', 4)
    if t <= 3: return base - 1 if l < -.3 else base + 1 if l > .6 and d > .3 else base
    if t == 4: return base - 2 if (l < -.8 and d > .55) else base - 1 if l < -.33 else base + 1 if (l > .66 and d > .3) else base
    return base - 2 if (l < -.75 and d > .45) else base - 1 if l < -.25 else base + 2 if (l > .88 and d > .5) else base + 1 if (l > .5 and d > .25) else base

def lobe(pc, ramp, cx, cy, rx, ry, base, S, light=(-.55, -.83), scallop=0, seed=0, flat=False):
    """a leaf/rock lobe: an ellipse whose edge is scalloped by smaller bumps (scallop = bump count), shaded by style"""
    rng = random.Random(seed); bumps = [(rng.random() * 2 * math.pi, .78 + rng.random() * .3) for _ in range(scallop)]
    p = pc.im.load(); lx, ly = light; rd = st(S, 'round', .7)
    for y in range(max(0, int(cy - ry - 3)), min(pc.h, int(cy + ry + 4))):
        for x in range(max(0, int(cx - rx - 3)), min(pc.w, int(cx + rx + 4))):
            u, v = (x + .5 - cx) / rx, (y + .5 - cy) / ry; d = math.hypot(u, v)
            lim = 1.0
            if scallop:
                a = math.atan2(v, u)
                for ba, br in bumps:
                    da = abs((a - ba + math.pi) % (2 * math.pi) - math.pi)
                    if da < .55: lim = max(lim, 1 + .16 * (1 - da / .55) * (1 - rd * .4))
            if d > lim: continue
            l = -(u * lx + v * ly); tone = base if flat else shade_tones(S, base, l, d / lim)
            if st(S, 'dither') and not flat and abs(l) < .22 and d > .4 and (x + y) % 2 == 0: tone = base - 1 if l < 0 else base
            p[x, y] = C(ramp, tone)
    return pc

def facet_rock(pc, ramp, cx, cy, rx, ry, base, S, n=7, seed=0):
    """a rock as a Voronoi set of planes; each plane lit by the direction from the rock centre to its seed"""
    rng = random.Random(seed); seeds = [(cx + (rng.random() - .5) * rx * 1.6, cy + (rng.random() - .5) * ry * 1.5) for _ in range(n)]
    p = pc.im.load(); lx, ly = -.55, -.83
    for y in range(max(0, int(cy - ry - 1)), min(pc.h, int(cy + ry + 2))):
        for x in range(max(0, int(cx - rx - 1)), min(pc.w, int(cx + rx + 2))):
            u, v = (x + .5 - cx) / rx, (y + .5 - cy) / ry
            if u * u + v * v > 1 - .12 * math.sin(3 * math.atan2(v, u) + seed): continue
            ds = sorted((math.hypot(x - sx, y - sy), i) for i, (sx, sy) in enumerate(seeds)); d0, i0 = ds[0]; d1, i1 = ds[1]
            sx, sy = seeds[i0]; nx, ny = (sx - cx) / rx, (sy - cy) / ry; nl = math.hypot(nx, ny) or 1; l = -(nx / nl * lx + ny / nl * ly) * min(1, nl * 1.3)
            tone = shade_tones(S, base, l, .8)
            if (sy - cy) / ry < -.35 and l > -.2: tone = min(7, tone + 1)                 # planes that face up catch the sky
            if d1 - d0 < 1.1: tone = base - 2 if st(S, 'outline') != 'none' else base - 1   # the crack between planes
            p[x, y] = C(ramp, tone)
    return pc

def outline(pc, S, ink_ramps=()):
    o = st(S, 'outline', 'selout')
    if o == 'none': return pc
    src = pc.im.load(); out = pc.im.copy(); dst = out.load()
    for y in range(pc.h):
        for x in range(pc.w):
            if src[x, y][3] == 0: continue
            nb = [(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            edge = any(not (0 <= a < pc.w and 0 <= b < pc.h) or src[a, b][3] == 0 for a, b in nb)
            if not edge: continue
            if o == 'soft':   # only the shadow-side edge gets a line
                low = any(not (0 <= a < pc.w and 0 <= b < pc.h) or src[a, b][3] == 0 for a, b in ((x + 1, y), (x, y + 1)))
                if not low: continue
            r, s = ramp_of(src[x, y])
            dst[x, y] = INK if (o == 'ink' or r is None or r in ink_ramps) else C(r, 0)
    pc.im = out; return pc

# ---------------- props ----------------
def tree(S, kind='oak', seed=1):
    """a broadleaf tree built the way sprite artists build crowns: a big soft crown shape, then many small leaf clusters
    laid over it back to front (dark ones low and inside, lit ones high and to the left), dark gaps between clusters,
    a lit rim of leaf tips along the top-left, a few leaves hanging below, and a trunk with bark, root flare and a
    branch that shows in a gap"""
    W, H = 66, 90; pc = Piece(W, H); rng = random.Random(seed); leaf = 'leaf' if kind == 'oak' else 'pine' if kind == 'dark' else 'olive'
    bark = 'skin_deep' if kind != 'birch' else 'stone'; cx, cy, rx, ry = 33, 30, 25, 23
    # trunk first (the crown overlaps it)
    for y in range(40, H - 2):
        t = (y - 40) / (H - 42); w = 5 + t * t * 7 + (1.5 if kind == 'oak' else 0)
        for x in range(int(cx - w / 2), int(cx + w / 2) + 1):
            tone = 3 if x < cx - w * .15 else 2 if x < cx + w * .25 else 1
            if kind == 'birch': tone = 6 if x < cx + w * .2 else 4
            pc.dot(C(bark, tone), x, y)
    for k in range(6):
        y = 46 + k * 7 + rng.randrange(3); pc.dot(C(bark, 0 if kind == 'birch' else 1), int(cx - 2 + rng.randrange(3)), y, 2 + rng.randrange(3), 1)
    pc.dot(C(bark, 2), cx - 12, 36, 10, 2); pc.dot(C(bark, 1), cx - 12, 38, 10, 1); pc.dot(C(bark, 2), cx + 3, 42, 9, 2)   # branches into the crown
    # crown: the dark mass, then clusters
    lobe(pc, leaf, cx, cy + 2, rx, ry, 1, S, scallop=9, seed=seed, flat=True)
    cl = []
    for i in range(26):
        a = rng.random() * 2 * math.pi; r = math.sqrt(rng.random()) * .85
        x, y = cx + math.cos(a) * r * rx, cy + 2 + math.sin(a) * r * ry * .95
        lit = (-(x - cx) / rx * .6 - (y - cy) / ry * .8); cl.append((y + rng.random() * 4, x, y, 7 + rng.random() * 4, lit))
    cl.sort()
    for _, x, y, r, lit in cl:
        base = 2 if lit < -.3 else 3 if lit < .45 else 4
        lobe(pc, leaf, x, y, r, r * .78, base, S, scallop=5, seed=int(x * 7 + y))
        if lit > .2:   # a lit rim of leaf tips on the cluster's top-left
            for a2 in range(200, 320, 9):
                px_, py_ = int(x + math.cos(math.radians(a2)) * (r - 1)), int(y + math.sin(math.radians(a2)) * (r * .78 - 1))
                if 0 <= px_ < W and 0 <= py_ < H: pc.dot(C(leaf, min(7, base + 1)), px_, py_, 2, 1)
        if lit < -.2: pc.dot(C(leaf, 0), int(x + r * .3), int(y + r * .5), 2, 1)   # a dark gap under the cluster
    for _ in range(10):   # leaves hanging at the crown's lower edge
        x = rng.randrange(cx - rx + 4, cx + rx - 4); y = cy + 2 + int(ry * .95) - rng.randrange(0, 3)
        if 0 <= y + 2 < H and pc.im.load()[x, y][3]: pc.dot(C(leaf, 2), x, y + 1, 1, 2); pc.dot(C(leaf, 3), x, y, 1, 1)
    for x in range(cx - 12, cx + 12): pc.dot(C(leaf, 0), x, cy + 2 + int(ry * .95) - 2 + abs(x - cx) // 5, 1, 1)   # crown shadow over the trunk
    return outline(pc, S)

def bush(S, seed=2):
    pc = Piece(40, 28); rng = random.Random(seed)
    for i, (cx, cy, rx, ry, base, sc) in enumerate([(20, 17, 18, 9, 2, 6), (12, 13, 10, 8, 3, 5), (27, 12, 11, 8, 3, 5), (19, 9, 9, 7, 4, 5)]):
        lobe(pc, 'leaf', cx, cy, rx, ry, base, S, scallop=sc, seed=seed * 5 + i)
    for _ in range(4): pc.dot(C('rose', 4), rng.randrange(6, 34), rng.randrange(6, 20), 2, 2)
    return outline(pc, S)

def rock(S, seed=3):
    pc = Piece(44, 34); facet_rock(pc, 'stone', 22, 20, 20, 13, 3, S, n=8, seed=seed)
    for x in range(8, 30, 3): pc.dot(C('leaf', 3), x + (x // 3) % 2, 8 + (x % 5) // 2, 2, 1)   # moss on top
    return outline(pc, S)

def lamp(S):
    pc = Piece(18, 60); base = 'steel'
    pc.dot(C(base, 1), 6, 54, 6, 5); pc.dot(C(base, 2), 5, 56, 8, 3); pc.dot(C(base, 3), 7, 54, 2, 1)   # foot
    for y in range(16, 54): pc.dot(C(base, 2 if (y // 9) % 2 else 1), 8, y, 2, 1); pc.dot(C(base, 3), 8, y, 1, 1)   # post with rings
    pc.dot(C(base, 1), 7, 24, 4, 2); pc.dot(C(base, 1), 7, 40, 4, 2)
    pc.dot(C(base, 2), 4, 14, 10, 2); pc.dot(C(base, 1), 3, 16, 12, 1)                                       # cap
    for y in range(4, 14): pc.dot(C('gold', 6 if y < 9 else 5), 5, y, 8, 1)                                   # glass
    pc.dot(C('gold', 7), 6, 5, 2, 3); pc.dot(C(base, 1), 4, 4, 1, 10); pc.dot(C(base, 1), 13, 4, 1, 10)
    pc.dot(C(base, 2), 6, 2, 6, 2); pc.dot(C(base, 3), 8, 0, 2, 2)                                           # finial
    return outline(pc, S, ('gold',))

def bench(S):
    pc = Piece(46, 26); w = 'skin_deep'
    for i in range(3): pc.dot(C(w, 3 if i < 2 else 4), 6, 4 + i * 4, 34, 3); pc.dot(C(w, 1), 6, 6 + i * 4, 34, 1)   # back slats
    pc.dot(C(w, 4), 4, 16, 38, 4); pc.dot(C(w, 2), 4, 19, 38, 2)                                                   # seat
    for x in (9, 20, 31): pc.dot(C(w, 1), x, 17, 1, 2)                                                            # plank gaps
    for x in (6, 38): pc.dot(C('steel', 1), x, 2, 2, 24); pc.dot(C('steel', 3), x, 2, 1, 22)                        # iron ends
    pc.dot(C('steel', 1), 4, 23, 6, 2); pc.dot(C('steel', 1), 36, 23, 6, 2)
    return outline(pc, S)

def fence(S):
    pc = Piece(48, 22); w = 'skin_deep'
    for x in (2, 23, 44): pc.dot(C(w, 3), x, 2, 4, 19); pc.dot(C(w, 1), x + 3, 2, 1, 19); pc.dot(C(w, 4), x, 0, 4, 2)
    for y in (6, 13): pc.dot(C(w, 4), 0, y, 48, 3); pc.dot(C(w, 2), 0, y + 2, 48, 1); pc.dot(C(w, 1), 10, y + 1, 2, 1); pc.dot(C(w, 1), 32, y + 1, 2, 1)
    return outline(pc, S)

def cottage(S, seed=4):
    """a cottage: thatched roof with a ridge and eaves, timber-framed wall, a lit window, a plank door, a stone footing"""
    W, H = 72, 70; pc = Piece(W, H); rng = random.Random(seed)
    for y in range(34, H - 4):   # wall
        for x in range(8, W - 8): pc.dot(C('straw', 5 if y < 60 else 4), x, y)
    for x in (12, 30, 48, 60): pc.dot(C('skin_deep', 1), x, 34, 2, 30)                                 # timbers
    pc.dot(C('skin_deep', 1), 8, 48, W - 16, 2)
    for x in range(8, W - 8, 6): pc.dot(C('stone', 3 if (x // 6) % 2 else 2), x, 60, 5, 6); pc.dot(C('stone', 5), x, 60, 5, 1)   # footing stones
    pc.dot(C('skin_deep', 2), 42, 46, 12, 20); pc.dot(C('skin_deep', 3), 43, 46, 10, 1)              # door
    for x in (45, 49): pc.dot(C('skin_deep', 1), x, 47, 1, 18)
    pc.dot(C('gold', 5), 51, 56, 2, 2)                                                                 # handle
    pc.dot(C('skin_deep', 1), 15, 40, 14, 12); pc.dot(C('sky', 4), 16, 41, 12, 10); pc.dot(C('sky', 6), 17, 42, 3, 2); pc.dot(C('skin_deep', 1), 21, 41, 2, 10); pc.dot(C('skin_deep', 1), 16, 46, 12, 1)   # window
    pc.dot(C('leaf', 3), 14, 52, 16, 3); pc.dot(C('rose', 5), 16, 51, 2, 2); pc.dot(C('gold', 5), 22, 51, 2, 2)   # window box
    # roof: thatch, drawn as rows of short diagonal strokes, eaves thicker, a ridge cap, a chimney
    for y in range(6, 36):
        t = (y - 6) / 30; half = 4 + t * (W / 2 - 6)
        for x in range(int(W / 2 - half), int(W / 2 + half)):
            tone = 4 if (x + y // 2) % 5 else 3
            if (y + x // 3) % 7 == 0: tone = 2
            if x > W / 2 + half * .55: tone -= 1
            if y >= 33: tone = 2
            pc.dot(C('straw', tone), x, y)
    for x in range(int(W / 2 - 5), int(W / 2 + 5)): pc.dot(C('straw', 2), x, 5, 1, 2)
    pc.dot(C('stone', 2), 52, 0, 7, 12); pc.dot(C('stone', 4), 52, 0, 7, 2); pc.dot(C('stone', 1), 57, 2, 2, 10)   # chimney
    for y in range(8, 34):   # eave shadow line and the lit left slope
        t = (y - 6) / 30; half = 4 + t * (W / 2 - 6); pc.dot(C('straw', 6), int(W / 2 - half) + 1, y, 1, 1)
    return outline(pc, S)

# ---------------- tiles ----------------
def tile_grass(S, seed=1):
    pc = Piece(32, 32); rng = random.Random(seed); p = pc.im.load()
    for y in range(32):
        for x in range(32): p[x, y] = C('leaf', 3)
    for _ in range(6):   # pokémon-style tufts: a 3-blade clump with a dark base
        x, y = rng.randrange(32), rng.randrange(32)
        for dx, h in ((-1, 2), (0, 3), (1, 2)):
            for i in range(h): pc.dot(C('leaf', 4 if i == h - 1 else 2), (x + dx) % 32, (y - i) % 32)
        pc.dot(C('leaf', 1), x, (y + 1) % 32, 2, 1)
    for _ in range(10): x, y = rng.randrange(32), rng.randrange(32); pc.dot(C('leaf', 2), x, y, 1, 2)
    for _ in range(3): x, y = rng.randrange(32), rng.randrange(32); pc.dot(C('gold' if rng.random() < .5 else 'rose', 5), x, y)
    return pc

def tile_path(S, seed=2):
    pc = Piece(32, 32); rng = random.Random(seed); p = pc.im.load()
    for y in range(32):
        for x in range(32): p[x, y] = C('straw', 3 if (x * 7 + y * 13 + seed) % 11 else 4)
    for _ in range(14): x, y = rng.randrange(32), rng.randrange(32); pc.dot(C('straw', 2), x, y, rng.randrange(1, 3), 1)
    for _ in range(4): x, y = rng.randrange(32), rng.randrange(32); pc.dot(C('stone', 4), x, y, 2, 1); pc.dot(C('stone', 2), x, y + 1, 2, 1)
    for _ in range(3): x, y = rng.randrange(32), rng.randrange(32); pc.dot(C('leaf', 3), x, y, 1, 2)
    return pc

def tile_water(S, seed=3):
    pc = Piece(32, 32); p = pc.im.load(); rng = random.Random(seed)
    for y in range(32):
        for x in range(32):
            w = math.sin(x / 5.5 + y / 2.6 + seed) + .6 * math.sin(x / 2.3 - y / 6)
            p[x, y] = C('sky', 5 if w > 1.15 else 2 if w < -1.2 else 3)
    for _ in range(4): x, y = rng.randrange(32), rng.randrange(32); pc.dot(C('sky', 7), x, y, 3, 1); pc.dot(C('sky', 6), (x + 3) % 32, y, 1, 1)
    return pc

def tile_cobble(S, seed=4):
    pc = Piece(32, 32); rng = random.Random(seed); p = pc.im.load()
    for y in range(32):
        for x in range(32): p[x, y] = C('stone', 1)
    y = 0
    while y < 34:
        x = -rng.randrange(0, 5); h = rng.randrange(5, 8)
        while x < 34:
            w = rng.randrange(5, 10); s = 3 + rng.choice((-1, 0, 0, 1))
            for yy in range(y + 1, y + h - 1):
                for xx in range(x + 1, x + w - 1):
                    tone = s + (1 if (yy == y + 1 or xx == x + 1) else -1 if (yy == y + h - 2 or xx == x + w - 2) else 0)
                    p[xx % 32, yy % 32] = C('stone', tone)
            x += w
        y += h
    for _ in range(3): x, y = rng.randrange(32), rng.randrange(32); pc.dot(C('leaf', 3), x, y, 1, 2)
    return pc

STYLES = {
 'F1 Handheld classic': dict(outline='ink', tones=3, dither=0, rim=1, round=.9, note='bubbly lobes, ink line, three tones: the DS-era look'),
 'F2 HD-2D': dict(outline='none', tones=5, dither=1, rim=1, round=.6, note='five tones, dithered mid-band, no line: lit by the scene'),
 'F3 Chunky warm': dict(outline='soft', tones=4, dither=0, rim=1, round=.8, note='a line only on the shadow side, four tones, warm'),
 'F4 Golden GBA': dict(outline='selout', tones=4, dither=0, rim=1, round=.5, note='sel-out line, angular lobes, hard highlights'),
 'F5 Soft painterly': dict(outline='soft', tones=5, dither=1, rim=0, round=.95, note='round lobes, dithered, no rim line: lush and gentle'),
}
