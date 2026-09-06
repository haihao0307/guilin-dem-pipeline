"""Independent CPU probes for gaze/micro-motion contracts, not a character runtime.
Uses Python's standard library. The injected analytic sampler is NOT Simplex Noise.
No Three.js, GSAP, cannon-es, browser, GLB or human physiology is executed here.
"""
from __future__ import annotations
import hashlib
import json
import math
import platform
import time

V = tuple[float, float, float]
Q = tuple[float, float, float, float]  # x,y,z,w
ZERO: V = (0., 0., 0.)
I: Q = (0., 0., 0., 1.)

def norm(v): return math.sqrt(sum(x*x for x in v))
def add(a,b): return tuple(x+y for x,y in zip(a,b))
def sub(a,b): return tuple(x-y for x,y in zip(a,b))
def scale(v,s): return tuple(x*s for x in v)
def unit(v):
    n = norm(v)
    if not math.isfinite(n) or n < 1e-12: raise ValueError('undefined direction')
    return scale(v,1/n)
def cross(a,b): return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def clamp(x,a,b): return max(a,min(b,x))
def qconj(q): return (-q[0],-q[1],-q[2],q[3])
def qmul(a,b):
    av,bv=a[:3],b[:3]
    return (*add(add(scale(bv,a[3]),scale(av,b[3])),cross(av,bv)),a[3]*b[3]-dot(av,bv))
def qrotate(q,v): return qmul(qmul(q,(*v,0.)),qconj(q))[:3]
def axis_q(axis,angle): return (*scale(unit(axis),math.sin(angle/2)),math.cos(angle/2))
def qangle(a,b): return 2*math.acos(clamp(abs(dot(unit(a),unit(b))),-1,1))
def slerp(a,b,t):
    a,b=unit(a),unit(b)
    c=dot(a,b)
    if c<0: b=scale(b,-1); c=-c
    c=clamp(c,-1,1)
    if c>.9995: return unit(add(scale(a,1-t),scale(b,t)))
    theta=math.acos(c)
    return add(scale(a,math.sin((1-t)*theta)/math.sin(theta)),scale(b,math.sin(t*theta)/math.sin(theta)))
def step_q(a,b,omega,dt):
    if not math.isfinite(dt) or dt<0 or not math.isfinite(omega) or omega<0: raise ValueError('invalid step')
    angle=qangle(a,b)
    return a if angle<1e-12 else slerp(a,b,min(1.,omega*dt/angle))
def local_direction(target,eye,head_q):
    d=sub(target,eye)
    if norm(d)<1e-12: return None
    return qrotate(qconj(head_q),unit(d))
def bounded_angles(direction,ymax,pmax):
    if ymax<=0 or pmax<=0: raise ValueError('limits must be positive')
    x,y,z=unit(direction)
    yaw=math.atan2(x,z); pitch=math.atan2(y,math.hypot(x,z))
    budget=math.hypot(yaw/ymax,pitch/pmax)
    if budget>1: yaw/=budget; pitch/=budget
    return yaw,pitch

def phase(identity):
    h=hashlib.sha256(identity.encode('utf-8')).digest()
    return int.from_bytes(h[:8],'big') / 2**64 * 100

def analytic_sampler(a,b,c):
    return math.sin(.7*a+1.3*b+.9*c)

def offset_sample(anchor,identity,t,amp):
    # Explicitly bounded per axis, no mutation or integration. Separate channel offsets.
    f=phase(identity); x,y,z=anchor
    return tuple(anchor[k]+amp*analytic_sampler(.3*x+7*k,.3*y+.2*z+13*k,t+f+19*k) for k in range(3))

