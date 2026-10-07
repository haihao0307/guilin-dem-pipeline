"""Actual source/transfer surface comparison. Failed candidates stay labelled."""
import os
os.environ['MPLCONFIGDIR']='/tmp/common-head-mpl'
from pathlib import Path
import json,numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
R=Path(__file__).resolve().parent.parent;P=R/'research/head-channels';G=R/'research/geometry';F=R/'research/registration'
m=json.loads((P/'manifest.json').read_text());gv=np.fromfile(G/'gnm-vertices.f32','<f4').reshape(-1,3)[:,[0,2,1]]*[1,-1,1];gf=np.fromfile(G/'gnm-faces.u32','<u4').reshape(-1,3);material=np.fromfile(G/'gnm-materials.u32','<u4');outer=np.array(json.loads((G/'gnm-outer-mask.json').read_text())['outerSkin'])
palette=np.array([[.69,.78,.83],[.95,.94,.88],[.64,.31,.34],[.72,.35,.39],[.90,.89,.86],[.37,.49,.57],[.06,.07,.08]])
light=np.array([-.3,-.8,.7]);light/=np.linalg.norm(light)
def surface(ax,v,f,materials=None):
 t=v[f];n=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);n/=np.maximum(np.linalg.norm(n,axis=1)[:,None],1e-20);lum=.4+.6*np.maximum(0,n@light);colors=np.broadcast_to(palette[0],(len(f),3))if materials is None else palette[materials[f[:,0]]];ax.add_collection3d(Poly3DCollection(t,facecolors=colors*lum[:,None],edgecolors='none',rasterized=True))
for source in ['anny','mhr']:
 reg=np.load(F/f'{source}-outer-default-neutral-registration.npz');Minv=np.linalg.inv(reg['sourceToTargetMatrix']);nv=m['sources'][source]['vertices'];labels=m['sources'][source]['labels'];tf=np.fromfile(G/f'{source}-faces.u32','<u4').reshape(-1,3);direct=np.fromfile(P/f'{source}-direct-outer-deltas.f32','<f4').reshape(len(labels),len(outer),3);projected=np.fromfile(P/f'{source}-projected-full-deltas.f32','<f4').reshape(len(labels),len(gv),3)
 selected=[x for x in m['cases']if x['teacher']==source and x['id'].endswith(('adult-blink','adult-jawOpen','adult-mixed'))]
 fig=plt.figure(figsize=(13,12))
 for row,c in enumerate(selected):
  sourcev=np.fromfile(P/(c['id']+'.f32'),'<f4').reshape(-1,3).astype(float)
  if source=='mhr':sourcev=sourcev[:,[0,2,1]]*[.01,-.01,.01]
  sourcev=sourcev@Minv[:3,:3].T+Minv[:3,3];actions=c.get('actions',c.get('expression'));weights=np.array([actions.get(k,0)for k in labels]);dv=gv.copy();dv[outer]+=np.einsum('a,avc->vc',weights,direct);pv=gv+np.einsum('a,avc->vc',weights,projected)
  faces=tf[(sourcev[tf,2]>.04).all(1)]
  for col,(v,f,mat,title)in enumerate([(sourcev,faces,None,'Native teacher'),(dv,gf,material,'Direct exterior only: incomplete'),(pv,gf,material,'GNM383 projection: failed residual')]):
   ax=fig.add_subplot(len(selected),3,row*3+col+1,projection='3d');surface(ax,v,f,mat);ax.set_xlim(-.12,.12);ax.set_ylim(-.16,.08);ax.set_zlim(.08,.36);ax.set_box_aspect([.24,.24,.28]);ax.view_init(0,-90);ax.set_axis_off();ax.set_title(c['id'].split('-')[-1]+' · '+title,fontsize=10)
 fig.suptitle(source.upper()+' actual native expression transfer probes\nFixed GNM identity/topology; same camera/light; source identity differs',fontsize=14);fig.tight_layout();fig.savefig(P/f'{source}-expression-probes.png',dpi=145);plt.close(fig);print(P/f'{source}-expression-probes.png',flush=True)
