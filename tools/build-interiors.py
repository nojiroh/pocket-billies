#!/usr/bin/env python3
"""v26: the rooms you walk into — a shop, the clinic, the lab and a house. Walk up to a shop, the clinic, the lab or a
house in any town and you step inside one of these; the door at the front takes you back out to where you were.

They are stored in game/data/gamedata.js with the other scenes (ids starting with "int_", "room": its kind) and never
appear on the route. Each has
  "npcSpots": [[x, z]]   where the keeper stands (behind the counter)
  "keeper": who          the person standing there (a person from the game data, or "folk:<seed>"; your own room has none)
  "exits": [[x, z]]      the door out

    python3 tools/build-interiors.py          # adds the rooms that are missing
    python3 tools/build-interiors.py --force  # rebuilds all four (anything you changed in them in the Studio is lost)
    python3 tools/build-interiors.py --shrink # rooms at the old sizes take the new ones (SIZE), keeping their props
                                              # (moved in, fit), lines and other fields
"""
import gamedata  # phase 04b: the data files in game/data
import importlib.util, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('bscenes', ROOT / 'tools' / 'build-scenes.py')
B = importlib.util.module_from_spec(spec); spec.loader.exec_module(B)
Scene, DATA = B.Scene, B.DATA
W, H, WALL = 14, 11, 3.2
# RL-9 session (the owner: "rooms overall can be shrunk a little; still bigger on the inside, but not as much"): a room
# laid out on the old sizes is built at the new ones. The functions below keep the old sizes' coordinates; fit() moves
# them in, so the doorway's strip keeps its depth, the back wall's things stay on the back wall and the rest closes up
SIZE = {(14, 11): (12, 10), (18, 12): (16, 11)}
FRONT, SIDE, BACK = 2.5, .9, 1.55


def fit(w, h):
    """the old size's (x, z) -> the new size's: x toward the middle (the side walls' insides stay put), z unchanged in
    the doorway's strip, as far from the back wall on it and in between in proportion"""
    nw, nh = SIZE.get((w, h), (w, h)); c, nc, back, nback = w / 2, nw / 2, h - BACK, nh - BACK
    fx = lambda x: round(nc + (x - c) * (nc - SIDE) / (c - SIDE), 2)
    fz = lambda z: z if z <= FRONT else round(z + nh - h, 2) if z >= back else round(FRONT + (z - FRONT) * (nback - FRONT) / (back - FRONT), 2)
    return fx, fz


def room(sid, name, floor, wall, seed, kind, keeper, spot, chat, w=W, h=H):
    # v47: floor is each room's own indoor floor (tools/build-terrain-v47.py, tools/room-floors-v47.py)
    fx, fz = fit(w, h); spot = (fx(spot[0]), fz(spot[1])); w, h = SIZE.get((w, h), (w, h))
    s = Scene(sid, name, floor, seed, w, h, sky=['#2A2836', '#3A3848', '#4A4658'], haze='#4A4658', hazeD=40, amb='dust', tint=None, indoor=1, far='mall', farH=4, folk=0,
              cam={'pitch': 28, 'h': 8.5, 'fov': 1}, blur=.6, chat=chat,
              # light from above, soft shadows: a room lit by its ceiling, not the sun through the roof
              look={'color': {'exposure': 1}, 'sun': {'height': 82, 'angle': 60, 'strength': .85, 'ambient': 0.5, 'clouds': 0, 'cloudShadows': 0, 'shafts': 0},
                    'shadows': {'strength': .35, 'softness': 2.2}, 'lights': {'brightness': 1.25, 'windowsDay': .6}, 'air': {'mist': 0}})
    c = w / 2
    s.d.update({'room': kind, 'kind': 'room', 'building': kind, 'locationId': None, 'keeper': keeper, 'npcSpots': [list(spot)], 'hub': [c, 2.2], 'exits': [[c, .6]], 'wallCol': [None] * 10 + [wall, None], 'edgeExits': [{'side': 'S', 't': .5, 'in': .6, 'width': 2, 'id': 'south'}]})
    # the back wall and the two side walls (the camera side stays open)
    s.terrace(-1, h - 1.4, w + 1, h + 1, WALL, wall=True, wobble=0, mat=10)
    # v47: the side walls stop where the back wall starts (overlapping, the corners stood twice as tall)
    s.terrace(-1, -1, .7, h - 1.4, WALL, wall=True, wobble=0, mat=10)
    s.terrace(w - .7, -1, w + 1, h - 1.4, WALL, wall=True, wobble=0, mat=10)
    s.rect(c - 1, 0, c + 1, 1.2, 'q')                      # the doormat
    s.clear.append((c, 2.2, 1.2)); s.clear.append((c, .8, 1))
    put = s.put
    s.put = lambda k, x, z, *a, **kw: put(k, fx(x), fz(z), *a, **kw)
    return s


