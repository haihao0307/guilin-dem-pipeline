"""Offline geometry inspection only; browser screenshots remain the release gate."""
import os
os.environ['MPLCONFIGDIR']='/tmp/common-head-mpl'
from pathlib import Path
import numpy as np,json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
R=Path(__file__).resolve().parent.parent;D=R/'research/full-head-cases';faces=np.fromfile(D/'faces.u32','<u4').reshape(-1,3);af=np.fromfile(D/'anny-faces.u32','<u4').reshape(-1,3);manifest=json.loads((D/'manifest.json').read_text());records={x['name']:x for x in manifest['cases']};light=np.array([-.3,-.8,.7]);light/=np.linalg.norm(light)
def draw(ax,v,f):
 t=v[f];n=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);n/=np.maximum(np.linalg.norm(n,axis=1)[:,None],1e-20);l=.4+.6*np.maximum(0,n@light);ax.add_collection3d(Poly3DCollection(t,facecolors=np.array([.70,.68,.64])[None,:]*l[:,None],edgecolors='none',rasterized=True))
for group,names in [('ages',['anny-neutral','baby','newborn']),('actions',['anny-blink','anny-jaw','anny-tongue'])]:
 fig=plt.figure(figsize=(12,9))
 for col,name in enumerate(names):
  common=np.fromfile(D/(name+'.f32'),'<f4').reshape(-1,3);native=np.fromfile(D/(name+'-native.f32'),'<f4').reshape(-1,3);head=common[9253:];low=head.min(0);high=head.max(0);center=(low+high)/2;span=(high-low).max()*1.15
  for row,(v,f,title)in enumerate([(native,af,'Native Anny'),(common,faces,'Fixed common mesh')]):
   ax=fig.add_subplot(2,3,row*3+col+1,projection='3d');mask=(v[f,2]>center[2]-span/2).any(1);draw(ax,v,f[mask]);ax.set_xlim(center[0]-span/2,center[0]+span/2);ax.set_ylim(center[1]-span/2,center[1]+span/2);ax.set_zlim(center[2]-span/2,center[2]+span/2);ax.set_box_aspect([1,1,1]);ax.view_init(0,-75);ax.set_axis_off();ax.set_title(name+' | '+title+'\nage='+str(records[name]['state']['anny']['phenotypes']['age']),fontsize=11)
 fig.suptitle('Actual head runtime geometry · same source inputs, camera and light\nCandidate not yet visually accepted; no skin or private photos');fig.tight_layout();path=D/('preview-'+group+'.png');fig.savefig(path,dpi=140);plt.close(fig);print(path,flush=True)
