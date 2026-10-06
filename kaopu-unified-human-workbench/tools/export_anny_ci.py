"""Reproducible lossless browser export of official NAVER Anny v0.6.1.
Run with anny==0.6.1; no SMPL/SMPL-X or restricted retopology assets.
Source code Apache-2.0, MakeHuman-derived tensor assets CC0-1.0.
"""
from pathlib import Path
import os,sys,json,time,hashlib,math
# Modified only in output routing for one read-only CI fixture build.
ROOT=Path(os.environ['ANNY_OUTPUT']).resolve()
(ROOT/'assets').mkdir(parents=True,exist_ok=True);(ROOT/'tests').mkdir(parents=True,exist_ok=True)
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
# The full raw-byte hash binds every original array. Compression metadata may
# vary by zlib build; report that separately without changing model acceptance.
expected_raw='57cb642954bfee0c7589626a22726f5584490f74a1e38e7db8eb78a8392f57b1'
expected_gzip='2efd8da238bf7df2794c71db2578d0280b79d976d719543df83d0ac0148c428a'
assert meta['binary']['sha256']==expected_raw, 'CI array bytes do not match accepted Anny export'
assert anny.__version__=='0.6.1' and torch.__version__=='2.14.1+cpu' and np.__version__=='2.5.3'
receipt={'qaFixtureOnly':True,'productionAssetsDeployed':False,'sourceCommit':meta['source_commit'],'anny':anny.__version__,'torch':torch.__version__,'numpy':np.__version__,'rawBytes':len(raw),'rawSHA256':meta['binary']['sha256'],'expectedRawSHA256':expected_raw,'gzipSHA256':meta['binary']['compressed']['sha256'],'expectedGzipSHA256':expected_gzip,'gzipBytesMatch':meta['binary']['compressed']['sha256']==expected_gzip}
(ASSETS/'ci-generated-receipt.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt),flush=True)
