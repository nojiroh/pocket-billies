#!/usr/bin/env python3
"""Style diff (UI-5): proves a move changed nothing on screen. Each screen opens twice side by side, once as the
working tree has it and once as a git revision had it (default HEAD), at 390x844 in light and in dark, and every
element's computed style (its shadow trees and its ::before/::after too) is compared. Moving CSS between files changes
a rule's place in the cascade, so "it looks the same" is checked here property by property, not by eye.

    python3 tools/style-diff.py                    # every screen, working tree against HEAD
    python3 tools/style-diff.py --ref=HEAD~2       # against another revision
    python3 tools/style-diff.py --only=team,sheet  # only these screens
    python3 tools/style-diff.py --workers=3        # screens side by side in this many browsers (default 2)
    python3 tools/style-diff.py --size=1180x820    # another page size (default 390x844, a phone)

Exit 0 when nothing differs. A property that differs between two loads of the revision itself (a clock, a random
position) is left out, and said so. The revision's game/ is unpacked under validation/style-diff/ (git ignored) and
served with the data built from the working tree (data/gamedata.js is not in git); a revision that changed game data
can't be compared this way. No pictures are taken and nothing is saved anywhere."""
import json, queue, shutil, subprocess, sys, tarfile, io, threading, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARGS = sys.argv[1:]
REF = next((a.split('=', 1)[1] for a in ARGS if a.startswith('--ref=')), 'HEAD')
ONLY = next((a.split('=', 1)[1].split(',') for a in ARGS if a.startswith('--only=')), None)
SIZE = [int(x) for x in next((a.split('=', 1)[1] for a in ARGS if a.startswith('--size=')), '390x844').split('x')]
WORKERS = int(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--workers=')), 2))
OUT = ROOT / 'validation' / 'style-diff'

# the browser checks' page set-up (tools/browser_check.py: the clock, no accounts, the names on window, the graphics
# dials off)
sys.path.insert(0, str(ROOT / 'tools'))
import browser_check as cf  # noqa: E402

# the fast check's day, but the clock stands still: two pages loaded a minute apart show the same times
FROZEN_CLOCK = """(()=>{const D=Date,T=new D(2026,5,15,12,30,0).getTime();class FD extends D{constructor(...a){if(a.length)super(...a);else super(T)}static now(){return T}}
 FD.UTC=D.UTC;FD.parse=D.parse;window.Date=FD})()"""

# name, fixture, what to do once the game is up, what to wait for after it
OPEN = "uiState.modal=null;uiState.mq=[];renderOverlay();"
VIEWS = [
    ('walk', 'town', '', "!!document.querySelector('.screen.s-walk')"),
    ('map', 'town', "uiState.tab='map';render()", "!!document.querySelector('.screen.s-map')"),
    ('map-card', 'town', "uiState.tab='map';render();setTimeout(()=>{worldMapSelect(0)},800)", "!!document.querySelector('.screen.s-map .mapcard')"),
    ('team', 'team', "uiState.tab='team';render()", "!!document.querySelector('.screen.s-team')"),
    ('sheet', 'team', "document.querySelector('[data-a=mon]').click()", "!!document.querySelector('#ov .mon-sheet')"),
    ('sheet-build', 'team', "document.querySelector('[data-a=mon]').click();setTimeout(()=>document.querySelector('#ov [data-a=ms-tab][data-k=build]').click(),300)", "!!document.querySelector('#ov [data-a=ms-tab][data-k=build][aria-selected=true]')"),
    ('sheet-moves', 'team', "document.querySelector('[data-a=mon]').click();setTimeout(()=>document.querySelector('#ov [data-a=ms-tab][data-k=moves]').click(),300)", "!!document.querySelector('#ov [data-a=ms-tab][data-k=moves][aria-selected=true]')"),
    ('sheet-evo', 'team', "document.querySelector('[data-a=mon]').click();setTimeout(()=>document.querySelector('#ov [data-a=ms-tab][data-k=evo]').click(),300)", "!!document.querySelector('#ov [data-a=ms-tab][data-k=evo][aria-selected=true]')"),
    ('storage', 'team', "saveData.box=saveData.team.map((m,i)=>Object.assign({},m,{uid:m.uid+'b'+i}));uiState.tab='team';render()", "!!document.querySelector('.screen.s-team .bx')"),
    ('heal-pick', 'bag', OPEN + "saveData.team[0].hp=1;healPick(saveData.team[0])", "!!document.querySelector('#ov .pickrow')"),
    ('ledger', 'town', "uiState.tab='ledger';render()", "!!document.querySelector('.screen.s-ledger')"),
    ('dex', 'town', "uiState.tab='ledger';uiState.dex=saveData.team[0].sp;render()", "!!document.querySelector('.screen.s-ledger .dexpage')"),
    ('lore', 'town', "uiState.tab='ledger';uiState.guideTab='lore';render()", "!!document.querySelector('.screen.s-ledger .lore')"),
    ('postcards', 'town', "uiState.tab='ledger';uiState.guideTab='cards';render()", "!!document.querySelector('.screen.s-ledger')"),
    ('profile', 'town', "uiState.tab='profile';render()", "!!document.querySelector('.screen.s-profile')"),
    ('bag', 'bag', "uiState.tab='bag';render()", "!!document.querySelector('.screen.s-bag')"),
    ('settings', 'town', OPEN + "openSettings()", "!!document.querySelector('#ov .set-sheet')"),
    ('settings-sound', 'town', OPEN + "openSettings('sound')", "!!document.querySelector('#ov .set-sheet')"),
    ('settings-graphics', 'town', OPEN + "openSettings('graphics')", "!!document.querySelector('#ov .set-sheet')"),
    ('settings-save', 'town', OPEN + "openSettings('save')", "!!document.querySelector('#ov .set-sheet')"),
    ('settings-help', 'town', OPEN + "openSettings('help')", "!!document.querySelector('#ov .set-sheet')"),
    ('debug', 'town', OPEN + "openDebug()", "!!document.querySelector('#ov .dbg-sheet')"),
    # the dressing room takes the whole screen until it is left: the town's last view
    ('dressing', 'town', OPEN + "openDressingRoom()", "!!document.querySelector('#dressing')"),
    ('battle', 'battle', '', "!!activeBattle&&document.querySelectorAll('#acts button').length>0"),
    ('battle-moves', 'battle', "battleStage.speed=4;const go=()=>{if(activeBattle.phase==='choose'){}else{if(activeBattle.phase==='playing')tapMessage();else{const k=document.querySelector('[data-a=bback]');if(k)k.click()}setTimeout(go,200)}};go()", "!!activeBattle&&activeBattle.phase==='choose'"),
    ('battle-team', 'battle', "battleStage.speed=4;const go=()=>{if(activeBattle.phase==='choose'){const b=document.querySelector('[data-a=bteam]');if(b)b.click();else setTimeout(go,200)}else{if(activeBattle.phase==='playing')tapMessage();else{const k=document.querySelector('[data-a=bback]');if(k)k.click()}setTimeout(go,200)}};go()", "!!activeBattle&&activeBattle.phase==='team'"),
    ('battle-items', 'battle', "battleStage.speed=4;const go=()=>{if(activeBattle.phase==='choose'){const b=document.querySelector('[data-a=bitems]');if(b)b.click();else setTimeout(go,200)}else{if(activeBattle.phase==='playing')tapMessage();else{const k=document.querySelector('[data-a=bback]');if(k)k.click()}setTimeout(go,200)}};go()", "!!activeBattle&&activeBattle.phase==='items'"),
    ('talk', 'talk', '', "!!document.querySelector('.talk-layer')"),
    ('run-walk', 'run', '', "!!document.querySelector('.screen.s-walk')"),
    ('run-map', 'run', "uiState.tab='map';render()", "!!document.querySelector('.screen.s-map pb-day-chip')"),
    ('shop', 'run', OPEN + "openShop(Object.keys(SHOPS)[0])", "!!document.querySelector('#ov .shop-sheet')"),
    ('payout', 'run', OPEN + "runOver(false)", "!!document.querySelector('#ov pb-payout')&&!document.querySelector('#ov pb-payout').shadowRoot.querySelector('li.wait,.bump')"),
    ('title', 'title', '', "!!document.querySelector('.ttl,.title')"),
]
# UI-6: the parts UI-5 had no view of (the opening, postcards, the flight and the lift, the walk controls, fishing,
# the workshop, evolving, the full test's table; photo mode went with Things to do in TC-1). Each is put on the page the way its code builds it
# (the real builder where it has no timer, else a copy of its markup), still, so the cascade can be compared
LEGACY_WORLD = ("const H=(h)=>document.body.insertAdjacentHTML('beforeend',h);"
    "H('<div class=\"pcard-wrap in\" role=dialog><div class=pcard><div class=pc-pic><img alt=\"\"><div class=pc-greet><small>Greetings from</small><b>Copperleaf</b></div></div><div class=pc-stamp><img alt=\"\"><span>Copperleaf</span></div><p class=pc-note>A postcard for your Guide.</p></div></div>');"
    "H('<div class=\"pc-mini in\"><div class=\"pc-stamp sm\"><img alt=\"\"></div><span>Copperleaf</span></div>');"
    "H('<div class=\"lift-veil up in\"><div class=\"lift-cap glass\"><small>Glass lift</small><b>Up to Copperleaf</b><span class=note>Up</span></div></div>');"
    "H('<div id=flycap class=\"fly-cap glass\"><small>Airship</small><b>A → B</b><span class=note>Tap to skip</span></div>');"
    "H('<div class=fly-sheet><button class=\"pickrow fly-row\"><span class=fly-ico></span><span class=pr-t><b>Start a run</b><small>Bracket I</small></span><span class=fly-fare>Free</span></button><button class=\"pickrow fly-row off\"><span class=fly-ico></span><span class=pr-t><b>Town</b><small>x</small></span><span class=\"fly-fare tnum\">$5</span></button></div>');"
    "H('<div class=fish-ui><canvas class=fish-cv></canvas><div class=\"fish-msg glass\">Casting…</div><div class=fish-reel><div class=fr-bar><div class=fr-zone></div><div class=\"fr-fish in\"></div></div><div class=fr-prog><i></i></div></div><div class=fish-acts><button class=\"pb small gold fish-tap\">Strike!</button><button class=\"pb small glass\">Stop fishing</button></div></div>');"
    "H('<div class=\"evo run b\"><span class=ea><canvas class=rig></canvas></span><span class=eb><canvas class=rig></canvas></span></div><div class=\"hatch done\"><canvas class=rig></canvas></div>');"
    "H('<table class=nb-table><tr><td>x<small class=nb-det>d</small><small class=nb-why>w</small></td></tr></table>');"
    "joystickElement().classList.add('on','run');joystickDpad().classList.add('on','run');document.body.classList.add('flying')")
LEGACY_OPENING = ("document.body.classList.add('in-cs','cs-choosing');const c=document.createElement('div');c.id='cs';c.className='cs';c.innerHTML=cutsceneHTML();document.body.appendChild(c);"
    "const k=document.getElementById('csPick');k.hidden=false;k.innerHTML='<p class=sd>Pick one</p><div class=racts><button class=\"pb wide\">A</button><button class=pb>B</button></div>';"
    "document.getElementById('csCap').classList.add('on');document.getElementById('csFade').classList.add('on');"
    "document.body.insertAdjacentHTML('beforeend','<canvas class=cs-fall></canvas>');battleTip('chosen','A tip',{a:'x',l:'Skip'},true)")
LEGACY_WORKSHOP = (OPEN + "document.body.insertAdjacentHTML('beforeend','<div id=wsTest class=\"sheet px\"><div class=ws-top><div class=ws-big></div><div class=ws-info><p class=row><b class=\"lv tnum\">Lv 5</b></p><div class=ws-stats><span><small>HP</small><b>10</b></span></div></div></div>"
    "<div class=ws-slots><button class=\"ws-slot on\"><small>Head</small><b>Part</b><span class=ws-meta><span>Move</span></span><span class=ws-n>2</span><span class=ws-up>+</span><span class=\"ws-brk dmg\">!</span></button><button class=ws-slot><small>Arm</small><b>Part</b></button></div>"
    "<div class=ws-pick><p class=note>Spare parts:</p><div class=ws-cand><span class=ws-ct><b>P</b><span class=ws-meta></span></span><span class=ws-ds><span class=\"ws-d up\">+1</span><span class=\"ws-d dn\">-1</span></span><button class=\"pb small\">Fit</button></div><div class=ws-upg><span class=note>Upgrade</span><button class=\"pb small quiet\">Upgrade</button></div></div></div>')")
VIEWS += [
    ('legacy-world', 'town', LEGACY_WORLD, "!!document.querySelector('.pcard-wrap')&&!!document.querySelector('.joy.on')"),
    ('legacy-opening', 'town', LEGACY_OPENING, "!!document.querySelector('#cs .cs-cap.on')&&!!document.querySelector('#btip')"),
    ('legacy-workshop', 'team', LEGACY_WORKSHOP, "!!document.querySelector('#wsTest')"),
]
if ONLY: VIEWS = [v for v in VIEWS if v[0] in ONLY]

# every element in document order, into shadow trees; per element its own style and its ::before/::after when drawn.
# The values stay in the page (window.__sd); only a hash per element crosses over until a difference needs its values
DUMP = r"""() => {
  uiState.toastOn = false; uiState.toastQ = []; const toastEl = document.getElementById('toast'); if (toastEl) toastEl.remove();
  const props = [...getComputedStyle(document.documentElement)].filter(p => !p.startsWith('--')).sort();
  /* what a page lays out from its content, not from a rule: compared only where both pages hold the same text */
  const GEOMETRY = new Set(['width', 'height', 'inline-size', 'block-size', 'left', 'right', 'top', 'bottom', 'inset-inline-start',
    'inset-inline-end', 'inset-block-start', 'inset-block-end', 'perspective-origin', 'transform-origin', 'min-width', 'min-height']);
  /* classes a script puts on for a moment (the payout's count-up bump) */
  const TRANSIENT = new Set(['bump']);
  const els = [];
  const walk = (root, path) => {
    /* the page's own layers (canvases, bars) are appended in whatever order they got ready: sorted by name; a postcard
       or a toast that pops up on a timer is left out */
    let kids = [...root.children];
    if (root === document.body) kids = kids.filter(el => !el.classList.contains('pcard-wrap') && el.id !== 'toast')
      .map(el => [el.tagName + '#' + el.id, el]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(x => x[1]);
    for (const el of kids) {
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK' || el.tagName === 'META') continue;
      const key = path + '>' + el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].filter(c => !TRANSIENT.has(c)).sort().join('.') : '');
      els.push([key, el]);
      if (el.shadowRoot) walk(el.shadowRoot, key + '::shadow');
      walk(el, key);
    }
  };
  walk(document, '');
  /* every animation at its end (a loop at its start), shadow trees included, so two pages agree whenever they got there */
  for (const a of [...document.getAnimations(), ...els.flatMap(([, el]) => el.getAnimations({ subtree: true }))]) {
    try { const t = a.effect && a.effect.getComputedTiming(); if (t && t.endTime !== Infinity) a.finish(); else { a.pause(); a.currentTime = 0; } } catch (e) {}
  }
  const h = s => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36); };
  const rows = [];
  for (const [key, el] of els) {
    /* a property the page's script writes on the element itself (a camera, a drag) is the script's, not a rule's */
    const inline = new Set([...el.style]);
    /* an element a script bumps for a moment (TRANSIENT) runs its animation whenever the script says */
    const bumpable = el.matches && el.matches('pb-payout .v, .v');
    const one = (pseudo) => { const cs = getComputedStyle(el, pseudo); return props.map(p => inline.has(p) && !pseudo ? '(inline)' : bumpable && p.startsWith('animation') ? '(bump)' : cs.getPropertyValue(p).split(location.origin).join('')); };
    const own = one(null), parts = { '': own };
    for (const ps of ['::before', '::after']) { const v = getComputedStyle(el, ps).getPropertyValue('content'); if (v && v !== 'none' && v !== 'normal') parts[ps] = one(ps); }
    rows.push({ key, parts, text: h((el.shadowRoot ? el.shadowRoot.textContent : '') + el.textContent) });
  }
  window.__sd = { props, rows, geometry: props.map(p => GEOMETRY.has(p)) };
  return rows.map(r => [r.key, Object.fromEntries(Object.entries(r.parts).map(([k, v]) => [k, h(v.join('\u0001'))])), r.text]);
}"""
VALUES = "(i) => { const r = window.__sd.rows[i]; return { props: window.__sd.props, geometry: window.__sd.geometry, parts: r.parts }; }"
DARK = "saveData.preferences.theme='dark';applyPreferences();0"
LIGHT = "saveData.preferences.theme='light';applyPreferences();"
BATTLE_RESET = "if(activeBattle&&activeBattle.phase!=='playing'){activeBattle.phase='choose';paintActions()}"
# back to the plain screen between two views on one page
RESET = OPEN + "uiState.setTab=null;uiState.mapSel=null;uiState.tab='walk';uiState.dex=null;uiState.guideTab=null;render();"


def unpack_ref():
    """the revision's game/ folder, with the working tree's built data"""
    dest = OUT / 'ref'
    if dest.exists(): shutil.rmtree(dest)
    dest.mkdir(parents=True)
    tar = subprocess.run(['git', 'archive', REF, 'game'], cwd=ROOT, capture_output=True, check=True).stdout
    with tarfile.open(fileobj=io.BytesIO(tar)) as t: t.extractall(dest, filter='data')
    shutil.copy(ROOT / 'game' / 'data' / 'gamedata.js', dest / 'game' / 'data' / 'gamedata.js')
    return dest / 'game'


def open_fixture(b, base, fixture):
    errs = []
    ctx = b.new_context(viewport={'width': SIZE[0], 'height': SIZE[1]}, device_scale_factor=1)
    for s in (FROZEN_CLOCK, cf.NO_ACCOUNTS, cf.TEST_GLOBALS, cf.LOW_GRAPHICS): ctx.add_init_script(s)
    ctx.set_default_timeout(120000)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'{base}/index.html?fixture={fixture}', wait_until='domcontentloaded')
    if not cf.until(pg, "!document.getElementById('loader')&&typeof uiState!=='undefined'&&(saveData.started||FIXTURE==='title')", 180):
        raise Exception(f'{fixture}: the game never came up ' + ' | '.join(errs[:3]))
    pg.wait_for_timeout(800)   # fixtureStart's own render, the screen spring
    return ctx, pg, errs


