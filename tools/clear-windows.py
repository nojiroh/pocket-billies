#!/usr/bin/env python3
"""alpha 0.1: nothing stands in front of a window. Looks at every window on every building front (and every window on a
room's wall) in every place, as the walk camera sees it, and finds the props that hide one.

    python3 tools/clear-windows.py            # list the windows something hides
    python3 tools/clear-windows.py --fix      # move those props aside (wild plants that can't move are taken away)

A prop hides a window when, seen from the walk camera, its picture covers more of the window than COVER. The camera
looks down at about 31 degrees outside (43 in a room), so a prop a few metres in front of a wall only hides what is low
on it: a bush under a window is fine, a tree in front of it is not. Moving tries small steps sideways first, then
towards the camera, and only to ground of the same kind, clear of doors and of buildings. The builders call
clear_scene() when they make a place (tools/build_places), so new places start clear.

A turned building (its `rot`) is judged in its own frame, as the game turns it (game/js/logic/prop-turn.js): its windows
are on its turned front and the camera looks straight at that front, as the walk camera does when you stand before it
(BD-F; on Copperleaf most buildings are at rot 90 and face east, and the orbit camera sees them from the east)."""
import gamedata  # phase 04b: the data files in game/data
import json, math, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
GAME = ROOT / 'game'
DATA = GAME / 'data' / 'gamedata.js'
COVER = .22            # more of a window hidden than this counts
MOVE_TO = .06          # a moved prop hides at most this much of any window
PITCH_OUT, PITCH_ADD, PITCH_IN = 34, -3, 12


def load():
    src = gamedata.js_text()
    head, body = src.split('window.GAMEDATA=', 1)
    return head, json.loads(body.rstrip().rstrip(';'))


