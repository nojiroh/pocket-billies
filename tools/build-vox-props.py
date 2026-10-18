#!/usr/bin/env python3
"""v43: voxel props. Sixty-odd manufactured things (benches, planters, lamps, crates, barrels, fences, signs, bins,
tables, carts...) as small voxel models, written as recipes: a list of layers, each a shape (box, cylinder, sphere,
cone, barrel) in metres with a colour and a texture, plus optional picture layers (a 2D sprite placed in the model).
The game (game/js/prop-models.js) turns a recipe into voxels at eight to the metre, meshes them and draws them as cel-shaded
solids in the scene's light and shadow in place of the prop's picture when the Voxel props dial is on. The Studio's
Prop builder edits the same recipes (add a layer, move it, change its colour or texture, add a picture layer), and
can import a MagicaVoxel .vox as a raw layer. A recipe that exists on disk is kept (yours); --force rewrites.

    python3 tools/build-vox-props.py                      # write the missing recipes, point the catalogue at them
    python3 tools/build-vox-props.py --sheet validation/v43-vox.png   # isometric previews
    python3 tools/build-vox-props.py --force"""
import gamedata  # phase 04b: the data files in game/data
import os, sys, json, math, random, importlib.util
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
spec = importlib.util.spec_from_file_location('bsp', os.path.join(HERE, 'build-scene-props.py')); bsp = importlib.util.module_from_spec(spec); spec.loader.exec_module(bsp)
R = bsp.R; R.update({k: bsp.ramp(v) for k, v in dict(paint_red=(200, 70, 60), paint_blue=(70, 110, 190), paint_green=(80, 150, 90), paint_yellow=(230, 190, 70), terra=(190, 110, 80), concrete=(180, 176, 168), dark=(60, 56, 70)).items()})
OUT = os.path.join(ROOT, 'game', 'art', 'scene', 'vox'); META = bsp.META; DATA = os.path.join(ROOT, 'game', 'data', 'gamedata.js')
VPM = 8
hx = lambda c: '#%02X%02X%02X' % tuple(c)


class Vox:
    """records shape layers (metres: x across, y depth, z up from the ground; x and y centred on the prop's base point)"""
    def __init__(s): s.L = []
    def add(s, **kw):
        kw = {k: (round(v, 3) if isinstance(v, float) else v) for k, v in kw.items() if v is not None}
        s.L.append(kw)
    def box(s, x0, y0, z0, x1, y1, z1, Rr, tone=2, tex='plain', name=None): s.add(k='box', x=(x0 + x1) / 2, y=(y0 + y1) / 2, z=z0, w=x1 - x0, d=y1 - y0, h=z1 - z0, col=hx(Rr[tone]), tex=tex, name=name)
    def cyl(s, cx, cy, z0, z1, r, Rr, tone=2, tex='plain', ry=None, name=None): s.add(k='cyl', x=cx, y=cy, z=z0, r=r, ry=ry, h=z1 - z0, col=hx(Rr[tone]), tex=tex, name=name)
    def sphere(s, cx, cy, cz, r, Rr, tone=2, tex='plain', name=None): s.add(k='sphere', x=cx, y=cy, z=cz - r, r=r, col=hx(Rr[tone]), tex=tex, name=name)
    def cone(s, cx, cy, z0, z1, r0, r1, Rr, tone=2, tex='plain', name=None): s.add(k='cone', x=cx, y=cy, z=z0, r=r0, r1=r1, h=z1 - z0, col=hx(Rr[tone]), tex=tex, name=name)
    def barrel(s, cx, cy, z0, z1, r, Rr, tone=2, tex='plain', bulge=.15, name=None): s.add(k='barrel', x=cx, y=cy, z=z0, r=r, h=z1 - z0, bulge=bulge, col=hx(Rr[tone]), tex=tex, name=name)
    def img(s, path, x=0, y=0, z=0, s_=1.0, face='fixed', flip=0, name=None): s.add(k='img', img=path, x=x, y=y, z=z, s=s_, face=face, flip=flip, name=name)


PROPS = {}
def vox(key, group=None):
    def deco(fn): PROPS[key] = dict(fn=fn, group=group); return fn
    return deco


# ----------------------------------------------------------------------------- recipes
def bench(v, Rw, Rl, w=1.9, back=True, tex='wood'):
    for i, x in enumerate((-w / 2 + .12, w / 2 - .2)):
        v.box(x, -.22, 0, x + .08, -.14, .42, Rl, name='leg'); v.box(x, .14, 0, x + .08, .22, .42, Rl, name='leg'); v.box(x, -.24, .38, x + .08, .24, .44, Rl, name='rail')
    for i in range(3): v.box(-w / 2, -.24 + i * .17, .44, w / 2, -.1 + i * .17, .5, Rw, 2, tex, name='slat')
    if back:
        for x in (-w / 2 + .12, w / 2 - .2): v.box(x, .18, .44, x + .08, .24, .95, Rl, name='back post')
        for z in (.62, .8): v.box(-w / 2, .18, z, w / 2, .24, z + .1, Rw, 2, tex, name='back slat')


