#!/usr/bin/env python3
"""Pictures of the speech bubbles, for picture notes (dialogue track DL-3; nothing is judged here). Opens the talk
fixture (?fixture=talk&skin=...&style=...) phone sized, waits for the line to finish typing and the bubble to settle,
and takes the bottom of the screen: every skin (talkSkins.json) plain, then the shapes (shout, whisper, think) on a few
of them, then (with --motion) the Calm and Reduced levels. DL-4: then the stack (?fixture=talk&stack=1&choice=1): a
picture after each line of an exchange, the choice in the stack and the Log open, with the stack's measures logged.
DL-5: then the faces (?fixture=talk&faces=1): each line's portrait when its emote pops and once it is said,
with the director's state, the emote's size in device pixels and the dimmed listeners logged.

    python3 tools/look-talk.py                  # every picture, in validation/look-talk/
    python3 tools/look-talk.py --only=bureau    # only the pictures whose names hold these words
    python3 tools/look-talk.py --dark           # the dark theme
    python3 tools/look-talk.py --only=stack     # only the stack
    python3 tools/look-talk.py --only=faces     # only the faces

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
            box = pg.evaluate("(()=>{const r=document.querySelector('.talk-box:not(.talk-old)').getBoundingClientRect();return [r.top,r.bottom]})()")
            top = max(0, int(box[0]) - 60)
            pg.screenshot(path=str(OUT / f'{name}.png'), clip={'x': 0, 'y': top, 'width': 390, 'height': min(844 - top, int(box[1]) - top + 40)})
            CF.log(f'{name}: skin {pg.evaluate("document.querySelector(\'.talk-box:not(.talk-old)\').dataset.skin")}')
            ctx.close()
        if not ONLY or any('stack' in w for w in ONLY): stack(b, base, errs)
        if not ONLY or any('faces' in w for w in ONLY): faces(b, base, errs)
        b.close()
    srv.shutdown()
    for e in errs: print('error:', e)
    print(f'look-talk: pictures in {OUT.relative_to(ROOT)}')


# DL-4: what the stack holds: bubbles, the one current name tag and line, the stack's top from the screen's bottom and its
# height over the bar (the budget: 0.4), as shares of the screen
STACK_STATE = """(()=>{const S=document.querySelector('.talk-stack'),r=S.getBoundingClientRect();return {bubbles:S.querySelectorAll('.talk-box').length,who:document.querySelectorAll('.talk-who').length,line:document.querySelectorAll('.talk-line').length,top:+((innerHeight-r.top)/innerHeight).toFixed(2),over:+((document.querySelector('.talk-box:not(.talk-old)').getBoundingClientRect().bottom-r.top)/innerHeight).toFixed(2),sides:[...S.querySelectorAll('.talk-box')].map(b=>b.dataset.side+(b.classList.contains('linked')?'+link':'')+(b.classList.contains('knocked')?'+knock':'')),pieces:uiElementCount()}})()"""


def stack(b, base, errs):
    """the stack fixture tapped through, a picture after each line settles, then the choice and the Log"""
    ctx, pg = CF.new_page(b, errs, width=390, height=844, mobile=True)
    pg.goto(f'{base}/?fixture=talk&stack=1&choice=1')
    if DARK: pg.evaluate("document.documentElement.dataset.theme='dark'")
    for i in range(1, 9):
        if not CF.until(pg, "typeof talkBox!=='undefined'&&(!!talkBox.choice||talkBox.cur&&!talkBox.cur.typing&&!talkBox.cur.wait)&&!document.body.classList.contains('ld-on')&&loadingScreen.el===null", 120):
            CF.log(f'stack {i}: the line never finished'); break
        if pg.evaluate("!!talkBox.choice"): break
        pg.wait_for_timeout(700)
        pg.screenshot(path=str(OUT / f'3-stack-{i}.png'))
        CF.log(f'stack {i}: {pg.evaluate(STACK_STATE)}')
        if i == 3:
            pg.evaluate("document.querySelector('.talk-logbtn').click()")
            pg.wait_for_timeout(200)
            pg.screenshot(path=str(OUT / '3-stack-log.png'))
            pg.evaluate("document.getElementById('talk').click()")
            if pg.evaluate("!!document.querySelector('.talk-log')"): CF.log('stack: the Log didn’t close on a tap')
        # a cut line goes on by itself; any other is tapped on
        pg.evaluate("window.__st=talkBox.cur;talkBox.last&&talkBox.last.cut||talkBox.cur&&talkBox.cur.tap();0")
        CF.until(pg, "talkBox.cur!==window.__st", 10)
    if CF.until(pg, "!!talkBox.choice", 10):
        pg.wait_for_timeout(500)
        pg.screenshot(path=str(OUT / '3-stack-choice.png'))
        CF.log(f'stack choice: {pg.evaluate(STACK_STATE)}')
    else: CF.log('stack: no choice came')
    ctx.close()


# DL-5: the face now (logic/talk-director.js), the emote on screen (its canvas in device pixels over its CSS size: a
# whole number per art pixel is crisp) and which older bubbles are dimmed as listeners
FACE_STATE = """(()=>{const D=talkBox.dir,S=D&&D.at(performance.now()),e=document.querySelector('.talk-box:not(.talk-old) .talk-emote'),r=e&&e.getBoundingClientRect();return {who:talkBox.por.who,combo:S&&S.combo,mouth:S&&S.mouth,emote:e?e.dataset.emote+' '+e.width+'px/'+Math.round(r.width)+'css':null,listening:[...document.querySelectorAll('.talk-old')].map(o=>o.dataset.who+(o.classList.contains('listening')?' dim':'')),frames:talkBox.frames.size,pieces:uiElementCount()}})()"""


def faces(b, base, errs):
    """the faces fixture tapped through: a picture while each line types and one when its emote shows"""
    ctx, pg = CF.new_page(b, errs, width=390, height=844, mobile=True)
    # the page records each line's face every frame (asking from here is slower than the letters), and holds an emote's
    # fade until its picture is taken
    pg.add_init_script("window.__rec=new Map();(function f(){const B=window.talkBox,D=B&&B.dir,C=B&&B.cur;if(D&&C){const r=window.__rec.get(C)||{m:new Set(),e:[]};window.__rec.set(C,r);if(C.typing)r.m.add(D.at(performance.now()).mouth);const e=document.querySelector('.talk-box:not(.talk-old) .talk-emote');if(e&&!r.e.includes(e.dataset.emote)){r.e.push(e.dataset.emote);for(const a of e.getAnimations())a.effect.getTiming().delay?a.pause():a.finish();e.dataset.held=''}}requestAnimationFrame(f)})()")
    pg.goto(f'{base}/?fixture=talk&faces=1')
    if DARK: pg.evaluate("document.documentElement.dataset.theme='dark'")
    for i in range(1, 6):
        if not CF.until(pg, "typeof talkBox!=='undefined'&&talkBox.cur&&!talkBox.cur.wait&&talkBox.cur.n>3&&!document.body.classList.contains('ld-on')&&loadingScreen.el===null", 120):
            CF.log(f'faces {i}: the line never started'); break
        if pg.evaluate("!!document.querySelector('.talk-box:not(.talk-old) .talk-emote')") or CF.until(pg, "!!document.querySelector('.talk-box:not(.talk-old) .talk-emote')", 3):
            pg.screenshot(path=str(OUT / f'4-faces-{i}-emote.png'), clip={'x': 0, 'y': 244, 'width': 390, 'height': 600})
            CF.log(f'faces {i}: the emote {pg.evaluate(FACE_STATE)["emote"]}')
            pg.evaluate("for(const e of document.querySelectorAll('.talk-emote[data-held]')){delete e.dataset.held;for(const a of e.getAnimations())a.play()}")
        CF.until(pg, "talkBox.cur&&!talkBox.cur.typing", 30)
        mouths, emotes = pg.evaluate("(()=>{const r=window.__rec.get(talkBox.cur)||{m:new Set(),e:[]};return [[...r.m].map(String),r.e]})()")
        pg.wait_for_timeout(250)
        pg.screenshot(path=str(OUT / f'4-faces-{i}.png'), clip={'x': 0, 'y': 244, 'width': 390, 'height': 600})
        CF.log(f'faces {i}: mouths while typing {sorted(str(m) for m in mouths)}, emotes {emotes}; {pg.evaluate(FACE_STATE)}')
        pg.evaluate("window.__st=talkBox.cur;talkBox.cur&&talkBox.cur.tap();0")
        CF.until(pg, "talkBox.cur!==window.__st", 10)
    ctx.close()


if __name__ == '__main__':
    main()
