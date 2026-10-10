"""Actual teacher-program parameter perturbation. A stored number is not an effective control."""
from pathlib import Path
import os,sys,json,gzip,hashlib,time,copy,contextlib,io
R=Path(os.environ.get('R043_PATTERN_ROOT','/mnt/data/r043-python'))
sys.path.insert(0,str(R));os.chdir(R/'runtime')
from pattern_catalogue import generatePattern,parameterSchema
P=Path(__file__).resolve().parent;schema=parameterSchema()
def stable(x):return json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False)
def geom(d):
 # Ignore recipe/diagnostics hashes. Compare only actual cutting geometry and placement.
 return hashlib.sha256(stable([{k:p[k] for k in ('id','verticesMm','edges','placement')} for p in d['panels']]).encode()).hexdigest()
def setv(d,path,value):
 a=d
 for k in path.split('.')[:-1]:a=a[k]
 a[path.split('.')[-1]]['v']=value
def getv(d,path):
 for k in path.split('.'):d=d[k]
 return d['v']
def generate(q):
 with contextlib.redirect_stdout(io.StringIO()),contextlib.redirect_stderr(io.StringIO()):return generatePattern(q)
rows=[]
for path in sorted((P/'assets/papers').glob('*.json.gz')):
 d=json.loads(gzip.decompress(path.read_bytes()));rows.append((path.name.split('.')[0],d))
baseline={}
for i,d in rows:
 q={"bodyCm":d["bodyCm"],"design":d["design"],"validateIntersections":True};baseline[i]=geom(generate(q))
 print("BASELINE",i,flush=True)
def preferred(path):
 if path.startswith('pants.'):return ['P01','P05','P06','P07','P10','J02']
 if path.startswith('pencil-skirt.'):return ['S03','S04','S14','S13']
 if path.startswith('flare-skirt.'):return ['S05','S06','S07','S08','S09','S10','D05']
 if path.startswith('levels-skirt.'):return ['S11','S12','D08']
 if path.startswith('godet-skirt.'):return ['S13','D09']
 if path.startswith('skirt.'):return ['S01','S02','D01','S11']
 if path.startswith('waistband.'):return ['P01','P09','S01','D01']
 if path.startswith('left.'):return ['T15','D11','T18']
 if path.startswith('sleeve.cuff.'):return ['T11','T12','T13']
 if path.startswith('sleeve.'):return ['T06','T07','T05','T08','T11','T15','T01']
 if path.startswith('collar.component.hood'):return ['T10','D12']
 if path.startswith('collar.component.'):return ['T08','T09','T10']
 if path.startswith('collar.'):return ['T01','T02','T03','T04','T17','T18','T16','T09']
 if path.startswith('shirt.'):return ['T01','T05','T14','T02']
 return [i for i,_ in rows]
source=dict(rows);results=[];start=time.perf_counter()
for param in schema['parameters']:
 key=param['path'];attempts=[];effect=None;ids=preferred(key)
 for id in ids:
  d=source[id];v=getv(d['design'],key);vals=[]
  if param['type'] in ('int','float'):
   lo,hi=min(param['samplingRange']),max(param['samplingRange']);step=1 if param['type']=='int' else max((hi-lo)*.12,.01)
   vals=[min(hi,v+step),max(lo,v-step)]
  elif param['type']=='bool':vals=[not v]
  else:vals=[x for x in param['choices'] if x!=v]
  for value in vals[:3]:
   if value==v:continue
   design=copy.deepcopy(d['design']);setv(design,key,value)
   try:
    q={'bodyCm':d['bodyCm'],'design':design,'validateIntersections':True};out=generate(q);valid=out['validation']['analytic2DPass'];h=geom(out);changed=h!=baseline[id]
    attempts.append({'preset':id,'value':value,'geometryChanged':changed,'paperValid':valid,'errors':out['validation'].get('errors',[])})
    if changed and valid:effect={'preset':id,'from':v,'to':value,'beforeGeometrySHA256':baseline[id],'afterGeometrySHA256':h,'recipeHash':out['recipeHash'],'sourcePaperValidation':out['validation']};break
   except Exception as e:attempts.append({'preset':id,'value':value,'error':str(e)[:240]})
  if effect:break
 results.append({'path':key,'type':param['type'],'status':'verified-source-geometry-control' if effect else 'not-demonstrated-in-tested-contexts','example':effect,'attempts':attempts,'solverFitCertified':False})
 print(key,results[-1]['status'],effect['preset'] if effect else '',flush=True)
 (P/'PARAMETER_AUDIT_R043.json').write_text(json.dumps({'schema':'native-parameter-perturbation@1','sourceCommit':schema['sourceCommit'],'elapsedSeconds':time.perf_counter()-start,'complete':len(results)==len(schema['parameters']),'parameterCount':len(schema['parameters']),'rows':results,'allParametersAlwaysActive':False,'allAlteredGarmentsFitCertified':False},ensure_ascii=False,indent=2))
(P/'parameter-schema.json').write_text(json.dumps(schema,ensure_ascii=False,separators=(',',':')))
