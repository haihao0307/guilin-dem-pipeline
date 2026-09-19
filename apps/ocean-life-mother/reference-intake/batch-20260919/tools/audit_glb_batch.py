"""Inspect provided GLB bytes as reference evidence, never as production assets."""
from pathlib import Path
import json,struct,hashlib,io,base64,os
import numpy as np
from PIL import Image,ImageDraw
ROOT=Path(os.environ.get('OCEAN_INTAKE_OUTPUT','/mnt/data/ocean_intake_20260919'))
INPUT_DIR=Path(os.environ.get('OCEAN_REFERENCE_DIR','/mnt/data'))
NAMES=['model_67a_-_largemouth_bass(1).glb','koi_fish(1).glb','model_73a_-_great_hammerhead_shark.glb','bream_fish__dorade_royale.glb','guppy(1).glb','tuna_fish.glb','tuna_fish (1)(1).glb']
DT={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}
WIDTH={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT2':4,'MAT3':9,'MAT4':16}

def glb(path):
 raw=path.read_bytes()
 if len(raw)<20: raise ValueError('truncated header')
 magic,version,size=struct.unpack_from('<4sII',raw)
 if magic!=b'glTF' or version!=2 or size!=len(raw):raise ValueError('invalid GLB2 header/size')
 pos=12;chunks=[]
 while pos<len(raw):
  if pos+8>len(raw):raise ValueError('truncated chunk header')
  n,typ=struct.unpack_from('<II',raw,pos);pos+=8
  if n%4 or pos+n>len(raw):raise ValueError('chunk boundary invalid')
  chunks.append((typ,raw[pos:pos+n]));pos+=n
 if chunks[0][0]!=0x4e4f534a:raise ValueError('JSON not first chunk')
 doc=json.loads(chunks[0][1]);bins=[b for t,b in chunks if t==0x004e4942]
 binary=bins[0] if bins else b''
 return doc,binary,raw

def accessor(doc,binary,index):
 a=doc['accessors'][index]
 if a.get('sparse'):raise ValueError('sparse accessor not supported by this observer')
 v=doc['bufferViews'][a['bufferView']]
 if v.get('buffer',0)!=0:raise ValueError('external buffers unsupported')
 dt=np.dtype(DT[a['componentType']]);wid=WIDTH[a['type']];stride=v.get('byteStride',wid*dt.itemsize)
 off=v.get('byteOffset',0)+a.get('byteOffset',0);num=a['count']
 end=off+(num-1)*stride+wid*dt.itemsize if num else off
 if stride<wid*dt.itemsize or end>min(len(binary),v.get('byteOffset',0)+v['byteLength']):raise ValueError('accessor bounds')
 if a['type'] in ['MAT2','MAT3'] and dt.itemsize<4:raise ValueError('padded matrix requires dedicated decoder')
 arr=np.ndarray((num,wid),dtype=dt,buffer=binary,offset=off,strides=(stride,dt.itemsize)).copy()
 if a.get('normalized'):
  inf=np.iinfo(dt);arr=np.maximum(arr.astype(float)/inf.max,-1) if inf.min<0 else arr.astype(float)/inf.max
 return arr

def payload(doc,binary,image):
 if 'bufferView' in image:
  v=doc['bufferViews'][image['bufferView']];o=v.get('byteOffset',0);return binary[o:o+v['byteLength']]
 uri=image.get('uri','')
 if uri.startswith('data:'):return base64.b64decode(uri.split(',',1)[1])
 raise ValueError('external image URI')

def audit(name,order):
 p=INPUT_DIR/name;doc,binary,raw=glb(p);part=ROOT/'audit'/f'upload-{order:02}';part.mkdir(parents=True,exist_ok=True)
 (part/'source-document.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2))
 a={'filename':name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'asset':doc.get('asset'),
  'extensionsUsed':doc.get('extensionsUsed',[]),'extensionsRequired':doc.get('extensionsRequired',[]),
  'meshes':[],'skins':[],'animations':[],'images':[],'materials':doc.get('materials',[]),'textures':doc.get('textures',[]),'accessorProblems':[],
  'externalDependencies':[], 'byteReadAndHeaderValid':True, 'sourceVisualInspection':False,'distilled':False}
 for i,v in enumerate(doc.get('bufferViews',[])):
  off=v.get('byteOffset',0);ln=v['byteLength']
  if v.get('buffer',0)!=0 or off<0 or off+ln>len(binary):raise ValueError(f'bufferView {i} bounds')
 for k,ac in enumerate(doc.get('accessors',[])):
  try:
   ar=accessor(doc,binary,k)
   if not np.isfinite(ar).all():a['accessorProblems'].append({'index':k,'problem':'nonfinite'})
  except Exception as e:a['accessorProblems'].append({'index':k,'problem':str(e)})
 for m in doc.get('meshes',[]):
  mm={'name':m.get('name'),'primitives':[]}
  for pr in m['primitives']:
   at=pr.get('attributes',{});pm={'attributes':at,'mode':pr.get('mode',4),'material':pr.get('material'),'morphTargetCount':len(pr.get('targets',[]))}
   pos=accessor(doc,binary,at['POSITION']);pm.update(vertices=len(pos),boundsLocal=[pos.min(0).tolist(),pos.max(0).tolist()])
   faces=accessor(doc,binary,pr['indices']).ravel() if 'indices'in pr else np.arange(len(pos))
   pm['indexCount']=len(faces);pm['indicesInBounds']=bool((faces>=0).all() and (faces<len(pos)).all())
   pm['triangles']=len(faces)//3 if pm['mode']==4 else None
   if 'WEIGHTS_0'in at:
    weights=accessor(doc,binary,at['WEIGHTS_0']);pm['weightSumMaxError']=float(np.abs(weights.sum(1)-1).max())
   mm['primitives'].append(pm)
  a['meshes'].append(mm)
 for s in doc.get('skins',[]):
  a['skins'].append({'name':s.get('name'),'jointCount':len(s['joints']),'jointNames':[doc['nodes'][i].get('name',f'node#{i}')for i in s['joints']], 'hasInverseBindMatrices':'inverseBindMatrices'in s})
 for anim in doc.get('animations',[]):
  aa={'name':anim.get('name'),'channelCount':len(anim.get('channels',[])),'channels':[]}
  spans=[];active=0
  for ch in anim.get('channels',[]):
   smp=anim['samplers'][ch['sampler']];ts=accessor(doc,binary,smp['input']).ravel();val=accessor(doc,binary,smp['output']);spans.append([float(ts.min()),float(ts.max())]);delta=float(np.max(np.ptp(val,axis=0)));active+=delta>1e-6
   target=ch['target'];nid=target.get('node');aa['channels'].append({'node':nid,'name':doc['nodes'][nid].get('name')if nid is not None else None,'path':target.get('path'),'interpolation':smp.get('interpolation','LINEAR'),'keys':len(ts),'strictlyIncreasingTime':bool((np.diff(ts)>0).all()),'valueRangeMax':delta})
  aa['timeRange']=[min(t[0]for t in spans),max(t[1]for t in spans)] if spans else None;aa['duration']=aa['timeRange'][1]-aa['timeRange'][0] if spans else 0;aa['varyingChannelCount']=int(active);a['animations'].append(aa)
 roles={i:[]for i in range(len(doc.get('images',[])))}
 def collect(obj,prefix=''):
  if not isinstance(obj,dict):return
  for k,v in obj.items():
   if isinstance(v,dict):
    if k.lower().endswith('texture') and 'index'in v:
     tx=doc.get('textures',[])[v['index']];source=tx.get('source')
     if source is not None:roles[source].append(prefix+k)
    collect(v,prefix+k+'.')
 for mi,m in enumerate(doc.get('materials',[])):collect(m,f'material{mi}.')
 for i,im in enumerate(doc.get('images',[])):
  try:
   bb=payload(doc,binary,im);pic=Image.open(io.BytesIO(bb));pic.load();ia={'index':i,'name':im.get('name'),'roles':roles[i],'size':pic.size,'mode':pic.mode,'bytes':len(bb),'sha256':hashlib.sha256(bb).hexdigest()}
   if any('baseColor' in r for r in roles[i]):
    thumb=pic.convert('RGBA');thumb.thumbnail((900,650));bg=Image.new('RGBA',thumb.size,(70,70,70,255));bg.alpha_composite(thumb);bg.convert('RGB').save(part/f'baseColor-{i}.png')
   a['images'].append(ia)
  except Exception as e:a['images'].append({'index':i,'problem':str(e)})
 for seq in [doc.get('images',[]),doc.get('buffers',[])]:
  for obj in seq:
   if obj.get('uri') and not obj['uri'].startswith('data:'):a['externalDependencies'].append(obj['uri'])
 a['totals']={'meshes':len(a['meshes']),'primitives':sum(len(x['primitives'])for x in a['meshes']), 'vertices':sum(y['vertices']for x in a['meshes']for y in x['primitives']), 'triangles':sum(y['triangles']or 0 for x in a['meshes']for y in x['primitives']), 'skins':len(a['skins']),'jointsPerSkin':[s['jointCount']for s in a['skins']],'animations':len(a['animations']),'images':len(a['images']),'encodedImageBytes':sum(i.get('bytes',0) for i in a['images'])}
 (part/'AUDIT.json').write_text(json.dumps(a,ensure_ascii=False,indent=2));return a

if __name__=='__main__':
 items=[audit(name,i+1) for i,name in enumerate(NAMES)]
 old=INPUT_DIR/'model_67a_-_largemouth_bass.glb'
 out={'schema':'ocean-life-reference-batch-audit/0.1','files':items,'fileCount':len(items),'uniqueBytePayloadCount':len(set(a['sha256']for a in items)), 'largemouthMatchesEarlierSHA':items[0]['sha256']=='c1b964b34e80e8534b7801c496576d6a594938d217b4f763b35d04a922b3ee64','oldMountedLargemouthMatches':old.exists() and hashlib.sha256(old.read_bytes()).hexdigest()==items[0]['sha256'],'tunaByteIdentical':items[-1]['sha256']==items[-2]['sha256'],'basis':'Supplied GLB bytes; source labels are not independent species verification.'}
 (ROOT/'audit/BATCH_AUDIT.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
 for x in items: print(json.dumps({'filename':x['filename'],'bytes':x['bytes'],'sha256':x['sha256'],'asset':x['asset'],'totals':x['totals'],'animations':[{k:v for k,v in a.items()if k!='channels'}for a in x['animations']],'joints':[s['jointNames']for s in x['skins']],'images':x['images'],'accessorProblems':x['accessorProblems'],'externalDependencies':x['externalDependencies']},ensure_ascii=False))
