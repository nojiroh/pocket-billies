import sys
from body import *; from preview import *; import items, items2
SLOT={'eyes':.6,'brows':.61,'mouth':.6,'bottom':.1,'shoes':.2,'top':.3,'outer':.4,'neck':.45,'bag':.5,'face':.6,'facial':.62,'hair':.7,'glasses':.75,'hat':.8}
def outfit(ids,chest=True):
    ims=[]
    I={i.id:i for i in items.ITEMS}
    for v in VIEWS:
        L=[(z,n,draw_body(v,n)) for n,p,at,z,c in SKEL[v] if n!='chest' or chest]
        bz={n:z for n,p,at,z,c in SKEL[v]}
        for id in ids:
            it=I[id]
            for (vv,bone,cv,z,x) in it.pieces:
                if vv==v and x is None: L.append((z if z is not None else bz[bone]+SLOT[it.slot],bone,cv))
        ims.append(compose(v,L))
    return ims
