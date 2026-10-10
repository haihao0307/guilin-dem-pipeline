"""Keep failed capability tests; expose them, and validate provenance separately."""
from pathlib import Path
import json,shutil
P=Path(__file__).resolve().parent;A=P/'assets'
report=json.loads((P/'BROWSER_REPORT.json').read_text())
if not (P/'FIRST_FULL_AUDIT.json').exists():shutil.copyfile(P/'BROWSER_REPORT.json',P/'FIRST_FULL_AUDIT.json')
material=json.loads((A/'MATERIAL_AUDIT.json').read_text())['nativeMaterials'];cache=json.loads((A/'results/index.json').read_text())
readiness={r['id']:{'status':'native-material-ready' if r['vertices'] else 'native-material-rejected','reason':r['error'],'vertices':r['vertices']} for r in material}
for id,row in cache.get('failed',{}).items():readiness[id]={'status':'native-solve-failed','reason':row['reason']}
summary={'originalPapers':len(material),'nativeMaterialsReady':sum(r['vertices']>0 for r in material),'nativeMaterialRejected':sum(not r['vertices'] for r in material),'actualSolverRecords':len(cache['rows']),'staticGatePassedRecords':sum(bool(r['qualityPassed']) for r in cache['rows'].values()),'all60GarmentsAccepted':False}
(A/'readiness.json').write_text(json.dumps({'rows':readiness,'summary':summary},ensure_ascii=False,indent=2))
f=P/'app.mjs';s=f.read_text()
if 'let readiness=' not in s:
 s=s.replace('const sessions=new Map();','let readiness={rows:{},summary:{}},coordinateAudit=0,indexAudit=true;\nconst sessions=new Map();')
 s=s.replace("||!spec||busy||phase==='paused'","||!spec||!worker||busy||phase!=='paper'")
 a=s.index('function cards(){');b=s.index('\nfunction categories()',a)
 s=s[:a]+'''function cards(){const list=rows();$('count').textContent=`${list.length} / 60 原始版式 · ${readiness.summary.nativeMaterialsReady} 款可原生重网格 · ${Object.keys(cache.rows).length} 个原求解记录`;
 $('cards').innerHTML=list.map(r=>{const e=cache.rows[r.id],info=readiness.rows[r.id],rejected=info&&info.status!=='native-material-ready',label=info?.status==='native-solve-failed'?'原求解中止':rejected?'原网格 / 缝边限制':'尚未取得原缝合结果';
 return `<button class="card" data-id="${r.id}" data-state="${e?'native-result':info?.status||'pending'}" aria-pressed="${current?.id===r.id}"><div class="thumb">${e?`<img src="assets/results/${esc(e.thumb)}" alt="${esc(r.name)}的原求解器实际结果"><span>${e.qualityPassed?'原静态门槛通过':'原结果未通过成衣门槛'}</span>`:`<div class="pending ${rejected?'rejected':''}">原纸样已保留<br><b>${label}</b>${rejected?'<small>原始失败保留，不补造衣壳</small>':''}</div>`}</div><strong>${r.id} ${esc(r.name)}</strong><small>${r.panelCount} 裁片 / ${r.seamCount} 缝边 · ${r.category}</small></button>`}).join('');for(const b of $('cards').querySelectorAll('button'))b.onclick=()=>select(b.dataset.id);
}'''+s[b:]
 marker="const token=serial;if(eligible()&&cache.rows[id])"
 s=s.replace(marker,"if(eligible()&&!cache.rows[id]&&readiness.rows[id]?.status!=='native-material-ready'){phase='failed';message('此前原流程的结果：'+readiness.rows[id]?.reason,true);controls();}\n "+marker)
 s=s.replace('const out=new Float32Array(positionsM.length);','let attr=cloth.geometry.attributes.position;if(!attr||attr.array.length!==positionsM.length){attr=new THREE.BufferAttribute(new Float32Array(positionsM.length),3);cloth.geometry.setAttribute(\'position\',attr);}const out=attr.array;')
 s=s.replace("cloth.geometry.setAttribute('position',new THREE.BufferAttribute(out,3));cloth.geometry.computeVertexNormals();cloth.geometry.computeBoundingSphere();viewer.render();","attr.needsUpdate=true;cloth.geometry.computeVertexNormals();cloth.geometry.computeBoundingSphere();const audit=auditDisplay();coordinateAudit=audit.error;indexAudit=audit.indices;viewer.render();")
 a=s.index('function state(){let coordinateError=0;');b=s.index("return{version:",a)
 s=s[:a]+'''function auditDisplay(){let error=0;if(!cloth||!latestSolverM)return{error,indices:true};const p=cloth.geometry.attributes.position.array;for(let i=0;i<p.length;i++)error=Math.max(error,Math.abs(p[i]-Math.fround(latestSolverM[i]-(i%3===1?lock.groundShiftM:0))));return{error,indices:stable(Array.from(cloth.geometry.index.array))===stable(facesOf(spec))};}
function state(){'''+s[b:]
 s=s.replace("version:'R04-SOURCE-1'","version:'R04-SOURCE-2'")
 s=s.replace('renderCoordinateErrorM:coordinateError,clothIndexMatchesNative:cloth?stable(Array.from(cloth.geometry.index.array))===stable(facesOf(spec)):true,','renderCoordinateErrorM:cloth?coordinateAudit:0,clothIndexMatchesNative:cloth?indexAudit:true,')
 s=s.replace('[lock,catalogue,cache]=await Promise.all(', '[lock,catalogue,cache,readiness]=await Promise.all(')
 s=s.replace("json('assets/results/index.json')]);","json('assets/results/index.json'),json('assets/readiness.json')]);")
 s=s.replace('window.__R04={state,select,','window.__R04={state,auditDisplay,select,')
 f.write_text(s)
