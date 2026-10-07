"""Independent extraction and explicit sparse interpolation; no third-party code.
The only scan read by this derivation is v8, for a registration check. It is
not simplified, copied, or used as the generated geometry.
"""
from pathlib import Path
import numpy as np, json, hashlib, csv
P=Path(__file__).parent;S=P.parent/'real_3d_sample'
a=np.array([[float(x) for x in l.split()] for l in (S/'scomber_vert02_12.txt').read_text().splitlines()[2:] if l.strip()]).reshape(11,15,3)
PARAM_NAMES=['length','height','half_width','waist_ratio','arch_front_x','arch_front_z','arch_back_x','arch_back_z','spine_tip_x','spine_tip_z','arch_front_foot_x','arch_front_foot_y','arch_front_foot_z','arch_back_foot_x','arch_back_foot_y','arch_back_foot_z','side_attachment_x','side_attachment_y','side_attachment_z']
records=[]
for i,v in enumerate(a):
 ant=(v[2]+v[3])/2;post=(v[11]+v[12])/2;o=(ant+post)/2
 X=post-ant;L=np.linalg.norm(X);X/=L
 Z=v[2]-v[3]+v[11]-v[12];Z-=Z.dot(X)*X;Z/=np.linalg.norm(Z);Y=np.cross(Z,X)
 basis=np.array([X,Y,Z]).T;local=(v-o)@basis
 H=(abs(local[2,2]-local[3,2])+abs(local[11,2]-local[12,2]))/2
 W=np.mean(abs(local[[4,13],1]));waist=abs(local[14,2])/(H/2)
 foot=(local[5]+local[6])/2;rear=local[7];side=(local[8]+local[9])/2
 vals=[L,H,W,waist,*local[1,[0,2]],*local[10,[0,2]],*local[0,[0,2]],foot[0],abs(foot[1]),foot[2],rear[0],abs(rear[1]),rear[2],side[0],abs(side[1]),side[2]]
 records.append(dict(vertebra=i+2,center_mm=o.tolist(),basis_XYZ=basis.tolist(),params=dict(zip(PARAM_NAMES,map(float,vals))),landmarks_local_mm=local.tolist()))
centers=np.array([r['center_mm'] for r in records]);pitch=np.linalg.norm(np.diff(centers,axis=0),axis=1);cum=np.r_[0,np.cumsum(pitch)];s=cum/cum[-1]
knots=np.array([0,3,6,10]); raw=np.array([[r['params'][n] for n in PARAM_NAMES] for r in records]); fitted=np.array([np.interp(s,s[knots],raw[knots,j]) for j in range(raw.shape[1])]).T
fit_stats={}
for j,name in enumerate(PARAM_NAMES):
 e=fitted[:,j]-raw[:,j];fit_stats[name]={'rmse':float(np.sqrt(np.mean(e**2))),'max_abs_error':float(np.max(abs(e))),'mean_measured':float(np.mean(raw[:,j])),'unit':'ratio' if name=='waist_ratio' else 'mm'}
for i,r in enumerate(records):
 r.update(s_in_sample=float(s[i]),pitch_to_next_mm=float(pitch[i]) if i<10 else None,sparse_params=dict(zip(PARAM_NAMES,map(float,fitted[i]))))
# Exact nearest distance to every triangle, independent vectorized geometry.
def mesh_point_distance(T,points):
 A,B,C=T[:,0],T[:,1],T[:,2];AB=B-A;AC=C-A;n=np.cross(AB,AC);n2=np.sum(n*n,1)
 aa=np.sum(AB*AB,1);bb=np.sum(AB*AC,1);cc=np.sum(AC*AC,1);det=aa*cc-bb*bb
 results=[]
 for q in points:
  distances=[]
  for u,w in [(A,B),(B,C),(C,A)]:
   e=w-u;t=np.clip(np.sum((q-u)*e,1)/np.sum(e*e,1),0,1);distances.append(np.sum((u+t[:,None]*e-q)**2,1))
  proj=q-(np.sum((q-A)*n,1)/n2)[:,None]*n;pp=np.sum((proj-A)*AB,1);qq=np.sum((proj-A)*AC,1)
  u=(cc*pp-bb*qq)/det;w=(aa*qq-bb*pp)/det;inside=(u>=-1e-12)&(w>=-1e-12)&(u+w<=1+1e-12)
  d=np.sum((proj-q)**2,1);d[~inside]=np.inf;distances.append(d);results.append(float(np.sqrt(np.min(distances))))
 return results
