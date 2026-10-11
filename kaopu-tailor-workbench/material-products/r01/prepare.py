from pathlib import Path
from urllib.request import Request,urlopen
import hashlib,json,time,re,os
P=Path(__file__).resolve().parent
RAW='https://raw.githubusercontent.com/'
TAILOR='haihao0307/guilin-dem-pipeline/8c8245dd87e5fdf0e2a7720a96776743134ab17a/kaopu-tailor-workbench/presets/r04/'
def digest(b):return hashlib.sha256(b).hexdigest()
def read(url,expected=None):
 for n in range(4):
  try:
   with urlopen(Request(url,headers={'User-Agent':'KAOPU-MP01'}),timeout=90) as r:b=r.read()
   if expected:assert digest(b)==expected,(url,'Source hash mismatch')
   return b
  except Exception:
   if n==3:raise
   time.sleep(2+n)
def put(name,data):
 t=P/name;t.parent.mkdir(parents=True,exist_ok=True);t.write_bytes(data)
inputs={}
def acquire(repo_path,name,expected=None):
 b=read(RAW+repo_path,expected);put(name,b);inputs[name]={'url':RAW+repo_path,'sha256':digest(b),'bytes':len(b)};return b
for name in ['outfits-r043.mjs','source-contract.mjs','sewn-normals-r0433.mjs']:acquire(TAILOR+name,name)
identity=json.loads(acquire(TAILOR+'assets/identity.json','native/identity.json'))
index=json.loads(read(RAW+TAILOR+'assets/results/index.json'));clothes={}
for id in ['T01','T03','T08','T17','P01','P02','P04']:
 row=index['rows'][id];assert row['qualityPassed'],id
 b=acquire(TAILOR+'assets/results/'+row['file'],'native/'+id+'.json.gz',row['sha256']);clothes[id]={'path':'native/'+id+'.json.gz','sha256':digest(b),'originalResultURL':RAW+TAILOR+'assets/results/'+row['file'],'sourceStaticPassed':True}
receipt=json.loads((P/'EXPORT_SOURCE_RECEIPT.json').read_text());fields=json.loads((P/'EXPORT_FIELDS_REPORT.json').read_text());materials=json.loads((P/'materials.json').read_text())
assert receipt['knitCommit']=='20b466073bb458408a078260a018460c81f627b9' and receipt['leatherCommit']=='af389cc216ddd01e3b1aa66c972f42b2587bc797' and receipt['denimCommit']=='fa143743b1b0f3d74ff827664d06ff119ef87063'
assert receipt['privateSourceIncludedInPublicOutput'] is False and fields['passed'] and len(materials)==12 and fields['maps']==40
for m in materials:
 assert all(0<x<200 for x in m['tileMM'])
 for r in m['files'].values():assert digest((P/r['path']).read_bytes())==r['sha256'],r['path']
lock={'schema':'kaopu.material-products@1','version':'MP01','tailorSourceCommit':'8c8245dd87e5fdf0e2a7720a96776743134ab17a','tailorRuntimeEntry':'https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/presets/r0434-8c8245dd87e5/','sources':{'knit':{'repository':'haihao0307/Human-Fabric-Workbench','commit':receipt['knitCommit'],'directory':'previews/raywave-fabric-r11','sourceRemainsPrivate':True},'leather':{'repository':'haihao0307/Humanoid-Rig-Lab-Next','commit':receipt['leatherCommit'],'directory':'leather-workshop/r10'},'denim':{'repository':'haihao0307/Humanoid-Rig-Lab-Next','commit':receipt['denimCommit'],'directory':'denim-workshop/r07'}},'person':identity,'garments':clothes,'inputFiles':inputs,'materialExportReceipt':receipt,'garmentVertexChanges':False,'sourceWorkbenchChanged':False,'materialPhysicsCalibrated':False,'jointOutfitCollisionCertified':False,'garmentUV':'Original millimetre cutting coordinates; +Y is inherited adapter grain convention, not measured manufacturer grain'}
put('SOURCE_LOCK.json',json.dumps(lock,ensure_ascii=False,indent=2).encode())
# A context restoration must also regenerate the procedural environment, not display stale GPU data.
p=P/'app.mjs';t=p.read_text();old="else{o.intensity*=.65;o.color.set(0xffffff);}";new="else{o.intensity=o.position.x<0?2.08:1.69;o.color.set(0xffffff);}"
if old in t:assert t.count(old)==1;t=t.replace(old,new)
old="controls();viewer.renderer.setClearColor('#d0d3d0');items.forEach(it=>it.material.needsUpdate=true);viewer.render();"
new="controls();env?.dispose();studio();viewer.renderer.setClearColor('#d0d3d0');items.forEach(it=>it.material.needsUpdate=true);viewer.render();"
if old in t:assert t.count(old)==1;t=t.replace(old,new)
p.write_text(t)
print('PINNED_INPUTS_READY',len(clothes),'garments',len(materials),'materials',flush=True)
