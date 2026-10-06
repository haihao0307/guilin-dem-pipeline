from pathlib import Path
import torch,time,json
R=Path(__file__).resolve().parents[1]
torch.set_num_threads(2);t=time.time()
p=R.parent/'mhr-workbench-20261006/official/assets/mhr_model.pt'
print('load',p,flush=True);m=torch.jit.load(str(p),map_location='cpu').eval();print('loaded',time.time()-t,flush=True)
print('methods',m._c._method_names(),flush=True)
print('params',list(m.get_parameter_names()),flush=True);print('identity',m.get_num_identity_blendshapes(),flush=True);print('joints',list(m.get_joint_names()),flush=True);print('forward',m.forward.schema,flush=True)
