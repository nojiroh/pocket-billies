#!/usr/bin/env python3
"""Packs the whole game into one self-contained HTML file (code, data, fonts and every art file inlined),
for hosts that only accept a single page, such as a claude.ai artifact.

    python3 tools/build-artifact.py [out.html]            # one file
    python3 tools/build-artifact.py out.html --split      # v47: the page, and the pictures in scripts of about 10 MB
                                                          # beside it (out-art1.js, ...), for hosts that cap each file

v47: the game data goes in compact (no indentation) and without the "@v45" backups of the places, which only the
Studio uses; the game folder itself is not changed.

The page runs with window.NW_ARTIFACT set: no service worker, no motion step counter (the demo step buttons
stand in), and saves are exported by copying. Everything else is the same game.

alpha 0.2: room to grow. The game data and the piece-sheet rigs go in packed (deflate, unpacked as the page loads by
tools/vendor/tiny-inflate.js, MIT, Devon Govett): 5 MB of data become under 1 MB. A picture the styles use more than
once goes in once (a CSS variable). Pictures go in as lossless WebP whenever that is smaller."""
import base64, json, mimetypes, re, sys, zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAME = ROOT / 'game'
MIME = {'.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json'}

def data_uri(p: Path):
    return f'data:{MIME.get(p.suffix, "application/octet-stream")};base64,' + base64.b64encode(p.read_bytes()).decode()

def art_uri(p: Path):
    """v30: pictures go in as lossless WebP when that's smaller (every pixel identical, about half the size);
    the game finds them by their original path either way"""
    if p.suffix != '.png': return data_uri(p)
    raw = p.read_bytes()
    try:
        import io
        from PIL import Image
        im = Image.open(io.BytesIO(raw)); o = io.BytesIO()
        im.save(o, 'WEBP', lossless=True, quality=100, method=4, exact=True); w = o.getvalue()
        if len(w) < len(raw): return 'data:image/webp;base64,' + base64.b64encode(w).decode()
    except Exception:
        pass
    return 'data:image/png;base64,' + base64.b64encode(raw).decode()

URL_RE = r"""url\((['"]?)([^'")]+)\1\)"""


def css_refs(paths):
    """alpha 0.2: how often each picture is named in the styles (outside @font-face): one named more than once goes
    in once, as a CSS variable"""
    n = {}
    for path in paths:
        css = re.sub(r'@font-face\s*{[^}]*}', '', path.read_text(encoding='utf-8'))
        for m in re.finditer(URL_RE, css):
            ref = m.group(2)
            if ref.startswith('data:') or ref.startswith('http'): continue
            f = (path.parent / ref).resolve()
            if f.exists() and f.suffix in ('.png', '.webp', '.jpg', '.svg'): n[f] = n.get(f, 0) + 1
    return {f: f'--nw-pic{i}' for i, f in enumerate(sorted(k for k, v in n.items() if v > 1))}


def inline_css(path: Path, shared=None):
    css = path.read_text(encoding='utf-8'); shared = shared or {}
    faces = [(m.start(), m.end()) for m in re.finditer(r'@font-face\s*{[^}]*}', css)]
    def rep(m):
        ref = m.group(2)
        if ref.startswith('data:') or ref.startswith('http'): return m.group(0)
        f = (path.parent / ref).resolve()
        if not f.exists(): return m.group(0)
        if f in shared and not any(a <= m.start() < b for a, b in faces): return f'var({shared[f]})'
        return f'url("{data_uri(f)}")'
    return re.sub(URL_RE, rep, css)


PACK = {'data/gamedata.js': 'GAMEDATA', 'art/next/rigs-next.js': 'RIGS_NEXT'}


def packed(src, code):
    """alpha 0.2: window.X={...} as deflate in base64, unpacked by nwUnpack (tiny-inflate) when the page loads"""
    var = PACK[src]; key = f'window.{var}='; i = code.index(key)
    obj, end = json.JSONDecoder().raw_decode(code, i + len(key))
    raw = json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    co = zlib.compressobj(9, zlib.DEFLATED, -15); z = co.compress(raw) + co.flush()
    return f'{key}nwUnpack("{base64.b64encode(z).decode()}",{len(raw)});'


def unpacker():
    lib = (ROOT / 'tools' / 'vendor' / 'tiny-inflate.js').read_text(encoding='utf-8')
    return ('<script>/* tiny-inflate (MIT License, Copyright (c) 2015-present Devon Govett) */\n(function(){var module={exports:{}};\n' + lib
            + '\nvar inflate=module.exports;window.nwUnpack=function(b,n){var s=atob(b),u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);'
              'return JSON.parse(new TextDecoder().decode(inflate(u,new Uint8Array(n))))}})();\n</script>\n')

