#!/usr/bin/env python3
"""alpha 0.4: new names for every place, in the style of the Pokémon games: towns and cities with names of their own
(a light money wink stays: Copperleaf, Goldvine, Glimmershaft), routes numbered with a name for each stretch.
Ids, save keys and art paths stay as they are, so saves carry over; only what you read changes:

    the place names and route labels (route[].name, .route, .routeName), the scene names, the links' names, the
    signposts ("Tallgrass Meadow this way"), shop, job and prop names, and every mention in what people say,
    trainers' lines, gate notes, blurbs and the lore.

    python3 tools/rename-places.py           # rename in the game data
    python3 tools/rename-places.py --dry     # show what would change (every changed text, before and after)

Texts that need more than a swap of names are rewritten by hand in REWRITE (by their path in the data)."""
import gamedata  # phase 04b: the data files in game/data
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'data' / 'gamedata.js'
ARGS = sys.argv[1:]

# id: (new name, route label or None for a town or city, takes "the" in running text)
NEW = {
    'sundown': ('Marigold Town', None, 0), 'longgrass': ('Tallgrass Meadow', 'Route 2', 0), 'golf': ('Old Fairway', 'Route 3', 1),
    'thicket': ('Thornberry Wood', 'Route 4', 0), 'grotto': ('Fizzwell Town', None, 0), 'canyon': ('Stepstone Canyon', 'Route 5', 0),
    'scrapyard': ('Rustgear Yard', 'Route 6', 0), 'foodcourt': ('Pepperpot Town', None, 0), 'mall': ('Lanternhall City', None, 0),
    'pond': ('Willowmere', 'Route 7', 0), 'farm': ('Clovercrest Town', None, 0), 'ridge': ('Kitewind Ridge', 'Route 8', 0),
    'city': ('Verdigris City', None, 0), 'offshore': ('Driftwreck Bay', 'Route 9', 0), 'taxhaven': ('Palmhaven Town', None, 0),
    'volcano': ('Mt. Cinderpeak', 'Route 10', 0), 'pass': ('Hornpass', 'Route 11', 0), 'summit': ('Frostcrown Town', None, 0),
    'lake': ('Mirrormere Lake', 'Route 12', 0), 'festival': ('Fanfare Fields', 'Route 13', 0), 'twofold': ('Twinpetal Town', None, 0),
    'blossom': ('Petalfall Vale', 'Route 14', 0), 'margins': ('Rootwater Marsh', 'Route 15', 0), 'vintage': ('Grapevine Hills', 'Route 16', 0),
    'bullion': ('Goldvine Town', None, 0), 'flattax': ('Saltpan Flats', 'Route 17', 0), 'badlands': ('Grizzle Badlands', 'Route 18', 1),
    'sporewood': ('Puffcap Woods', 'Route 19', 0), 'marketcap': ('Capshade Town', None, 0), 'fallquarter': ('Russetwood', 'Route 20', 0),
    'hypergrowth': ('Tanglewild Jungle', 'Route 21', 0), 'spread': ('Prism Chasm', 'Route 22', 0), 'mintshaft': ('Glimmershaft Town', None, 0),
    'darkpool': ('Gloomwater Pool', 'Route 23', 0), 'frozen': ('Rimefrost Caves', 'Route 24', 1), 'shoals': ('Conchshell Shoals', 'Route 25', 0),
    'portfolio': ('Kelpport City', None, 0), 'bottomline': ('Abyssal Trench', 'Route 26', 1), 'pressing': ('Vinyl Works', 'Route 27', 0),
    'serverfarm': ('Circuit Terraces', 'Route 28', 0), 'upside': ('Nimbus City', None, 0), 'bubbleland': ('Fizzpop Fair', 'Route 29', 0),
    'bracket': ('Skygarden Walk', 'Route 30', 0), 'ath': ('Zenith Steps', 'Route 31', 0), 'closingbell': ('Bellwether Rise', 'Route 32', 0),
    'innersun': ('The Inner Sun', None, 0),
}
# the old names as they show in texts (longest first), with "the" before them absorbed (the new name brings its own)
OLD = {
    'sundown': ['Sundown'], 'longgrass': ['Long Grass'], 'golf': ['Overgrown Golf Course'], 'thicket': ['Bramble Thicket'],
    'grotto': ['Bubbling Grotto'], 'canyon': ['Stairstep Canyon'], 'scrapyard': ['Scrap Yard'], 'foodcourt': ['Food Court'],
    'mall': ['Mall of the Deep'], 'pond': ['Willow Pond'], 'farm': ['Hillside Farm'], 'ridge': ['Lookout Ridge'],
    'city': ['Capital Gains'], 'offshore': ['Offshore'], 'taxhaven': ['Tax Haven'], 'volcano': ['Mount Margin Call'],
    'pass': ['Bull Run Pass'], 'summit': ['Summit Capital'], 'lake': ['Liquidity Lake'], 'festival': ['Festival Fields'],
    'twofold': ['Twofold'], 'blossom': ['Blossom Vale'], 'margins': ['Mangrove Margins'], 'vintage': ['Vintage Rows'],
    'bullion': ['Bullion Hill'], 'flattax': ['Flat Tax Flats'], 'badlands': ['Bear Market Badlands'], 'sporewood': ['Sporeholder Woods'],
    'marketcap': ['Market Cap'], 'fallquarter': ['Fall Quarter'], 'hypergrowth': ['Hypergrowth'], 'spread': ['Spread'],
    'mintshaft': ['Mintshaft'], 'darkpool': ['Dark Pool'], 'frozen': ['Frozen Assets'], 'shoals': ['Shell Company Shoals'],
    'portfolio': ['Port Folio'], 'bottomline': ['Bottom Line Trench'], 'pressing': ['Pressing Plant'], 'serverfarm': ['Server Farm'],
    'upside': ['Upside City'], 'bubbleland': ['Bubbleland'], 'bracket': ['Upper Bracket Walk'], 'ath': ['All-Time High'],
}
# old names that are also plain words: only with their "the" (the Spread, the Offshore)
NEEDS_THE = {'spread', 'offshore'}
# names that also mean something else and are left alone where they do: the bank in Palmhaven, the great bell on its rise
KEEP = [r'Offshore Bank', r'the Closing Bell(?=[:,.]? when)', r'The Closing Bell(?=[:,.]? when)']
# shops, jobs, rooms and props named after their place
NAMED = {'Sundown General Store': 'Marigold General Store', 'Sundown Diner': 'Marigold Diner', 'Twofold Market': 'Twinpetal Market',
         'Bubbleland gate': 'Fizzpop Fair gate', 'Mall of the Deep (indoor)': 'Lanternhall City (indoor)', 'The Sundown Town Charter': 'The Marigold Town Charter'}
