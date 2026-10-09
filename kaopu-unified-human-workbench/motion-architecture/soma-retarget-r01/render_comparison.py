from pathlib import Path
import os
p=Path(__file__).resolve().parent
os.environ['MPLCONFIGDIR']=str(p/'mpl-cache');os.environ['XDG_CACHE_HOME']=str(p/'cache')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
import numpy as np,json
src=np.load(p/'source-preview.npz');target=json.loads((p/'target-full-preview.json').read_text());C=np.array([[1,0,0],[0,0,-1],[0,1,0]])
rows=[(src['zero']@C.T,src['faces'],'SOMA native zero: T pose'),(src['combined']@C.T,src['faces'],'SOMA: root Y +15, forearm Z +30 deg'),(np.array(target['neutral']),np.array(target['faces']).reshape(-1,3),'Our full person: native A pose'),(np.array(target['posed']),np.array(target['faces']).reshape(-1,3),'Same source output, rest-calibrated')]
fig=plt.figure(figsize=(12,11),facecolor='#111b25')
for i,(v,f,title) in enumerate(rows):
 ax=fig.add_subplot(2,2,i+1,projection='3d');ax.set_facecolor('#111b25');tri=v[f.astype(int)];norm=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);norm/=np.maximum(np.linalg.norm(norm,axis=1,keepdims=True),1e-9);light=np.abs(norm@np.array([.3,-.7,.65]));col=np.outer(.6+.4*light,np.array([.48,.83,.8]) if i<2 else np.array([.7,.73,.91]));ax.add_collection3d(Poly3DCollection(tri,facecolors=col,edgecolors='none',linewidths=0,rasterized=True))
 ax.set_xlim(-1,1);ax.set_ylim(-.75,.75);ax.set_zlim(-1.05,1.2);ax.set_box_aspect((2,1.5,2.25));ax.view_init(elev=10,azim=-78);ax.set_axis_off();ax.set_title(title,color='white',fontsize=12)
fig.suptitle('Real native SOMA output -> root + left-forearm anatomical calibration',color='white',fontsize=16,y=.98)
fig.text(.5,.03,'Fixed camera/limits. Root translation retained. Target: 25417 vertices / 50624 triangles / 104 bones / up to 9 influences.\nCPU replay of the existing skin consumer; not GPU image QA. No full-body retarget, corrective MLP or new boxing move.',ha='center',color='#d0dae3',fontsize=10)
fig.subplots_adjust(top=.92,bottom=.11,hspace=.03,wspace=.01);fig.savefig(p/'native-to-full-comparison.png',dpi=140,facecolor=fig.get_facecolor())
