from analyze_teacher import *
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
import matplotlib;matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
import os
ROOT=Path(os.environ.get('A4_MEASURE_OUTPUT', str(Path(__file__).parent)))
SOURCE=Path(os.environ.get('A4_MEASURE_SOURCE', str(Path(__file__).parent/'private-source/extracted/a4-original-reference/source-assets/a4')))
s=Source(SOURCE)
(ROOT/'private-inspection').mkdir(parents=True,exist_ok=True)
(ROOT/'results').mkdir(parents=True,exist_ok=True)
records=[];plot=[]
for i,j,v,f in s.primitives(time=0):
    lo=v.min(0);hi=v.max(0)
    if hi[0]<-.5 or lo[0]>.5 or hi[1]<.7 or lo[1]>2.5 or hi[2]<2.7 or lo[2]>10.3:continue
    vv,inv=np.unique(np.round(v,6),axis=0,return_inverse=True);ff=inv[f];rows=np.r_[ff[:,0],ff[:,1],ff[:,2]];cols=np.r_[ff[:,1],ff[:,2],ff[:,0]]
    n,lab=connected_components(coo_matrix((np.ones(len(rows)),(rows,cols)),shape=(len(vv),len(vv))),directed=False)
    order=np.argsort(lab);parts=np.split(order,np.flatnonzero(np.diff(lab[order]))+1)
    for k,ids in enumerate(parts):
        p=vv[ids];lo=p.min(0);hi=p.max(0)
        if hi[0]<-.5 or lo[0]>.5 or hi[1]<.7 or lo[1]>2.5 or hi[2]<2.7 or lo[2]>10.3:continue
        st=stats(p);st.update(node=i,component=k,parent=s.parents.get(i),parent_name=s.g['nodes'][s.parents.get(i)].get('name'));records.append(st)
    tris=v[f];sel=(tris[:,:,0].min(1)<.5)&(tris[:,:,0].max(1)>-.5)&(tris[:,:,1].min(1)<2.5)&(tris[:,:,1].max(1)>.7)&(tris[:,:,2].min(1)<10.3)&(tris[:,:,2].max(1)>2.7)
    if sel.any():plot.append((i,tris[sel]))
(ROOT/'results/central_components.json').write_text(json.dumps(records,indent=2))
print('COUNT',len(records));
for r in records:print(r['node'],r['component'],r['parent_name'],r['unique_vertices'],'bounds',np.round(r['bounds'],4).tolist(),'axis',np.round(r['pca_major_axis'],4).tolist())
fig,ax=plt.subplots(figsize=(14,6),layout='constrained')
for i,tris in plot:
    edges=[]
    for tri in tris:
        poly=list(tri)
        for axis,threshold,gt in [(0,-.5,True),(0,.5,False)]:
            out=[]
            if not poly:break
            for a,b in zip(poly,poly[1:]+poly[:1]):
                ina=(a[axis]>=threshold if gt else a[axis]<=threshold);inb=(b[axis]>=threshold if gt else b[axis]<=threshold)
                if ina:out.append(a)
                if ina!=inb:out.append(a+(b-a)*(threshold-a[axis])/(b[axis]-a[axis]))
            poly=out
        if len(poly)>1:
            edges.extend([[a[[2,1]],b[[2,1]]]for a,b in zip(poly,poly[1:]+poly[:1])])
    color=plt.get_cmap('tab20')(len(ax.collections)%20);ax.add_collection(LineCollection(edges,colors=[color],linewidths=.4,alpha=.7,label=f'{i}: {s.g["nodes"][s.parents[i]].get("name")}'))
ax.set_xlim(2.7,10.3);ax.set_ylim(.7,2.5);ax.set_aspect('equal');ax.grid(True);ax.legend(fontsize=7,loc='upper center',bbox_to_anchor=(.5,-.25),ncol=3);ax.set_xlabel('Z forward, source units');ax.set_ylabel('Y up, source units');ax.set_title('All source triangles clipped to central slab |X| ≤ 0.5, animation t=0');fig.savefig(ROOT/'private-inspection/central_slab.png',dpi=150)
