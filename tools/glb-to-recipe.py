#!/usr/bin/env python3
"""Route props track RP-3 (docs/phases/route-props-track.md): a CC0 glTF/GLB model turned into our prop recipe format
(game/art/scene/next/models/<key>.json: layers of box, cyl, cone, dome, sphere and limb; prop-models.js
lowPolyFromRecipe), so a pack's model looks like our props: simplified to a few dozen shapes, its colours snapped to
our palette and drawn with our textures at 32 px to the metre.

    python3 tools/glb-to-recipe.py validation/cc0-src/<file>.gltf --key <key> [--height 4.6] [--preview out.png]
    python3 tools/glb-to-recipe.py --selftest

How it works:
  read      the scene's meshes with their nodes' transforms (a .glb, or a .gltf with its .bin and texture beside it);
            each triangle's colour is its texture at the triangle's UV centre (packs like KayKit and Kenney colour
            with a palette texture), else its material's colour. glTF's Y-up becomes the recipe's z up (x across,
            y depth with the front at -y).
  scale     to --height metres (or --scale), the lowest point (or --ground, in the source's units) on the ground;
            what is under the ground is cut away.
  parts     triangles grouped by their snapped colour, then by the pieces they join into.
  fit       each part the shape that lies closest to it (the mean distance both ways between points on the part and
            on the shape, the shape built as tools/build-props-island.py mesh builds it): a square box, an upright
            cylinder, cone, dome or ball, or a limb (a beam at any slant). A part no shape fits within --tol is cut
            in two along its length and each half fitted again (a curve becomes a chain of limbs).
  simplify  parts smaller than --min metres dropped; at most --max-layers layers, the largest kept.
  colour    each part's colour snapped to the nearest palette colour, which picks its texture (stone, wood, metal,
            hay, plain); --map '#rrggbb=name' sends a source colour to a palette entry by hand.

convert() is what tools/build-props-routes.py calls; it takes the palette, so the props' colours stay in one place.
Only CC0 models: validation/cc0-src/LICENSES.md lists each file and its licence.
"""
import argparse
import base64
import importlib.util
import io
import json
import math
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PPM = 32


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'tools' / file)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


_BI = None


def island():
    """tools/build-props-island.py, for mesh(): a recipe's layers as triangles, as the game builds them"""
    global _BI
    if _BI is None: _BI = _load('island_for_glb', 'build-props-island.py')
    return _BI


def r2(v):
    return round(float(v), 3)


# ================================================================ reading glTF / GLB
COMP = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def _side_file(base, uri):
    """A file the model names beside it: only a plain name in the model's own folder (no paths out of it)."""
    name = Path(uri.replace('\\', '/')).name
    if name != uri or name in ('', '.', '..'): raise ValueError(f'refusing the file name {uri!r}: only files beside the model')
    return (base / name).read_bytes()


def _uri_bytes(base, uri):
    if uri.startswith('data:'): return base64.b64decode(uri.split(',', 1)[1])
    return _side_file(base, uri)


def read_gltf(path):
    """(json, [buffer bytes]) from a .glb or a .gltf"""
    path = Path(path)
    raw = path.read_bytes()
    if raw[:4] == b'glTF':
        _, _, total = struct.unpack_from('<4sII', raw, 0)
        off, G, bins = 12, None, []
        while off < min(total, len(raw)):
            n, kind = struct.unpack_from('<II', raw, off)
            chunk = raw[off + 8:off + 8 + n]
            if kind == 0x4E4F534A: G = json.loads(chunk.decode('utf-8'))
            elif kind == 0x004E4942: bins.append(chunk)
            off += 8 + n
        bufs = [bins[0] if 'uri' not in b and bins else _uri_bytes(path.parent, b['uri']) for b in G.get('buffers', [])]
    else:
        G = json.loads(raw.decode('utf-8'))
        bufs = [_uri_bytes(path.parent, b['uri']) for b in G.get('buffers', [])]
    return G, bufs


def accessor(G, bufs, i):
    a = G['accessors'][i]
    fmt, size = COMP[a['componentType']]
    nc = NCOMP[a['type']]
    out = np.zeros((a['count'], nc), np.float64)
    if 'bufferView' in a:
        v = G['bufferViews'][a['bufferView']]
        buf = bufs[v['buffer']]
        start = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = v.get('byteStride') or size * nc
        dt = np.dtype('<' + fmt)
        for c in range(nc):
            out[:, c] = np.ndarray((a['count'],), dt, buf, start + c * size, (stride,))
        if a.get('normalized') and fmt in 'bBhH':
            out /= {'b': 127, 'B': 255, 'h': 32767, 'H': 65535}[fmt]
    return out


