#!/usr/bin/env python3
"""alpha 0.2: room between places. Every side of a place where it joins the next place grows by a strip of countryside
(M metres, 12) that carries the one into the other, so walking from one to the next is a stretch of land that changes
as you go rather than a line where two maps meet.

    python3 tools/expand-places.py          # grow every joined side that hasn't grown yet, then measure the walks again
                                            # and set the steps (tools/join-places.py --costs)
    python3 tools/expand-places.py --dry    # say what would change, change nothing

What a strip holds, from the place's old edge out to the new one (where the next place's strip begins):
- Ground. The place's own edge ground runs on for a few metres (not its paths or paving), then its countryside (the
  ground it has all round, `edge`, with tall grass and darker patches). Toward the next place that place's countryside
  comes in, in patches, half and half at the meeting line, all of it a little way into the next strip. The patches
  are laid out in one frame for both places, so they carry on across the line.
- Paths. Each exit's path goes on from the old edge to the new one, bending a little on the way; the two places' paths
  meet where the exits face each other.
- Height. The land eases from the place's edge to a level the two places share at the meeting line (half way between
  their edges), with a gentle roll in between that is flat at both ends.
- Rims and shelves. Where an exit is up on a shelf or a rim (a cave mouth, a canyon top), the path climbs to it inside
  the strips: the land round the path rises in a broad slope, the two strips meeting half way up. Elsewhere the strip
  lies at the foot of the place's rim, so a cave or a plateau ends in its own cliff.
- Growth. Trees, shrubs, rocks, ground cover and flowers of the kinds that grow on that ground, thicker away from the
  paths (marked as wild growth, w: 43, like the rest).
An underground place (`under`: 1, the Grotto) grows rock instead: its strips are solid rock with a tunnel along each
exit's path, vaulted with rock arches (a long arch set into rock is a tunnel), level with the rock on either side, the
floor climbing or falling to meet the next place half way. From outside the game shows the place as a mountain
(world.js covers what lies beyond the strips) with these tunnel mouths in its face; from inside, the cave stays shut in.
The next place's strip meets it on scree and gravel at the mountain's foot.
    python3 tools/expand-places.py --under grotto     # mark a place as underground first (before it has grown)
Everything already in the place moves with it (things, the hub, exits, streams, bridges, rails, life's areas, folk's
spots, worn tracks), so a place grown on its west or south side has its old corner at (M, M). A place records what it
grew (`grown2`: {side: metres}), so running this again does nothing; a side that joins a new place later (alpha 0.4:
Marigold Town's north side, for Route 1) grows then, and only that side. Places joined by a road (exits that don't face)
are left as they are."""
import base64, json, math, struct, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'data' / 'gamedata.js'
M = 12
OPP = {'E': 'W', 'W': 'E', 'N': 'S', 'S': 'N'}
DIR = {'E': (1, 0), 'W': (-1, 0), 'N': (0, 1), 'S': (0, -1)}
ARGS = sys.argv[1:]
REACH = 22                      # how far along the edge from an exit the two places blend (as world.js WR_SR)
TAPER = 4
ROCK_UP = 4.1                   # an underground place's rock: level with a tunnel's vault (arch h 3.0 + pier 1.1)...
ROCK_RISE = 3.5                 # ...climbing about this much higher away from the tunnels
TUNNEL = 1.5                    # half the width of a tunnel's floor
ARCH = {'w': 2.6, 'h': 3.0, 'pier': 1.1, 'kind': 'rock'}


def load():
    src = DATA.read_text(encoding='utf-8'); head, body = src.split('window.GAMEDATA=', 1)
    return head, json.loads(body.rstrip().rstrip(';'))