def hang(s, k, x, h=H):
    s.put(k, x, h - 1.55, block=False)


def int_shop():
    s = room('int_shop', 'Inside the shop', 'O', '#E6CFA2', 2601, 'shop', 'cashier', (7, 7.7),
             ['Everything on these shelves is technically a collectible.', 'The coin rolls go fast on payday.', 'We restock every time an airship lands. Roughly.'])
    s.put('shop_counter', 7, 6.6, act='shop', label='Counter')
    for x in (2.2, 11.8): s.put('shop_shelf', x, 8.6)
    s.put('fridge_drinks', 4.4, 8.9); s.put('shop_shelf', 9.7, 8.6, .9)
    for x, z in ((1.6, 5.4), (12.4, 5.4)): s.put('crate_goods', x, z)
    s.put('crate_goods', 11.2, 3.4, .9, 1); s.put('plant_tall', 1.5, 1.8); s.put('plant_tall', 12.5, 1.8, 1, 1)
    s.put('rug_long', 7, 3.6, block=False)
    hang(s, 'wall_clock', 7); hang(s, 'wall_window', 4.4)
    return s.out(10)


def int_clinic():
    s = room('int_clinic', 'Inside the clinic', '9', '#D6ECE4', 2602, 'clinic', 'vera', (7, 7.5),
             ['Bring them in tired, take them out fresh. No charge.', 'We take every kind of billionaire. Even the rude ones.', 'Rest is free. The advice is free too.'])
    s.put('counter_white', 7, 6.4, act='clinic', label='Reception')
    for x in (2.0, 3.8): s.put('clinic_bed', x, 7.2)
    s.put('privacy_screen', 2.9, 4.6); s.put('plant_tall', 12.4, 8.8); s.put('plant_tall', 1.5, 1.8)
    s.put('sofa', 11, 3.4); s.put('table_round', 11, 5.6, .8)
    s.put('rug_round', 7, 3.6, block=False)
    hang(s, 'wall_clock', 7); hang(s, 'wall_window', 11); hang(s, 'wall_painting', 3)
    return s.out(10)


def int_lab():
    s = room('int_lab', 'Inside the lab', 'Q', '#B9C8DA', 2603, 'lab', 'chosen', (5.2, 7.2),
             ['Every billionaire has a number. Some have several, in different countries.', 'The machine hums when it’s thinking.', 'Science is mostly paperwork.'])
    s.put('lab_machine', 7, 8.4, act='board', label='Unlock board')
    for x in (2.8, 11.2): s.put('lab_desk', x, 6.4)
    for x in (1.6, 12.4): s.put('bookshelf', x, 9.0)
    s.put('plant_tall', 1.5, 1.8); s.put('chair_wood', 2.8, 5.2); s.put('chair_wood', 11.2, 5.2, 1, 1); s.put('crate_goods', 12.3, 3.2)
    s.put('rug_long', 7, 3.6, block=False)
    hang(s, 'wall_clock', 9.8); hang(s, 'wall_painting', 4.2)
    return s.out(10)


def int_house():
    s = room('int_house', 'Inside a house', '8', '#D9B79C', 2604, 'house', 'folk:7', (9.6, 5.4),
             ['Come in, come in. Mind the rug.', 'The fireplace runs on old receipts.', 'My cousin caught a billionaire in the bath once.', 'Stay as long as you like. The kettle’s on.'])
    s.put('fireplace', 7, 9.1, label='Fireplace')
    s.put('sofa', 7, 6.6); s.put('table_round', 3.6, 4.6); s.put('chair_wood', 2.6, 4.4); s.put('chair_wood', 4.6, 4.4, 1, 1)
    s.put('bookshelf', 12.2, 8.9); s.put('plant_tall', 1.6, 8.6); s.put('plant_tall', 12.5, 1.8, 1, 1)
    s.put('rug_round', 7, 4.2, block=False)
    hang(s, 'wall_painting', 3.6); hang(s, 'wall_window', 10.6)
    return s.out(10)


