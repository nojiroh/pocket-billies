# ============================================================================= v28: A LADDER UP THE CLIFFS
# Loaded by build-scene-props.py (exec) after the v27 props. A wooden ladder leaning on a cliff face; the game scales
# it to the cliff's height and lets you climb it (tools/build-v28.py put them in the scenes; deleted 2026-10-27, the
# legacy tag has an older copy).

@vprop('ladder', 'Ladder', 0.2, 0, ['mountains', 'canyon'], solid=0)
def p_ladder(rng):
    W, H = 40, 112; G = H - 2; cx = 20
    cv = Cv(W, H); Rw = R['wood']
    for x0 in (cx - 14, cx + 10):
        for y in range(2, G + 1):
            for x in range(x0, x0 + 4): cv.px(x, y, Rw[xt(x, x0, x0 + 4)])
    for y in range(10, G - 2, 12):
        for x in range(cx - 10, cx + 10): cv.px(x, y, R['plank'][4]); cv.px(x, y + 1, R['plank'][2]); cv.px(x, y + 2, Rw[1])
    # rope lashings where the rungs meet the rails
    for y in range(10, G - 2, 12):
        for x0 in (cx - 11, cx + 9): cv.px(x0, y + 1, R['hay'][3]); cv.px(x0 + 1, y + 1, R['hay'][2])
    cv.outline()
    return cv, cx
