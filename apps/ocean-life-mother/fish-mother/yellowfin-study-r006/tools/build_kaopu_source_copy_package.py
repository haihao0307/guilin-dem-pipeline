from __future__ import annotations
import argparse, base64, hashlib, json, mimetypes, struct
from pathlib import Path
import numpy as np

ACCEPTED={
'f75f073a2999ee20c4839434d28f90565e486b50270e663f48484cca2dbae9f0':6137560,
'5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe':58908280,
}
DT={5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT2':4,'MAT3':9,'MAT4':16}

def h(b):return hashlib.sha256(b).hexdigest()

def read_glb(p:Path):
 raw=p.read_bytes();sha=h(raw)
 if raw[:4]!=b'glTF' or struct.unpack_from('<I',raw,4)[0]!=2 or struct.unpack_from('<I',raw,8)[0]!=len(raw):raise ValueError('invalid GLB')
 if sha not in ACCEPTED or ACCEPTED[sha]!=len(raw):raise ValueError(f'exact FISH-REF-002 required: {sha} {len(raw)}')
 off=12;g=None;binb=None
 while off+8<=len(raw):
  n,t=struct.unpack_from('<II',raw,off);s=off+8;e=s+n
  if t==0x4E4F534A:g=json.loads(raw[s:e].decode().rstrip('\x00 \t\r\n'))
  elif t==0x004E4942:binb=raw[s:e]
  off=e
 if g is None or binb is None:raise ValueError('missing GLB chunks')
 return raw,sha,g,binb

def accessor(g,binb,i):
 a=g['accessors'][i];bv=g['bufferViews'][a['bufferView']];dt=np.dtype(DT[a['componentType']]).newbyteorder('<');c=NC[a['type']]
 off=bv.get('byteOffset',0)+a.get('byteOffset',0);stride=bv.get('byteStride',dt.itemsize*c);out=np.empty((a['count'],c),dt)
 for k in range(a['count']):out[k]=np.frombuffer(binb,dt,c,off+k*stride)
 if a.get('normalized'):
  info=np.iinfo(dt);out=out.astype(np.float32)/(info.max if info.min==0 else info.max);out=np.maximum(out,-1)
 return out

def write_array(out:Path,rel:str,a:np.ndarray):
 p=out/rel;p.parent.mkdir(parents=True,exist_ok=True)
 a=np.ascontiguousarray(a);raw=a.tobytes(order='C');p.write_bytes(raw)
 return {'path':rel,'dtype':str(a.dtype),'shape':list(a.shape),'bytes':len(raw),'sha256':h(raw)}

def image_bytes(g,binb,img):
 if 'bufferView' in img:
  bv=g['bufferViews'][img['bufferView']];o=bv.get('byteOffset',0);n=bv['byteLength'];return bytes(binb[o:o+n]),img.get('mimeType')
 uri=img.get('uri','')
 if uri.startswith('data:'):
  head,data=uri.split(',',1);mime=head.split(';')[0][5:] or None;return base64.b64decode(data),mime
 raise ValueError('external image URI is not accepted in exact embedded-source package')

def ext_for(mime):
 return { 'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'}.get(mime,mimetypes.guess_extension(mime or '') or '.bin')

def main():
 ap=argparse.ArgumentParser(description='Build exact internal KAOPU reference package from FISH-REF-002')
 ap.add_argument('glb',type=Path);ap.add_argument('--out',type=Path,required=True);a=ap.parse_args();a.out.mkdir(parents=True,exist_ok=True)
 raw,sha,g,binb=read_glb(a.glb)
 manifest={
  'schema':'kaopu.source-copy-package/1.0','referenceId':'FISH-REF-002','sourceSha256':sha,'sourceBytes':len(raw),
  'sourceLicense':g.get('asset',{}).get('extras',{}).get('license','CC-BY-4.0'),
  'sourceAuthor':g.get('asset',{}).get('extras',{}).get('author','GoldenZtuff'),
  'sourceRuntimeDependency':False,'strictReferencePackage':True,'productionReady':False,
  'nodes':[],'meshes':[],'skins':[],'animations':[],'materials':g.get('materials',[]),'textures':g.get('textures',[]),'samplers':g.get('samplers',[]),'images':[]
 }
 for i,n in enumerate(g.get('nodes',[])):
  manifest['nodes'].append({'index':i,'name':n.get('name'),'children':n.get('children',[]),'mesh':n.get('mesh'),'skin':n.get('skin'),'matrix':n.get('matrix'),'translation':n.get('translation'),'rotation':n.get('rotation'),'scale':n.get('scale')})
 for mi,m in enumerate(g.get('meshes',[])):
  mo={'index':mi,'name':m.get('name'),'primitives':[]}
  for pi,p in enumerate(m.get('primitives',[])):
   po={'index':pi,'mode':p.get('mode',4),'material':p.get('material'),'attributes':{}}
   for sem,ai in p.get('attributes',{}).items():
    arr=accessor(g,binb,ai)
    if sem in {'POSITION','NORMAL','TANGENT','TEXCOORD_0','TEXCOORD_1','WEIGHTS_0','WEIGHTS_1'}:arr=arr.astype(np.float32)
    elif sem.startswith('JOINTS_'):arr=arr.astype(np.uint16)
    po['attributes'][sem]=write_array(a.out,f'geometry/mesh_{mi:02d}_prim_{pi:02d}_{sem.lower()}.bin',arr)
   if 'indices' in p:
    ind=accessor(g,binb,p['indices']).reshape(-1).astype(np.uint32)
    po['indices']=write_array(a.out,f'geometry/mesh_{mi:02d}_prim_{pi:02d}_indices_u32.bin',ind)
   mo['primitives'].append(po)
  manifest['meshes'].append(mo)
 for si,s in enumerate(g.get('skins',[])):
  so={'index':si,'name':s.get('name'),'joints':s.get('joints',[]),'skeleton':s.get('skeleton')}
  if 'inverseBindMatrices' in s:
   so['inverseBindMatrices']=write_array(a.out,f'rig/skin_{si:02d}_inverse_bind_f32.bin',accessor(g,binb,s['inverseBindMatrices']).astype(np.float32))
  manifest['skins'].append(so)
 for ai,anim in enumerate(g.get('animations',[])):
  ao={'index':ai,'name':anim.get('name'),'samplers':[],'channels':anim.get('channels',[])}
  for si,s in enumerate(anim.get('samplers',[])):
   inp=accessor(g,binb,s['input']).astype(np.float32);outp=accessor(g,binb,s['output']).astype(np.float32)
   ao['samplers'].append({'index':si,'interpolation':s.get('interpolation','LINEAR'),'input':write_array(a.out,f'animation/anim_{ai:02d}_sampler_{si:03d}_time_f32.bin',inp),'output':write_array(a.out,f'animation/anim_{ai:02d}_sampler_{si:03d}_value_f32.bin',outp)})
  manifest['animations'].append(ao)
 for ii,img in enumerate(g.get('images',[])):
  b,mime=image_bytes(g,binb,img);rel=f'appearance/image_{ii:02d}{ext_for(mime)}';p=a.out/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
  manifest['images'].append({'index':ii,'name':img.get('name'),'mimeType':mime,'path':rel,'bytes':len(b),'sha256':h(b)})
 mp=a.out/'KAOPU_SOURCE_COPY_MANIFEST.json';mp.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 receipt={'schema':'kaopu.source-copy-package-receipt/1.0','manifest':mp.name,'manifestSha256':h(mp.read_bytes()),'sourceSha256':sha,'sourceCopyUnlocked':False,'note':'Strict reference package only; independent reconstruction still required.'}
 (a.out/'PACKAGE_RECEIPT.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt,indent=2))

if __name__=='__main__':main()