BUILD = [int_shop, int_clinic, int_lab, int_house]


# ---------------------------------------------------------------- v46: rooms for the new kinds of building
def int_bakery():
    s = room('int_bakery', 'Inside the bakery', '0', '#F0D8B0', 2611, 'bakery', 'folk:21', (7, 7.4),
             ['Fresh every morning. Well, most mornings.', 'The sourdough is older than some billionaires.', 'Smell that? That’s compound interest, baked.'])
    s.put('shop_counter', 7, 6.4, act='shop', label='Counter'); s.put('bakery_oven', 3.0, 8.8); s.put('bakery_oven', 11.0, 8.8, 1, 1)
    for x in (5.4, 8.6): s.put('bread_rack', x, 8.9)
    s.put('table_round', 2.6, 3.8, .8); s.put('chair_wood', 1.7, 3.6); s.put('table_round', 11.4, 3.8, .8); s.put('chair_wood', 12.3, 3.6, 1, 1)
    s.put('sack', 12.4, 6.0); s.put('sack', 1.6, 6.2, .9, 1); s.put('plant_tall', 1.5, 1.8)
    hang(s, 'wall_clock', 7); return s.out(10)


def int_inn():
    s = room('int_inn', 'Inside the inn', '!', '#E2C6A0', 2612, 'inn', 'folk:31', (4.2, 7.6),
             ['Rooms upstairs, soup down here.', 'Rest a while. Your team looks tired.', 'We once had a billionaire stay a whole year. He paid in shares.'])
    s.put('bar_counter', 4.2, 6.5, act='rest', label='Rest here'); s.put('barrels', 1.6, 8.9); s.put('fireplace', 10.4, 9.1)
    s.put('bed_inn', 12.3, 6.6); s.put('table_round', 9.6, 4.4); s.put('chair_wood', 8.6, 4.2); s.put('chair_wood', 10.6, 4.2, 1, 1)
    s.put('rug_round', 10.4, 6.6, block=False); s.put('plant_tall', 1.5, 1.8); s.put('plant_tall', 12.5, 1.8, 1, 1)
    hang(s, 'wall_painting', 7.4); hang(s, 'wall_window', 4.4); return s.out(10)


def int_bank():
    s = room('int_bank', 'Inside the Savings & Loan', '#', '#E8E2D2', 2613, 'bank', 'folk:41', (7, 7.6),
             ['Your coins are safe with us. Mostly.', 'The vault hasn’t been opened since the last bubble.', 'Interest rates are up. Interest in billionaires is up too.'])
    s.put('teller_counter', 7, 6.4, label='Counter'); hang(s, 'vault_door', 7)
    for x in (2.0, 12.0): s.put('plant_tall', x, 8.8)
    s.put('bench_wood', 2.6, 3.4); s.put('bench_wood', 11.4, 3.4); s.put('rug_long', 7, 3.6, block=False)
    hang(s, 'wall_clock', 3.6); hang(s, 'wall_painting', 10.6); return s.out(10)


def int_library():
    s = room('int_library', 'Inside the library', '%', '#D8C8A8', 2614, 'library', 'folk:51', (7, 7.4),
             ['Shh. The books are sleeping.', 'We have every billionaire’s biography. None of them are short.', 'Late fees are paid in coins. Small ones, but many.'])
    # alpha 0.1: two bookcases at the ends of the back wall and two standing in the room as stacks, so the library's
    # four front windows have room on the back wall (seamless-world.js seamlessRoomWindows)
    for x in (1.6, 12.4): s.put('bookshelf', x, 9.0)
    for x in (2.6, 11.4): s.put('bookshelf', x, 6.9)
    s.put('reading_desk', 7, 6.4, label='Librarian'); s.put('armchair', 2.4, 4.6); s.put('armchair', 11.6, 4.6, 1, 1)
    s.put('reading_desk', 4.2, 3.6, .9); s.put('chair_wood', 4.2, 2.8); s.put('rug_round', 7, 3.8, block=False); s.put('plant_tall', 12.5, 1.8, 1, 1)
    hang(s, 'wall_clock', 7); return s.out(10)


