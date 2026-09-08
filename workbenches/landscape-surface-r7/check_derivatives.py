"""Independent central-difference checks of the microscope's analytical derivative.

This validates math, not rendered appearance, sampled geology, or GPU performance.
Pixel footprints are held fixed while differentiating the underlying field.
"""
import math, json

def smooth(a,b,x):
    t=max(0.,min(1.,(x-a)/(b-a)))
    return t*t*(3-2*t)

def surface(f,footprint):
    R=math.sqrt(sum(v*v for v in f));r2=R*R;xy2=f[0]**2+f[1]**2
    phase=[[.36,-.80,.48],[.48,.60,.64],[-.80,0.,.60]]
    z=[math.log2(R)-2.2,-f[2]/R-1,math.atan2(f[0],f[1])]
    z=[v+.47*sum(phase[i][j]*f[j] for j in range(3)) for i,v in enumerate(z)]
    h=0.;grad=[0.,0.,0.];sc=1.
    for j in range(17):
        c=[math.cos(v*sc) for v in z];sn=[math.sin(v*sc) for v in z]
        v=c[2]*c[0]+c[1]*c[1]+c[1]*c[0]
        w=smooth(4,6,j)*(.96**max(0,j-6))*math.exp(-.5*sc*sc*footprint**2)
        h+=w*(math.cos(v)-.45)/sc
        d=[sn[0]*(c[2]+c[1]),sn[1]*(2*c[1]+c[0]),sn[2]*c[0]]
        for i in range(3):grad[i]+=w*math.sin(v)*d[i]
        sc*=2
    bounded=math.tanh(h*.18/.018);chain=.18*(1-bounded*bounded)
    j0=[v/(r2*math.log(2)) for v in f]
    j1=[f[2]*v/(r2*R)-(1/R if i==2 else 0) for i,v in enumerate(f)]
    j2=[f[1]/xy2,-f[0]/xy2,0.]
    j0=[v+.47*phase[0][i] for i,v in enumerate(j0)]
    j1=[v+.47*phase[1][i] for i,v in enumerate(j1)]
    j2=[v+.47*phase[2][i] for i,v in enumerate(j2)]
    return .018*bounded,[chain*sum(grad[k]*[j0,j1,j2][k][i] for k in range(3)) for i in range(3)]

maximum=0.;count=0
for f in [[5.7,-3.9,2.6],[4.01,1.44,5.12],[-2.51,-3.12,1.66],[.23,.42,-.52],[12.1,6.7,2.31]]:
    for footprint in [0.,.0001,.001,.01,.05]:
        h,gradient=surface(f,footprint)
        assert math.isfinite(h) and abs(h)<=.018
        for axis in range(3):
            step=1e-8
            a=f.copy();b=f.copy();a[axis]+=step;b[axis]-=step
            finite=(surface(a,footprint)[0]-surface(b,footprint)[0])/(2*step)
            error=abs(finite-gradient[axis]);maximum=max(maximum,error)
            assert error<2e-5,(f,footprint,axis,error)
            count+=1
print(json.dumps({'centralDifferenceComparisons':count,'maxAbsoluteGradientError':maximum,'singleFieldHeightBoundMetres':.018,'passed':True},indent=2))
