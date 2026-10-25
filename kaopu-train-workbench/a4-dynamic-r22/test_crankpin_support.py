import pathlib,sys,json,numpy as np
P=pathlib.Path(__file__).parent;sys.path.insert(0,str(P/'reference'));import crankpin_support as sup,driving_crank_assembly as drive,wheelset_assembly as wheel
fail=[];contacts=0;overlaps=0;max_contact=0
for t in np.linspace(0,2*np.pi,73):
 for side,label in [(0,'left'),(2,'right')]:
  sign=-1 if side==0 else 1;b,_=drive.pose(t,side);u=(b-[1.016,0])/.3302;perp=np.array([-u[1],u[0]])
  for k,z in enumerate([2.2098,0,-2.2098]):
   name=f'{label}_D{k+1}_crankpin_support';pin=b+[0,z];pr=.06985 if k==1 else .04
   # Existing hub contact establishes a real load path, regardless of spoke angle.
   h=[sign*.72,*(np.array([1.016,z])+u*.14)];sv=sup.fields([h],t)[name][0];wv=wheel.fields([h],t)[f'axle{k+2}_{label}_hub'][0]
   if not(sv<0 and wv<0):fail.append(['hub_overlap',t,name,float(sv),float(wv)])
   overlaps+=1
   cname=f'{label}_main_crank_pin'if k==1 else f'{label}_coupling_pin_{k}'
   witness=[sign*.775,*(pin+perp*pr)];sv=sup.fields([witness],t)[name][0];pv=drive.fields([witness],t)[cname][0];max_contact=max(max_contact,abs(sv),abs(pv));contacts+=1
   if max(abs(sv),abs(pv))>1e-10:fail.append(['pin_contact',t,name,float(sv),float(pv)])
report={'candidate':'six inferred load-bearing wheel hub/crankpin support webs; not historical casting dimensions','hub_overlap_checks':overlaps,'pin_bore_contact_checks':contacts,'maximum_contact_residual_m':max_contact,'main_rod_axial_clearance_m':.798-.790,'coupling_rod_min_axial_clearance_m':.91-.018-.012-.790,'shaft_radius_m':.1,'support_shaft_clearance_radius_m':.102,'baseline_wheel_to_pin_axial_interval_gap_m':.0075,'explanation':'baseline pair gap remains but explicit hollow boss supplies hub-to-pin contact load path; no pin extension or axle carve','failures':fail,'pass':not fail,'not_proven':'full all-pairs swept collision, stress, keys/interference fit, actual A4 profile; middle rod collision remains'};(P/'CRANKPIN_SUPPORT_QA.json').write_text(json.dumps(report,indent=2));print(report);assert report['pass']