def _node_matrix(n):
    if 'matrix' in n: return np.array(n['matrix'], float).reshape(4, 4).T
    T = np.eye(4)
    t, r, s = n.get('translation', [0, 0, 0]), n.get('rotation', [0, 0, 0, 1]), n.get('scale', [1, 1, 1])
    x, y, z, w = r
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    T[:3, :3] = R * np.array(s)
    T[:3, 3] = t
    return T


def _image(G, bufs, base, i, cache):
    if i in cache: return cache[i]
    im = G['images'][i]
    if 'bufferView' in im:
        v = G['bufferViews'][im['bufferView']]
        data = bufs[v['buffer']][v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
    else:
        data = _uri_bytes(base, im['uri'])
    cache[i] = np.asarray(Image.open(io.BytesIO(data)).convert('RGBA'), np.float64)
    return cache[i]


def load_triangles(path, skip=()):
    """The model's triangles: (P (n, 3, 3) in the source's units, recipe axes: x across, y depth (front -y), z up;
    C (n, 3) their colours 0-255; names (n,) their nodes' names). Nodes named in skip are left out."""
    path = Path(path)
    G, bufs = read_gltf(path)
    imgs = {}
    P, C, names = [], [], []

    def material_colour(prim, uv, idx):
        m = G['materials'][prim['material']] if 'material' in prim else {}
        pbr = m.get('pbrMetallicRoughness', {})
        f = np.array(pbr.get('baseColorFactor', [1, 1, 1, 1])[:3]) * 255
        t = pbr.get('baseColorTexture')
        if t is None or uv is None: return np.tile(f, (len(idx), 1))
        tex = G['textures'][t['index']]
        im = _image(G, bufs, path.parent, tex['source'], imgs)
        h, w = im.shape[:2]
        c = uv[idx].mean(axis=1)  # the UV at each triangle's centre
        px = (np.mod(c[:, 0], 1) * w).astype(int).clip(0, w - 1)
        py = (np.mod(c[:, 1], 1) * h).astype(int).clip(0, h - 1)
        return im[py, px, :3] * (f / 255)

    def walk(ni, M):
        n = G['nodes'][ni]
        M = M @ _node_matrix(n)
        if 'mesh' in n and n.get('name') not in skip:
            for prim in G['meshes'][n['mesh']]['primitives']:
                if prim.get('mode', 4) != 4: continue
                pos = accessor(G, bufs, prim['attributes']['POSITION'])
                pos = (np.c_[pos, np.ones(len(pos))] @ M.T)[:, :3]
                idx = accessor(G, bufs, prim['indices'])[:, 0].astype(int) if 'indices' in prim else np.arange(len(pos))
                idx = idx[:len(idx) // 3 * 3].reshape(-1, 3)
                uv = accessor(G, bufs, prim['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in prim['attributes'] else None
                tri = pos[idx]
                P.append(np.stack([tri[..., 0], -tri[..., 2], tri[..., 1]], axis=-1))  # Y-up -> z-up, front -y
                C.append(material_colour(prim, uv, idx))
                names.extend([n.get('name', f'node{ni}')] * len(idx))
        for c in n.get('children', []): walk(c, M)

    scene = G['scenes'][G.get('scene', 0)] if G.get('scenes') else {'nodes': list(range(len(G['nodes'])))}
    for ni in scene['nodes']: walk(ni, np.eye(4))
    if not P: raise ValueError(f'{path}: no triangles')
    return np.concatenate(P), np.concatenate(C), np.array(names)


# ================================================================ the palette
def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def _lab(rgb):
    """CIE Lab of sRGB colours 0-255 (n, 3): nearest colours as the eye sees them"""
    c = np.asarray(rgb, float) / 255
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[0.4124, 0.2126, 0.0193], [0.3576, 0.7152, 0.1192], [0.1805, 0.0722, 0.9505]])
    xyz /= np.array([0.9505, 1.0, 1.089])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def snap(colours, palette, overrides=None):
    """Each colour's nearest palette entry: palette {name: (hex, texture)}; overrides {hex: name}. Returns names."""
    names = list(palette)
    L = _lab(np.array([hexrgb(palette[n][0]) for n in names]))
    ov = {hexrgb(k).tobytes(): v for k, v in (overrides or {}).items()}
    out = []
    for c in colours:
        q = np.round(c).astype(float)
        if q.tobytes() in ov:
            out.append(ov[q.tobytes()])
            continue
        d = ((L - _lab(q[None])[0]) ** 2).sum(1)
        out.append(names[int(d.argmin())])
    return out


# ================================================================ parts
def components(T):
    """the triangles of T (n, 3, 3) as groups of indices that share corners (welded at 1 mm)"""
    n = len(T)
    key = np.round(T.reshape(-1, 3) * 1000).astype(np.int64)
    _, vid = np.unique(key, axis=0, return_inverse=True)
    vid = vid.reshape(n, 3)
    parent = np.arange(vid.max() + 1)

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for a, b, c in vid:
        ra, rb, rc = find(a), find(b), find(c)
        parent[rb] = ra
        parent[find(rc)] = ra
    roots = np.array([find(v) for v in vid[:, 0]])
    return [np.nonzero(roots == r)[0] for r in np.unique(roots)]


def surface_points(T, n, rng):
    """n points spread over the triangles by area, plus the corners"""
    a = np.linalg.norm(np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]), axis=1) / 2
    if a.sum() <= 0: return T.reshape(-1, 3)
    pick = rng.choice(len(T), n, p=a / a.sum())
    u, v = rng.random(n), rng.random(n)
    f = u + v > 1
    u[f], v[f] = 1 - u[f], 1 - v[f]
    t = T[pick]
    pts = t[:, 0] + (t[:, 1] - t[:, 0]) * u[:, None] + (t[:, 2] - t[:, 0]) * v[:, None]
    return np.concatenate([pts, np.unique(T.reshape(-1, 3), axis=0)])


