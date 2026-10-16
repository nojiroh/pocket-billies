#!/usr/bin/env python3
"""v25 game data: six new billionaire lines (their pictures come from tools/build-art-species.py --line ...), what
you can fish up from each kind of water, and the new billionaires joining the wild pools of the new places.

    python3 tools/build-v25.py

Only adds what is missing, so anything you changed in the Studio stays."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'data' / 'gamedata.js'
LV2 = [{'k': 'lvl', 'at': 16}, {'k': 'lvl', 'at': 36}]

LINES = [
 dict(id='yacht', names=['Dinghoy', 'Yachtsman', 'Gigayacht'], types=[['Water'], ['Water', 'Steel'], ['Water', 'Steel']], prof=[1.2, .9, 1.05, .95, .9, 1.0], rar='uncommon',
      learn=[[1, 'handshake'], [1, 'interest'], [5, 'buyhold'], [9, 'markdown'], [14, 'headline'], [20, 'bulk'], [28, 'exclusive'], [38, 'gentrify']],
      cat=['Dinghy Billionaire', 'Yacht Billionaire', 'Megayacht Billionaire'], ht=[.8, 2.6, 7.5], wt=[40, 800, 9000],
      hab=['Marina berths', 'Exclusive harbours', 'International waters'], diet=['Seaweed, mooring fees', 'Champagne, deck polish', 'Entire coastlines'],
      bio=['A little dinghy that follows bigger boats around the harbour, hoping to be invited aboard.',
           'Big and broad enough to carry a rider across a lake or out to sea. It insists on being called a vessel, not a boat.',
           'So large it has its own postcode, a helipad and a smaller yacht inside it for going ashore.'],
      note=['Its fins are the same navy as a blazer.', 'Travellers ride it across lakes and seas.', 'Registered in at least four countries at once.'], evo=LV2),
 dict(id='gill', names=['Gillet', 'Gill Gates', 'Gillanthropist'], types=[['Water'], ['Water', 'Electric'], ['Water', 'Electric']], prof=[.95, .9, .95, 1.15, 1.05, 1.0], rar='common',
      learn=[[1, 'handshake'], [1, 'interest'], [5, 'movefast'], [9, 'compound'], [13, 'zoning'], [18, 'rerecord'], [26, 'disrupt'], [34, 'overload']],
      cat=['Software Billionaire', 'Windows Billionaire', 'Foundation Billionaire'], ht=[.4, 1.5, 2.4], wt=[2, 60, 400],
      hab=['Garden ponds', 'Quiet lakes', 'Every ocean at once'], diet=['Floppy disks', 'Licence fees', 'Good intentions'],
      bio=['A little fish that installs itself in any pond it finds and asks to be restarted every so often.',
           'Wears the same sweater every day and answers every question with a ten-year plan.',
           'Gives most of its fortune away, which somehow makes the fortune bigger.'],
      note=['Bites best in clear water.', 'Has a very large library in a very small cave.', 'Often seen swimming beside fishing boats, funding them.'], evo=LV2),
 dict(id='carp', names=['Carplet', 'Carp Icahn', 'Corporate Raider'], types=[['Water'], ['Water'], ['Water', 'Dragon']], prof=[1.0, 1.2, .9, .85, .9, 1.15], rar='common',
      learn=[[1, 'handshake'], [1, 'interest'], [5, 'flashsale'], [10, 'shortsell'], [14, 'headline'], [20, 'joyride'], [28, 'exclusive'], [36, 'wyrmbreath']],
      cat=['Koi Billionaire', 'Activist Billionaire', 'Takeover Billionaire'], ht=[.5, 1.3, 4.2], wt=[3, 40, 600],
      hab=['Ornamental ponds', 'Boardroom aquariums', 'Rivers it now owns'], diet=['Breadcrumbs', 'Undervalued shares', 'Whole companies'],
      bio=['A golden koi that grows to the size of whatever pond it can afford.', 'Buys a big stake in any pond it swims in, then tells the other fish how to swim.',
           'When it leaps up a waterfall it comes down owning the river.'], note=['Turns gold in the sun.', 'Its glasses are for reading reports.', 'Has never lost a hostile takeover.'], evo=LV2),
 dict(id='shellco', names=['Shellcorp', 'Shell Company', 'Holding Crabpany'], types=[['Water'], ['Water', 'Steel'], ['Water', 'Steel']], prof=[1.05, 1.0, 1.2, 1.0, .95, .8], rar='common',
      learn=[[1, 'handshake'], [1, 'renthike'], [5, 'interest'], [10, 'spin'], [15, 'bulk'], [21, 'headline'], [29, 'gentrify']],
      cat=['Shell Billionaire', 'Offshore Billionaire', 'Holding Billionaire'], ht=[.3, .9, 1.9], wt=[3, 90, 700],
      hab=['Tide pools', 'Sandbars near tax havens', 'Many places on paper'], diet=['Plankton, paperwork', 'Registered addresses', 'Other shells'],
      bio=['A hermit crab whose shell is technically registered somewhere else.', 'Owns nothing itself; everything belongs to another shell, which belongs to a third.',
           'Nobody has ever seen inside its shell, including the Holding Crabpany.'], note=['Lives near Tax Haven.', 'Its claw holds a briefcase of documents.', 'Wears a top hat for board meetings.'], evo=LV2),
 dict(id='magma', names=['Cinderlet', 'Magmagnate', 'Krakatycoon'], types=[['Fire'], ['Fire', 'Ground'], ['Fire', 'Ground']], prof=[1.05, 1.2, 1.05, .85, .95, .9], rar='uncommon',
      learn=[[1, 'handshake'], [1, 'spill'], [5, 'renthike'], [9, 'pipeline'], [13, 'eviction'], [18, 'hottake'], [24, 'foreclose'], [30, 'gusher'], [40, 'margincall']],
      cat=['Ember Billionaire', 'Magma Billionaire', 'Volcano Billionaire'], ht=[.5, 1.2, 2.4], wt=[60, 300, 900],
      hab=['Warm vents', 'Lava flows', 'The tops of volcanoes'], diet=['Coal', 'Molten rock', 'Market crashes'],
      bio=['A glowing blob of cooling lava that keeps itself warm by worrying about money.', 'Its spots glow brighter when markets fall. It finds this relaxing.',
           'When it erupts, prices everywhere drop and it buys everything.'], note=['Lives on Mount Margin Call.', 'Never wears anything but a hard hat.', 'Its top hat is fireproof.'], evo=LV2),
 dict(id='alpaca', names=['Alpacash', 'Alpacapital', 'Alpacamogul'], types=[['Ground'], ['Ground', 'Flying'], ['Ground', 'Flying']], prof=[1.1, .95, 1.1, 1.0, 1.0, .85], rar='common',
      learn=[[1, 'handshake'], [1, 'flashsale'], [5, 'renthike'], [9, 'liftoff'], [14, 'eviction'], [20, 'escvel'], [26, 'orbit'], [34, 'foreclose']],
      cat=['Wool Billionaire', 'Altitude Billionaire', 'Summit Billionaire'], ht=[.9, 1.6, 2.0], wt=[50, 90, 140],
      hab=['High meadows', 'Mountain passes', 'The penthouse floor'], diet=['Alpine grass', 'Thin air, thick fees', 'Ski resorts'],
      bio=['A fluffy alpaca that hums when it is happy and when it is counting.', 'Climbs higher every year. It says the view is better and the taxes are lower.',
           'Lives on the top floor of the highest building in Summit Capital and charges rent for the view.'], note=['Its wool is worth its weight in gold.', 'Carries a bag of savings on its back.', 'Wears a crown it bought at auction.'], evo=LV2),
]
# what bites in each kind of water (levels are added to the place's own)
FISHING = {
 'pond': {'lv': [0, 2], 'list': [['carp0', 40], ['gill0', 35], ['goss0', 20], ['short0', 15], ['dial0', 10], ['carp1', 4]]},
 'stream': {'lv': [0, 2], 'list': [['gill0', 40], ['carp0', 30], ['short0', 20], ['dial0', 10], ['gill1', 4]]},
 'lake': {'lv': [1, 3], 'list': [['carp0', 30], ['gill0', 25], ['yacht0', 20], ['dial0', 15], ['carp1', 8], ['gill1', 6], ['yacht1', 2]]},
 'sea': {'lv': [1, 3], 'list': [['shellco0', 30], ['yacht0', 25], ['goss0', 20], ['short0', 20], ['shellco1', 8], ['short1', 6], ['yacht1', 3]]},
 'canal': {'lv': [0, 2], 'list': [['carp0', 40], ['goss0', 30], ['shellco0', 15], ['carp1', 6]]},
 'swamp': {'lv': [0, 2], 'list': [['dial0', 40], ['goss0', 30], ['short0', 20], ['dial1', 5]]},
 'spring': {'lv': [1, 3], 'list': [['gill0', 40], ['carp0', 25], ['gill1', 10], ['ball0', 5]]},
 'ice': {'lv': [1, 3], 'list': [['short0', 35], ['gill0', 30], ['alpaca0', 10], ['short1', 6]]},
}
POOL_ADD = {'sea': [['shellco0', 25], ['yacht0', 15]], 'island': [['shellco1', 18], ['yacht1', 6]], 'volcano': [['magma0', 30], ['magma1', 12]],
            'pass': [['alpaca0', 30], ['alpaca1', 10]], 'summit': [['alpaca1', 22], ['alpaca0', 15]], 'lake': [['yacht0', 20], ['gill0', 20], ['carp0', 20]],
            'pond': [['carp0', 15], ['gill0', 10]], 'city': [['carp0', 8]]}


def main():
    s = DATA.read_text(encoding='utf-8'); i = s.index('window.GAMEDATA=')
    head, D = s[:i], json.JSONDecoder().raw_decode(s[i + 16:])[0]
    have = {l['id'] for l in D['lines'].values()} if isinstance(D['lines'], dict) else {l['id'] for l in D['lines']}
    for L in LINES:
        if L['id'] in have: continue
        if isinstance(D['lines'], dict): D['lines'][str(len(D['lines']))] = L
        else: D['lines'].append(L)
    D.setdefault('fishing', {})
    for k, v in FISHING.items(): D['fishing'].setdefault(k, v)
    for pool, add in POOL_ADD.items():
        P = D['pools'].get(pool)
        if not P: continue
        ids = {a for a, _ in P['list']}
        for sp, w in add:
            if sp not in ids: P['list'].append([sp, w])
    D['rules'].setdefault('fishing', {'biteMin': 2.5, 'biteMax': 8, 'reactTime': .9, 'reelTime': 7, 'goldOdds': 64})
    DATA.write_text(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
    print('lines', len(D['lines']), '| fishing kinds', len(D['fishing']))


if __name__ == '__main__':
    main()
