import os,json,hashlib,math
from pathlib import Path
import argparse,importlib.metadata
parser=argparse.ArgumentParser();parser.add_argument('--assets',required=True);parser.add_argument('--output',required=True);parser.add_argument('--cache',required=True);parser.add_argument('--preview');args=parser.parse_args()
base=Path(args.output).resolve().parent;assets=Path(args.assets).resolve();base.mkdir(parents=True,exist_ok=True)
assert assets.is_dir(),'Explicit existing native asset directory required'
os.environ['HF_HUB_OFFLINE']='1';os.environ['WARP_CACHE_PATH']=str(Path(args.cache).resolve())
import torch
from soma.body.soma import SOMALayer
assert importlib.metadata.version('py-soma-x')=='0.3.3'
manifest=json.loads((Path(__file__).resolve().parent.parent/'soma-cpu-r01/ASSET-VERIFICATION.json').read_text())
for asset in manifest['files']:
 data=(assets/asset['name']).read_bytes();assert len(data)==asset['bytes'] and hashlib.sha256(data).hexdigest()==asset['sha256']
torch.set_num_threads(4)
layer=SOMALayer(data_root=str(assets),identity_model_type='soma',device='cpu',mode='torch',lod='low',correctives_model_path=None)
names=list(map(str,layer.public_joint_names));p=torch.zeros(1,77,3);identity=torch.zeros(1,128);rows=[]
with torch.inference_mode():
 z=layer(p,identity,apply_correctives=False)
 def capture(label,pose,translation):
  o=layer.pose(pose,transl=translation,apply_correctives=False)
  return {'label':label,'inputPoseAxisAngleRadians':pose[0].tolist(),'inputRootMetres':translation[0].tolist(),'transforms':o['transforms'][0].tolist(),'joints':o['joints'][0].tolist()}
 rows.append(capture('zero',p,torch.zeros(1,3)))
 for axis in range(3):
  for sign in [-1,1]:
   q=p.clone();q[0,names.index('LeftForeArm')-1,axis]=sign*math.radians(10);rows.append(capture(f'forearm_{axis}_{sign}',q,torch.zeros(1,3)))
 rows.append(capture('root_translation',p,torch.tensor([[.13,.27,-.09]])))
 for axis in range(3):
  q=p.clone();q[0,0,axis]=math.radians(10);rows.append(capture(f'root_rotation_{axis}',q,torch.zeros(1,3)))
 q=p.clone();q[0,0,1]=math.radians(15);q[0,names.index('LeftForeArm')-1,2]=math.radians(30);rows.append(capture('combined_root_arm',q,torch.tensor([[.13,.27,-.09]])))
 report={'schema':'soma-native-diagnostic-frames/1','source':'official-SOMA-X-analytical','sourceCommit':'d6aa640f7787498009c4e3d57fcc14a243905d10','neuralInferenceExecuted':False,'identity':'native-zero-128','lod':'low','coordinates':{'up':'+Y','forward':'+Z','units':'metres','matrixOrder':'row-major','vectors':'column'},'names':names,'parents':[-1]+layer.public_joint_parent_ids.cpu().tolist()[1:],'frames':rows,'note':'Independent diagnostic poses, NOT a continuous motion clip or learned boxing action.'}
 Path(args.output).write_text(json.dumps(report,indent=2))
print('Wrote',len(rows),'actual native diagnostic poses to',args.output)

if args.preview:
 import numpy as np
 with torch.inference_mode():
  final=layer.pose(q,transl=torch.tensor([[.13,.27,-.09]]),apply_correctives=False)
  np.savez(args.preview,zero=z['vertices'].numpy()[0],combined=final['vertices'].numpy()[0],faces=layer.faces.numpy())
