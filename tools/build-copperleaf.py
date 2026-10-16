#!/usr/bin/env python3
"""alpha 0.4: Copperleaf Town and Route 1 · Hedgerow Lane, the new start.

Copperleaf is a hamlet one short lane north of Marigold Town: round doors under moss and solar-shingle roofs, crooked
chimneys, a flower-shaped wind sail on the knoll, a pond with a jetty, the great oak with a swing on the green, bunting
and the old glass lanterns. Professor Hazel's lab stands at the top of the green (it moves here from Marigold Town, whose
lab plot becomes a community greenhouse and the start of the lane north), and Granny Juniper's cottage among her beehives
holds your room. Like Pallet Town it has no shop and no clinic: Marigold Town, one route on, is the first proper town.
Route 1 · Hedgerow Lane runs between them: hedgerows full of dog roses and blackberries, wildflower fields with tall
grass where the first Billies wait, and a stream you cross on stepping stones.

What it adds (and only adds: route nodes are appended, so every save's node numbers stay as they are):
  the two places (route nodes 46 and 47, the scenes, the roads Marigold Town - Hedgerow Lane - Copperleaf), the wild
  Billies of the lane, Granny Juniper (her look, what she says, her page in the Lore), the places' lore and what people
  say, a cosy mood and Copperleaf's own song, and rules.start.place (a new game starts in Copperleaf).
What it changes in Marigold Town: the lab goes (Hazel took it with her), a way north opens where it stood (the lane to
Copperleaf, with a signpost), a community greenhouse and garden beds stand beside it, and the cottage that was "Your
house" is a neighbour's again. The texts that said you woke in Marigold Town now say Copperleaf.

Run the joining tools after it, as for every place (they grow the 12 m strips where places meet and measure the walks):
    python3 tools/build-copperleaf.py            # add what is missing (a place of that name already there is left alone)
    python3 tools/build-copperleaf.py --dry      # build and report, write nothing
    python3 tools/build-copperleaf.py --map out/ # also a top-down map of each new place
    python3 tools/build-copperleaf.py --force    # build this tool's two places again (only theirs: tagged "a04place")
then  python3 tools/expand-places.py  (the strips, and the walks and steps: join-places.py --costs),
      python3 tools/turn-buildings.py, python3 tools/build-life-v47.py copperleaf, python3 tools/build-map-minis.py
      copperleaf hedgerow sundown
"""
import copy, importlib.util, json, math, random, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('rg47', ROOT / 'tools' / 'build-regions-v47.py'); RG = importlib.util.module_from_spec(spec); spec.loader.exec_module(RG)
BP = RG.BP; B = BP.B
Place, AV, SOFT, UNDER, LEAFY = BP.Place, BP.AV, BP.SOFT, BP.UNDER, BP.LEAFY
TAG = 'a04place'
SIZES = {'copperleaf': (88, 64), 'hedgerow': (80, 64)}

