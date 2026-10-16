"""Assemble parts on the skeleton (no animation) for checking the art."""
import numpy as np
from PIL import Image
from body import SKEL, BS


def joints(view):
    J = {}
    for n, p, at, z, c in SKEL[view]:
        px, py = J[p] if p else (0, 0)
        J[n] = (px + at[0] * BS, py + at[1] * BS)
    return J


def compose(view, layers, W=96, H=150, scale=3, bg=(236, 232, 222)):
    """layers: list of (z, bone, Canvas). Feet centre at (W/2, H-6)."""
    J = joints(view)
    out = np.zeros((H, W, 4), float); out[..., :3] = bg; out[..., 3] = 255
    for z, bone, cv in sorted(layers, key=lambda t: t[0]):
        jx, jy = J[bone]
        X0 = int(round(W / 2 + jx - cv.jx)); Y0 = int(round(H - 6 + jy - cv.jy))
        for y in range(cv.h):
            Y = Y0 + y
            if not 0 <= Y < H: continue
            for x in range(cv.w):
                X = X0 + x
                if 0 <= X < W and cv.rgba[y, x, 3] > 0:
                    out[Y, X, :3] = cv.rgba[y, x, :3]
    im = Image.fromarray(out.astype(np.uint8), 'RGBA')
    return im.resize((W * scale, H * scale), Image.NEAREST)


def sheet(ims, pad=8, bg=(236, 232, 222, 255)):
    W = sum(i.width for i in ims) + pad * (len(ims) + 1); H = max(i.height for i in ims) + pad * 2
    s = Image.new('RGBA', (W, H), bg); x = pad
    for i in ims: s.paste(i, (x, pad)); x += i.width + pad
    return s
