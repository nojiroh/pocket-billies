#!/usr/bin/env python3
"""v38: the species data for the roster lines drawn by tools/build-roster-sheets.py, written into game/data/gamedata.js
(GD.lines, right after the three starter lines so the Guide numbers them 13 onward) and the encounter pools of the
regions these lines fill. A line that is already in gamedata.js is left alone (the Studio may have edited it); the
roster's "state" flags are updated for every species that has a sheet and a rig.

Learn sets are built from the move list by type (a species learns its own types' moves, a neutral move or two, and
one move of its parody's taste); stats from a six-number profile (HP, Attack, Defense, Sp. Atk, Sp. Def, Speed).

    python3 tools/build-roster-data.py [--force]"""
import json, re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'data' / 'gamedata.js'
NEXT = ROOT / 'game' / 'art' / 'next'

def load():
    s = DATA.read_text(); i = s.index('{'); j = s.rindex('}'); return s[:i], json.loads(s[i:j + 1]), s[j + 1:]

# ---------------------------------------------------------------- the lines (names from GD.roster; the rest here)
# prof: HP Atk Def SpA SpD Spe · rar: common | uncommon | rare · evo: levels (one per evolution) · taste: a move the parody would pick
LINES = {
 'huang': dict(prof=[.9, 1, .85, 1.3, .95, 1.15], rar='uncommon', evo=[16, 36], taste='overload', cat=['Chip Billionaire', 'Card Billionaire', 'Gigafactory Billionaire'], ht=[.3, 1.1, 3.2], wt=[2, 40, 900],
   hab=['Warm server rooms', 'Gaming dens', 'Data centres the size of towns'], diet=['Static', 'Power, lots of it', 'Whole power grids'],
   bio=['A gecko hatchling with one glowing scale on its back. It sticks to warm walls and hums when it thinks.', 'A lizard whose back spines glow like a row of cards. It runs hot, so it is always looking for a fan.', 'A great lizard that rolls a glowing die before every move. The fans along its back roar when it attacks; the lights in town dim.'],
   note=['Every scale it grows is worth more than the last one.', 'Sells the same spine to everyone, and everyone queues.', 'Its value doubled while you read this.']),
 'ellison': dict(prof=[.95, 1, .9, 1.1, .95, 1.1], rar='uncommon', evo=[18, 38], taste='exclusive', cat=['Chick Billionaire', 'Regatta Billionaire', 'Island Billionaire'], ht=[.2, .9, 2.6], wt=[1, 12, 400],
   hab=['Harbour walls', 'Open water on race day', 'Its own island'], diet=['Small fish', 'Trophies', 'Whole databases'],
   bio=['A sea-tern chick that paddles about on a scrap of driftwood and shouts at bigger boats.', 'A tern that wins every race on the lake and tells everyone about its database afterwards.', 'A tern that carries an island on its back, with a house on top. It bought the island to have somewhere to keep the trophies.'],
   note=['Already thinks the harbour is too small.', 'Changes the rules of the regatta between heats.', 'The sixth-largest thing in the sky by net worth.']),
 'ma': dict(prof=[1, 1, .85, 1.2, .9, 1.15], rar='common', evo=[16, 36], taste='flashsale', cat=['Seed Billionaire', 'Bazaar Billionaire', 'Cave Billionaire'], ht=[.3, 1.2, 3], wt=[3, 45, 700],
   hab=['Sesame fields', 'Crowded markets', 'Mountain caves with forty doors'], diet=['Sesame seeds', 'Haggling', 'Everything on sale'],
   bio=['A salamander that hatched out of a sesame seed. Say "open" and it will come out; it never quite closes again.', 'Stalls have grown along its tail like scales, and it haggles with everyone who walks by, including itself.', 'Forty cave doors run down its back and all of them are open for business. It lies in the river like a crocodile and lets the customers come to it.'],
   note=['Its first word was "open".', 'Will sell you the thing you are already holding.', 'Was asked to stop talking by someone bigger, and did, for a while.']),
 'walton': dict(prof=[1.15, 1.05, 1.1, .8, 1, .85], rar='common', evo=[15, 34], taste='markdown', cat=['Cart Billionaire', 'Vest Billionaire', 'Supercenter Billionaire'], ht=[.4, 1.1, 4], wt=[8, 50, 2000],
   hab=['Car parks', 'Shop aisles', 'The edge of every town'], diet=['Whatever is on the bottom shelf', 'Rollbacks', 'Small shops'],
   bio=['A bulldog puppy that rides around in a shopping cart and will not get out. It knows where everything is.', 'A bulldog with a blue patch on its chest and a smile for everyone. It rolls prices back with one paw and the competition over with the other.', 'A bulldog the size of a supercenter. Its shadow is a car park. Towns build themselves around wherever it decides to sit.'],
   note=['Greets everyone at the door.', 'Always the lowest price. Always.', 'The whole family lives in it.']),
 'bloomberg': dict(prof=[.9, .8, 1, 1.3, 1.1, .9], rar='uncommon', evo=[17, 36], taste='headline', cat=['Bud Billionaire', 'Screen Billionaire', 'Terminal Billionaire'], ht=[.3, 1, 2.8], wt=[1, 15, 300],
   hab=['Window boxes in the financial district', 'Trading floors', 'City halls'], diet=['Morning light', 'Numbers', 'Rent from anyone reading its numbers'],
   bio=['A flower bud with a pale stripe down its face. One leaf flutters like ticker tape; it knows the price of everything.', 'When it bloomed, its petals came out orange on black and full of numbers. People pay to look at it.', 'A tree of glowing petals that has run a city once and would like to again. Reading it costs a fortune a month.'],
   note=['Its leaf shows yesterday\'s close.', 'Nobody has ever seen it switched off.', 'Charges rent to the bees.']),
 'jobs': dict(prof=[.85, .9, 1, 1.3, 1.05, 1], rar='rare', evo=[18, 40], taste='hype', cat=['Seed Billionaire', 'Turtleneck Billionaire', 'Reality Billionaire'], ht=[.2, .9, 2.2], wt=[1, 40, 250],
   hab=['Garages', 'Dark stages with one spotlight', 'Wherever the air bends'], diet=['Apples, one bite at a time', 'Applause', 'Belief'],
   bio=['An apple seed with a green sprout and one bite already missing. It insists the bite was a design choice.', 'A turtle with a black ring of shell round its neck. It presents one more thing, then one more thing after that.', 'Its violet shell bends the air; everything near it looks a little better than it is. People queue overnight to stand close.'],
   note=['Thinks different.', 'Simple on the outside, and only on the outside.', 'The field around it is a feature.']),
 'knight': dict(prof=[.9, 1.05, .85, .95, .9, 1.35], rar='common', evo=[16, 36], taste='liftoff', cat=['Lace Billionaire', 'Swoosh Billionaire', 'Victory Billionaire'], ht=[.3, 1, 2.4], wt=[2, 20, 160],
   hab=['Running tracks', 'Stadiums', 'Billboards'], diet=['Laces', 'Sponsorship', 'Records'],
   bio=['A hare kit with a red lace of a tail. It just does it, whatever it is, before anyone has asked.', 'A winged hare with a red swoosh across its flank. It has never finished second and will not discuss it.', 'A hare in steel-grey fur with wings of feathers and a stripe of red. Every athlete in the Hollow Earth wears its mark.'],
   note=['Started in the boot of a car.', 'Just does it.', 'Pays the fastest to run in its colours.']),
 'kroc': dict(prof=[1.1, 1.1, 1, .9, .9, 1], rar='common', evo=[16, 36], taste='bulk', cat=['Fry Billionaire', 'Patty Billionaire', 'Arches Billionaire'], ht=[.3, 1.4, 3.6], wt=[2, 60, 1200],
   hab=['Drive-throughs', 'Roadside grills', 'Every roadside, everywhere'], diet=['Fries', 'Billions of patties', 'Real estate, mostly'],
   bio=['A crocodile hatchling striped yellow like a fry carton. It has already served four.', 'Grill marks run along its back and a bun of a hump sits on its shoulders. It has served billions and is counting.', 'Golden arches for jaws and a drive-through for a body. It is not in the food business, it says; it is in the land business.'],
   note=['Counts every customer.', 'The same in every town, on purpose.', 'Owns the ground under every grill.']),
 'ambani': dict(prof=[1.25, 1.1, 1.2, .8, 1, .7], rar='uncommon', evo=[18, 38], taste='renthike', cat=['Tusk Billionaire', 'Pipeline Billionaire', 'Tower Billionaire'], ht=[.8, 2.4, 5], wt=[90, 2000, 9000],
   hab=['Telecom towers', 'Refineries', 'A 27-storey house'], diet=['Signal', 'Crude oil', 'Cities'],
   bio=['An elephant calf with a glowing tip to its trunk that picks up every signal in town.', 'Steel tusks like refinery pipes and a crimson tent of a back. It carries a wedding for a thousand guests without noticing.', 'It carries a house of twenty-seven storeys on its back, with a helipad on top. The house has a floor just for the snow.'],
   note=['Its trunk gets five bars anywhere.', 'Its weddings have a dress code for the elephants.', 'The house has a floor for the cars.']),
 'ortega': dict(prof=[.9, 1, .95, 1.1, 1, 1.1], rar='common', evo=[16, 36], taste='flashsale', cat=['Spool Billionaire', 'Weaver Billionaire', 'Window Billionaire'], ht=[.2, .9, 2.6], wt=[1, 10, 120],
   hab=['Sewing baskets', 'High streets', 'Shop windows on every high street'], diet=['Thread', 'Last fortnight\'s fashion', 'Mannequins'],
   bio=['A spiderling that lives on a spool of thread and has already spun one outfit this morning.', 'It weaves a whole new look every two weeks and throws the old one away without looking at it.', 'Its web is a shop window and the flies caught in it are dressed better than you. Nobody has ever seen it; it never gives interviews.'],
   note=['Spins faster than anyone can wear.', 'Fast fashion with eight legs.', 'Has never once been photographed.']),
 'hughes': dict(prof=[.95, 1, .9, 1.1, .9, 1.2], rar='uncommon', evo=[16, 36], taste='launch', cat=['Gosling Billionaire', 'Spruce Billionaire', 'Aviator Billionaire'], ht=[.3, 1.6, 3.4], wt=[2, 120, 900],
   hab=['Airfields', 'Hangars too big for the plane', 'A hotel room with the curtains shut'], diet=['Grass', 'Spruce', 'Film reels'],
   bio=['A gosling with dark rings round its eyes like flying goggles. It wants to go faster than anything has gone.', 'Its wings grew out of spruce. It is too big to fly more than once, and the once was enough to make the papers.', 'Its tail is a film reel and it keeps a studio under one wing and an airline under the other. It has not come out of the hangar in years.'],
   note=['Wants to be the fastest thing alive.', 'Flew for one mile, once.', 'Washes its wings forty times a day.']),
 'carnegie': dict(prof=[1.05, 1.15, 1.3, .8, 1, .7], rar='common', evo=[16, 36], taste='gentrify', cat=['Rivet Billionaire', 'Girder Billionaire', 'Library Billionaire'], ht=[.2, 1.2, 3.8], wt=[3, 200, 4000],
   hab=['Steel mills', 'Bridges', 'Libraries it built itself'], diet=['Iron filings', 'Steel', 'Books, by the tonne'],
   bio=['A beetle larva made of rivets. It is very small and very hard and it is saving up.', 'Its horns are I-beams. It builds bridges with its jaws and charges for the crossing.', 'A giant beetle carrying a library on its back for every town it stomps through. The towns are grateful and a little flattened.'],
   note=['Started as a bobbin boy.', 'Owns the bridge and the river under it.', 'Gives away the money with its name on the door.']),
 'lauren': dict(prof=[.95, 1, .95, 1.1, 1.05, 1.05], rar='uncommon', evo=[17, 37], taste='oldmoney', cat=['Foal Billionaire', 'Pony Billionaire', 'Dream Billionaire'], ht=[.9, 1.6, 2.4], wt=[60, 300, 600],
   hab=['Paddocks with white fences', 'Prep schools', 'A ranch the size of a county'], diet=['Clover', 'Polo', 'The dream, not the shirt'],
   bio=['A foal with a small blue polo patch on its chest. It stands very straight for its age.', 'A pony with a navy mane that falls just so and a chest patch everyone copies. It plays polo and wins quietly.', 'A horse so well dressed in its own coat that it sells the dream of being it. The shirt is the least of it.'],
   note=['Born in the Bronx, raised in a catalogue.', 'The collar is natural.', 'Sells a life, with a horse in it.']),
 'ford': dict(prof=[1.05, 1.1, 1.1, .85, .9, 1.05], rar='common', evo=[16, 36], taste='bulk', cat=['Crank Billionaire', 'Model Billionaire', 'Assembly Billionaire'], ht=[.9, 1.7, 2.8], wt=[70, 800, 2500],
   hab=['Farm lanes', 'Factory floors', 'A line that never stops'], diet=['Oats', 'Oil', 'Copies of itself'],
   bio=['A foal with a crank handle of a tail. Turn it and the foal starts, usually.', 'Half horse, half black car. It comes in any colour as long as it is black, and it is black.', 'An assembly line runs down its back and new horses roll off the end. They are all black and all the same.'],
   note=['Wanted a faster horse. Became one.', 'Black is quickest to dry.', 'Doubled the pay and halved the day.']),
 'slim': dict(prof=[.9, .9, .95, 1.2, 1.05, 1.1], rar='uncommon', evo=[16, 36], taste='interest', cat=['Cord Billionaire', 'Line Billionaire', 'Signal Billionaire'], ht=[.5, 2.5, 8], wt=[1, 30, 500],
   hab=['Behind the desk', 'Telephone poles', 'Every line in the country'], diet=['Static', 'Minutes', 'Whole countries\' minutes'],
   bio=['A thin snake made of blue telephone cord. It hums a dial tone when it is content.', 'It coils round every phone line in town and listens, politely, to all of them.', 'It wraps a whole country\'s signal in its coils and charges by the minute. The minutes are long.'],
   note=['Still uses a landline.', 'Owns the line, the pole and the call.', 'Keeps its money in a paper notebook.']),
 'cuban': dict(prof=[.95, 1.1, .9, 1.1, .9, 1.15], rar='common', evo=[24], taste='pump', cat=['Pup Billionaire', 'Tank Billionaire'], ht=[.5, 2.4], wt=[8, 300],
   hab=['Reefs by the arena', 'A tank with a chair in it'], diet=['Small fish', 'Pitches'],
   bio=['A shark pup with a stripe of blue down its flank and a lot to say about the game last night.', 'A shark that sits in a tank and listens to pitches. It says "I\'m out", waits a beat, and invests anyway.'],
   note=['Sold its first business before it could swim.', 'Owns the team and argues with the referee.']),
 'pagebrin': dict(prof=[.9, .85, .9, 1.35, 1.05, 1.1], rar='uncommon', evo=[26], taste='disrupt', cat=['Sniff Billionaire', 'Index Billionaire'], ht=[.5, 1.8], wt=[10, 120],
   hab=['Dorm rooms', 'A campus with slides in it'], diet=['Everything, once', 'Everything, indexed'],
   bio=['A two-headed puppy with blue-spotted fur that can find anything you have lost, and several things you have not.', 'One head indexes the world and the other builds moonshots. Its long ears hear every question anyone asks.'],
   note=['Two heads, one answer, in a quarter of a second.', 'Don\'t be evil, it says, and then checks.']),
 'thiel': dict(prof=[.85, .8, 1.05, 1.35, 1.2, .9], rar='rare', evo=[28], taste='fud', cat=['Marble Billionaire', 'Seeing Billionaire'], ht=[.2, 1.4], wt=[1, 60],
   hab=['The back of a drawer', 'A tower with no windows'], diet=['Light', 'What happens next'],
   bio=['A glass marble with one eye that always looks the other way. If everyone looks left, it looks right, on principle.', 'A seeing-stone on spider legs. It sees the market before it happens and tells very few people.'],
   note=['Contrarian since birth.', 'Zero to one, then it keeps the one.']),
 'dorsey': dict(prof=[.85, .95, .85, 1.15, 1, 1.25], rar='common', evo=[22], taste='post3am', cat=['Finch Billionaire', 'Block Billionaire'], ht=[.2, 1.2], wt=[1, 20],
   hab=['Short branches', 'Mountain tops, in silence'], diet=['Seeds, 140 of them', 'Nothing, for ten days'],
   bio=['A bearded finch that only ever says a hundred and forty characters, and says them to everyone.', 'It left its nest to the owls and now sits very still on a square stone, meditating and taking a small cut of every payment in town.'],
   note=['Says less, more often.', 'Eats one meal a day and talks about it.']),
 'ek': dict(prof=[.9, .9, .9, 1.2, 1, 1.15], rar='common', evo=[22], taste='rerecord', cat=['Shuffle Billionaire', 'Playlist Billionaire'], ht=[.2, .8], wt=[1, 9],
   hab=['Pond edges with good acoustics', 'Lily pads with a speaker on them'], diet=['Algae', 'Flies, paid to artists'],
   bio=['A green tadpole with pale spots that hums the next song before you have finished the last.', 'A frog whose croak is a playlist. It pays the artists in flies, a fraction of a fly at a time.'],
   note=['Knows what you listened to last year.', 'The flies are divided fairly, it says.']),
 'son': dict(prof=[.95, .9, .9, 1.3, 1, 1.05], rar='uncommon', evo=[26], taste='moon', cat=['Soft Billionaire', 'Vision Billionaire'], ht=[.5, 1.9], wt=[9, 110],
   hab=['Under the desk', 'The future, apparently'], diet=['Whatever is next', 'Whatever is after that'],
   bio=['A white puppy with sky-blue eyes that plans three hundred years ahead and forgets dinner.', 'A hound with a ruff of white fur and eyes like fund charts. It bets everything on whatever comes next, and most of it on one thing.'],
   note=['Has a three-hundred-year plan on the fridge.', 'Lost more in a day than most towns are worth. Smiled.']),
 'buterin': dict(prof=[.8, .85, .8, 1.4, 1.05, 1.3], rar='rare', evo=[28], taste='disrupt', cat=['Ether Billionaire', 'Contract Billionaire'], ht=[.8, 1.9], wt=[20, 90],
   hab=['Whiteboards', 'A different city every week'], diet=['Code', 'Gas, in small fees'],
   bio=['A very thin, very fast unicorn foal with a glow in its coat. It is made of code and is a bit shy about it.', 'Its violet horn runs smart contracts and its mane is a stripe of code. It owns one shirt and gives most things away.'],
   note=['Does not own a car, or a chair.', 'Wrote the whole thing at nineteen.']),
 'saylor': dict(prof=[1.1, 1.05, 1.2, .9, 1.05, .7], rar='uncommon', evo=[26], taste='buyhold', cat=['Hodl Billionaire', 'Dip Billionaire'], ht=[.8, 2.2], wt=[50, 900],
   hab=['A paddock with one orange stone in it', 'A storm, buying'], diet=['One orange coin', 'The dip'],
   bio=['A calf with a blaze of orange on its forehead that clutches one orange pebble and will not, under any circumstances, let it go.', 'A navy bull with glowing orange eyes and curled horns. It buys the dip in a storm, and then the next dip, and keeps every pebble it has ever bought.'],
   note=['Has never sold anything.', 'There is no second best, it says, holding the first.']),
 'winklevoss': dict(prof=[1, 1.1, 1, .9, .9, 1.1], rar='common', evo=[24], taste='compound', cat=['Scull Billionaire', 'Vossel Billionaire'], ht=[.5, 2.2], wt=[8, 180],
   hab=['Boathouses', 'The river at dawn, in sync'], diet=['Fish, two at a time', 'Settlements'],
   bio=['A two-headed otter pup that rows a scrap of bark with both heads calling the stroke.', 'A sculling boat of an otter with two identical heads that row in perfect time and agree on everything, especially who had the idea first.'],
   note=['Both heads claim the idea.', 'Still waiting on a settlement.']),
 'jayz': dict(prof=[.9, 1, .9, 1.2, .95, 1.15], rar='uncommon', evo=[24], taste='exclusive', cat=['Jay Billionaire', 'Hova Billionaire'], ht=[.2, 1.4], wt=[1, 25],
   hab=['Fire escapes', 'Penthouses'], diet=['Seeds and 99 problems', 'Champagne, its own label'],
   bio=['A blue jay chick with a dark mask and a mixtape of calls. It has ninety-nine problems and a song about each.', 'A crowned jay whose every feather is a record label. Its tail fans out like a glass of champagne; it owns the champagne.'],
   note=['Not a businessman. A business, man.', 'Sold out the garden thrice.']),
 'woods': dict(prof=[.95, 1.2, .9, 1, .9, 1.05], rar='uncommon', evo=[26], taste='harvest', cat=['Cub Billionaire', 'Green Billionaire'], ht=[.6, 1.6], wt=[12, 220],
   hab=['Driving ranges', 'The eighteenth green on Sunday'], diet=['Range balls', 'Majors'],
   bio=['A tiger cub with dark stripes and a golden tip to its tail that it uses as a tee.', 'A red-coated tiger that stalks a green and sinks everything. The fist-pump is its taunt and it has fifteen of them.'],
   note=['Could putt before it could walk.', 'Sunday red, always.']),
 'lebron': dict(prof=[1.15, 1.2, 1, .9, .9, 1], rar='rare', evo=[26], taste='pump', cat=['Cub Billionaire', 'King Billionaire'], ht=[.7, 2.1], wt=[20, 260],
   hab=['Courtside', 'Wherever it takes its talents next'], diet=['Chalk dust', 'Rings'],
   bio=['A lion cub with a blaze on its brow and a cloud of chalk that follows it around. It is already the best in the room.', 'A crowned lion with a dark mane and the word on everyone\'s lips. It takes its talents elsewhere and the city follows.'],
   note=['Chosen before it was born.', 'Built a school. Built a team. Built a brand.']),
 'spielberg': dict(prof=[.95, .9, .95, 1.25, 1.05, .9], rar='uncommon', evo=[26], taste='headline', cat=['Clapper Billionaire', 'Director Billionaire'], ht=[.5, 1.5], wt=[10, 80],
   hab=['Creeks with a good angle', 'Dams that are film sets'], diet=['Bark', 'Popcorn'],
   bio=['A beaver kit whose flat tail claps like a clapperboard. Action, it says, and then does not say cut.', 'It builds dams that are film sets, with a moon behind them and a bicycle flying past it. Two birds always circle in the shot.'],
   note=['Shot its first film at twelve.', 'The shark never worked, so it stayed off screen.']),
 'dyson': dict(prof=[.9, .9, 1, 1.25, 1, 1.1], rar='uncommon', evo=[26], taste='overload', cat=['Snuffle Billionaire', 'Cyclone Billionaire'], ht=[.6, 1.8], wt=[10, 90],
   hab=['Dusty corners', 'Workshops full of prototypes'], diet=['Dust', 'Everything on the floor'],
   bio=['An anteater pup whose snout hums. It never loses suction, and it never stops.', 'Its ringed body is a cyclone with no bag. Five thousand prototypes stand behind it and it is still not happy with this one.'],
   note=['Hums in B flat.', 'Has never once lost suction.']),
 'kamprad': dict(prof=[1, .9, 1.1, 1, 1.1, .95], rar='common', evo=[24], taste='flashsale', cat=['Flatpack Billionaire', 'Assembly Billionaire'], ht=[.4, 1.5], wt=[6, 60],
   hab=['Flat boxes', 'A warehouse with a one-way path'], diet=['Meatballs', 'Allen keys'],
   bio=['A rat that arrived in a flat box with the instructions missing. It has one screw left over and it is fine.', 'It assembles itself every morning with one screw to spare. Its cheeks are full of meatballs and its heart is in the car park.'],
   note=['Some assembly required.', 'Never throws the extra screw away.']),
 'mateschitz': dict(prof=[.9, 1.1, .85, 1.1, .85, 1.35], rar='uncommon', evo=[26], taste='liftoff', cat=['Can Billionaire', 'Wing Billionaire'], ht=[.5, 1.9], wt=[10, 260],
   hab=['Pit lanes', 'The edge of space, sponsored'], diet=['Taurine', 'Stunts'],
   bio=['A little blue-and-silver bull that fizzes when shaken. It is awake.', 'It gave itself wings and now sponsors every stunt it does, including the fall.'],
   note=['Gives you wings.', 'Jumped from space for the footage.']),
 'rinehart': dict(prof=[1.2, 1.1, 1.2, .8, 1, .7], rar='common', evo=[24], taste='deepdrill', cat=['Ore Billionaire', 'Pit Billionaire'], ht=[.5, 1.6], wt=[20, 400],
   hab=['Red dirt', 'A hole the size of a state'], diet=['Iron ore', 'Whole hills'],
   bio=['A wombat with an iron-ore nugget it will not share. It digs faster than you can watch.', 'It has dug a hole the size of a state and wears a golden crest of ore as a crown. The hole is for sale, by the tonne.'],
   note=['Inherited the hole and made it bigger.', 'Pays the diggers in advice.']),
 'dangote': dict(prof=[1.2, 1.15, 1.25, .8, .95, .65], rar='uncommon', evo=[26], taste='gentrify', cat=['Sack Billionaire', 'Concrete Billionaire'], ht=[.8, 2.6], wt=[80, 2400],
   hab=['Building sites', 'A refinery the size of a town'], diet=['Cement', 'Sugar cane'],
   bio=['A rhino calf with a stubby horn that carries a sack of cement everywhere, in case.', 'A concrete-horned rhino with a sugar-cane tail and a refinery on its back. Half the towers in the Hollow Earth are poured from it.'],
   note=['Started with a loan from an uncle. Paid it back in concrete.', 'The refinery runs on its own sugar.']),
 'yanai': dict(prof=[.95, 1, 1.15, .95, 1.1, .9], rar='common', evo=[24], taste='markdown', cat=['Claw Billionaire', 'Basics Billionaire'], ht=[.2, 1.1], wt=[1, 30],
   hab=['Tide pools, folded neatly', 'Shop floors with everything in its place'], diet=['Plankton', 'Fleece, by the mile'],
   bio=['A lobster larva folded as neatly as a T-shirt. It unfolds to say hello and folds back.', 'A navy lobster in its own neat basics. It folds anything perfectly in one move and has never worn a logo.'],
   note=['Folds in one motion.', 'No logo. Never a logo.']),
 'kashing': dict(prof=[.95, 1, 1, 1.1, 1.05, 1.1], rar='uncommon', evo=[26], taste='renthike', cat=['Flower Billionaire', 'Harbour Billionaire'], ht=[.4, 2.4], wt=[2, 300],
   hab=['Flower stalls on the pier', 'Every dock in the harbour'], diet=['Nectar', 'Harbour fees'],
   bio=['A crane chick with a crimson blaze that started out selling plastic flowers on the pier and has not stopped.', 'A harbour-crane of a crane. It owns the docks it stands on, the ships that come in, and the water, if anyone asks.'],
   note=['Sold flowers at twelve.', 'Owns the pier it was born on.']),
 'mittal': dict(prof=[1.05, 1.3, 1.2, .9, .9, .85], rar='rare', evo=[], taste='gusher', cat=['Furnace Billionaire'], ht=[2.4], wt=[1800],
   hab=['Blast furnaces'], diet=['Scrap steel'], bio=['A lion poured from steel with a furnace for a mane. It buys every mill that goes cold and lights it again.'], note=['Its roar is a blast furnace.']),
 'dalio': dict(prof=[1, .9, 1.25, 1.1, 1.25, .8], rar='uncommon', evo=[], taste='hedge', cat=['Principle Billionaire'], ht=[.7], wt=[25],
   hab=['Hedgerows, obviously'], diet=['Principles, one a day'], bio=['A hedgehog whose spines are principles, numbered. It hedges every bet and rolls up in a storm, which is also a principle.'], note=['Has 212 principles and counting.']),
 'griffin': dict(prof=[.95, 1.15, 1, 1.15, .95, 1.3], rar='rare', evo=[], taste='shortsell', cat=['Citadel Billionaire'], ht=[2.2], wt=[400],
   hab=['A castle on the shore'], diet=['Milliseconds'], bio=['A griffin perched on a castle it carries on its back. It moves faster than the market and gets there first.'], note=['Trades before the bell, and after.']),
 'schultz': dict(prof=[.95, .9, .95, 1.2, 1.1, 1], rar='uncommon', evo=[], taste='spin', cat=['Siren Billionaire'], ht=[1.5], wt=[60],
   hab=['Every corner, in pairs'], diet=['Beans, dark roast'], bio=['A green two-tailed siren with a mane of kelp and a pebble it holds like a cup. It will get your name wrong and charge you for the extra shot.'], note=['Calls you by a name that is almost yours.']),
 'chesky': dict(prof=[.9, .95, 1.2, 1, 1.15, .9], rar='common', evo=[], taste='renthike', cat=['Rental Billionaire'], ht=[.6], wt=[12],
   hab=['Other crabs\' shells'], diet=['Cleaning fees'], bio=['A hermit crab that rents out shells it does not live in. The shell on its back is listed on three sites.'], note=['The shell has a two-night minimum.']),
 'hastings': dict(prof=[.9, .95, .85, 1.25, 1, 1.2], rar='uncommon', evo=[], taste='hype', cat=['Binge Billionaire'], ht=[1.2], wt=[20],
   hab=['Dark living rooms'], diet=['Attention, one more episode at a time'], bio=['A red bat that asks "still watching?" every third turn and starts the next one before you answer.'], note=['Mailed discs once. Nobody believes it.']),
 'altman': dict(prof=[.85, .85, .9, 1.4, 1.1, 1.05], rar='rare', evo=[], taste='twoday', cat=['Oracle Billionaire'], ht=[1], wt=[15],
   hab=['A cloud above the lab'], diet=['Every book ever written'], bio=['An owl with a cloud for a brain. It answers everything, at length, and is wrong about one thing in ten with great confidence.'], note=['Was fired on a Friday and back by Tuesday.']),
 'newell': dict(prof=[1.3, 1, 1.25, .95, 1.15, .55], rar='uncommon', evo=[], taste='allowance', cat=['Valve Billionaire'], ht=[2], wt=[1200],
   hab=['A warm rock by a steam vent'], diet=['Whatever is on sale, in a bundle'], bio=['A walrus asleep on a steam valve. It counts to two and never, ever to three.'], note=['Sells everyone\'s games and makes a few of its own, slowly.']),
 'yiming': dict(prof=[.85, .95, .85, 1.2, .95, 1.4], rar='uncommon', evo=[], taste='disrupt', cat=['Loop Billionaire'], ht=[.8], wt=[9],
   hab=['Phone screens'], diet=['Fifteen seconds of you'], bio=['A ferret with a clock-face patch on its chest that dances in fifteen-second loops and knows exactly what you want to see next.'], note=['Every loop is a little different, on purpose.']),
 'ponyma': dict(prof=[1, .9, 1.1, 1.2, 1.15, .85], rar='rare', evo=[], taste='compound', cat=['Penguin Billionaire'], ht=[1.4], wt=[60],
   hab=['A nest with a stake in every other nest'], diet=['A little of everything'], bio=['A penguin-pony with a ruff of white and a pebble of gold. It owns a bit of every other billionaire and sends them all a message at once.'], note=['Has a stake in your stake.']),
 'dell': dict(prof=[.95, 1, 1, 1.15, 1.05, 1.1], rar='common', evo=[], taste='bulk', cat=['Direct Billionaire'], ht=[1.6], wt=[120],
   hab=['Dorm rooms, then warehouses'], diet=['Spare parts'], bio=['A deer whose steel antlers are server racks. It ships itself direct and skips the shop entirely.'], note=['Built to order since the dorm.']),
 'ballmer': dict(prof=[1.2, 1.3, 1, .9, .9, .95], rar='uncommon', evo=[], taste='hottake', cat=['Developer Billionaire'], ht=[2.2], wt=[400],
   hab=['Courtside, standing'], diet=['Developers, developers, developers'], bio=['A gorilla with a red glow in its eyes that bounces courtside and shouts one word, many times. The word is developers.'], note=['Sweats through a shirt a minute.']),
 'federer': dict(prof=[.9, 1.1, .95, 1.05, 1, 1.3], rar='rare', evo=[], taste='escvel', cat=['Backhand Billionaire'], ht=[1.5], wt=[30],
   hab=['Grass courts'], diet=['Strawberries and cream'], bio=['A swan with a stripe of orange over its eyes and a one-handed backhand off one wing that nobody has returned.'], note=['Twenty majors, no sweat.']),
 'ronaldo': dict(prof=[.9, 1.25, .9, 1, .9, 1.3], rar='rare', evo=[], taste='launch', cat=['Siu Billionaire'], ht=[1.6], wt=[30],
   hab=['The penalty spot'], diet=['Chicken, plain, no sauce'], bio=['A peacock that jumps, turns in the air, lands with its tail fanned and shouts. It has done this nine hundred times and will do it again.'], note=['Does not drink the fizzy stuff. Moves it off the table.']),
 'forrest': dict(prof=[1, .9, 1.3, 1.05, 1.2, .75], rar='uncommon', evo=[], taste='harvest', cat=['Hydrogen Billionaire'], ht=[1.8], wt=[200],
   hab=['Iron ore country'], diet=['Ore now, hydrogen later'], bio=['A stick insect made of iron ore with green leaves for wings. It promises green hydrogen by a date that keeps moving.'], note=['Half mine, half promise.']),
 'scott': dict(prof=[1, .85, 1, 1.25, 1.2, 1], rar='rare', evo=[], taste='giveaway', cat=['Giving Billionaire'], ht=[1.7], wt=[40],
   hab=['Above charities, briefly'], diet=['Fish; gives the rest away'], bio=['A pelican with a golden pouch that quietly drops gold on charities and flies off before the photo.'], note=['No press release. Ever.']),
 'hershey': dict(prof=[1.25, 1.05, 1.15, .9, 1.05, .7], rar='uncommon', evo=[], taste='oldmoney', cat=['Cocoa Billionaire'], ht=[2.4], wt=[700],
   hab=['A town it built, with a school'], diet=['Cocoa and milk'], bio=['A chocolate-brown moose whose antlers are pale kisses. It built a whole town for its workers and a school for their children.'], note=['The town still smells of chocolate.']),
 'vanderbilt': dict(prof=[1, 1.15, 1.1, 1, .95, 1.1], rar='rare', evo=[], taste='margincall', cat=['Railroad Billionaire'], ht=[6], wt=[900],
   hab=['Every rail there is'], diet=['Coal'], bio=['A steam-train of a snake with a glowing furnace down its length and a plume of smoke it never lets go of. It owns every rail it rides and most it does not.'], note=['Built a university with the spare change.']),
 'rockefeller': dict(prof=[1.3, 1.25, 1.25, 1.2, 1.1, .7], rar='mythical', evo=[], taste='gusher', cat=['Derrick Billionaire'], ht=[8], wt=[40000],
   hab=['Under the volcano, where the black gold is'], diet=['Crude, by the barrel'], bio=['A titan of stone and iron with a golden ring round one eye and black gold leaking from every joint. The ground it stands on is already its own; the ground you stand on is next.'], note=['Every Fire move it makes leaves a slick behind.']),
 'mansa': dict(prof=[1.2, 1.2, 1.1, 1.3, 1.2, 1], rar='mythical', evo=[], taste='joyride', cat=['Caravan Billionaire'], ht=[6], wt=[9000],
   hab=['The summit, on a cushion of gold'], diet=['Gold, which it gives away'], bio=['A golden camel-dragon with a caravan\'s worth of gold in its hump and wings. It drops so much of it wherever it walks that prices fall for a decade.'], note=['The richest thing that ever lived, and the most generous.']),
}
# a signature move per final stage: id, name, type, power (0 = a trick), accuracy, flavour, and any effect the engine already knows
SIGNATURE = {
 'huang': ('cudacall', 'CUDA Call', 'Electric', 90, 100, 'Every fan on its back roars at once.', {'sharp': 1}), 'ellison': ('yachtrace', 'Yacht Race', 'Water', 85, 100, 'Wins the regatta by changing the course mid-race.', {}),
 'ma': ('opensesame', 'Open Sesame', 'Fire', 80, 100, 'Forty doors open at once and the bazaar pours out.', {}), 'walton': ('rollback', 'Rollback', 'Steel', 75, 100, 'Rolls the price, and the foe, back.', {}),
 'bloomberg': ('terminalfee', 'Terminal Fee', 'Electric', 0, 100, 'Charges rent for reading the numbers: the foe loses a little HP each turn.', {'burn': 1}), 'jobs': ('onemorething', 'One More Thing', 'Psychic', 95, 100, 'Just when it seemed over.', {}),
 'knight': ('justdoit', 'Just Do It', 'Flying', 80, 100, 'Does it before anyone asked.', {}), 'kroc': ('billionsserved', 'Billions Served', 'Fire', 85, 100, 'The same everywhere, on purpose.', {}),
 'ambani': ('towerdrop', 'Tower Drop', 'Ground', 100, 85, 'Sets twenty-seven storeys down on the foe.', {}), 'ortega': ('fastfashion', 'Fast Fashion', 'Grass', 70, 100, 'A new look every two weeks; the old one is thrown at the foe.', {}),
 'hughes': ('sprucedive', 'Spruce Dive', 'Flying', 95, 90, 'Flies once, and it counts.', {}), 'carnegie': ('libraryslam', 'Library Slam', 'Steel', 95, 95, 'A library, dropped on a town, for its own good.', {}),
 'lauren': ('popthecollar', 'Pop the Collar', 'Psychic', 0, 100, 'So well dressed the foe forgets to attack: sharply lowers its Attack.', {'stat': {'lev': -2}}), 'ford': ('assemblyline', 'Assembly Line', 'Steel', 85, 100, 'Hits in a row of identical parts.', {}),
 'slim': ('perminute', 'Per Minute', 'Electric', 0, 100, 'Charges by the minute: the foe loses HP every turn.', {'burn': 1}), 'cuban': ('imout', "I'm Out", 'Water', 85, 100, 'Says it is out, waits a beat, and invests the hit anyway.', {}),
 'pagebrin': ('feelinglucky', "Feeling Lucky", 'Psychic', 90, 95, 'Finds the one weak spot in a quarter of a second.', {}), 'thiel': ('zerotoone', 'Zero to One', 'Psychic', 100, 90, 'Builds something from nothing and keeps the one.', {}),
 'dorsey': ('charlimit', 'Character Limit', 'Flying', 70, 100, 'Says it in a hundred and forty.', {}), 'ek': ('shuffleplay', 'Shuffle Play', 'Electric', 80, 100, 'The next song before the last is done.', {}),
 'son': ('visionfund', 'Vision Fund', 'Psychic', 110, 80, 'Bets everything on this one hit.', {}), 'buterin': ('smartcontract', 'Smart Contract', 'Electric', 85, 100, 'Executes exactly as written, no appeal.', {}),
 'saylor': ('buythedip', 'Buy the Dip', 'Steel', 0, 100, 'Buys low: restores half its HP.', {'heal': .5}), 'winklevoss': ('insync', 'In Sync', 'Water', 80, 100, 'Both heads row the same stroke.', {}),
 'jayz': ('empirestate', 'Empire State', 'Flying', 90, 100, 'A city-sized hook.', {}), 'woods': ('sundayred', 'Sunday Red', 'Grass', 95, 95, 'Sinks it on the last hole.', {}),
 'lebron': ('thedecision', 'The Decision', 'Fire', 100, 90, 'Takes its talents to the foe\'s face.', {}), 'spielberg': ('cutto', 'Cut To', 'Psychic', 85, 100, 'The scene changes and the foe is already hit.', {}),
 'dyson': ('cyclone', 'Cyclone', 'Electric', 90, 100, 'Never loses suction.', {}), 'kamprad': ('flatpack', 'Flatpack', 'Steel', 75, 100, 'Assembled on the foe with one screw to spare.', {}),
 'mateschitz': ('giveswings', 'Gives Wings', 'Flying', 0, 100, 'Sharply raises Speed and a little Attack.', {'stat': {'hus': 2, 'lev': 1}}), 'rinehart': ('statesizedpit', 'State-sized Pit', 'Ground', 95, 95, 'Digs the ground out from under the foe.', {}),
 'dangote': ('concretepour', 'Concrete Pour', 'Ground', 100, 90, 'Sets hard before the foe can move.', {}), 'yanai': ('perfectfold', 'Perfect Fold', 'Steel', 0, 100, 'Folds the foe neatly: sharply lowers its Speed.', {'stat': {'hus': -2}}),
 'kashing': ('harbourfee', 'Harbour Fee', 'Steel', 85, 100, 'Charges for the water the foe stands in.', {}), 'mittal': ('blastfurnace', 'Blast Furnace', 'Fire', 110, 85, 'Lights the cold mill again.', {}),
 'dalio': ('principle', 'Principle No. 212', 'Psychic', 0, 100, 'Hedges every bet: raises Defense and Sp. Def.', {'stat': {'law': 1, 'pr': 1}}), 'griffin': ('frontrun', 'Front Run', 'Flying', 90, 100, 'Gets there before the foe\'s move.', {}),
 'schultz': ('wrongname', 'Wrong Name', 'Water', 75, 100, 'Calls the foe something that is almost its name.', {}), 'chesky': ('cleaningfee', 'Cleaning Fee', 'Water', 70, 100, 'Added at checkout.', {}),
 'hastings': ('autoplay', 'Autoplay', 'Psychic', 80, 100, 'The next one starts before you can stop it.', {}), 'altman': ('hallucinate', 'Hallucinate', 'Psychic', 100, 80, 'Confidently wrong, and it still hurts.', {}),
 'newell': ('countstotwo', 'Counts to Two', 'Water', 90, 100, 'Hits twice. Never a third time.', {}), 'yiming': ('fifteensec', 'Fifteen Seconds', 'Electric', 85, 100, 'Over before you know it, then again.', {}),
 'ponyma': ('stakeineverything', 'Stake in Everything', 'Water', 85, 100, 'Owns a bit of the foe already.', {}), 'dell': ('shipdirect', 'Ship Direct', 'Electric', 85, 100, 'Skips the shop and arrives.', {}),
 'ballmer': ('developers', 'Developers!', 'Fire', 100, 90, 'Shouted three times.', {}), 'federer': ('onehandedbackhand', 'One-handed Backhand', 'Flying', 95, 100, 'Nobody has returned it.', {}),
 'ronaldo': ('siu', 'Siu!', 'Fire', 100, 90, 'Jump, turn, land, shout.', {}), 'forrest': ('greenhydrogen', 'Green Hydrogen', 'Grass', 90, 95, 'Promised, then delivered, hard.', {}),
 'scott': ('quietgift', 'Quiet Gift', 'Water', 0, 100, 'Gives half its HP to the party: heals the active ally... or itself when alone.', {'heal': .5}), 'hershey': ('kisses', 'Kisses', 'Ground', 85, 100, 'Antlers first.', {}),
 'vanderbilt': ('fullsteam', 'Full Steam', 'Electric', 100, 90, 'Every rail it owns, at once.', {}), 'rockefeller': ('standardoil', 'Standard Oil', 'Fire', 120, 90, 'Black gold from every joint; the foe is slowed by the slick.', {'stat': {'hus': -1}}),
 'mansa': ('goldencaravan', 'Golden Caravan', 'Dragon', 120, 90, 'Drops a caravan of gold on the foe; prices fall for a decade.', {}),
}
ORDER = ['rockefeller', 'mansa', 'huang', 'ellison', 'ma', 'walton', 'bloomberg', 'jobs', 'knight', 'kroc', 'ambani', 'ortega', 'hughes', 'carnegie', 'lauren', 'ford', 'slim', 'cuban', 'pagebrin', 'thiel', 'dorsey', 'ek', 'son', 'buterin', 'saylor', 'winklevoss', 'jayz', 'woods', 'lebron', 'spielberg', 'dyson', 'kamprad', 'mateschitz', 'rinehart', 'dangote', 'yanai', 'kashing', 'mittal', 'dalio', 'griffin', 'schultz', 'chesky', 'hastings', 'altman', 'newell', 'yiming', 'ponyma', 'dell', 'ballmer', 'federer', 'ronaldo', 'forrest', 'scott', 'hershey', 'vanderbilt']
# which pools the first stage of each line walks in (the Guide shows a pool as all-new or all-old, never a mix)
POOLS = {
 'grass': {'lv': [3, 5], 'list': [['walton0', 40], ['ek0', 40], ['dorsey0', 35], ['knight0', 20], ['bloomberg0', 15], ['huang0', 12]]},
 'golf': {'lv': [5, 8], 'list': [['knight0', 40], ['lauren0', 35], ['dorsey0', 30], ['walton0', 25], ['ortega0', 20], ['jobs0', 8]]},
 'shell': {'lv': [7, 10], 'list': [['ortega0', 40], ['carnegie0', 35], ['kroc0', 30], ['ma0', 25], ['bloomberg0', 15], ['thiel0', 6]]},
 'grotto': {'lv': [9, 12], 'list': [['huang0', 40], ['slim0', 35], ['carnegie0', 30], ['thiel0', 12], ['ma0', 20], ['buterin0', 6]]},
 'esc': {'lv': [11, 14], 'list': [['kroc0', 40], ['ford0', 35], ['ambani0', 25], ['carnegie0', 25], ['saylor0', 15]]},
 'clear': {'lv': [12, 15], 'list': [['ford0', 40], ['carnegie0', 35], ['slim0', 30], ['huang0', 20], ['saylor0', 15]]},
 'food': {'lv': [13, 16], 'list': [['kroc0', 45], ['ma0', 35], ['walton0', 30], ['ek0', 20], ['son0', 12]]},
 'mall': {'lv': [14, 17], 'list': [['ortega0', 45], ['walton0', 35], ['lauren0', 25], ['jobs0', 10], ['thiel0', 8]]},
 'pond': {'lv': [15, 18], 'list': [['ek0', 45], ['ellison0', 35], ['cuban0', 30], ['hughes0', 20], ['slim0', 12]]},
 'farm': {'lv': [16, 19], 'list': [['ford0', 40], ['saylor0', 35], ['lauren0', 30], ['bloomberg0', 20], ['walton0', 15]]},
 'ridge': {'lv': [18, 21], 'list': [['hughes0', 40], ['ambani0', 30], ['knight1', 20], ['carnegie1', 15], ['son0', 15]]},
 'city': {'lv': [20, 24], 'list': [['pagebrin0', 35], ['bloomberg1', 30], ['dorsey1', 25], ['ortega1', 20], ['son0', 15], ['buterin0', 8]]},
}

