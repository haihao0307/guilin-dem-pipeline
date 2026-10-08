"""Unique body colour atlas. Authored colour only, not a claimed body scan."""
import sys,json,hashlib
from pathlib import Path
import numpy as np
from scipy.ndimage import gaussian_filter
from PIL import Image

def main(out):
 out=Path(out);N=2048;rng=np.random.default_rng(507319);xx=np.linspace(-.63,.63,N,dtype=np.float32)[None,:];yy=np.linspace(.66,-1.,N,dtype=np.float32)[:,None];maps=[]
 for side in ['front','back']:
  n=gaussian_filter(rng.normal(size=(N,N)).astype(np.float32),38,mode='reflect');n/=max(n.std(),1e-6);fine=gaussian_filter(rng.normal(size=(N,N)).astype(np.float32),3);fine/=max(fine.std(),1e-6)
  rgb=np.zeros((N,N,3),np.float32)+np.array([.808,.642,.583],np.float32);rgb*=np.exp(-(n*.010+fine*.002)[...,None]*np.array([.60,1.04,1.14],np.float32))
  def stamp(cx,cy,sx,sy):return np.exp(-.5*(((xx-cx)/sx)**2+((yy-cy)/sy)**2))
  warm=np.zeros((N,N),np.float32)
  for sign in [-1,1]:
   for x,y,sx,sy,amount in [(.377,.268,.035,.04,.20),(.151,-.454,.034,.038,.30),(.195,-.905,.023,.035,.15),(.54,.072,.043,.048,.10),(.207,.484,.05,.056,.10)]:warm+=stamp(sign*x,y,sx,sy)*amount
  rgb*=1+warm[...,None]*np.array([.09,-.075,-.065],np.float32)
  # Sparse independent freckles/moles with variable radius and nonrepeated seed.
  for i in range(95 if side=='back' else 48):
   x=rng.uniform(-.26,.26);y=rng.uniform(.06,.56);r=rng.uniform(.00035,.00115);X=int((x+.63)/1.26*(N-1));Y=int((.66-y)/1.66*(N-1));rx=max(3,int(r/1.26*N*4));ry=max(3,int(r/1.66*N*4));sl=np.s_[max(0,Y-ry):min(N,Y+ry+1),max(0,X-rx):min(N,X+rx+1)];gx=xx[:,sl[1]];gy=yy[sl[0],:];spot=np.exp(-.5*(((gx-x)/r)**2+((gy-y)/(r*.82))**2))*rng.uniform(.08,.24);rgb[sl]*=np.exp(-spot[...,None]*np.array([.6,1.05,1.26]))
  rough=np.clip(.57+warm*.06+n*.006,.4,.74);maps.append(np.dstack([rgb,rough]))
 # Texture flipY: lower half of UV is front. Image top half = back.
 a=np.vstack([maps[1],maps[0]]);p=out/'body-color-atlas.png';Image.fromarray(np.uint8(np.clip(a,0,1)*255+.5)).save(p,compress_level=2)
 m=out/'paint-manifest.json';d=json.loads(m.read_text());d['files'][p.name]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size,'resolution':[N,2*N]};d['bodyPaint']={'source':'independently authored front/back pigment atlas with existing scan microstructure','scope':['nonrepeating pigment','elbow/knee/ankle tone','shoulder/hand warmth','sparse moles'],'notScan':True,'seed':507319};m.write_text(json.dumps(d,ensure_ascii=False,indent=2))
if __name__=='__main__':main(sys.argv[1])
