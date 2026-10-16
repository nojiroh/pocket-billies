#!/usr/bin/env python3
"""v37 preview: five ways of restyling the current props to the new palette, plus five tile treatments, on one sheet,
so the direction can be picked before the world is redrawn. Nothing in game/ changes.

    python3 tools/style-variants.py validation/v37-variants.png

Prop variants (each on the same six props, at 3x):
  A  Clean      snap every colour to the master palette, sel-out outline (the ramp's darkest step), nothing added
  B  Soft cel   A + shading flattened to three tones per ramp (base, shade, highlight), the anime cel look
  C  Detailed   A + material detail (grain, pits, leaves, sheen) and a rim light on the shadow side
  D  Bold       ink outlines, four tones, a strong highlight: the GBA-era look
  E  Painterly  five tones with a 2x2 dither in the shade, no outline: the softer HD-2D look
Tile variants (grass, pavers, water, dirt at 3x, three tiles across):
  1 current masters  2 calmer (big patches, fewer blades)  3 busier (more blades, more pebbles)
  4 bold (higher contrast, crisp stones)  5 painterly (dithered, soft)"""
import sys, json, random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixkit import palette as pal_
ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'game' / 'art'
P = pal_(); RAMPS = {k: np.array(v, np.float64) for k, v in P.items()}
ALL = np.concatenate([v for v in RAMPS.values()])
RAMP_OF = {tuple(c): (k, i) for k, v in P.items() for i, c in enumerate(v)}
INK = np.array([24, 20, 34])

def snap(rgb, tol=40):
    f = rgb.reshape(-1, 3).astype(np.float64); d = ((f[:, None, :] - ALL[None]) ** 2).sum(2); j = d.argmin(1)
    out = ALL[j].copy(); ok = d[np.arange(len(j)), j] <= tol * tol; out[~ok] = f[~ok]; return out.reshape(rgb.shape).astype(np.uint8)
def snap_all(rgb):
    f = rgb.reshape(-1, 3).astype(np.float64); d = ((f[:, None, :] - ALL[None]) ** 2).sum(2); return ALL[d.argmin(1)].reshape(rgb.shape).astype(np.uint8)
def ramp_step(rgb):
    """for each pixel: ramp name and step (after snap_all)"""
    H, W = rgb.shape[:2]; names = np.empty((H, W), object); steps = np.zeros((H, W), int)
    for y in range(H):
        for x in range(W):
            r = RAMP_OF.get(tuple(int(v) for v in rgb[y, x])); names[y, x] = r[0] if r else None; steps[y, x] = r[1] if r else 3
    return names, steps
def with_steps(names, steps):
    H, W = names.shape; out = np.zeros((H, W, 3), np.uint8)
    for y in range(H):
        for x in range(W):
            n = names[y, x]
            if n: out[y, x] = P[n][max(0, min(7, int(steps[y, x])))]
    return out
def edges(a):
    op = a[..., 3] > 0
    e = op & ~(np.roll(op, 1, 0) & np.roll(op, -1, 0) & np.roll(op, 1, 1) & np.roll(op, -1, 1))
    e[0, :] |= op[0, :]; e[-1, :] |= op[-1, :]; e[:, 0] |= op[:, 0]; e[:, -1] |= op[:, -1]; return e
def outline_selout(a, ink=False):
    o = a.copy(); e = edges(a); names, steps = ramp_step(o[..., :3])
    H, W = e.shape
    for y in range(H):
        for x in range(W):
            if not e[y, x]: continue
            n = names[y, x]
            o[y, x, :3] = INK if (ink or not n) else P[n][0]
    return o
def local_mean_step(names, steps, op, r=2):
    """the average step around each pixel of the same ramp: used to flatten shading into bands"""
    H, W = steps.shape; out = steps.astype(np.float64).copy()
    for y in range(H):
        for x in range(W):
            if not op[y, x]: continue
            n = names[y, x]; acc = [];
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < H and 0 <= xx < W and op[yy, xx] and names[yy, xx] == n: acc.append(steps[yy, xx])
            out[y, x] = sum(acc) / len(acc) if acc else steps[y, x]
    return out