def _seg_dist2(Q, A, B):
    """squared distance from points Q (n, 1, 3) to segments A-B (1, m, 3)"""
    ab = B - A
    t = np.clip(((Q - A) * ab).sum(-1) / np.maximum((ab * ab).sum(-1), 1e-12), 0, 1)
    d = Q - (A + ab * t[..., None])
    return (d * d).sum(-1)


def surface_dist(Q, T):
    """the distance from each point Q (n, 3) to the nearest of the triangles T (m, 3, 3)"""
    q = Q[:, None, :]
    a, b, c = T[None, :, 0], T[None, :, 1], T[None, :, 2]
    nr = np.cross(b - a, c - a)
    nl = np.linalg.norm(nr, axis=-1, keepdims=True)
    nr = nr / np.maximum(nl, 1e-12)
    h = ((q - a) * nr).sum(-1)
    p = q - nr * h[..., None]  # each point dropped onto each triangle's plane
    inside = np.ones(h.shape, bool)
    for u, v in ((a, b), (b, c), (c, a)):
        inside &= (np.cross(v - u, p - u) * nr).sum(-1) >= -1e-9
    d2 = np.where(inside & (nl[..., 0] > 1e-12), h * h, np.inf)
    for u, v in ((a, b), (b, c), (c, a)):
        d2 = np.minimum(d2, _seg_dist2(q, u, v))
    return np.sqrt(d2.min(1))


def two_way(VS, TS):
    """how far apart two surfaces lie where they show: the mean distance from points on each above the ground (z 0)
    to the other's triangles"""
    (V, T), (S, ST) = VS, TS
    V, S = V[V[:, 2] >= -0.01], S[S[:, 2] >= -0.01]
    if not len(V) or not len(S): return 0.0 if len(V) == len(S) else np.inf
    return 0.5 * (surface_dist(V, ST).mean() + surface_dist(S, T).mean())


