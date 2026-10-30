#!/usr/bin/env python3
"""FL-3b's headless gates (docs/phases/fluid-track.md): the resolution in fewer, larger steps, the canvas resized only
out of sight (quality.resSteps), counted (not timed: a headless browser draws in software).

    python3 tools/check-resolution.py

Opens Copperleaf (?fixture=town) phone sized with the checks' page set-up (tools/browser_check.py). The automatic
quality is swapped for a scripted ladder (window.adaptQuality, the Studio's seam) that walks the resolution 1 → 0.6 → 1
in the old 0.1 steps, one a frame, while the player walks. Checks:
- with resSteps on: 0 canvas size changes and 0 render targets made again during the walk; the level waits;
- a screen opens: the waiting level is taken behind it (one frame, then the world frozen: 0 frames in 5 s, a cap of 0);
  back on the walk no more changes while the ladder holds;
- the view fading (its `in` class off) takes a waiting level too;
- with resSteps off the same walk changes the canvas's size (the gate can fail);
- a note: the real ladder on its own (headless frames are slow, so it steps down) with resSteps on, the targets made
  again by name (the shadow maps' size follows q, FL-5b's).
Exit status 1 when a gate fails."""
import sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import browser_check as CF  # noqa: E402

LADDER = """(()=>{window.__orig=window.__orig||adaptQuality;const seq=[0.9,0.8,0.7,0.6,0.7,0.8,0.9,1];let i=0;
window.__ladder=()=>{walkView.R=seq[i++%seq.length];const P=walkView.pl;if(P)P.x+=0.15;};adaptQuality=window.__ladder;return 0})()"""
SET = "(on=>{const E=(gameData.engine=gameData.engine||{}),D=(E.defaults=E.defaults||{});D.quality={...(D.quality||{}),resSteps:on};return 0})"
COUNTS = "[walkRenderer.resizes||0,gpuState.fbRe.n,walkRenderer.resD,walkRenderer.resWait||0,walkRenderer.resWhy||'',walkView.R]"


def main():
    from playwright.sync_api import sync_playwright
    srv, base = CF.serve(CF.GAME)
    errs, fails, notes = [], [], []

    def gate(ok, what):
        (notes if ok else fails).append(('ok   ' if ok else 'FAIL ') + what)

    with sync_playwright() as pw:
        b = pw.chromium.launch(args=CF.LAUNCH)
        ctx, pg = CF.open_game(b, None, errs)
        ctx.set_default_timeout(240000)
        pg.set_viewport_size({'width': 390, 'height': 844})
        pg.goto(base + '/index.html?fixture=town')
        CF.drawing(pg)
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();uiState.tab='walk';render();0")
        CF.frames(pg, 3)

        # resSteps on, the scripted ladder, a walk of 16 frames
        pg.evaluate(f'{SET}(true)')
        pg.evaluate('walkView.R=1;0')
        CF.frames(pg, 3)
        pg.evaluate(LADDER)
        CF.frames(pg, 1)
        a = pg.evaluate(COUNTS)
        CF.frames(pg, 16)
        z = pg.evaluate(COUNTS)
        by = pg.evaluate('JSON.stringify(gpuState.fbRe.by)')
        gate(z[0] == a[0], f'canvas size changes during a 16-frame walk with the ladder stepping: {z[0] - a[0]} (0)')
        gate(z[1] == a[1], f'render targets made again during the walk: {z[1] - a[1]} (0; by name since the page opened: {by})')
        gate(z[2] == 1, f'the level drawn during the walk: {z[2]} (1, held)')

        # stop the ladder at 0.6: a level waits
        pg.evaluate('adaptQuality=()=>{walkView.R=0.6};0')
        CF.frames(pg, 2)
        w = pg.evaluate(COUNTS)
        gate(w[3] == 0.6 and w[2] == 1, f'a level waits during the walk: drawn {w[2]}, waiting {w[3]} (1, 0.6)')

        # a screen opens: the level is taken behind it, then the world is frozen
        f0 = pg.evaluate('walkRenderer.frames')
        pg.evaluate("uiState.tab='team';render();0")
        cap = pg.evaluate('walkView.opt.cap()')
        gate(cap == 0, f'the 3D cap behind a screen: {cap} (0: frozen)')
        CF.until(pg, f'walkRenderer.frames>{f0}', 30)
        s = pg.evaluate(COUNTS)
        gate(s[2] == 0.6 and s[4] == 'held' and s[0] == w[0] + 1,
             f'behind the screen the level is taken: drawn {s[2]} ({s[4]}), {s[0] - w[0]} size change (0.6, held, 1)')
        f1 = pg.evaluate('walkRenderer.frames')
        time.sleep(5)
        n = pg.evaluate('walkRenderer.frames') - f1
        gate(n == 0, f'frames drawn in 5 s behind the screen after the last one: {n} (0: a true freeze)')
        pg.evaluate("uiState.tab='walk';render();0")
        CF.frames(pg, 6)
        r = pg.evaluate(COUNTS)
        gate(r[0] == s[0] and r[1] == s[1] and r[2] == 0.6,
             f'back on the walk: {r[0] - s[0]} size changes, {r[1] - s[1]} targets made again (0, 0), drawn {r[2]}')

        # a fade takes a waiting level
        pg.evaluate('adaptQuality=()=>{walkView.R=1};0')
        CF.frames(pg, 2)
        q = pg.evaluate(COUNTS)
        pg.evaluate("walkView.cv.classList.remove('in');0")
        CF.frames(pg, 2)
        fd = pg.evaluate(COUNTS)
        pg.evaluate("walkView.cv.classList.add('in');0")
        gate(q[2] == 0.6 and fd[2] == 1 and fd[4] == 'fade',
             f'the view fading takes the waiting level: {q[2]} → {fd[2]} ({fd[4]}) (0.6 → 1, fade)')

        # resSteps off: the same walk resizes (the gate can fail)
        pg.evaluate(f'{SET}(false)')
        pg.evaluate(LADDER)
        CF.frames(pg, 2)
        o0 = pg.evaluate(COUNTS)
        CF.frames(pg, 8)
        o1 = pg.evaluate(COUNTS)
        gate(o1[0] - o0[0] >= 4, f'with resSteps off the same walk changes the canvas size: {o1[0] - o0[0]} times in 8 frames (at least 4)')

        # a note: the real ladder on its own with resSteps on
        pg.evaluate(f'{SET}(true)')
        pg.evaluate('adaptQuality=window.__orig;walkView.R=1;walkRenderer.q=0;0')
        CF.frames(pg, 3)
        b0 = pg.evaluate('JSON.stringify(gpuState.fbRe.by)')
        n0 = pg.evaluate(COUNTS)
        CF.frames(pg, 20)
        n1 = pg.evaluate(COUNTS)
        b1 = pg.evaluate('JSON.stringify(gpuState.fbRe.by)')
        lad = pg.evaluate('[walkRenderer.q,walkView.R]')
        notes.append(f'note the real ladder, 20 frames: q {lad[0]} R {lad[1]}, drawn {n1[2]}, canvas changes {n1[0] - n0[0]}, '
                     f'targets made again {n1[1] - n0[1]} (by name before {b0}, after {b1})')
        gate(n1[0] == n0[0], f'the real ladder during the walk: canvas size changes {n1[0] - n0[0]} (0)')
        b.close()
    srv.shutdown()
    for e in errs: fails.append('FAIL page error: ' + str(e)[:300])
    for line in notes + fails: print(line)
    print(f'{len(notes)} ok/notes, {len(fails)} failed')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
