"""Targeted analytic existence searches, never a no-collision certificate."""
import time
from scipy.optimize import minimize
from candidate_fields import *
B=json.load(open(HERE/'BROADPHASE.json'));F=json.load(open(HERE/'FRAMES.json'));rows=[]
def priority(pair):
 ids=[pair['stack'],pair['other']]
 return (not any(x.startswith('valve/') for x in ids),not any('guide_cap' in x for x in ids),all(x.startswith('outside_joint/') for x in ids))
for pair in sorted(B['pairs'],key=priority):
 ids=[pair['stack'],pair['other']];ks=pair['samples'];selected=[ks[0]] if pair['sameRigidFrame'] else sorted(set([ks[0],ks[-1]]+[ks[round((len(ks)-1)*x/5)] for x in range(1,5)]));found=None;best=None;attempted=[];nfev=0
 for k in selected:
  attempted.append(k);frame=F[k];a,b=[np.array(frame['parts'][id]['bounds']) for id in ids];lo=np.maximum(a[0],b[0]);hi=np.minimum(a[1],b[1]);mid=(lo+hi)/2
  def values(p):return[transformed_scalar(id,p,frame) for id in ids]
  def fun(p):return max(values(p))
  seeds=[mid]+[mid+np.eye(3)[axis]*sign*(hi[axis]-lo[axis])*.28 for axis in range(3) for sign in [-1,1]]
  for seed in seeds:
   opt=minimize(fun,np.clip(seed,lo+1e-10,hi-1e-10),method='Nelder-Mead',bounds=list(zip(lo,hi)),options={'maxiter':200,'xatol':1e-10,'fatol':1e-10});v=values(opt.x);nfev+=opt.nfev;w={'phaseIndex':k,'theta':frame['theta'],'xyz':opt.x.tolist(),'fieldValues':v,'maximumFieldValue':max(v),'optimizerSuccess':bool(opt.success)}
   if best is None or max(v)<best['maximumFieldValue']:best=w
   if max(v)<-1e-8:found=w;break
  if found:break
 row={'pair':ids,'sameRigidFrame':pair['sameRigidFrame'],'status':'negative_field_witness' if found else 'unresolved_no_witness_found','testedPhaseIndices':attempted,'selectedPhaseIndices':selected,'functionEvaluations':nfev,'witness':found,'bestSearchPoint':best};rows.append(row)
 print(ids,row['status'],best['maximumFieldValue'],flush=True);json.dump({'method':'Independent AST + exact retained fields, bounded local optimization. A negative point proves overlap; no-witness is never clearance.','results':rows},open(HERE/'WITNESSES.json','w'),indent=2)
