"""Reproducible lossless browser export of official NAVER Anny v0.6.1.
Run with anny==0.6.1; no SMPL/SMPL-X or restricted retopology assets.
Source code Apache-2.0, MakeHuman-derived tensor assets CC0-1.0.
"""
from pathlib import Path
import os,sys,json,time,hashlib,math
ROOT=Path(__file__).resolve().parents[1]
os.environ.setdefault('ANNY_CACHE_DIR',str(ROOT.parent/'cache'))
import numpy as np
import torch, anny
from anny.models.model_data import PHENOTYPE_VARIATIONS

torch.set_num_threads(2)
m=anny.Anny(local_changes='default',facial_actions='none',phenotypes='default',skinning_method='lbs').float()
m.eval()
ASSETS=ROOT/'assets'; ASSETS.mkdir(exist_ok=True)
# Default phenotypes hold cupsize and firmness at .5. Their min/max anchors
# have exactly zero coefficients; pruning these rows is lossless for this API.
cols=[(group,label) for group,labels in PHENOTYPE_VARIATIONS.items() for label in labels]
mask=m.stacked_phenotype_blend_shapes_mask.cpu().numpy()
pruned=[i for i,row in enumerate(mask) if any(row[j] and group in ('cupsize','firmness') and label not in ('averagecup','averagefirmness') for j,(group,label) in enumerate(cols))]
arrays={}; blob=bytearray()
def pack(name,array,dtype):
    global blob
    if isinstance(array,torch.Tensor): array=array.detach().cpu().numpy()
    array=np.ascontiguousarray(array,dtype=dtype)
    while len(blob)%4: blob.append(0)
    arrays[name]={'dtype':str(array.dtype),'shape':list(array.shape),'byteOffset':len(blob),'byteLength':array.nbytes}
    blob.extend(array.tobytes())
for key in ['template_vertices','template_bone_heads','bone_heads_blendshapes','bone_template_orientation_matrices','bone_orientation_blendshapes','reference_bone_orientations','vertex_bone_weights']:
    value=getattr(m,key)
    if value is not None:
        if key in ('bone_heads_blendshapes','bone_orientation_blendshapes'):
            value=value.clone(); value[pruned]=0
        pack(key,value,'float32')
pack('faces',m.faces,'uint32'); pack('vertex_bone_indices',m.vertex_bone_indices,'uint16')
pack('stacked_phenotype_blend_shapes_mask',m.stacked_phenotype_blend_shapes_mask,'uint8')
bs=m.blendshapes.detach().cpu().numpy(); inds=[]; vals=[]; offsets=[0]
for shape_index,shape in enumerate(bs):
    flat=shape.reshape(-1); ix=np.array([],dtype=np.int64) if shape_index in pruned else np.flatnonzero(flat!=0)
    inds.append(ix.astype('uint32')); vals.append(flat[ix]); offsets.append(offsets[-1]+len(ix))
pack('blendshape_offsets',offsets,'uint32'); pack('blendshape_indices',np.concatenate(inds),'uint32'); pack('blendshape_values',np.concatenate(vals),'float32')
raw=bytes(blob); (ASSETS/'anny-model.bin').write_bytes(raw)
meta={'schema':'kaopu-anny-model/1','source_version':anny.__version__,'source_commit':'d6fc027ced5c17b6b0775dee944096ade7a9ef80','rig':'anny','topology':'anny','pose_parameterization':'local-ref','skinning_method':'lbs','root_identity_orientation':m.root_identity_orientation,'extrapolate_phenotypes':m.extrapolate_phenotypes,'units':'metres','up_axis':'Z','arrays':arrays,'num_vertices':len(m.template_vertices),'num_faces':len(m.faces),'num_bones':m.bone_count,'num_blendshapes':len(m.blendshapes),'bone_labels':m.bone_labels,'bone_parents':m.bone_parents,'phenotype_labels':m.phenotype_labels,'local_change_labels':m.local_change_labels,'facial_action_labels':m.facial_action_labels,'blendshape_labels':m.blendshape_labels,'phenotype_variations':PHENOTYPE_VARIATIONS,'anchors':{k:getattr(m.anchors,k).tolist() for k in ['age','gender','muscle','weight','height','proportions','cupsize','firmness']},'binary':{'url':'./assets/anny-model.bin','byteLength':len(raw),'sha256':hashlib.sha256(raw).hexdigest()},'optimization':{'zero_coefficient_macro_rows':pruned,'fixed_excluded_phenotypes':{'cupsize':.5,'firmness':.5,'african':.5,'asian':.5,'caucasian':.5},'lossless_for_declared_api':True},'licenses':{'code':'Apache-2.0','mesh_and_targets':'CC0-1.0'},'dependencies':{'torch':torch.__version__,'numpy':np.__version__}}
import gzip
z=gzip.compress(raw,compresslevel=9,mtime=0)
(ASSETS/'anny-model.bin.gz').write_bytes(z)
parts=[]
for i,start in enumerate(range(0,len(z),8388608)):
    name=f'anny-model-{i:02}.bin.part'; part=z[start:start+8388608]; (ASSETS/name).write_bytes(part)
    parts.append({'url':'./assets/'+name,'byteLength':len(part),'sha256':hashlib.sha256(part).hexdigest()})
