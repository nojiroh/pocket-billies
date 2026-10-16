"""Makes game/art/map/world_h.png, the height of the land for the 3D world map, from the painted map
game/art/map/world.png: sea is flat, coasts rise gently, grass rolls, forests and sandy uplands are hills, snow is
highest. Detail noise roughens the land so mountains get ridges. Run it again after repainting the world map.

    python3 tools/build-world-relief.py
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'game' / 'art' / 'map' / 'world.png'
OUT = ROOT / 'game' / 'art' / 'map' / 'world_h.png'
W, H = 1024, 512


def classify(rgb):
    r, g, b = [rgb[..., i].astype(float) for i in range(3)]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); sat = (mx - mn) / np.maximum(mx, 1)
    h = np.full(r.shape, .30)                                   # land
    water = (b > r + 40) & (b > g + 20)
    coast = (np.abs(r - g) < 30) & (b > r + 15) & (b - r < 70) & (mx > 120)
    snow = (mn > 200) & (sat < .12)
    sand = (r > g) & (g > b + 20) & (r > 170)
    forest = (g > r + 15) & (g > b) & (mx < 120)
    meadow = (g > r) & (g > b) & ~forest
    # v24: bare rock (the snowy range) and dark volcanic slopes stand high too
    rock = (sat < .12) & (mx > 110) & (mx < 200) & ~snow
    volc = (mx < 125) & (sat < .3) & (r >= g) & ~forest
    lava = (r > 200) & (g < 180) & (b < 110) & (r > g + 50)
    h[meadow] = .26; h[forest] = .48; h[sand] = .58; h[rock] = .7; h[volc] = .8; h[lava] = .84; h[snow] = .9; h[coast] = .06; h[water] = 0.
    return h, water


def fbm(shape, seed=7, octaves=5):
    rng = np.random.default_rng(seed); out = np.zeros(shape); amp = 1.; tot = 0.
    for o in range(octaves):
        n = 4 * 2 ** o; g = rng.random((n // 2 + 1, n + 1))
        g[:, -1] = g[:, 0]  # wraps around the longitude
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((shape[1], shape[0]), Image.BICUBIC)
        out += np.asarray(im, float) / 255 * amp; tot += amp; amp *= .5
    return out / tot


def main():
    src = np.asarray(Image.open(SRC).convert('RGB').resize((W, H), Image.BOX))
    h, water = classify(src)
    # soften the painted patches into hills, wrapping east-west
    pad = np.concatenate([h[:, -64:], h, h[:, :64]], 1)
    im = Image.fromarray((pad * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(7))
    h = np.asarray(im, float)[:, 64:-64] / 255
    n = fbm((H, W)); ridge = 1 - np.abs(n * 2 - 1)
    land = ~water
    h = h * (.7 + .6 * n) + np.clip(h - .35, 0, 1) * ridge * .9
    h = np.where(land, np.clip(h - .05, 0, None), 0)  # blurred shores already slope down to the sea
    h = np.clip(h / max(h.max(), 1e-6), 0, 1)
    Image.fromarray((h * 255).astype(np.uint8), 'L').save(OUT, optimize=True)
    print('wrote', OUT.relative_to(ROOT), f'{W}x{H}')


if __name__ == '__main__':
    main()
