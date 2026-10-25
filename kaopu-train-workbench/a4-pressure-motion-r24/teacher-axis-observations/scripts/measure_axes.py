from analyze_teacher import *
import os
ROOT=Path(os.environ.get('A4_MEASURE_OUTPUT', str(Path(__file__).parent)))
SOURCE=Path(os.environ.get('A4_MEASURE_SOURCE', str(Path(__file__).parent/'private-source/extracted/a4-original-reference/source-assets/a4')))
s=Source(SOURCE)
(ROOT/'private-inspection').mkdir(parents=True,exist_ok=True)
(ROOT/'results').mkdir(parents=True,exist_ok=True)
a=s.g['animations'][0];rows=[]
for r in [98,111,100,293,7,90,94]:
    row={'root':r,'name':s.g['nodes'][r]['name'],'tracks':{}}
    for ch in a['channels']:
        if ch['target']['node']!=r:continue
        sm=a['samplers'][ch['sampler']];ts=s.acc(sm['input']).ravel();v=s.acc(sm['output']);path=ch['target']['path'];tr={'samples':len(ts),'time_range':[float(ts.min()),float(ts.max())],'min':v.min(0).tolist(),'max':v.max(0).tolist(),'first':v[0].tolist()}
        if path=='translation':
            dv=v.astype(float)-v.mean(0);u,vals,vt=np.linalg.svd(dv,full_matrices=False);axis=vt[0]
            if axis[2]<0:axis=-axis
            tr.update(trajectory_axis=axis.tolist(),singular_values=vals.tolist(),axis_perp_max_error=float(np.linalg.norm(dv-(dv@axis)[:,None]*axis,axis=1).max()))
        row['tracks'][path]=tr
    rows.append(row)
# Source-driver centers are verified by geometrically symmetric rim ring positions.
wheels=[]
for r in [7,94,90]:
    mat=s.matrices(time=0)[r];node=s.g['nodes'][r]['children'][0];p=s.g['meshes'][s.g['nodes'][node]['mesh']]['primitives'][0];v=s.acc(p['attributes']['POSITION']);loc=(v.min(0)+v.max(0))/2;world=mat[:3,:3]@loc+mat[:3,3];axis=mat[:3,:3]@np.array([1,0,0]);axis/=np.linalg.norm(axis)
    wheels.append({'root':r,'mesh_node':node,'rim_local_bounds':[v.min(0).tolist(),v.max(0).tolist()],'local_symmetric_rim_center':loc.tolist(),'world_center':world.tolist(),'world_axle_axis':axis.tolist(),'radial_extent_local_y':float((v[:,1].max()-v[:,1].min())/2),'radial_extent_local_z':float((v[:,2].max()-v[:,2].min())/2)})
# Directly measure cylindrical stem component axis by its principal covariance axis,
# then full translation trajectory. Component identification is geometry-based:
# 96 welded vertices; 1.34 long and 0.129 across; stem not cylinder housing.
stems=[]
components=json.loads((ROOT/'results/component_measurements_time0.json').read_text())
for r,k in [(100,2),(293,3)]:
    st=next(x for x in components if x['root']==r and x['component']==k)
    tr=next(x for x in rows if x['root']==r)['tracks']['translation']
    stems.append({'root':r,'node':st['node'],'component':k,'time0_bounds':st['bounds'],'time0_cylinder_geometric_axis':st['pca_major_axis'],'time0_bounding_midpoint':((np.array(st['bounds'][0])+st['bounds'][1])/2).tolist(),'animation_translation_axis':tr['trajectory_axis'],'translation_extent':float(tr['max'][2]-tr['min'][2]),'trajectory_line_error':tr['axis_perp_max_error']})
# Pose-varying long rod direction is PCA of actual vertices, not interpretation of its name.
rods=[]
for r in [98,111]:
    record={'root':r,'time0_stats':stats(s.vertices(r,0)),'samples':[]}
    for t in np.linspace(1/24,2.5,60):
        st=stats(s.vertices(r,float(t)));record['samples'].append({'time':float(t),'direction_pca':st['pca_major_axis'],'pitch_deg':st['pca_pitch_deg']})
    record['pitch_range_deg']=[min(x['pitch_deg']for x in record['samples']),max(x['pitch_deg']for x in record['samples'])];rods.append(record)
# Source straight axle at center is measured on actual vertices within central x slab.
axles=[]
for r in [90,94]:
    node=s.g['nodes'][r]['children'][2];p=s.g['meshes'][s.g['nodes'][node]['mesh']]['primitives'][0];v=s.acc(p['attributes']['POSITION']);m=s.matrices(time=0)[node];central=v[abs(v[:,0])<.55]
    for x in np.unique(np.round(central[:,0],5)):
        ring=central[abs(central[:,0]-x)<1e-5]
        if len(ring)<10:continue
        radial=np.linalg.norm(ring[:,1:],axis=1);axles.append({'root':r,'mesh_node':node,'local_x':float(x),'ring_count':len(ring),'local_yz_center':((ring[:,1:].min(0)+ring[:,1:].max(0))/2).tolist(),'radial_min_max':[float(radial.min()),float(radial.max())]})
result={'units':'source units only, not physical calibration','drivers':wheels,'driver_spacing_z':[wheels[1]['world_center'][2]-wheels[0]['world_center'][2],wheels[2]['world_center'][2]-wheels[1]['world_center'][2]],'slider_stems':stems,'external_rods_pca_not_joint_fit':rods,'tracks':rows,'central_axle_ring_measurements':axles,'middle_cylinder':{'axis':None,'reason':'No separable middle cylinder/connecting rod found in actual central-slab triangle and component inspection; do not invent one from the source labels.'}}
(ROOT/'results/axis_measurements.json').write_text(json.dumps(result,indent=2))
for k in ['drivers','driver_spacing_z','slider_stems','central_axle_ring_measurements']:print(k,json.dumps(result[k],indent=2))
for r in rows:
 print('TRACK',r['root'],json.dumps(r['tracks']))
for r in rods: print('ROD',r['root'],'range',r['pitch_range_deg'],'time0',r['time0_stats']['pca_major_axis'])
