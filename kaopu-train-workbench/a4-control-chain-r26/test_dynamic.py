"""Reconstructed rigid pose adapter parity against retained R20 Python formulas.
Does not establish historical phase accuracy or full swept collision freedom.
"""
import pathlib,sys,json,numpy as np
P=pathlib.Path(__file__).parent;sys.path.insert(0,str(P/'reference'))
import driving_crank_assembly as drive,cylinder_actuation_assembly as act
D=json.loads((P/'scene.js').read_text()[13:].rstrip(';\n'));rng=np.random.default_rng(20261025)
def classify(part):
 n=part['id'].split('/')[1];side=0 if n.startswith('left_')else 2 if n.startswith('right_')else 1
 if part['group']=='drive':
  if n=='D2_two_side_axle_journals':return None,side
  if n=='D2_inside_crank_webs':return 'crank',1
  if 'main_rod_with_open_eyes'in n:return 'rod',side
  if 'small_end_bushing'in n:return 'slider',side
  return 'crankTranslate',side
 if part['group']=='actuation'and not n.endswith(('cylinder_wall','fixed_guides')):return 'slider',side
 return None,side
def transform(q,t,kind,i):
 if kind is None:return q.copy()
 b0,s0=drive.pose(.4,i);bn,sn=drive.pose(t,i);ang=0
 if kind=='slider':a,b=s0,sn
 elif kind=='crankTranslate':a,b=b0,bn
 elif kind=='crank':a=b=np.array([1.016,0]);ang=-(t-.4)
 else:a,b=b0,bn;ang=np.arctan2(*(sn-bn)[::-1])-np.arctan2(*(s0-b0)[::-1])
 c,s=np.cos(ang),np.sin(ang);R=np.array([[c,-s],[s,c]]);v=q.copy();v[:,1:]=(q[:,1:]-a)@R.T+b;return v
errs={};samples=0;phases=[.4]+list(np.linspace(0,2*np.pi,13))
for part in D['parts']:
 if part['group']not in ['drive','actuation']:continue
 name=part['id'].split('/')[1];module=drive if part['group']=='drive'else act
 q=rng.uniform(np.array(part['aabb_min'])-.02,np.array(part['aabb_max'])+.02,(128,3));v0=module.fields(q,.4)[name];kind,i=classify(part);err=0
 for t in phases:
  qt=transform(q,t,kind,i);value=module.fields(qt,t)[name];err=max(err,float(np.max(np.abs(v0-value))));samples+=len(q)
 errs[part['id']]=err
maxclosure=0;maxaxis=0;pinspan=0
for t in np.linspace(0,2*np.pi,721):
 for i in range(3):
  b,s=drive.pose(t,i);maxclosure=max(maxclosure,abs(np.linalg.norm(s-b)-3.5));inc=drive.CONFIG['inclinations'][i];normal=np.array([np.cos(inc),-np.sin(inc)]);maxaxis=max(maxaxis,abs(np.dot(s-[1.016,0],normal)))
report={'method':'reconstructed rigid coordinate adapter vs preserved dynamic R20 NumPy analytic fields, same inferred parameters','parts_checked':len(errs),'scalar_comparisons':samples,'phase_count':len(phases),'max_scalar_error':max(errs.values()),'per_part_error':errs,'rod_length_closure_error_m':maxclosure,'slider_axis_error_m':maxaxis,'scope':'wheels use genuine retained theta functions; all 60 drive/actuation fields checked. Valve gear stays fixed, no historical phase or swept solid collision claim.','pass':max(errs.values())<1e-10 and maxclosure<1e-10 and maxaxis<1e-10};(P/'DYNAMIC_CPU_QA.json').write_text(json.dumps(report,indent=2,default=lambda v: v.item()));print({k:v for k,v in report.items()if k!='per_part_error'},flush=True);assert report['pass']
