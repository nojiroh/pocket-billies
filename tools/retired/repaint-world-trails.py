#!/usr/bin/env python3
"""Repaints the trails on game/art/map/world.png to match the links in game data (the walking network), the same
way the Studio's Map art painter does: old trail pixels are filled with the terrain around them, then every link is
painted with the same curved great-circle path the game walks. Also paints small patches for stops that have none.
    python3 tools/repaint-world-trails.py [--patches]"""
import json, math, sys, random
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TRAIL = [(0x8A, 0x6A, 0x3E), (0xE2, 0xC4, 0x8A), (0xF0, 0xE6, 0xC8), (0xDC, 0xEE, 0xF9)]
PATH, DOTS, FUTURE, LANE = TRAIL      # v24: LANE marks a sea or lake crossing (you ride), dotted

def llv(lon, lat):
    lon, lat = math.radians(lon), math.radians(lat)
    return (math.cos(lat) * math.cos(lon), math.sin(lat), math.cos(lat) * math.sin(lon))
def norm(a):
    l = math.sqrt(sum(x * x for x in a)) or 1
    return tuple(x / l for x in a)
def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def slerp(a, b, t):
    d = max(-1, min(1, sum(x * y for x, y in zip(a, b)))); w = math.acos(d)
    if w < 1e-5: return a
    s = math.sin(w)
    return tuple(x * math.sin((1 - t) * w) / s + y * math.sin(t * w) / s for x, y in zip(a, b))
def edge_pts(a, b, i):
    n = norm(cross(a, b)); out = []
    for k in range(41):
        t = k / 40; p = slerp(a, b, t); off = math.sin(t * math.pi) * .035 * (1 if i % 2 else -1)
        out.append(norm(tuple(p[j] + n[j] * off for j in range(3))))
    return out
def uv(v, W, H):
    lat = math.asin(max(-1, min(1, v[1]))); lon = math.atan2(v[2], v[0])
    return (((lon / (2 * math.pi)) + 1) % 1 * W, (.5 - lat / math.pi) * H)

def inpaint(px, W, H, mask):
    front = [i for i in mask if any(((i % W + dx) % W) + ((i // W) + dy) * W not in mask for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= i // W + dy < H)]
    left = set(mask)
    while left and front:
        upd = {}
        for i in front:
            x, y = i % W, i // W; cnt = {}
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    if not dx and not dy: continue
                    yy = y + dy
                    if not 0 <= yy < H: continue
                    j = yy * W + (x + dx) % W
                    if j in left: continue
                    c = px[j]; cnt[c] = cnt.get(c, 0) + (1 if dx and dy else 2)
            if cnt: upd[i] = max(cnt.items(), key=lambda kv: kv[1])[0]
        if not upd: break
        for i, c in upd.items(): px[i] = c; left.discard(i)
        nxt = set()
        for i in upd:
            x, y = i % W, i // W
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                yy = y + dy
                if 0 <= yy < H:
                    j = yy * W + (x + dx) % W
                    if j in left: nxt.add(j)
        front = list(nxt)

def disc(px, W, H, v, r, col):
    cu, cv = uv(v, W, H); lat = math.asin(max(-1, min(1, v[1]))); rx = r / max(.2, math.cos(lat))
    for j in range(-math.ceil(r), math.ceil(r) + 1):
        for i in range(-math.ceil(rx), math.ceil(rx) + 1):
            if (i / rx) ** 2 + (j / r) ** 2 > 1: continue
            X = int(round(cu + i)) % W; Y = min(H - 1, max(0, int(round(cv + j))))
            px[Y * W + X] = col

def main():
    src = (ROOT / 'game' / 'data' / 'gamedata.js').read_text(encoding='utf-8')
    D = json.JSONDecoder().raw_decode(src[src.index('window.GAMEDATA=') + 16:])[0]
    im = Image.open(ROOT / 'game' / 'art' / 'map' / 'world.png').convert('RGB'); W, H = im.size
    px = list(im.getdata())
    mask = [i for i, c in enumerate(px) if c in TRAIL]
    inpaint(px, W, H, mask)
    R = D['route']; V = [llv(r.get('lon', 0), r.get('lat', 0)) for r in R]
    if '--patches' in sys.argv:
        rnd = random.Random(7)
        cols = {'pond': [(74, 168, 216), (58, 144, 198)], 'farm': [(226, 200, 120), (190, 160, 90), (120, 176, 80)], 'ridge': [(176, 120, 84), (150, 100, 70)]}
        for r, v in zip(R, V):
            c = cols.get(r.get('t'))
            if not c: continue
            for k in range(70):
                a = rnd.uniform(0, 6.283); d = rnd.random() ** .5 * .075
                n = norm(cross(v, (0, 1, 0))); m = cross(n, v)
                p = norm(tuple(v[j] + (n[j] * math.cos(a) + m[j] * math.sin(a)) * d for j in range(3)))
                disc(px, W, H, p, rnd.uniform(1.5, 3.5), rnd.choice(c))
    n = 0
    for i, (a, b, _c) in enumerate(D['links']):
        pts = edge_pts(V[a], V[b], i)
        lane = R[a].get('ride') or R[b].get('ride')
        for k in range(len(pts) - 1):
            for q in range(6):
                p = norm(tuple(pts[k][j] * (1 - q / 6) + pts[k + 1][j] * q / 6 for j in range(3))); n += 1
                if lane:
                    if (k // 2) % 2 == 0: disc(px, W, H, p, 1.3, LANE)
                    continue
                disc(px, W, H, p, 2, PATH)
                if n % 7 == 0: disc(px, W, H, p, .6, DOTS)
    # the path ahead: from the last route stop through the regions
    fut = [V[len(R) - 1 if len(D['route']) <= 9 else 8]] + [llv(f['lon'], f.get('lat', 0)) for f in D['regions'] if f.get('t') != 'sun' and f.get('lon') is not None]
    for i in range(len(fut) - 1):
        pts = edge_pts(fut[i], fut[i + 1], i + 100)
        for k in range(len(pts) - 1):
            for q in range(6):
                p = norm(tuple(pts[k][j] * (1 - q / 6) + pts[k + 1][j] * q / 6 for j in range(3)))
                disc(px, W, H, p, .8, FUTURE)
    im.putdata(px); im.save(ROOT / 'game' / 'art' / 'map' / 'world.png', optimize=True)
    print('removed', len(mask), 'trail pixels; painted', len(D['links']), 'links')

if __name__ == '__main__':
    main()