def int_school():
    s = room('int_school', 'Inside the school', ':', '#DCE4D0', 2615, 'school', 'folk:61', (7, 8.0),
             ['Today’s lesson: what a billionaire eats for breakfast.', 'Homework: visit three towns and write about the people.', 'Who drew on the board again?'])
    hang(s, 'blackboard', 7); s.put('reading_desk', 7, 7.0)
    for x in (3.4, 5.8, 8.2, 10.6):
        for z in (4.8, 3.0): s.put('school_desk', x, z)
    hang(s, 'wall_map', 2.6); hang(s, 'wall_clock', 11.6); s.put('plant_tall', 12.5, 8.6); s.put('bookshelf', 1.6, 9.0)
    return s.out(10)


def int_station():
    s = room('int_station', 'Inside the station', ';', '#E0D6C4', 2616, 'station', 'folk:71', (7, 7.6),
             ['The 4:15 is running late. It always is.', 'Tickets to anywhere, as long as anywhere is on the line.', 'Mind the gap. And the billionaires.'])
    s.put('ticket_window', 7, 8.6, label='Tickets'); hang(s, 'timetable_board', 3.4); hang(s, 'wall_clock', 10.6)
    for x in (2.4, 11.6):
        for z in (5.2, 3.0): s.put('bench_wood', x, z)
    s.put('vending', 12.6, 8.4); s.put('bin', 1.4, 7.6); s.put('plant_tall', 1.5, 1.8)
    return s.out(10)


def int_fire_station():
    s = room('int_fire_station', 'Inside the fire station', '=', '#E4C8B4', 2617, 'fire_station', 'folk:81', (5.6, 7.4),
             ['Cats in trees, billionaires on roofs. We get them all down.', 'The pole is for emergencies. And fun.', 'Keep your coins dry.'])
    s.put('fire_pole', 10.6, 6.4); s.put('trophy_case', 2.0, 8.9); s.put('table', 5.6, 6.2); s.put('chair_wood', 4.6, 5.4); s.put('chair_wood', 6.6, 5.4, 1, 1)
    s.put('crate_stack', 12.4, 8.6); s.put('barrel', 12.6, 3.2); s.put('plant_tall', 1.5, 1.8)
    hang(s, 'wall_map', 6.4); hang(s, 'wall_clock', 3.6); return s.out(10)


def int_mansion():
    s = room('int_mansion', 'Inside the mansion', '6', '#E6D8E4', 2618, 'mansion', 'folk:91', (9.2, 7.6), [
        'Please don’t touch the piano. It’s worth more than the town.', 'The family’s out shopping for a smaller island.', 'Every painting here is a self-portrait.'], w=18, h=12)
    s.put('piano', 3.4, 9.8); s.put('fireplace', 9, 10.1); s.put('sofa', 9, 7.0); s.put('armchair', 6.4, 6.0); s.put('armchair', 11.6, 6.0, 1, 1)
    s.put('rug_round', 9, 5.6, block=False); s.put('table_round', 9, 5.0, .7); s.put('dresser', 15.0, 9.9); s.put('plant_tall', 16.4, 9.6); s.put('plant_tall', 1.6, 2.0)
    s.put('plant_tall', 16.4, 2.0, 1, 1); s.put('bookshelf', 13.2, 10.0)
    for x in (5.6, 12.4): hang(s, 'wall_painting', x, 12)
    hang(s, 'wall_window', 16.0, 12); return s.out(12)


def int_barn():
    s = room('int_barn', 'Inside the barn', '~', '#B88A64', 2619, 'barn', 'folk:101', (7, 6.8),
             ['Mind the hay. The billionaires love hiding in it.', 'We grow the town’s food. And its gossip.', 'The cow’s name is Dividend.'])
    s.put('haybale_stack', 2.4, 8.8); s.put('haybale', 4.6, 8.4); s.put('haybale', 11.6, 8.6); s.put('wheelbarrow', 10.6, 6.0)
    s.put('sack', 12.6, 4.6); s.put('sack', 12.2, 5.4, .9, 1); s.put('barrel', 1.6, 4.2); s.put('crate', 2.6, 3.0); s.put('ladder', 7.6, 9.4)
    hang(s, 'wall_window', 4.6)
    # RL-9: the ranch's training board (Copperleaf's barn, act 'ranch': ranch-screen.js)
    hang(s, 'blackboard', 10); s.props[-1].update(act='ranch', label='Training board'); return s.out(10)


