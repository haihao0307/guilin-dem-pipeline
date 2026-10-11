"""Copy only fixed, reviewed R12 runtime dependencies; never mutate old paths."""
from pathlib import Path
import shutil,hashlib,json
p=Path(__file__).parent;b=p.parent/'r12'
modules=['GNMModel.js','SemanticSampler.js','ScalpBinding.js','HairLayer.js','RegionFields.js','FusionFields.js','StrandCore.js','TeacherGroomBinding.js','MakeHumanBrows.js','FiberMaterial.js','HairOpacityShadows.js','RenderGate.js','AssetLoader.js']
(p/'src').mkdir(exist_ok=True)
records=[]
for name in modules:
 data=(b/'src'/name).read_bytes()
 records.append({'path':'src/'+name,'baseSha256':hashlib.sha256(data).hexdigest(),'change':'export FullerScalpBinding only' if name=='HairLayer.js' else 'unchanged'})
 if name=='HairLayer.js':data=data.replace(b'class FullerScalpBinding extends',b'export class FullerScalpBinding extends')
 (p/'src'/name).write_bytes(data)
for folder in ['vendor','licenses']:
 shutil.copytree(b/folder,p/folder,dirs_exist_ok=True)
(p/'data').mkdir(exist_ok=True)
for name in ['BrowData.js','BROW_PROVENANCE.json']:shutil.copy2(b/'data'/name,p/'data'/name)
(p/'BASE_LOCK.json').write_text(json.dumps({'commit':'5d420df72b94c089d38be934a02aa4b8323404fc','modules':records,'teacherHairDataImported':False,'oldFemaleRuntimeImported':False},indent=2))
