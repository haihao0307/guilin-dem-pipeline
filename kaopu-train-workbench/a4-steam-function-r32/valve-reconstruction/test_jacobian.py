"""Independent derivative and rigid-return-crank diagnostics, optional for core CI."""
from pathlib import Path
import numpy as np
import json
import solve_outside as m
HERE=Path(__file__).resolve().parent
errors=[];qrange={};length_errors=[]
for side in ['left','right']:
    x=m.reference_x(side);qs=[]
    for t in np.linspace(.4,.4+2*np.pi,361):
        x,c,r=m.solve(t,side,x);J=m.jacobian(x,c);fd=np.empty((3,3));h=1e-6
        for i in range(3):
            step=np.eye(3)[i]*h;fd[:,i]=(m.residual(x+step,c)-m.residual(x-step,c))/(2*h)
        errors.append(float(np.max(np.abs(fd-J))));qs.append(c['q'])
        ref=np.array(m.REF[side]['B']);refE=np.array(m.REF[side]['E']);length_errors.append(abs(np.linalg.norm(c['E']-c['B'])-np.linalg.norm(refE-ref)))
    qrange[side]=[min(qs),max(qs)]
report={'analyticJacobianVsCentralFiniteDifferenceMaxAbs':max(errors),'finiteDifferenceStep':h,'expansionAngleRangeRad':qrange,'maxReturnCrankLengthErrorM':max(length_errors),'samplesPerSide':361}
assert report['analyticJacobianVsCentralFiniteDifferenceMaxAbs']<1e-7
assert report['maxReturnCrankLengthErrorM']<1e-12
(HERE/'JACOBIAN_QA.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
