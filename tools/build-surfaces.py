#!/usr/bin/env python3
"""Buildings track BD-2a: the building sheet's fourth row (eight new surfaces) and a height map for every cell.

The building sheet (game/art/scene/build/detail-a04b.png) is 8 cells across of 64 px; a cell covers 2 m (32 px to
the metre) and repeats. Its red channel (green and blue the same) is a shade level 0-4 as 0, 63, 126, 189, 252; the
colour comes from a layer's `col` through buildings.js `rampC`. The game reads as many rows as the picture has
(buildings.js `buildingTextureGrid`), so a fourth row needs no renderer change.

This tool keeps the top three rows (cells 0-23) exactly as they are and paints row four, cells 24-31, low contrast
like a trim sheet (mostly the colour itself, thin seams, a lit edge):
  24 fishscale     fish-scale shingles: round-bottomed scales in staggered courses, 25 cm
  25 standingseam  copper standing seam: raised seams every 50 cm, flat pans between
  26 barreltile    barrel tiles: convex caps over concave pans, 50 cm courses
  27 cob           cob / stucco: hand-smoothed lumps, no joints
  28 halftimber    half-timber: dark posts, rails and braces, light infill (1 m bays)
  29 riveted       riveted panels: 1 m plates with rounded corners, rivet rows, a pressed rib
  30 glassblock    glass block: 25 cm pillowed blocks in thin mortar, a glint in some
  31 mosaic        mosaic tile: 12.5 cm tiles, each its own shade, a soft chevron band

It also writes the height map BD-2b's normal sheet is made from: game/art/scene/build/detail-a04b-height.png, the
sheet's layout (512 x 256, grey, 255 the highest), each cell seamless on its own. The new cells' heights are built
with them (every scale, tile, block and plate its own height and bevel). The old cells' heights come from their
seams: the cells listed in OLD_GAPS have mortar or grout at a known level, so each brick, stone or tile is bevelled
from it and raised by its own small amount; the others (plaster, battens, corrugated, thatch...) take a smoothed
shade level, as the game's bump (buildings.js `bldBump`) does today. BD-2b may repaint any of them here.

    python3 tools/build-surfaces.py            # the sheet's row four, the height map, the contact picture
    python3 tools/build-surfaces.py --check    # paints in memory and fails if the files on disk differ

Run it after tools/build-airship.py --force and tools/build-props-batch1.py (they write the sheet's first three rows;
build-airship's --force starts again from detail-a04.png, three rows high).

Writes
  game/art/scene/build/detail-a04b.png          the sheet, 512 x 256 (rows one to three unchanged)
  game/art/scene/build/detail-a04b-height.png   the height map, 512 x 256
  game/art/scene/build/detail-a04b-normal.png   BD-2b: the normal sheet (`normal_sheet` of the height map, RGB:
                                                x across the face, y up it, z out of it, each 0.5-centred), which
                                                the model shader reads (buildings.js `bldBump`, scenery.buildArt.normal)
  validation/build-surfaces/contact.png         every cell three ways: the sheet, coloured as a building would be;
                                                the height map; lit from the upper left by `normal_sheet`
"""
import math, sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / 'game' / 'art' / 'scene' / 'build'
SHEET = BUILD / 'detail-a04b.png'
HEIGHT = BUILD / 'detail-a04b-height.png'
NORMAL = BUILD / 'detail-a04b-normal.png'
OUT = ROOT / 'validation' / 'build-surfaces'
N = 64        # a cell, in pixels: 2 m
COLS = 8
OLD_ROWS = 3  # the rows other tools paint (cells 0-23)

NEW_CELLS = ['fishscale', 'standingseam', 'barreltile', 'cob', 'halftimber', 'riveted', 'glassblock', 'mosaic']

# the old cells whose joints sit at known shade levels: (cell, the levels that are joints)
OLD_GAPS = {1: (0, 1), 2: (4,), 3: (0,), 5: (1,), 7: (1,), 8: (0, 1), 9: (0,), 10: (0,), 12: (1, 4), 14: (0,),
            19: (1,)}


# ---------------------------------------------------------------- helpers (all seamless: indices wrap round a cell)
def grid():
    y, x = np.mgrid[0:N, 0:N]
    return x, y


