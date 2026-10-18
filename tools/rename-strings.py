"""Phase 05: the JavaScript in the Python tools' strings (page.evaluate and the like) names the game's functions and
globals; tools/rename.mjs renames them there too, through this script, and in comments the names that can only be
code. Only strings and comments change, never Python code.

  python3 tools/rename-strings.py apply|dry    stdin {"pairs": {old: new}, "files": [...]} -> stdout {"changed", "review"}
  python3 tools/rename-strings.py verify BASE  stdin {"files": [[old path, new path], ...]}  -> stdout {"strings", "problems"}

In a string, a name is renamed where it stands as a name: not part of a longer name, and not a property of something
else (`x.name`), except window./self./globalThis. members. A plain lowercase word (`at`, `rnd`) is renamed only where
it is called or used as an object (`at(`, `at.x`, `at[`), a one-letter name where it is used as one (`S.team`,
`S[k]`, `S = `, `f(S)`); their other hits are listed for a person to check.
verify compares the syntax trees of each file at BASE and in the index (git add -A first) with every string left out:
they must be the same, and only strings may differ.
"""
import ast
import io
import json
import re
import subprocess
import sys
import tokenize
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BEFORE = r'(?:(?<![\w$.])|(?<=\bwindow\.)|(?<=\bself\.)|(?<=\bglobalThis\.))'


def pattern(old):
    """(where it is surely the name, every whole-word hit)"""
    if re.fullmatch(r'[a-z]+', old):
        after = r'(?=\(|\.[A-Za-z_$]|\[)'
    elif len(old) == 1:
        # S.team, S[k], S = ..., f(S), [S, B]
        after = r'(?=\.[A-Za-z_$]|\[|\s*=(?!=)|\)|,|;|\])'
    else:
        after = r'(?![\w$])'
    return re.compile(BEFORE + re.escape(old) + after), re.compile(BEFORE + re.escape(old) + r'(?![\w$])')


def code_only(n):
    """a capital, digit, _ or $ in it, and four characters or more (or three, mixed case), as in tools/rename.mjs"""
    return bool(re.search(r'[A-Z0-9_$]', n)) and (len(n) >= 4 or (len(n) == 3 and bool(re.search(r'[a-z]', n))))


def string_spans(src):
    """(start, end, comment?) of every string literal (of an f-string, its text outside the {expressions}) and comment"""
    lines = src.splitlines(keepends=True)
    starts = [0]
    for ln in lines:
        starts.append(starts[-1] + len(ln))
    off = lambda pos: starts[pos[0] - 1] + pos[1]
    spans = []
    for t in tokenize.generate_tokens(io.StringIO(src).readline):
        kind = tokenize.tok_name[t.type]
        if kind in ('STRING', 'FSTRING_MIDDLE', 'COMMENT'):
            spans.append((off(t.start), off(t.end), kind == 'COMMENT'))
    return spans


def line_of(src, at):
    return src.count('\n', 0, at) + 1


def rename(src, pairs, file):
    """the file with the names renamed in its strings, the lines changed, the hits left for a person"""
    compiled = {o: pattern(o) for o in pairs}
    edits, review = [], []
    for s, e, comment in string_spans(src):
        text = src[s:e]
        for o, (sure, loose) in compiled.items():
            if comment:
                # a comment only gets the names that can only be code (wrGate, DGL_SH), never a review line
                if code_only(o):
                    edits += [(s + m.start(), s + m.end(), pairs[o]) for m in loose.finditer(text)]
                continue
            hit = {m.start() for m in sure.finditer(text)}
            for m in loose.finditer(text):
                if m.start() in hit:
                    edits.append((s + m.start(), s + m.end(), pairs[o]))
                elif not re.fullmatch(r'[a-z]+', o):  # a plain word elsewhere is prose
                    ln = line_of(src, s + m.start())
                    review.append(f'{file}:{ln}: string holds {o}: {src.splitlines()[ln - 1].strip()[:160]}')
    changed = sorted({line_of(src, a) for a, _, _ in edits})
    for a, b, t in sorted(edits, reverse=True):
        src = src[:a] + t + src[b:]
    return src, changed, review


def without_strings(tree):
    """the syntax tree as text, every string constant left out (and the strings in order)"""
    strings = []
    for n in ast.walk(tree):
        if isinstance(n, ast.Constant) and isinstance(n.value, str):
            strings.append(n.value)
            n.value = ''
    return ast.dump(tree), strings


def main():
    cmd = sys.argv[1]
    data = json.load(sys.stdin)
    if cmd in ('apply', 'dry'):
        pairs = data['pairs']
        out = {'changed': [], 'review': []}
        for f in data['files']:
            p = ROOT / f
            src = p.read_text(encoding='utf-8')
            new, changed, review = rename(src, pairs, f)
            out['review'] += review
            if new != src:
                out['changed'].append(f'{f}: lines {", ".join(map(str, changed[:30]))}{" ..." if len(changed) > 30 else ""}')
                if cmd == 'apply':
                    p.write_text(new, encoding='utf-8')
        print(json.dumps(out))
    elif cmd == 'verify':
        base = sys.argv[2]
        out = {'strings': [], 'problems': []}
        for a, b in data['files']:
            old = subprocess.run(['git', 'show', f'{base}:{a}'], cwd=ROOT, capture_output=True, text=True, check=True).stdout
            now = subprocess.run(['git', 'show', f':{b}'], cwd=ROOT, capture_output=True, text=True, check=True).stdout
            (x, xs), (y, ys) = without_strings(ast.parse(old)), without_strings(ast.parse(now))
            if x != y:
                out['problems'].append(f'{b}: Python code changed, not only strings')
                continue
            for s, t in zip(xs, ys):
                if s != t:
                    out['strings'].append(f'{b}: {s[:90]!r} -> {t[:90]!r}')
        print(json.dumps(out))
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main()