# ================================================================ fitting a part
def candidates(V):
    """the shapes that may fit points V (n, 3): (layer, cost) where cost is how much a shape costs (triangles)"""
    lo, hi = V.min(0), V.max(0)
    c, e = (lo + hi) / 2, np.maximum(hi - lo, 0.01)
    out = [({'k': 'box', 'x': c[0], 'y': c[1], 'z': lo[2], 'w': e[0], 'd': e[1], 'h': e[2]}, 12)]
    # upright round shapes: their radius across and in depth from the part's size; a cone's top from its top points
    rx, ry, h = e[0] / 2, e[1] / 2, e[2]
    top = V[V[:, 2] > hi[2] - 0.15 * h]
    rt = max(np.abs(top[:, 0] - c[0]).max(), np.abs(top[:, 1] - c[1]).max() * rx / ry, 0.004) if len(top) else rx
    for sides in (6, 8, 12):
        base = {'x': c[0], 'y': c[1], 'z': lo[2], 'r': rx, 'ry': ry, 'h': h, 'sides': sides}
        out.append(({**base, 'k': 'cyl'}, sides * 4))
        if rt < rx * 0.85: out.append(({**base, 'k': 'cone', 'r1': rt}, sides * 4))
        out.append(({**base, 'k': 'dome', 'rings': 3}, sides * 6))
        out.append(({**base, 'k': 'sphere', 'rings': 4}, sides * 8))
    # a limb along the part's long axis, its radius at each end from the points near it
    X = V - V.mean(0)
    _, s, vt = np.linalg.svd(X, full_matrices=False)
    ax = vt[0]
    t = X @ ax
    perp = np.linalg.norm(X - np.outer(t, ax), axis=1)
    t0, t1 = t.min(), t.max()
    if t1 - t0 > 0.02:
        span = t1 - t0
        r0 = np.percentile(perp[t < t0 + span * 0.25], 90) if (t < t0 + span * 0.25).any() else perp.max()
        r1 = np.percentile(perp[t > t1 - span * 0.25], 90) if (t > t1 - span * 0.25).any() else perp.max()
        m = V.mean(0)
        a, b = m + ax * t0, m + ax * t1
        if a[2] > b[2]: a, b, r0, r1 = b, a, r1, r0
        for sides in (4, 6, 8):
            out.append(({'k': 'limb', 'x': a[0], 'y': a[1], 'z': a[2], 'x2': b[0], 'y2': b[1], 'z2': b[2],
                         'r': max(r0, 0.01), 'r1': max(r1, 0.01), 'sides': sides}, sides * 2 + 2))
    return out


def shape_surface(layer, n, rng):
    """(points on the shape, its triangles), the shape built as the game builds it"""
    T = island().mesh([{**layer, 'col': '#888888'}])
    if not T: return None
    T = np.array([t[:3] for t in T], float)
    return surface_points(T, n, rng), T


def winding(Q, T):
    """the generalized winding number of points Q (n, 3) in triangles T (m, 3, 3): about 1 inside, 0 outside, and
    still right where a pack's mesh has gaps or faces inside faces"""
    w = np.zeros(len(Q))
    for s in range(0, len(Q), 512):
        q = Q[s:s + 512, None, :]
        a, b, c = T[None, :, 0] - q, T[None, :, 1] - q, T[None, :, 2] - q
        la, lb, lc = (np.linalg.norm(v, axis=-1) for v in (a, b, c))
        num = (a * np.cross(b, c)).sum(-1)
        den = la * lb * lc + (a * b).sum(-1) * lc + (a * c).sum(-1) * lb + (b * c).sum(-1) * la
        w[s:s + 512] = (2 * np.arctan2(num, den)).sum(1) / (4 * np.pi)
    return w


def voxel_boxes(T, res):
    """A part filled with voxels res metres wide (a voxel is in when its centre is inside the part), merged greedily
    into square boxes; [] when nothing is inside (an open part)."""
    lo, hi = T.reshape(-1, 3).min(0), T.reshape(-1, 3).max(0)
    n = np.maximum(np.ceil((hi - lo) / res).astype(int), 1)
    cs = [lo[i] + (np.arange(n[i]) + 0.5) * (hi[i] - lo[i]) / n[i] for i in range(3)]
    G = np.stack(np.meshgrid(*cs, indexing='ij'), -1).reshape(-1, 3)
    F = (np.abs(winding(G, T)) > 0.5) & (G[:, 2] > 0)  # under the ground is cut away anyway
    F = F.reshape(n[0], n[1], n[2])
    if not F.any(): return []
    step = (hi - lo) / n
    best = None
    for order in ((0, 1, 2), (0, 2, 1), (1, 0, 2), (1, 2, 0), (2, 0, 1), (2, 1, 0)):  # the order that needs fewest
        B = _merge(F, order)
        if best is None or len(B) < len(best): best = B
    return [{'k': 'box', 'x': lo[0] + step[0] * (a[0] + b[0]) / 2, 'y': lo[1] + step[1] * (a[1] + b[1]) / 2,
             'z': lo[2] + step[2] * a[2], 'w': step[0] * (b[0] - a[0]), 'd': step[1] * (b[1] - a[1]),
             'h': step[2] * (b[2] - a[2])} for a, b in best]


