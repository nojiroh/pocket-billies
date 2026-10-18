#!/usr/bin/env python3
"""v47 part 4: the seven regions become real places, built with the v46 place rules (tools/build-places-v46.py):
towns with a heart, streets and lanes; routes with a winding path, tall grass in drifts and one feature. Each region
brings its places (route nodes on the world map, near where the map has always shown the region), the roads between
them, wild billionaires for its ground, trainers, an arena leader, a shop, its people's looks, lore and what people say.
The region's "Unexplored" label on the map goes once its places exist.

  The Meadowlands   (badge 5, Leader Poppy, Grass)   Festival Fields · Twofold · Blossom Vale · the Mangrove Margins
                    Vinylla's fan festival is recruiting Variants in the wildflower fields east of the Mall; Twofold's
                    market is full of merch stalls Poppy never agreed to.
  Golden Hills      (badge 6, Baron Vault, Fire)     Vintage Rows · Bullion Hill · Flat Tax Flats · Bear Market Badlands
                    Vineyards over old stone vaults; the Baron has rented the vaults to Vinylla for her variants, and
                    himself along with them.
  Spore Forest      (badge 7, Mother Morel, Psychic)  Sporeholder Woods · Market Cap · Fall Quarter · Hypergrowth
                    Giant mushrooms puffing glittering spores, which the Variants grind into the record's coating.
  Crystal Caverns   (badge 8, Leader Carat, Electric) The Spread · Mintshaft · The Dark Pool · Frozen Assets
                    Crystal chasms crossed on rope bridges; the miners are cutting one perfect needle to play the sun.
  Coral Trench      (Cass Flow, Vinylla's manager)   Shell Company Shoals · Port Folio · Bottom Line Trench · The Pressing Plant
                    The inner sea; the trench is ridden on a Water billionaire to the pressing plant, where Cass knows your face.
  Cloud Spire       (Blake, then Vinylla)            The Server Farm · Upside City · Bubbleland · Upper Bracket Walk
                    The city at the foot of the tower, its night market, and the walk up through the clouds to her door.
  The Inner Sun     (Vinylla, the last battle)       All-Time High · The Closing Bell · The Inner Sun
                    The desert under the sun, the road past the bell, and the press. Win, and the ending plays.

Nothing of yours is touched: places are only added (a place marked "keep" in the Studio is never rebuilt), existing
route nodes keep their numbers, and a node, road, pool, trainer, look, shop or lore entry that already exists is left
as it is unless you pass --force (which rebuilds this tool's own places and rewrites its own entries).

    python3 tools/build-regions-v47.py                    # add every region's places and data (missing ones)
    python3 tools/build-regions-v47.py meadowlands        # just this region
    python3 tools/build-regions-v47.py --dry              # build and report, write nothing
    python3 tools/build-regions-v47.py --map out/         # also draw a top-down map of each new place
    python3 tools/build-regions-v47.py --force            # rebuild this tool's places and rewrite its entries
"""
import gamedata  # phase 04b: the data files in game/data
import copy, importlib.util, json, math, random, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('bp46', ROOT / 'tools' / 'build-places-v46.py'); BP = importlib.util.module_from_spec(spec); spec.loader.exec_module(BP)
B = BP.B
Place, exits_for, connect, frange, AV, SOFT, LEAFY, UNDER, TOWN_TREES = BP.Place, BP.exits_for, BP.connect, BP.frange, BP.AV, BP.SOFT, BP.LEAFY, BP.UNDER, BP.TOWN_TREES
ROUTE_SIZE = BP.ROUTE_SIZE
TAG = 'v47region'

# tall grass may also stand on the v47 sunburnt grass (B), so the golden hills and the badlands' grassy patches get
# their drifts; nothing else about what counts as soft ground changes (gardens, wild growth)
_drifts = Place.drifts


def _drifts_b(self, *a, **k):
    old = BP.SOFT; BP.SOFT = old + 'B'
    try: return _drifts(self, *a, **k)
    finally: BP.SOFT = old


Place.drifts = _drifts_b

# the wild growth (tools/build-places-v46.py's nature pool) learns the v47 ground: sunburnt grass grows what gravel does
# (dry grass, thistles, rosemary, olives, cypresses), sun-baked stone and gold-veined rock what sand does, the wildflower
# meadow what the meadow does; dry earth (the paths of the flats and the festival ground), salt crust, ice, clouds, tide
# pools and concrete stay bare
BP.NEWLET.update({'B': 'v', 'Y': 's', 'W': 's', 'E': 'G'})


# ================================================================================================ the regions
LOOK = {
    # pink and teal pastures: the grass blades go from teal at the root to pink at the tip
    'meadow': dict(sky=['#86C6EE', '#C8E6F2', '#FBE4EE'], haze='#E8E2E8', hazeD=46, amb='pollen', far='hills', farH=8, grassCol=['#2F9C92', '#F4A6CF'], wind=1.1),
    'petalfall': dict(sky=['#8AC2EA', '#D2E6F2', '#FCE6EE'], haze='#EAE2E8', hazeD=42, amb='pollen', far='forest', farH=8, grassCol=['#3D9A84', '#E9B4D2'], rays=1),
    'mangrove': dict(sky=['#7FB6D2', '#B8D8DC', '#E6EAD4'], haze='#D2DCCE', hazeD=34, amb='spore', far='forest', farH=9, grassCol=['#2C7C6E', '#9FC9A6']),
    'twinpetal': dict(sky=['#8AC8EE', '#C6E6F2', '#FCE8E2'], haze='#ECE4E2', hazeD=46, amb='pollen', far='farm', farH=8, grassCol=['#2F9C92', '#F4A6CF'], wind=1.0),
}

MEADOWLANDS = dict(
    id='meadowlands', future='The Meadowlands', t='feedl', mood='bloom',
    moods={'bloom': {'name': 'In bloom', 'sat': 1.1, 'con': 1.0, 'warm': .12, 'lift': [.016, .008, .014], 'gain': [.02, 0, .012], 'sh': [0, .012, .02], 'hi': [.028, .006, .016]}},
    nodes=[
        dict(id='fanfare_fields', name='Festival Fields', kind='route', lon=136.6, lat=5.2, pool='fanfare_fields', biome='meadow', area='grass', route='Route 8', music='variants',
             blurb='Wildflower fields east of the Mall, where Vinylla’s fan festival never ends and the merch never runs out.',
             gate='haven', gateText='The road east of the Mall of the Deep opens once you hold all four badges of the ring: the last is Leader Marina’s Water Badge, in Tax Haven.'),
        dict(id='twinpetal', name='Twofold', kind='town', lon=145.4, lat=13.4, pool='twinpetal', biome='town', area='grass', route='Route 8', shop='twinpetal', music='meadow',
             blurb='A market village where everything grows back twice as fast. The merch stalls arrived on their own.'),
        dict(id='petalfall', name='Blossom Vale', kind='route', lon=139.6, lat=23.0, pool='petalfall', biome='blossom', area='golf', route='Petal Path', music='meadow',
             blurb='A valley of cherry trees by a stream. The petals fall all year, and somebody sweeps them all year.'),
        dict(id='rootwater', name='Mangrove Margins', kind='route', lon=154.2, lat=2.6, pool='rootwater', biome='mangrove', area='golf', route='Route 9', music='meadow',
             blurb='Boardwalks through a mangrove swamp at the edge of the Meadowlands. The margins are thin here.',
             gate='bloom', gateText='The boardwalks south-east of Twofold open once you earn Leader Poppy’s Grass Badge.'),
    ],
    links=[('lanternhall', 'fanfare_fields', 2600, 'Route 8'), ('fanfare_fields', 'twinpetal', 1500, 'Route 8'), ('twinpetal', 'petalfall', 1300, 'Petal Path'),
           ('petalfall', 'fanfare_fields', 1400, 'Petal Path'), ('twinpetal', 'rootwater', 1700, 'Route 9')],
    pools={
        'fanfare_fields': {'lv': [32, 36], 'list': [['bloomberg1', 30], ['jayz0', 30], ['dorsey1', 20], ['son1', 15], ['ek1', 15], ['hastings0', 8]]},
        'twinpetal': {'lv': [32, 35], 'list': [['jobs0', 30], ['woods0', 30], ['ortega1', 25], ['bloomberg1', 15]]},
        'petalfall': {'lv': [33, 37], 'list': [['jobs1', 30], ['jayz0', 25], ['hughes1', 25], ['dell0', 12], ['scott0', 8]]},
        'rootwater': {'lv': [35, 39], 'list': [['ek1', 30], ['spielberg0', 25], ['yanai1', 25], ['forrest0', 12], ['federer0', 8]]},
    },
    people={
        'poppy': {'name': 'Leader Poppy', 'look': {'name': 'Poppy', 'body': {'height': .98, 'legs': 1.0, 'shoulders': .96, 'chest': .4}, 'skin': '#E9B897', 'hair': '#E25C3A', 'eyes': '#3E8A5A',
                  'wear': {'hair': 'hair_bun', 'eyes': 'eyes_round', 'brows': 'brows_soft', 'mouth': 'mouth_smile', 'facial': 'facial_freckles', 'top': 'tee', 'outer': 'apron', 'bottom': 'jeans',
                           'shoes': 'boots', 'hat': 'hat_bucket'},
                  'colors': {'tee': ['#F4D6E4'], 'apron': ['#5FAE6E', '#F2EEE4'], 'jeans': ['#4F6FA8', '#3A5280'], 'boots': ['#6A4A32', '#4A3220'], 'hat_bucket': ['#E9C46A', '#E25C3A']}}},
        'variant': {'name': 'Variant', 'look': {'name': 'Variant', 'body': {'height': 1.0, 'legs': 1.0, 'shoulders': 1.0, 'chest': 0}, 'skin': '#E2B08C', 'hair': '#2A2230', 'eyes': '#5A4A3A',
                    'wear': {'hair': 'hair_short', 'eyes': 'eyes_round', 'brows': 'brows_soft', 'mouth': 'mouth_grin', 'top': 'tee', 'outer': 'denim_jacket', 'bottom': 'jeans', 'shoes': 'runners',
                             'glasses': 'glasses_sun', 'neck': 'nametag'},
                    'colors': {'tee': ['#2A2434'], 'denim_jacket': ['#E9B83C', '#B88A1E'], 'jeans': ['#2E3240', '#1E2230'], 'runners': ['#E9B83C', '#F2EEE4'], 'glasses_sun': ['#1E1A26'], 'nametag': ['#E9B83C']}}},
    },
    trainers={
        'poppy': {'name': 'Leader Poppy', 'who': 'poppy', 'battleStage': 'grass', 'node': 'twinpetal', 'blocks': False,
                  'team': [{'sp': 'bloomberg1', 'lvl': 36}, {'sp': 'jobs1', 'lvl': 36}, {'sp': 'forrest0', 'lvl': 37}, {'sp': 'ortega2', 'lvl': 38}], 'reward': 3600, 'egg': 10, 'market': None,
                  'lines': ['“Everything here grows back twice as fast. Including my temper, since the merch stalls arrived.”', '“Let’s see if your team blooms under pressure.”'],
                  'win': '“You grew on me. Twice as fast. The Grass Badge is yours.”', 'lose': '“Pull yourself up and plant again. Everything here grows back.”',
                  'hint': 'Leader Poppy’s Grass team is level 36–38. Fire and Flying moves wilt Grass billionaires.',
                  'seat': {'id': 'bloom', 'title': 'Grass Badge · 5 of 8', 'coin': 'gold', 'coins': {'gold': 3, 'tbtf': 2}, 'items': {'bailout': 2},
                           'rewardText': '2 Bailouts, 3 Gold Coins and 2 Platinum Coins', 'unlockText': 'The boardwalks of the Mangrove Margins, south-east of Twofold, are open.'}},
        'variant_fest1': {'name': 'Variant No. 4471', 'who': 'variant', 'battleStage': 'grass', 'node': 'fanfare_fields', 'blocks': False,
                          'team': [{'sp': 'jayz0', 'lvl': 33}, {'sp': 'dorsey1', 'lvl': 34}], 'reward': 900, 'market': None,
                          'lines': ['“I bought the festival ticket, the upgrade, the upgrade to the upgrade and the shirt that says I did.”'],
                          'win': '“That’s fine. I have a variant of that loss at home.”', 'lose': '“Collect them all! Especially the losses.”', 'hint': ''},
        'variant_fest2': {'name': 'Variant No. 0007', 'who': 'variant', 'battleStage': 'grass', 'node': 'fanfare_fields', 'blocks': False,
                          'team': [{'sp': 'son1', 'lvl': 34}, {'sp': 'bloomberg1', 'lvl': 34}, {'sp': 'ek1', 'lvl': 35}], 'reward': 1100, 'market': None,
                          'lines': ['“Low number, see? I was a fan before it was limited.”'],
                          'win': '“You don’t get it. Scarcity is the point.”', 'lose': '“Sold out. Like you.”', 'hint': ''},
        'gardener': {'name': 'Gardener Gus', 'who': 'hiker', 'battleStage': 'grass', 'node': 'petalfall', 'blocks': False,
                     'team': [{'sp': 'jobs1', 'lvl': 35}, {'sp': 'woods1', 'lvl': 35}], 'reward': 800, 'market': None,
                     'lines': ['“I sweep the petals every morning. They fall again by lunch. I think that’s the job.”'],
                     'win': '“Blown away. Like the petals.”', 'lose': '“Back to sweeping, then.”', 'hint': ''},
        'birder': {'name': 'Birdwatcher Bo', 'who': 'skipper', 'battleStage': 'golf', 'node': 'rootwater', 'blocks': False,
                   'team': [{'sp': 'hughes1', 'lvl': 37}, {'sp': 'ellison1', 'lvl': 37}, {'sp': 'kashing1', 'lvl': 38}], 'reward': 1000, 'market': None,
                   'lines': ['“Shh. A Kashingcrane. They only nest where the harbour fees are low.”'],
                   'win': '“Flew the coop.”', 'lose': '“Spotted you a mile off.”', 'hint': ''},
    },
    shops={'twinpetal': {'name': 'Twofold Market', 'keeper': 'Marta', 'who': 'chef', 'greeting': 'Everything grows back twice as fast here. The prices too.',
                       'stock': [{'item': 'pretzel', 'price': 60}, {'item': 'trailmix', 'price': 220}, {'item': 'taxbreak', 'price': 140}, {'item': 'loophole', 'price': 400}, {'item': 'bailout', 'price': 900}]}},
    lore={
        'fanfare_fields': {'history': 'Pasture until last spring, when Vinylla’s people rented it for a weekend. The weekend has not ended.',
                     'known': 'The fan festival: the stage, the merch, the Variants in their gold jackets.', 'landmark': 'The stage, where Vinylla has never once appeared in person.',
                     'legend': 'They say the encore is scheduled for the day the Inner Sun goes out.'},
        'twinpetal': {'history': 'A market village since before the sinkholes. Everything here grows back twice as fast, which is how it got its name and its problems.',
                    'known': 'Its market, its flowers, and Leader Poppy’s greenhouse arena.', 'landmark': 'The sunflower that was cut down once and grew back twice as tall.',
                    'legend': 'Plant a coin in Twofold and two grow back. Nobody has managed it, but everyone has tried.'},
        'petalfall': {'history': 'A quiet valley of cherry trees that flower all year round.', 'known': 'The petals, the stream, and the man who sweeps them.',
                    'landmark': 'The great cherry by the stream, older than anyone has counted.', 'legend': 'If a petal lands in your hand, you will forget a debt. Nobody says whose.'},
        'rootwater': {'history': 'The edge of the Meadowlands, where the pastures turn to mangroves and boardwalks.', 'known': 'Boardwalks, birdwatchers and very patient frogs.',
                    'landmark': 'The hut on stilts, where the warden lived before the warden was outsourced.', 'legend': 'The tide here only comes in on payday.'},
    },
    chat={
        'twinpetal': {'0': ['Everything grows back twice as fast here. Weeds included.', 'Those merch stalls appeared overnight. Like mushrooms, but with prices.',
                          'Leader Poppy grows her team in the greenhouse. Don’t touch the glass.', 'Cut the sunflower once and it came back twice as tall. We stopped cutting it.',
                          'The Variants keep asking which of us is limited edition.']},
        'fanfare_fields': {'0': ['It’s been one long weekend for months.', 'The stage lights never go off. Neither does the merch stall.', 'Vinylla is on next! She has been on next since spring.']},
    },
    story_note='The Meadowlands: Vinylla’s fan festival recruits Variants; Poppy’s Grass Badge opens the way on to Golden Hills.',
)

LOOK.update({
    'grapevine_hills': dict(sky=['#8CC2E6', '#D4E2E6', '#F8E6C4'], haze='#E8E2D2', hazeD=60, amb='pollen', far='hills', farH=8, grassCol=['#7C7A34', '#E8CC6A'], wind=1.1),
    'goldvine': dict(sky=['#8CC2E6', '#D2E0E4', '#F8E4C0'], haze='#E8E0CE', hazeD=58, amb='pollen', far='hills', farH=8, grassCol=['#7C7A34', '#E8CC6A'], wind=1.0),
    'saltpan_flats': dict(sky=['#8EC4EA', '#D2E6F2', '#F2F0EA'], haze='#D8E4EE', hazeD=62, amb='sand', far='hills', farH=6, grassCol=['#8A8044', '#E4D488'], wind=1.3),
    'badlands': dict(sky=['#86BEE6', '#D6DCD8', '#F2D8B8'], haze='#E6D0B6', hazeD=54, amb='sand', far='canyon', farH=9, grassCol=['#7A6A30', '#C8A860'], wind=1.2),
})

