"""Whole-system relationship and kinematic contracts, NOT a 60009 replica.
Coordinates: x lateral, y up, z forward. Uncalibrated R14 source-scale units.
Three-cylinder phases/inclinations are REQUIRED parameters, never silently 120deg.
"""
import math
import numpy as np
from r14_core import PARAMS

def slider(theta,phase,inclination,length=PARAMS['rod_length'],radius=PARAMS['crank_radius']):
    """Cylinder axis passes through driver centre. Solve in that cylinder's plane.
    Physical crank theta+phase is measured from global +z toward +y.
    local angle subtracts axis inclination; this distinction prevents guessed phases.
    """
    local=theta+phase-inclination
    along=radius*np.cos(local); normal=radius*np.sin(local)
    if length<=radius:raise ValueError('rod too short for full revolution')
    distance=along+np.sqrt(length*length-normal*normal)
    axis=np.array([math.sin(inclination),math.cos(inclination)])
    big=np.array([radius*np.sin(theta+phase),radius*np.cos(theta+phase)])
    return big,distance[...,None]*axis

def system_pose(theta,phases,inclinations,axle_z=(2.5,0.,-2.5),lateral=(-.9,0.,.9)):
    if len(phases)!=3 or len(inclinations)!=3:raise ValueError('three explicit cylinder parameters required')
    out={}; r=PARAMS['crank_radius']
    for i,side in enumerate(('left','middle','right')):
        b,s=slider(theta,phases[i],inclinations[i]); out[side]={'big':np.r_[lateral[i],b],'small':np.r_[lateral[i],s], 'driver_axle':1}
    wheels={}
    # Same-side wheel crank phases are mechanically shared by coupling rods.
    for side,idx,x in [('left',0,lateral[0]),('right',2,lateral[2])]:
        q=theta+phases[idx]
        wheels[side]=np.array([[x,r*math.sin(q),z+r*math.cos(q)] for z in axle_z])
    out['coupled_pins']=wheels;return out

def conjugate(v_left,v_right):
    """Ideal equal+2:1 lever longitudinal relation; not exact finite-rod A4 gear.
    Midpoint at -left/2; equal lever's other endpoint gives -left-right.
    Actual valve travels/ports/laps/lead are deliberately not synthesized.
    """
    fulcrum=-v_left/2
    middle=2*fulcrum-v_right
    return middle

def reachable(graph,start,end,kind=None):
    seen={start};todo=[start]
    while todo:
        n=todo.pop()
        if n==end:return True
        for e in graph['edges']:
            if e['from']==n and (kind is None or e['kind']==kind) and e['to'] not in seen:
                seen.add(e['to']);todo.append(e['to'])
    return False

def joint_fields_world(points,theta,side,phases,inclinations):
    """Reuse the R15 local analytic small-end field in each new cylinder frame.
    Three instances are FUNCTIONAL placeholders, not proof all A4 joints are identical.
    This evaluates solid fields; the inspection page renders axis curves only.
    """
    from r15_joint import joint_fields
    i=('left','middle','right').index(side)
    center=system_pose(theta,phases,inclinations)[side]['small']
    v=np.asarray(points)-center;c=math.cos(inclinations[i]);s=math.sin(inclinations[i])
    local=np.stack([v[:,0],v[:,1]*c-v[:,2]*s,v[:,1]*s+v[:,2]*c],-1)
    return joint_fields(local)
