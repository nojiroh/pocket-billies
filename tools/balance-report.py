#!/usr/bin/env python3
"""v40: a balance pass over the roster, from the data alone: for every species, its stat total (by rarity and stage),
the best damaging move it knows by level 36 (power x accuracy, with the same-type bonus), and a rating that weighs
offence, bulk and speed the way a 1-v-1 does. Lines far from their stage's median are listed first, so a line that
needs its profile or its learn set looked at shows up. Writes validation/v40-balance.md.

    python3 tools/balance-report.py"""
import statistics, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
from gamedata import load  # noqa: E402  phase 04b: the data files
def main():
    GD = load(); M = GD['moves']; TOT = {k: v['totals'] for k, v in GD['rarities'].items()}
    rows = []
    for L in GD['lines']:
        n = len(L['names']); prof = L['prof']; sm = sum(prof) or 1
        for st0, name in enumerate(L['names']):
            st = min(st0, 2) if L.get('split') else st0; single = n == 1 and L['rar'] != 'mythical'; tot = TOT.get(L['rar'], TOT['common']); tot = tot[min(2 if single else st, len(tot) - 1)]
            base = [round(tot * w / sm) for w in prof]; types = L['types'][min(st0, len(L['types']) - 1)]
            ev = L.get('evo') or []; cap = ev[st0]['at'] if st0 < len(ev) and ev[st0].get('at') else 36   # what it knows before it evolves on
            best = 0; bestm = ''
            for lv, mid in L['learn']:
                m = M.get(mid)
                if not m or lv > cap or not m.get('p'): continue
                stab = 1.5 if m['t'] in types else 1; atk = base[1] if m.get('c') == 'H' else base[3]
                v = m['p'] * (m.get('a', 100) / 100) * stab * atk / 100
                if v > best: best, bestm = v, m['n']
            bulk = base[0] * (base[2] + base[4]) / 2 / 100; spd = base[5]
            rating = (best * bulk) ** .5 * (1 + spd / 400)
            rows.append({'line': L['id'], 'name': name, 'stage': st0, 'single': single, 'rar': L['rar'], 'total': tot, 'off': round(best, 1), 'bulk': round(bulk, 1), 'spd': spd, 'move': bestm, 'rating': round(rating, 1)})
    out = ['# Balance report (v40)', '', 'Rating = sqrt(best hit before it evolves (or by level 36) x bulk) x (1 + Speed/400); a hit is power x accuracy x same-type bonus x the matching attack stat / 100. Lines are compared within their stage; a species more than 25% from its stage\'s median is listed as an outlier.', '']
    for st in (0, 1, 2, 3):
        R = [r for r in rows if (2 if r['single'] else r['stage']) == st and r['rar'] != 'mythical']
        if not R: continue
        med = statistics.median(r['rating'] for r in R)
        out.append(f'## Stage {st + 1}: {len(R)} species, median rating {med:.0f}'); out.append('')
        out.append('| Species | Line | Rarity | Total | Best hit | Bulk | Speed | Rating | vs median |'); out.append('| --- | --- | --- | --- | --- | --- | --- | --- | --- |')
        for r in sorted(R, key=lambda r: -r['rating']):
            d = r['rating'] / med - 1; flag = ' **outlier**' if abs(d) > .25 else ''
            out.append(f"| {r['name']} | {r['line']} | {r['rar']} | {r['total']} | {r['off']} ({r['move']}) | {r['bulk']} | {r['spd']} | {r['rating']} | {d:+.0%}{flag} |")
        out.append('')
    myth = [r for r in rows if r['rar'] == 'mythical']
    if myth:
        out.append('## Legendaries'); out.append(''); out.append('| Species | Total | Best hit | Bulk | Speed | Rating |'); out.append('| --- | --- | --- | --- | --- | --- |')
        for r in myth: out.append(f"| {r['name']} | {r['total']} | {r['off']} ({r['move']}) | {r['bulk']} | {r['spd']} | {r['rating']} |")
        out.append('')
    outl = []
    for st in (0, 1, 2, 3):
        R = [r for r in rows if (2 if r['single'] else r['stage']) == st and r['rar'] != 'mythical']
        if not R: continue
        med = statistics.median(r['rating'] for r in R)
        outl += [(r, r['rating'] / med - 1) for r in R if abs(r['rating'] / med - 1) > .25]
    p = ROOT / 'validation' / 'v40-balance.md'; p.write_text('\n'.join(out)); print(p, f'{len(rows)} species, {len(outl)} outliers:', ', '.join(f"{r['name']} {d:+.0%}" for r, d in sorted(outl, key=lambda x: -abs(x[1]))[:12]))
    return outl
if __name__ == '__main__':
    main()