def show(pg, view, first):
    name, fixture, setup, cond = view
    pg.evaluate(f'()=>{{{LIGHT}}}')
    # a battle redraws its own menu (render() would rebuild its shell without the buttons)
    if not first: pg.evaluate(f'()=>{{{BATTLE_RESET if fixture == "battle" else RESET}}}')
    if setup: pg.evaluate(f'()=>{{{setup}}}')
    if not cf.until(pg, cond, 60): raise Exception(f'{name}: the screen never showed ({cond})')
    pg.evaluate('document.fonts.ready')
    pg.wait_for_timeout(1500)  # let entrances end


def dump(pg, dark):
    if dark:
        pg.evaluate(DARK); pg.wait_for_timeout(800)
    return pg.evaluate(DUMP)


def compare(pages, view, first):
    """one view on both pages, light then dark; the revision dumped twice, for what moves on its own"""
    for p in pages.values(): show(p[1], view, first)
    report = []
    for dark in (False, True):
        d = {k: dump(p[1], dark) for k, p in pages.items()}
        mode = 'dark' if dark else 'light'
        again = pages['ref'][1].evaluate(DUMP)
        keys = {k: [r[0] for r in v] for k, v in d.items()}
        if keys['ref'] != keys['cur']:
            a, c = keys['ref'], keys['cur']
            i = next((i for i in range(min(len(a), len(c))) if a[i] != c[i]), min(len(a), len(c)))
            report.append(f'{mode}: the elements differ ({len(a)} before, {len(c)} now); first at #{i}: '
                          f'{a[i] if i < len(a) else "-"} | {c[i] if i < len(c) else "-"}')
            continue
        noisy = set()
        for i, (ra, rc) in enumerate(zip(d['ref'], d['cur'])):
            if ra[1] == rc[1]: continue
            va = pages['ref'][1].evaluate(VALUES, i); vc = pages['cur'][1].evaluate(VALUES, i)
            props = va['props']
            for part in sorted(set(va['parts']) | set(vc['parts'])):
                pa, pc = va['parts'].get(part), vc['parts'].get(part)
                if pa is None or pc is None:
                    report.append(f'{mode}: {ra[0][-140:]}{part} drawn {"now only" if pa is None else "before only"}'); continue
                for j, p in enumerate(props):
                    if pa[j] == pc[j]: continue
                    if va['geometry'][j] and ra[2] != rc[2]: continue   # laid out from different text
                    if i < len(again) and again[i][1].get(part) != ra[1].get(part): noisy.add(p); continue
                    report.append(f'{mode}: {ra[0][-140:]}{part} {p}: {pa[j][:80]!r} -> {pc[j][:80]!r}')
        if noisy: report.append(f'{mode}: (left out, they move on their own: {", ".join(sorted(noisy))})')
    errs = [e for p in pages.values() for e in p[2]]
    if errs: report.append('page errors: ' + ' | '.join(errs[:3])); [p[2].clear() for p in pages.values()]
    return report


