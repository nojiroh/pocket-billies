#!/usr/bin/env python3
"""Lossless editable trainer/portrait/overworld sprite-sheet export and reverse import.

python tools/export-trainer-sprite-sheets.py --root . --out art-edit/trainer-sheets
python tools/export-trainer-sprite-sheets.py --reimport art-edit/trainer-sheets --out art-edit/edited-assets
"""
import argparse
import hashlib
import json
import shutil
from collections import defaultdict
from pathlib import Path
from PIL import Image, ImageDraw

COLUMNS, ROWS = 8, 9

def checksum(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def inventory(root):
    image_paths = sorted(set(p for dr in ('trainer','people','next/portraits')
                         for p in (root/'game/art'/dr).rglob('*.png')))
    sources = {}
    for p in image_paths:
        rel = p.relative_to(root).as_posix()
        with Image.open(p) as im: w,h=im.size
        sources[rel] = dict(width=w,height=h,sha256=checksum(p))
    entries = []
    def add(group,name,source,rect,mask=None):
        entry=dict(group=group,id=name,source=source,rect=list(rect))
        if mask: entry['mask']=mask
        entries.append(entry)
    gd=root/'game/data/gamedata.js'
    if gd.exists():
        data=json.loads(gd.read_text().split('window.GAMEDATA=',1)[1].strip().rstrip(';'))
        wardrobe=data.get('wardrobe',{})
        blocks=[]
        if wardrobe.get('body'):blocks.append(('body','body',wardrobe['body']))
        blocks.extend((k,v.get('slot','misc'),v) for k,v in wardrobe.get('items',{}).items())
        for key,slot,details in blocks:
            source='game/art/'+details['img']
            mask='game/art/'+details['mask'] if details.get('mask') else None
            if source not in sources or (mask and mask not in sources):
                raise ValueError('Missing wardrobe atlas or recolor mask: '+source)
            for i,piece in enumerate(details.get('pieces',[])):
                view=piece.get('v','front')
                add('wardrobe/'+slot+'/'+view,key+'/'+view+'/'+piece.get('b','part')+'/'+str(i).zfill(2),
                    source,piece['r'],mask)
    else:
        raise ValueError('Cannot find game/data/gamedata.js; wardrobe pieces need its rig rectangles.')
    for source in sorted(s for s in sources if s.startswith('game/art/people/')):
        stem=Path(source).stem
        size=(sources[source]['width'],sources[source]['height'])
        if stem.endswith('_walk') and size==(96,160):cw,ch,cols,rows=32,32,3,5
        elif size==(128,88):cw,ch,cols,rows=64,88,2,1
        else:cw,ch,cols,rows=*size,1,1
        category=stem.rsplit('_',1)[-1]
        for row in range(rows):
            for col in range(cols):
                add('overworld/'+category,f'{stem}/r{row:02d}c{col:02d}',
                    source,[cw*col,ch*row,cw,ch])
    for source in sorted(s for s in sources if s.startswith('game/art/next/portraits/')):
        name=Path(source).stem
        if name.startswith(('head_','body_')):kind='heads-and-bodies'
        elif name.startswith('hair_'):kind='hair-back' if name.endswith('_back') else 'hair-front'
        elif name.startswith('eyes_'):kind='eyes'
        elif name.startswith('brows_'):kind='brows'
        elif name.startswith('mouth_'):kind='mouths'
        elif name.startswith('nose_'):kind='noses'
        elif name.startswith('top_'):kind='clothing'
        elif name.startswith('hat_'):kind='hats'
        else:kind='face-and-accessories'
        add('portrait/'+kind,name,source,[0,0,sources[source]['width'],sources[source]['height']])
    for e in entries:
        x,y,w,h=e['rect']; d=sources[e['source']]
        if x<0 or y<0 or w<1 or h<1 or x+w>d['width'] or y+h>d['height']:
            raise ValueError('Invalid piece rectangle: '+str(e))
    return entries,sources

def export(root,out):
    entries,sources=inventory(root)
    if out.exists():shutil.rmtree(out)
    out.mkdir(parents=True)
    groups=defaultdict(list)
    for e in entries:groups[e['group']].append(e)
    cache={}
    def pic(p):
        if p not in cache:cache[p]=Image.open(root/p).convert('RGBA')
        return cache[p]
    sheets=[]
    for group in sorted(groups):
        items=groups[group]
        cw=max(64,max(e['rect'][2] for e in items))
        ch=max(64,max(e['rect'][3] for e in items))
        for start in range(0,len(items),COLUMNS*ROWS):
            chunk=items[start:start+COLUMNS*ROWS]
            page=start//(COLUMNS*ROWS)+1
            rows=(len(chunk)+COLUMNS-1)//COLUMNS
            basename=f'{group}-{page:02d}'
            path='sheets/'+basename+'.png'
            maskpath='sheets/'+basename+'_mask.png'
            sheet=Image.new('RGBA',(cw*COLUMNS,ch*rows))
            masked=any('mask' in e for e in chunk)
            masks=Image.new('RGBA',sheet.size) if masked else None
            guide=Image.new('RGB',(cw*COLUMNS*2,rows*(ch*2+22)),'#242331')
            draw=ImageDraw.Draw(guide)
            for index,e in enumerate(chunk):
                px=(index%COLUMNS)*cw;py=(index//COLUMNS)*ch
                x,y,w,h=e['rect']
                tile=pic(e['source']).crop((x,y,x+w,y+h))
                sheet.paste(tile,(px,py))
                if e.get('mask'):masks.paste(pic(e['mask']).crop((x,y,x+w,y+h)),(px,py))
                e['sheet']=path;e['cell']=[px,py,cw,ch]
                if masked:e['mask_sheet']=maskpath
                gx=px*2; gy=(index//COLUMNS)*(ch*2+22)
                draw.rectangle((gx,gy,gx+cw*2-1,gy+ch*2-1),fill='#383744',outline='#68657b')
                expanded=tile.resize((w*2,h*2),Image.Resampling.NEAREST)
                guide.paste(expanded,(gx,gy),expanded)
                draw.text((gx+2,gy+ch*2+3),e['id'][-24:],fill='#eae9f0')
            for filename,im in [(path,sheet),('guides/'+basename+'_guide.png',guide)]:
                dest=out/filename;dest.parent.mkdir(parents=True,exist_ok=True)
                im.save(dest,optimize=True)
            sheets.append(path)
            if masks:
                dest=out/maskpath;dest.parent.mkdir(parents=True,exist_ok=True)
                masks.save(dest,optimize=True);sheets.append(maskpath)
    for src in sources:
        dest=out/'originals'/src;dest.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(root/src,dest)
    for filename in ('game/data/gamedata.js','game/data/portraits.json','tools/art-source/portrait-kit/kit.json'):
        src=root/filename
        if src.exists():
            dest=out/'metadata'/filename;dest.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(src,dest)
    sourcekit=root/'tools/art-source/portrait-kit'
    if sourcekit.exists():
        for src in sourcekit.glob('*.png'):
            dest=out/'source-kit'/src.name;dest.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(src,dest)
    manifest={'format':'pocket-billies-trainer-edit-pack-v1','pixel_scale':1,
              'source_files':sources,'entries':entries,'groups':{k:len(v) for k,v in groups.items()},
              'sheet_paths':sheets}
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(f'Exported {len(entries)} sprites, {len(sources)} originals, {len(sheets)} PNG sheets.')

def reimport(pack,out):
    m=json.loads((pack/'manifest.json').read_text())
    if m['format']!='pocket-billies-trainer-edit-pack-v1':raise ValueError('Unknown manifest')
    if out.exists():shutil.rmtree(out)
    out.mkdir(parents=True)
    originals={}
    for name,info in m['source_files'].items():
        src=pack/'originals'/name
        if checksum(src)!=info['sha256']:raise ValueError('Original source changed: '+name)
        originals[name]=Image.open(src).convert('RGBA')
    pages={}
    def page(path):
        if path not in pages:pages[path]=Image.open(pack/path).convert('RGBA')
        return pages[path]
    for e in m['entries']:
        ox,oy,cw,ch=e['cell'];x,y,w,h=e['rect']
        if page(e['sheet']).width<ox+cw or page(e['sheet']).height<oy+ch:
            raise ValueError('Sheet grid dimensions changed: '+e['sheet'])
        originals[e['source']].paste(page(e['sheet']).crop((ox,oy,ox+w,oy+h)),(x,y))
        if e.get('mask'):
            originals[e['mask']].paste(page(e['mask_sheet']).crop((ox,oy,ox+w,oy+h)),(x,y))
    for name,im in originals.items():
        dest=out/name;dest.parent.mkdir(parents=True,exist_ok=True)
        im.save(dest,optimize=True)
    print(f'Reimported {len(originals)} game-art PNGs without overwriting game assets.')

if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--root',type=Path,default=Path('.'))
    ap.add_argument('--out',type=Path,default=Path('art-edit/trainer-sheets'))
    ap.add_argument('--reimport',type=Path)
    a=ap.parse_args()
    if a.reimport:reimport(a.reimport.resolve(),a.out.resolve())
    else:export(a.root.resolve(),a.out.resolve())