@vox('bench_wood', 'bench_wood')
def p_bench_wood(v): bench(v, R['wood'], R['dwood'])
@vox('bench_metal', 'bench_metal')
def p_bench_metal(v): bench(v, R['plank'], R['iron'])
@vox('bench_stone', 'bench_wood')
def p_bench_stone(v): v.box(-.9, -.22, 0, -.7, .22, .42, R['stone'], tex='stone'); v.box(.7, -.22, 0, .9, .22, .42, R['stone'], tex='stone'); v.box(-1, -.26, .42, 1, .26, .52, R['stone'], 2, 'stone', name='seat')
@vox('bench_park', 'bench_wood')
def p_bench_park(v): bench(v, R['paint_green'], R['iron'], tex='plain')


def planter(v, Rb, Rp, w=1.2, d=.5, h=.45, round_=False, tex='wood'):
    if round_: v.cyl(0, 0, 0, h, w / 2, Rb, 2, tex, name='pot'); v.cyl(0, 0, h - .06, h, w / 2 - .06, R['soil'], 2, 'grain', name='soil')
    else: v.box(-w / 2, -d / 2, 0, w / 2, d / 2, h, Rb, 2, tex, name='box'); v.box(-w / 2 + .06, -d / 2 + .06, h - .06, w / 2 - .06, d / 2 - .06, h, R['soil'], 2, 'grain', name='soil')
    rng = random.Random(w * 7 + h)
    for i in range(max(2, int(w * 4))):
        x = -w / 2 + .14 + i * (w - .28) / max(1, int(w * 4) - 1); y = rng.uniform(-d / 3, d / 3) if not round_ else rng.uniform(-w / 5, w / 5)
        v.sphere(x, y, h + .14, .14 + rng.uniform(0, .05), R['leaf'], 2, 'leaves', name='plant')
        if Rp: v.sphere(x + rng.uniform(-.05, .05), y, h + .28, .06, Rp, 3, name='flower')


@vox('planter_box', 'planter_box')
def p_planter_box(v): planter(v, R['dwood'], R['red'])
@vox('planter_box_blue', 'planter_box')
def p_planter_box_blue(v): planter(v, R['paint_blue'], R['yellow'], tex='plain')
@vox('planter_box_stone', 'planter_box')
def p_planter_box_stone(v): planter(v, R['concrete'], R['pink'], w=1.6, d=.6, h=.5, tex='stone')
@vox('planter_round', 'planter_round')
def p_planter_round(v): planter(v, R['terra'], R['white'], w=.9, h=.5, round_=True, tex='plain')
@vox('planter_round_b', 'planter_round')
def p_planter_round_b(v): planter(v, R['stone'], R['lilac'], w=1.1, h=.42, round_=True, tex='stone')
@vox('flowerpot', 'flowerpot')
def p_flowerpot(v): planter(v, R['terra'], R['coral'], w=.4, h=.32, round_=True, tex='plain')


def lamp(v, Rp, h=3.4, style='round', Rg=None):
    Rg = Rg or R['lamp']
    v.cyl(0, 0, 0, .12, .22, Rp, 1, name='foot'); v.cyl(0, 0, .12, h - .5, .07, Rp, 2, name='post')
    if style == 'round': v.cyl(0, 0, h - .5, h - .42, .16, Rp, name='collar'); v.sphere(0, 0, h - .2, .22, Rg, 3, name='lamp'); v.cyl(0, 0, h - .02, h + .06, .06, Rp, 1, name='cap')
    elif style == 'box': v.box(-.18, -.18, h - .5, .18, .18, h - .06, Rg, 3, name='lamp'); v.box(-.22, -.22, h - .06, .22, .22, h, Rp, 1, name='roof'); v.box(-.22, -.22, h - .54, .22, .22, h - .5, Rp, 1, name='base')
    elif style == 'double':
        for sgn in (-1, 1): v.box(min(0, sgn * .5), -.04, h - .6, max(0, sgn * .5), .04, h - .52, Rp, name='arm'); v.sphere(sgn * .5, 0, h - .32, .2, Rg, 3, name='lamp')
    else: v.box(-.04, -.04, h - .5, .04, .5, h - .42, Rp, name='arm'); v.sphere(0, .45, h - .25, .2, Rg, 3, name='lamp')


@vox('streetlamp', 'streetlamp')
def p_streetlamp(v): lamp(v, R['iron'], 3.4, 'round')
@vox('streetlamp_b', 'streetlamp')
def p_streetlamp_b(v): lamp(v, R['iron'], 3.6, 'double')
@vox('lantern', 'lantern')
def p_lantern(v): lamp(v, R['dwood'], 2.2, 'box')
@vox('lantern_b', 'lantern')
def p_lantern_b(v): lamp(v, R['dwood'], 2.6, 'arm', R['coral'])
@vox('lamp_modern', 'streetlamp')
def p_lamp_modern(v): lamp(v, R['stone'], 4.0, 'arm')


def crate(v, x=0, y=0, z=0, s=.8, Rw=None):
    Rw = Rw or R['plank']; h = s / 2
    v.box(x - h, y - h, z, x + h, y + h, z + s, Rw, 2, 'wood', name='crate')
    for zz in (z, z + s * .45, z + s - .07): v.box(x - h - .02, y - h - .02, zz, x + h + .02, y + h + .02, zz + .06, R['dwood'], name='band')