def compact_data(code):
    """v47: the game data without its indentation and without the places' backups ("sundown@v45"...)"""
    i = code.index('window.GAMEDATA='); dec = json.JSONDecoder(); D, end = dec.raw_decode(code, i + len('window.GAMEDATA='))
    D['scenes'] = {k: v for k, v in D.get('scenes', {}).items() if '@' not in k}
    return code[:i] + 'window.GAMEDATA=' + json.dumps(D, ensure_ascii=False, separators=(',', ':')) + code[end:]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]; split = '--split' in sys.argv
    out = Path(args[0]) if args else ROOT / 'net-worth.html'
    html = (GAME / 'index.html').read_text(encoding='utf-8')
    title = re.search(r'<title>(.*?)</title>', html).group(1)
    hrefs = re.findall(r'<link rel="stylesheet" href="([^"]+)">', html); shared = css_refs([GAME / h for h in hrefs])
    root = ''.join(f'{v}:url("{data_uri(f)}");' for f, v in shared.items())
    css = (f'<style>:root{{{root}}}</style>\n' if shared else '') + ''.join(f'<style>\n{inline_css(GAME / href, shared)}\n</style>\n' for href in hrefs)
    body = html[html.index('<body>') + 6:html.index('</body>')]
    # every art file, by the path the game asks for
    art = {}
    # a full-size PNG kept next to the WebP the game actually loads (a source picture) stays out of the page,
    # unless the code or data name it
    words = ''.join(f.read_text(encoding='utf-8', errors='ignore') for f in list((GAME / 'js').rglob('*.js')) + list((GAME / 'css').glob('*.css')) + [GAME / 'data' / 'gamedata.js', GAME / 'index.html'])
    skipped = []
    for f in sorted((GAME / 'art').rglob('*')):
        if f.suffix in ('.png', '.webp', '.svg', '.jpg') or (f.suffix == '.json' and ('scene/vox' in f.as_posix() or 'scene/models' in f.as_posix())):   # v43: voxel recipes ride along
            rel = f.relative_to(GAME / 'art').as_posix()
            if f.suffix == '.png' and f.with_suffix('.webp').exists() and rel not in words: skipped.append(rel); continue
            art[rel] = art_uri(f)
    def script(src):
        code = (GAME / src).read_text(encoding='utf-8')
        if src == 'data/gamedata.js': code = compact_data(code)
        if src in PACK: code = packed(src, code)
        code = code.replace('</script', '<\\/script')
        return f'<script>/* {src} */\n{code}\n</script>'
    body = re.sub(r'<script src="([^"]+)"></script>', lambda m: script(m.group(1)), body)
    head = (f'<meta charset="utf-8">\n<title>Pocket Billies</title>\n<meta name="description" content="A walking RPG inside the Hollow Earth, where the Billies are the wildlife. Gotta tax \'em all!">\n'
            f'<meta name="theme-color" content="#275c60">\n{css}')
    extra = []
    if split:
        chunks, cur, size = [], {}, 0
        for k, v in art.items():
            if cur and size + len(v) > 10e6: chunks.append(cur); cur, size = {}, 0
            cur[k] = v; size += len(v) + len(k) + 6
        if cur: chunks.append(cur)
        for n, ch in enumerate(chunks, 1):
            f = out.parent / f'{out.stem}-art{n}.js'; f.write_text('window.NW_ART=Object.assign(window.NW_ART||{},' + json.dumps(ch) + ');\n', encoding='utf-8'); extra.append(f)
        pre = '<script>window.NW_ARTIFACT=true;window.NW_ART={};</script>\n' + ''.join(f'<script src="{f.name}"></script>\n' for f in extra)
    else:
        pre = f'<script>window.NW_ARTIFACT=true;window.NW_ART={json.dumps(art)};</script>\n'
    pre = unpacker() + pre
    out.write_text(head + body.replace('<div id="app"></div>', '<div id="app"></div>\n' + pre, 1), encoding='utf-8')
    print(f'{out} · {out.stat().st_size / 1e6:.1f} MB · {len(art)} art files ' + (f'in {", ".join(f"{f.name} ({f.stat().st_size / 1e6:.1f} MB)" for f in extra)}' if extra else 'inlined')
          + (f' · left out (a WebP is used instead): {", ".join(skipped)}' if skipped else ''))

if __name__ == '__main__':
    main()
