"""R02 measured fin topology repair. Eyes and original carrier fields are immutable."""
import runpy,json,gzip,pathlib,hashlib,numpy as np
from datetime import datetime,timezone
ROOT=pathlib.Path(__file__).resolve().parents[1]
api=runpy.run_path(str(ROOT/'scripts/prepare-sources.py'))
sha=lambda data:hashlib.sha256(data).hexdigest()
compact=lambda value:json.dumps(value,ensure_ascii=False,separators=(',',':')).encode()
def protected(score):
 return sha(compact({'source':score['source'],'materials':score['materials'],'textures':score['textures'],'eyes':score['eyes'],'carrier':[{k:p[k] for k in ['positions','base','residual','paramAddress','normals','uvs','indices','material','sourceMesh','sourceNode','name','ocular']} for p in score['primitives']]}))
def strain(score):
 _,_,p,fid,w,tri,edges,L,_,_=api['fin_topology'](score);different=np.any(fid[tri]!=fid[tri[:,0]][:,None],axis=1);valid=L>1e-7;gradient=abs(w[edges[:,0]]-w[edges[:,1]])/np.maximum(L,1e-12);maxAngle={'herring':.163,'tuna-yellow-label':.105,'tuna-blue-label':.105,'colorful':.285,'picasso':.345}[score['id']];best=0.;small=1.;worst={};areaOriginal=np.linalg.norm(np.cross(p[tri[:,1]]-p[tri[:,0]],p[tri[:,2]]-p[tri[:,0]]),axis=1);areaGood=areaOriginal>1e-12;areaMax=0.
 for phase in np.linspace(0,2*np.pi,25)[:-1]:
  q=p.copy()
  for f in score['rig']['fins']:
   rows=np.where(fid==f['id'])[0]
   if not len(rows):continue
   axis=np.array(f['axis'],float);axis/=np.linalg.norm(axis);root=np.array(f['root']);a=maxAngle*np.sin(phase+(12*(p[rows,0]-root[0]) if score['id']=='picasso' and f['id'] in (5,6) else 0))*w[rows];v=p[rows]-root;c=np.cos(a)[:,None];s=np.sin(a)[:,None];q[rows]=root+v*c+np.cross(axis,v)*s+axis*(v@axis)[:,None]*(1-c)
  ratios=np.linalg.norm(q[edges[:,0]]-q[edges[:,1]],axis=1)/np.maximum(L,1e-12);ratios[~valid]=1;k=int(np.argmax(ratios));small=min(small,float(ratios.min()))
  if ratios[k]>best:best=float(ratios[k]);a,b=edges[k];worst={'sourceWeldedAddresses':[int(a),int(b)],'finIds':[int(fid[a]),int(fid[b])],'weights':[float(w[a]),float(w[b])],'sourceLength':float(L[k]),'positions':[p[a].tolist(),p[b].tolist()],'phase':float(phase)}
  a2=np.linalg.norm(np.cross(q[tri[:,1]]-q[tri[:,0]],q[tri[:,2]]-q[tri[:,0]]),axis=1);areaMax=max(areaMax,float(np.max(a2[areaGood]/areaOriginal[areaGood])))
 return {'triangleCount':len(tri),'uniqueSourceAddresses':len(p),'crossClassTriangles':int(different.sum()),'crossClassTrianglesWithActiveFinWeight':int(np.sum(different&np.any(w[tri]>0,axis=1))),'maxEdgeWeightGradientPerBodyLength':float(gradient[valid].max()),'maxFinOnlyEdgeRatio':best,'minFinOnlyEdgeRatio':small,'maxFinOnlyTriangleAreaRatio':areaMax,'worstEdge':worst,'testFinAngleRadians':maxAngle,'testPhases':24,'meaning':'Local independent fin deformation only; source shape and original triangles. Full GPU spine+fin gate remains separate.'}
def main():
 import sys
 dry='--dry-run' in sys.argv;manifest=json.loads((ROOT/'data/scores.json').read_text(encoding='utf8'));reports=[]
 for item in manifest['items']:
  path=ROOT/'data'/item['file'];score=json.loads(gzip.decompress(path.read_bytes()));beforeHash=protected(score);eyeHash=sha(compact(score['eyes']));before=strain(score);repair=api['refine_fin_bindings_r02'](score);after=strain(score);same=beforeHash==protected(score)
  if not same or eyeHash!=sha(compact(score['eyes'])):raise RuntimeError('Protected original carrier or frozen eyes changed')
  if not dry:
   gz=gzip.compress(compact(score),9,mtime=0);path.write_bytes(gz);item['sha256']=sha(gz);item['bytes']=len(gz);metaPath=ROOT/'data'/item['metadataFile'];meta=json.loads(metaPath.read_text(encoding='utf8'));meta['fins']=score['rig']['fins'];meta['bindingVertexCounts']={str(i):sum(int(np.sum((np.array(p['finId'])==i)&(np.array(p['finWeight'])>0))) for p in score['primitives']) for i in range(8)};meta['bindingR02']={'before':before,'after':after,'repair':repair,'frozenEyesSha256':eyeHash,'protectedCarrierSha256':beforeHash};metaPath.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
  reports.append({'id':item['id'],'before':before,'after':after,'repair':repair,'sourceSampling':{'vertices':sum(len(p['positions'])//3 for p in score['primitives']),'triangles':sum(len(p['indices'])//3 for p in score['primitives']),'texturePixelResolutions':[t.get('resolution') for t in score['textures']],'originalNormalMapMaterialCount':sum('normalTexture' in m for m in score['materials'])},'sourceGeometryTexturesUvsIndicesNormalsFrozen':same,'eyesSerializedSha256':eyeHash,'protectedCarrierSha256':beforeHash});print(item['id'],before['maxFinOnlyEdgeRatio'],'->',after['maxFinOnlyEdgeRatio'],'mixed',after['crossClassTrianglesWithActiveFinWeight'],flush=True)
 report={'taskId':'FISH_UNIFIED_SURFACE_MOTION_R02_20261002','checkedAt':datetime.now(timezone.utc).isoformat(),'baseSha':'e6c15feb0ad7b3c8ef369f3a2e0fdd05f889fc49','dryRun':dry,'models':reports,'pass':all(r['sourceGeometryTexturesUvsIndicesNormalsFrozen'] and r['after']['crossClassTrianglesWithActiveFinWeight']==0 and r['repair']['finGradientFinite'] for r in reports),'eyesFrozen':True,'noGeometrySubdivision':True,'samplingLimits':'Original mesh point counts and texture pixel resolutions retained; low original sampling does not gain detail through procedural binding repair.','fullGpuAndVisualGate':'REQUIRED_SEPARATELY','productionReady':False}
 (ROOT/'evidence/R02_SOURCE_REBUILD_REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 if not dry:(ROOT/'data/scores.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
if __name__=='__main__':main()
