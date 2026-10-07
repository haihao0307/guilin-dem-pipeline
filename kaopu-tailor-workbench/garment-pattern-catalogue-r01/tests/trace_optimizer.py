"""Diagnostic only: observe official scipy minimize calls without changing optimization inputs/options."""
from pathlib import Path
import sys,json,copy,os
try:ROOT=Path(__file__).resolve().parents[1]
except NameError:ROOT=Path('/pattern-generator')
sys.path.insert(0,str(ROOT))
from pattern_catalogue import *
import pygarment.garmentcode.operators as ops
import pygarment.garmentcode.edge_factory as factories
import scipy,scipy.optimize as opt
records=[];original=opt.minimize

def enc(v):
 if v is None or isinstance(v,(str,bool,int,float)):return v
 if isinstance(v,complex):return {'complex':[v.real,v.imag]}
 if isinstance(v,np.ndarray):return v.tolist()
 if isinstance(v,np.generic):return v.item()
 if isinstance(v,(tuple,list)):return [enc(x) for x in v]
 if isinstance(v,dict):return {k:enc(x) for k,x in v.items()}
 if hasattr(v,'bpoints'):return {'curveType':type(v).__name__,'bpoints':[enc(x) for x in v.bpoints()]}
 return {'type':type(v).__name__}

def wrapped(fun,x0,*args,**kw):
 row={'function':fun.__name__,'x0':enc(x0),'args':enc(kw.get('args',args[0] if args else [])),'method':kw.get('method','default'),'options':enc(kw.get('options')),'evaluations':[]}
 def objective(x,*a):
  value=fun(x,*a)
  if len(row['evaluations'])<40:row['evaluations'].append({'x':enc(x),'value':float(value)})
  return value
 result=original(objective,x0,*args,**kw)
 row['result']={k:enc(result[k]) for k in ['x','fun','jac','success','message','nit','nfev','njev'] if k in result};records.append(row);return result
ops.minimize=wrapped;factories.minimize=wrapped

def trace(body):
 records.clear();pattern=generatePattern({'bodyCm':body,'design':{'style':'LongSleeve'}})
 return {'numpy':np.__version__,'scipy':scipy.__version__,'records':records,'pattern':pattern}
if __name__=='__main__':
 data=trace(json.loads((ROOT/'examples/body-anny-cm.json').read_text()));(ROOT/'reports/optimizer-native.json').write_text(json.dumps(data,default=enc))