# v39: the last six regions, eggs and fishing with the new roster; the two legendary encounters; the trainers' teams
POOLS2 = {
 'sea': {'lv': [22, 26], 'list': [['cuban0', 35], ['winklevoss0', 30], ['yanai0', 30], ['ellison1', 20], ['chesky0', 12], ['schultz0', 10]]},
 'island': {'lv': [24, 28], 'list': [['kashing0', 35], ['ellison1', 25], ['jayz0', 25], ['scott0', 10], ['federer0', 8], ['ponyma0', 8]]},
 'volcano': {'lv': [26, 30], 'list': [['mateschitz0', 35], ['ma1', 30], ['kroc1', 25], ['mittal0', 10], ['ballmer0', 10], ['forrest0', 10]]},
 'pass': {'lv': [28, 32], 'list': [['rinehart0', 35], ['dangote0', 30], ['dell0', 25], ['hershey0', 15], ['dalio0', 12], ['hastings0', 8]]},
 'summit': {'lv': [30, 34], 'list': [['dyson0', 30], ['kamprad0', 30], ['altman0', 15], ['griffin0', 8], ['yiming0', 15], ['vanderbilt0', 8]]},
 'lake': {'lv': [30, 34], 'list': [['spielberg0', 35], ['woods0', 25], ['lebron0', 15], ['newell0', 12], ['schultz0', 12], ['ronaldo0', 6]]},
}
EGGS = {
 '2': {'need': 2667, 'lv': 5, 'list': [['walton0', 20], ['ek0', 20], ['dorsey0', 20], ['knight0', 15], ['kroc0', 15], ['ortega0', 15], ['ma0', 15], ['carnegie0', 15], ['ford0', 15], ['yanai0', 10]]},
 '5': {'need': 6667, 'lv': 8, 'list': [['huang0', 20], ['bloomberg0', 20], ['ellison0', 15], ['hughes0', 15], ['slim0', 20], ['lauren0', 15], ['ambani0', 15], ['cuban0', 15], ['kamprad0', 15], ['woods0', 10]]},
 '10': {'need': 13334, 'lv': 12, 'list': [['jobs0', 25], ['thiel0', 20], ['buterin0', 20], ['lebron0', 15], ['son0', 15], ['griffin0', 8], ['altman0', 8], ['ponyma0', 8]]},
}
FISHING = {
 'pond': {'lv': [0, 2], 'list': [['ek0', 40], ['cuban0', 30], ['winklevoss0', 20], ['ellison0', 15], ['yanai0', 10], ['ek1', 4]]},
 'stream': {'lv': [0, 2], 'list': [['ek0', 40], ['winklevoss0', 30], ['ellison0', 20], ['cuban0', 10], ['winklevoss1', 4]]},
 'lake': {'lv': [1, 3], 'list': [['cuban0', 30], ['winklevoss0', 25], ['spielberg0', 20], ['schultz0', 15], ['cuban1', 8], ['newell0', 6], ['spielberg1', 2]]},
 'sea': {'lv': [1, 3], 'list': [['yanai0', 30], ['ellison0', 25], ['cuban0', 20], ['chesky0', 20], ['yanai1', 8], ['ellison1', 6], ['scott0', 3]]},
 'canal': {'lv': [0, 2], 'list': [['ek0', 40], ['chesky0', 30], ['yanai0', 15], ['ek1', 6]]},
 'swamp': {'lv': [0, 2], 'list': [['ek0', 40], ['ma0', 30], ['kroc0', 20], ['ek1', 5]]},
 'spring': {'lv': [1, 3], 'list': [['winklevoss0', 40], ['ek0', 25], ['winklevoss1', 10], ['federer0', 5]]},
 'ice': {'lv': [1, 3], 'list': [['ponyma0', 35], ['winklevoss0', 30], ['newell0', 10], ['ponyma0', 6]]},
}
LEGENDS = [
 {'sp': 'rockefeller0', 'scene': 'volcano', 'lvl': 42, 'title': 'The ground is leaking', 'text': 'Black gold wells up between the stones. Something enormous is standing in it, and it has noticed you.', 'line': '“Everything under this mountain is mine. You are standing on it.”'},
 {'sp': 'mansa0', 'scene': 'summit', 'lvl': 45, 'title': 'Gold on the wind', 'text': 'Coins drift down from the summit like leaves. A golden shape with wings lands in front of you and waits, as if it has all the time in the world.', 'line': '“Take some. There is always more. Now show me what you have.”'},
]
TRAINER_TEAMS = {
 'chad': [{'sp': '@rival', 'lvl': 7}, {'sp': 'saylor0', 'lvl': 6}], 'crude': [{'sp': 'ford0', 'lvl': 11}, {'sp': 'carnegie0', 'lvl': 12}, {'sp': 'ford1', 'lvl': 14}],
 'markdown': [{'sp': 'walton1', 'lvl': 19}, {'sp': 'ortega1', 'lvl': 19}, {'sp': 'kamprad0', 'lvl': 20}, {'sp': 'yanai1', 'lvl': 21}], 'chad2': [{'sp': '@rival1', 'lvl': 17}, {'sp': 'saylor1', 'lvl': 15}, {'sp': 'thiel0', 'lvl': 14}],
 'broker': [{'sp': 'bloomberg0', 'lvl': 14}, {'sp': 'cuban0', 'lvl': 15}, {'sp': 'dalio0', 'lvl': 16}], 'intern': [{'sp': 'dorsey0', 'lvl': 13}, {'sp': 'huang0', 'lvl': 14}],
 'alta': [{'sp': 'knight1', 'lvl': 25}, {'sp': 'woods0', 'lvl': 25}, {'sp': 'lauren1', 'lvl': 26}, {'sp': 'mateschitz1', 'lvl': 26}], 'marina': [{'sp': 'ellison1', 'lvl': 26}, {'sp': 'winklevoss1', 'lvl': 27}, {'sp': 'cuban1', 'lvl': 27}, {'sp': 'kashing1', 'lvl': 28}],
 'hiker': [{'sp': 'rinehart1', 'lvl': 19}, {'sp': 'hershey0', 'lvl': 20}], 'diver': [{'sp': 'yanai1', 'lvl': 20}, {'sp': 'chesky0', 'lvl': 21}],
 'geo': [{'sp': 'carnegie1', 'lvl': 24}, {'sp': 'dangote1', 'lvl': 24}, {'sp': 'mittal0', 'lvl': 25}], 'skipper': [{'sp': 'ellison1', 'lvl': 18}, {'sp': 'spielberg1', 'lvl': 19}],
}

