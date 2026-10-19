#!/usr/bin/env python3
"""Phase 09, batch 8: MOCKUPS for the city opening (Project Story S7-S8), for the owner to judge on his devices before
the full set and the scene are built. Provisional until session S4 settles the look and the names: the organization's
logo panel is left blank and the signs carry only generic words (HOTEL, BAR, OPEN), never a brand.

The owner's look (2026-10-19): the city has only tall buildings (Cyberpunk 2077, Blade Runner), sleek tops over grimy
bottoms, neon in pink, cyan and amber, dark and rainy at night. In the airship style: low-poly, 32 px to the metre.

  city_tower_slab   a 90 m slab: a grimy concrete base (shopfront, pipes, AC units, fire escape), a sleek glass shaft
  city_tower_mega   a 95 m megablock: a wide grimy base with balcony cages, two glass setbacks, a landing pad on top
  city_tower_hero   a 125 m octagonal needle on a grimy podium: a holo-ad band, the BLANK logo panel near the top
  city_sign_hotel   a vertical blade sign on a mast        city_sign_bar     a hanging box sign on a bracket
  city_sign_open    an arrow sign                           city_billboard    a holo billboard on a truss
  city_streetlight  a tall street light with a cyan bar     city_vending      a lit vending machine
  city_flying_car   a hover car with lights, flying at 2.4 m
  portal_ring, portal_rift, portal_door, portal_gate, portal_hole: five portal shapes, each in two colourways
                    (variant 0: violet, the city's side; variant 1: gold-green, the Hollow Earth's light)

Only the picture layers glow at night (the model shader has no emission), so the lit windows are a picture on each
tower's FRONT face; the sides show bands and fins, unlit. New keys only: nothing in the game uses these yet.
Showcase map: `test_props_city`.

    python3 tools/build-props-batch8.py      (independent of batch1 to 7; rerunnable)
"""
import importlib.util
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import gamedata  # noqa: E402


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'tools' / file)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


B1 = load('batch1', 'build-props-batch1.py')
B5 = load('batch5', 'build-props-batch5.py')
PPM = B1.PPM
box, limb, sphere, cyl, img = B1.box, B1.limb, B1.sphere, B1.cyl, B1.img
r2, np = B1.r2, B1.np
OUT = B1.NEXT / 'city'
px = lambda m: max(1, round(m * PPM))

# ---------------------------------------------------------------- the palette
PINK, CYAN, AMBER = '#FF3FA4', '#3FE6FF', '#FFB23F'
CON, CON_D, PIPE, AC = '#4A4552', '#35313D', '#5E5A62', '#7E8288'
GLASS, GLASS_L, CHROME, FIN, BLACK = '#22324A', '#35507A', '#B8C2D0', '#8A96A8', '#1E1C24'
STEEL = '#2E2C36'
VOID = ['#FFFFFF', '#F2C8FF', '#C27CFF', '#7A3CE0', '#3A1A78']   # portal, the city's side
INNER = ['#FFFFFF', '#FFF2B0', '#FFC94A', '#7EDB7A', '#2E8A5A']  # portal, the Hollow Earth's light
FIXED = {'rot': 0, 'lean': 0, 'size': 0}

B5.GLYPHS.update({
    'H': ['11011', '11011', '11011', '11111', '11011', '11011', '11011'],
    'O': ['01110', '11011', '11011', '11011', '11011', '11011', '01110'],
    'P': ['11110', '11011', '11011', '11110', '11000', '11000', '11000'],
    'B': ['11110', '11011', '11011', '11110', '11011', '11011', '11110'],
})


def rgb(c, a=255):
    return (int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16), a)


def mix(c, d, t):
    a, b = rgb(c), rgb(d)
    return '#%02X%02X%02X' % tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def save(a, name):
    return B1.save_png(a, OUT / f'{name}.png')


def rec(L, cel=0.65):
    return {'ppm': PPM, 'cel': cel, 'layers': sorted(L, key=lambda l: l['k'] == 'img')}


# ---------------------------------------------------------------- pictures: windows, neon, holo, swirls
def facade(w, h, fh, bay, seed, style):
    """A tower face's windows at 32 px/m, transparent between them. grimy: small windows, mostly dark, some warm or
    with a screen's light, a few boarded, grime streaks under them. sleek: a full curtain wall, lit in office runs."""
    rng = np.random.default_rng(seed)
    W, H, FH, BW = px(w), px(h), px(fh), px(bay)
    a = np.zeros((H, W, 4), np.uint8)
    nf, nb = H // FH, W // BW
    x0 = (W - nb * BW) // 2
    if style == 'sleek':
        a[:, :] = rgb(GLASS_L, 255)
        for f in range(nf):
            run = rng.random() < 0.45
            for b in range(nb):
                if rng.random() < 0.18: run = not run
                lit = run and rng.random() < 0.85
                col = (rng.choice(['#DDF2FF', '#DDF2FF', '#FFE2A8', CYAN, PINK], p=[0.45, 0.2, 0.2, 0.1, 0.05])
                       if lit else mix('#1E3150', '#2E4A72', rng.random() * 0.6))
                y1 = H - f * FH
                xa = x0 + b * BW
                a[max(0, y1 - FH + 2):y1 - 1, xa + 1:xa + BW] = rgb(col)
        for x in range(x0, W, BW): a[:, x] = rgb(FIN)
        for y in range(H - 1, -1, -FH): a[max(0, y - 1):y + 1, :] = rgb(CHROME)
        for k in range(-H, W, 23):  # faint diagonal reflections
            for y in range(H):
                x = k + y // 2
                if 0 <= x < W and a[y, x, 0] < 120: a[y, x, :3] = np.minimum(255, a[y, x, :3].astype(int) + 22)
        return a
    for f in range(nf):
        for b in range(nb):
            y1 = H - f * FH - 7
            ya, xa = y1 - (FH - 13), x0 + b * BW + 4
            xb = xa + BW - 8
            r = rng.random()
            col = ('#1C2130' if r < 0.55 else '#FFC46A' if r < 0.72 else '#BFE8FF' if r < 0.8 else CYAN if r < 0.85
                   else PINK if r < 0.88 else '#55504A')
            a[ya:y1, xa:xb] = rgb(col)
            a[ya:y1, xa:xb][::4] = rgb(mix(col, '#000000', 0.25))  # blinds
            a[y1:y1 + 1, xa - 1:xb + 1] = rgb('#6A6672')  # sill
            for s in range(rng.integers(0, 3)):  # grime runs down from the sill
                sx = int(rng.integers(xa, xb))
                ln = int(rng.integers(4, FH))
                a[y1 + 1:min(H, y1 + 1 + ln), sx] = (40, 36, 44, 150)
    return a