LOOK = {
    'copperleaf': dict(sky=['#8EC4E8', '#C6E4EC', '#F6E6C6'], haze='#EEDDC4', hazeD=40, amb='pollen', far='hills', farH=8, wind=1.0),
    'hedgerow': dict(sky=['#8CC6E8', '#C2E4EE', '#F2E8CA'], haze='#E8DEC6', hazeD=38, amb='pollen', far='hills', farH=8, wind=1.05),
}
NODES = [
    dict(id='copperleaf', name='Copperleaf Town', kind='town', route='Town', lon=8.6, lat=16.4, pool='hedgerow', biome='town', area='grass', t='town',
         music='copperleaf', mood='cozy',
         blurb='A hamlet of round doors and moss roofs, where things from the surface come down. Professor Hazel’s lab, Granny Juniper’s bees, and nothing to buy.'),
    dict(id='hedgerow', name='Hedgerow Lane', kind='route', route='Route 1', lon=7.0, lat=9.0, pool='hedgerow', biome='grass', area='grass', t='grass', mood='green',
         blurb='A short lane between hedgerows full of dog roses and blackberries, from Copperleaf down to Marigold Town. Mind the stepping stones.'),
]
ROADS = [('sundown', 'hedgerow', 'Route 1'), ('hedgerow', 'copperleaf', 'Route 1')]
POOLS = {'hedgerow': {'lv': [2, 4], 'list': [['walton0', 40], ['ek0', 40], ['dorsey0', 30], ['knight0', 14]]}}
MOODS = {'cozy': {'name': 'Cosy morning', 'sat': 1.05, 'con': 1.0, 'warm': .24, 'lift': [.012, .006, 0], 'gain': [.016, .008, -.012], 'sh': [.012, 0, .018], 'hi': [.022, .012, -.008]}}
PEOPLE = {
    'juniper': {'look': {'name': 'Granny Juniper', 'body': {'height': .93, 'body': 1.12, 'chest': .55, 'hips': 1.12, 'shoulders': .96},
                         'skin': '#E9B897', 'hair': '#E8E4DC', 'eyes': '#6A8A4A',
                         'wear': {'hair': 'hair_bun', 'eyes': 'eyes_sleepy', 'brows': 'brows_arched', 'mouth': 'mouth_smile', 'top': 'sweater', 'outer': 'apron',
                                  'bottom': 'skirt', 'shoes': 'boots', 'hat': 'hat_bucket', 'glasses': 'glasses_round', 'neck': 'scarf'},
                         'colors': {'sweater': ['#7A9A5A'], 'apron': ['#E9B83C', '#8A5A2A'], 'skirt': ['#8A5A3A'], 'boots': ['#6A4A32', '#4A3220'],
                                    'hat_bucket': ['#F2E8C8', '#E9B83C'], 'scarf': ['#CE7C4C'], 'glasses_round': ['#8A6A3A']}}},
}
# Granny Juniper, beekeeper of Copperleaf: what she says the first time, then a line or two each time after
JUNIPER = {
    'id': 'juniper', 'who': 'juniper', 'name': 'Granny Juniper',
    'first': ['[happy] There you are, dear. Up and about already? You came down in my lavender. Flattened half of it.',
              'Hazel looked you over and says you’ll live. I’ve made up the little room in my cottage. It’s yours for as long as you want it.',
              'Come in whenever you like. Have a rest, and your Billies will feel better for it too.'],
    'lines': ['The bees know everyone in Copperleaf. They’ll get used to you.',
              '[happy] Honey’s in the jar by the door. Don’t tell the bees I said so.',
              'Hazel works too hard. Take her some honey if you’re passing the lab.',
              'The wind sail turns all day and keeps the lanterns lit all night. Copper, sun and a bit of wind: that’s all a village needs.',
              'Marigold Town is down Hedgerow Lane. Mind the stepping stones; the middle one wobbles.',
              'Things fall into Copperleaf every week or so. Mostly furniture. You’re the first one I’ve kept.',
              '[happy] You’ve been walking! I can tell. You’ve got that Hollow Earth colour in your cheeks.']}
LORE_PLACES = {
    'copperleaf': {'history': 'A hamlet that grew where the sinkholes drop things. The first settlers built with what fell: the copper came down as pipes and wire, and the moss came by itself.',
                   'known': 'Professor Hazel’s lab, Granny Juniper’s bees, round doors, and a sky that sends down furniture every week or so.',
                   'landmark': 'The great oak on the green, with a swing nobody remembers hanging.',
                   'legend': 'The flower on the knoll turns even when there is no wind. Granny Juniper says it is listening for the next one to fall.'},
    'hedgerow': {'history': 'The old lane between Copperleaf and Marigold Town, walked so often the hedges grew up on either side to see who was coming.',
                 'known': 'Hedgerows full of dog roses and blackberries, wildflower fields, and the first Billies most trainers ever meet.',
                 'landmark': 'The stepping stones over the stream. The middle one wobbles.',
                 'legend': 'Hedge-gatherers say the blackberries are sweetest on the side facing Copperleaf, because that side gets the news first.'},
}
CHAT = {
    'copperleaf': {'0': ['You’re the one who fell in? Granny Juniper said you’d be up soon.', 'Hazel’s lab is at the top of the green. You can’t miss it: it’s the one that hums.',
                         'The swing on the oak is for anyone. Grown-ups too, when nobody’s looking.'],
                   '4': ['Four badges already? We knew you’d do well. Things that fall here usually do.']},
    'hedgerow': {'0': ['Walking down to Marigold Town? Mind the stepping stones.', 'The Billies in the tall grass here are only small. A good place to start.']},
}
LORE_PEOPLE = {'juniper': {'name': 'Granny Juniper', 'who': 'juniper', 'role': 'Beekeeper, Copperleaf Town', 'unlock': 'meet:juniper',
                           'text': 'Copperleaf’s beekeeper, who has lived among her hives longer than anyone can remember. When you fell into her lavender she took you in, made up the little room in her cottage, and has not stopped feeding you since.',
                           'voice': 'Warm and unhurried. “You’re the first one I’ve kept.”'}}