@vox('crate', 'crate')
def p_crate(v): crate(v)
@vox('crate_goods', 'crate')
def p_crate_goods(v): crate(v); v.box(-.3, -.3, .8, .3, .3, 1.0, R['coral'], 2, 'cloth', name='cloth'); v.sphere(.1, .05, 1.1, .14, R['yellow'], 3, name='fruit')
@vox('crates', 'crates')
def p_crates(v): crate(v, -.5, -.05, 0, .8); crate(v, .45, 0, 0, .7, R['hay']); crate(v, -.25, 0, .8, .6)
@vox('crate_stack', 'crate_stack')
def p_crate_stack(v): p_crates(v); crate(v, .05, 0, 1.4, .6)
@vox('barrel_wood', 'crates')
def p_barrel_wood(v): v.barrel(0, 0, 0, .9, .34, R['wood'], 2, 'wood', name='staves'); [v.cyl(0, 0, z, z + .07, .37 + (.05 if z > .3 and z < .6 else 0), R['iron'], 1, name='hoop') for z in (.1, .42, .76)]
@vox('barrels', 'barrels')
def p_barrels(v):
    for (x, y) in ((-.4, .1), (.42, -.05)): v.barrel(x, y, 0, .9, .34, R['wood'], 2, 'wood', name='staves'); [v.cyl(x, y, z, z + .07, .37 + (.05 if .3 < z < .6 else 0), R['iron'], 1, name='hoop') for z in (.1, .42, .76)]
@vox('barrel_blue', 'crates')
def p_barrel_blue(v): v.barrel(0, 0, 0, .95, .32, R['paint_blue'], 2, 'plain', .05, name='drum'); v.cyl(0, 0, .3, .36, .34, R['iron'], 1, name='rib'); v.cyl(0, 0, .6, .66, .34, R['iron'], 1, name='rib')
@vox('barrel_rust', 'crates')
def p_barrel_rust(v): v.barrel(0, 0, 0, .95, .32, R['rust'], 2, 'rust', .05, name='drum')


@vox('table_round', 'table_round')
def p_table_round(v): v.cyl(0, 0, 0, .05, .3, R['iron'], 1, name='foot'); v.cyl(0, 0, .05, .7, .05, R['iron'], name='stem'); v.cyl(0, 0, .7, .76, .55, R['plank'], 2, 'wood', name='top')
@vox('cafe_table', 'cafe_table')
def p_cafe_table(v): v.cyl(0, 0, 0, .05, .28, R['iron'], 1, name='foot'); v.cyl(0, 0, .05, .72, .04, R['iron'], name='stem'); v.cyl(0, 0, .72, .76, .45, R['white'], 3, name='top')
@vox('picnic', 'picnic')
def p_picnic(v):
    for x in (-.9, .8): v.box(x, -.5, 0, x + .1, .5, .7, R['dwood'], name='trestle')
    v.box(-1.1, -.3, .7, 1.1, .3, .78, R['plank'], 2, 'wood', name='top')
    for y in (-.62, .5): v.box(-1.1, y, .42, 1.1, y + .14, .48, R['plank'], 2, 'wood', name='seat')
@vox('chair_wood', 'chair_wood')
def p_chair_wood(v):
    for (x, y) in ((-.2, -.2), (.16, -.2), (-.2, .16), (.16, .16)): v.box(x, y, 0, x + .05, y + .05, .44, R['dwood'], name='leg')
    v.box(-.24, -.24, .44, .24, .24, .5, R['wood'], 2, 'wood', name='seat'); v.box(-.24, .16, .5, .24, .24, .95, R['wood'], 2, 'wood', name='back')


def fence(v, Rw, w=2.0, h=1.0, picket=False):
    for x in (-w / 2 + .05, w / 2 - .1): v.box(x, -.05, 0, x + .07, .05, h + .05, Rw, 1, 'wood', name='post')
    if picket:
        n = int(w / .16)
        for i in range(n): x = -w / 2 + .12 + i * (w - .24) / max(1, n - 1); v.box(x, -.03, 0, x + .06, .03, h, R['white'], 3, name='picket')
        for z in (h * .3, h * .7): v.box(-w / 2, -.04, z, w / 2, .0, z + .08, R['white'], 2, name='rail')
    else:
        for z in (h * .35, h * .75): v.box(-w / 2, -.03, z, w / 2, .03, z + .1, Rw, 2, 'wood', name='rail')


@vox('fence_wood', 'fence_wood')
def p_fence_wood(v): fence(v, R['wood'])
@vox('picket_fence', 'picket_fence')
def p_picket_fence(v): fence(v, R['white'], picket=True, h=.9)
@vox('fence_wood_post', 'fence_wood')
def p_fence_post(v): v.box(-.05, -.05, 0, .05, .05, 1.05, R['wood'], 1, 'wood', name='post')
@vox('stone_wall', 'stone_wall')
def p_stone_wall(v): v.box(-1.2, -.25, 0, 1.2, .25, .9, R['stone'], 2, 'stone', name='wall')


