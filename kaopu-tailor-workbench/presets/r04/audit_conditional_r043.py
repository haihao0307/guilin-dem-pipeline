"""Verify controls in explicitly enabled source-program contexts, not via changing labels."""
from pathlib import Path
import os,sys,json,gzip,hashlib,copy,contextlib,io
R=Path(os.environ.get('R043_PATTERN_ROOT','/mnt/data/r043-python'));sys.path.insert(0,str(R));os.chdir(R/'runtime')
from pattern_catalogue import generatePattern
P=Path(__file__).resolve().parent
D=json.loads((P/'PARAMETER_AUDIT_R043.json').read_text());S=json.loads((P/'parameter-schema.json').read_text());schema={p['path']:p for p in S['parameters']}
source={p.name.split('.')[0]:json.loads(gzip.decompress(p.read_bytes())) for p in (P/'assets/papers').glob('*.json.gz')}
def setv(d,path,v):
 a=d
 for k in path.split('.')[:-1]:a=a[k]
 a[path.split('.')[-1]]['v']=v
def getv(d,path):
 for k in path.split('.'):d=d[k]
 return d['v']
def gen(d):
 with contextlib.redirect_stdout(io.StringIO()),contextlib.redirect_stderr(io.StringIO()):return generatePattern({'bodyCm':d['bodyCm'],'design':d['design'],'validateIntersections':True})
def gh(d):return hashlib.sha256(json.dumps([{k:p[k] for k in ['id','verticesMm','edges','placement']} for p in d['panels']],sort_keys=True,separators=(',',':')).encode()).hexdigest()
for row in D['rows']:
 if row['example']:continue
 k=row['path'];prefix='left.' if k.startswith('left.') else '';key=k.removeprefix('left.');activation={};id='T01';tests=[]
 if key.startswith('sleeve.'):
  id='T06';activation={'meta.upper':'Shirt',prefix+'shirt.strapless':False,prefix+'sleeve.sleeveless':False,prefix+'sleeve.sleeve_angle':42,prefix+'sleeve.standing_shoulder':True}
  if key in ['sleeve.armhole_shape','sleeve.smoothing_coeff']:activation.update({prefix+'sleeve.sleeveless':True,prefix+'sleeve.armhole_shape':'ArmholeAngle'})
  if key.startswith('sleeve.cuff.'):activation.update({prefix+'sleeve.cuff.type':'CuffBandSkirt',prefix+'sleeve.cuff.top_ruffle':1.2,prefix+'sleeve.length':.95})
 elif key.startswith('collar.'):
  id='T01';activation={'collar.component.style':None,'collar.fc_depth':.5,'collar.bc_depth':.5}
  side='b' if 'b_' in key or '.bc_' in key else 'f';activation[prefix+'collar.'+side+'_collar']='Bezier2NeckHalf' if ('bezier' in key or 'flip' in key) else 'CircleArcNeckHalf'
 elif key.startswith('flare-skirt.cut.'):
  id='S05';activation={'meta.bottom':'SkirtCircle','flare-skirt.cut.add':True,'flare-skirt.cut.depth':.4,'flare-skirt.cut.width':.12,'flare-skirt.cut.place':.35}
 elif key.startswith('godet-skirt.'):
  id='S13';activation={'meta.bottom':'GodetSkirt','godet-skirt.base':'Skirt2','godet-skirt.num_inserts':6,'godet-skirt.insert_w':10,'godet-skirt.insert_depth':15,'godet-skirt.cuts_distance':1,'skirt.length':.8}
 elif key.startswith('pants.cuff.'):
  id='P07';activation={'pants.cuff.type':'CuffBandSkirt','pants.cuff.cuff_len':.15,'pants.length':.8}
 if prefix:activation.update({'left.enable_asym':True,'shirt.strapless':False,'left.shirt.strapless':False})
 try:
  base=copy.deepcopy(source[id]);[setv(base['design'],x,v) for x,v in activation.items()];v=getv(base['design'],k);p=schema[k]
  vals=[not v] if p['type']=='bool' else [x for x in p['choices'] if x!=v] if p.get('choices') else [min(max(p['samplingRange']),v+(1 if p['type']=='int' else (max(p['samplingRange'])-min(p['samplingRange']))*.2)),max(min(p['samplingRange']),v-(1 if p['type']=='int' else (max(p['samplingRange'])-min(p['samplingRange']))*.2))]
  a=gen(base);ah=gh(a)
  for value in vals:
   if value==v:continue
   q=copy.deepcopy(base);setv(q['design'],k,value)
   try:
    b=gen(q);ok=b['validation']['analytic2DPass'] and a['validation']['analytic2DPass'];changed=gh(b)!=ah
    tests.append({'value':value,'paperValid':ok,'geometryChanged':changed,'errors':b['validation'].get('errors',[])})
    if ok and changed:
     row['status']='verified-with-explicit-activation';row['example']={'preset':id,'activationOverrides':activation,'from':v,'to':value,'beforeGeometrySHA256':ah,'afterGeometrySHA256':gh(b),'recipeHash':b['recipeHash'],'baselineRegeneratedInSameRuntime':True,'notOriginalCachedGarment':True};break
   except Exception as e:tests.append({'value':value,'error':str(e)[:200]})
 except Exception as e:tests.append({'error':str(e)[:240]})
 row['conditionalTests']={'preset':id,'activationOverrides':activation,'attempts':tests}
 print(k,row['status'],flush=True)
 (P/'PARAMETER_AUDIT_R043.json').write_text(json.dumps(D,ensure_ascii=False,indent=2))
D['verifiedParameters']=sum(bool(r['example']) for r in D['rows']);D['conditionalParameters']=sum(r['status']=='verified-with-explicit-activation' for r in D['rows']);D['notDemonstrated']=[r['path'] for r in D['rows'] if not r['example']];D['sameRuntimeBaselineComparison']=True
D['catalogueIdentityWarnings']=[{'preset':i,'advertisedStyle':source[i].get('style'),'actualBottomGenerator':source[i]['design']['meta']['bottom']['v'],'warning':'Godet controls are inactive in the preserved paper. Selecting meta.bottom=GodetSkirt generates a new, explicitly identified variant; it does not relabel the old geometry.'} for i in ['S13','D09']]
(P/'PARAMETER_AUDIT_R043.json').write_text(json.dumps(D,ensure_ascii=False,indent=2));print('VERIFIED',D['verifiedParameters'],'/',D['parameterCount'],D['notDemonstrated'])