def neon_word(text, col, rim=None, vertical=False, scale=3, pad=4):
    """Generic words in glowing tubes: the chunky 7 px capitals drawn as tubes (a pale core, the colour, a soft halo),
    stacked for a vertical sign, with a border tube in the rim colour if given."""
    gl = [B5.GLYPHS[c] for c in text]
    gw = max(len(g[0]) for g in gl)
    if vertical: W, H = gw * scale + 2 * pad, sum(8 * scale for _ in gl) + 2 * pad
    else: W, H = sum((len(g[0]) + 1) * scale for g in gl) + 2 * pad, 7 * scale + 2 * pad
    a = np.zeros((H, W, 4), np.uint8)
    on = np.zeros((H, W), bool)
    x, y = pad, pad
    for g in gl:
        gx = x + (gw - len(g[0])) * scale // 2 if vertical else x
        for j, row in enumerate(g):
            for i, v in enumerate(row):
                if v == '1': on[y + j * scale:y + (j + 1) * scale, gx + i * scale:gx + (i + 1) * scale] = True
        if vertical: y += 8 * scale
        else: x += (len(g[0]) + 1) * scale
    tube(a, on, col)
    if rim:
        b = np.zeros((H, W), bool)
        b[1, 1:-1] = b[-2, 1:-1] = b[1:-1, 1] = b[1:-1, -2] = True
        tube(a, b, rim)
    return a


def tube(a, on, col):
    """Neon tube pixels: the halo one pixel round them, the colour, a pale core where the tube is thick."""
    H, W = on.shape
    halo = np.zeros_like(on)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            halo |= np.roll(np.roll(on, dy, 0), dx, 1)
    halo &= ~on
    a[halo & (a[..., 3] == 0)] = rgb(col, 110)
    a[on] = rgb(col)
    core = on & np.roll(on, 1, 0) & np.roll(on, -1, 0) & np.roll(on, 1, 1) & np.roll(on, -1, 1)
    a[core] = rgb(mix(col, '#FFFFFF', 0.6))


