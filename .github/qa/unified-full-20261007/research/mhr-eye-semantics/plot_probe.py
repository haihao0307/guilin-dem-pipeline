from pathlib import Path
import os;os.environ['MPLCONFIGDIR']='/tmp/mhr-eye-mpl'
import numpy as np,json,gzip,matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
R=Path(__file__).resolve().parents[2]; O=Path(__file__).resolve().parent
v=np.fromfile(R/'research/head-channels/mhr-neutral.f32','<f4').reshape(-1,3).astype(float)*10;f=np.fromfile(R/'research/geometry/mhr-faces.u32','<u4').reshape(-1,3);d=np.fromfile(R/'research/head-channels/mhr-expression-deltas.f32','<f4').reshape(72,-1,3).astype(float)*10
m=json.load(open(R/'assets/head-transfer.json'));b=gzip.decompress(open(R/'assets/head-transfer.bin.gz','rb').read());a=m['arrays']['mhr_eye_0_ids'];ids=np.frombuffer(b,a['dtype'],a['length'],a['offset']);names=json.load(open(R/'source/kaopu-mhr-workbench/assets/model.json'))['expression_names']; t=v[f];norm=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);f=f[(t[:,:,0].min(1)>0)&(t[:,:,0].max(1)<65)&(t[:,:,1].min(1)>1590)&(t[:,:,1].max(1)<1647)&(t[:,:,2].min(1)>85)&(norm[:,2]>0)]
fig,ax=plt.subplots(2,5,figsize=(20,9));cases=[None,14,16,18,20]
for j,k in enumerate(cases):
 q=v.copy() if k is None else v+d[k];t=q[f];z=t[:,:,2].mean(1);idx=np.argsort(z);lum=np.clip((z-95)/35,0,1);colors=plt.cm.Greys_r(.2+.65*lum)
 for row in range(2):
  a=ax[row,j];a.add_collection(PolyCollection(t[idx,:,:2],facecolors=colors[idx],edgecolors='#444444' if row==0 else 'none',linewidths=.25));a.scatter(q[ids,0],q[ids,1],s=13,c='#fc5353',zorder=3)
  if row==0:
   for i in ids:a.text(q[i,0],q[i,1],str(i),fontsize=5,color='red',zorder=4)
  else:
   g=np.unique(f);g=g[::7]
   if k is not None:a.quiver(v[g,0],v[g,1],d[k,g,0],d[k,g,1],angles='xy',scale_units='xy',scale=1,color='#4da6ff',width=.004)
  a.set_xlim(10,58);a.set_ylim(1595,1640);a.set_aspect('equal');a.set_title(('neutral' if k is None else names[k])+' (1.0)');a.set_xlabel('Native X / mm');a.set_ylabel('Native Y / mm')
fig.suptitle('MHR native left-eye surface: red = existing 18 cap candidates, blue = actual vertex displacement\nNo semantic iris mask and no rotation inferred; depths shaded, actual native triangles',fontsize=14);fig.tight_layout();fig.savefig(O/'native-left-eye-fields.png',dpi=160)