def save(head, D):
    gamedata.save_js(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n')


_A = {}
def alpha(img):
    """(width, height, alpha bytes) of a prop picture"""
    if img not in _A:
        try:
            im = Image.open(GAME / 'art' / img).convert('RGBA')
            _A[img] = (im.width, im.height, im.getchannel('A').tobytes())
        except Exception:
            _A[img] = None
    return _A[img]


def ppu(D): return (D.get('scenery') or {}).get('ppu') or 34


def tan_of(sc):
    pitch = ((sc.get('cam') or {}).get('pitch') or PITCH_OUT) + PITCH_ADD + (PITCH_IN if sc.get('indoor') else 0)
    return math.tan(math.radians(pitch))


def turned_point(p, dx, dz):
    """a point in the prop's own metres (dx across its front, dz back from it) in the place's metres (prop-turn.js turnedPoint)"""
    r = math.radians(float(p.get('rot') or 0))
    if not r: return p['x'] + dx, p['z'] + dz
    c, s = math.cos(r), math.sin(r)
    return p['x'] + dx * c - dz * s, p['z'] + dx * s + dz * c


def point_in_prop(p, x, z):
    """a point of the place in the prop's own metres (prop-turn.js pointInProp, the inverse of turned_point)"""
    r = math.radians(float(p.get('rot') or 0)); dx, dz = x - p['x'], z - p['z']
    if not r: return dx, dz
    c, s = math.cos(r), math.sin(r)
    return dx * c + dz * s, -dx * s + dz * c


def in_frame(Wn, x, z):
    """a point of the place in a window's frame: the frame of its building straightened, so it reads as the place's metres
    for a building that isn't turned (x across the front, z back from the camera, the wall at Wn['z'])"""
    if not Wn.get('rot'): return x, z
    dx, dz = point_in_prop(dict(x=Wn['bx'], z=Wn['bz'], rot=Wn['rot']), x, z)
    return Wn['bx'] + dx, Wn['bz'] + dz


def ground_at(sc, x, z):
    """the height of the ground (the scene's corner heights, rows from the far side)"""
    H = sc.get('heights') or []
    if not H: return 0.0
    r = sc['h'] - int(round(z)); i = int(round(x))
    if 0 <= r < len(H) and 0 <= i < len(H[r]): return float(H[r][i] or 0)
    return 0.0


def window_rects(M):
    """a building's windows in its picture's pixels: (x, y, w, h), y up from the ground being negative. Windows in the
    roof (above the eaves) count too: they are on the front."""
    B = M.get('build') or {}
    rects = [tuple(r[:4]) for r in (B.get('win') or [])]
    for f in M.get('fx') or []:
        if f.get('k') != 'window': continue
        if any(x - 2 <= f['x'] <= x + w + 2 and y - 2 <= f['y'] <= y + h + 2 for (x, y, w, h) in rects): continue
        rects.append((f['x'] - 8, f['y'] - 8, 16, 16))
    return rects


def is_window_prop(k, M):
    """a window on its own (a room's wall window): the whole picture is the window"""
    return 'window' in k and not M.get('build') and any(f.get('k') == 'window' for f in M.get('fx') or [])


def windows_of(sc, C, P):
    """every window of a scene in metres: x0, x1 (across), y0, y1 (up from its own ground), z (the wall), g (its ground),
    in its building's frame (in_frame): bx, bz and rot are the building's base point and turn"""
    out = []
    for n, p in enumerate(sc.get('props') or []):
        M = C.get(p['k'])
        if not M: continue
        win = is_window_prop(p['k'], M)
        if not win and not (M.get('box') and (M.get('build', {}).get('win') or any(f.get('k') == 'window' for f in M.get('fx') or []))): continue
        s = (p.get('s') or 1) / P; fl = -1 if p.get('f') else 1
        if win:
            A = alpha(M['img'])
            if not A: continue
            w, h, a = A
            im = Image.frombytes('L', (w, h), a); bb = im.point(lambda v: 255 if v > 100 else 0).getbbox()
            if not bb: continue
            rects = [(M['ox'] + bb[0], M['oy'] + bb[1], bb[2] - bb[0], bb[3] - bb[1])]
        else:
            rects = window_rects(M)
        for (x, y, w, h) in rects:
            xa, xb = sorted((p['x'] + fl * x * s, p['x'] + fl * (x + w) * s))
            out.append(dict(i=n, k=p['k'], x0=xa, x1=xb, y0=-(y + h) * s, y1=-y * s, z=p['z'], g=ground_at(sc, p['x'], p['z']),
                            bx=p['x'], bz=p['z'], rot=float(p.get('rot') or 0)))
    return out


def hides(Wn, q, Mq, sc, P, tan, at=None, grid=7):
    """how much of window Wn the prop q hides (0..1), with q standing at `at` (x, z) if given"""
    gq = ground_at(sc, *(at or (q['x'], q['z'])))
    qx, qz = in_frame(Wn, *(at or (q['x'], q['z'])))
    d = Wn['z'] - qz
    if d <= .02 or d > 16: return 0.0
    A = alpha(Mq.get('img') or '')
    if not A: return 0.0
    w, h, a = A
    s = (q.get('s') or 1) / P; fl = -1 if q.get('f') else 1
    hit = 0
    for i in range(grid):
        X = Wn['x0'] + (i + .5) / grid * (Wn['x1'] - Wn['x0'])
        col = int(math.floor(((X - qx) / s) * fl - Mq['ox']))
        if col < 0 or col >= w: continue
        for j in range(grid):
            Y = Wn['g'] + Wn['y0'] + (j + .5) / grid * (Wn['y1'] - Wn['y0']) + d * tan - gq
            row = int(math.floor(-Y / s - Mq['oy']))
            if 0 <= row < h and a[row * w + col] > 100: hit += 1
    return hit / (grid * grid)


SKIP_KINDS = ('window', 'awning', 'sign', 'flowerbox', 'window_box', 'planter_box', 'banner', 'flag', 'shutter')


def occluders(sc, C, P, wins=None):
    """[(window, prop index, how much)] for every prop that hides a window by more than COVER"""
    wins = wins if wins is not None else windows_of(sc, C, P)
    tan = tan_of(sc); out = []
    props = sc.get('props') or []
    for n, q in enumerate(props):
        Mq = C.get(q['k'])
        if not Mq or Mq.get('flat') == 2 or any(s in q['k'] for s in SKIP_KINDS): continue
        if Mq.get('build') or Mq.get('door') is not None: continue      # a building in front of a building: a street, not a prop in the way
        for Wn in wins:
            if Wn['i'] == n: continue
            qx, qz = in_frame(Wn, q['x'], q['z'])
            if Wn['z'] - qz <= .02 or Wn['z'] - qz > 16: continue
            if qx < Wn['x0'] - 6 or qx > Wn['x1'] + 6: continue
            c = hides(Wn, q, Mq, sc, P, tan)
            if c > COVER: out.append((Wn, n, c))
    return out


def tile_at(sc, x, z):
    rows = sc.get('tiles') or []
    j = sc['h'] - 1 - int(math.floor(z)); i = int(math.floor(x))
    if 0 <= j < len(rows) and 0 <= i < len(rows[j]): return rows[j][i]
    return None


def blocked(sc, C, P, n, x, z):
    """would prop n at (x, z) stand in a building, a doorway or another big thing?"""
    q = sc['props'][n]; Mq = C.get(q['k']) or {}
    rq = max(.25, (Mq.get('box') or [0])[0] * (q.get('s') or 1) / 2) if Mq.get('box') else .3
    for m, p in enumerate(sc['props']):
        if m == n: continue
        M = C.get(p['k']) or {}
        if M.get('box'):
            s = p.get('s') or 1; bw, bd = M['box'][0] * s / 2, M['box'][1] * s
            lx, lz = point_in_prop(p, x, z)                  # in the building's own metres: its footprint and door turn with it
            if -bw - rq < lx < bw + rq and -.25 - rq < lz < bd + rq: return True
            if M.get('door') is not None:
                fl = -1 if p.get('f') else 1
                dx = (M['door'].get('x') or 0) / P * s * fl
                if abs(lx - dx) < 1.0 + rq and -2.4 < lz < .2: return True
    return False


def move_clear(sc, C, P, n, wins, rot=0):
    """the nearest spot where prop n hides no window: sideways first, then towards the camera too, both along the front
    of the window it hides (rot: that building's turn)"""
    q = sc['props'][n]; Mq = C[q['k']]; tan = tan_of(sc)
    t0 = tile_at(sc, q['x'], q['z'])
    steps = []
    for dz in (0, -.5, -1, -1.5, -2):
        for k in range(1, 17):
            for sg in (1, -1):
                dx = sg * k * .25
                steps.append((abs(dx) + abs(dz) * 1.3, dx, dz))
    steps.sort()
    near = [Wn for Wn in wins if (lambda f: abs((Wn['x0'] + Wn['x1']) / 2 - f[0]) < 12 and -1 < Wn['z'] - f[1] < 18)(in_frame(Wn, q['x'], q['z']))]
    for _, dx, dz in steps:
        x, z = turned_point(dict(x=q['x'], z=q['z'], rot=rot), dx, dz); x, z = round(x, 2), round(z, 2)
        if not (1 <= x <= sc['w'] - 1 and 1 <= z <= sc['h'] - 1): continue
        if tile_at(sc, x, z) != t0: continue
        if blocked(sc, C, P, n, x, z): continue
        if any(hides(Wn, q, Mq, sc, P, tan, at=(x, z)) > MOVE_TO for Wn in near): continue
        return x, z
    return None


def move_window(sc, C, P, wi, occ_idx):
    """in a room: the window slides along its wall to a spot nothing stands in front of (the furniture stays)"""
    w = sc['props'][wi]; tan = tan_of(sc)
    others = [q for q in sc['props'] if q is not w and abs(point_in_prop(w, q['x'], q['z'])[1]) < .3]   # on the same wall
    M = C[w['k']]; hw = -M['ox'] / P * (w.get('s') or 1)
    for k in range(1, 41):
        for sg in (1, -1):
            a = sg * k * .25; x, z = turned_point(w, a, 0); x, z = round(x, 2), round(z, 2)    # along its own wall
            if not w.get('rot') and (x - hw < 1 or x + hw > sc['w'] - 1): continue
            if w.get('rot') and not (1 <= x <= sc['w'] - 1 and 1 <= z <= sc['h'] - 1): continue
            if any(abs(point_in_prop(w, q['x'], q['z'])[0] - a) < hw + (-(C.get(q['k']) or {}).get('ox', -16) / P * (q.get('s') or 1)) + .1 for q in others): continue
            t = dict(w, x=x, z=z); Wn = windows_of(dict(sc, props=[t]), C, P)
            if any(hides(W, sc['props'][n], C[sc['props'][n]['k']], sc, P, tan) > MOVE_TO for W in Wn for n in range(len(sc['props'])) if sc['props'][n] is not w and C.get(sc['props'][n]['k'])): continue
            return x, z
    return None


def clear_scene(sc, C, P, fix=True, log=None):
    """make one scene's windows clear; returns (moved, removed, left)"""
    moved = removed = left = 0
    if sc.get('room') and fix:                         # a room: its windows move, not its furniture
        for _ in range(4):
            occ = occluders(sc, C, P)
            if not occ: break
            Wn, n, c = occ[0]; to = move_window(sc, C, P, Wn['i'], n)
            w = sc['props'][Wn['i']]
            if to is None:
                if log is not None: log.append((w['k'], w['x'], w['z'], c, 'left'))
                left += 1; break
            if log is not None: log.append((w['k'], w['x'], w['z'], c, 'moved', to))
            w['x'], w['z'] = to; moved += 1
        return moved, removed, left
    for _ in range(3):
        wins = windows_of(sc, C, P)
        occ = occluders(sc, C, P, wins)
        if not occ: break
        gone = set()
        for n in sorted({n for (_, n, _) in occ}, key=lambda n: -max(c for (_, m, c) in occ if m == n)):
            q = sc['props'][n]
            c = max(c for (_, m, c) in occ if m == n)
            if not fix:
                if log is not None: log.append((q['k'], q['x'], q['z'], c))
                left += 1; continue
            worst = max((o for o in occ if o[1] == n), key=lambda o: o[2])[0]
            to = move_clear(sc, C, P, n, wins, rot=worst['rot'])
            if to:
                if log is not None: log.append((q['k'], q['x'], q['z'], c, 'moved', to))
                q['x'], q['z'] = to; moved += 1
            elif q.get('w') == 42 or (C[q['k']].get('tags') and 'wild' in C[q['k']]['tags']):
                if log is not None: log.append((q['k'], q['x'], q['z'], c, 'removed'))
                gone.add(n); removed += 1
            else:
                if log is not None: log.append((q['k'], q['x'], q['z'], c, 'left'))
                left += 1
        if gone: sc['props'] = [p for i, p in enumerate(sc['props']) if i not in gone]
        if not fix: break
    return moved, removed, left


def main():
    fix = '--fix' in sys.argv
    only = [a for a in sys.argv[1:] if not a.startswith('--')]
    head, D = load(); C = D['scenery']['props']; P = ppu(D)
    tot = [0, 0, 0]
    for sid, sc in D['maps'].items():
        if sid.startswith('test') or (only and sid not in only) or not sc.get('props'): continue
        log = []
        m, r, l = clear_scene(sc, C, P, fix=fix, log=log)
        if log:
            print(f'{sid}: ' + '; '.join(
                f"{e[0]} at {e[1]:.1f},{e[2]:.1f} hid {e[3]:.0%}" + (f" → moved to {e[5][0]:.1f},{e[5][1]:.1f}" if len(e) > 5 else f' → {e[4]}' if len(e) > 4 else '')
                for e in log))
        tot[0] += m; tot[1] += r; tot[2] += l
    if fix:
        save(head, D)
        print(f'moved {tot[0]}, took away {tot[1]}, left {tot[2]}')
    else:
        print(f'{tot[2]} props hide a window')
    return tot[2]


if __name__ == '__main__':
    sys.exit(1 if main() and '--fix' not in sys.argv and '--strict' in sys.argv else 0)