def sign(v, Rw, boards=2, h=1.9):
    v.box(-.05, -.05, 0, .05, .05, h, Rw, 1, 'wood', name='post')
    for i in range(boards):
        z = h - .3 - i * .32; d = 1 if i % 2 else -1
        v.box(min(0, d * .7), -.03, z, max(0, d * .7), .03, z + .22, Rw, 2, 'wood', name='board')
        v.box(min(0, d * .7) + (.0 if d < 0 else .5), -.035, z + .08, max(0, d * .7) - (.5 if d < 0 else 0), -.03, z + .14, R['cream'], 3, name='lettering')


@vox('signpost', 'signpost')
def p_signpost(v): sign(v, R['wood'])
@vox('signpost_three', 'signpost')
def p_signpost_three(v): sign(v, R['dwood'], boards=3, h=2.2)
@vox('ski_sign', 'ski_sign')
def p_ski_sign(v): sign(v, R['paint_blue'], boards=1, h=1.6)
@vox('billboard', 'billboard')
def p_billboard(v):
    for x in (-1.2, 1.1): v.box(x, -.06, 0, x + .1, .06, 2.4, R['iron'], name='leg')
    v.box(-1.4, -.03, 1.2, 1.4, .03, 2.6, R['white'], 3, name='board'); v.box(-1.2, -.035, 1.4, 1.2, -.03, 2.4, R['sky'], 2, name='poster'); v.box(-.8, -.04, 1.8, .6, -.035, 2.1, R['gold'], 3, name='title')


@vox('mailbox_red', 'mailbox_red')
def p_mailbox_red(v): v.cyl(0, 0, 0, .1, .22, R['paint_red'], 1, name='foot'); v.cyl(0, 0, .1, 1.1, .2, R['paint_red'], name='pillar'); v.sphere(0, 0, 1.1, .2, R['paint_red'], 3, name='cap'); v.box(-.1, -.22, .8, .1, -.18, .84, R['dark'], name='slot')
@vox('mailbox_blue', 'mailbox_blue')
def p_mailbox_blue(v): v.box(-.04, -.04, 0, .04, .04, .9, R['iron'], name='post'); v.box(-.3, -.22, .9, .3, .22, 1.3, R['paint_blue'], name='box'); v.cyl(0, 0, 1.3, 1.5, .3, R['paint_blue'], 3, ry=.22, name='lid')
@vox('mailbox', 'mailbox')
def p_mailbox(v): v.box(-.04, -.04, 0, .04, .04, 1.0, R['dwood'], name='post'); v.box(-.25, -.15, 1.0, .25, .15, 1.28, R['stone'], name='box'); v.cyl(0, 0, 1.28, 1.42, .25, R['stone'], 3, ry=.15, name='lid'); v.box(.22, -.03, 1.1, .28, .03, 1.2, R['red'], 3, name='flag')


@vox('trash_city', 'trash_city')
def p_trash_city(v): v.cyl(0, 0, 0, .95, .3, R['iron'], 2, 'metal', name='bin'); v.cyl(0, 0, .95, 1.0, .33, R['dark'], name='rim'); v.cyl(0, 0, .96, 1.0, .18, R['dark'], 0, name='hole')
@vox('trash', 'trash')
def p_trash(v): v.cyl(0, 0, 0, .85, .28, R['stone'], 2, 'stone', name='bin'); v.cyl(0, 0, .85, .92, .3, R['stone'], 3, name='rim'); v.cyl(0, 0, .92, 1.0, .22, R['dark'], 1, name='lid')
@vox('bin_green', 'trash')
def p_bin_green(v): v.box(-.3, -.3, 0, .3, .3, 1.0, R['paint_green'], name='bin'); v.box(-.32, -.32, 1.0, .32, .32, 1.1, R['paint_green'], 1, name='lid')
@vox('hydrant', 'hydrant')
def p_hydrant(v): v.cyl(0, 0, 0, .1, .2, R['paint_red'], 1, name='foot'); v.cyl(0, 0, .1, .7, .13, R['paint_red'], name='body'); v.sphere(0, 0, .75, .15, R['paint_red'], 3, name='cap'); v.box(-.26, -.07, .4, .26, .07, .52, R['paint_red'], 1, name='arms')
@vox('bollard', 'bollard')
def p_bollard(v): v.cyl(0, 0, 0, .9, .12, R['iron'], 2, 'metal', name='post'); v.sphere(0, 0, .92, .13, R['iron'], 3, name='knob')
@vox('bollard_stone', 'bollard')
def p_bollard_stone(v): v.cyl(0, 0, 0, .7, .16, R['stone'], 2, 'stone', name='post'); v.sphere(0, 0, .74, .17, R['stone'], 3, name='knob')
@vox('bike_rack', 'bike_rack')
def p_bike_rack(v):
    for x in (-.6, 0, .6): v.box(x - .22, -.03, 0, x - .16, .03, .8, R['iron'], name='leg'); v.box(x + .16, -.03, 0, x + .22, .03, .8, R['iron'], name='leg'); v.box(x - .22, -.03, .8, x + .22, .03, .86, R['iron'], name='hoop')
