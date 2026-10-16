#!/usr/bin/env python3
"""v47: the story data around the new opening, written into game/data/gamedata.js.

  trainers.blake0   Blake's first battle, outside Hazel's lab right after you choose your starter. A "tutorial"
                    trainer: it stands on no stop, costs nothing to lose, and his billionaire only knows Tackle.
  trainers.chad     his scene on the golf course now remembers the lab. The old lines are kept as "intro0", for a
                    game begun before v47 (no lab battle).
  lore.story        Route 1: your things scattered along the Long Grass when you fell.
  rooms             six books and papers to read (lore.books), on furniture already there.
  lore.clues        where the lanyard and the voice message lie (a scene, and what they lie beside).

Only writes what is missing; --force writes it all again.

    python3 tools/build-story-v47.py [--force]
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'data' / 'gamedata.js'

BLAKE0 = {
    'name': 'Blake', 'who': 'chad', 'area': 'grass', 'node': 0, 'blocks': False, 'tutorial': True,
    'team': [{'sp': '@rival', 'lvl': 4, 'moves': ['handshake']}],
    'reward': 0, 'market': None,
    'lines': ['“Mine beats yours. Watch.”'],
    'win': '“What? It only knows Tackle! That’s my excuse and I’m sticking to it.”',
    'lose': '“Ha! Told you. Mine beats yours.”',
    'hint': '', 'seat': None,
}

CHAD_INTRO = [
    '[angry] Hey! Surface stray! Wait up!',
    '[happy] I’ve been training out here all morning. Mine knows a lot more than Tackle now.',
    'What happened outside the lab doesn’t count. This one counts.',
    '[angry] Nobody plays through this course until we settle it. Let’s go!',
]

# books and papers in rooms: an existing piece of furniture gets act "read" and the book's id (lore.books)
BOOK_SPOTS = [('int_lab', 'bookshelf', 1.6, 9, 'fieldguide'), ('int_library', 'reading_desk', 7, 6.4, 'charter'),
              ('int_library', 'bookshelf', 1.6, 9, 'steps'), ('int_mansion', 'bookshelf', 13.2, 10, 'brochure'),
              ('int_station', 'timetable_board', 3.4, 9.45, 'programme'), ('int_clinic', 'table_round', 11, 5.6, 'amnesia')]

# where the clues to who you were lie: a scene, and a prop to lie beside (the first one matching, nearest the middle)
CLUE_AT = {'lanyard': {'scene': 'longgrass', 'near': 'bramble|bush_berry'}, 'voicemail': {'scene': 'mall', 'near': 'fountain'}}
LANYARD = ('Found snagged on the brambles in the Long Grass, where the things that fell with you came down: ALL ACCESS — '
           'THE FOREVER TOUR — CREW. The name on it has worn away. The photo is yours.')

ROAD1 = ('Hazel asked you to walk: every step counts, and the road teaches more than any book. When someone falls in, '
         'their things come down too, and they scatter along the Long Grass. Something of yours might still be out there.')


def main():
    force = '--force' in sys.argv
    src = DATA.read_text(encoding='utf-8'); k0 = src.index('window.GAMEDATA='); head = src[:k0]
    D = json.JSONDecoder().raw_decode(src[k0 + len('window.GAMEDATA='):])[0]
    did = []
    TR = D.setdefault('trainers', {})
    if force or 'blake0' not in TR:
        TR['blake0'] = BLAKE0; did.append('trainers.blake0')
    C = TR.get('chad')
    if C and (force or 'intro0' not in C):
        if 'intro0' not in C: C['intro0'] = C.get('intro') or []
        C['intro'] = CHAD_INTRO; did.append('trainers.chad.intro')
    for st in (D.get('lore') or {}).get('story') or []:
        if st.get('id') == 'road1' and (force or 'scatter' not in st.get('text', '')):
            st['text'] = ROAD1; did.append('lore.story.road1')
    SC = D.get('scenes') or {}
    for sid, k, x, z, book in BOOK_SPOTS:
        for pr in (SC.get(sid) or {}).get('props') or []:
            if pr.get('k') == k and abs(pr.get('x', 0) - x) < .01 and abs(pr.get('z', 0) - z) < .01 and (force or not pr.get('act')):
                pr['act'] = 'read'; pr['book'] = book; did.append(f'{sid}: {book}'); break
    for c in (D.get('lore') or {}).get('clues') or []:
        if c.get('id') in CLUE_AT and (force or 'at' not in c):
            c['at'] = CLUE_AT[c['id']]; did.append('clue at: ' + c['id'])
        if c.get('id') == 'lanyard' and (force or 'sinkhole you fell' in c.get('text', '')):
            c['text'] = LANYARD; did.append('clue text: lanyard')
    DATA.write_text(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
    print('story: ' + (', '.join(did) or 'all there (use --force to write it again)'))


if __name__ == '__main__':
    main()
