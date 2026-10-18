#!/usr/bin/env python3
"""v43: a flag for every town, and a bare mast for the flag pole.

The flag pole used to be one picture (pole and a teal flag) that swayed as a whole. Now the pole is rigid
(art/scene/props/flag_mast.png, a new file; the old flag_pole.png stays on disk) and the cloth is a separate picture
the game drapes from the top of the mast and waves in the wind (walk-view-gl.js, item kind 'flag'). Each stop's scene
flies its own flag: art/scene/flags/<scene>.png, 48 x 32, a two-colour field with the town's emblem, plus default.png.
Only towns have a flag of their own (scenery.flags lists them); every other pole flies the coin ring. A scene can pick
another with "flag": "<name>" in the Studio (Walk scenes -> Look). Existing pictures are kept.

    python3 tools/build-flags.py            # draw what is missing, point the catalogue's flag_pole at the mast
    python3 tools/build-flags.py --sheet validation/v43-flags.png
    python3 tools/build-flags.py --force    # redraw the flags (never the mast's hand edits: use --force-mast)"""
import gamedata  # phase 04b: the data files in game/data
import os, sys, json, math, importlib.util
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
spec = importlib.util.spec_from_file_location('bsp', os.path.join(HERE, 'build-scene-props.py')); bsp = importlib.util.module_from_spec(spec); spec.loader.exec_module(bsp)
Cv, R, layer_out, finish, pole, prop_meta, save_png, write_json, OUT, META = bsp.Cv, bsp.R, bsp.layer_out, bsp.finish, bsp.pole, bsp.prop_meta, bsp.save_png, bsp.write_json, bsp.OUT, bsp.META
FLAGS = os.path.join(ROOT, 'game', 'art', 'scene', 'flags'); DATA = os.path.join(ROOT, 'game', 'data', 'gamedata.js')
W, H = 48, 32

# only towns fly a flag: field colours (ramp keys) and the emblem for each; every other scene's pole flies the coin ring
TOWNS = dict(
    marigold=('coral', 'cream', 'sun'), pepperpot=('red', 'cream', 'fork'), lanternhall=('lilac', 'marble', 'shell'),
    verdigris=('iron', 'gold', 'coin'), palmhaven=('mint', 'gold', 'palm'), frostcrown=('plum', 'gold', 'star'), default=('teal', 'gold', 'coinring'))
R.update({k: bsp.ramp(v) for k, v in dict(snowc=(238, 242, 248), plum=(120, 72, 140)).items()})


