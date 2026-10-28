#!/usr/bin/env python3
"""Pictures of the speech bubbles, for picture notes (dialogue track DL-3; nothing is judged here). Opens the talk
fixture (?fixture=talk&skin=...&style=...) phone sized, waits for the line to finish typing and the bubble to settle,
and takes the bottom of the screen: every skin (talkSkins.json) plain, then the shapes (shout, whisper, think) on a few
of them, then (with --motion) the Calm and Reduced levels.

    python3 tools/look-talk.py                  # every picture, in validation/look-talk/
    python3 tools/look-talk.py --only=bureau    # only the pictures whose names hold these words
    python3 tools/look-talk.py --dark           # the dark theme

Run `npm run data` first. Uses the browser checks' page set-up (tools/browser_check.py: the clock, no accounts, the
test globals). Nothing is sent anywhere."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import browser_check as CF  # noqa: E402
ARGS = sys.argv[1:]
ONLY = next((a.split('=', 1)[1].split(',') for a in ARGS if a.startswith('--only=')), None)
DARK = '--dark' in ARGS
OUT = ROOT / 'validation' / ('look-talk-dark' if DARK else 'look-talk')
SKINS = ['folk', 'chosen', 'kappi', 'blake', 'bureau', 'narration', 'you']
SHOTS = [(f'1-{s}', s, '') for s in SKINS] + [
    (f'2-{s}-{st}', s, st) for s in ('folk', 'chosen', 'bureau', 'kappi') for st in ('shout', 'whisper', 'think')
]


def main():
    from playwright.sync_api import sync_playwright
    OUT.mkdir(parents=True, exist_ok=True)
    srv, base = CF.serve(CF.GAME)
    errs = []
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=CF.LAUNCH)
        for name, skin, style in SHOTS:
            if ONLY and not any(w in name for w in ONLY): continue
            ctx, pg = CF.new_page(b, errs, width=390, height=844, mobile=True)
            pg.goto(f'{base}/?fixture=talk&skin={skin}&style={style}')
            if not CF.until(pg, "typeof talkBox!=='undefined'&&talkBox.cur&&!talkBox.cur.typing&&!document.body.classList.contains('ld-on')&&loadingScreen.el===null", 120):
                CF.log(f'{name}: the line never finished'); ctx.close(); continue
            if DARK: pg.evaluate("document.documentElement.dataset.theme='dark'")
            pg.wait_for_timeout(900)
            box = pg.evaluate("(()=>{const r=document.querySelector('.talk-box').getBoundingClientRect();return [r.top,r.bottom]})()")
            top = max(0, int(box[0]) - 60)
            pg.screenshot(path=str(OUT / f'{name}.png'), clip={'x': 0, 'y': top, 'width': 390, 'height': min(844 - top, int(box[1]) - top + 40)})
            CF.log(f'{name}: skin {pg.evaluate("document.querySelector(\'.talk-box\').dataset.skin")}')
            ctx.close()
        b.close()
    srv.shutdown()
    for e in errs: print('error:', e)
    print(f'look-talk: pictures in {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
