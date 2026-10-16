#!/usr/bin/env python3
"""v24 world: the stops stand farther apart while every road keeps its step count.

    python3 tools/build-world-v24.py stretch     # once: spreads the known world and moves every stop with it
    python3 tools/build-world-v24.py biomes      # paints the new areas (volcano island, snowy range, lake, sea lanes)

stretch: the painted world (game/art/map/world.png) is stretched around Sundown, 1.6 times east-west over the half of
the world the journey crosses and 1.4 times north-south between the 50th parallels (the far side and the ice caps are
squeezed to make room), and every stop and region-ahead in the game data moves with the land it stood on. The v23
world is kept as tools/backup/world_v23.png. Afterwards run tools/repaint-world-trails.py and
tools/build-world-relief.py."""
import json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'data' / 'gamedata.js'
WORLD = ROOT / 'game' / 'art' / 'map' / 'world.png'
BACK = ROOT / 'tools' / 'backup' / 'world_v23.png'
KX, KY = 1.6, 1.4


def F(lon):
    """old longitude -> new (degrees, any range in, -180..180 out)"""
    u = (lon + 30) % 360 - 30
    v = u * KX if u <= 130 else 130 * KX + (u - 130) * (360 - 30 * KX - 130 * KX) / 200
    return (v + 180) % 360 - 180


def Finv(lon):
    v = (lon + 30 * KX) % 360 - 30 * KX           # new range starts at -30*KX
    u = v / KX if v <= 130 * KX else 130 + (v - 130 * KX) * 200 / (360 - 30 * KX - 130 * KX)
    return u


def G(lat):
    a = abs(lat)
    return math.copysign(a * KY if a <= 50 else 50 * KY + (a - 50) * (90 - 50 * KY) / 40, lat)


def Ginv(lat):
    a = abs(lat)
    return math.copysign(a / KY if a <= 50 * KY else 50 + (a - 50 * KY) * 40 / (90 - 50 * KY), lat)


def load():
    s = DATA.read_text(encoding='utf-8'); i = s.index('window.GAMEDATA=')
    return s[:i], json.JSONDecoder().raw_decode(s[i + 16:])[0]


