"""Bounded analytic existence checks; no mesh or sampled geometry representation.
Search selected full-cycle poses in each broadphase pair's exact scalar fields.
A negative value in both solids is a witness; a failed search proves nothing.
"""
import json,time
import numpy as np
from scipy.optimize import minimize
from analytic_fields import *
B=json.load(open(HERE/'BROADPHASE.json'));F=json.load(open(HERE/'FRAMES.json'))
results=[]
for pair in B['pairs']:
 ids=[pair['stack'],pair['other']];ks=pair['samples'];selected=sorted(set([ks[0],ks[-1]]+[ks[round((len(ks)-1)*x/5)] for x in range(1,5)]))
 found=None;best=None;evals=0;attempted=[]
 for k in selected:
  attempted.append(k)
  frame=F[k];bounds=[np.array(frame['parts'][id]['bounds']) for id in ids];lo=np.maximum(bounds[0][0],bounds[1][0]);hi=np.minimum(bounds[0][1],bounds[1][1]);mid=(lo+hi)/2
  def values(p):return [transformed_scalar(id,p,frame) for id in ids]
  def fun(p):return max(values(p))
  # Fixed small set of analytic-box center seeds; optimizer does not certify
  # an exclusion when it cannot locate a negative witness.
  seeds=[mid]
  if '/bushing/M/' in ids[0]:
   # Analytic annular midwall seed, not a grid; centerline alone lies in the bore.
   c=(bounds[0][0]+bounds[0][1])/2
   seeds += [c+np.array([0,0,-.012825]),c+np.array([0,0,.012825])]
  if ids[0].endswith('spindle/M'):
   seeds += [np.array([0,1.48,float(z)]) for z in [4.3,4.6,5.1] if lo[2]<=z<=hi[2]]
  for seed in seeds:
   seed=np.clip(seed,lo+1e-10,hi-1e-10)
   opt=minimize(fun,seed,method='Nelder-Mead',bounds=list(zip(lo,hi)),options={'maxiter':160,'xatol':1e-10,'fatol':1e-10})
   vals=values(opt.x);evals+=opt.nfev
   row={'phaseIndex':k,'Time':frame['Time'],'theta':frame['theta'],'xyz':opt.x.tolist(),'fieldValues':vals,'maximumFieldValue':max(vals),'optimizerSuccess':bool(opt.success)}
   if best is None or row['maximumFieldValue']<best['maximumFieldValue']:best=row
   if all(v<-1e-8 for v in vals):found=row;break
  if found:break
 row={'pair':ids,'status':'negative_field_witness' if found else 'unresolved_no_witness_found','testedPhaseIndices':attempted,'selectedPhaseIndices':selected,'functionEvaluations':evals,'witness':found,'bestSearchPoint':best}
 results.append(row)
 print(ids, row['status'],best['maximumFieldValue'],flush=True)
 json.dump({'method':'local minimax optimization of unchanged retained analytic scalar fields; witness existence only, no clearance certificate','phaseConvention':'theta=.4+Time, angular speed=1 rad/time unit','installation':B['installation'],'results':results},open(HERE/'WITNESSES.json','w'),indent=2)