@vox('birdhouse', 'birdhouse')
def p_birdhouse(v): v.box(-.03, -.03, 0, .03, .03, 1.5, R['dwood'], name='post'); v.box(-.18, -.16, 1.5, .18, .16, 1.85, R['plank'], 2, 'wood', name='house'); v.box(-.22, -.2, 1.85, .22, .2, 1.92, R['paint_red'], name='roof'); v.box(-.03, -.18, 1.65, .03, -.16, 1.71, R['dark'], 0, name='hole')
@vox('well', 'well')
def p_well(v):
    v.cyl(0, 0, 0, .9, .7, R['stone'], 2, 'stone', name='wall'); v.cyl(0, 0, .3, .85, .5, R['water'], 1, name='water')
    for x in (-.6, .55): v.box(x, -.05, .9, x + .08, .05, 2.2, R['dwood'], name='post')
    v.box(-.8, -.6, 2.2, .8, .6, 2.3, R['dwood'], name='beam'); v.box(-.9, -.7, 2.3, .9, .7, 2.42, R['brick'], 2, 'stone', name='roof'); v.box(-.6, -.06, 1.55, .6, .06, 1.65, R['dwood'], name='axle')
@vox('wheelbarrow', 'wheelbarrow')
def p_wheelbarrow(v):
    v.box(-.5, -.3, .3, .4, .3, .6, R['paint_green'], name='tub'); v.box(-.45, -.25, .5, .35, .25, .6, R['soil'], 2, 'grain', name='load'); v.cyl(.5, 0, .0, .4, .2, R['dark'], ry=.05, name='wheel')
    for y in (-.2, .2): v.box(-1.0, y, .35, -.5, y + .05, .4, R['wood'], name='handle')
@vox('market_cart', 'market_cart')
def p_market_cart(v):
    v.box(-.8, -.5, .5, .8, .5, .9, R['wood'], 2, 'wood', name='bed')
    for x in (-.55, .55): v.cyl(x, 0, .0, .5, .25, R['dwood'], ry=.05, name='wheel')
    for x in (-.75, .7): v.box(x, -.45, .9, x + .05, .45, 1.9, R['dwood'], name='post')
    v.box(-.85, -.6, 1.9, .85, .6, 2.0, R['red'], 3, 'stripes', name='awning')
    for (x, y, c) in ((-.4, -.2, 'red'), (.1, .1, 'orange'), (.45, -.25, 'yellow'), (-.1, .3, 'leaf')): v.sphere(x, y, 1.0, .14, R[c], 3, name='goods')
@vox('phone_booth', 'phone_booth')
def p_phone_booth(v): v.box(-.45, -.45, 0, .45, .45, 2.3, R['paint_red'], name='booth'); v.box(-.35, -.46, .5, .35, -.44, 2.0, R['glass'], 3, name='glass'); v.box(-.46, -.35, .5, -.44, .35, 2.0, R['glass'], 3, name='glass'); v.box(-.5, -.5, 2.3, .5, .5, 2.42, R['paint_red'], 1, name='roof')
@vox('vending', 'vending')
def p_vending(v): v.box(-.45, -.35, 0, .45, .35, 1.9, R['paint_blue'], name='machine'); v.box(-.35, -.36, .9, .35, -.34, 1.7, R['glass'], 3, name='window'); v.box(-.35, -.36, .3, .35, -.34, .7, R['dark'], name='tray')
@vox('fridge_drinks', 'vending')
def p_fridge(v): v.box(-.4, -.35, 0, .4, .35, 1.8, R['white'], 3, name='fridge'); v.box(-.32, -.36, .2, .32, -.34, 1.7, R['glass'], 3, name='door')
@vox('bus_shelter', 'bus_shelter')
def p_bus_shelter(v):
    for x in (-1.4, 1.3): v.box(x, -.05, 0, x + .1, .05, 2.4, R['iron'], name='post'); v.box(x, .55, 0, x + .1, .65, 2.4, R['iron'], name='post')
    v.box(-1.5, -.1, 2.4, 1.5, .8, 2.5, R['iron'], 1, name='roof'); v.box(-1.4, .6, .3, 1.4, .64, 2.4, R['glass'], 3, name='back glass'); v.box(-1.2, .3, .45, 1.2, .55, .5, R['plank'], 2, 'wood', name='seat')
@vox('haybale', 'haybale')
def p_haybale(v): v.box(-.6, -.55, 0, .6, .55, 1.0, R['hay'], 2, 'hay', name='bale')
@vox('haybale_round', 'haybale')
def p_haybale_round(v): v.cyl(0, .0, 0, 1.2, .6, R['hay'], 2, 'hay', ry=.6, name='bale')
@vox('firewood', 'firewood')
def p_firewood(v):
    for i in range(3):
        for j in range(4 - i): v.cyl(-.5 + j * .3 + i * .15, 0, i * .26, i * .26 + .26, .13, R['bark'], 2, 'wood', ry=.45, name='log')
@vox('log', 'log')
def p_log(v): v.cyl(0, 0, 0, .5, 1.0, R['bark'], 2, 'wood', ry=.25, name='log'); v.box(-.26, -1.02, .22, .26, -1.0, .3, R['plank'], 3, name='cut end')
@vox('stump', 'stump')
def p_stump(v): v.cyl(0, 0, 0, .5, .38, R['bark'], 2, 'wood', name='stump'); v.cyl(0, 0, .5, .52, .36, R['plank'], 3, 'rings', name='top')
@vox('ladder', 'ladder')
def p_ladder(v):
    for x in (-.25, .2): v.box(x, -.03, 0, x + .05, .03, 2.8, R['wood'], 2, 'wood', name='rail')
    for i in range(9): v.box(-.25, -.02, .25 + i * .3, .25, .02, .3 + i * .3, R['wood'], 3, name='rung')
