#!/usr/bin/env python3
"""The flash audit (VFX-20, the VFX track's Part 2, rule 9; WCAG 2.3.1): over filmed battle frames, how many
full-screen flashes a second the battle shows, how close together, and whether any is a big saturated-red one; with
Flashes off, that there are none; and how fast a Billie's sprite blinks.

Browser-free: it reads the films tools/look-battle-anims.py writes in trace mode (trace.json, trace-events.json),
whose `fs` rows say what the whole screen showed frame by frame on the film's clock, read off the page (each #flash
shown with its peak, colour and fade; the impact frame's mode; the chromatic pulse; whether each sprite was drawn).

    python3 tools/look-battle-anims.py --outcomes=hit,se,x4,nve,crit,secrit,miss,blocked,hit+ko,crit+last --out=validation/flash-audit/on
    python3 tools/look-battle-anims.py --events --out=validation/flash-audit/on
    python3 tools/look-battle-anims.py --flashes=off --outcomes=... --out=validation/flash-audit/off   (and --events)
    python3 tools/flash-audit.py --on=validation/flash-audit/on --off=validation/flash-audit/off

What counts (rule 9, battleAnims.json `flashes`):
- A full-screen flash: a #flash brighter than Flashes off's tint (logic/smear.js FLASH_SOFT_MAX, 15%), the impact
  frame's two-tone cells, or the chromatic pulse. Ones that touch (within a frame) are one flash: a crit's two-tone
  and the warm flash that waits for it to end, a super's tint and its chromatic pulse. `strict` counts each source
  on its own as well, for the record.
- At most `perSecond` (3) in any second and at least `gapMs` (333) apart; none whose colour is saturated red (its red
  share R / (R + G + B) at `redShare` or more).
- Flashes off: no full-screen flash at all (tints of 15% or less are allowed: that is SY-1's held flash).
- Blinks: a sprite hidden and shown again; with Flashes off at most 3 a second (rule 9).
The report goes to validation/flash-audit/report.txt and the console; the exit code is 1 on any breach."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OPT = {a.split('=', 1)[0][2:]: (a.split('=', 1)[1] if '=' in a else True) for a in sys.argv[1:] if a.startswith('--')}
OUT = ROOT / 'validation' / 'flash-audit'
FRAME = 16
RULE = json.loads((ROOT / 'game' / 'data' / 'battleAnims.json').read_text())['flashes']
SOFT = float(re.search(r'FLASH_SOFT_MAX = ([0-9.]+)', (ROOT / 'game' / 'js' / 'logic' / 'smear.js').read_text()).group(1))
BLINKS_OFF = 3


def rgb(col):
    m = re.match(r'rgba?\((\d+),\s*(\d+),\s*(\d+)', col or '')
    if m: return [int(v) for v in m.groups()]
    m = re.match(r'#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$', col or '', re.I)
    return [int(v, 16) for v in m.groups()] if m else [255, 255, 255]


def red_share(col):
    r, g, b = rgb(col)
    return r / (r + g + b) if r + g + b else 0


def intervals(fs):
    """the film's full-screen intervals: (start, end, source, colour)"""
    out, two, ca = [], None, None
    last = 0
    for row in fs:
        if row[0] == 'f':
            _, t, a, col, ms = row
            if a > SOFT + 1e-6: out.append((t, t + max(ms, FRAME), 'flash', col, a))
            continue
        _, t, mode, c, _vis = row
        last = t
        if mode in (1, 2) and two is None: two = t
        if mode not in (1, 2) and two is not None: out.append((two, t, 'twotone', '', 1)); two = None
        if c and ca is None: ca = t
        if not c and ca is not None: out.append((ca, t, 'chromatic', '', 1)); ca = None
    if two is not None: out.append((two, last + FRAME, 'twotone', '', 1))
    if ca is not None: out.append((ca, last + FRAME, 'chromatic', '', 1))
    return sorted(out)


def events(iv):
    """intervals that touch or overlap (within a frame) merged: one flash each, its start, end and sources"""
    ev = []
    for s, e, src, col, a in iv:
        if ev and s <= ev[-1]['end'] + FRAME + 1:
            E = ev[-1]
            E['end'] = max(E['end'], e)
            E['src'].append(src)
            if col: E['cols'].append(col)
        else:
            ev.append({'t': s, 'end': e, 'src': [src], 'cols': [col] if col else [], 'a': a})
    return ev