def save(head, D):
    DATA.write_text(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')


def stretched():
    src = np.asarray(Image.open(BACK).convert('RGB')); H, W, _ = src.shape
    xs = np.arange(W); ys = np.arange(H)
    lon_new = (xs + .5) / W * 360; lon_new = np.where(lon_new > 180, lon_new - 360, lon_new)
    lat_new = 90 - (ys + .5) / H * 180
    lon_old = np.array([Finv(l) for l in lon_new]); lat_old = np.array([Ginv(l) for l in lat_new])
    sx = np.floor((lon_old % 360) / 360 * W).astype(int) % W
    sy = np.clip(np.floor((90 - lat_old) / 180 * H).astype(int), 0, H - 1)
    return src[sy[:, None], sx[None, :]]


def stretch():
    head, D = load()
    if D.get('meta', {}).get('worldV24'):
        print('already stretched'); return
    Image.fromarray(stretched().astype(np.uint8)).save(WORLD, optimize=True)
    for r in D['route']:
        r['lon'] = round(F(r.get('lon', 0)), 2); r['lat'] = round(G(r.get('lat', 0)), 2)
    for f in D.get('regions', []):
        if f.get('lon') is not None: f['lon'] = round(F(f['lon']), 2); f['lat'] = round(G(f.get('lat', 0)), 2)
    D.setdefault('meta', {})['worldV24'] = 1
    save(head, D)
    print('stretched; stops:', [(r['name'], r['lon'], r['lat']) for r in D['route']])


NEW_STOPS = [
 dict(name='The Offshore', t='sea', route='Sea Route 1', pool='sea', area='sea', scene='offshore', ride=1, lon=-20.5, lat=-5.5,
      blurb='Open water west of Sundown, dotted with sandbars, buoys and a lighthouse. Only a Water billionaire big enough to ride can carry you across.'),
 dict(name='Tax Haven', town=1, t='island', route='Sea Route 1', pool='island', area='beach', scene='taxhaven', shop='taxhaven', lon=-41.5, lat=-11.5,
      blurb='A sunny island town of white villas, yachts and very discreet bank accounts. Nobody here pays for anything, officially.'),
 dict(name='Mount Margin Call', t='volcano', route='Route 7', pool='volcano', area='volcano', scene='volcano', gate='haven', lon=-47.5, lat=1.5,
      gateText='The path up Mount Margin Call opens once you earn Leader Marina’s Water Badge in Tax Haven.',
      blurb='A grumbling volcano on Tax Haven’s north shore. Lava rivers, obsidian and steam vents, and the hottest billionaires in the Hollow Earth.'),
 dict(name='Bull Run Pass', t='pass', route='Route 5', pool='pass', area='snow', scene='pass', gate='retail', lon=90.0, lat=40.5,
      gateText='Bull Run Pass opens once you earn Leader Iris’s Steel Badge in the Mall of the Deep.',
      blurb='A snowy pass north of Capital Gains: pines, rope bridges over misty gorges and a hut with hot cocoa.'),
 dict(name='Summit Capital', town=1, t='summit', route='Route 5', pool='summit', area='snow', scene='summit', shop='summit', lon=97.5, lat=56.5,
      blurb='A mountain town of chalets stacked up the slope, with the thinnest air and the highest rents in the Hollow Earth.'),
 dict(name='Liquidity Lake', t='lake', route='Lake Route', pool='lake', area='lake', scene='lake', ride=1, lon=70.0, lat=56.0,
      blurb='A wide, calm lake between Hillside Farm and Summit Capital, with reedy islands and a floating market. You need a billionaire to ride across.'),
]
NEW_LINKS = [('Sundown', 'The Offshore', 1500), ('The Offshore', 'Tax Haven', 1600), ('Tax Haven', 'Mount Margin Call', 1400),
             ('Capital Gains', 'Bull Run Pass', 1900), ('Bull Run Pass', 'Summit Capital', 1700),
             ('Hillside Farm', 'Liquidity Lake', 1600), ('Liquidity Lake', 'Summit Capital', 1500)]
NEW_POOLS = {
 'sea': {'lv': [18, 22], 'list': [['goss0', 30], ['goss1', 15], ['short0', 30], ['short1', 12], ['dial0', 20], ['ball1', 10], ['hood0', 3]]},
 'island': {'lv': [20, 23], 'list': [['trust1', 30], ['latte1', 20], ['goss1', 20], ['oprah1', 15], ['riri1', 12], ['ball1', 10]]},
 'volcano': {'lv': [22, 26], 'list': [['drill1', 35], ['hype1', 25], ['latte1', 25], ['drill2', 6], ['gush0', 4], ['box1', 15]]},
 'pass': {'lv': [18, 21], 'list': [['logo1', 30], ['ball1', 25], ['trend1', 25], ['box1', 20], ['comp1', 15]]},
 'summit': {'lv': [20, 23], 'list': [['lease1', 30], ['bulk1', 25], ['logo1', 25], ['kiosk1', 20], ['trust1', 20], ['comp1', 10]]},
 'lake': {'lv': [16, 20], 'list': [['goss1', 25], ['short1', 20], ['dial1', 20], ['dial0', 25], ['comp1', 10], ['hood1', 3]]},
}
NEW_BACKDROPS = {
 'sea': {'name': 'Open sea', 'art': 'beach', 'sky': ['#4A86D8', '#8EC4F0', '#E4F0F6'], 'fog': '#D4E6F2', 'fogD': 90, 'amb': 'pollen', 'far': 'sea'},
 'beach': {'name': 'Island beach', 'art': 'beach', 'sky': ['#4A8ADC', '#92C8F2', '#F2EEDC'], 'fog': '#E6EAE0', 'fogD': 85, 'amb': 'pollen', 'far': 'sea'},
 'volcano': {'name': 'Volcano', 'art': 'volcano', 'sky': ['#3A1E2A', '#8A3A32', '#E08A50'], 'fog': '#A0584A', 'fogD': 55, 'amb': 'sand', 'far': 'volcano'},
 'snow': {'name': 'Snowy peaks', 'art': 'snow', 'sky': ['#5A7EC8', '#A2C2EC', '#EEF2F8'], 'fog': '#DCE6F2', 'fogD': 75, 'amb': 'pollen', 'far': 'snow'},
 'lake': {'name': 'Lake', 'art': 'golf', 'sky': ['#5A86D6', '#9CC6F0', '#ECF0F2'], 'fog': '#D8E4EE', 'fogD': 85, 'amb': 'pollen', 'far': 'fields'},
}
NEW_SHOPS = {
 'taxhaven': {'name': 'Haven Duty-Free', 'keeper': 'Coral Vance', 'who': 'coral', 'greeting': 'Welcome to Haven Duty-Free! Everything is tax-free, especially the things that are not.',
              'stock': [{'item': 'apology', 'price': 190}, {'item': 'settlement', 'price': 200}, {'item': 'appeal', 'price': 200}, {'item': 'loophole', 'price': 360},
                        {'item': 'bailout', 'price': 560}, {'item': 'parachute', 'price': 900}, {'coin': 'silver', 'price': 780}, {'coin': 'gold', 'price': 1950}]},
 'summit': {'name': 'Summit Supply', 'keeper': 'Sven Peakstone', 'who': 'sven', 'greeting': 'Altitude makes everything more expensive. Except me. I’m fair.',
            'stock': [{'item': 'taxbreak', 'price': 160}, {'item': 'trailmix', 'price': 250}, {'item': 'loophole', 'price': 380}, {'item': 'bailout', 'price': 580},
                      {'item': 'spillkit', 'price': 400}, {'coin': 'penny', 'price': 300}, {'coin': 'silver', 'price': 800}]},
}
L = lambda **k: k
NEW_PEOPLE = {
 'alta': {'look': L(name='Alta', body={'chest': .45, 'height': 1.06, 'legs': 1.06}, skin='#F0C3A0', hair='#E8E4DA', eyes='#4A7BBB',
                    wear={'hair': 'hair_long', 'eyes': 'eyes_sharp', 'brows': 'brows_straight', 'mouth': 'mouth_smirk', 'top': 'longsleeve', 'outer': 'puffer', 'bottom': 'leggings', 'shoes': 'boots', 'glasses': 'glasses_sun', 'neck': 'scarf'},
                    colors={'puffer': ['#3E6FD6', '#2A4EA0'], 'leggings': ['#2A2F3E'], 'boots': ['#5A3A24', '#2A1E16'], 'scarf': ['#F2C14E']})},
 'marina': {'look': L(name='Marina', body={'chest': .55, 'hips': 1.06}, skin='#8A5A3A', hair='#1E1A22', eyes='#3A2A1A',
                      wear={'hair': 'hair_curly', 'eyes': 'eyes_lashes', 'brows': 'brows_arched', 'mouth': 'mouth_smile', 'top': 'crop', 'outer': 'denim_jacket', 'bottom': 'shorts', 'shoes': 'sandals', 'glasses': 'glasses_sun', 'neck': 'chain'},
                      colors={'crop': ['#3AA8C8'], 'denim_jacket': ['#F4F2EC', '#C8CED3'], 'shorts': ['#F2C14E'], 'chain': ['#E8C24A']})},
 'coral': {'look': L(name='Coral', body={'chest': .5, 'hips': 1.04}, skin='#F0C3A0', hair='#C85A3A', eyes='#3F8A63',
                     wear={'hair': 'hair_bob', 'top': 'polo', 'bottom': 'chinos', 'shoes': 'sandals', 'mouth': 'mouth_smile', 'neck': 'nametag', 'hat': 'hat_bucket'},
                     colors={'polo': ['#E86A5A'], 'chinos': ['#F2EEDC'], 'hat_bucket': ['#F4F2EC']})},
 'sven': {'look': L(name='Sven', body={'chest': 0, 'shoulders': 1.12, 'body': 1.08}, skin='#F3C79C', hair='#C9A24A', eyes='#4A7BBB',
                    wear={'hair': 'hair_short', 'facial': 'facial_beard', 'top': 'sweater', 'outer': 'apron', 'bottom': 'work_pants', 'shoes': 'boots', 'hat': 'hat_beanie', 'mouth': 'mouth_grin'},
                    colors={'sweater': ['#C8323C'], 'apron': ['#6E4B2E', '#48301C'], 'hat_beanie': ['#F4F2EC']})},
 'hiker': {'look': L(name='Hal', body={'chest': 0, 'height': 1.02}, skin='#C98E66', hair='#3A2A22', eyes='#5A3A24',
                     wear={'hair': 'hair_short', 'facial': 'facial_stubble', 'top': 'tee', 'outer': 'puffer', 'bottom': 'cargo', 'shoes': 'boots', 'hat': 'hat_beanie', 'bag': 'backpack'},
                     colors={'puffer': ['#E8702A', '#B85512'], 'cargo': ['#5A6270'], 'hat_beanie': ['#2A9D8F'], 'backpack': ['#3E8A6E']})},
 'diver': {'look': L(name='Dee', body={'chest': .45}, skin='#D9A07A', hair='#1E1A22', eyes='#3A2A1A',
                     wear={'hair': 'hair_pony', 'top': 'tank', 'bottom': 'shorts', 'shoes': 'sandals', 'glasses': 'glasses_sun', 'mouth': 'mouth_grin'},
                     colors={'tank': ['#2A9DC8'], 'shorts': ['#1E2A4E']})},
 'geo': {'look': L(name='Gail', body={'chest': .45, 'height': .98}, skin='#F0BE94', hair='#6A3A22', eyes='#3F8A63',
                   wear={'hair': 'hair_bun', 'top': 'longsleeve', 'outer': 'labcoat', 'bottom': 'work_pants', 'shoes': 'boots', 'hat': 'hat_hardhat', 'glasses': 'glasses_square'},
                   colors={'longsleeve': ['#C85A3A'], 'work_pants': ['#4A5260'], 'hat_hardhat': ['#F4C542', '#B9801C']})},
 'skipper': {'look': L(name='Sam', body={'chest': 0, 'body': 1.1}, skin='#E8B48A', hair='#E8E4DA', eyes='#4A7BBB',
                       wear={'hair': 'hair_short', 'facial': 'facial_beard', 'top': 'tee_stripe', 'bottom': 'chinos', 'shoes': 'boots', 'hat': 'hat_cap', 'mouth': 'mouth_grin'},
                       colors={'tee_stripe': ['#F4F2EC', '#2E3A6A'], 'chinos': ['#2E3A6A'], 'hat_cap': ['#F4F2EC', '#2E3A6A']})},
}


def T(name, who, area, node, team, reward, lines, win, lose, hint, seat=None, egg=5):
    d = dict(name=name, who=who, area=area, node=node, blocks=False, team=[{'sp': s, 'lvl': l} for s, l in team], reward=reward, egg=egg, market=None,
             lines=lines, win=win, lose=lose, hint=hint)
    if seat: d['seat'] = seat
    return d


def data():
    head, D = load()
    names = {r['name']: i for i, r in enumerate(D['route'])}
    for st in NEW_STOPS:
        if st['name'] in names: continue
        D['route'].append(dict(st)); names[st['name']] = len(D['route']) - 1
    have = {(min(a, b), max(a, b)) for a, b, *_ in D['links']}
    for a, b, c in NEW_LINKS:
        i, j = names[a], names[b]
        if (min(i, j), max(i, j)) not in have: D['links'].append([i, j, c])
    for k, v in NEW_POOLS.items(): D['pools'].setdefault(k, v)
    for k, v in NEW_BACKDROPS.items(): D['backdrops'].setdefault(k, v)
    for k, v in NEW_SHOPS.items(): D['shops'].setdefault(k, v)
    for k, v in NEW_PEOPLE.items(): D['people'].setdefault(k, v)
    n = names
    TR = {
     'alta': T('Leader Alta', 'alta', 'snow', n['Summit Capital'], [('trend1', 25), ('ball1', 25), ('logo1', 26), ('box1', 26)], 3000,
               ['“Welcome to the top. The air is thin and so is my patience.”', '“My Flying team has never once looked down.”'],
               '“You climbed higher than I thought. The Flying Badge is yours.”', '“Gravity always wins. Come back when you can fly.”',
               'Leader Alta’s Flying team is level 25–26. Electric and Steel moves knock Flying billionaires out of the sky.',
               {'id': 'peak', 'title': 'Flying Badge · 3 of 8', 'coin': 'gold', 'coins': {'gold': 3, 'tbtf': 1}, 'items': {'bailout': 2}, 'rewardText': '2 Bailouts, 3 Gold Coins and a Platinum Coin',
                'unlockText': 'Your team can now take on the island leader in Tax Haven, across the sea from Sundown.'}, egg=10),
     'marina': T('Leader Marina', 'marina', 'beach', n['Tax Haven'], [('goss1', 26), ('dial1', 27), ('short1', 27), ('ball1', 28)], 3400,
                 ['“Welcome to Tax Haven. Relax, nobody here asks questions.”', '“My Water team flows around every attack.”'],
                 '“Okay, you made a splash. The Water Badge is yours.”', '“Washed out! Come back when the tide turns.”',
                 'Leader Marina’s Water team is level 26–28. Grass and Electric moves soak them, and Fire barely makes them steam.',
                 {'id': 'haven', 'title': 'Water Badge · 4 of 8', 'coin': 'gold', 'coins': {'gold': 3, 'tbtf': 2}, 'items': {'parachute': 1}, 'rewardText': 'a Golden Parachute, 3 Gold Coins and 2 Platinum Coins',
                  'unlockText': 'The path up Mount Margin Call, on the north shore, is open. Bring water.'}, egg=10),
     'hiker': T('Hiker Hal', 'hiker', 'snow', n['Bull Run Pass'], [('box1', 19), ('comp1', 20)], 1200, ['“Nice day for a climb!”', '“My billionaires carry all my gear.”'],
                '“Phew. I need a cocoa.”', '“Ha! Altitude training pays off.”', 'Hiker Hal waits by the hut with a level 19–20 team.'),
     'diver': T('Diver Dee', 'diver', 'sea', n['The Offshore'], [('goss1', 20), ('short1', 21)], 1300, ['“Ahoy! Fancy a dip?”', '“My team found this sandbar. Finders keepers!”'],
                '“Sunk! Nice riding.”', '“Splash! Maybe stick to the shallows.”', 'Diver Dee suns herself on the sandbar with a level 20–21 team.'),
     'geo': T('Geologist Gail', 'geo', 'volcano', n['Mount Margin Call'], [('drill1', 24), ('hype1', 24), ('latte1', 25)], 1800, ['“Careful, the ground is literally melting.”', '“I study volcanoes. Mostly I study running away.”'],
              '“That was explosive. In a good way.”', '“Erupted! Take a breather.”', 'Geologist Gail measures the steam vents with a level 24–25 team.'),
     'skipper': T('Skipper Sam', 'skipper', 'lake', n['Liquidity Lake'], [('dial1', 18), ('goss1', 19)], 1100, ['“Welcome aboard! Er, I mean, a-lake.”', '“This lake is so liquid you can ride right across it.”'],
                  '“Man overboard! Well played.”', '“Ship shape! Better luck next voyage.”', 'Skipper Sam runs the floating market with a level 18–19 team.'),
    }
    for k, v in TR.items(): D['trainers'].setdefault(k, v)
    md = D['trainers'].get('markdown')
    if md and md.get('seat') and 'Meadowlands' in md['seat'].get('unlockText', ''):
        md['seat']['unlockText'] = 'Bull Run Pass, north of Capital Gains, is open, and the snowy town of Summit Capital beyond it. A billionaire big enough to ride can also carry you across Liquidity Lake and the sea west of Sundown.'
    D['rules'].setdefault('ride', {'minHeight': 1.5, 'types': ['Water']})
    save(head, D)
    print('route', len(D['route']), 'links', len(D['links']))


def biomes():
    """paints the new areas onto the stretched world: the island with its volcano and town, sandbars in the sea lane,
    a snowy mountain range with the pass and Summit Capital, and the lake (only where it's still plain land or sea)"""
    im = stretched().astype(np.int32).copy(); H, W, _ = im.shape        # always from the stretched v23 world, so it can be re-run
    lon = ((np.arange(W) + .5) / W * 360); lon = np.where(lon > 180, lon - 360, lon)
    lat = 90 - (np.arange(H) + .5) / H * 180
    LON, LAT = np.meshgrid(lon, lat)
    rng = np.random.default_rng(24)
    ph = rng.uniform(0, 6.3, 8)
    def noise(sc=1.):
        return (np.sin(LON * .9 * sc + ph[0]) * np.cos(LAT * 1.1 * sc + ph[1]) * .5 + np.sin((LON + LAT) * 1.7 * sc + ph[2]) * .3
                + np.sin(LON * 3.1 * sc - LAT * 2.3 * sc + ph[3]) * .2)
    N1, N2 = noise(1), noise(2.3)
    hash_ = rng.random((H, W))
    def dist(lo, la):
        dl = (LON - lo + 180) % 360 - 180
        return np.sqrt((dl * np.cos(np.radians(la))) ** 2 + (LAT - la) ** 2)
    def paint(mask, col):
        im[mask] = col
    COAST, SAND, SAND2, GRASS, GRASS2, FOREST, SEA = (152, 175, 177), (228, 194, 140), (214, 178, 122), (104, 170, 84), (136, 190, 98), (52, 116, 64), (47, 110, 183)
    SNOW, SNOW2, ROCK, ROCK2 = (232, 238, 246), (214, 222, 236), (150, 146, 152), (122, 118, 128)
    # --- the island (Tax Haven and Mount Margin Call)
    d = np.minimum(np.minimum(dist(-47, 1) / 6.2, dist(-42, -10) / 6.8), dist(-44.5, -4.5) / 5.4)
    d = d * (1 + .12 * N1 + .05 * N2)
    paint(d < 1.32, COAST); paint(d < 1.12, SAND); paint((d < 1.12) & (hash_ < .25), SAND2)
    inner = d < .92
    paint(inner, GRASS); paint(inner & (N2 > .25), GRASS2); paint(inner & (N1 < -.35), FOREST)
    v = dist(-47.5, 1.5)
    cone = v < 4.6 + .6 * N2
    paint(cone, (110, 98, 92)); paint(cone & (v < 3.4), (90, 80, 78)); paint(cone & (hash_ < .15), (70, 62, 62))
    ang = np.degrees(np.arctan2(LAT - 1.5, ((LON + 47.5 + 180) % 360 - 180)))
    streak = cone & (v > .9) & ((np.abs(((ang - 250) + 180) % 360 - 180) < 6 + 3 * N2) | (np.abs(((ang - 330) + 180) % 360 - 180) < 4))
    paint(streak, (226, 96, 44)); paint(streak & (hash_ < .3), (250, 160, 70))
    paint(v < 1.0, (250, 150, 60)); paint(v < .5, (255, 214, 120))
    t = dist(-41.5, -11.5)
    town = (t < 2.6) & (hash_ < .55)
    paint(town & (hash_ < .25), (240, 236, 226)); paint(town & (hash_ >= .25), (214, 112, 74))
    # --- sandbars along the sea lane
    for lo, la, r in ((-17.5, -3.5, .9), (-23.5, -8, 1.1), (-14, -9, .7), (-28, -3, .8)):
        e = dist(lo, la) / r * (1 + .15 * N2)
        paint(e < 1.6, COAST); paint(e < 1.0, SAND)
    # --- the mountain range around Bull Run Pass and Summit Capital: a chain of peaks, rock below and snow on top
    land = ~((im[..., 2] > im[..., 0] + 40) & (im[..., 2] > im[..., 1] + 20))
    prng = np.random.default_rng(7)
    best = np.full((H, W), 9.)
    for k in range(18):
        f = k / 17
        lo = 82 + 22 * f + prng.uniform(-4, 4); la = 33 + 31 * f + prng.uniform(-3, 3)
        if abs(lo - 90) < 2.5 and abs(la - 40.5) < 2.5: continue           # leave the pass itself a saddle
        r = prng.uniform(2.2, 3.8)
        best = np.minimum(best, dist(lo, la) / r)
    best = best * (1 + .1 * N2)
    m = land & (best < 1)
    paint(m & (best >= .8), FOREST); paint(m & (best < .8), ROCK); paint(m & (best < .75) & (hash_ < .3), ROCK2)
    paint(m & (best < .42 + .08 * N1), SNOW2); paint(m & (best < .3 + .06 * N1), SNOW); paint(m & (best < .14), (250, 252, 255))
    pas = dist(90, 40.5) < 1.4
    paint(pas & (hash_ < .5), (196, 186, 170))
    st = dist(97.5, 56.5)
    paint((st < 2.2) & (hash_ < .3), (170, 110, 70)); paint((st < 2.2) & (hash_ > .82), (120, 60, 56))
    # --- Liquidity Lake: make sure there's open water around the stop
    lk = dist(70, 56) * (1 + .1 * N2)
    paint((lk < 4.6) & ~((im[..., 2] > im[..., 0] + 40)), COAST); paint(lk < 3.8, (58, 128, 196))
    Image.fromarray(im.astype(np.uint8)).save(WORLD, optimize=True)
    print('painted the island, sandbars, mountains and lake')


if __name__ == '__main__':
    {'stretch': stretch, 'data': data, 'biomes': biomes}.get(sys.argv[1] if len(sys.argv) > 1 else '', lambda: print(__doc__))()