def int_greenhouse():
    s = room('int_greenhouse', 'Inside the greenhouse', '_', '#D8ECDC', 2620, 'greenhouse', 'folk:111', (7, 6.6),
             ['Talk to your plants. They listen better than billionaires.', 'Tomatoes, peppers, and one very rare orchid.', 'It’s always summer in here.'])
    for x in (3.0, 11.0): s.put('potting_bench', x, 8.8)
    for x in (2.0, 12.0):
        for z in (5.6, 3.4): s.put('planter_box', x, z)
    s.put('plant_tall', 7, 9.0); s.put('flowerpot', 5.2, 6.8); s.put('flowerpot', 8.8, 6.8); s.put('wheelbarrow', 9.6, 3.0)
    return s.out(10)


def int_ski_lodge():
    s = room('int_ski_lodge', 'Inside the ski lodge', '+', '#C89A72', 2621, 'ski_lodge', 'folk:121', (10.4, 7.2),
             ['Hot cocoa’s on the house. The house is very expensive.', 'Fresh powder today!', 'Every billionaire here owns the mountain. Several of them.'])
    s.put('fireplace', 7, 9.1); s.put('sofa', 7, 6.4); s.put('armchair', 4.2, 5.6); s.put('armchair', 9.8, 5.6, 1, 1)
    s.put('rug_round', 7, 4.4, block=False); s.put('ski_rack', 2.0, 9.0); s.put('ski_rack', 12.0, 9.0); s.put('table_round', 7, 4.2, .7)
    s.put('firewood', 12.6, 3.6); s.put('plant_tall', 1.5, 1.8)
    hang(s, 'wall_window', 4.2); hang(s, 'wall_window', 9.8); return s.out(10)


def int_market_hall():
    s = room('int_market_hall', 'Inside the market hall', '*', '#D8C4A4', 2622, 'market_hall', 'folk:131', (9, 7.8), [
        'Fresh fish, fresher prices.', 'Everything’s for sale. Even the stall.', 'Haggling encouraged. Winning discouraged.'], w=18, h=12)
    s.put('stall', 4.6, 9.4); s.put('stall', 13.4, 9.4); s.put('shop_counter', 9, 7.0, act='shop', label='Market')
    s.put('market_cart', 3.4, 4.8); s.put('market_cart', 14.6, 4.8); s.put('crate_goods', 1.6, 7.2); s.put('crate_goods', 16.4, 7.2)
    s.put('barrels', 16.2, 2.6); s.put('crate_stack', 1.8, 2.6); s.put('sack', 7.0, 4.0); s.put('sack', 11.0, 4.0, 1, 1)
    hang(s, 'wall_clock', 9, 12); return s.out(12)


BUILD += [int_bakery, int_inn, int_bank, int_library, int_school, int_station, int_fire_station, int_mansion, int_barn, int_greenhouse, int_ski_lodge, int_market_hall]


# ------------------------------------------------- v47 part 4: the shop of each region town, a room of its own
# Each is the size of the room its building had (a market hall's, the bank's, the shop's), keeps the walls it's made
# with ("vary": 0: no colour picked by the door), and has a counter that opens the town's shop. tools/build-regions-v47.py
# points each town's shop at its room ("room" on the shop).
def own(s):
    s.d['vary'] = 0
    return s


def int_twinpetal_market():
    s = own(room('int_twinpetal_market', 'Inside Twofold Market', '$', '#EAD8DC', 2631, 'market_hall', 'folk:141', (9, 7.8), [
        'Tour shirts, two for the price of three.', 'Poppy never agreed to any of this. She still buys the badges.',
        'Records pressed at a plant out east. Don’t ask which one.'], w=18, h=12))
    s.put('stall_merch', 4.6, 9.4); s.put('stall_merch', 13.4, 9.4, 1, 1); s.put('shop_counter', 9, 7.0, act='shop', label='Market')
    s.put('record_crates', 2.0, 5.4); s.put('record_crates', 16.0, 5.4, 1, 1); s.put('crate_goods', 1.6, 7.6); s.put('crate_goods', 16.4, 7.6, 1, 1)
    s.put('flowerpot', 6.4, 4.2); s.put('flowerpot', 11.6, 4.2); s.put('sack', 7.2, 3.6, .9); s.put('plant_tall', 1.6, 2.0); s.put('plant_tall', 16.4, 2.0, 1, 1)
    hang(s, 'wall_clock', 9, 12); return s.out(12)


