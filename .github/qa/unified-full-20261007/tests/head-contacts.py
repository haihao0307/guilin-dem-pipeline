"""Cross-component lip/cavity/dental and eye/lid contacts on the real common mesh.
Retains baseline contacts separately; counts never substitute for rendered QA.
"""
from pathlib import Path
import gzip,json,numpy as np,time
from triangle_contact import aabb_candidates,normals_and_areas,classify_pair,EPS,predicate_self_tests
R=Path(__file__).resolve().parent.parent;D=R/'research/full-head-cases';G=R/'research/geometry';C=json.loads(gzip.decompress((R/'source/kaopu-unified-human-workbench/assets/canonical.json.gz').read_bytes()));F=np.fromfile(D/'faces.u32','<u4').reshape(-1,3);gnmc=np.fromfile(G/'gnm-components.u32','<u4');gnmr=np.fromfile(G/'gnm-regions.u32','<u4');outer=json.loads((G/'gnm-outer-mask.json').read_text());comp=np.full(25417,-1);region=np.full(25417,255);native=np.full(25417,-1);body=len(C['annyRecipes'])
for i,(a,b,t)in enumerate(C['gnmRecipes']):comp[body+i]=gnmc[a];region[body+i]=gnmr[a];native[body+i]=a
facecomp=np.array([int(x[0])if (x==x[0]).all() else -2 for x in comp[F]])
regions={'eyes':np.isin(comp,[1,2])|np.isin(region,[6,7])|np.isin(native,outer['preservedCavities']['left_ocular_skin']+outer['preservedCavities']['right_ocular_skin']),'mouth':np.isin(comp,[3,4,5])|np.isin(region,[17,18])|np.isin(native,outer['preservedCavities']['oral_skin'])}
rows=[];baseline={};started=time.time();selected=['gnm-neutral','anny-neutral','anny-blink','anny-jaw','anny-tongue','anny-jaw-blink','mhr-blink','mhr-jaw','baby','newborn'];selftest=predicate_self_tests()
for name in selected:
 v=np.fromfile(D/(name+'.f32'),'<f4').reshape(-1,3).astype(float);row={'name':name,'groups':{}}
 for group,mask in regions.items():
  ids=np.flatnonzero(mask[F].all(1));tri=v[F[ids]];norm,area=normals_and_areas(tri);pairs,adjacent=aabb_candidates(tri,F[ids]);pairs=pairs[facecomp[ids[pairs[:,0]]]!=facecomp[ids[pairs[:,1]]]]
  if len(pairs):
   ia,ib=pairs.T;da=np.einsum('nvc,nc->nv',tri[ia]-tri[ib,0,None],norm[ib]);db=np.einsum('nvc,nc->nv',tri[ib]-tri[ia,0,None],norm[ia]);pairs=pairs[~((da.min(1)>EPS)|(da.max(1)<-EPS)|(db.min(1)>EPS)|(db.max(1)<-EPS))]
  hits=[]
  for a,b in pairs:
   kind,detail=classify_pair(tri[a],tri[b],norm[a],norm[b])
   if kind in ('proper_crossing','coplanar_overlap'):hits.append({'faces':[int(ids[a]),int(ids[b])],'components':[int(facecomp[ids[a]]),int(facecomp[ids[b]])],'kind':kind,**detail})
  current={tuple(sorted(x['faces']))for x in hits}
  if name=='gnm-neutral':baseline[group]=current
  row['groups'][group]={'crossComponentIntersections':len(hits),'newPairsRelativeToGNMNeutral':len(current-baseline[group]),'longestSegmentMM':max([x.get('segmentLengthMM',0)for x in hits]+[0]),'pairsAfterBroadPhase':len(pairs),'hits':hits}
 rows.append(row);print({name:{k:{x:y for x,y in value.items()if x!='hits'}for k,value in row['groups'].items()}},flush=True)
report={'predicateSelfTest':selftest,'epsilonMetres':EPS,'scope':'Cross-component intersections only in explicit semantic eyes/mouth; no whole-surface or visual certificate','baseline':'Actual current GNM neutral common mesh','elapsedSeconds':time.time()-started,'rows':rows};(R/'research/head-contact-report.json').write_text(json.dumps(report,indent=2))