def save(head, D):
    DATA.write_text(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')


# ------------------------------------------------------------------ noise (deterministic, the same every run)
def hsh(x, z, s):
    h = ((int(math.floor(x)) * 374761393 + int(math.floor(z)) * 668265263 + int(s) * 1013904223) ^ 0x5bd1e995) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    return ((h ^ (h >> 16)) & 0xffffffff) / 4294967296


def noise(x, z, s):
    xi, zi = math.floor(x), math.floor(z); fx, fz = x - xi, z - zi
    u = lambda t: t * t * (3 - 2 * t)
    a, b, c, d = hsh(xi, zi, s), hsh(xi + 1, zi, s), hsh(xi, zi + 1, s), hsh(xi + 1, zi + 1, s)
    return a + (b - a) * u(fx) + (c - a) * u(fz) + (a - b - c + d) * u(fx) * u(fz)


def sm(t):
    t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)


def salt(sid):
    h = 0
    for ch in sid: h = (h * 131 + ord(ch)) % 100003
    return h % 9973


# ------------------------------------------------------------------ the place's step grid (half-metre cells)
def steps_of(sc):
    if not sc.get('steps'): return None
    w, h = sc['w'] * 2, sc['h'] * 2
    raw = base64.b64decode(sc['steps']); H = list(struct.unpack('<%dh' % (len(raw) // 2), raw))
    m = base64.b64decode(sc['stepm']) if sc.get('stepm') else b''
    if len(H) != w * h: return None
    return {'w': w, 'h': h, 'H': [v / 20 for v in H], 'M': list(m) if len(m) == w * h else [0] * (w * h)}


def store_steps(sc, E):
    if not any(abs(v) > 1e-6 for v in E['H']) and not any(E['M']):
        sc.pop('steps', None); sc.pop('stepm', None); return
    sc['steps'] = base64.b64encode(struct.pack('<%dh' % len(E['H']), *[max(-32768, min(32767, round(v * 20))) for v in E['H']])).decode()
    sc['stepm'] = base64.b64encode(bytes(E['M'])).decode()


def raise_at(sc, E, x, z):
    if not E: return 0.0
    i = min(E['w'] - 1, max(0, int(math.floor(x * 2)))); j = min(E['h'] - 1, max(0, int(math.floor(z * 2))))
    return E['H'][j * E['w'] + i]


def exit_point(sc, e):
    w, h, n = sc['w'], sc['h'], e.get('in', 1.1)
    return {'N': (e['t'] * w, h - n), 'S': (e['t'] * w, n), 'E': (w - n, e['t'] * h), 'W': (n, e['t'] * h)}[e['side']]


def along(e, p): return p[1] if e['side'] in 'EW' else p[0]


def tile_at(sc, x, z):
    i = min(sc['w'] - 1, max(0, int(math.floor(x)))); j = min(sc['h'] - 1, max(0, int(math.floor(z))))
    return sc['tiles'][sc['h'] - 1 - j][i]


def corner_h(sc, x, z):
    H = sc.get('heights')
    if not H: return 0.0
    r = H[sc['h'] - int(round(min(sc['h'], max(0, z))))]
    return float(r[int(round(min(sc['w'], max(0, x))))] or 0)


# ------------------------------------------------------------------ the joins, in the places' old metres
def joins_of(D):
    """every link whose two exits face each other: the two places, their exits, and where B lies in A's frame"""
    R, out = D['route'], []
    for i, l in enumerate(D['links']):
        J = l[3] or {}; A, B = R[l[0]].get('scene'), R[l[1]].get('scene')
        if not A or not B or A == B: continue
        SA, SB = D['scenes'][A], D['scenes'][B]
        ka = next((k for k, e in enumerate(SA.get('edgeExits') or []) if e['id'] == J.get('a')), None)
        kb = next((k for k, e in enumerate(SB.get('edgeExits') or []) if e['id'] == J.get('b')), None)
        if ka is None or kb is None: continue
        ea, eb = SA['edgeExits'][ka], SB['edgeExits'][kb]
        if OPP[ea['side']] != eb['side']: continue
        pa, pb = exit_point(SA, ea), exit_point(SB, eb); s = ea['side']
        off = {'E': (SA['w'], round(pa[1] - pb[1])), 'W': (-SB['w'], round(pa[1] - pb[1])), 'N': (round(pa[0] - pb[0]), SA['h']), 'S': (round(pa[0] - pb[0]), -SB['h'])}[s]
        out.append({'i': i, 'A': A, 'B': B, 'ka': ka, 'kb': kb, 'sa': s, 'sb': eb['side'], 'off': off, 'pa': pa, 'pb': pb})
    return out


def frame_of(j, me):
    """for place `me` of join j: its side, its exit's position along that side, the other place, and the shift from
    this place's along to the other's (other along = mine - shift)"""
    if me == 'A':
        s = j['sa']; e = along({'side': s}, j['pa']); other, ko = j['B'], j['kb']; sh = j['off'][1] if s in 'EW' else j['off'][0]
    else:
        s = j['sb']; e = along({'side': s}, j['pb']); other, ko = j['A'], j['ka']; sh = -(j['off'][1] if s in 'EW' else j['off'][0])
    return s, e, other, ko, sh


# ------------------------------------------------------------------ one place
class Grow:
    def __init__(self, D, sid, joins, old):
        self.D, self.sid, self.old = D, sid, old       # old: every place as it was (the neighbours are read from it)
        self.sc = sc = D['scenes'][sid]; self.T = D['scenery']['terrains']; self.C = D['scenery']['props']
        self.w, self.h = sc['w'], sc['h']; self.E = steps_of(old[sid])
        self.links = []                                # (join, my side, exit along, neighbour id, its exit k, along shift, me)
        for j in joins:
            for me in ('A', 'B'):
                if j[me] == sid:
                    s, e, other, ko, sh = frame_of(j, me); self.links.append({'j': j, 's': s, 'e': e, 'o': other, 'ko': ko, 'sh': sh, 'me': me})
        # alpha 0.4: a place grown already grows again only on a side that has newly joined a place (Marigold Town's
        # north side, when Route 1 came); the sides that have their strips keep them as they are
        done = sc.get('grown2') or {}
        self.links = [l for l in self.links if l['s'] not in done]
        self.sides = sorted({l['s'] for l in self.links})
        self.m = {s: (M if s in self.sides else 0) for s in 'NESW'}
        self.ox, self.oz = self.m['W'], self.m['S']
        self.W2, self.H2 = self.w + self.m['W'] + self.m['E'], self.h + self.m['S'] + self.m['N']
        self.salt = salt(sid); self.under = bool(sc.get('under'))

    # -- where a point of the new map lies: inside the old one, or in a strip (side, along, depth) or a corner
    def locate(self, x, z):
        xo, zo = x - self.ox, z - self.oz
        ex = -xo if xo < 0 else (xo - self.w if xo > self.w else 0)
        ez = -zo if zo < 0 else (zo - self.h if zo > self.h else 0)
        if ex <= 0 and ez <= 0: return None
        if ez <= 0: return ('W' if xo < 0 else 'E', zo, ex)
        if ex <= 0: return ('S' if zo < 0 else 'N', xo, ez)
        return ('C', (xo, zo), (ex, ez))

    def link_for(self, s, u):
        """the join on side s nearest along u, if u is within its reach (and how fully: 1 near the exit, 0 past the reach)"""
        best = None
        for L in self.links:
            if L['s'] != s: continue
            d = abs(u - L['e'])
            if best is None or d < best[1]: best = (L, d)
        if not best: return None, 0
        L, d = best; g = 1 - sm((d - REACH) / TAPER)
        o = self.old[L['o']]; span = o['h'] if L['s'] in 'EW' else o['w']; un = u - L['sh']
        if un < -2 or un > span + 2: g = 0
        # where two exits share a side the nearer one wins up to half way, eased over a few metres
        for L2 in self.links:
            if L2 is L or L2['s'] != s: continue
            mid = (L['e'] + L2['e']) / 2
            g *= sm((abs(u - L2['e']) - abs(u - L['e'])) / 4 + .5)
        return (L, g) if g > 0 else (None, 0)

    def a_frame(self, L, s, u, d):
        """a strip point (side s, along u, depth d out of the old edge) in the join's frame (A's old metres; B's old
        corner lies at off plus both strips), and its signed distance from the meeting line (negative on A's side)"""
        j = L['j']; x, z = {'E': (self.w + d, u), 'W': (-d, u), 'N': (u, self.h + d), 'S': (u, -d)}[s]
        if L['me'] == 'A': return x, z, d - M
        dx, dz = DIR[j['sa']]
        return x + j['off'][0] + 2 * M * dx, z + j['off'][1] + 2 * M * dz, M - d

    def base_tile(self, sid, x, z):
        """a place's countryside at a point of its own (old) frame (an underground place's is its mountain's foot)"""
        e = self.old[sid].get('edge') or 'g'; st = salt(sid)
        if self.old[sid].get('under'):
            n = noise(x * .17, z * .17, st + 41); return 'r' if n > .66 else 'P' if n > .4 else 'v'
        if e in 'wd': return e
        n = noise(x * .09, z * .09, st + 5)
        if e in 'gG':
            if n > .74: return 't'
            if n < .26: return 'G' if e == 'g' else 'g'
            if hsh(x * 3, z * 3, st + 7) > .985: return 'f'
        return e

    def natural(self, ch):
        t = self.T.get(ch) or {}
        return not t.get('paved') and ch not in 'pwdcmbaqhe' and t.get('walk', True) is not False

    def rim_tile(self, s, u):
        o = self.old[self.sid]; w, h = self.w, self.h
        x, z = {'E': (w - .5, u), 'W': (.5, u), 'N': (u, h - .5), 'S': (u, .5)}[s]
        x = min(w - .5, max(.5, x)); z = min(h - .5, max(.5, z))
        return tile_at(o, x, z)

    # -- the exits' paths out through the strips
    def path_u(self, L, d):
        """where exit L's path is along the edge at depth d: a gentle bend that is straight at both ends"""
        if self.under: return L['e']                       # a tunnel runs straight
        a = (hsh(L['j']['i'], 3, 17) - .5) * 1.8
        return L['e'] + a * math.sin(math.pi * d / M)

    def path_char(self, L):
        o = self.old[self.sid]; e = o['edgeExits'][next(k for k, q in enumerate(o['edgeExits']) if q['id'] == self.exit_id(L))]
        ch = tile_at(o, *exit_point(o, e))
        t = self.T.get(ch) or {}
        return ch if (t.get('paved') or ch in 'pPcv') else 'p'

    def exit_id(self, L):
        j = L['j']; R = self.D['links'][j['i']][3]
        return R['a'] if L['me'] == 'A' else R['b']

    def levels(self, L):
        """the step raise at my exit, at the other's, and the width of the slope round a path that climbs"""
        o = self.old[self.sid]; k = next(k for k, q in enumerate(o['edgeExits']) if q['id'] == self.exit_id(L))
        e = o['edgeExits'][k]; p = exit_point(o, e); s = e['side']
        x, z = {'E': (o['w'] - .25, p[1]), 'W': (.25, p[1]), 'N': (p[0], o['h'] - .25), 'S': (p[0], .25)}[s]
        mine = raise_at(o, self.E, x, z)
        n = self.old[L['o']]; En = steps_of(n); en = n['edgeExits'][L['ko']]; pn = exit_point(n, en); sn = en['side']
        xn, zn = {'E': (n['w'] - .25, pn[1]), 'W': (.25, pn[1]), 'N': (pn[0], n['h'] - .25), 'S': (pn[0], .25)}[sn]
        theirs = raise_at(n, En, xn, zn)
        return mine, theirs, max(3.0, min(14.0, 2 + 3.3 * max(mine, theirs)))

    # -- build
    def tiles(self):
        old = self.old[self.sid]; W2, H2 = self.W2, self.H2; rows = []
        for j in range(H2):
            z = H2 - 1 - j + .5; row = []
            for i in range(W2):
                x = i + .5; loc = self.locate(x, z)
                if loc is None:
                    row.append(old['tiles'][self.h - 1 - int(math.floor(z - self.oz))][int(math.floor(x - self.ox))]); continue
                row.append(self.strip_tile(loc, x, z))
            rows.append(''.join(row))
        return rows

    def strip_tile(self, loc, x, z):
        s, u, d = loc; st = self.salt
        if self.under:                                     # rock, and each tunnel's floor
            if s != 'C' and any(L2['s'] == s and abs(u - L2['e']) <= TUNNEL for L2 in self.links): return self.old[self.sid].get('edge') or 'k'
            return 'r'
        if s == 'C':
            (xo, zo), (ex, ez) = u, d; return self.base_tile(self.sid, xo, zo)
        L, g = self.link_for(s, u)
        # the path out to the new edge
        for L2 in self.links:
            if L2['s'] != s: continue
            if abs(u - self.path_u(L2, d)) <= 1.05 + .25 * noise(u * .7, d * .7, st + 11):
                if (self.old[self.sid].get('edge') or 'g') not in 'wd': return self.path_char(L2)   # (no path across the sea)
        xo, zo = {'E': (self.w + d, u), 'W': (-d, u), 'N': (u, self.h + d), 'S': (u, -d)}[s]
        own = self.base_tile(self.sid, xo, zo)
        rim = self.rim_tile(s, u)
        if rim in 'wd':
            if d < 2.5 + 2.5 * noise(u * .3, d * .3, st + 13): own = rim
        elif self.natural(rim) and d < .5 + 3.5 * noise(u * .25, d * .25, st + 3): own = rim
        if not L or g <= 0: return own
        # the next place's countryside comes in, in patches laid out in the join's own frame (so they carry on across)
        ax, az, sd = self.a_frame(L, s, u, d)
        pB = sm((sd + M) / (2 * M))                       # 0 deep in A's strip, .5 on the line, 1 deep in B's
        pOther = pB if L['me'] == 'A' else 1 - pB
        n = .7 * noise(ax * .21, az * .21, L['j']['i'] * 31 + 5) + .3 * hsh(ax * 2, az * 2, L['j']['i'] * 31 + 6)
        flip = (n < pB) if L['me'] == 'A' else (n >= pB)   # the cell shows B's ground where n < pB, from either side
        if not flip or hsh(ax, az, 99) > g * 1.2: return own
        o = L['o']
        # the other place's ground at this point of its own (old) frame
        if L['me'] == 'A':
            dx, dz = DIR[L['j']['sa']]; bx, bz = ax - L['j']['off'][0] - 2 * M * dx, az - L['j']['off'][1] - 2 * M * dz
        else: bx, bz = ax, az
        other = self.base_tile(o, bx, bz)
        wet_o, wet_m = other in 'wd', own in 'wd'
        if wet_o and not wet_m: return 's'                # land meets water on a beach
        if wet_m and not wet_o: return 's'
        return other

    def heights(self):
        old = self.old[self.sid]; W2, H2 = self.W2, self.H2; out = []
        for r in range(H2 + 1):
            z = H2 - r; row = []
            for i in range(W2 + 1):
                x = i; loc = self.locate(x, z)
                if loc is None or (0 <= x - self.ox <= self.w and 0 <= z - self.oz <= self.h):
                    row.append(round(corner_h(old, x - self.ox, z - self.oz), 2)); continue
                row.append(round(self.strip_h(loc), 2))
            out.append(row)
        return out

    def edge_h(self, s, u):
        o = self.old[self.sid]
        x, z = {'E': (self.w, u), 'W': (0, u), 'N': (u, self.h), 'S': (u, 0)}[s]
        return corner_h(o, min(self.w, max(0, x)), min(self.h, max(0, z)))

    def strip_h(self, loc):
        s, u, d = loc
        if s == 'C':
            (xo, zo), (ex, ez) = u, d
            sx = 'W' if xo < 0 else 'E'; sz = 'S' if zo < 0 else 'N'
            a = self.strip_h((sx, min(self.h, max(0, zo)), ex)); b = self.strip_h((sz, min(self.w, max(0, xo)), ez))
            wa = ex / (ex + ez) if ex + ez else .5
            return a * (1 - wa) + b * wa
        hr = self.edge_h(s, u); L, g = self.link_for(s, u); hs = hr
        if L:
            o = self.old[L['o']]; un = u - L['sh']; sn = OPP[s]
            xn, zn = {'E': (o['w'], un), 'W': (0, un), 'N': (un, o['h']), 'S': (un, 0)}[sn]
            hn = corner_h(o, min(o['w'], max(0, xn)), min(o['h'], max(0, zn)))
            hs = hr + g * (hn - hr) / 2
        roll = (noise(u * .11, d * .11, self.salt + 21) - .5) * .7 * math.sin(math.pi * min(d, M) / M)
        return hr + (hs - hr) * sm(d / M) + roll

    def steps(self):
        """the old grid in place; in the strips, the slopes up to exits on a shelf (ramps, so no new walls)"""
        old = self.old[self.sid]; E0 = self.E; w2, h2 = self.W2 * 2, self.H2 * 2
        H = [0.0] * (w2 * h2); Mk = [0] * (w2 * h2); any_ = False
        if E0:
            any_ = True
            for j in range(E0['h']):
                for i in range(E0['w']):
                    q = (j + self.oz * 2) * w2 + i + self.ox * 2; H[q] = E0['H'][j * E0['w'] + i]; Mk[q] = E0['M'][j * E0['w'] + i]
        if self.under:
            lv = {id(L): self.levels(L) for L in self.links}
            for j in range(h2):
                for i in range(w2):
                    x, z = (i + .5) / 2, (j + .5) / 2; loc = self.locate(x, z)
                    if loc is None: continue
                    q = j * w2 + i; floor, near = None, 99.0; base = 0.0
                    if loc[0] != 'C':
                        s, u, d = loc
                        for L in self.links:
                            if L['s'] != s: continue
                            mine, theirs, _ = lv[id(L)]; lev = mine + ((mine + theirs) / 2 - mine) * sm(d / M); off = abs(u - L['e'])
                            if off <= TUNNEL: floor = lev
                            if off < near: near, base = off, lev
                    # the rock: level with the vault next to a tunnel, its top one smooth surface (ramp cells lean to
                    # their neighbours within half a metre, so the top has no little steps; the tunnel's sides stay walls)
                    if floor is not None: H[q] = round(floor * 20) / 20; Mk[q] = 32
                    else:
                        # away from the tunnels the rock climbs toward the mountain (world.js carries it on over the cave)
                        up = ROCK_RISE * sm((near - TUNNEL - 2) / 10) * (.7 + .6 * noise(x * .13, z * .13, self.salt + 51))
                        H[q] = round((base * (1 - sm((near - TUNNEL) / 6)) + ROCK_UP + up) * 20) / 20; Mk[q] = 32 | 3
            return {'w': w2, 'h': h2, 'H': H, 'M': Mk}
        climbs = []
        for L in self.links:
            mine, theirs, Wl = self.levels(L)
            if mine > .05 or theirs > .05: climbs.append((L, mine, theirs, Wl))
        if climbs:
            for j in range(h2):
                for i in range(w2):
                    x, z = (i + .5) / 2, (j + .5) / 2; loc = self.locate(x, z)
                    if loc is None or loc[0] == 'C': continue
                    s, u, d = loc; best = 0.0
                    for L, mine, theirs, Wl in climbs:
                        if L['s'] != s: continue
                        ls = (mine + theirs) / 2; lev = mine + (ls - mine) * sm(d / M)
                        wgt = 1 - sm((abs(u - self.path_u(L, d)) - 1.6) / Wl)
                        best = max(best, lev * wgt)
                    if best > .01:
                        q = j * w2 + i; H[q] = round(best * 20) / 20; Mk[q] = 32; any_ = True
        return {'w': w2, 'h': h2, 'H': H, 'M': Mk} if any_ else None

    def growth(self, tiles):
        """trees, shrubs, rocks and flowers in the strips, of the kinds that grow on their ground"""
        nat = [(k, P) for k, P in self.C.items() if P.get('family') and P.get('grow') and P.get('family') != 'water']
        out = []; st = self.salt
        if self.under: return out
        for z in range(0, self.H2, 2):
            for x in range(0, self.W2, 2):
                cx, cz = x + 1, z + 1; loc = self.locate(cx, cz)
                if loc is None: continue
                h = hsh(cx, cz, st + 21)
                if h > .34: continue
                px = cx + (hsh(cx, cz, st + 22) - .5) * 1.6; pz = cz + (hsh(cx, cz, st + 23) - .5) * 1.6
                if px < .4 or pz < .4 or px > self.W2 - .4 or pz > self.H2 - .4: continue
                loc = self.locate(px, pz)
                if loc is None: continue
                ch = tiles[self.H2 - 1 - int(pz)][int(px)]
                if ch in 'pwd' or (self.T.get(ch) or {}).get('paved') or ch in 'PcvKqhae': continue
                # keep clear of the paths
                near = 99
                if loc[0] != 'C':
                    s, u, d = loc
                    for L in self.links:
                        if L['s'] == s: near = min(near, abs(u - self.path_u(L, d)))
                if near < 2.6: continue
                fam = ('ground' if h < .15 else 'flowers') if near < 7 else ('trees' if h < .13 else 'shrubs' if h < .2 else 'rocks' if h < .24 else 'ground' if h < .3 else 'flowers')
                ks = [(k, P) for k, P in nat if P['family'] == fam and ch in P['grow']]
                if not ks: continue
                r = hsh(cx, cz, st + 24) * sum(P.get('weight') or 1 for _, P in ks); pick = ks[0]
                for q in ks:
                    r -= q[1].get('weight') or 1
                    if r <= 0: pick = q; break
                p = {'k': pick[0], 'x': round(px, 2), 'z': round(pz, 2), 'w': 43}
                s_ = round(.85 + hsh(cx, cz, st + 25) * .3, 2)
                if abs(s_ - 1) > .02: p['s'] = s_
                if hsh(cx, cz, st + 26) < .45: p['f'] = 1
                out.append(p)
        return out

    def apply(self):
        sc = self.sc; ox, oz = self.ox, self.oz
        tiles = self.tiles(); heights = self.heights(); E = self.steps()
        mv = lambda p: [round(p[0] + ox, 2), round(p[1] + oz, 2)]
        for p in sc.get('props') or []: p['x'] = round(p['x'] + ox, 2); p['z'] = round(p['z'] + oz, 2)
        if sc.get('hub'): sc['hub'] = mv(sc['hub'])
        for k in ('streams', 'rails'):
            for o in sc.get(k) or []: o['pts'] = [mv(q) for q in o['pts']]
        for k in ('bridges', 'escalators'):
            for o in sc.get(k) or []: o['a'] = mv(o['a']); o['b'] = mv(o['b'])
        for k in ('arches', 'waters'):
            for o in sc.get(k) or []: o['x'] = round(o['x'] + ox, 2); o['z'] = round(o['z'] + oz, 2)
        for o in sc.get('life') or []:
            if o.get('area'): a = o['area']; o['area'] = [round(a[0] + ox, 2), round(a[1] + oz, 2), round(a[2] + ox, 2), round(a[3] + oz, 2)]
            if o.get('path'): o['path'] = [mv(q) for q in o['path']]
        if sc.get('npcSpots'): sc['npcSpots'] = [mv(q) if isinstance(q, list) else q for q in sc['npcSpots']]
        for o in sc.get('people') or []: o['x'] = round(o['x'] + ox, 2); o['z'] = round(o['z'] + oz, 2)   # alpha 0.4: who stands about
        if sc.get('worn'): sc['worn'] = [[round(w[0] + ox, 2), round(w[1] + oz, 2), round(w[2] + ox, 2), round(w[3] + oz, 2)] for w in sc['worn']]
        if sc.get('path'): sc['path'] = [mv(q) for q in sc['path']]
        # exits stay at their edges: along it they move with the map
        old_w, old_h = self.w, self.h
        for e in sc.get('edgeExits') or []:
            if e['side'] in 'EW': e['t'] = round((e['t'] * old_h + oz) / self.H2, 4)
            else: e['t'] = round((e['t'] * old_w + ox) / self.W2, 4)
            if e.get('path'): e['path'] = [mv(q) for q in e['path']]
        sc['w'], sc['h'] = self.W2, self.H2; sc['tiles'] = tiles; sc['heights'] = heights
        if E: store_steps(sc, E)
        sc['exits'] = [[round(v, 2) for v in exit_point(sc, e)] for e in sc.get('edgeExits') or []]
        sc['props'] = (sc.get('props') or []) + self.growth(tiles)
        if self.under:                                     # the tunnels' vaults: rock arches a metre and a half long, end to end
            for L in self.links:
                s, e = L['s'], L['e']
                for k in range(int(M / 1.5)):
                    d0 = k * 1.5
                    if s == 'E': a = {'x': round(ox + old_w + d0, 2), 'z': round(oz + e, 2), 'dir': 'x'}
                    elif s == 'W': a = {'x': round(ox - d0 - 1.5, 2), 'z': round(oz + e, 2), 'dir': 'x'}
                    elif s == 'N': a = {'x': round(ox + e, 2), 'z': round(oz + old_h + d0, 2), 'dir': 'z'}
                    else: a = {'x': round(ox + e, 2), 'z': round(oz - d0 - 1.5, 2), 'dir': 'z'}
                    sc.setdefault('arches', []).append(dict(a, d=1.55, **ARCH))
        sc['grown2'] = dict(sc.get('grown2') or {}, **{s: self.m[s] for s in 'NESW' if self.m[s]})
        return f"{self.sid}: {old_w}×{old_h} → {self.W2}×{self.H2} (grew {', '.join(s for s in 'NESW' if self.m[s])})"


def main():
    dry = '--dry' in ARGS; head, D = load()
    if '--under' in ARGS:
        for sid in ARGS[ARGS.index('--under') + 1].split(','):
            sc = D['scenes'][sid]
            if sc.get('grown2'): sys.exit(f'{sid} has grown already: mark it underground before it grows')
            sc['under'] = 1; print(f'{sid}: underground')
    old = json.loads(json.dumps(D['scenes']))
    joins = joins_of(D)
    done, out = set(), []
    for r in D['route']:
        sid = r.get('scene')
        if not sid or sid in done or sid not in D['scenes']: continue
        done.add(sid)
        sc = D['scenes'][sid]
        G = Grow(D, sid, joins, old)
        if not G.sides: out.append(f"{sid}: grown already" if sc.get('grown2') else f"{sid}: no joined side"); continue
        if dry: out.append(f"{sid}: would grow {', '.join(G.sides)} → {G.W2}×{G.H2}"); continue
        out.append(G.apply())
    print('\n'.join(out))
    if dry: return
    save(head, D)
    print('measuring the walks again and setting the steps (join-places.py --costs)…', flush=True)
    subprocess.run([sys.executable, str(ROOT / 'tools' / 'join-places.py'), '--costs'], check=True)


if __name__ == '__main__':
    main()
