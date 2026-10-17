#!/usr/bin/env python3
"""v28 game data: ladders up the cliffs in the mountain and canyon places, and your own house in Sundown.

    python3 tools/build-v28.py

A ladder goes where a cliff face 1.4 to 4.2 m high looks toward the camera, with open, dry ground at its foot and
on top, not far from where you arrive. Only adds what is missing, so anything you changed in the Studio stays."""
import gamedata  # phase 04b: the data files in game/data
import base64, json, math, struct
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'data' / 'gamedata.js'
PROPS = json.loads((ROOT / 'game' / 'art' / 'scene' / 'props.json').read_text())
LADDER_M = 110 / 34          # the ladder picture's height in metres at scale 1
SCENES = {'ridge': 2, 'canyon': 2, 'pass': 2, 'summit': 1, 'volcano': 1, 'thicket': 1}


def grid(sc):
    w2, h2 = sc['w'] * 2, sc['h'] * 2
    if not sc.get('steps'): return None
    raw = base64.b64decode(sc['steps']); H = [v / 20 for v in struct.unpack('<%dh' % (len(raw) // 2), raw)]
    m = base64.b64decode(sc['stepm']) if sc.get('stepm') else bytes(w2 * h2)
    if len(H) != w2 * h2: return None
    return w2, h2, H, m


def ter(sc, x, z):
    rows = sc.get('tiles') or []
    j = sc['h'] - 1 - int(math.floor(z)); i = int(math.floor(x))
    return rows[j][i] if 0 <= j < len(rows) and 0 <= i < len(rows[j]) else sc.get('edge', 'g')


def clear(sc, x, z, r=1.0):
    for p in sc.get('props', []):
        M = PROPS.get(p['k'], {})
        rr = max((M.get('box') or [0, 0])) * .5 * p.get('s', 1) if M.get('box') else max(.3, M.get('solid') or M.get('shadow', .5) * .5)
        if math.hypot(p['x'] - x, p['z'] - z) < r + rr: return False
    return True


def ladders(sc, want):
    g = grid(sc)
    if not g: return []
    w2, h2, H, M = g; hub = sc.get('hub', [sc['w'] / 2, sc['h'] / 2]); found = []
    at = lambda i, j: H[j * w2 + i] if 0 <= i < w2 and 0 <= j < h2 else None
    for j in range(2, h2 - 4):
        for i in range(4, w2 - 4):
            h0 = at(i, j); h1 = max(at(i, j + 1), at(i, j + 2))
            if h0 is None or h1 is None: continue
            d = h1 - h0
            if not 1.4 <= d <= 4.2: continue
            # a straight face: the cells beside it step up the same way
            if any(abs((max(at(i + k, j + 1), at(i + k, j + 2)) - at(i + k, j)) - d) > .25 for k in (-3, -2, -1, 1, 2, 3)): continue
            if any(M[(j + dj) * w2 + i + di] & 16 for di in (-1, 0, 1) for dj in (0, 1, 2)): continue      # ledges you can hop anyway
            x = (i + .5) / 2; zf = (j + 1) / 2 if at(i, j + 1) - h0 > 1 else (j + 2) / 2
            bot, top = (x, zf - .6), (x, zf + .8)
            if top[1] > sc['h'] - .5 or bot[1] < .5: continue
            if at(i, int(top[1] * 2)) is None or abs(at(i, int(top[1] * 2)) - h1) > .2: continue
            if ter(sc, *bot) in 'wdk' and ter(sc, *bot) != 'k' or ter(sc, *top) in 'wd': continue
            if not clear(sc, *bot) or not clear(sc, *top): continue
            dh = math.hypot(x - hub[0], bot[1] - hub[1])
            if dh < 3 or dh > 20: continue
            found.append((dh, x, zf, d))
    found.sort(); out = []
    for dh, x, zf, d in found:
        if all(math.hypot(x - o[0], zf - o[1]) > 8 for o in out): out.append((x, zf, d))
        if len(out) >= want: break
    return out


def main():
    s = gamedata.js_text(); i = s.index('window.GAMEDATA=')
    head, D = s[:i], json.JSONDecoder().raw_decode(s[i + 16:])[0]
    for sid, want in SCENES.items():
        sc = D['scenes'].get(sid)
        if not sc or any(p['k'] == 'ladder' for p in sc.get('props', [])): continue
        L = ladders(sc, want)
        for x, zf, d in L:
            sc['props'].append({'k': 'ladder', 'x': round(x, 2), 'z': round(zf - .12, 2), 's': round((d + .35) / LADDER_M, 2), 'act': 'climb', 'label': 'Ladder',
                                'to': [round(x, 2), round(zf + .8, 2)], 'h': round(d, 2)})
        print(f'{sid}: {len(L)} ladder(s)', [(round(x, 1), round(zf, 1), round(d, 1)) for x, zf, d in L])
    # your house in Sundown: the house nearest where you arrive
    sd = D['scenes'].get('sundown')
    if sd and not any(p.get('act') == 'home' for p in sd['props']):
        hub = sd.get('hub', [0, 0]); hs = [p for p in sd['props'] if (PROPS.get(p['k'], {}).get('group') == 'house') and p.get('act') in (None, 'house')]
        if hs:
            p = min(hs, key=lambda p: math.hypot(p['x'] - hub[0], p['z'] - hub[1])); p['act'] = 'home'; p['label'] = 'Your house'; p.pop('say', None)
            print('sundown: your house at', p['x'], p['z'])
    gamedata.save_js(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n')


if __name__ == '__main__':
    main()
