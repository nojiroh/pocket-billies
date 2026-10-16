#!/usr/bin/env python3
"""Adds the version 9 icons (new item pictures and type particles) to game/art/icons/icons.png
and their rectangles to game/art/manifest.js. Safe to run again: existing keys are replaced in place."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'game' / 'art'
PAL = {'K': '#2A2238', 'W': '#F7F4EA', 'w': '#D9D4C6', 'R': '#DE4A4E', 'r': '#9C2A35', 'B': '#4F86E8', 'b': '#2C57B4',
       'G': '#5DB352', 'g': '#2F7A3A', 'Y': '#F2C14E', 'y': '#B9801C', 'O': '#EE8240', 'o': '#B4501E', 'P': '#E87AAE', 'p': '#B04878',
       'S': '#C8D0D8', 's': '#7E8C9C', 'N': '#8A5A34', 'n': '#C8925A', 'L': '#B8A8E8', 'l': '#7A64C4', 'C': '#8EE0E8', 'c': '#3FA0B4', 'T': '#A8D890'}
ICONS = {
 'i_potion': ["...KKK...", "...KSK...", "..KKKKK..", ".KRRRRRK.", "KRWRRRRRK", "KRWRRRRRK", "KRRRRRRRK", "KrRRRRRrK", ".KrrrrrK.", "..KKKKK.."],
 'i_hipotion': ["...KKK...", "...KSK...", "..KKKKK..", ".KBBBBBK.", "KBWBBBBBK", "KBWBBBBBK", "KBBBBBBBK", "KbBBBBBbK", ".KbbbbbK.", "..KKKKK.."],
 'i_salve': [".KKKKKKK.", "KOOOOOOOK", "KoooooooK", "KKKKKKKKK", "KWWWWWWWK", "KWWRRRWWK", "KWWRWRWWK", "KWwwwwwWK", ".KKKKKKK."],
 'i_tonic': ["...KKK...", "...KnK...", "...KKK...", "..KYYYK..", ".KYWYYYK.", ".KYWYKYK.", ".KYYKYYK.", ".KYKYYYK.", ".KyyyyyK.", "..KKKKK.."],
 'i_tea': [".........", "..W.W....", ".W.W.....", "KKKKKKK..", "KTTTTTKKK", "KTGGGTK.K", "KTGGGTKKK", ".KTTTK...", "KKKKKKKK.", ".KwwwwK.."],
 'i_revive': [".KK...KK.", "KPPK.KPPK", "KPWPKPPPK", "KPPPPPPpK", ".KPPPPpK.", "..KPPpK..", "...KpK...", "....K...."],
 'i_maxrevive': [".KK...KK.", "KYYK.KYYK", "KYWYKYYYK", "KYYYYYYyK", ".KYYYYyK.", "..KYYyK..", "...KyK...", "....K...."],
 'i_stone': ["....K....", "...KCK...", "..KCWCK..", ".KCWCCcK.", "KCCCCCccK", ".KcCCccK.", "..KcccK..", "...KcK...", "....K...."],
 'i_trailmix': ["..KKKKK..", ".KnnnnnK.", "..KKKKK..", ".KnnnnnK.", "KnYnRnnnK", "KnnnGnYnK", "KnRnnnnnK", "KnnnYnRnK", ".KKKKKKK."],
 'i_pretzel': [".KKK.KKK.", "KnnnKnnnK", "KnKnnnKnK", "KnnKnKnnK", ".KnnKnnK.", "KnnKnKnnK", "KnKKKKKnK", ".KK...KK."],
 'i_remedy': ["...KKK...", "...KSK...", "..KKKKK..", ".KGGGGGK.", "KGGWWWGGK", "KGWWWWWGK", "KGGWWWGGK", "KgGGGGGgK", ".KgggggK.", "..KKKKK.."],
 'leaf': ["....KK", "..KKGK", ".KGGTK", "KGTGGK", "KGGgK.", "KgKK..", "K....."],
 'pebble': [".KKK.", "KsSSK", "KsSsK", ".KKK."],
 'feather': ["....KK", "...KWK", "..KWwK", ".KWwK.", "KWwK..", "KKK...", "K....."],
 'cog': [".K.K.", "KKSKK", ".KsK.", "KKSKK", ".K.K."],
 'scale': ["..K..", ".KLK.", "KLLlK", ".KlK.", "..K.."],
}

def main():
    man_p = ART / 'manifest.js'
    src = man_p.read_text()
    pre, js = src.split('=', 1)
    js = js.strip().rstrip(';')
    M = json.loads(js)
    atlas = Image.open(ART / 'icons' / 'icons.png').convert('RGBA')
    keep = {k: v for k, v in M['icons'].items() if k not in ICONS}
    base_h = max(y + h for x, y, w, h in keep.values()) + 1
    width = atlas.width
    row_h = max(len(a) for a in ICONS.values()) + 1
    out = Image.new('RGBA', (width, base_h + row_h), (0, 0, 0, 0))
    out.paste(atlas.crop((0, 0, width, base_h)), (0, 0))
    x = 1
    for key, rows in ICONS.items():
        w = max(len(r) for r in rows); h = len(rows)
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != '.':
                    c = PAL[ch]
                    out.putpixel((x + i, base_h + j), tuple(int(c[k:k + 2], 16) for k in (1, 3, 5)) + (255,))
        keep[key] = [x, base_h, w, h]
        x += w + 1
    assert x < width, 'atlas row too narrow'
    out.save(ART / 'icons' / 'icons.png', optimize=True)
    M['icons'] = keep
    man_p.write_text(pre + '=' + json.dumps(M, separators=(',', ':')) + ';\n')
    print('icons:', len(ICONS), 'atlas', out.size)

if __name__ == '__main__':
    main()
