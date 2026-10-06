"""Export all official Anny v0.6.1 facial tensors plus demo-protocol fixtures.
Copyright (c) 2026. Derived Anny math/data follow upstream Apache-2.0/CC0.
The R01 base asset is kept immutable and verified against the full official model.
"""
from pathlib import Path
import os,json,hashlib,gzip,math
R=Path(__file__).resolve().parents[1];BASE=R.parent
os.environ['ANNY_CACHE_DIR']=str(BASE.parent/'cache')
import torch, numpy as np, roma, anny
torch.set_num_threads(2)
m=anny.Anny(rig='anny',topology='anny',local_changes='default',facial_actions='all',skinning_method='lbs').float().eval()
base=json.loads((BASE/'assets/anny-model.json').read_text());raw=(BASE/'assets/anny-model.bin').read_bytes()
def ba(k):
 s=base['arrays'][k];return np.frombuffer(raw,dtype=s['dtype'],count=s['byteLength']//np.dtype(s['dtype']).itemsize,offset=s['byteOffset']).reshape(s['shape'])
p=base['arrays']['stacked_phenotype_blend_shapes_mask']['shape'][0];n=len(m.facial_action_labels)
keep=list(range(p))+list(range(p+n,len(m.blendshapes)));pruned=set(base['optimization']['zero_coefficient_macro_rows']);proof={}
for key in ['template_vertices','template_bone_heads','bone_template_orientation_matrices','reference_bone_orientations','vertex_bone_weights','vertex_bone_indices','faces','stacked_phenotype_blend_shapes_mask']:
 a=getattr(m,key).detach().numpy();b=ba(key);assert a.shape==b.shape;diff=float(np.max(np.abs(a-b)));proof[key]=diff;assert diff==0,(key,diff)
for key in ['bone_heads_blendshapes','bone_orientation_blendshapes']:
 a=getattr(m,key).detach().numpy()[keep];a[list(pruned)]=0;b=ba(key);diff=float(np.max(np.abs(a-b)));proof[key]=diff;assert diff==0,(key,diff)
ptr,idx,val=ba('blendshape_offsets'),ba('blendshape_indices'),ba('blendshape_values');shapes=m.blendshapes.detach().numpy();mx=0
for old,new in enumerate(keep):
 if old in pruned:continue
 f=shapes[new].ravel();ii=idx[ptr[old]:ptr[old+1]];v=val[ptr[old]:ptr[old+1]]
 assert np.count_nonzero(f)==len(ii),(old,new,np.count_nonzero(f),len(ii));mx=max(mx,float(np.max(np.abs(f[ii]-v),initial=0)))
proof['mesh_blendshapes']=mx;assert mx==0
blob=bytearray();arrays={}
def pack(k,a,dtype):
 if isinstance(a,torch.Tensor):a=a.detach().numpy()
 a=np.ascontiguousarray(a,dtype=dtype)
 while len(blob)%4:blob.append(0)
 arrays[k]={'dtype':str(a.dtype),'shape':list(a.shape),'byteOffset':len(blob),'byteLength':a.nbytes};blob.extend(a.tobytes())
indices=[];values=[];offsets=[0]
for f in shapes[p:p+n]:
 f=f.ravel();i=np.flatnonzero(f);indices.append(i);values.append(f[i]);offsets.append(offsets[-1]+len(i))
pack('blendshape_offsets',offsets,'uint32');pack('blendshape_indices',np.concatenate(indices),'uint32');pack('blendshape_values',np.concatenate(values),'float32')
pack('bone_heads_blendshapes',m.bone_heads_blendshapes[p:p+n],'float32');pack('bone_orientation_blendshapes',m.bone_orientation_blendshapes[p:p+n],'float32')
b=bytes(blob);z=gzip.compress(b,9,mtime=0);(R/'assets/facial-actions.bin.gz').write_bytes(z)
meta={'schema':'kaopu-anny-facial/1','sourceCommit':base['source_commit'],'baseModelSha256':base['binary']['sha256'],'facial_action_labels':m.facial_action_labels,'arrays':arrays,'rawBytes':len(b),'rawSha256':hashlib.sha256(b).hexdigest(),'compressedBytes':len(z),'compressedSha256':hashlib.sha256(z).hexdigest(),'baseTensorsUnchangedProof':proof,'poseInputRepresentation':'rotation-vector-degrees','officialDemoSource':'src/anny/examples/interactive_demo.py','license':'CC0-1.0'}
(R/'assets/facial-actions.json').write_text(json.dumps(meta,separators=(',',':')))
# Full independent official tensor outputs. UI XYZ use the exact official rotvec convention.
cases=[('default',{}),('head_xyz',{'pose':{'head':[20,30,40]}}),('arm_xy',{'pose':{'upperarm01.L':[30,40,0]}}),('rotvec_180',{'pose':{'head':[180,0,0]}}),('multi_axis_large',{'pose':{'upperarm01.L':[100,120,-150]}})]
for label in m.facial_action_labels:cases.append((label,{'facialActions':{label:1.0}}))
cases += [('mixed_face_shape_pose',{'phenotypes':{'age':.31,'gender':.82,'weight':.67,'height':.64,'muscle':.22,'proportions':.7},'localChanges':{'head-scale-horiz-incr':.25,'measure-shoulder-dist-incr':-.2},'facialActions':{'jawOpen':.6,'mouthSmileLeft':.8,'eyeBlinkRight':.4,'browInnerUp':.3},'pose':{'head':[20,30,40],'upperarm01.L':[30,40,0],'finger2-1.L':[20,-10,5]}})]
for age in [0,1/3,.5,2/3,1,-1/3]:cases.append(('age_'+str(age),{'phenotypes':{'age':age}}))
fixtures=[];fb=bytearray()
def save(a):
 a=np.asarray(a,dtype='<f4');v={'byteOffset':len(fb),'length':a.size,'shape':list(a.shape)};fb.extend(a.tobytes());return v
with torch.no_grad():
 for name,inputs in cases:
  pose=torch.eye(4).reshape(1,1,4,4).repeat(1,m.bone_count,1,1)
  for label,angles in inputs.get('pose',{}).items():pose[0,m.bone_labels.index(label),:3,:3]=roma.rotvec_to_rotmat(torch.deg2rad(torch.tensor(angles,dtype=torch.float32)))
  out=m(pose_parameters=pose,phenotype_kwargs=inputs.get('phenotypes',{}),local_changes_kwargs=inputs.get('localChanges',{}),facial_actions=inputs.get('facialActions',{}))
  args=m.get_tensor_inputs(pose,inputs.get('phenotypes',{}),inputs.get('localChanges',{}),inputs.get('facialActions',{}));coeff=m._get_phenotype_blendshape_coefficients(*args[1:]);rest=m.get_rest_model(coeff)
  f={'name':name,'inputs':inputs}
  for k,a in [('vertices',out['vertices'][0]),('bonePoses',out['bone_poses'][0]),('coefficients',coeff[0]),('restVertices',rest['rest_vertices'][0]),('restBonePoses',rest['rest_bone_poses'][0])]:f[k]=save(a.numpy())
  fixtures.append(f)
(R/'tests/official-r02.bin.gz').write_bytes(gzip.compress(bytes(fb),9,mtime=0));(R/'tests/official-r02.json').write_text(json.dumps({'sourceCommit':base['source_commit'],'protocol':'roma.rotvec_to_rotmat(torch.deg2rad(XYZ))','cases':fixtures,'maxAllowedMetres':2e-5},indent=2))
print(json.dumps({'facialActions':n,'rawBytes':len(b),'gzipBytes':len(z),'fixtures':len(cases),'fixtureGzipBytes':(R/'tests/official-r02.bin.gz').stat().st_size,'allBaseTensorsUnchanged':True}),flush=True)

# Ship <=8MiB parts so the fixture is usable with bounded upload APIs.
fixture_blob=(R/'tests/official-r02.bin.gz').read_bytes();parts=[]
for i,start in enumerate(range(0,len(fixture_blob),8388608)):
    name=f'official-r02-{i:02}.bin.part';data=fixture_blob[start:start+8388608];(R/'tests'/name).write_bytes(data);parts.append({'file':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
p=R/'tests/official-r02.json';d=json.loads(p.read_text());d.update(binaryParts=parts,gzipSha256=hashlib.sha256(fixture_blob).hexdigest());p.write_text(json.dumps(d,indent=2))
