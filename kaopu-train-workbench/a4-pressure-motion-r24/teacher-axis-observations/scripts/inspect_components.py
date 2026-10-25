from analyze_teacher import *
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
import matplotlib;matplotlib.use('Agg')
import matplotlib.pyplot as plt
import os
ROOT=Path(os.environ.get('A4_MEASURE_OUTPUT', str(Path(__file__).parent)))
SOURCE=Path(os.environ.get('A4_MEASURE_SOURCE', str(Path(__file__).parent/'private-source/extracted/a4-original-reference/source-assets/a4')))
s=Source(SOURCE)
(ROOT/'private-inspection').mkdir(parents=True,exist_ok=True)
(ROOT/'results').mkdir(parents=True,exist_ok=True)
print('durations',[(float(s.acc(a['input']).min()),float(s.acc(a['input']).max())) for a in s.g['animations'][0]['samplers']][:10])
def components(v,f):
    v,inv=np.unique(np.round(v,6),axis=0,return_inverse=True);f=inv[f];rows=np.r_[f[:,0],f[:,1],f[:,2]];cols=np.r_[f[:,1],f[:,2],f[:,0]];graph=coo_matrix((np.ones(len(rows)),(rows,cols)),shape=(len(v),len(v)))
    n,lab=connected_components(graph,directed=False)
    groups=sorted([np.where(lab==i)[0] for i in range(n)],key=len,reverse=True)
    return [v[x] for x in groups]
records=[]
for r in [98,100,102,111,115,258,260,266,270,284,290,293,295,298,300]:
    for i,j,v,f in s.primitives(r,time=0):
        for k,vs in enumerate(components(v,f)):
            st=stats(vs);st.update(root=r,node=i,component=k);records.append(st)
            if len(vs)>20:print(r,i,k,len(vs),'bounds',np.round(st['bounds'],5).tolist(),'axis',np.round(st['pca_major_axis'],5).tolist())
(ROOT/'results/component_measurements_time0.json').write_text(json.dumps(records,indent=2))
for roots,label in [([260,266,270,284],'static_cylinders'),([98,102,111,115,100,293,295,300,90,94,7],'animated_mechanics')]:
    fig,axs=plt.subplots(3,1,figsize=(14,14),layout='constrained')
    for r in roots:
        for i,j,v,f in s.primitives(r,time=0):
            for ax,a,b in zip(axs,[2,2,0],[1,0,1]):
                ax.scatter(v[:,a],v[:,b],s=.4,alpha=.4,label=f'{r}/{i}');ax.set_aspect('equal');ax.grid(True);ax.set_xlabel('XYZ'[a]);ax.set_ylabel('XYZ'[b]);ax.legend(markerscale=5,fontsize=7,loc='upper left')
    fig.suptitle(label+' | animation t=0 | uncalibrated source units');fig.savefig(ROOT/'private-inspection'/f'{label}.png',dpi=140);plt.close(fig)
# central corridor screening of all geometry at t0
rows=[]
for i,j,v,f in s.primitives(time=0):
    sel=(abs(v[:,0])<.5)&(v[:,1]>.7)&(v[:,1]<2.3)&(v[:,2]>2.8)&(v[:,2]<10.2)
    if sel.any():rows.append({'node':i,'parent':s.parents.get(i),'parent_name':s.g['nodes'][s.parents.get(i)].get('name'),'selected_count':int(sel.sum()),'selected_bounds':[v[sel].min(0).tolist(),v[sel].max(0).tolist()],'full_bounds':[v.min(0).tolist(),v.max(0).tolist()]})
(ROOT/'results/central_corridor_screen.json').write_text(json.dumps(rows,indent=2));print('CENTRAL',[(r['node'],r['parent_name'],r['selected_count'])for r in rows])