def _merge(F, order):
    """filled voxels F as boxes [(start, end)], each grown as far as it goes along the axes in order"""
    n, used, out = F.shape, np.zeros_like(F), []
    for idx in zip(*np.nonzero(F)):
        if used[idx]: continue
        a, b = list(idx), [v + 1 for v in idx]
        for ax in order:
            while b[ax] < n[ax]:
                lo_, hi_ = list(a), list(b)
                lo_[ax], hi_[ax] = b[ax], b[ax] + 1
                sl = tuple(slice(x, y) for x, y in zip(lo_, hi_))
                if not (F[sl] & ~used[sl]).all(): break
                b[ax] += 1
        used[tuple(slice(x, y) for x, y in zip(a, b))] = True
        out.append((a, b))
    return out


def fit(T, rng, tol, vox=0.12, depth=0, max_depth=3):
    """[(layer, error)] for a part's triangles T: its best shape; else, if no shape fits within tol, the part as
    voxel boxes when that lies closer, else its halves fitted again"""
    V = surface_points(T, 120, rng)
    size = np.linalg.norm(V.max(0) - V.min(0))
    best = None
    for L, cost in candidates(V):
        S = shape_surface(L, 120, rng)
        if S is None: continue
        err = two_way((V, T), S)
        score = err * (1 + cost / 400)  # a near tie goes to the cheaper shape
        if best is None or score < best[0]: best = (score, err, L)
    _, err, L = best
    if err <= max(tol, size * 0.02) or len(T) < 4:
        return [(L, err)]
    B = voxel_boxes(T, vox)
    if B:
        BT = np.array([t[:3] for t in island().mesh([{**b, 'col': '#888888'} for b in B])], float)
        errB = two_way((V, T), (surface_points(BT, 160, rng), BT))
        if errB * (1 + len(B) / 40) < err: return [(b, errB) for b in B]  # boxes only when they pay for themselves
    if depth >= max_depth: return [(L, err)]
    # cut in two along the long axis at the middle of the triangles' centres, and fit each half's pieces
    cen = T.mean(axis=1)
    X = cen - cen.mean(0)
    ax = np.linalg.svd(X, full_matrices=False)[2][0]
    t = X @ ax
    cut = np.median(t)
    out = []
    for half in (t <= cut, t > cut):
        if not half.any(): continue
        for g in components(T[half]):
            out += fit(T[half][g], rng, tol, vox, depth + 1, max_depth)
    return out


def layers_triangles(layers):
    T = island().mesh([{**L, 'col': '#888888'} for L in layers])
    return np.array([t[:3] for t in T], float).reshape(-1, 3, 3)


def vote(L, T, N):
    """a shape's colour: the palette name covering the most area of the source triangles inside its bounds (the
    nearest triangle's when none is)"""
    S = layers_triangles([L]).reshape(-1, 3)
    pad = 0.03
    lo, hi = S.min(0) - pad, S.max(0) + pad
    cen = T.mean(axis=1)
    inside = ((cen >= lo) & (cen <= hi)).all(1)
    if not inside.any(): return N[int(np.linalg.norm(cen - (lo + hi) / 2, axis=1).argmin())]
    area = np.linalg.norm(np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]), axis=1)
    tally = {}
    for n, a in zip(N[inside], area[inside]): tally[n] = tally.get(n, 0) + a
    return max(tally, key=tally.get)


def above_ground(x):
    """a fitted shape cut at the ground: None when it is wholly under it (the game clamps a shape's foot at 0 and a
    limb's points at -0.3)"""
    n, L, e = x
    if L['k'] == 'limb':
        if max(L['z'], L['z2']) <= 0: return n, None, e
        return n, {**L, 'z': max(L['z'], -0.3), 'z2': max(L['z2'], -0.3)}, e
    top = L['z'] + L['h']
    if top <= 0.01: return n, None, e
    if L['z'] < 0:
        if L['k'] in ('box', 'cyl'): L = {**L, 'z': 0.0, 'h': top}
        elif L['k'] == 'cone':  # its radius where it meets the ground
            k = -L['z'] / L['h']
            L = {**L, 'z': 0.0, 'h': top, 'r': L['r'] + (L.get('r1', 0) - L['r']) * k,
                 'ry': L.get('ry', L['r']) * (1 - k) + L.get('r1', 0) * L.get('ry', L['r']) / L['r'] * k}
    return n, L, e


