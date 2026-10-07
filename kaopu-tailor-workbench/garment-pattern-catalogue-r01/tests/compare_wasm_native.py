from pathlib import Path
import json,math,numpy,scipy
ROOT=Path(__file__).resolve().parents[1]
def ordered(p):return {'panels':p['panels'],'stitches':sorted(p['stitches'],key=lambda s:json.dumps(s,sort_keys=True))}
def scan(a,b,path='',nums=None,struct=None):
 nums=[] if nums is None else nums;struct=[] if struct is None else struct
 if isinstance(a,(int,float)) and isinstance(b,(int,float)):
  if abs(a-b)>1e-12:nums.append({'path':path,'delta':abs(a-b),'native':a,'wasm':b})
 elif type(a)!=type(b):struct.append({'path':path,'a':str(a),'b':str(b)})
 elif isinstance(a,dict):
  if a.keys()!=b.keys():struct.append({'path':path,'a':list(a),'b':list(b)})
  for k in a.keys()&b.keys():scan(a[k],b[k],path+'.'+k,nums,struct)
 elif isinstance(a,list):
  if len(a)!=len(b):struct.append({'path':path,'a':len(a),'b':len(b)})
  for i,(x,y) in enumerate(zip(a,b)):scan(x,y,path+f'[{i}]',nums,struct)
 elif a!=b:struct.append({'path':path,'a':a,'b':b})
 return nums,struct
rows=[]
for f in (ROOT/'examples').glob('*-wasm.json'):
 style=f.name[:-10];a=json.loads((ROOT/f'examples/{style}-default.json').read_text());b=json.loads(f.read_text());num,struct=scan(ordered(a['officialOracleCm']['pattern']),ordered(b['officialOracleCm']['pattern']))
 row={'style':style,'maxNumericDifference':max((n['delta'] for n in num),default=0),'numericDifferences':len(num),'structuralDifferences':struct,'largest':sorted(num,key=lambda n:-n['delta'])[:10]};rows.append(row)
(ROOT/'reports/wasm-native-diff.json').write_text(json.dumps({'native':f'NumPy{numpy.__version__}/SciPy{scipy.__version__}','wasm':'NumPy1.26.4/SciPy1.12.0','note':'Backend/platform numerical optimization may differ; maxNumericDifference mixes cm, relative curve params and degrees, inspect paths before converting units.','cases':rows},indent=2))
print(json.dumps(rows,indent=2))
