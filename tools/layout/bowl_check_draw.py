import json, math, sys, itertools
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Circle

REPO, LAY, OUTDIR = sys.argv[1:4]
L = json.load(open(f'{REPO}/game/data/locations.json'))
ROADS = json.load(open(f'{REPO}/game/data/roads.json'))
D = json.load(open(LAY))
LBY = {l['id']: l for l in L}
DIR = {'east': (1, 0), 'west': (-1, 0), 'north': (0, 1), 'south': (0, -1)}
ex = lambda e: np.array(DIR[e.rstrip('0123456789')], float)

def region(l):
    if l.get('region'):
        return l['region']
    return 'starter'
REG_NAME = {'starter': 'Starter lands', 'meadowlands': 'Meadowlands', 'goldenhills': 'Golden Hills',
            'sporeforest': 'Spore Forest', 'crystalcaverns': 'Crystal Caverns', 'coraltrench': 'Coral Trench',
            'cloudspire': 'Cloudspire', 'innersun': 'Inner Sun'}
REG_COL = {'starter': '#7fae5a', 'meadowlands': '#c9d65a', 'goldenhills': '#e0a83c', 'sporeforest': '#a77bc4',
           'crystalcaverns': '#5fb7c9', 'coraltrench': '#3f7fbf', 'cloudspire': '#b9c3d6', 'innersun': '#f2d14a'}
BADGE = {'fizzwell': 1, 'lanternhall': 2, 'palmhaven': 3, 'frostcrown': 4, 'twinpetal': 5, 'goldvine': 6,
         'capshade': 7, 'glimmershaft': 8}

def seg_cross(p1, p2, p3, p4):
    def o(a, b, c):
        return np.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]))
    return o(p1, p2, p3) != o(p1, p2, p4) and o(p3, p4, p1) != o(p3, p4, p2)

