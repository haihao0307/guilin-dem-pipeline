from pathlib import Path
import os,time,json
R=Path(__file__).resolve().parents[1]
os.environ['ANNY_CACHE_DIR']=str(R/'research/soma-cache')
import warp
warp.config.kernel_cache_dir=str(R/'research/warp-cache')
import anny,torch,numpy as np
from anny.models.soma import SOMA_ASSETS_REVISION
torch.set_num_threads(2)
t=time.time();print('START',anny.__version__,SOMA_ASSETS_REVISION,flush=True)
m=anny.Anny(rig='soma',topology='soma',local_changes='none',facial_actions='none',phenotypes='default',skinning_method='lbs').float();m.eval()
print('BUILT',time.time()-t,m.template_vertices.shape,m.faces.shape,m.bone_count,flush=True)
arrays={'faces':m.faces.numpy()};cases={}
for name,params in [('neutral',{'age':2/3}),('child',{'age':1/3}),('old',{'age':1}),('heavy',{'age':2/3,'weight':.9})]:
 with torch.no_grad():out=m(phenotype_kwargs=params)
 v=out['vertices'][0].numpy();arrays[name]=v
 cases[name]={'vertices':len(v),'bounds':[v.min(0).tolist(),v.max(0).tolist()],'allFinite':bool(np.isfinite(v).all())}
np.savez_compressed(R/'research/anny-soma-experiment.npz',**arrays)
report={'annyVersion':anny.__version__,'somaPinnedAssets':SOMA_ASSETS_REVISION,'somaPinnedPackage':'0.1.0','vertices':len(m.template_vertices),'faces':len(m.faces),'bones':m.bone_count,'boneLabels':m.bone_labels,'cases':cases,'seconds':time.time()-t,'matchesLatestSoma':False,'explanation':'Official pinned Anny SOMA conversion only; MHR backend comparison still separate.'}
(R/'research/anny-soma-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
