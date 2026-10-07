from pathlib import Path
import json,sys,numpy as np,svgpathtools as svg
ROOT=Path(__file__).resolve().parents[1]
r={k:json.loads((ROOT/f'reports/optimizer-{k}.json').read_text()) for k in ['native','wasm']}
def complex_arg(x):return complex(*x['complex'])
def stats(rec):
 args=rec['args'];cp=np.array(args[0]);direction=np.array(args[2]);shift=np.array(rec['result']['x']);control=np.array([cp[0],cp[1]+shift[:2],cp[2]+shift[2:4],cp[3]+direction*shift[4]]);curve=svg.CubicBezier(*(control[:,0]+1j*control[:,1]));target=[complex_arg(x) for x in args[3:5]];length=curve.length();curvs=[curve.curvature(t) for t in np.linspace(0,1,args[5])];order=np.argsort(curvs)[::-1]
 return {'lengthMm':length*10,'targetLengthMm':args[1]*10,'lengthErrorMm':(length-args[1])*10,'tangentAngleErrorDegrees':[float(np.angle(curve.unit_tangent(i)/target[i])*180/np.pi) for i in [0,1]],'lengthPenalty':(length-args[1])**2,'tangentPenalties':[abs(curve.unit_tangent(i)-target[i])**2 for i in [0,1]],'maxCurvaturePenalty':max(curvs)**2,'endpointPenalty':.001*shift[-1]**2,'dominantCurvatureSamples':[{'index':int(i),'curvature':float(curvs[i])} for i in order[:3]],'reportedFiniteDifferenceGradientNorm':float(np.linalg.norm(rec['result']['jac'])),'termination':rec['result']['message']}
out={'sourceFunction':'operators.py _bend_extend_2_tangent / _max_curvature','note':'Original objective contains a max over 70 sampled curvatures; it is not globally differentiable where the maximizing sample changes. No analytical gradient is supplied. L-BFGS-B uses 1e-8 finite-difference probes. No source rule altered.','calls':[]}
for i in [0,1]:out['calls'].append({'call':i,**{k:stats(v['records'][i]) for k,v in r.items()}})
(ROOT/'reports/optimizer-objective-diagnostics.json').write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2))
