#!/usr/bin/env python3
"""alpha 0.1: nothing stands in front of a window. Looks at every window on every building front (and every window on a
room's wall) in every place, as the walk camera sees it, and finds the props that hide one.

    python3 tools/clear-windows.py            # list the windows something hides
    python3 tools/clear-windows.py --fix      # move those props aside (wild plants that can't move are taken away)

A prop hides a window when, seen from the walk camera, its picture covers more of the window than COVER. The camera
looks down at about 31 degrees outside (43 in a room), so a prop a few metres in front of a wall only hides what is low
on it: a bush under a window is fine, a tree in front of it is not. Moving tries small steps sideways first, then
towards the camera, and only to ground of the same kind, clear of doors and of buildings. The builders call
clear_scene() when they make a place (tools/build_places), so new places start clear."""
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
    """every window of a scene in metres: x0, x1 (across), y0, y1 (up from its own ground), z (the wall), g (its ground)"""
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
            out.append(dict(i=n, k=p['k'], x0=xa, x1=xb, y0=-(y + h) * s, y1=-y * s, z=p['z'], g=ground_at(sc, p['x'], p['z'])))
    return out


def hides(Wn, q, Mq, sc, P, tan, at=None, grid=7):
    """how much of window Wn the prop q hides (0..1), with q standing at `at` (x, z) if given"""
    qx, qz = at or (q['x'], q['z'])
    d = Wn['z'] - qz
    if d <= .02 or d > 16: return 0.0
    A = alpha(Mq.get('img') or '')
    if not A: return 0.0
    w, h, a = A
    s = (q.get('s') or 1) / P; fl = -1 if q.get('f') else 1
    gq = ground_at(sc, qx, qz)
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
            if Wn['i'] == n or Wn['z'] - q['z'] <= .02 or Wn['z'] - q['z'] > 16: continue
            if q['x'] < Wn['x0'] - 6 or q['x'] > Wn['x1'] + 6: continue
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
            if p['x'] - bw - rq < x < p['x'] + bw + rq and p['z'] - .25 - rq < z < p['z'] + bd + rq: return True
            if M.get('door') is not None:
                fl = -1 if p.get('f') else 1
                dx = p['x'] + (M['door'].get('x') or 0) / P * s * fl
                if abs(x - dx) < 1.0 + rq and p['z'] - 2.4 < z < p['z'] + .2: return True
    return False


def move_clear(sc, C, P, n, wins):
    """the nearest spot where prop n hides no window: sideways first, then towards the camera too"""
    q = sc['props'][n]; Mq = C[q['k']]; tan = tan_of(sc)
    t0 = tile_at(sc, q['x'], q['z'])
    steps = []
    for dz in (0, -.5, -1, -1.5, -2):
        for k in range(1, 17):
            for sg in (1, -1):
                dx = sg * k * .25
                steps.append((abs(dx) + abs(dz) * 1.3, dx, dz))
    steps.sort()
    near = [Wn for Wn in wins if abs((Wn['x0'] + Wn['x1']) / 2 - q['x']) < 12 and -1 < Wn['z'] - q['z'] < 18]
    for _, dx, dz in steps:
        x, z = round(q['x'] + dx, 2), round(q['z'] + dz, 2)
        if not (1 <= x <= sc['w'] - 1 and 1 <= z <= sc['h'] - 1): continue
        if tile_at(sc, x, z) != t0: continue
        if blocked(sc, C, P, n, x, z): continue
        if any(hides(Wn, q, Mq, sc, P, tan, at=(x, z)) > MOVE_TO for Wn in near): continue
        return x, z
    return None


def move_window(sc, C, P, wi, occ_idx):
    """in a room: the window slides along its wall to a spot nothing stands in front of (the furniture stays)"""
    w = sc['props'][wi]; tan = tan_of(sc)
    others = [q for q in sc['props'] if q is not w and abs(q['z'] - w['z']) < .3]
    M = C[w['k']]; hw = -M['ox'] / P * (w.get('s') or 1)
    for k in range(1, 41):
        for sg in (1, -1):
            x = round(w['x'] + sg * k * .25, 2)
            if x - hw < 1 or x + hw > sc['w'] - 1: continue
            if any(abs(q['x'] - x) < hw + (-(C.get(q['k']) or {}).get('ox', -16) / P * (q.get('s') or 1)) + .1 for q in others): continue
            t = dict(w, x=x); Wn = windows_of(dict(sc, props=[t]), C, P)
            if any(hides(W, sc['props'][n], C[sc['props'][n]['k']], sc, P, tan) > MOVE_TO for W in Wn for n in range(len(sc['props'])) if sc['props'][n] is not w and C.get(sc['props'][n]['k'])): continue
            return x
    return None


def clear_scene(sc, C, P, fix=True, log=None):
    """make one scene's windows clear; returns (moved, removed, left)"""
    moved = removed = left = 0
    if sc.get('room') and fix:                         # a room: its windows move, not its furniture
        for _ in range(4):
            occ = occluders(sc, C, P)
            if not occ: break
            Wn, n, c = occ[0]; x = move_window(sc, C, P, Wn['i'], n)
            w = sc['props'][Wn['i']]
            if x is None:
                if log is not None: log.append((w['k'], w['x'], w['z'], c, 'left'))
                left += 1; break
            if log is not None: log.append((w['k'], w['x'], w['z'], c, 'moved', (x, w['z'])))
            w['x'] = x; moved += 1
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
            to = move_clear(sc, C, P, n, wins)
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
    for sid, sc in D['scenes'].items():
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
