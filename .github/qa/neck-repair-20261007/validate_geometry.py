from pathlib import Path
import importlib.util,json,numpy as np,time
R=Path(__file__).resolve().parent;O=R/'research';root=R/'candidate-validation';(root/'assets').mkdir(parents=True,exist_ok=True);(root/'research').mkdir(exist_ok=True)
def link(src,dest):
 if not dest.exists():dest.symlink_to(src.resolve())
link(R/'baseline/kaopu-unified-human-workbench/assets/canonical.json',root/'assets/canonical.json')
for p in (O/'candidate-cases').glob('*-vertices.bin'):link(p,root/'research'/p.name)
for n in ['anny-neutral.json','gnm-neutral.json']:link(O/n,root/'research'/n)
spec=importlib.util.spec_from_file_location('published_neck_geometry',R/'baseline/kaopu-unified-human-workbench/tests/neck_geometry.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);module.ROOT=root
passed=module.main()==0
# Extend the original same-region test to potential intersections with all
# nonadjacent external model faces. Preserve its independently tested predicate.
c=json.loads((root/'assets/canonical.json').read_text());f=np.array(c['faces']).reshape(-1,3);unknown=set(json.loads((O/'neck-cotangent.json').read_text())['unknown']);affected=np.flatnonzero(np.isin(f,list(unknown)).any(1));extra=[]
for name in ['neutral','child','old','turn','combined','child_turn','old_turn','head_tilt']:
 v=np.fromfile(root/'research'/f'{name}-vertices.bin',dtype='<f4').reshape(-1,3).astype(float);tri=v[f];normal,area=module.normals_and_areas(tri);lo=tri.min(1)-module.EPS;hi=tri.max(1)+module.EPS;hits=[];pairs=0;seen=set()
 for i in affected:
  candidates=np.flatnonzero(np.all(lo<=hi[i],axis=1)&np.all(hi>=lo[i],axis=1));candidates=candidates[~(f[candidates,:,None]==f[i,None,:]).any((1,2))]
  if len(candidates):
   da=np.einsum('nvc,nc->nv',tri[i]-tri[candidates,0,None],normal[candidates]);db=np.einsum('nvc,c->nv',tri[candidates]-tri[i,0],normal[i]);candidates=candidates[~((da.min(1)>module.EPS)|(da.max(1)<-module.EPS)|(db.min(1)>module.EPS)|(db.max(1)<-module.EPS))]
  for j in candidates:
   pair=tuple(sorted((int(i),int(j))))
   if pair in seen:continue
   seen.add(pair);pairs+=1;kind,detail=module.classify_pair(tri[i],tri[j],normal[i],normal[j])
   if kind in ['proper_crossing','coplanar_overlap']:hits.append({'faces':pair,'kind':kind,**detail})
 row={'case':name,'passed':not hits,'pairsAfterBroadPhase':pairs,'intersections':hits};extra.append(row);print(name,'cross-region hits',len(hits),flush=True)
report={'passed':passed and all(x['passed']for x in extra),'original15CaseGate':passed,'extraCrossRegionCases':extra,'affectedTriangles':len(affected),'allModelTriangles':len(f),'note':'Discrete neck-to-all-model scan; adjacent/shared-vertex triangle pairs are excluded exactly as in the original predicate. Not a continuous animation certificate.'};(O/'neck-candidate-cross-region-report.json').write_text(json.dumps(report,indent=2));print(report['passed']);raise SystemExit(0 if report['passed']else 1)
