"""Pixel-art helpers for the trainer generator: shapes to masks, cel shading with a dark outline,
colour ramps, and parts that know where their joint is."""
import colorsys, math
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

LIGHT = np.array([-0.52, -0.62, 0.58]); LIGHT = LIGHT / np.linalg.norm(LIGHT)


def hx(h):
    h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def to_hex(c):
    return '#%02X%02X%02X' % tuple(int(max(0, min(255, round(v)))) for v in c)


def mix(a, b, t):
    return a * (1 - t) + b * t


def ramp(base):
    """five tones, darkest first: outline, deep shade, shade, base, light. Shadows lean cool, lights warm."""
    b = hx(base)
    r, g, bl = b / 255
    h, l, s = colorsys.rgb_to_hls(r, g, bl)
    def hls(dh, dl, ds):
        rr, gg, bb = colorsys.hls_to_rgb((h + dh) % 1, max(0, min(1, l + dl)), max(0, min(1, s * ds)))
        return np.array([rr, gg, bb]) * 255
    cool = 0.025 if (h > 0.5 or h < 0.12) else -0.02
    out = mix(hls(cool * 2, -0.36 - l * 0.12, 1.05), hx('#1C1630'), 0.35)
    deep = mix(hls(cool * 1.4, -0.2, 1.05), hx('#2E2550'), 0.12)
    shade = hls(cool * 0.7, -0.1, 1.02)
    light = mix(hls(-cool * 0.5, 0.09 + (1 - l) * 0.04, 0.95), hx('#FFF2D8'), 0.12)
    return [out, deep, shade, b, light]


