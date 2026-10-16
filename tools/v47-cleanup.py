#!/usr/bin/env python3
"""v47: the clean-up. Takes out old things nothing uses any more and nothing is planned for:

  - walk-scene catalogue entries never placed anywhere and replaced long ago (the v10 `flowers`, `bush`, `rock`
    and the `escal` picture the escalators replaced); their pictures stay, the battle stages still use them
  - the one-time migration tools that already ran (they move to tools/retired/, nothing is deleted)

Nothing of yours is deleted: tools and art that go are moved into a retired/ folder, outside the game.
Safe to run again (it only does what is still to do).

    python3 tools/v47-cleanup.py          # do it
    python3 tools/v47-cleanup.py --dry    # say what it would do
"""
import json, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'data' / 'gamedata.js'
META = ROOT / 'game' / 'art' / 'scene' / 'props.json'
PROPS = ['flowers', 'bush', 'rock', 'escal']
TOOLS = ['build-v25.py', 'build-v27.py', 'build-v31.py', 'build-v33.py', 'build-world-v17.py', 'build-world-v24.py', 'migrate-exits.py',
         'repaint-world-trails.py', 'backup']


def main():
    dry = '--dry' in sys.argv; did = []
    src = DATA.read_text(encoding='utf-8'); i = src.index('window.GAMEDATA='); head = src[:i]
    D = json.JSONDecoder().raw_decode(src[i + len('window.GAMEDATA='):])[0]
    placed = {p['k'] for sc in D['scenes'].values() for p in sc.get('props', [])}
    cat = D['scenery']['props']; meta = json.loads(META.read_text())
    for k in PROPS:
        if k in placed: print(f'  {k}: still placed somewhere, kept'); continue
        if k in cat: did.append(f'catalogue: {k}'); cat.pop(k) if not dry else None
        if k in meta: did.append(f'props.json: {k}'); meta.pop(k) if not dry else None
    out = ROOT / 'tools' / 'retired'
    for t in TOOLS:
        p = ROOT / 'tools' / t
        if p.exists():
            did.append(f'tools/{t} → tools/retired/')
            if not dry: out.mkdir(exist_ok=True); shutil.move(str(p), str(out / t))
    if not dry:
        DATA.write_text(head + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
        META.write_text('{\n' + ',\n'.join('  ' + json.dumps(k) + ': ' + json.dumps(v, separators=(', ', ': ')) for k, v in meta.items()) + '\n}\n')
    print(('would do: ' if dry else 'done: ') + ('; '.join(did) or 'nothing left to do'))


if __name__ == '__main__':
    main()