def emblem(cv, kind, Rf, Rb):
    cx, cy = 24, 16
    px = cv.px
    if kind == 'sun':
        for (x, y) in cv.ellpts(cx, cy, 6, 6): px(x, y, Rf[3 if y < cy else 2])
        for a in range(8):
            t = a * math.pi / 4; px(int(cx + math.cos(t) * 9), int(cy + math.sin(t) * 9), Rf[3]); px(int(cx + math.cos(t) * 10), int(cy + math.sin(t) * 10), Rf[2])
    elif kind == 'blade':
        for (x0, lean, hgt, t) in ((cx - 6, -.35, 16, 2), (cx, .05, 20, 3), (cx + 6, .4, 15, 2)):
            for i in range(hgt):
                xx = int(x0 + lean * i * i / hgt); w = 2 if i < hgt * .6 else 1
                for k in range(w): px(xx + k, cy + 9 - i, Rf[t if k == 0 else t - 1])
    elif kind == 'golf':
        for y in range(cy - 8, cy + 9): px(cx - 3, y, Rf[3])
        for y in range(cy - 8, cy - 2):
            for x in range(cx - 2, cx + 5 - (y - (cy - 8))): px(x, y, Rf[2])
        for (x, y) in cv.ellpts(cx - 3, cy + 9, 4, 1.5): px(x, y, Rf[1])
    elif kind == 'thorn':
        for i in range(22):
            y = cy + int(2.5 * math.sin(i * .5)); px(cx - 11 + i, y, Rf[2]); px(cx - 11 + i, y + 1, Rf[1])
        for i in (-8, -3, 2, 7):
            y = cy + int(2.5 * math.sin((i + 11) * .5))
            for k in range(4): px(cx + i, y - 1 - k, Rf[3]); px(cx + i + 1, y - k, Rf[3] if k < 2 else Rf[2])
    elif kind == 'bubble':
        for (x0, y0, r) in ((cx - 4, cy + 2, 5), (cx + 5, cy - 4, 3.5), (cx + 2, cy + 7, 2)):
            for (x, y) in cv.ellpts(x0, y0, r, r):
                d = math.hypot(x + .5 - x0, y + .5 - y0)
                if d > r - 1.2: px(x, y, Rf[3])
            px(int(x0 - r * .4), int(y0 - r * .4), Rf[4])
    elif kind == 'steps':
        for i in range(4):
            for x in range(cx - 8 + i * 4, cx + 9): px(x, cy + 6 - i * 3, Rf[3]); px(x, cy + 7 - i * 3, Rf[2])
            px(cx - 8 + i * 4, cy + 5 - i * 3, Rf[3])
    elif kind == 'gear':
        for (x, y) in cv.ellpts(cx, cy, 6, 6):
            if math.hypot(x + .5 - cx, y + .5 - cy) > 2.5: px(x, y, Rf[2])
        for a in range(8):
            t = a * math.pi / 4; px(int(cx + math.cos(t) * 7.5), int(cy + math.sin(t) * 7.5), Rf[3]); px(int(cx + math.cos(t) * 8.5), int(cy + math.sin(t) * 8.5), Rf[3])
    elif kind == 'fork':
        for y in range(cy - 8, cy + 9): px(cx - 4, y, Rf[3]); px(cx + 4, y, Rf[3])
        for x in (-6, -4, -2):
            for y in range(cy - 8, cy - 3): px(cx + x, y, Rf[2])
        for (x, y) in cv.ellpts(cx + 4, cy - 5, 2.5, 4): px(x, y, Rf[2])
    elif kind == 'shell':
        for (x, y) in cv.ellpts(cx, cy + 2, 8, 6):
            if y < cy + 2: px(x, y, Rf[3 if (x - cx) % 3 else 2])
        for x in range(cx - 8, cx + 9): px(x, cy + 2, Rf[1])
        for i in range(-2, 3): px(cx + i, cy + 3 + abs(i) // 2, Rf[2])
    elif kind == 'duck':
        for (x, y) in cv.ellpts(cx + 1, cy + 3, 7, 4): px(x, y, Rf[3 if y < cy + 3 else 2])
        for (x, y) in cv.ellpts(cx - 5, cy - 3, 3, 3): px(x, y, Rf[3])
        px(cx - 9, cy - 3, Rf[1]); px(cx - 10, cy - 3, Rf[1]); px(cx - 6, cy - 4, Rb[0])
    elif kind == 'wheat':
        for y in range(cy - 2, cy + 9): px(cx, y, Rf[2])
        for i in range(5): px(cx - 1 - i % 2, cy - 2 - i * 2 + 1, Rf[3]); px(cx + 1 + i % 2, cy - 2 - i * 2, Rf[3]); px(cx, cy - 3 - i * 2, Rf[3])
    elif kind == 'peak':
        for y in range(cy - 7, cy + 7):
            w = (y - (cy - 7)) * .9
            for x in range(int(cx - w), int(cx + w) + 1): px(x, y, Rf[3] if y < cy - 3 else Rf[2])
    elif kind in ('coin', 'coinring'):
        for (x, y) in cv.ellpts(cx, cy, 7, 7):
            d = math.hypot(x + .5 - cx, y + .5 - cy)
            if kind == 'coin': px(x, y, Rf[3 if d > 5 or abs(x - cx) < 2 or abs(y - cy) < 1 else 2])
            else: px(x, y, Rf[3] if d > 5 else Rb[2])
        if kind == 'coin': px(cx - 3, cy - 4, Rf[4]); px(cx - 2, cy - 5, Rf[4])
    elif kind == 'anchor':
        for y in range(cy - 7, cy + 6): px(cx, y, Rf[3])
        for x in range(cx - 4, cx + 5): px(x, cy - 4, Rf[3])
        for (x, y) in cv.ellpts(cx, cy - 8, 2, 2):
            if math.hypot(x + .5 - cx, y + .5 - cy + 8) > 1: px(x, y, Rf[3])
        for (x, y) in cv.ellpts(cx, cy + 2, 7, 6):
            if y > cy + 2 and math.hypot(x + .5 - cx, (y + .5 - cy - 2) * 7 / 6) > 5.4: px(x, y, Rf[3])
    elif kind == 'palm':
        for y in range(cy - 2, cy + 9): px(cx + (y - cy) // 5, y, Rf[1])
        for a in (-2.6, -2.1, -1.5, -1.0, -.5):
            for i in range(8): px(int(cx + math.cos(a) * i), int(cy - 2 + math.sin(a) * i * .7), Rf[3 if i < 5 else 2])
    elif kind == 'volcano':
        for y in range(cy - 4, cy + 8):
            w = (y - (cy - 5)) * 1.1
            for x in range(int(cx - w), int(cx + w) + 1): px(x, y, Rf[2])
        for (x, y) in ((cx - 1, cy - 6), (cx, cy - 7), (cx + 1, cy - 5), (cx, cy - 5), (cx - 2, cy - 4), (cx + 2, cy - 3)): px(x, y, Rf[4])
    elif kind == 'horns':
        for i in range(9): px(cx - 3 - i, cy + 4 - i, Rf[3]); px(cx + 3 + i, cy + 4 - i, Rf[3])
        for x in range(cx - 3, cx + 4): px(x, cy + 4, Rf[2]); px(x, cy + 5, Rf[2])
    elif kind == 'star':
        pts = []
        for a in range(10):
            t = -math.pi / 2 + a * math.pi / 5; r = 9 if a % 2 == 0 else 4
            pts.append((cx + math.cos(t) * r, cy + 1 + math.sin(t) * r))
        for (x, y) in cv.polypts(pts): px(x, y, Rf[3 if x < cx else 2])
    elif kind == 'drop':
        for (x, y) in cv.ellpts(cx, cy + 2, 6, 6): px(x, y, Rf[3 if x < cx else 2])
        for y in range(cy - 8, cy - 1):
            w = (y - (cy - 8)) * .8
            for x in range(int(cx - w), int(cx + w) + 1): px(x, y, Rf[3 if x < cx else 2])
        px(cx - 3, cy + 1, Rf[4]); px(cx - 3, cy + 2, Rf[4])


def flag(name):
    fc, ec, kind = TOWNS[name]; Rb, Rf = R[fc], R[ec]
    cv = Cv(W, H)
    for y in range(H):
        for x in range(W):
            t = 2 if y < H * .5 else 1
            if name in ('marigold', 'clovercrest', 'mirrormere') and y > H - 6: t = 3
            cv.px(x, y, Rb[t])
    for y in range(H): cv.px(0, y, Rb[0]); cv.px(1, y, Rb[1])      # the hoist edge
    emblem(cv, kind, Rf, Rb)
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0)); p = img.load()
    for y in range(H):
        for x in range(W):
            c = cv.a[y * W + x]
            if c: p[x, y] = c + (255,)
    return img