mesh=S/'SIO.80-267_Scomber_japonicus_vert008.stl';T=np.array([[float(x) for x in l.split()[1:]] for l in mesh.read_text().splitlines() if l.strip().startswith('vertex ')]).reshape(-1,3,3)
d=np.array(mesh_point_distance(T,a[6]));gap=np.linalg.norm(((a[:-1,11]+a[:-1,12])/2)-((a[1:,2]+a[1:,3])/2),axis=1)
registration={'unit':'mm','v8_landmarks_to_original_triangles_mm':d.tolist(),'v8_max_point_to_surface_mm':float(d.max()),'v8_rmse_mm':float(np.sqrt(np.mean(d*d))),'transform_applied':'none','source_triangles':len(T),'adjacent_centrum_port_gaps_mm':gap.tolist(),'pitch_range_mm':[float(pitch.min()),float(pitch.max())],'sample_center_span_mm':float(cum[-1]),'assessment':'All v8 raw landmarks lie on its STL surface to the coordinate-export precision. Smooth 11-row order and adjacent gaps support a contiguous local segment, but authors did not explicitly document a shared-frame contract for every row. No whole-fish registration is asserted.'}
metadata={'schema':'haiyu.anatomical-parameter-sample/1','species':'Scomber japonicus','specimen':'SIO 80-267','scope':{'vertebrae':[2,12],'count':11,'complete_fish':False,'skull':None,'ribs':None,'fins':None,'motion_ranges':None},'unit':'mm','source':{'doi':'https://doi.org/10.5285/1c76e443-da02-4bc4-a041-0f79adc016be','landmarks':'https://catalogue.ceh.ac.uk/datastore/eidchub/1c76e443-da02-4bc4-a041-0f79adc016be/Landmark_files/scomber_vert02_12.txt','authors':'Criswell, K.E.; Head, J.J. (2024)','licence':'Open Government Licence v3','attribution':'Contains data supplied by UK Centre for Ecology & Hydrology.','rights_holder':'University of Cambridge','raw_sha256':hashlib.sha256((S/'scomber_vert02_12.txt').read_bytes()).hexdigest()},'parameter_families':['centrum length/height/one-sided width','ventral waist proxy','anterior/posterior neural-arch fusion','neural-spine tip','anterior/posterior neural-arch attachment','transverse-process/haemal-arch attachment'],'assumptions':['Opposite side is mirrored for an explicitly bilateral schematic, not measured.','Midline symmetry removes small local Y offsets.','An elliptical hourglass is a schematic centrum; no claim to joint cup depth, wall thickness or bone volume.','Arch paths and display stroke radii are authored; preserved opening is topological, not a measured canal cross-section.','LM9/10 locate the attachment only; missing ribs and haemal processes are not extrapolated.','Haiyu bending is a design mapping, not inferred fish movement.'],'sparse_fit':{'method':'piecewise-linear interpolation','knots_vertebrae':[2,5,8,12],'coefficient_count':int(len(knots)*len(PARAM_NAMES)),'scalar_channels':len(PARAM_NAMES),'choice':'Fixed four sample knots, not optimized and not biological region boundaries.','errors':fit_stats},'registration':registration,'sample_span_mm':float(cum[-1]),'records':records}
(P/'data/sample.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
(P/'data/registration.json').write_text(json.dumps(registration,indent=2)+'\n')
with (P/'data/parameters.csv').open('w') as f:
 w=csv.writer(f);w.writerow(['vertebra','s_in_sample','pitch_to_next_mm',*PARAM_NAMES]);w.writerows([[r['vertebra'],r['s_in_sample'],r['pitch_to_next_mm'],*[r['params'][k] for k in PARAM_NAMES]] for r in records])
print(json.dumps({'registration':registration,'selected_errors':{k:fit_stats[k] for k in ['length','height','half_width','spine_tip_x','spine_tip_z']}},indent=2))