# texts that said you woke in Marigold Town, or that Hazel's lab is there: (path, old, new); left alone if they changed
REWRITE = [
    ('lore/story/prologue/text', 'woke in Marigold Town with no memory of who you were. Professor Hazel found you, gave you a Billie, and her other student, Blake, picked the one that beats yours.',
     'woke in Copperleaf, a hamlet of round doors and beehives, with no memory of who you were. Professor Hazel found you, gave you a Billie, and her other student, Blake, picked the one that beats yours. Granny Juniper, the beekeeper, gave you a room.'),
    ('lore/story/road1/text', 'and the road teaches more than any book. When someone falls in, their things come down too, and they scatter along Tallgrass Meadow.',
     'and the road teaches more than any book. Route 1, Hedgerow Lane, runs down from Copperleaf to Marigold Town. When someone falls in, their things come down too, and they scatter along Tallgrass Meadow beyond it.'),
    ('lore/people/you/text', 'woke in Marigold Town', 'woke in Copperleaf'),
    ('lore/people/hazel/role', 'Billie researcher, Marigold Town', 'Billie researcher, Copperleaf Town'),
    ('lore/people/hazel/text', 'Her lab is up the steps at the back of Marigold Town.', 'Her lab stands at the top of the green in Copperleaf, down the lane from Granny Juniper’s hives.'),
    ('lore/world/hollow/text', 'Most of them land near Marigold Town, which the people of Marigold Town regard as a business opportunity.',
     'Most of them land in Copperleaf, a hamlet one lane north of Marigold Town, which the people of Marigold Town regard as a business opportunity.'),
    ('lore/places/sundown/history', 'grew round the spot where things from the surface land.', 'grew round the spot where things from the surface used to land, before they started coming down in Copperleaf instead.'),
    ('lore/places/sundown/known', 'Professor Hazel’s lab, the free clinic, and people who are very relaxed about strangers falling out of the sky.',
     'The free clinic, the general store, and people who are very relaxed about strangers walking in from Copperleaf.'),
    ('lore/loading/=Things that fall from the surface mostly land near Marigold Town.', 'Things that fall from the surface mostly land near Marigold Town.',
     'Things that fall from the surface mostly land in Copperleaf. Granny Juniper keeps a list.'),
    ('lore/chat/sundown/0/=You fell out of the sky? Welcome! The last one was a filing cabinet.', 'You fell out of the sky? Welcome! The last one was a filing cabinet.',
     'You’re the one who fell into Copperleaf? Welcome! The last one was a filing cabinet.'),
    ('lore/chat/sundown/0/=Hazel’s lab is up the steps. She’s good with people who don’t remember things.', 'Hazel’s lab is up the steps. She’s good with people who don’t remember things.',
     'Hazel’s lab is up Hedgerow Lane in Copperleaf. She’s good with people who don’t remember things.'),
    ('scenes/sundown/chat/=Welcome to Marigold Town! The Professor’s lab is up the steps at the back.', 'Welcome to Marigold Town! The Professor’s lab is up the steps at the back.',
     'Welcome to Marigold Town! Copperleaf is up Hedgerow Lane, past the greenhouse.'),
]
CHARTER_PAGE = 'Article 1(a), added since. Anyone who falls into Copperleaf is a resident of Marigold Town as well. Copperleaf has not been asked.'


def node_index(D, nid): return RG.node_index(D, nid)


def full_name(o):
    return o['route'] + ' · ' + o['name'] if not o.get('town') and str(o.get('route', '')).startswith('Route ') else o['name']


# ================================================================================================ the data
def add_data(D, force, rep):
    for n in NODES:
        i = node_index(D, n['id'])
        e = {'name': n['name'], 'cost': 0, 'pool': n['pool'], 'route': n['route'], 't': n['t'], 'blurb': n['blurb'], 'lon': n['lon'], 'lat': n['lat'], 'area': n['area'],
             'scene': n['id'], 'id': n['id'], 'kind': n['kind'], 'biome': n['biome'], 'mood': n['mood'], TAG: 1}
        if n['kind'] == 'town': e['town'] = 1
        else: e['routeName'] = n['route']
        if n.get('music'): e['music'] = n['music']
        if i is None: D['route'].append(e); rep.append(f'place {n["id"]} (node {len(D["route"]) - 1})')
        elif force and D['route'][i].get(TAG): D['route'][i] = e
    have = {L[3].get('id') for L in D['links'] if len(L) > 3 and L[3]}
    for a, b, name in ROADS:
        rid = f'road:{a}-{b}'
        if rid in have: continue
        D['links'].append([node_index(D, a), node_index(D, b), 1000, {'a': 'north', 'b': 'south', 'id': rid, 'from': a, 'to': b, 'name': name}]); rep.append(rid)
    for k, v in POOLS.items():
        if k not in D['pools'] or force: D['pools'][k] = v
    for k, v in MOODS.items():
        if k not in D['moods'] or force: D['moods'][k] = v
    for k, v in PEOPLE.items():
        if k not in D['people'] or force: D['people'][k] = copy.deepcopy(v)
    L = D.setdefault('lore', {})
    for k, v in LORE_PLACES.items():
        if k not in L.setdefault('places', {}) or force: L['places'][k] = v
    for k, v in CHAT.items():
        if k not in L.setdefault('chat', {}) or force: L['chat'][k] = v
    for k, v in LORE_PEOPLE.items():
        if k not in L.setdefault('people', {}) or force: L['people'][k] = v
    ch = (L.get('books') or {}).get('charter')
    if ch and CHARTER_PAGE not in ch['pages']: ch['pages'].insert(1, CHARTER_PAGE)
    n = rewrite(D)
    if n: rep.append(f'{n} texts now say Copperleaf')
    st = D['rules']['start']
    if st.get('place') != 'copperleaf': st['place'] = 'copperleaf'; rep.append('a new game starts in Copperleaf')