GOLDEN_HILLS = dict(
    id='goldenhills', future='Golden Hills', t='vault', mood='gilded',
    moods={'gilded': {'name': 'Gilded', 'sat': 1.04, 'con': 1.03, 'warm': .24, 'lift': [.012, .008, 0], 'gain': [.02, .01, -.012], 'sh': [.008, .002, .014], 'hi': [.024, .016, -.01]}},
    nodes=[
        dict(id='grapevine_hills', name='Vintage Rows', kind='route', lon=162.0, lat=9.0, pool='grapevine_hills', biome='vineyard', area='esc', route='Route 9', music='hills',
             blurb='Vineyards on sunburnt hills. Under the rows are the old stone vaults, and in the vaults are Vinylla’s variants.'),
        dict(id='goldvine', name='Bullion Hill', kind='town', lon=170.5, lat=10.0, pool='goldvine', biome='town', area='esc', route='Route 9', shop='goldvine', music='hills',
             blurb='A vineyard estate with vaults under every hill. Baron Vault owns all of it, and has rented all of it out.'),
        dict(id='saltpan_flats', name='Flat Tax Flats', kind='route', lon=166.6, lat=-4.6, pool='saltpan_flats', biome='saltflat', area='esc', route='Salt Road', music='hills',
             blurb='Salt flats as far as you can see, and one tollbooth in the middle of them. Everyone pays the same.'),
        dict(id='badlands', name='Bear Market Badlands', kind='route', lon=179.4, lat=9.5, pool='badlands', biome='badlands', area='esc', route='Route 10', music='hills',
             blurb='Red rock and old mines. The big rock that looks like a sleeping bear has been asleep for a very long time.',
             gate='vault', gateText='The badlands east of Bullion Hill open once you earn Baron Vault’s Fire Badge.'),
    ],
    links=[('rootwater', 'grapevine_hills', 1600, 'Route 9'), ('grapevine_hills', 'goldvine', 1500, 'Route 9'), ('goldvine', 'saltpan_flats', 1400, 'Salt Road'),
           ('saltpan_flats', 'grapevine_hills', 1500, 'Salt Road'), ('goldvine', 'badlands', 1700, 'Route 10')],
    pools={
        'grapevine_hills': {'lv': [36, 40], 'list': [['lauren1', 30], ['mateschitz0', 25], ['hershey0', 20], ['schultz0', 15], ['kroc1', 15], ['jayz1', 8]]},
        'goldvine': {'lv': [36, 39], 'list': [['carnegie1', 30], ['walton1', 25], ['saylor1', 25], ['ambani1', 15]]},
        'saltpan_flats': {'lv': [37, 41], 'list': [['rinehart1', 30], ['dangote1', 25], ['saylor1', 20], ['dalio0', 12], ['griffin0', 8]]},
        'badlands': {'lv': [39, 43], 'list': [['ford2', 25], ['kroc2', 20], ['ambani1', 25], ['carnegie2', 10], ['mittal0', 10], ['ballmer0', 10]]},
    },
    people={
        'vault': {'look': {'name': 'Baron Vault', 'body': {'height': 1.08, 'legs': .96, 'shoulders': 1.08, 'chest': 0, 'body': 1.2}, 'skin': '#E9B897', 'hair': '#D8D4CC', 'eyes': '#6A4A2A',
                  'wear': {'hair': 'hair_sidepart', 'eyes': 'eyes_sleepy', 'brows': 'brows_thick', 'mouth': 'mouth_smirk', 'facial': 'facial_stache', 'top': 'dress_shirt', 'outer': 'blazer',
                           'bottom': 'trousers', 'shoes': 'oxfords', 'hat': 'hat_tophat', 'glasses': 'glasses_monocle', 'neck': 'chain'},
                  'colors': {'dress_shirt': ['#F4F0E4'], 'blazer': ['#7A2A3A', '#E8B83C'], 'trousers': ['#2A2430'], 'oxfords': ['#3A2418'], 'hat_tophat': ['#1E1A24', '#E8B83C'], 'chain': ['#E8B83C']}}},
    },
    trainers={
        'vault': {'name': 'Baron Vault', 'who': 'vault', 'battleStage': 'esc', 'node': 'goldvine', 'blocks': False,
                  'team': [{'sp': 'ma1', 'lvl': 41}, {'sp': 'mittal0', 'lvl': 41}, {'sp': 'kroc2', 'lvl': 42}, {'sp': 'ma2', 'lvl': 43}], 'reward': 4200, 'egg': 10, 'market': None,
                  'lines': ['“Welcome to Bullion Hill. Everything you can see is mine, and everything you can’t see is in a vault, and also mine.”',
                            '“I rented the vaults to a pop star. And myself, as it turns out. Read the small print, child.”'],
                  'win': '“Burned. Take the Fire Badge. I’ll invoice you for it later.”', 'lose': '“Money talks. Mine just won the argument.”',
                  'hint': 'Baron Vault’s Fire team is level 41–43. Water and Ground moves put Fire billionaires out.',
                  'seat': {'id': 'vault', 'title': 'Fire Badge · 6 of 8', 'coin': 'gold', 'coins': {'gold': 4, 'tbtf': 2}, 'items': {'parachute': 1},
                           'rewardText': 'a Golden Parachute, 4 Gold Coins and 2 Platinum Coins', 'unlockText': 'The Bear Market Badlands, east of Bullion Hill, are open.'}},
        'variant_vault': {'name': 'Variant No. 1001', 'who': 'variant', 'battleStage': 'esc', 'node': 'grapevine_hills', 'blocks': False,
                          'team': [{'sp': 'jayz1', 'lvl': 38}, {'sp': 'mateschitz1', 'lvl': 39}], 'reward': 1200, 'market': None,
                          'lines': ['“These vaults are full of variants. Vinyl ones. Of the same record. You wouldn’t understand.”'],
                          'win': '“My collection is incomplete without that loss.”', 'lose': '“Mint condition. Unlike your team.”', 'hint': ''},
        'sommelier': {'name': 'Sommelier Sabine', 'who': 'concierge', 'battleStage': 'esc', 'node': 'grapevine_hills', 'blocks': False,
                      'team': [{'sp': 'schultz0', 'lvl': 39}, {'sp': 'hershey0', 'lvl': 39}], 'reward': 1000, 'market': None,
                      'lines': ['“Notes of oak, leather and a very aggressive pricing strategy.”'],
                      'win': '“A bold finish. Bolder than mine.”', 'lose': '“You were corked.”', 'hint': ''},
        'accountant': {'name': 'Accountant Al', 'who': 'broker', 'battleStage': 'esc', 'node': 'saltpan_flats', 'blocks': False,
                       'team': [{'sp': 'dalio0', 'lvl': 40}, {'sp': 'saylor1', 'lvl': 40}, {'sp': 'griffin0', 'lvl': 41}], 'reward': 1300, 'market': None,
                       'lines': ['“Flat tax! Everyone pays the same. I have a form explaining why that’s fair. It’s very long.”'],
                       'win': '“I’ll claim that as a loss.”', 'lose': '“Deducted.”', 'hint': ''},
        'prospector': {'name': 'Prospector Pete', 'who': 'miner', 'battleStage': 'esc', 'node': 'badlands', 'blocks': False,
                       'team': [{'sp': 'rinehart1', 'lvl': 41}, {'sp': 'ford2', 'lvl': 42}], 'reward': 1300, 'market': None,
                       'lines': ['“Struck gold in ’98. Struck it again in ’99. It was the same gold. I keep losing it.”'],
                       'win': '“Bust!”', 'lose': '“Pay dirt.”', 'hint': ''},
    },
    shops={'goldvine': {'name': 'Bullion Exchange', 'keeper': 'Goldie', 'who': 'cashier', 'greeting': 'Gold, silver and everything priced in both. Mostly gold.',
                       'stock': [{'item': 'pretzel', 'price': 60}, {'item': 'trailmix', 'price': 220}, {'item': 'taxbreak', 'price': 140}, {'item': 'loophole', 'price': 400},
                                 {'item': 'bailout', 'price': 900}, {'item': 'parachute', 'price': 2400}]}},
    lore={
        'grapevine_hills': {'history': 'Vineyards since before the sinkholes, planted over vaults older than that.', 'known': 'Wine nobody can afford, and the round steel doors in the hillsides.',
                    'landmark': 'The vault door with a gold V on its wheel. Vinylla’s, now.', 'legend': 'One vault is said to hold the first coin ever spent in the Hollow Earth. It was spent again on the rent.'},
        'goldvine': {'history': 'Baron Vault’s estate, and the village that grew up to polish it.', 'known': 'The golden bull, the manor, and vaults under every hill.',
                    'landmark': 'The golden bull on the square, charging at nothing in particular.', 'legend': 'The bull is hollow. What is inside it is a matter for the Baron’s lawyers.'},
        'saltpan_flats': {'history': 'Salt flats where the Baron collects a toll from everyone who crosses, at the same rate, however much they have.', 'known': 'Salt, glare, and the tollbooth.',
                    'landmark': 'The tollbooth in the middle of the flats, its barrier across nothing at all.', 'legend': 'Nobody has ever seen the toll collector. The toll is always collected.'},
        'badlands': {'history': 'Red rock country, mined out twice and abandoned three times.', 'known': 'Old mine shafts, carts on rusty rails, and Bear Rock.',
                     'landmark': 'Bear Rock, a red stone bear asleep on its paws.', 'legend': 'When Bear Rock wakes up, everything will be cheap again. Everyone is waiting.'},
    },
    chat={
        'goldvine': {'0': ['Don’t touch the bull. It’s insured for more than the village.', 'The Baron rented out the vaults. Then the manor. Then himself.',
                          'Every hill here has a vault under it. Some vaults have hills in them.', 'The wine is very good. We are not allowed to drink it.',
                          'The Variants keep the vault doors shut. Something in there hums.']},
        'grapevine_hills': {'0': ['Each row is a vintage. Each vintage is limited. You can see where this is going.']},
    },
)

LOOK.update({
    'spore': dict(sky=['#8AA6D8', '#C8C0E6', '#F0D8E6'], haze='#D2CCE0', hazeD=46, amb='spore', far='forest', farH=10, grassCol=['#3C6A68', '#B8E0C8'], rays=1),
    'capvillage': dict(sky=['#8AA8DC', '#CCC4E6', '#F2DCE6'], haze='#D6D0E2', hazeD=50, amb='spore', far='forest', farH=10, grassCol=['#3C6A68', '#B8E0C8']),
    'fall': dict(sky=['#8CB8E0', '#D8D8D0', '#F4DCC0'], haze='#E2D6C8', hazeD=52, amb='pollen', far='forest', farH=9, grassCol=['#6A6A30', '#D8A850'], wind=1.2),
    'jungle': dict(sky=['#7EB8D8', '#C4E0D8', '#E8EED4'], haze='#C6D8C8', hazeD=40, amb='spore', far='forest', farH=11, grassCol=['#2C6A3C', '#8CC86A'], rays=1),
})

SPORE_FOREST = dict(
    id='sporeforest', future='Spore Forest', t='spore', mood='glow',
    moods={},
    nodes=[
        dict(id='puffcap', name='Sporeholder Woods', kind='route', lon=187.6, lat=8.6, pool='puffcap', biome='spore', area='shell', route='Route 10', music='spore',
             blurb='A wood of giant mushrooms puffing glittering spores. The Variants have built a mill in it.'),
        dict(id='capshade', name='Market Cap', kind='town', lon=195.2, lat=16.6, pool='capshade', biome='town', area='shell', route='Route 10', shop='capshade', music='spore',
             blurb='A village in and under the mushrooms, round one mushroom so big it has a door. Its value goes up and down with the spores.'),
        dict(id='russetwood', name='Fall Quarter', kind='route', lon=191.0, lat=26.4, pool='russetwood', biome='autumn', area='shell', route='Leaf Lane', music='spore', mood='harvest',
             blurb='A wood where it is always autumn. The leaves fall every quarter, on schedule.'),
        dict(id='tanglewild', name='Hypergrowth', kind='route', lon=203.6, lat=6.2, pool='tanglewild', biome='jungle', area='shell', route='Route 11', music='spore', mood='green',
             blurb='A jungle that grew over a start-up campus in a single quarter. It is still growing. So, they say, is the start-up.',
             gate='morel', gateText='The jungle east of Market Cap opens once you earn Mother Morel’s Psychic Badge.'),
    ],
    links=[('badlands', 'puffcap', 1600, 'Route 10'), ('puffcap', 'capshade', 1500, 'Route 10'), ('capshade', 'russetwood', 1300, 'Leaf Lane'),
           ('russetwood', 'puffcap', 1400, 'Leaf Lane'), ('capshade', 'tanglewild', 1700, 'Route 11')],
    pools={
        'puffcap': {'lv': [40, 44], 'list': [['jobs1', 30], ['thiel0', 25], ['pagebrin0', 20], ['hastings0', 12], ['son1', 15], ['altman0', 6]]},
        'capshade': {'lv': [40, 43], 'list': [['thiel1', 25], ['pagebrin1', 25], ['son1', 25], ['buterin1', 15]]},
        'russetwood': {'lv': [41, 45], 'list': [['woods1', 30], ['lauren1', 25], ['kamprad1', 20], ['forrest0', 15], ['dell0', 10]]},
        'tanglewild': {'lv': [43, 47], 'list': [['yiming0', 25], ['ortega2', 20], ['bloomberg2', 20], ['jobs2', 10], ['dell0', 15], ['altman0', 10]]},
    },
    people={
        'morel': {'look': {'name': 'Mother Morel', 'body': {'height': .96, 'legs': .98, 'shoulders': .96, 'chest': .4, 'body': 1.1}, 'skin': '#D9A07C', 'hair': '#B8C4B4', 'eyes': '#6A4A8A',
                  'wear': {'hair': 'hair_long', 'eyes': 'eyes_sleepy', 'brows': 'brows_arched', 'mouth': 'mouth_smile', 'top': 'tunic', 'outer': 'trench', 'bottom': 'skirt',
                           'shoes': 'sandals', 'hat': 'hat_bucket', 'glasses': 'glasses_round', 'neck': 'scarf'},
                  'colors': {'tunic': ['#7A5A9A'], 'trench': ['#5A4A3A', '#3A2A1E'], 'skirt': ['#4A6A4A'], 'sandals': ['#6A4A32'], 'hat_bucket': ['#C64A56', '#F2E8DC'], 'scarf': ['#B8E0C8']}}},
    },
    trainers={
        'morel': {'name': 'Mother Morel', 'who': 'morel', 'battleStage': 'shell', 'node': 'capshade', 'blocks': False,
                  'team': [{'sp': 'jobs2', 'lvl': 46}, {'sp': 'thiel1', 'lvl': 46}, {'sp': 'pagebrin1', 'lvl': 47}, {'sp': 'altman0', 'lvl': 48}], 'reward': 4800, 'egg': 10, 'market': None,
                  'lines': ['“The forest remembers every spore. The Variants are grinding up its memory to make a record shine.”', '“Breathe in. Now battle.”'],
                  'win': '“The forest thanks you. It will not say so; it is a forest. The Psychic Badge is yours.”', 'lose': '“Rest. Rot a little. Grow back.”',
                  'hint': 'Mother Morel’s Psychic team is level 46–48. Steel and Dragon billionaires shrug off Psychic moves.',
                  'seat': {'id': 'morel', 'title': 'Psychic Badge · 7 of 8', 'coin': 'gold', 'coins': {'gold': 4, 'tbtf': 2}, 'items': {'bailout': 3},
                           'rewardText': '3 Bailouts, 4 Gold Coins and 2 Platinum Coins', 'unlockText': 'The jungle of Hypergrowth, east of Market Cap, is open.'}},
        'variant_spore': {'name': 'Variant No. 2048', 'who': 'variant', 'battleStage': 'shell', 'node': 'puffcap', 'blocks': False,
                          'team': [{'sp': 'son1', 'lvl': 42}, {'sp': 'hastings0', 'lvl': 43}], 'reward': 1300, 'market': None,
                          'lines': ['“Every spore we grind makes the record shine a little brighter. The forest doesn’t mind. We asked it. It didn’t answer.”'],
                          'win': '“Ground down.”', 'lose': '“Polished off.”', 'hint': ''},
        'forager': {'name': 'Forager Fern', 'who': 'girl', 'battleStage': 'shell', 'node': 'puffcap', 'blocks': False,
                    'team': [{'sp': 'jobs1', 'lvl': 41}, {'sp': 'pagebrin0', 'lvl': 42}], 'reward': 1100, 'market': None,
                    'lines': ['“Never eat a mushroom you can’t afford. Most of these cost more than you.”'],
                    'win': '“Picked clean.”', 'lose': '“Foraged!”', 'hint': ''},
        'peeper': {'name': 'Leaf Peeper Lou', 'who': 'hiker', 'battleStage': 'shell', 'node': 'russetwood', 'blocks': False,
                   'team': [{'sp': 'woods1', 'lvl': 43}, {'sp': 'kamprad1', 'lvl': 43}], 'reward': 1200, 'market': None,
                   'lines': ['“The leaves turn every quarter. I’ve been here forty quarters. I am leaving next quarter.”'],
                   'win': '“Turned over.”', 'lose': '“Fell for it.”', 'hint': ''},
        'founder': {'name': 'Founder Finn', 'who': 'intern', 'battleStage': 'shell', 'node': 'tanglewild', 'blocks': False,
                    'team': [{'sp': 'yiming0', 'lvl': 44}, {'sp': 'bloomberg2', 'lvl': 45}], 'reward': 1400, 'market': None,
                    'lines': ['“We’re pre-revenue. Pre-product. Pre-office, now the jungle has it. But the vision is huge.”'],
                    'win': '“That’s a pivot.”', 'lose': '“Disrupted!”', 'hint': ''},
    },
    shops={'capshade': {'name': 'Cap Market', 'keeper': 'Chanterelle', 'who': 'chef', 'greeting': 'Prices go up and down with the spores. Today they are up. They are always up today.',
                         'stock': [{'item': 'pretzel', 'price': 60}, {'item': 'trailmix', 'price': 220}, {'item': 'loophole', 'price': 400}, {'item': 'bailout', 'price': 900},
                                   {'item': 'parachute', 'price': 2400}]}},
    lore={
        'puffcap': {'history': 'An old wood of giant mushrooms, older than the trees above it.', 'known': 'Spores that glitter in the light, and the Variants’ mill.',
                      'landmark': 'The spore mill, where the forest is ground into the record’s shine.', 'legend': 'Breathe the spores and you will remember something that never happened to you. It will be a very good deal.'},
        'capshade': {'history': 'A village built in and under the mushrooms, round the one with a door.', 'known': 'Mushroom houses, treehouses, and Mother Morel.',
                      'landmark': 'The colossal mushroom, whose cap shades the whole square.', 'legend': 'The great mushroom is one creature, and every mushroom in the forest is a piece of it. It knows what everything is worth.'},
        'russetwood': {'history': 'A wood where the year stopped in autumn.', 'known': 'Leaves, leaves, and the Ledger Oak.',
                        'landmark': 'The Ledger Oak, which drops one golden leaf for every coin spent in the Hollow Earth.', 'legend': 'Under the Ledger Oak the leaves are never raked. It would upset the books.'},
        'tanglewild': {'history': 'A start-up campus, until the jungle grew over it in a single quarter.', 'known': 'Vines, heat, and a white statue nobody can quite see the point of.',
                        'landmark': 'The unicorn statue, worth a billion once, now a trellis.', 'legend': 'The founders are still in there somewhere, pivoting.'},
    },
    chat={
        'capshade': {'0': ['Don’t knock on the big mushroom. It knocks back.', 'Our houses grow a room a year. Mine grew a cellar by mistake.',
                            'Mother Morel says the spores remember. I hope not; I had a bad week.', 'The Variants pay well for spores. The forest has not been asked.',
                            'Market Cap goes up when the spores do. Breathe out, then.']},
        'puffcap': {'0': ['Hold your breath near the mill. The glitter gets everywhere.']},
    },
)

# ------------------------------------------------------------------------------------------------ Crystal Caverns
LOOK.update({
    'crystal': dict(sky=['#1E1A38', '#2E2A54', '#4A4478'], haze='#3C3A6A', hazeD=30, amb='drip', far='cave', farH=9, indoor=1, tint='#262248', grassCol=['#2E5A6A', '#8ADCE6']),
    'cavetown': dict(sky=['#221C36', '#342C50', '#54486E'], haze='#463E62', hazeD=30, amb='drip', far='cave', farH=9, indoor=1, tint='#2A2446', grassCol=['#3A5A5A', '#9AD8D0']),
    'gloomwater': dict(sky=['#141830', '#22284A', '#384070'], haze='#2E3460', hazeD=28, amb='drip', far='cave', farH=9, indoor=1, tint='#1E2244', grassCol=['#2A4A5A', '#7CC8D8'], waterKind='lake'),
    'tundra': dict(sky=['#8AB0D6', '#C8DCEC', '#EEF2F6'], haze='#DCE6EE', hazeD=52, amb='dust', far='mountains', farH=10, grassCol=['#6A8A8A', '#D8E8E4'], wind=1.2),
})