def run():
    started=time.perf_counter(); names=[]
    def check(name,condition):
        if not condition: raise AssertionError(name)
        names.append(name)
    def near(a,b,tol=1e-9): return norm(sub(a,b))<tol
    h=axis_q((0,1,0),.7); p=(2.,3.,4.); w=(4.,2.,1.)
    local=qrotate(qconj(h),sub(w,p))
    check('rigid_world_local_roundtrip',near(add(p,qrotate(h,local)),w))
    d=local_direction((3.,0.,0.),ZERO,I)
    yaw,pitch=bounded_angles(d,math.pi,math.pi)
    aim=qmul(axis_q((0,1,0),yaw),axis_q((1,0,0),-pitch))
    check('declared_positive_z_forward_aims_at_target',near(qrotate(aim,(0.,0.,1.)),(1.,0.,0.)))
    left,right=(-.032,0.,0.),(.032,0.,0.)
    near_l=local_direction((0.,0.,.3),left,I); near_r=local_direction((0.,0.,.3),right,I)
    far_l=local_direction((0.,0.,30.),left,I)
    check('two_eye_origins_share_target_but_not_direction',near_l[0]>0 and near_r[0]<0 and abs(near_l[0])>abs(far_l[0]))
    check('rotating_about_fixed_eye_origin_preserves_anchor',near(add(p,qrotate(aim,ZERO)),p))
    check('coincident_target_returns_explicit_hold_signal',local_direction(p,p,h) is None)
    samples=((2,3,1),(-5,1,-1),(0,-5,1),(0,0,-1))
    check('candidate_yaw_pitch_ellipse_respects_budget',all(math.hypot(y/.5,z/.3)<=1+1e-12 for y,z in (bounded_angles(v,.5,.3) for v in samples)))
    goal=axis_q((0,1,0),1.)
    q=step_q(I,goal,.4,.2)
    check('angular_step_bounded_and_non_overshooting',abs(qangle(I,q)-.08)<1e-10 and qangle(q,goal)<qangle(I,goal))
    check('large_step_stops_at_target',qangle(step_q(I,goal,3,1),goal)<1e-7)
    a=axis_q((0,1,0),math.radians(179)); b=axis_q((0,1,0),math.radians(-179))
    mid=slerp(a,b,.5)
    check('shortest_arc_crosses_180_without_full_turn',qangle(mid,axis_q((0,1,0),math.pi))<1e-7)
    def integrate(n):
        q=I
        for _ in range(n): q=step_q(q,goal,.4,1/n)
        return q
    check('fixed_target_angular_result_matches_30_and_120_steps',qangle(integrate(30),integrate(120))<1e-6)
    def damp(n):
        x=0.
        for _ in range(n): x+=(1.-x)*(-math.expm1(-1/(n*.2)))
        return x
    check('fixed_target_exponential_damping_composes',abs(damp(30)-damp(120))<1e-12)
    rejected=0
    for bad in (-1.,float('nan'),float('inf')):
        try: step_q(I,goal,.4,bad)
        except ValueError: rejected+=1
    check('invalid_dt_rejected',rejected==3)
    check('zero_offset_amplitude_restores_reference_exactly',offset_sample(p,'eye-L',12.,0.)==p)
    original=offset_sample(p,'eye-L',12.,.1)
    for t in (18.,2.,190.): offset_sample(p,'eye-L',t,.1)
    check('query_order_and_intermediate_queries_do_not_accumulate_drift',offset_sample(p,'eye-L',12.,.1)==original)
    ids=('eye-L','eye-R','eye-17')
    check('stable_identity_phase_is_creation_order_independent',{i:phase(i) for i in ids}=={i:phase(i) for i in reversed(ids)})
    check('bounded_sampler_has_declared_per_axis_amplitude',all(abs(v-r)<=.1+1e-12 for t in range(100) for v,r in zip(offset_sample(p,'eye-L',t,.1),p)))
    nx=ny=nz=.6; t=2.
    projected=(analytic_sampler(nx,ny,t),analytic_sampler(ny,nz,t),analytic_sampler(nz,nx,t))
    check('screenshot_axis_permutation_can_repeat_same_signal',projected[0]==projected[1]==projected[2])
    check('milliseconds_and_seconds_contract_matches',offset_sample(p,'eye-L',1000*.001,.1)==offset_sample(p,'eye-L',1.,.1))
    p30=1-.99**30; p120=1-.99**120
    lam=-60*math.log(.99)
    constant30=1-math.exp(-lam/30)**30; constant120=1-math.exp(-lam/120)**120
    check('per_frame_probability_is_rate_dependent_and_time_hazard_is_not',p120>p30 and abs(constant30-constant120)<1e-12)
    epoch=1; old_epoch=epoch; epoch+=1; writes=[]
    if old_epoch==epoch: writes.append('stale')
    check('generation_token_blocks_stale_callback',writes==[])
    memory=[15.,0.,0.]; body_force=memory; body_force[:]=[0.,0.,0.]
    memory2=[15.,0.,0.]; body_force2=memory2.copy(); body_force2[:]=[0.,0.,0.]
    check('force_reference_alias_is_cleared_but_copy_preserves_controller_state',memory==[0.,0.,0.] and memory2==[15.,0.,0.])
    check('source_frame_gap_clamp_is_explicit_time_loss',min(60.,1000.)*.001==.06)
    pa,pb=(-1.1,0.,0.),(1.1,0.,0.)
    check('render_only_position_offsets_can_defeat_sphere_clearance',norm(sub(pa,pb))>=2 and norm(sub(add(pa,(.2,0,0)),add(pb,(-.2,0,0))))<2)
    return {
        'status':'passed','checks':len(names),'names':names,
        'environment':{'python':platform.python_version(),'platform':platform.platform()},
        'elapsed_ms':round((time.perf_counter()-started)*1000,3),
        'scope':'Independent standard-library CPU formulas and source-expression counterexamples.',
        'noise_sampler':'analytic sine injection, NOT Simplex Noise',
        'npm_dependency_attempt':'40 second timeout; no dependency runtime claimed',
        'node_dependency_runtime':False,'upstream_full_application_run':False,
        'browser_run':False,'gpu_run':False,'physiology_calibrated':False,
        'production_integration':False,'visualAcceptance':False,'productionReady':False,
        'probability_one_second':{'per_frame_0_01_at_30_fps':p30,'per_frame_0_01_at_120_fps':p120},
        'source_force_alias_example':'copying persistent controller state into body.force prevents clearForces from erasing that separate state',
    }

if __name__=='__main__':
    print(json.dumps(run(),ensure_ascii=False,indent=2))
