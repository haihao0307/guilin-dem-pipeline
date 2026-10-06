"""Read official local MHR TorchScript; export bounded synthetic transfer fixtures."""
from pathlib import Path
import torch,numpy as np,json,time,hashlib
R=Path(__file__).resolve().parents[1];torch.set_num_threads(2);m=torch.jit.load(str(R.parent/'mhr-workbench-20261006/official/assets/mhr_model.pt'),map_location='cpu').eval();names=list(m.get_parameter_names())[:-45];jn=list(m.get_joint_names());faces=m.character_torch.mesh.faces.detach().cpu().numpy();arrays={'faces':faces};cases=[]
for name,id0,pose in [('neutral',0,{}),('identity0_plus',1,{}),('identity0_minus',-1,{}),('identity0_half',.5,{}),('left_elbow',0,{'l_elbow_bend':.8}),('left_elbow_half',0,{'l_elbow_bend':.4}),('shoulder_width',0,{'scale_shoulder_width':.1})]:
 identity=torch.zeros((1,45));identity[0,0]=id0;params=torch.zeros((1,len(names)));expr=torch.zeros((1,72))
 for k,v in pose.items():params[0,names.index(k)]=v
 with torch.inference_mode():v,s=m(identity,params,expr,True)
 v=v[0].numpy()/100.;s=s[0].numpy();s[:,:3]/=100
 arrays[name]=v;arrays[name+'_skeleton']=s;cases.append({'name':name,'identity0':id0,'parameters':pose,'vertices':len(v),'bounds':[v.min(0).tolist(),v.max(0).tolist()]})
np.savez_compressed(R/'research/mhr-samples.npz',**arrays);report={'sourceCommit':'d96fafa33bbf018647c70c3525e91f53e79d2a14','modelSHA256':hashlib.sha256((R.parent/'mhr-workbench-20261006/official/assets/mhr_model.pt').read_bytes()).hexdigest(),'faces':len(faces),'parameterNames':names,'jointNames':jn,'cases':cases};(R/'research/mhr-samples.json').write_text(json.dumps(report,indent=2));print(json.dumps({'cases':cases,'selectedJoints':{n:arrays['neutral_skeleton'][jn.index(n)].tolist() for n in ['root','c_head','c_neck','l_uparm','l_lowarm','l_wrist','r_uparm','l_upleg','l_lowleg','l_foot']}}),flush=True)