def most_in_a_second(ts):
    ts = sorted(ts)
    best, j = 0, 0
    for i in range(len(ts)):
        while ts[i] - ts[j] >= 1000: j += 1
        best = max(best, i - j + 1)
    return best


def blinks(fs):
    """per Billie, the times its sprite was hidden again after being drawn (a blink)"""
    out, prev = {}, None
    for row in fs:
        if row[0] != 's': continue
        vis = row[4]
        if prev is not None:
            for i, (a, b) in enumerate(zip(prev, vis)):
                if a == '1' and b == '0': out.setdefault(i, []).append(row[1])
        prev = vis
    return out


def audit(films, off):
    rows, breaches = [], []
    for key, x in sorted(films.items()):
        fs = x.get('fs')
        if fs is None: continue
        iv = intervals(fs)
        ev = events(iv)
        ts = [E['t'] for E in ev]
        n = most_in_a_second(ts)
        strict = most_in_a_second([s for s, *_ in iv])
        gap = min((b - a for a, b in zip(ts, ts[1:])), default=None)
        red = [E for E in ev if any(red_share(c) >= RULE['redShare'] for c in E['cols'])]
        bl = blinks(fs)
        bmax = max((most_in_a_second(v) for v in bl.values()), default=0)
        rows.append((key, len(ev), n, strict, gap, len(red), bmax))
        why = []
        if off and ev: why.append(f'{len(ev)} full-screen with Flashes off ({", ".join("+".join(E["src"]) for E in ev)})')
        if not off and n > RULE['perSecond']: why.append(f'{n} in a second')
        if not off and gap is not None and gap < RULE['gapMs']: why.append(f'two {gap} ms apart')
        if red: why.append(f'{len(red)} saturated red ({", ".join(red[0]["cols"])})')
        if off and bmax > BLINKS_OFF: why.append(f'a sprite blinks {bmax} times in a second')
        if why: breaches.append((key, why))
    return rows, breaches


def load(dirs):
    films = {}
    for d in [p for p in str(dirs or '').split(',') if p]:
        for name in ('trace.json', 'trace-events.json'):
            f = Path(d) / name
            if f.exists(): films.update({f'{name[:-5]}:{k}': v for k, v in json.loads(f.read_text()).items()})
    return films


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    lines, bad = [], 0
    rule = f"rule: at most {RULE['perSecond']} a second, {RULE['gapMs']} ms apart, no red share {RULE['redShare']}+; a flash is brighter than {SOFT}; Flashes off: none, blinks at most {BLINKS_OFF} a second"
    lines.append(rule)
    for mode in ('on', 'off'):
        films = load(OPT.get(mode))
        if not films: continue
        rows, breaches = audit(films, mode == 'off')
        withfs = len(rows)
        flashed = [r for r in rows if r[1]]
        lines.append(f'\nFlashes {mode}: {withfs} films ({len(films) - withfs} without fs rows, skipped); {len(flashed)} with a full-screen flash')
        if rows:
            lines.append(f'  most in any second: {max(r[2] for r in rows)} (strict, each source alone: {max(r[3] for r in rows)}); '
                         f'closest two: {min((r[4] for r in rows if r[4] is not None), default="-")} ms; saturated red: {sum(r[5] for r in rows)}; '
                         f'most blinks a second: {max(r[6] for r in rows)}')
            by = {}
            for r in flashed:
                g = r[0].split(':', 1)[1].split('.')[-1] if r[0].startswith('trace:') else r[0].split(':', 1)[1]
                by.setdefault(g, []).append(r)
            if mode == 'on':
                lines.append('  by outcome or film: ' + '; '.join(f'{g} {len(v)} (most {max(x[2] for x in v)}/s)' for g, v in sorted(by.items())))
        lines.append(f'  breaches: {len(breaches)}')
        for k, why in breaches[:40]: lines.append(f'    {k}: {"; ".join(why)}')
        if len(breaches) > 40: lines.append(f'    ... {len(breaches) - 40} more')
        bad += len(breaches)
    text = '\n'.join(lines)
    (OUT / 'report.txt').write_text(text + '\n')
    print(text)
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
