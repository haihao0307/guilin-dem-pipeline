"""Source-only repairs and separately guarded promotion of two re-solved native garments."""
from pathlib import Path
import sys,json,hashlib,gzip,math,os
P=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()

def patch():
 expected={'app.mjs':'c75c3b399cf3120e4ff554d63c69159da0cde35a51ea08b54d7d7f0d58df2f65','outfits-r043.mjs':'5b23a3e662380a90a0ce175812f0562594f845c8f240e0fb03fa8f10faba8788','native/kaopu-tailor-workbench/catalogue/native-adapter.mjs':'f61299902f39df605458983186ef0c063fd7a6ace5f521e43eff8985899474c7'}
 texts={n:(P/n).read_text() for n in expected}
 for n,h in expected.items():assert sha((P/n).read_bytes())==h,('Source changed before repair',n)
 def replace(n,a,b):
  assert texts[n].count(a)==1,(n,a)
  texts[n]=texts[n].replace(a,b)
 n='app.mjs';texts[n]="import{smoothSewnNormals}from'./sewn-normals-r0433.mjs';\n"+texts[n]
 replace(n,'cloth.geometry.computeVertexNormals();cloth.geometry.computeBoundingSphere();','cloth.geometry.computeVertexNormals();cloth.userData.sewnNormalAudit=smoothSewnNormals(cloth.geometry,spec,record?.activeSeams);cloth.geometry.computeBoundingSphere();')
 replace(n,"version:'R04-SOURCE-5.3',","version:'R04-SOURCE-5.3',sewnNormalAudits:[cloth,...outfitMeshes].filter(Boolean).map(m=>m.userData.sewnNormalAudit),")
 replace(n,"viewer.renderer.getContext().getExtension('WEBGL_lose_context')?.loseContext()","viewer.renderer.forceContextLoss()")
 replace(n,"viewer.renderer.getContext().getExtension('WEBGL_lose_context')?.restoreContext()","viewer.renderer.forceContextRestore()")
 n='outfits-r043.mjs';texts[n]="import{smoothSewnNormals}from'./sewn-normals-r0433.mjs';\n"+texts[n]
 replace(n,'mesh.userData={binding:','mesh.userData={sewnNormalAudit:smoothSewnNormals(g,spec,record.activeSeams),binding:')
 n='native/kaopu-tailor-workbench/catalogue/native-adapter.mjs';texts[n]="import{stageLowerBodyPanels}from'../../../initial-placement-r0433.mjs';\n"+texts[n]
 replace(n,'new Set(["T01","T02","T03","T04","T08","T15","T16","T17","T18"])','new Set(["T01","T02","T03","T04","T15","T16","T17","T18"])')
 replace(n,'prepareAssembly(spec,body);prepareShoulderFixtures(spec,sdf);','prepareAssembly(spec,body);if(nativeBinding?.presetId==="S06")stageLowerBodyPanels(spec,body);prepareShoulderFixtures(spec,sdf);')
 for n,text in texts.items():(P/n).write_text(text)
 (P/'R0433_RUNTIME_REPAIR.json').write_text(json.dumps({'before':expected,'after':{n:sha((P/n).read_bytes()) for n in texts},'nativeRoutesChanged':['T08','S06'],'bodyChanged':False,'qualityGatesLowered':False,'staticSolverMathChanged':False,'note':'T08 reuses existing material bending route. S06 changes only initial rigid staging, with full-body collisions retained. Display normals never move source vertices.'},indent=2))

def promote():
 index=json.loads((P/'assets/results/index.json').read_text());report={'sourceCommit':os.environ.get('GITHUB_SHA'),'rows':[],'protectedRecords':{},'originalPaperBytesChanged':False,'qualityThresholdsChanged':False,'allGarmentsAccepted':False}
 for id in ['T08','S06']:
  entry=index['rows'][id];path=P/'assets/results'/entry['file'];before=path.read_bytes();assert sha(before)==entry['sha256'];old=json.loads(gzip.decompress(before));trial=json.loads(gzip.decompress((P/'candidate-r0433'/f'{id}.json.gz').read_bytes()));gate=trial['record']['staticGate']
  assert gate['thresholds']==old['record']['staticGate']['thresholds']
  for key in ['person','presetId','recipeHash','paperSHA256','nativeAnchor','patternSizingOrigin']:assert trial['binding'][key]==old['binding'][key],key
  assert trial['binding']==trial['record']['nativeBinding'];assert len(trial['spec']['panels'])==len(old['spec']['panels'])
  uv_error=0
  for a,b in zip(old['spec']['panels'],trial['spec']['panels']):
   assert a['id']==b['id'] and a['triangles']==b['triangles'] and len(a['uvMm'])==len(b['uvMm'])
   uv_error=max(uv_error,max(abs(x-y) for u,v in zip(a['uvMm'],b['uvMm']) for x,y in zip(u,v)))
  # Fresh floating-point compilation can change ~1e-13 mm, so do not forge identical hashes.
  assert uv_error<1e-9,(id,uv_error)
  assert all(len(p)==3 and all(math.isfinite(v) for v in p) for p in trial['record']['positionsMm'])
  assert trial['record']['metrics']['maxPrincipalStrain']<=old['record']['metrics']['maxPrincipalStrain']+1e-6
  if id=='T08':assert gate['passed'] and not gate['failures']
  if id=='S06':
   assert set(gate['failures'])<set(old['record']['staticGate']['failures'])
   assert 'inside-body' not in gate['failures'] and 'body-intersections' not in gate['failures']
   assert trial['spec']['source']['lowerBodyStagingR0433']['fullBodyCollisionUnchanged']
  packet={k:trial[k] for k in ['binding','spec','record']};packet.update(complete=True,sourceRun=os.environ.get('GITHUB_SHA'),review='R0433 native re-solve; display improvement is not complete fit approval')
  raw=gzip.compress(json.dumps(packet,ensure_ascii=False,separators=(',',':')).encode(),mtime=0);path.write_bytes(raw)
  entry.update(sha256=sha(raw),qualityPassed=gate['passed'],thumbReady=False,kind='NATIVE_R0433_REVIEWED_RECOMPUTE')
  report['rows'].append({'id':id,'beforeSHA256':sha(before),'afterSHA256':sha(raw),'beforeFailures':old['record']['staticGate']['failures'],'afterFailures':gate['failures'],'maximumRecompiledUVRoundoffMm':uv_error,'beforeMaterialHash':old['binding']['materialSHA256'],'afterMaterialHash':trial['binding']['materialSHA256'],'sourceTriangleOrderUnchanged':True,'physicalFitAccepted':False})
 for id,r in index['rows'].items():
  if id not in ['T08','S06']:assert sha((P/'assets/results'/r['file']).read_bytes())==r['sha256'];report['protectedRecords'][id]=r['sha256']
 assert len(index['rows'])==60 and sum(r['qualityPassed'] for r in index['rows'].values())==22
 index['source']='reviewed-native-r0433';index['sourceCommit']=os.environ.get('GITHUB_SHA');index['r0433NativeRoutes']=['T08','S06']
 (P/'assets/results/index.json').write_text(json.dumps(index,ensure_ascii=False,indent=2))
 (P/'R0433_NATIVE_REVIEW.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print('Two guarded native re-solves promoted; all 58 other native records preserved')
if __name__=='__main__':
 if len(sys.argv)>1 and sys.argv[1]=='promote':promote()
 else:patch()