def learn_for(line, types, taste, moves):
    by = {}
    for mid, m in moves.items():
        if m.get('sig') and m['sig'] != line: continue   # another line's signature move
        by.setdefault(m.get('t') or m.get('type') or 'None', []).append((mid, m.get('p') or 0))
    dmg, stat = [], []
    for t in dict.fromkeys(sum(types, [])):
        for m, p in sorted(by.get(t, []), key=lambda x: x[1]): (dmg if p else stat).append(m)
    seen = set(); dmg = [m for m in dmg if not (m in seen or seen.add(m))]; stat = [m for m in stat if not (m in seen or seen.add(m))]
    own = dmg[:2] + stat[:1] + dmg[2:4] + stat[1:2] + dmg[4:]   # a hit first, a trick third, the big hits last
    plan = [[1, 'handshake']]; lv = 1
    for k, m in enumerate(own[:8]):
        p = moves[m].get('p') or 0; plan.append([max(lv, 34 if p >= 95 else 0, 40 if p >= 130 else 0), m]); lv += 4 if k < 2 else 6   # the big hits come late
    if taste and taste in moves and taste not in own: plan.append([min(44, lv), taste])
    for m in ('subpoena', 'lawsuit'):
        if m not in [x[1] for x in plan]: plan.append([min(40, lv + 3), m]); lv += 3
    plan.sort(key=lambda x: x[0]); return plan

