"""Offline GLB source audit. Records embedded claims, not legal clearance.
No mesh, image, rig or animation payload is exported as a native asset.
"""
from pathlib import Path
from collections import Counter, defaultdict
import json, struct, hashlib, io, re, os
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
INPUT=Path(os.environ.get('OCEAN_REFERENCE_DIR','/mnt/data'))
NAMES=['rainbow_trout_-_redband.glb','waltz_of_the_sharks.glb','model_65a_-_longnose_gar.glb','鲨鱼018d30c9-2a16-749c-996f-30a900311e08.glb.glb','turtle.glb','blue_powder_tang.glb','manta_new.glb','chub_v2_01_baked (1).glb','dace.glb','temp_04_scaledup.glb','chub_v2_01_baked.glb','laketrout_v3_03_bakedanimation.glb','speckleddace_v4_03a.glb','redsideshiner_v2.glb','rainbow_trout.glb','whitefish.glb','crayfish.glb','lahontan_cutthroat_trout.glb','fishe.glb','swimming_shark.glb']
DT={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}
W={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT2':4,'MAT3':9,'MAT4':16}
def load(p):
 raw=p.read_bytes()
 if len(raw)<20:raise ValueError('Truncated header')
 magic,ver,total=struct.unpack_from('<4sII',raw)
 if magic!=b'glTF' or ver!=2 or total!=len(raw):raise ValueError('GLB header mismatch')
 pos=12;chunks=[]
 while pos<len(raw):
  if pos+8>len(raw):raise ValueError('Truncated chunk header')
  size,kind=struct.unpack_from('<II',raw,pos);pos+=8
  if size%4 or pos+size>len(raw):raise ValueError('Bad chunk span')
  chunks.append((kind,raw[pos:pos+size]));pos+=size
 if not chunks or chunks[0][0]!=0x4e4f534a:raise ValueError('No leading JSON')
 doc=json.loads(chunks[0][1]);binary=next((b for k,b in chunks if k==0x004e4942),b'')
 return doc,binary,raw

def acc(d,b,i):
 a=d['accessors'][i]
 if 'sparse'in a:raise ValueError('Sparse unsupported in metadata audit')
 if 'bufferView'not in a:raise ValueError('Zero-initialised buffer unsupported here')
 v=d['bufferViews'][a['bufferView']];dt=np.dtype(DT[a['componentType']]);w=W[a['type']]
 if a['type'] in ('MAT2','MAT3') and dt.itemsize<4:raise ValueError('Padded matrix unsupported')
 if v.get('buffer',0)!=0:raise ValueError('External buffer')
 off=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',w*dt.itemsize);n=a['count'];end=off+max(0,n-1)*stride+(w*dt.itemsize if n else 0)
 if off<0 or stride<w*dt.itemsize or end>min(len(b),v.get('byteOffset',0)+v['byteLength']):raise ValueError('Accessor span')
 return np.ndarray((n,w),dtype=dt,buffer=b,offset=off,strides=(stride,dt.itemsize)).copy()

def rights_label(s):
 match=re.search(r'\b(CC0-1\.0|CC-BY(?:-NC)?(?:-ND|-SA)?-\d\.\d)\b',s,re.I)
 return match.group(1).upper() if match else ('CUSTOM' if s else 'UNKNOWN')

def inspect(name):
 d,b,raw=load(INPUT/name);h=hashlib.sha256(raw).hexdigest();extra=d.get('asset',{}).get('extras',{})
 r={'filename':name,'sha256':h,'bytes':len(raw),'sourceMetadata':d.get('asset',{}),'licenseLabel':rights_label(str(extra.get('license',''))),'rightsEvidence':'embedded-claim-only','legalClearance':False,'errors':[],'images':[],'primitives':[],'animations':[],'accessorDigests':[],'extensionsUsed':d.get('extensionsUsed',[]),'extensionsRequired':d.get('extensionsRequired',[])}
 for v in d.get('bufferViews',[]):
  if v.get('buffer',0)!=0 or v.get('byteOffset',0)<0 or v.get('byteOffset',0)+v['byteLength']>len(b):r['errors'].append('bufferView span')
 for i in range(len(d.get('accessors',[]))):
  try:
   arr=acc(d,b,i)
   if not np.isfinite(arr).all():raise ValueError('Nonfinite accessor')
   r['accessorDigests'].append({'index':i,'shape':list(arr.shape),'dtype':str(arr.dtype),'sha256':hashlib.sha256(arr.tobytes()).hexdigest()})
  except Exception as e:r['errors'].append({'accessor':i,'error':str(e)})
 for mi,m in enumerate(d.get('meshes',[])):
  for pi,p in enumerate(m['primitives']):
   pr={'mesh':mi,'primitive':pi,'meshName':m.get('name'),'material':p.get('material'),'morphTargets':len(p.get('targets',[])),'attributes':list(p.get('attributes',{}))}
   try:
    pos=acc(d,b,p['attributes']['POSITION']);pr['vertices']=len(pos);pr['sourceBounds']=[pos.min(0).tolist(),pos.max(0).tolist()]
    ix=acc(d,b,p['indices']).ravel() if 'indices'in p else np.arange(len(pos));pr['triangles']=len(ix)//3 if p.get('mode',4)==4 else None
    if np.any(ix<0)or np.any(ix>=len(pos)):r['errors'].append('indices out of bounds')
   except Exception as e:r['errors'].append({'mesh':mi,'error':str(e)})
   r['primitives'].append(pr)
 for im in d.get('images',[]):
  try:
   v=d['bufferViews'][im['bufferView']];off=v.get('byteOffset',0);bb=b[off:off+v['byteLength']];pic=Image.open(io.BytesIO(bb));pic.load()
   r['images'].append({'name':im.get('name'),'dimensions':list(pic.size),'mode':pic.mode,'bytes':len(bb),'sha256':hashlib.sha256(bb).hexdigest()})
  except Exception as e:r['errors'].append({'image':im,'error':str(e)})
 for a in d.get('animations',[]):
  times=[];paths=Counter();varying=0
  for c in a.get('channels',[]):
   paths[c.get('target',{}).get('path','unknown')]+=1
   s=a['samplers'][c['sampler']];ts=acc(d,b,s['input']).ravel();vals=acc(d,b,s['output']);times.extend([float(ts.min()),float(ts.max())])
   if not np.all(np.diff(ts)>0):r['errors'].append('nonincreasing animation time')
   if np.any(np.ptp(vals,axis=0)>1e-6):varying+=1
  r['animations'].append({'sourceName':a.get('name'),'durationSeconds':max(times)-min(times)if times else 0,'timeRange':[min(times),max(times)]if times else None,'channels':len(a.get('channels',[])),'paths':dict(paths),'varyingChannels':varying})
 r['skins']=len(d.get('skins',[]));r['uniqueJointNodes']=len(set(i for s in d.get('skins',[])for i in s['joints']));r['materials']=d.get('materials',[])
 r['externalDependencies']=[x['uri']for key in ['images','buffers']for x in d.get(key,[])if x.get('uri')and not x['uri'].startswith('data:')]
 r['formalVariants']=d.get('extensions',{}).get('KHR_materials_variants',{}).get('variants',[])
 r['totals']={'meshes':len(d.get('meshes',[])),'vertices':sum(p.get('vertices',0)for p in r['primitives']),'triangles':sum(p.get('triangles',0)or 0 for p in r['primitives']),'morphTargetsMax':max((p['morphTargets']for p in r['primitives']),default=0),'images':len(r['images']),'animations':len(r['animations']),'accessors':len(r['accessorDigests'])}
 (ROOT/'headers'/f'{h}.json').write_text(json.dumps(d,ensure_ascii=False,separators=(',',':')))
 return r

def main():
 for dr in ['headers','qa']: (ROOT/dr).mkdir(parents=True,exist_ok=True)
 out=[inspect(n)for n in NAMES];groups=defaultdict(list)
 for x in out:groups[x['sha256']].append(x['filename'])
 # Filename-independent prior-payload deduplication. All comparisons actually read files.
 new=set(NAMES);old={p.name:hashlib.sha256(p.read_bytes()).hexdigest()for p in INPUT.glob('*.glb') if p.name not in new}
 report={'schema':'ocean-life-batch03-audit/0.1','files':out,'fileCount':len(out),'uniqueBytePayloads':len(groups),'duplicateGroups':[v for v in groups.values()if len(v)>1],'previousFileMatches':[{"filename":x['filename'],"matches":[name for name,h in old.items()if h==x['sha256']]}for x in out if x['sha256']in old.values()],'licenseCountsByFile':dict(Counter(x['licenseLabel']for x in out)),'sourceBytes':sum(x['bytes']for x in out),'accessorsVerified':sum(x['totals']['accessors']for x in out),'embeddedImagesDecoded':sum(x['totals']['images']for x in out),'errorCount':sum(len(x['errors'])for x in out)}
 (ROOT/'qa/BATCH_AUDIT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 for x in out:print(json.dumps({k:x[k] for k in ['filename','bytes','sha256','sourceMetadata','licenseLabel','totals','skins','uniqueJointNodes','animations','errors']},ensure_ascii=False))
 print('SUMMARY',json.dumps({k:v for k,v in report.items()if k!='files'},ensure_ascii=False))
if __name__=='__main__':main()