CRYSTAL_CAVERNS = dict(
    id='crystalcaverns', future='Crystal Caverns', t='silicon', mood='crystal', moods={},
    nodes=[
        dict(id='prism_chasm', name='The Spread', kind='route', lon=210.8, lat=2.2, pool='prism_chasm', biome='crystal', area='grotto', route='Route 11', music='crystal',
             blurb='Chasms full of crystal, crossed on rope bridges. The Variants have set up a works on the shelf between them.'),
        dict(id='glimmershaft', name='Mintshaft', kind='town', lon=218.4, lat=9.0, pool='glimmershaft', biome='cavern', area='grotto', route='Route 11', shop='glimmershaft', music='crystal', mood='cave',
             blurb='A mining town in a cavern, lit by lanterns and the crystals in its walls. Leader Carat runs the mine and the arena.'),
        dict(id='gloomwater', name='The Dark Pool', kind='route', lon=213.8, lat=18.4, pool='gloomwater', biome='darkpool', area='lake', route='Lantern Way', music='crystal',
             blurb='An underground lake so still it looks like a hole in the floor. The old miners’ beacon still burns on the point.'),
        dict(id='rimefrost', name='Frozen Assets', kind='route', lon=226.4, lat=2.6, pool='rimefrost', biome='tundra', area='snow', route='Route 12', music='crystal', mood='crisp',
             blurb='Ice caves opening on to a frozen plain. Something valuable is frozen in a block of ice, where nobody can spend it.',
             gate='carat', gateText='The ice caves east of Mintshaft open once you earn Leader Carat’s Electric Badge.'),
    ],
    links=[('tanglewild', 'prism_chasm', 1700, 'Route 11'), ('prism_chasm', 'glimmershaft', 1500, 'Route 11'), ('glimmershaft', 'gloomwater', 1300, 'Lantern Way'),
           ('gloomwater', 'prism_chasm', 1400, 'Lantern Way'), ('glimmershaft', 'rimefrost', 1700, 'Route 12')],
    pools={
        'prism_chasm': {'lv': [44, 48], 'list': [['huang1', 30], ['slim1', 25], ['ambani1', 20], ['buterin0', 15], ['carnegie1', 10], ['vanderbilt0', 4]]},
        'glimmershaft': {'lv': [44, 47], 'list': [['slim1', 30], ['rinehart1', 25], ['ambani2', 20], ['walton1', 15], ['dyson0', 10]]},
        'gloomwater': {'lv': [45, 49], 'list': [['cuban1', 30], ['ek1', 25], ['spielberg1', 20], ['winklevoss1', 15], ['ponyma0', 5]]},
        'rimefrost': {'lv': [47, 51], 'list': [['walton2', 25], ['ford1', 25], ['newell0', 20], ['slim2', 15], ['huang2', 5]]},
    },
    people={
        'carat': {'look': {'name': 'Leader Carat', 'body': {'height': 1.0, 'legs': 1.0, 'shoulders': 1.02, 'chest': .3}, 'skin': '#C98E6A', 'hair': '#2A2232', 'eyes': '#3A8AA8',
                  'wear': {'hair': 'hair_bob', 'eyes': 'eyes_sharp', 'brows': 'brows_straight', 'mouth': 'mouth_smirk', 'top': 'tank', 'outer': 'puffer', 'bottom': 'work_pants',
                           'shoes': 'boots', 'hat': 'hat_hardhat', 'glasses': 'glasses_square', 'neck': 'chain'},
                  'colors': {'tank': ['#2A2434'], 'puffer': ['#5CC8DE', '#2E7A9A'], 'work_pants': ['#3A3A48', '#2A2A36'], 'boots': ['#4A3A2E', '#2E241C'], 'hat_hardhat': ['#9ADCEA', '#5AA8C8'],
                             'glasses_square': ['#1E2A36'], 'chain': ['#BDEAF2']}}},
    },
    trainers={
        'carat': {'name': 'Leader Carat', 'who': 'carat', 'battleStage': 'grotto', 'node': 'glimmershaft', 'blocks': False,
                  'team': [{'sp': 'slim2', 'lvl': 51}, {'sp': 'buterin1', 'lvl': 51}, {'sp': 'dyson1', 'lvl': 52}, {'sp': 'huang2', 'lvl': 53}], 'reward': 5000, 'egg': 10, 'market': None,
                  'lines': ['“The Variants want one perfect needle, long enough to play the sun. I’m cutting it. I didn’t ask what for.”', '“I’m asking now. Show me what you’re made of.”'],
                  'win': '“Not a flaw on you. The Electric Badge is yours. And the needle? It cracked in the cold. Funny, that.”', 'lose': '“Rough cut. Polish it and come back.”',
                  'hint': 'Leader Carat’s Electric team is level 51–53. Ground billionaires don’t care how much it hums.',
                  'seat': {'id': 'carat', 'title': 'Electric Badge · 8 of 8', 'coin': 'gold', 'coins': {'gold': 5, 'tbtf': 3}, 'items': {'parachute': 1},
                           'rewardText': 'a Golden Parachute, 5 Gold Coins and 3 Platinum Coins', 'unlockText': 'The ice caves of Frozen Assets, east of Mintshaft, are open. Beyond them, the inner sea.'}},
        'variant_needle': {'name': 'Variant No. 3301', 'who': 'variant', 'battleStage': 'grotto', 'node': 'prism_chasm', 'blocks': False,
                           'team': [{'sp': 'buterin0', 'lvl': 46}, {'sp': 'son1', 'lvl': 47}], 'reward': 1500, 'market': None,
                           'lines': ['“The needle has to be perfect. One scratch and the sun skips.”'], 'win': '“That’s a scratch.”', 'lose': '“Flawless. Like the edition.”', 'hint': ''},
        'geologist': {'name': 'Geologist Garnet', 'who': 'geo', 'battleStage': 'grotto', 'node': 'prism_chasm', 'blocks': False,
                      'team': [{'sp': 'ambani1', 'lvl': 46}, {'sp': 'carnegie1', 'lvl': 46}, {'sp': 'slim1', 'lvl': 47}], 'reward': 1400, 'market': None,
                      'lines': ['“These crystals grew a millimetre a century. The Variants are cutting a metre a day.”'], 'win': '“Eroded.”', 'lose': '“Solid as rock.”', 'hint': ''},
        'spelunker': {'name': 'Spelunker Stan', 'who': 'miner', 'battleStage': 'lake', 'node': 'gloomwater', 'blocks': False,
                      'team': [{'sp': 'cuban1', 'lvl': 47}, {'sp': 'rinehart1', 'lvl': 48}], 'reward': 1400, 'market': None,
                      'lines': ['“Don’t look into the pool too long. It looks back, and it’s doing your accounts.”'], 'win': '“Lights out.”', 'lose': '“Deep, isn’t it?”', 'hint': ''},
        'icefisher': {'name': 'Ice Fisher Ivy', 'who': 'girl', 'battleStage': 'snow', 'node': 'rimefrost', 'blocks': False,
                      'team': [{'sp': 'newell0', 'lvl': 49}, {'sp': 'walton2', 'lvl': 50}, {'sp': 'ford1', 'lvl': 50}], 'reward': 1600, 'market': None,
                      'lines': ['“I fish for coins through the ice. The safe is frozen solid, but sometimes the interest leaks out.”'], 'win': '“Cold.”', 'lose': '“Liquid at last!”', 'hint': ''},
    },
    shops={'glimmershaft': {'name': 'Assay Office', 'keeper': 'Opal', 'who': 'cashier', 'greeting': 'Everything weighed, everything valued. Mostly by me.',
                         'stock': [{'item': 'pretzel', 'price': 60}, {'item': 'trailmix', 'price': 220}, {'item': 'loophole', 'price': 400}, {'item': 'bailout', 'price': 900},
                                   {'item': 'parachute', 'price': 2400}]}},
    lore={
        'prism_chasm': {'history': 'Natural chasms lined with crystal, bridged by the first miners with rope and nerve.', 'known': 'Rope bridges, the crystal spire, and the Variants’ needle works.',
                   'landmark': 'The crystal spire, taller than a house, humming a note just too low to hear.', 'legend': 'Drop a coin into the Spread and it never lands. Somewhere below, it is still earning interest.'},
        'glimmershaft': {'history': 'A mining town since the Hollow Earth was found: the crystals pay for everything, including the lanterns to see them by.',
                      'known': 'The mine, the Great Geode on the square, and Leader Carat.', 'landmark': 'The Great Geode, split open on the square, so everyone can see what the town is worth.',
                      'legend': 'The first miner found the geode with one swing of a pick, and spent the rest of his life trying to find the second.'},
        'gloomwater': {'history': 'An underground lake the miners crossed by boat, steering by the beacon on the point.', 'known': 'Black water, glowing shores, and very old boats.',
                     'landmark': 'The miners’ beacon, a great crystal caged at the top of a timber tower.', 'legend': 'Whatever falls into the Dark Pool is written off. Nobody has ever checked.'},
        'rimefrost': {'history': 'Ice caves where the cavern opens on to a frozen plain.', 'known': 'Ice spikes, snow, and the frozen assets.',
                   'landmark': 'A block of ice as big as a shed with a safe frozen inside it: assets, frozen.', 'legend': 'The safe belongs to whoever thaws it. The ice belongs to the Baron. Lawyers are on their way.'},
    },
    chat={
        'glimmershaft': {'0': ['The Variants pay double for crystal now. Carat says it’s blood money. She takes it anyway, then gives it away.', 'Mind the geode. It’s worth more than the town.',
                            'Every lantern here burns crystal. The light is free; the crystal isn’t.', 'They want a needle long enough to play the sun. Who plays the sun?',
                            'Carat used to sing in the mine. She stopped when the Variants came.']},
        'prism_chasm': {'0': ['Don’t look down. There isn’t one.']},
    },
)

# ------------------------------------------------------------------------------------------------ Coral Trench
LOOK.update({
    'reef': dict(sky=['#5EA6E6', '#A8D6F4', '#F4F0E0'], haze='#D6EAF2', hazeD=50, amb='pollen', far='sea', farH=5, grassCol=['#7A9A6A', '#E8E0A8'], waterKind='sea', wind=1.2),
    'harbour': dict(sky=['#5AA2E4', '#A6D4F4', '#F4F0DC'], haze='#E0ECEE', hazeD=50, amb='pollen', far='sea', farH=6, grassCol=['#6A9A6A', '#D8E4A8'], waterKind='sea', wind=1.1),
    'trench': dict(sky=['#3E7EC6', '#86BCE6', '#D8EAF0'], haze='#B8D6E6', hazeD=46, amb='pollen', far='sea', farH=4, ride=1, flatFar=1, waterKind='sea', wind=1.3),
    'press': dict(sky=['#4A6E9E', '#90A8C4', '#D6D8DC'], haze='#B4C0CC', hazeD=40, amb='dust', far='sea', farH=4, ride=1, flatFar=1, waterKind='sea', wind=1.2),
})

CORAL_TRENCH = dict(
    id='coraltrench', future='Coral Trench', t='trench', mood='seaside', moods={},
    nodes=[
        dict(id='conchshell', name='Shell Company Shoals', kind='route', lon=231.2, lat=0.4, pool='conchshell', biome='reef', area='beach', route='Route 12', music='trench',
             blurb='Tide pools and reef shallows on the shore of the inner sea, where a great many companies are registered inside one shell.'),
        dict(id='kelpport', name='Port Folio', kind='town', lon=234.6, lat=11.8, pool='kelpport', biome='harbour', area='beach', route='Pier Road', shop='kelpport', music='trench',
             blurb='A harbour of yachts and piers. Every boat here is diversified; most of them have never left.'),
        dict(id='abyssal_trench', name='Bottom Line Trench', kind='route', lon=241.4, lat=5.6, pool='abyssal_trench', biome='trench', area='sea', route='Route 13', music='trench', mood='deepsea', ride=1,
             blurb='Open water over the trench, so deep the bottom line has never been found. You cross it on a Water billionaire.'),
        dict(id='vinyl_works', name='The Pressing Plant', kind='route', lon=247.6, lat=-1.6, pool='vinyl_works', biome='press', area='sea', route='Route 13', music='variants', mood='deepsea', ride=1,
             blurb='Sheds on piles over the trench, venting steam. Inside, Vinylla’s record is being pressed, one test copy at a time.'),
    ],
    links=[('rimefrost', 'conchshell', 1600, 'Route 12'), ('conchshell', 'kelpport', 1300, 'Pier Road'), ('kelpport', 'abyssal_trench', 1800, 'Route 13'), ('abyssal_trench', 'vinyl_works', 1600, 'Route 13')],
    pools={
        'conchshell': {'lv': [48, 52], 'list': [['winklevoss1', 25], ['yanai1', 25], ['chesky0', 20], ['cuban1', 15], ['spielberg1', 10], ['federer0', 5]]},
        'kelpport': {'lv': [48, 51], 'list': [['ellison1', 30], ['newell0', 25], ['saylor1', 25], ['winklevoss1', 20]]},
        'abyssal_trench': {'lv': [50, 54], 'list': [['ellison2', 25], ['spielberg1', 25], ['ek1', 25], ['ponyma0', 15], ['scott0', 10]]},
        'vinyl_works': {'lv': [52, 55], 'list': [['jayz1', 30], ['son1', 25], ['newell0', 25], ['schultz0', 20]]},
    },
    people={
        'cass': {'look': {'name': 'Cass Flow', 'body': {'height': 1.02, 'legs': 1.02, 'shoulders': .98, 'chest': .2}, 'skin': '#E2B08C', 'hair': '#3A2A22', 'eyes': '#4A6A4A',
                 'wear': {'hair': 'hair_pony', 'eyes': 'eyes_sharp', 'brows': 'brows_stern', 'mouth': 'mouth_neutral', 'top': 'dress_shirt', 'outer': 'blazer', 'bottom': 'trousers',
                          'shoes': 'oxfords', 'glasses': 'headset', 'neck': 'nametag'},
                 'colors': {'dress_shirt': ['#F2EEE8'], 'blazer': ['#2A2434', '#E9B83C'], 'trousers': ['#2A2434'], 'oxfords': ['#1E1A22'], 'headset': ['#1E1A22'], 'nametag': ['#E9B83C']}}},
    },
    trainers={
        'sailor': {'name': 'Sailor Sal', 'who': 'skipper', 'battleStage': 'beach', 'node': 'conchshell', 'blocks': False,
                   'team': [{'sp': 'winklevoss1', 'lvl': 50}, {'sp': 'yanai1', 'lvl': 50}, {'sp': 'chesky0', 'lvl': 51}], 'reward': 1600, 'market': None,
                   'lines': ['“See that shell? Four hundred companies live in it. None of them have ever been seen.”'], 'win': '“Run aground.”', 'lose': '“Plain sailing.”', 'hint': ''},
        'yachtbroker': {'name': 'Yacht Broker Yates', 'who': 'broker', 'battleStage': 'beach', 'node': 'kelpport', 'blocks': False,
                        'team': [{'sp': 'saylor1', 'lvl': 51}, {'sp': 'newell0', 'lvl': 51}, {'sp': 'ellison1', 'lvl': 52}], 'reward': 1800, 'market': None,
                        'lines': ['“Every yacht in this harbour has a smaller yacht, to get to the bigger yacht. I sell the smallest ones.”'], 'win': '“Sunk cost.”', 'lose': '“Sold!”', 'hint': ''},
        'deepdiver': {'name': 'Deep Diver Dom', 'who': 'diver', 'battleStage': 'sea', 'node': 'abyssal_trench', 'blocks': False,
                  'team': [{'sp': 'ellison2', 'lvl': 52}, {'sp': 'spielberg1', 'lvl': 53}], 'reward': 1700, 'market': None,
                  'lines': ['“I’ve dived for the bottom line twenty times. It keeps moving down.”'], 'win': '“Out of air.”', 'lose': '“Deep dive!”', 'hint': ''},
        'variant_press': {'name': 'Variant No. 7777', 'who': 'variant', 'battleStage': 'sea', 'node': 'vinyl_works', 'blocks': False,
                          'team': [{'sp': 'jayz1', 'lvl': 53}, {'sp': 'son1', 'lvl': 53}, {'sp': 'schultz0', 'lvl': 54}], 'reward': 1900, 'market': None,
                          'lines': ['“Lucky number! I got to stand by the press. I can feel it in my teeth.”'], 'win': '“Off the record.”', 'lose': '“Pressed!”', 'hint': ''},
        'cass': {'name': 'Cass Flow', 'who': 'cass', 'battleStage': 'sea', 'node': 'vinyl_works', 'blocks': False, 'clue': 'face',
                 'team': [{'sp': 'federer0', 'lvl': 55}, {'sp': 'scott0', 'lvl': 55}, {'sp': 'vanderbilt0', 'lvl': 56}, {'sp': 'ronaldo0', 'lvl': 57}], 'reward': 6000, 'egg': 10, 'market': None,
                 'intro': ['[angry] Stop right there. This is a closed set.', 'Wait. You? We dropped you. Down a hole. On the surface.', '[sad] You were the best sound engineer the tour ever had. Then you read the plans.',
                           '[angry] It doesn’t matter. The press is nearly done, and you’re not on the guest list.'],
                 'lines': ['“Nothing personal. It’s just the bottom line.”'], 'win': '“Fine. Go up the Spire, then. She’ll be delighted. She loves a comeback.”',
                 'lose': '“Back down the hole with you.”', 'hint': 'Cass Flow waits at the pressing plant with a team around level 55–57.'},
    },
    shops={'kelpport': {'name': 'The Chandlery', 'keeper': 'Marlin', 'who': 'skipper', 'greeting': 'Rope, rations and risk management. The rope is the best value.',
                         'stock': [{'item': 'pretzel', 'price': 60}, {'item': 'trailmix', 'price': 220}, {'item': 'taxbreak', 'price': 140}, {'item': 'loophole', 'price': 400},
                                   {'item': 'bailout', 'price': 900}, {'item': 'parachute', 'price': 2400}]}},
    lore={
        'conchshell': {'history': 'Shallows on the inner sea, where the tide pools never quite drain.', 'known': 'Tide pools, the coral tower, and the Shell Company.',
                   'landmark': 'The coral tower, a reef taller than a house standing alone in the shallows.', 'legend': 'The Shell Company has four hundred directors. All of them are the same crab.'},
        'kelpport': {'history': 'A fishing village that sold its boats for yachts, and its fish for funds.', 'known': 'Piers, yachts, and the superyacht Diversified.',
                      'landmark': 'The Diversified, the biggest yacht in the Hollow Earth, which has never once left the harbour.', 'legend': 'The Diversified owns a smaller yacht, which owns a smaller one, all the way down to a rubber duck.'},
        'abyssal_trench': {'history': 'Open water over a trench nobody has found the bottom of.', 'known': 'Kelp, buoys, and the long ride to the pressing plant.',
                       'landmark': 'The buoy line, marking the way to the plant for those who must not be seen going there.', 'legend': 'Somewhere below, the bottom line. Everyone talks about it; nobody has reached it.'},
        'vinyl_works': {'history': 'Built in a season on piles driven into the trench’s rim, with money from the festival, the vaults and the spores.',
                     'known': 'Steam, the smell of hot vinyl, and Cass Flow’s clipboard.', 'landmark': 'The pressing plant, where the test copies of the record are made.',
                     'legend': 'Each test copy is played once, then broken. The first one ever pressed was a recording of you.'},
    },
    chat={
        'kelpport': {'0': ['The Diversified has never left the harbour. It doesn’t need to; the harbour moved to it.', 'Every boat here is registered in the Shell Company. So is the harbour.',
                            'Barges go out to the plant at night. Nobody rows them; they just go.', 'Cass Flow buys her coffee here. Black, like the records.',
                            'If you want to ride the trench, you’ll want a Water billionaire. A big one.']},
    },
)

# ------------------------------------------------------------------------------------------------ Cloud Spire
LOOK.update({
    'server': dict(sky=['#7AB2E6', '#BCD8F0', '#EEF0F2'], haze='#DDE6EE', hazeD=54, amb='dust', far='hills', farH=6, grassCol=['#5A8A5A', '#C8DCA0'], wind=1.0),
    'nimbus': dict(sky=['#6A9EE0', '#B4CCEE', '#F0E6EE'], haze='#DCDCE8', hazeD=54, amb='dust', far='town', farH=10, grassCol=['#5A8A5A', '#B8D8A0']),
    'bubble': dict(sky=['#8AB8E6', '#D0DCEC', '#F2E6EC'], haze='#E6E0E6', hazeD=48, amb='dust', far='town', farH=8, grassCol=['#6A8A5A', '#D0D8A0'], wind=1.1),
    'skygarden': dict(sky=['#4E8AE0', '#A6CCF4', '#F6F6FA'], haze='#E8EEF8', hazeD=60, amb='pollen', far='mountains', farH=4, flatFar=1, grassCol=['#8AA0C0', '#F0F4FA'], wind=1.4, rays=1),
})

