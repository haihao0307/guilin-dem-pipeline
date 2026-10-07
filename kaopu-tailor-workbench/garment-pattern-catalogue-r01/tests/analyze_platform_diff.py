from pathlib import Path
import json,numpy as np,math
ROOT=Path(__file__).resolve().parents[1];a=json.loads((ROOT/'reports/optimizer-native.json').read_text());b=json.loads((ROOT/'reports/optimizer-wasm.json').read_text())
def nums(x,y,path=''):
 out=[]
 if isinstance(x,(int,float)) and isinstance(y,(int,float)):
  if x!=y:out=[{'path':path,'delta':abs(x-y),'native':x,'wasm':y}]
 elif isinstance(x,list) and isinstance(y,list):
  for i,(u,v) in enumerate(zip(x,y)):out+=nums(u,v,path+f'[{i}]')
 elif isinstance(x,dict) and isinstance(y,dict):
  for k in x.keys()&y.keys():out+=nums(x[k],y[k],path+'.'+k)
 return out
calls=[]
for i,(x,y) in enumerate(zip(a['records'],b['records'])):
 args=sorted(nums(x['args'],y['args']),key=lambda d:-d['delta']);evals=sorted(nums(x['evaluations'][:1],y['evaluations'][:1]),key=lambda d:-d['delta']);calls.append({'index':i,'function':x['function'],'method':x['method'],'inputArgDifferences':args,'initialEvaluationDifferences':evals,'nativeResult':x['result'],'wasmResult':y['result']})
def points(p,e):
 t=np.linspace(0,1,501);u=1-t;start=np.array(p['verticesMm'][e['endpoints'][0]]);end=np.array(p['verticesMm'][e['endpoints'][1]])
 if e['kind']=='line':return u[:,None]*start+t[:,None]*end
 if e['kind']=='quadratic':
  c=np.array(e['controlPointsMm'][0]);return (u*u)[:,None]*start+(2*u*t)[:,None]*c+(t*t)[:,None]*end
 if e['kind']=='cubic':
  c,d=np.array(e['controlPointsMm']);return (u**3)[:,None]*start+(3*u*u*t)[:,None]*c+(3*u*t*t)[:,None]*d+(t**3)[:,None]*end
 arc=e['arc'];th=np.deg2rad(arc['startAngleDegrees']+t*arc['sweepDegrees']);return np.array(arc['centerMm'])+arc['radiusMm']*np.stack([np.cos(th),np.sin(th)],axis=1)
pb={p['id']:p for p in b['pattern']['panels']};curves=[];matrices=[]
for p in a['pattern']['panels']:
 q=pb[p['id']];ra=np.array(p['placement']['matrix3']);rb=np.array(q['placement']['matrix3']);ta=np.array(p['placement']['translationMm']);tb=np.array(q['placement']['translationMm']);matrices.append({'panel':p['id'],'maxRotationMatrixDifference':float(abs(ra-rb).max()),'translationDeltaMm':float(np.linalg.norm(ta-tb))})
 for ea,eb in zip(p['edges'],q['edges']):
  pa=points(p,ea);qb=points(q,eb);local=np.linalg.norm(pa-qb,axis=1);wa=np.c_[pa,np.zeros(len(pa))]@ra.T+ta;wb=np.c_[qb,np.zeros(len(qb))]@rb.T+tb;world=np.linalg.norm(wa-wb,axis=1)
  curves.append({'panel':p['id'],'edge':ea['index'],'type':ea['kind'],'localMaxParametricPointDistanceMm':float(local.max()),'localMaxAtT':int(local.argmax())/500,'worldMaxParametricPointDistanceMm':float(world.max()),'analyticLengthDeltaMm':abs(ea['lengthMm']-eb['lengthMm'])})
result={'method':'Observe original scipy.optimize.minimize; no changed inputs/options. Compare exact analytic primitives at 501 matching parameter values, not independently sampled polyline indices.','native':{'numpy':a['numpy'],'scipy':a['scipy']},'wasm':{'numpy':b['numpy'],'scipy':b['scipy']},'optimizerCalls':calls,'curves':sorted(curves,key=lambda d:-d['localMaxParametricPointDistanceMm']),'placements':matrices}
(ROOT/'reports/platform-optimizer-diagnosis.json').write_text(json.dumps(result,indent=2));print('max curve',result['curves'][:3]);print('call0 args',calls[0]['inputArgDifferences']);print('call0 initial',calls[0]['initialEvaluationDifferences']);print('matrixmax',max(x['maxRotationMatrixDifference'] for x in matrices))
