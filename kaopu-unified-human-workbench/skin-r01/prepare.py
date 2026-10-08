"""Build material data only. Never create or replace a runtime mesh.
Bare-skin scan samples come from accepted R02. Surface coordinates come from
an exact CommonViewer snapshot of the unchanged original canonical person.
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
import json,hashlib,sys,urllib.request

BASE='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/1d4a616672f2a45e869d4ef3e36e710b11f5cf41/skin-quality-lab/'
SOURCE_HASHES={'r01/assets/hires/albedo-4k.jpg':'4fc7297835e2081cb914d1a8507fc837687102eed7bd3c6bed25b72960a09e08','r01/assets/specular.jpg':'cbb96b60e355b804d9b6c7338372d13ec8cc7adf664f50a00a3d32c66afd293a','r02/assets/meso.webp':'9b930bbac49255efa336673ac3b676d48d4d6cac009df49a5d4329f153dee064','r02/assets/micro.webp':'a7470ad37a3c81013b57853a8eaa9a8982f563505e4616d1653e1792c6d7f6e4'}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def periodic(a):
 a=np.asarray(a,np.float64);h,w=a.shape[:2];v=np.zeros_like(a);v[0,:]=a[-1,:]-a[0,:];v[-1,:]=a[0,:]-a[-1,:];v[:,0]+=a[:,-1]-a[:,0];v[:,-1]+=a[:,0]-a[:,-1]
 den=2*np.cos(2*np.pi*np.arange(h)/h)[:,None]+2*np.cos(2*np.pi*np.arange(w)/w)[None,:]-4;den[0,0]=1
 if a.ndim==3:den=den[...,None]
 ft=np.fft.fft2(v,axes=(0,1))/den;ft[0,0]=0;return a-np.fft.ifft2(ft,axes=(0,1)).real

def build(snapshot,out):
 out=Path(out);out.mkdir(parents=True,exist_ok=True);src=Path('/tmp/skin-r02-source')
 for name,expected in SOURCE_HASHES.items():
  p=src/name;p.parent.mkdir(parents=True,exist_ok=True)
  if not p.exists():urllib.request.urlretrieve(BASE+name,p)
  if sha(p)!=expected:raise RuntimeError('R02 source digest mismatch: '+name)
 # Native 512px bare central forehead crop, above the eyebrows. This is not
 # a face portrait projection, and does not carry eyes, beard or brow paint.
 box=(1792,512,2304,1024)
 albedo=np.asarray(Image.open(src/'r01/assets/hires/albedo-4k.jpg').convert('RGB').crop(box),float)/255;mean=albedo.mean((0,1));resid=albedo-gaussian_filter(albedo,(24,24,0));color=np.clip(periodic(resid)*.72+mean,0,1)
 normals=[]
 for name in ['meso','micro']:
  f=np.asarray(Image.open(src/f'r02/assets/{name}.webp').convert('RGB').crop(box),float)/255*2-1;xy=periodic(f[...,:2]);xy-=xy.mean((0,1));normals.append(np.clip(xy,-.95,.95))
 xy=np.concatenate(normals,axis=-1)*.5+.5
 specImage=Image.open(src/'r01/assets/specular.jpg').convert('L').resize((4096,4096),Image.Resampling.BICUBIC);spec=np.asarray(specImage.crop(box),float)/255;rough=np.clip(.53+periodic(spec.mean()-spec)*.24,0,1);cr=np.concatenate([color,rough[...,None]],axis=-1)
 for name,a in [('scan-color-rough.png',cr),('scan-meso-micro.png',xy)]:Image.fromarray(np.uint8(np.clip(a,0,1)*255+.5)).save(out/name,optimize=True)
 scan={'schema':'kaopu/skin-material-sample@1','sourceCommit':'1d4a616672f2a45e869d4ef3e36e710b11f5cf41','sourceRepository':'haihao0307/Humanoid-Rig-Lab-Next','crop':list(box),'tilePixels':512,'estimatedTileMetres':.065,'scaleBiologicallyCalibrated':False,'sourceSRGBMean':mean.tolist(),'scope':'bare skin sample only; no facial-feature transplantation','sourceFiles':SOURCE_HASHES,'files':{p.name:{'sha256':sha(p),'bytes':p.stat().st_size} for p in out.glob('*.png')}}
 (out/'scan-manifest.json').write_text(json.dumps(scan,indent=2))
 d=json.loads(Path(snapshot).read_text());p=np.array(d['positions'],dtype='<f4').reshape(-1,3);n=np.array(d['normals'],dtype='<f4').reshape(-1,3);f=np.array(d['faces'],dtype='<u4').reshape(-1,3)
 a=np.concatenate([f[:,0],f[:,1],f[:,2]]);b=np.concatenate([f[:,1],f[:,2],f[:,0]]);count,labels=connected_components(coo_matrix((np.ones(len(a)),(a,b)),shape=(len(p),len(p))),directed=False);sizes=np.bincount(labels);outer=int(np.argmax(sizes));coverage=np.where(labels==outer,255,0).astype('u1')
 comps=[]
 for i,size in enumerate(sizes):
  q=p[labels==i];comps.append({'id':i,'vertices':int(size),'bounds':[q.min(0).tolist(),q.max(0).tolist()],'skinCandidate':i==outer})
 assert len(p)==25417 and len(f)==50624 and int((coverage>0).sum())==20062
 p.tofile(out/'rest.f32');n.tofile(out/'rest-normal.f32');coverage.tofile(out/'coverage.u8')
 meta={'schema':'kaopu/common-skin-reference@1','sourceCommit':'c713eb1353cbf75ca57e1d9a80c6a9d0222d55ee','topologySha256':d['canonical']['topologySha256'],'vertexCount':len(p),'triangles':len(f),'coordinateSpace':'exact original CommonViewer Y-up displayed canonical rest surface','components':comps,'skinVertexCount':int((coverage>0).sum()),'excludedVertexCount':int((coverage==0).sum()),'coverageMethod':'connected outer skin; runtime additionally requires GNM material_id=skin for head vertices','geometryRuntimeLoaded':False,'files':{name:{'sha256':sha(out/name),'bytes':(out/name).stat().st_size} for name in ['rest.f32','rest-normal.f32','coverage.u8']}}
 (out/'mapping.json').write_text(json.dumps(meta,indent=2));print('Prepared',meta['skinVertexCount'],'skin vertices,',meta['excludedVertexCount'],'excluded internal/eye vertices.')
 licenseText=urllib.request.urlopen(BASE+'r02/THIRD_PARTY.txt').read().decode('utf-8')+'\n\n'+urllib.request.urlopen(BASE+'r01/assets/HEAD-LICENSE.txt').read().decode('utf-8')
 (out.parent/'THIRD_PARTY.txt').write_text(licenseText)
if __name__=='__main__':build(*sys.argv[1:])
