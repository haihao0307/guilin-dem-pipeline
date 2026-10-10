"""Extract reusable frequency patches from the existing licensed scan.
No identity head geometry or low-frequency donor face color enters the runtime.
Coordinate bounds are authored fitting regions, not medical calibration.
"""
from pathlib import Path
import argparse, hashlib, json, struct, urllib.request
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, map_coordinates, distance_transform_edt
BASE='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/5be35195ad40d57507f7ab1785e4eecda6c648de/skin-quality-lab/'
FILES={
 'head.glb':('r01/assets/head.glb','402b8a8ac9f03232e6d64b5962929703a069daf99d3c49ac8eb0e48bedc9c576'),
 'color.jpg':('r01/assets/hires/albedo-4k.jpg','4fc7297835e2081cb914d1a8507fc837687102eed7bd3c6bed25b72960a09e08'),
 'height.png':('r01/assets/hires/microheight-4k.png','6ea15108bb848c726d337ffb6c16c1397a2883f80b7a9d2383ca563f5f12b01b'),
 'surface.webp':('r02/assets/surface.webp','301fea4c304810c08a7ac9054970ffbe44d12074513da1f8ade5134a1792b9f2')}
PATCHES=[('cheek',(-.043,.050),(.018,.018)),('forehead',(-.003,.116),(.020,.020)),('nose',(-.004,.053),(.010,.014)),('lip',(-.004,.018),(.025,.008)),('chin',(-.005,-.008),(.018,.016)),('temple',(-.050,.092),(.012,.012)),('thin',(.025,.111),(.012,.012)),('cheek2',(.036,.053),(.014,.014))]
def mesh(path):
 raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);off=20+n;size=struct.unpack_from('<I',raw,off)[0];b=raw[off+8:off+8+size];p=g['meshes'][0]['primitives'][0]
 def a(k):
  q=g['accessors'][k];v=g['bufferViews'][q['bufferView']];dtype={5126:'<f4',5123:'<u2',5125:'<u4'}[q['componentType']];s={'SCALAR':1,'VEC2':2,'VEC3':3}[q['type']];stride=v.get('byteStride',np.dtype(dtype).itemsize*s)
  return np.ndarray((q['count'],s),dtype,buffer=b,offset=v.get('byteOffset',0)+q.get('byteOffset',0),strides=(stride,np.dtype(dtype).itemsize)).copy()
 return a(p['attributes']['POSITION']).astype(np.float64)*.04,a(p['attributes']['TEXCOORD_0']).astype(np.float64),a(p['indices']).reshape(-1,3)
def patch_uv(vertices,uv,faces,centre,span,N=256):
 lo=np.array(centre)-np.array(span)/2;hi=np.array(centre)+np.array(span)/2
 xs=np.linspace(lo[0],hi[0],N);ys=np.linspace(hi[1],lo[1],N);U=np.zeros((N,N,2));Z=np.full((N,N),-np.inf)
 for f in faces:
  p=vertices[f];a,b,c=p;mn=p[:,:2].min(0);mx=p[:,:2].max(0)
  if (mx<lo).any() or (mn>hi).any():continue
  x0=max(0,int(np.floor((mn[0]-lo[0])/span[0]*(N-1))));x1=min(N-1,int(np.ceil((mx[0]-lo[0])/span[0]*(N-1))))
  y0=max(0,int(np.floor((hi[1]-mx[1])/span[1]*(N-1))));y1=min(N-1,int(np.ceil((hi[1]-mn[1])/span[1]*(N-1))))
  if x0>x1 or y0>y1:continue
  xx,yy=np.meshgrid(xs[x0:x1+1],ys[y0:y1+1]);den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
  if abs(den)<1e-14:continue
  w0=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den;w1=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den;w2=1-w0-w1;z=w0*a[2]+w1*b[2]+w2*c[2]
  valid=(np.minimum(np.minimum(w0,w1),w2)>-1e-6)&(z>Z[y0:y1+1,x0:x1+1]);Z[y0:y1+1,x0:x1+1][valid]=z[valid]
  value=w0[...,None]*uv[f[0]]+w1[...,None]*uv[f[1]]+w2[...,None]*uv[f[2]];U[y0:y1+1,x0:x1+1][valid]=value[valid]
 coverage=float(np.isfinite(Z).mean())
 if coverage<.995:raise ValueError('Source patch outside scan surface: '+str(centre)+' '+str(coverage))
 if coverage<1:
  nearest=distance_transform_edt(~np.isfinite(Z),return_distances=False,return_indices=True);U=U[tuple(nearest)]
 return U,Z,coverage
