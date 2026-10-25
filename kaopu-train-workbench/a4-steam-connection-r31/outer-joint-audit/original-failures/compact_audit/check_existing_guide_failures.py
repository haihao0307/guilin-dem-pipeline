"""Exact retained-field existence witnesses, no geometry proposals."""
import json
from analytic_fields import *
F=json.load(open(HERE/'PHASE_POSES.json'));rows=[]
for k,fr in enumerate(F):
 for side in ['left','right']:
  p=fr['sides'][side];V=np.array(p['V']);U=np.array(p['U'])
  for sign in [-1,1]:
   q=V.copy();q[1]+=sign*.04;q[2]+=sign*.04*(U[2]-V[2])/(U[1]-V[1])
   ids=['valve/'+side+'_combination_lever','valve/'+side+'_fixed_valve_guide'];v=[transformed_scalar(id,q,fr) for id in ids];assert max(v)<-1e-8
   rows.append({'kind':'lever_vs_guide','side':side,'phaseIndex':k,'theta':fr['theta'],'xyz':q.tolist(),'pair':ids,'fieldValues':v})
   q=V.copy();q[0]+=sign*.04;ids=['valve/'+side+'_valve_crosshead_pin','valve/'+side+'_fixed_valve_guide'];v=[transformed_scalar(id,q,fr) for id in ids];assert max(v)<-1e-8
   rows.append({'kind':'transverse_pin_vs_guide','side':side,'phaseIndex':k,'theta':fr['theta'],'xyz':q.tolist(),'pair':ids,'fieldValues':v})
summary={'exactNegativeWitnessCount':len(rows),'phaseSamples':len(F),'sides':['left','right'],'leverGuideWorstMaximumField':max(max(r['fieldValues']) for r in rows if r['kind']=='lever_vs_guide'),'pinGuideWorstMaximumField':max(max(r['fieldValues']) for r in rows if r['kind']=='transverse_pin_vs_guide'),'allSampledPosesHaveBothFailures':True,'sampledNotContinuousProof':True,'method':'Construct centerline lever points at V.y +/-40mm and transverse pin points at V.x +/-40mm, then evaluate unchanged exact fields under actual common-Time inverse transforms. No optimizer.'}
json.dump({'summary':summary,'witnesses':rows},open(HERE/'GUIDE_FAILURE_SWEEP.json','w'),indent=2);print(json.dumps(summary,indent=2))
