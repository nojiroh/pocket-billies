"""v36b: a small pixel-art kit for the puppet piece sheets. Everything paints with palette ramps (game/art/next/palette.js)
in the style guide's rules: cel shading lit from the top left in four tones (deep shade, shade, base, highlight), a
rim light along the lower right, fur or feather fringes, sel-out outlines (the ramp's darkest step), ink only around
eyes and mouths. A Piece is one canvas; the sheet builder packs them."""
import json, math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
NEXT = ROOT / 'game' / 'art' / 'next'
INK = (24, 20, 34, 255)
WHITE = (255, 255, 255, 255)
EYEW = (246, 244, 250, 255)

def palette():
    js = (NEXT / 'palette.js').read_text(); d = json.loads(js[js.index('=') + 1:js.rindex(';')])
    return {k: [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in v] for k, v in d['ramps'].items() if isinstance(v, list)}
P = palette()
def C(ramp, step): return P[ramp][max(0, min(7, step))] + (255,)
def ramp_of(col):
    c = col[:3]
    for r, cs in P.items():
        if c in cs: return r, cs.index(c)
    return None, None

class Piece:
    def __init__(self, w, h): self.w, self.h = w, h; self.im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    def px(self): return self.im.load()
    def dot(self, col, x, y, w=1, h=1):
        p = self.im.load()
        for yy in range(int(y), int(y + h)):
            for xx in range(int(x), int(x + w)):
                if 0 <= xx < self.w and 0 <= yy < self.h: p[xx, yy] = col
    # ---- shaded blob: the workhorse ----
    def blob(self, ramp, cx, cy, rx, ry, step=3, light=(-0.55, -0.83), rim=True, deep=True, hi=True, fur=0, flat=False, mask=None, tilt=0.0):
        p = self.im.load(); lx, ly = light; ct, st_ = math.cos(tilt), math.sin(tilt)
        for y in range(max(0, int(cy - ry - rx - 1)), min(self.h, int(cy + ry + rx + 2))):
            for x in range(max(0, int(cx - rx - ry - 1)), min(self.w, int(cx + rx + ry + 2))):
                dx, dy = x + .5 - cx, y + .5 - cy
                u, v = (dx * ct + dy * st_) / rx, (-dx * st_ + dy * ct) / ry; d = u * u + v * v
                if d > 1: continue
                if mask and not mask(x, y): continue
                s = step
                if not flat:
                    l = -(u * lx + v * ly)
                    if deep and l < -0.82 and d > 0.55: s = step - 2
                    elif l < -0.36 and d > 0.12: s = step - 1
                    elif hi and l > 0.70 and d > 0.30: s = step + 1
                    if rim and l < -0.55 and d > 0.86: s = step  # rim light on the dark edge: lifts it off the background
                p[x, y] = C(ramp, s)
        if fur: self.fringe(fur)
        return self
    def fringe(self, n=1, every=3, phase=0):
        """serrate the lowest edge: tufts of fur"""
        p = self.im.load()
        for x in range(self.w):
            if (x + phase) // every % 2 == 0: continue
            ys = [y for y in range(self.h) if p[x, y][3]]
            if not ys: continue
            yb = ys[-1]
            for k in range(n):
                if yb - k >= 0: p[x, yb - k] = (0, 0, 0, 0)
    def strokes(self, ramp, step, pts, length=2, vertical=True):
        """short fur strokes in a shade tone, only over pixels already painted"""
        p = self.im.load()
        for (x, y) in pts:
            for k in range(length):
                xx, yy = (x, y + k) if vertical else (x + k, y)
                if 0 <= xx < self.w and 0 <= yy < self.h and p[xx, yy][3]: p[xx, yy] = C(ramp, step)
    def poly(self, ramp, pts, step=3, shade=True):
        d = ImageDraw.Draw(self.im); d.polygon(pts, fill=C(ramp, step))
        if shade:
            p = self.im.load(); x0 = min(q[0] for q in pts); x1 = max(q[0] for q in pts); y0 = min(q[1] for q in pts); y1 = max(q[1] for q in pts)
            for y in range(max(0, int(y0)), min(self.h, int(y1) + 1)):
                for x in range(max(0, int(x0)), min(self.w, int(x1) + 1)):
                    if p[x, y] == C(ramp, step) and (x - x0) / max(1, x1 - x0) + (y - y0) / max(1, y1 - y0) > 1.15: p[x, y] = C(ramp, step - 1)
        return self
    def rrect(self, ramp, x0, y0, w, h, r=2, step=3, shade=True):
        p = self.im.load()
        for y in range(max(0, y0), min(self.h, y0 + h)):
            for x in range(max(0, x0), min(self.w, x0 + w)):
                cxr = min(x - x0, x0 + w - 1 - x); cyr = min(y - y0, y0 + h - 1 - y)
                if cxr < r and cyr < r and (r - cxr) ** 2 + (r - cyr) ** 2 > r * r + 1: continue
                s = step
                if shade:
                    if x >= x0 + w - 2 or y >= y0 + h - 2: s = step - 1
                    if (x == x0 + 1 or y == y0 + 1) and not (x >= x0 + w - 2 or y >= y0 + h - 2): s = step + 1
                p[x, y] = C(ramp, s)
        return self
    def line(self, col, x0, y0, x1, y1):
        d = ImageDraw.Draw(self.im); d.line([(x0, y0), (x1, y1)], fill=col, width=1); return self
    def paste(self, other, x, y): self.im.alpha_composite(other.im, (int(x), int(y))); return self
    def flip(self):
        o = Piece(self.w, self.h); o.im = self.im.transpose(Image.FLIP_LEFT_RIGHT); return o
    def outline(self, ink_ramps=()):
        src = self.im.load(); out = self.im.copy(); dst = out.load()
        for y in range(self.h):
            for x in range(self.w):
                if src[x, y][3] == 0: continue
                edge = any(not (0 <= x + dx < self.w and 0 <= y + dy < self.h) or src[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                if not edge: continue
                r, s = ramp_of(src[x, y])
                if r is None or r in ink_ramps or src[x, y] == INK: dst[x, y] = INK
                else: dst[x, y] = C(r, 0)
        self.im = out; return self
    def bbox(self): return self.im.getbbox()

# ---- eyes and faces ----
def eye(pc, x, y, w, h, iris='cobalt', kind='idle', brow=None):
    """an anime eye at (x,y) of w x h: white, two-tone iris, pupil, two highlights, upper lid; kinds idle, blink, happy, hurt"""
    if kind == 'blink':
        pc.dot(INK, x, y + h // 2, w, 1); pc.dot(INK, x, y + h // 2 - 1, 1, 1); pc.dot(INK, x + w - 1, y + h // 2 - 1, 1, 1)
    elif kind == 'happy':
        for i in range(w): pc.dot(INK, x + i, y + h // 2 - round(math.sin(i / max(1, w - 1) * math.pi) * (h * .45)))
    elif kind == 'hurt':
        pc.dot(INK, x, y + h // 2 + 1, w, 1)
        for i in range(w // 2): pc.dot(INK, x + i, y + h // 2 - i // 2); pc.dot(INK, x + w - 1 - i, y + h // 2 - i // 2)
    else:
        pc.dot(EYEW, x, y, w, h)
        iw = max(2, w - 2); ix = x + 1; iy = y + 1; ih = h - 1
        pc.dot(C(iris, 4), ix, iy, iw, ih)                      # iris light
        pc.dot(C(iris, 2), ix, iy + ih // 2, iw, ih - ih // 2)  # iris dark lower half
        pw = max(1, iw // 2); pc.dot(INK, ix + (iw - pw) // 2, iy + ih // 3, pw, max(1, ih // 2))  # pupil
        pc.dot(WHITE, x + 1, y + 1, max(1, w // 3), max(1, h // 4))                                # big highlight
        pc.dot(WHITE, x + w - 2, y + h - 2, 1, 1)                                                   # small lower highlight
        pc.dot(INK, x, y, w, 1); pc.dot(INK, x, y, 1, 1)                                            # upper lid
        if h > 6: pc.dot(C(iris, 1), x, y + 1, w, 1)
    if brow is not None:
        bx0, bx1, dy = brow
        pc.line(INK, x + bx0, y - 2 - dy, x + bx1, y - 2 + dy)

def face(w, h, kind, iris, eye_w=None, eye_h=None, gap=None, mouth=True, brow=True, cheeks=None, nose=None):
    """a face piece w x h: two eyes, brows, nose, mouth, optional cheek spots"""
    pc = Piece(w, h); ew = eye_w or max(5, w // 3); eh = eye_h or max(6, int(h * .55)); g = gap if gap is not None else max(3, w // 6); cx = w // 2
    br = {'idle': (0, ew - 1, 0), 'blink': (0, ew - 1, 0), 'happy': (0, ew - 1, -1), 'hurt': (0, ew - 1, 1)}[kind] if brow else None
    eye(pc, cx - g // 2 - ew, 1, ew, eh, iris, kind, br)
    eye(pc, cx + g // 2, 1, ew, eh, iris, kind, (br[0], br[1], -br[2]) if br else None)
    my = 1 + eh + max(1, h // 8)
    if nose: pc.dot(C(nose, 1), cx - 1, my - 1, 3, 2); pc.dot(C(nose, 3), cx - 1, my - 1, 1, 1)
    if mouth:
        my2 = my + (2 if nose else 0)
        if kind == 'happy': pc.dot(INK, cx - 2, my2, 5, 1); pc.dot(INK, cx - 3, my2 - 1); pc.dot(INK, cx + 3, my2 - 1); pc.dot(C('rose', 3), cx - 1, my2 + 1, 3, 1)
        elif kind == 'hurt': pc.dot(INK, cx - 2, my2 + 1, 2, 1); pc.dot(INK, cx, my2, 2, 1); pc.dot(INK, cx + 2, my2 + 1, 1, 1)
        else: pc.dot(INK, cx - 1, my2, 3, 1)
    if cheeks: pc.dot(C(cheeks, 5), cx - g // 2 - ew - 1, my - 1, 2, 1); pc.dot(C(cheeks, 5), cx + g // 2 + ew - 1, my - 1, 2, 1)
    return pc

# ---- common props ----
def horn_curl(pc, ramp, x, y, size, left=True, step=4):
    """a muskox-style curled horn: a boss, a curve out and down, a pale tip"""
    s = size; d = -1 if left else 1
    pc.blob(ramp, x, y, s * .55, s * .45, step - 1)                      # boss
    pts = [(x + d * s * .2, y - s * .3), (x + d * s * 1.1, y - s * .15), (x + d * s * 1.25, y + s * .5), (x + d * s * .9, y + s * .55), (x + d * s * .7, y + s * .1), (x + d * s * .1, y + s * .2)]
    pc.poly(ramp, pts, step)
    pc.dot(C(ramp, step + 2), int(x + d * s * 1.05), int(y + s * .3), 1, 2)
def horn_straight(pc, ramp, x, y, h, w=4, step=4, lean=0):
    """a goat horn: a tapered wedge leaning back, ridged"""
    pts = [(x - w // 2, y + h), (x + w // 2 + 1, y + h), (x + lean + 1, y)]
    pc.poly(ramp, pts, step, shade=False)
    for k in range(2, h - 1, 3): pc.dot(C(ramp, step - 1), x - w // 2 + 1 + (lean * k) // max(1, h), y + h - k, w - 1, 1)
    pc.dot(C(ramp, step + 2), x + lean, y + 1, 1, 2)
def ear(pc, ramp, inner, x, y, w, h, tilt=0, step=3):
    pc.blob(ramp, x, y, w, h, step, tilt=tilt, deep=False); pc.blob(inner, x, y, w * .55, h * .6, 4, flat=True, tilt=tilt)
def hoof(pc, ramp, x, y, w, split=True):
    pc.rrect(ramp, x, y, w, 4, 1, 1, shade=False); pc.dot(C(ramp, 3), x + 1, y, w - 2, 1)
    if split: pc.dot(C(ramp, 0), x + w // 2, y + 1, 1, 3)
def flame(pc, x, y, s):
    pc.blob('ember', x, y, s, s * 1.3, 3, flat=True); pc.blob('ember', x, y + s * .2, s * .6, s * .8, 5, flat=True); pc.blob('gold', x, y + s * .35, s * .3, s * .4, 6, flat=True)
def box(w, h, ramp='straw', tape='skin_deep', arrow=True):
    pc = Piece(w, h); pc.rrect(ramp, 0, 0, w, h, 1, 3)
    pc.dot(C(ramp, 2), 0, h // 2, w, 1); pc.dot(C(tape, 2), w // 2 - 2, 0, 4, h); pc.dot(C(tape, 4), w // 2 - 1, 0, 1, h)
    if arrow:
        for i in range(w // 3): pc.dot(C(ramp, 1), w // 3 + i, h - 4 - (i % 3 == 1), 1, 1)
    return pc
def rocket_window(pc, x, y, r): pc.blob('steel', x, y, r + 1, r + 1, 5, flat=True); pc.blob('sky', x, y, r, r, 4, flat=True); pc.dot(WHITE, int(x - r * .5), int(y - r * .5), 1, 1)
def screen(pc, x, y, w, h, ramp='cobalt'):
    pc.rrect('steel', x, y, w, h, 1, 2, shade=False); pc.rrect(ramp, x + 1, y + 1, w - 2, h - 2, 0, 3, shade=False); pc.dot(C(ramp, 6), x + 2, y + 2, w - 5, 1); pc.dot(C(ramp, 5), x + 2, y + 3, 2, 1)
def horn_arc(pc, ramp, cx, cy, R, thick, a0, a1, step=4, tip_step=6):
    """a curled horn: a thick arc of a circle from angle a0 to a1 (degrees, 0 = right, 90 = down), ridged, pale tip"""
    p = pc.im.load(); a0r, a1r = math.radians(a0), math.radians(a1)
    for y in range(max(0, int(cy - R - 2)), min(pc.h, int(cy + R + 3))):
        for x in range(max(0, int(cx - R - 2)), min(pc.w, int(cx + R + 3))):
            dx, dy = x + .5 - cx, y + .5 - cy; d = math.hypot(dx, dy); a = math.atan2(dy, dx)
            if a < a0r: a += 2 * math.pi
            if not (R - thick <= d <= R and a0r <= a <= a1r): continue
            t = (a - a0r) / max(1e-6, a1r - a0r); s_ = step
            if d > R - thick * .35: s_ = step + 1          # lit outer edge
            if d < R - thick * .7: s_ = step - 1            # inner shade
            if int(t * 8) % 2 == 1 and d < R - 1: s_ -= 1   # ridges
            if t > .82: s_ = tip_step
            p[x, y] = C(ramp, s_)