def image(path):
 a=np.asarray(Image.open(path));a=a.astype(np.float64)/(65535 if a.max()>255 else 255);return a[...,None] if a.ndim==2 else a[...,:3]
def sample(a,uv):
 c=np.array([(1-uv[:,:,1])*(a.shape[0]-1),uv[:,:,0]*(a.shape[1]-1)]);return np.stack([map_coordinates(a[:,:,i],c,order=1,mode='nearest') for i in range(a.shape[2])],-1)
def normalize(a,limit=3.2):
 sd=max(float(a.std()),1e-8);return np.clip(.5+a/(limit*sd)*.42,0,1)
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--source');ap.add_argument('--out',default=str(Path(__file__).resolve().parents[1]/'assets'));args=ap.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True);cache=out/'source-cache';cache.mkdir(exist_ok=True)
 inputs={}
 for name,(rel,sha) in FILES.items():
  p=Path(args.source)/rel if args.source else cache/name
  if not p.exists():
   if args.source:raise FileNotFoundError(p)
   urllib.request.urlretrieve(BASE+rel,p)
  data=p.read_bytes();actual=hashlib.sha256(data).hexdigest()
  if sha and actual!=sha:raise ValueError('Source hash mismatch: '+rel)
  inputs[name]={'path':p,'source':BASE+rel,'sha256':actual}
 v,uv,f=mesh(inputs['head.glb']['path']);co=image(inputs['color.jpg']['path']);h=image(inputs['height.png']['path']);su=image(inputs['surface.webp']['path']);detail=np.zeros((512,1024,3));color=np.zeros_like(detail);raw=np.zeros_like(detail);rows=[]
 for i,(name,centre,span) in enumerate(PATCHES):
  q,z,coverage=patch_uv(v,uv,f,centre,span);c=sample(co,q);height=sample(h,q)[:,:,0];surface=sample(su,q)
  mi=height-gaussian_filter(height,1.5);me=gaussian_filter(height,1.5)-gaussian_filter(height,7.0)
  sm=np.stack([gaussian_filter(np.log(np.maximum(c[:,:,k],.025)),12) for k in range(3)],-1);chroma=np.log(np.maximum(c,.025))-sm
  d=np.stack([normalize(mi),normalize(me),np.clip(.5+(surface[:,:,1]-.5)*.55,0,1)],-1);col=np.clip(.5+chroma*.6,0,1)
  for a in (d,col):
   for k in range(12):
    w=(1-k/12)*.5;a[k]=a[k]*(1-w)+a[-1-k]*w;a[-1-k]=a[k]
    a[:,k]=a[:,k]*(1-w)+a[:,-1-k]*w;a[:,-1-k]=a[:,k]
  yy=(i//4)*256;xx=(i%4)*256;detail[yy:yy+256,xx:xx+256]=d;color[yy:yy+256,xx:xx+256]=col;raw[yy:yy+256,xx:xx+256]=c
  rows.append({'name':name,'index':i,'centreMetres':centre,'spanMetres':span,'coverage':coverage,'textureSeamNearestSamplePixels':int(round((1-coverage)*256*256)),'heightStd':float(height.std()),'microStd':float(mi.std()),'mesoStd':float(me.std()),'lowFrequencyColorTransferred':False})
 for name,a in [('detail.png',detail),('chroma.png',color),('source-patches.jpg',raw)]:Image.fromarray(np.uint8(np.clip(a,0,1)*255)).save(out/name)
 info={'schema':'kaopu/face-frequency-atlas@1','source':'Infinite 3D Head Scan / Lee Perry-Smith, CC BY 3.0','license':'https://creativecommons.org/licenses/by/3.0/','changes':'Surface-projected region samples, micro/meso frequency split, log-color highpass; native low-frequency color is not overwritten','calibration':'Art-directed amplitudes; not measured pore depths','size':[1024,512],'tiles':rows,'inputs':{n:{k:v for k,v in r.items() if k!='path'} for n,r in inputs.items()},'outputs':{n:{'bytes':(out/n).stat().st_size,'sha256':hashlib.sha256((out/n).read_bytes()).hexdigest()} for n in ['detail.png','chroma.png']}}
 (out/'ATLAS.json').write_text(json.dumps(info,indent=2),encoding='utf-8');print(json.dumps(info,indent=2))
if __name__=='__main__':main()