@vox('deck_chair', 'deck_chair')
def p_deck_chair(v):
    for (x, y) in ((-.3, -.25), (.25, -.25)): v.box(x, y, 0, x + .05, y + .05, .4, R['wood'], name='leg')
    v.box(-.35, -.3, .4, .35, .3, .46, R['teal'], 2, 'stripes', name='seat'); v.box(-.35, .25, .46, .35, .3, 1.0, R['teal'], 2, 'stripes', name='back')
@vox('beach_umbrella', 'beach_umbrella')
def p_umbrella(v): v.cyl(0, 0, 0, 2.1, .03, R['iron'], name='pole'); v.cone(0, 0, 1.7, 2.2, 1.1, .05, R['coral'], 3, 'stripes', name='canopy')
@vox('buoy', 'buoy')
def p_buoy(v): v.sphere(0, 0, .3, .32, R['red'], 2, name='float'); v.cyl(0, 0, .55, .9, .06, R['iron'], name='mast'); v.sphere(0, 0, .95, .09, R['yellow'], 4, name='light')
@vox('dock_post', 'dock_post')
def p_dock_post(v): v.cyl(0, 0, 0, 1.3, .12, R['dwood'], 2, 'wood', name='post'); v.cyl(0, 0, 1.3, 1.36, .13, R['dark'], name='cap')
@vox('traffic_light', 'traffic_light')
def p_traffic_light(v):
    v.cyl(0, 0, 0, .1, .2, R['dark'], name='foot'); v.cyl(0, 0, .1, 3.0, .06, R['dark'], name='post'); v.box(-.18, -.14, 3.0, .18, .14, 3.9, R['dark'], name='housing')
    for (z, c) in ((3.7, 'red'), (3.45, 'gold'), (3.2, 'leaf')): v.sphere(0, -.15, z, .1, R[c], 3, name='light')
@vox('fountain', 'fountain')
def p_fountain(v):
    v.cyl(0, 0, 0, .5, 1.3, R['stone'], 2, 'stone', name='basin'); v.cyl(0, 0, .3, .5, 1.1, R['water'], 2, name='water'); v.cyl(0, 0, .5, 1.1, .12, R['stone'], name='stem'); v.cyl(0, 0, 1.1, 1.2, .5, R['stone'], 3, name='bowl'); v.cyl(0, 0, 1.2, 1.3, .4, R['water'], 3, name='water')
@vox('fountain_big', 'fountain_big')
def p_fountain_big(v):
    v.cyl(0, 0, 0, .6, 2.2, R['marble'], 2, 'stone', name='basin'); v.cyl(0, 0, .35, .6, 1.95, R['water'], 2, name='water'); v.cyl(0, 0, .6, 1.5, .18, R['marble'], name='stem'); v.cyl(0, 0, 1.5, 1.65, .9, R['marble'], 3, name='bowl'); v.cyl(0, 0, 1.65, 1.75, .8, R['water'], 3, name='water'); v.cyl(0, 0, 1.75, 2.3, .1, R['marble'], name='spout')
@vox('statue_coin', 'statue_coin')
def p_statue_coin(v): v.box(-.6, -.6, 0, .6, .6, .8, R['marble'], 2, 'stone', name='plinth'); v.cyl(0, 0, .8, 2.6, .8, R['gold'], 3, 'metal', ry=.12, name='coin'); v.cyl(0, 0, 1.3, 2.1, .3, R['gold'], 4, ry=.14, name='emblem')
@vox('newsstand', 'newsstand')
def p_newsstand(v):
    v.box(-.9, -.5, 0, .9, .5, 2.0, R['paint_green'], name='kiosk'); v.box(-.8, -.52, .9, .8, -.48, 1.7, R['dark'], name='window'); v.box(-1.0, -.7, 2.0, 1.0, .6, 2.1, R['paint_red'], 2, 'stripes', name='awning')
    for i in range(4): v.box(-.7 + i * .35, -.56, 1.0, -.45 + i * .35, -.52, 1.5, R[['white', 'cream', 'sky', 'pink'][i]], 3, name='magazine')
@vox('food_truck', 'food_truck')
def p_food_truck(v):
    v.box(-1.6, -.9, .5, 1.6, .9, 2.4, R['cream'], 3, name='van'); v.box(-1.4, -.92, 1.2, 1.0, -.88, 2.0, R['dark'], name='hatch'); v.box(-1.5, -1.1, 2.1, 1.1, -.9, 2.2, R['coral'], 3, 'stripes', name='awning')
    for x in (-1.0, 1.0): v.cyl(x, -.6, .0, .6, .3, R['dark'], ry=.08, name='wheel'); v.cyl(x, .6, .0, .6, .3, R['dark'], ry=.08, name='wheel')
