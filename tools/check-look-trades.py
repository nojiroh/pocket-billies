#!/usr/bin/env python3
"""FL-5b's headless gates (docs/phases/fluid-track.md, FL-5b phone GPU look trades): the four switches off, then on,
counted (not timed: a headless browser draws in software, so speed and look are the owner's phone's).

    python3 tools/check-look-trades.py

Copperleaf (?fixture=town), phone sized, with an Android phone's user agent (the game's PHONE), the game's own
graphics. Each arm in a fresh page, the "on" arm with quality.phoneShadow, groundTiles, postMerge and farTrees on
before the game data is read (the ground is built in tiles only then). Per arm, over one frame (the last of 4):
- the far shadow map's size (walkRenderer.farRes and the target's own) and whether a battle's target exists;
- the ground's draws and tiles (walkRenderer.gtl: the scene's draws, tiles drawn of asked; the shadow maps' the same);
- the glow's first target (b0) size and whether the merged bright pass ran;
- the pictures drawn into the scene (an instanced draw counts its instances: far trees draw fewer); late compiles after load (gpuState.pcl).
Pictures (validation/check-look-trades/): in the "on" page with the world's clock stopped, the ground in tiles on, on,
off, on (the same look: the off/on differences no larger than twice the on/on one plus 0.5% of the pixels); then the
far trees and the merged glow off and on (look trades: the share of pixels that differ is reported, not gated).
Gates (exit status 1): no page errors; on: the switches read on, a far map of at most 2048, the ground in tiles drawn
(fewer tiles drawn than asked in the scene and in the shadow maps), the merged glow at quarter size, fewer pictures
drawn than off, 0 compiled on the spot after load (TD-3); off: the far map as before (the setting's), no tiles."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from browser_check import GAME, LAUNCH, log, new_page, serve, frames, drawing  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'validation' / 'check-look-trades'
UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'
KEYS = ('phoneShadow', 'groundTiles', 'postMerge', 'farTrees')

SWITCH_ON = """(() => {
  let g;
  Object.defineProperty(window, 'GAMEDATA', { configurable: true, get() { return g; }, set(v) {
    g = v; const E = (v.engine = v.engine || {}), D = (E.defaults = E.defaults || {});
    D.quality = { ...(D.quality || {}), phoneShadow: true, groundTiles: true, postMerge: true, farTrees: true };
  } });
})()"""
# the pictures drawn into the scene target, by frame (an instanced draw counts its instances)
WATCH = """(() => {
  const W = (window.__lt = { by: {} }), P = WebGL2RenderingContext.prototype;
  for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
    const f = P[name];
    P[name] = function (...a) {
      try {
        const S = gpuState.fb && gpuState.fb.scene;
        if (S && this.getParameter(this.DRAW_FRAMEBUFFER_BINDING) === S.f && typeof walkRenderer !== 'undefined') {
          const p = this.getParameter(this.CURRENT_PROGRAM), nm = (p && p.pbName) || '?',
            B = (W.by[walkRenderer.frames] = W.by[walkRenderer.frames] || { draws: 0, pics: 0, ground: 0 });
          B.draws++;
          if (/^sprite/.test(nm)) B.pics += /Instanced$/.test(name) ? a[name === 'drawArraysInstanced' ? 3 : 4] : 1;
          if (/^ground/.test(nm)) B.ground++;
        }
      } catch (e) {}
      return f.apply(this, a);
    };
  }
  return 0;
})()"""
STATE = """(() => {
  const q = k => !!engineSetting('quality', k), fb = gpuState.fb || {};
  return {
    on: %s.map(q),
    farRes: walkRenderer.farRes || 0,
    shadowW: fb.shadow ? fb.shadow.w : 0,
    battleMap: !!fb.shadowB,
    gtl: walkRenderer.gtl ? walkRenderer.gtl.slice() : null,
    tiled: !!(walkRenderer.mesh && walkRenderer.mesh.tiles),
    b0: fb.b0 ? [fb.b0.w, fb.b0.h] : null,
    scene: fb.scene ? [fb.scene.w, fb.scene.h] : null,
    merged: gpuState.postMerged || 0,
  };
})()""" % repr(list(KEYS)).replace("'", '"')


def diff_share(a, b):
    from PIL import Image, ImageChops
    A, B = Image.open(a).convert('RGB'), Image.open(b).convert('RGB')
    d = ImageChops.difference(A, B).convert('L').point(lambda v: 255 if v > 12 else 0)
    return d.histogram()[255] / (A.width * A.height)


def set_switch(pg, k, v):
    pg.evaluate("(([k,v])=>{const E=(gameData.engine=gameData.engine||{}),D=(E.defaults=E.defaults||{});D.quality={...(D.quality||{}),[k]:v};return 0})(%s)"
                % ('["%s",%s]' % (k, str(v).lower())))


def arm(b, base, on):
    errs = []
    ctx, pg = new_page(b, errs, width=390, height=844, mobile=True, low=False, timeout=300000,
                       init=(SWITCH_ON,) if on else (), user_agent=UA)
    pg.goto(base + '/index.html?fixture=town')
    drawing(pg)
    pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();uiState.tab='walk';render();0")
    frames(pg, 3, 120)
    late0 = pg.evaluate('gpuState.pcl.slice()')
    pg.evaluate(WATCH)
    frames(pg, 4, 240)
    by = pg.evaluate('window.__lt.by')
    ks = sorted(by, key=int)
    st = pg.evaluate(STATE)
    st['frame'] = by[ks[-2] if len(ks) > 1 else ks[-1]]
    st['phone'] = pg.evaluate('PHONE')
    late = pg.evaluate('gpuState.pcl.slice()')
    st['late'] = [late[0] - late0[0], late[1] - late0[1]]
    st['lateAll'] = late
    st['lateNames'] = pg.evaluate('gpuState.pclNames.slice()')
    shots = {}
    if on:
        OUT.mkdir(parents=True, exist_ok=True)
        pg.evaluate("window.__ws=worldSteps;worldSteps=()=>({ms:0,n:1,h:0});0")

        def shot(tag):
            frames(pg, 3, 240)
            p = OUT / f'town-{tag}.png'
            pg.locator('#dio').screenshot(path=str(p))
            shots[tag] = p
        for tag, val in (('tiles-on0', True), ('tiles-on1', True), ('tiles-off', False), ('tiles-on2', True)):
            set_switch(pg, 'groundTiles', val)
            shot(tag)
        for k in ('farTrees', 'postMerge'):
            set_switch(pg, k, False)
            shot(f'{k}-off')
            set_switch(pg, k, True)
            shot(f'{k}-on')
    ctx.close()
    return st, shots, errs


def main():
    from playwright.sync_api import sync_playwright
    srv, base = serve(GAME)
    fails, R, S = [], {}, {}
    with sync_playwright() as p:
        b = p.chromium.launch(args=LAUNCH)
        for on in (False, True):
            st, shots, errs = arm(b, base, on)
            R[on], S[on] = st, shots
            name = 'on' if on else 'off'
            g = st['gtl']
            log(f"{name} (read {dict(zip(KEYS, st['on']))}, phone {st['phone']}): far shadow map {st['farRes']} (target "
                f"{st['shadowW']}, a battle's map {st['battleMap']}); ground tiled {st['tiled']}, "
                + (f"scene {g[0]} draws {g[1]} of {g[2]} tiles, shadow maps {g[3]} draws {g[4]} of {g[5]} tiles; " if g else 'no tile counts; ')
                + f"glow's first target {st['b0']} of {st['scene']} (merged {st['merged']}); scene draws "
                f"{st['frame']['draws']} (ground {st['frame']['ground']}), pictures drawn {st['frame']['pics']}; late compiles after load: {st['late'][0]} on "
                f"the spot, {st['late'][1]} started (since load {st['lateAll']}: {st['lateNames']})")
            if errs: fails.append(f'{name}: page errors: {errs[:3]}')
    on, off = R[True], R[False]
    if not on['phone']: fails.append('the page is not a phone (PHONE false): the user agent did not take')
    if not all(on['on']): fails.append(f"on: a switch did not read on: {dict(zip(KEYS, on['on']))}")
    if any(off['on']): fails.append(f"off: a switch read on: {dict(zip(KEYS, off['on']))}")
    if not on['farRes'] or on['farRes'] > 2048 or on['shadowW'] > 2048:
        fails.append(f"on: far shadow map {on['farRes']} (target {on['shadowW']}), not at most 2048")
    if off['tiled'] or off['gtl']: fails.append('off: the ground was built or drawn in tiles')
    g = on['gtl']
    if not on['tiled'] or not g: fails.append('on: the ground was not built or drawn in tiles')
    elif not (g[1] < g[2]) or not (g[4] < g[5]):
        fails.append(f'on: tiles drawn not fewer than asked (scene {g[1]} of {g[2]}, shadow maps {g[4]} of {g[5]})')
    if not on['merged'] or not on['b0'] or not on['scene'] or on['b0'][0] > (on['scene'][0] >> 2) + 1:
        fails.append(f"on: the glow not merged at quarter size ({on['merged']}, {on['b0']} of {on['scene']})")
    if not on['frame']['pics'] < off['frame']['pics']:
        fails.append(f"on: pictures drawn {on['frame']['pics']}, not fewer than off's {off['frame']['pics']} (far trees)")
    if on['lateAll'][0]: fails.append(f"on: {on['lateAll'][0]} programs compiled on the spot after load (0; {on['lateNames']})")
    P = S[True]
    d_on = diff_share(P['tiles-on0'], P['tiles-on1'])
    d_x = diff_share(P['tiles-on1'], P['tiles-off'])
    d_back = diff_share(P['tiles-off'], P['tiles-on2'])
    log(f'pictures, the world stopped: the ground in tiles: pixels that differ on/on {d_on:.2%}, on/off {d_x:.2%}, '
        f'off/on {d_back:.2%}; far trees off/on {diff_share(P["farTrees-off"], P["farTrees-on"]):.2%}; merged glow '
        f'off/on {diff_share(P["postMerge-off"], P["postMerge-on"]):.2%} ({OUT})')
    if max(d_x, d_back) > 2 * d_on + 0.005:
        fails.append(f'the ground in tiles: off/on pictures differ more than two "on" frames: {d_x:.2%}, {d_back:.2%}')
    for f in fails: log('FAIL ' + f)
    if not fails: log('ok: every gate')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