meta['binary']['compressed']={'parts':parts,'byteLength':len(z),'sha256':hashlib.sha256(z).hexdigest(),'encoding':'gzip'}
(ASSETS/'anny-model.json').write_text(json.dumps(meta,ensure_ascii=False,separators=(',',':')))
print('MODEL',len(raw),'bytes',m.template_vertices.shape, 'sparse ratio',len(raw)/m.blendshapes.numel()/4,flush=True)
# Exact fixtures in original Anny world coordinates, plus diagnostic intermediates.
fixtures=[]; fblob=bytearray()
def store(arr):
    a=np.asarray(arr,dtype='<f4'); offset=len(fblob); fblob.extend(a.tobytes()); return {'byteOffset':offset,'length':a.size,'shape':list(a.shape)}
def rotation(euler):
    x,y,z=[math.radians(v) for v in euler]; cx,sx=math.cos(x),math.sin(x); cy,sy=math.cos(y),math.sin(y); cz,sz=math.cos(z),math.sin(z)
    return torch.tensor([[1,0,0],[0,cx,-sx],[0,sx,cx]],dtype=torch.float32)@torch.tensor([[cy,0,sy],[0,1,0],[-sy,0,cy]],dtype=torch.float32)@torch.tensor([[cz,-sz,0],[sz,cz,0],[0,0,1]],dtype=torch.float32)
local_labels=m.local_change_labels
selection=[x for x in local_labels if any(s in x for s in ['stomach','upperarm','leg','neck'])][:5]
cases=[('baseline',{}),('newborn',{'phenotypes':{'age':-1/3}}),('old',{'phenotypes':{'age':1}}),('female_small',{'phenotypes':{'gender':1,'age':2/3,'weight':.1,'height':.15,'muscle':.2,'proportions':.8}}),('male_athletic',{'phenotypes':{'gender':0,'age':2/3,'weight':.75,'height':.8,'muscle':1,'proportions':.2}}),('mixed_axes',{'phenotypes':{'gender':.32,'age':.41,'weight':.64,'height':.39,'muscle':.71,'proportions':.48}})]
for i,k in enumerate(selection): cases.append(('local_'+str(i),{'localChanges':{k:(-.65 if i%2 else .75)}}))
# Main pose labels are verified from the official exported skeleton.
print('bones',m.bone_labels,flush=True)
poseA={k:v for k,v in {'upperarm01.L':[0,0,-25],'upperarm01.R':[0,0,25],'lowerarm01.L':[35,0,0],'neck01':[0,15,0]}.items() if k in m.bone_labels}
poseB={k:v for k,v in {'upperleg01.L':[25,0,0],'upperleg01.R':[-20,0,0],'lowerleg01.L':[30,0,0],'lowerleg01.R':[10,0,0],'spine02':[0,0,8]}.items() if k in m.bone_labels}
cases += [('pose_upper',{'pose':poseA}),('pose_lower',{'pose':poseB}),('shape_local_pose',{'phenotypes':{'age':.1,'gender':.2,'weight':.7,'height':.3},'localChanges':{selection[0]:.4} if selection else {},'pose':poseA})]
rng=np.random.default_rng(461)
for i in range(8):
    inputs={'phenotypes':{k:float(rng.random()) for k in m.phenotype_labels},'pose':{k:[float(v) for v in rng.uniform(-25,25,3)] for k in ['upperarm01.L','upperleg01.R','neck01'] if k in m.bone_labels}}
    if selection: inputs['localChanges']={k:float(rng.uniform(-.5,.5)) for k in selection}
    cases.append(('random_'+str(i),inputs))
with torch.no_grad():
  for name,inputs in cases:
    pose=torch.eye(4).reshape(1,1,4,4).repeat(1,m.bone_count,1,1)
    for label,euler in inputs.get('pose',{}).items(): pose[0,m.bone_labels.index(label),:3,:3]=rotation(euler)
    out=m(pose_parameters=pose,phenotype_kwargs=inputs.get('phenotypes',{}),local_changes_kwargs=inputs.get('localChanges',{}))
    _, pp, lp, fp=m.get_tensor_inputs(pose,inputs.get('phenotypes',{}),inputs.get('localChanges',{}),None); coefficients=m._get_phenotype_blendshape_coefficients(pp,lp,fp); rest=m.get_rest_model(coefficients)
    fixture={'name':name,'inputs':inputs}
    for key,arr in [('vertices',out['vertices']),('coefficients',coefficients),('restVertices',rest['rest_vertices']),('restBoneHeads',rest['rest_bone_heads']),('restBonePoses',rest['rest_bone_poses']),('bonePoses',out['bone_poses'])]: fixture[key]=store(arr[0].numpy())
    fixtures.append(fixture)
(ROOT/'tests'/'official-fixtures.bin').write_bytes(fblob)
(ROOT/'tests'/'official-fixtures.json').write_text(json.dumps({'cases':fixtures,'source_commit':meta['source_commit'],'torch':torch.__version__,'euler_order':'Rx @ Ry @ Rz','tolerance_max_metres':2e-5,'all_vertices':True},ensure_ascii=False,indent=2))
print('FIXTURES',len(fixtures),len(fblob),'bytes',flush=True)