f=P/'style.css';s=f.read_text()
if '.pending.rejected' not in s:f.write_text(s+'\n.pending.rejected{color:#d6b398;background:#322d2b}.pending.rejected b{color:#e2bea2}.pending.rejected small{font-size:9px;padding:7px;text-align:center}\n')
# Preserve the first failed full-capability report; never turn it into a passing clothing-catalogue test.
f=P/'qa_native.py';s=f.read_text()
if 'SOURCE_REPAIR_SCOPE' not in s:
 s=s.replace("R={'url':BASE", "SOURCE_REPAIR_SCOPE=os.environ.get('R04_SWEEP')=='0'\nR={'sourceCommit':os.environ.get('GITHUB_SHA'),'scope':'source-repair-runtime' if SOURCE_REPAIR_SCOPE or PUBLIC else 'complete-material-capability','url':BASE")
 s=s.replace('  if not PUBLIC:\n   material=[]','  if not PUBLIC and not SOURCE_REPAIR_SCOPE:\n   material=[]')
 s=s.replace("(['J06','T01','P01'] if not PUBLIC else ['T01'])","(['J06','T01','P01'] if not PUBLIC and not SOURCE_REPAIR_SCOPE else ['T01'])")
 marker="  check('One native original CommonViewer canvas',s['canvasCount']==1)"
 extra='''
  capabilities=json.loads((A/'readiness.json').read_text())['summary'];R['capabilities']=capabilities
  check('Known incomplete catalogue is not relabelled as finished',capabilities['nativeMaterialRejected']==11 and capabilities['all60GarmentsAccepted'] is False)
  if SOURCE_REPAIR_SCOPE or PUBLIC:
   page.evaluate('__R04.select("T01")');cached=page.evaluate('__R04.state()');check('Cached result is actual source-bound T01 solver output',cached['phase']=='done' and cached['clothVertices']>0 and cached['renderCoordinateErrorM']==0 and cached['staticGate']['passed'])
   page.evaluate('__R04.select("P01")');cached=page.evaluate('__R04.state()');check('Failed original P01 result stays failed',cached['phase']=='done' and cached['staticGate']['passed'] is False and bool(cached['staticGate']['failures']))
'''
 assert marker in s;s=s.replace(marker,marker+extra)
 s=s.replace("finally:dump(P/('PUBLIC_REPORT.json' if PUBLIC else 'BROWSER_REPORT.json'),R)","finally:dump(P/('PUBLIC_REPORT.json' if PUBLIC else 'SOURCE_BROWSER_REPORT.json' if SOURCE_REPAIR_SCOPE else 'BROWSER_REPORT.json'),R)")
 f.write_text(s)
f=P/'native/kaopu-tailor-workbench/catalogue/r074-worker.bundle.mjs';original=f.read_text();prefix=original[:original.index('self.onmessage =')]
extra='''\nexport async function nativeReference(input){const a=await recoverExplicitPantsCuffGathering(input);const spec=compileAnalytic(a,{allowUnsupportedSeams:true,numericalStitchSpacingMm:12,measurementSnapshot:{bodyId:'anny-adult-neutral-r01'}});validate2(spec);return spec;}\n'''
(f.parent/'reference-probe.mjs').write_text(prefix+extra)
(P/'SOURCE_SCOPE.json').write_text(json.dumps({'version':'R04-SOURCE-2','sourceLineageRepair':True,'allMaterialMeshesPassed':False,'all60FinishedGarmentsDelivered':False,'firstCapabilityAudit':'FIRST_FULL_AUDIT.json','nativeMaterialReady':49,'nativeMaterialRejected':11,'nativeTrials':{'T01':'native-static-gate-passed','P01':'native-static-gate-failed','J06':'native-deformation-abort'},'geometryProxyFallback':False,'physicalFitAccepted':False},ensure_ascii=False,indent=2))
print('SOURCE_UI_FINALIZED',summary,flush=True)