def soft_noise(seed, radius):
    """seamless smooth noise, mean 0 and spread 1: white noise box-blurred round the cell"""
    a = np.random.default_rng(seed).random((N, N))
    b = np.zeros((N, N))
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            if dx * dx + dy * dy <= radius * radius: b += np.roll(np.roll(a, dy, 0), dx, 1)
    return (b - b.mean()) / b.std()


def blur(h, r=1):
    o = np.zeros_like(h, dtype=float)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            o += np.roll(np.roll(h, dy, 0), dx, 1)
    return o / (2 * r + 1) ** 2


def gap_distance(gap, cap=3):
    """each pixel's distance (chessboard, round the cell) to the nearest joint pixel, capped"""
    d = np.where(gap, 0, cap).astype(int)
    for _ in range(cap):
        m = d.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                m = np.minimum(m, np.roll(np.roll(d, dy, 0), dx, 1) + 1)
        d = m
    return np.minimum(d, cap)


def labels(solid):
    """the connected parts of a mask, numbered from 1 (4-neighbours, round the cell); 0 off the mask"""
    lab = np.zeros((N, N), int)
    n = 0
    for y0, x0 in zip(*np.nonzero(solid)):
        if lab[y0, x0]: continue
        n += 1
        lab[y0, x0] = n
        st = [(y0, x0)]
        while st:
            y, x = st.pop()
            for yy, xx in ((y + 1) % N, x), ((y - 1) % N, x), (y, (x + 1) % N), (y, (x - 1) % N):
                if solid[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n; st.append((yy, xx))
    return lab


def per_part(lab, seed, spread):
    """a random height offset for each numbered part"""
    r = np.random.default_rng(seed).uniform(-spread, spread, lab.max() + 1)
    r[0] = 0
    return r[lab]


# ---------------------------------------------------------------- the new cells: each returns (levels 0-4, height 0-255)
def fishscale():
    """round-bottomed scales 8 px wide in courses 6 px apart, each course half a scale over; a course lies over the
    one below it, so a scale shows its round bottom: a dark outline round it, a lit crescent inside on the left"""
    lv = np.full((N, N), 2)
    h = np.zeros((N, N))
    rnd = np.random.default_rng(2401).uniform(-14, 14, (16, 8))
    R = 4.0
    for yy in range(N):
        for xx in range(N):
            # course c's scales: centres (cx, c*8+5.5), round bottoms dipping to c*8+9.5, between the next course's; the course below (c+1) is under
            # it, so test the upper course first
            for c in ((yy // 8) - 1, yy // 8):
                off = 4 if c % 2 else 0
                k = (xx - off) // 8
                cx, cy = k * 8 + off + 3.5, c * 8 + 5.5
                dx, dy = xx - cx, yy - cy
                inside = (yy >= c * 8 and dy <= 0) or (dy > 0 and dx * dx + dy * dy <= (R + 0.3) ** 2)
                if yy < c * 8 or not inside: continue
                r = math.hypot(dx, dy)
                if dy > 0 and r > R - 0.7:
                    lv[yy, xx] = 1                                  # the scale's round edge
                elif dy > -0.5 and r > R - 1.9 and dx < -0.5:
                    lv[yy, xx] = 3                                  # the lit crescent inside it
                t = min(1.0, (yy - c * 8) / 8.0)
                h[yy, xx] = 80 + 140 * t + rnd[c % 16, k % 8] - (25 if lv[yy, xx] == 1 else 0)
                break
    return lv, h


def standingseam():
    """seams every 16 px (50 cm): a ridge lit on its left, its shadow on the right; the pans flat with a faint
    sag between seams, a lap across each pan, staggered"""
    x, y = grid()
    p = x % 16
    lv = np.full((N, N), 2)
    lv[p == 0] = 3
    lv[p == 1] = 4
    lv[p == 2] = 1
    lv[p == 15] = 3
    h = 90 + 14 * np.sin(np.pi * (p - 2).clip(0, 13) / 13.0)  # the pan's slight bulge
    h = np.where(p <= 1, 250, np.where(p == 2, 150, np.where(p == 15, 120, h)))
    # a lap (the next sheet's end) once a pan, at its own height
    for k in range(4):
        ly = (8 + k * 21) % N
        cols = (p > 2) & (p < 15) & (x // 16 == k)
        row = cols & (y == ly)
        lv[row & (lv == 2)] = 3
        lv[np.roll(row, 1, 0) & (lv == 2)] = 1
        h[cols & (((y - ly) % N) < 10)] += 10
    rng = np.random.default_rng(2501)
    for _ in range(14):  # patina specks
        yy, xx = rng.integers(0, N, 2)
        if lv[yy, xx] == 2: lv[yy, xx] = rng.choice([1, 3])
    return lv, h


def barreltile():
    """columns 16 px across: a convex cap (8 px, lit on the left) beside a concave pan (8 px, shadowed by the cap);
    courses 16 px high, each tile's lower end over the next, with a dark lip below it"""
    x, y = grid()
    p, q = x % 16, y % 16
    cap = p < 8
    a = (p + 0.5) / 8.0                      # 0..1 across a cap
    b = (p - 8 + 0.5) / 8.0                  # 0..1 across a pan
    hc = 140 + 90 * np.sin(np.pi * a)        # round cap
    hp = 60 + 50 * (1 - np.sin(np.pi * b))   # dished pan
    h = np.where(cap, hc, hp) + 25 * (q / 15.0)  # each tile rises toward its lower end
    lv = np.full((N, N), 2)
    lv[cap & (p <= 1)] = 3
    lv[cap & (p >= 2) & (p <= 3)] = 3
    lv[cap & (p == 7)] = 1
    lv[~cap & (p == 8)] = 1
    lv[~cap & (p == 9)] = 1
    lv[cap & (q == 15)] = 0                  # the cap's lip over the next course
    lv[~cap & (q == 15)] = 1
    lv[cap & (q == 0) & (p >= 1) & (p <= 5)] = 4
    rng = np.random.default_rng(2601)
    for _ in range(12):
        yy, xx = rng.integers(0, N, 2)
        if lv[yy, xx] == 2: lv[yy, xx] = 1
    return lv, h


def cob():
    """lumpy hand-smoothed render: broad soft swells, their lit side a step lighter and their shaded side a step
    darker, mostly the colour itself"""
    v = soft_noise(2701, 7) + 0.25 * soft_noise(2702, 3)
    v = (v - v.mean()) / v.std()
    slope = (np.roll(np.roll(v, 2, 0), 2, 1) - np.roll(np.roll(v, -2, 0), -2, 1))   # the light from the upper left
    slope = slope / slope.std()
    lv = np.full((N, N), 2)
    lv[slope < -1.35] = 3
    lv[slope > 1.45] = 1
    rng = np.random.default_rng(2703)
    for _ in range(8):
        yy, xx = rng.integers(0, N, 2)
        lv[yy, xx] = 1
    h = 128 + 60 * v
    return lv, h


def halftimber():
    """1 m bays: posts at x 0 and 32 (6 px), rails at y 0 and 32 (6 px); a brace in two of the four panels; the
    timber two steps darker with a grain line or two, the infill a step lighter, shadowed under each timber"""
    x, y = grid()
    post = (x % 32) < 6
    rail = (y % 32) < 6
    brace = np.zeros((N, N), bool)
    for yy in range(N):
        for xx in range(N):
            px, py = xx % 32 - 6, yy % 32 - 6       # inside a panel: 0..25
            if px < 0 or py < 0: continue
            panel = (xx // 32) + 2 * (yy // 32)
            if panel == 0 and abs((25 - py) - px) <= 2: brace[yy, xx] = True   # rising to the right
            if panel == 3 and abs(py - px) <= 2: brace[yy, xx] = True          # falling to the right
    wood = post | rail | brace
    lv = np.where(wood, 1, 3)
    # grain: broken lines along each timber
    lv[post & ~rail & ((x % 32) == 3) & ((y * 5 % 13) < 6)] = 0
    lv[rail & ~post & ((y % 32) == 2) & ((x * 7 % 17) < 7)] = 0
    lv[post & ~rail & ((x % 32) == 0)] = 2                                 # the posts' lit left edge
    lv[rail & ((y % 32) == 0) & ~post] = 2                                 # and the rails' top
    under = np.roll(wood, 1, 0) & ~wood                                    # the infill just under a timber
    beside = np.roll(wood, 1, 1) & ~wood                                   # and right of one
    lv[under | beside] = 2
    rng = np.random.default_rng(2801)
    lv[~wood & (rng.random((N, N)) < 0.012)] = 2
    d = gap_distance(wood, 2)
    h = np.where(wood, 200 + per_part(labels(wood), 2802, 12), 80 + 12 * d / 2.0 + 6 * soft_noise(2803, 3))
    return lv, h


def riveted():
    """1 m plates (32 x 32) with rounded corners; a seam round each; rivets every 4 px down the vertical seams and
    every 8 px along the horizontal ones; a pressed rib across each plate's upper third"""
    x, y = grid()
    p, q = x % 32, y % 32
    lv = np.full((N, N), 2)
    seam = (p == 31) | (q == 31)
    lv[seam] = 1
    lv[(p == 0) & (q != 31)] = 3
    lv[(q == 0) & (p != 31)] = 3
    # rounded corners: the corner pixels go to the seam
    corner = ((p <= 1) | (p >= 30)) & ((q <= 1) | (q >= 30))
    corner &= ~(((p == 1) | (p == 30)) & ((q == 1) | (q == 30)))
    lv[corner] = 1
    rib = (q >= 9) & (q <= 10) & (p >= 5) & (p <= 26)
    lv[rib & (q == 9)] = 3
    lv[rib & (q == 10)] = 1
    rivet = np.zeros((N, N), bool)
    for yy in range(N):
        for xx in range(N):
            pp, qq = xx % 32, yy % 32
            if pp in (2, 29) and qq % 4 == 2 and 4 <= qq <= 28: rivet[yy, xx] = True
            if qq in (2, 29) and pp % 8 == 4: rivet[yy, xx] = True
    lv[rivet] = 4
    lv[np.roll(np.roll(rivet, 1, 0), 1, 1) & ~rivet] = 1
    plate = ~(seam | corner)
    d = gap_distance(~plate, 2)
    h = np.where(plate, 110 + 25 * d / 2.0 + per_part(labels(plate), 2901, 10), 40)
    h = h + np.where(rib, 35, 0) + np.where(rivet, 70, 0)
    return lv, h


def glassblock():
    """blocks 8 px (25 cm) in a 1 px mortar; each block pillowed: lit top and left edges, a shaded bottom and right,
    a lens in the middle, a glint in one block of three"""
    x, y = grid()
    p, q = x % 8, y % 8
    mortar = (p == 7) | (q == 7)
    lv = np.full((N, N), 2)
    lv[mortar] = 1
    lv[~mortar & ((p == 0) | (q == 0))] = 3
    lv[~mortar & ((p == 6) | (q == 6))] = 1
    lv[(p == 0) & (q == 0)] = 3
    lens = (p >= 2) & (p <= 4) & (q >= 2) & (q <= 4)
    lv[lens & (p + q <= 5)] = 3
    k = (x // 8) + 3 * (y // 8)
    lv[(p == 2) & (q == 2) & (k % 3 == 0)] = 4
    cx, cy = p - 3.0, q - 3.0
    pillow = 1 - (np.maximum(np.abs(cx), np.abs(cy)) / 3.5) ** 2
    h = np.where(mortar, 50, 130 + 90 * pillow.clip(0, 1))
    return lv, h


def mosaic():
    """tiles 4 px (12.5 cm) in a 1 px grout, mostly the colour with a few a step either way, a chevron band of
    lighter tiles every 1 m, each tile its own small height"""
    x, y = grid()
    p, q = x % 4, y % 4
    tx, ty = x // 4, y // 4                      # 16 x 16 tiles
    grout = (p == 3) | (q == 3)
    rng = np.random.default_rng(3101)
    shade = rng.choice([1, 2, 2, 2, 2, 2, 2, 2, 2, 3], (16, 16))
    ix, iy = np.mgrid[0:16, 0:16][::-1]
    chev = ((iy + np.abs((ix % 8) - 4)) % 8 == 0)  # a chevron every 8 tiles (1 m)
    shade = np.where(chev, 3, shade)
    lv = np.where(grout, 1, shade[ty, tx])
    h = np.where(grout, 60, 150 + rng.uniform(-14, 14, (16, 16))[ty, tx])
    return lv, h


PAINT = [fishscale, standingseam, barreltile, cob, halftimber, riveted, glassblock, mosaic]


# ---------------------------------------------------------------- the old cells' heights
def old_height(cell, lv):
    """a height for a cell this tool doesn't paint, from its shade levels (see the module's notes)"""
    gaps = OLD_GAPS.get(cell)
    if gaps is None:
        return 128 + 32 * (blur(lv.astype(float), 1) - 2)
    gap = np.isin(lv, gaps)
    # a joint is a line, not a speck: keep only joint pixels with a joint neighbour in a row or a column
    line = gap & ((np.roll(gap, 1, 0) & np.roll(gap, -1, 0)) | (np.roll(gap, 1, 1) & np.roll(gap, -1, 1)))
    if line.sum() < 20: return 128 + 32 * (blur(lv.astype(float), 1) - 2)
    d = gap_distance(line, 3)
    part = ~line
    return np.where(line, 50, 100 + 30 * d / 3.0 + per_part(labels(part), 1000 + cell, 14) + 6 * (lv - 2))


# ---------------------------------------------------------------- the sheets
def build():
    """(the sheet RGBA 512 x 256, the height map L 512 x 256), in memory"""
    old = np.array(Image.open(SHEET).convert('RGBA'))
    assert old.shape[1] == COLS * N and old.shape[0] >= OLD_ROWS * N, old.shape
    sheet = np.zeros((4 * N, COLS * N, 4), np.uint8)
    sheet[:OLD_ROWS * N] = old[:OLD_ROWS * N]
    height = np.zeros((4 * N, COLS * N))
    for cell in range(OLD_ROWS * COLS):
        r, c = divmod(cell, COLS)
        lv = np.round(old[r * N:(r + 1) * N, c * N:(c + 1) * N, 0] / 63).astype(int)
        height[r * N:(r + 1) * N, c * N:(c + 1) * N] = old_height(cell, lv)
    for i, fn in enumerate(PAINT):
        lv, h = fn()
        assert lv.min() >= 0 and lv.max() <= 4, fn.__name__
        c = i
        blk = sheet[OLD_ROWS * N:, c * N:(c + 1) * N]
        blk[..., 0] = blk[..., 1] = blk[..., 2] = (lv * 63).astype(np.uint8)
        blk[..., 3] = 255
        height[OLD_ROWS * N:, c * N:(c + 1) * N] = h
    return sheet, np.clip(np.round(height), 0, 255).astype(np.uint8)


def normal_sheet(height, strength=2.0):
    """the normals of a height map (RGB, 0.5-centred, z out of the face, +y up the face as the game reads the
    sheet: the picture's rows run down a wall), each cell sampled round itself so its seams stay seamless"""
    H, W = height.shape
    out = np.zeros((H, W, 3))
    h = height.astype(float) / 255.0
    for r in range(H // N):
        for c in range(W // N):
            b = h[r * N:(r + 1) * N, c * N:(c + 1) * N]
            dx = (np.roll(b, -1, 1) - np.roll(b, 1, 1)) * 0.5 * strength * 8
            dy = (np.roll(b, 1, 0) - np.roll(b, -1, 0)) * 0.5 * strength * 8   # up the face = up the picture
            n = np.stack([-dx, -dy, np.ones_like(b)], -1)
            out[r * N:(r + 1) * N, c * N:(c + 1) * N] = n / np.linalg.norm(n, axis=-1, keepdims=True)
    return out


def normal_rgb(height):
    """BD-2b: the normal sheet as the game reads it, 8 bits a channel (0.5 -> 128)"""
    return np.clip(np.round((normal_sheet(height) * 0.5 + 0.5) * 255), 0, 255).astype(np.uint8)


# ---------------------------------------------------------------- the contact picture
def ramp(col, t):
    """buildings.js rampC, 0-1 colours"""
    b = np.array(col) / 255.0
    mix = lambda a, c, k: a + (np.array(c) - a) * k
    return [mix(b * .55, (.235, .165, .439), .30), mix(b * .79, (.376, .29, .596), .17), b,
            mix(b, (1., .957, .769), .30), mix(b, (1., .988, .918), .60)][t]


# a colour a cell might take on a building (section 5's palette)
SAMPLE_COL = {0: '#F2E2C4', 1: '#E8D8B8', 2: '#C8664A', 3: '#B8B0A8', 8: '#C8664A', 9: '#5E8A74', 10: '#5A6478',
              12: '#C07850', 16: '#6E9A58', 17: '#3A4E78', 24: '#D06A50', 25: '#5FA894', 26: '#C8704C',
              27: '#EAD2A4', 28: '#B58A5E', 29: '#B87A52', 30: '#9CC8D0', 31: '#4E9AD6'}


def hex_rgb(s):
    return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))


def contact(sheet, height):
    n = normal_sheet(height)
    light = np.array([-0.45, 0.55, 0.7]); light /= np.linalg.norm(light)
    lit = np.clip(n @ light, 0, 1)
    rows = sheet.shape[0] // N
    S = 2                                    # pixels shown per sheet pixel
    cw, chh, lab = N * S, N * S, 14
    W = COLS * (cw + 6) + 6
    Hh = rows * (3 * chh + lab + 12) + 6
    im = Image.new('RGB', (W, Hh), (34, 30, 44))
    dr = ImageDraw.Draw(im)
    names = ['plaster', 'siding', 'brick', 'stone', 'battens', 'panels', 'corrugated', 'tilewall', 'rooftiles',
             'shingles', 'slate', 'hay', 'metal', 'flat', 'wood', 'plain', 'leaves', 'solar', 'cloth', 'rust',
             'stripes', 'rings', 'bark', 'rock'] + NEW_CELLS
    for cell in range(rows * COLS):
        r, c = divmod(cell, COLS)
        lv = np.round(sheet[r * N:(r + 1) * N, c * N:(c + 1) * N, 0] / 63).astype(int)
        col = hex_rgb(SAMPLE_COL.get(cell, '#C8B49A'))
        tones = np.array([ramp(col, t) for t in range(5)])
        rgb = (tones[lv] * 255).astype(np.uint8)
        hh = height[r * N:(r + 1) * N, c * N:(c + 1) * N]
        ll = (lit[r * N:(r + 1) * N, c * N:(c + 1) * N] * 235 + 20).astype(np.uint8)
        x0 = 6 + c * (cw + 6)
        y0 = 6 + r * (3 * chh + lab + 12)
        dr.text((x0, y0), f'{cell} {names[cell]}', fill=(240, 228, 200))
        for k, pic in enumerate((rgb, np.stack([hh] * 3, -1), np.stack([ll] * 3, -1))):
            p = Image.fromarray(pic.astype(np.uint8), 'RGB').resize((cw, chh), Image.NEAREST)
            im.paste(p, (x0, y0 + lab + k * chh))
    return im


def main():
    sheet, height = build()
    if '--check' in sys.argv:
        on = np.array(Image.open(SHEET).convert('RGBA'))
        hon = np.array(Image.open(HEIGHT).convert('L')) if HEIGHT.exists() else None
        non = np.array(Image.open(NORMAL).convert('RGB')) if NORMAL.exists() else None
        ok = (on.shape == sheet.shape and (on == sheet).all() and hon is not None and (hon == height).all()
              and non is not None and (non == normal_rgb(height)).all())
        print('build-surfaces: the files match' if ok else 'build-surfaces: the files differ from the tool')
        sys.exit(0 if ok else 1)
    Image.fromarray(sheet, 'RGBA').save(SHEET, optimize=True)
    Image.fromarray(height, 'L').save(HEIGHT, optimize=True)
    Image.fromarray(normal_rgb(height), 'RGB').save(NORMAL, optimize=True)
    OUT.mkdir(parents=True, exist_ok=True)
    contact(sheet, height).save(OUT / 'contact.png')
    print(f'wrote {SHEET.relative_to(ROOT)} {sheet.shape[1]}x{sheet.shape[0]}, {HEIGHT.relative_to(ROOT)}, '
          f'{NORMAL.relative_to(ROOT)}, '
          f'{(OUT / "contact.png").relative_to(ROOT)}')


if __name__ == '__main__':
    main()
