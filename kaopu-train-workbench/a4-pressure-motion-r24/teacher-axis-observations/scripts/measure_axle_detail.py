from analyze_teacher import *
import os
ROOT=Path(os.environ.get('A4_MEASURE_OUTPUT', str(Path(__file__).parent)))
SOURCE=Path(os.environ.get('A4_MEASURE_SOURCE', str(Path(__file__).parent/'private-source/extracted/a4-original-reference/source-assets/a4')))
s=Source(SOURCE)
(ROOT/'private-inspection').mkdir(parents=True,exist_ok=True)
(ROOT/'results').mkdir(parents=True,exist_ok=True)
out=[]
for r in [7,94,90]:
    i=s.g['nodes'][r]['children'][2];p=s.g['meshes'][s.g['nodes'][i]['mesh']]['primitives'][0];v=s.acc(p['attributes']['POSITION']);f=s.acc(p['indices']).reshape(-1,3);q=v[abs(v[:,0])<1e-7];q=np.unique(q[:,1:],axis=0).astype(float)
    a=np.c_[q*2,np.ones(len(q))];b=(q*q).sum(1);sol=np.linalg.lstsq(a,b,rcond=None)[0];center=sol[:2];radius=np.sqrt(sol[2]+center@center);err=np.linalg.norm(q-center,axis=1)-radius
    crossing=f[v[f][:,:,0].min(1)<-.4];crossing=crossing[v[crossing][:,:,0].max(1)>-.01]
    row={'wheel_root':r,'mesh_node':i,'local_x0_ring_unique_vertices':len(q),'ring_center_local_yz':center.tolist(),'ring_radius':float(radius),'ring_fit_rms':float(np.sqrt((err*err).mean())),'ring_center_axis_offset':float(np.linalg.norm(center)),'left_half_triangles_spanning_x_minus04_to_near0':len(crossing),'left_half_triangles_x_values':np.unique(np.round(v[crossing,0],6)).tolist()};out.append(row)
(ROOT/'results/axle_center_detail.json').write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2))