def int_bullion_exchange():
    s = own(room('int_bullion_exchange', 'Inside the Bullion Exchange', '(', '#E6DCC4', 2632, 'bank', 'folk:151', (7, 7.6), [
        'Gold by the gram, by the bar, or by the goat.', 'The Baron rented the vaults out. To whom, we couldn’t possibly say.',
        'Prices go up when you look at them. Try not to look.']))
    s.put('teller_counter', 7, 6.4, act='shop', label='Exchange'); hang(s, 'vault_door', 7); hang(s, 'timetable_board', 3.4); hang(s, 'wall_clock', 10.6)
    s.put('trophy_case', 2.0, 8.9); s.put('trophy_case', 12.0, 8.9); s.put('armchair', 2.4, 4.0); s.put('armchair', 11.6, 4.0, 1, 1)
    s.put('rug_long', 7, 3.6, block=False); s.put('plant_tall', 1.5, 1.8); s.put('plant_tall', 12.5, 1.8, 1, 1)
    return s.out(10)


def int_cap_market():
    s = own(room('int_cap_market', 'Inside the Cap Market', ')', '#D8CCE2', 2633, 'market_hall', 'folk:161', (9, 7.8), [
        'Mushrooms, spores, and a very good rate on caps.', 'Mother Morel says the market is a state of mind. The rent is not.',
        'If it glows, it’s fresh. If it hums, put it down.'], w=18, h=12))
    s.put('stall', 4.6, 9.4); s.put('stall', 13.4, 9.4, 1, 1); s.put('shop_counter', 9, 7.0, act='shop', label='Market')
    s.put('market_cart', 3.4, 4.8); s.put('market_cart', 14.6, 4.8, 1, 1); s.put('barrels', 1.6, 9.0); s.put('crate_stack', 16.4, 9.0)
    for x, z, k in ((2.2, 7.4, 1.1), (15.8, 7.6, .9), (7.0, 3.4, .8), (11.4, 2.6, 1.0)): s.put('mushroom_brown', x, z, k, block=False)
    s.put('sack', 1.8, 2.6); s.put('crate_goods', 16.2, 2.6, 1, 1)
    hang(s, 'wall_clock', 9, 12); return s.out(12)


def int_assay_office():
    s = own(room('int_assay_office', 'Inside the Assay Office', '-', '#C8CCD8', 2634, 'market_hall', 'folk:171', (9, 7.8), [
        'Every crystal weighed, every claim stamped.', 'Carat’s needle hums at night. We sell earplugs.',
        'Bring me a geode and I’ll tell you what it’s worth. Then what it costs.'], w=18, h=12))
    s.put('shop_counter', 9, 7.0, act='shop', label='Assay'); s.put('crystal_cluster', 2.4, 9.2); s.put('crystal_cluster_violet', 15.6, 9.2, 1, 1)
    s.put('bookshelf', 5.6, 9.8); s.put('bookshelf', 12.4, 9.8); s.put('minecart', 4.4, 4.6); s.put('crate_stack', 1.8, 2.6); s.put('barrels', 16.2, 2.6)
    s.put('sack', 13.6, 4.4); s.put('sack', 14.4, 3.8, .9, 1)
    hang(s, 'wall_map', 9, 12); return s.out(12)


def int_chandlery():
    s = own(room('int_chandlery', 'Inside the Chandlery', '[', '#D4E0E4', 2635, 'shop', 'folk:181', (7, 7.7), [
        'Rope, lamps, tinned biscuits. Everything a yacht pretends not to need.', 'The yachts never pay cash. They pay in promises.',
        'Cass Flow? Haven’t seen her. Try the plant. Don’t say I said so.']))
    s.put('shop_counter', 7, 6.6, act='shop', label='Counter'); s.put('shop_shelf', 2.2, 8.6); s.put('shop_shelf', 11.8, 8.6)
    s.put('barrels', 1.6, 5.4); s.put('barrel_wood', 12.4, 5.6); s.put('crate_goods', 11.2, 3.4, .9, 1); s.put('crate_stack', 4.6, 9.0)
    s.put('sack', 1.8, 2.6); s.put('plant_tall', 12.5, 1.8, 1, 1); s.put('rug_long', 7, 3.6, block=False)
    hang(s, 'wall_map', 7); hang(s, 'wall_window', 10.0); return s.out(10)