# texts that need more than a swap (by their path in the data)
REWRITE = {
    'trainers/crude/lines/0': '“Welcome to the Fizzwell arena. Here we battle in a sandstorm.”',
    'trainers/markdown/lines/0': '“Welcome to the Lanternhall arena. Polished floors, polished team.”',
    'trainers/markdown/seat/unlockText': 'Route 11 · Hornpass, north of Verdigris City, is open, and snowy Frostcrown Town beyond it. A Billie big enough to ride can also carry you across Mirrormere Lake and the sea west of Marigold Town.',
    'trainers/morel/seat/unlockText': 'Tanglewild Jungle, east of Capshade Town, is open.',
    'trainers/carat/seat/unlockText': 'The Rimefrost Caves, east of Glimmershaft Town, are open. Beyond them, the inner sea.',
    'trainers/chad2/hint': 'Blake waits in Clovercrest Town with an evolved starter. Bring a team around level 18.',
    'lore/places/city/known': 'Banks, towers, and Verdigris City’s famous traffic, which is mostly Billies.',
    'lore/chat/marketcap/0/4': 'Capshade’s market cap goes up when the spores do. Breathe out, then.',
    'lore/loading/14': 'The soup of the day in Pepperpot Town has been the same soup since 1971.',
    # the old route groups had numbers of their own (the canyon was on "Route 2")
    'locations/canyon/gateText': 'The steps down to Route 5 · Stepstone Canyon open once you earn Leader Rocco’s Ground Badge.',
    'trainers/crude/seat/unlockText': 'The steps down to Route 5 · Stepstone Canyon and Lanternhall City are open. Silver Coins are now for sale.',
}
# and words that change with a name inside a longer text
FIXES = [('Alta on the Summit', 'Alta in Frostcrown Town'), ('lives in the bins behind Pepperpot Town', 'lives in the bins behind the food stalls of Pepperpot Town')]


def load():
    s = gamedata.js_text(); i = s.index('window.GAMEDATA=') + len('window.GAMEDATA=')
    D, end = json.JSONDecoder().raw_decode(s, i)
    return s[:i - len('window.GAMEDATA=')], D


