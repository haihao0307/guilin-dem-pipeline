import os
os.environ['WARP_CACHE_PATH']=os.path.join(os.path.dirname(os.path.abspath(__file__)),'warp-cache')
os.environ['HF_HUB_OFFLINE']='1'
os.environ['HF_HUB_DISABLE_TELEMETRY']='1'
import time,json,math,hashlib,platform,importlib.metadata
from pathlib import Path
import torch
from soma.body.soma import SOMALayer
base=Path(__file__).resolve().parent
manifest=json.loads((base/'ASSET-VERIFICATION.json').read_text())
for asset in manifest['files']:
 data=(base/'assets'/asset['name']).read_bytes()
 assert len(data)==asset['bytes'] and hashlib.sha256(data).hexdigest()==asset['sha256'],asset['name']
torch.set_num_threads(4)
t=time.perf_counter()
layer=SOMALayer(data_root=str(base/'assets'),identity_model_type='soma',device='cpu',mode='torch',correctives_model_path=None,lod='low')
report={'package':importlib.metadata.version('py-soma-x'),'torch':torch.__version__,'python':platform.python_version(),'lod':'low','device':'cpu','identity_model':'soma','correctives':False,'initialization_seconds':time.perf_counter()-t,'shape_components':layer.num_shape_components,'checks':[]}
def check(name,condition,**evidence):
 report['checks'].append(dict(name=name,passed=bool(condition),**evidence));assert condition,(name,evidence)
def diff(a,b):return float((a-b).abs().max())
with torch.inference_mode():
 p=torch.zeros(1,77,3);identity=torch.zeros(1,layer.num_shape_components)
 t=time.perf_counter();zero=layer(p,identity,apply_correctives=False);report['first_forward_seconds']=time.perf_counter()-t
 report['shapes']={k:list(v.shape) for k,v in zero.items() if isinstance(v,torch.Tensor)}
 check('native_topology',list(zero['vertices'].shape)==[1,4505,3] and list(zero['joints'].shape)==[1,77,3] and list(zero['transforms'].shape)==[1,78,4,4])
 for k in ['vertices','joints','transforms']:check('finite_'+k,torch.isfinite(zero[k]).all().item())
 layer.prepare_identity(identity);cached=layer.pose(p,apply_correctives=False)
 for k in ['vertices','joints','transforms']:check('cached_parity_'+k,diff(zero[k],cached[k])<1e-6,max_error=diff(zero[k],cached[k]))
 repeated=layer.pose(p,apply_correctives=False)
 check('determinism',diff(cached['vertices'],repeated['vertices'])==0,max_error=diff(cached['vertices'],repeated['vertices']))
 names=list(map(str,layer._public_joint_names));report['public_joint_names']=names
 joint=names.index('LeftForeArm');report['single_joint']={'name':names[joint],'transform_index':joint,'pose_index':joint-1}
 for axis in range(3):
  for sign in [-1,1]:
   pose=p.clone();pose[0,joint-1,axis]=sign*math.radians(10);out=layer.pose(pose,apply_correctives=False)
   rot=out['transforms'][0,joint,:3,:3]@zero['transforms'][0,joint,:3,:3].T
   angle=math.degrees(math.acos(float(torch.clamp((torch.trace(rot)-1)/2,-1,1))))
   delta=diff(out['vertices'],zero['vertices'])
   check(f'joint_rotation_{axis}_{sign}',abs(angle-10)<0.02 and delta>1e-5,angle_degrees=angle,max_vertex_delta_m=delta)
   check(f'unchanged_hips_{axis}_{sign}',diff(out['transforms'][:,1],zero['transforms'][:,1])<1e-6)
 shift=torch.tensor([[0.13,0.27,-0.09]])
 moved=layer.pose(p,transl=shift,apply_correctives=False)
 for k in ['vertices','joints']:check('root_translation_'+k,diff(moved[k]-zero[k],shift[:,None,:])<2e-6,max_error_m=diff(moved[k]-zero[k],shift[:,None,:]))
 check('virtual_root_identity',diff(moved['transforms'][:,0],torch.eye(4)[None])<1e-6)
 report['zero_vertices_sha256']=hashlib.sha256(zero['vertices'].numpy().tobytes()).hexdigest()
 report['elapsed_seconds']=time.perf_counter()-t
report['asset_revision']=manifest['revision']
report['upstream_core_sha256']=hashlib.sha256(Path(__import__('soma.body.soma',fromlist=['']).__file__).read_bytes()).hexdigest()
report['source_commit']='d6aa640f7787498009c4e3d57fcc14a243905d10'
report['other_attempts']=[{'lod':'mid','exit_code':137,'result':'Killed; memory pressure suspected, not confirmed'}]
report['passed']=all(x['passed'] for x in report['checks'])
(base/'SOMA-CPU-QA.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
