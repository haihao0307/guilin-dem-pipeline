"""Independent Trimesh/OpenUSD reads of actual common posed exports."""
from pathlib import Path
import json,numpy as np,trimesh
from pxr import Usd,UsdGeom,UsdSkel
R=Path(__file__).resolve().parents[1];d=R/'research/export-cases';out=[]
for name in ('neutral','anny-mixed','mhr-mixed'):
 ref=json.loads((d/(name+'.json')).read_text());v=np.array(ref['positions'],dtype=np.float32).reshape(-1,3);f=np.array(ref['faces']).reshape(-1,3);record={'case':name}
 for ext in ('obj','glb'):
  m=trimesh.load(d/(name+'.'+ext),process=False);m=next(iter(m.geometry.values()))if isinstance(m,trimesh.Scene)else m
  assert np.array_equal(m.vertices.astype(np.float32),v) and np.array_equal(m.faces,f);record[ext]={'vertices':len(v),'faces':len(f),'maxPositionErrorMetres':float(np.max(abs(m.vertices-v)))}
 stage=Usd.Stage.Open(str(d/(name+'.usda')));assert stage and UsdGeom.GetStageUpAxis(stage)=='Y' and UsdGeom.GetStageMetersPerUnit(stage)==1
 prim=stage.GetPrimAtPath('/CommonPerson/Body');mesh=UsdGeom.Mesh(prim);p=mesh.GetPointsAttr().Get();assert np.array_equal(np.array(p),v) and np.array_equal(np.array(mesh.GetFaceVertexIndicesAttr().Get()).reshape(-1,3),f)
 cache=UsdSkel.Cache();cache.Populate(UsdSkel.Root(stage.GetPrimAtPath('/CommonPerson')),Usd.PrimDefaultPredicate);sq=cache.GetSkelQuery(UsdSkel.Skeleton(stage.GetPrimAtPath('/CommonPerson/Skeleton')));q=cache.GetSkinningQuery(prim);assert q.ComputeSkinnedPoints(sq.ComputeSkinningTransforms(),p)
 err=float(np.linalg.norm(np.array(p)-v,axis=1).max());assert err<2e-6;record['usda']={'parsed':True,'skinned':True,'vertices':len(v),'joints':len(sq.GetJointOrder()),'skinBindRoundTripMaxMetres':err};out.append(record)
report={'passed':True,'trimesh':trimesh.__version__,'OpenUSD':'.'.join(map(str,Usd.GetVersion())),'records':out,'scope':'Current evaluated pose snapshot, not lossless later native-parameter animation'}
(R/'research/export-independent-reader-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