def main():
    force = '--force' in sys.argv
    head, GD, tail = load(); roster = {e['line']: [] for e in GD['roster']}
    for e in GD['roster']: roster[e['line']].append(e)
    existing = {l['id']: l for l in GD['lines']}; added = []; new_lines = []
    for lid in ORDER:
        if lid in existing and not force:
            if '--relearn' in sys.argv: existing[lid]['learn'] = learn_for(lid, existing[lid]['types'], LINES[lid].get('taste'), GD['moves'])
            new_lines.append(existing[lid]); continue
        R = sorted(roster[lid], key=lambda e: e['stage']); D = LINES[lid]
        L = {'id': lid, 'names': [e['name'] for e in R], 'types': [e['types'] for e in R], 'prof': D['prof'], 'rar': D['rar'],
             'learn': learn_for(lid, [e['types'] for e in R], D.get('taste'), GD['moves']), 'cat': D['cat'], 'ht': D['ht'], 'wt': D['wt'], 'hab': D['hab'], 'diet': D['diet'], 'bio': D['bio'], 'note': D['note'],
             'evo': [{'k': 'lvl', 'at': a} for a in D['evo']], 'parody': R[0]['parody']}
        if not D['evo']: del L['evo']
        new_lines.append(L); added.append(lid)
    STARTERS = ['musk', 'bezos', 'gates']
    others = [l for l in GD['lines'] if l['id'] not in ORDER and l['id'] not in STARTERS]
    starters = [l for l in GD['lines'] if l['id'] in STARTERS]
    if '--retire' in sys.argv:
        # v39: the old roster leaves the game; every old species maps to a new one (its pool slot where one was set in
        # v38, else the same stage of the first new line sharing its first type, the old starters to the new starters)
        mig = GD['rules'].setdefault('migrate', {'species': {}})['species']
        first_type = {}
        for L in new_lines: first_type.setdefault(L['types'][0][0], L)
        new_ids = {f"{l['id']}{st}" for l in new_lines + starters for st in range(len(l['names']))}
        for L in others:
            for st in range(len(L['names'])):
                oid = f"{L['id']}{st}"
                if oid in mig and mig[oid] in new_ids and L['id'] not in ('hood', 'gush', 'scoop', 'myth'): continue
                tgt = None
                if L['id'] == 'hood': tgt = 'musk'
                elif L['id'] == 'gush': tgt = 'bezos'
                elif L['id'] == 'scoop': tgt = 'gates'
                elif L['id'] == 'myth': tgt = 'mansa'
                else:
                    t = (L['types'][min(st, len(L['types']) - 1)] or ['Fire'])[0]; tgt = (first_type.get(t) or new_lines[2])['id']
                n_new = len(next(l for l in new_lines + starters if l['id'] == tgt)['names'])
                mig[oid] = f"{tgt}{min(st, n_new - 1)}"
        retired = [l['id'] for l in others]; others = []
        print(f"retired {len(retired)} old lines: {', '.join(retired)}; migration map now {len(mig)} species")
    GD['lines'] = starters + new_lines + others
    # v39: signature moves, one per line, learned by the final stage after its last evolution
    for lid, (mid, name, typ, pw, acc, d, fx) in SIGNATURE.items():
        L = next((l for l in GD['lines'] if l['id'] == lid), None)
        if not L: continue
        if mid not in GD['moves'] or force:
            hv = L['prof'][1] >= L['prof'][3]; m = {'n': name, 't': typ, 'c': ('H' if hv else 'S') if pw else 'X', 'a': acc, 'd': d, 'sig': lid}
            if pw: m['p'] = pw
            f = {}
            if 'burn' in fx: f['status'] = 'scn'
            if 'heal' in fx: f['heal'] = fx['heal']
            if 'stat' in fx:
                st = fx['stat']; up = {k: v for k, v in st.items() if v > 0}; dn = {k: v for k, v in st.items() if v < 0}
                if up: f['selfStage'] = up
                if dn: f['tgtStage'] = dn
            if f: m['fx'] = f
            GD['moves'][mid] = m
        if not any(mv == mid for _, mv in L['learn']):
            at = (L['evo'][-1]['at'] + 4) if L.get('evo') else (50 if L['rar'] == 'mythical' else 30)
            L['learn'].append([at, mid]); L['learn'].sort(key=lambda x: x[0])
    # pools: the regions these lines fill
    for k, v in POOLS.items(): GD['pools'][k] = v
    for k, v in POOLS2.items(): GD['pools'][k] = v
    GD['eggs'] = EGGS; GD['fishing'] = FISHING; GD['rules']['eggs']['mythSpecies'] = 'mansa0'
    GD['rules']['legends'] = LEGENDS
    for who, team in TRAINER_TEAMS.items():
        if who in GD['trainers']: GD['trainers'][who]['team'] = team
    # roster state: a sheet and a rig exist
    rn = (NEXT / 'rigs-next.js').read_text(); rigs = json.loads(rn[rn.index('window.RIGS_NEXT=') + 17:rn.rindex(';')])
    for e in GD['roster']:
        rid = f"{e['line']}{e['stage'] - 1}"; f = NEXT / 'billionaires' / f"{e['id']}.png"
        e['state'] = {'silhouette': f.exists(), 'sheet': f.exists(), 'rig': rid in rigs, 'portrait': f.exists()}
    DATA.write_text(head + json.dumps(GD, ensure_ascii=False, indent=1) + tail)
    print(f"lines added: {', '.join(added) or 'none'}; {len(POOLS)} pools filled; roster states updated")

if __name__ == '__main__':
    main()