def rewrite(D):
    """each REWRITE path: dict keys and list indexes, an id in a list of {id: ...}, or '=text' for the list item that is
    exactly that text"""
    done = 0
    for path, old, new in REWRITE:
        parts = path.split('/'); o = D; ok = True
        for k, part in enumerate(parts[:-1]):
            if isinstance(o, list):
                o = next((x for x in o if isinstance(x, dict) and x.get('id') == part), None) if not part.isdigit() else (o[int(part)] if int(part) < len(o) else None)
            elif isinstance(o, dict): o = o.get(part)
            if o is None: ok = False; break
        if not ok: continue
        last = parts[-1]
        if last.startswith('='):
            if isinstance(o, list) and last[1:] in o: o[o.index(last[1:])] = new; done += 1
            continue
        if isinstance(o, dict) and isinstance(o.get(last), str) and old in o[last]: o[last] = o[last].replace(old, new); done += 1
    return done


# ================================================================================================ helpers
def manual_exits(s, D, i, hub, pts):
    """exits where they are asked for (in the order of the roads that leave this place), each with its signpost"""
    s.d['hub'] = [round(hub[0], 2), round(hub[1], 2)]; s.clear.append((hub[0], hub[1], 1.2))
    nb = [L[1] if L[0] == i else L[0] for L in D['links'] if i in (L[0], L[1])]
    assert len(nb) == len(pts), (nb, pts)
    for j, e in zip(nb, pts):
        s.clear.append((e[0], e[1], 1.6))
        ux, uz = (0, -1) if e[1] < s.H / 2 else (0, 1)
        sx, sz = e[0] + 1.9, e[1] - uz * 3.0
        s.put('signpost', sx, sz, act='sign', say=f'{full_name(D["route"][j])} this way.')
    s.d['exits'] = [list(e) for e in pts]
    return pts


def lane(s, pts, ch='p', width=1.6):
    """a path through the given points, drawn and counted as a road (no lamps)"""
    s.line(pts, ch, width / 2 + .5, keep='wd'); s.roads.append((pts, width)); return pts


def ellipse_pts(cx, cz, rx, rz, n=40, a0=0.0, a1=2 * math.pi):
    return [[round(cx + math.cos(a0 + (a1 - a0) * k / n) * rx, 2), round(cz + math.sin(a0 + (a1 - a0) * k / n) * rz, 2)] for k in range(n + 1)]


def fence_line(s, x0, x1, z, gaps=(), k='picket_fence', w=2.2):
    x = x0
    while x + w <= x1 + .01:
        mid = x + w / 2
        if not any(a <= mid <= b for a, b in gaps): s.put(k, mid, z, block=True)
        x += w


def wild_hedge(s, pts, side_off=2.1, every=1.25, gaps=(), seed=0):
    """a hedgerow beside a lane: bushes close together, a dog rose or a bramble now and then, an oak every so often"""
    r = random.Random(seed); out = 0
    for a, b in zip(pts, pts[1:]):
        L = math.hypot(b[0] - a[0], b[1] - a[1]); ux, uz = (b[0] - a[0]) / (L or 1), (b[1] - a[1]) / (L or 1); nx, nz = -uz, ux
        t = 0.0
        while t < L:
            x0, z0 = a[0] + ux * t, a[1] + uz * t
            if not any(g0 <= z0 <= g1 for g0, g1 in gaps):
                for side in (-1, 1):
                    o = side_off + r.uniform(-.25, .35)
                    x, z = x0 + nx * o * side, z0 + nz * o * side
                    kk = r.random()
                    k = 'bush_roses' if kk < .16 else 'bush_berry' if kk < .34 else 'bush_flower' if kk < .42 else '@bush_round'
                    if r.random() < .06: k = '@tree_oak'
                    if s.free(x, z, .35, AV + 'w', .25, -.25): s.put(k, x, z, r.uniform(.9, 1.15), r.random() < .5); out += 1
            t += every * r.uniform(.85, 1.2)
    return out


# ================================================================================================ Copperleaf Town
def town_copperleaf(D, i):
    roads0 = B.ROADS; B.ROADS = roads0 + 'K'                    # the cobbled forecourt is a way in, for the doors on it
    try: return _town_copperleaf(D, i)
    finally: B.ROADS = roads0


