#!/usr/bin/env python3
"""v37 preview, round two: five iterations on E (painterly: five tones, dithered shade, no hard outline), each adding
character and breaking symmetry in a different way. Same props and tiles as round one, one sheet.

    python3 tools/style-variants2.py validation/v37-variants-2.png

  E1  Lean        E + a sideways sway (the whole prop leans a little, more at the top) and a ragged silhouette
  E2  Organic     E + low-frequency bumps pushed into the silhouette (lumpy crowns and rocks) and eroded edges
  E3  Inked       E2 + a hand-drawn line: a broken sel-out that is thicker on the shadow side and gone where the light hits
  E4  Top-heavy   E2 + exaggerated proportions (crowns and roofs swell, trunks and bases narrow) and a tilt
  E5  Brushed     E2 + directional brush dither that follows the form, a stronger left light, a warm bounce from below
Tiles (grass, pavers, water, dirt): 1 clumped grass, 2 uneven stones, 3 crossing waves, 4 cracked dirt with clumps,
  5 all four in E5's brushed dither"""
import sys, math, random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, str(Path(__file__).resolve().parent))
import importlib.util
spec = importlib.util.spec_from_file_location('sv', Path(__file__).resolve().parent / 'style-variants.py'); sv = importlib.util.module_from_spec(spec); spec.loader.exec_module(sv)
P, ART, ROOT = sv.P, sv.ART, sv.ROOT
snap_all, ramp_step, with_steps, edges, local_mean_step, INK = sv.snap_all, sv.ramp_step, sv.with_steps, sv.edges, sv.local_mean_step, sv.INK

def noise2(H, W, scale, seed):
    rng = np.random.default_rng(seed); gh, gw = max(2, int(H / scale) + 2), max(2, int(W / scale) + 2); g = rng.random((gh, gw))
    yy, xx = np.mgrid[0:H, 0:W]; u, v = xx / scale, yy / scale; i, j = u.astype(int), v.astype(int); fu, fv = u - i, v - j
    s = lambda t: t * t * (3 - 2 * t); fu, fv = s(fu), s(fv)
    a = g[j, i] * (1 - fu) + g[j, i + 1] * fu; b = g[j + 1, i] * (1 - fu) + g[j + 1, i + 1] * fu; return a * (1 - fv) + b * fv

def warp(a, dx, dy):
    """move pixels by per-pixel offsets (nearest), keeping the canvas; dx, dy arrays in pixels"""
    H, W = a.shape[:2]; yy, xx = np.mgrid[0:H, 0:W]; sx = np.clip(np.round(xx - dx).astype(int), 0, W - 1); sy = np.clip(np.round(yy - dy).astype(int), 0, H - 1)
    out = a[sy, sx].copy(); out[(xx - dx < -.5) | (xx - dx > W - .5) | (yy - dy < -.5) | (yy - dy > H - .5)] = 0; return out

def bbox_of(a):
    op = a[..., 3] > 0; ys, xs = np.where(op); return (xs.min(), ys.min(), xs.max(), ys.max()) if len(xs) else (0, 0, 1, 1)

