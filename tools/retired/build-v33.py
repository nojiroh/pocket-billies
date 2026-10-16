"""v33: a few trainers fight double battles, four wave and storm moves hit every foe, (two of theirs against two of yours), and the new rules get their defaults.
Only fills in what isn't there: a trainer you've already set (double on or off) or a rule you've changed stays as it is.
Usage: python3 tools/build-v33.py"""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'data' / 'gamedata.js'
DOUBLES = ['chad2', 'broker', 'geo', 'markdown']
SPREAD = ['headline', 'familyoffice', 'lobbygusher', 'launch']  # waves and storms hit every foe in a double battle
BATTLE = {'alphaHp': 3, 'alphaStats': 1.3, 'alphaLevels': 3, 'alphaActs': 2, 'alphaTeam': 3, 'alphaXp': 3, 'alphaKeep': 1.08, 'alphaSleepResist': .5, 'spreadMult': .75}


def main():
    src = DATA.read_text(encoding='utf-8'); head = src[:src.index('window.GAMEDATA=')]
    D = json.JSONDecoder().raw_decode(src[src.index('window.GAMEDATA=') + len('window.GAMEDATA='):])[0]
    done = []
    for k in DOUBLES:
        T = D['trainers'].get(k)
        if T and 'double' not in T and len(T.get('team', [])) >= 2: T['double'] = True; done.append(k)
    for k in SPREAD:
        M = D['moves'].get(k)
        if M is not None and 'spread' not in (M.get('fx') or {}): M.setdefault('fx', {})['spread'] = 1; done.append('move ' + k)
    R = D['rules']
    for k, v in BATTLE.items():
        if k not in R['battle']: R['battle'][k] = v; done.append('battle.' + k)
    if 'alphaOdds' not in R['steps']: R['steps']['alphaOdds'] = 45; done.append('steps.alphaOdds')
    if 'alpha' not in R['catching']: R['catching']['alpha'] = .4; done.append('catching.alpha')
    if done: DATA.write_text(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
    print('added:', ', '.join(done) or 'nothing (all there already)')


if __name__ == '__main__':
    main()
