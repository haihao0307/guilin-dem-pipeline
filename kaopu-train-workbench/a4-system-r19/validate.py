import math,json
from pathlib import Path
P=Path(__file__).parent
r=json.loads((P/'REGISTRATION.json').read_text())
assert abs(r['axle_z_front_to_rear_m'][2]-r['axle_z_front_to_rear_m'][3]-2.2098)<1e-12
assert abs(r['axle_z_front_to_rear_m'][3]-r['axle_z_front_to_rear_m'][4]-2.2098)<1e-12
err=0.;guide=0.;samples=[]
for k in range(721):
 t=2*math.pi*k/720;po=[]
 for ph,x,inc in zip([0,1.7,4.3],[-.82,0,.82],[0,.11,0]):
  a=t+ph;by,bz=.3302*math.sin(a),.3302*math.cos(a);dy,dz=math.sin(inc),math.cos(inc);h=by*dy+bz*dz;perp=by*dz-bz*dy;s=h+math.sqrt(2.2**2-perp**2);sy,sz=dy*s,dz*s
  err=max(err,abs(math.hypot(by-sy,bz-sz)-2.2));guide=max(guide,abs(sy*dz-sz*dy));po.append({'big':[x,1.016+by,bz],'small':[x,1.016+sy,sz]})
 if k in [0,90,180,360,540,720]:samples.append({'t':t,'pose':po})
assert err<1e-12 and guide<1e-12
(P/'expected.json').write_text(json.dumps(samples))
(P/'VALIDATION.json').write_text(json.dumps({'pass':True,'phases':721,'rod_max_error_m':err,'guide_max_error_m':guide,'source_mesh_files':False,'phases_and_rod_length':'explicit inferred fixture, not historic exact','physical_clearance':'not accepted'},indent=2))
print(err,guide)