class Canvas:
    """one bone's picture: RGBA pixels plus a colour-area channel per pixel (0 = fixed colour)."""
    def __init__(self, w, h, jx, jy, k=1.0):
        """w, h, jx, jy in design units; k = pixels per design unit (the head is drawn bigger than the body)"""
        self.k = k; self.w, self.h, self.jx, self.jy = int(round(w * k)), int(round(h * k)), jx * k, jy * k
        w, h = self.w, self.h
        self.rgba = np.zeros((h, w, 4), float)
        self.ch = np.zeros((h, w), np.uint8)

    def poly_mask(self, pts):
        im = Image.new('L', (self.w, self.h), 0)
        k = self.k; ImageDraw.Draw(im).polygon([(self.jx + x * k - .5, self.jy + y * k - .5) for x, y in pts], fill=255)
        return np.array(im) > 127

    def ell_mask(self, cx, cy, rx, ry):
        yy, xx = np.mgrid[0:self.h, 0:self.w]
        k = self.k; X = xx + .5 - (self.jx + cx * k); Y = yy + .5 - (self.jy + cy * k)
        return (X / max(rx * k, .01)) ** 2 + (Y / max(ry * k, .01)) ** 2 <= 1

    def rect_mask(self, x0, y0, x1, y1):
        m = np.zeros((self.h, self.w), bool)
        k = self.k; a, b = int(round(self.jy + y0 * k)), int(round(self.jy + y1 * k)); c, d = int(round(self.jx + x0 * k)), int(round(self.jx + x1 * k))
        m[max(0, a):max(0, b), max(0, c):max(0, d)] = True
        return m

    def yband(self, y0, y1):
        k = self.k; m = np.zeros((self.h, self.w), bool); a, b = int(round(self.jy + y0 * k)), int(round(self.jy + y1 * k))
        m[max(0, a):max(0, b), :] = True; return m

    def xband(self, x0, x1):
        k = self.k; m = np.zeros((self.h, self.w), bool); a, b = int(round(self.jx + x0 * k)), int(round(self.jx + x1 * k))
        m[:, max(0, a):max(0, b)] = True; return m

    def paint(self, mask, base, ch=0, outline=True, soft=None, light=None, flat=False, olcol=None, open_top=None, open_bottom=None):
        """cel-shade a mask in a colour's ramp and lay it over what's there"""
        if not mask.any(): return
        R = ramp(base)
        if flat:
            tone = np.full(mask.shape, 3)
        else:
            if soft is None:
                soft = max(.9, min(3.2, ndimage.distance_transform_edt(mask).max() * .55))
            bl = ndimage.gaussian_filter(mask.astype(float), soft)
            gy, gx = np.gradient(bl)
            n = np.stack([-gx * 3.2, -gy * 3.2, np.full(gx.shape, .55)], -1)
            n /= np.linalg.norm(n, axis=-1, keepdims=True)
            L = light if light is not None else LIGHT
            it = (n * L).sum(-1)
            tone = np.where(it > .62, 4, np.where(it > .33, 3, np.where(it > .08, 2, 1)))
        if outline:
            edge = mask & ~ndimage.binary_erosion(mask)
            # a joint end tucked under the next part keeps a soft edge instead of a hard line
            if open_top is not None: edge &= ~self.yband(-99, open_top)
            if open_bottom is not None: edge &= ~self.yband(open_bottom, 99)
            tone = np.where(edge, 0, tone)
        cols = np.array(R)
        px = cols[tone]
        if outline and olcol is not None:
            px[edge] = hx(olcol)
        self.rgba[mask, :3] = px[mask]; self.rgba[mask, 3] = 255; self.ch[mask] = ch

    def dots(self, pts, col, ch=0):
        for x, y in pts:
            X, Y = int(round(self.jx + x * self.k - .5)), int(round(self.jy + y * self.k - .5))
            if 0 <= X < self.w and 0 <= Y < self.h:
                self.rgba[Y, X, :3] = hx(col); self.rgba[Y, X, 3] = 255; self.ch[Y, X] = ch

    def line(self, pts, col, ch=0, only=None):
        """a 1-pixel line through points (inside `only` mask when given)"""
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            k = self.k; n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2 * k) + 1
            for i in range(n + 1):
                t = i / max(1, n); X = int(round(self.jx + (x0 + (x1 - x0) * t) * k - .5)); Y = int(round(self.jy + (y0 + (y1 - y0) * t) * k - .5))
                if 0 <= X < self.w and 0 <= Y < self.h and (only is None or only[Y, X]):
                    self.rgba[Y, X, :3] = hx(col); self.rgba[Y, X, 3] = 255; self.ch[Y, X] = ch

    def tint_line(self, pts, tone, only=None):
        """darken/lighten existing pixels along a line by stepping their ramp (for seams and folds)"""
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            k = self.k; n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2 * k) + 1
            for i in range(n + 1):
                t = i / max(1, n); X = int(round(self.jx + (x0 + (x1 - x0) * t) * k - .5)); Y = int(round(self.jy + (y0 + (y1 - y0) * t) * k - .5))
                if 0 <= X < self.w and 0 <= Y < self.h and self.rgba[Y, X, 3] > 0 and (only is None or only[Y, X]):
                    self.rgba[Y, X, :3] = np.clip(self.rgba[Y, X, :3] * tone, 0, 255)

    def pat(self, rows, cx, cy, pal, mirror=False):
        """stamp a little pixel pattern (list of strings) centred on local (cx, cy); pal: char -> (hex, channel)"""
        h = len(rows); w = max(len(r) for r in rows)
        X0 = int(round(self.jx + cx * self.k - w / 2)); Y0 = int(round(self.jy + cy * self.k - h / 2))
        for j, r in enumerate(rows):
            for i, c in enumerate(r):
                if c not in pal: continue
                col, ch = pal[c]; X = X0 + (w - 1 - i if mirror else i); Y = Y0 + j
                if 0 <= X < self.w and 0 <= Y < self.h:
                    if col is None: self.rgba[Y, X] = 0; self.ch[Y, X] = 0; continue
                    self.rgba[Y, X, :3] = hx(col) if isinstance(col, str) else col; self.rgba[Y, X, 3] = 255; self.ch[Y, X] = ch

    def shade_px(self, x, y, f):
        """darken/lighten one existing pixel at local design coords"""
        X, Y = int(round(self.jx + x * self.k - .5)), int(round(self.jy + y * self.k - .5))
        if 0 <= X < self.w and 0 <= Y < self.h and self.rgba[Y, X, 3] > 0: self.rgba[Y, X, :3] = np.clip(self.rgba[Y, X, :3] * f, 0, 255)

    def erase(self, mask):
        self.rgba[mask] = 0; self.ch[mask] = 0

    def opaque(self):
        return self.rgba[..., 3] > 0

    def crop(self):
        """tight box: (rgba uint8, channel mask image, ox, oy) with ox/oy the top-left relative to the joint"""
        a = self.opaque()
        if not a.any(): return None
        ys, xs = np.where(a); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        rgba = self.rgba[y0:y1, x0:x1].astype(np.uint8)
        chm = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
        c = self.ch[y0:y1, x0:x1]
        for k, col in ((1, (255, 0, 0)), (2, (0, 255, 0)), (3, (0, 0, 255))):
            sel = c == k; chm[sel, :3] = col; chm[sel, 3] = 255
        return rgba, chm, int(x0 - self.jx), int(y0 - self.jy)


def capsule(x0, y0, x1, y1, r0, r1, n=10):
    """a limb segment: rounded at both ends"""
    ang = math.atan2(y1 - y0, x1 - x0); pts = []
    for i in range(n + 1):
        a = ang + math.pi / 2 + math.pi * i / n; pts.append((x0 + math.cos(a) * r0, y0 + math.sin(a) * r0))
    for i in range(n + 1):
        a = ang - math.pi / 2 + math.pi * i / n; pts.append((x1 + math.cos(a) * r1, y1 + math.sin(a) * r1))
    return pts


def smooth_poly(pts, n=3):
    """rounded corners by Chaikin smoothing"""
    for _ in range(n):
        out = []
        for i in range(len(pts)):
            p, q = pts[i], pts[(i + 1) % len(pts)]
            out += [(p[0] * .75 + q[0] * .25, p[1] * .75 + q[1] * .25), (p[0] * .25 + q[0] * .75, p[1] * .25 + q[1] * .75)]
        pts = out
    return pts


def grow_mask(m, g):
    if g > 0: return ndimage.binary_dilation(m, iterations=g)
    if g < 0: return ndimage.binary_erosion(m, iterations=-g)
    return m