def _town_copperleaf(D, i):
    W, H = SIZES['copperleaf']; BP.SIZE['copperleaf'] = (W, H)
    old = RG.fresh('copperleaf', 'Copperleaf Town', 'town', LOOK['copperleaf'], (W, H))
    s = Place('copperleaf', 'Copperleaf Town', 'g', 4041, W, H); hub = (53.4, 33.2); s.setup(old, hub)
    s.d.update(folk=5)
    manual_exits(s, D, i, hub, [[42.6, 1.1]])
    # ---- the ground: the green, its ring path, the lane in from Hedgerow Lane, the lanes to the houses
    s.blob(47, 25.2, 11.2, 5.6, 'l', .1)
    ring = ellipse_pts(47, 25.2, 12.4, 6.8, 44)
    lane(s, ring, 'p', 1.1)
    lane(s, [[42.6, .2], [42.2, 5], [43.4, 10], [45.8, 15], [47, 18.4]], 'p', 1.6)
    s.blob(54, 35.4, 7.6, 2.5, 'K', .12)                                                       # the lab's forecourt, cobbles
    lane(s, [[47, 32], [49, 34.6]], 'p', 1.4)
    lane(s, [[36.2, 29.6], [30, 32.2], [24, 34.4], [19.2, 35.4]], 'p', 1.4)                   # west, to Juniper's gate
    lane(s, [[58.6, 28.4], [64, 31.2], [70, 34.2], [78, 35.4], [W - .2, 36.4]], 'p', 1.3)     # east, past the cottages
    lane(s, [[58.4, 22.6], [62.6, 18.4], [66.6, 15.4], [68.2, 14.6]], 'p', 1.4)               # down to the jetty
    lane(s, [[46.6, 36.2], [43.2, 38.6], [42.4, 43], [38, 45.2], [30, 44.6], [24.6, 42.2]], 'p', 1.3)   # round the lab, the back lane
    lane(s, [[60.6, 37.4], [61.6, 42.2], [58, 47.2]], 'p', 1.2)
    # ---- the pond with its jetty, reeds and lilies, the ducks
    s.pond(70.5, 21, 7.6, 4.6, ducks=4, reeds=16, lilies=9, dip=.8)
    # the jetty: boards up to the water's edge, then a flat deck on posts with the water under it (structures.js)
    s.line([[68.2, 14.6], [68.2, 16.0]], 'b', 1.4, keep='wd')
    s.d.setdefault('bridges', []).append({'a': [68.2, 15.6], 'b': [68.2, 21.2], 'w': 1.4, 'kind': 'wood', 'pier': 1, 'a04pier': 1})
    s.put('dock_post', 67.3, 21.2); s.put('dock_post', 69.1, 21.2); s.put('rowboat', 70.8, 21.4, .95, block=False)
    # ---- the lab at the top of the green, with room in front of its door (the opening is filmed there)
    lab = s.house('lab', 48.5, 38.4, 'lab', garden=False, v=0, label='Professor Hazel’s lab',
                  say='Professor: Every Billie you meet adds to your Index. Walk, battle and tax them all!')
    s.clear.append((55, 34.6, 4.6)); s.clear.append((53, 30.4, 2.6))                          # the opening's stage and its cameras
    # ---- Granny Juniper's cottage among her beehives (your room is inside)
    for xx in range(8, 31):
        for zz in range(36, 49):
            if s.at(xx + .5, zz + .5) in 'gGf': s.cell(xx + .5, zz + .5, 'l')
    jun = s.house('cottage_juniper', 19.2, 41.2, 'home', garden=False, label='Granny Juniper’s cottage', v=0)
    fence_line(s, 8.6, 30, 36.2, gaps=((17.2, 20.4),))
    for k, (x, z) in enumerate(((11.0, 38.0), (13.2, 38.4), (11.4, 44.2), (25.8, 38.4), (27.8, 39.0), (26.8, 45.0), (9.6, 41.4))):
        s.put('beehive', x, z, 1, k % 2)
    s.blob(12.4, 46.6, 3.2, 1.6, 'H', .3); s.blob(27.6, 42.2, 2.2, 1.4, 'H', .3)               # heather and lavender for the bees
    s.drift(['lavender'], 12.4, 46.6, 3, 1.4, 9, avoid=AV); s.drift(['lavender', 'flowers_purple'], 27.6, 42.2, 2, 1.2, 6, avoid=AV)
    s.drift(['@flowers', 'daisies', 'marigolds'], 23.6, 37.4, 3, .8, 7, avoid=AV)
    s.put('wind_sail_flower', 6.4, 39.2, .72); s.put('laundry_line', 16.6, 46.4, .9, block=False); s.put('wheelbarrow', 29.2, 41.6)
    # ---- the cottages, round doors and all
    s.house('cottage_moss', 31.2, 47.2, v=0, fence=True)
    s.house('cottage_solar', 42.6, 49.6, v=1, fence=False)
    s.house('cottage_moss', 57.4, 49.4, v=3, fence=True)
    s.house('cottage_solar', 65.2, 40.2, v=0, fence=False)
    s.house('cottage_moss', 77.4, 38.8, v=2, fence=True)
    # ---- the green: the great oak with its swing, the well, a bench, bunting
    s.put('tree_giant_swing', 35.2, 27.4); s.clear.append((32.6, 27.2, 1.6))
    s.put('well', 40.2, 20.6); s.put('bench_wood', 51.4, 21.2); s.put('bench_wood', 60.6, 17.6)
    s.put('banner_bunting', 45.6, 13.8); s.put('banner_bunting', 37.2, 31.6, .95); s.put('banner_bunting', 63.4, 27.2, .9)
    s.drift(['@flowers', 'daisies', 'clover_white'], 47, 25.2, 6, 3, 10, avoid=AV)
    # ---- the knoll with the flower wind sail
    s.hill(74, 49, 7.5, 1.3); s.put('wind_sail_flower', 74.4, 49.6, .92); s.clear.append((74.4, 49.6, 1.4))
    s.drift(['@flowers', 'buttercups', 'poppies'], 74, 47, 4, 2, 10, avoid=AV)
    # ---- the old glass lanterns along the lanes (never on the opening's stage)
    for x, z in ((40.4, 7.4), (46.6, 16.6), (34.8, 31.6), (24.6, 36.4), (60.4, 29.8), (69.6, 32.8), (64.4, 16.4), (45.4, 43.8), (57.8, 44.0)):
        if s.free(x, z, .3, 'wd', None, .1): s.put('lantern', x, z)
    # ---- a vegetable patch and an orchard behind Juniper's
    s.rect(3, 20, 12, 27, 'o')
    for zz in (21.2, 23.0, 24.8):
        for xx in (4.2, 6.4, 8.6, 10.8): s.put('crops', xx, zz, .9, block=False)
    s.put('scarecrow', 13.6, 25.2); s.put('fence_wood', 7.6, 19.2)
    s.grove(10, 54, 6, 3.4, 7, ['tree_fruit', 'tree_fruit', 'tree_blossom'], floor='C', under=['@flowers', 'daisies'])
    # ---- the edges: trees and hedges at the back, a frame of bushes in front
    s.tint_ground([('C', .64, 6, 'g'), ('G', .66, 8, 'g'), ('f', .76, 4, 'gGC')], 41)
    s.belt(['@tree_oak', '@tree_oak', 'tree_birch', 'tree_blossom', 'tree_beech'], 'back', 6.5, 30, UNDER)
    s.grove(84, 50, 4, 6, 6, LEAFY, under=UNDER); s.grove(3, 8, 3, 4, 4, LEAFY, under=UNDER); s.grove(84, 8, 3.5, 4, 5, LEAFY, under=UNDER)
    s.scatter(['@rocks', '@bush_round', 'bush_flower', 'birdhouse', 'stump', '@flowers'], 22, (0, 0, W, H), avoid=AV + 'tH', gap=.6)
    s.frame(['@bush_round', 'bush_roses', '@flowers', 'daisies'], 14)
    s.life('chicken', 4, area=[4, 44, 15, 50]); s.life('rabbit', 2); s.life('squirrel', 2)
    s.d['npcSpots'] = [[24.4, 37.6], [45, 22.6], [61.4, 19.6], [36.6, 33.8], [70.6, 31.2]]
    s.rolling(.28, 8); s.hill(8, 58, 8, 1.0); s.rise_back(52, 1.2)
    return s.out(8, 'wood', 'p', bridge='wood'), {'lab': lab, 'home': jun}