def mast():
    Wm, Hm = 70, 170; G = Hm - 2; cx = 16
    cv = Cv(Wm, Hm); lay = Cv(Wm, Hm)
    pole(lay, cx, G - 160, G, R['white'], 3)
    lay.rect(cx - 6, G - 6, cx + 5, G, R['stone'][2])
    for (x, y) in lay.ellpts(cx, G - 162, 3, 3): lay.px(x, y, R['gold'][3])
    layer_out(cv, lay)
    return cv, cx


def main():
    args = sys.argv[1:]; sp = None
    if '--sheet' in args:
        i = args.index('--sheet'); sp = args[i + 1]; del args[i:i + 2]
    force = '--force' in args; fmast = '--force-mast' in args
    os.makedirs(FLAGS, exist_ok=True); made = []
    for name in TOWNS:
        path = os.path.join(FLAGS, name + '.png')
        if os.path.exists(path) and not force: continue
        flag(name).save(path, optimize=True); made.append(name)
    cv, bx = mast(); img = finish(cv, bx, 0); mp = os.path.join(OUT, 'flag_mast.png')
    if save_png(img, mp, fmast): made.append('flag_mast')
    disk = Image.open(mp)
    # the catalogue: flag_pole is drawn as the mast, rigid, with the cloth draped 4.6 m up, 0.06 m right of the pole
    bsp.PROPS['flag_pole'] = dict(fn=None, name='Flag pole', shadow=.3, sway=0, tags=['city', 'town'], flat=0, group='flag_pole', solid=.2, box=None, posts=None)
    m = prop_meta('flag_pole', cv, bx, disk); m['img'] = 'scene/props/flag_mast.png'; m['sway'] = 0
    m['flag'] = dict(dx=round(2 / 34, 3), h=round(156 / 34, 2), w=round(48 / 34, 2), fh=round(32 / 34, 2))
    P = json.load(open(META)); P['flag_pole'] = dict(P.get('flag_pole', {}), **m); write_json(META, P)
    src = gamedata.js_text(); i = src.index('window.GAMEDATA='); head = src[:i]
    D = json.JSONDecoder().raw_decode(src[i + len('window.GAMEDATA='):])[0]
    e = D['scenery']['props']['flag_pole']; e.update(img=m['img'], ox=m['ox'], oy=m['oy'], sway=0, flag=m['flag'])
    D['scenery']['flags'] = [k for k in TOWNS if k != 'default']      # the scenes that have a flag of their own
    gamedata.save_js(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n')
    print('flags:', len(TOWNS), 'drawn now:', ', '.join(made) or 'none (all there)', '; catalogue: flag_pole -> flag_mast.png with a flag of %s x %s m at %s m' % (m['flag']['w'], m['flag']['fh'], m['flag']['h']))
    if sp:
        names = list(TOWNS); S = 3; cols = 5; rows = (len(names) + cols - 1) // cols
        out = Image.new('RGBA', (cols * (W * S + 16) + 8, rows * (H * S + 26) + 8), (62, 54, 84, 255)); d = ImageDraw.Draw(out)
        for k, n in enumerate(names):
            x = 8 + (k % cols) * (W * S + 16); y = 8 + (k // cols) * (H * S + 26)
            out.alpha_composite(Image.open(os.path.join(FLAGS, n + '.png')).resize((W * S, H * S), Image.NEAREST), (x, y)); d.text((x, y + H * S + 2), n, fill=(230, 226, 240))
        out.save(sp); print('sheet', sp)


if __name__ == '__main__':
    main()