CLOUD_SPIRE = dict(
    id='cloudspire', future='Cloud Spire', t='spire', mood='city', moods={},
    nodes=[
        dict(id='circuit_terraces', name='The Server Farm', kind='route', lon=252.8, lat=-4.8, pool='circuit_terraces', biome='silicon', area='clear', route='Route 14', music='spire', mood='clear',
             blurb='Silicon flats: rows of servers humming in the fields and solar panels where the crops used to be. The Cloud is made here.'),
        dict(id='nimbus', name='Upside City', kind='town', lon=258.0, lat=7.8, pool='nimbus', biome='city', area='clear', route='Route 14', shop='nimbus', music='spire',
             blurb='The city at the foot of the Spire. Its night market never closes, because the tower’s shadow makes it night all day on one side.'),
        dict(id='fizzpop', name='Bubbleland', kind='route', lon=263.6, lat=-3.6, pool='fizzpop', biome='park', area='clear', route='Bubble Road', music='spire', mood='dusty',
             blurb='A theme park that closed the day the bubble burst. The Ferris wheel stopped with everyone’s money still at the top.'),
        dict(id='skygarden', name='Upper Bracket Walk', kind='route', lon=265.4, lat=16.8, pool='skygarden', biome='sky', area='clear', route='The Spire Stairs', music='variants', mood='sky',
             blurb='Walkways up the Spire through the clouds, to the door of Vinylla’s penthouse.'),
    ],
    links=[('vinyl_works', 'circuit_terraces', 1700, 'Route 14'), ('circuit_terraces', 'nimbus', 1500, 'Route 14'), ('nimbus', 'fizzpop', 1300, 'Bubble Road'), ('nimbus', 'skygarden', 1600, 'The Spire Stairs')],
    pools={
        'circuit_terraces': {'lv': [53, 57], 'list': [['dyson1', 25], ['vanderbilt0', 15], ['altman0', 15], ['yiming0', 25], ['pagebrin1', 20]]},
        'nimbus': {'lv': [53, 56], 'list': [['kashing1', 30], ['hughes2', 20], ['knight2', 20], ['jayz1', 30]]},
        'fizzpop': {'lv': [54, 58], 'list': [['son1', 25], ['hastings0', 25], ['dorsey1', 25], ['ronaldo0', 10], ['buterin1', 15]]},
        'skygarden': {'lv': [56, 60], 'list': [['knight2', 25], ['hughes2', 20], ['griffin0', 15], ['federer0', 15], ['mateschitz1', 25]]},
    },
    people={
        'vinylla': {'look': {'name': 'Vinylla', 'body': {'height': 1.04, 'legs': 1.06, 'shoulders': .94, 'chest': .45}, 'skin': '#F0C8A8', 'hair': '#F4E6C8', 'eyes': '#B46AC8',
                    'wear': {'hair': 'hair_long', 'eyes': 'eyes_lashes', 'brows': 'brows_arched', 'mouth': 'mouth_smirk', 'top': 'crop', 'outer': 'trench', 'bottom': 'leggings',
                             'shoes': 'boots', 'hat': 'hat_crown', 'glasses': 'glasses_sun', 'neck': 'chain'},
                    'colors': {'crop': ['#1E1A26'], 'trench': ['#E9B83C', '#F6DC84'], 'leggings': ['#1E1A26', '#E85AA8'], 'boots': ['#E9B83C', '#1E1A26'], 'hat_crown': ['#F6DC84', '#E85AA8'],
                               'glasses_sun': ['#E85AA8'], 'chain': ['#F6DC84']}}},
    },
    trainers={
        'sysadmin': {'name': 'Sysadmin Sam', 'who': 'intern', 'battleStage': 'clear', 'node': 'circuit_terraces', 'blocks': False,
                     'team': [{'sp': 'dyson1', 'lvl': 54}, {'sp': 'yiming0', 'lvl': 55}, {'sp': 'altman0', 'lvl': 55}], 'reward': 2000, 'market': None,
                     'lines': ['“Have you tried turning the Cloud off and on again? I have. It rained for a week.”'], 'win': '“Connection lost.”', 'lose': '“Uptime!”', 'hint': ''},
        'chad3': {'name': 'Blake', 'who': 'chad', 'battleStage': 'clear', 'node': 'nimbus', 'blocks': False, 'after': 'chad2',
                  'team': [{'sp': '@rival2', 'lvl': 57}, {'sp': 'saylor1', 'lvl': 55}, {'sp': 'thiel1', 'lvl': 55}, {'sp': 'griffin0', 'lvl': 56}], 'reward': 4000, 'egg': 10, 'market': None,
                  'intro': ['[angry] There you are. Took you long enough.', 'Vinylla’s people offered to buy my team. All of it. Dad’s clone too, for the collection.',
                            '[sad] I said no. I think I said no. I’m not used to saying it.', '[angry] Battle me. If I can still beat you, I meant it.'],
                  'lines': ['“For the record: this isn’t for sale.”'], 'win': '“Okay. I meant it. Go up there and stop her. I’ll hold the stairs.”', 'lose': '“Ha! Still got it. Now go.”',
                  'hint': 'Blake waits in Upside City with his strongest team, around level 55–57.'},
        'vip': {'name': 'Variant VIP', 'who': 'variant', 'battleStage': 'clear', 'node': 'nimbus', 'blocks': False,
                'team': [{'sp': 'kashing1', 'lvl': 55}, {'sp': 'jayz1', 'lvl': 56}], 'reward': 2000, 'market': None,
                'lines': ['“VIP means Very Important Purchaser. I have every variant. Even the ones that don’t exist yet.”'], 'win': '“Access revoked.”', 'lose': '“Backstage!”', 'hint': ''},
        'mascot': {'name': 'Mascot Max', 'who': 'boy', 'battleStage': 'clear', 'node': 'fizzpop', 'blocks': False,
                   'team': [{'sp': 'son1', 'lvl': 55}, {'sp': 'hastings0', 'lvl': 56}, {'sp': 'dorsey1', 'lvl': 56}], 'reward': 2000, 'market': None,
                   'lines': ['“I was Bubbles the Bubble for nine years. They never told me it burst. I found out from the newspaper.”'], 'win': '“Pop.”', 'lose': '“Bubbly!”', 'hint': ''},
        'variant_vip2': {'name': 'Variant No. 0001', 'who': 'variant', 'battleStage': 'clear', 'node': 'skygarden', 'blocks': False,
                         'team': [{'sp': 'knight2', 'lvl': 57}, {'sp': 'hughes2', 'lvl': 58}], 'reward': 2200, 'market': None,
                         'lines': ['“Number one. The first fan. I was here before the tower. I watched them build it round me.”'], 'win': '“...I’ll always be first.”', 'lose': '“Number one!”', 'hint': ''},
        'vinylla1': {'name': 'Vinylla', 'who': 'vinylla', 'battleStage': 'clear', 'node': 'skygarden', 'blocks': False,
                     'team': [{'sp': 'jayz1', 'lvl': 57}, {'sp': 'ek1', 'lvl': 57}, {'sp': 'spielberg1', 'lvl': 58}, {'sp': 'scott0', 'lvl': 59}], 'reward': 8000, 'egg': 10, 'market': None,
                     'intro': ['[happy] Oh! The sound engineer. Cass said you’d bounced. I love a comeback; they chart so well.', 'You know what I’m pressing. A lid for the sun, gold on one side. Light, by subscription.',
                               '[angry] People pay for scarcity. I’m making the scarcest thing there is.', '[happy] Let’s do a little soundcheck, darling.'],
                     'lines': ['“Every limited edition needs a launch.”'], 'win': '“How rude. It doesn’t matter. The press is at the Inner Sun, and I’m late for my own release.”',
                     'lose': '“Encore declined.”', 'hint': 'Vinylla is at the top of the Upper Bracket Walk with a team around level 57–59.'},
    },
    shops={'nimbus': {'name': 'Night Market', 'keeper': 'Lux', 'who': 'clerk', 'greeting': 'Open all night, all day. It’s always night on this side of the tower.',
                      'stock': [{'item': 'pretzel', 'price': 60}, {'item': 'trailmix', 'price': 220}, {'item': 'taxbreak', 'price': 140}, {'item': 'loophole', 'price': 400},
                                {'item': 'bailout', 'price': 900}, {'item': 'parachute', 'price': 2400}]}},
    lore={
        'circuit_terraces': {'history': 'Farmland, until the servers proved a better crop.', 'known': 'Racks in rows, solar fields, and the Cloud.',
                       'landmark': 'The cooling tower where the Cloud is made, and from which it rains on Tuesdays.', 'legend': 'Everything you ever saved is up there somewhere. Nobody knows the password.'},
        'nimbus': {'history': 'A city that grew at the foot of the Spire, to sell things to people going up it.', 'known': 'The Spire, the night market, and the shadow.',
                   'landmark': 'The Spire, one tower straight up through the clouds.', 'legend': 'The top of the Spire is above the Inner Sun’s light. Up there it is always night, and always sold out.'},
        'fizzpop': {'history': 'A theme park built on a bubble, closed the day it burst.', 'known': 'The stopped Ferris wheel, the carousel, and the gate with a letter missing.',
                       'landmark': 'The Ferris wheel, stopped with its riders’ money still at the top.', 'legend': 'On quiet nights the carousel turns by itself, and the horses come back worth less.'},
        'skygarden': {'history': 'Walkways of sky-stone up the outside of the Spire, through the clouds.', 'known': 'The view, the wind, and the door to the penthouse.',
                    'landmark': 'The penthouse door: a gold record in a marble frame.', 'legend': 'The Upper Bracket is where the money goes when it has nowhere left to go.'},
    },
    chat={
        'nimbus': {'0': ['The Spire goes up through the clouds. Above them, they say, it’s always night and always sold out.', 'The night market never closes. Neither does the shadow.',
                         'Vinylla’s at the top. You can hear the bass from the market on a still night.', 'Variants queue round the tower for the release. They’ve been queuing since spring.',
                         'Bubbleland closed the day the bubble burst. The Ferris wheel stopped with the money still at the top.']},
    },
)

# ------------------------------------------------------------------------------------------------ The Inner Sun
LOOK.update({
    'zenith_steps': dict(sky=['#E6B464', '#F4DCA0', '#FFF6DC'], haze='#F6E2B8', hazeD=50, amb='sand', far='canyon', farH=8, grassCol=['#9A8A40', '#F0D888'], wind=1.2, rays=1),
    'bell': dict(sky=['#EAB65E', '#F6DC9C', '#FFF8E0'], haze='#F8E6BC', hazeD=52, amb='sand', far='canyon', farH=7, grassCol=['#9A8A40', '#F0D888'], wind=1.1, rays=1),
    'sun': dict(sky=['#F2C060', '#FFE6A0', '#FFFBEA'], haze='#FFF0C8', hazeD=56, amb='dust', far='canyon', farH=6, grassCol=['#A89040', '#F8E098'], wind=.9, rays=1),
})

INNER_SUN = dict(
    id='innersun', future=None, t='sun', mood='noon', moods={},          # the sun itself stays on the map, at the centre
    nodes=[
        dict(id='zenith_steps', name='All-Time High', kind='route', lon=272.4, lat=13.0, pool='zenith_steps', biome='desert', area='volcano', route='The Long Way Down', music='innersun', mood='heat',
             blurb='A desert of sun-baked stone under the Inner Sun. Everything here peaked a long time ago.'),
        dict(id='bellwether_rise', name='The Closing Bell', kind='route', lon=279.8, lat=7.0, pool='bellwether_rise', biome='desert', area='volcano', route='Sun Road', music='innersun',
             blurb='The road to the Inner Sun, past the great bell. When it rings, everything stops trading.'),
        dict(id='innersun', name='The Inner Sun', kind='route', lon=287.4, lat=11.0, pool='innersun', biome='sun', area='volcano', route='Sun Road', music='innersun',
             blurb='Always noon at the centre of the world. The press stands ready under the sun.'),
    ],
    links=[('skygarden', 'zenith_steps', 1800, 'The Long Way Down'), ('zenith_steps', 'bellwether_rise', 1600, 'Sun Road'), ('bellwether_rise', 'innersun', 1600, 'Sun Road')],
    pools={
        'zenith_steps': {'lv': [57, 61], 'list': [['lebron1', 25], ['ma2', 15], ['mateschitz1', 25], ['kroc2', 20], ['ballmer0', 15]]},
        'bellwether_rise': {'lv': [58, 62], 'list': [['ford2', 25], ['mittal0', 20], ['ronaldo0', 15], ['hershey0', 20], ['lebron1', 20]]},
        'innersun': {'lv': [60, 64], 'list': [['ma2', 25], ['lebron1', 25], ['huang2', 20], ['ronaldo0', 15], ['mittal0', 15]]},
    },
    people={},
    trainers={
        'daytrader': {'name': 'Day Trader Dax', 'who': 'clerk', 'battleStage': 'volcano', 'node': 'zenith_steps', 'blocks': False,
                      'team': [{'sp': 'lebron1', 'lvl': 58}, {'sp': 'ma2', 'lvl': 59}], 'reward': 2400, 'market': None,
                      'lines': ['“I bought at the all-time high. I’m waiting for it to come back. It’s been eleven years.”'], 'win': '“Correction.”', 'lose': '“To the moon!”', 'hint': ''},
        'bellringer': {'name': 'Bell Ringer Bea', 'who': 'hiker', 'battleStage': 'volcano', 'node': 'bellwether_rise', 'blocks': False,
                       'team': [{'sp': 'mittal0', 'lvl': 59}, {'sp': 'ford2', 'lvl': 60}, {'sp': 'ronaldo0', 'lvl': 60}], 'reward': 2600, 'market': None,
                       'lines': ['“I ring the bell when the day is done. The sun never sets here, so I just ring it when I’m tired.”'], 'win': '“Ding.”', 'lose': '“Dong!”', 'hint': ''},
        'variant_one': {'name': 'Variant No. 1', 'who': 'variant', 'battleStage': 'volcano', 'node': 'innersun', 'blocks': False,
                        'team': [{'sp': 'son1', 'lvl': 59}, {'sp': 'jayz1', 'lvl': 59}, {'sp': 'ek1', 'lvl': 60}], 'reward': 2600, 'market': None,
                        'lines': ['“Number one. Not the first fan; the first variant. She made me before she made the record.”'], 'win': '“One of a kind. Still.”', 'lose': '“Number one!”', 'hint': ''},
        'vinylla2': {'name': 'Vinylla', 'who': 'vinylla', 'battleStage': 'volcano', 'node': 'innersun', 'blocks': False, 'after': 'vinylla1', 'ending': 1,
                     'team': [{'sp': 'jayz1', 'lvl': 60}, {'sp': 'ek1', 'lvl': 60}, {'sp': 'spielberg1', 'lvl': 61}, {'sp': 'scott0', 'lvl': 61}, {'sp': 'ronaldo0', 'lvl': 62}, {'sp': 'ma2', 'lvl': 63}],
                     'reward': 20000, 'egg': 10, 'market': None,
                     'intro': ['[happy] You came all this way for the release? I’m touched. Truly.', 'One turn of the press and the sun is a record. Gold on one side, darkness on the other.',
                               '[angry] And every one of them will pay to listen.', '[happy] This is the last track, darling. Make it count.'],
                     'lines': ['“Scarcity is the whole song.”'], 'win': '“No... the press. It’s stopped. Who let all that gold in here?”', 'lose': '“And that’s the hit single.”',
                     'hint': 'Vinylla waits at the press under the Inner Sun with six billionaires, level 60–63.',
                     'endLines': [['vinylla', '[sad] Gold. Everywhere. On the floor, on the press, on the record...'],
                                  ['gini', '[happy] Aurumansa. The golden caravan. It always comes when something is about to get rare.'],
                                  ['gini', 'Look at it, Vinylla. Gold all over the pressing floor. Nothing here is limited any more.'],
                                  ['vinylla', '[angry] Do you know what a record is worth if everyone can have one?'],
                                  ['chad', '[happy] About what it’s worth to listen to it. Turns out that was the point.'],
                                  ['gini', 'And you. You were the sound engineer on her tour. You read the plans, and Cass made sure you fell.'],
                                  ['gini', '[happy] Welcome back. The sun is still up. It will be up tomorrow too.']]},
    },
    shops={},
    lore={
        'zenith_steps': {'history': 'The desert under the Inner Sun, where everything was worth the most it would ever be worth.', 'known': 'Sun-baked stone, heat, and the ticker still running.',
                'landmark': 'The column of the all-time high, broken off at the top, its ticker still showing the peak.', 'legend': 'The ticker will run until the price comes back. It is very patient.'},
        'bellwether_rise': {'history': 'The old road to the Inner Sun, lined with the ruins of exchanges.', 'known': 'The great bell, and the long straight road.',
                        'landmark': 'The Closing Bell: when it rings, everything stops trading, even the wind.', 'legend': 'The bell has rung only once. Nobody remembers what it closed.'},
        'innersun': {'history': 'The centre of the Hollow Earth, where the Inner Sun hangs at noon for ever.', 'known': 'Light, heat, and Vinylla’s press.',
                     'landmark': 'The press: a record as big as a house, waiting under the sun.', 'legend': 'Look straight up and the sun looks back. It has seen every deal ever made, and it is not impressed.'},
    },
    chat={},
)

REGIONS = {'meadowlands': MEADOWLANDS, 'goldenhills': GOLDEN_HILLS, 'sporeforest': SPORE_FOREST, 'crystalcaverns': CRYSTAL_CAVERNS,
           'coraltrench': CORAL_TRENCH, 'cloudspire': CLOUD_SPIRE, 'innersun': INNER_SUN}


# ================================================================================================ helpers
def load():
    src = gamedata.js_text(); i = src.index('window.GAMEDATA=')
    return src[:i], json.JSONDecoder().raw_decode(src[i + len('window.GAMEDATA='):])[0]