# ================================================================================================ Route 1 · Hedgerow Lane
def route_hedgerow(D, i):
    W, H = SIZES['hedgerow']
    old = RG.fresh('hedgerow', 'Hedgerow Lane', 'route', LOOK['hedgerow'], (W, H))
    s = Place('hedgerow', 'Hedgerow Lane', 'g', 4042, W, H); hub = (41.4, 26.4); s.setup(old, hub)
    # roads in link order: Marigold Town (south) first, then Copperleaf (north)
    manual_exits(s, D, i, hub, [[37.6, 1.1], [43.6, H - 1.1]])
    # ---- the stream (west to east across the lane) and where the lane crosses it on stepping stones
    stream = [(-.2, 48.6), (12, 47.2), (24, 45.8), (34, 44.6), (42.4, 44.2), (50, 43.4), (60, 42.2), (70, 40.4), (W + .2, 39.6)]
    s.stream(stream, 1.4, .5, banks='M')
    wet = sorted(z for z in range(H) if s.at(42.5, z + .5) in 'wd')
    zs, zn = (wet[0], wet[-1] + 1) if wet else (43.4, 45)
    # ---- the lane: up from Marigold Town, past the rest spot, to the stones, and on to Copperleaf
    south = [[37.6, .2], [37.2, 6], [38.8, 12], [42.6, 17.4], [42.8, 22], [41.4, 26.4], [40.2, 31.6], [41.4, 37.4], [42.4, zs - .7]]
    north = [[42.6, zn + .7], [42.2, 50.4], [40.6, 55.6], [42, 60.2], [43.6, H - .2]]
    lane(s, south, 'p', 1.5); lane(s, north, 'p', 1.5)
    for k, z in enumerate([zs + .1 + j * .78 for j in range(max(2, int(round((zn - zs) / .78)) + 1))]):
        if z < zn + .1: s.put('stepping', 42.5 + (.12 if k % 2 else -.1), round(z, 2), 1, k % 2, block=False)
    s.clear.append((42.5, (zs + zn) / 2, 1.4))
    # ---- the hedgerows along the lane, with gaps into the fields
    nh = wild_hedge(s, south[1:-1], 2.2, 1.3, gaps=((14, 16.4), (30.4, 33)), seed=11) + wild_hedge(s, north, 2.2, 1.3, gaps=((52, 54.2),), seed=12)
    for x0, x1, z in ((2, 33, 19.6), (49, 78, 33.6), (3, 30, 57.4)):                          # field boundaries, east to west
        x = x0
        while x + 3.4 <= x1:
            if s.free(x + 1.7, z, .5, AV + 'w', .4, 0): s.put('hedge', x + 1.7, z, 1, s.r.random() < .5)
            x += 3.4 + s.r.uniform(0, .6)
    # ---- wildflower fields, tall grass where the first Billies wait
    s.tint_ground([('E', .55, 7, 'g'), ('f', .68, 5, 'gE'), ('G', .64, 8, 'g'), ('C', .72, 5, 'g')], 61)
    s.drifts(9, (4.5, 7.5, 2.2, 3.6), density=.75)
    for cx, cz, ks in ((16, 10, ['poppies', 'daisies', '@flowers']), (62, 12, ['cornflowers', 'buttercups', 'daisies']), (14, 30, ['foxgloves', '@flowers', 'daisies']),
                       (64, 26, ['poppies', 'buttercups']), (20, 52, ['lupins', 'daisies', '@flowers']), (62, 52, ['cornflowers', 'poppies', '@flowers'])):
        s.drift(ks, cx, cz, 6, 2.4, 16, avoid=AV + 't')
    # ---- by the stream: willows, reeds, a frog or two; the rest spot by the lane
    for x, z in ((22, 49.4), (60, 45.2)): s.put('tree_willow', x, z, s.r.uniform(.95, 1.1), x > 40)
    for _ in range(14):
        x = s.r.uniform(2, W - 2); z = 48.6 - (x / W) * 9 + s.r.choice((-1.4, 1.5))
        if s.free(x, z, .2, 'pcqhaed', .4, .05): s.put(s.r.choice(['reeds', 'cattails']), x, z, s.r.uniform(.85, 1.1), x > 40, block=False)
    s.clearing(46.4, 27.6, [('bench_wood', 0, 0), ('lantern', -1.8, .4), ('flowerpot', 1.6, .2)])
    s.put('waystone', 35.6, 3.8, act='sign', say='Route 1 · Hedgerow Lane. Copperleaf, up the lane; Marigold Town, down it.')
    s.put('tree_oak', 52, 8, 1.05); s.put('tree_oak', 26, 38, 1.1); s.put('tree_blossom', 56, 58, 1.0)
    s.belt(['@tree_oak', 'tree_birch', 'tree_blossom', '@bush_round'], 'left', 4, 12, UNDER)
    s.belt(['@tree_oak', 'tree_birch', 'tree_beech', '@bush_round'], 'right', 4, 12, UNDER)
    s.scatter(['@rocks', 'stump', '@bush_round', 'log', 'molehill', 'rock_flat', '@fern'], 18, (0, 0, W, H), avoid=AV + 't', gap=.7)
    s.frame(['@bush_round', 'bush_berry', '@flowers', 'daisies'], 12)
    s.life('rabbit', 3); s.life('frog', 2); s.life('squirrel', 1)
    s.rolling(.55, 8); s.hill(14, 28, 9, 1.1); s.hill(66, 22, 9, 1.2)
    return s.out(7, 'wood', bridge='wood'), {'hedges': nh}


