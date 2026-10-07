import os
os.environ['MPLCONFIGDIR']='/tmp/common-head-mpl'
from pathlib import Path
import json,gzip,numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
R=Path(__file__).resolve().parent.parent;D=R/'research/full-head-cases';G=R/'research/geometry';F=np.fromfile(D/'faces.u32','<u4').reshape(-1,3);C=json.loads(gzip.decompress((R/'source/kaopu-unified-human-workbench/assets/canonical.json.gz').read_bytes()));body=len(C['annyRecipes']);material=np.zeros(25417,int);region=np.full(25417,255);nm=np.fromfile(G/'gnm-materials.u32','<u4');nr=np.fromfile(G/'gnm-regions.u32','<u4')
for i,(a,b,t)in enumerate(C['gnmRecipes']):material[body+i]=nm[a];region[body+i]=nr[a]
palette=np.array([[.70,.55,.43],[.95,.94,.88],[.64,.31,.34],[.72,.35,.39],[.90,.89,.86],[.37,.49,.57],[.06,.07,.08]]);light=np.array([-.3,-.8,.7]);light/=np.linalg.norm(light);fig=plt.figure(figsize=(12,10))
for row,name in enumerate(['anny-jaw','anny-tongue','mhr-jaw']):
 original=np.fromfile(D/(name+'.f32'),'<f4').reshape(-1,3);center=original[np.isin(region,[17,18])].mean(0);span=.13
 for col,suffix in enumerate(['','-dental-anchor-probe']):
  v=np.fromfile(D/(name+suffix+'.f32'),'<f4').reshape(-1,3);mask=(v[F,2]>center[2]-span/2).any(1)&(v[F,2]<center[2]+span/2).any(1);f=F[mask];t=v[f];n=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);n/=np.maximum(np.linalg.norm(n,axis=1)[:,None],1e-20);l=.4+.6*np.maximum(0,n@light);ax=fig.add_subplot(3,2,row*2+col+1,projection='3d');ax.add_collection3d(Poly3DCollection(t,facecolors=palette[material[f[:,0]]]*l[:,None],edgecolors='none',rasterized=True));ax.set_xlim(center[0]-span/2,center[0]+span/2);ax.set_ylim(center[1]-span/2,center[1]+span/2);ax.set_zlim(center[2]-span/2,center[2]+span/2);ax.set_box_aspect([1,1,1]);ax.view_init(0,-75);ax.set_axis_off();ax.set_title(name+' | '+('original cavity'if col==0 else'GNM dental contact anchors'))
fig.suptitle('Actual candidate mouth geometry ablation · same camera/light/material\nSource expression field is unchanged; only preserved cavity attachment differs');fig.tight_layout();fig.savefig(D/'mouth-dental-anchor-ablation.png',dpi=160)
