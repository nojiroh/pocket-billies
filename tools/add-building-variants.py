#!/usr/bin/env python3
"""HB-5: colour variants for the cottages and the coloured houses (scenery.json `variants`), so a placement's `v`
(1 is the first; 0 or none is the model as it is) gives another house: other walls, door, shutters or roof.

A variant is a colour swap of the model (walk-view.js plainPropVariant, prop-models.js swappedRecipe): every layer of
an old colour takes the new one, so only colours the walls, door or roof have alone are swapped. A placement's
`roof: moss|solar|chrome` still recolours the roof parts on top. Run it again after changing a list: it rewrites the
variants of these kinds only.

    python3 tools/add-building-variants.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gamedata  # noqa: E402

# the town's palette (the walls, roofs and doors the building models already use)
WALL = {'cream': '#F2DCA0', 'sage': '#D6E6C8', 'sky': '#C8DCEC', 'rose': '#F2C4B4', 'peach': '#F8D6B2',
        'lilac': '#E0D4EE', 'white': '#EAEEEC', 'butter': '#F6E6BE', 'navy': '#4E6E9E', 'fern': '#5E9A6E'}
ROOF = {'red': '#E86256', 'blue': '#608CEC', 'green': '#6CB262', 'lilac': '#B288E2'}
DOOR = {'teal': ('#4E957C', '#5EA88E'), 'red': ('#D65C4E', '#E86A5A'), 'blue': ('#4E6E9E', '#5E7EB0'),
        'mustard': ('#D9A040', '#E8B450'), 'brown': ('#8A5A34', '#A0683C')}


def door(old, new):
    return dict(zip(old, DOOR[new]))


# per kind: the model's own colours and its variants (walls, door, and roof or another part where the model has one)
VARIANTS = {
    'cottage_moss': [
        {'#F2DCA0': WALL['sky'], **door(DOOR['teal'], 'red')},
        {'#F2DCA0': WALL['rose'], **door(DOOR['teal'], 'blue')},
        {'#F2DCA0': WALL['sage'], **door(DOOR['teal'], 'mustard')},
    ],
    'cottage_solar': [
        {'#D6E6C8': WALL['cream'], **door(DOOR['red'], 'teal')},
        {'#D6E6C8': WALL['sky'], **door(DOOR['red'], 'mustard')},
        {'#D6E6C8': WALL['rose'], **door(DOOR['red'], 'blue')},
    ],
    'house_red': [
        {'#F8D6B2': WALL['white'], '#E86256': ROOF['blue'], **door(('#36968A', '#3EA89A'), 'red')},
        {'#F8D6B2': WALL['butter'], '#E86256': ROOF['green'], **door(('#36968A', '#3EA89A'), 'blue')},
    ],
    'house_blue': [
        {'#EAEEEC': WALL['rose'], '#608CEC': ROOF['red'], '#E04848': '#3EA89A'},
        {'#EAEEEC': WALL['sage'], '#608CEC': ROOF['lilac'], '#E04848': '#D9A040'},
    ],
    'house_green': [
        {'#E0D4EE': WALL['butter'], '#6CB262': ROOF['red'], '#4E9A58': '#4E6E9E'},
        {'#E0D4EE': WALL['sky'], '#6CB262': ROOF['lilac'], '#4E9A58': '#D65C4E'},
    ],
    'house_large': [
        {'#F8D6B2': WALL['lilac'], '#B288E2': ROOF['blue'], '#E8604E': '#4E6E9E', '#3EA89A': '#D9A040'},
        {'#F8D6B2': WALL['sage'], '#B288E2': ROOF['red'], '#E8604E': '#E8B450', '#3EA89A': '#E04848'},
    ],
    'townhouse_red': [
        {'#C46C54': WALL['navy'], '#3EA89A': '#E8B450'},
        {'#C46C54': WALL['fern'], '#3EA89A': '#E04848'},
    ],
    'townhouse_yellow': [
        {'#F6E6BE': WALL['rose'], '#6CB262': ROOF['blue'], '#3EA89A': '#E04848'},
        {'#F6E6BE': WALL['sky'], '#6CB262': ROOF['red'], '#3EA89A': '#D9A040'},
    ],
}


def main():
    D = gamedata.load()
    P = D['scenery']['props']
    for k, vs in VARIANTS.items():
        P[k]['variants'] = [{'swap': s} for s in vs]
        print(f'{k}: {len(vs)} variants')
    gamedata.save(D)


if __name__ == '__main__':
    main()