def variant(a, kind, seed=1):
    a = a.copy(); a[a[..., 3] < 128] = 0; a[..., 3] = np.where(a[..., 3] > 0, 255, 0); op = a[..., 3] > 0
    rgb = snap_all(a[..., :3]); rgb[~op] = 0; a[..., :3] = rgb
    names, steps = ramp_step(rgb); rng = np.random.default_rng(seed)
    H, W = op.shape; yy, xx = np.mgrid[0:H, 0:W]
    if kind == 'A': return outline_selout(a)
    if kind == 'B':   # three tones: steps quantised to base-1, base, base+1 around each ramp's local mean
        m = local_mean_step(names, steps, op, 3); q = np.where(steps < m - .6, -1, np.where(steps > m + .6, 1, 0)); base = np.round(m).astype(int)
        a[..., :3] = with_steps(names, base + q); a[~op] = 0; return outline_selout(a)
    if kind == 'C':
        o = outline_selout(a); n0 = rng.random((H, W)); e = edges(a)
        # rim light: a pixel just inside the lower-right edge goes a step up; material detail by ramp family
        inner = op & ~e; rim = inner & (np.roll(e, -1, 0) | np.roll(e, -1, 1))
        st2 = steps.copy(); st2[rim & (steps < 7)] += 1
        for y in range(H):
            for x in range(W):
                n = names[y, x]
                if not inner[y, x] or n is None: continue
                if n in ('leaf', 'pine', 'olive') and n0[y, x] < .06: st2[y, x] = min(7, steps[y, x] + 1)
                elif n in ('leaf', 'pine', 'olive') and n0[y, x] > .95: st2[y, x] = max(0, steps[y, x] - 1)
                elif n in ('skin_deep', 'rust', 'straw') and (yy[y, x] + xx[y, x] // 3) % 6 == 0 and n0[y, x] < .5: st2[y, x] = max(0, steps[y, x] - 1)
                elif n in ('stone', 'steel') and n0[y, x] > .96: st2[y, x] = max(0, steps[y, x] - 1)
        o[..., :3] = np.where(e[..., None], o[..., :3], with_steps(names, st2)); o[~op] = 0; return o
    if kind == 'D':   # bold: ink outline, tones pushed apart (four), a strong highlight on top-left inner edge
        e = edges(a); inner = op & ~e; hi = inner & (np.roll(e, 1, 0) | np.roll(e, 1, 1))
        m = local_mean_step(names, steps, op, 3); q = np.where(steps < m - .4, -2, np.where(steps > m + .4, 1, 0)); st2 = np.round(m).astype(int) + q; st2[hi] = np.minimum(7, st2[hi] + 2)
        a[..., :3] = with_steps(names, st2); a[~op] = 0; return outline_selout(a, ink=True)
    if kind == 'E':   # painterly: five tones and a checker dither between the shade bands, no outline
        m = local_mean_step(names, steps, op, 2); d = steps - m; chk = ((yy + xx) % 2 == 0)
        q = np.where(d < -1.2, -2, np.where(d < -.4, np.where(chk, -1, -2), np.where(d > 1.2, 2, np.where(d > .4, np.where(chk, 1, 0), 0))))
        a[..., :3] = with_steps(names, np.round(m).astype(int) + q); a[~op] = 0; return a
    return a

def tile_variant(name, kind):
    """tiles come from build-tiles recipes with the dials turned; kind 1..5"""
    import importlib.util
    spec = importlib.util.spec_from_file_location('bt', ROOT / 'tools' / 'build-tiles.py'); bt = importlib.util.module_from_spec(spec); spec.loader.exec_module(bt)
    R = bt.palette(); rec = bt.RECIPES[name]; ramp, base, k, p = rec; p = dict(p)
    if kind == 2: p['blades'] = int(p.get('blades', 20) * .45); p['n'] = int(p.get('n', 40) * .5); p['grain'] = p.get('grain', .5) * .5
    if kind == 3: p['blades'] = int(p.get('blades', 20) * 1.8); p['n'] = int(p.get('n', 40) * 1.6); p['grain'] = min(1, p.get('grain', .5) * 1.6); p['stones'] = p.get('stones', 0) + 3
    bt.RECIPES[name] = (ramp, base, k, p)
    im = np.asarray(bt.paint(name, 5 + kind, R).convert('RGB')).copy()
    if kind == 4:   # bold: push every shade two steps apart from the base
        names, steps = ramp_step(im); im = with_steps(names, base + np.clip((steps - base) * 2, -3, 3))
    if kind == 5:   # painterly: dither between neighbouring steps
        names, steps = ramp_step(im); H, W = steps.shape; yy, xx = np.mgrid[0:H, 0:W]; chk = (yy + xx) % 2 == 0
        im = with_steps(names, np.where(chk & (steps != base), steps + np.sign(base - steps), steps))
    return Image.fromarray(im)

PROPS = ['scene/props/tree_birch.png', 'scene/props/bench_wood.png', 'scene/props/boulder.png', 'scene/props/streetlamp.png', 'scene/props/crate.png', 'scene/props/fountain.png', 'scene/props/house_cottage.png']
ZOOM = {'scene/props/house_cottage.png': 2}
TILES = ['grass', 'pavers', 'water', 'dirt']

def main():
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'validation' / 'v37-variants.png')
    z = 3; ims = [np.asarray(Image.open(ART / p).convert('RGBA')) for p in PROPS]
    cols = [max(im.shape[1] for im in ims)]; cw = 0
    rows = []
    for kind in 'ABCDE':
        vs = [Image.fromarray(variant(im, kind)) for im in ims]; rows.append((kind, vs))
    zs = [ZOOM.get(p, z) for p in PROPS]
    W = sum(max(v.width for v in [r[1][i] for r in rows]) * zs[i] for i in range(len(ims))) + 12 * len(ims) + 60
    H = sum(max(v.height * zs[i] for i, v in enumerate(r[1])) for r in rows) + 20 * len(rows)
    TW = (32 * 3 * z + 12) * len(TILES) + 60; TH = (32 * 3 * z + 20) * 5
    sheet = Image.new('RGB', (max(W, TW), H + TH + 60), (168, 176, 190)); d = ImageDraw.Draw(sheet)
    y = 10; labels = {'A': 'A  Clean: palette + sel-out', 'B': 'B  Soft cel: 3 tones', 'C': 'C  Detailed: grain + rim light', 'D': 'D  Bold: ink + 4 tones', 'E': 'E  Painterly: 5 tones, dither, no outline'}
    for kind, vs in rows:
        d.text((8, y), labels[kind], fill=(20, 20, 30)); x = 60; rh = max(v.height * zs[i] for i, v in enumerate(vs))
        for i, v in enumerate(vs):
            zz = zs[i]; colw = max(r[1][i].width for r in rows) * zz; v2 = v.resize((v.width * zz, v.height * zz), Image.NEAREST); sheet.paste(v2, (x + (colw - v2.width) // 2, y + rh - v2.height), v2); x += colw + 12
        y += rh + 20
    y += 30; d.text((8, y - 20), 'Tiles: 1 current  2 calmer  3 busier  4 bold  5 painterly   (grass, pavers, water, dirt; three tiles across)', fill=(20, 20, 30))
    for kind in range(1, 6):
        x = 60; d.text((8, y + 40), str(kind), fill=(20, 20, 30))
        for name in TILES:
            t = tile_variant(name, kind); big = Image.new('RGB', (96, 96))
            for i in range(3):
                for j in range(3): big.paste(t, (i * 32, j * 32))
            big = big.resize((96 * z, 96 * z), Image.NEAREST); sheet.paste(big, (x, y)); x += 96 * z + 12
        y += 96 * z + 20
    out.parent.mkdir(parents=True, exist_ok=True); sheet.save(out); print(out, sheet.size)

if __name__ == '__main__':
    main()
