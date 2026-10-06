"""Small orthographic software renderer for inspecting actual exported triangles.
No generated anatomy, smoothing, or image edits are used for QA images.
"""
from pathlib import Path
import json, numpy as np
from PIL import Image
R=Path(__file__).resolve().parents[1];c=json.loads((R/'assets/canonical.json').read_text());f=np.array(c['faces']).reshape(-1,3)
def render(name,face=False,angle=.3):
 v=np.fromfile(R/f'research/{name}-vertices.bin',dtype='<f4').reshape(-1,3).astype(float)
 # View: X right, Z up, front -Y. Orthographic rotation about up.
 x=v[:,0]*np.cos(angle)+v[:,1]*np.sin(angle);depth=-v[:,0]*np.sin(angle)+v[:,1]*np.cos(angle);y=v[:,2]
 xyz=np.array([x,y,depth]).T
 if face:
  lo=np.array([-.24,y.max()-.42]);hi=np.array([.24,y.max()+.04]);w,h=900,860
 else:
  lo=np.array([x.min()-.15,y.min()-.12]);hi=np.array([x.max()+.15,y.max()+.10]);w,h=860,1060
 scale=min(w/(hi[0]-lo[0]),h/(hi[1]-lo[1]));center=(lo+hi)/2
 screen=np.array([(x-center[0])*scale+w/2,h/2-(y-center[1])*scale]).T
 zbuf=np.full((h,w),np.inf);img=np.zeros((h,w,3),dtype=np.uint8);img[:]=[34,43,49]
 p=xyz[f];normal=np.cross(p[:,1]-p[:,0],p[:,2]-p[:,0]);normal/=np.maximum(np.linalg.norm(normal,axis=1)[:,None],1e-15)
 vn=np.zeros_like(xyz)
 for k in range(3):np.add.at(vn,f[:,k],normal)
 vn/=np.maximum(np.linalg.norm(vn,axis=1)[:,None],1e-15)
 light=np.array([-.5,.65,-.6]);light/=np.linalg.norm(light);intensity=.38+.62*np.maximum(vn@light,0)+.12*np.maximum(vn@np.array([.7,.1,.7]),0)
 colors=np.clip(intensity[:,None]*np.array([211,199,178]),0,255)
 for fi,tri in enumerate(f):
  q=screen[tri];z=depth[tri];minx=max(0,int(np.floor(q[:,0].min())));maxx=min(w-1,int(np.ceil(q[:,0].max())));miny=max(0,int(np.floor(q[:,1].min())));maxy=min(h-1,int(np.ceil(q[:,1].max())))
  if minx>maxx or miny>maxy:continue
  xx,yy=np.meshgrid(np.arange(minx,maxx+1)+.5,np.arange(miny,maxy+1)+.5)
  a,b,d=q;den=(b[1]-d[1])*(a[0]-d[0])+(d[0]-b[0])*(a[1]-d[1])
  if abs(den)<1e-10:continue
  wa=((b[1]-d[1])*(xx-d[0])+(d[0]-b[0])*(yy-d[1]))/den;wb=((d[1]-a[1])*(xx-d[0])+(a[0]-d[0])*(yy-d[1]))/den;wc=1-wa-wb
  zz=wa*z[0]+wb*z[1]+wc*z[2];region=zbuf[miny:maxy+1,minx:maxx+1];mask=(wa>=-1e-6)&(wb>=-1e-6)&(wc>=-1e-6)&(zz<region);region[mask]=zz[mask];col=wa[:,:,None]*colors[tri[0]]+wb[:,:,None]*colors[tri[1]]+wc[:,:,None]*colors[tri[2]];img[miny:maxy+1,minx:maxx+1][mask]=np.clip(col[mask],0,255).astype(np.uint8)
 suffix='face' if face else 'body';out=R/f'research/{name}-{suffix}.png';Image.fromarray(img).save(out);print(out)
for n in ['neutral','child','turn','combined']:
 render(n);render(n,True)