# ================================================================================================ Marigold Town's changes
def marigold(D, rep):
    sc = D['scenes']['sundown']; props = sc['props']
    lab = [p for p in props if p.get('act') == 'lab' or p['k'] == 'lab']
    if lab:
        L = lab[0]; sc['props'] = props = [p for p in props if p not in lab]
        x, z = L['x'], L['z']
        # the lab plot: the back lanes join up across it at the start of the way north, a community greenhouse stands to
        # its east and garden beds lie to its west
        rows = [list(r) for r in sc['tiles']]; Hh = sc['h']
        for xx in range(int(x - 7), int(x + 10)):
            for zz in (int(z), int(z) + 1):
                if rows[Hh - 1 - zz][xx] in 'gGfCuly': rows[Hh - 1 - zz][xx] = 'p'
        for xx in range(int(x - 9), int(x - 3)):
            for zz in range(int(z + 3), int(z + 7)): rows[Hh - 1 - zz][xx] = 'o'
        sc['tiles'] = [''.join(r) for r in rows]
        props.append({'k': 'greenhouse', 'x': round(x + 6.5, 2), 'z': round(z + 2.4, 2), 'label': 'Community greenhouse', 'act': 'house',
                      'say': 'The community greenhouse. Tomatoes, peppers and a sign: “Seedlings for Copperleaf. Do not eat.”', TAG: 1})
        for xx, zz in [(x - 8.2 + a * 1.8, z + 3.8 + b * 1.6) for a in range(3) for b in range(2)]:
            props.append({'k': 'crops', 'x': round(xx, 2), 'z': round(zz, 2), 's': .85, TAG: 1})
        props.append({'k': 'lantern', 'x': round(x - 2.2, 2), 'z': round(z - 1.2, 2), TAG: 1})
        rep.append(f'Marigold Town: the lab at {x},{z} goes; a greenhouse and garden beds in its place')
    # the way north, where the lab stood
    if not any(e.get('side') == 'N' for e in sc.get('edgeExits') or []):
        x = (lab[0]['x'] if lab else 60.0)
        RG.WAYS_IN[('sundown', 'hedgerow')] = dict(side='N', at=x, start=52.0, ch='p', width=2.0)
        RG.open_way(D, 'sundown', 'hedgerow', RG.WAYS_IN[('sundown', 'hedgerow')], rep)
    j = node_index(D, 'hedgerow'); props = sc['props']              # (open_way made the list anew)
    for p in props:
        if p.get('act') == 'sign' and p.get('v47region') and 'Hedgerow Lane' in p.get('say', ''):
            p['say'] = f'{full_name(D["route"][j])} this way.'; p.pop('v47region', None); p[TAG] = 1
    # your house is a neighbour's again (your room is in Granny Juniper's cottage now)
    for p in props:
        if p.get('act') == 'home':
            p['act'] = 'house'; p.pop('label', None); p['say'] = 'A cosy little house. A note on the door: “Gone to Copperleaf for honey.”'
            rep.append(f'Marigold Town: the cottage at {p["x"]},{p["z"]} is a neighbour’s house again')