@vox('stall', 'stall')
def p_stall(v):
    v.box(-1.5, -.5, .0, 1.5, .5, .9, R['wood'], 2, 'wood', name='counter')
    for x in (-1.45, 1.4): v.box(x, .4, .9, x + .05, .45, 2.3, R['dwood'], name='post')
    v.box(-1.6, -.6, 2.3, 1.6, .6, 2.4, R['teal'], 3, 'stripes', name='awning')
@vox('scarecrow', 'scarecrow')
def p_scarecrow(v): v.box(-.04, -.04, 0, .04, .04, 1.6, R['dwood'], name='pole'); v.box(-.6, -.04, 1.3, .6, .04, 1.38, R['dwood'], name='arms'); v.box(-.25, -.15, .8, .25, .15, 1.4, R['paint_blue'], 2, 'cloth', name='coat'); v.sphere(0, 0, 1.6, .18, R['hay'], 3, 'hay', name='head'); v.cone(0, 0, 1.72, 1.95, .3, .12, R['hay'], 2, 'hay', name='hat')
@vox('tent', 'tent')
def p_tent(v): v.cone(0, 0, 0, 1.6, 1.4, .05, R['orange'], 2, 'stripes', name='canvas')
@vox('campfire', 'campfire')
def p_campfire(v):
    for a in range(8): t = a * math.pi / 4; v.sphere(math.cos(t) * .5, math.sin(t) * .5, .1, .12, R['rock'], 2, 'stone', name='stone')
    v.cyl(0, 0, .1, .22, .25, R['bark'], 2, 'wood', ry=.12, name='logs'); v.sphere(0, 0, .35, .18, R['fire'], 4, name='fire'); v.sphere(0, 0, .5, .1, R['yellow'], 4, name='flame')
@vox('garden_gnome', 'garden_gnome')
def p_gnome(v): v.cyl(0, 0, 0, .3, .12, R['paint_blue'], name='coat'); v.sphere(0, 0, .4, .12, R['peach'], 3, name='face'); v.cone(0, 0, .48, .78, .11, .02, R['paint_red'], 3, name='hat'); v.sphere(0, 0, .46, .09, R['white'], 4, name='beard')
@vox('beehive', 'beehive')
def p_beehive(v):
    for (x, y) in ((-.2, -.2), (.15, -.2), (-.2, .15), (.15, .15)): v.box(x, y, 0, x + .05, y + .05, .4, R['dwood'], name='leg')
    v.box(-.3, -.3, .4, .3, .3, 1.0, R['cream'], 3, 'wood', name='hive'); v.box(-.34, -.34, 1.0, .34, .34, 1.08, R['dwood'], name='roof'); v.box(-.08, -.31, .5, .08, -.3, .56, R['dark'], name='door')
@vox('flag_pole', 'flag_pole')
def p_flag_pole(v): v.cyl(0, 0, 0, .12, .25, R['stone'], 1, 'stone', name='foot'); v.cyl(0, 0, .12, 4.7, .04, R['white'], 3, name='mast'); v.sphere(0, 0, 4.75, .07, R['gold'], 4, name='finial')


