"""Weather Mother LOCAL mirror and domain validator 0.1.0.
The upstream Schema, upstream validator and original byte hash were not supplied.
"""
from pathlib import Path
import json,hashlib,sys,copy,math,importlib.metadata
from jsonschema import Draft202012Validator
R=Path(__file__).resolve().parent
PINS={'policy.json':'80aef698e30a6378e25d6eeb7c6ee67c1df24e6ae96faef5f4df4ef62d19c8d3','policy.schema.json':'b6f2d496a12f48c58b26051907b67ae247d193db1d3aed31ea4ae3ec084efa6e','profile.schema.json':'5b91645690002570cd4107883243e7ca1c32f0c7e6ecdfdf027931557884db29'}
def no_duplicates(pairs):
 d={}
 for k,v in pairs:
  if k in d:raise ValueError('Duplicate key '+k)
  d[k]=v
 return d
def load(s):
 obj=json.loads(s,object_pairs_hook=no_duplicates,parse_constant=lambda v:(_ for _ in ()).throw(ValueError(v)))
 def finite(x):
  if isinstance(x,float) and not math.isfinite(x):raise ValueError('Nonfinite')
  if isinstance(x,dict):
   for v in x.values():finite(v)
  if isinstance(x,list):
   for v in x:finite(v)
 finite(obj);return obj
checks=[]
def check(n,v):
 checks.append({'name':n,'pass':bool(v)})
 if not v:raise AssertionError(n)
def rejected(f):
 try:f()
 except Exception:return True
 return False
for n,sha in PINS.items():check('identity '+n,hashlib.sha256((R/n).read_bytes()).hexdigest()==sha)
p=load((R/'policy.json').read_text());schema=load((R/'policy.schema.json').read_text());domain=load((R/'profile.schema.json').read_text());profile=load((R/'profile.json').read_text())
Draft202012Validator.check_schema(schema);Draft202012Validator.check_schema(domain)
v=Draft202012Validator(schema);d=Draft202012Validator(domain)
check('policy document matches local strict mirror',v.is_valid(p));check('domain profile valid',d.is_valid(profile))
def leaves(value,path=()):
 if isinstance(value,dict):
  for k,v in value.items():yield from leaves(v,path+(k,))
 else:yield path,value
for path,val in leaves(p):
 x=copy.deepcopy(p);target=x
 for k in path[:-1]:target=target[k]
 target[path[-1]]=(not val) if isinstance(val,bool) else ['unauthorized'] if isinstance(val,list) else 'tampered'
 check('reject core modification '+'.'.join(path),not v.is_valid(x))
for path in [(),('authority',),('presentation','neutralInspection')]:
 x=copy.deepcopy(p);obj=x
 for k in path:obj=obj[k]
 obj['override']=True;check('reject unknown field '+str(path),not v.is_valid(x))
for name,source in [('duplicate','{"a":1,"a":2}'),('NaN','{"a":NaN}'),('Infinity','{"a":1e999}')]:check('reject '+name,rejected(lambda:load(source)))
for key,bad in [('humidity',1.1),('cloudSpeedMps',-1),('masterSeed',-1),('visualApproved',True),('productionApproved',True),('motherId','Ocean Mother')]:
 x={**profile,key:bad};check('reject domain '+key,not d.is_valid(x))
for name in ['policy.json','policy.schema.json','profile.schema.json','guard.js','state.js','runtime.js','view.glsl']:
 check('file exists '+name,(R/name).is_file())
report={'status':'LOCAL_MIRROR_DOCUMENT_VALID','scope':'source-derived policy plus local mirror only; not upstream validator test results','jsonschemaVersion':importlib.metadata.version('jsonschema'),'checks':checks,'count':len(checks),'policySha256':PINS['policy.json'],'schemaSha256':PINS['policy.schema.json'],'validatorSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'upstreamSchemaSha256':None,'upstreamValidatorSha256':None,'upstreamCompanionsVerified':False,'visualApproved':False,'productionApproved':False}
(R/'POLICY_TESTS.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(report['status'],len(checks),'checks')
