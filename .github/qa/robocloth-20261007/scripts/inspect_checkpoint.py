from pathlib import Path
import zipfile,pickle,pickletools,json,hashlib,struct,collections,io
root=Path(__file__).resolve().parents[1];p=root/'assets/checkpoints/stage2/RoboCloth/145/Ours_epoch112.ckpt'
class Placeholder(dict):
 def __init__(self,*a,**k):self.args=a;self.kwargs=k
 def __setstate__(self,state):self.state=state
 def __repr__(self):return f'Placeholder{self.args}'
class Storage:
 def __init__(self,pid):self.pid=pid
class SafeUnpickler(pickle.Unpickler):
 def find_class(self,m,n):
  if (m,n)==('collections','OrderedDict'):return collections.OrderedDict
  if (m,n)==('torch._utils','_rebuild_tensor_v2'):
   return lambda storage,offset,shape,stride,*a:dict(storage=storage.pid,offset=offset,shape=shape,stride=stride)
  if m=='torch' and n.endswith('Storage'):return n
  if m=='__builtin__' and n=='set':return set
  return Placeholder
 def persistent_load(self,pid):return Storage(pid)
z=zipfile.ZipFile(p);data=z.read(next(x for x in z.namelist() if x.endswith('/data.pkl')))
ck=SafeUnpickler(io.BytesIO(data)).load();sd=ck['state_dict'];out={'checkpoint_size':p.stat().st_size,'metadata_keys':list(ck),'tensors':{},'zip':[]}
with p.open('rb') as f:
 for x in z.infolist():
  f.seek(x.header_offset);header=f.read(30);namelen,extralen=struct.unpack_from('<HH',header,26)
  offset=x.header_offset+30+namelen+extralen
  out['zip'].append(dict(name=x.filename,size=x.file_size,compressed_size=x.compress_size,compression=x.compress_type,data_offset=offset))
lookup={x['name'].split('/')[-1]:x for x in out['zip']}
for k,v in sd.items():
 storage=v['storage'];v['dtype']=storage[1];v['storage_key']=storage[2];v['storage_elements']=storage[4];v['zip']=lookup[storage[2]];out['tensors'][k]=v
print('top keys',out['metadata_keys'])
for k,v in out['tensors'].items():print(k,v['dtype'],v['shape'],v['zip']['size'],v['zip']['data_offset'])
(root/'reports/checkpoint-layout.json').write_text(json.dumps(out,indent=2,default=str))