def save(head, D):
    gamedata.save_js(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n')


def node_index(D, nid):
    for i, r in enumerate(D['locations']):
        if r.get('id') == nid: return i
    return None


def fresh(sid, name, kind, look, size):
    """the "old" scene a new place is set up from: its look (sky, haze, far layer, ambience, grass colour)"""
    W, H = size
    d = dict(name=name, w=W, h=H, edge='g', sky=look['sky'], haze=look['haze'], hazeD=look['hazeD'], cam={'pitch': 34, 'h': 9, 'fov': 1}, blur=1,
             amb=look['amb'], tint=None, indoor=0, far=look['far'], farH=look['farH'], folk=10 if kind == 'town' else 0, kind=kind, place=sid)
    for k in ('grassCol', 'wind', 'rays', 'indoor', 'tint', 'ride', 'waterKind', 'flatFar'):
        if look.get(k) is not None: d[k] = look[k]
    return d


# ================================================================================================ the Meadowlands' places
MEADOW_FLOWERS = ['@flowers', 'daisies', 'buttercups', 'poppies', 'cornflowers', 'lupins', 'tulips_pink', 'tulips_red', 'clover_white']


def route_festival(D, i, old):
    """the fan festival in the wildflower fields: the festival ground off to the west of the way north, the stage at its
    back, merch stalls in a row before it, toilets and food trucks round the edges, tents on the far side"""
    s, ex = BP.route_base('fanfare_fields', D, i, old, 'E', 4721, hub=(56, 12))
    s.tint_ground([('g', .6, 7, 'E'), ('f', .7, 5, 'Eg'), ('C', .78, 4, 'Eg')], 21)
    # the festival ground: trampled earth and straw (nothing grows on it, no tall grass)
    s.blob(30, 38, 19, 9, 'A', .3); s.blob(30, 38, 14, 6, 'D', .35, keep='A'); s.clear.append((30, 46, 7)); s.clear.append((30, 36, 9))
    s.put('festival_stage', 30, 47.6)
    for x in (14.5, 45.5): s.put('billboard_tour', x, 49.4)
    for k, x in enumerate((14, 20.5, 27, 33.5, 40, 46.5)):
        s.put('stall_merch', x, 28.6 + (k % 2) * .3, act='talk', say=['Merch: “Signed by Vinylla’s signature machine!”', 'Merch: “Limited edition. Strictly limited to however many we sell.”',
                                                                   'Merch: “This shirt comes in gold, gold or gold.”', 'Merch: “The variant of the variant. Last one. Until tomorrow.”'][k % 4])
    for x, z in ((80, 44), (88, 47.5), (96, 43.5), (102, 49)): s.put('tent', x, z)
    for x in (6.5, 8.9, 11.3): s.put('portaloo_vip', x, 38)
    for x, z in ((50, 36.6), (52, 42.4)): s.put('food_truck', x, z, act='talk', say='Food truck: “Festival fries. The price goes up every time the band doesn’t come on.”')
    for x in (24, 36): s.put('haybale', x, 40.2)
    s.clearing(72, 22, [('picnic', 0, 0), ('bench_wood', 3.2, -.4), ('trash', -2.2, .2)])
    s.drifts(10, (5, 9, 2.4, 4), density=.8)
    for cx, cz in ((88, 20), (100, 30), (64, 52)): s.drift(MEADOW_FLOWERS, cx, cz, 7, 2.6, 18, avoid=AV + 'tAD')
    s.belt(['tree_blossom', '@tree_oak', 'tree_birch', 'tree_poplar'], 'back', 5, 22, UNDER)
    s.scatter(['@rocks', '@bush_round', 'bush_flower', 'stump', 'molehill', 'flowerpot'], 22, (54, 0, 112, 40), avoid=AV + 'tAD', gap=.7)
    s.frame(['@bush_round', 'bush_flower', '@flowers', 'tulips_pink'], 14)
    s.life('rabbit', 3); s.life('pigeon', 6, area=[14, 28, 48, 40])
    s.rolling(.6, 8); s.hill(84, 54, 10, 1.4); s.hill(104, 18, 8, 1.2)
    return s.out(7, 'wood'), {}


def town_twofold(D, i, old):
    """a market village: a square of stalls round the giant sunflower, the market hall, Poppy's greenhouse arena on the
    square's north side, houses in lanes with deep gardens (everything grows back twice as fast), fields at the edges"""
    W, H = 96, 72; s = Place('twinpetal', 'Twofold', 'g', 4722, W, H); hub = (48, 16); s.setup(old, hub)
    ex = exits_for(s, D, i, hub, keep_roads=False, lamps='lantern')
    s.blob(48, 24, 13, 6, 'K', .1); s.clear.append((48, 25.4, 2.6))
    s.street([[2, 21], [24, 21.4], [48, 21], [72, 21.4], [W - 2, 21]], 'K', 2.4, 'lantern', 12)
    for x in (38.6, 57.4): s.street([[x, 28], [x, 42]], 'p', 1.8, None)
    s.street([[6, 42], [28, 42.4], [48, 42], [70, 42.4], [90, 42]], 'p', 2.0, 'lantern', 14)
    s.street([[48, 42], [48, 54]], 'p', 1.6, None)
    s.put('sunflower_giant', 48, 25.6)
    for x, z in ((40, 23.2), (56.4, 23.2), (41.4, 27.6), (55, 27.8)):
        s.put('stall' if x < 48 else 'stall_merch', x, z, act='talk', say='Stall: “Twice the vegetables, half the season.”' if x < 48 else 'Merch: “Nobody here ordered this stall. It sells out anyway.”')
    s.put('market_cart', 33, 24.6, act='talk', say='Cart: “Beans! They grew while I was talking.”')
    s.house('greenhouse', 48, 31.2, 'house', garden=False, label='Poppy’s Greenhouse', say='Inside it is warm and green and everything is growing toward you.')
    s.house('market_hall', 28.4, 30, 'shop', garden=False, label='Twofold Market')
    s.house('clinic', 68.6, 30, 'clinic', garden=False)
    s.house('inn', 79, 29.6, 'house', garden=False, label='The Second Helping')
    s.row(24.4, 3, 24, ['house_cottage', 'house_green', 'house_red'])
    s.row(24.4, 72, 93, ['house_blue', 'house_cottage', 'house_green'])
    s.row(45, 4, 30, ['house_cottage', 'house_red', 'house_large'])
    s.row(45, 54, 92, ['house_green', 'house_cottage', 'house_blue', 'house_red'])
    s.row(56.4, 10, 40, ['barn', 'house_cottage'])
    for e in ex: connect(s, e, 'p', 1.6)
    s.place_lamps()
    # fields at the back that grow back twice as fast
    for x0 in (56, 70, 84):
        for z in frange(58, 68, 1.6):
            for x in frange(x0, x0 + 10, 1.4): s.put('crops', x + s.r.uniform(-.1, .1), z, .9)
    s.tint_ground([('E', .6, 7, 'g'), ('C', .66, 5, 'gE'), ('f', .73, 4.5, 'gEC')], 31)
    s.belt(['tree_blossom', 'tree_fruit', '@tree_oak'], 'back', 4, 14, UNDER)
    s.grove(10, 62, 6, 4, 8, ['tree_fruit', 'tree_fruit', 'tree_blossom'], floor='l', under=['beehive', '@flowers', '@flowers'])
    for cx, cz in ((10, 10), (86, 10)): s.grass(cx, cz, 4.6, 2.6, .75, .5)
    for cx, cz in ((24, 12), (72, 12), (48, 60)): s.drift(MEADOW_FLOWERS + ['sunflowers'], cx, cz, 7, 2.4, 16, avoid=AV)
    s.frame(['@bush_round', 'bush_flower', '@flowers', 'sunflowers', 'planter_box'], 16)
    s.scatter(['planter_box', 'flowerpot', 'barrel_wood', 'crates', 'wheelbarrow', 'bench_wood'], 18, (8, 12, 88, 40), avoid='wd', gap=.9)
    s.life('chicken', 4, area=[12, 50, 30, 60]); s.life('pigeon', 6, area=[36, 20, 60, 28]); s.life('rabbit', 2)
    s.d['npcSpots'] = [[51.6, 29.2], [35, 19.4], [62, 19.4]]          # Poppy by her greenhouse door, then the square
    s.rolling(.3, 8); s.rise_back(50, 1.6)
    return s.out(8, 'wood', 'K'), {}


def route_blossom(D, i, old):
    """a valley of cherry trees: a stream down the middle crossed by stepping stones and a little bridge, the great
    cherry on its bank, lanterns along the path, petals everywhere"""
    s, ex = BP.route_base('petalfall', D, i, old, 'g', 4723, hub=(56, 12))
    s.tint_ground([('E', .58, 7, 'g'), ('C', .66, 5, 'gE'), ('M', .8, 4, 'g')], 41)
    s.stream([(70, 64.4), (66, 52), (60, 44), (52, 36), (46, 28), (40, 18), (34, 8), (30, -.4)], 1.4, .55)
    s.put('tree_blossom_great', 63.4, 41.6)
    s.clearing(70, 34, [('bench_wood', 0, 0), ('lantern', 2.2, .4), ('flowerpot', -1.6, .2)])
    s.grove(20, 44, 12, 7, 18, ['tree_blossom', 'tree_blossom', 'tree_blossom', 'tree_fruit'], floor='E', under=['@flowers', 'tulips_pink', 'bush_flower'])
    s.grove(90, 40, 12, 8, 16, ['tree_blossom', 'tree_blossom', 'tree_birch'], floor='E', under=['@flowers', 'bush_flower'])
    s.grove(86, 14, 8, 4, 8, ['tree_blossom', 'tree_blossom'], floor='E')
    s.belt(['tree_blossom', 'tree_blossom', 'tree_birch', '@tree_oak'], 'back', 6, 26, UNDER)
    for x, z in ((48, 20), (60, 26), (52, 50), (76, 22)):
        if s.free(x, z, .4, AV, .9): s.put('lantern', x, z)
    s.drifts(9, (4.5, 8, 2.2, 3.6), density=.75)
    for cx, cz in ((30, 24), (80, 50), (44, 56)): s.drift(['@flowers', 'tulips_pink', 'bluebells', 'daisies'], cx, cz, 6, 2.4, 14, avoid=AV + 't')
    s.scatter(['@rocks', 'stones_flat', '@bush_round', 'bush_flower', 'stump', 'iris_purple'], 24, (0, 0, 112, 60), avoid=AV + 't', gap=.7)
    s.frame(['bush_flower', '@bush_round', 'tulips_pink', '@flowers'], 14)
    s.life('rabbit', 2); s.life('duck', 2)
    s.rolling(.7, 7); s.hill(12, 30, 10, 1.6); s.hill(104, 28, 10, 1.8); s.rise_back(46, 2.2)
    return s.out(7, 'wood', bridge='wood'), {}


def route_margins(D, i, old):
    """a mangrove swamp: channels of open water between marsh islands, the path on duckboards over the wet parts,
    mangroves on their roots, the stilt hut, reeds and lilies"""
    s, ex = BP.route_base('rootwater', D, i, old, 'R', 4724, hub=(56, 12), path='5', amp=2.6, width=1.4)
    for (cx, cz, rx, rz) in ((26, 34, 14, 6), (84, 30, 15, 6), (54, 50, 20, 5), (14, 56, 10, 4), (98, 54, 10, 4)):
        s.blob(cx, cz, rx, rz, 'w', .3, keep='5'); s.blob(cx, cz, rx * .55, rz * .5, 'd', .3, keep='5w')
    s.tint_ground([('g', .62, 6, 'R'), ('M', .7, 5, 'Rg'), ('D', .8, 4, 'R')], 51)
    s.put('stilt_hut', 70, 37.4)
    s.clearing(38, 20, [('bench_wood', 0, 0), ('lantern', 2.0, .3)])
    for (cx, cz) in ((24, 34), (84, 30), (54, 50), (16, 55), (98, 53)):
        for k in range(5):
            a = s.r.uniform(0, 6.28); r = s.r.uniform(2, 7); x, z = cx + math.cos(a) * r, cz + math.sin(a) * r * .5
            if s.free(x, z, .5, '5', .9): s.put('tree_mangrove', x, z, s.r.uniform(.85, 1.1), s.r.random() < .5)
    s.grove(10, 20, 7, 5, 8, ['tree_mangrove', 'tree_willow'], floor='R', under=['reeds', 'bulrush', 'iris_yellow'])
    s.grove(102, 18, 7, 5, 8, ['tree_mangrove', 'tree_willow'], floor='R', under=['reeds', 'bulrush'])
    s.belt(['tree_mangrove', 'tree_mangrove', 'tree_willow'], 'back', 5, 20, ['reeds', 'bulrush'])
    s.drifts(8, (4, 7, 2, 3.4), density=.7)
    s.scatter(['reeds', 'bulrush', 'iris_yellow', 'marsh_marigold', 'water_mint', 'lilypad', 'duckweed'], 60, (0, 0, 112, 64), avoid='5pc', gap=.3)
    s.frame(['reeds', 'bulrush', '@bush_round'], 14)
    s.life('frog', 4); s.life('duck', 4)
    s.rolling(.25, 9)
    return s.out(7, 'wood', bridge='wood'), {}


# ================================================================================================ Golden Hills' places
DRY = ['dry_grass', 'tussock', 'wild_wheat', 'thistles', 'seedheads', 'tussock_rust']
OLIVE = ['tree_olive', 'tree_olive', 'tree_cypress', 'tree_cypress']


def vines(s, x0, x1, z0, z1, gap=2.4, step=3.6):
    """rows of vines across a slope, a gap every few metres to walk through; nothing on paths or water"""
    n = 0
    for z in frange(z0, z1, gap):
        for x in frange(x0, x1, step):
            if s.free(x, z, .9, AV + 'tK', 1.0, .05): s.put('vineyard_row', x + s.r.uniform(-.1, .1), z); n += 1
    return n


def route_vintage(D, i, old):
    """vineyards on sunburnt hills: rows of vines up the slopes either side of the track, olive trees and cypresses,
    a press yard with barrels, and at the back, set into the hill, the vault door with the gold V"""
    s, ex = BP.route_base('grapevine_hills', D, i, old, 'B', 4731, hub=(56, 12), path='u')
    s.tint_ground([('g', .62, 7, 'B'), ('A', .76, 5, 'B'), ('G', .82, 4, 'B')], 61)
    s.put('vault_door_hill', 56, 56.6); s.clear.append((56, 54, 4.5))
    s.line([[56, 55], [56.4, 48], [55, 40], [56.4, 30], [58.4, 21], [59, 16]], 'u', 1.0, keep='uwd'); s.roads.append(([[56, 55], [55, 40], [58.4, 21]], 1.0))
    for x, z in ((49, 54.6), (63, 54.8)): s.put('lantern', x, z)
    s.clearing(30, 20, [('barrels', 0, 0), ('crates', 2.4, .4), ('market_cart', -3, .6), ('bench_wood', 1, -2.4)])
    vines(s, 8, 44, 26, 48); vines(s, 66, 106, 24, 48)
    s.grove(14, 56, 9, 4, 10, OLIVE, floor='B', under=DRY); s.grove(98, 56, 9, 4, 10, OLIVE, floor='B', under=DRY)
    for x in frange(8, 104, 9): 
        if s.free(x, 61, .5, AV, .8): s.put('tree_cypress', x, 61 + s.r.uniform(-.5, .5))
    s.drifts(8, (4, 7, 2, 3.2), box=(2, 2, 110, 24), density=.75)
    s.scatter(['@rocks', 'stones_flat', 'stump', 'barrel_wood', 'bush_rosemary', 'lavender'], 20, (0, 0, 112, 24), avoid=AV + 't', gap=.7)
    s.frame(['bush_rosemary', 'lavender', 'dry_grass', '@rocks'], 14)
    s.life('rabbit', 2); s.life('pigeon', 4, area=[24, 16, 40, 24])
    s.rolling(.5, 9); s.hill(26, 38, 16, 1.8); s.hill(86, 38, 16, 2.0); s.rise_back(50, 2.4)
    return s.out(7, 'wood'), {}


def town_bullion(D, i, old):
    """the Baron's estate village: a square with the golden bull, the manor on the rise behind it, villas and cottages
    on cypress-lined streets, vault doors in the hill at the back, vines all round"""
    W, H = 96, 72; s = Place('goldvine', 'Bullion Hill', 'B', 4732, W, H); hub = (48, 16); s.setup(old, hub)
    ex = exits_for(s, D, i, hub, keep_roads=False, lamps='streetlamp_b')
    s.blob(48, 24, 12, 5.6, 'T', .08); s.clear.append((48, 24.4, 3))
    s.street([[2, 20.6], [24, 21], [48, 20.6], [72, 21], [W - 2, 20.6]], 'K', 2.4, 'streetlamp_b', 12)
    for x in (38, 58): s.street([[x, 27.6], [x, 44]], 'K', 1.8, None)
    s.street([[8, 44], [30, 44.4], [48, 44], [66, 44.4], [88, 44]], 'K', 2.0, 'streetlamp_b', 14)
    s.street([[48, 27], [48, 32]], 'T', 2.0, None)
    s.put('statue_goldbull', 48, 23.6)
    for x, z in ((40.5, 22), (55.5, 22)): s.put('bench_metal', x, z)
    for x, z in ((38.8, 25.8), (57.2, 25.8)): s.put('planter_box', x, z)
    s.house('mansion', 48, 33.6, 'house', garden=False, label='Vault Manor', say='Polished marble, gold taps, and a butler who bills by the minute.')
    s.house('bank', 27, 27.6, 'shop', garden=False, label='Bullion Exchange')
    s.house('clinic', 69, 27.6, 'clinic', garden=False)
    s.house('inn', 80.5, 27.4, 'house', garden=False, label='The Gilded Cellar')
    s.row(24.6, 3, 20, ['villa', 'house_cottage'])
    s.row(46.6, 4, 40, ['villa', 'house_cottage', 'villa'])
    s.row(46.6, 56, 93, ['villa', 'house_cottage', 'villa'])
    for e in ex: connect(s, e, 'K', 1.8)
    s.place_lamps()
    for x in (34, 62): s.put('vault_door_hill', x, 60.4, .8)
    for x in frange(6, 92, 6.5):
        if s.free(x, 17.6, .4, AV, .6): s.put('tree_cypress', x, 17.4)
    vines(s, 4, 30, 52, 66); vines(s, 70, 94, 52, 66)
    s.grove(21, 37, 10, 3.4, 8, OLIVE, floor='B', under=DRY + ['lavender', 'bush_rosemary'])     # behind the bank: the olive garden
    vines(s, 64, 92, 33.4, 41)                                                                   # behind the inn: the house vines
    s.tint_ground([('g', .58, 7, 'B'), ('G', .72, 5, 'gB')], 71)
    s.belt(OLIVE, 'left', 4, 8); s.belt(OLIVE, 'right', 4, 8)
    for cx, cz in ((12, 9), (84, 9)): s.grass(cx, cz, 4.4, 2.4, .7, .5)
    s.frame(['bush_rosemary', 'lavender', 'planter_round', 'bush_box'], 14)
    s.scatter(['planter_round', 'barrel_wood', 'bench_metal', 'bollard', 'flowerpot'], 16, (8, 12, 88, 42), avoid='wd', gap=.9)
    s.life('pigeon', 6, area=[38, 20, 58, 28]); s.life('cat', 2)
    s.d['npcSpots'] = [[52.6, 30.6], [36, 18.4], [60, 18.4]]       # the Baron at his manor's door
    s.rolling(.3, 8); s.rise_back(30, 2.2)
    return s.out(8, 'iron', 'K'), {}


def route_flattax(D, i, old):
    """salt flats: white crust to the horizon, raked salt in cones, a dead tree, bleached stones, and in the middle of
    it all the tollbooth with its barrier across nothing"""
    s, ex = BP.route_base('saltpan_flats', D, i, old, '4', 4733, hub=(56, 12), path='A', amp=1.8, width=1.4)
    s.tint_ground([('A', .7, 8, '4'), ('B', .82, 6, '4A')], 81)
    s.put('tollbooth', 62, 34)
    for k in range(5):
        for j in range(4):
            x, z = 16 + k * 4.2 + s.r.uniform(-.3, .3), 44 + j * 3.4
            if s.free(x, z, .6, AV, .8): s.put('salt_pile', x, z, s.r.uniform(.8, 1.15))
    for x, z in ((88, 50), (94, 46)): s.put('salt_pile', x, z, 1.2)
    for x, z in ((30, 24), (84, 22), (100, 56)):
        if s.free(x, z, .6, AV, .8): s.put('tree_fallen' if x > 80 else 'stump', x, z)
    for cx, cz in ((10, 30), (104, 30), (40, 58)): s.grass(cx, cz, 5, 2.6, .7, .5)
    s.blob(10, 30, 7, 4, 'B', .3, keep='t'); s.blob(104, 30, 7, 4, 'B', .3, keep='t'); s.blob(40, 58, 7, 4, 'B', .3, keep='t')
    s.drifts(5, (3.5, 6, 2, 3), density=.7)          # tall grass on the tufts of sunburnt grass by the road
    s.scatter(['stones_flat', '@rocks', 'scree', 'dry_grass'], 26, (0, 0, 112, 64), avoid=AV + 't', gap=1.2)
    s.frame(['dry_grass', 'tussock', '@rocks'], 10)
    s.rolling(.08, 12)
    return s.out(7, 'wood'), {}


def route_badlands(D, i, old):
    """red rock badlands: mesas at the back, Bear Rock asleep by the trail, an old mine with its headframe, carts on
    rusty rails, scrub and dry grass, the trail over gravel"""
    s, ex = BP.route_base('badlands', D, i, old, 'A', 4734, hub=(56, 12), path='v', amp=2.6, width=1.4)
    s.tint_ground([('B', .6, 7, 'A'), ('r', .74, 5, 'A'), ('u', .84, 4, 'A')], 91)
    s.put('bear_rock', 30, 31); s.clear.append((30, 31, 4.2))
    s.put('mine_headframe', 84, 34); s.put('minecart', 78.5, 30.2); s.put('minecart', 90, 29.6, 1, True); s.clear.append((84, 31, 5))
    for x in frange(72, 96, 2.2):
        if s.free(x, 27.6, .3, 'wd', .5): s.put('rails', x, 27.6) if 'rails' in BP.CAT else None
    for cx, cz in ((76, 24), (98, 8), (54, 4)): s.blob(cx, cz, 7, 3.6, 'B', .3, keep='vt')
    s.clearing(60, 26, [('campfire', 0, 0), ('log', -2.2, .6), ('tent', 3.4, 1.6)])
    for cx, cz in ((10, 52), (100, 54), (60, 58)):
        s.put('mesa', cx, cz) if 'mesa' in BP.CAT and s.free(cx, cz, 3, AV, 1.2) else None
    s.drifts(9, (4, 7, 2, 3.4), density=.75)
    s.scatter(['@rocks', 'boulder', 'scree', 'dry_bush', 'dry_grass', 'cactus', 'stones_flat'], 34, (0, 0, 112, 64), avoid=AV + 't', gap=.8)
    s.frame(['dry_grass', 'dry_bush', '@rocks'], 12)
    s.life('lizard', 4)
    s.rolling(.6, 8); s.hill(16, 30, 9, 1.4); s.hill(100, 30, 9, 1.6); s.rise_back(48, 2.6)
    return s.out(7, 'wood'), {}


# ================================================================================================ Spore Forest's places
SPORE_MUSH = ['mushroom_giant', 'mushroom_giant', 'mushroom', 'mushroom_blue', 'mushroom_brown']
AUTUMN = ['tree_rowan_autumn', 'tree_beech_autumn', 'tree_poplar_autumn', 'tree_hazel_autumn', 'tree_birch_gold', 'tree_maple']


def route_sporewood(D, i, old):
    """a wood of giant mushrooms on a soft mushroom mat, moss and forest floor, the spore mill in a clearing with the
    Variants' drums stacked by it, glowing mushrooms along the path"""
    s, ex = BP.route_base('puffcap', D, i, old, 'J', 4741, hub=(56, 12), path='y', amp=3.0, width=1.3)
    s.tint_ground([('M', .58, 6, 'J'), ('y', .7, 5, 'J'), ('g', .82, 4, 'J')], 101)
    s.blob(78, 40, 10, 6, 'v', .3); s.clear.append((78, 42, 5))
    s.put('spore_mill', 78, 42.6)
    for x, z in ((70, 38.4), (86.4, 38.2)): s.put('barrel_blue' if 'barrel_blue' in BP.CAT else 'barrels', x, z)
    s.put('crates', 89, 44.6)
    for cx, cz, n in ((22, 34, 10), (40, 52, 8), (96, 18, 7), (10, 14, 6), (100, 54, 8)): s.grove(cx, cz, 9, 6, n, SPORE_MUSH, floor='J', under=['mushroom_blue', 'moss_patch', '@fern'])
    s.belt(SPORE_MUSH + ['tree_larch', 'tree_elm'], 'back', 6, 26, ['mushroom_blue', '@fern'])
    for x, z in ((48, 20), (62, 26), (54, 34), (66, 44)):
        if s.free(x, z, .4, AV, .9): s.put('mushroom_blue', x, z, 1.3)
    s.clearing(30, 18, [('log', 0, 0), ('stump', 2.2, .3), ('campfire', 1.2, -1.6)])
    s.drifts(9, (4.5, 8, 2.2, 3.6), density=.75)
    s.scatter(['mushroom', 'mushroom_brown', 'moss_patch', '@fern', 'stump', 'roots'], 40, (0, 0, 112, 60), avoid=AV + 't', gap=.6)
    s.frame(['mushroom_giant', 'mushroom_blue', '@fern'], 14)
    s.life('frog', 3); s.life('rabbit', 2)
    s.rolling(.6, 7); s.rise_back(46, 2.0)
    return s.out(7, 'wood'), {}


def town_marketcap(D, i, old):
    """a village round the colossal mushroom: its stalk at the heart of a mossy square, mushroom houses in rings round
    it, treehouses at the edges, the shop, the clinic and the inn on the street in front"""
    W, H = 96, 72; s = Place('capshade', 'Market Cap', 'J', 4742, W, H); hub = (48, 16); s.setup(old, hub)
    ex = exits_for(s, D, i, hub, keep_roads=False, lamps='lantern')
    s.blob(48, 30, 13, 7, 'M', .12); s.blob(48, 30, 9, 4.6, 'v', .2, keep='M'); s.clear.append((48, 33, 3.4))
    s.street([[2, 21], [24, 21.4], [48, 21], [72, 21.4], [W - 2, 21]], 'y', 2.4, 'lantern', 12)
    s.street([[48, 21], [48, 26]], 'v', 2.0, None)
    for x in (30, 66): s.street([[x, 21], [x, 50]], 'y', 1.6, None)
    s.street([[12, 50], [48, 50.4], [84, 50]], 'y', 1.8, 'lantern', 14)
    s.put('mushroom_colossal', 48, 34.4)
    s.house('market_hall', 20, 24.4, 'shop', garden=False, label='Cap Market')
    s.house('clinic', 76, 24.4, 'clinic', garden=False)
    s.house('inn', 88, 24.2, 'house', garden=False, label='The Toadstool')
    for k, (x, z) in enumerate(((22, 32), (74, 32), (14, 40), (82, 40), (24, 44), (72, 44), (38, 53.4), (58, 53.4), (8, 54), (88, 54))):
        if s.free(x, z, 1.9, AV, .9): s.put('mushroom_house', x, z, s.r.uniform(.92, 1.08), k % 2 == 1, act='talk', say=s.r.choice([
            'The mushroom house hums faintly. Someone inside is humming back.', 'A note on the door: “Grown, not built. Please knock gently.”', 'Through the window: shelves of jars, all labelled “spores, vintage”.'])
            )
    for x, z in ((6, 30), (90, 30), (16, 62), (80, 62)): s.put('treehouse', x, z)
    for cx, cz in ((36, 40), (60, 40), (12, 47), (84, 47), (30, 62), (66, 62), (48, 62)):
        s.grove(cx, cz, 3.4, 2.4, 4, SPORE_MUSH, floor='M', under=['mushroom_blue', 'mushroom', '@fern'])
    for e in ex: connect(s, e, 'y', 1.6)
    s.place_lamps()
    s.tint_ground([('M', .58, 6, 'J'), ('g', .72, 5, 'J')], 111)
    s.belt(SPORE_MUSH + ['tree_larch'], 'back', 4, 16, ['mushroom_blue', '@fern'])
    for cx, cz in ((10, 9), (86, 9)): s.grass(cx, cz, 4.4, 2.4, .7, .5)
    s.frame(['mushroom_blue', 'mushroom', '@fern', 'moss_patch'], 16)
    s.scatter(['mushroom', 'mushroom_brown', 'mushroom_blue', 'lantern', 'barrel_wood', 'flowerpot'], 22, (6, 12, 90, 62), avoid=AV, gap=.8)
    s.life('frog', 2); s.life('cat', 2)
    s.d['npcSpots'] = [[44, 31.4], [36, 18.6], [60, 18.6]]        # Mother Morel at the great mushroom's door
    s.rolling(.3, 8); s.rise_back(56, 1.6)
    return s.out(8, 'wood', 'y'), {}


def route_fallquarter(D, i, old):
    """a wood where it is always autumn: leaf litter, every tree turned, piles of leaves, a stream, a bench, and the
    Ledger Oak in a clearing of its own"""
    s, ex = BP.route_base('russetwood', D, i, old, 'L', 4743, hub=(56, 12), path='p', amp=3.0)
    s.tint_ground([('g', .6, 7, 'L'), ('y', .72, 5, 'L'), ('u', .84, 4, 'L')], 121)
    s.blob(34, 42, 11, 6, 'L', .2); s.clear.append((34, 42, 6))
    s.put('tree_giant_autumn', 34, 44)
    s.wind([55, 14], [37, 39.4], 'p', 1.1, 1.6); s.wind([57, 15], [64, 28.6], 'p', 1.0, .8)
    s.stream([(98, 64.4), (92, 52), (86, 40), (82, 28), (80, 14), (78, -.4)], 1.2, .5)
    s.clearing(66, 30, [('bench_wood', 0, 0), ('fallen_leaves', 2, -.6), ('lantern', -2, .2)])
    for cx, cz, n in ((14, 24, 10), (60, 52, 12), (100, 30, 9), (12, 56, 8)): s.grove(cx, cz, 9, 6, n, AUTUMN, floor='L', under=['fallen_leaves', 'bush_hawthorn_autumn', 'seedheads'])
    s.belt(AUTUMN, 'back', 6, 26, ['fallen_leaves', 'seedheads'])
    for _ in range(14):
        x, z = s.r.uniform(6, 106), s.r.uniform(6, 58)
        if s.free(x, z, .6, AV + 't', .8): s.put('fallen_leaves', x, z, s.r.uniform(.9, 1.4))
    s.drifts(9, (4.5, 8, 2.2, 3.6), density=.75)
    s.scatter(['@rocks', 'stump', 'roots', 'mushroom_brown', 'seedheads', 'tussock_rust'], 30, (0, 0, 112, 60), avoid=AV + 't', gap=.7)
    s.frame(['bush_hawthorn_autumn', 'fallen_leaves', 'seedheads'], 14)
    s.life('squirrel', 4); s.life('rabbit', 2)
    s.rolling(.6, 7); s.hill(34, 48, 10, 1.2); s.rise_back(50, 2.0)
    return s.out(7, 'wood', bridge='wood'), {}


def route_hypergrowth(D, i, old):
    """jungle over a start-up campus: tall jungle trees hung with lianas, palms, huge leaves, moss, the old campus path in
    cracked concrete, and in a clearing the unicorn statue going green"""
    s, ex = BP.route_base('tanglewild', D, i, old, 'y', 4744, hub=(56, 12), path='i', amp=2.4, width=1.6)
    s.tint_ground([('M', .58, 6, 'y'), ('g', .7, 5, 'y'), ('t', .9, 4, 'yg')], 131)
    s.blob(62, 40, 9, 5, 'i', .35); s.clear.append((62, 42, 5))
    s.put('unicorn_statue', 62, 43.4)
    s.wind([44, 30.5], [56, 39], 'i', 1.4, .6)
    for x, z in ((54, 38), (70, 38.4), (58, 46), (67, 46.4)):
        if s.free(x, z, .5, AV, .4): s.put('jungle_fern', x, z, s.r.uniform(1, 1.3))
    s.put('picnic', 44, 30); s.put('vending', 47.4, 31.6, act='talk', say='Vending machine: out of everything, still taking coins.') if 'vending' in BP.CAT else None
    for cx, cz, n in ((16, 30, 10), (96, 26, 10), (30, 56, 9), (90, 54, 9)): s.grove(cx, cz, 9, 7, n, ['tree_jungle', 'tree_jungle', 'palm_tree', 'palm_small'], floor='y', under=['jungle_fern', 'jungle_fern', '@fern'])
    s.belt(['tree_jungle', 'tree_jungle', 'palm_tree'], 'back', 7, 24, ['jungle_fern', '@fern'])
    s.belt(['tree_jungle', 'palm_tree'], 'left', 5, 8, ['jungle_fern']); s.belt(['tree_jungle', 'palm_tree'], 'right', 5, 8, ['jungle_fern'])
    s.drifts(10, (4.5, 8, 2.2, 3.6), density=.8)
    s.scatter(['jungle_fern', '@fern', 'moss_patch', 'roots', 'stump', 'tree_fallen'], 36, (0, 0, 112, 62), avoid=AV + 't', gap=.6)
    s.frame(['jungle_fern', '@fern', 'palm_small'], 16)
    s.life('frog', 4)
    s.rolling(.7, 6); s.rise_back(48, 2.0)
    return s.out(7, 'wood'), {}


# ================================================================================================ Crystal Caverns' places
CRYSTALS = ['crystal_cluster', 'crystal_cluster', 'crystal_cluster_violet', 'crystal', 'crystal_pink', 'crystal_purple']
CAVE_ROCK = ['stalagmite', 'stalagmite_b', '@rocks', 'boulder']


def route_spread(D, i, old):
    """crystal chasms: two ravines across the cavern floor, rope bridges where the way crosses them, the crystal spire on
    the shelf between, the Variants' needle works on the other side of it, crystals everywhere the light can reach"""
    s, ex = BP.route_base('prism_chasm', D, i, old, 'k', 4751, hub=(56, 12), path='v', amp=2.2, width=1.4)
    s.tint_ground([('X', .6, 6, 'k'), ('r', .74, 5, 'k'), ('P', .84, 4, 'k')], 141)
    s.cliff(9, 23, 103, 27.6, -6, 0, 1.0); s.cliff(12, 43, 99, 47.4, -6, 0, 1.0)            # the chasms
    s.put('crystal_spire', 80, 35.4); s.clear.append((80, 33, 6))
    s.put('needle_works', 30, 36.2); s.clear.append((30, 33, 5))
    for x, z in ((24.6, 31.6), (36.4, 31.8)): s.put('crates', x, z) if s.free(x, z, .6, AV, .6) else None
    for cx, cz in ((14, 16), (98, 16), (18, 55), (94, 56), (56, 56), (60, 34)):
        for _ in range(5):
            x, z = cx + s.r.gauss(0, 3), cz + s.r.gauss(0, 1.8)
            if s.free(x, z, .5, AV + 't', .8, .2): s.put(s.r.choice(CRYSTALS), x, z, s.r.uniform(.8, 1.25), s.r.random() < .5)
    s.drifts(8, (4, 7, 2, 3.2), density=.7)
    s.scatter(CAVE_ROCK + CRYSTALS, 34, (0, 0, 112, 64), avoid=AV + 't', gap=.8)
    s.frame(['stalagmite', 'crystal_cluster', '@rocks'], 12)
    s.rolling(.3, 8); s.rise_back(54, 1.6)
    return s.out(7, 'wood', None, 'wood', 'rope'), {}


def town_mintshaft(D, i, old):
    """a mining town in a cavern: the Great Geode on a square of crystal floor, the assay office, the clinic and the inn
    on the street in front, cave houses in rows behind, two mine mouths in the back wall with a headframe and carts"""
    W, H = 96, 72; s = Place('glimmershaft', 'Mintshaft', 'k', 4752, W, H); hub = (48, 16); s.setup(old, hub)
    ex = exits_for(s, D, i, hub, keep_roads=False, lamps='lantern')
    s.blob(48, 26, 12, 5.6, 'X', .1); s.clear.append((48, 27, 3.4))
    s.street([[2, 20.6], [24, 21], [48, 20.6], [72, 21], [W - 2, 20.6]], 'v', 2.4, 'lantern', 11)
    for x in (37, 59): s.street([[x, 27], [x, 46]], 'v', 1.8, None)
    s.street([[8, 46], [30, 46.4], [48, 46], [66, 46.4], [88, 46]], 'v', 2.0, 'lantern', 13)
    s.street([[48, 46], [48, 60]], 'v', 1.8, None); s.street([[24, 46], [24, 60]], 'v', 1.6, None); s.street([[72, 46], [72, 60]], 'v', 1.6, None)
    s.put('geode_great', 48, 27.6)
    s.house('market_hall', 26, 28.4, 'shop', garden=False, label='Assay Office', lawn=None)
    s.house('clinic', 70, 28.4, 'clinic', garden=False, lawn=None)
    s.house('inn', 81, 28.2, 'house', garden=False, label='The Pickaxe', lawn=None)
    ck = 'cave_house' if 'cave_house' in BP.CAT else 'house_cottage'
    s.row(48.6, 4, 44, [ck, 'house_cottage', ck], garden=False, lawn=None); s.row(48.6, 52, 92, [ck, 'house_cottage', ck], garden=False, lawn=None)
    s.row(24.4, 4, 18, [ck], garden=False, lawn=None); s.row(24.4, 88, 94, [ck], garden=False, lawn=None)
    s.row(34.6, 2, 21, [ck, 'house_cottage'], garden=False, lawn=None); s.row(34.6, 75, 95, ['house_cottage', ck], garden=False, lawn=None)
    for e in ex: connect(s, e, 'v', 1.6)
    s.place_lamps()
    s.put('mine_entrance', 24, 62.4); s.put('mine_entrance', 72, 62.4, 1, True); s.put('mine_headframe', 48, 63.4)
    for x, z, f in ((30, 58.6, False), (66, 58.4, True), (54, 59.6, False)): s.put('minecart', x, z, 1, f)
    for cx, cz in ((10, 36), (86, 36), (10, 60), (86, 60), (40, 38), (58, 38)):
        for _ in range(3):
            x, z = cx + s.r.gauss(0, 2), cz + s.r.gauss(0, 1.4)
            if s.free(x, z, .5, AV, .7, .2): s.put(s.r.choice(CRYSTALS), x, z, s.r.uniform(.8, 1.15), s.r.random() < .5)
    s.tint_ground([('X', .66, 6, 'k'), ('r', .74, 5, 'k')], 151)
    s.frame(['stalagmite', 'crystal_cluster', 'crates', 'barrel_wood'], 14)
    s.scatter(['crates', 'barrel_wood', 'lantern', 'stalagmite', 'crystal_cluster_violet', 'minecart'], 16, (6, 10, 90, 44), avoid=AV, gap=1.0)
    s.life('cat', 2)
    s.d['npcSpots'] = [[54.6, 24.6], [36, 18.4], [60, 18.4]]       # Carat beside the geode
    s.rolling(.2, 8); s.rise_back(54, 1.2)
    return s.out(8, 'wood', 'v'), {}


def route_darkpool(D, i, old):
    """an underground lake: black water filling the cavern's middle, a shore trail round its south side, a jetty with a
    boat, the miners' beacon on the point, glowing crystals all along the water's edge"""
    s, ex = BP.route_base('gloomwater', D, i, old, 'k', 4753, hub=(56, 12), path='v', amp=1.8, width=1.3)
    s.tint_ground([('r', .66, 6, 'k'), ('X', .78, 5, 'k')], 161)
    s.blob(56, 42, 40, 13, 'w', .25); s.blob(56, 43, 35, 10.5, 'd', .25)
    s.wind([56, 14], [26, 28], 'v', 1.2, 1.2); s.wind([56, 14], [84, 30], 'v', 1.2, 1.2)
    s.line([[84, 30], [86, 33], [88.4, 36.4]], 'v', 1.6, keep='')
    s.blob(89, 37.6, 3.6, 2.4, 'r', .2)
    s.put('crystal_beacon', 89.4, 38.0); s.clear.append((88, 35, 3))
    s.line([[30, 29], [36, 33], [41, 36.6]], 'b', 1.4, keep='')                              # the jetty
    s.put('rowboat', 43.6, 38.2, 1, False, block=False); s.put('dock_post', 41.6, 37.8); s.put('lantern', 31.6, 27.4)
    for _ in range(36):
        a = s.r.uniform(math.pi * 1.05, math.pi * 1.95); x, z = 56 + math.cos(a) * 41.5 * s.r.uniform(.95, 1.08), 42 + math.sin(a) * 14 * s.r.uniform(.98, 1.2)
        if s.free(x, z, .45, AV + 't', .7, .2): s.put(s.r.choice(CRYSTALS), x, z, s.r.uniform(.7, 1.1), s.r.random() < .5)
    for _ in range(12):
        x, z = s.r.uniform(6, 106), s.r.uniform(54, 62)
        if s.free(x, z, .6, AV, .5, .3): s.put(s.r.choice(['stalagmite', 'stalagmite_b', 'crystal_cluster_violet']), x, z, s.r.uniform(.9, 1.4))
    s.drifts(7, (4, 6, 2, 3), density=.65)
    s.scatter(CAVE_ROCK + ['crystal_cluster'], 26, (0, 0, 112, 30), avoid=AV + 't', gap=.8)
    s.frame(['stalagmite', 'crystal_cluster', '@rocks'], 12)
    s.life('frog', 2)
    s.rolling(.2, 8); s.rise_back(56, 1.4)
    return s.out(7, 'wood'), {}


def route_frozen(D, i, old):
    """a frozen plain at the mouth of the ice caves: snow, a frozen pond, ice spikes, snowy pines, the safe frozen in
    its block of ice beside the track, and an ice fisher's hole in the pond"""
    s, ex = BP.route_base('rimefrost', D, i, old, 'n', 4754, hub=(56, 12), path='v', amp=2.4, width=1.3)
    s.tint_ground([('I', .7, 6, 'n'), ('r', .78, 5, 'n'), ('g', .84, 4, 'n')], 171)
    s.blob(76, 34, 14, 6, 'I', .2); s.clear.append((76, 34, 6))
    s.put('ice_block_safe', 40, 34.4); s.clear.append((40, 32, 4.5))
    s.put('snowman', 46.4, 31.6) if 'snowman' in BP.CAT else None
    for cx, cz in ((20, 24), (96, 20), (60, 52), (24, 54), (100, 50)):
        for _ in range(5):
            x, z = cx + s.r.gauss(0, 2.6), cz + s.r.gauss(0, 1.6)
            if s.free(x, z, .5, AV + 't', .8, .2): s.put('ice_spikes', x, z, s.r.uniform(.8, 1.3), s.r.random() < .5)
    for cx, cz, n in ((10, 44, 8), (104, 36, 7), (80, 58, 8), (36, 60, 7)):
        s.grove(cx, cz, 7, 4, n, ['tree_pine_snow', 'tree_pine_snow_b', 'tree_pine_snow_small'], floor=None, under=['boulder_snow', 'rocks_snow', 'grass_snow'])
    s.belt(['tree_pine_snow', 'tree_pine_snow_b'], 'back', 5, 16, ['rocks_snow'])
    s.scatter(['grass_snow', 'grass_snow', 'heather', 'snowdrops'], 60, (2, 2, 110, 58), avoid=AV + 't', gap=.5)          # frosted tufts, no tall grass
    s.scatter(['boulder_snow', 'rocks_snow', 'grass_snow', 'ice_spikes', 'stump'], 26, (0, 0, 112, 60), avoid=AV + 't', gap=.8)
    s.frame(['rocks_snow', 'grass_snow', 'ice_spikes'], 12)
    s.life('rabbit', 2)
    s.rolling(.6, 8); s.hill(20, 40, 9, 1.4); s.rise_back(50, 2.4)
    return s.out(7, 'wood'), {}


# ================================================================================================ Coral Trench's places
def route_shoals(D, i, old):
    """reef shallows: coral sand and tide pools, seaweed rock, the sea to the east with the coral tower standing in it,
    the Shell Company on the sand, kelp and buoys in the water, crabs and gulls"""
    s, ex = BP.route_base('conchshell', D, i, old, 'N', 4761, hub=(56, 12), path='S', amp=2.2, width=1.5)
    s.blob(100, 34, 26, 30, 'w', .3, keep='S'); s.blob(108, 34, 20, 28, 'd', .3, keep='S')
    s.tint_ground([('2', .74, 4, 'N'), ('3', .8, 4, 'N'), ('s', .82, 5, 'N')], 181)
    s.put('coral_tower', 79.4, 38.4); s.clear.append((79, 36, 5))                 # in the shallows, close enough to the beach to see
    s.put('shell_company', 34, 34.2, act='talk', say='A brass plate: SHELL CO. LTD — REGISTERED OFFICE OF 412 COMPANIES. The letterbox is full.'); s.clear.append((34, 32, 3.4))
    for _ in range(14):
        x, z = s.r.uniform(80, 110), s.r.uniform(8, 60)
        if s.at(x, z) in 'wd' and s.free(x, z, .4, '', .6, .4): s.put('kelp_tall', x, z, s.r.uniform(.8, 1.2), s.r.random() < .5, block=False)
    for x, z in ((86, 22), (98, 50), (84, 52)): s.put('buoy', x, z, block=False)
    for cx, cz in ((30, 22), (44, 44), (64, 30), (16, 48), (54, 54)): s.blob(cx, cz, 7, 3.4, 'g', .3, keep='St')     # dune grass
    s.drifts(9, (4, 6, 2, 3), density=.7)
    s.scatter(['coral', 'shell_pile', 'seaweed', 'rocks', 'palm_small', 'rock_flat'], 40, (0, 0, 80, 64), avoid=AV + 't', gap=.7)
    s.frame(['seaweed', 'shell_pile', 'rocks'], 12)
    s.life('crab', 4); s.life('gull', 4)
    s.rolling(.25, 9)
    return s.out(7, 'wood'), {}


def town_portfolio(D, i, old):
    """a harbour town: the main street in front with the chandlery, the clinic and the inn, terraces of townhouses and
    flats on a second street behind them, the promenade along the water at the back, piers out into the harbour and
    the yachts moored between them, a little harbour park with palms on the near side of town"""
    W, H = 96, 72; s = Place('kelpport', 'Port Folio', 'g', 4762, W, H); hub = (48, 16); s.setup(old, hub)
    ex = exits_for(s, D, i, hub, keep_roads=False, lamps='streetlamp_b')
    s.blob(48, 72, 70, 21, 'w', .12); s.blob(48, 74, 66, 18, 'd', .12)                            # the harbour
    for z0 in range(52, 72):
        for x in range(0, W):
            if s.at(x + .5, z0 + .5) not in 'wd': s.cell(x + .5, z0 + .5, 'w' if z0 < 54 else 'd')
    s.street([[0, 47.4], [W, 47.4]], 'q', 3.0, 'streetlamp_b', 10)                                 # the promenade
    for x in (20, 48, 76): s.line([[x, 48], [x, 68.6]], 'b', 2.6, keep='')                        # piers
    s.blob(48, 24, 11, 4.6, 'q', .06); s.clear.append((48, 24.6, 3))
    s.street([[2, 20.6], [24, 21], [48, 20.6], [72, 21], [W - 2, 20.6]], 'q', 2.4, 'streetlamp_b', 12)
    s.street([[2, 35.4], [24, 35.6], [48, 35.4], [72, 35.6], [W - 2, 35.4]], 'q', 2.0, 'streetlamp_b', 13)
    for x in (37, 59): s.street([[x, 21], [x, 47]], 'q', 1.8, None)
    s.put('fountain', 48, 24.4) if 'fountain' in BP.CAT else None
    s.house('shop', 26.6, 24.4, 'shop', garden=False, label='The Chandlery', lawn=None)
    s.house('clinic', 69.4, 24.4, 'clinic', garden=False, lawn=None)
    s.house('inn', 81, 24.2, 'house', garden=False, label='The Mooring', lawn=None)
    s.row(24.4, 2, 21, ['townhouse_blue', 'townhouse_yellow', 'townhouse_red'], garden=False, lawn=None)
    s.row(24.4, 87, 95, ['townhouse_red'], garden=False, lawn=None)
    s.row(38.0, 2, 35, ['apartment_a', 'townhouse_red', 'townhouse_blue', 'townhouse_yellow'], garden=False, lawn=None)
    s.row(38.0, 61, 95, ['apartment_b', 'townhouse_yellow', 'townhouse_blue', 'apartment_c'], garden=False, lawn=None)
    s.row(38.0, 40, 56, ['townhouse_blue', 'townhouse_red'], garden=False, lawn=None)
    for e in ex: connect(s, e, 'q', 1.8)
    s.place_lamps()
    s.put('yacht_super', 62, 58.6, block=False); s.put('yacht_small', 33.6, 56.4, block=False); s.put('yacht_small', 88.6, 60.2, 1, True, block=False)
    s.put('sailboat', 8, 61, block=False) if 'sailboat' in BP.CAT else None; s.put('lighthouse_small', 76, 69.2) if 'lighthouse_small' in BP.CAT else None
    for x in frange(4, 92, 6):
        if s.free(x, 49.6, .3, 'wd', .2, .1): s.put(s.r.choice(['bollard', 'dock_post', 'bollard', 'buoy']), x, 49.6, block=False)
    for x, z in ((40, 62), (56, 66), (84, 52)): s.put('buoy', x, z, block=False)
    # the harbour park on the near side of town
    for cx in (20, 76):
        s.blob(cx, 9, 14, 4.6, 'l', .2, keep='q')
        for k in range(5):
            x, z = cx - 12 + k * 6, 9 + s.r.uniform(-1.5, 1.5)
            if s.free(x, z, .5, AV, .8, .2): s.put(s.r.choice(['palm_tree', 'palm_small', 'palm_tree_b']), x, z, s.r.uniform(.9, 1.1), s.r.random() < .5)
        s.drift(['@flowers', 'marigolds', 'tulips_yellow'], cx, 13.2, 9, 1.6, 10, avoid=AV)
    for cx, cz in ((8, 4), (88, 4)): s.grass(cx, cz, 4.4, 2.2, .7, .5)
    s.tint_ground([('l', .62, 6, 'g'), ('s', .8, 5, 'g')], 191)
    s.frame(['planter_box', 'bush_round', 'palm_small', 'bollard'], 14)
    s.scatter(['bench_metal', 'planter_round', 'barrel_wood', 'crates', 'bin'], 18, (6, 12, 90, 46), avoid='wdqb', gap=1.0)
    s.life('gull', 6, area=[0, 46, 96, 70]); s.life('cat', 2); s.life('crab', 2, area=[0, 49, 96, 52])
    s.d['npcSpots'] = [[52, 46], [36, 18.4], [60, 18.4]]
    s.rolling(.12, 8)
    return s.out(8, 'wood', 'q'), {}


def route_bottomline(D, i, old):
    """open water over the trench, ridden: deep water all round, shallow lanes over sand bars, rocks breaking the
    surface, kelp forests, a line of buoys marking the way to the plant"""
    s, ex = BP.route_base('abyssal_trench', D, i, old, 'd', 4763, hub=(56, 14), path='S', amp=2.6, width=1.8)
    s.roads.clear()
    for cx, cz, rx, rz in ((56, 14, 12, 5), (24, 36, 8, 4), (88, 30, 9, 4), (60, 52, 7, 3.4)):
        s.blob(cx, cz, rx + 3, rz + 2.4, 'w', .3); s.blob(cx, cz, rx + 1, rz + .6, '3', .3); s.blob(cx, cz, rx * .6, rz * .6, 'N', .35)
    for e in ex: s.wind([56, 14], e, 'S', 2.0, 2.6, keep='')
    for _ in range(40):
        x, z = s.r.uniform(2, 110), s.r.uniform(4, 62)
        if s.at(x, z) in 'wd' and s.free(x, z, .4, '', .8, .5): s.put('kelp_tall', x, z, s.r.uniform(.8, 1.3), s.r.random() < .5, block=False)
    for k in range(8): s.put('buoy', 20 + k * 11, 24 + 8 * math.sin(k * .9), block=False)
    s.scatter(['rocks', 'seaweed', 'shell_pile', 'coral'], 24, (0, 0, 112, 64), avoid='pd', gap=.6, on='N3w')
    s.life('gull', 4)
    return s.out(7, 'wood'), {}


def route_pressing(D, i, old):
    """the pressing plant on its platform over the trench: concrete decks on piles, the plant at the back, crates of
    test pressings, drums, a crane, lamps; the water round it ridden"""
    s, ex = BP.route_base('vinyl_works', D, i, old, 'd', 4764, hub=(56, 29), path='S', amp=2.2, width=1.8)    # you arrive on the deck
    s.roads.clear()
    s.blob(56, 13, 13, 5, 'w', .3); s.blob(56, 13, 11, 3.6, '3', .3)
    for e in ex: s.wind([56, 29], e, 'S', 2.0, 2.4, keep='')
    for x0, x1, z0, z1 in ((30, 82, 26, 50), (50, 62, 16, 26)):                                  # the decks, over the lanes
        for z in frange(z0, z1, .5):
            for x in frange(x0, x1, .5): s.cell(x + .25, z + .25, 'i')
    s.roads.append(([[56, 16], [56, 30]], 2.0))
    s.put('pressing_plant', 56, 44.6); s.clear.append((56, 40, 7))
    for x, z in ((34, 30), (36.6, 30.4), (77, 30), (74.4, 31)): s.put('record_crates', x, z)
    for x, z in ((33, 36), (79, 36.4)): s.put('barrels', x, z)
    s.put('crane', 78.6, 44) if 'crane' in BP.CAT else None
    for x in (32, 44, 68, 80):
        s.put('streetlamp_b', x, 27.2)
    for x in frange(31, 82, 3.2): s.put('bollard', x, 49.6) if s.free(x, 49.6, .3, 'wd', .2, .1) else None
    for _ in range(26):
        x, z = s.r.uniform(2, 110), s.r.uniform(4, 62)
        if s.at(x, z) in 'wd' and s.free(x, z, .4, '', .8, .5): s.put('kelp_tall', x, z, s.r.uniform(.8, 1.2), s.r.random() < .5, block=False)
    s.life('gull', 4)
    s.d['npcSpots'] = [[60.6, 37.6], [47, 33], [66, 33]]                                         # Cass at the plant's door
    return s.out(7, 'iron'), {}


# ================================================================================================ Cloud Spire's places
def route_serverfarm(D, i, old):
    """silicon flats: fields of solar panels in rows on one side, server racks on concrete pads on the other, the Cloud's
    cooling tower behind them, fences, cable runs"""
    s, ex = BP.route_base('circuit_terraces', D, i, old, 'g', 4771, hub=(56, 12), path='a', amp=2.0, width=1.6)
    s.tint_ground([('u', .62, 6, 'g'), ('G', .74, 5, 'g')], 201)
    for z in frange(22, 44, 3.4):                                                                 # the solar field
        for x in frange(8, 42, 3.8):
            if s.free(x, z, .8, AV + 't', 1.0, .05): s.put('solar_panel', x, z)
    s.blob(84, 38, 14, 6, 'i', .1)
    for z in (33.6, 37.6, 41.6):
        for x in frange(74, 96, 3.6):
            if s.free(x, z, .6, AV + 't', .8, .05): s.put('server_rack', x, z)
    s.put('cloud_server', 84, 52); s.clear.append((84, 50, 6))
    for x in frange(4, 108, 2.4):
        if s.free(x, 60.6, .3, 'wd', .5, .02): s.put('fence', x, 60.6)
    s.drifts(9, (4, 7, 2, 3.4), density=.75)
    s.scatter(['@rocks', 'bush_round', 'dry_grass', 'trash', 'crate', 'pipe'], 24, (0, 0, 112, 60), avoid=AV + 't', gap=.8)
    s.frame(['bush_round', 'dry_grass', '@rocks'], 12)
    s.life('crow', 3) if 'crow' in (D['scenery'].get('life') or {}) else s.life('pigeon', 3)
    s.rolling(.3, 9); s.rise_back(54, 1.2)
    return s.out(7, 'iron'), {}


def town_upside(D, i, old):
    """the city at the foot of the Spire: the tower on its plaza at the back, the night market lane leading up to it,
    blocks of flats, offices and townhouses on paved streets, little lawns with trees, cars at the kerb"""
    W, H = 96, 72; s = Place('nimbus', 'Upside City', 'q', 4772, W, H); hub = (48, 16); s.setup(old, hub)
    ex = exits_for(s, D, i, hub, keep_roads=False, lamps='streetlamp_b')
    s.blob(48, 53, 15, 8, 'T', .06); s.clear.append((48, 52, 6.6))
    s.street([[2, 20.6], [24, 21], [48, 20.6], [72, 21], [W - 2, 20.6]], 'a', 2.6, 'streetlamp_b', 12)
    for x in (26, 70): s.street([[x, 21], [x, 46]], 'a', 2.2, None)
    s.street([[2, 46], [30, 46], [48, 46], [66, 46], [W - 2, 46]], 'a', 2.2, 'streetlamp_b', 13)
    s.street([[48, 21], [48, 45]], 'q', 2.4, None)
    s.put('spire_tower', 48, 55.4)
    for z in frange(26, 42, 3.4):                                                                 # the night market
        for side in (-1, 1):
            x = 48 + side * 4.2
            if s.free(x, z, .9, 'wd', .2, .05): s.put('night_stall', x, z, 1, side > 0, act='talk', say=s.r.choice([
                'Stall: “Dumplings, two for one, one for two. Don’t ask.”', 'Stall: “Glow sticks! For the tower’s shadow side.”', 'Stall: “Vinylla merch. Unofficial. Same price as official.”',
                'Stall: “Noodles. The only thing here that isn’t limited edition.”']))
    s.house('shop_mart', 14.6, 24.4, 'shop', garden=False, label='Night Market', lawn=None) or s.house('shop', 14.6, 24.4, 'shop', garden=False, label='Night Market', lawn=None)
    s.house('clinic', 81.4, 24.4, 'clinic', garden=False, lawn=None)
    s.house('inn', 60, 24.2, 'house', garden=False, label='The Penthouse (Lite)', lawn=None)
    blocks = ['apartment_a', 'townhouse_blue', 'office_tower', 'townhouse_red', 'apartment_b', 'townhouse_yellow', 'apartment_c']
    s.row(24.4, 2, 24, blocks, garden=False, lawn=None); s.row(24.4, 28, 41, ['townhouse_red', 'townhouse_blue'], garden=False, lawn=None); s.row(24.4, 72, 95, blocks[2:], garden=False, lawn=None)
    for z in (31.4, 38.4):
        s.row(z, 2, 24, blocks[z > 35:], garden=False, lawn=None); s.row(z, 28, 41, ['townhouse_blue', 'townhouse_yellow'], garden=False, lawn=None)
        s.row(z, 55, 68, ['townhouse_red', 'townhouse_blue'], garden=False, lawn=None); s.row(z, 72, 95, blocks[1:], garden=False, lawn=None)
    s.row(49, 2, 32, ['office_tower', 'apartment_a', 'townhouse_red'], garden=False, lawn=None); s.row(49, 64, 95, ['apartment_c', 'office_tower', 'townhouse_blue'], garden=False, lawn=None)
    s.row(62, 2, 32, ['apartment_b', 'townhouse_yellow', 'apartment_a'], garden=False, lawn=None); s.row(62, 64, 88, ['townhouse_red', 'apartment_c'], garden=False, lawn=None)
    for e in ex: connect(s, e, 'q', 2.0)
    s.place_lamps()
    for x, z in ((41.4, 44.2), (54.6, 44.2)): s.put('neon_sign', x, z) if 'neon_sign' in BP.CAT else None
    for x, z, k in ((10, 18.2, 'car_blue'), (32, 18.2, 'car_red'), (66, 18.2, 'car_yellow'), (86, 18.2, 'car_mint')): s.put(k, x, z) if k in BP.CAT else None
    s.put('bus_shelter', 54.6, 18.6) if 'bus_shelter' in BP.CAT else None
    # little lawns with trees: the near side of the main street, and round the plaza
    for cx, cz, rx in ((14, 10, 10), (82, 10, 10), (36, 56, 3.4), (60, 56, 3.4)):
        s.blob(cx, cz, rx, 3.2 if rx > 5 else 2.4, 'l', .2, keep='aqT' if rx > 5 else 'a')
        for k in range(int(rx // 3) + 1):
            x, z = cx - rx + 2 + k * 3.2, cz + s.r.uniform(-.8, .8)
            if s.free(x, z, .5, AV, .6, .2): s.put(s.r.choice(['street_tree', 'tree_blossom', 'street_tree']), x, z)
    for cx, cz in ((10, 4), (86, 4)): s.grass(cx, cz, 4.2, 2.0, .7, .5)
    s.frame(['planter_box', 'bollard', 'bin', 'bench_metal'], 14)
    s.scatter(['planter_round', 'bench_metal', 'bin', 'bollard', 'planter_box'], 22, (4, 10, 92, 46), avoid='wdaT', gap=1.0)
    s.life('pigeon', 8, area=[30, 20, 66, 44]); s.life('cat', 2)
    s.d['npcSpots'] = [[52, 18.6], [36, 18.4], [62, 18.4]]
    s.rolling(.06, 8)
    return s.out(8, 'iron', 'q'), {}


def route_bubbleland(D, i, old):
    """an abandoned theme park: faded paving with grass coming through, the gate with its fallen letter where you come
    in, the stopped Ferris wheel, the carousel, empty stalls and a food truck, lamps that still come on"""
    s, ex = BP.route_base('fizzpop', D, i, old, 'q', 4773, hub=(56, 12), path='q', amp=1.6, width=1.8)
    s.tint_ground([('g', .58, 6, 'q'), ('G', .7, 5, 'qg'), ('u', .82, 4, 'q')], 211)
    e0 = ex[0] if ex else (30, 63)
    s.put('bubble_gate', e0[0], min(58, e0[1] - 5.2)); s.clear.append((e0[0], e0[1] - 5, 4))
    s.put('ferris_wheel', 80, 44); s.clear.append((80, 41, 7))
    s.put('carousel_broken', 38, 34); s.clear.append((38, 32, 4.5))
    for x, z in ((60, 26), (66, 27.4), (22, 22), (92, 24)): s.put(s.r.choice(['stall', 'stall_merch', 'night_stall']), x, z, 1, s.r.random() < .5) if s.free(x, z, 1.2, AV, .6, .1) else None
    s.put('food_truck', 50, 46) if 'food_truck' in BP.CAT else None
    for x, z in ((48, 22), (70, 34), (28, 44), (90, 54)): s.put('streetlamp', x, z) if s.free(x, z, .3, AV, .4, .1) else None
    s.drifts(10, (4, 7, 2, 3.4), density=.8)
    s.scatter(['bin', 'trash', 'salesign', 'bench_wood', 'bush_round', 'nettles', 'thistles', 'tires'], 34, (0, 0, 112, 62), avoid=AV + 't', gap=.7)
    s.frame(['bush_round', 'nettles', 'trash'], 12)
    s.life('pigeon', 5); s.life('crow', 3) if 'crow' in (D['scenery'].get('life') or {}) else None
    s.rolling(.2, 9)
    return s.out(7, 'iron'), {}


def route_bracket(D, i, old):
    """walkways up the outside of the Spire through the clouds: cloud-floor terraces climbing to the back, sky-stone
    paths with stairs between them, and at the top the penthouse door"""
    s, ex = BP.route_base('skygarden', D, i, old, 'U', 4774, hub=(56, 12), path='V', amp=2.0, width=1.6)
    s.wind([56, 14], [56, 56], 'V', 1.8, 2.6)
    s.terrace(-1, 28, s.W + 1, 65, 2.4, wall=False, wobble=1.2); s.terrace(-1, 44, s.W + 1, 65, 2.4, wall=False, wobble=1.2)
    s.tint_ground([('g', .7, 5, 'U'), ('G', .8, 4, 'U'), ('V', .84, 4, 'U')], 241)                 # sky gardens
    s.blob(56, 57, 10, 4, 'T', .1); s.clear.append((56, 57, 5))
    s.put('penthouse_gate', 56, 59.4)
    for x in (40, 72): s.put('billboard_tour', x, 52) if 'billboard_tour' in BP.CAT else None
    for x, z in ((48, 52), (64, 52), (46, 36), (66, 36), (50, 22), (62, 22)): s.put('lantern', x, z) if s.free(x, z, .3, AV, .4, .1) else None
    s.drifts(8, (4, 7, 2, 3), density=.7)
    s.scatter(['bush_round', 'bush_box', 'planter_round', 'bench_metal', 'flowerpot', 'statue'], 22, (0, 0, 112, 62), avoid=AV + 't', gap=1.2)
    s.frame(['bush_round', 'planter_round', 'flowerpot'], 12)
    s.rolling(.2, 10)
    s.d['npcSpots'] = [[60.4, 55], [48, 40], [64, 40]]
    return s.out(7, 'iron', None, 'stone'), {}


# ================================================================================================ the Inner Sun's places
def route_ath(D, i, old):
    """a desert of sun-baked stone under the Inner Sun: gold-veined rock, sand, cacti, the broken column of the all-time
    high with its ticker still running"""
    s, ex = BP.route_base('zenith_steps', D, i, old, 'Y', 4781, hub=(56, 12), path='A', amp=2.6, width=1.4)
    s.tint_ground([('W', .62, 6, 'Y'), ('s', .72, 5, 'Y'), ('B', .82, 4, 'Y')], 221)
    s.put('ticker_column', 64, 34.4); s.clear.append((64, 33, 4))
    for cx, cz in ((24, 30), (92, 22), (40, 52), (88, 50)): s.blob(cx, cz, 7, 3.6, 'B', .3, keep='At')
    s.drifts(8, (4, 6, 2, 3), density=.7)
    s.scatter(['cactus', 'cactus_tall', 'cactus_round', 'dry_bush', 'dry_grass', '@rocks', 'boulder', 'scree'], 40, (0, 0, 112, 64), avoid=AV + 't', gap=.8)
    s.put('mesa', 18, 56) if 'mesa' in BP.CAT else None; s.put('mesa', 98, 58) if 'mesa' in BP.CAT else None
    s.frame(['dry_grass', 'dry_bush', '@rocks'], 12)
    s.life('lizard', 4)
    s.rolling(.6, 8); s.rise_back(50, 2.4)
    return s.out(7, 'wood'), {}


def route_closingbell(D, i, old):
    """the old road to the Inner Sun: marble paving between ruined columns, the Closing Bell on its gantry beside the
    road, sun-baked stone and gold-veined rock all round"""
    s, ex = BP.route_base('bellwether_rise', D, i, old, 'Y', 4782, hub=(56, 14), path='T', amp=1.4, width=2.0)
    s.tint_ground([('W', .64, 6, 'Y'), ('s', .76, 5, 'Y')], 231)
    s.blob(58, 40, 10, 5, 'T', .1); s.put('closing_bell', 58, 43.6); s.clear.append((58, 40, 5.5))
    s.wind([56, 16], [57.6, 36.4], 'T', 2.0, .5)                                                   # up to the bell
    for (px, pz) in ((44, 24), (72, 24), (40, 34), (76, 34)):
        s.put('statue', px, pz) if 'statue' in BP.CAT and s.free(px, pz, .6, AV, .6, .1) else None
    for cx, cz in ((20, 26), (96, 24), (30, 52), (90, 52)): s.blob(cx, cz, 7, 3.6, 'B', .3, keep='Tt')
    s.drifts(7, (4, 6, 2, 3), density=.7)
    s.scatter(['@rocks', 'boulder', 'cactus', 'dry_bush', 'dry_grass', 'scree'], 34, (0, 0, 112, 64), avoid=AV + 't', gap=.8)
    s.frame(['dry_grass', '@rocks', 'dry_bush'], 12)
    s.life('lizard', 3)
    s.rolling(.4, 8); s.rise_back(52, 2.0)
    return s.out(7, 'wood'), {}


def route_innersun(D, i, old):
    """the centre of the world: a platform of marble and gold under the sun, the press at its back, a long way up to it
    from the road, the Variants keeping the floor polished"""
    s, ex = BP.route_base('innersun', D, i, old, 'W', 4783, hub=(56, 12), path='T', amp=1.2, width=2.2)
    s.wind([56, 14], [56, 46], 'T', 3.0, .6)
    s.blob(56, 50, 22, 9, 'T', .06); s.clear.append((56, 50, 9))
    s.put('sun_press', 56, 56.4)
    for x, z in ((40, 46), (72, 46), (42, 34), (70, 34), (46, 24), (66, 24)): s.put('lantern', x, z) if s.free(x, z, .3, AV, .4, .1) else None
    for cx, cz in ((44, 26), (68, 26), (40, 40), (72, 40)): s.blob(cx, cz, 6, 3.2, 'B', .3, keep='Tt')
    s.drifts(6, (4, 6, 2, 3), density=.65)
    s.scatter(['@rocks', 'boulder', 'scree', 'dry_grass'], 22, (0, 0, 112, 64), avoid=AV + 't', gap=1.0)
    s.rolling(.2, 10)
    s.d['npcSpots'] = [[62.6, 46], [48, 38], [64, 38]]
    return s.out(7, 'iron'), {}

BUILD = {'fanfare_fields': route_festival, 'twinpetal': town_twofold, 'petalfall': route_blossom, 'rootwater': route_margins,
         'grapevine_hills': route_vintage, 'goldvine': town_bullion, 'saltpan_flats': route_flattax, 'badlands': route_badlands,
         'puffcap': route_sporewood, 'capshade': town_marketcap, 'russetwood': route_fallquarter, 'tanglewild': route_hypergrowth,
         'prism_chasm': route_spread, 'glimmershaft': town_mintshaft, 'gloomwater': route_darkpool, 'rimefrost': route_frozen,
         'conchshell': route_shoals, 'kelpport': town_portfolio, 'abyssal_trench': route_bottomline, 'vinyl_works': route_pressing,
         'circuit_terraces': route_serverfarm, 'nimbus': town_upside, 'fizzpop': route_bubbleland, 'skygarden': route_bracket,
         'zenith_steps': route_ath, 'bellwether_rise': route_closingbell, 'innersun': route_innersun}
LOOK_OF = {'fanfare_fields': 'meadow', 'twinpetal': 'twinpetal', 'petalfall': 'petalfall', 'rootwater': 'mangrove', 'grapevine_hills': 'grapevine_hills', 'goldvine': 'goldvine', 'saltpan_flats': 'saltpan_flats', 'badlands': 'badlands',
           'puffcap': 'spore', 'capshade': 'capvillage', 'russetwood': 'fall', 'tanglewild': 'jungle',
           'prism_chasm': 'crystal', 'glimmershaft': 'cavetown', 'gloomwater': 'gloomwater', 'rimefrost': 'tundra', 'conchshell': 'reef', 'kelpport': 'harbour', 'abyssal_trench': 'trench',
           'vinyl_works': 'press', 'circuit_terraces': 'server', 'nimbus': 'nimbus', 'fizzpop': 'bubble', 'skygarden': 'skygarden', 'zenith_steps': 'zenith_steps', 'bellwether_rise': 'bell', 'innersun': 'sun'}
TOWNS = {'twinpetal', 'goldvine', 'capshade', 'glimmershaft', 'kelpport', 'nimbus'}


# ================================================================================================ ways in
# A new region's first road leaves from a place that is already there. That place gets a way out on the side facing
# the new region (an edge exit, a stretch of its own ground out to the edge, a signpost), and nothing else of it
# changes. (side, where along that side in metres, where the way out starts, its ground, its width)
WAYS_IN = {('lanternhall', 'fanfare_fields'): dict(side='E', at=20.0, start=66.0, ch='T', width=2.2)}


def open_way(D, sid, nid, spec, rep):
    import base64, struct
    sc = D['maps'][sid]; i, j = node_index(D, sid), node_index(D, nid)
    L = next(L for L in D['roads'] if {L[0], L[1]} == {i, j}); J = L[3]; mine = 'a' if L[0] == i else 'b'
    E = sc.setdefault('edgeExits', []); ex = sc.setdefault('exits', []); ids = {e['id'] for e in E}
    if J.get(mine) in ids: return
    if len(E) != len(ex): rep.append(f'!! {sid}: its exits and edge exits disagree, way to {nid} not opened'); return
    W, H = sc['w'], sc['h']; side, at, start, ch, wd = spec['side'], spec['at'], spec['start'], spec['ch'], spec['width']; inn = 1.1
    base = {'N': 'north', 'S': 'south', 'E': 'east', 'W': 'west'}[side]; eid, k = base, 2
    while eid in ids: eid, k = base + str(k), k + 1
    if side in 'EW': cells = [(x, z) for x in (range(int(start), W) if side == 'E' else range(0, int(start) + 1)) for z in range(H) if abs(z + .5 - at) <= wd / 2 + .3]
    else: cells = [(x, z) for z in (range(int(start), H) if side == 'N' else range(0, int(start) + 1)) for x in range(W) if abs(x + .5 - at) <= wd / 2 + .3]
    # the way must be level with where it starts (no cliff or terrace step on it)
    if sc.get('steps'):
        raw = base64.b64decode(sc['steps']); st = struct.unpack('<%dh' % (len(raw) // 2), raw); W2 = W * 2
        hs = {st[(2 * z + dz) * W2 + 2 * x + dx] for x, z in cells for dx in (0, 1) for dz in (0, 1)}
        if len(hs) > 1: rep.append(f'!! {sid}: the way to {nid} crosses a step {sorted(hs)}, not opened'); return
    rows = [list(r) for r in sc['tiles']]
    for x, z in cells: rows[H - 1 - z][x] = ch
    sc['tiles'] = [''.join(r) for r in rows]
    def on_way(p):
        if side in 'EW': return abs(p['z'] - at) < wd / 2 + .9 and (p['x'] > start - .5 if side == 'E' else p['x'] < start + .5)
        return abs(p['x'] - at) < wd / 2 + .9 and (p['z'] > start - .5 if side == 'N' else p['z'] < start + .5)
    gone = [p for p in sc['props'] if on_way(p)]
    sc['props'] = [p for p in sc['props'] if p not in gone]
    pt = {'E': [W - inn, at], 'W': [inn, at], 'N': [at, H - inn], 'S': [at, inn]}[side]
    o = D['locations'][j]; say = f"{o['name']} this way. {'Route ' + o['route'].split()[-1] + '.' if o.get('route') else ''}".strip()
    sp = {'E': (W - 3.4, at + wd / 2 + .9), 'W': (3.4, at + wd / 2 + .9), 'N': (at + wd / 2 + .9, H - 3.4), 'S': (at + wd / 2 + .9, 3.4)}[side]
    sc['props'].append({'k': 'signpost', 'x': round(sp[0], 2), 'z': round(sp[1], 2), 'act': 'sign', 'say': say, TAG: 1})
    E.append({'id': eid, 'side': side, 't': round(at / (H if side in 'EW' else W), 4), 'in': inn, 'width': 2}); ex.append([round(pt[0], 2), round(pt[1], 2)])
    J[mine] = eid
    rep.append(f'{sid}: a way out to {nid} ({eid}, {len(cells)} m² of ground, {len(gone)} props taken off it: {", ".join(p["k"] for p in gone) or "none"})')


# ================================================================================================ data
def add_region(D, R, force=False, rep=None):
    rep = rep if rep is not None else []
    # places on the map, after the ones there are
    for n in R['nodes']:
        i = node_index(D, n['id'])
        e = {'name': n['name'], 'pool': n['pool'], 'route': n['route'], 't': R['t'], 'blurb': n['blurb'], 'lon': n['lon'], 'lat': n['lat'], 'battleStage': n['area'],
             'mapId': n['id'], 'id': n['id'], 'kind': n['kind'], 'biome': n['biome'], 'routeName': n['route'], 'mood': n.get('mood') or R['mood'], 'region': R['id'], TAG: 1}
        if n['kind'] == 'town': e['town'] = 1
        for k in ('shop', 'boutique', 'gate', 'gateText', 'ride', 'music'):
            if n.get(k) is not None: e[k] = n[k]
        if i is None: D['locations'].append(e); rep.append(f'place {n["id"]}')
        elif force and D['locations'][i].get(TAG): D['locations'][i] = e
    # roads
    have = {L[3].get('id') for L in D['roads']}
    for a, b, cost, name in R['links']:
        ia, ib = node_index(D, a), node_index(D, b); rid = f'road:{a}-{b}'
        if rid in have: continue
        D['roads'].append([ia, ib, cost, {'a': 'south', 'b': 'north', 'id': rid, 'from': a, 'to': b, 'name': name}]); rep.append(rid)
    # places already there that a road of the region leaves from get their way out
    new = {n['id'] for n in R['nodes']}
    for a, b, cost, name in R['links']:
        for sid, nid in ((a, b), (b, a)):
            if sid in new or nid not in new: continue
            sc = D['maps'].get(D['locations'][node_index(D, sid)].get('mapId') or sid)
            if not sc or sc.get(TAG): continue
            if (sid, nid) in WAYS_IN: open_way(D, sid, nid, WAYS_IN[(sid, nid)], rep)
            else: rep.append(f'!! {sid} has no way out planned toward {nid}')
    for k, v in R['pools'].items():
        if k not in D['pools'] or force: D['pools'][k] = v
    for k, v in R['people'].items():
        if k not in D['people'] or force: D['people'][k] = {'look': v['look']}
    for k, v in R['trainers'].items():
        if k in D['trainers'] and not force: continue
        t = copy.deepcopy(v); t['node'] = node_index(D, t['node']); t[TAG] = 1; D['trainers'][k] = t; rep.append(f'trainer {k}')
    for k, v in R['shops'].items():
        if k not in D['shops'] or force: D['shops'][k] = v
    for k, v in R.get('moods', {}).items():
        if k not in D['moods'] or force: D['moods'][k] = v
    L = D.setdefault('lore', {}); P = L.setdefault('locations', {})
    for k, v in R['lore'].items():
        if k not in P or force: P[k] = v
    C = L.setdefault('chat', {})
    for k, v in R['chat'].items():
        if k not in C or force: C[k] = v
    # the map's "Unexplored" label for the region goes
    if R.get('future'): D['regions'] = [g for g in D['regions'] if g.get('name') != R['future']]
    return rep


# what may grow wild (the wild growth, "w": 42) where the nature pool reads the ground through borrowed letters
# (BP.NEWLET): the trench's sand lanes and the coral sand count as sand, and so do sun-baked stone and gold-veined
# rock, so lavender, rosemary, olive trees and cypresses grew along the ridden lanes, down the beach and round the
# Inner Sun. Under the ground nothing grows but moss and stones; on the water only stones break the surface.
SAND = set('sSN34')
WILD_ONLY = {
    'cave': {'moss_patch', 'stones_flat', 'scree', 'boulder_lichen', 'roots'},
    'water': {'stones_flat', 'scree', 'boulder_lichen'},
    'dune': {'dry_grass', 'stones_flat', 'scree', 'boulder_lichen'},
    'scorched': {'dry_grass', 'thistles', 'seedheads', 'dandelions', 'dandelion_clocks', 'stones_flat', 'scree', 'boulder_lichen'},
}
SCORCHED = {'desert', 'sun'}          # the biomes of the road to the Inner Sun


def wild_rule(sc, ch):
    if sc.get('indoor'): return 'cave'
    if sc.get('ride'): return 'water'
    if sc.get('waterKind') == 'sea' and ch in SAND: return 'dune'
    if sc.get('biome') in SCORCHED: return 'scorched'
    return None


def prune_wild(sc):
    """takes out the wild growth that wild_rule doesn't allow where it stands; returns how many went (only "w": 42
    props: nothing placed by hand or by this tool's own builders)"""
    h, T = sc['h'], sc['tiles']
    def ch(x, z):
        j, i = h - 1 - int(z), int(x)                # the game's rows run from the far edge (terrainAt)
        return T[j][i] if 0 <= j < h and 0 <= i < len(T[j]) else ''
    def ok(p):
        r = wild_rule(sc, ch(p['x'], p['z']))
        return r is None or p['k'] in WILD_ONLY[r]
    n0 = len(sc['props'])
    sc['props'] = [p for p in sc['props'] if p.get('w') != 42 or ok(p)]
    return n0 - len(sc['props'])


# each region town's shop opens into a room of its own (tools/build-interiors.py makes them: run it first)
SHOP_ROOM = {'twinpetal': 'int_twinpetal_market', 'goldvine': 'int_bullion_exchange', 'capshade': 'int_cap_market',
             'glimmershaft': 'int_assay_office', 'kelpport': 'int_chandlery', 'nimbus': 'int_night_market'}
# every place has a resting spot and something that moves; these were built without one or the other
REST = ('bench_wood', 'bench_metal', 'bench', 'log', 'log_mossy', 'campfire', 'picnic', 'deck_chair')
EXTRAS = {
    'saltpan_flats': dict(rest=['bench_wood'], life=('lizard', 3)), 'capshade': dict(rest=['bench_wood']),
    'prism_chasm': dict(rest=['log'], life=('lizard', 3)), 'glimmershaft': dict(rest=['bench_metal']), 'gloomwater': dict(rest=['log_mossy']),
    'rimefrost': dict(rest=['log', 'campfire']), 'conchshell': dict(rest=['deck_chair']), 'abyssal_trench': dict(rest=['log']),
    'vinyl_works': dict(rest=['bench_metal']), 'circuit_terraces': dict(rest=['bench_metal']), 'zenith_steps': dict(rest=['bench_wood']),
    'bellwether_rise': dict(rest=['bench_metal']), 'innersun': dict(rest=['bench_wood'], life=('lizard', 2)), 'skygarden': dict(life=('pigeon', 5)),
}
NO_REST = set('wdpcSTqhvaebmKI')          # water, paths, roads and paving: a bench goes beside them, not on them


def rest_spot(sc, cat, r=1.4, also=()):
    """the nearest place to where you arrive with room for a bench (and whatever goes with it, at the offsets in
    also): dry, level ground off the road, 3.5 to 12 m out, clear of the exits and of everything standing there"""
    import base64, struct
    W, H = sc['w'], sc['h']; hub = sc['hub']; T = sc['tiles']
    st = struct.unpack('<%dh' % (len(base64.b64decode(sc['steps'])) // 2), base64.b64decode(sc['steps'])) if sc.get('steps') else None
    def ch(x, z):
        j, i = H - 1 - int(z), int(x)
        return T[j][i] if 0 <= j < H and 0 <= i < len(T[j]) else 'w'
    def level(x, z):
        if not st: return True
        hs = {st[(int(2 * zz)) * W * 2 + int(2 * xx)] for xx in (x - .8, x, x + .8) for zz in (z - .6, z, z + .6) if 0 <= xx < W and 0 <= zz < H}
        return len(hs) == 1
    def clear(x, z):
        for e in sc.get('exits') or []:
            if math.hypot(x - e[0], z - e[1]) < 4: return False
        for p in sc['props']:
            M = cat.get(p['k']) or {}; s = p.get('s', 1)
            pr = (max(M['box']) * .5 * s + .4) if M.get('box') else ((M.get('solid') or .3) * s + .3)
            if math.hypot(x - p['x'], z - p['z']) < pr + r * .5: return False
        return True
    for rad in [3.5 + .5 * k for k in range(18)]:
        for a in range(24):
            ang = a * math.pi / 12; x, z = hub[0] + math.cos(ang) * rad, hub[1] + math.sin(ang) * rad
            if not (1.5 < x < W - 1.5 and 1.5 < z < H - 1.5): continue
            pts = [(x, z)] + [(x + ox, z + oz) for ox, oz in also]
            if any(ch(px + dx, pz + dz) in NO_REST for px, pz in pts for dx in (-.7, 0, .7) for dz in (-.5, 0, .5)): continue
            if all(1.5 < px < W - 1.5 and 1.5 < pz < H - 1.5 and level(px, pz) and clear(px, pz) for px, pz in pts): return round(x, 2), round(z, 2)
    return None


def finish_v47(sid, sc, D, cat):
    """the shop's own room, a resting spot and something that moves (only what's missing; "v47extra" marks what this
    adds); returns what it did"""
    out = []
    room = SHOP_ROOM.get(sid)
    if room and room in D['maps']:
        for p in sc['props']:
            if p.get('act') == 'shop' and not p.get('room'): p['room'] = room; out.append(f'shop opens into {room}')
    E = EXTRAS.get(sid) or {}
    if E.get('rest') and not any(p['k'] in REST for p in sc['props']):
        at = rest_spot(sc, cat, also=[(0, -1.6)] if len(E['rest']) > 1 else [])
        if at:
            sc['props'].append({'k': E['rest'][0], 'x': at[0], 'z': at[1], 'v47extra': 1})
            if len(E['rest']) > 1: sc['props'].append({'k': E['rest'][1], 'x': at[0], 'z': round(at[1] - 1.6, 2), 'v47extra': 1})   # the fire in front
            out.append(f'{" and ".join(E["rest"])} at {at}')
        else: out.append('!! no room for a resting spot')
    if E.get('life') and not sc.get('life'):
        sc['life'] = [{'k': E['life'][0], 'n': E['life'][1]}]; out.append(f'{E["life"][1]} {E["life"][0]}s')
    m, r, l = BP.CW.clear_scene(sc, D['scenery']['props'], BP.CW.ppu(D))   # alpha 0.1: nothing in front of a window
    if m or r or l: out.append(f'windows: {m} props moved aside, {r} taken away' + (f', {l} still in the way' if l else ''))
    return out


def build_places(D, R, cat, nature, force=False, only=None, mp=None):
    BP.CAT.update(cat); out = []
    for n in R['nodes']:
        sid = n['id']
        if only and sid not in only: continue
        old = D['maps'].get(sid)
        if old and old.get('keep'): out.append(f'{sid}: marked keep, left alone'); continue
        if old and not force and not old.get(TAG): out.append(f'{sid}: a scene of that name is already there, left alone'); continue
        if old and not force:
            k = prune_wild(old); fx = finish_v47(sid, old, D, cat)
            out.append(f'{sid}: built already (use --force to build it again)' + (f'; {k} wild plants taken out where they can\'t grow' if k else '') + ''.join('; ' + f for f in fx)); continue
        i = node_index(D, sid); size = (96, 72) if sid in TOWNS else ROUTE_SIZE
        if sid in TOWNS: BP.SIZE[sid] = size
        look = fresh(sid, n['name'], n['kind'], LOOK[LOOK_OF[sid]], size)
        sc, info = BUILD[sid](D, i, look)
        sc[TAG] = 1; sc['biome'] = n['biome']
        occ, grown = BP.finish(sc, D, i, nature, cat)
        prune_wild(sc); grown = sum(1 for p in sc['props'] if p.get('w') == 42); finish_v47(sid, sc, D, cat)
        D['maps'][sid] = sc
        tg = sum(r.count('t') for r in sc['tiles'])
        out.append(f'{sid}: {sc["w"]}×{sc["h"]}, tall grass {tg} m², {occ} placed + {grown} grown, exits {[(e["id"], e["side"]) for e in sc["edgeExits"]]}')
        if mp: BP.draw_map(sid, sc, cat, mp / f'{sid}.png')
    return out


def main():
    args = sys.argv[1:]; dry = '--dry' in args; force = '--force' in args; mp = None
    if '--map' in args: j = args.index('--map'); mp = Path(args[j + 1]); del args[j:j + 2]; mp.mkdir(parents=True, exist_ok=True)
    only = [a for a in args if not a.startswith('--')]
    regions = [r for k, r in REGIONS.items() if not only or k in only]
    places = [a for a in only if a not in REGIONS] or None
    if places: regions = [r for r in REGIONS.values() if any(n['id'] in places for n in r['nodes'])]
    head, D = load(); cat = D['scenery']['props']; nature = BP.nature_pool(cat)
    for R in regions:
        rep = add_region(D, R, force)
        print(f'{R["id"]}: ' + (', '.join(rep) if rep else 'data there already'))
        for line in build_places(D, R, cat, nature, force, places, mp): print('  ' + line)
    if not dry: save(head, D)


if __name__ == '__main__':
    main()
