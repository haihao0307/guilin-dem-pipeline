from pathlib import Path
import struct,json,numpy as np,io,hashlib,os
from PIL import Image
PATH=Path(os.environ.get('KAOPU_SOURCE','/mnt/data/model_67a_-_largemouth_bass.glb'))
raw=PATH.read_bytes(); magic,version,total=struct.unpack_from('<4sII',raw)
assert magic==b'glTF' and version==2 and total==len(raw)
assert hashlib.sha256(raw).hexdigest()=='c1b964b34e80e8534b7801c496576d6a594938d217b4f763b35d04a922b3ee64', 'Source-specific intake: different file requires its own identity and mapping'
n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);p=20+n
ln,typ=struct.unpack_from('<II',raw,p);binary=raw[p+8:p+8+ln]
def acc(k):
 a=g['accessors'][k];v=g['bufferViews'][a['bufferView']];dt=np.dtype({5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]);w={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];o=v.get('byteOffset',0)+a.get('byteOffset',0);s=v.get('byteStride',w*dt.itemsize)
 return np.ndarray((a['count'],w),dtype=dt,buffer=binary,offset=o,strides=(s,dt.itemsize)).copy()
def image(k):
 v=g['bufferViews'][g['images'][k]['bufferView']];o=v.get('byteOffset',0)
 return Image.open(io.BytesIO(binary[o:o+v['byteLength']])).convert('RGBA')
if __name__=='__main__':
 print('source_sha256',hashlib.sha256(raw).hexdigest()); print('asset',g['asset']);print('mats',g['materials']);print('skins',g['skins'])
 for i,n in enumerate(g['nodes']):print(i,n.get('name'), 'mesh',n.get('mesh'),'translation',n.get('translation'))
 for m in g['meshes']:
  for pr in m['primitives']:
   a=pr['attributes'];p=acc(a['POSITION']);print(m['name'],len(p),p.min(0),p.max(0),a)
