"""Execute pristine upstream imports independently of the runtime adapter."""
from pathlib import Path
import sys,json,os,math,contextlib,io,hashlib
ROOT=Path(__file__).resolve().parents[1]
os.environ['MPLCONFIGDIR']=str(ROOT/'reports/mpl-cache')
sys.path.insert(0,str(ROOT/'native-extra'));sys.path.insert(0,str(ROOT/'upstream'));os.chdir(ROOT/'upstream')
from assets.bodies.body_params import BodyParameters
from assets.garment_programs.meta_garment import MetaGarment
import numpy as np

def canonical(p):
 return {'panels':p['panels'],'stitches':sorted(p['stitches'],key=lambda s:json.dumps(s,sort_keys=True))}
def compare(a,b,path='',diffs=None):
 diffs=[] if diffs is None else diffs
 if isinstance(a,(float,int,np.number)) and not isinstance(a,bool) and isinstance(b,(float,int,np.number)):
  if abs(float(a)-float(b))>1e-9:diffs.append({'path':path,'a':float(a),'b':float(b),'absDiff':abs(float(a)-float(b))})
 elif type(a)!=type(b):diffs.append({'path':path,'typeA':type(a).__name__,'typeB':type(b).__name__})
 elif isinstance(a,dict):
  if a.keys()!=b.keys():diffs.append({'path':path,'keysA':list(a),'keysB':list(b)})
  for k in a.keys()&b.keys():compare(a[k],b[k],path+'.'+k,diffs)
 elif isinstance(a,list):
  if len(a)!=len(b):diffs.append({'path':path,'lengthA':len(a),'lengthB':len(b)})
  for i,(x,y) in enumerate(zip(a,b)):compare(x,y,path+f'[{i}]',diffs)
 elif a!=b:diffs.append({'path':path,'a':a,'b':b})
 return diffs
rows=[]
for f in sorted((ROOT/'examples').glob('*-default.json')):
 a=json.loads(f.read_text());bp=object.__new__(BodyParameters);bp.params=a['bodyCm'].copy();bp.eval_dependencies()
 with contextlib.redirect_stdout(io.StringIO()):
  g=MetaGarment('generated',bp,a['design']);g.assert_non_empty();g.assert_skirt_waistband();g.assert_total_length();oracle=g.assembly().spec
 # Normalize NumPy scalar representations, preserve all JSON content.
 oracle=json.loads(json.dumps(oracle,default=lambda v:v.tolist() if hasattr(v,'tolist') else v.item()))
 diffs=compare(canonical(oracle['pattern']),canonical(a['officialOracleCm']['pattern']))
 row={'style':f.name[:-13],'differences':diffs,'pass':len(diffs)==0,'comparisonToleranceCm':1e-9,'panels':len(oracle['pattern']['panels']),'stitches':len(oracle['pattern']['stitches'])};rows.append(row);print(json.dumps(row),flush=True)
 (ROOT/'reports/source-oracle-diff.json').write_text(json.dumps({'source':'pristine upstream files including original VisPattern renderer import','commit':'d449629979028123a5c4dc9e732a2ec19b7fce31','orderingNormalization':'panel keys and stitch ordering only','rows':rows},indent=2))