def save(head, D):
    gamedata.save_js(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n')


def full(pid):
    n, r, _ = NEW[pid]
    return f'{r} · {n}' if r else n


def make_swap():
    rules = []
    for pid, olds in OLD.items():
        new, _, the = NEW[pid]
        for o in olds:
            # "the Long Grass" / "The Long Grass" / "Long Grass", with a possessive kept
            art = r"([Tt])he " if pid in NEEDS_THE else r"(?:([Tt])he )?"
            rules.append((re.compile(r"\b" + art + re.escape(o) + r"\b"), new, the))
    rules.sort(key=lambda r: -len(r[0].pattern))
    def swap(t):
        keep = []
        def hold(m):
            keep.append(m.group(0)); return f'\x00{len(keep) - 1}\x00'
        for k in KEEP: t = re.sub(k, hold, t)
        for a, b in NAMED.items(): t = t.replace(a, b)
        for rx, new, the in rules:
            def sub(m, new=new, the=the):
                art = m.group(1)
                if the: return (('The ' if art == 'T' else 'the ') if art else '') + new
                # a new name with no "the": a sentence that started with "The ..." keeps its capital
                return new
            t = rx.sub(sub, t)
        t = re.sub('\x00(\\d+)\x00', lambda m: keep[int(m.group(1))], t)
        # "Marigold Town's" reads as "Marigold's"
        return re.sub(r"\b([A-Z][a-z]+) Town(’|')s\b", r"\1\2s", t)
    return swap


SIGN = re.compile(r'^(.*?) this way\. (?:Route .*?|Sea Route .*?|Lake Route|Petal Path|Salt Road|Leaf Lane|Lantern Way|Pier Road|Bubble Road|The Spire Stairs|The Long Way Down|Sun Road)\.$')


def main():
    head, D = load(); swap = make_swap(); changes = []
    byname = {r['name']: r['id'] for r in D['locations']}
    # names and route labels
    for r in D['locations']:
        if r['id'] not in NEW: continue
        new, label, _ = NEW[r['id']]
        for k, v in (('name', new), ('route', label or ('City' if new.endswith('City') else 'Town' if r.get('town') else ''))):
            if r.get(k) != v: changes.append((f"locations/{r['id']}/{k}", r.get(k), v)); r[k] = v
        if label: r['routeName'] = label
        elif 'routeName' in r: del r['routeName']
    for sid, sc in D['scenes'].items():
        base = sid.split('@')[0]
        if '@' in sid: continue
        if base in NEW and sc.get('name') and sc['name'] != NEW[base][0]:
            changes.append((f'scenes/{sid}/name', sc['name'], NEW[base][0])); sc['name'] = NEW[base][0]
        elif base not in NEW and sc.get('name'):
            t = swap(sc['name'])
            if t != sc['name']: changes.append((f'scenes/{sid}/name', sc['name'], t)); sc['name'] = t
    # the links between places: the route they belong to (or the town they lead into)
    rid = {r['id']: r for r in D['locations']}
    for L in D['roads']:
        m = L[3]; a, b = m.get('from'), m.get('to')
        lab = (NEW.get(b) or (None, None))[1] or (NEW.get(a) or (None, None))[1] or (NEW.get(b) or ('',))[0]
        if lab and m.get('name') != lab: changes.append((f"roads/{m.get('id')}", m.get('name'), lab)); m['name'] = lab
    # every other text: signposts first, then the swap
    def walk(v, path):
        if isinstance(v, dict):
            for k in list(v):
                if k in ('id', 'img', 'tile', 'scene', 'k', 'from', 'to', 'art', 'banner', 'icon', 'src', 'path') and isinstance(v[k], str): continue
                if path[:1] == ['locations'] and k in ('name', 'route', 'routeName'): continue
                if path[:1] == ['scenes'] and len(path) == 2 and k == 'name': continue
                v[k] = walk(v[k], path + [k])
            return v
        if isinstance(v, list): return [walk(x, path + [i]) for i, x in enumerate(v)]
        if isinstance(v, str):
            t = v; m = SIGN.match(t) if path and path[-1] == 'say' else None; key = '/'.join(map(str, path))
            if key in REWRITE: t = REWRITE[key]
            elif m and m.group(1) in byname and byname[m.group(1)] in NEW:
                t = f"{full(byname[m.group(1)])} this way."
            else:
                t = swap(t)
                for a, b in FIXES: t = t.replace(a, b)
            if t != v: changes.append(('/'.join(map(str, path)), v, t))
            return t
        return v
    for k in list(D):
        if k in ('locations',):
            for i, r in enumerate(D[k]):
                for f in list(r):
                    if f in ('name', 'route', 'routeName', 'id', 'scene', 'shop', 'boutique', 'area', 'pool'): continue
                    r[f] = walk(r[f], [k, r['id'], f])
            continue
        D[k] = walk(D[k], [k])
    if '--dry' in ARGS or '--show' in ARGS:
        for p, a, b in changes:
            if '/say' in p and str(b).endswith('this way.'): continue
            print(f'{p}\n   - {a}\n   + {b}')
        print(len(changes), 'changes', sum(1 for c in changes if str(c[2]).endswith('this way.')), 'of them signposts')
        if '--dry' in ARGS: return
    save(head, D); print('renamed:', len(changes), 'changes')


if __name__ == '__main__':
    main()