# ================================================================ the converter
def prepare(path, height=None, scale=None, ground=None, anchor='centre', yaw=0, skip=()):
    """the model's triangles and colours turned, stood on the ground, scaled and centred as convert() takes them"""
    P, C, _ = load_triangles(path, skip)
    if yaw:
        a = math.radians(yaw)
        R = np.array([[math.cos(a), -math.sin(a), 0], [math.sin(a), math.cos(a), 0], [0, 0, 1]])
        P = P @ R.T
    g = P[..., 2].min() if ground is None else ground
    P = P - np.array([0, 0, g])
    s = scale if scale is not None else (height / P[..., 2].max() if height else 1.0)
    P = P * s
    lo, hi = P.reshape(-1, 3).min(0), P.reshape(-1, 3).max(0)
    lo[2] = max(lo[2], 0)
    off = np.array([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2 if anchor == 'centre' else lo[1], 0])
    P = P - off
    return P, C


def convert(path, palette, height=None, scale=None, ground=None, anchor='centre', yaw=0, min_size=0.05,
            max_layers=40, tol=0.03, overrides=None, skip=(), use=None, vox=0.12, seed=1, report=None):
    """A recipe {'ppm', 'cel', 'layers'} from a glTF/GLB model. palette {name: (hex, texture)}; height or scale in
    metres; ground the source height that stands on the ground (default its lowest point); anchor 'centre' (the
    footprint round the base point) or 'front' (the footprint behind it, as a prop with a box collision); yaw degrees
    turned about the vertical; overrides {source hex: palette name}; skip node names left out; use the palette
    entries this model may snap to (all when None: a stone ruin keeps to the stones)."""
    P, C = prepare(path, height, scale, ground, anchor, yaw, skip)
    lo, hi = P.reshape(-1, 3).min(0), P.reshape(-1, 3).max(0)
    lo[2] = max(lo[2], 0)
    rng = np.random.default_rng(seed)
    names = np.array(snap(C, {n: palette[n] for n in use} if use else palette, overrides))
    layers, nparts = [], 0
    for comp in components(P):
        T, N = P[comp], names[comp]
        V = surface_points(T, 160, rng)
        # the piece fitted by its colours (each colour's own pieces), and whole (each shape coloured by the colours
        # under it): the closer wins, a tie the one with fewer shapes
        by_col = []
        for name in dict.fromkeys(N):
            sel = np.nonzero(N == name)[0]
            for g_ in components(T[sel]):
                by_col += [(name, L, e) for L, e in fit(T[sel][g_], rng, tol, vox)]
        whole = [(vote(L, T, N), L, e) for L, e in fit(T, rng, tol, vox)] if len(set(N)) > 1 else by_col
        best, best_err = None, None
        for cand in (by_col, whole):
            ST = layers_triangles([L for _, L, _ in cand])
            err = two_way((V, T), (surface_points(ST, 160, rng), ST)) if len(ST) else np.inf
            if best is None or err * (1 + len(cand) / 200) < best_err * (1 + len(best) / 200): best, best_err = cand, err
        layers += best
        nparts += 1
    # simplify: drop the specks, keep the largest
    def dims(L):
        if L['k'] == 'box': return L['w'], L['d'], L['h']
        if L['k'] == 'limb':
            ln = math.dist((L['x'], L['y'], L['z']), (L['x2'], L['y2'], L['z2']))
            return ln, 2 * max(L['r'], L['r1']), 2 * max(L['r'], L['r1'])
        return 2 * L['r'], 2 * L.get('ry', L['r']), L['h']
    # the ground cut: the shapes are fitted to the whole (closed) model, then cut at the ground
    layers = [(n, L, e) for n, L, e in (above_ground(x) for x in layers) if L]
    layers = [x for x in layers if max(dims(x[1])) >= min_size]
    def area(L):  # what shows of a shape: a thin blade counts, a hidden block inside less
        a, b, c = dims(L)
        return a * b + a * c + b * c
    dropped = max(0, len(layers) - max_layers)
    layers = sorted(layers, key=lambda x: -area(x[1]))[:max_layers]
    out = []
    for i, (name, L, err) in enumerate(layers):
        col, tex = palette[name]
        L = {k: (r2(v) if isinstance(v, float) else v) for k, v in L.items()}
        if L['k'] in ('cyl', 'cone', 'dome', 'sphere') and abs(L.get('ry', L['r']) - L['r']) < 0.01: L.pop('ry', None)
        out.append({**L, 'col': col, 'tex': tex, 'name': f'{name} {L["k"]}'})
    if report is not None:
        report.update(source_tris=int(len(P)), parts=nparts, layers=len(out), dropped=dropped,
                      mean_err=r2(np.mean([e for _, _, e in layers]) if layers else 0),
                      max_err=r2(max([e for _, _, e in layers], default=0)),
                      tris=len(island().mesh(out)), size=[r2(v) for v in hi - lo])
    return {'ppm': PPM, 'cel': 0.7, 'layers': out}