report = {}
for name, pos in D['layouts'].items():
    P = {k: np.array(v) for k, v in pos.items()}
    FR = D.get('frame', {}).get(name, -1)
    rows = []
    for r in ROADS:
        if r['kind'] != 'seam':
            continue
        a, b = r['a'], r['b']
        d = ex(a['exit']) - ex(b['exit']); d /= np.linalg.norm(d)
        e = P[b['map']] - P[a['map']]
        m = 0.5 * (P[a['map']] + P[b['map']]); rm = np.linalg.norm(m)
        nor = FR * m / max(rm, 1e-6)
        eas = np.array([nor[1], -nor[0]]); d = d[0] * eas + d[1] * nor
        ang = math.degrees(math.acos(max(-1, min(1, e @ d / (np.linalg.norm(e) + 1e-9)))))
        rows.append((ang, f"{a['map']}:{a['exit']} -> {b['map']}:{b['exit']}"))
    rows.sort(reverse=True)
    segs = [(r['a']['map'], r['b']['map']) for r in ROADS if r['kind'] == 'seam']
    cross = []
    for (a, b), (c, d) in itertools.combinations(segs, 2):
        if len({a, b, c, d}) < 4:
            continue
        if seg_cross(P[a], P[b], P[c], P[d]):
            cross.append(f'{a}-{b} x {c}-{d}')
    ids = [k for k in P if k not in D['sub']]
    mind = min(np.linalg.norm(P[x] - P[y]) for x, y in itertools.combinations(ids, 2))
    def compass(v, at):
        nor = FR * at / max(np.linalg.norm(at), 1e-6); eas = np.array([nor[1], -nor[0]])
        x, y = v @ eas, v @ nor
        return ['east', 'north', 'west', 'south'][int(((math.degrees(math.atan2(y, x)) + 45) % 360) // 90)]
    props = [{'a': a, 'b': b, 'length': round(float(np.linalg.norm(P[b] - P[a])), 3),
              'exit_a': compass(P[b] - P[a], P[a]), 'exit_b': compass(P[a] - P[b], P[b])} for a, b in D.get('proposed_by_layout', {}).get(name, [])]
    report[name] = {'proposed': props,'within30': sum(a <= 30 for a, _ in rows), 'within45': sum(a <= 45 for a, _ in rows),
                    'seams': len(rows), 'worst': [f'{a:.0f}deg {s}' for a, s in rows[:6]], 'crossings': cross,
                    'min_gap': round(float(mind), 3)}

    # ---- sketch
    fig, ax = plt.subplots(figsize=(13, 11), dpi=110)
    fig.patch.set_facecolor('#1d2130')
    ax.set_facecolor('#1d2130')
    for rr, a in [(1.0, 0.18), (0.75, 0.12), (0.5, 0.08), (0.25, 0.06)]:
        ax.add_patch(Circle((0, 0), rr, color='#e8d9b0', alpha=a, lw=0))
    ax.add_patch(Circle((0, 0), 1.0, fill=False, ec='#e8d9b0', lw=2))
    ax.text(0, 1.035, 'rim · ' + ("a map's north faces the centre, its east runs counter-clockwise" if FR < 0 else "a map's north points up the wall, its east runs clockwise"), color='#e8d9b0', ha='center', fontsize=8.5)
    for r in ROADS:
        A, B = P[r['a']['map']], P[r['b']['map']]
        if r['kind'] == 'seam':
            ax.plot([A[0], B[0]], [A[1], B[1]], color='#d7c7a0', lw=2.2, zorder=1, alpha=0.85)
    PROPS = D.get('proposed_by_layout', {}).get(name, [])
    if PROPS:
        for a, b in PROPS:
            A, B = P[a], P[b]
            ax.plot([A[0], B[0]], [A[1], B[1]], color='#ff9ec4', lw=1.8, ls=(0, (4, 3)), zorder=1)
    SPECIAL = D.get('special_by_layout', {}).get(name, [])
    for a, b, kind in SPECIAL:
        A, B = P[a], P[b]
        mid = 0.5 * (A + B); v = B - A; nrm = np.array([-v[1], v[0]])
        ctrl = mid + 0.28 * nrm * (1 if kind == 'canal' else -1)
        t = np.linspace(0, 1, 60)[:, None]
        pts = (1 - t) ** 2 * A + 2 * (1 - t) * t * ctrl + t ** 2 * B
        ax.plot(pts[:, 0], pts[:, 1], color='#7fe0ff', lw=1.8, ls=(0, (1, 2.5)), zorder=1)
        q = pts[30]
        ax.text(q[0], q[1], kind, color='#7fe0ff', fontsize=7, ha='center', va='center',
                bbox=dict(boxstyle='round,pad=0.15', fc='#1d2130', ec='none', alpha=0.8), zorder=4)
    # region hulls as soft blobs
    for reg in REG_COL:
        pts = np.array([P[l['id']] for l in L if region(l) == reg and l['id'] not in D['sub']])
        for p in pts:
            ax.add_patch(Circle(p, 0.075, color=REG_COL[reg], alpha=0.22, lw=0, zorder=0))
    for l in L:
        if l['id'] in D['sub']:
            p = P[D['sub'][l['id']]] + np.array([0.0, -0.06])
            ax.plot(*zip(P[D['sub'][l['id']]], p), ls=':', color='#9fd3ff', lw=1.5, zorder=2)
            ax.scatter(*p, s=40, marker='v', color='#9fd3ff', zorder=3)
            ax.text(p[0], p[1] - 0.035, l['name'], color='#9fd3ff', fontsize=6.5, ha='center', va='top')
            continue
        p = P[l['id']]
        town = bool(l.get('town'))
        col = REG_COL[region(l)]
        ax.scatter(*p, s=110 if town else 45, marker='s' if town else 'o', color=col, ec='#1d2130', lw=1.2, zorder=3)
        lab = l['name'] + (f'  [{BADGE[l["id"]]}]' if l['id'] in BADGE else '')
        if l['id'] == 'copperleaf':
            lab += '  (start)'
        ax.text(p[0], p[1] + 0.03, lab, color='#f4efe2', fontsize=7.2 if town else 6.3, ha='center', va='bottom',
                weight='bold' if town else 'normal', zorder=4)
    ax.scatter(0, 0, s=900, color='#f2d14a', alpha=0.10, zorder=0)
    title = {'A': 'Layout A', 'B': "Layout 1 · Spiral: today's map rolled into the bowl, regions in order, rising up the wall",
             'N': 'Layout 2 · Natural basin: north up the wall: sea and ponds on the floor, peaks and sky high, regions rising clockwise'}[name]
    ax.set_title(title, color='#f4efe2', fontsize=11, pad=12)
    hs = [plt.Line2D([], [], marker='o', ls='', color=REG_COL[k], label=REG_NAME[k]) for k in REG_COL]
    if SPECIAL:
        hs.append(plt.Line2D([], [], color='#7fe0ff', ls=':', label='proposed special link (no map edges)'))
    if PROPS:
        hs.append(plt.Line2D([], [], color='#ff9ec4', ls='--', label='proposed link (not in the game yet)'))
    hs += [plt.Line2D([], [], marker='s', ls='', color='#cccccc', label='town (square), [n] = badge'),
           plt.Line2D([], [], marker='v', ls='', color='#9fd3ff', label='by lift, under its parent')]
    leg = ax.legend(handles=hs, loc='upper left', bbox_to_anchor=(1.0, 1.0), fontsize=7.5, facecolor='#262b3d',
                    edgecolor='#444a60', labelcolor='#f4efe2')
    rep = report[name]
    ax.text(1.12, -1.0, f"Seams within 30°: {rep['within30']}/{rep['seams']}\nCrossings: {len(rep['crossings'])}",
            color='#f4efe2', fontsize=8, ha='left', va='bottom')
    ax.set_xlim(-1.1, 1.1); ax.set_ylim(-1.1, 1.12); ax.set_aspect('equal'); ax.axis('off')
    fig.savefig(f"{OUTDIR}/bowl-layout-{ {'B': '1-spiral', 'N': '2-natural'}.get(name, name) }.png", facecolor=fig.get_facecolor(), bbox_inches='tight')
    plt.close(fig)
print(json.dumps(report, indent=1))
