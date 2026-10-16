from pv import *
from PIL import Image
def head(ids,expr=None):
    I={i.id:i for i in items.ITEMS};v='front'
    L=[(z,n,draw_body(v,n)) for n,p,at,z,c in SKEL[v] if n!='chest']
    bz={n:z for n,p,at,z,c in SKEL[v]}
    for id in ids:
        it=I[id];has=any(x==expr and vv==v for (vv,b,cv,z,x) in it.pieces)
        for (vv,bone,cv,z,x) in it.pieces:
            if vv==v and x==(expr if has else None): L.append((z if z is not None else bz[bone]+SLOT[it.slot],bone,cv))
    im=compose(v,L,scale=1)
    return im.crop((18,0,78,70)).resize((60*5,70*5),Image.NEAREST)
ids=['eyes_round','brows_soft','mouth_smile','tee','jeans','hair_pony']
ims=[head(ids,x) for x in [None,'blink','happy','surprised','sad','angry','talk']]
sheet(ims).save('/tmp/claude-0/-home-claude/80e77b86-7dce-5a4f-a808-87e222f6ca3e/scratchpad/shots/faces.png')
