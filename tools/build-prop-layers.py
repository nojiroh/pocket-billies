"""Layered trees and bushes (v13, redone in v17).

Every tree and bush stands as three pictures at slightly different depths, so the crown looks round when the camera
moves or turns:
  back   the crown, grown by two pixels and darkened, set back by about a fifth of the crown's width (sways less)
  main   the picture itself (trunk and crown; the only one that casts a shadow)
  front  the sunlit outer leaf clumps, with their own dark edge, set forward by about a seventh (sways more)
The layers go on the props themselves (every tree and bush in every scene uses them; v13 only had separate "_deep"
copies near Sundown's square). Writes game/art/scene/props/layers/<prop>_lb.png and <prop>_lf.png (missing files
only, unless --force) and game/art/scene/layers.json, which tools/build-scenes.py puts into game data.

    python3 tools/build-prop-layers.py [--force]
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'game' / 'art'
PPU = 34


def crown_rows(a, bush):
    """the rows that are canopy: from the top down to where the opaque width shrinks to the trunk"""
    w = a.sum(1); rows = np.nonzero(w)[0]; top = rows[0]
    if bush: return top, rows[-1] + 1
    mx = w.max(); cut = rows[-1]
    for y in range(int(np.argmax(w)), rows[-1] + 1):
        if w[y] < mx * .3: cut = y; break
    return top, cut


def dilate(m, n):
    for _ in range(n):
        m = m | np.roll(m, 1, 0) | np.roll(m, -1, 0) | np.roll(m, 1, 1) | np.roll(m, -1, 1)
    return m


def layers_for(k, im, bush):
    a = im[..., 3] > 0
    top, cut = crown_rows(a, bush)
    crown = im.copy(); crown[cut:] = 0
    if not bush:
        for y in range(max(top, cut - 6), cut): crown[y, :, 3] = (crown[y, :, 3] * ((cut - y) / 6)).astype(np.uint8)
    cm = crown[..., 3] > 0
    # back: a grown, darker crown (a rim of shade behind the leaves)
    pad = 3; H, W = cm.shape
    big = np.zeros((H + 2 * pad, W + 2 * pad), bool); big[pad:-pad, pad:-pad] = cm
    grown = dilate(big, 2)[pad:-pad, pad:-pad] & ~(np.arange(H)[:, None] >= cut)
    back = np.zeros_like(im)
    src = crown.copy()
    # fill the grown rim with the nearest crown colour
    fill = src.copy()
    for _ in range(3):
        m = fill[..., 3] > 0
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh = np.roll(np.roll(fill, dy, 0), dx, 1); add = (~m) & (sh[..., 3] > 0)
            fill[add] = sh[add]; m = fill[..., 3] > 0
    back[grown] = fill[grown]
    back[..., :3] = (back[..., :3].astype(float) * [.6, .66, .78]).astype(np.uint8); back[grown, 3] = 255
    # front: the brighter outer clumps, eroded a little, with their own dark edge inside the crown
    lum = crown[..., :3].astype(float) @ [.3, .59, .11]
    if cm.sum() < 20: return None
    thr = np.percentile(lum[cm], 45)
    fm = cm & (lum >= thr)
    # keep clumps away from the very bottom of the crown, where the trunk shows through
    rows = np.arange(H)[:, None]
    fm &= rows < top + (cut - top) * .9
    # drop specks: a pixel stays if most of its neighbours stay
    nb = sum(np.roll(np.roll(fm, dy, 0), dx, 1).astype(int) for dy in (-1, 0, 1) for dx in (-1, 0, 1))
    fm &= nb >= 6
    front = np.zeros_like(im); front[fm] = crown[fm]
    edge = dilate(fm, 1) & ~fm & cm
    dk = (crown[..., :3].astype(float) * [.5, .55, .68]).astype(np.uint8)
    front[edge, :3] = dk[edge]; front[edge, 3] = 255
    return back, front, (top, cut)


def main():
    force = '--force' in sys.argv
    P = json.loads((ART / 'scene' / 'props.json').read_text())
    out = ART / 'scene' / 'props' / 'layers'; out.mkdir(parents=True, exist_ok=True)
    res = {}
    for k, m in P.items():
        g = m.get('group', k); n = g + ' ' + k
        tree = n.startswith('tree') or ' tree' in n
        bush = any(w in n for w in ('bush', 'hedge'))
        if not (tree or bush) or m.get('flat'): continue
        f = ART / 'scene' / 'props' / f'{k}.png'
        if not f.exists(): continue
        im = np.asarray(Image.open(f).convert('RGBA')).copy()
        L = layers_for(k, im, bush)
        if not L: continue
        back, front, (top, cut) = L
        cw = (np.ptp(np.nonzero((im[top:cut, :, 3] > 0).any(0))[0]) + 1) / PPU
        for suf, arr in (('lb', back), ('lf', front)):
            p = out / f'{k}_{suf}.png'
            if force or not p.exists(): Image.fromarray(arr, 'RGBA').save(p, optimize=True)
        db, df = (round(min(.6, cw * .2), 2), round(-min(.45, cw * .14), 2)) if tree else (round(min(.3, cw * .16), 2), round(-min(.22, cw * .12), 2))
        res[k] = [{'img': f'scene/props/layers/{k}_lb.png', 'dz': db, 'sway': .7, 'shadow': 0},
                  {'img': f'scene/props/layers/{k}_lf.png', 'dz': df, 'sway': 1.4, 'shadow': 0}]
    (ART / 'scene' / 'layers.json').write_text(json.dumps(res, indent=1))
    print(f'layers for {len(res)} trees and bushes')


if __name__ == '__main__':
    main()
