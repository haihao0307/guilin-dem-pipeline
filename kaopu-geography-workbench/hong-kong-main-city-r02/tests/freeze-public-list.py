# Freeze only this independently scoped public case. Local full archives are not uploaded.
from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent.parent
excludedPrefixes=('city-buildings/data/','city-buildings/data-packed/')
excludedFiles={'PUBLIC-FILES.json','ASSET-FILES.json','QA-ASSET-INVENTORY.json','tests/freeze-city-buildings-snapshot.mjs','tests/pack-city-buildings-snapshot.mjs'}
def record(p):
 b=p.read_bytes();return {'path':p.relative_to(R).as_posix(),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def included(p):
 s=p.relative_to(R).as_posix();return p.is_file() and s not in excludedFiles and not s.startswith(excludedPrefixes) and '__pycache__' not in p.parts
files=sorted((p for p in R.rglob('*') if included(p)),key=lambda p:p.relative_to(R).as_posix())
assets=[record(p)for p in files if p.relative_to(R).as_posix().startswith(('city-buildings/data-historical/','city-buildings/datum/','outer-terrain/data/'))or p.relative_to(R).as_posix()in('ocean/water-mask.u8.gz','ocean/mask-manifest.json')]
asset={'schema':'immutable-minimal-asset-list/2','target':'kaopu-geography-workbench/hong-kong-main-city-r02','historicalObjects':713,'fullModernGeometryArchivePublished':False,'files':assets,'totalBytes':sum(f['bytes']for f in assets)}
(R/'ASSET-FILES.json').write_text(json.dumps(asset,indent=2)+'\n')
files.append(R/'ASSET-FILES.json');items=sorted((record(p)for p in files),key=lambda p:p['path'])
manifest={'schema':'scoped-public-file-list/2','target':'kaopu-geography-workbench/hong-kong-main-city-r02','files':items,'totalBytes':sum(f['bytes']for f in items),'selfIncludedSeparately':True,'externalDependencies':'FIXED-DEPENDENCIES.json','qaWorkflowTarget':'.github/workflows/hong-kong-main-city-r01.yml','publicHistoricalObjects':713,'publishedCatalogue':'113 complete original tile entries + 2 selected historical subsets','excludedLocalArchives':list(excludedPrefixes),'noPrivateReferenceImages':True,'noFullModernGeometryArchive':True}
(R/'PUBLIC-FILES.json').write_text(json.dumps(manifest,indent=2)+'\n')
for p in (R/'PUBLIC-FILES.json',R/'ASSET-FILES.json'):
 b=p.read_bytes();d=json.loads(b);print(p.name,len(d['files']),d['totalBytes'],'receipt_bytes',len(b),'sha256',hashlib.sha256(b).hexdigest())