# ================================================================================================ build
BUILD = {'copperleaf': town_copperleaf, 'hedgerow': route_hedgerow}


def build(D, force, rep, mp=None):
    cat = D['scenery']['props']; BP.CAT.update(cat); nature = BP.nature_pool(cat)
    for sid, fn in BUILD.items():
        old = D['scenes'].get(sid)
        if old and old.get('keep'): rep.append(f'{sid}: marked keep, left alone'); continue
        if old and not (force and old.get(TAG)): rep.append(f'{sid}: built already' + ('' if old.get(TAG) else ' (not by this tool)')); continue
        i = node_index(D, sid); sc, info = fn(D, i)
        sc[TAG] = 1; sc['biome'] = next(n['biome'] for n in NODES if n['id'] == sid); sc['kind'] = next(n['kind'] for n in NODES if n['id'] == sid); sc['place'] = sid
        if sid == 'copperleaf':
            sc['chat'] = ['Things fall into Copperleaf every week or so. We put the furniture to good use.', 'The flower on the knoll makes the power. The moss makes the roofs. The bees make the rest.',
                          'Hazel’s lab hums all night. Granny Juniper says it’s thinking.', 'Marigold Town has the shop and the clinic. We have the swing.']
            # Granny Juniper, in her garden by the hives
            sp = sc['npcSpots'][0]; sc['people'] = [dict(JUNIPER, x=sp[0], z=sp[1], dir='down')]
        occ, grown = BP.finish(sc, D, i, nature, cat)
        RG.prune_wild(sc); grown = sum(1 for p in sc['props'] if p.get('w') == 42)
        D['scenes'][sid] = sc
        tg = sum(r.count('t') for r in sc['tiles'])
        rep.append(f'{sid}: {sc["w"]}×{sc["h"]}, tall grass {tg} m², {occ} placed + {grown} grown, exits {[(e["id"], e["side"], e["t"]) for e in sc["edgeExits"]]}' +
                   ''.join(f', {k} at {v["x"]},{v["z"]}' for k, v in info.items() if isinstance(v, dict)) + (f', {info["hedges"]} hedgerow bushes' if 'hedges' in info else ''))
        if mp: BP.draw_map(sid, sc, cat, mp / f'{sid}.png')


def main():
    args = sys.argv[1:]; dry = '--dry' in args; force = '--force' in args; mp = None
    if '--map' in args: j = args.index('--map'); mp = Path(args[j + 1]); mp.mkdir(parents=True, exist_ok=True)
    head, D = RG.load(); rep = []
    add_data(D, force, rep)
    build(D, force, rep, mp)
    marigold(D, rep)
    print('\n'.join(rep))
    if not dry: RG.save(head, D); print('saved')
    else: print('dry run: nothing written')


if __name__ == '__main__':
    main()
