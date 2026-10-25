"""Finite mechanism inferred from own retained scalar endpoints, NOT recovered source.
All results are candidate-model observations, not historical A4 dimensions.
No shader, geometry, rendering, Git, browser, or publication changes.
"""
from pathlib import Path
import json, math
import numpy as np
from scipy.optimize import root
HERE=Path(__file__).resolve().parent
REF=json.loads((HERE/'reference-endpoints.json').read_text())
TAU=2*math.pi

def rot(v,a):
    c,s=math.cos(a),math.sin(a)
    return np.array([c*v[0]-s*v[1],s*v[0]+c*v[1]])

def dynamic_pose(theta,side):
    # Independent port of unchanged r24 DYNAMIC.pose outside-cylinder case.
    a=theta+(0 if side=='left' else 4.3)
    b=.3302*np.array([math.sin(a),math.cos(a)])
    return np.array([1.016+b[0],b[1]]),np.array([1.016,b[1]+math.sqrt(3.5**2-b[0]**2)])

def closure_context(theta,side):
    ref={k:np.array(v) if isinstance(v,list) else v for k,v in REF[side].items()}
    B,C=dynamic_pose(theta,side)
    E=np.array([1.016,0])+rot(ref['E']-np.array([1.016,0]),-(theta-.4))
    # Intersection: |J-T|=.5, |J-E|=1.8. Choose signed branch from reference.
    T=ref['T'];v=E-T;d=np.linalg.norm(v);u=v/d
    x=(.5**2-1.8**2+d*d)/(2*d);h2=.5**2-x*x
    if h2<=0: raise ValueError('Expansion-tail circles do not intersect non-singularly')
    v0=ref['E']-T;v1=ref['J']-T;cross=v0[0]*v1[1]-v0[1]*v1[0]
    sg=1 if cross>=0 else -1
    J=T+x*u+sg*math.sqrt(h2)*np.array([-u[1],u[0]])
    q=math.atan2(-(J[1]-T[1]),-(J[0]-T[0]))
    C=C+(ref['C']-dynamic_pose(.4,side)[1])
    return {'B':B,'C':C,'E':E,'J':J,'T':T,'H':ref['H'],'q':q,'tail_h2':h2}

def points(x,ctx):
    sigma,gamma,vz=x
    D=ctx['T']+rot(np.array([2.3*math.sin(sigma),2.3*(1-math.cos(sigma))]),ctx['q'])
    w=np.array([math.cos(gamma),math.sin(gamma)])
    V=np.array([1.48,vz]);U=V+.08*w;L=V-.58*w;A=1.12*D-.12*U
    return {'D':D,'V':V,'U':U,'L':L,'A':A}

def residual(x,ctx):
    p=points(x,ctx)
    return np.array([np.dot(p['U']-p['D'],p['U']-p['D'])-2.3**2,
        np.dot(p['L']-ctx['C'],p['L']-ctx['C'])-.62**2,
        np.dot(p['A']-ctx['H'],p['A']-ctx['H'])-.65**2])

def jacobian(x,ctx):
    sigma,gamma,vz=x;p=points(x,ctx)
    dD=rot(np.array([2.3*math.cos(sigma),2.3*math.sin(sigma)]),ctx['q'])
    dw=np.array([-math.sin(gamma),math.cos(gamma)]);dU=.08*dw;dL=-.58*dw;dz=np.array([0.,1.])
    r=p['U']-p['D'];n=p['L']-ctx['C'];h=p['A']-ctx['H']
    return np.array([[-2*np.dot(r,dD),2*np.dot(r,dU),2*np.dot(r,dz)],
      [0.,2*np.dot(n,dL),2*np.dot(n,dz)],
      [2*np.dot(h,1.12*dD),2*np.dot(h,-.12*dU),2*np.dot(h,-.12*dz)]])

def reference_x(side):
    ref=REF[side];w=np.array(ref['U'])-ref['L']
    return np.array([ref['sigma'],math.atan2(w[1],w[0]),ref['V'][1]])

def solve(theta,side,guess):
    ctx=closure_context(theta,side)
    sol=root(residual,guess,args=(ctx,),jac=jacobian,tol=1e-11)
    max_res=float(max(abs(residual(sol.x,ctx))))
    if max_res>1e-10 or abs(sol.x[0])>.2:raise ValueError(f'{side} {theta}: closure or slot failure {max_res}, {sol.x}')
    return sol.x,{**ctx,**points(sol.x,ctx)},max_res

def validate(samples=7201):
    report={'scope':'reconstructed inferred finite outside mechanism at retained reverser .75 only; not recovered generator or historical calibration','samples_per_side':samples,'whole_acceptance':False,'sides':{}}
    for side in ['left','right']:
        x=reference_x(side);states=[];residuals=[];dets=[];conds=[];deltas=[];lens=[];minh=1e9
        for theta in np.linspace(.4,.4+TAU,samples):
            prev=x.copy();x,p,r=solve(float(theta),side,x);states.append((float(theta),x.copy(),p));residuals.append(r);dets.append(np.linalg.det(jacobian(x,p)));conds.append(np.linalg.cond(jacobian(x,p)));deltas.append(abs(x-prev));minh=min(minh,p['tail_h2'])
            lens.append([np.linalg.norm(p[b]-p[a])-l for a,b,l in [('E','J',1.8),('T','J',.5),('D','U',2.3),('A','D',.276),('A','H',.65),('L','U',.66),('L','V',.58),('U','V',.08),('C','L',.62)]])
        xs=np.array([r[1] for r in states]);ref_err=max(float(np.linalg.norm(states[0][2][k]-REF[side][k])) for k in ['B','C','E','J','T','H','D','V','U','L','A']);seam=float(max(abs(xs[-1]-xs[0])))
        # Reverse same path, ensure branch independence and all source points return.
        rev_max=0.
        for theta,xf,pf in reversed(states):
            x,p,r=solve(theta,side,x);rev_max=max(rev_max,float(max(abs(x-xf))))
        report['sides'][side]={'reference_max_point_error_m':ref_err,'max_squared_length_equation_residual_m2':max(residuals),'max_rigid_length_error_m':float(np.max(np.abs(lens))), 'sigma_range_rad':[float(min(xs[:,0])),float(max(xs[:,0]))],'slot_half_angle_rad':.2,'minimum_slot_angular_margin_rad':float(.2-max(abs(xs[:,0]))),'combination_angle_range_rad':[float(min(xs[:,1])),float(max(xs[:,1]))],'spindle_z_range_m':[float(min(xs[:,2])),float(max(xs[:,2]))],'spindle_displacement_from_4p1_range_m':[float(min(xs[:,2])-4.1),float(max(xs[:,2])-4.1)],'spindle_travel_m':float(np.ptp(xs[:,2])),'reference_periodic_seam_max_error':seam,'reverse_continuation_max_state_error':rev_max,'maximum_adjacent_state_change_rad_rad_m':np.max(deltas,axis=0).tolist(),'minimum_abs_equation_jacobian_det':float(min(abs(np.array(dets)))),'max_equation_jacobian_condition_number':max(conds),'min_expansion_tail_intersection_height_squared_m2':minh}
        (HERE/f'{side}-cycle.json').write_text(json.dumps([{'theta':t,'sigma':float(xx[0]),'combinationAngle':float(xx[1]),'spindleZ':float(xx[2])} for t,xx,p in states]))
    (HERE/'PYTHON_CLOSURE_QA.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))
if __name__=='__main__':validate()
