"""Same-camera surface evidence for the actual neutral registration candidate.

This intentionally renders only the registration surfaces. Eye globes, teeth and
cavities require independent attachment tests and are not implied to be fitted.
"""
import os
os.environ['MPLCONFIGDIR']='/tmp/common-head-mpl'
from pathlib import Path
import json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
R=Path(__file__).resolve().parent.parent
P=R/'research/registration'
light=np.array([-.35,-.8,.6]);light/=np.linalg.norm(light)

def surface(ax,v,f,dist=None):
    tri=v[f];n=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);n/=np.maximum(np.linalg.norm(n,axis=1)[:,None],1e-20)
    lum=.35+.65*np.maximum(0,n@light)
    colors=np.broadcast_to([.69,.78,.83],(len(f),3)).copy()
    if dist is not None:colors=plt.get_cmap('magma')(np.minimum(dist[f].mean(1)*1000/5,1))[:,:3]
    ax.add_collection3d(Poly3DCollection(tri,facecolors=colors*lum[:,None],edgecolors='none',rasterized=True))

for name in ['anny','mhr']:
    d=np.load(P/f'{name}-outer-default-neutral-registration.npz')
    target=d['targetVertices'];fitted=d['fitted'];f=d['sourceFaces'];tf=d['targetFaces']
    # One common camera box per teacher, derived once from the registered skin.
    lo=fitted.min(0);hi=fitted.max(0);mid=(lo+hi)/2;span=max(hi-lo)*1.1
    fig=plt.figure(figsize=(13,12))
    for row,(az,el,label) in enumerate([(-90,0,'front'),(-45,0,'oblique'),(0,0,'side')]):
        for col,(v,faces,title,dist) in enumerate([(target,tf,'Native teacher surface',None),(fitted,f,'Registered GNM outer skin',None),(fitted,f,'Distance field, 0–5 mm',d['distance'])]):
            ax=fig.add_subplot(3,3,row*3+col+1,projection='3d');surface(ax,v,faces,dist)
            ax.set_xlim(mid[0]-span/2,mid[0]+span/2);ax.set_ylim(mid[1]-span/2,mid[1]+span/2);ax.set_zlim(mid[2]-span/2,mid[2]+span/2)
            ax.set_box_aspect([1,1,1]);ax.view_init(el,az);ax.set_axis_off();ax.set_title(label+' · '+title,fontsize=11)
    fig.suptitle(name.upper()+' neutral semantic registration candidate\nSame camera and lighting; independent eyes, teeth and cavities excluded; not a visual pass',fontsize=14)
    fig.tight_layout();fig.savefig(P/f'{name}-outer-neutral-views.png',dpi=145);plt.close(fig)
    print(P/f'{name}-outer-neutral-views.png',flush=True)
