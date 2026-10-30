#!/usr/bin/env python3
"""FL-5a's headless gates (docs/phases/fluid-track.md, FL-5a draw order and discard): the scene pass's order with
quality.drawOrder off, then on, counted (not timed: a headless browser draws in software, so speed is the owner's
phone's).

    python3 tools/check-draw-order.py

Copperleaf (?fixture=town), phone sized, the game's own graphics. Each arm in a fresh page; the "on" arm has the switch
on before the 3D view starts (its programs in the precompile list). Every draw into the scene target is recorded with
its program, whether that program's fragment text holds `discard`, its depth write and its depth test. Per arm, for
one frame (the last of 4):
- draws that write depth with a discard-free program ("solid") and with a discard program ("cut"); solid draws after
  the first cut draw; depth-writing draws after the sky; draws after your outline (depth GREATER);
- late compiles after load (gpuState.pcl: compiled on the spot, started after load) and their names;
- pictures: in the "on" page with the world's clock stopped, on, on, off, on: the share of pixels that differ
  on/on (what differs on its own) against on/off and off/on: validation/check-draw-order/.
Gates (exit status 1): no page errors; on: 0 solid draws after the first cut draw, 0 depth-writing draws after the sky,
0 draws after the outline (when it draws), more solid draws than off, 0 compiled on the spot after load (TD-3); the
on/off and off/on differences no larger than twice the on/on one plus 0.5% of the pixels."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from browser_check import GAME, LAUNCH, log, new_page, serve, until, frames, drawing  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'validation' / 'check-draw-order'

# the switch on before the game data is read (gameData is window.GAMEDATA)
SWITCH_ON = """(() => {
  let g;
  Object.defineProperty(window, 'GAMEDATA', { configurable: true, get() { return g; }, set(v) {
    g = v; const E = (v.engine = v.engine || {}), D = (E.defaults = E.defaults || {});
    D.quality = { ...(D.quality || {}), drawOrder: true };
  } });
})()"""
# every draw into the scene target, by frame
WATCH = """(() => {
  const W = (window.__dord = { by: {}, defs: {} }), P = WebGL2RenderingContext.prototype;
  const add = o => { if (o) for (const [k, v] of Object.entries(o)) if (Array.isArray(v) && typeof v[1] === 'string') W.defs[k] = /\\bdiscard\\b/.test(v[1]); };
  for (const n of ['WALK_SHADERS', 'POST_EFFECT_SHADERS', 'BUILDING_SHADERS', 'SOLID_PROP_SHADERS', 'WORLD_BOWL_SHADERS',
    'SPRITE_INSTANCE_SHADERS', 'WEATHER_FX_SHADERS', 'RIBBON_SHADERS', 'BATTLE_FX_SHADERS', 'BATTLE_SCAR_SHADERS',
    'PROP_MODEL_SHADERS', 'FOG_GRID_SHADERS', 'ROOM_SHADERS']) try { add(window[n]); } catch (e) {}
  for (const f of ['propModelShaders', 'propModelSolidShaders', 'groundSolidShaders']) try { add(window[f]()); } catch (e) {}
  for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
    const f = P[name];
    P[name] = function (...a) {
      try {
        const S = gpuState.fb && gpuState.fb.scene;
        if (S && this.getParameter(this.DRAW_FRAMEBUFFER_BINDING) === S.f && typeof walkRenderer !== 'undefined') {
          const p = this.getParameter(this.CURRENT_PROGRAM), nm = (p && p.pbName) || '?',
            L = (W.by[walkRenderer.frames] = W.by[walkRenderer.frames] || []);
          L.push([nm, nm in W.defs ? (W.defs[nm] ? 1 : 0) : -1, this.getParameter(this.DEPTH_WRITEMASK) ? 1 : 0,
            this.isEnabled(this.DEPTH_TEST) ? this.getParameter(this.DEPTH_FUNC) : 0, this.getParameter(this.COLOR_WRITEMASK)[0] ? 1 : 0]);
        }
      } catch (e) {}
      return f.apply(this, a);
    };
  }
  return 0;
})()"""


def frame_stats(L, GREATER):
    """L: [name, discard (1, 0, -1 unknown), depth write, depth func, colour write] in draw order"""
    dw = [i for i, d in enumerate(L) if d[2] and d[3]]
    solid = [i for i in dw if L[i][1] == 0]
    cut = [i for i in dw if L[i][1] == 1]
    first_cut = cut[0] if cut else len(L)
    sky = [i for i, d in enumerate(L) if d[0] == 'sky']
    sil = [i for i, d in enumerate(L) if d[3] == GREATER]
    return {
        'draws': len(L), 'solid': len(solid), 'cut': len(cut), 'unknown': len([i for i in dw if L[i][1] < 0]),
        'solidAfterCut': len([i for i in solid if i > first_cut]),
        'depthAfterSky': len([i for i in dw if sky and i > sky[-1]]),
        'afterOutline': (len(L) - 1 - sil[-1]) if sil else None,
        'solidProgs': sorted({L[i][0] for i in solid}), 'cutProgs': sorted({L[i][0] for i in cut}),
        'order': ' '.join(f"{d[0]}{'*' if d[1] == 1 else ''}" for d in L),
    }


def diff_share(a, b):
    from PIL import Image, ImageChops
    A, B = Image.open(a).convert('RGB'), Image.open(b).convert('RGB')
    d = ImageChops.difference(A, B).convert('L').point(lambda v: 255 if v > 12 else 0)
    return d.histogram()[255] / (A.width * A.height)


def arm(b, base, on):
    errs = []
    ctx, pg = new_page(b, errs, width=390, height=844, mobile=True, low=False, timeout=300000, init=(SWITCH_ON,) if on else ())
    pg.goto(base + '/index.html?fixture=town')
    drawing(pg)
    pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();uiState.tab='walk';render();0")
    frames(pg, 3, 120)
    late0 = pg.evaluate('gpuState.pcl.slice()')
    pg.evaluate(WATCH)
    frames(pg, 4, 240)
    by = pg.evaluate('window.__dord.by')
    GREATER = pg.evaluate('gpuState.gl.GREATER')
    full = [k for k in sorted(by, key=int)[:-1]] or sorted(by, key=int)
    st = frame_stats(by[full[-1]], GREATER)
    st['on'] = pg.evaluate("!!engineSetting('quality','drawOrder')")
    st['dOrder'] = pg.evaluate('walkRenderer.dOrder||0')
    st['solidModels'] = pg.evaluate('walkRenderer.solidModels||0')
    late = pg.evaluate('gpuState.pcl.slice()')
    st['late'] = [late[0] - late0[0], late[1] - late0[1]]
    st['lateAll'] = late
    st['lateNames'] = pg.evaluate('gpuState.pclNames.slice()')
    # pictures at one spot with the world's clock stopped (logic/frame-control.js worldSteps through its test
    # setter): in the "on" page, on twice, then off, then on again; each after 3 frames
    shots = {}
    if on:
        OUT.mkdir(parents=True, exist_ok=True)
        pg.evaluate("window.__ws=worldSteps;worldSteps=()=>({ms:0,n:1,h:0});0")
        for tag, val in (('on0', True), ('on1', True), ('off', False), ('on2', True)):
            pg.evaluate("(v=>{const E=(gameData.engine=gameData.engine||{}),D=(E.defaults=E.defaults||{});D.quality={...(D.quality||{}),drawOrder:v};return 0})(%s)" % str(val).lower())
            frames(pg, 3, 240)
            p = OUT / f'town-{tag}.png'
            pg.locator('#dio').screenshot(path=str(p))
            shots[tag] = p
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
            log(f"drawOrder {name} (read {st['on']}, frame {st['dOrder']}): {st['draws']} scene draws; depth-writing solid "
                f"{st['solid']} ({', '.join(st['solidProgs'])}), cut {st['cut']} ({', '.join(st['cutProgs'])}), unknown "
                f"{st['unknown']}; solid after the first cut {st['solidAfterCut']}; depth-writing after the sky "
                f"{st['depthAfterSky']}; draws after your outline {st['afterOutline']}; models drawn first {st['solidModels']}; "
                f"late compiles after load: {st['late'][0]} on the spot, {st['late'][1]} started (since load {st['lateAll']}: "
                f"{st['lateNames']})")
            print('     order: ' + st['order'][:900], flush=True)
            if errs: fails.append(f'{name}: page errors: {errs[:3]}')
    on, off = R[True], R[False]
    if not on['on']: fails.append('on: the switch did not read on')
    if on['solidAfterCut']: fails.append(f"on: {on['solidAfterCut']} solid draws after the first cut draw (0)")
    if on['depthAfterSky']: fails.append(f"on: {on['depthAfterSky']} depth-writing draws after the sky (0)")
    if on['afterOutline']: fails.append(f"on: {on['afterOutline']} draws after your outline (0)")
    if on['solid'] <= off['solid']: fails.append(f"on: solid draws {on['solid']}, not more than off's {off['solid']}")
    if on['lateAll'][0]: fails.append(f"on: {on['lateAll'][0]} programs compiled on the spot after load (0; {on['lateNames']})")
    P = S[True]
    d_on = diff_share(P['on0'], P['on1'])
    d_x = diff_share(P['on1'], P['off'])
    d_back = diff_share(P['off'], P['on2'])
    log(f'pictures, the world stopped: pixels that differ on/on {d_on:.2%}, on/off {d_x:.2%}, off/on {d_back:.2%} ({OUT})')
    if max(d_x, d_back) > 2 * d_on + 0.005: fails.append(f'the off/on pictures differ more than two "on" frames: {d_x:.2%}, {d_back:.2%}')
    for f in fails: log('FAIL ' + f)
    if not fails: log('ok: every gate')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