def int_night_market():
    s = own(room('int_night_market', 'Inside the Night Market', ']', '#4A4660', 2636, 'shop', 'folk:191', (7, 7.7), [
        'Open all night. The nights are long up here.', 'Everything here fell off a cloud. Legally.', 'Blake bought the last three of everything. Twice.']))
    s.put('night_stall', 3.0, 9.0); s.put('night_stall', 11.0, 9.0, 1, 1); s.put('shop_counter', 7, 6.6, act='shop', label='Stall')
    s.put('cafe_table', 2.6, 4.0); s.put('chair_wood', 1.6, 3.8); s.put('vending', 12.6, 5.8); s.put('crate_goods', 12.2, 2.6, .9, 1)
    s.put('plant_tall', 1.5, 1.8); hang(s, 'wall_clock', 7); return s.out(10)


BUILD += [int_twinpetal_market, int_bullion_exchange, int_cap_market, int_assay_office, int_chandlery, int_night_market]


def repair_corners(D):
    """v47: rooms made before v47 have back corners twice the wall's height (the back and side walls overlapped and
    their heights added up). Every step cell taller than the room's wall comes down to it; nothing else changes."""
    import base64, struct
    fixed = []
    for sid, sc in D['maps'].items():
        if sc.get('kind') != 'room' or not sc.get('steps'): continue
        raw = base64.b64decode(sc['steps']); n = len(raw) // 2; v = list(struct.unpack('<%dh' % n, raw))
        nz = [x for x in v if x > 0]
        if not nz: continue
        wall = max(set(nz), key=nz.count)                     # the wall height (in 1/20 m) most cells have
        if max(v) <= wall: continue
        c = sum(1 for x in v if x > wall); v = [min(x, wall) for x in v]
        sc['steps'] = base64.b64encode(struct.pack('<%dh' % n, *v)).decode(); sc['stepsV'] = sc.get('stepsV', 0) + 1
        fixed.append(f'{sid} ({c} cells)')
    return fixed


SHELL = ('w', 'h', 'tiles', 'steps', 'stepm', 'hub', 'exits', 'edgeExits', 'wallCol', 'edge')


def shrink(D):
    """rooms still at an old size: the new size's walls and floor from the builder; their own props (moved in by fit),
    keeper's spot, lines and every other field kept"""
    done = []
    for f in BUILD:
        sid = f.__name__; old = D['maps'].get(sid)
        if not old or (old['w'], old['h']) not in SIZE: continue
        new = f(); fx, fz = fit(old['w'], old['h'])
        out = dict(old)
        for k in SHELL:
            if k in new: out[k] = new[k]
        out['props'] = [{**p, 'x': fx(p['x']), 'z': fz(p['z'])} for p in old.get('props', [])]
        out['npcSpots'] = [[fx(x), fz(z)] for x, z in old.get('npcSpots', [])]
        out['stepsV'] = old.get('stepsV', 0) + 1
        D['maps'][sid] = out; done.append(f"{sid} {old['w']}x{old['h']} -> {out['w']}x{out['h']}")
    return done


def main():
    force = '--force' in sys.argv
    src = gamedata.js_text(); head = src[:src.index('window.GAMEDATA=')]
    D = json.JSONDecoder().raw_decode(src[src.index('window.GAMEDATA=') + len('window.GAMEDATA='):])[0]
    for f in BUILD if '--shrink' not in sys.argv else []:
        sid = f.__name__
        if sid in D['maps'] and not force: print(f'  {sid}: kept'); continue
        sc = f(); D['maps'][sid] = sc
        print(f'  {sid}: {sc["w"]}x{sc["h"]}, {len(sc.get("props", []))} props')
    if '--shrink' in sys.argv:
        for line in shrink(D): print(' ', line)
    fx = repair_corners(D)
    if fx: print('  corners brought down to the wall height:', ', '.join(fx))
    gamedata.save_js(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n')


if __name__ == '__main__':
    main()
