"""Reuse R15 analytic small-end joint in the complete-coordinate candidate.
X widths are explicitly adapted to the new rod eyes; no source mesh or scale claim.
"""
import sys,importlib.util
from pathlib import Path
import numpy as np
from driving_crank_assembly import CONFIG as DRIVE,pose
P=Path(__file__).parent
spec=importlib.util.spec_from_file_location('own_r15_joint',P/'deps/r15_joint_core.py');joint=importlib.util.module_from_spec(spec);spec.loader.exec_module(joint)
CONFIG={'cylinder_axis_station':4.75,'cylinder_half_length':.4,'bore_radius':.23495,'wall':.02505,'piston_radius':.23295,'piston_half_depth':.025,'piston_from_small_end':1.25,'piston_rod_radius':.025,'guide_offset':.26,'guide_station_range':[3.0,4.0],
 'documentary':'1935 three cylinders18.5in bore26in stroke; this bore radius only documentary',
 'inferred':['all installation','clearance','guide shape','cylinder wall','piston rod','R15 shape retained as inference; X adapted to rod width'],
 'reused':'a4-mechanism-r15/joint.py unchanged; existing pin/washer/nut/cotter/oil-cup analytic formulas'}
def fields(points,t,c=CONFIG):
 p=np.atleast_2d(points).astype(float);out={}
 for i,name in enumerate(['left','middle','right']):
  _,s=pose(t,i);x=DRIVE['lateral'][i];inc=DRIVE['inclinations'][i];di=np.array([0,np.sin(inc),np.cos(inc)]);normal=np.array([0,np.cos(inc),-np.sin(inc)]);origin=np.array([x,DRIVE['axis_y'],0]);small=np.array([x,*s]);q=p-small;local=np.c_[q[:,0],q@normal,q@di]
  half=DRIVE['inner_rod_half_thickness']if i==1 else DRIVE['outside_rod_half_thickness'];xscale=half/.025;qlocal=local.copy();qlocal[:,0]/=xscale
  vals=joint.joint_fields(qlocal)
  # Rod module owns bushing; R15 provides the matching pin/cheeks/locking/oil details.
  for j,label in enumerate(['bushing','small_pin','crosshead_cheeks','washer','castellated_nut','cotter','oil_cup']):
   if j:out[name+'_'+label]=vals[:,j]
  cc=origin+di*c['cylinder_axis_station'];d=p-cc;ax=d@di;rr=np.linalg.norm(d-ax[:,None]*di,axis=1);out[name+'_cylinder_wall']=np.maximum.reduce([rr-(c['bore_radius']+c['wall']),c['bore_radius']-rr,abs(ax)-c['cylinder_half_length']])
  piston=small+di*c['piston_from_small_end'];v=p-piston;a=v@di;out[name+'_piston']=np.maximum(np.linalg.norm(v-a[:,None]*di,axis=1)-c['piston_radius'],abs(a)-c['piston_half_depth'])
  out[name+'_piston_rod']=joint.capsule(p,small+di*.10,piston,c['piston_rod_radius'])
  stem=joint.box(local,[0,.215,0],[.05*xscale,.08,.035]);out[name+'_crosshead_stem']=stem
  out[name+'_slipper']=joint.box(local,[0,c['guide_offset'],0],[.12*xscale,.030,.17])
  # Guides expressed in fixed cylinder-axis coordinates, not attached to moving slider.
  base=p-origin;g=np.c_[base[:,0],base@normal,base@di];a,b=c['guide_station_range'];mid=(a+b)/2;length=(b-a)/2
  guides=[joint.box(g,[0,c['guide_offset']+.052,mid],[.13*xscale,.018,length]),joint.box(g,[-.095*xscale,c['guide_offset']-.052,mid],[.04*xscale,.018,length]),joint.box(g,[.095*xscale,c['guide_offset']-.052,mid],[.04*xscale,.018,length])]
  out[name+'_fixed_guides']=np.minimum.reduce(guides)
 return out