def main():
    from playwright.sync_api import sync_playwright
    t0 = time.time()
    subprocess.run(['node', str(ROOT / 'tools' / 'build-data.mjs')], check=True, capture_output=True)
    ref = unpack_ref()
    srv_cur, base_cur = cf.serve(ROOT / 'game'); srv_ref, base_ref = cf.serve(ref)
    bases = {'cur': base_cur, 'ref': base_ref}
    groups = {}
    for v in VIEWS: groups.setdefault(v[1], []).append(v)
    q = queue.Queue(); [q.put(g) for g in groups.values()]
    results, lock = {}, threading.Lock()

    def worker():
        with sync_playwright() as pw:
            b = pw.chromium.launch(args=cf.LAUNCH)
            while True:
                try: views = q.get_nowait()
                except queue.Empty: break
                pages = {}
                try:
                    pages = {k: open_fixture(b, bases[k], views[0][1]) for k in ('ref', 'cur')}
                    for i, v in enumerate(views):
                        try: rep = compare(pages, v, i == 0)
                        except Exception as e: rep = ['could not compare: ' + str(e).splitlines()[0][:300]]
                        say(v[0], rep)
                except Exception as e:
                    for v in views: say(v[0], ['could not compare: ' + str(e).splitlines()[0][:300]])
                finally:
                    for p in pages.values(): p[0].close()
            b.close()

    def say(name, rep):
        real = [r for r in rep if '(left out' not in r]
        with lock:
            results[name] = rep
            print(f'[{time.time() - t0:6.1f}s] {"same   " if not real else "DIFFERS"} {name}' + ''.join(f'\n          {r}' for r in rep[:12]) + (f'\n          ... {len(rep) - 12} more' if len(rep) > 12 else ''), flush=True)

    threads = [threading.Thread(target=worker) for _ in range(max(1, min(WORKERS, len(groups))))]
    for t in threads: t.start()
    for t in threads: t.join()
    srv_cur.shutdown(); srv_ref.shutdown()
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'report.json').write_text(json.dumps(results, indent=2, ensure_ascii=False))
    bad = [k for k, r in results.items() if any('(left out' not in x for x in r)]
    print(f'\n{len(results) - len(bad)} of {len(results)} screens the same as {REF} ({round(time.time() - t0)} s)' + (f'; differ: {", ".join(bad)}' if bad else ''))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