# ----------------------------------------------------------------------------- voxelising (the same rules as game/js/prop-models.js), for the sheet
TEX = dict(plain=0, grain=.1, wood=.14, stone=.18, metal=.05, cloth=.08, hay=.22, leaves=.2, rust=.16, stripes=0, rings=0)
def voxelise(layers):
    V = {}
    def tone(c, k): return tuple(max(0, min(255, int(v * k))) for v in c)
    for L in layers:
        if L['k'] == 'img': continue
        c = tuple(int(L['col'][i:i + 2], 16) for i in (1, 3, 5)); g = TEX.get(L.get('tex', 'plain'), 0); rng = random.Random(json.dumps(L, sort_keys=True))
        x0, y0, z0 = L['x'], L['y'], L['z']
        if L['k'] == 'box': cells = [(x, y, z) for x in range(int(math.floor((x0 - L['w'] / 2) * VPM)), max(int(math.floor((x0 - L['w'] / 2) * VPM)) + 1, int(round((x0 + L['w'] / 2) * VPM)))) for y in range(int(math.floor((y0 - L['d'] / 2) * VPM)), max(int(math.floor((y0 - L['d'] / 2) * VPM)) + 1, int(round((y0 + L['d'] / 2) * VPM)))) for z in range(int(math.floor(z0 * VPM)), max(int(math.floor(z0 * VPM)) + 1, int(round((z0 + L['h']) * VPM))))]
        else:
            r = max(L['r'], .5 / VPM); ry = max(L.get('ry', r), .5 / VPM); h = L.get('h', 2 * r); cells = []; thin = r < .75 / VPM and ry < .75 / VPM   # a thin pole is a single column of voxels
            for z in range(int(math.floor(z0 * VPM)), max(int(math.floor(z0 * VPM)) + 1, int(round((z0 + h) * VPM)))):
                k = ((z + .5) / VPM - z0) / max(h, 1e-6)
                if L['k'] == 'sphere': f = math.sqrt(max(0, 1 - (2 * k - 1) ** 2))
                elif L['k'] == 'cone': f = (1 - k) + k * L['r1'] / r
                elif L['k'] == 'barrel': f = 1 - L.get('bulge', .15) + L.get('bulge', .15) * math.sin(k * math.pi) * 2 - L.get('bulge', .15)
                else: f = 1
                rr, rry = r * f, ry * f
                if rr <= 0: continue
                for x in range(int((x0 - rr) * VPM) - 1, int((x0 + rr) * VPM) + 2):
                    for y in range(int((y0 - rry) * VPM) - 1, int((y0 + rry) * VPM) + 2):
                        if (thin and x <= x0 * VPM < x + 1 and y <= y0 * VPM < y + 1) or (not thin and ((x + .5) / VPM - x0) ** 2 / (rr * rr) + ((y + .5) / VPM - y0) ** 2 / (rry * rry) <= 1): cells.append((x, y, z))
        for (x, y, z) in cells:
            if z < 0: continue
            cc = c
            if L.get('tex') == 'stripes': cc = tone(c, 1.0) if (int(x + z) // 2) % 2 else tone(c, .75)
            elif L.get('tex') == 'rings': cc = tone(c, .8) if int(math.hypot(x + .5 - x0 * VPM, y + .5 - y0 * VPM)) % 2 else c
            elif g and rng.random() < g: cc = tone(c, rng.choice((.82, 1.14)))
            V[(x, y, z)] = cc
    return V


def iso_preview(V, S=3):
    if not V: return Image.new('RGBA', (8, 8))
    xs = [k[0] for k in V]; ys = [k[1] for k in V]; zs = [k[2] for k in V]; x0, y0 = min(xs), min(ys); sx, sy, sz = max(xs) - x0 + 1, max(ys) - y0 + 1, max(zs) + 1
    W = (sx + sy) * S + 8; H = (sz + (sx + sy) // 2) * S + 8; img = Image.new('RGBA', (W, H), (0, 0, 0, 0)); px = img.load()
    for (x, y, z), col in sorted(V.items(), key=lambda q: (q[0][0] - q[0][1], q[0][2], q[0][0] + q[0][1])):
        X, Y = x - x0, y - y0; ux = (X - Y + sy) * S + 4; uy = H - 4 - z * S - ((X + Y) * S) // 2
        for a in range(S):
            for b in range(S):
                if 0 <= ux + a < W and 0 <= uy - b < H: px[ux + a, uy - b] = col + (255,)
    return img


def main():
    args = sys.argv[1:]; sp = None
    if '--sheet' in args: i = args.index('--sheet'); sp = args[i + 1]; del args[i:i + 2]
    force = '--force' in args; os.makedirs(OUT, exist_ok=True); made = []
    for key, P_ in PROPS.items():
        path = os.path.join(OUT, key + '.json')
        if os.path.exists(path) and not force: continue
        v = Vox(); P_['fn'](v); json.dump(dict(vpm=VPM, layers=v.L), open(path, 'w'), separators=(',', ':')); made.append(key)
    P = json.load(open(META)); src = gamedata.js_text(); i = src.index('window.GAMEDATA='); head = src[:i]; D = json.JSONDecoder().raw_decode(src[i + len('window.GAMEDATA='):])[0]
    cat = D['scenery']['props']; n = 0
    # these keep their pictures in the game (water effects, wood grain and characters read better painted); their recipes stay for the Studio to start from
    # the street lights keep their pictures too (the painted lamps are the town's look)
    SKIP = ('fountain', 'fountain_big', 'well', 'log', 'stump', 'firewood', 'campfire', 'scarecrow', 'garden_gnome', 'beehive',
            'streetlamp', 'streetlamp_b', 'lantern', 'lantern_b', 'lamp_modern',
            # v44: things whose painted faces carry the detail (signs, screens, goods, canvas) keep their pictures too
            'fridge_drinks', 'vending', 'billboard', 'newsstand', 'food_truck', 'phone_booth', 'bus_shelter', 'statue_coin', 'ski_sign',
            'market_cart', 'stall', 'tent', 'signpost', 'crate_goods', 'birdhouse', 'traffic_light')
    for key in PROPS:
        for T in (P, cat):
            if key not in T: continue
            if key in SKIP: T[key].pop('vox', None); T[key].pop('voxV', None)
            else: T[key]['vox'] = 'scene/vox/%s.json' % key; n += 1
    bsp.write_json(META, P); gamedata.save_js(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n')
    print('%d voxel recipes; written now: %s; %d catalogue entries point at a recipe' % (len(PROPS), ', '.join(made) or 'none (all there)', n // 2))
    if sp:
        keys = list(PROPS); imgs = [iso_preview(voxelise(json.load(open(os.path.join(OUT, k + '.json')))['layers'])) for k in keys]; cols = 10; cw = max(i.width for i in imgs) + 8; ch = max(i.height for i in imgs) + 18
        out = Image.new('RGBA', (cols * cw + 8, ((len(keys) + cols - 1) // cols) * ch + 8), (62, 54, 84, 255)); d = ImageDraw.Draw(out)
        for k, (key, im) in enumerate(zip(keys, imgs)):
            x = 8 + (k % cols) * cw; y = 8 + (k // cols) * ch; out.alpha_composite(im, (x + (cw - im.width) // 2, y + ch - 18 - im.height)); d.text((x, y + ch - 16), key, fill=(230, 226, 240))
        out.save(sp); print('sheet', sp)


if __name__ == '__main__':
    main()
