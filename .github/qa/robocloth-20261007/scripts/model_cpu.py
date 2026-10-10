"""Exact official inference classes loaded with validated, non-executable ZIP tensor descriptors."""
import json,sys,hashlib
from pathlib import Path
import numpy as np
import torch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'runtime_cpu/rendering'))
def load_model(path=None,material_type='AnisotropicLatentTexturedModel',**kwargs):
 assert material_type=='AnisotropicLatentTexturedModel';assert not kwargs.get('use_btf')
 from brdf_plugin.material.anisotropicLatent import AnisotropicLatentTexturedModel
 from omegaconf import OmegaConf
 cfg=OmegaConf.load(ROOT/'runtime_cpu/rendering/configs/material/AnisotropicLatentTexturedModel.yaml')
 layout=json.loads((ROOT/'reports/checkpoint-layout.json').read_text());path=Path(path or ROOT/'assets/checkpoints/stage2/RoboCloth/145/Ours_epoch112.ckpt')
 assert path.stat().st_size==layout['checkpoint_size']
 with torch.device('meta'):model=AnisotropicLatentTexturedModel(cfg)
 state={}
 for k,v in layout['tensors'].items():
  if not k.startswith('material.'):continue
  assert v['dtype']=='FloatStorage' and v['zip']['compression']==0
  a=np.memmap(path,dtype='<f4',mode='c',offset=v['zip']['data_offset'],shape=tuple(v['shape']))
  state[k[9:]]=torch.from_numpy(a)
 assert set(state)==set(model.state_dict())
 model.load_state_dict(state,strict=True,assign=True);model.eval();return model
if __name__=='__main__':
 import time
 torch.set_num_threads(2);t=time.time();m=load_model();print('model loaded',time.time()-t)
 torch.manual_seed(7);n=512;uv=torch.rand(n,2);wi=torch.nn.functional.normalize(torch.rand(n,3),dim=-1);wo=torch.nn.functional.normalize(torch.rand(n,3),dim=-1);normal=torch.tensor([0.,0.,1.]).expand(n,3);TBN=torch.eye(3).expand(n,3,3)
 with torch.no_grad():out=m.eval_brdf({},torch.zeros(n,3),wi,wo,normal,uv,TBN)
 report={'samples':n,'seconds':time.time()-t,'all_finite':all(torch.isfinite(x).all().item() for x in out),'ranges':[{'shape':list(x.shape),'min':x.min().item(),'max':x.max().item(),'mean':x.mean().item()} for x in out],'model_tensors':len(m.state_dict())}
 assert report['all_finite'];(ROOT/'reports/cpu-model-smoke.json').write_text(json.dumps(report,indent=2));print(report)
 np.savez(ROOT/'runs/parity-fixture.npz',uv=uv.numpy(),wi=wi.numpy(),wo=wo.numpy(),brdf=out[0].numpy(),normal=out[1].numpy(),offset=out[3].numpy())
