"""alpha 0.2: the one-character keys a ground kind may use, in the order new kinds take them (the Studio's SC_TER_KEYS
in studio/js/scenes.js): letters, digits and a few signs, then 190 accented letters (À to ſ, without × and ÷). A map
row is a string with one character per square, so a kind's key is all a place needs to name it.

    from groundkeys import KEYS, free      # free(D['scenery']['terrains'], 3) -> the next three unused keys"""
ASCII = 'qyzhjvuaeiQYZHJVUAEIbcdfgklmnoprstwxBCDFGKLMNOPRSTWX0123456789$()-./?@[]^{|}'
KEYS = ASCII + ''.join(chr(c) for c in range(0xC0, 0x180) if c not in (0xD7, 0xF7))


def free(terrains, n=1):
    """the next n keys no ground kind uses yet"""
    out = [k for k in KEYS if k not in terrains][:n]
    if len(out) < n: raise ValueError(f'only {len(out)} ground keys left')
    return out


if __name__ == '__main__':
    import json, sys
    from pathlib import Path
    src = (Path(__file__).resolve().parent.parent / 'game' / 'data' / 'gamedata.js').read_text(encoding='utf-8')
    D, _ = json.JSONDecoder().raw_decode(src, src.index('window.GAMEDATA=') + len('window.GAMEDATA='))
    T = D['scenery']['terrains']
    print(f'{len(T)} ground kinds use {len(T)} of {len(KEYS)} keys; next free: {"".join(free(T, 8))}')
