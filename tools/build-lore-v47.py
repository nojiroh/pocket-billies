#!/usr/bin/env python3
"""v47: the world and the story of Pocket Billies (then Net Worth), written down once (game data: lore), so everything in the game draws
from it: the opening, story scenes, what people say, books in rooms, the Lore page of the Guide, the loading screen.
The Studio's Lore section edits it like the other data.

    lore.world      the Hollow Earth, the billionaires, money and steps, the Inner Sun
    lore.story      the main thread, chapter by chapter (stage: badges won and story flags)
    lore.people     who's who, with a voice and a motive
    lore.places     each place: its history, what it is known for, its landmark, a local legend
    lore.legends    stories people tell, found as you go
    lore.clues      who you were: three things found along the way
    lore.books      books and papers in rooms you can read
    lore.loading    short lines for the loading screen (lore, tips, jokes)
    lore.chat       what people say, per place and per stage of the story (on top of a scene's own chat)

Each entry with `unlock` shows in the Guide once it is met: 'start' (always), 'place:<id>' (been there),
'meet:<id>' (met them), 'flag:<name>' (a story flag), 'badges:<n>' (that many badges).

Only writes what is missing (your Studio edits are kept); --force writes it all again.

    python3 tools/build-lore-v47.py
    python3 tools/build-lore-v47.py --force
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'data' / 'gamedata.js'

WORLD = [
 {'id': 'hollow', 'title': 'The Hollow Earth', 'unlock': 'start',
  'text': 'Inside the planet there is another world: a hollow shell with land on the inside, sea and sky in the middle, and the Inner Sun hanging at the centre of it all. Look up anywhere and you see more country curving overhead, hazy and blue. Things from the surface fall in through sinkholes now and then. Most of them land near Sundown, which the people of Sundown regard as a business opportunity.'},
 {'id': 'found', 'title': 'How it was found', 'unlock': 'start',
  'text': 'A mining company drilled too deep in 1971 and broke through the floor of the world. The first expedition planted a flag, then a toll booth, and the Hollow Earth was bought by a fund the same afternoon. It has changed hands eleven times since. Nobody who lives here has ever been asked.'},
 {'id': 'billionaires', 'title': 'What billionaires are', 'unlock': 'start',
  'text': 'Decades ago the world’s richest people paid a private lab, Legacy Labs (“Your fortune, backed up”), to clone them, as backups in case anything happened to the originals. To save money, the lab filled the gaps in the DNA with whatever animal was cheapest that week. The clones came out part tycoon, part creature, and refused to sign anything. Rather than admit it, the lab shipped them down here as “offshore storage”. They went wild, multiplied, and now they are the most common wildlife in the Hollow Earth. Most of them can only say their own name.'},
 {'id': 'coins', 'title': 'Why a coin catches them', 'unlock': 'start',
  'text': 'A billionaire cannot resist a coin. Toss one and it will chase it, catch it and keep it, and while it is busy counting, it is yours. A Penny will do for a young one. Silver, Gold and Platinum (“Too Big To Fail”) coins hold the bigger and the stubborn ones. Nobody has found a billionaire that turns money down.'},
 {'id': 'steps', 'title': 'Money and steps', 'unlock': 'start',
  'text': 'Down here the one thing nobody can buy is someone else’s steps. Roads are measured in them, fares are paid in them, and a trainer’s team grows stronger with every one you walk. The banks of Capital Gains have tried for years to trade steps on the market. So far, the steps have refused to be walked by anyone else.'},
 {'id': 'sun', 'title': 'The Inner Sun', 'unlock': 'start',
  'text': 'Officially the Inner Sun never sets. In practice it dims every evening, because its maintenance contract only covers business hours. At the very centre of the world it is always noon, the air hums, and the stone is baked gold. Nobody owns the Inner Sun. Several people are working on that.'},
 {'id': 'variants', 'title': 'Variants', 'unlock': 'flag:metVariants',
  'text': 'Some billionaires are born gold: a limited variant, one in thousands. Collectors pay anything for them. A pop star called Vinylla turned collecting into a movement, and her fans, the Variants, travel the Hollow Earth buying up every rare billionaire they can find, and anyone else who will sell.'},
 {'id': 'record', 'title': 'The ultimate variant', 'unlock': 'flag:planKnown',
  'text': 'Vinylla’s plan is simple and enormous: press the Inner Sun into one giant record, the ultimate limited edition. One copy, ever. The inner world would go dark, and she would sell the sunlight back to it by subscription, monthly, cancel any time (you cannot cancel).'},
]

STORY = [
 {'id': 'prologue', 'stage': 0, 'title': 'The fall',
  'text': 'You were walking somewhere on the surface, late, with a lanyard round your neck and one coin in your pocket. The pavement opened. You fell through the crust, past the inner sky, with the Inner Sun blazing ahead, and woke in Sundown with no memory of who you were. Professor Hazel found you, gave you a billionaire, and her other student, Blake, picked the one that beats yours.'},
 {'id': 'road1', 'stage': 0, 'title': 'Route 1',
  'text': 'Hazel asked you to walk: every step counts, and the road teaches more than any book. When someone falls in, their things come down too, and they scatter along the Long Grass. Something of yours might still be out there.'},
 {'id': 'badges', 'stage': 1, 'title': 'The four arenas',
  'text': 'Four arena leaders guard the ring of the world you know: Rocco in the Bubbling Grotto, Iris in the Mall of the Deep, Alta on the Summit, Marina in Tax Haven. Win their badges and the roads to the regions beyond open up.'},
 {'id': 'variants', 'stage': 2, 'title': 'The Variants',
  'text': 'Trainers in gold jackets have started turning up on the roads, buying rare billionaires with cash and not taking no for an answer. They call themselves the Variants. They all have the same tour shirt. You have a feeling you’ve seen it before.'},
 {'id': 'oil', 'stage': 4, 'title': 'Mount Margin Call',
  'text': 'Vinyl is made from oil, and the richest well in the world is a billionaire: Oilympus, under the volcano. The Variants went up Mount Margin Call to catch it. They wanted enough black gold to press one very large record.'},
 {'id': 'meadowlands', 'stage': 4, 'title': 'The Meadowlands',
  'text': 'Beyond the ring, the Meadowlands: pink and teal pastures where everything grows back twice as fast. Vinylla is holding a fan festival there to recruit more Variants. Leader Poppy’s market village is full of merch stalls she never agreed to.'},
 {'id': 'goldenhills', 'stage': 5, 'title': 'Golden Hills',
  'text': 'Golden grass over old stone vaults. Baron Vault has rented his vaults to Vinylla to store her variants, and rented himself along with them.'},
 {'id': 'sporeforest', 'stage': 6, 'title': 'Spore Forest',
  'text': 'Giant mushrooms puffing glittering spores. The Variants are grinding the spores into the coating of the record, so it will shine forever. Mother Morel, the forest’s leader, is not pleased.'},
 {'id': 'crystal', 'stage': 7, 'title': 'Crystal Caverns',
  'text': 'Glowing crystal, humming all day long. The miners have been ordered to cut one perfect crystal needle: a stylus big enough to play the sun.'},
 {'id': 'coral', 'stage': 8, 'title': 'Coral Trench',
  'text': 'Under the inner sea, behind reefs taller than towers, is the pressing plant. Her manager, Cass Flow, runs it. Cass knows your face.'},
 {'id': 'spire', 'stage': 8, 'title': 'Cloud Spire',
  'text': 'A city with one tower through the clouds, and at the top, Vinylla. She does not need you to like the record. She only needs you to buy it.'},
 {'id': 'innersun', 'stage': 8, 'title': 'The Inner Sun',
  'text': 'Always noon at the centre of the world. The press is ready. The record is one turn from being made. This is the final battle, before the pressing.'},
 {'id': 'ending', 'stage': 9, 'title': 'The B-side',
  'text': 'Scarcity only works if things are rare. When Aurumansa, the golden caravan, scattered its gold over the pressing floor, every limited edition in the Hollow Earth stopped being limited, and the Variants went home to think about what they had bought. The Inner Sun kept shining. Its maintenance contract was rewritten to cover the nights as well, and then, after a public vote, changed back, because everyone liked the evenings.'},
]

PEOPLE = {
 'you': {'name': 'You', 'role': 'A trainer who fell in', 'unlock': 'start',
         'text': 'You fell down a sinkhole on the surface and woke in Sundown with no memory and one coin. Who you were is the thread through the road ahead.',
         'voice': 'Whatever you choose to say.'},
 'hazel': {'name': 'Professor Hazel', 'who': 'gini', 'role': 'Billionaire researcher, Sundown', 'unlock': 'start',
           'text': 'An outsider who came down from the surface to study the clones, and stayed because the clones turned out to be the honest part. She has never trusted the people who made them. Her lab is up the steps at the back of Sundown.',
           'voice': 'Dry, kind and precise. “Classic fall-related amnesia. Very common down here.”'},
 'blake': {'name': 'Blake', 'who': 'chad', 'role': 'Your rival', 'unlock': 'start',
           'text': 'The son of Sterling Sterling III, founder of Sterling Capital, whose clone lives in the bins behind the Food Court and answers to “Mr Sterling” if you say it with enough respect. Blake is smug, rich and furious about it, and he always picks the billionaire that beats yours.',
           'voice': '“I picked the one that beats yours. No offence. Well, a little offence.”'},
 'vinylla': {'name': 'Vinylla', 'role': 'Pop megastar, Cloud Spire', 'unlock': 'flag:metVariants',
             'text': 'The biggest star in two worlds. She releases everything in limited variants (the red one, the gold one, the one signed by her cat), and her fans will buy all of them. She moved into the Cloud Spire to be closer to the sun.',
             'voice': '“If everyone can have it, it isn’t worth having. That’s not greed, babe. That’s marketing.”'},
 'cass': {'name': 'Cass Flow', 'role': 'Vinylla’s manager', 'unlock': 'flag:metCass',
          'text': 'Runs Vinylla’s tours, her merch and the pressing plant under the Coral Trench. Has a clipboard for everything, including people.',
          'voice': '“You weren’t on the list. You were never on the list.”'},
 'rocco': {'name': 'Leader Rocco', 'who': 'crude', 'role': 'Ground arena, Bubbling Grotto', 'unlock': 'meet:crude',
           'text': 'Battles in a sandstorm and wears goggles to dinner. He came down as a miner and never went back up: the rock down here, he says, at least admits it is rock.',
           'voice': '“Hope you brought goggles.”'},
 'iris': {'name': 'Leader Iris', 'who': 'markdown', 'role': 'Steel arena, Mall of the Deep', 'unlock': 'meet:markdown',
          'text': 'Runs the arena on the mall’s lowest floor, between the fountain and the escalator nobody has seen move. Polished floors, polished team, and a policy of no refunds.',
          'voice': '“Every Steel billionaire on my team makes the others hit harder.”'},
 'alta': {'name': 'Leader Alta', 'who': 'alta', 'role': 'Flying arena, Summit Capital', 'unlock': 'meet:alta',
          'text': 'The leader at the top of the world, where the air is thin and so is her patience. She once turned down a Variant’s offer by throwing it off the summit. The offer, not the Variant.',
          'voice': '“My Flying team has never once looked down.”'},
 'marina': {'name': 'Leader Marina', 'who': 'marina', 'role': 'Water arena, Tax Haven', 'unlock': 'meet:marina',
            'text': 'Runs the island arena where nobody asks questions. She knows exactly whose money is on every yacht in the harbour, and she has never told.',
            'voice': '“Relax. Nobody here asks questions.”'},
 'poppy': {'name': 'Leader Poppy', 'role': 'Grass arena, the Meadowlands', 'unlock': 'flag:region:meadowlands',
           'text': 'Grows everything twice as fast and sells it at the market twice a week. She did not agree to the fan festival on her fields, and she would like it to leave.',
           'voice': '“It grows back. That’s the whole point of a meadow.”'},
 'vault': {'name': 'Baron Vault', 'role': 'Fire arena, Golden Hills', 'unlock': 'flag:region:goldenhills',
           'text': 'Old money, old vaults, new tenant. He rented his vaults to Vinylla to store her variants, and found out too late that the lease came with him in it.',
           'voice': '“Everything has a price. I simply hadn’t asked mine.”'},
 'morel': {'name': 'Mother Morel', 'role': 'Psychic arena, Spore Forest', 'unlock': 'flag:region:sporeforest',
           'text': 'The oldest person in the forest, and the only one the mushrooms listen to. The spores the Variants are taking are her forest’s breath.',
           'voice': '“Breathe in. Now tell me what you really want.”'},
 'sparks': {'name': 'Leader Sparks', 'role': 'Electric arena, Crystal Caverns', 'unlock': 'flag:region:crystal',
            'text': 'Head of the miners’ union in the humming town under the caverns. Has been asked to cut a crystal needle the size of a tower, for a record player the size of a sun.',
            'voice': '“We cut crystal. We don’t cut corners.”'},
}

PLACES = {
 'sundown': {'history': 'A crossroads town that grew round the spot where things from the surface land. The first thing to fall here was a filing cabinet; the town hall is built round it.',
             'known': 'Professor Hazel’s lab, the free clinic, and people who are very relaxed about strangers falling out of the sky.',
             'landmark': 'The clock tower on the square, which shows the time on the surface. Nobody knows why it is always right.',
             'legend': 'Anyone who falls into Sundown and stays a year can never quite leave. Most people say this happily.'},
 'longgrass': {'history': 'The first grazing ground of the wild billionaires, back when there were only a few hundred of them.',
               'known': 'Grass up to your waist and young billionaires playing hide-and-seek in it.',
               'landmark': 'The giant tree on the rise, older than the sinkholes.',
               'legend': 'The grass grows taller round anyone who is lost, so they can hide until they feel ready to be found.'},
 'golf': {'history': 'Built by the first owners of the Hollow Earth for a tournament that never happened. The billionaires moved in before the opening ceremony.',
          'known': 'Eighteen holes gone wild, sand traps that move, and a clubhouse with no members.',
          'landmark': 'The eighteenth flag, still waiting for someone to finish the round.',
          'legend': 'A hole-in-one here grants a wish. Nobody has managed one, because the holes keep wandering off.'},
 'thicket': {'history': 'A forest that grew up round the first surveyors’ camp, and swallowed it, tents and all.',
             'known': 'Brambles, moss and mist, and billionaires that would rather not be seen.',
             'landmark': 'The old footbridge over the stream, mended with a dozen different planks.',
             'legend': 'If you whisper a secret on the bridge, the mist keeps it.'},
 'grotto': {'history': 'Hot springs found by the first miners, who promptly stopped mining.',
            'known': 'Warm water, glowing caves, and Leader Rocco’s sandstorm arena.',
            'landmark': 'The bubbling pool at the heart of the cave.',
            'legend': 'The springs are the Hollow Earth breathing. Stay quiet and you can hear it.'},
 'canyon': {'history': 'Cut by a river that has since moved somewhere quieter.',
            'known': 'Stairstep cliffs, ladders, and heat that shimmers off the rock.',
            'landmark': 'The broken bridge, which everyone uses anyway.',
            'legend': 'The river left because the canyon talked too much. On hot days you can still hear it.'},
 'scrapyard': {'history': 'Where things that fall from the surface end up if nobody claims them.',
               'known': 'Rust, crows, and treasures if you dig.',
               'landmark': 'The crane, which still moves when nobody is watching.',
               'legend': 'Somewhere in the scrap is the receipt for the filing cabinet that fell on Sundown. Whoever finds it can return the cabinet.'},
 'foodcourt': {'history': 'Opened as a staff canteen for the mall and never closed.',
               'known': 'Food from everywhere, bins behind it, and Mr Sterling in the bins.',
               'landmark': 'The neon sign, missing one letter since the day it opened.',
               'legend': 'The soup of the day has been the same soup since the Hollow Earth was found.'},
 'mall': {'history': 'A mall built so deep that it needed its own weather.',
          'known': 'Polished floors, Leader Iris’s Steel arena, and an escalator nobody has seen move.',
          'landmark': 'The fountain in the atrium, full of coins billionaires have not found yet.',
          'legend': 'There is a floor below the lowest floor. It is having a sale.'},
 'pond': {'history': 'A quiet pond the willows found before people did.',
          'known': 'Ducks with names, lily pads, frogs, and patient anglers.',
          'landmark': 'The willow that leans so far it drinks from the pond.',
          'legend': 'The ducks have names, and they will tell them to you if you are polite for long enough.'},
 'farm': {'history': 'Farmed by the same family since the first harvest under the Inner Sun.',
          'known': 'Orchards, crops that grow between your visits, and bees that sting people who talk about interest rates.',
          'landmark': 'The windmill on the hill.',
          'legend': 'The orchard bees remember every promise made near the hives.'},
 'ridge': {'history': 'The old lookout over the ring of the world, built when people still expected enemies.',
           'known': 'Heather, wind, and a view all the way round the inside of the world.',
           'landmark': 'The lookout tower.',
           'legend': 'From the top of the tower, on a clear day, you can see the back of your own head across the world.'},
 'city': {'history': 'Built in the middle of everything by people who wanted to be in the middle of everything.',
          'known': 'Banks, towers, and Capital Gains’ famous traffic, which is mostly billionaires.',
          'landmark': 'The stock exchange, which trades in everything except steps.',
          'legend': 'Every tower in Capital Gains is one floor taller than the plans say. Nobody admits to the extra floor.'},
 'offshore': {'history': 'Open sea between the shores, where the first ship that fell through the crust still lies.',
              'known': 'Deep water you cross riding a billionaire, sandbars, and wind.',
              'landmark': 'The shipwreck on the sandbar.',
              'legend': 'The shipwreck’s captain still has the receipt for the ship, and is waiting for a refund.'},
 'taxhaven': {'history': 'An island where the money of two worlds goes on holiday and never comes home.',
              'known': 'Yachts, marble, Leader Marina, and nobody asking questions.',
              'landmark': 'The marble pier, polished daily by people who are not allowed to say for whom.',
              'legend': 'There is a vault under the island so secret that it is listed in the phone book as a bakery.'},
 'volcano': {'history': 'The richest well in the world, and the hottest walk.',
             'known': 'Ash, lava, basalt, and Oilympus, deep under the mountain.',
             'landmark': 'The crater rim, where the ground hums.',
             'legend': 'Oilympus owns the ground you stand on. It is only waiting to send the bill.'},
 'pass': {'history': 'The high road through the snow, cut by runners who were late for something.',
          'known': 'Snow, wind, and herds that run the pass like a market.',
          'landmark': 'The waystone at the top of the pass.',
          'legend': 'The herds run the pass every morning at the same time. If you join them, you are counted.'},
 'summit': {'history': 'A capital built at the top of the world to be closer to the sun, and further from everyone else.',
            'known': 'Snow, thin air, Leader Alta, and a cushion of gold where Aurumansa rests.',
            'landmark': 'The golden cushion on the peak.',
            'legend': 'Aurumansa gives its gold away, and prices fall for ten years wherever it walks. The banks of Capital Gains have a team watching its every step.'},
 'lake': {'history': 'A lake that filled up from a sinkhole in reverse: water came up, not down.',
          'known': 'Clear water, reeds, and boats you can rent by the step.',
          'landmark': 'The pier and its little lighthouse.',
          'legend': 'The lake is the surface’s rain, collected over a hundred years. Taste it: it still remembers being clouds.'},
}

LEGENDS = [
 {'id': 'filing', 'title': 'The first thing to fall', 'place': 'sundown', 'unlock': 'place:sundown',
  'text': 'Sundown’s town hall is built round a filing cabinet that fell from the surface long ago. Its drawers are locked. Every mayor promises to open them; every mayor finds a reason not to.'},
 {'id': 'oilympus', 'title': 'The bill under the mountain', 'place': 'volcano', 'unlock': 'place:volcano',
  'text': 'Oilympus has slept under Mount Margin Call since before the Hollow Earth was found, leaking black gold from every joint. People say it is not asleep at all: it is waiting for interest to accrue.'},
 {'id': 'aurumansa', 'title': 'The golden caravan', 'place': 'summit', 'unlock': 'place:summit',
  'text': 'The richest thing that ever lived, and the most generous. Wherever Aurumansa walks it drops so much gold that prices fall for a decade. The banks call it a disaster. Everyone else calls it Tuesday.'},
 {'id': 'sterling', 'title': 'Mr Sterling', 'place': 'foodcourt', 'unlock': 'place:foodcourt',
  'text': 'A clone in a tattered tie lives in the bins behind the Food Court. If you call him Mr Sterling with enough respect, he will give you a business card. It is a napkin.'},
 {'id': 'sinkholes', 'title': 'Where the sinkholes come from', 'place': 'longgrass', 'unlock': 'place:longgrass',
  'text': 'The surface keeps digging, and the Hollow Earth keeps catching what falls. Hazel thinks the sinkholes open wherever someone digs too greedily. She has a map of them; it looks a lot like a map of banks.'},
]

CLUES = [
 {'id': 'coin', 'title': 'One coin', 'unlock': 'start',
  'text': 'The only thing in your pocket when you woke. A surface coin, worn smooth on one side as if someone rubbed it for luck.'},
 {'id': 'lanyard', 'title': 'A lanyard', 'unlock': 'flag:clueLanyard',
  'text': 'Found snagged on the brambles in the Long Grass, where the things that fell with you came down: ALL ACCESS — THE FOREVER TOUR — CREW. The name on it has worn away. The photo is yours.'},
 {'id': 'voicemail', 'title': 'A voice message', 'unlock': 'flag:clueVoice',
  'text': 'An old phone in the Mall of the Deep’s lost and found, with one message on it, in your own voice: “If you’re hearing this, I found out what she’s pressing. It isn’t a record. It’s a lid. Don’t let her—” The message ends there.'},
 {'id': 'face', 'title': 'A face in the crowd', 'unlock': 'flag:metCass',
  'text': 'At the pressing plant, the manager with the clipboard looked at you the way people look at a bill they thought they had paid. “You? We dropped you.”'},
 {'id': 'who', 'title': 'Who you were', 'unlock': 'flag:ending',
  'text': 'You were the sound engineer on Vinylla’s Forever Tour. You found the plans for the pressing, you tried to tell someone, and Cass Flow made sure the next sinkhole had your name on it. You came down with nothing. You go on with a team, a rival, and a sun that still rises.'},
]

BOOKS = {
 'fieldguide': {'title': 'A Field Guide to the Hollow Earth', 'by': 'Prof. Hazel',
                'pages': ['Billionaires are not dangerous unless you are holding money, are standing between them and money, or are money.',
                          'They live everywhere: tall grass, caves, canyons, malls and the bottom of the sea. Each kind keeps to what its original loved most.',
                          'Toss a coin and a billionaire will chase it. While it counts, it is yours. Be kind: they did not ask to be made.']},
 'brochure': {'title': 'Legacy Labs: Your Fortune, Backed Up', 'by': 'a glossy brochure',
              'pages': ['Why risk it all? For a modest fee, Legacy Labs will keep a living backup of you, safely stored offshore.',
                        'Our proprietary gap-filling process ensures every backup is complete. Results may vary. Tails are not covered by warranty.',
                        'Legacy Labs accepts no liability for backups that refuse to sign, eat bins, or multiply.']},
 'programme': {'title': 'The Forever Tour: programme', 'by': 'a page torn from a concert programme',
               'pages': ['VINYLLA — THE FOREVER TOUR. One night only, every night, forever.',
                         'Limited variants of tonight’s show on sale in the foyer: red, gold, and signed by her cat. Crew: please wear your lanyard at all times.']},
 'charter': {'title': 'The Sundown Town Charter', 'by': 'the town council',
             'pages': ['Article 1. Anyone who falls into Sundown is a resident of Sundown.',
                       'Article 2. Residents shall not sell other residents, including the billionaires, the ducks, and the filing cabinet.',
                       'Article 3. The clinic is free. It always was. Stop asking.']},
 'steps': {'title': 'The Step Standard', 'by': 'an economics textbook, much underlined',
           'pages': ['In the Hollow Earth, value is measured in steps, because steps cannot be printed, borrowed or inherited.',
                     'Attempts to sell steps have failed, because the buyer still has to walk them.']},
 'amnesia': {'title': 'Fall-Related Amnesia and You', 'by': 'a clinic leaflet',
             'pages': ['Very common down here! Most people remember who they were within a year. Some prefer not to.',
                       'Things that help: walking, sleep, a good team, and not reading your old emails.']},
}

LOADING = [
 'Officially the Inner Sun never sets. Its maintenance contract only covers business hours.',
 'A billionaire cannot resist a coin. That is how you catch one.',
 'Every step counts. Your team grows stronger with every one you walk.',
 'Legacy Labs: your fortune, backed up. Tails not covered by warranty.',
 'Things that fall from the surface mostly land near Sundown.',
 'The clinic in Sundown is free. It always was. Stop asking.',
 'Tip: Water beats Fire, Fire beats Grass, Grass beats Water. Most billionaires beat your patience.',
 'Tip: tap the road sign at a town’s edge to see where the road goes.',
 'Tip: walk into the tall grass to meet wild billionaires. They are not shy; they are negotiating.',
 'Tip: a gold billionaire is a limited variant. Collectors will try to buy it from you. Don’t.',
 'The ducks on Sundown’s pond have names. They won’t tell you yet.',
 'The escalator in the Mall of the Deep has never been seen moving.',
 'Down here, value is measured in steps, because steps can’t be inherited.',
 'Aurumansa gives its gold away. The banks call it a disaster.',
 'The soup of the day at the Food Court has been the same soup since 1971.',
 'Professor Hazel has a map of the sinkholes. It looks a lot like a map of banks.',
 'Billionaires are not dangerous unless you are holding money, or are money.',
 'Blake picked the one that beats yours. No offence. Well, a little offence.',
 'The Hollow Earth has changed hands eleven times. Nobody who lives here was asked.',
 'Tip: rest at a bench or your room to heal your team.',
 'Tip: the place card at the top shows the hour, the weather and where you can go.',
 'Loading the inner sky. Please keep your hands inside the planet.',
 'Counting coins. Billionaires insist.',
 'Polishing the marble in Tax Haven. Nobody asked who for.',
 'Warming up the Inner Sun. Business hours only.',
]

# what people say, per place and per stage of the story (the stage is the number of badges you have; a line set
# shows from its stage on, and a scene's own chat still mixes in)
CHAT = {
 'sundown': {'0': ['You fell out of the sky? Welcome! The last one was a filing cabinet.', 'Hazel’s lab is up the steps. She’s good with people who don’t remember things.'],
             '2': ['Have you seen the people in gold jackets? They offered me cash for my cat. My cat is not a billionaire.', 'Blake was here earlier, telling everyone you’re his rival. He sounded proud of it.'],
             '4': ['They say the Variants went up the volcano. What would anyone want up there?', 'You’ve got four badges? The roads beyond the ring are open now. Bring snacks.']},
 'longgrass': {'0': ['The hole you fell out of is somewhere round here. Things snag on the brambles near it.', 'Young billionaires hide in the tall grass. Walk slowly and they come to you.']},
 'city': {'0': ['The exchange trades everything except steps. They keep trying.', 'Don’t feed the billionaires in the square. They unionise.'],
          '2': ['A Variant just bought three rare billionaires on the steps of the bank, cash, no receipt.']},
 'mall': {'0': ['Lost and found is by the fountain. People leave the strangest things.', 'Has anyone ever seen that escalator move? No? Me neither.']},
 'foodcourt': {'0': ['Don’t mind the clone in the bins. He used to run a bank. He still does, technically.']},
 'taxhaven': {'0': ['Nobody here asks questions. That was a question. Forget it.']},
 'summit': {'0': ['Aurumansa came by yesterday and dropped a bit of gold. Bread is cheaper now.']},
 'volcano': {'2': ['Gold jackets went up the mountain this morning with a lot of barrels. Odd thing to bring to a volcano.']},
 'farm': {'0': ['The bees sting anyone who talks about interest rates. They’ve never stung me.']},
 'scrapyard': {'0': ['Everything that falls from the surface ends up here eventually. Even people, nearly.']},
}


def main():
    force = '--force' in sys.argv
    src = DATA.read_text(encoding='utf-8'); k0 = src.index('window.GAMEDATA='); head = src[:k0]
    D = json.JSONDecoder().raw_decode(src[k0 + len('window.GAMEDATA='):])[0]
    L = D.setdefault('lore', {}); did = []
    for k, v in (('world', WORLD), ('story', STORY), ('people', PEOPLE), ('places', PLACES), ('legends', LEGENDS), ('clues', CLUES),
                 ('books', BOOKS), ('loading', LOADING), ('chat', CHAT)):
        if force or k not in L: L[k] = v; did.append(k)
    DATA.write_text(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
    print('lore: ' + (', '.join(did) or 'all there (use --force to write it again)'))


if __name__ == '__main__':
    main()
