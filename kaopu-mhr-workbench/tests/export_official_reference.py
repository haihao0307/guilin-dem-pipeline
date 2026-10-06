"""Export MHR v1.0.1 float32 weights losslessly. No quantization or pruning."""
from pathlib import Path
import torch,numpy as np,json,gzip,hashlib,importlib.util,time
import argparse
parser=argparse.ArgumentParser();parser.add_argument('--workdir',type=Path,required=True,help='Working folder containing an official MHR checkout in official/ with release assets extracted');args=parser.parse_args()
R=args.workdir.resolve();(R/'fixtures').mkdir(exist_ok=True,parents=True); O=R/'kaopu-mhr-workbench'; A=O/'assets';A.mkdir(exist_ok=True,parents=True);torch.set_num_threads(2)
m=torch.jit.load(str(R/'official/assets/mhr_model.pt'),map_location='cpu').eval();s={k:v.numpy() for k,v in m.state_dict().items()}
arrays={}
def add(n,x,dtype=None): arrays[n]=np.ascontiguousarray(x,dtype=dtype)
def csr(n,x):
 r,c=np.nonzero(x);add(n+'_ptr',np.r_[0,np.cumsum(np.bincount(r,minlength=x.shape[0]))],'<u4');add(n+'_idx',c,'<u2' if x.shape[1]<65536 else '<u4');add(n+'_val',x[r,c],'<f4')
add('base',s['character_torch.blend_shape.base_shape'],'<f4');add('identity',s['character_torch.blend_shape.shape_vectors'],'<f4');csr('expression',s['face_expressions_model.shape_vectors'].reshape(72,-1));
csr('transform',s['character_torch.parameter_transform.parameter_transform'][:,:204]);
add('offset',s['character_torch.skeleton.joint_translation_offsets'],'<f4');add('prerotation',s['character_torch.skeleton.joint_prerotations'],'<f4');add('parents',s['character_torch.skeleton.joint_parents'],'<i4');
add('inverse_bind',s['character_torch.linear_blend_skinning.inverse_bind_pose'],'<f4');add('skin_joints',s['character_torch.linear_blend_skinning.skin_indices_flattened'],'<u2');add('skin_verts',s['character_torch.linear_blend_skinning.vert_indices_flattened'],'<u2');add('skin_weights',s['character_torch.linear_blend_skinning.skin_weights_flattened'],'<f4');add('faces',s['character_torch.mesh.faces'],'<u4')
si=s['pose_correctives_model.pose_dirs_predictor.0.sparse_indices']; sw=s['pose_correctives_model.pose_dirs_predictor.0.sparse_weight']; w=np.zeros((3000,750),np.float32);w[tuple(si)]=sw;csr('mlp0',w)
csr('mlp2',s['pose_correctives_model.pose_dirs_predictor.2.weight'])
# Each zero is removed exactly, each nonzero remains bit-identical float32.
header={};chunks=[];off=0
for n,x in arrays.items():
 padding=(-off)%4
 if padding:chunks.append(b'\0'*padding);off+=padding
 header[n]={'offset':off,'bytes':x.nbytes,'dtype':x.dtype.str,'shape':list(x.shape)}; chunks.append(x.tobytes());off+=x.nbytes
raw=b''.join(chunks);(A/'model.bin.gz').write_bytes(gzip.compress(raw,compresslevel=9,mtime=0))
spec=importlib.util.spec_from_file_location('face',R/'official/mhr/face_expression.py');face=importlib.util.module_from_spec(spec);spec.loader.exec_module(face)
limits=m.get_parameter_limits().numpy()[:204].tolist();names=list(m.get_parameter_names())[:204]
metadata={'schema':1,'source':'https://github.com/facebookresearch/MHR','commit':'d96fafa33bbf018647c70c3525e91f53e79d2a14','asset_release':'v1.0.1','asset_sha256':'e4f4f205cd87c0fa106577ba1de4fc763e4eb197c924461d2ef7e6944e9d6b94','license':'Apache-2.0','vertices':18439,'joints':127,'arrays':header,'pose_names':names,'pose_limits':limits,'expression_names':face.FACE_EXPRESSION_NAMES,'joint_names':list(m.get_joint_names()),'raw_bytes':len(raw),'compressed_bytes':(A/'model.bin.gz').stat().st_size,'weight_encoding':'lossless float32, exact-zero sparse CSR; no quantization or pruning'}
(A/'model.json').write_text(json.dumps(metadata,separators=(',',':')))
# Official viewer barycentric LOD correspondence (not native per-LOD evaluation).
with np.load(R/'official/web-viewer/data/lod_topology.npz') as topo:
 for lod in [0,2,3,4,5,6]:
  mp=np.load(R/f'official/tools/mhr_LOD_conversion/lod1_to_lod{lod}_mapping.npz'); idx=s['character_torch.mesh.faces'][mp['triangle_ids']].astype('<u4');b=mp['baryc_coords'].astype('<f4');f=topo[f'lod{lod}_faces'].astype('<u4'); d=idx.tobytes()+b.tobytes()+f.tobytes();(A/f'lod{lod}.bin.gz').write_bytes(gzip.compress(d,mtime=0));(A/f'lod{lod}.json').write_text(json.dumps({'vertices':len(idx),'faces':len(f),'source':'official LOD1 barycentric mapping'}))
# Reference fixtures generated only through untouched official TorchScript forward.
cases=[]
def sample(label,a=None,p=None,e=None,c=True):
 a=np.zeros(45,np.float32) if a is None else np.array(a,np.float32);p=np.zeros(204,np.float32) if p is None else np.array(p,np.float32);e=np.zeros(72,np.float32) if e is None else np.array(e,np.float32)
 with torch.no_grad():v,j=m(torch.from_numpy(a)[None],torch.from_numpy(p)[None],torch.from_numpy(e)[None],c)
 i=len(cases);v.numpy().astype('<f4').tofile(R/f'fixtures/parity-{i}.bin');j.numpy().astype('<f4').tofile(R/f'fixtures/joints-{i}.bin');cases.append({'name':label,'identity':a.tolist(),'pose':p.tolist(),'expression':e.tolist(),'correctives':c})
sample('neutral')
for i in range(45):a=np.zeros(45);a[i]=1.3;sample(f'identity-{i}',a=a)
for i in range(72):e=np.zeros(72);e[i]=.7;sample(f'expression-{i}',e=e)
for i in range(204):
 p=np.zeros(204);low,high=limits[i];p[i]=min(.3,high*.4) if high>0 else max(-.3,low*.4);sample(f'rig-{i}',p=p)
rng=np.random.default_rng(231107)
for i in range(10):
 p=rng.normal(0,.12,204).astype(np.float32);p[:3]=0
 a=rng.normal(0,.5,45);e=rng.normal(0,.2,72);sample(f'mixed-{i}',a,p,e,True);sample(f'mixed-{i}-no-correctives',a,p,e,False)
(R/'fixtures/cases.json').write_text(json.dumps(cases,separators=(',',':')))
print(json.dumps({'compressed':metadata['compressed_bytes'],'raw':len(raw),'cases':len(cases),'sparse_correctives_nonzero':len(arrays['mlp2_val'])}),flush=True)