# ================================================================ a quick picture (for checking by eye)
def render(tris, cols, w=320, h=320, yaw=-0.5, pitch=0.5, frame=None):
    """triangles (n, 3, 3) with colours (n, 3) drawn flat-lit from the front-left and above, fitted to w x h (or to
    the points frame (k, 3), so two pictures share a scale)"""
    cy, sy, cp, sp = math.cos(yaw), math.sin(yaw), math.cos(pitch), math.sin(pitch)
    P = tris.copy()
    x, y = P[..., 0] * cy - P[..., 1] * sy, P[..., 0] * sy + P[..., 1] * cy
    sx, sz, dep = x, P[..., 2] * cp + y * sp, y * cp - P[..., 2] * sp
    F = np.asarray(frame if frame is not None else P.reshape(-1, 3))
    fx = F[:, 0] * cy - F[:, 1] * sy
    fz = F[:, 2] * cp + (F[:, 0] * sy + F[:, 1] * cy) * sp
    k = min((w - 8) / max(np.ptp(fx), 1e-6), (h - 8) / max(np.ptp(fz), 1e-6))
    X, Y = (sx - fx.min()) * k + 4, h - 4 - (sz - fz.min()) * k
    img = np.full((h, w, 3), 236.0)
    zb = np.full((h, w), np.inf)
    light = np.array([-0.45, -0.55, 0.7]) / np.linalg.norm([-0.45, -0.55, 0.7])
    for i in range(len(P)):
        a, b, c = P[i]
        nr = np.cross(b - a, c - a)
        ln = np.linalg.norm(nr)
        if ln < 1e-12: continue
        nr /= ln
        lit = abs(float(nr @ light))
        rgb = np.asarray(cols[i], float) * (0.62 + 0.45 * lit)
        xs, ys = X[i], Y[i]
        x0, x1 = int(max(0, xs.min())), int(min(w - 1, xs.max() + 1))
        y0, y1 = int(max(0, ys.min())), int(min(h - 1, ys.max() + 1))
        if x1 < x0 or y1 < y0: continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        d = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if abs(d) < 1e-9: continue
        w0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / d
        w1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / d
        w2 = 1 - w0 - w1
        m = (w0 >= -0.01) & (w1 >= -0.01) & (w2 >= -0.01)
        z = w0 * dep[i, 0] + w1 * dep[i, 1] + w2 * dep[i, 2]
        sub = zb[y0:y1 + 1, x0:x1 + 1]
        m &= z < sub
        sub[m] = z[m]
        img[y0:y1 + 1, x0:x1 + 1][m] = rgb
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))


def recipe_triangles(recipe):
    T = island().mesh(recipe['layers'])
    return np.array([t[:3] for t in T], float), np.array([hexrgb(t[3]) for t in T])


def preview(path, recipe, out, **kw):
    """the source (its own colours, turned, scaled and stood as converted) beside the recipe, one picture"""
    P, C = prepare(path, **kw)
    up = P[..., 2].max(axis=1) > 0  # what stands above the ground
    P, C = P[up], C[up]
    P[..., 2] = np.maximum(P[..., 2], 0)
    T, TC = recipe_triangles(recipe)
    frame = np.concatenate([P.reshape(-1, 3), T.reshape(-1, 3)])
    a, b = render(P, C, frame=frame), render(T, TC, frame=frame)
    im = Image.new('RGB', (a.width * 2 + 8, a.height), (255, 255, 255))
    im.paste(a, (0, 0))
    im.paste(b, (a.width + 8, 0))
    im.save(out)


# ================================================================ the default palette and the command line
def default_palette():
    """the props' palette: batch 1's airship colours and the route props' tones (tools/build-props-routes.py)"""
    R = _load('routes_for_glb', 'build-props-routes.py')
    return R.CC0_PALETTE