def arrow(col, w=40, h=20):
    a = np.zeros((h, w, 4), np.uint8)
    on = np.zeros((h, w), bool)
    m = h // 2
    on[m - 2:m + 2, 3:w - h // 2] = True
    for i in range(h // 2 - 2):
        on[m - i - 1:m + i + 1, w - 3 - i] = True
    edge = on & ~(np.roll(on, 1, 0) & np.roll(on, -1, 0) & np.roll(on, 1, 1) & np.roll(on, -1, 1))
    tube(a, edge, col)
    return a


def holo(w, h, seed, vertical=False):
    """A holo advert with no words: a pink-to-cyan wash, a big shape, scan lines, an empty bar for the text to come."""
    rng = np.random.default_rng(seed)
    W, H = px(w), px(h)
    a = np.zeros((H, W, 4), np.uint8)
    for y in range(H):
        t = y / max(1, H - 1)
        a[y, :] = rgb(mix(PINK, CYAN, t), 200)
    yy, xx = np.mgrid[0:H, 0:W]
    cx, cy = W * (0.5 if vertical else 0.32), H * (0.3 if vertical else 0.5)
    r = min(W, H) * 0.32
    d = np.hypot(xx - cx, yy - cy)
    a[d < r] = rgb('#FFE8F6', 230)
    a[(d < r) & (d > r - 3)] = rgb(AMBER)
    a[::3, :, 3] = (a[::3, :, 3] * 0.55).astype(np.uint8)
    if vertical: a[int(H * 0.62):int(H * 0.62) + 8, 3:W - 3] = rgb('#1A1530', 220)
    else: a[int(H * 0.38):int(H * 0.62), int(W * 0.58):int(W * 0.94)] = rgb('#1A1530', 220)
    for _ in range(4):  # glitch bands
        y = int(rng.integers(0, H - 2))
        a[y:y + 2] = np.roll(a[y:y + 2], int(rng.integers(-6, 7)), 1)
    a[0, :] = a[-1, :] = a[:, 0] = a[:, -1] = rgb(CYAN)
    return a


def swirl(w, h, shape, pal, seed):
    """A portal: a pixel swirl in five tones (white at the heart), cut to its shape, a bright rim and a soft halo."""
    rng = np.random.default_rng(seed)
    W, H = px(w), px(h)
    yy, xx = np.mgrid[0:H, 0:W]
    u, v = (xx + 0.5 - W / 2) / (W / 2), (yy + 0.5 - H / 2) / (H / 2)
    if shape == 'ring': m = u * u + v * v <= 1
    elif shape == 'door': m = (np.abs(u) <= 1) & ((v >= -0.35) | (u * u + ((v + 0.35) / 0.65) ** 2 <= 1))
    elif shape == 'gate': m = (np.abs(u) <= 1) & (np.abs(v) <= 1) & (np.abs(u) + np.abs(v) <= 1.42)
    else:  # rift: a jagged tear, wide in the middle, zigzagging
        k = np.arange(H)
        prof = np.clip(1 - ((k + 0.5 - H / 2) / (H / 2)) ** 2, 0, 1) ** 0.7
        jag = rng.random(H // 4 + 2)
        wid = prof * (0.45 + 0.4 * np.repeat(jag, 4)[:H])
        off = 0.28 * np.sin(k / H * 9 + 1.3) + 0.1 * (np.repeat(rng.random(H // 6 + 2), 6)[:H] - 0.5)
        m = np.abs(u - off[:, None]) <= wid[:, None]
    r = np.hypot(u, v)
    th = np.arctan2(v, u)
    t = (th / (2 * np.pi) * 3 + 1.7 * np.log(r + 0.06) + rng.random((H, W)) * 0.08) % 1
    band = np.where(t < 0.5, 2, 3)
    band = np.where(r < 0.55, np.where(t < 0.5, 1, 2), band)
    band = np.where(r < 0.22, 0, band)
    band = np.where(r > 0.85, np.where(t < 0.5, 3, 4), band)
    a = np.zeros((H, W, 4), np.uint8)
    for i, c in enumerate(pal):
        a[m & (band == i)] = rgb(c)
    inner = m & np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1)
    a[m & ~inner] = rgb(pal[1])
    halo = np.zeros_like(m)
    for dy in (-2, -1, 0, 1, 2):
        for dx in (-2, -1, 0, 1, 2):
            halo |= np.roll(np.roll(m, dy, 0), dx, 1)
    a[halo & ~m] = rgb(pal[2], 90)
    return a


def beam(w, h, pal):
    """The light coming up out of a hole: brightest at the bottom, fading up, with motes."""
    W, H = px(w), px(h)
    a = np.zeros((H, W, 4), np.uint8)
    rng = np.random.default_rng(81)
    for y in range(H):
        t = y / (H - 1)  # 0 top, 1 bottom
        half = W / 2 * (0.55 + 0.45 * t)
        for x in range(W):
            d = abs(x + 0.5 - W / 2) / half
            if d <= 1:
                k = t ** 1.6 * (1 - d * d)
                c = pal[1] if d < 0.35 else pal[2]
                a[y, x] = rgb(c, int(255 * min(1, k * 1.3)))
    for _ in range(40):
        y, x = int(rng.integers(0, H)), int(rng.integers(W // 4, 3 * W // 4))
        a[y, x] = rgb(pal[0], 230)
    return a


def light_dot(col, n=5):
    a = np.zeros((n, n, 4), np.uint8)
    c = n // 2
    for y in range(n):
        for x in range(n):
            d = (x - c) ** 2 + (y - c) ** 2
            if d <= c * c: a[y, x] = rgb(col, 140)
            if d <= max(1, (c - 1) ** 2): a[y, x] = rgb(mix(col, '#FFFFFF', 0.5))
    return a


def strip(col, w, h=4):
    a = np.zeros((h, px(w), 4), np.uint8)
    a[:] = rgb(col, 110)
    a[1:h - 1] = rgb(col)
    a[h // 2] = rgb(mix(col, '#FFFFFF', 0.6))
    return a


def decal(L, a, name, x, y, z, glow=1, face='fixed', yaw=0, **kw):
    """A picture laid on a face, a little out from it: the front (yaw 0), the right side (pi/2), the back (pi), the left
    (-pi/2); or, face None, a billboard. The same picture used twice is saved once."""
    k = dict(glow=glow, recv=0, sway=0, name=name, **kw)
    if face: k['face'] = face
    if yaw: k['yaw'] = r2(yaw)
    L.append(img(a if isinstance(a, str) else save(a, name), x, y, z, **k))


def around(L, name, cx, w, d, z, front, side, out=0.02):
    """Pictures on all four faces of a box w wide and d deep: front and back share one picture, the sides another."""
    f = save(front, f'{name}_fb') if not isinstance(front, str) else front
    sd = save(side, f'{name}_lr') if not isinstance(side, str) else side
    decal(L, f, name, cx, -d / 2 - out, z)
    decal(L, f, name, cx, d / 2 + out, z, yaw=math.pi)
    decal(L, sd, name, cx + w / 2 + out, 0, z, yaw=math.pi / 2)
    decal(L, sd, name, cx - w / 2 - out, 0, z, yaw=-math.pi / 2)


# ---------------------------------------------------------------- the tower kit
def grimy(L, cx, w, d, z0, z1, seed, key, shop=True, balconies=False):
    """The run-down part: concrete with floor slabs, a shopfront, pipes, AC units, a fire escape, small windows."""
    rng = np.random.default_rng(seed)
    fy = -d / 2
    L.append(box(cx, 0, z0, w, d, z1 - z0, CON, 'stone', 'grimy walls'))
    z = z0 + (4.5 if shop else 3.2)
    while z < z1 - 0.5:
        L.append(box(cx, 0, z, w + 0.12, d + 0.12, 0.16, CON_D, 'stone', 'floor slab'))
        z += 3.2
    wz = z0 + (4.5 if shop else 0)
    around(L, f'{key}_lower_windows', cx, w, d, wz, facade(w - 0.8, z1 - wz, 3.2, 2.4, seed, 'grimy'),
           facade(d - 0.8, z1 - wz, 3.2, 2.4, seed + 50, 'grimy'))
    if shop:
        L += [box(cx, fy + 0.25, z0, w * 0.8, 0.5, 3.2, '#1A2030', 'plain', 'shop glass'),
              box(cx - w * 0.28, fy - 0.02, z0 + 1.6, w * 0.22, 0.08, 1.6, '#6E6A70', 'corrugated', 'shutter'),
              box(cx, fy - 0.6, z0 + 3.3, w * 0.86, 1.3, 0.14, STEEL, 'metal', 'awning')]
        decal(L, strip(PINK, w * 0.84), f'{key}_shop_strip', cx, fy - 1.26, z0 + 3.25)
    for sx in (-1, 1):  # pipes up the front corners, a run across every so often
        L.append(limb((cx + sx * (w / 2 - 0.35), fy - 0.14, z0), (cx + sx * (w / 2 - 0.35), fy - 0.14, z1), 0.11, 0.11,
                      PIPE, 'metal', 'pipe', 8))
    for z in np.arange(z0 + 6.4, z1 - 1, 9.6):
        L.append(limb((cx - w / 2 + 0.35, fy - 0.14, z), (cx + w / 2 - 0.35, fy - 0.14, z), 0.07, 0.07, PIPE, 'metal', 'pipe run', 6))
    n = int((z1 - z0) / 3.2 * w / 7)
    for _ in range(n):  # AC units on the front and on the right side
        z = float(rng.uniform(z0 + 4.6, z1 - 1))
        if rng.random() < 0.6:
            L.append(box(float(rng.uniform(cx - w / 2 + 1, cx + w / 2 - 1)), fy - 0.32, z, 0.9, 0.6, 0.66, AC, 'metal', 'ac unit'))
        else:
            L.append(box(cx + w / 2 + 0.32, float(rng.uniform(-d / 2 + 1, d / 2 - 1)), z, 0.6, 0.9, 0.66, AC, 'metal', 'ac unit'))
    ex = cx + w / 2 + 0.6  # the fire escape, up the right side
    for i, z in enumerate(np.arange(z0 + 4.5, z1 - 0.3, 3.2)):
        L.append(box(ex, 0, z, 1.1, d * 0.5, 0.08, STEEL, 'metal', 'fire escape'))
        L.append(limb((ex + 0.5, -d * 0.25, z + 1.0), (ex + 0.5, d * 0.25, z + 1.0), 0.03, 0.03, STEEL, 'metal', 'rail', 4))
        s = 1 if i % 2 else -1
        L.append(limb((ex, s * d * 0.22, z + 0.05), (ex, -s * d * 0.22, z + 3.2), 0.05, 0.05, STEEL, 'metal', 'stair', 4))
    if balconies:
        for z in np.arange(z0 + 7.7, z1 - 2, 6.4):
            for bx in np.arange(cx - w / 2 + 2.2, cx + w / 2 - 2, 4.8):
                L.append(box(float(bx), fy - 0.55, float(z), 1.8, 1.1, 0.1, STEEL, 'metal', 'balcony floor'))
                for k in range(5):
                    L.append(limb((float(bx) - 0.85 + k * 0.42, fy - 1.08, float(z)), (float(bx) - 0.85 + k * 0.42, fy - 1.08, float(z) + 2.2),
                                  0.025, 0.025, STEEL, 'metal', 'balcony cage', 4))
                L.append(box(float(bx), fy - 0.55, float(z) + 2.2, 1.8, 1.1, 0.06, STEEL, 'metal', 'balcony roof'))


def sleek(L, cx, w, d, z0, z1, seed, key):
    """The rich part: a glass shaft, chrome bands every four floors, fins on the corners, a lit curtain wall."""
    fy = -d / 2
    L.append(box(cx, 0, z0, w, d, z1 - z0, GLASS, 'panels', 'glass shaft'))
    for z in np.arange(z0 + 14.4, z1 - 1, 14.4):
        L.append(box(cx, 0, float(z), w + 0.1, d + 0.1, 0.35, CHROME, 'metal', 'chrome band'))
    for sx in (-1, 1):
        for sy in (-1, 1):
            L.append(box(cx + sx * (w / 2 - 0.1), sy * (d / 2 - 0.1), z0, 0.34, 0.34, z1 - z0, FIN, 'metal', 'fin'))
    around(L, f'{key}_glass_{int(z0)}', cx, w, d, z0 + 0.2, facade(w - 0.8, z1 - z0 - 0.4, 3.6, 1.8, seed, 'sleek'),
           facade(d - 0.8, z1 - z0 - 0.4, 3.6, 1.8, seed + 50, 'sleek'))


def ledge(L, key, cx, w, d, z, col, neon):
    L.append(box(cx, 0, z, w, d, 0.5, CHROME if col == 'chrome' else CON_D, 'metal' if col == 'chrome' else 'stone', 'ledge'))
    around(L, f'{key}_ledge_{int(z)}', cx, w, d, z + 0.15, strip(neon, w - 0.4), strip(neon, d - 0.4), out=0.03)


def antenna(L, key, x, y, z, h):
    L.append(limb((x, y, z), (x, y, z + h), 0.12, 0.04, STEEL, 'metal', 'antenna', 6))
    L.append(limb((x - 0.6, y, z + h * 0.4), (x + 0.6, y, z + h * 0.4), 0.03, 0.03, STEEL, 'metal', 'antenna arm', 4))
    decal(L, light_dot('#FF3030', 5), f'{key}_air_light', x, y, z + h - 0.05, face=None)


def tower_slab():
    k, L = 'city_tower_slab', []
    grimy(L, 0, 14, 10, 0, 20, 801, k)
    ledge(L, k, 0, 14.4, 10.4, 20, 'concrete', CYAN)
    sleek(L, 0, 12.6, 8.6, 20.5, 74, 802, k)
    L.append(box(0, 0, 74, 11.6, 7.8, 3, '#9FD8FF', 'plain', 'lit crown'))
    around(L, f'{k}_crown', 0, 11.6, 7.8, 75.2, strip(CYAN, 11.2, 6), strip(CYAN, 7.4, 6), out=0.03)
    L += [box(-3, 1, 77, 2.4, 1.6, 1.2, AC, 'metal', 'roof plant'), cyl(3, 1.5, 77, 1.2, 2.2, '#6E6A70', 'metal', 'water tank', 10)]
    antenna(L, k, 1.5, -1, 77, 13)
    return L, (14, 10)


def tower_mega():
    k, L = 'city_tower_mega', []
    grimy(L, 0, 20, 14, 0, 30, 811, k, balconies=True)
    ledge(L, k, 0, 20.4, 14.4, 30, 'concrete', AMBER)
    sleek(L, 0, 16, 11, 30.5, 66, 812, k)
    ledge(L, k, 0, 16.4, 11.4, 66, 'chrome', PINK)
    sleek(L, 0, 11, 8, 66.5, 92, 813, k)
    L += [cyl(0, 0, 92, 4.8, 0.4, STEEL, 'metal', 'landing pad', 16), cyl(0, 0, 92.4, 4.2, 0.02, '#E8C040', 'stripes', 'pad marking', 16),
          box(-3.6, 2.6, 92.4, 1.6, 1.4, 1.6, CON_D, 'stone', 'pad hut')]
    for i in range(12):
        a = i / 12 * 2 * math.pi
        decal(L, light_dot(AMBER, 3), f'{k}_pad_light', 4.6 * math.cos(a), 4.6 * math.sin(a), 92.42, face=None)
    antenna(L, k, -3.6, 2.6, 94, 6)
    return L, (20, 14)


def tower_hero():
    """The one the camera lingers on: an octagonal needle. Its logo panel stays blank until S4 names the organization."""
    k, L = 'city_tower_hero', []
    grimy(L, 0, 20, 16, 0, 14, 821, k)
    ledge(L, k, 0, 20.4, 16.4, 14, 'chrome', CYAN)
    R, rot = 7.2, r2(math.pi / 8)
    fy = -R * math.cos(math.pi / 8)
    fw = 2 * R * math.sin(math.pi / 8)
    L.append(cyl(0, 0, 14.5, R, 86, GLASS, 'panels', 'glass needle', 8, rot=rot))
    for z in np.arange(28.9, 100, 14.4):
        L.append(cyl(0, 0, float(z), R + 0.15, 0.35, CHROME, 'metal', 'chrome band', 8, rot=rot))
    for i in range(8):  # pale light strips down the needle's eight edges, so its sides read at night too
        a = (i + 0.5) / 8 * 2 * math.pi + math.pi / 8 - math.pi / 8
        L.append(box((R + 0.05) * math.cos(a), (R + 0.05) * math.sin(a), 14.5, 0.3, 0.3, 86, '#9FD8FF', 'plain', 'edge light'))
    ap = R * math.cos(math.pi / 8) + 0.03
    for i in range(8):  # the needle's eight faces (outward at i * 45 degrees; i = 6 is the front), two pictures in turn
        phi = i * math.pi / 4
        pic = save(facade(fw - 0.5, 85, 3.6, 1.8, 822 + i % 2, 'sleek'), f'{k}_needle_windows_{i % 2}')
        decal(L, pic, f'{k}_needle_windows', ap * math.cos(phi), ap * math.sin(phi), 14.7, yaw=phi + math.pi / 2 if i != 6 else 0)
    decal(L, holo(3.4, 22, 823, vertical=True), f'{k}_holo_band', 0, fy - 0.08, 44)
    L += [box(0, fy - 0.15, 83.5, fw + 0.9, 0.3, 7.4, CHROME, 'metal', 'logo frame'),
          box(0, fy - 0.3, 84, fw + 0.2, 0.3, 6.4, '#E6EBF0', 'plain', 'logo panel (blank until S4)')]
    L += [cyl(0, 0, 100.5, R, 5, GLASS_L, 'panels', 'crown taper', 8, k='cone', r1=5.2, rot=rot),
          cyl(0, 0, 105.5, 5.2, 4, '#BFE6FF', 'plain', 'lit crown', 8, rot=rot),
          cyl(0, 0, 109.5, 5.2, 13, CHROME, 'metal', 'spire', 8, k='cone', r1=0.4, rot=rot)]
    cs = save(strip(CYAN, 3.6, 6), f'{k}_crown_strip')
    for i in range(8):
        phi = i * math.pi / 4
        ac = 5.2 * math.cos(math.pi / 8) + 0.03
        decal(L, cs, f'{k}_crown_strip', ac * math.cos(phi), ac * math.sin(phi), 107, yaw=phi + math.pi / 2 if i != 6 else 0)
    antenna(L, k, 0, 0, 122.5, 4)
    return L, (20, 16)


# ---------------------------------------------------------------- signs and street things
def mast(L, h, r=0.12):
    L += [box(0, 0, 0, 0.6, 0.6, 0.3, CON_D, 'stone', 'mast foot'),
          limb((0, 0, 0.3), (0, 0, h), r, r * 0.8, STEEL, 'metal', 'mast', 8)]


def sign_hotel():
    k, L = 'city_sign_hotel', []
    mast(L, 11)
    for z in (4.0, 10.4):
        L.append(box(0, -0.25, z, 0.3, 0.5, 0.15, STEEL, 'metal', 'bracket'))
    L.append(box(0, -0.45, 3.6, 1.4, 0.35, 7.4, BLACK, 'metal', 'sign box'))
    a = neon_word('HOTEL', PINK, rim=AMBER, vertical=True, scale=4)
    decal(L, a, f'{k}_neon', 0, -0.65, 3.6 + (7.4 - a.shape[0] / PPM) / 2)
    return L


def sign_bar():
    k, L = 'city_sign_bar', []
    mast(L, 3.8)
    L += [limb((0, 0, 3.7), (2.2, 0, 3.7), 0.06, 0.06, STEEL, 'metal', 'arm', 6)]
    for x in (0.5, 1.9):
        L.append(limb((x, 0, 3.7), (x, 0, 3.0), 0.02, 0.02, STEEL, 'metal', 'hanger', 4))
    L.append(box(1.2, 0, 1.8, 2.6, 0.3, 1.2, BLACK, 'metal', 'sign box'))
    a = neon_word('BAR', CYAN, rim=PINK, scale=4)
    decal(L, a, f'{k}_neon', 1.2, -0.17, 1.8 + (1.2 - a.shape[0] / PPM) / 2)
    return L


def sign_open():
    k, L = 'city_sign_open', []
    mast(L, 2.0)
    L.append(box(0, 0, 2.0, 2.4, 0.22, 1.6, BLACK, 'metal', 'sign panel'))
    w = neon_word('OPEN', PINK, scale=3)
    decal(L, w, f'{k}_word', 0, -0.13, 2.85)
    decal(L, arrow(AMBER, 56, 22), f'{k}_arrow', 0, -0.13, 2.15)
    return L


def billboard():
    k, L = 'city_billboard', []
    for x in (-3.2, 3.2):  # truss legs with cross bracing
        for dx in (-0.35, 0.35):
            L.append(limb((x + dx, 0.3, 0), (x + dx, 0.3, 4.2), 0.06, 0.06, STEEL, 'metal', 'truss leg', 4))
        for z in (0.8, 2.2, 3.6):
            L.append(limb((x - 0.35, 0.3, z), (x + 0.35, 0.3, z + 0.7), 0.03, 0.03, STEEL, 'metal', 'truss brace', 4))
    L.append(box(0, 0.1, 4.0, 9.6, 0.4, 5.0, BLACK, 'metal', 'billboard frame'))
    decal(L, holo(9.2, 4.6, 831), f'{k}_holo', 0, -0.12, 4.2)
    for x in (-3, 0, 3):
        L += [limb((x, -0.1, 9.0), (x, -0.9, 9.3), 0.03, 0.03, STEEL, 'metal', 'spot arm', 4),
              box(x, -0.95, 9.2, 0.3, 0.3, 0.2, STEEL, 'metal', 'spot')]
    return L


def sign_blank():
    """Where the organization's logo will hang (S4's clue plan): a pale lit panel on a bracket, blank until S4."""
    k, L = 'city_sign_blank', []
    mast(L, 3.0, 0.08)
    L += [box(0, 0, 3.0, 1.9, 0.18, 1.9, CHROME, 'metal', 'frame'),
          box(0, -0.06, 3.1, 1.7, 0.1, 1.7, '#E6EBF0', 'plain', 'logo panel (blank until S4)')]
    return L


def streetlight():
    k, L = 'city_streetlight', []
    L += [box(0, 0, 0, 0.5, 0.5, 0.7, '#E8B030', 'stripes', 'hazard foot'),
          limb((0, 0, 0.7), (0, 0, 7.2), 0.1, 0.07, STEEL, 'metal', 'pole', 8),
          limb((0, 0, 7.1), (1.9, 0, 7.7), 0.06, 0.05, STEEL, 'metal', 'arm', 6),
          box(2.0, 0, 7.5, 1.3, 0.36, 0.22, STEEL, 'metal', 'head'),
          box(0, -0.12, 3.0, 0.4, 0.04, 0.6, '#C8CCD4', 'plain', 'blank plate'),
          sphere(0.12, 0, 6.2, 0.13, BLACK, 'plain', 'camera dome', 8, 4)]
    decal(L, strip(CYAN, 1.2, 5), f'{k}_bar', 2.0, 0, 7.42, face=None)
    return L


def vending():
    k, L = 'city_vending', []
    L += [box(0, 0, 0, 1.1, 0.85, 2.1, '#2A2832', 'metal', 'body'),
          box(0, -0.43, 0.15, 0.7, 0.04, 0.22, BLACK, 'plain', 'slot'),
          box(0.42, -0.44, 0.7, 0.14, 0.04, 0.4, CHROME, 'metal', 'pay pad')]
    W, H = px(0.86), px(1.5)
    a = np.zeros((H, W, 4), np.uint8)
    a[:] = rgb('#101826')
    a[:7] = rgb(AMBER)
    a[3, 3:W - 3] = rgb('#FFF0C8')
    cans = [PINK, CYAN, AMBER, '#8CF07A', '#C27CFF']
    for r in range(4):
        y = 10 + r * 9
        for c in range(4):
            x = 3 + c * 6
            if y + 6 < H: a[y:y + 6, x:x + 4] = rgb(cans[(r + c) % 5])
    a[-7:, :] = rgb('#2A2832')
    decal(L, a, f'{k}_front', 0, -0.44, 0.45)
    return L


def flying_car():
    k, L, z = 'city_flying_car', [], 2.4
    hull, top = '#3A3F4A', '#4C5260'
    L += [box(0, 0, z, 4.2, 1.8, 0.6, hull, 'metal', 'hull'),
          box(-0.3, 0, z + 0.6, 2.9, 1.6, 0.35, top, 'metal', 'upper body'),
          box(-0.1, 0, z + 0.95, 1.9, 1.4, 0.5, '#2C4460', 'plain', 'cabin glass'),
          limb((2.1, 0, z + 0.35), (2.9, 0, z + 0.3), 0.55, 0.18, hull, 'metal', 'nose', 4),
          box(-2.0, 0, z + 0.95, 0.5, 1.9, 0.12, top, 'metal', 'rear wing'),
          box(0, -0.91, z + 0.25, 3.6, 0.03, 0.08, PINK, 'plain', 'side stripe'),
          box(0, 0.91, z + 0.25, 3.6, 0.03, 0.08, PINK, 'plain', 'side stripe')]
    for x in (-1.5, 1.5):
        for y in (-0.75, 0.75):
            L.append(cyl(x, y, z - 0.25, 0.32, 0.27, BLACK, 'metal', 'hover pod', 10))
            decal(L, light_dot(CYAN, 7), f'{k}_hover', x, y, z - 0.42, face=None)
    for y in (-0.55, 0.55):
        decal(L, light_dot(AMBER, 5), f'{k}_head', 2.85, y * 0.6, z + 0.25, face=None)
        decal(L, light_dot(PINK, 5), f'{k}_tail', -2.15, y, z + 0.3, face=None)
    return L


# ---------------------------------------------------------------- the portals
def shards(L, seed, cx, cz, r, n=8):
    rng = np.random.default_rng(seed)
    for _ in range(n):
        a = rng.uniform(0, 2 * math.pi)
        d = rng.uniform(r * 0.9, r * 1.4)
        s = float(rng.uniform(0.12, 0.3))
        L.append(box(cx + d * math.cos(a), float(rng.uniform(-0.4, 0.2)), max(0.05, cz + d * math.sin(a)), s, s * 0.8, s,
                     '#6A6670', 'stone', 'floating shard'))


def portal_pics(key, w, h, shape, seed):
    """Both colourways of one portal's picture; the variant swaps the first for the second."""
    return {pal: save(swirl(w, h, shape, P, seed), f'{key}_{pal}') for pal, P in (('void', VOID), ('inner', INNER))}


def portal(key, shape, w, h, z0, extra=None):
    P = portal_pics(key, w, h, shape, sum(map(ord, key)))
    L = [img(P['void'], 0, 0, z0, face='fixed', glow=1, recv=0, sway=0, name='portal')]
    if extra: extra(L)
    return L, {P['void']: P['inner']}


def door_marks(L):
    """A door that wasn't there: a scorched threshold where it stands, a few chips of pavement lifting off."""
    L.append(box(0, 0.05, 0, 1.7, 0.5, 0.02, '#26222C', 'stone', 'scorched threshold'))
    shards(L, 843, 0, 1.2, 1.0, n=5)


def gate_frame(L):
    R, cz = 1.85, 2.15
    pts = [(R * math.cos(i / 8 * 2 * math.pi + math.pi / 8), cz + R * math.sin(i / 8 * 2 * math.pi + math.pi / 8)) for i in range(9)]
    for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
        L.append(limb((x0, -0.05, z0), (x1, -0.05, z1), 0.17, 0.17, STEEL, 'metal', 'gate frame', 6))
        L.append(box(x0, -0.05, z0 - 0.2, 0.42, 0.5, 0.4, CHROME, 'metal', 'gate joint'))
    for sx in (-1, 1):
        L += [limb((sx * 1.4, 0.1, 0.9), (sx * 1.9, 0.3, 0), 0.1, 0.1, STEEL, 'metal', 'gate leg', 6),
              box(sx * 1.9, 0.3, 0, 0.6, 0.6, 0.12, BLACK, 'metal', 'gate foot')]
    L += [box(2.9, 0.6, 0, 1.0, 0.8, 1.1, '#E8B030', 'stripes', 'generator'),
          limb((2.5, 0.6, 0.4), (1.7, 0.2, 1.2), 0.05, 0.05, BLACK, 'plain', 'cable', 4)]
    L.append(img(save(light_dot(AMBER, 5), 'portal_gate_status'), 2.9, 0.18, 0.8, glow=1, recv=0, sway=0, name='status light'))


def portal_hole():
    """The pavement gives way: broken slabs round a hole that glows, light rising out of it."""
    L = []
    rng = np.random.default_rng(851)
    for i in range(12):
        a = i / 12 * 2 * math.pi + rng.uniform(-0.1, 0.1)
        d = 1.65 + rng.uniform(-0.1, 0.2)
        L.append(box(d * math.cos(a), d * math.sin(a), float(rng.uniform(0, 0.12)), 0.8, 0.7, 0.14, '#6A6670', 'stone', 'broken slab'))
    for i in range(4):
        a = rng.uniform(0, 2 * math.pi)
        L.append(limb((1.4 * math.cos(a), 1.4 * math.sin(a), 0.08), (1.0 * math.cos(a), 1.0 * math.sin(a), -0.2), 0.02, 0.02,
                      '#7A4A3A', 'rust', 'rebar', 4))
    L.append(cyl(0, 0, 0, 1.35, 0.03, VOID[2], 'plain', 'hole light', 16))
    b = {pal: save(beam(2.6, 4.6, P), f'portal_hole_beam_{pal}') for pal, P in (('void', VOID), ('inner', INNER))}
    L.append(img(b['void'], 0, 0, 0, glow=1, recv=0, sway=0, name='beam'))
    return L, {b['void']: b['inner'], VOID[2]: INNER[2]}


# ---------------------------------------------------------------- a picture of each, for when models are off
def front_picture(L, name):
    """The model seen straight from the front (x across, z up), painted back to front; its pictures pasted in."""
    def ext(l):
        k = l['k']
        if k == 'box': return l['x'] - l['w'] / 2, l['x'] + l['w'] / 2, l['z'], l['z'] + l['h']
        if k in ('cyl', 'cone', 'sphere'):
            r = l['r']
            return l['x'] - r, l['x'] + r, l['z'] - (r if k == 'sphere' else 0), l['z'] + (r if k == 'sphere' else l['h'])
        if k == 'limb':
            return min(l['x'], l['x2']) - l['r'], max(l['x'], l['x2']) + l['r'], min(l['z'], l['z2']), max(l['z'], l['z2'])
        return None
    L = [l for l in L if not l.get('yaw')]  # only what faces the front
    pics = {}
    for l in L:
        if l['k'] == 'img':
            from PIL import Image
            im = np.array(Image.open(B1.ART / l['img']).convert('RGBA'))
            pics[id(l)] = im
    E = [ext(l) for l in L if l['k'] != 'img'] + [
        (l['x'] - pics[id(l)].shape[1] / PPM / 2, l['x'] + pics[id(l)].shape[1] / PPM / 2, l['z'], l['z'] + pics[id(l)].shape[0] / PPM)
        for l in L if l['k'] == 'img']
    x0, x1 = min(min(e[0] for e in E), 0), max(max(e[1] for e in E), 0)
    z0, z1 = min(min(e[2] for e in E), 0), max(max(e[3] for e in E), 0)
    W, H = px(x1 - x0) + 2, px(z1 - z0) + 2
    a = np.zeros((H, W, 4), np.uint8)
    X = lambda x: int(round((x - x0) * PPM))
    Z = lambda z: H - 1 - int(round((z - z0) * PPM))
    for l in sorted(L, key=lambda l: -l.get('y', 0)):
        if l['k'] == 'img':
            im = pics[id(l)]
            h, w = im.shape[:2]
            xa, ya = X(l['x']) - w // 2, Z(l['z']) - h + 1
            sub = a[max(0, ya):ya + h, max(0, xa):xa + w]
            src = im[max(0, -ya):max(0, -ya) + sub.shape[0], max(0, -xa):max(0, -xa) + sub.shape[1]]
            m = src[..., 3] > 100
            sub[m] = src[m]
            continue
        e = ext(l)
        if not e: continue
        c = rgb(l['col'])
        a[Z(e[3]):Z(e[2]) + 1, X(e[0]):X(e[1]) + 1] = c
    path = save(a, f'{name}_front')
    return path, -px(0 - x0), -px(z1)


# ---------------------------------------------------------------- the catalogue and the showcase
def entry(key, name, L, shadow, box_=None, solid=None, glow=None, variants=None):
    path, ox, oy = front_picture(L, key)
    M = {'name': name, 'img': path, 'ox': ox, 'oy': oy, 'shadow': shadow, 'sway': 0, 'flat': 0, 'tags': ['test', 'city'],
         'group': key, 'model': B1.write_recipe(key, rec(L)), 'ppm': PPM, 'vary': dict(FIXED)}
    if box_: M['box'] = list(box_)
    if solid: M['solid'] = solid
    if glow: M['glow'] = glow
    if variants: M['variants'] = variants
    return M


ROWS = [  # (row, keys, metres between them, how far back the camera stands)
    ('street', ['city_streetlight', 'city_vending', 'city_flying_car'], 7.0, 6),
    ('signs', ['city_sign_open', 'city_sign_bar', 'city_sign_hotel', 'city_billboard'], 9.0, 9),
    ('portals', ['portal_ring', 'portal_rift', 'portal_door', 'portal_gate', 'portal_hole'], 7.0, 7),
    ('portals-inner', ['portal_ring', 'portal_rift', 'portal_door', 'portal_gate', 'portal_hole'], 7.0, 7),
    ('towers', ['city_tower_slab', 'city_tower_mega', 'city_tower_hero'], 30.0, 40),
]


def showcase():
    W, H = 110, 150
    tiles = [['a'] * W for _ in range(H)]
    props, shots = [], []
    z = 10.0
    for name, keys, gap, back in ROWS:
        if name == 'towers': z += 40
        for y in range(int(z) - 3, int(z) - 1):
            tiles[y] = ['i'] * W
        x0 = W / 2 - gap * (len(keys) - 1) / 2
        for i, k in enumerate(keys):
            props.append({'k': k, 'x': round(x0 + gap * i, 2), 'z': z} | ({'v': 1} if name == 'portals-inner' else {}))
        shots += [{'x': W / 2, 'z': z - back, 'yaw': 0, 'label': name},
                  {'x': W / 2 + back * 0.6, 'z': z - back * 0.7, 'yaw': 0.9, 'label': f'{name}-turned'}]
        z += 14
    return {
        'name': 'Test: city opening mockups (phase 09 batch 8, provisional)', 'w': W, 'h': H, 'edge': 'a',
        'sky': ['#2A2E52', '#5A4E86', '#C8789A'], 'haze': '#4A4470', 'hazeD': 120, 'cam': {'pitch': 30, 'h': 12, 'fov': 1},
        'blur': 0, 'amb': None, 'plain': 1, 'tint': None, 'indoor': 0, 'far': 'town', 'farH': 8, 'folk': 0, 'test': 1,
        'exits': [], 'checks': [], 'shots': shots, 'hub': [W / 2, 2.5],
        'tiles': [''.join(r) for r in tiles], 'props': props, 'kind': 'test',
    }


# ---------------------------------------------------------------- the opening's street (Project Story S7, a draft)
def opening_map():
    """The city opening's set, small: one avenue running away from the camera between towers (a canyon), the hero
    tower closing the view at its end, a 5 m alley off to the right two thirds up where the rift opens. Not joined to
    the world (test: 1). The cutscene filmed on it (its spots, shots, lanes and script) is its own file,
    game/data/cutscenes/city.json (docs/CUTSCENES.md), not made here: this makes the set's ground and props. Owner,
    2026-10-19: this street replaces the fall's first leg. Units: metres; x across, z away from the camera."""
    W, H = 64, 130
    tiles = [['i'] * W for _ in range(H)]
    for z in range(H):
        for x in range(26, 38): tiles[z][x] = 'a'
    P = []
    left = [('city_tower_mega', 10, 10), ('city_tower_slab', 13, 24), ('city_tower_mega', 10, 40), ('city_tower_slab', 13, 54),
            ('city_tower_mega', 10, 70), ('city_tower_slab', 13, 86), ('city_tower_mega', 10, 100)]
    right = [('city_tower_slab', 51, 10), ('city_tower_mega', 54, 26), ('city_tower_slab', 51, 42), ('city_tower_slab', 51, 54),
             ('city_tower_slab', 51, 69), ('city_tower_mega', 54, 84), ('city_tower_slab', 51, 101), ('city_tower_slab', 66, 61.5)]
    for k, x, z in left + right:
        P.append({'k': k, 'x': x, 'z': z})
    P.append({'k': 'city_tower_hero', 'x': 32, 'z': 118})
    for z in range(8, 108, 12):
        P.append({'k': 'city_streetlight', 'x': 25.2, 'z': z})
        if z + 6 < 106: P.append({'k': 'city_streetlight', 'x': 38.8, 'z': z + 6, 'f': 1})
    P += [{'k': 'city_sign_open', 'x': 41.5, 'z': 30.5}, {'k': 'city_sign_hotel', 'x': 22.6, 'z': 34},
          {'k': 'city_sign_hotel', 'x': 41.8, 'z': 76}, {'k': 'city_vending', 'x': 42.2, 'z': 49.5},
          {'k': 'city_flying_car', 'x': 30, 'z': 40}, {'k': 'city_flying_car', 'x': 34, 'z': 70, 'f': 1},
          {'k': 'city_flying_car', 'x': 31, 'z': 96},
          # the ad slot, opposite the alley in the gap between two towers: its advert is one picture
          # (city_billboard_holo.png), so what it shows stays open and is changed by swapping that picture
          {'k': 'city_billboard', 'x': 20, 'z': 61}]
    # the alley: x 44 to 59, z 59 to 64, between the slabs at z 54 and z 69, closed by a slab across its end
    P += [{'k': 'city_sign_bar', 'x': 44.6, 'z': 60.0}, {'k': 'city_vending', 'x': 48.5, 'z': 63.0},
          {'k': 'puddle', 'x': 47.0, 'z': 61.4}, {'k': 'puddle', 'x': 51.5, 'z': 62.2}, {'k': 'puddle', 'x': 38.5, 'z': 44},
          {'k': 'city_sign_blank', 'x': 57.6, 'z': 60.0}, {'k': 'portal_rift', 'x': 55.6, 'z': 61.6}]
    return {
        'name': 'City opening (draft set, Project Story S7)', 'w': W, 'h': H, 'edge': 'i',
        'sky': ['#141428', '#2A2E52', '#5A4E86'], 'haze': '#3A3458', 'hazeD': 70, 'cam': {'pitch': 30, 'h': 12, 'fov': 1},
        'blur': 0, 'amb': None, 'tint': None, 'indoor': 0, 'far': 'town', 'farH': 8, 'folk': 0, 'test': 1,
        'exits': [], 'checks': [], 'hub': [32, 4], 'tiles': [''.join(r) for r in tiles], 'props': P, 'kind': 'test',
    }


def main():
    for f in OUT.glob('*.png') if OUT.exists() else []: f.unlink()
    D = gamedata.load()
    C = D['scenery']['props']
    glow = lambda c, y, r=3.0, day=0.12: {'c': c, 'r': r, 'y': y, 'day': day}
    for key, name, fn in (('city_tower_slab', 'City tower: slab (mockup)', tower_slab),
                          ('city_tower_mega', 'City tower: megablock (mockup)', tower_mega),
                          ('city_tower_hero', 'City tower: hero needle (mockup)', tower_hero)):
        L, fp = fn()
        C[key] = entry(key, name, L, 3.0, box_=fp)
    C['city_sign_hotel'] = entry('city_sign_hotel', 'City sign: hotel blade (mockup)', sign_hotel(), 0.4, solid=0.4, glow=glow(PINK, 7.3))
    C['city_sign_bar'] = entry('city_sign_bar', 'City sign: bar (mockup)', sign_bar(), 0.4, solid=0.4, glow=glow(CYAN, 2.4))
    C['city_sign_open'] = entry('city_sign_open', 'City sign: open arrow (mockup)', sign_open(), 0.4, solid=0.4, glow=glow(AMBER, 2.8))
    C['city_billboard'] = entry('city_billboard', 'City billboard (mockup)', billboard(), 1.2, box_=(9.6, 0.8), glow=glow(PINK, 6.5, 4.0))
    C['city_sign_blank'] = entry('city_sign_blank', 'City sign: logo spot, blank until S4 (mockup)', sign_blank(), 0.3, solid=0.3,
                                 glow=glow('#E6EBF0', 3.9, 1.6, 0.05))
    C['city_streetlight'] = entry('city_streetlight', 'City street light (mockup)', streetlight(), 0.3, solid=0.3, glow=glow(CYAN, 7.4))
    C['city_vending'] = entry('city_vending', 'Vending machine (mockup)', vending(), 0.5, box_=(1.1, 0.85), glow=glow(PINK, 1.6, 2.0))
    C['city_flying_car'] = entry('city_flying_car', 'Flying car (mockup)', flying_car(), 1.0, glow=glow(CYAN, 2.2))
    for key, name, shape, w, h, z0, extra in (
            ('portal_ring', 'Portal: ring (mockup)', 'ring', 3.2, 3.2, 0.35, lambda L: shards(L, 841, 0, 1.95, 1.7)),
            ('portal_rift', 'Portal: rift (mockup)', 'rift', 1.8, 3.8, 0.15, lambda L: shards(L, 842, 0, 2.0, 1.2)),
            ('portal_door', 'Portal: door (mockup)', 'door', 1.4, 2.7, 0.0, door_marks),
            ('portal_gate', 'Portal: machine gate (mockup)', 'gate', 3.3, 3.3, 0.5, gate_frame)):
        L, sw = portal(key, shape, w, h, z0, extra)
        C[key] = entry(key, name, L, 0.6, glow=glow(VOID[2], h / 2 + z0, 3.5, 0.4),
                       variants=[{'swap': sw, 'glow': glow(INNER[2], h / 2 + z0, 3.5, 0.4), 'name': name.replace('(mockup)', '(inner light, mockup)')}])
    L, sw = portal_hole()
    C['portal_hole'] = entry('portal_hole', 'Portal: hole in the pavement (mockup)', L, 0.6, glow=glow(VOID[2], 1.2, 3.5, 0.4),
                             variants=[{'swap': sw, 'glow': glow(INNER[2], 1.2, 3.5, 0.4), 'name': 'Portal: hole in the pavement (inner light, mockup)'}])
    D['maps']['test_props_city'] = showcase()
    D['maps']['city_opening'] = opening_map()
    gamedata.save(D)
    print('city mockups:', ', '.join(k for k in C if k.startswith(('city_', 'portal_'))))


if __name__ == '__main__':
    main()