def painterly(a, seed=1, brush=False, light_left=False, bounce=False):
    a = a.copy(); a[a[..., 3] < 128] = 0; a[..., 3] = np.where(a[..., 3] > 0, 255, 0); op = a[..., 3] > 0
    rgb = snap_all(a[..., :3]); rgb[~op] = 0; names, steps = ramp_step(rgb); H, W = op.shape; yy, xx = np.mgrid[0:H, 0:W]
    m = local_mean_step(names, steps, op, 2); d = steps - m
    if brush:   # dither along a brush direction (down-right), so shade reads as strokes, not a screen
        chk = ((xx + yy // 2) % 3 == 0)
    else: chk = ((yy + xx) % 2 == 0)
    q = np.where(d < -1.2, -2, np.where(d < -.4, np.where(chk, -1, -2), np.where(d > 1.2, 2, np.where(d > .4, np.where(chk, 1, 0), 0))))
    st = np.round(m).astype(int) + q
    if light_left:  # a stronger key light from the left: left third a step up, right third a step down
        x0, y0, x1, y1 = bbox_of(a); t = (xx - x0) / max(1, x1 - x0); st = st + np.where(t < .3, 1, np.where(t > .72, -1, 0))
    if bounce:      # warm bounce from the ground: the lowest band keeps its step but the ramp leans warm (straw) for cool ramps
        x0, y0, x1, y1 = bbox_of(a); t = (yy - y0) / max(1, y1 - y0)
        for y in range(H):
            for x in range(W):
                if op[y, x] and t[y, x] > .82 and names[y, x] in ('stone', 'steel', 'indigo', 'sky') and (x + y) % 2 == 0: names[y, x] = 'straw'; st[y, x] = min(7, st[y, x])
    a[..., :3] = with_steps(names, np.clip(st, 0, 7)); a[~op] = 0; return a

def ragged(a, seed, amount=.35):
    """erode the silhouette edge where a noise field says so, and grow it a pixel elsewhere: a hand-cut edge"""
    H, W = a.shape[:2]; n = noise2(H, W, 3, seed); e = edges(a); op = a[..., 3] > 0
    out = a.copy(); out[e & (n > 1 - amount)] = 0
    grow = (~op) & (np.roll(op, 1, 0) | np.roll(op, 0, 1) | np.roll(op, -1, 1)) & (n < amount * .5)
    for y, x in zip(*np.where(grow)):
        for dy, dx in ((1, 0), (0, 1), (0, -1), (-1, 0)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < H and 0 <= xx < W and op[yy, xx]: out[y, x] = a[yy, xx]; break
    return out

def lean(a, seed, k=.12):
    H, W = a.shape[:2]; x0, y0, x1, y1 = bbox_of(a); yy, xx = np.mgrid[0:H, 0:W]; t = np.clip((y1 - yy) / max(1, y1 - y0), 0, 1)
    rng = random.Random(seed); s = (1 if rng.random() < .5 else -1) * k * (x1 - x0) * .5
    return warp(a, s * t * t, np.zeros((H, W)))

def organic(a, seed, amp=.09):
    H, W = a.shape[:2]; x0, y0, x1, y1 = bbox_of(a); w, h = x1 - x0 + 1, y1 - y0 + 1
    nx = (noise2(H, W, max(6, w / 3), seed) - .5) * 2 * amp * w; ny = (noise2(H, W, max(6, h / 3), seed + 7) - .5) * 2 * amp * h * .5
    yy, xx = np.mgrid[0:H, 0:W]; t = np.clip((y1 - yy) / max(1, h), 0, 1); return warp(a, nx * (0.3 + .7 * t), ny * (0.3 + .7 * t))

def top_heavy(a, seed):
    H, W = a.shape[:2]; x0, y0, x1, y1 = bbox_of(a); w, h = x1 - x0 + 1, y1 - y0 + 1; cx = (x0 + x1) / 2
    yy, xx = np.mgrid[0:H, 0:W]; t = np.clip((y1 - yy) / max(1, h), 0, 1)     # 1 at the top
    sx = 1 + .18 * (t - .35)                                                      # top wider, base narrower
    dx = (xx - cx) * (1 - 1 / sx); dy = -t * t * h * .08                           # and stretched upward a little
    rng = random.Random(seed); tilt = (1 if rng.random() < .5 else -1) * .08 * w * t
    return warp(a, dx + tilt, dy)

def inked(a, seed):
    """a hand-drawn line: sel-out where the edge faces away from the light, thicker (2 px) under the shadow side,
    nothing on the lit top-left edge; broken by noise"""
    out = a.copy(); e = edges(a); op = a[..., 3] > 0; names, steps = ramp_step(a[..., :3]); H, W = op.shape; n = noise2(H, W, 4, seed)
    lit = np.roll(op, 1, 0) & np.roll(op, 1, 1)   # pixel has filled neighbours above and left: not a lit edge
    for y, x in zip(*np.where(e)):
        if n[y, x] > .78: continue
        up_open = y == 0 or not op[y - 1, x]; left_open = x == 0 or not op[y, x - 1]
        if (up_open or left_open) and not (y == H - 1 or not op[y + 1, x]) and not (x == W - 1 or not op[y, x + 1]): continue   # lit edge: no line
        nm = names[y, x]; out[y, x, :3] = P[nm][0] if nm else INK
        down_open = y == H - 1 or not op[y + 1, x]; right_open = x == W - 1 or not op[y, x + 1]
        if (down_open or right_open) and n[y, x] < .55:
            for dy, dx in ((-1, 0), (0, -1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and op[yy, xx] and not e[yy, xx]:
                    nm2 = names[yy, xx]; out[yy, xx, :3] = P[nm2][1] if nm2 else INK
    return out

def variant(a, kind, seed):
    if kind == 'E1': return painterly(ragged(lean(a, seed), seed), seed)
    if kind == 'E2': return painterly(ragged(organic(a, seed), seed + 1), seed)
    if kind == 'E3': return inked(painterly(ragged(organic(a, seed), seed + 1), seed), seed)
    if kind == 'E4': return painterly(ragged(organic(top_heavy(a, seed), seed, .06), seed + 2), seed)
    if kind == 'E5': return painterly(ragged(organic(a, seed), seed + 1), seed, brush=True, light_left=True, bounce=True)

# ---- tiles with character: no grid symmetry ----
def tile(name, kind, R):
    import importlib.util
    spec = importlib.util.spec_from_file_location('bt', ROOT / 'tools' / 'build-tiles.py'); bt = importlib.util.module_from_spec(spec); spec.loader.exec_module(bt)
    rng = random.Random(kind * 31 + len(name)); T = 32
    def C(r, s): return R[r][max(0, min(7, s))]
    a = np.zeros((T, T, 3), np.uint8)
    if name == 'grass':
        a[:, :] = C('leaf', 3); n = noise2(T, T, 9, kind); a[n > .62] = C('leaf', 4); a[n < .3] = C('leaf', 2)
        for _ in range(9):   # clumps: a few blades each, leaning the same way per clump
            cx, cy, lean_ = rng.randrange(T), rng.randrange(T), rng.choice((-1, 0, 1)); dark = rng.random() < .5
            for k in range(rng.randrange(3, 6)):
                x, y = (cx + rng.randrange(-3, 4)) % T, (cy + rng.randrange(-2, 3)) % T; h = rng.randrange(2, 5)
                for i in range(h): a[(y - i) % T, (x + (lean_ * i) // 2) % T] = C('leaf', 1 if dark else 5)
        for _ in range(3): x, y = rng.randrange(T), rng.randrange(T); a[y, x] = C('gold', 5)
    elif name == 'pavers':
        a[:, :] = C('stone', 1); y = 0; row = 0
        while y < T + 6:
            x = -rng.randrange(0, 6); h = rng.randrange(6, 10)
            while x < T + 6:
                w = rng.randrange(6, 13); s = 3 + rng.choice((-1, 0, 0, 1))
                for yy in range(y + 1, min(T, y + h - 1)):
                    for xx in range(max(0, x + 1), min(T, x + w - 1)):
                        a[yy, xx] = C('stone', s + (1 if (yy == y + 1 or xx == x + 1) else -1 if (yy == y + h - 2 or xx == x + w - 2) else 0))
                if rng.random() < .3 and 0 <= x + 2 < T and 0 <= y + 2 < T: a[y + 2, x + 2] = C('stone', s - 1)
                x += w
            y += h; row += 1
        for _ in range(6): x, y = rng.randrange(T), rng.randrange(T); a[y, x] = C('leaf', 3) if rng.random() < .5 else C('stone', 0)
    elif name == 'water':
        a[:, :] = C('sky', 3); n = noise2(T, T, 7, kind + 3)
        for y in range(T):
            for x in range(T):
                w1 = math.sin(x / 4.2 + y / 2.1 + n[y, x] * 3); w2 = math.sin(x / 7 - y / 3.5 + 1.3)
                if w1 > .85 and w2 > -.2: a[y, x] = C('sky', 5)
                elif w1 > .95: a[y, x] = C('sky', 7)
                elif w1 < -.9 and w2 < 0: a[y, x] = C('sky', 2)
        for _ in range(3): x, y = rng.randrange(T), rng.randrange(T); a[y, x] = C('sky', 7); a[y, (x + 1) % T] = C('sky', 6)
    elif name == 'dirt':
        a[:, :] = C('rust', 2); n = noise2(T, T, 6, kind + 5); a[n > .66] = C('rust', 3); a[n < .34] = C('rust', 1)
        for _ in range(7):   # clumps and cracks, scattered
            x, y = rng.randrange(T), rng.randrange(T); r = rng.randrange(1, 3)
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    if dx * dx + dy * dy <= r * r: a[(y + dy) % T, (x + dx) % T] = C('rust', 3 if dy + dx < 0 else 1)
        x, y = rng.randrange(T), rng.randrange(T)
        for k in range(rng.randrange(6, 12)): a[y % T, x % T] = C('rust', 0); x += rng.choice((1, 1, 0)); y += rng.choice((-1, 0, 1))
        for _ in range(4): x, y = rng.randrange(T), rng.randrange(T); a[y, x] = C('stone', 4); a[y, (x + 1) % T] = C('stone', 2)
    im = a
    if kind == 5:   # brushed dither over the whole tile
        names, steps = ramp_step(im); H, W = steps.shape; yy, xx = np.mgrid[0:H, 0:W]; chk = (xx + yy // 2) % 3 == 0; base = np.round(local_mean_step(names, steps, np.ones((H, W), bool), 2)).astype(int)
        im = with_steps(names, np.where(chk & (steps != base), steps + np.sign(base - steps), steps))
    return Image.fromarray(im)

PROPS = sv.PROPS; ZOOM = sv.ZOOM; TILES = ['grass', 'pavers', 'water', 'dirt']
LABELS = {'E1': 'E1  Lean: a sway, ragged edge', 'E2': 'E2  Organic: bumps in the silhouette, eroded edges', 'E3': 'E3  Inked: E2 + a broken hand line, thick on the shadow side', 'E4': 'E4  Top-heavy: E2 + swollen crowns, narrow bases, a tilt', 'E5': 'E5  Brushed: E2 + stroke dither, left key light, warm bounce'}

def main():
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'validation' / 'v37-variants-2.png')
    z = 3; ims = [np.asarray(Image.open(ART / p).convert('RGBA')) for p in PROPS]; zs = [ZOOM.get(p, z) for p in PROPS]
    rows = [(k, [Image.fromarray(variant(im, k, 11 + i * 3)) for i, im in enumerate(ims)]) for k in ('E1', 'E2', 'E3', 'E4', 'E5')]
    W = sum(max(r[1][i].width for r in rows) * zs[i] for i in range(len(ims))) + 12 * len(ims) + 60
    H = sum(max(v.height * zs[i] for i, v in enumerate(r[1])) for r in rows) + 20 * len(rows)
    TW = (96 * z + 12) * len(TILES) + 60; TH = (96 * z + 20) * 5
    sheet = Image.new('RGB', (max(W, TW), H + TH + 60), (168, 176, 190)); d = ImageDraw.Draw(sheet); y = 10
    for kind, vs in rows:
        d.text((8, y), LABELS[kind], fill=(20, 20, 30)); x = 60; rh = max(v.height * zs[i] for i, v in enumerate(vs))
        for i, v in enumerate(vs):
            zz = zs[i]; colw = max(r[1][i].width for r in rows) * zz; v2 = v.resize((v.width * zz, v.height * zz), Image.NEAREST); sheet.paste(v2, (x + (colw - v2.width) // 2, y + rh - v2.height), v2); x += colw + 12
        y += rh + 20
    y += 30; d.text((8, y - 20), 'Tiles with character: 1 clumped grass  2 uneven stones  3 crossing waves  4 cracked dirt  5 everything brushed  (grass, pavers, water, dirt; three across)', fill=(20, 20, 30))
    R = sv.pal_()
    for kind in range(1, 6):
        x = 60; d.text((8, y + 40), str(kind), fill=(20, 20, 30))
        for name in TILES:
            t = tile(name, kind, R); big = Image.new('RGB', (96, 96))
            for i in range(3):
                for j in range(3): big.paste(t, (i * 32, j * 32))
            big = big.resize((96 * z, 96 * z), Image.NEAREST); sheet.paste(big, (x, y)); x += 96 * z + 12
        y += 96 * z + 20
    sheet.save(out); print(out, sheet.size)

if __name__ == '__main__':
    main()