def selftest():
    """a box, a pole and a slanted beam written as a small glTF, read back and fitted"""
    import tempfile
    def boxtris(x0, y0, z0, x1, y1, z1):
        v = [(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
        f = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
        return v, [(q[0], q[1], q[2]) for q in f] + [(q[0], q[2], q[3]) for q in f]
    V, I = [], []
    for spec in ((-1, 0, -0.5, 1, 0.4, 0.5), (1.5, 0, -0.1, 1.7, 2.5, 0.1)):  # a slab and a post (glTF: y up)
        v, f = boxtris(*spec)
        I += [(a + len(V), b + len(V), c + len(V)) for a, b, c in f]
        V += v
    n = 12  # an upright pole, round
    base = len(V)
    for i in range(n):
        a = 2 * math.pi * i / n
        V += [(-2 + 0.15 * math.cos(a), 0, 0.15 * math.sin(a)), (-2 + 0.15 * math.cos(a), 2, 0.15 * math.sin(a))]
    for i in range(n):
        j = (i + 1) % n
        I += [(base + 2 * i, base + 2 * j, base + 2 * i + 1), (base + 2 * j, base + 2 * j + 1, base + 2 * i + 1)]
    pos = np.array(V, '<f4')
    idx = np.array(I, '<u2').ravel()
    blob = pos.tobytes() + idx.tobytes()
    G = {'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': 't'}],
         'meshes': [{'primitives': [{'attributes': {'POSITION': 0}, 'indices': 1, 'material': 0}]}],
         'materials': [{'pbrMetallicRoughness': {'baseColorFactor': [0.67, 0.65, 0.71, 1]}}],
         'buffers': [{'byteLength': len(blob), 'uri': 'data:application/octet-stream;base64,' + base64.b64encode(blob).decode()}],
         'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': pos.nbytes},
                         {'buffer': 0, 'byteOffset': pos.nbytes, 'byteLength': idx.nbytes}],
         'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': len(V), 'type': 'VEC3',
                        'min': pos.min(0).tolist(), 'max': pos.max(0).tolist()},
                       {'bufferView': 1, 'componentType': 5123, 'count': len(idx), 'type': 'SCALAR'}]}
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / 't.gltf'
        p.write_text(json.dumps(G))
        rep = {}
        rec = convert(p, {'stone': ('#AAA6B4', 'stone'), 'wood': ('#B27648', 'wood')}, scale=1.0, report=rep)
    kinds = sorted(L['k'] for L in rec['layers'])
    ok = len(rec['layers']) == 3 and kinds.count('box') == 2 and kinds[-1] in ('cyl', 'cone') \
        and all(L['tex'] == 'stone' for L in rec['layers']) and rep['max_err'] < 0.05
    slab = next(L for L in rec['layers'] if L['k'] == 'box' and L['w'] > 1.5)
    ok &= abs(slab['w'] - 2) < 0.02 and abs(slab['d'] - 1) < 0.02 and abs(slab['h'] - 0.4) < 0.02
    print('selftest', 'ok' if ok else 'FAILED', kinds, rep)
    return ok


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('model', nargs='?')
    ap.add_argument('--key', help='write game/art/scene/next/models/<key>.json')
    ap.add_argument('--out', help='write the recipe here instead')
    ap.add_argument('--height', type=float)
    ap.add_argument('--scale', type=float)
    ap.add_argument('--ground', type=float, help="the source's height that stands on the ground")
    ap.add_argument('--anchor', choices=('centre', 'front'), default='centre')
    ap.add_argument('--yaw', type=float, default=0)
    ap.add_argument('--min', type=float, default=0.05, dest='min_size')
    ap.add_argument('--max-layers', type=int, default=40)
    ap.add_argument('--tol', type=float, default=0.03)
    ap.add_argument('--map', action='append', default=[], help="'#rrggbb=name': a source colour to a palette entry")
    ap.add_argument('--skip', action='append', default=[], help='a node name to leave out')
    ap.add_argument('--vox', type=float, default=0.12, help='the voxel size for parts no one shape fits')
    ap.add_argument('--use', help='the palette entries it may snap to, comma-separated')
    ap.add_argument('--preview', help='a picture of the source beside the recipe')
    ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args()
    if a.selftest: sys.exit(0 if selftest() else 1)
    if not a.model: ap.error('a model is needed')
    rep = {}
    rec = convert(a.model, default_palette(), a.height, a.scale, a.ground, a.anchor, a.yaw, a.min_size, a.max_layers,
                  a.tol, dict(m.split('=', 1) for m in a.map), tuple(a.skip), a.use.split(',') if a.use else None,
                  a.vox, report=rep)
    text = json.dumps(rec, separators=(',', ':')) + '\n'
    if a.out: Path(a.out).write_text(text)
    elif a.key: (ROOT / 'game' / 'art' / 'scene' / 'next' / 'models' / f'{a.key}.json').write_text(text)
    if a.preview: preview(a.model, rec, a.preview, height=a.height, scale=a.scale, ground=a.ground, anchor=a.anchor,
                          yaw=a.yaw, skip=tuple(a.skip))
    print(json.dumps(rep))


if __name__ == '__main__':
    main()
