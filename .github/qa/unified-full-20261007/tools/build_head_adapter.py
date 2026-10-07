"""Pack fixed semantic correspondences and component-preserving operators.

Only generated adapters are packed. Teacher weights remain shared immutable
assets. This is a candidate asset, never a visual-quality certificate.
"""
from pathlib import Path
import json,gzip,hashlib
import numpy as np
from matplotlib.path import Path as Polygon
R=Path(__file__).resolve().parent.parent;G=R/'research/geometry';F=R/'research/registration';P=R/'research/head-channels';S=R/'fixtures/head-landmarks';O=R/'assets';O.mkdir(exist_ok=True)
arrays={};outer=json.loads((G/'gnm-outer-mask.json').read_text());arrays['outer_ids']=np.array(outer['outerSkin'],dtype='<u4');arrays['components']=np.fromfile(G/'gnm-components.u32','<u4');arrays['regions']=np.fromfile(G/'gnm-regions.u32','<u4')
for name in ['anny','mhr']:
 d=np.load(F/f'{name}-semantic-r4-neutral-registration.npz');assert np.array_equal(arrays['outer_ids'],d['sourceNativeIDs'])
 arrays[name+'_indices']=d['targetNativeTriangleVertices'].astype('<u4').ravel();arrays[name+'_bary']=d['barycentric'].astype('<f4').ravel();arrays[name+'_source_to_gnm']=np.linalg.inv(d['sourceToTargetMatrix']).astype('<f8').ravel();arrays[name+'_semantic_class']=d['semanticSourceClass'].astype('<u4')
 d=np.fromfile(G/f'{name}-vertices.f32','<f4').reshape(-1,3).astype(float)
 if name=='mhr':d=d[:,[0,2,1]]*[.01,-.01,.01]
 arrays[name+'_neutral']=d.astype('<f4').ravel()
for group in outer['preservedCavities']:
 d=np.load(P/'semantic-r3'/(group+'-extension.npz'))
 for k in ['ids','boundary','weights']:arrays[group+'_'+k]=d[k].astype('<f4'if k=='weights'else'<u4').ravel()
t=np.load(F/'anny-tongue-registration.npz');arrays['tongue_ids']=t['sourceNativeIDs'].astype('<u4');arrays['tongue_indices']=t['targetNativeTriangleVertices'].astype('<u4').ravel();arrays['tongue_bary']=t['barycentric'].astype('<f4').ravel()
aw=np.fromfile(G/'anny-eye-weights.f32','<f4').reshape(-1,2)
for eye in [0,1]:arrays[f'anny_eye_{eye}_ids']=np.flatnonzero(aw[:,eye]>.9).astype('<u4')
# MHR has one connected surface. Its visible caps are identified from the
# measured neutral eye aperture, retaining their exact source vertex IDs.
meta=json.loads((S/'mhr.json').read_text());landmarks={x['landmark']:x for x in meta['landmarks']};camera=meta['camera'];v=arrays['mhr_neutral'].reshape(-1,3);f=np.fromfile(G/'mhr-faces.u32','<u4').reshape(-1,3);centers=v[f].mean(1);norm=np.cross(v[f[:,1]]-v[f[:,0]],v[f[:,2]]-v[f[:,0]]);norm/=np.maximum(np.linalg.norm(norm,axis=1)[:,None],1e-20);uv=np.c_[.5+centers[:,0]/camera['extent'],.5-(centers[:,2]-camera['target'][1])/camera['extent']]
contours=[([466,388,387,386,385,384,398],[249,390,373,374,380,381,382]),([246,161,160,159,158,157,173],[7,163,144,145,153,154,155])]
for eye,(up,low)in enumerate(contours):
 poly=np.array([landmarks[i]['screen']for i in up+low[::-1]]);center=poly.mean(0);poly=center+.88*(poly-center);front=(norm@np.array([0,-1,0]))>.2;depth=np.mean([-landmarks[i]['nativeRestPoint'][2]/100 for i in up+low]);valid=Polygon(poly).contains_points(uv)&front&(centers[:,1]<depth+.015);ids=np.unique(f[valid]);assert len(ids)>=10;arrays[f'mhr_eye_{eye}_ids']=ids.astype('<u4')
sections={};raw=bytearray()
for name,a in arrays.items():
 a=np.ascontiguousarray(a);padding=(-len(raw))%8;raw.extend(b'\0'*padding);sections[name]={'dtype':a.dtype.str,'offset':len(raw),'length':a.size};raw.extend(a.tobytes())
packed=gzip.compress(bytes(raw),mtime=0);(O/'head-transfer.bin.gz').write_bytes(packed);manifest={'schema':'kaopu-semantic-head-adapter/1','version':'candidate-r4-components','gnmVertices':17821,'outerVertices':11402,'preservedCavityVertices':1064,'sourceCorrespondenceFrozenAcrossStates':True,'runtimeNearestSearch':False,'arrays':sections,'binary':{'byteLength':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'compressedBytes':len(packed),'compressedSha256':hashlib.sha256(packed).hexdigest()},'sourceLockSHA256':hashlib.sha256((R/'SOURCE-LOCK.json').read_bytes()).hexdigest(),'generators':['tools/register_head.py','tools/refine_head_correspondence.py','tools/probe_preserved_head_internals.py','tools/register_anny_tongue.py','tools/build_head_adapter.py'],'correspondenceReports':{n:json.loads((F/f'{n}-semantic-r4-report.json').read_text())for n in ['anny','mhr']},'accepted':False,'remaining':'All-channel and mixed-state runtime, native gaze/tongue, age, contact, intersection and real browser validation'};(O/'head-transfer.json').write_text(json.dumps(manifest,indent=2));print({'raw':len(raw),'gzip':len(packed),'eyeCapVertices':[len(arrays[f'mhr_eye_{e}_ids'])for e in [0,1]]})
